import { expect, it } from 'vitest';
import { createGame, runAI, stepGame } from '../src/core/simulation';

// Both commanders use the public AI and shared rules. No resources, damage,
// units or outcomes are injected; this exercises the complete economy loop.
it.each(['orcs', 'fairies'] as const)('completes a real %s AI-vs-AI skirmish', faction => {
  const s = createGame(faction);
  const trained = [0, 0], deposited = [0, 0], attacks = [0, 0];
  const built = [new Set<string>(), new Set<string>()];
  for (let tick = 0; tick < 20 * 15 * 60 && s.winner === null; tick++) {
    if (tick % 20 === 0) runAI(s, 0);
    stepGame(s, .05);
    for (const event of s.events) {
      if (event.type === 'train') trained[event.side]++;
      if (event.type === 'gather') deposited[event.side]++;
      if (event.type === 'attack') attacks[event.side]++;
    }
    for (const entity of s.entities) if (entity.kind === 'building' && entity.progress === 1) built[entity.side].add(entity.role);
    for (const player of s.players) {
      expect(player.wood).toBeGreaterThanOrEqual(0);
      expect(player.ore).toBeGreaterThanOrEqual(0);
      expect(player.population).toBeLessThanOrEqual(100);
    }
  }
  console.info(JSON.stringify({ faction, seconds: s.time, winner: s.winner, trained, deposited, attacks, built: built.map(b => [...b]) }));
  for (const side of [0, 1]) {
    expect(trained[side]).toBeGreaterThan(5);
    expect(deposited[side]).toBeGreaterThan(10);
    expect(attacks[side]).toBeGreaterThan(10);
    expect(built[side].has('barracks')).toBe(true);
    expect(built[side].has('depot')).toBe(true);
  }
  expect(s.winner).not.toBeNull();
  const lostHQ = s.entities.find(e => e.role === 'hq' && e.side !== s.winner);
  expect(lostHQ?.hp ?? 0).toBe(0);
}, 120_000);
