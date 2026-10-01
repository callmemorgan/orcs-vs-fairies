import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeHistoricalContentBundle, migrateHistoricalContentBundle, unitFor } from '../src/core/content-registry';
import { createDraft, draftPlayers } from '../src/core/match-rules';
import { captureScenario, createScenario, issueScenarioCommand, restoreScenario, scenarioRulesCompatibility, scenarioSessionForState, stepScenario } from '../src/core/scenarios';
import { ScenarioRecorder, decodeScenarioRecording, scenarioCheckpointChecksum, verifyScenarioRecording } from '../src/core/scenario-recordings';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import type { ScenarioDefinition } from '../src/core/scenario-types';

const historicalContent = () => JSON.parse(readFileSync(new URL('../docs/evidence/content-root-integration-20261001/browser-save.json', import.meta.url), 'utf8')).game.state.content;
function mission(): ScenarioDefinition {
  return {
    schemaVersion: 1, id: 'historical-content-wrapper', title: 'Lantern wrapper admission', briefing: 'Move the duelist.', successText: 'Arrived.', failureText: 'Lost.', faction: 'lantern:keepers', opponent: 'orcs', seed: 42,
    content: migrateHistoricalContentBundle(historicalContent()),
    map: { size: 'small', width: 36, height: 36, terrain: Array(36 * 36).fill('grass'), starts: [{ x: 5, y: 5 }, { x: 30, y: 30 }], resources: [] },
    army: [{ label: 'duelist', side: 0, kind: 'unit', role: 'melee', definitionId: 'lantern:duelist', hp: 100, x: 8, y: 8 }, { label: 'hall', side: 0, kind: 'building', role: 'barracks', definitionId: 'lantern:hall', x: 13, y: 13 }],
    objectives: [{ id: 'arrive', text: 'Reach the mark.', success: { type: 'at', actor: 'duelist', point: { x: 17, y: 8 }, radius: 1 } }], events: [],
    rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 60 },
  };
}

// The content is copied unchanged from a genuine historical capture. These
// disposable SAVE3 wrappers are explicitly synthetic, not historical gameplay.
function syntheticHistoricalWrappers() {
  const session = createScenario(mission()), current = captureScenario(session), old = decodeHistoricalContentBundle(historicalContent());
  const definition = { ...current.definition, content: structuredClone(old) };
  const checkpoint = {
    ...current, definition, simulationRevision: '3.2.0',
    game: { ...current.game, version: 3, state: { ...current.game.state, content: structuredClone(old), draft: createDraft(draftPlayers(session.state), session.state.rules, old) } },
  };
  const bound = {
    ...createSessionFile(session.state),
    game: { ...checkpoint.game, state: { ...checkpoint.game.state, scenario: { definition: structuredClone(definition), runtime: structuredClone(checkpoint.runtime), simulationRevision: '3.2.0' } } },
  };
  return { checkpoint, bound };
}

describe('historical content inside scenario wrappers', () => {
  it('migrates the definition and bound game together while retaining raw historical content and rule pins', () => {
    const { checkpoint, bound } = syntheticHistoricalWrappers(), before = JSON.stringify({ checkpoint, bound });
    const restored = restoreScenario(checkpoint), imported = decodeSessionFile(bound), boundSession = scenarioSessionForState(imported.state)!;
    expect(checkpoint.definition.content.hash).toBe('2fe954644f4b3a4d5b20e3d39b83744b9d39761869b325933446145304ba966a');
    expect(restored.definition.content).toEqual(migrateHistoricalContentBundle(historicalContent()));
    expect(restored.state.content).toEqual(restored.definition.content);
    expect(boundSession.definition.content).toEqual(restored.definition.content);
    expect(boundSession.state.content).toEqual(restored.state.content);
    expect(captureScenario(boundSession)).toEqual(captureScenario(restored));
    expect(JSON.stringify(imported.file)).toBe(JSON.stringify(bound));
    expect(JSON.stringify({ checkpoint, bound })).toBe(before);
    for (const session of [restored, boundSession]) {
      const snapshot = captureScenario(session), compatibility = scenarioRulesCompatibility(session);
      expect(compatibility.compatible).toBe(false); expect(compatibility.revision).toBe('3.2.0');
      expect(unitFor(session.state, session.state.entities[0]).damage).toBe(24);
      expect(issueScenarioCommand(session, 0, { type: 'move', ids: [session.runtime.labels.duelist], x: 17, y: 8 })).toBe(false);
      expect(() => stepScenario(session)).toThrow(compatibility.reason!);
      expect(() => new ScenarioRecorder(session)).toThrow(compatibility.reason!);
      expect(captureScenario(session)).toEqual(snapshot);
    }
  });

  it('preserves a synthetic historical journal checksum without replaying it under current rules', () => {
    const { checkpoint } = syntheticHistoricalWrappers();
    const recording = { format: 'orcs-vs-fairies-scenario-recording', version: 1, initial: checkpoint, commands: [], finalTick: checkpoint.game.state.tick, finalChecksum: scenarioCheckpointChecksum(checkpoint) };
    const before = JSON.stringify(recording), checksum = recording.finalChecksum;
    expect(JSON.stringify(decodeScenarioRecording(recording))).toBe(before);
    expect(scenarioCheckpointChecksum(recording.initial)).toBe(checksum);
    expect(() => verifyScenarioRecording(recording)).toThrow('inspection');
    expect(JSON.stringify(recording)).toBe(before);
  });

  it.each(['definition', 'game'] as const)('rejects a damaged original %s content hash before scenario migration', location => {
    const { checkpoint, bound } = syntheticHistoricalWrappers();
    if (location === 'definition') { checkpoint.definition.content.hash = '0'.repeat(64); bound.game.state.scenario.definition.content.hash = '0'.repeat(64); }
    else { checkpoint.game.state.content.hash = '0'.repeat(64); bound.game.state.content.hash = '0'.repeat(64); }
    const before = JSON.stringify({ checkpoint, bound });
    expect(() => restoreScenario(checkpoint)).toThrow(/SHA-256|historical/);
    expect(() => decodeSessionFile(bound)).toThrow(/SHA-256|historical/);
    expect(JSON.stringify({ checkpoint, bound })).toBe(before);
  });

  it('records and replays an accepted command with the migrated Lantern scenario content', () => {
    const session = createScenario(mission()), recorder = new ScenarioRecorder(session);
    try {
      expect(issueScenarioCommand(session, 0, { type: 'move', ids: [session.runtime.labels.duelist], x: 17, y: 8 })).toBe(true);
      stepScenario(session); stepScenario(session);
      const recording = recorder.archive();
      expect(recording.commands).toHaveLength(1); expect(recording.finalTick).toBe(2);
      expect(captureScenario(verifyScenarioRecording(recording))).toEqual(captureScenario(session));
      expect(recording.initial.definition.content).toEqual(session.definition.content);
    } finally { recorder.destroy(); }
  });
});
