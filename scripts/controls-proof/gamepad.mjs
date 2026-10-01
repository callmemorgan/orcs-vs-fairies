import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {prepareProof, observePage, verifyBugReport, finishProof} from './browser-common.mjs';

const context = await prepareProof({
  base: process.argv[2], sourcePin: process.argv[3], outputDir: process.argv[4], feature: 89,
});
const report = {
  feature: 89, sourcePin: context.sourcePin, base: context.base,
  schema: context.schema, buildId: context.buildId,
  startedAt: new Date().toISOString(), result: 'running',
  method: 'Fresh production skirmish. Only navigator.getGamepads and its virtual standard-controller sample are replaced. All game commands use the ordinary GameScene controller path; runtime observations are read-only.',
  checks: [], inputs: [], screenshots: [], nativeDownloads: [],
  pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [],
};
let browser, browserContext, page, failure;
const serializeError = error => ({message: String(error?.message ?? error), stack: error?.stack});

async function snapshot() {
  return page.evaluate(() => {
    const runtime = window.rts;
    if (!runtime) return null;
    const state = runtime.state, side = runtime.viewSide;
    return {
      tick: state.tick, time: state.time, paused: runtime.paused,
      mode: runtime.mode, readOnly: runtime.readOnly, simulationEnabled: runtime.simulationEnabled,
      selected: [...runtime.selected], camera: {...runtime.camera}, viewLevel: runtime.viewLevel, side,
      seed: state.seed, mapSize: state.mapSize, winner: state.winner, draw: state.draw,
      players: state.players.map(player => ({faction: player.faction})),
      entities: state.entities.filter(entity => entity.side === side),
      controller: window.__certpad ? {
        index: window.__certpad.index, id: window.__certpad.id,
        connected: window.__certpad.connected, mapping: window.__certpad.mapping,
        timestamp: window.__certpad.timestamp, axes: [...window.__certpad.axes],
        pressed: window.__certpad.buttons.flatMap((button, index) => button.pressed ? [index] : []),
      } : null,
    };
  });
}

// These evaluations only change the virtual hardware sample at the browser API boundary.
async function input(buttons = [], axes = [0, 0, 0, 0]) {
  const sample = await page.evaluate(({buttons, axes}) => {
    const pad = window.__certpad;
    pad.timestamp++;
    pad.axes = [...axes];
    pad.buttons = Array.from({length: 17}, (_, index) => ({
      pressed: buttons.includes(index), touched: buttons.includes(index), value: buttons.includes(index) ? 1 : 0,
    }));
    return {timestamp: pad.timestamp, connected: pad.connected, buttons, axes};
  }, {buttons, axes});
  report.inputs.push({type: 'sample', at: new Date().toISOString(), ...sample});
}

async function release() {
  await input();
  await page.waitForTimeout(80);
}

async function press(buttons, holdMs = 100) {
  await input(buttons);
  await page.waitForTimeout(holdMs);
  await release();
}

async function action(name, run) {
  const check = {name, result: 'running', before: await snapshot()};
  report.checks.push(check);
  try {
    const details = await run();
    check.after = await snapshot();
    check.result = 'passed';
    if (details !== undefined) check.details = details;
    console.log(JSON.stringify({check: name, result: check.result}));
  } catch (error) {
    check.result = 'failed';
    check.failure = serializeError(error);
    check.after = await snapshot().catch(() => null);
    throw error;
  }
}

async function screenshot(filename) {
  const path = join(context.out, filename);
  await page.screenshot({path});
  report.screenshots.push({path: filename, sha256: context.sha(await readFile(path))});
}

async function downloadJson(button, filename) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: button, exact: true}).click();
  const download = await pending, path = join(context.out, filename);
  await download.saveAs(path);
  const bytes = await readFile(path), value = JSON.parse(bytes.toString());
  report.nativeDownloads.push({
    path: filename, downloadedName: download.suggestedFilename(), bytes: bytes.length,
    sha256: context.sha(bytes), format: value.format, version: value.version,
  });
  return value;
}

try {
  const {chromium} = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
  browser = await chromium.launch({headless: true, args: ['--disable-dev-shm-usage']});
  browserContext = await browser.newContext({
    viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1, acceptDownloads: true,
  });
  page = await browserContext.newPage();
  page.setDefaultTimeout(15000);
  observePage(page, report, context);
  await page.addInitScript(() => {
    window.__certpad = {
      index: 0, id: 'Production proof virtual standard controller', connected: true,
      mapping: 'standard', timestamp: 1, axes: [0, 0, 0, 0],
      buttons: Array.from({length: 17}, () => ({pressed: false, touched: false, value: 0})),
    };
    Object.defineProperty(navigator, 'getGamepads', {value: () => [window.__certpad], configurable: true});
  });

  await page.goto(context.base);
  await page.locator('.faction-card[data-faction="orcs"]').click();
  await page.locator('#opponent').selectOption('fairies');
  await page.locator('#map-size').selectOption('small');
  await page.locator('#map-seed').fill('4127');
  await page.locator('.begin-match').click();
  await page.waitForFunction(() => window.rts?.art?.loaded && window.rts.state.tick > 0 &&
    !document.querySelector('.loading-battle:not([hidden])'), null, {timeout: 60000});
  await release();
  report.initial = await snapshot();
  assert.equal(report.initial.mode, 'local');
  assert.equal(report.initial.readOnly, false);
  assert.equal(report.initial.simulationEnabled, true);
  assert.equal(report.initial.side, 0);
  assert.equal(report.initial.seed, 4127);
  assert.equal(report.initial.mapSize, 'small');
  assert.deepEqual(report.initial.players, [{faction: 'orcs'}, {faction: 'fairies'}]);

  await action('left stick pans the production camera', async () => {
    const before = await snapshot();
    await input([], [1, 0, 0, 0]);
    await page.waitForTimeout(200);
    await release();
    assert((await snapshot()).camera.x > before.camera.x);
  });

  await action('held right shoulder selects once until released', async () => {
    const owned = (await snapshot()).entities.filter(entity => entity.hp > 0).sort((a, b) => a.id - b.id);
    assert(owned.length);
    await input([5]);
    await page.waitForFunction(id => window.rts.selected.length === 1 && window.rts.selected[0] === id, owned[0].id);
    const once = (await snapshot()).selected;
    await page.waitForTimeout(200);
    assert.deepEqual((await snapshot()).selected, once);
    await release();
    return {firstOwned: owned[0].id, selectionHeld: once};
  });

  let worker;
  await action('released shoulder selects the next owned worker', async () => {
    const maximum = (await snapshot()).entities.filter(entity => entity.hp > 0).length;
    for (let attempt = 0; attempt < maximum; attempt++) {
      await press([5]);
      const chosen = await snapshot();
      const selected = chosen.entities.find(entity => entity.id === chosen.selected[0]);
      if (selected?.kind === 'unit' && selected.role === 'worker') {worker = selected.id; break;}
    }
    assert(worker !== undefined, 'Select a starting worker through controller shoulder presses');
    report.worker = worker;
    return {worker};
  });
  const ownedWorker = state => {
    const entity = state.entities.find(candidate => candidate.id === worker);
    assert(entity, 'The selected starting worker must still exist');
    return entity;
  };

  await action('D-pad hold reaches the normal simulation order', async () => {
    await press([13]);
    assert.equal(ownedWorker(await snapshot()).order.type, 'hold');
  });
  await action('D-pad stop reaches the normal simulation order', async () => {
    await press([14]);
    assert.equal(ownedWorker(await snapshot()).order.type, 'idle');
  });
  await action('right stick cursor and X issue a movement order', async () => {
    await input([], [0, 0, 1, 0]);
    await page.waitForTimeout(270);
    await release();
    await press([2], 60);
    const entity = ownedWorker(await snapshot());
    assert.equal(entity.order.type, 'move');
    assert(Math.hypot(entity.order.x - entity.x, entity.order.y - entity.y) > .45);
    return {order: entity.order};
  });
  await action('left stick click queues a second cursor movement order', async () => {
    await input([], [0, 0, 1, 0]);
    await page.waitForTimeout(160);
    await release();
    await press([10, 2], 60);
    const entity = ownedWorker(await snapshot());
    assert(entity.orderQueue?.some(order => order.type === 'move'));
    return {activeOrder: entity.order, queuedOrders: entity.orderQueue};
  });
  await action('right trigger zooms the production camera', async () => {
    const before = (await snapshot()).camera.zoom;
    await input([7]);
    await page.waitForTimeout(150);
    await release();
    assert((await snapshot()).camera.zoom > before);
  });
  await action('Start pauses ticks and resumes on the next press', async () => {
    await press([9]);
    assert.equal((await snapshot()).paused, true);
    const tick = (await snapshot()).tick;
    await page.waitForTimeout(180);
    assert.equal((await snapshot()).tick, tick);
    await press([9]);
    assert.equal((await snapshot()).paused, false);
    await page.waitForFunction(tick => window.rts.state.tick > tick, tick);
    return {pausedTick: tick};
  });
  await action('display modal blocks controller camera, pause, selection and orders', async () => {
    await press([13]);
    await page.locator('#display-button').click();
    const before = await snapshot();
    assert.equal(ownedWorker(before).order.type, 'hold');
    await input([9, 14, 5, 7], [1, 1, 1, 1]);
    await page.waitForTimeout(180);
    const after = await snapshot();
    assert.deepEqual(after.camera, before.camera);
    assert.equal(after.paused, before.paused);
    assert.deepEqual(after.selected, before.selected);
    assert.equal(ownedWorker(after).order.type, 'hold');
    await release();
    await page.getByRole('button', {name: 'Close display settings', exact: true}).click();
  });
  await action('reconnecting a held stop requires release before a new order', async () => {
    assert.equal(ownedWorker(await snapshot()).order.type, 'hold');
    await page.evaluate(() => {window.__certpad.connected = false; window.__certpad.timestamp++;});
    report.inputs.push({type: 'disconnect', at: new Date().toISOString()});
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const pad = window.__certpad;
      pad.connected = true; pad.id += ' reconnected'; pad.timestamp++;
      pad.buttons[14] = {pressed: true, touched: true, value: 1};
    });
    report.inputs.push({type: 'reconnect-with-held-stop', at: new Date().toISOString(), buttons: [14]});
    await page.waitForTimeout(160);
    assert.equal(ownedWorker(await snapshot()).order.type, 'hold');
    await release();
    await press([14]);
    assert.equal(ownedWorker(await snapshot()).order.type, 'idle');
  });

  await screenshot('gamepad-production.png');
  await action('native SessionTools export retains the accepted controller command history', async () => {
    await page.locator('[data-session-tool="saves"]').click();
    const paused = await snapshot();
    assert.equal(paused.paused, true);
    const saved = await downloadJson('Export save', 'gamepad-native-session.json');
    assert.equal(saved.format, 'orcs-vs-fairies/session');
    assert.equal(saved.version, context.schema.sessionVersion);
    assert.equal(saved.game.version, context.schema.saveVersion);
    assert.equal(saved.game.state.tick, paused.tick);
    assert(saved.replay, 'The native session must include recorded controller orders');
    assert.equal(saved.replay.format, 'orcs-vs-fairies/replay');
    assert.equal(saved.replay.version, context.schema.replayVersion);
    assert.equal(saved.replay.initial.version, context.schema.saveVersion);
    assert.equal(saved.replay.checksumVersion, context.schema.replayChecksumVersion);
    assert.equal(saved.replay.simulationRevision, context.schema.simulationRevision);
    assert.equal(saved.replay.finalTick, saved.game.state.tick);
    report.commands = saved.replay.actions.flatMap((entry, index) => entry.type === 'command' ? [{replayActionIndex: index, ...entry}] : []);
    const workerCommands = report.commands.filter(entry => entry.side === paused.side && entry.command.ids?.includes(worker));
    for (const type of ['hold', 'stop', 'move']) assert(workerCommands.some(entry => entry.command.type === type));
    assert(workerCommands.some(entry => entry.command.type === 'move' && entry.command.queued));
    const workerCommandSequence = workerCommands.map(entry =>
      entry.command.type === 'move' && entry.command.queued === true ? 'queued move' : entry.command.type);
    assert.deepEqual(workerCommandSequence, ['hold', 'stop', 'move', 'queued move', 'hold', 'stop']);
    report.nativeSession = {
      path: 'gamepad-native-session.json', gameSaveVersion: saved.game.version,
      replayVersion: saved.replay.version, replayChecksumVersion: saved.replay.checksumVersion,
      simulationRevision: saved.replay.simulationRevision, tick: saved.game.state.tick,
      finalChecksum: saved.replay.finalChecksum, replayActions: saved.replay.actions.length,
      acceptedCommands: report.commands.length, workerAcceptedCommands: workerCommands.length,
      workerCommandSequence,
    };
    return report.nativeSession;
  });
  await action('downloaded native bug report matches the current production build and schema', async () => {
    await page.locator('[data-session-tab="report"]').click();
    await page.getByLabel('Bug description', {exact: true}).fill('Production gamepad proof using virtual navigator.getGamepads input only.');
    const nativeReport = await downloadJson('Download bug report', 'gamepad-native-build-report.json');
    await verifyBugReport(context, nativeReport);
    report.nativeBuildReport = {path: 'gamepad-native-build-report.json', versions: nativeReport.versions};
    return report.nativeBuildReport;
  });
  report.final = await snapshot();
  report.limits = [
    'Input comes from a virtual standard controller at navigator.getGamepads; this run does not exercise physical controller hardware.',
    'The match starts through the local skirmish menu with Orcs versus Fairies, seed 4127 and a small map.',
    'The full native session is preserved for the separate current-source decoder and replay verification.',
  ];
  report.result = 'passed';
} catch (error) {
  failure = error;
  report.result = 'failed';
  report.failure = serializeError(error);
  if (page) {
    report.failureSnapshot = await snapshot().catch(() => null);
    report.failureUi = await page.locator('body').innerText().then(text => text.slice(0, 12000)).catch(() => null);
    await screenshot('gamepad-failure.png').catch(captureError => {report.failureScreenshotError = serializeError(captureError);});
  }
} finally {
  report.cleanupErrors = [];
  try {await browserContext?.close();} catch (error) {report.cleanupErrors.push(serializeError(error)); failure ??= error;}
  try {await browser?.close();} catch (error) {report.cleanupErrors.push(serializeError(error)); failure ??= error;}
  report.browserClosed = !browser?.isConnected();
  if (report.cleanupErrors.length || !report.browserClosed) {
    report.result = 'failed';
    report.failure ??= report.cleanupErrors[0] ?? {message: 'The proof browser did not close'};
    failure ??= new Error(report.failure.message);
  }
  report.completedAt = new Date().toISOString();
  try {
    await finishProof(context, report);
  } catch (error) {
    failure ??= error;
    report.result = 'failed';
    report.failure ??= serializeError(error);
    report.finalizationFailure = serializeError(error);
    // Preserve the helper's failed report and its manifest hashes when it rethrows.
    const proofPath = join(context.out, 'browser-proof.json');
    const canonical = await readFile(proofPath, 'utf8').then(JSON.parse).catch(() => null);
    if (canonical?.result === 'failed') Object.assign(report, canonical);
    else await writeFile(proofPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify({result: report.result, checks: report.checks.length, browserClosed: report.browserClosed}));
}
if (failure) throw failure;
