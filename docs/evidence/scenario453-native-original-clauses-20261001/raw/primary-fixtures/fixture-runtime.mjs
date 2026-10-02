// scenario-browser-fixture-input.ts
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

// src/core/geometry.ts
function length2D(x, y) {
  return Math.sqrt(x * x + y * y);
}
var DIRECTIONS_32 = [
  [1, 0],
  [0.9807852804032304, 0.19509032201612825],
  [0.9238795325112867, 0.3826834323650898],
  [0.8314696123025452, 0.5555702330196022],
  [0.7071067811865476, 0.7071067811865476],
  [0.5555702330196022, 0.8314696123025452],
  [0.3826834323650898, 0.9238795325112867],
  [0.19509032201612825, 0.9807852804032304],
  [0, 1],
  [-0.19509032201612825, 0.9807852804032304],
  [-0.3826834323650898, 0.9238795325112867],
  [-0.5555702330196022, 0.8314696123025452],
  [-0.7071067811865476, 0.7071067811865476],
  [-0.8314696123025452, 0.5555702330196022],
  [-0.9238795325112867, 0.3826834323650898],
  [-0.9807852804032304, 0.19509032201612825],
  [-1, 0],
  [-0.9807852804032304, -0.19509032201612825],
  [-0.9238795325112867, -0.3826834323650898],
  [-0.8314696123025452, -0.5555702330196022],
  [-0.7071067811865476, -0.7071067811865476],
  [-0.5555702330196022, -0.8314696123025452],
  [-0.3826834323650898, -0.9238795325112867],
  [-0.19509032201612825, -0.9807852804032304],
  [0, -1],
  [0.19509032201612825, -0.9807852804032304],
  [0.3826834323650898, -0.9238795325112867],
  [0.5555702330196022, -0.8314696123025452],
  [0.7071067811865476, -0.7071067811865476],
  [0.8314696123025452, -0.5555702330196022],
  [0.9238795325112867, -0.3826834323650898],
  [0.9807852804032304, -0.19509032201612825]
];
var NEAREST_DIRECTION_INDICES_32 = [0, 1, 31, 2, 30, 3, 29, 4, 28, 5, 27, 6, 26, 7, 25, 8, 24, 9, 23, 10, 22, 11, 21, 12, 20, 13, 19, 14, 18, 15, 17, 16];
var DIRECTIONS_24 = [
  [1, 0],
  [0.9659258262890683, 0.25881904510252074],
  [0.8660254037844386, 0.5],
  [0.7071067811865476, 0.7071067811865476],
  [0.5, 0.8660254037844386],
  [0.25881904510252074, 0.9659258262890683],
  [0, 1],
  [-0.25881904510252074, 0.9659258262890683],
  [-0.5, 0.8660254037844386],
  [-0.7071067811865476, 0.7071067811865476],
  [-0.8660254037844386, 0.5],
  [-0.9659258262890683, 0.25881904510252074],
  [-1, 0],
  [-0.9659258262890683, -0.25881904510252074],
  [-0.8660254037844386, -0.5],
  [-0.7071067811865476, -0.7071067811865476],
  [-0.5, -0.8660254037844386],
  [-0.25881904510252074, -0.9659258262890683],
  [0, -1],
  [0.25881904510252074, -0.9659258262890683],
  [0.5, -0.8660254037844386],
  [0.7071067811865476, -0.7071067811865476],
  [0.8660254037844386, -0.5],
  [0.9659258262890683, -0.25881904510252074]
];
function facing8(x, y) {
  if (y === 0) return x < 0 ? 4 : 0;
  if (x === 0) return y < 0 ? 6 : 2;
  let ax = Math.abs(x), ay = Math.abs(y);
  const scale = Math.max(ax, ay), boundary = 0.41421356237309503;
  if (scale < 22250738585072014e-324) {
    ax /= scale;
    ay /= scale;
  }
  if (x >= 0 && y >= 0) return ay < ax * boundary ? 0 : ax <= ay * boundary ? 2 : 1;
  if (x < 0 && y >= 0) return ay <= ax * boundary ? 4 : ax < ay * boundary ? 2 : 3;
  if (x < 0 && y < 0) return ay < ax * boundary ? 4 : ax <= ay * boundary ? 6 : 5;
  return ay <= ax * boundary ? 0 : ax < ay * boundary ? 6 : 7;
}
var MATCH_START_DIRECTIONS = {
  3: [[-0.7071067811865476, -0.7071067811865476], [0.9659258262890683, -0.25881904510252074], [-0.25881904510252074, 0.9659258262890683]],
  4: [[-0.7071067811865476, -0.7071067811865476], [0.7071067811865476, -0.7071067811865476], [0.7071067811865476, 0.7071067811865476], [-0.7071067811865476, 0.7071067811865476]],
  5: [[-0.7071067811865476, -0.7071067811865476], [0.45399049973954686, -0.8910065241883678], [0.9876883405951378, 0.15643446504023087], [0.15643446504023087, 0.9876883405951378], [-0.8910065241883678, 0.45399049973954686]],
  6: [[-0.7071067811865476, -0.7071067811865476], [0.25881904510252074, -0.9659258262890683], [0.9659258262890683, -0.25881904510252074], [0.7071067811865476, 0.7071067811865476], [-0.25881904510252074, 0.9659258262890683], [-0.9659258262890683, 0.25881904510252074]],
  7: [[-0.7071067811865476, -0.7071067811865476], [0.11196447610330791, -0.9937122098932426], [0.8467241992282842, -0.5320320765153366], [0.9438833303083676, 0.33027906195516704], [0.33027906195516704, 0.9438833303083676], [-0.5320320765153366, 0.8467241992282842], [-0.9937122098932426, 0.11196447610330791]],
  8: [[-0.7071067811865476, -0.7071067811865476], [0, -1], [0.7071067811865476, -0.7071067811865476], [1, 0], [0.7071067811865476, 0.7071067811865476], [0, 1], [-0.7071067811865476, 0.7071067811865476], [-1, 0]]
};

// src/scenarios/campaigns.ts
var zero = { wood: 0, ore: 0, crystal: 0 };
var at = (actor3, x, y, radius2 = 2) => ({ type: "at", actor: actor3, point: { x, y }, radius: radius2 });
var value = (key, amount = 1) => ({ type: "variable", key, op: "gte", value: amount });
var alive = (actor3) => ({ type: "alive", actor: actor3 });
var dead = (actor3) => ({ type: "dead", actor: actor3 });
var all = (...conditions) => ({ type: "all", conditions });
var any = (...conditions) => ({ type: "any", conditions });
var time = (seconds) => ({ type: "time", seconds });
var unit = (label, role, x, y, side2 = 0, hp) => ({ label, side: side2, kind: "unit", role, x, y, ...hp === void 0 ? {} : { hp } });
var commander = (faction, x, y) => ({ ...unit("commander", "special", x, y), definitionId: `core:${faction}-commander` });
var foe = (label, role, x, y, target, hp) => ({ ...unit(label, role, x, y, 1, hp), order: { type: "attackMove", ...target } });
var building = (label, role, x, y, side2 = 0) => ({ label, side: side2, kind: "building", role, x, y });
var speech = (id5, when, speaker, text3) => ({ id: id5, when, actions: [{ type: "message", speaker, text: text3 }] });
var road = (...points) => points.map(([x, y]) => ({ x, y }));
function authoredMap(ground, actors) {
  const width = 36, height = 36;
  const terrain2 = Array(width * height).fill("grass");
  const paint = (x, y, kind) => {
    if (x > 0 && y > 0 && x < width - 1 && y < height - 1) terrain2[y * width + x] = kind;
  };
  for (const [kind, left, top, right, bottom] of ground.plots) {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) paint(x, y, kind);
  }
  for (const path of ground.paths) for (let segment = 1; segment < path.length; segment++) {
    const a = path[segment - 1], b = path[segment], steps = Math.ceil(length2D(b.x - a.x, b.y - a.y) * 3);
    for (let i = 0; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * i / Math.max(1, steps), y = a.y + (b.y - a.y) * i / Math.max(1, steps);
      for (let row = Math.floor(y - 1.35); row <= Math.ceil(y + 1.35); row++) for (let col = Math.floor(x - 1.35); col <= Math.ceil(x + 1.35); col++) {
        if (length2D(col + 0.5 - x, row + 0.5 - y) <= 1.35) {
          const old = terrain2[row * width + col];
          paint(col, row, old === "water" || old === "shallows" || old === "bridge" ? "bridge" : "road");
        }
      }
    }
  }
  for (const actor3 of actors) {
    const radius2 = actor3.kind === "building" ? 2.4 : 0.8;
    for (let y = Math.floor(actor3.y - radius2); y <= Math.ceil(actor3.y + radius2); y++) for (let x = Math.floor(actor3.x - radius2); x <= Math.ceil(actor3.x + radius2); x++) {
      if (length2D(x + 0.5 - actor3.x, y + 0.5 - actor3.y) <= radius2) paint(x, y, "grass");
    }
  }
  for (let i = 0; i < width; i++) {
    terrain2[i] = terrain2[(height - 1) * width + i] = terrain2[i * width] = terrain2[i * width + width - 1] = "rock";
  }
  return { size: "small", width, height, terrain: terrain2, starts: [{ x: 6, y: 28 }, { x: 29, y: 7 }], resources: [] };
}
function chapter(info, objectives, events, timeLimit = 240) {
  const spawnActors2 = events.flatMap((event) => event.actions.flatMap((action2) => action2.type === "spawn" ? action2.actors : []));
  return {
    schemaVersion: 1,
    id: info.id,
    title: info.title,
    briefing: info.briefing,
    successText: info.success,
    failureText: info.failure,
    faction: info.faction,
    opponent: info.opponent,
    seed: info.seed,
    map: authoredMap(info.ground, [...info.army, ...spawnActors2]),
    army: info.army,
    objectives,
    events: [speech("briefing", time(0), info.commander, info.briefing), ...events],
    rules: { fixedArmy: true, reinforcementBudget: 0, resources: { ...zero }, timeLimit }
  };
}
function escort(info, route2, ambushes) {
  const convoy = info.army.find((actor3) => actor3.label === "convoy");
  const events = ambushes.map((ambush, index2) => ({
    id: `ambush-${index2 + 1}`,
    when: value("escort.checkpoints", ambush.checkpoint),
    actions: [{ type: "spawn", actors: ambush.actors }, { type: "message", speaker: ambush.speaker, text: ambush.text }]
  }));
  const mission = chapter(info, [
    { id: "arrival", text: `Escort ${convoy.label} through all ${route2.length} checkpoints. Keep troops within seven tiles so the convoy advances.`, success: value("escort.checkpoints", route2.length), failure: dead("convoy") },
    { id: "commander", text: `Keep ${info.commander} alive until the convoy arrives.`, success: all(value("escort.checkpoints", route2.length), alive("commander")), failure: dead("commander") }
  ], events);
  mission.escort = { actor: "convoy", route: route2, radius: 1.5, escortRadius: 7 };
  return mission;
}
function defense(info, seconds, waves, budget) {
  const events = waves.map((wave, index2) => ({ id: `wave-${index2 + 1}`, when: time(wave.seconds), actions: [{ type: "spawn", actors: wave.actors }, { type: "message", speaker: info.commander, text: wave.text }] }));
  const mission = chapter(info, [
    { id: "fortress", text: `Hold the fortress for ${seconds} seconds. The reinforcement allowance is ${budget}; the listed waves are finite.`, success: all(time(seconds), alive("fortress")), failure: dead("fortress") },
    { id: "commander", text: `Keep ${info.commander} alive during the defense.`, success: all(time(seconds), alive("commander")), failure: dead("commander") }
  ], events, seconds + 90);
  mission.rules = { fixedArmy: false, reinforcementBudget: budget, resources: { wood: 220, ore: 100, crystal: 20 }, timeLimit: seconds + 90 };
  return mission;
}
function stealth(info, destination, extraction, guards, patrols) {
  const fail2 = any(dead("commander"), value("stealth.alarms", 2));
  const mission = chapter(info, [
    { id: "recover", text: `Reach the marked archive at (${destination.x}, ${destination.y}) without two alarms.`, success: value("archive.recovered"), failure: fail2 },
    { id: "extract", text: `Return ${info.commander} to (${extraction.x}, ${extraction.y}) with the archive. Move around guard sight cones; fighting is optional.`, success: all(value("archive.recovered"), at("commander", extraction.x, extraction.y)), failure: fail2 }
  ], [
    { id: "archive", when: at("commander", destination.x, destination.y), actions: [{ type: "set", key: "archive.recovered", value: 1 }, { type: "message", speaker: info.commander, text: "The archive is secure. Take the unguarded route back to the extraction point." }] },
    { id: "first-alarm", when: value("stealth.alarms"), actions: [{ type: "message", speaker: info.commander, text: "One alarm. Break contact before another patrol identifies us." }] }
  ]);
  mission.stealth = { infiltrators: ["commander", ...info.army.filter((actor3) => actor3.side === 0 && actor3.label === "weaver").map((actor3) => actor3.label)], guards, alarmLimit: 2, detectionSeconds: 1.5, radius: 5, coneDegrees: 80, patrols };
  return mission;
}
function puzzle(info, objective, success, failure, events = []) {
  return chapter(info, [
    { id: "solution", text: objective, success, failure },
    { id: "commander", text: `Keep ${info.commander} alive. The army and zero-resource budget are fixed; reset restores this starting position.`, success: all(success, alive("commander")), failure: dead("commander") }
  ], events, 180);
}
function finale(info, boss) {
  const mission = chapter(info, [
    { id: "boss", text: `Defeat ${boss.name}. Survive all three phases and move out of a warning circle or interrupt it with concentrated fire.`, success: all(value("boss.defeated"), value("boss.phases", 3)), failure: dead("commander") },
    { id: "response", text: "Dodge or interrupt at least one telegraphed attack.", success: any(value("boss.dodged"), value("boss.interrupts")), failure: dead("commander") },
    { id: "commander", text: `Keep ${info.commander} alive.`, success: all(value("boss.defeated"), alive("commander")), failure: dead("commander") }
  ], [speech("engage", at("commander", boss.location.x, boss.location.y, 10), info.commander, `${boss.name} is in range. ${boss.mechanic}`)], 300);
  mission.boss = {
    actor: "boss",
    name: boss.name,
    health: boss.health,
    phases: boss.phaseNames.map((name, index2) => ({ below: [1, 0.68, 0.34][index2], name, radius: boss.radii[index2], damage: boss.damage + index2 * 5, warningSeconds: 4, cooldown: 8, interruptDamage: 120, adds: boss.adds[index2] }))
  };
  mission.map = authoredMap(info.ground, [...info.army, ...boss.adds.flat()]);
  const ability = { orcs: "momentum", fairies: "illusion", dwarves: "entrench", undead: "raise", tideborn: "surge", automata: "ward" }[info.faction];
  mission.requiredActions = [{ action: "ability", ability, count: 1, text: boss.mechanic }];
  return mission;
}
var ORC = "Rakka Ironjaw";
var FAIRY = "Liora Ashwing";
var DWARF = "Bryn Deepforge";
var UNDEAD = "Mara Ashkeeper";
var TIDE = "Neris Shellsong";
var MACHINE = "Unit K-7";
var missions = [
  escort({
    id: "orcs-1",
    title: "The Foundry Road",
    faction: "orcs",
    opponent: "dwarves",
    commander: ORC,
    seed: 7101,
    briefing: "Rakka leads a forge crew through the abandoned quarry. Stay beside foreman Torg, clear the two ambushes, and bring him to the eastern workshop.",
    success: "Torg reaches the workshop and restores its furnaces. Rakka can shelter the valley refugees behind the new iron gates.",
    failure: "The forge crew is lost in the quarry. Rakka must return to the road with the same escort.",
    ground: { plots: [["rock", 12, 4, 15, 18], ["rock", 23, 21, 27, 30], ["mud", 15, 23, 22, 29]], paths: [road([7, 28], [17, 28], [23, 18], [29, 8])] },
    army: [commander("orcs", 6, 26), unit("convoy", "worker", 7, 28), unit("guard-a", "melee", 9, 26), unit("guard-b", "melee", 9, 29), unit("bolt-a", "ranged", 5, 29), unit("bolt-b", "ranged", 5, 27)]
  }, road([16, 28], [23, 18], [29, 8]), [
    { checkpoint: 1, actors: [foe("quarry-a", "melee", 21, 27, { x: 16, y: 28 }, 85), foe("quarry-b", "ranged", 22, 30, { x: 16, y: 28 }, 55)], speaker: "Torg", text: "The quarry watch has seen us. Clear the road before I pass the bend." },
    { checkpoint: 2, actors: [foe("gate-a", "melee", 27, 14, { x: 23, y: 18 }, 95), foe("gate-b", "melee", 29, 17, { x: 23, y: 18 }, 95)], speaker: ORC, text: "Two guards at the workshop. Keep them away from Torg." }
  ]),
  defense({
    id: "orcs-2",
    title: "Refuge at Iron Gate",
    faction: "orcs",
    opponent: "undead",
    commander: ORC,
    seed: 7102,
    briefing: "Mara has followed the refugee column. Hold the Iron Hall for seventy seconds while Torg closes the shelter doors. Spend the repair timber carefully; only two replacement soldiers may join.",
    success: "The refugees survive. Rakka must choose whether to recover the toll bridge or search the enemy courier camp for a safer crossing.",
    failure: "The shelter falls before its doors close. The refugees need the Iron Hall intact.",
    ground: { plots: [["rock", 4, 17, 13, 19], ["rock", 21, 17, 31, 19], ["mud", 14, 12, 21, 16]], paths: [road([18, 8], [18, 23], [9, 28])] },
    army: [building("fortress", "hq", 9, 28), building("foundry", "barracks", 5, 25), building("watch", "tower", 17, 23), commander("orcs", 16, 25), unit("line-a", "melee", 17, 22), unit("line-b", "melee", 20, 22), unit("bolt-a", "ranged", 16, 26), unit("bolt-b", "ranged", 20, 26), unit("torg", "worker", 10, 24)]
  }, 70, [
    { seconds: 10, actors: [foe("wave1-a", "melee", 18, 9, { x: 17, y: 23 }, 90), foe("wave1-b", "melee", 21, 9, { x: 17, y: 23 }, 90)], text: "Boneguards are coming through the quarry gap." },
    { seconds: 28, actors: [foe("wave2-a", "melee", 16, 9, { x: 17, y: 23 }), foe("wave2-b", "ranged", 20, 8, { x: 17, y: 23 }, 65)], text: "Their archers are behind the second rank. Push them away from the tower." },
    { seconds: 47, actors: [foe("wave3-a", "melee", 18, 10, { x: 9, y: 28 }), foe("wave3-b", "melee", 21, 11, { x: 9, y: 28 })], text: "This is the last wave. Torg needs twenty more seconds." }
  ], 2),
  puzzle({
    id: "orcs-3",
    title: "Break the Toll Line",
    faction: "orcs",
    opponent: "automata",
    commander: ORC,
    seed: 7103,
    briefing: "The toll keeper has pikes across the bridge and prism archers behind them. Your riders must use the southern ford while the Ironjaws pin the pikes. Destroy both marked archers with this army.",
    success: "The toll line breaks. The refugees can cross openly, and Rakka confronts the keeper in his forge court.",
    failure: "The riders are trapped at the pikes. Reset the engagement and send them around the wet southern route.",
    ground: { plots: [["water", 17, 4, 19, 30], ["shallows", 15, 24, 21, 30], ["rock", 22, 5, 27, 12]], paths: [road([7, 17], [29, 17]), road([7, 23], [16, 28], [24, 28], [29, 21])] },
    army: [commander("orcs", 9, 16), unit("iron-a", "melee", 10, 19), unit("iron-b", "melee", 10, 21), unit("rider-a", "cavalry", 7, 25), unit("rider-b", "cavalry", 10, 26), { ...unit("pike-a", "spear", 22, 16, 1), order: { type: "hold" } }, { ...unit("pike-b", "spear", 23, 19, 1), order: { type: "hold" } }, { ...unit("archer-a", "ranged", 28, 16, 1), order: { type: "hold" } }, { ...unit("archer-b", "ranged", 29, 20, 1), order: { type: "hold" } }]
  }, "Destroy the two marked prism archers. Keep at least one rider alive.", all(dead("archer-a"), dead("archer-b")), all(dead("rider-a"), dead("rider-b"))),
  stealth({
    id: "orcs-3-alt",
    title: "The Courier Camp",
    faction: "orcs",
    opponent: "automata",
    commander: ORC,
    seed: 7133,
    briefing: "Rakka chooses a hidden crossing. Move through the western ravine, take the courier orders at the northern archive, and return to Torg. Two alarms close the route.",
    success: "The orders reveal a service entrance into the keeper's court. The refugees cross unseen while Rakka approaches from the ravine.",
    failure: "The courier patrol identifies Rakka twice. The service entrance is sealed until the raid is reset.",
    ground: { plots: [["rock", 12, 11, 17, 26], ["rock", 25, 11, 29, 25], ["mud", 6, 14, 10, 23]], paths: [road([7, 29], [6, 7], [22, 6]), road([20, 13], [20, 26], [30, 29])] },
    army: [commander("orcs", 7, 29), unit("torg", "worker", 5, 29), unit("patrol-a", "melee", 20, 17, 1), unit("patrol-b", "ranged", 27, 28, 1)]
  }, { x: 22, y: 6 }, { x: 7, y: 29 }, ["patrol-a", "patrol-b"], [{ actor: "patrol-a", route: road([20, 13], [20, 25]) }, { actor: "patrol-b", route: road([24, 29], [31, 29]) }]),
  finale({
    id: "orcs-4",
    title: "The Keeper's Furnace",
    faction: "orcs",
    opponent: "automata",
    commander: ORC,
    seed: 7104,
    briefing: "The Brass Keeper waits among the furnace pits. Build Fury with the Ironjaws' War Cry. Rakka's Iron Command strengthens their attacks. Split the line when a heat circle appears and concentrate attacks to interrupt the keeper's charge.",
    success: "Rakka stops the furnace and frees the valley from the toll. Torg gives the workshop to the refugees rather than another keeper.",
    failure: "Rakka falls inside the furnace court. The keeper still controls the crossing.",
    ground: { plots: [["rock", 13, 8, 16, 12], ["rock", 23, 23, 27, 28], ["mud", 17, 20, 21, 24]], paths: [road([8, 28], [17, 17], [28, 10]), road([13, 17], [28, 21])] },
    army: [commander("orcs", 8, 25), unit("line-a", "melee", 10, 25), unit("line-b", "melee", 12, 26), unit("bolt-a", "ranged", 7, 28), unit("bolt-b", "ranged", 10, 29), { ...unit("boss", "special", 26, 11, 1), order: { type: "hold" } }]
  }, { name: "Brass Keeper", health: 1400, location: { x: 26, y: 11 }, phaseNames: ["Furnace breath", "Molten ring", "Overpressure"], radii: [3, 4, 5], damage: 28, adds: [[], [foe("keeper-a", "melee", 28, 16, { x: 18, y: 18 }, 65)], [foe("keeper-b", "ranged", 30, 10, { x: 18, y: 18 }, 45)]], mechanic: "Use War Cry to build Fury at least once during the fight." }),
  stealth({
    id: "fairies-1",
    title: "Under the Watchers",
    faction: "fairies",
    opponent: "orcs",
    commander: FAIRY,
    seed: 7201,
    briefing: "Liora searches the watcher archive for the missing grove wards. Patrols face along their routes. Walk behind them, collect the ward record, and return to the southern glade; Veil Doubles can draw a watcher away.",
    success: "The record names a living seed in the eastern grove. Liora sends Oren to retrieve it before the watch burns the forest.",
    failure: "The watchers raise a second alarm or catch Liora. Begin again from the southern glade.",
    ground: { plots: [["rock", 11, 12, 15, 27], ["rock", 23, 13, 27, 25], ["mud", 6, 15, 9, 24]], paths: [road([6, 29], [6, 7], [28, 7]), road([18, 11], [18, 27]), road([29, 14], [29, 27])] },
    army: [commander("fairies", 6, 29), unit("weaver", "special", 5, 28), unit("oren", "worker", 4, 29), unit("watcher-a", "melee", 18, 15, 1), unit("watcher-b", "ranged", 29, 22, 1)]
  }, { x: 28, y: 7 }, { x: 6, y: 29 }, ["watcher-a", "watcher-b"], [{ actor: "watcher-a", route: road([18, 11], [18, 27]) }, { actor: "watcher-b", route: road([29, 14], [29, 27]) }]),
  escort({
    id: "fairies-2",
    title: "The Living Seed",
    faction: "fairies",
    opponent: "orcs",
    commander: FAIRY,
    seed: 7202,
    briefing: "Tender Oren must return from the eastern nursery to the Elderheart. Escort him around the burned ridge. Keep the Mothbows behind Thornblades when the watcher groups arrive.",
    success: "Oren returns with the seed. Liora chooses whether to defend the old grove or use its roots to open the watcher stockade.",
    failure: "Oren or Liora is lost on the burned road. The seed never reaches the Elderheart.",
    ground: { plots: [["rock", 15, 9, 23, 18], ["mud", 12, 20, 23, 25], ["water", 27, 23, 30, 30]], paths: [road([29, 8], [28, 20], [15, 28], [6, 27])] },
    army: [commander("fairies", 28, 6), unit("convoy", "worker", 29, 8), unit("thorn-a", "melee", 27, 9), unit("thorn-b", "melee", 30, 10), unit("moth-a", "ranged", 31, 6), unit("moth-b", "ranged", 31, 8)]
  }, road([28, 20], [15, 28], [6, 27]), [
    { checkpoint: 1, actors: [foe("burner-a", "melee", 25, 23, { x: 28, y: 20 }, 85), foe("burner-b", "ranged", 30, 23, { x: 28, y: 20 }, 55)], speaker: "Oren", text: "The watchers are waiting at the southern bend. I will stay behind the Thornblades." },
    { checkpoint: 2, actors: [foe("burner-c", "melee", 12, 25, { x: 15, y: 28 }, 95), foe("burner-d", "melee", 10, 30, { x: 15, y: 28 }, 95)], speaker: FAIRY, text: "The last patrol blocks the glade. Draw it away from Oren." }
  ]),
  defense({
    id: "fairies-3",
    title: "Roots at the Boundary",
    faction: "fairies",
    opponent: "dwarves",
    commander: FAIRY,
    seed: 7203,
    briefing: "Liora stays to defend the old grove. The Moonwell heals nearby troops between attacks. Hold the Elderheart for eighty seconds, reposition the Mothbows, and use doubles to absorb cannon attention.",
    success: "The grove survives and its roots reveal the tunnel under the watch. Liora follows them to the commander who ordered the burning.",
    failure: "The Elderheart or Liora falls before the roots reach the tunnel. The defense must begin again.",
    ground: { plots: [["rock", 11, 6, 14, 23], ["rock", 23, 14, 28, 27], ["mud", 15, 10, 22, 17]], paths: [road([18, 6], [18, 23], [8, 29]), road([29, 9], [20, 22])] },
    army: [building("fortress", "hq", 8, 29), building("moonwell", "depot", 15, 27), building("bloomspire", "barracks", 5, 25), commander("fairies", 17, 25), unit("weaver", "special", 16, 27), unit("thorn-a", "melee", 17, 21), unit("thorn-b", "melee", 20, 23), unit("moth-a", "ranged", 14, 24), unit("moth-b", "ranged", 19, 27), unit("oren", "worker", 10, 25)]
  }, 80, [
    { seconds: 12, actors: [foe("root-wave1-a", "melee", 18, 7, { x: 17, y: 23 }, 105), foe("root-wave1-b", "ranged", 21, 7, { x: 17, y: 23 }, 60)], text: "The first engineers have entered the grove." },
    { seconds: 32, actors: [foe("root-wave2-a", "special", 28, 9, { x: 17, y: 23 }, 85), foe("root-wave2-b", "melee", 26, 11, { x: 17, y: 23 }, 95)], text: "A cannon is coming along the eastern path. Let doubles take its first shot." },
    { seconds: 55, actors: [foe("root-wave3-a", "melee", 17, 8, { x: 8, y: 29 }, 115), foe("root-wave3-b", "ranged", 21, 8, { x: 8, y: 29 }, 65)], text: "The roots are nearly through. Hold the Moonwell clearing." }
  ], 2),
  puzzle({
    id: "fairies-3-alt",
    title: "A Door of Briars",
    faction: "fairies",
    opponent: "dwarves",
    commander: FAIRY,
    seed: 7233,
    briefing: "Liora attacks the stockade while the grove evacuates. Two Thunderlocks cover the central path. Use doubles to draw their volleys, keep Thornblades alive, and destroy both guns with the fixed party.",
    success: "The stockade opens without a siege. The grove families escape, and Liora reaches the burning commander from his own supply path.",
    failure: "Liora or every Thornblade is lost at the stockade. Reset and send the doubles before the living troops.",
    ground: { plots: [["rock", 15, 4, 18, 13], ["rock", 15, 23, 18, 31], ["mud", 20, 13, 25, 22]], paths: [road([7, 18], [29, 18]), road([7, 26], [21, 29], [29, 22])] },
    army: [commander("fairies", 7, 18), unit("weaver", "special", 8, 21), unit("thorn-a", "melee", 10, 16), unit("thorn-b", "melee", 10, 22), unit("moth", "ranged", 6, 21), { ...unit("gun-a", "ranged", 25, 16, 1), order: { type: "hold" } }, { ...unit("gun-b", "ranged", 28, 21, 1), order: { type: "hold" } }]
  }, "Destroy both marked guns after conjuring at least one set of Veil Doubles.", all(dead("gun-a"), dead("gun-b"), value("action.ability.illusion")), all(dead("thorn-a"), dead("thorn-b"))),
  finale({
    id: "fairies-4",
    title: "The Ash Marshal",
    faction: "fairies",
    opponent: "orcs",
    commander: FAIRY,
    seed: 7204,
    briefing: "Marshal Brakka has trapped the grove wards in an ash clearing. Conjure the Veilweaver's doubles to divide his attacks, leave the warning circles, and bring down the marshal before he burns the final ward.",
    success: "The wards return to the living seed. Liora lets the forest reclaim the watch road, and Oren plants a new grove at its gate.",
    failure: "Liora falls and Brakka keeps the captured wards. Begin the final assault again.",
    ground: { plots: [["rock", 10, 12, 14, 18], ["rock", 23, 6, 27, 11], ["mud", 16, 17, 22, 23]], paths: [road([7, 29], [16, 26], [27, 17]), road([8, 21], [18, 10], [28, 17])] },
    army: [commander("fairies", 7, 27), unit("weaver", "special", 9, 29), unit("thorn-a", "melee", 11, 26), unit("thorn-b", "melee", 13, 27), unit("moth-a", "ranged", 6, 30), unit("moth-b", "ranged", 10, 31), { ...unit("boss", "special", 27, 17, 1), order: { type: "hold" } }]
  }, { name: "Marshal Brakka", health: 1500, location: { x: 27, y: 17 }, phaseNames: ["Cinder sweep", "Ash circles", "Burning oath"], radii: [3, 4, 4.5], damage: 25, adds: [[], [foe("marshal-a", "melee", 30, 20, { x: 23, y: 20 }, 60)], [foe("marshal-b", "ranged", 30, 13, { x: 23, y: 20 }, 45)]], mechanic: "Conjure Veil Doubles at least once during the fight." }),
  puzzle({
    id: "dwarves-1",
    title: "The Long Shot",
    faction: "dwarves",
    opponent: "orcs",
    commander: DWARF,
    seed: 7301,
    briefing: "A wounded Ironjaw commander guards the quarry. Defeat him with Bryn and the escort while the cannon waits, then recover and equip his dropped artifact. Emplace the cannon on the western firing shelf to outrange and destroy the marked tower.",
    success: "Bryn recovers the Ironjaw commander's artifact and the tower falls from the prepared shelf. The quarry workers reach the Mountain Keep before the warband returns.",
    failure: "Bryn or the cannon is lost. Reset and prepare the firing position before engaging the tower.",
    ground: { plots: [["rock", 17, 4, 21, 13], ["rock", 17, 23, 21, 31], ["mud", 14, 14, 18, 22]], paths: [road([6, 18], [29, 18]), road([10, 26], [26, 26], [29, 18])] },
    army: [commander("dwarves", 8, 17), unit("cannon", "special", 6, 20), unit("shield", "melee", 10, 21), unit("gun-a", "ranged", 7, 23), unit("gun-b", "ranged", 11, 24), building("target-tower", "tower", 28, 18, 1), { ...unit("raider", "special", 25, 24, 1, 100), definitionId: "core:orcs-commander", order: { type: "hold" } }]
  }, "Defeat the wounded commander, recover and equip his artifact, then emplace the cannon and destroy the quarry tower. Keep the cannon alive.", all(dead("raider"), value("equipment.commander"), dead("target-tower"), value("action.ability.entrench")), dead("cannon")),
  defense({
    id: "dwarves-2",
    title: "Seventy Seconds at Deep Gate",
    faction: "dwarves",
    opponent: "orcs",
    commander: DWARF,
    seed: 7302,
    briefing: "The quarry crew is inside. Emplace Bryn's line at the narrow Deep Gate and hold the Mountain Keep for seventy-five seconds. Sena has repair timber and a two-soldier reserve.",
    success: "Sena closes the Deep Gate. Bryn can escort the surveyor through the mines or scout the warband's northern works.",
    failure: "The Mountain Keep or Bryn falls while the gate is open. Reset the defensive line.",
    ground: { plots: [["rock", 3, 17, 14, 20], ["rock", 22, 17, 32, 20], ["mud", 15, 8, 21, 13]], paths: [road([18, 6], [18, 29]), road([8, 28], [18, 26])] },
    army: [building("fortress", "hq", 9, 29), building("gunsmith", "barracks", 5, 25), building("bastion", "tower", 17, 24), commander("dwarves", 17, 22), unit("shield", "melee", 20, 22), unit("cannon", "special", 16, 28), unit("gun-a", "ranged", 16, 26), unit("gun-b", "ranged", 21, 26), unit("sena", "worker", 10, 25)]
  }, 75, [
    { seconds: 10, actors: [foe("gate-wave1-a", "melee", 16, 7, { x: 18, y: 24 }, 100), foe("gate-wave1-b", "melee", 20, 7, { x: 18, y: 24 }, 100)], text: "The first Ironjaws are in the gate road. Prepare the firing line." },
    { seconds: 30, actors: [foe("gate-wave2-a", "ranged", 17, 8, { x: 18, y: 24 }, 65), foe("gate-wave2-b", "special", 21, 8, { x: 18, y: 24 }, 120)], text: "A Wardrum is screening their crossbows. Keep the cannon behind the shields." },
    { seconds: 53, actors: [foe("gate-wave3-a", "melee", 16, 9, { x: 9, y: 29 }, 125), foe("gate-wave3-b", "melee", 20, 9, { x: 9, y: 29 }, 125)], text: "The final wave is here. Sena is lowering the gate." }
  ], 2),
  escort({
    id: "dwarves-3",
    title: "The Surveyor's Passage",
    faction: "dwarves",
    opponent: "undead",
    commander: DWARF,
    seed: 7303,
    briefing: "Surveyor Sena knows the route to the stolen pump. Escort her around the flooded galleries. Pack up emplacement before moving, then prepare again when the dead emerge at each crossing.",
    success: "Sena marks the dry route to the pump chamber. Bryn can confront the Grave Warden without crossing its flooded gun line.",
    failure: "Sena or Bryn is lost in the galleries. Reset and move the escort with the surveyor.",
    ground: { plots: [["water", 12, 4, 16, 23], ["water", 23, 14, 28, 31], ["shallows", 17, 18, 22, 26]], paths: [road([7, 29], [18, 29], [19, 12], [29, 7])] },
    army: [commander("dwarves", 6, 27), unit("convoy", "worker", 7, 29), unit("shield", "melee", 10, 29), unit("cannon", "special", 4, 28), unit("gun-a", "ranged", 5, 31), unit("gun-b", "ranged", 9, 31)]
  }, road([18, 29], [19, 12], [29, 7]), [
    { checkpoint: 1, actors: [foe("gallery-a", "melee", 20, 25, { x: 18, y: 29 }, 85), foe("gallery-b", "ranged", 17, 24, { x: 18, y: 29 }, 55)], speaker: "Sena", text: "Boneguards in the lower gallery. Set the guns while I wait behind your line." },
    { checkpoint: 2, actors: [foe("gallery-c", "melee", 24, 10, { x: 19, y: 12 }, 95), foe("gallery-d", "melee", 25, 14, { x: 19, y: 12 }, 95)], speaker: DWARF, text: "The pump guards have reached the upper crossing. Hold them here." }
  ]),
  stealth({
    id: "dwarves-3-alt",
    title: "The Northern Works",
    faction: "dwarves",
    opponent: "undead",
    commander: DWARF,
    seed: 7333,
    briefing: "Bryn scouts the northern works alone while Sena holds Deep Gate. Take the pump plans at the east archive and return through the high western passage. Two detections bring down the tunnel shutters.",
    success: "The plans identify the Warden's pressure chambers. Bryn takes the northern maintenance path into the final battle.",
    failure: "Bryn raises a second alarm or falls in the works. Begin again outside the tunnel shutters.",
    ground: { plots: [["rock", 11, 10, 16, 26], ["rock", 23, 12, 27, 27], ["water", 18, 19, 21, 29]], paths: [road([6, 29], [6, 6], [29, 6]), road([20, 9], [20, 17]), road([29, 14], [29, 29])] },
    army: [commander("dwarves", 6, 29), unit("sena", "worker", 4, 29), unit("sentry-a", "melee", 20, 12, 1), unit("sentry-b", "ranged", 29, 22, 1)]
  }, { x: 29, y: 6 }, { x: 6, y: 29 }, ["sentry-a", "sentry-b"], [{ actor: "sentry-a", route: road([20, 9], [20, 17]) }, { actor: "sentry-b", route: road([29, 14], [29, 29]) }]),
  finale({
    id: "dwarves-4",
    title: "The Grave Warden's Pump",
    faction: "dwarves",
    opponent: "undead",
    commander: DWARF,
    seed: 7304,
    briefing: "The Grave Warden has occupied the pump chamber. Emplace Bryn's troops on dry ground, interrupt pressure bursts with the cannons, and pack up when a warning circle covers the firing shelf.",
    success: "The pump runs again and the mines drain. Bryn leaves Sena in charge of the works, with a firing shelf prepared at every entrance.",
    failure: "Bryn falls before the pump is recovered. The mines remain flooded under the Warden.",
    ground: { plots: [["water", 13, 7, 17, 14], ["water", 23, 23, 28, 29], ["shallows", 15, 17, 24, 22]], paths: [road([7, 28], [15, 25], [26, 15]), road([9, 19], [21, 10], [26, 15])] },
    army: [commander("dwarves", 8, 25), unit("shield", "melee", 11, 26), unit("cannon-a", "special", 6, 28), unit("cannon-b", "special", 9, 29), unit("gun", "ranged", 12, 29), { ...unit("boss", "special", 26, 15, 1), order: { type: "hold" } }]
  }, { name: "Grave Warden", health: 1600, location: { x: 26, y: 15 }, phaseNames: ["Pressure leak", "Flood pulse", "Broken seals"], radii: [3, 4, 5], damage: 27, adds: [[], [foe("warden-a", "melee", 29, 18, { x: 22, y: 20 }, 65)], [foe("warden-b", "melee", 27, 10, { x: 22, y: 20 }, 65)]], mechanic: "Emplace a unit at least once during the fight; movement packs it up." }),
  defense({
    id: "undead-1",
    title: "A Vigil for the Fallen",
    faction: "undead",
    opponent: "orcs",
    commander: UNDEAD,
    seed: 7401,
    briefing: "Mara guards the burial gate until the mourners leave. Keep Gravecallers behind the Boneguards, where fresh mortal corpses can be raised. Hold the Necropolis for sixty-five seconds with at most one replacement soldier.",
    success: "The mourners leave safely. Iven reports that the warband is removing names from the burial ledgers, and Mara follows its patrol.",
    failure: "Mara or the Necropolis falls while the mourners remain inside. The vigil must begin again.",
    ground: { plots: [["rock", 5, 14, 12, 22], ["rock", 25, 17, 31, 24], ["mud", 14, 9, 24, 15]], paths: [road([19, 6], [19, 25], [9, 29])] },
    army: [building("fortress", "hq", 9, 29), building("crypt", "barracks", 5, 26), commander("undead", 18, 25), unit("gravecaller", "special", 19, 26), unit("bone-a", "melee", 17, 22), unit("bone-b", "melee", 21, 22), unit("bone-c", "melee", 23, 25), unit("bow-a", "ranged", 17, 28), unit("bow-b", "ranged", 22, 28), unit("iven", "worker", 10, 25)]
  }, 65, [
    { seconds: 9, actors: [foe("vigil-wave1-a", "melee", 17, 8, { x: 19, y: 24 }, 75), foe("vigil-wave1-b", "melee", 22, 8, { x: 19, y: 24 }, 75)], text: "The first attackers reach the burial road. Keep their fallen within the Gravecaller's sight." },
    { seconds: 26, actors: [foe("vigil-wave2-a", "melee", 18, 8, { x: 19, y: 24 }, 95), foe("vigil-wave2-b", "ranged", 22, 9, { x: 19, y: 24 }, 55)], text: "Their crossbows are approaching. Raised troops can screen the living mourners." },
    { seconds: 44, actors: [foe("vigil-wave3-a", "special", 19, 9, { x: 9, y: 29 }, 110)], text: "One Wardrum remains. The last mourners are leaving." }
  ], 1),
  stealth({
    id: "undead-2",
    title: "Names in the Watchbook",
    faction: "undead",
    opponent: "orcs",
    commander: UNDEAD,
    seed: 7402,
    briefing: "Mara enters the patrol camp with Iven waiting outside. Recover the erased burial list from the eastern watchbook and return without two alarms. Move rather than attack through the high northern path.",
    success: "The watchbook names the captive archivist. Mara chooses whether to escort the archivist out or break the guard formation at the burial bridge.",
    failure: "The patrol catches Mara or raises a second alarm. The watchbook raid must begin again.",
    ground: { plots: [["rock", 10, 12, 15, 26], ["rock", 23, 13, 27, 26], ["mud", 16, 20, 22, 29]], paths: [road([6, 29], [6, 6], [30, 6]), road([19, 11], [19, 18]), road([30, 13], [30, 28])] },
    army: [commander("undead", 6, 29), unit("iven", "worker", 4, 29), unit("watch-a", "melee", 19, 14, 1), unit("watch-b", "ranged", 30, 22, 1)]
  }, { x: 30, y: 6 }, { x: 6, y: 29 }, ["watch-a", "watch-b"], [{ actor: "watch-a", route: road([19, 11], [19, 18]) }, { actor: "watch-b", route: road([30, 13], [30, 28]) }]),
  escort({
    id: "undead-3",
    title: "The Last Archivist",
    faction: "undead",
    opponent: "fairies",
    commander: UNDEAD,
    seed: 7403,
    briefing: "Archivist Iven walks home carrying the names in memory. Escort him around the drowned grove. Keep the mortal Boneguards between him and the guardians, and leave spare room in the Ossuary for raised troops.",
    success: "Iven returns and restores the burial ledgers. The names lead Mara to the Ash Judge who ordered them erased.",
    failure: "Iven or Mara is lost before the ledgers can be restored. Reset the escort from the drowned grove.",
    ground: { plots: [["water", 11, 13, 16, 28], ["mud", 18, 17, 24, 26], ["rock", 26, 8, 30, 17]], paths: [road([7, 29], [19, 29], [21, 12], [29, 6])] },
    army: [building("ossuary", "depot", 5, 24), commander("undead", 8, 26), unit("gravecaller", "special", 9, 29), unit("convoy", "worker", 7, 29), unit("bone-a", "melee", 10, 28), unit("bone-b", "melee", 10, 31), unit("bow-a", "ranged", 4, 28), unit("bow-b", "ranged", 5, 31)]
  }, road([19, 29], [21, 12], [29, 6]), [
    { checkpoint: 1, actors: [foe("grove-a", "melee", 22, 25, { x: 19, y: 29 }, 85), foe("grove-b", "ranged", 18, 24, { x: 19, y: 29 }, 50)], speaker: "Iven", text: "The grove guardians do not know who we are. Keep them away while I pass." },
    { checkpoint: 2, actors: [foe("grove-c", "melee", 23, 8, { x: 21, y: 12 }, 90), foe("grove-d", "melee", 26, 11, { x: 21, y: 12 }, 90)], speaker: UNDEAD, text: "The upper grove is guarded too. Iven, wait behind the Boneguards." }
  ]),
  puzzle({
    id: "undead-3-alt",
    title: "The Burial Bridge",
    faction: "undead",
    opponent: "orcs",
    commander: UNDEAD,
    seed: 7433,
    briefing: "Mara frees the burial bridge instead of following the archivist. Kill the two wounded gate guards near the Ossuary and have the Gravecaller raise their real corpses. Destroy the marked crossbow captain. The first corpses are close enough to use immediately.",
    success: "Raised guards turn on the captain and open the bridge. Mara follows the recovered names into the Ash Judge's court.",
    failure: "Mara falls before the bridge captain is defeated. Reset and raise the fresh gate-guard corpses before they expire.",
    ground: { plots: [["water", 17, 4, 20, 31], ["shallows", 14, 23, 23, 28], ["rock", 26, 24, 30, 30]], paths: [road([7, 18], [30, 18]), road([8, 27], [25, 27], [29, 20])] },
    army: [building("ossuary", "depot", 7, 23), commander("undead", 10, 18), unit("gravecaller", "special", 11, 18), unit("bone-a", "melee", 12, 17), unit("bone-b", "melee", 12, 20), unit("bow-a", "ranged", 8, 16), unit("bow-b", "ranged", 8, 20), foe("wounded-a", "melee", 15, 16, { x: 12, y: 17 }, 25), foe("wounded-b", "melee", 15, 21, { x: 12, y: 20 }, 25), { ...unit("captain", "ranged", 29, 18, 1), order: { type: "hold" } }]
  }, "Raise at least one fresh corpse and defeat the marked bridge captain.", all(value("action.ability.raise"), dead("captain")), dead("commander")),
  finale({
    id: "undead-4",
    title: "The Ash Judge",
    faction: "undead",
    opponent: "orcs",
    commander: UNDEAD,
    seed: 7404,
    briefing: "The Ash Judge guards the erased names. His wounded guards leave corpses. Move the Gravecaller close enough to raise them and screen the Gravebows with those ranks. Mara can drain hostile guards. Leave the judgment circles or interrupt the Judge's sentence.",
    success: "The Judge falls and the names return to the ledgers. Mara ends the march at the burial gate, with Iven recording every soldier who did not return.",
    failure: "Mara falls before the names are restored. The Ash Judge keeps the court.",
    ground: { plots: [["rock", 13, 7, 17, 13], ["rock", 25, 24, 29, 29], ["mud", 17, 16, 23, 22]], paths: [road([7, 29], [17, 25], [27, 15]), road([10, 19], [22, 10], [27, 15])] },
    army: [building("ossuary", "depot", 5, 25), commander("undead", 9, 24), unit("gravecaller", "special", 10, 25), unit("bone-a", "melee", 11, 22), unit("bone-b", "melee", 14, 24), unit("bone-c", "melee", 15, 26), unit("bow-a", "ranged", 8, 28), unit("bow-b", "ranged", 11, 29), unit("bow-c", "ranged", 14, 30), foe("judge-guard-a", "melee", 19, 23, { x: 14, y: 24 }, 35), foe("judge-guard-b", "melee", 19, 27, { x: 15, y: 26 }, 35), { ...unit("boss", "special", 27, 15, 1), order: { type: "hold" } }]
  }, { name: "Ash Judge", health: 1600, location: { x: 27, y: 15 }, phaseNames: ["First sentence", "The accused rise", "Final judgment"], radii: [3, 4, 5], damage: 24, adds: [[], [foe("judge-a", "melee", 26, 20, { x: 22, y: 20 }, 45)], [foe("judge-b", "melee", 29, 11, { x: 22, y: 20 }, 45)]], mechanic: "Raise at least one real corpse during the fight; the Ossuary leaves two free population slots." }),
  escort({
    id: "tideborn-1",
    title: "The Low-Tide Crossing",
    faction: "tideborn",
    opponent: "dwarves",
    commander: TIDE,
    seed: 7501,
    briefing: "Neris guides Reef Tender Pell across the low-tide flats. Tideborn cross mud and shallows without the usual slowdown. Clear each patrol and stay near Pell until he reaches the Coral Hold.",
    success: "Pell reaches the Coral Hold with the tide ledger. Neris can plan an attack on the dry-land customs fort.",
    failure: "Pell or Neris is lost on the flats. Reset and keep the formation beside the tender.",
    ground: { plots: [["shallows", 10, 8, 25, 29], ["water", 15, 4, 20, 10], ["water", 25, 23, 31, 30]], paths: [road([6, 29], [17, 28], [24, 17], [29, 7])] },
    army: [commander("tideborn", 6, 27), unit("convoy", "worker", 6, 29), unit("shell-a", "melee", 9, 27), unit("shell-b", "melee", 9, 30), unit("harpoon-a", "ranged", 4, 28), unit("harpoon-b", "ranged", 4, 31)]
  }, road([17, 28], [24, 17], [29, 7]), [
    { checkpoint: 1, actors: [foe("flat-a", "melee", 21, 25, { x: 17, y: 28 }, 95), foe("flat-b", "ranged", 22, 29, { x: 17, y: 28 }, 55)], speaker: "Pell", text: "Customs troops on the middle flat. They move slowly through the shallows." },
    { checkpoint: 2, actors: [foe("flat-c", "melee", 28, 13, { x: 24, y: 17 }, 100), foe("flat-d", "melee", 29, 17, { x: 24, y: 17 }, 100)], speaker: TIDE, text: "Use the wet flank and bring Pell through after their line turns." }
  ]),
  puzzle({
    id: "tideborn-2",
    title: "The Customs Causeway",
    faction: "tideborn",
    opponent: "dwarves",
    commander: TIDE,
    seed: 7502,
    briefing: "A prepared cannon covers the dry causeway. Send Shellguards through the southern shallows while the Harpooners hold the crossing. Defeat the cannon and its marked guard with this army.",
    success: "The causeway opens. Neris chooses to recover the customs records unseen or defend Pell's new tidal basin against the counterattack.",
    failure: "Neris or both Shellguards fall on the dry road. Reset and approach through the shallows.",
    ground: { plots: [["water", 16, 4, 20, 12], ["shallows", 13, 22, 27, 30], ["mud", 21, 13, 26, 20]], paths: [road([6, 18], [29, 18])] },
    army: [commander("tideborn", 7, 19), unit("shell-a", "melee", 9, 25), unit("shell-b", "melee", 11, 27), unit("harpoon-a", "ranged", 6, 16), unit("harpoon-b", "ranged", 9, 16), { ...unit("customs-cannon", "special", 28, 18, 1), order: { type: "hold" } }, { ...unit("customs-guard", "melee", 25, 18, 1, 120), order: { type: "hold" } }]
  }, "Defeat the marked customs cannon and guard. Keep at least one Shellguard alive.", all(dead("customs-cannon"), dead("customs-guard")), all(dead("shell-a"), dead("shell-b"))),
  stealth({
    id: "tideborn-3",
    title: "The Harbor Ledger",
    faction: "tideborn",
    opponent: "automata",
    commander: TIDE,
    seed: 7503,
    briefing: "Neris crosses the wet western flats to the harbor archive. Recover the ledger and return to Pell without two alarms. Machine patrols use the dry piers; Tideborn can take the mud around them.",
    success: "The ledger reveals that the Harbor Regent diverted the returning tide. Neris enters the regulator court from the flooded western wall.",
    failure: "The pier patrols catch Neris or raise a second alarm. Reset the harbor approach.",
    ground: { plots: [["mud", 4, 10, 10, 26], ["water", 12, 11, 16, 29], ["water", 24, 13, 28, 25], ["shallows", 4, 5, 29, 9]], paths: [road([19, 12], [19, 27]), road([30, 13], [30, 29])] },
    army: [commander("tideborn", 6, 29), unit("pell", "worker", 4, 29), unit("pier-a", "melee", 19, 15, 1), unit("pier-b", "ranged", 30, 23, 1)]
  }, { x: 29, y: 6 }, { x: 6, y: 29 }, ["pier-a", "pier-b"], [{ actor: "pier-a", route: road([19, 12], [19, 27]) }, { actor: "pier-b", route: road([30, 13], [30, 29]) }]),
  defense({
    id: "tideborn-3-alt",
    title: "Hold the Tidal Basin",
    faction: "tideborn",
    opponent: "automata",
    commander: TIDE,
    seed: 7533,
    briefing: "Neris stays to protect Pell's new basin. The attackers arrive along two piers. Hold the Coral Hold for seventy-five seconds. Heal the formation with the Tidecaller's Returning Tide and use the wet ground to meet each wave.",
    success: "The basin survives and restores water to the harbor wall. Neris follows the returning tide into the Regent's court.",
    failure: "Neris or the Coral Hold falls before the basin fills. Reset the harbor defense.",
    ground: { plots: [["water", 11, 12, 15, 27], ["water", 24, 13, 28, 27], ["shallows", 16, 18, 23, 30], ["mud", 4, 16, 10, 22]], paths: [road([19, 6], [19, 28]), road([30, 8], [30, 28], [19, 28])] },
    army: [building("fortress", "hq", 8, 29), building("basin", "depot", 17, 28), building("lodge", "barracks", 5, 25), commander("tideborn", 19, 25), unit("tidecaller", "special", 18, 27), unit("shell-a", "melee", 17, 22), unit("shell-b", "melee", 23, 24), unit("harpoon-a", "ranged", 16, 26), unit("harpoon-b", "ranged", 21, 28), unit("pell", "worker", 10, 25)]
  }, 75, [
    { seconds: 11, actors: [foe("basin-wave1-a", "melee", 18, 7, { x: 19, y: 25 }, 100), foe("basin-wave1-b", "ranged", 22, 8, { x: 19, y: 25 }, 55)], text: "Sentinels on the central pier. Keep the formation together for Returning Tide." },
    { seconds: 30, actors: [foe("basin-wave2-a", "melee", 30, 9, { x: 23, y: 25 }, 100), foe("basin-wave2-b", "ranged", 30, 13, { x: 23, y: 25 }, 55)], text: "The eastern pier has a second group. Take the shallow crossing to meet it." },
    { seconds: 51, actors: [foe("basin-wave3-a", "special", 18, 8, { x: 8, y: 29 }, 95), foe("basin-wave3-b", "melee", 21, 8, { x: 8, y: 29 }, 110)], text: "The last machines are advancing. Pell needs twenty more seconds." }
  ], 2),
  finale({
    id: "tideborn-4",
    title: "The Harbor Regent",
    faction: "tideborn",
    opponent: "automata",
    commander: TIDE,
    seed: 7504,
    briefing: "The Harbor Regent is forcing the tide into his regulator. Use the Tidecaller's Returning Tide to heal Neris's formation and move clear of pressure circles. Wet routes reach both sides of the court.",
    success: "The regulator opens and the tide returns to the flats. Neris appoints Pell harbor keeper under a ledger every village can read.",
    failure: "Neris falls and the regulator remains shut. Reset the court assault.",
    ground: { plots: [["water", 12, 8, 16, 15], ["water", 24, 24, 29, 29], ["shallows", 14, 17, 25, 23], ["mud", 7, 16, 11, 25]], paths: [road([6, 29], [17, 27], [27, 15]), road([6, 10], [21, 8], [27, 15])] },
    army: [commander("tideborn", 8, 25), unit("tidecaller", "special", 9, 27), unit("shell-a", "melee", 11, 24), unit("shell-b", "melee", 13, 26), unit("harpoon-a", "ranged", 6, 28), unit("harpoon-b", "ranged", 10, 29), { ...unit("boss", "special", 27, 15, 1), order: { type: "hold" } }]
  }, { name: "Harbor Regent", health: 1300, location: { x: 27, y: 15 }, phaseNames: ["Pressure jet", "Returning breakers", "Regulator collapse"], radii: [3, 4, 5], damage: 30, adds: [[], [foe("regent-a", "melee", 29, 20, { x: 22, y: 21 }, 65)], [foe("regent-b", "ranged", 29, 10, { x: 22, y: 21 }, 45)]], mechanic: "Cast Returning Tide at least once during the fight to heal and speed the formation." }),
  puzzle({
    id: "automata-1",
    title: "The Broken Relay",
    faction: "automata",
    opponent: "fairies",
    commander: MACHINE,
    seed: 7601,
    briefing: "K-7 has a fixed repair party and no resource budget. Thornblades cover the relay. Defeat the two marked blockers, then move K-7 to the relay pad while the Prism Archers keep their distance.",
    success: "The relay records a request from a disconnected foundry. K-7 follows it rather than the old command to abandon damaged units.",
    failure: "K-7 or both Prism Archers are lost. Reset the relay party and keep the archers behind the Sentinels.",
    ground: { plots: [["rock", 13, 7, 17, 13], ["rock", 13, 23, 17, 29], ["mud", 20, 14, 25, 21]], paths: [road([7, 18], [29, 18]), road([8, 27], [26, 27], [29, 18])] },
    army: [commander("automata", 7, 18), unit("sentinel-a", "melee", 10, 16), unit("sentinel-b", "melee", 10, 21), unit("prism-a", "ranged", 6, 22), unit("prism-b", "ranged", 8, 25), { ...unit("blocker-a", "melee", 24, 16, 1, 120), order: { type: "hold" } }, { ...unit("blocker-b", "melee", 27, 21, 1, 120), order: { type: "hold" } }]
  }, "Defeat both marked blockers and bring K-7 to the relay pad at (29, 18).", all(dead("blocker-a"), dead("blocker-b"), at("commander", 29, 18)), all(dead("prism-a"), dead("prism-b"))),
  stealth({
    id: "automata-2",
    title: "The Obsolete Command",
    faction: "automata",
    opponent: "dwarves",
    commander: MACHINE,
    seed: 7602,
    briefing: "K-7 enters the survey depot to recover the order that cut power to the foundry. Follow the western road, reach the northern archive, and return to Assembler M-2 without two alarms.",
    success: "The order came from the Null Architect. K-7 chooses whether to defend the disconnected foundry or escort M-2 through the repair route.",
    failure: "K-7 is destroyed or identified twice. Reset the survey-depot approach.",
    ground: { plots: [["rock", 12, 12, 16, 27], ["rock", 24, 13, 28, 26], ["mud", 17, 20, 22, 29]], paths: [road([6, 29], [6, 6], [30, 6]), road([20, 11], [20, 18]), road([30, 14], [30, 28])] },
    army: [commander("automata", 6, 29), unit("m-2", "worker", 4, 29), unit("survey-a", "melee", 20, 15, 1), unit("survey-b", "ranged", 30, 22, 1)]
  }, { x: 30, y: 6 }, { x: 6, y: 29 }, ["survey-a", "survey-b"], [{ actor: "survey-a", route: road([20, 11], [20, 18]) }, { actor: "survey-b", route: road([30, 14], [30, 28]) }]),
  defense({
    id: "automata-3",
    title: "The Disconnected Foundry",
    faction: "automata",
    opponent: "tideborn",
    commander: MACHINE,
    seed: 7603,
    briefing: "K-7 remains with the damaged foundry. Use K-7's Prime Shield when shields take damage, pull the line back to recharge between waves, and hold the Core Foundry for eighty seconds. Only two replacement soldiers are available.",
    success: "The foundry reconnects and gives K-7 an independent command link. The Null Architect must now answer to the machines it discarded.",
    failure: "K-7 or the Core Foundry falls before reconnection. Reset the shield line.",
    ground: { plots: [["rock", 5, 15, 13, 20], ["rock", 23, 15, 31, 20], ["shallows", 14, 9, 22, 14]], paths: [road([18, 6], [18, 29]), road([8, 28], [18, 24])] },
    army: [building("fortress", "hq", 8, 29), building("assembly", "barracks", 5, 25), building("prism-tower", "tower", 17, 24), commander("automata", 18, 26), unit("sentinel-a", "melee", 16, 22), unit("sentinel-b", "melee", 21, 22), unit("prism-a", "ranged", 16, 27), unit("prism-b", "ranged", 21, 27), unit("m-2", "worker", 10, 25)]
  }, 80, [
    { seconds: 12, actors: [foe("foundry-wave1-a", "melee", 17, 8, { x: 18, y: 24 }, 100), foe("foundry-wave1-b", "ranged", 21, 8, { x: 18, y: 24 }, 55)], text: "The first harbor formation is coming. Hold the shield line together." },
    { seconds: 33, actors: [foe("foundry-wave2-a", "melee", 16, 8, { x: 18, y: 24 }, 105), foe("foundry-wave2-b", "special", 21, 8, { x: 18, y: 24 }, 80)], text: "A Tidecaller is behind the second group. Restore wards before the line breaks." },
    { seconds: 56, actors: [foe("foundry-wave3-a", "melee", 17, 8, { x: 8, y: 29 }, 115), foe("foundry-wave3-b", "ranged", 21, 8, { x: 8, y: 29 }, 65)], text: "The link is almost restored. This is the final attack." }
  ], 2),
  escort({
    id: "automata-3-alt",
    title: "The Repair Route",
    faction: "automata",
    opponent: "tideborn",
    commander: MACHINE,
    seed: 7633,
    briefing: "K-7 follows Assembler M-2 along the old repair route. Stay beside M-2, keep Sentinels in front when the harbor guards arrive, and restore a damaged ally with K-7's Prime Shield before crossing the final wet span.",
    success: "M-2 reaches the independent relay and reconnects the foundry remotely. K-7 advances through the service entrance to the Null Architect.",
    failure: "M-2 or K-7 is lost on the repair route. Reset and move the formation beside the assembler.",
    ground: { plots: [["water", 12, 4, 16, 22], ["water", 23, 15, 28, 30], ["shallows", 17, 18, 22, 26]], paths: [road([7, 29], [18, 29], [19, 12], [29, 7])] },
    army: [commander("automata", 6, 27), unit("convoy", "worker", 7, 29), unit("sentinel-a", "melee", 10, 28), unit("sentinel-b", "melee", 10, 31), unit("prism-a", "ranged", 4, 28), unit("prism-b", "ranged", 5, 31)]
  }, road([18, 29], [19, 12], [29, 7]), [
    { checkpoint: 1, actors: [foe("repair-a", "melee", 20, 25, { x: 18, y: 29 }, 85), foe("repair-b", "ranged", 17, 24, { x: 18, y: 29 }, 50)], speaker: "Assembler M-2", text: "Harbor guards at the lower span. I will wait for the Sentinels." },
    { checkpoint: 2, actors: [foe("repair-c", "melee", 24, 10, { x: 19, y: 12 }, 95), foe("repair-d", "melee", 25, 14, { x: 19, y: 12 }, 95)], speaker: MACHINE, text: "The relay guards are here. Restore the formation and clear the span." }
  ]),
  finale({
    id: "automata-4",
    title: "The Null Architect",
    faction: "automata",
    opponent: "dwarves",
    commander: MACHINE,
    seed: 7604,
    briefing: "The Null Architect is dismantling the independent relay. Use the Ward Engine to restore shields and K-7's Prime Shield to reinforce a threatened machine. Spread the shield line around warning circles and interrupt the purge with Prism Archer fire.",
    success: "The Architect is defeated. K-7 keeps the foundry connected and removes the command that marked its damaged workers expendable.",
    failure: "K-7 is destroyed and the independent relay falls. Reset the final formation.",
    ground: { plots: [["rock", 11, 9, 15, 15], ["rock", 24, 24, 29, 29], ["mud", 17, 17, 24, 22]], paths: [road([7, 29], [16, 26], [27, 14]), road([8, 18], [21, 9], [27, 14])] },
    army: [commander("automata", 8, 25), unit("ward-engine", "special", 9, 27), unit("sentinel-a", "melee", 11, 24), unit("sentinel-b", "melee", 13, 26), unit("prism-a", "ranged", 6, 28), unit("prism-b", "ranged", 10, 29), { ...unit("boss", "special", 27, 14, 1), order: { type: "hold" } }]
  }, { name: "Null Architect", health: 1300, location: { x: 27, y: 14 }, phaseNames: ["Diagnostic purge", "Fault isolation", "Emergency shutdown"], radii: [3, 4, 5], damage: 28, adds: [[], [foe("architect-a", "melee", 29, 18, { x: 22, y: 20 }, 65)], [foe("architect-b", "ranged", 29, 9, { x: 22, y: 20 }, 45)]], mechanic: "Restore damaged shields with Ward Engine at least once during the fight." })
];
var SCENARIOS = Object.fromEntries(missions.map((mission) => [mission.id, mission]));
var campaigns = [
  { id: "campaign-orcs", faction: "orcs", title: "A Hall for the Valley", commander: ORC, cast: [{ name: "Torg", role: "Forge foreman and refugee guide" }, { name: "Brass Keeper", role: "Machine toll keeper" }], introduction: "Rakka opens a quarry workshop to refugees and refuses to pay the keeper who controls their only crossing.", chapters: ["orcs-1", "orcs-2", "orcs-3", "orcs-4"], choice: { prompt: "The shelter is secure. How should Rakka open the crossing?", options: [{ id: "bridge", text: "Break the toll line", consequence: "Fight the pikes and archers at the toll bridge with a fixed warband.", chapter3: "orcs-3" }, { id: "courier", text: "Steal the courier orders", consequence: "Enter the patrol camp with Rakka and find a hidden service entrance.", chapter3: "orcs-3-alt" }] } },
  { id: "campaign-fairies", faction: "fairies", title: "The Returning Grove", commander: FAIRY, cast: [{ name: "Oren", role: "Tender of the living seed" }, { name: "Marshal Brakka", role: "Commander of the grove watch" }], introduction: "Liora recovers the grove wards from a watch that burns every road it cannot control.", chapters: ["fairies-1", "fairies-2", "fairies-3", "fairies-4"], choice: { prompt: "The living seed is safe. Where should Liora lead the Court?", options: [{ id: "grove", text: "Defend the old grove", consequence: "Hold the Elderheart and Moonwell through the watch attack.", chapter3: "fairies-3" }, { id: "stockade", text: "Open the watcher stockade", consequence: "Use Veil Doubles and a fixed party to break the guarded supply path.", chapter3: "fairies-3-alt" }] } },
  { id: "campaign-dwarves", faction: "dwarves", title: "Water Below Deep Gate", commander: DWARF, cast: [{ name: "Sena", role: "Surveyor and keeper of Deep Gate" }, { name: "Grave Warden", role: "Occupier of the mine pump" }], introduction: "Bryn prepares the quarry defenses and reclaims a flooded mine whose pump has become a fortress.", chapters: ["dwarves-1", "dwarves-2", "dwarves-3", "dwarves-4"], choice: { prompt: "Deep Gate is closed. How should Bryn reach the pump?", options: [{ id: "surveyor", text: "Escort Sena through the galleries", consequence: "Protect a real moving surveyor through the flooded crossings.", chapter3: "dwarves-3" }, { id: "works", text: "Scout the northern works", consequence: "Avoid patrol cones and recover the pressure plans with Bryn.", chapter3: "dwarves-3-alt" }] } },
  { id: "campaign-undead", faction: "undead", title: "The Names That Remain", commander: UNDEAD, cast: [{ name: "Iven", role: "Last archivist of the burial ledgers" }, { name: "Ash Judge", role: "Author of the erased burial orders" }], introduction: "Mara defends the mourners, restores the names of the fallen, and makes the commander who erased them face his own casualties.", chapters: ["undead-1", "undead-2", "undead-3", "undead-4"], choice: { prompt: "The watchbook reveals the captive archivist. What comes first?", options: [{ id: "archivist", text: "Bring Iven home", consequence: "Escort the archivist through the drowned grove with room to raise fallen guards.", chapter3: "undead-3" }, { id: "burial", text: "Free the burial bridge", consequence: "Raise fresh mortal corpses to solve the fixed-army bridge engagement.", chapter3: "undead-3-alt" }] } },
  { id: "campaign-tideborn", faction: "tideborn", title: "The Harbor's Tide", commander: TIDE, cast: [{ name: "Pell", role: "Reef tender and keeper of the tide ledger" }, { name: "Harbor Regent", role: "Controller of the diverted tide" }], introduction: "Neris follows the wet routes that customs troops cannot hold and returns the harbor tide to the villages.", chapters: ["tideborn-1", "tideborn-2", "tideborn-3", "tideborn-4"], choice: { prompt: "The causeway is open. What should Neris secure next?", options: [{ id: "ledger", text: "Recover the harbor ledger", consequence: "Use wet flanks to infiltrate the archive and extract without two alarms.", chapter3: "tideborn-3" }, { id: "basin", text: "Protect Pell's tidal basin", consequence: "Defend the Coral Hold against finite attacks from two piers.", chapter3: "tideborn-3-alt" }] } },
  { id: "campaign-automata", faction: "automata", title: "An Independent Command", commander: MACHINE, cast: [{ name: "Assembler M-2", role: "Repair worker at the disconnected foundry" }, { name: "Null Architect", role: "Author of the expendable-unit command" }], introduction: "K-7 follows a repair request that its old orders would discard and gives a damaged foundry an independent command link.", chapters: ["automata-1", "automata-2", "automata-3", "automata-4"], choice: { prompt: "The old command has been recovered. How should K-7 restore the foundry?", options: [{ id: "foundry", text: "Hold the foundry during reconnection", consequence: "Use ward restoration and shield recharge through three finite waves.", chapter3: "automata-3" }, { id: "repair", text: "Escort M-2 to the relay", consequence: "Protect the assembler along the wet repair route and reconnect remotely.", chapter3: "automata-3-alt" }] } }
];
var CAMPAIGNS = Object.fromEntries(campaigns.map((campaign2) => [campaign2.id, campaign2]));

// src/core/content.ts
var ECONOMY = { harvestPerSecond: 2.28 };
var unit2 = (id5, name, role, wood, ore, hp, damage2, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id5, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage: damage2, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building2 = (id5, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id: id5, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
var BASE_FACTIONS = {
  orcs: { id: "orcs", name: "Ironclad", subtitle: "Strength in the struggle", color: 13662021, accent: "#dba35d", description: "Armored warbands gather fury as they fight. Hold the line, build momentum, and break the enemy stronghold.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit2("orc-worker", "Scrapper", "worker", 50, 0, 85, 5, 1, 1.3, 2.1, 1.4, 12, void 0, "Harvest timber, ore and crystal. Raise and repair your settlement."),
    melee: unit2("orc-melee", "Ironjaw", "melee", 70, 25, 175, 15, 3, 1.4, 1.8, 1.15, 36, "momentum", "Armored front line. Sustained attacks build Fury, granting up to 40% damage and 15% attack speed."),
    ranged: unit2("orc-ranged", "Boltspitter", "ranged", 85, 35, 100, 15, 1, 6.5, 2, 1.5, 40, "momentum", "Crossbow volleys punish exposed enemies. Builds Fury with each hit."),
    special: unit2("orc-special", "Wardrum", "special", 120, 70, 190, 21, 3, 1.6, 1.65, 1.65, 56, "momentum", "Heavy shock infantry. Fury makes prolonged brawls devastating.")
  }, buildings: {
    hq: building2("orc-hq", "Iron Hall", "hq", 240, 120, 1800, 3, 55, "Your stronghold. Trains Scrappers and supports 12 population."),
    depot: building2("orc-depot", "Timber Yard", "depot", 100, 0, 600, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building2("orc-barracks", "War Foundry", "barracks", 160, 50, 950, 3, 35, "Trains Ironjaws, Boltspitters, and Wardrums."),
    tower: building2("orc-tower", "Watchtower", "tower", 120, 80, 750, 2, 30, "Defends nearby ground with heavy bolts.")
  } },
  fairies: { id: "fairies", name: "Wild Court", subtitle: "The forest remembers", color: 7395517, accent: "#a1e1c6", description: "Swift woodland defenders weave deceptive doubles and recover beneath healing groves. Strike, vanish, and return.", ai: { aggression: 0.9, armySize: 10, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit2("fairy-worker", "Tender", "worker", 50, 0, 65, 4, 0, 1.3, 2.5, 1.3, 12, void 0, "Gather timber, ore and crystal. Cultivate the living buildings of the Court."),
    melee: unit2("fairy-melee", "Thornblade", "melee", 65, 25, 140, 17, 2, 1.5, 2.75, 1, 34, void 0, "Swift spear guardians. Reposition quickly and protect fragile casters."),
    ranged: unit2("fairy-ranged", "Mothbow", "ranged", 80, 40, 85, 18, 0, 7, 2.6, 1.4, 40, void 0, "Long-range arrows and quick wings reward careful positioning."),
    special: unit2("fairy-special", "Veilweaver", "special", 110, 75, 105, 13, 1, 5, 2.5, 1.5, 56, "illusion", "Conjures temporary doubles to draw enemy attacks. Activate with Q.")
  }, buildings: {
    hq: building2("fairy-hq", "Elderheart", "hq", 240, 120, 1650, 3, 55, "The heart of your settlement. Trains Tenders and supports 12 population."),
    depot: building2("fairy-depot", "Moonwell", "depot", 100, 0, 520, 2, 22, "Resource drop-off. Passively heals nearby friendly units at 2.5 HP/s within 6 tiles. Adds 10 population capacity.", "heal"),
    barracks: building2("fairy-barracks", "Bloomspire", "barracks", 160, 50, 800, 3, 35, "Trains Thornblades, Mothbows, and Veilweavers."),
    tower: building2("fairy-tower", "Thornwatch", "tower", 120, 80, 650, 2, 30, "A living defensive spire that guards the surrounding grove.")
  } },
  dwarves: { id: "dwarves", name: "Deepforge", subtitle: "Choose the ground. Hold it.", color: 15185233, accent: "#edc675", description: "Engineers prepare firing positions. Emplace your troops for protection and cannon range, then pack up to advance.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.4, ranged: 0.35, special: 0.25 } }, units: {
    worker: unit2("dwarf-worker", "Mason", "worker", 50, 0, 80, 5, 1, 1.3, 2.1, 1.4, 12, void 0, "Gather wood, ore and crystal. Construct and repair the Deepforge settlement."),
    melee: unit2("dwarf-melee", "Shieldguard", "melee", 70, 30, 170, 15, 3, 1.4, 1.9, 1.15, 35, "entrench", "Protect the gun line. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up."),
    ranged: unit2("dwarf-ranged", "Thunderlock", "ranged", 85, 40, 95, 20, 1, 6.5, 2, 1.7, 40, "entrench", "Musket infantry. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up."),
    special: { ...unit2("dwarf-special", "Siege Cannon", "special", 130, 85, 145, 32, 2, 6, 1.45, 2.6, 58, "entrench", "Long-range artillery deals 80% bonus damage to buildings. Q emplaces: after 3 seconds, gain 3 range, 2 armor and 15% damage. Movement packs up."), sight: 11, buildingDamageMultiplier: 1.8 }
  }, buildings: {
    hq: building2("dwarf-hq", "Mountain Keep", "hq", 240, 120, 1800, 3, 55, "Your stronghold. Trains Masons and supports 12 population."),
    depot: building2("dwarf-depot", "Supply Vault", "depot", 100, 0, 620, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building2("dwarf-barracks", "Gunsmith Hall", "barracks", 160, 50, 950, 3, 35, "Trains Shieldguards, Thunderlocks and Siege Cannons."),
    tower: building2("dwarf-tower", "Gun Bastion", "tower", 120, 80, 800, 2, 30, "A stone gun emplacement that protects your prepared position.")
  } },
  undead: { id: "undead", name: "Ashen Host", subtitle: "The fallen march again", color: 11049433, accent: "#c5b5ed", description: "Expendable ranks screen the Gravecaller, who consumes nearby corpses to raise temporary warriors. Protect your casters to sustain the attack.", ai: { aggression: 1.1, armySize: 11, composition: { melee: 0.55, ranged: 0.3, special: 0.15 } }, units: {
    worker: unit2("undead-worker", "Gravedigger", "worker", 50, 0, 60, 4, 0, 1.3, 2.3, 1.3, 12, void 0, "Gather wood, ore and crystal. Raise and repair the necropolis."),
    melee: unit2("undead-melee", "Boneguard", "melee", 45, 15, 115, 14, 1, 1.4, 2.35, 1, 24, void 0, "Cheap, fragile infantry. Fallen mortal troops leave corpses for Gravecallers."),
    ranged: unit2("undead-ranged", "Gravebow", "ranged", 65, 30, 80, 17, 0, 6.5, 2.25, 1.4, 32, void 0, "Brittle archers. Keep a screen of Boneguards between them and the enemy."),
    special: unit2("undead-special", "Gravecaller", "special", 110, 80, 95, 12, 0, 5.5, 2.1, 1.6, 48, "raise", "Automatically (or Q) consumes up to 2 corpses within 6 tiles, raising half-health Boneguards for 35 seconds. 22s cooldown. Raised troops use population and cannot be raised again.")
  }, buildings: {
    hq: building2("undead-hq", "Necropolis", "hq", 240, 120, 1650, 3, 55, "Your stronghold. Trains Gravediggers and supports 12 population."),
    depot: building2("undead-depot", "Ossuary", "depot", 100, 0, 500, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building2("undead-barracks", "Crypt", "barracks", 160, 50, 800, 3, 35, "Trains Boneguards, Gravebows and Gravecallers."),
    tower: building2("undead-tower", "Soul Spire", "tower", 120, 80, 650, 2, 30, "A funerary spire that fires at intruders.")
  } },
  tideborn: { id: "tideborn", terrainSpeeds: { mud: 1.1, shallows: 1.1 }, name: "Tideborn", subtitle: "Follow the returning tide", color: 5744547, accent: "#e2b897", description: "Amphibious defenders cross mud and shallows at full speed. Tidecallers heal their formation and send it forward in a surge.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit2("tideborn-worker", "Reef Tender", "worker", 50, 0, 70, 4, 0, 1.3, 2.3, 1.3, 12, void 0, "Gather wood, ore and crystal. Cross mud and shallows without slowing."),
    melee: unit2("tideborn-melee", "Shellguard", "melee", 70, 25, 170, 16, 3, 1.4, 2.15, 1.15, 35, void 0, "Shell-armored infantry. Wet ground gives this steady formation a route around slower enemies."),
    ranged: unit2("tideborn-ranged", "Harpooner", "ranged", 80, 35, 90, 20, 0, 6.5, 2.3, 1.45, 38, void 0, "Harpoons strike from behind the Shellguard line. Moves freely through mud and shallows."),
    special: unit2("tideborn-special", "Tidecaller", "special", 110, 75, 115, 11, 1, 5.5, 2.2, 1.6, 54, "surge", "Q restores 35 HP to nearby allies and grants 25% movement speed for 6 seconds. 20s cooldown. Casts automatically when nearby allies are wounded in combat.")
  }, buildings: {
    hq: building2("tideborn-hq", "Coral Hold", "hq", 240, 120, 1700, 3, 55, "Trains Reef Tenders and supports 12 population."),
    depot: building2("tideborn-depot", "Tidal Basin", "depot", 100, 0, 560, 2, 22, "Resource drop-off for wood, ore and crystal. Adds 10 population capacity."),
    barracks: building2("tideborn-barracks", "Reef Lodge", "barracks", 160, 50, 860, 3, 35, "Trains Shellguards, Harpooners and Tidecallers."),
    tower: building2("tideborn-tower", "Conch Spire", "tower", 120, 80, 700, 2, 30, "A fortified conch that fires at nearby invaders.")
  } },
  automata: { id: "automata", name: "Automata", subtitle: "Repair. Recharge. Return.", color: 11967209, accent: "#d8cbb0", description: "Ceramic machines carry shields that recharge after six seconds without damage. Ward Engines restore shields to sustain the formation.", ai: { aggression: 0.95, armySize: 8, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: { ...unit2("automata-worker", "Assembler", "worker", 50, 0, 55, 4, 0, 1.3, 2.15, 1.4, 12, void 0, "Gather wood, ore and crystal. Carries a 12-point rechargeable shield."), shield: 12 },
    melee: { ...unit2("automata-melee", "Sentinel", "melee", 70, 25, 135, 15, 2, 1.4, 1.95, 1.2, 35, void 0, "A 45-point shield absorbs damage before ceramic armor takes harm. Shields recharge at 4/s after 6 seconds without damage."), shield: 45 },
    ranged: { ...unit2("automata-ranged", "Prism Archer", "ranged", 85, 40, 75, 19, 0, 7, 2.1, 1.6, 42, void 0, "Crystal beams reach across the front line. Carries a 35-point rechargeable shield."), shield: 35 },
    special: { ...unit2("automata-special", "Ward Engine", "special", 120, 80, 135, 12, 2, 5, 1.8, 1.7, 56, "ward", "Q restores 24 shield to nearby friendly machines. Casts automatically when shields are damaged. 20s cooldown. Carries a 45-point shield."), shield: 45 }
  }, buildings: {
    hq: building2("automata-hq", "Core Foundry", "hq", 240, 120, 1750, 3, 55, "Trains Assemblers and supports 12 population."),
    depot: building2("automata-depot", "Crystal Depot", "depot", 100, 0, 580, 2, 22, "Resource drop-off for wood, ore and crystal. Adds 10 population capacity."),
    barracks: building2("automata-barracks", "Assembly Hall", "barracks", 160, 50, 900, 3, 35, "Trains Sentinels, Prism Archers and Ward Engines."),
    tower: building2("automata-tower", "Prism Tower", "tower", 120, 80, 740, 2, 30, "Focused crystal beams defend the foundry.")
  } }
};
var expansionNames = {
  orcs: ["Boar Rider", "Pikejaw", "Iron Catapult"],
  fairies: ["Stag Rider", "Briar Pike", "Thorn Trebuchet"],
  dwarves: ["Mountain Rider", "Deep Pike", "Stone Thrower"],
  undead: ["Dread Rider", "Bone Pike", "Grave Catapult"],
  tideborn: ["Shell Rider", "Reef Pike", "Coral Mangonel"],
  automata: ["Strider", "Lance Sentinel", "Siege Engine"]
};
var cavalryAbilities = { orcs: "impact-fury", fairies: "forest-leap", dwarves: "armored-brace", undead: "terror", tideborn: "wet-surge", automata: "shield-dash" };
var siegeAbilities = { orcs: "incendiary-shell", fairies: "rooting-shell", dwarves: "ammunition-cannon", undead: "corpse-shell", tideborn: "flood-shell", automata: "powered-beam" };
var FACTIONS = Object.fromEntries(Object.entries(BASE_FACTIONS).map(([id5, base]) => {
  const faction = id5, prefix = base.units.worker.id.split("-")[0], names = expansionNames[faction];
  return [id5, { ...base, buildings: {
    ...base.buildings,
    wall: { ...building2(`${prefix}-wall`, "Stone Wall", "wall", 30, 25, 1100, 1, 15, "A durable barrier. Siege engines break walls quickly."), age: 2 },
    gate: { ...building2(`${prefix}-gate`, "Town Gate", "gate", 90, 65, 1400, 2, 28, "Open to let armies pass. An open gate also admits enemies. Cannot close on a unit."), age: 2 }
  }, units: {
    ...base.units,
    special: { ...base.units.special, age: 2 },
    cavalry: { ...unit2(`${prefix}-cavalry`, names[0], "cavalry", 100, 65, 210, 18, 2, 1.5, 3.5, 1.3, 42, void 0, "Fast raider. Strong against ranged troops; vulnerable to pikes."), age: 2, ability: cavalryAbilities[faction], ...faction === "automata" ? { shield: 60 } : {}, bonusAgainst: { ranged: 1.7 } },
    spear: { ...unit2(`${prefix}-spear`, names[1], "spear", 55, 25, 125, 11, 1, 1.9, 2.1, 1.25, 28, void 0, "Long pike infantry. Deals triple damage to cavalry."), age: 1, bonusAgainst: { cavalry: 3 } },
    siege: { ...unit2(`${prefix}-siege`, names[2], "siege", 180, 140, 185, 28, 2, 8.5, 1.05, 3.8, 65, void 0, "Long-range siege engine. Deals quadruple damage to buildings. Protect it from raiders."), age: 3, cost: { wood: 180, ore: 140, crystal: 25 }, buildingDamageMultiplier: 4, sight: 11, ability: siegeAbilities[faction] }
  } }];
}));
var ABILITIES = {
  "iron-command": { name: "Iron Command", description: "Target allied ground within 8 tiles. Nearby allies gain 25% damage for 8 seconds.", cooldown: 30 },
  "queen-step": { name: "Queen\u2019s Step", description: "Target visible open ground within 7 tiles to blink there and heal nearby allies.", cooldown: 30 },
  "thane-ward": { name: "Thane\u2019s Ward", description: "Target an allied unit within 8 tiles. Restore 80 health and grant 4 armor for 10 seconds.", cooldown: 30 },
  "soul-drain": { name: "Soul Drain", description: "Target a visible enemy unit within 7 tiles. Deal 60 damage and recover 45 health.", cooldown: 30 },
  "admiral-wave": { name: "Admiral\u2019s Wave", description: "Target visible ground within 8 tiles. Allies recover 50 health; hostile units take 35 damage.", cooldown: 30 },
  "prime-shield": { name: "Prime Shield", description: "Target an allied machine within 8 tiles. Restore its shield and grant 4 armor for 10 seconds.", cooldown: 30 },
  "impact-fury": { name: "Impact Fury", description: "Gain 35% damage for 6 seconds. Existing anti-cavalry counters still apply.", cooldown: 25 },
  "forest-leap": { name: "Forest Leap", description: "Target visible open ground within 5 tiles to leap across the forest.", cooldown: 25 },
  "armored-brace": { name: "Armored Brace", description: "Brace for 8 seconds, gaining 5 armor while movement slows by 25%.", cooldown: 25 },
  terror: { name: "Dread Charge", description: "Nearby hostile infantry flee for 3 seconds; illusions and raised troops are immune.", cooldown: 25 },
  "wet-surge": { name: "Wet-ground Surge", description: "On mud or shallows, gain 60% speed and 20% damage for 8 seconds.", cooldown: 25 },
  "shield-dash": { name: "Shield Dash", description: "Spend 15 shield to dash up to 4 tiles toward visible open ground.", cooldown: 25 },
  "incendiary-shell": { name: "Incendiary Shell", description: "Spend 8 wood to ignite the next shell and nearby targets for 6 seconds.", cooldown: 0 },
  "rooting-shell": { name: "Rooting Shell", description: "Spend 6 crystal to root targets hit by the next shell for 4 seconds.", cooldown: 0 },
  "ammunition-cannon": { name: "Deploy Ammunition", description: "Deploy and buy 5 ammunition for 15 ore. Moving packs up; deploy remaining ammunition again for free.", cooldown: 0 },
  "corpse-shell": { name: "Corpse Bombardment", description: "Consume a nearby visible corpse to charge the next area shell.", cooldown: 0 },
  "flood-shell": { name: "Flood Shell", description: "Spend 6 crystal to slow troops near the next impact for 6 seconds.", cooldown: 0 },
  "powered-beam": { name: "Power Beam", description: "Spend 8 crystal to power 4 beam shots. Beam damage pierces armor.", cooldown: 0 },
  surge: { name: "Returning Tide", description: "Restore 35 HP to allies within 5 tiles and grant 25% movement speed for 6 seconds.", cooldown: 20 },
  ward: { name: "Restore Wards", description: "Restore 24 shield to friendly machines within 5 tiles.", cooldown: 20 },
  entrench: { name: "Emplace / Pack up", description: "Hold position and prepare for 3 seconds to gain armor and damage. Cannons also gain range. Movement cancels emplacement.", cooldown: 0 },
  raise: { name: "Raise Fallen", description: "Consume up to two nearby corpses to raise temporary Boneguards. Requires free population.", cooldown: 22 },
  momentum: { name: "War Cry", description: "Build a burst of Fury. Sustained attacks keep the momentum alive.", cooldown: 25 },
  illusion: { name: "Veil Doubles", description: "Conjure two short-lived doubles that draw attacks and deal reduced damage.", cooldown: 35 },
  heal: { name: "Renewal", description: "Restore health to nearby friendly units.", cooldown: 18 }
};
var UPGRADES = {
  "town-age": { id: "town-age", name: "Town Age", description: "Unlock advanced troops, fortifications and expansion strongholds.", cost: { wood: 260, ore: 180, crystal: 0 }, researchTime: 65, building: "hq", appliesTo: "worker", advancesTo: 2, effects: {} },
  "citadel-age": { id: "citadel-age", name: "Citadel Age", description: "Unlock siege engines and veteran military technology.", cost: { wood: 420, ore: 320, crystal: 60 }, researchTime: 90, building: "hq", appliesTo: "worker", age: 2, requires: ["town-age"], advancesTo: 3, effects: {} },
  "forged-weapons": { id: "forged-weapons", name: "Forged Weapons", description: "Melee troops deal 20% more damage.", cost: { wood: 100, ore: 130, crystal: 0 }, researchTime: 35, building: "barracks", appliesTo: "melee", age: 2, effects: { damage: 1.2 } },
  "tempered-armor": { id: "tempered-armor", name: "Tempered Armor", description: "Melee troops gain 2 armor.", cost: { wood: 80, ore: 150, crystal: 0 }, researchTime: 40, building: "barracks", appliesTo: "melee", age: 2, effects: { armor: 2 } },
  "veteran-arms": { id: "veteran-arms", name: "Veteran Arms", description: "Melee troops deal another 25% damage.", cost: { wood: 160, ore: 220, crystal: 35 }, researchTime: 50, building: "barracks", appliesTo: "melee", age: 3, requires: ["forged-weapons"], effects: { damage: 1.25 } },
  "core:ranged-arms": { id: "core:ranged-arms", name: "Ranged Arms", description: "Ranged troops deal 20% more damage.", cost: { wood: 90, ore: 110, crystal: 0 }, researchTime: 35, building: "barracks", appliesTo: "ranged", age: 2, requires: ["town-age"], effects: { damage: 1.2 } },
  "core:cavalry-barding": { id: "core:cavalry-barding", name: "Cavalry Barding", description: "Cavalry gain 2 armor.", cost: { wood: 100, ore: 160, crystal: 0 }, researchTime: 40, building: "barracks", appliesTo: "cavalry", age: 2, requires: ["town-age"], effects: { armor: 2 } },
  "core:siege-gears": { id: "core:siege-gears", name: "Siege Gears", description: "Siege engines move 30% faster.", cost: { wood: 150, ore: 160, crystal: 25 }, researchTime: 45, building: "barracks", appliesTo: "siege", age: 3, requires: ["citadel-age"], effects: { speed: 1.3 } },
  "core:ranged-focus": { id: "core:ranged-focus", name: "Focused Volleys", description: "Ranged troops deal another 25% damage. Locks Skirmish Drills.", cost: { wood: 140, ore: 180, crystal: 25 }, researchTime: 45, building: "barracks", appliesTo: "ranged", age: 3, requires: ["core:ranged-arms"], exclusiveGroup: "core:ranged-doctrine", effects: { damage: 1.25 } },
  "core:ranged-mobility": { id: "core:ranged-mobility", name: "Skirmish Drills", description: "Ranged troops move 25% faster. Locks Focused Volleys.", cost: { wood: 120, ore: 160, crystal: 25 }, researchTime: 40, building: "barracks", appliesTo: "ranged", age: 3, requires: ["core:ranged-arms"], exclusiveGroup: "core:ranged-doctrine", effects: { speed: 1.25 } },
  "worker-harvest": { id: "worker-harvest", name: "Harvest Drills", description: "Workers gather 30% faster.", cost: { wood: 100, ore: 50, crystal: 0 }, researchTime: 30, building: "hq", appliesTo: "worker", effects: { gather: 1.3 } },
  "worker-speed": { id: "worker-speed", name: "Courier Training", description: "Workers move 20% faster.", cost: { wood: 75, ore: 50, crystal: 0 }, researchTime: 25, building: "hq", appliesTo: "worker", effects: { speed: 1.2 } }
};

// src/core/faction-systems-content.ts
var FACTION_STRUCTURE_INFO = {
  "enchanted-grove": { faction: "fairies", radius: 4, definition: { ...FACTIONS.fairies.buildings.depot, id: "core:fairies-enchanted-grove", name: "Enchanted Grove", cost: { wood: 100, ore: 20, crystal: 15 }, hp: 450, buildTime: 24, description: "Conceals allied troops within four tiles. Sends harmless doubles toward visible enemy scouts every twenty seconds." } },
  tunnel: { faction: "dwarves", radius: 3, definition: { ...FACTIONS.dwarves.buildings.depot, id: "core:dwarves-tunnel", name: "Tunnel Entrance", cost: { wood: 150, ore: 80, crystal: 0 }, hp: 650, buildTime: 30, description: "Transfers nearby owned troops to another completed tunnel entrance after a three-second channel. Entrances can link map levels." } },
  necropolis: { faction: "undead", radius: 6, definition: { ...FACTIONS.undead.buildings.depot, id: "core:undead-necropolis-outpost", name: "Necropolis Outpost", cost: { wood: 120, ore: 50, crystal: 25 }, hp: 550, buildTime: 28, description: "Consecrates nearby territory for the Ashen Host. Raised allies regain health and their remaining lifetime is sustained while inside its six-tile radius." } },
  "power-relay": { faction: "automata", radius: 8, definition: { ...FACTIONS.automata.buildings.depot, id: "core:automata-power-relay", name: "Power Relay", cost: { wood: 70, ore: 30, crystal: 10 }, hp: 350, buildTime: 18, description: "Connects structures within eight tiles to a headquarters power network. Connected buildings share shield reserves and power defensive towers." } }
};
var CORPSE_WAGON = { ...FACTIONS.undead.units.siege, id: "core:undead-corpse-wagon", name: "Corpse Wagon", role: "special", cost: { wood: 100, ore: 45, crystal: 0 }, hp: 160, damage: 0, ability: void 0, armor: 1, range: 1, speed: 1.8, cooldown: 1, trainTime: 24, sight: 7, age: 2, buildingDamageMultiplier: 1, description: "Carries up to six mortal bodies. Collect corpses before they decay, then deliver them to a Gravecaller. Cargo retains its original decay deadline." };
var TROPHY_STANDARD = { ...FACTIONS.orcs.buildings.depot, id: "core:orcs-trophy-standard", name: "Trophy Standard", cost: { wood: 0, ore: 0, crystal: 0 }, size: 1, hp: 160, buildTime: 1, sight: 4, description: "A victor spends two trophies to raise this banner. Nearby allies gain 10% damage and recover morale. Enemies can destroy it." };
var FACTION_SYSTEM_DEFINITIONS = Object.fromEntries(Object.keys(FACTIONS).map((faction) => [faction, { units: faction === "undead" ? [CORPSE_WAGON] : [], buildings: [...Object.values(FACTION_STRUCTURE_INFO).filter((info) => info.faction === faction).map((info) => info.definition), ...faction === "orcs" ? [TROPHY_STANDARD] : []] }]));
function factionSystemDefinition(id5) {
  return id5 ? Object.values(FACTION_SYSTEM_DEFINITIONS).flatMap((f) => [...f.units, ...f.buildings]).find((d) => d.id === id5) : void 0;
}
function factionStructureKind(id5) {
  return Object.keys(FACTION_STRUCTURE_INFO).find((kind) => FACTION_STRUCTURE_INFO[kind].definition.id === id5);
}

// src/core/specialist-content.ts
var commanders = { orcs: ["Gorak Ironvoice", "iron-command"], fairies: ["Queen Lyra", "queen-step"], dwarves: ["Thane Bera", "thane-ward"], undead: ["Morwen Ashseer", "soul-drain"], tideborn: ["Admiral Neri", "admiral-wave"], automata: ["Prime Artificer", "prime-shield"] };
function commander2(faction) {
  const base = FACTIONS[faction].units.special, [name, ability] = commanders[faction];
  return { ...base, id: `core:${faction}-commander`, name, role: "special", cost: { wood: 150, ore: 110, crystal: 25 }, hp: 280, damage: 23, range: 4.5, speed: 2.2, trainTime: 25, age: 2, ability, tags: ["hero"], description: `${name} commands the ${FACTIONS[faction].name}. One commander per player. Defeated commanders can be recruited again after 30 seconds; recruitment pays the full cost.` };
}
function engineer(faction) {
  return { ...FACTIONS[faction].units.worker, id: `core:${faction}-engineer`, name: `${FACTIONS[faction].name} Engineer`, role: "special", cost: { wood: 75, ore: 40, crystal: 0 }, hp: 110, damage: 6, armor: 1, range: 1.3, speed: 2.2, trainTime: 18, sight: 8, age: 2, ability: void 0, tags: ["engineer"], description: "Builds temporary bridges and barricades, and repairs damaged siege engines or buildings at a resource cost." };
}
function beacon(faction) {
  return { id: `core:${faction}-beacon`, name: `${FACTIONS[faction].name} Signal Beacon`, role: "tower", cost: { wood: 80, ore: 35, crystal: 10 }, hp: 400, size: 1, buildTime: 16, sight: 15, age: 2, tags: ["beacon"], description: "An outpost linked within 12 tiles of your headquarters or another linked beacon shares sight with its team. Disconnected beacons stop granting distant vision." };
}
var BUILTIN_EXTRA_DEFINITIONS = Object.fromEntries(Object.keys(commanders).map((faction) => [faction, { units: [commander2(faction), engineer(faction)], buildings: [beacon(faction), { id: "core:field-barricade", name: "Field Barricade", role: "wall", cost: { wood: 35, ore: 15, crystal: 0 }, hp: 350, size: 1, buildTime: 0, sight: 2, age: 2, tags: ["barricade"], description: "An engineer\u2019s temporary obstacle. It expires after 60 seconds." }] }]));
function svg(faction, kind) {
  const color = `#${FACTIONS[faction].color.toString(16).padStart(6, "0")}`;
  const drawing = kind === "beacon" ? '<path d="M48 108H80L75 44H53Z" fill="#607874"/><path d="M45 47L64 21L83 47Z" fill="#f5ca72"/><circle cx="64" cy="39" r="7" fill="#fff0b4"/>' : kind === "hero" ? '<path d="M36 43L47 22L59 36L71 22L82 43Z" fill="#f6d67e"/><circle cx="60" cy="54" r="14" fill="#e7cfad"/><path d="M43 66L75 66L86 108L32 108Z" fill="COLOR"/><path d="M37 72L18 91L31 98L48 80M75 70L101 94L95 103L64 79" fill="#a3b0ab"/>' : '<circle cx="60" cy="48" r="13" fill="#dfc19c"/><path d="M45 58L76 58L85 108H36Z" fill="COLOR"/><path d="M25 46L32 37L81 95L74 102Z" fill="#a2b5ad"/><path d="M15 31L27 23L40 42L29 52Z" fill="#d4d5c2"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><title>${FACTIONS[faction].name} ${kind}</title><ellipse cx="64" cy="112" rx="34" ry="8" fill="#152625" opacity=".3"/><g stroke="#203330" stroke-width="3" stroke-linejoin="round">${drawing.replaceAll("COLOR", color)}</g></svg>`;
}
var BUILTIN_EXTRA_ART = Object.fromEntries(Object.keys(commanders).flatMap((faction) => ["hero", "engineer", "beacon"].map((kind) => {
  const id5 = `core:${faction}-${kind === "hero" ? "commander" : kind}`;
  return [id5, { path: `/mods/core/${faction}-${kind}.svg`, svg: svg(faction, kind), width: 128, height: 128, anchor: [64, 112], visualTop: 20 }];
})));
BUILTIN_EXTRA_ART["core:field-barricade"] = { path: "/mods/core/barricade.svg", svg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#27352c" stroke-width="4"><path d="M16 104L21 45L32 25L40 44L37 104M48 112L51 54L61 34L71 55L69 112M79 110L82 50L93 30L103 50L100 110" fill="#997042"/><path d="M16 62L107 69M17 90L106 98"/></g></svg>', width: 128, height: 128, anchor: [64, 112], visualTop: 25 };
for (const faction of Object.keys(commanders)) {
  BUILTIN_EXTRA_DEFINITIONS[faction].units.push(...FACTION_SYSTEM_DEFINITIONS[faction].units);
  BUILTIN_EXTRA_DEFINITIONS[faction].buildings.push(...FACTION_SYSTEM_DEFINITIONS[faction].buildings);
}
var factionObjectDrawings = {
  "core:undead-corpse-wagon": '<path d="M22 58H103L92 87H29Z" fill="#586357"/><circle cx="36" cy="98" r="14" fill="#483c31"/><circle cx="88" cy="98" r="14" fill="#483c31"/><path d="M32 55L95 45M46 38L80 64M55 24L69 49" stroke="#cec8ab" stroke-width="9"/><circle cx="62" cy="35" r="14" fill="#d9d1b1"/>',
  "core:orcs-trophy-standard": '<path d="M60 109V22M39 25H95L80 60H39Z" stroke="#51352d" fill="#d48142" stroke-width="7"/><circle cx="59" cy="40" r="9" fill="#e4cfa2"/><path d="M35 104L88 108" stroke="#694536" stroke-width="10"/>',
  "core:fairies-enchanted-grove": '<path d="M28 110L35 55M77 110L92 49M52 99L63 37" stroke="#526346" stroke-width="10"/><circle cx="37" cy="43" r="27" fill="#569d72"/><circle cx="88" cy="37" r="29" fill="#72b98b"/><circle cx="62" cy="23" r="18" fill="#ace3b0"/><circle cx="63" cy="83" r="10" fill="#f4d78b"/>',
  "core:dwarves-tunnel": '<path d="M21 108V66Q21 24 64 24Q106 24 106 66V108Z" fill="#887c69"/><path d="M39 108V67Q39 46 64 46Q89 46 89 67V108Z" fill="#263633"/><path d="M21 72H39M91 72H107M57 26V45" stroke="#d0ae75" stroke-width="8"/>',
  "core:undead-necropolis-outpost": '<path d="M17 109L32 67L52 58V24L64 10L76 24V58L96 67L111 109Z" fill="#657368"/><path d="M52 109V78Q64 63 76 78V109" fill="#273e38"/><circle cx="64" cy="42" r="9" fill="#ace49c"/>',
  "core:automata-power-relay": '<path d="M30 106L46 70L46 39L64 18L82 39L82 70L98 106Z" fill="#708b94"/><path d="M46 48H82M35 91H92" stroke="#d1bc79" stroke-width="9"/><circle cx="64" cy="59" r="12" fill="#8ae6ee"/>'
};
for (const [id5, drawing] of Object.entries(factionObjectDrawings)) BUILTIN_EXTRA_ART[id5] = { path: `/mods/core/${id5.slice(5)}.svg`, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#20332f" stroke-width="3">${drawing}</g></svg>`, width: 128, height: 128, anchor: [64, 112], visualTop: 10 };

// src/core/economy-definitions.ts
var ECONOMY_RULES = {
  grove: { cost: { wood: 8, ore: 0, crystal: 0 }, plantSeconds: 4, growthSeconds: 60, wood: 100, limit: 200 },
  caravan: { cost: { wood: 90, ore: 35, crystal: 0 }, capacity: 90, trainSeconds: 18 },
  warehouse: { cost: { wood: 130, ore: 35, crystal: 0 }, capacity: 900 },
  extractor: { cost: { wood: 100, ore: 90, crystal: 15 }, normalGather: 1.15, overchargeGather: 1.9, incidentSeconds: 12, incidentChance: 0.5, incidentDamage: 75 },
  deepMine: { cost: { wood: 180, ore: 200, crystal: 20 }, yield: 800 },
  specialization: { cost: { wood: 120, ore: 80, crystal: 30 }, radius: 12, mining: 1.3, military: 1.3, research: 1.35 },
  market: { stock: 1500, basePrices: { wood: 1, ore: 1.5, crystal: 3 }, sellFactor: 0.65, recoveryPerSecond: 0.02 },
  raid: { capacity: 24, channelSeconds: 3 },
  salvage: { channelSeconds: 2, expiresSeconds: 120 },
  contract: { amount: 60, deadlineSeconds: 180, reward: { wood: 35, ore: 25, crystal: 10 }, villagePool: { wood: 210, ore: 150, crystal: 60 } }
};
var depot = (kind, name, cost5, hp, buildTime, description) => ({ id: `economy:${kind}`, name, role: "depot", cost: { ...cost5 }, hp, size: 2, buildTime, sight: 7, description });
var ECONOMY_BUILDINGS = {
  warehouse: depot("warehouse", "Regional warehouse", ECONOMY_RULES.warehouse.cost, 720, 26, "Holds 900 local resources. Assigned workers deposit here; caravans move stock to other settlements."),
  extractor: depot("extractor", "Crystal extractor", ECONOMY_RULES.extractor.cost, 650, 30, "Nearby crystal workers harvest faster. Overcharge increases output but can damage the extractor every 12 seconds."),
  "deep-mine": depot("deep-mine", "Deep mine", ECONOMY_RULES.deepMine.cost, 800, 38, "Extends one depleted ore deposit with a finite reserve of up to 800 ore.")
};
var ECONOMY_CARAVAN = { id: "economy:caravan", name: "Trade caravan", role: "worker", cost: { ...ECONOMY_RULES.caravan.cost }, hp: 150, damage: 0, armor: 1, range: 0, speed: 1.8, cooldown: 2, trainTime: ECONOMY_RULES.caravan.trainSeconds, sight: 6, description: "Carries up to 90 resources on physical delivery and trade routes. Losing the caravan drops its remaining cargo." };

// src/core/legacy-content-v3.ts
var ECONOMY2 = { harvestPerSecond: 2.28 };
var unit3 = (id5, name, role, wood, ore, hp, damage2, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id5, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage: damage2, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building3 = (id5, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id: id5, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
var BASE_FACTIONS2 = {
  orcs: { id: "orcs", name: "Ironclad", subtitle: "Strength in the struggle", color: 13662021, accent: "#dba35d", description: "Armored warbands gather fury as they fight. Hold the line, build momentum, and break the enemy stronghold.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit3("orc-worker", "Scrapper", "worker", 50, 0, 85, 5, 1, 1.3, 2.1, 1.4, 12, void 0, "Harvest timber, ore and crystal. Raise and repair your settlement."),
    melee: unit3("orc-melee", "Ironjaw", "melee", 70, 25, 175, 15, 3, 1.4, 1.8, 1.15, 36, "momentum", "Armored front line. Sustained attacks build Fury, granting up to 40% damage and 15% attack speed."),
    ranged: unit3("orc-ranged", "Boltspitter", "ranged", 85, 35, 100, 15, 1, 6.5, 2, 1.5, 40, "momentum", "Crossbow volleys punish exposed enemies. Builds Fury with each hit."),
    special: unit3("orc-special", "Wardrum", "special", 120, 70, 190, 21, 3, 1.6, 1.65, 1.65, 56, "momentum", "Heavy shock infantry. Fury makes prolonged brawls devastating.")
  }, buildings: {
    hq: building3("orc-hq", "Iron Hall", "hq", 240, 120, 1800, 3, 55, "Your stronghold. Trains Scrappers and supports 12 population."),
    depot: building3("orc-depot", "Timber Yard", "depot", 100, 0, 600, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building3("orc-barracks", "War Foundry", "barracks", 160, 50, 950, 3, 35, "Trains Ironjaws, Boltspitters, and Wardrums."),
    tower: building3("orc-tower", "Watchtower", "tower", 120, 80, 750, 2, 30, "Defends nearby ground with heavy bolts.")
  } },
  fairies: { id: "fairies", name: "Wild Court", subtitle: "The forest remembers", color: 7395517, accent: "#a1e1c6", description: "Swift woodland defenders weave deceptive doubles and recover beneath healing groves. Strike, vanish, and return.", ai: { aggression: 0.9, armySize: 10, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit3("fairy-worker", "Tender", "worker", 50, 0, 65, 4, 0, 1.3, 2.5, 1.3, 12, void 0, "Gather timber, ore and crystal. Cultivate the living buildings of the Court."),
    melee: unit3("fairy-melee", "Thornblade", "melee", 65, 25, 140, 17, 2, 1.5, 2.75, 1, 34, void 0, "Swift spear guardians. Reposition quickly and protect fragile casters."),
    ranged: unit3("fairy-ranged", "Mothbow", "ranged", 80, 40, 85, 18, 0, 7, 2.6, 1.4, 40, void 0, "Long-range arrows and quick wings reward careful positioning."),
    special: unit3("fairy-special", "Veilweaver", "special", 110, 75, 105, 13, 1, 5, 2.5, 1.5, 56, "illusion", "Conjures temporary doubles to draw enemy attacks. Activate with Q.")
  }, buildings: {
    hq: building3("fairy-hq", "Elderheart", "hq", 240, 120, 1650, 3, 55, "The heart of your settlement. Trains Tenders and supports 12 population."),
    depot: building3("fairy-depot", "Moonwell", "depot", 100, 0, 520, 2, 22, "Resource drop-off. Passively heals nearby friendly units at 2.5 HP/s within 6 tiles. Adds 10 population capacity.", "heal"),
    barracks: building3("fairy-barracks", "Bloomspire", "barracks", 160, 50, 800, 3, 35, "Trains Thornblades, Mothbows, and Veilweavers."),
    tower: building3("fairy-tower", "Thornwatch", "tower", 120, 80, 650, 2, 30, "A living defensive spire that guards the surrounding grove.")
  } },
  dwarves: { id: "dwarves", name: "Deepforge", subtitle: "Choose the ground. Hold it.", color: 15185233, accent: "#edc675", description: "Engineers prepare firing positions. Emplace your troops for protection and cannon range, then pack up to advance.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.4, ranged: 0.35, special: 0.25 } }, units: {
    worker: unit3("dwarf-worker", "Mason", "worker", 50, 0, 80, 5, 1, 1.3, 2.1, 1.4, 12, void 0, "Gather wood, ore and crystal. Construct and repair the Deepforge settlement."),
    melee: unit3("dwarf-melee", "Shieldguard", "melee", 70, 30, 170, 15, 3, 1.4, 1.9, 1.15, 35, "entrench", "Protect the gun line. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up."),
    ranged: unit3("dwarf-ranged", "Thunderlock", "ranged", 85, 40, 95, 20, 1, 6.5, 2, 1.7, 40, "entrench", "Musket infantry. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up."),
    special: { ...unit3("dwarf-special", "Siege Cannon", "special", 130, 85, 145, 32, 2, 6, 1.45, 2.6, 58, "entrench", "Long-range artillery deals 80% bonus damage to buildings. Q emplaces: after 3 seconds, gain 3 range, 2 armor and 15% damage. Movement packs up."), sight: 11, buildingDamageMultiplier: 1.8 }
  }, buildings: {
    hq: building3("dwarf-hq", "Mountain Keep", "hq", 240, 120, 1800, 3, 55, "Your stronghold. Trains Masons and supports 12 population."),
    depot: building3("dwarf-depot", "Supply Vault", "depot", 100, 0, 620, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building3("dwarf-barracks", "Gunsmith Hall", "barracks", 160, 50, 950, 3, 35, "Trains Shieldguards, Thunderlocks and Siege Cannons."),
    tower: building3("dwarf-tower", "Gun Bastion", "tower", 120, 80, 800, 2, 30, "A stone gun emplacement that protects your prepared position.")
  } },
  undead: { id: "undead", name: "Ashen Host", subtitle: "The fallen march again", color: 11049433, accent: "#c5b5ed", description: "Expendable ranks screen the Gravecaller, who consumes nearby corpses to raise temporary warriors. Protect your casters to sustain the attack.", ai: { aggression: 1.1, armySize: 11, composition: { melee: 0.55, ranged: 0.3, special: 0.15 } }, units: {
    worker: unit3("undead-worker", "Gravedigger", "worker", 50, 0, 60, 4, 0, 1.3, 2.3, 1.3, 12, void 0, "Gather wood, ore and crystal. Raise and repair the necropolis."),
    melee: unit3("undead-melee", "Boneguard", "melee", 45, 15, 115, 14, 1, 1.4, 2.35, 1, 24, void 0, "Cheap, fragile infantry. Fallen mortal troops leave corpses for Gravecallers."),
    ranged: unit3("undead-ranged", "Gravebow", "ranged", 65, 30, 80, 17, 0, 6.5, 2.25, 1.4, 32, void 0, "Brittle archers. Keep a screen of Boneguards between them and the enemy."),
    special: unit3("undead-special", "Gravecaller", "special", 110, 80, 95, 12, 0, 5.5, 2.1, 1.6, 48, "raise", "Automatically (or Q) consumes up to 2 corpses within 6 tiles, raising half-health Boneguards for 35 seconds. 22s cooldown. Raised troops use population and cannot be raised again.")
  }, buildings: {
    hq: building3("undead-hq", "Necropolis", "hq", 240, 120, 1650, 3, 55, "Your stronghold. Trains Gravediggers and supports 12 population."),
    depot: building3("undead-depot", "Ossuary", "depot", 100, 0, 500, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building3("undead-barracks", "Crypt", "barracks", 160, 50, 800, 3, 35, "Trains Boneguards, Gravebows and Gravecallers."),
    tower: building3("undead-tower", "Soul Spire", "tower", 120, 80, 650, 2, 30, "A funerary spire that fires at intruders.")
  } },
  tideborn: { id: "tideborn", terrainSpeeds: { mud: 1.1, shallows: 1.1 }, name: "Tideborn", subtitle: "Follow the returning tide", color: 5744547, accent: "#e2b897", description: "Amphibious defenders cross mud and shallows at full speed. Tidecallers heal their formation and send it forward in a surge.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit3("tideborn-worker", "Reef Tender", "worker", 50, 0, 70, 4, 0, 1.3, 2.3, 1.3, 12, void 0, "Gather wood, ore and crystal. Cross mud and shallows without slowing."),
    melee: unit3("tideborn-melee", "Shellguard", "melee", 70, 25, 170, 16, 3, 1.4, 2.15, 1.15, 35, void 0, "Shell-armored infantry. Wet ground gives this steady formation a route around slower enemies."),
    ranged: unit3("tideborn-ranged", "Harpooner", "ranged", 80, 35, 90, 20, 0, 6.5, 2.3, 1.45, 38, void 0, "Harpoons strike from behind the Shellguard line. Moves freely through mud and shallows."),
    special: unit3("tideborn-special", "Tidecaller", "special", 110, 75, 115, 11, 1, 5.5, 2.2, 1.6, 54, "surge", "Q restores 35 HP to nearby allies and grants 25% movement speed for 6 seconds. 20s cooldown. Casts automatically when nearby allies are wounded in combat.")
  }, buildings: {
    hq: building3("tideborn-hq", "Coral Hold", "hq", 240, 120, 1700, 3, 55, "Trains Reef Tenders and supports 12 population."),
    depot: building3("tideborn-depot", "Tidal Basin", "depot", 100, 0, 560, 2, 22, "Resource drop-off for wood, ore and crystal. Adds 10 population capacity."),
    barracks: building3("tideborn-barracks", "Reef Lodge", "barracks", 160, 50, 860, 3, 35, "Trains Shellguards, Harpooners and Tidecallers."),
    tower: building3("tideborn-tower", "Conch Spire", "tower", 120, 80, 700, 2, 30, "A fortified conch that fires at nearby invaders.")
  } },
  automata: { id: "automata", name: "Automata", subtitle: "Repair. Recharge. Return.", color: 11967209, accent: "#d8cbb0", description: "Ceramic machines carry shields that recharge after six seconds without damage. Ward Engines restore shields to sustain the formation.", ai: { aggression: 0.95, armySize: 8, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: { ...unit3("automata-worker", "Assembler", "worker", 50, 0, 55, 4, 0, 1.3, 2.15, 1.4, 12, void 0, "Gather wood, ore and crystal. Carries a 12-point rechargeable shield."), shield: 12 },
    melee: { ...unit3("automata-melee", "Sentinel", "melee", 70, 25, 135, 15, 2, 1.4, 1.95, 1.2, 35, void 0, "A 45-point shield absorbs damage before ceramic armor takes harm. Shields recharge at 4/s after 6 seconds without damage."), shield: 45 },
    ranged: { ...unit3("automata-ranged", "Prism Archer", "ranged", 85, 40, 75, 19, 0, 7, 2.1, 1.6, 42, void 0, "Crystal beams reach across the front line. Carries a 35-point rechargeable shield."), shield: 35 },
    special: { ...unit3("automata-special", "Ward Engine", "special", 120, 80, 135, 12, 2, 5, 1.8, 1.7, 56, "ward", "Q restores 24 shield to nearby friendly machines. Casts automatically when shields are damaged. 20s cooldown. Carries a 45-point shield."), shield: 45 }
  }, buildings: {
    hq: building3("automata-hq", "Core Foundry", "hq", 240, 120, 1750, 3, 55, "Trains Assemblers and supports 12 population."),
    depot: building3("automata-depot", "Crystal Depot", "depot", 100, 0, 580, 2, 22, "Resource drop-off for wood, ore and crystal. Adds 10 population capacity."),
    barracks: building3("automata-barracks", "Assembly Hall", "barracks", 160, 50, 900, 3, 35, "Trains Sentinels, Prism Archers and Ward Engines."),
    tower: building3("automata-tower", "Prism Tower", "tower", 120, 80, 740, 2, 30, "Focused crystal beams defend the foundry.")
  } }
};
var expansionNames2 = {
  orcs: ["Boar Rider", "Pikejaw", "Iron Catapult"],
  fairies: ["Stag Rider", "Briar Pike", "Thorn Trebuchet"],
  dwarves: ["Mountain Rider", "Deep Pike", "Stone Thrower"],
  undead: ["Dread Rider", "Bone Pike", "Grave Catapult"],
  tideborn: ["Shell Rider", "Reef Pike", "Coral Mangonel"],
  automata: ["Strider", "Lance Sentinel", "Siege Engine"]
};
var FACTIONS2 = Object.fromEntries(Object.entries(BASE_FACTIONS2).map(([id5, base]) => {
  const faction = id5, prefix = base.units.worker.id.split("-")[0], names = expansionNames2[faction];
  return [id5, { ...base, buildings: {
    ...base.buildings,
    wall: { ...building3(`${prefix}-wall`, "Stone Wall", "wall", 30, 25, 1100, 1, 15, "A durable barrier. Siege engines break walls quickly."), age: 2 },
    gate: { ...building3(`${prefix}-gate`, "Town Gate", "gate", 90, 65, 1400, 2, 28, "Open to let armies pass. An open gate also admits enemies. Cannot close on a unit."), age: 2 }
  }, units: {
    ...base.units,
    special: { ...base.units.special, age: 2 },
    cavalry: { ...unit3(`${prefix}-cavalry`, names[0], "cavalry", 100, 65, 210, 18, 2, 1.5, 3.5, 1.3, 42, void 0, "Fast raider. Strong against ranged troops; vulnerable to pikes."), age: 2, bonusAgainst: { ranged: 1.7 } },
    spear: { ...unit3(`${prefix}-spear`, names[1], "spear", 55, 25, 125, 11, 1, 1.9, 2.1, 1.25, 28, void 0, "Long pike infantry. Deals triple damage to cavalry."), age: 1, bonusAgainst: { cavalry: 3 } },
    siege: { ...unit3(`${prefix}-siege`, names[2], "siege", 180, 140, 185, 28, 2, 8.5, 1.05, 3.8, 65, void 0, "Long-range siege engine. Deals quadruple damage to buildings. Protect it from raiders."), age: 3, cost: { wood: 180, ore: 140, crystal: 25 }, buildingDamageMultiplier: 4, sight: 11 }
  } }];
}));
var ABILITIES2 = {
  surge: { name: "Returning Tide", description: "Restore 35 HP to allies within 5 tiles and grant 25% movement speed for 6 seconds.", cooldown: 20 },
  ward: { name: "Restore Wards", description: "Restore 24 shield to friendly machines within 5 tiles.", cooldown: 20 },
  entrench: { name: "Emplace / Pack up", description: "Hold position and prepare for 3 seconds to gain armor and damage. Cannons also gain range. Movement cancels emplacement.", cooldown: 0 },
  raise: { name: "Raise Fallen", description: "Consume up to two nearby corpses to raise temporary Boneguards. Requires free population.", cooldown: 22 },
  momentum: { name: "War Cry", description: "Build a burst of Fury. Sustained attacks keep the momentum alive.", cooldown: 25 },
  illusion: { name: "Veil Doubles", description: "Conjure two short-lived doubles that draw attacks and deal reduced damage.", cooldown: 35 },
  heal: { name: "Renewal", description: "Restore health to nearby friendly units.", cooldown: 18 }
};
var UPGRADES2 = {
  "town-age": { id: "town-age", name: "Town Age", description: "Unlock advanced troops, fortifications and expansion strongholds.", cost: { wood: 260, ore: 180, crystal: 0 }, researchTime: 65, building: "hq", appliesTo: "worker", advancesTo: 2, effects: {} },
  "citadel-age": { id: "citadel-age", name: "Citadel Age", description: "Unlock siege engines and veteran military technology.", cost: { wood: 420, ore: 320, crystal: 60 }, researchTime: 90, building: "hq", appliesTo: "worker", age: 2, requires: ["town-age"], advancesTo: 3, effects: {} },
  "forged-weapons": { id: "forged-weapons", name: "Forged Weapons", description: "Melee troops deal 20% more damage.", cost: { wood: 100, ore: 130, crystal: 0 }, researchTime: 35, building: "barracks", appliesTo: "melee", age: 2, effects: { damage: 1.2 } },
  "tempered-armor": { id: "tempered-armor", name: "Tempered Armor", description: "Melee troops gain 2 armor.", cost: { wood: 80, ore: 150, crystal: 0 }, researchTime: 40, building: "barracks", appliesTo: "melee", age: 2, effects: { armor: 2 } },
  "veteran-arms": { id: "veteran-arms", name: "Veteran Arms", description: "Melee troops deal another 25% damage.", cost: { wood: 160, ore: 220, crystal: 35 }, researchTime: 50, building: "barracks", appliesTo: "melee", age: 3, requires: ["forged-weapons"], effects: { damage: 1.25 } },
  "worker-harvest": { id: "worker-harvest", name: "Harvest Drills", description: "Workers gather 30% faster.", cost: { wood: 100, ore: 50, crystal: 0 }, researchTime: 30, building: "hq", appliesTo: "worker", effects: { gather: 1.3 } },
  "worker-speed": { id: "worker-speed", name: "Courier Training", description: "Workers move 20% faster.", cost: { wood: 75, ore: 50, crystal: 0 }, researchTime: 25, building: "hq", appliesTo: "worker", effects: { speed: 1.2 } }
};

// src/core/content-registry.ts
var CONTENT_ENGINE_VERSION = 3;
var MAX_BUNDLE_BYTES = 4 * 1024 * 1024;
var MAX_CONTENT_BYTES = 2 * 1024 * 1024;
var unitRoles = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var buildingRoles = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var builtinIds = Object.keys(FACTIONS);
var caches = /* @__PURE__ */ new WeakMap();
function fail(path, message4) {
  throw new Error(`Invalid content at ${path}: ${message4}.`);
}
function obj(input, path, required, optional = []) {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(path, "expected a plain object");
  const value2 = input;
  if (Object.getOwnPropertySymbols(value2).length) fail(path, "symbol fields are unsupported");
  for (const key of Object.keys(value2)) {
    const descriptor = Object.getOwnPropertyDescriptor(value2, key);
    if (!descriptor || !("value" in descriptor)) fail(`${path}.${key}`, "accessors are unsupported");
  }
  for (const key of required) if (!Object.hasOwn(value2, key)) fail(`${path}.${key}`, "missing field");
  for (const key of Object.keys(value2)) if (!required.includes(key) && !optional.includes(key)) fail(`${path}.${key}`, "unsupported field");
  return value2;
}
function num(v, path, min, max, integer2 = false) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer2 && !Number.isSafeInteger(v)) fail(path, `expected ${integer2 ? "a whole" : "a finite"} number from ${min} to ${max}`);
  return v;
}
function str(v, path, max = 200) {
  if (typeof v !== "string" || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) fail(path, "expected text");
  return v;
}
function arr(v, path, max) {
  if (!Array.isArray(v) || v.length > max) fail(path, `expected at most ${max} entries`);
  for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, i)) fail(path, "sparse arrays are not supported");
  else if (!("value" in Object.getOwnPropertyDescriptor(v, String(i)))) fail(path, "array accessors are unsupported");
  return v;
}
function one(v, path, choices) {
  if (typeof v !== "string" || !choices.includes(v)) fail(path, "unsupported value");
  return v;
}
function definitionId(v, path, namespace) {
  const value2 = str(v, path, 100);
  if (!/^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(value2) || namespace && !value2.startsWith(`${namespace}:`)) fail(path, `expected a namespaced definition ID${namespace ? ` owned by ${namespace}` : ""}`);
  return value2;
}
function cost(v, path) {
  const value2 = obj(v, path, ["wood", "ore", "crystal"]);
  for (const key of ["wood", "ore", "crystal"]) num(value2[key], `${path}.${key}`, 0, 1e5);
}
function unit4(v, path, namespace) {
  const value2 = obj(v, path, ["id", "name", "role", "cost", "hp", "damage", "armor", "range", "speed", "cooldown", "trainTime", "sight", "description"], ["shield", "buildingDamageMultiplier", "age", "bonusAgainst", "ability", "tags"]);
  definitionId(value2.id, `${path}.id`, namespace);
  str(value2.name, `${path}.name`);
  str(value2.description, `${path}.description`, 2e3);
  one(value2.role, `${path}.role`, unitRoles);
  cost(value2.cost, `${path}.cost`);
  for (const [key, min, max] of [["hp", 1, 1e5], ["damage", 0, 1e4], ["armor", 0, 1e3], ["range", 0.5, 30], ["speed", 0.1, 10], ["cooldown", 0.05, 60], ["trainTime", 0.05, 600], ["sight", 1, 30]]) num(value2[key], `${path}.${key}`, min, max);
  if (value2.shield !== void 0) num(value2.shield, `${path}.shield`, 0, 1e5);
  if (value2.buildingDamageMultiplier !== void 0) num(value2.buildingDamageMultiplier, `${path}.buildingDamageMultiplier`, 0.1, 10);
  if (value2.age !== void 0) num(value2.age, `${path}.age`, 1, 3, true);
  if (value2.ability !== void 0) {
    one(value2.ability, `${path}.ability`, Object.keys(ABILITIES));
    if (["incendiary-shell", "rooting-shell", "ammunition-cannon", "corpse-shell", "flood-shell", "powered-beam"].includes(value2.ability) && value2.role !== "siege") fail(`${path}.ability`, "artillery preparation requires the siege role");
  }
  if (value2.tags !== void 0) arr(value2.tags, `${path}.tags`, 2).forEach((tag, i) => one(tag, `${path}.tags[${i}]`, ["hero", "engineer"]));
  if (value2.bonusAgainst !== void 0) {
    const bonuses = obj(value2.bonusAgainst, `${path}.bonusAgainst`, [], unitRoles);
    for (const [key, factor] of Object.entries(bonuses)) num(factor, `${path}.bonusAgainst.${key}`, 0.1, 10);
  }
}
function building4(v, path, namespace) {
  const value2 = obj(v, path, ["id", "name", "role", "cost", "hp", "size", "buildTime", "sight", "description"], ["age", "ability", "tags"]);
  definitionId(value2.id, `${path}.id`, namespace);
  str(value2.name, `${path}.name`);
  str(value2.description, `${path}.description`, 2e3);
  one(value2.role, `${path}.role`, buildingRoles);
  cost(value2.cost, `${path}.cost`);
  for (const [key, min, max] of [["hp", 1, 1e5], ["size", 1, 6], ["buildTime", 0.05, 600], ["sight", 1, 30]]) num(value2[key], `${path}.${key}`, min, max, key === "size");
  if (value2.tags !== void 0) arr(value2.tags, `${path}.tags`, 2).forEach((tag, i) => one(tag, `${path}.tags[${i}]`, ["beacon", "barricade"]));
  if (value2.age !== void 0) num(value2.age, `${path}.age`, 1, 3, true);
  if (value2.ability !== void 0) one(value2.ability, `${path}.ability`, ["heal"]);
}
function research(v, path, namespace) {
  const value2 = obj(v, path, ["id", "name", "description", "cost", "researchTime", "building", "appliesTo", "effects"], ["age", "requires", "exclusiveGroup", "appliesToDefinitions"]);
  definitionId(value2.id, `${path}.id`, namespace);
  str(value2.name, `${path}.name`);
  str(value2.description, `${path}.description`, 2e3);
  cost(value2.cost, `${path}.cost`);
  num(value2.researchTime, `${path}.researchTime`, 0.05, 600);
  one(value2.building, `${path}.building`, buildingRoles);
  one(value2.appliesTo, `${path}.appliesTo`, unitRoles);
  if (value2.age !== void 0) num(value2.age, `${path}.age`, 1, 3, true);
  if (value2.requires !== void 0) arr(value2.requires, `${path}.requires`, 16).forEach((id5, i) => str(id5, `${path}.requires[${i}]`, 100));
  if (value2.exclusiveGroup !== void 0) definitionId(value2.exclusiveGroup, `${path}.exclusiveGroup`, namespace);
  if (value2.appliesToDefinitions !== void 0) {
    const targets = arr(value2.appliesToDefinitions, `${path}.appliesToDefinitions`, 64);
    if (!targets.length) fail(`${path}.appliesToDefinitions`, "at least one definition target is required");
    targets.forEach((id5, i) => str(id5, `${path}.appliesToDefinitions[${i}]`, 100));
    if (new Set(targets).size !== targets.length) fail(`${path}.appliesToDefinitions`, "duplicate definition target");
  }
  const effects = obj(value2.effects, `${path}.effects`, [], ["gather", "speed", "damage", "armor"]);
  if (!Object.keys(effects).length) fail(`${path}.effects`, "research must change a permitted stat");
  for (const [key, factor] of Object.entries(effects)) num(factor, `${path}.effects.${key}`, key === "armor" ? 0 : 0.1, key === "armor" ? 10 : 3);
}
function canonicalContent(value2) {
  if (value2 === null || typeof value2 !== "object") return JSON.stringify(value2);
  if (Array.isArray(value2)) return `[${value2.map(canonicalContent).join(",")}]`;
  return `{${Object.keys(value2).filter((key) => value2[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonicalContent(value2[key])}`).join(",")}}`;
}
function contentHash(value2) {
  const bytes = new TextEncoder().encode(canonicalContent(value2)), length2 = bytes.length;
  const padded = new Uint8Array(Math.ceil((length2 + 9) / 64) * 64);
  padded.set(bytes);
  padded[length2] = 128;
  const data = new DataView(padded.buffer);
  data.setUint32(padded.length - 8, Math.floor(length2 * 8 / 4294967296));
  data.setUint32(padded.length - 4, length2 * 8);
  const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  const k = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
  const rotate = (v, n) => v >>> n | v << 32 - n, w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = data.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a2 = w[i - 15], b2 = w[i - 2];
      w[i] = w[i - 16] + (rotate(a2, 7) ^ rotate(a2, 18) ^ a2 >>> 3) + w[i - 7] + (rotate(b2, 17) ^ rotate(b2, 19) ^ b2 >>> 10);
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const first = j + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + k[i] + w[i] | 0, second = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c) | 0;
      j = g;
      g = f;
      f = e;
      e = d + first | 0;
      d = c;
      c = b;
      b = a;
      a = first + second | 0;
    }
    for (const [i, v] of [a, b, c, d, e, f, g, j].entries()) h[i] = h[i] + v | 0;
  }
  return h.map((value3) => (value3 >>> 0).toString(16).padStart(8, "0")).join("");
}
var BASE_CONTENT_HASH = contentHash({ FACTIONS, UPGRADES, ECONOMY, ABILITIES, BUILTIN_EXTRA_DEFINITIONS, BUILTIN_EXTRA_ART, ECONOMY_BUILDINGS, ECONOMY_CARAVAN });
function unsigned(input) {
  const { hash: _, ...value2 } = input;
  return value2;
}
function freeze(value2) {
  if (value2 && typeof value2 === "object") {
    for (const child of Object.values(value2)) freeze(child);
    Object.freeze(value2);
  }
  return value2;
}
function decodeContentPackage(input) {
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).length > MAX_CONTENT_BYTES) fail("package", "file exceeds 2 MiB");
    try {
      input = JSON.parse(input);
    } catch {
      fail("package", "expected valid JSON");
    }
  }
  const p = obj(input, "package", ["format", "schemaVersion", "engineVersion", "id", "version", "name", "dependencies", "factions", "art", "hash"]);
  if (p.format !== "orcs-vs-fairies-mod" || p.schemaVersion !== 1 || p.engineVersion !== CONTENT_ENGINE_VERSION) fail("package", "unsupported format, schema or engine version");
  const namespace = str(p.id, "package.id", 40);
  if (["core", "economy", "builtin"].includes(namespace)) fail("package.id", "reserved built-in namespace");
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(namespace)) fail("package.id", "expected a lowercase package ID");
  if (!/^\d+\.\d+\.\d+$/.test(str(p.version, "package.version", 30))) fail("package.version", "expected an exact semantic version");
  str(p.name, "package.name");
  arr(p.dependencies, "package.dependencies", 16).forEach((v, i) => {
    const d = obj(v, `package.dependencies[${i}]`, ["id", "version", "hash"]);
    str(d.id, `dependency[${i}].id`, 40);
    str(d.version, `dependency[${i}].version`, 30);
    if (!/^[a-f0-9]{64}$/.test(str(d.hash, `dependency[${i}].hash`, 64))) fail(`dependency[${i}].hash`, "expected SHA-256");
  });
  const factions2 = arr(p.factions, "package.factions", 16);
  if (!factions2.length) fail("package.factions", "at least one faction is required");
  factions2.forEach((v, i) => {
    const path = `package.factions[${i}]`, f = obj(v, path, ["id", "baseFaction", "name", "subtitle", "description", "color", "accent", "units", "buildings", "research"], ["defaultUnits", "defaultBuildings"]);
    definitionId(f.id, `${path}.id`, namespace);
    one(f.baseFaction, `${path}.baseFaction`, builtinIds);
    for (const key of ["name", "subtitle", "description"]) str(f[key], `${path}.${key}`, key === "description" ? 2e3 : 200);
    num(f.color, `${path}.color`, 0, 16777215, true);
    if (!/^#[a-fA-F0-9]{6}$/.test(str(f.accent, `${path}.accent`, 7))) fail(`${path}.accent`, "expected a six-digit color");
    arr(f.units, `${path}.units`, 64).forEach((v2, j) => unit4(v2, `${path}.units[${j}]`, namespace));
    arr(f.buildings, `${path}.buildings`, 32).forEach((v2, j) => building4(v2, `${path}.buildings[${j}]`, namespace));
    arr(f.research, `${path}.research`, 64).forEach((v2, j) => research(v2, `${path}.research[${j}]`, namespace));
    for (const [field, roles3] of [["defaultUnits", unitRoles], ["defaultBuildings", buildingRoles]]) if (f[field] !== void 0) {
      const defaults = obj(f[field], `${path}.${field}`, [], roles3);
      for (const [role, id5] of Object.entries(defaults)) definitionId(id5, `${path}.${field}.${role}`);
    }
  });
  const art = obj(p.art, "package.art", [], Object.keys(p.art && typeof p.art === "object" ? p.art : {}));
  if (Object.keys(art).length > 128) fail("package.art", "too many assets");
  let pixels = 0;
  for (const [id5, input2] of Object.entries(art)) {
    definitionId(id5, `package.art.${id5}`, namespace);
    const a = obj(input2, `package.art.${id5}`, ["path", "svg", "width", "height", "anchor"], ["visualTop"]);
    const path = str(a.path, `package.art.${id5}.path`, 300);
    if (!/^\/mods\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(path) || !path.startsWith(`/mods/${namespace}/`)) fail(`package.art.${id5}.path`, "expected a packaged SVG under its own /mods directory");
    if (typeof a.svg !== "string" || a.svg.length > 1e5 || !a.svg.trim()) fail(`art.${id5}.svg`, "expected SVG source under 100000 characters");
    const svg2 = a.svg;
    if (!/^<svg\s/.test(svg2) || !/<\/svg>\s*$/.test(svg2) || /<(?:script|foreignObject|iframe|image|use|a|style|animate|set)\b|\bon[a-z]+\s*=|\bhref\s*=|\bstyle\s*=|&#|url\s*\(|<!|<\?/i.test(svg2.replace(/url\(#[a-zA-Z][a-zA-Z0-9-]*\)/g, ""))) fail(`art.${id5}.svg`, "only self-contained static SVG is permitted");
    for (const tag of svg2.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g)) if (!["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc", "defs", "linearGradient", "radialGradient", "stop"].includes(tag[1])) fail(`art.${id5}.svg`, `unsupported SVG element ${tag[1]}`);
    num(a.width, `art.${id5}.width`, 8, 512, true);
    num(a.height, `art.${id5}.height`, 8, 512, true);
    pixels += a.width * a.height;
    if (pixels > 4 * 1024 * 1024) fail("package.art", "decoded artwork exceeds 16 MiB");
    const anchor = arr(a.anchor, `art.${id5}.anchor`, 2);
    if (anchor.length !== 2) fail(`art.${id5}.anchor`, "expected two coordinates");
    num(anchor[0], `art.${id5}.anchor[0]`, 0, a.width);
    num(anchor[1], `art.${id5}.anchor[1]`, 0, a.height);
    if (a.visualTop !== void 0) num(a.visualTop, `art.${id5}.visualTop`, 0, a.height);
  }
  if (!/^[a-f0-9]{64}$/.test(str(p.hash, "package.hash", 64)) || p.hash !== contentHash(unsigned(p))) fail("package.hash", "SHA-256 does not match the manifest");
  if (new TextEncoder().encode(canonicalContent(p)).length > MAX_CONTENT_BYTES) fail("package", "file exceeds 2 MiB");
  return freeze(JSON.parse(JSON.stringify(p)));
}
var PINNED_BASE_FACTIONS = freeze(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS).map(([id5, f]) => [id5, { ...f, unitDefinitions: [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[id5].units, ECONOMY_CARAVAN], buildingDefinitions: [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[id5].buildings, ...Object.values(ECONOMY_BUILDINGS)] }])))));
var PINNED_BASE_RESEARCH = freeze(JSON.parse(JSON.stringify(UPGRADES)));
var CURRENT_BASE = { factions: PINNED_BASE_FACTIONS, art: BUILTIN_EXTRA_ART, research: PINNED_BASE_RESEARCH };
var LEGACY_BASE_CONTENT_HASH = contentHash({ FACTIONS: FACTIONS2, UPGRADES: UPGRADES2, ECONOMY: ECONOMY2, ABILITIES: ABILITIES2 });
var LEGACY_BASE = freeze({ factions: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS2).map(([id5, f]) => [id5, { ...f, unitDefinitions: Object.values(f.units), buildingDefinitions: Object.values(f.buildings) }])))), art: {}, research: JSON.parse(JSON.stringify(UPGRADES2)) });
function buildRegistry(packages, baseRegistry = CURRENT_BASE) {
  const factions2 = { ...baseRegistry.factions }, art = { ...baseRegistry.art }, ids = /* @__PURE__ */ new Set(), byId = new Map(packages.map((p) => [p.id, p]));
  if (byId.size !== packages.length) fail("bundle.packages", "two versions of one package cannot share a match");
  const visited = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set();
  const visit = (p) => {
    if (visiting.has(p.id)) fail("dependencies", `cycle includes ${p.id}`);
    if (visited.has(p.id)) return;
    visiting.add(p.id);
    const deps = /* @__PURE__ */ new Set();
    for (const d of p.dependencies) {
      if (deps.has(d.id)) fail("dependencies", `duplicate dependency ${d.id}`);
      deps.add(d.id);
      const found = byId.get(d.id);
      if (!found) fail("dependencies", `missing ${d.id}@${d.version}`);
      if (found.version !== d.version || found.hash !== d.hash) fail("dependencies", `incompatible ${d.id}@${d.version}`);
      visit(found);
    }
    visiting.delete(p.id);
    visited.add(p.id);
  };
  packages.forEach(visit);
  for (const p of packages) for (const f of p.factions) {
    if (ids.has(f.id) || Object.hasOwn(factions2, f.id)) fail("definitions", `duplicate ${f.id}`);
    ids.add(f.id);
    const base = baseRegistry.factions[f.baseFaction], units = { ...base.units }, buildings2 = { ...base.buildings };
    for (const d of [...f.units, ...f.buildings, ...f.research]) {
      if (ids.has(d.id)) fail("definitions", `duplicate ${d.id}`);
      ids.add(d.id);
    }
    for (const [role, id5] of Object.entries(f.defaultUnits ?? {})) {
      const d = f.units.find((d2) => d2.id === id5);
      if (!d || d.role !== role) fail("defaultUnits", `${id5} is absent or has another role`);
      units[role] = d;
    }
    for (const [role, id5] of Object.entries(f.defaultBuildings ?? {})) {
      const d = f.buildings.find((d2) => d2.id === id5);
      if (!d || d.role !== role) fail("defaultBuildings", `${id5} is absent or has another role`);
      buildings2[role] = d;
    }
    const targetUnits = [...Object.values(units), ...f.units];
    for (const research2 of f.research) for (const id5 of research2.appliesToDefinitions ?? []) {
      const target = targetUnits.find((unit5) => unit5.id === id5);
      if (!target || target.role !== research2.appliesTo) fail("research.appliesToDefinitions", `${id5} is absent or has another role`);
    }
    const available = new Map([...Object.values(baseRegistry.research), ...f.research].map((d) => [d.id, d])), done = /* @__PURE__ */ new Set(), pending = /* @__PURE__ */ new Set();
    const check = (id5) => {
      if (pending.has(id5)) fail("research", `prerequisite cycle includes ${id5}`);
      if (done.has(id5)) return;
      const d = available.get(id5);
      if (!d) fail("research", `missing prerequisite ${id5}`);
      pending.add(id5);
      for (const dep of d.requires ?? []) check(dep);
      pending.delete(id5);
      done.add(id5);
    };
    f.research.forEach((d) => check(d.id));
    for (const d of [...f.units, ...f.buildings]) if (!Object.hasOwn(p.art, d.id)) fail("art", `missing custom artwork for ${d.id}`);
    factions2[f.id] = freeze({ ...base, ...f, units, buildings: buildings2, unitDefinitions: [...Object.values(units), ...(base.unitDefinitions ?? []).filter((d) => !Object.values(base.units).some((x) => x.id === d.id)), ...f.units.filter((d) => !Object.values(units).some((base2) => base2.id === d.id))], buildingDefinitions: [...Object.values(buildings2), ...(base.buildingDefinitions ?? []).filter((d) => !Object.values(base.buildings).some((x) => x.id === d.id)), ...f.buildings.filter((d) => !Object.values(buildings2).some((base2) => base2.id === d.id))], research: f.research });
    Object.assign(art, p.art);
  }
  if (Object.values(art).reduce((sum, a) => sum + a.width * a.height, 0) > 16 * 1024 * 1024) fail("bundle.art", "decoded artwork exceeds 64 MiB");
  return freeze({ factions: factions2, art, research: baseRegistry.research });
}
function createContentBundle(inputs) {
  if (inputs.length > 32) fail("bundle.packages", "at most 32 packages are supported");
  const packages = inputs.map(decodeContentPackage).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const registry2 = buildRegistry(packages);
  const body = { format: "orcs-vs-fairies-content", schemaVersion: 1, engineVersion: CONTENT_ENGINE_VERSION, baseHash: BASE_CONTENT_HASH, packages };
  if (new TextEncoder().encode(canonicalContent(body)).length > MAX_BUNDLE_BYTES) fail("bundle", "pinned package closure exceeds 4 MiB");
  const bundle = freeze({ ...body, hash: contentHash(body) });
  caches.set(bundle, registry2);
  return bundle;
}
function decodeContentBundle(input) {
  const value2 = obj(input, "bundle", ["format", "schemaVersion", "engineVersion", "baseHash", "packages", "hash"]);
  if (value2.format !== "orcs-vs-fairies-content" || value2.schemaVersion !== 1 || value2.engineVersion !== CONTENT_ENGINE_VERSION) fail("bundle", "unsupported content version");
  if (value2.baseHash !== BASE_CONTENT_HASH) fail("bundle.baseHash", "built-in content differs from this build");
  const bundle = createContentBundle(arr(value2.packages, "bundle.packages", 32));
  if (value2.hash !== bundle.hash) fail("bundle.hash", "SHA-256 does not match admitted packages");
  return bundle;
}
function decodeHistoricalContentBundle(input) {
  const value2 = obj(input, "bundle", ["format", "schemaVersion", "engineVersion", "baseHash", "packages", "hash"]);
  if (value2.baseHash === BASE_CONTENT_HASH) return decodeContentBundle(input);
  if (value2.format !== "orcs-vs-fairies-content" || value2.schemaVersion !== 1 || value2.engineVersion !== CONTENT_ENGINE_VERSION) fail("bundle", "unsupported content version");
  if (value2.baseHash !== LEGACY_BASE_CONTENT_HASH) fail("bundle.baseHash", "unrecognized historical built-in content");
  const packages = arr(value2.packages, "bundle.packages", 32).map(decodeContentPackage).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const p of packages) for (const f of p.factions) {
    for (const d of f.units) {
      if (d.tags !== void 0 || d.ability !== void 0 && !Object.hasOwn(ABILITIES2, d.ability)) fail("package.units", "definition requires newer built-in rules");
    }
    for (const d of f.buildings) if (d.tags !== void 0) fail("package.buildings", "definition requires newer built-in rules");
    for (const d of f.research) if (d.exclusiveGroup !== void 0 || d.appliesToDefinitions !== void 0) fail("package.research", "definition requires newer built-in rules");
  }
  const body = { format: "orcs-vs-fairies-content", schemaVersion: 1, engineVersion: CONTENT_ENGINE_VERSION, baseHash: LEGACY_BASE_CONTENT_HASH, packages };
  if (new TextEncoder().encode(canonicalContent(body)).length > MAX_BUNDLE_BYTES) fail("bundle", "pinned package closure exceeds 4 MiB");
  if (value2.hash !== contentHash(body)) fail("bundle.hash", "SHA-256 does not match the historical manifest");
  const admitted = freeze({ ...body, hash: value2.hash });
  caches.set(admitted, buildRegistry(packages, LEGACY_BASE));
  return admitted;
}
function migrateHistoricalContentBundle(input) {
  const original = decodeHistoricalContentBundle(input);
  return original.baseHash === BASE_CONTENT_HASH ? original : createContentBundle(original.packages);
}
function registry(state) {
  if (!state.content) return { factions: FACTIONS, art: BUILTIN_EXTRA_ART, research: UPGRADES };
  let value2 = caches.get(state.content);
  if (!value2) {
    const admitted = decodeContentBundle(state.content);
    value2 = caches.get(admitted);
    caches.set(state.content, value2);
  }
  return value2;
}
function contentFactions(content) {
  return content ? registry({ content }).factions : PINNED_BASE_FACTIONS;
}
function factionFor(state, side2) {
  const faction = registry(state).factions[state.players[side2]?.faction];
  if (!faction) throw new Error("Faction is absent from pinned match content.");
  return faction;
}
function availableUnits(state, side2) {
  const f = factionFor(state, side2);
  return [...f.unitDefinitions ?? [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.units ?? []]].filter((d) => !d.id.startsWith("economy:"));
}
function isNormalBuildingDefinition(def) {
  return !def.id.startsWith("economy:") && !def.tags?.includes("barricade") && def.id !== "core:orcs-trophy-standard" && !factionStructureKind(def.id);
}
function availableBuildings(state, side2) {
  const f = factionFor(state, side2);
  return [...f.buildingDefinitions ?? [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.buildings ?? []]].filter((d) => !d.id.startsWith("economy:"));
}
function unitFor(state, subject, role, id5) {
  const side2 = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition2 = typeof subject === "number" ? id5 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side2);
  if (!f) throw new Error("Original unit faction is absent from pinned content.");
  const value2 = definition2 === ECONOMY_CARAVAN.id && !state.content ? ECONOMY_CARAVAN : definition2 ? (f.unitDefinitions ?? [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.units ?? []]).find((d) => d.id === definition2) : f.units[kind];
  if (!value2 || value2.role !== kind) throw new Error(`Unit definition ${definition2 ?? kind} is absent from faction ${f.id}.`);
  return value2;
}
function buildingFor(state, subject, role, id5) {
  const side2 = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition2 = typeof subject === "number" ? id5 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side2);
  if (!f) throw new Error("Original building faction is absent from pinned content.");
  const value2 = (!state.content ? Object.values(ECONOMY_BUILDINGS).find((d) => d.id === definition2) : void 0) ?? (definition2 ? (f.buildingDefinitions ?? [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.buildings ?? []]).find((d) => d.id === definition2) : f.buildings[kind]);
  if (!value2 || value2.role !== kind) throw new Error(`Building definition ${definition2 ?? kind} is absent from faction ${f.id}.`);
  return value2;
}
function entityDefinition(state, entity) {
  return entity.kind === "unit" ? unitFor(state, entity) : buildingFor(state, entity);
}
function upgradesFor(state, side2) {
  return { ...registry(state).research, ...Object.fromEntries((factionFor(state, side2).research ?? []).map((d) => [d.id, d])) };
}
function upgradeFor(state, side2, id5) {
  const d = upgradesFor(state, side2)[id5];
  if (!d) throw new Error(`Research ${id5} is absent from faction content.`);
  return d;
}
function queuedUnitFor(state, producer, index2) {
  return unitFor(state, producer.side, producer.queue[index2], producer.queueDefinitionIds?.[index2]);
}

// src/core/unit-progression.ts
var PROMOTIONS = {
  vanguard: { name: "Vanguard", description: "Deal 15% more damage.", roles: ["melee", "spear"], damage: 1.15 },
  bulwark: { name: "Bulwark", description: "Gain 3 armor.", roles: ["melee", "spear", "cavalry", "special"], armor: 3 },
  skirmisher: { name: "Skirmisher", description: "Move 15% faster.", roles: ["melee", "spear", "special"], speed: 1.15 },
  sharpshooter: { name: "Sharpshooter", description: "Gain 1 weapon range.", roles: ["ranged", "special"], range: 1 },
  pathfinder: { name: "Pathfinder", description: "Move 20% faster.", roles: ["ranged", "cavalry"], speed: 1.2 },
  cavalier: { name: "Cavalier", description: "Deal 20% more damage.", roles: ["cavalry"], damage: 1.2 },
  "siege-master": { name: "Siege Master", description: "Deal 20% more damage.", roles: ["siege"], damage: 1.2 },
  engineer: { name: "Field Engineer", description: "Move 20% faster and gain 1 armor.", roles: ["siege", "worker"], speed: 1.2, armor: 1 },
  medic: { name: "Battle Medic", description: "Gain 2 armor.", roles: ["worker", "special"], armor: 2 }
};
var ARTIFACTS = {
  "core:ember-blade": { name: "Ember Blade", slot: "weapon", roles: ["special", "melee", "cavalry"], damage: 1.25 },
  "core:iron-aegis": { name: "Iron Aegis", slot: "armor", roles: ["special", "melee", "spear", "cavalry"], armor: 4 },
  "core:wind-charm": { name: "Wind Charm", slot: "trinket", roles: ["special", "ranged", "cavalry"], speed: 1.25 }
};
function eligible(e) {
  return e.kind === "unit" && !e.illusion && !e.raised;
}
function veteranRank(experience) {
  return experience >= 200 ? 3 : experience >= 100 ? 2 : experience >= 40 ? 1 : 0;
}
function award(s, e, amount) {
  const v = e.veteran ??= { experience: 0, rank: 0, nextSurvivalAt: s.time + 15, lastCombatAt: s.time, promotions: [] };
  v.experience = Math.min(300, v.experience + amount);
  v.rank = veteranRank(v.experience);
  v.lastCombatAt = s.time;
  const pending = [1, 2, 3].find((rank) => rank <= v.rank && !v.promotions.some((p) => p.rank === rank));
  if (pending) v.pendingPromotion = pending;
}
function creditCombat(s, attacker, target, amount, killed = false, completedAttack = false) {
  if (!eligible(attacker) || attacker.hp <= 0 && !completedAttack || target.illusion || target.raised || s.teams[attacker.side] === s.teams[target.side] || amount <= 0 && !killed) return;
  award(s, attacker, Math.min(30, amount * 0.3) + (killed ? target.kind === "building" ? 25 : target.role === "worker" ? 8 : 18 : 0));
}
function stepVeterans(s) {
  for (const e of s.entities) {
    const v = e.veteran;
    if (!v || !eligible(e) || e.hp <= 0) continue;
    if (s.time >= v.nextSurvivalAt) {
      v.nextSurvivalAt = s.time + 30;
      if (s.time - v.lastCombatAt < 20) award(s, e, 5);
    }
  }
}
function promotionChoices(s, e) {
  if (!e.veteran?.pendingPromotion) return [];
  return Object.keys(PROMOTIONS).filter((id5) => PROMOTIONS[id5].roles.includes(unitFor(s, e).role));
}
function promote(s, side2, id5, promotion) {
  const e = s.entities.find((e2) => e2.id === id5 && e2.side === side2 && e2.hp > 0), v = e?.veteran;
  if (!e || !eligible(e) || !v?.pendingPromotion || !promotionChoices(s, e).includes(promotion)) return false;
  v.promotions.push({ rank: v.pendingPromotion, id: promotion });
  delete v.pendingPromotion;
  const next = [1, 2, 3].find((rank) => rank <= v.rank && !v.promotions.some((p) => p.rank === rank));
  if (next) v.pendingPromotion = next;
  s.events.push({ type: "message", side: side2, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, source: e.id, text: `${unitFor(s, e).name} promoted to ${PROMOTIONS[promotion].name}.` });
  return true;
}
function specialistState(s) {
  return s.specialists ??= { artifacts: [], structures: [], nextArtifactId: 1, nextStructureId: 1 };
}
function equipmentEligible(s, e) {
  return eligible(e) && (e.role === "special" || !!unitFor(s, e).tags?.some((tag) => tag === "hero" || tag === "engineer"));
}
function createArtifact(s, definitionId2, position2) {
  const state = specialistState(s), item = { id: state.nextArtifactId++, definitionId: definitionId2, position: { x: position2.x, y: position2.y, ...position2.level === void 0 ? {} : { level: position2.level } } };
  state.artifacts.push(item);
  return item;
}
function recoverArtifact(s, side2, id5, artifact) {
  const e = s.entities.find((e2) => e2.id === id5 && e2.side === side2 && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact);
  if (!e || !equipmentEligible(s, e) || !item?.position || item.holder !== void 0 || item.owner !== void 0 && item.owner !== side2 || (e.level ?? 0) !== (item.position.level ?? 0) || (s.specialists?.artifacts.filter((a) => a.holder === e.id).length ?? 0) >= 12 || length2D(e.x - item.position.x, e.y - item.position.y) > 2) return false;
  const tile = (item.position.level ?? 0) * s.width * s.height + Math.floor(item.position.y) * s.width + Math.floor(item.position.x);
  if (!s.visible[side2].has(tile)) return false;
  item.owner = side2;
  item.holder = e.id;
  delete item.position;
  return true;
}
function equipArtifact(s, side2, id5, artifact) {
  const e = s.entities.find((e2) => e2.id === id5 && e2.side === side2 && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact), def = item ? ARTIFACTS[item.definitionId] : void 0;
  if (!e || !equipmentEligible(s, e) || !item || !def || item.owner !== side2 || item.holder !== e.id || !def.roles.includes(unitFor(s, e).role)) return false;
  e.equipment ??= {};
  e.equipment[def.slot] = artifact;
  return true;
}
function unequipArtifact(s, side2, id5, slot) {
  const e = s.entities.find((e2) => e2.id === id5 && e2.side === side2 && e2.hp > 0);
  if (!e || !equipmentEligible(s, e) || !e.equipment?.[slot]) return false;
  delete e.equipment[slot];
  return true;
}
function dropArtifacts(s, e) {
  for (const item of s.specialists?.artifacts ?? []) if (item.holder === e.id) {
    delete item.holder;
    delete item.owner;
    item.position = { x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } };
  }
  delete e.equipment;
}
function progressionStats(s, e) {
  let damageFactor = 1 + (e.veteran?.rank ?? 0) * 0.05, speedFactor = 1, armor = e.veteran?.rank ?? 0, range = 0;
  for (const promotion of e.veteran?.promotions ?? []) {
    const p = PROMOTIONS[promotion.id];
    damageFactor *= p.damage ?? 1;
    speedFactor *= p.speed ?? 1;
    armor += p.armor ?? 0;
    range += p.range ?? 0;
  }
  for (const artifact of Object.values(e.equipment ?? {})) {
    const item = s.specialists?.artifacts.find((item2) => item2.id === artifact);
    if (!item || item.holder !== e.id) continue;
    const d = ARTIFACTS[item.definitionId];
    damageFactor *= d.damage ?? 1;
    speedFactor *= d.speed ?? 1;
    armor += d.armor ?? 0;
    range += d.range ?? 0;
  }
  for (const buff2 of e.specialistBuffs ?? []) {
    if (buff2.until <= s.time) continue;
    damageFactor *= buff2.damageFactor ?? 1;
    speedFactor *= buff2.rooted ? 0 : buff2.speedFactor ?? 1;
    armor += buff2.armor ?? 0;
  }
  return { damageFactor, speedFactor, armor, range };
}
function commanderArtifact(s, e) {
  if (eligible(e) && unitFor(s, e).tags?.includes("hero")) createArtifact(s, ["core:ember-blade", "core:iron-aegis", "core:wind-charm"][e.id % 3], e);
}
function dropArtifact(s, side2, id5, artifact) {
  const e = s.entities.find((e2) => e2.id === id5 && e2.side === side2 && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact);
  if (!e || !equipmentEligible(s, e) || !item || item.owner !== side2 || item.holder !== e.id) return false;
  for (const slot of ["weapon", "armor", "trinket"]) if (e.equipment?.[slot] === artifact) delete e.equipment[slot];
  delete item.owner;
  delete item.holder;
  item.position = { x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } };
  return true;
}
function recordCombatExposure(s, e) {
  if (!eligible(e)) return;
  const v = e.veteran ??= { experience: 0, rank: 0, nextSurvivalAt: s.time + 15, lastCombatAt: s.time, promotions: [] };
  v.lastCombatAt = s.time;
}

// src/core/economy-common.ts
var RESOURCE_KINDS = ["wood", "ore", "crystal"];
var zeroCost = () => ({ wood: 0, ore: 0, crystal: 0 });
var costTotal = (c) => c.wood + c.ore + c.crystal;
function addCost(target, cost5) {
  for (const kind of RESOURCE_KINDS) target[kind] += cost5[kind];
}
function subCost(target, cost5) {
  for (const kind of RESOURCE_KINDS) target[kind] = Math.max(0, target[kind] - cost5[kind]);
}
function hasCost(target, cost5) {
  return RESOURCE_KINDS.every((kind) => target[kind] + 1e-8 >= cost5[kind]);
}
function payCost(target, cost5) {
  if (!hasCost(target, cost5)) return false;
  subCost(target, cost5);
  return true;
}
function takeCost(source2, capacity) {
  const result = zeroCost();
  for (const kind of RESOURCE_KINDS) {
    const amount = Math.min(source2[kind], Math.max(0, capacity - costTotal(result)));
    result[kind] = amount;
    source2[kind] = Math.max(0, source2[kind] - amount);
  }
  return result;
}
function economicState(s) {
  return s.economy;
}
function createEconomyState(playerCount) {
  return { version: 1, groves: [], structures: [], caravans: [], cargo: [], tasks: [], salvage: [], markets: [], villages: [], contracts: [], specializations: [], workerWarehouses: [], deepSites: [], deathClaims: [], paidCosts: [], recruits: [], ledgers: Array.from({ length: playerCount }, () => ({ gathered: zeroCost(), delivered: zeroCost(), traded: zeroCost(), raided: zeroCost(), salvaged: zeroCost(), contractRewards: zeroCost() })) };
}
function ensureEconomy(s) {
  const existing = economicState(s);
  if (existing) return existing;
  const economy = createEconomyState(s.players.length);
  s.economy = economy;
  return economy;
}
function economyStock(s, economy, id5) {
  const entity = s.entities.find((e) => e.id === id5 && e.hp > 0 && e.kind === "building" && e.progress === 1 && (e.role === "hq" || e.role === "depot"));
  if (!entity) return void 0;
  return economy.structures.find((item) => item.entityId === id5 && item.kind === "warehouse")?.stock ?? s.players[entity.side];
}
var levelOf = (p) => p.level ?? 0;
var sameLevel = (a, b) => levelOf(a) === levelOf(b);
var distance = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
function economyMessage(s, e, text3, target) {
  s.events.push({ type: "message", x: e.x, y: e.y, level: levelOf(e), side: e.side, source: e.id, text: text3, ...target === void 0 ? {} : { target } });
}

// src/core/economy-validation.ts
var ECONOMY_COMMAND_TYPES = ["plantGrove", "buildEconomy", "setOvercharge", "trainCaravan", "tradeRoute", "deliverStock", "marketTrade", "raidSupply", "collectSalvage", "setWarehouse", "specializeSettlement", "acceptContract", "deliverContract"];
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var id = (v) => Number.isSafeInteger(v) && v > 0;
var num2 = (v, min = 0, max = 1e4) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
var keys = (v, fields2) => Object.keys(v).every((key) => fields2.includes(key)) && fields2.every((key) => Object.hasOwn(v, key));
var cost2 = (v) => record(v) && keys(v, ["wood", "ore", "crystal"]) && ["wood", "ore", "crystal"].every((k) => num2(v[k]));
var kinds = ["wood", "ore", "crystal"];
function validateEconomyCommand(v) {
  if (!record(v) || typeof v.type !== "string" || !ECONOMY_COMMAND_TYPES.includes(v.type)) return false;
  const ids = () => Array.isArray(v.ids) && v.ids.length > 0 && v.ids.length <= 100 && v.ids.every(id) && new Set(v.ids).size === v.ids.length;
  const positionKeys = (fields2) => keys(v, v.level === void 0 ? fields2 : [...fields2, "level"]) && (v.level === void 0 || num2(v.level, 0, 1) && Number.isSafeInteger(v.level));
  if (v.type === "plantGrove") return positionKeys(["type", "ids", "x", "y"]) && ids() && num2(v.x, 0, 256) && num2(v.y, 0, 256);
  if (v.type === "buildEconomy") return v.kind === "warehouse" ? positionKeys(["type", "ids", "kind", "x", "y"]) && ids() && num2(v.x, 0, 256) && num2(v.y, 0, 256) : keys(v, ["type", "ids", "kind", "target"]) && ids() && ["extractor", "deep-mine"].includes(v.kind) && id(v.target);
  if (v.type === "setOvercharge") return keys(v, ["type", "id", "enabled"]) && id(v.id) && typeof v.enabled === "boolean";
  if (v.type === "trainCaravan" || v.type === "acceptContract") return keys(v, ["type", "id"]) && id(v.id);
  if (v.type === "tradeRoute") return keys(v, ["type", "id", "source", "target", "kind", "amount", "repeat"]) && id(v.id) && id(v.source) && id(v.target) && kinds.includes(v.kind) && num2(v.amount, 1) && typeof v.repeat === "boolean";
  if (v.type === "deliverStock") return keys(v, ["type", "id", "source", "target", "stock"]) && id(v.id) && id(v.source) && id(v.target) && cost2(v.stock);
  if (v.type === "marketTrade") return keys(v, ["type", "market", "kind", "amount", "direction"]) && id(v.market) && kinds.includes(v.kind) && num2(v.amount, 1) && ["buy", "sell"].includes(v.direction);
  if (v.type === "raidSupply" || v.type === "collectSalvage") return keys(v, ["type", "ids", "target"]) && ids() && id(v.target);
  if (v.type === "setWarehouse") return keys(v, ["type", "ids", "target"]) && ids() && (v.target === null || id(v.target));
  if (v.type === "specializeSettlement") return keys(v, ["type", "id", "kind"]) && id(v.id) && ["mining", "military", "research"].includes(v.kind);
  return keys(v, ["type", "id", "contract", "source"]) && id(v.id) && id(v.contract) && id(v.source);
}
function isEconomyCommand(c) {
  return ECONOMY_COMMAND_TYPES.includes(c.type);
}
function validateEconomyState(value2, c) {
  const fail2 = (path) => {
    throw new Error(`Invalid economy state at ${path}.`);
  };
  const obj2 = (v, p, required, optional = []) => {
    if (!record(v) || required.some((key) => !Object.hasOwn(v, key)) || Object.keys(v).some((key) => ![...required, ...optional].includes(key))) fail2(p);
    return v;
  };
  const n = (v, p, min = 0, max = 1e9, integer2 = false) => {
    if (!num2(v, min, max) || integer2 && !Number.isSafeInteger(v)) fail2(p);
    return v;
  };
  const array3 = (v, p, max = 8192) => {
    if (!Array.isArray(v) || v.length > max) fail2(p);
    return v;
  };
  const unique2 = (values, p) => {
    if (new Set(values).size !== values.length) fail2(p);
  };
  const identifier2 = (v, p) => n(v, p, 1, c.nextId - 1, true);
  const side2 = (v, p) => n(v, p, 0, c.playerCount - 1, true);
  const vector = (v, p) => {
    n(v.x, `${p}.x`, 0, c.width);
    n(v.y, `${p}.y`, 0, c.height);
    if (v.level !== void 0) n(v.level, `${p}.level`, 0, (c.levels ?? c.world?.levels.length ?? 1) - 1, true);
  };
  const stock = (v, p) => {
    const o = obj2(v, p, kinds);
    for (const kind of kinds) n(o[kind], `${p}.${kind}`);
    return o;
  };
  const entity = (v, p, kind) => {
    const eid = identifier2(v, p), e = c.entities.find((e2) => e2.id === eid);
    if (!e || kind && e.kind !== kind) fail2(p);
    return e;
  };
  const flag4 = (v, p) => {
    if (typeof v !== "boolean") fail2(p);
  };
  const choice6 = (v, p, options) => {
    if (typeof v !== "string" || !options.includes(v)) fail2(p);
  };
  const s = obj2(value2, "economy", ["version", "groves", "structures", "caravans", "cargo", "tasks", "salvage", "markets", "villages", "contracts", "specializations", "workerWarehouses", "deepSites", "deathClaims", "paidCosts", "recruits", "ledgers"]);
  if (s.version !== 1) fail2("version");
  const allocated = /* @__PURE__ */ new Set([...c.entities.map((e) => e.id), ...c.resources.map((r) => r.id), ...c.world ? [...c.world.bridges, ...c.world.sites, ...c.world.creatures].map((o) => o.id) : []]), economyIds = /* @__PURE__ */ new Set();
  const uniqueObjectId = (idValue, p, linkedVillage = false) => {
    const eid = identifier2(idValue, p);
    if (economyIds.has(eid) || allocated.has(eid) && !linkedVillage) fail2(p);
    allocated.add(eid);
    economyIds.add(eid);
    return eid;
  };
  const groveIds = [];
  array3(s.groves, "groves", 1600).forEach((v, i) => {
    const p = `groves[${i}]`, o = obj2(v, p, ["id", "side", "x", "y", "plantedAt", "maturesAt", "burned"], ["resourceId", "level"]);
    groveIds.push(uniqueObjectId(o.id, `${p}.id`));
    side2(o.side, `${p}.side`);
    vector(o, p);
    n(o.plantedAt, `${p}.plantedAt`, -1, c.time);
    n(o.maturesAt, `${p}.maturesAt`, -1, c.time + 60);
    flag4(o.burned, `${p}.burned`);
    if (o.plantedAt < 0 && o.maturesAt !== -1) fail2(p);
    if (o.plantedAt >= 0 && o.maturesAt < o.plantedAt) fail2(p);
    if (o.resourceId !== void 0) {
      const rid = identifier2(o.resourceId, `${p}.resourceId`);
      if (!c.resources.some((r) => r.id === rid && r.kind === "wood" && levelOf(r) === (o.level ?? 0) && r.x === o.x && r.y === o.y)) fail2(`${p}.resourceId`);
    }
  });
  const structureIds = [];
  array3(s.structures, "structures", 1024).forEach((v, i) => {
    const p = `structures[${i}]`, o = obj2(v, p, ["entityId", "kind", "stock", "capacity", "overcharge", "nextIncident"], ["resourceId"]);
    const e = entity(o.entityId, `${p}.entityId`, "building");
    structureIds.push(e.id);
    choice6(o.kind, `${p}.kind`, ["warehouse", "extractor", "deep-mine"]);
    const values = stock(o.stock, `${p}.stock`);
    n(o.capacity, `${p}.capacity`, 0, 1e4);
    if (kinds.reduce((sum, kind) => sum + values[kind], 0) > o.capacity + 1e-7) fail2(`${p}.stock`);
    flag4(o.overcharge, `${p}.overcharge`);
    n(o.nextIncident, `${p}.nextIncident`, 0, c.time + 12.1);
    if (o.kind !== "extractor" && o.overcharge) fail2(`${p}.overcharge`);
    if (o.kind === "warehouse" && o.resourceId !== void 0 || o.kind !== "warehouse" && o.resourceId === void 0) fail2(`${p}.resourceId`);
    if (o.resourceId !== void 0) {
      const rid = identifier2(o.resourceId, `${p}.resourceId`);
      if (!c.resources.some((r) => r.id === rid && r.kind === (o.kind === "extractor" ? "crystal" : "ore") && sameLevel(e, r))) fail2(`${p}.resourceId`);
    }
  });
  unique2(structureIds, "structures");
  const caravans = array3(s.caravans, "caravans", 1024).map((v, i) => entity(v, `caravans[${i}]`, "unit").id);
  unique2(caravans, "caravans");
  const cargoIds = [];
  array3(s.cargo, "cargo", 4096).forEach((v, i) => {
    const p = `cargo[${i}]`, o = obj2(v, p, ["entityId", "stock", "capacity", "origin", "tradeValue"], ["sourceId", "destinationId", "contractId"]);
    cargoIds.push(entity(o.entityId, `${p}.entityId`, "unit").id);
    const values = stock(o.stock, `${p}.stock`);
    n(o.capacity, `${p}.capacity`, 0, 1e4);
    if (kinds.reduce((sum, kind) => sum + values[kind], 0) > o.capacity + 1e-7) fail2(`${p}.stock`);
    choice6(o.origin, `${p}.origin`, ["delivery", "trade", "raid", "salvage", "contract"]);
    n(o.tradeValue, `${p}.tradeValue`);
    for (const key of ["sourceId", "destinationId", "contractId"]) if (o[key] !== void 0) identifier2(o[key], `${p}.${key}`);
  });
  unique2(cargoIds, "cargo");
  const salvageIds = [];
  array3(s.salvage, "salvage", 4096).forEach((v, i) => {
    const p = `salvage[${i}]`, o = obj2(v, p, ["id", "x", "y", "stock", "expiresAt", "owner", "kind"], ["level"]);
    salvageIds.push(uniqueObjectId(o.id, `${p}.id`));
    vector(o, p);
    stock(o.stock, `${p}.stock`);
    n(o.expiresAt, `${p}.expiresAt`, 0, c.time + 120.1);
    if (o.owner !== null) side2(o.owner, `${p}.owner`);
    choice6(o.kind, `${p}.kind`, ["salvage", "cargo"]);
  });
  const marketIds = [];
  array3(s.markets, "markets", 32).forEach((v, i) => {
    const p = `markets[${i}]`, o = obj2(v, p, ["id", "x", "y", "stock", "demand", "recoverAt"], ["level"]);
    marketIds.push(uniqueObjectId(o.id, `${p}.id`));
    vector(o, p);
    stock(o.stock, `${p}.stock`);
    const demand = obj2(o.demand, `${p}.demand`, kinds);
    for (const kind of kinds) n(demand[kind], `${p}.demand.${kind}`, 0, 1e9);
    n(o.recoverAt, `${p}.recoverAt`, 0, c.time);
  });
  const villages = [];
  array3(s.villages, "villages", 32).forEach((v, i) => {
    const p = `villages[${i}]`, o = obj2(v, p, ["id", "x", "y", "rewardPool"], ["level"]);
    const linked = c.world?.sites.some((site) => site.id === o.id && site.kind === "village" && site.level === (o.level ?? 0)) === true;
    villages.push(uniqueObjectId(o.id, `${p}.id`, linked));
    vector(o, p);
    stock(o.rewardPool, `${p}.rewardPool`);
  });
  const contracts = [];
  array3(s.contracts, "contracts", 96).forEach((v, i) => {
    const p = `contracts[${i}]`, o = obj2(v, p, ["id", "villageId", "x", "y", "side", "kind", "amount", "delivered", "deadline", "reward", "status"], ["level"]);
    contracts.push(uniqueObjectId(o.id, `${p}.id`));
    if (!villages.includes(identifier2(o.villageId, `${p}.villageId`))) fail2(`${p}.villageId`);
    const village = s.villages.find((v2) => v2.id === o.villageId);
    if ((village.level ?? 0) !== (o.level ?? 0) || village.x !== o.x || village.y !== o.y) fail2(`${p}.villageId`);
    vector(o, p);
    if (o.side !== null) side2(o.side, `${p}.side`);
    choice6(o.kind, `${p}.kind`, kinds);
    const amount = n(o.amount, `${p}.amount`, 1, 1e4);
    n(o.delivered, `${p}.delivered`, 0, amount);
    n(o.deadline, `${p}.deadline`, 0, c.time + 180.1);
    stock(o.reward, `${p}.reward`);
    choice6(o.status, `${p}.status`, ["open", "accepted", "complete", "expired"]);
    if ((o.status === "accepted" || o.status === "complete") && o.side === null || o.status === "complete" && o.delivered !== o.amount) fail2(p);
  });
  const taskIds = [];
  array3(s.tasks, "tasks", 4096).forEach((v, i) => {
    const p = `tasks[${i}]`, o = obj2(v, p, ["entityId", "kind", "targetId", "progress"], ["sourceId", "repeat", "phase", "amount", "contractId"]);
    const e = entity(o.entityId, `${p}.entityId`, "unit");
    taskIds.push(e.id);
    choice6(o.kind, `${p}.kind`, ["plant", "collect", "raid", "route"]);
    identifier2(o.targetId, `${p}.targetId`);
    n(o.progress, `${p}.progress`, 0, 2);
    if (o.kind === "plant" && !groveIds.includes(o.targetId) || o.kind === "collect" && !salvageIds.includes(o.targetId)) fail2(p);
    if (o.kind === "route") {
      identifier2(o.sourceId, `${p}.sourceId`);
      flag4(o.repeat, `${p}.repeat`);
      choice6(o.phase, `${p}.phase`, ["loading", "delivery"]);
      stock(o.amount, `${p}.amount`);
    }
    if (o.contractId !== void 0 && !contracts.includes(identifier2(o.contractId, `${p}.contractId`))) fail2(`${p}.contractId`);
  });
  unique2(taskIds, "tasks");
  const specializationIds = [];
  array3(s.specializations, "specializations", 1024).forEach((v, i) => {
    const p = `specializations[${i}]`, o = obj2(v, p, ["entityId", "kind"]);
    const e = entity(o.entityId, `${p}.entityId`, "building");
    if (e.role !== "hq") fail2(p);
    specializationIds.push(e.id);
    choice6(o.kind, `${p}.kind`, ["mining", "military", "research"]);
  });
  unique2(specializationIds, "specializations");
  const workerIds = [];
  array3(s.workerWarehouses, "workerWarehouses", 4096).forEach((v, i) => {
    const p = `workerWarehouses[${i}]`, o = obj2(v, p, ["entityId", "warehouseId"]), e = entity(o.entityId, `${p}.entityId`, "unit"), w = entity(o.warehouseId, `${p}.warehouseId`, "building");
    if (e.role !== "worker" || caravans.includes(e.id) || e.side !== w.side || !sameLevel(e, w) || !array3(s.structures, "structures").some((item) => record(item) && item.entityId === w.id && item.kind === "warehouse")) fail2(p);
    workerIds.push(e.id);
  });
  unique2(workerIds, "workerWarehouses");
  const deep = array3(s.deepSites, "deepSites", 8192).map((v, i) => {
    const rid = identifier2(v, `deepSites[${i}]`);
    if (!c.resources.some((r) => r.id === rid && r.kind === "ore")) fail2("deepSites");
    return rid;
  });
  unique2(deep, "deepSites");
  const deaths = array3(s.deathClaims, "deathClaims", 16384).map((v, i) => identifier2(v, `deathClaims[${i}]`));
  unique2(deaths, "deathClaims");
  const paidIds = [];
  array3(s.paidCosts, "paidCosts", 16384).forEach((v, i) => {
    const p = `paidCosts[${i}]`, o = obj2(v, p, ["entityId", "stock"]);
    paidIds.push(identifier2(o.entityId, `${p}.entityId`));
    stock(o.stock, `${p}.stock`);
  });
  unique2(paidIds, "paidCosts");
  const producerQueues = /* @__PURE__ */ new Map();
  array3(s.recruits, "recruits", 3 * c.entities.filter((e) => e.kind === "building" && e.role === "hq").length).forEach((v, i) => {
    const p = `recruits[${i}]`, o = obj2(v, p, ["producerId", "side", "readyAt"]);
    const producer = entity(o.producerId, `${p}.producerId`, "building");
    if (producer.role !== "hq" || producer.side !== side2(o.side, `${p}.side`)) fail2(p);
    const count = (producerQueues.get(producer.id) ?? 0) + 1;
    if (count > 3) fail2(p);
    producerQueues.set(producer.id, count);
    n(o.readyAt, `${p}.readyAt`, 0, c.time + 54.1);
  });
  const ledgers = array3(s.ledgers, "ledgers", 8);
  if (ledgers.length !== c.playerCount) fail2("ledgers");
  ledgers.forEach((v, i) => {
    const p = `ledgers[${i}]`, fields2 = ["gathered", "delivered", "traded", "raided", "salvaged", "contractRewards"], o = obj2(v, p, fields2);
    for (const key of fields2) stock(o[key], `${p}.${key}`);
  });
}

// src/core/commands.ts
var roles = ["worker", "melee", "ranged", "special", "spear", "cavalry", "siege"];
var buildings = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var record2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var id2 = (v) => Number.isSafeInteger(v) && v > 0;
var index = (v) => Number.isSafeInteger(v) && v >= 0;
var definition = (v) => v === void 0 || typeof v === "string" && /^[a-z][a-z0-9:-]{0,99}$/.test(v);
var finite = (v) => typeof v === "number" && Number.isFinite(v);
var keys2 = (o, allowed) => Object.keys(o).every((k) => allowed.includes(k));
var side = (v) => index(v) && v < 8;
var cost3 = (v) => record2(v) && keys2(v, ["wood", "ore", "crystal"]) && ["wood", "ore", "crystal"].every((k) => finite(v[k]) && v[k] >= 0 && v[k] <= 1e9) && ["wood", "ore", "crystal"].some((k) => v[k] > 0);
function isPlayerCommand(command) {
  return ["allyDirective", "cancelAllyDirective", "transferResources"].includes(command.type);
}
function validateCommand(v) {
  if (!record2(v) || typeof v.type !== "string") return false;
  if (isEconomyCommand(v)) return validateEconomyCommand(v);
  const queued = ["move", "attackMove", "attack", "gather", "repair"].includes(v.type);
  if ("queued" in v && (!queued || typeof v.queued !== "boolean")) return false;
  if (v.type === "draftChoice") return keys2(v, ["type", "definitionId"]) && typeof v.definitionId === "string" && v.definitionId.length > 0 && v.definitionId.length <= 128;
  if (v.type === "collectRelic") return keys2(v, ["type", "id", "relicId"]) && id2(v.id) && id2(v.relicId);
  if (v.type === "dropRelic") return keys2(v, ["type", "id"]) && id2(v.id);
  const allowed = (fields2) => keys2(v, queued ? [...fields2, "queued"] : fields2);
  if (v.type === "transferResources") return allowed(["type", "recipient", "resources"]) && side(v.recipient) && cost3(v.resources);
  if (v.type === "cancelAllyDirective") return allowed(["type", "directiveId"]) && id2(v.directiveId);
  if (v.type === "allyDirective") {
    if (!side(v.ally)) return false;
    if (v.directive === "support") return allowed(["type", "ally", "directive", "resources"]) && cost3(v.resources);
    if (v.directive === "attack" && "target" in v) return allowed(["type", "ally", "directive", "target"]) && id2(v.target);
    return ["defend", "scout", "attack"].includes(v.directive) && allowed(["type", "ally", "directive", "x", "y", "level"]) && finite(v.x) && finite(v.y) && (v.level === void 0 || Number.isInteger(v.level) && v.level >= 0 && v.level <= 1);
  }
  if (v.type === "cancelTrain") return allowed(["type", "id", "index"]) && id2(v.id) && index(v.index);
  if (v.type === "reorderTrain") return allowed(["type", "id", "from", "to"]) && id2(v.id) && index(v.from) && index(v.to);
  if (v.type === "train") return allowed(["type", "id", "role", "definitionId"]) && id2(v.id) && roles.includes(v.role) && definition(v.definitionId);
  if (v.type === "research") return allowed(["type", "id", "upgrade"]) && id2(v.id) && typeof v.upgrade === "string" && (Object.hasOwn(UPGRADES, v.upgrade) || /^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(v.upgrade));
  if (v.type === "promote") return allowed(["type", "id", "promotion"]) && id2(v.id) && typeof v.promotion === "string" && Object.hasOwn(PROMOTIONS, v.promotion);
  if (["recoverArtifact", "equipArtifact", "dropArtifact"].includes(v.type)) return allowed(["type", "id", "artifact"]) && id2(v.id) && id2(v.artifact);
  if (v.type === "unequipArtifact") return allowed(["type", "id", "slot"]) && id2(v.id) && ["weapon", "armor", "trinket"].includes(v.slot);
  if (v.type === "fieldRepair") return allowed(["type", "id", "target"]) && id2(v.id) && id2(v.target);
  if (!Array.isArray(v.ids) || !v.ids.length || v.ids.length > 100 || !v.ids.every(id2)) return false;
  if (v.type === "warChant") return allowed(["type", "ids", "chant"]) && ["assault", "bulwark"].includes(v.chant);
  if (v.type === "trophyStandard") return allowed(["type", "ids"]);
  if (["illusionSwap", "tunnelTravel", "collectCorpses", "deliverCorpses"].includes(v.type)) return allowed(["type", "ids", "target"]) && id2(v.target);
  if (v.type === "modifyArtillery") return allowed(["type", "ids", "modification"]) && ["stone", "grapeshot", "incendiary", "reinforced"].includes(v.modification);
  if (v.type === "buildFactionStructure") return allowed(["type", "ids", "structure", "x", "y", "level"]) && ["enchanted-grove", "tunnel", "necropolis", "power-relay"].includes(v.structure) && finite(v.x) && finite(v.y) && (v.level === void 0 || index(v.level) && v.level <= 1);
  if (v.type === "shapeWater") return allowed(["type", "ids", "x", "y", "level", "terrain"]) && ["mud", "shallows", "water"].includes(v.terrain) && finite(v.x) && finite(v.y) && (v.level === void 0 || index(v.level) && v.level <= 1);
  if (v.type === "formation") return allowed(["type", "ids", "formation", "spacing", "facing"]) && ["line", "wedge", "square", "loose"].includes(v.formation) && finite(v.spacing) && v.spacing >= 0.65 && v.spacing <= 3 && index(v.facing) && v.facing <= 7;
  if (v.type === "face") return allowed(["type", "ids", "facing"]) && index(v.facing) && v.facing <= 7;
  if (v.type === "ambush") return allowed(["type", "ids", "radius", "target"]) && finite(v.radius) && v.radius >= 0.75 && v.radius <= 10 && ["any", "unit", "building", ...roles].includes(v.target);
  if (v.type === "releaseAmbush") return allowed(["type", "ids"]);
  if (v.type === "captureSiege") return allowed(["type", "ids", "target"]) && id2(v.target);
  if (["stop", "hold", "clearRally", "toggleGate"].includes(v.type)) return allowed(["type", "ids"]);
  if (["move", "attackMove", "setRally", "ignite", "firebreak"].includes(v.type)) return allowed(["type", "ids", "x", "y", "level"]) && finite(v.x) && finite(v.y) && (v.level === void 0 || Number.isInteger(v.level) && v.level >= 0 && v.level <= 1);
  if (v.type === "traverse") return allowed(["type", "ids", "transition"]) && id2(v.transition);
  if (["worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"].includes(v.type)) return allowed(["type", "ids", "target"]) && id2(v.target);
  if (v.type === "ability") return allowed(["type", "ids", "x", "y", "level", "target"]) && (!("target" in v) || id2(v.target)) && (!("level" in v) || index(v.level) && v.level <= 1) && (!("x" in v) && !("y" in v) || finite(v.x) && finite(v.y)) && (!("x" in v || "y" in v) || !("target" in v));
  if (v.type === "engineerBuild") return allowed(["type", "ids", "kind", "x", "y", "level"]) && ["bridge", "barricade"].includes(v.kind) && finite(v.x) && finite(v.y) && (!("level" in v) || index(v.level) && v.level <= 1);
  if (["attack", "gather", "repair"].includes(v.type)) return allowed(["type", "ids", "target"]) && id2(v.target);
  return v.type === "build" && allowed(["type", "ids", "role", "x", "y", "definitionId", "level"]) && definition(v.definitionId) && (v.level === void 0 || Number.isInteger(v.level) && v.level >= 0 && v.level <= 1) && buildings.includes(v.role) && finite(v.x) && finite(v.y);
}

// src/core/scenario-geometry.ts
var COS_DEGREES = [
  1,
  0.9998476951563913,
  0.9993908270190958,
  0.9986295347545738,
  0.9975640502598242,
  0.9961946980917455,
  0.9945218953682733,
  0.992546151641322,
  0.9902680687415704,
  0.9876883405951378,
  0.984807753012208,
  0.981627183447664,
  0.9781476007338057,
  0.9743700647852352,
  0.9702957262759965,
  0.9659258262890683,
  0.9612616959383189,
  0.9563047559630354,
  0.9510565162951535,
  0.9455185755993168,
  0.9396926207859084,
  0.9335804264972017,
  0.9271838545667874,
  0.9205048534524404,
  0.9135454576426009,
  0.9063077870366499,
  0.898794046299167,
  0.8910065241883679,
  0.882947592858927,
  0.8746197071393957,
  0.8660254037844387,
  0.8571673007021123,
  0.848048096156426,
  0.838670567945424,
  0.8290375725550416,
  0.8191520442889918,
  0.8090169943749475,
  0.7986355100472928,
  0.7880107536067219,
  0.7771459614569709,
  0.766044443118978,
  0.754709580222772,
  0.7431448254773942,
  0.7313537016191705,
  0.7193398003386512,
  0.7071067811865476,
  0.6946583704589973,
  0.6819983600624985,
  0.6691306063588582,
  0.6560590289905073,
  0.6427876096865394,
  0.6293203910498375,
  0.6156614753256583,
  0.6018150231520484,
  0.5877852522924731,
  0.5735764363510462,
  0.5591929034707468,
  0.5446390350150271,
  0.5299192642332049,
  0.5150380749100542,
  0.5000000000000001,
  0.4848096202463371,
  0.46947156278589086,
  0.4539904997395468,
  0.43837114678907746,
  0.42261826174069944,
  0.4067366430758002,
  0.3907311284892737,
  0.37460659341591196,
  0.3583679495453004,
  0.3420201433256688,
  0.32556815445715676,
  0.30901699437494745,
  0.29237170472273677,
  0.27563735581699916,
  0.25881904510252074,
  0.24192189559966767,
  0.22495105434386492,
  0.20791169081775945,
  0.19080899537654492,
  0.17364817766693041,
  0.15643446504023092,
  0.13917310096006547,
  0.12186934340514749,
  0.10452846326765346,
  0.08715574274765814,
  0.06975647374412523,
  0.052335956242943966,
  0.03489949670250108,
  0.0174524064372836,
  6123233995736766e-32,
  -0.017452406437283477,
  -0.034899496702500955,
  -0.05233595624294384,
  -0.06975647374412533,
  -0.08715574274765824,
  -0.10452846326765355,
  -0.12186934340514737,
  -0.13917310096006535,
  -0.1564344650402308,
  -0.1736481776669303,
  -0.1908089953765448,
  -0.20791169081775934,
  -0.22495105434386503,
  -0.24192189559966779,
  -0.25881904510252085,
  -0.27563735581699905,
  -0.29237170472273666,
  -0.30901699437494734,
  -0.32556815445715664,
  -0.3420201433256687,
  -0.35836794954530027,
  -0.37460659341591207,
  -0.39073112848927377,
  -0.40673664307580026,
  -0.42261826174069933,
  -0.4383711467890775,
  -0.4539904997395467,
  -0.4694715627858909,
  -0.484809620246337,
  -0.4999999999999998,
  -0.5150380749100543,
  -0.5299192642332048,
  -0.5446390350150271,
  -0.5591929034707467,
  -0.5735764363510462,
  -0.587785252292473,
  -0.6018150231520484,
  -0.6156614753256583,
  -0.6293203910498373,
  -0.6427876096865394,
  -0.6560590289905072,
  -0.6691306063588582,
  -0.6819983600624984,
  -0.6946583704589974,
  -0.7071067811865475,
  -0.7193398003386512,
  -0.7313537016191705,
  -0.743144825477394,
  -0.754709580222772,
  -0.7660444431189779,
  -0.7771459614569709,
  -0.7880107536067219,
  -0.7986355100472929,
  -0.8090169943749473,
  -0.8191520442889919,
  -0.8290375725550416,
  -0.8386705679454239,
  -0.848048096156426,
  -0.8571673007021122,
  -0.8660254037844387,
  -0.8746197071393957,
  -0.882947592858927,
  -0.8910065241883678,
  -0.898794046299167,
  -0.9063077870366499,
  -0.9135454576426008,
  -0.9205048534524404,
  -0.9271838545667873,
  -0.9335804264972017,
  -0.9396926207859083,
  -0.9455185755993168,
  -0.9510565162951535,
  -0.9563047559630355,
  -0.9612616959383189,
  -0.9659258262890682,
  -0.9702957262759965,
  -0.9743700647852351,
  -0.9781476007338057,
  -0.981627183447664,
  -0.984807753012208,
  -0.9876883405951377,
  -0.9902680687415704,
  -0.992546151641322,
  -0.9945218953682733,
  -0.9961946980917455,
  -0.9975640502598242,
  -0.9986295347545738,
  -0.9993908270190958,
  -0.9998476951563913,
  -1
];
function coneCosine(degrees) {
  const angle = Math.max(0, Math.min(180, degrees / 2)), lower = Math.floor(angle);
  return lower === 180 ? -1 : COS_DEGREES[lower] + (COS_DEGREES[lower + 1] - COS_DEGREES[lower]) * (angle - lower);
}

// src/core/maps.ts
var MAP_SIZES = { small: 36, medium: 48, large: 64, huge: 88 };
var MAP_VERSION = 2;
var TERRAIN = {
  grass: { name: "Meadow", walkable: true, buildable: true, speed: 1 },
  road: { name: "Road", walkable: true, buildable: true, speed: 1.15 },
  mud: { name: "Marsh", walkable: true, buildable: false, speed: 0.72 },
  shallows: { name: "Shallows", walkable: true, buildable: false, speed: 0.65 },
  water: { name: "Deep water", walkable: false, buildable: false, speed: 0 },
  rock: { name: "Cliffs", walkable: false, buildable: false, speed: 0 },
  bridge: { name: "Bridge", walkable: true, buildable: false, speed: 1 },
  sand: { name: "Desert sand", walkable: true, buildable: true, speed: 0.84 },
  snow: { name: "Snow valley", walkable: true, buildable: true, speed: 0.8 },
  forest: { name: "Dense forest", walkable: false, buildable: false, speed: 0 },
  ice: { name: "Frozen lake", walkable: true, buildable: false, speed: 1.05 }
};
function seededRandom(seed) {
  let value2 = seed >>> 0;
  return () => {
    value2 = value2 + 1831565813 >>> 0;
    let t = value2;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function terrainAt(map, x, y, level2 = 0) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "rock";
  return (level2 === 0 ? map.terrain : map.world?.levels[level2]?.terrain)?.[Math.floor(y) * map.width + Math.floor(x)] ?? "rock";
}
function generateMap(seed, size = "medium") {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Map seed must be an integer from 0 to 4294967295.");
  if (!(size in MAP_SIZES)) throw new Error("Map size must be small, medium, large or huge.");
  const width = MAP_SIZES[size], height = width, rng = seededRandom(seed), terrain2 = Array(width * height).fill("grass");
  const base = size === "small" ? 7.5 : 8.5, starts = [{ x: base, y: base }, { x: width - base, y: height - base }];
  const map = { size, seed, width, height, terrain: terrain2, starts, resources: [], version: MAP_VERSION };
  const mirror = (p) => ({ x: width - p.x, y: height - p.y });
  const set = (x, y, kind) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    terrain2[y * width + x] = kind;
    terrain2[(height - 1 - y) * width + (width - 1 - x)] = kind;
  };
  const disk = (cx, cy, rx, ry, kind) => {
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(height, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(width, Math.ceil(cx + rx)); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) set(x, y, kind);
  };
  for (let i = 0; i < Math.round(width * 0.42); i++) {
    const x = 3 + rng() * (width - 6), y = 3 + rng() * (height - 6), roll = rng();
    disk(x, y, 1.5 + rng() * 3.5, 1.5 + rng() * 3.5, roll < 0.42 ? "water" : roll < 0.7 ? "mud" : "rock");
  }
  const before = [...terrain2];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (before[y * width + x] === "water" && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height || before[(y + dy) * width + x + dx] !== "water")) set(x, y, "shallows");
  const carve = (a, b, radius2 = 1.65) => {
    const length2 = length2D(b.x - a.x, b.y - a.y), steps = Math.ceil(length2 * 3);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0, cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
      for (let y = Math.max(0, Math.floor(cy - radius2)); y < Math.min(height, Math.ceil(cy + radius2)); y++) for (let x = Math.max(0, Math.floor(cx - radius2)); x < Math.min(width, Math.ceil(cx + radius2)); x++) if (length2D(x + 0.5 - cx, y + 0.5 - cy) <= radius2) {
        const old = terrain2[y * width + x];
        set(x, y, old === "water" || old === "shallows" || old === "bridge" ? "bridge" : "road");
      }
    }
  };
  const center = { x: width / 2, y: height / 2 }, bend = { x: width * (0.32 + rng() * 0.08), y: height * (0.32 + rng() * 0.08) };
  carve(starts[0], bend);
  carve(bend, center);
  const flank = { x: width * (0.19 + rng() * 0.08), y: height * (0.58 + rng() * 0.09) };
  carve(starts[0], flank, 1.2);
  carve(flank, mirror(flank), 1.2);
  disk(starts[0].x, starts[0].y, 8.1, 8.1, "grass");
  const addPair = (p, kind, amount) => {
    const q = mirror(p);
    if (length2D(p.x - q.x, p.y - q.y) < 2.2) return false;
    if (map.resources.some((r) => length2D(r.x - p.x, r.y - p.y) < 2.05 || length2D(r.x - q.x, r.y - q.y) < 2.05)) return false;
    for (const point5 of [p, q]) map.resources.push({ ...point5, kind, amount, maxAmount: amount });
    disk(p.x, p.y, 1.75, 1.75, "grass");
    return true;
  };
  for (const [dx, dy, kind, amount] of [[-4, 4, "wood", 2600], [-2, 6, "wood", 2600], [-5, 1, "wood", 2600], [5, -3, "ore", 2800], [6, 0, "ore", 2800], [5, 4, "crystal", 180]]) addPair({ x: base + dx, y: base + dy }, kind, amount);
  const clusters = size === "small" ? 2 : size === "medium" ? 3 : size === "large" ? 5 : 8;
  for (let i = 0; i < clusters; i++) {
    const t = 0.42 + i / Math.max(1, clusters - 1) * 0.45;
    const p = { x: Math.floor(base + (center.x - base) * t + (rng() - 0.5) * 10) + 0.5, y: Math.floor(base + (center.y - base) * t + (rng() - 0.5) * 10) + 0.5 };
    for (const [dx, dy, kind, amount] of [[-2, 0, "wood", 3e3], [0, 2, "ore", 2200], [2, 0, "crystal", 400]]) {
      const q = { x: Math.max(2.5, Math.min(width - 2.5, p.x + dx)), y: Math.max(2.5, Math.min(height - 2.5, p.y + dy)) };
      if (starts.some((a) => length2D(a.x - q.x, a.y - q.y) < 7)) continue;
      if (addPair(q, kind, amount)) {
        let nearest, best = Infinity;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain2[y * width + x] === "road" || terrain2[y * width + x] === "bridge") {
          const d = length2D(q.x - x - 0.5, q.y - y - 0.5);
          if (d < best) {
            best = d;
            nearest = { x: x + 0.5, y: y + 0.5 };
          }
        }
        if (nearest) carve(q, nearest, 1.1);
      }
    }
  }
  if (size === "large" || size === "huge") {
    const camps = [{ x: Math.floor(width * 0.23) + 0.5, y: Math.floor(width * 0.58) + 0.5 }];
    if (size === "huge") camps.push({ x: Math.floor(width * 0.18) + 0.5, y: Math.floor(width * 0.37) + 0.5 });
    for (const camp of camps) {
      disk(camp.x, camp.y, 6, 6, "grass");
      carve(camp, flank, 1.3);
      for (const [dx, dy, kind, amount] of [[-4, -2, "wood", 4e3], [4, -2, "ore", 3500], [0, 4, "crystal", 750]]) addPair({ x: camp.x + dx, y: camp.y + dy }, kind, amount);
    }
  }
  for (let i = 0; i < width; i++) {
    set(i, 0, "rock");
    set(0, i, "rock");
  }
  const validation = validateMap(map);
  if (!validation.valid) throw new Error(`Invalid generated map ${size}/${seed}: ${validation.issues.join("; ")}`);
  return map;
}
function generateMatchMap(seed, size = "medium", playerCount = 2) {
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 8) throw new Error("Player count must be an integer from 1 to 8.");
  if (!(size in MAP_SIZES)) throw new Error("Map size must be small, medium, large or huge.");
  const actualSize = playerCount > 4 ? "huge" : playerCount > 2 && MAP_SIZES[size] < MAP_SIZES.large ? "large" : size;
  const map = generateMap(seed, actualSize);
  if (playerCount === 2) return map;
  if (playerCount === 1) return { ...map, starts: [map.starts[0]] };
  const { width, height, terrain: terrain2 } = map, center = { x: width / 2, y: height / 2 }, radius2 = width / 2 - 10.5;
  map.starts = MATCH_START_DIRECTIONS[playerCount].map(([dx, dy]) => ({ x: Math.floor(center.x + dx * radius2) + 0.5, y: Math.floor(center.y + dy * radius2) + 0.5 }));
  map.resources = [];
  const paintDisk = (p, r, kind) => {
    for (let y = Math.max(1, Math.floor(p.y - r)); y < Math.min(height - 1, Math.ceil(p.y + r)); y++) for (let x = Math.max(1, Math.floor(p.x - r)); x < Math.min(width - 1, Math.ceil(p.x + r)); x++) if (length2D(x + 0.5 - p.x, y + 0.5 - p.y) <= r) terrain2[y * width + x] = kind;
  };
  const carve = (a, b, r = 1.8) => {
    const steps = Math.ceil(length2D(b.x - a.x, b.y - a.y) * 3);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      for (let y = Math.max(1, Math.floor(p.y - r)); y < Math.min(height - 1, Math.ceil(p.y + r)); y++) for (let x = Math.max(1, Math.floor(p.x - r)); x < Math.min(width - 1, Math.ceil(p.x + r)); x++) if (length2D(x + 0.5 - p.x, y + 0.5 - p.y) <= r) {
        const old = terrain2[y * width + x];
        terrain2[y * width + x] = old === "water" || old === "shallows" || old === "bridge" ? "bridge" : "road";
      }
    }
  };
  for (let slot = 0; slot < playerCount; slot++) {
    carve(map.starts[slot], center);
    carve(map.starts[slot], map.starts[(slot + 1) % playerCount]);
  }
  paintDisk(center, 7, "grass");
  for (const start of map.starts) paintDisk(start, 8.1, "grass");
  const addResource = (point5, kind, amount) => {
    if (map.resources.some((r) => length2D(point5.x - r.x, point5.y - r.y) < 2.05)) throw new Error("Multiplayer resource clusters overlap.");
    map.resources.push({ ...point5, kind, amount, maxAmount: amount });
    paintDisk(point5, 1.75, "grass");
  };
  for (const start of map.starts) {
    const dir2 = start.y < height / 2 ? 1 : -1;
    for (const [dx, dy, kind, amount] of [[-4, 4, "wood", 2600], [-2, 6, "wood", 2600], [-5, 1, "wood", 2600], [5, -3, "ore", 2800], [6, 0, "ore", 2800], [5, 4, "crystal", 180]]) addResource({ x: start.x + dx * dir2, y: start.y + dy * dir2 }, kind, amount);
  }
  for (const start of map.starts) {
    const dx = start.x - center.x, dy = start.y - center.y, length2 = length2D(dx, dy), outward = { x: dx / length2, y: dy / length2 }, tangent = { x: -outward.y, y: outward.x };
    const camp = { x: center.x + outward.x * radius2 * 0.42, y: center.y + outward.y * radius2 * 0.42 };
    carve(camp, center, 1.5);
    paintDisk(camp, 4.5, "grass");
    for (const [along, across, kind, amount] of [[0, -2.5, "wood", 4e3], [0, 2.5, "ore", 3500], [2.5, 0, "crystal", 750]]) {
      const point5 = { x: camp.x + outward.x * along + tangent.x * across, y: camp.y + outward.y * along + tangent.y * across };
      carve(point5, camp, 1.3);
      addResource(point5, kind, amount);
    }
  }
  const validation = validateMap(map);
  if (!validation.valid) throw new Error(`Invalid generated match map ${actualSize}/${seed}/${playerCount}: ${validation.issues.join("; ")}`);
  return map;
}
function validateMap(map) {
  const { width, height, starts, resources: resources3, terrain: terrain2 } = map, issues = [];
  if (terrain2.length !== width * height) issues.push("Terrain dimensions do not match.");
  if (!starts.length || starts.length > 8) issues.push("Starting positions must number 1 through 8.");
  if (starts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 2.5 || p.y < 2.5 || p.x > width - 2.5 || p.y > height - 2.5)) issues.push("Starting positions lie outside the playable map.");
  const free = (x, y) => x >= 0 && y >= 0 && x < width && y < height && TERRAIN[terrain2[y * width + x] ?? "rock"].walkable && !resources3.some((r) => r.amount > 0 && length2D(r.x - x - 0.5, r.y - y - 0.5) < 0.7) && !starts.some((p) => Math.abs(p.x - x - 0.5) < 1.77 && Math.abs(p.y - y - 0.5) < 1.77);
  const approaches = starts.length === 2 ? [{ x: Math.floor(starts[0].x), y: Math.floor(starts[0].y + 3) }, { x: Math.floor(starts[1].x), y: Math.floor(starts[1].y - 3) }] : starts.flatMap((p) => [[0, 3], [0, -3], [3, 0], [-3, 0]].map(([dx, dy]) => ({ x: Math.floor(p.x + dx), y: Math.floor(p.y + dy) })));
  const origin = approaches[0];
  const seen = /* @__PURE__ */ new Set(), queue = [];
  if (origin && free(origin.x, origin.y)) {
    seen.add(origin.y * width + origin.x);
    queue.push(origin.y * width + origin.x);
  }
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i], x = key % width, y = Math.floor(key / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * width + nx;
      if (!seen.has(k) && free(nx, ny)) {
        seen.add(k);
        queue.push(k);
      }
    }
  }
  const startsConnected = approaches.length > 0 && approaches.every((p) => seen.has(p.y * width + p.x));
  if (!startsConnected) issues.push("Starting armies are disconnected.");
  let reachableResources = 0;
  for (const r of resources3) {
    let reached = false;
    for (let y = Math.floor(r.y) - 1; y <= Math.floor(r.y) + 1; y++) for (let x = Math.floor(r.x) - 1; x <= Math.floor(r.x) + 1; x++) if (seen.has(y * width + x) && length2D(x + 0.5 - r.x, y + 0.5 - r.y) <= 1.25) reached = true;
    if (reached) reachableResources++;
    else issues.push(`Unreachable ${r.kind} at ${r.x},${r.y}.`);
  }
  for (const start of starts) for (const kind of ["wood", "ore", "crystal"]) if (!resources3.some((r) => r.kind === kind && length2D(r.x - start.x, r.y - start.y) < 9)) issues.push(`Missing starting ${kind}.`);
  if (starts.length === 2) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain2[y * width + x] !== terrain2[(height - 1 - y) * width + width - 1 - x]) {
      issues.push("Terrain is not symmetric.");
      break;
    }
    for (const r of resources3) if (!resources3.some((q) => q.kind === r.kind && q.amount === r.amount && q.x === width - r.x && q.y === height - r.y)) issues.push("Resource pair is not symmetric.");
  }
  return { valid: issues.length === 0, issues, reachableResources, totalResources: resources3.length, reachableTiles: seen.size, startsConnected };
}

// src/core/world-map.ts
var BIOMES = ["temperate", "desert", "marsh", "snow", "forest"];
var levelOf2 = (point5) => point5.level ?? 0;
var sameLevel2 = (a, b) => levelOf2(a) === levelOf2(b);
var fogKey = (s, point5) => levelOf2(point5) * s.width * s.height + Math.floor(point5.y) * s.width + Math.floor(point5.x);
function elevationAt(s, point5) {
  if (point5.x < 0 || point5.y < 0 || point5.x >= s.width || point5.y >= s.height) return 0;
  return s.world?.levels[levelOf2(point5)]?.elevation[Math.floor(point5.y) * s.width + Math.floor(point5.x)] ?? 0;
}
function highGroundDamageFactor(s, source2, target) {
  return 1 + 0.12 * Math.max(0, Math.min(3, elevationAt(s, source2) - elevationAt(s, target)));
}
function highGroundRangeBonus(s, source2) {
  return 0.5 * Math.min(3, elevationAt(s, source2));
}
function highGroundSightBonus(s, source2) {
  return 0.75 * Math.min(3, elevationAt(s, source2));
}
function setWorldTerrain(s, point5, kind) {
  const level2 = levelOf2(point5), tile = Math.floor(point5.y) * s.width + Math.floor(point5.x), terrain2 = level2 === 0 ? s.terrain : s.world?.levels[level2]?.terrain;
  if (!Object.hasOwn(TERRAIN, kind) || !terrain2 || point5.x < 0 || point5.y < 0 || point5.x >= s.width || point5.y >= s.height) return false;
  if (terrain2[tile] === kind) return true;
  terrain2[tile] = kind;
  if (s.world) {
    s.world.levels[level2].terrain[tile] = kind;
    s.world.revision = (s.world.revision ?? 0) + 1;
    for (const creature of s.world.creatures) if (levelOf2(creature) === level2) creature.path = [];
  }
  for (const entity of s.entities) if (levelOf2(entity) === level2) entity.path = [];
  return true;
}
function terrainLineOfSight(s, from, to) {
  if (!sameLevel2(from, to)) return false;
  if (!s.world) return true;
  const source2 = elevationAt(s, from), target = elevationAt(s, to), length2 = length2D(to.x - from.x, to.y - from.y), steps = Math.ceil(length2 * 3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, level: levelOf2(from) };
    const terrain2 = s.world.levels[p.level].terrain[Math.floor(p.y) * s.width + Math.floor(p.x)];
    if (terrain2 === "rock" || elevationAt(s, p) > Math.max(source2, target) + 0.5) return false;
  }
  return true;
}
function validateWorldMap(value2, options = {}) {
  const issues = [], record6 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!record6(value2)) return { valid: false, issues: ["Map must be an object."] };
  const map = value2;
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 8 || map.height < 8 || map.width > 128 || map.height > 128) return { valid: false, issues: ["Map dimensions must be integers from8 through128."] };
  if (!Number.isSafeInteger(map.seed) || map.seed < 0 || map.seed > 4294967295) issues.push("Map seed must be an unsigned32-bit integer.");
  if (!["small", "medium", "large", "huge"].includes(map.size)) issues.push("Unknown map size.");
  if (!Array.isArray(map.levels) || map.levels.length < 1 || map.levels.length > 2) return { valid: false, issues: [...issues, "Maps require one or two levels."] };
  const area = map.width * map.height, point5 = (p) => record6(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isInteger(p.level) && p.level >= 0 && p.level < map.levels.length && p.x >= 0.5 && p.y >= 0.5 && p.x <= map.width - 0.5 && p.y <= map.height - 0.5;
  for (let l = 0; l < map.levels.length; l++) {
    const level2 = map.levels[l];
    if (!record6(level2) || level2.id !== l || typeof level2.title !== "string" || level2.title.length > 80) issues.push(`Invalid level${l} title or identifier.`);
    if (!Array.isArray(level2?.terrain) || level2.terrain.length !== area || level2.terrain.some((t) => !Object.hasOwn(TERRAIN, t))) issues.push(`Level${l} terrain must contain one valid tile per map cell.`);
    if (!Array.isArray(level2?.elevation) || level2.elevation.length !== area || level2.elevation.some((e) => !Number.isInteger(e) || e < 0 || e > 3)) issues.push(`Level${l} elevation must contain integers0 through3.`);
  }
  if (issues.some((i) => i.includes("terrain") || i.includes("elevation"))) return { valid: false, issues };
  if (!Array.isArray(map.starts) || map.starts.length < 1 || map.starts.length > 8 || map.starts.some((p, i) => !point5(p) || p.slot !== i)) issues.push("Starting slots must be ordered0 through7 with valid coordinates.");
  if (!Array.isArray(map.resources) || map.resources.length > 2048 || map.resources.some((r) => !point5(r) || !["wood", "ore", "crystal"].includes(r.kind) || !Number.isFinite(r.amount) || !Number.isFinite(r.maxAmount) || r.amount < 0 || r.amount > r.maxAmount || r.maxAmount > 1e9)) issues.push("Invalid resource nodes.");
  if (!Array.isArray(map.sites) || map.sites.length > 128 || map.sites.some((p) => !point5(p) || !Number.isSafeInteger(p.id) || p.id < 1 || !["relic", "village", "monster"].includes(p.kind)) || new Set(map.sites?.map((p) => p.id)).size !== map.sites?.length) issues.push("Invalid or duplicate site definitions.");
  if (!Array.isArray(map.transitions) || map.transitions.length > 64 || map.transitions.some((t) => !record6(t) || !Number.isSafeInteger(t.id) || t.id < 1 || !point5(t.from) || !point5(t.to) || t.from.level === t.to.level) || new Set(map.transitions?.map((t) => t.id)).size !== map.transitions?.length) issues.push("Invalid or duplicate level entrances.");
  if (issues.length) return { valid: false, issues };
  const key = (p) => p.level * area + Math.floor(p.y) * map.width + Math.floor(p.x), decode = (k) => ({ level: Math.floor(k / area), x: k % area % map.width + 0.5, y: Math.floor(k % area / map.width) + 0.5 });
  const free = (p) => p.x >= 0.5 && p.y >= 0.5 && p.x < map.width && p.y < map.height && TERRAIN[map.levels[p.level].terrain[Math.floor(p.y) * map.width + Math.floor(p.x)]].walkable;
  for (const t of map.transitions) if (!free(t.from) || !free(t.to)) issues.push(`Entrance${t.id} must connect walkable tiles.`);
  const approaches = [];
  for (const start of map.starts) {
    if (!options.scenario && (start.x < 4 || start.y < 4 || start.x > map.width - 4 || start.y > map.height - 4)) issues.push(`Start${start.slot} has no room for its opening army.`);
    if (!options.scenario) {
      for (let y = Math.floor(start.y - 1.5); y < Math.ceil(start.y + 1.5); y++) for (let x = Math.floor(start.x - 1.5); x < Math.ceil(start.x + 1.5); x++) if (!TERRAIN[map.levels[start.level].terrain[y * map.width + x] ?? "rock"].buildable) issues.push(`Start${start.slot} stronghold footprint is blocked.`);
    }
    if (options.scenario) approaches.push({ ...start });
    else for (const [dx, dy] of [[0, 3], [0, -3], [3, 0], [-3, 0]]) approaches.push({ x: Math.floor(start.x + dx) + 0.5, y: Math.floor(start.y + dy) + 0.5, level: start.level });
  }
  const entrances = /* @__PURE__ */ new Map();
  for (const t of map.transitions) {
    const a = key(t.from), b = key(t.to);
    entrances.set(a, [...entrances.get(a) ?? [], b]);
    entrances.set(b, [...entrances.get(b) ?? [], a]);
  }
  const seen = /* @__PURE__ */ new Set(), queue = [], origin = approaches.find(free);
  if (origin) {
    queue.push(key(origin));
    seen.add(key(origin));
  }
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i], p = decode(current), e = map.levels[p.level].elevation[current % area];
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ ...p, x: p.x + dx, y: p.y + dy })).filter((n) => free(n) && Math.abs(map.levels[n.level].elevation[key(n) % area] - e) <= 1).map(key);
    for (const next of [...neighbors, ...entrances.get(current) ?? []]) if (!seen.has(next)) {
      seen.add(next);
      queue.push(next);
    }
  }
  if (approaches.some((p) => !seen.has(key(p)))) issues.push("Starting army approaches are disconnected by terrain or steep elevation.");
  for (const r of map.resources) {
    const reachable = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key({ ...r, x: Math.floor(r.x) + 0.5 + dx, y: Math.floor(r.y) + 0.5 + dy })));
    if (!reachable) issues.push(`Unreachable${r.kind} on level${r.level} at${r.x},${r.y}.`);
  }
  if (!options.scenario) {
    for (const start of map.starts) for (const kind of ["wood", "ore", "crystal"]) if (!map.resources.some((r) => r.kind === kind && r.level === start.level && length2D(r.x - start.x, r.y - start.y) < 9)) issues.push(`Start${start.slot} lacks nearby${kind}.`);
  }
  if (map.levels.length > 1 && !map.transitions.length) issues.push("The cavern has no entrance.");
  for (const site of map.sites) if (!seen.has(key(site))) issues.push(`Site${site.id} is unreachable.`);
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}
function generateWorldMap(seed, size = "medium", playerCount = 2, biome = "forest") {
  if (!BIOMES.includes(biome)) throw new Error("Unknown biome.");
  const base = generateMatchMap(seed, size, playerCount), { width, height } = base, area = width * height, terrain2 = [...base.terrain], elevation = Array(area).fill(0);
  const starts = base.starts.map((p, slot) => ({ ...p, level: 0, slot })), resources3 = base.resources.map((r) => ({ ...r, level: 0 }));
  const basePad = (x, y) => starts.some((p) => length2D(p.x - x, p.y - y) < 8.4);
  const kind = biome === "desert" ? "sand" : biome === "snow" ? "snow" : biome === "marsh" ? "mud" : "grass";
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (terrain2[i] !== "grass" || basePad(x + 0.5, y + 0.5)) continue;
    terrain2[i] = kind;
    const canonical3 = Math.min(i, area - 1 - i), noise = (Math.imul(seed ^ canonical3 ^ 2436741650, 2246822507) >>> 0) % 100;
    if (biome === "forest" && noise < 24 && !resources3.some((r) => length2D(r.x - x - 0.5, r.y - y - 0.5) < 2)) terrain2[i] = "forest";
    if (terrain2[i] !== "forest") elevation[i] = Math.max(0, Math.min(2, Math.floor(2.3 - Math.min(length2D(x + 0.5 - width * 0.35, y + 0.5 - height * 0.65), length2D(x + 0.5 - width * 0.65, y + 0.5 - height * 0.35)) / 5)));
  }
  for (let pass = 0; pass < 3; pass++) {
    const previous = [...elevation];
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!TERRAIN[terrain2[i]].walkable) continue;
      for (const j of [i - 1, i + 1, i - width, i + width]) if (TERRAIN[terrain2[j]].walkable) elevation[i] = Math.min(elevation[i], previous[j] + 1);
    }
  }
  const underground = Array(area).fill("rock"), caveElevation = Array(area).fill(0);
  const caveDisk = (p, r = 3) => {
    for (let y = Math.max(1, Math.floor(p.y - r)); y < Math.min(height - 1, Math.ceil(p.y + r)); y++) for (let x = Math.max(1, Math.floor(p.x - r)); x < Math.min(width - 1, Math.ceil(p.x + r)); x++) if (length2D(x + 0.5 - p.x, y + 0.5 - p.y) <= r) underground[y * width + x] = "road";
  };
  const carve = (a, b) => {
    const steps = Math.ceil(length2D(b.x - a.x, b.y - a.y) * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      caveDisk({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, 1.8);
    }
  };
  const center = { x: width / 2 + 0.5, y: height / 2 + 0.5 };
  caveDisk(center, 8);
  const transitions = starts.map((start, index2) => {
    const entrance = { x: Math.floor(start.x) + 0.5, y: Math.floor(start.y + (start.y < height / 2 ? 5 : -5)) + 0.5, level: 0 };
    for (let y = Math.floor(entrance.y - 1); y <= Math.floor(entrance.y + 1); y++) for (let x = Math.floor(entrance.x - 1); x <= Math.floor(entrance.x + 1); x++) terrain2[y * width + x] = "road";
    caveDisk(entrance, 3);
    carve(entrance, center);
    return { id: index2 + 1, from: entrance, to: { ...entrance, level: 1 } };
  });
  const sites = [{ id: 1, x: center.x, y: center.y, level: 1, kind: "relic" }, { id: 2, x: center.x - 5, y: center.y, level: 1, kind: "monster" }, { id: 3, x: center.x + 5, y: center.y, level: 1, kind: "village" }];
  for (const [dx, dy, resource, amount] of [[0, -5, "crystal", 1800], [-4, 4, "ore", 3600], [4, 4, "wood", 3e3]]) resources3.push({ x: center.x + dx, y: center.y + dy, level: 1, kind: resource, amount, maxAmount: amount });
  const result = { width, height, size: base.size, seed, levels: [{ id: 0, title: `${biome[0].toUpperCase()}${biome.slice(1)} surface`, terrain: terrain2, elevation }, { id: 1, title: "Contested caverns", terrain: underground, elevation: caveElevation }], starts, resources: resources3, sites, transitions };
  const validation = validateWorldMap(result);
  if (!validation.valid) throw new Error(`Invalid${biome} map: ${validation.issues.join("; ")}`);
  return result;
}
function generatedMapFromWorld(input, playerCount, options = {}) {
  const validation = validateWorldMap(input, options);
  if (!validation.valid) throw new Error(validation.issues.join("; "));
  if (input.starts.length !== playerCount) throw new Error("Map starting slots must match the roster.");
  return { size: input.size, seed: input.seed, width: input.width, height: input.height, terrain: [...input.levels[0].terrain], starts: input.starts.map((p) => ({ x: p.x, y: p.y, level: p.level })), resources: input.resources.map((r) => ({ ...r })), version: MAP_VERSION };
}
function initializeWorld(s, input, biome = "temperate") {
  const world2 = { version: 1, revision: 0, biome, levels: input.levels.map((l) => ({ ...l, terrain: [...l.terrain], elevation: [...l.elevation] })), transitions: input.transitions.map((t) => ({ id: t.id, from: { ...t.from }, to: { ...t.to } })), bridges: [], fires: [], sites: input.sites.map((site) => ({ ...site, id: s.nextId++, owner: null, loyalty: s.players.map(() => 0), progress: 0, capturing: null, reward: { wood: 180, ore: 100, crystal: 40 }, rewarded: [], request: { wood: 80, ore: 20, crystal: 0 }, supplied: false, creatureIds: [], respawnAt: 0 })), creatures: [], dayLength: 180, seasonLength: 240, weatherLength: 45, nextEnvironmentAt: 0, iceTiles: [], thawWarned: false };
  world2.levels[0].terrain = s.terrain;
  s.world = world2;
  for (const level2 of world2.levels) {
    const visited = /* @__PURE__ */ new Set();
    for (let tile = 0; tile < level2.terrain.length; tile++) {
      if (level2.terrain[tile] !== "bridge" || visited.has(tile)) continue;
      const queue = [tile];
      visited.add(tile);
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i], x = p % s.width, y = Math.floor(p / s.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * s.width + nx;
          if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height || level2.terrain[j] !== "bridge" || visited.has(j)) continue;
          visited.add(j);
          queue.push(j);
        }
      }
      const center = queue[Math.floor(queue.length / 2)];
      world2.bridges.push({ id: s.nextId++, x: center % s.width + 0.5, y: Math.floor(center / s.width) + 0.5, level: level2.id, hp: Math.max(160, queue.length * 25), maxHp: Math.max(160, queue.length * 25), tiles: queue, rebuilding: 0, repairSide: null });
    }
  }
  return world2;
}

// src/core/navigation.ts
var distance2 = (a, b) => length2D(a.x - b.x, a.y - b.y);
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var buildingRadius = (s, e) => buildingFor(s, e).size / 2 + 0.27;
function walkable(s, x, y, level2 = 0) {
  if (x < 0.35 || y < 0.35 || x > s.width - 0.35 || y > s.height - 0.35) return false;
  for (let ty = Math.floor(y - 0.27); ty <= Math.floor(y + 0.27); ty++) for (let tx = Math.floor(x - 0.27); tx <= Math.floor(x + 0.27); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5, level2)].walkable) return false;
  for (const b of s.entities) if (b.hp > 0 && b.kind === "building" && !b.gateOpen && levelOf2(b) === level2) {
    const r = buildingRadius(s, b);
    if (Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) return false;
  }
  for (const r of s.resources) if (r.amount > 0 && levelOf2(r) === level2 && length2D(r.x - x, r.y - y) < 0.7) return false;
  return true;
}
function segmentWalkable(s, a, b) {
  const level2 = levelOf2(a);
  if (!sameLevel2(a, b) || !walkable(s, a.x, a.y, level2) || !walkable(s, b.x, b.y, level2)) return false;
  const steps = Math.max(1, Math.ceil(distance2(a, b) * 5));
  let previous = elevationAt(s, a);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, level: level2 }, height = elevationAt(s, p);
    if (Math.abs(height - previous) > 1) return false;
    previous = height;
  }
  const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
  for (let y = Math.floor(Math.min(a.y, b.y) - 0.27); y <= Math.floor(Math.max(a.y, b.y) + 0.27); y++) for (let x = Math.floor(Math.min(a.x, b.x) - 0.27); x <= Math.floor(Math.max(a.x, b.x) + 0.27); x++) {
    if (TERRAIN[terrainAt(s, x + 0.5, y + 0.5, level2)].walkable) continue;
    let enter = 0, leave = 1;
    for (const [origin, delta, center] of [[a.x, dx, x + 0.5], [a.y, dy, y + 0.5]]) {
      if (delta === 0) {
        if (Math.abs(origin - center) >= 0.77) {
          enter = 1;
          leave = 0;
          break;
        }
      } else {
        const t1 = (center - 0.77 - origin) / delta, t2 = (center + 0.77 - origin) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
    }
    if (enter < leave) return false;
  }
  for (const r of s.resources) {
    if (r.amount <= 0 || levelOf2(r) !== level2) continue;
    const t = lengthSquared ? clamp(((r.x - a.x) * dx + (r.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
    if (length2D(a.x + t * dx - r.x, a.y + t * dy - r.y) < 0.7) return false;
  }
  for (const obstacle of s.entities) {
    if (obstacle.hp <= 0 || obstacle.kind !== "building" || obstacle.gateOpen || levelOf2(obstacle) !== level2) continue;
    const r = buildingRadius(s, obstacle);
    let enter = 0, leave = 1;
    for (const [origin, delta, center] of [[a.x, dx, obstacle.x], [a.y, dy, obstacle.y]]) {
      if (delta === 0) {
        if (Math.abs(origin - center) >= r) {
          enter = 1;
          leave = 0;
          break;
        }
      } else {
        const t1 = (center - r - origin) / delta, t2 = (center + r - origin) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
    }
    if (enter < leave) return false;
  }
  return true;
}
function openDestination(s, to, from) {
  const level2 = to.level ?? levelOf2(from);
  to = { ...to, ...level2 ? { level: level2 } : {} };
  if (level2 !== levelOf2(from)) return void 0;
  if (walkable(s, to.x, to.y, level2)) return to;
  const dx = from.x - to.x, dy = from.y - to.y, length2 = length2D(dx, dy), ux = length2 ? dx / length2 : 1, uy = length2 ? dy / length2 : 0;
  for (let r = 0.25; r <= 6; r += 0.25) for (const i of NEAREST_DIRECTION_INDICES_32) {
    const [x, y] = DIRECTIONS_32[i], p = { x: to.x + (ux * x - uy * y) * r, y: to.y + (uy * x + ux * y) * r, ...level2 ? { level: level2 } : {} };
    if (walkable(s, p.x, p.y, level2)) return p;
  }
  return void 0;
}
var grids = /* @__PURE__ */ new WeakMap();
function gridFor(s, CELL, level2) {
  const terrain2 = level2 === 0 ? s.terrain : s.world?.levels[level2]?.terrain ?? [], cacheKey = CELL + level2 * 100;
  const buildings2 = s.entities.filter((e) => e.hp > 0 && e.kind === "building" && !e.gateOpen && levelOf2(e) === level2);
  const resources3 = s.resources.filter((r) => r.amount > 0 && levelOf2(r) === level2);
  const signature = `${s.width},${s.height};${buildings2.map((b) => `${b.id},${b.x},${b.y},${buildingRadius(s, b)}`).join(";")}|${resources3.map((r) => `${r.id},${r.x},${r.y}`).join(";")}`;
  const terrainSignature = terrain2.map((kind) => TERRAIN[kind].walkable ? "1" : "0").join("") + "|" + (s.world?.levels[level2]?.elevation.join(",") ?? "");
  let caches2 = grids.get(s);
  if (!caches2) {
    caches2 = /* @__PURE__ */ new Map();
    grids.set(s, caches2);
  }
  const old = caches2.get(cacheKey);
  if (old?.signature === signature && old.terrain === terrain2 && old.terrainSignature === terrainSignature) return old;
  const width = Math.round(s.width / CELL), height = Math.round(s.height / CELL), blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if ((x + 0.5) * CELL < 0.35 || (y + 0.5) * CELL < 0.35 || (x + 0.5) * CELL > s.width - 0.35 || (y + 0.5) * CELL > s.height - 0.35) blocked[y * width + x] = 1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + 0.5) * CELL, py = (y + 0.5) * CELL;
    for (let ty = Math.floor(py - 0.27); ty <= Math.floor(py + 0.27); ty++) for (let tx = Math.floor(px - 0.27); tx <= Math.floor(px + 0.27); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5, level2)].walkable) blocked[y * width + x] = 1;
  }
  for (const b of [...buildings2, ...resources3]) {
    const r = "role" in b ? buildingRadius(s, b) : 0.7;
    for (let y = Math.max(0, Math.floor((b.y - r) / CELL)); y < Math.min(height, Math.ceil((b.y + r) / CELL)); y++) for (let x = Math.max(0, Math.floor((b.x - r) / CELL)); x < Math.min(width, Math.ceil((b.x + r) / CELL)); x++) {
      const dx = Math.abs((x + 0.5) * CELL - b.x), dy = Math.abs((y + 0.5) * CELL - b.y);
      if ("role" in b ? dx < r && dy < r : length2D(dx, dy) < r) blocked[y * width + x] = 1;
    }
  }
  const grid = { terrain: terrain2, terrainSignature, signature, width, height, blocked, edges: /* @__PURE__ */ new Map() };
  caches2.set(cacheKey, grid);
  return grid;
}
function route(s, from, to, reach, side2) {
  if (!sameLevel2(from, to)) return [];
  const coarse = routeOnGrid(s, from, to, reach, 0.5, side2);
  return coarse.length ? coarse : routeOnGrid(s, from, to, reach, 0.25, side2);
}
function routeOnGrid(s, from, to, reach, CELL, side2) {
  const level2 = levelOf2(from), grid = gridFor(s, CELL, level2), { width, height, blocked } = grid;
  const point5 = (k) => ({ x: (k % width + 0.5) * CELL, y: (Math.floor(k / width) + 0.5) * CELL, ...level2 ? { level: level2 } : {} });
  const sx = Math.floor(from.x / CELL), sy = Math.floor(from.y / CELL), start = sy * width + sx;
  const starts = [];
  if (!blocked[start] && segmentWalkable(s, from, point5(start))) starts.push(start);
  else for (let ring = 1; ring <= 4 && !starts.length; ring++) for (let y = Math.max(0, sy - ring); y <= Math.min(height - 1, sy + ring); y++) for (let x = Math.max(0, sx - ring); x <= Math.min(width - 1, sx + ring); x++) {
    const k = y * width + x;
    if (!blocked[k] && segmentWalkable(s, from, point5(k))) starts.push(k);
  }
  if (!starts.length) return [];
  const goals = /* @__PURE__ */ new Set(), rr = Math.max(reach + 0.2, 0.4);
  for (let y = Math.max(0, Math.floor((to.y - rr) / CELL)); y < Math.min(height, Math.ceil((to.y + rr) / CELL)); y++) for (let x = Math.max(0, Math.floor((to.x - rr) / CELL)); x < Math.min(width, Math.ceil((to.x + rr) / CELL)); x++) {
    const k = y * width + x;
    if (!blocked[k] && distance2(point5(k), to) <= rr) goals.add(k);
  }
  if (!goals.size) return [];
  const score = new Float64Array(width * height).fill(Infinity), parent = new Int32Array(width * height).fill(-1), closed = new Uint8Array(width * height), open = [];
  const push = (key, value2) => {
    let i = open.length;
    open.push({ key, score: value2 });
    while (i > 0) {
      const p = i - 1 >> 1;
      if (open[p].score <= value2) break;
      open[i] = open[p];
      i = p;
    }
    open[i] = { key, score: value2 };
  };
  const pop = () => {
    const top = open[0].key, last = open.pop();
    if (open.length) {
      let i = 0;
      while (i * 2 + 1 < open.length) {
        let child = i * 2 + 1;
        if (child + 1 < open.length && open[child + 1].score < open[child].score) child++;
        if (open[child].score >= last.score) break;
        open[i] = open[child];
        i = child;
      }
      open[i] = last;
    }
    return top;
  };
  const heuristic = (k) => Math.max(0, distance2(point5(k), to) - rr) / 1.15;
  for (const k of starts) {
    score[k] = distance2(from, point5(k));
    push(k, score[k] + heuristic(k));
  }
  let end = -1;
  while (open.length) {
    const k = pop();
    if (closed[k]) continue;
    if (goals.has(k)) {
      end = k;
      break;
    }
    closed[k] = 1;
    const x = k % width, y = Math.floor(k / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (blocked[n] || closed[n] || dx && dy && (blocked[y * width + nx] || blocked[ny * width + x])) continue;
      const edge = Math.min(k, n) * width * height + Math.max(k, n);
      let clear = grid.edges.get(edge);
      if (clear === void 0) {
        clear = segmentWalkable(s, point5(k), point5(n));
        grid.edges.set(edge, clear);
      }
      if (!clear) continue;
      const p = point5(n), terrain2 = terrainAt(s, p.x, p.y, level2), speed = (side2 !== void 0 ? factionFor(s, side2).terrainSpeeds?.[terrain2] : void 0) ?? TERRAIN[terrain2].speed;
      const value2 = score[k] + (dx && dy ? Math.SQRT2 : 1) * CELL / Math.max(0.1, speed);
      if (value2 < score[n]) {
        score[n] = value2;
        parent[n] = k;
        push(n, value2 + heuristic(n));
      }
    }
  }
  if (end === -1) return [];
  const result = [];
  for (let k = end; k !== -1; k = parent[k]) if (parent[k] !== -1 || distance2(from, point5(k)) > 0.08) result.push(point5(k));
  return result.reverse();
}

// src/core/match-rules.ts
var plain = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function fields(value2, allowed, name) {
  if (!plain(value2) || Object.keys(value2).some((key) => !allowed.includes(key))) throw new Error(`Invalid ${name}.`);
  return value2;
}
function num3(value2, min, max, name, integer2 = false) {
  if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < min || value2 > max || integer2 && !Number.isSafeInteger(value2)) throw new Error(`Invalid ${name}.`);
  return value2;
}
function bool(value2, name) {
  if (typeof value2 !== "boolean") throw new Error(`Invalid ${name}.`);
  return value2;
}
function money(value2, name) {
  const c = fields(value2, ["wood", "ore", "crystal"], name);
  return { wood: num3(c.wood, 0, 1e9, `${name} wood`), ore: num3(c.ore, 0, 1e9, `${name} ore`), crystal: num3(c.crystal, 0, 1e9, `${name} crystal`) };
}
var factionContext = (faction, content) => ({ content, players: [{ faction }] });
function definitionIds(content) {
  return [.../* @__PURE__ */ new Set(["economy:caravan", ...Object.keys(contentFactions(content)).flatMap((faction) => {
    const context = factionContext(faction, content);
    return [...availableUnits(context, 0).map((u) => u.id), ...Object.keys(upgradesFor(context, 0))];
  })])];
}
function normalizeMatchRules(value2 = {}, content) {
  const r = fields(value2, ["mode", "standardDefeat", "startingAge", "sharedVision", "friendlyFire", "startingResources", "disabledDefinitionIds", "hill", "relic", "survival", "draft"], "match rules");
  if (Object.values(r).some((v) => v === null)) throw new Error("Invalid null match rule.");
  const mode = r.mode ?? "annihilation";
  if (!["annihilation", "hill", "relic", "survival", "scenario"].includes(mode)) throw new Error("Unknown victory mode.");
  const h = fields(r.hill ?? {}, ["radius", "captureTicks", "holdTicks"], "hill rules"), l = fields(r.relic ?? {}, ["count", "required", "holdTicks", "pickupRadius"], "relic rules"), s = fields(r.survival ?? {}, ["defenderTeam", "waveCount", "intervalTicks", "recoveryTicks", "unitsPerWave", "rewardPerWave"], "survival rules"), d = fields(r.draft ?? {}, ["enabled", "banRounds", "pickRounds", "turnTicks"], "draft rules");
  if ([h, l, s, d].some((group) => Object.values(group).some((v) => v === null))) throw new Error("Invalid null objective or draft rule.");
  const disabled = r.disabledDefinitionIds ?? [];
  if (!Array.isArray(disabled) || disabled.length > 256 || disabled.some((id5) => typeof id5 !== "string" || id5.length > 128 || !definitionIds(content).includes(id5)) || new Set(disabled).size !== disabled.length) throw new Error("Disabled definitions must be unique known unit or technology IDs.");
  const rules = {
    mode,
    standardDefeat: bool(r.standardDefeat ?? (mode !== "scenario" && mode !== "survival"), "standard defeat"),
    startingAge: num3(r.startingAge ?? 1, 1, 3, "starting age", true),
    sharedVision: bool(r.sharedVision ?? true, "shared vision"),
    friendlyFire: bool(r.friendlyFire ?? true, "friendly fire"),
    startingResources: money(r.startingResources ?? { wood: 420, ore: 220, crystal: 0 }, "starting resources"),
    disabledDefinitionIds: [...disabled],
    hill: { radius: num3(h.radius ?? 5, 1, 12, "hill radius"), captureTicks: num3(h.captureTicks ?? 100, 1, 72e3, "hill capture duration", true), holdTicks: num3(h.holdTicks ?? 2400, 1, 72e3, "hill hold duration", true) },
    relic: { count: num3(l.count ?? 3, 1, 8, "relic count", true), required: num3(l.required ?? 2, 1, 8, "required relics", true), holdTicks: num3(l.holdTicks ?? 2400, 1, 72e3, "relic defense duration", true), pickupRadius: num3(l.pickupRadius ?? 1.5, 0.5, 4, "relic pickup radius") },
    survival: { defenderTeam: num3(s.defenderTeam ?? 0, 0, 7, "defender team", true), waveCount: num3(s.waveCount ?? 5, 1, 20, "wave count", true), intervalTicks: num3(s.intervalTicks ?? 1200, 20, 72e3, "wave interval", true), recoveryTicks: num3(s.recoveryTicks ?? 400, 1, 72e3, "recovery duration", true), unitsPerWave: num3(s.unitsPerWave ?? 2, 1, 20, "wave size", true), rewardPerWave: money(s.rewardPerWave ?? { wood: 60, ore: 30, crystal: 0 }, "wave reward") },
    draft: { enabled: bool(d.enabled ?? false, "draft enabled"), banRounds: num3(d.banRounds ?? 1, 0, 2, "ban rounds", true), pickRounds: num3(d.pickRounds ?? 3, 1, 6, "pick rounds", true), turnTicks: num3(d.turnTicks ?? 600, 20, 2400, "draft turn duration", true) }
  };
  if (rules.mode === "annihilation" && !rules.standardDefeat) throw new Error("Annihilation requires headquarters defeat.");
  if (rules.mode === "survival" && rules.standardDefeat) throw new Error("Survival must use its defender and wave defeat rules.");
  if (rules.relic.required > rules.relic.count) throw new Error("Required relic count exceeds the available relics.");
  return rules;
}
var draftOptions = (factionId, content) => {
  const context = factionContext(factionId, content);
  return [...availableUnits(context, 0).filter((u) => u.role !== "worker").map((u) => u.id), ...Object.keys(upgradesFor(context, 0)).filter((id5) => !["town-age", "citadel-age"].includes(id5))];
};
function createDraft(players, rules, content) {
  const pool = [...new Set(players.flatMap((p) => draftOptions(p.factionId, content)))].filter((id5) => !rules.disabledDefinitionIds.includes(id5)), order3 = [];
  if (rules.draft.enabled) {
    for (let round = 0; round < rules.draft.banRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order3.push({ side: p.id, action: "ban" });
    for (let round = 0; round < rules.draft.pickRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order3.push({ side: p.id, action: "pick" });
  }
  if (rules.draft.enabled && players.some((p) => draftOptions(p.factionId, content).filter((id5) => pool.includes(id5)).length < rules.draft.pickRounds + rules.draft.banRounds * players.length || !availableUnits(factionContext(p.factionId, content), 0).some((u) => u.role !== "worker" && pool.includes(u.id)))) throw new Error("Draft has too many bans/picks for the available faction definitions. Reduce bans or picks.");
  return { status: order3.length ? "drafting" : "complete", turn: 0, remainingTicks: order3.length ? rules.draft.turnTicks : 0, order: order3, banned: [], picks: players.map(() => []), pool };
}
function legalDraftChoices(draft, players, side2, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || turn?.side !== side2) return [];
  const pickGoal = (id5) => draft.order.filter((t) => t.side === id5 && t.action === "pick").length;
  return draft.pool.filter((id5) => {
    if (draft.banned.includes(id5) || draft.picks[side2]?.includes(id5)) return false;
    if (turn.action === "ban") return players.every((p) => draftOptions(p.factionId, content).filter((option) => draft.pool.includes(option) && option !== id5 && !draft.banned.includes(option)).length >= pickGoal(p.id) && combatIds(p.factionId, content).some((option) => draft.pool.includes(option) && option !== id5 && !draft.banned.includes(option)));
    if (!draftOptions(players[side2].factionId, content).includes(id5)) return false;
    return draft.picks[side2].length !== pickGoal(side2) - 1 || draft.picks[side2].some((option) => combatIds(players[side2].factionId, content).includes(option)) || combatIds(players[side2].factionId, content).includes(id5);
  });
}
var combatIds = (factionId, content) => availableUnits(factionContext(factionId, content), 0).filter((u) => u.role !== "worker").map((u) => u.id);
function applyDraftChoice(draft, rules, players, side2, definitionId2, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || !turn || turn.side !== side2 || !legalDraftChoices(draft, players, side2, content).includes(definitionId2)) return false;
  if (turn.action === "pick" && draft.picks[side2].length === rules.draft.pickRounds - 1 && !draft.picks[side2].some((id5) => combatIds(players[side2].factionId, content).includes(id5)) && !combatIds(players[side2].factionId, content).includes(definitionId2)) return false;
  if (turn.action === "ban" && players.some((p) => draftOptions(p.factionId, content).filter((id5) => draft.pool.includes(id5) && id5 !== definitionId2 && !draft.banned.includes(id5)).length < rules.draft.pickRounds || !combatIds(p.factionId, content).some((id5) => draft.pool.includes(id5) && id5 !== definitionId2 && !draft.banned.includes(id5)))) return false;
  if (turn.action === "pick") draft.picks[side2].push(definitionId2);
  else draft.banned.push(definitionId2);
  draft.turn++;
  draft.status = draft.turn === draft.order.length ? "complete" : "drafting";
  draft.remainingTicks = draft.status === "complete" ? 0 : rules.draft.turnTicks;
  return true;
}
function tickDraft(draft, rules, players, content) {
  if (draft.status === "complete") return false;
  if (--draft.remainingTicks > 0) return false;
  const turn = draft.order[draft.turn], choices = legalDraftChoices(draft, players, turn.side, content);
  for (const id5 of choices) if (applyDraftChoice(draft, rules, players, turn.side, id5, content)) return true;
  throw new Error("Draft turn has no legal choices.");
}
function draftPlayers(state) {
  return state.players.map((p, id5) => ({ id: id5, factionId: p.faction }));
}
function definitionAllowed(state, side2, id5) {
  if (state.rules.disabledDefinitionIds.includes(id5) || state.draft.banned.includes(id5)) return false;
  const necessary = id5 === "economy:caravan" || id5 === "town-age" || id5 === "citadel-age" || availableUnits(state, side2).some((unit5) => unit5.role === "worker" && unit5.id === id5);
  return !state.rules.draft.enabled || necessary || state.draft.status === "complete" && state.draft.picks[side2].includes(id5);
}
function validateModeRoster(state) {
  if (state.rules.mode !== "survival") return;
  if (!state.teams.includes(state.rules.survival.defenderTeam) || new Set(state.teams).size !== 2) throw new Error("Survival requires a defender team and one opposing wave team.");
  if (state.draft.status === "complete" && state.players.some((_player, side2) => state.teams[side2] !== state.rules.survival.defenderTeam && !availableUnits(state, side2).some((unit5) => unit5.role !== "worker" && definitionAllowed(state, side2, unit5.id)))) throw new Error("Every wave slot needs an enabled combat unit.");
}
function validateDraftState(value2, players, rules, content) {
  const d = fields(value2, ["status", "turn", "remainingTicks", "order", "banned", "picks", "pool"], "draft state"), expected = createDraft(players, rules, content);
  const turn = num3(d.turn, 0, expected.order.length, "draft turn", true);
  if (JSON.stringify(d.order) !== JSON.stringify(expected.order) || JSON.stringify(d.pool) !== JSON.stringify(expected.pool)) throw new Error("Draft order or pool differs from the match rules.");
  if (!Array.isArray(d.banned) || !Array.isArray(d.picks) || d.picks.length !== players.length || d.picks.some((p) => !Array.isArray(p) || p.length > rules.draft.pickRounds || p.some((id5) => typeof id5 !== "string"))) throw new Error("Invalid saved draft choices.");
  const choices = d.picks;
  const picked = players.map(() => 0);
  let banned = 0;
  for (let i = 0; i < turn; i++) {
    const action2 = expected.order[i], id5 = action2.action === "ban" ? d.banned[banned++] : choices[action2.side][picked[action2.side]++];
    if (typeof id5 !== "string" || !applyDraftChoice(expected, rules, players, action2.side, id5, content)) throw new Error("Saved draft contains an illegal choice.");
  }
  if (banned !== d.banned.length || picked.some((count, side2) => count !== choices[side2].length) || d.status !== expected.status) throw new Error("Saved draft choices do not match its turn.");
  expected.remainingTicks = num3(d.remainingTicks, expected.status === "drafting" ? 1 : 0, expected.status === "drafting" ? rules.draft.turnTicks : 0, "remaining draft ticks", true);
  return expected;
}
function validateSavedRules(value2, content) {
  const required = ["mode", "standardDefeat", "startingAge", "sharedVision", "friendlyFire", "startingResources", "disabledDefinitionIds", "hill", "relic", "survival", "draft"];
  const r = fields(value2, required, "saved rules");
  if (required.some((key) => !Object.hasOwn(r, key))) throw new Error("Saved match rules are incomplete.");
  for (const [key, names] of [["hill", ["radius", "captureTicks", "holdTicks"]], ["relic", ["count", "required", "holdTicks", "pickupRadius"]], ["survival", ["defenderTeam", "waveCount", "intervalTicks", "recoveryTicks", "unitsPerWave", "rewardPerWave"]], ["draft", ["enabled", "banRounds", "pickRounds", "turnTicks"]]]) {
    const nested = fields(r[key], [...names], `saved ${key} rules`);
    if (names.some((name) => !Object.hasOwn(nested, name))) throw new Error(`Saved ${key} rules are incomplete.`);
  }
  return normalizeMatchRules(r, content);
}
function validateObjectiveState(value2, state) {
  const o = fields(value2, ["hill", "relics", "relicHoldTicks", "survival"], "objective state"), h = fields(o.hill, ["x", "y", "level", "ownerTeam", "captureTeam", "captureTicks", "holdTicks", "contested"], "hill state"), wave = fields(o.survival, ["wave", "nextWaveTick", "spawnedIds", "phase"], "survival state");
  const team = (v) => {
    if (v === null) return null;
    const id5 = num3(v, 0, 7, "objective team", true);
    if (!state.teams.includes(id5)) throw new Error("Objective refers to an absent team.");
    return id5;
  };
  const point5 = (p) => ({ x: num3(p.x, 0, state.width, "objective x"), y: num3(p.y, 0, state.height, "objective y"), ...p.level === void 0 ? {} : { level: num3(p.level, 0, (state.world?.levels.length ?? 1) - 1, "objective level", true) } });
  const hill = { ...point5(h), ownerTeam: team(h.ownerTeam), captureTeam: team(h.captureTeam), captureTicks: num3(h.captureTicks, 0, state.rules.hill.captureTicks, "hill capture ticks", true), holdTicks: num3(h.holdTicks, 0, state.rules.hill.holdTicks, "hill hold ticks", true), contested: bool(h.contested, "contested hill") };
  if (!Array.isArray(o.relics) || o.relics.length !== (state.rules.mode === "relic" ? state.rules.relic.count : 0)) throw new Error("Invalid saved relic count.");
  const relics = o.relics.map((v, i) => {
    const r = fields(v, ["id", "x", "y", "level", "carrierId", "heldTeam"], "relic state");
    if (r.id !== i + 1) throw new Error("Invalid saved relic ID.");
    const carrierId = r.carrierId === null ? null : num3(r.carrierId, 1, state.nextId - 1, "relic carrier ID", true);
    if (carrierId !== null && !state.entities.some((e) => e.id === carrierId && e.kind === "unit" && e.hp > 0 && !e.illusion)) throw new Error("Relic carrier must be a living ordinary unit.");
    if (carrierId !== null && levelOf2(r) !== levelOf2(state.entities.find((e) => e.id === carrierId))) throw new Error("Relic and carrier must share a map level.");
    const heldTeam = team(r.heldTeam);
    if (carrierId !== null && heldTeam !== null) throw new Error("Carried relic cannot be held in a shrine.");
    return { id: i + 1, ...point5(r), carrierId, heldTeam };
  });
  const carriers = relics.flatMap((r) => r.carrierId === null ? [] : [r.carrierId]);
  if (new Set(carriers).size !== carriers.length) throw new Error("Unit cannot carry multiple relics.");
  if (!Array.isArray(o.relicHoldTicks) || o.relicHoldTicks.length !== 8) throw new Error("Invalid relic defense counters.");
  const relicHoldTicks = o.relicHoldTicks.map((v) => num3(v, 0, state.rules.relic.holdTicks, "relic defense counter", true));
  if (!Array.isArray(wave.spawnedIds) || wave.spawnedIds.length > state.rules.survival.unitsPerWave * state.rules.survival.waveCount) throw new Error("Invalid survival wave IDs.");
  const spawnedIds = wave.spawnedIds.map((v) => num3(v, 1, state.nextId - 1, "wave entity ID", true));
  if (new Set(spawnedIds).size !== spawnedIds.length) throw new Error("Duplicate survival attacker ID.");
  if (!["waiting", "fighting", "recovery", "complete"].includes(wave.phase)) throw new Error("Unknown survival phase.");
  return { hill, relics, relicHoldTicks, survival: { wave: num3(wave.wave, 0, state.rules.survival.waveCount, "survival wave", true), nextWaveTick: num3(wave.nextWaveTick, 0, 1e12, "next wave tick", true), spawnedIds, phase: wave.phase } };
}

// src/core/presentation-observation.ts
var disclosedStates = /* @__PURE__ */ new WeakSet();
var isServerObservation = (state) => disclosedStates.has(state);

// src/core/progression.ts
var AGE_NAMES = { 1: "Settlement Age", 2: "Town Age", 3: "Citadel Age" };
function buildingAgeRequired(def) {
  return def.age ?? (def.role === "hq" ? 2 : 1);
}
function playerAge(player) {
  return player.upgrades.includes("citadel-age") ? 3 : player.upgrades.includes("town-age") ? 2 : 1;
}
function requirement(s, side2, id5, excludeEntity) {
  const player = s.players[side2], def = upgradeFor(s, side2, id5);
  if (player.upgrades.includes(id5)) return "Already researched";
  const pending = s.entities.filter((e) => e.id !== excludeEntity && e.side === side2 && e.hp > 0 && e.research);
  if (pending.some((e) => e.research === id5)) return "Already researching";
  if (def.exclusiveGroup) {
    const chosen = player.upgrades.find((other) => upgradeFor(s, side2, other).exclusiveGroup === def.exclusiveGroup);
    if (chosen) return `Locked by ${upgradeFor(s, side2, chosen).name}`;
    const reserved2 = pending.find((e) => upgradeFor(s, side2, e.research).exclusiveGroup === def.exclusiveGroup);
    if (reserved2) return `Locked while ${upgradeFor(s, side2, reserved2.research).name} is researching`;
  }
  if (playerAge(player) < (def.age ?? 1)) return `Requires ${AGE_NAMES[def.age]}`;
  const missing = def.requires?.find((required) => !player.upgrades.includes(required));
  if (missing) return `Requires ${upgradeFor(s, side2, missing).name}`;
  return void 0;
}
function researchRequirement(s, side2, id5) {
  return requirement(s, side2, id5);
}
function canCompleteResearch(s, side2, id5, entityId) {
  return requirement(s, side2, id5, entityId) === void 0;
}
function upgradeAppliesTo(upgrade, unit5) {
  return upgrade.appliesTo === unit5.role && (!upgrade.appliesToDefinitions || upgrade.appliesToDefinitions.includes(unit5.id));
}

// src/core/faction-systems.ts
var distance3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var sameLevel3 = (a, b) => (a.level ?? 0) === (b.level ?? 0);
var allied = (s, a, b) => s.teams[a] === s.teams[b];
var observed = (s, side2, p) => s.visible[side2]?.has((p.level ?? 0) * s.width * s.height + Math.floor(p.y) * s.width + Math.floor(p.x)) ?? false;
var real = (e) => e.hp > 0 && e.kind === "unit" && !e.illusion && !isCrewless(e);
function initializeFactionSystems(s) {
  return s.factionSystems ??= { version: 1, fury: s.players.map(() => 0), terrainEffects: [] };
}
function owned(s, side2, ids) {
  return s.entities.filter((e) => e.side === side2 && real(e) && ids.includes(e.id)).sort((a, b) => a.id - b.id);
}
function affordable(s, side2, cost5) {
  return ["wood", "ore", "crystal"].every((kind) => s.players[side2][kind] >= cost5[kind]);
}
function pay(s, side2, cost5) {
  for (const kind of ["wood", "ore", "crystal"]) s.players[side2][kind] -= cost5[kind];
}
function note(s, e, text3, target) {
  s.events.push({ type: "message", x: e.x, y: e.y, side: e.side, source: e.id, text: text3, target });
}
function military(e) {
  return real(e) && e.role !== "worker" && e.role !== "siege";
}
function isFactionCaster(s, e, ability) {
  return real(e) && e.role === "special" && tacticalUnitDef(s, e).ability === ability;
}
function isCorpseWagon(e) {
  return e.definitionId === "core:undead-corpse-wagon";
}
function isFactionCommand(c) {
  return ["warChant", "trophyStandard", "illusionSwap", "modifyArtillery", "buildFactionStructure", "tunnelTravel", "collectCorpses", "deliverCorpses", "shapeWater"].includes(c.type);
}
function factionCommandReason(s, side2, c) {
  if (!s.players[side2] || s.eliminated[side2] || s.winner !== null || s.draw) return "This player cannot issue faction orders.";
  const units = owned(s, side2, c.ids);
  if (!units.length) return "Select eligible owned troops.";
  const faction = s.players[side2].faction;
  if (c.type === "warChant") {
    if (faction !== "orcs") return "War chants require the Ironclad.";
    if (!units.some(military)) return "Select combat troops for the chant.";
    return (s.factionSystems?.fury[side2] ?? 0) >= 25 ? null : "Need 25 Fury.";
  }
  if (c.type === "trophyStandard") return faction === "orcs" && units.some((e) => military(e) && (e.factionState?.trophyKills ?? 0) >= 2) ? null : "A victorious Ironclad troop needs two trophies.";
  if (c.type === "illusionSwap") {
    if (faction !== "fairies") return "Illusion swapping requires the Wild Court.";
    const target = s.entities.find((e) => e.id === c.target && e.side === side2 && e.hp > 0 && e.illusion);
    if (!target) return "Choose an owned living illusion.";
    if (!units.some((e) => military(e) && sameLevel3(e, target) && distance3(e, target) <= 10 && (e.factionState?.swapReadyAt ?? 0) <= s.time)) return "Select a ready combat troop within ten tiles of the illusion.";
    return affordable(s, side2, { wood: 0, ore: 0, crystal: 15 }) ? null : "Need 15 crystal.";
  }
  if (c.type === "modifyArtillery") {
    if (faction !== "dwarves") return "Workshop modifications require Deepforge.";
    if (!units.some((e) => e.role === "siege" || e.role === "special" && isFactionCaster(s, e, "entrench"))) return "Select a siege engine or a Siege Cannon.";
    return affordable(s, side2, { wood: 25 * units.filter((e) => e.role === "siege" || isFactionCaster(s, e, "entrench")).length, ore: 20 * units.filter((e) => e.role === "siege" || isFactionCaster(s, e, "entrench")).length, crystal: 0 }) ? null : "Need 25 wood and 20 ore per artillery unit.";
  }
  if (c.type === "buildFactionStructure") {
    const info = FACTION_STRUCTURE_INFO[c.structure];
    if (!info || faction !== info.faction) return "That structure belongs to another faction.";
    if (!units.some((e) => e.role === "worker" && (e.level ?? 0) === (c.level ?? 0))) return "Select a worker on the construction level.";
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x < 1.5 || c.y < 1.5 || c.x > s.width - 1.5 || c.y > s.height - 1.5) return "Choose an in-bounds construction point.";
    if (!observed(s, side2, c)) return "The construction point must be visible.";
    return affordable(s, side2, info.definition.cost) ? null : `Need ${info.definition.cost.wood} wood, ${info.definition.cost.ore} ore and ${info.definition.cost.crystal} crystal.`;
  }
  if (c.type === "tunnelTravel") {
    if (faction !== "dwarves") return "Tunnel travel requires Deepforge.";
    const target = s.entities.find((e) => e.id === c.target && e.side === side2 && e.hp > 0 && e.progress === 1 && e.definitionId === FACTION_STRUCTURE_INFO.tunnel.definition.id);
    if (!target) return "Choose a completed owned tunnel entrance.";
    return units.some((e) => !e.raised && s.entities.some((t) => t.id !== target.id && t.side === side2 && t.hp > 0 && t.progress === 1 && t.definitionId === target.definitionId && sameLevel3(t, e) && distance3(t, e) <= 3)) ? null : "Troops must stand within three tiles of another completed entrance.";
  }
  if (c.type === "collectCorpses") {
    if (faction !== "undead" || !units.some(isCorpseWagon)) return "Select an Ashen Host corpse wagon.";
    const corpse = s.corpses.find((body) => body.id === c.target && body.expires > s.time && observed(s, side2, body));
    if (!corpse) return "Choose a visible unclaimed body.";
    return units.some((e) => isCorpseWagon(e) && sameLevel3(e, corpse) && (e.factionState?.corpseCargo?.length ?? 0) < 6) ? null : "The wagon is full or on another level.";
  }
  if (c.type === "deliverCorpses") {
    if (faction !== "undead" || !units.some((e) => isCorpseWagon(e) && e.factionState?.corpseCargo?.some((body) => body.expires > s.time))) return "Select a corpse wagon carrying a fresh body.";
    const target = s.entities.find((e) => e.id === c.target && e.side === side2 && isFactionCaster(s, e, "raise"));
    return target && units.some((e) => isCorpseWagon(e) && sameLevel3(e, target) && e.factionState?.corpseCargo?.some((body) => body.expires > s.time)) ? null : "Choose an owned Gravecaller on the wagon level.";
  }
  if (faction !== "tideborn") return "Water shaping requires the Tideborn.";
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !observed(s, side2, c)) return "Choose visible ground.";
  if (!units.some((e) => isFactionCaster(s, e, "surge") && sameLevel3(e, c) && distance3(e, c) <= 6 && (e.factionState?.waterReadyAt ?? 0) <= s.time)) return "Select a ready Tidecaller within six tiles.";
  return affordable(s, side2, { wood: 0, ore: 0, crystal: 25 }) ? null : "Need 25 crystal.";
}
function factionConcealment(s, e) {
  return real(e) && e.role !== "worker" && e.role !== "siege" && s.entities.some((g) => g.hp > 0 && g.progress === 1 && g.definitionId === FACTION_STRUCTURE_INFO["enchanted-grove"].definition.id && allied(s, g.side, e.side) && sameLevel3(g, e) && distance3(g, e) <= 4) && s.time - (e.lastDamagedAt ?? -100) > 2 && e.animation !== "attack";
}
function factionDamageFactor(s, e, target) {
  let factor = 1;
  const f = e.factionState;
  if (f?.chant?.kind === "assault" && f.chant.until > s.time) factor *= 1.25;
  if (s.entities.some((b) => b.hp > 0 && (!b.expires || b.expires > s.time) && b.progress === 1 && b.definitionId === TROPHY_STANDARD.id && allied(s, b.side, e.side) && sameLevel3(b, e) && distance3(b, e) <= 6)) factor *= 1.1;
  if (f?.artillery === "grapeshot" && target?.kind === "unit") factor *= 1.5;
  if (f?.artillery === "stone" && target?.kind === "building") factor *= 1.25;
  if (e.kind === "building" && s.players[e.side].faction === "automata" && f?.power?.connected && e.role === "tower") factor *= 1.25;
  return factor;
}
function factionArmorBonus(s, e) {
  return (e.factionState?.chant?.kind === "bulwark" && e.factionState.chant.until > s.time ? 3 : 0) + (e.factionState?.artillery === "reinforced" ? 3 : 0);
}
function factionMovementFactor(e) {
  return e.factionState?.artillery === "reinforced" ? 0.85 : 1;
}
function factionSplashRadius(e) {
  return e.factionState?.artillery === "grapeshot" ? 2.5 : 1.75;
}
function factionCanFire(s, e) {
  return !isCorpseWagon(e) && !(e.kind === "building" && e.role === "tower" && s.players[e.side].faction === "automata" && !e.factionState?.power?.connected);
}
function issueFactionCommand(s, side2, c, h) {
  if (factionCommandReason(s, side2, c)) return false;
  const system = initializeFactionSystems(s), units = owned(s, side2, c.ids);
  if (c.type === "warChant") {
    system.fury[side2] -= 25;
    for (const e of units.filter(military)) (e.factionState ??= {}).chant = { kind: c.chant, until: s.time + 12 };
    note(s, units[0], `${c.chant === "assault" ? "Assault" : "Bulwark"} chant: 25 Fury spent`);
    return true;
  }
  if (c.type === "trophyStandard") {
    const e = units.find((e2) => military(e2) && (e2.factionState?.trophyKills ?? 0) >= 2), point5 = h.openDestination({ x: e.x + 1, y: e.y, level: e.level }, e);
    if (!point5 || !h.canPlace(side2, point5, TROPHY_STANDARD.id)) return false;
    e.factionState.trophyKills -= 2;
    const banner = h.spawnDefinition(side2, TROPHY_STANDARD.id, point5, 1);
    banner.expires = s.time + 180;
    note(s, e, "Trophy standard raised", banner.id);
    return true;
  }
  if (c.type === "illusionSwap") {
    const target = s.entities.find((e2) => e2.id === c.target), e = units.find((e2) => military(e2) && sameLevel3(e2, target) && distance3(e2, target) <= 10 && (e2.factionState?.swapReadyAt ?? 0) <= s.time);
    const from = h.openDestination(e, e), to = h.openDestination(target, target);
    if (!from || !to || distance3(from, e) > 1e-3 || distance3(to, target) > 1e-3) return false;
    pay(s, side2, { wood: 0, ore: 0, crystal: 15 });
    const p = { x: e.x, y: e.y, level: e.level };
    e.x = target.x;
    e.y = target.y;
    e.level = target.level;
    target.x = p.x;
    target.y = p.y;
    target.level = p.level;
    for (const actor3 of [e, target]) {
      h.assignOrder(actor3, { type: "hold" });
      delete actor3.tactics?.formation;
    }
    (e.factionState ??= {}).swapReadyAt = s.time + 10;
    note(s, e, "Position exchanged with an illusion", target.id);
    return true;
  }
  if (c.type === "modifyArtillery") {
    const artillery = units.filter((e) => e.role === "siege" || e.role === "special" && isFactionCaster(s, e, "entrench"));
    pay(s, side2, { wood: 25 * artillery.length, ore: 20 * artillery.length, crystal: 0 });
    for (const e of artillery) (e.factionState ??= {}).artillery = c.modification;
    note(s, artillery[0], `Workshop fitted ${c.modification}`);
    return true;
  }
  if (c.type === "buildFactionStructure") {
    const info = FACTION_STRUCTURE_INFO[c.structure];
    if (!h.canPlace(side2, c, info.definition.id)) return false;
    pay(s, side2, info.definition.cost);
    const building5 = h.spawnDefinition(side2, info.definition.id, c, 0);
    h.recordPaid(building5, info.definition.cost);
    for (const e of units.filter((e2) => e2.role === "worker" && sameLevel3(e2, c))) {
      h.assignOrder(e, { type: "build", target: building5.id });
      delete e.tactics?.formation;
    }
    note(s, units[0], `${info.definition.name} construction ordered`, building5.id);
    return true;
  }
  if (c.type === "tunnelTravel") {
    const target = s.entities.find((e) => e.id === c.target);
    let assigned = false;
    for (const e of units) if (!e.raised && s.entities.some((t) => t.id !== target.id && t.side === side2 && t.hp > 0 && t.progress === 1 && t.definitionId === target.definitionId && sameLevel3(t, e) && distance3(t, e) <= 3)) {
      h.assignOrder(e, { type: "hold" });
      (e.factionState ??= {}).tunnel = { target: target.id, progress: 0 };
      delete e.tactics?.formation;
      assigned = true;
    }
    return assigned;
  }
  if (c.type === "collectCorpses" || c.type === "deliverCorpses") {
    const target = c.type === "collectCorpses" ? s.corpses.find((body) => body.id === c.target) : s.entities.find((e) => e.id === c.target), eligible3 = units.filter((e) => isCorpseWagon(e) && sameLevel3(e, target) && (c.type === "collectCorpses" ? (e.factionState?.corpseCargo?.length ?? 0) < 6 : !!e.factionState?.corpseCargo?.some((body) => body.expires > s.time)));
    for (const e of eligible3) {
      h.assignOrder(e, { type: "hold" });
      (e.factionState ??= {}).corpseOrder = { type: c.type === "collectCorpses" ? "collect" : "deliver", target: c.target, progress: 0 };
    }
    return eligible3.length > 0;
  }
  const casterUnit = units.find((e) => isFactionCaster(s, e, "surge") && sameLevel3(e, c) && distance3(e, c) <= 6 && (e.factionState?.waterReadyAt ?? 0) <= s.time);
  const tiles = [];
  for (let y = Math.max(0, Math.floor(c.y - 2)); y <= Math.min(s.height - 1, Math.floor(c.y + 2)); y++) for (let x = Math.max(0, Math.floor(c.x - 2)); x <= Math.min(s.width - 1, Math.floor(c.x + 2)); x++) {
    const p = { x: x + 0.5, y: y + 0.5, level: c.level ?? 0 }, before = h.terrainAt(p);
    if (distance3(p, c) <= 2 && observed(s, side2, p) && !["rock", "bridge", "forest"].includes(before) && !s.entities.some((e) => e.hp > 0 && e.kind === "building" && sameLevel3(e, p) && distance3(e, p) < 1.7) && !s.resources.some((r) => r.amount > 0 && sameLevel3(r, p) && distance3(r, p) < 0.8) && !(c.terrain === "water" && s.entities.some((e) => e.hp > 0 && e.kind === "unit" && sameLevel3(e, p) && distance3(e, p) < 0.8)) && before !== c.terrain) tiles.push({ ...p, before: system.terrainEffects.flatMap((effect) => effect.tiles).find((tile) => sameLevel3(tile, p) && tile.x === p.x && tile.y === p.y)?.before ?? before, after: c.terrain });
  }
  if (!tiles.length) return false;
  pay(s, side2, { wood: 0, ore: 0, crystal: 25 });
  for (const tile of tiles) h.setTerrain(tile, tile.after);
  system.terrainEffects.push({ id: s.nextId++, side: side2, until: s.time + 20, tiles });
  (casterUnit.factionState ??= {}).waterReadyAt = s.time + 20;
  note(s, casterUnit, "Water-shaped approach lasts twenty seconds");
  return true;
}
function recordFactionDamage(s, source2, amount) {
  if (source2 && source2.kind === "unit" && !source2.illusion && s.players[source2.side].faction === "orcs") initializeFactionSystems(s).fury[source2.side] = Math.min(100, initializeFactionSystems(s).fury[source2.side] + Math.max(0, amount) * 0.12);
}
function recordFactionDeath(s, victim, sourceSide) {
  if (victim.kind !== "unit" || victim.illusion || victim.raised) return;
  const source2 = s.entities.find((e) => e.id === victim.lastAttacker && (sourceSide === void 0 || e.side === sourceSide));
  if (source2 && source2.kind === "unit" && !source2.illusion && s.players[source2.side].faction === "orcs" && !allied(s, source2.side, victim.side)) (source2.factionState ??= {}).trophyKills = (source2.factionState?.trophyKills ?? 0) + 1;
}
function stepFactionActor(s, e, dt, h) {
  const f = e.factionState;
  if (!f) return false;
  if (f.chant && f.chant.until <= s.time) delete f.chant;
  if (f.corpseCargo) f.corpseCargo = f.corpseCargo.filter((body) => body.expires > s.time);
  if (f.deliveredCorpses) f.deliveredCorpses = f.deliveredCorpses.filter((body) => body.expires > s.time);
  if (f.tunnel) {
    const destination = s.entities.find((t) => t.id === f.tunnel.target && t.hp > 0 && t.side === e.side && t.progress === 1 && t.definitionId === FACTION_STRUCTURE_INFO.tunnel.definition.id), entrance = s.entities.find((t) => t.id !== destination?.id && t.hp > 0 && t.side === e.side && t.progress === 1 && t.definitionId === FACTION_STRUCTURE_INFO.tunnel.definition.id && sameLevel3(t, e) && distance3(t, e) <= 3);
    if (!destination || !entrance || s.time - (e.lastDamagedAt ?? -100) < 0.2) {
      delete f.tunnel;
      return false;
    }
    f.tunnel.progress = Math.min(1, f.tunnel.progress + dt / 3);
    if (f.tunnel.progress >= 1) {
      const point5 = h.openDestination({ x: destination.x + 1.8, y: destination.y, level: destination.level }, destination);
      if (point5) {
        e.x = point5.x;
        e.y = point5.y;
        e.level = point5.level;
        e.path = [];
        e.order = { type: "hold" };
        delete f.tunnel;
        note(s, e, "Squad arrived through the tunnel", destination.id);
      }
    }
    return true;
  }
  if (f.corpseOrder) {
    const order3 = f.corpseOrder, target = order3.type === "collect" ? s.corpses.find((body) => body.id === order3.target && body.expires > s.time && observed(s, e.side, body)) : s.entities.find((t) => t.id === order3.target && t.side === e.side && isFactionCaster(s, t, "raise"));
    if (!target || !sameLevel3(e, target)) {
      delete f.corpseOrder;
      return false;
    }
    if (distance3(e, target) > 1.4) {
      h.move(e, target, dt, 1.3);
      order3.progress = 0;
      return true;
    }
    order3.progress = Math.min(1, order3.progress + dt);
    if (order3.progress < 1) return true;
    if (order3.type === "collect") {
      if ((f.corpseCargo?.length ?? 0) < 6) {
        const index2 = s.corpses.findIndex((body) => body.id === target.id);
        if (index2 >= 0) (f.corpseCargo ??= []).push(s.corpses.splice(index2, 1)[0]);
        note(s, e, "Body loaded without extending its decay deadline", target.id);
      }
    } else {
      const recipient = target, cargo = f.corpseCargo ??= [];
      recipient.factionState ??= {};
      const cache = recipient.factionState.deliveredCorpses ??= [];
      const delivered = cargo.splice(0, Math.max(0, 12 - cache.length));
      cache.push(...delivered.map((body) => ({ ...body, x: recipient.x, y: recipient.y, level: recipient.level })));
      note(s, e, `Delivered ${delivered.length} bodies to a Gravecaller`, recipient.id);
    }
    delete f.corpseOrder;
    return true;
  }
  return false;
}
function refreshPowerNetworks(s, dt) {
  for (const side2 of s.players.map((_, i) => i)) {
    if (s.players[side2].faction !== "automata") continue;
    const nodes = s.entities.filter((e) => e.side === side2 && e.kind === "building" && e.hp > 0 && e.progress === 1).sort((a, b) => a.id - b.id), roots = /* @__PURE__ */ new Map(), visited = /* @__PURE__ */ new Set();
    for (const first of nodes) {
      if (visited.has(first.id)) continue;
      const component = [first];
      visited.add(first.id);
      for (let i = 0; i < component.length; i++) for (const e of nodes) if (!visited.has(e.id) && sameLevel3(e, component[i]) && distance3(e, component[i]) <= 8) {
        visited.add(e.id);
        component.push(e);
      }
      const root = component.filter((e) => e.role === "hq").sort((a, b) => a.id - b.id)[0]?.id ?? null;
      for (const e of component) roots.set(e.id, root);
    }
    for (const node of nodes) {
      const root = roots.get(node.id) ?? null, power = (node.factionState ??= {}).power = { connected: root !== null, root };
      node.maxShield ??= 80;
      node.shield ??= 80;
      if (power.connected && s.time - (node.lastDamagedAt ?? -100) > 6) node.shield = Math.min(node.maxShield, node.shield + dt * 2);
    }
  }
}
function absorbFactionShield(s, target, amount) {
  if (target.kind !== "building" || !target.factionState?.power?.connected) return 0;
  const nodes = s.entities.filter((e) => e.side === target.side && e.hp > 0 && e.kind === "building" && e.factionState?.power?.connected && e.factionState.power.root === target.factionState.power.root && sameLevel3(e, target)).sort((a, b) => distance3(a, target) - distance3(b, target) || a.id - b.id);
  let remaining = amount;
  for (const node of nodes) {
    const absorbed = Math.min(node.shield ?? 0, remaining);
    if (absorbed) {
      node.shield -= absorbed;
      remaining -= absorbed;
      node.lastDamagedAt = s.time;
    }
    if (remaining <= 0) break;
  }
  return amount - remaining;
}
function stepFactionSystems(s, dt, h) {
  const system = initializeFactionSystems(s), expired = system.terrainEffects.filter((effect) => effect.until <= s.time);
  for (const effect of expired) for (const tile of effect.tiles) if (h.terrainAt(tile) === tile.after && !system.terrainEffects.some((other) => other !== effect && other.until > s.time && other.tiles.some((p) => sameLevel3(p, tile) && p.x === tile.x && p.y === tile.y))) h.setTerrain(tile, tile.before);
  system.terrainEffects = system.terrainEffects.filter((effect) => effect.until > s.time);
  refreshPowerNetworks(s, dt);
  for (const e of s.entities) {
    if (e.hp <= 0 || e.kind !== "unit" || e.illusion || isCrewless(e)) continue;
    const standard = s.entities.some((b) => b.hp > 0 && (!b.expires || b.expires > s.time) && b.progress === 1 && b.definitionId === TROPHY_STANDARD.id && allied(s, b.side, e.side) && sameLevel3(b, e) && distance3(b, e) <= 6);
    if (standard) initializeTactics(s, e).morale = Math.min(100, initializeTactics(s, e).morale + dt * 3);
    if (e.raised && s.entities.some((b) => b.hp > 0 && b.progress === 1 && b.definitionId === FACTION_STRUCTURE_INFO.necropolis.definition.id && allied(s, b.side, e.side) && sameLevel3(b, e) && distance3(b, e) <= 6)) {
      e.expires += dt;
      e.hp = Math.min(e.maxHp, e.hp + dt * 2);
    }
  }
  for (const grove of s.entities.filter((e) => e.hp > 0 && e.progress === 1 && e.definitionId === FACTION_STRUCTURE_INFO["enchanted-grove"].definition.id)) {
    const f = grove.factionState ??= {};
    if (s.time < (f.nextDecoyAt ?? 0)) continue;
    const scout = s.entities.filter((e) => real(e) && e.role === "cavalry" && !allied(s, e.side, grove.side) && sameLevel3(e, grove) && canObserveTacticalEntity(s, grove.side, e) && distance3(e, grove) < 8).sort((a, b) => distance3(a, grove) - distance3(b, grove) || a.id - b.id)[0];
    if (!scout) continue;
    const template = s.entities.find((e) => real(e) && military(e) && e.side === grove.side && sameLevel3(e, grove) && distance3(e, grove) <= 4 && definitionAllowed(s, grove.side, tacticalUnitDef(s, e).id));
    if (!template) continue;
    const point5 = h.openDestination({ x: grove.x + Math.sign(scout.x - grove.x) * 2, y: grove.y + Math.sign(scout.y - grove.y) * 2, level: grove.level }, grove);
    if (!point5) continue;
    const clone2 = { ...structuredClone(template), id: s.nextId++, x: point5.x, y: point5.y, level: point5.level, hp: template.maxHp * 0.4, maxHp: template.maxHp * 0.4, illusion: true, expires: s.time + 15, cooldown: 100, order: { type: "move", x: scout.x, y: scout.y }, path: [], tactics: void 0, factionState: void 0 };
    delete clone2.orderQueue;
    s.entities.push(clone2);
    f.nextDecoyAt = s.time + 20;
    note(s, grove, "Grove sent a decoy toward an observed scout", clone2.id);
  }
}

// src/core/commander-rules.ts
function commanderAdmissionReason(s, side2) {
  for (const e of s.entities) if (e.side === side2 && e.hp > 0) {
    if (e.kind === "unit" && !e.illusion && !e.raised && unitFor(s, e).tags?.includes("hero")) return "A commander is already alive or queued";
    if (e.kind === "building" && e.queue.some((_, index2) => queuedUnitFor(s, e, index2).tags?.includes("hero"))) return "A commander is already alive or queued";
  }
  const availableAt = Math.max(s.time, ...s.players[side2].heroRecovery?.map((r) => r.availableAt) ?? []);
  if (availableAt > s.time) return `Commander recovery: ${Math.ceil(availableAt - s.time)}s`;
  return void 0;
}

// src/core/tactics.ts
var TACTICS = { frontCos: 0.5, sideDamage: 1.2, rearDamage: 1.4, coverFactor: 0.65, shieldFraction: 0.6, shieldReach: 3.5, shieldWidth: 1.4, chargeDistance: 5, chargeBonus: 0.8, pikeReturn: 20, splashRadius: 1.75, captureSeconds: 4, crewHp: 42, retreatMorale: 22, surrenderMorale: 10, scoutDetection: 2.5, contactDetection: 0.8 };
var distance4 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var level = (a) => ("level" in a ? Number(a.level) : 0) || 0;
var sameLevel4 = (a, b) => level(a) === level(b);
var allied2 = (s, a, b) => s.teams[a] === s.teams[b];
var hostile = (s, a, b) => s.teams[a] !== s.teams[b];
var visible = (s, side2, p) => s.visible[side2]?.has(level(p) * s.width * s.height + Math.floor(p.y) * s.width + Math.floor(p.x)) ?? false;
var dir = (facing) => ({ x: Math.cos(facing * Math.PI / 4), y: Math.sin(facing * Math.PI / 4) });
var clamp2 = (n, a, b) => Math.max(a, Math.min(b, n));
function tacticalUnitDef(s, e) {
  return unitFor(s, e);
}
function isCrewless(e) {
  return !!e.tactics?.siegeCrew?.uncrewed;
}
function initializeTactics(s, e) {
  const t = e.tactics ??= { morale: 100, recentLoss: 0 };
  if (e.kind === "unit" && e.role === "siege" && !t.siegeCrew) t.siegeCrew = { hp: TACTICS.crewHp, maxHp: TACTICS.crewHp, uncrewed: false };
  if (e.kind === "unit" && e.role === "melee" && !t.guard && ["dwarves", "tideborn", "automata"].includes(e.definitionFaction ?? s.players[e.side].faction)) t.guard = { value: 40, max: 40, lastDamagedAt: 0 };
  return t;
}
function canAmbush(s, e) {
  if (e.kind !== "unit" || e.hp <= 0 || e.illusion || e.role === "worker" || e.role === "siege" || isCrewless(e)) return false;
  return terrainAt(s, e.x, e.y, e.level ?? 0) === "forest" || s.resources.some((r) => r.kind === "wood" && r.amount > 0 && sameLevel4(e, r) && distance4(e, r) <= 1.5);
}
function canObserveTacticalEntity(s, side2, e) {
  if (isServerObservation(s)) return true;
  if (e.side === side2 && !isCrewless(e)) return true;
  if (!visible(s, side2, e)) return false;
  if (!(e.tactics?.ambush?.concealed || factionConcealment(s, e)) || allied2(s, side2, e.side)) return true;
  return s.entities.some((observer) => observer.hp > 0 && !observer.illusion && !isCrewless(observer) && sameLevel4(observer, e) && (observer.side === side2 || s.sharedVision && allied2(s, side2, observer.side)) && distance4(observer, e) <= (observer.role === "cavalry" ? TACTICS.scoutDetection : TACTICS.contactDetection));
}
function canCaptureSiege(s, captor, target) {
  return captor.hp > 0 && captor.kind === "unit" && !captor.illusion && !captor.raised && !isCrewless(captor) && ["worker", "melee", "spear", "special"].includes(captor.role) && target.hp > 0 && target.kind === "unit" && target.role === "siege" && isCrewless(target) && sameLevel4(captor, target) && canObserveTacticalEntity(s, captor.side, target) && (target.side === captor.side || target.illusion || target.raised || !unitFor(s, target).tags?.includes("hero") || !commanderAdmissionReason(s, captor.side));
}
function formationOffset(kind, slot, count, spacing) {
  if (kind === "line") return { x: (slot - (count - 1) / 2) * spacing, y: 0 };
  if (kind === "wedge") {
    if (slot === 0) return { x: 0, y: 0 };
    const row2 = Math.ceil(slot / 2);
    return { x: (slot % 2 ? -1 : 1) * row2 * spacing * 0.75, y: -row2 * spacing };
  }
  const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns), row = Math.floor(slot / columns), inRow = Math.min(columns, count - row * columns), scale = kind === "loose" ? 1.8 : 1;
  return { x: (slot % columns - (inRow - 1) / 2) * spacing * scale, y: (row - (rows - 1) / 2) * spacing * scale };
}
function formationDestination(f, s) {
  const offset = formationOffset(f.kind, f.slot, f.count, f.spacing), front = dir(f.facing);
  return { x: clamp2(f.anchor.x - front.y * offset.x + front.x * offset.y, s ? 0.6 : 0, s ? s.width - 0.6 : 1e9), y: clamp2(f.anchor.y + front.x * offset.x + front.y * offset.y, s ? 0.6 : 0, s ? s.height - 0.6 : 1e9), ..."level" in f.anchor ? { level: f.anchor.level } : {} };
}
function setFormation(s, units, kind, spacing, facing, anchor) {
  const sorted = [...units].sort((a, b) => a.id - b.id), group = `${s.tick}:${sorted.map((e) => e.id).join(",")}`;
  const previous = new Set(sorted.map((e) => e.tactics?.formation?.group).filter(Boolean));
  for (const e of s.entities) if (e.tactics?.formation && previous.has(e.tactics.formation.group) && !sorted.includes(e)) delete e.tactics.formation;
  sorted.forEach((e, slot) => {
    const t = initializeTactics(s, e);
    delete t.ambush;
    delete t.capture;
    t.formation = { kind, group, slot, count: sorted.length, spacing, facing, anchor: { ...anchor }, phase: "moving" };
    e.facing = facing;
  });
}
function refreshFormations(s) {
  const groups = /* @__PURE__ */ new Map();
  for (const e of s.entities) if (e.hp > 0 && !isCrewless(e) && e.tactics?.formation) {
    const group = groups.get(e.tactics.formation.group) ?? [];
    group.push(e);
    groups.set(e.tactics.formation.group, group);
  }
  for (const units of groups.values()) {
    units.sort((a, b) => a.id - b.id);
    const changed = units.some((e) => e.tactics.formation.count !== units.length);
    units.forEach((e, slot) => {
      const f = e.tactics.formation;
      if (changed) {
        f.slot = slot;
        f.count = units.length;
        f.phase = "regrouping";
        e.path = [];
      }
      if (f.phase !== "broken") {
        const destination = formationDestination(f, s);
        if (distance4(e, destination) <= 0.55) {
          f.phase = "formed";
          e.facing = f.facing;
        } else if (e.order.type === "idle" || e.order.type === "hold") {
          f.phase = "regrouping";
          e.order = { type: "move", ...destination };
        }
      }
    });
  }
}
function facingDamageFactor(source2, target) {
  if (target.kind !== "unit" || distance4(source2, target) < 1e-3) return 1;
  const front = dir(target.facing), d = distance4(source2, target), dot = ((source2.x - target.x) * front.x + (source2.y - target.y) * front.y) / d;
  return dot >= TACTICS.frontCos ? 1 : dot <= -TACTICS.frontCos ? TACTICS.rearDamage : TACTICS.sideDamage;
}
function segmentDistance(point5, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? clamp2(((point5.x - a.x) * dx + (point5.y - a.y) * dy) / l, 0, 1) : 0;
  return Math.hypot(point5.x - a.x - t * dx, point5.y - a.y - t * dy);
}
function rangedCoverFactor(s, source2, target) {
  if (!sameLevel4(source2, target)) return 1;
  const length2 = distance4(source2, target);
  if (length2 < 1.8) return 1;
  const between = (p, radius2) => sameLevel4(p, target) && distance4(p, target) < radius2 + 3 && distance4(p, source2) > radius2 + 0.4 && distance4(p, target) > 0.3 && segmentDistance(p, source2, target) < radius2 + 0.1;
  for (const e of s.entities) if (e.id !== target.id && e.hp > 0 && e.kind === "building" && e.progress === 1) {
    const radius2 = buildingFor(s, e).size / 2;
    if (between(e, radius2)) return TACTICS.coverFactor;
  }
  for (let y = Math.max(0, Math.floor(target.y - 3)); y <= Math.min(s.height - 1, Math.ceil(target.y + 3)); y++) for (let x = Math.max(0, Math.floor(target.x - 3)); x <= Math.min(s.width - 1, Math.ceil(target.x + 3)); x++) if (terrainAt(s, x + 0.5, y + 0.5, target.level ?? 0) === "rock" && between({ x: x + 0.5, y: y + 0.5, level: target.level ?? 0 }, 0.55)) return TACTICS.coverFactor;
  return 1;
}
function interceptDirectionalShield(s, source2, target, amount) {
  if (target.kind !== "unit") return { remaining: amount, intercepted: [] };
  const candidates = s.entities.filter((b) => b !== target && b.hp > 0 && b.kind === "unit" && !b.illusion && !isCrewless(b) && sameLevel4(b, target) && allied2(s, b.side, target.side) && (b.tactics?.guard?.value ?? 0) + (b.shield ?? 0) > 0).sort((a, b) => distance4(a, target) - distance4(b, target) || a.id - b.id);
  let remaining = amount;
  const intercepted = [];
  for (const bearer of candidates) {
    const front = dir(bearer.facing), vx = target.x - bearer.x, vy = target.y - bearer.y, depth = -(vx * front.x + vy * front.y), width = Math.abs(vx * front.y - vy * front.x), shot = distance4(source2, bearer), attackFront = shot ? ((source2.x - bearer.x) * front.x + (source2.y - bearer.y) * front.y) / shot : 0;
    if (depth < 0.2 || depth > TACTICS.shieldReach || width > TACTICS.shieldWidth + depth * 0.2 || attackFront < TACTICS.frontCos || segmentDistance(bearer, source2, target) > 0.85) continue;
    const guard = bearer.tactics?.guard, available = (guard?.value ?? 0) + (bearer.shield ?? 0), absorbed = Math.min(remaining * TACTICS.shieldFraction, available);
    if (absorbed <= 0) continue;
    let energy = absorbed;
    if (guard) {
      const spent = Math.min(guard.value, energy);
      guard.value -= spent;
      energy -= spent;
      guard.lastDamagedAt = s.time;
    }
    bearer.shield = Math.max(0, (bearer.shield ?? 0) - energy);
    bearer.lastDamagedAt = s.time;
    remaining -= absorbed;
    intercepted.push({ bearer, amount: absorbed });
    break;
  }
  return { remaining, intercepted };
}
function updateCharge(s, e, from, dt) {
  if (e.role !== "cavalry" || e.illusion) return;
  const t = initializeTactics(s, e), moved = distance4(from, e), c = t.charge ??= { distance: 0, heading: e.facing, lastMovedAt: s.time };
  if (moved > dt * 0.5) {
    const turn = Math.abs(Math.atan2(Math.sin((e.facing - c.heading) * Math.PI / 4), Math.cos((e.facing - c.heading) * Math.PI / 4)));
    if (turn > Math.PI / 4 + 0.01) c.distance = 0;
    c.distance = Math.min(TACTICS.chargeDistance, c.distance + moved);
    c.heading = e.facing;
    c.lastMovedAt = s.time;
  }
}
function ageCharge(s, e, dt) {
  const c = e.tactics?.charge;
  if (c && s.time - c.lastMovedAt > 0.25) c.distance = Math.max(0, c.distance - dt * 5);
}
function cavalryImpact(s, source2, target) {
  if (source2.role !== "cavalry" || source2.illusion) return { factor: 1, pikeDamage: 0 };
  const c = initializeTactics(s, source2).charge, turn = c ? Math.abs(Math.atan2(Math.sin((source2.facing - c.heading) * Math.PI / 4), Math.cos((source2.facing - c.heading) * Math.PI / 4))) : 0, distanceCharged = turn > Math.PI / 4 + 0.01 ? 0 : c?.distance ?? 0, charged = distanceCharged >= 1.5, front = facingDamageFactor(source2, target) === 1, braced = target.kind === "unit" && target.role === "spear" && target.order.type === "hold" && front;
  if (c) c.distance = 0;
  return braced && charged ? { factor: 1, pikeDamage: TACTICS.pikeReturn * (distanceCharged / TACTICS.chargeDistance) } : { factor: 1 + TACTICS.chargeBonus * (distanceCharged / TACTICS.chargeDistance), pikeDamage: 0 };
}
function recordTacticsDamage(s, target, damage2) {
  if (target.kind !== "unit" || target.illusion || isCrewless(target)) return;
  const t = initializeTactics(s, target);
  t.morale = Math.max(0, t.morale - damage2 / target.maxHp * 65);
  if (t.ambush?.concealed) {
    t.ambush.concealed = false;
    s.events.push({ type: "message", side: target.side, x: target.x, y: target.y, source: target.id, text: "Ambush exposed by damage" });
  }
}
function recordTacticsDeath(s, target) {
  if (target.kind !== "unit" || target.illusion || isCrewless(target)) return;
  for (const ally of s.entities) if (ally !== target && ally.hp > 0 && ally.kind === "unit" && !ally.illusion && !isCrewless(ally) && sameLevel4(ally, target) && allied2(s, ally.side, target.side) && distance4(ally, target) < 6) {
    const t = initializeTactics(s, ally);
    t.recentLoss = Math.min(60, t.recentLoss + 12);
    t.morale = Math.max(0, t.morale - 12);
  }
}
function updateTactics(s, e, dt, interruptOrder) {
  const t = initializeTactics(s, e);
  if (isCrewless(e)) return { skipCombat: true };
  if (t.guard && s.time - t.guard.lastDamagedAt >= 8) t.guard.value = Math.min(t.guard.max, t.guard.value + dt * 2);
  t.recentLoss = Math.max(0, t.recentLoss - dt * 2);
  if (e.role === "worker" || e.illusion || e.role === "siege") return { skipCombat: false };
  const support = s.entities.filter((a) => a !== e && a.hp > 0 && a.kind === "unit" && a.role !== "worker" && !a.illusion && !isCrewless(a) && sameLevel4(a, e) && allied2(s, a.side, e.side) && distance4(a, e) < 4.5).length;
  const enemies = s.entities.filter((a) => a.hp > 0 && !isCrewless(a) && sameLevel4(a, e) && hostile(s, a.side, e.side) && canObserveTacticalEntity(s, e.side, a) && distance4(a, e) < 5.5);
  const wounded = e.hp / e.maxHp < 0.65;
  t.morale = clamp2(t.morale + dt * (support ? Math.min(4, 1 + support * 0.65) : enemies.length && wounded ? -4 : enemies.length ? -0.4 : 2.5), 0, 100);
  if (t.morale <= TACTICS.surrenderMorale) {
    const captors = enemies.filter((a) => a.kind === "unit" && !a.illusion && !a.raised && ["worker", "melee", "spear", "special"].includes(a.role) && distance4(a, e) < 2.5), sectors = new Set(captors.map((a) => (Math.round(Math.atan2(a.y - e.y, a.x - e.x) / (Math.PI / 4)) + 8) % 8)), surrounded = captors.length >= 3 && sectors.size >= 3 && captors.some((a) => captors.some((b) => (a.x - e.x) * (b.x - e.x) + (a.y - e.y) * (b.y - e.y) < 0));
    if (surrounded) {
      const captor = captors.sort((a, b) => distance4(a, e) - distance4(b, e) || a.id - b.id)[0];
      if (e.raised || !unitFor(s, e).tags?.includes("hero") || !commanderAdmissionReason(s, captor.side)) {
        const former = e.side;
        interruptOrder?.(e);
        e.definitionFaction ??= s.players[former].faction;
        e.side = captor.side;
        if (e.factionState) {
          delete e.factionState.chant;
          delete e.factionState.tunnel;
          delete e.factionState.corpseOrder;
        }
        t.morale = 35;
        t.surrenderedTo = captor.side;
        delete t.retreat;
        delete t.formation;
        delete t.ambush;
        delete t.capture;
        e.order = { type: "hold" };
        delete e.orderQueue;
        e.path = [];
        s.events.push({ type: "message", side: former, x: e.x, y: e.y, source: e.id, text: "A surrounded unit surrendered" }, { type: "message", side: e.side, x: e.x, y: e.y, source: e.id, text: "Captured a surrendered unit" });
        return { skipCombat: true };
      }
    }
  }
  if (!t.retreat && t.morale < TACTICS.retreatMorale && enemies.length) {
    const refuge = s.entities.filter((a) => a.hp > 0 && !isCrewless(a) && sameLevel4(a, e) && allied2(s, a.side, e.side) && a.kind === "building" && (a.role === "hq" || a.role === "depot") && (a.side === e.side || visible(s, e.side, a))).sort((a, b) => distance4(a, e) - distance4(b, e))[0];
    let destination;
    if (refuge && distance4(refuge, e) > 3) destination = { x: refuge.x, y: refuge.y, ..."level" in refuge ? { level: refuge.level } : {} };
    else {
      const threats = enemies.reduce((p, a) => ({ x: p.x + a.x, y: p.y + a.y }), { x: 0, y: 0 }), dx = e.x - threats.x / enemies.length, dy = e.y - threats.y / enemies.length, d = Math.hypot(dx, dy) || 1;
      destination = { x: clamp2(e.x + dx / d * 6, 0.6, s.width - 0.6), y: clamp2(e.y + dy / d * 6, 0.6, s.height - 0.6), ..."level" in e ? { level: e.level } : {} };
    }
    interruptOrder?.(e);
    t.retreat = { ...destination, until: s.time + 8 };
    delete t.formation;
    delete t.ambush;
    delete t.capture;
    delete e.orderQueue;
    e.order = { type: "move", ...destination };
    e.path = [];
    s.events.push({ type: "message", side: e.side, x: e.x, y: e.y, source: e.id, text: "Low morale: retreating to support" });
  }
  if (t.retreat) {
    if (s.time >= t.retreat.until && t.morale >= 30) {
      interruptOrder?.(e);
      delete t.retreat;
      e.order = { type: "hold" };
      return { skipCombat: false };
    }
    return { skipCombat: true, retreat: t.retreat };
  }
  if (t.ambush?.concealed) {
    if (!canAmbush(s, e)) {
      t.ambush.concealed = false;
      s.events.push({ type: "message", side: e.side, x: e.x, y: e.y, source: e.id, text: "Ambush lost concealment" });
    } else {
      const a = t.ambush, target = enemies.filter((b) => distance4(e, b) <= a.radius && (a.target === "any" || a.target === b.kind || a.target === b.role)).sort((x, y) => distance4(e, x) - distance4(e, y) || x.id - y.id)[0];
      if (!target) return { skipCombat: true };
      interruptOrder?.(e);
      a.concealed = false;
      t.ambush = a;
      e.order = { type: "attack", target: target.id };
      s.events.push({ type: "message", side: e.side, x: e.x, y: e.y, source: e.id, text: "Ambush triggered" });
    }
  }
  return { skipCombat: false };
}
function updateSiegeCapture(s, e, dt, interruptOrder) {
  const capture = e.tactics?.capture;
  if (!capture) return { complete: false };
  const target = s.entities.find((a) => a.id === capture.target);
  if (!target || !canCaptureSiege(s, e, target)) {
    delete e.tactics.capture;
    return { complete: false };
  }
  if (distance4(e, target) > 1.3) return { target, complete: false };
  const contested = s.entities.some((a) => a.hp > 0 && !isCrewless(a) && a.kind === "unit" && sameLevel4(a, target) && hostile(s, e.side, a.side) && canObserveTacticalEntity(s, e.side, a) && distance4(a, target) < 2);
  if (contested) {
    capture.progress = 0;
    return { target, complete: false };
  }
  capture.progress = Math.min(1, capture.progress + dt / TACTICS.captureSeconds);
  if (capture.progress < 1) return { target, complete: false };
  interruptOrder?.(target);
  interruptOrder?.(e);
  target.definitionFaction ??= s.players[target.side].faction;
  target.side = e.side;
  if (target.factionState) {
    delete target.factionState.chant;
    delete target.factionState.tunnel;
    delete target.factionState.corpseOrder;
  }
  const crew = target.tactics.siegeCrew;
  crew.uncrewed = false;
  crew.hp = crew.maxHp;
  target.order = { type: "hold" };
  target.cooldown = 1;
  delete target.tactics.retreat;
  target.tactics.morale = 60;
  delete e.tactics.capture;
  e.order = { type: "hold" };
  s.events.push({ type: "message", side: e.side, x: target.x, y: target.y, source: e.id, target: target.id, text: "Siege crew replaced: engine captured" });
  return { target, complete: true };
}

// src/core/objectives.ts
var alive2 = (e) => e.hp > 0 && !e.illusion;
function freePoint(s, point5, offset = 0) {
  const level2 = levelOf2(point5);
  for (let radius2 = 0; radius2 <= Math.max(s.width, s.height); radius2++) for (let i = 0; i < (radius2 ? 32 : 1); i++) {
    const [dx, dy] = DIRECTIONS_32[(i + offset) % 32], x = Math.floor(point5.x + dx * radius2) + 0.5, y = Math.floor(point5.y + dy * radius2) + 0.5;
    if (x < 0.5 || y < 0.5 || x > s.width - 0.5 || y > s.height - 0.5) continue;
    if (walkable(s, x, y, level2)) return { x, y, ...s.world || level2 ? { level: level2 } : {} };
  }
  throw new Error("No walkable objective position.");
}
var distance5 = (a, b) => sameLevel2(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
function objectiveOrder(s, unit5, target, command, attack = true) {
  if (sameLevel2(unit5, target)) return command(s, unit5.side, { type: attack ? "attackMove" : "move", ids: [unit5.id], x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level } });
  const passage = s.world?.transitions.map((transition) => {
    const entry = [transition.from, transition.to].find((point5) => sameLevel2(point5, unit5)), exit = entry === transition.from ? transition.to : transition.from;
    return { transition, entry, exit };
  }).filter((value2) => value2.entry && sameLevel2(value2.exit, target)).sort((a, b) => distance5(unit5, a.entry) + distance5(a.exit, target) - distance5(unit5, b.entry) - distance5(b.exit, target) || a.transition.id - b.transition.id)[0];
  if (!passage?.entry) return false;
  if (unit5.order.type === "traverse" && unit5.order.transition === passage.transition.id) return true;
  if (s.visible[unit5.side].has(fogKey(s, passage.entry))) return command(s, unit5.side, { type: "traverse", ids: [unit5.id], transition: passage.transition.id });
  return command(s, unit5.side, { type: attack ? "attackMove" : "move", ids: [unit5.id], ...passage.entry });
}
function placeRelic(relic, point5) {
  relic.x = point5.x;
  relic.y = point5.y;
  if (point5.level === void 0) delete relic.level;
  else relic.level = point5.level;
}
function emptyObjectives(s) {
  return { hill: { x: Math.floor(s.width / 2) + 0.5, y: Math.floor(s.height / 2) + 0.5, ...s.world ? { level: 0 } : {}, ownerTeam: null, captureTeam: null, captureTicks: 0, holdTicks: 0, contested: false }, relics: [], relicHoldTicks: Array(8).fill(0), survival: { wave: 0, nextWaveTick: 0, spawnedIds: [], phase: "waiting" } };
}
function initializeObjectives(s) {
  s.objectives = emptyObjectives(s);
  s.objectives.hill = { ...s.objectives.hill, ...freePoint(s, s.objectives.hill) };
  if (s.rules.mode === "relic") for (let i = 0; i < s.rules.relic.count; i++) {
    const [dx, dy] = DIRECTIONS_32[Math.round(i * 32 / s.rules.relic.count) % 32], point5 = freePoint(s, { x: s.width / 2 + dx * 6, y: s.height / 2 + dy * 6 }, i);
    s.objectives.relics.push({ id: i + 1, ...point5, carrierId: null, heldTeam: null });
  }
  if (s.rules.mode === "survival") {
    validateModeRoster(s);
    s.entities = s.entities.filter((e) => s.teams[e.side] === s.rules.survival.defenderTeam);
    s.objectives.survival.nextWaveTick = s.tick + s.rules.survival.intervalTicks;
  }
}
function finish(s, team, text3) {
  if (s.winner !== null || s.draw) return;
  s.winningTeam = team;
  s.winner = s.teams.findIndex((t) => t === team);
  const point5 = s.starts[s.winner];
  s.events.push({ type: "message", side: s.winner, ...point5, text: text3 });
}
function collectRelic(s, side2, id5, relicId) {
  if (s.rules.mode !== "relic" || s.draft.status !== "complete") return false;
  const unit5 = s.entities.find((e) => e.id === id5 && e.side === side2 && e.kind === "unit" && alive2(e)), relic = s.objectives.relics.find((r) => r.id === relicId);
  if (!unit5 || !relic || relic.carrierId !== null || s.objectives.relics.some((r) => r.carrierId === id5) || distance5(unit5, relic) > s.rules.relic.pickupRadius) return false;
  relic.carrierId = id5;
  relic.heldTeam = null;
  placeRelic(relic, unit5);
  s.events.push({ type: "message", side: side2, x: unit5.x, y: unit5.y, ...unit5.level === void 0 ? {} : { level: unit5.level }, text: `Relic ${relicId} collected`, source: id5 });
  return true;
}
function dropRelic(s, side2, id5) {
  const unit5 = s.entities.find((e) => e.id === id5 && e.side === side2 && e.kind === "unit" && alive2(e)), relic = s.objectives.relics.find((r) => r.carrierId === id5);
  if (!unit5 || !relic) return false;
  relic.carrierId = null;
  relic.heldTeam = null;
  placeRelic(relic, unit5);
  return true;
}
function evaluateObjectives(s, actions) {
  if (s.winner !== null || s.draw) return;
  if (s.rules.mode === "hill") {
    const h = s.objectives.hill, present = [...new Set(s.entities.filter((e) => alive2(e) && e.kind === "unit" && !s.eliminated[e.side] && distance5(e, h) <= s.rules.hill.radius).map((e) => s.teams[e.side]))];
    h.contested = present.length > 1;
    if (present.length !== 1) {
      h.captureTeam = null;
      h.captureTicks = 0;
      if (h.contested) h.holdTicks = 0;
      return;
    }
    const team = present[0];
    if (h.ownerTeam !== team) {
      if (h.captureTeam !== team) {
        h.captureTeam = team;
        h.captureTicks = 0;
      }
      h.captureTicks++;
      h.holdTicks = 0;
      if (h.captureTicks >= s.rules.hill.captureTicks) {
        h.ownerTeam = team;
        h.captureTeam = null;
        h.captureTicks = 0;
      }
    } else {
      h.captureTeam = null;
      h.captureTicks = 0;
      h.holdTicks++;
      if (h.holdTicks >= s.rules.hill.holdTicks) finish(s, team, "The hill defense is complete.");
    }
  }
  if (s.rules.mode === "relic") {
    for (const relic of s.objectives.relics) {
      if (relic.carrierId !== null) {
        const carrier = s.entities.find((e) => e.id === relic.carrierId && alive2(e));
        if (!carrier) {
          const fallen = s.entities.find((e) => e.id === relic.carrierId) || s.corpses.find((e) => e.id === relic.carrierId);
          if (fallen) placeRelic(relic, fallen);
          relic.carrierId = null;
          relic.heldTeam = null;
          continue;
        }
        placeRelic(relic, carrier);
        const shrine = s.entities.find((e) => alive2(e) && e.kind === "building" && e.role === "hq" && e.progress === 1 && s.teams[e.side] === s.teams[carrier.side] && distance5(e, carrier) <= buildingFor(s, e).size / 2 + 2.5);
        if (shrine) {
          relic.carrierId = null;
          relic.heldTeam = s.teams[carrier.side];
          placeRelic(relic, carrier);
        }
      }
      if (relic.heldTeam !== null && !s.entities.some((e) => alive2(e) && e.kind === "building" && e.role === "hq" && e.progress === 1 && s.teams[e.side] === relic.heldTeam && distance5(e, relic) <= buildingFor(s, e).size / 2 + 2.5)) relic.heldTeam = null;
    }
    for (const team of [...new Set(s.teams)]) {
      const held = s.objectives.relics.filter((r) => r.heldTeam === team).length;
      if (held >= s.rules.relic.required) s.objectives.relicHoldTicks[team]++;
      else s.objectives.relicHoldTicks[team] = 0;
      if (s.objectives.relicHoldTicks[team] >= s.rules.relic.holdTicks) finish(s, team, "The required relics have been defended.");
    }
  }
  if (s.rules.mode === "survival") {
    const rules = s.rules.survival, wave = s.objectives.survival, defenders = s.entities.filter((e) => alive2(e) && e.role === "hq" && e.progress === 1 && s.teams[e.side] === rules.defenderTeam), opponents = s.players.map((_, id5) => id5).filter((side2) => s.teams[side2] !== rules.defenderTeam);
    if (!defenders.length) {
      wave.phase = "complete";
      finish(s, s.teams[opponents[0]], "The defenders lost their last stronghold.");
      return;
    }
    const attackers = s.entities.filter((e) => wave.spawnedIds.includes(e.id) && alive2(e) && s.teams[e.side] !== rules.defenderTeam && !isCrewless(e));
    if (wave.phase === "fighting") for (const unit5 of attackers.filter((e) => e.order.type === "idle")) {
      const target = [...defenders].sort((a, b) => distance5(a, unit5) - distance5(b, unit5) || a.id - b.id)[0];
      if (target) objectiveOrder(s, unit5, target, actions.command);
    }
    if (wave.phase === "fighting" && !attackers.length) {
      const survivors = s.players.map((_, id5) => id5).filter((side2) => s.teams[side2] === rules.defenderTeam);
      for (const side2 of survivors) for (const resource of ["wood", "ore", "crystal"]) s.players[side2][resource] += rules.rewardPerWave[resource];
      if (wave.wave === rules.waveCount) {
        wave.phase = "complete";
        finish(s, rules.defenderTeam, "The final survival wave is defeated.");
        return;
      }
      wave.phase = "recovery";
      wave.nextWaveTick = s.tick + rules.recoveryTicks;
    }
    if ((wave.phase === "waiting" || wave.phase === "recovery") && s.tick >= wave.nextWaveTick) {
      wave.wave++;
      wave.spawnedIds = [];
      wave.phase = "fighting";
      const roles3 = wave.wave === 1 ? ["melee", "ranged"] : wave.wave === 2 ? ["spear", "ranged", "cavalry"] : ["melee", "special", "siege", "cavalry"];
      for (let i = 0; i < rules.unitsPerWave * wave.wave; i++) {
        const side2 = opponents[i % opponents.length], point5 = freePoint(s, { x: Math.max(0.5, Math.min(s.width - 0.5, s.starts[side2].x + i % 5 - 2)), y: Math.max(0.5, Math.min(s.height - 0.5, s.starts[side2].y + Math.floor(i / 5) % 5 * 0.8)), ...s.starts[side2].level === void 0 ? {} : { level: s.starts[side2].level } }, i), allowed = availableUnits(s, side2).filter((unit6) => unit6.role !== "worker" && definitionAllowed(s, side2, unit6.id)), preferred = roles3[i % roles3.length], chosen = allowed.find((unit6) => unit6.role === preferred) ?? allowed[i % allowed.length], unit5 = actions.spawn(s, side2, "unit", chosen.role, point5.x, point5.y, 1, chosen.id, levelOf2(point5));
        wave.spawnedIds.push(unit5.id);
        const target = defenders[i % defenders.length];
        objectiveOrder(s, unit5, target, actions.command);
      }
      s.events.push({ type: "message", side: defenders[0].side, ...s.starts[defenders[0].side], text: `Survival wave ${wave.wave}: ${wave.spawnedIds.length} attackers` });
    }
  }
}
function objectiveAi(s, side2, command, reservedIds) {
  if (s.rules.mode === "annihilation" || s.rules.mode === "scenario" || s.rules.mode === "survival") return;
  const units = s.entities.filter((e) => e.side === side2 && e.kind === "unit" && e.role !== "worker" && alive2(e) && !reservedIds?.has(e.id));
  if (!units.length) return;
  if (s.rules.mode === "hill") for (const unit5 of units) objectiveOrder(s, unit5, s.objectives.hill, command);
  if (s.rules.mode === "relic") for (const unit5 of units) {
    const carried = s.objectives.relics.find((r) => r.carrierId === unit5.id), hq = s.entities.find((e) => e.side === side2 && e.role === "hq" && alive2(e));
    if (carried && hq) {
      objectiveOrder(s, unit5, hq, command, false);
      continue;
    }
    const target = s.objectives.relics.filter((r) => r.carrierId === null && r.heldTeam !== s.teams[side2]).sort((a, b) => distance5(a, unit5) - distance5(b, unit5) || a.id - b.id)[0];
    if (!target) continue;
    if (!collectRelic(s, side2, unit5.id, target.id)) objectiveOrder(s, unit5, target, command);
  }
}

// src/core/ai-policy.ts
var DEFAULT_AI_CONFIG = { difficulty: "normal", personality: "balanced", opening: "infantry-rush" };
var AI_PERSONALITIES = {
  balanced: { name: "Balanced", description: "Builds an economy and a mixed army.", opening: "infantry-rush" },
  rush: { name: "Rush", description: "Attacks early with infantry and delays economy upgrades.", opening: "infantry-rush" },
  fortify: { name: "Fortify", description: "Builds towers before committing to a large attack.", opening: "tower-defense" },
  expand: { name: "Expand", description: "Prioritizes workers and a second resource base.", opening: "fast-expansion" },
  raid: { name: "Raid", description: "Uses small mobile groups to attack observed workers and depots.", opening: "cavalry-raids" }
};
var AI_OPENINGS = {
  "infantry-rush": { name: "Infantry rush", plan: "Barracks first, then an early infantry attack.", weakness: "The first attack leaves few defenders at home." },
  "tower-defense": { name: "Tower defense", plan: "Tower first, then barracks and a defensive army.", weakness: "Early spending on towers slows mobile troops and expansion." },
  "fast-expansion": { name: "Fast expansion", plan: "Depot first, more workers, then an observed outer resource base.", weakness: "Extra workers and buildings delay the first army." },
  "cavalry-raids": { name: "Cavalry raids", plan: "Barracks first, advance age, then recruit cavalry for raids.", weakness: "The army is small before cavalry becomes available; spears counter it." }
};
function normalizeAiConfig(input) {
  if (input !== void 0 && (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["difficulty", "personality", "opening"].includes(key)))) throw new Error("Invalid AI configuration.");
  const difficulty = input?.difficulty ?? DEFAULT_AI_CONFIG.difficulty, personality = input?.personality ?? DEFAULT_AI_CONFIG.personality;
  if (!["easy", "normal", "hard"].includes(difficulty)) throw new Error("Unknown AI difficulty.");
  if (!Object.hasOwn(AI_PERSONALITIES, personality)) throw new Error("Unknown AI personality.");
  const opening2 = input?.opening ?? AI_PERSONALITIES[personality].opening;
  if (!Object.hasOwn(AI_OPENINGS, opening2)) throw new Error("Unknown AI opening.");
  return { difficulty, personality, opening: opening2 };
}
function aiProfile(config) {
  const difficulty = {
    easy: { decisionInterval: 2.8, mistakeEvery: 5, counterStrength: 0, trainingQueue: 1, retreatHealth: 0.18, retreatRatio: 2.5, regroupSeconds: 24 },
    normal: { decisionInterval: 1, mistakeEvery: 0, counterStrength: 0.65, trainingQueue: 2, retreatHealth: 0.3, retreatRatio: 1.65, regroupSeconds: 18 },
    hard: { decisionInterval: 0.55, mistakeEvery: 0, counterStrength: 1.25, trainingQueue: 3, retreatHealth: 0.4, retreatRatio: 1.35, regroupSeconds: 12 }
  };
  const personality = {
    balanced: { workerTarget: 13, attackSizeFactor: 1, waveIntervalFactor: 1, expansionWorkers: 13, scoutAt: 65 },
    rush: { workerTarget: 9, attackSizeFactor: 0.65, waveIntervalFactor: 0.55, expansionWorkers: 16, scoutAt: 35 },
    fortify: { workerTarget: 13, attackSizeFactor: 1.4, waveIntervalFactor: 1.4, expansionWorkers: 15, scoutAt: 80 },
    expand: { workerTarget: 17, attackSizeFactor: 1.2, waveIntervalFactor: 1.2, expansionWorkers: 10, scoutAt: 45 },
    raid: { workerTarget: 12, attackSizeFactor: 0.55, waveIntervalFactor: 0.55, expansionWorkers: 13, scoutAt: 35 }
  };
  return { ...difficulty[config.difficulty], ...personality[config.personality] };
}
function skipsAiDecision(config, turn) {
  const every = aiProfile(config).mistakeEvery;
  return every > 0 && turn > 0 && turn % every === 0;
}
function openingBuilding(config, roles3) {
  const first = config.opening === "tower-defense" ? "tower" : config.opening === "fast-expansion" ? "depot" : "barracks";
  if (!roles3.includes(first)) return first;
  if (!roles3.includes("barracks")) return "barracks";
}
function rememberObservedUnits(memory, visible5, time2) {
  for (const [id5, observation] of memory) if (time2 - observation.seenAt > 90) memory.delete(id5);
  for (const enemy2 of visible5) if (enemy2.kind === "unit" && enemy2.role !== "worker" && !enemy2.illusion && enemy2.hp > 0) memory.set(enemy2.id, { role: enemy2.role, x: enemy2.x, y: enemy2.y, ...enemy2.level === void 0 ? {} : { level: enemy2.level }, seenAt: time2, hpFraction: enemy2.hp / enemy2.maxHp });
}
function counterWeights(faction, config, observed2) {
  const weights = { ...faction.ai.composition, spear: 0.1, cavalry: 0.16, siege: 0.18 };
  if (config.opening === "infantry-rush" && config.personality === "rush") {
    weights.melee = (weights.melee ?? 0.25) + 0.3;
    weights.siege = 0.08;
  }
  if (config.personality === "raid" || config.opening === "cavalry-raids") {
    weights.cavalry = 0.65;
    weights.siege = 0.05;
  }
  if (config.personality === "fortify") {
    weights.ranged = (weights.ranged ?? 0.25) + 0.2;
    weights.spear = 0.2;
  }
  const composition = {};
  let total2 = 0;
  for (const unit5 of observed2) {
    composition[unit5.role] = (composition[unit5.role] ?? 0) + 1;
    total2++;
  }
  if (total2) {
    const strength = aiProfile(config).counterStrength;
    weights.spear = (weights.spear ?? 0) + strength * (composition.cavalry ?? 0) / total2;
    weights.cavalry = (weights.cavalry ?? 0) + strength * ((composition.ranged ?? 0) + (composition.siege ?? 0)) / total2;
    weights.ranged = (weights.ranged ?? 0) + strength * ((composition.melee ?? 0) + (composition.spear ?? 0)) / total2;
  }
  return weights;
}
function chooseAiRecruit(roles3, planned, weights) {
  const total2 = roles3.reduce((sum, role) => sum + (weights[role] ?? 0.1), 0);
  return [...roles3].sort((a, b) => (planned.length + 1) * (weights[b] ?? 0.1) / total2 - planned.filter((role) => role === b).length - ((planned.length + 1) * (weights[a] ?? 0.1) / total2 - planned.filter((role) => role === a).length))[0];
}
function shouldRetreat(config, unit5, nearbyAllies, visibleEnemies) {
  if (!visibleEnemies.length) return false;
  const profile = aiProfile(config);
  if (unit5.hp / unit5.maxHp < profile.retreatHealth) return true;
  const ownStrength = nearbyAllies.reduce((sum, e) => sum + e.hp / e.maxHp, 0), enemyStrength = visibleEnemies.reduce((sum, e) => sum + e.hp / e.maxHp, 0);
  return enemyStrength > Math.max(1, ownStrength) * profile.retreatRatio;
}

// src/core/specialist-validation.ts
var MAX_ID = 2147483647;
var MAX_RECORDS = 8192;
var SLOTS = ["weapon", "armor", "trinket"];
var PREPARED = { "incendiary-shell": "incendiary", "rooting-shell": "rooting", "corpse-shell": "corpse", "flood-shell": "flood" };
function bad(path, detail) {
  throw new Error(`Invalid save at ${path}: ${detail}.`);
}
function object(value2, path, required, optional = []) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) bad(path, "expected an object");
  const record6 = value2;
  for (const key of required) if (!Object.hasOwn(record6, key)) bad(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record6)) if (!required.includes(key) && !optional.includes(key)) bad(`${path}.${key}`, "unknown field");
  return record6;
}
function number(value2, path, min = 0, max = MAX_ID, integer2 = false) {
  if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < min || value2 > max || integer2 && !Number.isSafeInteger(value2)) bad(path, `expected ${integer2 ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value2;
}
function flag(value2, path) {
  if (typeof value2 !== "boolean") bad(path, "expected a boolean");
  return value2;
}
function choice(value2, path, values) {
  if (typeof value2 !== "string" || !values.includes(value2)) bad(path, "unknown value");
  return value2;
}
function list(value2, path, max) {
  if (!Array.isArray(value2) || value2.length > max) bad(path, "invalid array length");
  return value2;
}
function position(value2, path, s, extraRequired = [], extraOptional = []) {
  const p = object(value2, path, ["x", "y", ...extraRequired], ["level", ...extraOptional]);
  number(p.x, `${path}.x`, 0, s.width);
  number(p.y, `${path}.y`, 0, s.height);
  if (p.level !== void 0) {
    const level2 = number(p.level, `${path}.level`, 0, 1, true);
    if (level2 !== 0 && !s.world?.levels[level2]) bad(`${path}.level`, "world level is absent");
  }
  return p;
}
function realUnit(e) {
  return e.kind === "unit" && !e.illusion && !e.raised;
}
function equipmentEligible2(s, e) {
  return realUnit(e) && (e.role === "special" || !!unitFor(s, e).tags?.some((tag) => tag === "hero" || tag === "engineer"));
}
function unitRole(s, e) {
  return unitFor(s, e).role;
}
function validateVeteran(s, e, path) {
  if (e.veteran === void 0) return;
  const p = `${path}.veteran`, v = object(e.veteran, p, ["experience", "rank", "nextSurvivalAt", "lastCombatAt", "promotions"], ["pendingPromotion"]);
  if (!realUnit(e)) bad(p, "only real units can earn experience");
  const xp = number(v.experience, `${p}.experience`, 0, 300), rank = number(v.rank, `${p}.rank`, 0, 3, true);
  if (rank !== veteranRank(xp)) bad(`${p}.rank`, "rank differs from earned experience");
  number(v.nextSurvivalAt, `${p}.nextSurvivalAt`, 0, s.time + 60);
  number(v.lastCombatAt, `${p}.lastCombatAt`, 0, s.time);
  const promotions = list(v.promotions, `${p}.promotions`, 3);
  promotions.forEach((value2, i) => {
    const q = `${p}.promotions[${i}]`, promotion = object(value2, q, ["rank", "id"]);
    if (number(promotion.rank, `${q}.rank`, 1, 3, true) !== i + 1 || i + 1 > rank) bad(`${q}.rank`, "promotions must follow earned ranks in order");
    const id5 = choice(promotion.id, `${q}.id`, Object.keys(PROMOTIONS));
    if (!PROMOTIONS[id5].roles.includes(unitRole(s, e))) bad(`${q}.id`, "promotion does not apply to this unit role");
  });
  const pending = promotions.length < rank ? promotions.length + 1 : void 0;
  if (v.pendingPromotion !== pending) bad(`${p}.pendingPromotion`, "expected the first unchosen earned rank");
}
function validateBuffs(s, e, path) {
  if (e.specialistBuffs === void 0) return;
  if (!realUnit(e)) bad(`${path}.specialistBuffs`, "only real units can receive specialist buffs");
  list(e.specialistBuffs, `${path}.specialistBuffs`, 64).forEach((value2, i) => {
    const p = `${path}.specialistBuffs[${i}]`, buff2 = object(value2, p, ["until"], ["damageFactor", "speedFactor", "armor", "rooted", "fearedFrom"]);
    number(buff2.until, `${p}.until`, 0, s.time + 30);
    if (Object.keys(buff2).length === 1) bad(p, "a buff requires an effect");
    for (const key of ["damageFactor", "speedFactor"]) if (buff2[key] !== void 0) number(buff2[key], `${p}.${key}`, 0, 4);
    if (buff2.armor !== void 0) number(buff2.armor, `${p}.armor`, 0, 100);
    if (buff2.rooted !== void 0) flag(buff2.rooted, `${p}.rooted`);
    if (buff2.fearedFrom !== void 0) position(buff2.fearedFrom, `${p}.fearedFrom`, s);
  });
}
function validateSiege(s, e, path) {
  if (e.siegeMode === void 0) return;
  const p = `${path}.siegeMode`, mode = object(e.siegeMode, p, ["ammo", "deployed"], ["prepared"]);
  if (!realUnit(e) || e.role !== "siege") bad(p, "siege preparation requires a real siege unit");
  const ability = unitFor(s, e).ability ?? "", ammo = number(mode.ammo, `${p}.ammo`, 0, ability === "powered-beam" ? 8 : 10, true), deployed = flag(mode.deployed, `${p}.deployed`);
  if (ability === "ammunition-cannon") {
    if (mode.prepared !== void 0) bad(`${p}.prepared`, "cannon uses ammunition rather than prepared shells");
  } else if (ability === "powered-beam") {
    if (deployed || mode.prepared !== void 0) bad(p, "beam has no deployment or prepared shell state");
  } else if (Object.hasOwn(PREPARED, ability)) {
    if (ammo !== 0 || deployed) bad(p, "prepared shells have no ammunition or deployment state");
    if (mode.prepared !== void 0 && mode.prepared !== PREPARED[ability]) bad(`${p}.prepared`, "prepared shell differs from the unit ability");
  } else bad(p, "unit has no siege preparation ability");
}
function validateBurning(s, e, path, entities) {
  if (e.burning === void 0) return;
  list(e.burning, `${path}.burning`, 64).forEach((value2, i) => {
    const p = `${path}.burning[${i}]`, fire = object(value2, p, ["source", "side", "until", "nextAt", "damage"], ["origin"]);
    const source2 = number(fire.source, `${p}.source`, 1, s.nextId - 1, true), side2 = number(fire.side, `${p}.side`, 0, s.players.length - 1, true);
    const actor3 = entities.get(source2);
    if (actor3 && actor3.side !== side2 && !(actor3.kind === "unit" && actor3.role === "siege" && actor3.definitionFaction !== void 0)) bad(`${p}.side`, "fire side differs from the source entity");
    number(fire.until, `${p}.until`, 0, s.time + 6);
    number(fire.nextAt, `${p}.nextAt`, 0, s.time + 1);
    number(fire.damage, `${p}.damage`, Number.MIN_VALUE, 100);
    if (fire.origin !== void 0) position(fire.origin, `${p}.origin`, s);
  });
}
function validateBeacon(s, e, path) {
  if (e.beacon === void 0) return;
  const p = `${path}.beacon`, beacon2 = object(e.beacon, p, ["connected", "nextAlertAt"]);
  if (e.kind !== "building" || !buildingFor(s, e).tags?.includes("beacon")) bad(p, "beacon state requires a signal beacon");
  flag(beacon2.connected, `${p}.connected`);
  number(beacon2.nextAlertAt, `${p}.nextAlertAt`, 0, s.time + 8);
}
function validateArtifacts(s, state, entities) {
  const records = /* @__PURE__ */ new Map(), held = /* @__PURE__ */ new Map(), counter = number(state.nextArtifactId, "state.specialists.nextArtifactId", 1, MAX_ID, true);
  list(state.artifacts, "state.specialists.artifacts", MAX_RECORDS).forEach((value2, i) => {
    const p = `state.specialists.artifacts[${i}]`, item = object(value2, p, ["id", "definitionId"], ["owner", "holder", "position"]), id5 = number(item.id, `${p}.id`, 1, counter - 1, true);
    if (records.has(id5)) bad(`${p}.id`, "duplicate artifact id");
    records.set(id5, item);
    choice(item.definitionId, `${p}.definitionId`, Object.keys(ARTIFACTS));
    if (item.holder !== void 0) {
      const holderId = number(item.holder, `${p}.holder`, 1, s.nextId - 1, true), holder = entities.get(holderId);
      if (!holder || holder.hp <= 0 || !equipmentEligible2(s, holder)) bad(`${p}.holder`, "artifact requires a living hero or specialist holder");
      number(item.owner, `${p}.owner`, 0, s.players.length - 1, true);
      if (item.owner !== holder.side) bad(`${p}.owner`, "artifact owner differs from its holder");
      if (item.position !== void 0) bad(`${p}.position`, "held artifacts cannot also have a ground position");
      held.set(holderId, (held.get(holderId) ?? 0) + 1);
      if (held.get(holderId) > 12) bad(`${p}.holder`, "holder inventory exceeds twelve artifacts");
    } else {
      if (item.owner !== void 0) bad(`${p}.owner`, "ground artifacts cannot have an owner");
      position(item.position, `${p}.position`, s);
    }
  });
  return records;
}
function validateEquipment(s, e, path, artifacts, equipped) {
  if (e.equipment === void 0) return;
  const p = `${path}.equipment`, equipment = object(e.equipment, p, [], SLOTS);
  if (e.hp <= 0 || !equipmentEligible2(s, e)) bad(p, "equipment requires a living hero or specialist");
  for (const slot of SLOTS) if (equipment[slot] !== void 0) {
    const id5 = number(equipment[slot], `${p}.${slot}`, 1, MAX_ID, true), item = artifacts.get(id5);
    if (!item || item.holder !== e.id || item.owner !== e.side) bad(`${p}.${slot}`, "equipped artifact must belong to this holder");
    const def = ARTIFACTS[item.definitionId];
    if (def.slot !== slot || !def.roles.includes(unitRole(s, e))) bad(`${p}.${slot}`, "artifact does not match this slot or unit role");
    if (equipped.has(id5)) bad(`${p}.${slot}`, "artifact is equipped more than once");
    equipped.add(id5);
  }
}
function validateStructures(s, state, entities) {
  const counter = number(state.nextStructureId, "state.specialists.nextStructureId", 1, MAX_ID, true), ids = /* @__PURE__ */ new Set(), tiles = /* @__PURE__ */ new Set(), barricades = /* @__PURE__ */ new Set();
  list(state.structures, "state.specialists.structures", MAX_RECORDS).forEach((value2, i) => {
    const p = `state.specialists.structures[${i}]`, record6 = object(value2, p, ["id", "kind", "owner", "expires"], ["entityId", "tiles"]), id5 = number(record6.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id5)) bad(`${p}.id`, "duplicate temporary structure id");
    ids.add(id5);
    const kind = choice(record6.kind, `${p}.kind`, ["bridge", "barricade"]), owner = number(record6.owner, `${p}.owner`, 0, s.players.length - 1, true);
    number(record6.expires, `${p}.expires`, 0, s.time + 60);
    if (kind === "barricade") {
      if (record6.tiles !== void 0) bad(`${p}.tiles`, "barricades reference an entity rather than terrain tiles");
      const entityId = number(record6.entityId, `${p}.entityId`, 1, s.nextId - 1, true), entity = entities.get(entityId);
      if (!entity || entity.kind !== "building" || entity.side !== owner || !buildingFor(s, entity).tags?.includes("barricade")) bad(`${p}.entityId`, "temporary barricade must reference its owned barricade entity");
      if (barricades.has(entityId)) bad(`${p}.entityId`, "barricade entity is referenced more than once");
      barricades.add(entityId);
    } else {
      if (record6.entityId !== void 0) bad(`${p}.entityId`, "bridges reference terrain tiles rather than an entity");
      const points = list(record6.tiles, `${p}.tiles`, 3);
      if (points.length !== 3) bad(`${p}.tiles`, "temporary bridge requires three tiles");
      let previous;
      points.forEach((value3, j) => {
        const q = `${p}.tiles[${j}]`, point5 = position(value3, q, s, ["previous", "placed"], ["stamp"]);
        if (point5.x % 1 !== 0.5 || point5.y % 1 !== 0.5) bad(q, "bridge tiles must use tile centers");
        if (point5.stamp !== void 0) number(point5.stamp, `${q}.stamp`, 0, 1e12, true);
        choice(point5.previous, `${q}.previous`, ["water", "shallows", "grass", "road"]);
        if (point5.placed !== "bridge") bad(`${q}.placed`, "temporary bridge must place bridge terrain");
        if (previous && (point5.x !== previous.x + 1 || point5.y !== previous.y || (point5.level ?? 0) !== (previous.level ?? 0))) bad(q, "bridge tiles must be consecutive on the same level");
        const key = `${point5.level ?? 0}:${point5.x}:${point5.y}`;
        if (tiles.has(key)) bad(q, "temporary bridge tiles overlap");
        tiles.add(key);
        previous = point5;
      });
    }
  });
  for (const e of s.entities) if (e.hp > 0 && e.kind === "building" && buildingFor(s, e).tags?.includes("barricade") && !barricades.has(e.id)) bad("state.specialists.structures", "living barricade has no temporary structure record");
}
function validateShots(s, state) {
  const counter = state.nextShotId === void 0 ? 1 : number(state.nextShotId, "state.specialists.nextShotId", 1, MAX_ID, true), ids = /* @__PURE__ */ new Set();
  if (state.shots === void 0) return;
  list(state.shots, "state.specialists.shots", MAX_RECORDS).forEach((value2, i) => {
    const p = `state.specialists.shots[${i}]`, shot = object(value2, p, ["id", "source", "target", "impactAt", "rawDamage", "buildingMultiplier", "payload"], ["modification"]);
    const id5 = number(shot.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id5)) bad(`${p}.id`, "duplicate siege shot id");
    ids.add(id5);
    const source2 = position(shot.source, `${p}.source`, s, ["id", "side", "definitionId", "faction"], ["elevation"]);
    number(source2.id, `${p}.source.id`, 1, s.nextId - 1, true);
    number(source2.side, `${p}.source.side`, 0, s.players.length - 1, true);
    choice(source2.faction, `${p}.source.faction`, Object.keys(contentFactions(s.content)));
    if (typeof source2.definitionId !== "string" || source2.definitionId.length > 100) bad(`${p}.source.definitionId`, "invalid definition ID");
    let ability;
    try {
      ability = unitFor(s, { ...source2, kind: "unit", role: "siege", definitionFaction: source2.faction }).ability;
    } catch {
      bad(`${p}.source.definitionId`, "shot source must resolve a siege definition in its original faction");
    }
    if (source2.elevation !== void 0) number(source2.elevation, `${p}.source.elevation`, 0, 3);
    if (shot.modification !== void 0) choice(shot.modification, `${p}.modification`, ["stone", "grapeshot", "incendiary", "reinforced"]);
    const target = position(shot.target, `${p}.target`, s);
    if ((target.level ?? 0) !== (source2.level ?? 0)) bad(`${p}.target.level`, "siege shots cannot cross world levels");
    number(shot.impactAt, `${p}.impactAt`, 0, s.time + 30);
    number(shot.rawDamage, `${p}.rawDamage`, 0, 1e9);
    number(shot.buildingMultiplier, `${p}.buildingMultiplier`, 0.1, 10);
    const payload = object(shot.payload, `${p}.payload`, ["kind", "damageFactor", "armorPiercing", "radius"]), kind = choice(payload.kind, `${p}.payload.kind`, ["incendiary", "rooting", "corpse", "flood", "beam", "cannon"]);
    const expectedKind = ability === "ammunition-cannon" ? "cannon" : ability === "powered-beam" ? "beam" : PREPARED[ability ?? ""];
    if (kind !== expectedKind) bad(`${p}.payload.kind`, "siege payload differs from its source ability");
    const expectedFactor = kind === "cannon" ? 1.5 : kind === "corpse" ? 1.4 : 1, expectedRadius = kind === "cannon" || kind === "beam" ? 0 : kind === "corpse" ? 2.5 : 2;
    if (payload.damageFactor !== expectedFactor) bad(`${p}.payload.damageFactor`, "siege payload has an invalid damage factor");
    if (payload.armorPiercing !== (kind === "beam")) bad(`${p}.payload.armorPiercing`, "siege payload has an invalid armor-piercing flag");
    if (payload.radius !== expectedRadius) bad(`${p}.payload.radius`, "siege payload has an invalid radius");
  });
}
function validateHeroes(s) {
  for (let side2 = 0; side2 < s.players.length; side2++) {
    const p = `state.players[${side2}].heroRecovery`, player = s.players[side2], heroes = availableUnits(s, side2).filter((def) => def.tags?.includes("hero")), heroIds = new Set(heroes.map((def) => def.id));
    let active4 = 0;
    for (const e of s.entities) if (e.side === side2 && e.hp > 0) {
      if (realUnit(e) && unitFor(s, e).tags?.includes("hero")) active4++;
      if (e.kind === "building") for (let i = 0; i < e.queue.length; i++) {
        const def = unitFor(s, side2, e.queue[i], e.queueDefinitionIds?.[i]);
        if (def.tags?.includes("hero")) active4++;
      }
    }
    if (active4 > 1) bad(`state.players[${side2}]`, "a player cannot have multiple living or queued commanders");
    if (player.heroRecovery === void 0) continue;
    const seen = /* @__PURE__ */ new Set();
    list(player.heroRecovery, p, heroes.length).forEach((value2, i) => {
      const q = `${p}[${i}]`, recovery = object(value2, q, ["definitionId", "availableAt"]), id5 = choice(recovery.definitionId, `${q}.definitionId`, [...heroIds]);
      if (seen.has(id5)) bad(`${q}.definitionId`, "duplicate commander recovery");
      seen.add(id5);
      const at2 = number(recovery.availableAt, `${q}.availableAt`, 0, s.time + 30);
      if (active4 && at2 > s.time) bad(`${q}.availableAt`, "a recovering commander cannot already be alive or queued");
    });
  }
}
function validateSpecialists(s) {
  const entities = new Map(s.entities.map((e) => [e.id, e])), equipped = /* @__PURE__ */ new Set();
  let artifacts = /* @__PURE__ */ new Map();
  if (s.specialists !== void 0) {
    const state = object(s.specialists, "state.specialists", ["artifacts", "structures", "nextArtifactId", "nextStructureId"], ["shots", "nextShotId"]);
    artifacts = validateArtifacts(s, state, entities);
    validateStructures(s, state, entities);
    validateShots(s, state);
  }
  if (s.specialists === void 0 && s.entities.some((e) => e.hp > 0 && e.kind === "building" && buildingFor(s, e).tags?.includes("barricade"))) bad("state.specialists", "living barricade requires temporary structure records");
  s.entities.forEach((e, i) => {
    const p = `state.entities[${i}]`;
    validateVeteran(s, e, p);
    validateBuffs(s, e, p);
    validateSiege(s, e, p);
    validateBurning(s, e, p, entities);
    validateBeacon(s, e, p);
    validateEquipment(s, e, p, artifacts, equipped);
  });
  validateHeroes(s);
}

// src/core/world-validation.ts
function validateWorldState(input, width, height, nextId, players) {
  const fail2 = (path) => {
    throw new Error(`Invalid save world at ${path}.`);
  };
  const record6 = (v, path, fields2, optional = []) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !fields2.includes(k) && !optional.includes(k)) || fields2.some((k) => !Object.hasOwn(v, k))) fail2(path);
    return v;
  };
  const list4 = (v, path, max) => {
    if (!Array.isArray(v) || v.length > max) fail2(path);
    return v;
  };
  const number6 = (v, path, min = 0, max = 1e12, int = false) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || int && !Number.isSafeInteger(v)) fail2(path);
    return v;
  };
  const world2 = record6(input, "state", ["version", "biome", "levels", "transitions", "bridges", "fires", "sites", "creatures", "dayLength", "seasonLength", "weatherLength", "nextEnvironmentAt", "iceTiles", "thawWarned"], ["revision"]);
  if (world2.revision !== void 0) number6(world2.revision, "revision", 0, 1e12, true);
  if (world2.version !== 1 || !BIOMES.includes(world2.biome) || typeof world2.thawWarned !== "boolean") fail2("version/biome/flags");
  const levels = list4(world2.levels, "levels", 2);
  if (!levels.length) fail2("levels");
  const area = width * height;
  const coord = (v, path) => {
    number6(v.x, `${path}.x`, 0, width);
    number6(v.y, `${path}.y`, 0, height);
    number6(v.level, `${path}.level`, 0, levels.length - 1, true);
  };
  const side2 = (v, path) => {
    if (v !== null) number6(v, path, 0, players - 1, true);
  };
  const ids = /* @__PURE__ */ new Set(), id5 = (v, path, allocate = true) => {
    const n = number6(v, path, 1, nextId - 1, true);
    if (allocate) {
      if (ids.has(n)) fail2(`${path}duplicate`);
      ids.add(n);
    }
    return n;
  };
  const cost5 = (v, path) => {
    const c = record6(v, path, ["wood", "ore", "crystal"]);
    for (const kind of ["wood", "ore", "crystal"]) number6(c[kind], `${path}.${kind}`, 0, 1e9);
  };
  for (let i = 0; i < levels.length; i++) {
    const l = record6(levels[i], `levels${i}`, ["id", "title", "terrain", "elevation"]);
    if (l.id !== i || typeof l.title !== "string" || l.title.length > 80) fail2(`levels${i}.id/title`);
    const terrain2 = list4(l.terrain, `levels${i}.terrain`, area), elevation = list4(l.elevation, `levels${i}.elevation`, area);
    if (terrain2.length !== area || elevation.length !== area) fail2(`levels${i}.dimensions`);
    terrain2.forEach((t, j) => {
      if (typeof t !== "string" || !Object.hasOwn(TERRAIN, t)) fail2(`levels${i}.terrain${j}`);
    });
    elevation.forEach((e, j) => number6(e, `levels${i}.elevation${j}`, 0, 3, true));
  }
  const transitionIds = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world2.transitions, "transitions", 64).entries()) {
    const t = record6(v, `transition${i}`, ["id", "from", "to"]), n = number6(t.id, `transition${i}.id`, 1, 2147483647, true);
    if (transitionIds.has(n)) fail2(`transition${i}.duplicate`);
    transitionIds.add(n);
    for (const field of ["from", "to"]) coord(record6(t[field], `transition${i}.${field}`, ["x", "y", "level"]), `transition${i}.${field}`);
    if (t.from.level === t.to.level) fail2(`transition${i}.levels`);
  }
  for (const [i, v] of list4(world2.bridges, "bridges", 512).entries()) {
    const b = record6(v, `bridge${i}`, ["id", "x", "y", "level", "hp", "maxHp", "tiles", "rebuilding", "repairSide"]);
    id5(b.id, `bridge${i}.id`);
    coord(b, `bridge${i}`);
    const max = number6(b.maxHp, `bridge${i}.maxHp`, 1, 1e9);
    number6(b.hp, `bridge${i}.hp`, 0, max);
    number6(b.rebuilding, `bridge${i}.rebuilding`, 0, 1);
    side2(b.repairSide, `bridge${i}.repairSide`);
    const tiles = list4(b.tiles, `bridge${i}.tiles`, area);
    if (!tiles.length || new Set(tiles).size !== tiles.length) fail2(`bridge${i}.tiles`);
    tiles.forEach((t, j) => number6(t, `bridge${i}.tiles${j}`, 0, area - 1, true));
  }
  const fireKeys = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world2.fires, "fires", area * levels.length).entries()) {
    const f = record6(v, `fire${i}`, ["x", "y", "level", "heat", "expires", "nextSpread"]);
    coord(f, `fire${i}`);
    number6(f.heat, `fire${i}.heat`, 0, 1);
    number6(f.expires, `fire${i}.expires`);
    number6(f.nextSpread, `fire${i}.nextSpread`);
    const k = `${f.level},${Math.floor(f.x)},${Math.floor(f.y)}`;
    if (fireKeys.has(k)) fail2(`fire${i}.duplicate`);
    fireKeys.add(k);
  }
  const sites = list4(world2.sites, "sites", 128), siteIds = /* @__PURE__ */ new Set(), creatureRefs = /* @__PURE__ */ new Set();
  for (const [i, v] of sites.entries()) {
    const site = record6(v, `site${i}`, ["id", "x", "y", "level", "kind", "owner", "loyalty", "progress", "capturing", "reward", "rewarded", "request", "supplied", "creatureIds", "respawnAt"]);
    siteIds.add(id5(site.id, `site${i}.id`));
    coord(site, `site${i}`);
    if (!["relic", "village", "monster"].includes(site.kind) || typeof site.supplied !== "boolean") fail2(`site${i}.kind/flags`);
    side2(site.owner, `site${i}.owner`);
    side2(site.capturing, `site${i}.capturing`);
    const loyalty = list4(site.loyalty, `site${i}.loyalty`, players);
    if (loyalty.length !== players) fail2(`site${i}.loyalty`);
    loyalty.forEach((l, j) => number6(l, `site${i}.loyalty${j}`, 0, 100));
    number6(site.progress, `site${i}.progress`, 0, 1);
    cost5(site.reward, `site${i}.reward`);
    cost5(site.request, `site${i}.request`);
    for (const player of list4(site.rewarded, `site${i}.rewarded`, players)) number6(player, `site${i}.rewarded`, 0, players - 1, true);
    if (new Set(site.rewarded).size !== site.rewarded.length) fail2(`site${i}.rewarded`);
    for (const n of list4(site.creatureIds, `site${i}.creatureIds`, 16)) {
      const target = id5(n, `site${i}.creatureId`, false);
      if (creatureRefs.has(target)) fail2(`site${i}.duplicateCreature`);
      creatureRefs.add(target);
    }
    number6(site.respawnAt, `site${i}.respawnAt`);
  }
  const creatures = list4(world2.creatures, "creatures", 2048), creatureIds = /* @__PURE__ */ new Set();
  for (const [i, v] of creatures.entries()) {
    const creature = record6(v, `creature${i}`, ["id", "site", "x", "y", "level", "hp", "maxHp", "cooldown", "target", "path", "patrol", "respawnAt"]), n = id5(creature.id, `creature${i}.id`);
    creatureIds.add(n);
    coord(creature, `creature${i}`);
    if (!siteIds.has(number6(creature.site, `creature${i}.site`, 1, nextId - 1, true))) fail2(`creature${i}.site`);
    const max = number6(creature.maxHp, `creature${i}.maxHp`, 1, 1e9);
    number6(creature.hp, `creature${i}.hp`, 0, max);
    for (const field of ["cooldown", "patrol", "respawnAt"]) number6(creature[field], `creature${i}.${field}`);
    if (creature.target !== null) id5(creature.target, `creature${i}.target`, false);
    for (const [j, p] of list4(creature.path, `creature${i}.path`, area * 16).entries()) {
      if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).some((k) => !["x", "y", "level"].includes(k))) fail2(`creature${i}.path${j}`);
      const point5 = p;
      coord({ ...point5, level: point5.level ?? 0 }, `creature${i}.path${j}`);
    }
  }
  if (creatureRefs.size !== creatureIds.size || [...creatureRefs].some((n) => !creatureIds.has(n))) fail2("siteCreatureReferences");
  for (const site of sites) for (const n of site.creatureIds) if (creatures.find((c) => c.id === n)?.site !== site.id) fail2("creatureSiteReference");
  const iceKeys = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world2.iceTiles, "iceTiles", area * levels.length).entries()) {
    const ice = record6(v, `ice${i}`, ["level", "tile"]);
    number6(ice.level, `ice${i}.level`, 0, levels.length - 1, true);
    number6(ice.tile, `ice${i}.tile`, 0, area - 1, true);
    const k = `${ice.level},${ice.tile}`;
    if (iceKeys.has(k)) fail2(`ice${i}.duplicate`);
    iceKeys.add(k);
  }
  for (const field of ["dayLength", "seasonLength", "weatherLength"]) number6(world2[field], field, 0.05, 1e6);
  number6(world2.nextEnvironmentAt, "nextEnvironmentAt");
}

// src/core/team-ai.ts
var TEAM_ATTACK_MIN_FIGHTERS = 4;
var TEAM_ATTACK_MIN_PARTICIPANTS = 2;
var TEAM_AI_REPORT_TTL = 6;
var TEAM_AI_WAVE_DELAY = 3;
var TEAM_AI_WAVE_LIFETIME = 12;
var TEAM_AI_COMMAND_IDS = 100;
var TEAM_AI_SCOUT_LEASE = 30;
var TEAM_AI_EXPANSION_LEASE = 45;
var MAX_TEAM_AI_RESERVATIONS = 16;
var MAX_TEAM_AI_WAVES = 8;
var MAX_TEAM_DIRECTIVES = 32;
var MAX_TEAM_TRANSFERS = 64;
function emptyTeamAiState() {
  return { coordinator: { nextWaveId: 1, reservations: [], waves: [] }, directives: [], nextDirectiveId: 1, nextTransferId: 1, transfers: [] };
}
function hasTeamAiMemory(state) {
  return state.nextDirectiveId !== 1 || state.nextTransferId !== 1 || state.coordinator.nextWaveId !== 1 || state.directives.length > 0 || state.transfers.length > 0 || state.coordinator.reservations.length > 0 || state.coordinator.waves.length > 0;
}
var point = (v) => ({ x: v.x, y: v.y, ...v.level === void 0 ? {} : { level: v.level } });
var distance6 = (a, b) => sameLevel2(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var targetRank = { hq: 0, building: 1, unit: 2, start: 3 };
var keyCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var pointKey = (v) => `${levelOf2(v)}:${v.x},${v.y}`;
var copyReservation = (r) => ({ ...r, destination: point(r.destination), ids: [...r.ids].sort((a, b) => a - b) });
var copyWave = (w) => ({ ...w, target: { ...w.target }, participants: w.participants.map((p) => ({ side: p.side, ids: [...p.ids].sort((a, b) => a - b) })).sort((a, b) => a.side - b.side) });
function coordinateTeamAi(previous, reports, time2) {
  if (!Number.isFinite(time2) || time2 < 0) throw new Error("Invalid team AI planning time.");
  const sides = /* @__PURE__ */ new Set();
  for (const report of reports) {
    if (sides.has(report.side)) throw new Error("Duplicate team AI owner report.");
    sides.add(report.side);
  }
  const current = reports.filter((r) => r.time <= time2 && time2 - r.time <= TEAM_AI_REPORT_TTL).map((r) => ({ ...r, hq: point(r.hq), fighters: r.fighters.map((f) => ({ ...f })).sort((a, b) => a.id - b.id), threats: r.threats.map((t) => ({ ...t })), targets: r.targets.map((t) => ({ ...t })), expansion: r.expansion ? point(r.expansion) : void 0 })).sort((a, b) => a.side - b.side);
  const groups = /* @__PURE__ */ new Map();
  for (const report of current) {
    const group = groups.get(report.teamId) ?? [];
    group.push(report);
    groups.set(report.teamId, group);
  }
  const coordinator = { nextWaveId: previous.nextWaveId, reservations: [], waves: [] };
  const assignments = [], launches = [];
  for (const [teamId, members] of [...groups].sort(([a], [b]) => a - b)) {
    if (members.length < TEAM_ATTACK_MIN_PARTICIPANTS) continue;
    const memberBySide = new Map(members.map((m) => [m.side, m]));
    const fighters = members.flatMap((m) => m.fighters.map((f) => ({ ...f, side: m.side })));
    const occupied = /* @__PURE__ */ new Set();
    const threats = /* @__PURE__ */ new Map();
    for (const member of [...members].sort((a, b) => b.time - a.time || a.side - b.side)) for (const threat of [...member.threats].sort((a, b) => a.id - b.id)) if (!threats.has(threat.id)) threats.set(threat.id, { ...threat });
    for (const threat of [...threats.values()].sort((a, b) => a.id - b.id)) {
      const defenders = fighters.filter((f) => !occupied.has(f.id) && sameLevel2(f, threat)).sort((a, b) => distance6(a, threat) - distance6(b, threat) || a.side - b.side || a.id - b.id).slice(0, 3);
      for (const member of members) {
        const ids = defenders.filter((f) => f.side === member.side).map((f) => f.id).sort((a, b) => a - b);
        if (!ids.length) continue;
        ids.forEach((id5) => occupied.add(id5));
        assignments.push({ side: member.side, role: "defend", ids, destination: point(threat), targetKey: `threat:${threat.id}` });
      }
    }
    const oldWave = previous.waves.filter((w) => w.teamId === teamId).sort((a, b) => a.id - b.id)[0];
    let wave;
    let launchedThisStep = false;
    if (oldWave) {
      wave = copyWave(oldWave);
      wave.participants = wave.participants.flatMap((p) => {
        const report = memberBySide.get(p.side);
        if (!report) return [];
        const available = new Set(report.fighters.filter((f) => sameLevel2(f, wave.target)).map((f) => f.id));
        const ids = p.ids.filter((id5) => available.has(id5) && !occupied.has(id5));
        return ids.length ? [{ side: p.side, ids }] : [];
      });
      const total2 = wave.participants.reduce((sum, p) => sum + p.ids.length, 0);
      if (!wave.launched && wave.participants.length && time2 >= wave.launchAt && (wave.participants.length >= TEAM_ATTACK_MIN_PARTICIPANTS && total2 >= TEAM_ATTACK_MIN_FIGHTERS || time2 >= wave.expiresAt)) {
        for (const participant of wave.participants) for (let i = 0; i < participant.ids.length; i += TEAM_AI_COMMAND_IDS) launches.push({ side: participant.side, ids: participant.ids.slice(i, i + TEAM_AI_COMMAND_IDS), destination: point(wave.target), waveId: wave.id });
        wave.launched = true;
        launchedThisStep = true;
        for (const p of wave.participants) p.ids.forEach((id5) => occupied.add(id5));
      }
      if (!wave.participants.length || time2 >= wave.expiresAt) wave = void 0;
    }
    let reservations = previous.reservations.filter((r) => r.teamId === teamId && r.expiresAt > time2).map(copyReservation).filter((r) => {
      const report = memberBySide.get(r.side);
      if (!report) return false;
      if (r.role === "expand") return !!report.expansion && pointKey(report.expansion) === pointKey(r.destination) && !threats.size;
      return report.scoutingNeeded && r.ids.length === 1 && report.fighters.some((f) => f.id === r.ids[0] && sameLevel2(f, r.destination)) && !occupied.has(r.ids[0]);
    });
    if (wave) {
      for (const p of wave.participants) p.ids.forEach((id5) => occupied.add(id5));
      reservations = reservations.filter((r) => r.role === "expand" || r.ids.every((id5) => !occupied.has(id5)));
    }
    const observed2 = /* @__PURE__ */ new Map();
    for (const target of members.flatMap((m) => m.targets.filter((t) => t.seenAt <= m.time)).sort((a, b) => b.seenAt - a.seenAt || a.observer - b.observer || targetRank[a.kind] - targetRank[b.kind] || keyCompare(a.key, b.key) || levelOf2(a) - levelOf2(b) || a.x - b.x || a.y - b.y)) {
      const variant = `${target.key}@${pointKey(target)}`;
      if (!observed2.has(variant)) observed2.set(variant, { ...target });
    }
    const targets = [...observed2.values()].sort((a, b) => targetRank[a.kind] - targetRank[b.kind] || b.seenAt - a.seenAt || keyCompare(a.key, b.key) || levelOf2(a) - levelOf2(b) || a.x - b.x || a.y - b.y);
    if (!threats.size && !wave && !launchedThisStep) {
      if (!reservations.some((r) => r.role === "scout")) {
        const expandSides = new Set(reservations.filter((r) => r.role === "expand").map((r) => r.side));
        const scouts = members.filter((m) => m.scoutingNeeded && m.fighters.some((f) => !occupied.has(f.id)) && m.targets.some((t) => t.seenAt <= m.time && m.fighters.some((f) => sameLevel2(f, t) && !occupied.has(f.id)))).sort((a, b) => Number(expandSides.has(a.side)) - Number(expandSides.has(b.side)) || a.side - b.side);
        const scout = scouts[0], scoutTargets = scout?.targets.filter((t) => t.seenAt <= scout.time && scout.fighters.some((f) => sameLevel2(f, t) && !occupied.has(f.id))).sort((a, b) => targetRank[a.kind] - targetRank[b.kind] || b.seenAt - a.seenAt || keyCompare(a.key, b.key) || levelOf2(a) - levelOf2(b)) ?? [];
        const target2 = scoutTargets.find((t) => t.kind !== "unit") ?? scoutTargets[0];
        if (scout && target2) {
          const fighter = [...scout.fighters].filter((f) => !occupied.has(f.id) && sameLevel2(f, target2)).sort((a, b) => Number(b.role === "cavalry") - Number(a.role === "cavalry") || a.id - b.id)[0];
          reservations.push({ teamId, side: scout.side, role: "scout", key: target2.key, destination: point(target2), ids: [fighter.id], createdAt: time2, expiresAt: time2 + TEAM_AI_SCOUT_LEASE });
        }
      }
      if (!reservations.some((r) => r.role === "expand")) {
        const scoutSides = new Set(reservations.filter((r) => r.role === "scout").map((r) => r.side));
        const expanding = members.filter((m) => m.expansion).sort((a, b) => Number(scoutSides.has(a.side)) - Number(scoutSides.has(b.side)) || distance6(a.hq, a.expansion) - distance6(b.hq, b.expansion) || a.side - b.side)[0];
        if (expanding) reservations.push({ teamId, side: expanding.side, role: "expand", key: `expansion:${pointKey(expanding.expansion)}`, destination: point(expanding.expansion), ids: [], createdAt: time2, expiresAt: time2 + TEAM_AI_EXPANSION_LEASE });
      }
      const ready = members.filter((m) => m.readyToAttack && m.waveReadyAt <= time2 + TEAM_AI_WAVE_LIFETIME);
      const scoutIds = new Set(reservations.filter((r) => r.role === "scout").flatMap((r) => r.ids));
      let target, participants = [];
      const useful = (army) => army.length >= TEAM_ATTACK_MIN_PARTICIPANTS && army.reduce((sum, p) => sum + p.ids.length, 0) >= TEAM_ATTACK_MIN_FIGHTERS;
      for (const candidate of targets) {
        const approved = ready.filter((m) => m.fighters.filter((f) => sameLevel2(f, candidate)).length >= 2 && m.targets.some((known2) => known2.key === candidate.key && known2.x === candidate.x && known2.y === candidate.y && sameLevel2(known2, candidate) && known2.seenAt <= m.time));
        let army = approved.map((m) => ({ side: m.side, ids: m.fighters.filter((f) => !scoutIds.has(f.id) && sameLevel2(f, candidate)).map((f) => f.id) })).filter((p) => p.ids.length);
        if (!useful(army)) army = approved.map((m) => ({ side: m.side, ids: m.fighters.filter((f) => sameLevel2(f, candidate)).map((f) => f.id) })).filter((p) => p.ids.length);
        if (useful(army)) {
          target = candidate;
          participants = army;
          break;
        }
      }
      if (target) {
        const launchAt = Math.max(time2 + TEAM_AI_WAVE_DELAY, ...participants.map((p) => memberBySide.get(p.side).waveReadyAt));
        if (launchAt <= time2 + TEAM_AI_WAVE_LIFETIME) {
          wave = { id: coordinator.nextWaveId++, teamId, target: { ...target }, participants, launchAt, expiresAt: time2 + TEAM_AI_WAVE_LIFETIME, launched: false };
          for (const p of participants) p.ids.forEach((id5) => occupied.add(id5));
          reservations = reservations.filter((r) => r.role === "expand" || r.ids.every((id5) => !occupied.has(id5)));
        }
      }
      if (!wave) {
        const solos = members.filter((m) => m.soloReadyToAttack && m.waveReadyAt + TEAM_AI_WAVE_LIFETIME <= time2 && m.fighters.some((f) => !occupied.has(f.id)) && m.targets.some((t) => t.seenAt <= m.time && m.fighters.some((f) => sameLevel2(f, t) && !occupied.has(f.id)))).sort((a, b) => a.waveReadyAt - b.waveReadyAt || a.side - b.side);
        const solo = solos[0], known2 = solo?.targets.filter((t) => t.seenAt <= solo.time && solo.fighters.filter((f) => sameLevel2(f, t) && !occupied.has(f.id)).length >= (solo.soloAttackSize ?? 3)).sort((a, b) => targetRank[a.kind] - targetRank[b.kind] || b.seenAt - a.seenAt || keyCompare(a.key, b.key) || levelOf2(a) - levelOf2(b) || a.x - b.x || a.y - b.y)[0];
        if (solo && known2) {
          const ids = solo.fighters.filter((f) => !occupied.has(f.id) && sameLevel2(f, known2)).map((f) => f.id), waveId = coordinator.nextWaveId++;
          wave = { id: waveId, teamId, target: { ...known2 }, participants: [{ side: solo.side, ids }], launchAt: time2, expiresAt: time2 + TEAM_AI_WAVE_LIFETIME, launched: true };
          for (let i = 0; i < ids.length; i += TEAM_AI_COMMAND_IDS) launches.push({ side: solo.side, ids: ids.slice(i, i + TEAM_AI_COMMAND_IDS), destination: point(known2), waveId });
          ids.forEach((id5) => occupied.add(id5));
          reservations = reservations.filter((r) => r.role === "expand" || r.ids.every((id5) => !occupied.has(id5)));
        }
      }
    }
    if (wave) {
      coordinator.waves.push(wave);
      for (const participant of wave.participants) assignments.push({ side: participant.side, role: "attack", ids: [...participant.ids], destination: point(wave.target), targetKey: wave.target.key, waveId: wave.id, launchAt: wave.launchAt });
    }
    for (const reservation of reservations) {
      coordinator.reservations.push(reservation);
      assignments.push({ side: reservation.side, role: reservation.role, ids: [...reservation.ids], destination: point(reservation.destination), targetKey: reservation.key });
    }
  }
  coordinator.reservations = coordinator.reservations.slice(0, MAX_TEAM_AI_RESERVATIONS);
  coordinator.waves = coordinator.waves.slice(0, MAX_TEAM_AI_WAVES);
  assignments.sort((a, b) => a.side - b.side || keyCompare(a.role, b.role) || keyCompare(a.targetKey ?? "", b.targetKey ?? ""));
  launches.sort((a, b) => a.side - b.side || a.waveId - b.waveId);
  return { coordinator, assignments, launches };
}
function validateTeamAiState(value2, context) {
  const fail2 = (path, reason) => {
    throw new Error(`Invalid team AI at ${path}: ${reason}.`);
  };
  const object6 = (v, path, required, optional = []) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) fail2(path, "expected a plain object");
    const record6 = v;
    const names = Object.getOwnPropertyNames(record6);
    if (Object.getOwnPropertySymbols(record6).length || names.some((k) => ![...required, ...optional].includes(k)) || required.some((k) => !Object.hasOwn(record6, k))) fail2(path, "unexpected or missing field");
    for (const key of names) if (!("value" in Object.getOwnPropertyDescriptor(record6, key))) fail2(path, "accessors are forbidden");
    return record6;
  };
  const number6 = (v, path, min, max, integer2 = false) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer2 && !Number.isSafeInteger(v)) fail2(path, "invalid number");
    return v;
  };
  const list4 = (v, path, max) => {
    if (!Array.isArray(v) || v.length > max || Object.getPrototypeOf(v) !== Array.prototype) fail2(path, "invalid array");
    const source2 = v, array3 = [];
    if (Object.getOwnPropertySymbols(source2).length || Object.getOwnPropertyNames(source2).some((k) => k !== "length" && (!/^(0|[1-9]\d*)$/.test(k) || Number(k) >= source2.length))) fail2(path, "unexpected array properties");
    for (let i = 0; i < source2.length; i++) {
      const d = Object.getOwnPropertyDescriptor(source2, String(i));
      if (!d || !("value" in d)) fail2(path, "array gaps and accessors are forbidden");
      array3.push(d.value);
    }
    return array3;
  };
  const choice6 = (v, path, choices) => {
    if (typeof v !== "string" || !choices.includes(v)) fail2(path, "unknown value");
    return v;
  };
  const text3 = (v, path, max = 128) => {
    if (typeof v !== "string" || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) fail2(path, "invalid text");
    return v;
  };
  number6(context.playerCount, "context.playerCount", 1, 8, true);
  number6(context.time, "context.time", 0, 1e12);
  number6(context.nextEntityId, "context.nextEntityId", 1, 2147483647, true);
  number6(context.width, "context.width", 1, 256);
  number6(context.height, "context.height", 1, 256);
  number6(context.levels ?? 1, "context.levels", 1, 2, true);
  if (context.teams.length !== context.playerCount) fail2("context.teams", "invalid roster");
  context.teams.forEach((t, i) => number6(t, `context.teams[${i}]`, 0, 7, true));
  const side2 = (v, path) => number6(v, path, 0, context.playerCount - 1, true);
  const id5 = (v, path) => number6(v, path, 1, context.nextEntityId - 1, true);
  const when = (v, path) => number6(v, path, 0, context.time);
  const position2 = (v, path) => {
    const p = object6(v, path, ["x", "y"], ["level"]);
    return { ...p.level === void 0 ? {} : { level: number6(p.level, `${path}.level`, 0, (context.levels ?? 1) - 1, true) }, x: number6(p.x, `${path}.x`, 0, context.width), y: number6(p.y, `${path}.y`, 0, context.height) };
  };
  const unique2 = (items, path, read) => {
    const seen = /* @__PURE__ */ new Set();
    return items.map((v, i) => {
      const n = read(v, `${path}[${i}]`);
      if (seen.has(n)) fail2(path, "duplicate ID");
      seen.add(n);
      return n;
    });
  };
  const claimed = /* @__PURE__ */ new Set();
  const assigned = (v, path, owner, active4) => unique2(list4(v, path, 500), path, id5).map((n) => {
    if (active4 && context.entitySides && context.entitySides.get(n) !== owner) fail2(path, "assigned entity has a different or missing owner");
    if (active4) {
      if (claimed.has(n)) fail2(path, "duplicate active troop assignment");
      claimed.add(n);
    }
    return n;
  });
  const assignedLevel = (ids, destination, path, active4 = true) => {
    if (active4 && context.entityLevels && ids.some((id6) => context.entityLevels.get(id6) !== levelOf2(destination))) fail2(path, "assigned entity is on a different or missing level");
  };
  const cost5 = (v, path) => {
    const c = object6(v, path, ["wood", "ore", "crystal"]);
    const result = { wood: number6(c.wood, `${path}.wood`, 0, 1e9), ore: number6(c.ore, `${path}.ore`, 0, 1e9), crystal: number6(c.crystal, `${path}.crystal`, 0, 1e9) };
    if (!result.wood && !result.ore && !result.crystal) fail2(path, "empty resources");
    return result;
  };
  const allies2 = (a, b, path) => {
    if (a === b || context.teams[a] !== context.teams[b]) fail2(path, "expected distinct allies");
  };
  const root = object6(value2, "state", ["coordinator", "directives", "nextDirectiveId", "nextTransferId", "transfers"]);
  const saved = object6(root.coordinator, "coordinator", ["nextWaveId", "reservations", "waves"]);
  const nextWaveId = number6(saved.nextWaveId, "coordinator.nextWaveId", 1, 1e12, true), nextDirectiveId = number6(root.nextDirectiveId, "nextDirectiveId", 1, 1e12, true), nextTransferId = number6(root.nextTransferId, "nextTransferId", 1, 1e12, true);
  const reservationKeys = /* @__PURE__ */ new Set();
  const reservations = list4(saved.reservations, "coordinator.reservations", MAX_TEAM_AI_RESERVATIONS).map((v, i) => {
    const path = `coordinator.reservations[${i}]`, r = object6(v, path, ["teamId", "side", "role", "key", "destination", "ids", "createdAt", "expiresAt"]);
    const owner = side2(r.side, `${path}.side`), teamId = number6(r.teamId, `${path}.teamId`, 0, 7, true);
    if (context.teams[owner] !== teamId) fail2(path, "reservation team differs from owner");
    const role = choice6(r.role, `${path}.role`, ["scout", "expand"]), key = text3(r.key, `${path}.key`), slot = `${teamId}:${role}`;
    if (reservationKeys.has(slot)) fail2(path, "duplicate reservation role");
    reservationKeys.add(slot);
    const ids = assigned(r.ids, `${path}.ids`, owner, true);
    if (role === "scout" ? ids.length !== 1 : ids.length !== 0) fail2(path, "invalid role assignment");
    const createdAt = when(r.createdAt, `${path}.createdAt`), expiresAt = number6(r.expiresAt, `${path}.expiresAt`, createdAt, createdAt + (role === "scout" ? TEAM_AI_SCOUT_LEASE : TEAM_AI_EXPANSION_LEASE));
    const destination = position2(r.destination, `${path}.destination`);
    assignedLevel(ids, destination, `${path}.ids`);
    return { teamId, side: owner, role, key, destination, ids, createdAt, expiresAt };
  });
  const waveIds = /* @__PURE__ */ new Set(), waveTeams = /* @__PURE__ */ new Set();
  const waves = list4(saved.waves, "coordinator.waves", MAX_TEAM_AI_WAVES).map((v, i) => {
    const path = `coordinator.waves[${i}]`, w = object6(v, path, ["id", "teamId", "target", "participants", "launchAt", "expiresAt", "launched"]), waveId = number6(w.id, `${path}.id`, 1, nextWaveId - 1, true), teamId = number6(w.teamId, `${path}.teamId`, 0, 7, true);
    if (waveIds.has(waveId) || waveTeams.has(teamId)) fail2(path, "duplicate wave ID or team");
    waveIds.add(waveId);
    waveTeams.add(teamId);
    const t = object6(w.target, `${path}.target`, ["key", "kind", "observer", "seenAt", "x", "y"], ["level"]), observer = side2(t.observer, `${path}.target.observer`);
    if (context.teams[observer] !== teamId) fail2(path, "target observer is not allied");
    const target = { ...position2({ x: t.x, y: t.y, ...t.level === void 0 ? {} : { level: t.level } }, `${path}.target.position`), key: text3(t.key, `${path}.target.key`), kind: choice6(t.kind, `${path}.target.kind`, ["hq", "building", "unit", "start"]), observer, seenAt: when(t.seenAt, `${path}.target.seenAt`) };
    const participantSides = /* @__PURE__ */ new Set(), troopIds = /* @__PURE__ */ new Set();
    const participants = list4(w.participants, `${path}.participants`, 8).map((v2, j) => {
      const ppath = `${path}.participants[${j}]`, p = object6(v2, ppath, ["side", "ids"]), owner = side2(p.side, `${ppath}.side`);
      if (context.teams[owner] !== teamId || participantSides.has(owner)) fail2(ppath, "duplicate or hostile participant");
      participantSides.add(owner);
      const ids = assigned(p.ids, `${ppath}.ids`, owner, true);
      assignedLevel(ids, target, `${ppath}.ids`);
      if (!ids.length) fail2(ppath, "empty participant");
      for (const n of ids) {
        if (troopIds.has(n)) fail2(ppath, "duplicate troop");
        troopIds.add(n);
      }
      return { side: owner, ids };
    });
    if (!participants.length) fail2(path, "empty wave");
    const launchAt = number6(w.launchAt, `${path}.launchAt`, 0, context.time + TEAM_AI_WAVE_LIFETIME), expiresAt = number6(w.expiresAt, `${path}.expiresAt`, launchAt, context.time + TEAM_AI_WAVE_LIFETIME);
    if (typeof w.launched !== "boolean") fail2(path, "invalid launched flag");
    if (w.launched && launchAt > context.time) fail2(path, "launched wave has a future launch time");
    return { id: waveId, teamId, target, participants, launchAt, expiresAt, launched: w.launched };
  });
  const directiveIds = /* @__PURE__ */ new Set(), activeRecipients = /* @__PURE__ */ new Set();
  const directives = list4(root.directives, "directives", MAX_TEAM_DIRECTIVES).map((v, i) => {
    const path = `directives[${i}]`, d = object6(v, path, ["id", "issuer", "recipient", "kind", "createdAt", "expiresAt", "status", "assigned"], ["destination", "observedTarget", "resources", "arrivedAt", "reason"]);
    const directiveId = number6(d.id, `${path}.id`, 1, nextDirectiveId - 1, true);
    if (directiveIds.has(directiveId)) fail2(path, "duplicate directive ID");
    directiveIds.add(directiveId);
    const issuer = side2(d.issuer, `${path}.issuer`), recipient = side2(d.recipient, `${path}.recipient`);
    allies2(issuer, recipient, path);
    const kind = choice6(d.kind, `${path}.kind`, ["defend", "scout", "attack", "support"]), status = choice6(d.status, `${path}.status`, ["accepted", "active", "completed", "failed", "cancelled"]);
    if (status === "accepted" || status === "active") {
      if (activeRecipients.has(recipient)) fail2(path, "duplicate active recipient");
      activeRecipients.add(recipient);
    }
    const createdAt = when(d.createdAt, `${path}.createdAt`), expiresAt = number6(d.expiresAt, `${path}.expiresAt`, createdAt, createdAt + 180);
    const result = { id: directiveId, issuer, recipient, kind, createdAt, expiresAt, status, assigned: assigned(d.assigned, `${path}.assigned`, recipient, status === "accepted" || status === "active") };
    if (kind === "support") {
      if (d.destination !== void 0 || d.observedTarget !== void 0 || result.assigned.length) fail2(path, "support cannot assign troops or a destination");
      result.resources = cost5(d.resources, `${path}.resources`);
    } else {
      if (d.resources !== void 0) fail2(path, "only support has resources");
      result.destination = position2(d.destination, `${path}.destination`);
      assignedLevel(result.assigned, result.destination, `${path}.assigned`, status === "accepted" || status === "active");
    }
    if (d.observedTarget !== void 0) {
      if (kind !== "attack") fail2(path, "only attack has an observed target");
      result.observedTarget = id5(d.observedTarget, `${path}.observedTarget`);
    }
    if (d.arrivedAt !== void 0) result.arrivedAt = number6(d.arrivedAt, `${path}.arrivedAt`, createdAt, context.time);
    if (d.reason !== void 0) result.reason = text3(d.reason, `${path}.reason`, 160);
    return result;
  });
  const transferIds = /* @__PURE__ */ new Set();
  const transfers = list4(root.transfers, "transfers", MAX_TEAM_TRANSFERS).map((v, i) => {
    const path = `transfers[${i}]`, t = object6(v, path, ["id", "sender", "recipient", "resources", "time"]), transferId = number6(t.id, `${path}.id`, 1, nextTransferId - 1, true);
    if (transferIds.has(transferId)) fail2(path, "duplicate transfer ID");
    transferIds.add(transferId);
    const sender = side2(t.sender, `${path}.sender`), recipient = side2(t.recipient, `${path}.recipient`);
    allies2(sender, recipient, path);
    return { id: transferId, sender, recipient, resources: cost5(t.resources, `${path}.resources`), time: when(t.time, `${path}.time`) };
  });
  return { coordinator: { nextWaveId, reservations, waves }, nextDirectiveId, directives, nextTransferId, transfers };
}

// src/core/economy-cargo.ts
var EPSILON = 1e-8;
var active = (entity) => entity.hp > 0 && !entity.illusion && !entity.raised && !entity.tactics?.siegeCrew?.uncrewed;
var cargoFor = (economy, id5) => economy.cargo.find((cargo) => cargo.entityId === id5);
var entityFor = (s, id5) => s.entities.find((entity) => entity.id === id5 && entity.hp > 0);
var validAmount = (amount, max = 1e4) => Number.isFinite(amount) && amount > 0 && amount <= max;
var validCost = (stock) => !!stock && RESOURCE_KINDS.every((kind) => Number.isFinite(stock[kind]) && stock[kind] >= 0) && validAmount(costTotal(stock));
var completeBuilding = (entity) => entity.kind === "building" && entity.progress === 1 && (entity.role === "hq" || entity.role === "depot");
var capacityFor = (economy, entity) => economy.caravans.includes(entity.id) ? ECONOMY_RULES.caravan.capacity : entity.role === "worker" ? 18 : ECONOMY_RULES.raid.capacity;
function marketCurrency(kind) {
  return kind === "wood" ? "ore" : "wood";
}
var priceRatio = (market, kind) => 1 + (ECONOMY_RULES.market.stock - market.stock[kind] + market.demand[kind]) / ECONOMY_RULES.market.stock;
var clampPrice = (value2) => Math.max(0.5, Math.min(3, value2));
var basePrice = (kind) => ECONOMY_RULES.market.basePrices[kind] / (kind === "wood" ? ECONOMY_RULES.market.basePrices.ore : 1);
function integratePrice(start, slope, length2) {
  const boundaries = [0, length2];
  if (slope !== 0) for (const limit of [0.5, 3]) {
    const crossing = (limit - start) / slope;
    if (crossing > 0 && crossing < length2) boundaries.push(crossing);
  }
  boundaries.sort((a, b) => a - b);
  let result = 0;
  for (let index2 = 1; index2 < boundaries.length; index2++) {
    const low = boundaries[index2 - 1], high = boundaries[index2];
    result += (clampPrice(start + slope * low) + clampPrice(start + slope * high)) * 0.5 * (high - low);
  }
  return result;
}
function marketQuote(market, kind, amount, direction) {
  if (!validAmount(amount)) return Number.NaN;
  const initial = priceRatio(market, kind), reserve = ECONOMY_RULES.market.stock;
  if (direction === "buy") return basePrice(kind) * integratePrice(initial, 2 / reserve, amount);
  const pressured = Math.min(amount, market.demand[kind]);
  const total2 = integratePrice(initial, -2 / reserve, pressured) + integratePrice(initial - 2 * pressured / reserve, -1 / reserve, amount - pressured);
  return basePrice(kind) * ECONOMY_RULES.market.sellFactor * total2;
}
function cancelCargoTask(entity, economy) {
  cancelTasks(economy, entity.id);
  const cargo = cargoFor(economy, entity.id);
  if (cargo) {
    delete cargo.destinationId;
    cargo.tradeValue = 0;
    delete cargo.contractId;
    cargo.origin = "delivery";
  }
}
function cancelTasks(economy, entityId) {
  for (const task of economy.tasks) if (task.entityId === entityId && task.kind === "plant") {
    const grove = economy.groves.find((item) => item.id === task.targetId && item.plantedAt < 0);
    if (grove) grove.burned = true;
  }
  economy.tasks = economy.tasks.filter((task) => task.entityId !== entityId);
}
function startTask(s, entity, task, economy, hooks) {
  cancelTasks(economy, entity.id);
  delete entity.orderQueue;
  hooks.assign(s, entity, { type: "hold" });
  economy.tasks.push(task);
}
function finishTask(s, entity, economy, hooks) {
  economy.tasks = economy.tasks.filter((task) => task.entityId !== entity.id);
  hooks.assign(s, entity, { type: "idle" });
}
function permittedStorage(s, side2, id5, hooks) {
  const entity = entityFor(s, id5);
  return entity && completeBuilding(entity) && hooks.allied(s, side2, entity.side) && (entity.side === side2 || hooks.visible(s, side2, entity)) ? entity : void 0;
}
function remainingCapacity(economy, id5) {
  const warehouse = economy.structures.find((item) => item.entityId === id5 && item.kind === "warehouse");
  return warehouse ? Math.max(0, warehouse.capacity - costTotal(warehouse.stock)) : Number.POSITIVE_INFINITY;
}
function nearestStorage(s, entity, economy) {
  return s.entities.filter((storage) => storage.hp > 0 && storage.side === entity.side && sameLevel(entity, storage) && completeBuilding(storage) && remainingCapacity(economy, storage.id) > EPSILON).sort((a, b) => distance(entity, a) - distance(entity, b) || a.id - b.id)[0];
}
function createCargo(entity, economy, origin) {
  let cargo = cargoFor(economy, entity.id);
  if (!cargo) {
    cargo = { entityId: entity.id, stock: zeroCost(), capacity: capacityFor(economy, entity), origin, tradeValue: 0 };
    economy.cargo.push(cargo);
  }
  return cargo;
}
function ownUnit(s, side2, id5) {
  const entity = entityFor(s, id5);
  return entity && entity.side === side2 && entity.kind === "unit" && active(entity) ? entity : void 0;
}
function canLoad(entity, economy) {
  return entity.carried <= EPSILON && costTotal(cargoFor(economy, entity.id)?.stock ?? zeroCost()) <= EPSILON;
}
function routeCommand(s, side2, entity, sourceId, targetId, stock, repeat, origin, economy, hooks, contract) {
  const source2 = permittedStorage(s, side2, sourceId, hooks), target = contract ?? permittedStorage(s, side2, targetId, hooks);
  if (!source2 || source2.side !== side2 || !target || !sameLevel(entity, source2) || !sameLevel(source2, target) || sourceId === targetId || !validCost(stock) || costTotal(stock) > capacityFor(economy, entity) + EPSILON || !canLoad(entity, economy)) return false;
  if (origin === "trade" && distance(source2, target) < 8) return false;
  const sourceStock = economyStock(s, economy, sourceId);
  if (!sourceStock || !hasCost(sourceStock, stock)) return false;
  const cargo = createCargo(entity, economy, origin);
  cargo.origin = origin;
  cargo.sourceId = sourceId;
  cargo.destinationId = targetId;
  cargo.tradeValue = 0;
  if (contract) cargo.contractId = contract.id;
  else delete cargo.contractId;
  startTask(s, entity, { entityId: entity.id, kind: "route", targetId, sourceId, progress: 0, repeat, phase: "loading", amount: { ...stock }, ...contract ? { contractId: contract.id } : {} }, economy, hooks);
  return true;
}
function availableContractReward(economy, contract) {
  const village = economy.villages.find((item) => item.id === contract.villageId);
  if (!village) return false;
  const promised = { ...contract.reward };
  for (const current of economy.contracts) if (current.id !== contract.id && current.villageId === contract.villageId && current.status === "accepted") addCost(promised, current.reward);
  return hasCost(village.rewardPool, promised);
}
function applyCargoCommand(s, side2, command, economy, hooks) {
  if (!["tradeRoute", "deliverStock", "deliverContract", "marketTrade", "acceptContract", "raidSupply", "collectSalvage"].includes(command.type)) return void 0;
  if (!s.players[side2] || s.eliminated[side2] || s.winner !== null || s.draw) return false;
  if (command.type === "tradeRoute" || command.type === "deliverStock" || command.type === "deliverContract") {
    const entity = ownUnit(s, side2, command.id);
    if (!entity || !economy.caravans.includes(entity.id)) return false;
    if (command.type === "deliverStock") return routeCommand(s, side2, entity, command.source, command.target, command.stock, false, "delivery", economy, hooks);
    if (command.type === "tradeRoute") {
      if (!RESOURCE_KINDS.includes(command.kind) || !validAmount(command.amount, ECONOMY_RULES.caravan.capacity) || typeof command.repeat !== "boolean") return false;
      const stock2 = zeroCost();
      stock2[command.kind] = command.amount;
      return routeCommand(s, side2, entity, command.source, command.target, stock2, command.repeat, "trade", economy, hooks);
    }
    const contract = economy.contracts.find((item) => item.id === command.contract && item.side === side2 && item.status === "accepted" && item.deadline > s.time);
    if (!contract) return false;
    const amount = Math.min(capacityFor(economy, entity), contract.amount - contract.delivered);
    if (amount <= EPSILON) return false;
    const stock = zeroCost();
    stock[contract.kind] = amount;
    return routeCommand(s, side2, entity, command.source, contract.id, stock, false, "contract", economy, hooks, contract);
  }
  if (command.type === "marketTrade") {
    if (!RESOURCE_KINDS.includes(command.kind) || !validAmount(command.amount) || !["buy", "sell"].includes(command.direction)) return false;
    const market = economy.markets.find((item) => item.id === command.market), wallet = s.players[side2];
    if (!market || !wallet || !hooks.visible(s, side2, market)) return false;
    const unit5 = s.entities.find((entity) => entity.side === side2 && entity.kind === "unit" && active(entity) && distance(entity, market) <= 3);
    if (!unit5) return false;
    const currency = marketCurrency(command.kind), quote = marketQuote(market, command.kind, command.amount, command.direction);
    if (command.direction === "buy") {
      if (wallet[currency] + EPSILON < quote || market.stock[command.kind] + EPSILON < command.amount) return false;
      wallet[currency] = Math.max(0, wallet[currency] - quote);
      market.stock[currency] += quote;
      market.stock[command.kind] = Math.max(0, market.stock[command.kind] - command.amount);
      wallet[command.kind] += command.amount;
      market.demand[command.kind] += command.amount;
    } else {
      if (wallet[command.kind] + EPSILON < command.amount || market.stock[currency] + EPSILON < quote) return false;
      wallet[command.kind] = Math.max(0, wallet[command.kind] - command.amount);
      market.stock[command.kind] += command.amount;
      market.stock[currency] = Math.max(0, market.stock[currency] - quote);
      wallet[currency] += quote;
      market.demand[command.kind] = Math.max(0, market.demand[command.kind] - command.amount);
    }
    economyMessage(s, unit5, `${command.direction === "buy" ? "Bought" : "Sold"} ${command.amount} ${command.kind} for ${quote.toFixed(1)} ${currency}.`, market.id);
    return true;
  }
  if (command.type === "acceptContract") {
    const contract = economy.contracts.find((item) => item.id === command.id && item.status === "open" && item.deadline > s.time);
    if (!contract || !hooks.visible(s, side2, contract) || !availableContractReward(economy, contract)) return false;
    const unit5 = s.entities.find((entity) => entity.side === side2 && entity.kind === "unit" && active(entity) && distance(entity, contract) <= 3);
    if (!unit5) return false;
    contract.side = side2;
    contract.status = "accepted";
    economyMessage(s, unit5, `Accepted delivery of ${contract.amount} ${contract.kind}.`, contract.id);
    return true;
  }
  if (command.type === "raidSupply" || command.type === "collectSalvage") {
    if (!Array.isArray(command.ids)) return false;
    const collecting = command.type === "collectSalvage";
    const salvage = collecting ? economy.salvage.find((item) => item.id === command.target && item.expiresAt > s.time && costTotal(item.stock) > EPSILON) : void 0;
    const target = collecting ? salvage : entityFor(s, command.target);
    if (!target || !hooks.visible(s, side2, target)) return false;
    if (!collecting) {
      const enemy2 = target;
      if (hooks.allied(s, side2, enemy2.side) || !cargoFor(economy, enemy2.id) && !economy.structures.some((structure) => structure.entityId === enemy2.id && structure.kind === "warehouse")) return false;
    }
    let accepted = false;
    for (const id5 of new Set(command.ids)) {
      const entity = ownUnit(s, side2, id5);
      if (!entity || !Number.isFinite(distance(entity, target)) || !canLoad(entity, economy) || economy.caravans.includes(entity.id) || (collecting ? entity.role !== "worker" : entity.role === "worker")) continue;
      startTask(s, entity, { entityId: id5, kind: collecting ? "collect" : "raid", targetId: command.target, progress: 0 }, economy, hooks);
      accepted = true;
    }
    return accepted;
  }
  return void 0;
}
function returnCargo(s, entity, cargo, economy, hooks) {
  cargo.origin = "delivery";
  cargo.tradeValue = 0;
  delete cargo.contractId;
  const storage = nearestStorage(s, entity, economy);
  if (!storage) {
    delete cargo.destinationId;
    finishTask(s, entity, economy, hooks);
    return;
  }
  cargo.destinationId = storage.id;
  startTask(s, entity, { entityId: entity.id, kind: "route", targetId: storage.id, sourceId: cargo.sourceId ?? storage.id, progress: 0, repeat: false, phase: "delivery", amount: { ...cargo.stock } }, economy, hooks);
}
function depositCargo(s, entity, target, cargo, economy) {
  const stock = economyStock(s, economy, target.id);
  if (!stock) return false;
  const originalTotal = costTotal(cargo.stock), deposited = takeCost(cargo.stock, remainingCapacity(economy, target.id));
  if (costTotal(deposited) <= EPSILON) return false;
  addCost(stock, deposited);
  addCost(economy.ledgers[entity.side].delivered, deposited);
  if (cargo.origin === "trade" && cargo.tradeValue > EPSILON) {
    const market = economy.markets.filter((item) => sameLevel(target, item) && item.stock.crystal > EPSILON).sort((a, b) => distance(target, a) - distance(target, b) || a.id - b.id)[0];
    const earned = cargo.tradeValue * costTotal(deposited) / originalTotal;
    if (market) {
      const reward = Math.min(market.stock.crystal, earned);
      market.stock.crystal -= reward;
      s.players[entity.side].crystal += reward;
      economy.ledgers[entity.side].traded.crystal += reward;
    }
    cargo.tradeValue = Math.max(0, cargo.tradeValue - earned);
  }
  if (costTotal(cargo.stock) <= EPSILON) {
    cargo.stock = zeroCost();
    cargo.tradeValue = 0;
    return true;
  }
  return false;
}
function tickRoute(s, dt, entity, task, economy, hooks) {
  const cargo = cargoFor(economy, entity.id);
  if (!cargo) {
    finishTask(s, entity, economy, hooks);
    return;
  }
  const contract = task.contractId === void 0 ? void 0 : economy.contracts.find((item) => item.id === task.contractId);
  if (task.contractId !== void 0 && (!contract || contract.status !== "accepted" || contract.side !== entity.side || contract.deadline <= s.time)) {
    if (costTotal(cargo.stock) > EPSILON) returnCargo(s, entity, cargo, economy, hooks);
    else finishTask(s, entity, economy, hooks);
    return;
  }
  if (task.phase === "loading") {
    const source2 = permittedStorage(s, entity.side, task.sourceId, hooks), target2 = contract ?? permittedStorage(s, entity.side, task.targetId, hooks);
    if (!source2 || source2.side !== entity.side || !target2 || !Number.isFinite(distance(entity, source2)) || !Number.isFinite(distance(entity, target2))) {
      finishTask(s, entity, economy, hooks);
      return;
    }
    if (!hooks.move(s, entity, source2, dt, hooks.radius(s, source2) + 1)) return;
    const sourceStock = economyStock(s, economy, source2.id);
    if (!sourceStock || !payCost(sourceStock, task.amount)) return;
    cargo.stock = { ...task.amount };
    cargo.sourceId = source2.id;
    cargo.destinationId = task.targetId;
    cargo.tradeValue = cargo.origin === "trade" ? costTotal(cargo.stock) * Math.min(0.5, distance(source2, target2) * 0.015) : 0;
    task.phase = "delivery";
    task.progress = 0;
    return;
  }
  const target = contract ?? permittedStorage(s, entity.side, task.targetId, hooks);
  if (!target || !Number.isFinite(distance(entity, target))) {
    returnCargo(s, entity, cargo, economy, hooks);
    return;
  }
  const reach = contract ? 2 : hooks.radius(s, target) + 1;
  if (!hooks.move(s, entity, target, dt, reach)) return;
  if (contract) {
    const amount = Math.min(cargo.stock[contract.kind], Math.max(0, contract.amount - contract.delivered));
    cargo.stock[contract.kind] -= amount;
    contract.delivered += amount;
    economy.ledgers[entity.side].delivered[contract.kind] += amount;
    if (contract.delivered + EPSILON >= contract.amount) {
      const village = economy.villages.find((item) => item.id === contract.villageId);
      if (village && payCost(village.rewardPool, contract.reward)) {
        addCost(s.players[entity.side], contract.reward);
        addCost(economy.ledgers[entity.side].contractRewards, contract.reward);
        contract.status = "complete";
        economyMessage(s, entity, "Resource contract completed.", contract.id);
      }
    }
    if (costTotal(cargo.stock) > EPSILON) returnCargo(s, entity, cargo, economy, hooks);
    else finishTask(s, entity, economy, hooks);
    return;
  }
  if (costTotal(cargo.stock) > EPSILON && !depositCargo(s, entity, target, cargo, economy)) return;
  if (task.repeat) {
    task.phase = "loading";
    task.progress = 0;
    cargo.destinationId = task.targetId;
  } else finishTask(s, entity, economy, hooks);
}
function tickCollection(s, dt, entity, task, economy, hooks) {
  const collecting = task.kind === "collect";
  const salvage = collecting ? economy.salvage.find((item) => item.id === task.targetId && item.expiresAt > s.time) : void 0;
  const enemy2 = collecting ? void 0 : entityFor(s, task.targetId);
  const target = salvage ?? enemy2;
  const structure = enemy2 ? economy.structures.find((item) => item.entityId === enemy2.id && item.kind === "warehouse") : void 0;
  const hostileCargo = enemy2 ? cargoFor(economy, enemy2.id) : void 0;
  if (!target || !Number.isFinite(distance(entity, target)) || !hooks.visible(s, entity.side, target) || enemy2 && hooks.allied(s, entity.side, enemy2.side) || !collecting && !structure && !hostileCargo) {
    finishTask(s, entity, economy, hooks);
    return;
  }
  const reach = enemy2 ? hooks.radius(s, enemy2) + 0.8 : 1;
  if (distance(entity, target) > reach) {
    task.progress = 0;
    hooks.move(s, entity, target, dt, reach);
    return;
  }
  entity.animation = "attack";
  task.progress += dt / (collecting ? ECONOMY_RULES.salvage.channelSeconds : ECONOMY_RULES.raid.channelSeconds);
  if (task.progress < 1) return;
  const stock = salvage?.stock ?? structure?.stock ?? hostileCargo?.stock;
  if (!stock || costTotal(stock) <= EPSILON) {
    finishTask(s, entity, economy, hooks);
    return;
  }
  const before = costTotal(stock), cargo = createCargo(entity, economy, collecting ? "salvage" : "raid");
  cargo.stock = takeCost(stock, cargo.capacity);
  cargo.origin = collecting ? "salvage" : "raid";
  cargo.sourceId = target.id;
  cargo.tradeValue = 0;
  if (hostileCargo && stock === hostileCargo.stock) hostileCargo.tradeValue *= Math.max(0, 1 - costTotal(cargo.stock) / before);
  addCost(collecting ? economy.ledgers[entity.side].salvaged : economy.ledgers[entity.side].raided, cargo.stock);
  const destination = nearestStorage(s, entity, economy);
  if (destination) {
    cargo.destinationId = destination.id;
    startTask(s, entity, { entityId: entity.id, kind: "route", targetId: destination.id, sourceId: target.id, progress: 0, repeat: false, phase: "delivery", amount: { ...cargo.stock } }, economy, hooks);
  } else finishTask(s, entity, economy, hooks);
}
function tickCargo(s, dt, economy, hooks) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const retainedIds = new Set(s.entities.map((entity) => entity.id));
  economy.deathClaims = economy.deathClaims.filter((id5) => retainedIds.has(id5));
  economy.paidCosts = economy.paidCosts.filter((item) => retainedIds.has(item.entityId));
  economy.salvage = economy.salvage.filter((item) => item.expiresAt > s.time && costTotal(item.stock) > EPSILON);
  for (const contract of economy.contracts) if ((contract.status === "open" || contract.status === "accepted") && contract.deadline <= s.time) contract.status = "expired";
  for (const market of economy.markets) {
    const elapsed = Math.max(0, s.time - market.recoverAt);
    if (elapsed > 0) {
      for (const kind of RESOURCE_KINDS) market.demand[kind] = Math.max(0, market.demand[kind] - elapsed * ECONOMY_RULES.market.stock * ECONOMY_RULES.market.recoveryPerSecond);
      market.recoverAt = s.time;
    }
  }
  for (const task of [...economy.tasks]) {
    if (task.kind === "plant" || !economy.tasks.includes(task)) continue;
    const entity = entityFor(s, task.entityId);
    if (!entity || !active(entity)) {
      economy.tasks = economy.tasks.filter((item) => item !== task);
      continue;
    }
    if (task.kind === "route") tickRoute(s, dt, entity, task, economy, hooks);
    else tickCollection(s, dt, entity, task, economy, hooks);
  }
  for (const cargo of economy.cargo) {
    const entity = entityFor(s, cargo.entityId);
    if (!entity || !active(entity) || economy.tasks.some((task) => task.entityId === entity.id) || costTotal(cargo.stock) <= EPSILON || entity.order.type !== "idle" && entity.order.type !== "hold") continue;
    cargo.origin = "delivery";
    cargo.tradeValue = 0;
    delete cargo.contractId;
    const target = nearestStorage(s, entity, economy);
    if (target && distance(entity, target) <= hooks.radius(s, target) + 1) depositCargo(s, entity, target, cargo, economy);
  }
  economy.salvage = economy.salvage.filter((item) => item.expiresAt > s.time && costTotal(item.stock) > EPSILON);
  for (const task of [...economy.tasks]) if (task.kind === "collect" && !economy.salvage.some((item) => item.id === task.targetId)) {
    const entity = entityFor(s, task.entityId);
    if (entity) finishTask(s, entity, economy, hooks);
    else economy.tasks = economy.tasks.filter((item) => item !== task);
  }
}
function economicDeath(s, entity, economy, _hooks) {
  if (economy.deathClaims.includes(entity.id)) return;
  economy.deathClaims.push(entity.id);
  const cargo = cargoFor(economy, entity.id), structure = economy.structures.find((item) => item.entityId === entity.id), paid = economy.paidCosts.find((item) => item.entityId === entity.id);
  const dropped = zeroCost();
  if (!entity.illusion && !entity.raised) {
    if (cargo) addCost(dropped, cargo.stock);
    if (structure) addCost(dropped, structure.stock);
    if (entity.carried > 0 && Number.isFinite(entity.carried) && RESOURCE_KINDS.includes(entity.carriedKind)) dropped[entity.carriedKind] += Math.min(18, entity.carried);
  }
  if (costTotal(dropped) > EPSILON) economy.salvage.push({ id: s.nextId++, x: entity.x, y: entity.y, level: levelOf(entity), stock: dropped, expiresAt: s.time + ECONOMY_RULES.salvage.expiresSeconds, owner: entity.side, kind: "cargo" });
  if (paid && !entity.illusion && !entity.raised && (entity.kind === "building" || entity.role === "siege")) {
    const eligible3 = zeroCost(), fraction = 0.25 * Math.max(0.1, Math.min(1, entity.progress)), scale = Math.min(1, 350 / Math.max(EPSILON, costTotal(paid.stock) * fraction));
    for (const kind of RESOURCE_KINDS) eligible3[kind] = paid.stock[kind] * fraction * scale;
    if (costTotal(eligible3) > EPSILON) economy.salvage.push({ id: s.nextId++, x: entity.x, y: entity.y, level: levelOf(entity), stock: eligible3, expiresAt: s.time + ECONOMY_RULES.salvage.expiresSeconds, owner: entity.side, kind: "salvage" });
  }
  if (structure) structure.stock = zeroCost();
  economy.structures = economy.structures.filter((item) => item.entityId !== entity.id);
  economy.specializations = economy.specializations.filter((item) => item.entityId !== entity.id);
  entity.carried = 0;
  economy.cargo = economy.cargo.filter((item) => item.entityId !== entity.id);
  cancelTasks(economy, entity.id);
  economy.caravans = economy.caravans.filter((id5) => id5 !== entity.id);
  economy.paidCosts = economy.paidCosts.filter((item) => item.entityId !== entity.id);
  economy.workerWarehouses = economy.workerWarehouses.filter((item) => item.entityId !== entity.id && item.warehouseId !== entity.id);
  for (const recruit of economy.recruits) if (recruit.producerId === entity.id && s.players[recruit.side]) addCost(s.players[recruit.side], ECONOMY_RULES.caravan.cost);
  economy.recruits = economy.recruits.filter((recruit) => recruit.producerId !== entity.id);
}

// src/core/economy.ts
var own = (s, side2, id5) => s.entities.find((e) => e.id === id5 && e.side === side2 && e.hp > 0 && !e.illusion);
var econDef = (e) => e.definitionId;
function markDefinition(e, id5) {
  e.definitionId = id5;
}
function terrainFor(s, p) {
  const world2 = s.world;
  const terrain2 = levelOf(p) === 0 ? s.terrain : world2?.levels[levelOf(p)]?.terrain;
  return TERRAIN[terrain2?.[Math.floor(p.y) * s.width + Math.floor(p.x)] ?? "rock"];
}
var canWalk = (s, p) => walkable(s, p.x, p.y, levelOf(p));
function economyUnitDefinition(s, e) {
  return economicState(s)?.caravans.includes(e.id) || econDef(e) === "economy:caravan" ? ECONOMY_CARAVAN : void 0;
}
function recordEconomyPaid(s, e, stock) {
  if (e.illusion || e.raised) return;
  const economy = ensureEconomy(s), record6 = economy.paidCosts.find((item) => item.entityId === e.id);
  if (record6) record6.stock = { ...stock };
  else economy.paidCosts.push({ entityId: e.id, stock: { ...stock } });
}
function initializeEconomySites(s, sites) {
  const economy = ensureEconomy(s);
  if (economy.markets.length) return;
  const locations = sites?.length ? sites : [{ x: s.width / 2 - 6, y: s.height / 2 }, { x: s.width / 2 + 6, y: s.height / 2 }];
  for (const site of locations.slice(0, 16)) {
    const position2 = { x: site.x, y: site.y, level: levelOf(site) }, point5 = openDestination(s, position2, position2);
    if (!point5) continue;
    const villageId = site.id ?? s.nextId++;
    economy.villages.push({ id: villageId, ...point5, rewardPool: { ...ECONOMY_RULES.contract.villagePool } });
    economy.markets.push({ id: s.nextId++, ...point5, stock: { wood: ECONOMY_RULES.market.stock, ore: ECONOMY_RULES.market.stock, crystal: ECONOMY_RULES.market.stock }, demand: zeroCost(), recoverAt: s.time });
    for (const kind of RESOURCE_KINDS) economy.contracts.push({ id: s.nextId++, villageId, ...point5, side: null, kind, amount: ECONOMY_RULES.contract.amount, delivered: 0, deadline: s.time + ECONOMY_RULES.contract.deadlineSeconds, reward: { ...ECONOMY_RULES.contract.reward }, status: "open" });
  }
}
function freeGrove(s, side2, p, hooks) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0.8 || p.y < 0.8 || p.x > s.width - 0.8 || p.y > s.height - 0.8 || !hooks.visible(s, side2, p)) return false;
  if (!terrainFor(s, p).buildable || !canWalk(s, p)) return false;
  return !ensureEconomy(s).groves.some((g) => !g.burned && distance(g, p) < 1.6) && !s.entities.some((e) => e.hp > 0 && e.kind === "building" && distance(e, p) < hooks.radius(s, e) + 1.1);
}
function chooseWork(s, side2, ids, economy) {
  return s.entities.filter((e) => ids.includes(e.id) && e.side === side2 && e.hp > 0 && e.kind === "unit" && e.role === "worker" && !e.illusion && !economy.caravans.includes(e.id));
}
function buildEconomic(s, side2, c, hooks) {
  const economy = ensureEconomy(s), workers2 = chooseWork(s, side2, c.ids, economy);
  if (!workers2.length || economy.structures.length >= 1024) return false;
  let p, resource;
  const level2 = c.kind === "warehouse" ? c.level ?? levelOf(workers2[0]) : levelOf(s.resources.find((r) => r.id === c.target) ?? workers2[0]);
  if (workers2.some((w) => levelOf(w) !== level2)) return false;
  if (c.kind === "warehouse") p = { x: c.x, y: c.y, level: level2 };
  else {
    resource = s.resources.find((r) => r.id === c.target && r.kind === (c.kind === "extractor" ? "crystal" : "ore") && hooks.visible(s, side2, r));
    if (!resource || c.kind === "deep-mine" && (resource.amount > 1e-8 || resource.maxAmount <= 0 || economy.deepSites.includes(resource.id)) || economy.structures.some((item) => item.kind === c.kind && item.resourceId === resource.id)) return false;
    const candidates = [];
    for (const r of [3.2, 4, 5]) for (let i = 0; i < 16; i++) {
      const [dx, dy] = DIRECTIONS_32[i * 2], candidate2 = { x: Math.floor(resource.x + dx * r) + 0.5, y: Math.floor(resource.y + dy * r) + 0.5, level: level2 };
      if (hooks.canPlace(s, side2, candidate2.x, candidate2.y, level2)) candidates.push(candidate2);
    }
    const candidate = candidates.sort((a, b) => distance(workers2[0], a) - distance(workers2[0], b))[0];
    if (!candidate) return false;
    p = candidate;
  }
  if (!hooks.canPlace(s, side2, p.x, p.y, level2)) return false;
  const def = ECONOMY_BUILDINGS[c.kind], shoves = [];
  for (const unit5 of s.entities.filter((e) => e.hp > 0 && e.kind === "unit" && sameLevel(e, p) && Math.abs(e.x - p.x) < def.size / 2 + 0.35 && Math.abs(e.y - p.y) < def.size / 2 + 0.35)) {
    let destination;
    for (let ring = def.size / 2 + 1; ring <= def.size / 2 + 5 && !destination; ring += 0.5) for (let i = 0; i < 32; i++) {
      const [dx, dy] = DIRECTIONS_32[i], point5 = { x: p.x + dx * ring, y: p.y + dy * ring, level: level2 };
      if ((Math.abs(point5.x - p.x) >= def.size / 2 + 0.3 || Math.abs(point5.y - p.y) >= def.size / 2 + 0.3) && canWalk(s, point5)) {
        destination = point5;
        break;
      }
    }
    if (!destination) return false;
    shoves.push({ entity: unit5, point: destination });
  }
  if (!payCost(s.players[side2], def.cost)) return false;
  const entity = hooks.spawn(s, side2, "building", "depot", p.x, p.y, 0, def.id, level2);
  for (const shove of shoves) {
    shove.entity.x = shove.point.x;
    shove.entity.y = shove.point.y;
    hooks.invalidateNavigation(s, shove.entity);
  }
  markDefinition(entity, def.id);
  entity.maxHp = def.hp;
  entity.hp = def.hp * 0.1;
  economy.structures.push({ entityId: entity.id, kind: c.kind, ...resource ? { resourceId: resource.id } : {}, stock: zeroCost(), capacity: c.kind === "warehouse" ? ECONOMY_RULES.warehouse.capacity : 0, overcharge: false, nextIncident: s.time + ECONOMY_RULES.extractor.incidentSeconds });
  if (c.kind === "deep-mine") economy.deepSites.push(resource.id);
  recordEconomyPaid(s, entity, def.cost);
  for (const worker of workers2) {
    cancelEconomyTask(s, worker.id);
    hooks.assign(s, worker, { type: "build", target: entity.id });
  }
  economyMessage(s, entity, `${def.name} construction started.`);
  return true;
}
function applyEconomyCommand(s, side2, c, hooks) {
  if (!s.players[side2] || s.eliminated[side2] || s.winner !== null || s.draw) return false;
  const economy = ensureEconomy(s);
  if (c.type === "plantGrove") {
    const worker = chooseWork(s, side2, c.ids, economy)[0], point5 = { x: c.x, y: c.y, level: c.level ?? (worker ? levelOf(worker) : 0) }, retainedGroves = economy.groves.filter((g) => !g.burned || economy.tasks.some((task) => task.targetId === g.id));
    if (!worker || levelOf(worker) !== point5.level || retainedGroves.length >= 1600 || economy.groves.filter((g) => g.side === side2 && !g.burned).length >= ECONOMY_RULES.grove.limit || s.resources.length + economy.groves.filter((g) => !g.resourceId && !g.burned).length >= 8192 || !freeGrove(s, side2, point5, hooks) || !payCost(s.players[side2], ECONOMY_RULES.grove.cost)) return false;
    const id5 = s.nextId++;
    economy.groves = retainedGroves;
    economy.groves.push({ id: id5, side: side2, ...point5, plantedAt: -1, maturesAt: -1, burned: false });
    cancelEconomyTask(s, worker.id);
    hooks.assign(s, worker, { type: "idle" });
    economy.tasks.push({ entityId: worker.id, kind: "plant", targetId: id5, progress: 0 });
    economyMessage(s, worker, "Worker assigned to plant a grove.", id5);
    return true;
  }
  if (c.type === "buildEconomy") return buildEconomic(s, side2, c, hooks);
  if (c.type === "setOvercharge") {
    const entity = own(s, side2, c.id), extractor = economy.structures.find((item) => item.entityId === c.id && item.kind === "extractor");
    if (!entity || entity.progress < 1 || !extractor || extractor.overcharge === c.enabled) return false;
    extractor.overcharge = c.enabled;
    economyMessage(s, entity, c.enabled ? "Extractor overcharged: increased harvest and damage risk." : "Extractor returned to normal output.");
    return true;
  }
  if (c.type === "trainCaravan") {
    const producer = own(s, side2, c.id), reserved2 = s.entities.filter((e) => e.side === side2 && e.hp > 0).reduce((n, e) => n + e.queue.length, 0) + economy.recruits.filter((r) => r.side === side2).length;
    if (!producer || producer.kind !== "building" || producer.role !== "hq" || producer.progress < 1 || economy.recruits.filter((r) => r.producerId === c.id).length >= 3 || s.players[side2].population + reserved2 >= s.players[side2].cap || !payCost(s.players[side2], ECONOMY_RULES.caravan.cost)) return false;
    const last = economy.recruits.filter((r) => r.producerId === c.id).at(-1)?.readyAt ?? s.time;
    economy.recruits.push({ producerId: c.id, side: side2, readyAt: Math.max(s.time, last) + ECONOMY_RULES.caravan.trainSeconds });
    economyMessage(s, producer, "Caravan recruitment started.");
    return true;
  }
  if (c.type === "setWarehouse") {
    const workers2 = chooseWork(s, side2, c.ids, economy), target = c.target === null ? void 0 : own(s, side2, c.target), warehouse = economy.structures.find((item) => item.entityId === c.target && item.kind === "warehouse");
    if (!workers2.length || c.target !== null && (!target || target.progress < 1 || !warehouse || workers2.some((worker) => !sameLevel(worker, target)))) return false;
    for (const worker of workers2) {
      economy.workerWarehouses = economy.workerWarehouses.filter((item) => item.entityId !== worker.id);
      if (c.target !== null) economy.workerWarehouses.push({ entityId: worker.id, warehouseId: c.target });
    }
    return true;
  }
  if (c.type === "specializeSettlement") {
    const hq = own(s, side2, c.id);
    if (!hq || hq.role !== "hq" || hq.kind !== "building" || hq.progress < 1 || distance(hq, s.starts[side2]) < 8 || economy.specializations.some((item) => item.entityId === c.id) || !payCost(s.players[side2], ECONOMY_RULES.specialization.cost)) return false;
    economy.specializations.push({ entityId: c.id, kind: c.kind });
    economyMessage(s, hq, `${c.kind} specialization established within ${ECONOMY_RULES.specialization.radius} tiles.`);
    return true;
  }
  return applyCargoCommand(s, side2, c, economy, hooks) ?? false;
}
function cancelEconomyTask(s, id5) {
  const economy = economicState(s);
  if (!economy) return;
  const actor3 = s.entities.find((e) => e.id === id5);
  if (actor3 && economy.tasks.some((task) => task.entityId === id5)) cancelCargoTask(actor3, economy);
  else {
    for (const task of economy.tasks) if (task.entityId === id5 && task.kind === "plant") {
      const grove = economy.groves.find((g) => g.id === task.targetId && g.plantedAt < 0);
      if (grove) grove.burned = true;
    }
    economy.tasks = economy.tasks.filter((task) => task.entityId !== id5);
  }
  economy.workerWarehouses = economy.workerWarehouses.filter((item) => item.entityId !== id5 || !!actor3 && s.entities.some((w) => w.id === item.warehouseId && sameLevel(actor3, w)));
}
function economyEntityBusy(s, e) {
  return !!economicState(s)?.tasks.some((task) => task.entityId === e.id);
}
function tickEconomy(s, dt, hooks) {
  const economy = economicState(s);
  if (!economy) return;
  for (const task of [...economy.tasks]) if (task.kind === "plant") {
    const worker = s.entities.find((e) => e.id === task.entityId && e.hp > 0), grove = economy.groves.find((g) => g.id === task.targetId);
    if (!worker || !grove || grove.burned) {
      economy.tasks = economy.tasks.filter((item) => item !== task);
      continue;
    }
    if (!hooks.move(s, worker, grove, dt, 1.1)) continue;
    worker.animation = "attack";
    task.progress += dt / ECONOMY_RULES.grove.plantSeconds;
    if (task.progress >= 1) {
      grove.plantedAt = s.time;
      grove.maturesAt = s.time + ECONOMY_RULES.grove.growthSeconds;
      economy.tasks = economy.tasks.filter((item) => item !== task);
      hooks.assign(s, worker, { type: "idle" });
      economyMessage(s, worker, "Sapling planted. It becomes harvestable after one minute.", grove.id);
    }
  }
  for (const grove of economy.groves) if (!grove.burned && !grove.resourceId && grove.plantedAt >= 0 && s.time >= grove.maturesAt) {
    if (!terrainFor(s, grove).buildable || s.entities.some((e) => e.hp > 0 && e.kind === "building" && distance(e, grove) < hooks.radius(s, e) + 1)) continue;
    const resource = { id: s.nextId++, x: grove.x, y: grove.y, level: levelOf(grove), kind: "wood", amount: ECONOMY_RULES.grove.wood, maxAmount: ECONOMY_RULES.grove.wood };
    s.resources.push(resource);
    grove.resourceId = resource.id;
    s.events.push({ type: "build", x: grove.x, y: grove.y, level: levelOf(grove), side: grove.side, text: "A cultivated grove is ready to harvest." });
  }
  for (const structure of economy.structures) {
    const entity = s.entities.find((e) => e.id === structure.entityId && e.hp > 0);
    if (!entity) continue;
    if (entity.progress < 1) continue;
    if (structure.kind === "deep-mine" && structure.capacity === 0) {
      const site = s.resources.find((r) => r.id === structure.resourceId);
      if (site) {
        const yieldAmount = Math.min(ECONOMY_RULES.deepMine.yield, Math.max(1, site.maxAmount * 0.5));
        site.amount = yieldAmount;
        site.maxAmount = yieldAmount;
        structure.capacity = yieldAmount;
        economyMessage(s, entity, `Deep mine opened a finite reserve of ${Math.floor(yieldAmount)} ore.`, site.id);
      }
    }
    if (structure.kind === "extractor" && s.time + 1e-9 >= structure.nextIncident) {
      const cycle = Math.floor(structure.nextIncident / ECONOMY_RULES.extractor.incidentSeconds);
      let hash3 = (s.seed ^ Math.imul(entity.id, 2654435761) ^ Math.imul(cycle, 2246822519)) >>> 0;
      hash3 ^= hash3 >>> 16;
      hash3 = Math.imul(hash3, 2246822519) >>> 0;
      const roll = (hash3 >>> 0) / 4294967296;
      structure.nextIncident += ECONOMY_RULES.extractor.incidentSeconds;
      if (structure.overcharge && roll < ECONOMY_RULES.extractor.incidentChance) {
        const amount = Math.min(entity.hp, ECONOMY_RULES.extractor.incidentDamage);
        entity.hp -= amount;
        entity.lastDamagedAt = s.time;
        s.events.push({ type: "attack", x: entity.x, y: entity.y, level: levelOf(entity), side: entity.side, source: entity.id, target: entity.id, amount, text: "Extractor overcharge incident" });
        if (entity.hp <= 0) hooks.die(s, entity, "Extractor destroyed by overcharge.");
        else economyMessage(s, entity, `Overcharge incident caused ${amount} damage. Workers can repair the extractor.`);
      }
    }
  }
  for (const recruit of [...economy.recruits]) {
    const producer = s.entities.find((e) => e.id === recruit.producerId && e.hp > 0 && e.progress === 1);
    if (!producer) {
      for (const kind of RESOURCE_KINDS) s.players[recruit.side][kind] += ECONOMY_RULES.caravan.cost[kind];
      economy.recruits = economy.recruits.filter((item) => item !== recruit);
      continue;
    }
    if (s.time < recruit.readyAt || s.players[recruit.side].population >= s.players[recruit.side].cap) continue;
    const point5 = openDestination(s, { x: producer.x + hooks.radius(s, producer) + 1, y: producer.y, level: levelOf(producer) }, producer);
    if (!point5) continue;
    const caravan = hooks.spawn(s, recruit.side, "unit", "worker", point5.x, point5.y, 1, ECONOMY_CARAVAN.id, levelOf(producer));
    markDefinition(caravan, ECONOMY_CARAVAN.id);
    caravan.hp = caravan.maxHp = ECONOMY_CARAVAN.hp;
    caravan.shield = void 0;
    caravan.maxShield = void 0;
    s.players[recruit.side].population++;
    economy.caravans.push(caravan.id);
    economy.cargo.push({ entityId: caravan.id, stock: zeroCost(), capacity: ECONOMY_RULES.caravan.capacity, origin: "delivery", tradeValue: 0 });
    recordEconomyPaid(s, caravan, ECONOMY_RULES.caravan.cost);
    economy.recruits = economy.recruits.filter((item) => item !== recruit);
    s.events.push({ type: "train", x: caravan.x, y: caravan.y, level: levelOf(caravan), side: caravan.side, source: caravan.id, text: "Trade caravan recruited." });
  }
  tickCargo(s, dt, economy, hooks);
  const aliveIds = new Set(s.entities.filter((e) => e.hp > 0).map((e) => e.id));
  economy.workerWarehouses = economy.workerWarehouses.filter((item) => aliveIds.has(item.entityId) && aliveIds.has(item.warehouseId) && sameLevel(s.entities.find((e) => e.id === item.entityId), s.entities.find((e) => e.id === item.warehouseId)));
  economy.specializations = economy.specializations.filter((item) => aliveIds.has(item.entityId));
}
function onEconomyDeath(s, e, hooks) {
  const economy = ensureEconomy(s);
  economicDeath(s, e, economy, hooks);
}
function burnEconomyAt(s, x, y, radius2, level2 = 0) {
  const economy = economicState(s);
  if (!economy) return;
  for (const grove of economy.groves) if (distance(grove, { x, y, level: level2 }) <= radius2) {
    grove.burned = true;
    if (grove.resourceId) {
      const resource = s.resources.find((r) => r.id === grove.resourceId);
      if (resource) resource.amount = 0;
    }
  }
}
function region(s, side2, p) {
  const economy = economicState(s);
  if (!economy) return;
  const nearest = s.entities.filter((e) => e.side === side2 && e.hp > 0 && e.role === "hq" && e.kind === "building" && e.progress === 1 && distance(e, p) <= ECONOMY_RULES.specialization.radius).sort((a, b) => distance(a, p) - distance(b, p) || a.id - b.id)[0];
  return nearest ? economy.specializations.find((item) => item.entityId === nearest.id)?.kind : void 0;
}
function economyGatherFactor(s, e, node) {
  let factor = region(s, e.side, node) === "mining" && node.kind === "ore" ? ECONOMY_RULES.specialization.mining : 1;
  if (node.kind === "crystal") {
    const economy = economicState(s), extractor = economy?.structures.find((item) => item.kind === "extractor" && item.resourceId === node.id && s.entities.some((b) => b.id === item.entityId && b.side === e.side && b.hp > 0 && b.progress === 1));
    if (extractor) factor *= extractor.overcharge ? ECONOMY_RULES.extractor.overchargeGather : ECONOMY_RULES.extractor.normalGather;
  }
  return factor;
}
function economyProductionFactor(s, e) {
  return region(s, e.side, e) === "military" ? ECONOMY_RULES.specialization.military : 1;
}
function economyResearchFactor(s, e) {
  return region(s, e.side, e) === "research" ? ECONOMY_RULES.specialization.research : 1;
}
function economyGatherDepot(s, e) {
  const record6 = economicState(s)?.workerWarehouses.find((item) => item.entityId === e.id);
  return record6 ? s.entities.find((b) => b.id === record6.warehouseId && b.side === e.side && b.hp > 0 && b.progress === 1 && sameLevel(e, b)) : void 0;
}
function depositEconomyGather(s, e, depot2, raw) {
  const economy = ensureEconomy(s), warehouse = economy.structures.find((item) => item.entityId === depot2.id && item.kind === "warehouse"), factor = s.incomeFactors[e.side];
  const available = warehouse ? Math.max(0, warehouse.capacity - warehouse.stock.wood - warehouse.stock.ore - warehouse.stock.crystal) : Infinity;
  const accepted = factor > 0 ? Math.min(raw, available / factor) : raw, income = accepted * factor;
  if (warehouse) warehouse.stock[e.carriedKind] += income;
  else s.players[e.side][e.carriedKind] += income;
  economy.ledgers[e.side].gathered[e.carriedKind] += income;
  return accepted;
}

// src/core/combat-targets.ts
var isEntityTarget = (target) => "side" in target;
var isBridgeTarget = (target) => "tiles" in target;
var combatTargets = (s) => [...s.entities, ...s.world?.bridges ?? [], ...s.world?.creatures ?? []];

// src/core/specialist-systems.ts
var sameLevel5 = (a, b) => (a.level ?? 0) === (b.level ?? 0);
var dist = (a, b) => sameLevel5(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var allied3 = (s, a, b) => s.teams[a.side] === s.teams[b.side];
var visible2 = (s, side2, p) => s.visible[side2].has((p.level ?? 0) * s.width * s.height + Math.floor(p.y) * s.width + Math.floor(p.x));
var active2 = (e) => e.hp > 0 && e.kind === "unit" && !e.illusion && !e.raised;
function relocate(actor3, point5, hooks) {
  actor3.x = point5.x;
  actor3.y = point5.y;
  actor3.path = [];
  actor3.entrenchedAt = void 0;
  actor3.order = { type: "idle" };
  delete actor3.orderQueue;
  hooks.interrupt?.(actor3);
}
var allAbilities = /* @__PURE__ */ new Set(["iron-command", "queen-step", "thane-ward", "soul-drain", "admiral-wave", "prime-shield", "impact-fury", "forest-leap", "armored-brace", "terror", "wet-surge", "shield-dash", "incendiary-shell", "rooting-shell", "ammunition-cannon", "corpse-shell", "flood-shell", "powered-beam"]);
function buff(s, e, value2, seconds) {
  e.specialistBuffs ??= [];
  if (e.specialistBuffs.length >= 64) e.specialistBuffs.shift();
  e.specialistBuffs.push({ ...value2, until: s.time + seconds });
}
function heroRecruitmentReason(s, side2, definitionId2) {
  const def = s.players[side2] && availableUnits(s, side2).find((def2) => def2.id === definitionId2);
  if (!def?.tags?.includes("hero")) return void 0;
  return commanderAdmissionReason(s, side2);
}
function commanderDied(s, e) {
  if (e.kind !== "unit" || e.illusion || e.raised || !unitFor(s, e).tags?.includes("hero")) return;
  const id5 = unitFor(s, e).id;
  if (!availableUnits(s, e.side).some((def) => def.id === id5)) return;
  const p = s.players[e.side];
  p.heroRecovery ??= [];
  p.heroRecovery = p.heroRecovery.filter((r) => r.definitionId !== id5);
  p.heroRecovery.push({ definitionId: id5, availableAt: s.time + 30 });
}
function specialistAbility(s, e, c, hooks) {
  const ability = unitFor(s, e).ability;
  if (!allAbilities.has(ability)) return void 0;
  if (!active2(e) || (e.abilityReadyAt ?? 0) > s.time) return false;
  const target = c.target === void 0 ? void 0 : s.entities.find((target2) => target2.id === c.target && target2.hp > 0), point5 = c.x === void 0 ? target : { x: c.x, y: c.y, level: c.level ?? e.level };
  const validPoint = (range) => !!point5 && Number.isFinite(point5.x) && Number.isFinite(point5.y) && point5.x >= 0.5 && point5.y >= 0.5 && point5.x <= s.width - 0.5 && point5.y <= s.height - 0.5 && dist(e, point5) <= range && visible2(s, e.side, point5);
  const nearby = (point6, radius2) => s.entities.filter((target2) => active2(target2) && dist(target2, point6) <= radius2);
  switch (ability) {
    case "iron-command":
      if (!validPoint(8)) return false;
      for (const ally of nearby(point5, 5)) if (allied3(s, e, ally)) buff(s, ally, { damageFactor: 1.25 }, 8);
      break;
    case "queen-step":
      if (!validPoint(7) || !fieldWalkable(s, point5)) return false;
      relocate(e, point5, hooks);
      for (const ally of nearby(e, 4)) if (allied3(s, e, ally)) ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      break;
    case "thane-ward":
      if (!target || !active2(target) || !allied3(s, e, target) || dist(e, target) > 8 || !visible2(s, e.side, target)) return false;
      target.hp = Math.min(target.maxHp, target.hp + 80);
      buff(s, target, { armor: 4 }, 10);
      break;
    case "soul-drain":
      if (!target || !active2(target) || allied3(s, e, target) || dist(e, target) > 7 || !visible2(s, e.side, target)) return false;
      hooks.damage(e, target, 60);
      e.hp = Math.min(e.maxHp, e.hp + 45);
      break;
    case "admiral-wave":
      if (!validPoint(8)) return false;
      for (const actor3 of nearby(point5, 4)) if (allied3(s, e, actor3)) actor3.hp = Math.min(actor3.maxHp, actor3.hp + 50);
      else hooks.damage(e, actor3, 35);
      break;
    case "prime-shield":
      if (!target || !active2(target) || !allied3(s, e, target) || !target.maxShield || dist(e, target) > 8 || !visible2(s, e.side, target)) return false;
      target.shield = target.maxShield;
      buff(s, target, { armor: 4 }, 10);
      break;
    case "impact-fury":
      buff(s, e, { damageFactor: 1.35 }, 6);
      e.momentum = 1;
      break;
    case "forest-leap":
      if (!validPoint(5) || !fieldWalkable(s, point5)) return false;
      relocate(e, point5, hooks);
      break;
    case "armored-brace":
      buff(s, e, { armor: 5, speedFactor: 0.75 }, 8);
      break;
    case "terror": {
      let count = 0;
      for (const hostile2 of nearby(e, 4)) if (!allied3(s, e, hostile2) && hostile2.role !== "siege") {
        buff(s, hostile2, { fearedFrom: { x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } } }, 3);
        count++;
      }
      if (!count) return false;
      break;
    }
    case "wet-surge":
      if (!["mud", "shallows"].includes(fieldTerrainAt(s, e))) return false;
      buff(s, e, { speedFactor: 1.6, damageFactor: 1.2 }, 8);
      break;
    case "shield-dash":
      if (!validPoint(4) || !fieldWalkable(s, point5) || (e.shield ?? 0) < 15) return false;
      e.shield -= 15;
      relocate(e, point5, hooks);
      break;
    case "incendiary-shell":
      if (s.players[e.side].wood < 8 || e.siegeMode?.prepared) return false;
      s.players[e.side].wood -= 8;
      e.siegeMode ??= { ammo: 0, deployed: false };
      e.siegeMode.prepared = "incendiary";
      break;
    case "rooting-shell":
      if (s.players[e.side].crystal < 6 || e.siegeMode?.prepared) return false;
      s.players[e.side].crystal -= 6;
      e.siegeMode ??= { ammo: 0, deployed: false };
      e.siegeMode.prepared = "rooting";
      break;
    case "ammunition-cannon":
      if (e.animation === "walk") return false;
      if (e.siegeMode && !e.siegeMode.deployed && e.siegeMode.ammo > 0) {
        e.siegeMode.deployed = true;
        e.order = { type: "hold" };
        break;
      }
      if (s.players[e.side].ore < 15 || (e.siegeMode?.ammo ?? 0) > 5) return false;
      s.players[e.side].ore -= 15;
      e.siegeMode ??= { ammo: 0, deployed: false };
      e.siegeMode.ammo += 5;
      e.siegeMode.deployed = true;
      e.order = { type: "hold" };
      break;
    case "corpse-shell": {
      if (e.siegeMode?.prepared) return false;
      const corpse = s.corpses.find((c2) => c2.expires > s.time && dist(e, c2) <= 6 && visible2(s, e.side, c2));
      if (!corpse) return false;
      s.corpses = s.corpses.filter((c2) => c2.id !== corpse.id);
      e.siegeMode ??= { ammo: 0, deployed: false };
      e.siegeMode.prepared = "corpse";
      break;
    }
    case "flood-shell":
      if (s.players[e.side].crystal < 6 || e.siegeMode?.prepared) return false;
      s.players[e.side].crystal -= 6;
      e.siegeMode ??= { ammo: 0, deployed: false };
      e.siegeMode.prepared = "flood";
      break;
    case "powered-beam":
      if (s.players[e.side].crystal < 8 || (e.siegeMode?.ammo ?? 0) > 4) return false;
      s.players[e.side].crystal -= 8;
      e.siegeMode ??= { ammo: 0, deployed: false };
      e.siegeMode.ammo += 4;
      break;
  }
  e.abilityReadyAt = s.time + ABILITIES[ability].cooldown;
  s.events.push({ type: "ability", side: e.side, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, source: e.id, text: ABILITIES[ability].name, target: target?.id });
  return true;
}
function prepareSiegeShot(s, e) {
  if (e.kind !== "unit" || e.role !== "siege") return void 0;
  const ability = unitFor(s, e).ability, mode = e.siegeMode;
  if (ability === "ammunition-cannon") {
    if (!mode?.deployed || mode.ammo <= 0) return false;
    mode.ammo--;
    return { kind: "cannon", damageFactor: 1.5, armorPiercing: false, radius: 0 };
  }
  if (ability === "powered-beam") {
    if (!mode || mode.ammo <= 0) return false;
    mode.ammo--;
    return { kind: "beam", damageFactor: 1, armorPiercing: true, radius: 0 };
  }
  const prepared = mode?.prepared;
  if (!prepared) return void 0;
  delete mode.prepared;
  return { kind: prepared, damageFactor: prepared === "corpse" ? 1.4 : 1, armorPiercing: false, radius: prepared === "corpse" ? 2.5 : 2 };
}
function specialistShotReady(s, e) {
  const ability = unitFor(s, e).ability;
  return ability === "ammunition-cannon" ? !!e.siegeMode?.deployed && (e.siegeMode.ammo ?? 0) > 0 : ability === "powered-beam" ? (e.siegeMode?.ammo ?? 0) > 0 : true;
}
function launchSpecialistShot(s, e, target, rawDamage, modification) {
  if (e.illusion) return void 0;
  if (!specialistShotReady(s, e)) return false;
  const player = s.players[e.side];
  if (modification === "incendiary" && (player.wood < 15 || player.ore < 5)) return false;
  const payload = prepareSiegeShot(s, e);
  if (payload === void 0) return void 0;
  if (payload === false) return false;
  if (modification === "incendiary") {
    player.wood -= 15;
    player.ore -= 5;
  }
  const state = specialistState(s);
  state.nextShotId ??= 1;
  state.shots ??= [];
  state.shots.push({ id: state.nextShotId++, source: { id: e.id, side: e.side, definitionId: unitFor(s, e).id, faction: e.definitionFaction ?? s.players[e.side].faction, elevation: elevationAt(s, e), x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } }, target: { x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level } }, rawDamage, buildingMultiplier: unitFor(s, e).buildingDamageMultiplier ?? 1, payload, modification, impactAt: s.time + 0.25 + dist(e, target) / 12 });
  s.events.push({ type: "ability", side: e.side, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, source: e.id, target: target.id, text: "Specialist siege shot launched." });
  return true;
}
function resolveSpecialistShots(s, hooks) {
  const state = s.specialists;
  if (!state?.shots) return;
  const pending = [];
  const friendlyFire = s.rules?.friendlyFire ?? s.friendlyFire ?? true;
  for (const shot of state.shots) {
    if (shot.impactAt > s.time) {
      pending.push(shot);
      continue;
    }
    const radius2 = Math.max(shot.payload.radius, shot.modification === "grapeshot" ? 2.5 : 0);
    for (const actor3 of hooks.impactTargets?.() ?? s.entities) {
      const entity = isEntityTarget(actor3), building5 = isBridgeTarget(actor3) || entity && actor3.kind === "building";
      if (actor3.hp <= 0 || (hooks.targetDistance?.(shot.target, actor3) ?? dist(actor3, shot.target)) > (radius2 || 0.75) + (entity && actor3.kind === "building" ? buildingFor(s, actor3).size / 2 : 0) || !friendlyFire && entity && allied3(s, shot.source, actor3) && !isCrewless(actor3)) continue;
      const falloff = radius2 ? 1 - 0.4 * Math.min(1, (hooks.targetDistance?.(shot.target, actor3) ?? dist(actor3, shot.target)) / radius2) : 1;
      hooks.damage(shot.source, actor3, shot.rawDamage * shot.payload.damageFactor * (building5 ? shot.buildingMultiplier : 1) * (shot.modification === "stone" && building5 ? 1.25 : shot.modification === "grapeshot" && !building5 ? 1.5 : 1) * falloff, { armorPiercing: shot.payload.armorPiercing, ranged: true });
      if (!entity || !active2(actor3)) continue;
      if (shot.payload.kind === "rooting") buff(s, actor3, { rooted: true }, 4);
      else if (shot.payload.kind === "flood") buff(s, actor3, { speedFactor: 0.5 }, 6);
      else if (shot.payload.kind === "incendiary" || shot.modification === "incendiary") {
        actor3.burning ??= [];
        if (actor3.burning.length >= 64) actor3.burning.shift();
        actor3.burning.push({ source: shot.source.id, side: shot.source.side, origin: { x: shot.source.x, y: shot.source.y, ...shot.source.level === void 0 ? {} : { level: shot.source.level } }, until: s.time + 6, nextAt: s.time + 1, damage: 5 });
      }
    }
    if (shot.payload.kind === "incendiary" || shot.modification === "incendiary") hooks.ignite?.(shot.target, shot.source);
    s.events.push({ type: "ability", side: shot.source.side, x: shot.target.x, y: shot.target.y, ...shot.target.level === void 0 ? {} : { level: shot.target.level }, source: shot.source.id, text: `${shot.payload.kind} impact.` });
  }
  state.shots = pending;
}
function fieldWalkable(s, point5) {
  return walkable(s, point5.x, point5.y, point5.level ?? 0);
}
function fieldTerrainAt(s, point5) {
  return terrainAt(s, point5.x, point5.y, point5.level ?? 0);
}
function fieldSetTerrain(s, point5, kind, hooks) {
  if (hooks.setTerrain) return hooks.setTerrain(point5, kind);
  if ((point5.level ?? 0) !== 0) return false;
  const index2 = Math.floor(point5.y) * s.width + Math.floor(point5.x);
  if (index2 < 0 || index2 >= s.terrain.length) return false;
  s.terrain[index2] = kind;
  for (const e of s.entities) e.path = [];
  return true;
}
function engineerBuild(s, side2, c, hooks) {
  const engineers = s.entities.filter((e) => e.side === side2 && c.ids.includes(e.id) && active2(e) && unitFor(s, e).tags?.includes("engineer")), point5 = { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5, ...c.level === void 0 ? {} : { level: c.level } };
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !engineers.some((e) => dist(e, point5) <= 4) || !visible2(s, side2, point5)) return false;
  const player = s.players[side2], cost5 = c.kind === "bridge" ? { wood: 60, ore: 0, crystal: 0 } : { wood: 35, ore: 15, crystal: 0 };
  if (player.wood < cost5.wood || player.ore < cost5.ore) return false;
  const state = specialistState(s);
  let barricade;
  if (c.kind === "bridge") {
    const tiles = [-1, 0, 1].map((dx) => ({ ...point5, x: point5.x + dx })), world2 = s.world;
    if (world2?.bridges?.some((bridge) => bridge.level === (point5.level ?? 0) && bridge.tiles.some((tile) => tiles.some((p) => Math.floor(p.y) * s.width + Math.floor(p.x) === tile)))) return false;
    if (tiles.some((tile) => tile.x < 0.5 || tile.x > s.width - 0.5 || tile.y < 0.5 || tile.y > s.height - 0.5) || !tiles.some((tile) => fieldTerrainAt(s, tile) === "water") || tiles.some((tile) => !["water", "shallows", "grass", "road"].includes(fieldTerrainAt(s, tile)) || !visible2(s, side2, tile) || state.structures.some((item) => item.expires > s.time && item.tiles?.some((prior) => dist(prior, tile) < 0.1)))) return false;
    const saved = tiles.map((tile) => ({ ...tile, previous: fieldTerrainAt(s, tile), placed: "bridge" }));
    const installed = [];
    for (const tile of saved) {
      if (!fieldSetTerrain(s, tile, "bridge", hooks)) {
        for (const prior of installed) fieldSetTerrain(s, prior, prior.previous, hooks);
        return false;
      }
      if (hooks.terrainRevision) tile.stamp = hooks.terrainRevision(tile);
      installed.push(tile);
    }
    state.structures.push({ id: state.nextStructureId++, kind: "bridge", owner: side2, expires: s.time + 60, tiles: saved });
  } else {
    if (point5.x < 0.5 || point5.y < 0.5 || point5.x > s.width - 0.5 || point5.y > s.height - 0.5 || !fieldWalkable(s, point5) || s.entities.some((e) => e.hp > 0 && dist(e, point5) < 1)) return false;
    barricade = hooks.spawn(side2, "building", "core:field-barricade", point5.x, point5.y, 1, point5.level);
    state.structures.push({ id: state.nextStructureId++, kind: "barricade", owner: side2, expires: s.time + 60, entityId: barricade.id });
  }
  player.wood -= cost5.wood;
  player.ore -= cost5.ore;
  if (barricade) hooks.recordPaid?.(barricade, cost5);
  s.events.push({ type: "build", side: side2, x: point5.x, y: point5.y, ...point5.level === void 0 ? {} : { level: point5.level }, text: `Temporary ${c.kind}: expires in 60 seconds.` });
  return true;
}
function fieldRepair(s, side2, id5, targetId) {
  const engineer2 = s.entities.find((e) => e.id === id5 && e.side === side2 && active2(e) && unitFor(s, e).tags?.includes("engineer")), target = s.entities.find((e) => e.id === targetId && e.hp > 0 && s.teams[e.side] === s.teams[side2]);
  if (!engineer2 || !target || target.kind !== "building" && target.role !== "siege" || target.hp >= target.maxHp || dist(engineer2, target) > 4 || !visible2(s, side2, target)) return false;
  const p = s.players[side2], amount = Math.min(60, target.maxHp - target.hp), ore = Math.ceil(amount / 10);
  if (p.ore < ore) return false;
  p.ore -= ore;
  target.hp += amount;
  s.events.push({ type: "ability", side: side2, x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level }, source: engineer2.id, target: target.id, text: `Field repair: ${amount} health for ${ore} ore.` });
  return true;
}
function updateBeacons(s, alerts = true) {
  const beacons = s.entities.filter((e) => e.kind === "building" && e.hp > 0 && e.progress === 1 && buildingFor(s, e).tags?.includes("beacon")), connected = /* @__PURE__ */ new Set(), sources = s.entities.filter((e) => e.kind === "building" && e.hp > 0 && e.progress === 1 && (e.role === "hq" || e.role === "depot") && !buildingFor(s, e).tags?.includes("beacon"));
  for (let changed = true; changed; ) {
    changed = false;
    for (const beacon2 of beacons) if (!connected.has(beacon2.id) && [...sources, ...beacons.filter((b) => connected.has(b.id))].some((source2) => s.teams[source2.side] === s.teams[beacon2.side] && dist(source2, beacon2) <= 12)) {
      connected.add(beacon2.id);
      changed = true;
    }
  }
  for (const beacon2 of beacons) {
    beacon2.beacon ??= { connected: false, nextAlertAt: 0 };
    beacon2.beacon.connected = connected.has(beacon2.id);
    if (!alerts || !beacon2.beacon.connected || s.time < beacon2.beacon.nextAlertAt) continue;
    const intruder = s.entities.find((e) => e.hp > 0 && s.teams[e.side] !== s.teams[beacon2.side] && dist(e, beacon2) <= buildingFor(s, beacon2).sight && visible2(s, beacon2.side, e));
    if (intruder) {
      s.events.push({ type: "message", side: beacon2.side, x: intruder.x, y: intruder.y, ...intruder.level === void 0 ? {} : { level: intruder.level }, source: beacon2.id, target: intruder.id, text: "Beacon invasion alert." });
      beacon2.beacon.nextAlertAt = s.time + 8;
    }
  }
}
function stepSpecialists(s, hooks) {
  for (const e of s.entities) {
    if (e.specialistBuffs) e.specialistBuffs = e.specialistBuffs.filter((buff2) => buff2.until > s.time);
    for (const fire of e.burning ?? []) {
      if (fire.until > s.time && fire.nextAt <= s.time && e.hp > 0) {
        const liveSource = s.entities.find((e2) => e2.id === fire.source && e2.side === fire.side), source2 = liveSource ?? { id: fire.source, side: fire.side, definitionId: "", faction: s.players[fire.side].faction, x: fire.origin?.x ?? e.x, y: fire.origin?.y ?? e.y, ...(fire.origin?.level ?? e.level) === void 0 ? {} : { level: fire.origin?.level ?? e.level } };
        hooks.damage(source2, e, fire.damage, { armorPiercing: true });
        fire.nextAt = s.time + 1;
      }
    }
    if (e.burning) e.burning = e.burning.filter((fire) => fire.until > s.time);
  }
  const state = s.specialists;
  if (!state) return;
  for (const item of [...state.structures]) {
    const entity = item.entityId === void 0 ? void 0 : s.entities.find((e) => e.id === item.entityId);
    if (item.entityId !== void 0 && (!entity || entity.hp <= 0)) {
      state.structures = state.structures.filter((current) => current.id !== item.id);
      continue;
    }
    if (item.expires > s.time) continue;
    if (entity) {
      entity.expires = s.time;
    }
    const restored = [];
    for (const tile of item.tiles ?? []) if (fieldTerrainAt(s, tile) === tile.placed && (tile.stamp === void 0 || !hooks.terrainRevision || hooks.terrainRevision(tile) === tile.stamp) && fieldSetTerrain(s, tile, tile.previous, hooks)) restored.push(tile);
    for (const actor3 of s.entities) if (actor3.hp > 0 && actor3.kind === "unit" && restored.some((tile) => sameLevel5(actor3, tile) && Math.abs(actor3.x - tile.x) < 0.77 && Math.abs(actor3.y - tile.y) < 0.77) && !fieldWalkable(s, actor3)) {
      let shore;
      for (let ring = 0.5; ring <= 8 && !shore; ring += 0.5) for (const [dx, dy] of DIRECTIONS_32) {
        const candidate = { x: actor3.x + dx * ring, y: actor3.y + dy * ring, level: actor3.level };
        if (fieldWalkable(s, candidate)) {
          shore = candidate;
          break;
        }
      }
      if (shore) {
        relocate(actor3, shore, hooks);
        s.events.push({ type: "message", side: actor3.side, x: actor3.x, y: actor3.y, ...actor3.level === void 0 ? {} : { level: actor3.level }, source: actor3.id, text: "Temporary bridge expired; moved to nearby shore." });
      } else hooks.die(actor3, "A unit drowned when the temporary bridge expired.");
    }
    state.structures = state.structures.filter((current) => current.id !== item.id);
  }
}
function runSpecialistAI(s, side2, issue) {
  const actors = s.entities.filter((e) => e.side === side2 && active2(e)), hostiles = s.entities.filter((e) => e.hp > 0 && !allied3(s, { side: side2 }, e) && visible2(s, side2, e));
  for (const actor3 of actors) {
    if (actor3.veteran?.pendingPromotion) {
      const choices = promotionChoices(s, actor3);
      if (choices.length) issue({ type: "promote", id: actor3.id, promotion: choices[0] });
    }
    if (unitFor(s, actor3).tags?.includes("engineer")) {
      const damaged = s.entities.find((e) => e.hp > 0 && allied3(s, actor3, e) && (e.kind === "building" || e.role === "siege") && e.hp < e.maxHp && dist(actor3, e) <= 4 && visible2(s, side2, e));
      if (damaged) issue({ type: "fieldRepair", id: actor3.id, target: damaged.id });
    }
    const enemy2 = hostiles.filter((e) => dist(actor3, e) <= (actor3.role === "siege" ? unitFor(s, actor3).range + 2 : 8)).sort((a, b) => dist(actor3, a) - dist(actor3, b) || a.id - b.id)[0], ability = unitFor(s, actor3).ability;
    if (!enemy2 || !allAbilities.has(ability) || (actor3.abilityReadyAt ?? 0) > s.time) continue;
    const ally = actors.filter((e) => dist(actor3, e) <= 8).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
    if (ability === "soul-drain" || ability === "admiral-wave") issue({ type: "ability", ids: [actor3.id], target: enemy2.id });
    else if (ability === "thane-ward") issue({ type: "ability", ids: [actor3.id], target: ally.id });
    else if (ability === "prime-shield") {
      const machine = actors.find((e) => e.maxShield && dist(actor3, e) <= 8 && (e.shield ?? 0) < e.maxShield);
      if (machine) issue({ type: "ability", ids: [actor3.id], target: machine.id });
    } else if (ability === "iron-command" || ability === "queen-step") issue({ type: "ability", ids: [actor3.id], x: actor3.x, y: actor3.y, ...actor3.level === void 0 ? {} : { level: actor3.level } });
    else if (ability === "forest-leap" || ability === "shield-dash") {
      const length2 = dist(actor3, enemy2), travel = Math.min(length2 - 1, ability === "forest-leap" ? 4 : 3);
      if (travel > 0) issue({ type: "ability", ids: [actor3.id], x: actor3.x + (enemy2.x - actor3.x) / length2 * travel, y: actor3.y + (enemy2.y - actor3.y) / length2 * travel, ...actor3.level === void 0 ? {} : { level: actor3.level } });
    } else issue({ type: "ability", ids: [actor3.id] });
  }
}

// src/core/ally-directives.ts
var kinds2 = ["wood", "ore", "crystal"];
var active3 = (d) => d.status === "accepted" || d.status === "active";
var distance7 = (a, b) => sameLevel2(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
function allies(s, a, b) {
  return a !== b && !!s.players[a] && !!s.players[b] && s.teams[a] === s.teams[b] && !s.eliminated[a] && !s.eliminated[b];
}
function trimDirectives(state) {
  while (state.directives.length > MAX_TEAM_DIRECTIVES) {
    const index2 = state.directives.findIndex((d) => !active3(d));
    if (index2 < 0) break;
    state.directives.splice(index2, 1);
  }
}
function applyAlliedPlayerCommand(s, side2, c, state, visible5) {
  if (!validateCommand(c) || !s.players[side2] || s.eliminated[side2]) return false;
  if (c.type === "transferResources") {
    if (!allies(s, side2, c.recipient)) return false;
    const payer = s.players[side2], recipient = s.players[c.recipient];
    if (kinds2.some((k) => payer[k] < c.resources[k] || !Number.isFinite(recipient[k] + c.resources[k]) || recipient[k] + c.resources[k] > 1e12)) return false;
    for (const kind of kinds2) {
      payer[kind] -= c.resources[kind];
      recipient[kind] += c.resources[kind];
    }
    state.transfers.push({ id: state.nextTransferId++, sender: side2, recipient: c.recipient, resources: { ...c.resources }, time: s.time });
    state.transfers = state.transfers.slice(-MAX_TEAM_TRANSFERS);
    return true;
  }
  if (c.type === "cancelAllyDirective") {
    const d = state.directives.find((d2) => d2.id === c.directiveId && d2.issuer === side2 && active3(d2));
    if (!d) return false;
    d.status = "cancelled";
    d.assigned = [];
    d.reason = "Cancelled by requester.";
    return true;
  }
  if (!allies(s, side2, c.ally) || s.controllers[c.ally] !== "ai") return false;
  let destination, observedTarget;
  if (c.directive !== "support") {
    if ("target" in c) {
      const target = s.entities.find((e) => e.id === c.target && e.hp > 0 && s.teams[e.side] !== s.teams[side2] && visible5(side2, e.x, e.y, levelOf2(e)));
      if (!target) return false;
      destination = { x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level } };
      observedTarget = target.id;
    } else destination = { x: c.x, y: c.y, ...c.level === void 0 ? {} : { level: c.level } };
    if (levelOf2(destination) >= (s.world?.levels.length ?? 1) || destination.x < 0 || destination.y < 0 || destination.x >= s.width || destination.y >= s.height) return false;
  }
  const previous = state.directives.find((d) => d.recipient === c.ally && active3(d));
  if (previous && previous.issuer !== side2) return false;
  if (previous) {
    previous.status = "cancelled";
    previous.assigned = [];
    previous.reason = "Replaced by requester.";
  }
  const duration = c.directive === "support" ? 30 : c.directive === "defend" ? 90 : c.directive === "scout" ? 150 : 180;
  state.directives.push({
    id: state.nextDirectiveId++,
    issuer: side2,
    recipient: c.ally,
    kind: c.directive,
    ...destination ? { destination } : {},
    ...observedTarget !== void 0 ? { observedTarget } : {},
    ...c.directive === "support" ? { resources: { ...c.resources } } : {},
    createdAt: s.time,
    expiresAt: s.time + duration,
    status: "accepted",
    assigned: []
  });
  trimDirectives(state);
  return true;
}
function sendMove(s, side2, units, point5, type, execute) {
  if (!units.length) return false;
  const formation = Math.max(1.5, Math.sqrt(units.length));
  if (units.every((e) => e.order.type === type && distance7(e.order, point5) < formation || distance7(e, point5) < 2 && e.order.type === "hold")) return true;
  let accepted = false;
  for (let i = 0; i < units.length; i += 100) if (execute(side2, { type, ids: units.slice(i, i + 100).map((e) => e.id), x: point5.x, y: point5.y, ...point5.level === void 0 ? {} : { level: point5.level } })) accepted = true;
  return accepted;
}
function processAllyDirectives(s, side2, state, available, emergency, visible5, execute) {
  for (const d2 of state.directives.filter(active3)) if (s.time >= d2.expiresAt || !allies(s, d2.issuer, d2.recipient) || s.controllers[d2.recipient] !== "ai") {
    d2.status = "failed";
    d2.assigned = [];
    d2.reason = s.time >= d2.expiresAt ? "Request expired." : "Ally is unavailable.";
  }
  const reserved2 = /* @__PURE__ */ new Set(), d = state.directives.find((d2) => d2.recipient === side2 && active3(d2));
  if (!d) return reserved2;
  if (d.kind === "support") {
    d.status = "active";
    if (emergency) {
      d.reason = "Defending the stronghold before sending supplies.";
      return reserved2;
    }
    const resources3 = d.resources, p = s.players[side2], worker = factionFor(s, side2).units.worker.cost;
    if (p.wood < resources3.wood + worker.wood || p.ore < resources3.ore + worker.ore || p.crystal < resources3.crystal + worker.crystal) {
      d.reason = "Waiting for spare resources.";
      return reserved2;
    }
    if (execute(side2, { type: "transferResources", recipient: d.issuer, resources: { ...resources3 } })) {
      d.status = "completed";
      d.reason = "Resources transferred.";
    }
    return reserved2;
  }
  available = available.filter((e) => sameLevel2(e, d.destination));
  const availableIds = new Set(available.map((e) => e.id));
  d.assigned = d.assigned.filter((id5) => availableIds.has(id5));
  if (!d.assigned.length) {
    delete d.arrivedAt;
    const sorted = [...available].sort((a, b) => d.kind === "scout" ? Number(b.role === "cavalry") - Number(a.role === "cavalry") || a.id - b.id : a.id - b.id);
    d.assigned = sorted.slice(0, d.kind === "scout" ? 1 : d.kind === "defend" ? 3 : sorted.length).map((e) => e.id);
  }
  d.assigned.forEach((id5) => reserved2.add(id5));
  if (!d.assigned.length) {
    d.reason = "Waiting for available troops.";
    return reserved2;
  }
  if (emergency) {
    delete d.arrivedAt;
    d.reason = "Defending the stronghold before continuing the request.";
    return reserved2;
  }
  const units = available.filter((e) => reserved2.has(e.id)), point5 = d.destination;
  d.status = "active";
  delete d.reason;
  const formationRadius = 0.4 * (Math.ceil(Math.sqrt(Math.min(100, units.length))) - 1) * length2D(1, 1) + 1;
  const arrived = units.every((e) => distance7(e, point5) < Math.max(3, formationRadius)) && visible5(side2, point5.x, point5.y, levelOf2(point5));
  if (d.kind === "scout" && arrived) {
    d.status = "completed";
    d.reason = "Scout reached and observed the destination.";
    d.assigned = [];
    return /* @__PURE__ */ new Set();
  }
  if (d.kind === "scout") {
    sendMove(s, side2, units, point5, "move", execute);
    return reserved2;
  }
  const enemies = s.entities.filter((e) => e.hp > 0 && s.teams[e.side] !== s.teams[side2] && visible5(side2, e.x, e.y, levelOf2(e)) && distance7(e, point5) < 7);
  if (d.kind === "attack") {
    if (arrived && !enemies.length) {
      d.arrivedAt ??= s.time;
      if (s.time - d.arrivedAt >= 3) {
        d.status = "completed";
        d.reason = "Requested area observed and cleared.";
        d.assigned = [];
        return /* @__PURE__ */ new Set();
      }
    } else delete d.arrivedAt;
    sendMove(s, side2, units, point5, "attackMove", execute);
    return reserved2;
  }
  if (arrived) {
    d.arrivedAt ??= s.time;
    if (s.time - d.arrivedAt >= 20) {
      d.status = "completed";
      d.reason = "Troops guarded the destination.";
      d.assigned = [];
      return /* @__PURE__ */ new Set();
    }
  } else delete d.arrivedAt;
  const threat = enemies[0];
  if (threat) sendMove(s, side2, units, threat, "attackMove", execute);
  else if (arrived) {
    const moving = units.filter((e) => e.order.type !== "hold");
    if (moving.length) execute(side2, { type: "hold", ids: moving.map((e) => e.id) });
  } else sendMove(s, side2, units, point5, "attackMove", execute);
  return reserved2;
}

// src/core/history-hooks.ts
var observers = /* @__PURE__ */ new WeakMap();
function notifyCommand(state, side2, command) {
  for (const observer of [...observers.get(state) ?? []]) {
    try {
      observer.command?.(side2, structuredClone(command));
    } catch (error) {
      console.error("Match command observer failed", error);
    }
  }
}
function notifyStep(state, dt) {
  for (const observer of [...observers.get(state) ?? []]) {
    try {
      observer.step?.(dt);
    } catch (error) {
      console.error("Match step observer failed", error);
    }
  }
}

// src/core/world-actions.ts
var known = (s, side2, point5) => s.visible[side2].has(fogKey(s, point5));
var distance8 = (a, b) => sameLevel2(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
function claimRebuild(s, bridge, side2) {
  if (bridge.repairSide !== null) return s.teams[bridge.repairSide] === s.teams[side2];
  const player = s.players[side2], wood = 60 + bridge.tiles.length * 2, ore = 20;
  if (player.wood < wood || player.ore < ore) return false;
  player.wood -= wood;
  player.ore -= ore;
  bridge.repairSide = side2;
  bridge.rebuilding = 0;
  return true;
}
function issueWorldAction(s, side2, c, assign2) {
  if (!["traverse", "worldAttack", "repairBridge"].includes(c.type)) return void 0;
  const world2 = s.world;
  if (!world2 || !("ids" in c)) return false;
  const units = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && e.kind === "unit" && e.hp > 0 && !e.illusion);
  if (c.type === "traverse") {
    const transition = world2.transitions.find((t) => t.id === c.transition);
    if (!transition) return false;
    let accepted = false;
    for (const e of units) {
      const entrance = [transition.from, transition.to].find((p) => sameLevel2(p, e));
      if (!entrance || !known(s, side2, entrance)) continue;
      assign2(e, { type: "traverse", transition: transition.id });
      accepted = true;
    }
    return accepted;
  }
  if (!("target" in c)) return false;
  const bridge = world2.bridges.find((b) => b.id === c.target);
  if (!bridge) return c.type === "worldAttack" ? void 0 : false;
  if (!known(s, side2, bridge)) return false;
  if (c.type === "worldAttack") {
    if (bridge.hp <= 0) return false;
    let accepted = false;
    for (const e of units) if (sameLevel2(e, bridge)) {
      assign2(e, { type: "worldAttack", target: bridge.id });
      accepted = true;
    }
    return accepted;
  }
  const workers2 = units.filter((e) => e.role === "worker" && sameLevel2(e, bridge));
  if (!workers2.length || bridge.hp === bridge.maxHp) return false;
  if (bridge.repairSide !== null && s.teams[bridge.repairSide] !== s.teams[side2]) return false;
  if (bridge.hp === 0 && !claimRebuild(s, bridge, side2)) return false;
  for (const e of workers2) assign2(e, { type: "repairBridge", target: bridge.id });
  return true;
}
function stepWorldActions(s) {
  for (const bridge of s.world?.bridges ?? []) if (bridge.hp === 0 && bridge.repairSide !== null) {
    const active4 = s.entities.some((e) => e.hp > 0 && e.kind === "unit" && e.role === "worker" && s.teams[e.side] === s.teams[bridge.repairSide] && sameLevel2(e, bridge) && e.order.type === "repairBridge" && e.order.target === bridge.id);
    if (!active4) {
      bridge.repairSide = null;
      bridge.rebuilding = 0;
    }
  }
}
function bridgeEdge(bridge, s, e) {
  const candidates = bridge.tiles.map((tile) => ({ x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: bridge.level }));
  return candidates.sort((a, b) => distance8(e, a) - distance8(e, b))[0];
}
function evacuateBridge(s, bridge, hooks) {
  for (const unit5 of s.entities.filter((e) => e.hp > 0 && e.kind === "unit" && sameLevel2(e, bridge) && bridge.tiles.some((tile) => Math.abs(e.x - (tile % s.width + 0.5)) < 0.77 && Math.abs(e.y - (Math.floor(tile / s.width) + 0.5)) < 0.77) && !walkable(s, e.x, e.y, bridge.level))) {
    let escape;
    for (let ring = 1; ring <= 8 && !escape; ring++) {
      const points = [];
      for (let y = Math.floor(unit5.y) - ring; y <= Math.floor(unit5.y) + ring; y++) for (let x = Math.floor(unit5.x) - ring; x <= Math.floor(unit5.x) + ring; x++) if (walkable(s, x + 0.5, y + 0.5, bridge.level)) points.push({ x: x + 0.5, y: y + 0.5, level: bridge.level });
      escape = points.sort((a, b) => distance8(unit5, a) - distance8(unit5, b))[0];
    }
    if (escape) {
      unit5.x = escape.x;
      unit5.y = escape.y;
      unit5.hp = Math.max(1, unit5.hp - unit5.maxHp * 0.25);
      s.events.push({ type: "message", side: unit5.side, x: unit5.x, y: unit5.y, level: levelOf2(unit5), source: unit5.id, text: "Bridge destroyed: survivors reached the bank with injuries." });
    } else if (hooks.die) {
      hooks.die(unit5, "A unit drowned when the bridge collapsed.");
    } else {
      unit5.hp = 0;
      unit5.animation = "death";
      unit5.animTime = 0;
      s.events.push({ type: "death", side: unit5.side, x: unit5.x, y: unit5.y, level: levelOf2(unit5), source: unit5.id, text: "A unit drowned when the bridge collapsed." });
      if (!unit5.illusion && !unit5.raised) s.corpses.push({ id: unit5.id, x: unit5.x, y: unit5.y, level: levelOf2(unit5), expires: s.time + 45 });
    }
    unit5.order = { type: "idle" };
    delete unit5.orderQueue;
    unit5.path = [];
    hooks.interrupt?.(unit5);
  }
}
function collapseBridge(s, bridge, side2, hooks) {
  for (const tile of bridge.tiles) setWorldTerrain(s, { x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: bridge.level }, "water");
  for (const unit5 of s.entities) if (levelOf2(unit5) === bridge.level) unit5.path = [];
  evacuateBridge(s, bridge, hooks);
  s.events.push({ type: "message", side: side2, x: bridge.x, y: bridge.y, level: bridge.level, target: bridge.id, text: "Bridge destroyed. Rebuild with workers to restore the crossing." });
}
function processWorldAction(s, e, dt, hooks) {
  const world2 = s.world, o = e.order;
  if (!world2) return false;
  if (o.type === "traverse") {
    const transition = world2.transitions.find((t) => t.id === o.transition), entry = transition && [transition.from, transition.to].find((p) => sameLevel2(p, e));
    if (!transition || !entry) {
      hooks.finish(e);
      return true;
    }
    if (!hooks.move(e, entry, dt, 0.6)) return true;
    const exit = entry === transition.from ? transition.to : transition.from, destination = openDestination(s, exit, exit);
    if (!destination) {
      s.events.push({ type: "message", side: e.side, x: e.x, y: e.y, level: levelOf2(e), text: "The entrance is blocked on the other level." });
      return true;
    }
    e.x = destination.x;
    e.y = destination.y;
    e.level = exit.level;
    e.path = [];
    s.events.push({ type: "message", side: e.side, x: e.x, y: e.y, level: levelOf2(e), source: e.id, text: `Entered ${world2.levels[exit.level].title}.` });
    hooks.finish(e);
    return true;
  }
  if (o.type !== "worldAttack" && o.type !== "repairBridge") return false;
  const bridge = world2.bridges.find((b) => b.id === o.target);
  if (!bridge) return false;
  if (!sameLevel2(e, bridge)) {
    hooks.finish(e);
    return true;
  }
  const def = unitFor(s, e), edge = bridgeEdge(bridge, s, e), reach = o.type === "worldAttack" ? hooks.range?.(e, bridge) ?? def.range : 1.4;
  if (!hooks.move(e, edge, dt, reach)) return true;
  e.animation = "attack";
  if (o.type === "worldAttack") {
    if (bridge.hp <= 0) {
      hooks.finish(e);
      return true;
    }
    if (e.cooldown > 0) return true;
    if (hooks.attack) {
      hooks.attack(e, bridge);
      return true;
    }
    const amount = Math.min(bridge.hp, Math.max(1, def.damage * (def.buildingDamageMultiplier ?? 1)));
    bridge.hp -= amount;
    e.cooldown = def.cooldown;
    s.events.push({ type: "attack", side: e.side, x: e.x, y: e.y, level: levelOf2(e), source: e.id, target: bridge.id, amount });
    if (bridge.hp === 0) {
      collapseBridge(s, bridge, e.side, hooks);
      hooks.finish(e);
    }
  } else {
    if (e.role !== "worker" || bridge.hp === bridge.maxHp) {
      hooks.finish(e);
      return true;
    }
    if (bridge.hp === 0) {
      if (!claimRebuild(s, bridge, e.side)) {
        hooks.finish(e);
        return true;
      }
      bridge.rebuilding = Math.min(1, bridge.rebuilding + dt / 12);
      if (bridge.rebuilding === 1) {
        bridge.hp = bridge.maxHp;
        bridge.repairSide = null;
        for (const tile of bridge.tiles) setWorldTerrain(s, { x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: bridge.level }, "bridge");
        s.events.push({ type: "build", side: e.side, x: bridge.x, y: bridge.y, level: bridge.level, target: bridge.id, text: "Bridge rebuilt." });
        hooks.finish(e);
      }
    } else {
      const p = s.players[e.side], amount = Math.min(bridge.maxHp - bridge.hp, dt * 20, p.wood * 10);
      p.wood -= amount * 0.1;
      bridge.hp += amount;
    }
  }
  return true;
}

// src/core/environment.ts
var ENVIRONMENT_RULES = {
  igniteWood: 15,
  igniteOre: 5,
  firebreakWood: 5,
  workerReach: 1.8,
  fireDamage: 12,
  buildingFireDamage: 8,
  woodBurnRate: 18,
  fireLifetime: 45,
  thawWarning: 20,
  evacuationRadius: 6,
  evacuationInjury: 0.25
};
var levelOf3 = (p) => p.level ?? 0;
var tileOf = (s, p) => Math.floor(p.y) * s.width + Math.floor(p.x);
var length = (n, fallback) => Number.isFinite(n) && n > 0 ? n : fallback;
var hash = (seed, a, b = 0, c = 0) => {
  let n = (seed ^ Math.imul(a + 1, 2654435761) ^ Math.imul(b + 1, 2246822507) ^ Math.imul(c + 1, 3266489909)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 2146121005);
  n = Math.imul(n ^ n >>> 15, 2221713035);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
};
function environmentPhase(s) {
  const world2 = s.world;
  if (!world2) return { day: "day", season: "spring", weather: "clear", wind: { x: 0, y: 0 }, dayProgress: 0, seasonProgress: 0, weatherEndsAt: Infinity, thawIn: null };
  const time2 = Math.max(0, s.time), dayLength = length(world2.dayLength, 240), seasonLength = length(world2.seasonLength, 300), weatherLength = length(world2.weatherLength, 70);
  const dayProgress = time2 % dayLength / dayLength;
  const day = dayProgress < 0.55 ? "day" : dayProgress < 0.65 ? "dusk" : dayProgress < 0.9 ? "night" : "dawn";
  const seasonIndex = (Math.floor(time2 / seasonLength) + (world2.biome === "snow" ? 3 : 0)) % 4;
  const season = ["spring", "summer", "autumn", "winter"][seasonIndex], seasonProgress = time2 % seasonLength / seasonLength;
  const weatherIndex = Math.floor(time2 / weatherLength), roll = hash(s.seed, weatherIndex, 21);
  const weather = roll < 0.4 ? "clear" : roll < 0.62 ? "rain" : roll < 0.8 ? "fog" : "wind";
  const [windX, windY] = DIRECTIONS_32[Math.floor(hash(s.seed, weatherIndex, 22) * DIRECTIONS_32.length)], strength = weather === "wind" ? 1 : 0;
  return { day, season, weather, wind: { x: windX * strength, y: windY * strength }, dayProgress, seasonProgress, weatherEndsAt: (weatherIndex + 1) * weatherLength, thawIn: season === "winter" ? (1 - seasonProgress) * seasonLength : null };
}
function environmentalSightFactor(s, entity) {
  if (!s.world || entity && levelOf3(entity) > 0) return 1;
  const { day, weather } = environmentPhase(s);
  let light = day === "night" ? 0.6 : day === "day" ? 1 : 0.8;
  if (entity && entity.kind === "unit" && s.players[entity.side]) {
    const faction = s.players[entity.side].faction;
    if (day === "night" && faction === "undead") light = 1;
    else if (day === "night" && faction === "tideborn" && entity.role === "special") light = 0.9;
  }
  return light * (weather === "fog" ? 0.65 : weather === "rain" ? 0.9 : 1);
}
function environmentalMovementFactor(s, entity) {
  if (!s.world || entity && levelOf3(entity) > 0) return 1;
  const phase = environmentPhase(s);
  if (phase.weather !== "rain") return 1;
  return entity && s.players[entity.side]?.faction === "tideborn" ? 0.95 : 0.85;
}
function projectileEnvironment(s, from, to) {
  if (!s.world || levelOf3(from) > 0 || levelOf3(to) > 0) return { damageFactor: 1, rangeFactor: 1, drift: { x: 0, y: 0 } };
  const { weather, wind } = environmentPhase(s), dx = to.x - from.x, dy = to.y - from.y, d = length2D(dx, dy);
  if (weather === "rain") return { damageFactor: 0.9, rangeFactor: 0.9, drift: { x: 0, y: 0 } };
  if (weather !== "wind" || d === 0) return { damageFactor: 1, rangeFactor: 1, drift: { x: 0, y: 0 } };
  const along = (wind.x * dx + wind.y * dy) / d, cross = Math.abs(wind.x * dy - wind.y * dx) / d;
  return { damageFactor: 1 - 0.12 * cross, rangeFactor: 1 + 0.12 * along, drift: { x: wind.x * Math.min(d, 12) * 0.045, y: wind.y * Math.min(d, 12) * 0.045 } };
}
function terrain(s, p) {
  const layer = s.world?.levels.find((l) => l.id === levelOf3(p));
  return (layer?.terrain ?? (levelOf3(p) === 0 ? s.terrain : []))[tileOf(s, p)] ?? "rock";
}
function setTerrain(s, p, kind) {
  setWorldTerrain(s, p, kind);
}
function woodAt(s, p) {
  return s.resources.filter((n) => n.kind === "wood" && n.amount > 0 && levelOf3(n) === levelOf3(p) && tileOf(s, n) === tileOf(s, p));
}
function flammable(s, p) {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height && (terrain(s, p) === "forest" || woodAt(s, p).length > 0 || s.economy?.groves.some((g) => !g.burned && levelOf3(g) === levelOf3(p) && tileOf(s, g) === tileOf(s, p)) === true);
}
function message(s, side2, p, text3, type = "message", source2) {
  const event = { type, side: side2, x: p.x, y: p.y, level: levelOf3(p), text: text3, source: source2 };
  s.events.push(event);
}
function hurt(s, e, amount, text3, bypassShield = false, hooks) {
  const absorbed = bypassShield ? 0 : Math.min(e.shield ?? 0, amount);
  if (absorbed) e.shield = Math.max(0, (e.shield ?? 0) - absorbed);
  const damage2 = Math.min(e.hp, amount - absorbed);
  e.hp = Math.max(0, e.hp - damage2);
  e.lastDamagedAt = s.time;
  const event = { type: "ability", side: e.side, x: e.x, y: e.y, level: levelOf3(e), source: e.id, target: e.id, amount: damage2 + absorbed, text: text3 };
  s.events.push(event);
  if (e.hp > 0) return;
  if (hooks?.die) {
    hooks.die(e, text3);
    return;
  }
  e.animation = "death";
  e.animTime = 0;
  e.order = { type: "idle" };
  e.path = [];
  delete e.orderQueue;
  hooks?.interrupt(e);
  if (e.kind === "unit" && !e.illusion && !e.raised) {
    const corpse = { id: e.id, x: e.x, y: e.y, level: levelOf3(e), expires: s.time + 45 };
    s.corpses.push(corpse);
  }
  s.events.push({ type: "death", side: e.side, x: e.x, y: e.y, source: e.id, text: text3, level: levelOf3(e) });
}
function ignition(s, p) {
  return { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5, level: levelOf3(p), heat: 1, expires: s.time + ENVIRONMENT_RULES.fireLifetime, nextSpread: s.time + 2.5 };
}
function igniteWorldAt(s, at2, source2) {
  const state = s, world2 = state.world, level2 = levelOf3(at2);
  if (!world2 || !Number.isFinite(at2.x) || !Number.isFinite(at2.y) || !Number.isInteger(level2) || !world2.levels.some((l) => l.id === level2) || at2.x < 0 || at2.y < 0 || at2.x >= s.width || at2.y >= s.height || source2 && !s.players[source2.side]) return false;
  if (source2?.id !== void 0 && (!Number.isSafeInteger(source2.id) || source2.id < 1 || source2.id >= s.nextId)) return false;
  const p = { x: Math.floor(at2.x) + 0.5, y: Math.floor(at2.y) + 0.5, level: level2 };
  if (!flammable(state, p) || world2.fires.some((f) => f.level === level2 && tileOf(s, f) === tileOf(s, p))) return false;
  world2.fires.push(ignition(state, p));
  if (source2) message(s, source2.side, p, "Incendiary shell ignited timber.", "ability", source2.id);
  return true;
}
function issueEnvironmentCommand(s, side2, command) {
  if (command.type !== "ignite" && command.type !== "firebreak") return void 0;
  const c = command, state = s, world2 = state.world;
  if (!world2 || s.winner !== null || s.draw || !s.players[side2] || s.eliminated[side2] || !Array.isArray(c.ids) || !c.ids.every((id5) => Number.isSafeInteger(id5) && id5 > 0)) return false;
  const p = { x: c.x, y: c.y, level: c.level ?? 0 };
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isSafeInteger(p.level) || !world2.levels.some((l) => l.id === p.level) || p.x < 0 || p.y < 0 || p.x >= s.width || p.y >= s.height) return false;
  p.x = Math.floor(p.x) + 0.5;
  p.y = Math.floor(p.y) + 0.5;
  const key = p.level * s.width * s.height + tileOf(s, p);
  if (!s.visible[side2]?.has(key)) return false;
  const fire = world2.fires.find((f) => f.level === p.level && tileOf(s, f) === tileOf(s, p));
  if (c.type === "ignite" && (!flammable(state, p) || fire) || c.type === "firebreak" && !flammable(state, p) && !fire) return false;
  const actors = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && e.hp > 0 && e.kind === "unit" && !e.illusion && levelOf3(e) === p.level && e.cooldown <= 0 && (e.role === "worker" || c.type === "ignite" && e.role === "siege"));
  const actor3 = actors.sort((a, b) => a.id - b.id).find((e) => length2D(e.x - p.x, e.y - p.y) <= (e.role === "siege" ? unitFor(s, e).range : ENVIRONMENT_RULES.workerReach));
  const player = s.players[side2], wood = c.type === "ignite" ? ENVIRONMENT_RULES.igniteWood : ENVIRONMENT_RULES.firebreakWood, ore = c.type === "ignite" ? ENVIRONMENT_RULES.igniteOre : 0;
  if (!actor3 || player.wood < wood || player.ore < ore) return false;
  player.wood -= wood;
  player.ore -= ore;
  actor3.cooldown = actor3.role === "siege" ? 1.5 : 0.8;
  actor3.animation = "attack";
  actor3.animTime = 0;
  if (c.type === "ignite") igniteWorldAt(s, p);
  else {
    for (const node of woodAt(s, p)) node.amount = 0;
    burnEconomyAt(s, p.x, p.y, 0.8, levelOf3(p));
    if (terrain(state, p) === "forest") setTerrain(state, p, "grass");
    world2.fires = world2.fires.filter((f) => f !== fire);
  }
  message(s, side2, p, c.type === "ignite" ? "Forest ignited (15 wood, 5 ore)" : "Firebreak cleared (5 wood); timber is lost", "ability", actor3.id);
  return true;
}
function bankClear(s, p) {
  if (p.x < 0.35 || p.y < 0.35 || p.x > s.width - 0.35 || p.y > s.height - 0.35) return false;
  for (let y = Math.floor(p.y - 0.27); y <= Math.floor(p.y + 0.27); y++) for (let x = Math.floor(p.x - 0.27); x <= Math.floor(p.x + 0.27); x++) if (["water", "rock", "forest", "ice"].includes(terrain(s, { x: x + 0.5, y: y + 0.5, level: p.level }))) return false;
  if (s.resources.some((n) => n.amount > 0 && levelOf3(n) === levelOf3(p) && length2D(n.x - p.x, n.y - p.y) < 0.7)) return false;
  return !s.entities.some((e) => e.hp > 0 && e.kind === "building" && !e.gateOpen && levelOf3(e) === levelOf3(p) && Math.abs(e.x - p.x) < buildingFor(s, e).size / 2 + 0.27 && Math.abs(e.y - p.y) < buildingFor(s, e).size / 2 + 0.27);
}
function evacuate(s, e, hooks) {
  let best, bestDistance = Infinity;
  for (let y = Math.max(0, Math.floor(e.y - ENVIRONMENT_RULES.evacuationRadius)); y < Math.min(s.height, Math.ceil(e.y + ENVIRONMENT_RULES.evacuationRadius)); y++) for (let x = Math.max(0, Math.floor(e.x - ENVIRONMENT_RULES.evacuationRadius)); x < Math.min(s.width, Math.ceil(e.x + ENVIRONMENT_RULES.evacuationRadius)); x++) {
    const p = { x: x + 0.5, y: y + 0.5, level: levelOf3(e) }, d = length2D(p.x - e.x, p.y - e.y);
    if (d <= ENVIRONMENT_RULES.evacuationRadius && d < bestDistance && bankClear(s, p)) {
      best = p;
      bestDistance = d;
    }
  }
  if (!best) for (let y = Math.max(0, Math.floor((e.y - ENVIRONMENT_RULES.evacuationRadius) * 4)); y < Math.min(s.height * 4, Math.ceil((e.y + ENVIRONMENT_RULES.evacuationRadius) * 4)); y++) for (let x = Math.max(0, Math.floor((e.x - ENVIRONMENT_RULES.evacuationRadius) * 4)); x < Math.min(s.width * 4, Math.ceil((e.x + ENVIRONMENT_RULES.evacuationRadius) * 4)); x++) {
    const p = { x: (x + 0.5) / 4, y: (y + 0.5) / 4, level: levelOf3(e) }, d = length2D(p.x - e.x, p.y - e.y);
    if (d <= ENVIRONMENT_RULES.evacuationRadius && d < bestDistance && bankClear(s, p)) {
      best = p;
      bestDistance = d;
    }
  }
  if (!best) {
    hurt(s, e, e.hp, "Lake thawed: trapped troop drowned; no bank within 6 tiles", true, hooks);
    return;
  }
  e.x = best.x;
  e.y = best.y;
  e.path = [];
  e.order = { type: "idle" };
  delete e.orderQueue;
  hooks?.interrupt(e);
  hurt(s, e, Math.max(0, Math.min(e.hp - 1, e.maxHp * ENVIRONMENT_RULES.evacuationInjury)), "Lake thawed: troop evacuated to bank, injured by up to 25% health", true);
}
function touchesIce(s, e, tiles) {
  return tiles.some((t) => t.level === levelOf3(e) && t.tile % s.width >= Math.floor(e.x - 0.27) && t.tile % s.width <= Math.floor(e.x + 0.27) && Math.floor(t.tile / s.width) >= Math.floor(e.y - 0.27) && Math.floor(t.tile / s.width) <= Math.floor(e.y + 0.27));
}
function exposed(s, e, fire) {
  if (levelOf3(e) !== fire.level) return false;
  const radius2 = e.kind === "building" ? buildingFor(s, e).size / 2 : 0;
  return length2D(Math.max(0, Math.abs(e.x - fire.x) - radius2), Math.max(0, Math.abs(e.y - fire.y) - radius2)) < 0.9;
}
function seasons(s, phase, hooks) {
  const world2 = s.world;
  if (phase.season === "winter" && world2.biome !== "desert") {
    const surface = world2.levels.find((l) => l.id === 0);
    const frozen = new Set(world2.iceTiles.filter((ice) => ice.level === 0).map((ice) => ice.tile));
    if (surface) {
      for (let tile = 0; tile < surface.terrain.length; tile++) if (surface.terrain[tile] === "water") {
        const p = { x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: 0 };
        setTerrain(s, p, "ice");
        if (!frozen.has(tile)) {
          world2.iceTiles.push({ level: 0, tile });
          frozen.add(tile);
        }
      }
    }
    const warning = Math.min(ENVIRONMENT_RULES.thawWarning, length(world2.seasonLength, 300) * 0.1);
    if (world2.iceTiles.length && !world2.thawWarned && phase.thawIn !== null && phase.thawIn <= warning + 1e-8) {
      world2.thawWarned = true;
      for (let side2 = 0; side2 < s.players.length; side2++) {
        const troop = s.entities.find((e) => e.hp > 0 && e.kind === "unit" && e.side === side2 && touchesIce(s, e, world2.iceTiles));
        message(s, side2, troop ?? s.starts[side2], `Lake ice thaws in ${Math.ceil(phase.thawIn)} seconds. Leave crossings: nearby banks cause injury; troops trapped over 6 tiles from a bank drown.`);
      }
    }
    return;
  }
  if (world2.iceTiles.length) {
    const melting = world2.iceTiles.filter((t) => terrain(s, { x: t.tile % s.width + 0.5, y: Math.floor(t.tile / s.width) + 0.5, level: t.level }) === "ice");
    for (const ice of melting) setTerrain(s, { x: ice.tile % s.width + 0.5, y: Math.floor(ice.tile / s.width) + 0.5, level: ice.level }, "water");
    for (const e of s.entities) if (e.hp > 0 && e.kind === "unit" && touchesIce(s, e, melting)) evacuate(s, e, hooks);
    world2.iceTiles = [];
  }
  world2.thawWarned = false;
}
function stepEnvironment(s, dt, hooks) {
  const state = s, world2 = state.world;
  if (!world2 || !Number.isFinite(dt) || dt <= 0) return;
  const phase = environmentPhase(s), previous = environmentPhase({ ...s, time: Math.max(0, s.time - dt) }), added = [];
  if (previous.day !== phase.day || previous.weather !== phase.weather || previous.season !== phase.season) for (let side2 = 0; side2 < s.players.length; side2++) message(s, side2, s.starts[side2], `${phase.day}; ${phase.weather}; ${phase.season}`);
  seasons(state, phase, hooks);
  for (const fire of [...world2.fires]) {
    if (fire.expires <= s.time || fire.heat <= 0) continue;
    const wet = phase.weather === "rain" && fire.level === 0;
    fire.heat = Math.max(0, fire.heat - dt * (wet ? 0.22 : 4e-3));
    const nodes = woodAt(s, fire), burn = dt * ENVIRONMENT_RULES.woodBurnRate * fire.heat * (wet ? 0.35 : 1);
    for (const node of nodes) node.amount = Math.max(0, node.amount - burn);
    burnEconomyAt(s, fire.x, fire.y, 0.8, fire.level);
    if (terrain(state, fire) === "forest" && (nodes.length ? nodes.every((n) => n.amount === 0) : fire.expires - s.time < ENVIRONMENT_RULES.fireLifetime - 5)) setTerrain(state, fire, "grass");
    for (const e of s.entities) if (e.hp > 0 && exposed(s, e, fire)) hurt(s, e, dt * (e.kind === "building" ? ENVIRONMENT_RULES.buildingFireDamage : ENVIRONMENT_RULES.fireDamage) * fire.heat, "Forest fire damage", false, hooks);
    if (wet || fire.heat < 0.35 || s.time + 1e-8 < fire.nextSpread) continue;
    const spreadAt = fire.nextSpread;
    fire.nextSpread += phase.weather === "wind" && fire.level === 0 ? 1.5 : 2.5;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = { x: fire.x + dx, y: fire.y + dy, level: fire.level };
      const chance = 0.45 + 0.35 * (phase.weather === "wind" && fire.level === 0 ? phase.wind.x * dx + phase.wind.y * dy : 0);
      if (!flammable(state, p) || world2.fires.some((f) => f.level === p.level && tileOf(s, f) === tileOf(s, p)) || added.some((f) => f.level === p.level && tileOf(s, f) === tileOf(s, p)) || hash(s.seed, tileOf(s, p), Math.round(spreadAt * 20), fire.level) >= chance) continue;
      added.push(ignition(state, p));
    }
  }
  world2.fires = world2.fires.filter((f) => f.expires > s.time && f.heat > 0).concat(added);
  const dayLength = length(world2.dayLength, 240), seasonLength = length(world2.seasonLength, 300), dayStart = Math.floor(s.time / dayLength) * dayLength;
  const dayNext = [0.55, 0.65, 0.9, 1].map((f) => dayStart + f * dayLength).find((t) => t > s.time + 1e-8) ?? dayStart + dayLength;
  world2.nextEnvironmentAt = Math.min(dayNext, phase.weatherEndsAt, (Math.floor(s.time / seasonLength) + 1) * seasonLength);
}

// src/core/neutral-world.ts
var NEUTRAL_RULES = {
  captureSeconds: 10,
  captureRadius: 2.4,
  relicRadius: 8,
  relicDamageBonus: 0.12,
  servicesLoyalty: 60,
  supportLoyalty: 60,
  raidLoyaltyLoss: 30,
  monsterRespawnSeconds: 90,
  defenderRespawnSeconds: 45,
  supplyBundle: { wood: 40, ore: 30, crystal: 10 },
  raidBundle: { wood: 20, ore: 15, crystal: 5 }
};
var resources = ["wood", "ore", "crystal"];
var orderKinds = ["worldAttack", "captureSite", "supportVillage", "recruitVillage"];
var point2 = (p) => ({ x: p.x, y: p.y, level: p.level ?? 0 });
var distance9 = (a, b) => length2D(a.x - b.x, a.y - b.y);
var allied4 = (s, a, b) => !!s.players[a] && !!s.players[b] && s.teams[a] === s.teams[b];
var eligible2 = (e) => e.hp > 0 && e.kind === "unit" && !e.illusion;
var worldOrder = (e) => e.order;
function stop(e) {
  e.order = { type: "idle" };
  e.path = [];
}
function visible3(s, side2, p) {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height && !!s.visible[side2]?.has(fogKey(s, p));
}
function message2(s, side2, at2, text3) {
  s.events.push({ type: "message", side: side2, x: at2.x, y: at2.y, text: text3, ...{ level: at2.level } });
}
function transfer(from, to, amount) {
  for (const kind of resources) {
    from[kind] -= amount[kind];
    to[kind] += amount[kind];
  }
}
function boundedStock(stock, limit) {
  return { wood: Math.min(stock.wood, limit.wood), ore: Math.min(stock.ore, limit.ore), crystal: Math.min(stock.crystal, limit.crystal) };
}
function affordable2(stock, cost5) {
  return resources.every((kind) => stock[kind] >= cost5[kind]);
}
function nonempty(stock) {
  return resources.some((kind) => stock[kind] > 0);
}
function services(site, side2) {
  return site.kind === "village" && site.owner === side2 && site.loyalty[side2] >= NEUTRAL_RULES.servicesLoyalty && site.supplied;
}
function updateVillageOwner(site) {
  const candidates = site.loyalty.flatMap((loyalty, side2) => loyalty >= NEUTRAL_RULES.servicesLoyalty ? [side2] : []);
  candidates.sort((a, b) => site.loyalty[b] - site.loyalty[a] || (a === site.owner ? -1 : b === site.owner ? 1 : a - b));
  site.owner = candidates[0] ?? null;
}
function creatureProfile(site) {
  return site.kind === "monster" ? { hp: 110, damage: 10, range: 1.4, cooldown: 1.3, sight: 6, leash: 8 } : { hp: 140, damage: 12, range: 1.5, cooldown: 1.15, sight: 5, leash: 6 };
}
function addCreature(s, site, index2) {
  const stats = creatureProfile(site), offset = index2 === 0 ? -0.9 : 0.9;
  const creature = {
    id: s.nextId++,
    site: site.id,
    x: site.x + offset,
    y: site.y + 0.8,
    level: site.level,
    hp: stats.hp,
    maxHp: stats.hp,
    cooldown: 0,
    target: null,
    path: [],
    patrol: index2 * 4,
    respawnAt: 0
  };
  s.world.creatures.push(creature);
  site.creatureIds.push(creature.id);
  return creature;
}
function initializeWorldSites(s) {
  if (!s.world) return;
  for (const site of s.world.sites) {
    if (site.kind === "relic" || site.creatureIds.length) continue;
    for (let i = 0; i < (site.kind === "monster" ? 2 : 1); i++) addCreature(s, site, i);
  }
}
function validTarget(s, side2, c) {
  const world2 = s.world;
  if (!world2) return false;
  const site = world2.sites.find((site2) => site2.id === c.target), creature = world2.creatures.find((creature2) => creature2.id === c.target);
  if (c.type === "worldAttack") {
    if (creature) {
      const den = world2.sites.find((site2) => site2.id === creature.site);
      return creature.hp > 0 && !!den && visible3(s, side2, creature) && !(den.owner !== null && allied4(s, side2, den.owner));
    }
    return !!site && site.kind !== "relic" && visible3(s, side2, site) && !(site.owner !== null && allied4(s, side2, site.owner)) && (world2.creatures.some((creature2) => creature2.site === site.id && creature2.hp > 0) || site.kind === "village" && nonempty(site.reward));
  }
  if (!site || !visible3(s, side2, site)) return false;
  if (c.type === "captureSite") return site.kind === "relic" && !(site.owner !== null && allied4(s, side2, site.owner));
  if (c.type === "supportVillage") return site.kind === "village" && (!services(site, side2) ? nonempty(site.request) && affordable2(s.players[side2], site.request) : !site.rewarded.includes(side2) && nonempty(site.reward));
  return c.type === "recruitVillage" && services(site, side2) && s.players[side2].population < s.players[side2].cap && affordable2(site.reward, unitFor(s, side2, "melee").cost);
}
function issueNeutralWorldCommand(s, side2, command) {
  if (!orderKinds.includes(command.type)) return void 0;
  if (!s.world || !s.players[side2] || s.eliminated[side2] || s.winner !== null || s.draw) return false;
  const c = command;
  if (!Number.isSafeInteger(c.target) || c.target < 1 || !Array.isArray(c.ids) || !c.ids.length || c.ids.length > 8192 || new Set(c.ids).size !== c.ids.length) return false;
  const units = c.ids.map((id5) => s.entities.find((e) => e.id === id5));
  if (units.some((e) => !e || e.side !== side2 || !eligible2(e)) || !validTarget(s, side2, c)) return false;
  const at2 = s.world.sites.find((site) => site.id === c.target) ?? s.world.creatures.find((creature) => creature.id === c.target);
  if (units.some((e) => !sameLevel2(e, at2))) return false;
  const assigned = c.type === "supportVillage" || c.type === "recruitVillage" ? [units[0]] : units;
  for (const e of assigned) {
    e.order = { type: c.type, target: c.target };
    delete e.orderQueue;
    e.path = [];
  }
  return true;
}
function attackStats(s, e, hooks) {
  if (hooks.attackStats) return hooks.attackStats(e);
  const def = unitFor(s, e);
  let damage2 = def.damage;
  for (const id5 of s.players[e.side].upgrades) {
    const upgrade = upgradeFor(s, e.side, id5);
    if (upgradeAppliesTo(upgrade, def)) damage2 *= upgrade.effects.damage ?? 1;
  }
  return { damage: damage2, range: def.range, cooldown: def.cooldown };
}
function defeatCreature(s, creature, side2) {
  const site = s.world.sites.find((site2) => site2.id === creature.site);
  if (!site || creature.respawnAt > 0) return;
  creature.hp = 0;
  creature.target = null;
  creature.path = [];
  creature.respawnAt = s.time + (site.kind === "monster" ? NEUTRAL_RULES.monsterRespawnSeconds : NEUTRAL_RULES.defenderRespawnSeconds);
  site.respawnAt = Math.max(site.respawnAt, creature.respawnAt);
  if (site.kind === "village") {
    if (site.owner !== null) {
      site.loyalty[site.owner] = Math.max(0, site.loyalty[site.owner] - NEUTRAL_RULES.raidLoyaltyLoss);
      updateVillageOwner(site);
    }
    return;
  }
  if (site.rewarded.length || s.world.creatures.some((other) => other.site === site.id && other.hp > 0)) return;
  const reward = { ...site.reward };
  transfer(site.reward, s.players[side2], reward);
  site.rewarded.push(side2);
  message2(s, side2, site, `Monster den cleared: ${reward.wood} wood, ${reward.ore} ore, ${reward.crystal} crystal. Its creatures return in ${NEUTRAL_RULES.monsterRespawnSeconds}s; the reward is claimed.`);
}
function processNeutralOrder(s, e, dt, hooks) {
  if (!orderKinds.includes(e.order.type)) return false;
  const order3 = worldOrder(e), world2 = s.world;
  if (!world2 || !eligible2(e) || !s.players[e.side]) {
    stop(e);
    return true;
  }
  const site = world2.sites.find((site2) => site2.id === order3.target);
  if (order3.type === "worldAttack") {
    let target = world2.creatures.find((creature) => creature.id === order3.target && creature.hp > 0);
    if (!target && site) target = world2.creatures.filter((creature) => creature.site === site.id && creature.hp > 0).sort((a, b) => distance9(e, a) - distance9(e, b) || a.id - b.id)[0];
    const targetSite = site ?? world2.sites.find((site2) => site2.id === target?.site);
    if (!targetSite || !sameLevel2(e, targetSite) || targetSite.kind === "relic" || targetSite.owner !== null && allied4(s, e.side, targetSite.owner)) {
      stop(e);
      return true;
    }
    const at2 = target ?? targetSite, stats = attackStats(s, e, hooks);
    if (!visible3(s, e.side, at2)) {
      stop(e);
      return true;
    }
    if (distance9(e, at2) > stats.range) {
      hooks.move(e, point2(at2), dt, stats.range);
      return true;
    }
    if (!(hooks.lineOfSight?.(point2(e), point2(at2)) ?? terrainLineOfSight(s, e, at2))) {
      hooks.move(e, point2(at2), dt, 0.8);
      return true;
    }
    if (e.cooldown > 0) return true;
    if (target && hooks.attack) {
      hooks.attack(e, target);
      return true;
    }
    e.cooldown = stats.cooldown;
    e.animation = "attack";
    e.animTime = 0;
    if (target) {
      hooks.hit(e, target, stats.damage);
      if (target.hp <= 0) defeatCreature(s, target, e.side);
    } else if (targetSite.kind === "village") {
      if (targetSite.owner !== null) targetSite.loyalty[targetSite.owner] = Math.max(0, targetSite.loyalty[targetSite.owner] - NEUTRAL_RULES.raidLoyaltyLoss);
      targetSite.loyalty[e.side] = Math.max(0, targetSite.loyalty[e.side] - NEUTRAL_RULES.raidLoyaltyLoss);
      const stolen = boundedStock(targetSite.reward, NEUTRAL_RULES.raidBundle);
      transfer(targetSite.reward, s.players[e.side], stolen);
      updateVillageOwner(targetSite);
      message2(s, e.side, targetSite, `Village raided: ${stolen.wood} wood, ${stolen.ore} ore, ${stolen.crystal} crystal. Loyalty fell.`);
      if (!nonempty(targetSite.reward)) stop(e);
    } else stop(e);
    return true;
  }
  if (!site || !sameLevel2(e, site)) {
    stop(e);
    return true;
  }
  if (order3.type === "captureSite") {
    if (site.kind !== "relic" || site.owner !== null && allied4(s, e.side, site.owner)) {
      stop(e);
      return true;
    }
    if (!terrainLineOfSight(s, e, site)) hooks.move(e, point2(site), dt, 0.8);
    else if (distance9(e, site) > NEUTRAL_RULES.captureRadius) hooks.move(e, point2(site), dt, NEUTRAL_RULES.captureRadius - 0.2);
    return true;
  }
  if (!validTarget(s, e.side, order3)) {
    stop(e);
    return true;
  }
  if (!terrainLineOfSight(s, e, site)) {
    hooks.move(e, point2(site), dt, 0.8);
    return true;
  }
  if (distance9(e, site) > 2.3) {
    hooks.move(e, point2(site), dt, 2.1);
    return true;
  }
  if (order3.type === "supportVillage") {
    if (services(site, e.side)) {
      const supplied = boundedStock(site.reward, NEUTRAL_RULES.supplyBundle);
      transfer(site.reward, s.players[e.side], supplied);
      site.rewarded.push(e.side);
      message2(s, e.side, site, `Village supplies delivered: ${supplied.wood} wood, ${supplied.ore} ore, ${supplied.crystal} crystal.`);
    } else {
      transfer(s.players[e.side], site.reward, site.request);
      site.loyalty[e.side] = Math.min(100, site.loyalty[e.side] + NEUTRAL_RULES.supportLoyalty);
      site.supplied = true;
      updateVillageOwner(site);
      message2(s, e.side, site, "Village request delivered. Loyalty increased; local supplies and defenders are available at 60 loyalty.");
    }
  } else {
    const cost5 = hooks.recruitCost?.(e.side, "melee") ?? unitFor(s, e.side, "melee").cost;
    if (affordable2(site.reward, cost5) && s.players[e.side].population < s.players[e.side].cap) {
      const recruit = hooks.spawn(e.side, "melee", site.x + 1.7, site.y, site.level);
      if (recruit) {
        for (const kind of resources) site.reward[kind] -= cost5[kind];
        s.players[e.side].population++;
        message2(s, e.side, site, "A local defender joined your army. Its equipment was paid from the village stock.");
      }
    }
  }
  stop(e);
  return true;
}
function creatureCanTarget(s, creature, site, e, hooks) {
  const stats = creatureProfile(site);
  if (e.hp <= 0 || e.illusion || !sameLevel2(creature, e) || distance9(creature, e) > stats.sight || distance9(site, e) > stats.leash) return false;
  if (!(hooks.lineOfSight?.(point2(creature), point2(e)) ?? terrainLineOfSight(s, creature, e))) return false;
  if (site.kind === "monster") return true;
  if (site.owner !== null) return !allied4(s, site.owner, e.side);
  const order3 = worldOrder(e);
  return order3.type === "worldAttack" && (order3.target === site.id || site.creatureIds.includes(order3.target));
}
function stepCaptures(s, dt) {
  for (const site of s.world.sites) {
    if (site.kind !== "relic") continue;
    const nearby = s.entities.filter((e) => eligible2(e) && sameLevel2(e, site) && distance9(e, site) <= NEUTRAL_RULES.captureRadius && terrainLineOfSight(s, e, site));
    const channels = nearby.filter((e) => worldOrder(e).type === "captureSite" && worldOrder(e).target === site.id);
    const teams = new Set(nearby.map((e) => s.teams[e.side]));
    if (!channels.length || teams.size !== 1) {
      site.progress = 0;
      site.capturing = null;
      continue;
    }
    const side2 = channels.reduce((a, e) => e.side < a ? e.side : a, channels[0].side);
    if (site.owner !== null && allied4(s, side2, site.owner)) {
      site.progress = 0;
      site.capturing = null;
      continue;
    }
    if (site.capturing === null || !allied4(s, site.capturing, side2)) {
      site.progress = 0;
      site.capturing = side2;
    }
    site.progress = Math.min(1, site.progress + dt / NEUTRAL_RULES.captureSeconds);
    if (site.progress + 1e-9 >= 1) {
      site.owner = site.capturing;
      site.progress = 0;
      site.capturing = null;
      message2(s, side2, site, `Relic secured. Allied troops within ${NEUTRAL_RULES.relicRadius} tiles gain ${NEUTRAL_RULES.relicDamageBonus * 100}% damage until the site is lost.`);
    }
  }
}
function stepNeutralWorld(s, dt, hooks) {
  if (!s.world || !Number.isFinite(dt) || dt <= 0) return;
  for (const creature of s.world.creatures) {
    const site = s.world.sites.find((site2) => site2.id === creature.site);
    if (!site) continue;
    const stats = creatureProfile(site);
    if (creature.hp <= 0) {
      if (creature.respawnAt === 0) creature.respawnAt = s.time + (site.kind === "monster" ? NEUTRAL_RULES.monsterRespawnSeconds : NEUTRAL_RULES.defenderRespawnSeconds);
      if (creature.respawnAt > 0 && s.time >= creature.respawnAt) {
        creature.hp = creature.maxHp;
        creature.x = site.x;
        creature.y = site.y + 0.8;
        creature.cooldown = 0;
        creature.respawnAt = 0;
        creature.target = null;
        creature.path = [];
      } else continue;
    }
    creature.cooldown = Math.max(0, creature.cooldown - dt);
    const previous = s.entities.find((e) => e.id === creature.target);
    const target = previous && creatureCanTarget(s, creature, site, previous, hooks) ? previous : s.entities.filter((e) => creatureCanTarget(s, creature, site, e, hooks)).sort((a, b) => distance9(creature, a) - distance9(creature, b) || a.id - b.id)[0];
    creature.target = target?.id ?? null;
    if (target) {
      if (distance9(creature, target) <= stats.range) {
        if (creature.cooldown === 0) {
          hooks.hit(creature, target, stats.damage);
          creature.cooldown = stats.cooldown;
        }
      } else hooks.move(creature, point2(target), dt, stats.range);
    } else {
      const [dx, dy] = DIRECTIONS_32[creature.patrol % 8 * 4], to = { x: site.x + dx * 1.6, y: site.y + dy * 1.6, level: site.level };
      if (hooks.move(creature, to, dt, 0.25)) creature.patrol = (creature.patrol + 1) % 8;
    }
  }
  for (const site of s.world.sites) if (site.creatureIds.length && s.world.creatures.every((creature) => creature.site !== site.id || creature.hp > 0)) site.respawnAt = 0;
  stepCaptures(s, dt);
}
function relicBonus(s, side2, at2) {
  return s.world?.sites.reduce((bonus, site) => bonus + (site.kind === "relic" && site.owner !== null && allied4(s, side2, site.owner) && sameLevel2(at2, site) && distance9(at2, site) <= NEUTRAL_RULES.relicRadius ? NEUTRAL_RULES.relicDamageBonus : 0), 0) ?? 0;
}

// src/core/simulation.ts
var distance10 = (a, b) => sameLevel2(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var clamp3 = (n, a, b) => Math.max(a, Math.min(b, n));
var runtimes = /* @__PURE__ */ new WeakMap();
var aiRecoveryScopes = /* @__PURE__ */ new WeakMap();
function runtime(s) {
  let r = runtimes.get(s);
  if (!r) {
    r = { teamAI: emptyTeamAiState(), aiBatchTurns: 0, aiDecisionAt: s.players.map(() => 0), aiDecisionTurns: s.players.map(() => 0), knownEnemyUnits: s.players.map(() => /* @__PURE__ */ new Map()), retreating: s.players.map(() => /* @__PURE__ */ new Map()), producedFighters: s.players.map(() => 0), fog: 0, ai: 0, aiTurns: 0, hits: [], routes: /* @__PURE__ */ new Map(), abilities: /* @__PURE__ */ new Map(), returning: /* @__PURE__ */ new Set(), queuedGather: /* @__PURE__ */ new Set(), aiWave: s.players.map(() => 0), initialScoutDispatched: s.players.map(() => false), expansionScout: s.players.map(() => null), expansionScoutDispatched: s.players.map(() => false), knownEnemyBuildings: s.players.map(() => /* @__PURE__ */ new Map()), enemyStartCleared: s.players.map(() => false), clearedEnemyStarts: s.players.map(() => /* @__PURE__ */ new Set()), searched: s.players.map(() => /* @__PURE__ */ new Set()) };
    runtimes.set(s, r);
  }
  return r;
}
function captureRuntime(s) {
  const r = runtime(s);
  return { ...hasTeamAiMemory(r.teamAI) ? { teamAI: structuredClone(r.teamAI) } : {}, aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => [...memory].map(([id5, o]) => [id5, { ...o }])), retreating: r.retreating.map((memory) => [...memory].map(([id5, o]) => [id5, { ...o }])), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits: r.hits.map((h) => ({ source: h.source.id, target: h.target.id, amount: h.amount, event: s.events.indexOf(h.event) })), routes: [...r.routes].map(([id5, value2]) => [id5, { ...value2 }]), abilities: [...r.abilities], returning: [...r.returning], queuedGather: [...r.queuedGather], aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => [...memory].map(([id5, p]) => [id5, { ...p }])), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => [...players]), searched: r.searched.map((tiles) => [...tiles]) };
}
function restoreRuntime(s, r) {
  const entities = new Map(s.entities.map((e) => [e.id, e]));
  const hits = r.hits.map((h) => {
    const source2 = entities.get(h.source), target = entities.get(h.target), event = s.events[h.event];
    if (!source2 || !target || !event) throw new Error("Save runtime has an invalid hit reference.");
    return { source: source2, target, amount: h.amount, event };
  });
  runtimes.set(s, { teamAI: r.teamAI ? structuredClone(r.teamAI) : emptyTeamAiState(), aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => new Map(memory.map(([id5, o]) => [id5, { ...o }]))), retreating: r.retreating.map((memory) => new Map(memory.map(([id5, o]) => [id5, { ...o }]))), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits, routes: new Map(r.routes.map(([id5, value2]) => [id5, { ...value2 }])), abilities: new Map(r.abilities), returning: new Set(r.returning), queuedGather: new Set(r.queuedGather), aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => new Map(memory.map(([id5, p]) => [id5, { ...p }]))), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => new Set(players)), searched: r.searched.map((tiles) => new Set(tiles)) });
}
var MAX_ORDER_QUEUE = 32;
var alive3 = (e) => e.hp > 0;
function unitDef(s, e) {
  return unitFor(s, e);
}
function buildingDef(s, e) {
  return buildingFor(s, e);
}
function radius(s, e) {
  return e.kind === "building" ? buildingDef(s, e).size / 2 : 0.3;
}
function near(s, a, b, range) {
  return distance10(a, b) <= range + ("kind" in b && b.kind === "building" ? radius(s, b) : 0);
}
function emit(s, type, e, target, text3) {
  const event = { type, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, side: e.side, target, text: text3, source: e.id };
  s.events.push(event);
  return event;
}
function spawnEntity(s, side2, kind, role, x, y, progress = 1, definitionId2, level2 = 0, definitionFaction) {
  const subject = { side: side2, kind, role, definitionId: definitionId2, definitionFaction }, def = kind === "unit" ? unitFor(s, subject) : buildingFor(s, subject);
  const e = { id: s.nextId++, side: side2, kind, role, x, y, ...s.world || level2 ? { level: level2 } : {}, hp: progress === 1 ? def.hp : Math.max(1, def.hp * 0.1), maxHp: def.hp, order: { type: "idle" }, cooldown: 0, progress, queue: [], trainProgress: 0, researchProgress: 0, facing: 2, animation: "idle", animTime: 0, momentum: 0, illusion: false, expires: 0, carried: 0, carriedKind: "wood", path: [] };
  if (s.content || definitionId2) e.definitionId = def.id;
  if (definitionFaction) e.definitionFaction = definitionFaction;
  if (kind === "unit" && def.shield) {
    e.maxShield = def.shield;
    e.shield = e.maxShield;
  }
  if (kind === "unit") initializeTactics(s, e);
  s.entities.push(e);
  return e;
}
function spawnFactionDefinition(s, side2, definitionId2, point5, progress = 1) {
  const definition2 = factionSystemDefinition(definitionId2);
  if (!definition2) throw new Error("Unknown faction definition.");
  return spawnEntity(s, side2, "trainTime" in definition2 ? "unit" : "building", definition2.role, point5.x, point5.y, progress, definitionId2, levelOf2(point5));
}
function factionHooks(s) {
  return {
    assignOrder: (e, order3) => interruptWorldOrder(s, e, order3),
    recordPaid: (e, cost5) => recordEconomyPaid(s, e, cost5),
    canPlace: (side2, p, id5) => {
      const d = factionSystemDefinition(id5);
      return !!d && !("trainTime" in d) && canPlace(s, side2, d.role, p.x, p.y, id5, levelOf2(p)) && s.entities.filter((e) => alive3(e) && e.kind === "unit" && sameLevel2(e, p) && isAllied(s, e.side, side2) && footprintOverlap(e, p.x, p.y, d.size)).every(() => !!shovePoint(s, p.x, p.y, d.size, levelOf2(p)));
    },
    spawnDefinition: (side2, id5, p, progress) => {
      const d = factionSystemDefinition(id5);
      if (progress === 0) for (const e of s.entities.filter((e2) => alive3(e2) && e2.kind === "unit" && sameLevel2(e2, p) && isAllied(s, e2.side, side2) && footprintOverlap(e2, p.x, p.y, d.size))) {
        const point5 = shovePoint(s, p.x, p.y, d.size, levelOf2(p));
        e.x = point5.x;
        e.y = point5.y;
        e.path = [];
        e.entrenchedAt = void 0;
        runtime(s).routes.delete(e.id);
      }
      return spawnFactionDefinition(s, side2, id5, p, progress);
    },
    move: (e, to, dt, reach) => move(s, e, to, dt, reach),
    openDestination: (to, from) => openDestination(s, to, from),
    terrainAt: (p) => terrainAt(s, p.x, p.y, levelOf2(p)),
    setTerrain: (p, kind) => setWorldTerrain(s, p, kind)
  };
}
function playerSides(s) {
  return s.players.map((_, i) => i);
}
function isAllied(s, a, b) {
  return !!s.players[a] && !!s.players[b] && s.teams[a] === s.teams[b];
}
function isHostile(s, a, b) {
  return !!s.players[a] && !!s.players[b] && s.teams[a] !== s.teams[b];
}
function matchObject(value2, allowed, name) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2) || Object.getPrototypeOf(value2) !== Object.prototype || Object.keys(value2).some((k) => !allowed.includes(k))) throw new Error(`Invalid ${name}.`);
  return value2;
}
function matchNumber(value2, min, max, name, integer2 = false) {
  if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < min || value2 > max || integer2 && !Number.isSafeInteger(value2)) throw new Error(`Invalid ${name}.`);
  return value2;
}
function createMatch(config, options = {}) {
  const c = matchObject(config, ["schemaVersion", "map", "players", "rules", "content", "draft"], "match configuration");
  if (c.schemaVersion !== void 0 && c.schemaVersion !== 1) throw new Error("Unsupported match configuration version.");
  const content = c.content === void 0 ? void 0 : decodeContentBundle(c.content), factions2 = contentFactions(content);
  const m = matchObject(c.map, ["seed", "size", "biome", "world"], "match map");
  const seed = matchNumber(m.seed, 0, 4294967295, "map seed", true), size = m.size === void 0 ? "medium" : m.size;
  if (!["small", "medium", "large", "huge"].includes(size)) throw new Error("Invalid map size.");
  if (!Array.isArray(c.players) || c.players.length < 1 || c.players.length > 8) throw new Error("A match requires 1 to 8 players.");
  for (let i = 0; i < c.players.length; i++) if (!Object.hasOwn(c.players, i)) throw new Error("Player slots cannot contain gaps.");
  const rules = normalizeMatchRules(c.rules === void 0 ? {} : c.rules, content);
  if (rules.mode === "scenario" && !options.scenario) throw new Error("Scenario matches require a bound scenario definition.");
  const slots = /* @__PURE__ */ new Set(), teams = [], incomeFactors = [], populationLimits = [];
  const definitions = c.players.map((value2, i) => {
    const p = matchObject(value2, ["id", "teamId", "factionId", "controller", "startingSlot", "handicap", "ai"], "player");
    if (p.id !== i) throw new Error("Player IDs must be ordered contiguous slots starting at zero.");
    teams.push(matchNumber(p.teamId, 0, 7, "team", true));
    if (typeof p.factionId !== "string" || !Object.hasOwn(factions2, p.factionId)) throw new Error("Unknown faction.");
    if (!["human", "ai", "external"].includes(p.controller)) throw new Error("Unknown controller.");
    const slot = matchNumber(p.startingSlot === void 0 ? i : p.startingSlot, 0, c.players instanceof Array ? c.players.length - 1 : 0, "starting slot", true);
    if (slots.has(slot)) throw new Error("Starting slots must be unique.");
    slots.add(slot);
    const h = p.handicap === void 0 ? {} : matchObject(p.handicap, ["startingResources", "incomeFactor", "populationCap"], "handicap");
    const resources3 = h.startingResources === void 0 ? rules.startingResources : matchObject(h.startingResources, ["wood", "ore", "crystal"], "starting resources");
    const wood = matchNumber(resources3.wood, 0, 1e9, "starting wood"), ore = matchNumber(resources3.ore, 0, 1e9, "starting ore"), crystal = matchNumber(resources3.crystal, 0, 1e9, "starting crystal");
    incomeFactors.push(matchNumber(h.incomeFactor === void 0 ? 1 : h.incomeFactor, 0, 10, "income factor"));
    populationLimits.push(matchNumber(h.populationCap === void 0 ? 100 : h.populationCap, 1, 500, "population cap", true));
    return { faction: p.factionId, controller: p.controller, slot, wood, ore, crystal, ai: normalizeAiConfig(p.ai) };
  });
  const age = rules.startingAge;
  if (m.biome !== void 0 && !BIOMES.includes(m.biome)) throw new Error("Unknown biome.");
  const packageMap = m.world ?? (m.biome === void 0 ? void 0 : generateWorldMap(seed, size, definitions.length, m.biome));
  const map = packageMap ? generatedMapFromWorld(packageMap, definitions.length, options) : generateMatchMap(seed, size, definitions.length);
  if (packageMap && packageMap.seed !== seed) throw new Error("Map package seed must match the match configuration.");
  const s = { rules, draft: c.draft === void 0 ? createDraft(config.players, rules, content) : validateDraftState(c.draft, config.players, rules, content), objectives: emptyObjectives(map), controllers: definitions.map((p) => p.controller), aiConfigs: definitions.map((p) => p.ai), teams, incomeFactors, populationLimits, sharedVision: rules.sharedVision !== false, eliminated: definitions.map(() => false), winningTeam: null, mapSize: map.size, mapVersion: map.version, terrain: map.terrain, starts: definitions.map((p) => ({ ...map.starts[p.slot] })), draw: false, tick: 0, corpses: [], time: 0, seed, width: map.width, height: map.height, entities: [], resources: [], players: definitions.map((p) => ({ faction: p.faction, wood: p.wood, ore: p.ore, crystal: p.crystal, population: 0, cap: 12, upgrades: age === 3 ? ["town-age", "citadel-age"] : age === 2 ? ["town-age"] : [] })), winner: null, events: [], explored: definitions.map(() => /* @__PURE__ */ new Set()), visible: definitions.map(() => /* @__PURE__ */ new Set()), nextId: 1 };
  s.friendlyFire = rules.friendlyFire !== false;
  s.projectiles = [];
  initializeFactionSystems(s);
  if (content) s.content = content;
  if (packageMap) initializeWorld(s, packageMap, m.biome ?? "temperate");
  if (!options.scenario) for (const side2 of playerSides(s)) {
    const { x, y } = s.starts[side2], level2 = levelOf2(s.starts[side2]), dir2 = y < s.height / 2 ? 1 : -1;
    spawnEntity(s, side2, "building", "hq", x, y, 1, void 0, level2);
    for (let i = 0; i < 5; i++) spawnEntity(s, side2, "unit", "worker", x + (-2 + i * 0.85) * dir2, y + 3 * dir2, 1, void 0, level2);
    const starter = availableUnits(s, side2).find((unit5) => unit5.role !== "worker" && !rules.disabledDefinitionIds.includes(unit5.id));
    if (starter) spawnEntity(s, side2, "unit", starter.role, x + 3 * dir2, y + dir2, 1, starter.id.includes(":") ? starter.id : void 0, level2);
  }
  for (const resource of map.resources) s.resources.push({ ...resource, id: s.nextId++ });
  initializeWorldSites(s);
  if (!options.scenario) initializeEconomySites(s, s.world?.sites.filter((site) => site.kind === "village"));
  initializeObjectives(s);
  if (s.rules.draft.enabled && s.draft.status === "complete") finalizeDraft(s);
  refreshVisibility(s);
  updatePopulation(s);
  return s;
}
function finalizeDraft(s) {
  for (const side2 of playerSides(s)) {
    const available = availableUnits(s, side2), picked = s.draft.picks[side2].map((id5) => available.find((u) => u.id === id5)).find((u) => u && u.role !== "worker");
    if (!picked) throw new Error("Completed draft requires a combat unit for every player.");
    const starters = s.entities.filter((e) => e.side === side2 && e.kind === "unit" && e.role !== "worker" && e.hp > 0);
    for (const unit5 of starters) {
      s.entities = s.entities.filter((e) => e !== unit5);
      spawnEntity(s, side2, "unit", picked.role, unit5.x, unit5.y, 1, picked.id, levelOf2(unit5));
    }
  }
  if (s.rules.mode === "survival") s.objectives.survival.nextWaveTick = s.tick + s.rules.survival.intervalTicks;
  updatePopulation(s);
}
function isGameOver(s) {
  return s.winner !== null || s.draw;
}
function isVisible(s, side2, x, y, level2 = 0) {
  return x >= 0 && y >= 0 && x < s.width && y < s.height && !!s.visible[side2]?.has(fogKey(s, { x, y, level: level2 }));
}
function refreshVisibility(s) {
  updateBeacons(s, false);
  for (const visible5 of s.visible) visible5.clear();
  for (const e of s.entities) {
    if (!alive3(e) || e.kind === "building" && buildingDef(s, e).tags?.includes("beacon") && !e.beacon?.connected) continue;
    const sight = ((e.kind === "unit" ? unitDef(s, e).sight : buildingDef(s, e).sight) + highGroundSightBonus(s, e)) * environmentalSightFactor(s, e), side2 = e.side;
    for (let y = Math.max(0, Math.floor(e.y - sight)); y <= Math.min(s.height - 1, Math.ceil(e.y + sight)); y++) for (let x = Math.max(0, Math.floor(e.x - sight)); x <= Math.min(s.width - 1, Math.ceil(e.x + sight)); x++) if (length2D(x + 0.5 - e.x, y + 0.5 - e.y) <= sight && terrainLineOfSight(s, e, { x: x + 0.5, y: y + 0.5, level: levelOf2(e) })) {
      const key = fogKey(s, { x, y, level: levelOf2(e) });
      const recipients = e.beacon?.connected ? playerSides(s).filter((other) => isAllied(s, side2, other)) : [side2];
      for (const recipient of recipients) {
        s.visible[recipient].add(key);
        s.explored[recipient].add(key);
      }
    }
  }
  if (s.sharedVision) for (const team of new Set(s.teams)) {
    const members = playerSides(s).filter((side2) => s.teams[side2] === team), visible5 = /* @__PURE__ */ new Set(), explored = /* @__PURE__ */ new Set();
    for (const side2 of members) {
      for (const tile of s.visible[side2]) visible5.add(tile);
      for (const tile of s.explored[side2]) explored.add(tile);
    }
    for (const side2 of members) {
      s.visible[side2].clear();
      for (const tile of visible5) s.visible[side2].add(tile);
      for (const tile of explored) s.explored[side2].add(tile);
    }
  }
}
function updatePopulation(s) {
  for (const side2 of playerSides(s)) {
    const es = s.entities.filter((e) => e.side === side2 && alive3(e) && !isCrewless(e));
    s.players[side2].population = es.filter((e) => e.kind === "unit" && !e.illusion).length;
    s.players[side2].cap = Math.min(s.populationLimits[side2], es.filter((e) => e.kind === "building" && e.progress === 1).reduce((v, e) => v + (e.role === "hq" ? 12 : e.role === "depot" && e.definitionId !== TROPHY_STANDARD.id ? 10 : 0), 0));
  }
}
function reserved(s, side2) {
  return s.entities.filter((e) => e.side === side2 && alive3(e)).reduce((v, e) => v + e.queue.length, 0) + (economicState(s)?.recruits.filter((r) => r.side === side2).length ?? 0);
}
function footprintOverlap(e, x, y, size) {
  return Math.abs(e.x - x) < size / 2 + 0.35 && Math.abs(e.y - y) < size / 2 + 0.35;
}
function shovePoint(s, x, y, size, level2 = 0) {
  for (let ring = size / 2 + 1; ring < size / 2 + 5; ring += 0.5) for (const [dx, dy] of DIRECTIONS_32) {
    const px = x + dx * ring, py = y + dy * ring;
    if ((Math.abs(px - x) >= size / 2 + 0.27 || Math.abs(py - y) >= size / 2 + 0.27) && walkable(s, px, py, level2)) return { x: px, y: py, ...level2 ? { level: level2 } : {} };
  }
}
function rallyWalkable(s, side2, x, y, level2 = 0) {
  const fogged = /* @__PURE__ */ new Set();
  for (const e of s.entities) if (e.kind === "building" && alive3(e) && isHostile(s, e.side, side2) && !isVisible(s, side2, e.x, e.y, levelOf2(e))) fogged.add(e);
  if (!fogged.size) return walkable(s, x, y, level2);
  const kept = s.entities;
  s.entities = kept.filter((e) => !fogged.has(e));
  try {
    return walkable(s, x, y, level2);
  } finally {
    s.entities = kept;
  }
}
function commandDestination(s, side2, to, from) {
  const observed2 = { ...s, entities: s.entities.filter((e) => canObserveTacticalEntity(s, side2, e)), resources: s.resources.filter((r) => isVisible(s, side2, r.x, r.y, levelOf2(r))) };
  return openDestination(observed2, to, from);
}
function movementOrder(s, e, order3, dt, reach) {
  const destination = openDestination(s, order3, e);
  return destination ? move(s, e, destination, dt, reach) : false;
}
function refundCost(s, side2, role, id5, paid) {
  const cost5 = paid ?? unitFor(s, side2, role, id5).cost, p = s.players[side2];
  p.wood += cost5.wood;
  p.ore += cost5.ore;
  p.crystal += cost5.crystal;
}
function refundQueue(s, e) {
  if (!e.queue.length) return;
  for (const [index2, role] of e.queue.entries()) refundCost(s, e.side, role, e.queueDefinitionIds?.[index2], e.queuePaidCosts?.[index2]);
  e.queue = [];
  delete e.queueDefinitionIds;
  delete e.queuePaidCosts;
  e.trainProgress = 0;
}
function canPlace(s, side2, role, x, y, definitionId2, level2 = 0) {
  if (!s.players[side2] || level2 !== 0 && !s.world?.levels[level2]) return false;
  const def = definitionId2 ? definitionId2.startsWith("economy:") ? Object.values(ECONOMY_BUILDINGS).find((d) => d.id === definitionId2 && d.role === role) : availableBuildings(s, side2).find((d) => d.id === definitionId2 && d.role === role) : factionFor(s, side2).buildings[role];
  if (!def || def.role !== role || playerAge(s.players[side2]) < buildingAgeRequired(def) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = def.size / 2;
  if (x - r < 0.5 || y - r < 0.5 || x + r > s.width - 0.5 || y + r > s.height - 0.5) return false;
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) if (!isVisible(s, side2, x + dx, y + dy, level2)) return false;
  for (let ty = Math.floor(y - r); ty < Math.ceil(y + r); ty++) for (let tx = Math.floor(x - r); tx < Math.ceil(x + r); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5, level2)].buildable) return false;
  if (s.entities.some((e) => alive3(e) && levelOf2(e) === level2 && e.kind === "building" && Math.abs(e.x - x) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4) && Math.abs(e.y - y) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4))) return false;
  if (s.entities.some((e) => alive3(e) && levelOf2(e) === level2 && e.kind === "unit" && isHostile(s, e.side, side2) && footprintOverlap(e, x, y, def.size))) return false;
  if (s.resources.some((e) => e.amount > 0 && levelOf2(e) === level2 && Math.abs(e.x - x) < r + 0.8 && Math.abs(e.y - y) < r + 0.8)) return false;
  return true;
}
function invalidateNavigation(s, e) {
  e.path = [];
  e.entrenchedAt = void 0;
  runtime(s).routes.delete(e.id);
}
function assign(s, e, order3) {
  cancelEconomyTask(s, e.id);
  if (e.factionState) {
    delete e.factionState.tunnel;
    delete e.factionState.corpseOrder;
  }
  if (e.siegeMode?.deployed && (order3.type === "move" || order3.type === "attackMove")) e.siegeMode.deployed = false;
  if (order3.type !== "hold") e.entrenchedAt = void 0;
  e.order = order3;
  e.path = [];
  runtime(s).routes.delete(e.id);
  runtime(s).returning.delete(e.id);
  runtime(s).queuedGather.delete(e.id);
}
function interruptWorldOrder(s, e, order3 = { type: "idle" }) {
  if (e.hp <= 0) onEconomyDeath(s, e, economyHooks);
  delete e.orderQueue;
  e.entrenchedAt = void 0;
  if (e.tactics) {
    delete e.tactics.formation;
    delete e.tactics.ambush;
    delete e.tactics.capture;
    delete e.tactics.retreat;
  }
  assign(s, e, order3);
}
function commandOrder(s, e, order3, queued = false) {
  if (queued && e.order.type !== "idle" && e.order.type !== "hold") {
    if ((e.orderQueue?.length ?? 0) >= MAX_ORDER_QUEUE) return false;
    (e.orderQueue ??= []).push(order3);
    return true;
  }
  delete e.orderQueue;
  assign(s, e, order3);
  if (queued && order3.type === "gather") runtime(s).queuedGather.add(e.id);
  return true;
}
function finishOrder(s, e) {
  while (e.orderQueue?.length) {
    const order3 = e.orderQueue.shift();
    if (order3.type === "attack") {
      const target = s.entities.find((t) => t.id === order3.target && alive3(t) && isHostile(s, t.side, e.side));
      if (!target || !sameLevel2(e, target) || !canObserveTacticalEntity(s, e.side, target)) continue;
    }
    if (order3.type === "gather" && !s.resources.some((n) => n.id === order3.target && n.amount > 0 && sameLevel2(e, n))) continue;
    if (order3.type === "build" && !s.entities.some((t) => t.id === order3.target && alive3(t) && isAllied(s, t.side, e.side) && t.kind === "building" && sameLevel2(e, t) && (t.progress < 1 || t.hp < t.maxHp))) continue;
    if (!e.orderQueue.length) delete e.orderQueue;
    assign(s, e, order3);
    if (order3.type === "gather") runtime(s).queuedGather.add(e.id);
    return;
  }
  delete e.orderQueue;
  assign(s, e, { type: "idle" });
}
function issueCommand(s, side2, c) {
  if (!validateCommand(c) || !scenarioCommandPermitted(s, side2, c)) return false;
  const eventStart = s.events.length, rt = runtime(s), accepted = applyCommand(s, side2, c);
  if (accepted && !rt.stepping) {
    if (rt.hits.length) resolveHits(s);
    if (c.type === "ability" || c.type === "engineerBuild") refreshVisibility(s);
  }
  if (accepted && !rt.stepping && !isScenarioScriptedCommand(s)) {
    afterScenarioCommand(s, side2, c, eventStart);
    notifyCommand(s, side2, c);
  }
  return accepted;
}
function applyCommand(s, side2, c) {
  if (!validateCommand(c) || isGameOver(s) || !s.players[side2] || s.eliminated[side2]) return false;
  if (c.type === "draftChoice") {
    const accepted = applyDraftChoice(s.draft, s.rules, draftPlayers(s), side2, c.definitionId, s.content);
    if (accepted && s.draft.status === "complete") finalizeDraft(s);
    return accepted;
  }
  if (s.draft.status !== "complete") return false;
  if (isEconomyCommand(c)) {
    if (c.type === "trainCaravan" && !definitionAllowed(s, side2, "economy:caravan")) return false;
    return applyEconomyCommand(s, side2, c, economyHooks);
  }
  if (c.type === "collectRelic") return collectRelic(s, side2, c.id, c.relicId);
  if (c.type === "dropRelic") return dropRelic(s, side2, c.id);
  if (isFactionCommand(c)) return issueFactionCommand(s, side2, c, factionHooks(s));
  const p = s.players[side2], f = factionFor(s, side2);
  if (isPlayerCommand(c)) return applyAlliedPlayerCommand(s, side2, c, runtime(s).teamAI, (viewer, x, y, level2) => isVisible(s, viewer, x, y, level2));
  if ("ids" in c && ["worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage", "ignite", "firebreak"].includes(c.type)) {
    const ids = c.ids.filter((id5) => !s.entities.some((e) => e.id === id5 && economyUnitDefinition(s, e)));
    if (!ids.length) return false;
    c = { ...c, ids };
  }
  const environmentAction = issueEnvironmentCommand(s, side2, c);
  if (environmentAction !== void 0) return environmentAction;
  const worldAction = issueWorldAction(s, side2, c, (e, o) => {
    commandOrder(s, e, o);
  });
  if (worldAction !== void 0) return worldAction;
  if (c.type === "recruitVillage" && !definitionAllowed(s, side2, unitFor(s, side2, "melee").id)) return false;
  const neutralAction = issueNeutralWorldCommand(s, side2, c);
  if (neutralAction !== void 0) {
    if (neutralAction && "ids" in c) {
      for (const actor3 of s.entities) if (c.ids.includes(actor3.id) && actor3.side === side2 && ["worldAttack", "captureSite", "supportVillage", "recruitVillage"].includes(actor3.order.type)) assign(s, actor3, { ...actor3.order });
    }
    return neutralAction;
  }
  if (c.type === "toggleGate") {
    let changed = false;
    for (const gate of s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && alive3(e) && e.role === "gate" && e.progress === 1)) {
      if (gate.gateOpen && s.entities.some((e) => alive3(e) && sameLevel2(e, gate) && e.kind === "unit" && footprintOverlap(e, gate.x, gate.y, buildingDef(s, gate).size))) continue;
      gate.gateOpen = !gate.gateOpen;
      changed = true;
    }
    return changed;
  }
  if (c.type === "setRally" || c.type === "clearRally") {
    const producers = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && alive3(e) && e.kind === "building" && (e.role === "hq" || e.role === "barracks"));
    if (!producers.length || c.type === "setRally" && producers.some((e) => levelOf2(e) !== (c.level ?? 0))) return false;
    if (c.type === "setRally") {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x < 0.5 || c.y < 0.5 || c.x > s.width - 0.5 || c.y > s.height - 0.5) return false;
      if (!s.explored[side2].has(fogKey(s, c))) return false;
      if (!rallyWalkable(s, side2, c.x, c.y, c.level ?? 0)) return false;
    }
    for (const e of producers) {
      if (c.type === "clearRally") delete e.rally;
      else e.rally = { x: c.x, y: c.y, ...c.level === void 0 ? {} : { level: c.level } };
    }
    return true;
  }
  if (c.type === "cancelTrain") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive3(e2) && e2.kind === "building");
    if (!e || !Number.isInteger(c.index) || c.index < 0 || c.index >= e.queue.length) return false;
    refundCost(s, side2, e.queue[c.index], e.queueDefinitionIds?.[c.index], e.queuePaidCosts?.[c.index]);
    e.queue.splice(c.index, 1);
    e.queueDefinitionIds?.splice(c.index, 1);
    e.queuePaidCosts?.splice(c.index, 1);
    if (c.index === 0) e.trainProgress = 0;
    return true;
  }
  if (c.type === "reorderTrain") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive3(e2) && e2.kind === "building" && e2.progress === 1 && (e2.role === "hq" || e2.role === "barracks"));
    if (!e || !Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 1 || c.to < 1 || c.from >= e.queue.length || c.to >= e.queue.length || c.from === c.to) return false;
    const [role] = e.queue.splice(c.from, 1);
    e.queue.splice(c.to, 0, role);
    if (e.queueDefinitionIds) {
      const [id5] = e.queueDefinitionIds.splice(c.from, 1);
      e.queueDefinitionIds.splice(c.to, 0, id5);
      if (e.queuePaidCosts) {
        const [cost5] = e.queuePaidCosts.splice(c.from, 1);
        e.queuePaidCosts.splice(c.to, 0, cost5);
      }
    }
    return true;
  }
  if (c.type === "train") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive3(e2) && e2.kind === "building" && e2.progress === 1);
    const d = c.definitionId ? availableUnits(s, side2).find((d2) => d2.id === c.definitionId && d2.role === c.role) : f.units[c.role];
    if (!e || !d || d.tags?.includes("hero") && heroRecruitmentReason(s, side2, d.id) || !definitionAllowed(s, side2, d.id) || playerAge(p) < (d.age ?? 1) || (c.role === "worker" ? e.role !== "hq" : e.role !== "barracks") || e.queue.length >= 5 || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || p.population + reserved(s, side2) >= p.cap) return false;
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    if (s.content || c.definitionId || e.queueDefinitionIds !== void 0 || e.queuePaidCosts !== void 0) {
      e.queueDefinitionIds ??= e.queue.map((role) => f.units[role].id);
      e.queueDefinitionIds.push(d.id);
      e.queuePaidCosts ??= e.queue.map((role) => ({ ...f.units[role].cost }));
      e.queuePaidCosts.push({ ...d.cost });
    }
    e.queue.push(c.role);
    return true;
  }
  if (c.type === "research") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive3(e2) && e2.kind === "building" && e2.progress === 1);
    const d = (() => {
      try {
        return upgradeFor(s, side2, c.upgrade);
      } catch {
        return void 0;
      }
    })();
    if (!e || !d || !definitionAllowed(s, side2, c.upgrade) || d.building !== e.role || e.research || researchRequirement(s, side2, c.upgrade) || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal) return false;
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    e.research = c.upgrade;
    if (d.exclusiveGroup) e.researchPaidCost = { ...d.cost };
    e.researchProgress = 0;
    emit(s, "research", e, void 0, `${d.name} started`);
    return true;
  }
  if (c.type === "promote") return promote(s, side2, c.id, c.promotion);
  if (c.type === "recoverArtifact") return recoverArtifact(s, side2, c.id, c.artifact);
  if (c.type === "equipArtifact") return equipArtifact(s, side2, c.id, c.artifact);
  if (c.type === "unequipArtifact") return unequipArtifact(s, side2, c.id, c.slot);
  if (c.type === "dropArtifact") return dropArtifact(s, side2, c.id, c.artifact);
  if (c.type === "fieldRepair") return fieldRepair(s, side2, c.id, c.target);
  if (c.type === "engineerBuild") return engineerBuild(s, side2, c, specialistHooks(s));
  if (!("ids" in c)) return false;
  const units = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && alive3(e) && e.kind === "unit" && !e.illusion && !isCrewless(e) && !(["attack", "attackMove", "ability"].includes(c.type) && economyUnitDefinition(s, e))).sort((a, b) => a.id - b.id);
  if (!units.length) return false;
  if (c.type === "formation") {
    const army = units.filter((e) => e.role !== "worker" && e.role !== "siege" && sameLevel2(e, units[0]));
    if (!army.length) return false;
    const anchor = army.reduce((p2, e) => ({ x: p2.x + e.x / army.length, y: p2.y + e.y / army.length }), { x: 0, y: 0 });
    setFormation(s, army, c.formation, c.spacing, c.facing, { ...anchor, level: levelOf2(army[0]) });
    for (const e of army) {
      const to = commandDestination(s, side2, formationDestination(e.tactics.formation, s), e);
      if (to) commandOrder(s, e, { type: "move", ...to });
    }
    return true;
  }
  if (c.type === "face") {
    for (const e of units) {
      e.facing = c.facing;
      commandOrder(s, e, { type: "hold" });
      if (e.tactics?.formation) e.tactics.formation.facing = c.facing;
    }
    return true;
  }
  if (c.type === "ambush") {
    const concealed = units.filter((e) => canAmbush(s, e));
    if (!concealed.length) return false;
    for (const e of concealed) {
      const t = initializeTactics(s, e);
      delete t.formation;
      delete t.capture;
      commandOrder(s, e, { type: "hold" });
      t.ambush = { radius: c.radius, target: c.target, concealed: true, armedAt: s.time };
    }
    return true;
  }
  if (c.type === "releaseAmbush") {
    let changed = false;
    for (const e of units) if (e.tactics?.ambush) {
      delete e.tactics.ambush;
      changed = true;
    }
    return changed;
  }
  if (c.type === "captureSiege") {
    const target2 = s.entities.find((e) => e.id === c.target), captors = target2 ? units.filter((e) => canCaptureSiege(s, e, target2)) : [];
    if (!captors.length) return false;
    for (const e of captors) {
      const t = initializeTactics(s, e);
      delete t.ambush;
      delete t.formation;
      commandOrder(s, e, { type: "hold" });
      t.capture = { target: target2.id, progress: 0 };
    }
    return true;
  }
  if (c.type === "build") {
    const level2 = c.level ?? 0, workers3 = units.filter((e) => e.role === "worker" && !economyUnitDefinition(s, e) && levelOf2(e) === level2);
    const d = c.definitionId ? availableBuildings(s, side2).find((d2) => d2.id === c.definitionId && d2.role === c.role) : f.buildings[c.role];
    if (!workers3.length || !d || !isNormalBuildingDefinition(d) || playerAge(p) < buildingAgeRequired(d) || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || !canPlace(s, side2, c.role, c.x, c.y, c.definitionId, level2)) return false;
    const overlapping = s.entities.filter((e) => e.kind === "unit" && alive3(e) && levelOf2(e) === level2 && isAllied(s, e.side, side2) && footprintOverlap(e, c.x, c.y, d.size));
    const shoves = [];
    for (const u of overlapping) {
      const dest = shovePoint(s, c.x, c.y, d.size, level2);
      if (!dest) return false;
      shoves.push({ e: u, ...dest });
    }
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    const b = spawnEntity(s, side2, "building", c.role, c.x, c.y, 0, c.definitionId, level2);
    recordEconomyPaid(s, b, d.cost);
    for (const shove of shoves) {
      shove.e.x = shove.x;
      shove.e.y = shove.y;
      invalidateNavigation(s, shove.e);
    }
    for (const e of workers3) commandOrder(s, e, { type: "build", target: b.id });
    emit(s, "build", b);
    return true;
  }
  if (c.type === "ability") {
    let success = false;
    for (const e of units) {
      const special = specialistAbility(s, e, c, specialistHooks(s));
      if (special ?? useAbility(s, e)) success = true;
    }
    return success;
  }
  if (c.type === "move" || c.type === "attackMove") {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return false;
    const formed = units.filter((e) => !!e.tactics?.formation && levelOf2(e) === (c.level ?? 0));
    if (formed.length && !c.queued) {
      const f2 = formed[0].tactics.formation;
      setFormation(s, formed, f2.kind, f2.spacing, f2.facing, { x: clamp3(c.x, 0.6, s.width - 0.6), y: clamp3(c.y, 0.6, s.height - 0.6), level: c.level ?? 0 });
    }
    const width = Math.ceil(Math.sqrt(units.length)), dir2 = s.starts[side2].y < s.height / 2 ? 1 : -1;
    const destinations = units.map((e, i) => {
      const dx = units.length === 1 ? 0 : (i % width - (width - 1) / 2) * 0.8 * dir2, dy = units.length === 1 ? 0 : (Math.floor(i / width) - (width - 1) / 2) * 0.8 * dir2;
      return commandDestination(s, side2, e.tactics?.formation && !c.queued ? formationDestination(e.tactics.formation, s) : { x: clamp3(c.x + dx, 0.6, s.width - 0.6), y: clamp3(c.y + dy, 0.6, s.height - 0.6), ...c.level === void 0 ? {} : { level: c.level } }, e);
    });
    for (const e of units) if (e.tactics) {
      delete e.tactics.ambush;
      delete e.tactics.capture;
    }
    let moved = false;
    units.forEach((e, i) => {
      if (destinations[i] && commandOrder(s, e, { type: c.type, ...destinations[i] }, c.queued)) moved = true;
    });
    return moved;
  }
  if (c.type === "stop" || c.type === "hold") {
    for (const e of units) {
      if (e.tactics) {
        delete e.tactics.formation;
        delete e.tactics.ambush;
        delete e.tactics.capture;
      }
      commandOrder(s, e, { type: c.type === "hold" ? "hold" : "idle" });
    }
    return true;
  }
  if (!("target" in c)) return false;
  const target = c.type === "gather" ? s.resources.find((e) => e.id === c.target && e.amount > 0) : s.entities.find((e) => e.id === c.target && alive3(e));
  if (!target || !isVisible(s, side2, target.x, target.y, levelOf2(target)) || "side" in target && !canObserveTacticalEntity(s, side2, target)) return false;
  if (c.type === "attack") {
    if (!("side" in target) || !isHostile(s, target.side, side2) && !isCrewless(target)) return false;
    for (const e of units) if (e.tactics) {
      delete e.tactics.ambush;
      delete e.tactics.capture;
      if (e.tactics.formation) e.tactics.formation.phase = "broken";
    }
    return units.filter((e) => sameLevel2(e, target)).reduce((accepted, e) => commandOrder(s, e, { type: "attack", target: target.id }, c.queued) || accepted, false);
  }
  const workers2 = units.filter((e) => e.role === "worker" && !economyUnitDefinition(s, e) && sameLevel2(e, target));
  if (!workers2.length) return false;
  if (c.type === "repair" && (!("side" in target) || !isAllied(s, target.side, side2) || target.kind !== "building" || target.hp >= target.maxHp && target.progress >= 1)) return false;
  return workers2.reduce((accepted, e) => commandOrder(s, e, { type: c.type === "gather" ? "gather" : "build", target: target.id }, c.queued) || accepted, false);
}
function useAbility(s, e) {
  if ((runtime(s).abilities.get(e.id) ?? 0) > s.time) return false;
  const definition2 = unitDef(s, e), ability = definition2.ability;
  if (!ability) return false;
  if (ability === "entrench") {
    if (e.entrenchedAt !== void 0) {
      e.entrenchedAt = void 0;
      commandOrder(s, e, { type: "idle" });
    } else {
      commandOrder(s, e, { type: "hold" });
      e.entrenchedAt = s.time;
    }
  } else if (ability === "raise") {
    const originalFaction = e.definitionFaction ?? s.players[e.side].faction, raisedDefinition = availableUnits({ content: s.content, players: [{ faction: originalFaction }] }, 0).find((unit5) => unit5.role === "melee" && definitionAllowed(s, e.side, unit5.id));
    if (!raisedDefinition) return false;
    updatePopulation(s);
    let count = 0;
    const delivered = e.factionState?.deliveredCorpses ?? [];
    for (const corpse of [...delivered, ...s.corpses].sort((a, b) => distance10(e, a) - distance10(e, b))) {
      if (count >= 2 || s.players[e.side].population + reserved(s, e.side) >= s.players[e.side].cap) break;
      const cached = delivered.includes(corpse), point5 = cached ? openDestination(s, { x: e.x + 0.7, y: e.y + 0.7, level: levelOf2(e) }, e) : corpse;
      if (corpse.expires <= s.time || !point5 || !cached && (distance10(e, corpse) > 6 || !isVisible(s, e.side, corpse.x, corpse.y, levelOf2(corpse))) || !walkable(s, point5.x, point5.y, levelOf2(point5))) continue;
      const raised = spawnEntity(s, e.side, "unit", "melee", point5.x, point5.y, 1, raisedDefinition.id, levelOf2(point5), e.definitionFaction);
      raised.hp = raised.maxHp * 0.5;
      raised.raised = true;
      raised.expires = s.time + 35;
      raised.order = { type: "attackMove", x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } };
      s.corpses = s.corpses.filter((c) => c.id !== corpse.id);
      if (e.factionState?.deliveredCorpses) e.factionState.deliveredCorpses = e.factionState.deliveredCorpses.filter((c) => c.id !== corpse.id);
      count++;
      updatePopulation(s);
    }
    if (!count) return false;
    runtime(s).abilities.set(e.id, s.time + 22);
  } else if (ability === "illusion") {
    if (!definitionAllowed(s, e.side, definition2.id)) return false;
    let placed = 0;
    for (const offset of [-0.6, 0.6]) {
      const desired = { x: clamp3(e.x + offset, 0.5, s.width - 0.5), y: clamp3(e.y - offset, 0.5, s.height - 0.5), ...e.level === void 0 ? {} : { level: e.level } };
      const point5 = walkable(s, desired.x, desired.y, levelOf2(e)) ? desired : openDestination(s, desired, e);
      if (!point5) continue;
      const clone2 = spawnEntity(s, e.side, "unit", e.role, point5.x, point5.y, 1, definition2.id, levelOf2(e), e.definitionFaction);
      clone2.illusion = true;
      clone2.hp = clone2.maxHp * 0.4;
      clone2.maxHp = clone2.hp;
      clone2.expires = s.time + 18;
      clone2.order = { ...e.order };
      placed++;
    }
    if (!placed) return false;
    runtime(s).abilities.set(e.id, s.time + 35);
  } else if (ability === "surge") {
    let affected = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive3(ally) && ally.kind === "unit" && !ally.illusion && distance10(e, ally) < 5) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      ally.surgeUntil = s.time + 6;
      affected = true;
    }
    if (!affected) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "ward") {
    let restored = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive3(ally) && ally.kind === "unit" && !ally.illusion && distance10(e, ally) < 5 && (ally.shield ?? 0) < (ally.maxShield ?? 0)) {
      ally.shield = Math.min(ally.maxShield, (ally.shield ?? 0) + 24);
      restored = true;
    }
    if (!restored) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "heal") {
    let healed = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive3(ally) && ally.kind === "unit" && !ally.illusion && distance10(e, ally) < 5 && ally.hp < ally.maxHp) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      healed = true;
    }
    if (!healed) return false;
    runtime(s).abilities.set(e.id, s.time + 18);
  } else {
    e.momentum = Math.min(1, e.momentum + 0.5);
    runtime(s).abilities.set(e.id, s.time + 25);
  }
  e.abilityReadyAt = runtime(s).abilities.get(e.id) ?? s.time;
  emit(s, "ability", e);
  return true;
}
function walkTo(e, x, y) {
  if (e.siegeMode?.deployed && Math.hypot(x - e.x, y - e.y) > 1e-3) e.siegeMode.deployed = false;
  const dx = x - e.x, dy = y - e.y;
  if (dx !== 0 || dy !== 0) e.facing = facing8(dx, dy);
  e.x = x;
  e.y = y;
  e.animation = "walk";
}
function finishResearch(s, e) {
  const id5 = e.research, def = upgradeFor(s, e.side, id5);
  if (canCompleteResearch(s, e.side, id5, e.id)) {
    s.players[e.side].upgrades.push(id5);
    emit(s, "research", e, void 0, `${def.name} complete`);
  } else {
    if (e.researchPaidCost) for (const resource of ["wood", "ore", "crystal"]) s.players[e.side][resource] += e.researchPaidCost[resource];
    emit(s, "message", e, void 0, `${def.name} canceled: research requirements changed.`);
  }
  e.research = void 0;
  delete e.researchPaidCost;
  e.researchProgress = 0;
}
function upgradeFactor(s, e, effect) {
  let factor = 1;
  for (const id5 of s.players[e.side].upgrades) {
    const u = upgradeFor(s, e.side, id5);
    if (upgradeAppliesTo(u, unitDef(s, e))) factor *= u.effects[effect] ?? 1;
  }
  return factor;
}
function movementSpeed(s, e) {
  const terrain2 = terrainAt(s, e.x, e.y, levelOf2(e));
  const terrainSpeed = factionFor(s, e.side).terrainSpeeds?.[terrain2] ?? TERRAIN[terrain2].speed;
  return unitDef(s, e).speed * progressionStats(s, e).speedFactor * terrainSpeed * environmentalMovementFactor(s, e) * upgradeFactor(s, e, "speed") * factionMovementFactor(e) * (e.illusion ? 1.08 : 1) * ((e.surgeUntil ?? 0) > s.time ? 1.25 : 1);
}
function move(s, e, to, dt, reach = 0.45) {
  if (!sameLevel2(e, to)) return false;
  if (distance10(e, to) <= reach) {
    e.path = [];
    return true;
  }
  if (distance10(e, to) < reach + 0.85) {
    const d2 = distance10(e, to), amount2 = Math.min(d2 - reach + 0.02, movementSpeed(s, e) * dt), x = e.x + (to.x - e.x) / d2 * amount2, y = e.y + (to.y - e.y) / d2 * amount2;
    if (segmentWalkable(s, e, { x, y, level: levelOf2(e) })) {
      walkTo(e, x, y);
      return distance10(e, to) <= reach;
    }
  }
  const rt = runtime(s), key = `${s.world?.revision ?? 0},${levelOf2(to)},${Math.floor(to.x * 2)},${Math.floor(to.y * 2)},${reach.toFixed(1)}`, cache = rt.routes.get(e.id);
  if (!cache || cache.key !== key || !e.path.length && s.time - cache.at > 1.3 || s.time - cache.at > 5) {
    e.path = route(s, e, to, reach, e.side);
    rt.routes.set(e.id, { key, at: s.time });
  }
  while (e.path.length > 1 && distance10(e, e.path[0]) < 0.6 && segmentWalkable(s, e, e.path[1])) e.path.shift();
  if (!e.path.length) return false;
  const p = e.path[0], d = distance10(e, p), speed = movementSpeed(s, e), amount = Math.min(d, speed * dt);
  if (d < 0.09) {
    e.path.shift();
    return false;
  }
  const nx = e.x + (p.x - e.x) / d * amount, ny = e.y + (p.y - e.y) / d * amount;
  if (segmentWalkable(s, e, { x: nx, y: ny, level: levelOf2(e) })) {
    walkTo(e, nx, ny);
  } else if (segmentWalkable(s, e, { x: nx, y: e.y, level: levelOf2(e) }) && Math.abs(nx - e.x) > 1e-3) {
    walkTo(e, nx, e.y);
  } else if (segmentWalkable(s, e, { x: e.x, y: ny, level: levelOf2(e) }) && Math.abs(ny - e.y) > 1e-3) {
    walkTo(e, e.x, ny);
  } else {
    e.path = [];
    rt.routes.delete(e.id);
  }
  if (d <= amount + 0.06) e.path.shift();
  return distance10(e, to) <= reach;
}
function emplaced(s, e) {
  return e.entrenchedAt !== void 0 && s.time - e.entrenchedAt >= 3;
}
function weaponRange(s, e) {
  const range = e.kind === "building" ? 7 : unitDef(s, e).range + progressionStats(s, e).range + (emplaced(s, e) && e.role === "special" ? 3 : 0);
  return range + (range > 2 ? highGroundRangeBonus(s, e) : 0);
}
function targetRadius(s, target) {
  return isEntityTarget(target) ? radius(s, target) : 0;
}
function targetDistance(s, at2, target) {
  return isBridgeTarget(target) ? Math.min(...target.tiles.map((tile) => distance10(at2, { x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: target.level }))) : distance10(at2, target);
}
function targetPoint(s, source2, target) {
  return isBridgeTarget(target) ? target.tiles.map((tile) => ({ x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: target.level })).sort((a, b) => distance10(source2, a) - distance10(source2, b))[0] : target;
}
function queueWeaponHit(s, a, b, raw, ranged, crew = false, armorPiercing = false, weapon = true) {
  const entity = isEntityTarget(b), def = entity && b.kind === "unit" ? unitDef(s, b) : void 0;
  const armor = !entity || armorPiercing ? 0 : (def?.armor ?? 3) + progressionStats(s, b).armor + factionArmorBonus(s, b) + (emplaced(s, b) ? 2 : 0) + s.players[b.side].upgrades.reduce((sum, id5) => {
    const u = upgradeFor(s, b.side, id5);
    return sum + (def && upgradeAppliesTo(u, def) ? u.effects.armor ?? 0 : 0);
  }, 0);
  const point5 = targetPoint(s, a, b), height = a.elevation === void 0 ? highGroundDamageFactor(s, a, point5) : 1 + 0.12 * Math.max(0, Math.min(3, a.elevation - elevationAt(s, point5))), environment = ranged ? projectileEnvironment(s, a, point5).damageFactor * height : 1;
  const flank = entity && weapon ? facingDamageFactor(a, b) : 1, cover = entity && ranged && weapon ? rangedCoverFactor(s, a, b) : 1, event = emit(s, "attack", a, b.id), hit = Math.max(1, raw * environment * flank * cover - armor);
  runtime(s).hits.push({ source: { id: a.id, side: a.side, x: a.x, y: a.y, furyEligible: a.furyEligible ?? ("kind" in a ? a.kind === "unit" && !a.illusion : "definitionId" in a), ...a.level === void 0 ? {} : { level: a.level } }, target: b, amount: hit, event, crew, ranged });
}
function damage(s, a, b) {
  if (!factionCanFire(s, a) || isCrewless(a) || !sameLevel2(a, b)) return;
  const d = a.kind === "unit" ? unitDef(s, a) : null, base = (d ? d.damage * upgradeFactor(s, a, "damage") * progressionStats(s, a).damageFactor : 19) * (1 + relicBonus(s, a.side, a)), bonus = d?.ability === "momentum" ? 1 + a.momentum * 0.4 : emplaced(s, a) ? 1.15 : 1;
  const shelling = !a.illusion && (a.role === "siege" || a.role === "special" && d?.ability === "entrench" && !!a.factionState?.artillery), raw = base * bonus * factionDamageFactor(s, a) * (a.illusion ? 0.25 : 1), modification = a.factionState?.artillery, point5 = targetPoint(s, a, b);
  if (shelling) {
    if (!specialistShotReady(s, a)) return;
    const shot = a.role === "siege" ? launchSpecialistShot(s, a, { ...b, ...point5 }, raw, modification) : void 0;
    if (shot === false) return;
    if (!shot) {
      if (modification === "incendiary") {
        const p = s.players[a.side];
        if (p.wood < 15 || p.ore < 5) return;
        p.wood -= 15;
        p.ore -= 5;
      }
      (s.projectiles ??= []).push({ id: s.nextId++, source: a.id, side: a.side, faction: a.definitionFaction ?? s.players[a.side].faction, from: { x: a.x, y: a.y, level: levelOf2(a), elevation: elevationAt(s, a) }, x: point5.x, y: point5.y, level: levelOf2(point5), damage: raw, buildingMultiplier: d?.buildingDamageMultiplier ?? 1, impactAt: s.time + 0.25 + distance10(a, point5) / 12, radius: factionSplashRadius(a), modification });
      emit(s, "ability", a, b.id, "Siege shell launched");
    }
  } else {
    const entity = isEntityTarget(b), building5 = isBridgeTarget(b) || entity && b.kind === "building", impact = entity ? cavalryImpact(s, a, b) : { factor: 1, pikeDamage: 0 }, multiplier = building5 ? d?.buildingDamageMultiplier ?? 1 : entity ? d?.bonusAgainst?.[b.role] ?? 1 : 1, crew = entity && b.role === "siege" && !isCrewless(b) && (d?.range ?? 7) <= 2.2;
    queueWeaponHit(s, a, b, raw * multiplier * impact.factor * (modification === "stone" && building5 ? 1.25 : modification === "grapeshot" && !building5 ? 1.5 : 1), (d?.range ?? 7) > 2.2, crew);
    if (impact.pikeDamage > 0 && entity) {
      queueWeaponHit(s, b, a, impact.pikeDamage, false);
      emit(s, "message", a, b.id, "Charge stopped by braced pikes");
    }
  }
  a.cooldown = (d?.cooldown ?? 1.4) / (d?.ability === "momentum" ? 1 + a.momentum * 0.15 : 1);
  if (d?.ability === "momentum") a.momentum = Math.min(1, a.momentum + 0.15);
  a.animation = "attack";
  a.animTime = 0;
}
function resolveProjectiles(s) {
  const pending = [], friendlyFire = s.rules?.friendlyFire ?? s.friendlyFire ?? true;
  for (const shell of s.projectiles ?? []) {
    if (shell.impactAt > s.time) {
      pending.push(shell);
      continue;
    }
    const source2 = { id: shell.source, side: shell.side, ...shell.from, furyEligible: true };
    for (const target of combatTargets(s)) {
      const entity = isEntityTarget(target), building5 = isBridgeTarget(target) || entity && target.kind === "building", range = targetDistance(s, shell, target);
      if (target.hp <= 0 || !sameLevel2(shell, target) || range > shell.radius + targetRadius(s, target) || !friendlyFire && entity && isAllied(s, shell.side, target.side) && !isCrewless(target)) continue;
      queueWeaponHit(s, source2, target, shell.damage * (shell.modification === "stone" && building5 ? 1.25 : shell.modification === "grapeshot" && !building5 ? 1.5 : 1) * (building5 ? shell.buildingMultiplier : 1) * (1 - 0.4 * Math.min(1, range / shell.radius)), true);
    }
    if (shell.modification === "incendiary") igniteWorldAt(s, shell, { id: shell.source, side: shell.side });
    emit(s, "ability", { id: shell.source, side: shell.side, x: shell.x, y: shell.y, level: levelOf2(shell) }, void 0, "Siege impact");
  }
  s.projectiles = pending;
}
function die(s, e, text3, sourceSide) {
  if (e.animation === "death") return;
  const carried = e.carried;
  onEconomyDeath(s, e, economyHooks);
  for (const body of [...e.factionState?.corpseCargo ?? [], ...e.factionState?.deliveredCorpses ?? []]) if (body.expires > s.time) s.corpses.push({ ...body, x: e.x, y: e.y, level: e.level });
  if (e.factionState) {
    delete e.factionState.corpseCargo;
    delete e.factionState.deliveredCorpses;
  }
  if (sourceSide !== void 0) recordFactionDeath(s, e, sourceSide);
  recordTacticsDeath(s, e);
  commanderDied(s, e);
  commanderArtifact(s, e);
  dropArtifacts(s, e);
  if (s.specialists) s.specialists.structures = s.specialists.structures.filter((item) => item.entityId !== e.id);
  if (e.kind === "building") refundQueue(s, e);
  if (e.kind === "unit" && !e.illusion && !e.raised) s.corpses.push({ id: e.id, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, expires: s.time + 45 });
  e.hp = 0;
  e.animation = "death";
  e.animTime = 0;
  e.order = { type: "idle" };
  delete e.orderQueue;
  runtime(s).queuedGather.delete(e.id);
  e.path = [];
  const event = emit(s, "death", e, void 0, text3);
  if (carried > 0) event.amount = carried;
}
function enemy(s, e, max, onlyInRange = false) {
  let best, bestDist = Infinity;
  for (const b of s.entities) {
    if (!alive3(b) || !isHostile(s, b.side, e.side) || isCrewless(b) || !canObserveTacticalEntity(s, e.side, b) || onlyInRange && !near(s, e, b, max)) continue;
    const d = distance10(e, b) - radius(s, b);
    if (d <= max && (d < bestDist || best?.kind === "building" && b.kind === "unit")) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
function fight(s, e, b, dt) {
  if (!factionCanFire(s, e)) return;
  const range = weaponRange(s, e) * (e.kind === "building" || unitDef(s, e).range > 2 ? projectileEnvironment(s, e, b).rangeFactor : 1);
  if (!sameLevel2(e, b)) return;
  if (near(s, e, b, range) && terrainLineOfSight(s, e, b)) {
    if (e.order.type !== "hold" && e.tactics?.formation?.phase !== "formed") e.facing = facing8(b.x - e.x, b.y - e.y);
    if (e.cooldown <= 0) damage(s, e, b);
  } else if (e.kind === "unit") move(s, e, b, dt, range + (b.kind === "building" ? radius(s, b) : 0) - 0.1);
}
function gather(s, e, target, dt) {
  const node = s.resources.find((n) => n.id === target && sameLevel2(n, e));
  const rt = runtime(s), finite2 = rt.queuedGather.has(e.id) || !!e.orderQueue?.length;
  if (e.carried >= 18 || node?.amount === 0 && e.carried > 0 || finite2 && (!node || node.amount <= 0) && e.carried > 0) rt.returning.add(e.id);
  if (rt.returning.has(e.id)) {
    const depot2 = economyGatherDepot(s, e) ?? s.entities.filter((b) => b.side === e.side && sameLevel2(b, e) && alive3(b) && b.kind === "building" && b.progress === 1 && (b.role === "hq" || b.role === "depot" && b.definitionId !== TROPHY_STANDARD.id)).sort((a, b) => distance10(e, a) - distance10(e, b))[0];
    if (!depot2) {
      finishOrder(s, e);
      return;
    }
    if (near(s, e, depot2, 1.1)) {
      const accepted = depositEconomyGather(s, e, depot2, e.carried), income = accepted * s.incomeFactors[e.side];
      if (accepted > 0) {
        const deposit = emit(s, "gather", e, depot2.id);
        deposit.amount = income;
        deposit.resource = e.carriedKind;
      }
      e.carried = Math.max(0, e.carried - accepted);
      if (e.carried === 0) rt.returning.delete(e.id);
      if (e.carried === 0 && finite2 && (!node || node.amount <= 0)) finishOrder(s, e);
    } else move(s, e, depot2, dt, radius(s, depot2) + 1);
    return;
  }
  if (!node || node.amount <= 0) {
    if (finite2) {
      finishOrder(s, e);
      return;
    }
    const next = s.resources.filter((n) => n.amount > 0 && sameLevel2(n, e) && n.kind === (node?.kind ?? e.carriedKind) && isVisible(s, e.side, n.x, n.y, levelOf2(n))).sort((a, b) => distance10(e, a) - distance10(e, b))[0];
    assign(s, e, next ? { type: "gather", target: next.id } : { type: "idle" });
    return;
  }
  if (e.carried > 0 && e.carriedKind !== node.kind) {
    rt.returning.add(e.id);
    return;
  }
  if (distance10(e, node) > 1.2) {
    move(s, e, node, dt, 1.1);
    return;
  }
  e.animation = "attack";
  e.carriedKind = node.kind;
  const amount = Math.min(node.amount, dt * ECONOMY.harvestPerSecond * upgradeFactor(s, e, "gather") * economyGatherFactor(s, e, node) * (node.kind === "crystal" ? 0.6 : 1), 18 - e.carried);
  node.amount -= amount;
  e.carried += amount;
}
function construct(s, e, id5, dt) {
  const b = s.entities.find((b2) => b2.id === id5 && alive3(b2) && sameLevel2(b2, e) && isAllied(s, b2.side, e.side) && b2.kind === "building");
  if (!b) {
    finishOrder(s, e);
    return;
  }
  if (!near(s, e, b, 1.2)) {
    move(s, e, b, dt, radius(s, b) + 1.1);
    return;
  }
  const def = buildingDef(s, b);
  e.animation = "attack";
  if (b.progress < 1) {
    const amount = Math.min(1 - b.progress, dt / def.buildTime);
    b.progress += amount;
    b.hp = Math.min(b.maxHp, b.hp + amount * b.maxHp * 0.9);
    if (b.progress >= 1) {
      b.progress = 1;
      emit(s, "build", b, void 0, "Construction complete");
      updatePopulation(s);
    }
  } else if (b.hp < b.maxHp) {
    const p = s.players[e.side], amount = Math.min(b.maxHp - b.hp, dt * 18, p.wood * 10);
    p.wood = Math.max(0, p.wood - amount * 0.1);
    b.hp += amount;
  } else finishOrder(s, e);
}
function production(s, e, dt) {
  if (e.progress < 1 || !e.queue.length) return;
  const role = e.queue[0], d = queuedUnitFor(s, e, 0);
  if (s.players[e.side].population >= s.players[e.side].cap) return;
  if (e.trainProgress < 1) e.trainProgress = Math.min(1, e.trainProgress + dt * economyProductionFactor(s, e) / d.trainTime);
  if (e.trainProgress < 1) return;
  let point5;
  const direction = e.side === 0 ? 1 : -1;
  for (let ring = radius(s, e) + 1; ring <= radius(s, e) + 6 && !point5; ring += 0.5) for (const [dx, dy] of DIRECTIONS_24) {
    const p = { x: e.x + dx * ring * direction, y: e.y + dy * ring * direction, ...e.level === void 0 ? {} : { level: e.level } };
    if (walkable(s, p.x, p.y, levelOf2(e))) {
      point5 = p;
      break;
    }
  }
  if (!point5) {
    refundCost(s, e.side, role, e.queueDefinitionIds?.[0], e.queuePaidCosts?.[0]);
    e.queue.shift();
    e.queueDefinitionIds?.shift();
    e.queuePaidCosts?.shift();
    e.trainProgress = 0;
    return;
  }
  const u = spawnEntity(s, e.side, "unit", role, point5.x, point5.y, 1, e.queueDefinitionIds?.[0], levelOf2(e));
  recordEconomyPaid(s, u, e.queuePaidCosts?.[0] ?? d.cost);
  if (role !== "worker") runtime(s).producedFighters[e.side]++;
  e.trainProgress = 0;
  e.queue.shift();
  e.queueDefinitionIds?.shift();
  e.queuePaidCosts?.shift();
  emit(s, "train", u);
  updatePopulation(s);
  if (e.rally) issueCommand(s, e.side, { type: "move", ids: [u.id], ...e.rally });
}
function separateUnits(s) {
  const units = s.entities.filter((e) => e.kind === "unit" && alive3(e));
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j], d = distance10(a, b);
    if (d >= 0.58) continue;
    const dx = d > 1e-3 ? (a.x - b.x) / d : a.id % 2 ? 1 : -1, dy = d > 1e-3 ? (a.y - b.y) / d : 0.3, push = (0.58 - d) * 0.22;
    const ax = a.x + dx * push, ay = a.y + dy * push, bx = b.x - dx * push, by = b.y - dy * push;
    if (!isCrewless(a) && walkable(s, ax, ay, levelOf2(a))) {
      a.x = ax;
      a.y = ay;
    }
    if (!isCrewless(b) && walkable(s, bx, by, levelOf2(b))) {
      b.x = bx;
      b.y = by;
    }
  }
}
function resolveHits(s) {
  const groups = /* @__PURE__ */ new Map(), livingSources = new Set(s.entities.filter((e) => e.hp > 0).map((e) => e.id));
  for (const hit of runtime(s).hits) {
    const group = groups.get(hit.target) ?? [];
    group.push(hit);
    groups.set(hit.target, group);
  }
  const credit = (source2, target, amount, killed = false) => {
    const actor3 = s.entities.find((e) => e.id === source2.id && e.side === source2.side);
    if ((!isEntityTarget(target) || isHostile(s, source2.side, target.side)) && (actor3 || source2.furyEligible)) recordFactionDamage(s, actor3 ?? { kind: "unit", side: source2.side, illusion: false }, amount);
    if (actor3 && isEntityTarget(target)) creditCombat(s, actor3, target, amount, killed, livingSources.has(actor3.id));
  };
  for (const [target, hits] of [...groups].sort((a, b) => a[0].id - b[0].id)) {
    if (target.hp <= 0) continue;
    if (!isEntityTarget(target)) {
      const total3 = hits.reduce((n, h) => n + h.amount, 0), actual2 = Math.min(target.hp, total3);
      target.hp = Math.max(0, target.hp - total3);
      for (const hit of hits) {
        hit.event.amount = total3 ? actual2 * hit.amount / total3 : 0;
        credit(hit.source, target, hit.event.amount);
      }
      if (target.hp === 0) {
        const killer = hits.reduce((best, h) => h.amount > best.amount ? h : best).source;
        if (isBridgeTarget(target)) collapseBridge(s, target, killer.side, { move: (actor3, to, dt, reach) => move(s, actor3, to, dt, reach), finish: (actor3) => finishOrder(s, actor3), interrupt: (actor3) => interruptWorldOrder(s, actor3), die: (actor3, text3) => die(s, actor3, text3) });
        else defeatCreature(s, target, killer.side);
      }
      continue;
    }
    if (target.kind === "unit") initializeTactics(s, target);
    const crew = target.tactics?.siegeCrew, crewHits = crew && !crew.uncrewed ? hits.filter((hit) => hit.crew) : [], engineHits = hits.filter((hit) => !crewHits.includes(hit));
    const crewDamage = crewHits.reduce((n, h) => n + h.amount, 0);
    if (crew && crewDamage > 0) {
      const actual2 = Math.min(crew.hp, crewDamage);
      for (const hit of crewHits) {
        hit.event.amount = actual2 * hit.amount / crewDamage;
        credit(hit.source, target, hit.event.amount);
      }
      crew.hp = Math.max(0, crew.hp - crewDamage);
      if (crew.hp === 0) {
        crew.uncrewed = true;
        interruptWorldOrder(s, target);
        emit(s, "message", target, void 0, "Siege crew defeated: engine uncrewed");
      }
    }
    for (const hit of engineHits) {
      const protection = hit.ranged ? interceptDirectionalShield(s, hit.source, target, hit.amount) : { remaining: hit.amount, intercepted: [] };
      hit.amount = protection.remaining;
      for (const interception of protection.intercepted) {
        const event = emit(s, "attack", hit.source, interception.bearer.id, "Shield intercepted shot");
        event.amount = interception.amount;
        credit(hit.source, interception.bearer, interception.amount);
        recordCombatExposure(s, interception.bearer);
      }
    }
    const total2 = engineHits.reduce((n, h) => n + h.amount, 0), networkAbsorbed = absorbFactionShield(s, target, total2), ownAbsorbed = Math.min(target.shield ?? 0, total2 - networkAbsorbed), absorbed = networkAbsorbed + ownAbsorbed, actual = Math.min(target.hp, total2 - absorbed) + absorbed;
    target.shield = Math.max(0, (target.shield ?? 0) - ownAbsorbed);
    target.hp = Math.max(0, target.hp - (total2 - absorbed));
    if (total2 || crewDamage) target.lastDamagedAt = s.time;
    for (const hit of engineHits) {
      hit.event.amount = total2 ? actual * hit.amount / total2 : 0;
      credit(hit.source, target, hit.event.amount);
    }
    if (actual > 0 && engineHits.some((hit) => (hit.event.amount ?? 0) > 0 && isHostile(s, hit.source.side, target.side) && (() => {
      const actor3 = s.entities.find((e) => e.id === hit.source.id && e.side === hit.source.side);
      return !actor3 || !actor3.illusion && !actor3.raised;
    })())) recordCombatExposure(s, target);
    recordTacticsDamage(s, target, total2 - absorbed);
    if (total2 || crewDamage) {
      const killer = hits.reduce((best, h) => h.amount > best.amount ? h : best).source;
      target.lastAttacker = killer.id;
      if (target.hp === 0) {
        credit(killer, target, 0, true);
        die(s, target, void 0, killer.side);
      }
    }
  }
  if (s.rules.standardDefeat) {
    s.eliminated = playerSides(s).map((side2) => !s.entities.some((e) => e.side === side2 && e.role === "hq" && alive3(e) && e.progress === 1));
    const livingTeams = [...new Set(s.teams.filter((_, side2) => !s.eliminated[side2]))];
    if (!livingTeams.length) s.draw = true;
    else if (livingTeams.length === 1 && new Set(s.teams).size > 1) {
      s.winningTeam = livingTeams[0];
      s.winner = s.teams.findIndex((team) => team === s.winningTeam);
    }
  }
  runtime(s).hits = [];
}
function moveNeutral(s, actor3, to, dt, reach) {
  if ("side" in actor3) return move(s, actor3, to, dt, reach);
  if (!sameLevel2(actor3, to)) return false;
  const d = distance10(actor3, to);
  if (d <= reach) {
    actor3.path = [];
    return true;
  }
  if (!actor3.path.length || distance10(actor3.path[actor3.path.length - 1], to) > reach + 0.7) actor3.path = route(s, actor3, to, reach);
  while (actor3.path.length && distance10(actor3, actor3.path[0]) < 0.08) actor3.path.shift();
  const point5 = actor3.path[0];
  if (!point5) return false;
  const distanceTo = distance10(actor3, point5), amount = Math.min(distanceTo, dt * 1.7), next = { x: actor3.x + (point5.x - actor3.x) / distanceTo * amount, y: actor3.y + (point5.y - actor3.y) / distanceTo * amount, level: levelOf2(actor3) };
  if (segmentWalkable(s, actor3, next)) {
    actor3.x = next.x;
    actor3.y = next.y;
  } else actor3.path = [];
  return distance10(actor3, to) <= reach;
}
function neutralHooks(s) {
  return {
    attackStats: (e) => {
      const def = unitDef(s, e);
      return { damage: def.damage * upgradeFactor(s, e, "damage") * progressionStats(s, e).damageFactor, range: weaponRange(s, e), cooldown: def.cooldown };
    },
    recruitCost: (side2, role) => unitFor(s, side2, role).cost,
    move: (actor3, to, dt, reach) => moveNeutral(s, actor3, to, dt, reach),
    spawn: (side2, role, x, y, level2) => {
      const definition2 = unitFor(s, side2, role);
      if (!definitionAllowed(s, side2, definition2.id)) return void 0;
      const point5 = openDestination(s, { x, y, level: level2 }, { x, y, level: level2 });
      if (!point5) return void 0;
      return spawnEntity(s, side2, "unit", role, point5.x, point5.y, 1, definition2.id, level2);
    },
    hit: (source2, target, _amount) => {
      if ("side" in source2) {
        damage(s, source2, target);
        return;
      }
      if ("side" in target) queueWeaponHit(s, { id: source2.id, side: target.side, x: source2.x, y: source2.y, level: source2.level }, target, _amount, false);
    },
    attack: (source2, target) => damage(s, source2, target),
    lineOfSight: (from, to) => terrainLineOfSight(s, from, to)
  };
}
function stepGame(s, dt) {
  if (!scenarioStateRulesCompatible(s)) throw new Error("This mission uses historical or unpinned simulation rules. It is available for inspection.");
  const before = s.tick, rt = runtime(s);
  rt.stepping = true;
  try {
    applyStep(s, dt);
  } finally {
    rt.stepping = false;
    aiRecoveryScopes.delete(s);
  }
  if (s.tick !== before) {
    const scenario = scenarioSessionForState(s);
    if (scenario) afterScenarioStep(scenario, Math.min(dt, 0.25));
  }
  if (s.tick !== before) notifyStep(s, Math.min(dt, 0.25));
}
function applyStep(s, dt) {
  if (isGameOver(s) || !Number.isFinite(dt) || dt <= 0) return;
  s.events = [];
  if (s.draft.status === "drafting") {
    tickDraft(s.draft, s.rules, draftPlayers(s), s.content);
    for (const side2 of playerSides(s)) if (s.controllers[side2] === "ai" && s.draft.order[s.draft.turn]?.side === side2) {
      for (const id5 of s.draft.pool) if (applyDraftChoice(s.draft, s.rules, draftPlayers(s), side2, id5, s.content)) break;
    }
    s.tick++;
    if (s.draft.turn === s.draft.order.length) finalizeDraft(s);
    return;
  }
  dt = Math.min(dt, 0.25);
  s.time += dt;
  s.tick++;
  stepEnvironment(s, dt, { interrupt: (actor3) => interruptWorldOrder(s, actor3), die: (actor3, text3) => die(s, actor3, text3) });
  const rt = runtime(s);
  rt.hits = [];
  stepSpecialists(s, specialistHooks(s));
  resolveSpecialistShots(s, specialistHooks(s));
  stepVeterans(s);
  rt.fog -= dt;
  if (rt.fog <= 0) {
    refreshVisibility(s);
    rt.fog = 0.2;
  }
  rt.ai -= dt;
  if (rt.ai <= 0) {
    rt.aiTurns++;
    rt.ai += 1;
  }
  aiRecoveryScopes.set(s, /* @__PURE__ */ new Map());
  const sides = playerSides(s), due = new Set(sides.filter((side2) => s.controllers[side2] === "ai" && !s.eliminated[side2] && s.time + 1e-9 >= rt.aiDecisionAt[side2]));
  if (due.size) {
    const offset = rt.aiBatchTurns++ % sides.length;
    for (let i = 0; i < sides.length; i++) {
      const side2 = sides[(i + offset) % sides.length];
      if (due.has(side2)) {
        if (s.rules.mode !== "survival" || s.teams[side2] === s.rules.survival.defenderTeam) runAI(s, side2);
        const requested = new Set(rt.teamAI.directives.filter((d) => d.recipient === side2 && (d.status === "accepted" || d.status === "active")).flatMap((d) => d.assigned));
        objectiveAi(s, side2, issueCommand, requested);
        rt.aiDecisionAt[side2] = s.time + aiProfile(s.aiConfigs[side2]).decisionInterval;
      }
    }
  }
  if (s.rules.mode === "annihilation" && (due.size || rt.teamAI.coordinator.waves.length)) runTeamCoordination(s);
  for (const actor3 of s.entities) if (alive3(actor3) && isCrewless(actor3)) interruptWorldOrder(s, actor3);
  for (const actor3 of s.entities) if (alive3(actor3) && economyEntityBusy(s, actor3)) {
    const faction = actor3.factionState, tunnel = faction?.tunnel, corpseOrder = faction?.corpseOrder, order3 = actor3.order;
    if (tunnel || corpseOrder || order3.type === "build") {
      interruptWorldOrder(s, actor3, order3.type === "build" ? order3 : { type: "hold" });
      if (tunnel) faction.tunnel = tunnel;
      if (corpseOrder) faction.corpseOrder = corpseOrder;
    }
  }
  for (const actor3 of s.entities) if (alive3(actor3) && actor3.specialistBuffs?.some((buff2) => buff2.until > s.time && buff2.fearedFrom) && economyEntityBusy(s, actor3)) interruptWorldOrder(s, actor3);
  const economicActors = new Set(economicState(s)?.tasks.map((task) => task.entityId));
  for (const actor3 of s.entities) if (economicActors.has(actor3.id) && actor3.tactics?.formation) {
    delete actor3.tactics.formation;
    actor3.order = { type: "hold" };
    invalidateNavigation(s, actor3);
  }
  stepFactionSystems(s, dt, factionHooks(s));
  tickEconomy(s, dt, economyHooks);
  for (const e of [...s.entities]) {
    e.animTime += dt;
    if (!alive3(e)) {
      if (e.kind === "building") refundQueue(s, e);
      continue;
    }
    if (e.expires && s.time >= e.expires) {
      die(s, e);
      continue;
    }
    e.cooldown = Math.max(0, e.cooldown - dt);
    if (e.animation !== "attack" || e.animTime > 0.4) e.animation = "idle";
    e.momentum = Math.max(0, e.momentum - dt * 0.014);
    if (e.kind === "building") {
      if (e.progress === 1 && buildingDef(s, e).ability === "heal") {
        for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive3(ally) && ally.kind === "unit" && !ally.illusion && distance10(ally, e) < 6) ally.hp = Math.min(ally.maxHp, ally.hp + dt * 2.5);
      }
      if (e.research) {
        e.researchProgress += dt * economyResearchFactor(s, e) / upgradeFor(s, e.side, e.research).researchTime;
        if (e.researchProgress >= 1) finishResearch(s, e);
      }
      production(s, e, dt);
      if (e.role === "tower" && e.progress === 1 && !buildingDef(s, e).tags?.includes("beacon")) {
        const b2 = enemy(s, e, 7);
        if (b2) fight(s, e, b2, dt);
      }
      continue;
    }
    const d = unitDef(s, e), before = { x: e.x, y: e.y, level: levelOf2(e) };
    if (stepFactionActor(s, e, dt, factionHooks(s))) continue;
    ageCharge(s, e, dt);
    const previousSide = e.side, tactics = updateTactics(s, e, dt, (actor3) => interruptWorldOrder(s, actor3));
    if (e.side !== previousSide) dropArtifacts(s, e);
    if (tactics.retreat) {
      movementOrder(s, e, tactics.retreat, dt, 1);
      updateCharge(s, e, before, dt);
      continue;
    }
    if (tactics.skipCombat) continue;
    const capture = updateSiegeCapture(s, e, dt, (actor3) => interruptWorldOrder(s, actor3));
    if (capture.complete && capture.target) dropArtifacts(s, capture.target);
    if (capture.target && !capture.complete) {
      if (distance10(e, capture.target) > 1.3) move(s, e, capture.target, dt, 1.2);
      updateCharge(s, e, before, dt);
      continue;
    }
    if (e.maxShield && s.time - (e.lastDamagedAt ?? -6) >= 6) e.shield = Math.min(e.maxShield, (e.shield ?? 0) + 4 * dt);
    if (!e.illusion && (d.ability === "raise" || d.ability === "ward")) useAbility(s, e);
    const feared = e.specialistBuffs?.find((buff2) => buff2.until > s.time && buff2.fearedFrom)?.fearedFrom;
    if (feared) {
      const dx = e.x - feared.x, dy = e.y - feared.y, len = length2D(dx, dy) || 1;
      move(s, e, { x: clamp3(e.x + dx / len * 3, 0.6, s.width - 0.6), y: clamp3(e.y + dy / len * 3, 0.6, s.height - 0.6), level: levelOf2(e) }, dt, 0.1);
      continue;
    }
    if (economicActors.has(e.id)) continue;
    if (economyUnitDefinition(s, e) && e.order.type !== "move" && e.order.type !== "traverse") {
      if (e.order.type !== "idle") finishOrder(s, e);
      continue;
    }
    const o = e.order;
    if (processWorldAction(s, e, dt, { attack: (actor3, target) => damage(s, actor3, target), range: (actor3, target) => weaponRange(s, actor3) * projectileEnvironment(s, actor3, targetPoint(s, actor3, target)).rangeFactor, move: (actor3, to, delta, reach) => move(s, actor3, to, delta, reach), finish: (actor3) => finishOrder(s, actor3), interrupt: (actor3) => interruptWorldOrder(s, actor3), die: (actor3, text3) => die(s, actor3, text3) })) continue;
    if (processNeutralOrder(s, e, dt, neutralHooks(s))) continue;
    if (economyUnitDefinition(s, e) && o.type !== "move") continue;
    if (o.type === "hold") {
      const b2 = enemy(s, e, weaponRange(s, e), true);
      if (b2 && near(s, e, b2, weaponRange(s, e))) {
        fight(s, e, b2, dt);
        if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s.entities.some((a) => isAllied(s, a.side, e.side) && alive3(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance10(e, a) < 5))) useAbility(s, e);
      }
      continue;
    }
    if (o.type === "gather") {
      gather(s, e, o.target, dt);
      continue;
    }
    if (o.type === "build") {
      construct(s, e, o.target, dt);
      continue;
    }
    if (o.type === "move") {
      if (movementOrder(s, e, o, dt, 0.5)) {
        if (e.tactics?.formation) {
          e.tactics.formation.phase = "formed";
          e.facing = e.tactics.formation.facing;
          assign(s, e, { type: "hold" });
        } else finishOrder(s, e);
      }
      updateCharge(s, e, before, dt);
      continue;
    }
    if (o.type === "attack") {
      const b2 = s.entities.find((b3) => b3.id === o.target && alive3(b3) && (isHostile(s, b3.side, e.side) || isCrewless(b3)));
      if (!b2 || !sameLevel2(e, b2) || !canObserveTacticalEntity(s, e.side, b2)) {
        finishOrder(s, e);
        continue;
      }
      fight(s, e, b2, dt);
      updateCharge(s, e, before, dt);
      continue;
    }
    const b = enemy(s, e, d.role === "worker" ? 2 : Math.min(d.sight, 7));
    if (b) {
      fight(s, e, b, dt);
      if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s.entities.some((a) => isAllied(s, a.side, e.side) && alive3(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance10(e, a) < 5))) useAbility(s, e);
    } else if (o.type === "attackMove" && movementOrder(s, e, o, dt, 0.65)) finishOrder(s, e);
    updateCharge(s, e, before, dt);
  }
  stepWorldActions(s);
  stepNeutralWorld(s, dt, neutralHooks(s));
  resolveProjectiles(s);
  resolveHits(s);
  updateBeacons(s);
  refreshFormations(s);
  for (const actor3 of s.entities) if (!alive3(actor3)) onEconomyDeath(s, actor3, economyHooks);
  s.corpses = s.corpses.filter((c) => c.expires > s.time);
  separateUnits(s);
  s.entities = s.entities.filter((e) => alive3(e) || e.animTime < 1.2);
  updatePopulation(s);
  pruneTeamAssignments(s);
  evaluateObjectives(s, { spawn: spawnEntity, command: issueCommand });
}
function pruneTeamAssignments(s) {
  const state = runtime(s).teamAI, live = new Map(s.entities.filter((e) => alive3(e) && e.kind === "unit" && e.role !== "worker" && !e.illusion).map((e) => [e.id, e]));
  for (const d of state.directives) if (d.status === "accepted" || d.status === "active") {
    d.assigned = d.assigned.filter((id5) => {
      const e = live.get(id5);
      return e?.side === d.recipient && !!d.destination && sameLevel2(e, d.destination);
    });
    if (!d.assigned.length) delete d.arrivedAt;
    if (s.time >= d.expiresAt || s.eliminated[d.issuer] || s.eliminated[d.recipient] || s.controllers[d.recipient] !== "ai") {
      d.status = "failed";
      d.assigned = [];
      d.reason = s.time >= d.expiresAt ? "Request expired." : "Ally is unavailable.";
    }
  }
  state.coordinator.reservations = state.coordinator.reservations.filter((r) => !s.eliminated[r.side] && r.expiresAt > s.time && (r.role === "expand" || r.ids.every((id5) => {
    const e = live.get(id5);
    return e?.side === r.side && sameLevel2(e, r.destination);
  })));
  state.coordinator.waves = state.coordinator.waves.flatMap((w) => {
    w.participants = w.participants.flatMap((p) => {
      const ids = p.ids.filter((id5) => {
        const e = live.get(id5);
        return e?.side === p.side && !s.eliminated[p.side] && sameLevel2(e, w.target);
      });
      return ids.length ? [{ side: p.side, ids }] : [];
    });
    return w.participants.length ? [w] : [];
  });
}
function aiRecruitDefinitions(s, side2) {
  const age = playerAge(s.players[side2]), available = availableUnits(s, side2);
  return Object.values(factionFor(s, side2).units).flatMap((def) => {
    const chosen = definitionAllowed(s, side2, def.id) ? def : available.find((candidate) => candidate.role === def.role && !candidate.tags?.includes("hero") && (candidate.age ?? 1) <= age && definitionAllowed(s, side2, candidate.id));
    return chosen && (chosen.age ?? 1) <= age ? [chosen] : [];
  });
}
function hasRecoverableAiIncome(s, side2, owned2 = s.entities.filter((e) => e.side === side2 && alive3(e))) {
  const scope = aiRecoveryScopes.get(s);
  if (!scope) return computeRecoverableAiIncome(s, side2, owned2);
  const p = s.players[side2];
  const key = JSON.stringify([p.wood, p.ore, p.crystal, p.population, p.cap, playerAge(p), s.nextId, owned2.map((e) => [e.id, e.role, e.hp, e.progress, e.queue, e.order, runtime(s).returning.has(e.id)]), s.entities.filter((e) => e.kind === "building" && (e.side === side2 || isVisible(s, side2, e.x, e.y, levelOf2(e)))).map((e) => [e.id, e.gateOpen])]);
  const cached = scope.get(side2);
  if (cached?.key === key) return cached.value;
  const value2 = computeRecoverableAiIncome(s, side2, owned2);
  scope.set(side2, { key, value: value2 });
  return value2;
}
function computeRecoverableAiIncome(s, side2, owned2) {
  const p = s.players[side2], f = factionFor(s, side2), age = playerAge(p), buildings2 = owned2.filter((e) => e.kind === "building");
  if (p.population < p.cap && buildings2.some((b) => b.role === "barracks" && b.progress === 1 && b.queue.some((role) => role !== "worker"))) return true;
  const barracks = buildings2.find((b) => b.role === "barracks"), factory = f.buildings.barracks, factoryCost = barracks ? { wood: 0, ore: 0, crystal: 0 } : factory.cost;
  if (!barracks && (buildingAgeRequired(factory) > age || !isNormalBuildingDefinition(factory))) return false;
  const definitions = aiRecruitDefinitions(s, side2), recruits = definitions.filter((d) => d.role !== "worker").map((d) => ({ ...d, cost: { wood: d.cost.wood + factoryCost.wood, ore: d.cost.ore + factoryCost.ore, crystal: d.cost.crystal + factoryCost.crystal } }));
  if (!recruits.length) return false;
  const kinds3 = ["wood", "ore", "crystal"], bank = { wood: p.wood, ore: p.ore, crystal: p.crystal };
  if (barracks?.progress === 1 && recruits.some((d) => kinds3.every((kind) => bank[kind] >= d.cost[kind]))) return true;
  const workers2 = owned2.filter((e) => e.kind === "unit" && e.role === "worker" && !e.illusion);
  if (workers2.length && recruits.some((d) => kinds3.every((kind) => bank[kind] >= d.cost[kind]))) return true;
  if (s.incomeFactors[side2] <= 0) return false;
  const nodes = s.resources.filter((n) => n.amount > 0 && isVisible(s, side2, n.x, n.y, levelOf2(n)));
  const depots = buildings2.filter((b) => b.progress === 1 && (b.role === "hq" || b.role === "depot"));
  if (!depots.length) return false;
  const cells = s.width * s.height, known2 = s.explored[side2];
  const view = {
    ...s,
    entities: s.entities.filter((e) => e.side === side2 || isVisible(s, side2, e.x, e.y, levelOf2(e))),
    resources: nodes,
    terrain: s.terrain.map((tile, index2) => known2.has(index2) ? tile : "grass"),
    world: s.world ? { ...s.world, levels: s.world.levels.map((level2) => ({ ...level2, terrain: level2.terrain.map((tile, index2) => known2.has(level2.id * cells + index2) ? tile : "grass"), elevation: level2.elevation.map((height, index2) => known2.has(level2.id * cells + index2) ? height : 0) })) } : void 0
  };
  const spawnPoint = (producer) => {
    const direction = side2 === 0 ? 1 : -1;
    for (let ring = radius(s, producer) + 1; ring <= radius(s, producer) + 6; ring += 0.5) for (const [dx, dy] of DIRECTIONS_24) {
      const point5 = { x: producer.x + dx * ring * direction, y: producer.y + dy * ring * direction, ...producer.level === void 0 ? {} : { level: producer.level } };
      if (walkable(view, point5.x, point5.y, levelOf2(point5))) return point5;
    }
    return void 0;
  };
  const hqs = buildings2.filter((b) => b.role === "hq" && b.progress === 1), worker = definitions.find((d) => d.role === "worker");
  const paid = hqs.filter((b) => b.queue.includes("worker") && p.population < p.cap).flatMap((b) => {
    const point5 = spawnPoint(b);
    return point5 ? [point5] : [];
  });
  const collectors = [...workers2, ...paid], budgets = collectors.length ? [{ collectors, bank }] : [];
  if (worker && p.population + reserved(s, side2) < p.cap && kinds3.every((kind) => bank[kind] >= worker.cost[kind])) {
    for (const producer of hqs.filter((b) => b.queue.length < 5)) {
      const point5 = spawnPoint(producer);
      if (point5) budgets.push({ collectors: [...collectors, point5], bank: { wood: bank.wood - worker.cost.wood, ore: bank.ore - worker.cost.ore, crystal: bank.crystal - worker.cost.crystal } });
    }
  }
  if (!budgets.length) return false;
  const delivery = (from) => {
    const depot2 = depots.filter((b) => sameLevel2(b, from)).sort((a, b) => distance10(from, a) - distance10(from, b))[0];
    if (!depot2) return false;
    const reach = radius(s, depot2) + 1, d = distance10(from, depot2);
    if (d <= reach) return true;
    const approach = { x: depot2.x + (from.x - depot2.x) / d * reach, y: depot2.y + (from.y - depot2.y) / d * reach, ...from.level === void 0 ? {} : { level: from.level } };
    return segmentWalkable(view, from, approach) || route(view, from, depot2, reach, side2).length > 0;
  };
  const cargo = { wood: 0, ore: 0, crystal: 0 };
  const harvestPoint = (from, node) => {
    if (!sameLevel2(from, node)) return void 0;
    const d = distance10(from, node);
    if (d <= 1.2 && walkable(view, from.x, from.y, levelOf2(from))) return from;
    const approach = { x: node.x + (from.x - node.x) / d * 1.1, y: node.y + (from.y - node.y) / d * 1.1, ...node.level === void 0 ? {} : { level: node.level } };
    if (segmentWalkable(view, from, approach)) return approach;
    const endpoint = route(view, from, node, 1.1, side2).at(-1);
    if (!endpoint) return void 0;
    if (distance10(endpoint, node) <= 1.2) return endpoint;
    return route(view, from, node, 1, side2).at(-1);
  };
  for (const worker2 of workers2) {
    if (worker2.carried <= 0 || !delivery(worker2)) continue;
    const gathering = worker2.order.type === "gather", available = worker2.order.type === "idle" || gathering;
    const current = gathering ? s.resources.find((node) => node.id === worker2.order.target && isVisible(s, side2, node.x, node.y, levelOf2(node))) : void 0;
    const returning = gathering && (runtime(s).returning.has(worker2.id) || worker2.carried >= 18 || !!current && (current.amount <= 0 || current.kind !== worker2.carriedKind));
    const trigger = available && nodes.some((node) => sameLevel2(node, worker2) && (node.kind !== worker2.carriedKind || (() => {
      const point5 = harvestPoint(worker2, node);
      return !!point5 && delivery(point5);
    })()));
    if (returning || trigger) cargo[worker2.carriedKind] += worker2.carried * s.incomeFactors[side2];
  }
  return budgets.some((budget) => {
    const obtainable = { wood: budget.bank.wood + cargo.wood, ore: budget.bank.ore + cargo.ore, crystal: budget.bank.crystal + cargo.crystal };
    for (const kind of kinds3) {
      const required = Math.max(...recruits.map((d) => d.cost[kind]));
      if (obtainable[kind] >= required) continue;
      for (const node of nodes.filter((n) => n.kind === kind)) {
        if (budget.collectors.some((worker2) => {
          const point5 = harvestPoint(worker2, node);
          return !!point5 && delivery(point5);
        })) obtainable[kind] += node.amount * s.incomeFactors[side2];
        if (obtainable[kind] >= required) break;
      }
    }
    return recruits.some((d) => kinds3.every((kind) => obtainable[kind] >= d.cost[kind]));
  });
}
function coordinatedAiTeam(s, side2) {
  return s.rules.mode === "annihilation" && hasRecoverableAiIncome(s, side2) && playerSides(s).filter((other) => s.controllers[other] === "ai" && !s.eliminated[other] && isAllied(s, side2, other) && hasRecoverableAiIncome(s, other)).length > 1;
}
function runTeamCoordination(s) {
  const rt = runtime(s), reports = [];
  for (const side2 of playerSides(s).filter((side3) => s.controllers[side3] === "ai" && !s.eliminated[side3])) {
    const owned2 = s.entities.filter((e) => e.side === side2 && alive3(e)), hq = owned2.find((e) => e.role === "hq" && e.progress === 1);
    if (!hq || !hasRecoverableAiIncome(s, side2, owned2)) continue;
    const requested = new Set(rt.teamAI.directives.filter((d) => d.recipient === side2 && (d.status === "accepted" || d.status === "active")).flatMap((d) => d.assigned));
    const army = owned2.filter((e) => e.kind === "unit" && e.role !== "worker" && !e.illusion && !rt.retreating[side2].has(e.id) && !requested.has(e.id) && e.entrenchedAt === void 0 && sameLevel2(e, hq));
    const seen = s.entities.filter((e) => alive3(e) && isHostile(s, side2, e.side) && isVisible(s, side2, e.x, e.y, levelOf2(e)));
    const enemies = playerSides(s).filter((other) => isHostile(s, side2, other) && !s.eliminated[other]);
    const targets = [...rt.knownEnemyBuildings[side2]].map(([id5, point5]) => ({ key: `entity:${id5}`, kind: point5.role === "hq" ? "hq" : "building", x: point5.x, y: point5.y, ...point5.level === void 0 ? {} : { level: point5.level }, observer: side2, seenAt: 0 }));
    for (const enemy2 of seen) targets.push({ key: `entity:${enemy2.id}`, kind: enemy2.kind === "building" ? enemy2.role === "hq" ? "hq" : "building" : "unit", x: enemy2.x, y: enemy2.y, ...enemy2.level === void 0 ? {} : { level: enemy2.level }, observer: side2, seenAt: s.time });
    for (const enemy2 of enemies) if (!rt.clearedEnemyStarts[side2].has(enemy2)) targets.push({ key: `start:${enemy2}`, kind: "start", ...s.starts[enemy2], observer: side2, seenAt: 0 });
    targets.splice(0, targets.length, ...targets.filter((target) => sameLevel2(target, hq)));
    if (!targets.length) {
      for (let y = 4.5; y < s.height - 3; y += 6) for (let x = 4.5; x < s.width - 3; x += 6) {
        const tile = fogKey(s, { x, y, level: levelOf2(hq) });
        if (!isVisible(s, side2, x, y, levelOf2(hq)) && !rt.searched[side2].has(tile)) targets.push({ key: `search:${tile}`, kind: "start", x, y, ...hq.level === void 0 ? {} : { level: hq.level }, observer: side2, seenAt: 0 });
      }
      targets.splice(0, targets.length, ...targets.filter((target) => sameLevel2(target, hq)));
      if (!targets.length) {
        rt.searched[side2].clear();
        const candidate = { x: Math.floor(s.width * 0.5) + 0.5, y: Math.floor(s.height * 0.5) + 0.5, ...hq.level === void 0 ? {} : { level: hq.level } };
        targets.push({ key: "search:middle", kind: "start", ...candidate, observer: side2, seenAt: 0 });
      }
    }
    const profile = aiProfile(s.aiConfigs[side2]), f = factionFor(s, side2), workers2 = owned2.filter((e) => e.role === "worker"), available = s.resources.filter((n) => n.amount > 300 && isVisible(s, side2, n.x, n.y, levelOf2(n)));
    const reservation = rt.teamAI.coordinator.reservations.find((r) => r.side === side2 && r.role === "scout");
    const reservedScout = reservation?.ids.length ? owned2.find((e) => e.id === reservation.ids[0]) : void 0;
    const scoutingNeeded = s.time > profile.scoutAt && (!rt.initialScoutDispatched[side2] || !!reservedScout && distance10(reservedScout, reservation.destination) > 2);
    const p = s.players[side2], config = s.aiConfigs[side2];
    const expansion = playerAge(p) >= 2 && workers2.length >= profile.expansionWorkers && owned2.filter((e) => e.role === "hq").length < 2 && p.wood >= (config.personality === "expand" ? 340 : 400) && p.ore >= (config.personality === "expand" ? 160 : 220) ? available.filter((n) => sameLevel2(n, hq) && distance10(n, hq) > 14 && !s.entities.some((b) => alive3(b) && isAllied(s, side2, b.side) && (b.side === side2 || isVisible(s, side2, b.x, b.y, levelOf2(b))) && (b.role === "hq" || b.role === "depot") && distance10(b, n) < 8)).sort((a, b) => distance10(a, hq) - distance10(b, hq))[0] : void 0;
    const waveReadyAt = rt.aiWave[side2] + Math.max(15, 65 / f.ai.aggression * profile.waveIntervalFactor);
    reports.push({
      side: side2,
      teamId: s.teams[side2],
      time: s.time,
      hq: { x: hq.x, y: hq.y, ...hq.level === void 0 ? {} : { level: hq.level } },
      fighters: army.map((e) => ({ id: e.id, role: e.role, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } })),
      threats: seen.filter((e) => distance10(e, hq) < 12).map((e) => ({ id: e.id, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } })),
      targets,
      readyToAttack: army.length >= 2,
      soloReadyToAttack: army.length >= Math.max(3, Math.ceil(f.ai.armySize * profile.attackSizeFactor)),
      soloAttackSize: Math.max(3, Math.ceil(f.ai.armySize * profile.attackSizeFactor)),
      waveReadyAt,
      scoutingNeeded,
      ...expansion ? { expansion: { x: expansion.x, y: expansion.y, ...expansion.level === void 0 ? {} : { level: expansion.level } } } : {}
    });
  }
  const plan = coordinateTeamAi(rt.teamAI.coordinator, reports, s.time);
  rt.teamAI.coordinator = plan.coordinator;
  for (const assignment of plan.assignments) {
    if (assignment.role === "attack" || assignment.role === "expand" || !assignment.ids.length) continue;
    const units = s.entities.filter((e) => e.side === assignment.side && alive3(e) && assignment.ids.includes(e.id));
    const type = assignment.role === "defend" ? "attackMove" : "move";
    if (units.some((e) => e.order.type !== type || distance10(e.order, assignment.destination) > Math.max(1.5, Math.sqrt(units.length)))) {
      if (issueCommand(s, assignment.side, { type, ids: units.map((e) => e.id), ...assignment.destination }) && assignment.role === "scout") {
        for (const member of reports.filter((r) => r.teamId === s.teams[assignment.side])) rt.initialScoutDispatched[member.side] = true;
      }
    }
  }
  for (const launch of plan.launches) if (issueCommand(s, launch.side, { type: "attackMove", ids: launch.ids, ...launch.destination })) {
    rt.aiWave[launch.side] = s.time;
    if (plan.assignments.some((a) => a.waveId === launch.waveId && a.targetKey?.startsWith("search:"))) rt.searched[launch.side].add(fogKey(s, launch.destination));
  }
}
function runAI(s, side2 = 1) {
  if (isGameOver(s) || !s.players[side2] || s.eliminated[side2]) return;
  const owned2 = s.entities.filter((e) => e.side === side2 && alive3(e)), workers2 = owned2.filter((e) => e.kind === "unit" && e.role === "worker" && !economyUnitDefinition(s, e)), buildings2 = owned2.filter((e) => e.kind === "building"), hq = buildings2.find((e) => e.role === "hq");
  if (!hq) return;
  const f = factionFor(s, side2), p = s.players[side2], age = playerAge(p), config = s.aiConfigs[side2], profile = aiProfile(config), rt = runtime(s);
  if (skipsAiDecision(config, ++rt.aiDecisionTurns[side2])) {
    emit(s, "message", hq, void 0, "Easy commander hesitates before issuing orders.");
    return;
  }
  const available = s.resources.filter((n) => n.amount > 0 && isVisible(s, side2, n.x, n.y, levelOf2(n)));
  const wantCrystal = (config.opening === "tower-defense" || buildings2.some((b) => b.role === "barracks")) && available.some((n) => n.kind === "crystal") ? p.crystal < 40 ? 2 : p.crystal < 100 ? 1 : 0 : 0;
  const desired = { wood: Math.max(1, Math.ceil((workers2.length - wantCrystal) * 0.6)), ore: Math.max(1, workers2.length - wantCrystal - Math.ceil((workers2.length - wantCrystal) * 0.6)), crystal: wantCrystal };
  const assigned = { wood: 0, ore: 0, crystal: 0 };
  for (const worker of workers2) {
    if (worker.order.type === "gather") {
      const n = s.resources.find((n2) => n2.id === worker.order.target);
      if (n && n.amount > 0) assigned[n.kind]++;
    }
  }
  for (const worker of workers2.filter((e) => e.order.type === "idle" || e.order.type === "gather")) {
    const current = worker.order.type === "gather" ? s.resources.find((n) => n.id === worker.order.target) : void 0;
    if (current && current.amount > 0 && assigned[current.kind] <= desired[current.kind]) continue;
    const kinds3 = ["wood", "ore", "crystal"].filter((k) => available.some((n) => n.kind === k)).sort((a, b) => desired[b] - assigned[b] - (desired[a] - assigned[a]));
    const kind = kinds3[0];
    if (!kind) continue;
    const node = available.filter((n) => n.kind === kind).sort((a, b) => distance10(worker, a) - distance10(worker, b))[0];
    if (node && issueCommand(s, side2, { type: "gather", ids: [worker.id], target: node.id })) {
      if (current) assigned[current.kind]--;
      assigned[kind]++;
    }
  }
  for (const site of buildings2.filter((b) => b.progress < 1)) {
    if (workers2.some((w) => w.order.type === "build" && w.order.target === site.id)) continue;
    const builder = workers2.filter((w) => w.order.type === "idle" || w.order.type === "gather").sort((a, b) => distance10(a, site) - distance10(b, site))[0];
    if (builder) issueCommand(s, side2, { type: "repair", ids: [builder.id], target: site.id });
  }
  const recruitDefinitions = aiRecruitDefinitions(s, side2), workerDefinition = recruitDefinitions.find((d) => d.role === "worker");
  if (workerDefinition && workers2.length + hq.queue.filter((r) => r === "worker").length < (age === 1 ? profile.workerTarget : age === 2 ? profile.workerTarget + 6 : profile.workerTarget + 11) && hq.queue.length < profile.trainingQueue) issueCommand(s, side2, { type: "train", id: hq.id, role: "worker", ...workerDefinition.id === f.units.worker.id ? {} : { definitionId: workerDefinition.id } });
  const researchPlan = config.opening === "cavalry-raids" ? ["town-age", "worker-harvest", "worker-speed", "citadel-age"] : ["worker-harvest", "worker-speed", "town-age", "citadel-age"];
  if (hq.progress === 1 && !hq.research && workers2.length >= 7 && (config.personality !== "rush" || s.time > 100)) for (const id5 of researchPlan) {
    const u = UPGRADES[id5];
    if (u.building === "hq" && !researchRequirement(s, side2, id5) && p.wood >= u.cost.wood + 120 && p.ore >= u.cost.ore + 80 && p.crystal >= u.cost.crystal) {
      issueCommand(s, side2, { type: "research", id: hq.id, upgrade: id5 });
      break;
    }
  }
  if (age >= 2 && workers2.length >= profile.expansionWorkers && buildings2.filter((b) => b.role === "hq").length < 2 && !workers2.some((w) => w.order.type === "build") && p.wood >= (config.personality === "expand" ? 340 : 400) && p.ore >= (config.personality === "expand" ? 160 : 220) && (!coordinatedAiTeam(s, side2) || rt.teamAI.coordinator.reservations.some((r) => r.side === side2 && r.role === "expand"))) {
    const deposit = available.filter((n) => n.amount > 300 && distance10(n, hq) > 14 && !s.entities.some((b) => alive3(b) && isAllied(s, side2, b.side) && (b.side === side2 || isVisible(s, side2, b.x, b.y)) && (b.role === "hq" || b.role === "depot" && b.definitionId !== TROPHY_STANDARD.id) && distance10(b, n) < 8)).sort((a, b) => distance10(a, hq) - distance10(b, hq))[0];
    if (deposit) {
      const builder = workers2.filter((w) => w.order.type === "gather" || w.order.type === "idle").sort((a, b) => distance10(a, deposit) - distance10(b, deposit))[0];
      if (builder) {
        let placed = false;
        for (let r = 4; r <= 7 && !placed; r++) for (let i = 0; i < 24 && !placed; i += 2) {
          const [dx, dy] = DIRECTIONS_24[i], x = Math.floor(deposit.x + dx * r) + 0.5, y = Math.floor(deposit.y + dy * r) + 0.5;
          if (canPlace(s, side2, "hq", x, y)) placed = issueCommand(s, side2, { type: "build", ids: [builder.id], role: "hq", x, y });
        }
      }
    }
  }
  const queued = reserved(s, side2);
  let buildRole = openingBuilding(config, buildings2.map((b) => b.role));
  if (!buildRole) {
    if (p.cap - p.population - queued < 5 && p.cap < s.populationLimits[side2] && !buildings2.some((b) => b.role === "depot" && b.progress < 1)) buildRole = "depot";
    else if (s.time > 100 && !buildings2.some((b) => b.role === "tower")) buildRole = "tower";
    else if (s.time > 180 && buildings2.filter((b) => b.role === "barracks").length < (age === 3 && p.wood > 700 && p.ore > 300 ? 5 : (age >= 2 || s.time > 420) && p.wood > 400 ? 3 : 2)) buildRole = "barracks";
  }
  if (buildRole && !workers2.some((e) => e.order.type === "build")) {
    const builder = workers2[0];
    if (builder) {
      const dir2 = s.starts[side2].y < s.height / 2 ? 1 : -1;
      let placed = false;
      for (let r = 5; r <= 10 && !placed; r += 2) for (let i = 0; i < 32 && !placed; i += 2) {
        const [dx, dy] = DIRECTIONS_32[i], x = hq.x + Math.round(dx * r) * dir2, y = hq.y + Math.round(dy * r) * dir2;
        if (canPlace(s, side2, buildRole, x, y)) placed = issueCommand(s, side2, { type: "build", ids: [builder.id], role: buildRole, x, y });
      }
    }
  }
  if (age >= 2 && p.wood > 220 && p.ore > 160 && !workers2.some((w) => w.order.type === "build")) {
    const tower = buildings2.find((b) => b.role === "tower" && b.progress === 1), builder = workers2.find((w) => w.order.type === "gather" || w.order.type === "idle");
    if (tower && builder) {
      const dir2 = s.starts[side2].y < s.height / 2 ? 1 : -1;
      const slots = [["gate", 0, 3.5], ["wall", -1.5, 3.5], ["wall", 1.5, 3.5], ["wall", -2.5, 3.5], ["wall", 2.5, 3.5]];
      for (const [role, dx, dy] of slots) {
        const x = tower.x + dx * dir2, y = tower.y + dy * dir2;
        if (buildings2.some((b) => length2D(b.x - x, b.y - y) < 0.4)) continue;
        if (canPlace(s, side2, role, x, y) && issueCommand(s, side2, { type: "build", ids: [builder.id], role, x, y })) break;
      }
    }
  }
  for (const gate of buildings2.filter((b) => b.role === "gate" && b.progress === 1)) {
    const danger = s.entities.some((e) => isHostile(s, e.side, side2) && alive3(e) && isVisible(s, side2, e.x, e.y, levelOf2(e)) && distance10(e, gate) < 9);
    if (!!gate.gateOpen === danger) issueCommand(s, side2, { type: "toggleGate", ids: [gate.id] });
  }
  const army = owned2.filter((e) => e.kind === "unit" && e.role !== "worker" && !e.illusion);
  const visibleEnemy = s.entities.filter((e) => isHostile(s, e.side, side2) && alive3(e) && e.kind === "unit" && isVisible(s, side2, e.x, e.y, levelOf2(e)));
  const planned = [...army.filter((e) => !e.raised).map((e) => e.role), ...buildings2.flatMap((e) => e.queue).filter((r) => r !== "worker")];
  rememberObservedUnits(rt.knownEnemyUnits[side2], visibleEnemy, s.time);
  const weights = counterWeights(f, config, rt.knownEnemyUnits[side2].values());
  const roles3 = recruitDefinitions.filter((d) => d.role !== "worker").map((d) => d.role);
  for (const b of buildings2.filter((e) => e.role === "barracks" && e.progress === 1)) {
    if (age >= 2 && !b.research && army.length >= 5) for (const id5 of ["forged-weapons", "tempered-armor", "veteran-arms"]) {
      const d = UPGRADES[id5];
      if (!researchRequirement(s, side2, id5) && p.wood > d.cost.wood + 180 && p.ore > d.cost.ore + 120) {
        issueCommand(s, side2, { type: "research", id: b.id, upgrade: id5 });
        break;
      }
    }
    if (b.queue.length >= profile.trainingQueue) continue;
    const commander3 = availableUnits(s, side2).find((d) => d.tags?.includes("hero"));
    if (commander3 && age >= 2 && army.length >= 5 && !heroRecruitmentReason(s, side2, commander3.id) && p.wood > commander3.cost.wood + 220 && p.ore > commander3.cost.ore + 160 && p.crystal >= commander3.cost.crystal && issueCommand(s, side2, { type: "train", id: b.id, role: commander3.role, definitionId: commander3.id })) continue;
    const nextAge = age === 1 ? "town-age" : age === 2 ? "citadel-age" : void 0;
    if (nextAge && army.length >= 7 && !hq.research && s.time > (age === 1 ? 150 : 380) && !visibleEnemy.some((e) => distance10(e, hq) < 14) && p.wood < UPGRADES[nextAge].cost.wood + 120) continue;
    const role = chooseAiRecruit(roles3, planned, weights);
    if (!role) continue;
    const definition2 = recruitDefinitions.find((d) => d.role === role);
    if (issueCommand(s, side2, { type: "train", id: b.id, role, ...definition2.id === f.units[role].id ? {} : { definitionId: definition2.id } })) planned.push(role);
  }
  const incomeRecoverable = hasRecoverableAiIncome(s, side2);
  for (const unit5 of army.filter((e) => unitDef(s, e).ability === "entrench")) {
    const target = enemy(s, unit5, unitDef(s, unit5).range + (unit5.role === "special" ? 3 : 0), true);
    if (target && unit5.entrenchedAt === void 0) issueCommand(s, side2, { type: "ability", ids: [unit5.id] });
    else if (!target && unit5.entrenchedAt !== void 0) issueCommand(s, side2, { type: "ability", ids: [unit5.id] });
  }
  const seen = s.entities.filter((e) => isHostile(s, e.side, side2) && alive3(e) && isVisible(s, side2, e.x, e.y, levelOf2(e)));
  const threat = seen.find((e) => distance10(e, hq) < 12);
  const remembered = rt.knownEnemyBuildings[side2];
  for (const [id5, point5] of remembered) if (isVisible(s, side2, point5.x, point5.y, levelOf2(point5)) && !seen.some((e) => e.id === id5)) remembered.delete(id5);
  for (const e of seen) if (e.kind === "building") remembered.set(e.id, { x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, role: e.role });
  const enemySides = playerSides(s).filter((other) => isHostile(s, side2, other) && !s.eliminated[other]);
  const enemySide = enemySides.sort((a, b) => distance10(hq, s.starts[a]) - distance10(hq, s.starts[b]))[0];
  if (enemySide === void 0) return;
  const enemyStart = s.starts[enemySide];
  const forward = { x: hq.x + (enemyStart.x - hq.x) * 0.12, y: hq.y + (enemyStart.y - hq.y) * 0.12 };
  const rally = commandDestination(s, side2, forward, hq) ?? { x: hq.x + 4, y: hq.y };
  for (const producer of buildings2.filter((e) => e.role === "barracks" && e.progress === 1 && !e.rally)) issueCommand(s, side2, { type: "setRally", ids: [producer.id], ...rally });
  const retreats = rt.retreating[side2];
  for (const [id5, record6] of retreats) {
    const soldier = army.find((e) => e.id === id5);
    if (!soldier) {
      retreats.delete(id5);
      continue;
    }
    if (s.time >= record6.until && (!incomeRecoverable || rt.producedFighters[side2] > record6.produced && distance10(soldier, rally) < 9 && army.some((reinforcement) => !reinforcement.raised && reinforcement.id > record6.afterId && distance10(reinforcement, rally) < 6 && !retreats.has(reinforcement.id)))) retreats.delete(id5);
  }
  for (const soldier of army) {
    if (!incomeRecoverable || retreats.has(soldier.id) || distance10(soldier, hq) < 9) continue;
    const enemies = seen.filter((e) => (e.kind === "unit" && e.role !== "worker" || e.role === "tower") && distance10(e, soldier) < 7);
    const allies2 = army.filter((e) => distance10(e, soldier) < 7 && !retreats.has(e.id));
    if (shouldRetreat(config, soldier, allies2, enemies) && issueCommand(s, side2, { type: "move", ids: [soldier.id], ...rally })) {
      retreats.set(soldier.id, { until: s.time + profile.regroupSeconds, produced: rt.producedFighters[side2], afterId: s.nextId - 1 });
      emit(s, "message", soldier, void 0, "Retreating to rally with reinforcements.");
    }
  }
  const tacticalArmy = army.filter((e) => !retreats.has(e.id));
  const directiveIds = processAllyDirectives(s, side2, rt.teamAI, tacticalArmy.filter((e) => e.entrenchedAt === void 0), !!threat, (viewer, x, y, level2) => isVisible(s, viewer, x, y, level2), (owner, command) => issueCommand(s, owner, command));
  const readyArmy = tacticalArmy.filter((e) => !directiveIds.has(e.id));
  if (isVisible(s, side2, enemyStart.x, enemyStart.y, levelOf2(enemyStart)) && !seen.some((e) => e.role === "hq" && distance10(e, enemyStart) < 4)) rt.clearedEnemyStarts[side2].add(enemySide);
  rt.enemyStartCleared[side2] = rt.clearedEnemyStarts[side2].has(enemySide);
  if (coordinatedAiTeam(s, side2) && incomeRecoverable) {
    if (threat) {
      const defenders = tacticalArmy.filter((e) => e.order.type !== "attack" && e.entrenchedAt === void 0);
      if (defenders.length) issueCommand(s, side2, { type: "attackMove", ids: defenders.map((e) => e.id), x: threat.x, y: threat.y, ...threat.level === void 0 ? {} : { level: threat.level } });
    }
    return;
  }
  if (incomeRecoverable && age >= 2 && (s.mapSize === "large" || s.mapSize === "huge") && !rt.expansionScoutDispatched[side2] && readyArmy.length >= 3) {
    const scout = readyArmy.find((e) => e.role === "cavalry") ?? readyArmy.find((e) => e.role === "melee");
    const x = Math.floor(s.width * 0.23) + 0.5, y = Math.floor(s.height * 0.58) + 0.5;
    if (scout && issueCommand(s, side2, { type: "move", ids: [scout.id], x: s.starts[side2].x < s.width / 2 ? x : s.width - x, y: s.starts[side2].y < s.height / 2 ? y : s.height - y })) {
      rt.expansionScout[side2] = scout.id;
      rt.expansionScoutDispatched[side2] = true;
    }
  }
  if (rt.expansionScout[side2] !== null && !army.some((e) => e.id === rt.expansionScout[side2] && e.order.type === "move")) rt.expansionScout[side2] = null;
  if (threat) {
    const ready = tacticalArmy.filter((e) => e.order.type !== "attack" && e.entrenchedAt === void 0);
    if (ready.length) issueCommand(s, side2, { type: "attackMove", ids: ready.map((e) => e.id), x: threat.x, y: threat.y });
  } else if (readyArmy.length >= (incomeRecoverable ? Math.max(3, Math.ceil(f.ai.armySize * profile.attackSizeFactor)) : 1) && s.time - rt.aiWave[side2] > Math.max(15, 65 / f.ai.aggression * profile.waveIntervalFactor)) {
    const raidTarget = config.personality === "raid" ? seen.find((e) => e.role === "worker") ?? seen.find((e) => e.role === "depot") : void 0;
    const target = raidTarget ?? seen.find((e) => e.kind === "building" && e.role === "hq") ?? [...remembered.values()].find((e) => e.role === "hq") ?? seen[0] ?? [...remembered.values()][0];
    let destination = target ?? enemyStart;
    if (!target && rt.enemyStartCleared[side2]) {
      const origin = readyArmy[0], candidates = [];
      for (let y = 4.5; y < s.height - 3; y += 6) for (let x = 4.5; x < s.width - 3; x += 6) if (!isVisible(s, side2, x, y) && !rt.searched[side2].has(Math.floor(y) * s.width + Math.floor(x))) candidates.push({ x, y });
      if (candidates.length) {
        destination = candidates.sort((a, b) => distance10(origin, a) - distance10(origin, b))[0];
        rt.searched[side2].add(Math.floor(destination.y) * s.width + Math.floor(destination.x));
      } else rt.searched[side2].clear();
    }
    issueCommand(s, side2, { type: "attackMove", ids: readyArmy.filter((e) => e.entrenchedAt === void 0 && (!incomeRecoverable || e.id !== rt.expansionScout[side2])).map((e) => e.id), x: destination.x, y: destination.y });
    rt.aiWave[side2] = s.time;
  } else if (!rt.initialScoutDispatched[side2] && s.time > profile.scoutAt && readyArmy.length && readyArmy.every((e) => e.order.type === "idle")) {
    const scout = readyArmy[0];
    if (issueCommand(s, side2, { type: "attackMove", ids: [scout.id], x: hq.x + (enemyStart.x - hq.x) * 0.7, y: hq.y + (enemyStart.y - hq.y) * 0.7 })) rt.initialScoutDispatched[side2] = true;
  }
  runSpecialistAI(s, side2, (c) => issueCommand(s, side2, c));
}
function applyScenarioDamage(s, source2, target, amount, options = {}) {
  if (isGameOver(s) || !Number.isFinite(amount) || amount <= 0 || amount > 1e9 || !s.entities.includes(source2) || !s.entities.includes(target) || source2.hp <= 0 || target.hp <= 0 || !sameLevel2(source2, target)) return false;
  const rt = runtime(s), before = rt.hits.length;
  specialistHooks(s).damage(source2, target, amount, { armorPiercing: options.armorPiercing });
  if (rt.hits.length === before) return false;
  if (options.text) rt.hits.at(-1).event.text = options.text;
  resolveHits(s);
  return true;
}
function spawnDefinition(s, side2, kind, definitionId2, x, y, progress = 1, level2) {
  const d = kind === "unit" ? availableUnits(s, side2).find((d2) => d2.id === definitionId2) : availableBuildings(s, side2).find((d2) => d2.id === definitionId2);
  if (!d) throw new Error("Definition is absent from player content.");
  return spawnEntity(s, side2, kind, d.role, x, y, progress, definitionId2, level2 ?? 0);
}
function specialistHooks(s) {
  return { interrupt: (actor3) => interruptWorldOrder(s, actor3), recordPaid: (actor3, cost5) => recordEconomyPaid(s, actor3, cost5), die: (actor3, text3) => die(s, actor3, text3), spawn: (...args) => spawnDefinition(s, ...args), setTerrain: (point5, kind) => setWorldTerrain(s, point5, kind), impactTargets: () => combatTargets(s), targetDistance: (at2, target) => targetDistance(s, at2, target), ignite: (point5, source2) => {
    igniteWorldAt(s, point5, source2);
  }, damage: (source2, target, raw, options) => {
    if (target.hp <= 0) return;
    queueWeaponHit(s, source2, target, raw, !!options?.ranged, false, !!options?.armorPiercing, !!options?.ranged);
  } };
}
var economyHooks = { visible: (s, side2, p) => isVisible(s, side2, p.x, p.y, p.level ?? 0), allied: isAllied, spawn: spawnEntity, die, assign: interruptWorldOrder, invalidateNavigation, move, canPlace: (s, side2, x, y, level2) => canPlace(s, side2, "depot", x, y, "economy:warehouse", level2), radius, buildingDef, unitDef };

// src/core/saves.ts
var SAVE_VERSION = 4;
var MAX_SAVE_BYTES = 16 * 1024 * 1024;
var MAX_ID2 = 2147483647;
var MAX_VALUE = 1e12;
var MAX_PLAYERS = 8;
var MAX_ENTITIES = 8192;
var MAX_RESOURCES = 8192;
var STATE_FIELDS = ["controllers", "mapSize", "mapVersion", "terrain", "starts", "draw", "tick", "corpses", "time", "seed", "width", "height", "entities", "resources", "players", "winner", "events", "explored", "visible", "nextId"];
var TEAM_FIELDS = ["teams", "incomeFactors", "populationLimits", "sharedVision", "eliminated", "winningTeam"];
var UNIT_ROLES = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var BUILDING_ROLES = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var RESOURCE_KINDS2 = ["wood", "ore", "crystal"];
function bad2(path, detail) {
  throw new Error(`Invalid save at ${path}: ${detail}.`);
}
function object2(value2, path, required, optional = []) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) bad2(path, "expected an object");
  const record6 = value2;
  for (const key of required) if (!Object.hasOwn(record6, key)) bad2(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record6)) if (!required.includes(key) && !optional.includes(key)) bad2(`${path}.${key}`, "unknown field");
  return record6;
}
function number2(value2, path, min = 0, max = MAX_VALUE, integer2 = false) {
  if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < min || value2 > max || integer2 && !Number.isSafeInteger(value2)) bad2(path, `expected ${integer2 ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value2;
}
function flag2(value2, path) {
  if (typeof value2 !== "boolean") bad2(path, "expected a boolean");
  return value2;
}
function choice2(value2, path, choices) {
  if (typeof value2 !== "string" || !choices.includes(value2)) bad2(path, "unknown value");
  return value2;
}
function list2(value2, path, max, length2) {
  if (!Array.isArray(value2) || value2.length > max || length2 !== void 0 && value2.length !== length2) bad2(path, "invalid array length");
  return value2;
}
function optionalNumber(record6, key, path, min = 0, max = MAX_VALUE, integer2 = false) {
  if (record6[key] !== void 0) number2(record6[key], `${path}.${key}`, min, max, integer2);
}
function optionalFlag(record6, key, path) {
  if (record6[key] !== void 0) flag2(record6[key], `${path}.${key}`);
}
function id3(value2, path, c) {
  return number2(value2, path, 1, c.nextId - 1, true);
}
function point3(value2, path, c) {
  const p = object2(value2, path, ["x", "y"], ["level"]);
  number2(p.x, `${path}.x`, 0, c.width);
  number2(p.y, `${path}.y`, 0, c.height);
  optionalNumber(p, "level", path, 0, c.levels - 1, true);
}
function coordinates(value2, path, c) {
  number2(value2.x, `${path}.x`, 0, c.width);
  number2(value2.y, `${path}.y`, 0, c.height);
  optionalNumber(value2, "level", path, 0, c.levels - 1, true);
}
function order(value2, path, c) {
  const o = object2(value2, path, ["type"], ["x", "y", "target", "transition", "level"]);
  choice2(o.type, `${path}.type`, ["idle", "hold", "move", "attackMove", "attack", "gather", "build", "traverse", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"]);
  if (o.type === "move" || o.type === "attackMove") {
    object2(value2, path, ["type", "x", "y"], ["level"]);
    coordinates(o, path, c);
  } else if (["attack", "gather", "build", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"].includes(o.type)) {
    object2(value2, path, ["type", "target"]);
    id3(o.target, `${path}.target`, c);
  } else if (o.type === "traverse") {
    object2(value2, path, ["type", "transition"]);
    number2(o.transition, `${path}.transition`, 1, 2147483647, true);
  } else object2(value2, path, ["type"]);
}
function uniqueIds(values, path, max) {
  const result = /* @__PURE__ */ new Set();
  values.forEach((v, i) => {
    const n = number2(v, `${path}[${i}]`, 0, max, true);
    if (result.has(n)) bad2(path, "duplicate value");
    result.add(n);
  });
  return result;
}
function fog(value2, path, c) {
  return list2(value2, path, c.playerCount, c.playerCount).map((v, i) => uniqueIds(list2(v, `${path}[${i}]`, c.cells), `${path}[${i}]`, c.cells - 1));
}
function validateEntity(value2, path, c) {
  const e = object2(value2, path, ["id", "side", "kind", "role", "x", "y", "hp", "maxHp", "order", "cooldown", "progress", "queue", "trainProgress", "researchProgress", "facing", "animation", "animTime", "momentum", "illusion", "expires", "carried", "carriedKind", "path"], ["tactics", "factionState", "level", "definitionId", "definitionFaction", "queueDefinitionIds", "queuePaidCosts", "orderQueue", "research", "researchPaidCost", "rally", "gateOpen", "lastAttacker", "abilityReadyAt", "entrenchedAt", "raised", "shield", "maxShield", "lastDamagedAt", "surgeUntil", "veteran", "equipment", "specialistBuffs", "siegeMode", "burning", "beacon"]);
  const entityId = id3(e.id, `${path}.id`, c);
  if (c.entityIds.has(entityId)) bad2(`${path}.id`, "duplicate entity or resource id");
  c.entityIds.add(entityId);
  c.entities.set(entityId, e);
  number2(e.side, `${path}.side`, 0, c.playerCount - 1, true);
  choice2(e.kind, `${path}.kind`, ["unit", "building"]);
  choice2(e.role, `${path}.role`, e.kind === "unit" ? UNIT_ROLES : BUILDING_ROLES);
  coordinates(e, path, c);
  const maxHp = number2(e.maxHp, `${path}.maxHp`, Number.MIN_VALUE, 1e9);
  number2(e.hp, `${path}.hp`, 0, maxHp);
  order(e.order, `${path}.order`, c);
  for (const key of ["cooldown", "animTime", "expires"]) number2(e[key], `${path}.${key}`);
  for (const key of ["progress", "trainProgress"]) number2(e[key], `${path}.${key}`, 0, 1);
  number2(e.researchProgress, `${path}.researchProgress`, 0, 2);
  number2(e.facing, `${path}.facing`, 0, 7, true);
  choice2(e.animation, `${path}.animation`, ["idle", "walk", "attack", "death"]);
  number2(e.momentum, `${path}.momentum`, 0, 1);
  flag2(e.illusion, `${path}.illusion`);
  number2(e.carried, `${path}.carried`, 0, 18);
  choice2(e.carriedKind, `${path}.carriedKind`, RESOURCE_KINDS2);
  if (e.definitionFaction !== void 0) {
    choice2(e.definitionFaction, `${path}.definitionFaction`, Object.keys(contentFactions(c.state.content)));
    if (!c.state.players.some((player) => player.faction === e.definitionFaction) || e.kind !== "unit" || !e.illusion && e.raised !== true && e.role !== "siege" && (e.role === "worker" || e.tactics?.surrenderedTo !== e.side)) bad2(`${path}.definitionFaction`, "original faction requires a captured engine, surrendered combat troop or admitted summon from a match faction");
  }
  if (e.definitionId !== void 0) {
    if (typeof e.definitionId !== "string" || e.definitionId.length > 100) bad2(`${path}.definitionId`, "invalid ID");
    try {
      entityDefinition(c.state, e);
    } catch {
      bad2(`${path}.definitionId`, "definition is absent from the pinned faction or has another role");
    }
  }
  if (e.definitionFaction !== void 0 && !e.illusion && e.maxHp !== entityDefinition(c.state, e).hp) bad2(`${path}.maxHp`, "captured troop health capacity differs from its original definition");
  const queue = list2(e.queue, `${path}.queue`, 5);
  queue.forEach((role, i) => {
    choice2(role, `${path}.queue[${i}]`, UNIT_ROLES);
    if (e.kind !== "building" || e.role !== "hq" && e.role !== "barracks" || e.role === "hq" && role !== "worker" || e.role === "barracks" && role === "worker") bad2(`${path}.queue`, "invalid producer or recruit");
  });
  if (e.queueDefinitionIds !== void 0) {
    list2(e.queueDefinitionIds, `${path}.queueDefinitionIds`, 5, queue.length).forEach((id5, i) => {
      const def = availableUnits(c.state, e.side).find((d) => d.id === id5);
      if (!def || def.role !== queue[i]) bad2(`${path}.queueDefinitionIds[${i}]`, "definition is absent from the pinned faction or has another role");
    });
  } else if (c.state.content && queue.length) bad2(`${path}.queueDefinitionIds`, "pinned production requires definition IDs");
  if (e.queuePaidCosts !== void 0) {
    list2(e.queuePaidCosts, `${path}.queuePaidCosts`, 5, queue.length).forEach((value3, i) => {
      const paid = object2(value3, `${path}.queuePaidCosts[${i}]`, ["wood", "ore", "crystal"]);
      for (const key of RESOURCE_KINDS2) number2(paid[key], `${path}.queuePaidCosts[${i}].${key}`, 0, 1e5);
      const expected = availableUnits(c.state, e.side).find((d) => d.id === e.queueDefinitionIds?.[i])?.cost;
      if (!expected || RESOURCE_KINDS2.some((key) => paid[key] !== expected[key])) bad2(`${path}.queuePaidCosts[${i}]`, "paid cost differs from pinned definition");
    });
  } else if (c.state.content && queue.length) bad2(`${path}.queuePaidCosts`, "pinned production requires charged cost records");
  list2(e.path, `${path}.path`, c.cells * 16).forEach((p, i) => point3(p, `${path}.path[${i}]`, c));
  if (e.orderQueue !== void 0) {
    if (e.kind !== "unit" || e.illusion) bad2(`${path}.orderQueue`, "only real units can queue orders");
    list2(e.orderQueue, `${path}.orderQueue`, MAX_ORDER_QUEUE).forEach((o, i) => order(o, `${path}.orderQueue[${i}]`, c));
  }
  if (e.research !== void 0) {
    const upgrades = upgradesFor(c.state, e.side);
    choice2(e.research, `${path}.research`, Object.keys(upgrades));
    if (e.kind !== "building" || upgrades[e.research].building !== e.role) bad2(`${path}.research`, "wrong research building");
  }
  if (e.research !== void 0 && upgradesFor(c.state, e.side)[e.research].exclusiveGroup && e.researchPaidCost === void 0) bad2(`${path}.researchPaidCost`, "exclusive research requires the original charged cost");
  if (e.researchPaidCost !== void 0) {
    if (e.research === void 0) bad2(`${path}.researchPaidCost`, "charged research cost requires pending research");
    const paid = object2(e.researchPaidCost, `${path}.researchPaidCost`, ["wood", "ore", "crystal"]), expected = upgradesFor(c.state, e.side)[e.research].cost;
    for (const key of RESOURCE_KINDS2) {
      number2(paid[key], `${path}.researchPaidCost.${key}`, 0, 1e5);
      if (paid[key] !== expected[key]) bad2(`${path}.researchPaidCost`, "charged cost differs from pinned research");
    }
  }
  if (e.rally !== void 0) point3(e.rally, `${path}.rally`, c);
  for (const key of ["gateOpen", "raised"]) optionalFlag(e, key, path);
  if (e.raised === true) {
    const original = contentFactions(c.state.content)[e.definitionFaction ?? c.state.players[e.side].faction], definition2 = entityDefinition(c.state, e);
    const healthFactor = e.illusion ? 0.4 : 1, lifetime = e.illusion ? 15 : 35;
    if (e.kind !== "unit" || e.role !== "melee" || c.version === 4 && !(original.unitDefinitions ?? Object.values(original.units)).some((d) => d.ability === "raise") || !(original.unitDefinitions ?? Object.values(original.units)).some((d) => d.role === "melee" && d.id === definition2.id) || e.maxHp !== definition2.hp * healthFactor || e.expires <= 0 || e.expires > c.time + lifetime + 1e-8) bad2(`${path}.raised`, "raised troops require an admitted raising faction melee definition and their summon lifetime");
  }
  if (e.lastAttacker !== void 0) id3(e.lastAttacker, `${path}.lastAttacker`, c);
  for (const key of ["abilityReadyAt", "entrenchedAt", "lastDamagedAt", "surgeUntil", "shield", "maxShield"]) optionalNumber(e, key, path);
  if (e.factionState !== void 0) validateFactionUnit(e.factionState, `${path}.factionState`, c, e);
  if (e.tactics !== void 0) validateTactics(e.tactics, `${path}.tactics`, c, e);
  if (e.shield !== void 0 && e.shield > (e.maxShield ?? 0)) bad2(`${path}.shield`, "shield exceeds capacity");
  if (e.maxShield !== void 0) {
    const capacity = e.kind === "unit" ? entityDefinition(c.state, e).shield : e.factionState?.power ? 80 : void 0;
    if (capacity === void 0 || e.maxShield !== capacity) bad2(`${path}.maxShield`, "shield capacity differs from admitted definition or power network");
  }
}
function validateBody(value2, path, c) {
  const body = object2(value2, path, ["id", "x", "y", "expires"], ["level"]);
  id3(body.id, `${path}.id`, c);
  coordinates(body, path, c);
  number2(body.expires, `${path}.expires`);
  if (body.level !== void 0) number2(body.level, `${path}.level`, 0, c.levels - 1, true);
}
function validatePowerConnections(c) {
  const groups = /* @__PURE__ */ new Map(), components = /* @__PURE__ */ new Map();
  for (const e of c.entities.values()) {
    const power = e.factionState?.power;
    if (e.kind === "building" && e.progress === 1 && power?.connected) {
      const key = `${e.side}:${e.level ?? 0}:${power.root}`, nodes = groups.get(key) ?? [];
      nodes.push(e);
      groups.set(key, nodes);
    }
  }
  for (const nodes of groups.values()) for (const first of nodes) {
    if (components.has(first.id)) continue;
    const component = [first], componentId = first.id;
    components.set(componentId, componentId);
    for (let i = 0; i < component.length; i++) for (const candidate of nodes) if (!components.has(candidate.id) && Math.hypot(candidate.x - component[i].x, candidate.y - component[i].y) <= 8) {
      components.set(candidate.id, componentId);
      component.push(candidate);
    }
  }
  for (const e of c.entities.values()) {
    const power = e.factionState?.power;
    if (!power?.connected || e.hp <= 0) continue;
    const root = c.entities.get(power.root), rootPower = root?.factionState?.power;
    if (!root || root.kind !== "building" || root.role !== "hq" || root.side !== e.side || root.progress !== 1 || (root.level ?? 0) !== (e.level ?? 0) || !rootPower?.connected || rootPower.root !== root.id || components.get(e.id) !== components.get(root.id)) bad2(`state.entities[${e.id}].factionState.power.root`, "power root requires a completed owned headquarters connected within eight-tile building links on the same level");
  }
}
function validateFactionUnit(value2, path, c, e) {
  const f = object2(value2, path, [], ["trophyKills", "chant", "swapReadyAt", "artillery", "tunnel", "corpseCargo", "deliveredCorpses", "corpseOrder", "power", "nextDecoyAt", "waterReadyAt"]);
  if (f.trophyKills !== void 0) {
    if (e.kind !== "unit" || e.illusion) bad2(`${path}.trophyKills`, "trophies require real troops");
    number2(f.trophyKills, `${path}.trophyKills`, 0, 1e9, true);
  }
  for (const key of ["swapReadyAt", "nextDecoyAt", "waterReadyAt"]) optionalNumber(f, key, path, 0, c.time + 60);
  if (f.swapReadyAt !== void 0 && (e.kind !== "unit" || e.illusion || ["worker", "siege"].includes(e.role))) bad2(`${path}.swapReadyAt`, "illusion swapping requires real military troops");
  if (f.waterReadyAt !== void 0 && (e.kind !== "unit" || e.illusion || e.role !== "special" || entityDefinition(c.state, e).ability !== "surge")) bad2(`${path}.waterReadyAt`, "water shaping requires an admitted Tidecaller");
  if (f.nextDecoyAt !== void 0 && (e.kind !== "building" || e.definitionId !== "core:fairies-enchanted-grove")) bad2(`${path}.nextDecoyAt`, "decoy cooldown requires an Enchanted Grove");
  if (f.chant !== void 0) {
    if (e.kind !== "unit" || e.illusion || ["worker", "siege"].includes(e.role) || c.state.players[e.side].faction !== "orcs") bad2(`${path}.chant`, "war chants require owned Ironclad military troops");
    const chant = object2(f.chant, `${path}.chant`, ["kind", "until"]);
    choice2(chant.kind, `${path}.chant.kind`, ["assault", "bulwark"]);
    number2(chant.until, `${path}.chant.until`, 0, c.time + 12);
  }
  if (f.artillery !== void 0) {
    if (e.kind !== "unit" || e.illusion || e.role !== "siege" && (e.role !== "special" || entityDefinition(c.state, e).ability !== "entrench")) bad2(`${path}.artillery`, "fittings require siege artillery or an admitted Siege Cannon");
    choice2(f.artillery, `${path}.artillery`, ["stone", "grapeshot", "incendiary", "reinforced"]);
  }
  if (f.tunnel !== void 0) {
    if (e.kind !== "unit" || e.illusion || e.raised || c.state.players[e.side].faction !== "dwarves") bad2(`${path}.tunnel`, "tunnel orders require owned real Deepforge troops");
    const tunnel = object2(f.tunnel, `${path}.tunnel`, ["target", "progress"]);
    id3(tunnel.target, `${path}.tunnel.target`, c);
    number2(tunnel.progress, `${path}.tunnel.progress`, 0, 1);
  }
  for (const key of ["corpseCargo", "deliveredCorpses"]) if (f[key] !== void 0) {
    if (e.kind !== "unit" || e.illusion || key === "corpseCargo" && e.definitionId !== "core:undead-corpse-wagon" || key === "deliveredCorpses" && (e.role !== "special" || entityDefinition(c.state, e).ability !== "raise")) bad2(`${path}.${key}`, "wrong corpse carrier");
    list2(f[key], `${path}.${key}`, key === "corpseCargo" ? 6 : 12).forEach((v, i) => validateBody(v, `${path}.${key}[${i}]`, c));
  }
  if (f.corpseOrder !== void 0) {
    const order3 = object2(f.corpseOrder, `${path}.corpseOrder`, ["type", "target", "progress"]);
    choice2(order3.type, `${path}.corpseOrder.type`, ["collect", "deliver"]);
    id3(order3.target, `${path}.corpseOrder.target`, c);
    number2(order3.progress, `${path}.corpseOrder.progress`, 0, 1);
    if (e.kind !== "unit" || e.illusion || e.definitionId !== "core:undead-corpse-wagon" || c.state.players[e.side].faction !== "undead") bad2(`${path}.corpseOrder`, "active corpse orders require an owned Ashen Host corpse wagon");
  }
  if (f.power !== void 0) {
    const power = object2(f.power, `${path}.power`, ["connected", "root"]);
    flag2(power.connected, `${path}.power.connected`);
    if (power.root !== null) id3(power.root, `${path}.power.root`, c);
    if (power.connected !== (power.root !== null) || e.kind !== "building" || e.progress !== 1 || c.state.players[e.side].faction !== "automata" || e.maxShield !== 80 || e.shield === void 0) bad2(`${path}.power`, "power requires a completed Automata building with an 80-point shield capacity");
  }
}
function validateFactionSystem(value2, path, c) {
  const system = object2(value2, path, ["version", "fury", "terrainEffects"]);
  if (system.version !== 1) bad2(`${path}.version`, "unknown faction schema");
  list2(system.fury, `${path}.fury`, c.playerCount, c.playerCount).forEach((v, i) => number2(v, `${path}.fury[${i}]`, 0, 100));
  const ids = /* @__PURE__ */ new Set();
  list2(system.terrainEffects, `${path}.terrainEffects`, c.maxEntities).forEach((v, i) => {
    const p = `${path}.terrainEffects[${i}]`, effect = object2(v, p, ["id", "side", "until", "tiles"]), n = id3(effect.id, `${p}.id`, c);
    if (ids.has(n) || c.entityIds.has(n) || c.resourceIds.has(n)) bad2(`${p}.id`, "duplicate effect ID");
    ids.add(n);
    number2(effect.side, `${p}.side`, 0, c.playerCount - 1, true);
    number2(effect.until, `${p}.until`, 0, c.time + 20);
    list2(effect.tiles, `${p}.tiles`, 25).forEach((v2, j) => {
      const q = `${p}.tiles[${j}]`, tile = object2(v2, q, ["x", "y", "level", "before", "after"]);
      coordinates(tile, q, c);
      number2(tile.level, `${q}.level`, 0, c.levels - 1, true);
      choice2(tile.before, `${q}.before`, Object.keys(TERRAIN));
      choice2(tile.after, `${q}.after`, ["mud", "shallows", "water"]);
    });
  });
}
function validateTactics(value2, path, c, e) {
  const t = object2(value2, path, ["morale", "recentLoss"], ["formation", "retreat", "surrenderedTo", "ambush", "charge", "guard", "siegeCrew", "capture"]);
  if (e.kind !== "unit") bad2(path, "tactics requires a unit");
  number2(t.morale, `${path}.morale`, 0, 100);
  number2(t.recentLoss, `${path}.recentLoss`, 0, 60);
  if (t.surrenderedTo !== void 0) {
    number2(t.surrenderedTo, `${path}.surrenderedTo`, 0, c.playerCount - 1, true);
    if (t.surrenderedTo !== e.side || e.illusion || ["worker", "siege"].includes(e.role) || e.definitionFaction === void 0) bad2(`${path}.surrenderedTo`, "surrender requires the current owner and original combat troop definition");
  }
  if (t.retreat !== void 0) {
    const r = object2(t.retreat, `${path}.retreat`, ["x", "y", "until"], ["level"]);
    coordinates(r, `${path}.retreat`, c);
    number2(r.until, `${path}.retreat.until`, 0, c.time + 8.01);
  }
  if (t.formation !== void 0) {
    if (e.illusion || ["worker", "siege"].includes(e.role)) bad2(`${path}.formation`, "formations require real military troops");
    const f = object2(t.formation, `${path}.formation`, ["kind", "group", "slot", "count", "spacing", "facing", "anchor", "phase"]);
    choice2(f.kind, `${path}.formation.kind`, ["line", "wedge", "square", "loose"]);
    if (typeof f.group !== "string" || !f.group.length || f.group.length > 1200) bad2(`${path}.formation.group`, "invalid formation group");
    const count = number2(f.count, `${path}.formation.count`, 1, 100, true);
    number2(f.slot, `${path}.formation.slot`, 0, count - 1, true);
    number2(f.spacing, `${path}.formation.spacing`, 0.65, 3);
    number2(f.facing, `${path}.formation.facing`, 0, 7, true);
    point3(f.anchor, `${path}.formation.anchor`, c);
    choice2(f.phase, `${path}.formation.phase`, ["moving", "broken", "regrouping", "formed"]);
  }
  if (t.ambush !== void 0) {
    const a = object2(t.ambush, `${path}.ambush`, ["radius", "target", "concealed", "armedAt"]);
    number2(a.radius, `${path}.ambush.radius`, 0.75, 10);
    choice2(a.target, `${path}.ambush.target`, ["any", "unit", "building", ...UNIT_ROLES]);
    flag2(a.concealed, `${path}.ambush.concealed`);
    number2(a.armedAt, `${path}.ambush.armedAt`, 0, c.time);
    if (e.role === "worker" || e.role === "siege" || e.illusion) bad2(`${path}.ambush`, "ineligible ambusher");
  }
  if (t.charge !== void 0) {
    const charge = object2(t.charge, `${path}.charge`, ["distance", "heading", "lastMovedAt"]);
    number2(charge.distance, `${path}.charge.distance`, 0, 5);
    number2(charge.heading, `${path}.charge.heading`, 0, 7, true);
    number2(charge.lastMovedAt, `${path}.charge.lastMovedAt`, 0, c.time);
    if (e.role !== "cavalry" || e.illusion) bad2(`${path}.charge`, "charge requires real cavalry");
  }
  if (t.guard !== void 0) {
    const originalFaction = e.definitionFaction ?? c.state.players[e.side].faction;
    if (e.role !== "melee" || !["dwarves", "tideborn", "automata"].includes(originalFaction)) bad2(`${path}.guard`, "guard requires an admitted shield bearer");
    const guard = object2(t.guard, `${path}.guard`, ["value", "max", "lastDamagedAt"]);
    const max = number2(guard.max, `${path}.guard.max`, 40, 40);
    number2(guard.value, `${path}.guard.value`, 0, max);
    number2(guard.lastDamagedAt, `${path}.guard.lastDamagedAt`, 0, c.time);
  }
  if (t.siegeCrew !== void 0) {
    const crew = object2(t.siegeCrew, `${path}.siegeCrew`, ["hp", "maxHp", "uncrewed"]);
    const max = number2(crew.maxHp, `${path}.siegeCrew.maxHp`, 42, 42);
    number2(crew.hp, `${path}.siegeCrew.hp`, 0, max);
    flag2(crew.uncrewed, `${path}.siegeCrew.uncrewed`);
    if (e.role !== "siege" || e.illusion || crew.uncrewed !== (crew.hp === 0)) bad2(`${path}.siegeCrew`, "invalid siege crew");
  }
  if (t.capture !== void 0) {
    const capture = object2(t.capture, `${path}.capture`, ["target", "progress"]);
    id3(capture.target, `${path}.capture.target`, c);
    number2(capture.progress, `${path}.capture.progress`, 0, 1);
    if (!["worker", "melee", "spear", "special"].includes(e.role) || e.illusion || e.raised) bad2(`${path}.capture`, "ineligible capturer");
  }
}
function playersArray(value2, path, c, check) {
  list2(value2, path, c.playerCount, c.playerCount).forEach((v, i) => check(v, `${path}[${i}]`));
}
function entries(value2, path, max, c, check) {
  const seen = /* @__PURE__ */ new Set();
  list2(value2, path, max).forEach((entry, i) => {
    const p = `${path}[${i}]`, parts = list2(entry, p, 2, 2), key = id3(parts[0], `${p}[0]`, c);
    if (seen.has(key)) bad2(path, "duplicate map key");
    seen.add(key);
    check(parts[1], `${p}[1]`);
  });
}
function validateRuntime(value2, c, version, teams) {
  const fields2 = ["fog", "ai", "aiTurns", "hits", "routes", "abilities", "returning", "queuedGather", "aiWave", "initialScoutDispatched", "expansionScout", "expansionScoutDispatched", "knownEnemyBuildings", "enemyStartCleared", "searched"];
  const path = "runtime", r = object2(value2, path, version === 1 ? fields2 : version === 2 ? [...fields2, "clearedEnemyStarts"] : [...fields2, "clearedEnemyStarts", "aiBatchTurns", "aiDecisionAt", "aiDecisionTurns", "knownEnemyUnits", "retreating", "producedFighters"], version >= 3 ? ["teamAI"] : []);
  number2(r.fog, "runtime.fog", -0.25, 0.2);
  number2(r.ai, "runtime.ai", -0.25, 1);
  number2(r.aiTurns, "runtime.aiTurns", 0, MAX_VALUE, true);
  list2(r.hits, "runtime.hits", c.maxEntities).forEach((v, i) => {
    const p = `runtime.hits[${i}]`, h = object2(v, p, ["source", "target", "amount", "event"]);
    for (const key of ["source", "target"]) if (!c.entityIds.has(id3(h[key], `${p}.${key}`, c))) bad2(`${p}.${key}`, "missing hit entity");
    number2(h.amount, `${p}.amount`, 0, 1e9);
    number2(h.event, `${p}.event`, 0, c.eventCount - 1, true);
  });
  entries(r.routes, "runtime.routes", MAX_ID2, c, (v, p) => {
    const route2 = object2(v, p, ["key", "at"]);
    if (typeof route2.key !== "string" || route2.key.length > 128) bad2(`${p}.key`, "invalid route key");
    number2(route2.at, `${p}.at`, 0, c.time);
  });
  entries(r.abilities, "runtime.abilities", MAX_ID2, c, (v, p) => number2(v, p));
  uniqueIds(list2(r.returning, "runtime.returning", MAX_ID2), "runtime.returning", c.nextId - 1).forEach((n) => {
    if (n === 0) bad2("runtime.returning", "invalid entity id");
  });
  uniqueIds(list2(r.queuedGather, "runtime.queuedGather", c.maxEntities), "runtime.queuedGather", c.nextId - 1).forEach((n) => {
    const e = c.entities.get(n);
    if (!e || e.hp <= 0 || e.kind !== "unit" || e.role !== "worker" || e.order.type !== "gather") bad2("runtime.queuedGather", "expected a living worker gathering");
  });
  playersArray(r.aiWave, "runtime.aiWave", c, (v, p) => number2(v, p, 0, c.time));
  for (const key of ["initialScoutDispatched", "expansionScoutDispatched", "enemyStartCleared"]) playersArray(r[key], `runtime.${key}`, c, flag2);
  playersArray(r.expansionScout, "runtime.expansionScout", c, (v, p) => {
    if (v !== null) id3(v, p, c);
  });
  playersArray(r.knownEnemyBuildings, "runtime.knownEnemyBuildings", c, (v, p) => entries(v, p, c.maxEntities, c, (value3, q) => {
    const b = object2(value3, q, ["x", "y", "role"], ["level"]);
    coordinates(b, q, c);
    choice2(b.role, `${q}.role`, BUILDING_ROLES);
  }));
  playersArray(r.searched, "runtime.searched", c, (v, p) => uniqueIds(list2(v, p, c.cells), p, c.cells - 1));
  if (version >= 2) playersArray(r.clearedEnemyStarts, "runtime.clearedEnemyStarts", c, (v, p) => uniqueIds(list2(v, p, c.playerCount), p, c.playerCount - 1));
  if (version >= 3) {
    number2(r.aiBatchTurns, "runtime.aiBatchTurns", 0, MAX_VALUE, true);
    playersArray(r.aiDecisionAt, "runtime.aiDecisionAt", c, (v, p) => number2(v, p, 0, c.time + 3));
    for (const key of ["aiDecisionTurns", "producedFighters"]) playersArray(r[key], `runtime.${key}`, c, (v, p) => number2(v, p, 0, MAX_VALUE, true));
    playersArray(r.knownEnemyUnits, "runtime.knownEnemyUnits", c, (v, p) => entries(v, p, c.maxEntities, c, (value3, q) => {
      const observation = object2(value3, q, ["x", "y", "role", "seenAt", "hpFraction"], ["level"]);
      coordinates(observation, q, c);
      choice2(observation.role, `${q}.role`, UNIT_ROLES.filter((role) => role !== "worker"));
      number2(observation.seenAt, `${q}.seenAt`, 0, c.time);
      number2(observation.hpFraction, `${q}.hpFraction`, 0, 1);
    }));
    playersArray(r.retreating, "runtime.retreating", c, (v, p) => entries(v, p, c.maxEntities, c, (value3, q) => {
      const record6 = object2(value3, q, ["until", "produced", "afterId"]);
      number2(record6.until, `${q}.until`, 0, c.time + 30);
      number2(record6.produced, `${q}.produced`, 0, MAX_VALUE, true);
      number2(record6.afterId, `${q}.afterId`, 0, c.nextId - 1, true);
    }));
    if (r.teamAI !== void 0) validateTeamAiState(r.teamAI, { playerCount: c.playerCount, teams, time: c.time, nextEntityId: c.nextId, width: c.width, height: c.height, levels: c.levels, entityLevels: new Map([...c.entities].map(([id5, e]) => [id5, e.level ?? 0])), entitySides: new Map([...c.entities].filter(([, e]) => e.hp > 0 && e.kind === "unit" && e.role !== "worker" && !e.illusion).map(([id5, e]) => [id5, e.side])) });
  }
}
function validate(envelope, version) {
  const save = object2(envelope, "save", ["format", "version", "state", "runtime"]);
  if (save.format !== "orcs-vs-fairies-save") bad2("format", "unknown save format");
  if (save.version !== version) bad2("version", `unsupported version ${String(save.version)}`);
  const s = object2(save.state, "state", version === 1 ? STATE_FIELDS : version === 2 ? [...STATE_FIELDS, ...TEAM_FIELDS] : [...STATE_FIELDS, ...TEAM_FIELDS, "aiConfigs"], version >= 3 ? ["content", "world", "specialists", "rules", "objectives", "draft", "scenario", "economy", "friendlyFire", "projectiles", "factionSystems"] : []);
  if (s.content !== void 0) s.content = version < 4 ? decodeHistoricalContentBundle(s.content) : decodeContentBundle(s.content);
  const playerCount = list2(s.players, "state.players", version === 1 ? 2 : MAX_PLAYERS, version === 1 ? 2 : void 0).length;
  if (playerCount === 0) bad2("state.players", "expected between 1 and 8 players");
  const width = number2(s.width, "state.width", 8, 256, true), height = number2(s.height, "state.height", 8, 256, true), nextId = number2(s.nextId, "state.nextId", 1, MAX_ID2, true);
  const levels = s.world === void 0 ? 1 : Array.isArray(s.world.levels) ? s.world.levels.length : 0;
  if (levels < 1 || levels > 2) bad2("world.levels", "expected1 or2 levels");
  const c = { version, state: s, levels, width, height, cells: width * height * levels, time: number2(s.time, "state.time"), nextId, playerCount, maxEntities: version === 1 ? 4096 : MAX_ENTITIES, entityIds: /* @__PURE__ */ new Set(), entities: /* @__PURE__ */ new Map(), resourceIds: /* @__PURE__ */ new Set(), eventCount: 0 };
  if (version >= 3) playersArray(s.aiConfigs, "state.aiConfigs", c, (v, p) => {
    const config = object2(v, p, ["difficulty", "personality", "opening"]);
    choice2(config.difficulty, `${p}.difficulty`, ["easy", "normal", "hard"]);
    choice2(config.personality, `${p}.personality`, ["balanced", "rush", "fortify", "expand", "raid"]);
    choice2(config.opening, `${p}.opening`, ["infantry-rush", "tower-defense", "fast-expansion", "cavalry-raids"]);
  });
  playersArray(s.controllers, "state.controllers", c, (v, p) => choice2(v, p, ["human", "ai", "external"]));
  choice2(s.mapSize, "state.mapSize", ["small", "medium", "large", "huge"]);
  number2(s.mapVersion, "state.mapVersion", 1, MAP_VERSION, true);
  list2(s.terrain, "state.terrain", width * height, width * height).forEach((v, i) => choice2(v, `state.terrain[${i}]`, Object.keys(TERRAIN)));
  playersArray(s.starts, "state.starts", c, (v, p) => point3(v, p, c));
  flag2(s.draw, "state.draw");
  number2(s.tick, "state.tick", 0, MAX_VALUE, true);
  number2(s.time, "state.time");
  number2(s.seed, "state.seed", 0, 4294967295, true);
  if (version >= 2) {
    playersArray(s.teams, "state.teams", c, (v, p) => number2(v, p, 0, MAX_PLAYERS - 1, true));
    playersArray(s.incomeFactors, "state.incomeFactors", c, (v, p) => number2(v, p, 0, 10));
    playersArray(s.populationLimits, "state.populationLimits", c, (v, p) => number2(v, p, 1, 500, true));
    playersArray(s.eliminated, "state.eliminated", c, flag2);
    flag2(s.sharedVision, "state.sharedVision");
  }
  list2(s.entities, "state.entities", c.maxEntities).forEach((v, i) => validateEntity(v, `state.entities[${i}]`, c));
  validatePowerConnections(c);
  if (s.friendlyFire !== void 0) flag2(s.friendlyFire, "state.friendlyFire");
  if (s.projectiles !== void 0) list2(s.projectiles, "state.projectiles", c.maxEntities).forEach((v, i) => {
    const path = `state.projectiles[${i}]`, shell = object2(v, path, ["id", "source", "side", "faction", "from", "x", "y", "damage", "buildingMultiplier", "impactAt", "radius"], ["modification", "level"]), key = id3(shell.id, `${path}.id`, c);
    if (c.entityIds.has(key) || c.resourceIds.has(key)) bad2(`${path}.id`, "duplicate projectile ID");
    c.resourceIds.add(key);
    id3(shell.source, `${path}.source`, c);
    number2(shell.side, `${path}.side`, 0, c.playerCount - 1, true);
    choice2(shell.faction, `${path}.faction`, Object.keys(contentFactions(c.state.content)));
    const origin = object2(shell.from, `${path}.from`, ["x", "y"], ["level", "elevation"]);
    coordinates(origin, `${path}.from`, c);
    optionalNumber(origin, "elevation", `${path}.from`, 0, 3);
    coordinates(shell, path, c);
    number2(shell.damage, `${path}.damage`, 0, 1e9);
    number2(shell.buildingMultiplier, `${path}.buildingMultiplier`, 0, 100);
    number2(shell.impactAt, `${path}.impactAt`, c.time, c.time + 30);
    number2(shell.radius, `${path}.radius`, 0.1, 10);
    if (shell.modification !== void 0) choice2(shell.modification, `${path}.modification`, ["stone", "grapeshot", "incendiary", "reinforced"]);
  });
  list2(s.resources, "state.resources", MAX_RESOURCES).forEach((v, i) => {
    const p = `state.resources[${i}]`, r = object2(v, p, ["id", "x", "y", "kind", "amount", "maxAmount"], ["level"]), key = id3(r.id, `${p}.id`, c);
    if (c.entityIds.has(key) || c.resourceIds.has(key)) bad2(`${p}.id`, "duplicate entity or resource id");
    c.resourceIds.add(key);
    coordinates(r, p, c);
    choice2(r.kind, `${p}.kind`, RESOURCE_KINDS2);
    const max = number2(r.maxAmount, `${p}.maxAmount`, 0, 1e9);
    number2(r.amount, `${p}.amount`, 0, max);
  });
  playersArray(s.players, "state.players", c, (v, p) => {
    const player = object2(v, p, ["faction", "wood", "ore", "crystal", "population", "cap", "upgrades"], ["heroRecovery"]);
    choice2(player.faction, `${p}.faction`, Object.keys(contentFactions(c.state.content)));
    for (const key of RESOURCE_KINDS2) number2(player[key], `${p}.${key}`);
    number2(player.population, `${p}.population`, 0, c.maxEntities, true);
    number2(player.cap, `${p}.cap`, 0, version === 1 ? 100 : 500, true);
    const available = upgradesFor(c.state, s.players.indexOf(v)), upgrades = list2(player.upgrades, `${p}.upgrades`, Object.keys(available).length);
    upgrades.forEach((u, i) => choice2(u, `${p}.upgrades[${i}]`, Object.keys(available)));
    if (new Set(upgrades).size !== upgrades.length) bad2(`${p}.upgrades`, "duplicate upgrade");
  });
  const researching = Array.from({ length: playerCount }, () => /* @__PURE__ */ new Set()), choices = Array.from({ length: playerCount }, () => /* @__PURE__ */ new Map()), players = s.players;
  for (let side2 = 0; side2 < playerCount; side2++) {
    const definitions = upgradesFor(c.state, side2);
    for (const id5 of players[side2].upgrades) {
      const group = definitions[id5].exclusiveGroup;
      if (group) {
        if (choices[side2].has(group)) bad2(`state.players[${side2}].upgrades`, "exclusive technology choices conflict");
        choices[side2].set(group, id5);
      }
    }
  }
  for (const e of c.entities.values()) if (e.hp > 0 && e.research !== void 0) {
    const side2 = e.side, upgrade = e.research;
    if (players[side2].upgrades.includes(upgrade) || researching[side2].has(upgrade)) bad2("state.entities.research", "upgrade is already complete or being researched");
    researching[side2].add(upgrade);
    const group = upgradesFor(c.state, side2)[upgrade].exclusiveGroup;
    if (group) {
      if (choices[side2].has(group)) bad2("state.entities.research", "exclusive technology choice is already complete or being researched");
      choices[side2].set(group, upgrade);
    }
  }
  if (s.winner !== null) number2(s.winner, "state.winner", 0, playerCount - 1, true);
  if (s.draw && s.winner !== null) bad2("state.winner", "draw cannot have a winner");
  if (version >= 2) {
    if (s.winningTeam !== null) {
      number2(s.winningTeam, "state.winningTeam", 0, MAX_PLAYERS - 1, true);
      if (!s.teams.includes(s.winningTeam)) bad2("state.winningTeam", "team has no player");
    }
    if (s.winner === null !== (s.winningTeam === null) || s.winner !== null && s.teams[s.winner] !== s.winningTeam) bad2("state.winner", "winner must belong to the winning team");
    if (s.draw && s.winningTeam !== null) bad2("state.winningTeam", "draw cannot have a winning team");
  }
  list2(s.corpses, "state.corpses", c.maxEntities * 2).forEach((v, i) => {
    const p = `state.corpses[${i}]`, corpse = object2(v, p, ["id", "x", "y", "expires"], ["level"]);
    id3(corpse.id, `${p}.id`, c);
    coordinates(corpse, p, c);
    number2(corpse.expires, `${p}.expires`);
  });
  if (s.factionSystems !== void 0) validateFactionSystem(s.factionSystems, "state.factionSystems", c);
  const bodyOwners = /* @__PURE__ */ new Set();
  const claimBody = (body, path) => {
    const b = body, n = b.id;
    if (bodyOwners.has(n)) bad2(path, "body belongs to more than one location");
    bodyOwners.add(n);
  };
  s.corpses.forEach((b, i) => claimBody(b, `state.corpses[${i}]`));
  for (const e of c.entities.values()) {
    const f = e.factionState;
    if (f) {
      for (const key of ["corpseCargo", "deliveredCorpses"]) if (f[key]) for (const b of f[key]) claimBody(b, `state.entities[${e.id}].factionState.${key}`);
    }
  }
  const events = list2(s.events, "state.events", c.maxEntities * 4);
  c.eventCount = events.length;
  events.forEach((v, i) => {
    const p = `state.events[${i}]`, event = object2(v, p, ["type", "x", "y", "side"], ["text", "target", "source", "amount", "resource", "level"]);
    choice2(event.type, `${p}.type`, ["attack", "death", "build", "train", "gather", "message", "ability", "research"]);
    coordinates(event, p, c);
    number2(event.side, `${p}.side`, 0, playerCount - 1, true);
    for (const key of ["source", "target"]) if (event[key] !== void 0) id3(event[key], `${p}.${key}`, c);
    optionalNumber(event, "amount", p);
    if (event.resource !== void 0) choice2(event.resource, `${p}.resource`, RESOURCE_KINDS2);
    if (event.text !== void 0 && (typeof event.text !== "string" || event.text.length > 4096)) bad2(`${p}.text`, "invalid message text");
  });
  const explored = fog(s.explored, "state.explored", c), visible5 = fog(s.visible, "state.visible", c);
  visible5.forEach((tiles, side2) => {
    for (const tile of tiles) if (!explored[side2].has(tile)) bad2(`state.visible[${side2}]`, "visible tiles must be explored");
  });
  if (s.world !== void 0) {
    validateWorldState(s.world, width, height, nextId, playerCount);
    const world2 = s.world;
    for (const allocated of [...world2.bridges, ...world2.sites, ...world2.creatures]) if (c.entityIds.has(allocated.id) || c.resourceIds.has(allocated.id)) bad2("world.id", "collision with entity or resource");
    if (world2.levels[0].terrain.some((t, i) => t !== s.terrain[i])) bad2("world.levels[0].terrain", "must match surface terrain");
  }
  if (s.economy !== void 0) validateEconomyState(s.economy, { width, height, time: c.time, nextId, playerCount, entities: s.entities, resources: s.resources, levels: c.levels, world: c.state.world });
  validateRuntime(save.runtime, c, version, s.teams);
  validateSpecialists(c.state);
  if (version >= 3) {
    const count = ["rules", "objectives", "draft"].filter((k) => Object.hasOwn(s, k)).length;
    if (count !== 0 && count !== 3) bad2("state.rules", "rules, objectives and draft must be stored together");
    if (count === 3) {
      const state = s;
      state.rules = validateSavedRules(s.rules, state.content);
      validateDraftState(s.draft, draftPlayers(state), state.rules, state.content);
      validateObjectiveState(s.objectives, state);
      validateModeRoster(state);
      if (version === 4) {
        for (const [i, e] of state.entities.entries()) if ((e.raised || e.illusion) && !definitionAllowed(state, e.side, entityDefinition(state, e).id)) bad2(`state.entities[${i}].${e.raised ? "raised" : "illusion"}`, "summoned definition is prohibited by the current owner match rules");
      }
    }
  }
  if (s.scenario !== void 0) s.scenario = validateScenarioBinding(s.scenario, c.state, version < 4);
}
function validateCurrent(envelope) {
  validate(envelope, SAVE_VERSION);
}
function migrateLegacy(envelope) {
  validate(envelope, 1);
  const state = envelope.state, entities = state.entities;
  Object.assign(state, { teams: [0, 1], incomeFactors: [1, 1], populationLimits: [100, 100], sharedVision: true, eliminated: [0, 1].map((side2) => !entities.some((e) => e.side === side2 && e.kind === "building" && e.role === "hq" && e.hp > 0 && e.progress === 1)), winningTeam: state.winner });
  const runtime2 = envelope.runtime, cleared = runtime2.enemyStartCleared;
  runtime2.clearedEnemyStarts = cleared.map((value2, side2) => value2 ? [1 - side2] : []);
  envelope.version = 2;
}
function migrateAi(envelope) {
  validate(envelope, 2);
  const state = envelope.state, runtime2 = envelope.runtime, count = state.players.length;
  state.aiConfigs = Array.from({ length: count }, () => normalizeAiConfig());
  Object.assign(runtime2, { aiBatchTurns: 0, aiDecisionAt: Array(count).fill(state.time), aiDecisionTurns: Array(count).fill(0), knownEnemyUnits: Array.from({ length: count }, () => []), retreating: Array.from({ length: count }, () => []), producedFighters: Array(count).fill(0) });
  envelope.version = 3;
}
function copyJson(value2) {
  let nodes = 0, bytes = 0;
  const parents = /* @__PURE__ */ new Set();
  function copy3(v, path, depth) {
    if (++nodes > 2e6 || depth > 32) bad2(path, "save is too large or deeply nested");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) bad2(path, "numbers must be finite");
      return v;
    }
    if (typeof v === "string") {
      bytes += v.length * 2;
      if (bytes > MAX_SAVE_BYTES) bad2(path, "save exceeds size limit");
      return v;
    }
    if (!v || typeof v !== "object") bad2(path, "expected JSON data");
    if (parents.has(v)) bad2(path, "cyclic reference");
    parents.add(v);
    let result;
    if (Array.isArray(v)) {
      if (v.length > 1e5) bad2(path, "array exceeds size limit");
      if (Object.getOwnPropertySymbols(v).length) bad2(path, "invalid array properties");
      for (const key of Object.getOwnPropertyNames(v)) {
        if (!("value" in Object.getOwnPropertyDescriptor(v, key))) bad2(path, "array accessors are forbidden");
        if (key !== "length") {
          const index2 = Number(key);
          if (!Number.isSafeInteger(index2) || index2 < 0 || index2 >= v.length || String(index2) !== key) bad2(path, "invalid array properties");
        }
      }
      const array3 = [];
      for (let i = 0; i < v.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
        if (!descriptor || !("value" in descriptor)) bad2(path, "array accessors and gaps are forbidden");
        array3.push(copy3(descriptor.value, `${path}[${i}]`, depth + 1));
      }
      result = array3;
    } else {
      const prototype = Object.getPrototypeOf(v);
      if (prototype !== Object.prototype && prototype !== null) bad2(path, "expected a plain object");
      const keys3 = Object.keys(v);
      if (keys3.length > 1e5 || Object.getOwnPropertySymbols(v).length) bad2(path, "invalid object properties");
      const record6 = {};
      for (const key of keys3) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") bad2(path, "unsafe property name");
        const descriptor = Object.getOwnPropertyDescriptor(v, key);
        if (!("value" in descriptor)) bad2(path, "accessors are forbidden");
        if (descriptor.value !== void 0) record6[key] = copy3(descriptor.value, `${path}.${key}`, depth + 1);
      }
      result = record6;
    }
    parents.delete(v);
    return result;
  }
  return copy3(value2, "save", 0);
}
function checkSize(value2) {
  if (new TextEncoder().encode(JSON.stringify(value2)).byteLength > MAX_SAVE_BYTES) bad2("save", "save exceeds size limit");
}
function saveGame(state, options = {}) {
  const fields2 = { ...state };
  if (options.omitScenarioBinding) delete fields2.scenario;
  const envelope = copyJson({ format: "orcs-vs-fairies-save", version: SAVE_VERSION, state: { ...fields2, explored: state.explored.map((set) => [...set]), visible: state.visible.map((set) => [...set]) }, runtime: captureRuntime(state) });
  checkSize(envelope);
  validateCurrent(envelope);
  completeCurrentState(envelope.state);
  checkSize(envelope);
  validateCurrent(envelope);
  return envelope;
}
function loadGame(input) {
  let source2 = input;
  if (typeof input === "string") {
    if (input.length > MAX_SAVE_BYTES || new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) bad2("save", "save exceeds size limit");
    try {
      source2 = JSON.parse(input);
    } catch {
      bad2("save", "invalid JSON");
    }
  }
  const envelope = copyJson(source2);
  checkSize(envelope);
  const record6 = object2(envelope, "save", ["format", "version", "state", "runtime"]);
  if (record6.version === 1) migrateLegacy(record6);
  if (record6.version === 2) migrateAi(record6);
  if (record6.version === 3) migrateV3(record6);
  validateCurrent(envelope);
  if (!envelope.state.rules) {
    const state2 = envelope.state;
    state2.rules = normalizeMatchRules({ sharedVision: state2.sharedVision }, state2.content);
    state2.draft = createDraft(draftPlayers(state2), state2.rules, state2.content);
    state2.objectives = emptyObjectives(state2);
  }
  completeCurrentState(envelope.state);
  checkSize(envelope);
  validateCurrent(envelope);
  const state = { ...envelope.state, explored: envelope.state.explored.map((values) => new Set(values)), visible: envelope.state.visible.map((values) => new Set(values)) };
  if (state.world) state.world.levels[0].terrain = state.terrain;
  restoreRuntime(state, envelope.runtime);
  return state;
}
function decodeSaveSource(input) {
  let source2 = input;
  if (typeof input === "string") {
    if (input.length > MAX_SAVE_BYTES || new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) bad2("save", "save exceeds size limit");
    try {
      source2 = JSON.parse(input);
    } catch {
      bad2("save", "invalid JSON");
    }
  }
  const original = decodeOriginalSaveEnvelope(source2);
  const state = loadGame(original);
  return { original, state };
}
function checksumSaveEnvelope(input) {
  const original = decodeOriginalSaveEnvelope(input), text3 = JSON.stringify(original);
  let hash3 = 2166136261;
  for (let i = 0; i < text3.length; i++) {
    hash3 ^= text3.charCodeAt(i);
    hash3 = Math.imul(hash3, 16777619);
  }
  return (hash3 >>> 0).toString(16).padStart(8, "0");
}
function decodeOriginalSaveEnvelope(input) {
  let source2 = input;
  if (typeof input === "string") {
    if (input.length > MAX_SAVE_BYTES || new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) bad2("save", "save exceeds size limit");
    try {
      source2 = JSON.parse(input);
    } catch {
      bad2("save", "invalid JSON");
    }
  }
  const original = copyJson(source2);
  checkSize(original);
  const record6 = object2(original, "save", ["format", "version", "state", "runtime"]);
  if (![1, 2, 3, 4].includes(record6.version)) bad2("version", `unsupported version ${String(record6.version)}`);
  validate(copyJson(original), record6.version);
  return original;
}
function completeCurrentState(state) {
  state.friendlyFire ??= state.rules?.friendlyFire ?? true;
  state.projectiles ??= [];
  initializeFactionSystems(state);
  state.economy ??= createEconomyState(state.players.length);
  for (const entity of state.entities) if (entity.kind === "unit") initializeTactics(state, entity);
}
function migrateV3(envelope) {
  validate(envelope, 3);
  const state = envelope.state;
  for (const entity of state.entities) if (entity.raised && !entity.definitionFaction) {
    const faction = contentFactions(state.content)[state.players[entity.side].faction];
    if (!(faction.unitDefinitions ?? Object.values(faction.units)).some((unit5) => unit5.ability === "raise")) throw new Error("Legacy captured summon origin is absent. This saved match is available for inspection but cannot resume under current rules.");
  }
  if (state.rules && state.draft) {
    for (const entity of state.entities) if ((entity.raised || entity.illusion) && !definitionAllowed(state, entity.side, entityDefinition(state, entity).id)) throw new Error("Legacy summoned definition is prohibited by the current owner match rules. This saved match is available for inspection but cannot resume under current rules.");
  }
  if (state.content) state.content = migrateHistoricalContentBundle(state.content);
  if (state.scenario?.definition.content) state.scenario.definition.content = migrateHistoricalContentBundle(state.scenario.definition.content);
  if (state.rules && state.draft) state.draft.pool = createDraft(draftPlayers(state), state.rules, state.content).pool;
  completeCurrentState(state);
  envelope.version = SAVE_VERSION;
}

// src/core/scenario-validation.ts
var unitRoles2 = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var buildingRoles2 = ["hq", "depot", "barracks", "tower", "wall", "gate"];
function bad3(path, reason) {
  throw new Error(`Invalid scenario at ${path}: ${reason}.`);
}
function object3(value2, path, required, optional = []) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2) || Object.getPrototypeOf(value2) !== Object.prototype) bad3(path, "expected a plain object");
  const record6 = value2;
  for (const key of required) if (!Object.hasOwn(record6, key)) bad3(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record6)) if (!required.includes(key) && !optional.includes(key)) bad3(`${path}.${key}`, "unknown field");
  return record6;
}
function number3(value2, path, min = 0, max = 1e9, integer2 = false) {
  if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < min || value2 > max || integer2 && !Number.isSafeInteger(value2)) bad3(path, `expected ${integer2 ? "an integer" : "a number"} between ${min} and ${max}`);
  return value2;
}
function text(value2, path, max = 4096) {
  if (typeof value2 !== "string" || value2.length < 1 || value2.length > max) bad3(path, "invalid text");
  return value2;
}
function identifier(value2, path) {
  const id5 = text(value2, path, 96);
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(id5) || ["constructor", "prototype", "__proto__"].includes(id5)) bad3(path, "invalid identifier");
  return id5;
}
function choice3(value2, path, values) {
  if (typeof value2 !== "string" || !values.includes(value2)) bad3(path, "unknown value");
  return value2;
}
function flag3(value2, path) {
  if (typeof value2 !== "boolean") bad3(path, "expected a boolean");
  return value2;
}
function list3(value2, path, max, min = 0) {
  if (!Array.isArray(value2) || value2.length < min || value2.length > max) bad3(path, "invalid array length");
  for (let i = 0; i < value2.length; i++) if (!Object.hasOwn(value2, i)) bad3(path, "array contains gaps");
  return value2;
}
function scenarioJson(input, limits = {}) {
  let nodes = 0;
  const ancestors = /* @__PURE__ */ new Set();
  const copy3 = (value3, depth) => {
    if (++nodes > (limits.maxNodes ?? 1e5) || depth > 24) bad3("package", "package is too large or deeply nested");
    if (value3 === null || typeof value3 === "boolean" || typeof value3 === "string") return value3;
    if (typeof value3 === "number" && Number.isFinite(value3)) return value3;
    if (!value3 || typeof value3 !== "object") bad3("package", "expected bounded JSON data");
    if (ancestors.has(value3)) bad3("package", "cyclic reference");
    ancestors.add(value3);
    let result;
    if (Array.isArray(value3)) {
      if (value3.length > (limits.maxArrayLength ?? 65536) || Object.getOwnPropertySymbols(value3).length) bad3("package", "array is too large or contains symbols");
      for (const key of Object.getOwnPropertyNames(value3)) {
        if (!("value" in Object.getOwnPropertyDescriptor(value3, key))) bad3("package", "accessors are forbidden");
        if (key !== "length") {
          const index2 = Number(key);
          if (!Number.isSafeInteger(index2) || index2 < 0 || index2 >= value3.length || String(index2) !== key) bad3("package", "invalid array properties");
        }
      }
      result = Array.from({ length: value3.length }, (_, index2) => {
        const property = Object.getOwnPropertyDescriptor(value3, String(index2));
        if (!property || !("value" in property)) bad3("package", "accessors and gaps are forbidden");
        return copy3(property.value, depth + 1);
      });
    } else {
      if (Object.getPrototypeOf(value3) !== Object.prototype || Object.getOwnPropertySymbols(value3).length) bad3("package", "expected a plain object");
      const record6 = {};
      for (const key of Object.keys(value3)) {
        if (["constructor", "prototype", "__proto__"].includes(key)) bad3("package", "unsafe property");
        const property = Object.getOwnPropertyDescriptor(value3, key);
        if (!("value" in property)) bad3("package", "accessors are forbidden");
        if (property.value !== void 0) record6[key] = copy3(property.value, depth + 1);
      }
      result = record6;
    }
    ancestors.delete(value3);
    return result;
  };
  const value2 = copy3(input, 0);
  if (new TextEncoder().encode(JSON.stringify(value2)).byteLength > (limits.maxBytes ?? 2 * 1024 * 1024)) bad3("package", "package exceeds its size limit");
  return value2;
}
function validateScenario(input, options = {}) {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > 2 * 1024 * 1024) bad3("package", "package exceeds 2 MiB");
    try {
      raw = JSON.parse(raw);
    } catch {
      bad3("package", "invalid JSON");
    }
  }
  const value2 = scenarioJson(raw);
  const s = object3(value2, "definition", ["schemaVersion", "id", "title", "briefing", "successText", "failureText", "faction", "opponent", "seed", "army", "objectives", "events", "rules"], ["content", "map", "escort", "stealth", "boss", "requiredActions"]);
  if (s.schemaVersion !== 1) bad3("schemaVersion", "unsupported version");
  identifier(s.id, "id");
  for (const key of ["title", "briefing", "successText", "failureText"]) text(s[key], key);
  const content = s.content === void 0 ? void 0 : options.historicalContent ? decodeHistoricalContentBundle(s.content) : decodeContentBundle(s.content);
  const factions2 = contentFactions(content);
  if (content) s.content = content;
  const faction = choice3(s.faction, "faction", Object.keys(factions2));
  const opponent = choice3(s.opponent, "opponent", Object.keys(factions2));
  const seed = number3(s.seed, "seed", 0, 4294967295, true);
  let map;
  if (s.map !== void 0) {
    const m = object3(s.map, "map", ["size", "width", "height", "terrain", "starts", "resources"], ["world"]);
    choice3(m.size, "map.size", Object.keys(MAP_SIZES));
    const width = number3(m.width, "map.width", 8, 128, true), height = number3(m.height, "map.height", 8, 128, true);
    list3(m.terrain, "map.terrain", width * height, width * height).forEach((tile, i) => choice3(tile, `map.terrain[${i}]`, Object.keys(TERRAIN)));
    map = m;
    if (m.world !== void 0) {
      const validator = validateWorldMap;
      const validation = validator(m.world, { scenario: true });
      if (!validation.valid) bad3("map.world", validation.issues.join("; "));
    }
    list3(m.starts, "map.starts", 2, 2).forEach((p, i) => point5(p, `map.starts[${i}]`));
    list3(m.resources, "map.resources", 1024).forEach((resource, i) => {
      const path = `map.resources[${i}]`, r = object3(resource, path, ["x", "y", "kind", "amount", "maxAmount"], ["level"]);
      coordinates2(r, path);
      choice3(r.kind, `${path}.kind`, ["wood", "ore", "crystal"]);
      const max = number3(r.maxAmount, `${path}.maxAmount`, 1, 1e7);
      number3(r.amount, `${path}.amount`, 0, max);
    });
    if (m.world !== void 0) {
      const generate = generatedMapFromWorld;
      const flattened = generate(map.world, 2, { scenario: true });
      if (map.world.seed !== seed || flattened.width !== map.width || flattened.height !== map.height || flattened.size !== map.size || JSON.stringify(flattened.terrain) !== JSON.stringify(map.terrain)) bad3("map.world", "layered map disagrees with the scenario ground map");
      if (JSON.stringify(flattened.starts.map((p) => [p.x, p.y, p.level ?? 0])) !== JSON.stringify(map.starts.map((p) => [p.x, p.y, p.level ?? 0])) || JSON.stringify(flattened.resources.map((r) => [r.x, r.y, r.level ?? 0, r.kind, r.amount, r.maxAmount])) !== JSON.stringify(map.resources.map((r) => [r.x, r.y, r.level ?? 0, r.kind, r.amount, r.maxAmount]))) bad3("map.world", "layered starts or resources disagree with the scenario map");
    }
  } else {
    const generated = generateMap(seed, "small");
    map = { size: generated.size, width: generated.width, height: generated.height, terrain: generated.terrain, starts: generated.starts, resources: generated.resources };
  }
  function coordinates2(record6, path) {
    number3(record6.x, `${path}.x`, 0.5, map.width - 0.5);
    number3(record6.y, `${path}.y`, 0.5, map.height - 0.5);
    if (record6.level !== void 0) number3(record6.level, `${path}.level`, 0, (map.world?.levels.length ?? 1) - 1, true);
  }
  function point5(v, path) {
    coordinates2(object3(v, path, ["x", "y"], ["level"]), path);
  }
  const actorLabels = /* @__PURE__ */ new Set(), actorByLabel = /* @__PURE__ */ new Map();
  function actor3(v, path) {
    const a = object3(v, path, ["label", "side", "kind", "role", "x", "y"], ["hp", "order", "definitionId", "level"]);
    const label = identifier(a.label, `${path}.label`);
    if (actorLabels.has(label)) bad3(`${path}.label`, "duplicate actor label");
    actorLabels.add(label);
    actorByLabel.set(label, a);
    number3(a.side, `${path}.side`, 0, 1, true);
    const kind = choice3(a.kind, `${path}.kind`, ["unit", "building"]);
    const role = choice3(a.role, `${path}.role`, kind === "unit" ? unitRoles2 : buildingRoles2);
    coordinates2(a, path);
    const def = factions2[a.side === 0 ? faction : opponent];
    const id5 = a.definitionId;
    if (id5 !== void 0 && (typeof id5 !== "string" || id5.length > 100 || !/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(id5))) bad3(`${path}.definitionId`, "expected a registered definition ID");
    const roster = kind === "unit" ? def.unitDefinitions ?? Object.values(def.units) : def.buildingDefinitions ?? Object.values(def.buildings);
    const definition2 = id5 === void 0 ? kind === "unit" ? def.units[role] : def.buildings[role] : roster.find((d) => d.id === id5);
    if (!definition2 || definition2.role !== role) bad3(`${path}.definitionId`, "definition is absent from the actor faction or has another kind or role");
    if (a.hp !== void 0) number3(a.hp, `${path}.hp`, 1, definition2.hp);
    const radius2 = kind === "building" ? definition2.size / 2 : 0.27;
    for (let y = Math.floor(a.y - radius2); y <= Math.floor(a.y + radius2); y++) for (let x = Math.floor(a.x - radius2); x <= Math.floor(a.x + radius2); x++) {
      const terrain2 = map.world?.levels[a.level ?? 0].terrain ?? map.terrain;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || !TERRAIN[terrain2[y * map.width + x]].walkable) bad3(path, "actor is on impassable terrain");
    }
  }
  list3(s.army, "army", 256, 1).forEach((v, i) => actor3(v, `army[${i}]`));
  const events = list3(s.events, "events", 128);
  for (const [i, event] of events.entries()) {
    const e = object3(event, `events[${i}]`, ["id", "when", "actions"], ["repeat"]);
    list3(e.actions, `events[${i}].actions`, 16, 1).forEach((a, j) => {
      if (a && typeof a === "object" && a.type === "spawn") {
        if (e.repeat !== void 0) bad3(`events[${i}]`, "repeated spawn labels are ambiguous; author separate waves");
        const spawn = object3(a, `events[${i}].actions[${j}]`, ["type", "actors"]);
        list3(spawn.actors, `events[${i}].actors`, 128, 1).forEach((v, k) => actor3(v, `events[${i}].actors[${k}]`));
      }
    });
  }
  if (s.boss !== void 0) {
    const boss = object3(s.boss, "boss", ["actor", "name", "health", "phases"]);
    list3(boss.phases, "boss.phases", 8, 2).forEach((phase, i) => {
      const p = object3(phase, `boss.phases[${i}]`, ["below", "name", "radius", "damage", "warningSeconds", "cooldown", "interruptDamage", "adds"]);
      list3(p.adds, `boss.phases[${i}].adds`, 32).forEach((v, j) => actor3(v, `boss.phases[${i}].adds[${j}]`));
    });
  }
  function reference(v, path) {
    if (!actorLabels.has(identifier(v, path))) bad3(path, "unknown actor label");
  }
  function condition2(v, path, depth = 0) {
    if (depth > 8) bad3(path, "condition nesting exceeds eight levels");
    const c = object3(v, path, ["type"], ["actor", "point", "radius", "seconds", "key", "op", "value", "side", "buildings", "conditions", "condition"]);
    switch (c.type) {
      case "alive":
      case "dead":
        object3(v, path, ["type", "actor"]);
        reference(c.actor, `${path}.actor`);
        break;
      case "at":
        object3(v, path, ["type", "actor", "point", "radius"]);
        reference(c.actor, `${path}.actor`);
        point5(c.point, `${path}.point`);
        number3(c.radius, `${path}.radius`, 0.5, 32);
        break;
      case "time":
        object3(v, path, ["type", "seconds"]);
        number3(c.seconds, `${path}.seconds`, 0, 7200);
        break;
      case "variable":
        object3(v, path, ["type", "key", "op", "value"]);
        identifier(c.key, `${path}.key`);
        choice3(c.op, `${path}.op`, ["eq", "gte", "lte"]);
        number3(c.value, `${path}.value`, -1e9, 1e9);
        break;
      case "cleared":
        object3(v, path, ["type", "side"], ["buildings"]);
        number3(c.side, `${path}.side`, 0, 1, true);
        if (c.buildings !== void 0) flag3(c.buildings, `${path}.buildings`);
        break;
      case "all":
      case "any":
        object3(v, path, ["type", "conditions"]);
        list3(c.conditions, `${path}.conditions`, 16, 1).forEach((child, i) => condition2(child, `${path}.conditions[${i}]`, depth + 1));
        break;
      case "not":
        object3(v, path, ["type", "condition"]);
        condition2(c.condition, `${path}.condition`, depth + 1);
        break;
      default:
        bad3(`${path}.type`, "unknown condition");
    }
  }
  function order3(v, path) {
    const o = object3(v, path, ["type"], ["x", "y", "actor", "level"]);
    switch (o.type) {
      case "move":
      case "attackMove":
        object3(v, path, ["type", "x", "y"], ["level"]);
        coordinates2(o, path);
        break;
      case "attack":
        object3(v, path, ["type", "actor"]);
        reference(o.actor, `${path}.actor`);
        break;
      case "stop":
      case "hold":
      case "ability":
        object3(v, path, ["type"]);
        break;
      default:
        bad3(`${path}.type`, "unknown order");
    }
  }
  for (const [label, a] of actorByLabel) if (a.order) order3(a.order, `actor.${label}.order`);
  const objectiveIds = /* @__PURE__ */ new Set();
  list3(s.objectives, "objectives", 32, 1).forEach((v, i) => {
    const p = `objectives[${i}]`, o = object3(v, p, ["id", "text", "success"], ["failure", "optional"]), id5 = identifier(o.id, `${p}.id`);
    if (objectiveIds.has(id5)) bad3(`${p}.id`, "duplicate objective");
    objectiveIds.add(id5);
    text(o.text, `${p}.text`);
    condition2(o.success, `${p}.success`);
    if (o.failure !== void 0) condition2(o.failure, `${p}.failure`);
    if (o.optional !== void 0) flag3(o.optional, `${p}.optional`);
  });
  if (s.objectives.every((o) => o.optional)) bad3("objectives", "at least one objective must be required");
  const eventIds = /* @__PURE__ */ new Set();
  for (const [i, v] of events.entries()) {
    const p = `events[${i}]`, e = v, id5 = identifier(e.id, `${p}.id`);
    if (eventIds.has(id5)) bad3(`${p}.id`, "duplicate event");
    eventIds.add(id5);
    condition2(e.when, `${p}.when`);
    if (e.repeat !== void 0) {
      const r = object3(e.repeat, `${p}.repeat`, ["seconds", "count"]);
      number3(r.seconds, `${p}.repeat.seconds`, 1, 3600);
      number3(r.count, `${p}.repeat.count`, 1, 256, true);
    }
    e.actions.forEach((v2, j) => {
      const path = `${p}.actions[${j}]`, a = object3(v2, path, ["type"], ["actors", "order", "key", "value", "text", "speaker", "side", "resources", "outcome", "reason", "allied"]);
      switch (a.type) {
        case "spawn":
          object3(v2, path, ["type", "actors"]);
          break;
        case "alliance":
          object3(v2, path, ["type", "allied"]);
          flag3(a.allied, `${path}.allied`);
          break;
        case "order":
          object3(v2, path, ["type", "actors", "order"]);
          list3(a.actors, `${path}.actors`, 256, 1).forEach((label, k) => reference(label, `${path}.actors[${k}]`));
          order3(a.order, `${path}.order`);
          break;
        case "set":
        case "add":
          object3(v2, path, ["type", "key", "value"]);
          identifier(a.key, `${path}.key`);
          number3(a.value, `${path}.value`, -1e6, 1e6);
          break;
        case "message":
          object3(v2, path, ["type", "text"], ["speaker"]);
          text(a.text, `${path}.text`);
          if (a.speaker !== void 0) text(a.speaker, `${path}.speaker`, 96);
          break;
        case "reward":
          object3(v2, path, ["type", "side", "resources"]);
          number3(a.side, `${path}.side`, 0, 1, true);
          resources3(a.resources, `${path}.resources`);
          break;
        case "finish":
          object3(v2, path, ["type", "outcome", "reason"]);
          choice3(a.outcome, `${path}.outcome`, ["won", "lost"]);
          text(a.reason, `${path}.reason`);
          break;
        default:
          bad3(`${path}.type`, "unknown action");
      }
    });
  }
  function resources3(v, p) {
    const r = object3(v, p, ["wood", "ore", "crystal"]);
    for (const key of ["wood", "ore", "crystal"]) number3(r[key], `${p}.${key}`, 0, 1e6);
  }
  const rules = object3(s.rules, "rules", ["fixedArmy", "reinforcementBudget", "resources", "timeLimit"]);
  flag3(rules.fixedArmy, "rules.fixedArmy");
  number3(rules.reinforcementBudget, "rules.reinforcementBudget", 0, 256, true);
  resources3(rules.resources, "rules.resources");
  number3(rules.timeLimit, "rules.timeLimit", 1, 7200);
  if (rules.fixedArmy && rules.reinforcementBudget !== 0) bad3("rules.reinforcementBudget", "fixed armies cannot recruit");
  if (s.escort !== void 0) {
    const e = object3(s.escort, "escort", ["actor", "route", "radius", "escortRadius"]);
    reference(e.actor, "escort.actor");
    if (actorByLabel.get(e.actor)?.kind !== "unit") bad3("escort.actor", "escort must be a moving unit");
    list3(e.route, "escort.route", 64, 2).forEach((v, i) => point5(v, `escort.route[${i}]`));
    number3(e.radius, "escort.radius", 0.5, 5);
    number3(e.escortRadius, "escort.escortRadius", 1, 32);
  }
  if (s.stealth !== void 0) {
    const t = object3(s.stealth, "stealth", ["infiltrators", "guards", "alarmLimit", "detectionSeconds", "radius", "coneDegrees", "patrols"]);
    for (const group of ["infiltrators", "guards"]) list3(t[group], `stealth.${group}`, 64, 1).forEach((label, i) => reference(label, `stealth.${group}[${i}]`));
    number3(t.alarmLimit, "stealth.alarmLimit", 1, 16, true);
    number3(t.detectionSeconds, "stealth.detectionSeconds", 0.1, 10);
    number3(t.radius, "stealth.radius", 1, 16);
    number3(t.coneDegrees, "stealth.coneDegrees", 15, 360);
    list3(t.patrols, "stealth.patrols", 64).forEach((v, i) => {
      const p = `stealth.patrols[${i}]`, patrol = object3(v, p, ["actor", "route"]);
      reference(patrol.actor, `${p}.actor`);
      list3(patrol.route, `${p}.route`, 32, 2).forEach((pointValue, j) => point5(pointValue, `${p}.route[${j}]`));
    });
  }
  if (s.boss !== void 0) {
    const b = s.boss;
    reference(b.actor, "boss.actor");
    text(b.name, "boss.name", 96);
    number3(b.health, "boss.health", 100, 1e6);
    const bossActor = actorByLabel.get(b.actor);
    if (bossActor.side !== 1 || bossActor.kind !== "unit" || !s.army.some((a) => a.label === bossActor.label)) bad3("boss.actor", "boss must be a hostile targetable unit in the initial army");
    let prior = Infinity;
    b.phases.forEach((v, i) => {
      const p = `boss.phases[${i}]`, phase = v, below = number3(phase.below, `${p}.below`, 0, 1);
      if (i === 0 && below !== 1 || below >= prior) bad3(`${p}.below`, "phase thresholds must start at one and decrease");
      prior = below;
      text(phase.name, `${p}.name`, 96);
      number3(phase.radius, `${p}.radius`, 1, 16);
      number3(phase.damage, `${p}.damage`, 1, 1e3);
      number3(phase.warningSeconds, `${p}.warningSeconds`, 0.5, 10);
      number3(phase.cooldown, `${p}.cooldown`, 2, 60);
      number3(phase.interruptDamage, `${p}.interruptDamage`, 1, 1e4);
    });
  }
  if (s.requiredActions !== void 0) list3(s.requiredActions, "requiredActions", 8).forEach((v, i) => {
    const p = `requiredActions[${i}]`, a = object3(v, p, ["action", "count", "text"], ["ability"]);
    choice3(a.action, `${p}.action`, ["ability", "hold", "repair", "gather"]);
    if (a.ability !== void 0) {
      if (a.action !== "ability") bad3(`${p}.ability`, "only ability actions can declare an ability");
      choice3(a.ability, `${p}.ability`, Object.keys(ABILITIES));
    }
    number3(a.count, `${p}.count`, 1, 256, true);
    text(a.text, `${p}.text`);
  });
  return value2;
}

// src/core/versions.ts
var SIMULATION_REVISION = "4.0.1";
var LEGACY_SIMULATION_REVISIONS = {
  1: "1.0.0",
  2: "2.0.0",
  3: "3.0.0",
  4: "4.0.0"
};

// src/core/scenarios.ts
var MAX_SCENARIO_ACTIONS_PER_TICK = 128;
var commandListeners = /* @__PURE__ */ new WeakMap();
var commandGeneration = /* @__PURE__ */ new WeakMap();
var scriptedCommands = /* @__PURE__ */ new WeakSet();
function bindScenarioState(session) {
  session.state.scenario = { definition: session.definition, runtime: session.runtime, ...session.simulationRevision === void 0 ? {} : { simulationRevision: session.simulationRevision } };
}
function scenarioSessionForState(state) {
  const binding = state.scenario;
  return binding ? { ...binding, state } : null;
}
function scenarioRulesCompatibility(session) {
  const revision = session.simulationRevision ?? "unknown";
  const reason = session.simulationRevision === void 0 ? "This mission has no pinned simulation rules. It is available for inspection." : revision !== SIMULATION_REVISION ? `This mission uses simulation rules ${revision}; this build uses ${SIMULATION_REVISION}. It is available for inspection.` : null;
  return { compatible: reason === null, reason, revision };
}
function scenarioStateRulesCompatible(state) {
  const session = scenarioSessionForState(state);
  return !session || scenarioRulesCompatibility(session).compatible;
}
function requireScenarioRules(session) {
  const result = scenarioRulesCompatibility(session);
  if (!result.compatible) throw new Error(result.reason);
}
function isScenarioScriptedCommand(state) {
  return scriptedCommands.has(state);
}
function scriptedCommand(state, side2, command) {
  const prior = scriptedCommands.has(state);
  scriptedCommands.add(state);
  try {
    return issueCommand(state, side2, command);
  } finally {
    if (!prior) scriptedCommands.delete(state);
  }
}
function subscribeScenarioCommands(session, listener) {
  let listeners = commandListeners.get(session.state);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    commandListeners.set(session.state, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) commandListeners.delete(session.state);
  };
}
var distance11 = (a, b) => (a.level ?? 0) === (b.level ?? 0) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var clone = (value2) => JSON.parse(JSON.stringify(value2));
var actor = (session, label) => session.state.entities.find((e) => e.id === session.runtime.labels[label] && e.hp > 0);
var visible4 = (state, side2, point5) => !!state.visible[side2]?.has(fogKey(state, point5));
var variable = (session, key) => session.runtime.variables[key] ?? 0;
function addVariable(session, key, value2) {
  session.runtime.variables[key] = Math.max(-1e9, Math.min(1e9, variable(session, key) + value2));
}
function scenarioCondition(session, condition2) {
  switch (condition2.type) {
    case "alive":
      return !!actor(session, condition2.actor);
    case "dead":
      return Object.hasOwn(session.runtime.labels, condition2.actor) && !actor(session, condition2.actor);
    case "at": {
      const entity = actor(session, condition2.actor);
      return !!entity && distance11(entity, condition2.point) <= condition2.radius;
    }
    case "time":
      return session.state.time + 1e-9 >= condition2.seconds;
    case "variable": {
      const n = variable(session, condition2.key);
      return condition2.op === "eq" ? n === condition2.value : condition2.op === "gte" ? n >= condition2.value : n <= condition2.value;
    }
    case "cleared":
      return !session.state.entities.some((e) => e.hp > 0 && e.side === condition2.side && !e.illusion && (condition2.buildings || e.kind === "unit"));
    case "all":
      return condition2.conditions.every((c) => scenarioCondition(session, c));
    case "any":
      return condition2.conditions.some((c) => scenarioCondition(session, c));
    case "not":
      return !scenarioCondition(session, condition2.condition);
  }
}
function message3(session, text3, speaker) {
  const entry = { time: session.state.time, text: text3, ...speaker ? { speaker } : {} };
  session.runtime.messages.push(entry);
  if (session.runtime.messages.length > 128) session.runtime.messages.shift();
  const start = session.state.starts[0];
  session.state.events.push({ type: "message", side: 0, ...start, text: speaker ? `${speaker}: ${text3}` : text3 });
}
function finish2(session, outcome, reason) {
  if (session.runtime.outcome !== "playing") return;
  session.runtime.outcome = outcome;
  session.runtime.reason = reason;
  session.state.winner = outcome === "won" ? 0 : 1;
  session.state.winningTeam = session.state.teams[session.state.winner];
  session.state.draw = false;
  message3(session, outcome === "won" ? session.definition.successText : session.definition.failureText);
}
function updatePopulation2(state) {
  for (let side2 = 0; side2 < state.players.length; side2++) {
    const living = state.entities.filter((e) => e.side === side2 && e.hp > 0);
    state.players[side2].population = living.filter((e) => e.kind === "unit" && !e.illusion).length;
    state.players[side2].cap = Math.min(state.populationLimits[side2], living.filter((e) => e.kind === "building" && e.progress === 1).reduce((count, e) => count + (e.role === "hq" ? 12 : e.role === "depot" ? 10 : 0), 0));
  }
}
function spawnActors(session, actors) {
  const spawned = [];
  for (const definition2 of actors) {
    if (Object.hasOwn(session.runtime.labels, definition2.label)) throw new Error(`Scenario actor ${definition2.label} was spawned twice.`);
    if (session.state.entities.length >= 4096) {
      finish2(session, "lost", "The scenario exceeded its actor limit.");
      return;
    }
    const desired = { x: definition2.x, y: definition2.y, ...definition2.level === void 0 ? {} : { level: definition2.level } };
    const destination = definition2.kind === "unit" ? walkable(session.state, desired.x, desired.y, desired.level ?? 0) ? desired : openDestination(session.state, desired, desired) : desired;
    if (!destination) {
      finish2(session, "lost", `The spawn point for ${definition2.label} became blocked.`);
      return;
    }
    const entity = definition2.definitionId === void 0 ? spawnEntity(session.state, definition2.side, definition2.kind, definition2.role, destination.x, destination.y, 1, void 0, destination.level ?? 0) : spawnDefinition(session.state, definition2.side, definition2.kind, definition2.definitionId, destination.x, destination.y, 1, destination.level ?? 0);
    if (definition2.level !== void 0) entity.level = definition2.level;
    if (definition2.hp !== void 0) entity.hp = definition2.hp;
    session.runtime.labels[definition2.label] = entity.id;
    spawned.push(definition2);
    session.state.events.push({ type: definition2.kind === "unit" ? "train" : "build", side: definition2.side, source: entity.id, x: entity.x, y: entity.y, ...entity.level === void 0 ? {} : { level: entity.level }, text: definition2.label });
  }
  updatePopulation2(session.state);
  refreshVisibility(session.state);
  for (const definition2 of spawned) if (definition2.order) orderActors(session, [definition2.label], definition2.order);
}
function orderActors(session, labels, order3) {
  for (const side2 of [0, 1]) {
    const entities = labels.map((label) => actor(session, label)).filter((e) => !!e && e.side === side2);
    if (!entities.length) continue;
    const ids = entities.map((e) => e.id);
    const before = session.state.events.length;
    if (order3.type === "attack") {
      const target = actor(session, order3.actor);
      if (target) scriptedCommand(session.state, side2, { type: "attack", ids, target: target.id });
    } else scriptedCommand(session.state, side2, { ...order3, ids });
    if (side2 === 0) recordEvents(session, before);
  }
}
function createScenario(input, options = {}) {
  const definition2 = validateScenario(input);
  const firstId = options.firstEntityId ?? 1;
  if (!Number.isSafeInteger(firstId) || firstId < 1 || firstId > 2147483647 - 8192) throw new Error("Scenario starting entity ID is outside its range.");
  const construct2 = createMatch;
  const state = construct2({ map: { seed: definition2.seed, size: definition2.map?.size ?? "small", ...definition2.map?.world ? { world: definition2.map.world } : {} }, players: [
    { id: 0, teamId: 0, factionId: definition2.faction, controller: "human" },
    { id: 1, teamId: 1, factionId: definition2.opponent, controller: "external" }
  ], ...definition2.content ? { content: definition2.content } : {}, rules: { mode: "scenario", standardDefeat: false, startingAge: 3, startingResources: definition2.rules.resources } }, { scenario: true });
  state.entities = [];
  state.resources = [];
  state.events = [];
  state.corpses = [];
  if (state.world) {
    const offset = firstId - 1;
    for (const bridge of state.world.bridges) bridge.id += offset;
    for (const site of state.world.sites) {
      site.id += offset;
      site.creatureIds = site.creatureIds.map((id5) => id5 + offset);
    }
    for (const creature of state.world.creatures) {
      creature.id += offset;
      creature.site += offset;
      if (creature.target !== null) creature.target += offset;
    }
    state.nextId += offset;
  } else state.nextId = firstId;
  state.explored = [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()];
  state.visible = [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()];
  if (definition2.map) {
    state.width = definition2.map.width;
    state.height = definition2.map.height;
    state.mapSize = definition2.map.size;
    state.mapVersion = MAP_VERSION;
    state.terrain = [...definition2.map.terrain];
    state.starts = definition2.map.starts.map((p) => ({ ...p }));
    state.resources = definition2.map.resources.map((r) => ({ ...r, id: state.nextId++ }));
    if (state.world) state.world.levels[0].terrain = state.terrain;
    state.objectives = emptyObjectives(state);
  }
  const runtime2 = {
    version: 1,
    lastEvaluatedTick: 0,
    definitionId: definition2.id,
    outcome: "playing",
    reason: "",
    labels: {},
    variables: {},
    triggers: {},
    completed: [],
    messages: [],
    reinforcementRemaining: definition2.rules.reinforcementBudget,
    escort: { checkpoint: 0, moving: false },
    stealth: { alarms: 0, exposure: {}, detected: [], patrol: {}, distractedUntil: {} },
    boss: { phase: -1, nextAttack: 4, telegraph: null, phasesEntered: [], interrupted: 0, hits: 0, dodged: 0 },
    commandCounts: {}
  };
  const session = { definition: definition2, state, runtime: runtime2, simulationRevision: SIMULATION_REVISION };
  bindScenarioState(session);
  spawnActors(session, definition2.army);
  if (definition2.boss) {
    const boss = actor(session, definition2.boss.actor);
    boss.hp = definition2.boss.health;
    boss.maxHp = boss.hp;
  }
  message3(session, definition2.briefing);
  advanceStealth(session, 0);
  evaluateScenario(session);
  return session;
}
function action(session, value2) {
  switch (value2.type) {
    case "spawn":
      spawnActors(session, value2.actors);
      break;
    case "order":
      orderActors(session, value2.actors, value2.order);
      break;
    case "set":
      session.runtime.variables[value2.key] = value2.value;
      break;
    case "add":
      addVariable(session, value2.key, value2.value);
      break;
    case "message":
      message3(session, value2.text, value2.speaker);
      break;
    case "reward": {
      const player = session.state.players[value2.side];
      for (const key of ["wood", "ore", "crystal"]) player[key] = Math.min(1e9, player[key] + value2.resources[key]);
      break;
    }
    case "alliance":
      session.state.teams[1] = value2.allied ? session.state.teams[0] : session.state.teams[0] === 0 ? 1 : 0;
      refreshVisibility(session.state);
      break;
    case "finish":
      finish2(session, value2.outcome, value2.reason);
      break;
  }
}
function evaluateScenario(session) {
  requireScenarioRules(session);
  if (session.runtime.outcome !== "playing") return;
  const commander3 = actor(session, "commander");
  if (commander3) session.runtime.variables["equipment.commander"] = Object.values(commander3.equipment ?? {}).filter((id5) => session.state.specialists?.artifacts.some((item) => item.id === id5 && item.owner === commander3.side && item.holder === commander3.id && !item.position)).length;
  let budget = MAX_SCENARIO_ACTIONS_PER_TICK;
  for (const trigger of session.definition.events) {
    const prior = session.runtime.triggers[trigger.id], max = trigger.repeat?.count ?? 1;
    if ((prior?.count ?? 0) >= max || prior && session.state.time - prior.lastTime + 1e-9 < (trigger.repeat?.seconds ?? Infinity) || !scenarioCondition(session, trigger.when)) continue;
    if (budget < trigger.actions.length) break;
    budget -= trigger.actions.length;
    session.runtime.triggers[trigger.id] = { count: (prior?.count ?? 0) + 1, lastTime: session.state.time };
    for (const value2 of trigger.actions) {
      action(session, value2);
      if (session.runtime.outcome !== "playing") return;
    }
  }
  for (const objective of session.definition.objectives) if (objective.failure && scenarioCondition(session, objective.failure)) {
    finish2(session, "lost", objective.text);
    return;
  }
  for (const objective of session.definition.objectives) if (!session.runtime.completed.includes(objective.id) && scenarioCondition(session, objective.success)) {
    session.runtime.completed.push(objective.id);
    message3(session, `Objective completed: ${objective.text}`);
  }
  const actionsDone = (session.definition.requiredActions ?? []).every((required) => (session.runtime.commandCounts[required.ability ? `ability.${required.ability}` : required.action] ?? 0) >= required.count);
  if (session.definition.objectives.filter((o) => !o.optional).every((o) => session.runtime.completed.includes(o.id)) && actionsDone) finish2(session, "won", "All required objectives completed.");
  else if (session.state.time + 1e-9 >= session.definition.rules.timeLimit) finish2(session, "lost", "The mission time limit expired.");
}
function advanceEscort(session) {
  const definition2 = session.definition.escort;
  if (!definition2) return;
  const convoy = actor(session, definition2.actor), progress = session.runtime.escort;
  if (!convoy || progress.checkpoint >= definition2.route.length) return;
  const destination = definition2.route[progress.checkpoint];
  if (distance11(convoy, destination) <= definition2.radius) {
    progress.checkpoint++;
    progress.moving = false;
    session.runtime.variables["escort.checkpoints"] = progress.checkpoint;
    message3(session, `Convoy reached checkpoint ${progress.checkpoint} of ${definition2.route.length}.`);
    if (progress.checkpoint >= definition2.route.length) return;
  }
  const guarded = session.state.entities.some((e) => e.hp > 0 && e.id !== convoy.id && e.kind === "unit" && e.role !== "worker" && !e.illusion && isAllied(session.state, e.side, convoy.side) && distance11(e, convoy) <= definition2.escortRadius);
  if (!guarded && progress.moving) {
    scriptedCommand(session.state, convoy.side, { type: "stop", ids: [convoy.id] });
    progress.moving = false;
  }
  if (guarded && !progress.moving) {
    const next = definition2.route[progress.checkpoint];
    if ((next.level ?? 0) !== (convoy.level ?? 0)) {
      const transition = session.state.world?.transitions.find((t) => t.from.level === (convoy.level ?? 0) && t.to.level === (next.level ?? 0) || t.to.level === (convoy.level ?? 0) && t.from.level === (next.level ?? 0));
      if (transition) progress.moving = scriptedCommand(session.state, convoy.side, { type: "traverse", ids: [convoy.id], transition: transition.id });
    } else progress.moving = scriptedCommand(session.state, convoy.side, { type: "move", ids: [convoy.id], ...next });
  }
  if (progress.moving && convoy.order.type === "idle") progress.moving = false;
}
function detectionLine(state, from, to) {
  const length2 = distance11(from, to), steps = Math.ceil(length2 * 3);
  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    if (terrainAt(state, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.level ?? 0) === "rock") return false;
  }
  return true;
}
function guardDetects(session, guard, target) {
  const stealth2 = session.definition.stealth;
  if (!stealth2 || !isHostile(session.state, guard.side, target.side) || !visible4(session.state, guard.side, target) || distance11(guard, target) > stealth2.radius || !detectionLine(session.state, guard, target)) return false;
  const dx = target.x - guard.x, dy = target.y - guard.y, length2 = length2D(dx, dy);
  const facing = DIRECTIONS_32[guard.facing * 4];
  return length2 === 0 || dx * facing[0] + dy * facing[1] >= length2 * coneCosine(stealth2.coneDegrees);
}
function advanceStealth(session, dt) {
  const definition2 = session.definition.stealth;
  if (!definition2) return;
  const progress = session.runtime.stealth;
  for (const label of definition2.guards) {
    const guard = actor(session, label);
    if (!guard) continue;
    const illusion = session.state.entities.filter((e) => e.hp > 0 && e.illusion && guardDetects(session, guard, e)).sort((a, b) => distance11(a, guard) - distance11(b, guard) || a.id - b.id)[0];
    if (illusion) {
      if (guard.order.type !== "attack" || guard.order.target !== illusion.id) {
        scriptedCommand(session.state, guard.side, { type: "attack", ids: [guard.id], target: illusion.id });
        message3(session, "A patrol turned toward an illusion.");
        addVariable(session, "stealth.diversions", 1);
      }
      progress.distractedUntil[label] = session.state.time + 1;
    }
    if ((progress.distractedUntil[label] ?? 0) > session.state.time) continue;
    const patrol = definition2.patrols.find((p) => p.actor === label);
    if (patrol && !progress.detected.length) {
      let index2 = progress.patrol[label] ?? 0;
      if (distance11(guard, patrol.route[index2]) <= 0.65) {
        index2 = (index2 + 1) % patrol.route.length;
        progress.patrol[label] = index2;
      }
      const next = patrol.route[index2];
      if (guard.order.type !== "move" || guard.order.x !== next.x || guard.order.y !== next.y) scriptedCommand(session.state, guard.side, { type: "move", ids: [guard.id], ...next });
    }
  }
  for (const label of definition2.infiltrators) {
    const infiltrator = actor(session, label);
    if (!infiltrator) continue;
    const seen = definition2.guards.some((guardLabel) => {
      const guard = actor(session, guardLabel);
      return !!guard && (progress.distractedUntil[guardLabel] ?? 0) <= session.state.time && guardDetects(session, guard, infiltrator);
    });
    progress.exposure[label] = seen ? Math.min(definition2.detectionSeconds, (progress.exposure[label] ?? 0) + dt) : Math.max(0, (progress.exposure[label] ?? 0) - dt * 2);
    if (progress.detected.includes(label)) {
      if (!seen && progress.exposure[label] === 0) {
        progress.detected = progress.detected.filter((id5) => id5 !== label);
        message3(session, "The patrol lost the infiltrator and resumed its route.");
      }
      continue;
    }
    if (progress.exposure[label] + 1e-9 < definition2.detectionSeconds) continue;
    progress.detected.push(label);
    progress.alarms++;
    session.runtime.variables["stealth.alarms"] = progress.alarms;
    message3(session, `Alarm ${progress.alarms}: ${label} was detected.`);
    for (const guardLabel of definition2.guards) {
      const guard = actor(session, guardLabel);
      if (guard) scriptedCommand(session.state, guard.side, { type: "attackMove", ids: [guard.id], x: infiltrator.x, y: infiltrator.y });
    }
    if (progress.alarms >= definition2.alarmLimit) {
      finish2(session, "lost", "The infiltrators raised the alarm.");
      return;
    }
  }
}
function hazardDamage(session, source2, target, amount) {
  const eventStart = session.state.events.length;
  if (applyScenarioDamage(session.state, source2, target, amount, { armorPiercing: true, text: "Telegraphed boss strike" })) recordEvents(session, eventStart);
}
function advanceBoss(session) {
  const definition2 = session.definition.boss;
  if (!definition2) return;
  const boss = actor(session, definition2.actor), progress = session.runtime.boss;
  if (!boss) {
    const warning = progress.telegraph;
    if (warning && !warning.interrupted && warning.hpAtStart >= definition2.phases[warning.phase].interruptDamage) {
      progress.interrupted++;
      session.runtime.variables["boss.interrupts"] = progress.interrupted;
    }
    session.runtime.variables["boss.defeated"] = 1;
    progress.telegraph = null;
    return;
  }
  const fraction = boss.hp / boss.maxHp;
  let phase = progress.phase;
  while (phase + 1 < definition2.phases.length && fraction <= definition2.phases[phase + 1].below) phase++;
  while (progress.phase < phase) {
    progress.phase++;
    progress.phasesEntered.push(progress.phase);
    session.runtime.variables["boss.phases"] = progress.phasesEntered.length;
    const entered = definition2.phases[progress.phase];
    message3(session, `${definition2.name}: ${entered.name}.`);
    spawnActors(session, entered.adds);
  }
  const mechanics = definition2.phases[progress.phase];
  if (progress.telegraph) {
    const warning = progress.telegraph;
    if (!warning.interrupted && warning.hpAtStart - boss.hp >= definition2.phases[warning.phase].interruptDamage) {
      warning.interrupted = true;
      progress.interrupted++;
      session.runtime.variables["boss.interrupts"] = progress.interrupted;
      message3(session, `${definition2.name}'s attack was interrupted.`);
    }
    if (session.state.time + 1e-9 < warning.resolveAt) return;
    if (!warning.interrupted) {
      const victims = session.state.entities.filter((e) => e.hp > 0 && isHostile(session.state, e.side, boss.side) && e.kind === "unit" && distance11(e, warning) <= warning.radius);
      for (const victim of victims) hazardDamage(session, boss, victim, definition2.phases[warning.phase].damage);
      if (victims.some((e) => !e.illusion)) progress.hits++;
      else {
        progress.dodged++;
        session.runtime.variables["boss.dodged"] = progress.dodged;
      }
    }
    progress.telegraph = null;
    progress.nextAttack = session.state.time + mechanics.cooldown;
    return;
  }
  if (session.state.time + 1e-9 < progress.nextAttack) return;
  const targets = session.state.entities.filter((e) => e.hp > 0 && e.side === 0 && e.kind === "unit" && !e.illusion && visible4(session.state, boss.side, e)).sort((a, b) => distance11(a, boss) - distance11(b, boss) || a.id - b.id);
  if (!targets.length) {
    progress.nextAttack = session.state.time + 1;
    return;
  }
  const target = targets[0];
  progress.telegraph = { x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level }, radius: mechanics.radius, resolveAt: session.state.time + mechanics.warningSeconds, source: boss.id, phase: progress.phase, hpAtStart: boss.hp, interrupted: false };
  message3(session, `${definition2.name} marks (${target.x.toFixed(1)}, ${target.y.toFixed(1)}). Move outside ${mechanics.radius} tiles before ${mechanics.warningSeconds} seconds, or interrupt with ${mechanics.interruptDamage} damage.`);
}
function recordEvents(session, start = 0) {
  for (const event of session.state.events.slice(start)) {
    if (event.type === "ability" && event.side === 0 && event.source !== void 0) {
      const source2 = session.state.entities.find((entity) => entity.id === event.source), ability = source2?.kind === "unit" ? unitFor(session.state, source2).ability : void 0;
      if (ability && (event.text === void 0 || event.text === ABILITIES[ability].name)) {
        session.runtime.commandCounts.ability = (session.runtime.commandCounts.ability ?? 0) + 1;
        const key = `ability.${ability}`;
        session.runtime.commandCounts[key] = (session.runtime.commandCounts[key] ?? 0) + 1;
        addVariable(session, "action.ability", 1);
        addVariable(session, `action.${key}`, 1);
      }
    }
    if (event.type === "death") {
      const dead2 = session.state.entities.find((e) => e.id === event.source);
      if (dead2?.kind === "unit" && !dead2.illusion && !dead2.raised) addVariable(session, `deaths.${dead2.side}`, 1);
    }
  }
}
function afterScenarioStep(session, dt) {
  requireScenarioRules(session);
  if (session.runtime.outcome !== "playing" || session.runtime.lastEvaluatedTick >= session.state.tick) return;
  session.runtime.lastEvaluatedTick = session.state.tick;
  recordEvents(session);
  advanceEscort(session);
  advanceStealth(session, dt);
  advanceBoss(session);
  evaluateScenario(session);
}
function stepScenario(session, dt = 0.05) {
  requireScenarioRules(session);
  if (session.runtime.outcome !== "playing") return;
  if (Math.abs(dt - 0.05) > 1e-9) throw new Error("Scenarios advance with the shared 0.05-second tick.");
  stepGame(session.state, dt);
  afterScenarioStep(session, dt);
}
function issueScenarioCommand(session, side2, command) {
  if (!validateCommand(command) || !scenarioCommandPermitted(session.state, side2, command)) return false;
  const eventStart = session.state.events.length;
  const before = commandGeneration.get(session.state) ?? 0;
  if (!issueCommand(session.state, side2, command)) return false;
  if (before === (commandGeneration.get(session.state) ?? 0)) afterScenarioCommand(session.state, side2, command, eventStart);
  return true;
}
function scenarioCommandPermitted(state, side2, command) {
  const session = scenarioSessionForState(state);
  if (!session || isScenarioScriptedCommand(state)) return true;
  if (!scenarioRulesCompatibility(session).compatible) return false;
  if (side2 !== 0 || session.runtime.outcome !== "playing") return false;
  if (side2 === 0 && ["build", "research", "buildEconomy", "plantGrove", "specializeSettlement", "engineerBuild"].includes(command.type) && session.definition.rules.fixedArmy) return false;
  return !(side2 === 0 && (command.type === "train" || command.type === "trainCaravan" || command.type === "recruitVillage") && (session.definition.rules.fixedArmy || session.runtime.reinforcementRemaining <= 0));
}
function afterScenarioCommand(state, side2, command, eventStart) {
  const session = scenarioSessionForState(state);
  if (!session || isScenarioScriptedCommand(state)) return;
  commandGeneration.set(state, (commandGeneration.get(state) ?? 0) + 1);
  if (side2 === 0) {
    if (command.type === "train" || command.type === "trainCaravan" || command.type === "recruitVillage") session.runtime.reinforcementRemaining--;
    if (command.type !== "ability") {
      session.runtime.commandCounts[command.type] = (session.runtime.commandCounts[command.type] ?? 0) + 1;
      addVariable(session, `action.${command.type}`, 1);
    }
    recordEvents(session, eventStart);
  }
  for (const listener of [...commandListeners.get(state) ?? []]) {
    try {
      listener(side2, clone(command));
    } catch (error) {
      console.error("Scenario command observer failed", error);
    }
  }
}
function captureScenario(session) {
  const game = saveGame(session.state, { omitScenarioBinding: true });
  return { format: "orcs-vs-fairies-scenario", version: 1, definition: clone(session.definition), runtime: clone(session.runtime), game, ...session.simulationRevision === void 0 ? {} : { simulationRevision: session.simulationRevision } };
}
function restoreScenario(input) {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > 18 * 1024 * 1024) throw new Error("Scenario checkpoint exceeds its size limit.");
    raw = JSON.parse(raw);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid scenario checkpoint.");
  const envelope = scenarioJson(raw, { maxBytes: 18 * 1024 * 1024, maxNodes: 1e6, maxArrayLength: 1e5 });
  if (Object.keys(envelope).some((key) => !["format", "version", "definition", "runtime", "game", "simulationRevision"].includes(key)) || envelope.format !== "orcs-vs-fairies-scenario" || envelope.version !== 1 || envelope.simulationRevision !== void 0 && (typeof envelope.simulationRevision !== "string" || !/^\d+\.\d+\.\d+$/.test(envelope.simulationRevision) || envelope.simulationRevision.length > 80)) throw new Error("Unsupported scenario checkpoint.");
  const historical = envelope.game.version < 4;
  let definition2 = validateScenario(envelope.definition, { historicalContent: historical });
  if (historical && definition2.content) definition2 = validateScenario({ ...definition2, content: migrateHistoricalContentBundle(definition2.content) });
  const state = loadGame(envelope.game), runtime2 = scenarioJson(envelope.runtime);
  if (runtime2 && !Object.hasOwn(runtime2, "lastEvaluatedTick")) runtime2.lastEvaluatedTick = state.tick;
  validateRuntime2(definition2, state, runtime2);
  const session = { definition: definition2, state, runtime: runtime2, ...envelope.simulationRevision === void 0 ? {} : { simulationRevision: envelope.simulationRevision } };
  bindScenarioState(session);
  return session;
}
function validateScenarioBinding(input, state, historicalContent = false) {
  const binding = scenarioJson(input);
  if (!binding || typeof binding !== "object" || Array.isArray(binding) || Object.keys(binding).some((key) => !["definition", "runtime", "simulationRevision"].includes(key)) || !Object.hasOwn(binding, "definition") || !Object.hasOwn(binding, "runtime") || binding.simulationRevision !== void 0 && (typeof binding.simulationRevision !== "string" || !/^\d+\.\d+\.\d+$/.test(binding.simulationRevision) || binding.simulationRevision.length > 80)) throw new Error("Invalid saved scenario binding.");
  const definition2 = validateScenario(binding.definition, { historicalContent });
  validateRuntime2(definition2, state, binding.runtime);
  return { definition: definition2, runtime: binding.runtime, ...binding.simulationRevision === void 0 ? {} : { simulationRevision: binding.simulationRevision } };
}
function validateRuntime2(definition2, state, runtime2) {
  const fail2 = (reason) => {
    throw new Error(`Invalid scenario runtime: ${reason}.`);
  };
  const fields2 = ["version", "lastEvaluatedTick", "definitionId", "outcome", "reason", "labels", "variables", "triggers", "completed", "messages", "reinforcementRemaining", "escort", "stealth", "boss", "commandCounts"];
  if (!runtime2 || typeof runtime2 !== "object" || Array.isArray(runtime2) || fields2.some((key) => !Object.hasOwn(runtime2, key)) || Object.keys(runtime2).some((key) => !fields2.includes(key))) fail2("unknown or missing field");
  if (runtime2.version !== 1 || runtime2.definitionId !== definition2.id || !["playing", "won", "lost"].includes(runtime2.outcome) || typeof runtime2.reason !== "string" || runtime2.reason.length > 4096) fail2("identity or outcome");
  if (state.players.length !== 2 || state.players[0].faction !== definition2.faction || state.players[1].faction !== definition2.opponent || state.seed !== definition2.seed || state.rules.mode !== "scenario" || state.rules.standardDefeat || definition2.content?.hash !== state.content?.hash) fail2("match identity");
  if (runtime2.outcome === "playing" && (state.winner !== null || state.draw) || runtime2.outcome === "won" && state.winner !== 0 || runtime2.outcome === "lost" && state.winner !== 1) fail2("result disagrees with simulation");
  const finite2 = (n, min = 0, max = 1e9, integer2 = false) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max && (!integer2 || Number.isSafeInteger(n));
  if (!finite2(runtime2.lastEvaluatedTick, 0, state.tick, true)) fail2("evaluated tick");
  const record6 = (value2) => !!value2 && typeof value2 === "object" && !Array.isArray(value2);
  const exact = (value2, keys3) => record6(value2) && keys3.every((key) => Object.hasOwn(value2, key)) && Object.keys(value2).every((key) => keys3.includes(key));
  const counters = (value2, max = 1e9, negative = false) => record6(value2) && Object.keys(value2).length <= 2048 && Object.entries(value2).every(([key, n]) => /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(key) && finite2(n, negative ? -1e9 : 0, max));
  const actors = [...definition2.army, ...definition2.events.flatMap((e) => e.actions.flatMap((a) => a.type === "spawn" ? a.actors : [])), ...definition2.boss?.phases.flatMap((p) => p.adds) ?? []];
  const labels = new Set(actors.map((a) => a.label));
  if (!record6(runtime2.labels) || Object.entries(runtime2.labels).some(([label, id5]) => !labels.has(label) || !finite2(id5, 1, state.nextId - 1, true)) || new Set(Object.values(runtime2.labels)).size !== Object.values(runtime2.labels).length || definition2.army.some((a) => !Object.hasOwn(runtime2.labels, a.label))) fail2("actor references");
  for (const [label, id5] of Object.entries(runtime2.labels)) {
    const e = state.entities.find((e2) => e2.id === id5), a = actors.find((a2) => a2.label === label);
    if (e && (e.side !== a.side || e.kind !== a.kind || e.role !== a.role || a.definitionId !== void 0 && e.definitionId !== a.definitionId)) fail2("actor ownership or definition changed");
  }
  if (!counters(runtime2.variables, 1e9, true) || !counters(runtime2.commandCounts) || !finite2(runtime2.reinforcementRemaining, 0, definition2.rules.reinforcementBudget, true)) fail2("variables or reinforcement budget");
  if (!record6(runtime2.triggers)) fail2("trigger record");
  for (const [id5, entry] of Object.entries(runtime2.triggers)) {
    const e = definition2.events.find((e2) => e2.id === id5);
    if (!e || !exact(entry, ["count", "lastTime"]) || !finite2(entry.count, 1, e.repeat?.count ?? 1, true) || !finite2(entry.lastTime, 0, state.time)) fail2("trigger schedule");
  }
  if (!Array.isArray(runtime2.completed) || runtime2.completed.some((id5) => !definition2.objectives.some((o) => o.id === id5)) || new Set(runtime2.completed).size !== runtime2.completed.length) fail2("objective progress");
  if (!Array.isArray(runtime2.messages) || runtime2.messages.length > 128 || runtime2.messages.some((m) => !record6(m) || Object.keys(m).some((k) => !["time", "text", "speaker"].includes(k)) || !finite2(m.time, 0, state.time) || typeof m.text !== "string" || m.text.length > 4096 || m.speaker !== void 0 && (typeof m.speaker !== "string" || m.speaker.length > 96))) fail2("messages");
  if (!exact(runtime2.escort, ["checkpoint", "moving"]) || !finite2(runtime2.escort.checkpoint, 0, definition2.escort?.route.length ?? 0, true) || typeof runtime2.escort.moving !== "boolean") fail2("escort progress");
  const stealth2 = runtime2.stealth;
  if (!exact(stealth2, ["alarms", "exposure", "detected", "patrol", "distractedUntil"]) || !finite2(stealth2.alarms, 0, definition2.stealth?.alarmLimit ?? 0, true) || !counters(stealth2.exposure, 10) || !counters(stealth2.patrol, 31) || !counters(stealth2.distractedUntil) || !Array.isArray(stealth2.detected) || stealth2.detected.some((label) => !definition2.stealth?.infiltrators.includes(label)) || new Set(stealth2.detected).size !== stealth2.detected.length) fail2("stealth progress");
  if (Object.keys(stealth2.patrol).some((label) => {
    const p = definition2.stealth?.patrols.find((p2) => p2.actor === label);
    return !p || !finite2(stealth2.patrol[label], 0, p.route.length - 1, true);
  })) fail2("patrol waypoint");
  const boss = runtime2.boss;
  if (!exact(boss, ["phase", "nextAttack", "telegraph", "phasesEntered", "interrupted", "hits", "dodged"]) || !finite2(boss.phase, -1, (definition2.boss?.phases.length ?? 0) - 1, true) || !finite2(boss.nextAttack) || !Array.isArray(boss.phasesEntered) || boss.phasesEntered.some((n, i) => n !== i || n > boss.phase) || !finite2(boss.interrupted, 0, 1e6, true) || !finite2(boss.hits, 0, 1e6, true) || !finite2(boss.dodged, 0, 1e6, true)) fail2("boss progress");
  if (boss.telegraph !== null) {
    const t = boss.telegraph;
    const keys3 = ["x", "y", "radius", "resolveAt", "source", "phase", "hpAtStart", "interrupted", ...t.level === void 0 ? [] : ["level"]];
    if (!definition2.boss || !exact(t, keys3) || !finite2(t.x, 0, state.width) || !finite2(t.y, 0, state.height) || t.level !== void 0 && !finite2(t.level, 0, (state.world?.levels.length ?? 1) - 1, true) || !finite2(t.radius, 1, 16) || !finite2(t.resolveAt, 0, state.time + 10) || t.source !== runtime2.labels[definition2.boss.actor] || !finite2(t.phase, 0, boss.phase, true) || !finite2(t.hpAtStart, 0, definition2.boss.health) || typeof t.interrupted !== "boolean") fail2("boss telegraph");
  }
}

// src/core/scenario-recordings.ts
var SCENARIO_RECORDING_LIMITS = { maxBytes: 20 * 1024 * 1024, maxNodes: 1e6, maxArrayLength: 1e5 };
function scenarioRecordingRulesCompatibility(recording) {
  const revision = recording.version === 2 ? recording.simulationRevision : LEGACY_SIMULATION_REVISIONS[recording.initial.game.version] ?? "unknown";
  const reason = recording.version === 1 ? "This mission journal has no pinned simulation rules. It is available for inspection." : revision !== SIMULATION_REVISION ? `This mission journal uses simulation rules ${revision}; this build uses ${SIMULATION_REVISION}. It is available for inspection.` : recording.initial.simulationRevision !== revision ? "The journal initial mission has historical or unpinned simulation rules. It is available for inspection." : recording.checksumVersion !== SAVE_VERSION || recording.initial.game.version !== SAVE_VERSION ? "This mission journal uses an older save checksum format. It is available for inspection." : null;
  return { compatible: reason === null, reason, revision };
}
function requireCompatible(recording) {
  const result = scenarioRecordingRulesCompatibility(recording);
  if (!result.compatible) throw new Error(result.reason);
}
function scenarioCheckpointChecksum(rawCheckpoint) {
  const checkpoint = scenarioJson(rawCheckpoint, SCENARIO_RECORDING_LIMITS);
  if (!checkpoint || checkpoint.format !== "orcs-vs-fairies-scenario" || checkpoint.version !== 1 || !checkpoint.runtime || typeof checkpoint.runtime !== "object" || Array.isArray(checkpoint.runtime)) throw new Error("Invalid scenario checkpoint.");
  delete checkpoint.runtime.lastEvaluatedTick;
  const text3 = JSON.stringify(checkpoint);
  let hash3 = 2166136261;
  for (let i = 0; i < text3.length; i++) {
    hash3 ^= text3.charCodeAt(i);
    hash3 = Math.imul(hash3, 16777619);
  }
  return (hash3 >>> 0).toString(16).padStart(8, "0");
}
function scenarioChecksum(session) {
  return scenarioCheckpointChecksum(captureScenario(session));
}
function scenarioStateEquals(left, right) {
  const text3 = (session) => {
    const checkpoint = captureScenario(session);
    delete checkpoint.runtime.lastEvaluatedTick;
    const canonical3 = (value2) => Array.isArray(value2) ? value2.map(canonical3) : value2 !== null && typeof value2 === "object" ? Object.fromEntries(Object.entries(value2).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, child]) => [key, canonical3(child)])) : value2;
    return JSON.stringify(canonical3(checkpoint));
  };
  return text3(left) === text3(right);
}
function decodeScenarioRecording(input) {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > 20 * 1024 * 1024) throw new Error("Scenario recording is too large.");
    raw = JSON.parse(raw);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid scenario recording.");
  const record6 = scenarioJson(raw, SCENARIO_RECORDING_LIMITS);
  const keys3 = ["format", "version", "initial", "commands", "finalTick", "finalChecksum", ...record6.version === 2 ? ["simulationRevision", "checksumVersion"] : []];
  if (Object.keys(record6).some((key) => !keys3.includes(key)) || keys3.some((key) => !Object.hasOwn(record6, key)) || record6.format !== "orcs-vs-fairies-scenario-recording" || ![1, 2].includes(record6.version)) throw new Error("Unsupported scenario recording.");
  if (record6.version === 2 && (typeof record6.simulationRevision !== "string" || !/^\d+\.\d+\.\d+$/.test(record6.simulationRevision) || record6.simulationRevision.length > 80 || ![1, 2, 3, 4].includes(record6.checksumVersion) || record6.checksumVersion !== record6.initial?.game?.version)) throw new Error("Invalid scenario recording rules or checksum version.");
  const initial = restoreScenario(record6.initial);
  if (!Number.isSafeInteger(record6.finalTick) || record6.finalTick < initial.state.tick || record6.finalTick - initial.state.tick > 144e3 || typeof record6.finalChecksum !== "string" || !/^[a-f0-9]{8}$/.test(record6.finalChecksum)) throw new Error("Invalid scenario recording duration or checksum.");
  if (!Array.isArray(record6.commands) || record6.commands.length > 1e5) throw new Error("Invalid scenario command count.");
  let prior = initial.state.tick;
  for (let i = 0; i < record6.commands.length; i++) {
    if (!Object.hasOwn(record6.commands, i)) throw new Error("Scenario commands contain gaps.");
    const action2 = record6.commands[i];
    if (!action2 || typeof action2 !== "object" || Array.isArray(action2) || Object.keys(action2).some((key) => !["tick", "side", "command"].includes(key)) || !Number.isSafeInteger(action2.tick) || action2.tick < prior || action2.tick > record6.finalTick || action2.side !== 0 || !validateCommand(action2.command)) throw new Error("Invalid scenario command.");
    prior = action2.tick;
  }
  return record6;
}
function verifyScenarioRecording(input) {
  const recording = decodeScenarioRecording(input);
  requireCompatible(recording);
  const session = restoreScenario(recording.initial);
  let index2 = 0;
  while (session.state.tick <= recording.finalTick) {
    while (index2 < recording.commands.length && recording.commands[index2].tick === session.state.tick) {
      const action2 = recording.commands[index2++];
      if (!issueScenarioCommand(session, action2.side, action2.command)) throw new Error(`Scenario command diverged at tick ${session.state.tick}.`);
    }
    if (session.state.tick === recording.finalTick) break;
    if (session.runtime.outcome !== "playing") throw new Error("Scenario recording continues after its result.");
    stepScenario(session);
  }
  if (index2 !== recording.commands.length || scenarioChecksum(session) !== recording.finalChecksum) throw new Error("Scenario recording checksum diverged.");
  return session;
}
var ScenarioRecorder = class {
  constructor(session, previous) {
    this.session = session;
    const compatibility = scenarioRulesCompatibility(session);
    if (!compatibility.compatible) throw new Error(compatibility.reason);
    if (previous) {
      const recording = decodeScenarioRecording(previous);
      requireCompatible(recording);
      if (recording.finalTick !== session.state.tick || !scenarioStateEquals(verifyScenarioRecording(recording), session)) throw new Error("Saved scenario recording does not match its checkpoint.");
      this.initial = recording.initial;
      this.commands = recording.commands;
    } else {
      this.initial = captureScenario(session);
      this.commands = [];
    }
    this.unsubscribe = subscribeScenarioCommands(session, (side2, command) => {
      if (this.commands.length >= 1e5) {
        this.failure = "Scenario recording command limit reached.";
        return;
      }
      this.commands.push({ tick: session.state.tick, side: side2, command });
    });
  }
  session;
  failure = null;
  initial;
  commands;
  unsubscribe;
  archive() {
    if (this.failure) throw new Error(this.failure);
    return decodeScenarioRecording({ format: "orcs-vs-fairies-scenario-recording", version: 2, simulationRevision: SIMULATION_REVISION, checksumVersion: SAVE_VERSION, initial: structuredClone(this.initial), commands: structuredClone(this.commands), finalTick: this.session.state.tick, finalChecksum: scenarioChecksum(this.session) });
  }
  destroy() {
    this.unsubscribe();
  }
};

// src/core/campaign.ts
function survivingScenarioArmy(session) {
  const labels = new Map(Object.entries(session.runtime.labels).map(([label, id5]) => [id5, label]));
  return session.state.entities.filter((e) => e.side === 0 && e.kind === "unit" && e.hp > 0 && !e.illusion && !e.raised).map((entity) => {
    const artifacts = session.state.specialists?.artifacts.filter((item) => item.holder === entity.id && item.owner === entity.side) ?? [];
    return { entity: copy(entity), label: labels.get(entity.id) ?? null, ...artifacts.length ? { artifacts: copy(artifacts) } : {} };
  });
}
var copy = (value2) => structuredClone(value2);
var CAMPAIGN_PROFILE_LIMITS = { maxBytes: 20 * 1024 * 1024, maxNodes: 1e6, maxArrayLength: 1e5 };
function boundedProfile(profile) {
  if (!Number.isSafeInteger(profile.revision) || profile.revision < 0) throw new Error("The campaign revision limit has been reached. Start another profile.");
  scenarioJson(profile, CAMPAIGN_PROFILE_LIMITS);
  return profile;
}
function campaign(profile) {
  if (!Object.hasOwn(CAMPAIGNS, profile.campaignId)) throw new Error("Unknown campaign.");
  return CAMPAIGNS[profile.campaignId];
}
function campaignRulesCompatibility(profile) {
  const revision = profile.simulationRevision ?? "unknown";
  let reason = profile.simulationRevision === void 0 ? "This campaign has no pinned simulation rules. It is available for inspection." : revision !== SIMULATION_REVISION ? `This campaign uses simulation rules ${revision}; this build uses ${SIMULATION_REVISION}. It is available for inspection.` : null;
  if (reason === null) for (const battle of [...profile.history, ...profile.active ? [profile.active] : []]) {
    const checkpoint = scenarioRulesCompatibility(battle.checkpoint);
    if (!checkpoint.compatible) {
      reason = checkpoint.reason;
      break;
    }
    const journal = scenarioRecordingRulesCompatibility(battle.recording);
    if (!journal.compatible) {
      reason = journal.reason;
      break;
    }
  }
  return { compatible: reason === null, reason, revision };
}
function requireCampaignRules(profile) {
  const result = campaignRulesCompatibility(profile);
  if (!result.compatible) throw new Error(result.reason);
}
function createCampaignProfile(campaignId, id5) {
  if (!Object.hasOwn(CAMPAIGNS, campaignId)) throw new Error("Unknown campaign.");
  if (typeof id5 !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(id5)) throw new Error("Campaign profile ID is invalid.");
  return { format: "orcs-vs-fairies-campaign", version: 1, simulationRevision: SIMULATION_REVISION, id: id5, campaignId, choiceId: null, revision: 0, history: [], active: null };
}
function nextCampaignMission(profile) {
  const definition2 = campaign(profile), completed = profile.history.length;
  if (completed >= 4) return null;
  if (completed === 2) {
    if (!profile.choiceId) return null;
    const choice6 = definition2.choice.options.find((choice7) => choice7.id === profile.choiceId);
    if (!choice6) throw new Error("Unknown campaign branch.");
    return choice6.chapter3;
  }
  return definition2.chapters[completed];
}
function chooseCampaignBranch(profile, choiceId) {
  requireCampaignRules(profile);
  const definition2 = campaign(profile);
  if (profile.history.length !== 2 || profile.active) throw new Error("Choose a branch after completing chapter two.");
  if (!definition2.choice.options.some((choice6) => choice6.id === choiceId)) throw new Error("Unknown campaign branch.");
  if (profile.choiceId && profile.choiceId !== choiceId) throw new Error("This campaign already chose its branch. Start another profile to take the other route.");
  if (profile.choiceId === choiceId) return profile;
  return boundedProfile({ ...profile, choiceId, revision: profile.revision + 1 });
}
function campaignArmy(profile) {
  const army = /* @__PURE__ */ new Map();
  for (const result of profile.history) {
    for (const id5 of result.deployedIds) army.delete(id5);
    const session = restoreScenario(result.checkpoint);
    for (const soldier of survivingScenarioArmy(session)) army.set(soldier.entity.id, soldier);
  }
  return [...army.values()].sort((a, b) => a.entity.id - b.entity.id);
}
function deployScenarioArmy(session, soldiers, options = {}) {
  const deployed = [], available = [...soldiers];
  const slots = session.definition.army.filter((a) => a.side === 0 && a.kind === "unit" && !options.omitLabels?.includes(a.label)).sort((a, b) => Number(b.label === "commander") - Number(a.label === "commander"));
  for (const slot of slots) {
    const placeholder = session.state.entities.find((e) => e.id === session.runtime.labels[slot.label]);
    const exactDefinition = (a, b) => a.definitionId === b.definitionId;
    const index2 = available.findIndex((soldier2) => soldier2.entity.role === placeholder.role && exactDefinition(soldier2.entity, placeholder) && (slot.label === "commander" ? soldier2.label === "commander" : soldier2.label !== "commander"));
    if (index2 < 0) continue;
    const soldier = available.splice(index2, 1)[0], entity = copy(soldier.entity);
    entity.x = placeholder.x;
    entity.y = placeholder.y;
    if (placeholder.level !== void 0) entity.level = placeholder.level;
    else delete entity.level;
    entity.hp = entity.maxHp;
    entity.shield = entity.maxShield ?? 0;
    entity.order = copy(placeholder.order);
    delete entity.orderQueue;
    entity.path = [];
    entity.cooldown = 0;
    delete entity.abilityReadyAt;
    delete entity.entrenchedAt;
    delete entity.lastDamagedAt;
    delete entity.lastAttacker;
    delete entity.surgeUntil;
    entity.animation = "idle";
    entity.animTime = 0;
    entity.carried = 0;
    entity.expires = 0;
    entity.momentum = 0;
    delete entity.specialistBuffs;
    delete entity.burning;
    delete entity.siegeMode;
    if (entity.veteran) {
      entity.veteran.nextSurvivalAt = 60;
      entity.veteran.lastCombatAt = 0;
    }
    const artifactIds = /* @__PURE__ */ new Map();
    if (soldier.artifacts?.length) {
      if (soldier.artifacts.length > 12) throw new Error("A campaign soldier cannot carry more than twelve artifacts.");
      const state = session.state, specialist = state.specialists ??= { artifacts: [], structures: [], nextArtifactId: 1, nextStructureId: 1 };
      for (const source2 of soldier.artifacts) {
        if (source2.holder !== entity.id || source2.owner !== entity.side || source2.position || artifactIds.has(source2.id)) throw new Error("The campaign artifact does not belong to its survivor.");
        const id5 = specialist.nextArtifactId++;
        artifactIds.set(source2.id, id5);
        specialist.artifacts.push({ id: id5, definitionId: source2.definitionId, owner: entity.side, holder: entity.id });
      }
    }
    if (entity.equipment) for (const slot2 of Object.keys(entity.equipment)) {
      const id5 = artifactIds.get(entity.equipment[slot2]);
      if (id5 === void 0) throw new Error("Campaign equipment references an absent artifact.");
      entity.equipment[slot2] = id5;
    }
    const position2 = session.state.entities.indexOf(placeholder);
    session.state.entities[position2] = entity;
    session.runtime.labels[slot.label] = entity.id;
    deployed.push(entity.id);
    for (const event of session.state.events) if (event.source === placeholder.id) event.source = entity.id;
  }
  return deployed;
}
function prepareCampaignMission(profile) {
  requireCampaignRules(profile);
  if (profile.active) {
    const session2 = restoreScenario(profile.active.checkpoint);
    return { profile, session: session2, recorder: new ScenarioRecorder(session2, profile.active.recording) };
  }
  const missionId = nextCampaignMission(profile);
  if (!missionId) throw new Error(profile.history.length === 4 ? "This campaign is complete." : "Choose the next route before continuing.");
  const army = campaignArmy(profile), largestId = Math.max(0, ...army.map((s) => s.entity.id), ...profile.history.map((h) => h.checkpoint.game.state.nextId - 1));
  const session = createScenario(SCENARIOS[missionId], { firstEntityId: largestId + 1 });
  const deployedIds = deployScenarioArmy(session, army), recorder = new ScenarioRecorder(session);
  const active4 = { missionId, checkpoint: captureScenario(session), recording: recorder.archive(), deployedIds };
  try {
    return { profile: boundedProfile({ ...profile, active: active4, revision: profile.revision + 1 }), session, recorder };
  } catch (error) {
    recorder.destroy();
    throw error;
  }
}
function decodeCampaignProfile(input) {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > 20 * 1024 * 1024) throw new Error("Campaign profile is too large.");
    raw = JSON.parse(raw);
  }
  const profile = scenarioJson(raw, CAMPAIGN_PROFILE_LIMITS);
  const exact = (value2, fields2, optional = []) => !!value2 && typeof value2 === "object" && !Array.isArray(value2) && fields2.every((k) => Object.hasOwn(value2, k)) && Object.keys(value2).every((k) => fields2.includes(k) || optional.includes(k));
  if (!exact(profile, ["format", "version", "id", "campaignId", "choiceId", "revision", "history", "active"], ["simulationRevision"]) || profile.format !== "orcs-vs-fairies-campaign" || profile.version !== 1 || typeof profile.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(profile.id) || !Number.isSafeInteger(profile.revision) || profile.revision < 0 || !Array.isArray(profile.history) || profile.history.length > 4 || profile.simulationRevision !== void 0 && (typeof profile.simulationRevision !== "string" || profile.simulationRevision.length > 80 || !/^\d+\.\d+\.\d+$/.test(profile.simulationRevision))) throw new Error("Invalid campaign profile.");
  const definition2 = campaign(profile);
  if (profile.choiceId !== null && !definition2.choice.options.some((c) => c.id === profile.choiceId) || profile.history.length < 2 && profile.choiceId !== null || profile.history.length > 2 && profile.choiceId === null) throw new Error("Invalid saved campaign branch.");
  const seen = /* @__PURE__ */ new Set(), checkpoints = /* @__PURE__ */ new Map();
  const expectedChapter = (index2) => index2 === 2 ? definition2.choice.options.find((c) => c.id === profile.choiceId).chapter3 : definition2.chapters[index2];
  const validateBattle = (value2, expected, completed) => {
    if (!exact(value2, ["missionId", "checkpoint", "recording", "deployedIds", ...completed ? ["resultId"] : []]) || value2.missionId !== expected || !Array.isArray(value2.deployedIds) || value2.deployedIds.some((id5) => !Number.isSafeInteger(id5) || id5 < 1) || new Set(value2.deployedIds).size !== value2.deployedIds.length) throw new Error("Invalid campaign battle.");
    const checkpoint = restoreScenario(value2.checkpoint), recording = decodeScenarioRecording(value2.recording);
    if (checkpoint.definition.id !== expected || recording.initial.definition.id !== expected || recording.initial.definition.faction !== definition2.faction || JSON.stringify(value2.checkpoint.definition) !== JSON.stringify(recording.initial.definition) || recording.finalChecksum !== scenarioCheckpointChecksum(value2.checkpoint) || recording.finalTick !== value2.checkpoint.game.state.tick) throw new Error("Campaign battle checkpoint disagrees with its recording.");
    if (value2.deployedIds.some((id5) => !recording.initial.game.state.entities.some((e) => e.id === id5 && e.side === 0 && e.kind === "unit"))) throw new Error("Invalid campaign deployed army.");
    if (completed && (checkpoint.runtime.outcome !== "won" || checkpoint.state.winner !== 0)) throw new Error("Campaign history contains an invalid saved victory.");
    checkpoints.set(value2, checkpoint);
  };
  profile.history.forEach((result, index2) => {
    const expected = expectedChapter(index2);
    validateBattle(result, expected, true);
    if (result.resultId !== `${profile.id}/${expected}` || seen.has(result.resultId)) throw new Error("Duplicate or invalid campaign result.");
    seen.add(result.resultId);
  });
  if (profile.active !== null) {
    const expected = nextCampaignMission({ ...profile, active: null });
    if (!expected) throw new Error("A campaign cannot have an active battle before its branch choice or after its finale.");
    validateBattle(profile.active, expected, false);
  }
  if (!campaignRulesCompatibility(profile).compatible) return profile;
  let canonical3 = createCampaignProfile(profile.campaignId, profile.id);
  const validateCurrentBattle = (battle) => {
    if (JSON.stringify(battle.recording.initial.definition) !== JSON.stringify(SCENARIOS[battle.missionId])) throw new Error("Campaign battle checkpoint disagrees with its recording.");
    if (!scenarioStateEquals(verifyScenarioRecording(battle.recording), checkpoints.get(battle))) throw new Error("Campaign checkpoint does not match its replay.");
  };
  profile.history.forEach((result, index2) => {
    if (index2 === 2) canonical3 = chooseCampaignBranch(canonical3, profile.choiceId);
    validateCurrentBattle(result);
    const prepared = prepareCampaignMission(canonical3);
    prepared.recorder.destroy();
    if (!scenarioStateEquals(prepared.session, restoreScenario(result.recording.initial)) || JSON.stringify(prepared.profile.active.deployedIds) !== JSON.stringify(result.deployedIds)) throw new Error("Campaign history starts from an altered detachment.");
    canonical3 = { ...prepared.profile, history: [...canonical3.history, result], active: null };
  });
  if (profile.history.length === 2 && profile.choiceId) canonical3 = chooseCampaignBranch(canonical3, profile.choiceId);
  if (profile.active !== null) {
    validateCurrentBattle(profile.active);
    const prepared = prepareCampaignMission(canonical3);
    prepared.recorder.destroy();
    if (!scenarioStateEquals(prepared.session, restoreScenario(profile.active.recording.initial)) || JSON.stringify(prepared.profile.active.deployedIds) !== JSON.stringify(profile.active.deployedIds)) throw new Error("Campaign battle starts from an altered detachment.");
  }
  return profile;
}

// src/core/replays.ts
var FORMAT = "orcs-vs-fairies/replay";
var MAX_TICKS = 432e3;
var MAX_ACTIONS = 1e5;
var record3 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var integer = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
var exactKeys = (v, keys3) => Object.keys(v).every((k) => keys3.includes(k));
function decodeReplay(input) {
  if (typeof input === "string") {
    if (input.length > 20 * 1024 * 1024) throw new Error("Replay exceeds 20 MiB.");
    try {
      input = JSON.parse(input);
    } catch {
      throw new Error("Invalid replay JSON.");
    }
  }
  if (!record3(input) || !exactKeys(input, ["format", "version", "initial", "actions", "finalTick", "finalChecksum", "analysis", "technologies", "checksumVersion", "simulationRevision"]) || input.format !== FORMAT || input.version !== 1) throw new Error("Unsupported replay format or version.");
  const initial = decodeOriginalSaveEnvelope(input.initial).state;
  if (!record3(input.initial) || !integer(input.initial.version) || ![1, 2, 3, 4].includes(input.initial.version) || input.checksumVersion !== void 0 && input.checksumVersion !== input.initial.version) throw new Error("Replay checksum version must match its original save version.");
  if (input.simulationRevision !== void 0 && (typeof input.simulationRevision !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(input.simulationRevision))) throw new Error("Invalid simulation rules revision.");
  const validSide = (side2) => integer(side2) && side2 < initial.players.length;
  if (!Array.isArray(input.actions) || input.actions.length > MAX_ACTIONS) throw new Error("Invalid replay actions.");
  let ticks = 0;
  for (const action2 of input.actions) {
    if (!record3(action2)) throw new Error("Malformed replay action.");
    if (action2.type === "command") {
      if (!exactKeys(action2, ["type", "side", "command"]) || !validSide(action2.side) || !validateCommand(action2.command)) throw new Error("Malformed replay command.");
    } else if (action2.type === "advance") {
      if (!exactKeys(action2, ["type", "dt", "ticks"]) || typeof action2.dt !== "number" || !Number.isFinite(action2.dt) || action2.dt <= 0 || action2.dt > 0.25 || !integer(action2.ticks) || action2.ticks < 1) throw new Error("Invalid replay timestep.");
      ticks += action2.ticks;
      if (ticks > MAX_TICKS) throw new Error("Replay exceeds six hours at 20 ticks per second.");
    } else throw new Error("Unknown replay action.");
  }
  if (!integer(input.finalTick) || input.finalTick !== initial.tick + ticks || typeof input.finalChecksum !== "string" || !/^[0-9a-f]{8}$/.test(input.finalChecksum)) throw new Error("Invalid replay final state.");
  if (!Array.isArray(input.analysis) || input.analysis.length > MAX_TICKS + 1) throw new Error("Invalid replay analysis.");
  let lastTick = initial.tick - 1;
  for (const sample of input.analysis) {
    if (!record3(sample) || !exactKeys(sample, ["tick", "time", "players"]) || !integer(sample.tick) || sample.tick <= lastTick || sample.tick > input.finalTick || typeof sample.time !== "number" || !Number.isFinite(sample.time) || sample.time < initial.time || !Array.isArray(sample.players) || sample.players.length !== initial.players.length) throw new Error("Malformed replay sample.");
    lastTick = sample.tick;
    for (const player of sample.players) {
      if (!record3(player) || !exactKeys(player, ["wood", "ore", "crystal", "units", "buildings", "losses", "gathered", "upgrades", "armyValue", "buildingLosses", "lostValue"]) || !["wood", "ore", "crystal", "units", "buildings", "losses", "gathered"].every((k) => typeof player[k] === "number" && Number.isFinite(player[k]) && player[k] >= 0) || !["armyValue", "buildingLosses", "lostValue"].every((k) => player[k] === void 0 || typeof player[k] === "number" && Number.isFinite(player[k]) && player[k] >= 0) || !Array.isArray(player.upgrades) || !player.upgrades.every((x) => typeof x === "string" && x.length < 80)) throw new Error("Malformed replay army sample.");
    }
  }
  if (!Array.isArray(input.technologies) || input.technologies.length > 200) throw new Error("Invalid technology history.");
  for (const tech of input.technologies) {
    if (!record3(tech) || !exactKeys(tech, ["side", "upgrade", "tick", "time"]) || !validSide(tech.side) || typeof tech.upgrade !== "string" || tech.upgrade.length > 80 || !integer(tech.tick) || tech.tick < initial.tick || tech.tick > input.finalTick || typeof tech.time !== "number" || !Number.isFinite(tech.time) || tech.time < initial.time) throw new Error("Invalid technology timing.");
  }
  const decoded = structuredClone(input);
  decoded.checksumVersion = input.initial.version;
  decoded.simulationRevision = input.simulationRevision ?? LEGACY_SIMULATION_REVISIONS[input.initial.version];
  return decoded;
}

// src/core/planning.ts
var KINDS = ["wood", "ore", "crystal"];
var MAX_BLUEPRINTS = 100;
var MAX_COORDINATE = 1e4;
var roles2 = new Set(Object.keys(FACTIONS.orcs.buildings));
var own2 = (value2, key) => Object.prototype.hasOwnProperty.call(value2, key);
var record4 = (value2) => value2 !== null && typeof value2 === "object" && !Array.isArray(value2);
var validId = (value2) => typeof value2 === "number" && Number.isSafeInteger(value2) && value2 > 0;
var validSideNumber = (side2) => typeof side2 === "number" && Number.isSafeInteger(side2) && side2 >= 0 && side2 <= 7;
function validPlanningSide(state, side2) {
  return Number.isSafeInteger(side2) && side2 >= 0 && side2 < state.players.length && !!state.players[side2] && !!state.visible[side2] && !!state.explored[side2];
}
function validateWorkerTargets(input) {
  return record4(input) && Object.keys(input).length === KINDS.length && KINDS.every((kind) => own2(input, kind) && typeof input[kind] === "number" && Number.isInteger(input[kind]) && input[kind] >= 0 && input[kind] <= 1e4);
}
function workers(state, side2) {
  return state.entities.filter((e) => e.side === side2 && e.hp > 0 && e.kind === "unit" && e.role === "worker" && !e.illusion);
}
function validPosition(input, state) {
  return (input.level === void 0 || Number.isInteger(input.level) && input.level >= 0 && input.level < (state?.world?.levels.length ?? (state ? 1 : 2))) && Number.isFinite(input.x) && Number.isFinite(input.y) && input.x >= 0 && input.y >= 0 && input.x < Math.min(state?.width ?? MAX_COORDINATE, MAX_COORDINATE) && input.y < Math.min(state?.height ?? MAX_COORDINATE, MAX_COORDINATE);
}
function matchingBuilding(state, side2, item) {
  return state.entities.find((e) => e.id === item.buildingId && e.side === side2 && e.kind === "building" && e.role === item.role && sameLevel2(e, item) && Math.abs(e.x - item.x) < 1e-6 && Math.abs(e.y - item.y) < 1e-6 && e.hp > 0);
}
function decodeConstructionPlan(input, state, side2) {
  if (!record4(input) || Object.keys(input).some((key) => !["version", "side", "nextId", "blueprints"].includes(key)) || input.version !== 1 || !validSideNumber(input.side) || !validId(input.nextId) || input.nextId >= Number.MAX_SAFE_INTEGER || !Array.isArray(input.blueprints) || input.blueprints.length > MAX_BLUEPRINTS) return void 0;
  const planSide = input.side;
  if (side2 !== void 0 && planSide !== side2 || state && !validPlanningSide(state, planSide)) return void 0;
  const ids = /* @__PURE__ */ new Set(), buildings2 = /* @__PURE__ */ new Set(), blueprints = [];
  for (const value2 of input.blueprints) {
    if (!record4(value2) || Object.keys(value2).some((key) => !["id", "role", "x", "y", "level", "workerIds", "status", "buildingId", "reason"].includes(key))) return void 0;
    if (typeof value2.id !== "string" || !/^blueprint-[1-9]\d*$/.test(value2.id) || ids.has(value2.id) || typeof value2.role !== "string" || !roles2.has(value2.role) || typeof value2.x !== "number" || typeof value2.y !== "number" || !validPosition({ x: value2.x, y: value2.y, level: value2.level }, state)) return void 0;
    const sequence = Number(value2.id.slice("blueprint-".length));
    if (!Number.isSafeInteger(sequence) || sequence >= input.nextId) return void 0;
    if (!Array.isArray(value2.workerIds) || value2.workerIds.length > 100 || value2.workerIds.some((id5) => !validId(id5)) || new Set(value2.workerIds).size !== value2.workerIds.length) return void 0;
    if (value2.status !== "planned" && value2.status !== "building" && value2.status !== "complete") return void 0;
    if (value2.buildingId !== void 0 && (!validId(value2.buildingId) || buildings2.has(value2.buildingId)) || (value2.status === "planned" ? value2.buildingId !== void 0 : value2.buildingId === void 0)) return void 0;
    if (value2.reason !== void 0 && (typeof value2.reason !== "string" || value2.reason.length > 500)) return void 0;
    const item = { id: value2.id, role: value2.role, x: value2.x, y: value2.y, ...value2.level === void 0 ? {} : { level: value2.level }, workerIds: [...value2.workerIds], status: value2.status, ...value2.buildingId === void 0 ? {} : { buildingId: value2.buildingId }, ...value2.reason === void 0 ? {} : { reason: value2.reason } };
    if (state) {
      if (!isNormalBuildingDefinition(factionFor(state, planSide).buildings[item.role])) return void 0;
      const owned2 = new Set(workers(state, planSide).map((worker) => worker.id));
      if (item.workerIds.some((id5) => !owned2.has(id5))) return void 0;
      if (item.buildingId !== void 0) {
        const building5 = matchingBuilding(state, planSide, item);
        if (!building5 || item.status !== (building5.progress >= 1 ? "complete" : "building")) return void 0;
      }
    }
    ids.add(item.id);
    if (item.buildingId !== void 0) buildings2.add(item.buildingId);
    blueprints.push(item);
  }
  return { version: 1, side: planSide, nextId: input.nextId, blueprints };
}
function decodePlanningRuntime(input, state, side2) {
  if (!record4(input) || Object.keys(input).some((key) => !["version", "targets", "construction"].includes(key)) || input.version !== 1 || !validateWorkerTargets(input.targets)) return void 0;
  const construction = decodeConstructionPlan(input.construction, state, side2);
  return construction ? { version: 1, targets: { ...input.targets }, construction } : void 0;
}

// src/scenarios/conquest-world.ts
var regions = [
  {
    id: "hearth",
    name: "Hearth Valley",
    owner: "orcs",
    neighbors: ["grove", "quarry"],
    terrain: "grass",
    garrison: 3,
    supply: { wood: 120, ore: 40, crystal: 6 },
    objective: "hold",
    briefing: "The valley workshops feed the western settlements. Their militia protects the grain road rather than the old treaty: a neighbor who threatens the road loses the valley's trust. Hold its open approaches and keep a supplied route to the grove or quarry."
  },
  {
    id: "grove",
    name: "Ashwing Grove",
    owner: "fairies",
    neighbors: ["hearth", "crossroads"],
    terrain: "forest",
    garrison: 3,
    supply: { wood: 190, ore: 20, crystal: 18 },
    objective: "hold",
    briefing: "The Court guards the last unburned timber between Hearth and the eastern roads. Its wardens prefer an agreement that keeps armies out of the grove, but will fight anyone cutting a new military road. Hold the wooded clearing and protect the defenders from attacks along both trade paths."
  },
  {
    id: "quarry",
    name: "Deep Gate Quarry",
    owner: "dwarves",
    neighbors: ["hearth", "crossroads", "crypt"],
    terrain: "rock",
    garrison: 4,
    supply: { wood: 35, ore: 170, crystal: 12 },
    objective: "siege",
    briefing: "Deep Gate supplies ore to every realm but refuses the Keep's toll on finished metal. The engineers will bargain for a safe export road; threats make them prepare the firing shelves. Break the quarry fortress through its narrow approaches while keeping the siege weapons behind a screen."
  },
  {
    id: "crossroads",
    name: "Brass Crossroads",
    owner: "automata",
    neighbors: ["grove", "quarry", "coast", "keep"],
    terrain: "road",
    garrison: 4,
    supply: { wood: 80, ore: 80, crystal: 24 },
    objective: "crossing",
    briefing: "The crossing council keeps four routes open and records every unpaid crossing. It wants reliable tribute more than another ruined convoy, while the Keep demands exclusive passage. Secure the central crossing to connect the western supply roads to the coast and the eastern fortress."
  },
  {
    id: "crypt",
    name: "Ashen Crypt",
    owner: "undead",
    neighbors: ["quarry", "keep"],
    terrain: "mud",
    garrison: 3,
    supply: { wood: 45, ore: 45, crystal: 60 },
    objective: "hold",
    briefing: "The burial road joins the quarry to the Keep through a marsh. Its wardens guard the ledgers of workers lost building that road and will consider a truce that respects the graves. Hold the raised clearing, keep fragile casters behind the line, and watch for attacks through the wet flanks."
  },
  {
    id: "coast",
    name: "Returning Coast",
    owner: "tideborn",
    neighbors: ["crossroads", "keep"],
    terrain: "shallows",
    garrison: 4,
    supply: { wood: 70, ore: 40, crystal: 42 },
    objective: "crossing",
    briefing: "The harbor villages depend on a tide the Keep can divert. Their captains want the regulator opened and the coastal route free of toll troops. Secure the wet crossing between the piers; Tideborn move freely through the shallows, while dry-land troops need time to bring their formation across."
  },
  {
    id: "keep",
    name: "The Regent's Keep",
    owner: "automata",
    neighbors: ["crossroads", "crypt", "coast"],
    terrain: "snow",
    garrison: 6,
    supply: { wood: 90, ore: 160, crystal: 54 },
    objective: "siege",
    briefing: "The Regent controls the eastern road gates and the harbor regulator from a winter fortress. Its fortified approaches protect the strongest garrison in the realms, and its council rejects weak demands while the tolls still fund its army. Cut a supplied approach through the crossroads, crypt or coast, then breach the fortress with a protected siege line."
  }
];
var CONQUEST_WORLD = {
  id: "shattered-realms",
  title: "The Shattered Realms",
  introduction: "The old road treaty ended when the Regent took control of the eastern crossings. Every realm now guards a route it needs for food or trade. Begin in Hearth Valley, secure adjacent land to supply the army, and decide which neighbors can gain more from an agreement than another battle.",
  regions
};
var factions = ["orcs", "fairies", "dwarves", "undead", "tideborn", "automata"];
function conquestWorldFor(faction) {
  const index2 = factions.indexOf(faction);
  if (index2 < 0) throw new Error("Choose a known faction for world conquest.");
  const replacement = factions[(index2 + 1) % factions.length];
  return {
    ...CONQUEST_WORLD,
    regions: regions.map((region3) => ({
      ...region3,
      owner: region3.id === "hearth" ? faction : region3.owner === faction ? replacement : region3.owner,
      neighbors: [...region3.neighbors],
      supply: { ...region3.supply }
    }))
  };
}

// src/core/conquest.ts
var copy2 = (value2) => structuredClone(value2);
var CONQUEST_PROFILE_LIMITS = { maxBytes: 30 * 1024 * 1024, maxNodes: 15e5, maxArrayLength: 1e5 };
function boundedProfile2(profile) {
  scenarioJson(profile, CONQUEST_PROFILE_LIMITS);
  return profile;
}
var resources2 = ["wood", "ore", "crystal"];
var empty = () => ({ wood: 0, ore: 0, crystal: 0 });
var total = (a, b) => ({ wood: Math.min(1e6, a.wood + b.wood), ore: Math.min(1e6, a.ore + b.ore), crystal: Math.min(1e6, a.crystal + b.crystal) });
var world = (profile) => conquestWorldFor(profile.faction);
var region2 = (profile, id5) => {
  const found = world(profile).regions.find((r) => r.id === id5);
  if (!found) throw new Error("Unknown conquest region.");
  return found;
};
var protectedFaction = (profile, faction) => faction === profile.faction || profile.relations[faction].alliance || profile.relations[faction].truceUntil > profile.turn;
function requireDecisionRoom(profile) {
  if (profile.history.length >= 256) throw new Error("The conquest decision history is full. Start another realm.");
}
function conquestAid(profile) {
  const cost5 = FACTIONS[profile.faction].units.ranged.cost;
  return Object.entries(profile.relations).filter(([, relation]) => relation.alliance && resources2.every((key) => relation.treasury[key] >= cost5[key])).slice(0, 2).map(([faction]) => faction);
}
function conquestRulesCompatibility(profile) {
  const revision = profile.simulationRevision ?? "unknown";
  let reason = profile.simulationRevision === void 0 ? "This conquest has no pinned simulation rules. It is available for inspection." : revision !== SIMULATION_REVISION ? `This conquest uses simulation rules ${revision}; this build uses ${SIMULATION_REVISION}. It is available for inspection.` : null;
  if (reason === null && profile.active) {
    const checkpoint = scenarioRulesCompatibility(profile.active.checkpoint);
    if (!checkpoint.compatible) reason = checkpoint.reason;
  }
  if (reason === null) for (const recording of [...profile.history.flatMap((action2) => action2.type === "battle" ? [action2.recording] : []), ...profile.active ? [profile.active.recording] : []]) {
    const journal = scenarioRecordingRulesCompatibility(recording);
    if (!journal.compatible) {
      reason = journal.reason;
      break;
    }
  }
  return { compatible: reason === null, reason, revision };
}
function requireConquestRules(profile) {
  const result = conquestRulesCompatibility(profile);
  if (!result.compatible) throw new Error(result.reason);
}
function reachableConquestRegions(profile) {
  const seen = /* @__PURE__ */ new Set(["hearth"]), candidates = /* @__PURE__ */ new Set(), queue = ["hearth"];
  for (let index2 = 0; index2 < queue.length; index2++) for (const id5 of region2(profile, queue[index2]).neighbors) {
    candidates.add(id5);
    if (!seen.has(id5) && protectedFaction(profile, profile.regions[id5].owner)) {
      seen.add(id5);
      queue.push(id5);
    }
  }
  return [...candidates].filter((id5) => id5 !== "hearth").sort();
}
function conquestSupply(profile) {
  const reachable = /* @__PURE__ */ new Set(["hearth", ...reachableConquestRegions(profile)]);
  return world(profile).regions.filter((r) => reachable.has(r.id) && profile.regions[r.id].owner === profile.faction).reduce((supply, r) => total(supply, r.supply), empty());
}
function friendlyArmy(session) {
  return survivingScenarioArmy(session);
}
function battleDefinition(profile, regionId, mode) {
  const site = region2(profile, regionId), owner = profile.regions[regionId].owner, width = 36, height = 36;
  const terrain2 = Array.from({ length: width * height }, (_, i) => {
    const x = i % width, y = Math.floor(i / width);
    if (x === 0 || y === 0 || x === 35 || y === 35) return "rock";
    if (x >= 2 && x <= 14 && y >= 21 && y <= 30) return "grass";
    if (site.objective === "crossing" && x >= 17 && x <= 19) return y >= 14 && y <= 18 ? "bridge" : "water";
    if (site.terrain === "rock") return x >= 16 && x <= 19 && (y < 14 || y > 18) ? "rock" : y >= 14 && y <= 18 ? "road" : "grass";
    if (site.terrain === "forest" && y >= 11 && y <= 20) return y >= 14 && y <= 18 ? "road" : "grass";
    return y >= 14 && y <= 18 ? "road" : site.terrain;
  });
  const army = [
    { label: "commander", side: 0, kind: "unit", role: "special", definitionId: `core:${profile.faction}-commander`, x: 8, y: 15 },
    ...["ranged", "ranged", "melee", "spear", "worker"].map((role, i) => ({ label: `detachment-${i}`, side: 0, kind: "unit", role, x: 7 + i % 2, y: 13 + Math.floor(i / 2) * 2 })),
    { label: "home-fort", side: 0, kind: "building", role: "hq", x: 5, y: 26 },
    { label: "barracks", side: 0, kind: "building", role: "barracks", x: 10, y: 26 },
    ...Array.from({ length: profile.regions[regionId].garrison }, (_, i) => ({ label: `garrison-${i}`, side: 1, kind: "unit", role: i % 3 === 0 ? "ranged" : "melee", x: 24 + i % 2 * 2, y: 13 + Math.floor(i / 2) * 2, order: { type: "hold" } }))
  ];
  if (mode === "attack" && site.objective === "siege") army.push({ label: "region-fort", side: 1, kind: "building", role: "tower", x: 29, y: 17 });
  const allies2 = conquestAid(profile);
  for (const [index2, ally] of allies2.entries()) army.push({ label: `aid-${ally}`, side: 0, kind: "unit", role: "ranged", x: 11, y: 14 + index2 * 2 });
  const required = mode === "passage" || site.objective === "crossing" ? { type: "at", actor: "commander", point: { x: 29, y: 16 }, radius: 1 } : { type: "cleared", side: 1, buildings: true };
  const events = [];
  if (mode === "passage") {
    events.push({ id: "treaty-protection", when: { type: "time", seconds: 0 }, actions: [{ type: "alliance", allied: true }, { type: "set", key: "diplomacy.protected", value: 1 }, { type: "message", text: profile.relations[owner].alliance ? "The alliance grants passage. The garrison will hold its fire." : `The truce grants passage for ${(profile.relations[owner].truceUntil - profile.turn) * 15} seconds.` }] });
    if (!profile.relations[owner].alliance) events.push({ id: "truce-expiry", when: { type: "time", seconds: (profile.relations[owner].truceUntil - profile.turn) * 15 }, actions: [{ type: "alliance", allied: false }, { type: "set", key: "diplomacy.protected", value: 0 }, { type: "message", text: "The truce has expired. The garrison is hostile again." }] });
  }
  if (site.objective === "hold" && mode === "attack") events.push({ id: "counterattack", when: { type: "time", seconds: 15 }, actions: [{ type: "order", actors: army.filter((a) => a.side === 1).map((a) => a.label), order: { type: "attackMove", x: 8, y: 16 } }] });
  return {
    schemaVersion: 1,
    id: `conquest-${profile.faction}-${regionId}-${mode}`,
    title: `${mode === "attack" ? "Capture" : "Pass through"} ${site.name}`,
    briefing: `${site.briefing} ${mode === "attack" ? `Defeat its ${profile.regions[regionId].garrison} defenders with the persistent detachment.` : "Move the commander to the eastern exit while the treaty protects the detachment."}`,
    successText: mode === "attack" ? `${site.name} joins your realm.` : "The detachment completed its passage.",
    failureText: "The detachment could not complete its mission.",
    faction: profile.faction,
    opponent: owner,
    seed: 73100 + world(profile).regions.findIndex((r) => r.id === regionId),
    map: { size: "small", width, height, terrain: terrain2, starts: [{ x: 5, y: 26 }, { x: 28, y: 26 }], resources: [{ x: 10, y: 22, kind: "wood", amount: site.supply.wood * 4 + 100, maxAmount: site.supply.wood * 4 + 100 }, { x: 13, y: 22, kind: "ore", amount: site.supply.ore * 4 + 80, maxAmount: site.supply.ore * 4 + 80 }] },
    army,
    objectives: [{ id: "region", text: mode === "passage" ? "Reach the eastern exit under treaty protection." : site.objective === "crossing" ? "Clear the crossing and reach the far bank." : site.objective === "hold" ? "Survive the counterattack and eliminate its garrison." : "Eliminate the defending garrison.", success: mode === "passage" ? { type: "all", conditions: [required, { type: "variable", key: "diplomacy.protected", op: "eq", value: 1 }] } : site.objective === "crossing" ? { type: "all", conditions: [required, { type: "cleared", side: 1 }] } : site.objective === "hold" ? { type: "all", conditions: [required, { type: "time", seconds: 25 }] } : required, failure: { type: "dead", actor: "commander" } }],
    events,
    rules: { fixedArmy: false, reinforcementBudget: Math.min(6, 2 + Math.floor(conquestSupply(profile).ore / 30)), resources: copy2(profile.treasury), timeLimit: 180 }
  };
}
function createConquestProfile(faction, id5) {
  if (!Object.hasOwn(FACTIONS, faction) || typeof id5 !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(id5)) throw new Error("Invalid conquest faction or profile ID.");
  const definition2 = conquestWorldFor(faction);
  const profile = { format: "orcs-vs-fairies-conquest", version: 1, simulationRevision: SIMULATION_REVISION, id: id5, worldId: definition2.id, faction, turn: 0, treasury: { wood: 500, ore: 350, crystal: 100 }, regions: Object.fromEntries(definition2.regions.map((r) => [r.id, { owner: r.owner, garrison: r.garrison }])), relations: Object.fromEntries(Object.keys(FACTIONS).map((other) => [other, { score: 0, warPressure: 0, alliance: false, truceUntil: 0, treasury: { wood: 150, ore: 100, crystal: 20 } }])), army: [], history: [], active: null };
  profile.army = friendlyArmy(createScenario(battleDefinition(profile, "grove", "attack")));
  return boundedProfile2(profile);
}
function proposeConquest(profile, action2) {
  requireConquestRules(profile);
  if (profile.active) throw new Error("Finish the active battlefield before negotiating.");
  requireDecisionRoom(profile);
  if (action2.faction === profile.faction || !Object.hasOwn(profile.relations, action2.faction)) throw new Error("Choose a foreign faction.");
  const next = copy2(profile), relation = next.relations[action2.faction];
  if (action2.type === "tribute") {
    if (!Number.isSafeInteger(action2.amount) || action2.amount < 25 || action2.amount > 300 || next.treasury.ore < action2.amount) throw new Error("Tribute requires 25\u2013300 available ore.");
    next.treasury.ore -= action2.amount;
    relation.treasury.ore += action2.amount;
    relation.score = Math.min(100, relation.score + Math.floor(action2.amount / 5));
  } else if (action2.type === "truce") {
    if (!Number.isSafeInteger(action2.turns) || action2.turns < 1 || action2.turns > 8) throw new Error("A truce lasts one to eight turns.");
    if (relation.score < 20 + relation.warPressure * 8 || relation.alliance) throw new Error("The faction rejects a truce because relations and war pressure do not meet its terms.");
    relation.truceUntil = Math.max(relation.truceUntil, next.turn + action2.turns);
  } else if (action2.type === "alliance") {
    if (relation.score < 50 + relation.warPressure * 12) throw new Error("The faction rejects an alliance because relations and war pressure do not meet its terms.");
    relation.alliance = true;
  } else throw new Error("Unknown diplomatic proposal.");
  next.history.push(copy2(action2));
  return boundedProfile2(next);
}
function waitConquestTurn(profile) {
  requireConquestRules(profile);
  if (profile.active || profile.turn >= 1e3) throw new Error("A conquest turn cannot advance now.");
  requireDecisionRoom(profile);
  return boundedProfile2({ ...copy2(profile), turn: profile.turn + 1, treasury: total(profile.treasury, conquestSupply(profile)), history: [...profile.history, { type: "wait" }] });
}
function prepareConquestBattle(profile, regionId, mode = "attack") {
  requireConquestRules(profile);
  if (profile.active) {
    if (profile.active.regionId !== regionId || profile.active.mode !== mode) throw new Error("A different conquest battle is active.");
    const session2 = restoreScenario(profile.active.checkpoint);
    return { profile, session: session2, recorder: new ScenarioRecorder(session2, profile.active.recording) };
  }
  requireDecisionRoom(profile);
  if (!reachableConquestRegions(profile).includes(regionId)) throw new Error("This region is unreachable from owned or treaty-protected territory.");
  const owner = profile.regions[regionId].owner;
  if (owner === profile.faction) throw new Error("This region already belongs to your realm.");
  if (mode !== "attack" && mode !== "passage" || mode === "attack" && protectedFaction(profile, owner) || mode === "passage" && !protectedFaction(profile, owner)) throw new Error("The current agreement does not permit this battlefield action.");
  const largest = Math.max(0, ...profile.army.map((s) => s.entity.id), ...profile.history.flatMap((a) => a.type === "battle" ? [a.recording.initial.game.state.nextId + 4096] : []));
  const session = createScenario(battleDefinition(profile, regionId, mode), { firstEntityId: largest + 1 }), deployedIds = deployScenarioArmy(session, profile.army, { omitLabels: conquestAid(profile).map((faction) => `aid-${faction}`) }), recorder = new ScenarioRecorder(session);
  const replacements = session.definition.army.filter((a) => a.side === 0 && a.kind === "unit" && !a.label.startsWith("aid-")).map((a) => session.runtime.labels[a.label]).filter((id5) => !deployedIds.includes(id5));
  session.state.entities = session.state.entities.filter((e) => !replacements.includes(e.id));
  session.state.players[0].population = session.state.entities.filter((e) => e.side === 0 && e.kind === "unit").length;
  recorder.destroy();
  const readyRecorder = new ScenarioRecorder(session);
  const active4 = { regionId, mode, deployedIds, checkpoint: captureScenario(session), recording: readyRecorder.archive() };
  try {
    return { profile: boundedProfile2({ ...copy2(profile), active: active4 }), session, recorder: readyRecorder };
  } catch (error) {
    readyRecorder.destroy();
    throw error;
  }
}
function completeConquestBattle(profile, session, input) {
  requireConquestRules(profile);
  const recording = decodeScenarioRecording(input), compatibility = scenarioRecordingRulesCompatibility(recording);
  if (!compatibility.compatible) throw new Error(compatibility.reason);
  const prior = profile.history.find((a) => a.type === "battle" && a.recording.initial.definition.id === session.definition.id && JSON.stringify(a.recording) === JSON.stringify(input));
  if (prior) return profile;
  if (!profile.active || profile.active.checkpoint.definition.id !== session.definition.id) throw new Error("Only the active battlefield can update conquest.");
  const canonical3 = prepareConquestBattle({ ...profile, active: null }, profile.active.regionId, profile.active.mode);
  canonical3.recorder.destroy();
  if (!scenarioStateEquals(canonical3.session, restoreScenario(recording.initial))) throw new Error("The conquest battle starts from an altered army or agreement.");
  const verified = verifyScenarioRecording(recording);
  if (verified.runtime.outcome === "playing" || !scenarioStateEquals(verified, session)) throw new Error("The conquest battle result could not be verified.");
  const next = copy2(profile), { regionId, mode, deployedIds } = profile.active;
  const won = verified.runtime.outcome === "won";
  const reserves = profile.army.filter((s) => !deployedIds.includes(s.entity.id));
  if (won) next.army = [...reserves, ...friendlyArmy(verified)].sort((a, b) => a.entity.id - b.entity.id);
  const oldOwner = next.regions[regionId].owner;
  if (mode === "attack") {
    next.relations[oldOwner].warPressure = Math.min(10, next.relations[oldOwner].warPressure + 1);
    next.relations[oldOwner].score = Math.max(-100, next.relations[oldOwner].score - 15);
    if (won) next.regions[regionId] = { owner: profile.faction, garrison: Math.max(1, next.army.filter((s) => s.entity.role !== "worker").length) };
  }
  if (won) next.treasury = total({ wood: verified.state.players[0].wood, ore: verified.state.players[0].ore, crystal: verified.state.players[0].crystal }, conquestSupply(next));
  for (const [faction, relation] of Object.entries(next.relations)) if (relation.alliance && verified.runtime.labels[`aid-${faction}`]) for (const key of resources2) relation.treasury[key] -= FACTIONS[profile.faction].units.ranged.cost[key];
  next.active = null;
  next.turn++;
  next.history.push({ type: "battle", regionId, mode, recording });
  return boundedProfile2(next);
}
function decodeConquestProfile(input) {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > 30 * 1024 * 1024) throw new Error("Conquest profile is too large.");
    raw = JSON.parse(raw);
  }
  const saved = scenarioJson(raw, CONQUEST_PROFILE_LIMITS);
  const exact = (value2, fields2, optional = []) => !!value2 && typeof value2 === "object" && !Array.isArray(value2) && fields2.every((k) => Object.hasOwn(value2, k)) && Object.keys(value2).every((k) => fields2.includes(k) || optional.includes(k));
  const finite2 = (value2, min, max, integer2 = false) => typeof value2 === "number" && Number.isFinite(value2) && value2 >= min && value2 <= max && (!integer2 || Number.isSafeInteger(value2));
  const point5 = (value2) => exact(value2, ["x", "y"], ["level"]) && finite2(value2.x, 0, 4096) && finite2(value2.y, 0, 4096) && (value2.level === void 0 || finite2(value2.level, 0, 63, true));
  const order3 = (value2) => {
    if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) return false;
    if (value2.type === "idle" || value2.type === "hold") return exact(value2, ["type"]);
    if (value2.type === "move" || value2.type === "attackMove") return exact(value2, ["type", "x", "y"], ["level"]) && point5({ x: value2.x, y: value2.y, ...value2.level === void 0 ? {} : { level: value2.level } });
    if (value2.type === "traverse") return exact(value2, ["type", "transition"]) && finite2(value2.transition, 1, 2147483647, true);
    return ["attack", "gather", "build", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"].includes(value2.type) && exact(value2, ["type", "target"]) && finite2("target" in value2 ? value2.target : void 0, 1, 2147483647, true);
  };
  const faction = (value2) => typeof value2 === "string" && Object.hasOwn(FACTIONS, value2);
  const cost5 = (value2) => exact(value2, [...resources2]) && resources2.every((key) => finite2(value2[key], 0, 1e6));
  if (!exact(saved, ["format", "version", "id", "worldId", "faction", "turn", "treasury", "regions", "relations", "army", "history", "active"], ["simulationRevision"]) || saved.format !== "orcs-vs-fairies-conquest" || saved.version !== 1 || !Array.isArray(saved.history) || saved.history.length > 256 || saved.simulationRevision !== void 0 && (typeof saved.simulationRevision !== "string" || saved.simulationRevision.length > 80 || !/^\d+\.\d+\.\d+$/.test(saved.simulationRevision))) throw new Error("Invalid conquest profile.");
  if (!faction(saved.faction) || typeof saved.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(saved.id)) throw new Error("Invalid conquest faction or profile ID.");
  const definition2 = conquestWorldFor(saved.faction), regionIds = definition2.regions.map((region3) => region3.id);
  if (saved.worldId !== definition2.id) throw new Error("Unknown conquest world.");
  if (!finite2(saved.turn, 0, 1e3, true) || !cost5(saved.treasury) || !exact(saved.regions, regionIds) || !exact(saved.relations, Object.keys(FACTIONS))) throw new Error("Invalid conquest ownership, treasury or relations.");
  for (const value2 of Object.values(saved.regions)) if (!exact(value2, ["owner", "garrison"]) || !faction(value2.owner) || !finite2(value2.garrison, 1, CONQUEST_PROFILE_LIMITS.maxArrayLength, true)) throw new Error("Invalid conquest region.");
  for (const value2 of Object.values(saved.relations)) if (!exact(value2, ["score", "warPressure", "alliance", "truceUntil", "treasury"]) || !finite2(value2.score, -100, 100, true) || !finite2(value2.warPressure, 0, 10, true) || typeof value2.alliance !== "boolean" || !finite2(value2.truceUntil, 0, 1008, true) || !cost5(value2.treasury)) throw new Error("Invalid conquest relation.");
  if (!Array.isArray(saved.army)) throw new Error("Invalid conquest army.");
  const armyIds = /* @__PURE__ */ new Set();
  for (const soldier of saved.army) {
    const entity = soldier?.entity;
    if (!exact(soldier, ["entity", "label"], ["artifacts"]) || !entity || typeof entity !== "object" || Array.isArray(entity) || !finite2(entity.id, 1, 2147483647, true) || armyIds.has(entity.id) || entity.side !== 0 || entity.kind !== "unit" || !["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"].includes(entity.role) || !finite2(entity.maxHp, Number.MIN_VALUE, 1e9) || !finite2(entity.hp, Number.MIN_VALUE, entity.maxHp) || entity.illusion !== false || entity.raised !== void 0 && entity.raised !== false || soldier.label !== null && (typeof soldier.label !== "string" || soldier.label.length > 96 || !/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(soldier.label))) throw new Error("Invalid conquest soldier.");
    for (const key of ["x", "y", "cooldown", "animTime", "expires"]) if (!finite2(entity[key], 0, 1e9)) throw new Error("Invalid conquest soldier state.");
    for (const key of ["progress", "trainProgress", "momentum"]) if (!finite2(entity[key], 0, 1)) throw new Error("Invalid conquest soldier state.");
    for (const key of ["abilityReadyAt", "entrenchedAt", "lastDamagedAt", "surgeUntil", "shield", "maxShield"]) if (entity[key] !== void 0 && !finite2(entity[key], 0, 1e9)) throw new Error("Invalid conquest soldier state.");
    for (const key of ["definitionId", "definitionFaction"]) if (entity[key] !== void 0 && (typeof entity[key] !== "string" || entity[key].length < 1 || entity[key].length > 100)) throw new Error("Invalid conquest soldier definition.");
    if (entity.lastAttacker !== void 0 && !finite2(entity.lastAttacker, 1, 2147483647, true) || entity.gateOpen !== void 0 && typeof entity.gateOpen !== "boolean" || entity.shield !== void 0 && entity.shield > (entity.maxShield ?? 0)) throw new Error("Invalid conquest soldier state.");
    if (!finite2(entity.researchProgress, 0, 2) || !finite2(entity.facing, 0, 7, true) || !finite2(entity.carried, 0, 18) || !resources2.includes(entity.carriedKind) || !["idle", "walk", "attack", "death"].includes(entity.animation) || !order3(entity.order) || !Array.isArray(entity.queue) || entity.queue.length !== 0 || !Array.isArray(entity.path) || entity.path.some((value2) => !point5(value2)) || entity.orderQueue !== void 0 && (!Array.isArray(entity.orderQueue) || entity.orderQueue.some((value2) => !order3(value2))) || entity.level !== void 0 && !finite2(entity.level, 0, 63, true)) throw new Error("Invalid conquest soldier state.");
    const artifacts = soldier.artifacts ?? [], artifactIds = /* @__PURE__ */ new Set();
    if (!Array.isArray(artifacts)) throw new Error("Invalid conquest soldier artifacts.");
    for (const item of artifacts) {
      if (!exact(item, ["id", "definitionId", "owner", "holder"]) || !finite2(item.id, 1, 2147483647, true) || artifactIds.has(item.id) || !["core:ember-blade", "core:iron-aegis", "core:wind-charm"].includes(item.definitionId) || item.owner !== 0 || item.holder !== entity.id) throw new Error("Invalid conquest soldier artifact.");
      artifactIds.add(item.id);
    }
    if (entity.equipment !== void 0 && (!exact(entity.equipment, [], ["weapon", "armor", "trinket"]) || Object.values(entity.equipment).some((id5) => !artifactIds.has(id5)))) throw new Error("Invalid conquest soldier equipment.");
    armyIds.add(entity.id);
  }
  const validateRecording = (recording, regionId, mode) => {
    if (!regionIds.includes(regionId) || !["attack", "passage"].includes(mode)) throw new Error("Invalid conquest battle reference.");
    const decoded = decodeScenarioRecording(recording), expected = `conquest-${saved.faction}-${regionId}-${mode}`;
    if (decoded.initial.definition.id !== expected || decoded.initial.runtime.definitionId !== expected || decoded.initial.definition.faction !== saved.faction) throw new Error("Invalid conquest battle identity.");
    return decoded;
  };
  let turns = 0;
  for (const action2 of saved.history) {
    const fields2 = action2?.type === "tribute" ? ["type", "faction", "amount"] : action2?.type === "truce" ? ["type", "faction", "turns"] : action2?.type === "alliance" ? ["type", "faction"] : action2?.type === "wait" ? ["type"] : action2?.type === "battle" ? ["type", "regionId", "mode", "recording"] : [];
    if (!fields2.length || !exact(action2, fields2)) throw new Error("Invalid conquest decision.");
    if (action2.type === "battle") {
      validateRecording(action2.recording, action2.regionId, action2.mode);
      turns++;
    } else if (action2.type === "wait") turns++;
    else if (!faction(action2.faction) || action2.faction === saved.faction || action2.type === "tribute" && !finite2(action2.amount, 25, 300, true) || action2.type === "truce" && !finite2(action2.turns, 1, 8, true)) throw new Error("Invalid conquest diplomatic decision.");
  }
  if (saved.turn !== turns) throw new Error("Conquest turn disagrees with its recorded decisions.");
  if (saved.active !== null) {
    if (!exact(saved.active, ["regionId", "mode", "deployedIds", "checkpoint", "recording"]) || !Array.isArray(saved.active.deployedIds) || saved.active.deployedIds.length > 4096 || saved.active.deployedIds.some((id5) => !finite2(id5, 1, 2147483647, true)) || new Set(saved.active.deployedIds).size !== saved.active.deployedIds.length) throw new Error("Invalid active conquest battle.");
    const recording = validateRecording(saved.active.recording, saved.active.regionId, saved.active.mode), checkpoint = restoreScenario(saved.active.checkpoint);
    if (checkpoint.definition.id !== recording.initial.definition.id || JSON.stringify(saved.active.checkpoint.definition) !== JSON.stringify(recording.initial.definition) || recording.finalTick !== saved.active.checkpoint.game.state.tick || recording.finalChecksum !== scenarioCheckpointChecksum(saved.active.checkpoint)) throw new Error("The conquest checkpoint disagrees with its recording.");
    if (saved.active.deployedIds.some((id5) => !armyIds.has(id5) || !recording.initial.game.state.entities.some((entity) => entity.id === id5 && entity.side === 0 && entity.kind === "unit"))) throw new Error("Invalid conquest deployed army.");
  }
  if (!conquestRulesCompatibility(saved).compatible) return saved;
  let canonical3 = createConquestProfile(saved.faction, saved.id);
  for (const action2 of saved.history) {
    if (action2.type === "battle") {
      const prepared = prepareConquestBattle(canonical3, action2.regionId, action2.mode);
      prepared.recorder.destroy();
      const verified = verifyScenarioRecording(action2.recording);
      canonical3 = completeConquestBattle(prepared.profile, verified, action2.recording);
    } else if (action2.type === "wait") canonical3 = waitConquestTurn(canonical3);
    else canonical3 = proposeConquest(canonical3, action2);
  }
  if (saved.active !== null) {
    const prepared = prepareConquestBattle(canonical3, saved.active.regionId, saved.active.mode);
    prepared.recorder.destroy();
    if (!scenarioStateEquals(prepared.session, restoreScenario(saved.active.recording.initial)) || JSON.stringify(prepared.profile.active.deployedIds) !== JSON.stringify(saved.active.deployedIds)) throw new Error("The saved conquest detachment was altered.");
    const replayed = verifyScenarioRecording(saved.active.recording);
    if (!scenarioStateEquals(replayed, restoreScenario(saved.active.checkpoint))) throw new Error("The conquest checkpoint does not match its replay.");
    canonical3.active = copy2(saved.active);
  }
  if (JSON.stringify({ ...saved, active: null }) !== JSON.stringify({ ...canonical3, active: null })) throw new Error("Conquest ownership, supply, army or relations disagree with its decisions.");
  return canonical3;
}

// src/core/session-storage.ts
var MAX_BYTES = 20 * 1024 * 1024;
var record5 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function decodeSessionPlanning(input, state) {
  if (!record5(input) || input.version !== 1 || Object.keys(input).some((key) => !["version", "players", "automaticSides"].includes(key)) || !Array.isArray(input.players) || input.players.length !== state.players.length) throw new Error("Invalid saved planning roster.");
  const players = [];
  for (let side2 = 0; side2 < input.players.length; side2++) {
    if (!Object.hasOwn(input.players, side2)) throw new Error("Saved plans cannot contain missing player slots.");
    const runtime2 = decodePlanningRuntime(input.players[side2], state, side2);
    if (!runtime2) throw new Error(`Invalid saved plans for player ${side2 + 1}.`);
    players.push(runtime2);
  }
  const automatic = input.automaticSides === void 0 ? [] : input.automaticSides;
  if (!Array.isArray(automatic) || !Array.from(automatic).every((side2) => Number.isInteger(side2) && side2 >= 0 && side2 < players.length) || new Set(automatic).size !== automatic.length) throw new Error("Invalid automatic worker allocation players.");
  return { version: 1, players, automaticSides: [...automatic] };
}
function decodeSessionScenarioProfile(input, state) {
  const value2 = scenarioJson(input, { maxBytes: MAX_BYTES, maxNodes: 15e5, maxArrayLength: 1e5 });
  if (!record5(value2) || Object.keys(value2).length !== 2 || !Object.hasOwn(value2, "kind") || !Object.hasOwn(value2, "profile") || !["campaign", "conquest"].includes(value2.kind)) throw new Error("Invalid saved scenario profile owner.");
  const owner = value2.kind === "campaign" ? { kind: "campaign", profile: decodeCampaignProfile(value2.profile) } : { kind: "conquest", profile: decodeConquestProfile(value2.profile) };
  const session = scenarioSessionForState(state);
  const checkpoint = owner.profile.active?.checkpoint ?? (owner.kind === "campaign" ? owner.profile.history.at(-1)?.checkpoint : void 0);
  const battle = owner.kind === "conquest" ? [...owner.profile.history].reverse().find((action2) => action2.type === "battle") : void 0;
  const expected = checkpoint ? restoreScenario(checkpoint) : battle?.type === "battle" ? verifyScenarioRecording(battle.recording) : null;
  if (!session || !expected || !scenarioStateEquals(session, expected)) throw new Error("Saved scenario profile does not match this battlefield.");
  return owner;
}
function createSessionFile(state, replay, planning, scenarioProfile) {
  const game = saveGame(state);
  const file = { format: "orcs-vs-fairies/session", version: 1, game };
  if (replay) {
    const archive = decodeReplay(replay);
    if (archive.initial.version !== SAVE_VERSION || archive.checksumVersion !== SAVE_VERSION || archive.finalTick !== state.tick || archive.finalChecksum !== checksumSaveEnvelope(game)) throw new Error("Replay does not match this game.");
    file.replay = archive;
  }
  if (planning !== void 0) file.planning = decodeSessionPlanning(planning, state);
  if (scenarioProfile !== void 0) {
    file.scenarioProfile = decodeSessionScenarioProfile(scenarioProfile, state);
    if (new TextEncoder().encode(JSON.stringify(file)).byteLength > MAX_BYTES) throw new Error("Save exceeds 20 MiB.");
  }
  return file;
}
function decodeSessionFile(input) {
  if (typeof input === "string") {
    if (input.length > MAX_BYTES || new TextEncoder().encode(input).byteLength > MAX_BYTES) throw new Error("Save exceeds 20 MiB.");
    try {
      input = JSON.parse(input);
    } catch {
      throw new Error("Invalid save JSON.");
    }
  }
  input = scenarioJson(input, { maxBytes: MAX_BYTES, maxNodes: 2e6, maxArrayLength: 1e5 });
  if (!record5(input) || input.format !== "orcs-vs-fairies/session" || input.version !== 1 || Object.keys(input).some((k) => !["format", "version", "game", "replay", "planning", "scenarioProfile"].includes(k))) throw new Error("Unsupported session file or version.");
  const { original, state } = decodeSaveSource(input.game), file = { format: "orcs-vs-fairies/session", version: 1, game: original };
  if (input.replay !== void 0) {
    const archive = decodeReplay(input.replay), version = archive.checksumVersion ?? archive.initial.version;
    if (original.version !== version || archive.initial.version !== version || original.state.tick !== archive.finalTick || checksumSaveEnvelope(original) !== archive.finalChecksum) throw new Error("Replay does not match this original saved game.");
    file.replay = archive;
  }
  if (input.planning !== void 0) file.planning = decodeSessionPlanning(input.planning, state);
  if (input.scenarioProfile !== void 0) file.scenarioProfile = decodeSessionScenarioProfile(input.scenarioProfile, state);
  return { state, file };
}

// src/editor/map-package.ts
var EDITOR_MAP_LIMITS = { minimumDimension: 8, maximumDimension: 128, levels: 2, elevation: 3, resources: 2048, sites: 128, transitions: 64, bytes: 16 * 1024 * 1024 };
var EDITOR_SIMULATION_VERSION = SAVE_VERSION;
var MAP_FIELDS = ["width", "height", "size", "seed", "levels", "starts", "resources", "sites", "transitions"];
var PACKAGE_FIELDS = ["schemaVersion", "kind", "id", "title", "author", "revision", "simulationVersion", "mapVersion", "contentHash", "hash", "map"];
var HASH_PATTERN = /^[0-9a-f]{16}$/;
function bad4(path, detail) {
  throw new Error(`Invalid editor map at ${path}: ${detail}.`);
}
function copyJson2(input) {
  let nodes = 0, stringBytes = 0;
  const ancestors = /* @__PURE__ */ new Set();
  function copy3(value2, path, depth) {
    if (++nodes > 5e5 || depth > 16) bad4(path, "document exceeds size or depth limit");
    if (value2 === null || typeof value2 === "boolean") return value2;
    if (typeof value2 === "number") {
      if (!Number.isFinite(value2)) bad4(path, "expected finite JSON number");
      return Object.is(value2, -0) ? 0 : value2;
    }
    if (typeof value2 === "string") {
      stringBytes += value2.length * 2;
      if (stringBytes > EDITOR_MAP_LIMITS.bytes) bad4(path, "document exceeds byte limit");
      return value2;
    }
    if (!value2 || typeof value2 !== "object") bad4(path, "expected JSON data");
    if (ancestors.has(value2)) bad4(path, "cyclic references are forbidden");
    ancestors.add(value2);
    let result2;
    if (Array.isArray(value2)) {
      if (value2.length > EDITOR_MAP_LIMITS.maximumDimension ** 2) bad4(path, "array exceeds length limit");
      const keys3 = Reflect.ownKeys(value2);
      if (keys3.length !== value2.length + 1 || keys3.some((k) => typeof k !== "string" || k !== "length" && !/^(0|[1-9][0-9]*)$/.test(k))) bad4(path, "array gaps or extra properties are forbidden");
      const array3 = [];
      for (let i = 0; i < value2.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value2, String(i));
        if (!descriptor || !("value" in descriptor)) bad4(`${path}[${i}]`, "array gaps and accessors are forbidden");
        array3.push(copy3(descriptor.value, `${path}[${i}]`, depth + 1));
      }
      result2 = array3;
    } else {
      const prototype = Object.getPrototypeOf(value2);
      if (prototype !== Object.prototype && prototype !== null) bad4(path, "expected plain object");
      const keys3 = Reflect.ownKeys(value2);
      if (keys3.length > 32 || keys3.some((key) => typeof key !== "string")) bad4(path, "invalid object properties");
      const record6 = /* @__PURE__ */ Object.create(null);
      for (const key of keys3) {
        const descriptor = Object.getOwnPropertyDescriptor(value2, key);
        if (!("value" in descriptor) || !descriptor.enumerable) bad4(`${path}.${key}`, "accessors and hidden fields are forbidden");
        if (["__proto__", "constructor", "prototype"].includes(key)) bad4(path, "unsafe property name");
        record6[key] = copy3(descriptor.value, `${path}.${key}`, depth + 1);
      }
      result2 = record6;
    }
    ancestors.delete(value2);
    return result2;
  }
  const result = copy3(input, "map", 0);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > EDITOR_MAP_LIMITS.bytes) bad4("map", "document exceeds byte limit");
  return result;
}
function source(input) {
  if (typeof input !== "string") return copyJson2(input);
  if (input.length > EDITOR_MAP_LIMITS.bytes || new TextEncoder().encode(input).byteLength > EDITOR_MAP_LIMITS.bytes) bad4("map", "document exceeds byte limit");
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch {
    bad4("map", "invalid JSON");
  }
  return copyJson2(parsed);
}
function object4(value2, path, fields2) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) bad4(path, "expected object");
  const record6 = value2;
  for (const key of fields2) if (!Object.hasOwn(record6, key)) bad4(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record6)) if (!fields2.includes(key)) bad4(`${path}.${key}`, "unknown field");
  return record6;
}
function number4(value2, path, min, max, integer2 = false) {
  if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < min || value2 > max || integer2 && !Number.isSafeInteger(value2)) bad4(path, `expected ${integer2 ? "integer" : "number"} between ${min} and ${max}`);
  return value2;
}
function textValue(value2, path, max, allowEmpty = false) {
  if (typeof value2 !== "string" || value2.length > max || !allowEmpty && !value2.trim() || /[\u0000-\u001f\u007f]/.test(value2)) bad4(path, "invalid text");
  return value2;
}
function choice4(value2, path, choices) {
  if (typeof value2 !== "string" || !choices.includes(value2)) bad4(path, "unknown value");
  return value2;
}
function array(value2, path, max, length2) {
  if (!Array.isArray(value2) || value2.length > max || length2 !== void 0 && value2.length !== length2) bad4(path, "invalid array length");
  return value2;
}
function unique(set, value2, path) {
  if (set.has(value2)) bad4(path, "duplicate ID or slot");
  set.add(value2);
}
function readMap(value2) {
  const m = object4(value2, "map", MAP_FIELDS), width = number4(m.width, "map.width", 8, 128, true), height = number4(m.height, "map.height", 8, 128, true), cells = width * height;
  choice4(m.size, "map.size", ["small", "medium", "large", "huge"]);
  number4(m.seed, "map.seed", 0, 4294967295, true);
  const levelIds = /* @__PURE__ */ new Set(), levels = array(m.levels, "map.levels", 2);
  if (!levels.length) bad4("map.levels", "at least one level is required");
  levels.forEach((value3, index2) => {
    const path = `map.levels[${index2}]`, level2 = object4(value3, path, ["id", "title", "terrain", "elevation"]);
    unique(levelIds, number4(level2.id, `${path}.id`, 0, 1, true), `${path}.id`);
    if (level2.id !== index2) bad4(`${path}.id`, "levels must be ordered from 0");
    textValue(level2.title, `${path}.title`, 80);
    array(level2.terrain, `${path}.terrain`, cells, cells).forEach((kind, tile) => choice4(kind, `${path}.terrain[${tile}]`, Object.keys(TERRAIN)));
    array(level2.elevation, `${path}.elevation`, cells, cells).forEach((height2, tile) => number4(height2, `${path}.elevation[${tile}]`, 0, 3, true));
  });
  if (!levelIds.has(0)) bad4("map.levels", "ground level 0 is required");
  const point5 = (p, path) => {
    number4(p.x, `${path}.x`, 0.5, width - 0.5);
    number4(p.y, `${path}.y`, 0.5, height - 0.5);
    const level2 = number4(p.level, `${path}.level`, 0, 1, true);
    if (!levelIds.has(level2)) bad4(`${path}.level`, "unknown level");
  };
  const slots = /* @__PURE__ */ new Set();
  array(m.starts, "map.starts", 8).forEach((value3, index2) => {
    const path = `map.starts[${index2}]`, start = object4(value3, path, ["x", "y", "level", "slot"]);
    point5(start, path);
    unique(slots, number4(start.slot, `${path}.slot`, 0, 7, true), `${path}.slot`);
  });
  array(m.resources, "map.resources", EDITOR_MAP_LIMITS.resources).forEach((value3, index2) => {
    const path = `map.resources[${index2}]`, resource = object4(value3, path, ["x", "y", "level", "kind", "amount", "maxAmount"]);
    point5(resource, path);
    choice4(resource.kind, `${path}.kind`, ["wood", "ore", "crystal"]);
    const max = number4(resource.maxAmount, `${path}.maxAmount`, 0, 1e9);
    number4(resource.amount, `${path}.amount`, 0, max);
  });
  const siteIds = /* @__PURE__ */ new Set();
  array(m.sites, "map.sites", EDITOR_MAP_LIMITS.sites).forEach((value3, index2) => {
    const path = `map.sites[${index2}]`, site = object4(value3, path, ["id", "x", "y", "level", "kind"]);
    point5(site, path);
    unique(siteIds, number4(site.id, `${path}.id`, 1, 2147483647, true), `${path}.id`);
    choice4(site.kind, `${path}.kind`, ["relic", "village", "monster"]);
  });
  const transitionIds = /* @__PURE__ */ new Set();
  array(m.transitions, "map.transitions", EDITOR_MAP_LIMITS.transitions).forEach((value3, index2) => {
    const path = `map.transitions[${index2}]`, transition = object4(value3, path, ["id", "from", "to"]);
    unique(transitionIds, number4(transition.id, `${path}.id`, 1, 2147483647, true), `${path}.id`);
    point5(object4(transition.from, `${path}.from`, ["x", "y", "level"]), `${path}.from`);
    point5(object4(transition.to, `${path}.to`, ["x", "y", "level"]), `${path}.to`);
  });
  return JSON.parse(JSON.stringify(m));
}
function decodeEditorMap(input) {
  return readMap(source(input));
}
function canonical(value2) {
  if (Array.isArray(value2)) return `[${value2.map(canonical).join(",")}]`;
  if (value2 && typeof value2 === "object") {
    const record6 = value2;
    return `{${Object.keys(record6).sort().map((key) => `${JSON.stringify(key)}:${canonical(record6[key])}`).join(",")}}`;
  }
  return JSON.stringify(value2);
}
function checksum(value2) {
  const bytes = new TextEncoder().encode(canonical(value2));
  let a = 2166136261, b = 2654435769;
  for (const byte of bytes) {
    a = Math.imul(a ^ byte, 16777619) >>> 0;
    b = Math.imul(b ^ byte, 2246822507) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
function canonicalMapHash(input) {
  return checksum(decodeEditorMap(input));
}
function metadata(value2) {
  const m = object4(value2, "package", ["id", "title", "author", "revision", "simulationVersion", "mapVersion"]);
  const id5 = textValue(m.id, "package.id", 64);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id5)) bad4("package.id", "expected letters, numbers, dots, underscores or hyphens");
  textValue(m.title, "package.title", 120);
  textValue(m.author, "package.author", 120);
  number4(m.revision, "package.revision", 1, 2147483647, true);
  if (m.simulationVersion !== EDITOR_SIMULATION_VERSION) bad4("package.simulationVersion", `unsupported simulation version; expected ${EDITOR_SIMULATION_VERSION}`);
  if (m.mapVersion !== MAP_VERSION) bad4("package.mapVersion", `unsupported map version; expected ${MAP_VERSION}`);
  return m;
}
function canonicalPackageHash(input) {
  const value2 = object4(source(input), "package", PACKAGE_FIELDS.filter((key) => key !== "hash"));
  if (value2.schemaVersion !== 1 || value2.kind !== "map") bad4("package", "unsupported package schema or kind");
  const m = metadata({ id: value2.id, title: value2.title, author: value2.author, revision: value2.revision, simulationVersion: value2.simulationVersion, mapVersion: value2.mapVersion });
  const map = readMap(value2.map), contentHash2 = canonicalMapHash(map);
  if (value2.contentHash !== contentHash2) bad4("package.contentHash", "map checksum mismatch");
  return checksum({ schemaVersion: 1, kind: "map", ...m, contentHash: contentHash2, map });
}
function makeMapPackage(input, mapInput) {
  const copied = source(input), m = object4(copied, "metadata", ["id", "title", "author", "revision", ...["simulationVersion", "mapVersion"].filter((key) => !!copied && typeof copied === "object" && Object.hasOwn(copied, key))]);
  for (const key of Object.keys(m)) if (!["id", "title", "author", "revision", "simulationVersion", "mapVersion"].includes(key)) bad4(`metadata.${key}`, "unknown field");
  const info = metadata({ ...m, simulationVersion: Object.hasOwn(m, "simulationVersion") ? m.simulationVersion : EDITOR_SIMULATION_VERSION, mapVersion: Object.hasOwn(m, "mapVersion") ? m.mapVersion : MAP_VERSION }), map = decodeEditorMap(mapInput), validation = validateEditorMap(map);
  if (!validation.valid) bad4("map", validation.issues.join("; "));
  const data = { schemaVersion: 1, kind: "map", id: info.id, title: info.title, author: info.author, revision: info.revision, simulationVersion: info.simulationVersion, mapVersion: info.mapVersion, contentHash: canonicalMapHash(map), map };
  return { ...data, hash: canonicalPackageHash(data) };
}
function decodeMapPackage(input) {
  const value2 = object4(source(input), "package", PACKAGE_FIELDS);
  if (value2.schemaVersion !== 1 || value2.kind !== "map") bad4("package", "unsupported package schema or kind");
  for (const key of ["hash", "contentHash"]) if (typeof value2[key] !== "string" || !HASH_PATTERN.test(value2[key])) bad4(`package.${key}`, "invalid checksum");
  const { hash: hash3, ...withoutHash } = value2;
  if (hash3 !== canonicalPackageHash(withoutHash)) bad4("package.hash", "package checksum mismatch");
  return { ...withoutHash, map: readMap(value2.map), hash: hash3 };
}
var UNIT_RADIUS = 0.27;
var HQ_RADIUS = 1.5;
var HQ_CLEARANCE = 1.77;
var RESOURCE_RADIUS = 0.7;
function sameLevel6(a, b) {
  return a.level === b.level;
}
function separation(a, b) {
  return sameLevel6(a, b) ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
}
function opening(start, height) {
  const dir2 = start.y < height / 2 ? 1 : -1;
  return [...Array.from({ length: 5 }, (_, i) => ({ x: start.x + (-2 + i * 0.85) * dir2, y: start.y + 3 * dir2, level: start.level })), { x: start.x + 3 * dir2, y: start.y + dir2, level: start.level }];
}
function validateEditorMap(input) {
  let map;
  try {
    map = decodeEditorMap(input);
  } catch (error) {
    return { valid: false, issues: [error instanceof Error ? error.message : String(error)], startsConnected: false, reachableResources: 0, totalResources: 0, reachableTiles: 0 };
  }
  let result = validatePlayableMap(map, 0.5);
  if (!result.valid && result.issues.every((issue) => /disconnected|unreachable|endpoints must be passable/.test(issue))) result = validatePlayableMap(map, 0.25);
  const issues = [.../* @__PURE__ */ new Set([...result.issues, ...validateWorldMap(map).issues])];
  return { ...result, valid: issues.length === 0, issues };
}
function validatePlayableMap(map, CELL) {
  const { width, height, starts, resources: resources3, sites, transitions } = map, issues = [], levels = new Map(map.levels.map((level2) => [level2.id, level2]));
  const tile = (p) => Math.floor(p.y) * width + Math.floor(p.x);
  const terrain2 = (p) => levels.get(p.level).terrain[tile(p)];
  const resourceBuckets = /* @__PURE__ */ new Map();
  for (const resource of resources3) {
    const key = `${resource.level},${Math.floor(resource.x)},${Math.floor(resource.y)}`, bucket = resourceBuckets.get(key) ?? [];
    bucket.push(resource);
    resourceBuckets.set(key, bucket);
  }
  const nearby = (p, radius2) => {
    const result = [];
    for (let y = Math.floor(p.y - radius2); y <= Math.floor(p.y + radius2); y++) for (let x = Math.floor(p.x - radius2); x <= Math.floor(p.x + radius2); x++) result.push(...resourceBuckets.get(`${p.level},${x},${y}`) ?? []);
    return result;
  };
  const walkable2 = (p) => {
    if (p.x < 0.35 || p.y < 0.35 || p.x > width - 0.35 || p.y > height - 0.35) return false;
    const level2 = levels.get(p.level);
    for (let y = Math.floor(p.y - UNIT_RADIUS); y <= Math.floor(p.y + UNIT_RADIUS); y++) for (let x = Math.floor(p.x - UNIT_RADIUS); x <= Math.floor(p.x + UNIT_RADIUS); x++) if (!TERRAIN[level2.terrain[y * width + x] ?? "rock"].walkable) return false;
    if (starts.some((start) => sameLevel6(p, start) && Math.abs(p.x - start.x) < HQ_CLEARANCE && Math.abs(p.y - start.y) < HQ_CLEARANCE)) return false;
    return !nearby(p, RESOURCE_RADIUS).some((resource) => resource.amount > 0 && separation(resource, p) < RESOURCE_RADIUS);
  };
  const segment = (a, b) => {
    if (!sameLevel6(a, b) || !walkable2(a) || !walkable2(b)) return false;
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    for (const resource of nearby({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, level: a.level }, RESOURCE_RADIUS + Math.sqrt(length2) / 2)) {
      if (resource.amount <= 0) continue;
      const t = length2 ? Math.max(0, Math.min(1, ((resource.x - a.x) * dx + (resource.y - a.y) * dy) / length2)) : 0;
      if (Math.hypot(a.x + t * dx - resource.x, a.y + t * dy - resource.y) < RESOURCE_RADIUS) return false;
    }
    const level2 = levels.get(a.level);
    let previous = level2.elevation[tile(a)];
    for (let step = 1; step <= 4; step++) {
      const p = { x: a.x + dx * step / 4, y: a.y + dy * step / 4, level: a.level }, height2 = level2.elevation[tile(p)];
      if (!walkable2(p) || Math.abs(height2 - previous) > 1) return false;
      previous = height2;
    }
    return true;
  };
  if (!starts.length) issues.push("At least one starting position is required.");
  if (starts.some((_, i) => !starts.some((start) => start.slot === i))) issues.push("Starting slots must be contiguous from 0.");
  for (const start of starts) {
    if (start.x - HQ_RADIUS < 0.5 || start.y - HQ_RADIUS < 0.5 || start.x + HQ_RADIUS > width - 0.5 || start.y + HQ_RADIUS > height - 0.5) issues.push(`Start ${start.slot} headquarters lies outside the playable border.`);
    const level2 = levels.get(start.level), elevation = level2.elevation[tile(start)];
    let clear = true;
    for (let y = Math.floor(start.y - HQ_RADIUS); y < Math.ceil(start.y + HQ_RADIUS); y++) for (let x = Math.floor(start.x - HQ_RADIUS); x < Math.ceil(start.x + HQ_RADIUS); x++) if (!TERRAIN[level2.terrain[y * width + x] ?? "rock"].buildable || level2.elevation[y * width + x] !== elevation) clear = false;
    if (!clear) issues.push(`Start ${start.slot} headquarters requires flat buildable terrain.`);
    if (resources3.some((resource) => resource.amount > 0 && sameLevel6(resource, start) && Math.abs(resource.x - start.x) < HQ_RADIUS + 0.8 && Math.abs(resource.y - start.y) < HQ_RADIUS + 0.8)) issues.push(`Start ${start.slot} headquarters overlaps a resource.`);
    if (opening(start, height).some((point5) => !walkable2(point5))) issues.push(`Start ${start.slot} opening units overlap blocked terrain or objects.`);
  }
  for (let a = 0; a < starts.length; a++) for (let b = a + 1; b < starts.length; b++) if (sameLevel6(starts[a], starts[b]) && Math.abs(starts[a].x - starts[b].x) < HQ_RADIUS * 2 + 0.4 && Math.abs(starts[a].y - starts[b].y) < HQ_RADIUS * 2 + 0.4) issues.push(`Starts ${starts[a].slot} and ${starts[b].slot} headquarters overlap.`);
  resources3.forEach((resource, index2) => {
    if (!TERRAIN[terrain2(resource)].walkable) issues.push(`Resource ${index2} lies on impassable terrain.`);
    if (nearby(resource, 1.4).some((other) => other !== resource && separation(resource, other) < 1.4)) issues.push(`Resource ${index2} overlaps another resource.`);
  });
  sites.forEach((site) => {
    if (!walkable2(site)) issues.push(`Site ${site.id} lies on blocked terrain or objects.`);
    if (sites.some((other) => other !== site && separation(other, site) < 1.4)) issues.push(`Site ${site.id} overlaps another site.`);
  });
  const gridWidth = width / CELL, gridHeight = height / CELL, perLevel = gridWidth * gridHeight, total2 = perLevel * map.levels.length;
  const offsets = new Map(map.levels.map((level2, index2) => [level2.id, index2 * perLevel]));
  const gridPoint = (key) => {
    const offset = Math.floor(key / perLevel), local = key % perLevel;
    return { x: (local % gridWidth + 0.5) * CELL, y: (Math.floor(local / gridWidth) + 0.5) * CELL, level: map.levels[offset].id };
  };
  const blocked = new Uint8Array(total2), seen = new Uint8Array(total2);
  for (let key = 0; key < total2; key++) if (!walkable2(gridPoint(key))) blocked[key] = 1;
  const connectors = (p) => {
    const keys3 = [], sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL), offset = offsets.get(p.level);
    for (let y = Math.max(0, sy - 1); y <= Math.min(gridHeight - 1, sy + 1); y++) for (let x = Math.max(0, sx - 1); x <= Math.min(gridWidth - 1, sx + 1); x++) {
      const key = offset + y * gridWidth + x;
      if (!blocked[key] && segment(p, gridPoint(key))) keys3.push(key);
    }
    return keys3;
  };
  const links = /* @__PURE__ */ new Map(), pairs = /* @__PURE__ */ new Set();
  for (const transition of transitions) {
    const { from, to } = transition, a = connectors(from), b = connectors(to), endpoint = (p) => `${p.level},${p.x},${p.y}`, pair = [endpoint(from), endpoint(to)].sort().join(":");
    if (from.level === to.level) {
      issues.push(`Transition ${transition.id} must connect different levels.`);
      continue;
    }
    if (endpoint(from) === endpoint(to) || pairs.has(pair)) {
      issues.push(`Transition ${transition.id} repeats an endpoint or connection.`);
      continue;
    }
    pairs.add(pair);
    if (!a.length || !b.length) {
      issues.push(`Transition ${transition.id} endpoints must be passable and reachable from adjacent tiles.`);
      continue;
    }
    for (const source2 of a) {
      const targets = links.get(source2) ?? [];
      targets.push(...b);
      links.set(source2, targets);
    }
    for (const source2 of b) {
      const targets = links.get(source2) ?? [];
      targets.push(...a);
      links.set(source2, targets);
    }
  }
  const queue = starts.length ? connectors(opening(starts[0], height)[0]) : [];
  for (const key of queue) seen[key] = 1;
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i], local = key % perLevel, x = local % gridWidth, y = Math.floor(local / gridWidth), p = gridPoint(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
      const next = key + dy * gridWidth + dx;
      if (!seen[next] && !blocked[next] && segment(p, gridPoint(next))) {
        seen[next] = 1;
        queue.push(next);
      }
    }
    for (const next of links.get(key) ?? []) if (!seen[next]) {
      seen[next] = 1;
      queue.push(next);
    }
  }
  const reached = (p) => connectors(p).some((key) => seen[key]);
  const startsConnected = starts.length > 0 && starts.every((start) => opening(start, height).every(reached));
  if (!startsConnected) issues.push("Starting armies are disconnected.");
  let reachableResources = 0;
  resources3.forEach((resource, index2) => {
    const offset = offsets.get(resource.level);
    let found = false;
    for (let y = Math.max(0, Math.floor((resource.y - 1.2) / CELL)); y < Math.min(gridHeight, Math.ceil((resource.y + 1.2) / CELL)); y++) for (let x = Math.max(0, Math.floor((resource.x - 1.2) / CELL)); x < Math.min(gridWidth, Math.ceil((resource.x + 1.2) / CELL)); x++) {
      const key = offset + y * gridWidth + x;
      if (seen[key] && separation(resource, gridPoint(key)) <= 1.2) found = true;
    }
    if (found) reachableResources++;
    else issues.push(`Resource ${index2} is unreachable by starting workers.`);
  });
  for (const site of sites) if (!reached(site)) issues.push(`Site ${site.id} is unreachable by starting units.`);
  const tiles = /* @__PURE__ */ new Set();
  for (const key of queue) {
    const p = gridPoint(key);
    tiles.add(p.level * width * height + tile(p));
  }
  return { valid: issues.length === 0, issues, startsConnected, reachableResources, totalResources: resources3.length, reachableTiles: tiles.size };
}

// src/editor/scenario-package.ts
var SCENARIO_EDITOR_LIMITS = { bytes: 20 * 1024 * 1024, actors: 256, objectives: 32, events: 128, conditionDepth: 8, actions: 16 };
var unitRoles3 = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var buildingRoles3 = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var packageFields = ["schemaVersion", "kind", "simulationVersion", "revision", "author", "mapHash", "contentHash", "hash", "map", "scenario"];
function bad5(path, detail) {
  throw new Error(`Invalid scenario at ${path}: ${detail}.`);
}
function jsonInput(input) {
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > SCENARIO_EDITOR_LIMITS.bytes) bad5("document", "document exceeds byte limit");
    try {
      input = JSON.parse(input);
    } catch {
      bad5("document", "invalid JSON");
    }
  }
  let nodes = 0, chars = 0;
  const parents = /* @__PURE__ */ new Set();
  function copy3(value2, path, depth) {
    if (++nodes > 7e5 || depth > 48) bad5(path, "document exceeds node or depth limit");
    if (value2 === null || typeof value2 === "boolean") return value2;
    if (typeof value2 === "number") {
      if (!Number.isFinite(value2)) bad5(path, "expected a finite number");
      return Object.is(value2, -0) ? 0 : value2;
    }
    if (typeof value2 === "string") {
      chars += value2.length * 2;
      if (chars > SCENARIO_EDITOR_LIMITS.bytes) bad5(path, "document exceeds byte limit");
      return value2;
    }
    if (!value2 || typeof value2 !== "object") bad5(path, "expected JSON data");
    if (parents.has(value2)) bad5(path, "cyclic references are forbidden");
    parents.add(value2);
    let output;
    if (Array.isArray(value2)) {
      if (value2.length > 65536) bad5(path, "array exceeds length limit");
      if (Reflect.ownKeys(value2).length !== value2.length + 1) bad5(path, "array gaps and extra properties are forbidden");
      const result = [];
      for (let index2 = 0; index2 < value2.length; index2++) {
        const descriptor = Object.getOwnPropertyDescriptor(value2, String(index2));
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) bad5(`${path}[${index2}]`, "array gaps and accessors are forbidden");
        result.push(copy3(descriptor.value, `${path}[${index2}]`, depth + 1));
      }
      output = result;
    } else {
      if (Object.getPrototypeOf(value2) !== Object.prototype && Object.getPrototypeOf(value2) !== null) bad5(path, "expected a plain object");
      const keys3 = Reflect.ownKeys(value2);
      if (keys3.length > 64 || keys3.some((key) => typeof key !== "string")) bad5(path, "invalid object properties");
      const result = /* @__PURE__ */ Object.create(null);
      for (const key of keys3) {
        if (["__proto__", "constructor", "prototype"].includes(key)) bad5(path, "unsafe property name");
        const descriptor = Object.getOwnPropertyDescriptor(value2, key);
        if (!("value" in descriptor) || !descriptor.enumerable) bad5(`${path}.${key}`, "accessors and hidden properties are forbidden");
        result[key] = copy3(descriptor.value, `${path}.${key}`, depth + 1);
      }
      output = result;
    }
    parents.delete(value2);
    return output;
  }
  const copied = copy3(input, "document", 0);
  if (new TextEncoder().encode(JSON.stringify(copied)).byteLength > SCENARIO_EDITOR_LIMITS.bytes) bad5("document", "document exceeds byte limit");
  return copied;
}
function object5(value2, path, fields2, optional = []) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) bad5(path, "expected an object");
  const result = value2;
  for (const field of fields2) if (!Object.hasOwn(result, field)) bad5(`${path}.${field}`, "missing field");
  for (const field of Object.keys(result)) if (!fields2.includes(field) && !optional.includes(field)) bad5(`${path}.${field}`, "unknown field");
  return result;
}
function number5(value2, path, min = 0, max = 1e9, integer2 = false) {
  if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < min || value2 > max || integer2 && !Number.isSafeInteger(value2)) bad5(path, `expected ${integer2 ? "an integer" : "a number"} from ${min} through ${max}`);
  return value2;
}
function text2(value2, path, max = 200, empty2 = false) {
  if (typeof value2 !== "string" || value2.length > max || !empty2 && !value2.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value2)) bad5(path, "invalid text");
  return value2;
}
function id4(value2, path) {
  const result = text2(value2, path, 64);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result)) bad5(path, "use letters, numbers, dots, underscores or hyphens");
  return result;
}
function choice5(value2, path, values) {
  if (typeof value2 !== "string" || !values.includes(value2)) bad5(path, "unknown value");
  return value2;
}
function bool2(value2, path) {
  if (typeof value2 !== "boolean") bad5(path, "expected a boolean");
}
function array2(value2, path, max, min = 0) {
  if (!Array.isArray(value2) || value2.length < min || value2.length > max) bad5(path, `expected ${min} through ${max} entries`);
  return value2;
}
function point4(value2, path, width = 256, height = 256) {
  const p = object5(value2, path, ["x", "y"], ["level"]);
  number5(p.x, `${path}.x`, 0, width);
  number5(p.y, `${path}.y`, 0, height);
  if (p.x === width || p.y === height) bad5(path, "point lies outside the map");
  if (p.level !== void 0) number5(p.level, `${path}.level`, 0, 1, true);
}
function cost4(value2, path) {
  const c = object5(value2, path, ["wood", "ore", "crystal"]);
  for (const key of ["wood", "ore", "crystal"]) number5(c[key], `${path}.${key}`);
}
function order2(value2, path, refs, width, height) {
  const type = choice5(value2?.type, `${path}.type`, ["move", "attackMove", "hold", "stop", "ability", "attack"]);
  const o = object5(value2, path, type === "move" || type === "attackMove" ? ["type", "x", "y"] : type === "attack" ? ["type", "actor"] : ["type"], type === "move" || type === "attackMove" ? ["level"] : []);
  if (type === "move" || type === "attackMove") point4({ x: o.x, y: o.y }, path, width, height);
  if (o.level !== void 0) number5(o.level, `${path}.level`, 0, 1, true);
  if (type === "attack") refs.push(id4(o.actor, `${path}.actor`));
}
function actor2(value2, path, refs, width, height) {
  const a = object5(value2, path, ["label", "side", "kind", "role", "x", "y"], ["definitionId", "hp", "order", "level"]);
  id4(a.label, `${path}.label`);
  number5(a.side, `${path}.side`, 0, 1, true);
  choice5(a.kind, `${path}.kind`, ["unit", "building"]);
  choice5(a.role, `${path}.role`, a.kind === "unit" ? unitRoles3 : buildingRoles3);
  point4({ x: a.x, y: a.y }, path, width, height);
  if (a.level !== void 0) number5(a.level, `${path}.level`, 0, 1, true);
  if (a.definitionId !== void 0) {
    const value3 = text2(a.definitionId, `${path}.definitionId`, 96);
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]*(?::[a-zA-Z0-9_.-]+)?$/.test(value3)) bad5(`${path}.definitionId`, "invalid definition identifier");
  }
  if (a.hp !== void 0) number5(a.hp, `${path}.hp`, Number.MIN_VALUE, 1e7);
  if (a.order !== void 0) order2(a.order, `${path}.order`, refs, width, height);
  return a;
}
function condition(value2, path, refs, width, height, depth = 0) {
  if (depth > SCENARIO_EDITOR_LIMITS.conditionDepth) bad5(path, "condition is too deeply nested");
  const type = choice5(value2?.type, `${path}.type`, ["alive", "dead", "at", "time", "variable", "cleared", "all", "any", "not"]);
  const fields2 = type === "alive" || type === "dead" ? ["type", "actor"] : type === "at" ? ["type", "actor", "point", "radius"] : type === "time" ? ["type", "seconds"] : type === "variable" ? ["type", "key", "op", "value"] : type === "cleared" ? ["type", "side"] : type === "not" ? ["type", "condition"] : ["type", "conditions"];
  const c = object5(value2, path, fields2, type === "cleared" ? ["buildings"] : []);
  if (type === "alive" || type === "dead" || type === "at") refs.push(id4(c.actor, `${path}.actor`));
  if (type === "at") {
    point4(c.point, `${path}.point`, width, height);
    number5(c.radius, `${path}.radius`, 0.1, 256);
  }
  if (type === "time") number5(c.seconds, `${path}.seconds`, 0, 86400);
  if (type === "variable") {
    id4(c.key, `${path}.key`);
    choice5(c.op, `${path}.op`, ["eq", "gte", "lte"]);
    number5(c.value, `${path}.value`, -1e9, 1e9);
  }
  if (type === "cleared") {
    number5(c.side, `${path}.side`, 0, 1, true);
    if (c.buildings !== void 0) bool2(c.buildings, `${path}.buildings`);
  }
  if (type === "all" || type === "any") array2(c.conditions, `${path}.conditions`, 16, 1).forEach((v, i) => condition(v, `${path}.conditions[${i}]`, refs, width, height, depth + 1));
  if (type === "not") condition(c.condition, `${path}.condition`, refs, width, height, depth + 1);
}
function decodeScenarioDraft(input) {
  return readScenario(jsonInput(input), false);
}
function decodeScenarioDefinition(input) {
  return validateScenario(readScenario(jsonInput(input), true));
}
function readScenario(value2, complete) {
  const s = object5(value2, "scenario", ["schemaVersion", "id", "title", "briefing", "successText", "failureText", "faction", "opponent", "seed", "army", "objectives", "events", "rules"], ["map", "content", "escort", "stealth", "boss", "requiredActions"]);
  if (s.schemaVersion !== 1) bad5("scenario.schemaVersion", "unsupported schema version");
  id4(s.id, "scenario.id");
  text2(s.title, "scenario.title", 120);
  for (const field of ["briefing", "successText", "failureText"]) text2(s[field], `scenario.${field}`, 8e3, true);
  if (s.content !== void 0) s.content = decodeContentBundle(s.content);
  const factions2 = contentFactions(s.content);
  for (const field of ["faction", "opponent"]) choice5(s[field], `scenario.${field}`, Object.keys(factions2));
  number5(s.seed, "scenario.seed", 0, 4294967295, true);
  let width = 256, height = 256;
  if (s.map !== void 0) {
    const m = object5(s.map, "scenario.map", ["size", "width", "height", "terrain", "starts", "resources"], ["world"]);
    width = number5(m.width, "scenario.map.width", 8, 256, true);
    height = number5(m.height, "scenario.map.height", 8, 256, true);
    if (m.world !== void 0) m.world = decodeEditorMap(m.world);
    choice5(m.size, "scenario.map.size", ["small", "medium", "large", "huge"]);
    const terrain2 = array2(m.terrain, "scenario.map.terrain", 65536);
    if (terrain2.length !== width * height) bad5("scenario.map.terrain", "tile count does not match dimensions");
    terrain2.forEach((t, i) => choice5(t, `scenario.map.terrain[${i}]`, Object.keys(TERRAIN)));
    array2(m.starts, "scenario.map.starts", 8, 2).forEach((p, i) => point4(p, `scenario.map.starts[${i}]`, width, height));
    array2(m.resources, "scenario.map.resources", 8192).forEach((v, i) => {
      const p = `scenario.map.resources[${i}]`, r2 = object5(v, p, ["x", "y", "kind", "amount", "maxAmount"], ["level"]);
      point4({ x: r2.x, y: r2.y }, p, width, height);
      if (r2.level !== void 0) number5(r2.level, `${p}.level`, 0, 1, true);
      choice5(r2.kind, `${p}.kind`, ["wood", "ore", "crystal"]);
      number5(r2.amount, `${p}.amount`);
      number5(r2.maxAmount, `${p}.maxAmount`, Number.MIN_VALUE);
      if (r2.amount > r2.maxAmount) bad5(p, "amount exceeds maximum");
    });
  }
  const refs = [], labels = /* @__PURE__ */ new Set();
  const actors = (values, path, min = 0) => array2(values, path, SCENARIO_EDITOR_LIMITS.actors, min).forEach((v, i) => {
    const a = actor2(v, `${path}[${i}]`, refs, width, height);
    if (labels.has(a.label)) bad5(`${path}[${i}].label`, "duplicate actor label");
    labels.add(a.label);
  });
  actors(s.army, "scenario.army");
  const objectiveIds = /* @__PURE__ */ new Set();
  array2(s.objectives, "scenario.objectives", SCENARIO_EDITOR_LIMITS.objectives, complete ? 1 : 0).forEach((value3, i) => {
    const path = `scenario.objectives[${i}]`, o = object5(value3, path, ["id", "text", "success"], ["failure", "optional"]);
    const key = id4(o.id, `${path}.id`);
    if (objectiveIds.has(key)) bad5(`${path}.id`, "duplicate objective ID");
    objectiveIds.add(key);
    text2(o.text, `${path}.text`, 2e3);
    condition(o.success, `${path}.success`, refs, width, height);
    if (o.failure !== void 0) condition(o.failure, `${path}.failure`, refs, width, height);
    if (o.optional !== void 0) bool2(o.optional, `${path}.optional`);
  });
  const eventIds = /* @__PURE__ */ new Set();
  array2(s.events, "scenario.events", SCENARIO_EDITOR_LIMITS.events).forEach((value3, i) => {
    const path = `scenario.events[${i}]`, e = object5(value3, path, ["id", "when", "actions"], ["repeat"]);
    const key = id4(e.id, `${path}.id`);
    if (eventIds.has(key)) bad5(`${path}.id`, "duplicate event ID");
    eventIds.add(key);
    condition(e.when, `${path}.when`, refs, width, height);
    if (e.repeat !== void 0) {
      const r2 = object5(e.repeat, `${path}.repeat`, ["seconds", "count"]);
      number5(r2.seconds, `${path}.repeat.seconds`, 1, 86400);
      number5(r2.count, `${path}.repeat.count`, 1, 1e4, true);
    }
    array2(e.actions, `${path}.actions`, SCENARIO_EDITOR_LIMITS.actions, complete ? 1 : 0).forEach((value4, index2) => {
      const p = `${path}.actions[${index2}]`, type = choice5(value4?.type, `${p}.type`, ["spawn", "order", "set", "add", "message", "reward", "alliance", "finish"]);
      const a = object5(value4, p, type === "spawn" ? ["type", "actors"] : type === "order" ? ["type", "actors", "order"] : type === "set" || type === "add" ? ["type", "key", "value"] : type === "message" ? ["type", "text"] : type === "reward" ? ["type", "side", "resources"] : type === "alliance" ? ["type", "allied"] : ["type", "outcome", "reason"], type === "message" ? ["speaker"] : []);
      if (type === "spawn") actors(a.actors, `${p}.actors`, 1);
      if (type === "order") {
        array2(a.actors, `${p}.actors`, 512, 1).forEach((v, i2) => refs.push(id4(v, `${p}.actors[${i2}]`)));
        order2(a.order, `${p}.order`, refs, width, height);
      }
      if (type === "set" || type === "add") {
        id4(a.key, `${p}.key`);
        number5(a.value, `${p}.value`, -1e9, 1e9);
      }
      if (type === "message") {
        text2(a.text, `${p}.text`, 8e3);
        if (a.speaker !== void 0) text2(a.speaker, `${p}.speaker`, 120);
      }
      if (type === "reward") {
        number5(a.side, `${p}.side`, 0, 1, true);
        cost4(a.resources, `${p}.resources`);
      }
      if (type === "alliance") bool2(a.allied, `${p}.allied`);
      if (type === "finish") {
        choice5(a.outcome, `${p}.outcome`, ["won", "lost"]);
        text2(a.reason, `${p}.reason`, 2e3);
      }
    });
  });
  const r = object5(s.rules, "scenario.rules", ["fixedArmy", "reinforcementBudget", "resources", "timeLimit"]);
  bool2(r.fixedArmy, "scenario.rules.fixedArmy");
  number5(r.reinforcementBudget, "scenario.rules.reinforcementBudget", 0, 1e5, true);
  number5(r.timeLimit, "scenario.rules.timeLimit", 0.05, 86400);
  cost4(r.resources, "scenario.rules.resources");
  if (s.escort !== void 0) {
    const e = object5(s.escort, "scenario.escort", ["actor", "route", "radius", "escortRadius"]);
    refs.push(id4(e.actor, "scenario.escort.actor"));
    array2(e.route, "scenario.escort.route", 256, 1).forEach((p, i) => point4(p, `scenario.escort.route[${i}]`, width, height));
    number5(e.radius, "scenario.escort.radius", 0.1, 256);
    number5(e.escortRadius, "scenario.escort.escortRadius", 0.1, 256);
  }
  if (s.stealth !== void 0) {
    const t = object5(s.stealth, "scenario.stealth", ["infiltrators", "guards", "alarmLimit", "detectionSeconds", "radius", "coneDegrees", "patrols"]);
    for (const k of ["infiltrators", "guards"]) array2(t[k], `scenario.stealth.${k}`, 512, 1).forEach((v, i) => refs.push(id4(v, `scenario.stealth.${k}[${i}]`)));
    number5(t.alarmLimit, "scenario.stealth.alarmLimit", 1, 1e4, true);
    number5(t.detectionSeconds, "scenario.stealth.detectionSeconds", 0.05, 86400);
    number5(t.radius, "scenario.stealth.radius", 0.1, 256);
    number5(t.coneDegrees, "scenario.stealth.coneDegrees", 1, 360);
    array2(t.patrols, "scenario.stealth.patrols", 512).forEach((v, i) => {
      const p = `scenario.stealth.patrols[${i}]`, patrol = object5(v, p, ["actor", "route"]);
      refs.push(id4(patrol.actor, `${p}.actor`));
      array2(patrol.route, `${p}.route`, 256, 1).forEach((v2, j) => point4(v2, `${p}.route[${j}]`, width, height));
    });
  }
  if (s.boss !== void 0) {
    const b = object5(s.boss, "scenario.boss", ["actor", "name", "health", "phases"]);
    refs.push(id4(b.actor, "scenario.boss.actor"));
    text2(b.name, "scenario.boss.name", 120);
    number5(b.health, "scenario.boss.health", 0.1, 1e7);
    array2(b.phases, "scenario.boss.phases", 32, 1).forEach((v, i) => {
      const p = `scenario.boss.phases[${i}]`, phase = object5(v, p, ["below", "name", "radius", "damage", "warningSeconds", "cooldown", "interruptDamage", "adds"]);
      number5(phase.below, `${p}.below`, 0, 1);
      text2(phase.name, `${p}.name`, 120);
      number5(phase.radius, `${p}.radius`, 0.1, 256);
      number5(phase.damage, `${p}.damage`);
      number5(phase.warningSeconds, `${p}.warningSeconds`, 0.05, 86400);
      number5(phase.cooldown, `${p}.cooldown`, 0.05, 86400);
      number5(phase.interruptDamage, `${p}.interruptDamage`);
      actors(phase.adds, `${p}.adds`);
    });
  }
  if (s.requiredActions !== void 0) array2(s.requiredActions, "scenario.requiredActions", 32).forEach((v, i) => {
    const p = `scenario.requiredActions[${i}]`, a = object5(v, p, ["action", "count", "text"]);
    choice5(a.action, `${p}.action`, ["ability", "hold", "repair", "gather"]);
    number5(a.count, `${p}.count`, 1, 1e5, true);
    text2(a.text, `${p}.text`, 2e3);
  });
  if (complete) {
    for (const ref of refs) if (!labels.has(ref)) bad5("scenario", `unknown actor label ${ref}`);
  }
  return JSON.parse(JSON.stringify(s));
}
function scenarioMapFromPackage(input) {
  const { map } = decodeMapPackage(input);
  const rich = map.levels.length !== 1 || map.starts.some((p) => p.level !== 0) || map.resources.some((p) => p.level !== 0) || map.transitions.length > 0 || map.sites.length > 0 || map.levels[0].elevation.some((v) => v !== 0);
  if (rich) return { size: map.size, width: map.width, height: map.height, terrain: [...map.levels.find((level2) => level2.id === 0).terrain], starts: [...map.starts].sort((a, b) => a.slot - b.slot).map(({ x, y, level: level2 }) => ({ x, y, level: level2 })), resources: map.resources.map(({ x, y, level: level2, kind, amount, maxAmount }) => ({ x, y, level: level2, kind, amount, maxAmount })), world: structuredClone(map) };
  return { size: map.size, width: map.width, height: map.height, terrain: [...map.levels[0].terrain], starts: [...map.starts].sort((a, b) => a.slot - b.slot).map(({ x, y }) => ({ x, y })), resources: map.resources.map(({ x, y, kind, amount, maxAmount }) => ({ x, y, kind, amount, maxAmount })) };
}
function canonical2(value2) {
  if (Array.isArray(value2)) return `[${value2.map(canonical2).join(",")}]`;
  if (value2 && typeof value2 === "object") {
    const r = value2;
    return `{${Object.keys(r).sort().map((k) => `${JSON.stringify(k)}:${canonical2(r[k])}`).join(",")}}`;
  }
  return JSON.stringify(value2);
}
function hash2(value2) {
  let a = 2166136261, b = 2654435769;
  for (const byte of new TextEncoder().encode(canonical2(value2))) {
    a = Math.imul(a ^ byte, 16777619) >>> 0;
    b = Math.imul(b ^ byte, 2246822507) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
function canonicalScenarioHash(input) {
  return hash2(decodeScenarioDefinition(input));
}
function makeScenarioPackage(metadata2, input, mapInput) {
  const m = object5(jsonInput(metadata2), "metadata", ["author", "revision"]);
  text2(m.author, "metadata.author", 120);
  number5(m.revision, "metadata.revision", 1, 2147483647, true);
  const map = decodeMapPackage(mapInput), validation = validateEditorMap(map.map);
  if (!validation.valid) throw new Error(`Scenario map cannot be played: ${validation.issues.join("; ")}`);
  if (map.map.starts.length !== 2) throw new Error("Scenarios require two starting positions.");
  const scenario = decodeScenarioDefinition({ ...decodeScenarioDraft(input), map: scenarioMapFromPackage(map), seed: map.map.seed });
  const data = { schemaVersion: 1, kind: "scenario", simulationVersion: SAVE_VERSION, revision: m.revision, author: m.author, mapHash: map.hash, contentHash: canonicalScenarioHash(scenario), map, scenario };
  return { ...data, hash: hash2(data) };
}
function decodeScenarioPackage(input) {
  const p = object5(jsonInput(input), "package", packageFields);
  if (p.schemaVersion !== 1 || p.kind !== "scenario") bad5("package", "unsupported package schema or kind");
  if (p.simulationVersion !== SAVE_VERSION) bad5("package.simulationVersion", `expected current simulation version ${SAVE_VERSION}`);
  text2(p.author, "package.author", 120);
  number5(p.revision, "package.revision", 1, 2147483647, true);
  for (const field of ["hash", "mapHash", "contentHash"]) if (typeof p[field] !== "string" || !/^[0-9a-f]{16}$/.test(p[field])) bad5(`package.${field}`, "invalid checksum");
  const map = decodeMapPackage(p.map), scenario = decodeScenarioDefinition(p.scenario);
  const validation = validateEditorMap(map.map);
  if (!validation.valid) bad5("package.map", validation.issues.join("; "));
  if (map.map.starts.length !== 2) bad5("package.map", "scenarios require two starting positions");
  if (p.mapHash !== map.hash) bad5("package.mapHash", "map dependency checksum mismatch");
  if (p.contentHash !== canonicalScenarioHash(scenario)) bad5("package.contentHash", "scenario checksum mismatch");
  if (canonical2(scenario.map) !== canonical2(scenarioMapFromPackage(map)) || scenario.seed !== map.map.seed) bad5("package.scenario.map", "embedded scenario map differs from dependency");
  const { hash: expected, ...body } = p;
  if (expected !== hash2(body)) bad5("package.hash", "package checksum mismatch");
  return { ...p, map, scenario };
}

// scenario-browser-fixture-input.ts
async function derive(native, output, pin) {
  assert.equal(SAVE_VERSION, 4);
  assert.equal(SIMULATION_REVISION, "4.0.1");
  const json = async (path) => JSON.parse(await readFile(path, "utf8"));
  const save = async (name, value2) => writeFile(join(output, name), JSON.stringify(value2, null, 2) + "\n", { flag: "wx" });
  const hashes = {};
  const nativeArtifacts = (await json(join(native, "native-admission.json"))).artifacts;
  const sourceJson = async (path, label) => {
    const bytes = await readFile(path);
    const receipt = nativeArtifacts[resolve(path)];
    assert(receipt, "Unadmitted native input: " + path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), receipt.sha256);
    assert.equal(bytes.length, receipt.bytes);
    hashes[label] = { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    return JSON.parse(bytes.toString());
  };
  const rawEquipped = await sourceJson(join(native, "persistent-army/chapter1-equipped-active-profile.json"), "earnedEquippedProfile");
  const originalCheckpoint = await sourceJson(join(native, "persistent-army/chapter1-equipped-checkpoint.json"), "earnedEquippedCheckpoint");
  const equipped = prepareCampaignMission(decodeCampaignProfile(rawEquipped));
  try {
    assert.deepEqual(equipped.profile, rawEquipped);
    assert.deepEqual(captureScenario(equipped.session), originalCheckpoint);
    const generic = createSessionFile(equipped.session.state, void 0, void 0, { kind: "campaign", profile: equipped.profile });
    const loaded = decodeSessionFile(generic);
    assert(scenarioStateEquals({ ...equipped.session, state: loaded.state, runtime: loaded.state.scenario.runtime }, equipped.session));
    const actor3 = equipped.session.state.entities.find((entity) => entity.side === 0 && entity.equipment?.armor);
    assert(actor3);
    assert.equal(equipped.session.state.specialists.artifacts.find((item) => item.id === actor3.equipment.armor)?.definitionId, "core:iron-aegis");
    await save("current-equipped-session.json", generic);
  } finally {
    equipped.recorder.destroy();
  }
  const primary = await sourceJson(join(native, "primary.json"), "primaryReport");
  const earned = primary.profiles.find((profile) => profile.campaignId === "campaign-orcs");
  assert(earned);
  const completed = decodeCampaignProfile(await sourceJson(earned.profilePath, "earnedCompletedOrcProfile"));
  assert.equal(completed.history.length, 4);
  assert.equal(completed.active, null);
  const prefix = decodeCampaignProfile({ ...completed, history: completed.history.slice(0, 3), active: null });
  const finale2 = prepareCampaignMission(prefix);
  try {
    assert.equal(finale2.profile.active.missionId, "orcs-4");
    assert.deepEqual(finale2.profile.history, completed.history.slice(0, 3));
    assert.equal(finale2.profile.id, completed.id);
    assert.equal(finale2.profile.choiceId, completed.choiceId);
    await save("canonical-orcs-active-finale.json", finale2.profile);
  } finally {
    finale2.recorder.destroy();
  }
  const width = 36, height = 36;
  const map = {
    width,
    height,
    size: "small",
    seed: 96101,
    levels: [{ id: 0, title: "Ground", terrain: Array(width * height).fill("grass"), elevation: Array(width * height).fill(0) }],
    starts: [{ slot: 0, level: 0, x: 6.5, y: 26.5 }, { slot: 1, level: 0, x: 28.5, y: 6.5 }],
    resources: [],
    sites: [],
    transitions: []
  };
  const mapPackage = makeMapPackage({ id: "commander-field", title: "Commander field", author: "Native scenario proof", revision: 1 }, map);
  const mark = { x: 14.5, y: 26.5 };
  const condition2 = { type: "at", actor: "commander", point: mark, radius: 0.75 };
  const definition2 = {
    schemaVersion: 1,
    id: "authored-command-field",
    title: "Command field",
    briefing: "Use Iron Command beside the allied line, then reach the signal mark.",
    successText: "The signal is raised.",
    failureText: "The commander was lost.",
    faction: "orcs",
    opponent: "fairies",
    seed: map.seed,
    army: [
      { label: "commander", side: 0, kind: "unit", role: "special", definitionId: "core:orcs-commander", x: 6.5, y: 26.5, order: { type: "hold" } },
      { label: "line-a", side: 0, kind: "unit", role: "melee", x: 8.5, y: 25.5, order: { type: "hold" } },
      { label: "line-b", side: 0, kind: "unit", role: "ranged", x: 8.5, y: 27.5, order: { type: "hold" } }
    ],
    objectives: [{ id: "signal-mark", text: "Reach the signal mark.", success: condition2, failure: { type: "dead", actor: "commander" } }],
    events: [{ id: "raise-signal", when: condition2, actions: [{ type: "finish", outcome: "won", reason: "Reached the signal mark." }] }],
    rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 600 }
  };
  const authored = decodeScenarioPackage(makeScenarioPackage({ author: "Native scenario proof", revision: 1 }, definition2, mapPackage));
  const authoredSession = createScenario(authored.scenario);
  decodeSessionFile(createSessionFile(authoredSession.state));
  await save("authored-commander-scenario.json", authored);
  await save("derivation.json", {
    sourceCommit: pin,
    simulationRevision: SIMULATION_REVISION,
    saveVersion: SAVE_VERSION,
    sourceInputs: hashes,
    finale: "The same first three earned chapter records are selected from the genuine completed primary profile; native preparation creates the finale deployment.",
    equipped: "Native restore and session APIs preserve the original checkpoint, accepted command prefix and earned Iron Aegis.",
    authored: "This authored field is a new declared scenario fixture, not an earned campaign result. No gameplay command is authored by this generator; native validation replays genuine current journals.",
    visible: {
      authored: { commander: { x: 6.5, y: 26.5 }, abilityTarget: { x: 7.5, y: 26.5 }, finishMark: mark, mapEditCell: { level: 0, x: 18, y: 18, from: "grass", to: "mud" } },
      equipped: { commander: rawEquipped.active.checkpoint.runtime.labels.commander },
      finale: { commander: finale2.profile.active.checkpoint.runtime.labels.commander }
    }
  });
}
export {
  derive
};
