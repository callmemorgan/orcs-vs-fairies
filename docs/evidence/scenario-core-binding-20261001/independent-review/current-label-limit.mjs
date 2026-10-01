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
var MATCH_START_DIRECTIONS = {
  3: [[-0.7071067811865476, -0.7071067811865476], [0.9659258262890683, -0.25881904510252074], [-0.25881904510252074, 0.9659258262890683]],
  4: [[-0.7071067811865476, -0.7071067811865476], [0.7071067811865476, -0.7071067811865476], [0.7071067811865476, 0.7071067811865476], [-0.7071067811865476, 0.7071067811865476]],
  5: [[-0.7071067811865476, -0.7071067811865476], [0.45399049973954686, -0.8910065241883678], [0.9876883405951378, 0.15643446504023087], [0.15643446504023087, 0.9876883405951378], [-0.8910065241883678, 0.45399049973954686]],
  6: [[-0.7071067811865476, -0.7071067811865476], [0.25881904510252074, -0.9659258262890683], [0.9659258262890683, -0.25881904510252074], [0.7071067811865476, 0.7071067811865476], [-0.25881904510252074, 0.9659258262890683], [-0.9659258262890683, 0.25881904510252074]],
  7: [[-0.7071067811865476, -0.7071067811865476], [0.11196447610330791, -0.9937122098932426], [0.8467241992282842, -0.5320320765153366], [0.9438833303083676, 0.33027906195516704], [0.33027906195516704, 0.9438833303083676], [-0.5320320765153366, 0.8467241992282842], [-0.9937122098932426, 0.11196447610330791]],
  8: [[-0.7071067811865476, -0.7071067811865476], [0, -1], [0.7071067811865476, -0.7071067811865476], [1, 0], [0.7071067811865476, 0.7071067811865476], [0, 1], [-0.7071067811865476, 0.7071067811865476], [-1, 0]]
};

// src/core/content.ts
var ECONOMY = { harvestPerSecond: 2.28 };
var unit = (id3, name, role, wood, ore, hp, damage, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id3, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building = (id3, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id: id3, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
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
var cavalryAbilities = { orcs: "impact-fury", fairies: "forest-leap", dwarves: "armored-brace", undead: "terror", tideborn: "wet-surge", automata: "shield-dash" };
var siegeAbilities = { orcs: "incendiary-shell", fairies: "rooting-shell", dwarves: "ammunition-cannon", undead: "corpse-shell", tideborn: "flood-shell", automata: "powered-beam" };
var FACTIONS = Object.fromEntries(Object.entries(BASE_FACTIONS).map(([id3, base]) => {
  const faction = id3, prefix = base.units.worker.id.split("-")[0], names = expansionNames[faction];
  return [id3, { ...base, buildings: {
    ...base.buildings,
    wall: { ...building(`${prefix}-wall`, "Stone Wall", "wall", 30, 25, 1100, 1, 15, "A durable barrier. Siege engines break walls quickly."), age: 2 },
    gate: { ...building(`${prefix}-gate`, "Town Gate", "gate", 90, 65, 1400, 2, 28, "Open to let armies pass. An open gate also admits enemies. Cannot close on a unit."), age: 2 }
  }, units: {
    ...base.units,
    special: { ...base.units.special, age: 2 },
    cavalry: { ...unit(`${prefix}-cavalry`, names[0], "cavalry", 100, 65, 210, 18, 2, 1.5, 3.5, 1.3, 42, void 0, "Fast raider. Strong against ranged troops; vulnerable to pikes."), age: 2, ability: cavalryAbilities[faction], ...faction === "automata" ? { shield: 60 } : {}, bonusAgainst: { ranged: 1.7 } },
    spear: { ...unit(`${prefix}-spear`, names[1], "spear", 55, 25, 125, 11, 1, 1.9, 2.1, 1.25, 28, void 0, "Long pike infantry. Deals triple damage to cavalry."), age: 1, bonusAgainst: { cavalry: 3 } },
    siege: { ...unit(`${prefix}-siege`, names[2], "siege", 180, 140, 185, 28, 2, 8.5, 1.05, 3.8, 65, void 0, "Long-range siege engine. Deals quadruple damage to buildings. Protect it from raiders."), age: 3, cost: { wood: 180, ore: 140, crystal: 25 }, buildingDamageMultiplier: 4, sight: 11, ability: siegeAbilities[faction] }
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
function factionStructureKind(id3) {
  return Object.keys(FACTION_STRUCTURE_INFO).find((kind) => FACTION_STRUCTURE_INFO[kind].definition.id === id3);
}

// src/core/specialist-content.ts
var commanders = { orcs: ["Gorak Ironvoice", "iron-command"], fairies: ["Queen Lyra", "queen-step"], dwarves: ["Thane Bera", "thane-ward"], undead: ["Morwen Ashseer", "soul-drain"], tideborn: ["Admiral Neri", "admiral-wave"], automata: ["Prime Artificer", "prime-shield"] };
function commander(faction) {
  const base = FACTIONS[faction].units.special, [name, ability] = commanders[faction];
  return { ...base, id: `core:${faction}-commander`, name, role: "special", cost: { wood: 150, ore: 110, crystal: 25 }, hp: 280, damage: 23, range: 4.5, speed: 2.2, trainTime: 25, age: 2, ability, tags: ["hero"], description: `${name} commands the ${FACTIONS[faction].name}. One commander per player. Defeated commanders can be recruited again after 30 seconds; recruitment pays the full cost.` };
}
function engineer(faction) {
  return { ...FACTIONS[faction].units.worker, id: `core:${faction}-engineer`, name: `${FACTIONS[faction].name} Engineer`, role: "special", cost: { wood: 75, ore: 40, crystal: 0 }, hp: 110, damage: 6, armor: 1, range: 1.3, speed: 2.2, trainTime: 18, sight: 8, age: 2, ability: void 0, tags: ["engineer"], description: "Builds temporary bridges and barricades, and repairs damaged siege engines or buildings at a resource cost." };
}
function beacon(faction) {
  return { id: `core:${faction}-beacon`, name: `${FACTIONS[faction].name} Signal Beacon`, role: "tower", cost: { wood: 80, ore: 35, crystal: 10 }, hp: 400, size: 1, buildTime: 16, sight: 15, age: 2, tags: ["beacon"], description: "An outpost linked within 12 tiles of your headquarters or another linked beacon shares sight with its team. Disconnected beacons stop granting distant vision." };
}
var BUILTIN_EXTRA_DEFINITIONS = Object.fromEntries(Object.keys(commanders).map((faction) => [faction, { units: [commander(faction), engineer(faction)], buildings: [beacon(faction), { id: "core:field-barricade", name: "Field Barricade", role: "wall", cost: { wood: 35, ore: 15, crystal: 0 }, hp: 350, size: 1, buildTime: 0, sight: 2, age: 2, tags: ["barricade"], description: "An engineer\u2019s temporary obstacle. It expires after 60 seconds." }] }]));
function svg(faction, kind) {
  const color = `#${FACTIONS[faction].color.toString(16).padStart(6, "0")}`;
  const drawing = kind === "beacon" ? '<path d="M48 108H80L75 44H53Z" fill="#607874"/><path d="M45 47L64 21L83 47Z" fill="#f5ca72"/><circle cx="64" cy="39" r="7" fill="#fff0b4"/>' : kind === "hero" ? '<path d="M36 43L47 22L59 36L71 22L82 43Z" fill="#f6d67e"/><circle cx="60" cy="54" r="14" fill="#e7cfad"/><path d="M43 66L75 66L86 108L32 108Z" fill="COLOR"/><path d="M37 72L18 91L31 98L48 80M75 70L101 94L95 103L64 79" fill="#a3b0ab"/>' : '<circle cx="60" cy="48" r="13" fill="#dfc19c"/><path d="M45 58L76 58L85 108H36Z" fill="COLOR"/><path d="M25 46L32 37L81 95L74 102Z" fill="#a2b5ad"/><path d="M15 31L27 23L40 42L29 52Z" fill="#d4d5c2"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><title>${FACTIONS[faction].name} ${kind}</title><ellipse cx="64" cy="112" rx="34" ry="8" fill="#152625" opacity=".3"/><g stroke="#203330" stroke-width="3" stroke-linejoin="round">${drawing.replaceAll("COLOR", color)}</g></svg>`;
}
var BUILTIN_EXTRA_ART = Object.fromEntries(Object.keys(commanders).flatMap((faction) => ["hero", "engineer", "beacon"].map((kind) => {
  const id3 = `core:${faction}-${kind === "hero" ? "commander" : kind}`;
  return [id3, { path: `/mods/core/${faction}-${kind}.svg`, svg: svg(faction, kind), width: 128, height: 128, anchor: [64, 112], visualTop: 20 }];
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
for (const [id3, drawing] of Object.entries(factionObjectDrawings)) BUILTIN_EXTRA_ART[id3] = { path: `/mods/core/${id3.slice(5)}.svg`, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#20332f" stroke-width="3">${drawing}</g></svg>`, width: 128, height: 128, anchor: [64, 112], visualTop: 10 };

// src/core/content-registry.ts
var CONTENT_ENGINE_VERSION = 3;
var MAX_BUNDLE_BYTES = 4 * 1024 * 1024;
var MAX_CONTENT_BYTES = 2 * 1024 * 1024;
var unitRoles = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var buildingRoles = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var builtinIds = Object.keys(FACTIONS);
var caches = /* @__PURE__ */ new WeakMap();
function fail(path, message3) {
  throw new Error(`Invalid content at ${path}: ${message3}.`);
}
function obj(input, path, required, optional = []) {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(path, "expected a plain object");
  const value = input;
  if (Object.getOwnPropertySymbols(value).length) fail(path, "symbol fields are unsupported");
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail(`${path}.${key}`, "accessors are unsupported");
  }
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "missing field");
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail(`${path}.${key}`, "unsupported field");
  return value;
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
  const value = str(v, path, 100);
  if (!/^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(value) || namespace && !value.startsWith(`${namespace}:`)) fail(path, `expected a namespaced definition ID${namespace ? ` owned by ${namespace}` : ""}`);
  return value;
}
function cost(v, path) {
  const value = obj(v, path, ["wood", "ore", "crystal"]);
  for (const key of ["wood", "ore", "crystal"]) num(value[key], `${path}.${key}`, 0, 1e5);
}
function unit2(v, path, namespace) {
  const value = obj(v, path, ["id", "name", "role", "cost", "hp", "damage", "armor", "range", "speed", "cooldown", "trainTime", "sight", "description"], ["shield", "buildingDamageMultiplier", "age", "bonusAgainst", "ability", "tags"]);
  definitionId(value.id, `${path}.id`, namespace);
  str(value.name, `${path}.name`);
  str(value.description, `${path}.description`, 2e3);
  one(value.role, `${path}.role`, unitRoles);
  cost(value.cost, `${path}.cost`);
  for (const [key, min, max] of [["hp", 1, 1e5], ["damage", 0, 1e4], ["armor", 0, 1e3], ["range", 0.5, 30], ["speed", 0.1, 10], ["cooldown", 0.05, 60], ["trainTime", 0.05, 600], ["sight", 1, 30]]) num(value[key], `${path}.${key}`, min, max);
  if (value.shield !== void 0) num(value.shield, `${path}.shield`, 0, 1e5);
  if (value.buildingDamageMultiplier !== void 0) num(value.buildingDamageMultiplier, `${path}.buildingDamageMultiplier`, 0.1, 10);
  if (value.age !== void 0) num(value.age, `${path}.age`, 1, 3, true);
  if (value.ability !== void 0) {
    one(value.ability, `${path}.ability`, Object.keys(ABILITIES));
    if (["incendiary-shell", "rooting-shell", "ammunition-cannon", "corpse-shell", "flood-shell", "powered-beam"].includes(value.ability) && value.role !== "siege") fail(`${path}.ability`, "artillery preparation requires the siege role");
  }
  if (value.tags !== void 0) arr(value.tags, `${path}.tags`, 2).forEach((tag, i) => one(tag, `${path}.tags[${i}]`, ["hero", "engineer"]));
  if (value.bonusAgainst !== void 0) {
    const bonuses = obj(value.bonusAgainst, `${path}.bonusAgainst`, [], unitRoles);
    for (const [key, factor] of Object.entries(bonuses)) num(factor, `${path}.bonusAgainst.${key}`, 0.1, 10);
  }
}
function building2(v, path, namespace) {
  const value = obj(v, path, ["id", "name", "role", "cost", "hp", "size", "buildTime", "sight", "description"], ["age", "ability", "tags"]);
  definitionId(value.id, `${path}.id`, namespace);
  str(value.name, `${path}.name`);
  str(value.description, `${path}.description`, 2e3);
  one(value.role, `${path}.role`, buildingRoles);
  cost(value.cost, `${path}.cost`);
  for (const [key, min, max] of [["hp", 1, 1e5], ["size", 1, 6], ["buildTime", 0.05, 600], ["sight", 1, 30]]) num(value[key], `${path}.${key}`, min, max, key === "size");
  if (value.tags !== void 0) arr(value.tags, `${path}.tags`, 2).forEach((tag, i) => one(tag, `${path}.tags[${i}]`, ["beacon", "barricade"]));
  if (value.age !== void 0) num(value.age, `${path}.age`, 1, 3, true);
  if (value.ability !== void 0) one(value.ability, `${path}.ability`, ["heal"]);
}
function research(v, path, namespace) {
  const value = obj(v, path, ["id", "name", "description", "cost", "researchTime", "building", "appliesTo", "effects"], ["age", "requires", "exclusiveGroup", "appliesToDefinitions"]);
  definitionId(value.id, `${path}.id`, namespace);
  str(value.name, `${path}.name`);
  str(value.description, `${path}.description`, 2e3);
  cost(value.cost, `${path}.cost`);
  num(value.researchTime, `${path}.researchTime`, 0.05, 600);
  one(value.building, `${path}.building`, buildingRoles);
  one(value.appliesTo, `${path}.appliesTo`, unitRoles);
  if (value.age !== void 0) num(value.age, `${path}.age`, 1, 3, true);
  if (value.requires !== void 0) arr(value.requires, `${path}.requires`, 16).forEach((id3, i) => str(id3, `${path}.requires[${i}]`, 100));
  if (value.exclusiveGroup !== void 0) definitionId(value.exclusiveGroup, `${path}.exclusiveGroup`, namespace);
  if (value.appliesToDefinitions !== void 0) {
    const targets = arr(value.appliesToDefinitions, `${path}.appliesToDefinitions`, 64);
    if (!targets.length) fail(`${path}.appliesToDefinitions`, "at least one definition target is required");
    targets.forEach((id3, i) => str(id3, `${path}.appliesToDefinitions[${i}]`, 100));
    if (new Set(targets).size !== targets.length) fail(`${path}.appliesToDefinitions`, "duplicate definition target");
  }
  const effects = obj(value.effects, `${path}.effects`, [], ["gather", "speed", "damage", "armor"]);
  if (!Object.keys(effects).length) fail(`${path}.effects`, "research must change a permitted stat");
  for (const [key, factor] of Object.entries(effects)) num(factor, `${path}.effects.${key}`, key === "armor" ? 0 : 0.1, key === "armor" ? 10 : 3);
}
function canonicalContent(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalContent).join(",")}]`;
  return `{${Object.keys(value).filter((key) => value[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonicalContent(value[key])}`).join(",")}}`;
}
function contentHash(value) {
  const bytes = new TextEncoder().encode(canonicalContent(value)), length2 = bytes.length;
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
  return h.map((value2) => (value2 >>> 0).toString(16).padStart(8, "0")).join("");
}
var BASE_CONTENT_HASH = contentHash({ FACTIONS, UPGRADES, ECONOMY, ABILITIES, BUILTIN_EXTRA_DEFINITIONS, BUILTIN_EXTRA_ART });
function unsigned(input) {
  const { hash: _, ...value } = input;
  return value;
}
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
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
  const factions = arr(p.factions, "package.factions", 16);
  if (!factions.length) fail("package.factions", "at least one faction is required");
  factions.forEach((v, i) => {
    const path = `package.factions[${i}]`, f = obj(v, path, ["id", "baseFaction", "name", "subtitle", "description", "color", "accent", "units", "buildings", "research"], ["defaultUnits", "defaultBuildings"]);
    definitionId(f.id, `${path}.id`, namespace);
    one(f.baseFaction, `${path}.baseFaction`, builtinIds);
    for (const key of ["name", "subtitle", "description"]) str(f[key], `${path}.${key}`, key === "description" ? 2e3 : 200);
    num(f.color, `${path}.color`, 0, 16777215, true);
    if (!/^#[a-fA-F0-9]{6}$/.test(str(f.accent, `${path}.accent`, 7))) fail(`${path}.accent`, "expected a six-digit color");
    arr(f.units, `${path}.units`, 64).forEach((v2, j) => unit2(v2, `${path}.units[${j}]`, namespace));
    arr(f.buildings, `${path}.buildings`, 32).forEach((v2, j) => building2(v2, `${path}.buildings[${j}]`, namespace));
    arr(f.research, `${path}.research`, 64).forEach((v2, j) => research(v2, `${path}.research[${j}]`, namespace));
    for (const [field, roles2] of [["defaultUnits", unitRoles], ["defaultBuildings", buildingRoles]]) if (f[field] !== void 0) {
      const defaults = obj(f[field], `${path}.${field}`, [], roles2);
      for (const [role, id3] of Object.entries(defaults)) definitionId(id3, `${path}.${field}.${role}`);
    }
  });
  const art = obj(p.art, "package.art", [], Object.keys(p.art && typeof p.art === "object" ? p.art : {}));
  if (Object.keys(art).length > 128) fail("package.art", "too many assets");
  let pixels = 0;
  for (const [id3, input2] of Object.entries(art)) {
    definitionId(id3, `package.art.${id3}`, namespace);
    const a = obj(input2, `package.art.${id3}`, ["path", "svg", "width", "height", "anchor"], ["visualTop"]);
    const path = str(a.path, `package.art.${id3}.path`, 300);
    if (!/^\/mods\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(path) || !path.startsWith(`/mods/${namespace}/`)) fail(`package.art.${id3}.path`, "expected a packaged SVG under its own /mods directory");
    if (typeof a.svg !== "string" || a.svg.length > 1e5 || !a.svg.trim()) fail(`art.${id3}.svg`, "expected SVG source under 100000 characters");
    const svg2 = a.svg;
    if (!/^<svg\s/.test(svg2) || !/<\/svg>\s*$/.test(svg2) || /<(?:script|foreignObject|iframe|image|use|a|style|animate|set)\b|\bon[a-z]+\s*=|\bhref\s*=|\bstyle\s*=|&#|url\s*\(|<!|<\?/i.test(svg2.replace(/url\(#[a-zA-Z][a-zA-Z0-9-]*\)/g, ""))) fail(`art.${id3}.svg`, "only self-contained static SVG is permitted");
    for (const tag of svg2.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g)) if (!["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc", "defs", "linearGradient", "radialGradient", "stop"].includes(tag[1])) fail(`art.${id3}.svg`, `unsupported SVG element ${tag[1]}`);
    num(a.width, `art.${id3}.width`, 8, 512, true);
    num(a.height, `art.${id3}.height`, 8, 512, true);
    pixels += a.width * a.height;
    if (pixels > 4 * 1024 * 1024) fail("package.art", "decoded artwork exceeds 16 MiB");
    const anchor = arr(a.anchor, `art.${id3}.anchor`, 2);
    if (anchor.length !== 2) fail(`art.${id3}.anchor`, "expected two coordinates");
    num(anchor[0], `art.${id3}.anchor[0]`, 0, a.width);
    num(anchor[1], `art.${id3}.anchor[1]`, 0, a.height);
    if (a.visualTop !== void 0) num(a.visualTop, `art.${id3}.visualTop`, 0, a.height);
  }
  if (!/^[a-f0-9]{64}$/.test(str(p.hash, "package.hash", 64)) || p.hash !== contentHash(unsigned(p))) fail("package.hash", "SHA-256 does not match the manifest");
  if (new TextEncoder().encode(canonicalContent(p)).length > MAX_CONTENT_BYTES) fail("package", "file exceeds 2 MiB");
  return freeze(JSON.parse(JSON.stringify(p)));
}
var PINNED_BASE_FACTIONS = freeze(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS).map(([id3, f]) => [id3, { ...f, unitDefinitions: [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[id3].units], buildingDefinitions: [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[id3].buildings] }])))));
var PINNED_BASE_RESEARCH = freeze(JSON.parse(JSON.stringify(UPGRADES)));
function buildRegistry(packages) {
  const factions = { ...PINNED_BASE_FACTIONS }, art = { ...BUILTIN_EXTRA_ART }, ids = /* @__PURE__ */ new Set(), byId = new Map(packages.map((p) => [p.id, p]));
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
    if (ids.has(f.id) || Object.hasOwn(factions, f.id)) fail("definitions", `duplicate ${f.id}`);
    ids.add(f.id);
    const base = PINNED_BASE_FACTIONS[f.baseFaction], units = { ...base.units }, buildings2 = { ...base.buildings };
    for (const d of [...f.units, ...f.buildings, ...f.research]) {
      if (ids.has(d.id)) fail("definitions", `duplicate ${d.id}`);
      ids.add(d.id);
    }
    for (const [role, id3] of Object.entries(f.defaultUnits ?? {})) {
      const d = f.units.find((d2) => d2.id === id3);
      if (!d || d.role !== role) fail("defaultUnits", `${id3} is absent or has another role`);
      units[role] = d;
    }
    for (const [role, id3] of Object.entries(f.defaultBuildings ?? {})) {
      const d = f.buildings.find((d2) => d2.id === id3);
      if (!d || d.role !== role) fail("defaultBuildings", `${id3} is absent or has another role`);
      buildings2[role] = d;
    }
    const targetUnits = [...Object.values(units), ...f.units];
    for (const research2 of f.research) for (const id3 of research2.appliesToDefinitions ?? []) {
      const target = targetUnits.find((unit3) => unit3.id === id3);
      if (!target || target.role !== research2.appliesTo) fail("research.appliesToDefinitions", `${id3} is absent or has another role`);
    }
    const available = new Map([...Object.values(PINNED_BASE_RESEARCH), ...f.research].map((d) => [d.id, d])), done = /* @__PURE__ */ new Set(), pending = /* @__PURE__ */ new Set();
    const check = (id3) => {
      if (pending.has(id3)) fail("research", `prerequisite cycle includes ${id3}`);
      if (done.has(id3)) return;
      const d = available.get(id3);
      if (!d) fail("research", `missing prerequisite ${id3}`);
      pending.add(id3);
      for (const dep of d.requires ?? []) check(dep);
      pending.delete(id3);
      done.add(id3);
    };
    f.research.forEach((d) => check(d.id));
    for (const d of [...f.units, ...f.buildings]) if (!Object.hasOwn(p.art, d.id)) fail("art", `missing custom artwork for ${d.id}`);
    factions[f.id] = freeze({ ...base, ...f, units, buildings: buildings2, unitDefinitions: [...Object.values(units), ...(base.unitDefinitions ?? []).filter((d) => !Object.values(base.units).some((x) => x.id === d.id)), ...f.units.filter((d) => !Object.values(units).some((base2) => base2.id === d.id))], buildingDefinitions: [...Object.values(buildings2), ...(base.buildingDefinitions ?? []).filter((d) => !Object.values(base.buildings).some((x) => x.id === d.id)), ...f.buildings.filter((d) => !Object.values(buildings2).some((base2) => base2.id === d.id))], research: f.research });
    Object.assign(art, p.art);
  }
  if (Object.values(art).reduce((sum, a) => sum + a.width * a.height, 0) > 16 * 1024 * 1024) fail("bundle.art", "decoded artwork exceeds 64 MiB");
  return freeze({ factions, art });
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
  const value = obj(input, "bundle", ["format", "schemaVersion", "engineVersion", "baseHash", "packages", "hash"]);
  if (value.format !== "orcs-vs-fairies-content" || value.schemaVersion !== 1 || value.engineVersion !== CONTENT_ENGINE_VERSION) fail("bundle", "unsupported content version");
  if (value.baseHash !== BASE_CONTENT_HASH) fail("bundle.baseHash", "built-in content differs from this build");
  const bundle = createContentBundle(arr(value.packages, "bundle.packages", 32));
  if (value.hash !== bundle.hash) fail("bundle.hash", "SHA-256 does not match admitted packages");
  return bundle;
}
function registry(state) {
  if (!state.content) return { factions: FACTIONS, art: BUILTIN_EXTRA_ART };
  let value = caches.get(state.content);
  if (!value) {
    const admitted = decodeContentBundle(state.content);
    value = caches.get(admitted);
    caches.set(state.content, value);
  }
  return value;
}
function contentFactions(content) {
  return content ? registry({ content }).factions : PINNED_BASE_FACTIONS;
}
function factionFor(state, side) {
  const faction = registry(state).factions[state.players[side]?.faction];
  if (!faction) throw new Error("Faction is absent from pinned match content.");
  return faction;
}
function availableUnits(state, side) {
  const f = factionFor(state, side);
  return [...f.unitDefinitions ?? [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.units ?? []]];
}
function isNormalBuildingDefinition(def) {
  return !def.tags?.includes("barricade") && def.id !== "core:orcs-trophy-standard" && !factionStructureKind(def.id);
}
function availableBuildings(state, side) {
  const f = factionFor(state, side);
  return [...f.buildingDefinitions ?? [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.buildings ?? []]];
}
function unitFor(state, subject, role, id3) {
  const side = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition3 = typeof subject === "number" ? id3 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side);
  if (!f) throw new Error("Original unit faction is absent from pinned content.");
  const value = definition3 ? (f.unitDefinitions ?? [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.units ?? []]).find((d) => d.id === definition3) : f.units[kind];
  if (!value || value.role !== kind) throw new Error(`Unit definition ${definition3 ?? kind} is absent from faction ${f.id}.`);
  return value;
}
function buildingFor(state, subject, role, id3) {
  const side = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition3 = typeof subject === "number" ? id3 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side);
  if (!f) throw new Error("Original building faction is absent from pinned content.");
  const value = definition3 ? (f.buildingDefinitions ?? [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.buildings ?? []]).find((d) => d.id === definition3) : f.buildings[kind];
  if (!value || value.role !== kind) throw new Error(`Building definition ${definition3 ?? kind} is absent from faction ${f.id}.`);
  return value;
}
function entityDefinition(state, entity) {
  return entity.kind === "unit" ? unitFor(state, entity) : buildingFor(state, entity);
}
function upgradesFor(state, side) {
  return { ...state.content ? PINNED_BASE_RESEARCH : UPGRADES, ...Object.fromEntries((factionFor(state, side).research ?? []).map((d) => [d.id, d])) };
}
function upgradeFor(state, side, id3) {
  const d = upgradesFor(state, side)[id3];
  if (!d) throw new Error(`Research ${id3} is absent from faction content.`);
  return d;
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
function creditCombat(s, attacker, target, amount, killed = false) {
  if (!eligible(attacker) || attacker.hp <= 0 || target.illusion || target.raised || s.teams[attacker.side] === s.teams[target.side] || amount <= 0 && !killed) return;
  award(s, attacker, Math.min(30, amount * 0.3) + (killed ? target.kind === "building" ? 25 : target.role === "worker" ? 8 : 18 : 0));
}
function promotionChoices(s, e) {
  if (!e.veteran?.pendingPromotion) return [];
  return Object.keys(PROMOTIONS).filter((id3) => PROMOTIONS[id3].roles.includes(unitFor(s, e).role));
}
function promote(s, side, id3, promotion) {
  const e = s.entities.find((e2) => e2.id === id3 && e2.side === side && e2.hp > 0), v = e?.veteran;
  if (!e || !eligible(e) || !v?.pendingPromotion || !promotionChoices(s, e).includes(promotion)) return false;
  v.promotions.push({ rank: v.pendingPromotion, id: promotion });
  delete v.pendingPromotion;
  const next = [1, 2, 3].find((rank) => rank <= v.rank && !v.promotions.some((p) => p.rank === rank));
  if (next) v.pendingPromotion = next;
  s.events.push({ type: "message", side, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, source: e.id, text: `${unitFor(s, e).name} promoted to ${PROMOTIONS[promotion].name}.` });
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
function recoverArtifact(s, side, id3, artifact) {
  const e = s.entities.find((e2) => e2.id === id3 && e2.side === side && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact);
  if (!e || !equipmentEligible(s, e) || !item?.position || item.holder !== void 0 || item.owner !== void 0 && item.owner !== side || (e.level ?? 0) !== (item.position.level ?? 0) || (s.specialists?.artifacts.filter((a) => a.holder === e.id).length ?? 0) >= 12 || length2D(e.x - item.position.x, e.y - item.position.y) > 2) return false;
  const tile = (item.position.level ?? 0) * s.width * s.height + Math.floor(item.position.y) * s.width + Math.floor(item.position.x);
  if (!s.visible[side].has(tile)) return false;
  item.owner = side;
  item.holder = e.id;
  delete item.position;
  return true;
}
function equipArtifact(s, side, id3, artifact) {
  const e = s.entities.find((e2) => e2.id === id3 && e2.side === side && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact), def = item ? ARTIFACTS[item.definitionId] : void 0;
  if (!e || !equipmentEligible(s, e) || !item || !def || item.owner !== side || item.holder !== e.id || !def.roles.includes(unitFor(s, e).role)) return false;
  e.equipment ??= {};
  e.equipment[def.slot] = artifact;
  return true;
}
function unequipArtifact(s, side, id3, slot) {
  const e = s.entities.find((e2) => e2.id === id3 && e2.side === side && e2.hp > 0);
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
function dropArtifact(s, side, id3, artifact) {
  const e = s.entities.find((e2) => e2.id === id3 && e2.side === side && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact);
  if (!e || !equipmentEligible(s, e) || !item || item.owner !== side || item.holder !== e.id) return false;
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

// src/core/commands.ts
var roles = ["worker", "melee", "ranged", "special", "spear", "cavalry", "siege"];
var buildings = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var id = (v) => Number.isSafeInteger(v) && v > 0;
var index = (v) => Number.isSafeInteger(v) && v >= 0;
var definition = (v) => v === void 0 || typeof v === "string" && /^[a-z][a-z0-9:-]{0,99}$/.test(v);
var finite = (v) => typeof v === "number" && Number.isFinite(v);
var keys = (o, allowed) => Object.keys(o).every((k) => allowed.includes(k));
function validateCommand(v) {
  if (!record(v) || typeof v.type !== "string") return false;
  const queued = ["move", "attackMove", "attack", "gather", "repair"].includes(v.type);
  if ("queued" in v && (!queued || typeof v.queued !== "boolean")) return false;
  if (v.type === "draftChoice") return keys(v, ["type", "definitionId"]) && typeof v.definitionId === "string" && v.definitionId.length > 0 && v.definitionId.length <= 128;
  if (v.type === "collectRelic") return keys(v, ["type", "id", "relicId"]) && id(v.id) && id(v.relicId);
  if (v.type === "dropRelic") return keys(v, ["type", "id"]) && id(v.id);
  const allowed = (fields2) => keys(v, queued ? [...fields2, "queued"] : fields2);
  if (v.type === "cancelTrain") return allowed(["type", "id", "index"]) && id(v.id) && index(v.index);
  if (v.type === "reorderTrain") return allowed(["type", "id", "from", "to"]) && id(v.id) && index(v.from) && index(v.to);
  if (v.type === "train") return allowed(["type", "id", "role", "definitionId"]) && id(v.id) && roles.includes(v.role) && definition(v.definitionId);
  if (v.type === "research") return allowed(["type", "id", "upgrade"]) && id(v.id) && typeof v.upgrade === "string" && (Object.hasOwn(UPGRADES, v.upgrade) || /^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(v.upgrade));
  if (v.type === "promote") return allowed(["type", "id", "promotion"]) && id(v.id) && typeof v.promotion === "string" && Object.hasOwn(PROMOTIONS, v.promotion);
  if (["recoverArtifact", "equipArtifact", "dropArtifact"].includes(v.type)) return allowed(["type", "id", "artifact"]) && id(v.id) && id(v.artifact);
  if (v.type === "unequipArtifact") return allowed(["type", "id", "slot"]) && id(v.id) && ["weapon", "armor", "trinket"].includes(v.slot);
  if (v.type === "fieldRepair") return allowed(["type", "id", "target"]) && id(v.id) && id(v.target);
  if (!Array.isArray(v.ids) || !v.ids.length || v.ids.length > 100 || !v.ids.every(id)) return false;
  if (["stop", "hold", "clearRally", "toggleGate"].includes(v.type)) return allowed(["type", "ids"]);
  if (["move", "attackMove", "setRally", "ignite", "firebreak"].includes(v.type)) return allowed(["type", "ids", "x", "y", "level"]) && finite(v.x) && finite(v.y) && (v.level === void 0 || Number.isInteger(v.level) && v.level >= 0 && v.level <= 1);
  if (v.type === "traverse") return allowed(["type", "ids", "transition"]) && id(v.transition);
  if (["worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"].includes(v.type)) return allowed(["type", "ids", "target"]) && id(v.target);
  if (v.type === "ability") return allowed(["type", "ids", "x", "y", "level", "target"]) && (!("target" in v) || id(v.target)) && (!("level" in v) || index(v.level) && v.level <= 1) && (!("x" in v) && !("y" in v) || finite(v.x) && finite(v.y)) && (!("x" in v || "y" in v) || !("target" in v));
  if (v.type === "engineerBuild") return allowed(["type", "ids", "kind", "x", "y", "level"]) && ["bridge", "barricade"].includes(v.kind) && finite(v.x) && finite(v.y) && (!("level" in v) || index(v.level) && v.level <= 1);
  if (["attack", "gather", "repair"].includes(v.type)) return allowed(["type", "ids", "target"]) && id(v.target);
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
  let value = seed >>> 0;
  return () => {
    value = value + 1831565813 >>> 0;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function terrainAt(map, x, y, level = 0) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "rock";
  return (level === 0 ? map.terrain : map.world?.levels[level]?.terrain)?.[Math.floor(y) * map.width + Math.floor(x)] ?? "rock";
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
  const addResource = (point2, kind, amount) => {
    if (map.resources.some((r) => length2D(point2.x - r.x, point2.y - r.y) < 2.05)) throw new Error("Multiplayer resource clusters overlap.");
    map.resources.push({ ...point2, kind, amount, maxAmount: amount });
    paintDisk(point2, 1.75, "grass");
  };
  for (const start of map.starts) {
    const dir = start.y < height / 2 ? 1 : -1;
    for (const [dx, dy, kind, amount] of [[-4, 4, "wood", 2600], [-2, 6, "wood", 2600], [-5, 1, "wood", 2600], [5, -3, "ore", 2800], [6, 0, "ore", 2800], [5, 4, "crystal", 180]]) addResource({ x: start.x + dx * dir, y: start.y + dy * dir }, kind, amount);
  }
  for (const start of map.starts) {
    const dx = start.x - center.x, dy = start.y - center.y, length2 = length2D(dx, dy), outward = { x: dx / length2, y: dy / length2 }, tangent = { x: -outward.y, y: outward.x };
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
  const { width, height, starts, resources: resources2, terrain: terrain2 } = map, issues = [];
  if (terrain2.length !== width * height) issues.push("Terrain dimensions do not match.");
  if (!starts.length || starts.length > 8) issues.push("Starting positions must number 1 through 8.");
  if (starts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 2.5 || p.y < 2.5 || p.x > width - 2.5 || p.y > height - 2.5)) issues.push("Starting positions lie outside the playable map.");
  const free = (x, y) => x >= 0 && y >= 0 && x < width && y < height && TERRAIN[terrain2[y * width + x] ?? "rock"].walkable && !resources2.some((r) => r.amount > 0 && length2D(r.x - x - 0.5, r.y - y - 0.5) < 0.7) && !starts.some((p) => Math.abs(p.x - x - 0.5) < 1.77 && Math.abs(p.y - y - 0.5) < 1.77);
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
  for (const r of resources2) {
    let reached = false;
    for (let y = Math.floor(r.y) - 1; y <= Math.floor(r.y) + 1; y++) for (let x = Math.floor(r.x) - 1; x <= Math.floor(r.x) + 1; x++) if (seen.has(y * width + x) && length2D(x + 0.5 - r.x, y + 0.5 - r.y) <= 1.25) reached = true;
    if (reached) reachableResources++;
    else issues.push(`Unreachable ${r.kind} at ${r.x},${r.y}.`);
  }
  for (const start of starts) for (const kind of ["wood", "ore", "crystal"]) if (!resources2.some((r) => r.kind === kind && length2D(r.x - start.x, r.y - start.y) < 9)) issues.push(`Missing starting ${kind}.`);
  if (starts.length === 2) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain2[y * width + x] !== terrain2[(height - 1 - y) * width + width - 1 - x]) {
      issues.push("Terrain is not symmetric.");
      break;
    }
    for (const r of resources2) if (!resources2.some((q) => q.kind === r.kind && q.amount === r.amount && q.x === width - r.x && q.y === height - r.y)) issues.push("Resource pair is not symmetric.");
  }
  return { valid: issues.length === 0, issues, reachableResources, totalResources: resources2.length, reachableTiles: seen.size, startsConnected };
}

// src/core/world-map.ts
var BIOMES = ["temperate", "desert", "marsh", "snow", "forest"];
var levelOf = (point2) => point2.level ?? 0;
var sameLevel = (a, b) => levelOf(a) === levelOf(b);
var fogKey = (s, point2) => levelOf(point2) * s.width * s.height + Math.floor(point2.y) * s.width + Math.floor(point2.x);
function elevationAt(s, point2) {
  if (point2.x < 0 || point2.y < 0 || point2.x >= s.width || point2.y >= s.height) return 0;
  return s.world?.levels[levelOf(point2)]?.elevation[Math.floor(point2.y) * s.width + Math.floor(point2.x)] ?? 0;
}
function highGroundDamageFactor(s, source, target) {
  return 1 + 0.12 * Math.max(0, Math.min(3, elevationAt(s, source) - elevationAt(s, target)));
}
function highGroundSightBonus(s, source) {
  return 0.75 * Math.min(3, elevationAt(s, source));
}
function setWorldTerrain(s, point2, kind) {
  const level = levelOf(point2), tile = Math.floor(point2.y) * s.width + Math.floor(point2.x), terrain2 = level === 0 ? s.terrain : s.world?.levels[level]?.terrain;
  if (!Object.hasOwn(TERRAIN, kind) || !terrain2 || point2.x < 0 || point2.y < 0 || point2.x >= s.width || point2.y >= s.height) return false;
  if (terrain2[tile] === kind) return true;
  terrain2[tile] = kind;
  if (s.world) {
    s.world.levels[level].terrain[tile] = kind;
    s.world.revision = (s.world.revision ?? 0) + 1;
    for (const creature of s.world.creatures) if (levelOf(creature) === level) creature.path = [];
  }
  for (const entity of s.entities) if (levelOf(entity) === level) entity.path = [];
  return true;
}
function terrainLineOfSight(s, from, to) {
  if (!sameLevel(from, to)) return false;
  if (!s.world) return true;
  const source = elevationAt(s, from), target = elevationAt(s, to), length2 = length2D(to.x - from.x, to.y - from.y), steps = Math.ceil(length2 * 3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, level: levelOf(from) };
    const terrain2 = s.world.levels[p.level].terrain[Math.floor(p.y) * s.width + Math.floor(p.x)];
    if (terrain2 === "rock" || elevationAt(s, p) > Math.max(source, target) + 0.5) return false;
  }
  return true;
}
function validateWorldMap(value, options = {}) {
  const issues = [], record3 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!record3(value)) return { valid: false, issues: ["Map must be an object."] };
  const map = value;
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 8 || map.height < 8 || map.width > 128 || map.height > 128) return { valid: false, issues: ["Map dimensions must be integers from8 through128."] };
  if (!Number.isSafeInteger(map.seed) || map.seed < 0 || map.seed > 4294967295) issues.push("Map seed must be an unsigned32-bit integer.");
  if (!["small", "medium", "large", "huge"].includes(map.size)) issues.push("Unknown map size.");
  if (!Array.isArray(map.levels) || map.levels.length < 1 || map.levels.length > 2) return { valid: false, issues: [...issues, "Maps require one or two levels."] };
  const area = map.width * map.height, point2 = (p) => record3(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isInteger(p.level) && p.level >= 0 && p.level < map.levels.length && p.x >= 0.5 && p.y >= 0.5 && p.x <= map.width - 0.5 && p.y <= map.height - 0.5;
  for (let l = 0; l < map.levels.length; l++) {
    const level = map.levels[l];
    if (!record3(level) || level.id !== l || typeof level.title !== "string" || level.title.length > 80) issues.push(`Invalid level${l} title or identifier.`);
    if (!Array.isArray(level?.terrain) || level.terrain.length !== area || level.terrain.some((t) => !Object.hasOwn(TERRAIN, t))) issues.push(`Level${l} terrain must contain one valid tile per map cell.`);
    if (!Array.isArray(level?.elevation) || level.elevation.length !== area || level.elevation.some((e) => !Number.isInteger(e) || e < 0 || e > 3)) issues.push(`Level${l} elevation must contain integers0 through3.`);
  }
  if (issues.some((i) => i.includes("terrain") || i.includes("elevation"))) return { valid: false, issues };
  if (!Array.isArray(map.starts) || map.starts.length < 1 || map.starts.length > 8 || map.starts.some((p, i) => !point2(p) || p.slot !== i)) issues.push("Starting slots must be ordered0 through7 with valid coordinates.");
  if (!Array.isArray(map.resources) || map.resources.length > 2048 || map.resources.some((r) => !point2(r) || !["wood", "ore", "crystal"].includes(r.kind) || !Number.isFinite(r.amount) || !Number.isFinite(r.maxAmount) || r.amount < 0 || r.amount > r.maxAmount || r.maxAmount > 1e9)) issues.push("Invalid resource nodes.");
  if (!Array.isArray(map.sites) || map.sites.length > 128 || map.sites.some((p) => !point2(p) || !Number.isSafeInteger(p.id) || p.id < 1 || !["relic", "village", "monster"].includes(p.kind)) || new Set(map.sites?.map((p) => p.id)).size !== map.sites?.length) issues.push("Invalid or duplicate site definitions.");
  if (!Array.isArray(map.transitions) || map.transitions.length > 64 || map.transitions.some((t) => !record3(t) || !Number.isSafeInteger(t.id) || t.id < 1 || !point2(t.from) || !point2(t.to) || t.from.level === t.to.level) || new Set(map.transitions?.map((t) => t.id)).size !== map.transitions?.length) issues.push("Invalid or duplicate level entrances.");
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
  const starts = base.starts.map((p, slot) => ({ ...p, level: 0, slot })), resources2 = base.resources.map((r) => ({ ...r, level: 0 }));
  const basePad = (x, y) => starts.some((p) => length2D(p.x - x, p.y - y) < 8.4);
  const kind = biome === "desert" ? "sand" : biome === "snow" ? "snow" : biome === "marsh" ? "mud" : "grass";
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (terrain2[i] !== "grass" || basePad(x + 0.5, y + 0.5)) continue;
    terrain2[i] = kind;
    const canonical = Math.min(i, area - 1 - i), noise = (Math.imul(seed ^ canonical ^ 2436741650, 2246822507) >>> 0) % 100;
    if (biome === "forest" && noise < 24 && !resources2.some((r) => length2D(r.x - x - 0.5, r.y - y - 0.5) < 2)) terrain2[i] = "forest";
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
  for (const [dx, dy, resource, amount] of [[0, -5, "crystal", 1800], [-4, 4, "ore", 3600], [4, 4, "wood", 3e3]]) resources2.push({ x: center.x + dx, y: center.y + dy, level: 1, kind: resource, amount, maxAmount: amount });
  const result = { width, height, size: base.size, seed, levels: [{ id: 0, title: `${biome[0].toUpperCase()}${biome.slice(1)} surface`, terrain: terrain2, elevation }, { id: 1, title: "Contested caverns", terrain: underground, elevation: caveElevation }], starts, resources: resources2, sites, transitions };
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
  const world = { version: 1, revision: 0, biome, levels: input.levels.map((l) => ({ ...l, terrain: [...l.terrain], elevation: [...l.elevation] })), transitions: input.transitions.map((t) => ({ id: t.id, from: { ...t.from }, to: { ...t.to } })), bridges: [], fires: [], sites: input.sites.map((site) => ({ ...site, id: s.nextId++, owner: null, loyalty: s.players.map(() => 0), progress: 0, capturing: null, reward: { wood: 180, ore: 100, crystal: 40 }, rewarded: [], request: { wood: 80, ore: 20, crystal: 0 }, supplied: false, creatureIds: [], respawnAt: 0 })), creatures: [], dayLength: 180, seasonLength: 240, weatherLength: 45, nextEnvironmentAt: 0, iceTiles: [], thawWarned: false };
  world.levels[0].terrain = s.terrain;
  s.world = world;
  for (const level of world.levels) {
    const visited = /* @__PURE__ */ new Set();
    for (let tile = 0; tile < level.terrain.length; tile++) {
      if (level.terrain[tile] !== "bridge" || visited.has(tile)) continue;
      const queue = [tile];
      visited.add(tile);
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i], x = p % s.width, y = Math.floor(p / s.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * s.width + nx;
          if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height || level.terrain[j] !== "bridge" || visited.has(j)) continue;
          visited.add(j);
          queue.push(j);
        }
      }
      const center = queue[Math.floor(queue.length / 2)];
      world.bridges.push({ id: s.nextId++, x: center % s.width + 0.5, y: Math.floor(center / s.width) + 0.5, level: level.id, hp: Math.max(160, queue.length * 25), maxHp: Math.max(160, queue.length * 25), tiles: queue, rebuilding: 0, repairSide: null });
    }
  }
  return world;
}

// src/core/navigation.ts
var buildingRadius = (s, e) => buildingFor(s, e).size / 2 + 0.27;
function walkable(s, x, y, level = 0) {
  if (x < 0.35 || y < 0.35 || x > s.width - 0.35 || y > s.height - 0.35) return false;
  for (let ty = Math.floor(y - 0.27); ty <= Math.floor(y + 0.27); ty++) for (let tx = Math.floor(x - 0.27); tx <= Math.floor(x + 0.27); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5, level)].walkable) return false;
  for (const b of s.entities) if (b.hp > 0 && b.kind === "building" && !b.gateOpen && levelOf(b) === level) {
    const r = buildingRadius(s, b);
    if (Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) return false;
  }
  for (const r of s.resources) if (r.amount > 0 && levelOf(r) === level && length2D(r.x - x, r.y - y) < 0.7) return false;
  return true;
}
function openDestination(s, to, from) {
  const level = to.level ?? levelOf(from);
  to = { ...to, ...level ? { level } : {} };
  if (level !== levelOf(from)) return void 0;
  if (walkable(s, to.x, to.y, level)) return to;
  const dx = from.x - to.x, dy = from.y - to.y, length2 = length2D(dx, dy), ux = length2 ? dx / length2 : 1, uy = length2 ? dy / length2 : 0;
  for (let r = 0.25; r <= 6; r += 0.25) for (const i of NEAREST_DIRECTION_INDICES_32) {
    const [x, y] = DIRECTIONS_32[i], p = { x: to.x + (ux * x - uy * y) * r, y: to.y + (uy * x + ux * y) * r, ...level ? { level } : {} };
    if (walkable(s, p.x, p.y, level)) return p;
  }
  return void 0;
}

// src/core/match-rules.ts
var plain = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function fields(value, allowed, name) {
  if (!plain(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`Invalid ${name}.`);
  return value;
}
function num2(value, min, max, name, integer2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer2 && !Number.isSafeInteger(value)) throw new Error(`Invalid ${name}.`);
  return value;
}
function bool(value, name) {
  if (typeof value !== "boolean") throw new Error(`Invalid ${name}.`);
  return value;
}
function money(value, name) {
  const c = fields(value, ["wood", "ore", "crystal"], name);
  return { wood: num2(c.wood, 0, 1e9, `${name} wood`), ore: num2(c.ore, 0, 1e9, `${name} ore`), crystal: num2(c.crystal, 0, 1e9, `${name} crystal`) };
}
var factionContext = (faction, content) => ({ content, players: [{ faction }] });
function definitionIds(content) {
  return [...new Set(Object.keys(contentFactions(content)).flatMap((faction) => {
    const context = factionContext(faction, content);
    return [...availableUnits(context, 0).map((u) => u.id), ...Object.keys(upgradesFor(context, 0))];
  }))];
}
function normalizeMatchRules(value = {}, content) {
  const r = fields(value, ["mode", "standardDefeat", "startingAge", "sharedVision", "friendlyFire", "startingResources", "disabledDefinitionIds", "hill", "relic", "survival", "draft"], "match rules");
  if (Object.values(r).some((v) => v === null)) throw new Error("Invalid null match rule.");
  const mode = r.mode ?? "annihilation";
  if (!["annihilation", "hill", "relic", "survival", "scenario"].includes(mode)) throw new Error("Unknown victory mode.");
  const h = fields(r.hill ?? {}, ["radius", "captureTicks", "holdTicks"], "hill rules"), l = fields(r.relic ?? {}, ["count", "required", "holdTicks", "pickupRadius"], "relic rules"), s = fields(r.survival ?? {}, ["defenderTeam", "waveCount", "intervalTicks", "recoveryTicks", "unitsPerWave", "rewardPerWave"], "survival rules"), d = fields(r.draft ?? {}, ["enabled", "banRounds", "pickRounds", "turnTicks"], "draft rules");
  if ([h, l, s, d].some((group) => Object.values(group).some((v) => v === null))) throw new Error("Invalid null objective or draft rule.");
  const disabled = r.disabledDefinitionIds ?? [];
  if (!Array.isArray(disabled) || disabled.length > 256 || disabled.some((id3) => typeof id3 !== "string" || id3.length > 128 || !definitionIds(content).includes(id3)) || new Set(disabled).size !== disabled.length) throw new Error("Disabled definitions must be unique known unit or technology IDs.");
  const rules = {
    mode,
    standardDefeat: bool(r.standardDefeat ?? (mode !== "scenario" && mode !== "survival"), "standard defeat"),
    startingAge: num2(r.startingAge ?? 1, 1, 3, "starting age", true),
    sharedVision: bool(r.sharedVision ?? true, "shared vision"),
    friendlyFire: bool(r.friendlyFire ?? true, "friendly fire"),
    startingResources: money(r.startingResources ?? { wood: 420, ore: 220, crystal: 0 }, "starting resources"),
    disabledDefinitionIds: [...disabled],
    hill: { radius: num2(h.radius ?? 5, 1, 12, "hill radius"), captureTicks: num2(h.captureTicks ?? 100, 1, 72e3, "hill capture duration", true), holdTicks: num2(h.holdTicks ?? 2400, 1, 72e3, "hill hold duration", true) },
    relic: { count: num2(l.count ?? 3, 1, 8, "relic count", true), required: num2(l.required ?? 2, 1, 8, "required relics", true), holdTicks: num2(l.holdTicks ?? 2400, 1, 72e3, "relic defense duration", true), pickupRadius: num2(l.pickupRadius ?? 1.5, 0.5, 4, "relic pickup radius") },
    survival: { defenderTeam: num2(s.defenderTeam ?? 0, 0, 7, "defender team", true), waveCount: num2(s.waveCount ?? 5, 1, 20, "wave count", true), intervalTicks: num2(s.intervalTicks ?? 1200, 20, 72e3, "wave interval", true), recoveryTicks: num2(s.recoveryTicks ?? 400, 1, 72e3, "recovery duration", true), unitsPerWave: num2(s.unitsPerWave ?? 2, 1, 20, "wave size", true), rewardPerWave: money(s.rewardPerWave ?? { wood: 60, ore: 30, crystal: 0 }, "wave reward") },
    draft: { enabled: bool(d.enabled ?? false, "draft enabled"), banRounds: num2(d.banRounds ?? 1, 0, 2, "ban rounds", true), pickRounds: num2(d.pickRounds ?? 3, 1, 6, "pick rounds", true), turnTicks: num2(d.turnTicks ?? 600, 20, 2400, "draft turn duration", true) }
  };
  if (rules.mode === "annihilation" && !rules.standardDefeat) throw new Error("Annihilation requires headquarters defeat.");
  if (rules.mode === "survival" && rules.standardDefeat) throw new Error("Survival must use its defender and wave defeat rules.");
  if (rules.relic.required > rules.relic.count) throw new Error("Required relic count exceeds the available relics.");
  return rules;
}
var draftOptions = (factionId, content) => {
  const context = factionContext(factionId, content);
  return [...availableUnits(context, 0).filter((u) => u.role !== "worker").map((u) => u.id), ...Object.keys(upgradesFor(context, 0)).filter((id3) => !["town-age", "citadel-age"].includes(id3))];
};
function createDraft(players, rules, content) {
  const pool = [...new Set(players.flatMap((p) => draftOptions(p.factionId, content)))].filter((id3) => !rules.disabledDefinitionIds.includes(id3)), order2 = [];
  if (rules.draft.enabled) {
    for (let round = 0; round < rules.draft.banRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order2.push({ side: p.id, action: "ban" });
    for (let round = 0; round < rules.draft.pickRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order2.push({ side: p.id, action: "pick" });
  }
  if (rules.draft.enabled && players.some((p) => draftOptions(p.factionId, content).filter((id3) => pool.includes(id3)).length < rules.draft.pickRounds + rules.draft.banRounds * players.length || !availableUnits(factionContext(p.factionId, content), 0).some((u) => u.role !== "worker" && pool.includes(u.id)))) throw new Error("Draft has too many bans/picks for the available faction definitions. Reduce bans or picks.");
  return { status: order2.length ? "drafting" : "complete", turn: 0, remainingTicks: order2.length ? rules.draft.turnTicks : 0, order: order2, banned: [], picks: players.map(() => []), pool };
}
function legalDraftChoices(draft, players, side, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || turn?.side !== side) return [];
  const pickGoal = (id3) => draft.order.filter((t) => t.side === id3 && t.action === "pick").length;
  return draft.pool.filter((id3) => {
    if (draft.banned.includes(id3) || draft.picks[side]?.includes(id3)) return false;
    if (turn.action === "ban") return players.every((p) => draftOptions(p.factionId, content).filter((option) => draft.pool.includes(option) && option !== id3 && !draft.banned.includes(option)).length >= pickGoal(p.id) && combatIds(p.factionId, content).some((option) => draft.pool.includes(option) && option !== id3 && !draft.banned.includes(option)));
    if (!draftOptions(players[side].factionId, content).includes(id3)) return false;
    return draft.picks[side].length !== pickGoal(side) - 1 || draft.picks[side].some((option) => combatIds(players[side].factionId, content).includes(option)) || combatIds(players[side].factionId, content).includes(id3);
  });
}
var combatIds = (factionId, content) => availableUnits(factionContext(factionId, content), 0).filter((u) => u.role !== "worker").map((u) => u.id);
function applyDraftChoice(draft, rules, players, side, definitionId2, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || !turn || turn.side !== side || !legalDraftChoices(draft, players, side, content).includes(definitionId2)) return false;
  if (turn.action === "pick" && draft.picks[side].length === rules.draft.pickRounds - 1 && !draft.picks[side].some((id3) => combatIds(players[side].factionId, content).includes(id3)) && !combatIds(players[side].factionId, content).includes(definitionId2)) return false;
  if (turn.action === "ban" && players.some((p) => draftOptions(p.factionId, content).filter((id3) => draft.pool.includes(id3) && id3 !== definitionId2 && !draft.banned.includes(id3)).length < rules.draft.pickRounds || !combatIds(p.factionId, content).some((id3) => draft.pool.includes(id3) && id3 !== definitionId2 && !draft.banned.includes(id3)))) return false;
  if (turn.action === "pick") draft.picks[side].push(definitionId2);
  else draft.banned.push(definitionId2);
  draft.turn++;
  draft.status = draft.turn === draft.order.length ? "complete" : "drafting";
  draft.remainingTicks = draft.status === "complete" ? 0 : rules.draft.turnTicks;
  return true;
}
function draftPlayers(state) {
  return state.players.map((p, id3) => ({ id: id3, factionId: p.faction }));
}
function definitionAllowed(state, side, id3) {
  if (state.rules.disabledDefinitionIds.includes(id3) || state.draft.banned.includes(id3)) return false;
  const necessary = id3 === "town-age" || id3 === "citadel-age" || availableUnits(state, side).some((unit3) => unit3.role === "worker" && unit3.id === id3);
  return !state.rules.draft.enabled || necessary || state.draft.status === "complete" && state.draft.picks[side].includes(id3);
}
function validateModeRoster(state) {
  if (state.rules.mode !== "survival") return;
  if (!state.teams.includes(state.rules.survival.defenderTeam) || new Set(state.teams).size !== 2) throw new Error("Survival requires a defender team and one opposing wave team.");
  if (state.draft.status === "complete" && state.players.some((_player, side) => state.teams[side] !== state.rules.survival.defenderTeam && !availableUnits(state, side).some((unit3) => unit3.role !== "worker" && definitionAllowed(state, side, unit3.id)))) throw new Error("Every wave slot needs an enabled combat unit.");
}
function validateDraftState(value, players, rules, content) {
  const d = fields(value, ["status", "turn", "remainingTicks", "order", "banned", "picks", "pool"], "draft state"), expected = createDraft(players, rules, content);
  const turn = num2(d.turn, 0, expected.order.length, "draft turn", true);
  if (JSON.stringify(d.order) !== JSON.stringify(expected.order) || JSON.stringify(d.pool) !== JSON.stringify(expected.pool)) throw new Error("Draft order or pool differs from the match rules.");
  if (!Array.isArray(d.banned) || !Array.isArray(d.picks) || d.picks.length !== players.length || d.picks.some((p) => !Array.isArray(p) || p.length > rules.draft.pickRounds || p.some((id3) => typeof id3 !== "string"))) throw new Error("Invalid saved draft choices.");
  const choices = d.picks;
  const picked = players.map(() => 0);
  let banned = 0;
  for (let i = 0; i < turn; i++) {
    const action2 = expected.order[i], id3 = action2.action === "ban" ? d.banned[banned++] : choices[action2.side][picked[action2.side]++];
    if (typeof id3 !== "string" || !applyDraftChoice(expected, rules, players, action2.side, id3, content)) throw new Error("Saved draft contains an illegal choice.");
  }
  if (banned !== d.banned.length || picked.some((count, side) => count !== choices[side].length) || d.status !== expected.status) throw new Error("Saved draft choices do not match its turn.");
  expected.remainingTicks = num2(d.remainingTicks, expected.status === "drafting" ? 1 : 0, expected.status === "drafting" ? rules.draft.turnTicks : 0, "remaining draft ticks", true);
  return expected;
}
function validateSavedRules(value, content) {
  const required = ["mode", "standardDefeat", "startingAge", "sharedVision", "friendlyFire", "startingResources", "disabledDefinitionIds", "hill", "relic", "survival", "draft"];
  const r = fields(value, required, "saved rules");
  if (required.some((key) => !Object.hasOwn(r, key))) throw new Error("Saved match rules are incomplete.");
  for (const [key, names] of [["hill", ["radius", "captureTicks", "holdTicks"]], ["relic", ["count", "required", "holdTicks", "pickupRadius"]], ["survival", ["defenderTeam", "waveCount", "intervalTicks", "recoveryTicks", "unitsPerWave", "rewardPerWave"]], ["draft", ["enabled", "banRounds", "pickRounds", "turnTicks"]]]) {
    const nested = fields(r[key], [...names], `saved ${key} rules`);
    if (names.some((name) => !Object.hasOwn(nested, name))) throw new Error(`Saved ${key} rules are incomplete.`);
  }
  return normalizeMatchRules(r, content);
}
function validateObjectiveState(value, state) {
  const o = fields(value, ["hill", "relics", "relicHoldTicks", "survival"], "objective state"), h = fields(o.hill, ["x", "y", "level", "ownerTeam", "captureTeam", "captureTicks", "holdTicks", "contested"], "hill state"), wave = fields(o.survival, ["wave", "nextWaveTick", "spawnedIds", "phase"], "survival state");
  const team = (v) => {
    if (v === null) return null;
    const id3 = num2(v, 0, 7, "objective team", true);
    if (!state.teams.includes(id3)) throw new Error("Objective refers to an absent team.");
    return id3;
  };
  const point2 = (p) => ({ x: num2(p.x, 0, state.width, "objective x"), y: num2(p.y, 0, state.height, "objective y"), ...p.level === void 0 ? {} : { level: num2(p.level, 0, (state.world?.levels.length ?? 1) - 1, "objective level", true) } });
  const hill = { ...point2(h), ownerTeam: team(h.ownerTeam), captureTeam: team(h.captureTeam), captureTicks: num2(h.captureTicks, 0, state.rules.hill.captureTicks, "hill capture ticks", true), holdTicks: num2(h.holdTicks, 0, state.rules.hill.holdTicks, "hill hold ticks", true), contested: bool(h.contested, "contested hill") };
  if (!Array.isArray(o.relics) || o.relics.length !== (state.rules.mode === "relic" ? state.rules.relic.count : 0)) throw new Error("Invalid saved relic count.");
  const relics = o.relics.map((v, i) => {
    const r = fields(v, ["id", "x", "y", "level", "carrierId", "heldTeam"], "relic state");
    if (r.id !== i + 1) throw new Error("Invalid saved relic ID.");
    const carrierId = r.carrierId === null ? null : num2(r.carrierId, 1, state.nextId - 1, "relic carrier ID", true);
    if (carrierId !== null && !state.entities.some((e) => e.id === carrierId && e.kind === "unit" && e.hp > 0 && !e.illusion)) throw new Error("Relic carrier must be a living ordinary unit.");
    if (carrierId !== null && levelOf(r) !== levelOf(state.entities.find((e) => e.id === carrierId))) throw new Error("Relic and carrier must share a map level.");
    const heldTeam = team(r.heldTeam);
    if (carrierId !== null && heldTeam !== null) throw new Error("Carried relic cannot be held in a shrine.");
    return { id: i + 1, ...point2(r), carrierId, heldTeam };
  });
  const carriers = relics.flatMap((r) => r.carrierId === null ? [] : [r.carrierId]);
  if (new Set(carriers).size !== carriers.length) throw new Error("Unit cannot carry multiple relics.");
  if (!Array.isArray(o.relicHoldTicks) || o.relicHoldTicks.length !== 8) throw new Error("Invalid relic defense counters.");
  const relicHoldTicks = o.relicHoldTicks.map((v) => num2(v, 0, state.rules.relic.holdTicks, "relic defense counter", true));
  if (!Array.isArray(wave.spawnedIds) || wave.spawnedIds.length > state.rules.survival.unitsPerWave * state.rules.survival.waveCount) throw new Error("Invalid survival wave IDs.");
  const spawnedIds = wave.spawnedIds.map((v) => num2(v, 1, state.nextId - 1, "wave entity ID", true));
  if (new Set(spawnedIds).size !== spawnedIds.length) throw new Error("Duplicate survival attacker ID.");
  if (!["waiting", "fighting", "recovery", "complete"].includes(wave.phase)) throw new Error("Unknown survival phase.");
  return { hill, relics, relicHoldTicks, survival: { wave: num2(wave.wave, 0, state.rules.survival.waveCount, "survival wave", true), nextWaveTick: num2(wave.nextWaveTick, 0, 1e12, "next wave tick", true), spawnedIds, phase: wave.phase } };
}

// src/core/objectives.ts
var alive = (e) => e.hp > 0 && !e.illusion;
function freePoint(s, point2, offset = 0) {
  const level = levelOf(point2);
  for (let radius2 = 0; radius2 <= Math.max(s.width, s.height); radius2++) for (let i = 0; i < (radius2 ? 32 : 1); i++) {
    const [dx, dy] = DIRECTIONS_32[(i + offset) % 32], x = Math.floor(point2.x + dx * radius2) + 0.5, y = Math.floor(point2.y + dy * radius2) + 0.5;
    if (x < 0.5 || y < 0.5 || x > s.width - 0.5 || y > s.height - 0.5) continue;
    if (walkable(s, x, y, level)) return { x, y, ...s.world || level ? { level } : {} };
  }
  throw new Error("No walkable objective position.");
}
var distance = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
function placeRelic(relic, point2) {
  relic.x = point2.x;
  relic.y = point2.y;
  if (point2.level === void 0) delete relic.level;
  else relic.level = point2.level;
}
function emptyObjectives(s) {
  return { hill: { x: Math.floor(s.width / 2) + 0.5, y: Math.floor(s.height / 2) + 0.5, ...s.world ? { level: 0 } : {}, ownerTeam: null, captureTeam: null, captureTicks: 0, holdTicks: 0, contested: false }, relics: [], relicHoldTicks: Array(8).fill(0), survival: { wave: 0, nextWaveTick: 0, spawnedIds: [], phase: "waiting" } };
}
function initializeObjectives(s) {
  s.objectives = emptyObjectives(s);
  s.objectives.hill = { ...s.objectives.hill, ...freePoint(s, s.objectives.hill) };
  if (s.rules.mode === "relic") for (let i = 0; i < s.rules.relic.count; i++) {
    const [dx, dy] = DIRECTIONS_32[Math.round(i * 32 / s.rules.relic.count) % 32], point2 = freePoint(s, { x: s.width / 2 + dx * 6, y: s.height / 2 + dy * 6 }, i);
    s.objectives.relics.push({ id: i + 1, ...point2, carrierId: null, heldTeam: null });
  }
  if (s.rules.mode === "survival") {
    validateModeRoster(s);
    s.entities = s.entities.filter((e) => s.teams[e.side] === s.rules.survival.defenderTeam);
    s.objectives.survival.nextWaveTick = s.tick + s.rules.survival.intervalTicks;
  }
}
function collectRelic(s, side, id3, relicId) {
  if (s.rules.mode !== "relic" || s.draft.status !== "complete") return false;
  const unit3 = s.entities.find((e) => e.id === id3 && e.side === side && e.kind === "unit" && alive(e)), relic = s.objectives.relics.find((r) => r.id === relicId);
  if (!unit3 || !relic || relic.carrierId !== null || s.objectives.relics.some((r) => r.carrierId === id3) || distance(unit3, relic) > s.rules.relic.pickupRadius) return false;
  relic.carrierId = id3;
  relic.heldTeam = null;
  placeRelic(relic, unit3);
  s.events.push({ type: "message", side, x: unit3.x, y: unit3.y, ...unit3.level === void 0 ? {} : { level: unit3.level }, text: `Relic ${relicId} collected`, source: id3 });
  return true;
}
function dropRelic(s, side, id3) {
  const unit3 = s.entities.find((e) => e.id === id3 && e.side === side && e.kind === "unit" && alive(e)), relic = s.objectives.relics.find((r) => r.carrierId === id3);
  if (!unit3 || !relic) return false;
  relic.carrierId = null;
  relic.heldTeam = null;
  placeRelic(relic, unit3);
  return true;
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
  const opening = input?.opening ?? AI_PERSONALITIES[personality].opening;
  if (!Object.hasOwn(AI_OPENINGS, opening)) throw new Error("Unknown AI opening.");
  return { difficulty, personality, opening };
}

// src/core/specialist-validation.ts
var MAX_ID = 2147483647;
var MAX_RECORDS = 8192;
var SLOTS = ["weapon", "armor", "trinket"];
var PREPARED = { "incendiary-shell": "incendiary", "rooting-shell": "rooting", "corpse-shell": "corpse", "flood-shell": "flood" };
function bad(path, detail) {
  throw new Error(`Invalid save at ${path}: ${detail}.`);
}
function object(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad(path, "expected an object");
  const record3 = value;
  for (const key of required) if (!Object.hasOwn(record3, key)) bad(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record3)) if (!required.includes(key) && !optional.includes(key)) bad(`${path}.${key}`, "unknown field");
  return record3;
}
function number(value, path, min = 0, max = MAX_ID, integer2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer2 && !Number.isSafeInteger(value)) bad(path, `expected ${integer2 ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function flag(value, path) {
  if (typeof value !== "boolean") bad(path, "expected a boolean");
  return value;
}
function choice(value, path, values) {
  if (typeof value !== "string" || !values.includes(value)) bad(path, "unknown value");
  return value;
}
function list(value, path, max) {
  if (!Array.isArray(value) || value.length > max) bad(path, "invalid array length");
  return value;
}
function position(value, path, s, extraRequired = [], extraOptional = []) {
  const p = object(value, path, ["x", "y", ...extraRequired], ["level", ...extraOptional]);
  number(p.x, `${path}.x`, 0, s.width);
  number(p.y, `${path}.y`, 0, s.height);
  if (p.level !== void 0) {
    const level = number(p.level, `${path}.level`, 0, 1, true);
    if (level !== 0 && !s.world?.levels[level]) bad(`${path}.level`, "world level is absent");
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
  promotions.forEach((value, i) => {
    const q = `${p}.promotions[${i}]`, promotion = object(value, q, ["rank", "id"]);
    if (number(promotion.rank, `${q}.rank`, 1, 3, true) !== i + 1 || i + 1 > rank) bad(`${q}.rank`, "promotions must follow earned ranks in order");
    const id3 = choice(promotion.id, `${q}.id`, Object.keys(PROMOTIONS));
    if (!PROMOTIONS[id3].roles.includes(unitRole(s, e))) bad(`${q}.id`, "promotion does not apply to this unit role");
  });
  const pending = promotions.length < rank ? promotions.length + 1 : void 0;
  if (v.pendingPromotion !== pending) bad(`${p}.pendingPromotion`, "expected the first unchosen earned rank");
}
function validateBuffs(s, e, path) {
  if (e.specialistBuffs === void 0) return;
  if (!realUnit(e)) bad(`${path}.specialistBuffs`, "only real units can receive specialist buffs");
  list(e.specialistBuffs, `${path}.specialistBuffs`, 64).forEach((value, i) => {
    const p = `${path}.specialistBuffs[${i}]`, buff2 = object(value, p, ["until"], ["damageFactor", "speedFactor", "armor", "rooted", "fearedFrom"]);
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
  list(e.burning, `${path}.burning`, 64).forEach((value, i) => {
    const p = `${path}.burning[${i}]`, fire = object(value, p, ["source", "side", "until", "nextAt", "damage"], ["origin"]);
    const source = number(fire.source, `${p}.source`, 1, s.nextId - 1, true), side = number(fire.side, `${p}.side`, 0, s.players.length - 1, true);
    const actor2 = entities.get(source);
    if (actor2 && actor2.side !== side && !(actor2.kind === "unit" && actor2.role === "siege" && actor2.definitionFaction !== void 0)) bad(`${p}.side`, "fire side differs from the source entity");
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
  list(state.artifacts, "state.specialists.artifacts", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.artifacts[${i}]`, item = object(value, p, ["id", "definitionId"], ["owner", "holder", "position"]), id3 = number(item.id, `${p}.id`, 1, counter - 1, true);
    if (records.has(id3)) bad(`${p}.id`, "duplicate artifact id");
    records.set(id3, item);
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
    const id3 = number(equipment[slot], `${p}.${slot}`, 1, MAX_ID, true), item = artifacts.get(id3);
    if (!item || item.holder !== e.id || item.owner !== e.side) bad(`${p}.${slot}`, "equipped artifact must belong to this holder");
    const def = ARTIFACTS[item.definitionId];
    if (def.slot !== slot || !def.roles.includes(unitRole(s, e))) bad(`${p}.${slot}`, "artifact does not match this slot or unit role");
    if (equipped.has(id3)) bad(`${p}.${slot}`, "artifact is equipped more than once");
    equipped.add(id3);
  }
}
function validateStructures(s, state, entities) {
  const counter = number(state.nextStructureId, "state.specialists.nextStructureId", 1, MAX_ID, true), ids = /* @__PURE__ */ new Set(), tiles = /* @__PURE__ */ new Set(), barricades = /* @__PURE__ */ new Set();
  list(state.structures, "state.specialists.structures", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.structures[${i}]`, record3 = object(value, p, ["id", "kind", "owner", "expires"], ["entityId", "tiles"]), id3 = number(record3.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id3)) bad(`${p}.id`, "duplicate temporary structure id");
    ids.add(id3);
    const kind = choice(record3.kind, `${p}.kind`, ["bridge", "barricade"]), owner = number(record3.owner, `${p}.owner`, 0, s.players.length - 1, true);
    number(record3.expires, `${p}.expires`, 0, s.time + 60);
    if (kind === "barricade") {
      if (record3.tiles !== void 0) bad(`${p}.tiles`, "barricades reference an entity rather than terrain tiles");
      const entityId = number(record3.entityId, `${p}.entityId`, 1, s.nextId - 1, true), entity = entities.get(entityId);
      if (!entity || entity.kind !== "building" || entity.side !== owner || !buildingFor(s, entity).tags?.includes("barricade")) bad(`${p}.entityId`, "temporary barricade must reference its owned barricade entity");
      if (barricades.has(entityId)) bad(`${p}.entityId`, "barricade entity is referenced more than once");
      barricades.add(entityId);
    } else {
      if (record3.entityId !== void 0) bad(`${p}.entityId`, "bridges reference terrain tiles rather than an entity");
      const points = list(record3.tiles, `${p}.tiles`, 3);
      if (points.length !== 3) bad(`${p}.tiles`, "temporary bridge requires three tiles");
      let previous;
      points.forEach((value2, j) => {
        const q = `${p}.tiles[${j}]`, point2 = position(value2, q, s, ["previous", "placed"], ["stamp"]);
        if (point2.x % 1 !== 0.5 || point2.y % 1 !== 0.5) bad(q, "bridge tiles must use tile centers");
        if (point2.stamp !== void 0) number(point2.stamp, `${q}.stamp`, 0, 1e12, true);
        choice(point2.previous, `${q}.previous`, ["water", "shallows", "grass", "road"]);
        if (point2.placed !== "bridge") bad(`${q}.placed`, "temporary bridge must place bridge terrain");
        if (previous && (point2.x !== previous.x + 1 || point2.y !== previous.y || (point2.level ?? 0) !== (previous.level ?? 0))) bad(q, "bridge tiles must be consecutive on the same level");
        const key = `${point2.level ?? 0}:${point2.x}:${point2.y}`;
        if (tiles.has(key)) bad(q, "temporary bridge tiles overlap");
        tiles.add(key);
        previous = point2;
      });
    }
  });
  for (const e of s.entities) if (e.hp > 0 && e.kind === "building" && buildingFor(s, e).tags?.includes("barricade") && !barricades.has(e.id)) bad("state.specialists.structures", "living barricade has no temporary structure record");
}
function validateShots(s, state) {
  const counter = state.nextShotId === void 0 ? 1 : number(state.nextShotId, "state.specialists.nextShotId", 1, MAX_ID, true), ids = /* @__PURE__ */ new Set();
  if (state.shots === void 0) return;
  list(state.shots, "state.specialists.shots", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.shots[${i}]`, shot = object(value, p, ["id", "source", "target", "impactAt", "rawDamage", "buildingMultiplier", "payload"]);
    const id3 = number(shot.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id3)) bad(`${p}.id`, "duplicate siege shot id");
    ids.add(id3);
    const source = position(shot.source, `${p}.source`, s, ["id", "side", "definitionId", "faction"]);
    number(source.id, `${p}.source.id`, 1, s.nextId - 1, true);
    number(source.side, `${p}.source.side`, 0, s.players.length - 1, true);
    choice(source.faction, `${p}.source.faction`, Object.keys(contentFactions(s.content)));
    if (typeof source.definitionId !== "string" || source.definitionId.length > 100) bad(`${p}.source.definitionId`, "invalid definition ID");
    let ability;
    try {
      ability = unitFor(s, { ...source, kind: "unit", role: "siege", definitionFaction: source.faction }).ability;
    } catch {
      bad(`${p}.source.definitionId`, "shot source must resolve a siege definition in its original faction");
    }
    const target = position(shot.target, `${p}.target`, s);
    if ((target.level ?? 0) !== (source.level ?? 0)) bad(`${p}.target.level`, "siege shots cannot cross world levels");
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
  for (let side = 0; side < s.players.length; side++) {
    const p = `state.players[${side}].heroRecovery`, player = s.players[side], heroes = availableUnits(s, side).filter((def) => def.tags?.includes("hero")), heroIds = new Set(heroes.map((def) => def.id));
    let active2 = 0;
    for (const e of s.entities) if (e.side === side && e.hp > 0) {
      if (realUnit(e) && unitFor(s, e).tags?.includes("hero")) active2++;
      if (e.kind === "building") for (let i = 0; i < e.queue.length; i++) {
        const def = unitFor(s, side, e.queue[i], e.queueDefinitionIds?.[i]);
        if (def.tags?.includes("hero")) active2++;
      }
    }
    if (active2 > 1) bad(`state.players[${side}]`, "a player cannot have multiple living or queued commanders");
    if (player.heroRecovery === void 0) continue;
    const seen = /* @__PURE__ */ new Set();
    list(player.heroRecovery, p, heroes.length).forEach((value, i) => {
      const q = `${p}[${i}]`, recovery = object(value, q, ["definitionId", "availableAt"]), id3 = choice(recovery.definitionId, `${q}.definitionId`, [...heroIds]);
      if (seen.has(id3)) bad(`${q}.definitionId`, "duplicate commander recovery");
      seen.add(id3);
      const at = number(recovery.availableAt, `${q}.availableAt`, 0, s.time + 30);
      if (active2 && at > s.time) bad(`${q}.availableAt`, "a recovering commander cannot already be alive or queued");
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
  const record3 = (v, path, fields2, optional = []) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !fields2.includes(k) && !optional.includes(k)) || fields2.some((k) => !Object.hasOwn(v, k))) fail2(path);
    return v;
  };
  const list4 = (v, path, max) => {
    if (!Array.isArray(v) || v.length > max) fail2(path);
    return v;
  };
  const number4 = (v, path, min = 0, max = 1e12, int = false) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || int && !Number.isSafeInteger(v)) fail2(path);
    return v;
  };
  const world = record3(input, "state", ["version", "biome", "levels", "transitions", "bridges", "fires", "sites", "creatures", "dayLength", "seasonLength", "weatherLength", "nextEnvironmentAt", "iceTiles", "thawWarned"], ["revision"]);
  if (world.revision !== void 0) number4(world.revision, "revision", 0, 1e12, true);
  if (world.version !== 1 || !BIOMES.includes(world.biome) || typeof world.thawWarned !== "boolean") fail2("version/biome/flags");
  const levels = list4(world.levels, "levels", 2);
  if (!levels.length) fail2("levels");
  const area = width * height;
  const coord = (v, path) => {
    number4(v.x, `${path}.x`, 0, width);
    number4(v.y, `${path}.y`, 0, height);
    number4(v.level, `${path}.level`, 0, levels.length - 1, true);
  };
  const side = (v, path) => {
    if (v !== null) number4(v, path, 0, players - 1, true);
  };
  const ids = /* @__PURE__ */ new Set(), id3 = (v, path, allocate = true) => {
    const n = number4(v, path, 1, nextId - 1, true);
    if (allocate) {
      if (ids.has(n)) fail2(`${path}duplicate`);
      ids.add(n);
    }
    return n;
  };
  const cost2 = (v, path) => {
    const c = record3(v, path, ["wood", "ore", "crystal"]);
    for (const kind of ["wood", "ore", "crystal"]) number4(c[kind], `${path}.${kind}`, 0, 1e9);
  };
  for (let i = 0; i < levels.length; i++) {
    const l = record3(levels[i], `levels${i}`, ["id", "title", "terrain", "elevation"]);
    if (l.id !== i || typeof l.title !== "string" || l.title.length > 80) fail2(`levels${i}.id/title`);
    const terrain2 = list4(l.terrain, `levels${i}.terrain`, area), elevation = list4(l.elevation, `levels${i}.elevation`, area);
    if (terrain2.length !== area || elevation.length !== area) fail2(`levels${i}.dimensions`);
    terrain2.forEach((t, j) => {
      if (typeof t !== "string" || !Object.hasOwn(TERRAIN, t)) fail2(`levels${i}.terrain${j}`);
    });
    elevation.forEach((e, j) => number4(e, `levels${i}.elevation${j}`, 0, 3, true));
  }
  const transitionIds = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world.transitions, "transitions", 64).entries()) {
    const t = record3(v, `transition${i}`, ["id", "from", "to"]), n = number4(t.id, `transition${i}.id`, 1, 2147483647, true);
    if (transitionIds.has(n)) fail2(`transition${i}.duplicate`);
    transitionIds.add(n);
    for (const field of ["from", "to"]) coord(record3(t[field], `transition${i}.${field}`, ["x", "y", "level"]), `transition${i}.${field}`);
    if (t.from.level === t.to.level) fail2(`transition${i}.levels`);
  }
  for (const [i, v] of list4(world.bridges, "bridges", 512).entries()) {
    const b = record3(v, `bridge${i}`, ["id", "x", "y", "level", "hp", "maxHp", "tiles", "rebuilding", "repairSide"]);
    id3(b.id, `bridge${i}.id`);
    coord(b, `bridge${i}`);
    const max = number4(b.maxHp, `bridge${i}.maxHp`, 1, 1e9);
    number4(b.hp, `bridge${i}.hp`, 0, max);
    number4(b.rebuilding, `bridge${i}.rebuilding`, 0, 1);
    side(b.repairSide, `bridge${i}.repairSide`);
    const tiles = list4(b.tiles, `bridge${i}.tiles`, area);
    if (!tiles.length || new Set(tiles).size !== tiles.length) fail2(`bridge${i}.tiles`);
    tiles.forEach((t, j) => number4(t, `bridge${i}.tiles${j}`, 0, area - 1, true));
  }
  const fireKeys = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world.fires, "fires", area * levels.length).entries()) {
    const f = record3(v, `fire${i}`, ["x", "y", "level", "heat", "expires", "nextSpread"]);
    coord(f, `fire${i}`);
    number4(f.heat, `fire${i}.heat`, 0, 1);
    number4(f.expires, `fire${i}.expires`);
    number4(f.nextSpread, `fire${i}.nextSpread`);
    const k = `${f.level},${Math.floor(f.x)},${Math.floor(f.y)}`;
    if (fireKeys.has(k)) fail2(`fire${i}.duplicate`);
    fireKeys.add(k);
  }
  const sites = list4(world.sites, "sites", 128), siteIds = /* @__PURE__ */ new Set(), creatureRefs = /* @__PURE__ */ new Set();
  for (const [i, v] of sites.entries()) {
    const site = record3(v, `site${i}`, ["id", "x", "y", "level", "kind", "owner", "loyalty", "progress", "capturing", "reward", "rewarded", "request", "supplied", "creatureIds", "respawnAt"]);
    siteIds.add(id3(site.id, `site${i}.id`));
    coord(site, `site${i}`);
    if (!["relic", "village", "monster"].includes(site.kind) || typeof site.supplied !== "boolean") fail2(`site${i}.kind/flags`);
    side(site.owner, `site${i}.owner`);
    side(site.capturing, `site${i}.capturing`);
    const loyalty = list4(site.loyalty, `site${i}.loyalty`, players);
    if (loyalty.length !== players) fail2(`site${i}.loyalty`);
    loyalty.forEach((l, j) => number4(l, `site${i}.loyalty${j}`, 0, 100));
    number4(site.progress, `site${i}.progress`, 0, 1);
    cost2(site.reward, `site${i}.reward`);
    cost2(site.request, `site${i}.request`);
    for (const player of list4(site.rewarded, `site${i}.rewarded`, players)) number4(player, `site${i}.rewarded`, 0, players - 1, true);
    if (new Set(site.rewarded).size !== site.rewarded.length) fail2(`site${i}.rewarded`);
    for (const n of list4(site.creatureIds, `site${i}.creatureIds`, 16)) {
      const target = id3(n, `site${i}.creatureId`, false);
      if (creatureRefs.has(target)) fail2(`site${i}.duplicateCreature`);
      creatureRefs.add(target);
    }
    number4(site.respawnAt, `site${i}.respawnAt`);
  }
  const creatures = list4(world.creatures, "creatures", 2048), creatureIds = /* @__PURE__ */ new Set();
  for (const [i, v] of creatures.entries()) {
    const creature = record3(v, `creature${i}`, ["id", "site", "x", "y", "level", "hp", "maxHp", "cooldown", "target", "path", "patrol", "respawnAt"]), n = id3(creature.id, `creature${i}.id`);
    creatureIds.add(n);
    coord(creature, `creature${i}`);
    if (!siteIds.has(number4(creature.site, `creature${i}.site`, 1, nextId - 1, true))) fail2(`creature${i}.site`);
    const max = number4(creature.maxHp, `creature${i}.maxHp`, 1, 1e9);
    number4(creature.hp, `creature${i}.hp`, 0, max);
    for (const field of ["cooldown", "patrol", "respawnAt"]) number4(creature[field], `creature${i}.${field}`);
    if (creature.target !== null) id3(creature.target, `creature${i}.target`, false);
    for (const [j, p] of list4(creature.path, `creature${i}.path`, area * 16).entries()) {
      if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).some((k) => !["x", "y", "level"].includes(k))) fail2(`creature${i}.path${j}`);
      const point2 = p;
      coord({ ...point2, level: point2.level ?? 0 }, `creature${i}.path${j}`);
    }
  }
  if (creatureRefs.size !== creatureIds.size || [...creatureRefs].some((n) => !creatureIds.has(n))) fail2("siteCreatureReferences");
  for (const site of sites) for (const n of site.creatureIds) if (creatures.find((c) => c.id === n)?.site !== site.id) fail2("creatureSiteReference");
  const iceKeys = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world.iceTiles, "iceTiles", area * levels.length).entries()) {
    const ice = record3(v, `ice${i}`, ["level", "tile"]);
    number4(ice.level, `ice${i}.level`, 0, levels.length - 1, true);
    number4(ice.tile, `ice${i}.tile`, 0, area - 1, true);
    const k = `${ice.level},${ice.tile}`;
    if (iceKeys.has(k)) fail2(`ice${i}.duplicate`);
    iceKeys.add(k);
  }
  for (const field of ["dayLength", "seasonLength", "weatherLength"]) number4(world[field], field, 0.05, 1e6);
  number4(world.nextEnvironmentAt, "nextEnvironmentAt");
}

// src/core/specialist-systems.ts
var sameLevel2 = (a, b) => (a.level ?? 0) === (b.level ?? 0);
var dist = (a, b) => sameLevel2(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var allied = (s, a, b) => s.teams[a.side] === s.teams[b.side];
var visible = (s, side, p) => s.visible[side].has((p.level ?? 0) * s.width * s.height + Math.floor(p.y) * s.width + Math.floor(p.x));
var active = (e) => e.hp > 0 && e.kind === "unit" && !e.illusion && !e.raised;
var allAbilities = /* @__PURE__ */ new Set(["iron-command", "queen-step", "thane-ward", "soul-drain", "admiral-wave", "prime-shield", "impact-fury", "forest-leap", "armored-brace", "terror", "wet-surge", "shield-dash", "incendiary-shell", "rooting-shell", "ammunition-cannon", "corpse-shell", "flood-shell", "powered-beam"]);
function buff(s, e, value, seconds) {
  e.specialistBuffs ??= [];
  if (e.specialistBuffs.length >= 64) e.specialistBuffs.shift();
  e.specialistBuffs.push({ ...value, until: s.time + seconds });
}
function heroRecruitmentReason(s, side, definitionId2) {
  const def = s.players[side] && availableUnits(s, side).find((def2) => def2.id === definitionId2);
  if (!def?.tags?.includes("hero")) return void 0;
  if (s.entities.some((e) => e.side === side && active(e) && unitFor(s, e).tags?.includes("hero")) || s.entities.some((e) => e.side === side && e.hp > 0 && e.queueDefinitionIds?.some((id3) => {
    return availableUnits(s, side).find((def2) => def2.id === id3)?.tags?.includes("hero");
  }))) return "A commander is already alive or queued";
  const recovery = s.players[side].heroRecovery?.find((r) => r.definitionId === definitionId2);
  if (recovery && recovery.availableAt > s.time) return `Commander recovery: ${Math.ceil(recovery.availableAt - s.time)}s`;
  return void 0;
}
function commanderDied(s, e) {
  if (e.kind !== "unit" || e.illusion || e.raised || !unitFor(s, e).tags?.includes("hero")) return;
  const p = s.players[e.side];
  p.heroRecovery ??= [];
  p.heroRecovery = p.heroRecovery.filter((r) => r.definitionId !== unitFor(s, e).id);
  p.heroRecovery.push({ definitionId: unitFor(s, e).id, availableAt: s.time + 30 });
}
function specialistAbility(s, e, c, hooks) {
  const ability = unitFor(s, e).ability;
  if (!allAbilities.has(ability)) return void 0;
  if (!active(e) || (e.abilityReadyAt ?? 0) > s.time) return false;
  const target = c.target === void 0 ? void 0 : s.entities.find((target2) => target2.id === c.target && target2.hp > 0), point2 = c.x === void 0 ? target : { x: c.x, y: c.y, level: c.level ?? e.level };
  const validPoint = (range) => !!point2 && Number.isFinite(point2.x) && Number.isFinite(point2.y) && point2.x >= 0.5 && point2.y >= 0.5 && point2.x <= s.width - 0.5 && point2.y <= s.height - 0.5 && dist(e, point2) <= range && visible(s, e.side, point2);
  const nearby = (point3, radius2) => s.entities.filter((target2) => active(target2) && dist(target2, point3) <= radius2);
  switch (ability) {
    case "iron-command":
      if (!validPoint(8)) return false;
      for (const ally of nearby(point2, 5)) if (allied(s, e, ally)) buff(s, ally, { damageFactor: 1.25 }, 8);
      break;
    case "queen-step":
      if (!validPoint(7) || !fieldWalkable(s, point2)) return false;
      e.x = point2.x;
      e.y = point2.y;
      e.path = [];
      e.order = { type: "idle" };
      for (const ally of nearby(e, 4)) if (allied(s, e, ally)) ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      break;
    case "thane-ward":
      if (!target || !active(target) || !allied(s, e, target) || dist(e, target) > 8 || !visible(s, e.side, target)) return false;
      target.hp = Math.min(target.maxHp, target.hp + 80);
      buff(s, target, { armor: 4 }, 10);
      break;
    case "soul-drain":
      if (!target || !active(target) || allied(s, e, target) || dist(e, target) > 7 || !visible(s, e.side, target)) return false;
      hooks.damage(e, target, 60);
      e.hp = Math.min(e.maxHp, e.hp + 45);
      break;
    case "admiral-wave":
      if (!validPoint(8)) return false;
      for (const actor2 of nearby(point2, 4)) if (allied(s, e, actor2)) actor2.hp = Math.min(actor2.maxHp, actor2.hp + 50);
      else hooks.damage(e, actor2, 35);
      break;
    case "prime-shield":
      if (!target || !active(target) || !allied(s, e, target) || !target.maxShield || dist(e, target) > 8 || !visible(s, e.side, target)) return false;
      target.shield = target.maxShield;
      buff(s, target, { armor: 4 }, 10);
      break;
    case "impact-fury":
      buff(s, e, { damageFactor: 1.35 }, 6);
      e.momentum = 1;
      break;
    case "forest-leap":
      if (!validPoint(5) || !fieldWalkable(s, point2)) return false;
      e.x = point2.x;
      e.y = point2.y;
      e.path = [];
      break;
    case "armored-brace":
      buff(s, e, { armor: 5, speedFactor: 0.75 }, 8);
      break;
    case "terror": {
      let count = 0;
      for (const hostile of nearby(e, 4)) if (!allied(s, e, hostile) && hostile.role !== "siege") {
        buff(s, hostile, { fearedFrom: { x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } } }, 3);
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
      if (!validPoint(4) || !fieldWalkable(s, point2) || (e.shield ?? 0) < 15) return false;
      e.shield -= 15;
      e.x = point2.x;
      e.y = point2.y;
      e.path = [];
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
      const corpse = s.corpses.find((c2) => c2.expires > s.time && dist(e, c2) <= 6 && visible(s, e.side, c2));
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
function fieldWalkable(s, point2) {
  return walkable(s, point2.x, point2.y, point2.level ?? 0);
}
function fieldTerrainAt(s, point2) {
  return terrainAt(s, point2.x, point2.y, point2.level ?? 0);
}
function fieldSetTerrain(s, point2, kind, hooks) {
  if (hooks.setTerrain) return hooks.setTerrain(point2, kind);
  if ((point2.level ?? 0) !== 0) return false;
  const index2 = Math.floor(point2.y) * s.width + Math.floor(point2.x);
  if (index2 < 0 || index2 >= s.terrain.length) return false;
  s.terrain[index2] = kind;
  for (const e of s.entities) e.path = [];
  return true;
}
function engineerBuild(s, side, c, hooks) {
  const engineers = s.entities.filter((e) => e.side === side && c.ids.includes(e.id) && active(e) && unitFor(s, e).tags?.includes("engineer")), point2 = { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5, ...c.level === void 0 ? {} : { level: c.level } };
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !engineers.some((e) => dist(e, point2) <= 4) || !visible(s, side, point2)) return false;
  const player = s.players[side], cost2 = c.kind === "bridge" ? { wood: 60, ore: 0 } : { wood: 35, ore: 15 };
  if (player.wood < cost2.wood || player.ore < cost2.ore) return false;
  const state = specialistState(s);
  if (c.kind === "bridge") {
    const tiles = [-1, 0, 1].map((dx) => ({ ...point2, x: point2.x + dx })), world = s.world;
    if (world?.bridges?.some((bridge) => bridge.level === (point2.level ?? 0) && bridge.tiles.some((tile) => tiles.some((p) => Math.floor(p.y) * s.width + Math.floor(p.x) === tile)))) return false;
    if (tiles.some((tile) => tile.x < 0.5 || tile.x > s.width - 0.5 || tile.y < 0.5 || tile.y > s.height - 0.5) || !tiles.some((tile) => fieldTerrainAt(s, tile) === "water") || tiles.some((tile) => !["water", "shallows", "grass", "road"].includes(fieldTerrainAt(s, tile)) || !visible(s, side, tile) || state.structures.some((item) => item.expires > s.time && item.tiles?.some((prior) => dist(prior, tile) < 0.1)))) return false;
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
    state.structures.push({ id: state.nextStructureId++, kind: "bridge", owner: side, expires: s.time + 60, tiles: saved });
  } else {
    if (point2.x < 0.5 || point2.y < 0.5 || point2.x > s.width - 0.5 || point2.y > s.height - 0.5 || !fieldWalkable(s, point2) || s.entities.some((e) => e.hp > 0 && dist(e, point2) < 1)) return false;
    const barricade = hooks.spawn(side, "building", "core:field-barricade", point2.x, point2.y, 1, point2.level);
    state.structures.push({ id: state.nextStructureId++, kind: "barricade", owner: side, expires: s.time + 60, entityId: barricade.id });
  }
  player.wood -= cost2.wood;
  player.ore -= cost2.ore;
  s.events.push({ type: "build", side, x: point2.x, y: point2.y, ...point2.level === void 0 ? {} : { level: point2.level }, text: `Temporary ${c.kind}: expires in 60 seconds.` });
  return true;
}
function fieldRepair(s, side, id3, targetId) {
  const engineer2 = s.entities.find((e) => e.id === id3 && e.side === side && active(e) && unitFor(s, e).tags?.includes("engineer")), target = s.entities.find((e) => e.id === targetId && e.hp > 0 && s.teams[e.side] === s.teams[side]);
  if (!engineer2 || !target || target.kind !== "building" && target.role !== "siege" || target.hp >= target.maxHp || dist(engineer2, target) > 4 || !visible(s, side, target)) return false;
  const p = s.players[side], amount = Math.min(60, target.maxHp - target.hp), ore = Math.ceil(amount / 10);
  if (p.ore < ore) return false;
  p.ore -= ore;
  target.hp += amount;
  s.events.push({ type: "ability", side, x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level }, source: engineer2.id, target: target.id, text: `Field repair: ${amount} health for ${ore} ore.` });
  return true;
}
function updateBeacons(s, alerts = true) {
  const beacons = s.entities.filter((e) => e.kind === "building" && e.hp > 0 && e.progress === 1 && buildingFor(s, e).tags?.includes("beacon")), connected = /* @__PURE__ */ new Set(), sources = s.entities.filter((e) => e.kind === "building" && e.hp > 0 && e.progress === 1 && (e.role === "hq" || e.role === "depot") && !buildingFor(s, e).tags?.includes("beacon"));
  for (let changed = true; changed; ) {
    changed = false;
    for (const beacon2 of beacons) if (!connected.has(beacon2.id) && [...sources, ...beacons.filter((b) => connected.has(b.id))].some((source) => s.teams[source.side] === s.teams[beacon2.side] && dist(source, beacon2) <= 12)) {
      connected.add(beacon2.id);
      changed = true;
    }
  }
  for (const beacon2 of beacons) {
    beacon2.beacon ??= { connected: false, nextAlertAt: 0 };
    beacon2.beacon.connected = connected.has(beacon2.id);
    if (!alerts || !beacon2.beacon.connected || s.time < beacon2.beacon.nextAlertAt) continue;
    const intruder = s.entities.find((e) => e.hp > 0 && s.teams[e.side] !== s.teams[beacon2.side] && dist(e, beacon2) <= buildingFor(s, beacon2).sight && visible(s, beacon2.side, e));
    if (intruder) {
      s.events.push({ type: "message", side: beacon2.side, x: intruder.x, y: intruder.y, ...intruder.level === void 0 ? {} : { level: intruder.level }, source: beacon2.id, target: intruder.id, text: "Beacon invasion alert." });
      beacon2.beacon.nextAlertAt = s.time + 8;
    }
  }
}

// src/core/progression.ts
var AGE_NAMES = { 1: "Settlement Age", 2: "Town Age", 3: "Citadel Age" };
function buildingAgeRequired(def) {
  return def.age ?? (def.role === "hq" ? 2 : 1);
}
function playerAge(player) {
  return player.upgrades.includes("citadel-age") ? 3 : player.upgrades.includes("town-age") ? 2 : 1;
}
function requirement(s, side, id3, excludeEntity) {
  const player = s.players[side], def = upgradeFor(s, side, id3);
  if (player.upgrades.includes(id3)) return "Already researched";
  const pending = s.entities.filter((e) => e.id !== excludeEntity && e.side === side && e.hp > 0 && e.research);
  if (pending.some((e) => e.research === id3)) return "Already researching";
  if (def.exclusiveGroup) {
    const chosen = player.upgrades.find((other) => upgradeFor(s, side, other).exclusiveGroup === def.exclusiveGroup);
    if (chosen) return `Locked by ${upgradeFor(s, side, chosen).name}`;
    const reserved2 = pending.find((e) => upgradeFor(s, side, e.research).exclusiveGroup === def.exclusiveGroup);
    if (reserved2) return `Locked while ${upgradeFor(s, side, reserved2.research).name} is researching`;
  }
  if (playerAge(player) < (def.age ?? 1)) return `Requires ${AGE_NAMES[def.age]}`;
  const missing = def.requires?.find((required) => !player.upgrades.includes(required));
  if (missing) return `Requires ${upgradeFor(s, side, missing).name}`;
  return void 0;
}
function researchRequirement(s, side, id3) {
  return requirement(s, side, id3);
}
function upgradeAppliesTo(upgrade, unit3) {
  return upgrade.appliesTo === unit3.role && (!upgrade.appliesToDefinitions || upgrade.appliesToDefinitions.includes(unit3.id));
}

// src/core/history-hooks.ts
var observers = /* @__PURE__ */ new WeakMap();
function subscribeSimulation(state, observer) {
  let listeners = observers.get(state);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    observers.set(state, listeners);
  }
  listeners.add(observer);
  return () => {
    listeners.delete(observer);
    if (!listeners.size) observers.delete(state);
  };
}
function notifyCommand(state, side, command) {
  for (const observer of [...observers.get(state) ?? []]) {
    try {
      observer.command?.(side, structuredClone(command));
    } catch (error) {
      console.error("Match command observer failed", error);
    }
  }
}

// src/core/world-actions.ts
var known = (s, side, point2) => s.visible[side].has(fogKey(s, point2));
function claimRebuild(s, bridge, side) {
  if (bridge.repairSide !== null) return s.teams[bridge.repairSide] === s.teams[side];
  const player = s.players[side], wood = 60 + bridge.tiles.length * 2, ore = 20;
  if (player.wood < wood || player.ore < ore) return false;
  player.wood -= wood;
  player.ore -= ore;
  bridge.repairSide = side;
  bridge.rebuilding = 0;
  return true;
}
function issueWorldAction(s, side, c, assign2) {
  if (!["traverse", "worldAttack", "repairBridge"].includes(c.type)) return void 0;
  const world = s.world;
  if (!world || !("ids" in c)) return false;
  const units = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && e.kind === "unit" && e.hp > 0 && !e.illusion);
  if (c.type === "traverse") {
    const transition = world.transitions.find((t) => t.id === c.transition);
    if (!transition) return false;
    let accepted = false;
    for (const e of units) {
      const entrance = [transition.from, transition.to].find((p) => sameLevel(p, e));
      if (!entrance || !known(s, side, entrance)) continue;
      assign2(e, { type: "traverse", transition: transition.id });
      accepted = true;
    }
    return accepted;
  }
  if (!("target" in c)) return false;
  const bridge = world.bridges.find((b) => b.id === c.target);
  if (!bridge) return c.type === "worldAttack" ? void 0 : false;
  if (!known(s, side, bridge)) return false;
  if (c.type === "worldAttack") {
    if (bridge.hp <= 0) return false;
    let accepted = false;
    for (const e of units) if (sameLevel(e, bridge)) {
      assign2(e, { type: "worldAttack", target: bridge.id });
      accepted = true;
    }
    return accepted;
  }
  const workers = units.filter((e) => e.role === "worker" && sameLevel(e, bridge));
  if (!workers.length || bridge.hp === bridge.maxHp) return false;
  if (bridge.repairSide !== null && s.teams[bridge.repairSide] !== s.teams[side]) return false;
  if (bridge.hp === 0 && !claimRebuild(s, bridge, side)) return false;
  for (const e of workers) assign2(e, { type: "repairBridge", target: bridge.id });
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
var levelOf2 = (p) => p.level ?? 0;
var tileOf = (s, p) => Math.floor(p.y) * s.width + Math.floor(p.x);
var length = (n, fallback) => Number.isFinite(n) && n > 0 ? n : fallback;
var hash = (seed, a, b = 0, c = 0) => {
  let n = (seed ^ Math.imul(a + 1, 2654435761) ^ Math.imul(b + 1, 2246822507) ^ Math.imul(c + 1, 3266489909)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 2146121005);
  n = Math.imul(n ^ n >>> 15, 2221713035);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
};
function environmentPhase(s) {
  const world = s.world;
  if (!world) return { day: "day", season: "spring", weather: "clear", wind: { x: 0, y: 0 }, dayProgress: 0, seasonProgress: 0, weatherEndsAt: Infinity, thawIn: null };
  const time = Math.max(0, s.time), dayLength = length(world.dayLength, 240), seasonLength = length(world.seasonLength, 300), weatherLength = length(world.weatherLength, 70);
  const dayProgress = time % dayLength / dayLength;
  const day = dayProgress < 0.55 ? "day" : dayProgress < 0.65 ? "dusk" : dayProgress < 0.9 ? "night" : "dawn";
  const seasonIndex = (Math.floor(time / seasonLength) + (world.biome === "snow" ? 3 : 0)) % 4;
  const season = ["spring", "summer", "autumn", "winter"][seasonIndex], seasonProgress = time % seasonLength / seasonLength;
  const weatherIndex = Math.floor(time / weatherLength), roll = hash(s.seed, weatherIndex, 21);
  const weather = roll < 0.4 ? "clear" : roll < 0.62 ? "rain" : roll < 0.8 ? "fog" : "wind";
  const [windX, windY] = DIRECTIONS_32[Math.floor(hash(s.seed, weatherIndex, 22) * DIRECTIONS_32.length)], strength = weather === "wind" ? 1 : 0;
  return { day, season, weather, wind: { x: windX * strength, y: windY * strength }, dayProgress, seasonProgress, weatherEndsAt: (weatherIndex + 1) * weatherLength, thawIn: season === "winter" ? (1 - seasonProgress) * seasonLength : null };
}
function environmentalSightFactor(s, entity) {
  if (!s.world || entity && levelOf2(entity) > 0) return 1;
  const { day, weather } = environmentPhase(s);
  let light = day === "night" ? 0.6 : day === "day" ? 1 : 0.8;
  if (entity && entity.kind === "unit" && s.players[entity.side]) {
    const faction = s.players[entity.side].faction;
    if (day === "night" && faction === "undead") light = 1;
    else if (day === "night" && faction === "tideborn" && entity.role === "special") light = 0.9;
  }
  return light * (weather === "fog" ? 0.65 : weather === "rain" ? 0.9 : 1);
}
function projectileEnvironment(s, from, to) {
  if (!s.world || levelOf2(from) > 0 || levelOf2(to) > 0) return { damageFactor: 1, rangeFactor: 1, drift: { x: 0, y: 0 } };
  const { weather, wind } = environmentPhase(s), dx = to.x - from.x, dy = to.y - from.y, d = length2D(dx, dy);
  if (weather === "rain") return { damageFactor: 0.9, rangeFactor: 0.9, drift: { x: 0, y: 0 } };
  if (weather !== "wind" || d === 0) return { damageFactor: 1, rangeFactor: 1, drift: { x: 0, y: 0 } };
  const along = (wind.x * dx + wind.y * dy) / d, cross = Math.abs(wind.x * dy - wind.y * dx) / d;
  return { damageFactor: 1 - 0.12 * cross, rangeFactor: 1 + 0.12 * along, drift: { x: wind.x * Math.min(d, 12) * 0.045, y: wind.y * Math.min(d, 12) * 0.045 } };
}
function terrain(s, p) {
  const layer = s.world?.levels.find((l) => l.id === levelOf2(p));
  return (layer?.terrain ?? (levelOf2(p) === 0 ? s.terrain : []))[tileOf(s, p)] ?? "rock";
}
function setTerrain(s, p, kind) {
  setWorldTerrain(s, p, kind);
}
function woodAt(s, p) {
  return s.resources.filter((n) => n.kind === "wood" && n.amount > 0 && levelOf2(n) === levelOf2(p) && tileOf(s, n) === tileOf(s, p));
}
function flammable(s, p) {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height && (terrain(s, p) === "forest" || woodAt(s, p).length > 0);
}
function message(s, side, p, text2, type = "message", source) {
  const event = { type, side, x: p.x, y: p.y, level: levelOf2(p), text: text2, source };
  s.events.push(event);
}
function ignition(s, p) {
  return { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5, level: levelOf2(p), heat: 1, expires: s.time + ENVIRONMENT_RULES.fireLifetime, nextSpread: s.time + 2.5 };
}
function igniteWorldAt(s, at, source) {
  const state = s, world = state.world, level = levelOf2(at);
  if (!world || !Number.isFinite(at.x) || !Number.isFinite(at.y) || !Number.isInteger(level) || !world.levels.some((l) => l.id === level) || at.x < 0 || at.y < 0 || at.x >= s.width || at.y >= s.height || source && !s.players[source.side]) return false;
  if (source?.id !== void 0 && (!Number.isSafeInteger(source.id) || source.id < 1 || source.id >= s.nextId || s.entities.some((e) => e.id === source.id && e.side !== source.side))) return false;
  const p = { x: Math.floor(at.x) + 0.5, y: Math.floor(at.y) + 0.5, level };
  if (!flammable(state, p) || world.fires.some((f) => f.level === level && tileOf(s, f) === tileOf(s, p))) return false;
  world.fires.push(ignition(state, p));
  if (source) message(s, source.side, p, "Incendiary shell ignited timber.", "ability", source.id);
  return true;
}
function issueEnvironmentCommand(s, side, command) {
  if (command.type !== "ignite" && command.type !== "firebreak") return void 0;
  const c = command, state = s, world = state.world;
  if (!world || s.winner !== null || s.draw || !s.players[side] || s.eliminated[side] || !Array.isArray(c.ids) || !c.ids.every((id3) => Number.isSafeInteger(id3) && id3 > 0)) return false;
  const p = { x: c.x, y: c.y, level: c.level ?? 0 };
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isSafeInteger(p.level) || !world.levels.some((l) => l.id === p.level) || p.x < 0 || p.y < 0 || p.x >= s.width || p.y >= s.height) return false;
  p.x = Math.floor(p.x) + 0.5;
  p.y = Math.floor(p.y) + 0.5;
  const key = p.level * s.width * s.height + tileOf(s, p);
  if (!s.visible[side]?.has(key)) return false;
  const fire = world.fires.find((f) => f.level === p.level && tileOf(s, f) === tileOf(s, p));
  if (c.type === "ignite" && (!flammable(state, p) || fire) || c.type === "firebreak" && !flammable(state, p) && !fire) return false;
  const actors = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && e.hp > 0 && e.kind === "unit" && !e.illusion && levelOf2(e) === p.level && e.cooldown <= 0 && (e.role === "worker" || c.type === "ignite" && e.role === "siege"));
  const actor2 = actors.sort((a, b) => a.id - b.id).find((e) => length2D(e.x - p.x, e.y - p.y) <= (e.role === "siege" ? unitFor(s, e).range : ENVIRONMENT_RULES.workerReach));
  const player = s.players[side], wood = c.type === "ignite" ? ENVIRONMENT_RULES.igniteWood : ENVIRONMENT_RULES.firebreakWood, ore = c.type === "ignite" ? ENVIRONMENT_RULES.igniteOre : 0;
  if (!actor2 || player.wood < wood || player.ore < ore) return false;
  player.wood -= wood;
  player.ore -= ore;
  actor2.cooldown = actor2.role === "siege" ? 1.5 : 0.8;
  actor2.animation = "attack";
  actor2.animTime = 0;
  if (c.type === "ignite") igniteWorldAt(s, p);
  else {
    for (const node of woodAt(s, p)) node.amount = 0;
    if (terrain(state, p) === "forest") setTerrain(state, p, "grass");
    world.fires = world.fires.filter((f) => f !== fire);
  }
  message(s, side, p, c.type === "ignite" ? "Forest ignited (15 wood, 5 ore)" : "Firebreak cleared (5 wood); timber is lost", "ability", actor2.id);
  return true;
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
var allied2 = (s, a, b) => !!s.players[a] && !!s.players[b] && s.teams[a] === s.teams[b];
var eligible2 = (e) => e.hp > 0 && e.kind === "unit" && !e.illusion;
function visible2(s, side, p) {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height && !!s.visible[side]?.has(fogKey(s, p));
}
function affordable(stock, cost2) {
  return resources.every((kind) => stock[kind] >= cost2[kind]);
}
function nonempty(stock) {
  return resources.some((kind) => stock[kind] > 0);
}
function services(site, side) {
  return site.kind === "village" && site.owner === side && site.loyalty[side] >= NEUTRAL_RULES.servicesLoyalty && site.supplied;
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
function validTarget(s, side, c) {
  const world = s.world;
  if (!world) return false;
  const site = world.sites.find((site2) => site2.id === c.target), creature = world.creatures.find((creature2) => creature2.id === c.target);
  if (c.type === "worldAttack") {
    if (creature) {
      const den = world.sites.find((site2) => site2.id === creature.site);
      return creature.hp > 0 && !!den && visible2(s, side, creature) && !(den.owner !== null && allied2(s, side, den.owner));
    }
    return !!site && site.kind !== "relic" && visible2(s, side, site) && !(site.owner !== null && allied2(s, side, site.owner)) && (world.creatures.some((creature2) => creature2.site === site.id && creature2.hp > 0) || site.kind === "village" && nonempty(site.reward));
  }
  if (!site || !visible2(s, side, site)) return false;
  if (c.type === "captureSite") return site.kind === "relic" && !(site.owner !== null && allied2(s, side, site.owner));
  if (c.type === "supportVillage") return site.kind === "village" && (!services(site, side) ? nonempty(site.request) && affordable(s.players[side], site.request) : !site.rewarded.includes(side) && nonempty(site.reward));
  return c.type === "recruitVillage" && services(site, side) && s.players[side].population < s.players[side].cap && affordable(site.reward, unitFor(s, side, "melee").cost);
}
function issueNeutralWorldCommand(s, side, command) {
  if (!orderKinds.includes(command.type)) return void 0;
  if (!s.world || !s.players[side] || s.eliminated[side] || s.winner !== null || s.draw) return false;
  const c = command;
  if (!Number.isSafeInteger(c.target) || c.target < 1 || !Array.isArray(c.ids) || !c.ids.length || c.ids.length > 8192 || new Set(c.ids).size !== c.ids.length) return false;
  const units = c.ids.map((id3) => s.entities.find((e) => e.id === id3));
  if (units.some((e) => !e || e.side !== side || !eligible2(e)) || !validTarget(s, side, c)) return false;
  const at = s.world.sites.find((site) => site.id === c.target) ?? s.world.creatures.find((creature) => creature.id === c.target);
  if (units.some((e) => !sameLevel(e, at))) return false;
  const assigned = c.type === "supportVillage" || c.type === "recruitVillage" ? [units[0]] : units;
  for (const e of assigned) {
    e.order = { type: c.type, target: c.target };
    delete e.orderQueue;
    e.path = [];
  }
  return true;
}

// src/core/simulation.ts
var distance2 = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var clamp = (n, a, b) => Math.max(a, Math.min(b, n));
var runtimes = /* @__PURE__ */ new WeakMap();
function runtime(s) {
  let r = runtimes.get(s);
  if (!r) {
    r = { aiBatchTurns: 0, aiDecisionAt: s.players.map(() => 0), aiDecisionTurns: s.players.map(() => 0), knownEnemyUnits: s.players.map(() => /* @__PURE__ */ new Map()), retreating: s.players.map(() => /* @__PURE__ */ new Map()), producedFighters: s.players.map(() => 0), fog: 0, ai: 0, aiTurns: 0, hits: [], routes: /* @__PURE__ */ new Map(), abilities: /* @__PURE__ */ new Map(), returning: /* @__PURE__ */ new Set(), queuedGather: /* @__PURE__ */ new Set(), aiWave: s.players.map(() => 0), initialScoutDispatched: s.players.map(() => false), expansionScout: s.players.map(() => null), expansionScoutDispatched: s.players.map(() => false), knownEnemyBuildings: s.players.map(() => /* @__PURE__ */ new Map()), enemyStartCleared: s.players.map(() => false), clearedEnemyStarts: s.players.map(() => /* @__PURE__ */ new Set()), searched: s.players.map(() => /* @__PURE__ */ new Set()) };
    runtimes.set(s, r);
  }
  return r;
}
function captureRuntime(s) {
  const r = runtime(s);
  return { aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => [...memory].map(([id3, o]) => [id3, { ...o }])), retreating: r.retreating.map((memory) => [...memory].map(([id3, o]) => [id3, { ...o }])), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits: r.hits.map((h) => ({ source: h.source.id, target: h.target.id, amount: h.amount, event: s.events.indexOf(h.event) })), routes: [...r.routes].map(([id3, value]) => [id3, { ...value }]), abilities: [...r.abilities], returning: [...r.returning], queuedGather: [...r.queuedGather], aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => [...memory].map(([id3, p]) => [id3, { ...p }])), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => [...players]), searched: r.searched.map((tiles) => [...tiles]) };
}
function restoreRuntime(s, r) {
  const entities = new Map(s.entities.map((e) => [e.id, e]));
  const hits = r.hits.map((h) => {
    const source = entities.get(h.source), target = entities.get(h.target), event = s.events[h.event];
    if (!source || !target || !event) throw new Error("Save runtime has an invalid hit reference.");
    return { source, target, amount: h.amount, event };
  });
  runtimes.set(s, { aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => new Map(memory.map(([id3, o]) => [id3, { ...o }]))), retreating: r.retreating.map((memory) => new Map(memory.map(([id3, o]) => [id3, { ...o }]))), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits, routes: new Map(r.routes.map(([id3, value]) => [id3, { ...value }])), abilities: new Map(r.abilities), returning: new Set(r.returning), queuedGather: new Set(r.queuedGather), aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => new Map(memory.map(([id3, p]) => [id3, { ...p }]))), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => new Set(players)), searched: r.searched.map((tiles) => new Set(tiles)) });
}
var MAX_ORDER_QUEUE = 32;
var alive2 = (e) => e.hp > 0;
function unitDef(s, e) {
  return unitFor(s, e);
}
function buildingDef(s, e) {
  return buildingFor(s, e);
}
function radius(s, e) {
  return e.kind === "building" ? buildingDef(s, e).size / 2 : 0.3;
}
function emit(s, type, e, target, text2) {
  const event = { type, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, side: e.side, target, text: text2, source: e.id };
  s.events.push(event);
  return event;
}
function spawnEntity(s, side, kind, role, x, y, progress = 1, definitionId2, level = 0) {
  const def = kind === "unit" ? unitFor(s, side, role, definitionId2) : buildingFor(s, side, role, definitionId2);
  const e = { id: s.nextId++, side, kind, role, x, y, ...s.world || level ? { level } : {}, hp: progress === 1 ? def.hp : Math.max(1, def.hp * 0.1), maxHp: def.hp, order: { type: "idle" }, cooldown: 0, progress, queue: [], trainProgress: 0, researchProgress: 0, facing: 2, animation: "idle", animTime: 0, momentum: 0, illusion: false, expires: 0, carried: 0, carriedKind: "wood", path: [] };
  if (s.content || definitionId2) e.definitionId = def.id;
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
function matchNumber(value, min, max, name, integer2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer2 && !Number.isSafeInteger(value)) throw new Error(`Invalid ${name}.`);
  return value;
}
function createMatch(config, options = {}) {
  const c = matchObject(config, ["schemaVersion", "map", "players", "rules", "content", "draft"], "match configuration");
  if (c.schemaVersion !== void 0 && c.schemaVersion !== 1) throw new Error("Unsupported match configuration version.");
  const content = c.content === void 0 ? void 0 : decodeContentBundle(c.content), factions = contentFactions(content);
  const m = matchObject(c.map, ["seed", "size", "biome", "world"], "match map");
  const seed = matchNumber(m.seed, 0, 4294967295, "map seed", true), size = m.size === void 0 ? "medium" : m.size;
  if (!["small", "medium", "large", "huge"].includes(size)) throw new Error("Invalid map size.");
  if (!Array.isArray(c.players) || c.players.length < 1 || c.players.length > 8) throw new Error("A match requires 1 to 8 players.");
  for (let i = 0; i < c.players.length; i++) if (!Object.hasOwn(c.players, i)) throw new Error("Player slots cannot contain gaps.");
  const rules = normalizeMatchRules(c.rules === void 0 ? {} : c.rules, content);
  if (rules.mode === "scenario" && !options.scenario) throw new Error("Scenario matches require a bound scenario definition.");
  const slots = /* @__PURE__ */ new Set(), teams = [], incomeFactors = [], populationLimits = [];
  const definitions = c.players.map((value, i) => {
    const p = matchObject(value, ["id", "teamId", "factionId", "controller", "startingSlot", "handicap", "ai"], "player");
    if (p.id !== i) throw new Error("Player IDs must be ordered contiguous slots starting at zero.");
    teams.push(matchNumber(p.teamId, 0, 7, "team", true));
    if (typeof p.factionId !== "string" || !Object.hasOwn(factions, p.factionId)) throw new Error("Unknown faction.");
    if (!["human", "ai", "external"].includes(p.controller)) throw new Error("Unknown controller.");
    const slot = matchNumber(p.startingSlot === void 0 ? i : p.startingSlot, 0, c.players instanceof Array ? c.players.length - 1 : 0, "starting slot", true);
    if (slots.has(slot)) throw new Error("Starting slots must be unique.");
    slots.add(slot);
    const h = p.handicap === void 0 ? {} : matchObject(p.handicap, ["startingResources", "incomeFactor", "populationCap"], "handicap");
    const resources2 = h.startingResources === void 0 ? rules.startingResources : matchObject(h.startingResources, ["wood", "ore", "crystal"], "starting resources");
    const wood = matchNumber(resources2.wood, 0, 1e9, "starting wood"), ore = matchNumber(resources2.ore, 0, 1e9, "starting ore"), crystal = matchNumber(resources2.crystal, 0, 1e9, "starting crystal");
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
  if (content) s.content = content;
  if (packageMap) initializeWorld(s, packageMap, m.biome ?? "temperate");
  if (!options.scenario) for (const side of playerSides(s)) {
    const { x, y } = s.starts[side], level = levelOf(s.starts[side]), dir = y < s.height / 2 ? 1 : -1;
    spawnEntity(s, side, "building", "hq", x, y, 1, void 0, level);
    for (let i = 0; i < 5; i++) spawnEntity(s, side, "unit", "worker", x + (-2 + i * 0.85) * dir, y + 3 * dir, 1, void 0, level);
    const starter = availableUnits(s, side).find((unit3) => unit3.role !== "worker" && !rules.disabledDefinitionIds.includes(unit3.id));
    if (starter) spawnEntity(s, side, "unit", starter.role, x + 3 * dir, y + dir, 1, starter.id.includes(":") ? starter.id : void 0, level);
  }
  for (const resource of map.resources) s.resources.push({ ...resource, id: s.nextId++ });
  initializeWorldSites(s);
  initializeObjectives(s);
  if (s.rules.draft.enabled && s.draft.status === "complete") finalizeDraft(s);
  refreshVisibility(s);
  updatePopulation(s);
  return s;
}
function finalizeDraft(s) {
  for (const side of playerSides(s)) {
    const available = availableUnits(s, side), picked = s.draft.picks[side].map((id3) => available.find((u) => u.id === id3)).find((u) => u && u.role !== "worker");
    if (!picked) throw new Error("Completed draft requires a combat unit for every player.");
    const starters = s.entities.filter((e) => e.side === side && e.kind === "unit" && e.role !== "worker" && e.hp > 0);
    for (const unit3 of starters) {
      s.entities = s.entities.filter((e) => e !== unit3);
      spawnEntity(s, side, "unit", picked.role, unit3.x, unit3.y, 1, picked.id, levelOf(unit3));
    }
  }
  if (s.rules.mode === "survival") s.objectives.survival.nextWaveTick = s.tick + s.rules.survival.intervalTicks;
  updatePopulation(s);
}
function isGameOver(s) {
  return s.winner !== null || s.draw;
}
function isVisible(s, side, x, y, level = 0) {
  return x >= 0 && y >= 0 && x < s.width && y < s.height && !!s.visible[side]?.has(fogKey(s, { x, y, level }));
}
function refreshVisibility(s) {
  updateBeacons(s, false);
  for (const visible4 of s.visible) visible4.clear();
  for (const e of s.entities) {
    if (!alive2(e) || e.kind === "building" && buildingDef(s, e).tags?.includes("beacon") && !e.beacon?.connected) continue;
    const sight = ((e.kind === "unit" ? unitDef(s, e).sight : buildingDef(s, e).sight) + highGroundSightBonus(s, e)) * environmentalSightFactor(s, e), side = e.side;
    for (let y = Math.max(0, Math.floor(e.y - sight)); y <= Math.min(s.height - 1, Math.ceil(e.y + sight)); y++) for (let x = Math.max(0, Math.floor(e.x - sight)); x <= Math.min(s.width - 1, Math.ceil(e.x + sight)); x++) if (length2D(x + 0.5 - e.x, y + 0.5 - e.y) <= sight && terrainLineOfSight(s, e, { x: x + 0.5, y: y + 0.5, level: levelOf(e) })) {
      const key = fogKey(s, { x, y, level: levelOf(e) });
      const recipients = e.beacon?.connected ? playerSides(s).filter((other) => isAllied(s, side, other)) : [side];
      for (const recipient of recipients) {
        s.visible[recipient].add(key);
        s.explored[recipient].add(key);
      }
    }
  }
  if (s.sharedVision) for (const team of new Set(s.teams)) {
    const members = playerSides(s).filter((side) => s.teams[side] === team), visible4 = /* @__PURE__ */ new Set(), explored = /* @__PURE__ */ new Set();
    for (const side of members) {
      for (const tile of s.visible[side]) visible4.add(tile);
      for (const tile of s.explored[side]) explored.add(tile);
    }
    for (const side of members) {
      s.visible[side].clear();
      for (const tile of visible4) s.visible[side].add(tile);
      for (const tile of explored) s.explored[side].add(tile);
    }
  }
}
function updatePopulation(s) {
  for (const side of playerSides(s)) {
    const es = s.entities.filter((e) => e.side === side && alive2(e));
    s.players[side].population = es.filter((e) => e.kind === "unit" && !e.illusion).length;
    s.players[side].cap = Math.min(s.populationLimits[side], es.filter((e) => e.kind === "building" && e.progress === 1).reduce((v, e) => v + (e.role === "hq" ? 12 : e.role === "depot" ? 10 : 0), 0));
  }
}
function reserved(s, side) {
  return s.entities.filter((e) => e.side === side && alive2(e)).reduce((v, e) => v + e.queue.length, 0);
}
function footprintOverlap(e, x, y, size) {
  return Math.abs(e.x - x) < size / 2 + 0.35 && Math.abs(e.y - y) < size / 2 + 0.35;
}
function shovePoint(s, x, y, size, level = 0) {
  for (let ring = size / 2 + 1; ring < size / 2 + 5; ring += 0.5) for (const [dx, dy] of DIRECTIONS_32) {
    const px = x + dx * ring, py = y + dy * ring;
    if ((Math.abs(px - x) >= size / 2 + 0.27 || Math.abs(py - y) >= size / 2 + 0.27) && walkable(s, px, py, level)) return { x: px, y: py, ...level ? { level } : {} };
  }
}
function rallyWalkable(s, side, x, y, level = 0) {
  const fogged = /* @__PURE__ */ new Set();
  for (const e of s.entities) if (e.kind === "building" && alive2(e) && isHostile(s, e.side, side) && !isVisible(s, side, e.x, e.y, levelOf(e))) fogged.add(e);
  if (!fogged.size) return walkable(s, x, y, level);
  const kept = s.entities;
  s.entities = kept.filter((e) => !fogged.has(e));
  try {
    return walkable(s, x, y, level);
  } finally {
    s.entities = kept;
  }
}
function commandDestination(s, side, to, from) {
  const observed = { ...s, entities: s.entities.filter((e) => e.side === side || isVisible(s, side, e.x, e.y, levelOf(e))), resources: s.resources.filter((r) => isVisible(s, side, r.x, r.y, levelOf(r))) };
  return openDestination(observed, to, from);
}
function refundCost(s, side, role, id3, paid) {
  const cost2 = paid ?? unitFor(s, side, role, id3).cost, p = s.players[side];
  p.wood += cost2.wood;
  p.ore += cost2.ore;
  p.crystal += cost2.crystal;
}
function refundQueue(s, e) {
  if (!e.queue.length) return;
  for (const [index2, role] of e.queue.entries()) refundCost(s, e.side, role, e.queueDefinitionIds?.[index2], e.queuePaidCosts?.[index2]);
  e.queue = [];
  delete e.queueDefinitionIds;
  delete e.queuePaidCosts;
  e.trainProgress = 0;
}
function canPlace(s, side, role, x, y, definitionId2, level = 0) {
  if (!s.players[side] || level !== 0 && !s.world?.levels[level]) return false;
  const def = definitionId2 ? availableBuildings(s, side).find((d) => d.id === definitionId2 && d.role === role) : factionFor(s, side).buildings[role];
  if (!def || playerAge(s.players[side]) < buildingAgeRequired(def) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = def.size / 2;
  if (x - r < 0.5 || y - r < 0.5 || x + r > s.width - 0.5 || y + r > s.height - 0.5) return false;
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) if (!isVisible(s, side, x + dx, y + dy, level)) return false;
  for (let ty = Math.floor(y - r); ty < Math.ceil(y + r); ty++) for (let tx = Math.floor(x - r); tx < Math.ceil(x + r); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5, level)].buildable) return false;
  if (s.entities.some((e) => alive2(e) && levelOf(e) === level && e.kind === "building" && Math.abs(e.x - x) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4) && Math.abs(e.y - y) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4))) return false;
  if (s.entities.some((e) => alive2(e) && levelOf(e) === level && e.kind === "unit" && isHostile(s, e.side, side) && footprintOverlap(e, x, y, def.size))) return false;
  if (s.resources.some((e) => e.amount > 0 && levelOf(e) === level && Math.abs(e.x - x) < r + 0.8 && Math.abs(e.y - y) < r + 0.8)) return false;
  return true;
}
function assign(s, e, order2) {
  if (e.siegeMode?.deployed && (order2.type === "move" || order2.type === "attackMove")) e.siegeMode.deployed = false;
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
function issueCommand(s, side, c) {
  if (!validateCommand(c) || !scenarioCommandPermitted(s, side, c)) return false;
  const eventStart = s.events.length, rt = runtime(s), accepted = applyCommand(s, side, c);
  if (accepted && !rt.stepping) {
    if (rt.hits.length) resolveHits(s);
    if (c.type === "ability" || c.type === "engineerBuild") refreshVisibility(s);
  }
  if (accepted && !rt.stepping && !isScenarioScriptedCommand(s)) {
    afterScenarioCommand(s, side, c, eventStart);
    notifyCommand(s, side, c);
  }
  return accepted;
}
function applyCommand(s, side, c) {
  if (!validateCommand(c) || isGameOver(s) || !s.players[side] || s.eliminated[side]) return false;
  if (c.type === "draftChoice") {
    const accepted = applyDraftChoice(s.draft, s.rules, draftPlayers(s), side, c.definitionId, s.content);
    if (accepted && s.draft.status === "complete") finalizeDraft(s);
    return accepted;
  }
  if (s.draft.status !== "complete") return false;
  if (c.type === "collectRelic") return collectRelic(s, side, c.id, c.relicId);
  if (c.type === "dropRelic") return dropRelic(s, side, c.id);
  const p = s.players[side], f = factionFor(s, side);
  const environmentAction = issueEnvironmentCommand(s, side, c);
  if (environmentAction !== void 0) return environmentAction;
  const worldAction = issueWorldAction(s, side, c, (e, o) => {
    commandOrder(s, e, o);
  });
  if (worldAction !== void 0) return worldAction;
  if (c.type === "recruitVillage" && !definitionAllowed(s, side, unitFor(s, side, "melee").id)) return false;
  const neutralAction = issueNeutralWorldCommand(s, side, c);
  if (neutralAction !== void 0) {
    if (neutralAction && "ids" in c) {
      for (const actor2 of s.entities) if (c.ids.includes(actor2.id) && actor2.side === side && ["worldAttack", "captureSite", "supportVillage", "recruitVillage"].includes(actor2.order.type)) assign(s, actor2, { ...actor2.order });
    }
    return neutralAction;
  }
  if (c.type === "toggleGate") {
    let changed = false;
    for (const gate of s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive2(e) && e.role === "gate" && e.progress === 1)) {
      if (gate.gateOpen && s.entities.some((e) => alive2(e) && sameLevel(e, gate) && e.kind === "unit" && footprintOverlap(e, gate.x, gate.y, buildingDef(s, gate).size))) continue;
      gate.gateOpen = !gate.gateOpen;
      changed = true;
    }
    return changed;
  }
  if (c.type === "setRally" || c.type === "clearRally") {
    const producers = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive2(e) && e.kind === "building" && (e.role === "hq" || e.role === "barracks"));
    if (!producers.length || c.type === "setRally" && producers.some((e) => levelOf(e) !== (c.level ?? 0))) return false;
    if (c.type === "setRally") {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x < 0.5 || c.y < 0.5 || c.x > s.width - 0.5 || c.y > s.height - 0.5) return false;
      if (!s.explored[side].has(fogKey(s, c))) return false;
      if (!rallyWalkable(s, side, c.x, c.y, c.level ?? 0)) return false;
    }
    for (const e of producers) {
      if (c.type === "clearRally") delete e.rally;
      else e.rally = { x: c.x, y: c.y, ...c.level === void 0 ? {} : { level: c.level } };
    }
    return true;
  }
  if (c.type === "cancelTrain") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive2(e2) && e2.kind === "building");
    if (!e || !Number.isInteger(c.index) || c.index < 0 || c.index >= e.queue.length) return false;
    refundCost(s, side, e.queue[c.index], e.queueDefinitionIds?.[c.index], e.queuePaidCosts?.[c.index]);
    e.queue.splice(c.index, 1);
    e.queueDefinitionIds?.splice(c.index, 1);
    e.queuePaidCosts?.splice(c.index, 1);
    if (c.index === 0) e.trainProgress = 0;
    return true;
  }
  if (c.type === "reorderTrain") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive2(e2) && e2.kind === "building" && e2.progress === 1 && (e2.role === "hq" || e2.role === "barracks"));
    if (!e || !Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 1 || c.to < 1 || c.from >= e.queue.length || c.to >= e.queue.length || c.from === c.to) return false;
    const [role] = e.queue.splice(c.from, 1);
    e.queue.splice(c.to, 0, role);
    if (e.queueDefinitionIds) {
      const [id3] = e.queueDefinitionIds.splice(c.from, 1);
      e.queueDefinitionIds.splice(c.to, 0, id3);
      if (e.queuePaidCosts) {
        const [cost2] = e.queuePaidCosts.splice(c.from, 1);
        e.queuePaidCosts.splice(c.to, 0, cost2);
      }
    }
    return true;
  }
  if (c.type === "train") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive2(e2) && e2.kind === "building" && e2.progress === 1);
    const d = c.definitionId ? availableUnits(s, side).find((d2) => d2.id === c.definitionId && d2.role === c.role) : f.units[c.role];
    if (!e || !d || d.tags?.includes("hero") && heroRecruitmentReason(s, side, d.id) || !definitionAllowed(s, side, d.id) || playerAge(p) < (d.age ?? 1) || (c.role === "worker" ? e.role !== "hq" : e.role !== "barracks") || e.queue.length >= 5 || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || p.population + reserved(s, side) >= p.cap) return false;
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
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side && alive2(e2) && e2.kind === "building" && e2.progress === 1);
    const d = (() => {
      try {
        return upgradeFor(s, side, c.upgrade);
      } catch {
        return void 0;
      }
    })();
    if (!e || !d || !definitionAllowed(s, side, c.upgrade) || d.building !== e.role || e.research || researchRequirement(s, side, c.upgrade) || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal) return false;
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    e.research = c.upgrade;
    if (d.exclusiveGroup) e.researchPaidCost = { ...d.cost };
    e.researchProgress = 0;
    emit(s, "research", e, void 0, `${d.name} started`);
    return true;
  }
  if (c.type === "promote") return promote(s, side, c.id, c.promotion);
  if (c.type === "recoverArtifact") return recoverArtifact(s, side, c.id, c.artifact);
  if (c.type === "equipArtifact") return equipArtifact(s, side, c.id, c.artifact);
  if (c.type === "unequipArtifact") return unequipArtifact(s, side, c.id, c.slot);
  if (c.type === "dropArtifact") return dropArtifact(s, side, c.id, c.artifact);
  if (c.type === "fieldRepair") return fieldRepair(s, side, c.id, c.target);
  if (c.type === "engineerBuild") return engineerBuild(s, side, c, specialistHooks(s));
  if (!("ids" in c)) return false;
  const units = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side && alive2(e) && e.kind === "unit" && !e.illusion);
  if (!units.length) return false;
  if (c.type === "build") {
    const level = c.level ?? 0, workers2 = units.filter((e) => e.role === "worker" && levelOf(e) === level);
    const d = c.definitionId ? availableBuildings(s, side).find((d2) => d2.id === c.definitionId && d2.role === c.role) : f.buildings[c.role];
    if (!workers2.length || !d || !isNormalBuildingDefinition(d) || playerAge(p) < buildingAgeRequired(d) || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || !canPlace(s, side, c.role, c.x, c.y, c.definitionId, level)) return false;
    const overlapping = s.entities.filter((e) => e.kind === "unit" && alive2(e) && levelOf(e) === level && isAllied(s, e.side, side) && footprintOverlap(e, c.x, c.y, d.size));
    const shoves = [];
    for (const u of overlapping) {
      const dest = shovePoint(s, c.x, c.y, d.size, level);
      if (!dest) return false;
      shoves.push({ e: u, ...dest });
    }
    p.wood -= d.cost.wood;
    p.ore -= d.cost.ore;
    p.crystal -= d.cost.crystal;
    const b = spawnEntity(s, side, "building", c.role, c.x, c.y, 0, c.definitionId, level);
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
      const special = specialistAbility(s, e, c, specialistHooks(s));
      if (special ?? useAbility(s, e)) success = true;
    }
    return success;
  }
  if (c.type === "move" || c.type === "attackMove") {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return false;
    const width = Math.ceil(Math.sqrt(units.length)), dir = s.starts[side].y < s.height / 2 ? 1 : -1;
    const destinations = units.map((e, i) => {
      const dx = units.length === 1 ? 0 : (i % width - (width - 1) / 2) * 0.8 * dir, dy = units.length === 1 ? 0 : (Math.floor(i / width) - (width - 1) / 2) * 0.8 * dir;
      return commandDestination(s, side, { x: clamp(c.x + dx, 0.6, s.width - 0.6), y: clamp(c.y + dy, 0.6, s.height - 0.6), ...c.level === void 0 ? {} : { level: c.level } }, e);
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
  const target = c.type === "gather" ? s.resources.find((e) => e.id === c.target && e.amount > 0) : s.entities.find((e) => e.id === c.target && alive2(e));
  if (!target || !isVisible(s, side, target.x, target.y, levelOf(target))) return false;
  if (c.type === "attack") {
    if (!("side" in target) || !isHostile(s, target.side, side)) return false;
    return units.filter((e) => sameLevel(e, target)).reduce((accepted, e) => commandOrder(s, e, { type: "attack", target: target.id }, c.queued) || accepted, false);
  }
  const workers = units.filter((e) => e.role === "worker" && sameLevel(e, target));
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
    const raisedDefinition = availableUnits(s, e.side).find((unit3) => unit3.role === "melee" && definitionAllowed(s, e.side, unit3.id));
    if (!raisedDefinition) return false;
    updatePopulation(s);
    let count = 0;
    for (const corpse of [...s.corpses].sort((a, b) => distance2(e, a) - distance2(e, b))) {
      if (count >= 2 || s.players[e.side].population + reserved(s, e.side) >= s.players[e.side].cap) break;
      if (corpse.expires <= s.time || distance2(e, corpse) > 6 || !isVisible(s, e.side, corpse.x, corpse.y, levelOf(corpse)) || !walkable(s, corpse.x, corpse.y, levelOf(corpse))) continue;
      const raised = spawnEntity(s, e.side, "unit", "melee", corpse.x, corpse.y, 1, raisedDefinition.id, levelOf(corpse));
      raised.hp = raised.maxHp * 0.5;
      raised.raised = true;
      raised.expires = s.time + 35;
      raised.order = { type: "attackMove", x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } };
      s.corpses = s.corpses.filter((c) => c.id !== corpse.id);
      count++;
      updatePopulation(s);
    }
    if (!count) return false;
    runtime(s).abilities.set(e.id, s.time + 22);
  } else if (ability === "illusion") {
    let placed = 0;
    for (const offset of [-0.6, 0.6]) {
      const desired = { x: clamp(e.x + offset, 0.5, s.width - 0.5), y: clamp(e.y - offset, 0.5, s.height - 0.5), ...e.level === void 0 ? {} : { level: e.level } };
      const point2 = walkable(s, desired.x, desired.y, levelOf(e)) ? desired : openDestination(s, desired, e);
      if (!point2) continue;
      const clone2 = spawnEntity(s, e.side, "unit", e.role, point2.x, point2.y, 1, e.definitionId, levelOf(e));
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
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive2(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      ally.surgeUntil = s.time + 6;
      affected = true;
    }
    if (!affected) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "ward") {
    let restored = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive2(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5 && (ally.shield ?? 0) < (ally.maxShield ?? 0)) {
      ally.shield = Math.min(ally.maxShield, (ally.shield ?? 0) + 24);
      restored = true;
    }
    if (!restored) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "heal") {
    let healed = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive2(ally) && ally.kind === "unit" && !ally.illusion && distance2(e, ally) < 5 && ally.hp < ally.maxHp) {
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
function emplaced(s, e) {
  return e.entrenchedAt !== void 0 && s.time - e.entrenchedAt >= 3;
}
function die(s, e, text2) {
  if (e.animation === "death") return;
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
  emit(s, "death", e, void 0, text2);
}
function resolveHits(s) {
  const groups = /* @__PURE__ */ new Map();
  for (const hit of runtime(s).hits) {
    const group = groups.get(hit.target) ?? [];
    group.push(hit);
    groups.set(hit.target, group);
  }
  for (const [target, hits] of groups) {
    if (!alive2(target)) continue;
    const total = hits.reduce((n, h) => n + h.amount, 0), absorbed = Math.min(target.shield ?? 0, total), actual = Math.min(target.hp, total - absorbed) + absorbed;
    target.shield = Math.max(0, (target.shield ?? 0) - absorbed);
    target.hp = Math.max(0, target.hp - (total - absorbed));
    target.lastDamagedAt = s.time;
    for (const hit of hits) {
      hit.event.amount = total ? actual * hit.amount / total : 0;
      const attacker = s.entities.find((e) => e.id === hit.source.id);
      if (attacker && attacker.side === hit.source.side) creditCombat(s, attacker, target, hit.event.amount);
    }
    if (actual > 0 && hits.some((hit) => {
      const source = s.entities.find((e) => e.id === hit.source.id);
      return (hit.event.amount ?? 0) > 0 && s.teams[hit.source.side] !== s.teams[target.side] && (!source || !source.illusion && !source.raised);
    })) recordCombatExposure(s, target);
    target.lastAttacker = hits.reduce((best, h) => h.amount > best.amount ? h : best).source.id;
    if (target.hp === 0) {
      const killer = s.entities.find((e) => e.id === target.lastAttacker);
      if (killer && killer.side === hits.reduce((best, h) => h.amount > best.amount ? h : best).source.side) creditCombat(s, killer, target, 0, true);
      die(s, target);
    }
  }
  if (s.rules.standardDefeat) {
    s.eliminated = playerSides(s).map((side) => !s.entities.some((e) => e.side === side && e.role === "hq" && alive2(e) && e.progress === 1));
    const livingTeams = [...new Set(s.teams.filter((_, side) => !s.eliminated[side]))];
    if (!livingTeams.length) s.draw = true;
    else if (livingTeams.length === 1 && new Set(s.teams).size > 1) {
      s.winningTeam = livingTeams[0];
      s.winner = s.teams.findIndex((team) => team === s.winningTeam);
    }
  }
  runtime(s).hits = [];
}
function spawnDefinition(s, side, kind, definitionId2, x, y, progress = 1, level) {
  const d = kind === "unit" ? availableUnits(s, side).find((d2) => d2.id === definitionId2) : availableBuildings(s, side).find((d2) => d2.id === definitionId2);
  if (!d) throw new Error("Definition is absent from player content.");
  return spawnEntity(s, side, kind, d.role, x, y, progress, definitionId2, level ?? 0);
}
function specialistHooks(s) {
  return { die: (actor2, text2) => die(s, actor2, text2), spawn: (...args) => spawnDefinition(s, ...args), setTerrain: (point2, kind) => setWorldTerrain(s, point2, kind), damage: (source, target, raw, options) => {
    if (target.hp <= 0) return;
    if (options?.ranged) raw *= projectileEnvironment(s, source, target).damageFactor * highGroundDamageFactor(s, source, target);
    const def = target.kind === "unit" ? unitFor(s, target) : void 0, armor = options?.armorPiercing ? 0 : (def?.armor ?? 3) + progressionStats(s, target).armor + (emplaced(s, target) ? 2 : 0) + s.players[target.side].upgrades.reduce((sum, id3) => {
      const u = upgradeFor(s, target.side, id3);
      return sum + (def && upgradeAppliesTo(u, def) ? u.effects.armor ?? 0 : 0);
    }, 0), event = emit(s, "attack", source, target.id);
    runtime(s).hits.push({ source, target, amount: Math.max(1, raw - armor), event });
  } };
}

// src/core/saves.ts
var SAVE_VERSION = 3;
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
var RESOURCE_KINDS = ["wood", "ore", "crystal"];
function bad2(path, detail) {
  throw new Error(`Invalid save at ${path}: ${detail}.`);
}
function object2(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad2(path, "expected an object");
  const record3 = value;
  for (const key of required) if (!Object.hasOwn(record3, key)) bad2(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record3)) if (!required.includes(key) && !optional.includes(key)) bad2(`${path}.${key}`, "unknown field");
  return record3;
}
function number2(value, path, min = 0, max = MAX_VALUE, integer2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer2 && !Number.isSafeInteger(value)) bad2(path, `expected ${integer2 ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function flag2(value, path) {
  if (typeof value !== "boolean") bad2(path, "expected a boolean");
  return value;
}
function choice2(value, path, choices) {
  if (typeof value !== "string" || !choices.includes(value)) bad2(path, "unknown value");
  return value;
}
function list2(value, path, max, length2) {
  if (!Array.isArray(value) || value.length > max || length2 !== void 0 && value.length !== length2) bad2(path, "invalid array length");
  return value;
}
function optionalNumber(record3, key, path, min = 0, max = MAX_VALUE, integer2 = false) {
  if (record3[key] !== void 0) number2(record3[key], `${path}.${key}`, min, max, integer2);
}
function optionalFlag(record3, key, path) {
  if (record3[key] !== void 0) flag2(record3[key], `${path}.${key}`);
}
function id2(value, path, c) {
  return number2(value, path, 1, c.nextId - 1, true);
}
function point(value, path, c) {
  const p = object2(value, path, ["x", "y"], ["level"]);
  number2(p.x, `${path}.x`, 0, c.width);
  number2(p.y, `${path}.y`, 0, c.height);
  optionalNumber(p, "level", path, 0, c.levels - 1, true);
}
function coordinates(value, path, c) {
  number2(value.x, `${path}.x`, 0, c.width);
  number2(value.y, `${path}.y`, 0, c.height);
  optionalNumber(value, "level", path, 0, c.levels - 1, true);
}
function order(value, path, c) {
  const o = object2(value, path, ["type"], ["x", "y", "target", "transition", "level"]);
  choice2(o.type, `${path}.type`, ["idle", "hold", "move", "attackMove", "attack", "gather", "build", "traverse", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"]);
  if (o.type === "move" || o.type === "attackMove") {
    object2(value, path, ["type", "x", "y"], ["level"]);
    coordinates(o, path, c);
  } else if (["attack", "gather", "build", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"].includes(o.type)) {
    object2(value, path, ["type", "target"]);
    id2(o.target, `${path}.target`, c);
  } else if (o.type === "traverse") {
    object2(value, path, ["type", "transition"]);
    number2(o.transition, `${path}.transition`, 1, 2147483647, true);
  } else object2(value, path, ["type"]);
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
function fog(value, path, c) {
  return list2(value, path, c.playerCount, c.playerCount).map((v, i) => uniqueIds(list2(v, `${path}[${i}]`, c.cells), `${path}[${i}]`, c.cells - 1));
}
function validateEntity(value, path, c) {
  const e = object2(value, path, ["id", "side", "kind", "role", "x", "y", "hp", "maxHp", "order", "cooldown", "progress", "queue", "trainProgress", "researchProgress", "facing", "animation", "animTime", "momentum", "illusion", "expires", "carried", "carriedKind", "path"], ["level", "definitionId", "definitionFaction", "queueDefinitionIds", "queuePaidCosts", "orderQueue", "research", "researchPaidCost", "rally", "gateOpen", "lastAttacker", "abilityReadyAt", "entrenchedAt", "raised", "shield", "maxShield", "lastDamagedAt", "surgeUntil", "veteran", "equipment", "specialistBuffs", "siegeMode", "burning", "beacon"]);
  const entityId = id2(e.id, `${path}.id`, c);
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
  choice2(e.carriedKind, `${path}.carriedKind`, RESOURCE_KINDS);
  if (e.definitionFaction !== void 0) {
    choice2(e.definitionFaction, `${path}.definitionFaction`, Object.keys(contentFactions(c.state.content)));
    if (e.kind !== "unit" || e.role !== "siege") bad2(`${path}.definitionFaction`, "only captured siege can retain another faction definition");
  }
  if (e.definitionId !== void 0) {
    if (typeof e.definitionId !== "string" || e.definitionId.length > 100) bad2(`${path}.definitionId`, "invalid ID");
    try {
      entityDefinition(c.state, e);
    } catch {
      bad2(`${path}.definitionId`, "definition is absent from the pinned faction or has another role");
    }
  }
  const queue = list2(e.queue, `${path}.queue`, 5);
  queue.forEach((role, i) => {
    choice2(role, `${path}.queue[${i}]`, UNIT_ROLES);
    if (e.kind !== "building" || e.role !== "hq" && e.role !== "barracks" || e.role === "hq" && role !== "worker" || e.role === "barracks" && role === "worker") bad2(`${path}.queue`, "invalid producer or recruit");
  });
  if (e.queueDefinitionIds !== void 0) {
    list2(e.queueDefinitionIds, `${path}.queueDefinitionIds`, 5, queue.length).forEach((id3, i) => {
      const def = availableUnits(c.state, e.side).find((d) => d.id === id3);
      if (!def || def.role !== queue[i]) bad2(`${path}.queueDefinitionIds[${i}]`, "definition is absent from the pinned faction or has another role");
    });
  } else if (c.state.content && queue.length) bad2(`${path}.queueDefinitionIds`, "pinned production requires definition IDs");
  if (e.queuePaidCosts !== void 0) {
    list2(e.queuePaidCosts, `${path}.queuePaidCosts`, 5, queue.length).forEach((value2, i) => {
      const paid = object2(value2, `${path}.queuePaidCosts[${i}]`, ["wood", "ore", "crystal"]);
      for (const key of RESOURCE_KINDS) number2(paid[key], `${path}.queuePaidCosts[${i}].${key}`, 0, 1e5);
      const expected = availableUnits(c.state, e.side).find((d) => d.id === e.queueDefinitionIds?.[i])?.cost;
      if (!expected || RESOURCE_KINDS.some((key) => paid[key] !== expected[key])) bad2(`${path}.queuePaidCosts[${i}]`, "paid cost differs from pinned definition");
    });
  } else if (c.state.content && queue.length) bad2(`${path}.queuePaidCosts`, "pinned production requires charged cost records");
  list2(e.path, `${path}.path`, c.cells * 16).forEach((p, i) => point(p, `${path}.path[${i}]`, c));
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
    for (const key of RESOURCE_KINDS) {
      number2(paid[key], `${path}.researchPaidCost.${key}`, 0, 1e5);
      if (paid[key] !== expected[key]) bad2(`${path}.researchPaidCost`, "charged cost differs from pinned research");
    }
  }
  if (e.rally !== void 0) point(e.rally, `${path}.rally`, c);
  for (const key of ["gateOpen", "raised"]) optionalFlag(e, key, path);
  if (e.lastAttacker !== void 0) id2(e.lastAttacker, `${path}.lastAttacker`, c);
  for (const key of ["abilityReadyAt", "entrenchedAt", "lastDamagedAt", "surgeUntil", "shield", "maxShield"]) optionalNumber(e, key, path);
  if (e.shield !== void 0 && e.shield > (e.maxShield ?? 0)) bad2(`${path}.shield`, "shield exceeds capacity");
}
function playersArray(value, path, c, check) {
  list2(value, path, c.playerCount, c.playerCount).forEach((v, i) => check(v, `${path}[${i}]`));
}
function entries(value, path, max, c, check) {
  const seen = /* @__PURE__ */ new Set();
  list2(value, path, max).forEach((entry, i) => {
    const p = `${path}[${i}]`, parts = list2(entry, p, 2, 2), key = id2(parts[0], `${p}[0]`, c);
    if (seen.has(key)) bad2(path, "duplicate map key");
    seen.add(key);
    check(parts[1], `${p}[1]`);
  });
}
function validateRuntime(value, c, version) {
  const fields2 = ["fog", "ai", "aiTurns", "hits", "routes", "abilities", "returning", "queuedGather", "aiWave", "initialScoutDispatched", "expansionScout", "expansionScoutDispatched", "knownEnemyBuildings", "enemyStartCleared", "searched"];
  const path = "runtime", r = object2(value, path, version === 1 ? fields2 : version === 2 ? [...fields2, "clearedEnemyStarts"] : [...fields2, "clearedEnemyStarts", "aiBatchTurns", "aiDecisionAt", "aiDecisionTurns", "knownEnemyUnits", "retreating", "producedFighters"]);
  number2(r.fog, "runtime.fog", -0.25, 0.2);
  number2(r.ai, "runtime.ai", -0.25, 1);
  number2(r.aiTurns, "runtime.aiTurns", 0, MAX_VALUE, true);
  list2(r.hits, "runtime.hits", c.maxEntities).forEach((v, i) => {
    const p = `runtime.hits[${i}]`, h = object2(v, p, ["source", "target", "amount", "event"]);
    for (const key of ["source", "target"]) if (!c.entityIds.has(id2(h[key], `${p}.${key}`, c))) bad2(`${p}.${key}`, "missing hit entity");
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
    if (v !== null) id2(v, p, c);
  });
  playersArray(r.knownEnemyBuildings, "runtime.knownEnemyBuildings", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
    const b = object2(value2, q, ["x", "y", "role"], ["level"]);
    coordinates(b, q, c);
    choice2(b.role, `${q}.role`, BUILDING_ROLES);
  }));
  playersArray(r.searched, "runtime.searched", c, (v, p) => uniqueIds(list2(v, p, c.cells), p, c.cells - 1));
  if (version >= 2) playersArray(r.clearedEnemyStarts, "runtime.clearedEnemyStarts", c, (v, p) => uniqueIds(list2(v, p, c.playerCount), p, c.playerCount - 1));
  if (version === 3) {
    number2(r.aiBatchTurns, "runtime.aiBatchTurns", 0, MAX_VALUE, true);
    playersArray(r.aiDecisionAt, "runtime.aiDecisionAt", c, (v, p) => number2(v, p, 0, c.time + 3));
    for (const key of ["aiDecisionTurns", "producedFighters"]) playersArray(r[key], `runtime.${key}`, c, (v, p) => number2(v, p, 0, MAX_VALUE, true));
    playersArray(r.knownEnemyUnits, "runtime.knownEnemyUnits", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
      const observation = object2(value2, q, ["x", "y", "role", "seenAt", "hpFraction"], ["level"]);
      coordinates(observation, q, c);
      choice2(observation.role, `${q}.role`, UNIT_ROLES.filter((role) => role !== "worker"));
      number2(observation.seenAt, `${q}.seenAt`, 0, c.time);
      number2(observation.hpFraction, `${q}.hpFraction`, 0, 1);
    }));
    playersArray(r.retreating, "runtime.retreating", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
      const record3 = object2(value2, q, ["until", "produced", "afterId"]);
      number2(record3.until, `${q}.until`, 0, c.time + 30);
      number2(record3.produced, `${q}.produced`, 0, MAX_VALUE, true);
      number2(record3.afterId, `${q}.afterId`, 0, c.nextId - 1, true);
    }));
  }
}
function validate(envelope, version) {
  const save = object2(envelope, "save", ["format", "version", "state", "runtime"]);
  if (save.format !== "orcs-vs-fairies-save") bad2("format", "unknown save format");
  if (save.version !== version) bad2("version", `unsupported version ${String(save.version)}`);
  const s = object2(save.state, "state", version === 1 ? STATE_FIELDS : version === 2 ? [...STATE_FIELDS, ...TEAM_FIELDS] : [...STATE_FIELDS, ...TEAM_FIELDS, "aiConfigs"], version === 3 ? ["content", "world", "specialists", "rules", "objectives", "draft", "scenario"] : []);
  if (s.content !== void 0) s.content = decodeContentBundle(s.content);
  const playerCount = list2(s.players, "state.players", version === 1 ? 2 : MAX_PLAYERS, version === 1 ? 2 : void 0).length;
  if (playerCount === 0) bad2("state.players", "expected between 1 and 8 players");
  const width = number2(s.width, "state.width", 8, 256, true), height = number2(s.height, "state.height", 8, 256, true), nextId = number2(s.nextId, "state.nextId", 1, MAX_ID2, true);
  const levels = s.world === void 0 ? 1 : Array.isArray(s.world.levels) ? s.world.levels.length : 0;
  if (levels < 1 || levels > 2) bad2("world.levels", "expected1 or2 levels");
  const c = { state: s, levels, width, height, cells: width * height * levels, time: number2(s.time, "state.time"), nextId, playerCount, maxEntities: version === 1 ? 4096 : MAX_ENTITIES, entityIds: /* @__PURE__ */ new Set(), entities: /* @__PURE__ */ new Map(), resourceIds: /* @__PURE__ */ new Set(), eventCount: 0 };
  if (version === 3) playersArray(s.aiConfigs, "state.aiConfigs", c, (v, p) => {
    const config = object2(v, p, ["difficulty", "personality", "opening"]);
    choice2(config.difficulty, `${p}.difficulty`, ["easy", "normal", "hard"]);
    choice2(config.personality, `${p}.personality`, ["balanced", "rush", "fortify", "expand", "raid"]);
    choice2(config.opening, `${p}.opening`, ["infantry-rush", "tower-defense", "fast-expansion", "cavalry-raids"]);
  });
  playersArray(s.controllers, "state.controllers", c, (v, p) => choice2(v, p, ["human", "ai", "external"]));
  choice2(s.mapSize, "state.mapSize", ["small", "medium", "large", "huge"]);
  number2(s.mapVersion, "state.mapVersion", 1, MAP_VERSION, true);
  list2(s.terrain, "state.terrain", width * height, width * height).forEach((v, i) => choice2(v, `state.terrain[${i}]`, Object.keys(TERRAIN)));
  playersArray(s.starts, "state.starts", c, (v, p) => point(v, p, c));
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
  list2(s.resources, "state.resources", MAX_RESOURCES).forEach((v, i) => {
    const p = `state.resources[${i}]`, r = object2(v, p, ["id", "x", "y", "kind", "amount", "maxAmount"], ["level"]), key = id2(r.id, `${p}.id`, c);
    if (c.entityIds.has(key) || c.resourceIds.has(key)) bad2(`${p}.id`, "duplicate entity or resource id");
    c.resourceIds.add(key);
    coordinates(r, p, c);
    choice2(r.kind, `${p}.kind`, RESOURCE_KINDS);
    const max = number2(r.maxAmount, `${p}.maxAmount`, 0, 1e9);
    number2(r.amount, `${p}.amount`, 0, max);
  });
  playersArray(s.players, "state.players", c, (v, p) => {
    const player = object2(v, p, ["faction", "wood", "ore", "crystal", "population", "cap", "upgrades"], ["heroRecovery"]);
    choice2(player.faction, `${p}.faction`, Object.keys(contentFactions(c.state.content)));
    for (const key of RESOURCE_KINDS) number2(player[key], `${p}.${key}`);
    number2(player.population, `${p}.population`, 0, c.maxEntities, true);
    number2(player.cap, `${p}.cap`, 0, version === 1 ? 100 : 500, true);
    const available = upgradesFor(c.state, s.players.indexOf(v)), upgrades = list2(player.upgrades, `${p}.upgrades`, Object.keys(available).length);
    upgrades.forEach((u, i) => choice2(u, `${p}.upgrades[${i}]`, Object.keys(available)));
    if (new Set(upgrades).size !== upgrades.length) bad2(`${p}.upgrades`, "duplicate upgrade");
  });
  const researching = Array.from({ length: playerCount }, () => /* @__PURE__ */ new Set()), choices = Array.from({ length: playerCount }, () => /* @__PURE__ */ new Map()), players = s.players;
  for (let side = 0; side < playerCount; side++) {
    const definitions = upgradesFor(c.state, side);
    for (const id3 of players[side].upgrades) {
      const group = definitions[id3].exclusiveGroup;
      if (group) {
        if (choices[side].has(group)) bad2(`state.players[${side}].upgrades`, "exclusive technology choices conflict");
        choices[side].set(group, id3);
      }
    }
  }
  for (const e of c.entities.values()) if (e.hp > 0 && e.research !== void 0) {
    const side = e.side, upgrade = e.research;
    if (players[side].upgrades.includes(upgrade) || researching[side].has(upgrade)) bad2("state.entities.research", "upgrade is already complete or being researched");
    researching[side].add(upgrade);
    const group = upgradesFor(c.state, side)[upgrade].exclusiveGroup;
    if (group) {
      if (choices[side].has(group)) bad2("state.entities.research", "exclusive technology choice is already complete or being researched");
      choices[side].set(group, upgrade);
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
    id2(corpse.id, `${p}.id`, c);
    coordinates(corpse, p, c);
    number2(corpse.expires, `${p}.expires`);
  });
  const events = list2(s.events, "state.events", c.maxEntities * 4);
  c.eventCount = events.length;
  events.forEach((v, i) => {
    const p = `state.events[${i}]`, event = object2(v, p, ["type", "x", "y", "side"], ["text", "target", "source", "amount", "resource", "level"]);
    choice2(event.type, `${p}.type`, ["attack", "death", "build", "train", "gather", "message", "ability", "research"]);
    coordinates(event, p, c);
    number2(event.side, `${p}.side`, 0, playerCount - 1, true);
    for (const key of ["source", "target"]) if (event[key] !== void 0) id2(event[key], `${p}.${key}`, c);
    optionalNumber(event, "amount", p);
    if (event.resource !== void 0) choice2(event.resource, `${p}.resource`, RESOURCE_KINDS);
    if (event.text !== void 0 && (typeof event.text !== "string" || event.text.length > 4096)) bad2(`${p}.text`, "invalid message text");
  });
  const explored = fog(s.explored, "state.explored", c), visible4 = fog(s.visible, "state.visible", c);
  visible4.forEach((tiles, side) => {
    for (const tile of tiles) if (!explored[side].has(tile)) bad2(`state.visible[${side}]`, "visible tiles must be explored");
  });
  if (s.world !== void 0) {
    validateWorldState(s.world, width, height, nextId, playerCount);
    const world = s.world;
    for (const allocated of [...world.bridges, ...world.sites, ...world.creatures]) if (c.entityIds.has(allocated.id) || c.resourceIds.has(allocated.id)) bad2("world.id", "collision with entity or resource");
    if (world.levels[0].terrain.some((t, i) => t !== s.terrain[i])) bad2("world.levels[0].terrain", "must match surface terrain");
  }
  validateRuntime(save.runtime, c, version);
  validateSpecialists(c.state);
  if (version === 3) {
    const count = ["rules", "objectives", "draft"].filter((k) => Object.hasOwn(s, k)).length;
    if (count !== 0 && count !== 3) bad2("state.rules", "rules, objectives and draft must be stored together");
    if (count === 3) {
      const state = s;
      state.rules = validateSavedRules(s.rules, state.content);
      validateDraftState(s.draft, draftPlayers(state), state.rules, state.content);
      validateObjectiveState(s.objectives, state);
      validateModeRoster(state);
    }
  }
  if (s.scenario !== void 0) s.scenario = validateScenarioBinding(s.scenario, c.state);
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
  envelope.version = 2;
}
function migrateAi(envelope) {
  validate(envelope, 2);
  const state = envelope.state, runtime2 = envelope.runtime, count = state.players.length;
  state.aiConfigs = Array.from({ length: count }, () => normalizeAiConfig());
  Object.assign(runtime2, { aiBatchTurns: 0, aiDecisionAt: Array(count).fill(state.time), aiDecisionTurns: Array(count).fill(0), knownEnemyUnits: Array.from({ length: count }, () => []), retreating: Array.from({ length: count }, () => []), producedFighters: Array(count).fill(0) });
  envelope.version = SAVE_VERSION;
}
function copyJson(value) {
  let nodes = 0, bytes = 0;
  const parents = /* @__PURE__ */ new Set();
  function copy(v, path, depth) {
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
      const array = [];
      for (let i = 0; i < v.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
        if (!descriptor || !("value" in descriptor)) bad2(path, "array accessors and gaps are forbidden");
        array.push(copy(descriptor.value, `${path}[${i}]`, depth + 1));
      }
      result = array;
    } else {
      const prototype = Object.getPrototypeOf(v);
      if (prototype !== Object.prototype && prototype !== null) bad2(path, "expected a plain object");
      const keys2 = Object.keys(v);
      if (keys2.length > 1e5 || Object.getOwnPropertySymbols(v).length) bad2(path, "invalid object properties");
      const record3 = {};
      for (const key of keys2) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") bad2(path, "unsafe property name");
        const descriptor = Object.getOwnPropertyDescriptor(v, key);
        if (!("value" in descriptor)) bad2(path, "accessors are forbidden");
        if (descriptor.value !== void 0) record3[key] = copy(descriptor.value, `${path}.${key}`, depth + 1);
      }
      result = record3;
    }
    parents.delete(v);
    return result;
  }
  return copy(value, "save", 0);
}
function checkSize(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_SAVE_BYTES) bad2("save", "save exceeds size limit");
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
    if (input.length > MAX_SAVE_BYTES || new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) bad2("save", "save exceeds size limit");
    try {
      source = JSON.parse(input);
    } catch {
      bad2("save", "invalid JSON");
    }
  }
  const envelope = copyJson(source);
  checkSize(envelope);
  const record3 = object2(envelope, "save", ["format", "version", "state", "runtime"]);
  if (record3.version === 1) migrateLegacy(record3);
  if (record3.version === 2) migrateAi(record3);
  validateCurrent(envelope);
  if (!envelope.state.rules) {
    const state2 = envelope.state;
    state2.rules = normalizeMatchRules({ sharedVision: state2.sharedVision }, state2.content);
    state2.draft = createDraft(draftPlayers(state2), state2.rules, state2.content);
    state2.objectives = emptyObjectives(state2);
  }
  checkSize(envelope);
  validateCurrent(envelope);
  const state = { ...envelope.state, explored: envelope.state.explored.map((values) => new Set(values)), visible: envelope.state.visible.map((values) => new Set(values)) };
  if (state.world) state.world.levels[0].terrain = state.terrain;
  restoreRuntime(state, envelope.runtime);
  return state;
}

// src/core/scenario-validation.ts
var unitRoles2 = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var buildingRoles2 = ["hq", "depot", "barracks", "tower", "wall", "gate"];
function bad3(path, reason) {
  throw new Error(`Invalid scenario at ${path}: ${reason}.`);
}
function object3(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) bad3(path, "expected a plain object");
  const record3 = value;
  for (const key of required) if (!Object.hasOwn(record3, key)) bad3(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record3)) if (!required.includes(key) && !optional.includes(key)) bad3(`${path}.${key}`, "unknown field");
  return record3;
}
function number3(value, path, min = 0, max = 1e9, integer2 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer2 && !Number.isSafeInteger(value)) bad3(path, `expected ${integer2 ? "an integer" : "a number"} between ${min} and ${max}`);
  return value;
}
function text(value, path, max = 4096) {
  if (typeof value !== "string" || value.length < 1 || value.length > max) bad3(path, "invalid text");
  return value;
}
function identifier(value, path) {
  const id3 = text(value, path, 96);
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(id3) || ["constructor", "prototype", "__proto__"].includes(id3)) bad3(path, "invalid identifier");
  return id3;
}
function choice3(value, path, values) {
  if (typeof value !== "string" || !values.includes(value)) bad3(path, "unknown value");
  return value;
}
function flag3(value, path) {
  if (typeof value !== "boolean") bad3(path, "expected a boolean");
  return value;
}
function list3(value, path, max, min = 0) {
  if (!Array.isArray(value) || value.length < min || value.length > max) bad3(path, "invalid array length");
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) bad3(path, "array contains gaps");
  return value;
}
function scenarioJson(input, limits = {}) {
  let nodes = 0;
  const ancestors = /* @__PURE__ */ new Set();
  const copy = (value2, depth) => {
    if (++nodes > (limits.maxNodes ?? 1e5) || depth > 24) bad3("package", "package is too large or deeply nested");
    if (value2 === null || typeof value2 === "boolean" || typeof value2 === "string") return value2;
    if (typeof value2 === "number" && Number.isFinite(value2)) return value2;
    if (!value2 || typeof value2 !== "object") bad3("package", "expected bounded JSON data");
    if (ancestors.has(value2)) bad3("package", "cyclic reference");
    ancestors.add(value2);
    let result;
    if (Array.isArray(value2)) {
      if (value2.length > (limits.maxArrayLength ?? 65536) || Object.getOwnPropertySymbols(value2).length) bad3("package", "array is too large or contains symbols");
      result = Array.from({ length: value2.length }, (_, index2) => {
        const property = Object.getOwnPropertyDescriptor(value2, String(index2));
        if (!property || !("value" in property)) bad3("package", "accessors and gaps are forbidden");
        return copy(property.value, depth + 1);
      });
    } else {
      if (Object.getPrototypeOf(value2) !== Object.prototype || Object.getOwnPropertySymbols(value2).length) bad3("package", "expected a plain object");
      const record3 = {};
      for (const key of Object.keys(value2)) {
        if (["constructor", "prototype", "__proto__"].includes(key)) bad3("package", "unsafe property");
        const property = Object.getOwnPropertyDescriptor(value2, key);
        if (!("value" in property)) bad3("package", "accessors are forbidden");
        if (property.value !== void 0) record3[key] = copy(property.value, depth + 1);
      }
      result = record3;
    }
    ancestors.delete(value2);
    return result;
  };
  const value = copy(input, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > (limits.maxBytes ?? 2 * 1024 * 1024)) bad3("package", "package exceeds its size limit");
  return value;
}
function validateScenario(input) {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > 2 * 1024 * 1024) bad3("package", "package exceeds 2 MiB");
    try {
      raw = JSON.parse(raw);
    } catch {
      bad3("package", "invalid JSON");
    }
  }
  const value = scenarioJson(raw);
  const s = object3(value, "definition", ["schemaVersion", "id", "title", "briefing", "successText", "failureText", "faction", "opponent", "seed", "army", "objectives", "events", "rules"], ["map", "escort", "stealth", "boss", "requiredActions"]);
  if (s.schemaVersion !== 1) bad3("schemaVersion", "unsupported version");
  identifier(s.id, "id");
  for (const key of ["title", "briefing", "successText", "failureText"]) text(s[key], key);
  const faction = choice3(s.faction, "faction", Object.keys(FACTIONS));
  const opponent = choice3(s.opponent, "opponent", Object.keys(FACTIONS));
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
    list3(m.starts, "map.starts", 2, 2).forEach((p, i) => point2(p, `map.starts[${i}]`));
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
  function coordinates2(record3, path) {
    number3(record3.x, `${path}.x`, 0.5, map.width - 0.5);
    number3(record3.y, `${path}.y`, 0.5, map.height - 0.5);
    if (record3.level !== void 0) number3(record3.level, `${path}.level`, 0, (map.world?.levels.length ?? 1) - 1, true);
  }
  function point2(v, path) {
    coordinates2(object3(v, path, ["x", "y"], ["level"]), path);
  }
  const actorLabels = /* @__PURE__ */ new Set(), actorByLabel = /* @__PURE__ */ new Map();
  function actor2(v, path) {
    const a = object3(v, path, ["label", "side", "kind", "role", "x", "y"], ["hp", "order", "definitionId", "level"]);
    const label = identifier(a.label, `${path}.label`);
    if (actorLabels.has(label)) bad3(`${path}.label`, "duplicate actor label");
    actorLabels.add(label);
    actorByLabel.set(label, a);
    number3(a.side, `${path}.side`, 0, 1, true);
    const kind = choice3(a.kind, `${path}.kind`, ["unit", "building"]);
    const role = choice3(a.role, `${path}.role`, kind === "unit" ? unitRoles2 : buildingRoles2);
    coordinates2(a, path);
    const def = FACTIONS[a.side === 0 ? faction : opponent];
    const definition3 = kind === "unit" ? def.units[role] : def.buildings[role];
    if (a.hp !== void 0) number3(a.hp, `${path}.hp`, 1, definition3.hp);
    if (a.definitionId !== void 0) identifier(a.definitionId, `${path}.definitionId`);
    const radius2 = kind === "building" ? def.buildings[role].size / 2 : 0.27;
    for (let y = Math.floor(a.y - radius2); y <= Math.floor(a.y + radius2); y++) for (let x = Math.floor(a.x - radius2); x <= Math.floor(a.x + radius2); x++) {
      const terrain2 = map.world?.levels[a.level ?? 0].terrain ?? map.terrain;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || !TERRAIN[terrain2[y * map.width + x]].walkable) bad3(path, "actor is on impassable terrain");
    }
  }
  list3(s.army, "army", 256, 1).forEach((v, i) => actor2(v, `army[${i}]`));
  const events = list3(s.events, "events", 128);
  for (const [i, event] of events.entries()) {
    const e = object3(event, `events[${i}]`, ["id", "when", "actions"], ["repeat"]);
    list3(e.actions, `events[${i}].actions`, 16, 1).forEach((a, j) => {
      if (a && typeof a === "object" && a.type === "spawn") {
        if (e.repeat !== void 0) bad3(`events[${i}]`, "repeated spawn labels are ambiguous; author separate waves");
        const spawn = object3(a, `events[${i}].actions[${j}]`, ["type", "actors"]);
        list3(spawn.actors, `events[${i}].actors`, 128, 1).forEach((v, k) => actor2(v, `events[${i}].actors[${k}]`));
      }
    });
  }
  if (s.boss !== void 0) {
    const boss = object3(s.boss, "boss", ["actor", "name", "health", "phases"]);
    list3(boss.phases, "boss.phases", 8, 2).forEach((phase, i) => {
      const p = object3(phase, `boss.phases[${i}]`, ["below", "name", "radius", "damage", "warningSeconds", "cooldown", "interruptDamage", "adds"]);
      list3(p.adds, `boss.phases[${i}].adds`, 32).forEach((v, j) => actor2(v, `boss.phases[${i}].adds[${j}]`));
    });
  }
  function reference(v, path) {
    if (!actorLabels.has(identifier(v, path))) bad3(path, "unknown actor label");
  }
  function condition(v, path, depth = 0) {
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
        point2(c.point, `${path}.point`);
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
        list3(c.conditions, `${path}.conditions`, 16, 1).forEach((child, i) => condition(child, `${path}.conditions[${i}]`, depth + 1));
        break;
      case "not":
        object3(v, path, ["type", "condition"]);
        condition(c.condition, `${path}.condition`, depth + 1);
        break;
      default:
        bad3(`${path}.type`, "unknown condition");
    }
  }
  function order2(v, path) {
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
  for (const [label, a] of actorByLabel) if (a.order) order2(a.order, `actor.${label}.order`);
  const objectiveIds = /* @__PURE__ */ new Set();
  list3(s.objectives, "objectives", 32, 1).forEach((v, i) => {
    const p = `objectives[${i}]`, o = object3(v, p, ["id", "text", "success"], ["failure", "optional"]), id3 = identifier(o.id, `${p}.id`);
    if (objectiveIds.has(id3)) bad3(`${p}.id`, "duplicate objective");
    objectiveIds.add(id3);
    text(o.text, `${p}.text`);
    condition(o.success, `${p}.success`);
    if (o.failure !== void 0) condition(o.failure, `${p}.failure`);
    if (o.optional !== void 0) flag3(o.optional, `${p}.optional`);
  });
  if (s.objectives.every((o) => o.optional)) bad3("objectives", "at least one objective must be required");
  const eventIds = /* @__PURE__ */ new Set();
  for (const [i, v] of events.entries()) {
    const p = `events[${i}]`, e = v, id3 = identifier(e.id, `${p}.id`);
    if (eventIds.has(id3)) bad3(`${p}.id`, "duplicate event");
    eventIds.add(id3);
    condition(e.when, `${p}.when`);
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
          order2(a.order, `${path}.order`);
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
          resources2(a.resources, `${path}.resources`);
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
  function resources2(v, p) {
    const r = object3(v, p, ["wood", "ore", "crystal"]);
    for (const key of ["wood", "ore", "crystal"]) number3(r[key], `${p}.${key}`, 0, 1e6);
  }
  const rules = object3(s.rules, "rules", ["fixedArmy", "reinforcementBudget", "resources", "timeLimit"]);
  flag3(rules.fixedArmy, "rules.fixedArmy");
  number3(rules.reinforcementBudget, "rules.reinforcementBudget", 0, 256, true);
  resources2(rules.resources, "rules.resources");
  number3(rules.timeLimit, "rules.timeLimit", 1, 7200);
  if (rules.fixedArmy && rules.reinforcementBudget !== 0) bad3("rules.reinforcementBudget", "fixed armies cannot recruit");
  if (s.escort !== void 0) {
    const e = object3(s.escort, "escort", ["actor", "route", "radius", "escortRadius"]);
    reference(e.actor, "escort.actor");
    if (actorByLabel.get(e.actor)?.kind !== "unit") bad3("escort.actor", "escort must be a moving unit");
    list3(e.route, "escort.route", 64, 2).forEach((v, i) => point2(v, `escort.route[${i}]`));
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
      list3(patrol.route, `${p}.route`, 32, 2).forEach((pointValue, j) => point2(pointValue, `${p}.route[${j}]`));
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
    const p = `requiredActions[${i}]`, a = object3(v, p, ["action", "count", "text"]);
    choice3(a.action, `${p}.action`, ["ability", "hold", "repair", "gather"]);
    number3(a.count, `${p}.count`, 1, 256, true);
    text(a.text, `${p}.text`);
  });
  return value;
}

// src/core/scenarios.ts
var MAX_SCENARIO_ACTIONS_PER_TICK = 128;
var commandListeners = /* @__PURE__ */ new WeakMap();
var commandGeneration = /* @__PURE__ */ new WeakMap();
var scriptedCommands = /* @__PURE__ */ new WeakSet();
function bindScenarioState(session2) {
  session2.state.scenario = { definition: session2.definition, runtime: session2.runtime };
}
function scenarioSessionForState(state) {
  const binding = state.scenario;
  return binding ? { ...binding, state } : null;
}
function isScenarioScriptedCommand(state) {
  return scriptedCommands.has(state);
}
function scriptedCommand(state, side, command) {
  const prior = scriptedCommands.has(state);
  scriptedCommands.add(state);
  try {
    return issueCommand(state, side, command);
  } finally {
    if (!prior) scriptedCommands.delete(state);
  }
}
var distance3 = (a, b) => (a.level ?? 0) === (b.level ?? 0) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var clone = (value) => JSON.parse(JSON.stringify(value));
var actor = (session2, label) => session2.state.entities.find((e) => e.id === session2.runtime.labels[label] && e.hp > 0);
var visible3 = (state, side, point2) => !!state.visible[side]?.has(fogKey(state, point2));
var variable = (session2, key) => session2.runtime.variables[key] ?? 0;
function addVariable(session2, key, value) {
  session2.runtime.variables[key] = Math.max(-1e9, Math.min(1e9, variable(session2, key) + value));
}
function scenarioCondition(session2, condition) {
  switch (condition.type) {
    case "alive":
      return !!actor(session2, condition.actor);
    case "dead":
      return Object.hasOwn(session2.runtime.labels, condition.actor) && !actor(session2, condition.actor);
    case "at": {
      const entity = actor(session2, condition.actor);
      return !!entity && distance3(entity, condition.point) <= condition.radius;
    }
    case "time":
      return session2.state.time + 1e-9 >= condition.seconds;
    case "variable": {
      const n = variable(session2, condition.key);
      return condition.op === "eq" ? n === condition.value : condition.op === "gte" ? n >= condition.value : n <= condition.value;
    }
    case "cleared":
      return !session2.state.entities.some((e) => e.hp > 0 && e.side === condition.side && !e.illusion && (condition.buildings || e.kind === "unit"));
    case "all":
      return condition.conditions.every((c) => scenarioCondition(session2, c));
    case "any":
      return condition.conditions.some((c) => scenarioCondition(session2, c));
    case "not":
      return !scenarioCondition(session2, condition.condition);
  }
}
function message2(session2, text2, speaker) {
  const entry = { time: session2.state.time, text: text2, ...speaker ? { speaker } : {} };
  session2.runtime.messages.push(entry);
  if (session2.runtime.messages.length > 128) session2.runtime.messages.shift();
  const start = session2.state.starts[0];
  session2.state.events.push({ type: "message", side: 0, ...start, text: speaker ? `${speaker}: ${text2}` : text2 });
}
function finish(session2, outcome, reason) {
  if (session2.runtime.outcome !== "playing") return;
  session2.runtime.outcome = outcome;
  session2.runtime.reason = reason;
  session2.state.winner = outcome === "won" ? 0 : 1;
  session2.state.winningTeam = session2.state.teams[session2.state.winner];
  session2.state.draw = false;
  message2(session2, outcome === "won" ? session2.definition.successText : session2.definition.failureText);
}
function updatePopulation2(state) {
  for (let side = 0; side < state.players.length; side++) {
    const living = state.entities.filter((e) => e.side === side && e.hp > 0);
    state.players[side].population = living.filter((e) => e.kind === "unit" && !e.illusion).length;
    state.players[side].cap = Math.min(state.populationLimits[side], living.filter((e) => e.kind === "building" && e.progress === 1).reduce((count, e) => count + (e.role === "hq" ? 12 : e.role === "depot" ? 10 : 0), 0));
  }
}
function spawnActors(session2, actors) {
  const spawned = [];
  for (const definition3 of actors) {
    if (Object.hasOwn(session2.runtime.labels, definition3.label)) throw new Error(`Scenario actor ${definition3.label} was spawned twice.`);
    if (session2.state.entities.length >= 4096) {
      finish(session2, "lost", "The scenario exceeded its actor limit.");
      return;
    }
    const desired = { x: definition3.x, y: definition3.y, ...definition3.level === void 0 ? {} : { level: definition3.level } };
    const destination = definition3.kind === "unit" ? walkable(session2.state, desired.x, desired.y, desired.level ?? 0) ? desired : openDestination(session2.state, desired, desired) : desired;
    if (!destination) {
      finish(session2, "lost", `The spawn point for ${definition3.label} became blocked.`);
      return;
    }
    const entity = spawnEntity(session2.state, definition3.side, definition3.kind, definition3.role, destination.x, destination.y);
    if (definition3.level !== void 0) entity.level = definition3.level;
    if (definition3.hp !== void 0) entity.hp = definition3.hp;
    session2.runtime.labels[definition3.label] = entity.id;
    spawned.push(definition3);
    session2.state.events.push({ type: definition3.kind === "unit" ? "train" : "build", side: definition3.side, source: entity.id, x: entity.x, y: entity.y, ...entity.level === void 0 ? {} : { level: entity.level }, text: definition3.label });
  }
  updatePopulation2(session2.state);
  refreshVisibility(session2.state);
  for (const definition3 of spawned) if (definition3.order) orderActors(session2, [definition3.label], definition3.order);
}
function orderActors(session2, labels, order2) {
  for (const side of [0, 1]) {
    const entities = labels.map((label) => actor(session2, label)).filter((e) => !!e && e.side === side);
    if (!entities.length) continue;
    const ids = entities.map((e) => e.id);
    const before = session2.state.events.length;
    if (order2.type === "attack") {
      const target = actor(session2, order2.actor);
      if (target) scriptedCommand(session2.state, side, { type: "attack", ids, target: target.id });
    } else scriptedCommand(session2.state, side, { ...order2, ids });
    if (side === 0) recordEvents(session2, before);
  }
}
function createScenario(input, options = {}) {
  const definition3 = validateScenario(input);
  const firstId = options.firstEntityId ?? 1;
  if (!Number.isSafeInteger(firstId) || firstId < 1 || firstId > 2147483647 - 8192) throw new Error("Scenario starting entity ID is outside its range.");
  const construct = createMatch;
  const state = construct({ map: { seed: definition3.seed, size: definition3.map?.size ?? "small", ...definition3.map?.world ? { world: definition3.map.world } : {} }, players: [
    { id: 0, teamId: 0, factionId: definition3.faction, controller: "human" },
    { id: 1, teamId: 1, factionId: definition3.opponent, controller: "external" }
  ], rules: { mode: "scenario", standardDefeat: false, startingAge: 3, startingResources: definition3.rules.resources } }, { scenario: true });
  state.entities = [];
  state.resources = [];
  state.events = [];
  state.corpses = [];
  if (state.world) {
    const offset = firstId - 1;
    for (const bridge of state.world.bridges) bridge.id += offset;
    for (const site of state.world.sites) {
      site.id += offset;
      site.creatureIds = site.creatureIds.map((id3) => id3 + offset);
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
  if (definition3.map) {
    state.width = definition3.map.width;
    state.height = definition3.map.height;
    state.mapSize = definition3.map.size;
    state.mapVersion = MAP_VERSION;
    state.terrain = [...definition3.map.terrain];
    state.starts = definition3.map.starts.map((p) => ({ ...p }));
    state.resources = definition3.map.resources.map((r) => ({ ...r, id: state.nextId++ }));
    if (state.world) state.world.levels[0].terrain = state.terrain;
  }
  const runtime2 = {
    version: 1,
    lastEvaluatedTick: 0,
    definitionId: definition3.id,
    outcome: "playing",
    reason: "",
    labels: {},
    variables: {},
    triggers: {},
    completed: [],
    messages: [],
    reinforcementRemaining: definition3.rules.reinforcementBudget,
    escort: { checkpoint: 0, moving: false },
    stealth: { alarms: 0, exposure: {}, detected: [], patrol: {}, distractedUntil: {} },
    boss: { phase: -1, nextAttack: 4, telegraph: null, phasesEntered: [], interrupted: 0, hits: 0, dodged: 0 },
    commandCounts: {}
  };
  const session2 = { definition: definition3, state, runtime: runtime2 };
  bindScenarioState(session2);
  spawnActors(session2, definition3.army);
  if (definition3.boss) {
    const boss = actor(session2, definition3.boss.actor);
    boss.hp = definition3.boss.health;
    boss.maxHp = boss.hp;
  }
  message2(session2, definition3.briefing);
  advanceStealth(session2, 0);
  evaluateScenario(session2);
  return session2;
}
function action(session2, value) {
  switch (value.type) {
    case "spawn":
      spawnActors(session2, value.actors);
      break;
    case "order":
      orderActors(session2, value.actors, value.order);
      break;
    case "set":
      session2.runtime.variables[value.key] = value.value;
      break;
    case "add":
      addVariable(session2, value.key, value.value);
      break;
    case "message":
      message2(session2, value.text, value.speaker);
      break;
    case "reward": {
      const player = session2.state.players[value.side];
      for (const key of ["wood", "ore", "crystal"]) player[key] = Math.min(1e9, player[key] + value.resources[key]);
      break;
    }
    case "alliance":
      session2.state.teams[1] = value.allied ? session2.state.teams[0] : session2.state.teams[0] === 0 ? 1 : 0;
      refreshVisibility(session2.state);
      break;
    case "finish":
      finish(session2, value.outcome, value.reason);
      break;
  }
}
function evaluateScenario(session2) {
  if (session2.runtime.outcome !== "playing") return;
  let budget = MAX_SCENARIO_ACTIONS_PER_TICK;
  for (const trigger of session2.definition.events) {
    const prior = session2.runtime.triggers[trigger.id], max = trigger.repeat?.count ?? 1;
    if ((prior?.count ?? 0) >= max || prior && session2.state.time - prior.lastTime + 1e-9 < (trigger.repeat?.seconds ?? Infinity) || !scenarioCondition(session2, trigger.when)) continue;
    if (budget < trigger.actions.length) break;
    budget -= trigger.actions.length;
    session2.runtime.triggers[trigger.id] = { count: (prior?.count ?? 0) + 1, lastTime: session2.state.time };
    for (const value of trigger.actions) {
      action(session2, value);
      if (session2.runtime.outcome !== "playing") return;
    }
  }
  for (const objective of session2.definition.objectives) if (objective.failure && scenarioCondition(session2, objective.failure)) {
    finish(session2, "lost", objective.text);
    return;
  }
  for (const objective of session2.definition.objectives) if (!session2.runtime.completed.includes(objective.id) && scenarioCondition(session2, objective.success)) {
    session2.runtime.completed.push(objective.id);
    message2(session2, `Objective completed: ${objective.text}`);
  }
  const actionsDone = (session2.definition.requiredActions ?? []).every((required) => (session2.runtime.commandCounts[required.action] ?? 0) >= required.count);
  if (session2.definition.objectives.filter((o) => !o.optional).every((o) => session2.runtime.completed.includes(o.id)) && actionsDone) finish(session2, "won", "All required objectives completed.");
  else if (session2.state.time + 1e-9 >= session2.definition.rules.timeLimit) finish(session2, "lost", "The mission time limit expired.");
}
function detectionLine(state, from, to) {
  const length2 = distance3(from, to), steps = Math.ceil(length2 * 3);
  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    if (terrainAt(state, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.level ?? 0) === "rock") return false;
  }
  return true;
}
function guardDetects(session2, guard, target) {
  const stealth = session2.definition.stealth;
  if (!stealth || !isHostile(session2.state, guard.side, target.side) || !visible3(session2.state, guard.side, target) || distance3(guard, target) > stealth.radius || !detectionLine(session2.state, guard, target)) return false;
  const dx = target.x - guard.x, dy = target.y - guard.y, length2 = length2D(dx, dy);
  const facing = DIRECTIONS_32[guard.facing * 4];
  return length2 === 0 || dx * facing[0] + dy * facing[1] >= length2 * coneCosine(stealth.coneDegrees);
}
function advanceStealth(session2, dt) {
  const definition3 = session2.definition.stealth;
  if (!definition3) return;
  const progress = session2.runtime.stealth;
  for (const label of definition3.guards) {
    const guard = actor(session2, label);
    if (!guard) continue;
    const illusion = session2.state.entities.filter((e) => e.hp > 0 && e.illusion && guardDetects(session2, guard, e)).sort((a, b) => distance3(a, guard) - distance3(b, guard) || a.id - b.id)[0];
    if (illusion) {
      if (guard.order.type !== "attack" || guard.order.target !== illusion.id) {
        scriptedCommand(session2.state, guard.side, { type: "attack", ids: [guard.id], target: illusion.id });
        message2(session2, "A patrol turned toward an illusion.");
        addVariable(session2, "stealth.diversions", 1);
      }
      progress.distractedUntil[label] = session2.state.time + 1;
    }
    if ((progress.distractedUntil[label] ?? 0) > session2.state.time) continue;
    const patrol = definition3.patrols.find((p) => p.actor === label);
    if (patrol && !progress.detected.length) {
      let index2 = progress.patrol[label] ?? 0;
      if (distance3(guard, patrol.route[index2]) <= 0.65) {
        index2 = (index2 + 1) % patrol.route.length;
        progress.patrol[label] = index2;
      }
      const next = patrol.route[index2];
      if (guard.order.type !== "move" || guard.order.x !== next.x || guard.order.y !== next.y) scriptedCommand(session2.state, guard.side, { type: "move", ids: [guard.id], ...next });
    }
  }
  for (const label of definition3.infiltrators) {
    const infiltrator = actor(session2, label);
    if (!infiltrator) continue;
    const seen = definition3.guards.some((guardLabel) => {
      const guard = actor(session2, guardLabel);
      return !!guard && (progress.distractedUntil[guardLabel] ?? 0) <= session2.state.time && guardDetects(session2, guard, infiltrator);
    });
    progress.exposure[label] = seen ? Math.min(definition3.detectionSeconds, (progress.exposure[label] ?? 0) + dt) : Math.max(0, (progress.exposure[label] ?? 0) - dt * 2);
    if (progress.detected.includes(label)) {
      if (!seen && progress.exposure[label] === 0) {
        progress.detected = progress.detected.filter((id3) => id3 !== label);
        message2(session2, "The patrol lost the infiltrator and resumed its route.");
      }
      continue;
    }
    if (progress.exposure[label] + 1e-9 < definition3.detectionSeconds) continue;
    progress.detected.push(label);
    progress.alarms++;
    session2.runtime.variables["stealth.alarms"] = progress.alarms;
    message2(session2, `Alarm ${progress.alarms}: ${label} was detected.`);
    for (const guardLabel of definition3.guards) {
      const guard = actor(session2, guardLabel);
      if (guard) scriptedCommand(session2.state, guard.side, { type: "attackMove", ids: [guard.id], x: infiltrator.x, y: infiltrator.y });
    }
    if (progress.alarms >= definition3.alarmLimit) {
      finish(session2, "lost", "The infiltrators raised the alarm.");
      return;
    }
  }
}
function recordEvents(session2, start = 0) {
  for (const event of session2.state.events.slice(start)) {
    if (event.type === "ability" && event.side === 0) {
      session2.runtime.commandCounts.ability = (session2.runtime.commandCounts.ability ?? 0) + 1;
      addVariable(session2, "action.ability", 1);
    }
    if (event.type === "death") {
      const dead = session2.state.entities.find((e) => e.id === event.source);
      if (dead?.kind === "unit" && !dead.illusion && !dead.raised) addVariable(session2, `deaths.${dead.side}`, 1);
    }
  }
}
function scenarioCommandPermitted(state, side, command) {
  const session2 = scenarioSessionForState(state);
  if (!session2 || isScenarioScriptedCommand(state)) return true;
  if (side !== 0 || session2.runtime.outcome !== "playing") return false;
  if (side === 0 && (command.type === "build" || command.type === "research") && session2.definition.rules.fixedArmy) return false;
  return !(side === 0 && command.type === "train" && (session2.definition.rules.fixedArmy || session2.runtime.reinforcementRemaining <= 0));
}
function afterScenarioCommand(state, side, command, eventStart) {
  const session2 = scenarioSessionForState(state);
  if (!session2 || isScenarioScriptedCommand(state)) return;
  commandGeneration.set(state, (commandGeneration.get(state) ?? 0) + 1);
  if (side === 0) {
    if (command.type === "train") session2.runtime.reinforcementRemaining--;
    if (command.type !== "ability") {
      session2.runtime.commandCounts[command.type] = (session2.runtime.commandCounts[command.type] ?? 0) + 1;
      addVariable(session2, `action.${command.type}`, 1);
    }
    recordEvents(session2, eventStart);
  }
  for (const listener of [...commandListeners.get(state) ?? []]) {
    try {
      listener(side, clone(command));
    } catch (error) {
      console.error("Scenario command observer failed", error);
    }
  }
}
function captureScenario(session2) {
  const state = session2.state, binding = state.scenario;
  delete state.scenario;
  let game;
  try {
    game = saveGame(state);
  } finally {
    if (binding) state.scenario = binding;
  }
  return { format: "orcs-vs-fairies-scenario", version: 1, definition: clone(session2.definition), runtime: clone(session2.runtime), game };
}
function validateScenarioBinding(input, state) {
  const binding = scenarioJson(input);
  if (!binding || typeof binding !== "object" || Array.isArray(binding) || Object.keys(binding).length !== 2 || !Object.hasOwn(binding, "definition") || !Object.hasOwn(binding, "runtime")) throw new Error("Invalid saved scenario binding.");
  const definition3 = validateScenario(binding.definition);
  validateRuntime2(definition3, state, binding.runtime);
  return { definition: definition3, runtime: binding.runtime };
}
function validateRuntime2(definition3, state, runtime2) {
  const fail2 = (reason) => {
    throw new Error(`Invalid scenario runtime: ${reason}.`);
  };
  const fields2 = ["version", "lastEvaluatedTick", "definitionId", "outcome", "reason", "labels", "variables", "triggers", "completed", "messages", "reinforcementRemaining", "escort", "stealth", "boss", "commandCounts"];
  if (!runtime2 || typeof runtime2 !== "object" || Array.isArray(runtime2) || fields2.some((key) => !Object.hasOwn(runtime2, key)) || Object.keys(runtime2).some((key) => !fields2.includes(key))) fail2("unknown or missing field");
  if (runtime2.version !== 1 || runtime2.definitionId !== definition3.id || !["playing", "won", "lost"].includes(runtime2.outcome) || typeof runtime2.reason !== "string" || runtime2.reason.length > 4096) fail2("identity or outcome");
  if (state.players.length !== 2 || state.players[0].faction !== definition3.faction || state.players[1].faction !== definition3.opponent || state.seed !== definition3.seed || state.rules.mode !== "scenario" || state.rules.standardDefeat) fail2("match identity");
  if (runtime2.outcome === "playing" && (state.winner !== null || state.draw) || runtime2.outcome === "won" && state.winner !== 0 || runtime2.outcome === "lost" && state.winner !== 1) fail2("result disagrees with simulation");
  const finite2 = (n, min = 0, max = 1e9, integer2 = false) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max && (!integer2 || Number.isSafeInteger(n));
  if (!finite2(runtime2.lastEvaluatedTick, 0, state.tick, true)) fail2("evaluated tick");
  const record3 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
  const exact = (value, keys2) => record3(value) && keys2.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys2.includes(key));
  const counters = (value, max = 1e9, negative = false) => record3(value) && Object.keys(value).length <= 2048 && Object.entries(value).every(([key, n]) => /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(key) && finite2(n, negative ? -1e9 : 0, max));
  const actors = [...definition3.army, ...definition3.events.flatMap((e) => e.actions.flatMap((a) => a.type === "spawn" ? a.actors : [])), ...definition3.boss?.phases.flatMap((p) => p.adds) ?? []];
  const labels = new Set(actors.map((a) => a.label));
  if (!record3(runtime2.labels) || Object.entries(runtime2.labels).some(([label, id3]) => !labels.has(label) || !finite2(id3, 1, state.nextId - 1, true)) || new Set(Object.values(runtime2.labels)).size !== Object.values(runtime2.labels).length || definition3.army.some((a) => !Object.hasOwn(runtime2.labels, a.label))) fail2("actor references");
  for (const [label, id3] of Object.entries(runtime2.labels)) {
    const e = state.entities.find((e2) => e2.id === id3), a = actors.find((a2) => a2.label === label);
    if (e && (e.side !== a.side || e.kind !== a.kind || e.role !== a.role)) fail2("actor ownership or definition changed");
  }
  if (!counters(runtime2.variables, 1e9, true) || !counters(runtime2.commandCounts) || !finite2(runtime2.reinforcementRemaining, 0, definition3.rules.reinforcementBudget, true)) fail2("variables or reinforcement budget");
  if (!record3(runtime2.triggers)) fail2("trigger record");
  for (const [id3, entry] of Object.entries(runtime2.triggers)) {
    const e = definition3.events.find((e2) => e2.id === id3);
    if (!e || !exact(entry, ["count", "lastTime"]) || !finite2(entry.count, 1, e.repeat?.count ?? 1, true) || !finite2(entry.lastTime, 0, state.time)) fail2("trigger schedule");
  }
  if (!Array.isArray(runtime2.completed) || runtime2.completed.some((id3) => !definition3.objectives.some((o) => o.id === id3)) || new Set(runtime2.completed).size !== runtime2.completed.length) fail2("objective progress");
  if (!Array.isArray(runtime2.messages) || runtime2.messages.length > 128 || runtime2.messages.some((m) => !record3(m) || Object.keys(m).some((k) => !["time", "text", "speaker"].includes(k)) || !finite2(m.time, 0, state.time) || typeof m.text !== "string" || m.text.length > 4096 || m.speaker !== void 0 && (typeof m.speaker !== "string" || m.speaker.length > 96))) fail2("messages");
  if (!exact(runtime2.escort, ["checkpoint", "moving"]) || !finite2(runtime2.escort.checkpoint, 0, definition3.escort?.route.length ?? 0, true) || typeof runtime2.escort.moving !== "boolean") fail2("escort progress");
  const stealth = runtime2.stealth;
  if (!exact(stealth, ["alarms", "exposure", "detected", "patrol", "distractedUntil"]) || !finite2(stealth.alarms, 0, definition3.stealth?.alarmLimit ?? 0, true) || !counters(stealth.exposure, 10) || !counters(stealth.patrol, 31) || !counters(stealth.distractedUntil) || !Array.isArray(stealth.detected) || stealth.detected.some((label) => !definition3.stealth?.infiltrators.includes(label)) || new Set(stealth.detected).size !== stealth.detected.length) fail2("stealth progress");
  if (Object.keys(stealth.patrol).some((label) => {
    const p = definition3.stealth?.patrols.find((p2) => p2.actor === label);
    return !p || !finite2(stealth.patrol[label], 0, p.route.length - 1, true);
  })) fail2("patrol waypoint");
  const boss = runtime2.boss;
  if (!exact(boss, ["phase", "nextAttack", "telegraph", "phasesEntered", "interrupted", "hits", "dodged"]) || !finite2(boss.phase, -1, (definition3.boss?.phases.length ?? 0) - 1, true) || !finite2(boss.nextAttack) || !Array.isArray(boss.phasesEntered) || boss.phasesEntered.some((n, i) => n !== i || n > boss.phase) || !finite2(boss.interrupted, 0, 1e6, true) || !finite2(boss.hits, 0, 1e6, true) || !finite2(boss.dodged, 0, 1e6, true)) fail2("boss progress");
  if (boss.telegraph !== null) {
    const t = boss.telegraph;
    const keys2 = ["x", "y", "radius", "resolveAt", "source", "phase", "hpAtStart", "interrupted", ...t.level === void 0 ? [] : ["level"]];
    if (!definition3.boss || !exact(t, keys2) || !finite2(t.x, 0, state.width) || !finite2(t.y, 0, state.height) || t.level !== void 0 && !finite2(t.level, 0, (state.world?.levels.length ?? 1) - 1, true) || !finite2(t.radius, 1, 16) || !finite2(t.resolveAt, 0, state.time + 10) || t.source !== runtime2.labels[definition3.boss.actor] || !finite2(t.phase, 0, boss.phase, true) || !finite2(t.hpAtStart, 0, definition3.boss.health) || typeof t.interrupted !== "boolean") fail2("boss telegraph");
  }
}

// src/core/versions.ts
var SIMULATION_REVISION = "3.2.0";
var LEGACY_SIMULATION_REVISIONS = {
  1: "1.0.0",
  2: "2.0.0",
  3: "3.0.0"
};

// src/core/replays.ts
var FORMAT = "orcs-vs-fairies/replay";
var MAX_TICKS = 432e3;
var MAX_ACTIONS = 1e5;
var record2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var integer = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
var exactKeys = (v, keys2) => Object.keys(v).every((k) => keys2.includes(k));
function replayChecksum(state, version = SAVE_VERSION) {
  const saved = saveGame(state);
  if (![1, 2, SAVE_VERSION].includes(version)) throw new Error("Replay checksum version is unsupported by this build.");
  if (version === 1 && state.players.length !== 2) throw new Error("Legacy replay checksums require two players.");
  const legacy = saved;
  legacy.version = version;
  if (version < 3) {
    delete legacy.state.aiConfigs;
    for (const key of ["aiDecisionAt", "aiDecisionTurns", "aiBatchTurns", "knownEnemyUnits", "retreating", "producedFighters"]) delete legacy.runtime[key];
  }
  if (version === 1) {
    for (const key of ["teams", "incomeFactors", "populationLimits", "sharedVision", "eliminated", "winningTeam"]) delete legacy.state[key];
    delete legacy.runtime.clearedEnemyStarts;
  }
  const text2 = JSON.stringify(saved);
  let hash2 = 2166136261;
  for (let i = 0; i < text2.length; i++) {
    hash2 ^= text2.charCodeAt(i);
    hash2 = Math.imul(hash2, 16777619);
  }
  return (hash2 >>> 0).toString(16).padStart(8, "0");
}
function entityValue(s, e) {
  const cost2 = entityDefinition(s, e).cost;
  return cost2.wood + cost2.ore + cost2.crystal;
}
function armySample(s, side, losses, gathered, buildingLosses, lostValue) {
  const p = s.players[side], living = s.entities.filter((e) => e.side === side && e.hp > 0 && !e.illusion && !e.raised);
  const armyValue = living.filter((e) => e.kind === "unit" && e.role !== "worker").reduce((sum, e) => sum + entityValue(s, e), 0);
  return { wood: p.wood, ore: p.ore, crystal: p.crystal, units: living.filter((e) => e.kind === "unit").length, buildings: living.filter((e) => e.kind === "building" && e.progress === 1).length, losses, gathered, armyValue, buildingLosses, lostValue, upgrades: [...p.upgrades] };
}
var MatchRecorder = class {
  constructor(state, previous) {
    this.state = state;
    this.consumedEvents = new WeakSet(state.events);
    this.knownUpgrades = state.players.map((p) => new Set(p.upgrades));
    this.losses = state.players.map(() => 0);
    this.gathered = state.players.map(() => 0);
    this.buildingLosses = state.players.map(() => 0);
    this.lostValue = state.players.map(() => 0);
    if (previous) {
      const archive = decodeReplay(previous);
      if (!replayRulesCompatible(archive)) throw new Error("Older replay history cannot be continued under the current simulation rules. Start new replay history from the saved match.");
      if (archive.finalTick !== state.tick || archive.finalChecksum !== replayChecksum(state, archive.checksumVersion ?? archive.initial.version)) throw new Error("Saved replay does not match the saved game.");
      this.initial = saveGame(loadGame(archive.initial));
      this.actions = structuredClone(archive.actions);
      this.samples = structuredClone(archive.analysis).filter((sample) => {
        const bucket = this.sampleBucket(sample.time);
        if (bucket <= this.sampledBucket) return false;
        this.sampledBucket = bucket;
        return true;
      });
      this.technologies = structuredClone(archive.technologies);
      const last = archive.analysis.at(-1);
      if (last) {
        this.losses = last.players.map((p) => p.losses);
        this.gathered = last.players.map((p) => p.gathered);
        this.buildingLosses = last.players.map((p) => p.buildingLosses ?? 0);
        this.lostValue = last.players.map((p) => p.lostValue ?? 0);
      }
    } else {
      this.initial = saveGame(state);
      this.sample(true);
    }
    this.unsubscribe = subscribeSimulation(state, {
      command: (side, command) => {
        if (this.actions.length >= MAX_ACTIONS) {
          this.fail("Replay command limit reached.");
          return;
        }
        this.actions.push({ type: "command", side, command });
        this.collectEvents();
        this.sample(isGameOver(state));
      },
      step: (dt) => {
        if (this.state.tick - this.initial.state.tick > MAX_TICKS) {
          this.fail("Replay duration limit reached.");
          return;
        }
        const last = this.actions.at(-1);
        if (last?.type === "advance" && last.dt === dt) last.ticks++;
        else if (this.actions.length < MAX_ACTIONS) this.actions.push({ type: "advance", dt, ticks: 1 });
        else {
          this.fail("Replay command limit reached.");
          return;
        }
        this.collectEvents();
        for (const side of state.players.map((_, i) => i)) for (const upgrade of state.players[side].upgrades) {
          if (this.knownUpgrades[side].has(upgrade)) continue;
          this.knownUpgrades[side].add(upgrade);
          this.technologies.push({ side, upgrade, tick: state.tick, time: state.time });
        }
        this.sample(isGameOver(state));
      }
    });
  }
  state;
  initial;
  actions = [];
  samples = [];
  losses;
  gathered;
  buildingLosses;
  lostValue;
  technologies = [];
  knownUpgrades;
  consumedEvents;
  sampledBucket = -1;
  unsubscribe;
  error = null;
  collectEvents() {
    const state = this.state;
    for (const event of state.events) {
      if (this.consumedEvents.has(event)) continue;
      this.consumedEvents.add(event);
      if (event.type === "death") {
        const entity = state.entities.find((e) => e.id === event.source);
        if (entity && !entity.illusion && !entity.raised) {
          if (entity.kind === "unit") this.losses[event.side]++;
          else this.buildingLosses[event.side]++;
          this.lostValue[event.side] += entityValue(state, entity) + entity.carried;
        }
      }
      if (event.type === "gather") this.gathered[event.side] += event.amount ?? 0;
    }
  }
  fail(message3) {
    this.error = message3;
    this.unsubscribe?.();
  }
  sampleBucket(time) {
    return Math.floor((time - this.initial.state.time + 1e-8) / 5);
  }
  sampleValue() {
    return { tick: this.state.tick, time: this.state.time, players: this.state.players.map((_, side) => armySample(this.state, side, this.losses[side], this.gathered[side], this.buildingLosses[side], this.lostValue[side])) };
  }
  sample(force = false) {
    const bucket = this.sampleBucket(this.state.time);
    if (!force && bucket <= this.sampledBucket) return;
    const sample = this.sampleValue();
    if (this.samples.at(-1)?.tick === sample.tick) this.samples[this.samples.length - 1] = sample;
    else this.samples.push(sample);
    this.sampledBucket = bucket;
  }
  get failure() {
    return this.error;
  }
  get analysis() {
    const samples = structuredClone(this.samples), sample = this.sampleValue();
    if (samples.at(-1)?.tick === sample.tick) samples[samples.length - 1] = sample;
    else samples.push(sample);
    return samples;
  }
  get technologyTimings() {
    return structuredClone(this.technologies);
  }
  export() {
    if (this.error) throw new Error(this.error);
    return { format: FORMAT, version: 1, checksumVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, initial: structuredClone(this.initial), actions: structuredClone(this.actions), finalTick: this.state.tick, finalChecksum: replayChecksum(this.state), analysis: this.analysis, technologies: this.technologyTimings };
  }
  dispose() {
    this.unsubscribe();
  }
};
function decodeReplay(input) {
  if (typeof input === "string") {
    if (input.length > 20 * 1024 * 1024) throw new Error("Replay exceeds 20 MiB.");
    try {
      input = JSON.parse(input);
    } catch {
      throw new Error("Invalid replay JSON.");
    }
  }
  if (!record2(input) || !exactKeys(input, ["format", "version", "initial", "actions", "finalTick", "finalChecksum", "analysis", "technologies", "checksumVersion", "simulationRevision"]) || input.format !== FORMAT || input.version !== 1) throw new Error("Unsupported replay format or version.");
  const initial = loadGame(input.initial);
  if (!record2(input.initial) || !integer(input.initial.version) || ![1, 2, SAVE_VERSION].includes(input.initial.version) || input.checksumVersion !== void 0 && input.checksumVersion !== input.initial.version) throw new Error("Replay checksum version must match its original save version.");
  if (input.simulationRevision !== void 0 && (typeof input.simulationRevision !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(input.simulationRevision))) throw new Error("Invalid simulation rules revision.");
  const validSide = (side) => integer(side) && side < initial.players.length;
  if (!Array.isArray(input.actions) || input.actions.length > MAX_ACTIONS) throw new Error("Invalid replay actions.");
  let ticks = 0;
  for (const action2 of input.actions) {
    if (!record2(action2)) throw new Error("Malformed replay action.");
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
    if (!record2(sample) || !exactKeys(sample, ["tick", "time", "players"]) || !integer(sample.tick) || sample.tick <= lastTick || sample.tick > input.finalTick || typeof sample.time !== "number" || !Number.isFinite(sample.time) || sample.time < initial.time || !Array.isArray(sample.players) || sample.players.length !== initial.players.length) throw new Error("Malformed replay sample.");
    lastTick = sample.tick;
    for (const player of sample.players) {
      if (!record2(player) || !exactKeys(player, ["wood", "ore", "crystal", "units", "buildings", "losses", "gathered", "upgrades", "armyValue", "buildingLosses", "lostValue"]) || !["wood", "ore", "crystal", "units", "buildings", "losses", "gathered"].every((k) => typeof player[k] === "number" && Number.isFinite(player[k]) && player[k] >= 0) || !["armyValue", "buildingLosses", "lostValue"].every((k) => player[k] === void 0 || typeof player[k] === "number" && Number.isFinite(player[k]) && player[k] >= 0) || !Array.isArray(player.upgrades) || !player.upgrades.every((x) => typeof x === "string" && x.length < 80)) throw new Error("Malformed replay army sample.");
    }
  }
  if (!Array.isArray(input.technologies) || input.technologies.length > 200) throw new Error("Invalid technology history.");
  for (const tech of input.technologies) {
    if (!record2(tech) || !exactKeys(tech, ["side", "upgrade", "tick", "time"]) || !validSide(tech.side) || typeof tech.upgrade !== "string" || tech.upgrade.length > 80 || !integer(tech.tick) || tech.tick < initial.tick || tech.tick > input.finalTick || typeof tech.time !== "number" || !Number.isFinite(tech.time) || tech.time < initial.time) throw new Error("Invalid technology timing.");
  }
  const decoded = structuredClone(input);
  decoded.checksumVersion = input.initial.version;
  decoded.simulationRevision = input.simulationRevision ?? LEGACY_SIMULATION_REVISIONS[input.initial.version];
  return decoded;
}
function replayRulesCompatible(archive) {
  return archive.initial.version === SAVE_VERSION && (archive.simulationRevision ?? LEGACY_SIMULATION_REVISIONS[archive.initial.version]) === SIMULATION_REVISION;
}

// <stdin>
var definition2 = { schemaVersion: 1, id: "limits-proof", title: "Limits proof", briefing: "Hold the supplied position.", successText: "Position held.", failureText: "Position lost.", faction: "fairies", opponent: "orcs", seed: 22, map: { size: "small", width: 36, height: 36, terrain: Array(36 * 36).fill("grass"), starts: [{ x: 4, y: 4 }, { x: 31, y: 31 }], resources: [] }, army: Array.from({ length: 129 }, (_, i) => ({ label: "troop-" + i, side: 0, kind: "unit", role: "melee", x: 3 + i % 13, y: 3 + Math.floor(i / 13), order: { type: "hold" } })), objectives: [{ id: "hold", text: "Hold until the signal.", success: { type: "time", seconds: 35 } }], events: [], rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 120 } };
var session = createScenario(definition2);
var saveError = "";
var recorderError = "";
try {
  saveGame(session.state);
} catch (e) {
  saveError = String(e);
}
try {
  new MatchRecorder(session.state);
} catch (e) {
  recorderError = String(e);
}
console.log(JSON.stringify({ actors: session.state.entities.length, labels: Object.keys(session.runtime.labels).length, checkpoint: captureScenario(session).game.state.entities.length, saveError, recorderError }));
