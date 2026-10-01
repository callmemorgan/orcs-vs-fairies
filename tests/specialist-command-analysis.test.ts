import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { entityDefinition } from '../src/core/content-registry';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import type { ArmySample } from '../src/core/replays';
import type { Command, Entity, GameState } from '../src/core/types';

type CommanderFaction = 'undead' | 'tideborn';
function fixture(faction: CommanderFaction) {
  const state = createMatch({
    map: { seed: 4127, size: 'small' }, rules: { startingAge: 3 },
    players: [{ id: 0, teamId: 0, factionId: faction, controller: 'external' }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }],
  });
  state.terrain.fill('grass'); state.resources = []; state.entities = state.entities.filter(e => e.role === 'hq');
  for (const e of state.entities) { e.x = e.side === 0 ? 6.5 : state.width - 6.5; e.y = e.side === 0 ? 6.5 : state.height - 6.5; }
  const point = { x: Math.floor(state.width / 2) + .5, y: Math.floor(state.height / 2) + .5 };
  const commander = spawnDefinition(state, 0, 'unit', `core:${faction}-commander`, point.x, point.y);
  const victims = Array.from({ length: faction === 'undead' ? 1 : 2 }, (_, i) => {
    const e = spawnDefinition(state, 1, 'unit', FACTIONS.orcs.units.worker.id, point.x + 2 + i, point.y);
    e.hp = 20; e.carried = 8 + i; e.order = { type: 'hold' }; return e;
  });
  const cost = victims.reduce((total, e) => { const c = entityDefinition(state, e).cost; return total + c.wood + c.ore + c.crystal + e.carried; }, 0);
  refreshVisibility(state);
  const ability: Command = faction === 'undead' ? { type: 'ability', ids: [commander.id], target: victims[0].id } : { type: 'ability', ids: [commander.id], x: victims[0].x, y: victims[0].y };
  return { state, commander, victims, ability, cost };
}
function victimSample(recorder: MatchRecorder | ReplayPlayer): ArmySample { return recorder.analysis.at(-1)!.players[1]; }
function expectLosses(recorder: MatchRecorder | ReplayPlayer, units: number, value: number): void {
  expect(victimSample(recorder)).toMatchObject({ losses: units, buildingLosses: 0, lostValue: value, gathered: 0 });
}
function acceptedOrders(state: GameState, commander: Entity): void {
  for (const type of ['hold', 'stop', 'hold'] as const) expect(issueCommand(state, 0, { type, ids: [commander.id] })).toBe(true);
}
function assertLethal(state: GameState, victims: Entity[]): void {
  expect(victims.every(e => e.hp === 0 && e.animation === 'death')).toBe(true);
  expect(state.events.filter(e => e.type === 'death').map(e => e.source).sort((a, b) => a! - b!)).toEqual(victims.map(e => e.id));
}

describe('analysis of specialist command deaths', () => {
  it.each(['undead', 'tideborn'] as const)('%s records lethal command losses once before stepping, through resumed history and replay seek', faction => {
    const { state, commander, victims, ability, cost } = fixture(faction), recorder = new MatchRecorder(state);
    expectLosses(recorder, 0, 0);
    expect(issueCommand(state, 0, ability)).toBe(true); assertLethal(state, victims);
    const deaths = state.events.filter(e => e.type === 'death');
    expectLosses(recorder, victims.length, cost);
    acceptedOrders(state, commander);
    expect(state.tick).toBe(0); expect(state.events.filter(e => e.type === 'death')).toEqual(deaths);
    expectLosses(recorder, victims.length, cost);
    expect(issueCommand(state, 0, ability)).toBe(false); expectLosses(recorder, victims.length, cost);

    const checkpoint = saveGame(state), history = recorder.export(); recorder.dispose();
    expect(history.actions.filter(action => action.type === 'command')).toHaveLength(4);
    const restored = loadGame(JSON.stringify(checkpoint)), resumed = new MatchRecorder(restored, JSON.parse(JSON.stringify(history)));
    expectLosses(resumed, victims.length, cost);
    expect(issueCommand(state, 0, { type: 'hold', ids: [commander.id] })).toBe(true);
    expect(issueCommand(restored, 0, { type: 'hold', ids: [commander.id] })).toBe(true);
    expectLosses(resumed, victims.length, cost);
    for (let i = 0; i < 32; i++) {
      stepGame(state, .25); stepGame(restored, .25);
      expect(saveGame(restored)).toEqual(saveGame(state)); expectLosses(resumed, victims.length, cost);
    }
    const archive = resumed.export(), replay = new ReplayPlayer(JSON.stringify(archive));
    expect(replay.state.tick).toBe(0); expectLosses(replay, victims.length, cost);
    replay.advance(32); expect(replay.finished).toBe(true); expect(saveGame(replay.state)).toEqual(saveGame(restored)); expectLosses(replay, victims.length, cost);
    replay.seek(1); expect(replay.state.tick).toBe(1); expectLosses(replay, victims.length, cost);
    replay.seek(32); expect(saveGame(replay.state)).toEqual(saveGame(restored)); expectLosses(replay, victims.length, cost);
    resumed.dispose(); replay.dispose();
  });

  it.each(['undead', 'tideborn'] as const)('%s starts fresh analysis after a lethal command without recounting initial events', faction => {
    const { state, commander, victims, ability } = fixture(faction);
    expect(issueCommand(state, 0, ability)).toBe(true); assertLethal(state, victims);
    const recorder = new MatchRecorder(state); expectLosses(recorder, 0, 0);
    acceptedOrders(state, commander); expectLosses(recorder, 0, 0);
    const history = recorder.export(), restored = loadGame(saveGame(state)); recorder.dispose();
    const resumed = new MatchRecorder(restored, history); expectLosses(resumed, 0, 0);
    expect(issueCommand(restored, 0, { type: 'hold', ids: [commander.id] })).toBe(true); expectLosses(resumed, 0, 0);
    for (let i = 0; i < 8; i++) stepGame(restored, .25);
    expectLosses(resumed, 0, 0);
    const replay = new ReplayPlayer(resumed.export()); expectLosses(replay, 0, 0);
    replay.advance(8); expect(saveGame(replay.state)).toEqual(saveGame(restored)); expectLosses(replay, 0, 0);
    replay.seek(0); expectLosses(replay, 0, 0); replay.seek(8); expectLosses(replay, 0, 0);
    resumed.dispose(); replay.dispose();
  });

  it('exports a completed command-only replay with losses before any timestep exists', () => {
    const { state, commander, victims, ability, cost } = fixture('tideborn'), recorder = new MatchRecorder(state);
    expect(issueCommand(state, 0, ability)).toBe(true); assertLethal(state, victims); acceptedOrders(state, commander);
    const archive = recorder.export(); expect(archive.finalTick).toBe(0); expect(archive.actions.every(action => action.type === 'command')).toBe(true);
    expect(archive.analysis.at(-1)!.players[1]).toMatchObject({ losses: 2, lostValue: cost });
    const replay = new ReplayPlayer(JSON.stringify(archive)); expect(replay.finished).toBe(true); expect(saveGame(replay.state)).toEqual(saveGame(state)); expectLosses(replay, 2, cost);
    replay.seek(0); expectLosses(replay, 2, cost); recorder.dispose(); replay.dispose();
  });
  it('counts a new death event for an authored survivor whose ID occurs in initial historical deaths', () => {
    const setup = fixture('undead');
    expect(issueCommand(setup.state, 0, setup.ability)).toBe(true); assertLethal(setup.state, setup.victims);
    // This authored starting state has an earlier death in its history and a living survivor with the same ID.
    // Every health/animation adjustment is before recording; the new death must come from the normal ability command.
    setup.victims[0].hp = 20; setup.victims[0].animation = 'idle'; setup.victims[0].animTime = 0; setup.commander.abilityReadyAt = 0;
    const state = loadGame(saveGame(setup.state)), survivor = state.entities.find(e => e.id === setup.victims[0].id)!;
    const earlier = state.events.find(e => e.type === 'death' && e.source === survivor.id)!;
    expect(earlier).toBeDefined(); expect(survivor.hp).toBeGreaterThan(0);
    const recorder = new MatchRecorder(state); expectLosses(recorder, 0, 0);
    expect(issueCommand(state, 0, setup.ability)).toBe(true); expect(survivor.hp).toBe(0);
    const deaths = state.events.filter(e => e.type === 'death' && e.source === survivor.id);
    expect(deaths).toHaveLength(2); expect(deaths[0]).toBe(earlier); expect(deaths[1]).not.toBe(earlier);
    expectLosses(recorder, 1, setup.cost); acceptedOrders(state, setup.commander); expectLosses(recorder, 1, setup.cost);
    const replay = new ReplayPlayer(recorder.export()); expect(replay.finished).toBe(true); expectLosses(replay, 1, setup.cost);
    expect(saveGame(replay.state)).toEqual(saveGame(state)); recorder.dispose(); replay.dispose();
  });

  it('restores a seek checkpoint taken on the same tick as a lethal command without recounting its death', () => {
    const { state, commander, victims, ability, cost } = fixture('undead');
    commander.cooldown = 1000;
    const recorder = new MatchRecorder(state);
    for (let i = 0; i < 600; i++) stepGame(state, .05);
    expect(victims[0].hp).toBe(20); expectLosses(recorder, 0, 0);
    expect(issueCommand(state, 0, ability)).toBe(true); acceptedOrders(state, commander);
    expect(state.tick).toBe(600); expectLosses(recorder, 1, cost);
    for (let i = 0; i < 100; i++) stepGame(state, .05);
    const replay = new ReplayPlayer(recorder.export());
    replay.advance(600); expectLosses(replay, 1, cost);
    expect(replay.state.events.some(event => event.type === 'death' && event.source === victims[0].id)).toBe(true);
    replay.advance(100); expectLosses(replay, 1, cost);
    replay.seek(650); expect(replay.state.tick).toBe(650); expectLosses(replay, 1, cost);
    const fork = replay.forkForSeek(600); expect(fork.state.tick).toBe(600); expectLosses(fork, 1, cost);
    fork.advance(100); expectLosses(fork, 1, cost); expect(saveGame(fork.state)).toEqual(saveGame(state));
    replay.seek(700); expectLosses(replay, 1, cost); expect(saveGame(replay.state)).toEqual(saveGame(state));
    recorder.dispose(); replay.dispose(); fork.dispose();
  });

});
