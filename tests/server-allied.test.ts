import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WebSocket } from 'ws';
import type { Cost } from '../src/core/types';
import { createRtsServer } from '../src/server/server';
import type { CommandAck, LobbyObservation, LobbyPlayerSettings, ServerMessage, SnapshotMessage } from '../src/online/protocol';

type Hello = Extract<ServerMessage, { kind: 'hello' }>;
const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

class AlliedClient {
  cookie = '';
  constructor(readonly url: string) {}
  async request(path: string, value?: unknown) {
    const response = await fetch(this.url + path, {
      method: value === undefined ? 'GET' : 'POST',
      headers: { Origin: this.url, ...(this.cookie ? { Cookie: this.cookie } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0];
    return { status: response.status, data: await response.json() as Record<string, any> };
  }
  async guest() {
    expect((await this.request('/api/auth/guest', {})).status).toBe(200);
    expect(this.cookie).toMatch(/^ovf_session=/);
  }
  async connect(matchId: string, perspective?: number) {
    const ticket = await this.request(`/api/matches/${matchId}/ticket`, { role: 'player', ...(perspective === undefined ? {} : { perspective }) });
    expect(ticket.status).toBe(200);
    const peer = new AlliedPeer(this.url.replace(/^http/, 'ws') + `/ws?ticket=${ticket.data.ticket}`, this.cookie, this.url);
    cleanup.push(async () => peer.close());
    peer.hello = await peer.next(message => message.kind === 'hello') as Hello;
    return peer;
  }
}

class AlliedPeer {
  readonly socket: WebSocket;
  readonly messages: ServerMessage[] = [];
  readonly frames = new Map<number, SnapshotMessage>();
  hello!: Hello;
  private waiters: Array<{ predicate: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }> = [];
  constructor(url: string, cookie: string, origin: string) {
    this.socket = new WebSocket(url, { headers: { Cookie: cookie, Origin: origin } });
    this.socket.on('message', data => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      if (message.kind === 'snapshot') this.frames.set(message.tick, message);
      const waiter = this.waiters.find(item => item.predicate(message));
      if (waiter) { this.waiters.splice(this.waiters.indexOf(waiter), 1); clearTimeout(waiter.timer); waiter.resolve(message); }
      else this.messages.push(message);
    });
    this.socket.on('error', error => this.rejectWaiters(error));
    this.socket.on('close', () => this.rejectWaiters(new Error('Connection closed while waiting for an allied command response.')));
  }
  private rejectWaiters(error: Error) { for (const waiter of this.waiters) { clearTimeout(waiter.timer); waiter.reject(error); } this.waiters = []; }
  next(predicate: (message: ServerMessage) => boolean, timeout = 5000): Promise<ServerMessage> {
    const index = this.messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: setTimeout(() => { this.waiters = this.waiters.filter(item => item !== waiter); reject(new Error('Timed out waiting for an allied command response.')); }, timeout) };
      this.waiters.push(waiter);
    });
  }
  async frame(minimumTick = 0) { return await this.next(message => message.kind === 'snapshot' && message.tick >= minimumTick) as SnapshotMessage; }
  async frameAt(tick: number) { return this.frames.get(tick) ?? await this.next(message => message.kind === 'snapshot' && message.tick === tick) as SnapshotMessage; }
  send(clientSeq: number, command: unknown, observedTick = 0) {
    this.socket.send(JSON.stringify({ kind: 'command', protocolVersion: 1, clientSeq, observedTick, command }));
  }
  async command(clientSeq: number, command: unknown, observedTick = 0) {
    this.send(clientSeq, command, observedTick);
    return await this.next(message => message.kind === 'commandAck' && message.clientSeq === clientSeq) as CommandAck;
  }
  close() { this.socket.terminate(); }
}

async function launch() {
  const directory = await mkdtemp(join(tmpdir(), 'ovf-server-allied-'));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const server = await createRtsServer({ dataDir: directory, port: 0, spectatorDelaySeconds: 0 });
  cleanup.push(() => server.close());
  const clients = [new AlliedClient(server.url), new AlliedClient(server.url), new AlliedClient(server.url)];
  for (const client of clients) await client.guest();
  const players: LobbyPlayerSettings[] = [
    { factionId: 'orcs', teamId: 0, controller: 'human', handicap: { startingResources: { wood: 420, ore: 220, crystal: 20 } } },
    { factionId: 'fairies', teamId: 0, controller: 'human', handicap: { startingResources: { wood: 420, ore: 220, crystal: 20 } } },
    { factionId: 'dwarves', teamId: 0, controller: 'ai', handicap: { startingResources: { wood: 420, ore: 220, crystal: 20 } } },
    { factionId: 'undead', teamId: 1, controller: 'human' },
  ];
  let response = await clients[0].request('/api/lobbies', { settings: { mapSize: 'huge', factions: players.map(player => player.factionId), players, sharedVision: true }, seed: 4127 });
  expect(response.status).toBe(201);
  let lobby = response.data.lobby as LobbyObservation;
  for (const client of clients.slice(1)) {
    response = await client.request(`/api/lobbies/${lobby.id}/join`, { expectedRevision: lobby.revision });
    expect(response.status).toBe(200); lobby = response.data.lobby;
  }
  for (const client of clients) {
    response = await client.request(`/api/lobbies/${lobby.id}/ready`, { expectedRevision: lobby.revision, ready: true });
    expect(response.status).toBe(200); lobby = response.data.lobby;
  }
  response = await clients[0].request(`/api/lobbies/${lobby.id}/start`, { expectedRevision: lobby.revision });
  expect(response.status).toBe(200); lobby = response.data.lobby;
  expect(lobby.seats.map(seat => seat.controller)).toEqual(['human', 'human', 'ai', 'human']);
  const peers = await Promise.all(clients.map(client => client.connect(lobby.matchId!)));
  expect(peers.map(peer => peer.hello.side)).toEqual([0, 1, 3]);
  const connected = await Promise.all(peers.map(peer => peer.frame()));
  const commonTick = Math.max(...connected.map(frame => frame.tick)) + 4;
  return { directory, server, clients, peers, lobby, commonTick, matchId: lobby.matchId! };
}

const bank = (frame: SnapshotMessage): Cost => ({ wood: frame.view.player.wood, ore: frame.view.player.ore, crystal: frame.view.player.crystal });
const resources = ['wood', 'ore', 'crystal'] as const;
function expectPrivateReceiptFieldsAbsent(frame: SnapshotMessage) {
  expect(frame.view).not.toHaveProperty('players');
  expect(frame.view).not.toHaveProperty('teamPlayers');
  expect(Object.keys(frame.view.alliedAi).sort()).toEqual(['allies', 'directives', 'transfers']);
  for (const ally of frame.view.alliedAi.allies) expect(Object.keys(ally).sort()).toEqual(['faction', 'side']);
  for (const directive of frame.view.alliedAi.directives) {
    expect(directive).not.toHaveProperty('assigned');
    expect(directive).not.toHaveProperty('assignedIds');
  }
  expect(frame.view.alliedAi).not.toHaveProperty('coordinator');
  expect(frame.view.alliedAi).not.toHaveProperty('players');
  expect(frame.view.alliedAi).not.toHaveProperty('bank');
  for (const entity of frame.view.entities.filter(entity => entity.side !== frame.view.side)) {
    for (const field of ['order', 'queue', 'orderQueue', 'rally', 'path']) expect(entity).not.toHaveProperty(field);
  }
}

describe('allied commands over authenticated HTTP and WebSocket connections', () => {
  it('runs AI requests through public receipts, preserves issuer ownership, and hides them from opponents', async () => {
    const { clients, peers, commonTick, matchId } = await launch(), [host, ally, enemy] = peers;
    const initial = await host.frame(commonTick), point = initial.view.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
    expect(initial.view.alliedAi).toEqual({ allies: [{ side: 2, faction: 'dwarves' }], directives: [], transfers: [] });
    let sequence = 0;
    const defend = { type: 'allyDirective', ally: 2, directive: 'defend', x: point.x, y: point.y };
    const ack = await host.command(++sequence, defend);
    expect(ack).toMatchObject({ accepted: true });
    let observed = await host.frame(ack.appliedTick);
    const receipt = observed.view.alliedAi.directives[0];
    expect(receipt).toMatchObject({ id: 1, issuer: 0, recipient: 2, kind: 'defend', destination: { x: point.x, y: point.y } });
    while (observed.view.alliedAi.directives[0].status === 'accepted' && observed.tick < ack.appliedTick + 60) observed = await host.frame(observed.tick + 1);
    expect(observed.view.alliedAi.directives[0].status).toBe('active');
    expectPrivateReceiptFieldsAbsent(observed);
    expect((await ally.frameAt(observed.tick)).view.alliedAi.directives).toEqual(observed.view.alliedAi.directives);
    const opposing = await enemy.frameAt(observed.tick);
    expect(opposing.view.alliedAi).toEqual({ allies: [], directives: [], transfers: [] });
    expect(await ally.command(1, { type: 'cancelAllyDirective', directiveId: receipt.id })).toMatchObject({ accepted: false, reason: 'unavailable' });
    expect(await ally.command(2, { ...defend, directive: 'scout' })).toMatchObject({ accepted: false, reason: 'unavailable' });

    for (const target of [0, 1, 3]) expect(await host.command(++sequence, { ...defend, ally: target })).toMatchObject({ accepted: false, reason: 'unavailable' });
    for (const forged of [{ ...defend, issuer: 1 }, { ...defend, side: 2 }]) expect(await host.command(++sequence, forged)).toMatchObject({ accepted: false, reason: 'invalid-command' });
    expect(await host.command(++sequence, { type: 'allyDirective', ally: 2, directive: 'attack', target: point.id })).toMatchObject({ accepted: false, reason: 'unavailable' });
    const cancellation = await host.command(++sequence, { type: 'cancelAllyDirective', directiveId: receipt.id });
    expect(cancellation.accepted).toBe(true);
    const cancelled = await host.frame(cancellation.appliedTick);
    expect(cancelled.view.alliedAi.directives[0]).toMatchObject({ status: 'cancelled', reason: 'Cancelled by requester.' });

    for (const directive of ['scout', 'attack'] as const) {
      const accepted = await host.command(++sequence, { ...defend, directive });
      expect(accepted.accepted).toBe(true);
      const frame = await host.frame(accepted.appliedTick);
      expect(frame.view.alliedAi.directives.at(-1)).toMatchObject({ issuer: 0, recipient: 2, kind: directive });
      expectPrivateReceiptFieldsAbsent(frame);
    }
    const support = await host.command(++sequence, { type: 'allyDirective', ally: 2, directive: 'support', resources: { wood: 1, ore: 1, crystal: 1 } });
    expect(support.accepted).toBe(true);
    let supported = await host.frame(support.appliedTick);
    expect(supported.view.alliedAi.directives.at(-1)).toMatchObject({ issuer: 0, recipient: 2, kind: 'support', resources: { wood: 1, ore: 1, crystal: 1 } });
    while (supported.view.alliedAi.directives.at(-1)!.status !== 'completed' && supported.tick < support.appliedTick + 60) supported = await host.frame(supported.tick + 1);
    expect(supported.view.alliedAi.directives.at(-1)).toMatchObject({ status: 'completed', reason: 'Resources transferred.' });
    expect(supported.view.alliedAi.transfers).toHaveLength(1);
    expect(supported.view.alliedAi.transfers[0]).toMatchObject({ sender: 2, recipient: 0, resources: { wood: 1, ore: 1, crystal: 1 } });
    expectPrivateReceiptFieldsAbsent(supported);
    expect((await enemy.frameAt(supported.tick)).view.alliedAi.directives).toEqual([]);
    expect((await enemy.frameAt(supported.tick)).view.alliedAi.transfers).toEqual([]);

    const claimedAi = await clients[0].request(`/api/matches/${matchId}/ticket`, { role: 'player', perspective: 2 });
    expect(claimedAi.status).toBe(200);
    expect(claimedAi.data.side).toBe(0);
  }, 15000);

  it('conserves the authenticated payer bank and retries each transfer once before and after restart', async () => {
    const { directory, server, clients, peers, commonTick, matchId } = await launch(), [host, ally, enemy] = peers;
    const initialHost = await host.frame(commonTick), initialAlly = await ally.frameAt(initialHost.tick);
    const hostBefore = bank(initialHost), allyBefore = bank(initialAlly), amount = { wood: 13, ore: 7, crystal: 2 };
    const command = { type: 'transferResources', recipient: 1, resources: amount };
    host.socket.send(JSON.stringify({ kind: 'command', protocolVersion: 1, clientSeq: 1, observedTick: 0, side: 2, command }));
    expect(await host.next(message => message.kind === 'error')).toMatchObject({ code: 'invalid-message' });
    const ack = await host.command(1, command);
    expect(ack.accepted).toBe(true);
    expect(await host.command(1, command, ack.appliedTick)).toEqual(ack);
    const paid = await host.frame(Math.max(...host.frames.keys()) + 4), received = await ally.frameAt(paid.tick);
    for (const kind of resources) {
      expect(bank(paid)[kind]).toBe(hostBefore[kind] - amount[kind]);
      expect(bank(received)[kind]).toBe(allyBefore[kind] + amount[kind]);
      expect(bank(paid)[kind] + bank(received)[kind]).toBe(hostBefore[kind] + allyBefore[kind]);
    }
    const receipt = { id: 1, sender: 0, recipient: 1, resources: amount };
    expect(paid.view.alliedAi.transfers).toHaveLength(1);
    expect(paid.view.alliedAi.transfers[0]).toMatchObject(receipt);
    expect(received.view.alliedAi.transfers).toEqual(paid.view.alliedAi.transfers);
    expect((await enemy.frameAt(paid.tick)).view.alliedAi.transfers).toEqual([]);
    expectPrivateReceiptFieldsAbsent(paid);
    host.send(1, { ...command, resources: { ...amount, wood: 14 } });
    expect(await host.next(message => message.kind === 'error')).toMatchObject({ code: 'sequence-conflict' });
    let rejectedTick = ack.appliedTick;
    for (const [sequence, rejected, reason] of [
      [2, { ...command, recipient: 3 }, 'unavailable'],
      [3, { ...command, recipient: 0 }, 'unavailable'],
      [4, { ...command, resources: { wood: hostBefore.wood + 1, ore: 0, crystal: 0 } }, 'unavailable'],
      [5, { ...command, payer: 2 }, 'invalid-command'],
      [6, { ...command, sender: 2 }, 'invalid-command'],
    ] as const) {
      const rejection = await host.command(sequence, rejected);
      expect(rejection).toMatchObject({ accepted: false, reason });
      rejectedTick = rejection.appliedTick;
    }
    const rejectedFrame = await host.frame(rejectedTick);
    expect(bank(rejectedFrame)).toEqual(bank(paid));
    expect(rejectedFrame.view.alliedAi.transfers).toEqual(paid.view.alliedAi.transfers);

    const returnAmount = { wood: 3, ore: 2, crystal: 1 }, returned = await ally.command(1, { type: 'transferResources', recipient: 0, resources: returnAmount });
    expect(returned.accepted).toBe(true);
    const beforeRestart = await host.frame(returned.appliedTick), allyBeforeRestart = await ally.frameAt(beforeRestart.tick);
    for (const kind of resources) {
      expect(bank(beforeRestart)[kind]).toBe(hostBefore[kind] - amount[kind] + returnAmount[kind]);
      expect(bank(allyBeforeRestart)[kind]).toBe(allyBefore[kind] + amount[kind] - returnAmount[kind]);
    }
    expect(beforeRestart.view.alliedAi.transfers).toHaveLength(2);
    expect(beforeRestart.view.alliedAi.transfers[1]).toMatchObject({ id: 2, sender: 1, recipient: 0, resources: returnAmount });
    await server.close();
    const resumed = await createRtsServer({ dataDir: directory, port: 0, spectatorDelaySeconds: 0 });
    cleanup.push(() => resumed.close());
    const restoredClients = clients.map(client => { const restored = new AlliedClient(resumed.url); restored.cookie = client.cookie; return restored; });
    const restoredPeers = await Promise.all(restoredClients.map(client => client.connect(matchId)));
    expect(restoredPeers[0].hello).toMatchObject({ side: 0, lastClientSeq: 6 });
    expect(restoredPeers[1].hello).toMatchObject({ side: 1, lastClientSeq: 1 });
    const connectedAfterRestart = await Promise.all(restoredPeers.map(peer => peer.frame(beforeRestart.tick)));
    await restoredPeers[0].frame(Math.max(...connectedAfterRestart.map(frame => frame.tick)) + 4);
    expect(await restoredPeers[0].command(1, command)).toEqual(ack);
    expect(await restoredPeers[1].command(1, { type: 'transferResources', recipient: 0, resources: returnAmount })).toEqual(returned);
    const restored = await restoredPeers[0].frame(Math.max(...restoredPeers[0].frames.keys()) + 4), restoredAlly = await restoredPeers[1].frameAt(restored.tick);
    expect(bank(restored)).toEqual(bank(beforeRestart));
    expect(bank(restoredAlly)).toEqual(bank(allyBeforeRestart));
    expect(restored.view.alliedAi.transfers).toEqual(beforeRestart.view.alliedAi.transfers);
    expect((await restoredPeers[2].frameAt(restored.tick)).view.alliedAi.transfers).toEqual([]);
    const db = new DatabaseSync(join(directory, 'server.sqlite'), { readOnly: true });
    try {
      expect(db.prepare('SELECT COUNT(*) AS n FROM commands WHERE match_id=? AND side=0 AND client_seq=1').get(matchId)?.n).toBe(1);
      expect(db.prepare('SELECT COUNT(*) AS n FROM commands WHERE match_id=? AND side=1 AND client_seq=1').get(matchId)?.n).toBe(1);
    } finally { db.close(); }
  }, 15000);
});
