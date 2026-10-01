import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { campaignArmy, campaignProgress, campaignRulesCompatibility, checkpointCampaignMission, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, prepareCampaignMission, resetCampaignMission, survivingScenarioArmy, verifyCanonicalCampaignVictory, type CampaignProfile } from '../src/core/campaign';
import { checkpointConquestBattle, completeConquestBattle, conquestRulesCompatibility, createConquestProfile, decodeConquestProfile, prepareConquestBattle, proposeConquest, waitConquestTurn } from '../src/core/conquest';
import type { ConquestProfile } from '../src/core/conquest-types';
import { scenarioCheckpointChecksum, scenarioRecordingRulesCompatibility, type ScenarioRecording } from '../src/core/scenario-recordings';
import { captureScenario, createScenario, issueScenarioCommand, restoreScenario, stepScenario } from '../src/core/scenarios';
import { SIMULATION_REVISION } from '../src/core/versions';
import { SCENARIOS } from '../src/scenarios/campaigns';
import { solveMission } from '../scripts/scenarios/mission-strategy';
import { solveConquest } from '../scripts/scenarios/conquest-strategy';

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/scenario-save3-3.2/${name}.json`, import.meta.url), 'utf8'));
const withoutRevision = <T extends { simulationRevision?: string }>(profile: T): T => {
  const copy = structuredClone(profile); delete copy.simulationRevision; return copy;
};
const unpinnedJournal = (recording: ScenarioRecording): ScenarioRecording => {
  const { version: _version, simulationRevision: _revision, checksumVersion: _checksumVersion, ...body } = recording;
  return { ...structuredClone(body), version: 1 };
};
const mismatchedJournal = (recording: ScenarioRecording): ScenarioRecording => {
  const copy = structuredClone(recording);
  if (copy.version !== 2) throw new Error('Expected a current journal.');
  copy.simulationRevision = '0.0.0'; return copy;
};
const expectReadOnly = (compatibility: { compatible: boolean; reason: string | null; revision: string }, actions: Array<() => unknown>) => {
  expect(compatibility).toMatchObject({ compatible: false, reason: expect.any(String), revision: expect.any(String) });
  for (const action of actions) expect(action).toThrow(compatibility.reason!);
};

function campaignWrites(profile: CampaignProfile, run: ReturnType<typeof prepareCampaignMission>) {
  return [
    () => chooseCampaignBranch(profile, 'surveyor'),
    () => prepareCampaignMission(profile),
    () => checkpointCampaignMission(profile, run.session, run.recorder),
    () => completeCampaignMission(profile, run.session, run.recorder.archive()),
    () => resetCampaignMission(profile),
    () => verifyCanonicalCampaignVictory(profile, 'dwarves-4'),
  ];
}
function conquestWrites(profile: ConquestProfile, run: ReturnType<typeof prepareConquestBattle>) {
  return [
    () => proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 25 }),
    () => proposeConquest(profile, { type: 'truce', faction: 'fairies', turns: 1 }),
    () => proposeConquest(profile, { type: 'alliance', faction: 'fairies' }),
    () => waitConquestTurn(profile),
    () => prepareConquestBattle(profile, profile.active?.regionId ?? 'quarry', profile.active?.mode ?? 'attack'),
    () => checkpointConquestBattle(profile, run.session, run.recorder),
    () => completeConquestBattle(profile, run.session, run.recorder.archive()),
  ];
}

describe('campaign and conquest profile rules migration', () => {
  it('pins new profiles and makes empty profiles without current rules read-only', () => {
    const campaign = createCampaignProfile('campaign-dwarves', 'current-campaign-rules');
    const conquest = createConquestProfile('orcs', 'current-conquest-rules');
    expect(campaign.simulationRevision).toBe(SIMULATION_REVISION);
    expect(conquest.simulationRevision).toBe(SIMULATION_REVISION);
    expect(campaignRulesCompatibility(campaign)).toEqual({ compatible: true, reason: null, revision: SIMULATION_REVISION });
    expect(conquestRulesCompatibility(conquest)).toEqual({ compatible: true, reason: null, revision: SIMULATION_REVISION });
    const campaignRun = prepareCampaignMission(campaign), conquestRun = prepareConquestBattle(conquest, 'quarry');
    try {
      for (const profile of [withoutRevision(campaign), { ...campaign, simulationRevision: '0.0.0' }]) {
        const decoded = decodeCampaignProfile(profile), before = JSON.stringify(decoded), compatibility = campaignRulesCompatibility(decoded);
        expectReadOnly(compatibility, campaignWrites(decoded, campaignRun));
        expect(campaignProgress(decoded).readOnlyReason).toBe(compatibility.reason);
        expect(JSON.stringify(decoded)).toBe(before);
      }
      for (const profile of [withoutRevision(conquest), { ...conquest, simulationRevision: '0.0.0' }]) {
        const decoded = decodeConquestProfile(profile), before = JSON.stringify(decoded);
        expectReadOnly(conquestRulesCompatibility(decoded), conquestWrites(decoded, conquestRun));
        expect(JSON.stringify(decoded)).toBe(before);
      }
    } finally { campaignRun.recorder.destroy(); conquestRun.recorder.destroy(); }
  });

  it.each(['campaign-active', 'campaign-completed'])('preserves the genuine %s profile and permits army inspection', name => {
    const raw = fixture<CampaignProfile>(name), before = JSON.stringify(raw);
    const decoded = decodeCampaignProfile(raw), compatibility = campaignRulesCompatibility(decoded);
    expect(JSON.stringify(decoded)).toBe(before); expect(JSON.stringify(raw)).toBe(before);
    expect(compatibility.compatible).toBe(false); expect(compatibility.reason).toEqual(expect.any(String));
    expect(campaignProgress(decoded).readOnlyReason).toBe(compatibility.reason);
    if (decoded.history.length) {
      const expected = survivingScenarioArmy(restoreScenario(decoded.history[0].checkpoint)).sort((a, b) => a.entity.id - b.entity.id);
      expect(campaignArmy(decoded)).toEqual(expected);
      expect(campaignArmy(decoded).some(soldier => soldier.label === 'commander')).toBe(true);
    } else expect(campaignArmy(decoded)).toEqual([]);
    expect(JSON.stringify(decoded)).toBe(before);
    expect(decodeCampaignProfile(before)).toEqual(decoded);
  });

  it.each(['conquest-active', 'conquest-completed'])('preserves the genuine %s profile, including repeated historical battles', name => {
    const raw = fixture<ConquestProfile>(name), before = JSON.stringify(raw), decoded = decodeConquestProfile(raw);
    expect(JSON.stringify(decoded)).toBe(before); expect(JSON.stringify(raw)).toBe(before);
    expect(conquestRulesCompatibility(decoded).compatible).toBe(false);
    expect(decoded.history.filter(action => action.type === 'battle')).toHaveLength(2);
    expect(decoded.army).toEqual(raw.army); expect(decoded.regions).toEqual(raw.regions);
    expect(decoded.relations).toEqual(raw.relations); expect(decoded.treasury).toEqual(raw.treasury);
    expect(decodeConquestProfile(before)).toEqual(decoded);
  });

  it('keeps omitted derived fields omitted in legacy checkpoint and journal data', () => {
    const campaign = fixture<CampaignProfile>('campaign-completed'), conquest = fixture<ConquestProfile>('conquest-active');
    for (const checkpoint of [campaign.history[0].checkpoint, campaign.history[0].recording.initial, conquest.active!.checkpoint, conquest.active!.recording.initial]) {
      delete (checkpoint.runtime as Partial<typeof checkpoint.runtime>).lastEvaluatedTick;
    }
    const campaignBefore = JSON.stringify(campaign), conquestBefore = JSON.stringify(conquest);
    const decodedCampaign = decodeCampaignProfile(campaign), decodedConquest = decodeConquestProfile(conquest);
    expect(JSON.stringify(decodedCampaign)).toBe(campaignBefore); expect(JSON.stringify(decodedConquest)).toBe(conquestBefore);
    expect(Object.hasOwn(decodedCampaign.history[0].checkpoint.runtime, 'lastEvaluatedTick')).toBe(false);
    expect(Object.hasOwn(decodedConquest.active!.recording.initial.runtime, 'lastEvaluatedTick')).toBe(false);
  });

  it('rejects every writer and claim before resuming a genuine legacy active battle', () => {
    const campaign = decodeCampaignProfile(fixture('campaign-active')), conquest = decodeConquestProfile(fixture('conquest-active'));
    const campaignRun = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'guard-current-campaign'));
    const conquestRun = prepareConquestBattle(createConquestProfile('orcs', 'guard-current-conquest'), 'quarry');
    const campaignBefore = JSON.stringify(campaign), conquestBefore = JSON.stringify(conquest);
    try {
      expectReadOnly(campaignRulesCompatibility(campaign), campaignWrites(campaign, campaignRun));
      expectReadOnly(conquestRulesCompatibility(conquest), conquestWrites(conquest, conquestRun));
      expect(JSON.stringify(campaign)).toBe(campaignBefore); expect(JSON.stringify(conquest)).toBe(conquestBefore);
    } finally { campaignRun.recorder.destroy(); conquestRun.recorder.destroy(); }
  });

  it('rejects legacy duplicate completions before their existing-result shortcuts', () => {
    const campaign = decodeCampaignProfile(fixture('campaign-completed')), result = campaign.history[0];
    const conquest = decodeConquestProfile(fixture('conquest-completed'));
    const battle = conquest.history.find(action => action.type === 'battle')!;
    for (const profile of [campaign, { ...campaign, simulationRevision: SIMULATION_REVISION }]) {
      expectReadOnly(campaignRulesCompatibility(profile), [() => completeCampaignMission(profile, restoreScenario(result.checkpoint), result.recording)]);
    }
    for (const profile of [conquest, { ...conquest, simulationRevision: SIMULATION_REVISION }]) {
      expectReadOnly(conquestRulesCompatibility(profile), [() => completeConquestBattle(profile, restoreScenario(battle.recording.initial), battle.recording)]);
    }
  });

  it('guards every writer when a current outer rules pin contains an incompatible journal', () => {
    const campaignRun = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'guard-nested-campaign'));
    const conquestRun = prepareConquestBattle(createConquestProfile('orcs', 'guard-nested-conquest'), 'quarry');
    try {
      const changedCampaign = structuredClone(campaignRun.profile), changedConquest = structuredClone(conquestRun.profile);
      changedCampaign.active!.recording = mismatchedJournal(changedCampaign.active!.recording);
      changedConquest.active!.recording = mismatchedJournal(changedConquest.active!.recording);
      expectReadOnly(campaignRulesCompatibility(decodeCampaignProfile(changedCampaign)), campaignWrites(changedCampaign, campaignRun));
      expectReadOnly(conquestRulesCompatibility(decodeConquestProfile(changedConquest)), conquestWrites(changedConquest, conquestRun));
      for (const name of ['campaign-active', 'campaign-completed']) {
        const raw = { ...fixture<CampaignProfile>(name), simulationRevision: SIMULATION_REVISION };
        const decoded = decodeCampaignProfile(raw); expect(decoded).toEqual(raw);
        expectReadOnly(campaignRulesCompatibility(decoded), campaignWrites(decoded, campaignRun));
      }
      for (const name of ['conquest-active', 'conquest-completed']) {
        const raw = { ...fixture<ConquestProfile>(name), simulationRevision: SIMULATION_REVISION };
        const decoded = decodeConquestProfile(raw); expect(decoded).toEqual(raw);
        expectReadOnly(conquestRulesCompatibility(decoded), conquestWrites(decoded, conquestRun));
      }
    } finally { campaignRun.recorder.destroy(); conquestRun.recorder.destroy(); }
  });

  it('validates legacy campaign checkpoint checksums, victories, mission identities and deployed references', () => {
    const malformed = [
      (profile: CampaignProfile) => { profile.history[0].recording.finalChecksum = '00000000'; },
      (profile: CampaignProfile) => { profile.history[0].recording.finalTick++; },
      (profile: CampaignProfile) => { profile.history[0].resultId = 'other-profile/dwarves-1'; },
      (profile: CampaignProfile) => { profile.history[0].checkpoint.runtime.definitionId = 'dwarves-4'; },
      (profile: CampaignProfile) => {
        const result = profile.history[0]; result.checkpoint.runtime.outcome = 'lost'; result.checkpoint.game.state.winner = 1;
        result.recording.finalChecksum = scenarioCheckpointChecksum(result.checkpoint);
      },
      (profile: CampaignProfile) => {
        const result = profile.history[0], enemy = result.recording.initial.game.state.entities.find(entity => entity.side === 1)!;
        result.deployedIds = [enemy.id];
      },
      (profile: CampaignProfile) => { profile.history[0].deployedIds = [999999]; },
    ];
    for (const mutate of malformed) { const raw = fixture<CampaignProfile>('campaign-completed'); mutate(raw); expect(() => decodeCampaignProfile(raw)).toThrow(); }
  });

  it('rejects a structurally valid legacy battle from another faction even when its mission ID matches', () => {
    const raw = fixture<CampaignProfile>('campaign-active');
    const checkpoint = captureScenario(createScenario({ ...structuredClone(SCENARIOS['orcs-1']), id: 'dwarves-1' }));
    expect(restoreScenario(checkpoint).definition.faction).toBe('orcs');
    raw.active = {
      missionId: 'dwarves-1', deployedIds: [], checkpoint,
      recording: { format: 'orcs-vs-fairies-scenario-recording', version: 1, initial: structuredClone(checkpoint), commands: [], finalTick: checkpoint.game.state.tick, finalChecksum: scenarioCheckpointChecksum(checkpoint) },
    };
    expect(() => decodeCampaignProfile(raw)).toThrow();
  });

  it('validates legacy conquest state, roster fields, battle references and active checksums', () => {
    const malformed = [
      (profile: ConquestProfile) => { profile.active!.recording.finalChecksum = '00000000'; },
      (profile: ConquestProfile) => { profile.active!.recording.finalTick++; },
      (profile: ConquestProfile) => { profile.active!.checkpoint.runtime.definitionId = 'conquest-orcs-quarry-attack'; },
      (profile: ConquestProfile) => { profile.active!.deployedIds.push(profile.active!.deployedIds[0]); },
      (profile: ConquestProfile) => { profile.active!.deployedIds = [999999]; },
      (profile: ConquestProfile) => { profile.army = profile.army.filter(soldier => soldier.entity.id !== profile.active!.deployedIds[0]); },
      (profile: ConquestProfile) => { profile.army.push(structuredClone(profile.army[0])); },
      (profile: ConquestProfile) => { (profile.army[0].entity as unknown as Record<string, unknown>).order = []; },
      (profile: ConquestProfile) => { (profile.army[0].entity as unknown as Record<string, unknown>).order = { type: 'unknown' }; },
      (profile: ConquestProfile) => { (profile.army[0].entity as unknown as Record<string, unknown>).definitionId = {}; },
      (profile: ConquestProfile) => { (profile.army[0].entity as unknown as Record<string, unknown>).level = []; },
      (profile: ConquestProfile) => { (profile.army[0].entity as unknown as Record<string, unknown>).shield = 'invalid'; },
      (profile: ConquestProfile) => { profile.turn++; },
      (profile: ConquestProfile) => { profile.treasury.ore = -1; },
      (profile: ConquestProfile) => { profile.relations.fairies.score = 101; },
      (profile: ConquestProfile) => { profile.history.find(action => action.type === 'battle')!.regionId = 'unknown-region'; },
      (profile: ConquestProfile) => { profile.history.find(action => action.type === 'battle')!.recording.initial.definition.id = 'conquest-orcs-quarry-attack'; },
    ];
    for (const mutate of malformed) { const raw = fixture<ConquestProfile>('conquest-active'); mutate(raw); expect(() => decodeConquestProfile(raw)).toThrow(); }
  });

  it('continues current campaign journals and guards chosen-branch and duplicate-result shortcuts', () => {
    let profile = createCampaignProfile('campaign-dwarves', 'current-campaign-continuation');
    for (let chapter = 0; chapter < 2; chapter++) {
      const run = prepareCampaignMission(profile);
      try {
        stepScenario(run.session);
        const saved = checkpointCampaignMission(run.profile, run.session, run.recorder);
        const resumed = prepareCampaignMission(decodeCampaignProfile(JSON.stringify(saved)));
        try {
          expect(captureScenario(resumed.session)).toEqual(captureScenario(run.session));
          solveMission(resumed.session); expect(resumed.session.runtime.outcome).toBe('won');
          const recording = resumed.recorder.archive(); profile = completeCampaignMission(resumed.profile, resumed.session, recording);
          expect(completeCampaignMission(profile, resumed.session, recording)).toBe(profile);
          for (const incompatibleInput of [unpinnedJournal(recording), mismatchedJournal(recording)]) {
            expectReadOnly(scenarioRecordingRulesCompatibility(incompatibleInput), [() => completeCampaignMission(profile, resumed.session, incompatibleInput)]);
          }
          for (const readOnly of [withoutRevision(profile), { ...profile, simulationRevision: '0.0.0' }]) {
            expectReadOnly(campaignRulesCompatibility(readOnly), [() => completeCampaignMission(readOnly, resumed.session, recording)]);
          }
          profile = decodeCampaignProfile(JSON.stringify(profile));
          expect(campaignRulesCompatibility(profile).compatible).toBe(true);
        } finally { resumed.recorder.destroy(); }
      } finally { run.recorder.destroy(); }
    }
    profile = chooseCampaignBranch(profile, 'surveyor');
    expect(chooseCampaignBranch(profile, 'surveyor')).toBe(profile);
    const legacyJournal = structuredClone(profile); legacyJournal.history[0].recording = unpinnedJournal(legacyJournal.history[0].recording);
    for (const readOnly of [withoutRevision(profile), { ...profile, simulationRevision: '0.0.0' }, legacyJournal]) {
      expectReadOnly(campaignRulesCompatibility(readOnly), [() => chooseCampaignBranch(readOnly, 'surveyor')]);
    }
    const altered = structuredClone(profile); altered.history[0].deployedIds = [altered.history[0].recording.initial.game.state.entities.find(entity => entity.side === 0 && entity.kind === 'unit')!.id];
    expect(() => decodeCampaignProfile(altered)).toThrow('altered detachment');
  }, 30000);

  it('continues current conquest journals and keeps canonical ownership validation', () => {
    const run = prepareConquestBattle(createConquestProfile('dwarves', 'current-conquest-continuation'), 'quarry');
    try {
      const ids = run.session.state.entities.filter(entity => entity.side === 0 && entity.kind === 'unit').map(entity => entity.id);
      expect(issueScenarioCommand(run.session, 0, { type: 'hold', ids })).toBe(true); stepScenario(run.session);
      const saved = checkpointConquestBattle(run.profile, run.session, run.recorder);
      const resumed = prepareConquestBattle(decodeConquestProfile(JSON.stringify(saved)), 'quarry');
      try {
        expect(captureScenario(resumed.session)).toEqual(captureScenario(run.session));
        solveConquest(resumed.session); expect(resumed.session.runtime.outcome).toBe('won');
        const recording = resumed.recorder.archive(), completed = completeConquestBattle(resumed.profile, resumed.session, recording);
        expect(completeConquestBattle(completed, resumed.session, recording)).toBe(completed);
        for (const incompatibleInput of [unpinnedJournal(recording), mismatchedJournal(recording)]) {
          expectReadOnly(scenarioRecordingRulesCompatibility(incompatibleInput), [() => completeConquestBattle(completed, resumed.session, incompatibleInput)]);
        }
        for (const readOnly of [withoutRevision(completed), { ...completed, simulationRevision: '0.0.0' }]) {
          expectReadOnly(conquestRulesCompatibility(readOnly), [() => completeConquestBattle(readOnly, resumed.session, recording)]);
        }
        const decoded = decodeConquestProfile(JSON.stringify(completed)); expect(conquestRulesCompatibility(decoded).compatible).toBe(true);
        expect(decoded.regions.quarry.owner).toBe('dwarves');
        const altered = structuredClone(decoded); altered.regions.keep.owner = 'dwarves'; expect(() => decodeConquestProfile(altered)).toThrow('disagree');
      } finally { resumed.recorder.destroy(); }
    } finally { run.recorder.destroy(); }
  }, 30000);
});
