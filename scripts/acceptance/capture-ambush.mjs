import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const find = (state, id) => {
  const entity = state.entities.find(item => item.id === id);
  assert(entity, `Expected entity #${id}`); return entity;
};
const commands = file => file.replay.actions.filter(action => action.type === 'command');
function accepted(file, type, id, target) {
  assert(commands(file).some(action => action.side === 0 && action.command.type === type
    && (action.command.ids?.includes(id) || action.command.id === id)
    && (target === undefined || action.command.target === target)), `Native replay must retain accepted ${type} for #${id}`);
}

/** Operates only native controls; evaluate/wait inspect the readonly rts getter. */
async function arm(ctx, id, radius, target) {
  await ctx.resume(); await ctx.selectTroop(id); const panel = await ctx.openTactics();
  await panel.getByLabel('Ambush trigger radius', { exact: true }).fill(String(radius));
  await panel.getByLabel('Ambush target', { exact: true }).selectOption(target);
  const button = panel.getByRole('button', { name: 'Set ambush', exact: true });
  assert(await button.isEnabled(), 'Standing timber enables the native ambush control');
  await button.click();
  await ctx.wait(({ id, radius, target }) => {
    const entity = window.rts.state.entities.find(item => item.id === id), ambush = entity?.tactics?.ambush;
    return ambush?.radius === radius && ambush?.target === target && ambush.concealed;
  }, { id, radius, target });
  assert.match(await panel.getByLabel('Selected unit tactics', { exact: true }).innerText(), new RegExp(`Ambush concealed.*${target} within ${radius}`));
}

async function restore(ctx, name) {
  await ctx.importSave(resolve(ctx.out, `${name}-save.json`), `${name} after observer inspection`);
  await ctx.closeSessions();
}

/** Compare a real paused native replay renderer to PlayerView of the original download. */
async function observer(ctx, name, original, { side = 1, centerTroop, id, visible }) {
  assert.equal(typeof ctx.observeNative, 'function', 'A frozen-source PlayerView adapter is required');
  await ctx.openSessions('replay');
  await ctx.sessions.getByLabel('Import replay JSON', { exact: true }).setInputFiles(resolve(ctx.out, `${name}-replay.json`));
  await ctx.sessions.getByRole('button', { name: 'Import replay', exact: true }).click();
  await ctx.wait(() => document.querySelector('[aria-label="Import replay JSON"]')?.files?.length === 0
    && [...document.querySelectorAll('.session-notice')].some(item => !item.hidden && item.textContent === 'Replay loaded.'), null, 60000);
  await ctx.wait(() => window.rts.mode === 'replay'); await ctx.ready();
  await ctx.sessions.getByLabel('Replay tick', { exact: true }).press('End');
  await ctx.wait(tick => window.rts.state.tick === tick, original.game.state.tick, 60000);
  await ctx.sessions.getByLabel('Replay perspective', { exact: true }).selectOption(String(side));
  await ctx.wait(side => window.rts.viewSide === side, side);
  await ctx.closeSessions();
  await ctx.selectTroop(centerTroop);
  const view = await ctx.observeNative(original, side, 0);
  assert.equal(view.ids.includes(id), visible, `Player ${side + 1} visibility for #${id}`);
  assert(view.visible.includes(Math.floor(find(original.game.state, id).y) * original.game.state.width + Math.floor(find(original.game.state, id).x)), 'The ambusher tile itself is visible, so this check proves concealment beyond ordinary fog');
  if (visible) {
    const observed = view.entities.find(item => item.id === id);
    assert(observed && !Object.hasOwn(observed.tactics ?? {}, 'ambush'), 'Enemy observations must omit private trigger metadata');
  }
  // drawActors has no camera culling. ArtRuntime counts living atlas-rendered units,
  // excludes buildings/resources/dead units, and resets the counter every frame.
  // These encounters use loaded builtin art; expected counts exclude other levels.
  await ctx.wait(expected => window.rts.art.loaded && window.rts.viewLevel === 0
    && window.rts.art.renderedUnits === expected, view.renderedUnits);
  const state = await ctx.snap();
  assert.equal(state.tick, original.game.state.tick); assert.equal(state.mode, 'replay'); assert(state.paused);
  assert.equal(state.viewSide, side); assert.equal(state.art.renderedUnits, view.renderedUnits);
  ctx.record(`${name} native replay perspective applies observer concealment`, {
    tick: state.tick, side, ambusher: id, expectedVisible: visible,
    observedIds: view.ids, expectedRenderedUnits: view.renderedUnits, actualRenderedUnits: state.art.renderedUnits,
    centeredThroughNativeRoster: centerTroop, art: state.art,
    scope: 'PlayerView uses the original native download. Native replay rendering uses the selected perspective. The count covers builtin living units on the active level, without camera culling.',
  });
  await ctx.screenshot(`${name}-player-${side + 1}`);
  await restore(ctx, name);
}

export async function runCaptureAmbushMorale(ctx) {
  assert.equal(typeof ctx.exportAndVerify, 'function');
  const retained = [];
  const save = async name => { const file = await ctx.exportAndVerify(name); retained.push(`${name}-save.json`); return file; };

  {
    const { ids, authored } = await ctx.loadScenario('siege-full-crew-capture');
    await ctx.resume(); await ctx.selectTroop(ids.captor); await ctx.entityClick(ids.engine, 'right');
    await ctx.wait(({ captor, engine }) => {
      const entity = window.rts.state.entities.find(item => item.id === captor);
      return entity?.order.type === 'attack' && entity.order.target === engine;
    }, ids);
    const defeated = await ctx.runUntil(state => find(state, ids.engine).tactics.siegeCrew.uncrewed, { timeout: 20000, label: 'Full siege crew dies through native combat' });
    const engine = find(defeated, ids.engine);
    assert.equal(authored.engineCrewHealth, 42); assert.equal(engine.tactics.siegeCrew.hp, 0);
    assert.equal(engine.hp, authored.engineHullHealth); assert.equal(engine.side, 1);
    // runUntil paused at the crew death. Stop the attack while its next cooldown
    // is still active, before any export/import can resume this encounter.
    await ctx.resume(); await ctx.page.getByRole('button', { name: /^Hold position(?:\s|$)/ }).click(); await ctx.pause();
    const crewless = await save('siege-crew-defeated');
    accepted(crewless, 'attack', ids.captor, ids.engine);
    assert.equal(find(crewless.game.state, ids.engine).hp, authored.engineHullHealth);
    ctx.record('Full siege crew is defeated by native attacks while its hull survives', { engine: find(crewless.game.state, ids.engine), authoredCrew: authored.engineCrewHealth });

    await ctx.resume(); await ctx.selectTroop(ids.captor); await ctx.closePanels();
    const panel = await ctx.openTactics();
    await panel.getByLabel('Abandoned siege engine', { exact: true }).selectOption(String(ids.engine));
    await panel.getByRole('button', { name: 'Capture siege engine', exact: true }).click();
    await ctx.runUntil(state => {
      const capture = find(state, ids.captor).tactics?.capture;
      return capture?.target === ids.engine && capture.progress >= .35 && capture.progress < .75;
    }, { timeout: 15000, label: 'Capture reaches a genuine incomplete channel' });
    const partial = await save('siege-mid-capture');
    const progress = find(partial.game.state, ids.captor).tactics.capture.progress;
    assert(progress > 0 && progress < 1); assert(find(partial.game.state, ids.engine).tactics.siegeCrew.uncrewed);
    accepted(partial, 'captureSiege', ids.captor, ids.engine);
    ctx.record('Native mid-capture save retains incomplete channel and abandoned equipment', { tick: partial.game.state.tick, captor: ids.captor, engine: ids.engine, progress });

    await ctx.runUntil(state => find(state, ids.engine).side === 0 && !find(state, ids.engine).tactics.siegeCrew.uncrewed, { timeout: 15000, label: 'Restored mid-capture channel replaces the crew' });
    const captured = await save('siege-new-owner');
    const owned = find(captured.game.state, ids.engine);
    assert.equal(owned.definitionFaction, 'orcs'); assert.equal(owned.definitionId, authored.engineDefinitionId);
    assert.equal(owned.maxHp, authored.engineHullHealth); assert.equal(owned.hp, authored.engineHullHealth);
    assert.equal(owned.tactics.siegeCrew.hp, 42); assert.equal(owned.side, 0);
    assert.equal(find(captured.game.state, ids.captor).tactics.capture, undefined);

    await ctx.resume(); await ctx.selectTroop(ids.engine); await ctx.ground(ids.moveDestination, 'right');
    await ctx.runUntil(state => {
      const moved = find(state, ids.engine);
      return Math.hypot(moved.x - ids.moveDestination.x, moved.y - ids.moveDestination.y) < .8 && moved.order.type !== 'move';
    }, { timeout: 20000, label: 'New owner moves the original Orc engine' });
    const moved = await save('siege-new-owner-moved');
    accepted(moved, 'move', ids.engine);
    assert(find(moved.game.state, ids.engine).x > find(partial.game.state, ids.engine).x + 4);

    await ctx.resume(); await ctx.selectTroop(ids.engine); await ctx.entityClick(ids.target, 'right');
    await ctx.runUntil(state => (state.projectiles ?? []).some(shell => shell.source === ids.engine && shell.side === 0), { timeout: 20000, label: 'Captured engine fires for its new owner' });
    const inFlight = await save('siege-new-owner-pending-shot');
    accepted(inFlight, 'attack', ids.engine, ids.target);
    const shell = inFlight.game.state.projectiles.find(item => item.source === ids.engine);
    assert(shell); assert.equal(shell.side, 0); assert.equal(shell.faction, 'orcs');
    assert.equal(find(inFlight.game.state, ids.target).hp, authored.targetHealth);
    await ctx.runUntil(state => find(state, ids.target).hp < authored.targetHealth, { timeout: 15000, label: 'Restored new-owner shell damages its target' });
    const impact = await save('siege-new-owner-impact');
    const loss = authored.targetHealth - find(impact.game.state, ids.target).hp;
    assert(loss > 0);
    ctx.record('Captured engine moves and fires for its new owner, retaining original Orc weapon and pending shell', {
      midCaptureTick: partial.game.state.tick, moveTick: moved.game.state.tick, pendingTick: inFlight.game.state.tick,
      impactTick: impact.game.state.tick, engine: find(impact.game.state, ids.engine), shell, damage: loss,
      continuationPairs: [['siege-mid-capture-save.json', 'siege-new-owner-impact-save.json'], ['siege-new-owner-pending-shot-save.json', 'siege-new-owner-impact-save.json']],
    });
  }

  {
    const { ids, authored } = await ctx.loadScenario('surrounded-surrender');
    await ctx.runUntil(state => find(state, ids.broken).side === 0, { label: 'Surrounded enemy surrenders through native engine ticks' });
    const surrendered = await save('surrounded-surrender');
    const broken = find(surrendered.game.state, ids.broken);
    assert.equal(broken.hp, authored.brokenHealth); assert.equal(broken.maxHp, authored.brokenMaxHealth);
    assert.equal(broken.definitionFaction, authored.originalFaction); assert.equal(broken.definitionId, authored.originalDefinitionId);
    assert.equal(broken.tactics.surrenderedTo, 0); assert.equal(broken.tactics.retreat, undefined);
    await ctx.resume(); await ctx.selectTroop(ids.broken); await ctx.ground(ids.moveDestination, 'right');
    await ctx.runUntil(state => find(state, ids.broken).x > 27.5, { timeout: 15000, label: 'New owner controls a surrendered original Deepforge troop' });
    const moved = await save('surrounded-surrender-moved'); accepted(moved, 'move', ids.broken);
    assert.equal(find(moved.game.state, ids.broken).hp, authored.brokenHealth);
    ctx.record('Native surrender retains wounded health and original Deepforge definition through save, replay and new-owner movement', { before: authored, surrendered: broken, moved: find(moved.game.state, ids.broken) });
  }

  {
    const { ids, authored } = await ctx.loadScenario('active-retreat-save');
    await ctx.runUntil(state => !!find(state, ids.retreater).tactics?.retreat, { timeout: 15000, label: 'Isolation and wounds trigger morale retreat' });
    const active = await save('morale-active-retreat');
    const retreater = find(active.game.state, ids.retreater);
    assert(retreater.tactics.morale < 22); assert(retreater.tactics.retreat);
    assert(retreater.tactics.retreat.until > active.game.state.time); assert.equal(retreater.order.type, 'move');
    assert.equal(retreater.hp, authored.retreaterHealth); assert(retreater.x < 22.5);
    await ctx.runUntil(state => !find(state, ids.retreater).tactics?.retreat && find(state, ids.retreater).tactics.morale >= 30, { timeout: 25000, label: 'Restored active retreat reaches support and recovers' });
    const recovered = await save('morale-retreat-recovered');
    const after = find(recovered.game.state, ids.retreater);
    assert.equal(after.order.type, 'hold'); assert.equal(after.hp, authored.retreaterHealth); assert(after.x < retreater.x);
    ctx.record('Active native morale retreat survives save/import and replay, then recovers near support', {
      activeTick: active.game.state.tick, recoveredTick: recovered.game.state.tick, active: retreater, recovered: after,
      continuationPairs: [['morale-active-retreat-save.json', 'morale-retreat-recovered-save.json']],
    });
  }

  {
    const { ids, authored } = await ctx.loadScenario('ambush-selected-trigger');
    await ctx.resume(); await ctx.selectTroop(ids.dryTroop); const dry = await ctx.openTactics();
    assert(!(await dry.getByRole('button', { name: 'Set ambush', exact: true }).isEnabled()));
    assert.match(await dry.innerText(), /Move selected troops into woodland or beside standing trees first/);
    ctx.record('Native Tactics control rejects an ambush outside standing timber', { dryTroop: ids.dryTroop });
    await arm(ctx, ids.ambusher, authored.radius, authored.target);
    const ready = await ctx.runUntil(state => {
      const ambusher = find(state, ids.ambusher), foe = find(state, ids.trigger);
      return ambusher.cooldown === 0 && ambusher.tactics?.ambush?.concealed
        && Math.hypot(foe.x - ambusher.x, foe.y - ambusher.y) > authored.radius + .5;
    }, { timeout: 15000, label: 'Armed ambusher becomes ready while the wrong role remains inside its radius' });
    await ctx.runUntil(state => {
      const ambusher = find(state, ids.ambusher), foe = find(state, ids.trigger);
      return state.tick >= ready.tick + 20 && ambusher.cooldown === 0 && ambusher.tactics?.ambush?.concealed
        && Math.hypot(foe.x - ambusher.x, foe.y - ambusher.y) > authored.radius + .5;
    }, { timeout: 5000, label: 'Ready ambusher withholds fire for twenty real native ticks' });
    const concealed = await save('ambush-concealed'); accepted(concealed, 'ambush', ids.ambusher);
    assert(find(concealed.game.state, ids.ambusher).tactics.ambush.concealed);
    assert.equal(find(concealed.game.state, ids.wrongTarget).hp, authored.wrongTargetHealth);
    assert.equal(find(concealed.game.state, ids.trigger).hp, authored.triggerHealth);
    const a = find(concealed.game.state, ids.ambusher), w = find(concealed.game.state, ids.wrongTarget);
    assert(Math.hypot(a.x - w.x, a.y - w.y) < authored.radius);
    await observer(ctx, 'ambush-concealed', concealed, { centerTroop: ids.wrongTarget, id: ids.ambusher, visible: false });
    await ctx.runUntil(state => !find(state, ids.ambusher).tactics?.ambush?.concealed && find(state, ids.trigger).hp < authored.triggerHealth, { timeout: 25000, label: 'Marching selected role triggers real ambush fire' });
    const triggered = await save('ambush-triggered');
    assert.equal(find(triggered.game.state, ids.ambusher).tactics.ambush.target, authored.target);
    assert.equal(find(triggered.game.state, ids.wrongTarget).hp, authored.wrongTargetHealth);
    await observer(ctx, 'ambush-triggered', triggered, { centerTroop: ids.wrongTarget, id: ids.ambusher, visible: true });
    ctx.record('Native ambush withholds ready fire from the wrong role, then reveals on the selected melee trigger', {
      concealedTick: concealed.game.state.tick, triggeredTick: triggered.game.state.tick,
      ambusher: find(triggered.game.state, ids.ambusher), target: find(triggered.game.state, ids.trigger),
      wrongTargetHealth: find(triggered.game.state, ids.wrongTarget).hp,
      continuationPairs: [['ambush-concealed-save.json', 'ambush-triggered-save.json']],
    });
  }

  {
    const { ids, authored } = await ctx.loadScenario('ambush-scout-release-firebreak');
    await arm(ctx, ids.ambusher, authored.radius, authored.target);
    const spotted = await save('ambush-scout-spotted');
    assert(find(spotted.game.state, ids.ambusher).tactics.ambush.concealed);
    await observer(ctx, 'ambush-scout-spotted', spotted, { centerTroop: ids.scout, id: ids.ambusher, visible: true });
    await ctx.resume(); await ctx.selectTroop(ids.ambusher); const release = await ctx.openTactics();
    await release.getByRole('button', { name: 'Release ambush', exact: true }).click();
    await ctx.wait(id => !window.rts.state.entities.find(item => item.id === id).tactics.ambush, ids.ambusher);
    const released = await save('ambush-manually-released'); accepted(released, 'releaseAmbush', ids.ambusher);
    assert.equal(find(released.game.state, ids.ambusher).tactics.ambush, undefined);
    await arm(ctx, ids.ambusher, authored.radius, authored.target);
    await ctx.selectTroop(ids.worker); const world = await ctx.openWorld();
    await world.getByLabel('Forest work tile', { exact: true }).selectOption(`${ids.forestWork.x},${ids.forestWork.y}`);
    const before = (await ctx.snap()).players[0].wood;
    await world.getByRole('button', { name: 'Clear firebreak', exact: true }).click();
    await ctx.runUntil(state => !find(state, ids.ambusher).tactics?.ambush?.concealed, { label: 'Native forest work destroys the last concealment' });
    const exposed = await save('ambush-timber-cleared'); accepted(exposed, 'firebreak', ids.worker);
    assert.equal(exposed.game.state.resources.find(item => item.id === ids.timber).amount, 0);
    assert.equal(exposed.game.state.players[0].wood, before - authored.firebreakCost.wood);
    await ctx.selectTroop(ids.ambusher); const panel = await ctx.openTactics();
    assert(!(await panel.getByRole('button', { name: 'Set ambush', exact: true }).isEnabled()));
    ctx.record('Native scout observation hides trigger metadata; release and paid firebreak remove ambush concealment', {
      spottedTick: spotted.game.state.tick, releasedTick: released.game.state.tick, exposedTick: exposed.game.state.tick,
      ambusher: find(exposed.game.state, ids.ambusher), timber: exposed.game.state.resources.find(item => item.id === ids.timber),
      timberCost: authored.firebreakCost.wood,
    });
  }
  return { retainedNativeSaves: retained, originalObserverInputs: ['ambush-concealed-save.json', 'ambush-triggered-save.json', 'ambush-scout-spotted-save.json'] };
}
