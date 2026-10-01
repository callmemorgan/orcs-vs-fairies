import { WebSocket } from 'ws';
import { open, readFile, lstat } from 'node:fs/promises';
import assert from 'node:assert/strict';

// node scripts/server/team-smoke.mjs ORIGIN [--save PRIVATE_FILE | --resume PRIVATE_FILE]
// Saving leaves the match active. Resume after restarting the same server data volume.
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:8787').origin;
const mode = process.argv[3];
const savedFile = process.argv[4];
assert(['http:', 'https:'].includes(new URL(origin).protocol), 'Use an HTTP(S) origin.');
assert(mode === undefined || mode === '--save' || mode === '--resume', 'Use --save or --resume.');
assert(process.argv.length <= 5, 'Unexpected smoke arguments.');
if (mode) assert(savedFile, `Provide a private state file after ${mode}.`);

const sides = Array.from({ length: 8 }, (_, side) => side);
const factions = ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata', 'orcs', 'fairies'];
const resourceKeys = ['wood', 'ore', 'crystal'];
const privateEntityKeys = [
  'order', 'orderQueue', 'queue', 'rally', 'trainProgress', 'research', 'researchProgress',
  'carried', 'carriedKind', 'cooldown', 'abilityReadyAt', 'expires', 'lastDamagedAt',
];

class Client {
  cookie = '';
  accountId = '';
  lastClientSeq = 0;

  async request(path, value) {
    const response = await fetch(origin + path, {
      method: value === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
      signal: AbortSignal.timeout(15000),
    });
    const cookie = response.headers.get('set-cookie');
    if (cookie) this.cookie = cookie.split(';')[0];
    const data = await response.json();
    assert(response.ok, `${path}: ${response.status} ${data.error ?? ''}`);
    return data;
  }

  async connect(matchId, options = { role: 'player' }) {
    const { ticket } = await this.request(`/api/matches/${matchId}/ticket`, options);
    const url = new URL('/ws', origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('ticket', ticket);
    return new Peer(url, this.cookie);
  }
}

class Peer {
  messages = [];
  waiters = [];
  failure = null;

  constructor(url, cookie) {
    this.ws = new WebSocket(url, { headers: { Cookie: cookie, Origin: origin } });
    this.ws.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); }
      catch { this.fail(new Error('The server sent invalid JSON.')); return; }
      const waiter = this.waiters.find(item => item.predicate(message));
      if (waiter) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      } else if (message.kind === 'error') {
        this.fail(new Error(`Server error ${message.code}: ${message.message}`));
      } else {
        // A two-minute spectator delay should not accumulate hundreds of huge maps.
        if (message.kind === 'snapshot') {
          this.messages = this.messages.filter(item => item.kind !== 'snapshot');
        }
        this.messages.push(message);
      }
    });
    this.ws.on('error', error => this.fail(error));
    this.ws.on('close', code => this.fail(new Error(`The socket closed (${code}).`)));
  }

  fail(error) {
    this.failure ??= error;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  next(predicate, timeoutMs = 15000) {
    const index = this.messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate, resolve, reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter(item => item !== waiter);
          reject(new Error('Network receipt timed out.'));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  send(message) { this.ws.send(JSON.stringify(message)); }

  async command(clientSeq, command, observedTick = 0) {
    const receipt = this.next(message => message.kind === 'commandAck' && message.clientSeq === clientSeq);
    this.send({ kind: 'command', protocolVersion: 1, clientSeq, observedTick, command });
    return receipt;
  }

  close() { this.ws.terminate(); }
}

function bank(view) {
  return Object.fromEntries(resourceKeys.map(key => [key, view.player[key]]));
}

function assertPlayerPrivacy(frame, side) {
  const { view } = frame;
  assert.equal(view.side, side);
  assert.equal(view.teamId, side < 4 ? 0 : 1);
  assert.equal(view.player.faction, factions[side]);
  assert.equal(view.sharedVision, true);
  assert.equal(view.map.size, 'huge');
  assert.equal(view.map.starts.length, 8);
  assert(!Object.hasOwn(view.map, 'seed'), 'A player received the map seed.');
  assert(!Object.hasOwn(view, 'teamPlayers'), 'A player received teammate banks.');
  assert(!Object.hasOwn(view, 'players'), 'A player received all player banks.');
  assert(!view.teamPerspective, 'A player received a team spectator view.');
  assert.deepEqual(view.allies.map(player => player.side).sort((a, b) => a - b),
    sides.filter(member => member !== side && (member < 4) === (side < 4)));
  for (const player of [...view.allies, ...view.opponents]) {
    for (const key of [...resourceKeys, 'population', 'cap', 'upgrades']) {
      assert(!Object.hasOwn(player, key), `Side ${side} received side ${player.side}'s ${key}.`);
    }
  }
  for (const entity of view.entities.filter(entity => entity.side !== side)) {
    for (const key of privateEntityKeys) {
      assert(!Object.hasOwn(entity, key), `Side ${side} received side ${entity.side}'s ${key}.`);
    }
  }
  for (const member of sides.filter(member => (member < 4) === (side < 4))) {
    assert(view.entities.some(entity => entity.side === member && entity.role === 'hq'),
      `Shared vision did not include side ${member}'s HQ for side ${side}.`);
  }
}

async function matchSummary(client, matchId) {
  const summary = (await client.request('/api/matches')).matches.find(match => match.id === matchId);
  assert(summary, 'The session lost its match.');
  assert.equal(summary.failed, false, 'The match paused after a server failure.');
  return summary;
}

async function connectPlayers(clients, matchId, peers) {
  // Retain each opened socket immediately so any later failure still closes it.
  for (const client of clients) peers.push(await client.connect(matchId));
  const hellos = await Promise.all(peers.map(peer => peer.next(message => message.kind === 'hello')));
  hellos.forEach((hello, side) => {
    assert.equal(hello.protocolVersion, 1);
    assert.equal(hello.matchId, matchId);
    assert.equal(hello.role, 'player');
    assert.equal(hello.side, side);
    assert.equal(hello.delayTicks, 0);
    assert.equal(hello.lastClientSeq, clients[side].lastClientSeq);
    assert(hello.generation > 0);
  });
  return Promise.all(peers.map(peer => peer.next(message => message.kind === 'snapshot')));
}

async function issue(client, peer, command, observedTick = 0) {
  const ack = await peer.command(client.lastClientSeq + 1, command, observedTick);
  client.lastClientSeq = ack.clientSeq;
  return ack;
}

async function assertTeamSpectator(client, matchId, peers) {
  const spectator = await client.connect(matchId, { role: 'spectator', perspective: 7, view: 'team' });
  peers.push(spectator);
  const hello = await spectator.next(message => message.kind === 'hello');
  assert.equal(hello.role, 'spectator');
  assert.equal(hello.side, 7);
  assert.equal(hello.perspective, 'team');
  assert(Number.isInteger(hello.delayTicks) && hello.delayTicks >= 0 && hello.delayTicks <= 2400);
  console.log(JSON.stringify({ step: 'waiting-for-team-spectator', delayTicks: hello.delayTicks }));
  const frame = await spectator.next(message => message.kind === 'snapshot', hello.delayTicks * 50 + 45000);
  assert.equal(frame.view.side, 7);
  assert.equal(frame.view.teamId, 1);
  assert.equal(frame.view.teamPerspective, true);
  assert.deepEqual(frame.view.teamPlayers.map(player => player.side), [4, 5, 6, 7]);
  assert.deepEqual(frame.view.teamPlayers.find(player => player.side === 7).player, frame.view.player);
  for (const side of [4, 5, 6, 7]) {
    const hq = frame.view.entities.find(entity => entity.side === side && entity.role === 'hq');
    assert(hq && Array.isArray(hq.queue), `The delayed team view omitted side ${side}'s own queue.`);
  }
  const summary = await matchSummary(client, matchId);
  assert.equal(summary.finished, false);
  assert(frame.tick <= summary.tick - hello.delayTicks, 'The team spectator received a frame before its delay cutoff.');
  const forbidden = spectator.next(message => message.kind === 'error' || message.kind === 'commandAck');
  spectator.send({ kind: 'command', protocolVersion: 1, clientSeq: 1, observedTick: frame.tick, command: { type: 'surrender' } });
  const rejection = await forbidden;
  assert.equal(rejection.kind, 'error', 'The spectator received a command receipt.');
  assert.equal(rejection.code, 'spectator');
  spectator.close();
  return { delayTicks: hello.delayTicks, spectatorTick: frame.tick, authoritativeTick: summary.tick };
}

async function surrenderTeam(clients, peers, matchId) {
  for (const side of [4, 5, 6, 7]) {
    const ack = await issue(clients[side], peers[side], { type: 'surrender' });
    assert.equal(ack.accepted, true, `Side ${side}'s surrender was rejected.`);
    if (side !== 7) {
      const frame = await peers[side].next(message => message.kind === 'snapshot' && message.tick >= ack.appliedTick);
      assert.equal(frame.view.result.finished, false, 'The team lost while a teammate still had an HQ.');
      for (const surrendered of sides.filter(member => member >= 4 && member <= side)) {
        assert.equal(frame.view.result.eliminated[surrendered], true);
      }
    }
  }
  const frames = await Promise.all(peers.slice(0, 8).map(peer => peer.next(message =>
    message.kind === 'snapshot' && message.view.result.finished)));
  frames.forEach((frame, side) => {
    assert.equal(frame.view.side, side);
    assert.equal(frame.view.result.winningTeam, 0);
    assert.equal(frame.view.result.draw, false);
    assert.equal(frame.view.result.outcome, side < 4 ? 'win' : 'loss');
    assert.deepEqual(frame.view.result.eliminated, [false, false, false, false, true, true, true, true]);
  });
  assert.equal((await matchSummary(clients[0], matchId)).finished, true);
  return frames[0].tick;
}

async function savePrivateState(value) {
  // Refuse an existing path so an old file's permissions or a symlink cannot expose cookies.
  const file = await open(savedFile, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(value)); }
  finally { await file.close(); }
  assert.equal((await lstat(savedFile)).mode & 0o777, 0o600);
}

async function resume() {
  const file = await lstat(savedFile);
  assert(file.isFile() && (file.mode & 0o777) === 0o600, 'The saved state must be a private regular file with mode 0600.');
  const saved = JSON.parse(await readFile(savedFile, 'utf8'));
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.clients.length, 8);
  assert.equal(saved.lobby.matchId, saved.matchId);
  assert.equal(saved.ack.accepted, true);
  const clients = saved.clients.map((stored, side) => {
    assert.equal(stored.side, side);
    assert.equal(typeof stored.cookie, 'string');
    assert(stored.cookie.startsWith('ovf_session='));
    assert(Number.isInteger(stored.lastClientSeq) && stored.lastClientSeq >= 0);
    const client = new Client();
    client.cookie = stored.cookie;
    client.accountId = stored.accountId;
    client.lastClientSeq = stored.lastClientSeq;
    return client;
  });
  await Promise.all(clients.map(async client => {
    assert.equal((await client.request('/api/session')).account?.id, client.accountId);
  }));
  const { lobby } = await clients[0].request(`/api/lobbies/${saved.lobby.id}`);
  assert.equal(lobby.matchId, saved.matchId);
  assert.deepEqual(lobby.seats.map(seat => seat.account?.id), clients.map(client => client.accountId));
  assert.equal((await matchSummary(clients[0], saved.matchId)).finished, false);
  const peers = [];
  try {
    const frames = await connectPlayers(clients, saved.matchId, peers);
    frames.forEach((frame, side) => {
      assert(frame.tick >= saved.tick, 'A restarted match went backwards.');
      assertPlayerPrivacy(frame, side);
    });
    assert.deepEqual(bank(frames[7].view), saved.bank, 'Side 7 resources changed while its human workers were idle.');
    assert.deepEqual(await peers[7].command(saved.ack.clientSeq, saved.command, saved.tick), saved.ack);
    const afterDuplicate = await peers[7].next(message => message.kind === 'snapshot' && message.tick > frames[7].tick);
    assert.deepEqual(bank(afterDuplicate.view), saved.bank, 'The recovered duplicate charged side 7 twice.');
    const tick = await surrenderTeam(clients, peers, saved.matchId);
    console.log(JSON.stringify({
      ok: true, path: 'production-eight-client-restart', tick,
      sessionsPreserved: 8, seatsPreserved: 8, receiptPreserved: true,
      duplicateSpentOnce: true, winningTeam: 0, teamOutcomesVerified: 8,
    }));
  } finally { peers.forEach(peer => peer.close()); }
}

async function create() {
  const clients = sides.map(() => new Client());
  for (const [side, client] of clients.entries()) {
    const { account } = await client.request('/api/auth/guest', { username: `TeamSmoke${side}` });
    client.accountId = account.id;
    assert(client.cookie, 'A guest session was not issued.');
  }
  let { lobby } = await clients[0].request('/api/lobbies', {
    seed: 4127,
    settings: {
      mapSize: 'huge', factions, sharedVision: true,
      players: factions.map((factionId, side) => ({ factionId, teamId: side < 4 ? 0 : 1, controller: 'human' })),
    },
  });
  for (const client of clients.slice(1)) {
    ({ lobby } = await client.request(`/api/lobbies/${lobby.id}/join`, { expectedRevision: lobby.revision }));
  }
  assert.equal(lobby.seats.length, 8);
  assert.deepEqual(lobby.seats.map(seat => seat.side), sides);
  assert.deepEqual(lobby.seats.map(seat => seat.account?.id), clients.map(client => client.accountId));
  for (const client of clients) {
    ({ lobby } = await client.request(`/api/lobbies/${lobby.id}/ready`, { expectedRevision: lobby.revision, ready: true }));
  }
  ({ lobby } = await clients[0].request(`/api/lobbies/${lobby.id}/start`, { expectedRevision: lobby.revision }));
  assert(lobby.matchId, 'The lobby did not start a match.');
  const peers = [];
  try {
    const frames = await connectPlayers(clients, lobby.matchId, peers);
    frames.forEach(assertPlayerPrivacy);
    const foreignWorker = frames[7].view.entities.find(entity => entity.side === 7 && entity.role === 'worker');
    assert(foreignWorker, 'Side 7 did not have a worker.');
    const foreignAck = await issue(clients[0], peers[0], { type: 'move', ids: [foreignWorker.id], x: 10, y: 10 });
    assert.equal(foreignAck.accepted, false);
    assert.equal(foreignAck.reason, 'ownership');
    const hq = frames[7].view.entities.find(entity => entity.side === 7 && entity.role === 'hq');
    assert(hq && Array.isArray(hq.queue));
    assert.equal(hq.queue.length, 0);
    const command = { type: 'train', id: hq.id, role: 'worker' };
    const ack = await issue(clients[7], peers[7], command, frames[7].tick);
    assert.equal(ack.accepted, true);
    assert.deepEqual(await peers[7].command(ack.clientSeq, command, frames[7].tick), ack);
    const after = await Promise.all(peers.map(peer => peer.next(message =>
      message.kind === 'snapshot' && message.tick >= ack.appliedTick)));
    after.forEach(assertPlayerPrivacy);
    const cost = frames[7].view.content.faction.units.worker.cost;
    const expectedBank = Object.fromEntries(resourceKeys.map(key => [key, frames[7].view.player[key] - cost[key]]));
    assert.deepEqual(bank(after[7].view), expectedBank, 'The paid command did not spend its cost once.');
    assert.deepEqual(after[7].view.entities.find(entity => entity.id === hq.id).queue, ['worker']);
    const hiddenQueue = after[4].view.entities.find(entity => entity.id === hq.id);
    assert(hiddenQueue, 'Side 4 did not observe its allied side 7 HQ.');
    assert(!Object.hasOwn(hiddenQueue, 'queue'), 'The ally received the paid training queue.');
    if (mode === '--save') {
      await savePrivateState({
        schemaVersion: 1, origin, lobby, matchId: lobby.matchId, command, ack,
        tick: after[7].tick, bank: expectedBank,
        clients: clients.map((client, side) => ({
          side, cookie: client.cookie, accountId: client.accountId, lastClientSeq: client.lastClientSeq,
        })),
      });
      assert.equal((await matchSummary(clients[0], lobby.matchId)).finished, false);
      console.log(JSON.stringify({
        ok: true, path: 'production-eight-clients-saved', tick: after[7].tick,
        connectedPlayers: 8, ownershipRejected: true, alliedPrivateStateHidden: true,
        duplicateSpentOnce: true, privateStateSaved: true, matchLeftActive: true,
      }));
    } else {
      const spectator = await assertTeamSpectator(clients[0], lobby.matchId, peers);
      const tick = await surrenderTeam(clients, peers, lobby.matchId);
      console.log(JSON.stringify({
        ok: true, path: 'production-eight-clients', tick, connectedPlayers: 8,
        ownershipRejected: true, alliedPrivateStateHidden: true, duplicateSpentOnce: true,
        teamSpectator: spectator, spectatorCommandsRejected: true,
        winningTeam: 0, teamOutcomesVerified: 8,
      }));
    }
  } finally { peers.forEach(peer => peer.close()); }
}

await (mode === '--resume' ? resume() : create());
