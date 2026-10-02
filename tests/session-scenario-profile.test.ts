import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkpointCampaignMission, createCampaignProfile, prepareCampaignMission } from '../src/core/campaign';
import { createConquestProfile, prepareConquestBattle, checkpointConquestBattle } from '../src/core/conquest';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { issueCommand, stepGame } from '../src/core/simulation';
import { captureScenario, scenarioRulesCompatibility, scenarioSessionForState } from '../src/core/scenarios';
import { ScenarioRecorder, verifyScenarioRecording } from '../src/core/scenario-recordings';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { saveGame } from '../src/core/saves';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/scenario-save3-3.2/${name}.json`, import.meta.url), 'utf8'));

describe('scenario ownership in ordinary session saves', () => {
  it('retains the active campaign and matching battlefield through export and reload', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'generic-owner'));
    stepGame(run.session.state, .05);
    const profile = checkpointCampaignMission(run.profile, run.session, run.recorder); run.recorder.destroy();
    const file = createSessionFile(run.session.state, undefined, undefined, { kind: 'campaign', profile }), restored = decodeSessionFile(JSON.stringify(file));
    expect(restored.file.scenarioProfile).toEqual({ kind: 'campaign', profile }); expect(restored.state.scenario?.runtime).toEqual(run.session.runtime);
    expect(captureScenario({ ...run.session, state: restored.state, runtime: restored.state.scenario!.runtime })).toEqual(captureScenario(run.session));
  });

  it('continues both SAVE4 histories from the loaded campaign without changing their initial checkpoint or accepted prefix', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'both-histories'));
    const match = new MatchRecorder(run.session.state);
    let continuedMatch: MatchRecorder | undefined, continuedMission: ScenarioRecorder | undefined;
    try {
      const commander = run.session.runtime.labels.commander;
      expect(issueCommand(run.session.state, 0, { type: 'hold', ids: [commander] })).toBe(true);
      stepGame(run.session.state, .05);
      const profile = checkpointCampaignMission(run.profile, run.session, run.recorder);
      const originalJournal = structuredClone(profile.active!.recording), originalReplay = match.export();
      const source = createSessionFile(run.session.state, originalReplay, undefined, { kind: 'campaign', profile });
      expect(source.game.version).toBe(4);
      expect(source.replay).toMatchObject({ checksumVersion: 4, simulationRevision: '4.0.2', initial: { version: 4 } });
      const restored = decodeSessionFile(JSON.stringify(source)), session = scenarioSessionForState(restored.state)!;
      expect(restored.file).toEqual(source); expect(saveGame(restored.state)).toEqual(source.game);
      run.recorder.destroy(); match.dispose();
      continuedMatch = new MatchRecorder(restored.state, restored.file.replay);
      continuedMission = new ScenarioRecorder(session, originalJournal);
      const tick = restored.state.tick, command = { type: 'move' as const, ids: [commander], x: 9, y: 17 };
      expect(issueCommand(restored.state, 0, command)).toBe(true); stepGame(restored.state, .05);
      const journal = continuedMission.archive(), replay = continuedMatch.export();
      expect(journal.initial).toEqual(originalJournal.initial);
      expect(journal.commands).toEqual([...originalJournal.commands, { tick, side: 0, command }]);
      expect(replay.initial).toEqual(originalReplay.initial);
      expect(replay.actions).toEqual([...originalReplay.actions, { type: 'command', side: 0, command }, { type: 'advance', dt: .05, ticks: 1 }]);
      expect(saveGame(verifyScenarioRecording(journal).state)).toEqual(saveGame(restored.state));
      const playback = new ReplayPlayer(replay);
      try { while (!playback.finished) playback.advance(20); expect(saveGame(playback.state)).toEqual(saveGame(restored.state)); }
      finally { playback.dispose(); }
      const continuedProfile = checkpointCampaignMission(profile, session, continuedMission);
      const finalFile = createSessionFile(restored.state, replay, undefined, { kind: 'campaign', profile: continuedProfile });
      expect(decodeSessionFile(JSON.stringify(finalFile)).file).toEqual(finalFile);
      expect(profile.active!.recording).toEqual(originalJournal);
    } finally { run.recorder.destroy(); match.dispose(); continuedMatch?.dispose(); continuedMission?.destroy(); }
  });

  it('keeps the original historical game at SAVE3 while exporting its restored state as SAVE4 for inspection', () => {
    const game = fixture('generic-bound-final'), original = JSON.stringify(game);
    const restored = decodeSessionFile({ format: 'orcs-vs-fairies/session', version: 1, game });
    expect(restored.file.game.version).toBe(3); expect(JSON.stringify(restored.file.game)).toBe(original);
    expect(JSON.stringify(game)).toBe(original);
    const migrated = saveGame(restored.state), session = scenarioSessionForState(restored.state)!;
    expect(migrated.version).toBe(4); expect(migrated.state.scenario?.simulationRevision).toBeUndefined();
    expect(scenarioRulesCompatibility(session).reason).toContain('inspection');
    const command = { type: 'hold' as const, ids: [session.runtime.labels.commander] };
    expect(issueCommand(restored.state, 0, command)).toBe(false);
    expect(() => stepGame(restored.state, .05)).toThrow('inspection');
    expect(saveGame(restored.state)).toEqual(migrated);
    const exported = createSessionFile(restored.state);
    expect(exported.game).toEqual(migrated);
    expect(scenarioRulesCompatibility(scenarioSessionForState(decodeSessionFile(exported).state)!).reason).toContain('inspection');
  });

  it('retains conquest decisions, army and active battle', () => {
    const run = prepareConquestBattle(createConquestProfile('orcs', 'generic-realm'), 'grove');
    stepGame(run.session.state, .05);
    const profile = checkpointConquestBattle(run.profile, run.session, run.recorder); run.recorder.destroy();
    expect(decodeSessionFile(createSessionFile(run.session.state, undefined, undefined, { kind: 'conquest', profile })).file.scenarioProfile).toEqual({ kind: 'conquest', profile });
  });

  it('rejects a profile whose checkpoint is from another battlefield tick', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'wrong-tick')); stepGame(run.session.state, .05);
    expect(() => createSessionFile(run.session.state, undefined, undefined, { kind: 'campaign', profile: run.profile })).toThrow('does not match'); run.recorder.destroy();
  });

  it('rejects executable metadata before reading a profile', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'metadata-accessor')); let reads = 0;
    const owner = { kind: 'campaign', get profile() { reads++; return run.profile; } };
    expect(() => createSessionFile(run.session.state, undefined, undefined, owner as never)).toThrow('accessors'); expect(reads).toBe(0); run.recorder.destroy();
  });

  it('keeps ordinary session files unchanged when no profile is supplied', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'no-owner'));
    const file = createSessionFile(run.session.state); expect(Object.hasOwn(file, 'scenarioProfile')).toBe(false); expect(decodeSessionFile(file).file).toEqual(file); run.recorder.destroy();
  });
});
