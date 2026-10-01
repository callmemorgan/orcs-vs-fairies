import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {prepareProof, observePage, finishProof, verifyBugReport} from './browser-common.mjs';

const proofContext = await prepareProof({
  base: process.argv[2], sourcePin: process.argv[3], outputDir: process.argv[4], feature: 90,
});
const {base, sourcePin, out, schema, buildId, sha} = proofContext;
const storageKey = 'orcs-vs-fairies:sessions:v1';
const autosaveKey = 'orcs-vs-fairies:autosave:v1';
const saveName = 'Recovery90 named';
const report = {
  sourcePin, base, buildId, feature: 90, schema,
  method: 'Fresh primary production skirmishes; native DOM, mouse and keyboard actions. Page evaluation reads runtime, DOM and local storage only. Real wall-clock waits drive ordinary simulation; no fixtures, clock overrides, commands, runtime writes or source edits.',
  checks: [], screenshots: [], pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [],
  startedAt: new Date().toISOString(),
};
const persist = () => writeFile(join(out, 'browser-proof.json'), `${JSON.stringify(report, null, 2)}\n`);
const snapshot = page => page.evaluate(() => ({
  tick: window.rts.state.tick, time: window.rts.state.time, paused: window.rts.paused,
  winner: window.rts.state.winner, draw: window.rts.state.draw,
  entities: window.rts.state.entities.length, mode: window.rts.mode, readOnly: window.rts.readOnly,
}));
const readStore = page => page.evaluate(key => JSON.parse(
  localStorage.getItem(key) ?? '{"version":1,"slots":[]}',
), storageKey);
const readPreferences = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), autosaveKey);
const ready = page => page.waitForSelector('.loading-battle[hidden]', {state: 'attached', timeout: 60000});
const openSaves = page => page.locator('[data-session-tool="saves"]').click();
const closeTools = page => page.getByRole('button', {name: 'Close session tools', exact: true}).click();
const notice = page => page.locator('.session-tools .session-notice');

async function record(id, details = {}) {
  const entry = {id, ...details};
  report.checks.push(entry);
  await persist();
  console.log(JSON.stringify(entry));
}

async function screenshot(page, filename) {
  const path = join(out, filename);
  await page.screenshot({path});
  report.screenshots.push({file: filename, sha256: sha(await readFile(path))});
}

async function download(page, button, filename) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: button, exact: true}).click();
  await (await pending).saveAs(join(out, filename));
  return JSON.parse(await readFile(join(out, filename), 'utf8'));
}

function currentSession(file) {
  assert.equal(file.format, 'orcs-vs-fairies/session');
  assert.equal(file.version, schema.sessionVersion);
  assert.equal(file.game.version, schema.saveVersion);
  assert(file.replay, 'Native skirmish exports must include their replay');
  assert.equal(file.replay.version, schema.replayVersion);
  assert.equal(file.replay.initial.version, schema.saveVersion);
  assert.equal(file.replay.checksumVersion, schema.replayChecksumVersion);
  assert.equal(file.replay.simulationRevision, schema.simulationRevision);
  assert.equal(file.replay.finalTick, file.game.state.tick);
}

async function waitForLoadedTick(page, tick) {
  await ready(page);
  await page.waitForFunction(expected => {
    try { return window.rts?.state.tick === expected && window.rts.paused; }
    catch { return false; }
  }, tick, {timeout: 60000});
}

async function applyAutosave(page, enabled) {
  const control = page.getByLabel('Enable autosaves', {exact: true});
  if (enabled) await control.check();
  else await control.uncheck();
  await page.getByLabel('Autosave frequency', {exact: true}).selectOption('30');
  await page.getByRole('button', {name: 'Apply autosave settings', exact: true}).click();
  await notice(page).filter({hasText: 'Autosave settings saved'}).waitFor({state: 'visible'});
  assert.deepEqual(await readPreferences(page), {enabled, intervalSeconds: 30});
}

let browser;
let browserContext;
let freshContext;
let page;
let failure;
try {
  const {chromium} = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
  browser = await chromium.launch({headless: true, args: ['--disable-dev-shm-usage']});
  browserContext = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
  page = await browserContext.newPage();
  observePage(page, report, proofContext);
  await page.goto(base);
  await page.locator('#map-size').selectOption('medium');
  await page.locator('.begin-match').click();
  await ready(page);
  await page.waitForFunction(() => window.rts?.state.tick > 5);
  await openSaves(page);
  const named = await snapshot(page);
  assert(named.paused);
  assert.equal(named.mode, 'local');
  assert.equal(named.readOnly, false);
  const emptyStore = await readStore(page);
  assert.equal(emptyStore.version, 1);
  assert.deepEqual(emptyStore.slots, [], 'The new context must begin with empty native save storage');
  assert(await page.getByLabel('Enable autosaves', {exact: true}).isChecked());
  assert.equal(await page.getByLabel('Autosave frequency', {exact: true}).inputValue(), '60');
  await page.getByLabel('Save name', {exact: true}).fill(saveName);
  await page.getByRole('button', {name: 'Save match', exact: true}).click();
  await page.getByRole('button', {name: `Load ${saveName}`, exact: true}).waitFor();
  const manual = await download(page, 'Export save', 'native-manual.json');
  currentSession(manual);
  assert.equal(manual.game.state.tick, named.tick);
  const initialStore = await readStore(page);
  assert.equal(initialStore.version, 1);
  assert.equal(initialStore.slots.length, 1);
  const manualSlot = initialStore.slots[0];
  assert.equal(manualSlot.autosave, false);
  assert.deepEqual(manualSlot.file, manual);
  await screenshot(page, 'named-save.png');
  await record('named-save-and-native-export', {
    snapshot: named, slot: manualSlot.id, sessionVersion: manual.version,
    gameSaveVersion: manual.game.version, replayFinalTick: manual.replay.finalTick,
    gameHash: sha(JSON.stringify(manual.game)),
  });

  await closeTools(page);
  await page.waitForFunction(tick => window.rts.state.tick > tick + 10, named.tick);
  const advanced = await snapshot(page);
  await openSaves(page);
  await page.getByRole('button', {name: `Load ${saveName}`, exact: true}).click();
  await waitForLoadedTick(page, named.tick);
  const loaded = await download(page, 'Export save', 'native-loaded.json');
  currentSession(loaded);
  assert.deepEqual(loaded.game, manual.game);
  await screenshot(page, 'named-load.png');
  await record('named-load-restores-complete-game-envelope', {
    advancedTick: advanced.tick, restoredTick: loaded.game.state.tick,
    gameHash: sha(JSON.stringify(loaded.game)),
  });

  await page.getByLabel('Import save JSON', {exact: true}).setInputFiles({
    name: 'unsupported-session.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({...manual, version: 999})),
  });
  await page.getByRole('button', {name: 'Import save', exact: true}).click();
  await notice(page).filter({hasText: 'Unsupported session'}).waitFor({state: 'visible'});
  const afterInvalid = await download(page, 'Export save', 'native-after-rejected-import.json');
  currentSession(afterInvalid);
  assert.deepEqual(afterInvalid.game, manual.game);
  assert.deepEqual(await readStore(page), initialStore);
  await record('invalid-session-version-preserves-current-game', {
    rejectedSessionVersion: 999, restoredTick: afterInvalid.game.state.tick,
    gameHash: sha(JSON.stringify(afterInvalid.game)), localSlotsUnchanged: true,
  });

  await applyAutosave(page, true);
  const autosaveStart = await snapshot(page);
  const autosaveWallStart = performance.now();
  await closeTools(page);
  let previousTick = -1;
  const generations = [];
  for (let generation = 1; generation <= 3; generation++) {
    await page.waitForFunction(({key, previousTick}) => {
      const slots = JSON.parse(localStorage.getItem(key) ?? '{"slots":[]}').slots;
      return slots.some(slot => slot.id === 'autosave' && slot.file.game.state.tick > previousTick);
    }, {key: storageKey, previousTick}, {timeout: 90000, polling: 500});
    await openSaves(page);
    const current = await readStore(page);
    const latest = current.slots.find(slot => slot.id === 'autosave');
    assert.equal(current.version, 1);
    assert(latest?.autosave);
    currentSession(latest.file);
    assert(latest.file.game.state.tick > previousTick);
    assert.deepEqual(current.slots.find(slot => slot.id === manualSlot.id), manualSlot);
    const expectedTime = autosaveStart.time + 30 * generation;
    assert(latest.time >= expectedTime - 1e-8 && latest.time <= expectedTime + .2,
      `Timed generation ${generation} must occur at the native simulated interval`);
    const wallElapsedSeconds = (performance.now() - autosaveWallStart) / 1000;
    assert(wallElapsedSeconds >= 30 * generation - .2,
      'Ordinary autosave generations must require the corresponding natural wall-clock interval');
    generations.push({
      generation, tick: latest.file.game.state.tick, time: latest.time, expectedTime,
      wallElapsedSeconds, ids: current.slots.filter(slot => slot.autosave).map(slot => slot.id),
      gameHash: sha(JSON.stringify(latest.file.game)),
    });
    previousTick = latest.file.game.state.tick;
    await writeFile(join(out, `native-store-generation-${generation}.json`), `${JSON.stringify(current, null, 2)}\n`);
    await screenshot(page, `autosave-generation-${generation}.png`);
    await record(`automatic-native-generation-${generation}`, generations.at(-1));
    if (generation < 3) await closeTools(page);
  }
  const rotated = await readStore(page);
  assert.deepEqual(rotated.slots.filter(slot => slot.autosave).map(slot => slot.id).sort(),
    ['autosave', 'autosave-1', 'autosave-2']);
  assert.equal(rotated.slots.find(slot => slot.id === 'autosave-1').file.game.state.tick, generations[1].tick);
  assert.equal(rotated.slots.find(slot => slot.id === 'autosave-2').file.game.state.tick, generations[0].tick);
  assert.deepEqual(rotated.slots.find(slot => slot.id === manualSlot.id), manualSlot);
  await record('three-autosaves-rotate-with-manual-save-preserved', {generations, manualSlot: manualSlot.id});

  await closeTools(page);
  await page.waitForFunction(tick => window.rts.state.tick > tick + 10, previousTick);
  await openSaves(page);
  const beforeReload = await snapshot(page);
  assert(beforeReload.paused);
  const beforePagehide = await download(page, 'Export save', 'native-before-pagehide.json');
  currentSession(beforePagehide);
  assert.equal(beforePagehide.game.state.tick, beforeReload.tick);
  await page.reload();
  await page.locator('[data-session-tool="saves"]').waitFor();
  const afterReloadStore = await readStore(page);
  const forced = afterReloadStore.slots.find(slot => slot.id === 'autosave');
  assert(forced);
  currentSession(forced.file);
  assert.equal(forced.file.game.state.tick, beforeReload.tick);
  assert(forced.file.game.state.tick > previousTick);
  assert.deepEqual(forced.file.game, beforePagehide.game);
  assert.deepEqual(afterReloadStore.slots.find(slot => slot.id === manualSlot.id), manualSlot);
  await writeFile(join(out, 'native-pagehide-autosave.json'), `${JSON.stringify(forced.file, null, 2)}\n`);
  await record('native-pagehide-forces-checkpoint-on-reload', {
    beforeReload, checkpointTick: forced.file.game.state.tick,
    gameHash: sha(JSON.stringify(forced.file.game)), completePreReloadEnvelopePreserved: true,
  });
  await openSaves(page);
  await page.getByRole('button', {name: 'Load Autosave', exact: true}).click();
  await waitForLoadedTick(page, beforeReload.tick);
  const recovered = await download(page, 'Export save', 'native-recovered-autosave.json');
  currentSession(recovered);
  assert.deepEqual(recovered.game, forced.file.game);
  await screenshot(page, 'autosave-recovered.png');
  await record('reload-and-ui-load-recover-complete-autosave-envelope', {
    tick: recovered.game.state.tick, gameHash: sha(JSON.stringify(recovered.game)),
  });

  await applyAutosave(page, false);
  const disabledStore = await readStore(page);
  const disabledStart = await snapshot(page);
  const disabledWallStart = performance.now();
  await closeTools(page);

  freshContext = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
  const fresh = await freshContext.newPage();
  observePage(fresh, report, proofContext);
  await fresh.goto(base);
  await openSaves(fresh);
  const freshStore = await readStore(fresh);
  assert.equal(freshStore.version, 1);
  assert.deepEqual(freshStore.slots, []);
  await fresh.getByLabel('Import save JSON', {exact: true}).setInputFiles(join(out, 'native-manual.json'));
  await fresh.getByRole('button', {name: 'Import save', exact: true}).click();
  await waitForLoadedTick(fresh, named.tick);
  const imported = await download(fresh, 'Export save', 'native-imported-fresh-browser.json');
  currentSession(imported);
  assert.deepEqual(imported.game, manual.game);
  assert.deepEqual(await readStore(fresh), freshStore,
    'Import restores the match without fabricating a named local slot');
  await screenshot(fresh, 'fresh-native-import.png');
  await record('fresh-browser-native-import-restores-complete-envelope', {
    tick: imported.game.state.tick, gameHash: sha(JSON.stringify(imported.game)), localSlots: 0,
  });
  await freshContext.close();
  freshContext = undefined;

  const remainingWallMs = Math.max(0, 31000 - (performance.now() - disabledWallStart));
  if (remainingWallMs) await page.waitForTimeout(remainingWallMs);
  await page.waitForFunction(time => window.rts.state.time >= time + 31, disabledStart.time,
    {timeout: 90000, polling: 500});
  await openSaves(page);
  const disabledEnd = await snapshot(page);
  const disabledWallSeconds = (performance.now() - disabledWallStart) / 1000;
  assert.equal(disabledEnd.winner, null);
  assert.equal(disabledEnd.draw, false);
  assert(disabledWallSeconds >= 31);
  assert.deepEqual(await readStore(page), disabledStore);
  assert.deepEqual(await readPreferences(page), {enabled: false, intervalSeconds: 30});
  await record('disabled-autosave-allows-natural-simulation-without-new-checkpoint', {
    start: disabledStart, end: disabledEnd, wallElapsedSeconds: disabledWallSeconds,
    simulationSeconds: disabledEnd.time - disabledStart.time,
  });
  await page.reload();
  await openSaves(page);
  assert.equal(await page.getByLabel('Enable autosaves', {exact: true}).isChecked(), false);
  assert.equal(await page.getByLabel('Autosave frequency', {exact: true}).inputValue(), '30');
  assert.deepEqual(await readPreferences(page), {enabled: false, intervalSeconds: 30});
  assert.deepEqual(await readStore(page), disabledStore);
  await screenshot(page, 'disabled-settings-persist.png');
  await record('disabled-preference-persists-and-prevents-pagehide-save', {intervalSeconds: 30, enabled: false});

  await page.getByRole('button', {name: `Load ${saveName}`, exact: true}).click();
  await waitForLoadedTick(page, named.tick);
  await page.locator('[data-session-tab="report"]').click();
  await page.getByLabel('Bug description', {exact: true}).fill('Feature 90 production save and recovery proof.');
  const buildReport = await download(page, 'Download bug report', 'native-build-report.json');
  await verifyBugReport(proofContext, buildReport);
  assert.deepEqual(buildReport.session.game, manual.game);
  await record('native-production-build-identity', {
    buildId: buildReport.versions.buildId, saveVersion: buildReport.versions.save,
    simulationRevision: buildReport.versions.simulationRevision,
  });
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.failedRequests, []);
  assert.deepEqual(report.httpErrors, []);
  report.result = 'passed';
  report.limits = [
    'Fresh local skirmishes on one production browser origin; online, historical-save, campaign, quota exhaustion and the 12-slot limit are not exercised.',
    'Reload exercises pagehide. Visibility-hidden checkpointing is not separately triggered.',
    'Recovery is manual through Saves and requires the browser data and origin to persist.',
    'Complete envelopes are compared in the browser proof. Native decoder, resave and ReplayPlayer validation run separately against the frozen source.',
  ];
} catch (error) {
  failure = error;
  report.result = 'failed';
  report.failure = {message: error.message, stack: error.stack};
  if (page && !page.isClosed()) {
    try { await screenshot(page, 'failure.png'); } catch {}
  }
} finally {
  const closeErrors = [];
  for (const owned of [freshContext, browserContext, browser]) {
    if (!owned) continue;
    try { await owned.close(); }
    catch (error) { closeErrors.push(error.message); }
  }
  report.browserClosed = browser ? !browser.isConnected() : true;
  report.finishedAt = new Date().toISOString();
  if (closeErrors.length) {
    report.result = 'failed';
    report.closeErrors = closeErrors;
    failure ??= new Error(`Browser cleanup failed: ${closeErrors.join('; ')}`);
  }
  await finishProof(proofContext, report);
}
if (failure) throw failure;
