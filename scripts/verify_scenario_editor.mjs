import { chromium } from '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:5364';
const evidence = path.resolve(process.env.OVF_EDITOR_EVIDENCE_DIR || 'docs/evidence/scenario-editor-browser-20261001');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const results = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
function checked(name, details = {}) { results.push({ name, ...details }); process.stdout.write(`PASS ${name}\n`); }
async function fill(name, value) { const field = page.getByLabel(name, { exact: true }); await field.fill(String(value)); await field.press('Tab'); }
async function select(name, value) { await page.getByLabel(name, { exact: true }).selectOption(value); }
async function fold(name) { const summary = page.locator('.scenario-authoring summary').filter({ hasText: name }); if (await summary.count()) { const isOpen = await summary.evaluate(element => element.parentElement.open); if (!isOpen) await summary.click(); } }
async function exported(name) { const waiting = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export scenario', exact: true }).click(); const file = await waiting, target = path.join(evidence, name); await file.saveAs(target); return JSON.parse(await readFile(target, 'utf8')); }
try {
  await page.goto(`${base}/editor.html?art=placeholder`); await page.getByRole('tab', { name: 'Scenario editor', exact: true }).click();
  await fill('Scenario title', 'Convoy to the clearing'); await fill('Scenario ID', 'convoy-clearing');
  await fold('Initial actors'); await select('Actor 1 role', 'worker');
  await page.getByRole('button', { name: 'Add initial actor', exact: true }).click();
  await fold('Escort route'); await page.getByLabel('Enable escort route', { exact: true }).check();
  await fill('Escort checkpoint 1 X', 10.5); await fill('Escort checkpoint 1 Y', 12.5);
  await fill('Escort checkpoint 2 X', 10.5); await fill('Escort checkpoint 2 Y', 14.5);
  await page.getByRole('button', { name: 'Add escort destination objective', exact: true }).click();
  await fold('Objectives'); await fold('Objective 2'); await page.getByLabel('Objective 2 optional', { exact: true }).check();
  await fold('Timed wave'); await fill('Wave starts at seconds', 2); await fill('Wave actor count', 1);
  await fill('Wave spawn X', 24.5); await fill('Wave spawn Y', 24.5);
  await fill('Wave attack destination X', 24.5); await fill('Wave attack destination Y', 24.5);
  await page.getByRole('button', { name: 'Add timed wave', exact: true }).click();
  await fold('Event graph'); await page.getByRole('button', { name: 'Add custom win condition', exact: true }).click();
  await fold('Event 2');
  await select('Event 2 trigger type', 'all'); await select('Event 2 trigger condition 1 type', 'at');
  await fill('Event 2 trigger condition 1 point X', 10.5); await fill('Event 2 trigger condition 1 point Y', 14.5);
  await page.getByRole('button', { name: 'Add Event 2 trigger condition', exact: true }).click();
  await fill('Event 2 trigger condition 2 seconds', 5);
  const created = await exported('convoy-scenario.json');
  assert.equal(created.scenario.army[0].role, 'worker'); assert.equal(created.scenario.escort.route[1].y, 14.5);
  assert.equal(created.scenario.events[0].when.seconds, 2); assert.equal(created.scenario.events[0].actions[0].actors.length, 1);
  assert.equal(created.scenario.events[1].when.type, 'all'); assert.equal(created.scenario.events[1].actions[0].outcome, 'won');
  checked('ordinary editor controls author escort, timed wave and nested custom victory');
  await page.getByRole('button', { name: 'Undo scenario edit', exact: true }).click();
  const undone = await exported('undo-scenario.json'); assert.equal(undone.scenario.events[1].when.conditions[1].seconds, 60);
  await page.getByRole('button', { name: 'Redo scenario edit', exact: true }).click();
  const redone = await exported('redo-scenario.json'); assert.deepEqual(redone.scenario, created.scenario);
  checked('scenario graph undo and redo preserve all other nodes');
  const corrupted = structuredClone(created); corrupted.scenario.title = 'Tampered title'; const invalid = path.join(evidence, 'invalid-scenario.json'); await writeFile(invalid, JSON.stringify(corrupted));
  await page.getByLabel('Import scenario package', { exact: true }).setInputFiles(invalid);
  await page.locator('.scenario-authoring [role=status]').filter({ hasText: /checksum mismatch/ }).waitFor();
  const preserved = await exported('after-invalid-scenario.json'); assert.deepEqual(preserved.scenario, created.scenario);
  checked('invalid scenario import preserves the current graph');
  await page.getByLabel('Import scenario package', { exact: true }).setInputFiles(path.join(evidence, 'convoy-scenario.json'));
  await page.locator('.scenario-authoring [role=status]').filter({ hasText: /imported/ }).waitFor();
  const imported = await exported('imported-scenario.json'); assert.deepEqual(imported, created);
  checked('scenario export and import preserve the exact graph and pinned map');
  await page.screenshot({ path: path.join(evidence, 'scenario-editor.png'), fullPage: true });
  await page.getByRole('button', { name: 'Play scenario', exact: true }).click();
  await page.waitForFunction(() => window.editorDiagnostics?.()?.scenario?.runtime.outcome === 'won', { timeout: 15000 });
  let diagnostics = await page.evaluate(() => window.editorDiagnostics());
  assert.equal(diagnostics.scenario.runtime.reason, 'Custom victory condition completed.');
  assert.equal(diagnostics.scenario.runtime.triggers['wave-1'].count, 1);
  assert.equal(diagnostics.scenario.runtime.triggers['custom-win-1'].count, 1);
  assert(diagnostics.scenario.runtime.escort.checkpoint >= 1);
  assert(diagnostics.scenario.entities.some(entity => entity.id === diagnostics.scenario.runtime.labels['wave-1-actor-1']));
  checked('authored escort and wave execute in normal game and custom victory wins', { tick: diagnostics.tick, escortCheckpoint: diagnostics.scenario.runtime.escort.checkpoint });
  await page.screenshot({ path: path.join(evidence, 'scenario-success.png'), fullPage: true });
  assert.equal(await page.locator('#overlay-description').innerText(), diagnostics.scenario.runtime.reason);
  assert(!await page.locator('#overlay-description').innerText().then(text => text.includes('stronghold')));
  await page.getByRole('button', { name: 'Map and scenario editor', exact: true }).click();
  await page.getByRole('tab', { name: 'Scenario editor', exact: true }).click();
  await page.getByRole('button', { name: 'Play scenario', exact: true }).click();
  await page.waitForFunction(() => window.editorDiagnostics?.()?.scenario?.runtime.outcome === 'playing');
  checked('authored scenario relaunches through its native editor play control');
  await page.getByRole('button', { name: 'Map and scenario editor', exact: true }).click();
  await page.getByRole('tab', { name: 'Scenario editor', exact: true }).click();
  await fold('Initial actors'); await page.getByLabel('Actor 1 custom health', { exact: true }).check(); await fill('Actor 1 health', 1);
  await page.getByRole('button', { name: 'Add initial actor', exact: true }).click();
  await fold('Actor 3'); await select('Actor 3 side', '1'); await fill('Actor 3 position X', 9.5); await fill('Actor 3 position Y', 11.5);
  const failure = await exported('convoy-failure-scenario.json'); assert.equal(failure.scenario.army[0].hp, 1);
  await page.getByRole('button', { name: 'Play scenario', exact: true }).click();
  await page.waitForFunction(() => window.editorDiagnostics?.()?.scenario?.runtime.outcome === 'lost', { timeout: 15000 });
  diagnostics = await page.evaluate(() => window.editorDiagnostics());
  assert(diagnostics.scenario.entities.find(entity => entity.id === diagnostics.scenario.runtime.labels.commander)?.hp <= 0);
  checked('protected convoy death produces mission failure without headquarters defeat', { tick: diagnostics.tick, reason: diagnostics.scenario.runtime.reason });
  await page.screenshot({ path: path.join(evidence, 'scenario-failure.png'), fullPage: true });
  assert.deepEqual(errors, []); checked('browser has no uncaught errors');
} catch (error) {
  await page.screenshot({ path: path.join(evidence, 'scenario-verification-failure.png'), fullPage: true });
  await writeFile(path.join(evidence, 'scenario-verification-failure.json'), JSON.stringify({ error: String(error), fields: await page.locator('.scenario-authoring [aria-label]').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label'), visible: !!node.getClientRects().length }))), status: await page.locator('.scenario-authoring [role=status]').allTextContents() }, null, 2));
  throw error;
} finally {
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify({ base, results, errors, checkedAt: new Date().toISOString() }, null, 2));
  await browser.close();
}
