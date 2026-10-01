import { describe, expect, it } from 'vitest';
import { CAMPAIGNS } from '../src/scenarios/campaigns';
import { campaignArmy, checkpointCampaignMission, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, nextCampaignMission, prepareCampaignMission, resetCampaignMission, verifyCanonicalCampaignVictory } from '../src/core/campaign';
import { captureScenario, issueScenarioCommand, stepScenario } from '../src/core/scenarios';
import { scenarioChecksum, verifyScenarioRecording } from '../src/core/scenario-recordings';
import { solveMission } from '../scripts/scenarios/mission-strategy';

describe('verified connected campaign progression', () => {
  it('rejects non-string profile IDs and inherited registry names', () => {
    expect(() => createCampaignProfile('toString', 'bad-campaign')).toThrow('Unknown campaign');
    expect(() => decodeCampaignProfile({ ...createCampaignProfile('campaign-orcs', 'typed-campaign'), id: 123 })).toThrow('Invalid campaign profile');
  });
  it('preserves the previous profile when accumulated chapter journals exceed import limits', () => {
    let profile = createCampaignProfile('campaign-dwarves', 'campaign-storage-bound');
    for (let chapter = 0; chapter < 3; chapter++) {
      if (chapter === 2) profile = chooseCampaignBranch(profile, 'surveyor');
      const run = prepareCampaignMission(profile), previous = JSON.stringify(run.profile);
      const ids = run.session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0).map(e => e.id);
      for (let command = 0; command < 30000; command++) expect(issueScenarioCommand(run.session, 0, { type: 'hold', ids })).toBe(true);
      solveMission(run.session); expect(run.session.runtime.outcome).toBe('won');
      const journal = run.recorder.archive();
      if (chapter < 2) {
        profile = completeCampaignMission(run.profile, run.session, journal);
        expect(decodeCampaignProfile(JSON.stringify(profile)).history).toHaveLength(chapter + 1);
      } else {
        expect(() => checkpointCampaignMission(run.profile, run.session, run.recorder)).toThrow('package is too large');
        expect(() => completeCampaignMission(run.profile, run.session, journal)).toThrow('package is too large');
        expect(JSON.stringify(run.profile)).toBe(previous);
        expect(decodeCampaignProfile(previous).active!.recording.commands).toHaveLength(0);
      }
      run.recorder.destroy();
    }
  }, 60000);

  for (const campaign of Object.values(CAMPAIGNS)) it(`${campaign.faction} completes four chapters with stable survivors and a persisted route`, () => {
    let profile = createCampaignProfile(campaign.id, `main-${campaign.faction}`);
    const completed: string[] = [];
    for (let chapter = 0; chapter < 4; chapter++) {
      if (chapter === 2) profile = chooseCampaignBranch(profile, campaign.choice.options[0].id);
      const oldArmy = campaignArmy(profile), run = prepareCampaignMission(profile); profile = run.profile;
      if (oldArmy.length) {
        expect(profile.active!.deployedIds.length).toBeGreaterThan(0);
        for (const id of profile.active!.deployedIds) expect(run.session.state.entities.some(e => e.id === id && e.side === 0)).toBe(true);
      }
      solveMission(run.session); expect(run.session.runtime.outcome).toBe('won');
      const journal = run.recorder.archive(); run.recorder.destroy();
      profile = completeCampaignMission(profile, run.session, journal);
      expect(completeCampaignMission(profile, run.session, journal)).toBe(profile);
      completed.push(run.session.definition.id); expect(profile.history).toHaveLength(chapter + 1);
      profile = decodeCampaignProfile(JSON.stringify(profile));
    }
    expect(completed).toEqual(campaign.chapters); expect(nextCampaignMission(profile)).toBeNull();
    expect(profile.choiceId).toBe(campaign.choice.options[0].id);
    expect(campaignArmy(profile).some(soldier => soldier.label === 'commander')).toBe(true);
    expect(verifyCanonicalCampaignVictory(profile, campaign.chapters[3])).toEqual({ campaignId: campaign.id, missionId: campaign.chapters[3], factionId: campaign.faction });
    expect(() => verifyCanonicalCampaignVictory(profile, campaign.chapters[0])).toThrow();
  }, 30000);

  it('saves a live detachment and resets to its identical initial state', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'saved-dwarves'));
    const initial = captureScenario(run.session);
    const ids = run.session.state.entities.filter(e => e.side === 0 && e.kind === 'unit').map(e => e.id);
    issueScenarioCommand(run.session, 0, { type: 'move', ids, x: 15, y: 20 }); for (let i = 0; i < 20; i++) stepScenario(run.session);
    const profile = checkpointCampaignMission(run.profile, run.session, run.recorder); run.recorder.destroy();
    const resumed = prepareCampaignMission(decodeCampaignProfile(JSON.stringify(profile)));
    expect(captureScenario(resumed.session)).toEqual(captureScenario(run.session)); resumed.recorder.destroy();
    const reset = resetCampaignMission(profile); expect(captureScenario(reset.session)).toEqual(initial); reset.recorder.destroy();
  });

  it('rejects a forged result, an out-of-order mission and altered branch state', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-orcs', 'result-check'));
    const archive = run.recorder.archive(); run.recorder.destroy();
    expect(() => completeCampaignMission(run.profile, run.session, archive)).toThrow('could not be verified');
    const forged = structuredClone(archive); forged.finalChecksum = '00000000'; expect(() => verifyScenarioRecording(forged)).toThrow('checksum diverged');
    expect(() => chooseCampaignBranch(run.profile, 'main')).toThrow('chapter two');
    const invalid = structuredClone(run.profile); invalid.active!.missionId = 'orcs-4'; expect(() => decodeCampaignProfile(invalid)).toThrow('Invalid campaign battle');
  });

  it('rejects a checkpoint and journal that agree on an altered initial detachment', () => {
    const run = prepareCampaignMission(createCampaignProfile('campaign-dwarves', 'altered-army')); run.recorder.destroy();
    const commander = run.session.state.entities.find(e => e.id === run.session.runtime.labels.commander)!; commander.hp--;
    const altered = structuredClone(run.profile);
    altered.active!.checkpoint = captureScenario(run.session);
    altered.active!.recording.initial = captureScenario(run.session);
    altered.active!.recording.finalChecksum = scenarioChecksum(run.session);
    expect(() => decodeCampaignProfile(altered)).toThrow('altered detachment');
    expect(() => verifyCanonicalCampaignVictory(run.profile, 'dwarves-4')).toThrow();
  });
});
