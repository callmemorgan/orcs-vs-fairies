import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// External preparation only. The supervisor must admit and seal these exact bytes.
// Browser evaluation observes state and coordinates; all application writes use native UI.
const [, , baseArg, rootArg, outArg, fixturesArg, freezeArg, mainEvidenceArg] = process.argv;
assert(baseArg && rootArg && outArg && fixturesArg && freezeArg && mainEvidenceArg,
  'Use BASE ROOT NEW_FALLBACK_EVIDENCE FROZEN_FIXTURES FREEZE COMPLETED_MAIN_EVIDENCE');
const root = resolve(rootArg), out = resolve(outArg), fixtures = resolve(fixturesArg);
const freezePath = resolve(freezeArg), mainEvidence = resolve(mainEvidenceArg);
const entry = fileURLToPath(import.meta.url), base = new URL(baseArg);
assert.equal(base.protocol, 'http:');
assert.equal(base.hostname, '127.0.0.1'); assert.notEqual(base.port, '4173');
assert.equal(base.pathname, '/index.html'); assert.equal(base.search, ''); assert.equal(base.hash, '');
base.searchParams.set('art', 'placeholder');
assert(out !== fixtures && !out.startsWith(`${fixtures}${sep}`));
assert(out !== mainEvidence && !out.startsWith(`${mainEvidence}${sep}`));
const sourcePaths = ['native-contract.mjs', 'native-context.mjs', 'main-smoke-freeze.mjs'];
const { assertAssetBytes, assertSessionIdentity, comparePersisted, digest, fingerprints,
  freshArtifact, htmlAssets, regularFiles, safePath } = await import(pathToFileURL(resolve(root, 'scripts/acceptance/native-contract.mjs')).href);
const { createNativeContext } = await import(pathToFileURL(resolve(root, 'scripts/acceptance/native-context.mjs')).href);
const { assertAcceptanceFreeze } = await import(pathToFileURL(resolve(root, 'scripts/acceptance/main-smoke-freeze.mjs')).href);
const driverBytes = await readFile(entry);
assert.match(process.env.OVF_PLACEHOLDER_DRIVER_SHA256 ?? '', /^[0-9a-f]{64}$/);
assert.equal(digest(driverBytes), process.env.OVF_PLACEHOLDER_DRIVER_SHA256, 'External driver equals admitted exact source');
const freezeBytes = await readFile(freezePath), frozen = JSON.parse(freezeBytes.toString());
await assertAcceptanceFreeze(root, fixtures, frozen);
const identity = { saveVersion: frozen.source.saveVersion, simulationRevision: frozen.source.simulationRevision };
assert.equal(identity.saveVersion, 4); assert.equal(identity.simulationRevision, '4.0.2');
const mainReceiptBytes = await readFile(resolve(mainEvidence, 'browser-main-smoke402.json'));
const mainReceipt = JSON.parse(mainReceiptBytes.toString());
assert.equal(mainReceipt.completed, true); assert.equal(mainReceipt.cleanup?.completed, true);
assert.equal(mainReceipt.source.commit, frozen.source.commit);
assert.equal(mainReceipt.source.expectedBuildId, frozen.source.expectedBuildId);
assert.deepEqual(mainReceipt.selectedGroups, ['canonical', 'ruins']);
assert.equal(mainReceipt.groups.canonical.completed, true); assert.equal(mainReceipt.groups.canonical.caseNames.length, 9);
assert.equal(Object.keys(mainReceipt.groups.ruins.results).length, 5); assert(mainReceipt.groups.ruins.capture);
const historyBytes = await readFile(resolve(mainEvidence, 'main-smoke402-history-checks.json'));
const historyReceipt = JSON.parse(historyBytes.toString());
assert.equal(historyReceipt.sourceCommit, frozen.source.commit);
assert.equal(historyReceipt.completeOriginalSaveAndRuntimeVerification, true);
assert.equal(historyReceipt.completedReceiptSha256, digest(mainReceiptBytes));
const manifest = JSON.parse(await readFile(resolve(fixtures, 'manifest.json'), 'utf8'));
assert.equal(manifest.sourceCommit, frozen.source.commit); assert.equal(Object.keys(manifest.scenarios).length, 15);
const fixture = manifest.scenarios['ruin-capture']; assert(fixture);
const fixturePath = safePath(fixtures, fixture.file), fixtureBytes = await readFile(fixturePath);
assert.equal(digest(fixtureBytes), fixture.sha256);
const initialSession = JSON.parse(fixtureBytes.toString());
assertSessionIdentity(initialSession, 'frozen placeholder capture fixture', identity, true);
assert.equal(initialSession.game.state.tick, 0); assert.equal(initialSession.game.state.time, 0);
assert.deepEqual(initialSession.replay.actions, []); assert.equal(initialSession.replay.finalTick, 0);
const importedSources = await fingerprints(root, sourcePaths.map(path => `scripts/acceptance/${path}`));
for (const file of importedSources) assert.deepEqual(file, frozen.source.files.find(row => row.path === file.path));
const distHtml = await readFile(resolve(root, 'dist/index.html'));
const declaredAssets = htmlAssets(distHtml.toString(), base.href);
await freshArtifact(out); await mkdir(out, { recursive: true });
const evidence = { schema: 1, completed: false, phase: 'launch separate placeholder browser',
  startedAt: new Date().toISOString(), base: base.href, artMode: 'placeholder', scenarioCount: 1,
  source: { ...frozen.source, sealedContractSha256: digest(freezeBytes),
    driver: { path: entry, bytes: driverBytes.length, sha256: digest(driverBytes) }, importedSources,
    distHtmlSha256: digest(distHtml) },
  priorCompletion: { mainReceiptSha256: digest(mainReceiptBytes), historyReceiptSha256: digest(historyBytes) },
  fixture: { name: 'ruin-capture', file: fixture.file, sha256: digest(fixtureBytes), ids: fixture.ids, authored: fixture.authored },
  checks: [], downloads: {}, servedAssets: [], assetFailures: [], errors: [],
  scope: 'One separate placeholder capture visual check; root visual review and feature admission remain separate.' };
const receiptPath = resolve(out, 'fallback-single-capture.json');
const writeReceipt = () => writeFile(receiptPath, `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(receiptPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
let browser, context, page, ctx, primaryError;
const actor = (state, id) => { const found = state.entities.find(entity => entity.id === id); assert(found); return found; };
const site = (state, id) => { const found = state.world.sites.find(item => item.id === id); assert(found); return found; };
try {
  const playwrightModule = process.env.OVF_PLAYWRIGHT_MODULE; assert(playwrightModule);
  const { chromium } = await import(playwrightModule);
  assert(process.env.OVF_CHROMIUM_EXECUTABLE);
  browser = await chromium.launch({ headless: true, executablePath: process.env.OVF_CHROMIUM_EXECUTABLE,
    args: ['--disable-dev-shm-usage'] });
  evidence.browser = { playwrightModule, browserVersion: browser.version(), executablePath: process.env.OVF_CHROMIUM_EXECUTABLE };
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1,
    acceptDownloads: true, serviceWorkers: 'block' });
  page = await context.newPage(); page.on('pageerror', error => evidence.errors.push(error.message));
  const origin = base.origin, pinnedAssets = new Map(frozen.dist.map(file => [file.path, file]));
  const capturedAssets = new Set(), assetPromises = [];
  const executableResponse = response => {
    const type = response.request().resourceType(), url = new URL(response.url());
    const mime = (response.headers()['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    return ['script', 'stylesheet'].includes(type) || /\.(js|css)$/.test(url.pathname) ||
      ['application/javascript', 'text/javascript', 'application/ecmascript', 'text/ecmascript', 'text/css'].includes(mime);
  };
  context.on('response', response => {
    if (!executableResponse(response)) return;
    assetPromises.push((async () => {
      const url = new URL(response.url()), path = decodeURIComponent(url.pathname).replace(/^\//, '');
      assert.equal(url.origin, origin); assert(response.ok());
      const bytes = await response.body(); assertAssetBytes(bytes, pinnedAssets.get(path), url.href);
      assert.deepEqual(bytes, await readFile(safePath(resolve(root, 'dist'), path)));
      capturedAssets.add(url.href); evidence.servedAssets.push({ url: url.href, path,
        resourceType: response.request().resourceType(), mime: response.headers()['content-type'],
        bytes: bytes.length, sha256: digest(bytes) });
    })().catch(error => evidence.assetFailures.push(String(error.stack ?? error))));
  });
  context.on('requestfailed', request => {
    if (['script', 'stylesheet'].includes(request.resourceType()) || /\.(js|css)$/.test(new URL(request.url()).pathname))
      evidence.assetFailures.push(`${request.url()}: ${request.failure()?.errorText ?? 'asset request failed'}`);
  });
  const verifyAssets = async () => {
    await page.waitForLoadState('networkidle', { timeout: 15000 }); let settled = 0;
    while (settled < assetPromises.length) {
      const count = assetPromises.length; await Promise.all(assetPromises.slice(settled, count)); settled = count;
    }
    assert.deepEqual(evidence.assetFailures, []);
    for (const url of declaredAssets) assert(capturedAssets.has(url), `Observed frozen HTML executable asset ${url}`);
  };
  ctx = createNativeContext({ page, out, fixtures, manifest, identity, evidence });
  // Do not call ctx.ready/importSave/persistence/exportAndVerify: their readiness requires loaded art.
  const fallbackReady = () => ctx.wait(() => document.querySelector('.loading-battle')?.hidden &&
    !!window.rts?.camera && !!document.querySelector('#game-canvas canvas') && window.rts.mode === 'local' &&
    window.rts.art.enabled === false && window.rts.art.loaded === false, null, 20000);
  const readyFacts = () => page.evaluate(() => ({ loadingHidden: document.querySelector('.loading-battle')?.hidden,
    mode: window.rts.mode, artEnabled: window.rts.art.enabled, artLoaded: window.rts.art.loaded,
    camera: { ...window.rts.camera }, viewLevel: window.rts.viewLevel, viewSide: window.rts.viewSide,
    devicePixelRatio: window.devicePixelRatio, canvas: (() => { const canvas = document.querySelector('#game-canvas canvas');
      const box = canvas.getBoundingClientRect(); return { width: canvas.width, height: canvas.height,
        left: box.left, top: box.top, cssWidth: box.width, cssHeight: box.height }; })() }));
  evidence.phase = 'open frozen production with explicit placeholder query'; await writeReceipt();
  const response = await page.goto(base.href); assert(response?.ok());
  const servedHtml = await response.body(); assert.deepEqual(servedHtml, distHtml);
  evidence.source.servedHtmlSha256 = digest(servedHtml);
  await page.locator('.begin-match').click(); await fallbackReady(); await verifyAssets();
  evidence.initialReadiness = await readyFacts(); assert.equal(evidence.initialReadiness.devicePixelRatio, 1);
  assert.equal(evidence.initialReadiness.camera.width, evidence.initialReadiness.canvas.cssWidth);
  assert.equal(evidence.initialReadiness.camera.height, evidence.initialReadiness.canvas.cssHeight);
  evidence.phase = 'native Session tools import of frozen capture fixture'; await writeReceipt();
  await ctx.openSessions('saves');
  await ctx.sessions.getByLabel('Import save JSON', { exact: true }).setInputFiles(fixturePath);
  await ctx.sessions.getByRole('button', { name: 'Import save', exact: true }).click();
  await ctx.wait(() => document.querySelector('[aria-label="Import save JSON"]')?.files?.length === 0 &&
    [...document.querySelectorAll('.session-notice')].some(element => !element.hidden && element.textContent === 'Save loaded.'), null, 20000);
  await fallbackReady(); evidence.importReadiness = await readyFacts();
  const beforeSave = await ctx.exportSave('fallback-before');
  comparePersisted(beforeSave.game, initialSession.game, 'placeholder normal import');
  const before = await ctx.snap(), ids = fixture.ids;
  assert.equal(before.tick, 0); assert.equal(site(before, ids.site).owner, null); assert.equal(site(before, ids.site).progress, 0);
  assert.equal(actor(before, ids.worker).side, 0); assert.equal(actor(before, ids.worker).role, 'worker');
  await ctx.closeSessions(); await ctx.selectTroop(ids.worker); await ctx.pause(); await fallbackReady();
  const selected = await ctx.snap(); assert.deepEqual(selected.selected, [ids.worker]);
  assert.equal(selected.viewLevel, ids.sitePoint.level); assert.equal(selected.viewSide, 0);
  const fogKey = ids.sitePoint.level * selected.width * selected.height + Math.floor(ids.sitePoint.y) * selected.width + Math.floor(ids.sitePoint.x);
  assert(selected.visible[0].includes(fogKey), 'Declared capture site is currently visible');
  const screen = await ctx.point(ids.sitePoint.x, ids.sitePoint.y, ids.sitePoint.level);
  assert(screen.x > screen.canvas.left + 30 && screen.x < screen.canvas.left + screen.canvas.width - 30);
  assert(screen.y > screen.canvas.top + 120 * screen.zoom * screen.scaleY &&
    screen.y < screen.canvas.top + screen.canvas.height - 35 * screen.zoom * screen.scaleY, 'Pillar, glyph and progress bar fit on battlefield');
  evidence.visualLocation = { site: ids.sitePoint, screen, fogKey, viewLevel: selected.viewLevel, viewSide: selected.viewSide };
  const closeWorld = async () => { const world = page.locator('.world-tools');
    if (await world.getAttribute('open') !== null) await world.locator(':scope > summary').click(); };
  await closeWorld(); await ctx.screenshot('fallback-neutral-pillar-glyph');
  evidence.phase = 'normal World tools capture button'; await writeReceipt();
  await ctx.resume(); const world = await ctx.openWorld();
  await world.getByRole('button', { name: 'Capture relic', exact: true }).click();
  await ctx.wait(({ worker, target }) => { const order = window.rts.state.entities.find(entity => entity.id === worker)?.order;
    return order?.type === 'captureSite' && order.target === target; }, { worker: ids.worker, target: ids.site }, 10000);
  await closeWorld();
  const progressing = await ctx.runUntil(state => site(state, ids.site).progress >= .3 && site(state, ids.site).progress < .8,
    { timeout: 15000, label: 'single placeholder native capture progress' });
  assert.equal(site(progressing, ids.site).owner, null); assert.equal(site(progressing, ids.site).capturing, 0);
  await fallbackReady(); await ctx.screenshot('fallback-capture-progress-pillar-glyph-bar');
  const progressSave = await ctx.exportSave('fallback-progress');
  assert.deepEqual(site(progressSave.game.state, ids.site), site(progressing, ids.site));
  const captureCommands = progressSave.replay.actions.filter(action => action.type === 'command');
  assert.equal(captureCommands.length, 1);
  const captureCommand = captureCommands[0]; assert.equal(captureCommand.side, 0);
  assert.equal(captureCommand.command.type, 'captureSite'); assert.deepEqual(captureCommand.command.ids, [ids.worker]);
  assert.equal(captureCommand.command.target, ids.site);
  evidence.capture = { command: captureCommand, before: site(before, ids.site), progress: site(progressing, ids.site),
    progressTick: progressing.tick, nativeProgressTick: progressSave.game.state.tick };
  ctx.record('Single placeholder capture starts through native World tools and exports intermediate progress', evidence.capture);
  await ctx.closeSessions();
  evidence.phase = 'same native capture completes'; await writeReceipt();
  const captured = await ctx.runUntil(state => site(state, ids.site).owner === 0,
    { timeout: 20000, label: 'single placeholder same relic capture completion' });
  const finalSite = site(captured, ids.site), initialSite = site(before, ids.site);
  for (const key of ['id', 'kind', 'x', 'y', 'level']) assert.equal(finalSite[key], initialSite[key]);
  assert.equal(finalSite.progress, 0); assert.equal(finalSite.capturing, null);
  await fallbackReady(); await ctx.screenshot('fallback-captured-pillar-ownership-marker');
  const capturedSave = await ctx.exportSave('fallback-captured');
  assert.deepEqual(site(capturedSave.game.state, ids.site), finalSite);
  assert.deepEqual(capturedSave.replay.actions.filter(action => action.type === 'command'), captureCommands);
  evidence.capture.final = finalSite; evidence.capture.finalTick = captured.tick;
  evidence.phase = 'native frozen build identity and retained inputs'; await writeReceipt();
  await ctx.openSessions('report');
  await ctx.sessions.getByLabel('Bug description', { exact: true }).fill('Separate native placeholder capture visual check.');
  await ctx.sessions.getByRole('button', { name: 'Preview report', exact: true }).click();
  await ctx.wait(() => !!document.querySelector('[aria-label="Report JSON preview"]')?.value, null, 10000);
  const report = await ctx.download('Download bug report', 'fallback-production-build-report.json');
  assert.equal(report.versions.buildId, frozen.source.expectedBuildId);
  assert.equal(report.versions.save, identity.saveVersion); assert.equal(report.versions.replaySimulation, identity.saveVersion);
  assert.equal(report.versions.replay, 1); assert.equal(report.versions.simulationRevision, identity.simulationRevision);
  assertSessionIdentity(report.session, 'placeholder native build report', identity, true);
  comparePersisted(report.session.game, capturedSave.game, 'placeholder native build report');
  evidence.buildReport = { buildId: report.versions.buildId, tick: report.session.game.state.tick };
  await verifyAssets(); await assertAcceptanceFreeze(root, fixtures, frozen);
  assert.deepEqual(await readFile(freezePath), freezeBytes); assert.deepEqual(await readFile(entry), driverBytes);
  assert.deepEqual(await readFile(resolve(mainEvidence, 'browser-main-smoke402.json')), mainReceiptBytes);
  assert.deepEqual(await readFile(resolve(mainEvidence, 'main-smoke402-history-checks.json')), historyBytes);
  for (const [name, fingerprint] of Object.entries(evidence.downloads))
    assertAssetBytes(await readFile(safePath(out, name)), fingerprint, `Retained placeholder native download ${name}`);
  assert.deepEqual(evidence.errors, []); evidence.finalReadiness = await readyFacts();
  assert.equal(evidence.finalReadiness.artEnabled, false); assert.equal(evidence.finalReadiness.artLoaded, false);
  evidence.completed = true; evidence.completedAt = new Date().toISOString(); evidence.visualReviewRequired = true;
  evidence.artifacts = await fingerprints(out, (await regularFiles(out)).filter(path => path !== 'fallback-single-capture.json'));
  await writeReceipt(); console.log('Single placeholder native capture data passed; retained pillar/glyph/bar/ownership screenshots need separate visual review.');
} catch (error) {
  primaryError = error; evidence.failure = { phase: evidence.phase, message: String(error.stack ?? error) };
  if (ctx) try { evidence.lastState = await ctx.snap(); await ctx.screenshot('fallback-first-failure'); }
  catch (captureError) { evidence.failure.captureError = String(captureError.stack ?? captureError); }
  await writeReceipt();
} finally {
  const cleanupErrors = [];
  try { if (context) await context.close(); }
  catch (error) { cleanupErrors.push({ phase: 'context close', message: String(error.stack ?? error) }); }
  finally { try { if (browser) await browser.close(); }
    catch (error) { cleanupErrors.push({ phase: 'browser close', message: String(error.stack ?? error) }); } }
  evidence.cleanup = { completed: cleanupErrors.length === 0, errors: cleanupErrors };
  if (cleanupErrors.length) { evidence.dataCompleted = evidence.completed; evidence.completed = false; }
  await writeReceipt();
  if (!primaryError && cleanupErrors.length) primaryError = new Error('Separate placeholder browser cleanup failed.');
}
if (primaryError) throw primaryError;
