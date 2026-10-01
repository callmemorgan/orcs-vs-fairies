import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.argv[2] ?? 'http://127.0.0.1:5276';
const destination = process.argv[3] ?? 'work/scenarios/conquest-proof';
await mkdir(destination, { recursive: true });
const paths = ['scenario-demo.html', 'src/scenarios/demo.ts', 'src/scenarios/conquest-world.ts', 'src/core/conquest.ts', 'src/core/conquest-types.ts', 'src/core/campaign.ts', 'src/core/scenarios.ts', 'src/core/scenario-types.ts', 'src/core/scenario-validation.ts', 'src/core/scenario-recordings.ts', 'src/core/geometry.ts', 'src/core/simulation.ts', 'src/core/saves.ts', 'src/ui/ConquestTools.ts', 'src/ui/conquest-tools.css', 'src/ui/ScenarioTools.ts', 'src/ui/Hud.ts', 'src/game/GameScene.ts', 'scripts/verify_conquest.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const sourceBefore = await hashes();
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage(), errors = [], actions = [], checks = {};
page.on('pageerror', error => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.scenarioDiagnostics);
const button = name => page.getByRole('button', { name, exact: true });
const actor = (d, label) => d.checkpoint.game.state.entities.find(e => e.id === d.checkpoint.runtime.labels[label]);
const screenshot = name => page.screenshot({ path: `${destination}/${name}.png` });
const action = async (description, operation) => { actions.push({ at: new Date().toISOString(), description }); console.log(description); await operation(); };
const panel = async shown => { const hide = button('Hide missions'); if (await hide.isVisible() !== shown) await button(shown ? 'Show missions' : 'Hide missions').click(); };
const openConquest = async () => { await panel(true); const details = page.locator('.conquest-tools'); if (!(await details.evaluate(node => node.open))) await details.locator(':scope > summary').click(); };
const pause = async () => { if (!(await snapshot()).paused) await button('Pause').click(); };
const mapClick = async (x, y, mouseButton = 'right') => { const d = await snapshot(); assert.equal(d.camera.zoom, 1); await page.mouse.click(1600 + (x - y) * 32 - d.camera.x, 80 + (x + y) * 16 - d.camera.y, { button: mouseButton }); };
const selectUnit = async id => { await page.keyboard.press('F2'); const roster = page.locator(`#selection-roster [data-id="${id}"]`); assert.equal(await roster.count(), 1); await roster.click(); };
const move = async (id, x, y) => { await selectUnit(id); await mapClick(x, y); };
const exportRealm = async name => { await openConquest(); const download = page.waitForEvent('download'); await button('Export realm profile').click(); await (await download).saveAs(`${destination}/${name}.json`); return JSON.parse(await readFile(`${destination}/${name}.json`, 'utf8')); };
async function fightGrove() {
  for (let decision = 0; decision < 120; decision++) {
    let d = await snapshot();
    if (d.checkpoint.runtime.outcome !== 'playing') return d;
    const state = d.checkpoint.game.state, commander = actor(d, 'commander'), visible = new Set(state.visible[0]);
    const troops = state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.role !== 'worker' && e.hp > 0);
    const enemies = state.entities.filter(e => e.side === 1 && e.hp > 0 && visible.has(Math.floor(e.y) * state.width + Math.floor(e.x))).sort((a, b) => Math.hypot(a.x - commander.x, a.y - commander.y) - Math.hypot(b.x - commander.x, b.y - commander.y));
    const target = enemies[0];
    if (!target) {
      if (!d.checkpoint.runtime.completed.includes('region')) { await page.keyboard.press('F2'); await page.keyboard.press('A'); await mapClick(23, 15, 'left'); }
    } else for (const troop of troops) {
      d = await snapshot(); if (d.checkpoint.runtime.outcome !== 'playing') return d;
      const current = d.checkpoint.game.state.entities.find(e => e.id === troop.id), currentTarget = d.checkpoint.game.state.entities.find(e => e.id === target.id);
      if (!current || !currentTarget || current.hp <= 0 || currentTarget.hp <= 0) continue;
      if (current.id === commander.id && current.hp < current.maxHp * .6) {
        if (Math.hypot(current.x - 13, current.y - 16) > .7 && (current.order.type !== 'move' || Math.hypot(current.order.x - 13, current.order.y - 16) > .5)) await move(current.id, 13, 16);
        continue;
      }
      const range = current.role === 'special' ? 6 + (current.entrenchedAt !== undefined ? 3 : 0) : current.role === 'ranged' ? 6.5 : 1.4;
      if (Math.hypot(current.x - currentTarget.x, current.y - currentTarget.y) <= range) {
        if (current.entrenchedAt === undefined) { await selectUnit(current.id); await page.keyboard.press('Q'); }
      } else if (current.order.type !== 'attack' || current.order.target !== currentTarget.id) {
        await selectUnit(current.id); d = await snapshot();
        const label = Object.entries(d.checkpoint.runtime.labels).find(([, id]) => id === currentTarget.id)?.[0], point = d.actorScreens[label];
        assert(point); await page.mouse.click(point.x, point.y - 15, { button: 'right' });
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error('The grove battle did not finish through the visible controls.');
}

try {
  await page.goto(`${origin}/scenario-demo.html`); await openConquest();
  await action('Create a Deepforge realm using the faction picker.', async () => { await page.getByLabel('Conquest faction').selectOption('dwarves'); await button('Create realm').click(); });
  const initial = (await snapshot()).conquest;
  assert.equal(initial.faction, 'dwarves'); assert.equal(initial.regions.hearth.owner, 'dwarves'); assert.equal(Object.keys(initial.regions).length, 7);
  assert.deepEqual(initial.treasury, { wood: 500, ore: 350, crystal: 100 });
  assert.equal(await page.locator('.conquest-regions article').count(), 7);
  assert.equal(await button('Attack: Ashwing Grove').isEnabled(), true); assert.equal(await button('Attack: Deep Gate Quarry').isEnabled(), true); assert.equal(await button("Attack: The Regent's Keep").isEnabled(), false);
  checks.connectedRealm = { faction: initial.faction, owners: initial.regions, treasury: initial.treasury, initiallyReachable: ['grove', 'quarry'], inaccessibleKeepDisabled: true };
  await screenshot('01-connected-realm');
  await action('Transfer 100 ore to the fairies and request a two-turn truce.', async () => {
    await page.getByLabel('Foreign faction').selectOption('fairies'); assert.equal(await button('Request alliance').isEnabled(), false);
    await page.getByLabel('Tribute ore').fill('100'); await button('Offer tribute').click();
    const offered = (await snapshot()).conquest; assert.equal(offered.treasury.ore, 250); assert.equal(offered.relations.fairies.treasury.ore, 200); assert.equal(offered.relations.fairies.score, 20);
    await page.getByLabel('Truce turns').fill('2'); await button('Request truce').click();
  });
  const truce = (await snapshot()).conquest;
  assert.equal(truce.relations.fairies.truceUntil, 2); assert.equal(await button('Passage: Ashwing Grove').isEnabled(), true); assert.equal(await button('Attack: Brass Crossroads').isEnabled(), true);
  checks.conservedTributeAndTruce = { realmOre: 250, foreignOre: 200, score: 20, truceUntil: 2, newConnectedRoute: 'crossroads' };
  await screenshot('02-treaty-connected-route');
  await action('Launch the protected passage and move the commander into garrison range.', async () => {
    await button('Passage: Ashwing Grove').click(); await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.id === 'conquest-dwarves-grove-passage');
    await panel(false); const d = await snapshot(); assert.equal(d.paused, true); assert.equal(d.checkpoint.game.state.teams[0], d.checkpoint.game.state.teams[1]);
    await button('Return to battle').click(); await move(d.checkpoint.runtime.labels.commander, 23, 16);
    await page.waitForFunction(() => { const d = window.scenarioDiagnostics, e = d.checkpoint.game.state.entities.find(e => e.id === d.checkpoint.runtime.labels.commander); return e.x > 22.5; }, null, { timeout: 30000 });
    await page.waitForTimeout(2500); await pause();
  });
  const protectedMove = await snapshot(), commander = actor(protectedMove, 'commander'), guard = actor(protectedMove, 'garrison-0');
  assert(Math.hypot(commander.x - guard.x, commander.y - guard.y) < 7); assert.equal(commander.hp, commander.maxHp);
  assert(protectedMove.commands.some(entry => entry.accepted && entry.command.type === 'move' && entry.command.ids.includes(commander.id)));
  assert.equal(protectedMove.battleEvents.some(event => event.type === 'attack' && event.target === commander.id), false);
  checks.protectedPhysicalMovement = { commanderId: commander.id, from: { x: 8, y: 15 }, to: { x: commander.x, y: commander.y }, hp: commander.hp, garrisonDistance: Math.hypot(commander.x - guard.x, commander.y - guard.y), gameTime: protectedMove.checkpoint.game.state.time, noGarrisonDamage: true };
  await screenshot('03-protected-garrison-range');
  const active = await exportRealm('active-passage');
  assert.deepEqual(active.active.checkpoint, protectedMove.checkpoint);
  await action('Reload the production page and resume the saved active passage.', async () => {
    await page.reload(); await openConquest(); await button('Resume saved realm').click(); await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.id === 'conquest-dwarves-grove-passage');
  });
  const resumed = await snapshot(); assert.equal(resumed.paused, true); assert.deepEqual(resumed.checkpoint, active.active.checkpoint); assert.deepEqual(resumed.conquest, active);
  checks.activeLocalRestore = { tick: resumed.checkpoint.game.state.tick, commanderId: actor(resumed, 'commander').id, fullCheckpointAndProfileEqual: true };
  await action('Import the exported active profile through its file input.', async () => {
    const count = resumed.launches.length; await page.getByLabel('Import realm profile').setInputFiles(`${destination}/active-passage.json`);
    await page.waitForFunction(count => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.launches.length > count, count);
  });
  assert.deepEqual((await snapshot()).checkpoint, active.active.checkpoint); checks.activeFileRestore = { fullCheckpointEqual: true };
  await action('Finish the passage by moving the commander to the eastern exit.', async () => {
    await panel(false); await button('Return to battle').click(); await move(commander.id, 29, 16);
    await page.waitForFunction(() => window.scenarioDiagnostics.checkpoint.runtime.outcome === 'won' && window.scenarioDiagnostics.conquest.active === null, null, { timeout: 20000 });
  });
  const passed = await snapshot(); assert.equal(passed.conquest.turn, 1); assert.equal(passed.conquest.regions.grove.owner, 'fairies'); assert.equal(actor(passed, 'commander').hp, commander.hp); assert(passed.checkpoint.game.state.time < 30);
  checks.realPassageResult = { outcome: 'won', commander: { id: commander.id, x: actor(passed, 'commander').x, y: actor(passed, 'commander').y, hp: actor(passed, 'commander').hp }, time: passed.checkpoint.game.state.time, turn: 1, owner: 'fairies' };
  await screenshot('04-passage-complete');
  await action('Wait for the treaty to expire, then fund an undead alliance.', async () => {
    await openConquest(); await button('Wait one turn').click(); const expired = (await snapshot()).conquest;
    assert.equal(expired.turn, 2); assert.equal(expired.treasury.ore, 330); assert.equal(await button('Attack: Ashwing Grove').isEnabled(), true);
    await page.getByLabel('Foreign faction').selectOption('undead'); await page.getByLabel('Tribute ore').fill('250'); await button('Offer tribute').click(); await button('Request alliance').click();
  });
  const allied = (await snapshot()).conquest; assert.equal(allied.treasury.ore, 80); assert.equal(allied.relations.undead.treasury.ore, 350); assert.equal(allied.relations.undead.score, 50); assert.equal(allied.relations.undead.alliance, true);
  checks.treatyExpiryAndAlliance = { turn: 2, expiredFairyTruce: allied.relations.fairies.truceUntil, hostileAttackEnabled: true, realmOre: 80, undeadOre: 350, allianceScore: 50 };
  await screenshot('05-expired-truce-and-alliance');
  await action('Launch the hostile grove battle with the funded allied reinforcement.', async () => {
    await button('Attack: Ashwing Grove').click(); await page.waitForFunction(() => window.scenarioDiagnostics?.ready && window.scenarioDiagnostics.id === 'conquest-dwarves-grove-attack');
    const d = await snapshot(); assert.notEqual(d.checkpoint.game.state.teams[0], d.checkpoint.game.state.teams[1]); assert.equal(d.checkpoint.game.state.players[0].ore, 120);
    assert.equal(await button('Offer tribute').isEnabled(), false); assert.equal(await button('Wait one turn').isEnabled(), false); assert.equal(await button('Create realm').isEnabled(), false);
    await panel(false); await button('Return to battle').click(); const aid = actor(d, 'aid-undead'); assert(aid && aid.side === 0); await move(aid.id, 18, 13);
    await page.waitForFunction(() => { const d = window.scenarioDiagnostics; return d.battleEvents.some(e => e.type === 'attack' && e.source === d.checkpoint.runtime.labels['aid-undead'] && e.target === d.checkpoint.runtime.labels['garrison-0'] && e.amount > 0); }, null, { timeout: 20000 });
  });
  const aidFight = await snapshot(), aidId = aidFight.checkpoint.runtime.labels['aid-undead'], firstShot = aidFight.battleEvents.find(e => e.type === 'attack' && e.source === aidId && e.target === aidFight.checkpoint.runtime.labels['garrison-0'] && e.amount > 0);
  assert(aidFight.battleEvents.some(e => e.type === 'attack' && e.side === 1 && e.amount > 0));
  assert(aidFight.battleEvents.filter(e => e.type === 'attack' && e.side === 0).every(e => e.source === aidId));
  checks.actualAlliedAidAndHostility = { aidId, firstShot, hostileAttacks: aidFight.battleEvents.filter(e => e.type === 'attack' && e.side === 1), aidHp: actor(aidFight, 'aid-undead').hp, aidUsesPlayerFactionStats: true, initialBattleOre: 120, allInitialFriendlyShotsFromAid: true };
  await screenshot('06-allied-aid-under-hostile-fire');
  await action('Command the persistent detachment through the ordinary roster, attacks, movement and emplacement controls.', async () => {
    await page.keyboard.press('F2'); await page.keyboard.press('A'); await mapClick(22, 15, 'left'); await fightGrove();
    await page.waitForFunction(() => window.scenarioDiagnostics.conquest.active === null, null, { timeout: 10000 });
  });
  const won = await snapshot(); assert.equal(won.checkpoint.runtime.outcome, 'won'); assert.equal(won.conquest.regions.grove.owner, 'dwarves'); assert.equal(won.conquest.turn, 3);
  assert.equal(won.conquest.relations.undead.treasury.ore, 310); assert.equal(won.conquest.relations.fairies.warPressure, 1); assert.equal(won.conquest.relations.fairies.score, 5);
  assert(won.conquest.army.some(soldier => soldier.entity.id === commander.id)); assert(won.battleEvents.some(e => e.type === 'death' && e.side === 1));
  assert(won.commands.some(entry => entry.accepted && entry.command.type === 'attack')); assert(won.commands.some(entry => entry.accepted && entry.command.type === 'ability'));
  checks.realCaptureAndPersistentArmy = { outcome: won.checkpoint.runtime.outcome, gameTime: won.checkpoint.game.state.time, turn: won.conquest.turn, owner: won.conquest.regions.grove.owner, garrison: won.conquest.regions.grove.garrison, survivors: won.conquest.army.map(s => ({ id: s.entity.id, label: s.label, hp: s.entity.hp })), alliedOreAfterAid: 310, fairyRelations: won.conquest.relations.fairies, commands: won.commands, combatEvents: won.battleEvents };
  await screenshot('07-grove-captured');
  const finalProfile = await exportRealm('completed-realm'); assert.deepEqual(finalProfile, won.conquest);
  assert.match(await page.locator('.conquest-overview').innerText(), /Connected income per turn: 310 wood · 60 ore · 24 crystal/);
  await action('Reload, resume and import the completed realm with its verified battle history.', async () => {
    await page.reload(); await openConquest(); await button('Resume saved realm').click(); await page.waitForFunction(() => window.scenarioDiagnostics.conquest?.turn === 3);
    assert.deepEqual((await snapshot()).conquest, finalProfile);
    await page.getByLabel('Import realm profile').setInputFiles(`${destination}/completed-realm.json`);
    await page.waitForTimeout(500); assert.deepEqual((await snapshot()).conquest, finalProfile);
  });
  checks.completedLocalAndFileRestore = { fullProfileEqual: true, capturedRegion: 'grove', persistentCommanderId: commander.id, connectedSupply: { wood: 310, ore: 60, crystal: 24 } };
  await screenshot('08-restored-captured-realm');
  const sourceAfter = await hashes(); assert.deepEqual(sourceAfter, sourceBefore); assert.deepEqual(errors, []);
  await writeFile(`${destination}/proof.json`, JSON.stringify({ at: new Date().toISOString(), origin, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceBefore, sourceAfter, viewport: { width: 1600, height: 1100 }, renderer: 'Phaser canvas', inputPolicy: 'Visible buttons, file inputs, keyboard and native canvas pointer input. scenarioDiagnostics supplies copied observations only.', actions, checks, errors }, null, 2));
  console.log(JSON.stringify({ checks: Object.keys(checks), errors }, null, 2));
} catch (error) {
  await screenshot('failure').catch(() => {}); await writeFile(`${destination}/failure.json`, JSON.stringify({ at: new Date().toISOString(), message: error.message, stack: error.stack, sourceBefore, sourceAfter: await hashes(), actions, errors, snapshot: await snapshot().catch(() => null) }, null, 2)); throw error;
} finally { await context.tracing.stop({ path: `${destination}/ui-trace.zip` }); await browser.close(); }
