import { describe, expect, it } from 'vitest';
import { createScenario, issueScenarioCommand, stepScenario, validateScenario } from '../src/core/scenarios';
import { SCENARIOS } from '../src/scenarios/campaigns';
import { ABILITIES, FACTIONS } from '../src/core/content';

describe('declared scenario abilities', () => {
  it('requires the mechanic caster instead of crediting the native commander', () => {
    const input = structuredClone(SCENARIOS['dwarves-1']);
    Object.assign(input.army.find(a => a.label === 'commander')!, { role: 'special', definitionId: 'core:dwarves-commander' });
    input.objectives = [{ id: 'lesson', text: 'Emplace the cannon.', success: { type: 'time', seconds: 0 } }];
    input.requiredActions = [{ action: 'ability', ability: 'entrench', count: 1, text: 'Emplace the cannon.' }];
    const session = createScenario(input), hero = session.runtime.labels.commander;
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [hero], target: hero })).toBe(true);
    expect(session.runtime.commandCounts['ability.thane-ward']).toBe(1);
    expect(session.runtime.variables['action.ability.thane-ward']).toBe(1);
    expect(session.runtime.commandCounts['ability.entrench']).toBeUndefined(); expect(session.runtime.outcome).toBe('playing');
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [session.runtime.labels.cannon] })).toBe(true);
    stepScenario(session);
    expect(session.runtime.commandCounts['ability.entrench']).toBe(1); expect(session.runtime.outcome).toBe('won');
  });

  it('counts prepared siege ability once and excludes the automatic launch and impact', () => {
    const input = structuredClone(SCENARIOS['orcs-3']);
    input.army = [{ label: 'commander', side: 0, kind: 'unit', role: 'siege', definitionId: FACTIONS.orcs.units.siege.id, x: 8, y: 8 }, { label: 'target', side: 1, kind: 'unit', role: 'melee', x: 13, y: 8, order: { type: 'hold' } }];
    input.events = []; input.objectives = [{ id: 'wait', text: 'Wait.', success: { type: 'time', seconds: 100 } }];
    input.rules.resources.wood = 100;
    const session = createScenario(input);
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: [session.runtime.labels.commander] })).toBe(true);
    expect(issueScenarioCommand(session, 0, { type: 'attack', ids: [session.runtime.labels.commander], target: session.runtime.labels.target })).toBe(true);
    const texts: string[] = [];
    for (let tick = 0; tick < 50; tick++) { stepScenario(session); texts.push(...session.state.events.filter(e => e.type === 'ability' && e.text !== undefined).map(e => e.text!)); }
    expect(texts).toContain('Specialist siege shot launched.'); expect(texts).toContain('incendiary impact.');
    expect(session.runtime.commandCounts.ability).toBe(1); expect(session.runtime.commandCounts['ability.incendiary-shell']).toBe(1);
  });

  it('rejects unknown abilities and ability pins on another action', () => {
    const input = structuredClone(SCENARIOS['dwarves-1']);
    input.requiredActions = [{ action: 'hold', ability: 'entrench', count: 1, text: 'Hold.' }];
    expect(() => validateScenario(input)).toThrow('only ability');
    const raw = { ...input, requiredActions: [{ action: 'ability', ability: 'invented', count: 1, text: 'Cast.' }] };
    expect(() => validateScenario(raw)).toThrow('unknown value');
    expect(ABILITIES.entrench).toBeDefined();
  });
});
