import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Runs the assembled application. No fixture route, source imports, state writes,
// private scene calls or mocked planning callbacks are used in the browser.
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const sourceRoot = resolve(process.argv[3] ?? '.');
const out = resolve(process.env.OVF_PLANNING_PROOF_OUTPUT ?? 'work/hundred-features/planning-main-proof');
await mkdir(out, { recursive: true });
const hash = createHash('sha256');
for (const path of (await readdir(`${sourceRoot}/src`, { recursive: true })).filter(path => /\.(ts|css)$/.test(path)).sort()) {
  hash.update(path); hash.update(await readFile(`${sourceRoot}/src/${path}`));
}
const expectedBuildId = hash.digest('hex');
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const evidence = {}, observations = {}, errors = [];
let step = 'start', buildId, page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  page.on('pageerror', error => errors.push(error.message));
  const planning = page.getByRole('dialog', { name: 'Settlement planning', exact: true });
  const sessions = page.getByRole('dialog', { name: 'Session tools', exact: true });
  const ready = async () => {
    await page.waitForFunction(() => {if(!document.querySelector('.loading-battle')?.hidden)return false;try{return !!window.rts?.camera&&!!document.querySelector('#game-canvas canvas');}catch{return false;}}, null, { timeout: 60000 });
  };
  const snap = () => page.evaluate(() => {
    const r = window.rts, s = r.state, side = r.viewSide ?? 0;
    const workers = s.entities.filter(e => e.side === side && e.hp > 0 && e.kind === 'unit' && e.role === 'worker').map(e => ({ id: e.id, x: e.x, y: e.y, order: { ...e.order }, carried: e.carried, carriedKind: e.carriedKind, queue: e.orderQueue ? e.orderQueue.map(o => ({ ...o })) : [] }));
    return { tick: s.tick, time: s.time, paused: r.paused, camera: r.camera, selected: [...r.selected], mode: r.mode, side,
      bank: { wood: s.players[side].wood, ore: s.players[side].ore, crystal: s.players[side].crystal }, workers,
      buildings: s.entities.filter(e => e.side === side && e.hp > 0 && e.kind === 'building').map(e => ({ id: e.id, role: e.role, x: e.x, y: e.y, progress: e.progress })),
      resources: s.resources.map(n => ({ id: n.id, kind: n.kind, x: n.x, y: n.y, amount: n.amount, visible: s.visible[side].has(Math.floor(n.y) * s.width + Math.floor(n.x)) })),
      plans: [...document.querySelectorAll('[data-blueprint-id]')].map(row => ({ id: row.dataset.blueprintId, status: row.dataset.planStatus, text: row.textContent })) };
  });
  const screenshot = name => page.screenshot({ path: `${out}/${name}.png` });
  const closePlanning = async () => { if (await planning.isVisible()) await planning.getByRole('button', { name: 'Close settlement planning', exact: true }).click(); };
  const closeSessions = async () => { if (await sessions.isVisible()) await sessions.getByRole('button', { name: 'Close session tools', exact: true }).click(); };
  const openPlanning = async () => { await closeSessions(); await page.locator('[data-planning-launch]').click(); await planning.waitFor({ state: 'visible' }); };
  const openSessions = async tab => { await closePlanning(); if (await sessions.isVisible()) await page.locator(`[data-session-tab="${tab}"]`).click(); else await page.locator(`[data-session-tool="${tab}"]`).click(); await sessions.waitFor({ state: 'visible' }); };
  const downloadJson = async (button, name) => {
    const pending = page.waitForEvent('download'); await button.click(); const download = await pending;
    const path = `${out}/${name}.json`; await download.saveAs(path); return JSON.parse(await readFile(path, 'utf8'));
  };
  const exportSave = async name => { await openSessions('saves'); return downloadJson(sessions.getByRole('button', { name: 'Export save', exact: true }), name); };
  const importSave = async (file, name) => {
    await openSessions('saves');
    await sessions.getByLabel('Import save JSON', { exact: true }).setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
    await sessions.getByRole('button', { name: 'Import save', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.session-notice')].some(e => e.textContent === 'Save loaded.'), null, { timeout: 60000 }); await ready();
  };
  const stored = name => page.evaluate(name => JSON.parse(localStorage.getItem('orcs-vs-fairies:sessions:v1')).slots.find(slot => slot.name === name).file, name);
  const saveNamed = async name => {
    await openSessions('saves'); await sessions.getByLabel('Save name', { exact: true }).fill(name); await sessions.getByRole('button', { name: 'Save match', exact: true }).click();
    await page.waitForFunction(name => JSON.parse(localStorage.getItem('orcs-vs-fairies:sessions:v1') ?? '{"slots":[]}').slots.some(slot => slot.name === name), name);
    const file = await stored(name); await writeFile(`${out}/${name.replaceAll(' ', '-').toLowerCase()}.json`, JSON.stringify(file, null, 2)); return file;
  };
  const loadNamed = async name => {
    await openSessions('saves'); await sessions.getByRole('button', { name: `Load ${name}`, exact: true }).click();
    await page.waitForFunction(name => [...document.querySelectorAll('.session-notice')].some(e => e.textContent === `Loaded ${name}.`), name, { timeout: 60000 }); await ready();
  };
  const screenPoint = (x, y, height = 0) => page.evaluate(({ x, y, height }) => {
    const c = window.rts.camera, canvas = document.querySelector('#game-canvas canvas'), rect = canvas.getBoundingClientRect();
    const wx = 1600 + 32 * (x - y), wy = 80 + 16 * (x + y) - height;
    const px = c.width / 2 + (wx - c.x - c.width / 2) * c.zoom, py = c.height / 2 + (wy - c.y - c.height / 2) * c.zoom;
    return { x: rect.left + px * rect.width / canvas.width, y: rect.top + py * rect.height / canvas.height };
  }, { x, y, height });
  const clickCanvas = async (point, options = {}) => {
    const canvas = page.locator('#game-canvas canvas'), box = await canvas.boundingBox(); assert(box);
    await canvas.click({ position: { x: point.x - box.x, y: point.y - box.y }, delay: 80, ...options });
  };
  const selectWorker = async id => {
    await closePlanning(); await closeSessions(); const worker = (await snap()).workers.find(w => w.id === id); assert(worker);
    const point = await screenPoint(worker.x, worker.y, 15); observations.lastSelection = { id, point, before: await snap() }; await clickCanvas(point); await page.waitForFunction(id => window.rts.selected.length === 1 && window.rts.selected[0] === id, id, { timeout: 3000 });
  };
  const fillTargets = async value => { for (const [kind, count] of Object.entries(value)) await planning.getByLabel(`${kind[0].toUpperCase() + kind.slice(1)} worker target`, { exact: true }).fill(String(count)); };
  const plans = () => planning.locator('[data-blueprint-id]');
  const numericBlueprint = async (role, x, y) => {
    const count = await plans().count(); await planning.getByLabel('Blueprint building', { exact: true }).selectOption(role);
    await planning.getByLabel('Blueprint X', { exact: true }).fill(String(x)); await planning.getByLabel('Blueprint Y', { exact: true }).fill(String(y));
    await planning.getByRole('button', { name: 'Add blueprint', exact: true }).click(); await page.waitForFunction(count => document.querySelectorAll('[data-blueprint-id]').length === count + 1, count);
    return await plans().last().getAttribute('data-blueprint-id');
  };
  const mapBlueprint = async (role, x, y) => {
    const count = await plans().count(); await planning.getByLabel('Blueprint building', { exact: true }).selectOption(role);
    await planning.getByRole('button', { name: 'Place on battlefield', exact: true }).click(); await planning.waitFor({ state: 'hidden' });
    const point = await screenPoint(x, y); await page.mouse.move(point.x, point.y); await clickCanvas(point); await planning.waitFor({ state: 'visible' });
    await page.waitForFunction(count => document.querySelectorAll('[data-blueprint-id]').length === count + 1, count);
    return await plans().last().getAttribute('data-blueprint-id');
  };
  const chooseWorker = async id => {
    const ids = (await snap()).workers.map(w => w.id); for (const worker of ids) await planning.getByRole('checkbox', { name: `Worker ${worker}`, exact: true }).setChecked(worker === id);
  };
  const assign = async (id, worker) => {
    await chooseWorker(worker); await planning.getByRole('button', { name: `Assign selected workers to blueprint ${id}`, exact: true }).click();
    await page.waitForFunction(({ id, worker }) => document.querySelector(`[data-blueprint-id="${id}"] .planning-plan-workers`)?.textContent === `Assigned workers: ${worker}`, { id, worker });
  };
  const planFor = (file, id) => file.planning.players[0].construction.blueprints.find(p => p.id === id);
  const workerOrders = snapshot => snapshot.workers.map(w => ({ id: w.id, order: w.order, queue: w.queue }));

  await page.goto(`${base}/?art=placeholder`); assert.equal(new URL(page.url()).pathname, '/');
  await page.locator('[data-faction="orcs"]').click(); await page.locator('#map-size').selectOption('medium'); await page.locator('#map-seed').fill('4127'); await page.locator('.begin-match').click(); await ready();
  const seedFile = await exportSave('seed-session');
  const scenario = structuredClone(seedFile); scenario.game.state.controllers.fill('external'); delete scenario.replay; delete scenario.planning;
  await writeFile(`${out}/scenario.json`, JSON.stringify(scenario, null, 2)); await importSave(scenario, 'planning-scenario'); await closeSessions();
  observations.initial = await snap(); assert(observations.initial.workers.every(w => w.order.type === 'idle'));
  const targets = { wood: 2, ore: 2, crystal: 1 }, workers = observations.initial.workers.map(w => w.id);
  assert.equal(workers.length, 5);

  step = 'inactive targets and manual gathering'; await openPlanning(); const beforeTargets = await snap(); await fillTargets(targets); await planning.getByRole('button', { name: 'Save worker targets', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.planning-tools .session-notice')].some(e => e.textContent.includes('Worker targets saved')));
  assert.deepEqual(workerOrders(await snap()), workerOrders(beforeTargets)); assert.deepEqual((await snap()).bank, beforeTargets.bank);
  const inactive = await saveNamed('Planning inactive'); assert.deepEqual(inactive.planning.players[0].targets, targets); assert.deepEqual(inactive.planning.automaticSides, []); evidence.savedTargetsDoNotActivate = true;
  await selectWorker(workers[0]); const manual = await snap(); const worker = manual.workers.find(w => w.id === workers[0]);
  const wood = manual.resources.filter(n => n.kind === 'wood' && n.amount > 0 && n.visible).sort((a, b) => Math.hypot(a.x - worker.x, a.y - worker.y) - Math.hypot(b.x - worker.x, b.y - worker.y))[0]; assert(wood);
  const woodPoint = await screenPoint(wood.x, wood.y, 15); await clickCanvas(woodPoint, { button: 'right' });
  await page.waitForFunction(({ id, target }) => { const w = window.rts.state.entities.find(e => e.id === id); return w.order.type === 'gather' && w.order.target === target; }, { id: workers[0], target: wood.id });
  const manualTick = (await snap()).tick; await page.waitForFunction(tick => window.rts.state.tick >= tick + 25, manualTick);
  observations.manual = await snap(); assert(observations.manual.workers.filter(w => w.id !== workers[0]).every(w => w.order.type === 'idle'));
  const manualFile = await saveNamed('Manual inactive'); assert.deepEqual(manualFile.planning.automaticSides, []); evidence.manualGatherRemainsUnderPlayerControl = true;

  step = 'real allocation and gathering income'; await loadNamed('Planning inactive'); await openPlanning(); await planning.getByRole('button', { name: 'Apply worker targets', exact: true }).click();
  await page.waitForFunction(() => { const s = window.rts.state, counts = { wood: 0, ore: 0, crystal: 0 }; for (const w of s.entities.filter(e => e.side === 0 && e.role === 'worker')) { if (w.order.type !== 'gather') return false; const node = s.resources.find(n => n.id === w.order.target); if (!node || !s.visible[0].has(Math.floor(node.y) * s.width + Math.floor(node.x))) return false; counts[node.kind]++; } return counts.wood === 2 && counts.ore === 2 && counts.crystal === 1; });
  observations.allocated = await snap(); const allocatedBank = observations.allocated.bank; await closePlanning();
  await page.waitForFunction(bank => { const p = window.rts.state.players[0]; return p.wood > bank.wood && p.ore > bank.ore && p.crystal > bank.crystal; }, allocatedBank, { timeout: 60000 });
  observations.income = await snap(); evidence.targetsProduceDeliveredIncome = true;
  const active = await saveNamed('Planning active'); assert.deepEqual(active.planning.players[0].targets, targets); assert(active.planning.automaticSides.includes(0));
  await loadNamed('Planning inactive'); await loadNamed('Planning active'); const activeCopy = await saveNamed('Planning active restored');
  assert.deepEqual(activeCopy.game, active.game); assert.deepEqual(activeCopy.planning, active.planning); assert.equal(activeCopy.replay.finalChecksum, active.replay.finalChecksum); evidence.activeAllocationPersistsThroughSaveLoad = true;
  const restoredGatherer = (await snap()).workers.find(w => w.carried === 0 && w.order.type === 'gather'); assert(restoredGatherer);
  await selectWorker(restoredGatherer.id); await page.keyboard.press('x');
  await page.waitForFunction(id => window.rts.state.entities.find(e => e.id === id)?.order.type === 'idle', restoredGatherer.id, { timeout: 3000 });
  observations.stoppedAfterRestore = await snap();
  await page.waitForFunction(({ id, tick }) => window.rts.state.tick >= tick + 25 && window.rts.state.entities.find(e => e.id === id)?.order.type === 'gather', { id: restoredGatherer.id, tick: observations.stoppedAfterRestore.tick }, { timeout: 10000 });
  observations.allocationResumedAfterRestore = await snap(); const restoredCounts = { wood: 0, ore: 0, crystal: 0 };
  for (const worker of observations.allocationResumedAfterRestore.workers) { assert.equal(worker.order.type, 'gather'); const node = observations.allocationResumedAfterRestore.resources.find(n => n.id === worker.order.target); assert(node?.visible); restoredCounts[node.kind]++; }
  assert.deepEqual(restoredCounts, targets); evidence.restoredAllocationResumesPeriodicOrders = true;

  step = 'blueprints and real scene placement'; await loadNamed('Planning inactive'); await selectWorker(workers.at(-1));
  const ghostPoint = await screenPoint(11.5, 6.5), clip = { x: Math.round(ghostPoint.x - 85), y: Math.round(ghostPoint.y - 55), width: 170, height: 110 };
  const beforeGhost = await page.screenshot({ clip, path: `${out}/site-before-plan.png` });
  await openPlanning(); await planning.getByRole('button', { name: 'Use battlefield selection', exact: true }).click();
  assert(await planning.getByRole('checkbox', { name: `Worker ${workers.at(-1)}`, exact: true }).isChecked()); evidence.battlefieldSelectionFeedsWorkerPicker = true;
  const beforePlans = await snap(), preview = planning.locator('canvas[aria-label="Planned construction preview"]'), previewBefore = await preview.screenshot();
  const first = await numericBlueprint('depot', 11.5, 6.5), second = await numericBlueprint('depot', 8.5, 13.5), numericGate = await numericBlueprint('gate', 13.24, 10.78);
  const clickedDepot = await mapBlueprint('depot', 11.24, 15.76), clickedGate = await mapBlueprint('gate', 10.24, 14.76);
  const count = await plans().count(); await planning.getByRole('button', { name: 'Place on battlefield', exact: true }).click(); await planning.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-planning-launch')), true, 'Placement cancellation must work from the naturally restored launcher focus.');
  await page.keyboard.press('Escape'); await planning.waitFor({ state: 'visible' }); assert.equal(await plans().count(), count); evidence.nativePlacementEscapeKeepsPlans = true;
  observations.planned = await snap(); assert.deepEqual(observations.planned.bank, beforePlans.bank); assert.deepEqual(observations.planned.buildings, beforePlans.buildings); assert.deepEqual(workerOrders(observations.planned), workerOrders(beforePlans));
  const previewAfter = await preview.screenshot({ path: `${out}/plan-preview.png` }); assert.notDeepEqual(previewAfter, previewBefore); evidence.planPreviewChangesPixels = true;
  const plannedTick = observations.planned.tick; await closePlanning(); await page.waitForFunction(tick => window.rts.state.tick >= tick + 25, plannedTick);
  observations.plannedWhileRunning = await snap(); assert.deepEqual(observations.plannedWhileRunning.bank, beforePlans.bank); assert.deepEqual(observations.plannedWhileRunning.buildings, beforePlans.buildings); assert.deepEqual(workerOrders(observations.plannedWhileRunning), workerOrders(beforePlans));
  const afterGhost = await page.screenshot({ clip, path: `${out}/site-with-plan.png` }); assert.notDeepEqual(afterGhost, beforeGhost); await screenshot('battlefield-plans'); evidence.closedPanelDrawsBattlefieldPlans = true;
  const deferred = await saveNamed('Deferred plans');
  for (const id of [first, second, numericGate, clickedDepot, clickedGate]) { const p = planFor(deferred, id); assert(p); assert.equal(p.status, 'planned'); assert.deepEqual(p.workerIds, []); assert.equal(p.buildingId, undefined); }
  assert.deepEqual({ x: planFor(deferred, numericGate).x, y: planFor(deferred, numericGate).y }, { x: 13, y: 11 });
  assert.deepEqual({ x: planFor(deferred, clickedDepot).x, y: planFor(deferred, clickedDepot).y }, { x: 11.5, y: 15.5 });
  assert.deepEqual({ x: planFor(deferred, clickedGate).x, y: planFor(deferred, clickedGate).y }, { x: 10, y: 15 }); evidence.numericAndNativeGateCoordinatesSnap = true; evidence.blueprintsDoNotSpendOrSpawn = true;

  step = 'assignment and construction identity'; await openPlanning(); const beforeAssign = await snap(); await assign(first, workers.at(-1)); await assign(second, workers.at(-2));
  assert.deepEqual((await snap()).bank, beforeAssign.bank); assert.deepEqual(workerOrders(await snap()), workerOrders(beforeAssign)); assert.deepEqual((await snap()).buildings, beforeAssign.buildings);
  const assignedTick = (await snap()).tick; await closePlanning(); await page.waitForFunction(tick => window.rts.state.tick >= tick + 25, assignedTick);
  observations.assignedWhileRunning = await snap(); assert.deepEqual(observations.assignedWhileRunning.bank, beforeAssign.bank); assert.deepEqual(workerOrders(observations.assignedWhileRunning), workerOrders(beforeAssign)); assert.deepEqual(observations.assignedWhileRunning.buildings, beforeAssign.buildings); evidence.assignmentDoesNotIssueBuildOrders = true;
  await openPlanning();
  const frozen = await snap(); for (const key of ['p', 'ArrowRight', 'x', 'F2']) await page.keyboard.press(key); await page.waitForTimeout(120); const blocked = await snap();
  assert.equal(blocked.tick, frozen.tick); assert.equal(blocked.time, frozen.time); assert.equal(blocked.paused, true); assert.deepEqual(blocked.camera, frozen.camera); assert.deepEqual(blocked.selected, frozen.selected); assert.deepEqual(workerOrders(blocked), workerOrders(frozen)); evidence.planningModalBlocksGameplay = true;
  await planning.getByRole('button', { name: 'Construct assigned plans', exact: true }).click();
  await page.waitForFunction(count => window.rts.state.entities.filter(e => e.side === 0 && e.kind === 'building' && e.hp > 0).length === count + 2, beforeAssign.buildings.length);
  observations.constructed = await snap(); const foundations = observations.constructed.buildings.filter(b => !beforeAssign.buildings.some(old => old.id === b.id));
  assert.equal(foundations.length, 2); assert(foundations.every(b => b.role === 'depot' && b.progress === 0)); assert.equal(observations.constructed.bank.wood, beforeAssign.bank.wood - 200); assert.equal(observations.constructed.bank.ore, beforeAssign.bank.ore); assert.equal(observations.constructed.bank.crystal, beforeAssign.bank.crystal);
  await screenshot('constructed-foundations');
  const constructed = await saveNamed('Constructed plans');
  for (const [id, worker] of [[first, workers.at(-1)], [second, workers.at(-2)]]) {
    const p = planFor(constructed, id), foundation = constructed.game.state.entities.find(e => e.id === p.buildingId), builder = constructed.game.state.entities.find(e => e.id === worker);
    assert.equal(p.status, 'building'); assert.deepEqual(p.workerIds, [worker]); assert(foundation && foundation.role === p.role && foundation.x === p.x && foundation.y === p.y); assert.deepEqual(builder.order, { type: 'build', target: p.buildingId });
  }
  assert.notEqual(planFor(constructed, first).buildingId, planFor(constructed, second).buildingId); evidence.blueprintFoundationAndOrderIdsMatch = true;
  await loadNamed('Deferred plans'); await loadNamed('Constructed plans'); const restored = await saveNamed('Constructed restored'); assert.deepEqual(restored.game, constructed.game); assert.deepEqual(restored.planning, constructed.planning); assert.equal(restored.replay.finalChecksum, constructed.replay.finalChecksum); evidence.targetsAndPlansPersistThroughSaveLoad = true;

  step = 'photo and replay restrictions'; await selectWorker(workers.at(-1)); await page.keyboard.press('F9'); await page.locator('.photo-controls:not([hidden])').waitFor({ state: 'visible' }); const photo = await snap();
  assert.equal(photo.workers.find(w => w.id === workers.at(-1)).order.type, 'build');
  assert.equal(await page.locator('[data-planning-launch]').isVisible(), false); for (const key of ['p', 'x', 'F2']) await page.keyboard.press(key); await clickCanvas(await screenPoint(12.5, 12.5), { button: 'right' }); await page.waitForTimeout(120); assert.equal((await snap()).tick, photo.tick); assert.deepEqual(workerOrders(await snap()), workerOrders(photo)); await screenshot('photo-mode'); evidence.photoModeDisablesPlanningAndOrders = true;
  await page.getByRole('button', { name: 'Exit photo mode', exact: true }).click(); await openSessions('replay');
  await sessions.getByLabel('Import replay JSON', { exact: true }).setInputFiles({ name: 'constructed-replay.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(constructed.replay)) }); await sessions.getByRole('button', { name: 'Import replay', exact: true }).click();
  await page.waitForFunction(() => { try { return window.rts?.mode === 'replay' && [...document.querySelectorAll('.session-notice')].some(e => e.textContent === 'Replay loaded.'); } catch { return false; } }, null, { timeout: 60000 }); await ready(); await openPlanning();
  for (const name of ['Save worker targets', 'Apply worker targets', 'Add blueprint', 'Place on battlefield', 'Construct assigned plans']) assert.equal(await planning.getByRole('button', { name, exact: true }).isEnabled(), false, `${name} must be disabled in replay.`);
  const replay = await snap(); for (const key of ['p', 'ArrowRight', 'x', 'F2']) await page.keyboard.press(key); await page.waitForTimeout(120); const replayHeld = await snap(); assert.equal(replayHeld.tick, replay.tick); assert.deepEqual(replayHeld.camera, replay.camera); assert.deepEqual(workerOrders(replayHeld), workerOrders(replay)); await screenshot('replay-planning-disabled'); evidence.replayDisablesPlanningAndModalGameplay = true;
  await openSessions('replay'); await sessions.getByLabel('Replay tick', { exact: true }).press('End');
  await page.waitForFunction(tick => { try { return window.rts.state.tick === tick; } catch { return false; } }, constructed.replay.finalTick, { timeout: 60000 }); await ready(); await selectWorker(workers.at(-1));
  const replayOrders = await snap(); assert.equal(replayOrders.workers.find(w => w.id === workers.at(-1)).order.type, 'build');
  await page.keyboard.press('x'); await clickCanvas(await screenPoint(12.5, 12.5), { button: 'right' }); await page.waitForTimeout(120); const replayUnchanged = await snap();
  assert.equal(replayUnchanged.tick, replayOrders.tick); assert.deepEqual(workerOrders(replayUnchanged), workerOrders(replayOrders)); assert.deepEqual(replayUnchanged.bank, replayOrders.bank); await screenshot('replay-orders-disabled'); evidence.replayRejectsNativeOrdersWithModalClosed = true;

  step = 'production build identity'; await openSessions('report'); await sessions.getByLabel('Bug description', { exact: true }).fill('Assembled planning verification');
  const report = await downloadJson(sessions.getByRole('button', { name: 'Download bug report', exact: true }), 'production-report'); buildId = report.versions.buildId; assert.equal(buildId, expectedBuildId, 'The production build does not match the inspected source. Rebuild before rerunning.'); evidence.productionBuildMatchesSource = true;
  assert.deepEqual(errors, []); observations.final = await snap();
  await writeFile(`${out}/proof.json`, JSON.stringify({ complete: true, base, sourceRoot, buildId, evidence, observations, errors }, null, 2)); console.log(JSON.stringify({ complete: true, buildId, evidence, errors }));
} catch (error) {
  if(page){await page.screenshot({path:`${out}/failure.png`});observations.failure=await page.evaluate(()=>({rts:window.rts?{paused:window.rts.paused,selected:window.rts.selected,camera:window.rts.camera,tick:window.rts.state.tick}:null,active:{tag:document.activeElement?.tagName,id:document.activeElement?.id,text:document.activeElement?.tagName==='BODY'?'':document.activeElement?.textContent},dialogs:[...document.querySelectorAll('[role="dialog"]')].map(e=>({name:e.getAttribute('aria-label'),hidden:!!e.closest('[hidden]')})),canvas:document.querySelector('#game-canvas canvas')?.getBoundingClientRect().toJSON()}));}
  await writeFile(`${out}/proof.json`, JSON.stringify({ complete: false, base, sourceRoot, expectedBuildId, buildId, step, evidence, observations, errors, failure: error.stack ?? String(error) }, null, 2)); throw error;
} finally { await browser.close(); }
