import { describe, expect, it } from 'vitest';
import { TerminalSession, replayMatch } from '../src/cli/session';
import type { Cost, MatchConfig, Side } from '../src/core/types';

const result = (session: TerminalSession, input: unknown) => (session.handle(input) as { result: any }).result;
const config = (): MatchConfig => ({ schemaVersion: 1, map: { seed: 4127, size: 'huge' }, players: [
  { id: 0, teamId: 0, factionId: 'orcs', controller: 'external', handicap: { startingResources: { wood: 420, ore: 220, crystal: 20 } } },
  { id: 1, teamId: 0, factionId: 'fairies', controller: 'external', handicap: { startingResources: { wood: 420, ore: 220, crystal: 20 } } },
  { id: 2, teamId: 0, factionId: 'dwarves', controller: 'ai', handicap: { startingResources: { wood: 420, ore: 220, crystal: 20 } } },
  { id: 3, teamId: 1, factionId: 'undead', controller: 'external' },
] });
const start = (side: Side = 0) => { const session = new TerminalSession(); result(session, { op: 'startMatch', config: config(), side }); return session; };
const command = (session: TerminalSession, value: unknown) => result(session, { op: 'command', command: value });
const bank = (session: TerminalSession, side: Side): Cost => {
  const player = session.state!.players[side]; return { wood: player.wood, ore: player.ore, crystal: player.crystal };
};

describe('allied commands through the terminal protocol', () => {
  it('publishes request status, advances the AI, cancels its request, and replays the same state', () => {
    const session = start(), initial = result(session, { op: 'observe' }), hq = initial.entities.find((entity: { side: number; role: string }) => entity.side === 0 && entity.role === 'hq');
    expect(initial.alliedAi).toEqual({ allies: [{ side: 2, faction: 'dwarves' }], directives: [], transfers: [] });
    expect(command(session, { type: 'allyDirective', ally: 2, directive: 'defend', x: hq.x, y: hq.y }).accepted).toBe(true);
    const requested = result(session, { op: 'observe' }).alliedAi.directives[0];
    expect(requested).toMatchObject({ id: 1, issuer: 0, recipient: 2, kind: 'defend', status: 'accepted' });
    expect(requested).not.toHaveProperty('assigned');
    result(session, { op: 'advance', ticks: 30 });
    expect(result(session, { op: 'observe' }).alliedAi.directives[0]).toMatchObject({ status: 'active' });
    expect(command(session, { type: 'cancelAllyDirective', directiveId: requested.id }).accepted).toBe(true);
    expect(result(session, { op: 'observe' }).alliedAi.directives[0]).toMatchObject({ status: 'cancelled', reason: 'Cancelled by requester.' });
    expect(replayMatch(session.replay).verified).toBe(session.replay.length);
  });

  it('uses the selected terminal side as payer, supports recipient zero, and preserves receipts after loading', () => {
    const session = start(1), beforeSender = bank(session, 1), beforeRecipient = bank(session, 0), amount = { wood: 11, ore: 5, crystal: 2 };
    expect(command(session, { type: 'transferResources', recipient: 0, resources: amount }).accepted).toBe(true);
    for (const kind of ['wood', 'ore', 'crystal'] as const) {
      expect(bank(session, 1)[kind]).toBe(beforeSender[kind] - amount[kind]);
      expect(bank(session, 0)[kind]).toBe(beforeRecipient[kind] + amount[kind]);
      expect(bank(session, 1)[kind] + bank(session, 0)[kind]).toBe(beforeSender[kind] + beforeRecipient[kind]);
    }
    const observed = result(session, { op: 'observe' });
    expect(observed.alliedAi.transfers).toEqual([{ id: 1, sender: 1, recipient: 0, resources: amount, time: 0 }]);
    expect(observed).not.toHaveProperty('players');
    expect(observed.alliedAi).not.toHaveProperty('coordinator');
    expect(Object.keys(observed.alliedAi.allies[0]).sort()).toEqual(['faction', 'side']);
    const saved = result(session, { op: 'save' }), restored = new TerminalSession();
    const loaded = result(restored, { op: 'load', save: saved, side: 1 });
    expect(loaded.alliedAi).toEqual(observed.alliedAi);
    expect(bank(restored, 0)).toEqual(bank(session, 0));
    expect(bank(restored, 1)).toEqual(bank(session, 1));
    expect(replayMatch(session.replay).verified).toBe(session.replay.length);
    expect(replayMatch(restored.replay).verified).toBe(restored.replay.length);
  });

  it('fails a pending request when loading its AI recipient as the controlled terminal side', () => {
    const session = start(), point = session.state!.starts[2];
    expect(command(session, { type: 'allyDirective', ally: 2, directive: 'defend', x: point.x, y: point.y }).accepted).toBe(true);
    result(session, { op: 'advance', ticks: 1 });
    expect(result(session, { op: 'observe' }).alliedAi.directives[0].status).toBe('active');
    const saved = result(session, { op: 'save' }), restored = new TerminalSession();
    result(restored, { op: 'load', save: saved, side: 2 });
    expect(restored.state!.controllers).toEqual(['external', 'external', 'external', 'external']);
    const advanced = result(restored, { op: 'advance', ticks: 1 });
    expect(advanced.advanced).toBe(1);
    expect(advanced.observation.alliedAi.directives[0]).toMatchObject({ status: 'failed', reason: 'Ally is unavailable.' });
    expect(result(restored, { op: 'save' }).runtime.teamAI.directives[0].assigned).toEqual([]);
    expect(replayMatch(restored.replay).verified).toBe(restored.replay.length);
  });

  it('rejects human or opposing directive recipients and hostile or unaffordable transfers without changing banks', () => {
    const session = start(), initial = bank(session, 0), point = session.state!.starts[0];
    const defend = { type: 'allyDirective', ally: 2, directive: 'defend', x: point.x, y: point.y };
    for (const ally of [0, 1, 3]) expect(command(session, { ...defend, ally }).accepted).toBe(false);
    for (const recipient of [0, 3]) expect(command(session, { type: 'transferResources', recipient, resources: { wood: 1, ore: 0, crystal: 0 } }).accepted).toBe(false);
    expect(command(session, { type: 'transferResources', recipient: 1, resources: { wood: initial.wood + 1, ore: 0, crystal: 0 } }).accepted).toBe(false);
    const ownHq = session.state!.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
    const enemyHq = session.state!.entities.find(entity => entity.side === 3 && entity.role === 'hq')!;
    expect(result(session, { op: 'observe' }).entities.some((entity: { id: number }) => entity.id === enemyHq.id)).toBe(false);
    for (const target of [ownHq.id, enemyHq.id]) expect(command(session, { type: 'allyDirective', ally: 2, directive: 'attack', target }).accepted).toBe(false);
    expect(bank(session, 0)).toEqual(initial);
    expect(result(session, { op: 'observe' }).alliedAi).toMatchObject({ directives: [], transfers: [] });
  });

  it('strictly rejects forged actors, incomplete or unsafe resource values, and unrelated command fields', () => {
    const session = start(), initial = bank(session, 0), point = session.state!.starts[0];
    const transfer = { type: 'transferResources', recipient: 1, resources: { wood: 1, ore: 0, crystal: 0 } };
    const defend = { type: 'allyDirective', ally: 2, directive: 'defend', x: point.x, y: point.y };
    const invalid = [
      { ...transfer, payer: 2 }, { ...transfer, sender: 2 }, { ...transfer, side: 2 },
      { ...defend, issuer: 1 }, { ...defend, side: 2 }, { ...defend, queued: true },
      { ...defend, x: Infinity }, { ...defend, ally: -1 }, { ...defend, ally: 8 },
      { ...transfer, recipient: '0' }, { ...transfer, recipient: 1.5 },
      { ...transfer, resources: { wood: 1, ore: 0 } },
      { ...transfer, resources: { wood: -1, ore: 0, crystal: 0 } },
      { ...transfer, resources: { wood: NaN, ore: 0, crystal: 0 } },
      { ...transfer, resources: { wood: Infinity, ore: 0, crystal: 0 } },
      { ...transfer, resources: { wood: 1e9 + 1, ore: 0, crystal: 0 } },
      { ...transfer, resources: { wood: 0, ore: 0, crystal: 0 } },
      { ...transfer, resources: { wood: 1, ore: 0, crystal: 0, payer: 2 } },
      { type: 'cancelAllyDirective', directiveId: 1, issuer: 2 },
      { type: 'allyDirective', ally: 2, directive: 'support', resources: transfer.resources, x: point.x, y: point.y },
    ];
    const replayLength = session.replay.length;
    for (const value of invalid) {
      expect(() => command(session, value)).toThrow('Malformed command');
      expect(session.replay).toHaveLength(replayLength);
      expect(bank(session, 0)).toEqual(initial);
    }
    expect(result(session, { op: 'observe' }).alliedAi).toMatchObject({ directives: [], transfers: [] });
  });
});
