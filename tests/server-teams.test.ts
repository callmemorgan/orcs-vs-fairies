import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WebSocket } from 'ws';
import { FACTIONS } from '../src/core/content';
import { createMatch } from '../src/core/simulation';
import type { SaveEnvelope } from '../src/core/saves';
import type { FactionId, Side } from '../src/core/types';
import { createRtsServer } from '../src/server/server';
import { OnlineView } from '../src/server/views';
import { teamObservation } from '../src/server/team-view';
import type { Account, CommandAck, LobbyObservation, LobbyPlayerSettings, LobbySettings, ServerMessage, SnapshotMessage } from '../src/online/protocol';

type Hello = Extract<ServerMessage, { kind: 'hello' }>;
type RunningServer = Awaited<ReturnType<typeof createRtsServer>>;
const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { while (cleanup.length) await cleanup.pop()!(); });

class NetworkClient {
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
  async guest(): Promise<Account> {
    const result = await this.request('/api/auth/guest', {});
    expect(result.status).toBe(200);
    expect(this.cookie).toMatch(/^ovf_session=/);
    return result.data.account;
  }
  async connect(matchId: string, ticket: { role?: 'player' | 'spectator'; perspective?: Side; view?: 'player' | 'team' } = {}) {
    const result = await this.request(`/api/matches/${matchId}/ticket`, { role: 'player', ...ticket });
    expect(result.status).toBe(200);
    const peer = new NetworkPeer(this.url.replace(/^http/, 'ws') + `/ws?ticket=${result.data.ticket}`, this.cookie, this.url);
    cleanup.push(async () => peer.close());
    peer.hello = await peer.next(message => message.kind === 'hello') as Hello;
    return peer;
  }
}

class NetworkPeer {
  readonly socket: WebSocket;
  readonly messages: ServerMessage[] = [];
  readonly history = new Map<number, SnapshotMessage>();
  hello!: Hello;
  private waiters: Array<{ predicate: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }> = [];
  constructor(url: string, cookie: string, origin: string) {
    this.socket = new WebSocket(url, { headers: { Cookie: cookie, Origin: origin } });
    this.socket.on('message', data => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      if (message.kind === 'snapshot') this.history.set(message.tick, message);
      const waiter = this.waiters.find(waiter => waiter.predicate(message));
      if (waiter) { this.waiters.splice(this.waiters.indexOf(waiter), 1); clearTimeout(waiter.timer); waiter.resolve(message); }
      else this.messages.push(message);
    });
    this.socket.on('error', error => this.rejectWaiters(error));
    this.socket.on('close', () => this.rejectWaiters(new Error('Connection closed while waiting for a server message.')));
  }
  private rejectWaiters(error: Error) { for (const waiter of this.waiters) { clearTimeout(waiter.timer); waiter.reject(error); } this.waiters = []; }
  next(predicate: (message: ServerMessage) => boolean, timeout = 5000): Promise<ServerMessage> {
    const index = this.messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: setTimeout(() => { this.waiters = this.waiters.filter(item => item !== waiter); reject(new Error('Timed out waiting for a server message.')); }, timeout) };
      this.waiters.push(waiter);
    });
  }
  async frame(minimumTick = 0) { return await this.next(message => message.kind === 'snapshot' && message.tick >= minimumTick) as SnapshotMessage; }
  async frameAt(tick: number) { return this.history.get(tick) ?? await this.next(message => message.kind === 'snapshot' && message.tick === tick) as SnapshotMessage; }
  async command(clientSeq: number, command: unknown, observedTick = 0) {
    this.socket.send(JSON.stringify({ kind: 'command', protocolVersion: 1, clientSeq, observedTick, command }));
    return await this.next(message => message.kind === 'commandAck' && message.clientSeq === clientSeq) as CommandAck;
  }
  close() { this.socket.terminate(); }
}

async function setup(count: number, spectatorDelaySeconds = .4) {
  const directory = await mkdtemp(join(tmpdir(), 'ovf-server-teams-'));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const server = await createRtsServer({ dataDir: directory, port: 0, spectatorDelaySeconds });
  cleanup.push(() => server.close());
  const clients: NetworkClient[] = [], accounts: Account[] = [];
  for (let index = 0; index < count; index++) { const client = new NetworkClient(server.url); accounts.push(await client.guest()); clients.push(client); }
  return { directory, server, clients, accounts };
}

async function launch(clients: NetworkClient[], players: LobbyPlayerSettings[], overrides: Partial<LobbySettings> = {}) {
  const settings: LobbySettings = { mapSize: 'huge', factions: players.map(player => player.factionId), players, sharedVision: true, startingAge: 1, ...overrides };
  let response = await clients[0].request('/api/lobbies', { settings, seed: 4127 });
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
  expect(response.status).toBe(200);
  return response.data.lobby as LobbyObservation;
}

const factions: FactionId[] = ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata', 'orcs', 'fairies'];
const fourVsFour = (): LobbyPlayerSettings[] => factions.map((factionId, side) => ({ factionId, teamId: side < 4 ? 0 : 1, controller: 'human' }));
const privateFields = ['order', 'orderQueue', 'queue', 'rally', 'trainProgress', 'research', 'researchProgress', 'carried', 'carriedKind', 'cooldown', 'abilityReadyAt', 'expires', 'lastDamagedAt', 'path'];
const owned = (frame: SnapshotMessage, role: string) => frame.view.entities.find(entity => entity.side === frame.view.side && entity.role === role)!;

describe('hosted team matches', () => {
  it('runs eight human seats, preserves private ownership and durable receipts, and resolves team forfeits after restart', async () => {
    const { directory, server, clients, accounts } = await setup(8);
    const players = fourVsFour(), lobby = await launch(clients, players), matchId = lobby.matchId!;
    expect(lobby.settings.players).toEqual(players);
    expect(lobby.seats.map(seat => seat.side)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(lobby.seats.map(seat => seat.account?.id)).toEqual(accounts.map(account => account.id));
    const peers = await Promise.all(clients.map(client => client.connect(matchId)));
    const initial = await Promise.all(peers.map(peer => peer.frame()));
    for (let side = 0; side < 8; side++) {
      expect(peers[side].hello).toMatchObject({ side, role: 'player', lastClientSeq: 0 });
      expect(initial[side].view).toMatchObject({ side, teamId: side < 4 ? 0 : 1, sharedVision: true });
      expect(initial[side].view.player.faction).toBe(factions[side]);
      expect(initial[side].view.allies).toHaveLength(3);
      expect(initial[side].view.opponents).toHaveLength(4);
      expect(initial[side].view).not.toHaveProperty('players');
      expect(initial[side].view).not.toHaveProperty('teamPlayers');
      expect(initial[side].view.map).not.toHaveProperty('seed');
      const alliedSides = side < 4 ? [0, 1, 2, 3] : [4, 5, 6, 7];
      for (const ally of alliedSides) expect(initial[side].view.entities.some(entity => entity.side === ally && entity.role === 'hq')).toBe(true);
      for (const roster of [...initial[side].view.allies, ...initial[side].view.opponents]) expect(Object.keys(roster).sort()).toEqual(['faction', 'side', 'teamId']);
      for (const entity of initial[side].view.entities.filter(entity => entity.side !== side)) for (const field of privateFields) expect(entity).not.toHaveProperty(field);
      expect(await peers[side].command(1, { type: 'hold', ids: [owned(initial[side], 'worker').id] })).toMatchObject({ accepted: true });
    }
    const sharedTick = Math.max(...initial.map(frame => frame.tick)) + 4;
    const zero = await peers[0].frame(sharedTick), sameTeam = await peers[3].frameAt(zero.tick);
    expect(sameTeam.view.visible).toEqual(zero.view.visible);
    expect(sameTeam.view.explored).toEqual(zero.view.explored);
    const allyWorker = owned(initial[1], 'worker'), ownFighter = owned(initial[0], 'melee');
    expect(await peers[0].command(2, { type: 'attack', ids: [ownFighter.id], target: allyWorker.id })).toMatchObject({ accepted: false, reason: 'unavailable' });
    expect(await peers[0].command(3, { type: 'move', ids: [allyWorker.id], x: allyWorker.x + 1, y: allyWorker.y + 1 })).toMatchObject({ accepted: false, reason: 'ownership' });

    const watcher = new NetworkClient(server.url); await watcher.guest();
    expect((await watcher.request(`/api/matches/${matchId}/ticket`, { role: 'player' })).status).toBe(403);
    const observer = await watcher.connect(matchId, { role: 'spectator', perspective: 7, view: 'team' });
    expect(observer.hello).toMatchObject({ side: 7, role: 'spectator', delayTicks: 8, perspective: 'team' });
    const firstCommonTick = Math.max(...peers.map(peer => Math.min(...peer.history.keys())));
    const beforeSpend = await observer.frame(firstCommonTick);
    const hq = owned(initial[7], 'hq'), recruit = { type: 'train', id: hq.id, role: 'worker' };
    const ack = await peers[7].command(2, recruit);
    expect(ack.accepted).toBe(true);
    expect(await peers[7].command(2, recruit, ack.appliedTick)).toEqual(ack);
    const paid = await peers[7].frame(ack.appliedTick);
    expect(paid.view.player.wood).toBe(initial[7].view.player.wood - FACTIONS.fairies.units.worker.cost.wood);
    expect(owned(paid, 'hq')).toHaveProperty('queue', ['worker']);
    const allyPaid = await peers[4].frameAt(paid.tick);
    expect(allyPaid.view.player.wood).toBe(initial[4].view.player.wood);
    expect(allyPaid.view.entities.find(entity => entity.id === hq.id)).not.toHaveProperty('queue');
    let delayed = await observer.frame(beforeSpend.tick + 1);
    expect(delayed.tick).toBeLessThan(ack.appliedTick);
    for (let index = 0; index < 3; index++) {
      const historical = await Promise.all([4, 5, 6, 7].map(side => peers[side].frameAt(delayed.tick)));
      expect(delayed.view).toMatchObject({ side: 7, teamId: 1, teamPerspective: true });
      expect(delayed.view.teamPlayers).toEqual(historical.map((frame, index) => ({ side: index + 4, player: frame.view.player })));
      expect(delayed.view.player).toEqual(historical[3].view.player);
      expect(delayed.view.visible).toEqual(historical[3].view.visible);
      expect(delayed.view.explored).toEqual(historical[3].view.explored);
      const live = (await clients[0].request('/api/matches')).data.matches.find((match: { id: string }) => match.id === matchId);
      expect(live.tick - delayed.tick).toBeGreaterThanOrEqual(8);
      for (const entity of delayed.view.entities.filter(entity => entity.side < 4)) for (const field of privateFields) expect(entity).not.toHaveProperty(field);
      if (index < 2) delayed = await observer.frame(delayed.tick + 1);
    }
    observer.socket.send(JSON.stringify({ kind: 'command', protocolVersion: 1, clientSeq: 1, observedTick: 0, command: { type: 'surrender' } }));
    expect(await observer.next(message => message.kind === 'error')).toMatchObject({ code: 'spectator' });

    const beforeRestart = await peers[7].frame(paid.tick + 1);
    await server.close();
    const resumed: RunningServer = await createRtsServer({ dataDir: directory, port: 0, spectatorDelaySeconds: .4 });
    cleanup.push(() => resumed.close());
    const restoredClients = clients.map(client => { const restored = new NetworkClient(resumed.url); restored.cookie = client.cookie; return restored; });
    for (let side = 0; side < 8; side++) expect((await restoredClients[side].request('/api/session')).data.account.id).toBe(accounts[side].id);
    const restoredLobby = (await restoredClients[0].request(`/api/lobbies/${lobby.id}`)).data.lobby as LobbyObservation;
    expect(restoredLobby).toEqual(lobby);
    const restoredPeers = await Promise.all(restoredClients.map(client => client.connect(matchId)));
    const restored = await restoredPeers[7].frame(beforeRestart.tick);
    expect(restoredPeers[7].hello).toMatchObject({ side: 7, lastClientSeq: 2 });
    expect(await restoredPeers[7].command(2, recruit, restored.tick)).toEqual(ack);
    expect(restored.view.player.wood).toBe(paid.view.player.wood);
    const db = new DatabaseSync(join(directory, 'server.sqlite'), { readOnly: true });
    try { expect(db.prepare('SELECT COUNT(*) AS n FROM commands WHERE match_id=? AND side=7 AND client_seq=2').get(matchId)?.n).toBe(1); }
    finally { db.close(); }
    const gathering = await restoredPeers[4].frame(restored.tick), worker = owned(gathering, 'worker');
    const resource = gathering.view.resources.filter(node => node.visible && node.kind === 'wood' && node.amount > 0).sort((a, b) => Math.hypot(a.x - worker.x, a.y - worker.y) - Math.hypot(b.x - worker.x, b.y - worker.y))[0];
    expect(resource).toBeDefined();
    expect(await restoredPeers[4].command(2, { type: 'gather', ids: [worker.id], target: resource.id, queued: true })).toMatchObject({ accepted: true });
    const firstForfeit = await restoredPeers[4].command(3, { type: 'surrender' });
    expect(firstForfeit.accepted).toBe(true);
    const continuing = await restoredPeers[0].frame(firstForfeit.appliedTick);
    expect(continuing.view.result).toMatchObject({ finished: false, winningTeam: null, outcome: null });
    expect(continuing.view.eliminated).toEqual([false, false, false, false, true, false, false, false]);
    expect(await restoredPeers[5].command(2, { type: 'surrender' })).toMatchObject({ accepted: true });
    expect(await restoredPeers[6].command(2, { type: 'surrender' })).toMatchObject({ accepted: true });
    const lastForfeit = await restoredPeers[7].command(3, { type: 'surrender' });
    expect(lastForfeit.accepted).toBe(true);
    const winner = await restoredPeers[0].frame(lastForfeit.appliedTick), loser = await restoredPeers[7].frame(lastForfeit.appliedTick);
    expect(winner.view.result).toMatchObject({ finished: true, winningTeam: 0, outcome: 'win', draw: false });
    expect(loser.view.result).toMatchObject({ finished: true, winningTeam: 0, outcome: 'loss', draw: false });
    expect(winner.view.eliminated).toEqual([false, false, false, false, true, true, true, true]);
    await resumed.close();
    const finishedServer = await createRtsServer({ dataDir: directory, port: 0, spectatorDelaySeconds: .4 });
    cleanup.push(() => finishedServer.close());
    const reconnect = (side: number) => { const client = new NetworkClient(finishedServer.url); client.cookie = clients[side].cookie; return client; };
    const finishedWinner = await reconnect(0).connect(matchId), finishedLoser = await reconnect(7).connect(matchId);
    expect((await finishedWinner.frame(winner.tick)).view.result).toEqual(winner.view.result);
    const recoveredLoss = await finishedLoser.frame(loser.tick);
    expect(recoveredLoss.view.result).toEqual(loser.view.result);
    expect(await finishedLoser.command(3, { type: 'surrender' }, recoveredLoss.tick)).toEqual(lastForfeit);
  }, 20000);

  it('starts cooperative human seats without AI readiness and runs both computer opponents through delayed team observations', async () => {
    const { server, clients, accounts } = await setup(2);
    const players: LobbyPlayerSettings[] = [
      { factionId: 'orcs', teamId: 0, controller: 'human' },
      { factionId: 'fairies', teamId: 0, controller: 'human' },
      { factionId: 'dwarves', teamId: 1, controller: 'ai' },
      { factionId: 'automata', teamId: 1, controller: 'ai' },
    ];
    const lobby = await launch(clients, players), matchId = lobby.matchId!;
    expect(lobby.seats.map(seat => seat.controller)).toEqual(['human', 'human', 'ai', 'ai']);
    expect(lobby.seats.map(seat => seat.account?.id ?? null)).toEqual([accounts[0].id, accounts[1].id, null, null]);
    expect(lobby.seats.slice(2).every(seat => !seat.ready)).toBe(true);
    const claimedAi = await clients[0].request(`/api/matches/${matchId}/ticket`, { role: 'player', perspective: 2 });
    expect(claimedAi.status).toBe(200); expect(claimedAi.data.side).toBe(0);
    const human = await clients[0].connect(matchId), humanFrame = await human.frame();
    expect(humanFrame.view).toMatchObject({ side: 0, teamId: 0, controller: 'external' });
    expect(humanFrame.view.allies).toEqual([{ side: 1, teamId: 0, faction: 'fairies' }]);
    const watcher = new NetworkClient(server.url); await watcher.guest();
    expect((await watcher.request(`/api/matches/${matchId}/ticket`, { role: 'player', perspective: 2 })).status).toBe(403);
    const observer = await watcher.connect(matchId, { role: 'spectator', perspective: 2, view: 'team' });
    const frame = await observer.frame(20);
    expect(frame.view).toMatchObject({ side: 2, teamId: 1, controller: 'ai', teamPerspective: true });
    expect(frame.view.teamPlayers?.map(player => player.side)).toEqual([2, 3]);
    for (const side of [2, 3]) {
      const hq = frame.view.entities.find(entity => entity.side === side && entity.role === 'hq')!;
      expect(hq).toHaveProperty('queue');
      expect('queue' in hq && hq.queue).toContain('worker');
      const workers = frame.view.entities.filter(entity => entity.side === side && entity.role === 'worker');
      expect(workers.some(entity => 'order' in entity && ['gather', 'build'].includes(entity.order!.type))).toBe(true);
      expect(frame.view.entities.some(entity => entity.side === side && entity.role === 'barracks' && entity.progress < 1)).toBe(true);
      expect(frame.view.teamPlayers!.find(player => player.side === side)!.player.wood).toBeLessThan(420);
    }
    const live = (await clients[0].request('/api/matches')).data.matches[0];
    expect(live.tick - frame.tick).toBeGreaterThanOrEqual(8);
  }, 10000);

  it('requires a human participant and two teams when validating a custom roster', async () => {
    const { clients } = await setup(1);
    const request = (players: LobbyPlayerSettings[]) => clients[0].request('/api/lobbies', { settings: { mapSize: 'huge', players }, seed: 4127 });
    expect((await request([{ factionId: 'orcs', teamId: 0, controller: 'ai' }, { factionId: 'fairies', teamId: 1, controller: 'ai' }])).status).toBe(400);
    expect((await request([{ factionId: 'orcs', teamId: 0, controller: 'human' }, { factionId: 'fairies', teamId: 0, controller: 'human' }])).status).toBe(400);
    expect((await request([...fourVsFour(), { factionId: 'orcs', teamId: 1, controller: 'human' }])).status).toBe(400);
  });

  it('assigns the host after AI slots and changes a roster without evicting present accounts or keeping stale readiness', async () => {
    const { clients, accounts } = await setup(2);
    const players: LobbyPlayerSettings[] = [
      { factionId: 'orcs', teamId: 1, controller: 'ai' },
      { factionId: 'fairies', teamId: 0, controller: 'human' },
      { factionId: 'dwarves', teamId: 1, controller: 'ai' },
      { factionId: 'automata', teamId: 0, controller: 'human' },
    ];
    let response = await clients[0].request('/api/lobbies', { settings: { mapSize: 'huge', players }, seed: 4127 });
    expect(response.status).toBe(201);
    let lobby = response.data.lobby as LobbyObservation;
    expect(lobby.seats[0].account).toBeNull();
    expect(lobby.seats[1].account?.id).toBe(accounts[0].id);
    response = await clients[1].request(`/api/lobbies/${lobby.id}/join`, { expectedRevision: lobby.revision });
    expect(response.status).toBe(200); lobby = response.data.lobby;
    expect(lobby.seats[3].account?.id).toBe(accounts[1].id);
    for (const client of clients) {
      response = await client.request(`/api/lobbies/${lobby.id}/ready`, { expectedRevision: lobby.revision, ready: true });
      expect(response.status).toBe(200); lobby = response.data.lobby;
    }
    const beforeEdit = lobby;
    const edit = (players: LobbyPlayerSettings[]) => clients[0].request(`/api/lobbies/${lobby.id}/settings`, { expectedRevision: lobby.revision, settings: { mapSize: 'huge', players } });
    expect((await edit(players.slice(0, 3))).status).toBe(409);
    expect((await edit(players.map((player, side) => side === 3 ? { ...player, controller: 'ai' } : player))).status).toBe(409);
    expect((await clients[0].request(`/api/lobbies/${lobby.id}`)).data.lobby).toEqual(beforeEdit);
    const reseated: LobbyPlayerSettings[] = players.map((player, side) => side === 0 ? { ...player, controller: 'human', teamId: 0 } : side === 1 ? { ...player, controller: 'ai', teamId: 1 } : player);
    response = await edit(reseated);
    expect(response.status).toBe(200); lobby = response.data.lobby;
    expect(lobby.revision).toBe(beforeEdit.revision + 1);
    expect(lobby.seats.map(seat => seat.account?.id ?? null)).toEqual([accounts[0].id, null, null, accounts[1].id]);
    expect(lobby.seats.every(seat => !seat.ready)).toBe(true);
    expect((await clients[0].request(`/api/lobbies/${lobby.id}/ready`, { expectedRevision: beforeEdit.revision, ready: true })).status).toBe(409);
    expect((await clients[0].request(`/api/lobbies/${lobby.id}/start`, { expectedRevision: beforeEdit.revision })).status).toBe(409);
    expect((await clients[0].request(`/api/lobbies/${lobby.id}/start`, { expectedRevision: lobby.revision })).status).toBe(409);
    for (const client of clients) {
      response = await client.request(`/api/lobbies/${lobby.id}/ready`, { expectedRevision: lobby.revision, ready: true });
      expect(response.status).toBe(200); lobby = response.data.lobby;
    }
    response = await clients[0].request(`/api/lobbies/${lobby.id}/start`, { expectedRevision: lobby.revision });
    expect(response.status).toBe(200); lobby = response.data.lobby;
    const peer = await clients[0].connect(lobby.matchId!);
    expect(peer.hello.side).toBe(0);
  });

  it('applies visible custom starting resources, age and population limits while rejecting malformed handicaps', async () => {
    const { directory, clients } = await setup(1);
    const handicap = { startingResources: { wood: 900, ore: 450, crystal: 160 }, incomeFactor: 1.5, populationCap: 9 };
    const players: LobbyPlayerSettings[] = [
      { factionId: 'orcs', teamId: 0, controller: 'human', handicap },
      { factionId: 'undead', teamId: 1, controller: 'ai' },
    ];
    const request = (handicap: unknown, startingAge: unknown = 3) => clients[0].request('/api/lobbies', { settings: { mapSize: 'huge', players: [{ ...players[0], handicap }, players[1]], startingAge, sharedVision: false }, seed: 4127 });
    for (const malformed of [
      null, [], { extra: true },
      { startingResources: { wood: -1, ore: 0, crystal: 0 } },
      { startingResources: { wood: 1e9 + 1, ore: 0, crystal: 0 } },
      { startingResources: { wood: 100, crystal: 0 } },
      { startingResources: { wood: '100', ore: 0, crystal: 0 } },
      { startingResources: { wood: 100, ore: 0, crystal: 0, gold: 1 } },
      { incomeFactor: -.1 }, { incomeFactor: 10.1 }, { incomeFactor: '2' }, { incomeFactor: null },
      { populationCap: 0 }, { populationCap: 501 }, { populationCap: 2.5 },
    ]) expect((await request(malformed)).status).toBe(400);
    for (const invalidAge of [0, 4, 1.5, '3']) expect((await request(handicap, invalidAge)).status).toBe(400);
    const lobby = await launch(clients, players, { startingAge: 3, sharedVision: false });
    expect(lobby.settings).toMatchObject({ startingAge: 3, sharedVision: false });
    expect(lobby.settings.players![0].handicap).toEqual(handicap);
    expect(lobby.seats[0].handicap).toEqual(handicap);
    const frame = await (await clients[0].connect(lobby.matchId!)).frame();
    expect(frame.view.sharedVision).toBe(false);
    expect(frame.view.player).toMatchObject({ wood: 900, ore: 450, crystal: 160, cap: 9 });
    expect(frame.view.player.upgrades).toEqual(['town-age', 'citadel-age']);
    const db = new DatabaseSync(join(directory, 'server.sqlite'), { readOnly: true });
    try {
      const row = db.prepare('SELECT checkpoint FROM matches WHERE id=?').get(lobby.matchId!);
      expect(row).toBeDefined();
      const saved = JSON.parse(row!.checkpoint as string) as SaveEnvelope;
      expect(saved.state.incomeFactors).toEqual([1.5, 1]);
      expect(saved.state.populationLimits[0]).toBe(9);
      expect(saved.state.players[0]).toMatchObject({ wood: 900, ore: 450, crystal: 160, cap: 9, upgrades: ['town-age', 'citadel-age'] });
    } finally { db.close(); }
  });

  it('merges shared construction events once, retains owner details and orders buffered team events by tick', () => {
    const state = createMatch({ map: { seed: 4127, size: 'huge' }, players: [
      { id: 0, factionId: 'orcs', teamId: 0, controller: 'external' },
      { id: 1, factionId: 'fairies', teamId: 0, controller: 'external' },
      { id: 2, factionId: 'dwarves', teamId: 1, controller: 'external' },
      { id: 3, factionId: 'automata', teamId: 1, controller: 'external' },
    ], rules: { sharedVision: true } });
    const builder = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
    Object.assign(builder, { x: 20.5, y: 20.5 });
    for (const side of [0, 1]) state.visible[side] = new Set([20 * state.width + 20]);
    const views = ([0, 1, 2, 3] as const).map(side => new OnlineView(side));
    state.tick = 1;
    state.events = [{ type: 'message', side: 1, x: builder.x, y: builder.y, text: 'Earlier teammate event' }];
    const buffered = views.map(view => view.observe(state).events);
    expect(buffered[0]).toEqual([]);
    expect(buffered[1]).toHaveLength(1);
    state.tick = 2;
    const construction = { type: 'build' as const, side: 0 as const, x: builder.x, y: builder.y, source: builder.id, text: 'Owner construction detail' };
    state.events = [{ ...construction }, { ...construction }];
    const frames = views.map((view, side) => {
      const frame = view.observe(state);
      return { ...frame, events: [...buffered[side], ...frame.events] };
    });
    const ownerEvents = frames[0].events;
    const alliedEvents = frames[1].events.filter(event => event.type === 'build');
    expect(ownerEvents).toHaveLength(2);
    expect(alliedEvents).toHaveLength(2);
    for (let index = 0; index < 2; index++) {
      expect(ownerEvents[index].eventId).toMatch(/^[0-9a-f-]{36}$/);
      expect(alliedEvents[index].eventId).toBe(ownerEvents[index].eventId);
      expect(ownerEvents[index]).toHaveProperty('text', construction.text);
      expect(alliedEvents[index]).not.toHaveProperty('text');
    }
    expect(ownerEvents[0].eventId).not.toBe(ownerEvents[1].eventId);
    const merged = teamObservation(frames, 0);
    expect(merged.events).toEqual([frames[1].events[0], ...ownerEvents]);
    expect(merged.events.map(event => event.tick)).toEqual([1, 2, 2]);
  });

  it('hides visible enemy and allied economy events and redacts the source of a hidden attack', () => {
    const state = createMatch({ map: { seed: 4127, size: 'huge' }, players: [
      { id: 0, factionId: 'orcs', teamId: 0, controller: 'external' },
      { id: 1, factionId: 'fairies', teamId: 0, controller: 'external' },
      { id: 2, factionId: 'dwarves', teamId: 1, controller: 'external' },
      { id: 3, factionId: 'automata', teamId: 1, controller: 'external' },
    ], rules: { sharedVision: false } });
    const victim = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
    const visibleEnemy = state.entities.find(entity => entity.side === 2 && entity.role === 'melee')!;
    const hiddenAttacker = state.entities.find(entity => entity.side === 3 && entity.role === 'melee')!;
    Object.assign(victim, { x: 20.5, y: 20.5 }); Object.assign(visibleEnemy, { x: 21.5, y: 20.5 }); Object.assign(hiddenAttacker, { x: 80.5, y: 80.5 });
    state.visible[0] = new Set([20 * state.width + 20, 20 * state.width + 21]);
    state.events = [
      { type: 'gather', side: 2, x: visibleEnemy.x, y: visibleEnemy.y, source: visibleEnemy.id, amount: 18, resource: 'ore' },
      { type: 'research', side: 2, x: visibleEnemy.x, y: visibleEnemy.y, source: visibleEnemy.id, text: 'Citadel Age complete' },
      { type: 'message', side: 2, x: visibleEnemy.x, y: visibleEnemy.y, text: 'Enemy private decision' },
      { type: 'gather', side: 1, x: victim.x, y: victim.y, amount: 12, resource: 'crystal' },
      { type: 'gather', side: 0, x: victim.x, y: victim.y, source: victim.id, amount: 12, resource: 'wood' },
      { type: 'attack', side: 3, x: hiddenAttacker.x, y: hiddenAttacker.y, source: hiddenAttacker.id, target: victim.id, text: 'Hidden attacker detail', amount: 9 },
    ];
    const frame = new OnlineView(0).observe(state);
    expect(frame.entities.some(entity => entity.id === visibleEnemy.id)).toBe(true);
    expect(frame.entities.some(entity => entity.id === hiddenAttacker.id)).toBe(false);
    expect(frame.events).toHaveLength(2);
    expect(frame.events[0]).toMatchObject({ type: 'gather', side: 0, source: victim.id, amount: 12, resource: 'wood' });
    expect(frame.events[1]).toMatchObject({ type: 'attack', x: victim.x, y: victim.y, target: victim.id, amount: 9 });
    for (const field of ['source', 'side', 'text']) expect(frame.events[1]).not.toHaveProperty(field);
  });
});
