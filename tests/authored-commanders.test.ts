import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { unitFor } from '../src/core/content-registry';
import { captureScenario, createScenario, issueScenarioCommand, restoreScenario, scenarioCondition, stepScenario, validateScenario } from '../src/core/scenarios';
import type { ScenarioCondition, ScenarioSession } from '../src/core/scenario-types';
import { observedArtifacts } from '../src/core/unit-progression';
import type { Entity, Vec } from '../src/core/types';
import { SCENARIOS } from '../src/scenarios/campaigns';

const actor = (session: ScenarioSession, label: string): Entity => {
  const entity = session.state.entities.find(e => e.id === session.runtime.labels[label]);
  expect(entity, `Missing authored actor ${label}`).toBeDefined();
  return entity!;
};

function variableGate(session: ScenarioSession, key: string): ScenarioCondition {
  function find(condition: ScenarioCondition): ScenarioCondition | undefined {
    if (condition.type === 'variable' && condition.key === key) return condition;
    if (condition.type === 'all' || condition.type === 'any') {
      for (const child of condition.conditions) { const match = find(child); if (match) return match; }
    }
    return condition.type === 'not' ? find(condition.condition) : undefined;
  }
  const condition = session.definition.objectives.map(o => find(o.success)).find(Boolean);
  expect(condition, `Missing authored victory gate ${key}`).toBeDefined();
  return condition!;
}

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
function advanceUntil(session: ScenarioSession, condition: () => boolean, description: string, ticks = 600): void {
  for (let tick = 0; tick < ticks && !condition() && session.runtime.outcome === 'playing'; tick++) stepScenario(session);
  expect(condition(), description).toBe(true);
  expect(session.runtime.outcome).toBe('playing');
}

function moveNear(session: ScenarioSession, entity: Entity, point: Vec, radius = 1.5): void {
  expect(issueScenarioCommand(session, 0, { type: 'move', ids: [entity.id], x: point.x, y: point.y })).toBe(true);
  advanceUntil(session, () => distance(entity, point) <= radius, `Actor ${entity.id} reaches (${point.x}, ${point.y})`);
}

describe('authored commanders and their ordinary lesson casters', () => {
  it('admits thirty authored missions', () => {
    expect(Object.keys(SCENARIOS)).toHaveLength(30);
  });

  it.each(Object.values(SCENARIOS).map(definition => [definition.id, definition] as const))('%s spawns its protected actor as its faction commander', (_id, definition) => {
    const admitted = validateScenario(definition), session = createScenario(admitted), commander = actor(session, 'commander');
    const actual = unitFor(session.state, commander);
    expect(commander.kind).toBe('unit'); expect(commander.side).toBe(0); expect(commander.role).toBe('special');
    expect(actual.id).toBe(`core:${definition.faction}-commander`);
    expect(actual.tags).toContain('hero'); expect(commander.maxHp).toBe(actual.hp);
    expect(session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && unitFor(session.state, e).tags?.includes('hero'))).toEqual([commander]);
  });

  it.each([
    ['fairies-1', 'weaver', 'illusion'], ['fairies-3', 'weaver', 'illusion'],
    ['fairies-3-alt', 'weaver', 'illusion'], ['fairies-4', 'weaver', 'illusion'],
    ['dwarves-1', 'cannon', 'entrench'], ['dwarves-2', 'cannon', 'entrench'],
    ['dwarves-3', 'cannon', 'entrench'], ['dwarves-4', 'cannon-a', 'entrench'], ['dwarves-4', 'cannon-b', 'entrench'],
    ['undead-1', 'gravecaller', 'raise'], ['undead-3', 'gravecaller', 'raise'],
    ['undead-3-alt', 'gravecaller', 'raise'], ['undead-4', 'gravecaller', 'raise'],
    ['tideborn-3-alt', 'tidecaller', 'surge'], ['tideborn-4', 'tidecaller', 'surge'],
    ['automata-4', 'ward-engine', 'ward'],
  ] as const)('%s retains %s as an ordinary caster of %s', (id, label, ability) => {
    const session = createScenario(SCENARIOS[id]), caster = actor(session, label), definition = unitFor(session.state, caster);
    expect(caster.id).not.toBe(session.runtime.labels.commander);
    expect(definition.id).toBe(FACTIONS[session.definition.faction].units.special.id);
    expect(definition.role).toBe('special'); expect(definition.ability).toBe(ability);
    expect(definition.tags ?? []).not.toContain('hero');
  });

  it.each([
    ['orcs-4', 'momentum'], ['fairies-4', 'illusion'], ['dwarves-4', 'entrench'],
    ['undead-4', 'raise'], ['tideborn-4', 'surge'], ['automata-4', 'ward'],
  ] as const)('%s requires its taught %s mechanic rather than any hero ability', (id, ability) => {
    const session = createScenario(SCENARIOS[id]);
    expect(session.definition.requiredActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'ability', ability, count: 1 }),
    ]));
    expect(unitFor(session.state, actor(session, 'commander')).ability).not.toBe(ability);
  });

  it('does not credit Queen Step as the Veil Doubles needed at the stockade', () => {
    const session = createScenario(SCENARIOS['fairies-3-alt']), commander = actor(session, 'commander'), weaver = actor(session, 'weaver');
    const gate = variableGate(session, 'action.ability.illusion');
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [commander.id], x: commander.x, y: commander.y })).toBe(true);
    expect(session.runtime.commandCounts.ability).toBeGreaterThan(0);
    expect(scenarioCondition(session, gate)).toBe(false);
    expect(session.state.entities.some(e => e.illusion)).toBe(false);
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [weaver.id] })).toBe(true);
    expect(session.state.entities.filter(e => e.side === 0 && e.illusion)).toHaveLength(2);
    expect(scenarioCondition(session, gate)).toBe(true);
  });

  it('does not credit Thane Ward as the cannon emplacement needed at the quarry', () => {
    const session = createScenario(SCENARIOS['dwarves-1']), commander = actor(session, 'commander'), cannon = actor(session, 'cannon');
    const gate = variableGate(session, 'action.ability.entrench');
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [commander.id], target: commander.id })).toBe(true);
    expect(session.runtime.commandCounts.ability).toBeGreaterThan(0);
    expect(scenarioCondition(session, gate)).toBe(false); expect(cannon.entrenchedAt).toBeUndefined();
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [cannon.id] })).toBe(true);
    expect(cannon.entrenchedAt).toBe(session.state.time); expect(scenarioCondition(session, gate)).toBe(true);
  });

  it('requires a consumed corpse and real raised soldier after Mara casts Soul Drain', () => {
    const session = createScenario(SCENARIOS['undead-3-alt']), commander = actor(session, 'commander'), gravecaller = actor(session, 'gravecaller'), guard = actor(session, 'wounded-a');
    const gate = variableGate(session, 'action.ability.raise');
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [commander.id], target: guard.id })).toBe(true);
    expect(guard.hp).toBe(0); expect(session.state.corpses.some(c => c.id === guard.id)).toBe(true);
    expect(session.runtime.commandCounts.ability).toBeGreaterThan(0);
    expect(scenarioCondition(session, gate)).toBe(false);
    expect(session.state.entities.some(e => e.side === 0 && e.raised)).toBe(false);
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [gravecaller.id] })).toBe(true);
    expect(session.state.corpses.some(c => c.id === guard.id)).toBe(false);
    expect(session.state.entities.some(e => e.side === 0 && e.raised && e.hp > 0)).toBe(true);
    expect(scenarioCondition(session, gate)).toBe(true);
    const restored = restoreScenario(captureScenario(session));
    expect(scenarioCondition(restored, variableGate(restored, 'action.ability.raise'))).toBe(true);
  });

  it('credits quarry equipment only after Bryn equips an artifact dropped by the wounded enemy commander', () => {
    const session = createScenario(SCENARIOS['dwarves-1']), commander = actor(session, 'commander'), cannon = actor(session, 'cannon'), raider = actor(session, 'raider');
    const gate = variableGate(session, 'equipment.commander');
    expect(unitFor(session.state, raider).id).toBe('core:orcs-commander'); expect(raider.hp).toBe(100);
    expect(scenarioCondition(session, gate)).toBe(false);

    moveNear(session, cannon, { x: 19, y: 18 }, .8);
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [cannon.id] })).toBe(true);
    expect(issueScenarioCommand(session, 0, { type: 'attack', ids: [cannon.id], target: raider.id })).toBe(true);
    advanceUntil(session, () => raider.hp <= 0, 'Cannon kills the wounded hostile commander');
    const drop = observedArtifacts(session.state, 0).find(item => item.position && distance(item.position, raider) < .1);
    expect(drop).toBeDefined(); expect(drop!.holder).toBeUndefined();

    moveNear(session, cannon, drop!.position!);
    expect(issueScenarioCommand(session, 0, { type: 'recoverArtifact', id: cannon.id, artifact: drop!.id })).toBe(true);
    expect(issueScenarioCommand(session, 0, { type: 'equipArtifact', id: cannon.id, artifact: drop!.id })).toBe(true);
    stepScenario(session);
    expect(Object.values(cannon.equipment ?? {})).toContain(drop!.id);
    expect(scenarioCondition(session, gate)).toBe(false);

    expect(issueScenarioCommand(session, 0, { type: 'dropArtifact', id: cannon.id, artifact: drop!.id })).toBe(true);
    const released = observedArtifacts(session.state, 0).find(item => item.id === drop!.id)!;
    expect(released.position).toBeDefined();
    moveNear(session, commander, released.position!);
    expect(issueScenarioCommand(session, 0, { type: 'recoverArtifact', id: commander.id, artifact: drop!.id })).toBe(true);
    stepScenario(session);
    expect(observedArtifacts(session.state, 0).find(item => item.id === drop!.id)?.holder).toBe(commander.id);
    expect(Object.values(commander.equipment ?? {})).not.toContain(drop!.id);
    expect(scenarioCondition(session, gate)).toBe(false);

    expect(issueScenarioCommand(session, 0, { type: 'equipArtifact', id: commander.id, artifact: drop!.id })).toBe(true);
    stepScenario(session);
    expect(Object.values(commander.equipment ?? {})).toContain(drop!.id);
    expect(scenarioCondition(session, gate)).toBe(true);
    const restored = restoreScenario(captureScenario(session));
    expect(scenarioCondition(restored, variableGate(restored, 'equipment.commander'))).toBe(true);
    expect(session.runtime.outcome).toBe('playing'); expect(actor(session, 'target-tower').hp).toBeGreaterThan(0);
    expect(issueScenarioCommand(session, 0, { type: 'dropArtifact', id: commander.id, artifact: drop!.id })).toBe(true);
    stepScenario(session); expect(scenarioCondition(session, gate)).toBe(false);
  });
});
