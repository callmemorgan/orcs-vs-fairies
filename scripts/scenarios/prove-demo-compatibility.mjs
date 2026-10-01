import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Build scenario-demo.html, serve it, then supply its URL and an artifact directory.
// PLAYWRIGHT_MODULE may point to the desktop app's bundled Playwright module.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:5286/scenario-demo.html?art=placeholder';
const output = resolve(process.argv[3] ?? 'work/demo-compatibility/browser');
await mkdir(output, { recursive: true });
const fixtures = resolve('tests/fixtures/scenario-save3-3.2');
const fixture = async name => JSON.parse(await readFile(resolve(fixtures, `${name}.json`), 'utf8'));
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.scenarioDiagnostics);
const button = name => page.getByRole('button', { name, exact: true });
const openPanel = async () => { if (await page.locator('#scenario-panel').isHidden()) await page.locator('#mission-panel-toggle').click(); };
const importProfile = async (label, value) => {
  await openPanel();
  await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'historical-profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.waitForFunction(() => window.scenarioDiagnostics?.readOnlyReason !== null);
};
const exportProfile = async label => {
  await openPanel();
  const downloaded = page.waitForEvent('download'); await button(label).click();
  const download = await downloaded, path = resolve(output, download.suggestedFilename());
  await download.saveAs(path); return JSON.parse(await readFile(path, 'utf8'));
};
try {
  await page.goto(url);
  const activeCampaign = await fixture('campaign-active');
  await importProfile('Import campaign profile', activeCampaign);
  await page.waitForFunction(() => window.scenarioDiagnostics?.ready);
  let before = await snapshot();
  assert.equal(before.readOnly, true); assert.equal(before.simulationEnabled, false); assert.equal(before.paused, true);
  assert.deepEqual(before.campaignProfile, activeCampaign);
  assert.equal(await page.locator('#restart-button').isDisabled(), true);
  assert.equal(await page.locator('#pause-button').isDisabled(), true);
  await page.waitForTimeout(2200);
  assert.deepEqual((await snapshot()).checkpoint, before.checkpoint);
  assert.equal(await page.evaluate(() => localStorage.getItem('ovf.campaign.demo.v1')), null);
  assert.deepEqual(await exportProfile('Save campaign profile'), activeCampaign);
  checks.push('historical active campaign stays frozen and exports unchanged without autosave');

  const completedCampaign = await fixture('campaign-completed');
  await importProfile('Import campaign profile', completedCampaign);
  await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.checkpoint.runtime.outcome === 'won');
  assert.match(await page.locator('.objective-tag').textContent(), /Recorded victory/);
  assert.deepEqual(await exportProfile('Save campaign profile'), completedCampaign);
  checks.push('historical campaign victory is recorded and its profile stays unchanged');

  await importProfile('Import mission checkpoint', await fixture('scenario-final'));
  await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.campaignProfile === null);
  before = await snapshot();
  assert.equal(before.readOnly, true); assert.equal(before.simulationEnabled, false);
  assert.match(await page.locator('.objective-tag').textContent(), /Recorded victory/);
  await page.waitForTimeout(2200); assert.deepEqual((await snapshot()).checkpoint, before.checkpoint);
  await openPanel(); assert.equal(await button('Reset mission').isDisabled(), true);
  checks.push('historical standalone mission checkpoint stays frozen and displays its recorded victory');

  const emptyCampaign = { ...activeCampaign, active: null, history: [], choiceId: null, revision: 0 };
  await importProfile('Import campaign profile', emptyCampaign);
  await page.waitForFunction(() => window.scenarioDiagnostics?.ready === false);
  assert.deepEqual((await snapshot()).campaignProfile, emptyCampaign);
  assert.equal(await page.locator('.scenario-compatibility').isVisible(), true);
  assert.equal(await page.locator('[data-campaign="campaign-fairies"]').isEnabled(), true);
  checks.push('empty historical campaign shows its reason without a battlefield');

  await page.locator('.conquest-tools > summary').click();
  const activeRealm = await fixture('conquest-active');
  await importProfile('Import realm profile', activeRealm);
  await page.waitForFunction(() => window.scenarioDiagnostics?.ready && !!window.scenarioDiagnostics.conquest?.active);
  before = await snapshot();
  assert.equal(before.readOnly, true); assert.equal(before.simulationEnabled, false);
  await page.waitForTimeout(2200); assert.deepEqual((await snapshot()).checkpoint, before.checkpoint);
  assert.equal(await page.evaluate(() => localStorage.getItem('ovf.conquest.demo.v1')), null);
  assert.deepEqual(await exportProfile('Export realm profile'), activeRealm);
  assert.equal(await button('Create realm').isEnabled(), true);
  checks.push('historical active realm stays frozen and retains export and new realm controls');

  const completedRealm = await fixture('conquest-completed');
  await importProfile('Import realm profile', completedRealm);
  await page.waitForFunction(() => window.scenarioDiagnostics?.ready === false);
  assert.deepEqual(await exportProfile('Export realm profile'), completedRealm);
  assert.equal(await button('Wait one turn').isDisabled(), true);
  checks.push('historical completed realm remains inspectable without a new battle');

  await button('Create realm').click();
  assert.equal((await snapshot()).readOnlyReason, null);
  await button('Attack: Deep Gate Quarry').click();
  await page.waitForFunction(() => window.scenarioDiagnostics?.ready && !window.scenarioDiagnostics.readOnly);
  assert.equal((await snapshot()).simulationEnabled, true);
  await page.locator('#resume-button').click();
  await page.waitForFunction(() => window.scenarioDiagnostics.checkpoint.game.state.tick > 1);
  await openPanel(); before = await snapshot();
  assert.equal(before.paused, true); await page.waitForTimeout(250);
  assert.equal((await snapshot()).checkpoint.game.state.tick, before.checkpoint.game.state.tick);
  await page.locator('#mission-panel-toggle').click();
  await page.waitForFunction(tick => !window.scenarioDiagnostics.paused && window.scenarioDiagnostics.checkpoint.game.state.tick > tick, before.checkpoint.game.state.tick);
  checks.push('new realms run current rules and mission panel closure restores a running battle');

  await page.locator('#display-button').click(); before = await snapshot();
  await page.waitForFunction(() => window.scenarioDiagnostics.paused);
  await page.waitForTimeout(250); const modalTick = (await snapshot()).checkpoint.game.state.tick;
  await page.waitForTimeout(250); assert.equal((await snapshot()).checkpoint.game.state.tick, modalTick);
  await button('Close display settings').click();
  await page.waitForFunction(tick => !window.scenarioDiagnostics.paused && window.scenarioDiagnostics.checkpoint.game.state.tick > tick, modalTick);
  checks.push('native display dialog freezes the clock and restores the previous pause state');

  await page.locator('#mission-photo-button').click();
  assert.equal(await page.locator('#app').evaluate(root => root.classList.contains('photo-mode')), true);
  assert.equal(await page.locator('#mission-panel-toggle').isHidden(), true);
  assert.equal(await page.locator('.photo-controls').isVisible(), true);
  before = await snapshot(); await page.waitForTimeout(250);
  assert.equal((await snapshot()).checkpoint.game.state.tick, before.checkpoint.game.state.tick);
  const downloaded = page.waitForEvent('download'); await button('Download photo').click();
  const photo = await downloaded; await photo.saveAs(resolve(output, photo.suggestedFilename()));
  await page.locator('#mission-photo-exit').click();
  await page.waitForFunction(() => !window.scenarioDiagnostics.paused);
  assert.equal(await page.locator('#mission-panel-toggle').isVisible(), true);
  checks.push('photo mode freezes the battle, hides demo controls, exports PNG and restores the clock');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(output, 'current-realm.png') });
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ url, checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2));
} finally { await browser.close(); }
