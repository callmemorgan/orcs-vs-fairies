import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5187';
const out = process.env.OVF_SPECIALIST_EVIDENCE ?? 'docs/evidence/specialists-20261001';
const fixtures = 'work/hundred-features/specialists';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [], evidence = {}, actions = [];
page.on('pageerror', error => errors.push(error.message));
const abilities = {
  orcs: ['Iron Command', 'Impact Fury', 'Incendiary Shell'],
  fairies: ['Queen’s Step', 'Forest Leap', 'Rooting Shell'],
  dwarves: ['Thane’s Ward', 'Armored Brace', 'Deploy Ammunition'],
  undead: ['Soul Drain', 'Dread Charge', 'Corpse Bombardment'],
  tideborn: ['Admiral’s Wave', 'Wet-ground Surge', 'Flood Shell'],
  automata: ['Prime Shield', 'Shield Dash', 'Power Beam'],
};
const source = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  status: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  htmlSha256: createHash('sha256').update(await readFile('dist/index.html')).digest('hex'),
  startedAt: new Date().toISOString(), base,
};
const snapshot = () => page.evaluate(() => ({
  tick: window.rts.state.tick, time: window.rts.state.time,
  players: window.rts.state.players, entities: window.rts.state.entities,
  specialists: window.rts.state.specialists, selected: window.rts.selected,
  art: window.rts.art, paused: window.rts.paused,
}));
async function ready() {
  await page.waitForSelector('.loading-battle[hidden]', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => {try {return window.rts?.art?.loaded;} catch {return false;}}, null, { timeout: 60000 });
}
async function point(x, y) {
  return page.evaluate(({ x, y }) => {
    const c = window.rts.camera;
    return { x: (1600 + (x - y) * 32 - c.x) * c.zoom + innerWidth / 2 * (1 - c.zoom),
      y: (80 + (x + y) * 16 - c.y) * c.zoom + innerHeight / 2 * (1 - c.zoom) };
  }, { x, y });
}
async function ground(p, button = 'left') {
  const screen = await point(p.x, p.y);await page.mouse.click(screen.x, screen.y, { button });
}
async function entityClick(id, button = 'left') {
  const e = (await snapshot()).entities.find(e => e.id === id);assert(e, `Entity ${id} exists`);
  const screen = await point(e.x, e.y);await page.mouse.click(screen.x, screen.y - 30, { button });
}
async function selectUnit(id) {
  await page.keyboard.press('F2');
  await page.locator(`#selection-roster [data-id="${id}"]`).click();
  await page.waitForFunction(id => window.rts.selected.length === 1 && window.rts.selected[0] === id, id);
}
async function selectBuilding(id) {
  await entityClick(id);
  await page.waitForFunction(id => window.rts.selected.includes(id), id);
}
async function action(name, run) {
  const before = await snapshot();await run();const after = await snapshot();
  actions.push({ name, fromTick: before.tick, toTick: after.tick, time: after.time });
  console.log(`${name}: tick ${after.tick}`);
}
async function load(faction) {
  await page.locator('[data-session-tool="saves"]').click();
  await page.getByLabel('Import save JSON', { exact: true }).setInputFiles(`${fixtures}/${faction}.json`);
  await page.getByRole('button', { name: 'Import save', exact: true }).click();
  await page.waitForFunction(faction => {try {return window.rts?.state.players[0].faction === faction && window.rts.state.tick === 0;} catch {return false;}}, faction);
  await ready();await page.getByRole('button', { name: 'Close session tools', exact: true }).click();
  return JSON.parse(await readFile(`${fixtures}/${faction}-ids.json`, 'utf8'));
}
async function prepareAndFire(faction, ids) {
  await selectUnit(ids.siege);
  const before = await snapshot(), target = before.entities.find(e => e.id === ids.shellTarget);
  await page.getByRole('button', { name: abilities[faction][2], exact: true }).click();
  await page.waitForFunction(id => !!window.rts.state.entities.find(e => e.id === id)?.siegeMode, ids.siege);
  const prepared = await snapshot(), mode = prepared.entities.find(e => e.id === ids.siege).siegeMode;
  if (['dwarves', 'automata'].includes(faction)) assert(mode.ammo > 0);else assert(mode.prepared);
  if (faction === 'orcs') assert.equal(before.players[0].wood - prepared.players[0].wood, 8);
  if (['fairies', 'tideborn'].includes(faction)) assert.equal(before.players[0].crystal - prepared.players[0].crystal, 6);
  if (faction === 'dwarves') assert.equal(before.players[0].ore - prepared.players[0].ore, 15);
  if (faction === 'automata') assert.equal(before.players[0].crystal - prepared.players[0].crystal, 8);
  await page.waitForFunction(({ id, source, faction, hp }) => {
    const s = window.rts.state, victim = s.entities.find(e => e.id === id), shooter = s.entities.find(e => e.id === source);
    if (!victim || victim.hp >= hp) return false;
    if (faction === 'orcs') return victim.burning?.length;
    if (faction === 'fairies') return victim.specialistBuffs?.some(b => b.rooted);
    if (faction === 'tideborn') return victim.specialistBuffs?.some(b => b.speedFactor === .5);
    return ['dwarves', 'automata'].includes(faction) ? shooter.siegeMode.ammo < (faction === 'dwarves' ? 5 : 4) : !shooter.siegeMode.prepared;
  }, { id: ids.shellTarget, source: ids.siege, faction, hp: target.hp }, { timeout: 12000 });
  evidence[`${faction}SiegePaidAndHit`] = { mode, after: (await snapshot()).entities.find(e => e.id === ids.shellTarget) };
}
async function cavalryAbility(faction, ids) {
  await selectUnit(ids.cavalry);const beforeSnapshot = await snapshot(), before = beforeSnapshot.entities.find(e => e.id === ids.cavalry);
  await page.getByRole('button', { name: abilities[faction][1], exact: true }).click();
  if (['fairies', 'automata'].includes(faction)) await ground(ids.points.leap);
  await page.waitForFunction(({ id, faction, x, y }) => {
    const e = window.rts.state.entities.find(e => e.id === id);
    if (['fairies', 'automata'].includes(faction)) return Math.hypot(e.x - x, e.y - y) > .5;
    if (faction === 'undead') return window.rts.state.entities.some(e => e.side === 1 && e.specialistBuffs?.some(b => b.fearedFrom));
    return e.specialistBuffs?.length;
  }, { id: ids.cavalry, faction, x: before.x, y: before.y });
  const afterSnapshot = await snapshot(), after = afterSnapshot.entities.find(e => e.id === ids.cavalry);
  if (faction === 'automata') {
    const spent = before.shield - after.shield, rechargeBound = 4 * (afterSnapshot.time - beforeSnapshot.time);
    assert(spent > 0 && Math.abs(spent - 15) <= rechargeBound + .000001);
  }
  evidence[`${faction}CavalryThroughHud`] = { before, after };
}
async function commanderAbility(faction, ids) {
  await selectUnit(ids.hero);const before = await snapshot();
  await page.getByRole('button', { name: abilities[faction][0], exact: true }).click();
  if (['dwarves', 'automata'].includes(faction)) await entityClick(ids.cavalry);
  else if (['undead', 'tideborn'].includes(faction)) await entityClick(ids.battle);
  else await ground(ids.points.command);
  await page.waitForFunction(id => (window.rts.state.entities.find(e => e.id === id)?.abilityReadyAt ?? 0) > window.rts.state.time, ids.hero);
  const after = await snapshot(), hero = after.entities.find(e => e.id === ids.hero);
  if (faction === 'orcs') assert(after.entities.some(e => e.side === 0 && e.specialistBuffs?.some(b => b.damageFactor === 1.25)));
  if (faction === 'dwarves') assert(after.entities.find(e => e.id === ids.cavalry).hp > before.entities.find(e => e.id === ids.cavalry).hp);
  if (faction === 'automata') assert.equal(after.entities.find(e => e.id === ids.cavalry).shield, 60);
  if (faction === 'undead') assert(hero.hp > before.entities.find(e => e.id === ids.hero).hp);
  if (faction === 'tideborn') assert(hero.hp > before.entities.find(e => e.id === ids.hero).hp);
  evidence[`${faction}CommanderTargetedThroughHud`] = { hero };
}
try {
  await page.goto(base);await page.locator('.begin-match').click();await ready();
  if (process.argv.includes('--verify-exported-save')) {
    const file = JSON.parse(await readFile(`${out}/browser-save.json`, 'utf8'));
    await page.locator('[data-session-tool="saves"]').click();
    await page.getByLabel('Import save JSON', { exact: true }).setInputFiles(`${out}/browser-save.json`);
    await page.getByRole('button', { name: 'Import save', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.session-notice')?.textContent.includes('Save loaded'));
    await ready();const imported = await snapshot();assert.equal(imported.tick, file.game.state.tick);
    assert.deepEqual(imported.specialists, file.game.state.specialists);assert.deepEqual(imported.players[0].upgrades, file.game.state.players[0].upgrades);
    const hero = file.game.state.entities.find(e => e.definitionId === 'core:fairies-commander');
    assert.deepEqual(imported.entities.find(e => e.id === hero.id).veteran, hero.veteran);
    await page.getByRole('button', { name: 'Close session tools', exact: true }).click();
    await page.locator('#technology-button').click();const locked = page.locator('[data-technology="core:ranged-mobility"]');
    await locked.scrollIntoViewIfNeeded();assert(await locked.isDisabled());const reason = await locked.innerText();assert.match(reason, /Focused Volleys|locked/i);
    await page.mouse.move(720, 140);await page.screenshot({ path: `${out}/research-branch-lock.png` });
    await page.getByRole('button', { name: 'Close technology tree', exact: true }).click();
    const barracks = imported.entities.find(e => e.side === 0 && e.role === 'barracks');await selectBuilding(barracks.id);
    const recruit = page.getByRole('button', { name: 'Queen Lyra', exact: true });assert.equal(await recruit.getAttribute('aria-disabled'), 'true');
    const limitReason = await recruit.getAttribute('data-tooltip');assert.match(limitReason, /commander.*alive/i);
    assert.deepEqual(errors, []);
    await writeFile(`${out}/native-save-import-proof.json`, JSON.stringify({ source, completedAt: new Date().toISOString(), tick: imported.tick, saveSha256: createHash('sha256').update(await readFile(`${out}/browser-save.json`)).digest('hex'), reason, limitReason, errors }, null, 2));
    console.log(`PASS native exported save import at tick ${imported.tick}, completed branch lock and alive commander limit`);
  } else {
  for (const faction of ['orcs', 'dwarves', 'undead', 'tideborn', 'automata']) {
    const ids = await load(faction);
    await action(`${faction} siege`, () => prepareAndFire(faction, ids));
    await action(`${faction} commander`, () => commanderAbility(faction, ids));
    await action(`${faction} cavalry`, () => cavalryAbility(faction, ids));
    await page.screenshot({ path: `${out}/${faction}-ability.png` });
  }
  const ids = await load('fairies');await page.screenshot({ path: `${out}/fairies-initial.png` });
  await action('fairies siege', () => prepareAndFire('fairies', ids));
  await action('fairies cavalry', () => cavalryAbility('fairies', ids));
  await action('normal commander recruitment', async () => {
    await selectBuilding(ids.barracks);const before = await snapshot();
    await page.getByRole('button', { name: 'Queen Lyra', exact: true }).click();
    await page.waitForFunction(id => window.rts.state.entities.find(e => e.id === id)?.queueDefinitionIds?.includes('core:fairies-commander'), ids.barracks);
    const queued = await snapshot();assert.equal(before.players[0].wood - queued.players[0].wood, 150);assert.equal(before.players[0].ore - queued.players[0].ore, 110);assert.equal(before.players[0].crystal - queued.players[0].crystal, 25);
    await page.waitForFunction(() => document.querySelector('[aria-label="Queen Lyra"]')?.getAttribute('aria-disabled') === 'true');
    evidence.oneCommanderQueueLimit = await page.getByRole('button', { name: 'Queen Lyra', exact: true }).getAttribute('data-tooltip');
  });
  await action('ranged military research', async () => {
    await page.locator('#technology-button').click();await page.locator('[data-technology="core:ranged-arms"]').click();
    await page.getByRole('button', { name: 'Close technology tree', exact: true }).click();
  });
  await action('artifact recover equip unequip drop', async () => {
    await selectUnit(ids.engineer);await page.getByRole('button', { name: 'Recover Ember Blade', exact: true }).click();
    await page.waitForFunction(id => window.rts.state.specialists.artifacts[0].holder === id, ids.engineer);
    const beforeStats = await page.locator('#selection-stats').innerText();
    await page.getByRole('button', { name: 'Equip Ember Blade', exact: true }).click();
    await page.waitForFunction(id => !!window.rts.state.entities.find(e => e.id === id)?.equipment?.weapon, ids.engineer);
    await page.waitForFunction(before => document.querySelector('#selection-stats')?.innerText !== before, beforeStats);
    const equippedStats = await page.locator('#selection-stats').innerText();assert.notEqual(equippedStats, beforeStats);
    await page.getByRole('button', { name: 'Unequip Ember Blade', exact: true }).click();
    await page.waitForFunction(id => !window.rts.state.entities.find(e => e.id === id)?.equipment?.weapon, ids.engineer);
    await page.getByRole('button', { name: 'Drop Ember Blade', exact: true }).click();
    await page.waitForFunction(() => !!window.rts.state.specialists.artifacts[0].position);
    await page.getByRole('button', { name: 'Recover Ember Blade', exact: true }).click();await page.getByRole('button', { name: 'Equip Ember Blade', exact: true }).click();
    evidence.artifactNormalHud = { beforeStats, equippedStats, artifact: (await snapshot()).specialists.artifacts[0] };
  });
  await page.waitForFunction(() => window.rts.state.entities.some(e => e.definitionId === 'core:fairies-commander'), null, { timeout: 35000 });
  ids.hero = (await snapshot()).entities.find(e => e.definitionId === 'core:fairies-commander').id;evidence.normalCommanderRecruitment = true;
  await action('earned battle rank and promotion', async () => {
    await selectUnit(ids.hero);await entityClick(ids.battle, 'right');
    await page.waitForFunction(id => window.rts.state.entities.find(e => e.id === id)?.veteran?.pendingPromotion === 1, ids.hero, { timeout: 25000 });
    const earned = (await snapshot()).entities.find(e => e.id === ids.hero);assert(earned.veteran.experience >= 40);
    await page.screenshot({ path: `${out}/promotion.png` });
    await page.getByRole('button', { name: 'Promote Queen Lyra: Bulwark', exact: true }).click();
    await page.waitForFunction(id => window.rts.state.entities.find(e => e.id === id)?.veteran?.promotions.some(p => p.id === 'bulwark'), ids.hero);
    evidence.battleEarnedPromotion = { earned, after: (await snapshot()).entities.find(e => e.id === ids.hero) };
  });
  await action('queen targeted teleport and healing', async () => {
    const before = (await snapshot()).entities.find(e => e.id === ids.hero);
    await page.getByRole('button', { name: abilities.fairies[0], exact: true }).click();await ground(ids.points.queen);
    await page.waitForFunction(({ id, p }) => {const e = window.rts.state.entities.find(e => e.id === id);return Math.hypot(e.x - p.x, e.y - p.y) < .3;}, { id: ids.hero, p: ids.points.queen });
    const after = await snapshot(), hero = after.entities.find(e => e.id === ids.hero);
    assert(Math.hypot(hero.x - before.x, hero.y - before.y) > 1);
    assert(after.entities.find(e => e.id === ids.engineer).hp > 70);evidence.queenTargetedTeleportAndHeal = { before: {x: before.x, y: before.y}, after: {x: hero.x, y: hero.y}, engineerHealth: after.entities.find(e => e.id === ids.engineer).hp };
  });
  await page.waitForFunction(() => window.rts.state.players[0].upgrades.includes('core:ranged-arms'), null, { timeout: 35000 });
  evidence.rangedMilitaryResearchCompleted = true;
  await action('mutually exclusive branch research', async () => {
    await page.locator('#technology-button').click();await page.locator('[data-technology="core:ranged-focus"]').click();
    await page.waitForFunction(() => document.querySelector('[data-technology="core:ranged-mobility"]')?.disabled);
    const pendingReason = await page.locator('[data-technology="core:ranged-mobility"]').innerText();assert.match(pendingReason, /Focused Volleys|researching/i);
    await page.getByRole('button', { name: 'Close technology tree', exact: true }).click();
    await page.waitForFunction(() => window.rts.state.players[0].upgrades.includes('core:ranged-focus'), null, { timeout: 55000 });
    await page.locator('#technology-button').click();assert(await page.locator('[data-technology="core:ranged-mobility"]').isDisabled());
    const lockedReason = await page.locator('[data-technology="core:ranged-mobility"]').innerText();assert.match(lockedReason, /Focused Volleys|locked/i);
    await page.screenshot({ path: `${out}/research-branch-lock.png` });await page.getByRole('button', { name: 'Close technology tree', exact: true }).click();
    evidence.exclusiveResearchUi = { pendingReason, lockedReason };
  });
  await action('connected beacon status', async () => {
    await selectBuilding(ids.beacon);assert.match(await page.locator('#selection-beacon').innerText(), /Beacon connected/);
    evidence.connectedBeaconHud = true;await page.screenshot({ path: `${out}/beacon.png` });
  });
  await action('engineer bridge barricade and paid repair', async () => {
    await selectUnit(ids.engineer);const before = await snapshot();
    await page.getByRole('button', { name: 'Temporary bridge', exact: true }).click();await ground(ids.points.bridge);
    await page.waitForFunction(() => window.rts.state.specialists.structures.some(s => s.kind === 'bridge'));
    await page.getByRole('button', { name: 'Field barricade', exact: true }).click();await ground(ids.points.barricade);
    await page.waitForFunction(() => window.rts.state.specialists.structures.some(s => s.kind === 'barricade'));
    await page.getByRole('button', { name: 'Field repair', exact: true }).click();await entityClick(ids.siege);
    await page.waitForFunction(id => window.rts.state.entities.find(e => e.id === id)?.hp > 80, ids.siege);
    const after = await snapshot();assert.equal(before.players[0].wood - after.players[0].wood, 95);assert.equal(before.players[0].ore - after.players[0].ore, 21);
    assert.equal(await page.evaluate(() => window.rts.state.terrain[6 * window.rts.state.width + 13]), 'bridge');
    evidence.engineerNormalTargetActions = { structures: after.specialists.structures, siege: after.entities.find(e => e.id === ids.siege), costs: { wood: 95, ore: 21 } };
    await page.screenshot({ path: `${out}/engineer.png` });
  });
  await action('native save export load and replay seek', async () => {
    await page.locator('[data-session-tool="saves"]').click();
    await page.getByLabel('Save name', { exact: true }).fill('Specialist proof');await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.session-save-list')?.textContent.includes('Specialist proof'));
    const saved = await snapshot();
    const pendingSave = page.waitForEvent('download');await page.getByRole('button', { name: 'Export save', exact: true }).click();await (await pendingSave).saveAs(`${out}/browser-save.json`);
    const save = JSON.parse(await readFile(`${out}/browser-save.json`, 'utf8'));assert.equal(save.game.state.tick, saved.tick);assert.deepEqual(save.game.state.specialists, saved.specialists);assert(save.game.state.players[0].upgrades.includes('core:ranged-focus'));
    const hero = save.game.state.entities.find(e => e.id === ids.hero);assert(hero.veteran.promotions.some(p => p.id === 'bulwark'));
    await page.getByRole('button', { name: 'Load Specialist proof', exact: true }).click();await ready();assert.equal((await snapshot()).tick, saved.tick);
    await page.locator('[data-session-tab="replay"]').click();const pendingReplay = page.waitForEvent('download');await page.getByRole('button', { name: 'Export replay', exact: true }).click();await (await pendingReplay).saveAs(`${out}/browser-replay.json`);
    const archive = JSON.parse(await readFile(`${out}/browser-replay.json`, 'utf8'));
    assert(archive.actions.some(a => a.command?.type === 'ability' && a.command.ids.includes(ids.hero) && a.command.x !== undefined && a.command.target === undefined));
    await page.getByLabel('Import replay JSON', { exact: true }).setInputFiles(`${out}/browser-replay.json`);await page.getByRole('button', { name: 'Import replay', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.session-notice')?.textContent.includes('Replay loaded'));await ready();await page.getByLabel('Replay tick', { exact: true }).press('End');
    await page.waitForFunction(tick => window.rts.state.tick === tick, saved.tick, { timeout: 30000 });
    const replayed = await snapshot();assert.deepEqual(replayed.specialists, saved.specialists);assert.deepEqual(replayed.entities.find(e => e.id === ids.hero).veteran, hero.veteran);assert.deepEqual(replayed.players[0].upgrades, saved.players[0].upgrades);
    evidence.nativeSaveAndReplayPreserveSpecialists = { tick: saved.tick, replayTick: replayed.tick, artifact: replayed.specialists.artifacts[0], structures: replayed.specialists.structures.length };
    await page.getByRole('button', { name: 'Close session tools', exact: true }).click();await page.screenshot({ path: `${out}/replay-final.png` });
  });
  assert.deepEqual(errors, []);await writeFile(`${out}/browser-proof.json`, JSON.stringify({ source, completedAt: new Date().toISOString(), evidence, actions, errors, final: await snapshot() }, null, 2));
  console.log(`PASS ${Object.keys(evidence).length} evidence entries; ${out}/browser-proof.json`);
  }
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });await writeFile(`${out}/browser-failure.json`, JSON.stringify({ source, error: String(error), errors, evidence, actions, state: await snapshot().catch(() => null), hud: await page.locator('.war-hud').innerText().catch(() => '') }, null, 2));throw error;
} finally { await browser.close(); }
