import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

// Integration destination: scripts/acceptance/specialist-lifecycle.mjs.
// No browser state writes or scene method calls. Native controls issue actions;
// window.rts is read only. The shared runner owns frozen assets and full parity.
export async function runSpecialistLifecycle(ctx) {
  const { page, evidenceDir } = ctx;
  const wait = (fn, value, timeout = 20000) => page.waitForFunction(fn, value, { polling: 20, timeout });
  const snap = async () => { const value = await ctx.snapshot(); return value.state ? { ...value.state, ...value } : value; };
  const entity = (state, id) => { const e = state.entities.find(e => e.id === id); assert(e, `Missing entity #${id}`); return e; };
  const load = async name => { const fixture = await ctx.loadFixture(name); await ctx.resume(); return fixture.ids ?? fixture; };
  const report = async (name, facts) => ctx.record ? ctx.record(name, facts) : ctx.check(name, async () => facts);
  const fullPersistence = async name => {
    const result = await ctx.exportAndVerify(name);
    const file = result?.game ? result : result?.file?.game ? result.file : JSON.parse(await readFile(resolve(evidenceDir, `${name}-save.json`), 'utf8'));
    assert(file.game && file.replay, `${name} must retain a native SAVE and actual recorder archive`);
    await ctx.resume();
    return file;
  };
  const commandActions = file => file.replay.actions.filter(a => a.type === 'command').map(a => a.command);
  const shotKinds = { orcs: 'incendiary', fairies: 'rooting', dwarves: 'cannon', undead: 'corpse', tideborn: 'flood', automata: 'beam' };
  const abilities = {
    orcs: ['Iron Command', 'Impact Fury', 'Incendiary Shell'], fairies: ['Queen’s Step', 'Forest Leap', 'Rooting Shell'],
    dwarves: ['Thane’s Ward', 'Armored Brace', 'Deploy Ammunition'], undead: ['Soul Drain', 'Dread Charge', 'Corpse Bombardment'],
    tideborn: ['Admiral’s Wave', 'Wet-ground Surge', 'Flood Shell'], automata: ['Prime Shield', 'Shield Dash', 'Power Beam'],
  };
  for (const faction of Object.keys(abilities)) {
    const ids = await load(`specialists-${faction}`);
    await ctx.selectUnit(ids.hero); const commanderBefore = await snap();
    await page.getByRole('button', { name: abilities[faction][0], exact: true }).click();
    if (['dwarves', 'automata'].includes(faction)) await ctx.entityClick(ids.cavalry);
    else if (faction === 'undead') await ctx.entityClick(ids.battle);
    else await ctx.ground(faction === 'fairies' ? ids.points.queen : ids.points.command);
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.abilityReadyAt > window.rts.state.time, ids.hero);
    const commanded = await snap(), hero = entity(commanded, ids.hero);
    if (faction === 'orcs') assert(commanded.entities.some(e => e.side === 0 && e.specialistBuffs?.some(b => b.damageFactor === 1.25)));
    if (faction === 'fairies') { assert(Math.hypot(hero.x - ids.points.queen.x, hero.y - ids.points.queen.y) < .3); assert(entity(commanded, ids.engineer).hp > entity(commanderBefore, ids.engineer).hp); }
    if (faction === 'dwarves') assert(entity(commanded, ids.cavalry).hp > entity(commanderBefore, ids.cavalry).hp);
    if (faction === 'automata') assert.equal(entity(commanded, ids.cavalry).shield, 60);
    if (['undead', 'tideborn'].includes(faction)) assert(hero.hp > entity(commanderBefore, ids.hero).hp);
    if (faction === 'undead') assert(entity(commanded, ids.battle).hp < entity(commanderBefore, ids.battle).hp);

    await ctx.selectUnit(ids.cavalry); const cavalryBefore = await snap(), riderBefore = entity(cavalryBefore, ids.cavalry);
    await page.getByRole('button', { name: abilities[faction][1], exact: true }).click();
    if (['fairies', 'automata'].includes(faction)) await ctx.ground(ids.points.leap);
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.abilityReadyAt > window.rts.state.time, ids.cavalry);
    const ridden = await snap(), rider = entity(ridden, ids.cavalry);
    if (['fairies', 'automata'].includes(faction)) assert(Math.hypot(rider.x - riderBefore.x, rider.y - riderBefore.y) > 2);
    if (faction === 'automata') { const spent = riderBefore.shield - rider.shield; assert(spent > 0 && Math.abs(spent - 15) <= 4 * (ridden.time - cavalryBefore.time) + 1e-6); }
    if (faction === 'orcs') assert(rider.specialistBuffs.some(b => b.damageFactor === 1.35));
    if (faction === 'dwarves') assert(rider.specialistBuffs.some(b => b.armor === 5 && b.speedFactor === .75));
    if (faction === 'undead') assert(entity(ridden, ids.battle).specialistBuffs.some(b => b.fearedFrom));
    if (faction === 'tideborn') assert(rider.specialistBuffs.some(b => b.speedFactor === 1.6 && b.damageFactor === 1.2));

    await ctx.selectUnit(ids.siege); const paidBefore = await snap(), targetHp = entity(paidBefore, ids.shellTarget).hp;
    await page.getByRole('button', { name: abilities[faction][2], exact: true }).click();
    await wait(id => !!window.rts.state.entities.find(e => e.id === id)?.siegeMode, ids.siege);
    const paid = await snap();
    for (const [resource, expected] of Object.entries(faction === 'orcs' ? { wood: 8 } : faction === 'dwarves' ? { ore: 15 } : faction === 'automata' ? { crystal: 8 } : ['fairies', 'tideborn'].includes(faction) ? { crystal: 6 } : {})) assert.equal(paidBefore.players[0][resource] - paid.players[0][resource], expected);
    if (faction === 'undead') assert.equal(paid.corpses.length, 0);
    await ctx.entityClick(ids.shellTarget, 'right');
    await ctx.runUntil(s => s.specialists?.shots?.some(shot => shot.source.id === ids.siege && shot.payload.kind === shotKinds[faction] && shot.impactAt > s.time), { timeout: 12000, label: `${faction} pending payload` });
    const pendingFile = await fullPersistence(`specialists-${faction}-pending`);
    const pending = pendingFile.game.state;
    assert(pending.specialists.shots.some(s => s.source.id === ids.siege && s.payload.kind === shotKinds[faction] && s.impactAt > pending.time));
    assert.equal(entity(pending, ids.shellTarget).hp, targetHp, 'Pending payload has not damaged its target');
    await ctx.runUntil(s => {
      const e = s.entities.find(e => e.id === ids.shellTarget);
      if (!e || e.hp >= targetHp) return false;
      return faction === 'orcs' ? !!e.burning?.length : faction === 'fairies' ? !!e.specialistBuffs?.some(b => b.rooted) : faction === 'tideborn' ? !!e.specialistBuffs?.some(b => b.speedFactor === .5) : true;
    }, { timeout: 12000, label: `${faction} active payload effect` });
    const impactFile = await fullPersistence(`specialists-${faction}-active`), impact = impactFile.game.state;
    assert(entity(impact, ids.shellTarget).hp < targetHp);
    if (faction === 'orcs') assert(entity(impact, ids.shellTarget).burning?.some(b => b.until > impact.time));
    if (faction === 'fairies') assert(entity(impact, ids.shellTarget).specialistBuffs?.some(b => b.rooted && b.until > impact.time));
    if (faction === 'tideborn') assert(entity(impact, ids.shellTarget).specialistBuffs?.some(b => b.speedFactor === .5 && b.until > impact.time));
    const actions = commandActions(impactFile);
    for (const id of [ids.hero, ids.cavalry, ids.siege]) assert(actions.some(c => c.type === 'ability' && c.ids.includes(id)), `Recorder contains ${faction} specialist ability #${id}`);
    assert(actions.some(c => c.type === 'attack' && c.ids.includes(ids.siege) && c.target === ids.shellTarget));
    await ctx.selectUnit(ids.siege); await ctx.screenshot(`specialists-${faction}-active`);
    await report(`${faction} native specialists retain pending payload and active effects in full save/replay parity`, { hero: ids.hero, cavalry: ids.cavalry, siege: ids.siege, pendingTick: pending.tick, activeTick: impact.tick, payload: shotKinds[faction], targetHealthBefore: targetHp, targetHealthAfter: entity(impact, ids.shellTarget).hp });
  }

  {
    const ids = await load('specialists-veteran');
    assert.equal(entity(await snap(), ids.hero).veteran?.experience ?? 0, 0);
    await ctx.selectUnit(ids.hero); await ctx.entityClick(ids.victim, 'right');
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.veteran?.pendingPromotion === 1, ids.hero, 25000);
    await ctx.pause(); const earned = entity(await snap(), ids.hero);
    assert(earned.veteran.experience >= 40 && earned.veteran.experience < 100 && earned.veteran.promotions.length === 0);
    assert.match(await page.locator('#selection-veteran').innerText(), /Veteran.*Rank 1.*Choose a promotion/);
    await ctx.resume();
    const crop = await rankCrop(page, ctx, earned, resolve(evidenceDir, 'specialists-earned-insignia.png'));
    assert(crop.rankColorPixels >= 3, 'Rank-1 chevron is visible in native canvas pixels above the commander');
    await ctx.resume();
    const promotion = page.getByRole('button', { name: 'Promote Gorak Ironvoice: Bulwark', exact: true });
    await promotion.dblclick({ delay: 0 });
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.veteran?.promotions.length === 1, ids.hero);
    assert.equal(await page.getByRole('button', { name: 'Promote Gorak Ironvoice: Bulwark', exact: true }).count(), 0, 'A duplicate choice is unavailable after the first promotion');
    const file = await fullPersistence('specialists-earned-promotion');
    assert.deepEqual(entity(file.game.state, ids.hero).veteran.promotions, [{ rank: 1, id: 'bulwark' }]);
    const accepted = commandActions(file).filter(c => c.type === 'promote' && c.id === ids.hero);
    assert.deepEqual(accepted, [{ type: 'promote', id: ids.hero, promotion: 'bulwark' }]);
    await report('Combat-earned native veteran insignia and duplicate promotion guard', { hero: ids.hero, earnedExperience: earned.veteran.experience, acceptedPromotions: accepted.length, unavailableDuplicateChoice: true, canvasCrop: crop });
  }

  {
    const ids = await load('specialists-recovery');
    await ctx.selectBuilding(ids.hall);
    const recruit = page.getByRole('button', { name: 'Gorak Ironvoice', exact: true });
    assert.equal(await recruit.getAttribute('aria-disabled'), 'true'); assert.match(await recruit.getAttribute('data-tooltip'), /commander.*alive/i);
    await ctx.selectUnit(ids.hero);
    await page.getByRole('button', { name: 'Recover Iron Aegis', exact: true }).click();
    await wait(({ hero, artifact }) => window.rts.state.specialists.artifacts.some(a => a.id === artifact && a.holder === hero), { hero: ids.hero, artifact: ids.artifact });
    await page.getByRole('button', { name: 'Equip Iron Aegis', exact: true }).click();
    await ctx.ground(ids.march, 'right');
    await wait(id => !window.rts.state.entities.some(e => e.id === id && e.hp > 0), ids.hero, 18000);
    await ctx.pause(); const dead = await snap(), recovery = dead.players[0].heroRecovery.find(r => r.definitionId === 'core:orcs-commander');
    assert(recovery && recovery.availableAt > dead.time && recovery.availableAt <= dead.time + 30);
    const dropped = dead.specialists.artifacts.find(a => a.id === ids.artifact);
    assert(dropped.position && dropped.holder === undefined && dropped.owner === undefined);
    assert.equal(dead.specialists.artifacts.length, 2, 'Death drops held item and one finite commander loot item');
    const deathFile = await fullPersistence('specialists-death-recovery');
    assert.equal(commandActions(deathFile).filter(c => c.type === 'train' && c.definitionId === 'core:orcs-commander').length, 0);
    await ctx.resume(); await ctx.selectBuilding(ids.hall);
    assert.equal(await recruit.getAttribute('aria-disabled'), 'true'); assert.match(await recruit.getAttribute('data-tooltip'), /Commander recovery/);
    await wait(at => window.rts.state.time >= at - 1.5, recovery.availableAt, 40000);
    assert.equal(await recruit.getAttribute('aria-disabled'), 'true');
    const stillRecovering = await snap(); assert(stillRecovering.time < recovery.availableAt); assert.match(await recruit.getAttribute('data-tooltip'), /Commander recovery/);
    await wait(at => window.rts.state.time >= at, recovery.availableAt, 8000);
    await wait(() => document.querySelector('[aria-label="Gorak Ironvoice"]')?.getAttribute('aria-disabled') === 'false');
    const before = await snap(); await recruit.click();
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.queueDefinitionIds?.includes('core:orcs-commander'), ids.hall);
    const queued = await snap(); for (const [resource, cost] of Object.entries({ wood: 150, ore: 110, crystal: 25 })) assert.equal(before.players[0][resource] - queued.players[0][resource], cost);
    assert.equal(await recruit.getAttribute('aria-disabled'), 'true'); assert.match(await recruit.getAttribute('data-tooltip'), /alive or queued/);
    const queuedFile = await fullPersistence('specialists-paid-rerecruit-queued');
    assert.equal(commandActions(queuedFile).filter(c => c.type === 'train' && c.definitionId === 'core:orcs-commander').length, 1);
    await wait(old => window.rts.state.entities.some(e => e.id !== old && e.definitionId === 'core:orcs-commander' && e.hp > 0), ids.hero, 35000);
    const rerecruited = await fullPersistence('specialists-paid-rerecruit-complete');
    const living = rerecruited.game.state.entities.filter(e => e.side === 0 && e.definitionId === 'core:orcs-commander' && e.hp > 0);
    assert.equal(living.length, 1); assert.notEqual(living[0].id, ids.hero);
    await ctx.selectBuilding(ids.hall);
    assert.equal(await recruit.getAttribute('aria-disabled'), 'true'); assert.match(await recruit.getAttribute('data-tooltip'), /commander.*alive/i);
    await report('Native commander defeat, artifact drop, timed recovery and paid rerecruitment', { defeated: ids.hero, rerecruited: living[0].id, recoveryAvailableAt: recovery.availableAt, lastBlockedTime: stillRecovering.time, fullCost: { wood: 150, ore: 110, crystal: 25 }, acceptedRecruitments: 1 });
  }

  {
    const results = [];
    for (const equipped of [false, true]) {
      const ids = await load('specialists-artifact-damage'); await ctx.selectUnit(ids.engineer);
      await page.getByRole('button', { name: 'Recover Ember Blade', exact: true }).click();
      if (equipped) await page.getByRole('button', { name: 'Equip Ember Blade', exact: true }).click();
      await ctx.entityClick(ids.target, 'right');
      await ctx.runUntil(s => s.events.some(e => e.type === 'attack' && e.source === ids.engineer && e.target === ids.target && e.amount > 0), { timeout: 15000, label: 'first artifact comparison hit' });
      const file = await fullPersistence(equipped ? 'specialists-artifact-equipped-hit' : 'specialists-artifact-baseline-hit');
      const hits = file.game.state.events.filter(e => e.type === 'attack' && e.source === ids.engineer && e.target === ids.target);
      assert.equal(hits.length, 1, 'Compare one real hit at each native endpoint');
      assert(commandActions(file).some(c => c.type === 'attack' && c.ids.includes(ids.engineer) && c.target === ids.target));
      results.push({ equipped, tick: file.game.state.tick, amount: hits[0].amount, hp: entity(file.game.state, ids.target).hp });
    }
    assert(results[1].amount > results[0].amount * 1.24); assert(results[1].hp < results[0].hp);
    await report('Equipped Ember Blade increases real native combat damage', { baseline: results[0], equipped: results[1] });
  }

  {
    const ids = await load('specialists-bridge-crossing'); await ctx.selectUnit(ids.traveler);
    await ctx.ground(ids.destination, 'right'); const commandedAt = (await snap()).time;
    await wait(at => window.rts.state.time >= at + 3, commandedAt, 8000);
    const blocked = entity(await snap(), ids.traveler); assert(blocked.x < 17); assert.equal(blocked.path.length, 0);
    await ctx.selectUnit(ids.engineer); const before = await snap();
    await page.getByRole('button', { name: 'Temporary bridge', exact: true }).click(); await ctx.ground(ids.bridge);
    await wait(() => window.rts.state.specialists.structures.some(s => s.kind === 'bridge'));
    const built = await snap(), bridge = built.specialists.structures.find(s => s.kind === 'bridge'); assert.equal(before.players[0].wood - built.players[0].wood, 60);
    assert.equal(bridge.tiles.length, 3);
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.x > 20.5, ids.traveler, 18000);
    await ctx.selectUnit(ids.occupant); await ctx.ground(ids.bridge, 'right');
    await wait(({ id, point }) => { const e = window.rts.state.entities.find(e => e.id === id); return e && Math.hypot(e.x - point.x, e.y - point.y) < .5; }, { id: ids.occupant, point: ids.bridge }, 18000);
    await page.keyboard.press('h');
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.order.type === 'hold', ids.occupant);
    await fullPersistence('specialists-bridge-crossed');
    await wait(at => window.rts.state.time >= at - .6, bridge.expires, 70000); await ctx.pause();
    const beforeExpiry = await snap(); assert(beforeExpiry.time < bridge.expires);
    assert(beforeExpiry.specialists.structures.some(s => s.id === bridge.id));
    await fullPersistence('specialists-bridge-before-expiry'); await ctx.resume();
    await wait(id => !window.rts.state.specialists.structures.some(s => s.id === id), bridge.id, 8000);
    const file = await fullPersistence('specialists-bridge-expired'), state = file.game.state;
    for (const tile of bridge.tiles) assert.equal(state.world.levels[tile.level ?? 0].terrain[Math.floor(tile.y) * state.width + Math.floor(tile.x)], 'water');
    assert(entity(state, ids.traveler).x > 20.5);
    const relocated = entity(state, ids.occupant); assert(relocated.hp > 0 && relocated.order.type === 'idle');
    assert.equal(state.world.levels[relocated.level ?? 0].terrain[Math.floor(relocated.y) * state.width + Math.floor(relocated.x)], 'grass');
    assert(state.events.some(e => e.source === ids.occupant && e.text === 'Temporary bridge expired; moved to nearby shore.'));
    await report('Native paid engineer bridge opens an impassable route and restores water on expiry', { traveler: ids.traveler, blockedX: blocked.x, crossedX: entity(state, ids.traveler).x, bridgeExpiresAt: bridge.expires, lastPresentTime: beforeExpiry.time, expiredTime: state.time, occupantMovedToShore: { id: relocated.id, x: relocated.x, y: relocated.y } });
  }

  {
    const ids = await load('specialists-barricade-obstruction'); await ctx.selectUnit(ids.engineer); const before = await snap();
    await page.getByRole('button', { name: 'Field barricade', exact: true }).click(); await ctx.ground(ids.barricade);
    await wait(() => window.rts.state.specialists.structures.some(s => s.kind === 'barricade'));
    const built = await snap(), barricade = built.specialists.structures.find(s => s.kind === 'barricade');
    assert.equal(before.players[0].wood - built.players[0].wood, 35); assert.equal(before.players[0].ore - built.players[0].ore, 15);
    await ctx.selectUnit(ids.traveler); await ctx.ground(ids.destination, 'right');
    const orderAt = (await snap()).time; await wait(at => window.rts.state.time >= at + 4, orderAt, 10000);
    const blocked = entity(await snap(), ids.traveler); assert(blocked.x < 14); assert.equal(blocked.path.length, 0);
    await fullPersistence('specialists-barricade-obstructs');
    await wait(id => !window.rts.state.specialists.structures.some(s => s.id === id), barricade.id, 70000);
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.x > 21, ids.traveler, 18000);
    const file = await fullPersistence('specialists-barricade-expired-crossed'), state = file.game.state;
    assert(!state.entities.some(e => e.id === barricade.entityId && e.hp > 0));
    await report('Native paid barricade blocks the only corridor until expiry and then permits crossing', { traveler: ids.traveler, obstruction: barricade.entityId, blockedX: blocked.x, crossedX: entity(state, ids.traveler).x, expiresAt: barricade.expires, crossingTime: state.time });
  }

  {
    const ids = await load('specialists-beacon-link');
    await ctx.selectUnit(ids.observer); await ctx.selectBuilding(ids.second);
    await wait(id => window.rts.state.events.some(e => e.source === id && e.text === 'Beacon invasion alert.'), ids.second);
    assert.match(await page.locator('#selection-beacon').innerText(), /Beacon connected.*Invasion alert/);
    const seen = await fogRead(page, ids.farTile); assert(seen.visible && seen.explored);
    const connected = await fullPersistence('specialists-beacon-connected-alert');
    assert(entity(connected.game.state, ids.second).beacon.connected);
    assert(!connected.game.state.events.some(e => e.type === 'attack' && [ids.first, ids.second].includes(e.source)), 'Beacons grant sight without attacking');
    await wait(id => !window.rts.state.entities.some(e => e.id === id && e.hp > 0), ids.first, 25000);
    await wait(id => window.rts.state.entities.find(e => e.id === id)?.beacon.connected === false, ids.second);
    await ctx.selectBuilding(ids.second); assert.match(await page.locator('#selection-beacon').innerText(), /Beacon disconnected/);
    const lost = await fogRead(page, ids.farTile); assert.equal(lost.visible, false); assert.equal(lost.explored, true);
    const file = await fullPersistence('specialists-beacon-link-destroyed'), state = file.game.state;
    assert(state.events.some(e => e.type === 'attack' && e.source === ids.destroyer && e.target === ids.first && e.amount > 0));
    assert(state.events.some(e => e.type === 'death' && e.source === ids.first));
    assert.equal(entity(state, ids.second).beacon.connected, false);
    await ctx.screenshot('specialists-beacon-disconnected');
    await report('Native beacon intrusion alert, combat link destruction and current-sight loss', { first: ids.first, surviving: ids.second, attacker: ids.destroyer, farTile: ids.farTile, connectedSight: seen, disconnectedSight: lost, tick: state.tick });
  }
}

async function fogRead(page, point) {
  return page.evaluate(p => { const s = window.rts.state, key = (p.level ?? 0) * s.width * s.height + Math.floor(p.y) * s.width + Math.floor(p.x); return { key, visible: s.visible[0].has(key), explored: s.explored[0].has(key) }; }, point);
}

async function rankCrop(page, ctx, hero, path) {
  const ground = await ctx.point(hero.x, hero.y);
  const camera = await page.evaluate(() => window.rts.camera), viewport = page.viewportSize();
  // Commander SVG anchor y=112, visualTop=20. Renderer places rank chevron
  // 15 world pixels above that top: groundY - 107. Rank 1 color is #dca676.
  const centerY = ground.y - 107 * camera.zoom;
  const clip = { x: Math.max(0, Math.floor(ground.x - 18 * camera.zoom)), y: Math.max(0, Math.floor(centerY - 8 * camera.zoom)), width: Math.ceil(36 * camera.zoom), height: Math.ceil(16 * camera.zoom) };
  assert(clip.x + clip.width <= viewport.width && clip.y + clip.height <= viewport.height, 'Rank crop is inside the viewport');
  await assert.rejects(readFile(path), { code: 'ENOENT' }, 'Rank crop must use a fresh retained artifact path');
  const bytes = await page.screenshot({ path, clip, animations: 'disabled' });
  const png = decodePng(bytes); let rankColorPixels = 0;
  for (let i = 0; i < png.pixels.length; i += png.channels) if (Math.abs(png.pixels[i] - 220) <= 3 && Math.abs(png.pixels[i + 1] - 166) <= 3 && Math.abs(png.pixels[i + 2] - 118) <= 3) rankColorPixels++;
  return { file: path, clip, rank: 1, expectedRgb: [220, 166, 118], rankColorPixels, renderer: 'src/game/GameScene.ts rank overlay; src/core/specialist-content.ts commander SVG anchor/visualTop' };
}

function decodePng(bytes) {
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  let width, height, channels; const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); assert.equal(data[8], 8); assert([2, 6].includes(data[9])); assert.equal(data[12], 0); channels = data[9] === 6 ? 4 : 3; }
    if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  assert.equal(raw.length, (stride + 1) * height);
  const paeth = (a, b, c) => { const p = a + b - c, aa = Math.abs(p - a), bb = Math.abs(p - b), cc = Math.abs(p - c); return aa <= bb && aa <= cc ? a : bb <= cc ? b : c; };
  for (let y = 0; y < height; y++) { const filter = raw[y * (stride + 1)]; assert(filter <= 4);
    for (let x = 0; x < stride; x++) { const left = x >= channels ? pixels[y * stride + x - channels] : 0, above = y ? pixels[(y - 1) * stride + x] : 0, upperLeft = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      pixels[y * stride + x] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}
