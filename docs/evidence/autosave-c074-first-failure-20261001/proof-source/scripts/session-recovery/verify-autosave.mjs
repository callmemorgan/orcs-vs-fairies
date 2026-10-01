import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authenticatedDownloadPath, fingerprint, readAuthenticatedDownload } from './native-downloads.mjs';

// Run this committed proof separately from a clean, immutable product checkout.
// Browser evaluation observes only; all game actions use normal product controls.
const [, , base, productArg, productPin, outputArg, proofPin] = process.argv;
assert(base && productArg && productPin && outputArg && proofPin,
  'Usage: node verify-autosave.mjs BASE PRODUCT_ROOT FULL_PRODUCT_PIN NEW_OUTPUT FULL_PROOF_PIN');
for (const pin of [productPin, proofPin]) assert.match(pin, /^[0-9a-f]{40}$/);
const entry = fileURLToPath(import.meta.url), proofRoot = resolve(dirname(entry), '../..');
const productRoot = resolve(productArg), out = resolve(outputArg);
assert.notEqual(productRoot, proofRoot, 'Keep the proof commit separate from the frozen product checkout');
const git = (root, args) => execFileSync('git', args, {cwd: root, maxBuffer: 32 * 1024 * 1024});
async function proofSources() {
  assert.equal(git(proofRoot, ['rev-parse', 'HEAD']).toString().trim(), proofPin,
    'Executing proof checkout must remain on its requested commit');
  const sources = {};
  for (const path of ['scripts/session-recovery/verify-autosave.mjs', 'scripts/session-recovery/native-downloads.mjs']) {
    const bytes = await readFile(join(proofRoot, path));
    assert.deepEqual(bytes, git(proofRoot, ['show', `${proofPin}:${path}`]), `${path} equals committed proof bytes`);
    sources[path] = fingerprint(bytes);
  }
  return sources;
}
const sourceBefore = await proofSources();
process.chdir(productRoot);
const {prepareProof, observePage, finishProof, verifyBugReport} = await import(
  pathToFileURL(join(productRoot, 'scripts/controls-proof/browser-common.mjs')).href,
);
const proof = await prepareProof({base, sourcePin: productPin, outputDir: out, feature: 90});
const {schema, sha} = proof;
const report = {
  feature: 90, productPin, proofPin, proofSources: sourceBefore,
  method: 'Fresh production skirmish, natural wall-clock simulation, native settings/recruitment/save/load/import controls and real reload/pagehide. Page evaluation reads diagnostics, DOM and native localStorage only. Download fingerprints are captured immediately and checked before import and finalization.',
  startedAt: new Date().toISOString(), result: 'running', checks: [], downloads: {}, screenshots: [],
  pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [],
};
const receipt = join(out, 'browser-proof.json');
const persist = () => writeFile(receipt, `${JSON.stringify(report, null, 2)}\n`);
const storageKey = 'orcs-vs-fairies:sessions:v1', preferencesKey = 'orcs-vs-fairies:autosave:v1';
const saveName = 'Recovery 90 named';
const snapshot = page => page.evaluate(() => {
  const r = window.rts, s = r.state;
  const hq = s.entities.find(e => e.side === 0 && e.kind === 'building' && e.role === 'hq' && e.hp > 0);
  return {
    tick: s.tick, time: s.time, paused: r.paused, mode: r.mode, readOnly: r.readOnly,
    winner: s.winner, draw: s.draw, controller: s.controllers[0],
    bank: {wood: s.players[0].wood, ore: s.players[0].ore, crystal: s.players[0].crystal},
    workers: s.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.role === 'worker' && e.hp > 0).map(e => e.id),
    hq: hq ? {id: hq.id, queue: [...hq.queue], trainProgress: hq.trainProgress} : null,
  };
});
const readStore = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"version":1,"slots":[]}'), storageKey);
const readPreferences = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), preferencesKey);
const openSaves = page => page.locator('[data-session-tool="saves"]').click();
const closeTools = page => page.getByRole('button', {name: 'Close session tools', exact: true}).click();
const ready = page => page.waitForSelector('.loading-battle[hidden]', {state: 'attached', timeout: 60000});
const waitForLoadedTick = async (page, tick) => {
  await ready(page);
  await page.waitForFunction(expected => window.rts?.state.tick === expected && window.rts.paused, tick, {timeout: 60000});
};
function currentSession(file) {
  assert.equal(file.format, schema.sessionFormat); assert.equal(file.version, schema.sessionVersion);
  assert.equal(file.game.format, schema.saveFormat); assert.equal(file.game.version, schema.saveVersion);
  assert(file.game.runtime, 'Saved game includes behavioral runtime');
  assert(file.replay, 'Native session retains recorded history');
  assert.equal(file.replay.format, schema.replayFormat); assert.equal(file.replay.version, schema.replayVersion);
  assert.equal(file.replay.initial.version, schema.saveVersion);
  assert.equal(file.replay.checksumVersion, schema.replayChecksumVersion);
  assert.equal(file.replay.simulationRevision, schema.simulationRevision);
  assert.equal(file.replay.finalTick, file.game.state.tick);
}
async function record(id, details = {}) {
  report.checks.push({id, ...details}); await persist(); console.log(JSON.stringify(report.checks.at(-1)));
}
async function download(page, button, filename) {
  const path = authenticatedDownloadPath(out, filename);
  try { await readFile(path); assert.fail(`Refusing to replace native download ${filename}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: button, exact: true}).click();
  const native = await pending; await native.saveAs(path);
  // This original fingerprint is taken directly after the browser download.
  const bytes = await readFile(path);
  report.downloads[filename] = {...fingerprint(bytes), suggestedFilename: native.suggestedFilename()};
  await persist();
  return JSON.parse(readAuthenticatedDownload(out, filename, report.downloads).bytes.toString('utf8'));
}
async function screenshot(page, filename) {
  await page.screenshot({path: join(out, filename)});
  report.screenshots.push({file: filename, ...fingerprint(await readFile(join(out, filename)))});
}
const gameHash = file => sha(JSON.stringify(file.game));
let browser, context, freshContext, page, failure, phase = 'launch native production browser';
try {
  await persist();
  const playwrightModule = process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright';
  const {chromium} = await import(playwrightModule);
  browser = await chromium.launch({headless: true,
    ...(process.env.OVF_CHROMIUM_EXECUTABLE ? {executablePath: process.env.OVF_CHROMIUM_EXECUTABLE} : {}),
    args: ['--disable-dev-shm-usage']});
  report.browser = {playwrightModule, version: browser.version(), executablePath: process.env.OVF_CHROMIUM_EXECUTABLE ?? chromium.executablePath()};
  context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true, serviceWorkers: 'block'});
  page = await context.newPage(); observePage(page, report, proof);
  await page.goto(proof.base);
  await page.locator('#map-size').selectOption('medium');
  await page.locator('#opponent').selectOption('fairies');
  await page.locator('#map-seed').fill('20261001');
  await page.locator('.begin-match').click(); await ready(page);
  await page.waitForFunction(() => window.rts?.state.tick > 5);
  await openSaves(page);
  const start = await snapshot(page);
  assert(start.paused); assert.equal(start.mode, 'local'); assert.equal(start.readOnly, false);
  assert.equal(start.controller, 'human'); assert.deepEqual((await readStore(page)).slots, []);
  await page.getByLabel('Save name', {exact: true}).fill(saveName);
  await page.getByRole('button', {name: 'Save match', exact: true}).click();
  await page.getByRole('button', {name: `Load ${saveName}`, exact: true}).waitFor();
  const manual = await download(page, 'Export save', 'native-manual.json'); currentSession(manual);
  const manualSlot = (await readStore(page)).slots.find(slot => !slot.autosave);
  assert(manualSlot); assert.deepEqual(manualSlot.file.game, manual.game);
  await page.getByLabel('Enable autosaves', {exact: true}).check();
  await page.getByLabel('Autosave frequency', {exact: true}).selectOption('30');
  await page.getByRole('button', {name: 'Apply autosave settings', exact: true}).click();
  await page.locator('.session-tools .session-notice').filter({hasText: 'Autosave settings saved'}).waitFor({state: 'visible'});
  assert.deepEqual(await readPreferences(page), {enabled: true, intervalSeconds: 30});
  const baseline = await snapshot(page), wallStart = performance.now();
  phase = 'natural timed autosave'; await closeTools(page);
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) ?? '{"slots":[]}').slots.some(slot => slot.id === 'autosave'),
    storageKey, {timeout: 90000, polling: 100});
  await openSaves(page);
  const timedStore = await readStore(page), timed = timedStore.slots.find(slot => slot.id === 'autosave');
  assert(timed?.autosave); currentSession(timed.file);
  assert(timed.time >= baseline.time + 30 - 1e-8 && timed.time <= baseline.time + 30.1);
  const wallSeconds = (performance.now() - wallStart) / 1000;
  assert(wallSeconds >= 29.8, 'Ordinary autosave requires natural elapsed time');
  assert.deepEqual(timedStore.slots.find(slot => slot.id === manualSlot.id), manualSlot);
  await writeFile(join(out, 'native-timed-store.json'), `${JSON.stringify(timedStore, null, 2)}\n`);
  await record('natural-current-rules-autosave-preserves-manual-slot', {
    baseline, tick: timed.file.game.state.tick, time: timed.time, wallSeconds, gameHash: gameHash(timed.file),
  });

  phase = 'native in-flight recruitment and pre-interruption checkpoint';
  await page.locator('[data-session-tab="production"]').click();
  const beforeRecruit = await snapshot(page); assert(beforeRecruit.hq); assert.deepEqual(beforeRecruit.hq.queue, []);
  await page.locator(`[data-production-building="${beforeRecruit.hq.id}"] [data-recruit="worker"]`).click();
  await page.waitForFunction(id => window.rts.state.entities.find(e => e.id === id)?.queue.includes('worker'), beforeRecruit.hq.id);
  const queued = await snapshot(page);
  assert(queued.paused); assert.equal(queued.tick, beforeRecruit.tick);
  assert.deepEqual(queued.hq.queue, ['worker']); assert.equal(queued.hq.trainProgress, 0);
  assert(queued.bank.wood < beforeRecruit.bank.wood, 'Native recruitment charges its cost before saving');
  await page.locator('[data-session-tab="saves"]').click();
  const beforeReload = await download(page, 'Export save', 'native-before-reload.json'); currentSession(beforeReload);
  assert.equal(beforeReload.game.state.tick, queued.tick);
  const recruit = beforeReload.replay.actions.find(action => action.type === 'command' && action.side === 0
    && action.command.type === 'train' && action.command.id === queued.hq.id && action.command.role === 'worker');
  assert(recruit, 'Native recruitment appears in the recorded history');
  await screenshot(page, 'before-reload.png');
  await record('native-recruitment-is-paid-recorded-and-still-in-progress', {tick: queued.tick, hq: queued.hq, bank: queued.bank, command: recruit});

  phase = 'real reload/pagehide interrupted-game recovery';
  await page.reload(); await page.locator('[data-session-tool="saves"]').waitFor();
  const reloadedStore = await readStore(page), forced = reloadedStore.slots.find(slot => slot.id === 'autosave');
  assert(forced); currentSession(forced.file); assert.deepEqual(forced.file.game, beforeReload.game);
  assert(reloadedStore.slots.some(slot => slot.autosave && slot.id !== 'autosave'
    && gameHash(slot.file) === gameHash(timed.file)),
  'The timed checkpoint remains in an older slot after one or both native lifecycle save events');
  assert.deepEqual(reloadedStore.slots.find(slot => slot.id === manualSlot.id), manualSlot);
  assert.deepEqual(await readPreferences(page), {enabled: true, intervalSeconds: 30});
  await writeFile(join(out, 'native-pagehide-store.json'), `${JSON.stringify(reloadedStore, null, 2)}\n`);
  await openSaves(page); await page.getByRole('button', {name: 'Load Autosave', exact: true}).click();
  await waitForLoadedTick(page, queued.tick);
  const recovered = await download(page, 'Export save', 'native-recovered.json'); currentSession(recovered);
  assert.deepEqual(recovered.game, beforeReload.game);
  await screenshot(page, 'recovered-autosave.png');
  await record('real-pagehide-and-ui-load-restore-complete-in-flight-game', {tick: queued.tick, gameHash: gameHash(recovered), preservedManualSlot: manualSlot.id});

  phase = 'ordinary production continues after recovery'; await closeTools(page);
  if ((await snapshot(page)).paused) {
    await page.getByRole('button', {name: 'Return to battle', exact: true}).click();
    await page.waitForFunction(() => !window.rts.paused);
  }
  await page.waitForFunction(({id, workers}) => {
    const s = window.rts.state, hq = s.entities.find(e => e.id === id);
    return hq?.queue.length === 0 && s.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.role === 'worker' && e.hp > 0).length === workers + 1;
  }, {id: queued.hq.id, workers: queued.workers.length}, {timeout: 60000, polling: 100});
  await openSaves(page);
  const continued = await snapshot(page); assert(continued.tick > queued.tick);
  assert.equal(continued.winner, null); assert.equal(continued.draw, false);
  assert.equal(continued.workers.length, queued.workers.length + 1); assert.deepEqual(continued.hq.queue, []);
  assert.deepEqual(continued.bank, queued.bank, 'Recovered paid production does not charge a second time');
  const continuation = await download(page, 'Export save', 'native-continued.json'); currentSession(continuation);
  await screenshot(page, 'recovered-production-completed.png');
  await record('recovered-queue-completes-through-natural-simulation', {before: queued, after: continued, gameHash: gameHash(continuation)});

  phase = 'authenticated native download import in fresh browser storage';
  freshContext = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true, serviceWorkers: 'block'});
  const fresh = await freshContext.newPage(); observePage(fresh, report, proof); await fresh.goto(proof.base);
  assert.deepEqual((await readStore(fresh)).slots, []);
  await openSaves(fresh);
  const authenticated = readAuthenticatedDownload(out, 'native-before-reload.json', report.downloads);
  await fresh.getByLabel('Import save JSON', {exact: true}).setInputFiles(authenticated.path);
  await fresh.getByRole('button', {name: 'Import save', exact: true}).click();
  await waitForLoadedTick(fresh, queued.tick);
  const imported = await download(fresh, 'Export save', 'native-imported.json'); currentSession(imported);
  assert.deepEqual(imported.game, beforeReload.game); assert.deepEqual((await readStore(fresh)).slots, []);
  await screenshot(fresh, 'fresh-authenticated-import.png');
  await record('authenticated-native-import-restores-complete-envelope-in-fresh-context', {
    originalFingerprint: report.downloads['native-before-reload.json'], gameHash: gameHash(imported), localSlots: 0,
  });

  phase = 'native current product build identity';
  await page.locator('[data-session-tab="report"]').click();
  await page.getByLabel('Bug description', {exact: true}).fill('Original feature 90 autosave, interruption and recovery acceptance.');
  const buildReport = await download(page, 'Download bug report', 'native-build-report.json');
  await verifyBugReport(proof, buildReport); currentSession(buildReport.session);
  assert.deepEqual(buildReport.session.game, continuation.game);
  await record('native-report-binds-recovery-to-frozen-product-build', {buildId: buildReport.versions.buildId, simulationRevision: schema.simulationRevision, tick: continued.tick});
  report.result = 'passed';
  report.limits = [
    'One natural timed generation plus real reload/pagehide. Historical native evidence and repository tests cover three rotating generations.',
    'Recovery is manual through Saves on one retained browser origin; abrupt process termination, visibility-hidden, online/campaign saves and quota exhaustion are outside original-feature acceptance here.',
    'Complete game envelopes are compared; offline current decoder, resave and replay validation of the fingerprinted native downloads remains a separate required run.',
  ];
} catch (error) {
  failure = error; report.result = 'failed'; report.failure = {phase, message: error.message, stack: error.stack};
  if (page && !page.isClosed()) { try { await screenshot(page, 'first-failure.png'); } catch {} }
} finally {
  const cleanupErrors = [];
  for (const owned of [freshContext, context, browser]) if (owned) {
    try { await owned.close(); } catch (error) { cleanupErrors.push(error.message); }
  }
  report.browserClosed = browser ? !browser.isConnected() : true;
  try {
    for (const filename of Object.keys(report.downloads)) readAuthenticatedDownload(out, filename, report.downloads);
    assert.deepEqual(await proofSources(), sourceBefore, 'Proof sources remain frozen throughout execution');
    assert.deepEqual(cleanupErrors, []); assert(report.browserClosed);
  } catch (error) {
    failure ??= error; report.result = 'failed'; report.finalCheckFailure = {message: error.message, stack: error.stack};
  }
  report.finishedAt = new Date().toISOString();
  await finishProof(proof, report);
}
if (failure) throw failure;
