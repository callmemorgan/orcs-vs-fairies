import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Ordinary production controls only. Every page.evaluate and waitForFunction
// callback reads the public diagnostics or DOM; no game commands/state writes.
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5371';
const sourceRoot = resolve(process.argv[3] ?? '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies');
const out = resolve(process.env.OVF_ALLIED_BROWSER_PROOF_OUTPUT ?? join(sourceRoot, 'work/assembled-allied-browser'));
await mkdir(out, { recursive: true });
const sourceHash = createHash('sha256');
for (const path of (await readdir(join(sourceRoot, 'src'), { recursive: true })).filter(path => /\.(ts|css)$/.test(path)).sort()) {
  sourceHash.update(path); sourceHash.update(await readFile(join(sourceRoot, 'src', path)));
}
const expectedBuildId = sourceHash.digest('hex');
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const profiles = [], errors = [], captureErrors = [], observations = {};
const evidence = { base, sourceRoot, expectedBuildId, startedAt: new Date().toISOString(), checks: [], pageBuilds: [], limits: [] };
let phase = 'initialization';
const exploratory = process.env.OVF_ALLIED_EXPLORATORY === '1';
evidence.exploratory = exploratory; evidence.knownFailures = [];
function exploratoryAssert(actual, expected, name) {
  if (exploratory && JSON.stringify(actual) !== JSON.stringify(expected)) { evidence.knownFailures.push({ name, actual, expected }); console.log(`Exploratory defect: ${name}`); return false; }
  assert.deepEqual(actual, expected, name); return true;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const record = (name, details = true) => { evidence.checks.push({ name, details }); console.log(`${name}: ${JSON.stringify(details)}`); };
const json = (file, value) => writeFile(join(out, file), JSON.stringify(value, null, 2));
async function until(fn, message, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await fn(); if (value) return value; await sleep(100); }
  throw new Error(message);
}
async function profile(name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const p = { name, context, page, sent: [], receipts: [], snapshots: [], hellos: [] }; profiles.push(p);
  page.on('pageerror', error => errors.push({ profile: name, message: error.message }));
  page.on('websocket', socket => {
    socket.on('framesent', event => { try { const message = JSON.parse(event.payload); if (message.kind === 'command') p.sent.push(message); } catch (error) { captureErrors.push({ profile: name, direction: 'sent', message: String(error) }); } });
    socket.on('framereceived', event => { try {
      const message = JSON.parse(event.payload);
      if (message.kind === 'hello') p.hellos.push(message);
      if (message.kind === 'commandAck') p.receipts.push(message);
      if (message.kind === 'snapshot') p.snapshots.push(message);
    } catch (error) { captureErrors.push({ profile: name, direction: 'received', message: String(error) }); } });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  evidence.pageBuilds.push({ profile: name, ...await page.evaluate(() => ({ url: location.href, moduleScripts: Array.from(document.querySelectorAll('script[type="module"][src]'), node => node.src), stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'), node => node.href) })) });
  return p;
}
async function ready(p, mode, side = 0) {
  await p.page.waitForFunction(({ mode, side }) => {
    try { const r = window.rts; return document.querySelector('.loading-battle')?.hidden && !!document.querySelector('#game-canvas canvas') && r?.mode === mode && r.viewSide === side && !!r.camera; } catch { return false; }
  }, { mode, side }, { timeout: 60000 });
}
const launch = p => p.page.locator('button[data-team-ai-tool="requests"]');
const dialog = p => p.page.getByRole('dialog', { name: 'Ally requests', exact: true });
const session = p => p.page.getByRole('dialog', { name: 'Session tools', exact: true });
async function snap(p) {
  return p.page.evaluate(() => {
    const r = window.rts, s = r.state, side = r.viewSide;
    return { tick: s.tick, time: s.time, paused: r.paused, mode: r.mode, readOnly: r.readOnly, simulationEnabled: r.simulationEnabled,
      side, teams: s.teams, controllers: s.controllers, online: r.online, camera: r.camera, selected: [...r.selected],
      banks: s.players.map((player, side) => ({ side, wood: player.wood, ore: player.ore, crystal: player.crystal })),
      entities: s.entities.filter(e => e.hp > 0).map(e => ({ id: e.id, side: e.side, kind: e.kind, role: e.role, x: e.x, y: e.y, level: e.level ?? 0, hp: e.hp, order: e.order, queue: e.queue, orderQueue: e.orderQueue ?? [] })),
      allyDialog: { open: !document.querySelector('.team-ai-overlay')?.hidden, disabled: document.querySelector('[data-team-ai-tool="requests"]')?.disabled, expanded: document.querySelector('[data-team-ai-tool="requests"]')?.getAttribute('aria-expanded'), focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent },
      receipts: Array.from(document.querySelectorAll('.ally-directives-list li[data-directive-id]'), node => ({ id: Number(node.dataset.directiveId), text: node.querySelector('span')?.textContent, cancelVisible: !node.querySelector('[data-cancel-directive]')?.hidden })) };
  });
}
async function shot(p, name) { await p.page.screenshot({ path: join(out, `${p.name}-${name}.png`) }); }
async function openAlly(p) {
  await launch(p).waitFor({ state: 'visible' }); await until(() => launch(p).isEnabled(), 'Ally request launcher stayed disabled');
  await launch(p).click(); await dialog(p).waitFor({ state: 'visible' });
  await p.page.waitForFunction(() => window.rts?.paused === true);
  assert.equal(await launch(p).getAttribute('aria-expanded'), 'true');
}
async function closeAlly(p, viaEscape = false) {
  if (viaEscape) {
    await p.page.keyboard.press('Escape');
    if (exploratory && await dialog(p).isVisible()) { evidence.knownFailures.push({ name: 'Escape from form did not close ally dialog' }); await dialog(p).getByRole('button', { name: 'Close ally requests', exact: true }).click(); }
  }
  else await dialog(p).getByRole('button', { name: 'Close ally requests', exact: true }).click();
  await dialog(p).waitFor({ state: 'hidden' });
  assert.equal(await launch(p).getAttribute('aria-expanded'), 'false');
  assert.equal(await p.page.evaluate(() => document.activeElement?.hasAttribute('data-team-ai-tool')), true, 'Closing the modal must restore launch-button focus');
}
async function row(p, id, status, timeout = 15000) {
  await p.page.waitForFunction(({ id, status }) => document.querySelector(`[data-directive-id="${id}"] span`)?.textContent?.endsWith(` · ${status}`), { id, status }, { timeout });
  return p.page.locator(`[data-directive-id="${id}"]`).textContent();
}
async function sendDestination(p, kind, point) {
  const before = await p.page.locator('.ally-directives-list [data-directive-id]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.directiveId)));
  await dialog(p).getByLabel('Allied AI recipient', { exact: true }).selectOption('1');
  await dialog(p).getByLabel('Ally request', { exact: true }).selectOption(kind);
  await dialog(p).getByLabel('Destination X', { exact: true }).fill(String(point.x));
  await dialog(p).getByLabel('Destination Y', { exact: true }).fill(String(point.y));
  await dialog(p).getByLabel('Destination level', { exact: true }).selectOption(String(point.level ?? 0));
  const startSent = p.sent.length; await dialog(p).getByRole('button', { name: 'Send request', exact: true }).click();
  const id = await until(async () => {
    const ids = await p.page.locator('.ally-directives-list [data-directive-id]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.directiveId)));
    return ids.find(id => !before.includes(id));
  }, 'Sending through the ally request form produced no receipt');
  const transmitted = p.sent.slice(startSent).find(message => message.command.type === 'allyDirective');
  return { id, transmitted };
}
async function download(p, button, name) {
  const pending = p.page.waitForEvent('download'); await button.click(); const item = await pending;
  const path = join(out, `${p.name}-${name}.json`); await item.saveAs(path);
  return { path, value: JSON.parse(await readFile(path, 'utf8')) };
}
async function exportLocal(p, name = 'save') {
  await p.page.locator('[data-session-tool="saves"]').click(); await session(p).waitFor({ state: 'visible' });
  const result = await download(p, session(p).getByRole('button', { name: 'Export save', exact: true }), name);
  await session(p).getByRole('button', { name: 'Close session tools', exact: true }).click(); await session(p).waitFor({ state: 'hidden' });
  return result;
}
async function ack(p, transmitted) {
  assert.ok(transmitted, 'The form must produce a captured command');
  const receipt = await until(() => p.receipts.find(item => item.clientSeq === transmitted.clientSeq), `No authenticated server acknowledgement for sequence ${transmitted.clientSeq}`);
  assert.equal(receipt.accepted, true); return receipt;
}
async function receivedDirective(p, id, statuses, minTick = 0, timeout = 15000) {
  return until(() => p.snapshots.findLast(frame => frame.tick >= minTick && frame.view.alliedAi?.directives.some(d => d.id === id && statuses.includes(d.status))), `No authoritative ${statuses.join('/')} snapshot for directive ${id}`, timeout);
}
function checkPublicMetadata(view, expectedTeam = 0) {
  assert.ok(view.alliedAi);
  const directiveKeys = new Set(['id', 'issuer', 'recipient', 'kind', 'destination', 'observedTarget', 'resources', 'createdAt', 'expiresAt', 'status', 'arrivedAt', 'reason']);
  const transferKeys = new Set(['id', 'sender', 'recipient', 'resources', 'time']);
  for (const directive of view.alliedAi.directives) {
    for (const key of Object.keys(directive)) assert.ok(directiveKeys.has(key), `Private or unknown directive field ${key}`);
    assert.equal(Object.hasOwn(directive, 'assigned'), false);
    assert.equal(directive.issuer <= 1 ? 0 : 1, expectedTeam);
  }
  for (const transfer of view.alliedAi.transfers) for (const key of Object.keys(transfer)) assert.ok(transferKeys.has(key), `Private or unknown transfer field ${key}`);
  for (const roster of [view.allies, view.opponents]) for (const member of roster ?? []) assert.deepEqual(Object.keys(member).sort(), ['faction', 'side', 'teamId']);
  assert.equal(Object.hasOwn(view, 'players'), false); assert.equal(Object.hasOwn(view, 'teamPlayers'), false);
  for (const e of view.entities.filter(e => e.side !== view.side)) for (const key of ['order', 'orderQueue', 'queue', 'research', 'wood', 'ore', 'crystal']) assert.equal(Object.hasOwn(e, key), false, `Foreign entity leaked ${key}`);
  return { directives: view.alliedAi.directives.map(d => ({ id: d.id, status: d.status, keys: Object.keys(d).sort() })), transfers: view.alliedAi.transfers, ownBank: { wood: view.player.wood, ore: view.player.ore, crystal: view.player.crystal }, privateRosterBanksAbsent: true };
}
async function guest(name) {
  const p = await profile(name);
  await p.page.getByRole('button', { name: 'Online', exact: true }).click();
  await p.page.getByRole('button', { name: 'Play as guest', exact: true }).click();
  await p.page.waitForFunction(() => !document.querySelector('.online-account')?.hidden && document.querySelector('.online-username')?.textContent?.startsWith('Guest'));
  p.username = await p.page.locator('.online-username').textContent(); return p;
}
async function selectWorker(p) {
  const target = await p.page.evaluate(() => {
    const r = window.rts, e = r.state.entities.find(e => e.side === r.viewSide && e.kind === 'unit' && e.role === 'worker' && e.hp > 0);
    const canvas = document.querySelector('#game-canvas canvas'), rect = canvas.getBoundingClientRect(), c = r.camera;
    const wx = 1600 + 32 * (e.x - e.y), wy = 80 + 16 * (e.x + e.y) - 15;
    const px = c.width / 2 + (wx - c.x - c.width / 2) * c.zoom;
    const py = c.height / 2 + (wy - c.y - c.height / 2) * c.zoom;
    return { id: e.id, x: rect.left + px * rect.width / canvas.width, y: rect.top + py * rect.height / canvas.height };
  });
  await p.page.mouse.click(target.x, target.y);
  await p.page.waitForFunction(id => window.rts.selected.length === 1 && window.rts.selected[0] === id, target.id);
  return target.id;
}
async function blockedPointerKeyboard(p, stableLocal = false) {
  const baseline = stableLocal ? await snap(p) : undefined;
  const check = async action => {
    if (!stableLocal) return;
    const current = await snap(p);
    assert.equal(current.tick, baseline.tick, `${action} advanced paused time`);
    assert.deepEqual(current.selected, baseline.selected, `${action} changed selection through the modal`);
    assert.deepEqual(current.entities, baseline.entities, `${action} changed an order through the modal`);
    assert.deepEqual(current.camera, baseline.camera, `${action} moved the camera through the modal`);
  };
  for (const key of ['F2', 'a', 'h', 'x', 'q']) { await p.page.keyboard.press(key); await check(key); }
  await p.page.keyboard.down('ArrowRight'); await sleep(250); await p.page.keyboard.up('ArrowRight'); await check('camera key');
  await p.page.mouse.click(260, 280); await check('battlefield left click');
  await p.page.mouse.click(270, 295, { button: 'right' }); await check('battlefield right click');
  await p.page.mouse.move(280, 300); await p.page.mouse.wheel(0, -150); await sleep(350); await check('battlefield wheel');
}

try {
  phase = 'ordinary local 2v2 match setup';
  const local = await profile('local');
  await local.page.locator('[data-faction="orcs"]').click();
  await local.page.locator('#opponent').selectOption('fairies');
  await local.page.locator('#map-size').selectOption('large');
  await local.page.locator('#map-seed').fill('4127');
  await local.page.getByLabel('Enable team match setup', { exact: true }).check();
  await local.page.getByLabel('Match preset', { exact: true }).selectOption('2v2');
  await local.page.getByLabel('Player 2 faction', { exact: true }).selectOption('orcs');
  await local.page.getByLabel('Shared team vision', { exact: true }).check();
  await local.page.locator('.begin-match').click(); await ready(local, 'local');
  const initial = await snap(local); observations.localInitial = initial;
  assert.deepEqual(initial.teams, [0, 0, 1, 1]); assert.deepEqual(initial.controllers, ['human', 'ai', 'ai', 'ai']);
  assert.equal(initial.paused, false); assert.equal(initial.simulationEnabled, true);
  record('Ordinary local controls launch human 0 with allied AI 1 against enemy AI 2/3', { teams: initial.teams, controllers: initial.controllers });
  await local.page.keyboard.press('F2'); await local.page.waitForFunction(() => window.rts.selected.length > 0);
  const modalWorkerId = await selectWorker(local);

  phase = 'local modal pause, focus trap and battlefield input suppression';
  await openAlly(local);
  assert.equal(await local.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close ally requests');
  assert.deepEqual(await dialog(local).getByLabel('Allied AI recipient', { exact: true }).locator('option').evaluateAll(options => options.map(o => o.value)), ['1']);
  await local.page.keyboard.press('Shift+Tab');
  assert.equal(await local.page.evaluate(() => document.activeElement?.textContent), 'Send request');
  await local.page.keyboard.press('Tab');
  if (!exploratoryAssert(await local.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close ally requests', 'Tab from inner form must trap focus')) await dialog(local).getByRole('button', { name: 'Close ally requests', exact: true }).focus();
  const beforeBlocked = await snap(local); assert.deepEqual(beforeBlocked.selected, [modalWorkerId]);
  assert.ok(beforeBlocked.entities.some(e => e.side === 0 && e.kind === 'unit' && e.role !== 'worker' && !beforeBlocked.selected.includes(e.id)), 'F2 must have a different army to select if it leaks');
  await blockedPointerKeyboard(local, true); const afterBlocked = await snap(local);
  assert.equal(afterBlocked.tick, beforeBlocked.tick); assert.equal(afterBlocked.paused, true);
  assert.deepEqual(afterBlocked.selected, beforeBlocked.selected); assert.deepEqual(afterBlocked.camera, beforeBlocked.camera); assert.deepEqual(afterBlocked.entities, beforeBlocked.entities);
  observations.localBlocked = { before: beforeBlocked, after: afterBlocked };
  record(evidence.knownFailures.length ? 'Ally modal pauses local time and blocks battlefield controls; exploratory focus-trap defect recorded' : 'Ally modal pauses local time, traps focus and blocks battlefield selection/orders/keyboard/camera', { tick: afterBlocked.tick, selected: afterBlocked.selected });
  await shot(local, 'modal-paused');

  phase = 'local send accepted and cancellation through mounted requests form';
  await dialog(local).getByRole('button', { name: 'Use selected unit position', exact: true }).click();
  const selectedWorker = beforeBlocked.entities.find(e => e.id === modalWorkerId);
  assert.equal(Number(await dialog(local).getByLabel('Destination X', { exact: true }).inputValue()), selectedWorker.x);
  assert.equal(Number(await dialog(local).getByLabel('Destination Y', { exact: true }).inputValue()), selectedWorker.y);
  record('Selected-unit destination helper reads the owned worker selected through battlefield controls', { id: modalWorkerId, x: selectedWorker.x, y: selectedWorker.y });
  const far = { x: 32, y: 32, level: 0 }; const cancelled = await sendDestination(local, 'scout', far);
  await row(local, cancelled.id, 'Accepted'); await shot(local, 'accepted');
  await dialog(local).locator(`[data-cancel-directive="${cancelled.id}"]`).click(); await row(local, cancelled.id, 'Cancelled');
  assert.equal(await dialog(local).locator(`[data-cancel-directive="${cancelled.id}"]`).isVisible(), false);
  record('Local form accepts a scout while paused and its own Cancel control cancels it', { id: cancelled.id });
  const allyFighter = (await snap(local)).entities.find(e => e.side === 1 && e.kind === 'unit' && e.role !== 'worker'); assert.ok(allyFighter);
  const defended = await sendDestination(local, 'defend', allyFighter); await row(local, defended.id, 'Accepted');
  await closeAlly(local, true); await local.page.waitForFunction(() => !window.rts.paused);
  await local.page.waitForFunction(tick => window.rts.state.tick >= tick + 20, afterBlocked.tick);
  await openAlly(local); await row(local, defended.id, 'Active'); observations.localActive = await snap(local); await shot(local, 'active');
  await closeAlly(local);
  const activeSave = await exportLocal(local, 'active-save');
  const activeDirective = activeSave.value.game.runtime.teamAI.directives.find(d => d.id === defended.id);
  assert.equal(activeDirective.status, 'active'); assert.ok(activeDirective.assigned.length > 0);
  assert.ok(activeDirective.assigned.every(id => activeSave.value.game.state.entities.some(e => e.id === id && e.side === 1 && e.kind === 'unit')));
  record('Closing restores running simulation and the ally activates the request with owned troops', { id: defended.id, assigned: activeDirective.assigned, savedStatus: activeDirective.status, savedTick: activeSave.value.game.state.tick });

  phase = 'local scout reaches completion through normal simulation';
  await openAlly(local);
  const near = (await snap(local)).entities.find(e => e.side === 1 && e.kind === 'unit' && e.role !== 'worker'); assert.ok(near);
  const completed = await sendDestination(local, 'scout', near); await row(local, completed.id, 'Accepted');
  await row(local, defended.id, 'Cancelled'); await closeAlly(local);
  await row(local, completed.id, 'Completed', 15000);
  await openAlly(local); await shot(local, 'completed'); observations.localCompleted = await snap(local);
  assert.equal(await dialog(local).locator(`[data-cancel-directive="${completed.id}"]`).isVisible(), false);
  await closeAlly(local);
  const completeSave = await exportLocal(local, 'completed-save');
  const finishedDirective = completeSave.value.game.runtime.teamAI.directives.find(d => d.id === completed.id);
  assert.equal(finishedDirective.status, 'completed'); assert.deepEqual(finishedDirective.assigned, []);
  record('Local ally scout reaches its destination and displays Completed; replacement cancels the prior defend', { completed: finishedDirective, replacedId: defended.id });

  phase = 'manual pause and competing modal restrictions';
  await local.page.locator('#pause-button').click(); await local.page.waitForFunction(() => window.rts.paused); await until(() => launch(local).isDisabled(), 'Ally launcher remained enabled during manual pause');
  assert.equal(await dialog(local).isVisible(), false); const manuallyPaused = await snap(local);
  await local.page.locator('[data-session-tool="saves"]').click(); await session(local).waitFor({ state: 'visible' }); assert.equal(await launch(local).isDisabled(), true);
  await session(local).getByRole('button', { name: 'Close session tools', exact: true }).click(); await session(local).waitFor({ state: 'hidden' });
  assert.equal((await snap(local)).paused, true); assert.equal((await snap(local)).tick, manuallyPaused.tick);
  await local.page.locator('#resume-button').click(); await local.page.waitForFunction(() => !window.rts.paused); await until(() => launch(local).isEnabled(), 'Ally launcher did not recover after resume');
  record('Manual pause disables requests; closing a competing session modal preserves the prior pause', { tick: manuallyPaused.tick });

  phase = 'local photo restriction';
  await local.page.locator('[data-session-tool="photo"]').click(); await local.page.locator('.photo-controls:not([hidden])').waitFor({ state: 'visible' });
  await until(() => launch(local).isDisabled(), 'Ally launcher remained enabled in photo mode');
  const photoBefore = await snap(local); await local.page.keyboard.press('F2'); await local.page.keyboard.press('a'); await local.page.mouse.click(260, 280, { button: 'right' }); await sleep(350); const photoAfter = await snap(local);
  assert.equal(photoAfter.tick, photoBefore.tick); assert.deepEqual(photoAfter.selected, photoBefore.selected); assert.deepEqual(photoAfter.entities, photoBefore.entities);
  await shot(local, 'photo'); await local.page.getByRole('button', { name: 'Exit photo mode', exact: true }).click();
  await local.page.locator('.photo-controls[hidden]').waitFor({ state: 'attached' }); await local.page.waitForFunction(() => !window.rts.paused);
  record('Photo mode disables ally requests and gameplay, then restores the running match');

  phase = 'production provenance and unchanged replay import';
  await local.page.locator('[data-session-tool="report"]').click(); await session(local).waitFor({ state: 'visible' });
  await session(local).getByLabel('Bug description', { exact: true }).fill('Production allied AI request integration proof: inspect request modal behavior and exported replay.');
  const bugReport = await download(local, session(local).getByRole('button', { name: 'Download bug report', exact: true }), 'production-report');
  evidence.buildId = bugReport.value.versions.buildId; exploratoryAssert(evidence.buildId, expectedBuildId, 'Served production build must match inspected source');
  await session(local).locator('[data-session-tab="replay"]').click();
  const replayDownload = await download(local, session(local).getByRole('button', { name: 'Export replay', exact: true }), 'replay');
  await session(local).getByLabel('Import replay JSON', { exact: true }).setInputFiles(replayDownload.path);
  await session(local).getByRole('button', { name: 'Import replay', exact: true }).click(); await ready(local, 'replay');
  await until(() => launch(local).isDisabled(), 'Ally launcher remained enabled in replay');
  await session(local).getByRole('button', { name: 'Close session tools', exact: true }).click(); await session(local).waitFor({ state: 'hidden' });
  const replayBefore = await snap(local); await local.page.keyboard.press('F2'); await local.page.keyboard.press('a'); await local.page.mouse.click(260, 280, { button: 'right' }); await sleep(350); const replayAfter = await snap(local);
  assert.equal(replayAfter.mode, 'replay'); assert.equal(replayAfter.readOnly, true); assert.deepEqual(replayAfter.entities, replayBefore.entities);
  assert.equal(await dialog(local).isVisible(), false); await shot(local, 'replay');
  record('Production build matches source; its unchanged exported replay imports with ally requests disabled', { buildId: evidence.buildId, replayActions: replayDownload.value.actions.length, finalTick: replayDownload.value.finalTick });

  phase = 'real guest authentication and ordinary one-human three-AI online lobby';
  const online = await guest('online');
  await online.page.getByLabel('Lobby player count', { exact: true }).selectOption('4'); await online.page.getByLabel('Lobby map size', { exact: true }).selectOption('large');
  for (let player = 1; player <= 4; player++) { await online.page.getByLabel(`Lobby player ${player} team`, { exact: true }).selectOption(player <= 2 ? '0' : '1'); await online.page.getByLabel(`Lobby player ${player} controller`, { exact: true }).selectOption(player === 1 ? 'human' : 'ai'); }
  await online.page.getByLabel('First lobby faction', { exact: true }).selectOption('orcs'); await online.page.getByLabel('Second lobby faction', { exact: true }).selectOption('orcs'); await online.page.getByLabel('Lobby shared vision', { exact: true }).check();
  await online.page.getByRole('button', { name: 'Create lobby', exact: true }).click(); await online.page.waitForSelector('.online-current:not([hidden])');
  evidence.lobbyId = (await online.page.locator('.online-lobby-id').textContent()).trim();
  await online.page.locator('[data-online="ready"]').click(); await online.page.waitForFunction(() => document.querySelector('[data-online="ready"]')?.getAttribute('aria-pressed') === 'true');
  const seats = await online.page.locator('.online-seats li').allTextContents(); await shot(online, 'lobby');
  await online.page.getByRole('button', { name: 'Start match', exact: true }).click(); await ready(online, 'online');
  const onlineInitial = await snap(online); observations.onlineInitial = onlineInitial;
  assert.deepEqual(onlineInitial.teams, [0, 0, 1, 1]); assert.equal(onlineInitial.readOnly, false); assert.equal(onlineInitial.simulationEnabled, false); assert.deepEqual(onlineInitial.online.privateSides, [0]);
  evidence.matchId = online.hellos.at(-1).matchId;
  record('Real guest creates and starts an authoritative 2v2 with one human and three AI seats', { username: online.username, matchId: evidence.matchId, seats });

  phase = 'online modal command authentication and authoritative statuses';
  await online.page.keyboard.press('F2'); await online.page.waitForFunction(() => window.rts.selected.length > 0);
  await openAlly(online); const onlineModalBefore = await snap(online), beforeModalCommands = online.sent.length;
  await blockedPointerKeyboard(online); const onlineModalAfter = await snap(online);
  assert.equal(online.sent.length, beforeModalCommands, 'Battlefield controls sent commands through an open modal');
  assert.deepEqual(onlineModalAfter.selected, onlineModalBefore.selected); assert.deepEqual(onlineModalAfter.camera, onlineModalBefore.camera);
  assert.ok(onlineModalAfter.tick > onlineModalBefore.tick, 'Authoritative clock must advance while the client dialog is paused');
  record('Online modal blocks gameplay commands and selections while server snapshots keep advancing', { beforeTick: onlineModalBefore.tick, afterTick: onlineModalAfter.tick, sentCommands: online.sent.length });
  const onlineCancelled = await sendDestination(online, 'scout', far); const onlineRequestAck = await ack(online, onlineCancelled.transmitted);
  assert.deepEqual(onlineCancelled.transmitted.command, { type: 'allyDirective', ally: 1, directive: 'scout', x: far.x, y: far.y });
  const firstFrame = await receivedDirective(online, onlineCancelled.id, ['accepted', 'active'], onlineRequestAck.appliedTick);
  const cancelStart = online.sent.length; await dialog(online).locator(`[data-cancel-directive="${onlineCancelled.id}"]`).click();
  const cancelCommand = await until(() => online.sent.slice(cancelStart).find(item => item.command.type === 'cancelAllyDirective'), 'No captured cancellation command');
  assert.deepEqual(cancelCommand.command, { type: 'cancelAllyDirective', directiveId: onlineCancelled.id }); const cancellationAck = await ack(online, cancelCommand);
  const cancelledFrame = await receivedDirective(online, onlineCancelled.id, ['cancelled'], cancellationAck.appliedTick); await row(online, onlineCancelled.id, 'Cancelled');
  record('Online form and cancellation use public commands with authenticated accepted acknowledgements and authoritative receipts', { sent: onlineCancelled.transmitted, ack: onlineRequestAck, initialStatus: firstFrame.view.alliedAi.directives.find(d => d.id === onlineCancelled.id).status, cancellation: cancelCommand, cancellationAck, cancelledTick: cancelledFrame.tick });

  phase = 'online active and completed request simulation';
  const onlineFighter = (await snap(online)).entities.find(e => e.side === 1 && e.kind === 'unit' && e.role !== 'worker'); assert.ok(onlineFighter);
  const onlineDefend = await sendDestination(online, 'defend', onlineFighter); const defendAck = await ack(online, onlineDefend.transmitted);
  const activeFrame = await receivedDirective(online, onlineDefend.id, ['active'], defendAck.appliedTick); await row(online, onlineDefend.id, 'Active'); await shot(online, 'active');
  const ownFramePrivacy = checkPublicMetadata(activeFrame.view);
  await closeAlly(online); await online.page.waitForFunction(() => !window.rts.paused);
  await openAlly(online);
  const currentAlly = (await snap(online)).entities.find(e => e.side === 1 && e.kind === 'unit' && e.role !== 'worker'); assert.ok(currentAlly);
  const onlineScout = await sendDestination(online, 'scout', currentAlly); const scoutAck = await ack(online, onlineScout.transmitted);
  const completedFrame = await receivedDirective(online, onlineScout.id, ['completed'], scoutAck.appliedTick, 20000); await row(online, onlineScout.id, 'Completed'); await row(online, onlineDefend.id, 'Cancelled');
  await shot(online, 'completed'); observations.onlineCompleted = await snap(online);
  record('Server activates defend and completes scout through real AI simulation; the mounted list applies snapshot transitions', { defendId: onlineDefend.id, activeTick: activeFrame.tick, scoutId: onlineScout.id, completedTick: completedFrame.tick });

  phase = 'online attack request activation and completion';
  const attackPoint = (await snap(online)).entities.find(e => e.side === 1 && e.kind === 'unit' && e.role !== 'worker'); assert.ok(attackPoint);
  const onlineAttack = await sendDestination(online, 'attack', attackPoint); const attackAck = await ack(online, onlineAttack.transmitted);
  assert.deepEqual(onlineAttack.transmitted.command, { type: 'allyDirective', ally: 1, directive: 'attack', x: attackPoint.x, y: attackPoint.y });
  const attackActiveFrame = await receivedDirective(online, onlineAttack.id, ['active'], attackAck.appliedTick);
  const attackCompletedFrame = await receivedDirective(online, onlineAttack.id, ['completed'], attackAck.appliedTick, 20000); await row(online, onlineAttack.id, 'Completed');
  record('Online Attack request activates and completes an observed clear area through authenticated public commands', { command: onlineAttack.transmitted, ack: attackAck, activeTick: attackActiveFrame.tick, completedTick: attackCompletedFrame.tick });
  await shot(online, 'attack-completed');

  phase = 'resource support metadata and foreign bank privacy';
  await dialog(online).getByLabel('Ally request', { exact: true }).selectOption('support');
  await dialog(online).getByLabel('Wood requested', { exact: true }).fill('0'); await dialog(online).getByLabel('Ore requested', { exact: true }).fill('1'); await dialog(online).getByLabel('Crystal requested', { exact: true }).fill('0');
  const supportStart = online.sent.length; await dialog(online).getByRole('button', { name: 'Send request', exact: true }).click();
  const supportCommand = await until(() => online.sent.slice(supportStart).find(item => item.command.type === 'allyDirective'), 'No captured support request');
  assert.deepEqual(supportCommand.command, { type: 'allyDirective', ally: 1, directive: 'support', resources: { wood: 0, ore: 1, crystal: 0 } });
  const supportAck = await ack(online, supportCommand);
  const supportFrame = await until(() => online.snapshots.findLast(frame => frame.tick >= supportAck.appliedTick && frame.view.alliedAi?.transfers.some(t => t.sender === 1 && t.recipient === 0 && t.resources.ore === 1)), 'Support request did not produce a permitted transfer receipt', 20000);
  const supportDirective = supportFrame.view.alliedAi.directives.find(d => d.kind === 'support'); assert.equal(supportDirective.status, 'completed'); await row(online, supportDirective.id, 'Completed');
  const supportPrivacy = checkPublicMetadata(supportFrame.view); const rendered = await snap(online);
  assert.deepEqual(rendered.online.privateSides, [0]); assert.ok(rendered.banks.filter(p => p.side !== 0).every(p => p.wood === 0 && p.ore === 0 && p.crystal === 0));
  record('Own team receives public directive and transfer metadata without assigned troop IDs or foreign banks', { initialPrivacy: ownFramePrivacy, supportPrivacy, renderedPrivateSides: rendered.online.privateSides, foreignBankDisplayPlaceholders: rendered.banks.filter(p => p.side !== 0) });
  await json('online-selected-authoritative-frames.json', { firstFrame, cancelledFrame, activeFrame, completedFrame, attackActiveFrame, attackCompletedFrame, supportFrame });
  await closeAlly(online);

  phase = 'online photo restriction and continuing server';
  await online.page.locator('[data-session-tool="photo"]').click(); await online.page.locator('.photo-controls:not([hidden])').waitFor({ state: 'visible' }); await until(() => launch(online).isDisabled(), 'Ally launcher remained enabled during online photo mode');
  const onlinePhotoBefore = await snap(online), photoSent = online.sent.length; await online.page.keyboard.press('F2'); await online.page.keyboard.press('a'); await online.page.mouse.click(260, 280, { button: 'right' }); await sleep(500); const onlinePhotoAfter = await snap(online);
  assert.equal(online.sent.length, photoSent); assert.ok(onlinePhotoAfter.tick > onlinePhotoBefore.tick); assert.deepEqual(onlinePhotoAfter.selected, onlinePhotoBefore.selected);
  await shot(online, 'photo'); await online.page.getByRole('button', { name: 'Exit photo mode', exact: true }).click(); await online.page.locator('.photo-controls[hidden]').waitFor({ state: 'attached' });
  record('Online photo mode disables requests and commands while server time advances', { beforeTick: onlinePhotoBefore.tick, afterTick: onlinePhotoAfter.tick });

  phase = 'second real guest enemy-perspective spectator restriction and team receipt privacy';
  const spectator = await guest('spectator'); assert.notEqual(spectator.username, online.username);
  await spectator.page.getByLabel('Spectator match ID', { exact: true }).fill(evidence.matchId); await spectator.page.getByLabel('Spectator perspective', { exact: true }).selectOption('2'); await spectator.page.getByLabel('Spectator view', { exact: true }).selectOption('player');
  await spectator.page.getByRole('button', { name: 'Spectate match', exact: true }).click(); await ready(spectator, 'online', 2);
  const spectatorFrame = await until(() => spectator.snapshots.findLast(frame => frame.tick >= supportFrame.tick), 'Delayed spectator did not reach the player support frame tick', 60000);
  const spectatorBefore = await snap(spectator); assert.equal(spectatorBefore.online.role, 'spectator'); assert.equal(spectatorBefore.readOnly, true); assert.equal(spectatorBefore.simulationEnabled, false);
  await until(() => launch(spectator).isDisabled(), 'Spectator ally requests remained enabled');
  assert.equal(spectatorFrame.view.side, 2); assert.deepEqual(spectatorFrame.view.alliedAi.directives, []); assert.deepEqual(spectatorFrame.view.alliedAi.transfers, []);
  checkPublicMetadata(spectatorFrame.view, 1);
  const spectatorSent = spectator.sent.length; await spectator.page.keyboard.press('F2'); await spectator.page.keyboard.press('a'); await spectator.page.keyboard.press('q'); await spectator.page.mouse.click(260, 280, { button: 'right' }); await sleep(350);
  assert.equal(spectator.sent.length, spectatorSent); assert.equal(await dialog(spectator).isVisible(), false); await shot(spectator, 'restricted');
  observations.spectator = { before: spectatorBefore, after: await snap(spectator) }; await json('enemy-perspective-spectator-frame.json', spectatorFrame);
  record('Separate authenticated enemy-perspective spectator cannot issue requests or commands and receives no requester-team receipts', { username: spectator.username, perspective: 2, tick: spectatorFrame.tick, delayTicks: spectatorBefore.online.delayTicks, sentCommands: spectator.sent.length, directives: spectatorFrame.view.alliedAi.directives, transfers: spectatorFrame.view.alliedAi.transfers });

  phase = 'final evidence and browser errors';
  assert.deepEqual(errors, []); assert.deepEqual(captureErrors, []); record('Browsers report no page errors or WebSocket capture errors');
  evidence.limits.push('This run proves local and loopback-hosted production UI integration. It does not establish public remote hosting, natural coordinated team victory, scouting across a map, all factions, underground directives, or other players cancelling foreign requests.');
  evidence.complete = evidence.knownFailures.length === 0; evidence.completedAt = new Date().toISOString();
} catch (error) {
  evidence.complete = false; evidence.failure = { phase, message: error.message, stack: error.stack };
  for (const p of profiles) { try { await shot(p, `failure-${phase.replace(/[^a-z0-9]+/gi, '-').slice(0, 90)}`); observations[`${p.name}AtFailure`] = await snap(p); } catch (captureError) { observations[`${p.name}CaptureFailure`] = String(captureError); } }
  console.error(`Failure during ${phase}: ${error.stack}`); process.exitCode = 1;
} finally {
  evidence.phase = phase; evidence.pageErrors = errors; evidence.captureErrors = captureErrors;
  await json('observations.json', observations);
  for (const p of profiles) await json(`${p.name}-transport.json`, { username: p.username, hellos: p.hellos, sent: p.sent, receipts: p.receipts, snapshots: p.snapshots });
  await json('results.json', evidence); await browser.close();
  console.log(JSON.stringify({ complete: evidence.complete, checks: evidence.checks.length, failure: evidence.failure, out }));
}
