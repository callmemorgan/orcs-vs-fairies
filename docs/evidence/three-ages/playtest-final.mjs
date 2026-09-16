// scripts/progression/playtest.ts
import { mkdirSync, writeFileSync } from "node:fs";

// src/core/content.ts
var ECONOMY = { harvestPerSecond: 2.28 };
var unit = (id, name, role, wood, ore, hp, damage2, armor, range, speed, cooldown, trainTime, ability, description) => ({ id, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage: damage2, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building = (id, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
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
var FACTIONS = Object.fromEntries(Object.entries(BASE_FACTIONS).map(([id, base]) => {
  const faction2 = id, prefix = base.units.worker.id.split("-")[0], names = expansionNames[faction2];
  return [id, { ...base, buildings: {
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

// src/core/progression.ts
var AGE_NAMES = { 1: "Settlement Age", 2: "Town Age", 3: "Citadel Age" };
function playerAge(player) {
  return player.upgrades.includes("citadel-age") ? 3 : player.upgrades.includes("town-age") ? 2 : 1;
}
function researchRequirement(s2, side, id) {
  const player = s2.players[side], def = UPGRADES[id];
  if (player.upgrades.includes(id)) return "Already researched";
  if (s2.entities.some((e) => e.side === side && e.hp > 0 && e.research === id)) return "Already researching";
  if (playerAge(player) < (def.age ?? 1)) return `Requires ${AGE_NAMES[def.age]}`;
  const missing = def.requires?.find((required) => !player.upgrades.includes(required));
  if (missing) return `Requires ${UPGRADES[missing].name}`;
  return void 0;
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
  bridge: { name: "Bridge", walkable: true, buildable: false, speed: 1 }
};
function seededRandom(seed2) {
  let value = seed2 >>> 0;
  return () => {
    value = value + 1831565813 >>> 0;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function terrainAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "rock";
  return map.terrain[Math.floor(y) * map.width + Math.floor(x)] ?? "grass";
}
function generateMap(seed2, size = "medium") {
  if (!Number.isSafeInteger(seed2) || seed2 < 0 || seed2 > 4294967295) throw new Error("Map seed must be an integer from 0 to 4294967295.");
  if (!(size in MAP_SIZES)) throw new Error("Map size must be small, medium, large or huge.");
  const width = MAP_SIZES[size], height = width, rng = seededRandom(seed2), terrain = Array(width * height).fill("grass");
  const base = size === "small" ? 7.5 : 8.5, starts = [{ x: base, y: base }, { x: width - base, y: height - base }];
  const map = { size, seed: seed2, width, height, terrain, starts, resources: [], version: MAP_VERSION };
  const mirror = (p) => ({ x: width - p.x, y: height - p.y });
  const set = (x, y, kind) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    terrain[y * width + x] = kind;
    terrain[(height - 1 - y) * width + (width - 1 - x)] = kind;
  };
  const disk = (cx, cy, rx, ry, kind) => {
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(height, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(width, Math.ceil(cx + rx)); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) set(x, y, kind);
  };
  for (let i = 0; i < Math.round(width * 0.42); i++) {
    const x = 3 + rng() * (width - 6), y = 3 + rng() * (height - 6), roll = rng();
    disk(x, y, 1.5 + rng() * 3.5, 1.5 + rng() * 3.5, roll < 0.42 ? "water" : roll < 0.7 ? "mud" : "rock");
  }
  const before = [...terrain];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (before[y * width + x] === "water" && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height || before[(y + dy) * width + x + dx] !== "water")) set(x, y, "shallows");
  const carve = (a, b, radius2 = 1.65) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.ceil(length * 3);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0, cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
      for (let y = Math.max(0, Math.floor(cy - radius2)); y < Math.min(height, Math.ceil(cy + radius2)); y++) for (let x = Math.max(0, Math.floor(cx - radius2)); x < Math.min(width, Math.ceil(cx + radius2)); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= radius2) {
        const old = terrain[y * width + x];
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
    if (Math.hypot(p.x - q.x, p.y - q.y) < 2.2) return false;
    if (map.resources.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < 2.05 || Math.hypot(r.x - q.x, r.y - q.y) < 2.05)) return false;
    for (const point of [p, q]) map.resources.push({ ...point, kind, amount, maxAmount: amount });
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
      if (starts.some((a) => Math.hypot(a.x - q.x, a.y - q.y) < 7)) continue;
      if (addPair(q, kind, amount)) {
        let nearest, best = Infinity;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain[y * width + x] === "road" || terrain[y * width + x] === "bridge") {
          const d = Math.hypot(q.x - x - 0.5, q.y - y - 0.5);
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
    const camps2 = [{ x: Math.floor(width * 0.23) + 0.5, y: Math.floor(width * 0.58) + 0.5 }];
    if (size === "huge") camps2.push({ x: Math.floor(width * 0.18) + 0.5, y: Math.floor(width * 0.37) + 0.5 });
    for (const camp of camps2) {
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
  if (!validation.valid) throw new Error(`Invalid generated map ${size}/${seed2}: ${validation.issues.join("; ")}`);
  return map;
}
function validateMap(map) {
  const { width, height, starts, resources, terrain } = map, issues = [];
  if (terrain.length !== width * height) issues.push("Terrain dimensions do not match.");
  const free = (x, y) => x >= 0 && y >= 0 && x < width && y < height && TERRAIN[terrain[y * width + x] ?? "rock"].walkable && !resources.some((r) => r.amount > 0 && Math.hypot(r.x - x - 0.5, r.y - y - 0.5) < 0.7) && !starts.some((p) => Math.abs(p.x - x - 0.5) < 1.77 && Math.abs(p.y - y - 0.5) < 1.77);
  const origin = { x: Math.floor(starts[0].x), y: Math.floor(starts[0].y + 3) }, destination = { x: Math.floor(starts[1].x), y: Math.floor(starts[1].y - 3) };
  const seen = /* @__PURE__ */ new Set(), queue = [];
  if (free(origin.x, origin.y)) {
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
  const startsConnected = seen.has(destination.y * width + destination.x);
  if (!startsConnected) issues.push("Starting armies are disconnected.");
  let reachableResources = 0;
  for (const r of resources) {
    let reached = false;
    for (let y = Math.floor(r.y) - 1; y <= Math.floor(r.y) + 1; y++) for (let x = Math.floor(r.x) - 1; x <= Math.floor(r.x) + 1; x++) if (seen.has(y * width + x) && Math.hypot(x + 0.5 - r.x, y + 0.5 - r.y) <= 1.25) reached = true;
    if (reached) reachableResources++;
    else issues.push(`Unreachable ${r.kind} at ${r.x},${r.y}.`);
  }
  for (const start of starts) for (const kind of ["wood", "ore", "crystal"]) if (!resources.some((r) => r.kind === kind && Math.hypot(r.x - start.x, r.y - start.y) < 9)) issues.push(`Missing starting ${kind}.`);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain[y * width + x] !== terrain[(height - 1 - y) * width + width - 1 - x]) {
    issues.push("Terrain is not symmetric.");
    break;
  }
  for (const r of resources) if (!resources.some((q) => q.kind === r.kind && q.amount === r.amount && q.x === width - r.x && q.y === height - r.y)) issues.push("Resource pair is not symmetric.");
  return { valid: issues.length === 0, issues, reachableResources, totalResources: resources.length, reachableTiles: seen.size, startsConnected };
}

// src/core/navigation.ts
var distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var buildingRadius = (s2, e) => FACTIONS[s2.players[e.side].faction].buildings[e.role].size / 2 + 0.27;
function walkable(s2, x, y) {
  if (x < 0.35 || y < 0.35 || x > s2.width - 0.35 || y > s2.height - 0.35) return false;
  for (let ty = Math.floor(y - 0.27); ty <= Math.floor(y + 0.27); ty++) for (let tx = Math.floor(x - 0.27); tx <= Math.floor(x + 0.27); tx++) if (!TERRAIN[terrainAt(s2, tx + 0.5, ty + 0.5)].walkable) return false;
  for (const b of s2.entities) if (b.hp > 0 && b.kind === "building" && !b.gateOpen) {
    const r = buildingRadius(s2, b);
    if (Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) return false;
  }
  for (const r of s2.resources) if (r.amount > 0 && Math.hypot(r.x - x, r.y - y) < 0.7) return false;
  return true;
}
function segmentWalkable(s2, a, b) {
  if (!walkable(s2, a.x, a.y) || !walkable(s2, b.x, b.y)) return false;
  const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
  for (let y = Math.floor(Math.min(a.y, b.y) - 0.27); y <= Math.floor(Math.max(a.y, b.y) + 0.27); y++) for (let x = Math.floor(Math.min(a.x, b.x) - 0.27); x <= Math.floor(Math.max(a.x, b.x) + 0.27); x++) {
    if (TERRAIN[terrainAt(s2, x + 0.5, y + 0.5)].walkable) continue;
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
  for (const r of s2.resources) {
    if (r.amount <= 0) continue;
    const t = lengthSquared ? clamp(((r.x - a.x) * dx + (r.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
    if (Math.hypot(a.x + t * dx - r.x, a.y + t * dy - r.y) < 0.7) return false;
  }
  for (const obstacle of s2.entities) {
    if (obstacle.hp <= 0 || obstacle.kind !== "building" || obstacle.gateOpen) continue;
    const r = buildingRadius(s2, obstacle);
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
function openDestination(s2, to, from) {
  if (walkable(s2, to.x, to.y)) return to;
  const angle = Math.atan2(from.y - to.y, from.x - to.x);
  for (let r = 0.25; r <= 6; r += 0.25) {
    const candidates = [];
    for (let i = 0; i < 32; i++) {
      const a = angle + i * Math.PI / 16, p = { x: to.x + Math.cos(a) * r, y: to.y + Math.sin(a) * r };
      if (walkable(s2, p.x, p.y)) candidates.push(p);
    }
    if (candidates.length) return candidates.sort((a, b) => distance(from, a) - distance(from, b))[0];
  }
  return void 0;
}
var grids = /* @__PURE__ */ new WeakMap();
function gridFor(s2, CELL) {
  const buildings2 = s2.entities.filter((e) => e.hp > 0 && e.kind === "building" && !e.gateOpen);
  const resources = s2.resources.filter((r) => r.amount > 0);
  const signature = `${s2.width},${s2.height};${buildings2.map((b) => `${b.id},${b.x},${b.y},${buildingRadius(s2, b)}`).join(";")}|${resources.map((r) => `${r.id},${r.x},${r.y}`).join(";")}`;
  let caches = grids.get(s2);
  if (!caches) {
    caches = /* @__PURE__ */ new Map();
    grids.set(s2, caches);
  }
  const old = caches.get(CELL);
  if (old?.signature === signature && old.terrain === s2.terrain) return old;
  const width = Math.round(s2.width / CELL), height = Math.round(s2.height / CELL), blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if ((x + 0.5) * CELL < 0.35 || (y + 0.5) * CELL < 0.35 || (x + 0.5) * CELL > s2.width - 0.35 || (y + 0.5) * CELL > s2.height - 0.35) blocked[y * width + x] = 1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + 0.5) * CELL, py = (y + 0.5) * CELL;
    for (let ty = Math.floor(py - 0.27); ty <= Math.floor(py + 0.27); ty++) for (let tx = Math.floor(px - 0.27); tx <= Math.floor(px + 0.27); tx++) if (!TERRAIN[terrainAt(s2, tx + 0.5, ty + 0.5)].walkable) blocked[y * width + x] = 1;
  }
  for (const b of [...buildings2, ...resources]) {
    const r = "role" in b ? buildingRadius(s2, b) : 0.7;
    for (let y = Math.max(0, Math.floor((b.y - r) / CELL)); y < Math.min(height, Math.ceil((b.y + r) / CELL)); y++) for (let x = Math.max(0, Math.floor((b.x - r) / CELL)); x < Math.min(width, Math.ceil((b.x + r) / CELL)); x++) {
      const dx = Math.abs((x + 0.5) * CELL - b.x), dy = Math.abs((y + 0.5) * CELL - b.y);
      if ("role" in b ? dx < r && dy < r : Math.hypot(dx, dy) < r) blocked[y * width + x] = 1;
    }
  }
  const grid = { terrain: s2.terrain, signature, width, height, blocked, edges: /* @__PURE__ */ new Map() };
  caches.set(CELL, grid);
  return grid;
}
function route(s2, from, to, reach, side) {
  const coarse = routeOnGrid(s2, from, to, reach, 0.5, side);
  return coarse.length ? coarse : routeOnGrid(s2, from, to, reach, 0.25, side);
}
function routeOnGrid(s2, from, to, reach, CELL, side) {
  const grid = gridFor(s2, CELL), { width, height, blocked } = grid;
  const point = (k) => ({ x: (k % width + 0.5) * CELL, y: (Math.floor(k / width) + 0.5) * CELL });
  const sx = Math.floor(from.x / CELL), sy = Math.floor(from.y / CELL), start = sy * width + sx;
  const starts = [];
  if (!blocked[start] && segmentWalkable(s2, from, point(start))) starts.push(start);
  else for (let ring = 1; ring <= 4 && !starts.length; ring++) for (let y = Math.max(0, sy - ring); y <= Math.min(height - 1, sy + ring); y++) for (let x = Math.max(0, sx - ring); x <= Math.min(width - 1, sx + ring); x++) {
    const k = y * width + x;
    if (!blocked[k] && segmentWalkable(s2, from, point(k))) starts.push(k);
  }
  if (!starts.length) return [];
  const goals = /* @__PURE__ */ new Set(), rr = Math.max(reach + 0.2, 0.4);
  for (let y = Math.max(0, Math.floor((to.y - rr) / CELL)); y < Math.min(height, Math.ceil((to.y + rr) / CELL)); y++) for (let x = Math.max(0, Math.floor((to.x - rr) / CELL)); x < Math.min(width, Math.ceil((to.x + rr) / CELL)); x++) {
    const k = y * width + x;
    if (!blocked[k] && distance(point(k), to) <= rr) goals.add(k);
  }
  if (!goals.size) return [];
  const score = new Float64Array(width * height).fill(Infinity), parent = new Int32Array(width * height).fill(-1), closed = new Uint8Array(width * height), open = [];
  const push = (key, value) => {
    let i = open.length;
    open.push({ key, score: value });
    while (i > 0) {
      const p = i - 1 >> 1;
      if (open[p].score <= value) break;
      open[i] = open[p];
      i = p;
    }
    open[i] = { key, score: value };
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
  const heuristic = (k) => Math.max(0, distance(point(k), to) - rr) / 1.15;
  for (const k of starts) {
    score[k] = distance(from, point(k));
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
        clear = segmentWalkable(s2, point(k), point(n));
        grid.edges.set(edge, clear);
      }
      if (!clear) continue;
      const p = point(n), terrain = terrainAt(s2, p.x, p.y), speed = (side !== void 0 ? FACTIONS[s2.players[side].faction].terrainSpeeds?.[terrain] : void 0) ?? TERRAIN[terrain].speed;
      const value = score[k] + (dx && dy ? Math.SQRT2 : 1) * CELL / Math.max(0.1, speed);
      if (value < score[n]) {
        score[n] = value;
        parent[n] = k;
        push(n, value + heuristic(n));
      }
    }
  }
  if (end === -1) return [];
  const result2 = [];
  for (let k = end; k !== -1; k = parent[k]) if (parent[k] !== -1 || distance(from, point(k)) > 0.08) result2.push(point(k));
  return result2.reverse();
}

// src/core/simulation.ts
var distance2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var clamp2 = (n, a, b) => Math.max(a, Math.min(b, n));
var runtimes = /* @__PURE__ */ new WeakMap();
function runtime(s2) {
  let r = runtimes.get(s2);
  if (!r) {
    r = { fog: 0, ai: 0, aiTurns: 0, hits: [], routes: /* @__PURE__ */ new Map(), abilities: /* @__PURE__ */ new Map(), returning: /* @__PURE__ */ new Set(), aiWave: [0, 0], initialScoutDispatched: [false, false], expansionScout: [null, null], expansionScoutDispatched: [false, false], knownEnemyBuildings: [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()], enemyStartCleared: [false, false], searched: [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()] };
    runtimes.set(s2, r);
  }
  return r;
}
var alive = (e) => e.hp > 0;
function unitDef(s2, e) {
  return FACTIONS[s2.players[e.side].faction].units[e.role];
}
function buildingDef(s2, e) {
  return FACTIONS[s2.players[e.side].faction].buildings[e.role];
}
function radius(s2, e) {
  return e.kind === "building" ? buildingDef(s2, e).size / 2 : 0.3;
}
function near(s2, a, b, range) {
  return distance2(a, b) <= range + ("kind" in b && b.kind === "building" ? radius(s2, b) : 0);
}
function emit(s2, type, e, target, text) {
  const event = { type, x: e.x, y: e.y, side: e.side, target, text, source: e.id };
  s2.events.push(event);
  return event;
}
function spawn(s2, side, kind, role, x, y, progress = 1) {
  const f = FACTIONS[s2.players[side].faction];
  const def = kind === "unit" ? f.units[role] : f.buildings[role];
  const e = { id: s2.nextId++, side, kind, role, x, y, hp: progress === 1 ? def.hp : Math.max(1, def.hp * 0.1), maxHp: def.hp, order: { type: "idle" }, cooldown: 0, progress, queue: [], trainProgress: 0, researchProgress: 0, facing: 2, animation: "idle", animTime: 0, momentum: 0, illusion: false, expires: 0, carried: 0, carriedKind: "wood", path: [] };
  if (kind === "unit" && def.shield) {
    e.maxShield = def.shield;
    e.shield = e.maxShield;
  }
  s2.entities.push(e);
  return e;
}
function createGame(faction2, seed2 = 1977, opponent2 = faction2 === "orcs" ? "fairies" : "orcs", options = {}) {
  const map = generateMap(seed2, options.mapSize ?? "medium");
  const s2 = { controllers: options.controllers ?? ["human", "ai"], mapSize: map.size, mapVersion: map.version, terrain: map.terrain, starts: map.starts, draw: false, tick: 0, corpses: [], time: 0, seed: seed2, width: map.width, height: map.height, entities: [], resources: [], players: [{ faction: faction2, wood: 420, ore: 220, crystal: 0, population: 0, cap: 12, upgrades: [] }, { faction: opponent2, wood: 420, ore: 220, crystal: 0, population: 0, cap: 12, upgrades: [] }], winner: null, events: [], explored: [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()], visible: [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()], nextId: 1 };
  for (const side of [0, 1]) {
    const { x, y } = s2.starts[side], dir = side === 0 ? 1 : -1;
    spawn(s2, side, "building", "hq", x, y);
    for (let i = 0; i < 5; i++) spawn(s2, side, "unit", "worker", x + (-2 + i * 0.85) * dir, y + 3 * dir);
    spawn(s2, side, "unit", "melee", x + 3 * dir, y + dir);
  }
  for (const resource of map.resources) s2.resources.push({ ...resource, id: s2.nextId++ });
  refreshVisibility(s2);
  updatePopulation(s2);
  return s2;
}
function isGameOver(s2) {
  return s2.winner !== null || s2.draw;
}
function isVisible(s2, side, x, y) {
  return x >= 0 && y >= 0 && x < s2.width && y < s2.height && s2.visible[side].has(Math.floor(y) * s2.width + Math.floor(x));
}
function refreshVisibility(s2) {
  for (const side of [0, 1]) {
    s2.visible[side].clear();
    for (const e of s2.entities) {
      if (e.side !== side || !alive(e)) continue;
      const sight = e.kind === "unit" ? unitDef(s2, e).sight : buildingDef(s2, e).sight;
      for (let y = Math.max(0, Math.floor(e.y - sight)); y <= Math.min(s2.height - 1, Math.ceil(e.y + sight)); y++) for (let x = Math.max(0, Math.floor(e.x - sight)); x <= Math.min(s2.width - 1, Math.ceil(e.x + sight)); x++) if (Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y) <= sight) {
        const key = y * s2.width + x;
        s2.visible[side].add(key);
        s2.explored[side].add(key);
      }
    }
  }
}
function updatePopulation(s2) {
  for (const side of [0, 1]) {
    const es = s2.entities.filter((e) => e.side === side && alive(e));
    s2.players[side].population = es.filter((e) => e.kind === "unit" && !e.illusion).length;
    s2.players[side].cap = Math.min(100, es.filter((e) => e.kind === "building" && e.progress === 1).reduce((v, e) => v + (e.role === "hq" ? 12 : e.role === "depot" ? 10 : 0), 0));
  }
}
function reserved(s2, side) {
  return s2.entities.filter((e) => e.side === side && alive(e)).reduce((v, e) => v + e.queue.length, 0);
}
function footprintOverlap(e, x, y, size) {
  return Math.abs(e.x - x) < size / 2 + 0.35 && Math.abs(e.y - y) < size / 2 + 0.35;
}
function shovePoint(s2, x, y, size) {
  for (let ring = size / 2 + 1; ring < size / 2 + 5; ring += 0.5) for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, px = x + Math.cos(a) * ring, py = y + Math.sin(a) * ring;
    if ((Math.abs(px - x) >= size / 2 + 0.27 || Math.abs(py - y) >= size / 2 + 0.27) && walkable(s2, px, py)) return { x: px, y: py };
  }
}
function rallyWalkable(s2, side, x, y) {
  const fogged = /* @__PURE__ */ new Set();
  for (const e of s2.entities) if (e.kind === "building" && alive(e) && e.side !== side && !isVisible(s2, side, e.x, e.y)) fogged.add(e);
  if (!fogged.size) return walkable(s2, x, y);
  const kept = s2.entities;
  s2.entities = kept.filter((e) => !fogged.has(e));
  try {
    return walkable(s2, x, y);
  } finally {
    s2.entities = kept;
  }
}
function refundCost(s2, side, role) {
  const cost = FACTIONS[s2.players[side].faction].units[role].cost, p = s2.players[side];
  p.wood += cost.wood;
  p.ore += cost.ore;
  p.crystal += cost.crystal;
}
function refundQueue(s2, e) {
  if (!e.queue.length) return;
  for (const role of e.queue) refundCost(s2, e.side, role);
  e.queue = [];
  e.trainProgress = 0;
}
function canPlace(s2, side, role, x, y) {
  const def = FACTIONS[s2.players[side].faction].buildings[role];
  if (!def || playerAge(s2.players[side]) < (role === "hq" ? 2 : def.age ?? 1) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = def.size / 2;
  if (x - r < 0.5 || y - r < 0.5 || x + r > s2.width - 0.5 || y + r > s2.height - 0.5) return false;
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) if (!isVisible(s2, side, x + dx, y + dy)) return false;
  for (let ty = Math.floor(y - r); ty < Math.ceil(y + r); ty++) for (let tx = Math.floor(x - r); tx < Math.ceil(x + r); tx++) if (!TERRAIN[terrainAt(s2, tx + 0.5, ty + 0.5)].buildable) return false;
  if (s2.entities.some((e) => alive(e) && e.kind === "building" && Math.abs(e.x - x) < radius(s2, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4) && Math.abs(e.y - y) < radius(s2, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4))) return false;
  if (s2.entities.some((e) => alive(e) && e.kind === "unit" && e.side !== side && footprintOverlap(e, x, y, def.size))) return false;
  if (s2.resources.some((e) => e.amount > 0 && Math.abs(e.x - x) < r + 0.8 && Math.abs(e.y - y) < r + 0.8)) return false;
  return true;
}
function assign(s2, e, order) {
  if (order.type !== "hold") e.entrenchedAt = void 0;
  e.order = order;
  e.path = [];
  runtime(s2).routes.delete(e.id);
  runtime(s2).returning.delete(e.id);
}
function issueCommand(s2, side, c) {
  if (isGameOver(s2)) return false;
  const p = s2.players[side], f = FACTIONS[p.faction];
  if (c.type === "toggleGate") {
    let changed = false;
    for (const gate of s2.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive(e) && e.role === "gate" && e.progress === 1)) {
      if (gate.gateOpen && s2.entities.some((e) => alive(e) && e.kind === "unit" && footprintOverlap(e, gate.x, gate.y, buildingDef(s2, gate).size))) continue;
      gate.gateOpen = !gate.gateOpen;
      changed = true;
    }
    return changed;
  }
  if (c.type === "setRally" || c.type === "clearRally") {
    const producers = s2.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive(e) && e.kind === "building" && (e.role === "hq" || e.role === "barracks"));
    if (!producers.length) return false;
    if (c.type === "setRally") {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x < 0.5 || c.y < 0.5 || c.x > s2.width - 0.5 || c.y > s2.height - 0.5) return false;
      if (!s2.explored[side].has(Math.floor(c.y) * s2.width + Math.floor(c.x))) return false;
      if (!rallyWalkable(s2, side, c.x, c.y)) return false;
    }
    for (const e of producers) {
      if (c.type === "clearRally") delete e.rally;
      else e.rally = { x: c.x, y: c.y };
    }
    return true;
  }
  if (c.type === "cancelTrain") {
    const e = s2.entities.find((e2) => e2.id === c.id && e2.side === side && alive(e2) && e2.kind === "building");
    if (!e || !Number.isInteger(c.index) || c.index < 0 || c.index >= e.queue.length) return false;
    refundCost(s2, side, e.queue[c.index]);
    e.queue.splice(c.index, 1);
    if (c.index === 0) e.trainProgress = 0;
    return true;
  }
  if (c.type === "train") {
    const e = s2.entities.find((e2) => e2.id === c.id && e2.side === side && alive(e2) && e2.kind === "building" && e2.progress === 1);
    const d = f.units[c.role];
    if (!e || !d || playerAge(p) < (d.age ?? 1) || (c.role === "worker" ? e.role !== "hq" : e.role !== "barracks") || e.queue.length >= 5 || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || p.population + reserved(s2, side) >= p.cap) return false;
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    e.queue.push(c.role);
    return true;
  }
  if (c.type === "research") {
    const e = s2.entities.find((e2) => e2.id === c.id && e2.side === side && alive(e2) && e2.kind === "building" && e2.progress === 1);
    const d = UPGRADES[c.upgrade];
    if (!e || !d || d.building !== e.role || e.research || researchRequirement(s2, side, c.upgrade) || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal) return false;
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    e.research = c.upgrade;
    e.researchProgress = 0;
    emit(s2, "research", e, void 0, `${d.name} started`);
    return true;
  }
  const units = s2.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive(e) && e.kind === "unit" && !e.illusion);
  if (!units.length) return false;
  if (c.type === "build") {
    const workers2 = units.filter((e) => e.role === "worker");
    const d = f.buildings[c.role];
    if (!workers2.length || !d || c.role === "hq" && playerAge(p) < 2 || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || !canPlace(s2, side, c.role, c.x, c.y)) return false;
    const overlapping = s2.entities.filter((e) => e.kind === "unit" && alive(e) && e.side === side && footprintOverlap(e, c.x, c.y, d.size));
    const shoves = [];
    for (const u of overlapping) {
      const dest = shovePoint(s2, c.x, c.y, d.size);
      if (!dest) return false;
      shoves.push({ e: u, ...dest });
    }
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    const b = spawn(s2, side, "building", c.role, c.x, c.y, 0);
    for (const shove of shoves) {
      shove.e.x = shove.x;
      shove.e.y = shove.y;
      shove.e.path = [];
    }
    for (const e of workers2) assign(s2, e, { type: "build", target: b.id });
    emit(s2, "build", b);
    return true;
  }
  if (c.type === "ability") {
    let success = false;
    for (const e of units) {
      if (useAbility(s2, e)) success = true;
    }
    return success;
  }
  if (c.type === "move" || c.type === "attackMove") {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return false;
    const width = Math.ceil(Math.sqrt(units.length)), dir = side === 0 ? 1 : -1;
    const destinations = units.map((e, i) => {
      const dx = units.length === 1 ? 0 : (i % width - (width - 1) / 2) * 0.8 * dir, dy = units.length === 1 ? 0 : (Math.floor(i / width) - (width - 1) / 2) * 0.8 * dir;
      return openDestination(s2, { x: clamp2(c.x + dx, 0.6, s2.width - 0.6), y: clamp2(c.y + dy, 0.6, s2.height - 0.6) }, e);
    });
    let moved = false;
    units.forEach((e, i) => {
      if (destinations[i]) {
        assign(s2, e, { type: c.type, ...destinations[i] });
        moved = true;
      }
    });
    return moved;
  }
  if (c.type === "stop" || c.type === "hold") {
    for (const e of units) assign(s2, e, { type: c.type === "hold" ? "hold" : "idle" });
    return true;
  }
  if (!("target" in c)) return false;
  const target = c.type === "gather" ? s2.resources.find((e) => e.id === c.target && e.amount > 0) : s2.entities.find((e) => e.id === c.target && alive(e));
  if (!target || !isVisible(s2, side, target.x, target.y)) return false;
  if (c.type === "attack") {
    if (!("side" in target) || target.side === side) return false;
    for (const e of units) assign(s2, e, { type: "attack", target: target.id });
    return true;
  }
  const workers = units.filter((e) => e.role === "worker");
  if (!workers.length) return false;
  if (c.type === "repair" && (!("side" in target) || target.side !== side || target.kind !== "building" || target.hp >= target.maxHp && target.progress >= 1)) return false;
  for (const e of workers) assign(s2, e, { type: c.type === "gather" ? "gather" : "build", target: target.id });
  return true;
}
function useAbility(s2, e) {
  if ((runtime(s2).abilities.get(e.id) ?? 0) > s2.time) return false;
  const ability = unitDef(s2, e).ability;
  if (!ability) return false;
  if (ability === "entrench") {
    if (e.entrenchedAt !== void 0) {
      e.entrenchedAt = void 0;
      assign(s2, e, { type: "idle" });
    } else {
      assign(s2, e, { type: "hold" });
      e.entrenchedAt = s2.time;
    }
  } else if (ability === "raise") {
    updatePopulation(s2);
    let count = 0;
    for (const corpse of [...s2.corpses].sort((a, b) => distance2(e, a) - distance2(e, b))) {
      if (count >= 2 || s2.players[e.side].population + reserved(s2, e.side) >= s2.players[e.side].cap) break;
      if (corpse.expires <= s2.time || distance2(e, corpse) > 6 || !isVisible(s2, e.side, corpse.x, corpse.y) || !walkable(s2, corpse.x, corpse.y)) continue;
      const raised = spawn(s2, e.side, "unit", "melee", corpse.x, corpse.y);
      raised.hp = raised.maxHp * 0.5;
      raised.raised = true;
      raised.expires = s2.time + 35;
      raised.order = { type: "attackMove", x: e.x, y: e.y };
      s2.corpses = s2.corpses.filter((c) => c.id !== corpse.id);
      count++;
      updatePopulation(s2);
    }
    if (!count) return false;
    runtime(s2).abilities.set(e.id, s2.time + 22);
  } else if (ability === "illusion") {
    let placed = 0;
    for (const offset of [-0.6, 0.6]) {
      const desired = { x: clamp2(e.x + offset, 0.5, s2.width - 0.5), y: clamp2(e.y - offset, 0.5, s2.height - 0.5) };
      const point = walkable(s2, desired.x, desired.y) ? desired : openDestination(s2, desired, e);
      if (!point) continue;
      const clone = spawn(s2, e.side, "unit", e.role, point.x, point.y);
      clone.illusion = true;
      clone.hp = clone.maxHp * 0.4;
      clone.maxHp = clone.hp;
      clone.expires = s2.time + 18;
      clone.order = { ...e.order };
      placed++;
    }
    if (!placed) return false;
    runtime(s2).abilities.set(e.id, s2.time + 35);
  } else if (ability === "surge") {
    let affected = false;
    for (const ally of s2.entities) if (ally.side === e.side && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      ally.surgeUntil = s2.time + 6;
      affected = true;
    }
    if (!affected) return false;
    runtime(s2).abilities.set(e.id, s2.time + 20);
  } else if (ability === "ward") {
    let restored = false;
    for (const ally of s2.entities) if (ally.side === e.side && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5 && (ally.shield ?? 0) < (ally.maxShield ?? 0)) {
      ally.shield = Math.min(ally.maxShield, (ally.shield ?? 0) + 24);
      restored = true;
    }
    if (!restored) return false;
    runtime(s2).abilities.set(e.id, s2.time + 20);
  } else if (ability === "heal") {
    let healed = false;
    for (const ally of s2.entities) if (ally.side === e.side && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5 && ally.hp < ally.maxHp) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      healed = true;
    }
    if (!healed) return false;
    runtime(s2).abilities.set(e.id, s2.time + 18);
  } else {
    e.momentum = Math.min(1, e.momentum + 0.5);
    runtime(s2).abilities.set(e.id, s2.time + 25);
  }
  e.abilityReadyAt = runtime(s2).abilities.get(e.id) ?? s2.time;
  emit(s2, "ability", e);
  return true;
}
function walkTo(e, x, y) {
  const dx = x - e.x, dy = y - e.y;
  if (dx !== 0 || dy !== 0) e.facing = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  e.x = x;
  e.y = y;
  e.animation = "walk";
}
function upgradeFactor(s2, e, effect) {
  let factor = 1;
  for (const id of s2.players[e.side].upgrades) {
    const u = UPGRADES[id];
    if (u.appliesTo === e.role) factor *= u.effects[effect] ?? 1;
  }
  return factor;
}
function movementSpeed(s2, e) {
  const terrain = terrainAt(s2, e.x, e.y);
  const terrainSpeed = FACTIONS[s2.players[e.side].faction].terrainSpeeds?.[terrain] ?? TERRAIN[terrain].speed;
  return unitDef(s2, e).speed * terrainSpeed * upgradeFactor(s2, e, "speed") * (e.illusion ? 1.08 : 1) * ((e.surgeUntil ?? 0) > s2.time ? 1.25 : 1);
}
function move(s2, e, to, dt, reach = 0.45) {
  if (distance2(e, to) <= reach) {
    e.path = [];
    return true;
  }
  if (distance2(e, to) < reach + 0.85) {
    const d2 = distance2(e, to), amount2 = Math.min(d2 - reach + 0.02, movementSpeed(s2, e) * dt), x = e.x + (to.x - e.x) / d2 * amount2, y = e.y + (to.y - e.y) / d2 * amount2;
    if (segmentWalkable(s2, e, { x, y })) {
      walkTo(e, x, y);
      return distance2(e, to) <= reach;
    }
  }
  const rt = runtime(s2), key = `${Math.floor(to.x * 2)},${Math.floor(to.y * 2)},${reach.toFixed(1)}`, cache = rt.routes.get(e.id);
  if (!cache || cache.key !== key || !e.path.length && s2.time - cache.at > 1.3 || s2.time - cache.at > 5) {
    e.path = route(s2, e, to, reach, e.side);
    rt.routes.set(e.id, { key, at: s2.time });
  }
  while (e.path.length > 1 && distance2(e, e.path[0]) < 0.6 && segmentWalkable(s2, e, e.path[1])) e.path.shift();
  if (!e.path.length) return false;
  const p = e.path[0], d = distance2(e, p), speed = movementSpeed(s2, e), amount = Math.min(d, speed * dt);
  if (d < 0.09) {
    e.path.shift();
    return false;
  }
  const nx = e.x + (p.x - e.x) / d * amount, ny = e.y + (p.y - e.y) / d * amount;
  if (segmentWalkable(s2, e, { x: nx, y: ny })) {
    walkTo(e, nx, ny);
  } else if (segmentWalkable(s2, e, { x: nx, y: e.y }) && Math.abs(nx - e.x) > 1e-3) {
    walkTo(e, nx, e.y);
  } else if (segmentWalkable(s2, e, { x: e.x, y: ny }) && Math.abs(ny - e.y) > 1e-3) {
    walkTo(e, e.x, ny);
  } else {
    e.path = [];
    rt.routes.delete(e.id);
  }
  if (d <= amount + 0.06) e.path.shift();
  return distance2(e, to) <= reach;
}
function emplaced(s2, e) {
  return e.entrenchedAt !== void 0 && s2.time - e.entrenchedAt >= 3;
}
function weaponRange(s2, e) {
  return e.kind === "building" ? 7 : unitDef(s2, e).range + (emplaced(s2, e) && e.role === "special" ? 3 : 0);
}
function damage(s2, a, b) {
  const d = a.kind === "unit" ? unitDef(s2, a) : null;
  const armor = (b.kind === "unit" ? unitDef(s2, b).armor : 3) + (emplaced(s2, b) ? 2 : 0) + s2.players[b.side].upgrades.reduce((sum, id) => sum + (UPGRADES[id].appliesTo === b.role ? UPGRADES[id].effects.armor ?? 0 : 0), 0);
  const base = d ? d.damage * upgradeFactor(s2, a, "damage") : 19;
  const bonus = d?.ability === "momentum" ? 1 + a.momentum * 0.4 : emplaced(s2, a) ? 1.15 : 1;
  const hit = Math.max(1, base * bonus * (b.kind === "building" ? d?.buildingDamageMultiplier ?? 1 : d?.bonusAgainst?.[b.role] ?? 1) - armor) * (a.illusion ? 0.25 : 1);
  a.cooldown = (d?.cooldown ?? 1.4) / (d?.ability === "momentum" ? 1 + a.momentum * 0.15 : 1);
  if (d?.ability === "momentum") a.momentum = Math.min(1, a.momentum + 0.15);
  a.animation = "attack";
  a.animTime = 0;
  const event = emit(s2, "attack", a, b.id);
  runtime(s2).hits.push({ source: a, target: b, amount: hit, event });
}
function die(s2, e) {
  if (e.kind === "building") refundQueue(s2, e);
  if (e.kind === "unit" && !e.illusion && !e.raised) s2.corpses.push({ id: e.id, x: e.x, y: e.y, expires: s2.time + 45 });
  e.hp = 0;
  e.animation = "death";
  e.animTime = 0;
  e.order = { type: "idle" };
  e.path = [];
  emit(s2, "death", e);
}
function enemy(s2, e, max, onlyInRange = false) {
  let best, bestDist = Infinity;
  for (const b of s2.entities) {
    if (!alive(b) || b.side === e.side || !isVisible(s2, e.side, b.x, b.y) || onlyInRange && !near(s2, e, b, max)) continue;
    const d = distance2(e, b) - radius(s2, b);
    if (d <= max && (d < bestDist || best?.kind === "building" && b.kind === "unit")) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
function fight(s2, e, b, dt) {
  const range = weaponRange(s2, e);
  if (near(s2, e, b, range)) {
    e.facing = (Math.round(Math.atan2(b.y - e.y, b.x - e.x) / (Math.PI / 4)) + 8) % 8;
    if (e.cooldown <= 0) damage(s2, e, b);
  } else if (e.kind === "unit") move(s2, e, b, dt, range + (b.kind === "building" ? radius(s2, b) : 0) - 0.1);
}
function gather(s2, e, target, dt) {
  const node = s2.resources.find((n) => n.id === target);
  const rt = runtime(s2);
  if (e.carried >= 18 || node?.amount === 0 && e.carried > 0) rt.returning.add(e.id);
  if (rt.returning.has(e.id)) {
    const depot = s2.entities.filter((b) => b.side === e.side && alive(b) && b.kind === "building" && b.progress === 1 && (b.role === "hq" || b.role === "depot")).sort((a, b) => distance2(e, a) - distance2(e, b))[0];
    if (!depot) {
      assign(s2, e, { type: "idle" });
      return;
    }
    if (near(s2, e, depot, 1.1)) {
      s2.players[e.side][e.carriedKind] += e.carried;
      const deposit = emit(s2, "gather", e, depot.id);
      deposit.amount = e.carried;
      deposit.resource = e.carriedKind;
      e.carried = 0;
      rt.returning.delete(e.id);
    } else move(s2, e, depot, dt, radius(s2, depot) + 1);
    return;
  }
  if (!node || node.amount <= 0) {
    const next2 = s2.resources.filter((n) => n.amount > 0 && n.kind === (node?.kind ?? e.carriedKind) && isVisible(s2, e.side, n.x, n.y)).sort((a, b) => distance2(e, a) - distance2(e, b))[0];
    assign(s2, e, next2 ? { type: "gather", target: next2.id } : { type: "idle" });
    return;
  }
  if (e.carried > 0 && e.carriedKind !== node.kind) {
    rt.returning.add(e.id);
    return;
  }
  if (distance2(e, node) > 1.2) {
    move(s2, e, node, dt, 1.1);
    return;
  }
  e.animation = "attack";
  e.carriedKind = node.kind;
  const amount = Math.min(node.amount, dt * ECONOMY.harvestPerSecond * upgradeFactor(s2, e, "gather") * (node.kind === "crystal" ? 0.6 : 1), 18 - e.carried);
  node.amount -= amount;
  e.carried += amount;
}
function construct(s2, e, id, dt) {
  const b = s2.entities.find((b2) => b2.id === id && alive(b2) && b2.side === e.side && b2.kind === "building");
  if (!b) {
    assign(s2, e, { type: "idle" });
    return;
  }
  if (!near(s2, e, b, 1.2)) {
    move(s2, e, b, dt, radius(s2, b) + 1.1);
    return;
  }
  const def = buildingDef(s2, b);
  e.animation = "attack";
  if (b.progress < 1) {
    const amount = Math.min(1 - b.progress, dt / def.buildTime);
    b.progress += amount;
    b.hp = Math.min(b.maxHp, b.hp + amount * b.maxHp * 0.9);
    if (b.progress >= 1) {
      b.progress = 1;
      emit(s2, "build", b, void 0, "Construction complete");
      updatePopulation(s2);
    }
  } else if (b.hp < b.maxHp) {
    const p = s2.players[e.side], amount = Math.min(b.maxHp - b.hp, dt * 18, p.wood * 10);
    p.wood -= amount * 0.1;
    b.hp += amount;
  } else assign(s2, e, { type: "idle" });
}
function production(s2, e, dt) {
  if (e.progress < 1 || !e.queue.length) return;
  const role = e.queue[0], d = FACTIONS[s2.players[e.side].faction].units[role];
  if (s2.players[e.side].population >= s2.players[e.side].cap) return;
  if (e.trainProgress < 1) e.trainProgress = Math.min(1, e.trainProgress + dt / d.trainTime);
  if (e.trainProgress < 1) return;
  let point;
  for (let ring = radius(s2, e) + 1; ring <= radius(s2, e) + 6 && !point; ring += 0.5) for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2 + (e.side === 0 ? 0 : Math.PI), p = { x: e.x + Math.cos(angle) * ring, y: e.y + Math.sin(angle) * ring };
    if (walkable(s2, p.x, p.y)) {
      point = p;
      break;
    }
  }
  if (!point) {
    refundCost(s2, e.side, role);
    e.queue.shift();
    e.trainProgress = 0;
    return;
  }
  const u = spawn(s2, e.side, "unit", role, point.x, point.y);
  e.trainProgress = 0;
  e.queue.shift();
  emit(s2, "train", u);
  updatePopulation(s2);
  if (e.rally) issueCommand(s2, e.side, { type: "move", ids: [u.id], ...e.rally });
}
function separateUnits(s2) {
  const units = s2.entities.filter((e) => e.kind === "unit" && alive(e));
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j], d = distance2(a, b);
    if (d >= 0.58) continue;
    const dx = d > 1e-3 ? (a.x - b.x) / d : a.id % 2 ? 1 : -1, dy = d > 1e-3 ? (a.y - b.y) / d : 0.3, push = (0.58 - d) * 0.22;
    const ax = a.x + dx * push, ay = a.y + dy * push, bx = b.x - dx * push, by = b.y - dy * push;
    if (walkable(s2, ax, ay)) {
      a.x = ax;
      a.y = ay;
    }
    if (walkable(s2, bx, by)) {
      b.x = bx;
      b.y = by;
    }
  }
}
function resolveHits(s2) {
  const groups = /* @__PURE__ */ new Map();
  for (const hit of runtime(s2).hits) {
    const group = groups.get(hit.target) ?? [];
    group.push(hit);
    groups.set(hit.target, group);
  }
  for (const [target, hits] of groups) {
    if (!alive(target)) continue;
    const total = hits.reduce((n, h) => n + h.amount, 0), absorbed = Math.min(target.shield ?? 0, total), actual = Math.min(target.hp, total - absorbed) + absorbed;
    target.shield = Math.max(0, (target.shield ?? 0) - absorbed);
    target.hp = Math.max(0, target.hp - (total - absorbed));
    target.lastDamagedAt = s2.time;
    for (const hit of hits) hit.event.amount = actual * hit.amount / total;
    target.lastAttacker = hits.reduce((best, h) => h.amount > best.amount ? h : best).source.id;
    if (target.hp === 0) die(s2, target);
  }
  const lost = [0, 1].map((side) => !s2.entities.some((e) => e.side === side && e.role === "hq" && alive(e) && e.progress === 1));
  if (lost[0] && lost[1]) s2.draw = true;
  else if (lost[0] || lost[1]) s2.winner = lost[0] ? 1 : 0;
}
function stepGame(s2, dt) {
  s2.events = [];
  if (isGameOver(s2) || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.25);
  s2.time += dt;
  s2.tick++;
  const rt = runtime(s2);
  rt.hits = [];
  rt.fog -= dt;
  if (rt.fog <= 0) {
    refreshVisibility(s2);
    rt.fog = 0.2;
  }
  rt.ai -= dt;
  if (rt.ai <= 0) {
    for (const side of rt.aiTurns++ % 2 ? [1, 0] : [0, 1]) if (s2.controllers[side] === "ai") runAI(s2, side);
    rt.ai += 1;
  }
  for (const e of [...s2.entities]) {
    e.animTime += dt;
    if (!alive(e)) {
      if (e.kind === "building") refundQueue(s2, e);
      continue;
    }
    if (e.expires && s2.time >= e.expires) {
      die(s2, e);
      continue;
    }
    e.cooldown = Math.max(0, e.cooldown - dt);
    if (e.animation !== "attack" || e.animTime > 0.4) e.animation = "idle";
    e.momentum = Math.max(0, e.momentum - dt * 0.014);
    if (e.kind === "building") {
      if (e.progress === 1 && buildingDef(s2, e).ability === "heal") {
        for (const ally of s2.entities) if (ally.side === e.side && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(ally, e) < 6) ally.hp = Math.min(ally.maxHp, ally.hp + dt * 2.5);
      }
      if (e.research) {
        e.researchProgress += dt / UPGRADES[e.research].researchTime;
        if (e.researchProgress >= 1) {
          s2.players[e.side].upgrades.push(e.research);
          emit(s2, "research", e, void 0, `${UPGRADES[e.research].name} complete`);
          e.research = void 0;
          e.researchProgress = 0;
        }
      }
      production(s2, e, dt);
      if (e.role === "tower" && e.progress === 1) {
        const b2 = enemy(s2, e, 7);
        if (b2) fight(s2, e, b2, dt);
      }
      continue;
    }
    const d = unitDef(s2, e);
    if (e.maxShield && s2.time - (e.lastDamagedAt ?? -6) >= 6) e.shield = Math.min(e.maxShield, (e.shield ?? 0) + 4 * dt);
    if (!e.illusion && (d.ability === "raise" || d.ability === "ward")) useAbility(s2, e);
    const o = e.order;
    if (o.type === "hold") {
      const b2 = enemy(s2, e, weaponRange(s2, e), true);
      if (b2 && near(s2, e, b2, weaponRange(s2, e))) {
        fight(s2, e, b2, dt);
        if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s2.entities.some((a) => a.side === e.side && alive(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance2(e, a) < 5))) useAbility(s2, e);
      }
      continue;
    }
    if (o.type === "gather") {
      gather(s2, e, o.target, dt);
      continue;
    }
    if (o.type === "build") {
      construct(s2, e, o.target, dt);
      continue;
    }
    if (o.type === "move") {
      if (move(s2, e, o, dt, 0.5)) assign(s2, e, { type: "idle" });
      continue;
    }
    if (o.type === "attack") {
      const b2 = s2.entities.find((b3) => b3.id === o.target && alive(b3) && b3.side !== e.side);
      if (!b2 || !isVisible(s2, e.side, b2.x, b2.y)) {
        assign(s2, e, { type: "idle" });
        continue;
      }
      fight(s2, e, b2, dt);
      continue;
    }
    const b = enemy(s2, e, d.role === "worker" ? 2 : Math.min(d.sight, 7));
    if (b) {
      fight(s2, e, b, dt);
      if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s2.entities.some((a) => a.side === e.side && alive(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance2(e, a) < 5))) useAbility(s2, e);
    } else if (o.type === "attackMove" && move(s2, e, o, dt, 0.65)) assign(s2, e, { type: "idle" });
  }
  resolveHits(s2);
  s2.corpses = s2.corpses.filter((c) => c.expires > s2.time);
  separateUnits(s2);
  s2.entities = s2.entities.filter((e) => alive(e) || e.animTime < 1.2);
  updatePopulation(s2);
}
function runAI(s2, side = 1) {
  if (isGameOver(s2)) return;
  const owned = s2.entities.filter((e) => e.side === side && alive(e)), workers = owned.filter((e) => e.kind === "unit" && e.role === "worker"), buildings2 = owned.filter((e) => e.kind === "building"), hq = buildings2.find((e) => e.role === "hq");
  if (!hq) return;
  const f = FACTIONS[s2.players[side].faction], p = s2.players[side], age = playerAge(p);
  const available = s2.resources.filter((n) => n.amount > 0 && isVisible(s2, side, n.x, n.y));
  const wantCrystal = buildings2.some((b) => b.role === "barracks") && available.some((n) => n.kind === "crystal") ? p.crystal < 40 ? 2 : p.crystal < 100 ? 1 : 0 : 0;
  const desired = { wood: Math.max(1, Math.ceil((workers.length - wantCrystal) * 0.6)), ore: Math.max(1, workers.length - wantCrystal - Math.ceil((workers.length - wantCrystal) * 0.6)), crystal: wantCrystal };
  const assigned = { wood: 0, ore: 0, crystal: 0 };
  for (const worker of workers) {
    if (worker.order.type === "gather") {
      const n = s2.resources.find((n2) => n2.id === worker.order.target);
      if (n && n.amount > 0) assigned[n.kind]++;
    }
  }
  for (const worker of workers.filter((e) => e.order.type === "idle" || e.order.type === "gather")) {
    const current = worker.order.type === "gather" ? s2.resources.find((n) => n.id === worker.order.target) : void 0;
    if (current && current.amount > 0 && assigned[current.kind] <= desired[current.kind]) continue;
    const kinds = ["wood", "ore", "crystal"].filter((k) => available.some((n) => n.kind === k)).sort((a, b) => desired[b] - assigned[b] - (desired[a] - assigned[a]));
    const kind = kinds[0];
    if (!kind) continue;
    const node = available.filter((n) => n.kind === kind).sort((a, b) => distance2(worker, a) - distance2(worker, b))[0];
    if (node && issueCommand(s2, side, { type: "gather", ids: [worker.id], target: node.id })) {
      if (current) assigned[current.kind]--;
      assigned[kind]++;
    }
  }
  for (const site of buildings2.filter((b) => b.progress < 1)) {
    if (workers.some((w) => w.order.type === "build" && w.order.target === site.id)) continue;
    const builder = workers.filter((w) => w.order.type === "idle" || w.order.type === "gather").sort((a, b) => distance2(a, site) - distance2(b, site))[0];
    if (builder) issueCommand(s2, side, { type: "repair", ids: [builder.id], target: site.id });
  }
  if (workers.length + hq.queue.filter((r) => r === "worker").length < (age === 1 ? 13 : age === 2 ? 19 : 24) && hq.queue.length < 2) issueCommand(s2, side, { type: "train", id: hq.id, role: "worker" });
  if (hq.progress === 1 && !hq.research && workers.length >= 7) for (const id of ["worker-harvest", "worker-speed", "town-age", "citadel-age"]) {
    const u = UPGRADES[id];
    if (u.building === "hq" && !researchRequirement(s2, side, id) && p.wood >= u.cost.wood + 120 && p.ore >= u.cost.ore + 80 && p.crystal >= u.cost.crystal) {
      issueCommand(s2, side, { type: "research", id: hq.id, upgrade: id });
      break;
    }
  }
  if (age >= 2 && workers.length >= 13 && buildings2.filter((b) => b.role === "hq").length < 2 && !workers.some((w) => w.order.type === "build") && p.wood >= 400 && p.ore >= 220) {
    const deposit = available.filter((n) => n.amount > 300 && distance2(n, hq) > 14 && !buildings2.some((b) => (b.role === "hq" || b.role === "depot") && distance2(b, n) < 8)).sort((a, b) => distance2(a, hq) - distance2(b, hq))[0];
    if (deposit) {
      const builder = workers.filter((w) => w.order.type === "gather" || w.order.type === "idle").sort((a, b) => distance2(a, deposit) - distance2(b, deposit))[0];
      if (builder) {
        let placed = false;
        for (let r = 4; r <= 7 && !placed; r++) for (let i = 0; i < 12 && !placed; i++) {
          const x = Math.floor(deposit.x + Math.cos(i * Math.PI / 6) * r) + 0.5, y = Math.floor(deposit.y + Math.sin(i * Math.PI / 6) * r) + 0.5;
          if (canPlace(s2, side, "hq", x, y)) placed = issueCommand(s2, side, { type: "build", ids: [builder.id], role: "hq", x, y });
        }
      }
    }
  }
  const queued = reserved(s2, side);
  let buildRole;
  if (!buildings2.some((b) => b.role === "barracks")) buildRole = "barracks";
  else if (p.cap - p.population - queued < 5 && p.cap < 100 && !buildings2.some((b) => b.role === "depot" && b.progress < 1)) buildRole = "depot";
  else if (s2.time > 100 && !buildings2.some((b) => b.role === "tower")) buildRole = "tower";
  else if (s2.time > 180 && buildings2.filter((b) => b.role === "barracks").length < (age === 3 && p.wood > 700 && p.ore > 300 ? 5 : (age >= 2 || s2.time > 420) && p.wood > 400 ? 3 : 2)) buildRole = "barracks";
  if (buildRole && !workers.some((e) => e.order.type === "build")) {
    const builder = workers[0];
    if (builder) {
      const dir = side === 0 ? 1 : -1;
      let placed = false;
      for (let r = 5; r <= 10 && !placed; r += 2) for (let i = 0; i < 16 && !placed; i++) {
        const angle = i * Math.PI / 8;
        const x = hq.x + Math.round(Math.cos(angle) * r) * dir, y = hq.y + Math.round(Math.sin(angle) * r) * dir;
        if (canPlace(s2, side, buildRole, x, y)) placed = issueCommand(s2, side, { type: "build", ids: [builder.id], role: buildRole, x, y });
      }
    }
  }
  if (age >= 2 && p.wood > 220 && p.ore > 160 && !workers.some((w) => w.order.type === "build")) {
    const tower = buildings2.find((b) => b.role === "tower" && b.progress === 1), builder = workers.find((w) => w.order.type === "gather" || w.order.type === "idle");
    if (tower && builder) {
      const dir = side === 0 ? 1 : -1;
      const slots = [["gate", 0, 3.5], ["wall", -1.5, 3.5], ["wall", 1.5, 3.5], ["wall", -2.5, 3.5], ["wall", 2.5, 3.5]];
      for (const [role, dx, dy] of slots) {
        const x = tower.x + dx * dir, y = tower.y + dy * dir;
        if (buildings2.some((b) => Math.hypot(b.x - x, b.y - y) < 0.4)) continue;
        if (canPlace(s2, side, role, x, y) && issueCommand(s2, side, { type: "build", ids: [builder.id], role, x, y })) break;
      }
    }
  }
  for (const gate of buildings2.filter((b) => b.role === "gate" && b.progress === 1)) {
    const danger = s2.entities.some((e) => e.side !== side && alive(e) && isVisible(s2, side, e.x, e.y) && distance2(e, gate) < 9);
    if (!!gate.gateOpen === danger) issueCommand(s2, side, { type: "toggleGate", ids: [gate.id] });
  }
  const army = owned.filter((e) => e.kind === "unit" && e.role !== "worker" && !e.illusion);
  const visibleEnemy = s2.entities.filter((e) => e.side !== side && alive(e) && e.kind === "unit" && isVisible(s2, side, e.x, e.y));
  const planned = [...army.filter((e) => !e.raised).map((e) => e.role), ...buildings2.flatMap((e) => e.queue).filter((r) => r !== "worker")];
  const weights = { ...f.ai.composition, spear: visibleEnemy.some((e) => e.role === "cavalry") ? 0.28 : 0.1, cavalry: visibleEnemy.some((e) => e.role === "ranged") ? 0.25 : 0.16, siege: 0.18 };
  const roles2 = Object.keys(f.units).filter((r) => r !== "worker" && (f.units[r].age ?? 1) <= age);
  for (const b of buildings2.filter((e) => e.role === "barracks" && e.progress === 1)) {
    if (age >= 2 && !b.research && army.length >= 5) for (const id of ["forged-weapons", "tempered-armor", "veteran-arms"]) {
      const d = UPGRADES[id];
      if (!researchRequirement(s2, side, id) && p.wood > d.cost.wood + 180 && p.ore > d.cost.ore + 120) {
        issueCommand(s2, side, { type: "research", id: b.id, upgrade: id });
        break;
      }
    }
    if (b.queue.length >= 2) continue;
    const nextAge = age === 1 ? "town-age" : age === 2 ? "citadel-age" : void 0;
    if (nextAge && army.length >= 7 && !hq.research && s2.time > (age === 1 ? 150 : 380) && !visibleEnemy.some((e) => distance2(e, hq) < 14) && p.wood < UPGRADES[nextAge].cost.wood + 120) continue;
    const total = roles2.reduce((n, r) => n + (weights[r] ?? 0.1), 0);
    const role = [...roles2].sort((a, b2) => (planned.length + 1) * (weights[b2] ?? 0.1) / total - planned.filter((r) => r === b2).length - ((planned.length + 1) * (weights[a] ?? 0.1) / total - planned.filter((r) => r === a).length))[0];
    if (issueCommand(s2, side, { type: "train", id: b.id, role })) planned.push(role);
  }
  for (const unit2 of army.filter((e) => unitDef(s2, e).ability === "entrench")) {
    const target = enemy(s2, unit2, unitDef(s2, unit2).range + (unit2.role === "special" ? 3 : 0), true);
    if (target && unit2.entrenchedAt === void 0) issueCommand(s2, side, { type: "ability", ids: [unit2.id] });
    else if (!target && unit2.entrenchedAt !== void 0) issueCommand(s2, side, { type: "ability", ids: [unit2.id] });
  }
  const seen = s2.entities.filter((e) => e.side !== side && alive(e) && isVisible(s2, side, e.x, e.y));
  const threat = seen.find((e) => distance2(e, hq) < 12);
  const rt = runtime(s2);
  const remembered = rt.knownEnemyBuildings[side];
  for (const [id, point] of remembered) if (isVisible(s2, side, point.x, point.y) && !seen.some((e) => e.id === id)) remembered.delete(id);
  for (const e of seen) if (e.kind === "building") remembered.set(e.id, { x: e.x, y: e.y, role: e.role });
  const enemyStart = s2.starts[side === 0 ? 1 : 0];
  if (isVisible(s2, side, enemyStart.x, enemyStart.y) && !seen.some((e) => e.role === "hq" && distance2(e, enemyStart) < 4)) rt.enemyStartCleared[side] = true;
  if (age >= 2 && (s2.mapSize === "large" || s2.mapSize === "huge") && !rt.expansionScoutDispatched[side] && army.length >= 3) {
    const scout = army.find((e) => e.role === "cavalry") ?? army.find((e) => e.role === "melee");
    const x = Math.floor(s2.width * 0.23) + 0.5, y = Math.floor(s2.height * 0.58) + 0.5;
    if (scout && issueCommand(s2, side, { type: "move", ids: [scout.id], x: side === 0 ? x : s2.width - x, y: side === 0 ? y : s2.height - y })) {
      rt.expansionScout[side] = scout.id;
      rt.expansionScoutDispatched[side] = true;
    }
  }
  if (rt.expansionScout[side] !== null && !army.some((e) => e.id === rt.expansionScout[side] && e.order.type === "move")) rt.expansionScout[side] = null;
  if (threat) {
    const ready = army.filter((e) => e.order.type !== "attack" && e.entrenchedAt === void 0);
    if (ready.length) issueCommand(s2, side, { type: "attackMove", ids: ready.map((e) => e.id), x: threat.x, y: threat.y });
  } else if (army.length >= f.ai.armySize && s2.time - rt.aiWave[side] > Math.max(25, 65 / f.ai.aggression)) {
    const target = seen.find((e) => e.kind === "building" && e.role === "hq") ?? [...remembered.values()].find((e) => e.role === "hq") ?? seen[0] ?? [...remembered.values()][0];
    let destination = target ?? s2.starts[side === 0 ? 1 : 0];
    if (!target && rt.enemyStartCleared[side]) {
      const origin = army[0], candidates = [];
      for (let y = 4.5; y < s2.height - 3; y += 6) for (let x = 4.5; x < s2.width - 3; x += 6) if (!isVisible(s2, side, x, y) && !rt.searched[side].has(Math.floor(y) * s2.width + Math.floor(x))) candidates.push({ x, y });
      if (candidates.length) {
        destination = candidates.sort((a, b) => distance2(origin, a) - distance2(origin, b))[0];
        rt.searched[side].add(Math.floor(destination.y) * s2.width + Math.floor(destination.x));
      } else rt.searched[side].clear();
    }
    issueCommand(s2, side, { type: "attackMove", ids: army.filter((e) => e.entrenchedAt === void 0 && e.id !== rt.expansionScout[side]).map((e) => e.id), x: destination.x, y: destination.y });
    rt.aiWave[side] = s2.time;
  } else if (!rt.initialScoutDispatched[side] && s2.time > 65 && army.length && army.every((e) => e.order.type === "idle")) {
    const scout = army[0];
    if (issueCommand(s2, side, { type: "attackMove", ids: [scout.id], x: hq.x + (s2.starts[side === 0 ? 1 : 0].x - hq.x) * 0.7, y: hq.y + (s2.starts[side === 0 ? 1 : 0].y - hq.y) * 0.7 })) rt.initialScoutDispatched[side] = true;
  }
}

// scripts/progression/playtest.ts
var faction = process.argv[2] ?? "orcs";
var opponent = process.argv[3] ?? "fairies";
var mapSize = process.argv[4] ?? "medium";
var seed = Number(process.argv[5] ?? 4127);
var out = process.argv[6] ?? "work/three-ages/matches";
mkdirSync(out, { recursive: true });
var s = createGame(faction, seed, opponent, { mapSize, controllers: ["ai", "ai"] });
var roles = [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()];
var buildings = [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()];
var ages = [[], []];
var camps = mapSize === "large" || mapSize === "huge" ? [{ x: Math.floor(s.width * 0.23) + 0.5, y: Math.floor(s.height * 0.58) + 0.5 }] : [];
if (mapSize === "huge") camps.push({ x: Math.floor(s.width * 0.18) + 0.5, y: Math.floor(s.height * 0.37) + 0.5 });
camps.push(...camps.map((p) => ({ x: s.width - p.x, y: s.height - p.y })));
var campEvidence = camps.map((point) => ({ point, visitedAt: [null, null], extraction: [0, 0], headquarters: [] }));
var lastCarried = /* @__PURE__ */ new Map();
var recordedHQs = /* @__PURE__ */ new Set();
var milestones = [];
var next = 0;
while (!isGameOver(s) && s.time < 2700) {
  stepGame(s, 0.05);
  for (const e of s.entities) {
    if (e.hp <= 0) continue;
    (e.kind === "unit" ? roles : buildings)[e.side].add(e.role);
  }
  for (const e of s.entities) {
    if (e.hp <= 0) continue;
    for (const camp of campEvidence) {
      if (e.kind === "unit" && Math.hypot(e.x - camp.point.x, e.y - camp.point.y) < 6) {
        camp.visitedAt[e.side] ??= s.time;
        if (e.role === "worker" && e.order.type === "gather") {
          const node = s.resources.find((r) => r.id === (e.order.type === "gather" ? e.order.target : void 0));
          if (node && Math.hypot(node.x - camp.point.x, node.y - camp.point.y) < 6) camp.extraction[e.side] += Math.max(0, e.carried - (lastCarried.get(e.id) ?? e.carried));
        }
      }
      if (e.role === "hq" && e.progress === 1 && Math.hypot(e.x - camp.point.x, e.y - camp.point.y) < 9 && !recordedHQs.has(e.id)) {
        camp.headquarters.push({ side: e.side, x: e.x, y: e.y, time: s.time });
        recordedHQs.add(e.id);
      }
    }
    lastCarried.set(e.id, e.carried);
  }
  for (const side of [0, 1]) {
    const age = playerAge(s.players[side]);
    if (ages[side][age - 1] === void 0) ages[side][age - 1] = s.time;
  }
  if (s.time >= next) {
    milestones.push({ time: s.time, players: structuredClone(s.players), living: [0, 1].map((side) => s.entities.filter((e) => e.side === side && e.hp > 0).reduce((counts, e) => {
      counts[e.role] = (counts[e.role] ?? 0) + 1;
      return counts;
    }, {})) });
    next += 60;
  }
  if (s.players.some((p) => p.wood < 0 || p.ore < 0 || p.crystal < 0) || s.entities.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.y))) throw new Error("Invalid economy or position");
}
var result = { faction, opponent, mapSize, seed, time: s.time, winner: s.winner, draw: s.draw, finished: isGameOver(s), ages, roles: roles.map((r) => [...r]), buildings: buildings.map((r) => [...r]), campEvidence, milestones };
writeFileSync(`${out}/${faction}-${opponent}-${mapSize}-${seed}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, milestones: void 0 }));
