import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { campaignArmy, campaignRulesCompatibility, decodeCampaignProfile, prepareCampaignMission, type CampaignProfile } from '../src/core/campaign';
import { decodeScenarioRecording, ScenarioRecorder, scenarioCheckpointChecksum, scenarioRecordingRulesCompatibility } from '../src/core/scenario-recordings';
import { afterScenarioStep, captureScenario, evaluateScenario, issueScenarioCommand, resetScenario, restoreScenario, scenarioRulesCompatibility, scenarioSessionForState, stepScenario } from '../src/core/scenarios';
import type { ScenarioCheckpoint, ScenarioSession } from '../src/core/scenario-types';
import { loadGame, saveGame, SAVE_VERSION, type OriginalSaveEnvelope } from '../src/core/saves';
import { decodeSessionFile } from '../src/core/session-storage';
import { issueCommand, stepGame } from '../src/core/simulation';
import { SIMULATION_REVISION } from '../src/core/versions';

const fixtureUrl = (name: string) => new URL(`./fixtures/scenario-save3-persistent-army/${name}.json`, import.meta.url);
const fixture = <T>(name: string): T => JSON.parse(readFileSync(fixtureUrl(name), 'utf8'));
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function expectInspectionOnly(session: ScenarioSession): void {
  const before = captureScenario(session), command = { type: 'hold' as const, ids: [session.runtime.labels.commander] };
  expect(scenarioRulesCompatibility(session).compatible).toBe(false);
  for (const action of [
    () => expect(issueScenarioCommand(session, 0, command)).toBe(false),
    () => expect(issueCommand(session.state, 0, command)).toBe(false),
    () => expect(() => stepScenario(session)).toThrow('inspection'),
    () => expect(() => stepGame(session.state, .05)).toThrow('inspection'),
    () => expect(() => afterScenarioStep(session, .05)).toThrow('inspection'),
    () => expect(() => evaluateScenario(session)).toThrow('inspection'),
    () => expect(() => resetScenario(session)).toThrow('inspection'),
    () => expect(() => new ScenarioRecorder(session)).toThrow('inspection'),
  ]) {
    action(); expect(captureScenario(session)).toEqual(before);
  }
}

describe('SAVE4 migration of genuine equipped scenario wrappers', () => {
  it('retains every archived fixture byte declared by its provenance', () => {
    const provenance = fixture<{ sourceCommit: string; artifacts: Record<string, { bytes: number; sha256: string }> }>('provenance');
    expect(provenance.sourceCommit).toBe('e32f1bd7e9667123069e1cd4605834f459fd2bb7');
    expect(Object.keys(provenance.artifacts)).toHaveLength(13);
    for (const [name, expected] of Object.entries(provenance.artifacts)) {
      const bytes = readFileSync(new URL(`./fixtures/scenario-save3-persistent-army/${name}`, import.meta.url));
      expect(bytes.length, name).toBe(expected.bytes); expect(sha256(bytes), name).toBe(expected.sha256);
    }
  });

  it('migrates an equipped checkpoint while preserving its original raw game, rules pin and veteran values', () => {
    const raw = fixture<ScenarioCheckpoint>('chapter1-equipped-checkpoint'), before = JSON.stringify(raw);
    const session = restoreScenario(raw), migrated = captureScenario(session);
    expect(SAVE_VERSION).toBe(4); expect(SIMULATION_REVISION).toBe('4.0.1');
    expect(raw.game.version).toBe(3); expect(raw.simulationRevision).toBe('3.2.0');
    expect(migrated.game.version).toBe(4); expect(migrated.simulationRevision).toBe('3.2.0');
    expect(session.state.scenario?.simulationRevision).toBe('3.2.0');
    expect(session.runtime).toEqual(raw.runtime); expect(session.definition).toEqual(raw.definition);
    for (const original of raw.game.state.entities) {
      const entity = session.state.entities.find(value => value.id === original.id)!;
      expect(entity.veteran, `veteran ${original.id}`).toEqual(original.veteran);
      expect(entity.equipment, `equipment ${original.id}`).toEqual(original.equipment);
      expect(entity.hp, `hp ${original.id}`).toBe(original.hp);
    }
    expect(session.state.specialists).toEqual(raw.game.state.specialists);
    const commander = session.state.entities.find(entity => entity.id === 1)!;
    expect(commander.equipment).toEqual({ armor: 1 });
    expect(session.state.specialists?.artifacts).toContainEqual({ id: 1, definitionId: 'core:iron-aegis', owner: 0, holder: 1 });
    expectInspectionOnly(session); expect(JSON.stringify(raw)).toBe(before);
  });

  it('preserves a bound SAVE3 session source while its migrated SAVE4 game matches the same checkpoint', () => {
    const raw = fixture<OriginalSaveEnvelope>('artifact-allocation-generic-save'), checkpoint = fixture<ScenarioCheckpoint>('artifact-allocation-saved-checkpoint');
    const before = JSON.stringify(raw), checkpointBefore = JSON.stringify(checkpoint);
    // This session envelope assembles a genuine archived game; it is not a recapture.
    const source = { format: 'orcs-vs-fairies/session', version: 1, game: raw };
    const decoded = decodeSessionFile(source), checkpointSession = restoreScenario(checkpoint);
    expect(decoded.file.game.version).toBe(3); expect(JSON.stringify(decoded.file.game)).toBe(before);
    expect(decoded.file.game).toEqual(raw);
    const saved = saveGame(decoded.state), withoutBinding = structuredClone(saved);
    delete withoutBinding.state.scenario;
    expect(saved.version).toBe(4); expect(withoutBinding).toEqual(captureScenario(checkpointSession).game);
    expect(saved.state.scenario).toEqual({ definition: checkpointSession.definition, runtime: checkpointSession.runtime, simulationRevision: '3.2.0' });
    expect(decoded.state.tick).toBe(75); expect(decoded.state.scenario?.simulationRevision).toBe('3.2.0');
    const commander = decoded.state.entities.find(entity => entity.id === 1)!;
    expect(commander.equipment).toEqual({ armor: 2 });
    expect(decoded.state.specialists).toMatchObject({ nextArtifactId: 3, artifacts: [
      { id: 1, definitionId: 'core:ember-blade', position: { x: 9, y: 6 } },
      { id: 2, definitionId: 'core:iron-aegis', owner: 0, holder: 1 },
    ] });
    const originalCommander = raw.state.entities.find(entity => entity.id === 1)!;
    expect(commander.veteran).toEqual(originalCommander.veteran);
    expect(decodeSessionFile(JSON.stringify(decoded.file)).file).toEqual(decoded.file);
    expectInspectionOnly(scenarioSessionForState(decoded.state)!);
    expectInspectionOnly(checkpointSession);
    expect(JSON.stringify(raw)).toBe(before); expect(JSON.stringify(checkpoint)).toBe(checkpointBefore);
  });

  it('preserves the allocator checkpoint checksum and the original journal continuation prefix', () => {
    const checkpoint = fixture<ScenarioCheckpoint>('artifact-allocation-saved-checkpoint');
    const postdeployment = decodeScenarioRecording(fixture('artifact-allocation-postdeployment-recording'));
    const continuation = decodeScenarioRecording(fixture('artifact-allocation-continuation-recording'));
    expect(scenarioCheckpointChecksum(checkpoint)).toBe('fc38416c'); expect(postdeployment.finalChecksum).toBe('fc38416c');
    expect(postdeployment.finalTick).toBe(75); expect(continuation.finalTick).toBe(95);
    expect(continuation.initial).toEqual(postdeployment.initial);
    expect(continuation.commands.slice(0, postdeployment.commands.length)).toEqual(postdeployment.commands);
    expect(continuation.commands).toHaveLength(postdeployment.commands.length + 1);
    for (const recording of [postdeployment, continuation]) {
      expect(recording).toMatchObject({ version: 2, simulationRevision: '3.2.0', checksumVersion: 3 });
      expect(scenarioRecordingRulesCompatibility(recording).compatible).toBe(false);
    }
  });

  it.each(['chapter1-equipped-active-profile', 'chapter1-completed-profile', 'chapter2-casualty-active-profile', 'chapter3-reserves-active-profile'])('preserves raw SAVE3 checkpoints and journals inside %s', name => {
    const raw = fixture<CampaignProfile>(name), before = JSON.stringify(raw), decoded = decodeCampaignProfile(raw);
    expect(JSON.stringify(decoded)).toBe(before); expect(decoded.simulationRevision).toBe('3.2.0');
    const battles = [...decoded.history, ...(decoded.active ? [decoded.active] : [])];
    for (const battle of battles) {
      expect(battle.checkpoint.game.version).toBe(3); expect(battle.checkpoint.simulationRevision).toBe('3.2.0');
      expect(battle.recording).toMatchObject({ version: 2, simulationRevision: '3.2.0', checksumVersion: 3 });
      expect(battle.recording.initial.game.version).toBe(3); expect(battle.recording.initial.simulationRevision).toBe('3.2.0');
      expect(scenarioCheckpointChecksum(battle.checkpoint)).toBe(battle.recording.finalChecksum);
    }
    expect(campaignRulesCompatibility(decoded).compatible).toBe(false);
    expect(() => prepareCampaignMission(decoded)).toThrow('rules 3.2.0');
    if (decoded.history.length) {
      const army = campaignArmy(decoded), commander = army.find(soldier => soldier.entity.id === 1)!, cannon = army.find(soldier => soldier.entity.id === 2)!;
      expect(commander.entity.equipment).toEqual({ armor: 1 });
      expect(commander.artifacts).toEqual([{ id: 1, definitionId: 'core:iron-aegis', owner: 0, holder: 1 }]);
      expect(cannon.entity.veteran).toMatchObject({ rank: 3, promotions: [{ rank: 1, id: 'bulwark' }, { rank: 2, id: 'bulwark' }, { rank: 3, id: 'bulwark' }] });
      if (name === 'chapter3-reserves-active-profile') {
        expect(decoded.active!.deployedIds).toEqual([1, 16]);
        expect(army.filter(soldier => !decoded.active!.deployedIds.includes(soldier.entity.id)).map(soldier => soldier.entity.id)).toEqual([2, 5, 12, 21]);
        expect(army.some(soldier => soldier.entity.id === 4)).toBe(false);
      }
    }
    expect(JSON.stringify(decoded)).toBe(before); expect(JSON.stringify(raw)).toBe(before);
  });

  it.each([undefined, '1.0.0'])('retains an explicitly modified generic binding pin of %s through migration without enabling execution', revision => {
    const raw = fixture<OriginalSaveEnvelope>('artifact-allocation-generic-save');
    const binding = raw.state.scenario as { simulationRevision?: string };
    if (revision === undefined) delete binding.simulationRevision; else binding.simulationRevision = revision;
    const before = JSON.stringify(raw), state = loadGame(raw);
    expect(saveGame(state).version).toBe(4); expect(state.scenario?.simulationRevision).toBe(revision);
    expectInspectionOnly(scenarioSessionForState(state)!); expect(JSON.stringify(raw)).toBe(before);
  });
});
