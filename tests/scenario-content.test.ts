import { describe, expect, it } from 'vitest';
import { createContentBundle, unitFor } from '../src/core/content-registry';
import { FACTIONS } from '../src/core/content';
import { exampleMod } from '../src/core/example-mod';
import { captureScenario, createScenario, restoreScenario, validateScenario } from '../src/core/scenarios';
import { ScenarioRecorder, verifyScenarioRecording } from '../src/core/scenario-recordings';
import type { ScenarioDefinition } from '../src/core/scenario-types';

function mission(): ScenarioDefinition {
  return {
    schemaVersion: 1, id: 'content-proof', title: 'Pinned army', briefing: 'Move the duelist.', successText: 'Arrived.', failureText: 'Lost.', faction: 'lantern:keepers', opponent: 'orcs', seed: 42,
    content: createContentBundle([exampleMod()]),
    map: { size: 'small', width: 36, height: 36, terrain: Array(36 * 36).fill('grass'), starts: [{ x: 5, y: 5 }, { x: 30, y: 30 }], resources: [] },
    army: [{ label: 'duelist', side: 0, kind: 'unit', role: 'melee', definitionId: 'lantern:duelist', hp: 100, x: 8, y: 8 }, { label: 'hall', side: 0, kind: 'building', role: 'barracks', definitionId: 'lantern:hall', x: 13, y: 13 }],
    objectives: [{ id: 'arrive', text: 'Reach the mark.', success: { type: 'at', actor: 'duelist', point: { x: 17, y: 8 }, radius: 1 } }], events: [],
    rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 60 },
  };
}

describe('pinned scenario actor admission', () => {
  it('spawns the same-role alternative and preserves pinned definitions in checkpoints and recordings', () => {
    const input = mission(), session = createScenario(input), duelist = session.state.entities.find(e => e.id === session.runtime.labels.duelist)!;
    expect(duelist.definitionId).toBe('lantern:duelist'); expect(duelist.hp).toBe(100); expect(duelist.maxHp).toBe(110);
    expect(unitFor(session.state, duelist).damage).toBe(24);
    const checkpoint = captureScenario(session), restored = restoreScenario(checkpoint);
    expect(captureScenario(restored)).toEqual(checkpoint); expect(session.state.content?.hash).toBe(input.content?.hash);
    const recorder = new ScenarioRecorder(session), recording = recorder.archive(); recorder.destroy();
    expect(captureScenario(verifyScenarioRecording(recording))).toEqual(checkpoint);
  });

  it('keeps implicit built-in scenario definitions free of an added content bundle', () => {
    const input = mission(); delete input.content; input.faction = 'fairies'; input.army = [{ label: 'duelist', side: 0, kind: 'unit', role: 'special', x: 8, y: 8 }];
    expect(validateScenario(input)).toEqual(input); expect(createScenario(input).state.content).toBeUndefined();
  });

  it('admits a native commander from the full built-in roster without a bundle', () => {
    const input = mission(); delete input.content; input.faction = 'dwarves'; input.army = [{ label: 'duelist', side: 0, kind: 'unit', role: 'special', definitionId: 'core:dwarves-commander', x: 8, y: 8 }];
    const session = createScenario(input), entity = session.state.entities[0];
    expect(entity.definitionId).toBe('core:dwarves-commander'); expect(unitFor(session.state, entity).ability).toBe('thane-ward');
  });

  it('admits explicit ordinary built-in IDs through the same roster check', () => {
    const input = mission(); delete input.content; input.faction = 'orcs'; input.army = [{ label: 'duelist', side: 0, kind: 'unit', role: 'melee', definitionId: FACTIONS.orcs.units.melee.id, x: 8, y: 8 }];
    expect(createScenario(input).state.entities[0].definitionId).toBe(FACTIONS.orcs.units.melee.id);
  });

  it('saves and replays authored dimensions smaller than the generated map', () => {
    const input = mission(); delete input.content; input.faction = 'orcs';
    input.map = { size: 'small', width: 16, height: 16, terrain: Array(256).fill('grass'), starts: [{ x: 3, y: 3 }, { x: 13, y: 13 }], resources: [] };
    input.army = [{ label: 'duelist', side: 0, kind: 'unit', role: 'melee', x: 8, y: 8 }];
    input.objectives[0].success = { type: 'at', actor: 'duelist', point: { x: 10, y: 8 }, radius: 1 };
    const session = createScenario(input), checkpoint = captureScenario(session);
    expect(session.state.objectives.hill).toMatchObject({ x: 8.5, y: 8.5 });
    expect(captureScenario(restoreScenario(checkpoint))).toEqual(checkpoint);
    const recorder = new ScenarioRecorder(session), recording = recorder.archive(); recorder.destroy();
    expect(captureScenario(verifyScenarioRecording(recording))).toEqual(checkpoint);
  });

  it.each([
    ['unknown', 'lantern:absent', 'melee', 0], ['wrong owner', 'lantern:duelist', 'melee', 1],
    ['wrong role', 'lantern:duelist', 'ranged', 0], ['wrong kind', 'lantern:hall', 'melee', 0],
  ] as const)('rejects %s before spawning an army', (_name, id, role, side) => {
    const input = mission(); Object.assign(input.army[0], { definitionId: id, role, side });
    expect(() => validateScenario(input)).toThrow('definition is absent');
  });

  it('checks health and building terrain against the selected definitions', () => {
    const input = mission(); input.army[0].hp = 111;
    expect(() => validateScenario(input)).toThrow('army[0].hp');
    input.army[0].hp = 100; input.map!.terrain[11 * 36 + 11] = 'rock';
    expect(() => validateScenario(input)).toThrow('army[1]');
  });

  it('rejects invalid wave definitions and altered pinned hashes before launch', () => {
    const input = mission(); input.events = [{ id: 'wave', when: { type: 'time', seconds: 1 }, actions: [{ type: 'spawn', actors: [{ label: 'bad-wave', side: 0, kind: 'unit', role: 'special', definitionId: 'core:orcs-commander', x: 20, y: 20 }] }] }];
    expect(() => validateScenario(input)).toThrow('definition is absent');
    input.events = []; input.content = structuredClone(input.content!); input.content.hash = '0'.repeat(64);
    expect(() => validateScenario(input)).toThrow('SHA-256');
  });

  it('rejects a checkpoint whose live actor was rebound to another admitted definition', () => {
    const checkpoint = captureScenario(createScenario(mission()));
    checkpoint.game.state.entities[0].definitionId = 'lantern:sentinel';
    checkpoint.game.state.entities[0].maxHp = 160;
    expect(() => restoreScenario(checkpoint)).toThrow('actor ownership or definition changed');
  });
});
