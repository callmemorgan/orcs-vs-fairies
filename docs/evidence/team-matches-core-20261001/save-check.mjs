// ../../../../tmp/orcs-team-matches-c1f2264/source/core/content.ts
var unit = (id2, name, role, wood, ore, hp, damage, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id2, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building = (id2, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id: id2, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
var BASE_FACTIONS = {
  orcs: { id: "orcs", name: "Ironclad", subtitle: "Strength in the struggle", color: 13662021, accent: "#dba35d", description: "Armored warbands gather fury as they fight. Hold the line, build momentum, and break the enemy stronghold.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit("orc-worker", "Scrapper", "worker", 50, 0, 85, 5, 1, 1.3, 2.1, 1.4, 12, void 0, "Harvest timber, ore and crystal. Raise and repair your settlement."),
    melee: unit("orc-melee", "Ironjaw", "melee", 70, 25, 175, 15, 3, 1.4, 1.8, 1.15, 36, "momentum", "Armored front line. Sustained attacks build Fury, granting up to 40% damage and 15% attack speed."),
    ranged: unit("orc-ranged", "Boltspitter", "ranged", 85, 35, 100, 15, 1, 6.5, 2, 1.5, 40, "momentum", "Crossbow volleys punish exposed enemies. Builds Fury with each hit."),
    special: unit("orc-special", "Wardrum", "special", 120, 70, 190, 21, 3, 1.6, 1.65, 1.65, 56, "momentum", "Heavy shock infantry. Fury makes prolonged brawls devastating.")
  }, buildings: {
    hq: building("orc-hq", "Iron Hall", "hq", 240, 120, 1800, 3, 55, "Your stronghold. Trains Scrappers and supports 12 population."),
    depot: building("orc-depot", "Timber Yard", "depot", 100, 0, 600, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building("orc-barracks", "War Foundry", "barracks", 160, 50, 950, 3, 35, "Trains Ironjaws, Boltspitters, and Wardrums."),
    tower: building("orc-tower", "Watchtower", "tower", 120, 80, 750, 2, 30, "Defends nearby ground with heavy bolts.")
  } },
  fairies: { id: "fairies", name: "Wild Court", subtitle: "The forest remembers", color: 7395517, accent: "#a1e1c6", description: "Swift woodland defenders weave deceptive doubles and recover beneath healing groves. Strike, vanish, and return.", ai: { aggression: 0.9, armySize: 10, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit("fairy-worker", "Tender", "worker", 50, 0, 65, 4, 0, 1.3, 2.5, 1.3, 12, void 0, "Gather timber, ore and crystal. Cultivate the living buildings of the Court."),
    melee: unit("fairy-melee", "Thornblade", "melee", 65, 25, 140, 17, 2, 1.5, 2.75, 1, 34, void 0, "Swift spear guardians. Reposition quickly and protect fragile casters."),
    ranged: unit("fairy-ranged", "Mothbow", "ranged", 80, 40, 85, 18, 0, 7, 2.6, 1.4, 40, void 0, "Long-range arrows and quick wings reward careful positioning."),
    special: unit("fairy-special", "Veilweaver", "special", 110, 75, 105, 13, 1, 5, 2.5, 1.5, 56, "illusion", "Conjures temporary doubles to draw enemy attacks. Activate with Q.")
  }, buildings: {
    hq: building("fairy-hq", "Elderheart", "hq", 240, 120, 1650, 3, 55, "The heart of your settlement. Trains Tenders and supports 12 population."),
    depot: building("fairy-depot", "Moonwell", "depot", 100, 0, 520, 2, 22, "Resource drop-off. Passively heals nearby friendly units at 2.5 HP/s within 6 tiles. Adds 10 population capacity.", "heal"),
    barracks: building("fairy-barracks", "Bloomspire", "barracks", 160, 50, 800, 3, 35, "Trains Thornblades, Mothbows, and Veilweavers."),
    tower: building("fairy-tower", "Thornwatch", "tower", 120, 80, 650, 2, 30, "A living defensive spire that guards the surrounding grove.")
  } },
  dwarves: { id: "dwarves", name: "Deepforge", subtitle: "Choose the ground. Hold it.", color: 15185233, accent: "#edc675", description: "Engineers prepare firing positions. Emplace your troops for protection and cannon range, then pack up to advance.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.4, ranged: 0.35, special: 0.25 } }, units: {
    worker: unit("dwarf-worker", "Mason", "worker", 50, 0, 80, 5, 1, 1.3, 2.1, 1.4, 12, void 0, "Gather wood, ore and crystal. Construct and repair the Deepforge settlement."),
    melee: unit("dwarf-melee", "Shieldguard", "melee", 70, 30, 170, 15, 3, 1.4, 1.9, 1.15, 35, "entrench", "Protect the gun line. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up."),
    ranged: unit("dwarf-ranged", "Thunderlock", "ranged", 85, 40, 95, 20, 1, 6.5, 2, 1.7, 40, "entrench", "Musket infantry. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up."),
    special: { ...unit("dwarf-special", "Siege Cannon", "special", 130, 85, 145, 32, 2, 6, 1.45, 2.6, 58, "entrench", "Long-range artillery deals 80% bonus damage to buildings. Q emplaces: after 3 seconds, gain 3 range, 2 armor and 15% damage. Movement packs up."), sight: 11, buildingDamageMultiplier: 1.8 }
  }, buildings: {
    hq: building("dwarf-hq", "Mountain Keep", "hq", 240, 120, 1800, 3, 55, "Your stronghold. Trains Masons and supports 12 population."),
    depot: building("dwarf-depot", "Supply Vault", "depot", 100, 0, 620, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building("dwarf-barracks", "Gunsmith Hall", "barracks", 160, 50, 950, 3, 35, "Trains Shieldguards, Thunderlocks and Siege Cannons."),
    tower: building("dwarf-tower", "Gun Bastion", "tower", 120, 80, 800, 2, 30, "A stone gun emplacement that protects your prepared position.")
  } },
  undead: { id: "undead", name: "Ashen Host", subtitle: "The fallen march again", color: 11049433, accent: "#c5b5ed", description: "Expendable ranks screen the Gravecaller, who consumes nearby corpses to raise temporary warriors. Protect your casters to sustain the attack.", ai: { aggression: 1.1, armySize: 11, composition: { melee: 0.55, ranged: 0.3, special: 0.15 } }, units: {
    worker: unit("undead-worker", "Gravedigger", "worker", 50, 0, 60, 4, 0, 1.3, 2.3, 1.3, 12, void 0, "Gather wood, ore and crystal. Raise and repair the necropolis."),
    melee: unit("undead-melee", "Boneguard", "melee", 45, 15, 115, 14, 1, 1.4, 2.35, 1, 24, void 0, "Cheap, fragile infantry. Fallen mortal troops leave corpses for Gravecallers."),
    ranged: unit("undead-ranged", "Gravebow", "ranged", 65, 30, 80, 17, 0, 6.5, 2.25, 1.4, 32, void 0, "Brittle archers. Keep a screen of Boneguards between them and the enemy."),
    special: unit("undead-special", "Gravecaller", "special", 110, 80, 95, 12, 0, 5.5, 2.1, 1.6, 48, "raise", "Automatically (or Q) consumes up to 2 corpses within 6 tiles, raising half-health Boneguards for 35 seconds. 22s cooldown. Raised troops use population and cannot be raised again.")
  }, buildings: {
    hq: building("undead-hq", "Necropolis", "hq", 240, 120, 1650, 3, 55, "Your stronghold. Trains Gravediggers and supports 12 population."),
    depot: building("undead-depot", "Ossuary", "depot", 100, 0, 500, 2, 22, "Resource drop-off. Adds 10 population capacity."),
    barracks: building("undead-barracks", "Crypt", "barracks", 160, 50, 800, 3, 35, "Trains Boneguards, Gravebows and Gravecallers."),
    tower: building("undead-tower", "Soul Spire", "tower", 120, 80, 650, 2, 30, "A funerary spire that fires at intruders.")
  } },
  tideborn: { id: "tideborn", terrainSpeeds: { mud: 1.1, shallows: 1.1 }, name: "Tideborn", subtitle: "Follow the returning tide", color: 5744547, accent: "#e2b897", description: "Amphibious defenders cross mud and shallows at full speed. Tidecallers heal their formation and send it forward in a surge.", ai: { aggression: 1, armySize: 9, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: unit("tideborn-worker", "Reef Tender", "worker", 50, 0, 70, 4, 0, 1.3, 2.3, 1.3, 12, void 0, "Gather wood, ore and crystal. Cross mud and shallows without slowing."),
    melee: unit("tideborn-melee", "Shellguard", "melee", 70, 25, 170, 16, 3, 1.4, 2.15, 1.15, 35, void 0, "Shell-armored infantry. Wet ground gives this steady formation a route around slower enemies."),
    ranged: unit("tideborn-ranged", "Harpooner", "ranged", 80, 35, 90, 20, 0, 6.5, 2.3, 1.45, 38, void 0, "Harpoons strike from behind the Shellguard line. Moves freely through mud and shallows."),
    special: unit("tideborn-special", "Tidecaller", "special", 110, 75, 115, 11, 1, 5.5, 2.2, 1.6, 54, "surge", "Q restores 35 HP to nearby allies and grants 25% movement speed for 6 seconds. 20s cooldown. Casts automatically when nearby allies are wounded in combat.")
  }, buildings: {
    hq: building("tideborn-hq", "Coral Hold", "hq", 240, 120, 1700, 3, 55, "Trains Reef Tenders and supports 12 population."),
    depot: building("tideborn-depot", "Tidal Basin", "depot", 100, 0, 560, 2, 22, "Resource drop-off for wood, ore and crystal. Adds 10 population capacity."),
    barracks: building("tideborn-barracks", "Reef Lodge", "barracks", 160, 50, 860, 3, 35, "Trains Shellguards, Harpooners and Tidecallers."),
    tower: building("tideborn-tower", "Conch Spire", "tower", 120, 80, 700, 2, 30, "A fortified conch that fires at nearby invaders.")
  } },
  automata: { id: "automata", name: "Automata", subtitle: "Repair. Recharge. Return.", color: 11967209, accent: "#d8cbb0", description: "Ceramic machines carry shields that recharge after six seconds without damage. Ward Engines restore shields to sustain the formation.", ai: { aggression: 0.95, armySize: 8, composition: { melee: 0.45, ranged: 0.35, special: 0.2 } }, units: {
    worker: { ...unit("automata-worker", "Assembler", "worker", 50, 0, 55, 4, 0, 1.3, 2.15, 1.4, 12, void 0, "Gather wood, ore and crystal. Carries a 12-point rechargeable shield."), shield: 12 },
    melee: { ...unit("automata-melee", "Sentinel", "melee", 70, 25, 135, 15, 2, 1.4, 1.95, 1.2, 35, void 0, "A 45-point shield absorbs damage before ceramic armor takes harm. Shields recharge at 4/s after 6 seconds without damage."), shield: 45 },
    ranged: { ...unit("automata-ranged", "Prism Archer", "ranged", 85, 40, 75, 19, 0, 7, 2.1, 1.6, 42, void 0, "Crystal beams reach across the front line. Carries a 35-point rechargeable shield."), shield: 35 },
    special: { ...unit("automata-special", "Ward Engine", "special", 120, 80, 135, 12, 2, 5, 1.8, 1.7, 56, "ward", "Q restores 24 shield to nearby friendly machines. Casts automatically when shields are damaged. 20s cooldown. Carries a 45-point shield."), shield: 45 }
  }, buildings: {
    hq: building("automata-hq", "Core Foundry", "hq", 240, 120, 1750, 3, 55, "Trains Assemblers and supports 12 population."),
    depot: building("automata-depot", "Crystal Depot", "depot", 100, 0, 580, 2, 22, "Resource drop-off for wood, ore and crystal. Adds 10 population capacity."),
    barracks: building("automata-barracks", "Assembly Hall", "barracks", 160, 50, 900, 3, 35, "Trains Sentinels, Prism Archers and Ward Engines."),
    tower: building("automata-tower", "Prism Tower", "tower", 120, 80, 740, 2, 30, "Focused crystal beams defend the foundry.")
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
var FACTIONS = Object.fromEntries(Object.entries(BASE_FACTIONS).map(([id2, base]) => {
  const faction = id2, prefix = base.units.worker.id.split("-")[0], names = expansionNames[faction];
  return [id2, { ...base, buildings: {
    ...base.buildings,
    wall: { ...building(`${prefix}-wall`, "Stone Wall", "wall", 30, 25, 1100, 1, 15, "A durable barrier. Siege engines break walls quickly."), age: 2 },
    gate: { ...building(`${prefix}-gate`, "Town Gate", "gate", 90, 65, 1400, 2, 28, "Open to let armies pass. An open gate also admits enemies. Cannot close on a unit."), age: 2 }
  }, units: {
    ...base.units,
    special: { ...base.units.special, age: 2 },
    cavalry: { ...unit(`${prefix}-cavalry`, names[0], "cavalry", 100, 65, 210, 18, 2, 1.5, 3.5, 1.3, 42, void 0, "Fast raider. Strong against ranged troops; vulnerable to pikes."), age: 2, bonusAgainst: { ranged: 1.7 } },
    spear: { ...unit(`${prefix}-spear`, names[1], "spear", 55, 25, 125, 11, 1, 1.9, 2.1, 1.25, 28, void 0, "Long pike infantry. Deals triple damage to cavalry."), age: 1, bonusAgainst: { cavalry: 3 } },
    siege: { ...unit(`${prefix}-siege`, names[2], "siege", 180, 140, 185, 28, 2, 8.5, 1.05, 3.8, 65, void 0, "Long-range siege engine. Deals quadruple damage to buildings. Protect it from raiders."), age: 3, cost: { wood: 180, ore: 140, crystal: 25 }, buildingDamageMultiplier: 4, sight: 11 }
  } }];
}));
var UPGRADES = {
  "town-age": { id: "town-age", name: "Town Age", description: "Unlock advanced troops, fortifications and expansion strongholds.", cost: { wood: 260, ore: 180, crystal: 0 }, researchTime: 65, building: "hq", appliesTo: "worker", advancesTo: 2, effects: {} },
  "citadel-age": { id: "citadel-age", name: "Citadel Age", description: "Unlock siege engines and veteran military technology.", cost: { wood: 420, ore: 320, crystal: 60 }, researchTime: 90, building: "hq", appliesTo: "worker", age: 2, requires: ["town-age"], advancesTo: 3, effects: {} },
  "forged-weapons": { id: "forged-weapons", name: "Forged Weapons", description: "Melee troops deal 20% more damage.", cost: { wood: 100, ore: 130, crystal: 0 }, researchTime: 35, building: "barracks", appliesTo: "melee", age: 2, effects: { damage: 1.2 } },
  "tempered-armor": { id: "tempered-armor", name: "Tempered Armor", description: "Melee troops gain 2 armor.", cost: { wood: 80, ore: 150, crystal: 0 }, researchTime: 40, building: "barracks", appliesTo: "melee", age: 2, effects: { armor: 2 } },
  "veteran-arms": { id: "veteran-arms", name: "Veteran Arms", description: "Melee troops deal another 25% damage.", cost: { wood: 160, ore: 220, crystal: 35 }, researchTime: 50, building: "barracks", appliesTo: "melee", age: 3, requires: ["forged-weapons"], effects: { damage: 1.25 } },
  "worker-harvest": { id: "worker-harvest", name: "Harvest Drills", description: "Workers gather 30% faster.", cost: { wood: 100, ore: 50, crystal: 0 }, researchTime: 30, building: "hq", appliesTo: "worker", effects: { gather: 1.3 } },
  "worker-speed": { id: "worker-speed", name: "Courier Training", description: "Workers move 20% faster.", cost: { wood: 75, ore: 50, crystal: 0 }, researchTime: 25, building: "hq", appliesTo: "worker", effects: { speed: 1.2 } }
};

// ../../../../tmp/orcs-team-matches-c1f2264/source/core/maps.ts
var MAP_VERSION = 2;
var TERRAIN = {
  grass: { name: "Meadow", walkable: true, buildable: true, speed: 1 },
  road: { name: "Road", walkable: true, buildable: true, speed: 1.15 },
  mud: { name: "Marsh", walkable: true, buildable: false, speed: 0.72 },
  shallows: { name: "Shallows", walkable: true, buildable: false, speed: 0.65 },
  water: { name: "Deep water", walkable: false, buildable: false, speed: 0 },
  rock: { name: "Cliffs", walkable: false, buildable: false, speed: 0 },
  bridge: { name: "Bridge", walkable: true, buildable: false, speed: 1 }
};

// ../../../../tmp/orcs-team-matches-c1f2264/source/core/simulation.ts
var runtimes = /* @__PURE__ */ new WeakMap();
function runtime(s) {
  let r = runtimes.get(s);
  if (!r) {
    r = { fog: 0, ai: 0, aiTurns: 0, hits: [], routes: /* @__PURE__ */ new Map(), abilities: /* @__PURE__ */ new Map(), returning: /* @__PURE__ */ new Set(), queuedGather: /* @__PURE__ */ new Set(), aiWave: s.players.map(() => 0), initialScoutDispatched: s.players.map(() => false), expansionScout: s.players.map(() => null), expansionScoutDispatched: s.players.map(() => false), knownEnemyBuildings: s.players.map(() => /* @__PURE__ */ new Map()), enemyStartCleared: s.players.map(() => false), clearedEnemyStarts: s.players.map(() => /* @__PURE__ */ new Set()), searched: s.players.map(() => /* @__PURE__ */ new Set()) };
    runtimes.set(s, r);
  }
  return r;
}
function captureRuntime(s) {
  const r = runtime(s);
  return { fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits: r.hits.map((h) => ({ source: h.source.id, target: h.target.id, amount: h.amount, event: s.events.indexOf(h.event) })), routes: [...r.routes].map(([id2, value]) => [id2, { ...value }]), abilities: [...r.abilities], returning: [...r.returning], queuedGather: [...r.queuedGather], aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => [...memory].map(([id2, p]) => [id2, { ...p }])), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => [...players]), searched: r.searched.map((tiles) => [...tiles]) };
}
function restoreRuntime(s, r) {
  const entities = new Map(s.entities.map((e) => [e.id, e]));
  const hits = r.hits.map((h) => {
    const source = entities.get(h.source), target = entities.get(h.target), event = s.events[h.event];
    if (!source || !target || !event) throw new Error("Save runtime has an invalid hit reference.");
    return { source, target, amount: h.amount, event };
  });
  runtimes.set(s, { fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits, routes: new Map(r.routes.map(([id2, value]) => [id2, { ...value }])), abilities: new Map(r.abilities), returning: new Set(r.returning), queuedGather: new Set(r.queuedGather), aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => new Map(memory.map(([id2, p]) => [id2, { ...p }]))), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => new Set(players)), searched: r.searched.map((tiles) => new Set(tiles)) });
}
var MAX_ORDER_QUEUE = 32;

// ../../../../tmp/orcs-team-matches-c1f2264/source/core/saves.ts
var SAVE_VERSION = 2;
var MAX_SAVE_BYTES = 16 * 1024 * 1024;
var MAX_ID = 2147483647;
var MAX_VALUE = 1e12;
var MAX_PLAYERS = 8;
var MAX_ENTITIES = 8192;
var MAX_RESOURCES = 8192;
var STATE_FIELDS = ["controllers", "mapSize", "mapVersion", "terrain", "starts", "draw", "tick", "corpses", "time", "seed", "width", "height", "entities", "resources", "players", "winner", "events", "explored", "visible", "nextId"];
var TEAM_FIELDS = ["teams", "incomeFactors", "populationLimits", "sharedVision", "eliminated", "winningTeam"];
var UNIT_ROLES = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var BUILDING_ROLES = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var RESOURCE_KINDS = ["wood", "ore", "crystal"];
function bad(path, detail) {
  throw new Error(`Invalid save at ${path}: ${detail}.`);
}
function object(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad(path, "expected an object");
  const record = value;
  for (const key of required) if (!Object.hasOwn(record, key)) bad(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record)) if (!required.includes(key) && !optional.includes(key)) bad(`${path}.${key}`, "unknown field");
  return record;
}
function number(value, path, min = 0, max = MAX_VALUE, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) bad(path, `expected ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function flag(value, path) {
  if (typeof value !== "boolean") bad(path, "expected a boolean");
  return value;
}
function choice(value, path, choices) {
  if (typeof value !== "string" || !choices.includes(value)) bad(path, "unknown value");
  return value;
}
function list(value, path, max, length) {
  if (!Array.isArray(value) || value.length > max || length !== void 0 && value.length !== length) bad(path, "invalid array length");
  return value;
}
function optionalNumber(record, key, path, min = 0, max = MAX_VALUE, integer = false) {
  if (record[key] !== void 0) number(record[key], `${path}.${key}`, min, max, integer);
}
function optionalFlag(record, key, path) {
  if (record[key] !== void 0) flag(record[key], `${path}.${key}`);
}
function id(value, path, c) {
  return number(value, path, 1, c.nextId - 1, true);
}
function point(value, path, c) {
  const p = object(value, path, ["x", "y"]);
  number(p.x, `${path}.x`, 0, c.width);
  number(p.y, `${path}.y`, 0, c.height);
}
function coordinates(value, path, c) {
  number(value.x, `${path}.x`, 0, c.width);
  number(value.y, `${path}.y`, 0, c.height);
}
function order(value, path, c) {
  const o = object(value, path, ["type"], ["x", "y", "target"]);
  choice(o.type, `${path}.type`, ["idle", "hold", "move", "attackMove", "attack", "gather", "build"]);
  if (o.type === "move" || o.type === "attackMove") {
    object(value, path, ["type", "x", "y"]);
    coordinates(o, path, c);
  } else if (o.type === "attack" || o.type === "gather" || o.type === "build") {
    object(value, path, ["type", "target"]);
    id(o.target, `${path}.target`, c);
  } else object(value, path, ["type"]);
}
function uniqueIds(values, path, max) {
  const result = /* @__PURE__ */ new Set();
  values.forEach((v, i) => {
    const n = number(v, `${path}[${i}]`, 0, max, true);
    if (result.has(n)) bad(path, "duplicate value");
    result.add(n);
  });
  return result;
}
function fog(value, path, c) {
  return list(value, path, c.playerCount, c.playerCount).map((v, i) => uniqueIds(list(v, `${path}[${i}]`, c.cells), `${path}[${i}]`, c.cells - 1));
}
function validateEntity(value, path, c) {
  const e = object(value, path, ["id", "side", "kind", "role", "x", "y", "hp", "maxHp", "order", "cooldown", "progress", "queue", "trainProgress", "researchProgress", "facing", "animation", "animTime", "momentum", "illusion", "expires", "carried", "carriedKind", "path"], ["orderQueue", "research", "rally", "gateOpen", "lastAttacker", "abilityReadyAt", "entrenchedAt", "raised", "shield", "maxShield", "lastDamagedAt", "surgeUntil"]);
  const entityId = id(e.id, `${path}.id`, c);
  if (c.entityIds.has(entityId)) bad(`${path}.id`, "duplicate entity or resource id");
  c.entityIds.add(entityId);
  c.entities.set(entityId, e);
  number(e.side, `${path}.side`, 0, c.playerCount - 1, true);
  choice(e.kind, `${path}.kind`, ["unit", "building"]);
  choice(e.role, `${path}.role`, e.kind === "unit" ? UNIT_ROLES : BUILDING_ROLES);
  coordinates(e, path, c);
  const maxHp = number(e.maxHp, `${path}.maxHp`, Number.MIN_VALUE, 1e9);
  number(e.hp, `${path}.hp`, 0, maxHp);
  order(e.order, `${path}.order`, c);
  for (const key of ["cooldown", "animTime", "expires"]) number(e[key], `${path}.${key}`);
  for (const key of ["progress", "trainProgress"]) number(e[key], `${path}.${key}`, 0, 1);
  number(e.researchProgress, `${path}.researchProgress`, 0, 2);
  number(e.facing, `${path}.facing`, 0, 7, true);
  choice(e.animation, `${path}.animation`, ["idle", "walk", "attack", "death"]);
  number(e.momentum, `${path}.momentum`, 0, 1);
  flag(e.illusion, `${path}.illusion`);
  number(e.carried, `${path}.carried`, 0, 18);
  choice(e.carriedKind, `${path}.carriedKind`, RESOURCE_KINDS);
  const queue = list(e.queue, `${path}.queue`, 5);
  queue.forEach((role, i) => {
    choice(role, `${path}.queue[${i}]`, UNIT_ROLES);
    if (e.kind !== "building" || e.role !== "hq" && e.role !== "barracks" || e.role === "hq" && role !== "worker" || e.role === "barracks" && role === "worker") bad(`${path}.queue`, "invalid producer or recruit");
  });
  list(e.path, `${path}.path`, c.cells * 16).forEach((p, i) => point(p, `${path}.path[${i}]`, c));
  if (e.orderQueue !== void 0) {
    if (e.kind !== "unit" || e.illusion) bad(`${path}.orderQueue`, "only real units can queue orders");
    list(e.orderQueue, `${path}.orderQueue`, MAX_ORDER_QUEUE).forEach((o, i) => order(o, `${path}.orderQueue[${i}]`, c));
  }
  if (e.research !== void 0) {
    choice(e.research, `${path}.research`, Object.keys(UPGRADES));
    if (e.kind !== "building" || UPGRADES[e.research].building !== e.role) bad(`${path}.research`, "wrong research building");
  }
  if (e.rally !== void 0) point(e.rally, `${path}.rally`, c);
  for (const key of ["gateOpen", "raised"]) optionalFlag(e, key, path);
  if (e.lastAttacker !== void 0) id(e.lastAttacker, `${path}.lastAttacker`, c);
  for (const key of ["abilityReadyAt", "entrenchedAt", "lastDamagedAt", "surgeUntil", "shield", "maxShield"]) optionalNumber(e, key, path);
  if (e.shield !== void 0 && e.shield > (e.maxShield ?? 0)) bad(`${path}.shield`, "shield exceeds capacity");
}
function playersArray(value, path, c, check) {
  list(value, path, c.playerCount, c.playerCount).forEach((v, i) => check(v, `${path}[${i}]`));
}
function entries(value, path, max, c, check) {
  const seen = /* @__PURE__ */ new Set();
  list(value, path, max).forEach((entry, i) => {
    const p = `${path}[${i}]`, parts = list(entry, p, 2, 2), key = id(parts[0], `${p}[0]`, c);
    if (seen.has(key)) bad(path, "duplicate map key");
    seen.add(key);
    check(parts[1], `${p}[1]`);
  });
}
function validateRuntime(value, c, version) {
  const fields = ["fog", "ai", "aiTurns", "hits", "routes", "abilities", "returning", "queuedGather", "aiWave", "initialScoutDispatched", "expansionScout", "expansionScoutDispatched", "knownEnemyBuildings", "enemyStartCleared", "searched"];
  const path = "runtime", r = object(value, path, version === 1 ? fields : [...fields, "clearedEnemyStarts"]);
  number(r.fog, "runtime.fog", -0.25, 0.2);
  number(r.ai, "runtime.ai", -0.25, 1);
  number(r.aiTurns, "runtime.aiTurns", 0, MAX_VALUE, true);
  list(r.hits, "runtime.hits", c.maxEntities).forEach((v, i) => {
    const p = `runtime.hits[${i}]`, h = object(v, p, ["source", "target", "amount", "event"]);
    for (const key of ["source", "target"]) if (!c.entityIds.has(id(h[key], `${p}.${key}`, c))) bad(`${p}.${key}`, "missing hit entity");
    number(h.amount, `${p}.amount`, 0, 1e9);
    number(h.event, `${p}.event`, 0, c.eventCount - 1, true);
  });
  entries(r.routes, "runtime.routes", MAX_ID, c, (v, p) => {
    const route2 = object(v, p, ["key", "at"]);
    if (typeof route2.key !== "string" || route2.key.length > 128) bad(`${p}.key`, "invalid route key");
    number(route2.at, `${p}.at`, 0, c.time);
  });
  entries(r.abilities, "runtime.abilities", MAX_ID, c, (v, p) => number(v, p));
  uniqueIds(list(r.returning, "runtime.returning", MAX_ID), "runtime.returning", c.nextId - 1).forEach((n) => {
    if (n === 0) bad("runtime.returning", "invalid entity id");
  });
  uniqueIds(list(r.queuedGather, "runtime.queuedGather", c.maxEntities), "runtime.queuedGather", c.nextId - 1).forEach((n) => {
    const e = c.entities.get(n);
    if (!e || e.hp <= 0 || e.kind !== "unit" || e.role !== "worker" || e.order.type !== "gather") bad("runtime.queuedGather", "expected a living worker gathering");
  });
  playersArray(r.aiWave, "runtime.aiWave", c, (v, p) => number(v, p, 0, c.time));
  for (const key of ["initialScoutDispatched", "expansionScoutDispatched", "enemyStartCleared"]) playersArray(r[key], `runtime.${key}`, c, flag);
  playersArray(r.expansionScout, "runtime.expansionScout", c, (v, p) => {
    if (v !== null) id(v, p, c);
  });
  playersArray(r.knownEnemyBuildings, "runtime.knownEnemyBuildings", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
    const b = object(value2, q, ["x", "y", "role"]);
    coordinates(b, q, c);
    choice(b.role, `${q}.role`, BUILDING_ROLES);
  }));
  playersArray(r.searched, "runtime.searched", c, (v, p) => uniqueIds(list(v, p, c.cells), p, c.cells - 1));
  if (version === 2) playersArray(r.clearedEnemyStarts, "runtime.clearedEnemyStarts", c, (v, p) => uniqueIds(list(v, p, c.playerCount), p, c.playerCount - 1));
}
function validate(envelope, version) {
  const save = object(envelope, "save", ["format", "version", "state", "runtime"]);
  if (save.format !== "orcs-vs-fairies-save") bad("format", "unknown save format");
  if (save.version !== version) bad("version", `unsupported version ${String(save.version)}`);
  const s = object(save.state, "state", version === 1 ? STATE_FIELDS : [...STATE_FIELDS, ...TEAM_FIELDS]);
  const playerCount = list(s.players, "state.players", version === 1 ? 2 : MAX_PLAYERS, version === 1 ? 2 : void 0).length;
  if (playerCount === 0) bad("state.players", "expected between 1 and 8 players");
  const width = number(s.width, "state.width", 8, 256, true), height = number(s.height, "state.height", 8, 256, true), nextId = number(s.nextId, "state.nextId", 1, MAX_ID, true);
  const c = { width, height, cells: width * height, time: number(s.time, "state.time"), nextId, playerCount, maxEntities: version === 1 ? 4096 : MAX_ENTITIES, entityIds: /* @__PURE__ */ new Set(), entities: /* @__PURE__ */ new Map(), resourceIds: /* @__PURE__ */ new Set(), eventCount: 0 };
  playersArray(s.controllers, "state.controllers", c, (v, p) => choice(v, p, ["human", "ai", "external"]));
  choice(s.mapSize, "state.mapSize", ["small", "medium", "large", "huge"]);
  number(s.mapVersion, "state.mapVersion", 1, MAP_VERSION, true);
  list(s.terrain, "state.terrain", c.cells, c.cells).forEach((v, i) => choice(v, `state.terrain[${i}]`, Object.keys(TERRAIN)));
  playersArray(s.starts, "state.starts", c, (v, p) => point(v, p, c));
  flag(s.draw, "state.draw");
  number(s.tick, "state.tick", 0, MAX_VALUE, true);
  number(s.time, "state.time");
  number(s.seed, "state.seed", 0, 4294967295, true);
  if (version === 2) {
    playersArray(s.teams, "state.teams", c, (v, p) => number(v, p, 0, MAX_PLAYERS - 1, true));
    playersArray(s.incomeFactors, "state.incomeFactors", c, (v, p) => number(v, p, 0, 10));
    playersArray(s.populationLimits, "state.populationLimits", c, (v, p) => number(v, p, 1, 500, true));
    playersArray(s.eliminated, "state.eliminated", c, flag);
    flag(s.sharedVision, "state.sharedVision");
  }
  list(s.entities, "state.entities", c.maxEntities).forEach((v, i) => validateEntity(v, `state.entities[${i}]`, c));
  list(s.resources, "state.resources", MAX_RESOURCES).forEach((v, i) => {
    const p = `state.resources[${i}]`, r = object(v, p, ["id", "x", "y", "kind", "amount", "maxAmount"]), key = id(r.id, `${p}.id`, c);
    if (c.entityIds.has(key) || c.resourceIds.has(key)) bad(`${p}.id`, "duplicate entity or resource id");
    c.resourceIds.add(key);
    coordinates(r, p, c);
    choice(r.kind, `${p}.kind`, RESOURCE_KINDS);
    const max = number(r.maxAmount, `${p}.maxAmount`, 0, 1e9);
    number(r.amount, `${p}.amount`, 0, max);
  });
  playersArray(s.players, "state.players", c, (v, p) => {
    const player = object(v, p, ["faction", "wood", "ore", "crystal", "population", "cap", "upgrades"]);
    choice(player.faction, `${p}.faction`, Object.keys(FACTIONS));
    for (const key of RESOURCE_KINDS) number(player[key], `${p}.${key}`);
    number(player.population, `${p}.population`, 0, c.maxEntities, true);
    number(player.cap, `${p}.cap`, 0, version === 1 ? 100 : 500, true);
    const upgrades = list(player.upgrades, `${p}.upgrades`, Object.keys(UPGRADES).length);
    upgrades.forEach((u, i) => choice(u, `${p}.upgrades[${i}]`, Object.keys(UPGRADES)));
    if (new Set(upgrades).size !== upgrades.length) bad(`${p}.upgrades`, "duplicate upgrade");
  });
  const researching = Array.from({ length: playerCount }, () => /* @__PURE__ */ new Set()), players = s.players;
  for (const e of c.entities.values()) if (e.hp > 0 && e.research !== void 0) {
    const side = e.side, upgrade = e.research;
    if (players[side].upgrades.includes(upgrade) || researching[side].has(upgrade)) bad("state.entities.research", "upgrade is already complete or being researched");
    researching[side].add(upgrade);
  }
  if (s.winner !== null) number(s.winner, "state.winner", 0, playerCount - 1, true);
  if (s.draw && s.winner !== null) bad("state.winner", "draw cannot have a winner");
  if (version === 2) {
    if (s.winningTeam !== null) {
      number(s.winningTeam, "state.winningTeam", 0, MAX_PLAYERS - 1, true);
      if (!s.teams.includes(s.winningTeam)) bad("state.winningTeam", "team has no player");
    }
    if (s.winner === null !== (s.winningTeam === null) || s.winner !== null && s.teams[s.winner] !== s.winningTeam) bad("state.winner", "winner must belong to the winning team");
    if (s.draw && s.winningTeam !== null) bad("state.winningTeam", "draw cannot have a winning team");
  }
  list(s.corpses, "state.corpses", c.maxEntities * 2).forEach((v, i) => {
    const p = `state.corpses[${i}]`, corpse = object(v, p, ["id", "x", "y", "expires"]);
    id(corpse.id, `${p}.id`, c);
    coordinates(corpse, p, c);
    number(corpse.expires, `${p}.expires`);
  });
  const events = list(s.events, "state.events", c.maxEntities * 4);
  c.eventCount = events.length;
  events.forEach((v, i) => {
    const p = `state.events[${i}]`, event = object(v, p, ["type", "x", "y", "side"], ["text", "target", "source", "amount", "resource"]);
    choice(event.type, `${p}.type`, ["attack", "death", "build", "train", "gather", "message", "ability", "research"]);
    coordinates(event, p, c);
    number(event.side, `${p}.side`, 0, playerCount - 1, true);
    for (const key of ["source", "target"]) if (event[key] !== void 0) id(event[key], `${p}.${key}`, c);
    optionalNumber(event, "amount", p);
    if (event.resource !== void 0) choice(event.resource, `${p}.resource`, RESOURCE_KINDS);
    if (event.text !== void 0 && (typeof event.text !== "string" || event.text.length > 4096)) bad(`${p}.text`, "invalid message text");
  });
  const explored = fog(s.explored, "state.explored", c), visible = fog(s.visible, "state.visible", c);
  visible.forEach((tiles, side) => {
    for (const tile of tiles) if (!explored[side].has(tile)) bad(`state.visible[${side}]`, "visible tiles must be explored");
  });
  validateRuntime(save.runtime, c, version);
}
function validateCurrent(envelope) {
  validate(envelope, SAVE_VERSION);
}
function migrateLegacy(envelope) {
  validate(envelope, 1);
  const state = envelope.state, entities = state.entities;
  Object.assign(state, { teams: [0, 1], incomeFactors: [1, 1], populationLimits: [100, 100], sharedVision: true, eliminated: [0, 1].map((side) => !entities.some((e) => e.side === side && e.kind === "building" && e.role === "hq" && e.hp > 0 && e.progress === 1)), winningTeam: state.winner });
  const runtime2 = envelope.runtime, cleared = runtime2.enemyStartCleared;
  runtime2.clearedEnemyStarts = cleared.map((value, side) => value ? [1 - side] : []);
  envelope.version = SAVE_VERSION;
}
function copyJson(value) {
  let nodes = 0, bytes = 0;
  const parents = /* @__PURE__ */ new Set();
  function copy(v, path, depth) {
    if (++nodes > 2e6 || depth > 32) bad(path, "save is too large or deeply nested");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) bad(path, "numbers must be finite");
      return v;
    }
    if (typeof v === "string") {
      bytes += v.length * 2;
      if (bytes > MAX_SAVE_BYTES) bad(path, "save exceeds size limit");
      return v;
    }
    if (!v || typeof v !== "object") bad(path, "expected JSON data");
    if (parents.has(v)) bad(path, "cyclic reference");
    parents.add(v);
    let result;
    if (Array.isArray(v)) {
      if (v.length > 1e5) bad(path, "array exceeds size limit");
      const array = [];
      for (let i = 0; i < v.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
        if (!descriptor || !("value" in descriptor)) bad(path, "array accessors and gaps are forbidden");
        array.push(copy(descriptor.value, `${path}[${i}]`, depth + 1));
      }
      result = array;
    } else {
      const prototype = Object.getPrototypeOf(v);
      if (prototype !== Object.prototype && prototype !== null) bad(path, "expected a plain object");
      const keys = Object.keys(v);
      if (keys.length > 128 || Object.getOwnPropertySymbols(v).length) bad(path, "invalid object properties");
      const record = {};
      for (const key of keys) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") bad(path, "unsafe property name");
        const descriptor = Object.getOwnPropertyDescriptor(v, key);
        if (!("value" in descriptor)) bad(path, "accessors are forbidden");
        if (descriptor.value !== void 0) record[key] = copy(descriptor.value, `${path}.${key}`, depth + 1);
      }
      result = record;
    }
    parents.delete(v);
    return result;
  }
  return copy(value, "save", 0);
}
function checkSize(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_SAVE_BYTES) bad("save", "save exceeds size limit");
}
function saveGame(state) {
  const envelope = copyJson({ format: "orcs-vs-fairies-save", version: SAVE_VERSION, state: { ...state, explored: state.explored.map((set) => [...set]), visible: state.visible.map((set) => [...set]) }, runtime: captureRuntime(state) });
  checkSize(envelope);
  validateCurrent(envelope);
  return envelope;
}
function loadGame(input) {
  let source = input;
  if (typeof input === "string") {
    if (input.length > MAX_SAVE_BYTES || new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) bad("save", "save exceeds size limit");
    try {
      source = JSON.parse(input);
    } catch {
      bad("save", "invalid JSON");
    }
  }
  const envelope = copyJson(source);
  checkSize(envelope);
  const record = object(envelope, "save", ["format", "version", "state", "runtime"]);
  if (record.version === 1) migrateLegacy(record);
  validateCurrent(envelope);
  const state = { ...envelope.state, explored: envelope.state.explored.map((values) => new Set(values)), visible: envelope.state.visible.map((values) => new Set(values)) };
  restoreRuntime(state, envelope.runtime);
  return state;
}
export {
  loadGame,
  saveGame
};
