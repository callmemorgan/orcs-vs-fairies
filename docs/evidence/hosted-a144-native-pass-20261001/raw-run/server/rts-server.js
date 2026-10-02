// src/server/main.ts
import { resolve as resolve3 } from "node:path";
import { readFile as readFile4 } from "node:fs/promises";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/core/content.ts
var ECONOMY = { harvestPerSecond: 2.28 };
var unit = (id6, name, role, wood, ore, hp, damage2, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id6, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage: damage2, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building = (id6, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id: id6, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
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
var FACTIONS = Object.fromEntries(Object.entries(BASE_FACTIONS).map(([id6, base]) => {
  const faction = id6, prefix = base.units.worker.id.split("-")[0], names = expansionNames[faction];
  return [id6, { ...base, buildings: {
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
function factionSystemDefinition(id6) {
  return id6 ? Object.values(FACTION_SYSTEM_DEFINITIONS).flatMap((f) => [...f.units, ...f.buildings]).find((d) => d.id === id6) : void 0;
}
function factionStructureKind(id6) {
  return Object.keys(FACTION_STRUCTURE_INFO).find((kind) => FACTION_STRUCTURE_INFO[kind].definition.id === id6);
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
  const id6 = `core:${faction}-${kind === "hero" ? "commander" : kind}`;
  return [id6, { path: `/mods/core/${faction}-${kind}.svg`, svg: svg(faction, kind), width: 128, height: 128, anchor: [64, 112], visualTop: 20 }];
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
for (const [id6, drawing] of Object.entries(factionObjectDrawings)) BUILTIN_EXTRA_ART[id6] = { path: `/mods/core/${id6.slice(5)}.svg`, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#20332f" stroke-width="3">${drawing}</g></svg>`, width: 128, height: 128, anchor: [64, 112], visualTop: 10 };

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
var unit2 = (id6, name, role, wood, ore, hp, damage2, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id6, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage: damage2, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building2 = (id6, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id: id6, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
var BASE_FACTIONS2 = {
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
var expansionNames2 = {
  orcs: ["Boar Rider", "Pikejaw", "Iron Catapult"],
  fairies: ["Stag Rider", "Briar Pike", "Thorn Trebuchet"],
  dwarves: ["Mountain Rider", "Deep Pike", "Stone Thrower"],
  undead: ["Dread Rider", "Bone Pike", "Grave Catapult"],
  tideborn: ["Shell Rider", "Reef Pike", "Coral Mangonel"],
  automata: ["Strider", "Lance Sentinel", "Siege Engine"]
};
var FACTIONS2 = Object.fromEntries(Object.entries(BASE_FACTIONS2).map(([id6, base]) => {
  const faction = id6, prefix = base.units.worker.id.split("-")[0], names = expansionNames2[faction];
  return [id6, { ...base, buildings: {
    ...base.buildings,
    wall: { ...building2(`${prefix}-wall`, "Stone Wall", "wall", 30, 25, 1100, 1, 15, "A durable barrier. Siege engines break walls quickly."), age: 2 },
    gate: { ...building2(`${prefix}-gate`, "Town Gate", "gate", 90, 65, 1400, 2, 28, "Open to let armies pass. An open gate also admits enemies. Cannot close on a unit."), age: 2 }
  }, units: {
    ...base.units,
    special: { ...base.units.special, age: 2 },
    cavalry: { ...unit2(`${prefix}-cavalry`, names[0], "cavalry", 100, 65, 210, 18, 2, 1.5, 3.5, 1.3, 42, void 0, "Fast raider. Strong against ranged troops; vulnerable to pikes."), age: 2, bonusAgainst: { ranged: 1.7 } },
    spear: { ...unit2(`${prefix}-spear`, names[1], "spear", 55, 25, 125, 11, 1, 1.9, 2.1, 1.25, 28, void 0, "Long pike infantry. Deals triple damage to cavalry."), age: 1, bonusAgainst: { cavalry: 3 } },
    siege: { ...unit2(`${prefix}-siege`, names[2], "siege", 180, 140, 185, 28, 2, 8.5, 1.05, 3.8, 65, void 0, "Long-range siege engine. Deals quadruple damage to buildings. Protect it from raiders."), age: 3, cost: { wood: 180, ore: 140, crystal: 25 }, buildingDamageMultiplier: 4, sight: 11 }
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
function fail(path3, message5) {
  throw new Error(`Invalid content at ${path3}: ${message5}.`);
}
function obj(input, path3, required, optional = []) {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(path3, "expected a plain object");
  const value = input;
  if (Object.getOwnPropertySymbols(value).length) fail(path3, "symbol fields are unsupported");
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail(`${path3}.${key}`, "accessors are unsupported");
  }
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path3}.${key}`, "missing field");
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) fail(`${path3}.${key}`, "unsupported field");
  return value;
}
function num(v, path3, min, max, integer5 = false) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer5 && !Number.isSafeInteger(v)) fail(path3, `expected ${integer5 ? "a whole" : "a finite"} number from ${min} to ${max}`);
  return v;
}
function str(v, path3, max = 200) {
  if (typeof v !== "string" || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) fail(path3, "expected text");
  return v;
}
function arr(v, path3, max) {
  if (!Array.isArray(v) || v.length > max) fail(path3, `expected at most ${max} entries`);
  for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, i)) fail(path3, "sparse arrays are not supported");
  else if (!("value" in Object.getOwnPropertyDescriptor(v, String(i)))) fail(path3, "array accessors are unsupported");
  return v;
}
function one(v, path3, choices) {
  if (typeof v !== "string" || !choices.includes(v)) fail(path3, "unsupported value");
  return v;
}
function definitionId(v, path3, namespace) {
  const value = str(v, path3, 100);
  if (!/^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(value) || namespace && !value.startsWith(`${namespace}:`)) fail(path3, `expected a namespaced definition ID${namespace ? ` owned by ${namespace}` : ""}`);
  return value;
}
function cost(v, path3) {
  const value = obj(v, path3, ["wood", "ore", "crystal"]);
  for (const key of ["wood", "ore", "crystal"]) num(value[key], `${path3}.${key}`, 0, 1e5);
}
function unit3(v, path3, namespace) {
  const value = obj(v, path3, ["id", "name", "role", "cost", "hp", "damage", "armor", "range", "speed", "cooldown", "trainTime", "sight", "description"], ["shield", "buildingDamageMultiplier", "age", "bonusAgainst", "ability", "tags"]);
  definitionId(value.id, `${path3}.id`, namespace);
  str(value.name, `${path3}.name`);
  str(value.description, `${path3}.description`, 2e3);
  one(value.role, `${path3}.role`, unitRoles);
  cost(value.cost, `${path3}.cost`);
  for (const [key, min, max] of [["hp", 1, 1e5], ["damage", 0, 1e4], ["armor", 0, 1e3], ["range", 0.5, 30], ["speed", 0.1, 10], ["cooldown", 0.05, 60], ["trainTime", 0.05, 600], ["sight", 1, 30]]) num(value[key], `${path3}.${key}`, min, max);
  if (value.shield !== void 0) num(value.shield, `${path3}.shield`, 0, 1e5);
  if (value.buildingDamageMultiplier !== void 0) num(value.buildingDamageMultiplier, `${path3}.buildingDamageMultiplier`, 0.1, 10);
  if (value.age !== void 0) num(value.age, `${path3}.age`, 1, 3, true);
  if (value.ability !== void 0) {
    one(value.ability, `${path3}.ability`, Object.keys(ABILITIES));
    if (["incendiary-shell", "rooting-shell", "ammunition-cannon", "corpse-shell", "flood-shell", "powered-beam"].includes(value.ability) && value.role !== "siege") fail(`${path3}.ability`, "artillery preparation requires the siege role");
  }
  if (value.tags !== void 0) arr(value.tags, `${path3}.tags`, 2).forEach((tag, i) => one(tag, `${path3}.tags[${i}]`, ["hero", "engineer"]));
  if (value.bonusAgainst !== void 0) {
    const bonuses = obj(value.bonusAgainst, `${path3}.bonusAgainst`, [], unitRoles);
    for (const [key, factor] of Object.entries(bonuses)) num(factor, `${path3}.bonusAgainst.${key}`, 0.1, 10);
  }
}
function building3(v, path3, namespace) {
  const value = obj(v, path3, ["id", "name", "role", "cost", "hp", "size", "buildTime", "sight", "description"], ["age", "ability", "tags"]);
  definitionId(value.id, `${path3}.id`, namespace);
  str(value.name, `${path3}.name`);
  str(value.description, `${path3}.description`, 2e3);
  one(value.role, `${path3}.role`, buildingRoles);
  cost(value.cost, `${path3}.cost`);
  for (const [key, min, max] of [["hp", 1, 1e5], ["size", 1, 6], ["buildTime", 0.05, 600], ["sight", 1, 30]]) num(value[key], `${path3}.${key}`, min, max, key === "size");
  if (value.tags !== void 0) arr(value.tags, `${path3}.tags`, 2).forEach((tag, i) => one(tag, `${path3}.tags[${i}]`, ["beacon", "barricade"]));
  if (value.age !== void 0) num(value.age, `${path3}.age`, 1, 3, true);
  if (value.ability !== void 0) one(value.ability, `${path3}.ability`, ["heal"]);
}
function research(v, path3, namespace) {
  const value = obj(v, path3, ["id", "name", "description", "cost", "researchTime", "building", "appliesTo", "effects"], ["age", "requires", "exclusiveGroup", "appliesToDefinitions"]);
  definitionId(value.id, `${path3}.id`, namespace);
  str(value.name, `${path3}.name`);
  str(value.description, `${path3}.description`, 2e3);
  cost(value.cost, `${path3}.cost`);
  num(value.researchTime, `${path3}.researchTime`, 0.05, 600);
  one(value.building, `${path3}.building`, buildingRoles);
  one(value.appliesTo, `${path3}.appliesTo`, unitRoles);
  if (value.age !== void 0) num(value.age, `${path3}.age`, 1, 3, true);
  if (value.requires !== void 0) arr(value.requires, `${path3}.requires`, 16).forEach((id6, i) => str(id6, `${path3}.requires[${i}]`, 100));
  if (value.exclusiveGroup !== void 0) definitionId(value.exclusiveGroup, `${path3}.exclusiveGroup`, namespace);
  if (value.appliesToDefinitions !== void 0) {
    const targets = arr(value.appliesToDefinitions, `${path3}.appliesToDefinitions`, 64);
    if (!targets.length) fail(`${path3}.appliesToDefinitions`, "at least one definition target is required");
    targets.forEach((id6, i) => str(id6, `${path3}.appliesToDefinitions[${i}]`, 100));
    if (new Set(targets).size !== targets.length) fail(`${path3}.appliesToDefinitions`, "duplicate definition target");
  }
  const effects = obj(value.effects, `${path3}.effects`, [], ["gather", "speed", "damage", "armor"]);
  if (!Object.keys(effects).length) fail(`${path3}.effects`, "research must change a permitted stat");
  for (const [key, factor] of Object.entries(effects)) num(factor, `${path3}.effects.${key}`, key === "armor" ? 0 : 0.1, key === "armor" ? 10 : 3);
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
var BASE_CONTENT_HASH = contentHash({ FACTIONS, UPGRADES, ECONOMY, ABILITIES, BUILTIN_EXTRA_DEFINITIONS, BUILTIN_EXTRA_ART, ECONOMY_BUILDINGS, ECONOMY_CARAVAN });
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
    const path3 = `package.factions[${i}]`, f = obj(v, path3, ["id", "baseFaction", "name", "subtitle", "description", "color", "accent", "units", "buildings", "research"], ["defaultUnits", "defaultBuildings"]);
    definitionId(f.id, `${path3}.id`, namespace);
    one(f.baseFaction, `${path3}.baseFaction`, builtinIds);
    for (const key of ["name", "subtitle", "description"]) str(f[key], `${path3}.${key}`, key === "description" ? 2e3 : 200);
    num(f.color, `${path3}.color`, 0, 16777215, true);
    if (!/^#[a-fA-F0-9]{6}$/.test(str(f.accent, `${path3}.accent`, 7))) fail(`${path3}.accent`, "expected a six-digit color");
    arr(f.units, `${path3}.units`, 64).forEach((v2, j) => unit3(v2, `${path3}.units[${j}]`, namespace));
    arr(f.buildings, `${path3}.buildings`, 32).forEach((v2, j) => building3(v2, `${path3}.buildings[${j}]`, namespace));
    arr(f.research, `${path3}.research`, 64).forEach((v2, j) => research(v2, `${path3}.research[${j}]`, namespace));
    for (const [field, roles2] of [["defaultUnits", unitRoles], ["defaultBuildings", buildingRoles]]) if (f[field] !== void 0) {
      const defaults = obj(f[field], `${path3}.${field}`, [], roles2);
      for (const [role, id6] of Object.entries(defaults)) definitionId(id6, `${path3}.${field}.${role}`);
    }
  });
  const art = obj(p.art, "package.art", [], Object.keys(p.art && typeof p.art === "object" ? p.art : {}));
  if (Object.keys(art).length > 128) fail("package.art", "too many assets");
  let pixels = 0;
  for (const [id6, input2] of Object.entries(art)) {
    definitionId(id6, `package.art.${id6}`, namespace);
    const a = obj(input2, `package.art.${id6}`, ["path", "svg", "width", "height", "anchor"], ["visualTop"]);
    const path3 = str(a.path, `package.art.${id6}.path`, 300);
    if (!/^\/mods\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(path3) || !path3.startsWith(`/mods/${namespace}/`)) fail(`package.art.${id6}.path`, "expected a packaged SVG under its own /mods directory");
    if (typeof a.svg !== "string" || a.svg.length > 1e5 || !a.svg.trim()) fail(`art.${id6}.svg`, "expected SVG source under 100000 characters");
    const svg2 = a.svg;
    if (!/^<svg\s/.test(svg2) || !/<\/svg>\s*$/.test(svg2) || /<(?:script|foreignObject|iframe|image|use|a|style|animate|set)\b|\bon[a-z]+\s*=|\bhref\s*=|\bstyle\s*=|&#|url\s*\(|<!|<\?/i.test(svg2.replace(/url\(#[a-zA-Z][a-zA-Z0-9-]*\)/g, ""))) fail(`art.${id6}.svg`, "only self-contained static SVG is permitted");
    for (const tag of svg2.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g)) if (!["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc", "defs", "linearGradient", "radialGradient", "stop"].includes(tag[1])) fail(`art.${id6}.svg`, `unsupported SVG element ${tag[1]}`);
    num(a.width, `art.${id6}.width`, 8, 512, true);
    num(a.height, `art.${id6}.height`, 8, 512, true);
    pixels += a.width * a.height;
    if (pixels > 4 * 1024 * 1024) fail("package.art", "decoded artwork exceeds 16 MiB");
    const anchor = arr(a.anchor, `art.${id6}.anchor`, 2);
    if (anchor.length !== 2) fail(`art.${id6}.anchor`, "expected two coordinates");
    num(anchor[0], `art.${id6}.anchor[0]`, 0, a.width);
    num(anchor[1], `art.${id6}.anchor[1]`, 0, a.height);
    if (a.visualTop !== void 0) num(a.visualTop, `art.${id6}.visualTop`, 0, a.height);
  }
  if (!/^[a-f0-9]{64}$/.test(str(p.hash, "package.hash", 64)) || p.hash !== contentHash(unsigned(p))) fail("package.hash", "SHA-256 does not match the manifest");
  if (new TextEncoder().encode(canonicalContent(p)).length > MAX_CONTENT_BYTES) fail("package", "file exceeds 2 MiB");
  return freeze(JSON.parse(JSON.stringify(p)));
}
var PINNED_BASE_FACTIONS = freeze(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS).map(([id6, f]) => [id6, { ...f, unitDefinitions: [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[id6].units, ECONOMY_CARAVAN], buildingDefinitions: [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[id6].buildings, ...Object.values(ECONOMY_BUILDINGS)] }])))));
var PINNED_BASE_RESEARCH = freeze(JSON.parse(JSON.stringify(UPGRADES)));
var CURRENT_BASE = { factions: PINNED_BASE_FACTIONS, art: BUILTIN_EXTRA_ART, research: PINNED_BASE_RESEARCH };
var LEGACY_BASE_CONTENT_HASH = contentHash({ FACTIONS: FACTIONS2, UPGRADES: UPGRADES2, ECONOMY: ECONOMY2, ABILITIES: ABILITIES2 });
var LEGACY_BASE = freeze({ factions: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS2).map(([id6, f]) => [id6, { ...f, unitDefinitions: Object.values(f.units), buildingDefinitions: Object.values(f.buildings) }])))), art: {}, research: JSON.parse(JSON.stringify(UPGRADES2)) });
function buildRegistry(packages, baseRegistry = CURRENT_BASE) {
  const factions = { ...baseRegistry.factions }, art = { ...baseRegistry.art }, ids = /* @__PURE__ */ new Set(), byId = new Map(packages.map((p) => [p.id, p]));
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
    const base = baseRegistry.factions[f.baseFaction], units = { ...base.units }, buildings2 = { ...base.buildings };
    for (const d of [...f.units, ...f.buildings, ...f.research]) {
      if (ids.has(d.id)) fail("definitions", `duplicate ${d.id}`);
      ids.add(d.id);
    }
    for (const [role, id6] of Object.entries(f.defaultUnits ?? {})) {
      const d = f.units.find((d2) => d2.id === id6);
      if (!d || d.role !== role) fail("defaultUnits", `${id6} is absent or has another role`);
      units[role] = d;
    }
    for (const [role, id6] of Object.entries(f.defaultBuildings ?? {})) {
      const d = f.buildings.find((d2) => d2.id === id6);
      if (!d || d.role !== role) fail("defaultBuildings", `${id6} is absent or has another role`);
      buildings2[role] = d;
    }
    const targetUnits = [...Object.values(units), ...f.units];
    for (const research2 of f.research) for (const id6 of research2.appliesToDefinitions ?? []) {
      const target = targetUnits.find((unit4) => unit4.id === id6);
      if (!target || target.role !== research2.appliesTo) fail("research.appliesToDefinitions", `${id6} is absent or has another role`);
    }
    const available = new Map([...Object.values(baseRegistry.research), ...f.research].map((d) => [d.id, d])), done = /* @__PURE__ */ new Set(), pending = /* @__PURE__ */ new Set();
    const check = (id6) => {
      if (pending.has(id6)) fail("research", `prerequisite cycle includes ${id6}`);
      if (done.has(id6)) return;
      const d = available.get(id6);
      if (!d) fail("research", `missing prerequisite ${id6}`);
      pending.add(id6);
      for (const dep of d.requires ?? []) check(dep);
      pending.delete(id6);
      done.add(id6);
    };
    f.research.forEach((d) => check(d.id));
    for (const d of [...f.units, ...f.buildings]) if (!Object.hasOwn(p.art, d.id)) fail("art", `missing custom artwork for ${d.id}`);
    factions[f.id] = freeze({ ...base, ...f, units, buildings: buildings2, unitDefinitions: [...Object.values(units), ...(base.unitDefinitions ?? []).filter((d) => !Object.values(base.units).some((x) => x.id === d.id)), ...f.units.filter((d) => !Object.values(units).some((base2) => base2.id === d.id))], buildingDefinitions: [...Object.values(buildings2), ...(base.buildingDefinitions ?? []).filter((d) => !Object.values(base.buildings).some((x) => x.id === d.id)), ...f.buildings.filter((d) => !Object.values(buildings2).some((base2) => base2.id === d.id))], research: f.research });
    Object.assign(art, p.art);
  }
  if (Object.values(art).reduce((sum, a) => sum + a.width * a.height, 0) > 16 * 1024 * 1024) fail("bundle.art", "decoded artwork exceeds 64 MiB");
  return freeze({ factions, art, research: baseRegistry.research });
}
function createContentBundle(inputs) {
  if (inputs.length > 32) fail("bundle.packages", "at most 32 packages are supported");
  const packages = inputs.map(decodeContentPackage).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const registry2 = buildRegistry(packages);
  const body2 = { format: "orcs-vs-fairies-content", schemaVersion: 1, engineVersion: CONTENT_ENGINE_VERSION, baseHash: BASE_CONTENT_HASH, packages };
  if (new TextEncoder().encode(canonicalContent(body2)).length > MAX_BUNDLE_BYTES) fail("bundle", "pinned package closure exceeds 4 MiB");
  const bundle = freeze({ ...body2, hash: contentHash(body2) });
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
function decodeHistoricalContentBundle(input) {
  const value = obj(input, "bundle", ["format", "schemaVersion", "engineVersion", "baseHash", "packages", "hash"]);
  if (value.baseHash === BASE_CONTENT_HASH) return decodeContentBundle(input);
  if (value.format !== "orcs-vs-fairies-content" || value.schemaVersion !== 1 || value.engineVersion !== CONTENT_ENGINE_VERSION) fail("bundle", "unsupported content version");
  if (value.baseHash !== LEGACY_BASE_CONTENT_HASH) fail("bundle.baseHash", "unrecognized historical built-in content");
  const packages = arr(value.packages, "bundle.packages", 32).map(decodeContentPackage).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const p of packages) for (const f of p.factions) {
    for (const d of f.units) {
      if (d.tags !== void 0 || d.ability !== void 0 && !Object.hasOwn(ABILITIES2, d.ability)) fail("package.units", "definition requires newer built-in rules");
    }
    for (const d of f.buildings) if (d.tags !== void 0) fail("package.buildings", "definition requires newer built-in rules");
    for (const d of f.research) if (d.exclusiveGroup !== void 0 || d.appliesToDefinitions !== void 0) fail("package.research", "definition requires newer built-in rules");
  }
  const body2 = { format: "orcs-vs-fairies-content", schemaVersion: 1, engineVersion: CONTENT_ENGINE_VERSION, baseHash: LEGACY_BASE_CONTENT_HASH, packages };
  if (new TextEncoder().encode(canonicalContent(body2)).length > MAX_BUNDLE_BYTES) fail("bundle", "pinned package closure exceeds 4 MiB");
  if (value.hash !== contentHash(body2)) fail("bundle.hash", "SHA-256 does not match the historical manifest");
  const admitted = freeze({ ...body2, hash: value.hash });
  caches.set(admitted, buildRegistry(packages, LEGACY_BASE));
  return admitted;
}
function migrateHistoricalContentBundle(input) {
  const original = decodeHistoricalContentBundle(input);
  return original.baseHash === BASE_CONTENT_HASH ? original : createContentBundle(original.packages);
}
function registry(state) {
  if (!state.content) return { factions: FACTIONS, art: BUILTIN_EXTRA_ART, research: UPGRADES };
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
function unitFor(state, subject, role, id6) {
  const side2 = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition2 = typeof subject === "number" ? id6 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side2);
  if (!f) throw new Error("Original unit faction is absent from pinned content.");
  const value = definition2 === ECONOMY_CARAVAN.id && !state.content ? ECONOMY_CARAVAN : definition2 ? (f.unitDefinitions ?? [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.units ?? []]).find((d) => d.id === definition2) : f.units[kind];
  if (!value || value.role !== kind) throw new Error(`Unit definition ${definition2 ?? kind} is absent from faction ${f.id}.`);
  return value;
}
function buildingFor(state, subject, role, id6) {
  const side2 = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition2 = typeof subject === "number" ? id6 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side2);
  if (!f) throw new Error("Original building faction is absent from pinned content.");
  const value = (!state.content ? Object.values(ECONOMY_BUILDINGS).find((d) => d.id === definition2) : void 0) ?? (definition2 ? (f.buildingDefinitions ?? [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.buildings ?? []]).find((d) => d.id === definition2) : f.buildings[kind]);
  if (!value || value.role !== kind) throw new Error(`Building definition ${definition2 ?? kind} is absent from faction ${f.id}.`);
  return value;
}
function entityDefinition(state, entity) {
  return entity.kind === "unit" ? unitFor(state, entity) : buildingFor(state, entity);
}
function upgradesFor(state, side2) {
  return { ...registry(state).research, ...Object.fromEntries((factionFor(state, side2).research ?? []).map((d) => [d.id, d])) };
}
function upgradeFor(state, side2, id6) {
  const d = upgradesFor(state, side2)[id6];
  if (!d) throw new Error(`Research ${id6} is absent from faction content.`);
  return d;
}
function queuedUnitFor(state, producer, index2) {
  return unitFor(state, producer.side, producer.queue[index2], producer.queueDefinitionIds?.[index2]);
}

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
var levelOf = (point5) => point5.level ?? 0;
var sameLevel = (a, b) => levelOf(a) === levelOf(b);
var fogKey = (s, point5) => levelOf(point5) * s.width * s.height + Math.floor(point5.y) * s.width + Math.floor(point5.x);
function elevationAt(s, point5) {
  if (point5.x < 0 || point5.y < 0 || point5.x >= s.width || point5.y >= s.height) return 0;
  return s.world?.levels[levelOf(point5)]?.elevation[Math.floor(point5.y) * s.width + Math.floor(point5.x)] ?? 0;
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
  const level2 = levelOf(point5), tile = Math.floor(point5.y) * s.width + Math.floor(point5.x), terrain2 = level2 === 0 ? s.terrain : s.world?.levels[level2]?.terrain;
  if (!Object.hasOwn(TERRAIN, kind) || !terrain2 || point5.x < 0 || point5.y < 0 || point5.x >= s.width || point5.y >= s.height) return false;
  if (terrain2[tile] === kind) return true;
  terrain2[tile] = kind;
  if (s.world) {
    s.world.levels[level2].terrain[tile] = kind;
    s.world.revision = (s.world.revision ?? 0) + 1;
    for (const creature of s.world.creatures) if (levelOf(creature) === level2) creature.path = [];
  }
  for (const entity of s.entities) if (levelOf(entity) === level2) entity.path = [];
  return true;
}
function terrainLineOfSight(s, from, to) {
  if (!sameLevel(from, to)) return false;
  if (!s.world) return true;
  const source2 = elevationAt(s, from), target = elevationAt(s, to), length2 = length2D(to.x - from.x, to.y - from.y), steps = Math.ceil(length2 * 3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, level: levelOf(from) };
    const terrain2 = s.world.levels[p.level].terrain[Math.floor(p.y) * s.width + Math.floor(p.x)];
    if (terrain2 === "rock" || elevationAt(s, p) > Math.max(source2, target) + 0.5) return false;
  }
  return true;
}
function validateWorldMap(value, options = {}) {
  const issues = [], record7 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!record7(value)) return { valid: false, issues: ["Map must be an object."] };
  const map = value;
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 8 || map.height < 8 || map.width > 128 || map.height > 128) return { valid: false, issues: ["Map dimensions must be integers from8 through128."] };
  if (!Number.isSafeInteger(map.seed) || map.seed < 0 || map.seed > 4294967295) issues.push("Map seed must be an unsigned32-bit integer.");
  if (!["small", "medium", "large", "huge"].includes(map.size)) issues.push("Unknown map size.");
  if (!Array.isArray(map.levels) || map.levels.length < 1 || map.levels.length > 2) return { valid: false, issues: [...issues, "Maps require one or two levels."] };
  const area = map.width * map.height, point5 = (p) => record7(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isInteger(p.level) && p.level >= 0 && p.level < map.levels.length && p.x >= 0.5 && p.y >= 0.5 && p.x <= map.width - 0.5 && p.y <= map.height - 0.5;
  for (let l = 0; l < map.levels.length; l++) {
    const level2 = map.levels[l];
    if (!record7(level2) || level2.id !== l || typeof level2.title !== "string" || level2.title.length > 80) issues.push(`Invalid level${l} title or identifier.`);
    if (!Array.isArray(level2?.terrain) || level2.terrain.length !== area || level2.terrain.some((t) => !Object.hasOwn(TERRAIN, t))) issues.push(`Level${l} terrain must contain one valid tile per map cell.`);
    if (!Array.isArray(level2?.elevation) || level2.elevation.length !== area || level2.elevation.some((e) => !Number.isInteger(e) || e < 0 || e > 3)) issues.push(`Level${l} elevation must contain integers0 through3.`);
  }
  if (issues.some((i) => i.includes("terrain") || i.includes("elevation"))) return { valid: false, issues };
  if (!Array.isArray(map.starts) || map.starts.length < 1 || map.starts.length > 8 || map.starts.some((p, i) => !point5(p) || p.slot !== i)) issues.push("Starting slots must be ordered0 through7 with valid coordinates.");
  if (!Array.isArray(map.resources) || map.resources.length > 2048 || map.resources.some((r) => !point5(r) || !["wood", "ore", "crystal"].includes(r.kind) || !Number.isFinite(r.amount) || !Number.isFinite(r.maxAmount) || r.amount < 0 || r.amount > r.maxAmount || r.maxAmount > 1e9)) issues.push("Invalid resource nodes.");
  if (!Array.isArray(map.sites) || map.sites.length > 128 || map.sites.some((p) => !point5(p) || !Number.isSafeInteger(p.id) || p.id < 1 || !["relic", "village", "monster"].includes(p.kind)) || new Set(map.sites?.map((p) => p.id)).size !== map.sites?.length) issues.push("Invalid or duplicate site definitions.");
  if (!Array.isArray(map.transitions) || map.transitions.length > 64 || map.transitions.some((t) => !record7(t) || !Number.isSafeInteger(t.id) || t.id < 1 || !point5(t.from) || !point5(t.to) || t.from.level === t.to.level) || new Set(map.transitions?.map((t) => t.id)).size !== map.transitions?.length) issues.push("Invalid or duplicate level entrances.");
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
    const canonical4 = Math.min(i, area - 1 - i), noise = (Math.imul(seed ^ canonical4 ^ 2436741650, 2246822507) >>> 0) % 100;
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
  for (const level2 of world.levels) {
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
      world.bridges.push({ id: s.nextId++, x: center % s.width + 0.5, y: Math.floor(center / s.width) + 0.5, level: level2.id, hp: Math.max(160, queue.length * 25), maxHp: Math.max(160, queue.length * 25), tiles: queue, rebuilding: 0, repairSide: null });
    }
  }
  return world;
}

// src/core/match-rules.ts
var plain = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function fields(value, allowed, name) {
  if (!plain(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`Invalid ${name}.`);
  return value;
}
function num2(value, min, max, name, integer5 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer5 && !Number.isSafeInteger(value)) throw new Error(`Invalid ${name}.`);
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
  return [.../* @__PURE__ */ new Set(["economy:caravan", ...Object.keys(contentFactions(content)).flatMap((faction) => {
    const context = factionContext(faction, content);
    return [...availableUnits(context, 0).map((u) => u.id), ...Object.keys(upgradesFor(context, 0))];
  })])];
}
function normalizeMatchRules(value = {}, content) {
  const r = fields(value, ["mode", "standardDefeat", "startingAge", "sharedVision", "friendlyFire", "startingResources", "disabledDefinitionIds", "hill", "relic", "survival", "draft"], "match rules");
  if (Object.values(r).some((v) => v === null)) throw new Error("Invalid null match rule.");
  const mode = r.mode ?? "annihilation";
  if (!["annihilation", "hill", "relic", "survival", "scenario"].includes(mode)) throw new Error("Unknown victory mode.");
  const h = fields(r.hill ?? {}, ["radius", "captureTicks", "holdTicks"], "hill rules"), l = fields(r.relic ?? {}, ["count", "required", "holdTicks", "pickupRadius"], "relic rules"), s = fields(r.survival ?? {}, ["defenderTeam", "waveCount", "intervalTicks", "recoveryTicks", "unitsPerWave", "rewardPerWave"], "survival rules"), d = fields(r.draft ?? {}, ["enabled", "banRounds", "pickRounds", "turnTicks"], "draft rules");
  if ([h, l, s, d].some((group) => Object.values(group).some((v) => v === null))) throw new Error("Invalid null objective or draft rule.");
  const disabled = r.disabledDefinitionIds ?? [];
  if (!Array.isArray(disabled) || disabled.length > 256 || disabled.some((id6) => typeof id6 !== "string" || id6.length > 128 || !definitionIds(content).includes(id6)) || new Set(disabled).size !== disabled.length) throw new Error("Disabled definitions must be unique known unit or technology IDs.");
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
  return [...availableUnits(context, 0).filter((u) => u.role !== "worker").map((u) => u.id), ...Object.keys(upgradesFor(context, 0)).filter((id6) => !["town-age", "citadel-age"].includes(id6))];
};
function createDraft(players, rules, content) {
  const pool = [...new Set(players.flatMap((p) => draftOptions(p.factionId, content)))].filter((id6) => !rules.disabledDefinitionIds.includes(id6)), order3 = [];
  if (rules.draft.enabled) {
    for (let round = 0; round < rules.draft.banRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order3.push({ side: p.id, action: "ban" });
    for (let round = 0; round < rules.draft.pickRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order3.push({ side: p.id, action: "pick" });
  }
  if (rules.draft.enabled && players.some((p) => draftOptions(p.factionId, content).filter((id6) => pool.includes(id6)).length < rules.draft.pickRounds + rules.draft.banRounds * players.length || !availableUnits(factionContext(p.factionId, content), 0).some((u) => u.role !== "worker" && pool.includes(u.id)))) throw new Error("Draft has too many bans/picks for the available faction definitions. Reduce bans or picks.");
  return { status: order3.length ? "drafting" : "complete", turn: 0, remainingTicks: order3.length ? rules.draft.turnTicks : 0, order: order3, banned: [], picks: players.map(() => []), pool };
}
function legalDraftChoices(draft, players, side2, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || turn?.side !== side2) return [];
  const pickGoal = (id6) => draft.order.filter((t) => t.side === id6 && t.action === "pick").length;
  return draft.pool.filter((id6) => {
    if (draft.banned.includes(id6) || draft.picks[side2]?.includes(id6)) return false;
    if (turn.action === "ban") return players.every((p) => draftOptions(p.factionId, content).filter((option) => draft.pool.includes(option) && option !== id6 && !draft.banned.includes(option)).length >= pickGoal(p.id) && combatIds(p.factionId, content).some((option) => draft.pool.includes(option) && option !== id6 && !draft.banned.includes(option)));
    if (!draftOptions(players[side2].factionId, content).includes(id6)) return false;
    return draft.picks[side2].length !== pickGoal(side2) - 1 || draft.picks[side2].some((option) => combatIds(players[side2].factionId, content).includes(option)) || combatIds(players[side2].factionId, content).includes(id6);
  });
}
var combatIds = (factionId, content) => availableUnits(factionContext(factionId, content), 0).filter((u) => u.role !== "worker").map((u) => u.id);
function applyDraftChoice(draft, rules, players, side2, definitionId2, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || !turn || turn.side !== side2 || !legalDraftChoices(draft, players, side2, content).includes(definitionId2)) return false;
  if (turn.action === "pick" && draft.picks[side2].length === rules.draft.pickRounds - 1 && !draft.picks[side2].some((id6) => combatIds(players[side2].factionId, content).includes(id6)) && !combatIds(players[side2].factionId, content).includes(definitionId2)) return false;
  if (turn.action === "ban" && players.some((p) => draftOptions(p.factionId, content).filter((id6) => draft.pool.includes(id6) && id6 !== definitionId2 && !draft.banned.includes(id6)).length < rules.draft.pickRounds || !combatIds(p.factionId, content).some((id6) => draft.pool.includes(id6) && id6 !== definitionId2 && !draft.banned.includes(id6)))) return false;
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
  for (const id6 of choices) if (applyDraftChoice(draft, rules, players, turn.side, id6, content)) return true;
  throw new Error("Draft turn has no legal choices.");
}
function draftDefinitions(state) {
  return [...new Map(state.players.flatMap((_, side2) => [...availableUnits(state, side2), ...Object.values(upgradesFor(state, side2))]).map((definition2) => [definition2.id, { id: definition2.id, name: definition2.name }])).values()];
}
function draftPlayers(state) {
  return state.players.map((p, id6) => ({ id: id6, factionId: p.faction }));
}
function definitionAllowed(state, side2, id6) {
  if (state.rules.disabledDefinitionIds.includes(id6) || state.draft.banned.includes(id6)) return false;
  const necessary = id6 === "economy:caravan" || id6 === "town-age" || id6 === "citadel-age" || availableUnits(state, side2).some((unit4) => unit4.role === "worker" && unit4.id === id6);
  return !state.rules.draft.enabled || necessary || state.draft.status === "complete" && state.draft.picks[side2].includes(id6);
}
function validateModeRoster(state) {
  if (state.rules.mode !== "survival") return;
  if (!state.teams.includes(state.rules.survival.defenderTeam) || new Set(state.teams).size !== 2) throw new Error("Survival requires a defender team and one opposing wave team.");
  if (state.draft.status === "complete" && state.players.some((_player, side2) => state.teams[side2] !== state.rules.survival.defenderTeam && !availableUnits(state, side2).some((unit4) => unit4.role !== "worker" && definitionAllowed(state, side2, unit4.id)))) throw new Error("Every wave slot needs an enabled combat unit.");
}
function validateDraftState(value, players, rules, content) {
  const d = fields(value, ["status", "turn", "remainingTicks", "order", "banned", "picks", "pool"], "draft state"), expected = createDraft(players, rules, content);
  const turn = num2(d.turn, 0, expected.order.length, "draft turn", true);
  if (JSON.stringify(d.order) !== JSON.stringify(expected.order) || JSON.stringify(d.pool) !== JSON.stringify(expected.pool)) throw new Error("Draft order or pool differs from the match rules.");
  if (!Array.isArray(d.banned) || !Array.isArray(d.picks) || d.picks.length !== players.length || d.picks.some((p) => !Array.isArray(p) || p.length > rules.draft.pickRounds || p.some((id6) => typeof id6 !== "string"))) throw new Error("Invalid saved draft choices.");
  const choices = d.picks;
  const picked = players.map(() => 0);
  let banned = 0;
  for (let i = 0; i < turn; i++) {
    const action2 = expected.order[i], id6 = action2.action === "ban" ? d.banned[banned++] : choices[action2.side][picked[action2.side]++];
    if (typeof id6 !== "string" || !applyDraftChoice(expected, rules, players, action2.side, id6, content)) throw new Error("Saved draft contains an illegal choice.");
  }
  if (banned !== d.banned.length || picked.some((count, side2) => count !== choices[side2].length) || d.status !== expected.status) throw new Error("Saved draft choices do not match its turn.");
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
    const id6 = num2(v, 0, 7, "objective team", true);
    if (!state.teams.includes(id6)) throw new Error("Objective refers to an absent team.");
    return id6;
  };
  const point5 = (p) => ({ x: num2(p.x, 0, state.width, "objective x"), y: num2(p.y, 0, state.height, "objective y"), ...p.level === void 0 ? {} : { level: num2(p.level, 0, (state.world?.levels.length ?? 1) - 1, "objective level", true) } });
  const hill = { ...point5(h), ownerTeam: team(h.ownerTeam), captureTeam: team(h.captureTeam), captureTicks: num2(h.captureTicks, 0, state.rules.hill.captureTicks, "hill capture ticks", true), holdTicks: num2(h.holdTicks, 0, state.rules.hill.holdTicks, "hill hold ticks", true), contested: bool(h.contested, "contested hill") };
  if (!Array.isArray(o.relics) || o.relics.length !== (state.rules.mode === "relic" ? state.rules.relic.count : 0)) throw new Error("Invalid saved relic count.");
  const relics = o.relics.map((v, i) => {
    const r = fields(v, ["id", "x", "y", "level", "carrierId", "heldTeam"], "relic state");
    if (r.id !== i + 1) throw new Error("Invalid saved relic ID.");
    const carrierId = r.carrierId === null ? null : num2(r.carrierId, 1, state.nextId - 1, "relic carrier ID", true);
    if (carrierId !== null && !state.entities.some((e) => e.id === carrierId && e.kind === "unit" && e.hp > 0 && !e.illusion)) throw new Error("Relic carrier must be a living ordinary unit.");
    if (carrierId !== null && levelOf(r) !== levelOf(state.entities.find((e) => e.id === carrierId))) throw new Error("Relic and carrier must share a map level.");
    const heldTeam = team(r.heldTeam);
    if (carrierId !== null && heldTeam !== null) throw new Error("Carried relic cannot be held in a shrine.");
    return { id: i + 1, ...point5(r), carrierId, heldTeam };
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

// src/server/server.ts
import { createServer } from "node:http";
import { randomBytes, randomUUID as randomUUID4, createHash as createHash6, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFile as readFile3, stat } from "node:fs/promises";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve as resolve2, extname, sep } from "node:path";
import { isIP } from "node:net";
import { WebSocket, WebSocketServer } from "ws";

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
  return Object.keys(PROMOTIONS).filter((id6) => PROMOTIONS[id6].roles.includes(unitFor(s, e).role));
}
function promote(s, side2, id6, promotion) {
  const e = s.entities.find((e2) => e2.id === id6 && e2.side === side2 && e2.hp > 0), v = e?.veteran;
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
function recoverArtifact(s, side2, id6, artifact) {
  const e = s.entities.find((e2) => e2.id === id6 && e2.side === side2 && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact);
  if (!e || !equipmentEligible(s, e) || !item?.position || item.holder !== void 0 || item.owner !== void 0 && item.owner !== side2 || (e.level ?? 0) !== (item.position.level ?? 0) || (s.specialists?.artifacts.filter((a) => a.holder === e.id).length ?? 0) >= 12 || length2D(e.x - item.position.x, e.y - item.position.y) > 2) return false;
  const tile = (item.position.level ?? 0) * s.width * s.height + Math.floor(item.position.y) * s.width + Math.floor(item.position.x);
  if (!s.visible[side2].has(tile)) return false;
  item.owner = side2;
  item.holder = e.id;
  delete item.position;
  return true;
}
function equipArtifact(s, side2, id6, artifact) {
  const e = s.entities.find((e2) => e2.id === id6 && e2.side === side2 && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact), def = item ? ARTIFACTS[item.definitionId] : void 0;
  if (!e || !equipmentEligible(s, e) || !item || !def || item.owner !== side2 || item.holder !== e.id || !def.roles.includes(unitFor(s, e).role)) return false;
  e.equipment ??= {};
  e.equipment[def.slot] = artifact;
  return true;
}
function unequipArtifact(s, side2, id6, slot) {
  const e = s.entities.find((e2) => e2.id === id6 && e2.side === side2 && e2.hp > 0);
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
function observedArtifacts(s, side2) {
  return (s.specialists?.artifacts ?? []).filter((item) => item.owner === side2 || item.position && s.visible[side2].has((item.position.level ?? 0) * s.width * s.height + Math.floor(item.position.y) * s.width + Math.floor(item.position.x))).map((item) => ({ ...item, position: item.position ? { ...item.position } : void 0 }));
}
function dropArtifact(s, side2, id6, artifact) {
  const e = s.entities.find((e2) => e2.id === id6 && e2.side === side2 && e2.hp > 0), item = s.specialists?.artifacts.find((item2) => item2.id === artifact);
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
function economyStock(s, economy, id6) {
  const entity = s.entities.find((e) => e.id === id6 && e.hp > 0 && e.kind === "building" && e.progress === 1 && (e.role === "hq" || e.role === "depot"));
  if (!entity) return void 0;
  return economy.structures.find((item) => item.entityId === id6 && item.kind === "warehouse")?.stock ?? s.players[entity.side];
}
var levelOf2 = (p) => p.level ?? 0;
var sameLevel2 = (a, b) => levelOf2(a) === levelOf2(b);
var distance = (a, b) => sameLevel2(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
function economyMessage(s, e, text5, target) {
  s.events.push({ type: "message", x: e.x, y: e.y, level: levelOf2(e), side: e.side, source: e.id, text: text5, ...target === void 0 ? {} : { target } });
}

// src/core/economy-validation.ts
var ECONOMY_COMMAND_TYPES = ["plantGrove", "buildEconomy", "setOvercharge", "trainCaravan", "tradeRoute", "deliverStock", "marketTrade", "raidSupply", "collectSalvage", "setWarehouse", "specializeSettlement", "acceptContract", "deliverContract"];
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var id = (v) => Number.isSafeInteger(v) && v > 0;
var num3 = (v, min = 0, max = 1e4) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
var keys = (v, fields2) => Object.keys(v).every((key) => fields2.includes(key)) && fields2.every((key) => Object.hasOwn(v, key));
var cost2 = (v) => record(v) && keys(v, ["wood", "ore", "crystal"]) && ["wood", "ore", "crystal"].every((k) => num3(v[k]));
var kinds = ["wood", "ore", "crystal"];
function validateEconomyCommand(v) {
  if (!record(v) || typeof v.type !== "string" || !ECONOMY_COMMAND_TYPES.includes(v.type)) return false;
  const ids = () => Array.isArray(v.ids) && v.ids.length > 0 && v.ids.length <= 100 && v.ids.every(id) && new Set(v.ids).size === v.ids.length;
  const positionKeys = (fields2) => keys(v, v.level === void 0 ? fields2 : [...fields2, "level"]) && (v.level === void 0 || num3(v.level, 0, 1) && Number.isSafeInteger(v.level));
  if (v.type === "plantGrove") return positionKeys(["type", "ids", "x", "y"]) && ids() && num3(v.x, 0, 256) && num3(v.y, 0, 256);
  if (v.type === "buildEconomy") return v.kind === "warehouse" ? positionKeys(["type", "ids", "kind", "x", "y"]) && ids() && num3(v.x, 0, 256) && num3(v.y, 0, 256) : keys(v, ["type", "ids", "kind", "target"]) && ids() && ["extractor", "deep-mine"].includes(v.kind) && id(v.target);
  if (v.type === "setOvercharge") return keys(v, ["type", "id", "enabled"]) && id(v.id) && typeof v.enabled === "boolean";
  if (v.type === "trainCaravan" || v.type === "acceptContract") return keys(v, ["type", "id"]) && id(v.id);
  if (v.type === "tradeRoute") return keys(v, ["type", "id", "source", "target", "kind", "amount", "repeat"]) && id(v.id) && id(v.source) && id(v.target) && kinds.includes(v.kind) && num3(v.amount, 1) && typeof v.repeat === "boolean";
  if (v.type === "deliverStock") return keys(v, ["type", "id", "source", "target", "stock"]) && id(v.id) && id(v.source) && id(v.target) && cost2(v.stock);
  if (v.type === "marketTrade") return keys(v, ["type", "market", "kind", "amount", "direction"]) && id(v.market) && kinds.includes(v.kind) && num3(v.amount, 1) && ["buy", "sell"].includes(v.direction);
  if (v.type === "raidSupply" || v.type === "collectSalvage") return keys(v, ["type", "ids", "target"]) && ids() && id(v.target);
  if (v.type === "setWarehouse") return keys(v, ["type", "ids", "target"]) && ids() && (v.target === null || id(v.target));
  if (v.type === "specializeSettlement") return keys(v, ["type", "id", "kind"]) && id(v.id) && ["mining", "military", "research"].includes(v.kind);
  return keys(v, ["type", "id", "contract", "source"]) && id(v.id) && id(v.contract) && id(v.source);
}
function isEconomyCommand(c) {
  return ECONOMY_COMMAND_TYPES.includes(c.type);
}
function validateEconomyState(value, c) {
  const fail2 = (path3) => {
    throw new Error(`Invalid economy state at ${path3}.`);
  };
  const obj2 = (v, p, required, optional = []) => {
    if (!record(v) || required.some((key) => !Object.hasOwn(v, key)) || Object.keys(v).some((key) => ![...required, ...optional].includes(key))) fail2(p);
    return v;
  };
  const n = (v, p, min = 0, max = 1e9, integer5 = false) => {
    if (!num3(v, min, max) || integer5 && !Number.isSafeInteger(v)) fail2(p);
    return v;
  };
  const array4 = (v, p, max = 8192) => {
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
  const s = obj2(value, "economy", ["version", "groves", "structures", "caravans", "cargo", "tasks", "salvage", "markets", "villages", "contracts", "specializations", "workerWarehouses", "deepSites", "deathClaims", "paidCosts", "recruits", "ledgers"]);
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
  array4(s.groves, "groves", 1600).forEach((v, i) => {
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
      if (!c.resources.some((r) => r.id === rid && r.kind === "wood" && levelOf2(r) === (o.level ?? 0) && r.x === o.x && r.y === o.y)) fail2(`${p}.resourceId`);
    }
  });
  const structureIds = [];
  array4(s.structures, "structures", 1024).forEach((v, i) => {
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
      if (!c.resources.some((r) => r.id === rid && r.kind === (o.kind === "extractor" ? "crystal" : "ore") && sameLevel2(e, r))) fail2(`${p}.resourceId`);
    }
  });
  unique2(structureIds, "structures");
  const caravans = array4(s.caravans, "caravans", 1024).map((v, i) => entity(v, `caravans[${i}]`, "unit").id);
  unique2(caravans, "caravans");
  const cargoIds = [];
  array4(s.cargo, "cargo", 4096).forEach((v, i) => {
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
  array4(s.salvage, "salvage", 4096).forEach((v, i) => {
    const p = `salvage[${i}]`, o = obj2(v, p, ["id", "x", "y", "stock", "expiresAt", "owner", "kind"], ["level"]);
    salvageIds.push(uniqueObjectId(o.id, `${p}.id`));
    vector(o, p);
    stock(o.stock, `${p}.stock`);
    n(o.expiresAt, `${p}.expiresAt`, 0, c.time + 120.1);
    if (o.owner !== null) side2(o.owner, `${p}.owner`);
    choice6(o.kind, `${p}.kind`, ["salvage", "cargo"]);
  });
  const marketIds = [];
  array4(s.markets, "markets", 32).forEach((v, i) => {
    const p = `markets[${i}]`, o = obj2(v, p, ["id", "x", "y", "stock", "demand", "recoverAt"], ["level"]);
    marketIds.push(uniqueObjectId(o.id, `${p}.id`));
    vector(o, p);
    stock(o.stock, `${p}.stock`);
    const demand = obj2(o.demand, `${p}.demand`, kinds);
    for (const kind of kinds) n(demand[kind], `${p}.demand.${kind}`, 0, 1e9);
    n(o.recoverAt, `${p}.recoverAt`, 0, c.time);
  });
  const villages = [];
  array4(s.villages, "villages", 32).forEach((v, i) => {
    const p = `villages[${i}]`, o = obj2(v, p, ["id", "x", "y", "rewardPool"], ["level"]);
    const linked = c.world?.sites.some((site) => site.id === o.id && site.kind === "village" && site.level === (o.level ?? 0)) === true;
    villages.push(uniqueObjectId(o.id, `${p}.id`, linked));
    vector(o, p);
    stock(o.rewardPool, `${p}.rewardPool`);
  });
  const contracts = [];
  array4(s.contracts, "contracts", 96).forEach((v, i) => {
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
  array4(s.tasks, "tasks", 4096).forEach((v, i) => {
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
  array4(s.specializations, "specializations", 1024).forEach((v, i) => {
    const p = `specializations[${i}]`, o = obj2(v, p, ["entityId", "kind"]);
    const e = entity(o.entityId, `${p}.entityId`, "building");
    if (e.role !== "hq") fail2(p);
    specializationIds.push(e.id);
    choice6(o.kind, `${p}.kind`, ["mining", "military", "research"]);
  });
  unique2(specializationIds, "specializations");
  const workerIds = [];
  array4(s.workerWarehouses, "workerWarehouses", 4096).forEach((v, i) => {
    const p = `workerWarehouses[${i}]`, o = obj2(v, p, ["entityId", "warehouseId"]), e = entity(o.entityId, `${p}.entityId`, "unit"), w = entity(o.warehouseId, `${p}.warehouseId`, "building");
    if (e.role !== "worker" || caravans.includes(e.id) || e.side !== w.side || !sameLevel2(e, w) || !array4(s.structures, "structures").some((item) => record(item) && item.entityId === w.id && item.kind === "warehouse")) fail2(p);
    workerIds.push(e.id);
  });
  unique2(workerIds, "workerWarehouses");
  const deep = array4(s.deepSites, "deepSites", 8192).map((v, i) => {
    const rid = identifier2(v, `deepSites[${i}]`);
    if (!c.resources.some((r) => r.id === rid && r.kind === "ore")) fail2("deepSites");
    return rid;
  });
  unique2(deep, "deepSites");
  const deaths = array4(s.deathClaims, "deathClaims", 16384).map((v, i) => identifier2(v, `deathClaims[${i}]`));
  unique2(deaths, "deathClaims");
  const paidIds = [];
  array4(s.paidCosts, "paidCosts", 16384).forEach((v, i) => {
    const p = `paidCosts[${i}]`, o = obj2(v, p, ["entityId", "stock"]);
    paidIds.push(identifier2(o.entityId, `${p}.entityId`));
    stock(o.stock, `${p}.stock`);
  });
  unique2(paidIds, "paidCosts");
  const producerQueues = /* @__PURE__ */ new Map();
  array4(s.recruits, "recruits", 3 * c.entities.filter((e) => e.kind === "building" && e.role === "hq").length).forEach((v, i) => {
    const p = `recruits[${i}]`, o = obj2(v, p, ["producerId", "side", "readyAt"]);
    const producer = entity(o.producerId, `${p}.producerId`, "building");
    if (producer.role !== "hq" || producer.side !== side2(o.side, `${p}.side`)) fail2(p);
    const count = (producerQueues.get(producer.id) ?? 0) + 1;
    if (count > 3) fail2(p);
    producerQueues.set(producer.id, count);
    n(o.readyAt, `${p}.readyAt`, 0, c.time + 54.1);
  });
  const ledgers = array4(s.ledgers, "ledgers", 8);
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

// src/core/navigation.ts
var distance2 = (a, b) => length2D(a.x - b.x, a.y - b.y);
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var buildingRadius = (s, e) => buildingFor(s, e).size / 2 + 0.27;
function walkable(s, x, y, level2 = 0) {
  if (x < 0.35 || y < 0.35 || x > s.width - 0.35 || y > s.height - 0.35) return false;
  for (let ty = Math.floor(y - 0.27); ty <= Math.floor(y + 0.27); ty++) for (let tx = Math.floor(x - 0.27); tx <= Math.floor(x + 0.27); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5, level2)].walkable) return false;
  for (const b of s.entities) if (b.hp > 0 && b.kind === "building" && !b.gateOpen && levelOf(b) === level2) {
    const r = buildingRadius(s, b);
    if (Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) return false;
  }
  for (const r of s.resources) if (r.amount > 0 && levelOf(r) === level2 && length2D(r.x - x, r.y - y) < 0.7) return false;
  return true;
}
function segmentWalkable(s, a, b) {
  const level2 = levelOf(a);
  if (!sameLevel(a, b) || !walkable(s, a.x, a.y, level2) || !walkable(s, b.x, b.y, level2)) return false;
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
    if (r.amount <= 0 || levelOf(r) !== level2) continue;
    const t = lengthSquared ? clamp(((r.x - a.x) * dx + (r.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
    if (length2D(a.x + t * dx - r.x, a.y + t * dy - r.y) < 0.7) return false;
  }
  for (const obstacle of s.entities) {
    if (obstacle.hp <= 0 || obstacle.kind !== "building" || obstacle.gateOpen || levelOf(obstacle) !== level2) continue;
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
  const level2 = to.level ?? levelOf(from);
  to = { ...to, ...level2 ? { level: level2 } : {} };
  if (level2 !== levelOf(from)) return void 0;
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
  const buildings2 = s.entities.filter((e) => e.hp > 0 && e.kind === "building" && !e.gateOpen && levelOf(e) === level2);
  const resources2 = s.resources.filter((r) => r.amount > 0 && levelOf(r) === level2);
  const signature = `${s.width},${s.height};${buildings2.map((b) => `${b.id},${b.x},${b.y},${buildingRadius(s, b)}`).join(";")}|${resources2.map((r) => `${r.id},${r.x},${r.y}`).join(";")}`;
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
  for (const b of [...buildings2, ...resources2]) {
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
  if (!sameLevel(from, to)) return [];
  const coarse = routeOnGrid(s, from, to, reach, 0.5, side2);
  return coarse.length ? coarse : routeOnGrid(s, from, to, reach, 0.25, side2);
}
function routeOnGrid(s, from, to, reach, CELL, side2) {
  const level2 = levelOf(from), grid = gridFor(s, CELL, level2), { width, height, blocked } = grid;
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
  const score = new Float64Array(width * height).fill(Infinity), parent = new Int32Array(width * height).fill(-1), closed = new Uint8Array(width * height), open2 = [];
  const push = (key, value) => {
    let i = open2.length;
    open2.push({ key, score: value });
    while (i > 0) {
      const p = i - 1 >> 1;
      if (open2[p].score <= value) break;
      open2[i] = open2[p];
      i = p;
    }
    open2[i] = { key, score: value };
  };
  const pop = () => {
    const top = open2[0].key, last = open2.pop();
    if (open2.length) {
      let i = 0;
      while (i * 2 + 1 < open2.length) {
        let child = i * 2 + 1;
        if (child + 1 < open2.length && open2[child + 1].score < open2[child].score) child++;
        if (open2[child].score >= last.score) break;
        open2[i] = open2[child];
        i = child;
      }
      open2[i] = last;
    }
    return top;
  };
  const heuristic = (k) => Math.max(0, distance2(point5(k), to) - rr) / 1.15;
  for (const k of starts) {
    score[k] = distance2(from, point5(k));
    push(k, score[k] + heuristic(k));
  }
  let end = -1;
  while (open2.length) {
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
  for (let k = end; k !== -1; k = parent[k]) if (parent[k] !== -1 || distance2(from, point5(k)) > 0.08) result.push(point5(k));
  return result.reverse();
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
function requirement(s, side2, id6, excludeEntity) {
  const player = s.players[side2], def = upgradeFor(s, side2, id6);
  if (player.upgrades.includes(id6)) return "Already researched";
  const pending = s.entities.filter((e) => e.id !== excludeEntity && e.side === side2 && e.hp > 0 && e.research);
  if (pending.some((e) => e.research === id6)) return "Already researching";
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
function researchRequirement(s, side2, id6) {
  return requirement(s, side2, id6);
}
function canCompleteResearch(s, side2, id6, entityId) {
  return requirement(s, side2, id6, entityId) === void 0;
}
function upgradeAppliesTo(upgrade, unit4) {
  return upgrade.appliesTo === unit4.role && (!upgrade.appliesToDefinitions || upgrade.appliesToDefinitions.includes(unit4.id));
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
function note(s, e, text5, target) {
  s.events.push({ type: "message", x: e.x, y: e.y, side: e.side, source: e.id, text: text5, target });
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
    const corpse = s.corpses.find((body2) => body2.id === c.target && body2.expires > s.time && observed(s, side2, body2));
    if (!corpse) return "Choose a visible unclaimed body.";
    return units.some((e) => isCorpseWagon(e) && sameLevel3(e, corpse) && (e.factionState?.corpseCargo?.length ?? 0) < 6) ? null : "The wagon is full or on another level.";
  }
  if (c.type === "deliverCorpses") {
    if (faction !== "undead" || !units.some((e) => isCorpseWagon(e) && e.factionState?.corpseCargo?.some((body2) => body2.expires > s.time))) return "Select a corpse wagon carrying a fresh body.";
    const target = s.entities.find((e) => e.id === c.target && e.side === side2 && isFactionCaster(s, e, "raise"));
    return target && units.some((e) => isCorpseWagon(e) && sameLevel3(e, target) && e.factionState?.corpseCargo?.some((body2) => body2.expires > s.time)) ? null : "Choose an owned Gravecaller on the wagon level.";
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
    const building4 = h.spawnDefinition(side2, info.definition.id, c, 0);
    h.recordPaid(building4, info.definition.cost);
    for (const e of units.filter((e2) => e2.role === "worker" && sameLevel3(e2, c))) {
      h.assignOrder(e, { type: "build", target: building4.id });
      delete e.tactics?.formation;
    }
    note(s, units[0], `${info.definition.name} construction ordered`, building4.id);
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
    const target = c.type === "collectCorpses" ? s.corpses.find((body2) => body2.id === c.target) : s.entities.find((e) => e.id === c.target), eligible3 = units.filter((e) => isCorpseWagon(e) && sameLevel3(e, target) && (c.type === "collectCorpses" ? (e.factionState?.corpseCargo?.length ?? 0) < 6 : !!e.factionState?.corpseCargo?.some((body2) => body2.expires > s.time)));
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
  if (f.corpseCargo) f.corpseCargo = f.corpseCargo.filter((body2) => body2.expires > s.time);
  if (f.deliveredCorpses) f.deliveredCorpses = f.deliveredCorpses.filter((body2) => body2.expires > s.time);
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
    const order3 = f.corpseOrder, target = order3.type === "collect" ? s.corpses.find((body2) => body2.id === order3.target && body2.expires > s.time && observed(s, e.side, body2)) : s.entities.find((t) => t.id === order3.target && t.side === e.side && isFactionCaster(s, t, "raise"));
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
        const index2 = s.corpses.findIndex((body2) => body2.id === target.id);
        if (index2 >= 0) (f.corpseCargo ??= []).push(s.corpses.splice(index2, 1)[0]);
        note(s, e, "Body loaded without extending its decay deadline", target.id);
      }
    } else {
      const recipient = target, cargo = f.corpseCargo ??= [];
      recipient.factionState ??= {};
      const cache = recipient.factionState.deliveredCorpses ??= [];
      const delivered = cargo.splice(0, Math.max(0, 12 - cache.length));
      cache.push(...delivered.map((body2) => ({ ...body2, x: recipient.x, y: recipient.y, level: recipient.level })));
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
var alive = (e) => e.hp > 0 && !e.illusion;
function freePoint(s, point5, offset = 0) {
  const level2 = levelOf(point5);
  for (let radius2 = 0; radius2 <= Math.max(s.width, s.height); radius2++) for (let i = 0; i < (radius2 ? 32 : 1); i++) {
    const [dx, dy] = DIRECTIONS_32[(i + offset) % 32], x = Math.floor(point5.x + dx * radius2) + 0.5, y = Math.floor(point5.y + dy * radius2) + 0.5;
    if (x < 0.5 || y < 0.5 || x > s.width - 0.5 || y > s.height - 0.5) continue;
    if (walkable(s, x, y, level2)) return { x, y, ...s.world || level2 ? { level: level2 } : {} };
  }
  throw new Error("No walkable objective position.");
}
var distance5 = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
function objectiveOrder(s, unit4, target, command, attack = true) {
  if (sameLevel(unit4, target)) return command(s, unit4.side, { type: attack ? "attackMove" : "move", ids: [unit4.id], x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level } });
  const passage = s.world?.transitions.map((transition) => {
    const entry = [transition.from, transition.to].find((point5) => sameLevel(point5, unit4)), exit = entry === transition.from ? transition.to : transition.from;
    return { transition, entry, exit };
  }).filter((value) => value.entry && sameLevel(value.exit, target)).sort((a, b) => distance5(unit4, a.entry) + distance5(a.exit, target) - distance5(unit4, b.entry) - distance5(b.exit, target) || a.transition.id - b.transition.id)[0];
  if (!passage?.entry) return false;
  if (unit4.order.type === "traverse" && unit4.order.transition === passage.transition.id) return true;
  if (s.visible[unit4.side].has(fogKey(s, passage.entry))) return command(s, unit4.side, { type: "traverse", ids: [unit4.id], transition: passage.transition.id });
  return command(s, unit4.side, { type: attack ? "attackMove" : "move", ids: [unit4.id], ...passage.entry });
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
function finish(s, team, text5) {
  if (s.winner !== null || s.draw) return;
  s.winningTeam = team;
  s.winner = s.teams.findIndex((t) => t === team);
  const point5 = s.starts[s.winner];
  s.events.push({ type: "message", side: s.winner, ...point5, text: text5 });
}
function collectRelic(s, side2, id6, relicId) {
  if (s.rules.mode !== "relic" || s.draft.status !== "complete") return false;
  const unit4 = s.entities.find((e) => e.id === id6 && e.side === side2 && e.kind === "unit" && alive(e)), relic = s.objectives.relics.find((r) => r.id === relicId);
  if (!unit4 || !relic || relic.carrierId !== null || s.objectives.relics.some((r) => r.carrierId === id6) || distance5(unit4, relic) > s.rules.relic.pickupRadius) return false;
  relic.carrierId = id6;
  relic.heldTeam = null;
  placeRelic(relic, unit4);
  s.events.push({ type: "message", side: side2, x: unit4.x, y: unit4.y, ...unit4.level === void 0 ? {} : { level: unit4.level }, text: `Relic ${relicId} collected`, source: id6 });
  return true;
}
function dropRelic(s, side2, id6) {
  const unit4 = s.entities.find((e) => e.id === id6 && e.side === side2 && e.kind === "unit" && alive(e)), relic = s.objectives.relics.find((r) => r.carrierId === id6);
  if (!unit4 || !relic) return false;
  relic.carrierId = null;
  relic.heldTeam = null;
  placeRelic(relic, unit4);
  return true;
}
function evaluateObjectives(s, actions) {
  if (s.winner !== null || s.draw) return;
  if (s.rules.mode === "hill") {
    const h = s.objectives.hill, present = [...new Set(s.entities.filter((e) => alive(e) && e.kind === "unit" && !s.eliminated[e.side] && distance5(e, h) <= s.rules.hill.radius).map((e) => s.teams[e.side]))];
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
        const carrier = s.entities.find((e) => e.id === relic.carrierId && alive(e));
        if (!carrier) {
          const fallen = s.entities.find((e) => e.id === relic.carrierId) || s.corpses.find((e) => e.id === relic.carrierId);
          if (fallen) placeRelic(relic, fallen);
          relic.carrierId = null;
          relic.heldTeam = null;
          continue;
        }
        placeRelic(relic, carrier);
        const shrine = s.entities.find((e) => alive(e) && e.kind === "building" && e.role === "hq" && e.progress === 1 && s.teams[e.side] === s.teams[carrier.side] && distance5(e, carrier) <= buildingFor(s, e).size / 2 + 2.5);
        if (shrine) {
          relic.carrierId = null;
          relic.heldTeam = s.teams[carrier.side];
          placeRelic(relic, carrier);
        }
      }
      if (relic.heldTeam !== null && !s.entities.some((e) => alive(e) && e.kind === "building" && e.role === "hq" && e.progress === 1 && s.teams[e.side] === relic.heldTeam && distance5(e, relic) <= buildingFor(s, e).size / 2 + 2.5)) relic.heldTeam = null;
    }
    for (const team of [...new Set(s.teams)]) {
      const held = s.objectives.relics.filter((r) => r.heldTeam === team).length;
      if (held >= s.rules.relic.required) s.objectives.relicHoldTicks[team]++;
      else s.objectives.relicHoldTicks[team] = 0;
      if (s.objectives.relicHoldTicks[team] >= s.rules.relic.holdTicks) finish(s, team, "The required relics have been defended.");
    }
  }
  if (s.rules.mode === "survival") {
    const rules = s.rules.survival, wave = s.objectives.survival, defenders = s.entities.filter((e) => alive(e) && e.role === "hq" && e.progress === 1 && s.teams[e.side] === rules.defenderTeam), opponents = s.players.map((_, id6) => id6).filter((side2) => s.teams[side2] !== rules.defenderTeam);
    if (!defenders.length) {
      wave.phase = "complete";
      finish(s, s.teams[opponents[0]], "The defenders lost their last stronghold.");
      return;
    }
    const attackers = s.entities.filter((e) => wave.spawnedIds.includes(e.id) && alive(e) && s.teams[e.side] !== rules.defenderTeam && !isCrewless(e));
    if (wave.phase === "fighting") for (const unit4 of attackers.filter((e) => e.order.type === "idle")) {
      const target = [...defenders].sort((a, b) => distance5(a, unit4) - distance5(b, unit4) || a.id - b.id)[0];
      if (target) objectiveOrder(s, unit4, target, actions.command);
    }
    if (wave.phase === "fighting" && !attackers.length) {
      const survivors = s.players.map((_, id6) => id6).filter((side2) => s.teams[side2] === rules.defenderTeam);
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
      const roles2 = wave.wave === 1 ? ["melee", "ranged"] : wave.wave === 2 ? ["spear", "ranged", "cavalry"] : ["melee", "special", "siege", "cavalry"];
      for (let i = 0; i < rules.unitsPerWave * wave.wave; i++) {
        const side2 = opponents[i % opponents.length], point5 = freePoint(s, { x: Math.max(0.5, Math.min(s.width - 0.5, s.starts[side2].x + i % 5 - 2)), y: Math.max(0.5, Math.min(s.height - 0.5, s.starts[side2].y + Math.floor(i / 5) % 5 * 0.8)), ...s.starts[side2].level === void 0 ? {} : { level: s.starts[side2].level } }, i), allowed = availableUnits(s, side2).filter((unit5) => unit5.role !== "worker" && definitionAllowed(s, side2, unit5.id)), preferred = roles2[i % roles2.length], chosen = allowed.find((unit5) => unit5.role === preferred) ?? allowed[i % allowed.length], unit4 = actions.spawn(s, side2, "unit", chosen.role, point5.x, point5.y, 1, chosen.id, levelOf(point5));
        wave.spawnedIds.push(unit4.id);
        const target = defenders[i % defenders.length];
        objectiveOrder(s, unit4, target, actions.command);
      }
      s.events.push({ type: "message", side: defenders[0].side, ...s.starts[defenders[0].side], text: `Survival wave ${wave.wave}: ${wave.spawnedIds.length} attackers` });
    }
  }
}
function objectiveAi(s, side2, command, reservedIds) {
  if (s.rules.mode === "annihilation" || s.rules.mode === "scenario" || s.rules.mode === "survival") return;
  const units = s.entities.filter((e) => e.side === side2 && e.kind === "unit" && e.role !== "worker" && alive(e) && !reservedIds?.has(e.id));
  if (!units.length) return;
  if (s.rules.mode === "hill") for (const unit4 of units) objectiveOrder(s, unit4, s.objectives.hill, command);
  if (s.rules.mode === "relic") for (const unit4 of units) {
    const carried = s.objectives.relics.find((r) => r.carrierId === unit4.id), hq = s.entities.find((e) => e.side === side2 && e.role === "hq" && alive(e));
    if (carried && hq) {
      objectiveOrder(s, unit4, hq, command, false);
      continue;
    }
    const target = s.objectives.relics.filter((r) => r.carrierId === null && r.heldTeam !== s.teams[side2]).sort((a, b) => distance5(a, unit4) - distance5(b, unit4) || a.id - b.id)[0];
    if (!target) continue;
    if (!collectRelic(s, side2, unit4.id, target.id)) objectiveOrder(s, unit4, target, command);
  }
}
function publicObjectives(s, side2) {
  return { ...structuredClone(s.objectives), relics: s.objectives.relics.map((r) => {
    const carrier = r.carrierId === null ? null : s.entities.find((e) => e.id === r.carrierId), seen = !carrier || carrier.side === side2 || s.visible[side2].has(fogKey(s, carrier));
    if (seen) return { ...r };
    const { level: _level, ...publicRelic } = r;
    return { ...publicRelic, x: null, y: null, carrierId: null, hidden: true };
  }) };
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
function openingBuilding(config, roles2) {
  const first = config.opening === "tower-defense" ? "tower" : config.opening === "fast-expansion" ? "depot" : "barracks";
  if (!roles2.includes(first)) return first;
  if (!roles2.includes("barracks")) return "barracks";
}
function rememberObservedUnits(memory, visible5, time) {
  for (const [id6, observation] of memory) if (time - observation.seenAt > 90) memory.delete(id6);
  for (const enemy2 of visible5) if (enemy2.kind === "unit" && enemy2.role !== "worker" && !enemy2.illusion && enemy2.hp > 0) memory.set(enemy2.id, { role: enemy2.role, x: enemy2.x, y: enemy2.y, ...enemy2.level === void 0 ? {} : { level: enemy2.level }, seenAt: time, hpFraction: enemy2.hp / enemy2.maxHp });
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
  let total = 0;
  for (const unit4 of observed2) {
    composition[unit4.role] = (composition[unit4.role] ?? 0) + 1;
    total++;
  }
  if (total) {
    const strength = aiProfile(config).counterStrength;
    weights.spear = (weights.spear ?? 0) + strength * (composition.cavalry ?? 0) / total;
    weights.cavalry = (weights.cavalry ?? 0) + strength * ((composition.ranged ?? 0) + (composition.siege ?? 0)) / total;
    weights.ranged = (weights.ranged ?? 0) + strength * ((composition.melee ?? 0) + (composition.spear ?? 0)) / total;
  }
  return weights;
}
function chooseAiRecruit(roles2, planned, weights) {
  const total = roles2.reduce((sum, role) => sum + (weights[role] ?? 0.1), 0);
  return [...roles2].sort((a, b) => (planned.length + 1) * (weights[b] ?? 0.1) / total - planned.filter((role) => role === b).length - ((planned.length + 1) * (weights[a] ?? 0.1) / total - planned.filter((role) => role === a).length))[0];
}
function shouldRetreat(config, unit4, nearbyAllies, visibleEnemies) {
  if (!visibleEnemies.length) return false;
  const profile = aiProfile(config);
  if (unit4.hp / unit4.maxHp < profile.retreatHealth) return true;
  const ownStrength = nearbyAllies.reduce((sum, e) => sum + e.hp / e.maxHp, 0), enemyStrength = visibleEnemies.reduce((sum, e) => sum + e.hp / e.maxHp, 0);
  return enemyStrength > Math.max(1, ownStrength) * profile.retreatRatio;
}

// src/core/specialist-validation.ts
var MAX_ID = 2147483647;
var MAX_RECORDS = 8192;
var SLOTS = ["weapon", "armor", "trinket"];
var PREPARED = { "incendiary-shell": "incendiary", "rooting-shell": "rooting", "corpse-shell": "corpse", "flood-shell": "flood" };
function bad(path3, detail) {
  throw new Error(`Invalid save at ${path3}: ${detail}.`);
}
function object(value, path3, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad(path3, "expected an object");
  const record7 = value;
  for (const key of required) if (!Object.hasOwn(record7, key)) bad(`${path3}.${key}`, "missing field");
  for (const key of Object.keys(record7)) if (!required.includes(key) && !optional.includes(key)) bad(`${path3}.${key}`, "unknown field");
  return record7;
}
function number(value, path3, min = 0, max = MAX_ID, integer5 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer5 && !Number.isSafeInteger(value)) bad(path3, `expected ${integer5 ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function flag(value, path3) {
  if (typeof value !== "boolean") bad(path3, "expected a boolean");
  return value;
}
function choice(value, path3, values) {
  if (typeof value !== "string" || !values.includes(value)) bad(path3, "unknown value");
  return value;
}
function list(value, path3, max) {
  if (!Array.isArray(value) || value.length > max) bad(path3, "invalid array length");
  return value;
}
function position(value, path3, s, extraRequired = [], extraOptional = []) {
  const p = object(value, path3, ["x", "y", ...extraRequired], ["level", ...extraOptional]);
  number(p.x, `${path3}.x`, 0, s.width);
  number(p.y, `${path3}.y`, 0, s.height);
  if (p.level !== void 0) {
    const level2 = number(p.level, `${path3}.level`, 0, 1, true);
    if (level2 !== 0 && !s.world?.levels[level2]) bad(`${path3}.level`, "world level is absent");
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
function validateVeteran(s, e, path3) {
  if (e.veteran === void 0) return;
  const p = `${path3}.veteran`, v = object(e.veteran, p, ["experience", "rank", "nextSurvivalAt", "lastCombatAt", "promotions"], ["pendingPromotion"]);
  if (!realUnit(e)) bad(p, "only real units can earn experience");
  const xp = number(v.experience, `${p}.experience`, 0, 300), rank = number(v.rank, `${p}.rank`, 0, 3, true);
  if (rank !== veteranRank(xp)) bad(`${p}.rank`, "rank differs from earned experience");
  number(v.nextSurvivalAt, `${p}.nextSurvivalAt`, 0, s.time + 60);
  number(v.lastCombatAt, `${p}.lastCombatAt`, 0, s.time);
  const promotions = list(v.promotions, `${p}.promotions`, 3);
  promotions.forEach((value, i) => {
    const q = `${p}.promotions[${i}]`, promotion = object(value, q, ["rank", "id"]);
    if (number(promotion.rank, `${q}.rank`, 1, 3, true) !== i + 1 || i + 1 > rank) bad(`${q}.rank`, "promotions must follow earned ranks in order");
    const id6 = choice(promotion.id, `${q}.id`, Object.keys(PROMOTIONS));
    if (!PROMOTIONS[id6].roles.includes(unitRole(s, e))) bad(`${q}.id`, "promotion does not apply to this unit role");
  });
  const pending = promotions.length < rank ? promotions.length + 1 : void 0;
  if (v.pendingPromotion !== pending) bad(`${p}.pendingPromotion`, "expected the first unchosen earned rank");
}
function validateBuffs(s, e, path3) {
  if (e.specialistBuffs === void 0) return;
  if (!realUnit(e)) bad(`${path3}.specialistBuffs`, "only real units can receive specialist buffs");
  list(e.specialistBuffs, `${path3}.specialistBuffs`, 64).forEach((value, i) => {
    const p = `${path3}.specialistBuffs[${i}]`, buff2 = object(value, p, ["until"], ["damageFactor", "speedFactor", "armor", "rooted", "fearedFrom"]);
    number(buff2.until, `${p}.until`, 0, s.time + 30);
    if (Object.keys(buff2).length === 1) bad(p, "a buff requires an effect");
    for (const key of ["damageFactor", "speedFactor"]) if (buff2[key] !== void 0) number(buff2[key], `${p}.${key}`, 0, 4);
    if (buff2.armor !== void 0) number(buff2.armor, `${p}.armor`, 0, 100);
    if (buff2.rooted !== void 0) flag(buff2.rooted, `${p}.rooted`);
    if (buff2.fearedFrom !== void 0) position(buff2.fearedFrom, `${p}.fearedFrom`, s);
  });
}
function validateSiege(s, e, path3) {
  if (e.siegeMode === void 0) return;
  const p = `${path3}.siegeMode`, mode = object(e.siegeMode, p, ["ammo", "deployed"], ["prepared"]);
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
function validateBurning(s, e, path3, entities) {
  if (e.burning === void 0) return;
  list(e.burning, `${path3}.burning`, 64).forEach((value, i) => {
    const p = `${path3}.burning[${i}]`, fire = object(value, p, ["source", "side", "until", "nextAt", "damage"], ["origin"]);
    const source2 = number(fire.source, `${p}.source`, 1, s.nextId - 1, true), side2 = number(fire.side, `${p}.side`, 0, s.players.length - 1, true);
    const actor3 = entities.get(source2);
    if (actor3 && actor3.side !== side2 && !(actor3.kind === "unit" && actor3.role === "siege" && actor3.definitionFaction !== void 0)) bad(`${p}.side`, "fire side differs from the source entity");
    number(fire.until, `${p}.until`, 0, s.time + 6);
    number(fire.nextAt, `${p}.nextAt`, 0, s.time + 1);
    number(fire.damage, `${p}.damage`, Number.MIN_VALUE, 100);
    if (fire.origin !== void 0) position(fire.origin, `${p}.origin`, s);
  });
}
function validateBeacon(s, e, path3) {
  if (e.beacon === void 0) return;
  const p = `${path3}.beacon`, beacon2 = object(e.beacon, p, ["connected", "nextAlertAt"]);
  if (e.kind !== "building" || !buildingFor(s, e).tags?.includes("beacon")) bad(p, "beacon state requires a signal beacon");
  flag(beacon2.connected, `${p}.connected`);
  number(beacon2.nextAlertAt, `${p}.nextAlertAt`, 0, s.time + 8);
}
function validateArtifacts(s, state, entities) {
  const records = /* @__PURE__ */ new Map(), held = /* @__PURE__ */ new Map(), counter = number(state.nextArtifactId, "state.specialists.nextArtifactId", 1, MAX_ID, true);
  list(state.artifacts, "state.specialists.artifacts", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.artifacts[${i}]`, item = object(value, p, ["id", "definitionId"], ["owner", "holder", "position"]), id6 = number(item.id, `${p}.id`, 1, counter - 1, true);
    if (records.has(id6)) bad(`${p}.id`, "duplicate artifact id");
    records.set(id6, item);
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
function validateEquipment(s, e, path3, artifacts, equipped) {
  if (e.equipment === void 0) return;
  const p = `${path3}.equipment`, equipment = object(e.equipment, p, [], SLOTS);
  if (e.hp <= 0 || !equipmentEligible2(s, e)) bad(p, "equipment requires a living hero or specialist");
  for (const slot of SLOTS) if (equipment[slot] !== void 0) {
    const id6 = number(equipment[slot], `${p}.${slot}`, 1, MAX_ID, true), item = artifacts.get(id6);
    if (!item || item.holder !== e.id || item.owner !== e.side) bad(`${p}.${slot}`, "equipped artifact must belong to this holder");
    const def = ARTIFACTS[item.definitionId];
    if (def.slot !== slot || !def.roles.includes(unitRole(s, e))) bad(`${p}.${slot}`, "artifact does not match this slot or unit role");
    if (equipped.has(id6)) bad(`${p}.${slot}`, "artifact is equipped more than once");
    equipped.add(id6);
  }
}
function validateStructures(s, state, entities) {
  const counter = number(state.nextStructureId, "state.specialists.nextStructureId", 1, MAX_ID, true), ids = /* @__PURE__ */ new Set(), tiles = /* @__PURE__ */ new Set(), barricades = /* @__PURE__ */ new Set();
  list(state.structures, "state.specialists.structures", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.structures[${i}]`, record7 = object(value, p, ["id", "kind", "owner", "expires"], ["entityId", "tiles"]), id6 = number(record7.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id6)) bad(`${p}.id`, "duplicate temporary structure id");
    ids.add(id6);
    const kind = choice(record7.kind, `${p}.kind`, ["bridge", "barricade"]), owner = number(record7.owner, `${p}.owner`, 0, s.players.length - 1, true);
    number(record7.expires, `${p}.expires`, 0, s.time + 60);
    if (kind === "barricade") {
      if (record7.tiles !== void 0) bad(`${p}.tiles`, "barricades reference an entity rather than terrain tiles");
      const entityId = number(record7.entityId, `${p}.entityId`, 1, s.nextId - 1, true), entity = entities.get(entityId);
      if (!entity || entity.kind !== "building" || entity.side !== owner || !buildingFor(s, entity).tags?.includes("barricade")) bad(`${p}.entityId`, "temporary barricade must reference its owned barricade entity");
      if (barricades.has(entityId)) bad(`${p}.entityId`, "barricade entity is referenced more than once");
      barricades.add(entityId);
    } else {
      if (record7.entityId !== void 0) bad(`${p}.entityId`, "bridges reference terrain tiles rather than an entity");
      const points = list(record7.tiles, `${p}.tiles`, 3);
      if (points.length !== 3) bad(`${p}.tiles`, "temporary bridge requires three tiles");
      let previous;
      points.forEach((value2, j) => {
        const q = `${p}.tiles[${j}]`, point5 = position(value2, q, s, ["previous", "placed"], ["stamp"]);
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
  list(state.shots, "state.specialists.shots", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.shots[${i}]`, shot = object(value, p, ["id", "source", "target", "impactAt", "rawDamage", "buildingMultiplier", "payload"], ["modification"]);
    const id6 = number(shot.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id6)) bad(`${p}.id`, "duplicate siege shot id");
    ids.add(id6);
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
    list(player.heroRecovery, p, heroes.length).forEach((value, i) => {
      const q = `${p}[${i}]`, recovery = object(value, q, ["definitionId", "availableAt"]), id6 = choice(recovery.definitionId, `${q}.definitionId`, [...heroIds]);
      if (seen.has(id6)) bad(`${q}.definitionId`, "duplicate commander recovery");
      seen.add(id6);
      const at = number(recovery.availableAt, `${q}.availableAt`, 0, s.time + 30);
      if (active4 && at > s.time) bad(`${q}.availableAt`, "a recovering commander cannot already be alive or queued");
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
  const fail2 = (path3) => {
    throw new Error(`Invalid save world at ${path3}.`);
  };
  const record7 = (v, path3, fields2, optional = []) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !fields2.includes(k) && !optional.includes(k)) || fields2.some((k) => !Object.hasOwn(v, k))) fail2(path3);
    return v;
  };
  const list4 = (v, path3, max) => {
    if (!Array.isArray(v) || v.length > max) fail2(path3);
    return v;
  };
  const number6 = (v, path3, min = 0, max = 1e12, int = false) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || int && !Number.isSafeInteger(v)) fail2(path3);
    return v;
  };
  const world = record7(input, "state", ["version", "biome", "levels", "transitions", "bridges", "fires", "sites", "creatures", "dayLength", "seasonLength", "weatherLength", "nextEnvironmentAt", "iceTiles", "thawWarned"], ["revision"]);
  if (world.revision !== void 0) number6(world.revision, "revision", 0, 1e12, true);
  if (world.version !== 1 || !BIOMES.includes(world.biome) || typeof world.thawWarned !== "boolean") fail2("version/biome/flags");
  const levels = list4(world.levels, "levels", 2);
  if (!levels.length) fail2("levels");
  const area = width * height;
  const coord = (v, path3) => {
    number6(v.x, `${path3}.x`, 0, width);
    number6(v.y, `${path3}.y`, 0, height);
    number6(v.level, `${path3}.level`, 0, levels.length - 1, true);
  };
  const side2 = (v, path3) => {
    if (v !== null) number6(v, path3, 0, players - 1, true);
  };
  const ids = /* @__PURE__ */ new Set(), id6 = (v, path3, allocate = true) => {
    const n = number6(v, path3, 1, nextId - 1, true);
    if (allocate) {
      if (ids.has(n)) fail2(`${path3}duplicate`);
      ids.add(n);
    }
    return n;
  };
  const cost5 = (v, path3) => {
    const c = record7(v, path3, ["wood", "ore", "crystal"]);
    for (const kind of ["wood", "ore", "crystal"]) number6(c[kind], `${path3}.${kind}`, 0, 1e9);
  };
  for (let i = 0; i < levels.length; i++) {
    const l = record7(levels[i], `levels${i}`, ["id", "title", "terrain", "elevation"]);
    if (l.id !== i || typeof l.title !== "string" || l.title.length > 80) fail2(`levels${i}.id/title`);
    const terrain2 = list4(l.terrain, `levels${i}.terrain`, area), elevation = list4(l.elevation, `levels${i}.elevation`, area);
    if (terrain2.length !== area || elevation.length !== area) fail2(`levels${i}.dimensions`);
    terrain2.forEach((t, j) => {
      if (typeof t !== "string" || !Object.hasOwn(TERRAIN, t)) fail2(`levels${i}.terrain${j}`);
    });
    elevation.forEach((e, j) => number6(e, `levels${i}.elevation${j}`, 0, 3, true));
  }
  const transitionIds = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world.transitions, "transitions", 64).entries()) {
    const t = record7(v, `transition${i}`, ["id", "from", "to"]), n = number6(t.id, `transition${i}.id`, 1, 2147483647, true);
    if (transitionIds.has(n)) fail2(`transition${i}.duplicate`);
    transitionIds.add(n);
    for (const field of ["from", "to"]) coord(record7(t[field], `transition${i}.${field}`, ["x", "y", "level"]), `transition${i}.${field}`);
    if (t.from.level === t.to.level) fail2(`transition${i}.levels`);
  }
  for (const [i, v] of list4(world.bridges, "bridges", 512).entries()) {
    const b = record7(v, `bridge${i}`, ["id", "x", "y", "level", "hp", "maxHp", "tiles", "rebuilding", "repairSide"]);
    id6(b.id, `bridge${i}.id`);
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
  for (const [i, v] of list4(world.fires, "fires", area * levels.length).entries()) {
    const f = record7(v, `fire${i}`, ["x", "y", "level", "heat", "expires", "nextSpread"]);
    coord(f, `fire${i}`);
    number6(f.heat, `fire${i}.heat`, 0, 1);
    number6(f.expires, `fire${i}.expires`);
    number6(f.nextSpread, `fire${i}.nextSpread`);
    const k = `${f.level},${Math.floor(f.x)},${Math.floor(f.y)}`;
    if (fireKeys.has(k)) fail2(`fire${i}.duplicate`);
    fireKeys.add(k);
  }
  const sites = list4(world.sites, "sites", 128), siteIds = /* @__PURE__ */ new Set(), creatureRefs = /* @__PURE__ */ new Set();
  for (const [i, v] of sites.entries()) {
    const site = record7(v, `site${i}`, ["id", "x", "y", "level", "kind", "owner", "loyalty", "progress", "capturing", "reward", "rewarded", "request", "supplied", "creatureIds", "respawnAt"]);
    siteIds.add(id6(site.id, `site${i}.id`));
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
      const target = id6(n, `site${i}.creatureId`, false);
      if (creatureRefs.has(target)) fail2(`site${i}.duplicateCreature`);
      creatureRefs.add(target);
    }
    number6(site.respawnAt, `site${i}.respawnAt`);
  }
  const creatures = list4(world.creatures, "creatures", 2048), creatureIds = /* @__PURE__ */ new Set();
  for (const [i, v] of creatures.entries()) {
    const creature = record7(v, `creature${i}`, ["id", "site", "x", "y", "level", "hp", "maxHp", "cooldown", "target", "path", "patrol", "respawnAt"]), n = id6(creature.id, `creature${i}.id`);
    creatureIds.add(n);
    coord(creature, `creature${i}`);
    if (!siteIds.has(number6(creature.site, `creature${i}.site`, 1, nextId - 1, true))) fail2(`creature${i}.site`);
    const max = number6(creature.maxHp, `creature${i}.maxHp`, 1, 1e9);
    number6(creature.hp, `creature${i}.hp`, 0, max);
    for (const field of ["cooldown", "patrol", "respawnAt"]) number6(creature[field], `creature${i}.${field}`);
    if (creature.target !== null) id6(creature.target, `creature${i}.target`, false);
    for (const [j, p] of list4(creature.path, `creature${i}.path`, area * 16).entries()) {
      if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).some((k) => !["x", "y", "level"].includes(k))) fail2(`creature${i}.path${j}`);
      const point5 = p;
      coord({ ...point5, level: point5.level ?? 0 }, `creature${i}.path${j}`);
    }
  }
  if (creatureRefs.size !== creatureIds.size || [...creatureRefs].some((n) => !creatureIds.has(n))) fail2("siteCreatureReferences");
  for (const site of sites) for (const n of site.creatureIds) if (creatures.find((c) => c.id === n)?.site !== site.id) fail2("creatureSiteReference");
  const iceKeys = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world.iceTiles, "iceTiles", area * levels.length).entries()) {
    const ice = record7(v, `ice${i}`, ["level", "tile"]);
    number6(ice.level, `ice${i}.level`, 0, levels.length - 1, true);
    number6(ice.tile, `ice${i}.tile`, 0, area - 1, true);
    const k = `${ice.level},${ice.tile}`;
    if (iceKeys.has(k)) fail2(`ice${i}.duplicate`);
    iceKeys.add(k);
  }
  for (const field of ["dayLength", "seasonLength", "weatherLength"]) number6(world[field], field, 0.05, 1e6);
  number6(world.nextEnvironmentAt, "nextEnvironmentAt");
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
var distance6 = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var targetRank = { hq: 0, building: 1, unit: 2, start: 3 };
var keyCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var pointKey = (v) => `${levelOf(v)}:${v.x},${v.y}`;
var copyReservation = (r) => ({ ...r, destination: point(r.destination), ids: [...r.ids].sort((a, b) => a - b) });
var copyWave = (w) => ({ ...w, target: { ...w.target }, participants: w.participants.map((p) => ({ side: p.side, ids: [...p.ids].sort((a, b) => a - b) })).sort((a, b) => a.side - b.side) });
function coordinateTeamAi(previous, reports, time) {
  if (!Number.isFinite(time) || time < 0) throw new Error("Invalid team AI planning time.");
  const sides = /* @__PURE__ */ new Set();
  for (const report of reports) {
    if (sides.has(report.side)) throw new Error("Duplicate team AI owner report.");
    sides.add(report.side);
  }
  const current = reports.filter((r) => r.time <= time && time - r.time <= TEAM_AI_REPORT_TTL).map((r) => ({ ...r, hq: point(r.hq), fighters: r.fighters.map((f) => ({ ...f })).sort((a, b) => a.id - b.id), threats: r.threats.map((t) => ({ ...t })), targets: r.targets.map((t) => ({ ...t })), expansion: r.expansion ? point(r.expansion) : void 0 })).sort((a, b) => a.side - b.side);
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
      const defenders = fighters.filter((f) => !occupied.has(f.id) && sameLevel(f, threat)).sort((a, b) => distance6(a, threat) - distance6(b, threat) || a.side - b.side || a.id - b.id).slice(0, 3);
      for (const member of members) {
        const ids = defenders.filter((f) => f.side === member.side).map((f) => f.id).sort((a, b) => a - b);
        if (!ids.length) continue;
        ids.forEach((id6) => occupied.add(id6));
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
        const available = new Set(report.fighters.filter((f) => sameLevel(f, wave.target)).map((f) => f.id));
        const ids = p.ids.filter((id6) => available.has(id6) && !occupied.has(id6));
        return ids.length ? [{ side: p.side, ids }] : [];
      });
      const total = wave.participants.reduce((sum, p) => sum + p.ids.length, 0);
      if (!wave.launched && wave.participants.length && time >= wave.launchAt && (wave.participants.length >= TEAM_ATTACK_MIN_PARTICIPANTS && total >= TEAM_ATTACK_MIN_FIGHTERS || time >= wave.expiresAt)) {
        for (const participant of wave.participants) for (let i = 0; i < participant.ids.length; i += TEAM_AI_COMMAND_IDS) launches.push({ side: participant.side, ids: participant.ids.slice(i, i + TEAM_AI_COMMAND_IDS), destination: point(wave.target), waveId: wave.id });
        wave.launched = true;
        launchedThisStep = true;
        for (const p of wave.participants) p.ids.forEach((id6) => occupied.add(id6));
      }
      if (!wave.participants.length || time >= wave.expiresAt) wave = void 0;
    }
    let reservations = previous.reservations.filter((r) => r.teamId === teamId && r.expiresAt > time).map(copyReservation).filter((r) => {
      const report = memberBySide.get(r.side);
      if (!report) return false;
      if (r.role === "expand") return !!report.expansion && pointKey(report.expansion) === pointKey(r.destination) && !threats.size;
      return report.scoutingNeeded && r.ids.length === 1 && report.fighters.some((f) => f.id === r.ids[0] && sameLevel(f, r.destination)) && !occupied.has(r.ids[0]);
    });
    if (wave) {
      for (const p of wave.participants) p.ids.forEach((id6) => occupied.add(id6));
      reservations = reservations.filter((r) => r.role === "expand" || r.ids.every((id6) => !occupied.has(id6)));
    }
    const observed2 = /* @__PURE__ */ new Map();
    for (const target of members.flatMap((m) => m.targets.filter((t) => t.seenAt <= m.time)).sort((a, b) => b.seenAt - a.seenAt || a.observer - b.observer || targetRank[a.kind] - targetRank[b.kind] || keyCompare(a.key, b.key) || levelOf(a) - levelOf(b) || a.x - b.x || a.y - b.y)) {
      const variant = `${target.key}@${pointKey(target)}`;
      if (!observed2.has(variant)) observed2.set(variant, { ...target });
    }
    const targets = [...observed2.values()].sort((a, b) => targetRank[a.kind] - targetRank[b.kind] || b.seenAt - a.seenAt || keyCompare(a.key, b.key) || levelOf(a) - levelOf(b) || a.x - b.x || a.y - b.y);
    if (!threats.size && !wave && !launchedThisStep) {
      if (!reservations.some((r) => r.role === "scout")) {
        const expandSides = new Set(reservations.filter((r) => r.role === "expand").map((r) => r.side));
        const scouts = members.filter((m) => m.scoutingNeeded && m.fighters.some((f) => !occupied.has(f.id)) && m.targets.some((t) => t.seenAt <= m.time && m.fighters.some((f) => sameLevel(f, t) && !occupied.has(f.id)))).sort((a, b) => Number(expandSides.has(a.side)) - Number(expandSides.has(b.side)) || a.side - b.side);
        const scout = scouts[0], scoutTargets = scout?.targets.filter((t) => t.seenAt <= scout.time && scout.fighters.some((f) => sameLevel(f, t) && !occupied.has(f.id))).sort((a, b) => targetRank[a.kind] - targetRank[b.kind] || b.seenAt - a.seenAt || keyCompare(a.key, b.key) || levelOf(a) - levelOf(b)) ?? [];
        const target2 = scoutTargets.find((t) => t.kind !== "unit") ?? scoutTargets[0];
        if (scout && target2) {
          const fighter = [...scout.fighters].filter((f) => !occupied.has(f.id) && sameLevel(f, target2)).sort((a, b) => Number(b.role === "cavalry") - Number(a.role === "cavalry") || a.id - b.id)[0];
          reservations.push({ teamId, side: scout.side, role: "scout", key: target2.key, destination: point(target2), ids: [fighter.id], createdAt: time, expiresAt: time + TEAM_AI_SCOUT_LEASE });
        }
      }
      if (!reservations.some((r) => r.role === "expand")) {
        const scoutSides = new Set(reservations.filter((r) => r.role === "scout").map((r) => r.side));
        const expanding = members.filter((m) => m.expansion).sort((a, b) => Number(scoutSides.has(a.side)) - Number(scoutSides.has(b.side)) || distance6(a.hq, a.expansion) - distance6(b.hq, b.expansion) || a.side - b.side)[0];
        if (expanding) reservations.push({ teamId, side: expanding.side, role: "expand", key: `expansion:${pointKey(expanding.expansion)}`, destination: point(expanding.expansion), ids: [], createdAt: time, expiresAt: time + TEAM_AI_EXPANSION_LEASE });
      }
      const ready = members.filter((m) => m.readyToAttack && m.waveReadyAt <= time + TEAM_AI_WAVE_LIFETIME);
      const scoutIds = new Set(reservations.filter((r) => r.role === "scout").flatMap((r) => r.ids));
      let target, participants = [];
      const useful = (army) => army.length >= TEAM_ATTACK_MIN_PARTICIPANTS && army.reduce((sum, p) => sum + p.ids.length, 0) >= TEAM_ATTACK_MIN_FIGHTERS;
      for (const candidate of targets) {
        const approved = ready.filter((m) => m.fighters.filter((f) => sameLevel(f, candidate)).length >= 2 && m.targets.some((known2) => known2.key === candidate.key && known2.x === candidate.x && known2.y === candidate.y && sameLevel(known2, candidate) && known2.seenAt <= m.time));
        let army = approved.map((m) => ({ side: m.side, ids: m.fighters.filter((f) => !scoutIds.has(f.id) && sameLevel(f, candidate)).map((f) => f.id) })).filter((p) => p.ids.length);
        if (!useful(army)) army = approved.map((m) => ({ side: m.side, ids: m.fighters.filter((f) => sameLevel(f, candidate)).map((f) => f.id) })).filter((p) => p.ids.length);
        if (useful(army)) {
          target = candidate;
          participants = army;
          break;
        }
      }
      if (target) {
        const launchAt = Math.max(time + TEAM_AI_WAVE_DELAY, ...participants.map((p) => memberBySide.get(p.side).waveReadyAt));
        if (launchAt <= time + TEAM_AI_WAVE_LIFETIME) {
          wave = { id: coordinator.nextWaveId++, teamId, target: { ...target }, participants, launchAt, expiresAt: time + TEAM_AI_WAVE_LIFETIME, launched: false };
          for (const p of participants) p.ids.forEach((id6) => occupied.add(id6));
          reservations = reservations.filter((r) => r.role === "expand" || r.ids.every((id6) => !occupied.has(id6)));
        }
      }
      if (!wave) {
        const solos = members.filter((m) => m.soloReadyToAttack && m.waveReadyAt + TEAM_AI_WAVE_LIFETIME <= time && m.fighters.some((f) => !occupied.has(f.id)) && m.targets.some((t) => t.seenAt <= m.time && m.fighters.some((f) => sameLevel(f, t) && !occupied.has(f.id)))).sort((a, b) => a.waveReadyAt - b.waveReadyAt || a.side - b.side);
        const solo = solos[0], known2 = solo?.targets.filter((t) => t.seenAt <= solo.time && solo.fighters.filter((f) => sameLevel(f, t) && !occupied.has(f.id)).length >= (solo.soloAttackSize ?? 3)).sort((a, b) => targetRank[a.kind] - targetRank[b.kind] || b.seenAt - a.seenAt || keyCompare(a.key, b.key) || levelOf(a) - levelOf(b) || a.x - b.x || a.y - b.y)[0];
        if (solo && known2) {
          const ids = solo.fighters.filter((f) => !occupied.has(f.id) && sameLevel(f, known2)).map((f) => f.id), waveId = coordinator.nextWaveId++;
          wave = { id: waveId, teamId, target: { ...known2 }, participants: [{ side: solo.side, ids }], launchAt: time, expiresAt: time + TEAM_AI_WAVE_LIFETIME, launched: true };
          for (let i = 0; i < ids.length; i += TEAM_AI_COMMAND_IDS) launches.push({ side: solo.side, ids: ids.slice(i, i + TEAM_AI_COMMAND_IDS), destination: point(known2), waveId });
          ids.forEach((id6) => occupied.add(id6));
          reservations = reservations.filter((r) => r.role === "expand" || r.ids.every((id6) => !occupied.has(id6)));
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
function validateTeamAiState(value, context) {
  const fail2 = (path3, reason) => {
    throw new Error(`Invalid team AI at ${path3}: ${reason}.`);
  };
  const object8 = (v, path3, required, optional = []) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) fail2(path3, "expected a plain object");
    const record7 = v;
    const names = Object.getOwnPropertyNames(record7);
    if (Object.getOwnPropertySymbols(record7).length || names.some((k) => ![...required, ...optional].includes(k)) || required.some((k) => !Object.hasOwn(record7, k))) fail2(path3, "unexpected or missing field");
    for (const key of names) if (!("value" in Object.getOwnPropertyDescriptor(record7, key))) fail2(path3, "accessors are forbidden");
    return record7;
  };
  const number6 = (v, path3, min, max, integer5 = false) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer5 && !Number.isSafeInteger(v)) fail2(path3, "invalid number");
    return v;
  };
  const list4 = (v, path3, max) => {
    if (!Array.isArray(v) || v.length > max || Object.getPrototypeOf(v) !== Array.prototype) fail2(path3, "invalid array");
    const source2 = v, array4 = [];
    if (Object.getOwnPropertySymbols(source2).length || Object.getOwnPropertyNames(source2).some((k) => k !== "length" && (!/^(0|[1-9]\d*)$/.test(k) || Number(k) >= source2.length))) fail2(path3, "unexpected array properties");
    for (let i = 0; i < source2.length; i++) {
      const d = Object.getOwnPropertyDescriptor(source2, String(i));
      if (!d || !("value" in d)) fail2(path3, "array gaps and accessors are forbidden");
      array4.push(d.value);
    }
    return array4;
  };
  const choice6 = (v, path3, choices) => {
    if (typeof v !== "string" || !choices.includes(v)) fail2(path3, "unknown value");
    return v;
  };
  const text5 = (v, path3, max = 128) => {
    if (typeof v !== "string" || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) fail2(path3, "invalid text");
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
  const side2 = (v, path3) => number6(v, path3, 0, context.playerCount - 1, true);
  const id6 = (v, path3) => number6(v, path3, 1, context.nextEntityId - 1, true);
  const when = (v, path3) => number6(v, path3, 0, context.time);
  const position2 = (v, path3) => {
    const p = object8(v, path3, ["x", "y"], ["level"]);
    return { ...p.level === void 0 ? {} : { level: number6(p.level, `${path3}.level`, 0, (context.levels ?? 1) - 1, true) }, x: number6(p.x, `${path3}.x`, 0, context.width), y: number6(p.y, `${path3}.y`, 0, context.height) };
  };
  const unique2 = (items, path3, read) => {
    const seen = /* @__PURE__ */ new Set();
    return items.map((v, i) => {
      const n = read(v, `${path3}[${i}]`);
      if (seen.has(n)) fail2(path3, "duplicate ID");
      seen.add(n);
      return n;
    });
  };
  const claimed = /* @__PURE__ */ new Set();
  const assigned = (v, path3, owner, active4) => unique2(list4(v, path3, 500), path3, id6).map((n) => {
    if (active4 && context.entitySides && context.entitySides.get(n) !== owner) fail2(path3, "assigned entity has a different or missing owner");
    if (active4) {
      if (claimed.has(n)) fail2(path3, "duplicate active troop assignment");
      claimed.add(n);
    }
    return n;
  });
  const assignedLevel = (ids, destination, path3, active4 = true) => {
    if (active4 && context.entityLevels && ids.some((id7) => context.entityLevels.get(id7) !== levelOf(destination))) fail2(path3, "assigned entity is on a different or missing level");
  };
  const cost5 = (v, path3) => {
    const c = object8(v, path3, ["wood", "ore", "crystal"]);
    const result = { wood: number6(c.wood, `${path3}.wood`, 0, 1e9), ore: number6(c.ore, `${path3}.ore`, 0, 1e9), crystal: number6(c.crystal, `${path3}.crystal`, 0, 1e9) };
    if (!result.wood && !result.ore && !result.crystal) fail2(path3, "empty resources");
    return result;
  };
  const allies2 = (a, b, path3) => {
    if (a === b || context.teams[a] !== context.teams[b]) fail2(path3, "expected distinct allies");
  };
  const root = object8(value, "state", ["coordinator", "directives", "nextDirectiveId", "nextTransferId", "transfers"]);
  const saved = object8(root.coordinator, "coordinator", ["nextWaveId", "reservations", "waves"]);
  const nextWaveId = number6(saved.nextWaveId, "coordinator.nextWaveId", 1, 1e12, true), nextDirectiveId = number6(root.nextDirectiveId, "nextDirectiveId", 1, 1e12, true), nextTransferId = number6(root.nextTransferId, "nextTransferId", 1, 1e12, true);
  const reservationKeys = /* @__PURE__ */ new Set();
  const reservations = list4(saved.reservations, "coordinator.reservations", MAX_TEAM_AI_RESERVATIONS).map((v, i) => {
    const path3 = `coordinator.reservations[${i}]`, r = object8(v, path3, ["teamId", "side", "role", "key", "destination", "ids", "createdAt", "expiresAt"]);
    const owner = side2(r.side, `${path3}.side`), teamId = number6(r.teamId, `${path3}.teamId`, 0, 7, true);
    if (context.teams[owner] !== teamId) fail2(path3, "reservation team differs from owner");
    const role = choice6(r.role, `${path3}.role`, ["scout", "expand"]), key = text5(r.key, `${path3}.key`), slot = `${teamId}:${role}`;
    if (reservationKeys.has(slot)) fail2(path3, "duplicate reservation role");
    reservationKeys.add(slot);
    const ids = assigned(r.ids, `${path3}.ids`, owner, true);
    if (role === "scout" ? ids.length !== 1 : ids.length !== 0) fail2(path3, "invalid role assignment");
    const createdAt = when(r.createdAt, `${path3}.createdAt`), expiresAt = number6(r.expiresAt, `${path3}.expiresAt`, createdAt, createdAt + (role === "scout" ? TEAM_AI_SCOUT_LEASE : TEAM_AI_EXPANSION_LEASE));
    const destination = position2(r.destination, `${path3}.destination`);
    assignedLevel(ids, destination, `${path3}.ids`);
    return { teamId, side: owner, role, key, destination, ids, createdAt, expiresAt };
  });
  const waveIds = /* @__PURE__ */ new Set(), waveTeams = /* @__PURE__ */ new Set();
  const waves = list4(saved.waves, "coordinator.waves", MAX_TEAM_AI_WAVES).map((v, i) => {
    const path3 = `coordinator.waves[${i}]`, w = object8(v, path3, ["id", "teamId", "target", "participants", "launchAt", "expiresAt", "launched"]), waveId = number6(w.id, `${path3}.id`, 1, nextWaveId - 1, true), teamId = number6(w.teamId, `${path3}.teamId`, 0, 7, true);
    if (waveIds.has(waveId) || waveTeams.has(teamId)) fail2(path3, "duplicate wave ID or team");
    waveIds.add(waveId);
    waveTeams.add(teamId);
    const t = object8(w.target, `${path3}.target`, ["key", "kind", "observer", "seenAt", "x", "y"], ["level"]), observer = side2(t.observer, `${path3}.target.observer`);
    if (context.teams[observer] !== teamId) fail2(path3, "target observer is not allied");
    const target = { ...position2({ x: t.x, y: t.y, ...t.level === void 0 ? {} : { level: t.level } }, `${path3}.target.position`), key: text5(t.key, `${path3}.target.key`), kind: choice6(t.kind, `${path3}.target.kind`, ["hq", "building", "unit", "start"]), observer, seenAt: when(t.seenAt, `${path3}.target.seenAt`) };
    const participantSides = /* @__PURE__ */ new Set(), troopIds = /* @__PURE__ */ new Set();
    const participants = list4(w.participants, `${path3}.participants`, 8).map((v2, j) => {
      const ppath = `${path3}.participants[${j}]`, p = object8(v2, ppath, ["side", "ids"]), owner = side2(p.side, `${ppath}.side`);
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
    if (!participants.length) fail2(path3, "empty wave");
    const launchAt = number6(w.launchAt, `${path3}.launchAt`, 0, context.time + TEAM_AI_WAVE_LIFETIME), expiresAt = number6(w.expiresAt, `${path3}.expiresAt`, launchAt, context.time + TEAM_AI_WAVE_LIFETIME);
    if (typeof w.launched !== "boolean") fail2(path3, "invalid launched flag");
    if (w.launched && launchAt > context.time) fail2(path3, "launched wave has a future launch time");
    return { id: waveId, teamId, target, participants, launchAt, expiresAt, launched: w.launched };
  });
  const directiveIds = /* @__PURE__ */ new Set(), activeRecipients = /* @__PURE__ */ new Set();
  const directives = list4(root.directives, "directives", MAX_TEAM_DIRECTIVES).map((v, i) => {
    const path3 = `directives[${i}]`, d = object8(v, path3, ["id", "issuer", "recipient", "kind", "createdAt", "expiresAt", "status", "assigned"], ["destination", "observedTarget", "resources", "arrivedAt", "reason"]);
    const directiveId = number6(d.id, `${path3}.id`, 1, nextDirectiveId - 1, true);
    if (directiveIds.has(directiveId)) fail2(path3, "duplicate directive ID");
    directiveIds.add(directiveId);
    const issuer = side2(d.issuer, `${path3}.issuer`), recipient = side2(d.recipient, `${path3}.recipient`);
    allies2(issuer, recipient, path3);
    const kind = choice6(d.kind, `${path3}.kind`, ["defend", "scout", "attack", "support"]), status = choice6(d.status, `${path3}.status`, ["accepted", "active", "completed", "failed", "cancelled"]);
    if (status === "accepted" || status === "active") {
      if (activeRecipients.has(recipient)) fail2(path3, "duplicate active recipient");
      activeRecipients.add(recipient);
    }
    const createdAt = when(d.createdAt, `${path3}.createdAt`), expiresAt = number6(d.expiresAt, `${path3}.expiresAt`, createdAt, createdAt + 180);
    const result = { id: directiveId, issuer, recipient, kind, createdAt, expiresAt, status, assigned: assigned(d.assigned, `${path3}.assigned`, recipient, status === "accepted" || status === "active") };
    if (kind === "support") {
      if (d.destination !== void 0 || d.observedTarget !== void 0 || result.assigned.length) fail2(path3, "support cannot assign troops or a destination");
      result.resources = cost5(d.resources, `${path3}.resources`);
    } else {
      if (d.resources !== void 0) fail2(path3, "only support has resources");
      result.destination = position2(d.destination, `${path3}.destination`);
      assignedLevel(result.assigned, result.destination, `${path3}.assigned`, status === "accepted" || status === "active");
    }
    if (d.observedTarget !== void 0) {
      if (kind !== "attack") fail2(path3, "only attack has an observed target");
      result.observedTarget = id6(d.observedTarget, `${path3}.observedTarget`);
    }
    if (d.arrivedAt !== void 0) result.arrivedAt = number6(d.arrivedAt, `${path3}.arrivedAt`, createdAt, context.time);
    if (d.reason !== void 0) result.reason = text5(d.reason, `${path3}.reason`, 160);
    return result;
  });
  const transferIds = /* @__PURE__ */ new Set();
  const transfers = list4(root.transfers, "transfers", MAX_TEAM_TRANSFERS).map((v, i) => {
    const path3 = `transfers[${i}]`, t = object8(v, path3, ["id", "sender", "recipient", "resources", "time"]), transferId = number6(t.id, `${path3}.id`, 1, nextTransferId - 1, true);
    if (transferIds.has(transferId)) fail2(path3, "duplicate transfer ID");
    transferIds.add(transferId);
    const sender = side2(t.sender, `${path3}.sender`), recipient = side2(t.recipient, `${path3}.recipient`);
    allies2(sender, recipient, path3);
    return { id: transferId, sender, recipient, resources: cost5(t.resources, `${path3}.resources`), time: when(t.time, `${path3}.time`) };
  });
  return { coordinator: { nextWaveId, reservations, waves }, nextDirectiveId, directives, nextTransferId, transfers };
}

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
function bad2(path3, detail) {
  throw new Error(`Invalid save at ${path3}: ${detail}.`);
}
function object2(value, path3, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad2(path3, "expected an object");
  const record7 = value;
  for (const key of required) if (!Object.hasOwn(record7, key)) bad2(`${path3}.${key}`, "missing field");
  for (const key of Object.keys(record7)) if (!required.includes(key) && !optional.includes(key)) bad2(`${path3}.${key}`, "unknown field");
  return record7;
}
function number2(value, path3, min = 0, max = MAX_VALUE, integer5 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer5 && !Number.isSafeInteger(value)) bad2(path3, `expected ${integer5 ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function flag2(value, path3) {
  if (typeof value !== "boolean") bad2(path3, "expected a boolean");
  return value;
}
function choice2(value, path3, choices) {
  if (typeof value !== "string" || !choices.includes(value)) bad2(path3, "unknown value");
  return value;
}
function list2(value, path3, max, length2) {
  if (!Array.isArray(value) || value.length > max || length2 !== void 0 && value.length !== length2) bad2(path3, "invalid array length");
  return value;
}
function optionalNumber(record7, key, path3, min = 0, max = MAX_VALUE, integer5 = false) {
  if (record7[key] !== void 0) number2(record7[key], `${path3}.${key}`, min, max, integer5);
}
function optionalFlag(record7, key, path3) {
  if (record7[key] !== void 0) flag2(record7[key], `${path3}.${key}`);
}
function id3(value, path3, c) {
  return number2(value, path3, 1, c.nextId - 1, true);
}
function point2(value, path3, c) {
  const p = object2(value, path3, ["x", "y"], ["level"]);
  number2(p.x, `${path3}.x`, 0, c.width);
  number2(p.y, `${path3}.y`, 0, c.height);
  optionalNumber(p, "level", path3, 0, c.levels - 1, true);
}
function coordinates(value, path3, c) {
  number2(value.x, `${path3}.x`, 0, c.width);
  number2(value.y, `${path3}.y`, 0, c.height);
  optionalNumber(value, "level", path3, 0, c.levels - 1, true);
}
function order(value, path3, c) {
  const o = object2(value, path3, ["type"], ["x", "y", "target", "transition", "level"]);
  choice2(o.type, `${path3}.type`, ["idle", "hold", "move", "attackMove", "attack", "gather", "build", "traverse", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"]);
  if (o.type === "move" || o.type === "attackMove") {
    object2(value, path3, ["type", "x", "y"], ["level"]);
    coordinates(o, path3, c);
  } else if (["attack", "gather", "build", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"].includes(o.type)) {
    object2(value, path3, ["type", "target"]);
    id3(o.target, `${path3}.target`, c);
  } else if (o.type === "traverse") {
    object2(value, path3, ["type", "transition"]);
    number2(o.transition, `${path3}.transition`, 1, 2147483647, true);
  } else object2(value, path3, ["type"]);
}
function uniqueIds(values, path3, max) {
  const result = /* @__PURE__ */ new Set();
  values.forEach((v, i) => {
    const n = number2(v, `${path3}[${i}]`, 0, max, true);
    if (result.has(n)) bad2(path3, "duplicate value");
    result.add(n);
  });
  return result;
}
function fog(value, path3, c) {
  return list2(value, path3, c.playerCount, c.playerCount).map((v, i) => uniqueIds(list2(v, `${path3}[${i}]`, c.cells), `${path3}[${i}]`, c.cells - 1));
}
function validateEntity(value, path3, c) {
  const e = object2(value, path3, ["id", "side", "kind", "role", "x", "y", "hp", "maxHp", "order", "cooldown", "progress", "queue", "trainProgress", "researchProgress", "facing", "animation", "animTime", "momentum", "illusion", "expires", "carried", "carriedKind", "path"], ["tactics", "factionState", "level", "definitionId", "definitionFaction", "queueDefinitionIds", "queuePaidCosts", "orderQueue", "research", "researchPaidCost", "rally", "gateOpen", "lastAttacker", "abilityReadyAt", "entrenchedAt", "raised", "shield", "maxShield", "lastDamagedAt", "surgeUntil", "veteran", "equipment", "specialistBuffs", "siegeMode", "burning", "beacon"]);
  const entityId = id3(e.id, `${path3}.id`, c);
  if (c.entityIds.has(entityId)) bad2(`${path3}.id`, "duplicate entity or resource id");
  c.entityIds.add(entityId);
  c.entities.set(entityId, e);
  number2(e.side, `${path3}.side`, 0, c.playerCount - 1, true);
  choice2(e.kind, `${path3}.kind`, ["unit", "building"]);
  choice2(e.role, `${path3}.role`, e.kind === "unit" ? UNIT_ROLES : BUILDING_ROLES);
  coordinates(e, path3, c);
  const maxHp = number2(e.maxHp, `${path3}.maxHp`, Number.MIN_VALUE, 1e9);
  number2(e.hp, `${path3}.hp`, 0, maxHp);
  order(e.order, `${path3}.order`, c);
  for (const key of ["cooldown", "animTime", "expires"]) number2(e[key], `${path3}.${key}`);
  for (const key of ["progress", "trainProgress"]) number2(e[key], `${path3}.${key}`, 0, 1);
  number2(e.researchProgress, `${path3}.researchProgress`, 0, 2);
  number2(e.facing, `${path3}.facing`, 0, 7, true);
  choice2(e.animation, `${path3}.animation`, ["idle", "walk", "attack", "death"]);
  number2(e.momentum, `${path3}.momentum`, 0, 1);
  flag2(e.illusion, `${path3}.illusion`);
  number2(e.carried, `${path3}.carried`, 0, 18);
  choice2(e.carriedKind, `${path3}.carriedKind`, RESOURCE_KINDS2);
  if (e.definitionFaction !== void 0) {
    choice2(e.definitionFaction, `${path3}.definitionFaction`, Object.keys(contentFactions(c.state.content)));
    if (!c.state.players.some((player) => player.faction === e.definitionFaction) || e.kind !== "unit" || !e.illusion && e.raised !== true && e.role !== "siege" && (e.role === "worker" || e.tactics?.surrenderedTo !== e.side)) bad2(`${path3}.definitionFaction`, "original faction requires a captured engine, surrendered combat troop or admitted summon from a match faction");
  }
  if (e.definitionId !== void 0) {
    if (typeof e.definitionId !== "string" || e.definitionId.length > 100) bad2(`${path3}.definitionId`, "invalid ID");
    try {
      entityDefinition(c.state, e);
    } catch {
      bad2(`${path3}.definitionId`, "definition is absent from the pinned faction or has another role");
    }
  }
  if (e.definitionFaction !== void 0 && !e.illusion && e.maxHp !== entityDefinition(c.state, e).hp) bad2(`${path3}.maxHp`, "captured troop health capacity differs from its original definition");
  const queue = list2(e.queue, `${path3}.queue`, 5);
  queue.forEach((role, i) => {
    choice2(role, `${path3}.queue[${i}]`, UNIT_ROLES);
    if (e.kind !== "building" || e.role !== "hq" && e.role !== "barracks" || e.role === "hq" && role !== "worker" || e.role === "barracks" && role === "worker") bad2(`${path3}.queue`, "invalid producer or recruit");
  });
  if (e.queueDefinitionIds !== void 0) {
    list2(e.queueDefinitionIds, `${path3}.queueDefinitionIds`, 5, queue.length).forEach((id6, i) => {
      const def = availableUnits(c.state, e.side).find((d) => d.id === id6);
      if (!def || def.role !== queue[i]) bad2(`${path3}.queueDefinitionIds[${i}]`, "definition is absent from the pinned faction or has another role");
    });
  } else if (c.state.content && queue.length) bad2(`${path3}.queueDefinitionIds`, "pinned production requires definition IDs");
  if (e.queuePaidCosts !== void 0) {
    list2(e.queuePaidCosts, `${path3}.queuePaidCosts`, 5, queue.length).forEach((value2, i) => {
      const paid = object2(value2, `${path3}.queuePaidCosts[${i}]`, ["wood", "ore", "crystal"]);
      for (const key of RESOURCE_KINDS2) number2(paid[key], `${path3}.queuePaidCosts[${i}].${key}`, 0, 1e5);
      const expected = availableUnits(c.state, e.side).find((d) => d.id === e.queueDefinitionIds?.[i])?.cost;
      if (!expected || RESOURCE_KINDS2.some((key) => paid[key] !== expected[key])) bad2(`${path3}.queuePaidCosts[${i}]`, "paid cost differs from pinned definition");
    });
  } else if (c.state.content && queue.length) bad2(`${path3}.queuePaidCosts`, "pinned production requires charged cost records");
  list2(e.path, `${path3}.path`, c.cells * 16).forEach((p, i) => point2(p, `${path3}.path[${i}]`, c));
  if (e.orderQueue !== void 0) {
    if (e.kind !== "unit" || e.illusion) bad2(`${path3}.orderQueue`, "only real units can queue orders");
    list2(e.orderQueue, `${path3}.orderQueue`, MAX_ORDER_QUEUE).forEach((o, i) => order(o, `${path3}.orderQueue[${i}]`, c));
  }
  if (e.research !== void 0) {
    const upgrades = upgradesFor(c.state, e.side);
    choice2(e.research, `${path3}.research`, Object.keys(upgrades));
    if (e.kind !== "building" || upgrades[e.research].building !== e.role) bad2(`${path3}.research`, "wrong research building");
  }
  if (e.research !== void 0 && upgradesFor(c.state, e.side)[e.research].exclusiveGroup && e.researchPaidCost === void 0) bad2(`${path3}.researchPaidCost`, "exclusive research requires the original charged cost");
  if (e.researchPaidCost !== void 0) {
    if (e.research === void 0) bad2(`${path3}.researchPaidCost`, "charged research cost requires pending research");
    const paid = object2(e.researchPaidCost, `${path3}.researchPaidCost`, ["wood", "ore", "crystal"]), expected = upgradesFor(c.state, e.side)[e.research].cost;
    for (const key of RESOURCE_KINDS2) {
      number2(paid[key], `${path3}.researchPaidCost.${key}`, 0, 1e5);
      if (paid[key] !== expected[key]) bad2(`${path3}.researchPaidCost`, "charged cost differs from pinned research");
    }
  }
  if (e.rally !== void 0) point2(e.rally, `${path3}.rally`, c);
  for (const key of ["gateOpen", "raised"]) optionalFlag(e, key, path3);
  if (e.raised === true) {
    const original = contentFactions(c.state.content)[e.definitionFaction ?? c.state.players[e.side].faction], definition2 = entityDefinition(c.state, e);
    const healthFactor = e.illusion ? 0.4 : 1, lifetime = e.illusion ? 15 : 35;
    if (e.kind !== "unit" || e.role !== "melee" || c.version === 4 && !(original.unitDefinitions ?? Object.values(original.units)).some((d) => d.ability === "raise") || !(original.unitDefinitions ?? Object.values(original.units)).some((d) => d.role === "melee" && d.id === definition2.id) || e.maxHp !== definition2.hp * healthFactor || e.expires <= 0 || e.expires > c.time + lifetime + 1e-8) bad2(`${path3}.raised`, "raised troops require an admitted raising faction melee definition and their summon lifetime");
  }
  if (e.lastAttacker !== void 0) id3(e.lastAttacker, `${path3}.lastAttacker`, c);
  for (const key of ["abilityReadyAt", "entrenchedAt", "lastDamagedAt", "surgeUntil", "shield", "maxShield"]) optionalNumber(e, key, path3);
  if (e.factionState !== void 0) validateFactionUnit(e.factionState, `${path3}.factionState`, c, e);
  if (e.tactics !== void 0) validateTactics(e.tactics, `${path3}.tactics`, c, e);
  if (e.shield !== void 0 && e.shield > (e.maxShield ?? 0)) bad2(`${path3}.shield`, "shield exceeds capacity");
  if (e.maxShield !== void 0) {
    const capacity = e.kind === "unit" ? entityDefinition(c.state, e).shield : e.factionState?.power ? 80 : void 0;
    if (capacity === void 0 || e.maxShield !== capacity) bad2(`${path3}.maxShield`, "shield capacity differs from admitted definition or power network");
  }
}
function validateBody(value, path3, c) {
  const body2 = object2(value, path3, ["id", "x", "y", "expires"], ["level"]);
  id3(body2.id, `${path3}.id`, c);
  coordinates(body2, path3, c);
  number2(body2.expires, `${path3}.expires`);
  if (body2.level !== void 0) number2(body2.level, `${path3}.level`, 0, c.levels - 1, true);
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
function validateFactionUnit(value, path3, c, e) {
  const f = object2(value, path3, [], ["trophyKills", "chant", "swapReadyAt", "artillery", "tunnel", "corpseCargo", "deliveredCorpses", "corpseOrder", "power", "nextDecoyAt", "waterReadyAt"]);
  if (f.trophyKills !== void 0) {
    if (e.kind !== "unit" || e.illusion) bad2(`${path3}.trophyKills`, "trophies require real troops");
    number2(f.trophyKills, `${path3}.trophyKills`, 0, 1e9, true);
  }
  for (const key of ["swapReadyAt", "nextDecoyAt", "waterReadyAt"]) optionalNumber(f, key, path3, 0, c.time + 60);
  if (f.swapReadyAt !== void 0 && (e.kind !== "unit" || e.illusion || ["worker", "siege"].includes(e.role))) bad2(`${path3}.swapReadyAt`, "illusion swapping requires real military troops");
  if (f.waterReadyAt !== void 0 && (e.kind !== "unit" || e.illusion || e.role !== "special" || entityDefinition(c.state, e).ability !== "surge")) bad2(`${path3}.waterReadyAt`, "water shaping requires an admitted Tidecaller");
  if (f.nextDecoyAt !== void 0 && (e.kind !== "building" || e.definitionId !== "core:fairies-enchanted-grove")) bad2(`${path3}.nextDecoyAt`, "decoy cooldown requires an Enchanted Grove");
  if (f.chant !== void 0) {
    if (e.kind !== "unit" || e.illusion || ["worker", "siege"].includes(e.role) || c.state.players[e.side].faction !== "orcs") bad2(`${path3}.chant`, "war chants require owned Ironclad military troops");
    const chant = object2(f.chant, `${path3}.chant`, ["kind", "until"]);
    choice2(chant.kind, `${path3}.chant.kind`, ["assault", "bulwark"]);
    number2(chant.until, `${path3}.chant.until`, 0, c.time + 12);
  }
  if (f.artillery !== void 0) {
    if (e.kind !== "unit" || e.illusion || e.role !== "siege" && (e.role !== "special" || entityDefinition(c.state, e).ability !== "entrench")) bad2(`${path3}.artillery`, "fittings require siege artillery or an admitted Siege Cannon");
    choice2(f.artillery, `${path3}.artillery`, ["stone", "grapeshot", "incendiary", "reinforced"]);
  }
  if (f.tunnel !== void 0) {
    if (e.kind !== "unit" || e.illusion || e.raised || c.state.players[e.side].faction !== "dwarves") bad2(`${path3}.tunnel`, "tunnel orders require owned real Deepforge troops");
    const tunnel = object2(f.tunnel, `${path3}.tunnel`, ["target", "progress"]);
    id3(tunnel.target, `${path3}.tunnel.target`, c);
    number2(tunnel.progress, `${path3}.tunnel.progress`, 0, 1);
  }
  for (const key of ["corpseCargo", "deliveredCorpses"]) if (f[key] !== void 0) {
    if (e.kind !== "unit" || e.illusion || key === "corpseCargo" && e.definitionId !== "core:undead-corpse-wagon" || key === "deliveredCorpses" && (e.role !== "special" || entityDefinition(c.state, e).ability !== "raise")) bad2(`${path3}.${key}`, "wrong corpse carrier");
    list2(f[key], `${path3}.${key}`, key === "corpseCargo" ? 6 : 12).forEach((v, i) => validateBody(v, `${path3}.${key}[${i}]`, c));
  }
  if (f.corpseOrder !== void 0) {
    const order3 = object2(f.corpseOrder, `${path3}.corpseOrder`, ["type", "target", "progress"]);
    choice2(order3.type, `${path3}.corpseOrder.type`, ["collect", "deliver"]);
    id3(order3.target, `${path3}.corpseOrder.target`, c);
    number2(order3.progress, `${path3}.corpseOrder.progress`, 0, 1);
    if (e.kind !== "unit" || e.illusion || e.definitionId !== "core:undead-corpse-wagon" || c.state.players[e.side].faction !== "undead") bad2(`${path3}.corpseOrder`, "active corpse orders require an owned Ashen Host corpse wagon");
  }
  if (f.power !== void 0) {
    const power = object2(f.power, `${path3}.power`, ["connected", "root"]);
    flag2(power.connected, `${path3}.power.connected`);
    if (power.root !== null) id3(power.root, `${path3}.power.root`, c);
    if (power.connected !== (power.root !== null) || e.kind !== "building" || e.progress !== 1 || c.state.players[e.side].faction !== "automata" || e.maxShield !== 80 || e.shield === void 0) bad2(`${path3}.power`, "power requires a completed Automata building with an 80-point shield capacity");
  }
}
function validateFactionSystem(value, path3, c) {
  const system = object2(value, path3, ["version", "fury", "terrainEffects"]);
  if (system.version !== 1) bad2(`${path3}.version`, "unknown faction schema");
  list2(system.fury, `${path3}.fury`, c.playerCount, c.playerCount).forEach((v, i) => number2(v, `${path3}.fury[${i}]`, 0, 100));
  const ids = /* @__PURE__ */ new Set();
  list2(system.terrainEffects, `${path3}.terrainEffects`, c.maxEntities).forEach((v, i) => {
    const p = `${path3}.terrainEffects[${i}]`, effect = object2(v, p, ["id", "side", "until", "tiles"]), n = id3(effect.id, `${p}.id`, c);
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
function validateTactics(value, path3, c, e) {
  const t = object2(value, path3, ["morale", "recentLoss"], ["formation", "retreat", "surrenderedTo", "ambush", "charge", "guard", "siegeCrew", "capture"]);
  if (e.kind !== "unit") bad2(path3, "tactics requires a unit");
  number2(t.morale, `${path3}.morale`, 0, 100);
  number2(t.recentLoss, `${path3}.recentLoss`, 0, 60);
  if (t.surrenderedTo !== void 0) {
    number2(t.surrenderedTo, `${path3}.surrenderedTo`, 0, c.playerCount - 1, true);
    if (t.surrenderedTo !== e.side || e.illusion || ["worker", "siege"].includes(e.role) || e.definitionFaction === void 0) bad2(`${path3}.surrenderedTo`, "surrender requires the current owner and original combat troop definition");
  }
  if (t.retreat !== void 0) {
    const r = object2(t.retreat, `${path3}.retreat`, ["x", "y", "until"], ["level"]);
    coordinates(r, `${path3}.retreat`, c);
    number2(r.until, `${path3}.retreat.until`, 0, c.time + 8.01);
  }
  if (t.formation !== void 0) {
    if (e.illusion || ["worker", "siege"].includes(e.role)) bad2(`${path3}.formation`, "formations require real military troops");
    const f = object2(t.formation, `${path3}.formation`, ["kind", "group", "slot", "count", "spacing", "facing", "anchor", "phase"]);
    choice2(f.kind, `${path3}.formation.kind`, ["line", "wedge", "square", "loose"]);
    if (typeof f.group !== "string" || !f.group.length || f.group.length > 1200) bad2(`${path3}.formation.group`, "invalid formation group");
    const count = number2(f.count, `${path3}.formation.count`, 1, 100, true);
    number2(f.slot, `${path3}.formation.slot`, 0, count - 1, true);
    number2(f.spacing, `${path3}.formation.spacing`, 0.65, 3);
    number2(f.facing, `${path3}.formation.facing`, 0, 7, true);
    point2(f.anchor, `${path3}.formation.anchor`, c);
    choice2(f.phase, `${path3}.formation.phase`, ["moving", "broken", "regrouping", "formed"]);
  }
  if (t.ambush !== void 0) {
    const a = object2(t.ambush, `${path3}.ambush`, ["radius", "target", "concealed", "armedAt"]);
    number2(a.radius, `${path3}.ambush.radius`, 0.75, 10);
    choice2(a.target, `${path3}.ambush.target`, ["any", "unit", "building", ...UNIT_ROLES]);
    flag2(a.concealed, `${path3}.ambush.concealed`);
    number2(a.armedAt, `${path3}.ambush.armedAt`, 0, c.time);
    if (e.role === "worker" || e.role === "siege" || e.illusion) bad2(`${path3}.ambush`, "ineligible ambusher");
  }
  if (t.charge !== void 0) {
    const charge = object2(t.charge, `${path3}.charge`, ["distance", "heading", "lastMovedAt"]);
    number2(charge.distance, `${path3}.charge.distance`, 0, 5);
    number2(charge.heading, `${path3}.charge.heading`, 0, 7, true);
    number2(charge.lastMovedAt, `${path3}.charge.lastMovedAt`, 0, c.time);
    if (e.role !== "cavalry" || e.illusion) bad2(`${path3}.charge`, "charge requires real cavalry");
  }
  if (t.guard !== void 0) {
    const originalFaction = e.definitionFaction ?? c.state.players[e.side].faction;
    if (e.role !== "melee" || !["dwarves", "tideborn", "automata"].includes(originalFaction)) bad2(`${path3}.guard`, "guard requires an admitted shield bearer");
    const guard = object2(t.guard, `${path3}.guard`, ["value", "max", "lastDamagedAt"]);
    const max = number2(guard.max, `${path3}.guard.max`, 40, 40);
    number2(guard.value, `${path3}.guard.value`, 0, max);
    number2(guard.lastDamagedAt, `${path3}.guard.lastDamagedAt`, 0, c.time);
  }
  if (t.siegeCrew !== void 0) {
    const crew = object2(t.siegeCrew, `${path3}.siegeCrew`, ["hp", "maxHp", "uncrewed"]);
    const max = number2(crew.maxHp, `${path3}.siegeCrew.maxHp`, 42, 42);
    number2(crew.hp, `${path3}.siegeCrew.hp`, 0, max);
    flag2(crew.uncrewed, `${path3}.siegeCrew.uncrewed`);
    if (e.role !== "siege" || e.illusion || crew.uncrewed !== (crew.hp === 0)) bad2(`${path3}.siegeCrew`, "invalid siege crew");
  }
  if (t.capture !== void 0) {
    const capture = object2(t.capture, `${path3}.capture`, ["target", "progress"]);
    id3(capture.target, `${path3}.capture.target`, c);
    number2(capture.progress, `${path3}.capture.progress`, 0, 1);
    if (!["worker", "melee", "spear", "special"].includes(e.role) || e.illusion || e.raised) bad2(`${path3}.capture`, "ineligible capturer");
  }
}
function playersArray(value, path3, c, check) {
  list2(value, path3, c.playerCount, c.playerCount).forEach((v, i) => check(v, `${path3}[${i}]`));
}
function entries(value, path3, max, c, check) {
  const seen = /* @__PURE__ */ new Set();
  list2(value, path3, max).forEach((entry, i) => {
    const p = `${path3}[${i}]`, parts = list2(entry, p, 2, 2), key = id3(parts[0], `${p}[0]`, c);
    if (seen.has(key)) bad2(path3, "duplicate map key");
    seen.add(key);
    check(parts[1], `${p}[1]`);
  });
}
function validateRuntime(value, c, version, teams) {
  const fields2 = ["fog", "ai", "aiTurns", "hits", "routes", "abilities", "returning", "queuedGather", "aiWave", "initialScoutDispatched", "expansionScout", "expansionScoutDispatched", "knownEnemyBuildings", "enemyStartCleared", "searched"];
  const path3 = "runtime", r = object2(value, path3, version === 1 ? fields2 : version === 2 ? [...fields2, "clearedEnemyStarts"] : [...fields2, "clearedEnemyStarts", "aiBatchTurns", "aiDecisionAt", "aiDecisionTurns", "knownEnemyUnits", "retreating", "producedFighters"], version >= 3 ? ["teamAI"] : []);
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
  playersArray(r.knownEnemyBuildings, "runtime.knownEnemyBuildings", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
    const b = object2(value2, q, ["x", "y", "role"], ["level"]);
    coordinates(b, q, c);
    choice2(b.role, `${q}.role`, BUILDING_ROLES);
  }));
  playersArray(r.searched, "runtime.searched", c, (v, p) => uniqueIds(list2(v, p, c.cells), p, c.cells - 1));
  if (version >= 2) playersArray(r.clearedEnemyStarts, "runtime.clearedEnemyStarts", c, (v, p) => uniqueIds(list2(v, p, c.playerCount), p, c.playerCount - 1));
  if (version >= 3) {
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
      const record7 = object2(value2, q, ["until", "produced", "afterId"]);
      number2(record7.until, `${q}.until`, 0, c.time + 30);
      number2(record7.produced, `${q}.produced`, 0, MAX_VALUE, true);
      number2(record7.afterId, `${q}.afterId`, 0, c.nextId - 1, true);
    }));
    if (r.teamAI !== void 0) validateTeamAiState(r.teamAI, { playerCount: c.playerCount, teams, time: c.time, nextEntityId: c.nextId, width: c.width, height: c.height, levels: c.levels, entityLevels: new Map([...c.entities].map(([id6, e]) => [id6, e.level ?? 0])), entitySides: new Map([...c.entities].filter(([, e]) => e.hp > 0 && e.kind === "unit" && e.role !== "worker" && !e.illusion).map(([id6, e]) => [id6, e.side])) });
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
  playersArray(s.starts, "state.starts", c, (v, p) => point2(v, p, c));
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
    const path3 = `state.projectiles[${i}]`, shell = object2(v, path3, ["id", "source", "side", "faction", "from", "x", "y", "damage", "buildingMultiplier", "impactAt", "radius"], ["modification", "level"]), key = id3(shell.id, `${path3}.id`, c);
    if (c.entityIds.has(key) || c.resourceIds.has(key)) bad2(`${path3}.id`, "duplicate projectile ID");
    c.resourceIds.add(key);
    id3(shell.source, `${path3}.source`, c);
    number2(shell.side, `${path3}.side`, 0, c.playerCount - 1, true);
    choice2(shell.faction, `${path3}.faction`, Object.keys(contentFactions(c.state.content)));
    const origin = object2(shell.from, `${path3}.from`, ["x", "y"], ["level", "elevation"]);
    coordinates(origin, `${path3}.from`, c);
    optionalNumber(origin, "elevation", `${path3}.from`, 0, 3);
    coordinates(shell, path3, c);
    number2(shell.damage, `${path3}.damage`, 0, 1e9);
    number2(shell.buildingMultiplier, `${path3}.buildingMultiplier`, 0, 100);
    number2(shell.impactAt, `${path3}.impactAt`, c.time, c.time + 30);
    number2(shell.radius, `${path3}.radius`, 0.1, 10);
    if (shell.modification !== void 0) choice2(shell.modification, `${path3}.modification`, ["stone", "grapeshot", "incendiary", "reinforced"]);
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
    for (const id6 of players[side2].upgrades) {
      const group = definitions[id6].exclusiveGroup;
      if (group) {
        if (choices[side2].has(group)) bad2(`state.players[${side2}].upgrades`, "exclusive technology choices conflict");
        choices[side2].set(group, id6);
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
  const claimBody = (body2, path3) => {
    const b = body2, n = b.id;
    if (bodyOwners.has(n)) bad2(path3, "body belongs to more than one location");
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
    const world = s.world;
    for (const allocated of [...world.bridges, ...world.sites, ...world.creatures]) if (c.entityIds.has(allocated.id) || c.resourceIds.has(allocated.id)) bad2("world.id", "collision with entity or resource");
    if (world.levels[0].terrain.some((t, i) => t !== s.terrain[i])) bad2("world.levels[0].terrain", "must match surface terrain");
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
  runtime2.clearedEnemyStarts = cleared.map((value, side2) => value ? [1 - side2] : []);
  envelope.version = 2;
}
function migrateAi(envelope) {
  validate(envelope, 2);
  const state = envelope.state, runtime2 = envelope.runtime, count = state.players.length;
  state.aiConfigs = Array.from({ length: count }, () => normalizeAiConfig());
  Object.assign(runtime2, { aiBatchTurns: 0, aiDecisionAt: Array(count).fill(state.time), aiDecisionTurns: Array(count).fill(0), knownEnemyUnits: Array.from({ length: count }, () => []), retreating: Array.from({ length: count }, () => []), producedFighters: Array(count).fill(0) });
  envelope.version = 3;
}
function copyJson(value) {
  let nodes = 0, bytes = 0;
  const parents = /* @__PURE__ */ new Set();
  function copy(v, path3, depth) {
    if (++nodes > 2e6 || depth > 32) bad2(path3, "save is too large or deeply nested");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) bad2(path3, "numbers must be finite");
      return v;
    }
    if (typeof v === "string") {
      bytes += v.length * 2;
      if (bytes > MAX_SAVE_BYTES) bad2(path3, "save exceeds size limit");
      return v;
    }
    if (!v || typeof v !== "object") bad2(path3, "expected JSON data");
    if (parents.has(v)) bad2(path3, "cyclic reference");
    parents.add(v);
    let result;
    if (Array.isArray(v)) {
      if (v.length > 1e5) bad2(path3, "array exceeds size limit");
      if (Object.getOwnPropertySymbols(v).length) bad2(path3, "invalid array properties");
      for (const key of Object.getOwnPropertyNames(v)) {
        if (!("value" in Object.getOwnPropertyDescriptor(v, key))) bad2(path3, "array accessors are forbidden");
        if (key !== "length") {
          const index2 = Number(key);
          if (!Number.isSafeInteger(index2) || index2 < 0 || index2 >= v.length || String(index2) !== key) bad2(path3, "invalid array properties");
        }
      }
      const array4 = [];
      for (let i = 0; i < v.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
        if (!descriptor || !("value" in descriptor)) bad2(path3, "array accessors and gaps are forbidden");
        array4.push(copy(descriptor.value, `${path3}[${i}]`, depth + 1));
      }
      result = array4;
    } else {
      const prototype = Object.getPrototypeOf(v);
      if (prototype !== Object.prototype && prototype !== null) bad2(path3, "expected a plain object");
      const keys4 = Object.keys(v);
      if (keys4.length > 1e5 || Object.getOwnPropertySymbols(v).length) bad2(path3, "invalid object properties");
      const record7 = {};
      for (const key of keys4) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") bad2(path3, "unsafe property name");
        const descriptor = Object.getOwnPropertyDescriptor(v, key);
        if (!("value" in descriptor)) bad2(path3, "accessors are forbidden");
        if (descriptor.value !== void 0) record7[key] = copy(descriptor.value, `${path3}.${key}`, depth + 1);
      }
      result = record7;
    }
    parents.delete(v);
    return result;
  }
  return copy(value, "save", 0);
}
function checkSize(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_SAVE_BYTES) bad2("save", "save exceeds size limit");
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
  const record7 = object2(envelope, "save", ["format", "version", "state", "runtime"]);
  if (record7.version === 1) migrateLegacy(record7);
  if (record7.version === 2) migrateAi(record7);
  if (record7.version === 3) migrateV3(record7);
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
  const record7 = object2(original, "save", ["format", "version", "state", "runtime"]);
  if (![1, 2, 3, 4].includes(record7.version)) bad2("version", `unsupported version ${String(record7.version)}`);
  validate(copyJson(original), record7.version);
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
    if (!(faction.unitDefinitions ?? Object.values(faction.units)).some((unit4) => unit4.ability === "raise")) throw new Error("Legacy captured summon origin is absent. This saved match is available for inspection but cannot resume under current rules.");
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
function bad3(path3, reason) {
  throw new Error(`Invalid scenario at ${path3}: ${reason}.`);
}
function object3(value, path3, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) bad3(path3, "expected a plain object");
  const record7 = value;
  for (const key of required) if (!Object.hasOwn(record7, key)) bad3(`${path3}.${key}`, "missing field");
  for (const key of Object.keys(record7)) if (!required.includes(key) && !optional.includes(key)) bad3(`${path3}.${key}`, "unknown field");
  return record7;
}
function number3(value, path3, min = 0, max = 1e9, integer5 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer5 && !Number.isSafeInteger(value)) bad3(path3, `expected ${integer5 ? "an integer" : "a number"} between ${min} and ${max}`);
  return value;
}
function text(value, path3, max = 4096) {
  if (typeof value !== "string" || value.length < 1 || value.length > max) bad3(path3, "invalid text");
  return value;
}
function identifier(value, path3) {
  const id6 = text(value, path3, 96);
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(id6) || ["constructor", "prototype", "__proto__"].includes(id6)) bad3(path3, "invalid identifier");
  return id6;
}
function choice3(value, path3, values) {
  if (typeof value !== "string" || !values.includes(value)) bad3(path3, "unknown value");
  return value;
}
function flag3(value, path3) {
  if (typeof value !== "boolean") bad3(path3, "expected a boolean");
  return value;
}
function list3(value, path3, max, min = 0) {
  if (!Array.isArray(value) || value.length < min || value.length > max) bad3(path3, "invalid array length");
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) bad3(path3, "array contains gaps");
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
      for (const key of Object.getOwnPropertyNames(value2)) {
        if (!("value" in Object.getOwnPropertyDescriptor(value2, key))) bad3("package", "accessors are forbidden");
        if (key !== "length") {
          const index2 = Number(key);
          if (!Number.isSafeInteger(index2) || index2 < 0 || index2 >= value2.length || String(index2) !== key) bad3("package", "invalid array properties");
        }
      }
      result = Array.from({ length: value2.length }, (_, index2) => {
        const property = Object.getOwnPropertyDescriptor(value2, String(index2));
        if (!property || !("value" in property)) bad3("package", "accessors and gaps are forbidden");
        return copy(property.value, depth + 1);
      });
    } else {
      if (Object.getPrototypeOf(value2) !== Object.prototype || Object.getOwnPropertySymbols(value2).length) bad3("package", "expected a plain object");
      const record7 = {};
      for (const key of Object.keys(value2)) {
        if (["constructor", "prototype", "__proto__"].includes(key)) bad3("package", "unsafe property");
        const property = Object.getOwnPropertyDescriptor(value2, key);
        if (!("value" in property)) bad3("package", "accessors are forbidden");
        if (property.value !== void 0) record7[key] = copy(property.value, depth + 1);
      }
      result = record7;
    }
    ancestors.delete(value2);
    return result;
  };
  const value = copy(input, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > (limits.maxBytes ?? 2 * 1024 * 1024)) bad3("package", "package exceeds its size limit");
  return value;
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
  const value = scenarioJson(raw);
  const s = object3(value, "definition", ["schemaVersion", "id", "title", "briefing", "successText", "failureText", "faction", "opponent", "seed", "army", "objectives", "events", "rules"], ["content", "map", "escort", "stealth", "boss", "requiredActions"]);
  if (s.schemaVersion !== 1) bad3("schemaVersion", "unsupported version");
  identifier(s.id, "id");
  for (const key of ["title", "briefing", "successText", "failureText"]) text(s[key], key);
  const content = s.content === void 0 ? void 0 : options.historicalContent ? decodeHistoricalContentBundle(s.content) : decodeContentBundle(s.content);
  const factions = contentFactions(content);
  if (content) s.content = content;
  const faction = choice3(s.faction, "faction", Object.keys(factions));
  const opponent = choice3(s.opponent, "opponent", Object.keys(factions));
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
      const path3 = `map.resources[${i}]`, r = object3(resource, path3, ["x", "y", "kind", "amount", "maxAmount"], ["level"]);
      coordinates2(r, path3);
      choice3(r.kind, `${path3}.kind`, ["wood", "ore", "crystal"]);
      const max = number3(r.maxAmount, `${path3}.maxAmount`, 1, 1e7);
      number3(r.amount, `${path3}.amount`, 0, max);
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
  function coordinates2(record7, path3) {
    number3(record7.x, `${path3}.x`, 0.5, map.width - 0.5);
    number3(record7.y, `${path3}.y`, 0.5, map.height - 0.5);
    if (record7.level !== void 0) number3(record7.level, `${path3}.level`, 0, (map.world?.levels.length ?? 1) - 1, true);
  }
  function point5(v, path3) {
    coordinates2(object3(v, path3, ["x", "y"], ["level"]), path3);
  }
  const actorLabels = /* @__PURE__ */ new Set(), actorByLabel = /* @__PURE__ */ new Map();
  function actor3(v, path3) {
    const a = object3(v, path3, ["label", "side", "kind", "role", "x", "y"], ["hp", "order", "definitionId", "level"]);
    const label = identifier(a.label, `${path3}.label`);
    if (actorLabels.has(label)) bad3(`${path3}.label`, "duplicate actor label");
    actorLabels.add(label);
    actorByLabel.set(label, a);
    number3(a.side, `${path3}.side`, 0, 1, true);
    const kind = choice3(a.kind, `${path3}.kind`, ["unit", "building"]);
    const role = choice3(a.role, `${path3}.role`, kind === "unit" ? unitRoles2 : buildingRoles2);
    coordinates2(a, path3);
    const def = factions[a.side === 0 ? faction : opponent];
    const id6 = a.definitionId;
    if (id6 !== void 0 && (typeof id6 !== "string" || id6.length > 100 || !/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(id6))) bad3(`${path3}.definitionId`, "expected a registered definition ID");
    const roster = kind === "unit" ? def.unitDefinitions ?? Object.values(def.units) : def.buildingDefinitions ?? Object.values(def.buildings);
    const definition2 = id6 === void 0 ? kind === "unit" ? def.units[role] : def.buildings[role] : roster.find((d) => d.id === id6);
    if (!definition2 || definition2.role !== role) bad3(`${path3}.definitionId`, "definition is absent from the actor faction or has another kind or role");
    if (a.hp !== void 0) number3(a.hp, `${path3}.hp`, 1, definition2.hp);
    const radius2 = kind === "building" ? definition2.size / 2 : 0.27;
    for (let y = Math.floor(a.y - radius2); y <= Math.floor(a.y + radius2); y++) for (let x = Math.floor(a.x - radius2); x <= Math.floor(a.x + radius2); x++) {
      const terrain2 = map.world?.levels[a.level ?? 0].terrain ?? map.terrain;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || !TERRAIN[terrain2[y * map.width + x]].walkable) bad3(path3, "actor is on impassable terrain");
    }
  }
  list3(s.army, "army", 256, 1).forEach((v, i) => actor3(v, `army[${i}]`));
  const events = list3(s.events, "events", 128);
  for (const [i, event] of events.entries()) {
    const e = object3(event, `events[${i}]`, ["id", "when", "actions"], ["repeat"]);
    list3(e.actions, `events[${i}].actions`, 16, 1).forEach((a, j) => {
      if (a && typeof a === "object" && a.type === "spawn") {
        if (e.repeat !== void 0) bad3(`events[${i}]`, "repeated spawn labels are ambiguous; author separate waves");
        const spawn2 = object3(a, `events[${i}].actions[${j}]`, ["type", "actors"]);
        list3(spawn2.actors, `events[${i}].actors`, 128, 1).forEach((v, k) => actor3(v, `events[${i}].actors[${k}]`));
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
  function reference(v, path3) {
    if (!actorLabels.has(identifier(v, path3))) bad3(path3, "unknown actor label");
  }
  function condition2(v, path3, depth = 0) {
    if (depth > 8) bad3(path3, "condition nesting exceeds eight levels");
    const c = object3(v, path3, ["type"], ["actor", "point", "radius", "seconds", "key", "op", "value", "side", "buildings", "conditions", "condition"]);
    switch (c.type) {
      case "alive":
      case "dead":
        object3(v, path3, ["type", "actor"]);
        reference(c.actor, `${path3}.actor`);
        break;
      case "at":
        object3(v, path3, ["type", "actor", "point", "radius"]);
        reference(c.actor, `${path3}.actor`);
        point5(c.point, `${path3}.point`);
        number3(c.radius, `${path3}.radius`, 0.5, 32);
        break;
      case "time":
        object3(v, path3, ["type", "seconds"]);
        number3(c.seconds, `${path3}.seconds`, 0, 7200);
        break;
      case "variable":
        object3(v, path3, ["type", "key", "op", "value"]);
        identifier(c.key, `${path3}.key`);
        choice3(c.op, `${path3}.op`, ["eq", "gte", "lte"]);
        number3(c.value, `${path3}.value`, -1e9, 1e9);
        break;
      case "cleared":
        object3(v, path3, ["type", "side"], ["buildings"]);
        number3(c.side, `${path3}.side`, 0, 1, true);
        if (c.buildings !== void 0) flag3(c.buildings, `${path3}.buildings`);
        break;
      case "all":
      case "any":
        object3(v, path3, ["type", "conditions"]);
        list3(c.conditions, `${path3}.conditions`, 16, 1).forEach((child, i) => condition2(child, `${path3}.conditions[${i}]`, depth + 1));
        break;
      case "not":
        object3(v, path3, ["type", "condition"]);
        condition2(c.condition, `${path3}.condition`, depth + 1);
        break;
      default:
        bad3(`${path3}.type`, "unknown condition");
    }
  }
  function order3(v, path3) {
    const o = object3(v, path3, ["type"], ["x", "y", "actor", "level"]);
    switch (o.type) {
      case "move":
      case "attackMove":
        object3(v, path3, ["type", "x", "y"], ["level"]);
        coordinates2(o, path3);
        break;
      case "attack":
        object3(v, path3, ["type", "actor"]);
        reference(o.actor, `${path3}.actor`);
        break;
      case "stop":
      case "hold":
      case "ability":
        object3(v, path3, ["type"]);
        break;
      default:
        bad3(`${path3}.type`, "unknown order");
    }
  }
  for (const [label, a] of actorByLabel) if (a.order) order3(a.order, `actor.${label}.order`);
  const objectiveIds = /* @__PURE__ */ new Set();
  list3(s.objectives, "objectives", 32, 1).forEach((v, i) => {
    const p = `objectives[${i}]`, o = object3(v, p, ["id", "text", "success"], ["failure", "optional"]), id6 = identifier(o.id, `${p}.id`);
    if (objectiveIds.has(id6)) bad3(`${p}.id`, "duplicate objective");
    objectiveIds.add(id6);
    text(o.text, `${p}.text`);
    condition2(o.success, `${p}.success`);
    if (o.failure !== void 0) condition2(o.failure, `${p}.failure`);
    if (o.optional !== void 0) flag3(o.optional, `${p}.optional`);
  });
  if (s.objectives.every((o) => o.optional)) bad3("objectives", "at least one objective must be required");
  const eventIds2 = /* @__PURE__ */ new Set();
  for (const [i, v] of events.entries()) {
    const p = `events[${i}]`, e = v, id6 = identifier(e.id, `${p}.id`);
    if (eventIds2.has(id6)) bad3(`${p}.id`, "duplicate event");
    eventIds2.add(id6);
    condition2(e.when, `${p}.when`);
    if (e.repeat !== void 0) {
      const r = object3(e.repeat, `${p}.repeat`, ["seconds", "count"]);
      number3(r.seconds, `${p}.repeat.seconds`, 1, 3600);
      number3(r.count, `${p}.repeat.count`, 1, 256, true);
    }
    e.actions.forEach((v2, j) => {
      const path3 = `${p}.actions[${j}]`, a = object3(v2, path3, ["type"], ["actors", "order", "key", "value", "text", "speaker", "side", "resources", "outcome", "reason", "allied"]);
      switch (a.type) {
        case "spawn":
          object3(v2, path3, ["type", "actors"]);
          break;
        case "alliance":
          object3(v2, path3, ["type", "allied"]);
          flag3(a.allied, `${path3}.allied`);
          break;
        case "order":
          object3(v2, path3, ["type", "actors", "order"]);
          list3(a.actors, `${path3}.actors`, 256, 1).forEach((label, k) => reference(label, `${path3}.actors[${k}]`));
          order3(a.order, `${path3}.order`);
          break;
        case "set":
        case "add":
          object3(v2, path3, ["type", "key", "value"]);
          identifier(a.key, `${path3}.key`);
          number3(a.value, `${path3}.value`, -1e6, 1e6);
          break;
        case "message":
          object3(v2, path3, ["type", "text"], ["speaker"]);
          text(a.text, `${path3}.text`);
          if (a.speaker !== void 0) text(a.speaker, `${path3}.speaker`, 96);
          break;
        case "reward":
          object3(v2, path3, ["type", "side", "resources"]);
          number3(a.side, `${path3}.side`, 0, 1, true);
          resources2(a.resources, `${path3}.resources`);
          break;
        case "finish":
          object3(v2, path3, ["type", "outcome", "reason"]);
          choice3(a.outcome, `${path3}.outcome`, ["won", "lost"]);
          text(a.reason, `${path3}.reason`);
          break;
        default:
          bad3(`${path3}.type`, "unknown action");
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
  return value;
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
var distance7 = (a, b) => (a.level ?? 0) === (b.level ?? 0) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var clone = (value) => JSON.parse(JSON.stringify(value));
var actor = (session, label) => session.state.entities.find((e) => e.id === session.runtime.labels[label] && e.hp > 0);
var visible2 = (state, side2, point5) => !!state.visible[side2]?.has(fogKey(state, point5));
var variable = (session, key) => session.runtime.variables[key] ?? 0;
function addVariable(session, key, value) {
  session.runtime.variables[key] = Math.max(-1e9, Math.min(1e9, variable(session, key) + value));
}
function scenarioCondition(session, condition2) {
  switch (condition2.type) {
    case "alive":
      return !!actor(session, condition2.actor);
    case "dead":
      return Object.hasOwn(session.runtime.labels, condition2.actor) && !actor(session, condition2.actor);
    case "at": {
      const entity = actor(session, condition2.actor);
      return !!entity && distance7(entity, condition2.point) <= condition2.radius;
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
function message(session, text5, speaker) {
  const entry = { time: session.state.time, text: text5, ...speaker ? { speaker } : {} };
  session.runtime.messages.push(entry);
  if (session.runtime.messages.length > 128) session.runtime.messages.shift();
  const start = session.state.starts[0];
  session.state.events.push({ type: "message", side: 0, ...start, text: speaker ? `${speaker}: ${text5}` : text5 });
}
function finish2(session, outcome, reason) {
  if (session.runtime.outcome !== "playing") return;
  session.runtime.outcome = outcome;
  session.runtime.reason = reason;
  session.state.winner = outcome === "won" ? 0 : 1;
  session.state.winningTeam = session.state.teams[session.state.winner];
  session.state.draw = false;
  message(session, outcome === "won" ? session.definition.successText : session.definition.failureText);
}
function updatePopulation(state) {
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
  updatePopulation(session.state);
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
function action(session, value) {
  switch (value.type) {
    case "spawn":
      spawnActors(session, value.actors);
      break;
    case "order":
      orderActors(session, value.actors, value.order);
      break;
    case "set":
      session.runtime.variables[value.key] = value.value;
      break;
    case "add":
      addVariable(session, value.key, value.value);
      break;
    case "message":
      message(session, value.text, value.speaker);
      break;
    case "reward": {
      const player = session.state.players[value.side];
      for (const key of ["wood", "ore", "crystal"]) player[key] = Math.min(1e9, player[key] + value.resources[key]);
      break;
    }
    case "alliance":
      session.state.teams[1] = value.allied ? session.state.teams[0] : session.state.teams[0] === 0 ? 1 : 0;
      refreshVisibility(session.state);
      break;
    case "finish":
      finish2(session, value.outcome, value.reason);
      break;
  }
}
function evaluateScenario(session) {
  requireScenarioRules(session);
  if (session.runtime.outcome !== "playing") return;
  const commander2 = actor(session, "commander");
  if (commander2) session.runtime.variables["equipment.commander"] = Object.values(commander2.equipment ?? {}).filter((id6) => session.state.specialists?.artifacts.some((item) => item.id === id6 && item.owner === commander2.side && item.holder === commander2.id && !item.position)).length;
  let budget = MAX_SCENARIO_ACTIONS_PER_TICK;
  for (const trigger of session.definition.events) {
    const prior = session.runtime.triggers[trigger.id], max = trigger.repeat?.count ?? 1;
    if ((prior?.count ?? 0) >= max || prior && session.state.time - prior.lastTime + 1e-9 < (trigger.repeat?.seconds ?? Infinity) || !scenarioCondition(session, trigger.when)) continue;
    if (budget < trigger.actions.length) break;
    budget -= trigger.actions.length;
    session.runtime.triggers[trigger.id] = { count: (prior?.count ?? 0) + 1, lastTime: session.state.time };
    for (const value of trigger.actions) {
      action(session, value);
      if (session.runtime.outcome !== "playing") return;
    }
  }
  for (const objective of session.definition.objectives) if (objective.failure && scenarioCondition(session, objective.failure)) {
    finish2(session, "lost", objective.text);
    return;
  }
  for (const objective of session.definition.objectives) if (!session.runtime.completed.includes(objective.id) && scenarioCondition(session, objective.success)) {
    session.runtime.completed.push(objective.id);
    message(session, `Objective completed: ${objective.text}`);
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
  if (distance7(convoy, destination) <= definition2.radius) {
    progress.checkpoint++;
    progress.moving = false;
    session.runtime.variables["escort.checkpoints"] = progress.checkpoint;
    message(session, `Convoy reached checkpoint ${progress.checkpoint} of ${definition2.route.length}.`);
    if (progress.checkpoint >= definition2.route.length) return;
  }
  const guarded = session.state.entities.some((e) => e.hp > 0 && e.id !== convoy.id && e.kind === "unit" && e.role !== "worker" && !e.illusion && isAllied(session.state, e.side, convoy.side) && distance7(e, convoy) <= definition2.escortRadius);
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
  const length2 = distance7(from, to), steps = Math.ceil(length2 * 3);
  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    if (terrainAt(state, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, from.level ?? 0) === "rock") return false;
  }
  return true;
}
function guardDetects(session, guard, target) {
  const stealth = session.definition.stealth;
  if (!stealth || !isHostile(session.state, guard.side, target.side) || !visible2(session.state, guard.side, target) || distance7(guard, target) > stealth.radius || !detectionLine(session.state, guard, target)) return false;
  const dx = target.x - guard.x, dy = target.y - guard.y, length2 = length2D(dx, dy);
  const facing = DIRECTIONS_32[guard.facing * 4];
  return length2 === 0 || dx * facing[0] + dy * facing[1] >= length2 * coneCosine(stealth.coneDegrees);
}
function advanceStealth(session, dt) {
  const definition2 = session.definition.stealth;
  if (!definition2) return;
  const progress = session.runtime.stealth;
  for (const label of definition2.guards) {
    const guard = actor(session, label);
    if (!guard) continue;
    const illusion = session.state.entities.filter((e) => e.hp > 0 && e.illusion && guardDetects(session, guard, e)).sort((a, b) => distance7(a, guard) - distance7(b, guard) || a.id - b.id)[0];
    if (illusion) {
      if (guard.order.type !== "attack" || guard.order.target !== illusion.id) {
        scriptedCommand(session.state, guard.side, { type: "attack", ids: [guard.id], target: illusion.id });
        message(session, "A patrol turned toward an illusion.");
        addVariable(session, "stealth.diversions", 1);
      }
      progress.distractedUntil[label] = session.state.time + 1;
    }
    if ((progress.distractedUntil[label] ?? 0) > session.state.time) continue;
    const patrol = definition2.patrols.find((p) => p.actor === label);
    if (patrol && !progress.detected.length) {
      let index2 = progress.patrol[label] ?? 0;
      if (distance7(guard, patrol.route[index2]) <= 0.65) {
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
        progress.detected = progress.detected.filter((id6) => id6 !== label);
        message(session, "The patrol lost the infiltrator and resumed its route.");
      }
      continue;
    }
    if (progress.exposure[label] + 1e-9 < definition2.detectionSeconds) continue;
    progress.detected.push(label);
    progress.alarms++;
    session.runtime.variables["stealth.alarms"] = progress.alarms;
    message(session, `Alarm ${progress.alarms}: ${label} was detected.`);
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
    message(session, `${definition2.name}: ${entered.name}.`);
    spawnActors(session, entered.adds);
  }
  const mechanics = definition2.phases[progress.phase];
  if (progress.telegraph) {
    const warning = progress.telegraph;
    if (!warning.interrupted && warning.hpAtStart - boss.hp >= definition2.phases[warning.phase].interruptDamage) {
      warning.interrupted = true;
      progress.interrupted++;
      session.runtime.variables["boss.interrupts"] = progress.interrupted;
      message(session, `${definition2.name}'s attack was interrupted.`);
    }
    if (session.state.time + 1e-9 < warning.resolveAt) return;
    if (!warning.interrupted) {
      const victims = session.state.entities.filter((e) => e.hp > 0 && isHostile(session.state, e.side, boss.side) && e.kind === "unit" && distance7(e, warning) <= warning.radius);
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
  const targets = session.state.entities.filter((e) => e.hp > 0 && e.side === 0 && e.kind === "unit" && !e.illusion && visible2(session.state, boss.side, e)).sort((a, b) => distance7(a, boss) - distance7(b, boss) || a.id - b.id);
  if (!targets.length) {
    progress.nextAttack = session.state.time + 1;
    return;
  }
  const target = targets[0];
  progress.telegraph = { x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level }, radius: mechanics.radius, resolveAt: session.state.time + mechanics.warningSeconds, source: boss.id, phase: progress.phase, hpAtStart: boss.hp, interrupted: false };
  message(session, `${definition2.name} marks (${target.x.toFixed(1)}, ${target.y.toFixed(1)}). Move outside ${mechanics.radius} tiles before ${mechanics.warningSeconds} seconds, or interrupt with ${mechanics.interruptDamage} damage.`);
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
      const dead = session.state.entities.find((e) => e.id === event.source);
      if (dead?.kind === "unit" && !dead.illusion && !dead.raised) addVariable(session, `deaths.${dead.side}`, 1);
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
    } catch (error2) {
      console.error("Scenario command observer failed", error2);
    }
  }
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
  const finite2 = (n, min = 0, max = 1e9, integer5 = false) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max && (!integer5 || Number.isSafeInteger(n));
  if (!finite2(runtime2.lastEvaluatedTick, 0, state.tick, true)) fail2("evaluated tick");
  const record7 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
  const exact = (value, keys4) => record7(value) && keys4.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys4.includes(key));
  const counters = (value, max = 1e9, negative = false) => record7(value) && Object.keys(value).length <= 2048 && Object.entries(value).every(([key, n]) => /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(key) && finite2(n, negative ? -1e9 : 0, max));
  const actors = [...definition2.army, ...definition2.events.flatMap((e) => e.actions.flatMap((a) => a.type === "spawn" ? a.actors : [])), ...definition2.boss?.phases.flatMap((p) => p.adds) ?? []];
  const labels = new Set(actors.map((a) => a.label));
  if (!record7(runtime2.labels) || Object.entries(runtime2.labels).some(([label, id6]) => !labels.has(label) || !finite2(id6, 1, state.nextId - 1, true)) || new Set(Object.values(runtime2.labels)).size !== Object.values(runtime2.labels).length || definition2.army.some((a) => !Object.hasOwn(runtime2.labels, a.label))) fail2("actor references");
  for (const [label, id6] of Object.entries(runtime2.labels)) {
    const e = state.entities.find((e2) => e2.id === id6), a = actors.find((a2) => a2.label === label);
    if (e && (e.side !== a.side || e.kind !== a.kind || e.role !== a.role || a.definitionId !== void 0 && e.definitionId !== a.definitionId)) fail2("actor ownership or definition changed");
  }
  if (!counters(runtime2.variables, 1e9, true) || !counters(runtime2.commandCounts) || !finite2(runtime2.reinforcementRemaining, 0, definition2.rules.reinforcementBudget, true)) fail2("variables or reinforcement budget");
  if (!record7(runtime2.triggers)) fail2("trigger record");
  for (const [id6, entry] of Object.entries(runtime2.triggers)) {
    const e = definition2.events.find((e2) => e2.id === id6);
    if (!e || !exact(entry, ["count", "lastTime"]) || !finite2(entry.count, 1, e.repeat?.count ?? 1, true) || !finite2(entry.lastTime, 0, state.time)) fail2("trigger schedule");
  }
  if (!Array.isArray(runtime2.completed) || runtime2.completed.some((id6) => !definition2.objectives.some((o) => o.id === id6)) || new Set(runtime2.completed).size !== runtime2.completed.length) fail2("objective progress");
  if (!Array.isArray(runtime2.messages) || runtime2.messages.length > 128 || runtime2.messages.some((m) => !record7(m) || Object.keys(m).some((k) => !["time", "text", "speaker"].includes(k)) || !finite2(m.time, 0, state.time) || typeof m.text !== "string" || m.text.length > 4096 || m.speaker !== void 0 && (typeof m.speaker !== "string" || m.speaker.length > 96))) fail2("messages");
  if (!exact(runtime2.escort, ["checkpoint", "moving"]) || !finite2(runtime2.escort.checkpoint, 0, definition2.escort?.route.length ?? 0, true) || typeof runtime2.escort.moving !== "boolean") fail2("escort progress");
  const stealth = runtime2.stealth;
  if (!exact(stealth, ["alarms", "exposure", "detected", "patrol", "distractedUntil"]) || !finite2(stealth.alarms, 0, definition2.stealth?.alarmLimit ?? 0, true) || !counters(stealth.exposure, 10) || !counters(stealth.patrol, 31) || !counters(stealth.distractedUntil) || !Array.isArray(stealth.detected) || stealth.detected.some((label) => !definition2.stealth?.infiltrators.includes(label)) || new Set(stealth.detected).size !== stealth.detected.length) fail2("stealth progress");
  if (Object.keys(stealth.patrol).some((label) => {
    const p = definition2.stealth?.patrols.find((p2) => p2.actor === label);
    return !p || !finite2(stealth.patrol[label], 0, p.route.length - 1, true);
  })) fail2("patrol waypoint");
  const boss = runtime2.boss;
  if (!exact(boss, ["phase", "nextAttack", "telegraph", "phasesEntered", "interrupted", "hits", "dodged"]) || !finite2(boss.phase, -1, (definition2.boss?.phases.length ?? 0) - 1, true) || !finite2(boss.nextAttack) || !Array.isArray(boss.phasesEntered) || boss.phasesEntered.some((n, i) => n !== i || n > boss.phase) || !finite2(boss.interrupted, 0, 1e6, true) || !finite2(boss.hits, 0, 1e6, true) || !finite2(boss.dodged, 0, 1e6, true)) fail2("boss progress");
  if (boss.telegraph !== null) {
    const t = boss.telegraph;
    const keys4 = ["x", "y", "radius", "resolveAt", "source", "phase", "hpAtStart", "interrupted", ...t.level === void 0 ? [] : ["level"]];
    if (!definition2.boss || !exact(t, keys4) || !finite2(t.x, 0, state.width) || !finite2(t.y, 0, state.height) || t.level !== void 0 && !finite2(t.level, 0, (state.world?.levels.length ?? 1) - 1, true) || !finite2(t.radius, 1, 16) || !finite2(t.resolveAt, 0, state.time + 10) || t.source !== runtime2.labels[definition2.boss.actor] || !finite2(t.phase, 0, boss.phase, true) || !finite2(t.hpAtStart, 0, definition2.boss.health) || typeof t.interrupted !== "boolean") fail2("boss telegraph");
  }
}

// src/core/economy-cargo.ts
var EPSILON = 1e-8;
var active = (entity) => entity.hp > 0 && !entity.illusion && !entity.raised && !entity.tactics?.siegeCrew?.uncrewed;
var cargoFor = (economy, id6) => economy.cargo.find((cargo) => cargo.entityId === id6);
var entityFor = (s, id6) => s.entities.find((entity) => entity.id === id6 && entity.hp > 0);
var validAmount = (amount, max = 1e4) => Number.isFinite(amount) && amount > 0 && amount <= max;
var validCost = (stock) => !!stock && RESOURCE_KINDS.every((kind) => Number.isFinite(stock[kind]) && stock[kind] >= 0) && validAmount(costTotal(stock));
var completeBuilding = (entity) => entity.kind === "building" && entity.progress === 1 && (entity.role === "hq" || entity.role === "depot");
var capacityFor = (economy, entity) => economy.caravans.includes(entity.id) ? ECONOMY_RULES.caravan.capacity : entity.role === "worker" ? 18 : ECONOMY_RULES.raid.capacity;
function marketCurrency(kind) {
  return kind === "wood" ? "ore" : "wood";
}
var priceRatio = (market, kind) => 1 + (ECONOMY_RULES.market.stock - market.stock[kind] + market.demand[kind]) / ECONOMY_RULES.market.stock;
var clampPrice = (value) => Math.max(0.5, Math.min(3, value));
var basePrice = (kind) => ECONOMY_RULES.market.basePrices[kind] / (kind === "wood" ? ECONOMY_RULES.market.basePrices.ore : 1);
function marketPrices(market) {
  return { wood: basePrice("wood") * clampPrice(priceRatio(market, "wood")), ore: basePrice("ore") * clampPrice(priceRatio(market, "ore")), crystal: basePrice("crystal") * clampPrice(priceRatio(market, "crystal")) };
}
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
  const total = integratePrice(initial, -2 / reserve, pressured) + integratePrice(initial - 2 * pressured / reserve, -1 / reserve, amount - pressured);
  return basePrice(kind) * ECONOMY_RULES.market.sellFactor * total;
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
function permittedStorage(s, side2, id6, hooks) {
  const entity = entityFor(s, id6);
  return entity && completeBuilding(entity) && hooks.allied(s, side2, entity.side) && (entity.side === side2 || hooks.visible(s, side2, entity)) ? entity : void 0;
}
function remainingCapacity(economy, id6) {
  const warehouse = economy.structures.find((item) => item.entityId === id6 && item.kind === "warehouse");
  return warehouse ? Math.max(0, warehouse.capacity - costTotal(warehouse.stock)) : Number.POSITIVE_INFINITY;
}
function nearestStorage(s, entity, economy) {
  return s.entities.filter((storage) => storage.hp > 0 && storage.side === entity.side && sameLevel2(entity, storage) && completeBuilding(storage) && remainingCapacity(economy, storage.id) > EPSILON).sort((a, b) => distance(entity, a) - distance(entity, b) || a.id - b.id)[0];
}
function createCargo(entity, economy, origin) {
  let cargo = cargoFor(economy, entity.id);
  if (!cargo) {
    cargo = { entityId: entity.id, stock: zeroCost(), capacity: capacityFor(economy, entity), origin, tradeValue: 0 };
    economy.cargo.push(cargo);
  }
  return cargo;
}
function ownUnit(s, side2, id6) {
  const entity = entityFor(s, id6);
  return entity && entity.side === side2 && entity.kind === "unit" && active(entity) ? entity : void 0;
}
function canLoad(entity, economy) {
  return entity.carried <= EPSILON && costTotal(cargoFor(economy, entity.id)?.stock ?? zeroCost()) <= EPSILON;
}
function routeCommand(s, side2, entity, sourceId, targetId, stock, repeat, origin, economy, hooks, contract) {
  const source2 = permittedStorage(s, side2, sourceId, hooks), target = contract ?? permittedStorage(s, side2, targetId, hooks);
  if (!source2 || source2.side !== side2 || !target || !sameLevel2(entity, source2) || !sameLevel2(source2, target) || sourceId === targetId || !validCost(stock) || costTotal(stock) > capacityFor(economy, entity) + EPSILON || !canLoad(entity, economy)) return false;
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
    const unit4 = s.entities.find((entity) => entity.side === side2 && entity.kind === "unit" && active(entity) && distance(entity, market) <= 3);
    if (!unit4) return false;
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
    economyMessage(s, unit4, `${command.direction === "buy" ? "Bought" : "Sold"} ${command.amount} ${command.kind} for ${quote.toFixed(1)} ${currency}.`, market.id);
    return true;
  }
  if (command.type === "acceptContract") {
    const contract = economy.contracts.find((item) => item.id === command.id && item.status === "open" && item.deadline > s.time);
    if (!contract || !hooks.visible(s, side2, contract) || !availableContractReward(economy, contract)) return false;
    const unit4 = s.entities.find((entity) => entity.side === side2 && entity.kind === "unit" && active(entity) && distance(entity, contract) <= 3);
    if (!unit4) return false;
    contract.side = side2;
    contract.status = "accepted";
    economyMessage(s, unit4, `Accepted delivery of ${contract.amount} ${contract.kind}.`, contract.id);
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
    for (const id6 of new Set(command.ids)) {
      const entity = ownUnit(s, side2, id6);
      if (!entity || !Number.isFinite(distance(entity, target)) || !canLoad(entity, economy) || economy.caravans.includes(entity.id) || (collecting ? entity.role !== "worker" : entity.role === "worker")) continue;
      startTask(s, entity, { entityId: id6, kind: collecting ? "collect" : "raid", targetId: command.target, progress: 0 }, economy, hooks);
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
    const market = economy.markets.filter((item) => sameLevel2(target, item) && item.stock.crystal > EPSILON).sort((a, b) => distance(target, a) - distance(target, b) || a.id - b.id)[0];
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
  economy.deathClaims = economy.deathClaims.filter((id6) => retainedIds.has(id6));
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
  if (costTotal(dropped) > EPSILON) economy.salvage.push({ id: s.nextId++, x: entity.x, y: entity.y, level: levelOf2(entity), stock: dropped, expiresAt: s.time + ECONOMY_RULES.salvage.expiresSeconds, owner: entity.side, kind: "cargo" });
  if (paid && !entity.illusion && !entity.raised && (entity.kind === "building" || entity.role === "siege")) {
    const eligible3 = zeroCost(), fraction = 0.25 * Math.max(0.1, Math.min(1, entity.progress)), scale = Math.min(1, 350 / Math.max(EPSILON, costTotal(paid.stock) * fraction));
    for (const kind of RESOURCE_KINDS) eligible3[kind] = paid.stock[kind] * fraction * scale;
    if (costTotal(eligible3) > EPSILON) economy.salvage.push({ id: s.nextId++, x: entity.x, y: entity.y, level: levelOf2(entity), stock: eligible3, expiresAt: s.time + ECONOMY_RULES.salvage.expiresSeconds, owner: entity.side, kind: "salvage" });
  }
  if (structure) structure.stock = zeroCost();
  economy.structures = economy.structures.filter((item) => item.entityId !== entity.id);
  economy.specializations = economy.specializations.filter((item) => item.entityId !== entity.id);
  entity.carried = 0;
  economy.cargo = economy.cargo.filter((item) => item.entityId !== entity.id);
  cancelTasks(economy, entity.id);
  economy.caravans = economy.caravans.filter((id6) => id6 !== entity.id);
  economy.paidCosts = economy.paidCosts.filter((item) => item.entityId !== entity.id);
  economy.workerWarehouses = economy.workerWarehouses.filter((item) => item.entityId !== entity.id && item.warehouseId !== entity.id);
  for (const recruit of economy.recruits) if (recruit.producerId === entity.id && s.players[recruit.side]) addCost(s.players[recruit.side], ECONOMY_RULES.caravan.cost);
  economy.recruits = economy.recruits.filter((recruit) => recruit.producerId !== entity.id);
}

// src/core/economy.ts
var own = (s, side2, id6) => s.entities.find((e) => e.id === id6 && e.side === side2 && e.hp > 0 && !e.illusion);
var econDef = (e) => e.definitionId;
function markDefinition(e, id6) {
  e.definitionId = id6;
}
function terrainFor(s, p) {
  const world = s.world;
  const terrain2 = levelOf2(p) === 0 ? s.terrain : world?.levels[levelOf2(p)]?.terrain;
  return TERRAIN[terrain2?.[Math.floor(p.y) * s.width + Math.floor(p.x)] ?? "rock"];
}
var canWalk = (s, p) => walkable(s, p.x, p.y, levelOf2(p));
function economyUnitDefinition(s, e) {
  return economicState(s)?.caravans.includes(e.id) || econDef(e) === "economy:caravan" ? ECONOMY_CARAVAN : void 0;
}
function recordEconomyPaid(s, e, stock) {
  if (e.illusion || e.raised) return;
  const economy = ensureEconomy(s), record7 = economy.paidCosts.find((item) => item.entityId === e.id);
  if (record7) record7.stock = { ...stock };
  else economy.paidCosts.push({ entityId: e.id, stock: { ...stock } });
}
function initializeEconomySites(s, sites) {
  const economy = ensureEconomy(s);
  if (economy.markets.length) return;
  const locations = sites?.length ? sites : [{ x: s.width / 2 - 6, y: s.height / 2 }, { x: s.width / 2 + 6, y: s.height / 2 }];
  for (const site of locations.slice(0, 16)) {
    const position2 = { x: site.x, y: site.y, level: levelOf2(site) }, point5 = openDestination(s, position2, position2);
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
  const economy = ensureEconomy(s), workers = chooseWork(s, side2, c.ids, economy);
  if (!workers.length || economy.structures.length >= 1024) return false;
  let p, resource;
  const level2 = c.kind === "warehouse" ? c.level ?? levelOf2(workers[0]) : levelOf2(s.resources.find((r) => r.id === c.target) ?? workers[0]);
  if (workers.some((w) => levelOf2(w) !== level2)) return false;
  if (c.kind === "warehouse") p = { x: c.x, y: c.y, level: level2 };
  else {
    resource = s.resources.find((r) => r.id === c.target && r.kind === (c.kind === "extractor" ? "crystal" : "ore") && hooks.visible(s, side2, r));
    if (!resource || c.kind === "deep-mine" && (resource.amount > 1e-8 || resource.maxAmount <= 0 || economy.deepSites.includes(resource.id)) || economy.structures.some((item) => item.kind === c.kind && item.resourceId === resource.id)) return false;
    const candidates = [];
    for (const r of [3.2, 4, 5]) for (let i = 0; i < 16; i++) {
      const [dx, dy] = DIRECTIONS_32[i * 2], candidate2 = { x: Math.floor(resource.x + dx * r) + 0.5, y: Math.floor(resource.y + dy * r) + 0.5, level: level2 };
      if (hooks.canPlace(s, side2, candidate2.x, candidate2.y, level2)) candidates.push(candidate2);
    }
    const candidate = candidates.sort((a, b) => distance(workers[0], a) - distance(workers[0], b))[0];
    if (!candidate) return false;
    p = candidate;
  }
  if (!hooks.canPlace(s, side2, p.x, p.y, level2)) return false;
  const def = ECONOMY_BUILDINGS[c.kind], shoves = [];
  for (const unit4 of s.entities.filter((e) => e.hp > 0 && e.kind === "unit" && sameLevel2(e, p) && Math.abs(e.x - p.x) < def.size / 2 + 0.35 && Math.abs(e.y - p.y) < def.size / 2 + 0.35)) {
    let destination;
    for (let ring = def.size / 2 + 1; ring <= def.size / 2 + 5 && !destination; ring += 0.5) for (let i = 0; i < 32; i++) {
      const [dx, dy] = DIRECTIONS_32[i], point5 = { x: p.x + dx * ring, y: p.y + dy * ring, level: level2 };
      if ((Math.abs(point5.x - p.x) >= def.size / 2 + 0.3 || Math.abs(point5.y - p.y) >= def.size / 2 + 0.3) && canWalk(s, point5)) {
        destination = point5;
        break;
      }
    }
    if (!destination) return false;
    shoves.push({ entity: unit4, point: destination });
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
  for (const worker of workers) {
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
    const worker = chooseWork(s, side2, c.ids, economy)[0], point5 = { x: c.x, y: c.y, level: c.level ?? (worker ? levelOf2(worker) : 0) }, retainedGroves = economy.groves.filter((g) => !g.burned || economy.tasks.some((task) => task.targetId === g.id));
    if (!worker || levelOf2(worker) !== point5.level || retainedGroves.length >= 1600 || economy.groves.filter((g) => g.side === side2 && !g.burned).length >= ECONOMY_RULES.grove.limit || s.resources.length + economy.groves.filter((g) => !g.resourceId && !g.burned).length >= 8192 || !freeGrove(s, side2, point5, hooks) || !payCost(s.players[side2], ECONOMY_RULES.grove.cost)) return false;
    const id6 = s.nextId++;
    economy.groves = retainedGroves;
    economy.groves.push({ id: id6, side: side2, ...point5, plantedAt: -1, maturesAt: -1, burned: false });
    cancelEconomyTask(s, worker.id);
    hooks.assign(s, worker, { type: "idle" });
    economy.tasks.push({ entityId: worker.id, kind: "plant", targetId: id6, progress: 0 });
    economyMessage(s, worker, "Worker assigned to plant a grove.", id6);
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
    const workers = chooseWork(s, side2, c.ids, economy), target = c.target === null ? void 0 : own(s, side2, c.target), warehouse = economy.structures.find((item) => item.entityId === c.target && item.kind === "warehouse");
    if (!workers.length || c.target !== null && (!target || target.progress < 1 || !warehouse || workers.some((worker) => !sameLevel2(worker, target)))) return false;
    for (const worker of workers) {
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
function cancelEconomyTask(s, id6) {
  const economy = economicState(s);
  if (!economy) return;
  const actor3 = s.entities.find((e) => e.id === id6);
  if (actor3 && economy.tasks.some((task) => task.entityId === id6)) cancelCargoTask(actor3, economy);
  else {
    for (const task of economy.tasks) if (task.entityId === id6 && task.kind === "plant") {
      const grove = economy.groves.find((g) => g.id === task.targetId && g.plantedAt < 0);
      if (grove) grove.burned = true;
    }
    economy.tasks = economy.tasks.filter((task) => task.entityId !== id6);
  }
  economy.workerWarehouses = economy.workerWarehouses.filter((item) => item.entityId !== id6 || !!actor3 && s.entities.some((w) => w.id === item.warehouseId && sameLevel2(actor3, w)));
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
    const resource = { id: s.nextId++, x: grove.x, y: grove.y, level: levelOf2(grove), kind: "wood", amount: ECONOMY_RULES.grove.wood, maxAmount: ECONOMY_RULES.grove.wood };
    s.resources.push(resource);
    grove.resourceId = resource.id;
    s.events.push({ type: "build", x: grove.x, y: grove.y, level: levelOf2(grove), side: grove.side, text: "A cultivated grove is ready to harvest." });
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
      let hash4 = (s.seed ^ Math.imul(entity.id, 2654435761) ^ Math.imul(cycle, 2246822519)) >>> 0;
      hash4 ^= hash4 >>> 16;
      hash4 = Math.imul(hash4, 2246822519) >>> 0;
      const roll = (hash4 >>> 0) / 4294967296;
      structure.nextIncident += ECONOMY_RULES.extractor.incidentSeconds;
      if (structure.overcharge && roll < ECONOMY_RULES.extractor.incidentChance) {
        const amount = Math.min(entity.hp, ECONOMY_RULES.extractor.incidentDamage);
        entity.hp -= amount;
        entity.lastDamagedAt = s.time;
        s.events.push({ type: "attack", x: entity.x, y: entity.y, level: levelOf2(entity), side: entity.side, source: entity.id, target: entity.id, amount, text: "Extractor overcharge incident" });
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
    const point5 = openDestination(s, { x: producer.x + hooks.radius(s, producer) + 1, y: producer.y, level: levelOf2(producer) }, producer);
    if (!point5) continue;
    const caravan = hooks.spawn(s, recruit.side, "unit", "worker", point5.x, point5.y, 1, ECONOMY_CARAVAN.id, levelOf2(producer));
    markDefinition(caravan, ECONOMY_CARAVAN.id);
    caravan.hp = caravan.maxHp = ECONOMY_CARAVAN.hp;
    caravan.shield = void 0;
    caravan.maxShield = void 0;
    s.players[recruit.side].population++;
    economy.caravans.push(caravan.id);
    economy.cargo.push({ entityId: caravan.id, stock: zeroCost(), capacity: ECONOMY_RULES.caravan.capacity, origin: "delivery", tradeValue: 0 });
    recordEconomyPaid(s, caravan, ECONOMY_RULES.caravan.cost);
    economy.recruits = economy.recruits.filter((item) => item !== recruit);
    s.events.push({ type: "train", x: caravan.x, y: caravan.y, level: levelOf2(caravan), side: caravan.side, source: caravan.id, text: "Trade caravan recruited." });
  }
  tickCargo(s, dt, economy, hooks);
  const aliveIds = new Set(s.entities.filter((e) => e.hp > 0).map((e) => e.id));
  economy.workerWarehouses = economy.workerWarehouses.filter((item) => aliveIds.has(item.entityId) && aliveIds.has(item.warehouseId) && sameLevel2(s.entities.find((e) => e.id === item.entityId), s.entities.find((e) => e.id === item.warehouseId)));
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
  const record7 = economicState(s)?.workerWarehouses.find((item) => item.entityId === e.id);
  return record7 ? s.entities.find((b) => b.id === record7.warehouseId && b.side === e.side && b.hp > 0 && b.progress === 1 && sameLevel2(e, b)) : void 0;
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
function observeEconomy(s, side2, hooks) {
  const economy = economicState(s) ?? createEconomyState(s.players.length), visible5 = (p) => hooks.visible(s, side2, p), entities = new Map(s.entities.map((e) => [e.id, e]));
  const structures = economy.structures.flatMap((item) => {
    const e = entities.get(item.entityId);
    if (!e || e.hp <= 0 || e.side !== side2 && !visible5(e)) return [];
    return [{ ...item, stock: e.side === side2 ? { ...item.stock } : zeroCost(), x: e.x, y: e.y, level: levelOf2(e), hp: e.hp, maxHp: e.maxHp, progress: e.progress, side: e.side }];
  });
  const caravans = economy.cargo.flatMap((item) => {
    const e = entities.get(item.entityId);
    if (!e || e.hp <= 0 || !economy.caravans.includes(e.id) || e.side !== side2 && !visible5(e)) return [];
    const task = e.side === side2 ? economy.tasks.find((task2) => task2.entityId === e.id) : void 0;
    return [{ ...item, origin: e.side === side2 ? item.origin : "delivery", stock: e.side === side2 ? { ...item.stock } : zeroCost(), sourceId: e.side === side2 ? item.sourceId : void 0, destinationId: e.side === side2 ? item.destinationId : void 0, tradeValue: e.side === side2 ? item.tradeValue : 0, contractId: e.side === side2 ? item.contractId : void 0, x: e.x, y: e.y, level: levelOf2(e), side: e.side, hp: e.hp, maxHp: e.maxHp, ...task ? { task: structuredClone(task) } : {} }];
  });
  return { version: 1, recruits: economy.recruits.filter((recruit) => recruit.side === side2).map(({ producerId, readyAt }) => ({ producerId, readyAt })), deepSites: economy.deepSites.filter((id6) => s.resources.some((r) => r.id === id6 && visible5(r))), groves: economy.groves.filter((g) => g.side === side2 || visible5(g)).map((g) => ({ ...g })), structures, caravans, salvage: economy.salvage.filter(visible5).map((item) => ({ ...item, stock: { ...item.stock } })), markets: economy.markets.filter(visible5).map((m) => ({ ...m, stock: { ...m.stock }, demand: { ...m.demand }, prices: marketPrices(m) })), contracts: economy.contracts.filter((c) => c.side === side2 || c.side === null && visible5(c)).map((c) => ({ ...c, reward: { ...c.reward } })), specializations: economy.specializations.filter((item) => entities.get(item.entityId)?.side === side2).map((item) => ({ ...item })), workerWarehouses: economy.workerWarehouses.filter((item) => entities.get(item.entityId)?.side === side2).map((item) => ({ ...item })), ledger: structuredClone(economy.ledgers[side2]) };
}

// src/core/combat-targets.ts
var isEntityTarget = (target) => "side" in target;
var isBridgeTarget = (target) => "tiles" in target;
var combatTargets = (s) => [...s.entities, ...s.world?.bridges ?? [], ...s.world?.creatures ?? []];

// src/core/specialist-systems.ts
var sameLevel5 = (a, b) => (a.level ?? 0) === (b.level ?? 0);
var dist = (a, b) => sameLevel5(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
var allied3 = (s, a, b) => s.teams[a.side] === s.teams[b.side];
var visible3 = (s, side2, p) => s.visible[side2].has((p.level ?? 0) * s.width * s.height + Math.floor(p.y) * s.width + Math.floor(p.x));
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
function buff(s, e, value, seconds) {
  e.specialistBuffs ??= [];
  if (e.specialistBuffs.length >= 64) e.specialistBuffs.shift();
  e.specialistBuffs.push({ ...value, until: s.time + seconds });
}
function heroRecruitmentReason(s, side2, definitionId2) {
  const def = s.players[side2] && availableUnits(s, side2).find((def2) => def2.id === definitionId2);
  if (!def?.tags?.includes("hero")) return void 0;
  return commanderAdmissionReason(s, side2);
}
function commanderDied(s, e) {
  if (e.kind !== "unit" || e.illusion || e.raised || !unitFor(s, e).tags?.includes("hero")) return;
  const id6 = unitFor(s, e).id;
  if (!availableUnits(s, e.side).some((def) => def.id === id6)) return;
  const p = s.players[e.side];
  p.heroRecovery ??= [];
  p.heroRecovery = p.heroRecovery.filter((r) => r.definitionId !== id6);
  p.heroRecovery.push({ definitionId: id6, availableAt: s.time + 30 });
}
function specialistAbility(s, e, c, hooks) {
  const ability = unitFor(s, e).ability;
  if (!allAbilities.has(ability)) return void 0;
  if (!active2(e) || (e.abilityReadyAt ?? 0) > s.time) return false;
  const target = c.target === void 0 ? void 0 : s.entities.find((target2) => target2.id === c.target && target2.hp > 0), point5 = c.x === void 0 ? target : { x: c.x, y: c.y, level: c.level ?? e.level };
  const validPoint = (range) => !!point5 && Number.isFinite(point5.x) && Number.isFinite(point5.y) && point5.x >= 0.5 && point5.y >= 0.5 && point5.x <= s.width - 0.5 && point5.y <= s.height - 0.5 && dist(e, point5) <= range && visible3(s, e.side, point5);
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
      if (!target || !active2(target) || !allied3(s, e, target) || dist(e, target) > 8 || !visible3(s, e.side, target)) return false;
      target.hp = Math.min(target.maxHp, target.hp + 80);
      buff(s, target, { armor: 4 }, 10);
      break;
    case "soul-drain":
      if (!target || !active2(target) || allied3(s, e, target) || dist(e, target) > 7 || !visible3(s, e.side, target)) return false;
      hooks.damage(e, target, 60);
      e.hp = Math.min(e.maxHp, e.hp + 45);
      break;
    case "admiral-wave":
      if (!validPoint(8)) return false;
      for (const actor3 of nearby(point5, 4)) if (allied3(s, e, actor3)) actor3.hp = Math.min(actor3.maxHp, actor3.hp + 50);
      else hooks.damage(e, actor3, 35);
      break;
    case "prime-shield":
      if (!target || !active2(target) || !allied3(s, e, target) || !target.maxShield || dist(e, target) > 8 || !visible3(s, e.side, target)) return false;
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
      const corpse = s.corpses.find((c2) => c2.expires > s.time && dist(e, c2) <= 6 && visible3(s, e.side, c2));
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
      const entity = isEntityTarget(actor3), building4 = isBridgeTarget(actor3) || entity && actor3.kind === "building";
      if (actor3.hp <= 0 || (hooks.targetDistance?.(shot.target, actor3) ?? dist(actor3, shot.target)) > (radius2 || 0.75) + (entity && actor3.kind === "building" ? buildingFor(s, actor3).size / 2 : 0) || !friendlyFire && entity && allied3(s, shot.source, actor3) && !isCrewless(actor3)) continue;
      const falloff = radius2 ? 1 - 0.4 * Math.min(1, (hooks.targetDistance?.(shot.target, actor3) ?? dist(actor3, shot.target)) / radius2) : 1;
      hooks.damage(shot.source, actor3, shot.rawDamage * shot.payload.damageFactor * (building4 ? shot.buildingMultiplier : 1) * (shot.modification === "stone" && building4 ? 1.25 : shot.modification === "grapeshot" && !building4 ? 1.5 : 1) * falloff, { armorPiercing: shot.payload.armorPiercing, ranged: true });
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
  if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !engineers.some((e) => dist(e, point5) <= 4) || !visible3(s, side2, point5)) return false;
  const player = s.players[side2], cost5 = c.kind === "bridge" ? { wood: 60, ore: 0, crystal: 0 } : { wood: 35, ore: 15, crystal: 0 };
  if (player.wood < cost5.wood || player.ore < cost5.ore) return false;
  const state = specialistState(s);
  let barricade;
  if (c.kind === "bridge") {
    const tiles = [-1, 0, 1].map((dx) => ({ ...point5, x: point5.x + dx })), world = s.world;
    if (world?.bridges?.some((bridge) => bridge.level === (point5.level ?? 0) && bridge.tiles.some((tile) => tiles.some((p) => Math.floor(p.y) * s.width + Math.floor(p.x) === tile)))) return false;
    if (tiles.some((tile) => tile.x < 0.5 || tile.x > s.width - 0.5 || tile.y < 0.5 || tile.y > s.height - 0.5) || !tiles.some((tile) => fieldTerrainAt(s, tile) === "water") || tiles.some((tile) => !["water", "shallows", "grass", "road"].includes(fieldTerrainAt(s, tile)) || !visible3(s, side2, tile) || state.structures.some((item) => item.expires > s.time && item.tiles?.some((prior) => dist(prior, tile) < 0.1)))) return false;
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
function fieldRepair(s, side2, id6, targetId) {
  const engineer2 = s.entities.find((e) => e.id === id6 && e.side === side2 && active2(e) && unitFor(s, e).tags?.includes("engineer")), target = s.entities.find((e) => e.id === targetId && e.hp > 0 && s.teams[e.side] === s.teams[side2]);
  if (!engineer2 || !target || target.kind !== "building" && target.role !== "siege" || target.hp >= target.maxHp || dist(engineer2, target) > 4 || !visible3(s, side2, target)) return false;
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
    const intruder = s.entities.find((e) => e.hp > 0 && s.teams[e.side] !== s.teams[beacon2.side] && dist(e, beacon2) <= buildingFor(s, beacon2).sight && visible3(s, beacon2.side, e));
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
  const actors = s.entities.filter((e) => e.side === side2 && active2(e)), hostiles = s.entities.filter((e) => e.hp > 0 && !allied3(s, { side: side2 }, e) && visible3(s, side2, e));
  for (const actor3 of actors) {
    if (actor3.veteran?.pendingPromotion) {
      const choices = promotionChoices(s, actor3);
      if (choices.length) issue({ type: "promote", id: actor3.id, promotion: choices[0] });
    }
    if (unitFor(s, actor3).tags?.includes("engineer")) {
      const damaged = s.entities.find((e) => e.hp > 0 && allied3(s, actor3, e) && (e.kind === "building" || e.role === "siege") && e.hp < e.maxHp && dist(actor3, e) <= 4 && visible3(s, side2, e));
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
var distance8 = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
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
      const target = s.entities.find((e) => e.id === c.target && e.hp > 0 && s.teams[e.side] !== s.teams[side2] && visible5(side2, e.x, e.y, levelOf(e)));
      if (!target) return false;
      destination = { x: target.x, y: target.y, ...target.level === void 0 ? {} : { level: target.level } };
      observedTarget = target.id;
    } else destination = { x: c.x, y: c.y, ...c.level === void 0 ? {} : { level: c.level } };
    if (levelOf(destination) >= (s.world?.levels.length ?? 1) || destination.x < 0 || destination.y < 0 || destination.x >= s.width || destination.y >= s.height) return false;
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
  if (units.every((e) => e.order.type === type && distance8(e.order, point5) < formation || distance8(e, point5) < 2 && e.order.type === "hold")) return true;
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
    const resources2 = d.resources, p = s.players[side2], worker = factionFor(s, side2).units.worker.cost;
    if (p.wood < resources2.wood + worker.wood || p.ore < resources2.ore + worker.ore || p.crystal < resources2.crystal + worker.crystal) {
      d.reason = "Waiting for spare resources.";
      return reserved2;
    }
    if (execute(side2, { type: "transferResources", recipient: d.issuer, resources: { ...resources2 } })) {
      d.status = "completed";
      d.reason = "Resources transferred.";
    }
    return reserved2;
  }
  available = available.filter((e) => sameLevel(e, d.destination));
  const availableIds = new Set(available.map((e) => e.id));
  d.assigned = d.assigned.filter((id6) => availableIds.has(id6));
  if (!d.assigned.length) {
    delete d.arrivedAt;
    const sorted = [...available].sort((a, b) => d.kind === "scout" ? Number(b.role === "cavalry") - Number(a.role === "cavalry") || a.id - b.id : a.id - b.id);
    d.assigned = sorted.slice(0, d.kind === "scout" ? 1 : d.kind === "defend" ? 3 : sorted.length).map((e) => e.id);
  }
  d.assigned.forEach((id6) => reserved2.add(id6));
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
  const arrived = units.every((e) => distance8(e, point5) < Math.max(3, formationRadius)) && visible5(side2, point5.x, point5.y, levelOf(point5));
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
  const enemies = s.entities.filter((e) => e.hp > 0 && s.teams[e.side] !== s.teams[side2] && visible5(side2, e.x, e.y, levelOf(e)) && distance8(e, point5) < 7);
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
function alliedAiObservation(s, side2, state) {
  const team = s.teams[side2];
  return {
    allies: s.players.flatMap((p, i) => i !== side2 && s.teams[i] === team && s.controllers[i] === "ai" && !s.eliminated[i] ? [{ side: i, faction: p.faction }] : []),
    directives: state.directives.filter((d) => s.teams[d.issuer] === team).map(({ assigned: _assigned, ...d }) => structuredClone(d)),
    transfers: state.transfers.filter((t) => s.teams[t.sender] === team).map((t) => structuredClone(t))
  };
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
function notifyCommand(state, side2, command) {
  for (const observer of [...observers.get(state) ?? []]) {
    try {
      observer.command?.(side2, structuredClone(command));
    } catch (error2) {
      console.error("Match command observer failed", error2);
    }
  }
}
function notifyStep(state, dt) {
  for (const observer of [...observers.get(state) ?? []]) {
    try {
      observer.step?.(dt);
    } catch (error2) {
      console.error("Match step observer failed", error2);
    }
  }
}

// src/core/world-actions.ts
var known = (s, side2, point5) => s.visible[side2].has(fogKey(s, point5));
var distance9 = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
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
  const world = s.world;
  if (!world || !("ids" in c)) return false;
  const units = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && e.kind === "unit" && e.hp > 0 && !e.illusion);
  if (c.type === "traverse") {
    const transition = world.transitions.find((t) => t.id === c.transition);
    if (!transition) return false;
    let accepted = false;
    for (const e of units) {
      const entrance = [transition.from, transition.to].find((p) => sameLevel(p, e));
      if (!entrance || !known(s, side2, entrance)) continue;
      assign2(e, { type: "traverse", transition: transition.id });
      accepted = true;
    }
    return accepted;
  }
  if (!("target" in c)) return false;
  const bridge = world.bridges.find((b) => b.id === c.target);
  if (!bridge) return c.type === "worldAttack" ? void 0 : false;
  if (!known(s, side2, bridge)) return false;
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
  if (bridge.repairSide !== null && s.teams[bridge.repairSide] !== s.teams[side2]) return false;
  if (bridge.hp === 0 && !claimRebuild(s, bridge, side2)) return false;
  for (const e of workers) assign2(e, { type: "repairBridge", target: bridge.id });
  return true;
}
function stepWorldActions(s) {
  for (const bridge of s.world?.bridges ?? []) if (bridge.hp === 0 && bridge.repairSide !== null) {
    const active4 = s.entities.some((e) => e.hp > 0 && e.kind === "unit" && e.role === "worker" && s.teams[e.side] === s.teams[bridge.repairSide] && sameLevel(e, bridge) && e.order.type === "repairBridge" && e.order.target === bridge.id);
    if (!active4) {
      bridge.repairSide = null;
      bridge.rebuilding = 0;
    }
  }
}
function bridgeEdge(bridge, s, e) {
  const candidates = bridge.tiles.map((tile) => ({ x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: bridge.level }));
  return candidates.sort((a, b) => distance9(e, a) - distance9(e, b))[0];
}
function evacuateBridge(s, bridge, hooks) {
  for (const unit4 of s.entities.filter((e) => e.hp > 0 && e.kind === "unit" && sameLevel(e, bridge) && bridge.tiles.some((tile) => Math.abs(e.x - (tile % s.width + 0.5)) < 0.77 && Math.abs(e.y - (Math.floor(tile / s.width) + 0.5)) < 0.77) && !walkable(s, e.x, e.y, bridge.level))) {
    let escape;
    for (let ring = 1; ring <= 8 && !escape; ring++) {
      const points = [];
      for (let y = Math.floor(unit4.y) - ring; y <= Math.floor(unit4.y) + ring; y++) for (let x = Math.floor(unit4.x) - ring; x <= Math.floor(unit4.x) + ring; x++) if (walkable(s, x + 0.5, y + 0.5, bridge.level)) points.push({ x: x + 0.5, y: y + 0.5, level: bridge.level });
      escape = points.sort((a, b) => distance9(unit4, a) - distance9(unit4, b))[0];
    }
    if (escape) {
      unit4.x = escape.x;
      unit4.y = escape.y;
      unit4.hp = Math.max(1, unit4.hp - unit4.maxHp * 0.25);
      s.events.push({ type: "message", side: unit4.side, x: unit4.x, y: unit4.y, level: levelOf(unit4), source: unit4.id, text: "Bridge destroyed: survivors reached the bank with injuries." });
    } else if (hooks.die) {
      hooks.die(unit4, "A unit drowned when the bridge collapsed.");
    } else {
      unit4.hp = 0;
      unit4.animation = "death";
      unit4.animTime = 0;
      s.events.push({ type: "death", side: unit4.side, x: unit4.x, y: unit4.y, level: levelOf(unit4), source: unit4.id, text: "A unit drowned when the bridge collapsed." });
      if (!unit4.illusion && !unit4.raised) s.corpses.push({ id: unit4.id, x: unit4.x, y: unit4.y, level: levelOf(unit4), expires: s.time + 45 });
    }
    unit4.order = { type: "idle" };
    delete unit4.orderQueue;
    unit4.path = [];
    hooks.interrupt?.(unit4);
  }
}
function collapseBridge(s, bridge, side2, hooks) {
  for (const tile of bridge.tiles) setWorldTerrain(s, { x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: bridge.level }, "water");
  for (const unit4 of s.entities) if (levelOf(unit4) === bridge.level) unit4.path = [];
  evacuateBridge(s, bridge, hooks);
  s.events.push({ type: "message", side: side2, x: bridge.x, y: bridge.y, level: bridge.level, target: bridge.id, text: "Bridge destroyed. Rebuild with workers to restore the crossing." });
}
function processWorldAction(s, e, dt, hooks) {
  const world = s.world, o = e.order;
  if (!world) return false;
  if (o.type === "traverse") {
    const transition = world.transitions.find((t) => t.id === o.transition), entry = transition && [transition.from, transition.to].find((p) => sameLevel(p, e));
    if (!transition || !entry) {
      hooks.finish(e);
      return true;
    }
    if (!hooks.move(e, entry, dt, 0.6)) return true;
    const exit = entry === transition.from ? transition.to : transition.from, destination = openDestination(s, exit, exit);
    if (!destination) {
      s.events.push({ type: "message", side: e.side, x: e.x, y: e.y, level: levelOf(e), text: "The entrance is blocked on the other level." });
      return true;
    }
    e.x = destination.x;
    e.y = destination.y;
    e.level = exit.level;
    e.path = [];
    s.events.push({ type: "message", side: e.side, x: e.x, y: e.y, level: levelOf(e), source: e.id, text: `Entered ${world.levels[exit.level].title}.` });
    hooks.finish(e);
    return true;
  }
  if (o.type !== "worldAttack" && o.type !== "repairBridge") return false;
  const bridge = world.bridges.find((b) => b.id === o.target);
  if (!bridge) return false;
  if (!sameLevel(e, bridge)) {
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
    s.events.push({ type: "attack", side: e.side, x: e.x, y: e.y, level: levelOf(e), source: e.id, target: bridge.id, amount });
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
function message2(s, side2, p, text5, type = "message", source2) {
  const event = { type, side: side2, x: p.x, y: p.y, level: levelOf3(p), text: text5, source: source2 };
  s.events.push(event);
}
function hurt(s, e, amount, text5, bypassShield = false, hooks) {
  const absorbed = bypassShield ? 0 : Math.min(e.shield ?? 0, amount);
  if (absorbed) e.shield = Math.max(0, (e.shield ?? 0) - absorbed);
  const damage2 = Math.min(e.hp, amount - absorbed);
  e.hp = Math.max(0, e.hp - damage2);
  e.lastDamagedAt = s.time;
  const event = { type: "ability", side: e.side, x: e.x, y: e.y, level: levelOf3(e), source: e.id, target: e.id, amount: damage2 + absorbed, text: text5 };
  s.events.push(event);
  if (e.hp > 0) return;
  if (hooks?.die) {
    hooks.die(e, text5);
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
  s.events.push({ type: "death", side: e.side, x: e.x, y: e.y, source: e.id, text: text5, level: levelOf3(e) });
}
function ignition(s, p) {
  return { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5, level: levelOf3(p), heat: 1, expires: s.time + ENVIRONMENT_RULES.fireLifetime, nextSpread: s.time + 2.5 };
}
function igniteWorldAt(s, at, source2) {
  const state = s, world = state.world, level2 = levelOf3(at);
  if (!world || !Number.isFinite(at.x) || !Number.isFinite(at.y) || !Number.isInteger(level2) || !world.levels.some((l) => l.id === level2) || at.x < 0 || at.y < 0 || at.x >= s.width || at.y >= s.height || source2 && !s.players[source2.side]) return false;
  if (source2?.id !== void 0 && (!Number.isSafeInteger(source2.id) || source2.id < 1 || source2.id >= s.nextId)) return false;
  const p = { x: Math.floor(at.x) + 0.5, y: Math.floor(at.y) + 0.5, level: level2 };
  if (!flammable(state, p) || world.fires.some((f) => f.level === level2 && tileOf(s, f) === tileOf(s, p))) return false;
  world.fires.push(ignition(state, p));
  if (source2) message2(s, source2.side, p, "Incendiary shell ignited timber.", "ability", source2.id);
  return true;
}
function issueEnvironmentCommand(s, side2, command) {
  if (command.type !== "ignite" && command.type !== "firebreak") return void 0;
  const c = command, state = s, world = state.world;
  if (!world || s.winner !== null || s.draw || !s.players[side2] || s.eliminated[side2] || !Array.isArray(c.ids) || !c.ids.every((id6) => Number.isSafeInteger(id6) && id6 > 0)) return false;
  const p = { x: c.x, y: c.y, level: c.level ?? 0 };
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isSafeInteger(p.level) || !world.levels.some((l) => l.id === p.level) || p.x < 0 || p.y < 0 || p.x >= s.width || p.y >= s.height) return false;
  p.x = Math.floor(p.x) + 0.5;
  p.y = Math.floor(p.y) + 0.5;
  const key = p.level * s.width * s.height + tileOf(s, p);
  if (!s.visible[side2]?.has(key)) return false;
  const fire = world.fires.find((f) => f.level === p.level && tileOf(s, f) === tileOf(s, p));
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
    world.fires = world.fires.filter((f) => f !== fire);
  }
  message2(s, side2, p, c.type === "ignite" ? "Forest ignited (15 wood, 5 ore)" : "Firebreak cleared (5 wood); timber is lost", "ability", actor3.id);
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
  const world = s.world;
  if (phase.season === "winter" && world.biome !== "desert") {
    const surface = world.levels.find((l) => l.id === 0);
    const frozen = new Set(world.iceTiles.filter((ice) => ice.level === 0).map((ice) => ice.tile));
    if (surface) {
      for (let tile = 0; tile < surface.terrain.length; tile++) if (surface.terrain[tile] === "water") {
        const p = { x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: 0 };
        setTerrain(s, p, "ice");
        if (!frozen.has(tile)) {
          world.iceTiles.push({ level: 0, tile });
          frozen.add(tile);
        }
      }
    }
    const warning = Math.min(ENVIRONMENT_RULES.thawWarning, length(world.seasonLength, 300) * 0.1);
    if (world.iceTiles.length && !world.thawWarned && phase.thawIn !== null && phase.thawIn <= warning + 1e-8) {
      world.thawWarned = true;
      for (let side2 = 0; side2 < s.players.length; side2++) {
        const troop = s.entities.find((e) => e.hp > 0 && e.kind === "unit" && e.side === side2 && touchesIce(s, e, world.iceTiles));
        message2(s, side2, troop ?? s.starts[side2], `Lake ice thaws in ${Math.ceil(phase.thawIn)} seconds. Leave crossings: nearby banks cause injury; troops trapped over 6 tiles from a bank drown.`);
      }
    }
    return;
  }
  if (world.iceTiles.length) {
    const melting = world.iceTiles.filter((t) => terrain(s, { x: t.tile % s.width + 0.5, y: Math.floor(t.tile / s.width) + 0.5, level: t.level }) === "ice");
    for (const ice of melting) setTerrain(s, { x: ice.tile % s.width + 0.5, y: Math.floor(ice.tile / s.width) + 0.5, level: ice.level }, "water");
    for (const e of s.entities) if (e.hp > 0 && e.kind === "unit" && touchesIce(s, e, melting)) evacuate(s, e, hooks);
    world.iceTiles = [];
  }
  world.thawWarned = false;
}
function stepEnvironment(s, dt, hooks) {
  const state = s, world = state.world;
  if (!world || !Number.isFinite(dt) || dt <= 0) return;
  const phase = environmentPhase(s), previous = environmentPhase({ ...s, time: Math.max(0, s.time - dt) }), added = [];
  if (previous.day !== phase.day || previous.weather !== phase.weather || previous.season !== phase.season) for (let side2 = 0; side2 < s.players.length; side2++) message2(s, side2, s.starts[side2], `${phase.day}; ${phase.weather}; ${phase.season}`);
  seasons(state, phase, hooks);
  for (const fire of [...world.fires]) {
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
      if (!flammable(state, p) || world.fires.some((f) => f.level === p.level && tileOf(s, f) === tileOf(s, p)) || added.some((f) => f.level === p.level && tileOf(s, f) === tileOf(s, p)) || hash(s.seed, tileOf(s, p), Math.round(spreadAt * 20), fire.level) >= chance) continue;
      added.push(ignition(state, p));
    }
  }
  world.fires = world.fires.filter((f) => f.expires > s.time && f.heat > 0).concat(added);
  const dayLength = length(world.dayLength, 240), seasonLength = length(world.seasonLength, 300), dayStart = Math.floor(s.time / dayLength) * dayLength;
  const dayNext = [0.55, 0.65, 0.9, 1].map((f) => dayStart + f * dayLength).find((t) => t > s.time + 1e-8) ?? dayStart + dayLength;
  world.nextEnvironmentAt = Math.min(dayNext, phase.weatherEndsAt, (Math.floor(s.time / seasonLength) + 1) * seasonLength);
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
var point3 = (p) => ({ x: p.x, y: p.y, level: p.level ?? 0 });
var distance10 = (a, b) => length2D(a.x - b.x, a.y - b.y);
var allied4 = (s, a, b) => !!s.players[a] && !!s.players[b] && s.teams[a] === s.teams[b];
var eligible2 = (e) => e.hp > 0 && e.kind === "unit" && !e.illusion;
var worldOrder = (e) => e.order;
function stop(e) {
  e.order = { type: "idle" };
  e.path = [];
}
function visible4(s, side2, p) {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height && !!s.visible[side2]?.has(fogKey(s, p));
}
function message3(s, side2, at, text5) {
  s.events.push({ type: "message", side: side2, x: at.x, y: at.y, text: text5, ...{ level: at.level } });
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
  const world = s.world;
  if (!world) return false;
  const site = world.sites.find((site2) => site2.id === c.target), creature = world.creatures.find((creature2) => creature2.id === c.target);
  if (c.type === "worldAttack") {
    if (creature) {
      const den = world.sites.find((site2) => site2.id === creature.site);
      return creature.hp > 0 && !!den && visible4(s, side2, creature) && !(den.owner !== null && allied4(s, side2, den.owner));
    }
    return !!site && site.kind !== "relic" && visible4(s, side2, site) && !(site.owner !== null && allied4(s, side2, site.owner)) && (world.creatures.some((creature2) => creature2.site === site.id && creature2.hp > 0) || site.kind === "village" && nonempty(site.reward));
  }
  if (!site || !visible4(s, side2, site)) return false;
  if (c.type === "captureSite") return site.kind === "relic" && !(site.owner !== null && allied4(s, side2, site.owner));
  if (c.type === "supportVillage") return site.kind === "village" && (!services(site, side2) ? nonempty(site.request) && affordable2(s.players[side2], site.request) : !site.rewarded.includes(side2) && nonempty(site.reward));
  return c.type === "recruitVillage" && services(site, side2) && s.players[side2].population < s.players[side2].cap && affordable2(site.reward, unitFor(s, side2, "melee").cost);
}
function issueNeutralWorldCommand(s, side2, command) {
  if (!orderKinds.includes(command.type)) return void 0;
  if (!s.world || !s.players[side2] || s.eliminated[side2] || s.winner !== null || s.draw) return false;
  const c = command;
  if (!Number.isSafeInteger(c.target) || c.target < 1 || !Array.isArray(c.ids) || !c.ids.length || c.ids.length > 8192 || new Set(c.ids).size !== c.ids.length) return false;
  const units = c.ids.map((id6) => s.entities.find((e) => e.id === id6));
  if (units.some((e) => !e || e.side !== side2 || !eligible2(e)) || !validTarget(s, side2, c)) return false;
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
function attackStats(s, e, hooks) {
  if (hooks.attackStats) return hooks.attackStats(e);
  const def = unitFor(s, e);
  let damage2 = def.damage;
  for (const id6 of s.players[e.side].upgrades) {
    const upgrade = upgradeFor(s, e.side, id6);
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
  message3(s, side2, site, `Monster den cleared: ${reward.wood} wood, ${reward.ore} ore, ${reward.crystal} crystal. Its creatures return in ${NEUTRAL_RULES.monsterRespawnSeconds}s; the reward is claimed.`);
}
function processNeutralOrder(s, e, dt, hooks) {
  if (!orderKinds.includes(e.order.type)) return false;
  const order3 = worldOrder(e), world = s.world;
  if (!world || !eligible2(e) || !s.players[e.side]) {
    stop(e);
    return true;
  }
  const site = world.sites.find((site2) => site2.id === order3.target);
  if (order3.type === "worldAttack") {
    let target = world.creatures.find((creature) => creature.id === order3.target && creature.hp > 0);
    if (!target && site) target = world.creatures.filter((creature) => creature.site === site.id && creature.hp > 0).sort((a, b) => distance10(e, a) - distance10(e, b) || a.id - b.id)[0];
    const targetSite = site ?? world.sites.find((site2) => site2.id === target?.site);
    if (!targetSite || !sameLevel(e, targetSite) || targetSite.kind === "relic" || targetSite.owner !== null && allied4(s, e.side, targetSite.owner)) {
      stop(e);
      return true;
    }
    const at = target ?? targetSite, stats = attackStats(s, e, hooks);
    if (!visible4(s, e.side, at)) {
      stop(e);
      return true;
    }
    if (distance10(e, at) > stats.range) {
      hooks.move(e, point3(at), dt, stats.range);
      return true;
    }
    if (!(hooks.lineOfSight?.(point3(e), point3(at)) ?? terrainLineOfSight(s, e, at))) {
      hooks.move(e, point3(at), dt, 0.8);
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
      message3(s, e.side, targetSite, `Village raided: ${stolen.wood} wood, ${stolen.ore} ore, ${stolen.crystal} crystal. Loyalty fell.`);
      if (!nonempty(targetSite.reward)) stop(e);
    } else stop(e);
    return true;
  }
  if (!site || !sameLevel(e, site)) {
    stop(e);
    return true;
  }
  if (order3.type === "captureSite") {
    if (site.kind !== "relic" || site.owner !== null && allied4(s, e.side, site.owner)) {
      stop(e);
      return true;
    }
    if (!terrainLineOfSight(s, e, site)) hooks.move(e, point3(site), dt, 0.8);
    else if (distance10(e, site) > NEUTRAL_RULES.captureRadius) hooks.move(e, point3(site), dt, NEUTRAL_RULES.captureRadius - 0.2);
    return true;
  }
  if (!validTarget(s, e.side, order3)) {
    stop(e);
    return true;
  }
  if (!terrainLineOfSight(s, e, site)) {
    hooks.move(e, point3(site), dt, 0.8);
    return true;
  }
  if (distance10(e, site) > 2.3) {
    hooks.move(e, point3(site), dt, 2.1);
    return true;
  }
  if (order3.type === "supportVillage") {
    if (services(site, e.side)) {
      const supplied = boundedStock(site.reward, NEUTRAL_RULES.supplyBundle);
      transfer(site.reward, s.players[e.side], supplied);
      site.rewarded.push(e.side);
      message3(s, e.side, site, `Village supplies delivered: ${supplied.wood} wood, ${supplied.ore} ore, ${supplied.crystal} crystal.`);
    } else {
      transfer(s.players[e.side], site.reward, site.request);
      site.loyalty[e.side] = Math.min(100, site.loyalty[e.side] + NEUTRAL_RULES.supportLoyalty);
      site.supplied = true;
      updateVillageOwner(site);
      message3(s, e.side, site, "Village request delivered. Loyalty increased; local supplies and defenders are available at 60 loyalty.");
    }
  } else {
    const cost5 = hooks.recruitCost?.(e.side, "melee") ?? unitFor(s, e.side, "melee").cost;
    if (affordable2(site.reward, cost5) && s.players[e.side].population < s.players[e.side].cap) {
      const recruit = hooks.spawn(e.side, "melee", site.x + 1.7, site.y, site.level);
      if (recruit) {
        for (const kind of resources) site.reward[kind] -= cost5[kind];
        s.players[e.side].population++;
        message3(s, e.side, site, "A local defender joined your army. Its equipment was paid from the village stock.");
      }
    }
  }
  stop(e);
  return true;
}
function creatureCanTarget(s, creature, site, e, hooks) {
  const stats = creatureProfile(site);
  if (e.hp <= 0 || e.illusion || !sameLevel(creature, e) || distance10(creature, e) > stats.sight || distance10(site, e) > stats.leash) return false;
  if (!(hooks.lineOfSight?.(point3(creature), point3(e)) ?? terrainLineOfSight(s, creature, e))) return false;
  if (site.kind === "monster") return true;
  if (site.owner !== null) return !allied4(s, site.owner, e.side);
  const order3 = worldOrder(e);
  return order3.type === "worldAttack" && (order3.target === site.id || site.creatureIds.includes(order3.target));
}
function stepCaptures(s, dt) {
  for (const site of s.world.sites) {
    if (site.kind !== "relic") continue;
    const nearby = s.entities.filter((e) => eligible2(e) && sameLevel(e, site) && distance10(e, site) <= NEUTRAL_RULES.captureRadius && terrainLineOfSight(s, e, site));
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
      message3(s, side2, site, `Relic secured. Allied troops within ${NEUTRAL_RULES.relicRadius} tiles gain ${NEUTRAL_RULES.relicDamageBonus * 100}% damage until the site is lost.`);
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
    const target = previous && creatureCanTarget(s, creature, site, previous, hooks) ? previous : s.entities.filter((e) => creatureCanTarget(s, creature, site, e, hooks)).sort((a, b) => distance10(creature, a) - distance10(creature, b) || a.id - b.id)[0];
    creature.target = target?.id ?? null;
    if (target) {
      if (distance10(creature, target) <= stats.range) {
        if (creature.cooldown === 0) {
          hooks.hit(creature, target, stats.damage);
          creature.cooldown = stats.cooldown;
        }
      } else hooks.move(creature, point3(target), dt, stats.range);
    } else {
      const [dx, dy] = DIRECTIONS_32[creature.patrol % 8 * 4], to = { x: site.x + dx * 1.6, y: site.y + dy * 1.6, level: site.level };
      if (hooks.move(creature, to, dt, 0.25)) creature.patrol = (creature.patrol + 1) % 8;
    }
  }
  for (const site of s.world.sites) if (site.creatureIds.length && s.world.creatures.every((creature) => creature.site !== site.id || creature.hp > 0)) site.respawnAt = 0;
  stepCaptures(s, dt);
}
function relicBonus(s, side2, at) {
  return s.world?.sites.reduce((bonus, site) => bonus + (site.kind === "relic" && site.owner !== null && allied4(s, side2, site.owner) && sameLevel(at, site) && distance10(at, site) <= NEUTRAL_RULES.relicRadius ? NEUTRAL_RULES.relicDamageBonus : 0), 0) ?? 0;
}
function observeNeutralWorld(s, side2) {
  return {
    sites: s.world?.sites.filter((site) => visible4(s, side2, site)).map((site) => ({
      id: site.id,
      kind: site.kind,
      x: site.x,
      y: site.y,
      level: site.level,
      owner: site.owner,
      loyalty: site.loyalty[side2],
      progress: site.progress,
      capturing: site.capturing,
      stock: { ...site.reward },
      request: { ...site.request },
      supplied: site.supplied,
      rewardClaimed: site.kind === "monster" ? site.rewarded.length > 0 : site.rewarded.includes(side2),
      respawnAt: site.respawnAt
    })) ?? [],
    creatures: s.world?.creatures.filter((creature) => creature.hp > 0 && visible4(s, side2, creature)).map((creature) => ({
      id: creature.id,
      site: creature.site,
      x: creature.x,
      y: creature.y,
      level: creature.level,
      hp: creature.hp,
      maxHp: creature.maxHp
    })) ?? []
  };
}

// src/core/simulation.ts
var distance11 = (a, b) => sameLevel(a, b) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
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
  return { ...hasTeamAiMemory(r.teamAI) ? { teamAI: structuredClone(r.teamAI) } : {}, aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => [...memory].map(([id6, o]) => [id6, { ...o }])), retreating: r.retreating.map((memory) => [...memory].map(([id6, o]) => [id6, { ...o }])), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits: r.hits.map((h) => ({ source: h.source.id, target: h.target.id, amount: h.amount, event: s.events.indexOf(h.event) })), routes: [...r.routes].map(([id6, value]) => [id6, { ...value }]), abilities: [...r.abilities], returning: [...r.returning], queuedGather: [...r.queuedGather], aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => [...memory].map(([id6, p]) => [id6, { ...p }])), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => [...players]), searched: r.searched.map((tiles) => [...tiles]) };
}
function restoreRuntime(s, r) {
  const entities = new Map(s.entities.map((e) => [e.id, e]));
  const hits = r.hits.map((h) => {
    const source2 = entities.get(h.source), target = entities.get(h.target), event = s.events[h.event];
    if (!source2 || !target || !event) throw new Error("Save runtime has an invalid hit reference.");
    return { source: source2, target, amount: h.amount, event };
  });
  runtimes.set(s, { teamAI: r.teamAI ? structuredClone(r.teamAI) : emptyTeamAiState(), aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => new Map(memory.map(([id6, o]) => [id6, { ...o }]))), retreating: r.retreating.map((memory) => new Map(memory.map(([id6, o]) => [id6, { ...o }]))), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits, routes: new Map(r.routes.map(([id6, value]) => [id6, { ...value }])), abilities: new Map(r.abilities), returning: new Set(r.returning), queuedGather: new Set(r.queuedGather), aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => new Map(memory.map(([id6, p]) => [id6, { ...p }]))), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => new Set(players)), searched: r.searched.map((tiles) => new Set(tiles)) });
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
function near(s, a, b, range) {
  return distance11(a, b) <= range + ("kind" in b && b.kind === "building" ? radius(s, b) : 0);
}
function emit(s, type, e, target, text5) {
  const event = { type, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, side: e.side, target, text: text5, source: e.id };
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
  return spawnEntity(s, side2, "trainTime" in definition2 ? "unit" : "building", definition2.role, point5.x, point5.y, progress, definitionId2, levelOf(point5));
}
function factionHooks(s) {
  return {
    assignOrder: (e, order3) => interruptWorldOrder(s, e, order3),
    recordPaid: (e, cost5) => recordEconomyPaid(s, e, cost5),
    canPlace: (side2, p, id6) => {
      const d = factionSystemDefinition(id6);
      return !!d && !("trainTime" in d) && canPlace(s, side2, d.role, p.x, p.y, id6, levelOf(p)) && s.entities.filter((e) => alive2(e) && e.kind === "unit" && sameLevel(e, p) && isAllied(s, e.side, side2) && footprintOverlap(e, p.x, p.y, d.size)).every(() => !!shovePoint(s, p.x, p.y, d.size, levelOf(p)));
    },
    spawnDefinition: (side2, id6, p, progress) => {
      const d = factionSystemDefinition(id6);
      if (progress === 0) for (const e of s.entities.filter((e2) => alive2(e2) && e2.kind === "unit" && sameLevel(e2, p) && isAllied(s, e2.side, side2) && footprintOverlap(e2, p.x, p.y, d.size))) {
        const point5 = shovePoint(s, p.x, p.y, d.size, levelOf(p));
        e.x = point5.x;
        e.y = point5.y;
        e.path = [];
        e.entrenchedAt = void 0;
        runtime(s).routes.delete(e.id);
      }
      return spawnFactionDefinition(s, side2, id6, p, progress);
    },
    move: (e, to, dt, reach) => move(s, e, to, dt, reach),
    openDestination: (to, from) => openDestination(s, to, from),
    terrainAt: (p) => terrainAt(s, p.x, p.y, levelOf(p)),
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
function matchObject(value, allowed, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some((k) => !allowed.includes(k))) throw new Error(`Invalid ${name}.`);
  return value;
}
function matchNumber(value, min, max, name, integer5 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer5 && !Number.isSafeInteger(value)) throw new Error(`Invalid ${name}.`);
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
  s.friendlyFire = rules.friendlyFire !== false;
  s.projectiles = [];
  initializeFactionSystems(s);
  if (content) s.content = content;
  if (packageMap) initializeWorld(s, packageMap, m.biome ?? "temperate");
  if (!options.scenario) for (const side2 of playerSides(s)) {
    const { x, y } = s.starts[side2], level2 = levelOf(s.starts[side2]), dir2 = y < s.height / 2 ? 1 : -1;
    spawnEntity(s, side2, "building", "hq", x, y, 1, void 0, level2);
    for (let i = 0; i < 5; i++) spawnEntity(s, side2, "unit", "worker", x + (-2 + i * 0.85) * dir2, y + 3 * dir2, 1, void 0, level2);
    const starter = availableUnits(s, side2).find((unit4) => unit4.role !== "worker" && !rules.disabledDefinitionIds.includes(unit4.id));
    if (starter) spawnEntity(s, side2, "unit", starter.role, x + 3 * dir2, y + dir2, 1, starter.id.includes(":") ? starter.id : void 0, level2);
  }
  for (const resource of map.resources) s.resources.push({ ...resource, id: s.nextId++ });
  initializeWorldSites(s);
  if (!options.scenario) initializeEconomySites(s, s.world?.sites.filter((site) => site.kind === "village"));
  initializeObjectives(s);
  if (s.rules.draft.enabled && s.draft.status === "complete") finalizeDraft(s);
  refreshVisibility(s);
  updatePopulation2(s);
  return s;
}
function finalizeDraft(s) {
  for (const side2 of playerSides(s)) {
    const available = availableUnits(s, side2), picked = s.draft.picks[side2].map((id6) => available.find((u) => u.id === id6)).find((u) => u && u.role !== "worker");
    if (!picked) throw new Error("Completed draft requires a combat unit for every player.");
    const starters = s.entities.filter((e) => e.side === side2 && e.kind === "unit" && e.role !== "worker" && e.hp > 0);
    for (const unit4 of starters) {
      s.entities = s.entities.filter((e) => e !== unit4);
      spawnEntity(s, side2, "unit", picked.role, unit4.x, unit4.y, 1, picked.id, levelOf(unit4));
    }
  }
  if (s.rules.mode === "survival") s.objectives.survival.nextWaveTick = s.tick + s.rules.survival.intervalTicks;
  updatePopulation2(s);
}
function isGameOver(s) {
  return s.winner !== null || s.draw;
}
function isVisible2(s, side2, x, y, level2 = 0) {
  return x >= 0 && y >= 0 && x < s.width && y < s.height && !!s.visible[side2]?.has(fogKey(s, { x, y, level: level2 }));
}
function refreshVisibility(s) {
  updateBeacons(s, false);
  for (const visible5 of s.visible) visible5.clear();
  for (const e of s.entities) {
    if (!alive2(e) || e.kind === "building" && buildingDef(s, e).tags?.includes("beacon") && !e.beacon?.connected) continue;
    const sight = ((e.kind === "unit" ? unitDef(s, e).sight : buildingDef(s, e).sight) + highGroundSightBonus(s, e)) * environmentalSightFactor(s, e), side2 = e.side;
    for (let y = Math.max(0, Math.floor(e.y - sight)); y <= Math.min(s.height - 1, Math.ceil(e.y + sight)); y++) for (let x = Math.max(0, Math.floor(e.x - sight)); x <= Math.min(s.width - 1, Math.ceil(e.x + sight)); x++) if (length2D(x + 0.5 - e.x, y + 0.5 - e.y) <= sight && terrainLineOfSight(s, e, { x: x + 0.5, y: y + 0.5, level: levelOf(e) })) {
      const key = fogKey(s, { x, y, level: levelOf(e) });
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
function updatePopulation2(s) {
  for (const side2 of playerSides(s)) {
    const es = s.entities.filter((e) => e.side === side2 && alive2(e) && !isCrewless(e));
    s.players[side2].population = es.filter((e) => e.kind === "unit" && !e.illusion).length;
    s.players[side2].cap = Math.min(s.populationLimits[side2], es.filter((e) => e.kind === "building" && e.progress === 1).reduce((v, e) => v + (e.role === "hq" ? 12 : e.role === "depot" && e.definitionId !== TROPHY_STANDARD.id ? 10 : 0), 0));
  }
}
function reserved(s, side2) {
  return s.entities.filter((e) => e.side === side2 && alive2(e)).reduce((v, e) => v + e.queue.length, 0) + (economicState(s)?.recruits.filter((r) => r.side === side2).length ?? 0);
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
  for (const e of s.entities) if (e.kind === "building" && alive2(e) && isHostile(s, e.side, side2) && !isVisible2(s, side2, e.x, e.y, levelOf(e))) fogged.add(e);
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
  const observed2 = { ...s, entities: s.entities.filter((e) => canObserveTacticalEntity(s, side2, e)), resources: s.resources.filter((r) => isVisible2(s, side2, r.x, r.y, levelOf(r))) };
  return openDestination(observed2, to, from);
}
function movementOrder(s, e, order3, dt, reach) {
  const destination = openDestination(s, order3, e);
  return destination ? move(s, e, destination, dt, reach) : false;
}
function refundCost(s, side2, role, id6, paid) {
  const cost5 = paid ?? unitFor(s, side2, role, id6).cost, p = s.players[side2];
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
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) if (!isVisible2(s, side2, x + dx, y + dy, level2)) return false;
  for (let ty = Math.floor(y - r); ty < Math.ceil(y + r); ty++) for (let tx = Math.floor(x - r); tx < Math.ceil(x + r); tx++) if (!TERRAIN[terrainAt(s, tx + 0.5, ty + 0.5, level2)].buildable) return false;
  if (s.entities.some((e) => alive2(e) && levelOf(e) === level2 && e.kind === "building" && Math.abs(e.x - x) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4) && Math.abs(e.y - y) < radius(s, e) + r + (["wall", "gate"].includes(role) && ["wall", "gate"].includes(e.role) ? 0 : 0.4))) return false;
  if (s.entities.some((e) => alive2(e) && levelOf(e) === level2 && e.kind === "unit" && isHostile(s, e.side, side2) && footprintOverlap(e, x, y, def.size))) return false;
  if (s.resources.some((e) => e.amount > 0 && levelOf(e) === level2 && Math.abs(e.x - x) < r + 0.8 && Math.abs(e.y - y) < r + 0.8)) return false;
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
      const target = s.entities.find((t) => t.id === order3.target && alive2(t) && isHostile(s, t.side, e.side));
      if (!target || !sameLevel(e, target) || !canObserveTacticalEntity(s, e.side, target)) continue;
    }
    if (order3.type === "gather" && !s.resources.some((n) => n.id === order3.target && n.amount > 0 && sameLevel(e, n))) continue;
    if (order3.type === "build" && !s.entities.some((t) => t.id === order3.target && alive2(t) && isAllied(s, t.side, e.side) && t.kind === "building" && sameLevel(e, t) && (t.progress < 1 || t.hp < t.maxHp))) continue;
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
  if (isPlayerCommand(c)) return applyAlliedPlayerCommand(s, side2, c, runtime(s).teamAI, (viewer, x, y, level2) => isVisible2(s, viewer, x, y, level2));
  if ("ids" in c && ["worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage", "ignite", "firebreak"].includes(c.type)) {
    const ids = c.ids.filter((id6) => !s.entities.some((e) => e.id === id6 && economyUnitDefinition(s, e)));
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
    for (const gate of s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && alive2(e) && e.role === "gate" && e.progress === 1)) {
      if (gate.gateOpen && s.entities.some((e) => alive2(e) && sameLevel(e, gate) && e.kind === "unit" && footprintOverlap(e, gate.x, gate.y, buildingDef(s, gate).size))) continue;
      gate.gateOpen = !gate.gateOpen;
      changed = true;
    }
    return changed;
  }
  if (c.type === "setRally" || c.type === "clearRally") {
    const producers = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && alive2(e) && e.kind === "building" && (e.role === "hq" || e.role === "barracks"));
    if (!producers.length || c.type === "setRally" && producers.some((e) => levelOf(e) !== (c.level ?? 0))) return false;
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
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive2(e2) && e2.kind === "building");
    if (!e || !Number.isInteger(c.index) || c.index < 0 || c.index >= e.queue.length) return false;
    refundCost(s, side2, e.queue[c.index], e.queueDefinitionIds?.[c.index], e.queuePaidCosts?.[c.index]);
    e.queue.splice(c.index, 1);
    e.queueDefinitionIds?.splice(c.index, 1);
    e.queuePaidCosts?.splice(c.index, 1);
    if (c.index === 0) e.trainProgress = 0;
    return true;
  }
  if (c.type === "reorderTrain") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive2(e2) && e2.kind === "building" && e2.progress === 1 && (e2.role === "hq" || e2.role === "barracks"));
    if (!e || !Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 1 || c.to < 1 || c.from >= e.queue.length || c.to >= e.queue.length || c.from === c.to) return false;
    const [role] = e.queue.splice(c.from, 1);
    e.queue.splice(c.to, 0, role);
    if (e.queueDefinitionIds) {
      const [id6] = e.queueDefinitionIds.splice(c.from, 1);
      e.queueDefinitionIds.splice(c.to, 0, id6);
      if (e.queuePaidCosts) {
        const [cost5] = e.queuePaidCosts.splice(c.from, 1);
        e.queuePaidCosts.splice(c.to, 0, cost5);
      }
    }
    return true;
  }
  if (c.type === "train") {
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive2(e2) && e2.kind === "building" && e2.progress === 1);
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
    const e = s.entities.find((e2) => e2.id === c.id && e2.side === side2 && alive2(e2) && e2.kind === "building" && e2.progress === 1);
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
  const units = s.entities.filter((e) => c.ids.includes(e.id) && e.side === side2 && alive2(e) && e.kind === "unit" && !e.illusion && !isCrewless(e) && !(["attack", "attackMove", "ability"].includes(c.type) && economyUnitDefinition(s, e))).sort((a, b) => a.id - b.id);
  if (!units.length) return false;
  if (c.type === "formation") {
    const army = units.filter((e) => e.role !== "worker" && e.role !== "siege" && sameLevel(e, units[0]));
    if (!army.length) return false;
    const anchor = army.reduce((p2, e) => ({ x: p2.x + e.x / army.length, y: p2.y + e.y / army.length }), { x: 0, y: 0 });
    setFormation(s, army, c.formation, c.spacing, c.facing, { ...anchor, level: levelOf(army[0]) });
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
    const level2 = c.level ?? 0, workers2 = units.filter((e) => e.role === "worker" && !economyUnitDefinition(s, e) && levelOf(e) === level2);
    const d = c.definitionId ? availableBuildings(s, side2).find((d2) => d2.id === c.definitionId && d2.role === c.role) : f.buildings[c.role];
    if (!workers2.length || !d || !isNormalBuildingDefinition(d) || playerAge(p) < buildingAgeRequired(d) || p.wood < d.cost.wood || p.ore < d.cost.ore || p.crystal < d.cost.crystal || !canPlace(s, side2, c.role, c.x, c.y, c.definitionId, level2)) return false;
    const overlapping = s.entities.filter((e) => e.kind === "unit" && alive2(e) && levelOf(e) === level2 && isAllied(s, e.side, side2) && footprintOverlap(e, c.x, c.y, d.size));
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
    const formed = units.filter((e) => !!e.tactics?.formation && levelOf(e) === (c.level ?? 0));
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
  const target = c.type === "gather" ? s.resources.find((e) => e.id === c.target && e.amount > 0) : s.entities.find((e) => e.id === c.target && alive2(e));
  if (!target || !isVisible2(s, side2, target.x, target.y, levelOf(target)) || "side" in target && !canObserveTacticalEntity(s, side2, target)) return false;
  if (c.type === "attack") {
    if (!("side" in target) || !isHostile(s, target.side, side2) && !isCrewless(target)) return false;
    for (const e of units) if (e.tactics) {
      delete e.tactics.ambush;
      delete e.tactics.capture;
      if (e.tactics.formation) e.tactics.formation.phase = "broken";
    }
    return units.filter((e) => sameLevel(e, target)).reduce((accepted, e) => commandOrder(s, e, { type: "attack", target: target.id }, c.queued) || accepted, false);
  }
  const workers = units.filter((e) => e.role === "worker" && !economyUnitDefinition(s, e) && sameLevel(e, target));
  if (!workers.length) return false;
  if (c.type === "repair" && (!("side" in target) || !isAllied(s, target.side, side2) || target.kind !== "building" || target.hp >= target.maxHp && target.progress >= 1)) return false;
  return workers.reduce((accepted, e) => commandOrder(s, e, { type: c.type === "gather" ? "gather" : "build", target: target.id }, c.queued) || accepted, false);
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
    const originalFaction = e.definitionFaction ?? s.players[e.side].faction, raisedDefinition = availableUnits({ content: s.content, players: [{ faction: originalFaction }] }, 0).find((unit4) => unit4.role === "melee" && definitionAllowed(s, e.side, unit4.id));
    if (!raisedDefinition) return false;
    updatePopulation2(s);
    let count = 0;
    const delivered = e.factionState?.deliveredCorpses ?? [];
    for (const corpse of [...delivered, ...s.corpses].sort((a, b) => distance11(e, a) - distance11(e, b))) {
      if (count >= 2 || s.players[e.side].population + reserved(s, e.side) >= s.players[e.side].cap) break;
      const cached = delivered.includes(corpse), point5 = cached ? openDestination(s, { x: e.x + 0.7, y: e.y + 0.7, level: levelOf(e) }, e) : corpse;
      if (corpse.expires <= s.time || !point5 || !cached && (distance11(e, corpse) > 6 || !isVisible2(s, e.side, corpse.x, corpse.y, levelOf(corpse))) || !walkable(s, point5.x, point5.y, levelOf(point5))) continue;
      const raised = spawnEntity(s, e.side, "unit", "melee", point5.x, point5.y, 1, raisedDefinition.id, levelOf(point5), e.definitionFaction);
      raised.hp = raised.maxHp * 0.5;
      raised.raised = true;
      raised.expires = s.time + 35;
      raised.order = { type: "attackMove", x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } };
      s.corpses = s.corpses.filter((c) => c.id !== corpse.id);
      if (e.factionState?.deliveredCorpses) e.factionState.deliveredCorpses = e.factionState.deliveredCorpses.filter((c) => c.id !== corpse.id);
      count++;
      updatePopulation2(s);
    }
    if (!count) return false;
    runtime(s).abilities.set(e.id, s.time + 22);
  } else if (ability === "illusion") {
    if (!definitionAllowed(s, e.side, definition2.id)) return false;
    let placed = 0;
    for (const offset of [-0.6, 0.6]) {
      const desired = { x: clamp3(e.x + offset, 0.5, s.width - 0.5), y: clamp3(e.y - offset, 0.5, s.height - 0.5), ...e.level === void 0 ? {} : { level: e.level } };
      const point5 = walkable(s, desired.x, desired.y, levelOf(e)) ? desired : openDestination(s, desired, e);
      if (!point5) continue;
      const clone2 = spawnEntity(s, e.side, "unit", e.role, point5.x, point5.y, 1, definition2.id, levelOf(e), e.definitionFaction);
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
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive2(ally) && ally.kind === "unit" && !ally.illusion && distance11(e, ally) < 5) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 35);
      ally.surgeUntil = s.time + 6;
      affected = true;
    }
    if (!affected) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "ward") {
    let restored = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive2(ally) && ally.kind === "unit" && !ally.illusion && distance11(e, ally) < 5 && (ally.shield ?? 0) < (ally.maxShield ?? 0)) {
      ally.shield = Math.min(ally.maxShield, (ally.shield ?? 0) + 24);
      restored = true;
    }
    if (!restored) return false;
    runtime(s).abilities.set(e.id, s.time + 20);
  } else if (ability === "heal") {
    let healed = false;
    for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive2(ally) && ally.kind === "unit" && !ally.illusion && distance11(e, ally) < 5 && ally.hp < ally.maxHp) {
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
  const id6 = e.research, def = upgradeFor(s, e.side, id6);
  if (canCompleteResearch(s, e.side, id6, e.id)) {
    s.players[e.side].upgrades.push(id6);
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
  for (const id6 of s.players[e.side].upgrades) {
    const u = upgradeFor(s, e.side, id6);
    if (upgradeAppliesTo(u, unitDef(s, e))) factor *= u.effects[effect] ?? 1;
  }
  return factor;
}
function movementSpeed(s, e) {
  const terrain2 = terrainAt(s, e.x, e.y, levelOf(e));
  const terrainSpeed = factionFor(s, e.side).terrainSpeeds?.[terrain2] ?? TERRAIN[terrain2].speed;
  return unitDef(s, e).speed * progressionStats(s, e).speedFactor * terrainSpeed * environmentalMovementFactor(s, e) * upgradeFactor(s, e, "speed") * factionMovementFactor(e) * (e.illusion ? 1.08 : 1) * ((e.surgeUntil ?? 0) > s.time ? 1.25 : 1);
}
function move(s, e, to, dt, reach = 0.45) {
  if (!sameLevel(e, to)) return false;
  if (distance11(e, to) <= reach) {
    e.path = [];
    return true;
  }
  if (distance11(e, to) < reach + 0.85) {
    const d2 = distance11(e, to), amount2 = Math.min(d2 - reach + 0.02, movementSpeed(s, e) * dt), x = e.x + (to.x - e.x) / d2 * amount2, y = e.y + (to.y - e.y) / d2 * amount2;
    if (segmentWalkable(s, e, { x, y, level: levelOf(e) })) {
      walkTo(e, x, y);
      return distance11(e, to) <= reach;
    }
  }
  const rt = runtime(s), key = `${s.world?.revision ?? 0},${levelOf(to)},${Math.floor(to.x * 2)},${Math.floor(to.y * 2)},${reach.toFixed(1)}`, cache = rt.routes.get(e.id);
  if (!cache || cache.key !== key || !e.path.length && s.time - cache.at > 1.3 || s.time - cache.at > 5) {
    e.path = route(s, e, to, reach, e.side);
    rt.routes.set(e.id, { key, at: s.time });
  }
  while (e.path.length > 1 && distance11(e, e.path[0]) < 0.6 && segmentWalkable(s, e, e.path[1])) e.path.shift();
  if (!e.path.length) return false;
  const p = e.path[0], d = distance11(e, p), speed = movementSpeed(s, e), amount = Math.min(d, speed * dt);
  if (d < 0.09) {
    e.path.shift();
    return false;
  }
  const nx = e.x + (p.x - e.x) / d * amount, ny = e.y + (p.y - e.y) / d * amount;
  if (segmentWalkable(s, e, { x: nx, y: ny, level: levelOf(e) })) {
    walkTo(e, nx, ny);
  } else if (segmentWalkable(s, e, { x: nx, y: e.y, level: levelOf(e) }) && Math.abs(nx - e.x) > 1e-3) {
    walkTo(e, nx, e.y);
  } else if (segmentWalkable(s, e, { x: e.x, y: ny, level: levelOf(e) }) && Math.abs(ny - e.y) > 1e-3) {
    walkTo(e, e.x, ny);
  } else {
    e.path = [];
    rt.routes.delete(e.id);
  }
  if (d <= amount + 0.06) e.path.shift();
  return distance11(e, to) <= reach;
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
function targetDistance(s, at, target) {
  return isBridgeTarget(target) ? Math.min(...target.tiles.map((tile) => distance11(at, { x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: target.level }))) : distance11(at, target);
}
function targetPoint(s, source2, target) {
  return isBridgeTarget(target) ? target.tiles.map((tile) => ({ x: tile % s.width + 0.5, y: Math.floor(tile / s.width) + 0.5, level: target.level })).sort((a, b) => distance11(source2, a) - distance11(source2, b))[0] : target;
}
function queueWeaponHit(s, a, b, raw, ranged, crew = false, armorPiercing = false, weapon = true) {
  const entity = isEntityTarget(b), def = entity && b.kind === "unit" ? unitDef(s, b) : void 0;
  const armor = !entity || armorPiercing ? 0 : (def?.armor ?? 3) + progressionStats(s, b).armor + factionArmorBonus(s, b) + (emplaced(s, b) ? 2 : 0) + s.players[b.side].upgrades.reduce((sum, id6) => {
    const u = upgradeFor(s, b.side, id6);
    return sum + (def && upgradeAppliesTo(u, def) ? u.effects.armor ?? 0 : 0);
  }, 0);
  const point5 = targetPoint(s, a, b), height = a.elevation === void 0 ? highGroundDamageFactor(s, a, point5) : 1 + 0.12 * Math.max(0, Math.min(3, a.elevation - elevationAt(s, point5))), environment = ranged ? projectileEnvironment(s, a, point5).damageFactor * height : 1;
  const flank = entity && weapon ? facingDamageFactor(a, b) : 1, cover = entity && ranged && weapon ? rangedCoverFactor(s, a, b) : 1, event = emit(s, "attack", a, b.id), hit = Math.max(1, raw * environment * flank * cover - armor);
  runtime(s).hits.push({ source: { id: a.id, side: a.side, x: a.x, y: a.y, furyEligible: a.furyEligible ?? ("kind" in a ? a.kind === "unit" && !a.illusion : "definitionId" in a), ...a.level === void 0 ? {} : { level: a.level } }, target: b, amount: hit, event, crew, ranged });
}
function damage(s, a, b) {
  if (!factionCanFire(s, a) || isCrewless(a) || !sameLevel(a, b)) return;
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
      (s.projectiles ??= []).push({ id: s.nextId++, source: a.id, side: a.side, faction: a.definitionFaction ?? s.players[a.side].faction, from: { x: a.x, y: a.y, level: levelOf(a), elevation: elevationAt(s, a) }, x: point5.x, y: point5.y, level: levelOf(point5), damage: raw, buildingMultiplier: d?.buildingDamageMultiplier ?? 1, impactAt: s.time + 0.25 + distance11(a, point5) / 12, radius: factionSplashRadius(a), modification });
      emit(s, "ability", a, b.id, "Siege shell launched");
    }
  } else {
    const entity = isEntityTarget(b), building4 = isBridgeTarget(b) || entity && b.kind === "building", impact = entity ? cavalryImpact(s, a, b) : { factor: 1, pikeDamage: 0 }, multiplier = building4 ? d?.buildingDamageMultiplier ?? 1 : entity ? d?.bonusAgainst?.[b.role] ?? 1 : 1, crew = entity && b.role === "siege" && !isCrewless(b) && (d?.range ?? 7) <= 2.2;
    queueWeaponHit(s, a, b, raw * multiplier * impact.factor * (modification === "stone" && building4 ? 1.25 : modification === "grapeshot" && !building4 ? 1.5 : 1), (d?.range ?? 7) > 2.2, crew);
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
      const entity = isEntityTarget(target), building4 = isBridgeTarget(target) || entity && target.kind === "building", range = targetDistance(s, shell, target);
      if (target.hp <= 0 || !sameLevel(shell, target) || range > shell.radius + targetRadius(s, target) || !friendlyFire && entity && isAllied(s, shell.side, target.side) && !isCrewless(target)) continue;
      queueWeaponHit(s, source2, target, shell.damage * (shell.modification === "stone" && building4 ? 1.25 : shell.modification === "grapeshot" && !building4 ? 1.5 : 1) * (building4 ? shell.buildingMultiplier : 1) * (1 - 0.4 * Math.min(1, range / shell.radius)), true);
    }
    if (shell.modification === "incendiary") igniteWorldAt(s, shell, { id: shell.source, side: shell.side });
    emit(s, "ability", { id: shell.source, side: shell.side, x: shell.x, y: shell.y, level: levelOf(shell) }, void 0, "Siege impact");
  }
  s.projectiles = pending;
}
function die(s, e, text5, sourceSide) {
  if (e.animation === "death") return;
  const carried = e.carried;
  onEconomyDeath(s, e, economyHooks);
  for (const body2 of [...e.factionState?.corpseCargo ?? [], ...e.factionState?.deliveredCorpses ?? []]) if (body2.expires > s.time) s.corpses.push({ ...body2, x: e.x, y: e.y, level: e.level });
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
  const event = emit(s, "death", e, void 0, text5);
  if (carried > 0) event.amount = carried;
}
function enemy(s, e, max, onlyInRange = false) {
  let best, bestDist = Infinity;
  for (const b of s.entities) {
    if (!alive2(b) || !isHostile(s, b.side, e.side) || isCrewless(b) || !canObserveTacticalEntity(s, e.side, b) || onlyInRange && !near(s, e, b, max)) continue;
    const d = distance11(e, b) - radius(s, b);
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
  if (!sameLevel(e, b)) return;
  if (near(s, e, b, range) && terrainLineOfSight(s, e, b)) {
    if (e.order.type !== "hold" && e.tactics?.formation?.phase !== "formed") e.facing = facing8(b.x - e.x, b.y - e.y);
    if (e.cooldown <= 0) damage(s, e, b);
  } else if (e.kind === "unit") move(s, e, b, dt, range + (b.kind === "building" ? radius(s, b) : 0) - 0.1);
}
function gather(s, e, target, dt) {
  const node = s.resources.find((n) => n.id === target && sameLevel(n, e));
  const rt = runtime(s), finite2 = rt.queuedGather.has(e.id) || !!e.orderQueue?.length;
  if (e.carried >= 18 || node?.amount === 0 && e.carried > 0 || finite2 && (!node || node.amount <= 0) && e.carried > 0) rt.returning.add(e.id);
  if (rt.returning.has(e.id)) {
    const depot2 = economyGatherDepot(s, e) ?? s.entities.filter((b) => b.side === e.side && sameLevel(b, e) && alive2(b) && b.kind === "building" && b.progress === 1 && (b.role === "hq" || b.role === "depot" && b.definitionId !== TROPHY_STANDARD.id)).sort((a, b) => distance11(e, a) - distance11(e, b))[0];
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
    const next = s.resources.filter((n) => n.amount > 0 && sameLevel(n, e) && n.kind === (node?.kind ?? e.carriedKind) && isVisible2(s, e.side, n.x, n.y, levelOf(n))).sort((a, b) => distance11(e, a) - distance11(e, b))[0];
    assign(s, e, next ? { type: "gather", target: next.id } : { type: "idle" });
    return;
  }
  if (e.carried > 0 && e.carriedKind !== node.kind) {
    rt.returning.add(e.id);
    return;
  }
  if (distance11(e, node) > 1.2) {
    move(s, e, node, dt, 1.1);
    return;
  }
  e.animation = "attack";
  e.carriedKind = node.kind;
  const amount = Math.min(node.amount, dt * ECONOMY.harvestPerSecond * upgradeFactor(s, e, "gather") * economyGatherFactor(s, e, node) * (node.kind === "crystal" ? 0.6 : 1), 18 - e.carried);
  node.amount -= amount;
  e.carried += amount;
}
function construct(s, e, id6, dt) {
  const b = s.entities.find((b2) => b2.id === id6 && alive2(b2) && sameLevel(b2, e) && isAllied(s, b2.side, e.side) && b2.kind === "building");
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
      updatePopulation2(s);
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
    if (walkable(s, p.x, p.y, levelOf(e))) {
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
  const u = spawnEntity(s, e.side, "unit", role, point5.x, point5.y, 1, e.queueDefinitionIds?.[0], levelOf(e));
  recordEconomyPaid(s, u, e.queuePaidCosts?.[0] ?? d.cost);
  if (role !== "worker") runtime(s).producedFighters[e.side]++;
  e.trainProgress = 0;
  e.queue.shift();
  e.queueDefinitionIds?.shift();
  e.queuePaidCosts?.shift();
  emit(s, "train", u);
  updatePopulation2(s);
  if (e.rally) issueCommand(s, e.side, { type: "move", ids: [u.id], ...e.rally });
}
function separateUnits(s) {
  const units = s.entities.filter((e) => e.kind === "unit" && alive2(e));
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j], d = distance11(a, b);
    if (d >= 0.58) continue;
    const dx = d > 1e-3 ? (a.x - b.x) / d : a.id % 2 ? 1 : -1, dy = d > 1e-3 ? (a.y - b.y) / d : 0.3, push = (0.58 - d) * 0.22;
    const ax = a.x + dx * push, ay = a.y + dy * push, bx = b.x - dx * push, by = b.y - dy * push;
    if (!isCrewless(a) && walkable(s, ax, ay, levelOf(a))) {
      a.x = ax;
      a.y = ay;
    }
    if (!isCrewless(b) && walkable(s, bx, by, levelOf(b))) {
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
      const total2 = hits.reduce((n, h) => n + h.amount, 0), actual2 = Math.min(target.hp, total2);
      target.hp = Math.max(0, target.hp - total2);
      for (const hit of hits) {
        hit.event.amount = total2 ? actual2 * hit.amount / total2 : 0;
        credit(hit.source, target, hit.event.amount);
      }
      if (target.hp === 0) {
        const killer = hits.reduce((best, h) => h.amount > best.amount ? h : best).source;
        if (isBridgeTarget(target)) collapseBridge(s, target, killer.side, { move: (actor3, to, dt, reach) => move(s, actor3, to, dt, reach), finish: (actor3) => finishOrder(s, actor3), interrupt: (actor3) => interruptWorldOrder(s, actor3), die: (actor3, text5) => die(s, actor3, text5) });
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
    const total = engineHits.reduce((n, h) => n + h.amount, 0), networkAbsorbed = absorbFactionShield(s, target, total), ownAbsorbed = Math.min(target.shield ?? 0, total - networkAbsorbed), absorbed = networkAbsorbed + ownAbsorbed, actual = Math.min(target.hp, total - absorbed) + absorbed;
    target.shield = Math.max(0, (target.shield ?? 0) - ownAbsorbed);
    target.hp = Math.max(0, target.hp - (total - absorbed));
    if (total || crewDamage) target.lastDamagedAt = s.time;
    for (const hit of engineHits) {
      hit.event.amount = total ? actual * hit.amount / total : 0;
      credit(hit.source, target, hit.event.amount);
    }
    if (actual > 0 && engineHits.some((hit) => (hit.event.amount ?? 0) > 0 && isHostile(s, hit.source.side, target.side) && (() => {
      const actor3 = s.entities.find((e) => e.id === hit.source.id && e.side === hit.source.side);
      return !actor3 || !actor3.illusion && !actor3.raised;
    })())) recordCombatExposure(s, target);
    recordTacticsDamage(s, target, total - absorbed);
    if (total || crewDamage) {
      const killer = hits.reduce((best, h) => h.amount > best.amount ? h : best).source;
      target.lastAttacker = killer.id;
      if (target.hp === 0) {
        credit(killer, target, 0, true);
        die(s, target, void 0, killer.side);
      }
    }
  }
  if (s.rules.standardDefeat) {
    s.eliminated = playerSides(s).map((side2) => !s.entities.some((e) => e.side === side2 && e.role === "hq" && alive2(e) && e.progress === 1));
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
  if (!sameLevel(actor3, to)) return false;
  const d = distance11(actor3, to);
  if (d <= reach) {
    actor3.path = [];
    return true;
  }
  if (!actor3.path.length || distance11(actor3.path[actor3.path.length - 1], to) > reach + 0.7) actor3.path = route(s, actor3, to, reach);
  while (actor3.path.length && distance11(actor3, actor3.path[0]) < 0.08) actor3.path.shift();
  const point5 = actor3.path[0];
  if (!point5) return false;
  const distanceTo = distance11(actor3, point5), amount = Math.min(distanceTo, dt * 1.7), next = { x: actor3.x + (point5.x - actor3.x) / distanceTo * amount, y: actor3.y + (point5.y - actor3.y) / distanceTo * amount, level: levelOf(actor3) };
  if (segmentWalkable(s, actor3, next)) {
    actor3.x = next.x;
    actor3.y = next.y;
  } else actor3.path = [];
  return distance11(actor3, to) <= reach;
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
      for (const id6 of s.draft.pool) if (applyDraftChoice(s.draft, s.rules, draftPlayers(s), side2, id6, s.content)) break;
    }
    s.tick++;
    if (s.draft.turn === s.draft.order.length) finalizeDraft(s);
    return;
  }
  dt = Math.min(dt, 0.25);
  s.time += dt;
  s.tick++;
  stepEnvironment(s, dt, { interrupt: (actor3) => interruptWorldOrder(s, actor3), die: (actor3, text5) => die(s, actor3, text5) });
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
  for (const actor3 of s.entities) if (alive2(actor3) && isCrewless(actor3)) interruptWorldOrder(s, actor3);
  for (const actor3 of s.entities) if (alive2(actor3) && economyEntityBusy(s, actor3)) {
    const faction = actor3.factionState, tunnel = faction?.tunnel, corpseOrder = faction?.corpseOrder, order3 = actor3.order;
    if (tunnel || corpseOrder || order3.type === "build") {
      interruptWorldOrder(s, actor3, order3.type === "build" ? order3 : { type: "hold" });
      if (tunnel) faction.tunnel = tunnel;
      if (corpseOrder) faction.corpseOrder = corpseOrder;
    }
  }
  for (const actor3 of s.entities) if (alive2(actor3) && actor3.specialistBuffs?.some((buff2) => buff2.until > s.time && buff2.fearedFrom) && economyEntityBusy(s, actor3)) interruptWorldOrder(s, actor3);
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
    if (!alive2(e)) {
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
        for (const ally of s.entities) if (isAllied(s, ally.side, e.side) && alive2(ally) && ally.kind === "unit" && !ally.illusion && distance11(ally, e) < 6) ally.hp = Math.min(ally.maxHp, ally.hp + dt * 2.5);
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
    const d = unitDef(s, e), before = { x: e.x, y: e.y, level: levelOf(e) };
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
      if (distance11(e, capture.target) > 1.3) move(s, e, capture.target, dt, 1.2);
      updateCharge(s, e, before, dt);
      continue;
    }
    if (e.maxShield && s.time - (e.lastDamagedAt ?? -6) >= 6) e.shield = Math.min(e.maxShield, (e.shield ?? 0) + 4 * dt);
    if (!e.illusion && (d.ability === "raise" || d.ability === "ward")) useAbility(s, e);
    const feared = e.specialistBuffs?.find((buff2) => buff2.until > s.time && buff2.fearedFrom)?.fearedFrom;
    if (feared) {
      const dx = e.x - feared.x, dy = e.y - feared.y, len = length2D(dx, dy) || 1;
      move(s, e, { x: clamp3(e.x + dx / len * 3, 0.6, s.width - 0.6), y: clamp3(e.y + dy / len * 3, 0.6, s.height - 0.6), level: levelOf(e) }, dt, 0.1);
      continue;
    }
    if (economicActors.has(e.id)) continue;
    if (economyUnitDefinition(s, e) && e.order.type !== "move" && e.order.type !== "traverse") {
      if (e.order.type !== "idle") finishOrder(s, e);
      continue;
    }
    const o = e.order;
    if (processWorldAction(s, e, dt, { attack: (actor3, target) => damage(s, actor3, target), range: (actor3, target) => weaponRange(s, actor3) * projectileEnvironment(s, actor3, targetPoint(s, actor3, target)).rangeFactor, move: (actor3, to, delta, reach) => move(s, actor3, to, delta, reach), finish: (actor3) => finishOrder(s, actor3), interrupt: (actor3) => interruptWorldOrder(s, actor3), die: (actor3, text5) => die(s, actor3, text5) })) continue;
    if (processNeutralOrder(s, e, dt, neutralHooks(s))) continue;
    if (economyUnitDefinition(s, e) && o.type !== "move") continue;
    if (o.type === "hold") {
      const b2 = enemy(s, e, weaponRange(s, e), true);
      if (b2 && near(s, e, b2, weaponRange(s, e))) {
        fight(s, e, b2, dt);
        if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s.entities.some((a) => isAllied(s, a.side, e.side) && alive2(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance11(e, a) < 5))) useAbility(s, e);
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
      const b2 = s.entities.find((b3) => b3.id === o.target && alive2(b3) && (isHostile(s, b3.side, e.side) || isCrewless(b3)));
      if (!b2 || !sameLevel(e, b2) || !canObserveTacticalEntity(s, e.side, b2)) {
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
      if (!e.illusion && (d.ability === "illusion" || d.ability === "heal" || d.ability === "surge" && s.entities.some((a) => isAllied(s, a.side, e.side) && alive2(a) && a.kind === "unit" && a.hp <= a.maxHp - 15 && distance11(e, a) < 5))) useAbility(s, e);
    } else if (o.type === "attackMove" && movementOrder(s, e, o, dt, 0.65)) finishOrder(s, e);
    updateCharge(s, e, before, dt);
  }
  stepWorldActions(s);
  stepNeutralWorld(s, dt, neutralHooks(s));
  resolveProjectiles(s);
  resolveHits(s);
  updateBeacons(s);
  refreshFormations(s);
  for (const actor3 of s.entities) if (!alive2(actor3)) onEconomyDeath(s, actor3, economyHooks);
  s.corpses = s.corpses.filter((c) => c.expires > s.time);
  separateUnits(s);
  s.entities = s.entities.filter((e) => alive2(e) || e.animTime < 1.2);
  updatePopulation2(s);
  pruneTeamAssignments(s);
  evaluateObjectives(s, { spawn: spawnEntity, command: issueCommand });
}
function pruneTeamAssignments(s) {
  const state = runtime(s).teamAI, live = new Map(s.entities.filter((e) => alive2(e) && e.kind === "unit" && e.role !== "worker" && !e.illusion).map((e) => [e.id, e]));
  for (const d of state.directives) if (d.status === "accepted" || d.status === "active") {
    d.assigned = d.assigned.filter((id6) => {
      const e = live.get(id6);
      return e?.side === d.recipient && !!d.destination && sameLevel(e, d.destination);
    });
    if (!d.assigned.length) delete d.arrivedAt;
    if (s.time >= d.expiresAt || s.eliminated[d.issuer] || s.eliminated[d.recipient] || s.controllers[d.recipient] !== "ai") {
      d.status = "failed";
      d.assigned = [];
      d.reason = s.time >= d.expiresAt ? "Request expired." : "Ally is unavailable.";
    }
  }
  state.coordinator.reservations = state.coordinator.reservations.filter((r) => !s.eliminated[r.side] && r.expiresAt > s.time && (r.role === "expand" || r.ids.every((id6) => {
    const e = live.get(id6);
    return e?.side === r.side && sameLevel(e, r.destination);
  })));
  state.coordinator.waves = state.coordinator.waves.flatMap((w) => {
    w.participants = w.participants.flatMap((p) => {
      const ids = p.ids.filter((id6) => {
        const e = live.get(id6);
        return e?.side === p.side && !s.eliminated[p.side] && sameLevel(e, w.target);
      });
      return ids.length ? [{ side: p.side, ids }] : [];
    });
    return w.participants.length ? [w] : [];
  });
}
function alliedAiStatus(s, side2) {
  return alliedAiObservation(s, side2, runtimes.get(s)?.teamAI ?? emptyTeamAiState());
}
function aiRecruitDefinitions(s, side2) {
  const age = playerAge(s.players[side2]), available = availableUnits(s, side2);
  return Object.values(factionFor(s, side2).units).flatMap((def) => {
    const chosen = definitionAllowed(s, side2, def.id) ? def : available.find((candidate) => candidate.role === def.role && !candidate.tags?.includes("hero") && (candidate.age ?? 1) <= age && definitionAllowed(s, side2, candidate.id));
    return chosen && (chosen.age ?? 1) <= age ? [chosen] : [];
  });
}
function hasRecoverableAiIncome(s, side2, owned2 = s.entities.filter((e) => e.side === side2 && alive2(e))) {
  const scope = aiRecoveryScopes.get(s);
  if (!scope) return computeRecoverableAiIncome(s, side2, owned2);
  const p = s.players[side2];
  const key = JSON.stringify([p.wood, p.ore, p.crystal, p.population, p.cap, playerAge(p), s.nextId, owned2.map((e) => [e.id, e.role, e.hp, e.progress, e.queue, e.order, runtime(s).returning.has(e.id)]), s.entities.filter((e) => e.kind === "building" && (e.side === side2 || isVisible2(s, side2, e.x, e.y, levelOf(e)))).map((e) => [e.id, e.gateOpen])]);
  const cached = scope.get(side2);
  if (cached?.key === key) return cached.value;
  const value = computeRecoverableAiIncome(s, side2, owned2);
  scope.set(side2, { key, value });
  return value;
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
  const workers = owned2.filter((e) => e.kind === "unit" && e.role === "worker" && !e.illusion);
  if (workers.length && recruits.some((d) => kinds3.every((kind) => bank[kind] >= d.cost[kind]))) return true;
  if (s.incomeFactors[side2] <= 0) return false;
  const nodes = s.resources.filter((n) => n.amount > 0 && isVisible2(s, side2, n.x, n.y, levelOf(n)));
  const depots = buildings2.filter((b) => b.progress === 1 && (b.role === "hq" || b.role === "depot"));
  if (!depots.length) return false;
  const cells = s.width * s.height, known2 = s.explored[side2];
  const view = {
    ...s,
    entities: s.entities.filter((e) => e.side === side2 || isVisible2(s, side2, e.x, e.y, levelOf(e))),
    resources: nodes,
    terrain: s.terrain.map((tile, index2) => known2.has(index2) ? tile : "grass"),
    world: s.world ? { ...s.world, levels: s.world.levels.map((level2) => ({ ...level2, terrain: level2.terrain.map((tile, index2) => known2.has(level2.id * cells + index2) ? tile : "grass"), elevation: level2.elevation.map((height, index2) => known2.has(level2.id * cells + index2) ? height : 0) })) } : void 0
  };
  const spawnPoint = (producer) => {
    const direction = side2 === 0 ? 1 : -1;
    for (let ring = radius(s, producer) + 1; ring <= radius(s, producer) + 6; ring += 0.5) for (const [dx, dy] of DIRECTIONS_24) {
      const point5 = { x: producer.x + dx * ring * direction, y: producer.y + dy * ring * direction, ...producer.level === void 0 ? {} : { level: producer.level } };
      if (walkable(view, point5.x, point5.y, levelOf(point5))) return point5;
    }
    return void 0;
  };
  const hqs = buildings2.filter((b) => b.role === "hq" && b.progress === 1), worker = definitions.find((d) => d.role === "worker");
  const paid = hqs.filter((b) => b.queue.includes("worker") && p.population < p.cap).flatMap((b) => {
    const point5 = spawnPoint(b);
    return point5 ? [point5] : [];
  });
  const collectors = [...workers, ...paid], budgets = collectors.length ? [{ collectors, bank }] : [];
  if (worker && p.population + reserved(s, side2) < p.cap && kinds3.every((kind) => bank[kind] >= worker.cost[kind])) {
    for (const producer of hqs.filter((b) => b.queue.length < 5)) {
      const point5 = spawnPoint(producer);
      if (point5) budgets.push({ collectors: [...collectors, point5], bank: { wood: bank.wood - worker.cost.wood, ore: bank.ore - worker.cost.ore, crystal: bank.crystal - worker.cost.crystal } });
    }
  }
  if (!budgets.length) return false;
  const delivery = (from) => {
    const depot2 = depots.filter((b) => sameLevel(b, from)).sort((a, b) => distance11(from, a) - distance11(from, b))[0];
    if (!depot2) return false;
    const reach = radius(s, depot2) + 1, d = distance11(from, depot2);
    if (d <= reach) return true;
    const approach = { x: depot2.x + (from.x - depot2.x) / d * reach, y: depot2.y + (from.y - depot2.y) / d * reach, ...from.level === void 0 ? {} : { level: from.level } };
    return segmentWalkable(view, from, approach) || route(view, from, depot2, reach, side2).length > 0;
  };
  const cargo = { wood: 0, ore: 0, crystal: 0 };
  const harvestPoint = (from, node) => {
    if (!sameLevel(from, node)) return void 0;
    const d = distance11(from, node);
    if (d <= 1.2 && walkable(view, from.x, from.y, levelOf(from))) return from;
    const approach = { x: node.x + (from.x - node.x) / d * 1.1, y: node.y + (from.y - node.y) / d * 1.1, ...node.level === void 0 ? {} : { level: node.level } };
    if (segmentWalkable(view, from, approach)) return approach;
    const endpoint = route(view, from, node, 1.1, side2).at(-1);
    if (!endpoint) return void 0;
    if (distance11(endpoint, node) <= 1.2) return endpoint;
    return route(view, from, node, 1, side2).at(-1);
  };
  for (const worker2 of workers) {
    if (worker2.carried <= 0 || !delivery(worker2)) continue;
    const gathering = worker2.order.type === "gather", available = worker2.order.type === "idle" || gathering;
    const current = gathering ? s.resources.find((node) => node.id === worker2.order.target && isVisible2(s, side2, node.x, node.y, levelOf(node))) : void 0;
    const returning = gathering && (runtime(s).returning.has(worker2.id) || worker2.carried >= 18 || !!current && (current.amount <= 0 || current.kind !== worker2.carriedKind));
    const trigger = available && nodes.some((node) => sameLevel(node, worker2) && (node.kind !== worker2.carriedKind || (() => {
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
    const owned2 = s.entities.filter((e) => e.side === side2 && alive2(e)), hq = owned2.find((e) => e.role === "hq" && e.progress === 1);
    if (!hq || !hasRecoverableAiIncome(s, side2, owned2)) continue;
    const requested = new Set(rt.teamAI.directives.filter((d) => d.recipient === side2 && (d.status === "accepted" || d.status === "active")).flatMap((d) => d.assigned));
    const army = owned2.filter((e) => e.kind === "unit" && e.role !== "worker" && !e.illusion && !rt.retreating[side2].has(e.id) && !requested.has(e.id) && e.entrenchedAt === void 0 && sameLevel(e, hq));
    const seen = s.entities.filter((e) => alive2(e) && isHostile(s, side2, e.side) && isVisible2(s, side2, e.x, e.y, levelOf(e)));
    const enemies = playerSides(s).filter((other) => isHostile(s, side2, other) && !s.eliminated[other]);
    const targets = [...rt.knownEnemyBuildings[side2]].map(([id6, point5]) => ({ key: `entity:${id6}`, kind: point5.role === "hq" ? "hq" : "building", x: point5.x, y: point5.y, ...point5.level === void 0 ? {} : { level: point5.level }, observer: side2, seenAt: 0 }));
    for (const enemy2 of seen) targets.push({ key: `entity:${enemy2.id}`, kind: enemy2.kind === "building" ? enemy2.role === "hq" ? "hq" : "building" : "unit", x: enemy2.x, y: enemy2.y, ...enemy2.level === void 0 ? {} : { level: enemy2.level }, observer: side2, seenAt: s.time });
    for (const enemy2 of enemies) if (!rt.clearedEnemyStarts[side2].has(enemy2)) targets.push({ key: `start:${enemy2}`, kind: "start", ...s.starts[enemy2], observer: side2, seenAt: 0 });
    targets.splice(0, targets.length, ...targets.filter((target) => sameLevel(target, hq)));
    if (!targets.length) {
      for (let y = 4.5; y < s.height - 3; y += 6) for (let x = 4.5; x < s.width - 3; x += 6) {
        const tile = fogKey(s, { x, y, level: levelOf(hq) });
        if (!isVisible2(s, side2, x, y, levelOf(hq)) && !rt.searched[side2].has(tile)) targets.push({ key: `search:${tile}`, kind: "start", x, y, ...hq.level === void 0 ? {} : { level: hq.level }, observer: side2, seenAt: 0 });
      }
      targets.splice(0, targets.length, ...targets.filter((target) => sameLevel(target, hq)));
      if (!targets.length) {
        rt.searched[side2].clear();
        const candidate = { x: Math.floor(s.width * 0.5) + 0.5, y: Math.floor(s.height * 0.5) + 0.5, ...hq.level === void 0 ? {} : { level: hq.level } };
        targets.push({ key: "search:middle", kind: "start", ...candidate, observer: side2, seenAt: 0 });
      }
    }
    const profile = aiProfile(s.aiConfigs[side2]), f = factionFor(s, side2), workers = owned2.filter((e) => e.role === "worker"), available = s.resources.filter((n) => n.amount > 300 && isVisible2(s, side2, n.x, n.y, levelOf(n)));
    const reservation = rt.teamAI.coordinator.reservations.find((r) => r.side === side2 && r.role === "scout");
    const reservedScout = reservation?.ids.length ? owned2.find((e) => e.id === reservation.ids[0]) : void 0;
    const scoutingNeeded = s.time > profile.scoutAt && (!rt.initialScoutDispatched[side2] || !!reservedScout && distance11(reservedScout, reservation.destination) > 2);
    const p = s.players[side2], config = s.aiConfigs[side2];
    const expansion = playerAge(p) >= 2 && workers.length >= profile.expansionWorkers && owned2.filter((e) => e.role === "hq").length < 2 && p.wood >= (config.personality === "expand" ? 340 : 400) && p.ore >= (config.personality === "expand" ? 160 : 220) ? available.filter((n) => sameLevel(n, hq) && distance11(n, hq) > 14 && !s.entities.some((b) => alive2(b) && isAllied(s, side2, b.side) && (b.side === side2 || isVisible2(s, side2, b.x, b.y, levelOf(b))) && (b.role === "hq" || b.role === "depot") && distance11(b, n) < 8)).sort((a, b) => distance11(a, hq) - distance11(b, hq))[0] : void 0;
    const waveReadyAt = rt.aiWave[side2] + Math.max(15, 65 / f.ai.aggression * profile.waveIntervalFactor);
    reports.push({
      side: side2,
      teamId: s.teams[side2],
      time: s.time,
      hq: { x: hq.x, y: hq.y, ...hq.level === void 0 ? {} : { level: hq.level } },
      fighters: army.map((e) => ({ id: e.id, role: e.role, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } })),
      threats: seen.filter((e) => distance11(e, hq) < 12).map((e) => ({ id: e.id, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level } })),
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
    const units = s.entities.filter((e) => e.side === assignment.side && alive2(e) && assignment.ids.includes(e.id));
    const type = assignment.role === "defend" ? "attackMove" : "move";
    if (units.some((e) => e.order.type !== type || distance11(e.order, assignment.destination) > Math.max(1.5, Math.sqrt(units.length)))) {
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
  const owned2 = s.entities.filter((e) => e.side === side2 && alive2(e)), workers = owned2.filter((e) => e.kind === "unit" && e.role === "worker" && !economyUnitDefinition(s, e)), buildings2 = owned2.filter((e) => e.kind === "building"), hq = buildings2.find((e) => e.role === "hq");
  if (!hq) return;
  const f = factionFor(s, side2), p = s.players[side2], age = playerAge(p), config = s.aiConfigs[side2], profile = aiProfile(config), rt = runtime(s);
  if (skipsAiDecision(config, ++rt.aiDecisionTurns[side2])) {
    emit(s, "message", hq, void 0, "Easy commander hesitates before issuing orders.");
    return;
  }
  const available = s.resources.filter((n) => n.amount > 0 && isVisible2(s, side2, n.x, n.y, levelOf(n)));
  const wantCrystal = (config.opening === "tower-defense" || buildings2.some((b) => b.role === "barracks")) && available.some((n) => n.kind === "crystal") ? p.crystal < 40 ? 2 : p.crystal < 100 ? 1 : 0 : 0;
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
    const kinds3 = ["wood", "ore", "crystal"].filter((k) => available.some((n) => n.kind === k)).sort((a, b) => desired[b] - assigned[b] - (desired[a] - assigned[a]));
    const kind = kinds3[0];
    if (!kind) continue;
    const node = available.filter((n) => n.kind === kind).sort((a, b) => distance11(worker, a) - distance11(worker, b))[0];
    if (node && issueCommand(s, side2, { type: "gather", ids: [worker.id], target: node.id })) {
      if (current) assigned[current.kind]--;
      assigned[kind]++;
    }
  }
  for (const site of buildings2.filter((b) => b.progress < 1)) {
    if (workers.some((w) => w.order.type === "build" && w.order.target === site.id)) continue;
    const builder = workers.filter((w) => w.order.type === "idle" || w.order.type === "gather").sort((a, b) => distance11(a, site) - distance11(b, site))[0];
    if (builder) issueCommand(s, side2, { type: "repair", ids: [builder.id], target: site.id });
  }
  const recruitDefinitions = aiRecruitDefinitions(s, side2), workerDefinition = recruitDefinitions.find((d) => d.role === "worker");
  if (workerDefinition && workers.length + hq.queue.filter((r) => r === "worker").length < (age === 1 ? profile.workerTarget : age === 2 ? profile.workerTarget + 6 : profile.workerTarget + 11) && hq.queue.length < profile.trainingQueue) issueCommand(s, side2, { type: "train", id: hq.id, role: "worker", ...workerDefinition.id === f.units.worker.id ? {} : { definitionId: workerDefinition.id } });
  const researchPlan = config.opening === "cavalry-raids" ? ["town-age", "worker-harvest", "worker-speed", "citadel-age"] : ["worker-harvest", "worker-speed", "town-age", "citadel-age"];
  if (hq.progress === 1 && !hq.research && workers.length >= 7 && (config.personality !== "rush" || s.time > 100)) for (const id6 of researchPlan) {
    const u = UPGRADES[id6];
    if (u.building === "hq" && !researchRequirement(s, side2, id6) && p.wood >= u.cost.wood + 120 && p.ore >= u.cost.ore + 80 && p.crystal >= u.cost.crystal) {
      issueCommand(s, side2, { type: "research", id: hq.id, upgrade: id6 });
      break;
    }
  }
  if (age >= 2 && workers.length >= profile.expansionWorkers && buildings2.filter((b) => b.role === "hq").length < 2 && !workers.some((w) => w.order.type === "build") && p.wood >= (config.personality === "expand" ? 340 : 400) && p.ore >= (config.personality === "expand" ? 160 : 220) && (!coordinatedAiTeam(s, side2) || rt.teamAI.coordinator.reservations.some((r) => r.side === side2 && r.role === "expand"))) {
    const deposit = available.filter((n) => n.amount > 300 && distance11(n, hq) > 14 && !s.entities.some((b) => alive2(b) && isAllied(s, side2, b.side) && (b.side === side2 || isVisible2(s, side2, b.x, b.y)) && (b.role === "hq" || b.role === "depot" && b.definitionId !== TROPHY_STANDARD.id) && distance11(b, n) < 8)).sort((a, b) => distance11(a, hq) - distance11(b, hq))[0];
    if (deposit) {
      const builder = workers.filter((w) => w.order.type === "gather" || w.order.type === "idle").sort((a, b) => distance11(a, deposit) - distance11(b, deposit))[0];
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
  if (buildRole && !workers.some((e) => e.order.type === "build")) {
    const builder = workers[0];
    if (builder) {
      const dir2 = s.starts[side2].y < s.height / 2 ? 1 : -1;
      let placed = false;
      for (let r = 5; r <= 10 && !placed; r += 2) for (let i = 0; i < 32 && !placed; i += 2) {
        const [dx, dy] = DIRECTIONS_32[i], x = hq.x + Math.round(dx * r) * dir2, y = hq.y + Math.round(dy * r) * dir2;
        if (canPlace(s, side2, buildRole, x, y)) placed = issueCommand(s, side2, { type: "build", ids: [builder.id], role: buildRole, x, y });
      }
    }
  }
  if (age >= 2 && p.wood > 220 && p.ore > 160 && !workers.some((w) => w.order.type === "build")) {
    const tower = buildings2.find((b) => b.role === "tower" && b.progress === 1), builder = workers.find((w) => w.order.type === "gather" || w.order.type === "idle");
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
    const danger = s.entities.some((e) => isHostile(s, e.side, side2) && alive2(e) && isVisible2(s, side2, e.x, e.y, levelOf(e)) && distance11(e, gate) < 9);
    if (!!gate.gateOpen === danger) issueCommand(s, side2, { type: "toggleGate", ids: [gate.id] });
  }
  const army = owned2.filter((e) => e.kind === "unit" && e.role !== "worker" && !e.illusion);
  const visibleEnemy = s.entities.filter((e) => isHostile(s, e.side, side2) && alive2(e) && e.kind === "unit" && isVisible2(s, side2, e.x, e.y, levelOf(e)));
  const planned = [...army.filter((e) => !e.raised).map((e) => e.role), ...buildings2.flatMap((e) => e.queue).filter((r) => r !== "worker")];
  rememberObservedUnits(rt.knownEnemyUnits[side2], visibleEnemy, s.time);
  const weights = counterWeights(f, config, rt.knownEnemyUnits[side2].values());
  const roles2 = recruitDefinitions.filter((d) => d.role !== "worker").map((d) => d.role);
  for (const b of buildings2.filter((e) => e.role === "barracks" && e.progress === 1)) {
    if (age >= 2 && !b.research && army.length >= 5) for (const id6 of ["forged-weapons", "tempered-armor", "veteran-arms"]) {
      const d = UPGRADES[id6];
      if (!researchRequirement(s, side2, id6) && p.wood > d.cost.wood + 180 && p.ore > d.cost.ore + 120) {
        issueCommand(s, side2, { type: "research", id: b.id, upgrade: id6 });
        break;
      }
    }
    if (b.queue.length >= profile.trainingQueue) continue;
    const commander2 = availableUnits(s, side2).find((d) => d.tags?.includes("hero"));
    if (commander2 && age >= 2 && army.length >= 5 && !heroRecruitmentReason(s, side2, commander2.id) && p.wood > commander2.cost.wood + 220 && p.ore > commander2.cost.ore + 160 && p.crystal >= commander2.cost.crystal && issueCommand(s, side2, { type: "train", id: b.id, role: commander2.role, definitionId: commander2.id })) continue;
    const nextAge = age === 1 ? "town-age" : age === 2 ? "citadel-age" : void 0;
    if (nextAge && army.length >= 7 && !hq.research && s.time > (age === 1 ? 150 : 380) && !visibleEnemy.some((e) => distance11(e, hq) < 14) && p.wood < UPGRADES[nextAge].cost.wood + 120) continue;
    const role = chooseAiRecruit(roles2, planned, weights);
    if (!role) continue;
    const definition2 = recruitDefinitions.find((d) => d.role === role);
    if (issueCommand(s, side2, { type: "train", id: b.id, role, ...definition2.id === f.units[role].id ? {} : { definitionId: definition2.id } })) planned.push(role);
  }
  const incomeRecoverable = hasRecoverableAiIncome(s, side2);
  for (const unit4 of army.filter((e) => unitDef(s, e).ability === "entrench")) {
    const target = enemy(s, unit4, unitDef(s, unit4).range + (unit4.role === "special" ? 3 : 0), true);
    if (target && unit4.entrenchedAt === void 0) issueCommand(s, side2, { type: "ability", ids: [unit4.id] });
    else if (!target && unit4.entrenchedAt !== void 0) issueCommand(s, side2, { type: "ability", ids: [unit4.id] });
  }
  const seen = s.entities.filter((e) => isHostile(s, e.side, side2) && alive2(e) && isVisible2(s, side2, e.x, e.y, levelOf(e)));
  const threat = seen.find((e) => distance11(e, hq) < 12);
  const remembered = rt.knownEnemyBuildings[side2];
  for (const [id6, point5] of remembered) if (isVisible2(s, side2, point5.x, point5.y, levelOf(point5)) && !seen.some((e) => e.id === id6)) remembered.delete(id6);
  for (const e of seen) if (e.kind === "building") remembered.set(e.id, { x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, role: e.role });
  const enemySides = playerSides(s).filter((other) => isHostile(s, side2, other) && !s.eliminated[other]);
  const enemySide = enemySides.sort((a, b) => distance11(hq, s.starts[a]) - distance11(hq, s.starts[b]))[0];
  if (enemySide === void 0) return;
  const enemyStart = s.starts[enemySide];
  const forward = { x: hq.x + (enemyStart.x - hq.x) * 0.12, y: hq.y + (enemyStart.y - hq.y) * 0.12 };
  const rally = commandDestination(s, side2, forward, hq) ?? { x: hq.x + 4, y: hq.y };
  for (const producer of buildings2.filter((e) => e.role === "barracks" && e.progress === 1 && !e.rally)) issueCommand(s, side2, { type: "setRally", ids: [producer.id], ...rally });
  const retreats = rt.retreating[side2];
  for (const [id6, record7] of retreats) {
    const soldier = army.find((e) => e.id === id6);
    if (!soldier) {
      retreats.delete(id6);
      continue;
    }
    if (s.time >= record7.until && (!incomeRecoverable || rt.producedFighters[side2] > record7.produced && distance11(soldier, rally) < 9 && army.some((reinforcement) => !reinforcement.raised && reinforcement.id > record7.afterId && distance11(reinforcement, rally) < 6 && !retreats.has(reinforcement.id)))) retreats.delete(id6);
  }
  for (const soldier of army) {
    if (!incomeRecoverable || retreats.has(soldier.id) || distance11(soldier, hq) < 9) continue;
    const enemies = seen.filter((e) => (e.kind === "unit" && e.role !== "worker" || e.role === "tower") && distance11(e, soldier) < 7);
    const allies2 = army.filter((e) => distance11(e, soldier) < 7 && !retreats.has(e.id));
    if (shouldRetreat(config, soldier, allies2, enemies) && issueCommand(s, side2, { type: "move", ids: [soldier.id], ...rally })) {
      retreats.set(soldier.id, { until: s.time + profile.regroupSeconds, produced: rt.producedFighters[side2], afterId: s.nextId - 1 });
      emit(s, "message", soldier, void 0, "Retreating to rally with reinforcements.");
    }
  }
  const tacticalArmy = army.filter((e) => !retreats.has(e.id));
  const directiveIds = processAllyDirectives(s, side2, rt.teamAI, tacticalArmy.filter((e) => e.entrenchedAt === void 0), !!threat, (viewer, x, y, level2) => isVisible2(s, viewer, x, y, level2), (owner, command) => issueCommand(s, owner, command));
  const readyArmy = tacticalArmy.filter((e) => !directiveIds.has(e.id));
  if (isVisible2(s, side2, enemyStart.x, enemyStart.y, levelOf(enemyStart)) && !seen.some((e) => e.role === "hq" && distance11(e, enemyStart) < 4)) rt.clearedEnemyStarts[side2].add(enemySide);
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
      for (let y = 4.5; y < s.height - 3; y += 6) for (let x = 4.5; x < s.width - 3; x += 6) if (!isVisible2(s, side2, x, y) && !rt.searched[side2].has(Math.floor(y) * s.width + Math.floor(x))) candidates.push({ x, y });
      if (candidates.length) {
        destination = candidates.sort((a, b) => distance11(origin, a) - distance11(origin, b))[0];
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
  if (isGameOver(s) || !Number.isFinite(amount) || amount <= 0 || amount > 1e9 || !s.entities.includes(source2) || !s.entities.includes(target) || source2.hp <= 0 || target.hp <= 0 || !sameLevel(source2, target)) return false;
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
  return { interrupt: (actor3) => interruptWorldOrder(s, actor3), recordPaid: (actor3, cost5) => recordEconomyPaid(s, actor3, cost5), die: (actor3, text5) => die(s, actor3, text5), spawn: (...args) => spawnDefinition(s, ...args), setTerrain: (point5, kind) => setWorldTerrain(s, point5, kind), impactTargets: () => combatTargets(s), targetDistance: (at, target) => targetDistance(s, at, target), ignite: (point5, source2) => {
    igniteWorldAt(s, point5, source2);
  }, damage: (source2, target, raw, options) => {
    if (target.hp <= 0) return;
    queueWeaponHit(s, source2, target, raw, !!options?.ranged, false, !!options?.armorPiercing, !!options?.ranged);
  } };
}
var economyHooks = { visible: (s, side2, p) => isVisible2(s, side2, p.x, p.y, p.level ?? 0), allied: isAllied, spawn: spawnEntity, die, assign: interruptWorldOrder, invalidateNavigation, move, canPlace: (s, side2, x, y, level2) => canPlace(s, side2, "depot", x, y, "economy:warehouse", level2), radius, buildingDef, unitDef };

// src/online/protocol.ts
var PROTOCOL_VERSION = 1;
var TICK_RATE = 20;

// src/server/store.ts
import { DatabaseSync } from "node:sqlite";
import { createHash as createHash2 } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// src/server/competitions.ts
import { createHash } from "node:crypto";
function seasonAt(now) {
  const date = new Date(now), year = date.getUTCFullYear(), month = date.getUTCMonth();
  return { id: `${year}-${String(month + 1).padStart(2, "0")}`, startsAt: new Date(Date.UTC(year, month, 1)).toISOString(), endsAt: new Date(Date.UTC(year, month + 1, 1)).toISOString(), initialRating: 1e3, kFactor: 32 };
}
function dailyAt(now) {
  const date = new Date(now).toISOString().slice(0, 10), seed = createHash("sha256").update(`orcs-vs-fairies:daily:v1:${date}`).digest().readUInt32LE();
  const factions = ["orcs", "fairies", "dwarves", "undead", "tideborn", "automata"];
  return {
    date,
    seed,
    expiresAt: new Date(Date.parse(date + "T00:00:00Z") + 864e5).toISOString(),
    scoring: "fastest-victory",
    tickRate: 20,
    config: { schemaVersion: 1, map: { seed, size: "small" }, players: [
      { id: 0, teamId: 0, factionId: factions[seed % 6], controller: "external" },
      { id: 1, teamId: 1, factionId: factions[(seed % 6 + 1) % 6], controller: "ai", ai: { difficulty: "normal", personality: "balanced", opening: "infantry-rush" } }
    ], rules: { sharedVision: true, startingAge: 1 } }
  };
}
var CompetitionStore = class {
  constructor(db) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS ranked_seasons(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ranked_ratings(season_id TEXT NOT NULL REFERENCES ranked_seasons(id),user_id TEXT NOT NULL REFERENCES users(id),rating INTEGER NOT NULL,played INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0,draws INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(season_id,user_id));
      CREATE TABLE IF NOT EXISTS competition_results(match_id TEXT PRIMARY KEY REFERENCES matches(id),kind TEXT NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_challenges(date TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_scores(date TEXT NOT NULL REFERENCES daily_challenges(date),user_id TEXT NOT NULL REFERENCES users(id),match_id TEXT NOT NULL REFERENCES matches(id),tick INTEGER NOT NULL,PRIMARY KEY(date,user_id));`);
  }
  db;
  season(now) {
    const season = seasonAt(now);
    this.db.prepare("INSERT OR IGNORE INTO ranked_seasons(id,data) VALUES(?,?)").run(season.id, JSON.stringify(season));
    return season;
  }
  seasons() {
    return this.db.prepare("SELECT data FROM ranked_seasons ORDER BY id DESC").all().map((row) => JSON.parse(row.data));
  }
  challenge(now) {
    const challenge = dailyAt(now);
    this.db.prepare("INSERT OR IGNORE INTO daily_challenges(date,data) VALUES(?,?)").run(challenge.date, JSON.stringify(challenge));
    return JSON.parse(this.db.prepare("SELECT data FROM daily_challenges WHERE date=?").get(challenge.date).data);
  }
  standings(seasonId) {
    return this.db.prepare("SELECT users.id,users.username,ranked_ratings.* FROM ranked_ratings JOIN users ON users.id=user_id WHERE season_id=? ORDER BY rating DESC,wins DESC,users.username COLLATE NOCASE,users.id").all(seasonId).map((row, index2) => ({ rank: index2 + 1, account: { id: row.id, username: row.username }, rating: row.rating, played: row.played, wins: row.wins, draws: row.draws, losses: row.losses }));
  }
  dailyStandings(date) {
    return this.db.prepare("SELECT users.id,users.username,daily_scores.* FROM daily_scores JOIN users ON users.id=user_id WHERE date=? ORDER BY tick,users.username COLLATE NOCASE,users.id").all(date).map((row, index2) => ({ rank: index2 + 1, account: { id: row.id, username: row.username }, matchId: row.match_id, tick: row.tick, seconds: row.tick / 20 }));
  }
  result(matchId) {
    const row = this.db.prepare("SELECT data FROM competition_results WHERE match_id=?").get(matchId);
    return row ? JSON.parse(row.data) : null;
  }
  finish(matchId, entry, state) {
    if (!entry || state.winner === null && !state.draw || this.result(matchId)) return;
    if (entry.kind === "ranked") {
      const ratings = entry.participants.map((account) => {
        this.db.prepare("INSERT OR IGNORE INTO ranked_ratings(season_id,user_id,rating) VALUES(?,?,1000)").run(entry.seasonId, account.id);
        return this.db.prepare("SELECT rating FROM ranked_ratings WHERE season_id=? AND user_id=?").get(entry.seasonId, account.id).rating;
      });
      const score = state.draw ? 0.5 : state.winningTeam === state.teams[0] ? 1 : 0;
      const change = Math.round(32 * (score - 1 / (1 + 10 ** ((ratings[1] - ratings[0]) / 400))));
      const result = { matchId, seasonId: entry.seasonId, winner: state.draw ? null : entry.participants[score === 1 ? 0 : 1].id, tick: state.tick, ratings: entry.participants.map((account, index2) => ({ accountId: account.id, before: ratings[index2], after: ratings[index2] + (index2 === 0 ? change : -change) })) };
      for (const [index2, account] of entry.participants.entries()) {
        const own2 = state.draw ? 0.5 : index2 === 0 ? score : 1 - score;
        this.db.prepare("UPDATE ranked_ratings SET rating=?,played=played+1,wins=wins+?,draws=draws+?,losses=losses+? WHERE season_id=? AND user_id=?").run(result.ratings[index2].after, own2 === 1 ? 1 : 0, own2 === 0.5 ? 1 : 0, own2 === 0 ? 1 : 0, entry.seasonId, account.id);
      }
      this.db.prepare("INSERT INTO competition_results(match_id,kind,data) VALUES(?,?,?)").run(matchId, "ranked", JSON.stringify(result));
    } else {
      const won = !state.draw && state.winningTeam === state.teams[0];
      this.db.prepare("INSERT INTO competition_results(match_id,kind,data) VALUES(?,?,?)").run(matchId, "daily", JSON.stringify({ matchId, date: entry.date, won, tick: state.tick }));
      if (won) this.db.prepare("INSERT INTO daily_scores(date,user_id,match_id,tick) VALUES(?,?,?,?) ON CONFLICT(date,user_id) DO UPDATE SET match_id=excluded.match_id,tick=excluded.tick WHERE excluded.tick<daily_scores.tick").run(entry.date, entry.participant.id, matchId, state.tick);
    }
  }
};

// src/online/cosmetics.ts
var factionNames = { orcs: "Ironclad", fairies: "Wild Court", dwarves: "Deepforge", undead: "Ashen Host", tideborn: "Tideborn", automata: "Automata" };
var COSMETICS = Object.entries(factionNames).flatMap(([factionId, name]) => [
  { id: `${factionId}-victory-banner`, factionId, slot: "banner", name: `${name} victory banner`, requiresWins: 1 },
  { id: `${factionId}-honor-seal`, factionId, slot: "decoration", name: `${name} honor seal`, requiresWins: 3 },
  { id: `${factionId}-commander`, factionId, slot: "portrait", name: `${name} commander portrait`, requiresWins: 5 }
]);
var EMPTY_COSMETIC_EQUIPMENT = { banner: null, decoration: null, portrait: null };

// src/server/cosmetics.ts
var CosmeticRequestError = class extends Error {
  constructor(status, message5) {
    super(message5);
    this.status = status;
  }
  status;
};
var isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var CosmeticStore = class {
  constructor(db) {
    this.db = db;
    db.exec(`
    CREATE TABLE IF NOT EXISTS cosmetic_awards(source_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),faction_id TEXT NOT NULL,PRIMARY KEY(source_id,user_id));
    CREATE TABLE IF NOT EXISTS cosmetic_wins(user_id TEXT NOT NULL REFERENCES users(id),faction_id TEXT NOT NULL,wins INTEGER NOT NULL,PRIMARY KEY(user_id,faction_id));
    CREATE TABLE IF NOT EXISTS cosmetic_unlocks(user_id TEXT NOT NULL REFERENCES users(id),cosmetic_id TEXT NOT NULL,source_id TEXT NOT NULL,PRIMARY KEY(user_id,cosmetic_id));
    CREATE TABLE IF NOT EXISTS cosmetic_equipment(user_id TEXT NOT NULL REFERENCES users(id),faction_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,faction_id));`);
  }
  db;
  /** Caller must verify the outcome and own the transaction. There is no public award endpoint. */
  awardVerifiedVictory(sourceId, accountId, factionId) {
    if (!sourceId || sourceId.length > 256 || !COSMETICS.some((item) => item.factionId === factionId)) throw new Error("Invalid verified cosmetic award source.");
    const inserted = this.db.prepare("INSERT OR IGNORE INTO cosmetic_awards(source_id,user_id,faction_id) VALUES(?,?,?)").run(sourceId, accountId, factionId);
    if (inserted.changes === 0) return;
    this.db.prepare("INSERT INTO cosmetic_wins(user_id,faction_id,wins) VALUES(?,?,1) ON CONFLICT(user_id,faction_id) DO UPDATE SET wins=wins+1").run(accountId, factionId);
    const wins = this.db.prepare("SELECT wins FROM cosmetic_wins WHERE user_id=? AND faction_id=?").get(accountId, factionId).wins;
    for (const item of COSMETICS.filter((item2) => item2.factionId === factionId && item2.requiresWins <= wins)) this.db.prepare("INSERT OR IGNORE INTO cosmetic_unlocks(user_id,cosmetic_id,source_id) VALUES(?,?,?)").run(accountId, item.id, sourceId);
  }
  awardCampaignVictory(accountId, result) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.awardVerifiedVictory(`campaign:${accountId}:${result.campaignId}:${result.missionId}`, accountId, result.factionId);
      this.db.exec("COMMIT");
      return this.profile(accountId);
    } catch (error2) {
      this.db.exec("ROLLBACK");
      throw error2;
    }
  }
  profile(accountId) {
    const owned2 = this.db.prepare("SELECT cosmetic_id FROM cosmetic_unlocks WHERE user_id=? ORDER BY cosmetic_id").all(accountId).map((row) => row.cosmetic_id);
    const wins = Object.fromEntries(this.db.prepare("SELECT faction_id,wins FROM cosmetic_wins WHERE user_id=?").all(accountId).map((row) => [row.faction_id, row.wins]));
    const equipment = Object.fromEntries(this.db.prepare("SELECT faction_id,revision,data FROM cosmetic_equipment WHERE user_id=?").all(accountId).map((row) => [row.faction_id, { revision: row.revision, loadout: JSON.parse(row.data) }]));
    return { owned: owned2, wins, equipment };
  }
  loadout(accountId, factionId) {
    const row = this.db.prepare("SELECT data FROM cosmetic_equipment WHERE user_id=? AND faction_id=?").get(accountId, factionId);
    return row ? JSON.parse(row.data) : { ...EMPTY_COSMETIC_EQUIPMENT };
  }
  equip(accountId, value) {
    if (Object.keys(value).some((key) => !["factionId", "expectedRevision", "loadout"].includes(key)) || !COSMETICS.some((item) => item.factionId === value.factionId) || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || !isRecord(value.loadout) || Object.keys(value.loadout).length !== 3 || !["banner", "decoration", "portrait"].every((slot) => Object.hasOwn(value.loadout, slot))) throw new CosmeticRequestError(400, "Choose a known faction, its current revision and all three cosmetic slots.");
    const factionId = value.factionId, loadout = value.loadout;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const profile = this.profile(accountId), current = profile.equipment[factionId]?.revision ?? 0;
      if (value.expectedRevision !== current) throw new CosmeticRequestError(409, "Cosmetic choices changed. Refresh before applying.");
      for (const slot of ["banner", "decoration", "portrait"]) {
        const id6 = loadout[slot];
        if (id6 === null) continue;
        const item = COSMETICS.find((item2) => item2.id === id6 && item2.factionId === factionId && item2.slot === slot);
        if (!item) throw new CosmeticRequestError(400, "The cosmetic must match its faction and slot.");
        if (!profile.owned.includes(id6)) throw new CosmeticRequestError(403, "Earn this cosmetic before equipping it.");
      }
      const revision = current + 1;
      this.db.prepare("INSERT INTO cosmetic_equipment(user_id,faction_id,revision,data) VALUES(?,?,?,?) ON CONFLICT(user_id,faction_id) DO UPDATE SET revision=excluded.revision,data=excluded.data").run(accountId, factionId, revision, JSON.stringify(loadout));
      this.db.exec("COMMIT");
      return { factionId, revision, loadout };
    } catch (error2) {
      this.db.exec("ROLLBACK");
      throw error2;
    }
  }
};

// src/server/store.ts
var ServerStore = class {
  constructor(directory, engineHash) {
    this.engineHash = engineHash;
    mkdirSync(directory, { recursive: true });
    this.db = new DatabaseSync(join(directory, "server.sqlite"));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS lobbies(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,lobby_id TEXT NOT NULL,config TEXT NOT NULL,tick INTEGER NOT NULL,checkpoint_tick INTEGER NOT NULL,checkpoint TEXT NOT NULL,memory TEXT NOT NULL,generation TEXT NOT NULL,finished INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS commands(match_id TEXT NOT NULL REFERENCES matches(id),side INTEGER NOT NULL,client_seq INTEGER NOT NULL,payload TEXT NOT NULL,tick INTEGER NOT NULL,ordinal INTEGER NOT NULL,command TEXT NOT NULL,ack TEXT NOT NULL,PRIMARY KEY(match_id,side,client_seq));
      CREATE INDEX IF NOT EXISTS command_ticks ON commands(match_id,tick,ordinal);
      CREATE TABLE IF NOT EXISTS frames(match_id TEXT NOT NULL REFERENCES matches(id),tick INTEGER NOT NULL,views TEXT NOT NULL,PRIMARY KEY(match_id,tick));`);
    const columns = new Set(this.db.prepare("PRAGMA table_info(matches)").all().map((row) => row.name));
    if (!columns.has("engine_hash")) this.db.exec("ALTER TABLE matches ADD COLUMN engine_hash TEXT NOT NULL DEFAULT ''");
    if (!columns.has("state_hash")) this.db.exec("ALTER TABLE matches ADD COLUMN state_hash TEXT NOT NULL DEFAULT ''");
    this.competitions = new CompetitionStore(this.db);
    this.cosmetics = new CosmeticStore(this.db);
  }
  engineHash;
  db;
  competitions;
  cosmetics;
  userByName(username) {
    return this.db.prepare("SELECT id,username,password FROM users WHERE username=? COLLATE NOCASE").get(username);
  }
  addUser(account, password) {
    this.db.prepare("INSERT INTO users(id,username,password) VALUES(?,?,?)").run(account.id, account.username, password);
  }
  session(token, now) {
    return this.db.prepare("SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND expires>?").get(token, now);
  }
  addSession(token, userId, expires) {
    this.db.prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)").run(token, userId, expires);
  }
  deleteSession(token) {
    this.db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  }
  saveLobby(lobby) {
    this.db.prepare("INSERT INTO lobbies(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(lobby.id, JSON.stringify(lobby));
  }
  lobbies() {
    return this.db.prepare("SELECT data FROM lobbies").all().map((row) => JSON.parse(row.data));
  }
  addMatch(id6, lobbyId, config, state, memory, generation) {
    this.db.prepare("INSERT INTO matches(id,lobby_id,config,tick,checkpoint_tick,checkpoint,memory,generation,engine_hash,state_hash) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id6, lobbyId, JSON.stringify(config), state.tick, state.tick, JSON.stringify(saveGame(state)), JSON.stringify(memory), JSON.stringify(generation), this.engineHash, this.hashState(state, memory));
  }
  startMatch(lobby, state, memory, generation, frame, matchConfig, competition) {
    if (!lobby.matchId) throw new Error("Started lobby requires a match ID.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.addMatch(lobby.matchId, lobby.id, { ...lobby.settings, seed: lobby.seed, matchConfig, competition, participants: lobby.seats.flatMap((seat) => seat.account ? [{ side: seat.side, account: seat.account }] : []) }, state, memory, generation);
      this.db.prepare("INSERT INTO frames(match_id,tick,views) VALUES(?,?,?)").run(lobby.matchId, frame.tick, JSON.stringify(frame.views));
      this.saveLobby(lobby);
      this.db.exec("COMMIT");
    } catch (error2) {
      this.db.exec("ROLLBACK");
      throw error2;
    }
  }
  matches() {
    return this.db.prepare("SELECT * FROM matches").all().map((row) => ({ id: row.id, lobbyId: row.lobby_id, config: JSON.parse(row.config), tick: row.tick, checkpointTick: row.checkpoint_tick, save: JSON.parse(row.checkpoint), memory: JSON.parse(row.memory), generation: JSON.parse(row.generation), finished: !!row.finished, engineHash: row.engine_hash, stateHash: row.state_hash }));
  }
  commands(matchId, afterTick = -1) {
    return this.db.prepare("SELECT * FROM commands WHERE match_id=? AND tick>? ORDER BY tick,ordinal").all(matchId, afterTick).map((row) => ({ side: row.side, clientSeq: row.client_seq, payload: row.payload, appliedTick: row.tick, ordinal: row.ordinal, command: JSON.parse(row.command), ack: JSON.parse(row.ack) }));
  }
  frames(matchId, minimumTick) {
    return this.db.prepare("SELECT tick,views FROM frames WHERE match_id=? AND tick>=? ORDER BY tick").all(matchId, minimumTick).map((row) => ({ tick: row.tick, views: JSON.parse(row.views) }));
  }
  generation(matchId, generation) {
    this.db.prepare("UPDATE matches SET generation=? WHERE id=?").run(JSON.stringify(generation), matchId);
  }
  matchConfiguration(matchId) {
    const row = this.db.prepare("SELECT config FROM matches WHERE id=?").get(matchId);
    return row ? JSON.parse(row.config) : void 0;
  }
  commitTick(matchId, state, commands, memory, frame, checkpoint = false) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const insert = this.db.prepare("INSERT INTO commands(match_id,side,client_seq,payload,tick,ordinal,command,ack) VALUES(?,?,?,?,?,?,?,?)");
      for (const entry of commands) insert.run(matchId, entry.side, entry.clientSeq, entry.payload, entry.appliedTick, entry.ordinal, JSON.stringify(entry.command), JSON.stringify(entry.ack));
      this.db.prepare("UPDATE matches SET tick=?,finished=?,state_hash=? WHERE id=?").run(state.tick, state.winner !== null || state.draw ? 1 : 0, this.hashState(state, memory), matchId);
      if (checkpoint) this.db.prepare("UPDATE matches SET checkpoint_tick=?,checkpoint=?,memory=? WHERE id=?").run(state.tick, JSON.stringify(saveGame(state)), JSON.stringify(memory), matchId);
      if (frame) {
        this.db.prepare("INSERT OR REPLACE INTO frames(match_id,tick,views) VALUES(?,?,?)").run(matchId, frame.tick, JSON.stringify(frame.views));
        this.db.prepare("DELETE FROM frames WHERE match_id=? AND tick<?").run(matchId, frame.tick - 2400);
      }
      if (state.winner !== null || state.draw) {
        const row = this.db.prepare("SELECT config FROM matches WHERE id=?").get(matchId);
        if (!row) throw new Error("Finished match must have a durable configuration.");
        const configuration = JSON.parse(row.config);
        this.competitions.finish(matchId, configuration.competition, state);
        if (!state.draw) for (const participant of configuration.participants ?? []) {
          if (state.teams[participant.side] === state.winningTeam) this.cosmetics.awardVerifiedVictory(`hosted:${matchId}`, participant.account.id, state.players[participant.side].faction);
        }
      }
      this.db.exec("COMMIT");
    } catch (error2) {
      this.db.exec("ROLLBACK");
      throw error2;
    }
  }
  restore(match) {
    return loadGame(match.save);
  }
  hashState(state, memory) {
    return createHash2("sha256").update(JSON.stringify({ save: saveGame(state), memory })).digest("hex");
  }
  verifyRecovery(match, state, memory) {
    if (match.engineHash !== this.engineHash) throw new Error(`Match ${match.id} requires its original server/simulation build. Preserve the database and run that compatible build.`);
    if (match.stateHash !== this.hashState(state, memory)) throw new Error(`Match ${match.id} recovery differs from its durable state hash.`);
  }
  close() {
    this.db.close();
  }
};

// src/core/observation.ts
function observedHealth(s, side2, e) {
  const disguise = isHostile(s, side2, e.side) && e.illusion && e.kind === "unit";
  const maxHp = disguise ? unitFor(s, e).hp : e.maxHp;
  const hp = disguise && e.maxHp ? e.hp * (maxHp / e.maxHp) : e.hp;
  return { hp, maxHp };
}
var PlayerView = class {
  constructor(side2) {
    this.side = side2;
  }
  side;
  state;
  resources = /* @__PURE__ */ new Map();
  update(s) {
    if (!s.players[this.side]) throw new Error("Observation side is not a player in this match.");
    if (this.state !== s) {
      this.resources.clear();
      this.state = s;
    }
    for (const r of s.resources) if (isVisible2(s, this.side, r.x, r.y, levelOf(r))) this.resources.set(r.id, { ...r, lastSeen: s.time });
  }
  resourcesFor(s) {
    this.update(s);
    return [...this.resources.values()].map((r) => ({ ...r, visible: isVisible2(s, this.side, r.x, r.y, levelOf(r)) }));
  }
  events(s, identify) {
    this.update(s);
    const side2 = this.side, entities = new Map(s.entities.map((e) => [e.id, e])), resources2 = new Map(s.resources.map((r) => [r.id, r]));
    const known2 = (id6) => {
      if (id6 === void 0) return false;
      const entity = entities.get(id6);
      if (entity) return canObserveTacticalEntity(s, side2, entity);
      const resource = resources2.get(id6);
      return !!resource && isVisible2(s, side2, resource.x, resource.y, levelOf(resource));
    };
    return s.events.flatMap((event) => {
      const own2 = event.side === side2;
      if (!own2 && ["gather", "research", "message"].includes(event.type)) return [];
      const target = event.target === void 0 ? void 0 : entities.get(event.target);
      const affected = target && isAllied(s, side2, target.side) && (target.side === side2 || isVisible2(s, side2, target.x, target.y, levelOf(target)));
      const source2 = event.source === void 0 ? void 0 : entities.get(event.source);
      const visible5 = isVisible2(s, side2, event.x, event.y, levelOf(event)) && (!source2 || canObserveTacticalEntity(s, side2, source2));
      if (!own2 && !visible5 && !affected) return [];
      const result = { ...event };
      if (identify) result.eventId = identify(event);
      if (!own2 && !visible5 && affected) {
        result.x = target.x;
        result.y = target.y;
      }
      if (!known2(event.source)) {
        if (!(event.type === "death" && (own2 || visible5) && !entities.has(event.source))) delete result.source;
      }
      if (!known2(event.target)) delete result.target;
      if (!own2) {
        delete result.text;
        delete result.resource;
        if (event.type !== "attack") delete result.amount;
      }
      return [result];
    });
  }
  observe(s) {
    this.update(s);
    const side2 = this.side, teamId = s.teams[side2];
    const roster = s.players.map((player, i) => ({ side: i, teamId: s.teams[i], faction: player.faction }));
    const opponents = roster.filter((player) => isHostile(s, side2, player.side)), allies2 = roster.filter((player) => player.side !== side2 && isAllied(s, side2, player.side));
    const opponent = opponents[0];
    const finished = isGameOver(s), outcome = finished ? s.draw ? "draw" : s.winningTeam === teamId ? "win" : "loss" : null;
    return {
      version: 1,
      tick: s.tick,
      time: s.time,
      side: side2,
      teamId,
      rules: structuredClone(s.rules),
      objectives: publicObjectives(s, side2),
      draft: structuredClone(s.draft),
      draftDefinitions: draftDefinitions(s),
      draftChoices: legalDraftChoices(s.draft, draftPlayers(s), side2, s.content),
      controller: s.controllers[side2],
      sharedVision: s.sharedVision,
      winningTeam: s.winningTeam,
      eliminated: [...s.eliminated],
      map: { size: s.mapSize, width: s.width, height: s.height, version: s.mapVersion, seed: s.seed, starts: s.starts.map((p) => ({ ...p })), terrain: s.terrain.map((t, i) => s.explored[side2].has(i) ? t : null) },
      factionSystems: { fury: s.factionSystems?.fury[side2] ?? 0 },
      player: { ...s.players[side2], heroRecovery: s.players[side2].heroRecovery?.map((r) => ({ ...r })), upgrades: [...s.players[side2].upgrades] },
      opponent: opponent ? { side: opponent.side, faction: opponent.faction } : null,
      opponents,
      allies: allies2,
      alliedAi: alliedAiStatus(s, side2),
      entities: s.entities.filter((e) => e.hp > 0 && canObserveTacticalEntity(s, side2, e)).map((e) => {
        const { hp, maxHp } = observedHealth(s, side2, e);
        const publicTactics = e.tactics ? { morale: e.tactics.morale, recentLoss: 0, siegeCrew: e.tactics.siegeCrew ? { ...e.tactics.siegeCrew } : void 0, guard: e.tactics.guard ? { ...e.tactics.guard } : void 0 } : void 0;
        const publicFields = { id: e.id, side: e.side, owner: isCrewless(e) ? null : e.side, tactics: publicTactics, factionState: e.factionState ? { chant: e.factionState.chant ? { ...e.factionState.chant } : void 0, artillery: e.factionState.artillery, power: e.factionState.power ? { connected: e.factionState.power.connected, root: null } : void 0 } : void 0, facing: e.facing, kind: e.kind, role: e.role, definitionId: e.definitionId, definitionFaction: e.definitionFaction, x: e.x, y: e.y, ...e.level === void 0 ? {} : { level: e.level }, hp, maxHp, progress: e.progress, gateOpen: e.gateOpen, shield: e.shield, maxShield: e.maxShield, raised: e.raised, entrenchedAt: e.entrenchedAt, surgeUntil: e.surgeUntil };
        return e.side === side2 && !isCrewless(e) ? { ...publicFields, tactics: e.tactics ? structuredClone(e.tactics) : void 0, factionState: e.factionState ? structuredClone(e.factionState) : void 0, veteran: e.veteran ? structuredClone(e.veteran) : void 0, equipment: e.equipment ? { ...e.equipment } : void 0, specialistBuffs: e.specialistBuffs?.map((buff2) => ({ ...buff2, fearedFrom: buff2.fearedFrom ? { ...buff2.fearedFrom } : void 0 })), beacon: e.beacon ? { ...e.beacon } : void 0, siegeMode: e.siegeMode ? { ...e.siegeMode } : void 0, illusion: e.illusion, order: { ...e.order }, orderQueue: e.orderQueue?.map((order3) => ({ ...order3 })), queue: [...e.queue], queueDefinitionIds: e.queueDefinitionIds ? [...e.queueDefinitionIds] : void 0, queuePaidCosts: e.queuePaidCosts?.map((cost5) => ({ ...cost5 })), rally: e.rally ? { ...e.rally } : void 0, trainProgress: e.trainProgress, research: e.research, researchProgress: e.researchProgress, carried: e.carried, carriedKind: e.carriedKind, cooldown: e.cooldown, abilityReadyAt: e.abilityReadyAt, expires: e.expires, lastDamagedAt: e.lastDamagedAt } : isAllied(s, side2, e.side) ? { ...publicFields, illusion: e.illusion } : publicFields;
      }),
      world: s.world ? { version: s.world.version, revision: s.world.revision, biome: s.world.biome, phase: environmentPhase(s), levels: s.world.levels.map((l) => ({ id: l.id, title: l.title, terrain: l.terrain.map((t, i) => s.explored[side2].has(l.id * s.width * s.height + i) ? t : null), elevation: l.elevation.map((e, i) => s.explored[side2].has(l.id * s.width * s.height + i) ? e : null) })), transitions: s.world.transitions.filter((t) => s.explored[side2].has(fogKey(s, t.from)) || s.explored[side2].has(fogKey(s, t.to))).map((t) => ({ id: t.id, from: { ...t.from }, to: { ...t.to } })), bridges: s.world.bridges.filter((b) => isVisible2(s, side2, b.x, b.y, b.level)).map((b) => ({ id: b.id, x: b.x, y: b.y, level: b.level, hp: b.hp, maxHp: b.maxHp, rebuilding: b.rebuilding })), fires: s.world.fires.filter((f) => isVisible2(s, side2, f.x, f.y, f.level)).map((f) => ({ ...f })), ...observeNeutralWorld(s, side2) } : void 0,
      resources: this.resourcesFor(s),
      economy: observeEconomy(s, side2, { visible: (state, observer, p) => isVisible2(state, observer, p.x, p.y, levelOf(p)) }),
      artifacts: observedArtifacts(s, side2),
      projectiles: (s.projectiles ?? []).filter((p) => isVisible2(s, side2, p.x, p.y, levelOf(p)) || p.side === side2).map((p) => ({ id: p.id, side: p.side, x: p.x, y: p.y, ...p.level === void 0 ? {} : { level: p.level }, from: isVisible2(s, side2, p.from.x, p.from.y, levelOf(p.from)) || p.side === side2 ? { x: p.from.x, y: p.from.y, ...p.from.level === void 0 ? {} : { level: p.from.level } } : void 0, impactAt: p.impactAt, radius: p.radius })),
      corpses: s.corpses.filter((c) => isVisible2(s, side2, c.x, c.y, levelOf(c))).map((c) => ({ ...c })),
      visible: [...s.visible[side2]].sort((a, b) => a - b),
      explored: [...s.explored[side2]].sort((a, b) => a - b),
      content: { faction: factionFor(s, side2), abilities: ABILITIES, upgrades: upgradesFor(s, side2), hash: s.content?.hash },
      result: { finished, winner: s.winner, winningTeam: s.winningTeam, draw: s.draw, eliminated: [...s.eliminated], outcome }
    };
  }
};

// src/server/views.ts
import { randomUUID } from "node:crypto";
var eventIds = /* @__PURE__ */ new WeakMap();
function eventIdentity(event) {
  let id6 = eventIds.get(event);
  if (!id6) {
    id6 = randomUUID();
    eventIds.set(event, id6);
  }
  return id6;
}
var OnlineView = class {
  constructor(side2, restored = []) {
    this.side = side2;
    this.view = new PlayerView(side2);
    for (const node of restored) this.memory.set(node.id, { ...node });
  }
  side;
  view;
  memory = /* @__PURE__ */ new Map();
  observe(state) {
    const observed2 = this.view.observe(state);
    for (const node of observed2.resources) if (node.visible) this.memory.set(node.id, { ...node });
    const resources2 = [...this.memory.values()].map((node) => ({ ...node, visible: isVisible2(state, this.side, node.x, node.y, levelOf(node)) }));
    const entityMap = new Map(state.entities.map((entity) => [entity.id, entity]));
    const permittedIds = new Set(observed2.entities.map((entity) => entity.id));
    const events = [];
    for (const event of this.view.events(state, eventIdentity)) {
      const target = event.target === void 0 ? void 0 : entityMap.get(event.target);
      const seen = isVisible2(state, this.side, event.x, event.y, levelOf(event));
      const ownTarget = target?.side === this.side;
      const safe = { ...event };
      if (safe.source !== void 0 && !permittedIds.has(safe.source)) delete safe.source;
      if (safe.target !== void 0 && !permittedIds.has(safe.target)) delete safe.target;
      if (!seen && event.side !== this.side) {
        if (!ownTarget) continue;
        safe.x = target.x;
        safe.y = target.y;
        safe.level = target.level;
        delete safe.side;
        delete safe.text;
      }
      if (event.type === "attack" && event.side !== this.side && safe.source === void 0) delete safe.side;
      events.push({ ...safe, tick: state.tick });
    }
    const { seed: _seed, starts, ...map } = observed2.map;
    return {
      ...observed2,
      map: { ...map, starts: starts.map((point5, side2) => side2 === this.side || isVisible2(state, this.side, point5.x, point5.y, levelOf(point5)) ? { ...point5 } : null) },
      resources: resources2,
      events,
      entities: observed2.entities.map((entity) => {
        const full = entityMap.get(entity.id);
        return { ...entity, facing: full.facing, animation: full.animation, animTime: full.animTime, ...entity.side === this.side && full.lastDamagedAt !== void 0 ? { lastDamagedAt: full.lastDamagedAt } : {} };
      })
    };
  }
  snapshot() {
    return [...this.memory.values()].map((node) => ({ ...node }));
  }
};

// src/server/team-view.ts
function teamObservation(views, perspective) {
  const base = views[perspective], members = views.filter((view) => view.teamId === base.teamId);
  const visible5 = new Set(members.flatMap((view) => view.visible));
  const entities = /* @__PURE__ */ new Map(), resources2 = /* @__PURE__ */ new Map();
  const corpses = /* @__PURE__ */ new Map();
  const events = /* @__PURE__ */ new Map();
  for (const view of members) {
    for (const entity of view.entities) {
      const existing = entities.get(entity.id);
      if (!existing || entity.side === view.side) entities.set(entity.id, entity);
    }
    for (const resource of view.resources) {
      const existing = resources2.get(resource.id);
      if (!existing || resource.lastSeen >= existing.lastSeen) resources2.set(resource.id, resource);
    }
    for (const corpse of view.corpses) corpses.set(corpse.id, corpse);
    for (const event of view.events) {
      const key = event.eventId ?? JSON.stringify(event), existing = events.get(key);
      if (!existing) {
        events.set(key, event);
        continue;
      }
      const location = existing.source !== void 0 ? existing : event.source !== void 0 ? event : existing;
      events.set(key, { ...existing, ...event, x: location.x, y: location.y, ...location.level === void 0 ? {} : { level: location.level } });
    }
  }
  const worlds = members.flatMap((view) => view.world ? [view.world] : []), worldBase = base.world ?? worlds[0];
  const unionById = (lists) => [...new Map(lists.flat().map((item) => [item.id, item])).values()];
  const world = worldBase ? {
    ...worldBase,
    levels: worldBase.levels.map((level2) => ({
      ...level2,
      terrain: level2.terrain.map((tile, index2) => tile ?? worlds.map((world2) => world2.levels[level2.id]?.terrain[index2]).find((tile2) => tile2 !== null && tile2 !== void 0) ?? null),
      elevation: level2.elevation.map((height, index2) => height ?? worlds.map((world2) => world2.levels[level2.id]?.elevation[index2]).find((height2) => height2 !== null && height2 !== void 0) ?? null)
    })),
    transitions: unionById(worlds.map((world2) => world2.transitions)),
    bridges: unionById(worlds.map((world2) => world2.bridges)),
    sites: unionById(worlds.map((world2) => world2.sites)).map((site) => {
      const own2 = base.world?.sites.find((record7) => record7.id === site.id);
      return { ...site, loyalty: own2?.loyalty ?? 0, rewardClaimed: site.kind === "monster" ? site.rewardClaimed : own2?.rewardClaimed ?? false };
    }),
    creatures: unionById(worlds.map((world2) => world2.creatures)),
    fires: [...new Map(worlds.flatMap((world2) => world2.fires).map((fire) => [`${fire.level},${fire.x},${fire.y}`, fire])).values()]
  } : void 0;
  const economies = members.flatMap((view) => view.economy ? [view.economy] : []), economyBase = base.economy ?? economies[0];
  const economy = economyBase ? {
    ...structuredClone(economyBase),
    deepSites: [...new Set(economies.flatMap((view) => view.deepSites))],
    groves: structuredClone(unionById(economies.map((view) => view.groves))),
    markets: structuredClone(unionById(economies.map((view) => view.markets))),
    salvage: structuredClone(unionById(economies.map((view) => view.salvage))),
    structures: [...new Map(economies.flatMap((view) => view.structures).map((item) => [item.entityId, item])).values()].map((item) => ({ ...structuredClone(item), stock: item.side === perspective ? { ...base.economy?.structures.find((own2) => own2.entityId === item.entityId)?.stock ?? { wood: 0, ore: 0, crystal: 0 } } : { wood: 0, ore: 0, crystal: 0 } })),
    caravans: [...new Map(economies.flatMap((view) => view.caravans).map((item) => [item.entityId, item])).values()].map((item) => item.side === perspective ? structuredClone(base.economy?.caravans.find((own2) => own2.entityId === item.entityId) ?? item) : { ...structuredClone(item), origin: "delivery", stock: { wood: 0, ore: 0, crystal: 0 }, tradeValue: 0, sourceId: void 0, destinationId: void 0, contractId: void 0, task: void 0 }),
    contracts: structuredClone(unionById(economies.map((view) => view.contracts.filter((contract) => contract.side === null || contract.side === perspective))))
  } : void 0;
  return {
    ...base,
    ...world ? { world } : {},
    ...economy ? { economy } : {},
    teamPerspective: true,
    teamPlayers: members.map((view) => ({ side: view.side, player: view.player })),
    entities: [...entities.values()].sort((a, b) => a.id - b.id),
    resources: [...resources2.values()].sort((a, b) => a.id - b.id).map((resource) => ({ ...resource, visible: visible5.has((resource.level ?? 0) * base.map.width * base.map.height + Math.floor(resource.y) * base.map.width + Math.floor(resource.x)) })),
    corpses: [...corpses.values()].sort((a, b) => a.id - b.id),
    events: [...events.values()].sort((a, b) => a.tick - b.tick),
    map: { ...base.map, terrain: base.map.terrain.map((tile, index2) => tile ?? members.map((view) => view.map.terrain[index2]).find((tile2) => tile2 !== null) ?? null), starts: base.map.starts.map((point5, index2) => point5 ?? members.map((view) => view.map.starts[index2]).find((point6) => point6 !== null) ?? null) },
    visible: [...visible5].sort((a, b) => a - b),
    explored: [...new Set(members.flatMap((view) => view.explored))].sort((a, b) => a - b)
  };
}

// src/tournament/service.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { mkdir as mkdir2, open, readFile as readFile2, readdir as readdir2, rm } from "node:fs/promises";
import path2 from "node:path";

// src/core/replays.ts
var FORMAT = "orcs-vs-fairies/replay";
var MAX_TICKS = 432e3;
var MAX_ACTIONS = 1e5;
var record3 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var integer = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
var exactKeys = (v, keys4) => Object.keys(v).every((k) => keys4.includes(k));
function replayChecksum(state, version = SAVE_VERSION) {
  if (version !== SAVE_VERSION) throw new Error("Historical replay checksums require the original serialized save envelope.");
  const text5 = JSON.stringify(saveGame(state));
  let hash4 = 2166136261;
  for (let i = 0; i < text5.length; i++) {
    hash4 ^= text5.charCodeAt(i);
    hash4 = Math.imul(hash4, 16777619);
  }
  return (hash4 >>> 0).toString(16).padStart(8, "0");
}
function entityValue(s, e) {
  const cost5 = entityDefinition(s, e).cost;
  return cost5.wood + cost5.ore + cost5.crystal;
}
function armySample(s, side2, losses, gathered, buildingLosses, lostValue) {
  const p = s.players[side2], living = s.entities.filter((e) => e.side === side2 && e.hp > 0 && !e.illusion && !e.raised);
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
      command: (side2, command) => {
        if (this.actions.length >= MAX_ACTIONS) {
          this.fail("Replay command limit reached.");
          return;
        }
        this.actions.push({ type: "command", side: side2, command });
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
        for (const side2 of state.players.map((_, i) => i)) for (const upgrade of state.players[side2].upgrades) {
          if (this.knownUpgrades[side2].has(upgrade)) continue;
          this.knownUpgrades[side2].add(upgrade);
          this.technologies.push({ side: side2, upgrade, tick: state.tick, time: state.time });
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
          this.lostValue[event.side] += entityValue(state, entity) + (event.amount ?? entity.carried);
        }
      }
      if (event.type === "gather") this.gathered[event.side] += event.amount ?? 0;
    }
  }
  fail(message5) {
    this.error = message5;
    this.unsubscribe?.();
  }
  sampleBucket(time) {
    return Math.floor((time - this.initial.state.time + 1e-8) / 5);
  }
  sampleValue() {
    return { tick: this.state.tick, time: this.state.time, players: this.state.players.map((_, side2) => armySample(this.state, side2, this.losses[side2], this.gathered[side2], this.buildingLosses[side2], this.lostValue[side2])) };
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
function replayRulesCompatible(archive) {
  return archive.initial.version === SAVE_VERSION && (archive.simulationRevision ?? LEGACY_SIMULATION_REVISIONS[archive.initial.version]) === SIMULATION_REVISION;
}
var ReplayPlayer = class _ReplayPlayer {
  archive;
  state;
  cursor = 0;
  stepOffset = 0;
  recorder;
  checkpoints = [];
  constructor(input) {
    this.archive = decodeReplay(input);
    if (!replayRulesCompatible(this.archive)) throw new Error(`This replay uses simulation version ${this.archive.initial.version}, rules ${this.archive.simulationRevision}. This build plays version ${SAVE_VERSION}, rules ${SIMULATION_REVISION}. Its saved match can be loaded with new replay history.`);
    this.state = loadGame(this.archive.initial);
    this.recorder = new MatchRecorder(this.state);
    this.settleCommands();
  }
  get finished() {
    return this.cursor === this.archive.actions.length;
  }
  /** Recompute charts from playback rather than trusting imported chart values. */
  get analysis() {
    return this.recorder.analysis;
  }
  get technologyTimings() {
    return this.recorder.technologyTimings;
  }
  exportCurrent() {
    return this.recorder.export();
  }
  settleCommands() {
    while (this.cursor < this.archive.actions.length) {
      const action2 = this.archive.actions[this.cursor];
      if (action2.type !== "command") break;
      if (!issueCommand(this.state, action2.side, action2.command)) throw new Error(`Replay command rejected at tick ${this.state.tick}.`);
      this.cursor++;
    }
    if (this.finished && replayChecksum(this.state, this.archive.checksumVersion ?? this.archive.initial.version) !== this.archive.finalChecksum) throw new Error("Replay final state diverged.");
  }
  /** Advance bounded work; callers can yield between batches to keep the UI responsive. */
  advance(ticks) {
    if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > MAX_TICKS) throw new Error("Invalid playback tick count.");
    let advanced = 0;
    while (advanced < ticks && !this.finished) {
      const action2 = this.archive.actions[this.cursor];
      if (action2.type !== "advance") {
        this.settleCommands();
        continue;
      }
      const before = this.state.tick;
      stepGame(this.state, action2.dt);
      if (this.state.tick !== before + 1) throw new Error(`Replay ended early at tick ${before}.`);
      advanced++;
      this.stepOffset++;
      if (this.stepOffset === action2.ticks) {
        this.cursor++;
        this.stepOffset = 0;
        this.settleCommands();
      }
      if ((this.state.tick - this.archive.initial.state.tick) % 600 === 0 && !this.checkpoints.some((c) => c.save.state.tick === this.state.tick)) {
        this.checkpoints.push({ save: saveGame(this.state), history: this.recorder.export(), cursor: this.cursor, offset: this.stepOffset });
        if (this.checkpoints.length > 16) this.checkpoints.shift();
      }
    }
    return advanced;
  }
  reset() {
    this.recorder.dispose();
    this.state = loadGame(this.archive.initial);
    this.recorder = new MatchRecorder(this.state);
    this.cursor = 0;
    this.stepOffset = 0;
    this.settleCommands();
  }
  dispose() {
    this.recorder.dispose();
  }
  /** A new independent player starts at the nearest proven checkpoint before the target. */
  forkForSeek(tick) {
    if (!Number.isSafeInteger(tick) || tick < this.archive.initial.state.tick || tick > this.archive.finalTick) throw new Error("Seek tick is outside the replay.");
    const candidate = new _ReplayPlayer(this.archive);
    candidate.checkpoints = [...this.checkpoints];
    candidate.restoreCheckpoint(tick);
    return candidate;
  }
  restoreCheckpoint(tick) {
    const checkpoint = this.checkpoints.filter((c) => c.save.state.tick <= tick).sort((a, b) => b.save.state.tick - a.save.state.tick)[0];
    if (!checkpoint) {
      this.reset();
      return;
    }
    this.recorder.dispose();
    this.state = loadGame(checkpoint.save);
    this.recorder = new MatchRecorder(this.state, checkpoint.history);
    this.cursor = checkpoint.cursor;
    this.stepOffset = checkpoint.offset;
  }
  seek(tick) {
    if (!Number.isSafeInteger(tick) || tick < this.archive.initial.state.tick || tick > this.archive.finalTick) throw new Error("Seek tick is outside the replay.");
    if (tick < this.state.tick) this.restoreCheckpoint(tick);
    this.advance(tick - this.state.tick);
  }
};

// src/tournament/report.ts
var object4 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var text2 = (value, max = 2e3) => typeof value === "string" && value.length <= max;
var integer2 = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
var hash2 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var id4 = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value);
function shape(value, keys4, label) {
  if (!object4(value) || Object.keys(value).some((key) => !keys4.includes(key))) throw new Error(`Invalid ${label}.`);
}
function ensure(condition2, label) {
  if (!condition2) throw new Error(`Invalid ${label}.`);
}
function dense(value, min, max) {
  return Array.isArray(value) && value.length >= min && value.length <= max && Array.from({ length: value.length }, (_, index2) => Object.hasOwn(value, index2)).every(Boolean);
}
function decodeTournamentConfig(input) {
  shape(input, ["version", "id", "name", "agents", "seeds", "mapSize", "bothSeats", "maxSeconds", "decisionTicks", "responseTimeoutMs", "maxCommandsPerTurn", "startingAge", "startingResources"], "tournament configuration");
  ensure(input.version === 1 && id4(input.id) && text2(input.name, 80) && input.name.trim(), "tournament identity");
  ensure(dense(input.agents, 2, 16), "tournament agents");
  const names = /* @__PURE__ */ new Set();
  for (const agent of input.agents) {
    shape(agent, ["id", "name", "faction", "command", "sourceFiles"], "tournament agent");
    ensure(id4(agent.id) && !names.has(agent.id) && text2(agent.name, 80) && agent.name.trim(), "agent identity");
    names.add(agent.id);
    ensure(typeof agent.faction === "string" && Object.hasOwn(FACTIONS, agent.faction), "agent faction");
    ensure(dense(agent.command, 1, 32) && agent.command.every((token) => text2(token, 4096) && !token.includes("\0")) && !!agent.command[0], "agent command");
    if (agent.sourceFiles !== void 0) ensure(dense(agent.sourceFiles, 0, 32) && agent.sourceFiles.every((path3) => text2(path3, 4096) && !!path3) && new Set(agent.sourceFiles).size === agent.sourceFiles.length, "agent source files");
  }
  ensure(dense(input.seeds, 1, 16) && input.seeds.every((seed) => integer2(seed, 0, 4294967295)) && new Set(input.seeds).size === input.seeds.length, "tournament seeds");
  ensure(["small", "medium", "large", "huge"].includes(input.mapSize) && typeof input.bothSeats === "boolean", "tournament map");
  ensure(integer2(input.maxSeconds, 1, 2700) && integer2(input.decisionTicks, 1, 1200) && integer2(input.responseTimeoutMs, 100, 3e4) && integer2(input.maxCommandsPerTurn, 1, 64), "tournament limits");
  if (input.startingAge !== void 0) ensure(integer2(input.startingAge, 1, 3), "starting age");
  if (input.startingResources !== void 0) {
    const resources2 = input.startingResources;
    shape(resources2, ["wood", "ore", "crystal"], "starting resources");
    ensure(["wood", "ore", "crystal"].every((kind) => typeof resources2[kind] === "number" && Number.isFinite(resources2[kind]) && resources2[kind] >= 0 && resources2[kind] <= 1e9), "starting resources");
  }
  const config = structuredClone(input);
  ensure(tournamentSchedule(config).length <= 128, "tournament schedule (maximum 128 matches)");
  return config;
}
function tournamentSchedule(config) {
  const schedule = [];
  for (const seed of config.seeds) for (let left = 0; left < config.agents.length; left++) for (let right = left + 1; right < config.agents.length; right++) {
    for (const seats of [[config.agents[left].id, config.agents[right].id], ...config.bothSeats ? [[config.agents[right].id, config.agents[left].id]] : []]) {
      const index2 = schedule.length;
      schedule.push({ id: `match-${String(index2 + 1).padStart(3, "0")}`, index: index2, seed, seats });
    }
  }
  return schedule;
}
function tournamentMatchConfig(config, seats, seed) {
  return {
    schemaVersion: 1,
    map: { seed, size: config.mapSize },
    players: seats.map((agentId, side2) => ({
      id: side2,
      teamId: side2,
      factionId: config.agents.find((agent) => agent.id === agentId).faction,
      controller: "external",
      ...config.startingResources ? { handicap: { startingResources: { ...config.startingResources } } } : {}
    })),
    rules: { sharedVision: false, startingAge: config.startingAge ?? 1 }
  };
}
function tournamentStandings(report) {
  const rows = new Map(report.config.agents.map((agent) => [agent.id, {
    agentId: agent.id,
    name: agent.name,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    forfeits: 0,
    incomplete: 0,
    points: 0
  }]));
  for (const match of report.matches) for (const agentId of match.seats) {
    const row = rows.get(agentId);
    row.played++;
    if (match.status === "limit" || match.status === "aborted" || match.status === "double-forfeit") row.incomplete++;
    else if (match.winnerAgentId === null) {
      row.draws++;
      row.points++;
    } else if (match.winnerAgentId === agentId) {
      row.wins++;
      row.points += 3;
    } else row.losses++;
    if (match.agents.find((agent) => agent.agentId === agentId)?.fault) row.forfeits++;
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.agentId.localeCompare(b.agentId));
}
function tournamentProgress(report, current = null) {
  return {
    id: report.id,
    status: report.status,
    totalMatches: tournamentSchedule(report.config).length,
    completedMatches: report.matches.length,
    standings: tournamentStandings(report),
    current,
    error: report.error
  };
}
function tournamentContentText() {
  return JSON.stringify({ FACTIONS, ABILITIES, UPGRADES, ECONOMY });
}
function tournamentStateText(state) {
  const saved = saveGame(state);
  saved.state.visible = saved.state.visible.map((cells) => cells.sort((a, b) => a - b));
  saved.state.explored = saved.state.explored.map((cells) => cells.sort((a, b) => a - b));
  return JSON.stringify(saved);
}
function decodeStats(input, agentId) {
  shape(input, ["agentId", "pid", "turns", "accepted", "rejected", "fault", "stderr", "stderrTruncated", "exitCode", "exitSignal"], "agent process statistics");
  ensure(input.agentId === agentId && (input.pid === null || integer2(input.pid, 1)) && integer2(input.turns) && integer2(input.accepted) && integer2(input.rejected) && (input.fault === null || text2(input.fault) && !!input.fault) && text2(input.stderr, 16384) && typeof input.stderrTruncated === "boolean" && (input.exitCode === null || integer2(input.exitCode, 0, 255)) && (input.exitSignal === null || text2(input.exitSignal, 80)), "agent process statistics");
  return structuredClone(input);
}
function decodeTournamentReport(value) {
  if (typeof value === "string") {
    ensure(value.length <= 64 * 1024 * 1024, "tournament report size (maximum 64 MiB)");
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error("Invalid tournament JSON.");
    }
  }
  shape(value, ["format", "version", "id", "createdAt", "finishedAt", "status", "error", "config", "provenance", "matches"], "tournament report");
  ensure(value.format === "orcs-vs-fairies/tournament" && value.version === 1 && id4(value.id), "tournament report identity");
  ensure(text2(value.createdAt, 80) && Number.isFinite(Date.parse(value.createdAt)) && (value.finishedAt === null || text2(value.finishedAt, 80) && Number.isFinite(Date.parse(value.finishedAt))), "tournament dates");
  ensure(["running", "complete", "canceled", "failed"].includes(value.status) && (value.error === null || text2(value.error) && !!value.error), "tournament result");
  ensure(value.status === "running" === (value.finishedAt === null) && value.status === "failed" === (value.error !== null), "tournament completion");
  const config = decodeTournamentConfig(value.config), schedule = tournamentSchedule(config);
  shape(value.provenance, ["contentSha256", "engineSha256", "sources", "agents", "node", "platform", "architecture", "saveVersion"], "tournament provenance");
  const provenance = value.provenance;
  ensure(hash2(provenance.contentSha256) && hash2(provenance.engineSha256) && text2(provenance.node, 80) && text2(provenance.platform, 80) && text2(provenance.architecture, 80) && integer2(provenance.saveVersion, 1, 100), "tournament version pins");
  function files(input) {
    ensure(dense(input, 1, 256), "pinned source files");
    const paths = /* @__PURE__ */ new Set();
    for (const file of input) {
      shape(file, ["path", "sha256"], "source pin");
      ensure(text2(file.path, 4096) && !!file.path && !paths.has(file.path) && hash2(file.sha256), "source pin");
      paths.add(file.path);
    }
  }
  files(provenance.sources);
  ensure(dense(provenance.agents, config.agents.length, config.agents.length), "agent version pins");
  for (const [index2, pin] of provenance.agents.entries()) {
    shape(pin, ["agentId", "command", "files"], "agent pin");
    ensure(pin.agentId === config.agents[index2].id && JSON.stringify(pin.command) === JSON.stringify(config.agents[index2].command), "agent command pin");
    files(pin.files);
  }
  ensure(dense(value.matches, 0, schedule.length) && (value.status !== "complete" || value.matches.length === schedule.length), "recorded matches");
  const matches = [];
  for (const [index2, input] of value.matches.entries()) {
    shape(input, ["id", "index", "seed", "seats", "config", "status", "winnerAgentId", "finalTick", "seconds", "elapsedMs", "agents", "finalStateSha256", "transcriptSha256", "decisions", "checkpoints", "replay"], "match result");
    const pairing = schedule[index2];
    ensure(input.id === pairing.id && input.index === index2 && input.seed === pairing.seed && JSON.stringify(input.seats) === JSON.stringify(pairing.seats), "match schedule");
    ensure(["battle", "limit", "forfeit", "double-forfeit", "aborted"].includes(input.status) && (input.winnerAgentId === null || pairing.seats.includes(input.winnerAgentId)) && integer2(input.finalTick, 0, config.maxSeconds * 20) && typeof input.seconds === "number" && Number.isFinite(input.seconds) && input.seconds >= 0 && Math.abs(input.seconds - input.finalTick * 0.05) < 1e-6 && typeof input.elapsedMs === "number" && Number.isFinite(input.elapsedMs) && input.elapsedMs >= 0 && hash2(input.finalStateSha256) && hash2(input.transcriptSha256), "match outcome");
    const matchConfig = tournamentMatchConfig(config, pairing.seats, pairing.seed);
    const configured = createMatch(input.config), expected = createMatch(matchConfig);
    ensure(replayChecksum(configured) === replayChecksum(expected), "pinned match configuration");
    ensure(dense(input.agents, 2, 2), "match processes");
    const agents = input.agents.map((stats, side2) => decodeStats(stats, pairing.seats[side2]));
    ensure(dense(input.decisions, 0, 108002) && dense(input.checkpoints, 1, 54002), "match evidence");
    let previousTick = -1;
    for (const checkpoint of input.checkpoints) {
      shape(checkpoint, ["tick", "stateSha256"], "match checkpoint");
      ensure(integer2(checkpoint.tick, 0, input.finalTick) && checkpoint.tick > previousTick && hash2(checkpoint.stateSha256), "match checkpoint");
      previousTick = checkpoint.tick;
    }
    ensure(input.checkpoints[0].tick === 0 && previousTick === input.finalTick && input.checkpoints.at(-1).stateSha256 === input.finalStateSha256, "final checkpoint");
    let lastDecisionTick = -1;
    for (const decision of input.decisions) {
      shape(decision, ["tick", "requestId", "side", "observationSha256", "commands", "fault"], "agent decision");
      ensure(integer2(decision.tick, 0, input.finalTick) && decision.tick >= lastDecisionTick && integer2(decision.requestId, 1) && (decision.side === 0 || decision.side === 1) && hash2(decision.observationSha256) && (decision.fault === null || text2(decision.fault) && !!decision.fault) && dense(decision.commands, 0, config.maxCommandsPerTurn), "agent decision");
      lastDecisionTick = decision.tick;
      for (const receipt of decision.commands) {
        shape(receipt, ["command", "accepted"], "command receipt");
        ensure(validateCommand(receipt.command) && typeof receipt.accepted === "boolean", "command receipt");
      }
    }
    const replay = decodeReplay(input.replay);
    ensure(replay.finalTick === input.finalTick && replay.initial.state.tick === 0 && tournamentStateText(expected) === tournamentStateText(loadGame(replay.initial)), "initial replay configuration");
    matches.push({ ...structuredClone(input), config: matchConfig, agents, replay });
  }
  return { ...structuredClone(value), config, matches };
}

// src/tournament/runner.ts
import { spawn } from "node:child_process";
import { createHash as createHash4, randomUUID as randomUUID2 } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// src/cli/session.ts
import { createHash as createHash3 } from "node:crypto";
function stateHash(s) {
  const saved = saveGame(s);
  saved.state.visible = saved.state.visible.map((x) => x.sort((a, b) => a - b));
  saved.state.explored = saved.state.explored.map((x) => x.sort((a, b) => a - b));
  const json3 = JSON.stringify(saved);
  return createHash3("sha256").update(json3).digest("hex");
}

// src/tournament/runner.ts
var sha256 = (value) => createHash4("sha256").update(value).digest("hex");
var message4 = (error2) => (error2 instanceof Error ? error2.message : String(error2)).slice(0, 2e3);
var delay = (milliseconds) => new Promise((resolve4) => {
  const timer = setTimeout(resolve4, milliseconds);
  timer.unref();
});
var record4 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var TerminalAgentProcess = class {
  constructor(agent, cwd, maxCommands) {
    this.maxCommands = maxCommands;
    this.process = spawn(agent.command[0], agent.command.slice(1), { cwd, stdio: "pipe", windowsHide: true, detached: process.platform !== "win32" });
    this.stats = {
      agentId: agent.id,
      pid: this.process.pid ?? null,
      turns: 0,
      accepted: 0,
      rejected: 0,
      fault: null,
      stderr: "",
      stderrTruncated: false,
      exitCode: null,
      exitSignal: null
    };
    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => this.output(chunk));
    this.process.stderr.on("data", (chunk) => {
      const room = 16384 - this.stats.stderr.length;
      this.stats.stderr += chunk.slice(0, Math.max(0, room));
      if (chunk.length > room) this.stats.stderrTruncated = true;
    });
    this.process.on("error", (error2) => this.fail(new Error(`Agent process failed: ${message4(error2)}`)));
    this.process.stdin.on("error", (error2) => {
      if (!this.stopping) this.fail(new Error(`Agent stdin failed: ${message4(error2)}`));
    });
    this.exit = new Promise((resolve4) => this.process.once("close", (code, signal) => {
      this.exited = true;
      this.stats.exitCode = code;
      this.stats.exitSignal = signal;
      if (!this.stopping) this.fail(new Error(`Agent exited before the match finished (${signal ?? code ?? "unknown"}).`));
      resolve4();
    }));
  }
  maxCommands;
  stats;
  process;
  buffer = "";
  stopping = false;
  exited = false;
  fault;
  pending;
  exit;
  fail(error2) {
    this.fault ??= error2;
    this.pending?.reject(this.fault);
  }
  get failure() {
    return this.fault;
  }
  output(chunk) {
    if (this.stopping || this.fault) return;
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer) > 65536) {
      this.fail(new Error("Agent response exceeds 64 KiB."));
      return;
    }
    let newline;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      if (!this.pending) {
        this.fail(new Error("Agent sent an unsolicited response."));
        return;
      }
      let input;
      try {
        input = JSON.parse(line);
      } catch {
        this.fail(new Error("Agent returned invalid JSON."));
        return;
      }
      if (!record4(input) || Object.keys(input).some((key) => !["requestId", "commands"].includes(key)) || input.requestId !== this.pending.requestId || !Array.isArray(input.commands) || input.commands.length > this.maxCommands || Array.from(input.commands).some((command) => !validateCommand(command))) {
        this.fail(new Error("Agent returned a malformed or out-of-sequence decision."));
        return;
      }
      this.pending.resolve(structuredClone(input));
    }
  }
  async ask(turn, timeout, signal) {
    this.stats.turns++;
    if (this.fault) throw this.fault;
    if (signal?.aborted) throw new Error("Tournament canceled.");
    if (this.pending) throw new Error("Agent already has an outstanding decision.");
    return new Promise((resolve4, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        this.pending = void 0;
      };
      const abort = () => {
        cleanup();
        reject(new Error("Tournament canceled."));
      };
      const timer = setTimeout(() => this.fail(new Error(`Agent response timed out after ${timeout} ms.`)), timeout);
      this.pending = {
        requestId: turn.requestId,
        resolve: (decision) => {
          cleanup();
          resolve4(decision);
        },
        reject: (error2) => {
          cleanup();
          reject(error2);
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      this.process.stdin.write(JSON.stringify(turn) + "\n", (error2) => {
        if (error2) this.fail(new Error(`Agent request failed: ${message4(error2)}`));
      });
    });
  }
  kill(signal) {
    if (this.exited) return;
    try {
      if (process.platform === "win32" || !this.process.pid) this.process.kill(signal);
      else process.kill(-this.process.pid, signal);
    } catch (error2) {
      if (error2.code !== "ESRCH") throw error2;
    }
  }
  async stop() {
    this.stopping = true;
    this.process.stdin.end();
    await Promise.race([this.exit, delay(250)]);
    if (!this.exited) {
      this.kill("SIGTERM");
      await Promise.race([this.exit, delay(250)]);
    }
    if (!this.exited) {
      this.kill("SIGKILL");
      await this.exit;
    }
  }
};
async function sourceFiles(cwd) {
  const files = [];
  for (const directory of ["src/core", "src/tournament", "src/cli"]) {
    for (const entry of await readdir(path.join(cwd, directory), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".ts")) files.push(`${directory}/${entry.name}`);
    }
  }
  return files.sort();
}
async function executablePath(command, cwd) {
  if (command.includes("/") || command.includes("\\")) return path.resolve(cwd, command);
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.resolve(directory || cwd, command);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
    }
  }
  throw new Error(`Executable is not available: ${command}`);
}
async function tournamentProvenance(config, cwd) {
  const sources = await Promise.all((await sourceFiles(cwd)).map(async (file) => ({ path: file, sha256: sha256(await readFile(path.join(cwd, file))) })));
  const agents = [];
  for (const agent of config.agents) {
    const paths = /* @__PURE__ */ new Set([await executablePath(agent.command[0], cwd), ...(agent.sourceFiles ?? []).map((file) => path.resolve(cwd, file))]);
    if (agent.command[1] && !agent.command[1].startsWith("-")) {
      const script = path.resolve(cwd, agent.command[1]);
      try {
        await access(script);
        paths.add(script);
      } catch {
      }
    }
    const files = await Promise.all([...paths].sort().map(async (file) => ({ path: file, sha256: sha256(await readFile(file)) })));
    agents.push({ agentId: agent.id, command: [...agent.command], files });
  }
  return {
    contentSha256: sha256(tournamentContentText()),
    engineSha256: sha256(JSON.stringify(sources)),
    sources,
    agents,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    saveVersion: SAVE_VERSION
  };
}
async function writeJson(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  await rename(temporary, file);
}
async function runMatch(config, pairing, options, report) {
  const started = performance.now(), matchConfig = tournamentMatchConfig(config, pairing.seats, pairing.seed), state = createMatch(matchConfig);
  const recorder = new MatchRecorder(state), views = [new PlayerView(0), new PlayerView(1)];
  const processes = pairing.seats.map((agentId) => new TerminalAgentProcess(config.agents.find((agent) => agent.id === agentId), options.cwd, config.maxCommandsPerTurn));
  const decisions = [], checkpoints = [];
  let receipts = [[], []], requestId = 0;
  let status = "limit", winnerAgentId = null;
  const checkpoint = () => {
    const value = { tick: state.tick, stateSha256: stateHash(state) };
    if (checkpoints.at(-1)?.tick === state.tick) checkpoints[checkpoints.length - 1] = value;
    else checkpoints.push(value);
  };
  const progress = () => options.onProgress?.(tournamentProgress(report, { matchId: pairing.id, seats: pairing.seats, tick: state.tick, seconds: state.time }));
  checkpoint();
  try {
    progress();
    while (!isGameOver(state) && state.tick < config.maxSeconds * 20) {
      if (options.signal?.aborted) {
        status = "aborted";
        break;
      }
      requestId++;
      const observations = views.map((view) => view.observe(state));
      const replies = await Promise.allSettled(processes.map((agent, side2) => agent.ask({
        protocol: "orcs-vs-fairies/tournament-agent",
        version: 1,
        type: "turn",
        requestId,
        observation: observations[side2],
        receipts: receipts[side2]
      }, config.responseTimeoutMs, options.signal)));
      const canceled = options.signal?.aborted ?? false;
      const failures = replies.map((reply, side2) => processes[side2].failure ?? (reply.status === "rejected" ? reply.reason : void 0));
      const failed = failures.map((failure) => failure !== void 0);
      receipts = [[], []];
      for (const side2 of requestId % 2 ? [0, 1] : [1, 0]) {
        const reply = replies[side2], agent = processes[side2];
        const fault = !canceled && failed[side2] ? message4(failures[side2]) : null;
        if (fault) agent.stats.fault = fault;
        const commands = reply.status === "fulfilled" ? reply.value.commands : [];
        for (const command of commands) {
          const accepted = canceled || failed.some(Boolean) ? false : issueCommand(state, side2, command);
          receipts[side2].push({ command: structuredClone(command), accepted });
          if (accepted) agent.stats.accepted++;
          else agent.stats.rejected++;
        }
        decisions.push({
          tick: state.tick,
          requestId,
          side: side2,
          observationSha256: sha256(JSON.stringify(observations[side2])),
          commands: structuredClone(receipts[side2]),
          fault
        });
      }
      checkpoint();
      if (canceled) {
        status = "aborted";
        break;
      }
      if (failed.some(Boolean)) {
        status = failed.every(Boolean) ? "double-forfeit" : "forfeit";
        winnerAgentId = failed.every(Boolean) ? null : pairing.seats[failed[0] ? 1 : 0];
        break;
      }
      const ticks = Math.min(config.decisionTicks, config.maxSeconds * 20 - state.tick);
      for (let offset = 0; offset < ticks && !isGameOver(state); offset++) {
        stepGame(state, 0.05);
        for (const view of views) view.update(state);
      }
      checkpoint();
      progress();
    }
    if (isGameOver(state)) {
      status = "battle";
      winnerAgentId = state.draw ? null : pairing.seats[state.winner];
    }
    checkpoint();
  } finally {
    await Promise.all(processes.map((agent) => agent.stop()));
    recorder.dispose();
  }
  const replay = recorder.export();
  const verification = new ReplayPlayer(replay);
  try {
    verification.seek(replay.finalTick);
    if (stateHash(verification.state) !== stateHash(state)) throw new Error("Tournament replay final state diverged.");
  } finally {
    verification.dispose();
  }
  return {
    ...pairing,
    config: matchConfig,
    status,
    winnerAgentId,
    finalTick: state.tick,
    seconds: state.time,
    elapsedMs: performance.now() - started,
    agents: processes.map((agent) => ({ ...agent.stats })),
    finalStateSha256: stateHash(state),
    transcriptSha256: sha256(JSON.stringify(decisions)),
    decisions,
    checkpoints,
    replay
  };
}
async function runTournament(input, options) {
  const config = decodeTournamentConfig(input), cwd = path.resolve(options.cwd), output = options.outputDirectory && path.resolve(options.outputDirectory);
  if (output) {
    await mkdir(path.dirname(output), { recursive: true });
    await mkdir(output);
  }
  const report = {
    format: "orcs-vs-fairies/tournament",
    version: 1,
    id: options.id ?? `run-${randomUUID2()}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    finishedAt: null,
    status: "running",
    error: null,
    config,
    provenance: await tournamentProvenance(config, cwd),
    matches: []
  };
  options = { ...options, cwd };
  try {
    options.onProgress?.(tournamentProgress(report));
    for (const pairing of tournamentSchedule(config)) {
      if (options.signal?.aborted) {
        report.status = "canceled";
        break;
      }
      const match = await runMatch(config, pairing, options, report);
      report.matches.push(match);
      if (output) {
        await writeJson(path.join(output, `${match.id}.replay.json`), match.replay);
        const { replay, ...evidence } = match;
        await writeJson(path.join(output, `${match.id}.evidence.json`), evidence);
      }
      options.onProgress?.(tournamentProgress(report));
      if (match.status === "aborted") {
        report.status = "canceled";
        break;
      }
    }
    if (report.status === "running") report.status = "complete";
  } catch (error2) {
    report.status = "failed";
    report.error = message4(error2);
  }
  report.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (output) await writeJson(path.join(output, "tournament.json"), report);
  options.onProgress?.(tournamentProgress(report));
  return report;
}

// src/tournament/service.ts
var HttpFailure = class extends Error {
  constructor(status, message5) {
    super(message5);
    this.status = status;
  }
  status;
};
function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}
async function body(request) {
  if (Number(request.headers["content-length"]) > 4096) throw new HttpFailure(413, "Tournament requests may contain only a registered configuration ID.");
  let content = "";
  for await (const chunk of request) {
    content += chunk;
    if (Buffer.byteLength(content) > 4096) throw new HttpFailure(413, "Tournament request exceeds 4 KiB.");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new HttpFailure(400, "Invalid tournament request JSON.");
  }
}
var object5 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function createTournamentService(options) {
  const configs = options.configs.map(decodeTournamentConfig), byConfig = /* @__PURE__ */ new Map();
  for (const config of configs) {
    if (byConfig.has(config.id)) throw new Error("Duplicate registered tournament configuration.");
    byConfig.set(config.id, config);
  }
  const outputRoot = path2.resolve(options.outputRoot), owners = path2.join(outputRoot, "owners"), principal = options.principal;
  const jobs = /* @__PURE__ */ new Map();
  let active4 = null, disposed = false, disposing;
  const validPrincipal = (value) => typeof value === "string" && value.length > 0 && value.length <= 1024;
  const ownerFile = (id6) => path2.join(owners, `${id6}.json`);
  async function readOwner(id6) {
    try {
      const value = JSON.parse(await readFile2(ownerFile(id6), "utf8"));
      return object5(value) && Object.keys(value).every((key) => ["version", "id", "principal"].includes(key)) && value.version === 1 && value.id === id6 && validPrincipal(value.principal) ? value.principal : void 0;
    } catch {
      return void 0;
    }
  }
  async function writeOwner(id6, creator) {
    await mkdir2(owners, { recursive: true });
    const file = await open(ownerFile(id6), "wx", 384);
    try {
      await file.writeFile(JSON.stringify({ version: 1, id: id6, principal: creator }) + "\n");
      await file.sync();
      await file.close();
    } catch (error2) {
      await file.close().catch(() => {
      });
      await rm(ownerFile(id6), { force: true });
      throw error2;
    }
  }
  async function identity(request) {
    if (!principal) return void 0;
    const creator = await principal(request);
    if (disposed) throw new HttpFailure(503, "Tournament service is shutting down.");
    if (!validPrincipal(creator)) throw new HttpFailure(403, "Tournament mutations require an account identity.");
    return creator;
  }
  const ready = (async () => {
    await mkdir2(outputRoot, { recursive: true });
    for (const entry of await readdir2(outputRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^run-[a-z0-9_-]+$/i.test(entry.name)) continue;
      try {
        const report = decodeTournamentReport(await readFile2(path2.join(outputRoot, entry.name, "tournament.json"), "utf8"));
        if (report.status !== "running" && report.id === entry.name) jobs.set(report.id, {
          creator: await readOwner(report.id),
          progress: tournamentProgress(report),
          report,
          abort: new AbortController()
        });
      } catch {
      }
    }
  })();
  function choices() {
    return configs.map((config) => ({
      id: config.id,
      name: config.name,
      agents: config.agents.map(({ id: id6, name, faction }) => ({ id: id6, name, faction })),
      seeds: [...config.seeds],
      mapSize: config.mapSize,
      bothSeats: config.bothSeats,
      maxSeconds: config.maxSeconds
    }));
  }
  async function handle(request, response) {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/tournaments" && !url.pathname.startsWith("/api/tournaments/")) return false;
    try {
      await ready;
      if (disposed) throw new HttpFailure(503, "Tournament service is shutting down.");
      const authorized = await options.authorize(request);
      if (disposed) throw new HttpFailure(503, "Tournament service is shutting down.");
      if (!authorized) throw new HttpFailure(403, "Tournament access is not authorized.");
      if (request.method === "GET" && url.pathname === "/api/tournaments/configs") {
        json(response, 200, choices());
        return true;
      }
      if (request.method === "GET" && url.pathname === "/api/tournaments") {
        json(response, 200, [...jobs.values()].map((job2) => job2.progress));
        return true;
      }
      if (request.method === "POST" && url.pathname === "/api/tournaments") {
        const input = await body(request);
        if (disposed) throw new HttpFailure(503, "Tournament service is shutting down.");
        if (!object5(input) || Object.keys(input).some((key) => key !== "configId") || typeof input.configId !== "string") throw new HttpFailure(400, "Select a registered tournament configuration.");
        const config = byConfig.get(input.configId);
        if (!config) throw new HttpFailure(404, "Unknown tournament configuration.");
        const creator = await identity(request);
        if (disposed) throw new HttpFailure(503, "Tournament service is shutting down.");
        if (active4) throw new HttpFailure(409, "A tournament is already running.");
        const id6 = `run-${randomUUID3()}`, abort = new AbortController();
        if (jobs.has(id6)) throw new HttpFailure(500, "Tournament identity already exists.");
        const job2 = {
          creator,
          abort,
          progress: {
            id: id6,
            status: "running",
            totalMatches: config.agents.length * (config.agents.length - 1) / 2 * config.seeds.length * (config.bothSeats ? 2 : 1),
            completedMatches: 0,
            standings: tournamentStandings({ config, matches: [] }),
            current: null,
            error: null
          }
        };
        active4 = id6;
        jobs.set(id6, job2);
        let launched = false, ownerWritten = false;
        let accept, reject;
        const accepted = new Promise((resolve4, rejectStart) => {
          accept = resolve4;
          reject = rejectStart;
        });
        job2.done = (async () => {
          try {
            if (creator !== void 0) {
              await writeOwner(id6, creator);
              ownerWritten = true;
            }
            if (disposed) throw new HttpFailure(503, "Tournament service is shutting down.");
            const result = runTournament(config, {
              cwd: options.cwd,
              outputDirectory: path2.join(outputRoot, id6),
              id: id6,
              signal: abort.signal,
              onProgress: (progress) => {
                job2.progress = structuredClone(progress);
              }
            });
            launched = true;
            accept();
            job2.report = await result;
            job2.progress = tournamentProgress(job2.report);
          } catch (error2) {
            if (ownerWritten) {
              try {
                await rm(ownerFile(id6), { force: true });
              } catch (cleanupError) {
                error2 = new Error(`Tournament ownership cleanup failed: ${String(cleanupError)}; original failure: ${String(error2)}`);
              }
            }
            if (!launched) {
              jobs.delete(id6);
              reject(error2);
            } else job2.progress = { ...job2.progress, status: "failed", current: null, error: error2 instanceof Error ? error2.message : String(error2) };
          } finally {
            if (active4 === id6) active4 = null;
          }
        })();
        await accepted;
        json(response, 202, { id: id6 });
        return true;
      }
      const route2 = /^\/api\/tournaments\/(run-[a-z0-9_-]+)(?:\/(result|cancel|matches\/([a-z0-9_-]+)\/replay))?$/.exec(url.pathname);
      if (!route2) throw new HttpFailure(404, "Unknown tournament route.");
      const job = jobs.get(route2[1]);
      if (!job) throw new HttpFailure(404, "Unknown tournament.");
      if (request.method === "GET" && !route2[2]) {
        json(response, 200, job.progress);
        return true;
      }
      if (request.method === "POST" && route2[2] === "cancel") {
        if (principal && await identity(request) !== job.creator) throw new HttpFailure(403, "Only the tournament creator may cancel this run.");
        if (disposed) throw new HttpFailure(503, "Tournament service is shutting down.");
        job.abort.abort();
        json(response, 202, { canceled: true });
        return true;
      }
      if (request.method === "GET" && route2[2] === "result") {
        if (!job.report) throw new HttpFailure(job.progress.status === "failed" ? 500 : 409, job.progress.error ?? "The tournament is still running.");
        json(response, 200, job.report);
        return true;
      }
      if (request.method === "GET" && route2[3]) {
        const match = job.report?.matches.find((match2) => match2.id === route2[3]);
        if (!match) throw new HttpFailure(404, "Match replay is not available.");
        json(response, 200, match.replay);
        return true;
      }
      throw new HttpFailure(405, "Unsupported tournament method.");
    } catch (error2) {
      if (!response.headersSent) json(response, error2 instanceof HttpFailure ? error2.status : 500, { error: error2 instanceof Error ? error2.message : String(error2) });
      else response.end();
      request.resume();
      return true;
    }
  }
  return { handle, dispose() {
    if (disposing) return disposing;
    disposed = true;
    for (const job of jobs.values()) if (job.progress.status === "running") job.abort.abort();
    disposing = (async () => {
      await ready;
      await Promise.all([...jobs.values()].map((job) => job.done));
    })();
    return disposing;
  } };
}

// src/editor/map-package.ts
var EDITOR_MAP_LIMITS = { minimumDimension: 8, maximumDimension: 128, levels: 2, elevation: 3, resources: 2048, sites: 128, transitions: 64, bytes: 16 * 1024 * 1024 };
var EDITOR_SIMULATION_VERSION = SAVE_VERSION;
var MAP_FIELDS = ["width", "height", "size", "seed", "levels", "starts", "resources", "sites", "transitions"];
var PACKAGE_FIELDS = ["schemaVersion", "kind", "id", "title", "author", "revision", "simulationVersion", "mapVersion", "contentHash", "hash", "map"];
var HASH_PATTERN = /^[0-9a-f]{16}$/;
function bad4(path3, detail) {
  throw new Error(`Invalid editor map at ${path3}: ${detail}.`);
}
function copyJson2(input) {
  let nodes = 0, stringBytes = 0;
  const ancestors = /* @__PURE__ */ new Set();
  function copy(value, path3, depth) {
    if (++nodes > 5e5 || depth > 16) bad4(path3, "document exceeds size or depth limit");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) bad4(path3, "expected finite JSON number");
      return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value === "string") {
      stringBytes += value.length * 2;
      if (stringBytes > EDITOR_MAP_LIMITS.bytes) bad4(path3, "document exceeds byte limit");
      return value;
    }
    if (!value || typeof value !== "object") bad4(path3, "expected JSON data");
    if (ancestors.has(value)) bad4(path3, "cyclic references are forbidden");
    ancestors.add(value);
    let result2;
    if (Array.isArray(value)) {
      if (value.length > EDITOR_MAP_LIMITS.maximumDimension ** 2) bad4(path3, "array exceeds length limit");
      const keys4 = Reflect.ownKeys(value);
      if (keys4.length !== value.length + 1 || keys4.some((k) => typeof k !== "string" || k !== "length" && !/^(0|[1-9][0-9]*)$/.test(k))) bad4(path3, "array gaps or extra properties are forbidden");
      const array4 = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !("value" in descriptor)) bad4(`${path3}[${i}]`, "array gaps and accessors are forbidden");
        array4.push(copy(descriptor.value, `${path3}[${i}]`, depth + 1));
      }
      result2 = array4;
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) bad4(path3, "expected plain object");
      const keys4 = Reflect.ownKeys(value);
      if (keys4.length > 32 || keys4.some((key) => typeof key !== "string")) bad4(path3, "invalid object properties");
      const record7 = /* @__PURE__ */ Object.create(null);
      for (const key of keys4) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!("value" in descriptor) || !descriptor.enumerable) bad4(`${path3}.${key}`, "accessors and hidden fields are forbidden");
        if (["__proto__", "constructor", "prototype"].includes(key)) bad4(path3, "unsafe property name");
        record7[key] = copy(descriptor.value, `${path3}.${key}`, depth + 1);
      }
      result2 = record7;
    }
    ancestors.delete(value);
    return result2;
  }
  const result = copy(input, "map", 0);
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
function object6(value, path3, fields2) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad4(path3, "expected object");
  const record7 = value;
  for (const key of fields2) if (!Object.hasOwn(record7, key)) bad4(`${path3}.${key}`, "missing field");
  for (const key of Object.keys(record7)) if (!fields2.includes(key)) bad4(`${path3}.${key}`, "unknown field");
  return record7;
}
function number4(value, path3, min, max, integer5 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer5 && !Number.isSafeInteger(value)) bad4(path3, `expected ${integer5 ? "integer" : "number"} between ${min} and ${max}`);
  return value;
}
function textValue(value, path3, max, allowEmpty = false) {
  if (typeof value !== "string" || value.length > max || !allowEmpty && !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) bad4(path3, "invalid text");
  return value;
}
function choice4(value, path3, choices) {
  if (typeof value !== "string" || !choices.includes(value)) bad4(path3, "unknown value");
  return value;
}
function array(value, path3, max, length2) {
  if (!Array.isArray(value) || value.length > max || length2 !== void 0 && value.length !== length2) bad4(path3, "invalid array length");
  return value;
}
function unique(set, value, path3) {
  if (set.has(value)) bad4(path3, "duplicate ID or slot");
  set.add(value);
}
function readMap(value) {
  const m = object6(value, "map", MAP_FIELDS), width = number4(m.width, "map.width", 8, 128, true), height = number4(m.height, "map.height", 8, 128, true), cells = width * height;
  choice4(m.size, "map.size", ["small", "medium", "large", "huge"]);
  number4(m.seed, "map.seed", 0, 4294967295, true);
  const levelIds = /* @__PURE__ */ new Set(), levels = array(m.levels, "map.levels", 2);
  if (!levels.length) bad4("map.levels", "at least one level is required");
  levels.forEach((value2, index2) => {
    const path3 = `map.levels[${index2}]`, level2 = object6(value2, path3, ["id", "title", "terrain", "elevation"]);
    unique(levelIds, number4(level2.id, `${path3}.id`, 0, 1, true), `${path3}.id`);
    if (level2.id !== index2) bad4(`${path3}.id`, "levels must be ordered from 0");
    textValue(level2.title, `${path3}.title`, 80);
    array(level2.terrain, `${path3}.terrain`, cells, cells).forEach((kind, tile) => choice4(kind, `${path3}.terrain[${tile}]`, Object.keys(TERRAIN)));
    array(level2.elevation, `${path3}.elevation`, cells, cells).forEach((height2, tile) => number4(height2, `${path3}.elevation[${tile}]`, 0, 3, true));
  });
  if (!levelIds.has(0)) bad4("map.levels", "ground level 0 is required");
  const point5 = (p, path3) => {
    number4(p.x, `${path3}.x`, 0.5, width - 0.5);
    number4(p.y, `${path3}.y`, 0.5, height - 0.5);
    const level2 = number4(p.level, `${path3}.level`, 0, 1, true);
    if (!levelIds.has(level2)) bad4(`${path3}.level`, "unknown level");
  };
  const slots = /* @__PURE__ */ new Set();
  array(m.starts, "map.starts", 8).forEach((value2, index2) => {
    const path3 = `map.starts[${index2}]`, start = object6(value2, path3, ["x", "y", "level", "slot"]);
    point5(start, path3);
    unique(slots, number4(start.slot, `${path3}.slot`, 0, 7, true), `${path3}.slot`);
  });
  array(m.resources, "map.resources", EDITOR_MAP_LIMITS.resources).forEach((value2, index2) => {
    const path3 = `map.resources[${index2}]`, resource = object6(value2, path3, ["x", "y", "level", "kind", "amount", "maxAmount"]);
    point5(resource, path3);
    choice4(resource.kind, `${path3}.kind`, ["wood", "ore", "crystal"]);
    const max = number4(resource.maxAmount, `${path3}.maxAmount`, 0, 1e9);
    number4(resource.amount, `${path3}.amount`, 0, max);
  });
  const siteIds = /* @__PURE__ */ new Set();
  array(m.sites, "map.sites", EDITOR_MAP_LIMITS.sites).forEach((value2, index2) => {
    const path3 = `map.sites[${index2}]`, site = object6(value2, path3, ["id", "x", "y", "level", "kind"]);
    point5(site, path3);
    unique(siteIds, number4(site.id, `${path3}.id`, 1, 2147483647, true), `${path3}.id`);
    choice4(site.kind, `${path3}.kind`, ["relic", "village", "monster"]);
  });
  const transitionIds = /* @__PURE__ */ new Set();
  array(m.transitions, "map.transitions", EDITOR_MAP_LIMITS.transitions).forEach((value2, index2) => {
    const path3 = `map.transitions[${index2}]`, transition = object6(value2, path3, ["id", "from", "to"]);
    unique(transitionIds, number4(transition.id, `${path3}.id`, 1, 2147483647, true), `${path3}.id`);
    point5(object6(transition.from, `${path3}.from`, ["x", "y", "level"]), `${path3}.from`);
    point5(object6(transition.to, `${path3}.to`, ["x", "y", "level"]), `${path3}.to`);
  });
  return JSON.parse(JSON.stringify(m));
}
function decodeEditorMap(input) {
  return readMap(source(input));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record7 = value;
    return `{${Object.keys(record7).sort().map((key) => `${JSON.stringify(key)}:${canonical(record7[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function checksum(value) {
  const bytes = new TextEncoder().encode(canonical(value));
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
function metadata(value) {
  const m = object6(value, "package", ["id", "title", "author", "revision", "simulationVersion", "mapVersion"]);
  const id6 = textValue(m.id, "package.id", 64);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id6)) bad4("package.id", "expected letters, numbers, dots, underscores or hyphens");
  textValue(m.title, "package.title", 120);
  textValue(m.author, "package.author", 120);
  number4(m.revision, "package.revision", 1, 2147483647, true);
  if (m.simulationVersion !== EDITOR_SIMULATION_VERSION) bad4("package.simulationVersion", `unsupported simulation version; expected ${EDITOR_SIMULATION_VERSION}`);
  if (m.mapVersion !== MAP_VERSION) bad4("package.mapVersion", `unsupported map version; expected ${MAP_VERSION}`);
  return m;
}
function canonicalPackageHash(input) {
  const value = object6(source(input), "package", PACKAGE_FIELDS.filter((key) => key !== "hash"));
  if (value.schemaVersion !== 1 || value.kind !== "map") bad4("package", "unsupported package schema or kind");
  const m = metadata({ id: value.id, title: value.title, author: value.author, revision: value.revision, simulationVersion: value.simulationVersion, mapVersion: value.mapVersion });
  const map = readMap(value.map), contentHash2 = canonicalMapHash(map);
  if (value.contentHash !== contentHash2) bad4("package.contentHash", "map checksum mismatch");
  return checksum({ schemaVersion: 1, kind: "map", ...m, contentHash: contentHash2, map });
}
function decodeMapPackage(input) {
  const value = object6(source(input), "package", PACKAGE_FIELDS);
  if (value.schemaVersion !== 1 || value.kind !== "map") bad4("package", "unsupported package schema or kind");
  for (const key of ["hash", "contentHash"]) if (typeof value[key] !== "string" || !HASH_PATTERN.test(value[key])) bad4(`package.${key}`, "invalid checksum");
  const { hash: hash4, ...withoutHash } = value;
  if (hash4 !== canonicalPackageHash(withoutHash)) bad4("package.hash", "package checksum mismatch");
  return { ...withoutHash, map: readMap(value.map), hash: hash4 };
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
  } catch (error2) {
    return { valid: false, issues: [error2 instanceof Error ? error2.message : String(error2)], startsConnected: false, reachableResources: 0, totalResources: 0, reachableTiles: 0 };
  }
  let result = validatePlayableMap(map, 0.5);
  if (!result.valid && result.issues.every((issue) => /disconnected|unreachable|endpoints must be passable/.test(issue))) result = validatePlayableMap(map, 0.25);
  const issues = [.../* @__PURE__ */ new Set([...result.issues, ...validateWorldMap(map).issues])];
  return { ...result, valid: issues.length === 0, issues };
}
function validatePlayableMap(map, CELL) {
  const { width, height, starts, resources: resources2, sites, transitions } = map, issues = [], levels = new Map(map.levels.map((level2) => [level2.id, level2]));
  const tile = (p) => Math.floor(p.y) * width + Math.floor(p.x);
  const terrain2 = (p) => levels.get(p.level).terrain[tile(p)];
  const resourceBuckets = /* @__PURE__ */ new Map();
  for (const resource of resources2) {
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
    if (resources2.some((resource) => resource.amount > 0 && sameLevel6(resource, start) && Math.abs(resource.x - start.x) < HQ_RADIUS + 0.8 && Math.abs(resource.y - start.y) < HQ_RADIUS + 0.8)) issues.push(`Start ${start.slot} headquarters overlaps a resource.`);
    if (opening(start, height).some((point5) => !walkable2(point5))) issues.push(`Start ${start.slot} opening units overlap blocked terrain or objects.`);
  }
  for (let a = 0; a < starts.length; a++) for (let b = a + 1; b < starts.length; b++) if (sameLevel6(starts[a], starts[b]) && Math.abs(starts[a].x - starts[b].x) < HQ_RADIUS * 2 + 0.4 && Math.abs(starts[a].y - starts[b].y) < HQ_RADIUS * 2 + 0.4) issues.push(`Starts ${starts[a].slot} and ${starts[b].slot} headquarters overlap.`);
  resources2.forEach((resource, index2) => {
    if (!TERRAIN[terrain2(resource)].walkable) issues.push(`Resource ${index2} lies on impassable terrain.`);
    if (nearby(resource, 1.4).some((other) => other !== resource && separation(resource, other) < 1.4)) issues.push(`Resource ${index2} overlaps another resource.`);
  });
  sites.forEach((site) => {
    if (!walkable2(site)) issues.push(`Site ${site.id} lies on blocked terrain or objects.`);
    if (sites.some((other) => other !== site && separation(other, site) < 1.4)) issues.push(`Site ${site.id} overlaps another site.`);
  });
  const gridWidth = width / CELL, gridHeight = height / CELL, perLevel = gridWidth * gridHeight, total = perLevel * map.levels.length;
  const offsets = new Map(map.levels.map((level2, index2) => [level2.id, index2 * perLevel]));
  const gridPoint = (key) => {
    const offset = Math.floor(key / perLevel), local = key % perLevel;
    return { x: (local % gridWidth + 0.5) * CELL, y: (Math.floor(local / gridWidth) + 0.5) * CELL, level: map.levels[offset].id };
  };
  const blocked = new Uint8Array(total), seen = new Uint8Array(total);
  for (let key = 0; key < total; key++) if (!walkable2(gridPoint(key))) blocked[key] = 1;
  const connectors = (p) => {
    const keys4 = [], sx = Math.floor(p.x / CELL), sy = Math.floor(p.y / CELL), offset = offsets.get(p.level);
    for (let y = Math.max(0, sy - 1); y <= Math.min(gridHeight - 1, sy + 1); y++) for (let x = Math.max(0, sx - 1); x <= Math.min(gridWidth - 1, sx + 1); x++) {
      const key = offset + y * gridWidth + x;
      if (!blocked[key] && segment(p, gridPoint(key))) keys4.push(key);
    }
    return keys4;
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
  resources2.forEach((resource, index2) => {
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
  return { valid: issues.length === 0, issues, startsConnected, reachableResources, totalResources: resources2.length, reachableTiles: tiles.size };
}

// src/editor/scenario-package.ts
var SCENARIO_EDITOR_LIMITS = { bytes: 20 * 1024 * 1024, actors: 256, objectives: 32, events: 128, conditionDepth: 8, actions: 16 };
var unitRoles3 = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var buildingRoles3 = ["hq", "depot", "barracks", "tower", "wall", "gate"];
var packageFields = ["schemaVersion", "kind", "simulationVersion", "revision", "author", "mapHash", "contentHash", "hash", "map", "scenario"];
function bad5(path3, detail) {
  throw new Error(`Invalid scenario at ${path3}: ${detail}.`);
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
  function copy(value, path3, depth) {
    if (++nodes > 7e5 || depth > 48) bad5(path3, "document exceeds node or depth limit");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) bad5(path3, "expected a finite number");
      return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value === "string") {
      chars += value.length * 2;
      if (chars > SCENARIO_EDITOR_LIMITS.bytes) bad5(path3, "document exceeds byte limit");
      return value;
    }
    if (!value || typeof value !== "object") bad5(path3, "expected JSON data");
    if (parents.has(value)) bad5(path3, "cyclic references are forbidden");
    parents.add(value);
    let output;
    if (Array.isArray(value)) {
      if (value.length > 65536) bad5(path3, "array exceeds length limit");
      if (Reflect.ownKeys(value).length !== value.length + 1) bad5(path3, "array gaps and extra properties are forbidden");
      const result = [];
      for (let index2 = 0; index2 < value.length; index2++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index2));
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) bad5(`${path3}[${index2}]`, "array gaps and accessors are forbidden");
        result.push(copy(descriptor.value, `${path3}[${index2}]`, depth + 1));
      }
      output = result;
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) bad5(path3, "expected a plain object");
      const keys4 = Reflect.ownKeys(value);
      if (keys4.length > 64 || keys4.some((key) => typeof key !== "string")) bad5(path3, "invalid object properties");
      const result = /* @__PURE__ */ Object.create(null);
      for (const key of keys4) {
        if (["__proto__", "constructor", "prototype"].includes(key)) bad5(path3, "unsafe property name");
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!("value" in descriptor) || !descriptor.enumerable) bad5(`${path3}.${key}`, "accessors and hidden properties are forbidden");
        result[key] = copy(descriptor.value, `${path3}.${key}`, depth + 1);
      }
      output = result;
    }
    parents.delete(value);
    return output;
  }
  const copied = copy(input, "document", 0);
  if (new TextEncoder().encode(JSON.stringify(copied)).byteLength > SCENARIO_EDITOR_LIMITS.bytes) bad5("document", "document exceeds byte limit");
  return copied;
}
function object7(value, path3, fields2, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad5(path3, "expected an object");
  const result = value;
  for (const field of fields2) if (!Object.hasOwn(result, field)) bad5(`${path3}.${field}`, "missing field");
  for (const field of Object.keys(result)) if (!fields2.includes(field) && !optional.includes(field)) bad5(`${path3}.${field}`, "unknown field");
  return result;
}
function number5(value, path3, min = 0, max = 1e9, integer5 = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer5 && !Number.isSafeInteger(value)) bad5(path3, `expected ${integer5 ? "an integer" : "a number"} from ${min} through ${max}`);
  return value;
}
function text3(value, path3, max = 200, empty = false) {
  if (typeof value !== "string" || value.length > max || !empty && !value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) bad5(path3, "invalid text");
  return value;
}
function id5(value, path3) {
  const result = text3(value, path3, 64);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result)) bad5(path3, "use letters, numbers, dots, underscores or hyphens");
  return result;
}
function choice5(value, path3, values) {
  if (typeof value !== "string" || !values.includes(value)) bad5(path3, "unknown value");
  return value;
}
function bool2(value, path3) {
  if (typeof value !== "boolean") bad5(path3, "expected a boolean");
}
function array2(value, path3, max, min = 0) {
  if (!Array.isArray(value) || value.length < min || value.length > max) bad5(path3, `expected ${min} through ${max} entries`);
  return value;
}
function point4(value, path3, width = 256, height = 256) {
  const p = object7(value, path3, ["x", "y"], ["level"]);
  number5(p.x, `${path3}.x`, 0, width);
  number5(p.y, `${path3}.y`, 0, height);
  if (p.x === width || p.y === height) bad5(path3, "point lies outside the map");
  if (p.level !== void 0) number5(p.level, `${path3}.level`, 0, 1, true);
}
function cost4(value, path3) {
  const c = object7(value, path3, ["wood", "ore", "crystal"]);
  for (const key of ["wood", "ore", "crystal"]) number5(c[key], `${path3}.${key}`);
}
function order2(value, path3, refs, width, height) {
  const type = choice5(value?.type, `${path3}.type`, ["move", "attackMove", "hold", "stop", "ability", "attack"]);
  const o = object7(value, path3, type === "move" || type === "attackMove" ? ["type", "x", "y"] : type === "attack" ? ["type", "actor"] : ["type"], type === "move" || type === "attackMove" ? ["level"] : []);
  if (type === "move" || type === "attackMove") point4({ x: o.x, y: o.y }, path3, width, height);
  if (o.level !== void 0) number5(o.level, `${path3}.level`, 0, 1, true);
  if (type === "attack") refs.push(id5(o.actor, `${path3}.actor`));
}
function actor2(value, path3, refs, width, height) {
  const a = object7(value, path3, ["label", "side", "kind", "role", "x", "y"], ["definitionId", "hp", "order", "level"]);
  id5(a.label, `${path3}.label`);
  number5(a.side, `${path3}.side`, 0, 1, true);
  choice5(a.kind, `${path3}.kind`, ["unit", "building"]);
  choice5(a.role, `${path3}.role`, a.kind === "unit" ? unitRoles3 : buildingRoles3);
  point4({ x: a.x, y: a.y }, path3, width, height);
  if (a.level !== void 0) number5(a.level, `${path3}.level`, 0, 1, true);
  if (a.definitionId !== void 0) {
    const value2 = text3(a.definitionId, `${path3}.definitionId`, 96);
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]*(?::[a-zA-Z0-9_.-]+)?$/.test(value2)) bad5(`${path3}.definitionId`, "invalid definition identifier");
  }
  if (a.hp !== void 0) number5(a.hp, `${path3}.hp`, Number.MIN_VALUE, 1e7);
  if (a.order !== void 0) order2(a.order, `${path3}.order`, refs, width, height);
  return a;
}
function condition(value, path3, refs, width, height, depth = 0) {
  if (depth > SCENARIO_EDITOR_LIMITS.conditionDepth) bad5(path3, "condition is too deeply nested");
  const type = choice5(value?.type, `${path3}.type`, ["alive", "dead", "at", "time", "variable", "cleared", "all", "any", "not"]);
  const fields2 = type === "alive" || type === "dead" ? ["type", "actor"] : type === "at" ? ["type", "actor", "point", "radius"] : type === "time" ? ["type", "seconds"] : type === "variable" ? ["type", "key", "op", "value"] : type === "cleared" ? ["type", "side"] : type === "not" ? ["type", "condition"] : ["type", "conditions"];
  const c = object7(value, path3, fields2, type === "cleared" ? ["buildings"] : []);
  if (type === "alive" || type === "dead" || type === "at") refs.push(id5(c.actor, `${path3}.actor`));
  if (type === "at") {
    point4(c.point, `${path3}.point`, width, height);
    number5(c.radius, `${path3}.radius`, 0.1, 256);
  }
  if (type === "time") number5(c.seconds, `${path3}.seconds`, 0, 86400);
  if (type === "variable") {
    id5(c.key, `${path3}.key`);
    choice5(c.op, `${path3}.op`, ["eq", "gte", "lte"]);
    number5(c.value, `${path3}.value`, -1e9, 1e9);
  }
  if (type === "cleared") {
    number5(c.side, `${path3}.side`, 0, 1, true);
    if (c.buildings !== void 0) bool2(c.buildings, `${path3}.buildings`);
  }
  if (type === "all" || type === "any") array2(c.conditions, `${path3}.conditions`, 16, 1).forEach((v, i) => condition(v, `${path3}.conditions[${i}]`, refs, width, height, depth + 1));
  if (type === "not") condition(c.condition, `${path3}.condition`, refs, width, height, depth + 1);
}
function decodeScenarioDefinition(input) {
  return validateScenario(readScenario(jsonInput(input), true));
}
function readScenario(value, complete) {
  const s = object7(value, "scenario", ["schemaVersion", "id", "title", "briefing", "successText", "failureText", "faction", "opponent", "seed", "army", "objectives", "events", "rules"], ["map", "content", "escort", "stealth", "boss", "requiredActions"]);
  if (s.schemaVersion !== 1) bad5("scenario.schemaVersion", "unsupported schema version");
  id5(s.id, "scenario.id");
  text3(s.title, "scenario.title", 120);
  for (const field of ["briefing", "successText", "failureText"]) text3(s[field], `scenario.${field}`, 8e3, true);
  if (s.content !== void 0) s.content = decodeContentBundle(s.content);
  const factions = contentFactions(s.content);
  for (const field of ["faction", "opponent"]) choice5(s[field], `scenario.${field}`, Object.keys(factions));
  number5(s.seed, "scenario.seed", 0, 4294967295, true);
  let width = 256, height = 256;
  if (s.map !== void 0) {
    const m = object7(s.map, "scenario.map", ["size", "width", "height", "terrain", "starts", "resources"], ["world"]);
    width = number5(m.width, "scenario.map.width", 8, 256, true);
    height = number5(m.height, "scenario.map.height", 8, 256, true);
    if (m.world !== void 0) m.world = decodeEditorMap(m.world);
    choice5(m.size, "scenario.map.size", ["small", "medium", "large", "huge"]);
    const terrain2 = array2(m.terrain, "scenario.map.terrain", 65536);
    if (terrain2.length !== width * height) bad5("scenario.map.terrain", "tile count does not match dimensions");
    terrain2.forEach((t, i) => choice5(t, `scenario.map.terrain[${i}]`, Object.keys(TERRAIN)));
    array2(m.starts, "scenario.map.starts", 8, 2).forEach((p, i) => point4(p, `scenario.map.starts[${i}]`, width, height));
    array2(m.resources, "scenario.map.resources", 8192).forEach((v, i) => {
      const p = `scenario.map.resources[${i}]`, r2 = object7(v, p, ["x", "y", "kind", "amount", "maxAmount"], ["level"]);
      point4({ x: r2.x, y: r2.y }, p, width, height);
      if (r2.level !== void 0) number5(r2.level, `${p}.level`, 0, 1, true);
      choice5(r2.kind, `${p}.kind`, ["wood", "ore", "crystal"]);
      number5(r2.amount, `${p}.amount`);
      number5(r2.maxAmount, `${p}.maxAmount`, Number.MIN_VALUE);
      if (r2.amount > r2.maxAmount) bad5(p, "amount exceeds maximum");
    });
  }
  const refs = [], labels = /* @__PURE__ */ new Set();
  const actors = (values, path3, min = 0) => array2(values, path3, SCENARIO_EDITOR_LIMITS.actors, min).forEach((v, i) => {
    const a = actor2(v, `${path3}[${i}]`, refs, width, height);
    if (labels.has(a.label)) bad5(`${path3}[${i}].label`, "duplicate actor label");
    labels.add(a.label);
  });
  actors(s.army, "scenario.army");
  const objectiveIds = /* @__PURE__ */ new Set();
  array2(s.objectives, "scenario.objectives", SCENARIO_EDITOR_LIMITS.objectives, complete ? 1 : 0).forEach((value2, i) => {
    const path3 = `scenario.objectives[${i}]`, o = object7(value2, path3, ["id", "text", "success"], ["failure", "optional"]);
    const key = id5(o.id, `${path3}.id`);
    if (objectiveIds.has(key)) bad5(`${path3}.id`, "duplicate objective ID");
    objectiveIds.add(key);
    text3(o.text, `${path3}.text`, 2e3);
    condition(o.success, `${path3}.success`, refs, width, height);
    if (o.failure !== void 0) condition(o.failure, `${path3}.failure`, refs, width, height);
    if (o.optional !== void 0) bool2(o.optional, `${path3}.optional`);
  });
  const eventIds2 = /* @__PURE__ */ new Set();
  array2(s.events, "scenario.events", SCENARIO_EDITOR_LIMITS.events).forEach((value2, i) => {
    const path3 = `scenario.events[${i}]`, e = object7(value2, path3, ["id", "when", "actions"], ["repeat"]);
    const key = id5(e.id, `${path3}.id`);
    if (eventIds2.has(key)) bad5(`${path3}.id`, "duplicate event ID");
    eventIds2.add(key);
    condition(e.when, `${path3}.when`, refs, width, height);
    if (e.repeat !== void 0) {
      const r2 = object7(e.repeat, `${path3}.repeat`, ["seconds", "count"]);
      number5(r2.seconds, `${path3}.repeat.seconds`, 1, 86400);
      number5(r2.count, `${path3}.repeat.count`, 1, 1e4, true);
    }
    array2(e.actions, `${path3}.actions`, SCENARIO_EDITOR_LIMITS.actions, complete ? 1 : 0).forEach((value3, index2) => {
      const p = `${path3}.actions[${index2}]`, type = choice5(value3?.type, `${p}.type`, ["spawn", "order", "set", "add", "message", "reward", "alliance", "finish"]);
      const a = object7(value3, p, type === "spawn" ? ["type", "actors"] : type === "order" ? ["type", "actors", "order"] : type === "set" || type === "add" ? ["type", "key", "value"] : type === "message" ? ["type", "text"] : type === "reward" ? ["type", "side", "resources"] : type === "alliance" ? ["type", "allied"] : ["type", "outcome", "reason"], type === "message" ? ["speaker"] : []);
      if (type === "spawn") actors(a.actors, `${p}.actors`, 1);
      if (type === "order") {
        array2(a.actors, `${p}.actors`, 512, 1).forEach((v, i2) => refs.push(id5(v, `${p}.actors[${i2}]`)));
        order2(a.order, `${p}.order`, refs, width, height);
      }
      if (type === "set" || type === "add") {
        id5(a.key, `${p}.key`);
        number5(a.value, `${p}.value`, -1e9, 1e9);
      }
      if (type === "message") {
        text3(a.text, `${p}.text`, 8e3);
        if (a.speaker !== void 0) text3(a.speaker, `${p}.speaker`, 120);
      }
      if (type === "reward") {
        number5(a.side, `${p}.side`, 0, 1, true);
        cost4(a.resources, `${p}.resources`);
      }
      if (type === "alliance") bool2(a.allied, `${p}.allied`);
      if (type === "finish") {
        choice5(a.outcome, `${p}.outcome`, ["won", "lost"]);
        text3(a.reason, `${p}.reason`, 2e3);
      }
    });
  });
  const r = object7(s.rules, "scenario.rules", ["fixedArmy", "reinforcementBudget", "resources", "timeLimit"]);
  bool2(r.fixedArmy, "scenario.rules.fixedArmy");
  number5(r.reinforcementBudget, "scenario.rules.reinforcementBudget", 0, 1e5, true);
  number5(r.timeLimit, "scenario.rules.timeLimit", 0.05, 86400);
  cost4(r.resources, "scenario.rules.resources");
  if (s.escort !== void 0) {
    const e = object7(s.escort, "scenario.escort", ["actor", "route", "radius", "escortRadius"]);
    refs.push(id5(e.actor, "scenario.escort.actor"));
    array2(e.route, "scenario.escort.route", 256, 1).forEach((p, i) => point4(p, `scenario.escort.route[${i}]`, width, height));
    number5(e.radius, "scenario.escort.radius", 0.1, 256);
    number5(e.escortRadius, "scenario.escort.escortRadius", 0.1, 256);
  }
  if (s.stealth !== void 0) {
    const t = object7(s.stealth, "scenario.stealth", ["infiltrators", "guards", "alarmLimit", "detectionSeconds", "radius", "coneDegrees", "patrols"]);
    for (const k of ["infiltrators", "guards"]) array2(t[k], `scenario.stealth.${k}`, 512, 1).forEach((v, i) => refs.push(id5(v, `scenario.stealth.${k}[${i}]`)));
    number5(t.alarmLimit, "scenario.stealth.alarmLimit", 1, 1e4, true);
    number5(t.detectionSeconds, "scenario.stealth.detectionSeconds", 0.05, 86400);
    number5(t.radius, "scenario.stealth.radius", 0.1, 256);
    number5(t.coneDegrees, "scenario.stealth.coneDegrees", 1, 360);
    array2(t.patrols, "scenario.stealth.patrols", 512).forEach((v, i) => {
      const p = `scenario.stealth.patrols[${i}]`, patrol = object7(v, p, ["actor", "route"]);
      refs.push(id5(patrol.actor, `${p}.actor`));
      array2(patrol.route, `${p}.route`, 256, 1).forEach((v2, j) => point4(v2, `${p}.route[${j}]`, width, height));
    });
  }
  if (s.boss !== void 0) {
    const b = object7(s.boss, "scenario.boss", ["actor", "name", "health", "phases"]);
    refs.push(id5(b.actor, "scenario.boss.actor"));
    text3(b.name, "scenario.boss.name", 120);
    number5(b.health, "scenario.boss.health", 0.1, 1e7);
    array2(b.phases, "scenario.boss.phases", 32, 1).forEach((v, i) => {
      const p = `scenario.boss.phases[${i}]`, phase = object7(v, p, ["below", "name", "radius", "damage", "warningSeconds", "cooldown", "interruptDamage", "adds"]);
      number5(phase.below, `${p}.below`, 0, 1);
      text3(phase.name, `${p}.name`, 120);
      number5(phase.radius, `${p}.radius`, 0.1, 256);
      number5(phase.damage, `${p}.damage`);
      number5(phase.warningSeconds, `${p}.warningSeconds`, 0.05, 86400);
      number5(phase.cooldown, `${p}.cooldown`, 0.05, 86400);
      number5(phase.interruptDamage, `${p}.interruptDamage`);
      actors(phase.adds, `${p}.adds`);
    });
  }
  if (s.requiredActions !== void 0) array2(s.requiredActions, "scenario.requiredActions", 32).forEach((v, i) => {
    const p = `scenario.requiredActions[${i}]`, a = object7(v, p, ["action", "count", "text"]);
    choice5(a.action, `${p}.action`, ["ability", "hold", "repair", "gather"]);
    number5(a.count, `${p}.count`, 1, 1e5, true);
    text3(a.text, `${p}.text`, 2e3);
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
function canonical2(value) {
  if (Array.isArray(value)) return `[${value.map(canonical2).join(",")}]`;
  if (value && typeof value === "object") {
    const r = value;
    return `{${Object.keys(r).sort().map((k) => `${JSON.stringify(k)}:${canonical2(r[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function hash3(value) {
  let a = 2166136261, b = 2654435769;
  for (const byte of new TextEncoder().encode(canonical2(value))) {
    a = Math.imul(a ^ byte, 16777619) >>> 0;
    b = Math.imul(b ^ byte, 2246822507) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
function canonicalScenarioHash(input) {
  return hash3(decodeScenarioDefinition(input));
}
function decodeScenarioPackage(input) {
  const p = object7(jsonInput(input), "package", packageFields);
  if (p.schemaVersion !== 1 || p.kind !== "scenario") bad5("package", "unsupported package schema or kind");
  if (p.simulationVersion !== SAVE_VERSION) bad5("package.simulationVersion", `expected current simulation version ${SAVE_VERSION}`);
  text3(p.author, "package.author", 120);
  number5(p.revision, "package.revision", 1, 2147483647, true);
  for (const field of ["hash", "mapHash", "contentHash"]) if (typeof p[field] !== "string" || !/^[0-9a-f]{16}$/.test(p[field])) bad5(`package.${field}`, "invalid checksum");
  const map = decodeMapPackage(p.map), scenario = decodeScenarioDefinition(p.scenario);
  const validation = validateEditorMap(map.map);
  if (!validation.valid) bad5("package.map", validation.issues.join("; "));
  if (map.map.starts.length !== 2) bad5("package.map", "scenarios require two starting positions");
  if (p.mapHash !== map.hash) bad5("package.mapHash", "map dependency checksum mismatch");
  if (p.contentHash !== canonicalScenarioHash(scenario)) bad5("package.contentHash", "scenario checksum mismatch");
  if (canonical2(scenario.map) !== canonical2(scenarioMapFromPackage(map)) || scenario.seed !== map.map.seed) bad5("package.scenario.map", "embedded scenario map differs from dependency");
  const { hash: expected, ...body2 } = p;
  if (expected !== hash3(body2)) bad5("package.hash", "package checksum mismatch");
  return { ...p, map, scenario };
}

// src/editor/package-validation.ts
var communityPackageValidators = {
  map(input) {
    const value = decodeMapPackage(input), validation = validateEditorMap(value.map);
    if (!validation.valid) throw new Error(`Map cannot be played: ${validation.issues.join("; ")}`);
    return value;
  },
  scenario: decodeScenarioPackage,
  mod: decodeContentPackage,
  modClosure: createContentBundle
};

// src/server/community-packages.ts
import { createHash as createHash5 } from "node:crypto";
var COMMUNITY_PACKAGE_MAX_BYTES = 16 * 1024 * 1024;
var CommunityPackageError = class extends Error {
  constructor(status, message5) {
    super(message5);
    this.status = status;
    this.name = "CommunityPackageError";
  }
  status;
};
var KINDS = ["map", "scenario", "mod"];
var HASH = /^[a-f0-9]{64}$/;
var SHA = (text5) => createHash5("sha256").update(text5, "utf8").digest("hex");
function error(status, message5) {
  throw new CommunityPackageError(status, message5);
}
function record5(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) error(400, `${label} must be an object.`);
  return value;
}
function text4(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) error(400, `Invalid ${label}.`);
  return value;
}
function integer3(value, label, min = 0, max = 2147483647) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) error(400, `Invalid ${label}.`);
  return value;
}
function array3(value, label, max) {
  if (!Array.isArray(value) || value.length > max) error(400, `Invalid ${label}.`);
  return value;
}
function kindOf(value) {
  if (value.kind === "map" || value.kind === "scenario") return value.kind;
  if (value.format === "orcs-vs-fairies-mod") return "mod";
  return error(400, "Expected a map, scenario or mod package.");
}
function canonical3(value) {
  if (Array.isArray(value)) return `[${value.map(canonical3).join(",")}]`;
  if (value && typeof value === "object") {
    const r = value;
    return `{${Object.keys(r).sort().map((key) => `${JSON.stringify(key)}:${canonical3(r[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function json2(input) {
  if (typeof input === "string") {
    if (Buffer.byteLength(input) > COMMUNITY_PACKAGE_MAX_BYTES) error(413, "Package exceeds the 16 MiB limit.");
    try {
      input = JSON.parse(input);
    } catch {
      error(400, "Invalid package JSON.");
    }
  }
  let nodes = 0, bytes = 0;
  const parents = /* @__PURE__ */ new Set();
  function copy(value, depth) {
    if (++nodes > 75e4 || depth > 64) error(413, "Package is too large or deeply nested.");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) error(400, "Package numbers must be finite.");
      return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value === "string") {
      bytes += Buffer.byteLength(value);
      if (bytes > COMMUNITY_PACKAGE_MAX_BYTES) error(413, "Package exceeds the 16 MiB limit.");
      return value;
    }
    if (!value || typeof value !== "object") error(400, "Package must contain JSON data.");
    if (parents.has(value)) error(400, "Package cycles are forbidden.");
    parents.add(value);
    let result2;
    if (Array.isArray(value)) {
      if (value.length > 65536 || Reflect.ownKeys(value).length !== value.length + 1) error(400, "Package arrays cannot have gaps or extra properties.");
      const out = [];
      for (let i = 0; i < value.length; i++) {
        const d = Object.getOwnPropertyDescriptor(value, String(i));
        if (!d || !("value" in d) || !d.enumerable) error(400, "Package array accessors and gaps are forbidden.");
        out.push(copy(d.value, depth + 1));
      }
      result2 = out;
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) error(400, "Package objects must be plain JSON objects.");
      const names = Reflect.ownKeys(value);
      if (names.length > 256 || names.some((key) => typeof key !== "string")) error(400, "Package has invalid object properties.");
      const out = /* @__PURE__ */ Object.create(null);
      for (const key of names) {
        const d = Object.getOwnPropertyDescriptor(value, key);
        if (!("value" in d) || !d.enumerable || ["__proto__", "constructor", "prototype"].includes(key)) error(400, "Package accessors and unsafe properties are forbidden.");
        out[key] = copy(d.value, depth + 1);
      }
      result2 = out;
    }
    parents.delete(value);
    return result2;
  }
  const result = copy(input, 0);
  if (Buffer.byteLength(canonical3(result)) > COMMUNITY_PACKAGE_MAX_BYTES) error(413, "Package exceeds the 16 MiB limit.");
  return result;
}
function packageIdentity(owner, kind, id6) {
  return SHA(canonical3([owner, kind, id6]));
}
function mapPreview(input) {
  const map = record5(input, "Map preview"), width = integer3(map.width, "map width", 8, 128), height = integer3(map.height, "map height", 8, 128), columns = Math.min(width, 32), rows = Math.min(height, 32);
  const terrainKinds = ["grass", "road", "mud", "shallows", "water", "rock", "bridge", "sand", "snow", "forest", "ice"];
  const levels = array3(map.levels, "map levels", 2).map((value) => {
    const level2 = record5(value, "Map level"), terrain2 = array3(level2.terrain, "map terrain", width * height), tiles = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const kind = terrain2[Math.floor((y + 0.5) * height / rows) * width + Math.floor((x + 0.5) * width / columns)];
      if (typeof kind !== "string" || !terrainKinds.includes(kind)) error(400, "Invalid terrain preview.");
      tiles.push(kind);
    }
    return { id: integer3(level2.id, "level ID", 0, 1), columns, rows, terrain: tiles };
  });
  const starts = array3(map.starts, "map starts", 8).map((value) => {
    const p = record5(value, "Start");
    if (typeof p.x !== "number" || !Number.isFinite(p.x) || typeof p.y !== "number" || !Number.isFinite(p.y)) error(400, "Invalid start geometry.");
    return { x: p.x, y: p.y, level: integer3(p.level, "start level", 0, 1), slot: integer3(p.slot, "start slot", 0, 7) };
  });
  const nodes = array3(map.resources, "map resources", 2048);
  return { type: "map", width, height, levels, starts, resources: ["wood", "ore", "crystal"].map((kind) => ({ kind, count: nodes.filter((node) => record5(node, "Resource").kind === kind).length })), sites: array3(map.sites, "map sites", 128).length };
}
function preview(kind, value) {
  if (kind === "map") return mapPreview(value.map);
  if (kind === "scenario") {
    const scenario = record5(value.scenario, "Scenario");
    return { type: "scenario", map: mapPreview(record5(value.map, "Map package").map), actors: array3(scenario.army, "scenario actors", 512).length, objectives: array3(scenario.objectives, "scenario objectives", 64).length, events: array3(scenario.events, "scenario events", 256).length };
  }
  return { type: "mod", factions: array3(value.factions, "mod factions", 16).map((input) => {
    const f = record5(input, "Faction");
    return { id: text4(f.id, "faction ID", 100), name: text4(f.name, "faction name"), color: integer3(f.color, "faction color", 0, 16777215), units: array3(f.units, "faction units", 128).length, buildings: array3(f.buildings, "faction buildings", 128).length };
  }) };
}
var CommunityPackages = class {
  constructor(db, validators) {
    this.db = db;
    this.validators = validators;
    db.exec(`PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS community_packages(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('map','scenario','mod')),local_id TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(owner_id,kind,local_id));
   CREATE TABLE IF NOT EXISTS community_blobs(hash TEXT PRIMARY KEY CHECK(length(hash)=64),kind TEXT NOT NULL CHECK(kind IN ('map','scenario','mod')),body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS community_revisions(package_id TEXT NOT NULL REFERENCES community_packages(id),version TEXT NOT NULL,version_sort TEXT NOT NULL,hash TEXT NOT NULL REFERENCES community_blobs(hash),package_hash TEXT NOT NULL,content_hash TEXT,simulation_version INTEGER NOT NULL,title TEXT NOT NULL,published_at INTEGER NOT NULL,dependencies TEXT NOT NULL,preview TEXT NOT NULL,PRIMARY KEY(package_id,version));
   CREATE INDEX IF NOT EXISTS community_local_ids ON community_packages(kind,local_id);
   CREATE INDEX IF NOT EXISTS community_inner_hashes ON community_revisions(package_hash,version);
   CREATE INDEX IF NOT EXISTS community_versions ON community_revisions(package_id,version_sort DESC);
   CREATE TRIGGER IF NOT EXISTS community_packages_no_update BEFORE UPDATE ON community_packages BEGIN SELECT RAISE(ABORT,'Published package identities are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_revisions_no_update BEFORE UPDATE ON community_revisions BEGIN SELECT RAISE(ABORT,'Published revisions are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_revisions_no_delete BEFORE DELETE ON community_revisions BEGIN SELECT RAISE(ABORT,'Published revisions are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_blobs_no_update BEFORE UPDATE ON community_blobs BEGIN SELECT RAISE(ABORT,'Published blobs are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_blobs_no_delete BEFORE DELETE ON community_blobs BEGIN SELECT RAISE(ABORT,'Published blobs are immutable');END;`);
  }
  db;
  validators;
  decode(kind, input) {
    try {
      const value = record5(json2(this.validators[kind](json2(input))), "Validated package");
      if (kindOf(value) !== kind) error(400, "Decoder returned a different package kind.");
      return value;
    } catch (cause) {
      if (cause instanceof CommunityPackageError) throw cause;
      error(400, cause instanceof Error ? cause.message : "Package validation failed.");
    }
  }
  blob(hash4) {
    const row = this.db.prepare("SELECT kind,body FROM community_blobs WHERE hash=?").get(hash4);
    if (!row) error(404, "Package download was not found.");
    const body2 = row.body;
    if (SHA(body2) !== hash4) error(500, "Stored package integrity check failed.");
    return { kind: row.kind, body: body2 };
  }
  resolveMod(value) {
    const closure = [], dependencies = [], seen = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set();
    const visit = (pkg, top = false) => {
      const id6 = text4(pkg.id, "mod ID", 64), version = text4(pkg.version, "mod version", 30), inner = text4(pkg.hash, "mod checksum", 64), identity = `${id6}@${version}:${inner}`;
      if (visiting.has(identity)) error(400, "Mod dependencies contain a cycle.");
      if (seen.has(identity)) return;
      if (closure.length + visiting.size >= 32) error(400, "Mod dependency closure exceeds 32 packages.");
      visiting.add(identity);
      for (const raw of array3(pkg.dependencies, "mod dependencies", 16)) {
        const d = record5(raw, "Mod dependency"), localId = text4(d.id, "dependency ID", 64), dependencyVersion = text4(d.version, "dependency version", 30), packageHash = text4(d.hash, "dependency checksum", 64);
        if (!HASH.test(packageHash)) error(400, "Invalid mod dependency checksum.");
        const row = this.db.prepare("SELECT r.hash FROM community_revisions r JOIN community_packages p ON p.id=r.package_id WHERE p.kind='mod' AND p.local_id=? AND r.version=? AND r.package_hash=? ORDER BY r.hash LIMIT 1").get(localId, dependencyVersion, packageHash);
        if (!row) error(409, `Publish the exact dependency ${localId}@${dependencyVersion} (${packageHash}) first.`);
        const hash4 = row.hash, stored = this.blob(hash4);
        if (stored.kind !== "mod") error(500, "Stored dependency has an invalid kind.");
        const decoded = this.decode("mod", JSON.parse(stored.body));
        if (decoded.id !== localId || decoded.version !== dependencyVersion || decoded.hash !== packageHash) error(500, "Stored dependency identity differs from its publication.");
        if (top) dependencies.push({ kind: "mod", localId, version: dependencyVersion, hash: hash4, packageHash });
        visit(decoded);
      }
      visiting.delete(identity);
      seen.add(identity);
      closure.push(pkg);
    };
    visit(value, true);
    if (!this.validators.modClosure) error(503, "Mod bundle validation is unavailable.");
    try {
      this.validators.modClosure(closure);
    } catch (cause) {
      error(400, cause instanceof Error ? cause.message : "Mod dependency validation failed.");
    }
    return { dependencies, closure };
  }
  admit(input) {
    const raw = record5(json2(input), "Package"), kind = kindOf(raw), value = this.decode(kind, raw), source2 = kind === "scenario" ? record5(value.scenario, "Scenario") : value;
    const localId = text4(source2.id, "package ID", 64);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(localId)) error(400, "Invalid local package ID.");
    const title = text4(kind === "mod" ? source2.name : source2.title, "package title"), packageHash = text4(value.hash, "package checksum", 64);
    if (!(kind === "mod" ? HASH : /^[a-f0-9]{16}$/).test(packageHash)) error(400, "Invalid package checksum.");
    let version, versionSort;
    if (kind === "mod") {
      version = text4(value.version, "mod version", 30);
      if (!/^\d+\.\d+\.\d+$/.test(version)) error(400, "Mod version must be an exact semantic version.");
      versionSort = version.split(".").map((part) => integer3(Number(part), "semantic version component").toString().padStart(10, "0")).join(".");
    } else {
      version = String(integer3(value.revision, "package revision", 1));
      versionSort = version.padStart(10, "0");
    }
    const body2 = canonical3(value), hash4 = SHA(body2), dependencies = [], embedded = [];
    if (kind === "scenario") {
      const map = this.decode("map", value.map), mapBody = canonical3(map), mapHash = SHA(mapBody);
      if (value.mapHash !== map.hash) error(400, "Scenario map dependency checksum differs.");
      dependencies.push({ kind: "map", localId: text4(map.id, "map ID", 64), version: String(integer3(map.revision, "map revision", 1)), hash: mapHash, packageHash: text4(map.hash, "map checksum", 16) });
      embedded.push({ hash: mapHash, kind: "map", body: mapBody });
    }
    if (kind === "mod") dependencies.push(...this.resolveMod(value).dependencies);
    return { kind, localId, title, version, versionSort, packageHash, contentHash: typeof value.contentHash === "string" ? value.contentHash : kind === "mod" ? packageHash : null, simulationVersion: integer3(kind === "mod" ? value.engineVersion : value.simulationVersion, "simulation version", 1), body: body2, hash: hash4, value, preview: preview(kind, value), dependencies, embedded };
  }
  publish(account, input) {
    if (!account || typeof account.id !== "string" || typeof account.username !== "string") error(401, "Sign in before publishing a package.");
    const user = this.db.prepare("SELECT id,username FROM users WHERE id=?").get(account.id);
    if (!user || user.username !== account.username) error(401, "Sign in before publishing a package.");
    const value = this.admit(input), id6 = packageIdentity(account.id, value.kind, value.localId), now = Date.now();
    let created = true;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const prior = this.db.prepare("SELECT hash FROM community_revisions WHERE package_id=? AND version=?").get(id6, value.version);
      if (prior) {
        if (prior.hash !== value.hash) error(409, "This published version is immutable. Increase the revision or version.");
        created = false;
      } else {
        this.db.prepare("INSERT INTO community_packages(id,owner_id,kind,local_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run(id6, account.id, value.kind, value.localId, now);
        const put = this.db.prepare("INSERT INTO community_blobs(hash,kind,body) VALUES(?,?,?) ON CONFLICT(hash) DO NOTHING");
        for (const blob of [...value.embedded, { hash: value.hash, kind: value.kind, body: value.body }]) {
          put.run(blob.hash, blob.kind, blob.body);
          const stored = this.blob(blob.hash);
          if (stored.kind !== blob.kind || stored.body !== blob.body) error(500, "Stored package identity is inconsistent.");
        }
        this.db.prepare("INSERT INTO community_revisions(package_id,version,version_sort,hash,package_hash,content_hash,simulation_version,title,published_at,dependencies,preview) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id6, value.version, value.versionSort, value.hash, value.packageHash, value.contentHash, value.simulationVersion, value.title, now, JSON.stringify(value.dependencies), JSON.stringify(value.preview));
      }
      this.db.exec("COMMIT");
    } catch (cause) {
      this.db.exec("ROLLBACK");
      throw cause;
    }
    return { created, detail: this.detail(id6) };
  }
  summary(row) {
    return { id: row.id, kind: row.kind, localId: row.local_id, title: row.title, publisher: { id: row.owner_id, username: row.username }, version: row.version, hash: row.hash, packageHash: row.package_hash, createdAt: row.created_at, publishedAt: row.published_at, preview: JSON.parse(row.preview) };
  }
  search(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some((key) => !["query", "kind", "page", "pageSize"].includes(key))) error(400, "Invalid community search options.");
    const page = integer3(options.page ?? 1, "page", 1, 1e4), pageSize = integer3(options.pageSize ?? 20, "page size", 1, 50);
    const query = options.query === void 0 || options.query === "" ? "" : text4(options.query, "search query", 120).trim();
    if (options.kind !== void 0 && !KINDS.includes(options.kind)) error(400, "Unknown package kind.");
    const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`), pattern = `%${escaped}%`, condition2 = "(?='' OR p.kind=?) AND (?='' OR r.title LIKE ? ESCAPE '\\' OR p.local_id LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\')";
    const base = "FROM community_packages p JOIN users u ON u.id=p.owner_id JOIN community_revisions r ON r.package_id=p.id AND r.version=(SELECT latest.version FROM community_revisions latest WHERE latest.package_id=p.id ORDER BY latest.version_sort DESC LIMIT 1)", params = [options.kind ?? "", options.kind ?? "", query, pattern, pattern, pattern];
    const total = this.db.prepare(`SELECT count(*) AS total ${base} WHERE ${condition2}`).get(...params).total;
    const rows = this.db.prepare(`SELECT p.*,u.username,r.* ${base} WHERE ${condition2} ORDER BY r.published_at DESC,p.id LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
    return { items: rows.map((row) => this.summary(row)), total, page, pageSize };
  }
  detail(id6) {
    if (typeof id6 !== "string" || !HASH.test(id6)) error(400, "Invalid community package ID.");
    const row = this.db.prepare("SELECT p.*,u.username,r.* FROM community_packages p JOIN users u ON u.id=p.owner_id JOIN community_revisions r ON r.package_id=p.id WHERE p.id=? ORDER BY r.version_sort DESC LIMIT 1").get(id6);
    if (!row) error(404, "Community package was not found.");
    const revisions = this.db.prepare("SELECT * FROM community_revisions WHERE package_id=? ORDER BY version_sort DESC").all(id6).map((r) => ({ version: r.version, hash: r.hash, packageHash: r.package_hash, contentHash: r.content_hash, simulationVersion: r.simulation_version, dependencies: JSON.parse(r.dependencies), preview: JSON.parse(r.preview), title: r.title, publishedAt: r.published_at }));
    return { ...this.summary(row), revisions };
  }
  download(hash4) {
    if (typeof hash4 !== "string" || !HASH.test(hash4)) error(400, "Invalid package download checksum.");
    const stored = this.blob(hash4), input = JSON.parse(stored.body), value = this.decode(stored.kind, input);
    if (canonical3(value) !== stored.body) error(409, "Stored package requires its original compatible decoder.");
    if (stored.kind === "mod") this.resolveMod(value);
    return JSON.parse(stored.body);
  }
};

// src/server/community-http.ts
function createCommunityHttp(db) {
  const packages = new CommunityPackages(db, communityPackageValidators);
  return async ({ req, res, url, user, body: body2, respond }) => {
    const path3 = url.pathname;
    if (path3 === "/api/packages") {
      if (req.method === "POST") {
        const value = await body2(req, COMMUNITY_PACKAGE_MAX_BYTES);
        if (Object.keys(value).length !== 1 || !Object.hasOwn(value, "package")) throw new CommunityPackageError(400, "Expected only a package field.");
        const published = packages.publish(user, value.package);
        respond(res, published.created ? 201 : 200, published);
        return true;
      }
      if (req.method !== "GET") throw new CommunityPackageError(405, "Use GET or POST.");
      if ([...url.searchParams.keys()].some((key) => !["q", "kind", "page", "pageSize"].includes(key))) throw new CommunityPackageError(400, "Unknown package search field.");
      for (const key of ["q", "kind", "page", "pageSize"]) if (url.searchParams.getAll(key).length > 1) throw new CommunityPackageError(400, "Duplicate package search field.");
      const page = url.searchParams.get("page"), pageSize = url.searchParams.get("pageSize"), kind = url.searchParams.get("kind");
      const result = packages.search({ query: url.searchParams.get("q") ?? void 0, kind: kind === null || kind === "" ? void 0 : kind, page: page === null ? void 0 : Number(page), pageSize: pageSize === null ? void 0 : Number(pageSize) });
      respond(res, 200, result);
      return true;
    }
    const download = /^\/api\/packages\/content\/([^/]+)$/.exec(path3);
    const detail = /^\/api\/packages\/([^/]+)$/.exec(path3);
    if (!download && !detail) return false;
    if (req.method !== "GET") throw new CommunityPackageError(405, "Use GET.");
    if (url.search) throw new CommunityPackageError(400, "Package detail and download do not accept query fields.");
    if (download) respond(res, 200, { package: packages.download(download[1]) });
    else respond(res, 200, { detail: packages.detail(detail[1]) });
    return true;
  };
}

// src/online/competitions.ts
var RANKED_RULES = "Ranked is one human versus one human, with no handicaps and age 1 starts. Ratings use Elo, K=32 and a 400-point scale. Every UTC calendar month resets ratings to 1000. A match counts in the season when it starts. Surrender counts as a loss; draws count as half a win.";
function rankedEligibility(settings) {
  const players = settings.players ?? settings.factions.map((factionId, index2) => ({ factionId, teamId: index2, controller: "human" }));
  if (players.length !== 2 || players.some((player) => player.controller !== "human")) return "Ranked requires two human players.";
  if (players[0].teamId === players[1].teamId) return "Ranked players must be on opposing teams.";
  if (players.some((player) => "handicap" in player && player.handicap !== void 0)) return "Ranked does not allow handicaps.";
  if ((settings.startingAge ?? 1) !== 1) return "Ranked starts in age 1.";
  return void 0;
}

// src/server/campaign-verification.ts
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
var CampaignVerificationError = class extends Error {
  constructor(status, message5) {
    super(message5);
    this.status = status;
  }
  status;
};
function createCampaignVerificationWorker(modulePath, timeoutMs = 45e3) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 6e4) throw new Error("Campaign verification timeout must be 1\u201360000ms.");
  const moduleUrl = modulePath.startsWith("file:") ? new URL(modulePath).href : pathToFileURL(resolve(modulePath)).href;
  let busy = false;
  return (recording, missionId) => {
    if (busy) throw new CampaignVerificationError(503, "Campaign verification is busy. Retry this same completed campaign shortly.");
    busy = true;
    return new Promise((resolveVictory, reject) => {
      let done = false;
      let worker;
      try {
        worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
        const fail=(status,error)=>{parentPort.postMessage({ok:false,status,error:error instanceof Error?error.message:'Invalid campaign recording.'});parentPort.close();};
        import(workerData.moduleUrl).then(module=>{
          if(typeof module.verifyCanonicalCampaignVictory!=='function'){fail(503,new Error('Canonical campaign module has no verifier.'));return;}
          Promise.resolve().then(()=>module.verifyCanonicalCampaignVictory(workerData.recording,workerData.missionId))
            .then(value=>{parentPort.postMessage({ok:true,value});parentPort.close();},error=>fail(400,error));
        },error=>fail(503,error));`, { eval: true, workerData: { moduleUrl, recording, missionId }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
      } catch (error2) {
        busy = false;
        reject(new CampaignVerificationError(503, error2 instanceof Error ? error2.message : "Campaign verifier could not start."));
        return;
      }
      const finish3 = (error2, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        void worker.terminate().then(() => {
          busy = false;
          if (error2) reject(error2);
          else resolveVictory(value);
        }, (terminationError) => {
          busy = false;
          reject(terminationError);
        });
      };
      const timer = setTimeout(() => finish3(new CampaignVerificationError(504, "Campaign verification timed out. No reward was applied.")), timeoutMs);
      worker.once("message", (message5) => finish3(message5.ok ? void 0 : new CampaignVerificationError(message5.status === 503 ? 503 : 400, String(message5.error)), message5.value));
      worker.once("error", (error2) => finish3(new CampaignVerificationError(503, `Campaign verifier failed: ${error2.message}`)));
      worker.once("exit", (code) => {
        if (!done) finish3(new CampaignVerificationError(503, `Campaign verifier stopped (${code}). No reward was applied.`));
      });
    });
  };
}

// src/server/server.ts
var scrypt = promisify(scryptCallback);
var SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1e3;
var MAX_BODY_BYTES = 64 * 1024;
var MAP_SIZES2 = ["small", "medium", "large", "huge"];
function jsonHash(value) {
  const hash4 = createHash6("sha256"), tasks = [{ value }];
  while (tasks.length) {
    const task = tasks.pop();
    if (task.text !== void 0) {
      hash4.update(task.text);
      continue;
    }
    const item = task.value;
    if (Array.isArray(item)) {
      hash4.update(`a:${item.length}:`);
      for (let i = item.length - 1; i >= 0; i--) tasks.push({ value: item[i] });
    } else if (item && typeof item === "object") {
      const names = Object.keys(item).sort();
      hash4.update(`o:${names.length}:`);
      for (let i = names.length - 1; i >= 0; i--) {
        tasks.push({ value: item[names[i]] });
        tasks.push({ text: `k:${JSON.stringify(names[i])}:` });
      }
    } else hash4.update(`${typeof item}:${JSON.stringify(item) ?? "undefined"}:`);
  }
  return hash4.digest("hex");
}
function record6(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function keys3(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function integer4(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
function compatibilityFingerprint() {
  const hash4 = createHash6("sha256"), ownFile = fileURLToPath(import.meta.url), coreDirectory = resolve2(ownFile, "../../core");
  if (existsSync(coreDirectory)) {
    for (const directory of [coreDirectory, resolve2(ownFile, "..")]) for (const filename of readdirSync(directory).filter((filename2) => filename2.endsWith(".ts")).sort()) hash4.update(`${directory.endsWith("core") ? "core" : "server"}/${filename}`).update(readFileSync(resolve2(directory, filename)));
    hash4.update(readFileSync(resolve2(ownFile, "../../online/protocol.ts")));
  } else hash4.update(readFileSync(ownFile));
  return hash4.digest("hex");
}
var HttpError = class extends Error {
  constructor(status, message5) {
    super(message5);
    this.status = status;
  }
  status;
};
function isSurrender(value) {
  return record6(value) && keys3(value, ["type"]) && value.type === "surrender";
}
function applyInput(state, side2, command) {
  if (isSurrender(command)) {
    if (isGameOver(state) || !state.players[side2] || state.eliminated[side2]) return false;
    const units = state.entities.filter((entity) => entity.side === side2 && entity.hp > 0 && entity.kind === "unit" && !entity.illusion);
    if (units.length) issueCommand(state, side2, { type: "stop", ids: units.map((entity) => entity.id) });
    for (const entity of state.entities) if (entity.side === side2 && entity.hp > 0) {
      entity.hp = 0;
      entity.animation = "death";
      entity.animTime = 0;
      entity.order = { type: "idle" };
      delete entity.orderQueue;
      entity.path = [];
    }
    return true;
  }
  return validateCommand(command) && issueCommand(state, side2, command);
}
async function createRtsServer(options) {
  const host = options.host ?? "127.0.0.1", port = options.port ?? 8787;
  const delaySeconds = options.spectatorDelaySeconds ?? 30;
  if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 120) throw new Error("Spectator delay must be from 0 to 120 seconds.");
  const delayTicks = Math.ceil(delaySeconds * TICK_RATE);
  const externalOrigin = options.origin?.trim() || void 0;
  if (externalOrigin) {
    const parsed = new URL(externalOrigin);
    if (parsed.origin !== externalOrigin || !["http:", "https:"].includes(parsed.protocol)) throw new Error("RTS_ORIGIN must be an exact HTTP(S) origin without a trailing slash.");
  }
  const store = new ServerStore(options.dataDir, compatibilityFingerprint());
  const communityHttp = createCommunityHttp(store.db);
  const competitionNow = options.competitionNow ?? Date.now;
  const interval = options.tickIntervalMs ?? 1e3 / TICK_RATE;
  if (!Number.isFinite(interval) || interval < 1 || interval > 1e3) {
    store.close();
    throw new Error("Tick interval must be 1\u20131000ms.");
  }
  const lobbies = new Map(store.lobbies().map((lobby) => {
    const normalized = settings(lobby.settings), draft = lobby.draft ? validateDraftState(lobby.draft, normalized.players.map((p, id6) => ({ ...p, id: id6 })), normalizeMatchRules(normalized.rules)) : createDraft(normalized.players.map((p, id6) => ({ ...p, id: id6 })), normalizeMatchRules(normalized.rules));
    return [lobby.id, { ...lobby, draft, settings: normalized, seats: roster(normalized, lobby.seats, void 0, false) }];
  }));
  const matches = /* @__PURE__ */ new Map();
  const tickets = /* @__PURE__ */ new Map();
  const attempts = /* @__PURE__ */ new Map();
  let closing = false, campaignClaimBusy = false;
  try {
    for (const saved of store.matches()) {
      if (saved.engineHash !== store.engineHash) throw new Error(`Stored match ${saved.id} needs its original compatible server build. Keep its data and deploy that build.`);
      const state = store.restore(saved), sides = playerSides(state), views = sides.map((side2) => new OnlineView(side2, saved.memory[side2]));
      const receipts = /* @__PURE__ */ new Map(), lastSeq = sides.map(() => 0);
      const records = store.commands(saved.id);
      for (const entry of records) {
        receipts.set(`${entry.side}:${entry.clientSeq}`, entry);
        lastSeq[entry.side] = Math.max(lastSeq[entry.side], entry.clientSeq);
      }
      const pendingReplay = records.filter((entry) => entry.appliedTick > saved.checkpointTick);
      let cursor = 0;
      const eventBuffers = sides.map(() => []);
      while (state.tick < saved.tick) {
        const targetTick = state.tick + 1;
        while (cursor < pendingReplay.length && pendingReplay[cursor].appliedTick === targetTick) {
          const entry = pendingReplay[cursor++];
          if (entry.ack.accepted && !applyInput(state, entry.side, entry.command)) throw new Error(`Stored match ${saved.id} diverged at tick ${targetTick}.`);
        }
        stepGame(state, 1 / TICK_RATE);
        views.forEach((view, side2) => eventBuffers[side2].push(...view.observe(state).events));
        if (state.tick % 4 === 0) eventBuffers.forEach((events) => {
          events.length = 0;
        });
        if (isGameOver(state) && state.tick < saved.tick) throw new Error(`Stored match ${saved.id} ended before its journal.`);
      }
      store.verifyRecovery(saved, state, views.map((view) => view.snapshot()));
      matches.set(saved.id, { id: saved.id, lobbyId: saved.lobbyId, state, views, frames: store.frames(saved.id, Math.max(0, state.tick - delayTicks - 80)), generations: saved.generation, pending: [], receipts, lastSeq, peers: /* @__PURE__ */ new Set(), eventBuffers, failed: false, finishedAt: saved.finished ? Date.now() : void 0 });
    }
  } catch (error2) {
    store.close();
    throw error2;
  }
  function publicLobby(lobby) {
    return { id: lobby.id, hostId: lobby.hostId, revision: lobby.revision, settings: lobby.settings, seats: lobby.seats, matchId: lobby.matchId, ...lobby.ranked ? { ranked: true } : {}, ...lobby.dailyDate ? { dailyDate: lobby.dailyDate } : {}, draft: lobby.draft ? { ...structuredClone(lobby.draft), remainingTicks: lobby.draftDeadlineAt ? Math.max(1, Math.ceil((lobby.draftDeadlineAt - Date.now()) / (1e3 / TICK_RATE))) : lobby.draft.remainingTicks } : void 0 };
  }
  function send(socket, message5) {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 4 * 1024 * 1024) {
        socket.close(4008, "Slow consumer");
        return;
      }
      socket.send(JSON.stringify(message5));
    }
  }
  function fail2(socket, code, message5) {
    send(socket, { kind: "error", code, message: message5 });
  }
  function session(req) {
    const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("ovf_session="))?.slice("ovf_session=".length);
    if (!cookie || !/^[a-f0-9]{64}$/.test(cookie)) return void 0;
    return store.session(createHash6("sha256").update(cookie).digest("hex"), Date.now());
  }
  function account(req) {
    const result = session(req);
    if (!result) throw new HttpError(401, "Sign in first.");
    return result;
  }
  function allowedOrigin(req) {
    if (!req.headers.origin) return true;
    const expected = externalOrigin ?? `http://${req.headers.host}`;
    return req.headers.origin === expected;
  }
  function respond(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(data));
  }
  async function body2(req, maximumBytes = MAX_BODY_BYTES) {
    if (req.headers["content-type"]?.split(";")[0] !== "application/json") throw new HttpError(415, "Use application/json.");
    let bytes = 0;
    const chunks = [];
    for await (const part of req) {
      const chunk = Buffer.from(part);
      bytes += chunk.length;
      if (bytes > maximumBytes) throw new HttpError(413, "Request too large.");
      chunks.push(chunk);
    }
    let value;
    try {
      value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new HttpError(400, "Invalid JSON.");
    }
    if (!record6(value)) throw new HttpError(400, "Expected an object.");
    return value;
  }
  function setSession(res, user) {
    const token = randomBytes(32).toString("hex");
    store.addSession(createHash6("sha256").update(token).digest("hex"), user.id, Date.now() + SESSION_LIFETIME);
    res.setHeader("Set-Cookie", `ovf_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_LIFETIME / 1e3}${options.secureCookie ? "; Secure" : ""}`);
  }
  function credentials(value) {
    if (!keys3(value, ["username", "password"]) || typeof value.username !== "string" || !/^[-_a-zA-Z0-9]{3,32}$/.test(value.username) || typeof value.password !== "string" || value.password.length < 8 || value.password.length > 128) throw new HttpError(400, "Username must be 3\u201332 letters, digits, underscores or hyphens; password must be 8\u2013128 characters.");
    return { username: value.username, password: value.password };
  }
  function authLimit(req) {
    const address2 = req.socket.remoteAddress ?? "unknown";
    const forwarded = typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",").at(-1)?.trim() : void 0;
    const key = options.trustProxy && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address2) && forwarded && isIP(forwarded) ? forwarded : address2;
    const now = Date.now();
    let entry = attempts.get(key);
    if (!entry || now - entry.at > 6e4) {
      entry = { count: 0, at: now };
      attempts.set(key, entry);
    }
    if (++entry.count > 30) throw new HttpError(429, "Too many sign-in attempts. Try again in a minute.");
  }
  function settings(value) {
    if (!record6(value) || !keys3(value, ["mapSize", "factions", "players", "sharedVision", "startingAge", "rules"]) || !MAP_SIZES2.includes(value.mapSize)) throw new HttpError(400, "Expected a supported map size and player roster.");
    const knownFaction = (id6) => typeof id6 === "string" && Object.hasOwn(FACTIONS, id6);
    let players;
    if (value.players !== void 0) {
      if (!Array.isArray(value.players) || value.players.length < 2 || value.players.length > 8) throw new HttpError(400, "A lobby needs 2\u20138 player slots.");
      players = value.players.map((player) => {
        if (!record6(player) || !keys3(player, ["factionId", "teamId", "controller", "handicap"]) || !knownFaction(player.factionId) || !integer4(player.teamId, 0, 7) || !["human", "ai"].includes(player.controller)) throw new HttpError(400, "Each slot needs a known faction, team 0\u20137 and human/AI controller.");
        let handicap;
        if (player.handicap !== void 0) {
          const h = player.handicap;
          if (!record6(h) || !keys3(h, ["startingResources", "incomeFactor", "populationCap"])) throw new HttpError(400, "Invalid handicap.");
          handicap = {};
          if (h.startingResources !== void 0) {
            const r = h.startingResources;
            if (!record6(r) || !keys3(r, ["wood", "ore", "crystal"]) || !["wood", "ore", "crystal"].every((key) => typeof r[key] === "number" && Number.isFinite(r[key]) && r[key] >= 0 && r[key] <= 1e9)) throw new HttpError(400, "Starting resources must specify finite wood, ore and crystal amounts.");
            handicap.startingResources = { wood: r.wood, ore: r.ore, crystal: r.crystal };
          }
          if (h.incomeFactor !== void 0) {
            if (typeof h.incomeFactor !== "number" || !Number.isFinite(h.incomeFactor) || h.incomeFactor < 0 || h.incomeFactor > 10) throw new HttpError(400, "Income factor must be 0\u201310.");
            handicap.incomeFactor = h.incomeFactor;
          }
          if (h.populationCap !== void 0) {
            if (!integer4(h.populationCap, 1, 500)) throw new HttpError(400, "Population cap must be 1\u2013500.");
            handicap.populationCap = h.populationCap;
          }
        }
        return { factionId: player.factionId, teamId: player.teamId, controller: player.controller, ...handicap ? { handicap } : {} };
      });
      if (value.factions !== void 0 && (!Array.isArray(value.factions) || value.factions.length !== players.length || value.factions.some((id6, index2) => id6 !== players[index2].factionId))) throw new HttpError(400, "Faction list must match the player roster.");
    } else {
      if (!Array.isArray(value.factions) || value.factions.length < 2 || value.factions.length > 8 || !value.factions.every(knownFaction)) throw new HttpError(400, "Expected 2\u20138 known factions.");
      players = value.factions.map((factionId, index2) => ({ factionId, teamId: index2, controller: "human" }));
    }
    if (!players.some((player) => player.controller === "human") || new Set(players.map((player) => player.teamId)).size < 2) throw new HttpError(400, "A match needs a human slot and at least two teams.");
    if (value.sharedVision !== void 0 && typeof value.sharedVision !== "boolean") throw new HttpError(400, "Shared vision must be boolean.");
    if (value.startingAge !== void 0 && !integer4(value.startingAge, 1, 3)) throw new HttpError(400, "Starting age must be 1\u20133.");
    if (value.rules !== void 0 && !record6(value.rules)) throw new HttpError(400, "Match rules must be an object.");
    let rules;
    try {
      rules = normalizeMatchRules({ ...value.rules ?? {}, ...value.startingAge === void 0 ? {} : { startingAge: value.startingAge }, ...value.sharedVision === void 0 ? {} : { sharedVision: value.sharedVision } });
      if (rules.mode === "scenario") throw new Error("Launch authored scenarios from the scenario menu.");
      if (rules.mode === "survival" && (!players.some((p) => p.teamId === rules.survival.defenderTeam) || new Set(players.map((p) => p.teamId)).size !== 2)) throw new Error("Survival requires a defender team and one opposing wave team.");
      createDraft(players.map((p, id6) => ({ ...p, id: id6 })), rules);
      createMatch({ map: { seed: 0, size: value.mapSize }, players: players.map((p, id6) => ({ ...p, id: id6 })), rules });
    } catch (error2) {
      throw new HttpError(400, error2 instanceof Error ? error2.message : "Invalid match rules.");
    }
    return { rules, mapSize: value.mapSize, factions: players.map((player) => player.factionId), players, sharedVision: rules.sharedVision, startingAge: rules.startingAge };
  }
  function roster(config, previous = [], creator, resetReadiness = true) {
    const members = previous.flatMap((seat) => seat.account ? [seat.account] : []);
    if (creator && !members.some((member) => member.id === creator.id)) members.push(creator);
    if (config.players.filter((player) => player.controller === "human").length < members.length) throw new HttpError(409, "The new roster has too few human slots for present participants.");
    const assigned = /* @__PURE__ */ new Set();
    const seats = config.players.map((player, index2) => {
      const former = previous[index2]?.account;
      const account2 = player.controller === "human" && former && !assigned.has(former.id) ? former : null;
      if (account2) assigned.add(account2.id);
      return { side: index2, account: account2, ready: false, ...player };
    });
    for (const member of members) if (!assigned.has(member.id)) {
      const empty = seats.find((seat) => seat.controller === "human" && !seat.account);
      empty.account = member;
      assigned.add(member.id);
    }
    if (!resetReadiness) for (const seat of seats) seat.ready = seat.controller === "human" && !!seat.account && !!previous.find((former) => former.account?.id === seat.account.id)?.ready;
    return seats;
  }
  function matchConfig(lobby) {
    return { schemaVersion: 1, map: { seed: lobby.seed, size: lobby.settings.mapSize }, players: lobby.settings.players.map((player, index2) => ({ id: index2, teamId: player.teamId, factionId: player.factionId, controller: player.controller === "human" ? "external" : "ai", handicap: player.handicap })), rules: lobby.settings.rules, draft: lobby.draft };
  }
  function getLobby(id6) {
    const result = lobbies.get(id6);
    if (!result) throw new HttpError(404, "Lobby not found.");
    return result;
  }
  function editLobby(lobby, value) {
    if (value.expectedRevision !== lobby.revision) throw new HttpError(409, "Lobby changed. Refresh its current revision.");
    if (lobby.matchId) throw new HttpError(409, "The match has started.");
  }
  function resetDraft(lobby) {
    lobby.draft = createDraft(lobby.settings.players.map((p, id6) => ({ ...p, id: id6 })), normalizeMatchRules(lobby.settings.rules));
    delete lobby.draftDeadlineAt;
    if (!lobby.seats.some((seat) => seat.controller === "human" && !seat.account) && lobby.draft.status === "drafting") lobby.draftDeadlineAt = Date.now() + lobby.draft.remainingTicks * 1e3 / TICK_RATE;
  }
  function changed(lobby) {
    lobby.revision++;
    store.saveLobby(lobby);
    lobbies.set(lobby.id, lobby);
  }
  function matchSummary(match) {
    return { id: match.id, lobbyId: match.lobbyId, tick: match.state.tick, finished: isGameOver(match.state), failed: match.failed };
  }
  const tournaments = options.tournaments ? createTournamentService({ cwd: options.tournaments.cwd, configs: options.tournaments.configs, outputRoot: options.tournaments.outputRoot ?? resolve2(options.dataDir, "tournaments"), authorize: (req) => !!session(req), principal: (req) => session(req)?.id }) : void 0;
  function launchMatch(lobby, configuration, competition) {
    const state = createMatch(configuration), sides = playerSides(state), id6 = randomUUID4(), views = sides.map((side2) => new OnlineView(side2));
    const frame = { tick: 0, views: views.map((view) => view.observe(state)) }, generations = sides.map(() => 0);
    const started = { ...lobby, matchId: id6, revision: lobby.revision + 1 };
    store.startMatch(started, state, views.map((view) => view.snapshot()), generations, frame, configuration, competition);
    matches.set(id6, { id: id6, lobbyId: lobby.id, state, views, frames: [frame], generations, pending: [], receipts: /* @__PURE__ */ new Map(), lastSeq: sides.map(() => 0), peers: /* @__PURE__ */ new Set(), eventBuffers: sides.map(() => []), failed: false });
    lobbies.set(lobby.id, started);
    return started;
  }
  async function route2(req, res) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`), path3 = url.pathname;
    if (req.method !== "GET" && !allowedOrigin(req)) throw new HttpError(403, "Origin is not allowed.");
    if (req.method === "GET" && path3 === "/api/health") {
      respond(res, 200, { ok: !closing, protocolVersion: PROTOCOL_VERSION, tickRate: TICK_RATE, activeMatches: [...matches.values()].filter((match) => !isGameOver(match.state) && !match.failed).length });
      return;
    }
    if (req.method === "GET" && path3 === "/api/session") {
      respond(res, 200, { account: session(req) ?? null });
      return;
    }
    if (req.method === "GET" && path3 === "/api/ranked/seasons") {
      const current = store.competitions.season(competitionNow());
      respond(res, 200, { current, seasons: store.competitions.seasons(), rules: RANKED_RULES });
      return;
    }
    if (req.method === "GET" && path3 === "/api/ranked/standings") {
      const current = store.competitions.season(competitionNow()), seasonId = url.searchParams.get("season") ?? current.id;
      if (!store.competitions.seasons().some((season) => season.id === seasonId)) throw new HttpError(404, "Season not found.");
      respond(res, 200, { seasonId, standings: store.competitions.standings(seasonId) });
      return;
    }
    if (req.method === "GET" && path3 === "/api/challenges/daily") {
      const challenge = store.competitions.challenge(competitionNow());
      respond(res, 200, { challenge, standings: store.competitions.dailyStandings(challenge.date), rules: "The server chooses the UTC date, map seed, factions and starting conditions. Fastest hosted victory wins. Each account keeps its fastest victory. Started runs count for their original date, including after midnight." });
      return;
    }
    if (req.method === "GET" && path3 === "/api/challenges/daily/standings") {
      const date = url.searchParams.get("date") ?? store.competitions.challenge(competitionNow()).date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Use a UTC date in YYYY-MM-DD format.");
      respond(res, 200, { date, standings: store.competitions.dailyStandings(date) });
      return;
    }
    if (req.method === "POST" && path3 === "/api/auth/guest") {
      authLimit(req);
      const value = await body2(req);
      if (!keys3(value, ["username"]) || value.username !== void 0 && (typeof value.username !== "string" || !/^[-_a-zA-Z0-9]{3,24}$/.test(value.username))) throw new HttpError(400, "Guest name must be 3\u201324 letters, digits, underscores or hyphens.");
      const user = { id: randomUUID4(), username: `${value.username ?? "Guest"}-${randomBytes(3).toString("hex")}` };
      const salt = randomBytes(16).toString("hex"), hash4 = await scrypt(randomBytes(32).toString("hex"), salt, 64);
      store.addUser(user, `${salt}:${hash4.toString("hex")}`);
      setSession(res, user);
      respond(res, 200, { account: user, guest: true });
      return;
    }
    if (req.method === "POST" && (path3 === "/api/auth/register" || path3 === "/api/auth/login")) {
      authLimit(req);
      const value = credentials(await body2(req));
      let user;
      if (path3.endsWith("register")) {
        if (store.userByName(value.username)) throw new HttpError(409, "That username is already registered.");
        const salt = randomBytes(16).toString("hex"), hash4 = await scrypt(value.password, salt, 64);
        user = { id: randomUUID4(), username: value.username };
        try {
          store.addUser(user, `${salt}:${hash4.toString("hex")}`);
        } catch {
          throw new HttpError(409, "That username is already registered.");
        }
      } else {
        const saved = store.userByName(value.username);
        const [salt, hash4] = saved?.password.split(":") ?? ["0".repeat(32), "0".repeat(128)];
        const candidate = await scrypt(value.password, salt, 64);
        if (!saved || !timingSafeEqual(candidate, Buffer.from(hash4, "hex"))) throw new HttpError(401, "Username or password is incorrect.");
        user = { id: saved.id, username: saved.username };
      }
      setSession(res, user);
      respond(res, 200, { account: user });
      return;
    }
    if (req.method === "POST" && path3 === "/api/auth/logout") {
      const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("ovf_session="))?.slice("ovf_session=".length);
      if (cookie) store.deleteSession(createHash6("sha256").update(cookie).digest("hex"));
      res.setHeader("Set-Cookie", "ovf_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
      respond(res, 200, { ok: true });
      return;
    }
    if (path3.startsWith("/api/")) {
      const user = account(req);
      if (await communityHttp({ req, res, url, user, body: body2, respond })) return;
      if (tournaments && await tournaments.handle(req, res)) return;
      if (req.method === "GET" && path3 === "/api/cosmetics") {
        respond(res, 200, { account: user, catalog: COSMETICS, profile: store.cosmetics.profile(user.id), rules: "Earn faction cosmetics through verified victories: banner after 1 win, building decoration after 3 wins and commander portrait after 5 wins. Equipment changes appearance only." });
        return;
      }
      if (req.method === "POST" && path3 === "/api/cosmetics/equip") {
        const value = await body2(req);
        respond(res, 200, { account: user, equipped: store.cosmetics.equip(user.id, value), profile: store.cosmetics.profile(user.id) });
        return;
      }
      if (req.method === "POST" && path3 === "/api/cosmetics/campaign-victory") {
        if (!options.verifyCampaignVictory) throw new HttpError(503, "Canonical campaign verification is unavailable on this server.");
        if (campaignClaimBusy) throw new HttpError(503, "Campaign verification is busy. Retry this completed campaign shortly.");
        campaignClaimBusy = true;
        try {
          const uploadTimer = setTimeout(() => req.destroy(new HttpError(408, "Campaign upload timed out.")), 1e4);
          let value;
          try {
            value = await body2(req, 20 * 1024 * 1024);
          } finally {
            clearTimeout(uploadTimer);
          }
          if (!keys3(value, ["missionId", "recording"]) || typeof value.missionId !== "string" || !/^[-_a-zA-Z0-9]{1,96}$/.test(value.missionId) || value.recording === void 0) throw new HttpError(400, "Submit a completed canonical campaign recording and its finale mission ID.");
          let verified;
          try {
            verified = await options.verifyCampaignVictory(value.recording, value.missionId);
          } catch (error2) {
            if (error2 instanceof CampaignVerificationError) throw error2;
            throw new HttpError(400, error2 instanceof Error ? error2.message : "Campaign victory could not be verified.");
          }
          if (!verified || typeof verified !== "object" || Array.isArray(verified) || verified.missionId !== value.missionId || typeof verified.campaignId !== "string" || !/^[-_a-zA-Z0-9]{1,96}$/.test(verified.campaignId) || typeof verified.factionId !== "string" || !Object.hasOwn(FACTIONS, verified.factionId)) throw new HttpError(500, "Canonical campaign verifier returned an invalid result.");
          respond(res, 200, { verified, profile: store.cosmetics.awardCampaignVictory(user.id, verified) });
          return;
        } finally {
          campaignClaimBusy = false;
        }
      }
      const cosmeticsRoute = /^\/api\/matches\/([^/]+)\/cosmetics$/.exec(path3);
      if (req.method === "GET" && cosmeticsRoute) {
        const configuration = store.matchConfiguration(cosmeticsRoute[1]);
        if (!configuration) throw new HttpError(404, "Match not found.");
        respond(res, 200, { players: (configuration.participants ?? []).map((participant) => {
          const factionId = configuration.factions[participant.side];
          return { side: participant.side, factionId, loadout: store.cosmetics.loadout(participant.account.id, factionId) };
        }) });
        return;
      }
      if (req.method === "POST" && path3 === "/api/challenges/daily/start") {
        const value = await body2(req);
        if (!keys3(value, [])) throw new HttpError(400, "The server chooses all daily challenge settings.");
        const challenge = store.competitions.challenge(competitionNow());
        const active4 = [...lobbies.values()].find((lobby2) => lobby2.dailyDate === challenge.date && lobby2.hostId === user.id && lobby2.matchId && !isGameOver(matches.get(lobby2.matchId).state));
        if (active4) {
          respond(res, 200, { lobby: publicLobby(active4), challenge });
          return;
        }
        const players = challenge.config.players.map((player) => ({ factionId: player.factionId, teamId: player.teamId, controller: player.controller === "ai" ? "ai" : "human" }));
        const configuration = { mapSize: "small", factions: players.map((player) => player.factionId), players, sharedVision: true, startingAge: 1 };
        const lobby = { id: randomUUID4(), hostId: user.id, revision: 1, settings: configuration, seed: challenge.seed, seats: roster(configuration, [], user), matchId: null, dailyDate: challenge.date };
        const started = launchMatch(lobby, challenge.config, { kind: "daily", date: challenge.date, participant: user, challenge });
        respond(res, 201, { lobby: publicLobby(started), challenge });
        return;
      }
      const resultRoute = /^\/api\/competitions\/results\/([^/]+)$/.exec(path3);
      if (req.method === "GET" && resultRoute) {
        const match = matches.get(resultRoute[1]);
        if (!match) throw new HttpError(404, "Match not found.");
        if (!lobbies.get(match.lobbyId)?.seats.some((seat) => seat.account?.id === user.id)) throw new HttpError(403, "This result belongs to the match participants.");
        const result = store.competitions.result(match.id);
        respond(res, 200, { result, finished: result !== null, failed: match.failed });
        return;
      }
      if (req.method === "GET" && path3 === "/api/lobbies") {
        respond(res, 200, { lobbies: [...lobbies.values()].map(publicLobby) });
        return;
      }
      if (req.method === "POST" && path3 === "/api/lobbies") {
        const value = await body2(req);
        if (!keys3(value, ["settings", "seed", "ranked"]) || value.seed !== void 0 && !integer4(value.seed, 0, 4294967295) || value.ranked !== void 0 && typeof value.ranked !== "boolean") throw new HttpError(400, "Invalid lobby fields.");
        const configuration = settings(value.settings ?? { mapSize: "medium", factions: ["orcs", "fairies"] });
        if (value.ranked) {
          const reason = rankedEligibility(configuration);
          if (reason) throw new HttpError(400, reason);
          if (value.seed !== void 0) throw new HttpError(400, "The server chooses ranked map seeds.");
        }
        const lobby = { id: randomUUID4(), hostId: user.id, revision: 1, settings: configuration, seed: value.seed ?? randomBytes(4).readUInt32LE(), seats: roster(configuration, [], user), matchId: null, ...value.ranked ? { ranked: true } : {} };
        resetDraft(lobby);
        store.saveLobby(lobby);
        lobbies.set(lobby.id, lobby);
        respond(res, 201, { lobby: publicLobby(lobby) });
        return;
      }
      const lobbyRoute = /^\/api\/lobbies\/([^/]+)(?:\/(join|settings|ready|start|leave|draft))?$/.exec(path3);
      if (lobbyRoute) {
        const action2 = lobbyRoute[2];
        if (req.method === "GET" && !action2) {
          respond(res, 200, { lobby: publicLobby(getLobby(lobbyRoute[1])) });
          return;
        }
        if (req.method !== "POST") throw new HttpError(405, "Use POST.");
        const value = await body2(req);
        const lobby = structuredClone(getLobby(lobbyRoute[1]));
        editLobby(lobby, value);
        const own2 = lobby.seats.find((seat) => seat.account?.id === user.id);
        if (action2 === "join") {
          if (!keys3(value, ["expectedRevision"])) throw new HttpError(400, "Unknown join field.");
          if (!own2) {
            const empty = lobby.seats.find((seat) => seat.controller === "human" && !seat.account);
            if (!empty) throw new HttpError(409, "Human slots are full.");
            empty.account = user;
            if (!lobby.hostId) lobby.hostId = user.id;
            lobby.seats.forEach((seat) => {
              seat.ready = false;
            });
            resetDraft(lobby);
            changed(lobby);
          }
        } else if (action2 === "settings") {
          if (user.id !== lobby.hostId) throw new HttpError(403, "Only the host may change settings.");
          if (!keys3(value, ["expectedRevision", "settings", "seed"]) || value.seed !== void 0 && !integer4(value.seed, 0, 4294967295)) throw new HttpError(400, "Unknown or invalid settings field.");
          const configuration = settings(value.settings);
          if (lobby.ranked) {
            const reason = rankedEligibility(configuration);
            if (reason) throw new HttpError(400, reason);
            if (value.seed !== void 0) throw new HttpError(400, "The server chooses ranked map seeds.");
          }
          const seats = roster(configuration, lobby.seats);
          lobby.settings = configuration;
          lobby.seats = seats;
          if (value.seed !== void 0) lobby.seed = value.seed;
          resetDraft(lobby);
          changed(lobby);
        } else if (action2 === "ready") {
          if (!own2) throw new HttpError(403, "Join a seat first.");
          if (!keys3(value, ["expectedRevision", "ready"]) || typeof value.ready !== "boolean") throw new HttpError(400, "Expected readiness.");
          if (value.ready && lobby.draft?.status === "drafting") throw new HttpError(409, "Finish the draft before becoming ready.");
          own2.ready = value.ready;
          changed(lobby);
        } else if (action2 === "leave") {
          if (!own2) throw new HttpError(403, "You are not in this lobby.");
          if (!keys3(value, ["expectedRevision"])) throw new HttpError(400, "Unknown leave field.");
          own2.account = null;
          own2.ready = false;
          lobby.seats.forEach((seat) => {
            seat.ready = false;
          });
          if (user.id === lobby.hostId) lobby.hostId = lobby.seats.find((seat) => seat.account)?.account?.id ?? "";
          resetDraft(lobby);
          changed(lobby);
        } else if (action2 === "draft") {
          if (!own2) throw new HttpError(403, "Join a seat first.");
          if (!keys3(value, ["expectedRevision", "definitionId"]) || typeof value.definitionId !== "string") throw new HttpError(400, "Expected a definition ID.");
          if (lobby.seats.some((seat) => seat.controller === "human" && !seat.account)) throw new HttpError(409, "All human players must be present before the draft.");
          if (!lobby.draft || !applyDraftChoice(lobby.draft, normalizeMatchRules(lobby.settings.rules), lobby.settings.players.map((p, id6) => ({ ...p, id: id6 })), own2.side, value.definitionId)) throw new HttpError(409, "Illegal choice, duplicate definition, or another player owns this draft turn.");
          lobby.draftDeadlineAt = lobby.draft.status === "drafting" ? Date.now() + lobby.draft.remainingTicks * 1e3 / TICK_RATE : void 0;
          lobby.seats.forEach((seat) => {
            seat.ready = false;
          });
          changed(lobby);
        } else if (action2 === "start") {
          if (user.id !== lobby.hostId) throw new HttpError(403, "Only the host may start.");
          if (!keys3(value, ["expectedRevision"])) throw new HttpError(400, "Unknown start field.");
          if (lobby.seats.some((seat) => seat.controller === "human" && (!seat.account || !seat.ready))) throw new HttpError(409, "All human players must be present and ready.");
          if (lobby.draft?.status === "drafting") throw new HttpError(409, "Finish the draft before launching.");
          let competition;
          if (lobby.ranked) {
            const reason = rankedEligibility(lobby.settings);
            if (reason) throw new HttpError(400, reason);
            competition = { kind: "ranked", seasonId: store.competitions.season(competitionNow()).id, participants: lobby.seats.map((seat) => seat.account) };
          }
          Object.assign(lobby, launchMatch(lobby, matchConfig(lobby), competition));
        } else throw new HttpError(404, "Unknown lobby action.");
        respond(res, 200, { lobby: publicLobby(lobby) });
        return;
      }
      if (req.method === "GET" && path3 === "/api/matches") {
        respond(res, 200, { matches: [...matches.values()].filter((match) => lobbies.get(match.lobbyId)?.seats.some((seat) => seat.account?.id === user.id)).map(matchSummary) });
        return;
      }
      const matchRoute = /^\/api\/matches\/([^/]+)\/ticket$/.exec(path3);
      if (req.method === "POST" && matchRoute) {
        const match = matches.get(matchRoute[1]);
        if (!match) throw new HttpError(404, "Match not found.");
        const value = await body2(req);
        if (!keys3(value, ["role", "perspective", "view"]) || !["player", "spectator"].includes(value.role) || value.perspective !== void 0 && !integer4(value.perspective, 0, match.state.players.length - 1) || value.view !== void 0 && !["player", "team"].includes(value.view)) throw new HttpError(400, "Expected a player/spectator role and a valid player/team perspective.");
        const seat = lobbies.get(match.lobbyId).seats.find((seat2) => seat2.account?.id === user.id);
        if (value.role === "player" && !seat) throw new HttpError(403, "You do not own a seat.");
        const role = value.role, competitionLobby = lobbies.get(match.lobbyId);
        const side2 = role === "player" ? seat.side : value.perspective ?? ((competitionLobby?.ranked || competitionLobby?.dailyDate) && seat ? seat.side : 0);
        if (role === "spectator" && seat && (competitionLobby?.ranked || competitionLobby?.dailyDate) && (!isGameOver(match.state) || match.failed) && side2 !== seat.side) throw new HttpError(403, "Competition participants may only inspect their own perspective during the match.");
        const perspective = role === "spectator" && value.view === "team" ? "team" : "player";
        const token = randomBytes(32).toString("hex");
        tickets.set(token, { account: user, matchId: match.id, role, side: side2, perspective, expires: Date.now() + 6e4 });
        respond(res, 200, { ticket: token, expiresInSeconds: 60, protocolVersion: PROTOCOL_VERSION, role, side: side2, perspective, delayTicks: role === "spectator" ? delayTicks : 0 });
        return;
      }
      throw new HttpError(404, "API endpoint not found.");
    }
    if (req.method !== "GET") throw new HttpError(405, "Use GET.");
    if (!options.staticDir) throw new HttpError(404, "Build the browser or configure RTS_STATIC_DIR.");
    const directory = resolve2(options.staticDir);
    let filename = resolve2(directory, `.${decodeURIComponent(path3)}`);
    if (filename !== directory && !filename.startsWith(directory + sep)) throw new HttpError(403, "Invalid file path.");
    try {
      if ((await stat(filename)).isDirectory()) filename = resolve2(filename, "index.html");
      await stat(filename);
    } catch {
      if (extname(path3)) throw new HttpError(404, "File not found.");
      filename = resolve2(directory, "index.html");
    }
    const data = await readFile3(filename), types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
    res.writeHead(200, { "Content-Type": types[extname(filename)] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": extname(filename) === ".html" ? "no-cache" : "public,max-age=3600" });
    res.end(data);
  }
  const http = createServer((req, res) => {
    void route2(req, res).catch((error2) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const known2 = error2 instanceof HttpError || error2 instanceof CommunityPackageError || error2 instanceof CosmeticRequestError || error2 instanceof CampaignVerificationError;
      respond(res, known2 ? error2.status : 500, { error: known2 ? error2.message : "Server request failed." });
    });
  });
  const websocket = new WebSocketServer({ noServer: true, maxPayload: MAX_BODY_BYTES, perMessageDeflate: false });
  function deliver(peer, match) {
    const effectiveTick = match.state.tick + (match.finishedAt === void 0 ? 0 : Math.floor((Date.now() - match.finishedAt) / 1e3 * TICK_RATE));
    const cutoff = peer.role === "spectator" ? effectiveTick - delayTicks : match.state.tick;
    const frame = [...match.frames].reverse().find((frame2) => frame2.tick <= cutoff);
    if (!frame) {
      if (peer.lastFrameTick < 0) {
        send(peer.socket, { kind: "waiting", availableAtTick: delayTicks, currentTick: effectiveTick });
        peer.lastFrameTick = -2;
      }
      return;
    }
    if (frame.tick <= peer.lastFrameTick) return;
    send(peer.socket, { kind: "snapshot", matchId: match.id, frameSeq: frame.tick, tick: frame.tick, view: peer.perspective === "team" ? teamObservation(frame.views, peer.side) : frame.views[peer.side] });
    peer.lastFrameTick = frame.tick;
  }
  http.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`), token = url.searchParams.get("ticket");
      const ticket = token ? tickets.get(token) : void 0, user = session(req);
      if (url.pathname !== "/ws" || !allowedOrigin(req) || !ticket || ticket.expires < Date.now() || user?.id !== ticket.account.id) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      tickets.delete(token);
      const match = matches.get(ticket.matchId);
      websocket.handleUpgrade(req, socket, head, (ws) => {
        let generation = 0;
        if (ticket.role === "player") {
          generation = match.generations[ticket.side] + 1;
          const generations = [...match.generations];
          generations[ticket.side] = generation;
          try {
            store.generation(match.id, generations);
          } catch {
            ws.close(1011, "Persistence failed");
            return;
          }
          match.generations = generations;
          match.pending = match.pending.filter((entry) => entry.side !== ticket.side);
          for (const peer2 of match.peers) if (peer2.role === "player" && peer2.side === ticket.side) peer2.socket.close(4001, "Connection replaced");
        }
        const peer = { ...ticket, socket: ws, generation, lastFrameTick: -1, messages: 0, rateAt: Date.now() };
        match.peers.add(peer);
        send(ws, { kind: "hello", protocolVersion: PROTOCOL_VERSION, matchId: match.id, role: peer.role, side: peer.side, generation, perspective: peer.perspective, lastClientSeq: peer.role === "player" ? match.lastSeq[peer.side] : 0, delayTicks: peer.role === "spectator" ? delayTicks : 0 });
        deliver(peer, match);
        ws.on("message", (data) => {
          if (peer.role === "player" && peer.generation !== match.generations[peer.side]) {
            fail2(ws, "replaced", "This connection was replaced.");
            return;
          }
          const now = Date.now();
          if (now - peer.rateAt > 1e3) {
            peer.messages = 0;
            peer.rateAt = now;
          }
          if (++peer.messages > 100) {
            ws.close(4008, "Command rate exceeded");
            return;
          }
          let value;
          try {
            value = JSON.parse(data.toString());
          } catch {
            fail2(ws, "invalid-message", "Invalid JSON.");
            return;
          }
          if (record6(value) && value.kind === "ping" && keys3(value, ["kind", "requestId"]) && (value.requestId === void 0 || typeof value.requestId === "string")) {
            send(ws, { kind: "pong", requestId: value.requestId });
            return;
          }
          if (peer.role !== "player") {
            fail2(ws, "spectator", "Spectators cannot issue commands.");
            return;
          }
          if (!record6(value) || !keys3(value, ["kind", "protocolVersion", "clientSeq", "observedTick", "command"]) || value.kind !== "command" || value.protocolVersion !== PROTOCOL_VERSION || !integer4(value.clientSeq, 1) || !integer4(value.observedTick) || value.observedTick > match.state.tick) {
            fail2(ws, "invalid-message", "Invalid command envelope.");
            return;
          }
          const valid = validateCommand(value.command) || isSurrender(value.command), command = valid ? value.command : null;
          const payload = jsonHash(value.command);
          const key = `${peer.side}:${value.clientSeq}`, stored = match.receipts.get(key);
          if (stored) {
            if (stored.payload === payload) send(ws, stored.ack);
            else fail2(ws, "sequence-conflict", "A command sequence cannot have a different payload.");
            return;
          }
          const pending = match.pending.find((entry) => entry.side === peer.side && entry.clientSeq === value.clientSeq);
          if (pending) {
            if (pending.payload !== payload) fail2(ws, "sequence-conflict", "A command sequence cannot have a different payload.");
            else {
              pending.socket = ws;
              pending.generation = peer.generation;
            }
            return;
          }
          const previous = match.pending.filter((entry) => entry.side === peer.side).at(-1)?.clientSeq ?? match.lastSeq[peer.side];
          if (value.clientSeq !== previous + 1) {
            fail2(ws, "sequence-gap", `Expected command sequence ${previous + 1}.`);
            return;
          }
          if (match.failed) {
            fail2(ws, "storage-failure", "This match is paused after a persistence failure.");
            return;
          }
          if (isGameOver(match.state)) {
            const ack = { kind: "commandAck", clientSeq: value.clientSeq, appliedTick: match.state.tick, accepted: false, reason: "ended" };
            const entry = { side: peer.side, clientSeq: value.clientSeq, payload, appliedTick: match.state.tick, ordinal: 0, command, ack };
            try {
              store.commitTick(match.id, match.state, [entry], match.views.map((view) => view.snapshot()));
            } catch {
              match.failed = true;
              fail2(ws, "storage-failure", "Receipt persistence failed.");
              return;
            }
            match.receipts.set(key, entry);
            match.lastSeq[peer.side] = value.clientSeq;
            send(ws, ack);
            return;
          }
          match.pending.push({ side: peer.side, clientSeq: value.clientSeq, payload, command, socket: ws, generation: peer.generation });
        });
        ws.on("close", () => match.peers.delete(peer));
        ws.on("error", () => match.peers.delete(peer));
      });
    } catch {
      socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      socket.destroy();
    }
  });
  function advance(match) {
    if (match.failed) return;
    if (isGameOver(match.state)) {
      for (const peer of match.peers) deliver(peer, match);
      return;
    }
    const appliedTick = match.state.tick + 1, entries2 = [];
    const pending = match.pending.splice(0);
    for (const [ordinal, entry] of pending.entries()) {
      let accepted = false, reason;
      if (isSurrender(entry.command)) {
        accepted = applyInput(match.state, entry.side, entry.command);
        if (!accepted) reason = "unavailable";
      } else if (!validateCommand(entry.command)) reason = "invalid-command";
      else if (isPlayerCommand(entry.command)) {
        accepted = issueCommand(match.state, entry.side, entry.command);
        if (!accepted) reason = "unavailable";
      } else {
        const ids = "ids" in entry.command ? entry.command.ids : "id" in entry.command ? [entry.command.id] : [];
        if (!ids.length || ids.some((id6) => !match.state.entities.some((entity) => entity.id === id6 && entity.side === entry.side && entity.hp > 0))) reason = "ownership";
        else {
          accepted = issueCommand(match.state, entry.side, entry.command);
          if (!accepted) reason = "unavailable";
        }
      }
      const ack = { kind: "commandAck", clientSeq: entry.clientSeq, appliedTick, accepted, ...reason ? { reason } : {} };
      entries2.push({ side: entry.side, clientSeq: entry.clientSeq, payload: entry.payload, appliedTick, ordinal, command: entry.command, ack });
    }
    stepGame(match.state, 1 / TICK_RATE);
    const views = match.views.map((view) => view.observe(match.state));
    views.forEach((view, side2) => match.eventBuffers[side2].push(...view.events));
    const finished = isGameOver(match.state), frame = match.state.tick % 4 === 0 || finished ? { tick: match.state.tick, views: views.map((view, side2) => ({ ...view, events: match.eventBuffers[side2].splice(0) })) } : void 0;
    try {
      store.commitTick(match.id, match.state, entries2, match.views.map((view) => view.snapshot()), frame, match.state.tick % 20 === 0 || finished);
    } catch (error2) {
      match.failed = true;
      for (const peer of match.peers) fail2(peer.socket, "storage-failure", "This match paused because its tick could not be persisted.");
      return;
    }
    if (frame) {
      match.frames.push(frame);
      match.frames = match.frames.filter((frame2) => frame2.tick >= match.state.tick - delayTicks - 80);
    }
    if (finished) match.finishedAt = Date.now();
    for (const [index2, entry] of entries2.entries()) {
      match.receipts.set(`${entry.side}:${entry.clientSeq}`, entry);
      match.lastSeq[entry.side] = entry.clientSeq;
      const original = pending[index2];
      if (original.generation === match.generations[entry.side]) send(original.socket, entry.ack);
    }
    for (const peer of match.peers) deliver(peer, match);
  }
  function advanceDrafts() {
    for (const lobby of lobbies.values()) {
      if (lobby.matchId || lobby.draft?.status !== "drafting" || !lobby.draftDeadlineAt) continue;
      const turn = lobby.draft.order[lobby.draft.turn];
      if (lobby.seats[turn.side].controller !== "ai" && Date.now() < lobby.draftDeadlineAt) continue;
      const next = structuredClone(lobby), rules = normalizeMatchRules(next.settings.rules), players = next.settings.players.map((p, id6) => ({ ...p, id: id6 }));
      for (const id6 of legalDraftChoices(next.draft, players, turn.side)) if (applyDraftChoice(next.draft, rules, players, turn.side, id6)) break;
      next.draftDeadlineAt = next.draft.status === "drafting" ? Date.now() + next.draft.remainingTicks * 1e3 / TICK_RATE : void 0;
      next.seats.forEach((seat) => {
        seat.ready = false;
      });
      changed(next);
    }
  }
  const timer = setInterval(() => {
    try {
      advanceDrafts();
    } catch {
    }
    for (const match of matches.values()) {
      try {
        advance(match);
      } catch {
        match.failed = true;
        for (const peer of match.peers) fail2(peer.socket, "match-failure", "The match paused after an internal error.");
      }
    }
    const now = Date.now();
    for (const [token, ticket] of tickets) if (ticket.expires < now) tickets.delete(token);
  }, interval);
  try {
    await new Promise((resolveListening, reject) => {
      http.once("error", reject);
      http.listen(port, host, () => {
        http.off("error", reject);
        resolveListening();
      });
    });
  } catch (error2) {
    clearInterval(timer);
    await tournaments?.dispose();
    websocket.close();
    store.close();
    throw error2;
  }
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("No server address.");
  return {
    url: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${address.port}`,
    port: address.port,
    async close() {
      if (closing) return;
      closing = true;
      clearInterval(timer);
      await tournaments?.dispose();
      for (const match of matches.values()) for (const peer of match.peers) peer.socket.terminate();
      await new Promise((resolveClosed) => websocket.close(() => resolveClosed()));
      await new Promise((resolveClosed) => http.close(() => resolveClosed()));
      store.close();
    }
  };
}

// src/server/main.ts
var server = await createRtsServer({
  host: process.env.RTS_HOST ?? "127.0.0.1",
  port: Number(process.env.RTS_PORT ?? 8787),
  dataDir: resolve3(process.env.RTS_DATA_DIR ?? "work/server"),
  staticDir: resolve3(process.env.RTS_STATIC_DIR ?? "dist"),
  origin: process.env.RTS_ORIGIN,
  secureCookie: process.env.RTS_SECURE_COOKIE === "1",
  trustProxy: process.env.RTS_TRUST_PROXY === "1",
  spectatorDelaySeconds: Number(process.env.RTS_SPECTATOR_DELAY_SECONDS ?? 30),
  verifyCampaignVictory: createCampaignVerificationWorker(fileURLToPath2(new URL("./canonical-campaign.mjs", import.meta.url))),
  tournaments: { cwd: process.cwd(), configs: [JSON.parse(await readFile4(resolve3("scripts/tournaments/smoke.json"), "utf8"))] }
});
console.log(`Orcs vs Fairies authoritative server: ${server.url}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  void server.close().then(() => process.exit(0));
});
