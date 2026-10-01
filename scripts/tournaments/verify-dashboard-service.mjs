#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = process.cwd(), outputArgument = process.argv[2];
if (!outputArgument) throw new Error('Use node scripts/tournaments/verify-dashboard-service.mjs NEW_OUTPUT_DIRECTORY.');
if (process.platform !== 'linux') throw new Error('This proof uses Linux /proc to verify that agent PIDs exit.');
const output = path.resolve(outputArgument);
await mkdir(path.dirname(output), { recursive: true }); await mkdir(output);
const nodeBundlePath = path.join(output, 'service-proof.mjs'), browserBundlePath = path.join(output, 'dashboard-proof.js');
await build({ entryPoints: [path.join(root, 'scripts/tournaments/service-proof-entry.ts')], bundle: true, platform: 'node', format: 'esm', outfile: nodeBundlePath });
await build({ entryPoints: [path.join(root, 'scripts/tournaments/dashboard-proof-entry.ts')], bundle: true, platform: 'browser', format: 'iife', outfile: browserBundlePath });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const nodeBundle = await readFile(nodeBundlePath), browserBundle = await readFile(browserBundlePath), stylesheet = await readFile(path.join(output, 'dashboard-proof.css'));
const { createTournamentService, verifyTournamentReport } = await import(pathToFileURL(nodeBundlePath).href);
const marker = `tournament-proof-${randomUUID()}`;
const smoke = JSON.parse(await readFile(path.join(root, 'scripts/tournaments/smoke.json'), 'utf8'));
for (const agent of smoke.agents) agent.command = [process.execPath, ...agent.command.slice(1), '--proof-tag', marker];
const hang = structuredClone(smoke); hang.id = 'proof-hang'; hang.name = 'Cancellation proof with two hanging agents'; hang.bothSeats = false; hang.responseTimeoutMs = 30000;
for (const agent of hang.agents) agent.command = [process.execPath, 'scripts/agents/tournament-agent.mjs', '--style', 'hang', '--proof-tag', marker];
const cookie = 'tournament-proof=allowed';
const service = createTournamentService({ cwd: root, outputRoot: path.join(output, 'runs'), configs: [smoke, hang], authorize: request => request.headers.cookie === cookie });
const errors = [], evidence = { node: process.version, browser: '', nodeBundleSha256: sha256(nodeBundle), browserBundleSha256: sha256(browserBundle), stylesheetSha256: sha256(stylesheet), marker, checks: {}, runs: [], browserProof: null, errors };
let server, browser;
const timeout = 60000;
const poll = async (condition, description, milliseconds = 10000) => {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) { const value = await condition(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error(`Timed out waiting for ${description}.`);
};
async function markedPids() {
  const entries = await readdir('/proc');
  const found = await Promise.all(entries.filter(name => /^\d+$/.test(name)).map(async name => {
    try { return (await readFile(`/proc/${name}/cmdline`, 'utf8')).split('\0').includes(marker) ? Number(name) : null; }
    catch (error) { if (['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) return null; throw error; }
  }));
  return found.filter(pid => pid !== null).sort((a, b) => a - b);
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }
try {
  server = createServer((request, response) => { void (async () => {
    if (await service.handle(request, response)) return;
    if (request.url === '/dashboard.js') { response.writeHead(200, { 'Content-Type': 'text/javascript' }); response.end(browserBundle); }
    else if (request.url === '/dashboard.css') { response.writeHead(200, { 'Content-Type': 'text/css' }); response.end(stylesheet); }
    else if (request.url === '/' || request.url === '/proof.html') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tournament dashboard service proof</title><link rel="stylesheet" href="/dashboard.css"></head><body style="margin:0;min-height:100vh;background:#243c2e;color:#e9e8df;font-family:system-ui"><h1 style="padding:20px">Tournament service proof</h1><p style="padding:0 20px">The dashboard uses the real authenticated HTTP service and terminal agent processes.</p><div id="dashboard-root"></div><pre id="proof-data" aria-label="Browser proof data" hidden></pre><script src="/dashboard.js"></script></body></html>');
    } else { response.writeHead(404); response.end(); }
  })().catch(error => { errors.push(error.message); if (!response.headersSent) response.writeHead(500); response.end(error.message); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`; evidence.base = base;
  assert.equal((await fetch(`${base}/api/tournaments/configs`)).status, 403); evidence.checks.unauthorizedRequestsRejected = true;
  const rawCommands = await fetch(`${base}/api/tournaments`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ configId: smoke.id, command: ['unexpected'] }) });
  assert.equal(rawCommands.status, 400); evidence.checks.httpAcceptsOnlyRegisteredConfigId = true;
  const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright'); browser = await chromium.launch({ headless: true }); evidence.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  await context.addCookies([{ name: 'tournament-proof', value: 'allowed', url: base }]);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const served = page.waitForResponse(response => response.url() === `${base}/dashboard.js`); await page.goto(`${base}/proof.html`); const servedBundle = await (await served).body();
  assert.equal(sha256(servedBundle), evidence.browserBundleSha256); evidence.servedBrowserBundleSha256 = sha256(servedBundle);
  const snap = async () => JSON.parse(await page.locator('#proof-data').textContent());
  await page.locator('#proof-data').filter({ hasText: '"ready":true' }).waitFor({ state: 'attached' });
  const open = async () => { await page.getByRole('button', { name: 'Tournaments', exact: true }).click(); await page.getByRole('dialog', { name: 'Tournament dashboard', exact: true }).waitFor({ state: 'visible' }); };
  await open(); await page.getByLabel('Tournament configuration', { exact: true }).selectOption(smoke.id);
  await page.getByRole('button', { name: 'Start tournament', exact: true }).click();
  const smokeRun = await poll(async () => (await snap()).runs.find(run => run.configId === smoke.id), 'browser tournament start');
  await page.waitForFunction(() => document.querySelector('.tournament-notice')?.textContent === 'Report verified. Every recorded replay passed verification.', null, { timeout });
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download report', exact: true }).click(); await (await downloadPromise).saveAs(path.join(output, 'smoke-report.json'));
  const smokeReport = await verifyTournamentReport(await readFile(path.join(output, 'smoke-report.json'), 'utf8'));
  assert.equal(smokeReport.id, smokeRun.id); assert.equal(smokeReport.status, 'complete'); assert.equal(smokeReport.matches.length, 2);
  assert(smokeReport.matches.every(match => match.status === 'battle' && match.winnerAgentId === 'push'));
  assert.equal(smokeReport.config.id, smoke.id); evidence.checks.actualSmokeReportVerifiedInNodeAndBrowser = true;
  const browserBeforeInspect = await snap(); assert(browserBeforeInspect.polls.some(progress => progress.id === smokeRun.id && progress.status === 'running')); assert(browserBeforeInspect.polls.some(progress => progress.id === smokeRun.id && progress.status === 'complete' && progress.completed === 2));
  assert.equal(await page.locator('[data-tournament-match]').count(), 2); assert.match(await page.locator('[aria-label="Verified tournament report"] tbody').innerText(), /Push.*6/s); evidence.checks.httpPollingUpdatesDashboardAndStandings = true;
  const smokePids = smokeReport.matches.flatMap(match => match.agents.map(agent => agent.pid)); assert(smokePids.every(pid => Number.isInteger(pid) && !alive(pid))); evidence.checks.completedAgentPidsExited = true;
  const replayEndpoint = await fetch(`${base}/api/tournaments/${smokeRun.id}/matches/match-001/replay`, { headers: { Cookie: cookie } }); assert.equal(replayEndpoint.status, 200); assert.deepEqual(await replayEndpoint.json(), smokeReport.matches[0].replay); evidence.checks.replayEndpointMatchesReport = true;
  await page.locator('[data-tournament-match="match-001"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, 'dashboard-complete.png') });
  for (const match of smokeReport.matches) {
    await page.locator(`[data-tournament-match="${match.id}"] button`).click();
    const inspection = await poll(async () => (await snap()).inspections.find(item => item.matchId === match.id), `inspect ${match.id}`, timeout);
    assert.equal(inspection.reportId, smokeReport.id); assert.equal(inspection.sha256, match.finalStateSha256); assert.equal(inspection.checksum, match.replay.finalChecksum); assert.equal(inspection.finalTick, match.finalTick);
    await page.getByRole('dialog', { name: 'Tournament dashboard', exact: true }).waitFor({ state: 'hidden' }); await open();
  }
  evidence.checks.bothReplayCallbacksRunFullBrowserPlaybackAndSeek = true;
  await page.getByLabel('Tournament configuration', { exact: true }).selectOption(hang.id); await page.getByRole('button', { name: 'Start tournament', exact: true }).click();
  const hangRun = await poll(async () => (await snap()).runs.find(run => run.configId === hang.id), 'browser hanging tournament start');
  const runningPids = await poll(async () => { const pids = await markedPids(); return pids.length === 2 && pids.every(alive) ? pids : null; }, 'both hanging agent PIDs');
  const unauthorizedStop = await fetch(`${base}/api/tournaments/${hangRun.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(unauthorizedStop.status, 403);
  await page.getByRole('button', { name: 'Stop tournament', exact: true }).click();
  await page.waitForFunction(id => document.querySelector('[aria-label="Verified tournament report"]')?.textContent.includes(id) && document.querySelector('.tournament-notice')?.textContent === 'Report verified. Every recorded replay passed verification.', hangRun.id, { timeout });
  const canceledResponse = await fetch(`${base}/api/tournaments/${hangRun.id}/result`, { headers: { Cookie: cookie } }); assert.equal(canceledResponse.status, 200);
  const canceled = await verifyTournamentReport(await canceledResponse.json()); await writeFile(path.join(output, 'canceled-report.json'), JSON.stringify(canceled, null, 2) + '\n');
  assert.equal(canceled.status, 'canceled'); assert.equal(canceled.matches.length, 1); assert.equal(canceled.matches[0].status, 'aborted');
  const canceledPids = canceled.matches.flatMap(match => match.agents.map(agent => agent.pid)).sort((a, b) => a - b); assert.deepEqual(canceledPids, runningPids); assert(canceledPids.every(pid => !alive(pid))); assert.deepEqual(await markedPids(), []);
  evidence.checks.cancelThroughHttpStopsBothObservedLiveAgentPids = true; evidence.checks.canceledPartialReportVerifiedInNodeAndBrowser = true;
  evidence.runs = [{ id: smokeReport.id, status: smokeReport.status, pids: smokePids, matches: smokeReport.matches.map(match => ({ id: match.id, finalTick: match.finalTick, finalStateSha256: match.finalStateSha256 })) }, { id: canceled.id, status: canceled.status, pids: canceledPids, livePidsBeforeCancel: runningPids }];
  await page.locator('[data-tournament-match="match-001"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, 'dashboard-canceled.png') });
  evidence.browserProof = await snap(); assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'summary.json'), JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify(evidence.checks));
} finally {
  await service.dispose(); if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  const survivors = await markedPids(); await writeFile(path.join(output, 'cleanup.json'), JSON.stringify({ remainingAgentPids: survivors, serverClosed: !server?.listening, browserClosed: !browser?.isConnected() }, null, 2) + '\n');
  assert.deepEqual(survivors, [], 'Tournament proof left agent processes alive.');
}
