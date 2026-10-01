import { describe, expect, it } from 'vitest';
import { campaignRulesCompatibility, checkpointCampaignMission, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, prepareCampaignMission, resetCampaignMission, verifyCanonicalCampaignVictory } from '../src/core/campaign';
import { checkpointConquestBattle, completeConquestBattle, conquestRulesCompatibility, createConquestProfile, decodeConquestProfile, prepareConquestBattle, proposeConquest, waitConquestTurn } from '../src/core/conquest';
import { scenarioCheckpointChecksum } from '../src/core/scenario-recordings';
import { solveMission } from '../scripts/scenarios/mission-strategy';

describe('current outer profiles cannot authorize historical checkpoint pins', () => {
  // These are explicitly modified current profiles. No historical fixture is
  // rewritten; raw checksums remain valid so the missing rule guard is isolated.
  it.each([undefined, '3.2.0'])('keeps a campaign checkpoint with rules %s inspection-only before writers or replay', revision => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'checkpoint-pin-campaign'));
    try {
      const profile = structuredClone(run.profile), checkpoint = profile.active!.checkpoint;
      if (revision === undefined) delete checkpoint.simulationRevision; else checkpoint.simulationRevision = revision;
      profile.active!.recording.finalChecksum = scenarioCheckpointChecksum(checkpoint);
      const before = JSON.stringify(profile), compatibility = campaignRulesCompatibility(profile);
      expect(compatibility.compatible).toBe(false); expect(compatibility.reason).toContain('inspection');
      expect(JSON.stringify(decodeCampaignProfile(profile))).toBe(before);
      for (const action of [
        () => prepareCampaignMission(profile),
        () => checkpointCampaignMission(profile, run.session, run.recorder),
        () => completeCampaignMission(profile, run.session, run.recorder.archive()),
        () => resetCampaignMission(profile),
      ]) { expect(action).toThrow(compatibility.reason!); expect(JSON.stringify(profile)).toBe(before); }
    } finally { run.recorder.destroy(); }
  });

  it.each([undefined, '3.2.0'])('checks completed campaign checkpoint rules %s before duplicates or reward claims', revision => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'checkpoint-pin-history'));
    try {
      solveMission(run.session);
      const recording = run.recorder.archive();
      const profile = structuredClone(completeCampaignMission(run.profile, run.session, recording));
      const checkpoint = profile.history[0].checkpoint;
      if (revision === undefined) delete checkpoint.simulationRevision; else checkpoint.simulationRevision = revision;
      profile.history[0].recording.finalChecksum = scenarioCheckpointChecksum(checkpoint);
      const before = JSON.stringify(profile), compatibility = campaignRulesCompatibility(profile);
      expect(compatibility.compatible).toBe(false); expect(compatibility.reason).toContain('inspection');
      expect(JSON.stringify(decodeCampaignProfile(profile))).toBe(before);
      for (const action of [
        () => prepareCampaignMission(profile),
        () => chooseCampaignBranch(profile, 'surveyor'),
        () => completeCampaignMission(profile, run.session, recording),
        () => verifyCanonicalCampaignVictory(profile, 'dwarves-4'),
      ]) { expect(action).toThrow(compatibility.reason!); expect(JSON.stringify(profile)).toBe(before); }
    } finally { run.recorder.destroy(); }
  });

  it.each([undefined, '3.2.0'])('keeps a conquest checkpoint with rules %s inspection-only before writers or replay', revision => {
    const run = prepareConquestBattle(createConquestProfile('orcs', 'checkpoint-pin-realm'), 'quarry');
    try {
      const profile = structuredClone(run.profile), checkpoint = profile.active!.checkpoint;
      if (revision === undefined) delete checkpoint.simulationRevision; else checkpoint.simulationRevision = revision;
      profile.active!.recording.finalChecksum = scenarioCheckpointChecksum(checkpoint);
      const before = JSON.stringify(profile), compatibility = conquestRulesCompatibility(profile);
      expect(compatibility.compatible).toBe(false); expect(compatibility.reason).toContain('inspection');
      expect(JSON.stringify(decodeConquestProfile(profile))).toBe(before);
      for (const action of [
        () => prepareConquestBattle(profile, 'quarry'),
        () => checkpointConquestBattle(profile, run.session, run.recorder),
        () => completeConquestBattle(profile, run.session, run.recorder.archive()),
        () => proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 25 }),
        () => waitConquestTurn(profile),
      ]) { expect(action).toThrow(compatibility.reason!); expect(JSON.stringify(profile)).toBe(before); }
    } finally { run.recorder.destroy(); }
  });
});
