import { describe, expect, it } from 'vitest';
import { buildingFor, createContentBundle, unitFor } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { captureRuntime, createMatch, issueCommand, runAI, spawnDefinition, stepGame } from '../src/core/simulation';
import { loadGame, saveGame } from '../src/core/saves';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';

describe('allied AI with the canonical mode admission', () => {
  it('recruits the exact custom definition selected by a draft when its default is unavailable', () => {
    const state = createMatch({ content: createContentBundle([exampleMod()]), map: { seed: 4127, size: 'small' },
      players: [{ id: 0, teamId: 0, factionId: 'lantern:keepers', controller: 'external' }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }],
      rules: { startingResources: { wood: 1000, ore: 1000, crystal: 500 }, draft: { enabled: true, banRounds: 0, pickRounds: 1 } } });
    expect(issueCommand(state, 0, { type: 'draftChoice', definitionId: 'lantern:duelist' })).toBe(true);
    expect(issueCommand(state, 1, { type: 'draftChoice', definitionId: 'orc-melee' })).toBe(true);
    const hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!;
    const factory = spawnDefinition(state, 0, 'building', buildingFor(state, 0, 'barracks').id, hq.x + 6, hq.y + 5);
    runAI(state, 0);
    expect(factory.queue).toEqual(['melee']);
    expect(factory.queueDefinitionIds).toEqual(['lantern:duelist']);
    expect(factory.queuePaidCosts).toEqual([unitFor(state, 0, 'melee', 'lantern:duelist').cost]);
    expect(saveGame(loadGame(saveGame(state)))).toEqual(saveGame(state));
  });

  it('keeps allied hill orders on the objective and reproduces their authoritative step', () => {
    const state = createMatch({ map: { seed: 4127, size: 'small' }, players: [
      { id: 0, teamId: 0, factionId: 'orcs', controller: 'ai' }, { id: 1, teamId: 0, factionId: 'fairies', controller: 'ai' },
      { id: 2, teamId: 1, factionId: 'dwarves', controller: 'external' }], rules: { mode: 'hill' } });
    const recorder = new MatchRecorder(state);
    stepGame(state, .05);
    const hill = state.objectives.hill;
    for (const side of [0, 1]) {
      const starter = state.entities.find(e => e.side === side && e.kind === 'unit' && e.role === 'melee')!;
      expect(starter.order.type).toBe('attackMove');
      if (starter.order.type !== 'attackMove') throw new Error('Objective order missing');
      expect(Math.hypot(starter.order.x - hill.x, starter.order.y - hill.y)).toBeLessThan(1.5);
    }
    expect(captureRuntime(state).teamAI?.coordinator.waves ?? []).toEqual([]);
    const player = new ReplayPlayer(recorder.export()); while (!player.finished) player.advance(20);
    expect(saveGame(player.state)).toEqual(saveGame(state)); player.dispose(); recorder.dispose();
  });
});
