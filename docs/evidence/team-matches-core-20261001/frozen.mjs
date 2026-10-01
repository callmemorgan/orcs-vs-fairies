// src/core/content.ts
var ECONOMY = { harvestPerSecond: 2.28 };
var unit = (id2, name, role, wood, ore, hp, damage2, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id2, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage: damage2, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
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

// src/core/progression.ts
var AGE_NAMES = { 1: "Settlement Age", 2: "Town Age", 3: "Citadel Age" };
function playerAge(player) {
  return player.upgrades.includes("citadel-age") ? 3 : player.upgrades.includes("town-age") ? 2 : 1;
}
function researchRequirement(s, side, id2) {
  const player = s.players[side], def = UPGRADES[id2];
  if (player.upgrades.includes(id2)) return "Already researched";
  if (s.entities.some((e) => e.side === side && e.hp > 0 && e.research === id2)) return "Already researching";
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
function seededRandom(seed) {
  let value = seed >>> 0;
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
function generateMap(seed, size = "medium") {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Map seed must be an integer from 0 to 4294967295.");
  if (!(size in MAP_SIZES)) throw new Error("Map size must be small, medium, large or huge.");
  const width = MAP_SIZES[size], height = width, rng = seededRandom(seed), terrain = Array(width * height).fill("grass");
  const base = size === "small" ? 7.5 : 8.5, starts = [{ x: base, y: base }, { x: width - base, y: height - base }];
  const map = { size, seed, width, height, terrain, starts, resources: [], version: MAP_VERSION };
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
    for (const point2 of [p, q]) map.resources.push({ ...point2, kind, amount, maxAmount: amount });
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
  const { width, height, terrain } = map, center = { x: width / 2, y: height / 2 }, radius2 = width / 2 - 10.5;
  map.starts = Array.from({ length: playerCount }, (_, slot) => {
    const angle = -Math.PI * 3 / 4 + slot * Math.PI * 2 / playerCount;
    return { x: Math.floor(center.x + Math.cos(angle) * radius2) + 0.5, y: Math.floor(center.y + Math.sin(angle) * radius2) + 0.5 };
  });
  map.resources = [];
  const paintDisk = (p, r, kind) => {
    for (let y = Math.max(1, Math.floor(p.y - r)); y < Math.min(height - 1, Math.ceil(p.y + r)); y++) for (let x = Math.max(1, Math.floor(p.x - r)); x < Math.min(width - 1, Math.ceil(p.x + r)); x++) if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) <= r) terrain[y * width + x] = kind;
  };
  const carve = (a, b, r = 1.8) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      for (let y = Math.max(1, Math.floor(p.y - r)); y < Math.min(height - 1, Math.ceil(p.y + r)); y++) for (let x = Math.max(1, Math.floor(p.x - r)); x < Math.min(width - 1, Math.ceil(p.x + r)); x++) if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) <= r) {
        const old = terrain[y * width + x];
        terrain[y * width + x] = old === "water" || old === "shallows" || old === "bridge" ? "bridge" : "road";
      }
    }
  };
  for (let slot = 0; slot < playerCount; slot++) {
    carve(map.starts[slot], center);
    carve(map.starts[slot], map.starts[(slot + 1) % playerCount]);
  }
  paintDisk(center, 7, "grass");
  for (const start of map.starts) paintDisk(start, 8.1, "grass");
  const addResource = (point2, kind, amount) => {
    if (map.resources.some((r) => Math.hypot(point2.x - r.x, point2.y - r.y) < 2.05)) throw new Error("Multiplayer resource clusters overlap.");
    map.resources.push({ ...point2, kind, amount, maxAmount: amount });
    paintDisk(point2, 1.75, "grass");
  };
  for (const start of map.starts) {
    const dir = start.y < height / 2 ? 1 : -1;
    for (const [dx, dy, kind, amount] of [[-4, 4, "wood", 2600], [-2, 6, "wood", 2600], [-5, 1, "wood", 2600], [5, -3, "ore", 2800], [6, 0, "ore", 2800], [5, 4, "crystal", 180]]) addResource({ x: start.x + dx * dir, y: start.y + dy * dir }, kind, amount);
  }
  for (const start of map.starts) {
    const dx = start.x - center.x, dy = start.y - center.y, length = Math.hypot(dx, dy), outward = { x: dx / length, y: dy / length }, tangent = { x: -outward.y, y: outward.x };
    const camp = { x: center.x + outward.x * radius2 * 0.42, y: center.y + outward.y * radius2 * 0.42 };
    carve(camp, center, 1.5);
    paintDisk(camp, 4.5, "grass");
    for (const [along, across, kind, amount] of [[0, -2.5, "wood", 4e3], [0, 2.5, "ore", 3500], [2.5, 0, "crystal", 750]]) {
      const point2 = { x: camp.x + outward.x * along + tangent.x * across, y: camp.y + outward.y * along + tangent.y * across };
      carve(point2, camp, 1.3);
      addResource(point2, kind, amount);
    }
  }
  const validation = validateMap(map);
  if (!validation.valid) throw new Error(`Invalid generated match map ${actualSize}/${seed}/${playerCount}: ${validation.issues.join("; ")}`);
  return map;
}
function validateMap(map) {
  const { width, height, starts, resources, terrain } = map, issues = [];
  if (terrain.length !== width * height) issues.push("Terrain dimensions do not match.");
  if (!starts.length || starts.length > 8) issues.push("Starting positions must number 1 through 8.");
  if (starts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 2.5 || p.y < 2.5 || p.x > width - 2.5 || p.y > height - 2.5)) issues.push("Starting positions lie outside the playable map.");
  const free = (x, y) => x >= 0 && y >= 0 && x < width && y < height && TERRAIN[terrain[y * width + x] ?? "rock"].walkable && !resources.some((r) => r.amount > 0 && Math.hypot(r.x - x - 0.5, r.y - y - 0.5) < 0.7) && !starts.some((p) => Math.abs(p.x - x - 0.5) < 1.77 && Math.abs(p.y - y - 0.5) < 1.77);
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
  for (const r of resources) {
    let reached = false;
    for (let y = Math.floor(r.y) - 1; y <= Math.floor(r.y) + 1; y++) for (let x = Math.floor(r.x) - 1; x <= Math.floor(r.x) + 1; x++) if (seen.has(y * width + x) && Math.hypot(x + 0.5 - r.x, y + 0.5 - r.y) <= 1.25) reached = true;
    if (reached) reachableResources++;
    else issues.push(`Unreachable ${r.kind} at ${r.x},${r.y}.`);
  }
  for (const start of starts) for (const kind of ["wood", "ore", "crystal"]) if (!resources.some((r) => r.kind === kind && Math.hypot(r.x - start.x, r.y - start.y) < 9)) issues.push(`Missing starting ${kind}.`);
  if (starts.length === 2) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain[y * width + x] !== terrain[(height - 1 - y) * width + width - 1 - x]) {
      issues.push("Terrain is not symmetric.");
      break;
    }
    for (const r of resources) if (!resources.some((q) => q.kind === r.kind && q.amount === r.amount && q.x === width - r.x && q.y === height - r.y)) issues.push("Resource pair is not symmetric.");
  }
  return { valid: issues.length === 0, issues, reachableResources, totalResources: resources.length, reachableTiles: seen.size, startsConnected };
}

// src/core/navigation.ts
var distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var buildingRadius = (s, e) => FACTIONS[s.players[e.side].faction].buildings[e.role].size / 2 + 0.27;
function walkable(s, x, y) {
  if (x < 0.35 || y < 0.35 || x > s.width - 0.35 || y > s.height - 0.35) return false;
  for (let ty = Math.floor(y - 0.27); ty <= Math.floor(y + 0.27); ty++) for (let tx = Math.floor(x - 0.27); tx <= Math.floor(x + 0.27); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5)].walkable) return false;
  for (const b of s.entities) if (b.hp > 0 && b.kind === "building" && !b.gateOpen) {
    const r = buildingRadius(s, b);
    if (Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) return false;
  }
  for (const r of s.resources) if (r.amount > 0 && Math.hypot(r.x - x, r.y - y) < 0.7) return false;
  return true;
}
function segmentWalkable(s, a, b) {
  if (!walkable(s, a.x, a.y) || !walkable(s, b.x, b.y)) return false;
  const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
  for (let y = Math.floor(Math.min(a.y, b.y) - 0.27); y <= Math.floor(Math.max(a.y, b.y) + 0.27); y++) for (let x = Math.floor(Math.min(a.x, b.x) - 0.27); x <= Math.floor(Math.max(a.x, b.x) + 0.27); x++) {
    if (TERRAIN[terrainAt(s, x + 0.5, y + 0.5)].walkable) continue;
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
    if (r.amount <= 0) continue;
    const t = lengthSquared ? clamp(((r.x - a.x) * dx + (r.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
    if (Math.hypot(a.x + t * dx - r.x, a.y + t * dy - r.y) < 0.7) return false;
  }
  for (const obstacle of s.entities) {
    if (obstacle.hp <= 0 || obstacle.kind !== "building" || obstacle.gateOpen) continue;
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
  if (walkable(s, to.x, to.y)) return to;
  const angle = Math.atan2(from.y - to.y, from.x - to.x);
  for (let r = 0.25; r <= 6; r += 0.25) {
    const candidates = [];
    for (let i = 0; i < 32; i++) {
      const a = angle + i * Math.PI / 16, p = { x: to.x + Math.cos(a) * r, y: to.y + Math.sin(a) * r };
      if (walkable(s, p.x, p.y)) candidates.push(p);
    }
    if (candidates.length) return candidates.sort((a, b) => distance(from, a) - distance(from, b))[0];
  }
  return void 0;
}
var grids = /* @__PURE__ */ new WeakMap();
function gridFor(s, CELL) {
  const buildings = s.entities.filter((e) => e.hp > 0 && e.kind === "building" && !e.gateOpen);
  const resources = s.resources.filter((r) => r.amount > 0);
  const signature = `${s.width},${s.height};${buildings.map((b) => `${b.id},${b.x},${b.y},${buildingRadius(s, b)}`).join(";")}|${resources.map((r) => `${r.id},${r.x},${r.y}`).join(";")}`;
  const terrainSignature = s.terrain.map((kind) => TERRAIN[kind].walkable ? "1" : "0").join("");
  let caches = grids.get(s);
  if (!caches) {
    caches = /* @__PURE__ */ new Map();
    grids.set(s, caches);
  }
  const old = caches.get(CELL);
  if (old?.signature === signature && old.terrain === s.terrain && old.terrainSignature === terrainSignature) return old;
  const width = Math.round(s.width / CELL), height = Math.round(s.height / CELL), blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if ((x + 0.5) * CELL < 0.35 || (y + 0.5) * CELL < 0.35 || (x + 0.5) * CELL > s.width - 0.35 || (y + 0.5) * CELL > s.height - 0.35) blocked[y * width + x] = 1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + 0.5) * CELL, py = (y + 0.5) * CELL;
    for (let ty = Math.floor(py - 0.27); ty <= Math.floor(py + 0.27); ty++) for (let tx = Math.floor(px - 0.27); tx <= Math.floor(px + 0.27); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5)].walkable) blocked[y * width + x] = 1;
  }
  for (const b of [...buildings, ...resources]) {
    const r = "role" in b ? buildingRadius(s, b) : 0.7;
    for (let y = Math.max(0, Math.floor((b.y - r) / CELL)); y < Math.min(height, Math.ceil((b.y + r) / CELL)); y++) for (let x = Math.max(0, Math.floor((b.x - r) / CELL)); x < Math.min(width, Math.ceil((b.x + r) / CELL)); x++) {
      const dx = Math.abs((x + 0.5) * CELL - b.x), dy = Math.abs((y + 0.5) * CELL - b.y);
      if ("role" in b ? dx < r && dy < r : Math.hypot(dx, dy) < r) blocked[y * width + x] = 1;
    }
  }
  const grid = { terrain: s.terrain, terrainSignature, signature, width, height, blocked, edges: /* @__PURE__ */ new Map() };
  caches.set(CELL, grid);
  return grid;
}
function route(s, from, to, reach, side) {
  const coarse = routeOnGrid(s, from, to, reach, 0.5, side);
  return coarse.length ? coarse : routeOnGrid(s, from, to, reach, 0.25, side);
}
function routeOnGrid(s, from, to, reach, CELL, side) {
  const grid = gridFor(s, CELL), { width, height, blocked } = grid;
  const point2 = (k) => ({ x: (k % width + 0.5) * CELL, y: (Math.floor(k / width) + 0.5) * CELL });
  const sx = Math.floor(from.x / CELL), sy = Math.floor(from.y / CELL), start = sy * width + sx;
  const starts = [];
  if (!blocked[start] && segmentWalkable(s, from, point2(start))) starts.push(start);
  else for (let ring = 1; ring <= 4 && !starts.length; ring++) for (let y = Math.max(0, sy - ring); y <= Math.min(height - 1, sy + ring); y++) for (let x = Math.max(0, sx - ring); x <= Math.min(width - 1, sx + ring); x++) {
    const k = y * width + x;
    if (!blocked[k] && segmentWalkable(s, from, point2(k))) starts.push(k);
  }
  if (!starts.length) return [];
  const goals = /* @__PURE__ */ new Set(), rr = Math.max(reach + 0.2, 0.4);
  for (let y = Math.max(0, Math.floor((to.y - rr) / CELL)); y < Math.min(height, Math.ceil((to.y + rr) / CELL)); y++) for (let x = Math.max(0, Math.floor((to.x - rr) / CELL)); x < Math.min(width, Math.ceil((to.x + rr) / CELL)); x++) {
    const k = y * width + x;
    if (!blocked[k] && distance(point2(k), to) <= rr) goals.add(k);
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
  const heuristic = (k) => Math.max(0, distance(point2(k), to) - rr) / 1.15;
  for (const k of starts) {
    score[k] = distance(from, point2(k));
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
        clear = segmentWalkable(s, point2(k), point2(n));
        grid.edges.set(edge, clear);
      }
      if (!clear) continue;
      const p = point2(n), terrain = terrainAt(s, p.x, p.y), speed = (side !== void 0 ? FACTIONS[s.players[side].faction].terrainSpeeds?.[terrain] : void 0) ?? TERRAIN[terrain].speed;
      const value = score[k] + (dx && dy ? Math.SQRT2 : 1) * CELL / Math.max(0.1, speed);
      if (value < score[n]) {
        score[n] = value;
        parent[n] = k;
        push(n, value + heuristic(n));
      }
    }
  }
  if (end === -1) return [];
  const result = [];
  for (let k = end; k !== -1; k = parent[k]) if (parent[k] !== -1 || distance(from, point2(k)) > 0.08) result.push(point2(k));
  return result.reverse();
}

// src/core/history-hooks.ts
var observers = /* @__PURE__ */ new WeakMap();
function notifyCommand(state, side, command) {
  for (const observer of [...observers.get(state) ?? []]) {
    try {
      observer.command?.(side, structuredClone(command));
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

// src/core/simulation.ts
var distance2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
var clamp2 = (n, a, b) => Math.max(a, Math.min(b, n));
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
var MAX_ORDER_QUEUE = 32;
var alive = (e) => e.hp > 0;
function unitDef(s, e) {
  return FACTIONS[s.players[e.side].faction].units[e.role];
}
function buildingDef(s, e) {
  return FACTIONS[s.players[e.side].faction].buildings[e.role];
}
function radius(s, e) {
  return e.kind === "building" ? buildingDef(s, e).size / 2 : 0.3;
}
function near(s, a, b, range) {
  return distance2(a, b) <= range + ("kind" in b && b.kind === "building" ? radius(s, b) : 0);
}
function emit(s, type, e, target, text) {
  const event = { type, x: e.x, y: e.y, side: e.side, target, text, source: e.id };
  s.events.push(event);
  return event;
}
function spawn(s, side, kind, role, x, y, progress = 1) {
  const f = FACTIONS[s.players[side].faction];
  const def = kind === "unit" ? f.units[role] : f.buildings[role];
  const e = { id: s.nextId++, side, kind, role, x, y, hp: progress === 1 ? def.hp : Math.max(1, def.hp * 0.1), maxHp: def.hp, order: { type: "idle" }, cooldown: 0, progress, queue: [], trainProgress: 0, researchProgress: 0, facing: 2, animation: "idle", animTime: 0, momentum: 0, illusion: false, expires: 0, carried: 0, carriedKind: "wood", path: [] };
  if (kind === "unit" && def.shield) {
    e.maxShield = def.shield;
    e.shield = e.maxShield;
  }
  s.entities.push(e);
  return e;
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
function matchObject(value, allowed, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some((k) => !allowed.includes(k))) throw new Error(`Invalid ${name}.`);
  return value;
}
function matchNumber(value, min, max, name, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) throw new Error(`Invalid ${name}.`);
  return value;
}
function createMatch(config) {
  const c = matchObject(config, ["schemaVersion", "map", "players", "rules"], "match configuration");
  if (c.schemaVersion !== void 0 && c.schemaVersion !== 1) throw new Error("Unsupported match configuration version.");
  const m = matchObject(c.map, ["seed", "size"], "match map");
  const seed = matchNumber(m.seed, 0, 4294967295, "map seed", true), size = m.size === void 0 ? "medium" : m.size;
  if (!["small", "medium", "large", "huge"].includes(size)) throw new Error("Invalid map size.");
  if (!Array.isArray(c.players) || c.players.length < 1 || c.players.length > 8) throw new Error("A match requires 1 to 8 players.");
  for (let i = 0; i < c.players.length; i++) if (!Object.hasOwn(c.players, i)) throw new Error("Player slots cannot contain gaps.");
  const slots = /* @__PURE__ */ new Set(), teams = [], incomeFactors = [], populationLimits = [];
  const definitions = c.players.map((value, i) => {
    const p = matchObject(value, ["id", "teamId", "factionId", "controller", "startingSlot", "handicap"], "player");
    if (p.id !== i) throw new Error("Player IDs must be ordered contiguous slots starting at zero.");
    teams.push(matchNumber(p.teamId, 0, 7, "team", true));
    if (typeof p.factionId !== "string" || !Object.hasOwn(FACTIONS, p.factionId)) throw new Error("Unknown faction.");
    if (!["human", "ai", "external"].includes(p.controller)) throw new Error("Unknown controller.");
    const slot = matchNumber(p.startingSlot === void 0 ? i : p.startingSlot, 0, c.players instanceof Array ? c.players.length - 1 : 0, "starting slot", true);
    if (slots.has(slot)) throw new Error("Starting slots must be unique.");
    slots.add(slot);
    const h = p.handicap === void 0 ? {} : matchObject(p.handicap, ["startingResources", "incomeFactor", "populationCap"], "handicap");
    const resources = h.startingResources === void 0 ? { wood: 420, ore: 220, crystal: 0 } : matchObject(h.startingResources, ["wood", "ore", "crystal"], "starting resources");
    const wood = matchNumber(resources.wood, 0, 1e9, "starting wood"), ore = matchNumber(resources.ore, 0, 1e9, "starting ore"), crystal = matchNumber(resources.crystal, 0, 1e9, "starting crystal");
    incomeFactors.push(matchNumber(h.incomeFactor === void 0 ? 1 : h.incomeFactor, 0, 10, "income factor"));
    populationLimits.push(matchNumber(h.populationCap === void 0 ? 100 : h.populationCap, 1, 500, "population cap", true));
    return { faction: p.factionId, controller: p.controller, slot, wood, ore, crystal };
  });
  const rules = c.rules === void 0 ? {} : matchObject(c.rules, ["sharedVision", "startingAge"], "match rules");
  if (rules.sharedVision !== void 0 && typeof rules.sharedVision !== "boolean") throw new Error("Invalid shared vision.");
  const age = matchNumber(rules.startingAge === void 0 ? 1 : rules.startingAge, 1, 3, "starting age", true);
  const map = generateMatchMap(seed, size, definitions.length);
  const s = { controllers: definitions.map((p) => p.controller), teams, incomeFactors, populationLimits, sharedVision: rules.sharedVision !== false, eliminated: definitions.map(() => false), winningTeam: null, mapSize: map.size, mapVersion: map.version, terrain: map.terrain, starts: definitions.map((p) => ({ ...map.starts[p.slot] })), draw: false, tick: 0, corpses: [], time: 0, seed, width: map.width, height: map.height, entities: [], resources: [], players: definitions.map((p) => ({ faction: p.faction, wood: p.wood, ore: p.ore, crystal: p.crystal, population: 0, cap: 12, upgrades: age === 3 ? ["town-age", "citadel-age"] : age === 2 ? ["town-age"] : [] })), winner: null, events: [], explored: definitions.map(() => /* @__PURE__ */ new Set()), visible: definitions.map(() => /* @__PURE__ */ new Set()), nextId: 1 };
  for (const side of playerSides(s)) {
    const { x, y } = s.starts[side], dir = y < s.height / 2 ? 1 : -1;
    spawn(s, side, "building", "hq", x, y);
    for (let i = 0; i < 5; i++) spawn(s, side, "unit", "worker", x + (-2 + i * 0.85) * dir, y + 3 * dir);
    spawn(s, side, "unit", "melee", x + 3 * dir, y + dir);
  }
  for (const resource of map.resources) s.resources.push({ ...resource, id: s.nextId++ });
  refreshVisibility(s);
  updatePopulation(s);
  return s;
}
function isGameOver(s) {
  return s.winner !== null || s.draw;
}
function isVisible(s, side, x, y) {
  return x >= 0 && y >= 0 && x < s.width && y < s.height && !!s.visible[side]?.has(Math.floor(y) * s.width + Math.floor(x));
}
function refreshVisibility(s) {
  for (const visible of s.visible) visible.clear();
  for (const e of s.entities) {
    if (!alive(e)) continue;
    const sight = e.kind === "unit" ? unitDef(s, e).sight : buildingDef(s, e).sight, side = e.side;
    for (let y = Math.max(0, Math.floor(e.y - sight)); y <= Math.min(s.height - 1, Math.ceil(e.y + sight)); y++) for (let x = Math.max(0, Math.floor(e.x - sight)); x <= Math.min(s.width - 1, Math.ceil(e.x + sight)); x++) if (Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y) <= sight) {
      const key = y * s.width + x;
      s.visible[side].add(key);
      s.explored[side].add(key);
    }
  }
  if (s.sharedVision) for (const team of new Set(s.teams)) {
    const members = playerSides(s).filter((side) => s.teams[side] === team), visible = /* @__PURE__ */ new Set(), explored = /* @__PURE__ */ new Set();
    for (const side of members) {
      for (const tile of s.visible[side]) visible.add(tile);
      for (const tile of s.explored[side]) explored.add(tile);
    }
    for (const side of members) {
      s.visible[side].clear();
      for (const tile of visible) s.visible[side].add(tile);
      for (const tile of explored) s.explored[side].add(tile);
    }
  }
}
function updatePopulation(s) {
  for (const side of playerSides(s)) {
    const es = s.entities.filter((e) => e.side === side && alive(e));
    s.players[side].population = es.filter((e) => e.kind === "unit" && !e.illusion).length;
    s.players[side].cap = Math.min(s.populationLimits[side], es.filter((e) => e.kind === "building" && e.progress === 1).reduce((v, e) => v + (e.role === "hq" ? 12 : e.role === "depot" ? 10 : 0), 0));
  }
}
function reserved(s, side) {
  return s.entities.filter((e) => e.side === side && alive(e)).reduce((v, e) => v + e.queue.length, 0);
}
function footprintOverlap(e, x, y, size) {
  return Math.abs(e.x - x) < size / 2 + 0.35 && Math.abs(e.y - y) < size / 2 + 0.35;
}
function shovePoint(s, x, y, size) {
  for (let ring = size / 2 + 1; ring < size / 2 + 5; ring += 0.5) for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, px = x + Math.cos(a) * ring, py = y + Math.sin(a) * ring;
    if ((Math.abs(px - x) >= size / 2 + 0.27 || Math.abs(py - y) >= size / 2 + 0.27) && walkable(s, px, py)) return { x: px, y: py };
  }
}
function rallyWalkable(s, side, x, y) {
  const fogged = /* @__PURE__ */ new Set();
  for (const e of s.entities) if (e.kind === "building" && alive(e) && isHostile(s, e.side, side) && !isVisible(s, side, e.x, e.y)) fogged.add(e);
  if (!fogged.size) return walkable(s, x, y);
  const kept = s.entities;
  s.entities = kept.filter((e) => !fogged.has(e));
  try {
    return walkable(s, x, y);
  } finally {
    s.entities = kept;
  }
}
function commandDestination(s, side, to, from) {
  const observed = { ...s, entities: s.entities.filter((e) => e.side === side || isVisible(s, side, e.x, e.y)), resources: s.resources.filter((r) => isVisible(s, side, r.x, r.y)) };
  return openDestination(observed, to, from);
}
function movementOrder(s, e, order2, dt, reach) {
  const destination = openDestination(s, order2, e);
  return destination ? move(s, e, destination, dt, reach) : false;
}
function refundCost(s, side, role) {
  const cost = FACTIONS[s.players[side].faction].units[role].cost, p = s.players[side];
  p.wood += cost.wood;
  p.ore += cost.ore;
  p.crystal += cost.crystal;
}
function refundQueue(s, e) {
  if (!e.queue.length) return;
  for (const role of e.queue) refundCost(s, e.side, role);
  e.queue = [];
  e.trainProgress = 0;
}
function canPlace(s, side, role, x, y) {
  if (!s.players[side]) return false;
  const def = FACTIONS[s.players[side].faction].buildings[role];
  if (!def || playerAge(s.players[side]) < (role === "hq" ? 2 : def.age ?? 1) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = def.size / 2;
  if (x - r < 0.5 || y - r < 0.5 || x + r > s.width - 0.5 || y + r > s.height - 0.5) return false;
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) if (!isVisible(s, side, x + dx, y + dy)) return false;
  for (let ty = Math.floor(y - r); ty < Math.ceil(y + r); ty++) for (let tx = Math.floor(x - r); tx < Math.ceil(x + r); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5)].buildable) return false;
  if (s.entities.some((e) => alive(e) && e.kind === "building" && Math.abs(e.x - x) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4) && Math.abs(e.y - y) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4))) return false;
  if (s.entities.some((e) => alive(e) && e.kind === "unit" && isHostile(s, e.side, side) && footprintOverlap(e, x, y, def.size))) return false;
  if (s.resources.some((e) => e.amount > 0 && Math.abs(e.x - x) < r + 0.8 && Math.abs(e.y - y) < r + 0.8)) return false;
  return true;
}
function assign(s, e, order2) {
  if (order2.type !== "hold") e.entrenchedAt = void 0;
  e.order = order2;
  e.path = [];
  runtime(s).routes.delete(e.id);
  runtime(s).returning.delete(e.id);
  runtime(s).queuedGather.delete(e.id);
}
function commandOrder(s, e, order2, queued = false) {
  if (queued && e.order.type !== "idle" && e.order.type !== "hold") {
    if ((e.orderQueue?.length ?? 0) >= MAX_ORDER_QUEUE) return false;
    (e.orderQueue ??= []).push(order2);
    return true;
  }
  delete e.orderQueue;
  assign(s, e, order2);
  if (queued && order2.type === "gather") runtime(s).queuedGather.add(e.id);
  return true;
}
function finishOrder(s, e) {
  while (e.orderQueue?.length) {
    const order2 = e.orderQueue.shift();
    if (order2.type === "attack") {
      const target = s.entities.find((t) => t.id === order2.target && alive(t) && isHostile(s, t.side, e.side));
      if (!target || !isVisible(s, e.side, target.x, target.y)) continue;
    }
    if (order2.type === "gather" && !s.resources.some((n) => n.id === order2.target && n.amount > 0)) continue;
    if (order2.type === "build" && !s.entities.some((t) => t.id === order2.target && alive(t) && isAllied(s, t.side, e.side) && t.kind === "building" && (t.progress < 1 || t.hp < t.maxHp))) continue;
    if (!e.orderQueue.length) delete e.orderQueue;
    assign(s, e, order2);
    if (order2.type === "gather") runtime(s).queuedGather.add(e.id);
    return;
  }
  delete e.orderQueue;
  assign(s, e, { type: "idle" });
}
function issueCommand(s, side, c) {
  const accepted = applyCommand(s, side, c);
  if (accepted && !runtime(s).stepping) notifyCommand(s, side, c);
  return accepted;
}
function applyCommand(s, side, c) {
  if (isGameOver(s) || !s.players[side] || s.eliminated[side]) return false;
  const p = s.players[side], f = FACTIONS[p.faction];
  if (c.type === "toggleGate") {
    let changed = false;
    for (const gate of s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive(e) && e.role === "gate" && e.progress === 1)) {
      if (gate.gateOpen && s.entities.some((e) => alive(e) && e.kind === "unit" && footprintOverlap(e, gate.x, gate.y, buildingDef(s, gate).size))) continue;
      gate.gateOpen = !gate.gateOpen;
      changed = true;
    }
    return changed;
  }
  if (c.type === "setRally" || c.type === "clearRally") {
    const producers = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive(e) && e.kind === "building" && (e.role === "hq" || e.role === "barracks"));
    if (!producers.length) return false;
    if (c.type === "setRally") {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x < 0.5 || c.y < 0.5 || c.x > s.width - 0.5 || c.y > s.height - 0.5) return false;
      if (!s.explored[side].has(Math.floor(c.y) * s.width + Math.floor(c.x))) return false;
      if (!rallyWalkable(s, side, c.x, c.y)) return false;
    }
    for (const e of producers) {
      if (c.type === "clearRally") delete e.rally;
      else e.rally = { x: c.x, y: c.y };
    }
    return true;
  }
  if (c.type === "cancelTrain") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive(e2) && e2.kind === "building");
    if (!e || !Number.isInteger(c.index) || c.index < 0 || c.index >= e.queue.length) return false;
    refundCost(s, side, e.queue[c.index]);
    e.queue.splice(c.index, 1);
    if (c.index === 0) e.trainProgress = 0;
    return true;
  }
  if (c.type === "reorderTrain") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive(e2) && e2.kind === "building" && e2.progress === 1 && (e2.role === "hq" || e2.role === "barracks"));
    if (!e || !Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 1 || c.to < 1 || c.from >= e.queue.length || c.to >= e.queue.length || c.from === c.to) return false;
    const [role] = e.queue.splice(c.from, 1);
    e.queue.splice(c.to, 0, role);
    return true;
  }
  if (c.type === "train") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive(e2) && e2.kind === "building" && e2.progress === 1);
    const d = f.units[c.role];
    if (!e || !d || playerAge(p) < (d.age ?? 1) || (c.role === "worker" ? e.role !== "hq" : e.role !== "barracks") || e.queue.length >= 5 || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || p.population + reserved(s, side) >= p.cap) return false;
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    e.queue.push(c.role);
    return true;
  }
  if (c.type === "research") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive(e2) && e2.kind === "building" && e2.progress === 1);
    const d = UPGRADES[c.upgrade];
    if (!e || !d || d.building !== e.role || e.research || researchRequirement(s, side, c.upgrade) || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal) return false;
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    e.research = c.upgrade;
    e.researchProgress = 0;
    emit(s, "research", e, void 0, `${d.name} started`);
    return true;
  }
  const units = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive(e) && e.kind === "unit" && !e.illusion);
  if (!units.length) return false;
  if (c.type === "build") {
    const workers2 = units.filter((e) => e.role === "worker");
    const d = f.buildings[c.role];
    if (!workers2.length || !d || c.role === "hq" && playerAge(p) < 2 || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || !canPlace(s, side, c.role, c.x, c.y)) return false;
    const overlapping = s.entities.filter((e) => e.kind === "unit" && alive(e) && isAllied(s, e.side, side) && footprintOverlap(e, c.x, c.y, d.size));
    const shoves = [];
    for (const u of overlapping) {
      const dest = shovePoint(s, c.x, c.y, d.size);
      if (!dest) return false;
      shoves.push({ e: u, ...dest });
    }
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    const b = spawn(s, side, "building", c.role, c.x, c.y, 0);
    for (const shove of shoves) {
      shove.e.x = shove.x;
      shove.e.y = shove.y;
      shove.e.path = [];
      shove.e.entrenchedAt = void 0;
      runtime(s).routes.delete(shove.e.id);
    }
    for (const e of workers2) commandOrder(s, e, { type: "build", target: b.id });
    emit(s, "build", b);
    return true;
  }
  if (c.type === "ability") {
    let success = false;
    for (const e of units) {
      if (useAbility(s, e)) success = true;
    }
    return success;
  }
  if (c.type === "move" || c.type === "attackMove") {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return false;
    const width = Math.ceil(Math.sqrt(units.length)), dir = s.starts[side].y < s.height / 2 ? 1 : -1;
    const destinations = units.map((e, i) => {
      const dx = units.length === 1 ? 0 : (i % width - (width - 1) / 2) * 0.8 * dir, dy = units.length === 1 ? 0 : (Math.floor(i / width) - (width - 1) / 2) * 0.8 * dir;
      return commandDestination(s, side, { x: clamp2(c.x + dx, 0.6, s.width - 0.6), y: clamp2(c.y + dy, 0.6, s.height - 0.6) }, e);
    });
    let moved = false;
    units.forEach((e, i) => {
      if (destinations[i] && commandOrder(s, e, { type: c.type, ...destinations[i] }, c.queued)) moved = true;
    });
    return moved;
  }
  if (c.type === "stop" || c.type === "hold") {
    for (const e of units) commandOrder(s, e, { type: c.type === "hold" ? "hold" : "idle" });
    return true;
  }
  if (!("target" in c)) return false;
  const target = c.type === "gather" ? s.resources.find((e) => e.id === c.target && e.amount > 0) : s.entities.find((e) => e.id === c.target && alive(e));
  if (!target || !isVisible(s, side, target.x, target.y)) return false;
  if (c.type === "attack") {
    if (!("side" in target) || !isHostile(s, target.side, side)) return false;
    return units.reduce((accepted, e) => commandOrder(s, e, { type: "attack", target: target.id }, c.queued) || accepted, false);
  }
  const workers = units.filter((e) => e.role === "worker");
  if (!workers.length) return false;
  if (c.type === "repair" && (!("side" in target) || !isAllied(s, target.side, side) || target.kind !== "building" || target.hp >= target.maxHp && target.progress >= 1)) return false;
  return workers.reduce((accepted, e) => commandOrder(s, e, { type: c.type === "gather" ? "gather" : "build", target: target.id }, c.queued) || accepted, false);
}
function useAbility(s, e) {
  if ((runtime(s).abilities.get(e.id) ?? 0) > s.time) return false;
  const ability = unitDef(s, e).ability;
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
    updatePopulation(s);
    let count = 0;
    for (const corpse of [...s.corpses].sort((a, b) => distance2(e, a) - distance2(e, b))) {
      if (count >= 2 || s.players[e.side].population + reserved(s, e.side) >= s.players[e.side].cap) break;
      if (corpse.expires <= s.time || distance2(e, corpse) > 6 || !isVisible(s, e.side, corpse.x, corpse.y) || !walkable(s, corpse.x, corpse.y)) continue;
      const raised = spawn(s, e.side, "unit", "melee", corpse.x, corpse.y);
      raised.hp = raised.maxHp * 0.5;
      raised.raised = true;
      raised.expires = s.time + 35;
      raised.order = { type: "attackMove", x: e.x, y: e.y };
      s.corpses = s.corpses.filter((c) => c.id !== corpse.id);
      count++;
      updatePopulation(s);
    }
    if (!count) return false;
    runtime(s).abilities.set(e.id, s.time + 22);
  } else if (ability === "illusion") {
    let placed = 0;
    for (const offset of [-0.6, 0.6]) {
      const desired = { x: clamp2(e.x + offset, 0.5, s.width - 0.5), y: clamp2(e.y - offset, 0.5, s.height - 0.5) };
      const point2 = walkable(s, desired.x, desired.y) ? desired : openDestination(s, desired, e);
      if (!point2) continue;
      const clone = spawn(s, e.side, "unit", e.role, point2.x, point2.y);
      clone.illusion = true;
      clone.hp = clone.maxHp * 0.4;
      clone.maxHp = clone.hp;
      clone.expires = s.time + 18;
      clone.order = { ...e.order };
      placed++;
    }
    if (!placed) return false;
    runtime(s).abilities.set(e.id, s.time + 35);
  } else if (ability === "surge") {
    let affected = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      ally.surgeUntil = s.time + 6;
      affected = true;
    }
    if (!affected) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "ward") {
    let restored = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5 && (ally.shield ?? 0) < (ally.maxShield ?? 0)) {
      ally.shield = Math.min(ally.maxShield, (ally.shield ?? 0) + 24);
      restored = true;
    }
    if (!restored) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "heal") {
    let healed = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5 && ally.hp < ally.maxHp) {
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
  const dx = x - e.x, dy = y - e.y;
  if (dx !== 0 || dy !== 0) e.facing = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  e.x = x;
  e.y = y;
  e.animation = "walk";
}
function upgradeFactor(s, e, effect) {
  let factor = 1;
  for (const id2 of s.players[e.side].upgrades) {
    const u = UPGRADES[id2];
    if (u.appliesTo === e.role) factor *= u.effects[effect] ?? 1;
  }
  return factor;
}
function movementSpeed(s, e) {
  const terrain = terrainAt(s, e.x, e.y);
  const terrainSpeed = FACTIONS[s.players[e.side].faction].terrainSpeeds?.[terrain] ?? TERRAIN[terrain].speed;
  return unitDef(s, e).speed * terrainSpeed * upgradeFactor(s, e, "speed") * (e.illusion ? 1.08 : 1) * ((e.surgeUntil ?? 0) > s.time ? 1.25 : 1);
}
function move(s, e, to, dt, reach = 0.45) {
  if (distance2(e, to) <= reach) {
    e.path = [];
    return true;
  }
  if (distance2(e, to) < reach + 0.85) {
    const d2 = distance2(e, to), amount2 = Math.min(d2 - reach + 0.02, movementSpeed(s, e) * dt), x = e.x + (to.x - e.x) / d2 * amount2, y = e.y + (to.y - e.y) / d2 * amount2;
    if (segmentWalkable(s, e, { x, y })) {
      walkTo(e, x, y);
      return distance2(e, to) <= reach;
    }
  }
  const rt = runtime(s), key = `${Math.floor(to.x * 2)},${Math.floor(to.y * 2)},${reach.toFixed(1)}`, cache = rt.routes.get(e.id);
  if (!cache || cache.key !== key || !e.path.length && s.time - cache.at > 1.3 || s.time - cache.at > 5) {
    e.path = route(s, e, to, reach, e.side);
    rt.routes.set(e.id, { key, at: s.time });
  }
  while (e.path.length > 1 && distance2(e, e.path[0]) < 0.6 && segmentWalkable(s, e, e.path[1])) e.path.shift();
  if (!e.path.length) return false;
  const p = e.path[0], d = distance2(e, p), speed = movementSpeed(s, e), amount = Math.min(d, speed * dt);
  if (d < 0.09) {
    e.path.shift();
    return false;
  }
  const nx = e.x + (p.x - e.x) / d * amount, ny = e.y + (p.y - e.y) / d * amount;
  if (segmentWalkable(s, e, { x: nx, y: ny })) {
    walkTo(e, nx, ny);
  } else if (segmentWalkable(s, e, { x: nx, y: e.y }) && Math.abs(nx - e.x) > 1e-3) {
    walkTo(e, nx, e.y);
  } else if (segmentWalkable(s, e, { x: e.x, y: ny }) && Math.abs(ny - e.y) > 1e-3) {
    walkTo(e, e.x, ny);
  } else {
    e.path = [];
    rt.routes.delete(e.id);
  }
  if (d <= amount + 0.06) e.path.shift();
  return distance2(e, to) <= reach;
}
function emplaced(s, e) {
  return e.entrenchedAt !== void 0 && s.time - e.entrenchedAt >= 3;
}
function weaponRange(s, e) {
  return e.kind === "building" ? 7 : unitDef(s, e).range + (emplaced(s, e) && e.role === "special" ? 3 : 0);
}
function damage(s, a, b) {
  const d = a.kind === "unit" ? unitDef(s, a) : null;
  const armor = (b.kind === "unit" ? unitDef(s, b).armor : 3) + (emplaced(s, b) ? 2 : 0) + s.players[b.side].upgrades.reduce((sum, id2) => sum + (UPGRADES[id2].appliesTo === b.role ? UPGRADES[id2].effects.armor ?? 0 : 0), 0);
  const base = d ? d.damage * upgradeFactor(s, a, "damage") : 19;
  const bonus = d?.ability === "momentum" ? 1 + a.momentum * 0.4 : emplaced(s, a) ? 1.15 : 1;
  const hit = Math.max(1, base * bonus * (b.kind === "building" ? d?.buildingDamageMultiplier ?? 1 : d?.bonusAgainst?.[b.role] ?? 1) - armor) * (a.illusion ? 0.25 : 1);
  a.cooldown = (d?.cooldown ?? 1.4) / (d?.ability === "momentum" ? 1 + a.momentum * 0.15 : 1);
  if (d?.ability === "momentum") a.momentum = Math.min(1, a.momentum + 0.15);
  a.animation = "attack";
  a.animTime = 0;
  const event = emit(s, "attack", a, b.id);
  runtime(s).hits.push({ source: a, target: b, amount: hit, event });
}
function die(s, e) {
  if (e.kind === "building") refundQueue(s, e);
  if (e.kind === "unit" && !e.illusion && !e.raised) s.corpses.push({ id: e.id, x: e.x, y: e.y, expires: s.time + 45 });
  e.hp = 0;
  e.animation = "death";
  e.animTime = 0;
  e.order = { type: "idle" };
  delete e.orderQueue;
  runtime(s).queuedGather.delete(e.id);
  e.path = [];
  emit(s, "death", e);
}
function enemy(s, e, max, onlyInRange = false) {
  let best, bestDist = Infinity;
  for (const b of s.entities) {
    if (!alive(b) || !isHostile(s, b.side, e.side) || !isVisible(s, e.side, b.x, b.y) || onlyInRange && !near(s, e, b, max)) continue;
    const d = distance2(e, b) - radius(s, b);
    if (d <= max && (d < bestDist || best?.kind === "building" && b.kind === "unit")) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
function fight(s, e, b, dt) {
  const range = weaponRange(s, e);
  if (near(s, e, b, range)) {
    e.facing = (Math.round(Math.atan2(b.y - e.y, b.x - e.x) / (Math.PI / 4)) + 8) % 8;
    if (e.cooldown <= 0) damage(s, e, b);
  } else if (e.kind === "unit") move(s, e, b, dt, range + (b.kind === "building" ? radius(s, b) : 0) - 0.1);
}
function gather(s, e, target, dt) {
  const node = s.resources.find((n) => n.id === target);
  const rt = runtime(s), finite = rt.queuedGather.has(e.id) || !!e.orderQueue?.length;
  if (e.carried >= 18 || node?.amount === 0 && e.carried > 0 || finite && (!node || node.amount <= 0) && e.carried > 0) rt.returning.add(e.id);
  if (rt.returning.has(e.id)) {
    const depot = s.entities.filter((b) => b.side === e.side && alive(b) && b.kind === "building" && b.progress === 1 && (b.role === "hq" || b.role === "depot")).sort((a, b) => distance2(e, a) - distance2(e, b))[0];
    if (!depot) {
      finishOrder(s, e);
      return;
    }
    if (near(s, e, depot, 1.1)) {
      const income = e.carried * s.incomeFactors[e.side];
      s.players[e.side][e.carriedKind] += income;
      const deposit = emit(s, "gather", e, depot.id);
      deposit.amount = income;
      deposit.resource = e.carriedKind;
      e.carried = 0;
      rt.returning.delete(e.id);
      if (finite && (!node || node.amount <= 0)) finishOrder(s, e);
    } else move(s, e, depot, dt, radius(s, depot) + 1);
    return;
  }
  if (!node || node.amount <= 0) {
    if (finite) {
      finishOrder(s, e);
      return;
    }
    const next = s.resources.filter((n) => n.amount > 0 && n.kind === (node?.kind ?? e.carriedKind) && isVisible(s, e.side, n.x, n.y)).sort((a, b) => distance2(e, a) - distance2(e, b))[0];
    assign(s, e, next ? { type: "gather", target: next.id } : { type: "idle" });
    return;
  }
  if (e.carried > 0 && e.carriedKind !== node.kind) {
    rt.returning.add(e.id);
    return;
  }
  if (distance2(e, node) > 1.2) {
    move(s, e, node, dt, 1.1);
    return;
  }
  e.animation = "attack";
  e.carriedKind = node.kind;
  const amount = Math.min(node.amount, dt * ECONOMY.harvestPerSecond * upgradeFactor(s, e, "gather") * (node.kind === "crystal" ? 0.6 : 1), 18 - e.carried);
  node.amount -= amount;
  e.carried += amount;
}
function construct(s, e, id2, dt) {
  const b = s.entities.find((b2) => b2.id === id2 && alive(b2) && isAllied(s, b2.side, e.side) && b2.kind === "building");
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
  const role = e.queue[0], d = FACTIONS[s.players[e.side].faction].units[role];
  if (s.players[e.side].population >= s.players[e.side].cap) return;
  if (e.trainProgress < 1) e.trainProgress = Math.min(1, e.trainProgress + dt / d.trainTime);
  if (e.trainProgress < 1) return;
  let point2;
  for (let ring = radius(s, e) + 1; ring <= radius(s, e) + 6 && !point2; ring += 0.5) for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2 + (e.side === 0 ? 0 : Math.PI), p = { x: e.x + Math.cos(angle) * ring, y: e.y + Math.sin(angle) * ring };
    if (walkable(s, p.x, p.y)) {
      point2 = p;
      break;
    }
  }
  if (!point2) {
    refundCost(s, e.side, role);
    e.queue.shift();
    e.trainProgress = 0;
    return;
  }
  const u = spawn(s, e.side, "unit", role, point2.x, point2.y);
  e.trainProgress = 0;
  e.queue.shift();
  emit(s, "train", u);
  updatePopulation(s);
  if (e.rally) issueCommand(s, e.side, { type: "move", ids: [u.id], ...e.rally });
}
function separateUnits(s) {
  const units = s.entities.filter((e) => e.kind === "unit" && alive(e));
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j], d = distance2(a, b);
    if (d >= 0.58) continue;
    const dx = d > 1e-3 ? (a.x - b.x) / d : a.id % 2 ? 1 : -1, dy = d > 1e-3 ? (a.y - b.y) / d : 0.3, push = (0.58 - d) * 0.22;
    const ax = a.x + dx * push, ay = a.y + dy * push, bx = b.x - dx * push, by = b.y - dy * push;
    if (walkable(s, ax, ay)) {
      a.x = ax;
      a.y = ay;
    }
    if (walkable(s, bx, by)) {
      b.x = bx;
      b.y = by;
    }
  }
}
function resolveHits(s) {
  const groups = /* @__PURE__ */ new Map();
  for (const hit of runtime(s).hits) {
    const group = groups.get(hit.target) ?? [];
    group.push(hit);
    groups.set(hit.target, group);
  }
  for (const [target, hits] of groups) {
    if (!alive(target)) continue;
    const total = hits.reduce((n, h) => n + h.amount, 0), absorbed = Math.min(target.shield ?? 0, total), actual = Math.min(target.hp, total - absorbed) + absorbed;
    target.shield = Math.max(0, (target.shield ?? 0) - absorbed);
    target.hp = Math.max(0, target.hp - (total - absorbed));
    target.lastDamagedAt = s.time;
    for (const hit of hits) hit.event.amount = actual * hit.amount / total;
    target.lastAttacker = hits.reduce((best, h) => h.amount > best.amount ? h : best).source.id;
    if (target.hp === 0) die(s, target);
  }
  s.eliminated = playerSides(s).map((side) => !s.entities.some((e) => e.side === side && e.role === "hq" && alive(e) && e.progress === 1));
  const livingTeams = [...new Set(s.teams.filter((_, side) => !s.eliminated[side]))];
  if (!livingTeams.length) s.draw = true;
  else if (livingTeams.length === 1 && new Set(s.teams).size > 1) {
    s.winningTeam = livingTeams[0];
    s.winner = s.teams.findIndex((team) => team === s.winningTeam);
  }
  runtime(s).hits = [];
}
function stepGame(s, dt) {
  const before = s.tick, rt = runtime(s);
  rt.stepping = true;
  try {
    applyStep(s, dt);
  } finally {
    rt.stepping = false;
  }
  if (s.tick !== before) notifyStep(s, Math.min(dt, 0.25));
}
function applyStep(s, dt) {
  s.events = [];
  if (isGameOver(s) || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.25);
  s.time += dt;
  s.tick++;
  const rt = runtime(s);
  rt.hits = [];
  rt.fog -= dt;
  if (rt.fog <= 0) {
    refreshVisibility(s);
    rt.fog = 0.2;
  }
  rt.ai -= dt;
  if (rt.ai <= 0) {
    const sides = playerSides(s), offset = rt.aiTurns++ % sides.length;
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(i + offset) % sides.length];
      if (s.controllers[side] === "ai" && !s.eliminated[side]) runAI(s, side);
    }
    rt.ai += 1;
  }
  for (const e of [...s.entities]) {
    e.animTime += dt;
    if (!alive(e)) {
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
        for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive(ally) && ally.kind === "unit" && !ally.illusion && distance2(ally, e) < 6) ally.hp = Math.min(ally.maxHp, ally.hp + dt * 2.5);
      }
      if (e.research) {
        e.researchProgress += dt / UPGRADES[e.research].researchTime;
        if (e.researchProgress >= 1) {
          s.players[e.side].upgrades.push(e.research);
          emit(s, "research", e, void 0, `${UPGRADES[e.research].name} complete`);
          e.research = void 0;
          e.researchProgress = 0;
        }
      }
      production(s, e, dt);
      if (e.role === "tower" && e.progress === 1) {
        const b2 = enemy(s, e, 7);
        if (b2) fight(s, e, b2, dt);
      }
      continue;
    }
    const d = unitDef(s, e);
    if (e.maxShield && s.time - (e.lastDamagedAt ?? -6) >= 6) e.shield = Math.min(e.maxShield, (e.shield ?? 0) + 4 * dt);
    if (!e.illusion && (d.ability === "raise" || d.ability === "ward")) useAbility(s, e);
    const o = e.order;
    if (o.type === "hold") {
      const b2 = enemy(s, e, weaponRange(s, e), true);
      if (b2 && near(s, e, b2, weaponRange(s, e))) {
        fight(s, e, b2, dt);
        if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s.entities.some((a) => isAllied(s, a.side, e.side) && alive(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance2(e, a) < 5))) useAbility(s, e);
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
      if (movementOrder(s, e, o, dt, 0.5)) finishOrder(s, e);
      continue;
    }
    if (o.type === "attack") {
      const b2 = s.entities.find((b3) => b3.id === o.target && alive(b3) && isHostile(s, b3.side, e.side));
      if (!b2 || !isVisible(s, e.side, b2.x, b2.y)) {
        finishOrder(s, e);
        continue;
      }
      fight(s, e, b2, dt);
      continue;
    }
    const b = enemy(s, e, d.role === "worker" ? 2 : Math.min(d.sight, 7));
    if (b) {
      fight(s, e, b, dt);
      if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s.entities.some((a) => isAllied(s, a.side, e.side) && alive(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance2(e, a) < 5))) useAbility(s, e);
    } else if (o.type === "attackMove" && movementOrder(s, e, o, dt, 0.65)) finishOrder(s, e);
  }
  resolveHits(s);
  s.corpses = s.corpses.filter((c) => c.expires > s.time);
  separateUnits(s);
  s.entities = s.entities.filter((e) => alive(e) || e.animTime < 1.2);
  updatePopulation(s);
}
function runAI(s, side = 1) {
  if (isGameOver(s) || !s.players[side] || s.eliminated[side]) return;
  const owned = s.entities.filter((e) => e.side === side && alive(e)), workers = owned.filter((e) => e.kind === "unit" && e.role === "worker"), buildings = owned.filter((e) => e.kind === "building"), hq = buildings.find((e) => e.role === "hq");
  if (!hq) return;
  const f = FACTIONS[s.players[side].faction], p = s.players[side], age = playerAge(p);
  const available = s.resources.filter((n) => n.amount > 0 && isVisible(s, side, n.x, n.y));
  const wantCrystal = buildings.some((b) => b.role === "barracks") && available.some((n) => n.kind === "crystal") ? p.crystal < 40 ? 2 : p.crystal < 100 ? 1 : 0 : 0;
  const desired = { wood: Math.max(1, Math.ceil((workers.length - wantCrystal) * 0.6)), ore: Math.max(1, workers.length - wantCrystal - Math.ceil((workers.length - wantCrystal) * 0.6)), crystal: wantCrystal };
  const assigned = { wood: 0, ore: 0, crystal: 0 };
  for (const worker of workers) {
    if (worker.order.type === "gather") {
      const n = s.resources.find((n2) => n2.id === worker.order.target);
      if (n && n.amount > 0) assigned[n.kind]++;
    }
  }
  for (const worker of workers.filter((e) => e.order.type === "idle" || e.order.type === "gather")) {
    const current = worker.order.type === "gather" ? s.resources.find((n) => n.id === worker.order.target) : void 0;
    if (current && current.amount > 0 && assigned[current.kind] <= desired[current.kind]) continue;
    const kinds = ["wood", "ore", "crystal"].filter((k) => available.some((n) => n.kind === k)).sort((a, b) => desired[b] - assigned[b] - (desired[a] - assigned[a]));
    const kind = kinds[0];
    if (!kind) continue;
    const node = available.filter((n) => n.kind === kind).sort((a, b) => distance2(worker, a) - distance2(worker, b))[0];
    if (node && issueCommand(s, side, { type: "gather", ids: [worker.id], target: node.id })) {
      if (current) assigned[current.kind]--;
      assigned[kind]++;
    }
  }
  for (const site of buildings.filter((b) => b.progress < 1)) {
    if (workers.some((w) => w.order.type === "build" && w.order.target === site.id)) continue;
    const builder = workers.filter((w) => w.order.type === "idle" || w.order.type === "gather").sort((a, b) => distance2(a, site) - distance2(b, site))[0];
    if (builder) issueCommand(s, side, { type: "repair", ids: [builder.id], target: site.id });
  }
  if (workers.length + hq.queue.filter((r) => r === "worker").length < (age === 1 ? 13 : age === 2 ? 19 : 24) && hq.queue.length < 2) issueCommand(s, side, { type: "train", id: hq.id, role: "worker" });
  if (hq.progress === 1 && !hq.research && workers.length >= 7) for (const id2 of ["worker-harvest", "worker-speed", "town-age", "citadel-age"]) {
    const u = UPGRADES[id2];
    if (u.building === "hq" && !researchRequirement(s, side, id2) && p.wood >= u.cost.wood + 120 && p.ore >= u.cost.ore + 80 && p.crystal >= u.cost.crystal) {
      issueCommand(s, side, { type: "research", id: hq.id, upgrade: id2 });
      break;
    }
  }
  if (age >= 2 && workers.length >= 13 && buildings.filter((b) => b.role === "hq").length < 2 && !workers.some((w) => w.order.type === "build") && p.wood >= 400 && p.ore >= 220) {
    const deposit = available.filter((n) => n.amount > 300 && distance2(n, hq) > 14 && !buildings.some((b) => (b.role === "hq" || b.role === "depot") && distance2(b, n) < 8)).sort((a, b) => distance2(a, hq) - distance2(b, hq))[0];
    if (deposit) {
      const builder = workers.filter((w) => w.order.type === "gather" || w.order.type === "idle").sort((a, b) => distance2(a, deposit) - distance2(b, deposit))[0];
      if (builder) {
        let placed = false;
        for (let r = 4; r <= 7 && !placed; r++) for (let i = 0; i < 12 && !placed; i++) {
          const x = Math.floor(deposit.x + Math.cos(i * Math.PI / 6) * r) + 0.5, y = Math.floor(deposit.y + Math.sin(i * Math.PI / 6) * r) + 0.5;
          if (canPlace(s, side, "hq", x, y)) placed = issueCommand(s, side, { type: "build", ids: [builder.id], role: "hq", x, y });
        }
      }
    }
  }
  const queued = reserved(s, side);
  let buildRole;
  if (!buildings.some((b) => b.role === "barracks")) buildRole = "barracks";
  else if (p.cap - p.population - queued < 5 && p.cap < s.populationLimits[side] && !buildings.some((b) => b.role === "depot" && b.progress < 1)) buildRole = "depot";
  else if (s.time > 100 && !buildings.some((b) => b.role === "tower")) buildRole = "tower";
  else if (s.time > 180 && buildings.filter((b) => b.role === "barracks").length < (age === 3 && p.wood > 700 && p.ore > 300 ? 5 : (age >= 2 || s.time > 420) && p.wood > 400 ? 3 : 2)) buildRole = "barracks";
  if (buildRole && !workers.some((e) => e.order.type === "build")) {
    const builder = workers[0];
    if (builder) {
      const dir = s.starts[side].y < s.height / 2 ? 1 : -1;
      let placed = false;
      for (let r = 5; r <= 10 && !placed; r += 2) for (let i = 0; i < 16 && !placed; i++) {
        const angle = i * Math.PI / 8;
        const x = hq.x + Math.round(Math.cos(angle) * r) * dir, y = hq.y + Math.round(Math.sin(angle) * r) * dir;
        if (canPlace(s, side, buildRole, x, y)) placed = issueCommand(s, side, { type: "build", ids: [builder.id], role: buildRole, x, y });
      }
    }
  }
  if (age >= 2 && p.wood > 220 && p.ore > 160 && !workers.some((w) => w.order.type === "build")) {
    const tower = buildings.find((b) => b.role === "tower" && b.progress === 1), builder = workers.find((w) => w.order.type === "gather" || w.order.type === "idle");
    if (tower && builder) {
      const dir = s.starts[side].y < s.height / 2 ? 1 : -1;
      const slots = [["gate", 0, 3.5], ["wall", -1.5, 3.5], ["wall", 1.5, 3.5], ["wall", -2.5, 3.5], ["wall", 2.5, 3.5]];
      for (const [role, dx, dy] of slots) {
        const x = tower.x + dx * dir, y = tower.y + dy * dir;
        if (buildings.some((b) => Math.hypot(b.x - x, b.y - y) < 0.4)) continue;
        if (canPlace(s, side, role, x, y) && issueCommand(s, side, { type: "build", ids: [builder.id], role, x, y })) break;
      }
    }
  }
  for (const gate of buildings.filter((b) => b.role === "gate" && b.progress === 1)) {
    const danger = s.entities.some((e) => isHostile(s, e.side, side) && alive(e) && isVisible(s, side, e.x, e.y) && distance2(e, gate) < 9);
    if (!!gate.gateOpen === danger) issueCommand(s, side, { type: "toggleGate", ids: [gate.id] });
  }
  const army = owned.filter((e) => e.kind === "unit" && e.role !== "worker" && !e.illusion);
  const visibleEnemy = s.entities.filter((e) => isHostile(s, e.side, side) && alive(e) && e.kind === "unit" && isVisible(s, side, e.x, e.y));
  const planned = [...army.filter((e) => !e.raised).map((e) => e.role), ...buildings.flatMap((e) => e.queue).filter((r) => r !== "worker")];
  const weights = { ...f.ai.composition, spear: visibleEnemy.some((e) => e.role === "cavalry") ? 0.28 : 0.1, cavalry: visibleEnemy.some((e) => e.role === "ranged") ? 0.25 : 0.16, siege: 0.18 };
  const roles = Object.keys(f.units).filter((r) => r !== "worker" && (f.units[r].age ?? 1) <= age);
  for (const b of buildings.filter((e) => e.role === "barracks" && e.progress === 1)) {
    if (age >= 2 && !b.research && army.length >= 5) for (const id2 of ["forged-weapons", "tempered-armor", "veteran-arms"]) {
      const d = UPGRADES[id2];
      if (!researchRequirement(s, side, id2) && p.wood > d.cost.wood + 180 && p.ore > d.cost.ore + 120) {
        issueCommand(s, side, { type: "research", id: b.id, upgrade: id2 });
        break;
      }
    }
    if (b.queue.length >= 2) continue;
    const nextAge = age === 1 ? "town-age" : age === 2 ? "citadel-age" : void 0;
    if (nextAge && army.length >= 7 && !hq.research && s.time > (age === 1 ? 150 : 380) && !visibleEnemy.some((e) => distance2(e, hq) < 14) && p.wood < UPGRADES[nextAge].cost.wood + 120) continue;
    const total = roles.reduce((n, r) => n + (weights[r] ?? 0.1), 0);
    const role = [...roles].sort((a, b2) => (planned.length + 1) * (weights[b2] ?? 0.1) / total - planned.filter((r) => r === b2).length - ((planned.length + 1) * (weights[a] ?? 0.1) / total - planned.filter((r) => r === a).length))[0];
    if (issueCommand(s, side, { type: "train", id: b.id, role })) planned.push(role);
  }
  for (const unit2 of army.filter((e) => unitDef(s, e).ability === "entrench")) {
    const target = enemy(s, unit2, unitDef(s, unit2).range + (unit2.role === "special" ? 3 : 0), true);
    if (target && unit2.entrenchedAt === void 0) issueCommand(s, side, { type: "ability", ids: [unit2.id] });
    else if (!target && unit2.entrenchedAt !== void 0) issueCommand(s, side, { type: "ability", ids: [unit2.id] });
  }
  const seen = s.entities.filter((e) => isHostile(s, e.side, side) && alive(e) && isVisible(s, side, e.x, e.y));
  const threat = seen.find((e) => distance2(e, hq) < 12);
  const rt = runtime(s);
  const remembered = rt.knownEnemyBuildings[side];
  for (const [id2, point2] of remembered) if (isVisible(s, side, point2.x, point2.y) && !seen.some((e) => e.id === id2)) remembered.delete(id2);
  for (const e of seen) if (e.kind === "building") remembered.set(e.id, { x: e.x, y: e.y, role: e.role });
  const enemySides = playerSides(s).filter((other) => isHostile(s, side, other) && !s.eliminated[other]);
  const enemySide = enemySides.sort((a, b) => distance2(hq, s.starts[a]) - distance2(hq, s.starts[b]))[0];
  if (enemySide === void 0) return;
  const enemyStart = s.starts[enemySide];
  if (isVisible(s, side, enemyStart.x, enemyStart.y) && !seen.some((e) => e.role === "hq" && distance2(e, enemyStart) < 4)) rt.clearedEnemyStarts[side].add(enemySide);
  rt.enemyStartCleared[side] = rt.clearedEnemyStarts[side].has(enemySide);
  if (age >= 2 && (s.mapSize === "large" || s.mapSize === "huge") && !rt.expansionScoutDispatched[side] && army.length >= 3) {
    const scout = army.find((e) => e.role === "cavalry") ?? army.find((e) => e.role === "melee");
    const x = Math.floor(s.width * 0.23) + 0.5, y = Math.floor(s.height * 0.58) + 0.5;
    if (scout && issueCommand(s, side, { type: "move", ids: [scout.id], x: s.starts[side].x < s.width / 2 ? x : s.width - x, y: s.starts[side].y < s.height / 2 ? y : s.height - y })) {
      rt.expansionScout[side] = scout.id;
      rt.expansionScoutDispatched[side] = true;
    }
  }
  if (rt.expansionScout[side] !== null && !army.some((e) => e.id === rt.expansionScout[side] && e.order.type === "move")) rt.expansionScout[side] = null;
  if (threat) {
    const ready = army.filter((e) => e.order.type !== "attack" && e.entrenchedAt === void 0);
    if (ready.length) issueCommand(s, side, { type: "attackMove", ids: ready.map((e) => e.id), x: threat.x, y: threat.y });
  } else if (army.length >= f.ai.armySize && s.time - rt.aiWave[side] > Math.max(25, 65 / f.ai.aggression)) {
    const target = seen.find((e) => e.kind === "building" && e.role === "hq") ?? [...remembered.values()].find((e) => e.role === "hq") ?? seen[0] ?? [...remembered.values()][0];
    let destination = target ?? enemyStart;
    if (!target && rt.enemyStartCleared[side]) {
      const origin = army[0], candidates = [];
      for (let y = 4.5; y < s.height - 3; y += 6) for (let x = 4.5; x < s.width - 3; x += 6) if (!isVisible(s, side, x, y) && !rt.searched[side].has(Math.floor(y) * s.width + Math.floor(x))) candidates.push({ x, y });
      if (candidates.length) {
        destination = candidates.sort((a, b) => distance2(origin, a) - distance2(origin, b))[0];
        rt.searched[side].add(Math.floor(destination.y) * s.width + Math.floor(destination.x));
      } else rt.searched[side].clear();
    }
    issueCommand(s, side, { type: "attackMove", ids: army.filter((e) => e.entrenchedAt === void 0 && e.id !== rt.expansionScout[side]).map((e) => e.id), x: destination.x, y: destination.y });
    rt.aiWave[side] = s.time;
  } else if (!rt.initialScoutDispatched[side] && s.time > 65 && army.length && army.every((e) => e.order.type === "idle")) {
    const scout = army[0];
    if (issueCommand(s, side, { type: "attackMove", ids: [scout.id], x: hq.x + (enemyStart.x - hq.x) * 0.7, y: hq.y + (enemyStart.y - hq.y) * 0.7 })) rt.initialScoutDispatched[side] = true;
  }
}

// src/core/saves.ts
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
export {
  captureRuntime,
  createMatch,
  isGameOver,
  isHostile,
  isVisible,
  playerAge,
  saveGame,
  stepGame,
  walkable
};
