import { chromium } from '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const output = '/tmp/ovf-controls-6899f35.oZddGk/control-evidence/saves/display';
const url = 'http://127.0.0.1:5193/';
const sourcePin = '6899f35ae1e8d8b08781005bf766b9bcce2755b6';
const proof = { sourcePin, url, started: new Date().toISOString(), actions: [], screenshots: [], pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [] };
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', error => proof.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') proof.consoleErrors.push(message.text()); });
page.on('requestfailed', request => proof.failedRequests.push({ url: request.url(), failure: request.failure() }));
page.on('response', response => { if (response.status() >= 400) proof.httpErrors.push({ url: response.url(), status: response.status() }); });

const snapshot = async () => page.evaluate(() => {
  const runtime = window.rts;
  const palette = document.querySelector('[data-display-setting="palette"]');
  const pattern = document.querySelector('[data-display-setting="patterns"]');
  const outlines = document.querySelector('[data-display-setting="outlines"]');
  const minimap = document.querySelector('#minimap');
  const markers = Array.from(document.querySelectorAll('[data-display-player]')).map(element => {
    const polygon = element.querySelector('polygon');
    return { player: element.getAttribute('data-display-player'), label: element.textContent, aria: element.querySelector('svg').getAttribute('aria-label'), fill: polygon.getAttribute('fill'), points: polygon.getAttribute('points'), stroke: polygon.getAttribute('stroke'), strokeWidth: polygon.getAttribute('stroke-width') };
  });
  return {
    runtime: runtime ? { tick: runtime.state.tick, time: runtime.state.time, mode: runtime.mode, paused: runtime.paused, readOnly: runtime.readOnly, selected: runtime.selected, camera: runtime.camera, starts: runtime.state.starts, width: runtime.state.width, height: runtime.state.height } : null,
    settings: { palette: palette?.value, patterns: pattern?.checked, outlines: outlines?.checked },
    savedAppearance: localStorage.getItem('ovf.appearance.v1'),
    dialogOpen: !document.querySelector('.display-settings-overlay')?.hidden,
    markers,
    alerts: Array.from(document.querySelectorAll('.minimap-alert-list button')).map(button => ({ text: button.textContent, kind: button.getAttribute('data-kind'), title: button.title, aria: button.getAttribute('aria-label') })),
    alertStatus: document.querySelector('.minimap-alert-status')?.textContent,
    minimap: minimap ? { width: minimap.width, height: minimap.height, dataUrl: minimap.toDataURL() } : null,
    focused: document.activeElement?.getAttribute('aria-label') || document.activeElement?.id || document.activeElement?.textContent,
  };
});
const record = async (name, input) => {
  const state = await snapshot();
  if (state.minimap) {
    state.minimap.pngSha256 = createHash('sha256').update(Buffer.from(state.minimap.dataUrl.split(',')[1], 'base64')).digest('hex');
    delete state.minimap.dataUrl;
  }
  const entry = { name, input, state };
  proof.actions.push(entry);
  console.log(JSON.stringify({ name, input, settings: state.settings, runtime: state.runtime, alerts: state.alerts }));
  return state;
};
const screenshot = async name => {
  const path = `${output}/${name}.png`;
  await page.screenshot({ path });
  proof.screenshots.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
};
const settings = (actual, expected) => assert.deepEqual(actual.settings, expected);
const defaults = { palette: 'default', patterns: true, outlines: true };
const palettes = {
  default: ['#b9e493','#f08572','#76c9ef','#eacb66','#c69ee8','#67d5ca','#f3aad1','#d1d4d9'],
  deuteranopia: ['#56b4e9','#e69f00','#f0e442','#0072b2','#cc79a7','#009e73','#d55e00','#dddddd'],
  tritanopia: ['#2ccdb4','#f06e86','#b8e986','#b688df','#f1b577','#75bada','#f2d1df','#d9d9d9'],
};
const colors = (actual, palette) => assert.deepEqual(actual.markers.map(marker => marker.fill), palettes[palette]);
const choosePalette = async (palette, arrowCount) => {
  await page.getByRole('combobox', { name: 'Color palette', exact: true }).click();
  await page.keyboard.press('Home');
  for (let index = 0; index < arrowCount; index++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const state = await record(palette, { selector: 'getByRole(combobox, name="Color palette", exact=true)', events: ['click', 'Home', ...Array(arrowCount).fill('ArrowDown'), 'Enter'] });
  settings(state, { ...defaults, palette });
  colors(state, palette);
  assert.deepEqual(JSON.parse(state.savedAppearance), { version: 1, ...defaults, palette });
  return state;
};

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  proof.menu = await record('fresh menu', { event: 'goto', url });
  assert.equal(proof.menu.runtime, null);
  assert.equal(proof.menu.savedAppearance, null);
  await page.getByRole('button', { name: 'Begin skirmish', exact: false }).click();
  await page.waitForFunction(() => window.rts?.state?.tick > 0, null, { timeout: 45000 });
  const started = await record('fresh ordinary skirmish', { selector: 'getByRole(button, name="Begin skirmish")', event: 'click' });
  assert.equal(started.runtime.mode, 'local');
  assert.equal(started.runtime.readOnly, false);
  await page.waitForFunction(() => window.rts?.state?.time >= 13 && document.querySelector('.minimap-alert-list [data-kind="idle"]'), null, { timeout: 60000 });
  const idle = await record('idle recruitment alert', { event: 'wait for simulation time >=13 after no recruitment commands' });
  assert(idle.alerts.some(alert => alert.kind === 'idle'));
  await screenshot('01-default-game-idle');
  const map = page.locator('#minimap');
  const box = await map.boundingBox();
  const minimapPosition = { x: box.width * 0.65, y: box.height * 0.58 };
  await map.click({ position: minimapPosition });
  await page.mouse.move(800, 420);
  await page.waitForTimeout(180);
  const moved = await record('minimap camera click', { selector: '#minimap', event: 'click', position: minimapPosition, worldTarget: { x: .65 * idle.runtime.width, y: .58 * idle.runtime.height } });
  assert(Math.hypot(moved.runtime.camera.x - idle.runtime.camera.x, moved.runtime.camera.y - idle.runtime.camera.y) > 100);
  await screenshot('02-minimap-camera-moved');
  await page.getByRole('button', { name: /^Recruitment idle for 12 seconds\. Center camera;/ }).click();
  await page.mouse.move(800, 420);
  await page.waitForTimeout(150);
  const idleCentered = await record('idle alert camera click', { selector: 'getByRole(button, name=/^Recruitment idle for 12 seconds\\. Center camera;/)', event: 'click' });
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
  assert.deepEqual(JSON.parse(noOutlines.savedAppearance), { version: 1, ...alternative });
  await screenshot('07-tritanopia-shapes-outlines-off');
  await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  const reopened = await record('dialog close and reopen persistence', { events: ['Close display settings click', 'Display click'] });
  settings(reopened, alternative);
  assert.deepEqual(JSON.parse(reopened.savedAppearance), { version: 1, ...alternative });
  await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Begin skirmish', exact: false }).click();
  await page.waitForFunction(() => window.rts?.state?.tick > 0, null, { timeout: 45000 });
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  const restored = await record('page reload device persistence', { events: ['reload', 'Begin skirmish click', 'Display click'] });
  settings(restored, alternative);
  assert.deepEqual(JSON.parse(restored.savedAppearance), { version: 1, ...alternative });
  await screenshot('08-reloaded-persistence');
  await page.getByRole('button', { name: 'Reset display settings', exact: true }).click();
  const reset = await record('reset display settings', { selector: 'getByRole(button, name="Reset display settings", exact=true)', event: 'click' });
  settings(reset, defaults);
  colors(reset, 'default');
  assert.equal(new Set(reset.markers.map(marker => marker.points)).size, 8);
  assert(reset.markers.every(marker => marker.stroke !== 'none' && marker.strokeWidth === '3'));
  assert.deepEqual(JSON.parse(reset.savedAppearance), { version: 1, ...defaults });
  await screenshot('09-reset-display');
  await page.getByRole('button', { name: 'Close display settings', exact: true }).click();
  assert.deepEqual(proof.pageErrors, []);
  assert.deepEqual(proof.consoleErrors, []);
  assert.deepEqual(proof.failedRequests, []);
  assert.deepEqual(proof.httpErrors, []);
  proof.result = 'passed';
  proof.gaps = ['No naturally occurring raid or expansion threat occurred during this fresh-match idle check; those alert kinds were not exercised.', 'The example-team preview proves all eight marker colors and shapes, including own/ally/enemy outlines; fresh gameplay contained only the default two factions.', 'No physical gamepad, saved fixture, or runtime command was used.'];
} catch (error) {
  proof.result = 'failed';
  proof.failure = { message: error.message, stack: error.stack };
  try { await screenshot('failure'); } catch {}
  throw error;
} finally {
  await context.close();
  await browser.close();
  proof.browserClosed = !browser.isConnected();
  proof.finished = new Date().toISOString();
  await writeFile(`${output}/display-proof.json`, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ result: proof.result, actionCount: proof.actions.length, pageErrors: proof.pageErrors, consoleErrors: proof.consoleErrors, failedRequests: proof.failedRequests, httpErrors: proof.httpErrors, browserClosed: proof.browserClosed }));
}
