#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, stop } from 'esbuild';

// Build and drive the actual cwd. No substitute server, main entry, dashboard mount, or replay callback.
const source = process.cwd(), argument = process.argv[2];
if (!argument) throw new Error('Use node scripts/tournaments/verify-canonical-main.mjs NEW_OUTPUT_DIRECTORY.');
if (process.platform !== 'linux') throw new Error('This proof requires Linux /proc for child-process identities.');
const output = path.resolve(argument), browserDirectory = path.join(output, 'browser'), serverDirectory = path.join(output, 'server');
await mkdir(path.dirname(output), { recursive: true }); await mkdir(output);
await mkdir(serverDirectory); await writeFile(path.join(serverDirectory, 'package.json'), '{"type":"module"}\n'); await symlink(path.join(source, 'node_modules'), path.join(output, 'node_modules'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function poll(read, description, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { const result = await read(); if (result) return result; await sleep(20); }
  throw new Error(`Timed out waiting for ${description}.`);
}
async function command(executable, args, filename) {
  const child = spawn(executable, args, { cwd: source, stdio: ['ignore', 'pipe', 'pipe'] }); let content = '';
  child.stdout.on('data', data => { content += data; }); child.stderr.on('data', data => { content += data; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  await writeFile(path.join(output, filename), content); assert.equal(code, 0, `${filename} failed: ${content.slice(-3000)}`);
}
async function processIdentity(pid) {
  try {
    const raw = await readFile(`/proc/${pid}/stat`, 'utf8'), fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/);
    return { pid: Number(pid), parent: Number(fields[1]), group: Number(fields[2]), started: fields[19], argv: (await readFile(`/proc/${pid}/cmdline`, 'utf8')).split('\0').filter(Boolean) };
  } catch (error) { if (['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) return null; throw error; }
}
const observed = new Map();
async function children(pid, track = true) {
  const pids = await readFile(`/proc/${pid}/task/${pid}/children`, 'utf8').catch(error => { if (['ENOENT', 'ESRCH'].includes(error.code)) return ''; throw error; });
  const identities = await Promise.all(pids.trim().split(/\s+/).filter(Boolean).map(processIdentity));
  const found = identities.filter(item => item?.parent === pid);
  if (track) for (const item of found) observed.set(`${item.pid}:${item.started}`, item);
  return found;
}
async function remains(item) { const now = await processIdentity(item.pid); return now?.started === item.started; }
const evidence = { source: { directory: source, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(), workingTree: execFileSync('git', ['status', '--short'], { cwd: source, encoding: 'utf8' }).trim() }, checks: [], http: [], browser: {}, runs: [], errors: [] };
const record = name => { evidence.checks.push(name); console.log(`PASS ${name}`); };
let server, serverExit, browser, page, base, observerTimer, failure;
const serverEntry = path.join(serverDirectory, 'server-main.mjs');
async function startServer() {
  let log = '';
  server = spawn(process.execPath, [serverEntry], { cwd: source, env: { ...process.env, RTS_HOST: '127.0.0.1', RTS_PORT: '0', RTS_DATA_DIR: path.join(output, 'data'), RTS_STATIC_DIR: browserDirectory, RTS_ORIGIN: '', RTS_SECURE_COOKIE: '0', RTS_TRUST_PROXY: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  serverExit = new Promise(resolve => server.once('close', (code, signal) => resolve({ code, signal })));
  server.stdout.on('data', data => { log += data; }); server.stderr.on('data', data => { log += data; });
  server.once('error', error => { log += error.message; });
  base = await poll(async () => { const match = /authoritative server: (http:\/\/127\.0\.0\.1:\d+)/.exec(log); if (match) return match[1]; if (server.exitCode !== null) throw new Error(`Canonical server exited: ${log}`); }, 'canonical server/main.ts startup');
  const logfile = path.join(output, `server-${evidence.runs.length}.log`);
  server.once('close', () => { void writeFile(logfile, log); });
  const observedServer = server.pid;
  observerTimer = setInterval(() => { void children(observedServer).catch(error => evidence.errors.push(error.message)); }, 25);
  assert.equal((await fetch(base + '/api/health')).status, 200);
}
async function stopServer() {
  if (!server) return;
  await children(server.pid); clearInterval(observerTimer); observerTimer = undefined;
  if (server.exitCode === null) server.kill('SIGTERM');
  let timer; const result = await Promise.race([serverExit, new Promise(resolve => { timer = setTimeout(() => resolve(null), 15000); })]).finally(() => clearTimeout(timer));
  assert(result, 'Canonical server did not finish graceful shutdown.'); assert.equal(result.code, 0);
  server = undefined;
}
class AccountClient {
  cookie = '';
  async request(route, body, origin) {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(origin ? { Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    this.cookie = response.headers.get('set-cookie')?.split(';')[0] ?? this.cookie;
    const data = await response.json(); evidence.http.push({ route, method: body === undefined ? 'GET' : 'POST', status: response.status });
    return { status: response.status, data };
  }
  async register(label) { const response = await this.request('/api/auth/register', { username: `${label}_${randomUUID().slice(0, 8)}`, password: 'canonical-tournament-proof' }); assert.equal(response.status, 200); return response.data.account; }
}
try {
  await command(process.execPath, [path.join(source, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', browserDirectory], 'browser-build.log');
  await build({ entryPoints: [path.join(source, 'src/server/main.ts')], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: serverEntry });
  if (await stat(path.join(source, 'src/core/campaign.ts')).catch(() => null)) await build({ entryPoints: [path.join(source, 'src/core/campaign.ts')], bundle: true, platform: 'node', format: 'esm', outfile: path.join(serverDirectory, 'canonical-campaign.js') });
  await build({ stdin: { contents: `export {verifyTournamentReport,tournamentSha256,tournamentStateText} from ${JSON.stringify(path.join(source, 'src/tournament/report.ts'))}; export {ReplayPlayer,replayChecksum} from ${JSON.stringify(path.join(source, 'src/core/replays.ts'))}; export {loadGame} from ${JSON.stringify(path.join(source, 'src/core/saves.ts'))};`, resolveDir: source, sourcefile: 'canonical-report-verifier.ts' }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(output, 'report-verifier.mjs') });
  const verifier = await import(pathToFileURL(path.join(output, 'report-verifier.mjs')).href);
  const smoke = JSON.parse(await readFile(path.join(source, 'scripts/tournaments/smoke.json'), 'utf8'));
  evidence.source.smokeSha256 = sha256(await readFile(path.join(source, 'scripts/tournaments/smoke.json')));
  evidence.source.serverBundleSha256 = sha256(await readFile(serverEntry));
  evidence.source.reportVerifierSha256 = sha256(await readFile(path.join(output, 'report-verifier.mjs')));
  await startServer();
  const anonymous = new AccountClient(), owner = new AccountClient(), guest = new AccountClient();
  for (const route of ['/api/tournaments/configs', '/api/tournaments']) assert([401, 403].includes((await anonymous.request(route)).status));
  assert([401, 403].includes((await anonymous.request('/api/tournaments', { configId: smoke.id })).status)); record('anonymous tournament inspection and launch are rejected by the canonical account gate');
  const ownerAccount = await owner.register('TournamentOwner'), guestAccount = await guest.register('TournamentGuest');
  const choices = await owner.request('/api/tournaments/configs'); assert.equal(choices.status, 200); assert(choices.data.some(choice => choice.id === smoke.id));
  assert(choices.data.every(choice => choice.agents.every(agent => !Object.hasOwn(agent, 'command'))));
  assert.equal((await guest.request('/api/tournaments/configs')).status, 200); record('authenticated accounts inspect the registered smoke configuration without receiving executable argv');
  assert.equal((await owner.request('/api/tournaments', { configId: smoke.id, command: ['unexpected'] })).status, 400);
  assert.equal((await owner.request('/api/tournaments', { configId: smoke.id }, 'https://disallowed.example')).status, 403); record('remote argv and disallowed-origin launches are rejected');
  const canceledStart = await owner.request('/api/tournaments', { configId: smoke.id }); assert.equal(canceledStart.status, 202); const canceledId = canceledStart.data.id;
  const live = await poll(async () => { const found = await children(server.pid); return found.length === 2 && found.every(item => item.argv.includes('scripts/agents/tournament-agent.mjs')) ? found : null; }, 'both configured tournament agent processes');
  assert.equal((await guest.request(`/api/tournaments/${canceledId}/cancel`, {})).status, 403);
  assert.equal((await owner.request(`/api/tournaments/${canceledId}/cancel`, {}, 'https://disallowed.example')).status, 403);
  assert.equal((await guest.request(`/api/tournaments/${canceledId}`)).status, 200);
  assert.equal((await owner.request(`/api/tournaments/${canceledId}`)).data.status, 'running'); record('another account can inspect a live run but cannot cancel it; a disallowed origin cannot cancel either');
  assert.equal((await owner.request(`/api/tournaments/${canceledId}/cancel`, {})).status, 202);
  const canceled = await poll(async () => { const result = await owner.request(`/api/tournaments/${canceledId}/result`); return result.status === 200 ? result.data : null; }, 'canonical cancellation report');
  await verifier.verifyTournamentReport(canceled); assert.equal(canceled.status, 'canceled'); assert(canceled.matches.some(match => match.status === 'aborted'));
  assert.deepEqual(canceled.matches.filter(match => match.status === 'aborted').flatMap(match => match.agents.map(agent => agent.pid)).sort((a, b) => a - b), live.map(item => item.pid).sort((a, b) => a - b));
  assert((await Promise.all(live.map(remains))).every(value => !value)); assert.deepEqual(await children(server.pid), []);
  await writeFile(path.join(output, 'canceled-report.json.gz'), gzipSync(JSON.stringify(canceled)));
  evidence.runs.push({ id: canceledId, status: canceled.status, creator: ownerAccount.id, observingAccount: guestAccount.id, observedLiveProcesses: live }); record('the creator cancels the actual registered child processes and retains a verified partial report with no agents left');

  const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright'); browser = await chromium.launch({ headless: true });
  const browserProcesses = (await children(process.pid, false)).filter(item => item.argv.some(argument => /(?:^|\s)--remote-debugging-pipe(?:\s|$)/.test(argument)));
  assert(browserProcesses.length > 0, 'The launched Chromium process must be observable.'); evidence.browser.processes = browserProcesses;
  for (const item of browserProcesses) observed.set(`${item.pid}:${item.started}`, item);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const cookieSplit = owner.cookie.indexOf('='); await context.addCookies([{ name: owner.cookie.slice(0, cookieSplit), value: owner.cookie.slice(cookieSplit + 1), url: base, httpOnly: true, sameSite: 'Strict' }]);
  await context.addInitScript(() => {
    const watched = new Set(['keydown', 'keyup', 'blur', 'resize']), listeners = new Map(), add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
    const capture = options => typeof options === 'boolean' ? options : !!options?.capture;
    window.addEventListener = function (type, listener, options) { if (watched.has(type)) { const rows = listeners.get(type) ?? []; if (!rows.some(row => row.listener === listener && row.capture === capture(options))) rows.push({ listener, capture: capture(options) }); listeners.set(type, rows); } return add(type, listener, options); };
    window.removeEventListener = function (type, listener, options) { if (watched.has(type)) listeners.set(type, (listeners.get(type) ?? []).filter(row => row.listener !== listener || row.capture !== capture(options))); return remove(type, listener, options); };
    window.__tournamentVerification = { listenerCounts: () => Object.fromEntries([...watched].map(type => [type, (listeners.get(type) ?? []).length])), canvases: [], removed: [] };
  });
  page = await context.newPage(); page.on('pageerror', error => evidence.errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' }); await page.locator('.begin-match').waitFor();
  const scriptUrls = await page.locator('script[type="module"][src]').evaluateAll(nodes => nodes.map(node => node.src));
  evidence.source.servedModules = [];
  for (const url of scriptUrls) { const bytes = await (await context.request.get(url)).body(); evidence.source.servedModules.push({ path: new URL(url).pathname, sha256: sha256(bytes) }); assert.equal(sha256(bytes), sha256(await readFile(path.join(browserDirectory, new URL(url).pathname)))); }
  const menuListeners = await page.evaluate(() => window.__tournamentVerification.listenerCounts());
  await page.evaluate(() => { const root = document.querySelector('#game-canvas'), proof = window.__tournamentVerification; new MutationObserver(records => { for (const record of records) { for (const node of record.addedNodes) if (node instanceof HTMLCanvasElement) proof.canvases.push(node); for (const node of record.removedNodes) if (node instanceof HTMLCanvasElement) proof.removed.push(node); } }).observe(root, { childList: true }); });
  await page.locator('.begin-match').click(); await page.waitForFunction(() => window.rts?.mode === 'local' && window.rts.state.tick > 0 && window.rts.art.loaded && window.rts.fps > 0);
  assert.equal(await page.locator('#game-canvas > canvas').count(), 1); const localListeners = await page.evaluate(() => window.__tournamentVerification.listenerCounts());
  const launch = page.locator('[data-tournament-tool="dashboard"]'), dialog = page.getByRole('dialog', { name: 'Tournament dashboard', exact: true });
  await launch.waitFor({ state: 'visible' });
  const open = async () => { await launch.focus(); await launch.click(); await dialog.waitFor({ state: 'visible' }); await page.waitForFunction(() => window.rts?.paused); };
  const read = () => page.evaluate(() => ({ mode: window.rts.mode, tick: window.rts.state.tick, paused: window.rts.paused, camera: window.rts.camera, readOnly: window.rts.readOnly, simulationEnabled: window.rts.simulationEnabled, side: window.rts.viewSide }));
  await open(); assert.equal(await launch.getAttribute('aria-expanded'), 'true'); assert(await dialog.getByRole('button', { name: 'Close tournament dashboard', exact: true }).evaluate(node => node === document.activeElement));
  const frozen = await read(); await page.keyboard.down('ArrowRight'); await sleep(350); await page.keyboard.up('ArrowRight'); await page.keyboard.press('p'); assert.deepEqual(await read(), frozen);
  await page.keyboard.press('Shift+Tab'); assert(await page.evaluate(() => document.querySelector('.tournament-dialog').contains(document.activeElement))); await page.keyboard.press('Tab'); assert(await dialog.getByRole('button', { name: 'Close tournament dashboard', exact: true }).evaluate(node => node === document.activeElement));
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert(await launch.evaluate(node => node === document.activeElement)); await page.waitForFunction(tick => !window.rts.paused && window.rts.state.tick > tick, frozen.tick);
  await page.locator('#pause-button').click(); await page.waitForFunction(() => window.rts.paused); await open(); const paused = await read(); await page.keyboard.press('Escape'); await sleep(200); assert.deepEqual(await read(), paused); await page.locator('#resume-button').click(); await page.waitForFunction(() => !window.rts.paused);
  record('the actual main toolbar traps focus, blocks battlefield input, and restores both running and previously paused local matches');
  await page.locator('[data-session-tool="replay"]').click(); await page.waitForFunction(() => document.querySelector('[data-tournament-tool="dashboard"]').disabled); await page.getByRole('button', { name: 'Close session tools', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('[data-tournament-tool="dashboard"]').disabled);
  await page.locator('[data-session-tool="photo"]').click(); await launch.waitFor({ state: 'hidden' }); await page.keyboard.press('Escape'); await launch.waitFor({ state: 'visible' }); record('another session modal blocks tournament launch and photo mode hides its toolbar');
  await open(); await dialog.getByLabel('Tournament configuration', { exact: true }).selectOption(smoke.id);
  const startResponse = page.waitForResponse(response => response.url() === base + '/api/tournaments' && response.request().method() === 'POST'); await dialog.getByRole('button', { name: 'Start tournament', exact: true }).click(); const launched = await startResponse; assert.equal(launched.status(), 202); const completeId = (await launched.json()).id;
  await page.waitForFunction(() => document.querySelector('.tournament-notice')?.textContent === 'Report verified. Every recorded replay passed verification.', null, { timeout: 120000 });
  const result = await owner.request(`/api/tournaments/${completeId}/result`); assert.equal(result.status, 200); const complete = await verifier.verifyTournamentReport(result.data);
  assert.equal(complete.status, 'complete'); assert.equal(complete.config.id, smoke.id); assert.equal(complete.matches.length, 2); assert(complete.matches.every(match => match.status === 'battle' && match.winnerAgentId === 'push')); assert.deepEqual(complete.config.agents.map(agent => agent.command), smoke.agents.map(agent => agent.command));
  assert.equal((await guest.request(`/api/tournaments/${completeId}/result`)).status, 200);
  const replayRoute = `/api/tournaments/${completeId}/matches/${complete.matches[0].id}/replay`; assert.equal((await guest.request(replayRoute)).status, 200); assert([401, 403].includes((await anonymous.request(replayRoute)).status));
  assert.equal(await dialog.locator('[data-tournament-match]').count(), 2); assert.match(await dialog.getByRole('table', { name: 'Verified standings', exact: true }).innerText(), /Push.*6/s);
  const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Download report', exact: true }).click(); const downloaded = await download; await downloaded.saveAs(path.join(output, 'downloaded-report.json')); assert.deepEqual(await verifier.verifyTournamentReport(await readFile(path.join(output, 'downloaded-report.json'), 'utf8')), complete);
  await writeFile(path.join(output, 'complete-report.json.gz'), gzipSync(JSON.stringify(complete))); await page.screenshot({ path: path.join(output, 'main-tournament-complete.png') });
  evidence.runs.push({ id: completeId, status: complete.status, creator: ownerAccount.id, matches: complete.matches.map(match => ({ id: match.id, tick: match.finalTick, sha256: match.finalStateSha256, agents: match.agents.map(agent => ({ id: agent.agentId, pid: agent.pid })) })) }); record('the actual main dashboard launches the registered agents, verifies both battles, shows standings, and downloads the same report');
  const inspections = [];
  for (const [index, match] of [complete.matches[0], complete.matches[1], complete.matches[0]].entries()) {
    if (index) await open(); const previousCanvas = await page.locator('#game-canvas > canvas').elementHandle();
    await dialog.locator(`[data-tournament-match="${match.id}"] button`).click(); await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(expected => { const r = window.rts; return r?.mode === 'replay' && r.readOnly && !r.simulationEnabled && r.paused && r.viewSide === 0 && r.state.tick === expected.tick && r.state.players.map(player => player.faction).join(',') === expected.factions.join(','); }, { tick: match.replay.initial.state.tick, factions: match.replay.initial.state.players.map(player => player.faction) }, { timeout: 90000 });
    assert.equal(await previousCanvas.evaluate(node => node.isConnected), false); assert.equal(await page.locator('#game-canvas > canvas').count(), 1); await page.waitForFunction(() => window.rts.art.loaded && window.rts.fps > 0);
    assert.deepEqual(await page.evaluate(() => window.__tournamentVerification.listenerCounts()), localListeners);
    await page.locator('[data-session-tool="replay"]').click(); const range = page.getByLabel('Replay tick', { exact: true }); await range.waitFor();
    assert.equal(await range.getAttribute('min'), String(match.replay.initial.state.tick)); assert.equal(await range.getAttribute('max'), String(match.finalTick)); assert.equal(await page.getByLabel('Replay perspective', { exact: true }).locator('option').count(), match.replay.initial.state.players.length);
    if (index === 0) {
      await page.getByRole('button', { name: 'Play replay', exact: true }).click(); await page.getByRole('button', { name: 'Close session tools', exact: true }).click(); await page.waitForFunction(tick => !window.rts.paused && window.rts.state.tick > tick, match.replay.initial.state.tick);
      await open(); const replayFrozen = await read(); await sleep(250); assert.deepEqual(await read(), replayFrozen); await page.keyboard.press('Escape'); await page.waitForFunction(tick => !window.rts.paused && window.rts.state.tick > tick, replayFrozen.tick);
      await page.locator('[data-session-tool="replay"]').click(); await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
    }
    await range.focus(); await page.keyboard.press('End'); await page.waitForFunction(tick => window.rts?.state.tick === tick && window.rts.paused, match.finalTick, { timeout: 90000 });
    // The app owns a private runtime WeakMap. Capture it through the real Export save callback.
    await page.locator('[data-session-tab="saves"]').click();
    const sessionDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export save', exact: true }).click();
    const sessionPath = path.join(output, `main-replay-session-${index + 1}.json`); await (await sessionDownload).saveAs(sessionPath);
    const session = JSON.parse(await readFile(sessionPath, 'utf8')), captured = verifier.loadGame(session.game), stateText = verifier.tournamentStateText(captured);
    const displayed = await page.evaluate(() => { const s = window.rts.state; return JSON.parse(JSON.stringify({ ...s, visible: s.visible.map(cells => [...cells].sort((a, b) => a - b)), explored: s.explored.map(cells => [...cells].sort((a, b) => a - b)) })); });
    const normalizedSaveState = structuredClone(session.game.state); for (const key of ['visible', 'explored']) normalizedSaveState[key] = normalizedSaveState[key].map(cells => cells.sort((a, b) => a - b));
    assert.deepEqual(normalizedSaveState, displayed, 'The real save export must contain the displayed paused replay state.');
    const actual = { tick: captured.tick, hash: await verifier.tournamentSha256(stateText), checksum: verifier.replayChecksum(captured, match.replay.checksumVersion ?? match.replay.initial.version), ...(await read()) };
    await writeFile(path.join(output, `main-replay-session-${index + 1}.json.gz`), gzipSync(JSON.stringify(session)));
    await writeFile(path.join(output, `main-replay-state-${index + 1}.json.gz`), gzipSync(stateText));
    if (actual.hash !== match.finalStateSha256) { const expected = new verifier.ReplayPlayer(match.replay); try { while (!expected.finished) expected.advance(200); await writeFile(path.join(output, `expected-replay-state-${index + 1}.json.gz`), gzipSync(verifier.tournamentStateText(expected.state))); } finally { expected.dispose(); } }
    assert.equal(actual.hash, match.finalStateSha256); assert.equal(actual.checksum, match.replay.finalChecksum); inspections.push({ matchId: match.id, ...actual });
    await page.getByRole('button', { name: 'Close session tools', exact: true }).click(); await page.screenshot({ path: path.join(output, `main-replay-${index + 1}.png`) });
  }
  evidence.browser.inspections = inspections; evidence.browser.version = browser.version(); record('main replay inspection replaces Phaser canvases, preserves listener counts, supports playback/modal pause, and seeks to each verified final state');
  await page.locator('#restart-button').click(); await page.locator('.begin-match').waitFor({ state: 'visible' }); await poll(async () => await page.locator('#game-canvas > canvas').count() === 0, 'Phaser canvas destruction on restart');
  const lifecycle = await page.evaluate(() => { const p = window.__tournamentVerification; return { added: p.canvases.length, removed: p.removed.length, distinct: new Set(p.canvases).size, retiredDisconnected: p.canvases.every(canvas => !canvas.isConnected), listeners: p.listenerCounts() }; });
  assert.deepEqual(lifecycle.listeners, menuListeners); assert.equal(lifecycle.added, 4); assert.equal(lifecycle.removed, 4); assert.equal(lifecycle.distinct, 4); assert(lifecycle.retiredDisconnected); evidence.browser.lifecycle = lifecycle; record('local match and three replay replacements retire every canvas and return window listeners to the menu baseline');
  await browser.close(); browser = undefined; await poll(async () => (await Promise.all(browserProcesses.map(remains))).every(value => !value), 'Chromium process exit'); await stopServer(); await startServer();
  assert.equal((await guest.request(`/api/tournaments/${canceledId}/cancel`, {})).status, 403); assert.equal((await guest.request(`/api/tournaments/${completeId}/result`)).status, 200); record('completed reports and cancellation ownership survive a real canonical server restart');
  const shutdown = await owner.request('/api/tournaments', { configId: smoke.id }); assert.equal(shutdown.status, 202);
  const shutdownLive = await poll(async () => { const found = await children(server.pid); return found.length === 2 ? found : null; }, 'live registered agents before server shutdown');
  await stopServer(); assert((await Promise.all(shutdownLive.map(remains))).every(value => !value));
  const shutdownReport = await verifier.verifyTournamentReport(await readFile(path.join(output, 'data/tournaments', shutdown.data.id, 'tournament.json'), 'utf8'));
  assert.equal(shutdownReport.status, 'canceled'); assert(shutdownReport.matches.some(match => match.status === 'aborted'));
  await writeFile(path.join(output, 'shutdown-report.json.gz'), gzipSync(JSON.stringify(shutdownReport)));
  evidence.runs.push({ id: shutdownReport.id, status: shutdownReport.status, observedLiveProcesses: shutdownLive }); record('graceful canonical server shutdown also exits both live agent processes and retains its canceled report');
  assert.deepEqual(evidence.errors, []);
} catch (error) { failure = error; evidence.errors.push(error.stack ?? String(error)); if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); }
finally {
  clearInterval(observerTimer);
  stop();
  if (browser) await browser.close().catch(error => evidence.errors.push(error.message));
  if (server) await stopServer().catch(async error => { evidence.errors.push(error.message); if (server?.exitCode === null) server.kill('SIGKILL'); await serverExit; });
  const forced = (await Promise.all([...observed.values()].map(async item => await remains(item) ? item : null))).filter(Boolean);
  if (forced.length) {
    evidence.errors.push('Graceful shutdown left observed child processes; the proof forcibly cleaned them up.');
    for (const item of forced) if (await remains(item)) { try { process.kill(item.group === item.pid ? -item.pid : item.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') evidence.errors.push(error.message); } }
    await poll(async () => (await Promise.all(forced.map(remains))).every(value => !value), 'forced proof-process cleanup').catch(error => evidence.errors.push(error.message));
  }
  const survivors = (await Promise.all([...observed.values()].map(async item => await remains(item) ? item : null))).filter(Boolean);
  evidence.cleanup = { serverClosed: !server || server.exitCode !== null || server.signalCode !== null, browserClosed: !browser || !browser.isConnected(), remainingObservedProcesses: survivors, forciblyCleanedProcesses: forced, observedProcesses: [...observed.values()] };
  evidence.passed = !failure && !survivors.length && !evidence.errors.length;
  await writeFile(path.join(output, 'summary.json'), JSON.stringify(evidence, null, 2) + '\n');
  assert.deepEqual(survivors, [], 'Canonical proof left observed tournament child processes alive.');
}
if (failure) throw failure;
assert(evidence.passed); console.log(`Canonical main proof passed; evidence: ${output}`);
