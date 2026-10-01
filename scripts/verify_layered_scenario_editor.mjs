import { chromium } from '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || 'http://127.0.0.1:5364').replace(/\/$/, '');
const evidence = path.resolve(process.env.OVF_EDITOR_EVIDENCE_DIR || path.join(root, 'docs/evidence/layered-scenario-editor-20261001'));
const fixturePath = path.resolve(process.env.OVF_EDITOR_MAP_FIXTURE || path.join(root, 'docs/evidence/editor-root-integration-20261001/map/two-level-map.json'));
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
await mkdir(evidence, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
page.setDefaultTimeout(15000);
const results = [], errors = [], timeline = [];
let failure;
page.on('pageerror', error => errors.push(error.message));

function checked(name, details = {}) {
  results.push({ name, ...details });
  process.stdout.write(`PASS ${name}\n`);
}
async function save(name, value) {
  await writeFile(path.join(evidence, name), JSON.stringify(value, null, 2));
}
async function fill(name, value) {
  const field = page.getByLabel(name, { exact: true });
  await field.fill(String(value));
  await field.press('Tab');
}
async function select(name, value) {
  await page.getByLabel(name, { exact: true }).selectOption(String(value));
}
async function openSection(key) {
  const section = page.locator(`.scenario-authoring [data-scenario-section=${JSON.stringify(key)}]`);
  assert.equal(await section.count(), 1, `One scenario section exists for ${key}`);
  if (!await section.evaluate(element => element.open)) await section.locator(':scope > summary').click();
  await page.waitForFunction(key => document.querySelector(`.scenario-authoring [data-scenario-section=${JSON.stringify(key)}]`)?.open, key);
}
async function exported(name) {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export scenario', exact: true }).click();
  const download = await waiting;
  const target = path.join(evidence, name);
  await download.saveAs(target);
  return JSON.parse(await readFile(target, 'utf8'));
}
async function diagnostics() {
  return page.evaluate(() => window.editorDiagnostics?.());
}
function actorFrom(snapshot, label) {
  const id = snapshot.scenario.runtime.labels[label];
  const actor = snapshot.scenario.entities.find(entity => entity.id === id);
  assert(actor, `Runtime contains the named actor ${label}`);
  return actor;
}
function assertWorld(snapshot) {
  assert(snapshot.world, 'The authored layered world exists in play');
  assert.equal(snapshot.width, fixture.map.width);
  assert.equal(snapshot.height, fixture.map.height);
  assert.deepEqual(snapshot.world.levels, fixture.map.levels);
  assert.deepEqual(snapshot.world.transitions, fixture.map.transitions);
  assert.deepEqual(snapshot.terrain, fixture.map.levels[0].terrain);
  assert.deepEqual(snapshot.starts, fixture.map.starts.map(({ x, y, level }) => ({ x, y, level })));
  assert.deepEqual(snapshot.resources.map(({ id, ...resource }) => resource), fixture.map.resources);
  assert.deepEqual(snapshot.world.sites.map(({ x, y, level, kind }) => ({ x, y, level, kind })), fixture.map.sites.map(({ x, y, level, kind }) => ({ x, y, level, kind })));
}
function assertUniqueIds(snapshot) {
  const owners = [
    ...snapshot.resources.map(value => ({ type: 'resource', id: value.id })),
    ...snapshot.world.sites.map(value => ({ type: 'site', id: value.id })),
    ...snapshot.world.bridges.map(value => ({ type: 'bridge', id: value.id })),
    ...snapshot.world.creatures.map(value => ({ type: 'creature', id: value.id })),
    ...snapshot.entities.map(value => ({ type: 'entity', id: value.id })),
  ];
  assert(owners.every(value => Number.isSafeInteger(value.id) && value.id > 0), 'All runtime object IDs are positive integers');
  assert.equal(new Set(owners.map(value => value.id)).size, owners.length, 'Resource, site, bridge, creature and entity IDs are globally unique');
  return owners;
}
function sample(snapshot) {
  const runtime = snapshot.scenario.runtime;
  const commander = actorFrom(snapshot, 'commander');
  const waveId = runtime.labels['wave-1-actor-1'];
  const wave = snapshot.entities.find(entity => entity.id === waveId);
  return {
    tick: snapshot.tick, viewLevel: snapshot.viewLevel, outcome: runtime.outcome,
    commander: { id: commander.id, x: commander.x, y: commander.y, level: commander.level, order: commander.order },
    wave: wave ? { id: wave.id, x: wave.x, y: wave.y, level: wave.level, side: wave.side, order: wave.order } : null,
    triggers: runtime.triggers, completed: runtime.completed,
  };
}

try {
  await page.goto(`${base}/editor.html?art=placeholder`);
  await page.getByLabel('Import map package', { exact: true }).setInputFiles(fixturePath);
  await page.locator('.editor-status').filter({ hasText: `Imported ${fixture.title}.` }).waitFor();
  await page.getByRole('tab', { name: 'Scenario editor', exact: true }).click();
  await fill('Scenario title', 'Cave arrival and reinforcements');
  await fill('Scenario ID', 'cave-arrival');

  await openSection('army');
  await openSection('actor-Actor 1');
  await select('Actor 1 position level', 1);
  await fill('Actor 1 position X', 11.5);
  await fill('Actor 1 position Y', 8.5);
  await page.getByLabel('Actor 1 initial order', { exact: true }).check();
  await select('Actor 1 order type', 'move');
  await select('Actor 1 destination level', 1);
  await fill('Actor 1 destination X', 11.5);
  await fill('Actor 1 destination Y', 9.5);

  await openSection('timed-wave');
  await fill('Wave starts at seconds', 1);
  await fill('Wave actor count', 1);
  await select('Wave actor side', 0);
  await select('Wave spawn level', 1);
  await fill('Wave spawn X', 13.5);
  await fill('Wave spawn Y', 8.5);
  await select('Wave attack destination level', 1);
  await fill('Wave attack destination X', 13.5);
  await fill('Wave attack destination Y', 8.5);
  await page.getByRole('button', { name: 'Add timed wave', exact: true }).click();

  // An optional ground objective is the negative control for the cave arrival.
  await openSection('objectives');
  await openSection('objective-0');
  await page.getByLabel('Objective 1 optional', { exact: true }).check();
  await fill('Objective 1 text', 'Ground arrival must stay incomplete while the commander is underground.');
  await select('Objective 1 success type', 'at');
  await fill('Objective 1 success actor', 'commander');
  await select('Objective 1 success point level', 0);
  await fill('Objective 1 success point X', 11.5);
  await fill('Objective 1 success point Y', 9.5);
  await fill('Objective 1 success radius', 0.5);

  await openSection('events');
  await page.getByRole('button', { name: 'Add custom win condition', exact: true }).click();
  await openSection('event-1');
  await select('Event 2 trigger type', 'all');
  await select('Event 2 trigger condition 1 type', 'at');
  await fill('Event 2 trigger condition 1 actor', 'commander');
  await select('Event 2 trigger condition 1 point level', 1);
  await fill('Event 2 trigger condition 1 point X', 11.5);
  await fill('Event 2 trigger condition 1 point Y', 9.5);
  await fill('Event 2 trigger condition 1 radius', 0.5);
  await page.getByRole('button', { name: 'Add Event 2 trigger condition', exact: true }).click();
  await fill('Event 2 trigger condition 2 seconds', 2);

  const created = await exported('cave-scenario.json');
  assert.deepEqual(created.map, fixture, 'The scenario pins the exact imported map package');
  assert.deepEqual(created.scenario.map.world, fixture.map);
  assert.deepEqual(created.scenario.army[0], {
    label: 'commander', side: 0, kind: 'unit', role: 'melee', x: 11.5, y: 8.5, level: 1,
    order: { type: 'move', x: 11.5, y: 9.5, level: 1 },
  });
  assert.deepEqual(created.scenario.events[0], {
    id: 'wave-1', when: { type: 'time', seconds: 1 }, actions: [{ type: 'spawn', actors: [{
      label: 'wave-1-actor-1', side: 0, kind: 'unit', role: 'melee', x: 13.5, y: 8.5, level: 1,
      order: { type: 'attackMove', x: 13.5, y: 8.5, level: 1 },
    }] }],
  });
  assert.deepEqual(created.scenario.events[1].when, { type: 'all', conditions: [
    { type: 'at', actor: 'commander', point: { x: 11.5, y: 9.5, level: 1 }, radius: 0.5 },
    { type: 'time', seconds: 2 },
  ] });
  assert.equal(created.scenario.objectives[0].optional, true);
  assert.equal(created.scenario.objectives[0].success.point.level, 0);
  assert.equal(created.scenario.events[1].actions[0].outcome, 'won');
  checked('normal controls author a cave actor, move order, friendly wave and nested victory');

  await page.getByLabel('Import scenario package', { exact: true }).setInputFiles(path.join(evidence, 'cave-scenario.json'));
  await page.locator('.scenario-authoring [role=status]').filter({ hasText: /imported/ }).waitFor();
  const imported = await exported('cave-scenario-imported.json');
  assert.deepEqual(imported, created);
  checked('scenario export and import preserve the exact package and layered map');
  await openSection('events');
  await openSection('event-1');
  await page.getByLabel('Event 2 trigger condition 1 radius', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, 'cave-scenario-editor.png'), fullPage: true });

  await page.getByRole('button', { name: 'Play scenario', exact: true }).click();
  await page.waitForFunction(() => window.editorDiagnostics?.()?.scenario?.runtime.outcome === 'playing', null, { timeout: 15000, polling: 20 });
  const initial = await diagnostics();
  await save('cave-scenario-initial.json', initial);
  assert.equal(initial.packageHash, created.hash);
  assert.equal(initial.worldHash, fixture.contentHash);
  assert.deepEqual(initial.scenario.definition, created.scenario);
  assertWorld(initial);
  assertUniqueIds(initial);
  const initialActor = actorFrom(initial, 'commander');
  assert(initialActor.hp > 0);
  assert.equal(initialActor.level, 1);
  assert.deepEqual(initialActor.order, created.scenario.army[0].order);
  assert(Math.hypot(initialActor.x - 11.5, initialActor.y - 9.5) > 0.5, 'The initial commander has not already satisfied cave arrival');
  assert.equal(initial.scenario.runtime.triggers['custom-win-1'], undefined);
  timeline.push(sample(initial));
  checked('play retains both levels, terrain, cave resource, site and transition', { initialTick: initial.tick });

  const worldTools = page.locator('details.world-tools');
  await worldTools.waitFor({ state: 'visible' });
  if (!await worldTools.evaluate(element => element.open)) await worldTools.locator(':scope > summary').click();
  await worldTools.getByLabel('Map level', { exact: true }).selectOption('1');
  await page.waitForFunction(() => window.editorDiagnostics?.()?.viewLevel === 1);
  await page.screenshot({ path: path.join(evidence, 'cave-scenario-playing.png'), fullPage: true });
  checked('normal World tools select the cave view');

  let final, layerControl, arrivalScreenshot = false;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const snapshot = await diagnostics();
    const observation = sample(snapshot);
    timeline.push(observation);
    const commander = observation.commander;
    if (observation.outcome === 'playing' && observation.tick >= 10 && Math.hypot(commander.x - 11.5, commander.y - 9.5) <= 0.5) {
      assert.equal(commander.level, 1);
      assert(!observation.completed.includes(created.scenario.objectives[0].id), 'The ground-level counterpart remains incomplete');
      layerControl = snapshot;
      if (observation.wave && !arrivalScreenshot) {
        await page.screenshot({ path: path.join(evidence, 'cave-scenario-arrival.png'), fullPage: true });
        arrivalScreenshot = true;
      }
    }
    if (observation.outcome !== 'playing') { final = snapshot; break; }
    await page.waitForTimeout(20);
  }
  assert(final, 'The scenario completes within 15 seconds');
  assert(layerControl, 'A playing snapshot proves cave arrival without ground arrival');
  await save('cave-scenario-layer-control.json', layerControl);
  await save('cave-scenario-final.json', final);
  assertWorld(final);
  const ids = assertUniqueIds(final);
  await save('cave-scenario-runtime-ids.json', ids);
  const commander = actorFrom(final, 'commander');
  assert(commander.hp > 0);
  assert.equal(commander.level, 1);
  assert(Math.hypot(commander.x - 11.5, commander.y - 9.5) <= 0.5);
  const authoredStart = created.scenario.army[0];
  assert(Math.hypot(commander.x - authoredStart.x, commander.y - authoredStart.y) > 0.5, 'The initial move order moved the commander away from the authored spawn');
  assert(Math.hypot(commander.x - initialActor.x, commander.y - initialActor.y) > 0.25, 'Movement continued after the first browser observation');
  assert.equal(final.scenario.runtime.outcome, 'won');
  assert.equal(final.scenario.runtime.reason, 'Custom victory condition completed.');
  assert.equal(final.scenario.runtime.triggers['custom-win-1'].count, 1);
  assert(final.scenario.runtime.triggers['custom-win-1'].lastTime >= 2 - 1e-9);
  assert(!final.scenario.runtime.completed.includes(created.scenario.objectives[0].id));
  assert.equal(final.viewLevel, 1);
  checked('cave movement satisfies the level-aware condition while ground arrival stays false', {
    initial: { x: initialActor.x, y: initialActor.y, level: initialActor.level },
    reached: { x: commander.x, y: commander.y, level: commander.level },
    layerControlTick: layerControl.tick, victoryTick: final.tick,
  });

  const wave = actorFrom(final, 'wave-1-actor-1');
  assert(wave.hp > 0);
  assert.equal(wave.side, 0);
  assert.equal(wave.level, 1);
  assert.equal(wave.x, 13.5);
  assert.equal(wave.y, 8.5);
  assert.equal(final.scenario.runtime.triggers['wave-1'].count, 1);
  assert(final.scenario.runtime.triggers['wave-1'].lastTime >= 1 - 1e-9);
  assert(final.scenario.runtime.triggers['wave-1'].lastTime < final.scenario.runtime.triggers['custom-win-1'].lastTime);
  checked('friendly timed wave spawns in the cave and runtime object IDs stay unique', { waveId: wave.id, runtimeObjects: ids.length });
  await page.screenshot({ path: path.join(evidence, 'cave-scenario-victory.png'), fullPage: true });
  assert.deepEqual(errors, []);
  checked('browser has no uncaught errors');
} catch (error) {
  failure = String(error);
  await page.screenshot({ path: path.join(evidence, 'cave-scenario-verification-failure.png'), fullPage: true }).catch(() => {});
  await save('cave-scenario-verification-failure.json', {
    error: failure, diagnostics: await diagnostics().catch(() => null),
    fields: await page.locator('.scenario-authoring [aria-label]').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label'), visible: !!node.getClientRects().length }))),
    status: await page.locator('.scenario-authoring [role=status], .editor-status').allTextContents(),
  });
  throw error;
} finally {
  await save('cave-scenario-timeline.json', timeline);
  await save('result.json', { base, fixture: fixturePath, fixtureHash: fixture.hash, results, errors, failure, checkedAt: new Date().toISOString() });
  await browser.close();
}
