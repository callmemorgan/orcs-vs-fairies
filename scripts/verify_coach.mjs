import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

/** The caller supplies a browser page. Agent browser actions use a CUA page adapter. */
export async function verifyCoach(page, baseUrl = 'http://127.0.0.1:5297', readBrowserErrors, capture) {
  const errors = [], evidence = {}, snapshots = {};
  if (typeof page.on === 'function') page.on('pageerror', error => errors.push(error.message));
  const load = async scenario => {
    await page.goto(`${baseUrl}/scripts/coach/fixture.html?art=placeholder&proof=${scenario}`);
    await page.locator('#proof-data').filter({ hasText: '"ready":true' }).waitFor({ state: 'attached' });
  };
  const snap = async () => {
    await page.waitForTimeout(50);
    return JSON.parse(await page.locator('#proof-data').textContent());
  };
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const advance30 = () => click('Advance fixture by 30 seconds');
  const advice = (state, topic) => state.generatedAdvice.find(item => item.id === topic);
  const rendered = (state, topic) => state.renderedTopics.includes(topic);
  const orders = state => ({ workers: state.workers.map(worker => worker.order), army: state.army.map(unit => unit.order), queues: state.buildings.map(building => building.queue) });
  const money = state => ({ wood: state.player.wood, ore: state.player.ore, crystal: state.player.crystal });

  await load('controls');
  const initial = await snap();
  assert.deepEqual(initial.controllers, ['human', 'ai']);
  assert.equal(initial.paused, false);
  await page.waitForTimeout(150);
  const running = await snap();
  assert(running.tick > initial.tick && running.time > initial.time, 'The normal scene must advance a human-versus-AI match.');
  await click('Pause fixture match');
  await advance30();
  const idle = await snap();
  assert.equal(idle.paused, true);
  assert(rendered(idle, 'idle-workers'));
  assert(rendered(idle, 'idle-production'));
  assert.match(advice(idle, 'idle-workers').message, new RegExp(`${idle.workers.length} workers`));
  assert.deepEqual(advice(idle, 'idle-workers').entityIds, idle.workers.map(worker => worker.id));
  snapshots.idle = idle;
  evidence.runningLocalMatchProducesOwnedAdvice = true;

  await click('Show Workers need orders');
  const focused = await snap();
  assert.deepEqual(focused.selected, advice(idle, 'idle-workers').entityIds);
  assert.equal(focused.focusEvents.length, idle.focusEvents.length + 1);
  assert.deepEqual(focused.focusEvents.at(-1).point, advice(idle, 'idle-workers').point);
  assert.notDeepEqual(focused.camera, idle.camera, 'Show must center the real game camera.');
  assert.deepEqual(orders(focused), orders(idle));
  assert.deepEqual(money(focused), money(idle));
  assert.deepEqual(focused.commands, idle.commands);
  evidence.showSelectsAndCentersWithoutOrders = true;
  if (capture) await capture('focus');

  await click('Dismiss Workers need orders');
  const dismissed = await snap();
  assert.equal(rendered(dismissed, 'idle-workers'), false);
  assert.equal(dismissed.preferences.cooldownSeconds, 60);
  await page.waitForTimeout(150);
  const pausedDismissal = await snap();
  assert.equal(pausedDismissal.time, dismissed.time);
  assert.equal(rendered(pausedDismissal, 'idle-workers'), false);
  await advance30();
  const halfway = await snap();
  assert.equal(rendered(halfway, 'idle-workers'), false);
  await advance30();
  await click('Advance fixture by 1 second');
  const expired = await snap();
  assert(expired.time >= dismissed.time + 60);
  assert(rendered(expired, 'idle-workers'), 'Unresolved advice must return when its match-time cooldown expires.');
  evidence.dismissalPausesAndExpiresInMatchTime = true;
  snapshots.dismissal = { dismissed, halfway, expired };

  const enabled = page.getByRole('checkbox', { name: 'Enable practice coach', exact: true });
  await enabled.uncheck();
  await page.getByText('Coach settings', { exact: true }).click();
  await page.getByLabel('Dismiss advice for', { exact: true }).selectOption('30');
  const disabled = await snap();
  assert.deepEqual(disabled.preferences, { version: 1, enabled: false, cooldownSeconds: 30 });
  assert.deepEqual(disabled.renderedTopics, []);
  assert.equal(disabled.preferenceStorage, 'localStorage');
  const storedEntries = Object.entries(disabled.storedPreferences);
  assert.equal(storedEntries.length, 1);
  assert(storedEntries[0][0].startsWith('coach-proof/controls/'));
  assert.deepEqual(JSON.parse(storedEntries[0][1]), disabled.preferences);
  await click('Remount fixture coach');
  const remounted = await snap();
  assert.deepEqual(remounted.preferences, disabled.preferences);
  assert.deepEqual(remounted.storedPreferences, disabled.storedPreferences);
  assert.deepEqual(remounted.renderedTopics, []);
  await page.getByRole('checkbox', { name: 'Enable practice coach', exact: true }).check();
  const reenabled = await snap();
  assert(reenabled.renderedTopics.length > 0);
  assert.equal(reenabled.preferences.cooldownSeconds, 30);
  evidence.preferencesPersistInScopedBrowserStorage = true;
  snapshots.preferences = { disabled, remounted, reenabled };

  await load('commands');
  await click('Pause fixture match');
  await advance30();
  const beforeGather = await snap();
  await click('Send fixture workers to visible wood');
  const gathered = await snap();
  assert(gathered.workers.every(worker => worker.order.type === 'gather'));
  assert(gathered.commands.at(-1).accepted && gathered.commands.at(-1).command.type === 'gather');
  assert.equal(advice(gathered, 'idle-workers'), undefined);
  assert.equal(rendered(gathered, 'idle-workers'), false);
  assert.deepEqual(money(gathered), money(beforeGather));
  await click('Queue fixture worker');
  const trained = await snap();
  const hq = trained.buildings.find(building => building.role === 'hq');
  assert.deepEqual(hq.queue, ['worker']);
  assert(trained.commands.at(-1).accepted && trained.commands.at(-1).command.type === 'train');
  assert.equal(advice(trained, 'idle-production'), undefined);
  assert.equal(rendered(trained, 'idle-production'), false);
  for (const kind of ['wood', 'ore', 'crystal']) assert.equal(trained.player[kind], gathered.player[kind] - trained.costs.worker[kind]);
  evidence.gatherAndTrainResolveAdviceThroughCommands = true;
  snapshots.commands = { beforeGather, gathered, trained };

  await load('supply');
  await click('Pause fixture match');
  await click('Prepare supply blocked fixture');
  const blocked = await snap();
  assert.equal(blocked.player.population, blocked.player.cap);
  assert(rendered(blocked, 'supply-blocked'));
  assert.match(advice(blocked, 'supply-blocked').message, new RegExp(`${blocked.player.population}/${blocked.player.cap} capacity`));
  await click('Build fixture supply depot');
  const foundation = await snap();
  const depot = foundation.buildings.find(building => building.role === 'depot');
  assert(depot && depot.progress === 0);
  assert(foundation.commands.at(-1).accepted && foundation.commands.at(-1).command.type === 'build');
  for (const kind of ['wood', 'ore', 'crystal']) assert.equal(foundation.player[kind], blocked.player[kind] - foundation.costs.depot[kind]);
  assert(rendered(foundation, 'supply-blocked'), 'An unfinished depot must not create supply.');
  await advance30();
  const completed = await snap();
  assert.equal(completed.buildings.find(building => building.id === depot.id).progress, 1);
  assert(completed.player.cap > blocked.player.cap);
  assert.equal(advice(completed, 'supply-blocked'), undefined);
  assert.equal(rendered(completed, 'supply-blocked'), false);
  assert.deepEqual(money(completed), money(foundation), 'Construction must not charge a second time.');
  evidence.completedConstructionResolvesSupplyAdvice = true;
  snapshots.supply = { blocked, foundation, completed };
  if (capture) await capture('supply');

  await load('army');
  await click('Pause fixture match');
  await click('Prepare separated owned army');
  const separated = await snap();
  const cohesion = advice(separated, 'army-cohesion');
  assert(cohesion && rendered(separated, 'army-cohesion'));
  assert(cohesion.entityIds.length >= 5);
  assert(cohesion.entityIds.every(id => separated.army.some(unit => unit.id === id)));
  await click('Show Troops are spread out');
  const armyFocused = await snap();
  assert.deepEqual(armyFocused.selected, cohesion.entityIds);
  assert.deepEqual(armyFocused.focusEvents.at(-1).point, cohesion.point);
  assert.deepEqual(orders(armyFocused), orders(separated));
  assert.deepEqual(armyFocused.commands, separated.commands);
  evidence.armyAdviceFocusesOwnedTroops = true;
  snapshots.army = { separated, armyFocused };

  await load('scouting');
  await click('Pause fixture match');
  await advance30();
  await advance30();
  await advance30();
  const unexplored = await snap();
  assert(advice(unexplored, 'scouting'));
  for (const title of ['Workers need orders', 'Production queue is empty', 'Resources available to spend']) {
    const dismiss = page.getByRole('button', { name: `Dismiss ${title}`, exact: true });
    if (await dismiss.count()) await dismiss.click();
  }
  const scoutVisible = await snap();
  assert(rendered(scoutVisible, 'scouting'));
  await click('Show Scout more of the map');
  const frontierFocused = await snap();
  assert.deepEqual(frontierFocused.selected, advice(scoutVisible, 'scouting').entityIds);
  assert.deepEqual(frontierFocused.focusEvents.at(-1).point, advice(scoutVisible, 'scouting').point);
  assert.deepEqual(orders(frontierFocused), orders(scoutVisible));
  assert.deepEqual(frontierFocused.commands, scoutVisible.commands);
  evidence.scoutingAdviceFocusesKnownFrontier = true;
  snapshots.scouting = { unexplored, scoutVisible, frontierFocused };

  await load('privacy');
  await click('Pause fixture match');
  await advance30();
  await click('Prepare unused resource bank');
  const bank = await snap();
  assert(advice(bank, 'unused-resources'));
  assert.match(advice(bank, 'unused-resources').message, /2000 wood, 1000 ore and 300 crystal/);
  const permittedBefore = { workers: bank.workers, buildings: bank.buildings, army: bank.army, visibleResources: bank.visibleResources, player: bank.player, generatedAdvice: bank.generatedAdvice, renderedTopics: bank.renderedTopics };
  await click('Change hidden enemy and resource facts');
  const hiddenChanged = await snap();
  assert.deepEqual(hiddenChanged.privacy.changed, { enemyBank: true, hiddenBuilding: true, hiddenResource: true });
  assert.equal(hiddenChanged.privacy.permittedViewUnchanged, true);
  assert.equal(hiddenChanged.privacy.adviceUnchanged, true);
  assert.equal(hiddenChanged.privacy.beforeViewHash, hiddenChanged.privacy.afterViewHash);
  assert.deepEqual(hiddenChanged.privacy.beforeAdvice, hiddenChanged.privacy.afterAdvice);
  assert.deepEqual({ workers: hiddenChanged.workers, buildings: hiddenChanged.buildings, army: hiddenChanged.army, visibleResources: hiddenChanged.visibleResources, player: hiddenChanged.player, generatedAdvice: hiddenChanged.generatedAdvice, renderedTopics: hiddenChanged.renderedTopics }, permittedBefore);
  evidence.hiddenEnemyAndResourceFactsDoNotChangeAdvice = true;
  snapshots.privacy = { bank, hiddenChanged };
  if (capture) await capture('privacy');

  if (readBrowserErrors) errors.push(...await readBrowserErrors());
  assert.deepEqual(errors, []);
  return { evidence, errors, snapshots, final: await snap() };
}

// Optional human-run QA entry point. The agent uses CUA for browser interactions.
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
    await mkdir('work', { recursive: true });
    const proof = await verifyCoach(page, process.argv[2], undefined, name => page.screenshot({ path: `work/coach-${name}.png` }));
    await writeFile('work/coach-proof.json', JSON.stringify(proof, null, 2));
    console.log(JSON.stringify(proof.evidence));
  } finally {
    await browser.close();
  }
}
