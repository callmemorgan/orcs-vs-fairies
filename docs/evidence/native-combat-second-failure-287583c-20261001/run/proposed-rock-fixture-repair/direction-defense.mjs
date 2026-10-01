import assert from 'node:assert/strict';

// Intended committed location: scripts/acceptance/direction-defense.mjs.
// Uses the parent's native-context.mjs. No production state/API writes.
export async function runDirectionDefense(ctx) {
  const { page, manifest } = ctx;
  const continuations = [], exports = [], results = {};
  const e = (s, id) => { const item = s.entities.find(item => item.id === id); assert(item, `Entity #${id}`); return item; };
  const hp = (s, id) => s.entities.find(item => item.id === id)?.hp ?? 0;
  const near = (value, expected, name, epsilon = 1e-6) => assert(Math.abs(value - expected) <= epsilon, `${name}: expected ${expected}, got ${value}`);
  const until = (predicate, label, timeout = 30000) => ctx.runUntil(predicate, { timeout, label });
  async function load(name) { const fixture = await ctx.loadScenario(name); await ctx.pause(); assert.equal((await ctx.snap()).mode, 'local'); return fixture; }
  async function verified(name) {
    const file = await ctx.exportAndVerify(name); await ctx.pause();
    assert.equal(file.game.version, manifest.saveVersion);
    assert.equal(file.replay?.simulationRevision, manifest.simulationRevision);
    assert(file.replay?.actions.every(action => action.type !== 'command' || action.side === 0), `${name}: all recorded commands must belong to the native human side`);
    exports.push({ name, file: `${name}-save.json`, tick: file.game.state.tick }); return file;
  }
  function continuation(name, checkpointName, checkpoint, finalName, final) {
    assert(final.game.state.tick > checkpoint.game.state.tick, `${name}: continuation must advance`);
    continuations.push({ name, checkpoint: `${checkpointName}-save.json`, final: `${finalName}-save.json`, checkpointTick: checkpoint.game.state.tick, finalTick: final.game.state.tick, scope: 'Complete original native game and runtime. Existing projection adapter separately labels controller-zero CLI projection; no outer planning parity claim.' });
  }
  async function facing(id, direction) {
    await ctx.selectTroop(id); await ctx.resume(); const panel = await ctx.openTactics();
    await panel.getByLabel('Troop facing', { exact: true }).selectOption(String(direction));
    await panel.getByRole('button', { name: 'Apply facing', exact: true }).click();
    await ctx.wait(({ id, direction }) => window.rts.state.entities.find(item => item.id === id)?.facing === direction, { id, direction });
    await ctx.pause();
  }
  async function attack(source, target) {
    await ctx.selectTroop(source); await ctx.closePanels(); await ctx.resume();
    const before = await ctx.snap(), victim = e(before, target);
    const fogKey = (victim.level ?? 0) * before.width * before.height + Math.floor(victim.y) * before.width + Math.floor(victim.x);
    assert.equal(victim.level ?? 0, before.viewLevel, 'Native attack target must be on the displayed level');
    assert(before.visible[before.viewSide].includes(fogKey), `Native attack target #${target} must be visible before pointer input`);
    await ctx.entityClick(target, 'right');
    await ctx.wait(({ source, target }) => { const order = window.rts.state.entities.find(item => item.id === source)?.order; return order?.type === 'attack' && order.target === target; }, { source, target });
  }
  async function move(source, destination) {
    await ctx.selectTroop(source); await ctx.closePanels(); await ctx.resume(); await ctx.ground({ ...destination, level: 0 }, 'right');
    await ctx.wait(source => window.rts.state.entities.find(item => item.id === source)?.order.type === 'move', source);
  }
  function command(file, predicate, description) { assert(file.replay.actions.some(action => action.type === 'command' && predicate(action.command)), description); }

  for (const direction of ['front', 'side', 'rear']) {
    const name = `flank-${direction}`, { ids } = await load(name), before = await ctx.snap();
    assert.equal(hp(before, ids.target), e(before, ids.target).maxHp);
    await attack(ids.source, ids.target);
    const after = await until(s => hp(s, ids.target) < hp(before, ids.target), `${name} first native hit`);
    near(hp(before, ids.target) - hp(after, ids.target), ids.expectedDamage, `${name} first-hit health loss`);
    assert.equal(e(after, ids.target).facing, 4);
    const saved = await verified(name);
    command(saved, c => c.type === 'attack' && c.ids.includes(ids.source) && c.target === ids.target, `${name} recorded public attack`);
    results[name] = { damage: hp(before, ids.target) - hp(after, ids.target), tick: after.tick };
    ctx.record(`Native ${direction} attack measures held-facing damage`, results[name]); await ctx.screenshot(name);
  }
  assert.deepEqual(['front', 'side', 'rear'].map(direction => results[`flank-${direction}`].damage), [12, 15, 18]);

  for (const kind of ['front', 'turned', 'rear', 'depletion']) {
    const name = `shield-${kind}`, { ids } = await load(name);
    await facing(ids.guard, ids.guardFacing); await facing(ids.target, ids.targetFacing);
    const before = await ctx.snap(); assert.equal(hp(before, ids.target), e(before, ids.target).maxHp, `${name}: no shot before public facing`);
    const checkpointName = `${name}-facing`, checkpoint = await verified(checkpointName);
    command(checkpoint, c => c.type === 'face' && c.ids.includes(ids.guard) && c.facing === ids.guardFacing, `${name} records public guard facing`);
    const after = await until(s => hp(s, ids.target) < hp(before, ids.target), `${name} first enemy weapon hit`);
    near(hp(before, ids.target) - hp(after, ids.target), ids.expectedFirstDamage, `${name} first-hit health loss`);
    const energy = e(after, ids.guard).tactics.guard.value;
    near(energy, kind === 'front' || kind === 'depletion' ? 29.8 : 40, `${name} guard energy`);
    const firstName = `${name}-first-hit`, first = await verified(firstName);
    continuation(`${name} face-to-hit`, checkpointName, checkpoint, firstName, first);
    results[name] = { firstDamage: hp(before, ids.target) - hp(after, ids.target), guardEnergy: energy, tick: after.tick };
    ctx.record(`Native shield ${kind} records health and directional energy`, results[name]); await ctx.screenshot(firstName);
    if (kind === 'depletion') {
      const empty = await until(s => e(s, ids.guard).tactics.guard.value === 0, 'Natural directional guard depletion');
      near(hp(empty, ids.target), 67, 'Four normal Mothbow shots spend the 40-point guard');
      const emptyName = `${name}-empty`, emptySave = await verified(emptyName);
      const full = await until(s => hp(s, ids.target) < hp(empty, ids.target), 'First shot after shield energy is empty');
      near(hp(empty, ids.target) - hp(full, ids.target), 17, 'Depleted shield restores full ranged health damage');
      const fullName = `${name}-unprotected`, fullSave = await verified(fullName);
      continuation('Natural guard depletion and following unprotected hit', emptyName, emptySave, fullName, fullSave);
      results[name].depletedHealth = hp(empty, ids.target); results[name].unprotectedDamage = 17;
      ctx.record('Native guard reaches zero through combat and the next shot deals full damage', results[name]);
    }
  }

  for (const cover of ['none', 'rock', 'building']) {
    const name = `cover-${cover}`, { ids } = await load(name), before = await ctx.snap();
    await attack(ids.source, ids.target);
    const after = await until(s => hp(s, ids.target) < hp(before, ids.target), `${name} first ranged hit`);
    near(hp(before, ids.target) - hp(after, ids.target), ids.expectedDamage, `${name} first-hit health loss`);
    const coveredName = `${name}-first-hit`, coveredSave = await verified(coveredName);
    results[name] = { damage: hp(before, ids.target) - hp(after, ids.target), tick: after.tick };
    ctx.record(`Native ranged attack measures ${cover} cover`, results[name]);
    if (cover === 'building') {
      await move(ids.source, ids.withdrawal);
      await until(s => Math.hypot(e(s, ids.source).x - ids.withdrawal.x, e(s, ids.source).y - ids.withdrawal.y) < .6, 'Mothbow withdraws for demolition');
      const protectedHealth = hp(await ctx.snap(), ids.target);
      await attack(ids.siege, ids.cover);
      const demolished = await until(s => hp(s, ids.cover) === 0, 'Trebuchet destroys covering structure through combat', 45000);
      assert.equal(hp(demolished, ids.target), protectedHealth, 'Demolition splash must not touch the flank target');
      const demolishedName = `${name}-destroyed`, demolishedSave = await verified(demolishedName);
      command(demolishedSave, c => c.type === 'attack' && c.ids.includes(ids.siege) && c.target === ids.cover, 'Cover destruction records native public siege attack');
      await move(ids.siege, { x: 10.5, y: 20.5 });
      await move(ids.source, ids.returnPoint);
      await until(s => Math.hypot(e(s, ids.source).x - ids.returnPoint.x, e(s, ids.source).y - ids.returnPoint.y) < .6, 'Mothbow returns to firing point');
      const exposedBefore = await ctx.snap();
      await attack(ids.source, ids.target);
      const exposed = await until(s => hp(s, ids.target) < hp(exposedBefore, ids.target), 'Native hit after cover destruction');
      near(hp(exposedBefore, ids.target) - hp(exposed, ids.target), 15, 'Destroyed cover restores unprotected Mothbow damage');
      const exposedName = `${name}-uncovered`, exposedSave = await verified(exposedName);
      continuation('Cover combat destruction and next uncovered hit', coveredName, coveredSave, exposedName, exposedSave);
      continuation('Destroyed-cover save resumes into uncovered hit', demolishedName, demolishedSave, exposedName, exposedSave);
      results[name].uncoveredDamage = 15;
      ctx.record('Native siege destruction removes the cover reduction on the following ranged hit', results[name]); await ctx.screenshot(exposedName);
    }
  }

  for (const enabled of [false, true]) {
    const name = `friendly-fire-${enabled ? 'on' : 'off'}`, { ids } = await load(name), before = await ctx.snap();
    assert.equal(before.rules.friendlyFire, enabled);
    await attack(ids.source, ids.target);
    const flight = await until(s => s.projectiles?.some(shot => shot.source === ids.source && shot.impactAt > s.time), `${name} real shell in flight`);
    assert.equal(hp(flight, ids.target), hp(before, ids.target)); assert.equal(hp(flight, ids.friend), hp(before, ids.friend));
    const flightName = `${name}-flight`, flightSave = await verified(flightName);
    assert(flightSave.game.state.projectiles.some(shot => shot.source === ids.source), 'Native exported checkpoint includes the pending projectile');
    const impact = await until(s => hp(s, ids.target) < hp(before, ids.target), `${name} projectile impact`);
    const enemyLoss = hp(before, ids.target) - hp(impact, ids.target), allyLoss = hp(before, ids.friend) - hp(impact, ids.friend);
    assert(enemyLoss > 0); if (enabled) assert(allyLoss > 0); else assert.equal(allyLoss, 0);
    const impactName = `${name}-impact`, impactSave = await verified(impactName);
    continuation(`${name} pending projectile`, flightName, flightSave, impactName, impactSave);
    results[name] = { enemyLoss, allyLoss, flightTick: flight.tick, impactTick: impact.tick };
    ctx.record(`Native pending shell obeys friendly fire ${enabled ? 'on' : 'off'}`, results[name]); await ctx.screenshot(impactName);
  }
  near(results['friendly-fire-on'].enemyLoss, results['friendly-fire-off'].enemyLoss, 'Friendly-fire rule leaves matching enemy impact');

  for (const motion of ['stationary', 'charge', 'stop', 'turn', 'pike-front', 'pike-rear']) {
    const name = `charge-${motion}`, { ids } = await load(name), before = await ctx.snap();
    let checkpoint, checkpointName;
    if (motion === 'stop' || motion === 'turn') {
      await move(ids.source, ids.stopPoint);
      const moving = await until(s => (e(s, ids.source).tactics?.charge?.distance ?? 0) >= 4, `${name} cavalry accumulates four charge tiles`);
      assert(hp(moving, ids.target) === hp(before, ids.target), 'Momentum setup must not hit the target');
      checkpointName = `${name}-moving`; checkpoint = await verified(checkpointName);
      await ctx.selectTroop(ids.source); await ctx.closePanels(); await ctx.resume();
      if (motion === 'stop') {
        await page.keyboard.press('h');
        await ctx.wait(id => window.rts.state.entities.find(item => item.id === id)?.order.type === 'hold', ids.source);
        await until(s => e(s, ids.source).tactics.charge.distance === 0, 'Holding cavalry loses all saved charge');
      } else {
        const rider = e(await ctx.snap(), ids.source);
        await ctx.ground({ x: rider.x, y: rider.y - 2, level: 0 }, 'right');
        const turned = await until(s => e(s, ids.source).facing === 6 && e(s, ids.source).tactics.charge.distance < 1.5, 'Sharp native turn resets previous charge');
        assert.equal(hp(turned, ids.target), hp(before, ids.target));
      }
      const interruptedName = `${name}-interrupted`, interrupted = await verified(interruptedName);
      continuation(`${name} moving save resumes through public interruption`, checkpointName, checkpoint, interruptedName, interrupted);
      checkpointName = interruptedName; checkpoint = interrupted;
      await attack(ids.source, ids.target);
    } else {
      await attack(ids.source, ids.target);
      if (motion !== 'stationary') {
        const moving = await until(s => (e(s, ids.source).tactics?.charge?.distance ?? 0) >= 4 && hp(s, ids.target) === hp(before, ids.target), `${name} charged approach before impact`);
        checkpointName = `${name}-moving`; checkpoint = await verified(checkpointName);
        assert(e(moving, ids.source).order.type === 'attack');
      }
    }
    const impact = await until(s => hp(s, ids.target) < hp(before, ids.target), `${name} first cavalry impact`);
    const finalName = `${name}-impact`, final = await verified(finalName);
    command(final, c => c.type === 'attack' && c.ids.includes(ids.source) && c.target === ids.target, `${name} records native public attack`);
    if (checkpoint) continuation(`${name} native moving/interrupted checkpoint`, checkpointName, checkpoint, finalName, final);
    results[name] = { targetLoss: hp(before, ids.target) - hp(impact, ids.target), riderLoss: hp(before, ids.source) - hp(impact, ids.source), tick: impact.tick, chargeAfter: e(impact, ids.source).tactics.charge?.distance ?? 0 };
    ctx.record(`Native cavalry ${motion} impact records target and rider health`, results[name]); await ctx.screenshot(finalName);
  }
  assert(results['charge-charge'].targetLoss > results['charge-stationary'].targetLoss * 1.5);
  assert(results['charge-stop'].targetLoss < results['charge-charge'].targetLoss);
  assert(results['charge-turn'].targetLoss < results['charge-charge'].targetLoss);
  near(results['charge-pike-front'].targetLoss, 17, 'Frontal braced pike cancels bonus');
  assert(results['charge-pike-front'].riderLoss > 10); assert.equal(results['charge-pike-front'].chargeAfter, 0);
  assert(results['charge-pike-rear'].targetLoss > results['charge-pike-front'].targetLoss * 1.5);
  assert.equal(results['charge-pike-rear'].riderLoss, 0);

  const offset = (kind, slot, count, spacing) => {
    if (kind === 'line') return { x: 0, y: (slot - (count - 1) / 2) * spacing };
    if (kind === 'wedge') { if (!slot) return { x: 0, y: 0 }; const row = Math.ceil(slot / 2); return { x: -row * spacing, y: (slot % 2 ? -1 : 1) * row * spacing * .75 }; }
    const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns), row = Math.floor(slot / columns), inRow = Math.min(columns, count - row * columns), scale = kind === 'loose' ? 1.8 : 1;
    return { x: (row - (rows - 1) / 2) * spacing * scale, y: (slot % columns - (inRow - 1) / 2) * spacing * scale };
  };
  function formed(state, ids, count) {
    const army = ids.army.filter(id => hp(state, id) > 0).sort((a, b) => a - b);
    return army.length === count && army.every((id, slot) => {
      const troop = e(state, id), formation = troop.tactics?.formation, local = offset(ids.formation, slot, count, ids.spacing);
      return formation?.slot === slot && formation.count === count && formation.kind === ids.formation && formation.facing === ids.facing && formation.phase === 'formed' && troop.order.type === 'hold' && troop.facing === ids.facing && Math.hypot(troop.x - ids.destination.x - local.x, troop.y - ids.destination.y - local.y) < .7;
    });
  }
  for (const kind of ['line', 'wedge', 'square', 'loose']) {
    const name = `formation-${kind}`, { ids } = await load(name);
    await ctx.resume(); await ctx.closePanels(); await page.locator('#game-canvas canvas').click({ position: { x: 850, y: 500 } }); await page.keyboard.press('F2');
    await ctx.wait(ids => window.rts.selected.length === ids.length && ids.every(id => window.rts.selected.includes(id)), ids.army);
    const tactics = await ctx.openTactics(); await tactics.getByLabel('Troop facing', { exact: true }).selectOption('0'); await tactics.getByLabel('Formation spacing', { exact: true }).fill('.8');
    await tactics.getByRole('button', { name: kind[0].toUpperCase() + kind.slice(1), exact: true }).click();
    await ctx.wait(({ army, kind }) => army.every(id => window.rts.state.entities.find(item => item.id === id)?.tactics?.formation?.kind === kind), { army: ids.army, kind });
    await ctx.closePanels(); await ctx.ground({ ...ids.destination, level: 0 }, 'right');
    const routeSamples = [], seenTicks = new Set();
    const settled = await until(s => {
      if (!seenTicks.has(s.tick)) { seenTicks.add(s.tick); routeSamples.push({ tick: s.tick, positions: ids.army.map(id => { const troop = e(s, id); return { id, x: troop.x, y: troop.y, hp: troop.hp }; }) }); }
      assert(hp(s, ids.victim) > 0, `${name}: casualty must occur after the six-unit shape arrives`);
      return formed(s, ids, 6);
    }, `${name} mixed army routes around depot and forms`, 30000);
    assert(ids.roles.includes('melee') && ids.roles.includes('ranged') && ids.roles.includes('spear') && ids.roles.includes('cavalry'));
    assert(routeSamples.some(sample => sample.positions.some(troop => troop.x > 23 && troop.x < 26 && Math.abs(troop.y - 20.5) >= 1.27)), 'Native route samples include an obstacle detour');
    const settledName = `${name}-settled`, settledSave = await verified(settledName);
    command(settledSave, c => c.type === 'formation' && c.formation === kind && c.ids.length === 6, `${name} public mixed formation command`);
    command(settledSave, c => c.type === 'move' && c.ids.length === 6, `${name} public group movement command`);
    const casualty = await until(s => hp(s, ids.victim) === 0, `${name} native enemy weapon kills wounded member`, 30000);
    const casualtyName = `${name}-casualty`, casualtySave = await verified(casualtyName);
    const regrouped = await until(s => formed(s, ids, 5), `${name} five survivors regroup after casualty`, 20000);
    const regroupedName = `${name}-regrouped`, regroupedSave = await verified(regroupedName);
    continuation(`${name} settled shape through combat casualty and regroup`, settledName, settledSave, regroupedName, regroupedSave);
    continuation(`${name} casualty save resumes regroup`, casualtyName, casualtySave, regroupedName, regroupedSave);
    results[name] = { army: ids.army, victim: ids.victim, settledTick: settled.tick, casualtyTick: casualty.tick, regroupedTick: regrouped.tick, routeSamples };
    ctx.record(`Native ${kind} mixed army detours around a building and repacks five survivors after combat death`, results[name]); await ctx.screenshot(regroupedName);
  }
  return { sourceCommit: manifest.sourceCommit, saveVersion: manifest.saveVersion, simulationRevision: manifest.simulationRevision, exports, continuations, results, status: 'Native behavior assertions completed; retained histories still require the frozen-source history audit and each scheduled adapter/CLI verification.' };
}
