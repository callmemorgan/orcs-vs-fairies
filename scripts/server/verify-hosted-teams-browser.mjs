import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

// Production browser driver. Accounts, roster, readiness, entry, F2/Stop and
// spectator mode use native controls. Rejected ownership and resource transfer
// use ordinary public commands on the page's authenticated native WebSocket.
// No GameState, core runtime, winner, account cookie or callback is injected.
// A direct wire probe is last on its player connection; rejoin is required before
// sending another native command because the UI owns its private next sequence.

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sorted = values => [...values].sort((a, b) => a - b);
const bank = player => ({ wood: player.wood, ore: player.ore, crystal: player.crystal });
const privateFields = ['order', 'orderQueue', 'queue', 'queueDefinitionIds', 'queuePaidCosts', 'rally', 'trainProgress', 'research', 'researchProgress', 'carried', 'carriedKind', 'cooldown', 'abilityReadyAt', 'expires', 'lastDamagedAt', 'veteran', 'equipment', 'specialistBuffs', 'beacon', 'siegeMode', 'path'];
export const layouts = [2, 3, 4].map(size => ({
  name: `${size}v${size}`, mapSize: 'huge', startingAge: 1, sharedVision: true,
  players: Array.from({ length: size * 2 }, (_, side) => ({
    factionId: side < size ? 'orcs' : 'fairies', teamId: side < size ? 0 : 1, controller: 'human',
    handicap: { startingResources: { wood: 1000 + side * 137, ore: 700 + side * 31, crystal: 43 + side * 7 }, incomeFactor: 0 },
  })),
}));
export const cooperativeLayout = {
  name: 'two-human-cooperative-vs-two-ai', mapSize: 'large', startingAge: 3, sharedVision: true,
  players: [
    { factionId: 'orcs', teamId: 0, controller: 'human', handicap: { startingResources: { wood: 1000, ore: 700, crystal: 43 }, incomeFactor: 0 } },
    { factionId: 'fairies', teamId: 0, controller: 'human', handicap: { startingResources: { wood: 1137, ore: 731, crystal: 50 }, incomeFactor: 0 } },
    ...[2, 3].map(() => ({ factionId: 'undead', teamId: 1, controller: 'ai', handicap: { startingResources: { wood: 10000, ore: 10000, crystal: 1000 }, incomeFactor: 1, populationCap: 100 } })),
  ],
};

async function poll(read, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await read(); if (value) return value; await sleep(40); }
  throw new Error(`Timed out waiting for ${label}`);
}
async function enabled(locator) { await locator.waitFor({ state: 'visible' }); await poll(() => locator.isEnabled(), 'enabled native control'); }
async function http(actor, base, path, data) {
  const response = await actor.context.request[data === undefined ? 'get' : 'post'](base + path, { failOnStatusCode: false, timeout: 20000, ...(data === undefined ? {} : { data }) });
  try { return { status: response.status(), data: await response.json() }; } finally { await response.dispose(); }
}
async function bounded(promise, milliseconds, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds}ms`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function uiResponse(page, method, path, action, preparatoryPath) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let captured, preparing, mutations = 0;
    const capture = request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === path && request.method() === method) { captured ??= request; mutations++; }
      if (preparatoryPath && pathname === preparatoryPath && request.method() === 'GET') preparing ??= request;
    };
    page.on('request', capture);
    try {
      await action();
      const until = Date.now() + 1500;
      while (!captured && !preparing && Date.now() < until) await sleep(20);
      const evidence = { method, path, attempt, requested: !!captured, preparatoryRequested: !!preparing };
      page.__hostedTeamUiActions?.push(evidence);
      if (!captured && !preparing) continue;
      if (preparing) {
        const response = await bounded(preparing.response(), 30000, `GET ${preparatoryPath} preparation`);
        assert(response); evidence.preparationStatus = response.status(); assert.equal(response.status(), 200);
      }
      if (!captured) await poll(() => captured, `${method} ${path} after preparation`, 30000);
      evidence.requested = true;
      const response = await bounded(captured.response(), 30000, `${method} ${path} response`);
      assert(response); evidence.status = response.status();
      const data = await response.json(); evidence.mutations = mutations;
      if (method === 'GET') assert(mutations >= 1, 'Native GET action must issue at least one observed request');
      else assert.equal(mutations, 1);
      return { status: response.status(), data };
    } finally { page.off('request', capture); }
  }
  throw new Error(`${method} ${path} issued no native request after three clicks`);
}
async function saveEvidence(directory, label, value, details = {}) {
  const bytes = Buffer.from(JSON.stringify(value) + '\n'), compressed = gzipSync(bytes), filename = `${label}.json.gz`;
  await writeFile(join(directory, filename), compressed);
  return { path: `native-browser/${filename}`, sha256: hash(bytes), bytes: bytes.length, gzipSha256: hash(compressed), gzipBytes: compressed.length, ...details };
}
async function saveFrame(directory, label, frame) { return saveEvidence(directory, label, frame, { tick: frame.tick, side: frame.view.side }); }
async function screenshot(actor, directory, label, target) {
  const filename = `${label}-${actor.name}.png`;
  try { await actor.page.screenshot({ path: join(directory, filename) }); target.push({ actor: actor.name, phase: label, path: `native-browser/${filename}` }); }
  catch (error) { target.push({ actor: actor.name, phase: label, error: error.message }); }
}
async function profile(browser, base, name, errors, cookies, appDirectory) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  if (cookies) await context.addCookies(cookies);
  await context.addInitScript(() => {
    const Native = window.WebSocket;
    window.__hostedTeamWire = { connections: [], parseErrors: [] };
    window.WebSocket = class extends Native {
      constructor(url, protocols) {
        if (protocols === undefined) super(url); else super(url, protocols);
        const entry = { socket: this, hello: null, commands: [] };
        window.__hostedTeamWire.connections.push(entry); this.__hostedTeamEntry = entry;
        this.addEventListener('message', event => { if (typeof event.data !== 'string') return; try { const value = JSON.parse(event.data); if (value.kind === 'hello') entry.hello = value; } catch (error) { window.__hostedTeamWire.parseErrors.push({ direction: 'received', message: error.message }); } });
      }
      send(value) { try { const parsed = JSON.parse(value); if (parsed.kind === 'command') this.__hostedTeamEntry.commands.push(parsed); } catch (error) { window.__hostedTeamWire.parseErrors.push({ direction: 'sent', message: error.message }); } return super.send(value); }
    };
  });
  const page = await context.newPage(), actor = { name, context, page, hellos: [], sent: [], receipts: [], errors: [], actions: [], assets: [], frames: new Map(), screenshots: [] };
  page.__hostedTeamUiActions = actor.actions;
  page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => errors.push({ name, message: error.message }));
  page.on('websocket', socket => {
    socket.on('framesent', event => { try { const message = JSON.parse(event.payload); if (message.kind === 'command') actor.sent.push(message); } catch (error) { errors.push({ name, direction: 'sent', message: error.message }); } });
    socket.on('framereceived', event => { try {
      const message = JSON.parse(event.payload);
      if (message.kind === 'hello') { actor.hellos.push(message); actor.currentWire = socket; actor.frames.clear(); }
      if (message.kind === 'commandAck') actor.receipts.push(message);
      if (message.kind === 'error') actor.errors.push(message);
      if (message.kind === 'snapshot' && actor.currentWire === socket) { actor.frames.set(message.tick, message); while (actor.frames.size > 120) actor.frames.delete(actor.frames.keys().next().value); }
    } catch (error) { errors.push({ name, direction: 'received', message: error.message }); } });
  });
  const assetTasks = []; actor.assetTasks = assetTasks;
  const compareAsset = async (response, pathname) => {
    assert.equal(response.status(), 200, `${name} loaded ${pathname}`);
    const filename = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const resolved = resolve(appDirectory, filename); assert(!relative(appDirectory, resolved).startsWith('..'));
    const [loaded, expected] = await Promise.all([response.body(), readFile(resolved)]);
    assert.equal(hash(loaded), hash(expected), `${name} served ${pathname} differs from built package`);
    actor.assets.push({ path: pathname, sha256: hash(loaded), bytes: loaded.length, resourceType: response.request().resourceType() });
  };
  page.on('response', response => {
    const url = new URL(response.url());
    if (appDirectory && url.origin === new URL(base).origin && response.request().resourceType() === 'script') {
      const task = compareAsset(response, url.pathname); task.catch(() => {}); assetTasks.push(task);
    }
  });
  try {
    const response = await page.goto(base, { waitUntil: 'domcontentloaded' }); assert(response);
    if (appDirectory) await compareAsset(response, '/');
    await page.locator('.begin-match').waitFor({ state: 'visible' });
    if (appDirectory) {
      await Promise.all(assetTasks);
      const modules = await page.locator('script[type="module"][src]').evaluateAll(nodes => nodes.map(node => new URL(node.src).pathname));
      assert(modules.length > 0, 'Native index must load a module');
      for (const path of modules) assert(actor.assets.some(asset => asset.path === path && asset.resourceType === 'script'), `No actual native module response captured for ${path}`);
    }
    return actor;
  } catch (error) {
    if (appDirectory) await screenshot(actor, join(appDirectory, '..', 'native-browser'), 'failure-profile', actor.screenshots);
    errors.push({ name, phase: 'profile', message: error.message, screenshots: actor.screenshots });
    await context.close(); throw error;
  }
}
async function online(actor) {
  const dialog = actor.page.getByRole('dialog', { name: 'Online play', exact: true });
  if (!(await dialog.isVisible())) { await enabled(actor.page.locator('.online-open')); await actor.page.locator('.online-open').click(); }
  await enabled(dialog.locator('[data-online="refresh"]')); return dialog;
}
async function guest(actor, base) {
  await actor.page.locator('.online-open').click();
  const dialog = actor.page.getByRole('dialog', { name: 'Online play', exact: true }), button = dialog.locator('[data-online="guest"]');
  await enabled(button);
  const result = await uiResponse(actor.page, 'POST', '/api/auth/guest', () => button.click()); assert.equal(result.status, 200);
  actor.account = result.data.account;
  await actor.page.waitForFunction(name => document.querySelector('.online-username')?.textContent === name, actor.account.username);
  await enabled(dialog.locator('[data-online="refresh"]'));
  assert.equal((await http(actor, base, '/api/session')).data.account.id, actor.account.id);
}
async function refresh(actor) {
  const dialog = await online(actor), button = dialog.locator('[data-online="refresh"]'); await enabled(button);
  const result = await uiResponse(actor.page, 'GET', '/api/lobbies', () => button.click()); assert.equal(result.status, 200);
  await enabled(button); return result.data.lobbies;
}
async function configureNative(actor, layout) {
  const dialog = await online(actor);
  await dialog.getByLabel('Lobby player count', { exact: true }).selectOption(String(layout.players.length));
  await dialog.getByLabel('Lobby map size', { exact: true }).selectOption(layout.mapSize);
  await dialog.getByLabel('Lobby starting age', { exact: true }).selectOption(String(layout.startingAge));
  await dialog.getByLabel('Lobby shared vision', { exact: true }).setChecked(layout.sharedVision);
  for (const [side, player] of layout.players.entries()) {
    const row = dialog.locator(`.online-create [data-player="${side}"]`);
    await row.locator('[data-field="faction"]').selectOption(player.factionId);
    await row.locator('[data-field="team"]').selectOption(String(player.teamId));
    await row.locator('[data-field="controller"]').selectOption(player.controller);
    await row.locator('details > summary').click();
    for (const [field, value] of Object.entries({ ...player.handicap.startingResources, income: player.handicap.incomeFactor, population: player.handicap.populationCap ?? 100 })) await row.locator(`[data-field="${field}"]`).fill(String(value));
  }
  const result = await uiResponse(actor.page, 'POST', '/api/lobbies', () => dialog.getByRole('button', { name: 'Create lobby', exact: true }).click());
  assert.equal(result.status, 201); const lobby = result.data.lobby;
  assert.equal(lobby.settings.players.length, layout.players.length);
  for (const [side, expected] of layout.players.entries()) {
    const actual = lobby.settings.players[side]; assert.equal(actual.factionId, expected.factionId); assert.equal(actual.teamId, expected.teamId); assert.equal(actual.controller, expected.controller);
    assert.deepEqual(actual.handicap.startingResources, expected.handicap.startingResources); assert.equal(actual.handicap.incomeFactor ?? 1, expected.handicap.incomeFactor);
  }
  await enabled(dialog.locator('[data-online="ready"]'));
  assert.equal(await dialog.locator('[data-online="start"]').isDisabled(), true);
  return lobby;
}
async function mutate(actor, lobbyId, action) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await refresh(actor); const dialog = await online(actor);
    const button = action === 'join' ? dialog.getByRole('button', { name: `Join lobby ${lobbyId}`, exact: true }) : dialog.locator(`[data-online="${action}"]`);
    await enabled(button);
    const result = await uiResponse(actor.page, 'POST', `/api/lobbies/${lobbyId}/${action}`, () => button.click(), action === 'join' ? `/api/lobbies/${lobbyId}` : undefined);
    if (result.status === 409) { await enabled(dialog.locator('[data-online="refresh"]')); continue; }
    assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data.lobby;
  }
  throw new Error(`${actor.name}: ${action} exhausted native revision retries`);
}
async function battlefield(actor, matchId, side, role = 'player', options = {}) {
  await actor.page.waitForFunction(expected => {
    const r = window.rts, connections = window.__hostedTeamWire?.connections ?? [];
    const entry = connections.findLast((row, index) => index >= expected.afterConnectionCount && row.socket.readyState === WebSocket.OPEN && row.hello?.matchId === expected.matchId && row.hello.side === expected.side && row.hello.role === expected.role && (expected.perspective === undefined || row.hello.perspective === expected.perspective));
    return document.querySelector('.online-overlay')?.hidden === true && entry && r?.mode === 'online' && r.online?.status === 'connected' && r.viewSide === expected.side && r.online.role === expected.role && !r.simulationEnabled && r.art.loaded && r.fps > 0;
  }, { matchId, side, role, afterConnectionCount: options.afterConnectionCount ?? 0, perspective: options.perspective }, { timeout: 60000 });
  const hello = await poll(() => actor.hellos.slice(options.afterHelloCount ?? 0).findLast(row => row.matchId === matchId && row.side === side && row.role === role && (options.perspective === undefined || row.perspective === options.perspective)), 'actual new native hello');
  assert.equal(await actor.page.locator('#game-canvas > canvas').count(), 1); actor.side = side; actor.matchId = matchId; return hello;
}
async function connectionBoundary(actor) { return { afterHelloCount: actor.hellos.length, afterConnectionCount: await actor.page.evaluate(() => window.__hostedTeamWire.connections.length) }; }
async function enter(actor, lobbyId, matchId, side) {
  await refresh(actor); const dialog = await online(actor), button = dialog.getByRole('button', { name: `Rejoin match ${lobbyId}`, exact: true }); await enabled(button);
  const boundary = await connectionBoundary(actor);
  await button.click(); return battlefield(actor, matchId, side, 'player', boundary);
}
async function receipt(actor, sent) {
  return poll(() => actor.receipts.findLast(row => row.clientSeq === sent.clientSeq), `${actor.name} durable command receipt`);
}
async function stopNative(actor) {
  await actor.page.keyboard.press('F2');
  await actor.page.waitForFunction(() => window.rts.selected.length > 0 && window.rts.selected.every(id => window.rts.state.entities.some(e => e.id === id && e.side === window.rts.viewSide && e.kind === 'unit' && e.role !== 'worker')));
  const before = actor.sent.length; await actor.page.keyboard.press('x');
  const sent = await poll(() => actor.sent.slice(before).find(row => row.command.type === 'stop'), 'native F2 + Stop command');
  const ack = await receipt(actor, sent); assert.equal(ack.accepted, true); return { sent, ack };
}
async function sendPublic(actor, protocolVersion, command, role = 'player') {
  const sent = await actor.page.evaluate(({ matchId, protocolVersion, command, role }) => {
    const entry = [...window.__hostedTeamWire.connections].reverse().find(row => row.hello?.matchId === matchId && row.hello.role === role && row.socket.readyState === WebSocket.OPEN);
    if (!entry) throw new Error('No authenticated native match connection');
    const sequence = Math.max(entry.hello.lastClientSeq, ...entry.commands.map(row => row.clientSeq)) + 1;
    const envelope = { kind: 'command', protocolVersion, clientSeq: sequence, observedTick: window.rts.state.tick, command };
    entry.socket.send(JSON.stringify(envelope)); return envelope;
  }, { matchId: actor.matchId, protocolVersion, command, role });
  if (role === 'spectator') return { sent };
  return { sent, ack: await receipt(actor, sent) };
}
async function futureCommon(actors, afterTick = Math.max(...actors.map(actor => Math.max(-1, ...actor.frames.keys()))) + 4) {
  try {
    return await poll(() => {
      const tick = [...actors[0].frames.keys()].sort((a, b) => a - b).find(tick => tick >= afterTick && actors.every(actor => actor.frames.has(tick)));
      return tick === undefined ? null : { tick, frames: actors.map(actor => actor.frames.get(tick)) };
    }, 'future common authoritative frame');
  } catch (error) {
    error.message += `; required >= ${afterTick}; captured ${JSON.stringify(actors.map(actor => ({ name: actor.name, ticks: [...actor.frames.keys()] })))}`;
    throw error;
  }
}
function checkPlayerFrame(frame, layout, side) {
  const view = frame.view; assert.equal(view.side, side); assert.equal(view.controller, layout.players[side].controller === 'human' ? 'external' : 'ai');
  assert.equal(view.teamId, layout.players[side].teamId); assert.equal(view.sharedVision, true);
  for (const key of ['players', 'teamPlayers', 'teamPerspective']) assert.equal(Object.hasOwn(view, key), false, `Normal frame disclosed ${key}`);
  assert.equal(Object.hasOwn(view.map, 'seed'), false);
  for (const member of [...view.allies, ...view.opponents]) assert.deepEqual(Object.keys(member).sort(), ['faction', 'side', 'teamId']);
  if (view.alliedAi) {
    assert.deepEqual(Object.keys(view.alliedAi).sort(), ['allies', 'directives', 'transfers']);
    for (const ally of view.alliedAi.allies) assert.deepEqual(Object.keys(ally).sort(), ['faction', 'side']);
    for (const directive of view.alliedAi.directives) for (const key of ['assigned', 'assignedIds', 'coordinator', 'players', 'bank']) assert.equal(Object.hasOwn(directive, key), false);
  }
  assert.deepEqual(sorted(view.allies.map(row => row.side)), layout.players.flatMap((p, s) => p.teamId === view.teamId && s !== side ? [s] : []));
  for (const entity of view.entities.filter(row => row.side !== side)) for (const key of privateFields) assert.equal(Object.hasOwn(entity, key), false, `Foreign entity ${entity.id} disclosed ${key}`);
  for (const [member, settings] of layout.players.entries()) if (settings.teamId === view.teamId) assert(view.entities.some(entity => entity.kind === 'building' && entity.role === 'hq' && entity.side === member), `Shared vision omitted team member ${member}'s headquarters`);
  return { side, tick: frame.tick, bank: bank(view.player), controller: view.controller, allies: view.allies, visibleTiles: view.visible.length, exploredTiles: view.explored.length };
}
async function renderer(actor, layout, privateSides = [actor.side]) {
  // A snapshot can arrive between separate wait and capture calls while the HUD
  // still shows the prior bank. Check coherence and capture in one JS turn.
  const value = await poll(() => actor.page.evaluate(() => {
    const r = window.rts, player = r?.state?.players[r.viewSide]; if (!player) return null;
    const hud = Object.fromEntries(['wood', 'ore', 'crystal'].map(key => [key, document.querySelector(`#${key}`)?.textContent]));
    if (!['wood', 'ore', 'crystal'].every(key => hud[key] === String(Math.floor(player[key])))) return null;
    return { tick: r.state.tick, time: r.state.time, side: r.viewSide, mode: r.mode, simulationEnabled: r.simulationEnabled, readOnly: r.readOnly, privateSides: r.online.privateSides, seed: r.state.seed, teams: r.state.teams, players: r.state.players, entities: r.state.entities, hud, diagnosticSetter: typeof Object.getOwnPropertyDescriptor(window, 'rts')?.set };
  }), 'coherent HUD and native renderer state');
  const frame = await poll(() => actor.frames.get(value.tick), 'render tick captured from native wire');
  assert.equal(value.mode, 'online'); assert.equal(value.simulationEnabled, false); assert.equal(value.diagnosticSetter, 'undefined'); assert.equal(value.seed, 0);
  assert.deepEqual(value.teams, layout.players.map(p => p.teamId)); assert.deepEqual(sorted(value.privateSides), sorted(privateSides));
  const disclosed = new Map([[frame.view.side, frame.view.player], ...(frame.view.teamPlayers ?? []).map(row => [row.side, row.player])]);
  for (const [side, player] of value.players.entries()) {
    if (privateSides.includes(side)) assert.deepEqual(bank(player), bank(disclosed.get(side)));
    else assert.deepEqual(bank(player), { wood: 0, ore: 0, crystal: 0 });
  }
  for (const key of ['wood', 'ore', 'crystal']) assert.equal(value.hud[key], String(Math.floor(disclosed.get(value.side)[key])));
  for (const entity of value.entities.filter(row => !privateSides.includes(row.side))) { assert.deepEqual(entity.order, { type: 'idle' }); assert.deepEqual(entity.queue, []); assert.equal(entity.research, undefined); assert.equal(entity.carried, 0); }
  return { tick: value.tick, side: value.side, privateSides: value.privateSides, hud: value.hud, readOnly: value.readOnly, banks: value.players.map(bank) };
}
async function spectator(actor, layout, matchId, side, mode, base, liveActor, expectedDelayTicks = 20) {
  await online(actor); const dialog = await online(actor);
  await dialog.getByLabel('Spectator match ID', { exact: true }).fill(matchId);
  await dialog.getByLabel('Spectator perspective', { exact: true }).selectOption(String(side));
  await dialog.getByLabel('Spectator view', { exact: true }).selectOption(mode);
  await enabled(dialog.getByRole('button', { name: 'Spectate match', exact: true }));
  const boundary = await connectionBoundary(actor);
  await dialog.getByRole('button', { name: 'Spectate match', exact: true }).click();
  const hello = await battlefield(actor, matchId, side, 'spectator', { ...boundary, perspective: mode }); assert.equal(hello.delayTicks, expectedDelayTicks); assert.equal(hello.perspective, mode);
  const expectedSides = mode === 'team' ? layout.players.flatMap((player, s) => player.teamId === layout.players[side].teamId ? [s] : []) : [side];
  const rendered = await renderer(actor, layout, expectedSides); assert.equal(rendered.readOnly, true);
  const frame = actor.frames.get(rendered.tick);
  if (mode === 'team') assert.deepEqual(sorted(frame.view.teamPlayers.map(row => row.side)), expectedSides);
  else assert.equal(Object.hasOwn(frame.view, 'teamPlayers'), false);
  for (const entity of frame.view.entities.filter(row => !expectedSides.includes(row.side))) for (const key of privateFields) assert.equal(Object.hasOwn(entity, key), false);
  const matches = await http(liveActor, base, '/api/matches'); assert.equal(matches.status, 200);
  const live = matches.data.matches.find(row => row.id === matchId); assert(live); assert(live.tick - frame.tick >= hello.delayTicks, 'Spectator frame was newer than server cutoff');
  return { hello, frame, rendered, liveTickAfterFrame: live.tick };
}
async function spectatorRestrictions(actor, protocolVersion) {
  await actor.page.keyboard.press('F2'); const count = actor.sent.length;
  await actor.page.keyboard.press('x'); await sleep(200); assert.equal(actor.sent.length, count, 'Spectator UI emitted a stop order');
  await actor.page.locator('[data-session-tool="production"]').click();
  const dialog = actor.page.getByRole('dialog', { name: 'Session tools', exact: true }); await dialog.waitFor({ state: 'visible' });
  const recruit = dialog.locator('[data-recruit="worker"]').first(); await recruit.waitFor({ state: 'visible' }); assert.equal(await recruit.isDisabled(), true);
  await dialog.getByRole('button', { name: 'Close session tools', exact: true }).click();
  const beforeErrors = actor.errors.length, beforeAcks = actor.receipts.length;
  const probe = await sendPublic(actor, protocolVersion, { type: 'stop', ids: [1] }, 'spectator');
  const rejection = await poll(() => actor.errors.slice(beforeErrors).find(row => row.code === 'spectator'), 'server spectator rejection');
  assert.equal(actor.receipts.length, beforeAcks, 'Spectator probe received a player command acknowledgement');
  return { probe: probe.sent, rejection, uiEmittedCommands: 0, disabledProduction: true };
}
async function jointAiWave(watcher, timeout = 120000) {
  const found = await poll(() => {
    const frames = [...watcher.frames.values()].filter(frame => frame.view.side === 2 && frame.view.teamPerspective).sort((a, b) => a.tick - b.tick);
    for (let index = 1; index < frames.length; index++) {
      const frame = frames[index], previous = frames[index - 1];
      const owners = [2, 3].map(side => frame.view.entities.filter(e => e.side === side && e.kind === 'unit' && e.role !== 'worker' && e.hp > 0));
      if (!owners.every(units => units.length === 2 && units.every(unit => unit.order?.type === 'attackMove'))) continue;
      const destinations = owners.map(units => units.map(unit => `${unit.order.x},${unit.order.y},${unit.order.level ?? 0}`).sort());
      if (JSON.stringify(destinations[0]) !== JSON.stringify(destinations[1])) continue;
      const old = owners.flat().map(unit => previous.view.entities.find(entity => entity.id === unit.id));
      if (!old.every(unit => unit && unit.order?.type !== 'attackMove')) continue;
      const headquarters = frame.view.entities.filter(e => [2, 3].includes(e.side) && e.role === 'hq');
      const threats = frame.view.entities.filter(e => [0, 1].includes(e.side) && headquarters.some(hq => Math.hypot(hq.x - e.x, hq.y - e.y) < 12));
      if (threats.length) continue;
      return { previous, launch: frame, owners: owners.map(units => units.map(unit => ({ id: unit.id, side: unit.side, x: unit.x, y: unit.y, order: unit.order }))), destinations };
    }
    return null;
  }, 'ordinary two-owner coordinated AI attack interval', timeout);
  const moved = await poll(() => [...watcher.frames.values()].find(frame => frame.tick > found.launch.tick && found.owners.every(units => units.some(unit => { const now = frame.view.entities.find(e => e.id === unit.id); return now && Math.hypot(now.x - unit.x, now.y - unit.y) > .05; }))), 'both AI owners to move after their observed launch', 10000);
  return { ...found, moved, movedTick: moved.tick, claim: 'Two AI owners changed to the same formation destinations during one 200 ms public frame interval, then both moved. Exact simulation-step coordination is not exposed by public frames.' };
}

export async function verifyBrowser({ browser, base, output, protocolVersion, checks, expectedBuildId }) {
  const directory = join(output, 'native-browser'); await mkdir(directory, { recursive: true });
  const evidence = { passed: false, expectedBuildId, buildIdentityMethod: 'SHA-256 of actual native navigation and script response bytes compared with output/app package; expectedBuildId is source metadata, not a diagnostics value.', layouts: [], errors: [], limits: ['No natural victory is claimed.', 'Public AI frames prove a shared 200 ms attack interval; exact same-step coordinator attribution needs separate checkpoint evidence.'] };
  const record = (name, details) => { checks.push({ name, evidence: details }); console.log(`PASS ${name}`); };
  let restart;
  try {
    for (const layout of [...layouts, cooperativeLayout]) {
      const actors = [], local = { name: layout.name, fixture: layout, commands: {}, spectators: [], spectatorRestrictions: {}, assets: [], frames: {}, screenshots: [] }; evidence.layouts.push(local);
      try {
        const humanSides = layout.players.flatMap((p, side) => p.controller === 'human' ? [side] : []);
        for (const side of humanSides) { const actor = await profile(browser, base, `${layout.name}-side-${side}`, evidence.errors, undefined, join(output, 'app')); actors.push(actor); await guest(actor, base); actor.side = side; }
        const host = actors[0], watcher = await profile(browser, base, `${layout.name}-watcher`, evidence.errors, undefined, join(output, 'app')); actors.push(watcher); await guest(watcher, base);
        local.assets = actors.map(actor => ({ actor: actor.name, loaded: actor.assets }));
        let lobby = await configureNative(host, layout);
        for (const actor of actors.slice(1, -1)) { lobby = await mutate(actor, lobby.id, 'join'); assert.equal(lobby.seats.find(row => row.account?.id === actor.account.id)?.side, actor.side); }
        const outsider = await http(watcher, base, '/api/lobbies/' + lobby.id); assert.equal(outsider.status, 200);
        for (const [side, player] of layout.players.entries()) {
          const seat = lobby.seats.find(row => row.side === side); assert(seat);
          if (player.controller === 'ai') assert.equal(seat.account, null);
          else assert.equal(seat.account.id, actors.find(actor => actor.side === side)?.account.id);
        }
        for (const actor of actors.slice(0, -1)) lobby = await mutate(actor, lobby.id, 'ready');
        lobby = await mutate(host, lobby.id, 'start'); assert(lobby.matchId); local.lobby = lobby; local.matchId = lobby.matchId;
        const hello = await battlefield(host, lobby.matchId, 0); assert.equal(hello.protocolVersion, protocolVersion);
        for (const actor of actors.slice(1, -1)) await enter(actor, lobby.id, lobby.matchId, actor.side);
        await screenshot(host, directory, 'native-match-entry', local.screenshots);
        const participants = actors.slice(0, -1), ownership = await http(watcher, base, `/api/matches/${lobby.matchId}/ticket`, { role: 'player', perspective: 0 }); assert.equal(ownership.status, 403);
        const initial = await futureCommon(participants); local.initial = { tick: initial.tick, players: initial.frames.map((frame, i) => checkPlayerFrame(frame, layout, participants[i].side)) };
        local.frames.initial = await Promise.all(initial.frames.map((frame, i) => saveFrame(directory, `${layout.name}-initial-side-${participants[i].side}`, frame)));
        for (const teamId of [0, 1]) { const frames = initial.frames.filter((_, i) => layout.players[participants[i].side].teamId === teamId); if (frames.length > 1) for (const frame of frames.slice(1)) { assert.deepEqual(frame.view.visible, frames[0].view.visible); assert.deepEqual(frame.view.explored, frames[0].view.explored); } }
        local.renderers = []; for (const actor of participants) local.renderers.push(await renderer(actor, layout));
        local.commands.nativeStops = []; for (const actor of participants) local.commands.nativeStops.push({ side: actor.side, ...await stopNative(actor) });
        const afterStops = await futureCommon(participants), sender = participants[0], receiver = participants[1];
        const alliedUnit = afterStops.frames[1].view.entities.find(e => e.side === receiver.side && e.kind === 'unit' && e.role !== 'worker'); assert(alliedUnit);
        local.commands.rejectedOwnership = await sendPublic(sender, protocolVersion, { type: 'move', ids: [alliedUnit.id], x: alliedUnit.x, y: alliedUnit.y });
        assert.equal(local.commands.rejectedOwnership.ack.accepted, false); assert.equal(local.commands.rejectedOwnership.ack.reason, 'ownership');
        const beforeTransfer = await futureCommon(participants);
        local.commands.transfer = await sendPublic(sender, protocolVersion, { type: 'transferResources', recipient: receiver.side, resources: { wood: 10, ore: 0, crystal: 0 } }); assert.equal(local.commands.transfer.ack.accepted, true);
        const afterTransfer = await futureCommon(participants, local.commands.transfer.ack.appliedTick);
        assert.equal(afterTransfer.frames[0].view.player.wood, beforeTransfer.frames[0].view.player.wood - 10); assert.equal(afterTransfer.frames[1].view.player.wood, beforeTransfer.frames[1].view.player.wood + 10);
        for (let i = 0; i < participants.length; i++) { assert.equal(afterTransfer.frames[i].view.player.ore, beforeTransfer.frames[i].view.player.ore); assert.equal(afterTransfer.frames[i].view.player.crystal, beforeTransfer.frames[i].view.player.crystal); if (i > 1) assert.deepEqual(bank(afterTransfer.frames[i].view.player), bank(beforeTransfer.frames[i].view.player)); }
        local.frames.beforeTransfer = await Promise.all(beforeTransfer.frames.map((frame, i) => saveFrame(directory, `${layout.name}-before-transfer-side-${participants[i].side}`, frame)));
        local.frames.afterTransfer = await Promise.all(afterTransfer.frames.map((frame, i) => saveFrame(directory, `${layout.name}-after-transfer-side-${participants[i].side}`, frame)));
        local.banks = { before: beforeTransfer.frames.map(row => ({ side: row.view.side, bank: bank(row.view.player) })), after: afterTransfer.frames.map(row => ({ side: row.view.side, bank: bank(row.view.player) })), beforeTick: beforeTransfer.tick, afterTick: afterTransfer.tick };
        const opponentSide = layout.players.findIndex(p => p.teamId !== layout.players[0].teamId);
        local.commands.rejectedEnemyTransfer = await sendPublic(sender, protocolVersion, { type: 'transferResources', recipient: opponentSide, resources: { wood: 1, ore: 0, crystal: 0 } }); assert.equal(local.commands.rejectedEnemyTransfer.ack.accepted, false); assert.equal(local.commands.rejectedEnemyTransfer.ack.reason, 'unavailable');
        const playerView = await spectator(watcher, layout, lobby.matchId, layout === cooperativeLayout ? 3 : 1, 'player', base, host);
        if (layout === cooperativeLayout) assert.equal(playerView.frame.view.controller, 'ai');
        local.spectators.push({ mode: 'player', ...playerView, frame: await saveFrame(directory, `${layout.name}-spectator-player`, playerView.frame) });
        local.spectatorRestrictions.player = await spectatorRestrictions(watcher, protocolVersion);
        await screenshot(watcher, directory, 'spectator-player', local.screenshots);
        const teamSide = layout === cooperativeLayout ? 2 : 1;
        const teamView = await spectator(watcher, layout, lobby.matchId, teamSide, 'team', base, host);
        local.spectators.push({ mode: 'team', ...teamView, frame: await saveFrame(directory, `${layout.name}-spectator-team`, teamView.frame) });
        await screenshot(watcher, directory, 'spectator-team', local.screenshots);
        if (layout !== cooperativeLayout) {
          const teamActors = participants.filter(actor => layout.players[actor.side].teamId === layout.players[teamSide].teamId);
          const common = await futureCommon([...teamActors, watcher]); const combined = common.frames.at(-1).view;
          for (const frame of common.frames.slice(0, -1)) { assert.deepEqual(combined.teamPlayers.find(row => row.side === frame.view.side).player, frame.view.player); for (const entity of frame.view.entities.filter(row => row.side === frame.view.side)) assert.deepEqual(combined.entities.find(row => row.id === entity.id), entity); }
          local.spectatorCommonTick = common.tick;
          local.frames.spectatorCommon = await Promise.all(common.frames.map((frame, i) => saveFrame(directory, `${layout.name}-spectator-common-${i}`, frame)));
        } else {
          assert.equal(teamView.frame.view.controller, 'ai'); assert.deepEqual(teamView.frame.view.teamPlayers.map(row => row.side), [2, 3]);
          const wave = await jointAiWave(watcher);
          local.coordinatedAi = { ...wave, previous: await saveFrame(directory, `${layout.name}-ai-before-launch`, wave.previous), launch: await saveFrame(directory, `${layout.name}-ai-launch`, wave.launch), moved: await saveFrame(directory, `${layout.name}-ai-moved`, wave.moved) };
          await screenshot(watcher, directory, 'coordinated-ai-moving', local.screenshots);
          const summaries = await http(host, base, '/api/matches'); assert.equal(summaries.data.matches.find(row => row.id === lobby.matchId).finished, false);
          restart = { transfer: local.commands.transfer, cookies: await Promise.all(participants.map(actor => actor.context.cookies())), accounts: participants.map(actor => actor.account), lobby, matchId: lobby.matchId, layout, lastReceipts: participants.map(actor => actor.receipts.at(-1)) };
        }
        // The server's spectator error makes the ordinary OnlineConnection stop
        // and close its socket. Run this last, after all historical frame checks
        // and the AI observation, so the proof does not wait on a closed stream.
        local.spectatorRestrictions.team = await spectatorRestrictions(watcher, protocolVersion);
        await screenshot(host, directory, 'completed-host', local.screenshots); await screenshot(watcher, directory, 'completed-spectator', local.screenshots);
        const wire = [];
        for (const actor of actors) {
          await Promise.all(actor.assetTasks); const parseErrors = await actor.page.evaluate(() => window.__hostedTeamWire.parseErrors); assert.deepEqual(parseErrors, []);
          assert(actor.hellos.every(hello => hello.protocolVersion === protocolVersion));
          if (actor !== watcher) assert.deepEqual(actor.errors, []);
          else { assert.equal(actor.errors.length, 2); assert(actor.errors.every(error => error.code === 'spectator')); }
          wire.push({ name: actor.name, hellos: actor.hellos, commands: actor.sent, receipts: actor.receipts, errors: actor.errors, uiActions: actor.actions, parseErrors });
        }
        local.wire = await saveEvidence(directory, `${layout.name}-wire`, wire);
        record(`native ${layout.name} seats, public receipts, shared vision, separate banks and delayed spectator access`, { matchId: lobby.matchId, seats: lobby.seats.map(row => ({ side: row.side, accountId: row.account?.id ?? null, controller: row.controller })), initialTick: initial.tick });
      } catch (error) {
        local.error = error.stack ?? String(error);
        await Promise.all(actors.map(actor => screenshot(actor, directory, 'failure', local.screenshots)));
        local.failureWire = await saveEvidence(directory, `${layout.name}-failure-wire`, actors.map(actor => ({ name: actor.name, hellos: actor.hellos, commands: actor.sent, receipts: actor.receipts, errors: actor.errors, uiActions: actor.actions })));
        throw error;
      } finally { await Promise.all(actors.map(actor => actor.context.close())); }
    }
    assert.deepEqual(evidence.errors, []); evidence.passed = true;
    await writeFile(join(directory, 'summary.json'), JSON.stringify(evidence, null, 2) + '\n');
    return { ...evidence, restart };
  } catch (error) { evidence.error = error.stack ?? String(error); await writeFile(join(directory, 'summary.json'), JSON.stringify(evidence, null, 2) + '\n'); throw error; }
}

export async function verifyRestart({ browser, base, output, protocolVersion, checks, restart }) {
  assert(restart?.cookies?.length === 2); assert(restart.transfer?.ack.accepted);
  const directory = join(output, 'native-browser'), actors = [], errors = [], result = { passed: false, matchId: restart.matchId, seats: [], screenshots: [], errors };
  try {
    for (const side of [0, 1]) {
      const actor = await profile(browser, base, `restarted-cooperative-${side}`, errors, restart.cookies[side], join(output, 'app')); actors.push(actor); actor.account = restart.accounts[side];
      const session = await http(actor, base, '/api/session'); assert.equal(session.status, 200); assert.equal(session.data.account.id, actor.account.id);
      await online(actor); const lobbyRead = await http(actor, base, `/api/lobbies/${restart.lobby.id}`); assert.equal(lobbyRead.status, 200);
      assert.equal(lobbyRead.data.lobby.seats.find(row => row.account?.id === actor.account.id).side, side);
      const hello = await enter(actor, restart.lobby.id, restart.matchId, side); assert.equal(hello.protocolVersion, protocolVersion); assert.equal(hello.lastClientSeq, restart.lastReceipts[side].clientSeq);
      result.seats.push({ side, account: actor.account, hello, renderer: await renderer(actor, restart.layout), assets: actor.assets });
      // Rejoin resets native sequence from durable hello. This native stop must
      // follow the previous connection's last acknowledgement.
      const stop = await stopNative(actor); assert.equal(stop.sent.clientSeq, hello.lastClientSeq + 1); result.seats.at(-1).stop = stop;
      await screenshot(actor, directory, 'restarted-native-stop', result.screenshots);
    }
    const before = await futureCommon(actors); for (const [index, frame] of before.frames.entries()) checkPlayerFrame(frame, restart.layout, index);
    const sender = actors[0], receiptCount = sender.receipts.length, sentCount = sender.sent.length;
    // Retry the unchanged authenticated transport envelope from the first server
    // generation. This is an old sequence, not a second transfer command.
    await sender.page.evaluate(({ matchId, envelope }) => {
      const entry = window.__hostedTeamWire.connections.findLast(row => row.hello?.matchId === matchId && row.hello.role === 'player' && row.socket.readyState === WebSocket.OPEN);
      if (!entry) throw new Error('No authenticated restarted native match connection');
      entry.socket.send(JSON.stringify(envelope));
    }, { matchId: restart.matchId, envelope: restart.transfer.sent });
    const resent = await poll(() => sender.sent.slice(sentCount).find(row => row.clientSeq === restart.transfer.sent.clientSeq), 'unchanged transfer envelope sent after restart');
    assert.deepEqual(resent, restart.transfer.sent);
    const durableAck = await poll(() => sender.receipts.slice(receiptCount).find(row => row.clientSeq === restart.transfer.sent.clientSeq), 'persisted transfer receipt replayed after restart');
    assert.deepEqual(durableAck, restart.transfer.ack);
    const after = await futureCommon(actors, Math.max(before.tick + 4, Math.max(...actors.map(actor => Math.max(...actor.frames.keys()))) + 4));
    const beforeBanks = before.frames.map(frame => ({ side: frame.view.side, bank: bank(frame.view.player) }));
    const afterBanks = after.frames.map(frame => ({ side: frame.view.side, bank: bank(frame.view.player) }));
    assert.deepEqual(afterBanks, beforeBanks, 'Replaying persisted transfer double charged a human bank');
    result.transferReplay = { original: restart.transfer, replayed: { sent: resent, ack: durableAck }, beforeTick: before.tick, afterTick: after.tick, beforeBanks, afterBanks,
      beforeFrames: await Promise.all(before.frames.map((frame, i) => saveFrame(directory, `restart-before-transfer-replay-side-${i}`, frame))),
      afterFrames: await Promise.all(after.frames.map((frame, i) => saveFrame(directory, `restart-after-transfer-replay-side-${i}`, frame))) };
    const wire = [];
    for (const actor of actors) { await Promise.all(actor.assetTasks); const parseErrors = await actor.page.evaluate(() => window.__hostedTeamWire.parseErrors); assert.deepEqual(parseErrors, []); assert.deepEqual(actor.errors, []); wire.push({ name: actor.name, hellos: actor.hellos, commands: actor.sent, receipts: actor.receipts, errors: actor.errors, uiActions: actor.actions, parseErrors }); await screenshot(actor, directory, 'restarted-transfer-receipt-replay', result.screenshots); }
    result.wire = await saveEvidence(directory, 'restart-wire', wire);
    // Reuse the restarted host after all player receipt and bank checks. The
    // other participant stays connected as the live source for this perspective.
    const live = await spectator(actors[0], restart.layout, restart.matchId, 1, 'player', base, actors[1], 0);
    const playerFrame = await poll(() => actors[1].frames.get(live.frame.tick), 'live player frame matching native zero-delay spectator capture');
    assert.deepEqual(live.frame.view, playerFrame.view, 'Zero-delay spectator capture differs from the live player wire view');
    const advanced = await futureCommon(actors, live.frame.tick + 4);
    assert.deepEqual(advanced.frames[0].view, advanced.frames[1].view, 'Zero-delay spectator did not follow the advancing live player view');
    result.liveSpectator = {
      hello: live.hello, renderer: live.rendered, initialTick: live.frame.tick, advancingTick: advanced.tick,
      firstFrames: await Promise.all([live.frame, playerFrame].map((frame, i) => saveFrame(directory, `restart-live-first-${i === 0 ? 'spectator' : 'player'}`, frame))),
      advancingFrames: await Promise.all(advanced.frames.map((frame, i) => saveFrame(directory, `restart-live-advancing-${i === 0 ? 'spectator' : 'player'}`, frame))),
    };
    await screenshot(actors[0], directory, 'restarted-zero-delay-live-spectator', result.screenshots);
    assert.deepEqual(errors, []); result.passed = true;
    checks.push({ name: 'native cooperative sessions, seats, durable sequences and unchanged transfer receipts survive packaged-server restart without double charge', evidence: { seats: result.seats.map(row => ({ side: row.side, priorSequence: row.hello.lastClientSeq, acceptedSequence: row.stop.ack.clientSeq })), replayedSequence: durableAck.clientSeq, beforeTick: before.tick, afterTick: after.tick, beforeBanks, afterBanks } });
    checks.push({ name: 'native zero-delay spectator renders the same advancing public wire view as the live player in read-only mode', evidence: result.liveSpectator });
    console.log('PASS native cooperative sessions, seats, durable sequences and unchanged transfer receipts survive packaged-server restart without double charge'); return result;
  } catch (error) {
    result.error = error.stack ?? String(error);
    await Promise.all(actors.map(actor => screenshot(actor, directory, 'restart-failure', result.screenshots)));
    result.failureWire = await saveEvidence(directory, 'restart-failure-wire', actors.map(actor => ({ name: actor.name, hellos: actor.hellos, commands: actor.sent, receipts: actor.receipts, errors: actor.errors, uiActions: actor.actions })));
    throw error;
  } finally { await Promise.all(actors.map(actor => actor.context.close())); await writeFile(join(directory, 'restart.json'), JSON.stringify(result, null, 2) + '\n'); }
}
