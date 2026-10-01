import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

/** Reusable proof against the test fixture's real simulation. The browser is supplied by the caller. */
export async function verifyPlanning(page, baseUrl = 'http://127.0.0.1:5294', readBrowserErrors, capture) {
  const errors = [];
  if (typeof page.on === 'function') page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/scripts/planning/fixture.html?art=placeholder`);
  await page.locator('#proof-data').filter({ hasText: '"ready":true' }).waitFor({ state: 'attached' });
  // Reading text also works with CUA's read-only DOM scope. Parse in the caller's
  // realm so prototype differences cannot make equal browser values fail checks.
  const snap = async () => JSON.parse(await page.evaluate(() => document.querySelector('#proof-data').textContent));
  const evidence = {};
  const launcher = page.locator('[data-planning-launch]');
  const dialog = page.getByRole('dialog', { name: 'Settlement planning' });
  const close = () => dialog.getByRole('button', { name: 'Close settlement planning', exact: true }).click();
  const open = async () => { await launcher.click(); await dialog.waitFor({ state: 'visible' }); };
  const selectWorker = async n => { await page.getByRole('button', { name: `Select fixture worker ${n}`, exact: true }).click(); };
  const add = async (site, role = 'depot') => {
    await dialog.getByLabel('Blueprint building', { exact: true }).selectOption(role);
    await dialog.getByLabel('Blueprint X', { exact: true }).fill(String(site.x));
    await dialog.getByLabel('Blueprint Y', { exact: true }).fill(String(site.y));
    await dialog.getByRole('button', { name: 'Add blueprint', exact: true }).click();
  };
  const row = id => dialog.locator(`[data-blueprint-id="${id}"]`);
  const assign = id => row(id).getByRole('button', { name: `Assign selected workers to blueprint ${id}`, exact: true }).click();
  const chooseWorker = async id => {
    for (const workerId of initial.workerIds) {
      const checkbox = dialog.getByRole('checkbox', { name: `Worker ${workerId}`, exact: true });
      if (workerId === id) await checkbox.check(); else await checkbox.uncheck();
    }
  };

  const initial = await snap();
  await page.waitForTimeout(150);
  assert((await snap()).tick > initial.tick, 'The real simulation must run before modal proof.');
  await selectWorker(1);
  await open();
  const modal = await snap();
  assert.equal(modal.paused, true);
  assert.equal(modal.inputBlocked, true);
  await dialog.getByRole('button', { name: 'Close settlement planning', exact: true }).press('p');
  await dialog.getByRole('button', { name: 'Close settlement planning', exact: true }).press('ArrowRight');
  await dialog.getByRole('button', { name: 'Close settlement planning', exact: true }).press('x');
  await dialog.getByRole('button', { name: 'Close settlement planning', exact: true }).press('F2');
  await page.waitForTimeout(100);
  const held = await snap();
  assert.equal(held.tick, modal.tick);
  assert.equal(held.time, modal.time);
  assert.deepEqual(held.camera, modal.camera);
  assert.deepEqual(held.workers, modal.workers);
  assert.deepEqual(held.resources, modal.resources);
  assert.deepEqual(held.commands, modal.commands);
  assert.deepEqual(held.selected, modal.selected);
  evidence.runningModalPausesAndBlocksScene = true;

  for (const [kind, count] of [['Wood', 2], ['Ore', 2], ['Crystal', 1]]) {
    await dialog.getByLabel(`${kind} worker target`, { exact: true }).fill(String(count));
  }
  await dialog.getByRole('button', { name: 'Save worker targets', exact: true }).click();
  const savedTargets = await snap();
  assert.deepEqual(savedTargets.targets, { wood: 2, ore: 2, crystal: 1 });
  assert.deepEqual(savedTargets.workers.map(worker => worker.order), modal.workers.map(worker => worker.order));
  await dialog.getByRole('button', { name: 'Apply worker targets', exact: true }).click();
  const allocated = await snap();
  assert.deepEqual(allocated.gatherCounts, { wood: 2, ore: 2, crystal: 1 });
  assert(allocated.workers.every(worker => worker.order.type === 'gather' && worker.targetVisible && worker.targetActive));
  assert(allocated.commands.some(record => record.command.type === 'gather' && record.accepted));
  evidence.workerTargetsReachSimulation = true;

  await add(initial.sites[0]);
  await add(initial.sites[1]);
  const planned = await snap();
  assert.equal(planned.blueprints.length, 2);
  assert.deepEqual(planned.resources, allocated.resources);
  assert.equal(planned.buildings.length, allocated.buildings.length);
  assert.deepEqual(planned.workers, allocated.workers);
  assert.deepEqual(planned.commands, allocated.commands);
  assert(planned.blueprints.every(blueprint => blueprint.workerIds.length === 0));
  assert.equal(planned.preview.length, 2);
  assert.equal(await dialog.locator('canvas[aria-label="Planned construction preview"]').count(), 1);
  evidence.blueprintsDoNotSpendOrSpawn = true;

  await chooseWorker(initial.workerIds[0]);
  await assign(planned.blueprints[0].id);
  await chooseWorker(initial.workerIds[1]);
  await assign(planned.blueprints[1].id);
  const assigned = await snap();
  assert.deepEqual(assigned.blueprints[0].workerIds, [initial.workerIds[0]]);
  assert.deepEqual(assigned.blueprints[1].workerIds, [initial.workerIds[1]]);
  assert.deepEqual(assigned.resources, planned.resources);
  assert.deepEqual(assigned.workers, planned.workers);
  assert.deepEqual(assigned.commands, planned.commands);
  evidence.selectedWorkersAssignedWithoutPayment = true;

  await dialog.getByRole('button', { name: 'Construct assigned plans', exact: true }).click();
  const constructed = await snap();
  const newBuildings = constructed.buildings.filter(building => !initial.buildings.some(existing => existing.id === building.id));
  assert.equal(newBuildings.length, 2);
  assert(newBuildings.every(building => building.role === 'depot' && building.progress === 0));
  assert.equal(new Set(newBuildings.map(building => building.id)).size, 2);
  const cost = initial.depotCost;
  for (const kind of ['wood', 'ore', 'crystal']) {
    assert.equal(constructed.resources[kind], assigned.resources[kind] - 2 * cost[kind]);
  }
  for (let i = 0; i < 2; i++) {
    const worker = constructed.workers.find(item => item.id === initial.workerIds[i]);
    assert.equal(worker.order.type, 'build');
    assert(newBuildings.some(building => building.id === worker.order.target));
  }
  assert.notEqual(constructed.workers[0].order.target, constructed.workers[1].order.target);
  assert.equal(constructed.commands.filter(record => record.command.type === 'build' && record.accepted).length, 2);
  evidence.assignedPlansSpawnAndChargeOnce = true;
  if (capture) await capture('constructed');

  await add(initial.sites[2]);
  const pending = (await snap()).blueprints.find(item => !item.buildingId);
  assert(pending, 'The third blueprint must remain a plan.');
  await chooseWorker(initial.workerIds[2]);
  await assign(pending.id);
  const poor = await snap();
  await dialog.getByRole('button', { name: 'Construct assigned plans', exact: true }).click();
  const rejected = await snap();
  assert.equal(rejected.buildings.length, poor.buildings.length);
  assert.deepEqual(rejected.resources, poor.resources);
  assert(rejected.blueprints.some(item => item.id === pending.id && !item.buildingId));
  assert.match(rowText(await row(pending.id).textContent()), /resources|wood|afford/i);
  evidence.unaffordablePlanRetained = true;
  if (capture) await capture('pending');

  await close();
  assert.equal((await snap()).paused, false, 'Closing must restore a previously running match.');
  const afterFirstClose = await snap();
  await page.waitForTimeout(100);
  assert((await snap()).tick > afterFirstClose.tick);
  await page.getByRole('button', { name: 'Toggle fixture pause', exact: true }).click();
  assert.equal((await snap()).paused, true);
  await page.getByRole('button', { name: 'Fund fixture with 100 wood', exact: true }).click();
  await open();
  await dialog.getByRole('button', { name: 'Construct assigned plans', exact: true }).click();
  const funded = await snap();
  assert.equal(funded.buildings.length, rejected.buildings.length + 1);
  assert.equal(funded.resources.wood, rejected.resources.wood);
  const retried = funded.blueprints.find(item => item.id === pending.id);
  assert.equal(retried.status, 'building');
  assert(retried.buildingId);
  const newFoundation = funded.buildings.find(item => item.id === retried.buildingId);
  assert(newFoundation);
  assert.equal(newFoundation.role, pending.role);
  assert.equal(newFoundation.x, pending.x);
  assert.equal(newFoundation.y, pending.y);
  const retriedWorker = funded.workers.find(item => item.id === initial.workerIds[2]);
  assert.deepEqual(retriedWorker.order, { type: 'build', target: retried.buildingId });
  assert.equal(funded.commands.filter(record => record.command.type === 'build' && record.accepted).length, 3);
  evidence.retainedPlanCanBeRetried = true;
  await close();
  assert.equal((await snap()).paused, true, 'Closing must preserve a previously paused match.');

  await page.getByRole('button', { name: 'Toggle fixture read-only', exact: true }).click();
  await open();
  for (const name of ['Save worker targets', 'Apply worker targets', 'Add blueprint', 'Construct assigned plans']) {
    assert.equal(await dialog.getByRole('button', { name, exact: true }).isEnabled(), false);
  }
  const readOnly = await snap();
  await close();
  assert.deepEqual((await snap()).resources, readOnly.resources);
  evidence.readOnlyActionsDisabled = true;
  await page.getByRole('button', { name: 'Toggle fixture read-only', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle fixture pause', exact: true }).click();
  const resumed = await snap();
  await page.waitForTimeout(150);
  assert((await snap()).tick > resumed.tick);
  evidence.modalRestoresRunningAndPausedIntent = true;
  if (readBrowserErrors) errors.push(...await readBrowserErrors());
  assert.deepEqual(errors, []);
  return { evidence, errors, final: await snap() };
}

function rowText(text) { return text ?? ''; }

/** Verify the host's optional canvas placement adapter adds metadata without a build order. */
export async function verifyPlanningPlacement(page, clickCanvas, baseUrl = 'http://127.0.0.1:5294') {
  await page.goto(`${baseUrl}/scripts/planning/fixture.html?art=placeholder`);
  await page.locator('#proof-data').filter({ hasText: '"ready":true' }).waitFor({ state: 'attached' });
  const snap = async () => JSON.parse(await page.evaluate(() => document.querySelector('#proof-data').textContent));
  const dialog = page.getByRole('dialog', { name: 'Settlement planning' });
  const initial = await snap();
  await page.locator('[data-planning-launch]').click();
  await dialog.getByLabel('Blueprint building', { exact: true }).selectOption('depot');
  await dialog.getByRole('button', { name: 'Place on battlefield', exact: true }).click();
  assert.equal(await dialog.isVisible(), false);
  assert.equal((await snap()).inputBlocked, true);
  const point = initial.siteScreens[0];
  await clickCanvas(point.x, point.y);
  await dialog.waitFor({ state: 'visible' });
  const placed = await snap();
  assert.equal(placed.blueprints.length, 1);
  assert.equal(placed.blueprints[0].role, 'depot');
  assert.equal(placed.blueprints[0].x, initial.sites[0].x);
  assert.equal(placed.blueprints[0].y, initial.sites[0].y);
  assert.deepEqual(placed.resources, initial.resources);
  assert.equal(placed.buildings.length, initial.buildings.length);
  assert.equal(placed.commands.length, 0);
  assert.equal(placed.paused, true);
  assert.equal(placed.inputBlocked, true);
  await dialog.getByRole('button', { name: 'Place on battlefield', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle fixture pause', exact: true }).press('Escape');
  await dialog.waitFor({ state: 'visible' });
  const canceled = await snap();
  assert.equal(canceled.blueprints.length, 1);
  assert.deepEqual(canceled.resources, initial.resources);
  assert.equal(canceled.commands.length, 0);
  return { evidence: { canvasPlacementAddsOnlyBlueprint: true, canvasPlacementCancellationKeepsPlan: true }, placed, canceled };
}

// Optional standalone runner for local QA. Agent browser interactions use cua_repl.
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
    await mkdir('work', { recursive: true });
    const proof = await verifyPlanning(page, process.argv[2], undefined, name => page.screenshot({ path: `work/planning-${name}.png` }));
    await page.screenshot({ path: 'work/planning-proof.png' });
    const placement = await verifyPlanningPlacement(page, (x, y) => page.mouse.click(x, y), process.argv[2]);
    await page.screenshot({ path: 'work/planning-placement.png' });
    await writeFile('work/planning-proof.json', JSON.stringify({ ...proof, placement }, null, 2));
    console.log(JSON.stringify({ ...proof.evidence, ...placement.evidence }));
  } finally {
    await browser.close();
  }
}
