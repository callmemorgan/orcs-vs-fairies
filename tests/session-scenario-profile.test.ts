import { describe, expect, it } from 'vitest';
import { checkpointCampaignMission, createCampaignProfile, prepareCampaignMission } from '../src/core/campaign';
import { createConquestProfile, prepareConquestBattle, checkpointConquestBattle } from '../src/core/conquest';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { stepGame } from '../src/core/simulation';
import { captureScenario } from '../src/core/scenarios';

describe('scenario ownership in ordinary session saves', () => {
  it('retains the active campaign and matching battlefield through export and reload', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'generic-owner'));
    stepGame(run.session.state, .05);
    const profile = checkpointCampaignMission(run.profile, run.session, run.recorder); run.recorder.destroy();
    const file = createSessionFile(run.session.state, undefined, undefined, { kind: 'campaign', profile }), restored = decodeSessionFile(JSON.stringify(file));
    expect(restored.file.scenarioProfile).toEqual({ kind: 'campaign', profile }); expect(restored.state.scenario?.runtime).toEqual(run.session.runtime);
    expect(captureScenario({ ...run.session, state: restored.state, runtime: restored.state.scenario!.runtime })).toEqual(captureScenario(run.session));
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
