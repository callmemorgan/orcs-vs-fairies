import { length2D } from '../core/geometry';
import type { CampaignDefinition, ScenarioActor, ScenarioCondition, ScenarioDefinition, ScenarioMap, ScenarioObjective, ScenarioTrigger } from '../core/scenario-types';
import type { BuildingRole, FactionId, TerrainKind, UnitRole, Vec } from '../core/types';

type Plot = [TerrainKind, number, number, number, number];
interface Ground { plots: Plot[]; paths: Vec[][] }
interface Chapter {
  id: string; title: string; briefing: string; success: string; failure: string;
  faction: FactionId; opponent: FactionId; commander: string; seed: number;
  ground: Ground; army: ScenarioActor[];
}

const zero = { wood: 0, ore: 0, crystal: 0 };
const at = (actor: string, x: number, y: number, radius = 2): ScenarioCondition => ({ type: 'at', actor, point: { x, y }, radius });
const value = (key: string, amount = 1): ScenarioCondition => ({ type: 'variable', key, op: 'gte', value: amount });
const alive = (actor: string): ScenarioCondition => ({ type: 'alive', actor });
const dead = (actor: string): ScenarioCondition => ({ type: 'dead', actor });
const all = (...conditions: ScenarioCondition[]): ScenarioCondition => ({ type: 'all', conditions });
const any = (...conditions: ScenarioCondition[]): ScenarioCondition => ({ type: 'any', conditions });
const time = (seconds: number): ScenarioCondition => ({ type: 'time', seconds });
const unit = (label: string, role: UnitRole, x: number, y: number, side: 0 | 1 = 0, hp?: number): ScenarioActor => ({ label, side, kind: 'unit', role, x, y, ...(hp === undefined ? {} : { hp }) });
const foe = (label: string, role: UnitRole, x: number, y: number, target: Vec, hp?: number): ScenarioActor => ({ ...unit(label, role, x, y, 1, hp), order: { type: 'attackMove', ...target } });
const building = (label: string, role: BuildingRole, x: number, y: number, side: 0 | 1 = 0): ScenarioActor => ({ label, side, kind: 'building', role, x, y });
const speech = (id: string, when: ScenarioCondition, speaker: string, text: string): ScenarioTrigger => ({ id, when, actions: [{ type: 'message', speaker, text }] });
const road = (...points: [number, number][]): Vec[] => points.map(([x, y]) => ({ x, y }));

/** Each mission supplies its terrain rectangles and connected routes rather than a generated skirmish map. */
function authoredMap(ground: Ground, actors: ScenarioActor[]): ScenarioMap {
  const width = 36, height = 36;
  const terrain: TerrainKind[] = Array(width * height).fill('grass');
  const paint = (x: number, y: number, kind: TerrainKind) => { if (x > 0 && y > 0 && x < width - 1 && y < height - 1) terrain[y * width + x] = kind; };
  for (const [kind, left, top, right, bottom] of ground.plots) {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) paint(x, y, kind);
  }
  for (const path of ground.paths) for (let segment = 1; segment < path.length; segment++) {
    const a = path[segment - 1], b = path[segment], steps = Math.ceil(length2D(b.x - a.x, b.y - a.y) * 3);
    for (let i = 0; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * i / Math.max(1, steps), y = a.y + (b.y - a.y) * i / Math.max(1, steps);
      for (let row = Math.floor(y - 1.35); row <= Math.ceil(y + 1.35); row++) for (let col = Math.floor(x - 1.35); col <= Math.ceil(x + 1.35); col++) {
        if (length2D(col + .5 - x, row + .5 - y) <= 1.35) {
          const old = terrain[row * width + col];
          paint(col, row, old === 'water' || old === 'shallows' || old === 'bridge' ? 'bridge' : 'road');
        }
      }
    }
  }
  for (const actor of actors) {
    const radius = actor.kind === 'building' ? 2.4 : .8;
    for (let y = Math.floor(actor.y - radius); y <= Math.ceil(actor.y + radius); y++) for (let x = Math.floor(actor.x - radius); x <= Math.ceil(actor.x + radius); x++) {
      if (length2D(x + .5 - actor.x, y + .5 - actor.y) <= radius) paint(x, y, 'grass');
    }
  }
  for (let i = 0; i < width; i++) { terrain[i] = terrain[(height - 1) * width + i] = terrain[i * width] = terrain[i * width + width - 1] = 'rock'; }
  return { size: 'small', width, height, terrain, starts: [{ x: 6, y: 28 }, { x: 29, y: 7 }], resources: [] };
}

function chapter(info: Chapter, objectives: ScenarioObjective[], events: ScenarioTrigger[], timeLimit = 240): ScenarioDefinition {
  const spawnActors = events.flatMap(event => event.actions.flatMap(action => action.type === 'spawn' ? action.actors : []));
  return {
    schemaVersion: 1, id: info.id, title: info.title, briefing: info.briefing, successText: info.success, failureText: info.failure,
    faction: info.faction, opponent: info.opponent, seed: info.seed, map: authoredMap(info.ground, [...info.army, ...spawnActors]), army: info.army,
    objectives, events: [speech('briefing', time(0), info.commander, info.briefing), ...events],
    rules: { fixedArmy: true, reinforcementBudget: 0, resources: { ...zero }, timeLimit },
  };
}

interface Ambush { checkpoint: number; actors: ScenarioActor[]; speaker: string; text: string }
function escort(info: Chapter, route: Vec[], ambushes: Ambush[]): ScenarioDefinition {
  const convoy = info.army.find(actor => actor.label === 'convoy')!;
  const events = ambushes.map((ambush, index): ScenarioTrigger => ({
    id: `ambush-${index + 1}`, when: value('escort.checkpoints', ambush.checkpoint),
    actions: [{ type: 'spawn', actors: ambush.actors }, { type: 'message', speaker: ambush.speaker, text: ambush.text }],
  }));
  const mission = chapter(info, [
    { id: 'arrival', text: `Escort ${convoy.label} through all ${route.length} checkpoints. Keep troops within seven tiles so the convoy advances.`, success: value('escort.checkpoints', route.length), failure: dead('convoy') },
    { id: 'commander', text: `Keep ${info.commander} alive until the convoy arrives.`, success: all(value('escort.checkpoints', route.length), alive('commander')), failure: dead('commander') },
  ], events);
  mission.escort = { actor: 'convoy', route, radius: 1.5, escortRadius: 7 };
  return mission;
}

interface Wave { seconds: number; actors: ScenarioActor[]; text: string }
function defense(info: Chapter, seconds: number, waves: Wave[], budget: number): ScenarioDefinition {
  const events = waves.map((wave, index): ScenarioTrigger => ({ id: `wave-${index + 1}`, when: time(wave.seconds), actions: [{ type: 'spawn', actors: wave.actors }, { type: 'message', speaker: info.commander, text: wave.text }] }));
  const mission = chapter(info, [
    { id: 'fortress', text: `Hold the fortress for ${seconds} seconds. The reinforcement allowance is ${budget}; the listed waves are finite.`, success: all(time(seconds), alive('fortress')), failure: dead('fortress') },
    { id: 'commander', text: `Keep ${info.commander} alive during the defense.`, success: all(time(seconds), alive('commander')), failure: dead('commander') },
  ], events, seconds + 90);
  mission.rules = { fixedArmy: false, reinforcementBudget: budget, resources: { wood: 220, ore: 100, crystal: 20 }, timeLimit: seconds + 90 };
  return mission;
}

interface Patrol { actor: string; route: Vec[] }
function stealth(info: Chapter, destination: Vec, extraction: Vec, guards: string[], patrols: Patrol[]): ScenarioDefinition {
  const fail = any(dead('commander'), value('stealth.alarms', 2));
  const mission = chapter(info, [
    { id: 'recover', text: `Reach the marked archive at (${destination.x}, ${destination.y}) without two alarms.`, success: value('archive.recovered'), failure: fail },
    { id: 'extract', text: `Return ${info.commander} to (${extraction.x}, ${extraction.y}) with the archive. Move around guard sight cones; fighting is optional.`, success: all(value('archive.recovered'), at('commander', extraction.x, extraction.y)), failure: fail },
  ], [
    { id: 'archive', when: at('commander', destination.x, destination.y), actions: [{ type: 'set', key: 'archive.recovered', value: 1 }, { type: 'message', speaker: info.commander, text: 'The archive is secure. Take the unguarded route back to the extraction point.' }] },
    { id: 'first-alarm', when: value('stealth.alarms'), actions: [{ type: 'message', speaker: info.commander, text: 'One alarm. Break contact before another patrol identifies us.' }] },
  ]);
  mission.stealth = { infiltrators: ['commander'], guards, alarmLimit: 2, detectionSeconds: 1.5, radius: 5, coneDegrees: 80, patrols };
  return mission;
}

function puzzle(info: Chapter, objective: string, success: ScenarioCondition, failure: ScenarioCondition, events: ScenarioTrigger[] = []): ScenarioDefinition {
  return chapter(info, [
    { id: 'solution', text: objective, success, failure },
    { id: 'commander', text: `Keep ${info.commander} alive. The army and zero-resource budget are fixed; reset restores this starting position.`, success: all(success, alive('commander')), failure: dead('commander') },
  ], events, 180);
}

interface BossSpec { name: string; health: number; location: Vec; phaseNames: [string, string, string]; radii: [number, number, number]; damage: number; adds: ScenarioActor[][]; mechanic: string }
function finale(info: Chapter, boss: BossSpec): ScenarioDefinition {
  const mission = chapter(info, [
    { id: 'boss', text: `Defeat ${boss.name}. Survive all three phases and move out of a warning circle or interrupt it with concentrated fire.`, success: all(value('boss.defeated'), value('boss.phases', 3)), failure: dead('commander') },
    { id: 'response', text: 'Dodge or interrupt at least one telegraphed attack.', success: any(value('boss.dodged'), value('boss.interrupts')), failure: dead('commander') },
    { id: 'commander', text: `Keep ${info.commander} alive.`, success: all(value('boss.defeated'), alive('commander')), failure: dead('commander') },
  ], [speech('engage', at('commander', boss.location.x, boss.location.y, 10), info.commander, `${boss.name} is in range. ${boss.mechanic}`)], 300);
  mission.boss = {
    actor: 'boss', name: boss.name, health: boss.health,
    phases: boss.phaseNames.map((name, index) => ({ below: [1, .68, .34][index], name, radius: boss.radii[index], damage: boss.damage + index * 5, warningSeconds: 4, cooldown: 8, interruptDamage: 120, adds: boss.adds[index] })),
  };
  mission.map = authoredMap(info.ground, [...info.army, ...boss.adds.flat()]);
  mission.requiredActions = [{ action: 'ability', count: 1, text: boss.mechanic }];
  return mission;
}

const ORC = 'Rakka Ironjaw', FAIRY = 'Liora Ashwing', DWARF = 'Bryn Deepforge', UNDEAD = 'Mara Ashkeeper', TIDE = 'Neris Shellsong', MACHINE = 'Unit K-7';

const missions: ScenarioDefinition[] = [
  escort({
    id: 'orcs-1', title: 'The Foundry Road', faction: 'orcs', opponent: 'dwarves', commander: ORC, seed: 7101,
    briefing: 'Rakka leads a forge crew through the abandoned quarry. Stay beside foreman Torg, clear the two ambushes, and bring him to the eastern workshop.',
    success: 'Torg reaches the workshop and restores its furnaces. Rakka can shelter the valley refugees behind the new iron gates.',
    failure: 'The forge crew is lost in the quarry. Rakka must return to the road with the same escort.',
    ground: { plots: [['rock', 12, 4, 15, 18], ['rock', 23, 21, 27, 30], ['mud', 15, 23, 22, 29]], paths: [road([7, 28], [17, 28], [23, 18], [29, 8])] },
    army: [unit('commander', 'special', 6, 26), unit('convoy', 'worker', 7, 28), unit('guard-a', 'melee', 9, 26), unit('guard-b', 'melee', 9, 29), unit('bolt-a', 'ranged', 5, 29), unit('bolt-b', 'ranged', 5, 27)],
  }, road([16, 28], [23, 18], [29, 8]), [
    { checkpoint: 1, actors: [foe('quarry-a', 'melee', 21, 27, { x: 16, y: 28 }, 85), foe('quarry-b', 'ranged', 22, 30, { x: 16, y: 28 }, 55)], speaker: 'Torg', text: 'The quarry watch has seen us. Clear the road before I pass the bend.' },
    { checkpoint: 2, actors: [foe('gate-a', 'melee', 27, 14, { x: 23, y: 18 }, 95), foe('gate-b', 'melee', 29, 17, { x: 23, y: 18 }, 95)], speaker: ORC, text: 'Two guards at the workshop. Keep them away from Torg.' },
  ]),
  defense({
    id: 'orcs-2', title: 'Refuge at Iron Gate', faction: 'orcs', opponent: 'undead', commander: ORC, seed: 7102,
    briefing: 'Mara has followed the refugee column. Hold the Iron Hall for seventy seconds while Torg closes the shelter doors. Spend the repair timber carefully; only two replacement soldiers may join.',
    success: 'The refugees survive. Rakka must choose whether to recover the toll bridge or search the enemy courier camp for a safer crossing.',
    failure: 'The shelter falls before its doors close. The refugees need the Iron Hall intact.',
    ground: { plots: [['rock', 4, 17, 13, 19], ['rock', 21, 17, 31, 19], ['mud', 14, 12, 21, 16]], paths: [road([18, 8], [18, 23], [9, 28])] },
    army: [building('fortress', 'hq', 9, 28), building('foundry', 'barracks', 5, 25), building('watch', 'tower', 17, 23), unit('commander', 'special', 16, 25), unit('line-a', 'melee', 17, 22), unit('line-b', 'melee', 20, 22), unit('bolt-a', 'ranged', 16, 26), unit('bolt-b', 'ranged', 20, 26), unit('torg', 'worker', 10, 24)],
  }, 70, [
    { seconds: 10, actors: [foe('wave1-a', 'melee', 18, 9, { x: 17, y: 23 }, 90), foe('wave1-b', 'melee', 21, 9, { x: 17, y: 23 }, 90)], text: 'Boneguards are coming through the quarry gap.' },
    { seconds: 28, actors: [foe('wave2-a', 'melee', 16, 9, { x: 17, y: 23 }), foe('wave2-b', 'ranged', 20, 8, { x: 17, y: 23 }, 65)], text: 'Their archers are behind the second rank. Push them away from the tower.' },
    { seconds: 47, actors: [foe('wave3-a', 'melee', 18, 10, { x: 9, y: 28 }), foe('wave3-b', 'melee', 21, 11, { x: 9, y: 28 })], text: 'This is the last wave. Torg needs twenty more seconds.' },
  ], 2),
  puzzle({
    id: 'orcs-3', title: 'Break the Toll Line', faction: 'orcs', opponent: 'automata', commander: ORC, seed: 7103,
    briefing: 'The toll keeper has pikes across the bridge and prism archers behind them. Your riders must use the southern ford while the Ironjaws pin the pikes. Destroy both marked archers with this army.',
    success: 'The toll line breaks. The refugees can cross openly, and Rakka confronts the keeper in his forge court.',
    failure: 'The riders are trapped at the pikes. Reset the engagement and send them around the wet southern route.',
    ground: { plots: [['water', 17, 4, 19, 30], ['shallows', 15, 24, 21, 30], ['rock', 22, 5, 27, 12]], paths: [road([7, 17], [29, 17]), road([7, 23], [16, 28], [24, 28], [29, 21])] },
    army: [unit('commander', 'special', 9, 16), unit('iron-a', 'melee', 10, 19), unit('iron-b', 'melee', 10, 21), unit('rider-a', 'cavalry', 7, 25), unit('rider-b', 'cavalry', 10, 26), { ...unit('pike-a', 'spear', 22, 16, 1), order: { type: 'hold' } }, { ...unit('pike-b', 'spear', 23, 19, 1), order: { type: 'hold' } }, { ...unit('archer-a', 'ranged', 28, 16, 1), order: { type: 'hold' } }, { ...unit('archer-b', 'ranged', 29, 20, 1), order: { type: 'hold' } }],
  }, 'Destroy the two marked prism archers. Keep at least one rider alive.', all(dead('archer-a'), dead('archer-b')), all(dead('rider-a'), dead('rider-b'))),
  stealth({
    id: 'orcs-3-alt', title: 'The Courier Camp', faction: 'orcs', opponent: 'automata', commander: ORC, seed: 7133,
    briefing: 'Rakka chooses a hidden crossing. Move through the western ravine, take the courier orders at the northern archive, and return to Torg. Two alarms close the route.',
    success: 'The orders reveal a service entrance into the keeper\'s court. The refugees cross unseen while Rakka approaches from the ravine.',
    failure: 'The courier patrol identifies Rakka twice. The service entrance is sealed until the raid is reset.',
    ground: { plots: [['rock', 12, 11, 17, 26], ['rock', 25, 11, 29, 25], ['mud', 6, 14, 10, 23]], paths: [road([7, 29], [6, 7], [22, 6]), road([20, 13], [20, 26], [30, 29])] },
    army: [unit('commander', 'special', 7, 29), unit('torg', 'worker', 5, 29), unit('patrol-a', 'melee', 20, 17, 1), unit('patrol-b', 'ranged', 27, 28, 1)],
  }, { x: 22, y: 6 }, { x: 7, y: 29 }, ['patrol-a', 'patrol-b'], [{ actor: 'patrol-a', route: road([20, 13], [20, 25]) }, { actor: 'patrol-b', route: road([24, 29], [31, 29]) }]),
  finale({
    id: 'orcs-4', title: 'The Keeper\'s Furnace', faction: 'orcs', opponent: 'automata', commander: ORC, seed: 7104,
    briefing: 'The Brass Keeper waits among the furnace pits. Build Fury with Rakka\'s War Cry, split your line when a heat circle appears, and concentrate attacks to interrupt the keeper\'s charge.',
    success: 'Rakka stops the furnace and frees the valley from the toll. Torg gives the workshop to the refugees rather than another keeper.',
    failure: 'Rakka falls inside the furnace court. The keeper still controls the crossing.',
    ground: { plots: [['rock', 13, 8, 16, 12], ['rock', 23, 23, 27, 28], ['mud', 17, 20, 21, 24]], paths: [road([8, 28], [17, 17], [28, 10]), road([13, 17], [28, 21])] },
    army: [unit('commander', 'special', 8, 25), unit('line-a', 'melee', 10, 25), unit('line-b', 'melee', 12, 26), unit('bolt-a', 'ranged', 7, 28), unit('bolt-b', 'ranged', 10, 29), { ...unit('boss', 'special', 26, 11, 1), order: { type: 'hold' } }],
  }, { name: 'Brass Keeper', health: 1400, location: { x: 26, y: 11 }, phaseNames: ['Furnace breath', 'Molten ring', 'Overpressure'], radii: [3, 4, 5], damage: 28, adds: [[], [foe('keeper-a', 'melee', 28, 16, { x: 18, y: 18 }, 65)], [foe('keeper-b', 'ranged', 30, 10, { x: 18, y: 18 }, 45)]], mechanic: 'Use War Cry to build Fury at least once during the fight.' }),

  stealth({
    id: 'fairies-1', title: 'Under the Watchers', faction: 'fairies', opponent: 'orcs', commander: FAIRY, seed: 7201,
    briefing: 'Liora searches the watcher archive for the missing grove wards. Patrols face along their routes. Walk behind them, collect the ward record, and return to the southern glade; Veil Doubles can draw a watcher away.',
    success: 'The record names a living seed in the eastern grove. Liora sends Oren to retrieve it before the watch burns the forest.',
    failure: 'The watchers raise a second alarm or catch Liora. Begin again from the southern glade.',
    ground: { plots: [['rock', 11, 12, 15, 27], ['rock', 23, 13, 27, 25], ['mud', 6, 15, 9, 24]], paths: [road([6, 29], [6, 7], [28, 7]), road([18, 11], [18, 27]), road([29, 14], [29, 27])] },
    army: [unit('commander', 'special', 6, 29), unit('oren', 'worker', 4, 29), unit('watcher-a', 'melee', 18, 15, 1), unit('watcher-b', 'ranged', 29, 22, 1)],
  }, { x: 28, y: 7 }, { x: 6, y: 29 }, ['watcher-a', 'watcher-b'], [{ actor: 'watcher-a', route: road([18, 11], [18, 27]) }, { actor: 'watcher-b', route: road([29, 14], [29, 27]) }]),
  escort({
    id: 'fairies-2', title: 'The Living Seed', faction: 'fairies', opponent: 'orcs', commander: FAIRY, seed: 7202,
    briefing: 'Tender Oren must return from the eastern nursery to the Elderheart. Escort him around the burned ridge. Keep the Mothbows behind Thornblades when the watcher groups arrive.',
    success: 'Oren returns with the seed. Liora chooses whether to defend the old grove or use its roots to open the watcher stockade.',
    failure: 'Oren or Liora is lost on the burned road. The seed never reaches the Elderheart.',
    ground: { plots: [['rock', 15, 9, 23, 18], ['mud', 12, 20, 23, 25], ['water', 27, 23, 30, 30]], paths: [road([29, 8], [28, 20], [15, 28], [6, 27])] },
    army: [unit('commander', 'special', 28, 6), unit('convoy', 'worker', 29, 8), unit('thorn-a', 'melee', 27, 9), unit('thorn-b', 'melee', 30, 10), unit('moth-a', 'ranged', 31, 6), unit('moth-b', 'ranged', 31, 8)],
  }, road([28, 20], [15, 28], [6, 27]), [
    { checkpoint: 1, actors: [foe('burner-a', 'melee', 25, 23, { x: 28, y: 20 }, 85), foe('burner-b', 'ranged', 30, 23, { x: 28, y: 20 }, 55)], speaker: 'Oren', text: 'The watchers are waiting at the southern bend. I will stay behind the Thornblades.' },
    { checkpoint: 2, actors: [foe('burner-c', 'melee', 12, 25, { x: 15, y: 28 }, 95), foe('burner-d', 'melee', 10, 30, { x: 15, y: 28 }, 95)], speaker: FAIRY, text: 'The last patrol blocks the glade. Draw it away from Oren.' },
  ]),
  defense({
    id: 'fairies-3', title: 'Roots at the Boundary', faction: 'fairies', opponent: 'dwarves', commander: FAIRY, seed: 7203,
    briefing: 'Liora stays to defend the old grove. The Moonwell heals nearby troops between attacks. Hold the Elderheart for eighty seconds, reposition the Mothbows, and use doubles to absorb cannon attention.',
    success: 'The grove survives and its roots reveal the tunnel under the watch. Liora follows them to the commander who ordered the burning.',
    failure: 'The Elderheart or Liora falls before the roots reach the tunnel. The defense must begin again.',
    ground: { plots: [['rock', 11, 6, 14, 23], ['rock', 23, 14, 28, 27], ['mud', 15, 10, 22, 17]], paths: [road([18, 6], [18, 23], [8, 29]), road([29, 9], [20, 22])] },
    army: [building('fortress', 'hq', 8, 29), building('moonwell', 'depot', 15, 27), building('bloomspire', 'barracks', 5, 25), unit('commander', 'special', 17, 25), unit('thorn-a', 'melee', 17, 21), unit('thorn-b', 'melee', 20, 23), unit('moth-a', 'ranged', 14, 24), unit('moth-b', 'ranged', 19, 27), unit('oren', 'worker', 10, 25)],
  }, 80, [
    { seconds: 12, actors: [foe('root-wave1-a', 'melee', 18, 7, { x: 17, y: 23 }, 105), foe('root-wave1-b', 'ranged', 21, 7, { x: 17, y: 23 }, 60)], text: 'The first engineers have entered the grove.' },
    { seconds: 32, actors: [foe('root-wave2-a', 'special', 28, 9, { x: 17, y: 23 }, 85), foe('root-wave2-b', 'melee', 26, 11, { x: 17, y: 23 }, 95)], text: 'A cannon is coming along the eastern path. Let doubles take its first shot.' },
    { seconds: 55, actors: [foe('root-wave3-a', 'melee', 17, 8, { x: 8, y: 29 }, 115), foe('root-wave3-b', 'ranged', 21, 8, { x: 8, y: 29 }, 65)], text: 'The roots are nearly through. Hold the Moonwell clearing.' },
  ], 2),
  puzzle({
    id: 'fairies-3-alt', title: 'A Door of Briars', faction: 'fairies', opponent: 'dwarves', commander: FAIRY, seed: 7233,
    briefing: 'Liora attacks the stockade while the grove evacuates. Two Thunderlocks cover the central path. Use doubles to draw their volleys, keep Thornblades alive, and destroy both guns with the fixed party.',
    success: 'The stockade opens without a siege. The grove families escape, and Liora reaches the burning commander from his own supply path.',
    failure: 'Liora or every Thornblade is lost at the stockade. Reset and send the doubles before the living troops.',
    ground: { plots: [['rock', 15, 4, 18, 13], ['rock', 15, 23, 18, 31], ['mud', 20, 13, 25, 22]], paths: [road([7, 18], [29, 18]), road([7, 26], [21, 29], [29, 22])] },
    army: [unit('commander', 'special', 7, 18), unit('weaver', 'special', 8, 21), unit('thorn-a', 'melee', 10, 16), unit('thorn-b', 'melee', 10, 22), unit('moth', 'ranged', 6, 21), { ...unit('gun-a', 'ranged', 25, 16, 1), order: { type: 'hold' } }, { ...unit('gun-b', 'ranged', 28, 21, 1), order: { type: 'hold' } }],
  }, 'Destroy both marked guns after conjuring at least one set of Veil Doubles.', all(dead('gun-a'), dead('gun-b'), value('action.ability')), all(dead('thorn-a'), dead('thorn-b'))),
  finale({
    id: 'fairies-4', title: 'The Ash Marshal', faction: 'fairies', opponent: 'orcs', commander: FAIRY, seed: 7204,
    briefing: 'Marshal Brakka has trapped the grove wards in an ash clearing. Conjure Liora\'s doubles to divide his attacks, leave the warning circles, and bring down the marshal before he burns the final ward.',
    success: 'The wards return to the living seed. Liora lets the forest reclaim the watch road, and Oren plants a new grove at its gate.',
    failure: 'Liora falls and Brakka keeps the captured wards. Begin the final assault again.',
    ground: { plots: [['rock', 10, 12, 14, 18], ['rock', 23, 6, 27, 11], ['mud', 16, 17, 22, 23]], paths: [road([7, 29], [16, 26], [27, 17]), road([8, 21], [18, 10], [28, 17])] },
    army: [unit('commander', 'special', 7, 27), unit('weaver', 'special', 9, 29), unit('thorn-a', 'melee', 11, 26), unit('thorn-b', 'melee', 13, 27), unit('moth-a', 'ranged', 6, 30), unit('moth-b', 'ranged', 10, 31), { ...unit('boss', 'special', 27, 17, 1), order: { type: 'hold' } }],
  }, { name: 'Marshal Brakka', health: 1500, location: { x: 27, y: 17 }, phaseNames: ['Cinder sweep', 'Ash circles', 'Burning oath'], radii: [3, 4, 4.5], damage: 25, adds: [[], [foe('marshal-a', 'melee', 30, 20, { x: 23, y: 20 }, 60)], [foe('marshal-b', 'ranged', 30, 13, { x: 23, y: 20 }, 45)]], mechanic: 'Conjure Veil Doubles at least once during the fight.' }),

  puzzle({
    id: 'dwarves-1', title: 'The Long Shot', faction: 'dwarves', opponent: 'orcs', commander: DWARF, seed: 7301,
    briefing: 'Bryn has one cannon and a small escort. The quarry tower outranges the unprepared gun. Emplace the cannon on the western firing shelf, protect it from the Ironjaws, and destroy the marked tower.',
    success: 'The tower falls from the prepared shelf. Bryn brings the quarry workers inside the Mountain Keep before the warband returns.',
    failure: 'Bryn or the cannon is lost. Reset and prepare the firing position before engaging the tower.',
    ground: { plots: [['rock', 17, 4, 21, 13], ['rock', 17, 23, 21, 31], ['mud', 14, 14, 18, 22]], paths: [road([6, 18], [29, 18]), road([10, 26], [26, 26], [29, 18])] },
    army: [unit('commander', 'melee', 8, 17), unit('cannon', 'special', 6, 20), unit('shield', 'melee', 10, 21), unit('gun-a', 'ranged', 7, 23), unit('gun-b', 'ranged', 11, 24), building('target-tower', 'tower', 28, 18, 1), { ...unit('raider', 'melee', 25, 24, 1, 100), order: { type: 'hold' } }],
  }, 'Emplace at least one unit and destroy the quarry tower. Keep the cannon alive.', all(dead('target-tower'), value('action.ability')), dead('cannon')),
  defense({
    id: 'dwarves-2', title: 'Seventy Seconds at Deep Gate', faction: 'dwarves', opponent: 'orcs', commander: DWARF, seed: 7302,
    briefing: 'The quarry crew is inside. Emplace Bryn\'s line at the narrow Deep Gate and hold the Mountain Keep for seventy-five seconds. Sena has repair timber and a two-soldier reserve.',
    success: 'Sena closes the Deep Gate. Bryn can escort the surveyor through the mines or scout the warband\'s northern works.',
    failure: 'The Mountain Keep or Bryn falls while the gate is open. Reset the defensive line.',
    ground: { plots: [['rock', 3, 17, 14, 20], ['rock', 22, 17, 32, 20], ['mud', 15, 8, 21, 13]], paths: [road([18, 6], [18, 29]), road([8, 28], [18, 26])] },
    army: [building('fortress', 'hq', 9, 29), building('gunsmith', 'barracks', 5, 25), building('bastion', 'tower', 17, 24), unit('commander', 'melee', 17, 22), unit('shield', 'melee', 20, 22), unit('cannon', 'special', 16, 28), unit('gun-a', 'ranged', 16, 26), unit('gun-b', 'ranged', 21, 26), unit('sena', 'worker', 10, 25)],
  }, 75, [
    { seconds: 10, actors: [foe('gate-wave1-a', 'melee', 16, 7, { x: 18, y: 24 }, 100), foe('gate-wave1-b', 'melee', 20, 7, { x: 18, y: 24 }, 100)], text: 'The first Ironjaws are in the gate road. Prepare the firing line.' },
    { seconds: 30, actors: [foe('gate-wave2-a', 'ranged', 17, 8, { x: 18, y: 24 }, 65), foe('gate-wave2-b', 'special', 21, 8, { x: 18, y: 24 }, 120)], text: 'A Wardrum is screening their crossbows. Keep the cannon behind the shields.' },
    { seconds: 53, actors: [foe('gate-wave3-a', 'melee', 16, 9, { x: 9, y: 29 }, 125), foe('gate-wave3-b', 'melee', 20, 9, { x: 9, y: 29 }, 125)], text: 'The final wave is here. Sena is lowering the gate.' },
  ], 2),
  escort({
    id: 'dwarves-3', title: 'The Surveyor\'s Passage', faction: 'dwarves', opponent: 'undead', commander: DWARF, seed: 7303,
    briefing: 'Surveyor Sena knows the route to the stolen pump. Escort her around the flooded galleries. Pack up emplacement before moving, then prepare again when the dead emerge at each crossing.',
    success: 'Sena marks the dry route to the pump chamber. Bryn can confront the Grave Warden without crossing its flooded gun line.',
    failure: 'Sena or Bryn is lost in the galleries. Reset and move the escort with the surveyor.',
    ground: { plots: [['water', 12, 4, 16, 23], ['water', 23, 14, 28, 31], ['shallows', 17, 18, 22, 26]], paths: [road([7, 29], [18, 29], [19, 12], [29, 7])] },
    army: [unit('commander', 'melee', 6, 27), unit('convoy', 'worker', 7, 29), unit('shield', 'melee', 10, 29), unit('cannon', 'special', 4, 28), unit('gun-a', 'ranged', 5, 31), unit('gun-b', 'ranged', 9, 31)],
  }, road([18, 29], [19, 12], [29, 7]), [
    { checkpoint: 1, actors: [foe('gallery-a', 'melee', 20, 25, { x: 18, y: 29 }, 85), foe('gallery-b', 'ranged', 17, 24, { x: 18, y: 29 }, 55)], speaker: 'Sena', text: 'Boneguards in the lower gallery. Set the guns while I wait behind your line.' },
    { checkpoint: 2, actors: [foe('gallery-c', 'melee', 24, 10, { x: 19, y: 12 }, 95), foe('gallery-d', 'melee', 25, 14, { x: 19, y: 12 }, 95)], speaker: DWARF, text: 'The pump guards have reached the upper crossing. Hold them here.' },
  ]),
  stealth({
    id: 'dwarves-3-alt', title: 'The Northern Works', faction: 'dwarves', opponent: 'undead', commander: DWARF, seed: 7333,
    briefing: 'Bryn scouts the northern works alone while Sena holds Deep Gate. Take the pump plans at the east archive and return through the high western passage. Two detections bring down the tunnel shutters.',
    success: 'The plans identify the Warden\'s pressure chambers. Bryn takes the northern maintenance path into the final battle.',
    failure: 'Bryn raises a second alarm or falls in the works. Begin again outside the tunnel shutters.',
    ground: { plots: [['rock', 11, 10, 16, 26], ['rock', 23, 12, 27, 27], ['water', 18, 19, 21, 29]], paths: [road([6, 29], [6, 6], [29, 6]), road([20, 9], [20, 17]), road([29, 14], [29, 29])] },
    army: [unit('commander', 'melee', 6, 29), unit('sena', 'worker', 4, 29), unit('sentry-a', 'melee', 20, 12, 1), unit('sentry-b', 'ranged', 29, 22, 1)],
  }, { x: 29, y: 6 }, { x: 6, y: 29 }, ['sentry-a', 'sentry-b'], [{ actor: 'sentry-a', route: road([20, 9], [20, 17]) }, { actor: 'sentry-b', route: road([29, 14], [29, 29]) }]),
  finale({
    id: 'dwarves-4', title: 'The Grave Warden\'s Pump', faction: 'dwarves', opponent: 'undead', commander: DWARF, seed: 7304,
    briefing: 'The Grave Warden has occupied the pump chamber. Emplace Bryn\'s troops on dry ground, interrupt pressure bursts with the cannons, and pack up when a warning circle covers the firing shelf.',
    success: 'The pump runs again and the mines drain. Bryn leaves Sena in charge of the works, with a firing shelf prepared at every entrance.',
    failure: 'Bryn falls before the pump is recovered. The mines remain flooded under the Warden.',
    ground: { plots: [['water', 13, 7, 17, 14], ['water', 23, 23, 28, 29], ['shallows', 15, 17, 24, 22]], paths: [road([7, 28], [15, 25], [26, 15]), road([9, 19], [21, 10], [26, 15])] },
    army: [unit('commander', 'melee', 8, 25), unit('shield', 'melee', 11, 26), unit('cannon-a', 'special', 6, 28), unit('cannon-b', 'special', 9, 29), unit('gun', 'ranged', 12, 29), { ...unit('boss', 'special', 26, 15, 1), order: { type: 'hold' } }],
  }, { name: 'Grave Warden', health: 1600, location: { x: 26, y: 15 }, phaseNames: ['Pressure leak', 'Flood pulse', 'Broken seals'], radii: [3, 4, 5], damage: 27, adds: [[], [foe('warden-a', 'melee', 29, 18, { x: 22, y: 20 }, 65)], [foe('warden-b', 'melee', 27, 10, { x: 22, y: 20 }, 65)]], mechanic: 'Emplace a unit at least once during the fight; movement packs it up.' }),

  defense({
    id: 'undead-1', title: 'A Vigil for the Fallen', faction: 'undead', opponent: 'orcs', commander: UNDEAD, seed: 7401,
    briefing: 'Mara guards the burial gate until the mourners leave. Keep Gravecallers behind the Boneguards, where fresh mortal corpses can be raised. Hold the Necropolis for sixty-five seconds with at most one replacement soldier.',
    success: 'The mourners leave safely. Iven reports that the warband is removing names from the burial ledgers, and Mara follows its patrol.',
    failure: 'Mara or the Necropolis falls while the mourners remain inside. The vigil must begin again.',
    ground: { plots: [['rock', 5, 14, 12, 22], ['rock', 25, 17, 31, 24], ['mud', 14, 9, 24, 15]], paths: [road([19, 6], [19, 25], [9, 29])] },
    army: [building('fortress', 'hq', 9, 29), building('crypt', 'barracks', 5, 26), unit('commander', 'special', 18, 25), unit('bone-a', 'melee', 17, 22), unit('bone-b', 'melee', 21, 22), unit('bone-c', 'melee', 23, 25), unit('bow-a', 'ranged', 17, 28), unit('bow-b', 'ranged', 22, 28), unit('iven', 'worker', 10, 25)],
  }, 65, [
    { seconds: 9, actors: [foe('vigil-wave1-a', 'melee', 17, 8, { x: 19, y: 24 }, 75), foe('vigil-wave1-b', 'melee', 22, 8, { x: 19, y: 24 }, 75)], text: 'The first attackers reach the burial road. Keep their fallen within Mara\'s sight.' },
    { seconds: 26, actors: [foe('vigil-wave2-a', 'melee', 18, 8, { x: 19, y: 24 }, 95), foe('vigil-wave2-b', 'ranged', 22, 9, { x: 19, y: 24 }, 55)], text: 'Their crossbows are approaching. Raised troops can screen the living mourners.' },
    { seconds: 44, actors: [foe('vigil-wave3-a', 'special', 19, 9, { x: 9, y: 29 }, 110)], text: 'One Wardrum remains. The last mourners are leaving.' },
  ], 1),
  stealth({
    id: 'undead-2', title: 'Names in the Watchbook', faction: 'undead', opponent: 'orcs', commander: UNDEAD, seed: 7402,
    briefing: 'Mara enters the patrol camp with Iven waiting outside. Recover the erased burial list from the eastern watchbook and return without two alarms. Move rather than attack through the high northern path.',
    success: 'The watchbook names the captive archivist. Mara chooses whether to escort the archivist out or break the guard formation at the burial bridge.',
    failure: 'The patrol catches Mara or raises a second alarm. The watchbook raid must begin again.',
    ground: { plots: [['rock', 10, 12, 15, 26], ['rock', 23, 13, 27, 26], ['mud', 16, 20, 22, 29]], paths: [road([6, 29], [6, 6], [30, 6]), road([19, 11], [19, 18]), road([30, 13], [30, 28])] },
    army: [unit('commander', 'special', 6, 29), unit('iven', 'worker', 4, 29), unit('watch-a', 'melee', 19, 14, 1), unit('watch-b', 'ranged', 30, 22, 1)],
  }, { x: 30, y: 6 }, { x: 6, y: 29 }, ['watch-a', 'watch-b'], [{ actor: 'watch-a', route: road([19, 11], [19, 18]) }, { actor: 'watch-b', route: road([30, 13], [30, 28]) }]),
  escort({
    id: 'undead-3', title: 'The Last Archivist', faction: 'undead', opponent: 'fairies', commander: UNDEAD, seed: 7403,
    briefing: 'Archivist Iven walks home carrying the names in memory. Escort him around the drowned grove. Keep the mortal Boneguards between him and the guardians, and leave spare room in the Ossuary for raised troops.',
    success: 'Iven returns and restores the burial ledgers. The names lead Mara to the Ash Judge who ordered them erased.',
    failure: 'Iven or Mara is lost before the ledgers can be restored. Reset the escort from the drowned grove.',
    ground: { plots: [['water', 11, 13, 16, 28], ['mud', 18, 17, 24, 26], ['rock', 26, 8, 30, 17]], paths: [road([7, 29], [19, 29], [21, 12], [29, 6])] },
    army: [building('ossuary', 'depot', 5, 24), unit('commander', 'special', 8, 26), unit('convoy', 'worker', 7, 29), unit('bone-a', 'melee', 10, 28), unit('bone-b', 'melee', 10, 31), unit('bow-a', 'ranged', 4, 28), unit('bow-b', 'ranged', 5, 31)],
  }, road([19, 29], [21, 12], [29, 6]), [
    { checkpoint: 1, actors: [foe('grove-a', 'melee', 22, 25, { x: 19, y: 29 }, 85), foe('grove-b', 'ranged', 18, 24, { x: 19, y: 29 }, 50)], speaker: 'Iven', text: 'The grove guardians do not know who we are. Keep them away while I pass.' },
    { checkpoint: 2, actors: [foe('grove-c', 'melee', 23, 8, { x: 21, y: 12 }, 90), foe('grove-d', 'melee', 26, 11, { x: 21, y: 12 }, 90)], speaker: UNDEAD, text: 'The upper grove is guarded too. Iven, wait behind the Boneguards.' },
  ]),
  puzzle({
    id: 'undead-3-alt', title: 'The Burial Bridge', faction: 'undead', opponent: 'orcs', commander: UNDEAD, seed: 7433,
    briefing: 'Mara frees the burial bridge instead of following the archivist. Kill the two wounded gate guards near the Ossuary, raise their real corpses, and destroy the marked crossbow captain. The first corpses are close enough to use immediately.',
    success: 'Raised guards turn on the captain and open the bridge. Mara follows the recovered names into the Ash Judge\'s court.',
    failure: 'Mara falls before the bridge captain is defeated. Reset and raise the fresh gate-guard corpses before they expire.',
    ground: { plots: [['water', 17, 4, 20, 31], ['shallows', 14, 23, 23, 28], ['rock', 26, 24, 30, 30]], paths: [road([7, 18], [30, 18]), road([8, 27], [25, 27], [29, 20])] },
    army: [building('ossuary', 'depot', 7, 23), unit('commander', 'special', 10, 18), unit('bone-a', 'melee', 12, 17), unit('bone-b', 'melee', 12, 20), unit('bow-a', 'ranged', 8, 16), unit('bow-b', 'ranged', 8, 20), foe('wounded-a', 'melee', 15, 16, { x: 12, y: 17 }, 25), foe('wounded-b', 'melee', 15, 21, { x: 12, y: 20 }, 25), { ...unit('captain', 'ranged', 29, 18, 1), order: { type: 'hold' } }],
  }, 'Raise at least one fresh corpse and defeat the marked bridge captain.', all(value('action.ability'), dead('captain')), dead('commander')),
  finale({
    id: 'undead-4', title: 'The Ash Judge', faction: 'undead', opponent: 'orcs', commander: UNDEAD, seed: 7404,
    briefing: 'The Ash Judge guards the erased names. His wounded mortal guards leave corpses; move Mara close enough to raise them, then use those ranks to screen the Gravebows. Leave the judgment circles or interrupt the Judge\'s sentence.',
    success: 'The Judge falls and the names return to the ledgers. Mara ends the march at the burial gate, with Iven recording every soldier who did not return.',
    failure: 'Mara falls before the names are restored. The Ash Judge keeps the court.',
    ground: { plots: [['rock', 13, 7, 17, 13], ['rock', 25, 24, 29, 29], ['mud', 17, 16, 23, 22]], paths: [road([7, 29], [17, 25], [27, 15]), road([10, 19], [22, 10], [27, 15])] },
    army: [building('ossuary', 'depot', 5, 25), unit('commander', 'special', 9, 24), unit('bone-a', 'melee', 11, 22), unit('bone-b', 'melee', 14, 24), unit('bone-c', 'melee', 15, 26), unit('bow-a', 'ranged', 8, 28), unit('bow-b', 'ranged', 11, 29), unit('bow-c', 'ranged', 14, 30), foe('judge-guard-a', 'melee', 19, 23, { x: 14, y: 24 }, 35), foe('judge-guard-b', 'melee', 19, 27, { x: 15, y: 26 }, 35), { ...unit('boss', 'special', 27, 15, 1), order: { type: 'hold' } }],
  }, { name: 'Ash Judge', health: 1600, location: { x: 27, y: 15 }, phaseNames: ['First sentence', 'The accused rise', 'Final judgment'], radii: [3, 4, 5], damage: 24, adds: [[], [foe('judge-a', 'melee', 26, 20, { x: 22, y: 20 }, 45)], [foe('judge-b', 'melee', 29, 11, { x: 22, y: 20 }, 45)]], mechanic: 'Raise at least one real corpse during the fight; the Ossuary leaves three free population slots.' }),

  escort({
    id: 'tideborn-1', title: 'The Low-Tide Crossing', faction: 'tideborn', opponent: 'dwarves', commander: TIDE, seed: 7501,
    briefing: 'Neris guides Reef Tender Pell across the low-tide flats. Tideborn cross mud and shallows without the usual slowdown. Clear each patrol and stay near Pell until he reaches the Coral Hold.',
    success: 'Pell reaches the Coral Hold with the tide ledger. Neris can plan an attack on the dry-land customs fort.',
    failure: 'Pell or Neris is lost on the flats. Reset and keep the formation beside the tender.',
    ground: { plots: [['shallows', 10, 8, 25, 29], ['water', 15, 4, 20, 10], ['water', 25, 23, 31, 30]], paths: [road([6, 29], [17, 28], [24, 17], [29, 7])] },
    army: [unit('commander', 'special', 6, 27), unit('convoy', 'worker', 6, 29), unit('shell-a', 'melee', 9, 27), unit('shell-b', 'melee', 9, 30), unit('harpoon-a', 'ranged', 4, 28), unit('harpoon-b', 'ranged', 4, 31)],
  }, road([17, 28], [24, 17], [29, 7]), [
    { checkpoint: 1, actors: [foe('flat-a', 'melee', 21, 25, { x: 17, y: 28 }, 95), foe('flat-b', 'ranged', 22, 29, { x: 17, y: 28 }, 55)], speaker: 'Pell', text: 'Customs troops on the middle flat. They move slowly through the shallows.' },
    { checkpoint: 2, actors: [foe('flat-c', 'melee', 28, 13, { x: 24, y: 17 }, 100), foe('flat-d', 'melee', 29, 17, { x: 24, y: 17 }, 100)], speaker: TIDE, text: 'Use the wet flank and bring Pell through after their line turns.' },
  ]),
  puzzle({
    id: 'tideborn-2', title: 'The Customs Causeway', faction: 'tideborn', opponent: 'dwarves', commander: TIDE, seed: 7502,
    briefing: 'A prepared cannon covers the dry causeway. Send Shellguards through the southern shallows while the Harpooners hold the crossing. Defeat the cannon and its marked guard with this army.',
    success: 'The causeway opens. Neris chooses to recover the customs records unseen or defend Pell\'s new tidal basin against the counterattack.',
    failure: 'Neris or both Shellguards fall on the dry road. Reset and approach through the shallows.',
    ground: { plots: [['water', 16, 4, 20, 12], ['shallows', 13, 22, 27, 30], ['mud', 21, 13, 26, 20]], paths: [road([6, 18], [29, 18])] },
    army: [unit('commander', 'special', 7, 19), unit('shell-a', 'melee', 9, 25), unit('shell-b', 'melee', 11, 27), unit('harpoon-a', 'ranged', 6, 16), unit('harpoon-b', 'ranged', 9, 16), { ...unit('customs-cannon', 'special', 28, 18, 1), order: { type: 'hold' } }, { ...unit('customs-guard', 'melee', 25, 18, 1, 120), order: { type: 'hold' } }],
  }, 'Defeat the marked customs cannon and guard. Keep at least one Shellguard alive.', all(dead('customs-cannon'), dead('customs-guard')), all(dead('shell-a'), dead('shell-b'))),
  stealth({
    id: 'tideborn-3', title: 'The Harbor Ledger', faction: 'tideborn', opponent: 'automata', commander: TIDE, seed: 7503,
    briefing: 'Neris crosses the wet western flats to the harbor archive. Recover the ledger and return to Pell without two alarms. Machine patrols use the dry piers; Tideborn can take the mud around them.',
    success: 'The ledger reveals that the Harbor Regent diverted the returning tide. Neris enters the regulator court from the flooded western wall.',
    failure: 'The pier patrols catch Neris or raise a second alarm. Reset the harbor approach.',
    ground: { plots: [['mud', 4, 10, 10, 26], ['water', 12, 11, 16, 29], ['water', 24, 13, 28, 25], ['shallows', 4, 5, 29, 9]], paths: [road([19, 12], [19, 27]), road([30, 13], [30, 29])] },
    army: [unit('commander', 'special', 6, 29), unit('pell', 'worker', 4, 29), unit('pier-a', 'melee', 19, 15, 1), unit('pier-b', 'ranged', 30, 23, 1)],
  }, { x: 29, y: 6 }, { x: 6, y: 29 }, ['pier-a', 'pier-b'], [{ actor: 'pier-a', route: road([19, 12], [19, 27]) }, { actor: 'pier-b', route: road([30, 13], [30, 29]) }]),
  defense({
    id: 'tideborn-3-alt', title: 'Hold the Tidal Basin', faction: 'tideborn', opponent: 'automata', commander: TIDE, seed: 7533,
    briefing: 'Neris stays to protect Pell\'s new basin. The attackers arrive along two piers. Hold the Coral Hold for seventy-five seconds, heal the formation with Returning Tide, and use the wet ground to meet each wave.',
    success: 'The basin survives and restores water to the harbor wall. Neris follows the returning tide into the Regent\'s court.',
    failure: 'Neris or the Coral Hold falls before the basin fills. Reset the harbor defense.',
    ground: { plots: [['water', 11, 12, 15, 27], ['water', 24, 13, 28, 27], ['shallows', 16, 18, 23, 30], ['mud', 4, 16, 10, 22]], paths: [road([19, 6], [19, 28]), road([30, 8], [30, 28], [19, 28])] },
    army: [building('fortress', 'hq', 8, 29), building('basin', 'depot', 17, 28), building('lodge', 'barracks', 5, 25), unit('commander', 'special', 19, 25), unit('shell-a', 'melee', 17, 22), unit('shell-b', 'melee', 23, 24), unit('harpoon-a', 'ranged', 16, 26), unit('harpoon-b', 'ranged', 21, 28), unit('pell', 'worker', 10, 25)],
  }, 75, [
    { seconds: 11, actors: [foe('basin-wave1-a', 'melee', 18, 7, { x: 19, y: 25 }, 100), foe('basin-wave1-b', 'ranged', 22, 8, { x: 19, y: 25 }, 55)], text: 'Sentinels on the central pier. Keep the formation together for Returning Tide.' },
    { seconds: 30, actors: [foe('basin-wave2-a', 'melee', 30, 9, { x: 23, y: 25 }, 100), foe('basin-wave2-b', 'ranged', 30, 13, { x: 23, y: 25 }, 55)], text: 'The eastern pier has a second group. Take the shallow crossing to meet it.' },
    { seconds: 51, actors: [foe('basin-wave3-a', 'special', 18, 8, { x: 8, y: 29 }, 95), foe('basin-wave3-b', 'melee', 21, 8, { x: 8, y: 29 }, 110)], text: 'The last machines are advancing. Pell needs twenty more seconds.' },
  ], 2),
  finale({
    id: 'tideborn-4', title: 'The Harbor Regent', faction: 'tideborn', opponent: 'automata', commander: TIDE, seed: 7504,
    briefing: 'The Harbor Regent is forcing the tide into his regulator. Use Returning Tide to heal Neris\'s formation and move clear of pressure circles. Wet routes reach both sides of the court.',
    success: 'The regulator opens and the tide returns to the flats. Neris appoints Pell harbor keeper under a ledger every village can read.',
    failure: 'Neris falls and the regulator remains shut. Reset the court assault.',
    ground: { plots: [['water', 12, 8, 16, 15], ['water', 24, 24, 29, 29], ['shallows', 14, 17, 25, 23], ['mud', 7, 16, 11, 25]], paths: [road([6, 29], [17, 27], [27, 15]), road([6, 10], [21, 8], [27, 15])] },
    army: [unit('commander', 'special', 8, 25), unit('shell-a', 'melee', 11, 24), unit('shell-b', 'melee', 13, 26), unit('harpoon-a', 'ranged', 6, 28), unit('harpoon-b', 'ranged', 10, 29), { ...unit('boss', 'special', 27, 15, 1), order: { type: 'hold' } }],
  }, { name: 'Harbor Regent', health: 1300, location: { x: 27, y: 15 }, phaseNames: ['Pressure jet', 'Returning breakers', 'Regulator collapse'], radii: [3, 4, 5], damage: 30, adds: [[], [foe('regent-a', 'melee', 29, 20, { x: 22, y: 21 }, 65)], [foe('regent-b', 'ranged', 29, 10, { x: 22, y: 21 }, 45)]], mechanic: 'Cast Returning Tide at least once during the fight to heal and speed the formation.' }),

  puzzle({
    id: 'automata-1', title: 'The Broken Relay', faction: 'automata', opponent: 'fairies', commander: MACHINE, seed: 7601,
    briefing: 'K-7 has a fixed repair party and no resource budget. Thornblades cover the relay. Defeat the two marked blockers, then move K-7 to the relay pad while the Prism Archers keep their distance.',
    success: 'The relay records a request from a disconnected foundry. K-7 follows it rather than the old command to abandon damaged units.',
    failure: 'K-7 or both Prism Archers are lost. Reset the relay party and keep the archers behind the Sentinels.',
    ground: { plots: [['rock', 13, 7, 17, 13], ['rock', 13, 23, 17, 29], ['mud', 20, 14, 25, 21]], paths: [road([7, 18], [29, 18]), road([8, 27], [26, 27], [29, 18])] },
    army: [unit('commander', 'special', 7, 18), unit('sentinel-a', 'melee', 10, 16), unit('sentinel-b', 'melee', 10, 21), unit('prism-a', 'ranged', 6, 22), unit('prism-b', 'ranged', 8, 25), { ...unit('blocker-a', 'melee', 24, 16, 1, 120), order: { type: 'hold' } }, { ...unit('blocker-b', 'melee', 27, 21, 1, 120), order: { type: 'hold' } }],
  }, 'Defeat both marked blockers and bring K-7 to the relay pad at (29, 18).', all(dead('blocker-a'), dead('blocker-b'), at('commander', 29, 18)), all(dead('prism-a'), dead('prism-b'))),
  stealth({
    id: 'automata-2', title: 'The Obsolete Command', faction: 'automata', opponent: 'dwarves', commander: MACHINE, seed: 7602,
    briefing: 'K-7 enters the survey depot to recover the order that cut power to the foundry. Follow the western road, reach the northern archive, and return to Assembler M-2 without two alarms.',
    success: 'The order came from the Null Architect. K-7 chooses whether to defend the disconnected foundry or escort M-2 through the repair route.',
    failure: 'K-7 is destroyed or identified twice. Reset the survey-depot approach.',
    ground: { plots: [['rock', 12, 12, 16, 27], ['rock', 24, 13, 28, 26], ['mud', 17, 20, 22, 29]], paths: [road([6, 29], [6, 6], [30, 6]), road([20, 11], [20, 18]), road([30, 14], [30, 28])] },
    army: [unit('commander', 'special', 6, 29), unit('m-2', 'worker', 4, 29), unit('survey-a', 'melee', 20, 15, 1), unit('survey-b', 'ranged', 30, 22, 1)],
  }, { x: 30, y: 6 }, { x: 6, y: 29 }, ['survey-a', 'survey-b'], [{ actor: 'survey-a', route: road([20, 11], [20, 18]) }, { actor: 'survey-b', route: road([30, 14], [30, 28]) }]),
  defense({
    id: 'automata-3', title: 'The Disconnected Foundry', faction: 'automata', opponent: 'tideborn', commander: MACHINE, seed: 7603,
    briefing: 'K-7 remains with the damaged foundry. Restore wards when shields take damage, pull the line back to recharge between waves, and hold the Core Foundry for eighty seconds. Only two replacement soldiers are available.',
    success: 'The foundry reconnects and gives K-7 an independent command link. The Null Architect must now answer to the machines it discarded.',
    failure: 'K-7 or the Core Foundry falls before reconnection. Reset the shield line.',
    ground: { plots: [['rock', 5, 15, 13, 20], ['rock', 23, 15, 31, 20], ['shallows', 14, 9, 22, 14]], paths: [road([18, 6], [18, 29]), road([8, 28], [18, 24])] },
    army: [building('fortress', 'hq', 8, 29), building('assembly', 'barracks', 5, 25), building('prism-tower', 'tower', 17, 24), unit('commander', 'special', 18, 26), unit('sentinel-a', 'melee', 16, 22), unit('sentinel-b', 'melee', 21, 22), unit('prism-a', 'ranged', 16, 27), unit('prism-b', 'ranged', 21, 27), unit('m-2', 'worker', 10, 25)],
  }, 80, [
    { seconds: 12, actors: [foe('foundry-wave1-a', 'melee', 17, 8, { x: 18, y: 24 }, 100), foe('foundry-wave1-b', 'ranged', 21, 8, { x: 18, y: 24 }, 55)], text: 'The first harbor formation is coming. Hold the shield line together.' },
    { seconds: 33, actors: [foe('foundry-wave2-a', 'melee', 16, 8, { x: 18, y: 24 }, 105), foe('foundry-wave2-b', 'special', 21, 8, { x: 18, y: 24 }, 80)], text: 'A Tidecaller is behind the second group. Restore wards before the line breaks.' },
    { seconds: 56, actors: [foe('foundry-wave3-a', 'melee', 17, 8, { x: 8, y: 29 }, 115), foe('foundry-wave3-b', 'ranged', 21, 8, { x: 8, y: 29 }, 65)], text: 'The link is almost restored. This is the final attack.' },
  ], 2),
  escort({
    id: 'automata-3-alt', title: 'The Repair Route', faction: 'automata', opponent: 'tideborn', commander: MACHINE, seed: 7633,
    briefing: 'K-7 follows Assembler M-2 along the old repair route. Stay beside M-2, keep Sentinels in front when the harbor guards arrive, and restore shields before crossing the final wet span.',
    success: 'M-2 reaches the independent relay and reconnects the foundry remotely. K-7 advances through the service entrance to the Null Architect.',
    failure: 'M-2 or K-7 is lost on the repair route. Reset and move the formation beside the assembler.',
    ground: { plots: [['water', 12, 4, 16, 22], ['water', 23, 15, 28, 30], ['shallows', 17, 18, 22, 26]], paths: [road([7, 29], [18, 29], [19, 12], [29, 7])] },
    army: [unit('commander', 'special', 6, 27), unit('convoy', 'worker', 7, 29), unit('sentinel-a', 'melee', 10, 28), unit('sentinel-b', 'melee', 10, 31), unit('prism-a', 'ranged', 4, 28), unit('prism-b', 'ranged', 5, 31)],
  }, road([18, 29], [19, 12], [29, 7]), [
    { checkpoint: 1, actors: [foe('repair-a', 'melee', 20, 25, { x: 18, y: 29 }, 85), foe('repair-b', 'ranged', 17, 24, { x: 18, y: 29 }, 50)], speaker: 'Assembler M-2', text: 'Harbor guards at the lower span. I will wait for the Sentinels.' },
    { checkpoint: 2, actors: [foe('repair-c', 'melee', 24, 10, { x: 19, y: 12 }, 95), foe('repair-d', 'melee', 25, 14, { x: 19, y: 12 }, 95)], speaker: MACHINE, text: 'The relay guards are here. Restore the formation and clear the span.' },
  ]),
  finale({
    id: 'automata-4', title: 'The Null Architect', faction: 'automata', opponent: 'dwarves', commander: MACHINE, seed: 7604,
    briefing: 'The Null Architect is dismantling the independent relay. Restore damaged wards with K-7, spread the shield line around warning circles, and interrupt the Architect\'s purge with Prism Archer fire.',
    success: 'The Architect is defeated. K-7 keeps the foundry connected and removes the command that marked its damaged workers expendable.',
    failure: 'K-7 is destroyed and the independent relay falls. Reset the final formation.',
    ground: { plots: [['rock', 11, 9, 15, 15], ['rock', 24, 24, 29, 29], ['mud', 17, 17, 24, 22]], paths: [road([7, 29], [16, 26], [27, 14]), road([8, 18], [21, 9], [27, 14])] },
    army: [unit('commander', 'special', 8, 25), unit('sentinel-a', 'melee', 11, 24), unit('sentinel-b', 'melee', 13, 26), unit('prism-a', 'ranged', 6, 28), unit('prism-b', 'ranged', 10, 29), { ...unit('boss', 'special', 27, 14, 1), order: { type: 'hold' } }],
  }, { name: 'Null Architect', health: 1300, location: { x: 27, y: 14 }, phaseNames: ['Diagnostic purge', 'Fault isolation', 'Emergency shutdown'], radii: [3, 4, 5], damage: 28, adds: [[], [foe('architect-a', 'melee', 29, 18, { x: 22, y: 20 }, 65)], [foe('architect-b', 'ranged', 29, 9, { x: 22, y: 20 }, 45)]], mechanic: 'Restore damaged shields with Ward Engine at least once during the fight.' }),
];

export const SCENARIOS: Record<string, ScenarioDefinition> = Object.fromEntries(missions.map(mission => [mission.id, mission]));

const campaigns: CampaignDefinition[] = [
  { id: 'campaign-orcs', faction: 'orcs', title: 'A Hall for the Valley', commander: ORC, cast: [{ name: 'Torg', role: 'Forge foreman and refugee guide' }, { name: 'Brass Keeper', role: 'Machine toll keeper' }], introduction: 'Rakka opens a quarry workshop to refugees and refuses to pay the keeper who controls their only crossing.', chapters: ['orcs-1', 'orcs-2', 'orcs-3', 'orcs-4'], choice: { prompt: 'The shelter is secure. How should Rakka open the crossing?', options: [{ id: 'bridge', text: 'Break the toll line', consequence: 'Fight the pikes and archers at the toll bridge with a fixed warband.', chapter3: 'orcs-3' }, { id: 'courier', text: 'Steal the courier orders', consequence: 'Enter the patrol camp with Rakka and find a hidden service entrance.', chapter3: 'orcs-3-alt' }] } },
  { id: 'campaign-fairies', faction: 'fairies', title: 'The Returning Grove', commander: FAIRY, cast: [{ name: 'Oren', role: 'Tender of the living seed' }, { name: 'Marshal Brakka', role: 'Commander of the grove watch' }], introduction: 'Liora recovers the grove wards from a watch that burns every road it cannot control.', chapters: ['fairies-1', 'fairies-2', 'fairies-3', 'fairies-4'], choice: { prompt: 'The living seed is safe. Where should Liora lead the Court?', options: [{ id: 'grove', text: 'Defend the old grove', consequence: 'Hold the Elderheart and Moonwell through the watch attack.', chapter3: 'fairies-3' }, { id: 'stockade', text: 'Open the watcher stockade', consequence: 'Use Veil Doubles and a fixed party to break the guarded supply path.', chapter3: 'fairies-3-alt' }] } },
  { id: 'campaign-dwarves', faction: 'dwarves', title: 'Water Below Deep Gate', commander: DWARF, cast: [{ name: 'Sena', role: 'Surveyor and keeper of Deep Gate' }, { name: 'Grave Warden', role: 'Occupier of the mine pump' }], introduction: 'Bryn prepares the quarry defenses and reclaims a flooded mine whose pump has become a fortress.', chapters: ['dwarves-1', 'dwarves-2', 'dwarves-3', 'dwarves-4'], choice: { prompt: 'Deep Gate is closed. How should Bryn reach the pump?', options: [{ id: 'surveyor', text: 'Escort Sena through the galleries', consequence: 'Protect a real moving surveyor through the flooded crossings.', chapter3: 'dwarves-3' }, { id: 'works', text: 'Scout the northern works', consequence: 'Avoid patrol cones and recover the pressure plans with Bryn.', chapter3: 'dwarves-3-alt' }] } },
  { id: 'campaign-undead', faction: 'undead', title: 'The Names That Remain', commander: UNDEAD, cast: [{ name: 'Iven', role: 'Last archivist of the burial ledgers' }, { name: 'Ash Judge', role: 'Author of the erased burial orders' }], introduction: 'Mara defends the mourners, restores the names of the fallen, and makes the commander who erased them face his own casualties.', chapters: ['undead-1', 'undead-2', 'undead-3', 'undead-4'], choice: { prompt: 'The watchbook reveals the captive archivist. What comes first?', options: [{ id: 'archivist', text: 'Bring Iven home', consequence: 'Escort the archivist through the drowned grove with room to raise fallen guards.', chapter3: 'undead-3' }, { id: 'burial', text: 'Free the burial bridge', consequence: 'Raise fresh mortal corpses to solve the fixed-army bridge engagement.', chapter3: 'undead-3-alt' }] } },
  { id: 'campaign-tideborn', faction: 'tideborn', title: 'The Harbor\'s Tide', commander: TIDE, cast: [{ name: 'Pell', role: 'Reef tender and keeper of the tide ledger' }, { name: 'Harbor Regent', role: 'Controller of the diverted tide' }], introduction: 'Neris follows the wet routes that customs troops cannot hold and returns the harbor tide to the villages.', chapters: ['tideborn-1', 'tideborn-2', 'tideborn-3', 'tideborn-4'], choice: { prompt: 'The causeway is open. What should Neris secure next?', options: [{ id: 'ledger', text: 'Recover the harbor ledger', consequence: 'Use wet flanks to infiltrate the archive and extract without two alarms.', chapter3: 'tideborn-3' }, { id: 'basin', text: 'Protect Pell\'s tidal basin', consequence: 'Defend the Coral Hold against finite attacks from two piers.', chapter3: 'tideborn-3-alt' }] } },
  { id: 'campaign-automata', faction: 'automata', title: 'An Independent Command', commander: MACHINE, cast: [{ name: 'Assembler M-2', role: 'Repair worker at the disconnected foundry' }, { name: 'Null Architect', role: 'Author of the expendable-unit command' }], introduction: 'K-7 follows a repair request that its old orders would discard and gives a damaged foundry an independent command link.', chapters: ['automata-1', 'automata-2', 'automata-3', 'automata-4'], choice: { prompt: 'The old command has been recovered. How should K-7 restore the foundry?', options: [{ id: 'foundry', text: 'Hold the foundry during reconnection', consequence: 'Use ward restoration and shield recharge through three finite waves.', chapter3: 'automata-3' }, { id: 'repair', text: 'Escort M-2 to the relay', consequence: 'Protect the assembler along the wet repair route and reconnect remotely.', chapter3: 'automata-3-alt' }] } },
];

export const CAMPAIGNS: Record<string, CampaignDefinition> = Object.fromEntries(campaigns.map(campaign => [campaign.id, campaign]));
export const getScenario = (id: string): ScenarioDefinition | undefined => SCENARIOS[id];
export const getCampaign = (id: string): CampaignDefinition | undefined => CAMPAIGNS[id];
export const campaignForFaction = (faction: FactionId): CampaignDefinition => CAMPAIGNS[`campaign-${faction}`];
export function campaignScenarios(id: string): ScenarioDefinition[] {
  const campaign = getCampaign(id);
  if (!campaign) return [];
  return [...campaign.chapters.slice(0, 3), campaign.choice.options[1].chapter3, campaign.chapters[3]].map(chapterId => SCENARIOS[chapterId]);
}
