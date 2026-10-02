import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {appendFileSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync} from 'node:fs';
import {isAbsolute, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Static candidate. No browser/module import occurs before every launch guard passes.
const SOURCE_ROOT = '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies';
const PREFIX = 'work/feature63-human-wave-composition-r3';
const BASE_URL = 'http://127.0.0.1:5373';
const ATTEMPT_MS = 300_000;
const CLEANUP_MS = 120_000;
const WINDOW_TICKS = 400;
const FRAME_STEP = 4;
const OUTPUT_ALLOWLIST = Object.freeze([
  'public-results.json', 'public-identities.json', 'public-match-identity.json', 'public-windows.json',
  'browser-ownership.json', 'public-cleanup.json', 'errors.ndjson', 'public-status.ndjson',
  'human-one-wire.ndjson', 'human-two-wire.ndjson',
  'human-one-public-frames.ndjson', 'human-two-public-frames.ndjson',
  'human-one-hellos.ndjson', 'human-two-hellos.ndjson',
  'human-one-commands.ndjson', 'human-two-commands.ndjson',
  'human-one-acks.ndjson', 'human-two-acks.ndjson',
  'human-one-ui-actions.ndjson', 'human-two-ui-actions.ndjson',
  'human-one-latest-frame.json', 'human-two-latest-frame.json',
]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const self = realpathSync(fileURLToPath(import.meta.url));
const selfSha256 = sha256(readFileSync(self));

function requireHash(value, label) {
  assert.match(value ?? '', /^[a-f0-9]{64}$/, `${label} must be an explicit SHA-256.`);
  return value;
}
function checkedFile(binding, label) {
  assert.ok(binding && isAbsolute(binding.path ?? ''), `${label} needs an absolute path.`);
  assert.equal(realpathSync(binding.path), binding.path, `${label} must use its real path.`);
  assert.ok(statSync(binding.path).isFile(), `${label} must be a regular file.`);
  const bytes = readFileSync(binding.path);
  assert.equal(sha256(bytes), requireHash(binding.sha256, label), `${label} bytes changed.`);
  return bytes;
}
function checkedReceipt(binding, schema, pin, label) {
  const receipt = JSON.parse(checkedFile(binding, label).toString('utf8'));
  assert.equal(receipt.schema, schema, `${label} schema mismatch.`);
  assert.equal(receipt.sourcePin, pin, `${label} source mismatch.`);
  assert.equal(receipt.approved, true, `${label} is pending.`);
  return receipt;
}
function guard() {
  assert.equal(process.argv.length, 2, 'No implicit command-line source, URL or output overrides.');
  const assignmentPath = process.env.OVF_FEATURE63_PUBLIC_ASSIGNMENT;
  assert.ok(assignmentPath && isAbsolute(assignmentPath), 'Root must assign OVF_FEATURE63_PUBLIC_ASSIGNMENT.');
  assert.equal(realpathSync(assignmentPath), assignmentPath, 'Assignment must use its real path.');
  const assignmentBytes = readFileSync(assignmentPath);
  const assignment = JSON.parse(assignmentBytes.toString('utf8'));
  assert.equal(assignment.schema, 'feature63-public-producer-assignment-v1');
  assert.equal(assignment.approved, true, 'Launch is held; root has not approved this assignment.');
  assert.equal(assignment.assignedBy, '/root');
  assert.match(assignment.sourcePin ?? '', /^[a-f0-9]{40}$/, 'Root must assign a full source pin.');
  assert.equal(assignment.sourceRoot, SOURCE_ROOT);
  assert.equal(realpathSync(SOURCE_ROOT), SOURCE_ROOT);
  assert.equal(realpathSync(process.cwd()), SOURCE_ROOT, 'Launch from the root-assigned owned checkout.');
  assert.equal(assignment.freshPrefix, PREFIX);
  assert.equal(assignment.baseUrl, BASE_URL);
  assert.equal(assignment.outputRoot, join(SOURCE_ROOT, PREFIX, 'public'));
  assert.equal(assignment.review?.approved, true, 'Producer review remains pending.');
  assert.equal(assignment.review?.reviewedBy, '/root');
  requireHash(assignment.publicDriverSha256, 'dedicated public driver');
  assert.equal(assignment.reviewedProducer?.path, self);
  assert.equal(requireHash(assignment.reviewedProducer?.sha256, 'producer'), selfSha256);
  const slot = assignment.exclusiveHeavyApproval;
  assert.equal(slot?.approved, true, 'Exclusive heavy slot remains pending.');
  assert.equal(slot?.holder, '/root/ai_modes');
  assert.ok(typeof slot?.token === 'string' && slot.token.length >= 16);
  assert.ok(Number.isFinite(Date.parse(slot?.validUntil)), 'Heavy-slot expiry must be explicit.');
  assert.ok(Date.parse(slot.validUntil) > Date.now() + ATTEMPT_MS + CLEANUP_MS, 'Heavy-slot approval expires too soon.');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: SOURCE_ROOT, encoding: 'utf8'}).trim();
  assert.equal(head, assignment.sourcePin, 'Owned source does not match root pin.');
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: SOURCE_ROOT, encoding: 'utf8'}), '', 'Tracked source is dirty.');
  const source = checkedReceipt(assignment.sourceBinding, 'feature63-new-source-binding-v1', head, 'source binding');
  assert.equal(source.authenticatedInputs, true);
  assert.ok(Number.isSafeInteger(source.inputCount) && source.inputCount > 0);
  assert.equal(source.includesSourceConfigPublicBuildAndProof, true);
  const build = checkedReceipt(assignment.buildBinding, 'feature63-build-binding-v1', head, 'build binding');
  assert.equal(build.producerSha256, selfSha256);
  assert.equal(build.publicDriverSha256, assignment.publicDriverSha256);
  assert.equal(build.webDistPath, join(SOURCE_ROOT, PREFIX, 'dist'));
  assert.equal(build.serverBuildPath, join(SOURCE_ROOT, PREFIX, 'server'));
  assert.equal(assignment.productVersion, '4.0.2', 'The reviewed intended product version must be explicit.');
  assert.equal(build.productVersion, assignment.productVersion);
  const launch = checkedReceipt(assignment.serverOwnership, 'feature63-owned-server-v1', head, 'owned server');
  assert.equal(launch.port, 5373);
  assert.equal(launch.baseUrl, BASE_URL);
  assert.equal(launch.freshPrefix, PREFIX);
  assert.equal(launch.exclusiveSlotToken, slot.token);
  assert.equal(launch.protectedRootPort, 4173);
  assert.equal(launch.protectedRootUnaffected, true);
  assert.ok(Number.isSafeInteger(launch.pid) && launch.pid > 0);
  assert.ok(typeof launch.startTicks === 'string' && /^\d+$/.test(launch.startTicks));
  const proc = readFileSync(`/proc/${launch.pid}/stat`, 'utf8');
  assert.equal(proc.slice(proc.lastIndexOf(')') + 2).trim().split(/\s+/)[19], launch.startTicks, 'Owned server process identity changed.');
  const dependencies = checkedReceipt(assignment.browserBinding, 'feature63-browser-binding-v1', head, 'browser binding');
  assert.equal(dependencies.producerSha256, selfSha256);
  assert.equal(dependencies.buildBindingSha256, assignment.buildBinding.sha256);
  assert.equal(dependencies.exclusiveSlotToken, slot.token);
  assert.equal(dependencies.contextCount, 2);
  assert.equal(dependencies.browserCount, 1);
  assert.equal(dependencies.headless, true);
  const moduleBytes = checkedFile(dependencies.playwrightEntry, 'Playwright entry');
  const executableBytes = checkedFile(dependencies.chromiumExecutable, 'Chromium executable');
  assert.ok(moduleBytes.length > 0 && executableBytes.length > 0);
  assert.ok(isAbsolute(dependencies.playwrightModulePath ?? ''));
  assert.equal(realpathSync(dependencies.playwrightModulePath), dependencies.playwrightModulePath);
  assert.equal(dependencies.playwrightModulePath, dependencies.playwrightEntry.path);
  assert.equal(dependencies.allDependencyBytesAuthenticated, true);
  assert.ok(Number.isSafeInteger(assignment.maxRetainedBytes) && assignment.maxRetainedBytes > 0 && assignment.maxRetainedBytes <= 1_073_741_824);
  assert.equal(dependencies.nativeLifecycleOwner, 'dedicated-wrapper');
  assert.equal(dependencies.cdpBaseUrl, 'http://127.0.0.1:5374');
  assert.equal(dependencies.reviewedCdpDisconnectHasNoNativeSignals, true, 'Reviewed dependency must disconnect an attached browser without native signals.');
  const nativeBrowser = checkedReceipt(assignment.externalBrowserOwnership, 'feature63-owned-browser-v1', head, 'wrapper-owned browser');
  assert.equal(nativeBrowser.port, 5374);
  assert.equal(nativeBrowser.cdpBaseUrl, dependencies.cdpBaseUrl);
  assert.equal(nativeBrowser.exclusiveSlotToken, slot.token);
  assert.equal(nativeBrowser.protectedRootPort, 4173);
  assert.equal(nativeBrowser.protectedRootUnaffected, true);
  assert.equal(nativeBrowser.executable, dependencies.chromiumExecutable.path);
  assert.ok(Number.isSafeInteger(nativeBrowser.pid) && nativeBrowser.pid > 0 && nativeBrowser.pid !== 1063);
  assert.ok(typeof nativeBrowser.startTicks === 'string' && /^\d+$/.test(nativeBrowser.startTicks));
  const browserProc = readFileSync(`/proc/${nativeBrowser.pid}/stat`, 'utf8');
  assert.equal(browserProc.slice(browserProc.lastIndexOf(')') + 2).trim().split(/\s+/)[19], nativeBrowser.startTicks, 'Wrapper-owned browser process identity changed.');
  return {assignment, assignmentPath, assignmentSha256: sha256(assignmentBytes), head, build, launch, dependencies, nativeBrowser};
}

const binding = guard();
const out = binding.assignment.outputRoot;
// A fresh directory claim prevents mixing any previous attempt with this one.
mkdirSync(out, {recursive: false});
for (const name of OUTPUT_ALLOWLIST) writeFileSync(join(out, name), name.endsWith('.json') ? 'null\n' : '', {flag: 'wx', mode: 0o600});
const sizes = new Map(OUTPUT_ALLOWLIST.map(name => [name, statSync(join(out, name)).size]));
let retainedBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
let resourceFailure = null;
let browser;
let stopping = false;
let firstFailure = null;
let phase = 'loading reviewed browser dependency';
let attemptTimer;
let deadline;
const profiles = [];
const errors = [];
const candidates = [];
const candidateSignatures = new Set();
const cleanup = {schema: 'feature63-public-cleanup-v1', startedAt: null, completedAt: null, contexts: [], browserClosed: false, failures: []};
const result = {
  schema: 'feature63-public-result-v1', status: 'candidate-running', publicCandidatePassed: false,
  feature63Qualified: false, nativeCompositionAuditRequired: true,
  sourcePin: binding.head, producerSha256: selfSha256, publicProducerSha256: selfSha256, publicDriverSha256: binding.assignment.publicDriverSha256, assignmentPath: binding.assignmentPath,
  assignmentSha256: binding.assignmentSha256, baseUrl: BASE_URL, outputAllowlist: OUTPUT_ALLOWLIST,
  startedAt: new Date().toISOString(), bounds: {attemptMs: ATTEMPT_MS, fightWindowTicks: WINDOW_TICKS, automaticRetries: 0, maxRetainedBytes: binding.assignment.maxRetainedBytes},
  lobbyId: null, matchId: null, selectedCandidateIndex: null, firstFailure: null, cleanupPassed: false,
};

function beginStop(error, kind = 'acquisition') {
  if (!firstFailure) firstFailure = {kind, phase, message: error instanceof Error ? error.message : String(error), capturedAt: new Date().toISOString()};
  stopping = true;
  if (browser) void browser.close().catch(closeError => errors.push({kind: 'emergency-browser-close', message: String(closeError)}));
}
function checkBudget() {
  if (retainedBytes > binding.assignment.maxRetainedBytes && !resourceFailure) {
    resourceFailure = {kind: 'resource', phase, retainedBytesAtBreach: retainedBytes, maximum: binding.assignment.maxRetainedBytes, capturedAt: new Date().toISOString(), message: 'Retained byte bound breached; existing bytes are preserved.'};
    beginStop(new Error(resourceFailure.message), 'resource');
    errorRecord('resource', resourceFailure.message, resourceFailure);
  }
}
function append(name, value) {
  assert.ok(OUTPUT_ALLOWLIST.includes(name));
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  appendFileSync(join(out, name), bytes);
  sizes.set(name, sizes.get(name) + bytes.length); retainedBytes += bytes.length; checkBudget();
}
function save(name, value) {
  assert.ok(OUTPUT_ALLOWLIST.includes(name));
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(join(out, name), bytes);
  retainedBytes += bytes.length - sizes.get(name); sizes.set(name, bytes.length); checkBudget();
}
function errorRecord(kind, message, extra = {}) {
  const value = {schema: 'feature63-public-error-v1', kind, phase, capturedAt: new Date().toISOString(), message: String(message), ...extra};
  errors.push(value); append('errors.ndjson', value); return value;
}
function status(action, detail = {}) {
  append('public-status.ndjson', {schema: 'feature63-public-status-v1', capturedAt: new Date().toISOString(), phase, action, ...detail});
}
function checkpoint() {
  if (stopping) throw new Error(firstFailure?.message ?? 'Public acquisition stopped.');
  if (Date.now() >= deadline) { beginStop(new Error('One public attempt reached its 300-second bound.'), 'timeout'); throw new Error(firstFailure.message); }
}
async function pause(ms) {
  checkpoint(); await new Promise(done => setTimeout(done, Math.min(ms, Math.max(1, deadline - Date.now())))); checkpoint();
}
async function waitUntil(predicate, timeout, label) {
  const ends = Math.min(deadline, Date.now() + timeout);
  while (Date.now() < ends) { checkpoint(); const value = predicate(); if (value) return value; await pause(40); }
  throw new Error(label);
}
function humanAlive(view) {
  const resultFlags = view?.result?.eliminated;
  const flags = view?.eliminated;
  return Object.fromEntries([0, 1].map(side => [side, {
    explicitNotEliminated: flags?.[side] === false && resultFlags?.[side] === false,
    liveCompleteHqIds: (view?.entities ?? []).filter(e => e.side === side && e.kind === 'building' && e.role === 'hq' && e.hp > 0 && e.progress === 1).map(e => e.id),
    liveCombatUnitIds: (view?.entities ?? []).filter(e => e.side === side && e.kind === 'unit' && e.role !== 'worker' && e.hp > 0 && e.owner === side).map(e => e.id),
  }]));
}
function alivePass(alive) {
  return [0, 1].every(side => alive[side].explicitNotEliminated && alive[side].liveCompleteHqIds.length > 0);
}
function topologyPass(message, side) {
  const view = message.view;
  return message.matchId === result.matchId && view.side === side && view.controller === 'external' && view.teamId === 0 && view.sharedVision === true && view.rules?.mode === 'annihilation'
    && JSON.stringify(view.allies.map(p => [p.side, p.teamId])) === JSON.stringify([[1 - side, 0]])
    && JSON.stringify(view.opponents.map(p => [p.side, p.teamId])) === JSON.stringify([[2, 1], [3, 1]]);
}

function capture(profile, socket, direction, event) {
  try {
    const capturedAt = new Date().toISOString();
    const ordinal = ++profile.wireOrdinal;
    const stringPayload = typeof event.payload === 'string';
    const wire = {schema: 'feature63-public-wire-v1', profile: profile.name, socketId: socket.id, socketUrl: socket.url, ordinal, direction, capturedAt,
      payloadType: stringPayload ? 'string' : 'binary', payload: stringPayload ? event.payload : null,
      binaryBase64: stringPayload ? null : Buffer.from(event.payload).toString('base64')};
    // Persist the complete exposed payload before attempting to parse it.
    append(`${profile.name}-wire.ndjson`, wire);
    if (!stringPayload) throw new Error('Binary public payload retained; JSON string attribution is unavailable.');
    const message = JSON.parse(event.payload);
    const row = {schema: 'feature63-public-message-v1', profile: profile.name, socketId: socket.id, wireOrdinal: ordinal, capturedAt, message};
    if (direction === 'sent' && message.kind === 'command') { profile.commands.push(row); append(`${profile.name}-commands.ndjson`, row); }
    if (direction !== 'received') return;
    if (message.kind === 'hello') {
      profile.hellos.push(row); append(`${profile.name}-hellos.ndjson`, row);
      if (message.protocolVersion !== 1 || message.role !== 'player' || message.side !== profile.side || message.perspective === 'team' || !Number.isSafeInteger(message.generation)) throw new Error('Human hello must bind a normal own-side player view.');
    }
    if (message.kind === 'commandAck') { profile.acks.push(row); append(`${profile.name}-acks.ndjson`, row); }
    if (message.kind === 'error') throw new Error(`Public server error ${message.code}: ${message.message}`);
    if (message.kind !== 'snapshot') return;
    assert.ok(Number.isSafeInteger(message.tick) && message.tick >= 0);
    assert.equal(message.frameSeq, message.tick, 'Public frameSeq must equal its current source-derived authoritative tick.');
    assert.equal(message.view.tick, message.tick);
    assert.equal(message.view.side, profile.side);
    const alive = humanAlive(message.view);
    const frame = {schema: 'feature63-public-frame-v1', profile: profile.name, socketId: socket.id, wireOrdinal: ordinal, capturedAt, message, alive};
    append(`${profile.name}-public-frames.ndjson`, frame);
    save(`${profile.name}-latest-frame.json`, frame);
    profile.latest = frame;
    for (const entity of message.view.entities) profile.observedIds.set(entity.id, {side: entity.side, owner: entity.owner, kind: entity.kind, lastObservedTick: message.tick});
    const combat = [];
    for (const event of message.view.events) {
      if (event.type !== 'attack' || !(event.amount > 0) || ![0, 1, 2, 3].includes(event.side)) continue;
      if (typeof event.eventId !== 'string' || !Number.isSafeInteger(event.source) || !Number.isSafeInteger(event.target) || !Number.isSafeInteger(event.tick)) continue;
      const source = message.view.entities.find(e => e.id === event.source);
      const target = profile.observedIds.get(event.target);
      // Redacted or unobserved attribution cannot be repaired with private state.
      if (!source || source.side !== event.side || source.owner !== event.side || source.kind !== 'unit' || !target || target.owner !== target.side || target.kind !== 'unit') continue;
      if (!([0, 1].includes(event.side) && [2, 3].includes(target.side)) && !([2, 3].includes(event.side) && [0, 1].includes(target.side))) continue;
      combat.push({...event, profile: profile.name, wireOrdinal: ordinal, frameTick: message.tick, sourceKind: source.kind, sourceSide: source.side,
        targetSide: target.side, targetKind: target.kind, targetObservedTick: target.lastObservedTick});
    }
    const economyIds = new Set((message.view.economy?.caravans ?? []).map(value => typeof value === 'number' ? value : value.entityId));
    const eligibleOwnIds = message.view.entities.filter(entity => entity.owner === profile.side && entity.side === profile.side && entity.kind === 'unit' && entity.role !== 'worker' && entity.hp > 0 && entity.illusion === false && entity.definitionId !== 'economy:caravan' && !economyIds.has(entity.id) && entity.tactics?.siegeCrew?.uncrewed !== true).map(entity => entity.id).sort((a, b) => a - b);
    profile.frameIndex.push({tick: message.tick, frameSeq: message.frameSeq, wireOrdinal: ordinal, socketId: socket.id, matchId: message.matchId, alive, combat, eligibleOwnIds});
  } catch (error) {
    try { errorRecord('capture', error instanceof Error ? error.message : String(error), {profile: profile.name, direction, socketId: socket.id}); } catch (writeError) { errors.push({kind: 'capture-write', message: String(writeError)}); }
    beginStop(error, 'capture');
  }
}

async function ui(profile, action, detail, perform) {
  checkpoint();
  const actionId = randomUUID();
  const began = {schema: 'feature63-public-ui-action-v1', profile: profile.name, side: profile.side, actionId, action, state: 'began', capturedAt: new Date().toISOString(), detail};
  append(`${profile.name}-ui-actions.ndjson`, began);
  try {
    const value = await perform(); checkpoint();
    append(`${profile.name}-ui-actions.ndjson`, {...began, state: 'completed', capturedAt: new Date().toISOString()});
    return {actionId, value};
  } catch (error) {
    append(`${profile.name}-ui-actions.ndjson`, {...began, state: 'failed', capturedAt: new Date().toISOString(), message: String(error)}); throw error;
  }
}
async function clickRole(profile, name) {
  return ui(profile, 'button', {role: 'button', name, exact: true}, () => profile.page.getByRole('button', {name, exact: true}).click());
}
async function refresh(profile) { await clickRole(profile, 'Refresh lobbies'); }
async function guest(name, side) {
  checkpoint();
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const profile = {name, side, context, contextId: randomUUID(), page: null, sockets: [], wireOrdinal: 0, commands: [], acks: [], hellos: [], frameIndex: [], observedIds: new Map(), acceptedAttackMoves: [], latest: null, username: null, account: null};
  profiles.push(profile);
  const page = await context.newPage(); profile.page = page;
  page.setDefaultTimeout(10_000); page.setDefaultNavigationTimeout(15_000);
  page.on('pageerror', error => { errorRecord('page', error.message, {profile: name}); beginStop(error, 'page'); });
  page.on('websocket', socket => {
    const owned = {id: randomUUID(), url: socket.url(), openedAt: new Date().toISOString(), closedAt: null}; profile.sockets.push(owned);
    const url = new URL(owned.url);
    if (url.hostname !== '127.0.0.1' || url.port !== '5373' || url.pathname !== '/ws') { beginStop(new Error('Unexpected public socket origin.'), 'ownership'); return; }
    socket.on('framesent', event => capture(profile, owned, 'sent', event));
    socket.on('framereceived', event => capture(profile, owned, 'received', event));
    socket.on('socketerror', value => { errorRecord('socket', value, {profile: name, socketId: owned.id}); beginStop(new Error(String(value)), 'socket'); });
    socket.on('close', () => { owned.closedAt = new Date().toISOString(); status('owned-socket-closed', {profile: name, socketId: owned.id}); });
  });
  await ui(profile, 'navigation', {url: BASE_URL, waitUntil: 'domcontentloaded'}, () => page.goto(BASE_URL, {waitUntil: 'domcontentloaded'}));
  profile.pageBuild = await page.evaluate(() => ({url: location.href, moduleScripts: Array.from(document.querySelectorAll('script[type="module"][src]'), n => n.src), stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'), n => n.href)}));
  await clickRole(profile, 'Online');
  const guestResponsePromise = page.waitForResponse(response => response.url() === `${BASE_URL}/api/auth/guest` && response.request().method() === 'POST', {timeout: 10_000});
  await clickRole(profile, 'Play as guest');
  const guestResponse = await guestResponsePromise;
  const guestPayload = await guestResponse.text();
  profile.guestResponse = {url: guestResponse.url(), status: guestResponse.status(), payload: guestPayload};
  profile.account = JSON.parse(guestPayload).account;
  assert.equal(guestResponse.status(), 200); assert.ok(typeof profile.account?.id === 'string' && profile.account.id.length > 0);
  status('normal-guest-response', {profile: name, ...profile.guestResponse});
  await page.waitForFunction(() => !document.querySelector('.online-account')?.hidden && document.querySelector('.online-username')?.textContent?.startsWith('Guest'), {}, {timeout: 15_000});
  profile.username = await page.locator('.online-username').textContent();
  assert.equal(profile.account.username, profile.username);
  return profile;
}
async function battlefield(profile) {
  const page = profile.page;
  await page.waitForSelector('.online-overlay[hidden]', {state: 'attached', timeout: 30_000});
  await page.waitForSelector('.loading-battle[hidden]', {state: 'attached', timeout: 30_000});
  await page.waitForFunction(side => { const rts = window.rts; return rts?.mode === 'online' && rts.viewSide === side && rts.state.explored[side].size > 0; }, profile.side, {timeout: 30_000});
  const diagnostics = await page.evaluate(() => ({paused: window.rts.paused, readOnly: window.rts.readOnly, simulationEnabled: window.rts.simulationEnabled, teams: [...window.rts.state.teams]}));
  assert.deepEqual(diagnostics, {paused: false, readOnly: false, simulationEnabled: false, teams: [0, 0, 1, 1]});
  assert.equal(await page.locator('#game-canvas canvas').isVisible(), true);
  await waitUntil(() => profile.latest && profile.hellos.length, 10_000, 'Missing hello or initial public frame.');
}
function sharedLatest() {
  const a = profiles[0], b = profiles[1];
  if (!a || !b) return null;
  const second = new Map(b.frameIndex.map(f => [f.tick, f]));
  return [...a.frameIndex].reverse().find(f => second.has(f.tick))?.tick ?? null;
}
function groundTarget(hq, hostile, entities, width, height) {
  const dx = hostile ? hostile.x - hq.x : 1, dy = hostile ? hostile.y - hq.y : .6;
  const length = Math.hypot(dx, dy) || 1;
  const center = {x: hq.x + dx / length * 6, y: hq.y + dy / length * 6};
  for (const [ox, oy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]]) {
    const target = {x: center.x + ox, y: center.y + oy};
    if (target.x < .5 || target.y < .5 || target.x > width - .5 || target.y > height - .5 || Math.hypot(target.x - hq.x, target.y - hq.y) > 10) continue;
    if (entities.every(e => Math.hypot(e.x - target.x, e.y - target.y) > 1.8)) return target;
  }
  throw new Error('No observed ground point near the common human HQ avoids entity clicks.');
}
async function attackMove(profile, target, commonHqId, reason) {
  checkpoint();
  const page = profile.page;
  const selectionAction = await ui(profile, 'keyboard', {key: 'F2', purpose: 'select own combat army'}, () => page.keyboard.press('F2'));
  await page.waitForFunction(side => window.rts.selected.length > 0 && window.rts.selected.every(id => window.rts.state.entities.some(e => e.id === id && e.side === side && e.kind === 'unit' && e.role !== 'worker' && e.hp > 0)), profile.side);
  const display = await page.evaluate(() => {
    const rts = window.rts;
    return {tick: rts.state.tick, side: rts.viewSide, selectedIds: [...rts.selected], selectedUnits: rts.state.entities.filter(e => rts.selected.includes(e.id)).map(e => ({id: e.id, side: e.side, kind: e.kind, role: e.role, hp: e.hp, x: e.x, y: e.y})), dimensions: {width: rts.state.width, height: rts.state.height}};
  });
  assert.equal(display.side, profile.side); assert.ok(display.selectedIds.length > 0);
  const eligibilityFrame = await waitUntil(() => profile.frameIndex.findLast(frame => frame.tick === display.tick), 2_000, 'Displayed own selection has no captured public eligibility frame.');
  const eligibleCommandedIds = display.selectedIds.filter(id => eligibilityFrame.eligibleOwnIds.includes(id)).sort((a, b) => a - b);
  assert.ok(eligibleCommandedIds.length > 0, 'The accepted command must contain an eligible owned combat actor.');
  assert.deepEqual(eligibleCommandedIds, [...display.selectedIds].sort((a, b) => a - b), 'Selected illusions, crewless actors or economy units cannot qualify this command.');
  const minimap = await page.locator('#minimap').boundingBox(); assert.ok(minimap);
  const minimapPoint = {x: minimap.x + target.x / display.dimensions.width * minimap.width, y: minimap.y + target.y / display.dimensions.height * minimap.height};
  const minimapAction = await ui(profile, 'minimap-left-click', {target, point: minimapPoint}, () => page.mouse.click(minimapPoint.x, minimapPoint.y));
  const attackKeyAction = await ui(profile, 'keyboard', {key: 'a', purpose: 'ordinary attack-move input'}, () => page.keyboard.press('a'));
  const canvas = await page.locator('#game-canvas canvas').boundingBox(); assert.ok(canvas);
  const camera = await page.evaluate(() => ({...window.rts.camera}));
  const projected = {x: 1600 + (target.x - target.y) * 32, y: 80 + (target.x + target.y) * 16};
  const point = {x: canvas.x + (projected.x - camera.x) * camera.zoom * canvas.width / camera.width, y: canvas.y + (projected.y - camera.y) * camera.zoom * canvas.height / camera.height};
  assert.ok(point.x >= canvas.x && point.x <= canvas.x + canvas.width && point.y >= canvas.y && point.y <= canvas.y + canvas.height, 'Projected ground click must be on the real canvas.');
  const priorOrdinal = profile.wireOrdinal;
  const {actionId} = await ui(profile, 'canvas-attack-move', {reason, commonHqId, target, selectedIds: display.selectedIds, selectedUnits: display.selectedUnits, displayedTick: display.tick, canvas, camera, projected, point, button: 'left', precedingKeys: ['F2', 'a']}, () => page.mouse.click(point.x, point.y));
  const commandRow = await waitUntil(() => profile.commands.find(row => row.wireOrdinal > priorOrdinal), 5_000, 'Canvas action sent no command.');
  const command = commandRow.message;
  assert.equal(command.command.type, 'attackMove', 'The UI click must send an attackMove, rather than an entity-specific action.');
  assert.deepEqual([...command.command.ids].sort((a, b) => a - b), [...display.selectedIds].sort((a, b) => a - b));
  assert.ok(Math.abs(command.command.x - target.x) < .1 && Math.abs(command.command.y - target.y) < .1);
  const ackRow = await waitUntil(() => profile.acks.find(row => row.socketId === commandRow.socketId && row.message.clientSeq === command.clientSeq), 10_000, `No commandAck for ${command.clientSeq}.`);
  assert.equal(ackRow.message.accepted, true); assert.ok(Number.isSafeInteger(ackRow.message.appliedTick));
  const accepted = {profile: profile.name, side: profile.side, uiActionId: actionId, id: actionId, kind: 'canvas-keyboard-attack-move', completed: true, socketId: commandRow.socketId, selectedIds: display.selectedIds, eligibleCommandedIds, eligibilityFrameTick: eligibilityFrame.tick, eligibilityWireOrdinal: eligibilityFrame.wireOrdinal, commandWireOrdinal: commandRow.wireOrdinal, ackWireOrdinal: ackRow.wireOrdinal, clientSeq: command.clientSeq, appliedTick: ackRow.message.appliedTick, command, ack: ackRow.message,
    steps: [{kind: 'key-down', key: 'F2', actionId: selectionAction.actionId}, {kind: 'key-up', key: 'F2', actionId: selectionAction.actionId}, {kind: 'minimap-click', button: 'left', point: minimapPoint, actionId: minimapAction.actionId}, {kind: 'key-down', key: 'a', actionId: attackKeyAction.actionId}, {kind: 'key-up', key: 'a', actionId: attackKeyAction.actionId}, {kind: 'canvas-click', button: 'left', point, target, actionId}]};
  profile.acceptedAttackMoves.push(accepted);
  append(`${profile.name}-ui-actions.ndjson`, {schema: 'feature63-public-ui-action-v1', profile: profile.name, side: profile.side, actionId, action: 'canvas-attack-move', state: 'accepted', capturedAt: new Date().toISOString(), ...accepted});
  return accepted;
}

function indexWindow() {
  const endTick = sharedLatest();
  if (endTick === null || profiles.some(p => !p.acceptedAttackMoves.length)) return null;
  const firstCommandTick = Math.max(...profiles.map(p => p.acceptedAttackMoves[0].appliedTick));
  const lower = Math.max(endTick - WINDOW_TICKS, Math.ceil(firstCommandTick / FRAME_STEP) * FRAME_STEP);
  const firstFrames = profiles[0].frameIndex.filter(f => f.tick >= lower && f.tick <= endTick);
  const secondTicks = new Set(profiles[1].frameIndex.map(f => f.tick));
  const startTick = firstFrames.find(f => secondTicks.has(f.tick))?.tick;
  if (startTick === undefined || startTick >= endTick) return null;
  const ranges = {};
  const allCombat = [];
  let coveragePassed = true, bothHumansAliveThroughout = true;
  for (const profile of profiles) {
    const frames = profile.frameIndex.filter(f => f.tick >= startTick && f.tick <= endTick);
    const prior = profile.frameIndex.findLast(f => f.tick < startTick);
    const contiguous = frames.length === (endTick - startTick) / FRAME_STEP + 1 && frames[0]?.tick === startTick && frames.at(-1)?.tick === endTick
      && frames.every((frame, i) => frame.frameSeq === frame.tick && frame.matchId === result.matchId && (!i || frame.tick - frames[i - 1].tick === FRAME_STEP) && frame.socketId === frames[0].socketId);
    coveragePassed &&= contiguous;
    bothHumansAliveThroughout &&= !!prior && alivePass(prior.alive) && frames.every(f => alivePass(f.alive));
    ranges[profile.name] = {firstWireOrdinal: frames[0]?.wireOrdinal ?? null, lastWireOrdinal: frames.at(-1)?.wireOrdinal ?? null, firstFrameTick: frames[0]?.tick ?? null, lastFrameTick: frames.at(-1)?.tick ?? null, frameCount: frames.length, contiguous,
      beforeWindow: prior ? {tick: prior.tick, wireOrdinal: prior.wireOrdinal, alive: prior.alive} : null};
    allCombat.push(...frames.flatMap(f => f.combat).filter(e => e.tick > startTick && e.tick <= endTick));
  }
  const unique = new Map();
  for (const event of allCombat) {
    const previous = unique.get(event.eventId);
    if (previous && ['tick', 'side', 'source', 'target', 'amount'].some(k => previous[k] !== event[k])) { coveragePassed = false; continue; }
    if (!previous) unique.set(event.eventId, event);
  }
  const acceptedAttackMoves = profiles.flatMap(p => p.acceptedAttackMoves.filter(c => c.appliedTick <= startTick));
  const combatEvents = [...unique.values()];
  const humanEvents = combatEvents.filter(e => [0, 1].includes(e.side) && acceptedAttackMoves.some(c => c.side === e.side && c.eligibleCommandedIds.includes(e.source) && c.command.command.ids.includes(e.source)));
  const aiEvents = combatEvents.filter(e => [2, 3].includes(e.side) && [0, 1].includes(e.targetSide));
  const humanOwners = [...new Set(humanEvents.map(e => e.side))].sort();
  const humanTargetOwners = [...new Set(humanEvents.map(e => e.targetSide))].sort();
  const aiOwners = [...new Set(aiEvents.map(e => e.side))].sort();
  const commandOwners = [...new Set(acceptedAttackMoves.map(c => c.side))].sort();
  // Original feature 63 requires the human attack targets to cover both natural AI owners.
  const publicPredicatePassed = coveragePassed && bothHumansAliveThroughout && JSON.stringify(commandOwners) === '[0,1]' && JSON.stringify(humanOwners) === '[0,1]' && JSON.stringify(humanTargetOwners) === '[2,3]';
  const value = {startTick, endTick, maxTicks: WINDOW_TICKS, profileFrameRanges: ranges, coveragePassed, bothHumansAliveThroughout, acceptedAttackMoves, combatEvents, humanEventIds: humanEvents.map(e => e.eventId), aiEventIds: aiEvents.map(e => e.eventId), humanOwners, humanTargetOwners, aiOwners, publicPredicatePassed, nativeParticipantOverlapUnverified: true};
  const signature = JSON.stringify([startTick, combatEvents.map(e => e.eventId), publicPredicatePassed]);
  if (!candidateSignatures.has(signature)) { candidateSignatures.add(signature); candidates.push(value); }
  save('public-windows.json', {schema: 'feature63-public-windows-v1', sourcePin: binding.head, matchId: result.matchId, maxTicks: WINDOW_TICKS, requiredFrameStep: FRAME_STEP, frameSeqRelation: 'equals tick', candidates, selectedCandidateIndex: publicPredicatePassed ? candidates.length - 1 : null});
  return publicPredicatePassed ? candidates.length - 1 : null;
}
function identities() {
  return {schema: 'feature63-public-identities-v1', sourcePin: binding.head, matchId: result.matchId, lobbyId: result.lobbyId, seatsText: result.seatsText ?? [], receivedRulesText: result.receivedRulesText ?? [], lobbyResponse: result.lobbyResponse ?? null, expectedTeams: [0, 0, 1, 1], expectedControllers: ['external', 'external', 'ai', 'ai'], humans: profiles.map(p => ({profile: p.name, side: p.side, account: p.account, guestResponse: p.guestResponse ?? null})), profiles: profiles.map(p => ({profile: p.name, side: p.side, contextId: p.contextId, username: p.username, pageBuild: p.pageBuild ?? null, helloMessages: p.hellos, latestTopology: p.latest ? {tick: p.latest.message.tick, side: p.latest.message.view.side, controller: p.latest.message.view.controller, teamId: p.latest.message.view.teamId, sharedVision: p.latest.message.view.sharedVision, rulesMode: p.latest.message.view.rules.mode, allies: p.latest.message.view.allies, opponents: p.latest.message.view.opponents} : null}))};
}

try {
  // These imports are unreachable with the supplied pending assignment.
  deadline = Date.now() + ATTEMPT_MS;
  attemptTimer = setTimeout(() => beginStop(new Error('One public attempt reached its 300-second bound.'), 'timeout'), ATTEMPT_MS);
  const {chromium} = await import(pathToFileURL(binding.dependencies.playwrightModulePath).href);
  checkpoint();
  browser = await chromium.connectOverCDP(binding.dependencies.cdpBaseUrl, {timeout: 15_000});
  save('browser-ownership.json', {schema: 'feature63-public-browser-ownership-v1', sourcePin: binding.head, browserCount: 1, contextCount: 2, executable: binding.dependencies.chromiumExecutable, browserVersion: browser.version(), owner: '/root/ai_modes', exclusiveSlotToken: binding.assignment.exclusiveHeavyApproval.token, cleanupMethod: 'close only returned contexts and disconnect the attached CDP connection; dedicated wrapper closes the native Chromium child', contexts: []});
  phase = 'opening two normal guest contexts';
  const first = await guest('human-one', 0), second = await guest('human-two', 1);
  assert.notEqual(first.username, second.username); assert.notEqual(first.contextId, second.contextId);
  assert.notEqual(first.account.id, second.account.id);
  phase = 'normal two-human versus two-AI annihilation lobby';
  await ui(first, 'select', {label: 'Lobby player count', value: '4'}, () => first.page.getByLabel('Lobby player count', {exact: true}).selectOption('4'));
  await ui(first, 'select', {label: 'Lobby map size', value: 'small'}, () => first.page.getByLabel('Lobby map size', {exact: true}).selectOption('small'));
  await ui(first, 'select', {label: 'Lobby starting age', value: '1'}, () => first.page.getByLabel('Lobby starting age', {exact: true}).selectOption('1'));
  for (let player = 1; player <= 4; player++) {
    const team = player <= 2 ? '0' : '1', controller = player <= 2 ? 'human' : 'ai';
    await ui(first, 'select', {label: `Lobby player ${player} team`, value: team}, () => first.page.getByLabel(`Lobby player ${player} team`, {exact: true}).selectOption(team));
    await ui(first, 'select', {label: `Lobby player ${player} controller`, value: controller}, () => first.page.getByLabel(`Lobby player ${player} controller`, {exact: true}).selectOption(controller));
  }
  await ui(first, 'checkbox', {label: 'Lobby shared vision', value: true}, () => first.page.getByLabel('Lobby shared vision', {exact: true}).check());
  await clickRole(first, 'Create lobby'); await first.page.waitForSelector('.online-current:not([hidden])');
  result.lobbyId = (await first.page.locator('.online-lobby-id').textContent()).split(' · ', 1)[0].trim();
  await refresh(second); await clickRole(second, `Join lobby ${result.lobbyId}`); await second.page.waitForSelector('.online-current:not([hidden])');
  for (const profile of [first, second]) { await refresh(profile); await ui(profile, 'ready', {selector: '[data-online="ready"]'}, () => profile.page.locator('[data-online="ready"]').click()); await profile.page.waitForFunction(() => document.querySelector('[data-online="ready"]')?.getAttribute('aria-pressed') === 'true'); }
  const lobbyResponsePromise = first.page.waitForResponse(response => response.url() === `${BASE_URL}/api/lobbies/${encodeURIComponent(result.lobbyId)}` && response.request().method() === 'GET', {timeout: 10_000});
  await refresh(first);
  const lobbyResponse = await lobbyResponsePromise;
  const lobbyPayload = await lobbyResponse.text();
  result.lobbyResponse = {url: lobbyResponse.url(), status: lobbyResponse.status(), payload: lobbyPayload};
  const lobby = JSON.parse(lobbyPayload).lobby;
  assert.equal(lobby.id, result.lobbyId); assert.equal(lobby.seats.length, 4);
  for (const profile of profiles) { assert.equal(lobby.seats[profile.side].account.id, profile.account.id); assert.equal(lobby.seats[profile.side].account.username, profile.username); }
  assert.deepEqual(lobby.settings.players.map(p => p.teamId), [0, 0, 1, 1]);
  assert.deepEqual(lobby.settings.players.map(p => p.controller), ['human', 'human', 'ai', 'ai']);
  status('normal-lobby-response', result.lobbyResponse);
  result.seatsText = await first.page.locator('.online-seats li').allTextContents();
  result.receivedRulesText = await first.page.locator('.online-received-rule-values').allTextContents();
  assert.equal(result.seatsText.length, 4);
  assert.ok(result.seatsText.slice(0, 2).every(text => /Guest.*Team 1/.test(text)) && result.seatsText.slice(2).every(text => /AI.*Team 2.*AI ready/.test(text)));
  await clickRole(first, 'Start match'); await battlefield(first);
  await refresh(second); await ui(second, 'rejoin', {selector: '.online-current [data-online="rejoin"]'}, () => second.page.locator('.online-current [data-online="rejoin"]').click()); await battlefield(second);
  result.matchId = first.hellos.at(-1).message.matchId;
  assert.equal(second.hellos.at(-1).message.matchId, result.matchId);
  for (const profile of profiles) { assert.ok(topologyPass(profile.latest.message, profile.side)); assert.ok(alivePass(profile.latest.alive), 'Both human HQs must begin alive.'); }
  // One early public identity allows a separate root-owned passive collector to bind
  // the match. No native collector output is ever read by this UI producer.
  save('public-match-identity.json', {schema: 'feature63-public-match-identity-v1', sourcePin: binding.head, matchId: result.matchId, lobbyId: result.lobbyId, capturedAt: new Date().toISOString(), expectedTeams: [0, 0, 1, 1], expectedControllers: ['external', 'external', 'ai', 'ai'], accounts: profiles.map(p => ({profile: p.name, side: p.side, account: p.account, guestResponse: p.guestResponse})), hellos: profiles.map(p => ({profile: p.name, side: p.side, socketId: p.hellos.at(-1).socketId, wireOrdinal: p.hellos.at(-1).wireOrdinal, message: p.hellos.at(-1).message}))});
  save('public-identities.json', identities());
  phase = 'bringing both combat armies near the same allied HQ';
  const commonHq = first.latest.message.view.entities.find(e => e.side === 0 && e.kind === 'building' && e.role === 'hq' && e.hp > 0 && e.progress === 1);
  assert.ok(commonHq);
  result.commonHq = {id: commonHq.id, side: commonHq.side, x: commonHq.x, y: commonHq.y, observedAtTick: first.latest.message.tick};
  let target = groundTarget(commonHq, null, first.latest.message.view.entities, first.latest.message.view.map.width, first.latest.message.view.map.height);
  for (const profile of profiles) await attackMove(profile, target, commonHq.id, 'defend the same allied HQ');
  phase = 'retaining a natural shared AI fight candidate';
  let lastCommandAt = Date.now(), lastHostileId = null;
  while (true) {
    checkpoint();
    for (const profile of profiles) { assert.ok(topologyPass(profile.latest.message, profile.side)); assert.ok(alivePass(profile.latest.alive), 'A human HQ was lost.'); }
    const selected = indexWindow();
    if (selected !== null) { result.selectedCandidateIndex = selected; result.publicCandidatePassed = true; break; }
    const frame = first.latest.message;
    const hq = frame.view.entities.find(e => e.id === commonHq.id && e.hp > 0); assert.ok(hq, 'Common human HQ is no longer observed alive.');
    const hostile = frame.view.entities.filter(e => [2, 3].includes(e.side) && e.kind === 'unit' && e.hp > 0 && Math.hypot(e.x - hq.x, e.y - hq.y) <= 12).sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
    if (hostile && Date.now() - lastCommandAt >= 4_000 && hostile.id !== lastHostileId) {
      target = groundTarget(hq, hostile, frame.view.entities, frame.view.map.width, frame.view.map.height);
      for (const profile of profiles) await attackMove(profile, target, commonHq.id, `visible hostile owner ${hostile.side} near common HQ`);
      lastCommandAt = Date.now(); lastHostileId = hostile.id;
    }
    await pause(250);
  }
  assert.equal(errors.length, 0, 'Acquisition errors prevent public pass.');
  result.status = 'candidate-public-pass';
} catch (error) {
  if (!firstFailure) firstFailure = {kind: 'acquisition', phase, message: error instanceof Error ? error.message : String(error), capturedAt: new Date().toISOString()};
  try { errorRecord('attempt', firstFailure.message); } catch (writeError) { errors.push({kind: 'failure-write', message: String(writeError)}); }
  result.status = 'candidate-public-fail'; result.publicCandidatePassed = false;
} finally {
  if (attemptTimer) clearTimeout(attemptTimer);
  // Preserve partial evidence even when the attempt fails before a combat window exists.
  try { if (profiles.length === 2 && !result.publicCandidatePassed) indexWindow(); } catch (error) { errorRecord('final-window', String(error)); }
  save('public-identities.json', identities());
  if (!candidates.length) save('public-windows.json', {schema: 'feature63-public-windows-v1', sourcePin: binding.head, matchId: result.matchId, maxTicks: WINDOW_TICKS, requiredFrameStep: FRAME_STEP, frameSeqRelation: 'equals tick', candidates: [], selectedCandidateIndex: null});
  cleanup.startedAt = new Date().toISOString();
  const cleanupDeadline = Date.now() + CLEANUP_MS;
  async function closeOwned(label, action) {
    const remaining = Math.max(1, cleanupDeadline - Date.now());
    let timer;
    try { await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned cleanup bound reached.')), remaining); })]); return true; }
    catch (error) { cleanup.failures.push({label, message: String(error)}); return false; }
    finally { clearTimeout(timer); }
  }
  for (const profile of profiles) cleanup.contexts.push({profile: profile.name, contextId: profile.contextId, closed: await closeOwned(profile.name, () => profile.context.close()), sockets: profile.sockets});
  if (browser) cleanup.browserClosed = await closeOwned('browser', () => browser.close());
  else cleanup.browserClosed = true;
  cleanup.completedAt = new Date().toISOString();
  cleanup.matchId = result.matchId;
  cleanup.allOwnedBrowsersClosed = cleanup.browserClosed && cleanup.contexts.every(c => c.closed) && cleanup.failures.length === 0;
  cleanup.captureFailures = errors.filter(error => ['capture', 'capture-write', 'page', 'socket'].includes(error.kind));
  result.cleanupPassed = cleanup.browserClosed && cleanup.contexts.every(c => c.closed) && cleanup.failures.length === 0;
  if (!result.cleanupPassed || errors.length || firstFailure) { result.status = 'candidate-public-fail'; result.publicCandidatePassed = false; }
  result.firstFailure = firstFailure;
  result.completedAt = new Date().toISOString(); result.phaseAtStop = phase;
  result.retainedBytesBeforeFinalSummary = retainedBytes;
  result.errors = errors; result.candidateCount = candidates.length;
  result.acquisitionFailures = errors;
  result.limitations = ['Public pass is only a candidate. Native source/config/checkpoint/wave participant composition remains unverified.', 'Original feature 63 stops after both commanded human attacks whose targets cover AI owners 2 and 3; native audit must authenticate membership in the same coordinated wave.', 'Normal Save battle is unavailable online in the reference source; contemporaneous native wave retention remains pending.', 'No complete cooperative victory or continuous human input is claimed.', 'All exposed public payloads and frames are retained; resource breach stops new work without deleting or truncating evidence.', 'Current source-derived selectors, projection, elimination fields and four-tick snapshot cadence require review against the new root-assigned product source.'];
  save('public-cleanup.json', cleanup);
  save('browser-ownership.json', {schema: 'feature63-public-browser-ownership-v1', sourcePin: binding.head, browserCount: browser ? 1 : 0, executable: binding.dependencies.chromiumExecutable, owner: '/root/ai_modes', exclusiveSlotToken: binding.assignment.exclusiveHeavyApproval.token, contexts: profiles.map(p => ({profile: p.name, side: p.side, contextId: p.contextId, sockets: p.sockets})), cleanup});
  result.resourceFailure = resourceFailure;
  if (resourceFailure) { result.status = 'candidate-public-fail'; result.publicCandidatePassed = false; result.firstFailure = firstFailure; }
  save('public-results.json', result);
  if (resourceFailure && (!result.resourceFailure || result.publicCandidatePassed)) { result.status = 'candidate-public-fail'; result.publicCandidatePassed = false; result.resourceFailure = resourceFailure; result.firstFailure = firstFailure; save('public-results.json', result); }
}
if (!result.publicCandidatePassed) process.exitCode = 1;
console.log(JSON.stringify({status: result.status, publicCandidatePassed: result.publicCandidatePassed, feature63Qualified: false, evidenceDirectory: out}));
