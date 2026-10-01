import { describe, expect, it } from 'vitest';
import { survivingScenarioArmy } from '../src/core/campaign';
import { checkpointConquestBattle, createConquestProfile, prepareConquestBattle } from '../src/core/conquest';
import { captureScenario, issueScenarioCommand, restoreScenario, stepScenario } from '../src/core/scenarios';
import { verifyScenarioRecording } from '../src/core/scenario-recordings';
import { saveGame } from '../src/core/saves';
import { SIMULATION_REVISION } from '../src/core/versions';

describe('synthetic equipment through conquest shared army deployment', () => {
  it('remaps owned artifact references and preserves them in SAVE4 continuation and redeployment', () => {
    // Canonical conquest maps currently have no artifact donor. This modifies
    // a disposable starting army to test the shared deployer; it is not evidence
    // of earned equipment, a canonical conquest result or a historical capture.
    const profile = createConquestProfile('orcs', 'synthetic-equipped-conquest'), soldier = profile.army.find(item => item.label === 'commander')!;
    soldier.entity.equipment = { armor: 41 };
    soldier.artifacts = [{ id: 41, definitionId: 'core:iron-aegis', owner: 0, holder: soldier.entity.id }];
    const before = JSON.stringify(profile), run = prepareConquestBattle(profile, 'quarry');
    try {
      const commander = run.session.state.entities.find(entity => entity.id === soldier.entity.id)!;
      expect(run.profile.active!.deployedIds).toContain(commander.id);
      expect(commander.equipment).toEqual({ armor: 1 });
      expect(run.session.state.specialists!.artifacts).toEqual([{ id: 1, definitionId: 'core:iron-aegis', owner: 0, holder: commander.id }]);
      expect(run.session.state.specialists!.nextArtifactId).toBe(2);
      expect(issueScenarioCommand(run.session, 0, { type: 'hold', ids: [commander.id] })).toBe(true); stepScenario(run.session);
      const checkpointed = checkpointConquestBattle(run.profile, run.session, run.recorder), active = checkpointed.active!;
      expect(active.checkpoint.game.version).toBe(4); expect(active.checkpoint.simulationRevision).toBe(SIMULATION_REVISION);
      expect(active.recording).toMatchObject({ version: 2, checksumVersion: 4, simulationRevision: SIMULATION_REVISION });
      expect(active.recording.commands).toHaveLength(1);
      expect(captureScenario(restoreScenario(active.checkpoint))).toEqual(active.checkpoint);
      expect(saveGame(verifyScenarioRecording(active.recording).state)).toEqual(saveGame(run.session.state));
      const resumed = prepareConquestBattle(checkpointed, 'quarry');
      try { expect(resumed.recorder.archive()).toEqual(active.recording); expect(captureScenario(resumed.session)).toEqual(active.checkpoint); }
      finally { resumed.recorder.destroy(); }
      const nextInput = { ...createConquestProfile('orcs', 'synthetic-equipped-next'), army: survivingScenarioArmy(run.session) }, nextBefore = JSON.stringify(nextInput);
      const next = prepareConquestBattle(nextInput, 'quarry');
      try {
        expect(next.session.runtime.labels.commander).toBe(commander.id);
        expect(next.session.state.entities.find(entity => entity.id === commander.id)!.equipment).toEqual({ armor: 1 });
        expect(next.session.state.specialists!.artifacts).toEqual([{ id: 1, definitionId: 'core:iron-aegis', owner: 0, holder: commander.id }]);
        expect(next.session.state.specialists!.nextArtifactId).toBe(2);
        expect(JSON.stringify(nextInput)).toBe(nextBefore);
      } finally { next.recorder.destroy(); }
      expect(JSON.stringify(profile)).toBe(before);
    } finally { run.recorder.destroy(); }
  });
});
