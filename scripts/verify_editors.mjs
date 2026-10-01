import { chromium } from '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:5364';
const evidence = path.resolve(process.env.OVF_EDITOR_EVIDENCE_DIR || 'docs/evidence/editor-browser-20261001');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const page = await context.newPage();
const results = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
function checked(name, details = {}) { results.push({ name, ...details }); process.stdout.write(`PASS ${name}\n`); }
async function exported(name) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export map package', exact: true }).click();
  const file = await downloading, target = path.join(evidence, name); await file.saveAs(target);
  return JSON.parse(await readFile(target, 'utf8'));
}
async function point(x, y) {
  const box = await page.getByLabel('Map painting canvas', { exact: true }).boundingBox(); assert(box);
  return { x: box.x + (x + .5) / 36 * box.width, y: box.y + (y + .5) / 36 * box.height };
}
async function clickTile(x, y) { const p = await point(x, y); await page.mouse.click(p.x, p.y); }
try {
  await page.goto(`${base}/editor.html?art=placeholder`);
  await page.getByRole('button', { name: 'Play edited map', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Play edited map', exact: true }).isEnabled().then(assert);
  const original = await exported('initial-map.json');
  assert.equal(original.map.starts.length, 2); checked('default map validates with two starts');
  await page.getByLabel('Terrain brush', { exact: true }).selectOption('water');
  await clickTile(1, 1);
  let edited = await exported('painted-map.json'); assert.equal(edited.map.levels[0].terrain[37], 'water');
  checked('normal canvas input paints terrain');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  let reverted = await exported('undo-map.json'); assert.equal(reverted.map.levels[0].terrain[37], original.map.levels[0].terrain[37]);
  await page.getByRole('button', { name: 'Redo edit', exact: true }).click();
  edited = await exported('redo-map.json'); assert.equal(edited.map.levels[0].terrain[37], 'water');
  checked('undo and redo restore the actual painted tiles');
  await page.getByLabel('Editor tool', { exact: true }).selectOption('elevation');
  await page.getByLabel('Elevation height', { exact: true }).selectOption('1'); await clickTile(2, 2);
  edited = await exported('elevation-map.json'); assert.equal(edited.map.levels[0].elevation[74], 1);
  checked('normal canvas input paints elevation');
  await page.getByRole('button', { name: 'Save editor draft', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Load editor draft', exact: true }).click();
  const reloaded = await exported('reloaded-map.json'); assert.deepEqual(reloaded.map, edited.map);
  checked('save and reload retain the authored map');
  const corrupted = structuredClone(reloaded); corrupted.map.levels[0].terrain[37] = 'road';
  const invalidFile = path.join(evidence, 'invalid-map.json'); await writeFile(invalidFile, JSON.stringify(corrupted));
  await page.getByLabel('Import map package', { exact: true }).setInputFiles(invalidFile);
  await page.getByRole('status').filter({ hasText: /checksum mismatch/ }).waitFor();
  const preserved = await exported('after-invalid-map.json'); assert.deepEqual(preserved.map, reloaded.map);
  checked('tampered import preserves the current document');
  await page.getByLabel('Import map package', { exact: true }).setInputFiles(path.join(evidence, 'reloaded-map.json'));
  await page.getByRole('status').filter({ hasText: /Imported/ }).waitFor();
  const imported = await exported('imported-map.json'); assert.deepEqual(imported.map, reloaded.map);
  checked('exported package imports without changing tiles or elevations');
  await page.getByLabel('Editor tool', { exact: true }).selectOption('start');
  await page.getByLabel('Player start slot', { exact: true }).selectOption('0'); await clickTile(8, 7);
  const moved = await exported('moved-start-map.json'); assert.equal(moved.map.starts[0].x, 8.5);
  checked('normal canvas input moves the player starting slot');
  await page.getByRole('button', { name: 'Add underground level', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Play edited map', exact: true }).isEnabled(), false);
  checked('disconnected underground map is rejected for play');
  await page.getByLabel('Editor tool', { exact: true }).selectOption('terrain');
  await page.getByLabel('Terrain brush', { exact: true }).selectOption('grass');
  await page.getByLabel('Brush width', { exact: true }).selectOption('5');
  await clickTile(11, 8); await clickTile(15, 8);
  await page.getByLabel('Editor tool', { exact: true }).selectOption('resource');
  await page.getByLabel('Resource kind', { exact: true }).selectOption('crystal');
  await page.getByLabel('Resource amount', { exact: true }).fill('999'); await clickTile(15, 8);
  await page.getByLabel('Editor tool', { exact: true }).selectOption('site');
  await page.getByLabel('Site kind', { exact: true }).selectOption('relic'); await clickTile(14, 9);
  await page.getByLabel('Editor tool', { exact: true }).selectOption('entrance');
  await clickTile(11, 8); await page.locator('.editor-dialog').getByLabel('Map level', { exact: true }).selectOption('0'); await clickTile(11, 8);
  const twoLevel = await exported('two-level-map.json');
  assert.equal(twoLevel.map.levels.length, 2); assert.equal(twoLevel.map.transitions.length, 1);
  assert(twoLevel.map.resources.some(r => r.level === 1 && r.kind === 'crystal' && r.amount === 999));
  assert(twoLevel.map.sites.some(r => r.level === 1 && r.kind === 'relic'));
  checked('painted cave, resource, site and entrance become a playable two-level package');
  await page.getByLabel('Import map package', { exact: true }).setInputFiles(path.join(evidence, 'two-level-map.json'));
  await page.getByRole('status').filter({ hasText: /Imported/ }).waitFor();
  const exactTwoLevel = await exported('imported-two-level-map.json'); assert.deepEqual(exactTwoLevel.map, twoLevel.map);
  checked('two-level export and import preserve elevations, sites and entrances');
  await page.getByText('New map settings', { exact: true }).click();
  await page.getByLabel('New map player count', { exact: true }).selectOption('8');
  await page.getByRole('button', { name: 'Create new map', exact: true }).click();
  const eight = await exported('eight-start-map.json'); assert.equal(eight.map.starts.length, 8);
  checked('editor creates and validates all eight starting slots');
  await page.getByLabel('Import map package', { exact: true }).setInputFiles(path.join(evidence, 'two-level-map.json'));
  await page.getByRole('status').filter({ hasText: /Imported/ }).waitFor();
  const playable = await exported('playable-map.json');
  await page.screenshot({ path: path.join(evidence, 'map-editor.png'), fullPage: true });
  if (process.env.OVF_EDITOR_PLAY === '1') {
    await page.getByRole('button', { name: 'Play edited map', exact: true }).click();
    await page.waitForFunction(() => window.editorDiagnostics?.()?.tick > 10);
    const diagnostics = await page.evaluate(() => window.editorDiagnostics());
    assert.deepEqual(diagnostics.terrain, playable.map.levels[0].terrain);
    assert.deepEqual(diagnostics.starts.map(({ x, y, level = 0 }) => ({ x, y, level })), playable.map.starts.map(({ x, y, level }) => ({ x, y, level })));
    assert.equal(diagnostics.worldHash, playable.contentHash);
    checked('exported map launches unchanged in the actual game core', { tick: diagnostics.tick, worldHash: diagnostics.worldHash });
    assert.deepEqual(diagnostics.world.levels, playable.map.levels);
    assert.deepEqual(diagnostics.world.transitions, playable.map.transitions);
    assert(diagnostics.world.sites.some(site => site.kind === 'relic' && site.level === 1 && site.x === 14.5 && site.y === 9.5));
    checked('actual game retains authored levels, elevation, site and entrance geometry');
    await page.locator('.world-tools > summary').click();
    await page.getByText('Owned troops by level', { exact: true }).click();
    await page.getByRole('button', { name: /^melee #\d+ · Ground$/ }).click();
    const selectedForEntrance = await page.evaluate(() => window.editorDiagnostics().selected[0]);
    assert(Number.isInteger(selectedForEntrance));
    await page.getByRole('button', { name: 'Traverse entrance', exact: true }).click();
    await page.waitForFunction(id => window.editorDiagnostics?.()?.entities.some(entity => entity.id === id && entity.level === 1), selectedForEntrance);
    await page.locator('.world-tools').getByLabel('Map level', { exact: true }).selectOption('1');
    const underground = await page.evaluate(() => window.editorDiagnostics()); assert.equal(underground.viewLevel, 1);
    checked('normal world controls traverse the authored entrance and show the cave');
    await page.screenshot({ path: path.join(evidence, 'edited-map-in-play.png'), fullPage: true });
  }
  assert.deepEqual(errors, []); checked('browser has no uncaught errors');
} finally {
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify({ base, results, errors, checkedAt: new Date().toISOString() }, null, 2));
  await browser.close();
}
