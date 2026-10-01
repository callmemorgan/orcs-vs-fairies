import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { factionArmorBonus, factionCanFire, factionConcealment, factionDamageFactor, factionMovementFactor, factionSplashRadius } from '../../src/core/faction-systems';
import { CORPSE_WAGON, FACTION_STRUCTURE_INFO } from '../../src/core/faction-systems-content';
import { PlayerView } from '../../src/core/observation';
import { loadGame, saveGame } from '../../src/core/saves';
import { decodeSessionFile } from '../../src/core/session-storage';
import type { SessionFile } from '../../src/core/session-storage';
import { captureRuntime, issueCommand } from '../../src/core/simulation';
import type { Command, Cost, Entity, GameState, Side, Vec } from '../../src/core/types';

function decodedOriginal(input: unknown): GameState {
  const { file, state } = decodeSessionFile(input);
  assert.deepEqual(saveGame(state), file.game, 'The complete original native envelope survives decoding');
  return state;
}

// These observers read a disposable decoded copy of the original native download.
// Ordinary illusions can fire; a grove decoy is harmless because it expires first.
export function observeFactionNative(input: unknown, side: Side = 0) {
  const state = decodedOriginal(input), view = new PlayerView(side).observe(state);
  return {
    tick: state.tick, time: state.time, side, visibleIds: view.entities.map(e => e.id),
    terrainEffects: state.factionSystems?.terrainEffects ?? [],
    actors: state.entities.map(e => ({
      id: e.id, side: e.side, level: e.level ?? 0, hp: e.hp, shield: e.shield,
      expires: e.expires, cooldown: e.cooldown, raised: e.raised, illusion: e.illusion,
      order: e.order, factionState: e.factionState,
      damageFactor: factionDamageFactor(state, e), armorBonus: factionArmorBonus(state, e),
      movementFactor: factionMovementFactor(e), canFire: factionCanFire(state, e),
      harmlessUntilExpiry: e.hp > 0 && e.illusion && e.expires > state.time && e.cooldown > e.expires - state.time,
      concealed: factionConcealment(state, e),
    })),
  };
}

export function verifyFactionPowerNativeArtifacts({ evidenceDir, fixturesDir, manifest, receipt, files }: {
  evidenceDir: string; fixturesDir: string; manifest: any; receipt: any; files: Map<string, SessionFile>;
}) {
  // The parent authenticates original bytes before populating files and verifies
  // complete replay endpoints and restored continuations without field exclusions.
  assert.equal(receipt.completed, true);
  assert.deepEqual(receipt.featureIds, [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  assert(Array.isArray(receipt.checkpoints) && receipt.checkpoints.length > 0);
  assert(Array.isArray(receipt.continuations) && receipt.continuations.length > 0);
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const metadata = new Map<string, any>(), states = new Map<string, GameState>(), initials = new Map<string, GameState>();
  const checks: any[] = [], expectedContinuations = new Set<string>(), providedContinuations = new Set<string>();
  for (const pair of receipt.continuations) {
    assert(Array.isArray(pair) && pair.length === 2 && pair.every(name => typeof name === 'string' && name.startsWith('factions-')));
    assert.notEqual(pair[0], pair[1], 'A continuation must reach a different checkpoint');
    const key = JSON.stringify(pair); assert(!providedContinuations.has(key), 'Unique faction continuation'); providedContinuations.add(key);
  }
  function original(name: string) {
    const file = files.get(name); assert(file?.replay, 'Required authenticated original native checkpoint ' + name); return file;
  }
  function spec(name: string) {
    const item = manifest.scenarios[name]; assert(item && item.group === 'factions', 'Declared faction scenario ' + name); return item;
  }
  function state(name: string, scenario?: string): GameState {
    const row = metadata.get(name); assert(row, 'Native checkpoint metadata for ' + name);
    if (scenario) assert.equal(row.scenario, scenario, name + ' declared scenario');
    if (!states.has(name)) states.set(name, decodedOriginal(original(name)));
    return states.get(name)!;
  }
  function initial(name: string): GameState {
    state(name);
    if (!initials.has(name)) {
      const envelope = original(name).replay!.initial, value = loadGame(envelope);
      assert.deepEqual(saveGame(value), envelope, name + ' complete original initial envelope'); initials.set(name, value);
    }
    return initials.get(name)!;
  }
  function actor(value: GameState, id: number, label: string): Entity {
    const entity = value.entities.find(e => e.id === id && e.hp > 0); assert(entity, label + ' live actor ' + id); return entity;
  }
  const gone = (value: GameState, id: number) => !value.entities.some(e => e.id === id && e.hp > 0);
  const hp = (value: GameState, id: number) => value.entities.find(e => e.id === id)?.hp ?? 0;
  const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
  const sameLevel = (a: Vec, b: Vec) => (a.level ?? 0) === (b.level ?? 0);
  function paid(before: GameState, after: GameState, cost: Cost, label: string) {
    for (const kind of ['wood', 'ore', 'crystal'] as const) assert.equal(before.players[0][kind] - after.players[0][kind], cost[kind], label + ' ' + kind + ' charge');
  }
  function command(name: string, type: Command['type'], predicate: (value: Command) => boolean = () => true) {
    state(name);
    const action = original(name).replay!.actions.find(a => a.type === 'command' && a.side === 0 && a.command.type === type && predicate(a.command));
    assert(action?.type === 'command', name + ' recorded accepted ' + type); return action.command;
  }
  function continuation(from: string, to: string) {
    state(from); state(to); const key = JSON.stringify([from, to]);
    assert(providedContinuations.has(key), 'Required restored continuation ' + from + ' to ' + to); expectedContinuations.add(key);
  }
  function hit(value: GameState, source: number, target: number, label: string) {
    // Events last one tick. HP deltas and the accepted attack prove the effect;
    // retained targets also preserve the attacking source after later UI frames.
    const entity = value.entities.find(e => e.id === target);
    if (entity) assert.equal(entity.lastAttacker, source, label + ' persistent attacking source');
  }
  function constructed(prefix: string, scenario: string, structure: keyof typeof FACTION_STRUCTURE_INFO, worker: number, point: Vec) {
    const before = state(prefix + '-before-build', scenario), foundation = state(prefix + '-foundation', scenario), complete = state(prefix + '-complete', scenario);
    const definition = FACTION_STRUCTURE_INFO[structure].definition;
    assert.deepEqual(spec(scenario).authored.structureCosts[definition.id], definition.cost, prefix + ' declared native definition cost');
    const building = foundation.entities.find(e => e.side === 0 && e.hp > 0 && e.definitionId === definition.id && e.progress < 1 && sameLevel(e, point) && distance(e, point) < .1);
    assert(building, prefix + ' native foundation'); assert(!before.entities.some(e => e.id === building.id), prefix + ' new construction ID');
    paid(before, foundation, definition.cost, prefix);
    command(prefix + '-foundation', 'buildFactionStructure', c => c.type === 'buildFactionStructure' && c.structure === structure && c.ids.includes(worker) && sameLevel(c, point) && distance(c, point) < .1);
    const finished = actor(complete, building.id, prefix); assert.equal(finished.progress, 1); assert.equal(finished.definitionId, definition.id);
    continuation(prefix + '-foundation', prefix + '-complete'); return finished;
  }
  for (const checkpoint of receipt.checkpoints) {
    assert(typeof checkpoint.name === 'string' && !metadata.has(checkpoint.name), 'Unique faction checkpoint');
    const scenario = spec(checkpoint.scenario), file = original(checkpoint.name), authored = JSON.parse(readFileSync(resolve(fixturesDir, scenario.file), 'utf8'));
    assert.deepEqual(file.replay!.initial, authored.game, checkpoint.name + ' exact declared authored initial envelope');
    const value = decodedOriginal(file); assert.equal(value.tick, checkpoint.tick); assert.equal(hash(file.game), checkpoint.gameSha256);
    assert(Array.isArray(checkpoint.featureIds) && checkpoint.featureIds.length > 0 && checkpoint.featureIds.every((id: number) => Number.isInteger(id) && id >= 21 && id <= 30));
    metadata.set(checkpoint.name, checkpoint); states.set(checkpoint.name, value);
  }

  {
    const scenario = 'factions-orcs-earned', ids = spec(scenario).ids;
    const earned = state('factions-orcs-earned-fury', scenario), start = initial('factions-orcs-earned-fury');
    assert.equal(start.factionSystems!.fury[0], 0); assert.equal(actor(start, ids.soldier, scenario).factionState?.trophyKills ?? 0, 0);
    assert(earned.factionSystems!.fury[0] >= 50); assert(hp(earned, ids.bankTarget) < hp(start, ids.bankTarget));
    for (const id of ids.earners) command('factions-orcs-earned-fury', 'attack', c => c.type === 'attack' && c.ids.includes(id) && c.target === ids.bankTarget);
    const baseline = state('factions-orcs-baseline-hit', scenario), beforeAssault = state('factions-orcs-before-assault', scenario), assaultPaid = state('factions-orcs-assault-paid', scenario), assault = state('factions-orcs-assault-active', scenario);
    assert.equal(beforeAssault.factionSystems!.fury[0] - assaultPaid.factionSystems!.fury[0], 25);
    command('factions-orcs-assault-paid', 'warChant', c => c.type === 'warChant' && c.chant === 'assault' && c.ids.includes(ids.soldier));
    assert.equal(actor(assaultPaid, ids.soldier, scenario).factionState?.chant?.kind, 'assault');
    assert.equal(factionDamageFactor(assaultPaid, actor(assaultPaid, ids.soldier, scenario)), 1.25);
    const baselineDamage = hp(start, ids.target) - hp(baseline, ids.target), assaultDamage = hp(assaultPaid, ids.target) - hp(assault, ids.target);
    assert(baselineDamage > 0 && assaultDamage > baselineDamage); hit(baseline, ids.soldier, ids.target, 'Ordinary hit'); hit(assault, ids.soldier, ids.target, 'Assault hit');
    const beforeIncoming = state('factions-orcs-before-unprotected-hit', scenario), incoming = state('factions-orcs-unprotected-hit', scenario);
    const beforeBulwark = state('factions-orcs-before-bulwark', scenario), bulwarkPaid = state('factions-orcs-bulwark-paid', scenario), bulwark = state('factions-orcs-bulwark-active', scenario);
    assert.equal(beforeBulwark.factionSystems!.fury[0] - bulwarkPaid.factionSystems!.fury[0], 25);
    command('factions-orcs-bulwark-paid', 'warChant', c => c.type === 'warChant' && c.chant === 'bulwark' && c.ids.includes(ids.defender));
    assert.equal(actor(bulwarkPaid, ids.defender, scenario).factionState?.chant?.kind, 'bulwark'); assert.equal(factionArmorBonus(bulwarkPaid, actor(bulwarkPaid, ids.defender, scenario)), 3);
    const incomingDamage = hp(beforeIncoming, ids.defender) - hp(incoming, ids.defender), guardedDamage = hp(bulwarkPaid, ids.defender) - hp(bulwark, ids.defender);
    assert(incomingDamage > 0 && guardedDamage > 0 && guardedDamage < incomingDamage); hit(incoming, ids.enemy, ids.defender, 'Ordinary incoming hit'); hit(bulwark, ids.enemy, ids.defender, 'Bulwark incoming hit');
    const expired = state('factions-orcs-chants-expired', scenario);
    for (const id of [ids.soldier, ids.defender]) assert.equal(actor(expired, id, scenario).factionState?.chant, undefined);
    continuation('factions-orcs-bulwark-active', 'factions-orcs-chants-expired');
    checks.push({ id: 21, earnedFury: earned.factionSystems!.fury[0], paidFury: { assault: 25, bulwark: 25 }, baselineDamage, assaultDamage, incomingDamage, guardedDamage, expired: true });

    const trophies = state('factions-orcs-earned-trophies', scenario), inRange = state('factions-orcs-standard-in-range', scenario), outside = state('factions-orcs-standard-outside', scenario);
    const earnedTrophies = actor(trophies, ids.soldier, scenario).factionState?.trophyKills ?? 0; assert(earnedTrophies >= 2);
    for (const victim of ids.victims) { const mortal = actor(start, victim, scenario); assert(!mortal.illusion && !mortal.raised); assert(gone(trophies, victim)); command('factions-orcs-earned-trophies', 'attack', c => c.type === 'attack' && c.ids.includes(ids.soldier) && c.target === victim); }
    assert.equal(earnedTrophies - (actor(inRange, ids.soldier, scenario).factionState?.trophyKills ?? 0), 2);
    const standard = inRange.entities.find(e => e.side === 0 && e.hp > 0 && e.definitionId === 'core:orcs-trophy-standard'); assert(standard && standard.expires > inRange.time); assert(!trophies.entities.some(e => e.id === standard.id));
    command('factions-orcs-standard-in-range', 'trophyStandard', c => c.type === 'trophyStandard' && c.ids.includes(ids.soldier));
    assert.equal(factionDamageFactor(inRange, actor(inRange, ids.soldier, scenario)), 1.1); assert.equal(factionDamageFactor(outside, actor(outside, ids.soldier, scenario)), 1);
    assert(distance(actor(outside, ids.soldier, scenario), standard) > 6); continuation('factions-orcs-earned-trophies', 'factions-orcs-standard-outside');
    const destruction = 'factions-standard-destruction', destructionIds = spec(destruction).ids, supported = state('factions-standard-before-destruction', destruction), destroyed = state('factions-standard-destroyed', destruction);
    assert.equal(factionDamageFactor(supported, actor(supported, destructionIds.soldier, destruction)), 1.1); assert(gone(destroyed, destructionIds.standard)); assert.equal(factionDamageFactor(destroyed, actor(destroyed, destructionIds.soldier, destruction)), 1);
    continuation('factions-standard-before-destruction', 'factions-standard-destroyed'); checks.push({ id: 22, earnedTrophies, trophiesSpent: 2, standard: standard.id, rangeAndDestruction: true });
  }

  {
    const scenario = 'factions-fairies-swap', ids = spec(scenario).ids, pre = state('factions-fairies-before-swap', scenario), post = state('factions-fairies-swapped', scenario);
    assert(!initial('factions-fairies-before-swap').entities.some(e => e.illusion)); command('factions-fairies-before-swap', 'ability', c => c.type === 'ability' && c.ids.includes(ids.caster));
    const swap = command('factions-fairies-swapped', 'illusionSwap', c => c.type === 'illusionSwap' && c.ids.includes(ids.soldier)); assert(swap.type === 'illusionSwap');
    const real = actor(pre, ids.soldier, scenario), double = actor(pre, swap.target, scenario), exchanged = actor(post, real.id, scenario), clone = actor(post, double.id, scenario);
    assert.equal(real.id, ids.caster, 'The native-conjuring caster performs the swap'); assert(!real.illusion); assert.equal(double.definitionId, real.definitionId, 'The caster swaps with its own conjured unit definition');
    assert(double.illusion && double.side === 0 && double.expires > pre.time);
    assert.deepEqual([exchanged.x, exchanged.y, exchanged.level ?? 0, clone.x, clone.y, clone.level ?? 0], [double.x, double.y, double.level ?? 0, real.x, real.y, real.level ?? 0]);
    assert.equal(exchanged.hp, real.hp); assert.equal(clone.hp, double.hp); assert.equal(exchanged.order.type, 'hold'); assert.equal(clone.order.type, 'hold'); paid(pre, post, { wood: 0, ore: 0, crystal: 15 }, 'Illusion swap'); assert((exchanged.factionState?.swapReadyAt ?? 0) > post.time);
    continuation('factions-fairies-before-swap', 'factions-fairies-swapped');
    const rejections: any[] = [];
    const cooldownName = 'factions-fairies-cooldown-rejected', cooldown = state(cooldownName, scenario);
    paid(post, cooldown, { wood: 0, ore: 0, crystal: 0 }, 'Cooldown rejection');
    for (const id of [real.id, double.id]) {
      const unchanged = actor(cooldown, id, scenario), before = actor(post, id, scenario);
      assert.deepEqual([unchanged.x, unchanged.y, unchanged.level ?? 0, unchanged.hp, unchanged.order, unchanged.factionState], [before.x, before.y, before.level ?? 0, before.hp, before.order, before.factionState], 'Cooldown rejection preserves actor ' + id);
    }
    assert((actor(cooldown, real.id, scenario).factionState?.swapReadyAt ?? 0) > cooldown.time);
    const acceptedSwaps = (name: string) => original(name).replay!.actions.filter(a => a.type === 'command' && a.command.type === 'illusionSwap');
    assert.deepEqual(acceptedSwaps(cooldownName), acceptedSwaps('factions-fairies-swapped'), 'Cooldown endpoint contains no additional accepted swap');
    const cooldownCopy = decodedOriginal(original(cooldownName)), cooldownBefore = saveGame(cooldownCopy);
    assert.equal(issueCommand(cooldownCopy, 0, { type: 'illusionSwap', ids: [real.id], target: double.id }), false, 'Cooldown native endpoint rejects through public command');
    assert.deepEqual(saveGame(cooldownCopy), cooldownBefore, 'Cooldown rejection preserves the complete envelope'); rejections.push({ kind: 'cooldown', originalNativeEndpoint: cooldownName, fullEnvelopeUnchanged: true });
    for (const kind of ['blocked', 'expired', 'hostile']) {
      const negative = 'factions-fairies-' + kind, negativeIds = spec(negative).ids, name = negative + '-rejected', rejected = state(name, negative), start = initial(name);
      const unchanged = actor(rejected, negativeIds.soldier, negative), originalReal = actor(start, negativeIds.soldier, negative);
      assert.deepEqual([unchanged.x, unchanged.y, unchanged.level ?? 0, unchanged.hp, unchanged.order, unchanged.factionState], [originalReal.x, originalReal.y, originalReal.level ?? 0, originalReal.hp, originalReal.order, originalReal.factionState]); paid(start, rejected, { wood: 0, ore: 0, crystal: 0 }, kind + ' rejection');
      assert(!original(name).replay!.actions.some(a => a.type === 'command' && a.command.type === 'illusionSwap'), kind + ' native history contains no accepted swap');
      if (kind === 'expired') assert(gone(rejected, negativeIds.illusion));
      if (kind === 'hostile') assert.equal(actor(rejected, negativeIds.illusion, negative).side, 1);
      const disposable = decodedOriginal(original(name)), before = saveGame(disposable);
      assert.equal(issueCommand(disposable, 0, { type: 'illusionSwap', ids: [negativeIds.soldier], target: negativeIds.illusion }), false, kind + ' native endpoint rejects through public command');
      assert.deepEqual(saveGame(disposable), before, kind + ' rejection preserves the complete envelope'); rejections.push({ kind, originalNativeEndpoint: name, fullEnvelopeUnchanged: true });
    }
    checks.push({ id: 23, real: real.id, illusion: double.id, exchangedPositionsHealthAndOrders: true, paidCrystal: 15, rejections });

    const groveScenario = 'factions-fairies-grove', groveIds = spec(groveScenario).ids;
    const grove = constructed('factions-fairies-grove', groveScenario, 'enchanted-grove', groveIds.worker, groveIds.grovePoint), hidden = state('factions-fairies-grove-hidden', groveScenario), decoys = state('factions-fairies-grove-decoy', groveScenario);
    const enemy = new PlayerView(1).observe(decoys), owner = new PlayerView(0).observe(decoys), trueTroop = actor(decoys, groveIds.soldier, groveScenario);
    assert(factionConcealment(hidden, actor(hidden, groveIds.soldier, groveScenario))); assert(owner.entities.some(e => e.id === trueTroop.id)); assert(!enemy.entities.some(e => e.id === trueTroop.id));
    const key = (trueTroop.level ?? 0) * decoys.width * decoys.height + Math.floor(trueTroop.y) * decoys.width + Math.floor(trueTroop.x); assert(enemy.visible.includes(key), 'The true troop tile is observed beyond ordinary fog');
    const decoy = decoys.entities.find(e => e.side === 0 && e.hp > 0 && e.illusion && e.order.type === 'move'); assert(decoy && decoy.expires > decoys.time); assert(enemy.entities.some(e => e.id === decoy.id));
    assert(decoy.cooldown > decoy.expires - decoys.time); assert(decoy.cooldown <= 100 && decoy.expires - decoys.time <= 15 + 1e-8); assert.equal(factionCanFire(decoys, decoy), true, 'Harmlessness is expiry before cooldown, not an illusion fire gate');
    continuation('factions-fairies-grove-complete', 'factions-fairies-grove-decoy'); checks.push({ id: 24, paidGrove: grove.id, trueTroop: trueTroop.id, hostileMovingDecoy: decoy.id, cooldown: decoy.cooldown, remainingLifetime: decoy.expires - decoys.time });
  }

  {
    const scenario = 'factions-dwarves-tunnels', ids = spec(scenario).ids;
    const entrance = constructed('factions-dwarves-entrance', scenario, 'tunnel', ids.workers[0], ids.entrancePoint), exit = constructed('factions-dwarves-exit', scenario, 'tunnel', ids.workers[1], ids.exitPoint);
    const transit = state('factions-dwarves-tunnel-transit', scenario), arrived = state('factions-dwarves-tunnel-arrived', scenario);
    command('factions-dwarves-tunnel-transit', 'tunnelTravel', c => c.type === 'tunnelTravel' && c.target === exit.id && ids.soldiers.every((id: number) => c.ids.includes(id)));
    for (const id of ids.soldiers) { const channel = actor(transit, id, scenario), final = actor(arrived, id, scenario); assert.equal(channel.factionState?.tunnel?.target, exit.id); assert(channel.factionState!.tunnel!.progress > 0 && channel.factionState!.tunnel!.progress < 1); assert(sameLevel(channel, entrance)); assert(sameLevel(final, exit) && distance(final, exit) < 3); assert.equal(final.factionState?.tunnel, undefined); assert.equal(final.order.type, 'hold'); }
    continuation('factions-dwarves-tunnel-transit', 'factions-dwarves-tunnel-arrived');
    const negative = 'factions-dwarves-exit-destruction', negativeIds = spec(negative).ids, pending = state('factions-dwarves-exit-pending', negative), canceled = state('factions-dwarves-exit-canceled', negative), start = initial('factions-dwarves-exit-pending');
    assert(gone(canceled, negativeIds.exit));
    for (const id of negativeIds.soldiers) { assert.equal(actor(pending, id, negative).factionState?.tunnel?.target, negativeIds.exit); const final = actor(canceled, id, negative), origin = actor(start, id, negative); assert.equal(final.factionState?.tunnel, undefined); assert(sameLevel(final, origin) && distance(final, origin) < .2); }
    continuation('factions-dwarves-exit-pending', 'factions-dwarves-exit-canceled'); checks.push({ id: 25, paidEntrances: [entrance.id, exit.id], midChannelCrossLevelArrival: true, destroyedExitCancelsAtOrigin: true });
  }

  {
    const impacts: Record<string, { targetDamage: number; groupDamage: number[] }> = {};
    for (const fitting of ['baseline', 'stone', 'grapeshot', 'incendiary', 'reinforced']) {
      const scenario = 'factions-dwarves-' + fitting, ids = spec(scenario).ids, before = state(scenario + '-initial', scenario);
      const fitted = fitting === 'baseline' ? before : state(scenario + '-fitted', scenario);
      if (fitting !== 'baseline') { paid(before, fitted, { wood: 50, ore: 40, crystal: 0 }, fitting + ' fittings'); command(scenario + '-fitted', 'modifyArtillery', c => c.type === 'modifyArtillery' && c.modification === fitting && [ids.siege, ids.cannon].every(id => c.ids.includes(id))); }
      for (const id of [ids.siege, ids.cannon]) assert.equal(actor(fitted, id, scenario).factionState?.artillery, fitting === 'baseline' ? undefined : fitting);
      const shooter = actor(fitted, ids.siege, scenario), target = fitting === 'grapeshot' ? ids.targets[0] : ids.building;
      assert.equal(factionDamageFactor(fitted, shooter, actor(fitted, ids.building, scenario)), fitting === 'stone' ? 1.25 : 1);
      assert.equal(factionDamageFactor(fitted, shooter, actor(fitted, ids.targets[0], scenario)), fitting === 'grapeshot' ? 1.5 : 1);
      assert.equal(factionSplashRadius(shooter), fitting === 'grapeshot' ? 2.5 : 1.75); assert.equal(factionArmorBonus(fitted, shooter), fitting === 'reinforced' ? 3 : 0); assert.equal(factionMovementFactor(shooter), fitting === 'reinforced' ? .85 : 1);
      const ammunition = state(scenario + '-ammo', scenario); paid(fitted, ammunition, { wood: 0, ore: 15, crystal: 0 }, fitting + ' magazine'); assert.equal(actor(ammunition, ids.siege, scenario).siegeMode?.ammo, 5); assert.equal(actor(ammunition, ids.siege, scenario).siegeMode?.deployed, true); command(scenario + '-ammo', 'ability', c => c.type === 'ability' && c.ids.includes(ids.siege));
      const pending = state(scenario + '-pending', scenario), impact = state(scenario + '-impact', scenario), destination = actor(pending, target, scenario);
      const specialist = pending.specialists?.shots?.find(p => p.source.id === ids.siege && sameLevel(p.target, destination) && distance(p.target, destination) < .1);
      const projectile = pending.projectiles?.find(p => p.source === ids.siege && sameLevel(p, destination) && distance(p, destination) < .1);
      assert(specialist || projectile, fitting + ' source-and-target-specific pending shell');
      const shot = specialist ?? projectile!; assert.equal(shot.modification, fitting === 'baseline' ? undefined : fitting); assert(shot.impactAt > pending.time); assert(!impact.specialists?.shots?.some(p => specialist && p.id === specialist.id)); assert(!impact.projectiles?.some(p => projectile && p.id === projectile.id));
      if (specialist) { assert.equal(specialist.source.side, 0); assert.equal(specialist.source.definitionId, actor(pending, ids.siege, scenario).definitionId); assert.deepEqual(specialist.payload, { kind: 'cannon', damageFactor: 1.5, armorPiercing: false, radius: 0 }); }
      assert.equal(actor(ammunition, ids.siege, scenario).siegeMode!.ammo - actor(pending, ids.siege, scenario).siegeMode!.ammo, 1);
      paid(ammunition, impact, fitting === 'incendiary' ? { wood: 15, ore: 5, crystal: 0 } : { wood: 0, ore: 0, crystal: 0 }, fitting + ' shot');
      command(scenario + '-pending', 'attack', c => c.type === 'attack' && c.ids.includes(ids.siege) && c.target === target);
      const targetDamage = hp(pending, target) - hp(impact, target), groupDamage = ids.targets.map((id: number) => hp(pending, id) - hp(impact, id)); assert(targetDamage > 0); hit(impact, ids.siege, target, fitting + ' impact'); impacts[fitting] = { targetDamage, groupDamage };
      if (fitting === 'incendiary') { const point = specialist?.target ?? projectile!; assert(impact.world?.fires.some(fire => sameLevel(fire, point) && distance(fire, point) < .8)); assert(impact.entities.some(e => e.burning?.some(b => b.source === ids.siege))); }
      continuation(scenario + '-pending', scenario + '-impact');
    }
    assert(impacts.stone.targetDamage > impacts.baseline.targetDamage); assert(impacts.grapeshot.groupDamage.filter(amount => amount > 0).length >= 2); checks.push({ id: 26, allFourPaidFittingsAndFactors: true, sourceAndTargetSpecificPendingAndImpact: true, impacts });
  }

  {
    const scenario = 'factions-undead-wagons', ids = spec(scenario).ids, before = state('factions-undead-before-recruit', scenario), queued = state('factions-undead-wagon-queued', scenario), recruited = state('factions-undead-wagon-recruited', scenario);
    paid(before, queued, CORPSE_WAGON.cost, 'Corpse wagon recruitment'); const barracks = actor(queued, ids.barracks, scenario), index = barracks.queueDefinitionIds?.indexOf(CORPSE_WAGON.id) ?? -1; assert(index >= 0); assert.equal(barracks.queue[index], 'special'); assert.deepEqual(barracks.queuePaidCosts?.[index], CORPSE_WAGON.cost); assert(barracks.trainProgress < 1);
    command('factions-undead-wagon-queued', 'train', c => c.type === 'train' && c.id === ids.barracks && c.definitionId === CORPSE_WAGON.id);
    const newWagons = recruited.entities.filter(e => e.side === 0 && e.hp > 0 && !e.illusion && e.definitionId === CORPSE_WAGON.id && !before.entities.some(old => old.id === e.id)); assert.equal(newWagons.length, 1); assert.equal(newWagons[0].role, 'special'); assert.equal(newWagons[0].maxHp, CORPSE_WAGON.hp); assert(!actor(recruited, ids.barracks, scenario).queueDefinitionIds?.includes(CORPSE_WAGON.id));
    assert.equal(captureRuntime(recruited).producedFighters[0] - captureRuntime(before).producedFighters[0], 1);
    assert.deepEqual(recruited.economy?.paidCosts.find(e => e.entityId === newWagons[0].id)?.stock, CORPSE_WAGON.cost); continuation('factions-undead-wagon-queued', 'factions-undead-wagon-recruited');
    const created = state('factions-undead-body-created', scenario), originalBody = created.corpses.find(body => body.id === ids.victim); assert(originalBody); assert(gone(created, ids.victim)); assert(distance(originalBody, actor(created, ids.caster, scenario)) > 6); command('factions-undead-body-created', 'attack', c => c.type === 'attack' && c.ids.includes(ids.killer) && c.target === ids.victim);
    const cargo = state('factions-undead-wagon-cargo', scenario), carried = cargo.entities.flatMap(e => (e.factionState?.corpseCargo ?? []).filter(body => body.id === originalBody.id).map(body => ({ carrier: e.id, body }))); assert.equal(carried.length, 1); assert(ids.wagons.includes(carried[0].carrier)); assert.equal(carried[0].body.expires, originalBody.expires); assert(!cargo.corpses.some(body => body.id === originalBody.id)); command('factions-undead-wagon-cargo', 'collectCorpses', c => c.type === 'collectCorpses' && c.target === originalBody.id && ids.wagons.every((id: number) => c.ids.includes(id)));
    const delivery = state('factions-undead-wagon-delivery', scenario), order = actor(delivery, carried[0].carrier, scenario).factionState?.corpseOrder; assert(order?.type === 'deliver' && order.target === ids.caster); command('factions-undead-wagon-delivery', 'deliverCorpses', c => c.type === 'deliverCorpses' && c.ids.includes(carried[0].carrier) && c.target === ids.caster);
    const raised = state('factions-undead-wagon-raised', scenario), newRaised = raised.entities.filter(e => e.side === 0 && e.hp > 0 && e.raised && !cargo.entities.some(old => old.id === e.id)); assert.equal(newRaised.length, 1); assert(!newRaised[0].illusion && newRaised[0].role === 'melee');
    const casterReadyAt = captureRuntime(raised).abilities.find(([id]) => id === ids.caster)?.[1]; assert(casterReadyAt !== undefined); assert(Math.abs(newRaised[0].expires - (casterReadyAt + 13)) < 1e-8, 'The delivered raise lifetime matches its caster cooldown');
    assert(!raised.corpses.some(body => body.id === originalBody.id)); assert(!raised.entities.some(e => [...e.factionState?.corpseCargo ?? [], ...e.factionState?.deliveredCorpses ?? []].some(body => body.id === originalBody.id))); continuation('factions-undead-wagon-cargo', 'factions-undead-wagon-raised'); checks.push({ id: 27, paidRecruit: newWagons[0].id, body: originalBody.id, originalDeadline: originalBody.expires, singleCarrier: carried[0].carrier, deliveredRaise: newRaised[0].id });
  }

  {
    const scenario = 'factions-undead-necropolis', ids = spec(scenario).ids, captured = state('factions-undead-territory-captured', scenario), start = initial('factions-undead-territory-captured');
    const originalSite = start.world?.sites.find(site => site.id === ids.site), site = captured.world?.sites.find(site => site.id === ids.site); assert(originalSite?.kind === 'relic' && originalSite.owner === 1); assert(site?.kind === 'relic' && site.owner === 0); assert.equal(site.progress, 0); assert.equal(site.capturing, null); command('factions-undead-territory-captured', 'captureSite', c => c.type === 'captureSite' && c.ids.includes(ids.capturer) && c.target === ids.site);
    const necropolis = constructed('factions-undead-necropolis', scenario, 'necropolis', ids.worker, ids.necropolisPoint); assert(sameLevel(necropolis, site) && distance(necropolis, site) <= 6);
    const sustained = state('factions-undead-sustained', scenario), healed = state('factions-undead-healed', scenario), outside = state('factions-undead-outside', scenario), decayed = state('factions-undead-decaying', scenario);
    assert(!start.entities.some(e => e.raised)); const troop = sustained.entities.find(e => e.side === 0 && e.hp > 0 && e.raised); assert(troop); assert(sameLevel(troop, necropolis) && distance(troop, necropolis) <= 6); command('factions-undead-sustained', 'attack', c => c.type === 'attack' && c.ids.includes(ids.killer) && c.target === ids.victim);
    const supported = actor(healed, troop.id, scenario); assert(supported.hp > troop.hp); assert(Math.abs(supported.expires - healed.time - (troop.expires - sustained.time)) < .1);
    const departed = actor(outside, troop.id, scenario), decaying = actor(decayed, troop.id, scenario); assert(distance(departed, necropolis) > 6); assert(decaying.expires - decayed.time < departed.expires - outside.time - 2.5); continuation('factions-undead-sustained', 'factions-undead-decaying');
    const destruction = 'factions-undead-necropolis-destruction', destructionIds = spec(destruction).ids, supportedBefore = state('factions-undead-source-before-destruction', destruction), sourceGone = state('factions-undead-source-destroyed', destruction), sourceDecay = state('factions-undead-source-decay', destruction);
    assert(actor(supportedBefore, destructionIds.necropolis, destruction).progress === 1); assert(gone(sourceGone, destructionIds.necropolis)); const atDeath = actor(sourceGone, destructionIds.raised, destruction), afterDeath = actor(sourceDecay, destructionIds.raised, destruction); assert(afterDeath.expires - sourceDecay.time < atDeath.expires - sourceGone.time - 2.5); continuation('factions-undead-source-before-destruction', 'factions-undead-source-decay'); checks.push({ id: 28, capturedRelic: ids.site, paidNecropolis: necropolis.id, raised: troop.id, localHealingAndLifetimeSustain: true, leavingAndSourceDestructionResumeDecay: true });
  }

  {
    const movement: Record<string, { ordinary: number[]; amphibious: number; seconds: number }> = {};
    for (const terrain of ['baseline', 'mud', 'shallows', 'water']) {
      const scenario = 'factions-tideborn-' + terrain, ids = spec(scenario).ids, before = state(scenario + '-before', scenario);
      if (terrain !== 'baseline') {
        const active = state(scenario + '-active', scenario), effects = active.factionSystems!.terrainEffects; paid(before, active, { wood: 0, ore: 0, crystal: 25 }, terrain + ' shaping'); assert.equal(effects.length, 1);
        const effect = effects[0]; assert(effect.tiles.length > 0 && effect.tiles.length <= 13 && effect.tiles.every(tile => tile.after === terrain)); assert(effect.until > active.time && effect.until - active.time <= 20 + 1e-8); assert.equal(actor(active, ids.caster, scenario).factionState?.waterReadyAt, effect.until);
        command(scenario + '-active', 'shapeWater', c => c.type === 'shapeWater' && c.terrain === terrain && c.ids.includes(ids.caster) && sameLevel(c, ids.shapePoint) && distance(c, ids.shapePoint) < .1);
        const restored = state(scenario + '-restored', scenario); assert.equal(restored.factionSystems!.terrainEffects.length, 0); assert(restored.time >= effect.until);
        for (const tile of effect.tiles) { const index = Math.floor(tile.y) * active.width + Math.floor(tile.x); assert.equal(before.world!.levels[tile.level].terrain[index], tile.before); assert.equal(active.world!.levels[tile.level].terrain[index], tile.after); assert.equal(restored.world!.levels[tile.level].terrain[index], tile.before, terrain + ' restores every original shaped tile'); }
        for (const point of ids.protectedTiles) { const index = Math.floor(point.y) * active.width + Math.floor(point.x), level = point.level ?? 0; assert.equal(active.world!.levels[level].terrain[index], before.world!.levels[level].terrain[index]); assert.equal(restored.world!.levels[level].terrain[index], before.world!.levels[level].terrain[index]); }
        continuation(scenario + '-active', scenario + '-restored');
      }
      const from = state(scenario + '-movement-before', scenario), to = state(scenario + '-movement', scenario); assert(to.time - from.time >= 5); command(scenario + '-movement', 'move', c => c.type === 'move' && c.ids.includes(ids.soldier) && sameLevel(c, ids.crossPoint) && distance(c, ids.crossPoint) < .1);
      movement[terrain] = { ordinary: ids.enemies.map((id: number) => distance(actor(from, id, scenario), actor(to, id, scenario))), amphibious: distance(actor(from, ids.soldier, scenario), actor(to, ids.soldier, scenario)), seconds: to.time - from.time };
    }
    assert(movement.baseline.ordinary.some(amount => amount > 0)); assert(movement.mud.ordinary.some((amount, i) => amount < movement.baseline.ordinary[i])); assert(movement.water.ordinary.some((amount, i) => amount < movement.baseline.ordinary[i])); assert(movement.mud.amphibious > 0 && movement.shallows.amphibious > 0); checks.push({ id: 29, allThreePaidTemporaryShapes: true, everyShapedTileRestored: true, originalCheckpointMovement: movement });
  }

  {
    const scenario = 'factions-automata-connect', ids = spec(scenario).ids;
    const relay = constructed('factions-automata-relay', scenario, 'power-relay', ids.worker, ids.relayPoint), powered = state('factions-automata-powered', scenario), poweredHit = state('factions-automata-powered-hit', scenario);
    assert.equal(factionCanFire(initial('factions-automata-powered'), actor(initial('factions-automata-powered'), ids.tower, scenario)), false); assert.equal(actor(powered, ids.tower, scenario).factionState?.power?.connected, true); assert.equal(factionCanFire(powered, actor(powered, ids.tower, scenario)), true);
    assert(ids.enemies.some((id: number) => hp(poweredHit, id) < hp(powered, id) && poweredHit.entities.find(e => e.id === id)?.lastAttacker === ids.tower));
    const breaking = 'factions-automata-break', breakIds = spec(breaking).ids, connected = state('factions-automata-network-before-hit', breaking), shared = state('factions-automata-shared-shield', breaking), disconnected = state('factions-automata-disconnected', breaking);
    assert.equal(actor(connected, breakIds.tower, breaking).factionState?.power?.connected, true); assert(connected.entities.filter(e => e.side === 0 && e.kind === 'building' && e.hp > 0 && e.id !== breakIds.tower).some(e => (shared.entities.find(n => n.id === e.id)?.shield ?? 0) < (e.shield ?? 0)));
    assert(breakIds.enemies.includes(actor(shared, breakIds.tower, breaking).lastAttacker)); assert(gone(disconnected, breakIds.relay)); assert.equal(actor(disconnected, breakIds.tower, breaking).factionState?.power?.connected, false); assert.equal(factionCanFire(disconnected, actor(disconnected, breakIds.tower, breaking)), false);
    const replacement = constructed('factions-automata-rebuilt-relay', breaking, 'power-relay', breakIds.worker, breakIds.relayPoint), reconnected = state('factions-automata-reconnected', breaking); assert.notEqual(replacement.id, breakIds.relay); assert.equal(actor(reconnected, breakIds.tower, breaking).factionState?.power?.connected, true); assert.equal(factionCanFire(reconnected, actor(reconnected, breakIds.tower, breaking)), true);
    continuation('factions-automata-network-before-hit', 'factions-automata-reconnected'); checks.push({ id: 30, paidRelay: relay.id, sourceSpecificTowerFire: true, sharedShieldRealDamage: true, connectorDeathDisablesFire: true, paidReplacement: replacement.id, reconnected: true });
  }

  assert.deepEqual([...providedContinuations].sort(), [...expectedContinuations].sort(), 'All faction continuations are independently required');
  assert.deepEqual(checks.map(check => check.id), [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  const result = { completed: true, featureIds: checks.map(check => check.id), checks, checkpoints: receipt.checkpoints, continuationPairs: receipt.continuations };
  writeFileSync(resolve(evidenceDir, 'faction-powers-native-checks.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); return result;
}
