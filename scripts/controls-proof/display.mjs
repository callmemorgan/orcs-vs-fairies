import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareProof, observePage, finishProof, verifyBugReport } from './browser-common.mjs';

const proofContext = await prepareProof({
  base: process.argv[2],
  sourcePin: process.argv[3],
  outputDir: process.argv[4],
  feature: 87,
});
const { base, sourcePin, out, schema, buildId, sha } = proofContext;
const report = {
  sourcePin,
  base,
  feature: 87,
  buildId,
  schema,
  method: 'Fresh ordinary production skirmishes; native mouse and keyboard controls only. Browser evaluation reads runtime, DOM, canvas, and device preferences. No fixtures, runtime writes, commands, or clock overrides.',
  startedAt: new Date().toISOString(),
  checks: [],
  screenshots: [],
  downloads: [],
  pageErrors: [],
  consoleErrors: [],
  failedRequests: [],
  httpErrors: [],
};
const defaults = { palette: 'default', patterns: true, outlines: true };
const palettes = {
  default: ['#b9e493', '#f08572', '#76c9ef', '#eacb66', '#c69ee8', '#67d5ca', '#f3aad1', '#d1d4d9'],
  deuteranopia: ['#56b4e9', '#e69f00', '#f0e442', '#0072b2', '#cc79a7', '#009e73', '#d55e00', '#dddddd'],
  tritanopia: ['#2ccdb4', '#f06e86', '#b8e986', '#b688df', '#f1b577', '#75bada', '#f2d1df', '#d9d9d9'],
};
let browser;
let browserContext;
let page;
let runError;

const snapshot = () => page.evaluate(() => {
  const runtime = window.rts;
  const palette = document.querySelector('[data-display-setting="palette"]');
  const patterns = document.querySelector('[data-display-setting="patterns"]');
  const outlines = document.querySelector('[data-display-setting="outlines"]');
  const overlay = document.querySelector('.display-settings-overlay');
  const minimap = document.querySelector('#minimap');
  const markers = Array.from(document.querySelectorAll('[data-display-player]'), element => {
    const polygon = element.querySelector('polygon');
    const image = element.querySelector('svg');
    return {
      player: element.getAttribute('data-display-player'),
      label: element.textContent,
      aria: image?.getAttribute('aria-label'),
      fill: polygon?.getAttribute('fill'),
      points: polygon?.getAttribute('points'),
      stroke: polygon?.getAttribute('stroke'),
      strokeWidth: polygon?.getAttribute('stroke-width'),
    };
  });
  return {
    runtime: runtime ? {
      tick: runtime.state.tick,
      time: runtime.state.time,
      mode: runtime.mode,
      paused: runtime.paused,
      readOnly: runtime.readOnly,
      selected: runtime.selected,
      camera: runtime.camera,
      viewSide: runtime.viewSide,
      viewLevel: runtime.viewLevel,
      starts: runtime.state.starts,
      width: runtime.state.width,
      height: runtime.state.height,
      levelTitles: runtime.state.world?.levels.map(level => level.title) ?? null,
    } : null,
    settings: { palette: palette?.value, patterns: patterns?.checked, outlines: outlines?.checked },
    savedAppearance: localStorage.getItem('ovf.appearance.v1'),
    dialogOpen: !!overlay && !overlay.hidden,
    markers,
    alerts: Array.from(document.querySelectorAll('.minimap-alert-list button'), button => ({
      text: button.textContent,
      kind: button.getAttribute('data-kind'),
      level: button.getAttribute('data-level'),
      title: button.title,
      aria: button.getAttribute('aria-label'),
    })),
    alertStatus: document.querySelector('.minimap-alert-status')?.textContent,
    minimap: minimap ? { width: minimap.width, height: minimap.height, dataUrl: minimap.toDataURL() } : null,
    focused: document.activeElement?.getAttribute('aria-label') || document.activeElement?.id || document.activeElement?.textContent,
  };
});

async function record(name, input, extra = {}) {
  const state = await snapshot();
  if (state.minimap) {
    state.minimap.pngSha256 = sha(Buffer.from(state.minimap.dataUrl.split(',')[1], 'base64'));
    delete state.minimap.dataUrl;
  }
  const entry = { name, input, state, ...extra };
  report.checks.push(entry);
  await writeFile(join(out, 'display-actions.json'), `${JSON.stringify(report.checks, null, 2)}\n`);
  console.log(JSON.stringify({ name, input, settings: state.settings, runtime: state.runtime, alerts: state.alerts, ...extra }));
  return state;
}

async function screenshot(name) {
  const filename = `${name}.png`;
  const path = join(out, filename);
  await page.screenshot({ path });
  const bytes = await readFile(path);
  report.screenshots.push({ file: filename, sha256: sha(bytes), bytes: bytes.length });
}

async function downloadJson(button, filename) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const download = await pending;
  assert.equal(await download.failure(), null, `${button} download must complete`);
  const path = join(out, filename);
  await download.saveAs(path);
  const bytes = await readFile(path);
  report.downloads.push({ file: filename, suggestedFilename: download.suggestedFilename(), sha256: sha(bytes), bytes: bytes.length });
  return JSON.parse(bytes.toString('utf8'));
}

function settings(actual, expected) {
  assert.deepEqual(actual.settings, expected);
}

function storedSettings(actual, expected) {
  assert.deepEqual(JSON.parse(actual.savedAppearance), { version: 1, ...expected });
}

function colors(actual, palette) {
  assert.deepEqual(actual.markers.map(marker => marker.fill), palettes[palette]);
}

async function choosePalette(palette, arrowCount) {
  await page.getByRole('combobox', { name: 'Color palette', exact: true }).click();
  await page.keyboard.press('Home');
  for (let index = 0; index < arrowCount; index++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(expected => document.querySelector('[data-display-setting="palette"]')?.value === expected, palette);
  const state = await record(palette, {
    selector: 'getByRole(combobox, name="Color palette", exact=true)',
    events: ['click', 'Home', ...Array(arrowCount).fill('ArrowDown'), 'Enter'],
  });
  settings(state, { ...defaults, palette });
  colors(state, palette);
  storedSettings(state, { ...defaults, palette });
  return state;
}

async function canvasPoint() {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector('#minimap');
    const runtime = window.rts;
    if (!canvas || !runtime) return null;
    const rect = canvas.getBoundingClientRect();
    const origin = runtime.state.starts[runtime.viewSide ?? 0];
    const candidates = [];
    for (const xRatio of [0.15, 0.35, 0.65, 0.85]) {
      for (const yRatio of [0.15, 0.35, 0.55, 0.75]) {
        const x = rect.left + rect.width * xRatio;
        const y = rect.top + rect.height * yRatio;
        if (document.elementFromPoint(x, y) !== canvas) continue;
        const worldTarget = { x: xRatio * runtime.state.width, y: yRatio * runtime.state.height };
        candidates.push({
          x, y,
          position: { x: x - rect.left, y: y - rect.top },
          worldTarget,
          distanceFromStart: Math.hypot(worldTarget.x - origin.x, worldTarget.y - origin.y),
          verifiedHit: 'canvas#minimap',
        });
      }
    }
    return candidates.sort((a, b) => b.distanceFromStart - a.distanceFromStart)[0] ?? null;
  });
  assert(point, 'An exposed minimap canvas point must remain clickable beside the alert overlay');
  assert(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y) === document.querySelector('#minimap'), point), 'The selected minimap point must hit the canvas');
  return point;
}

try {
  const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
  browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  browserContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  page = await browserContext.newPage();
  observePage(page, report, proofContext);

  await page.goto(base, { waitUntil: 'networkidle' });
  report.menu = await record('fresh menu', { event: 'goto', url: base });
  assert.equal(report.menu.runtime, null);
  assert.equal(report.menu.savedAppearance, null);
  await page.getByRole('button', { name: 'Begin skirmish', exact: false }).click();
  await page.waitForFunction(() => window.rts?.state?.tick > 0, null, { timeout: 60000 });
  const started = await record('fresh ordinary skirmish', { selector: 'getByRole(button, name="Begin skirmish")', event: 'click' });
  assert.equal(started.runtime.mode, 'local');
  assert.equal(started.runtime.readOnly, false);

  const idleSelector = '.minimap-alert-list button[data-kind="idle"][data-level="0"]';
  await page.waitForFunction(selector => window.rts?.state?.time >= 13 && !!document.querySelector(selector), idleSelector, { timeout: 60000 });
  const idle = await record('idle recruitment alert', { event: 'wait for ordinary simulation time >=13 after no recruitment commands', selector: idleSelector });
  const idleAlert = idle.alerts.find(alert => alert.kind === 'idle' && alert.level === '0');
  assert(idleAlert);
  const levelTitle = idle.runtime.levelTitles?.[0];
  if (levelTitle) {
    assert(idleAlert.text.includes(levelTitle));
    assert(idleAlert.title.includes(levelTitle));
    assert(idleAlert.aria.includes(levelTitle));
    assert(idle.alertStatus.includes(`Idle on ${levelTitle}`));
  }
  await screenshot('01-default-game-idle');

  const point = await canvasPoint();
  await page.mouse.click(point.x, point.y);
  await page.mouse.move(800, 420);
  await page.waitForFunction(camera => {
    const current = window.rts?.camera;
    return current && Math.hypot(current.x - camera.x, current.y - camera.y) > 100;
  }, idle.runtime.camera, { timeout: 5000 });
  const moved = await record('minimap camera click', { selector: '#minimap', event: 'mouse click', ...point });
  assert(Math.hypot(moved.runtime.camera.x - idle.runtime.camera.x, moved.runtime.camera.y - idle.runtime.camera.y) > 100);
  await screenshot('02-minimap-camera-moved');

  const idleButton = page.locator(idleSelector);
  assert.equal(await idleButton.count(), 1);
  if (levelTitle) assert((await idleButton.getAttribute('aria-label')).includes(levelTitle));
  await idleButton.click();
  await page.mouse.move(800, 420);
  await page.waitForFunction(camera => {
    const runtime = window.rts;
    return runtime?.viewLevel === 0 && Math.hypot(runtime.camera.x - camera.x, runtime.camera.y - camera.y) > 100;
  }, moved.runtime.camera, { timeout: 5000 });
  const idleCentered = await record('idle alert camera click', { selector: idleSelector, event: 'click', authoredLevelTitle: levelTitle ?? null });
  assert.equal(idleCentered.runtime.viewLevel, 0);
  assert(Math.hypot(idleCentered.runtime.camera.x - moved.runtime.camera.x, idleCentered.runtime.camera.y - moved.runtime.camera.y) > 100);

  await page.getByRole('button', { name: 'Display', exact: true }).click();
  const standard = await record('default display dialog', { selector: 'getByRole(button, name="Display", exact=true)', event: 'click' });
  assert.equal(standard.dialogOpen, true);
  settings(standard, defaults);
  colors(standard, 'default');
  assert.equal(new Set(standard.markers.map(marker => marker.points)).size, 8);
  assert.equal(standard.markers[0].stroke, '#ffffff');
  assert.equal(standard.markers[1].stroke, '#78dfff');
  assert(standard.markers.slice(2).every(marker => marker.stroke === '#ffc15b'));
  assert(standard.markers.every(marker => marker.strokeWidth === '3'));
  assert.equal(standard.markers[0].aria, 'Player 1: Your units');
  assert.equal(standard.markers[1].aria, 'Player 2: Allied units');
  assert(standard.markers.slice(2).every((marker, index) => marker.aria === `Player ${index + 3}: Enemy units`));
  await screenshot('03-default-display');

  await choosePalette('deuteranopia', 1);
  await screenshot('04-deuteranopia-display');
  await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
  const deuterGame = await record('deuteranopia game', { selector: 'getByRole(button, name="Close display settings", exact=true)', event: 'click' });
  assert.equal(deuterGame.dialogOpen, false);
  await screenshot('05-deuteranopia-game');
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  await choosePalette('tritanopia', 2);
  await screenshot('06-tritanopia-display');

  await page.getByRole('checkbox', { name: 'Player shapes and patterns', exact: true }).click();
  const noShapes = await record('shapes disabled', { selector: 'getByRole(checkbox, name="Player shapes and patterns", exact=true)', event: 'click' });
  settings(noShapes, { palette: 'tritanopia', patterns: false, outlines: true });
  assert.equal(new Set(noShapes.markers.map(marker => marker.points)).size, 1);
  await page.getByRole('checkbox', { name: 'Outlines for your units, allies and enemies', exact: true }).click();
  const noOutlines = await record('outlines disabled', { selector: 'getByRole(checkbox, name="Outlines for your units, allies and enemies", exact=true)', event: 'click' });
  const alternative = { palette: 'tritanopia', patterns: false, outlines: false };
  settings(noOutlines, alternative);
  assert(noOutlines.markers.every(marker => marker.stroke === 'none' && marker.strokeWidth === '0'));
  storedSettings(noOutlines, alternative);
  await screenshot('07-tritanopia-shapes-outlines-off');

  await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  const reopened = await record('dialog close and reopen persistence', { events: ['Close display settings click', 'Display click'] });
  settings(reopened, alternative);
  storedSettings(reopened, alternative);
  await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Begin skirmish', exact: false }).click();
  await page.waitForFunction(() => window.rts?.state?.tick > 0, null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  const restored = await record('page reload device persistence', { events: ['reload', 'Begin skirmish click', 'Display click'] });
  settings(restored, alternative);
  storedSettings(restored, alternative);
  assert.equal(new Set(restored.markers.map(marker => marker.points)).size, 1);
  assert(restored.markers.every(marker => marker.stroke === 'none' && marker.strokeWidth === '0'));
  colors(restored, 'tritanopia');
  await screenshot('08-reloaded-persistence');
  await page.getByRole('button', { name: 'Reset display settings', exact: true }).click();
  const reset = await record('reset display settings', { selector: 'getByRole(button, name="Reset display settings", exact=true)', event: 'click' });
  settings(reset, defaults);
  colors(reset, 'default');
  assert.equal(new Set(reset.markers.map(marker => marker.points)).size, 8);
  assert(reset.markers.every(marker => marker.stroke !== 'none' && marker.strokeWidth === '3'));
  storedSettings(reset, defaults);
  await screenshot('09-reset-display');
  await page.getByRole('button', { name: 'Close display settings', exact: true }).click();

  await page.locator('[data-session-tool="saves"]').click();
  const native = await downloadJson('Export save', 'native-display-final.json');
  assert.equal(native.format, 'orcs-vs-fairies/session');
  assert.equal(native.version, schema.sessionVersion);
  assert.equal(native.game.version, schema.saveVersion);
  assert.equal(native.replay.version, schema.replayVersion);
  assert.equal(native.replay.initial.version, schema.saveVersion);
  assert.equal(native.replay.checksumVersion, schema.replayChecksumVersion);
  assert.equal(native.replay.simulationRevision, schema.simulationRevision);
  assert.equal(native.replay.finalTick, native.game.state.tick);
  await record('native session schema', { selector: 'getByRole(button, name="Export save", exact=true)', event: 'download' }, {
    sessionVersion: native.version,
    saveVersion: native.game.version,
    replayVersion: native.replay.version,
    replayChecksumVersion: native.replay.checksumVersion,
    simulationRevision: native.replay.simulationRevision,
    tick: native.game.state.tick,
  });
  await page.locator('[data-session-tab="report"]').click();
  await page.getByLabel('Bug description', { exact: true }).fill('Read-only feature 87 production Display proof.');
  const bugReport = await downloadJson('Download bug report', 'native-build-report.json');
  await verifyBugReport(proofContext, bugReport);
  await record('served production build identity', { selector: 'getByRole(button, name="Download bug report", exact=true)', event: 'download' }, { buildId, sourcePin });

  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.failedRequests, []);
  assert.deepEqual(report.httpErrors, []);
  report.result = 'passed';
  report.limits = [
    'The Display example-team preview checks all eight player colors and shapes and own, allied, and enemy outlines; these ordinary fresh matches contain only the default two factions.',
    'The native surface idle alert is exercised after ordinary simulation time. No natural raid or threatened expansion is required or certified by this Display driver.',
    'No physical controller, perception study, or contrast measurement is exercised. The exported current native session is retained for a separate native roundtrip/replay checker.',
  ];
} catch (error) {
  runError = error;
  report.result = 'failed';
  report.failure = { message: error.message, stack: error.stack };
  if (page) {
    try { await screenshot('failure'); } catch (captureError) { report.failure.screenshotError = captureError.message; }
  }
} finally {
  for (const [name, resource] of [['context', browserContext], ['browser', browser]]) {
    try { await resource?.close(); } catch (error) {
      (report.cleanupErrors ??= []).push({ resource: name, message: error.message });
      if (!runError) runError = error;
      report.result = 'failed';
      report.failure ??= { message: error.message, stack: error.stack };
    }
  }
  report.browserClosed = !browser?.isConnected();
  report.finishedAt = new Date().toISOString();
  await finishProof(proofContext, report);
  console.log(JSON.stringify({ result: report.result, checkCount: report.checks.length, screenshotCount: report.screenshots.length, pageErrors: report.pageErrors, consoleErrors: report.consoleErrors, browserClosed: report.browserClosed }));
}
if (runError) throw runError;
