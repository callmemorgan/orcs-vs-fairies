import { chromium } from '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const evidence = path.resolve(process.env.OVF_EDITOR_EVIDENCE_DIR || 'docs/evidence/community-browser-20261001');
await mkdir(evidence, { recursive: true }); await mkdir('dist-server', { recursive: true });
const entry = path.resolve('dist-server/community-proof-entry.ts'), bundle = path.resolve('dist-server/community-proof.mjs');
await writeFile(entry, "export { createRtsServer } from '../src/server/server'; export { createEditedMatch } from '../src/editor/launch'; export { MatchRecorder, ReplayPlayer } from '../src/core/replays'; export { stepGame } from '../src/core/simulation'; export { saveGame } from '../src/core/saves';\n");
await promisify(execFile)(path.resolve('node_modules/.bin/esbuild'), [entry, '--bundle', '--platform=node', '--format=esm', '--packages=external', `--outfile=${bundle}`]);
const { createRtsServer, createEditedMatch, MatchRecorder, ReplayPlayer, stepGame, saveGame } = await import(pathToFileURL(bundle).href);
const dataDir = await mkdtemp(path.join(tmpdir(), 'ovf-community-browser-'));
let server = await createRtsServer({ port: 0, dataDir, staticDir: path.resolve('dist') });
const base = server.url, port = server.port, suffix = String(Date.now()), localId = `browser-map-${suffix}`;
const browser = await chromium.launch({ headless: true });
const publisher = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const receiver = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const a = await publisher.newPage(), b = await receiver.newPage(), results = [], errors = [];
for (const page of [a, b]) page.on('pageerror', error => errors.push(error.message));
function checked(name, data = {}) { results.push({ name, ...data }); process.stdout.write(`PASS ${name}\n`); }
async function openCommunity(page) { await page.getByRole('button', { name: 'Community packages', exact: true }).click(); await page.getByRole('dialog', { name: 'Community packages', exact: true }).waitFor(); }
async function register(page, name) {
  await page.getByLabel('Community username', { exact: true }).fill(name);
  await page.getByLabel('Community password', { exact: true }).fill('Browser proof password');
  const receipt = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create community account', exact: true }).click();
  const response = await receipt; assert.equal(response.status(), 200);
  await page.locator('.community-account').getByText(`Signed in as ${name}.`, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Search community', exact: true }).waitFor();
  return (await response.json()).account;
}
async function publishMap() {
  const responseWait = a.waitForResponse(response => response.url().endsWith('/api/packages') && response.request().method() === 'POST');
  await a.getByRole('button', { name: 'Publish current map', exact: true }).click();
  const response = await responseWait; assert.equal(response.status(), 201);
  const value = await response.json(), pkg = response.request().postDataJSON().package;
  await a.locator('.community-status').getByText('Package published. Existing revisions remain available.', { exact: true }).waitFor();
  return { ...value, pkg };
}
async function search(page) {
  await page.getByLabel('Search packages', { exact: true }).fill(localId);
  await page.getByLabel('Package kind', { exact: true }).selectOption('map');
  const wait = page.waitForResponse(response => response.url().includes('/api/packages?') && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Search community', exact: true }).click();
  assert.equal((await wait).status(), 200); await page.locator('.community-results article').getByRole('button', { name: 'View package', exact: true }).click();
  await page.getByLabel('Published revision', { exact: true }).waitFor();
}
async function install(page, name = 'Download and install') {
  await page.locator('.community-details').getByRole('button', { name, exact: true }).click();
  await page.locator('.community-status').filter({ hasText: /^Installed / }).waitFor();
}
async function paint(page, kind) {
  await page.getByLabel('Editor tool', { exact: true }).selectOption('terrain');
  await page.getByLabel('Terrain brush', { exact: true }).selectOption(kind);
  const box = await page.getByLabel('Map painting canvas', { exact: true }).boundingBox(); assert(box);
  await page.mouse.click(box.x + 1.5 / 36 * box.width, box.y + 1.5 / 36 * box.height);
}
let first, second, oldReplay;
try {
  await a.goto(`${base}/editor.html?art=placeholder`);
  await a.getByLabel('Map title', { exact: true }).fill('Community river pass');
  await a.getByLabel('Package ID', { exact: true }).fill(localId); await paint(a, 'sand');
  await a.getByRole('button', { name: 'Close editor', exact: true }).click(); await openCommunity(a);
  const author = await register(a, `Publisher${suffix}`); first = await publishMap();
  assert.equal(first.pkg.revision, 1); assert.equal(first.pkg.map.levels[0].terrain[37], 'sand');
  await writeFile(path.join(evidence, 'published-map-v1.json'), JSON.stringify(first.pkg));
  checked('publisher authors and publishes a playable map through normal editor and account controls', { hash: first.detail.hash, version: first.detail.version });
  const oldState = createEditedMatch(first.pkg), recorder = new MatchRecorder(oldState);
  for (let tick = 0; tick < 40; tick++) stepGame(oldState, .05);
  oldReplay = recorder.export(); recorder.dispose(); await writeFile(path.join(evidence, 'pinned-map-v1.replay.json'), JSON.stringify(oldReplay));

  await b.goto(`${base}/editor.html?art=placeholder`); await b.getByRole('button', { name: 'Close editor', exact: true }).click(); await openCommunity(b);
  const viewer = await register(b, `Receiver${suffix}`); assert.notEqual(author.id, viewer.id); await search(b);
  assert.equal(await b.getByLabel('Published revision', { exact: true }).inputValue(), '1');
  await b.getByLabel('Map preview level 1', { exact: true }).waitFor();
  await b.screenshot({ path: path.join(evidence, 'community-preview.png'), fullPage: true });
  checked('independent authenticated profile searches remote metadata and sees the package preview');
  await install(b); await b.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await b.waitForFunction(hash => window.editorDiagnostics?.()?.packageHash === hash && window.editorDiagnostics().tick > 10, first.pkg.hash);
  assert.equal(await b.getByLabel('Running community package', { exact: true }).innerText(), 'Community river pass · version 1');
  let observation = await b.evaluate(() => window.editorDiagnostics()); assert.deepEqual(observation.terrain, first.pkg.map.levels[0].terrain);
  checked('downloaded checksum-verified revision launches the authored terrain in the actual game', { tick: observation.tick });
  await b.screenshot({ path: path.join(evidence, 'community-map-in-play.png'), fullPage: true });
  await b.getByRole('button', { name: 'Pause', exact: true }).click();

  await a.getByRole('button', { name: 'Close community', exact: true }).click(); await a.getByRole('button', { name: 'Map and scenario editor', exact: true }).click();
  const download = a.waitForEvent('download'); await a.getByRole('button', { name: 'Export map package', exact: true }).click(); await (await download).saveAs(path.join(evidence, 'editor-map-v1.json'));
  assert.deepEqual(JSON.parse(await readFile(path.join(evidence, 'editor-map-v1.json'), 'utf8')), first.pkg);
  await a.getByLabel('Map title', { exact: true }).fill('Community river pass revised'); await paint(a, 'grass');
  await a.getByRole('button', { name: 'Close editor', exact: true }).click(); await openCommunity(a); second = await publishMap();
  assert.equal(second.pkg.revision, 2); assert.notEqual(second.detail.hash, first.detail.hash); assert.deepEqual(second.detail.revisions.map(row => row.version), ['2', '1']);
  await writeFile(path.join(evidence, 'published-map-v2.json'), JSON.stringify(second.pkg));
  await openCommunity(b); await search(b); await install(b);
  await b.getByLabel('Published revision', { exact: true }).selectOption('1');
  await install(b, 'Verify and reinstall revision');
  const installed = await b.locator('.community-installed').innerText(); assert.match(installed, /version 1/); assert.match(installed, /version 2/);
  checked('new publication keeps both immutable revisions and installation preserves the original');
  await b.screenshot({ path: path.join(evidence, 'community-pinned-revisions.png'), fullPage: true });
  await b.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await b.waitForFunction(hash => window.editorDiagnostics?.()?.packageHash === hash && window.editorDiagnostics().tick > 10, first.pkg.hash);
  checked('launching a pinned revision starts its new match after the prior match was paused');

  await server.close(); server = await createRtsServer({ port, dataDir, staticDir: path.resolve('dist') });
  await b.reload(); await b.getByRole('button', { name: 'Close editor', exact: true }).click(); await openCommunity(b); await search(b);
  await b.getByLabel('Published revision', { exact: true }).selectOption('1'); await install(b, 'Verify and reinstall revision');
  await b.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await b.waitForFunction(hash => window.editorDiagnostics?.()?.packageHash === hash && window.editorDiagnostics().tick > 10, first.pkg.hash);
  observation = await b.evaluate(() => window.editorDiagnostics()); assert.equal(observation.terrain[37], 'sand'); assert.deepEqual(observation.terrain, first.pkg.map.levels[0].terrain);
  checked('server restart and browser reload retain authentication, downloads and installed old revision');

  const replay = new ReplayPlayer(JSON.parse(await readFile(path.join(evidence, 'pinned-map-v1.replay.json'), 'utf8'))); replay.advance(40);
  assert(replay.finished); assert.equal(replay.state.terrain[37], 'sand'); assert.deepEqual(saveGame(replay.state), saveGame(oldState)); replay.dispose();
  checked('original replay opens through the shared replay player after newer remote publication and restart', { finalTick: oldReplay.finalTick, checksum: oldReplay.finalChecksum });
  assert.deepEqual(errors, []); checked('both browser profiles have no uncaught errors');
} catch (error) {
  await b.screenshot({ path: path.join(evidence, 'community-proof-failure.png'), fullPage: true });
  await writeFile(path.join(evidence, 'failure.json'), JSON.stringify({ error: String(error), publisherStatus: await a.locator('.community-status').allTextContents(), receiverStatus: await b.locator('.community-status').allTextContents() }, null, 2)); throw error;
} finally {
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify({ base, results, errors, checkedAt: new Date().toISOString(), scope: 'Production browser map publication/install/play and shared replay playback; mod installation has separate HTTP proof and mod launch awaits the merged content engine.' }, null, 2));
  await browser.close(); await server.close(); await rm(dataDir, { recursive: true, force: true });
}
