import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { worldSourceProof, checkCurrentSession, downloadWorldBuildReport, sha } from './world/proof-common.mjs';
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const evidence = path.resolve(process.env.OVF_EDITOR_EVIDENCE_DIR || 'docs/evidence/community-browser-20261001');
await mkdir(path.dirname(evidence), { recursive: true }); await mkdir(evidence); await mkdir('dist-server', { recursive: true });
const source = await worldSourceProof(process.env.OVF_PRODUCTION_SOURCE_COMMIT ?? process.env.OVF_SOURCE_PIN);
assert.equal(execFileSync('git', ['diff', source.sourcePin, '--name-only', '--', 'scripts/verify_community_browser.mjs'], { encoding: 'utf8' }).trim(), '', 'Community map driver must match the source pin');
const scriptSha256 = sha(await readFile(fileURLToPath(import.meta.url))), staticDir = path.resolve(process.env.OVF_COMMUNITY_MAP_STATIC_DIR ?? process.env.OVF_PROOF_DIST ?? 'dist');
const helperDir = await mkdtemp(path.resolve('dist-server/community-map-proof-'));
const entry = path.join(helperDir, 'entry.ts'), bundle = path.join(helperDir, 'entry.mjs');
await writeFile(entry, [
  `export { createRtsServer } from ${JSON.stringify(path.join(root, 'src/server/server.ts'))};`,
  `export { createEditedMatch } from ${JSON.stringify(path.join(root, 'src/editor/launch.ts'))};`,
  `export { MatchRecorder, ReplayPlayer } from ${JSON.stringify(path.join(root, 'src/core/replays.ts'))};`,
  `export { stepGame } from ${JSON.stringify(path.join(root, 'src/core/simulation.ts'))};`,
  `export { saveGame } from ${JSON.stringify(path.join(root, 'src/core/saves.ts'))};`,
].join('\n'));
await promisify(execFile)(path.resolve('node_modules/.bin/esbuild'), [entry, '--bundle', '--platform=node', '--format=esm', '--packages=external', `--outfile=${bundle}`]);
const { createRtsServer, createEditedMatch, MatchRecorder, ReplayPlayer, stepGame, saveGame } = await import(pathToFileURL(bundle).href);
const dataDir = await mkdtemp(path.join(tmpdir(), 'ovf-community-browser-'));
let server = await createRtsServer({ port: 0, dataDir, staticDir });
const base = server.url, port = server.port, suffix = String(Date.now()), localId = `browser-map-${suffix}`;
const browser = await chromium.launch({ headless: true });
const publisher = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const receiver = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const a = await publisher.newPage(), b = await receiver.newPage(), results = [], errors = [];
let failure, servedBuild;
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
async function install(page, publication, name = 'Download and install') {
  const receipt = page.waitForResponse(response => response.url().endsWith(`/api/packages/content/${publication.detail.hash}`) && response.request().method() === 'GET');
  await page.locator('.community-details').getByRole('button', { name, exact: true }).click();
  const response = await receipt; assert.equal(response.status(), 200);
  assert.deepEqual((await response.json()).package, publication.pkg);
  await page.locator('.community-status').getByText(`Installed ${publication.pkg.title}, version ${publication.detail.version}.`, { exact: true }).waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.community-details button')).some(button => button.textContent === 'Play installed revision' && !button.disabled));
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
  await promisify(execFile)(process.execPath, [path.resolve('scripts/verify_served_build.mjs'), `${base}/editor.html`, path.join(evidence, 'served-build.json'), staticDir]);
  servedBuild = JSON.parse(await readFile(path.join(evidence, 'served-build.json'), 'utf8')); assert.equal(servedBuild.commit, source.sourcePin); assert.equal(servedBuild.sourceSha256, source.buildId);
  await a.getByLabel('Map title', { exact: true }).fill('Community river pass');
  await a.getByLabel('Package ID', { exact: true }).fill(localId); await paint(a, 'sand');
  await a.getByRole('button', { name: 'Close editor', exact: true }).click(); await openCommunity(a);
  const author = await register(a, `Publisher${suffix}`); first = await publishMap();
  assert.equal(first.pkg.simulationVersion, source.saveVersion);
  assert.equal(first.pkg.revision, 1); assert.equal(first.pkg.map.levels[0].terrain[37], 'sand');
  await writeFile(path.join(evidence, 'published-map-v1.json'), JSON.stringify(first.pkg));
  checked('publisher authors and publishes a playable map through normal editor and account controls', { hash: first.detail.hash, version: first.detail.version });
  const oldState = createEditedMatch(first.pkg), recorder = new MatchRecorder(oldState);
  for (let tick = 0; tick < 40; tick++) stepGame(oldState, .05);
  oldReplay = recorder.export(); recorder.dispose(); await writeFile(path.join(evidence, 'pinned-map-v1.replay.json'), JSON.stringify(oldReplay));
  assert.equal(oldReplay.initial.version, source.saveVersion); assert.equal(oldReplay.checksumVersion, source.saveVersion); assert.equal(oldReplay.simulationRevision, source.simulationRevision);

  await b.goto(`${base}/editor.html?art=placeholder`); await b.getByRole('button', { name: 'Close editor', exact: true }).click(); await openCommunity(b);
  const viewer = await register(b, `Receiver${suffix}`); assert.notEqual(author.id, viewer.id); await search(b);
  assert.equal(await b.getByLabel('Published revision', { exact: true }).inputValue(), '1');
  await b.getByLabel('Map preview level 1', { exact: true }).waitFor();
  await b.screenshot({ path: path.join(evidence, 'community-preview.png'), fullPage: true });
  checked('independent authenticated profile searches remote metadata and sees the package preview');
  await install(b, first); await b.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
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
  assert.equal(second.pkg.simulationVersion, source.saveVersion);
  assert.equal(second.pkg.revision, 2); assert.notEqual(second.detail.hash, first.detail.hash); assert.deepEqual(second.detail.revisions.map(row => row.version), ['2', '1']);
  await writeFile(path.join(evidence, 'published-map-v2.json'), JSON.stringify(second.pkg));
  await openCommunity(b); await search(b); await install(b, second);
  await b.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await b.waitForFunction(hash => window.editorDiagnostics?.()?.packageHash === hash && window.editorDiagnostics().tick > 10 && !window.rts.paused, second.pkg.hash);
  assert.deepEqual((await b.evaluate(() => window.editorDiagnostics())).terrain, second.pkg.map.levels[0].terrain);
  checked('the revised package replaces the paused old match with its authored terrain');
  await openCommunity(b); await search(b);
  await b.getByLabel('Published revision', { exact: true }).selectOption('1');
  await install(b, first, 'Verify and reinstall revision');
  const installed = await b.locator('.community-installed').innerText(); assert.match(installed, /version 1/); assert.match(installed, /version 2/);
  checked('new publication keeps both immutable revisions and installation preserves the original');
  await b.screenshot({ path: path.join(evidence, 'community-pinned-revisions.png'), fullPage: true });
  await b.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await b.waitForFunction(hash => window.editorDiagnostics?.()?.packageHash === hash && window.editorDiagnostics().tick > 10 && !window.rts.paused, first.pkg.hash);
  checked('launching a pinned revision starts its new match after the prior match was paused');

  await server.close(); server = await createRtsServer({ port, dataDir, staticDir });
  await b.reload(); await b.getByRole('button', { name: 'Close editor', exact: true }).click(); await openCommunity(b); await search(b);
  await b.getByLabel('Published revision', { exact: true }).selectOption('1'); await install(b, first, 'Verify and reinstall revision');
  await b.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await b.waitForFunction(hash => window.editorDiagnostics?.()?.packageHash === hash && window.editorDiagnostics().tick > 10, first.pkg.hash);
  observation = await b.evaluate(() => window.editorDiagnostics()); assert.equal(observation.terrain[37], 'sand'); assert.deepEqual(observation.terrain, first.pkg.map.levels[0].terrain);
  checked('server restart and browser reload retain authentication, downloads and installed old revision');

  const replay = new ReplayPlayer(JSON.parse(await readFile(path.join(evidence, 'pinned-map-v1.replay.json'), 'utf8'))); replay.advance(40);
  assert(replay.finished); assert.equal(replay.state.terrain[37], 'sand'); assert.deepEqual(saveGame(replay.state), saveGame(oldState)); replay.dispose();
  checked('original replay opens through the shared replay player after newer remote publication and restart', { finalTick: oldReplay.finalTick, checksum: oldReplay.finalChecksum });

  await b.locator('[data-session-tool="replay"]').click();
  await b.getByLabel('Import replay JSON', { exact: true }).setInputFiles(path.join(evidence, 'pinned-map-v1.replay.json'));
  await b.getByRole('button', { name: 'Import replay', exact: true }).click();
  await b.waitForFunction(() => window.rts?.mode === 'replay' && window.rts.state.tick === 0, null, { timeout: 45000 });
  assert.equal((await b.evaluate(() => window.rts.state.terrain))[37], 'sand');
  const browserReplay = new ReplayPlayer(oldReplay);
  for (const tick of [20, 40, 0, 40]) {
    const slider = b.getByLabel('Replay tick', { exact: true });
    if (tick === 40) await slider.press('End');
    else {
      await slider.press('Home'); await b.waitForFunction(() => window.rts?.state.tick === 0);
      for (let next = 1; next <= tick; next++) { await slider.press('ArrowRight'); await b.waitForFunction(tick => window.rts?.state.tick === tick, next); }
    }
    await b.waitForFunction(tick => window.rts?.mode === 'replay' && window.rts.state.tick === tick, tick, { timeout: 45000 });
    browserReplay.seek(tick);
    await b.locator('[data-session-tab="saves"]').click();
    const downloading = b.waitForEvent('download');
    await b.getByRole('button', { name: 'Export save', exact: true }).click();
    const file = path.join(evidence, `browser-replay-tick-${tick}-${results.length}.save.json`);
    await (await downloading).saveAs(file);
    const session = JSON.parse(await readFile(file, 'utf8'));
    checkCurrentSession(session, source);
    assert.deepEqual(session.game, saveGame(browserReplay.state), 'Actual main replay viewer exports the complete canonical state at the selected tick');
    await b.locator('[data-session-tab="replay"]').click();
    checked('native browser replay viewer seeks pinned old terrain with complete state equality', { tick });
  }
  browserReplay.dispose();
  await b.getByLabel('Replay tick', { exact: true }).press('Home');
  await b.waitForFunction(() => window.rts?.state.tick === 0);
  await b.getByRole('button', { name: 'Close session tools', exact: true }).click();
  await b.locator('[data-session-tool="replay"]').click();
  await b.getByRole('button', { name: 'Play replay', exact: true }).click();
  await b.getByRole('button', { name: 'Close session tools', exact: true }).click();
  await b.waitForFunction(() => window.rts?.state.tick === 40 && window.rts.paused, null, { timeout: 15000 });
  assert(!(await b.locator('.notice').allTextContents()).some(text => text.includes('Replay stopped:')), 'Playback reached completion without a caught replay error');
  await b.locator('[data-session-tool="saves"]').click();
  const completedDownload = b.waitForEvent('download');
  await b.getByRole('button', { name: 'Export save', exact: true }).click();
  const completedFile = path.join(evidence, 'browser-played-complete.save.json');
  await (await completedDownload).saveAs(completedFile);
  const completedSession = JSON.parse(await readFile(completedFile, 'utf8')); checkCurrentSession(completedSession, source);
  assert.deepEqual(completedSession.game, saveGame(oldState), 'Timed native playback reaches the full expected final state');
  const buildEvidence = {}; await downloadWorldBuildReport(b, { out: evidence, provenance: source }, 'community-map-build-report.json', buildEvidence);
  await b.getByRole('button', { name: 'Close session tools', exact: true }).click();
  await b.screenshot({ path: path.join(evidence, 'community-pinned-replay-viewer.png'), fullPage: true });
  checked('native browser viewer plays the original recording to completion after publication and restart', buildEvidence);
  assert.deepEqual(await worldSourceProof(source.sourcePin), source, 'Source changed during community map proof');
  assert.deepEqual(errors, []); checked('both browser profiles have no uncaught errors');
} catch (error) {
  failure = String(error);
  await b.screenshot({ path: path.join(evidence, 'community-proof-failure.png'), fullPage: true });
  await writeFile(path.join(evidence, 'failure.json'), JSON.stringify({ error: String(error), publisherStatus: await a.locator('.community-status').allTextContents(), receiverStatus: await b.locator('.community-status').allTextContents() }, null, 2)); throw error;
} finally {
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify({ base, staticDir, source, scriptSha256, servedBuild, serverBundleSha256: sha(await readFile(bundle)), results, errors, failure, checkedAt: new Date().toISOString(), scope: 'Canonical production game host: two-account map publication/install/play, restart, pinned revisions and native browser replay playback with complete exported state equality.' }, null, 2));
  await browser.close(); await server.close(); await rm(dataDir, { recursive: true, force: true }); await rm(helperDir, { recursive: true, force: true });
}
