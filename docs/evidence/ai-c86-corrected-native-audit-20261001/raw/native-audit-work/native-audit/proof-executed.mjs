// work/final-ai-prep/audit-ladder401-r2.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// src/core/content.ts
var ECONOMY = { harvestPerSecond: 2.28 };
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
var cavalryAbilities = { orcs: "impact-fury", fairies: "forest-leap", dwarves: "armored-brace", undead: "terror", tideborn: "wet-surge", automata: "shield-dash" };
var siegeAbilities = { orcs: "incendiary-shell", fairies: "rooting-shell", dwarves: "ammunition-cannon", undead: "corpse-shell", tideborn: "flood-shell", automata: "powered-beam" };
var FACTIONS = Object.fromEntries(Object.entries(BASE_FACTIONS).map(([id2, base]) => {
  const faction = id2, prefix = base.units.worker.id.split("-")[0], names = expansionNames[faction];
  return [id2, { ...base, buildings: {
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
  const id2 = `core:${faction}-${kind === "hero" ? "commander" : kind}`;
  return [id2, { path: `/mods/core/${faction}-${kind}.svg`, svg: svg(faction, kind), width: 128, height: 128, anchor: [64, 112], visualTop: 20 }];
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
for (const [id2, drawing] of Object.entries(factionObjectDrawings)) BUILTIN_EXTRA_ART[id2] = { path: `/mods/core/${id2.slice(5)}.svg`, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#20332f" stroke-width="3">${drawing}</g></svg>`, width: 128, height: 128, anchor: [64, 112], visualTop: 10 };

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
var depot = (kind, name, cost2, hp, buildTime, description) => ({ id: `economy:${kind}`, name, role: "depot", cost: { ...cost2 }, hp, size: 2, buildTime, sight: 7, description });
var ECONOMY_BUILDINGS = {
  warehouse: depot("warehouse", "Regional warehouse", ECONOMY_RULES.warehouse.cost, 720, 26, "Holds 900 local resources. Assigned workers deposit here; caravans move stock to other settlements."),
  extractor: depot("extractor", "Crystal extractor", ECONOMY_RULES.extractor.cost, 650, 30, "Nearby crystal workers harvest faster. Overcharge increases output but can damage the extractor every 12 seconds."),
  "deep-mine": depot("deep-mine", "Deep mine", ECONOMY_RULES.deepMine.cost, 800, 38, "Extends one depleted ore deposit with a finite reserve of up to 800 ore.")
};
var ECONOMY_CARAVAN = { id: "economy:caravan", name: "Trade caravan", role: "worker", cost: { ...ECONOMY_RULES.caravan.cost }, hp: 150, damage: 0, armor: 1, range: 0, speed: 1.8, cooldown: 2, trainTime: ECONOMY_RULES.caravan.trainSeconds, sight: 6, description: "Carries up to 90 resources on physical delivery and trade routes. Losing the caravan drops its remaining cargo." };

// src/core/legacy-content-v3.ts
var ECONOMY2 = { harvestPerSecond: 2.28 };
var unit2 = (id2, name, role, wood, ore, hp, damage, armor, range, speed, cooldown, trainTime, ability, description) => ({ id: id2, name, role, cost: { wood, ore, crystal: role === "special" ? 12 : 0 }, hp, damage, armor, range, speed, cooldown, trainTime, sight: role === "ranged" ? 9 : 7, ability, description });
var building2 = (id2, name, role, wood, ore, hp, size, buildTime, description, ability) => ({ id: id2, name, role, cost: { wood, ore, crystal: role === "tower" ? 6 : 0 }, hp, size, buildTime, sight: role === "tower" ? 11 : 9, description, ability });
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
var FACTIONS2 = Object.fromEntries(Object.entries(BASE_FACTIONS2).map(([id2, base]) => {
  const faction = id2, prefix = base.units.worker.id.split("-")[0], names = expansionNames2[faction];
  return [id2, { ...base, buildings: {
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
function fail(path, message) {
  throw new Error(`Invalid content at ${path}: ${message}.`);
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
function num(v, path, min, max, integer = false) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer && !Number.isSafeInteger(v)) fail(path, `expected ${integer ? "a whole" : "a finite"} number from ${min} to ${max}`);
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
function unit3(v, path, namespace) {
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
function building3(v, path, namespace) {
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
  if (value.requires !== void 0) arr(value.requires, `${path}.requires`, 16).forEach((id2, i) => str(id2, `${path}.requires[${i}]`, 100));
  if (value.exclusiveGroup !== void 0) definitionId(value.exclusiveGroup, `${path}.exclusiveGroup`, namespace);
  if (value.appliesToDefinitions !== void 0) {
    const targets = arr(value.appliesToDefinitions, `${path}.appliesToDefinitions`, 64);
    if (!targets.length) fail(`${path}.appliesToDefinitions`, "at least one definition target is required");
    targets.forEach((id2, i) => str(id2, `${path}.appliesToDefinitions[${i}]`, 100));
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
  const bytes = new TextEncoder().encode(canonicalContent(value)), length = bytes.length;
  const padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  padded.set(bytes);
  padded[length] = 128;
  const data = new DataView(padded.buffer);
  data.setUint32(padded.length - 8, Math.floor(length * 8 / 4294967296));
  data.setUint32(padded.length - 4, length * 8);
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
    const path = `package.factions[${i}]`, f = obj(v, path, ["id", "baseFaction", "name", "subtitle", "description", "color", "accent", "units", "buildings", "research"], ["defaultUnits", "defaultBuildings"]);
    definitionId(f.id, `${path}.id`, namespace);
    one(f.baseFaction, `${path}.baseFaction`, builtinIds);
    for (const key of ["name", "subtitle", "description"]) str(f[key], `${path}.${key}`, key === "description" ? 2e3 : 200);
    num(f.color, `${path}.color`, 0, 16777215, true);
    if (!/^#[a-fA-F0-9]{6}$/.test(str(f.accent, `${path}.accent`, 7))) fail(`${path}.accent`, "expected a six-digit color");
    arr(f.units, `${path}.units`, 64).forEach((v2, j) => unit3(v2, `${path}.units[${j}]`, namespace));
    arr(f.buildings, `${path}.buildings`, 32).forEach((v2, j) => building3(v2, `${path}.buildings[${j}]`, namespace));
    arr(f.research, `${path}.research`, 64).forEach((v2, j) => research(v2, `${path}.research[${j}]`, namespace));
    for (const [field, roles] of [["defaultUnits", unitRoles], ["defaultBuildings", buildingRoles]]) if (f[field] !== void 0) {
      const defaults = obj(f[field], `${path}.${field}`, [], roles);
      for (const [role, id2] of Object.entries(defaults)) definitionId(id2, `${path}.${field}.${role}`);
    }
  });
  const art = obj(p.art, "package.art", [], Object.keys(p.art && typeof p.art === "object" ? p.art : {}));
  if (Object.keys(art).length > 128) fail("package.art", "too many assets");
  let pixels = 0;
  for (const [id2, input2] of Object.entries(art)) {
    definitionId(id2, `package.art.${id2}`, namespace);
    const a = obj(input2, `package.art.${id2}`, ["path", "svg", "width", "height", "anchor"], ["visualTop"]);
    const path = str(a.path, `package.art.${id2}.path`, 300);
    if (!/^\/mods\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(path) || !path.startsWith(`/mods/${namespace}/`)) fail(`package.art.${id2}.path`, "expected a packaged SVG under its own /mods directory");
    if (typeof a.svg !== "string" || a.svg.length > 1e5 || !a.svg.trim()) fail(`art.${id2}.svg`, "expected SVG source under 100000 characters");
    const svg2 = a.svg;
    if (!/^<svg\s/.test(svg2) || !/<\/svg>\s*$/.test(svg2) || /<(?:script|foreignObject|iframe|image|use|a|style|animate|set)\b|\bon[a-z]+\s*=|\bhref\s*=|\bstyle\s*=|&#|url\s*\(|<!|<\?/i.test(svg2.replace(/url\(#[a-zA-Z][a-zA-Z0-9-]*\)/g, ""))) fail(`art.${id2}.svg`, "only self-contained static SVG is permitted");
    for (const tag of svg2.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g)) if (!["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc", "defs", "linearGradient", "radialGradient", "stop"].includes(tag[1])) fail(`art.${id2}.svg`, `unsupported SVG element ${tag[1]}`);
    num(a.width, `art.${id2}.width`, 8, 512, true);
    num(a.height, `art.${id2}.height`, 8, 512, true);
    pixels += a.width * a.height;
    if (pixels > 4 * 1024 * 1024) fail("package.art", "decoded artwork exceeds 16 MiB");
    const anchor = arr(a.anchor, `art.${id2}.anchor`, 2);
    if (anchor.length !== 2) fail(`art.${id2}.anchor`, "expected two coordinates");
    num(anchor[0], `art.${id2}.anchor[0]`, 0, a.width);
    num(anchor[1], `art.${id2}.anchor[1]`, 0, a.height);
    if (a.visualTop !== void 0) num(a.visualTop, `art.${id2}.visualTop`, 0, a.height);
  }
  if (!/^[a-f0-9]{64}$/.test(str(p.hash, "package.hash", 64)) || p.hash !== contentHash(unsigned(p))) fail("package.hash", "SHA-256 does not match the manifest");
  if (new TextEncoder().encode(canonicalContent(p)).length > MAX_CONTENT_BYTES) fail("package", "file exceeds 2 MiB");
  return freeze(JSON.parse(JSON.stringify(p)));
}
var PINNED_BASE_FACTIONS = freeze(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS).map(([id2, f]) => [id2, { ...f, unitDefinitions: [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[id2].units, ECONOMY_CARAVAN], buildingDefinitions: [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[id2].buildings, ...Object.values(ECONOMY_BUILDINGS)] }])))));
var PINNED_BASE_RESEARCH = freeze(JSON.parse(JSON.stringify(UPGRADES)));
var CURRENT_BASE = { factions: PINNED_BASE_FACTIONS, art: BUILTIN_EXTRA_ART, research: PINNED_BASE_RESEARCH };
var LEGACY_BASE_CONTENT_HASH = contentHash({ FACTIONS: FACTIONS2, UPGRADES: UPGRADES2, ECONOMY: ECONOMY2, ABILITIES: ABILITIES2 });
var LEGACY_BASE = freeze({ factions: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS2).map(([id2, f]) => [id2, { ...f, unitDefinitions: Object.values(f.units), buildingDefinitions: Object.values(f.buildings) }])))), art: {}, research: JSON.parse(JSON.stringify(UPGRADES2)) });
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
    const base = baseRegistry.factions[f.baseFaction], units = { ...base.units }, buildings = { ...base.buildings };
    for (const d of [...f.units, ...f.buildings, ...f.research]) {
      if (ids.has(d.id)) fail("definitions", `duplicate ${d.id}`);
      ids.add(d.id);
    }
    for (const [role, id2] of Object.entries(f.defaultUnits ?? {})) {
      const d = f.units.find((d2) => d2.id === id2);
      if (!d || d.role !== role) fail("defaultUnits", `${id2} is absent or has another role`);
      units[role] = d;
    }
    for (const [role, id2] of Object.entries(f.defaultBuildings ?? {})) {
      const d = f.buildings.find((d2) => d2.id === id2);
      if (!d || d.role !== role) fail("defaultBuildings", `${id2} is absent or has another role`);
      buildings[role] = d;
    }
    const targetUnits = [...Object.values(units), ...f.units];
    for (const research2 of f.research) for (const id2 of research2.appliesToDefinitions ?? []) {
      const target = targetUnits.find((unit4) => unit4.id === id2);
      if (!target || target.role !== research2.appliesTo) fail("research.appliesToDefinitions", `${id2} is absent or has another role`);
    }
    const available = new Map([...Object.values(baseRegistry.research), ...f.research].map((d) => [d.id, d])), done = /* @__PURE__ */ new Set(), pending = /* @__PURE__ */ new Set();
    const check = (id2) => {
      if (pending.has(id2)) fail("research", `prerequisite cycle includes ${id2}`);
      if (done.has(id2)) return;
      const d = available.get(id2);
      if (!d) fail("research", `missing prerequisite ${id2}`);
      pending.add(id2);
      for (const dep of d.requires ?? []) check(dep);
      pending.delete(id2);
      done.add(id2);
    };
    f.research.forEach((d) => check(d.id));
    for (const d of [...f.units, ...f.buildings]) if (!Object.hasOwn(p.art, d.id)) fail("art", `missing custom artwork for ${d.id}`);
    factions[f.id] = freeze({ ...base, ...f, units, buildings, unitDefinitions: [...Object.values(units), ...(base.unitDefinitions ?? []).filter((d) => !Object.values(base.units).some((x) => x.id === d.id)), ...f.units.filter((d) => !Object.values(units).some((base2) => base2.id === d.id))], buildingDefinitions: [...Object.values(buildings), ...(base.buildingDefinitions ?? []).filter((d) => !Object.values(base.buildings).some((x) => x.id === d.id)), ...f.buildings.filter((d) => !Object.values(buildings).some((base2) => base2.id === d.id))], research: f.research });
    Object.assign(art, p.art);
  }
  if (Object.values(art).reduce((sum, a) => sum + a.width * a.height, 0) > 16 * 1024 * 1024) fail("bundle.art", "decoded artwork exceeds 64 MiB");
  return freeze({ factions, art, research: baseRegistry.research });
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
  const body = { format: "orcs-vs-fairies-content", schemaVersion: 1, engineVersion: CONTENT_ENGINE_VERSION, baseHash: LEGACY_BASE_CONTENT_HASH, packages };
  if (new TextEncoder().encode(canonicalContent(body)).length > MAX_BUNDLE_BYTES) fail("bundle", "pinned package closure exceeds 4 MiB");
  if (value.hash !== contentHash(body)) fail("bundle.hash", "SHA-256 does not match the historical manifest");
  const admitted = freeze({ ...body, hash: value.hash });
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
function factionFor(state, side) {
  const faction = registry(state).factions[state.players[side]?.faction];
  if (!faction) throw new Error("Faction is absent from pinned match content.");
  return faction;
}
function availableUnits(state, side) {
  const f = factionFor(state, side);
  return [...f.unitDefinitions ?? [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.units ?? []]].filter((d) => !d.id.startsWith("economy:"));
}
function unitFor(state, subject, role, id2) {
  const side = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition = typeof subject === "number" ? id2 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side);
  if (!f) throw new Error("Original unit faction is absent from pinned content.");
  const value = definition === ECONOMY_CARAVAN.id && !state.content ? ECONOMY_CARAVAN : definition ? (f.unitDefinitions ?? [...Object.values(f.units), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.units ?? []]).find((d) => d.id === definition) : f.units[kind];
  if (!value || value.role !== kind) throw new Error(`Unit definition ${definition ?? kind} is absent from faction ${f.id}.`);
  return value;
}
function buildingFor(state, subject, role, id2) {
  const side = typeof subject === "number" ? subject : subject.side, kind = typeof subject === "number" ? role : subject.role, definition = typeof subject === "number" ? id2 : subject.definitionId;
  const f = typeof subject !== "number" && subject.definitionFaction ? registry(state).factions[subject.definitionFaction] : factionFor(state, side);
  if (!f) throw new Error("Original building faction is absent from pinned content.");
  const value = (!state.content ? Object.values(ECONOMY_BUILDINGS).find((d) => d.id === definition) : void 0) ?? (definition ? (f.buildingDefinitions ?? [...Object.values(f.buildings), ...BUILTIN_EXTRA_DEFINITIONS[f.id]?.buildings ?? []]).find((d) => d.id === definition) : f.buildings[kind]);
  if (!value || value.role !== kind) throw new Error(`Building definition ${definition ?? kind} is absent from faction ${f.id}.`);
  return value;
}
function entityDefinition(state, entity) {
  return entity.kind === "unit" ? unitFor(state, entity) : buildingFor(state, entity);
}
function upgradesFor(state, side) {
  return { ...registry(state).research, ...Object.fromEntries((factionFor(state, side).research ?? []).map((d) => [d.id, d])) };
}

// src/core/geometry.ts
function length2D(x, y) {
  return Math.sqrt(x * x + y * y);
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
  const carve = (a, b, radius = 1.65) => {
    const length = length2D(b.x - a.x, b.y - a.y), steps = Math.ceil(length * 3);
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0, cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
      for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y++) for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x++) if (length2D(x + 0.5 - cx, y + 0.5 - cy) <= radius) {
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
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain[y * width + x] === "road" || terrain[y * width + x] === "bridge") {
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
function validateMap(map) {
  const { width, height, starts, resources, terrain } = map, issues = [];
  if (terrain.length !== width * height) issues.push("Terrain dimensions do not match.");
  if (!starts.length || starts.length > 8) issues.push("Starting positions must number 1 through 8.");
  if (starts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 2.5 || p.y < 2.5 || p.x > width - 2.5 || p.y > height - 2.5)) issues.push("Starting positions lie outside the playable map.");
  const free = (x, y) => x >= 0 && y >= 0 && x < width && y < height && TERRAIN[terrain[y * width + x] ?? "rock"].walkable && !resources.some((r) => r.amount > 0 && length2D(r.x - x - 0.5, r.y - y - 0.5) < 0.7) && !starts.some((p) => Math.abs(p.x - x - 0.5) < 1.77 && Math.abs(p.y - y - 0.5) < 1.77);
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
    for (let y = Math.floor(r.y) - 1; y <= Math.floor(r.y) + 1; y++) for (let x = Math.floor(r.x) - 1; x <= Math.floor(r.x) + 1; x++) if (seen.has(y * width + x) && length2D(x + 0.5 - r.x, y + 0.5 - r.y) <= 1.25) reached = true;
    if (reached) reachableResources++;
    else issues.push(`Unreachable ${r.kind} at ${r.x},${r.y}.`);
  }
  for (const start of starts) for (const kind of ["wood", "ore", "crystal"]) if (!resources.some((r) => r.kind === kind && length2D(r.x - start.x, r.y - start.y) < 9)) issues.push(`Missing starting ${kind}.`);
  if (starts.length === 2) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (terrain[y * width + x] !== terrain[(height - 1 - y) * width + width - 1 - x]) {
      issues.push("Terrain is not symmetric.");
      break;
    }
    for (const r of resources) if (!resources.some((q) => q.kind === r.kind && q.amount === r.amount && q.x === width - r.x && q.y === height - r.y)) issues.push("Resource pair is not symmetric.");
  }
  return { valid: issues.length === 0, issues, reachableResources, totalResources: resources.length, reachableTiles: seen.size, startsConnected };
}

// src/core/world-map.ts
var BIOMES = ["temperate", "desert", "marsh", "snow", "forest"];
var levelOf = (point2) => point2.level ?? 0;
function validateWorldMap(value, options = {}) {
  const issues = [], record2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!record2(value)) return { valid: false, issues: ["Map must be an object."] };
  const map = value;
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 8 || map.height < 8 || map.width > 128 || map.height > 128) return { valid: false, issues: ["Map dimensions must be integers from8 through128."] };
  if (!Number.isSafeInteger(map.seed) || map.seed < 0 || map.seed > 4294967295) issues.push("Map seed must be an unsigned32-bit integer.");
  if (!["small", "medium", "large", "huge"].includes(map.size)) issues.push("Unknown map size.");
  if (!Array.isArray(map.levels) || map.levels.length < 1 || map.levels.length > 2) return { valid: false, issues: [...issues, "Maps require one or two levels."] };
  const area = map.width * map.height, point2 = (p) => record2(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isInteger(p.level) && p.level >= 0 && p.level < map.levels.length && p.x >= 0.5 && p.y >= 0.5 && p.x <= map.width - 0.5 && p.y <= map.height - 0.5;
  for (let l = 0; l < map.levels.length; l++) {
    const level = map.levels[l];
    if (!record2(level) || level.id !== l || typeof level.title !== "string" || level.title.length > 80) issues.push(`Invalid level${l} title or identifier.`);
    if (!Array.isArray(level?.terrain) || level.terrain.length !== area || level.terrain.some((t) => !Object.hasOwn(TERRAIN, t))) issues.push(`Level${l} terrain must contain one valid tile per map cell.`);
    if (!Array.isArray(level?.elevation) || level.elevation.length !== area || level.elevation.some((e) => !Number.isInteger(e) || e < 0 || e > 3)) issues.push(`Level${l} elevation must contain integers0 through3.`);
  }
  if (issues.some((i) => i.includes("terrain") || i.includes("elevation"))) return { valid: false, issues };
  if (!Array.isArray(map.starts) || map.starts.length < 1 || map.starts.length > 8 || map.starts.some((p, i) => !point2(p) || p.slot !== i)) issues.push("Starting slots must be ordered0 through7 with valid coordinates.");
  if (!Array.isArray(map.resources) || map.resources.length > 2048 || map.resources.some((r) => !point2(r) || !["wood", "ore", "crystal"].includes(r.kind) || !Number.isFinite(r.amount) || !Number.isFinite(r.maxAmount) || r.amount < 0 || r.amount > r.maxAmount || r.maxAmount > 1e9)) issues.push("Invalid resource nodes.");
  if (!Array.isArray(map.sites) || map.sites.length > 128 || map.sites.some((p) => !point2(p) || !Number.isSafeInteger(p.id) || p.id < 1 || !["relic", "village", "monster"].includes(p.kind)) || new Set(map.sites?.map((p) => p.id)).size !== map.sites?.length) issues.push("Invalid or duplicate site definitions.");
  if (!Array.isArray(map.transitions) || map.transitions.length > 64 || map.transitions.some((t) => !record2(t) || !Number.isSafeInteger(t.id) || t.id < 1 || !point2(t.from) || !point2(t.to) || t.from.level === t.to.level) || new Set(map.transitions?.map((t) => t.id)).size !== map.transitions?.length) issues.push("Invalid or duplicate level entrances.");
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
function generatedMapFromWorld(input, playerCount, options = {}) {
  const validation = validateWorldMap(input, options);
  if (!validation.valid) throw new Error(validation.issues.join("; "));
  if (input.starts.length !== playerCount) throw new Error("Map starting slots must match the roster.");
  return { size: input.size, seed: input.seed, width: input.width, height: input.height, terrain: [...input.levels[0].terrain], starts: input.starts.map((p) => ({ x: p.x, y: p.y, level: p.level })), resources: input.resources.map((r) => ({ ...r })), version: MAP_VERSION };
}

// src/core/match-rules.ts
var plain = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function fields(value, allowed, name) {
  if (!plain(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`Invalid ${name}.`);
  return value;
}
function num2(value, min, max, name, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) throw new Error(`Invalid ${name}.`);
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
  if (!Array.isArray(disabled) || disabled.length > 256 || disabled.some((id2) => typeof id2 !== "string" || id2.length > 128 || !definitionIds(content).includes(id2)) || new Set(disabled).size !== disabled.length) throw new Error("Disabled definitions must be unique known unit or technology IDs.");
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
  return [...availableUnits(context, 0).filter((u) => u.role !== "worker").map((u) => u.id), ...Object.keys(upgradesFor(context, 0)).filter((id2) => !["town-age", "citadel-age"].includes(id2))];
};
function createDraft(players, rules, content) {
  const pool = [...new Set(players.flatMap((p) => draftOptions(p.factionId, content)))].filter((id2) => !rules.disabledDefinitionIds.includes(id2)), order2 = [];
  if (rules.draft.enabled) {
    for (let round = 0; round < rules.draft.banRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order2.push({ side: p.id, action: "ban" });
    for (let round = 0; round < rules.draft.pickRounds; round++) for (const p of round % 2 ? [...players].reverse() : players) order2.push({ side: p.id, action: "pick" });
  }
  if (rules.draft.enabled && players.some((p) => draftOptions(p.factionId, content).filter((id2) => pool.includes(id2)).length < rules.draft.pickRounds + rules.draft.banRounds * players.length || !availableUnits(factionContext(p.factionId, content), 0).some((u) => u.role !== "worker" && pool.includes(u.id)))) throw new Error("Draft has too many bans/picks for the available faction definitions. Reduce bans or picks.");
  return { status: order2.length ? "drafting" : "complete", turn: 0, remainingTicks: order2.length ? rules.draft.turnTicks : 0, order: order2, banned: [], picks: players.map(() => []), pool };
}
function legalDraftChoices(draft, players, side, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || turn?.side !== side) return [];
  const pickGoal = (id2) => draft.order.filter((t) => t.side === id2 && t.action === "pick").length;
  return draft.pool.filter((id2) => {
    if (draft.banned.includes(id2) || draft.picks[side]?.includes(id2)) return false;
    if (turn.action === "ban") return players.every((p) => draftOptions(p.factionId, content).filter((option) => draft.pool.includes(option) && option !== id2 && !draft.banned.includes(option)).length >= pickGoal(p.id) && combatIds(p.factionId, content).some((option) => draft.pool.includes(option) && option !== id2 && !draft.banned.includes(option)));
    if (!draftOptions(players[side].factionId, content).includes(id2)) return false;
    return draft.picks[side].length !== pickGoal(side) - 1 || draft.picks[side].some((option) => combatIds(players[side].factionId, content).includes(option)) || combatIds(players[side].factionId, content).includes(id2);
  });
}
var combatIds = (factionId, content) => availableUnits(factionContext(factionId, content), 0).filter((u) => u.role !== "worker").map((u) => u.id);
function applyDraftChoice(draft, rules, players, side, definitionId2, content) {
  const turn = draft.order[draft.turn];
  if (draft.status !== "drafting" || !turn || turn.side !== side || !legalDraftChoices(draft, players, side, content).includes(definitionId2)) return false;
  if (turn.action === "pick" && draft.picks[side].length === rules.draft.pickRounds - 1 && !draft.picks[side].some((id2) => combatIds(players[side].factionId, content).includes(id2)) && !combatIds(players[side].factionId, content).includes(definitionId2)) return false;
  if (turn.action === "ban" && players.some((p) => draftOptions(p.factionId, content).filter((id2) => draft.pool.includes(id2) && id2 !== definitionId2 && !draft.banned.includes(id2)).length < rules.draft.pickRounds || !combatIds(p.factionId, content).some((id2) => draft.pool.includes(id2) && id2 !== definitionId2 && !draft.banned.includes(id2)))) return false;
  if (turn.action === "pick") draft.picks[side].push(definitionId2);
  else draft.banned.push(definitionId2);
  draft.turn++;
  draft.status = draft.turn === draft.order.length ? "complete" : "drafting";
  draft.remainingTicks = draft.status === "complete" ? 0 : rules.draft.turnTicks;
  return true;
}
function draftPlayers(state) {
  return state.players.map((p, id2) => ({ id: id2, factionId: p.faction }));
}
function definitionAllowed(state, side, id2) {
  if (state.rules.disabledDefinitionIds.includes(id2) || state.draft.banned.includes(id2)) return false;
  const necessary = id2 === "economy:caravan" || id2 === "town-age" || id2 === "citadel-age" || availableUnits(state, side).some((unit4) => unit4.role === "worker" && unit4.id === id2);
  return !state.rules.draft.enabled || necessary || state.draft.status === "complete" && state.draft.picks[side].includes(id2);
}
function validateModeRoster(state) {
  if (state.rules.mode !== "survival") return;
  if (!state.teams.includes(state.rules.survival.defenderTeam) || new Set(state.teams).size !== 2) throw new Error("Survival requires a defender team and one opposing wave team.");
  if (state.draft.status === "complete" && state.players.some((_player, side) => state.teams[side] !== state.rules.survival.defenderTeam && !availableUnits(state, side).some((unit4) => unit4.role !== "worker" && definitionAllowed(state, side, unit4.id)))) throw new Error("Every wave slot needs an enabled combat unit.");
}
function validateDraftState(value, players, rules, content) {
  const d = fields(value, ["status", "turn", "remainingTicks", "order", "banned", "picks", "pool"], "draft state"), expected = createDraft(players, rules, content);
  const turn = num2(d.turn, 0, expected.order.length, "draft turn", true);
  if (JSON.stringify(d.order) !== JSON.stringify(expected.order) || JSON.stringify(d.pool) !== JSON.stringify(expected.pool)) throw new Error("Draft order or pool differs from the match rules.");
  if (!Array.isArray(d.banned) || !Array.isArray(d.picks) || d.picks.length !== players.length || d.picks.some((p) => !Array.isArray(p) || p.length > rules.draft.pickRounds || p.some((id2) => typeof id2 !== "string"))) throw new Error("Invalid saved draft choices.");
  const choices = d.picks;
  const picked = players.map(() => 0);
  let banned = 0;
  for (let i = 0; i < turn; i++) {
    const action = expected.order[i], id2 = action.action === "ban" ? d.banned[banned++] : choices[action.side][picked[action.side]++];
    if (typeof id2 !== "string" || !applyDraftChoice(expected, rules, players, action.side, id2, content)) throw new Error("Saved draft contains an illegal choice.");
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
    const id2 = num2(v, 0, 7, "objective team", true);
    if (!state.teams.includes(id2)) throw new Error("Objective refers to an absent team.");
    return id2;
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

// src/core/faction-systems.ts
function initializeFactionSystems(s) {
  return s.factionSystems ??= { version: 1, fury: s.players.map(() => 0), terrainEffects: [] };
}

// src/core/tactics.ts
var TACTICS = { frontCos: 0.5, sideDamage: 1.2, rearDamage: 1.4, coverFactor: 0.65, shieldFraction: 0.6, shieldReach: 3.5, shieldWidth: 1.4, chargeDistance: 5, chargeBonus: 0.8, pikeReturn: 20, splashRadius: 1.75, captureSeconds: 4, crewHp: 42, retreatMorale: 22, surrenderMorale: 10, scoutDetection: 2.5, contactDetection: 0.8 };
function initializeTactics(s, e) {
  const t = e.tactics ??= { morale: 100, recentLoss: 0 };
  if (e.kind === "unit" && e.role === "siege" && !t.siegeCrew) t.siegeCrew = { hp: TACTICS.crewHp, maxHp: TACTICS.crewHp, uncrewed: false };
  if (e.kind === "unit" && e.role === "melee" && !t.guard && ["dwarves", "tideborn", "automata"].includes(e.definitionFaction ?? s.players[e.side].faction)) t.guard = { value: 40, max: 40, lastDamagedAt: 0 };
  return t;
}

// src/core/objectives.ts
function emptyObjectives(s) {
  return { hill: { x: Math.floor(s.width / 2) + 0.5, y: Math.floor(s.height / 2) + 0.5, ...s.world ? { level: 0 } : {}, ownerTeam: null, captureTeam: null, captureTicks: 0, holdTicks: 0, contested: false }, relics: [], relicHoldTicks: Array(8).fill(0), survival: { wave: 0, nextWaveTick: 0, spawnedIds: [], phase: "waiting" } };
}

// src/core/economy-common.ts
var zeroCost = () => ({ wood: 0, ore: 0, crystal: 0 });
function createEconomyState(playerCount) {
  return { version: 1, groves: [], structures: [], caravans: [], cargo: [], tasks: [], salvage: [], markets: [], villages: [], contracts: [], specializations: [], workerWarehouses: [], deepSites: [], deathClaims: [], paidCosts: [], recruits: [], ledgers: Array.from({ length: playerCount }, () => ({ gathered: zeroCost(), delivered: zeroCost(), traded: zeroCost(), raided: zeroCost(), salvaged: zeroCost(), contractRewards: zeroCost() })) };
}
var levelOf2 = (p) => p.level ?? 0;
var sameLevel2 = (a, b) => levelOf2(a) === levelOf2(b);

// src/core/economy-validation.ts
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var num3 = (v, min = 0, max = 1e4) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
var kinds = ["wood", "ore", "crystal"];
function validateEconomyState(value, c) {
  const fail2 = (path) => {
    throw new Error(`Invalid economy state at ${path}.`);
  };
  const obj2 = (v, p, required, optional = []) => {
    if (!record(v) || required.some((key) => !Object.hasOwn(v, key)) || Object.keys(v).some((key) => ![...required, ...optional].includes(key))) fail2(p);
    return v;
  };
  const n = (v, p, min = 0, max = 1e9, integer = false) => {
    if (!num3(v, min, max) || integer && !Number.isSafeInteger(v)) fail2(p);
    return v;
  };
  const array = (v, p, max = 8192) => {
    if (!Array.isArray(v) || v.length > max) fail2(p);
    return v;
  };
  const unique = (values, p) => {
    if (new Set(values).size !== values.length) fail2(p);
  };
  const identifier2 = (v, p) => n(v, p, 1, c.nextId - 1, true);
  const side = (v, p) => n(v, p, 0, c.playerCount - 1, true);
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
  const choice4 = (v, p, options) => {
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
  array(s.groves, "groves", 1600).forEach((v, i) => {
    const p = `groves[${i}]`, o = obj2(v, p, ["id", "side", "x", "y", "plantedAt", "maturesAt", "burned"], ["resourceId", "level"]);
    groveIds.push(uniqueObjectId(o.id, `${p}.id`));
    side(o.side, `${p}.side`);
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
  array(s.structures, "structures", 1024).forEach((v, i) => {
    const p = `structures[${i}]`, o = obj2(v, p, ["entityId", "kind", "stock", "capacity", "overcharge", "nextIncident"], ["resourceId"]);
    const e = entity(o.entityId, `${p}.entityId`, "building");
    structureIds.push(e.id);
    choice4(o.kind, `${p}.kind`, ["warehouse", "extractor", "deep-mine"]);
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
  unique(structureIds, "structures");
  const caravans = array(s.caravans, "caravans", 1024).map((v, i) => entity(v, `caravans[${i}]`, "unit").id);
  unique(caravans, "caravans");
  const cargoIds = [];
  array(s.cargo, "cargo", 4096).forEach((v, i) => {
    const p = `cargo[${i}]`, o = obj2(v, p, ["entityId", "stock", "capacity", "origin", "tradeValue"], ["sourceId", "destinationId", "contractId"]);
    cargoIds.push(entity(o.entityId, `${p}.entityId`, "unit").id);
    const values = stock(o.stock, `${p}.stock`);
    n(o.capacity, `${p}.capacity`, 0, 1e4);
    if (kinds.reduce((sum, kind) => sum + values[kind], 0) > o.capacity + 1e-7) fail2(`${p}.stock`);
    choice4(o.origin, `${p}.origin`, ["delivery", "trade", "raid", "salvage", "contract"]);
    n(o.tradeValue, `${p}.tradeValue`);
    for (const key of ["sourceId", "destinationId", "contractId"]) if (o[key] !== void 0) identifier2(o[key], `${p}.${key}`);
  });
  unique(cargoIds, "cargo");
  const salvageIds = [];
  array(s.salvage, "salvage", 4096).forEach((v, i) => {
    const p = `salvage[${i}]`, o = obj2(v, p, ["id", "x", "y", "stock", "expiresAt", "owner", "kind"], ["level"]);
    salvageIds.push(uniqueObjectId(o.id, `${p}.id`));
    vector(o, p);
    stock(o.stock, `${p}.stock`);
    n(o.expiresAt, `${p}.expiresAt`, 0, c.time + 120.1);
    if (o.owner !== null) side(o.owner, `${p}.owner`);
    choice4(o.kind, `${p}.kind`, ["salvage", "cargo"]);
  });
  const marketIds = [];
  array(s.markets, "markets", 32).forEach((v, i) => {
    const p = `markets[${i}]`, o = obj2(v, p, ["id", "x", "y", "stock", "demand", "recoverAt"], ["level"]);
    marketIds.push(uniqueObjectId(o.id, `${p}.id`));
    vector(o, p);
    stock(o.stock, `${p}.stock`);
    const demand = obj2(o.demand, `${p}.demand`, kinds);
    for (const kind of kinds) n(demand[kind], `${p}.demand.${kind}`, 0, 1e9);
    n(o.recoverAt, `${p}.recoverAt`, 0, c.time);
  });
  const villages = [];
  array(s.villages, "villages", 32).forEach((v, i) => {
    const p = `villages[${i}]`, o = obj2(v, p, ["id", "x", "y", "rewardPool"], ["level"]);
    const linked = c.world?.sites.some((site) => site.id === o.id && site.kind === "village" && site.level === (o.level ?? 0)) === true;
    villages.push(uniqueObjectId(o.id, `${p}.id`, linked));
    vector(o, p);
    stock(o.rewardPool, `${p}.rewardPool`);
  });
  const contracts = [];
  array(s.contracts, "contracts", 96).forEach((v, i) => {
    const p = `contracts[${i}]`, o = obj2(v, p, ["id", "villageId", "x", "y", "side", "kind", "amount", "delivered", "deadline", "reward", "status"], ["level"]);
    contracts.push(uniqueObjectId(o.id, `${p}.id`));
    if (!villages.includes(identifier2(o.villageId, `${p}.villageId`))) fail2(`${p}.villageId`);
    const village = s.villages.find((v2) => v2.id === o.villageId);
    if ((village.level ?? 0) !== (o.level ?? 0) || village.x !== o.x || village.y !== o.y) fail2(`${p}.villageId`);
    vector(o, p);
    if (o.side !== null) side(o.side, `${p}.side`);
    choice4(o.kind, `${p}.kind`, kinds);
    const amount = n(o.amount, `${p}.amount`, 1, 1e4);
    n(o.delivered, `${p}.delivered`, 0, amount);
    n(o.deadline, `${p}.deadline`, 0, c.time + 180.1);
    stock(o.reward, `${p}.reward`);
    choice4(o.status, `${p}.status`, ["open", "accepted", "complete", "expired"]);
    if ((o.status === "accepted" || o.status === "complete") && o.side === null || o.status === "complete" && o.delivered !== o.amount) fail2(p);
  });
  const taskIds = [];
  array(s.tasks, "tasks", 4096).forEach((v, i) => {
    const p = `tasks[${i}]`, o = obj2(v, p, ["entityId", "kind", "targetId", "progress"], ["sourceId", "repeat", "phase", "amount", "contractId"]);
    const e = entity(o.entityId, `${p}.entityId`, "unit");
    taskIds.push(e.id);
    choice4(o.kind, `${p}.kind`, ["plant", "collect", "raid", "route"]);
    identifier2(o.targetId, `${p}.targetId`);
    n(o.progress, `${p}.progress`, 0, 2);
    if (o.kind === "plant" && !groveIds.includes(o.targetId) || o.kind === "collect" && !salvageIds.includes(o.targetId)) fail2(p);
    if (o.kind === "route") {
      identifier2(o.sourceId, `${p}.sourceId`);
      flag4(o.repeat, `${p}.repeat`);
      choice4(o.phase, `${p}.phase`, ["loading", "delivery"]);
      stock(o.amount, `${p}.amount`);
    }
    if (o.contractId !== void 0 && !contracts.includes(identifier2(o.contractId, `${p}.contractId`))) fail2(`${p}.contractId`);
  });
  unique(taskIds, "tasks");
  const specializationIds = [];
  array(s.specializations, "specializations", 1024).forEach((v, i) => {
    const p = `specializations[${i}]`, o = obj2(v, p, ["entityId", "kind"]);
    const e = entity(o.entityId, `${p}.entityId`, "building");
    if (e.role !== "hq") fail2(p);
    specializationIds.push(e.id);
    choice4(o.kind, `${p}.kind`, ["mining", "military", "research"]);
  });
  unique(specializationIds, "specializations");
  const workerIds = [];
  array(s.workerWarehouses, "workerWarehouses", 4096).forEach((v, i) => {
    const p = `workerWarehouses[${i}]`, o = obj2(v, p, ["entityId", "warehouseId"]), e = entity(o.entityId, `${p}.entityId`, "unit"), w = entity(o.warehouseId, `${p}.warehouseId`, "building");
    if (e.role !== "worker" || caravans.includes(e.id) || e.side !== w.side || !sameLevel2(e, w) || !array(s.structures, "structures").some((item) => record(item) && item.entityId === w.id && item.kind === "warehouse")) fail2(p);
    workerIds.push(e.id);
  });
  unique(workerIds, "workerWarehouses");
  const deep = array(s.deepSites, "deepSites", 8192).map((v, i) => {
    const rid = identifier2(v, `deepSites[${i}]`);
    if (!c.resources.some((r) => r.id === rid && r.kind === "ore")) fail2("deepSites");
    return rid;
  });
  unique(deep, "deepSites");
  const deaths = array(s.deathClaims, "deathClaims", 16384).map((v, i) => identifier2(v, `deathClaims[${i}]`));
  unique(deaths, "deathClaims");
  const paidIds = [];
  array(s.paidCosts, "paidCosts", 16384).forEach((v, i) => {
    const p = `paidCosts[${i}]`, o = obj2(v, p, ["entityId", "stock"]);
    paidIds.push(identifier2(o.entityId, `${p}.entityId`));
    stock(o.stock, `${p}.stock`);
  });
  unique(paidIds, "paidCosts");
  const producerQueues = /* @__PURE__ */ new Map();
  array(s.recruits, "recruits", 3 * c.entities.filter((e) => e.kind === "building" && e.role === "hq").length).forEach((v, i) => {
    const p = `recruits[${i}]`, o = obj2(v, p, ["producerId", "side", "readyAt"]);
    const producer = entity(o.producerId, `${p}.producerId`, "building");
    if (producer.role !== "hq" || producer.side !== side(o.side, `${p}.side`)) fail2(p);
    const count = (producerQueues.get(producer.id) ?? 0) + 1;
    if (count > 3) fail2(p);
    producerQueues.set(producer.id, count);
    n(o.readyAt, `${p}.readyAt`, 0, c.time + 54.1);
  });
  const ledgers = array(s.ledgers, "ledgers", 8);
  if (ledgers.length !== c.playerCount) fail2("ledgers");
  ledgers.forEach((v, i) => {
    const p = `ledgers[${i}]`, fields2 = ["gathered", "delivered", "traded", "raided", "salvaged", "contractRewards"], o = obj2(v, p, fields2);
    for (const key of fields2) stock(o[key], `${p}.${key}`);
  });
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
function veteranRank(experience) {
  return experience >= 200 ? 3 : experience >= 100 ? 2 : experience >= 40 ? 1 : 0;
}

// src/core/team-ai.ts
var TEAM_AI_WAVE_LIFETIME = 12;
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
function validateTeamAiState(value, context) {
  const fail2 = (path, reason) => {
    throw new Error(`Invalid team AI at ${path}: ${reason}.`);
  };
  const object4 = (v, path, required, optional = []) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) fail2(path, "expected a plain object");
    const record2 = v;
    const names = Object.getOwnPropertyNames(record2);
    if (Object.getOwnPropertySymbols(record2).length || names.some((k) => ![...required, ...optional].includes(k)) || required.some((k) => !Object.hasOwn(record2, k))) fail2(path, "unexpected or missing field");
    for (const key of names) if (!("value" in Object.getOwnPropertyDescriptor(record2, key))) fail2(path, "accessors are forbidden");
    return record2;
  };
  const number4 = (v, path, min, max, integer = false) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer && !Number.isSafeInteger(v)) fail2(path, "invalid number");
    return v;
  };
  const list4 = (v, path, max) => {
    if (!Array.isArray(v) || v.length > max || Object.getPrototypeOf(v) !== Array.prototype) fail2(path, "invalid array");
    const source = v, array = [];
    if (Object.getOwnPropertySymbols(source).length || Object.getOwnPropertyNames(source).some((k) => k !== "length" && (!/^(0|[1-9]\d*)$/.test(k) || Number(k) >= source.length))) fail2(path, "unexpected array properties");
    for (let i = 0; i < source.length; i++) {
      const d = Object.getOwnPropertyDescriptor(source, String(i));
      if (!d || !("value" in d)) fail2(path, "array gaps and accessors are forbidden");
      array.push(d.value);
    }
    return array;
  };
  const choice4 = (v, path, choices) => {
    if (typeof v !== "string" || !choices.includes(v)) fail2(path, "unknown value");
    return v;
  };
  const text2 = (v, path, max = 128) => {
    if (typeof v !== "string" || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) fail2(path, "invalid text");
    return v;
  };
  number4(context.playerCount, "context.playerCount", 1, 8, true);
  number4(context.time, "context.time", 0, 1e12);
  number4(context.nextEntityId, "context.nextEntityId", 1, 2147483647, true);
  number4(context.width, "context.width", 1, 256);
  number4(context.height, "context.height", 1, 256);
  number4(context.levels ?? 1, "context.levels", 1, 2, true);
  if (context.teams.length !== context.playerCount) fail2("context.teams", "invalid roster");
  context.teams.forEach((t, i) => number4(t, `context.teams[${i}]`, 0, 7, true));
  const side = (v, path) => number4(v, path, 0, context.playerCount - 1, true);
  const id2 = (v, path) => number4(v, path, 1, context.nextEntityId - 1, true);
  const when = (v, path) => number4(v, path, 0, context.time);
  const position2 = (v, path) => {
    const p = object4(v, path, ["x", "y"], ["level"]);
    return { ...p.level === void 0 ? {} : { level: number4(p.level, `${path}.level`, 0, (context.levels ?? 1) - 1, true) }, x: number4(p.x, `${path}.x`, 0, context.width), y: number4(p.y, `${path}.y`, 0, context.height) };
  };
  const unique = (items, path, read) => {
    const seen = /* @__PURE__ */ new Set();
    return items.map((v, i) => {
      const n = read(v, `${path}[${i}]`);
      if (seen.has(n)) fail2(path, "duplicate ID");
      seen.add(n);
      return n;
    });
  };
  const claimed = /* @__PURE__ */ new Set();
  const assigned = (v, path, owner, active) => unique(list4(v, path, 500), path, id2).map((n) => {
    if (active && context.entitySides && context.entitySides.get(n) !== owner) fail2(path, "assigned entity has a different or missing owner");
    if (active) {
      if (claimed.has(n)) fail2(path, "duplicate active troop assignment");
      claimed.add(n);
    }
    return n;
  });
  const assignedLevel = (ids, destination, path, active = true) => {
    if (active && context.entityLevels && ids.some((id3) => context.entityLevels.get(id3) !== levelOf(destination))) fail2(path, "assigned entity is on a different or missing level");
  };
  const cost2 = (v, path) => {
    const c = object4(v, path, ["wood", "ore", "crystal"]);
    const result = { wood: number4(c.wood, `${path}.wood`, 0, 1e9), ore: number4(c.ore, `${path}.ore`, 0, 1e9), crystal: number4(c.crystal, `${path}.crystal`, 0, 1e9) };
    if (!result.wood && !result.ore && !result.crystal) fail2(path, "empty resources");
    return result;
  };
  const allies = (a, b, path) => {
    if (a === b || context.teams[a] !== context.teams[b]) fail2(path, "expected distinct allies");
  };
  const root2 = object4(value, "state", ["coordinator", "directives", "nextDirectiveId", "nextTransferId", "transfers"]);
  const saved = object4(root2.coordinator, "coordinator", ["nextWaveId", "reservations", "waves"]);
  const nextWaveId = number4(saved.nextWaveId, "coordinator.nextWaveId", 1, 1e12, true), nextDirectiveId = number4(root2.nextDirectiveId, "nextDirectiveId", 1, 1e12, true), nextTransferId = number4(root2.nextTransferId, "nextTransferId", 1, 1e12, true);
  const reservationKeys = /* @__PURE__ */ new Set();
  const reservations = list4(saved.reservations, "coordinator.reservations", MAX_TEAM_AI_RESERVATIONS).map((v, i) => {
    const path = `coordinator.reservations[${i}]`, r = object4(v, path, ["teamId", "side", "role", "key", "destination", "ids", "createdAt", "expiresAt"]);
    const owner = side(r.side, `${path}.side`), teamId = number4(r.teamId, `${path}.teamId`, 0, 7, true);
    if (context.teams[owner] !== teamId) fail2(path, "reservation team differs from owner");
    const role = choice4(r.role, `${path}.role`, ["scout", "expand"]), key = text2(r.key, `${path}.key`), slot = `${teamId}:${role}`;
    if (reservationKeys.has(slot)) fail2(path, "duplicate reservation role");
    reservationKeys.add(slot);
    const ids = assigned(r.ids, `${path}.ids`, owner, true);
    if (role === "scout" ? ids.length !== 1 : ids.length !== 0) fail2(path, "invalid role assignment");
    const createdAt = when(r.createdAt, `${path}.createdAt`), expiresAt = number4(r.expiresAt, `${path}.expiresAt`, createdAt, createdAt + (role === "scout" ? TEAM_AI_SCOUT_LEASE : TEAM_AI_EXPANSION_LEASE));
    const destination = position2(r.destination, `${path}.destination`);
    assignedLevel(ids, destination, `${path}.ids`);
    return { teamId, side: owner, role, key, destination, ids, createdAt, expiresAt };
  });
  const waveIds = /* @__PURE__ */ new Set(), waveTeams = /* @__PURE__ */ new Set();
  const waves = list4(saved.waves, "coordinator.waves", MAX_TEAM_AI_WAVES).map((v, i) => {
    const path = `coordinator.waves[${i}]`, w = object4(v, path, ["id", "teamId", "target", "participants", "launchAt", "expiresAt", "launched"]), waveId = number4(w.id, `${path}.id`, 1, nextWaveId - 1, true), teamId = number4(w.teamId, `${path}.teamId`, 0, 7, true);
    if (waveIds.has(waveId) || waveTeams.has(teamId)) fail2(path, "duplicate wave ID or team");
    waveIds.add(waveId);
    waveTeams.add(teamId);
    const t = object4(w.target, `${path}.target`, ["key", "kind", "observer", "seenAt", "x", "y"], ["level"]), observer = side(t.observer, `${path}.target.observer`);
    if (context.teams[observer] !== teamId) fail2(path, "target observer is not allied");
    const target = { ...position2({ x: t.x, y: t.y, ...t.level === void 0 ? {} : { level: t.level } }, `${path}.target.position`), key: text2(t.key, `${path}.target.key`), kind: choice4(t.kind, `${path}.target.kind`, ["hq", "building", "unit", "start"]), observer, seenAt: when(t.seenAt, `${path}.target.seenAt`) };
    const participantSides = /* @__PURE__ */ new Set(), troopIds = /* @__PURE__ */ new Set();
    const participants = list4(w.participants, `${path}.participants`, 8).map((v2, j) => {
      const ppath = `${path}.participants[${j}]`, p = object4(v2, ppath, ["side", "ids"]), owner = side(p.side, `${ppath}.side`);
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
    const launchAt = number4(w.launchAt, `${path}.launchAt`, 0, context.time + TEAM_AI_WAVE_LIFETIME), expiresAt = number4(w.expiresAt, `${path}.expiresAt`, launchAt, context.time + TEAM_AI_WAVE_LIFETIME);
    if (typeof w.launched !== "boolean") fail2(path, "invalid launched flag");
    if (w.launched && launchAt > context.time) fail2(path, "launched wave has a future launch time");
    return { id: waveId, teamId, target, participants, launchAt, expiresAt, launched: w.launched };
  });
  const directiveIds = /* @__PURE__ */ new Set(), activeRecipients = /* @__PURE__ */ new Set();
  const directives = list4(root2.directives, "directives", MAX_TEAM_DIRECTIVES).map((v, i) => {
    const path = `directives[${i}]`, d = object4(v, path, ["id", "issuer", "recipient", "kind", "createdAt", "expiresAt", "status", "assigned"], ["destination", "observedTarget", "resources", "arrivedAt", "reason"]);
    const directiveId = number4(d.id, `${path}.id`, 1, nextDirectiveId - 1, true);
    if (directiveIds.has(directiveId)) fail2(path, "duplicate directive ID");
    directiveIds.add(directiveId);
    const issuer = side(d.issuer, `${path}.issuer`), recipient = side(d.recipient, `${path}.recipient`);
    allies(issuer, recipient, path);
    const kind = choice4(d.kind, `${path}.kind`, ["defend", "scout", "attack", "support"]), status = choice4(d.status, `${path}.status`, ["accepted", "active", "completed", "failed", "cancelled"]);
    if (status === "accepted" || status === "active") {
      if (activeRecipients.has(recipient)) fail2(path, "duplicate active recipient");
      activeRecipients.add(recipient);
    }
    const createdAt = when(d.createdAt, `${path}.createdAt`), expiresAt = number4(d.expiresAt, `${path}.expiresAt`, createdAt, createdAt + 180);
    const result = { id: directiveId, issuer, recipient, kind, createdAt, expiresAt, status, assigned: assigned(d.assigned, `${path}.assigned`, recipient, status === "accepted" || status === "active") };
    if (kind === "support") {
      if (d.destination !== void 0 || d.observedTarget !== void 0 || result.assigned.length) fail2(path, "support cannot assign troops or a destination");
      result.resources = cost2(d.resources, `${path}.resources`);
    } else {
      if (d.resources !== void 0) fail2(path, "only support has resources");
      result.destination = position2(d.destination, `${path}.destination`);
      assignedLevel(result.assigned, result.destination, `${path}.assigned`, status === "accepted" || status === "active");
    }
    if (d.observedTarget !== void 0) {
      if (kind !== "attack") fail2(path, "only attack has an observed target");
      result.observedTarget = id2(d.observedTarget, `${path}.observedTarget`);
    }
    if (d.arrivedAt !== void 0) result.arrivedAt = number4(d.arrivedAt, `${path}.arrivedAt`, createdAt, context.time);
    if (d.reason !== void 0) result.reason = text2(d.reason, `${path}.reason`, 160);
    return result;
  });
  const transferIds = /* @__PURE__ */ new Set();
  const transfers = list4(root2.transfers, "transfers", MAX_TEAM_TRANSFERS).map((v, i) => {
    const path = `transfers[${i}]`, t = object4(v, path, ["id", "sender", "recipient", "resources", "time"]), transferId = number4(t.id, `${path}.id`, 1, nextTransferId - 1, true);
    if (transferIds.has(transferId)) fail2(path, "duplicate transfer ID");
    transferIds.add(transferId);
    const sender = side(t.sender, `${path}.sender`), recipient = side(t.recipient, `${path}.recipient`);
    allies(sender, recipient, path);
    return { id: transferId, sender, recipient, resources: cost2(t.resources, `${path}.resources`), time: when(t.time, `${path}.time`) };
  });
  return { coordinator: { nextWaveId, reservations, waves }, nextDirectiveId, directives, nextTransferId, transfers };
}

// src/core/simulation.ts
var runtimes = /* @__PURE__ */ new WeakMap();
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
  return { ...hasTeamAiMemory(r.teamAI) ? { teamAI: structuredClone(r.teamAI) } : {}, aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => [...memory].map(([id2, o]) => [id2, { ...o }])), retreating: r.retreating.map((memory) => [...memory].map(([id2, o]) => [id2, { ...o }])), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits: r.hits.map((h) => ({ source: h.source.id, target: h.target.id, amount: h.amount, event: s.events.indexOf(h.event) })), routes: [...r.routes].map(([id2, value]) => [id2, { ...value }]), abilities: [...r.abilities], returning: [...r.returning], queuedGather: [...r.queuedGather], aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => [...memory].map(([id2, p]) => [id2, { ...p }])), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => [...players]), searched: r.searched.map((tiles) => [...tiles]) };
}
function restoreRuntime(s, r) {
  const entities = new Map(s.entities.map((e) => [e.id, e]));
  const hits = r.hits.map((h) => {
    const source = entities.get(h.source), target = entities.get(h.target), event = s.events[h.event];
    if (!source || !target || !event) throw new Error("Save runtime has an invalid hit reference.");
    return { source, target, amount: h.amount, event };
  });
  runtimes.set(s, { teamAI: r.teamAI ? structuredClone(r.teamAI) : emptyTeamAiState(), aiBatchTurns: r.aiBatchTurns, aiDecisionAt: [...r.aiDecisionAt], aiDecisionTurns: [...r.aiDecisionTurns], knownEnemyUnits: r.knownEnemyUnits.map((memory) => new Map(memory.map(([id2, o]) => [id2, { ...o }]))), retreating: r.retreating.map((memory) => new Map(memory.map(([id2, o]) => [id2, { ...o }]))), producedFighters: [...r.producedFighters], fog: r.fog, ai: r.ai, aiTurns: r.aiTurns, hits, routes: new Map(r.routes.map(([id2, value]) => [id2, { ...value }])), abilities: new Map(r.abilities), returning: new Set(r.returning), queuedGather: new Set(r.queuedGather), aiWave: [...r.aiWave], initialScoutDispatched: [...r.initialScoutDispatched], expansionScout: [...r.expansionScout], expansionScoutDispatched: [...r.expansionScoutDispatched], knownEnemyBuildings: r.knownEnemyBuildings.map((memory) => new Map(memory.map(([id2, p]) => [id2, { ...p }]))), enemyStartCleared: [...r.enemyStartCleared], clearedEnemyStarts: r.clearedEnemyStarts.map((players) => new Set(players)), searched: r.searched.map((tiles) => new Set(tiles)) });
}
var MAX_ORDER_QUEUE = 32;

// src/core/scenario-validation.ts
var unitRoles2 = ["worker", "melee", "ranged", "special", "cavalry", "spear", "siege"];
var buildingRoles2 = ["hq", "depot", "barracks", "tower", "wall", "gate"];
function bad(path, reason) {
  throw new Error(`Invalid scenario at ${path}: ${reason}.`);
}
function object(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) bad(path, "expected a plain object");
  const record2 = value;
  for (const key of required) if (!Object.hasOwn(record2, key)) bad(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record2)) if (!required.includes(key) && !optional.includes(key)) bad(`${path}.${key}`, "unknown field");
  return record2;
}
function number(value, path, min = 0, max = 1e9, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) bad(path, `expected ${integer ? "an integer" : "a number"} between ${min} and ${max}`);
  return value;
}
function text(value, path, max = 4096) {
  if (typeof value !== "string" || value.length < 1 || value.length > max) bad(path, "invalid text");
  return value;
}
function identifier(value, path) {
  const id2 = text(value, path, 96);
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(id2) || ["constructor", "prototype", "__proto__"].includes(id2)) bad(path, "invalid identifier");
  return id2;
}
function choice(value, path, values) {
  if (typeof value !== "string" || !values.includes(value)) bad(path, "unknown value");
  return value;
}
function flag(value, path) {
  if (typeof value !== "boolean") bad(path, "expected a boolean");
  return value;
}
function list(value, path, max, min = 0) {
  if (!Array.isArray(value) || value.length < min || value.length > max) bad(path, "invalid array length");
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) bad(path, "array contains gaps");
  return value;
}
function scenarioJson(input, limits = {}) {
  let nodes = 0;
  const ancestors = /* @__PURE__ */ new Set();
  const copy = (value2, depth) => {
    if (++nodes > (limits.maxNodes ?? 1e5) || depth > 24) bad("package", "package is too large or deeply nested");
    if (value2 === null || typeof value2 === "boolean" || typeof value2 === "string") return value2;
    if (typeof value2 === "number" && Number.isFinite(value2)) return value2;
    if (!value2 || typeof value2 !== "object") bad("package", "expected bounded JSON data");
    if (ancestors.has(value2)) bad("package", "cyclic reference");
    ancestors.add(value2);
    let result;
    if (Array.isArray(value2)) {
      if (value2.length > (limits.maxArrayLength ?? 65536) || Object.getOwnPropertySymbols(value2).length) bad("package", "array is too large or contains symbols");
      for (const key of Object.getOwnPropertyNames(value2)) {
        if (!("value" in Object.getOwnPropertyDescriptor(value2, key))) bad("package", "accessors are forbidden");
        if (key !== "length") {
          const index = Number(key);
          if (!Number.isSafeInteger(index) || index < 0 || index >= value2.length || String(index) !== key) bad("package", "invalid array properties");
        }
      }
      result = Array.from({ length: value2.length }, (_, index) => {
        const property = Object.getOwnPropertyDescriptor(value2, String(index));
        if (!property || !("value" in property)) bad("package", "accessors and gaps are forbidden");
        return copy(property.value, depth + 1);
      });
    } else {
      if (Object.getPrototypeOf(value2) !== Object.prototype || Object.getOwnPropertySymbols(value2).length) bad("package", "expected a plain object");
      const record2 = {};
      for (const key of Object.keys(value2)) {
        if (["constructor", "prototype", "__proto__"].includes(key)) bad("package", "unsafe property");
        const property = Object.getOwnPropertyDescriptor(value2, key);
        if (!("value" in property)) bad("package", "accessors are forbidden");
        if (property.value !== void 0) record2[key] = copy(property.value, depth + 1);
      }
      result = record2;
    }
    ancestors.delete(value2);
    return result;
  };
  const value = copy(input, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > (limits.maxBytes ?? 2 * 1024 * 1024)) bad("package", "package exceeds its size limit");
  return value;
}
function validateScenario(input, options = {}) {
  let raw = input;
  if (typeof raw === "string") {
    if (raw.length > 2 * 1024 * 1024) bad("package", "package exceeds 2 MiB");
    try {
      raw = JSON.parse(raw);
    } catch {
      bad("package", "invalid JSON");
    }
  }
  const value = scenarioJson(raw);
  const s = object(value, "definition", ["schemaVersion", "id", "title", "briefing", "successText", "failureText", "faction", "opponent", "seed", "army", "objectives", "events", "rules"], ["content", "map", "escort", "stealth", "boss", "requiredActions"]);
  if (s.schemaVersion !== 1) bad("schemaVersion", "unsupported version");
  identifier(s.id, "id");
  for (const key of ["title", "briefing", "successText", "failureText"]) text(s[key], key);
  const content = s.content === void 0 ? void 0 : options.historicalContent ? decodeHistoricalContentBundle(s.content) : decodeContentBundle(s.content);
  const factions = contentFactions(content);
  if (content) s.content = content;
  const faction = choice(s.faction, "faction", Object.keys(factions));
  const opponent = choice(s.opponent, "opponent", Object.keys(factions));
  const seed = number(s.seed, "seed", 0, 4294967295, true);
  let map;
  if (s.map !== void 0) {
    const m = object(s.map, "map", ["size", "width", "height", "terrain", "starts", "resources"], ["world"]);
    choice(m.size, "map.size", Object.keys(MAP_SIZES));
    const width = number(m.width, "map.width", 8, 128, true), height = number(m.height, "map.height", 8, 128, true);
    list(m.terrain, "map.terrain", width * height, width * height).forEach((tile, i) => choice(tile, `map.terrain[${i}]`, Object.keys(TERRAIN)));
    map = m;
    if (m.world !== void 0) {
      const validator = validateWorldMap;
      const validation = validator(m.world, { scenario: true });
      if (!validation.valid) bad("map.world", validation.issues.join("; "));
    }
    list(m.starts, "map.starts", 2, 2).forEach((p, i) => point2(p, `map.starts[${i}]`));
    list(m.resources, "map.resources", 1024).forEach((resource, i) => {
      const path = `map.resources[${i}]`, r = object(resource, path, ["x", "y", "kind", "amount", "maxAmount"], ["level"]);
      coordinates2(r, path);
      choice(r.kind, `${path}.kind`, ["wood", "ore", "crystal"]);
      const max = number(r.maxAmount, `${path}.maxAmount`, 1, 1e7);
      number(r.amount, `${path}.amount`, 0, max);
    });
    if (m.world !== void 0) {
      const generate = generatedMapFromWorld;
      const flattened = generate(map.world, 2, { scenario: true });
      if (map.world.seed !== seed || flattened.width !== map.width || flattened.height !== map.height || flattened.size !== map.size || JSON.stringify(flattened.terrain) !== JSON.stringify(map.terrain)) bad("map.world", "layered map disagrees with the scenario ground map");
      if (JSON.stringify(flattened.starts.map((p) => [p.x, p.y, p.level ?? 0])) !== JSON.stringify(map.starts.map((p) => [p.x, p.y, p.level ?? 0])) || JSON.stringify(flattened.resources.map((r) => [r.x, r.y, r.level ?? 0, r.kind, r.amount, r.maxAmount])) !== JSON.stringify(map.resources.map((r) => [r.x, r.y, r.level ?? 0, r.kind, r.amount, r.maxAmount]))) bad("map.world", "layered starts or resources disagree with the scenario map");
    }
  } else {
    const generated = generateMap(seed, "small");
    map = { size: generated.size, width: generated.width, height: generated.height, terrain: generated.terrain, starts: generated.starts, resources: generated.resources };
  }
  function coordinates2(record2, path) {
    number(record2.x, `${path}.x`, 0.5, map.width - 0.5);
    number(record2.y, `${path}.y`, 0.5, map.height - 0.5);
    if (record2.level !== void 0) number(record2.level, `${path}.level`, 0, (map.world?.levels.length ?? 1) - 1, true);
  }
  function point2(v, path) {
    coordinates2(object(v, path, ["x", "y"], ["level"]), path);
  }
  const actorLabels = /* @__PURE__ */ new Set(), actorByLabel = /* @__PURE__ */ new Map();
  function actor(v, path) {
    const a = object(v, path, ["label", "side", "kind", "role", "x", "y"], ["hp", "order", "definitionId", "level"]);
    const label = identifier(a.label, `${path}.label`);
    if (actorLabels.has(label)) bad(`${path}.label`, "duplicate actor label");
    actorLabels.add(label);
    actorByLabel.set(label, a);
    number(a.side, `${path}.side`, 0, 1, true);
    const kind = choice(a.kind, `${path}.kind`, ["unit", "building"]);
    const role = choice(a.role, `${path}.role`, kind === "unit" ? unitRoles2 : buildingRoles2);
    coordinates2(a, path);
    const def = factions[a.side === 0 ? faction : opponent];
    const id2 = a.definitionId;
    if (id2 !== void 0 && (typeof id2 !== "string" || id2.length > 100 || !/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(id2))) bad(`${path}.definitionId`, "expected a registered definition ID");
    const roster = kind === "unit" ? def.unitDefinitions ?? Object.values(def.units) : def.buildingDefinitions ?? Object.values(def.buildings);
    const definition = id2 === void 0 ? kind === "unit" ? def.units[role] : def.buildings[role] : roster.find((d) => d.id === id2);
    if (!definition || definition.role !== role) bad(`${path}.definitionId`, "definition is absent from the actor faction or has another kind or role");
    if (a.hp !== void 0) number(a.hp, `${path}.hp`, 1, definition.hp);
    const radius = kind === "building" ? definition.size / 2 : 0.27;
    for (let y = Math.floor(a.y - radius); y <= Math.floor(a.y + radius); y++) for (let x = Math.floor(a.x - radius); x <= Math.floor(a.x + radius); x++) {
      const terrain = map.world?.levels[a.level ?? 0].terrain ?? map.terrain;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || !TERRAIN[terrain[y * map.width + x]].walkable) bad(path, "actor is on impassable terrain");
    }
  }
  list(s.army, "army", 256, 1).forEach((v, i) => actor(v, `army[${i}]`));
  const events = list(s.events, "events", 128);
  for (const [i, event] of events.entries()) {
    const e = object(event, `events[${i}]`, ["id", "when", "actions"], ["repeat"]);
    list(e.actions, `events[${i}].actions`, 16, 1).forEach((a, j) => {
      if (a && typeof a === "object" && a.type === "spawn") {
        if (e.repeat !== void 0) bad(`events[${i}]`, "repeated spawn labels are ambiguous; author separate waves");
        const spawn = object(a, `events[${i}].actions[${j}]`, ["type", "actors"]);
        list(spawn.actors, `events[${i}].actors`, 128, 1).forEach((v, k) => actor(v, `events[${i}].actors[${k}]`));
      }
    });
  }
  if (s.boss !== void 0) {
    const boss = object(s.boss, "boss", ["actor", "name", "health", "phases"]);
    list(boss.phases, "boss.phases", 8, 2).forEach((phase, i) => {
      const p = object(phase, `boss.phases[${i}]`, ["below", "name", "radius", "damage", "warningSeconds", "cooldown", "interruptDamage", "adds"]);
      list(p.adds, `boss.phases[${i}].adds`, 32).forEach((v, j) => actor(v, `boss.phases[${i}].adds[${j}]`));
    });
  }
  function reference(v, path) {
    if (!actorLabels.has(identifier(v, path))) bad(path, "unknown actor label");
  }
  function condition(v, path, depth = 0) {
    if (depth > 8) bad(path, "condition nesting exceeds eight levels");
    const c = object(v, path, ["type"], ["actor", "point", "radius", "seconds", "key", "op", "value", "side", "buildings", "conditions", "condition"]);
    switch (c.type) {
      case "alive":
      case "dead":
        object(v, path, ["type", "actor"]);
        reference(c.actor, `${path}.actor`);
        break;
      case "at":
        object(v, path, ["type", "actor", "point", "radius"]);
        reference(c.actor, `${path}.actor`);
        point2(c.point, `${path}.point`);
        number(c.radius, `${path}.radius`, 0.5, 32);
        break;
      case "time":
        object(v, path, ["type", "seconds"]);
        number(c.seconds, `${path}.seconds`, 0, 7200);
        break;
      case "variable":
        object(v, path, ["type", "key", "op", "value"]);
        identifier(c.key, `${path}.key`);
        choice(c.op, `${path}.op`, ["eq", "gte", "lte"]);
        number(c.value, `${path}.value`, -1e9, 1e9);
        break;
      case "cleared":
        object(v, path, ["type", "side"], ["buildings"]);
        number(c.side, `${path}.side`, 0, 1, true);
        if (c.buildings !== void 0) flag(c.buildings, `${path}.buildings`);
        break;
      case "all":
      case "any":
        object(v, path, ["type", "conditions"]);
        list(c.conditions, `${path}.conditions`, 16, 1).forEach((child, i) => condition(child, `${path}.conditions[${i}]`, depth + 1));
        break;
      case "not":
        object(v, path, ["type", "condition"]);
        condition(c.condition, `${path}.condition`, depth + 1);
        break;
      default:
        bad(`${path}.type`, "unknown condition");
    }
  }
  function order2(v, path) {
    const o = object(v, path, ["type"], ["x", "y", "actor", "level"]);
    switch (o.type) {
      case "move":
      case "attackMove":
        object(v, path, ["type", "x", "y"], ["level"]);
        coordinates2(o, path);
        break;
      case "attack":
        object(v, path, ["type", "actor"]);
        reference(o.actor, `${path}.actor`);
        break;
      case "stop":
      case "hold":
      case "ability":
        object(v, path, ["type"]);
        break;
      default:
        bad(`${path}.type`, "unknown order");
    }
  }
  for (const [label, a] of actorByLabel) if (a.order) order2(a.order, `actor.${label}.order`);
  const objectiveIds = /* @__PURE__ */ new Set();
  list(s.objectives, "objectives", 32, 1).forEach((v, i) => {
    const p = `objectives[${i}]`, o = object(v, p, ["id", "text", "success"], ["failure", "optional"]), id2 = identifier(o.id, `${p}.id`);
    if (objectiveIds.has(id2)) bad(`${p}.id`, "duplicate objective");
    objectiveIds.add(id2);
    text(o.text, `${p}.text`);
    condition(o.success, `${p}.success`);
    if (o.failure !== void 0) condition(o.failure, `${p}.failure`);
    if (o.optional !== void 0) flag(o.optional, `${p}.optional`);
  });
  if (s.objectives.every((o) => o.optional)) bad("objectives", "at least one objective must be required");
  const eventIds = /* @__PURE__ */ new Set();
  for (const [i, v] of events.entries()) {
    const p = `events[${i}]`, e = v, id2 = identifier(e.id, `${p}.id`);
    if (eventIds.has(id2)) bad(`${p}.id`, "duplicate event");
    eventIds.add(id2);
    condition(e.when, `${p}.when`);
    if (e.repeat !== void 0) {
      const r = object(e.repeat, `${p}.repeat`, ["seconds", "count"]);
      number(r.seconds, `${p}.repeat.seconds`, 1, 3600);
      number(r.count, `${p}.repeat.count`, 1, 256, true);
    }
    e.actions.forEach((v2, j) => {
      const path = `${p}.actions[${j}]`, a = object(v2, path, ["type"], ["actors", "order", "key", "value", "text", "speaker", "side", "resources", "outcome", "reason", "allied"]);
      switch (a.type) {
        case "spawn":
          object(v2, path, ["type", "actors"]);
          break;
        case "alliance":
          object(v2, path, ["type", "allied"]);
          flag(a.allied, `${path}.allied`);
          break;
        case "order":
          object(v2, path, ["type", "actors", "order"]);
          list(a.actors, `${path}.actors`, 256, 1).forEach((label, k) => reference(label, `${path}.actors[${k}]`));
          order2(a.order, `${path}.order`);
          break;
        case "set":
        case "add":
          object(v2, path, ["type", "key", "value"]);
          identifier(a.key, `${path}.key`);
          number(a.value, `${path}.value`, -1e6, 1e6);
          break;
        case "message":
          object(v2, path, ["type", "text"], ["speaker"]);
          text(a.text, `${path}.text`);
          if (a.speaker !== void 0) text(a.speaker, `${path}.speaker`, 96);
          break;
        case "reward":
          object(v2, path, ["type", "side", "resources"]);
          number(a.side, `${path}.side`, 0, 1, true);
          resources(a.resources, `${path}.resources`);
          break;
        case "finish":
          object(v2, path, ["type", "outcome", "reason"]);
          choice(a.outcome, `${path}.outcome`, ["won", "lost"]);
          text(a.reason, `${path}.reason`);
          break;
        default:
          bad(`${path}.type`, "unknown action");
      }
    });
  }
  function resources(v, p) {
    const r = object(v, p, ["wood", "ore", "crystal"]);
    for (const key of ["wood", "ore", "crystal"]) number(r[key], `${p}.${key}`, 0, 1e6);
  }
  const rules = object(s.rules, "rules", ["fixedArmy", "reinforcementBudget", "resources", "timeLimit"]);
  flag(rules.fixedArmy, "rules.fixedArmy");
  number(rules.reinforcementBudget, "rules.reinforcementBudget", 0, 256, true);
  resources(rules.resources, "rules.resources");
  number(rules.timeLimit, "rules.timeLimit", 1, 7200);
  if (rules.fixedArmy && rules.reinforcementBudget !== 0) bad("rules.reinforcementBudget", "fixed armies cannot recruit");
  if (s.escort !== void 0) {
    const e = object(s.escort, "escort", ["actor", "route", "radius", "escortRadius"]);
    reference(e.actor, "escort.actor");
    if (actorByLabel.get(e.actor)?.kind !== "unit") bad("escort.actor", "escort must be a moving unit");
    list(e.route, "escort.route", 64, 2).forEach((v, i) => point2(v, `escort.route[${i}]`));
    number(e.radius, "escort.radius", 0.5, 5);
    number(e.escortRadius, "escort.escortRadius", 1, 32);
  }
  if (s.stealth !== void 0) {
    const t = object(s.stealth, "stealth", ["infiltrators", "guards", "alarmLimit", "detectionSeconds", "radius", "coneDegrees", "patrols"]);
    for (const group of ["infiltrators", "guards"]) list(t[group], `stealth.${group}`, 64, 1).forEach((label, i) => reference(label, `stealth.${group}[${i}]`));
    number(t.alarmLimit, "stealth.alarmLimit", 1, 16, true);
    number(t.detectionSeconds, "stealth.detectionSeconds", 0.1, 10);
    number(t.radius, "stealth.radius", 1, 16);
    number(t.coneDegrees, "stealth.coneDegrees", 15, 360);
    list(t.patrols, "stealth.patrols", 64).forEach((v, i) => {
      const p = `stealth.patrols[${i}]`, patrol = object(v, p, ["actor", "route"]);
      reference(patrol.actor, `${p}.actor`);
      list(patrol.route, `${p}.route`, 32, 2).forEach((pointValue, j) => point2(pointValue, `${p}.route[${j}]`));
    });
  }
  if (s.boss !== void 0) {
    const b = s.boss;
    reference(b.actor, "boss.actor");
    text(b.name, "boss.name", 96);
    number(b.health, "boss.health", 100, 1e6);
    const bossActor = actorByLabel.get(b.actor);
    if (bossActor.side !== 1 || bossActor.kind !== "unit" || !s.army.some((a) => a.label === bossActor.label)) bad("boss.actor", "boss must be a hostile targetable unit in the initial army");
    let prior = Infinity;
    b.phases.forEach((v, i) => {
      const p = `boss.phases[${i}]`, phase = v, below = number(phase.below, `${p}.below`, 0, 1);
      if (i === 0 && below !== 1 || below >= prior) bad(`${p}.below`, "phase thresholds must start at one and decrease");
      prior = below;
      text(phase.name, `${p}.name`, 96);
      number(phase.radius, `${p}.radius`, 1, 16);
      number(phase.damage, `${p}.damage`, 1, 1e3);
      number(phase.warningSeconds, `${p}.warningSeconds`, 0.5, 10);
      number(phase.cooldown, `${p}.cooldown`, 2, 60);
      number(phase.interruptDamage, `${p}.interruptDamage`, 1, 1e4);
    });
  }
  if (s.requiredActions !== void 0) list(s.requiredActions, "requiredActions", 8).forEach((v, i) => {
    const p = `requiredActions[${i}]`, a = object(v, p, ["action", "count", "text"], ["ability"]);
    choice(a.action, `${p}.action`, ["ability", "hold", "repair", "gather"]);
    if (a.ability !== void 0) {
      if (a.action !== "ability") bad(`${p}.ability`, "only ability actions can declare an ability");
      choice(a.ability, `${p}.ability`, Object.keys(ABILITIES));
    }
    number(a.count, `${p}.count`, 1, 256, true);
    text(a.text, `${p}.text`);
  });
  return value;
}

// src/core/versions.ts
var SIMULATION_REVISION = "4.0.1";

// src/core/scenarios.ts
function validateScenarioBinding(input, state, historicalContent = false) {
  const binding = scenarioJson(input);
  if (!binding || typeof binding !== "object" || Array.isArray(binding) || Object.keys(binding).some((key) => !["definition", "runtime", "simulationRevision"].includes(key)) || !Object.hasOwn(binding, "definition") || !Object.hasOwn(binding, "runtime") || binding.simulationRevision !== void 0 && (typeof binding.simulationRevision !== "string" || !/^\d+\.\d+\.\d+$/.test(binding.simulationRevision) || binding.simulationRevision.length > 80)) throw new Error("Invalid saved scenario binding.");
  const definition = validateScenario(binding.definition, { historicalContent });
  validateRuntime(definition, state, binding.runtime);
  return { definition, runtime: binding.runtime, ...binding.simulationRevision === void 0 ? {} : { simulationRevision: binding.simulationRevision } };
}
function validateRuntime(definition, state, runtime2) {
  const fail2 = (reason) => {
    throw new Error(`Invalid scenario runtime: ${reason}.`);
  };
  const fields2 = ["version", "lastEvaluatedTick", "definitionId", "outcome", "reason", "labels", "variables", "triggers", "completed", "messages", "reinforcementRemaining", "escort", "stealth", "boss", "commandCounts"];
  if (!runtime2 || typeof runtime2 !== "object" || Array.isArray(runtime2) || fields2.some((key) => !Object.hasOwn(runtime2, key)) || Object.keys(runtime2).some((key) => !fields2.includes(key))) fail2("unknown or missing field");
  if (runtime2.version !== 1 || runtime2.definitionId !== definition.id || !["playing", "won", "lost"].includes(runtime2.outcome) || typeof runtime2.reason !== "string" || runtime2.reason.length > 4096) fail2("identity or outcome");
  if (state.players.length !== 2 || state.players[0].faction !== definition.faction || state.players[1].faction !== definition.opponent || state.seed !== definition.seed || state.rules.mode !== "scenario" || state.rules.standardDefeat || definition.content?.hash !== state.content?.hash) fail2("match identity");
  if (runtime2.outcome === "playing" && (state.winner !== null || state.draw) || runtime2.outcome === "won" && state.winner !== 0 || runtime2.outcome === "lost" && state.winner !== 1) fail2("result disagrees with simulation");
  const finite = (n, min = 0, max = 1e9, integer = false) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isSafeInteger(n));
  if (!finite(runtime2.lastEvaluatedTick, 0, state.tick, true)) fail2("evaluated tick");
  const record2 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
  const exact = (value, keys) => record2(value) && keys.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys.includes(key));
  const counters = (value, max = 1e9, negative = false) => record2(value) && Object.keys(value).length <= 2048 && Object.entries(value).every(([key, n]) => /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(key) && finite(n, negative ? -1e9 : 0, max));
  const actors = [...definition.army, ...definition.events.flatMap((e) => e.actions.flatMap((a) => a.type === "spawn" ? a.actors : [])), ...definition.boss?.phases.flatMap((p) => p.adds) ?? []];
  const labels = new Set(actors.map((a) => a.label));
  if (!record2(runtime2.labels) || Object.entries(runtime2.labels).some(([label, id2]) => !labels.has(label) || !finite(id2, 1, state.nextId - 1, true)) || new Set(Object.values(runtime2.labels)).size !== Object.values(runtime2.labels).length || definition.army.some((a) => !Object.hasOwn(runtime2.labels, a.label))) fail2("actor references");
  for (const [label, id2] of Object.entries(runtime2.labels)) {
    const e = state.entities.find((e2) => e2.id === id2), a = actors.find((a2) => a2.label === label);
    if (e && (e.side !== a.side || e.kind !== a.kind || e.role !== a.role || a.definitionId !== void 0 && e.definitionId !== a.definitionId)) fail2("actor ownership or definition changed");
  }
  if (!counters(runtime2.variables, 1e9, true) || !counters(runtime2.commandCounts) || !finite(runtime2.reinforcementRemaining, 0, definition.rules.reinforcementBudget, true)) fail2("variables or reinforcement budget");
  if (!record2(runtime2.triggers)) fail2("trigger record");
  for (const [id2, entry] of Object.entries(runtime2.triggers)) {
    const e = definition.events.find((e2) => e2.id === id2);
    if (!e || !exact(entry, ["count", "lastTime"]) || !finite(entry.count, 1, e.repeat?.count ?? 1, true) || !finite(entry.lastTime, 0, state.time)) fail2("trigger schedule");
  }
  if (!Array.isArray(runtime2.completed) || runtime2.completed.some((id2) => !definition.objectives.some((o) => o.id === id2)) || new Set(runtime2.completed).size !== runtime2.completed.length) fail2("objective progress");
  if (!Array.isArray(runtime2.messages) || runtime2.messages.length > 128 || runtime2.messages.some((m) => !record2(m) || Object.keys(m).some((k) => !["time", "text", "speaker"].includes(k)) || !finite(m.time, 0, state.time) || typeof m.text !== "string" || m.text.length > 4096 || m.speaker !== void 0 && (typeof m.speaker !== "string" || m.speaker.length > 96))) fail2("messages");
  if (!exact(runtime2.escort, ["checkpoint", "moving"]) || !finite(runtime2.escort.checkpoint, 0, definition.escort?.route.length ?? 0, true) || typeof runtime2.escort.moving !== "boolean") fail2("escort progress");
  const stealth = runtime2.stealth;
  if (!exact(stealth, ["alarms", "exposure", "detected", "patrol", "distractedUntil"]) || !finite(stealth.alarms, 0, definition.stealth?.alarmLimit ?? 0, true) || !counters(stealth.exposure, 10) || !counters(stealth.patrol, 31) || !counters(stealth.distractedUntil) || !Array.isArray(stealth.detected) || stealth.detected.some((label) => !definition.stealth?.infiltrators.includes(label)) || new Set(stealth.detected).size !== stealth.detected.length) fail2("stealth progress");
  if (Object.keys(stealth.patrol).some((label) => {
    const p = definition.stealth?.patrols.find((p2) => p2.actor === label);
    return !p || !finite(stealth.patrol[label], 0, p.route.length - 1, true);
  })) fail2("patrol waypoint");
  const boss = runtime2.boss;
  if (!exact(boss, ["phase", "nextAttack", "telegraph", "phasesEntered", "interrupted", "hits", "dodged"]) || !finite(boss.phase, -1, (definition.boss?.phases.length ?? 0) - 1, true) || !finite(boss.nextAttack) || !Array.isArray(boss.phasesEntered) || boss.phasesEntered.some((n, i) => n !== i || n > boss.phase) || !finite(boss.interrupted, 0, 1e6, true) || !finite(boss.hits, 0, 1e6, true) || !finite(boss.dodged, 0, 1e6, true)) fail2("boss progress");
  if (boss.telegraph !== null) {
    const t = boss.telegraph;
    const keys = ["x", "y", "radius", "resolveAt", "source", "phase", "hpAtStart", "interrupted", ...t.level === void 0 ? [] : ["level"]];
    if (!definition.boss || !exact(t, keys) || !finite(t.x, 0, state.width) || !finite(t.y, 0, state.height) || t.level !== void 0 && !finite(t.level, 0, (state.world?.levels.length ?? 1) - 1, true) || !finite(t.radius, 1, 16) || !finite(t.resolveAt, 0, state.time + 10) || t.source !== runtime2.labels[definition.boss.actor] || !finite(t.phase, 0, boss.phase, true) || !finite(t.hpAtStart, 0, definition.boss.health) || typeof t.interrupted !== "boolean") fail2("boss telegraph");
  }
}

// src/core/specialist-validation.ts
var MAX_ID = 2147483647;
var MAX_RECORDS = 8192;
var SLOTS = ["weapon", "armor", "trinket"];
var PREPARED = { "incendiary-shell": "incendiary", "rooting-shell": "rooting", "corpse-shell": "corpse", "flood-shell": "flood" };
function bad2(path, detail) {
  throw new Error(`Invalid save at ${path}: ${detail}.`);
}
function object2(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad2(path, "expected an object");
  const record2 = value;
  for (const key of required) if (!Object.hasOwn(record2, key)) bad2(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record2)) if (!required.includes(key) && !optional.includes(key)) bad2(`${path}.${key}`, "unknown field");
  return record2;
}
function number2(value, path, min = 0, max = MAX_ID, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) bad2(path, `expected ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function flag2(value, path) {
  if (typeof value !== "boolean") bad2(path, "expected a boolean");
  return value;
}
function choice2(value, path, values) {
  if (typeof value !== "string" || !values.includes(value)) bad2(path, "unknown value");
  return value;
}
function list2(value, path, max) {
  if (!Array.isArray(value) || value.length > max) bad2(path, "invalid array length");
  return value;
}
function position(value, path, s, extraRequired = [], extraOptional = []) {
  const p = object2(value, path, ["x", "y", ...extraRequired], ["level", ...extraOptional]);
  number2(p.x, `${path}.x`, 0, s.width);
  number2(p.y, `${path}.y`, 0, s.height);
  if (p.level !== void 0) {
    const level = number2(p.level, `${path}.level`, 0, 1, true);
    if (level !== 0 && !s.world?.levels[level]) bad2(`${path}.level`, "world level is absent");
  }
  return p;
}
function realUnit(e) {
  return e.kind === "unit" && !e.illusion && !e.raised;
}
function equipmentEligible(s, e) {
  return realUnit(e) && (e.role === "special" || !!unitFor(s, e).tags?.some((tag) => tag === "hero" || tag === "engineer"));
}
function unitRole(s, e) {
  return unitFor(s, e).role;
}
function validateVeteran(s, e, path) {
  if (e.veteran === void 0) return;
  const p = `${path}.veteran`, v = object2(e.veteran, p, ["experience", "rank", "nextSurvivalAt", "lastCombatAt", "promotions"], ["pendingPromotion"]);
  if (!realUnit(e)) bad2(p, "only real units can earn experience");
  const xp = number2(v.experience, `${p}.experience`, 0, 300), rank = number2(v.rank, `${p}.rank`, 0, 3, true);
  if (rank !== veteranRank(xp)) bad2(`${p}.rank`, "rank differs from earned experience");
  number2(v.nextSurvivalAt, `${p}.nextSurvivalAt`, 0, s.time + 60);
  number2(v.lastCombatAt, `${p}.lastCombatAt`, 0, s.time);
  const promotions = list2(v.promotions, `${p}.promotions`, 3);
  promotions.forEach((value, i) => {
    const q = `${p}.promotions[${i}]`, promotion = object2(value, q, ["rank", "id"]);
    if (number2(promotion.rank, `${q}.rank`, 1, 3, true) !== i + 1 || i + 1 > rank) bad2(`${q}.rank`, "promotions must follow earned ranks in order");
    const id2 = choice2(promotion.id, `${q}.id`, Object.keys(PROMOTIONS));
    if (!PROMOTIONS[id2].roles.includes(unitRole(s, e))) bad2(`${q}.id`, "promotion does not apply to this unit role");
  });
  const pending = promotions.length < rank ? promotions.length + 1 : void 0;
  if (v.pendingPromotion !== pending) bad2(`${p}.pendingPromotion`, "expected the first unchosen earned rank");
}
function validateBuffs(s, e, path) {
  if (e.specialistBuffs === void 0) return;
  if (!realUnit(e)) bad2(`${path}.specialistBuffs`, "only real units can receive specialist buffs");
  list2(e.specialistBuffs, `${path}.specialistBuffs`, 64).forEach((value, i) => {
    const p = `${path}.specialistBuffs[${i}]`, buff = object2(value, p, ["until"], ["damageFactor", "speedFactor", "armor", "rooted", "fearedFrom"]);
    number2(buff.until, `${p}.until`, 0, s.time + 30);
    if (Object.keys(buff).length === 1) bad2(p, "a buff requires an effect");
    for (const key of ["damageFactor", "speedFactor"]) if (buff[key] !== void 0) number2(buff[key], `${p}.${key}`, 0, 4);
    if (buff.armor !== void 0) number2(buff.armor, `${p}.armor`, 0, 100);
    if (buff.rooted !== void 0) flag2(buff.rooted, `${p}.rooted`);
    if (buff.fearedFrom !== void 0) position(buff.fearedFrom, `${p}.fearedFrom`, s);
  });
}
function validateSiege(s, e, path) {
  if (e.siegeMode === void 0) return;
  const p = `${path}.siegeMode`, mode = object2(e.siegeMode, p, ["ammo", "deployed"], ["prepared"]);
  if (!realUnit(e) || e.role !== "siege") bad2(p, "siege preparation requires a real siege unit");
  const ability = unitFor(s, e).ability ?? "", ammo = number2(mode.ammo, `${p}.ammo`, 0, ability === "powered-beam" ? 8 : 10, true), deployed = flag2(mode.deployed, `${p}.deployed`);
  if (ability === "ammunition-cannon") {
    if (mode.prepared !== void 0) bad2(`${p}.prepared`, "cannon uses ammunition rather than prepared shells");
  } else if (ability === "powered-beam") {
    if (deployed || mode.prepared !== void 0) bad2(p, "beam has no deployment or prepared shell state");
  } else if (Object.hasOwn(PREPARED, ability)) {
    if (ammo !== 0 || deployed) bad2(p, "prepared shells have no ammunition or deployment state");
    if (mode.prepared !== void 0 && mode.prepared !== PREPARED[ability]) bad2(`${p}.prepared`, "prepared shell differs from the unit ability");
  } else bad2(p, "unit has no siege preparation ability");
}
function validateBurning(s, e, path, entities) {
  if (e.burning === void 0) return;
  list2(e.burning, `${path}.burning`, 64).forEach((value, i) => {
    const p = `${path}.burning[${i}]`, fire = object2(value, p, ["source", "side", "until", "nextAt", "damage"], ["origin"]);
    const source = number2(fire.source, `${p}.source`, 1, s.nextId - 1, true), side = number2(fire.side, `${p}.side`, 0, s.players.length - 1, true);
    const actor = entities.get(source);
    if (actor && actor.side !== side && !(actor.kind === "unit" && actor.role === "siege" && actor.definitionFaction !== void 0)) bad2(`${p}.side`, "fire side differs from the source entity");
    number2(fire.until, `${p}.until`, 0, s.time + 6);
    number2(fire.nextAt, `${p}.nextAt`, 0, s.time + 1);
    number2(fire.damage, `${p}.damage`, Number.MIN_VALUE, 100);
    if (fire.origin !== void 0) position(fire.origin, `${p}.origin`, s);
  });
}
function validateBeacon(s, e, path) {
  if (e.beacon === void 0) return;
  const p = `${path}.beacon`, beacon2 = object2(e.beacon, p, ["connected", "nextAlertAt"]);
  if (e.kind !== "building" || !buildingFor(s, e).tags?.includes("beacon")) bad2(p, "beacon state requires a signal beacon");
  flag2(beacon2.connected, `${p}.connected`);
  number2(beacon2.nextAlertAt, `${p}.nextAlertAt`, 0, s.time + 8);
}
function validateArtifacts(s, state, entities) {
  const records2 = /* @__PURE__ */ new Map(), held = /* @__PURE__ */ new Map(), counter = number2(state.nextArtifactId, "state.specialists.nextArtifactId", 1, MAX_ID, true);
  list2(state.artifacts, "state.specialists.artifacts", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.artifacts[${i}]`, item = object2(value, p, ["id", "definitionId"], ["owner", "holder", "position"]), id2 = number2(item.id, `${p}.id`, 1, counter - 1, true);
    if (records2.has(id2)) bad2(`${p}.id`, "duplicate artifact id");
    records2.set(id2, item);
    choice2(item.definitionId, `${p}.definitionId`, Object.keys(ARTIFACTS));
    if (item.holder !== void 0) {
      const holderId = number2(item.holder, `${p}.holder`, 1, s.nextId - 1, true), holder = entities.get(holderId);
      if (!holder || holder.hp <= 0 || !equipmentEligible(s, holder)) bad2(`${p}.holder`, "artifact requires a living hero or specialist holder");
      number2(item.owner, `${p}.owner`, 0, s.players.length - 1, true);
      if (item.owner !== holder.side) bad2(`${p}.owner`, "artifact owner differs from its holder");
      if (item.position !== void 0) bad2(`${p}.position`, "held artifacts cannot also have a ground position");
      held.set(holderId, (held.get(holderId) ?? 0) + 1);
      if (held.get(holderId) > 12) bad2(`${p}.holder`, "holder inventory exceeds twelve artifacts");
    } else {
      if (item.owner !== void 0) bad2(`${p}.owner`, "ground artifacts cannot have an owner");
      position(item.position, `${p}.position`, s);
    }
  });
  return records2;
}
function validateEquipment(s, e, path, artifacts, equipped) {
  if (e.equipment === void 0) return;
  const p = `${path}.equipment`, equipment = object2(e.equipment, p, [], SLOTS);
  if (e.hp <= 0 || !equipmentEligible(s, e)) bad2(p, "equipment requires a living hero or specialist");
  for (const slot of SLOTS) if (equipment[slot] !== void 0) {
    const id2 = number2(equipment[slot], `${p}.${slot}`, 1, MAX_ID, true), item = artifacts.get(id2);
    if (!item || item.holder !== e.id || item.owner !== e.side) bad2(`${p}.${slot}`, "equipped artifact must belong to this holder");
    const def = ARTIFACTS[item.definitionId];
    if (def.slot !== slot || !def.roles.includes(unitRole(s, e))) bad2(`${p}.${slot}`, "artifact does not match this slot or unit role");
    if (equipped.has(id2)) bad2(`${p}.${slot}`, "artifact is equipped more than once");
    equipped.add(id2);
  }
}
function validateStructures(s, state, entities) {
  const counter = number2(state.nextStructureId, "state.specialists.nextStructureId", 1, MAX_ID, true), ids = /* @__PURE__ */ new Set(), tiles = /* @__PURE__ */ new Set(), barricades = /* @__PURE__ */ new Set();
  list2(state.structures, "state.specialists.structures", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.structures[${i}]`, record2 = object2(value, p, ["id", "kind", "owner", "expires"], ["entityId", "tiles"]), id2 = number2(record2.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id2)) bad2(`${p}.id`, "duplicate temporary structure id");
    ids.add(id2);
    const kind = choice2(record2.kind, `${p}.kind`, ["bridge", "barricade"]), owner = number2(record2.owner, `${p}.owner`, 0, s.players.length - 1, true);
    number2(record2.expires, `${p}.expires`, 0, s.time + 60);
    if (kind === "barricade") {
      if (record2.tiles !== void 0) bad2(`${p}.tiles`, "barricades reference an entity rather than terrain tiles");
      const entityId = number2(record2.entityId, `${p}.entityId`, 1, s.nextId - 1, true), entity = entities.get(entityId);
      if (!entity || entity.kind !== "building" || entity.side !== owner || !buildingFor(s, entity).tags?.includes("barricade")) bad2(`${p}.entityId`, "temporary barricade must reference its owned barricade entity");
      if (barricades.has(entityId)) bad2(`${p}.entityId`, "barricade entity is referenced more than once");
      barricades.add(entityId);
    } else {
      if (record2.entityId !== void 0) bad2(`${p}.entityId`, "bridges reference terrain tiles rather than an entity");
      const points = list2(record2.tiles, `${p}.tiles`, 3);
      if (points.length !== 3) bad2(`${p}.tiles`, "temporary bridge requires three tiles");
      let previous;
      points.forEach((value2, j) => {
        const q = `${p}.tiles[${j}]`, point2 = position(value2, q, s, ["previous", "placed"], ["stamp"]);
        if (point2.x % 1 !== 0.5 || point2.y % 1 !== 0.5) bad2(q, "bridge tiles must use tile centers");
        if (point2.stamp !== void 0) number2(point2.stamp, `${q}.stamp`, 0, 1e12, true);
        choice2(point2.previous, `${q}.previous`, ["water", "shallows", "grass", "road"]);
        if (point2.placed !== "bridge") bad2(`${q}.placed`, "temporary bridge must place bridge terrain");
        if (previous && (point2.x !== previous.x + 1 || point2.y !== previous.y || (point2.level ?? 0) !== (previous.level ?? 0))) bad2(q, "bridge tiles must be consecutive on the same level");
        const key = `${point2.level ?? 0}:${point2.x}:${point2.y}`;
        if (tiles.has(key)) bad2(q, "temporary bridge tiles overlap");
        tiles.add(key);
        previous = point2;
      });
    }
  });
  for (const e of s.entities) if (e.hp > 0 && e.kind === "building" && buildingFor(s, e).tags?.includes("barricade") && !barricades.has(e.id)) bad2("state.specialists.structures", "living barricade has no temporary structure record");
}
function validateShots(s, state) {
  const counter = state.nextShotId === void 0 ? 1 : number2(state.nextShotId, "state.specialists.nextShotId", 1, MAX_ID, true), ids = /* @__PURE__ */ new Set();
  if (state.shots === void 0) return;
  list2(state.shots, "state.specialists.shots", MAX_RECORDS).forEach((value, i) => {
    const p = `state.specialists.shots[${i}]`, shot = object2(value, p, ["id", "source", "target", "impactAt", "rawDamage", "buildingMultiplier", "payload"], ["modification"]);
    const id2 = number2(shot.id, `${p}.id`, 1, counter - 1, true);
    if (ids.has(id2)) bad2(`${p}.id`, "duplicate siege shot id");
    ids.add(id2);
    const source = position(shot.source, `${p}.source`, s, ["id", "side", "definitionId", "faction"], ["elevation"]);
    number2(source.id, `${p}.source.id`, 1, s.nextId - 1, true);
    number2(source.side, `${p}.source.side`, 0, s.players.length - 1, true);
    choice2(source.faction, `${p}.source.faction`, Object.keys(contentFactions(s.content)));
    if (typeof source.definitionId !== "string" || source.definitionId.length > 100) bad2(`${p}.source.definitionId`, "invalid definition ID");
    let ability;
    try {
      ability = unitFor(s, { ...source, kind: "unit", role: "siege", definitionFaction: source.faction }).ability;
    } catch {
      bad2(`${p}.source.definitionId`, "shot source must resolve a siege definition in its original faction");
    }
    if (source.elevation !== void 0) number2(source.elevation, `${p}.source.elevation`, 0, 3);
    if (shot.modification !== void 0) choice2(shot.modification, `${p}.modification`, ["stone", "grapeshot", "incendiary", "reinforced"]);
    const target = position(shot.target, `${p}.target`, s);
    if ((target.level ?? 0) !== (source.level ?? 0)) bad2(`${p}.target.level`, "siege shots cannot cross world levels");
    number2(shot.impactAt, `${p}.impactAt`, 0, s.time + 30);
    number2(shot.rawDamage, `${p}.rawDamage`, 0, 1e9);
    number2(shot.buildingMultiplier, `${p}.buildingMultiplier`, 0.1, 10);
    const payload = object2(shot.payload, `${p}.payload`, ["kind", "damageFactor", "armorPiercing", "radius"]), kind = choice2(payload.kind, `${p}.payload.kind`, ["incendiary", "rooting", "corpse", "flood", "beam", "cannon"]);
    const expectedKind = ability === "ammunition-cannon" ? "cannon" : ability === "powered-beam" ? "beam" : PREPARED[ability ?? ""];
    if (kind !== expectedKind) bad2(`${p}.payload.kind`, "siege payload differs from its source ability");
    const expectedFactor = kind === "cannon" ? 1.5 : kind === "corpse" ? 1.4 : 1, expectedRadius = kind === "cannon" || kind === "beam" ? 0 : kind === "corpse" ? 2.5 : 2;
    if (payload.damageFactor !== expectedFactor) bad2(`${p}.payload.damageFactor`, "siege payload has an invalid damage factor");
    if (payload.armorPiercing !== (kind === "beam")) bad2(`${p}.payload.armorPiercing`, "siege payload has an invalid armor-piercing flag");
    if (payload.radius !== expectedRadius) bad2(`${p}.payload.radius`, "siege payload has an invalid radius");
  });
}
function validateHeroes(s) {
  for (let side = 0; side < s.players.length; side++) {
    const p = `state.players[${side}].heroRecovery`, player = s.players[side], heroes = availableUnits(s, side).filter((def) => def.tags?.includes("hero")), heroIds = new Set(heroes.map((def) => def.id));
    let active = 0;
    for (const e of s.entities) if (e.side === side && e.hp > 0) {
      if (realUnit(e) && unitFor(s, e).tags?.includes("hero")) active++;
      if (e.kind === "building") for (let i = 0; i < e.queue.length; i++) {
        const def = unitFor(s, side, e.queue[i], e.queueDefinitionIds?.[i]);
        if (def.tags?.includes("hero")) active++;
      }
    }
    if (active > 1) bad2(`state.players[${side}]`, "a player cannot have multiple living or queued commanders");
    if (player.heroRecovery === void 0) continue;
    const seen = /* @__PURE__ */ new Set();
    list2(player.heroRecovery, p, heroes.length).forEach((value, i) => {
      const q = `${p}[${i}]`, recovery = object2(value, q, ["definitionId", "availableAt"]), id2 = choice2(recovery.definitionId, `${q}.definitionId`, [...heroIds]);
      if (seen.has(id2)) bad2(`${q}.definitionId`, "duplicate commander recovery");
      seen.add(id2);
      const at = number2(recovery.availableAt, `${q}.availableAt`, 0, s.time + 30);
      if (active && at > s.time) bad2(`${q}.availableAt`, "a recovering commander cannot already be alive or queued");
    });
  }
}
function validateSpecialists(s) {
  const entities = new Map(s.entities.map((e) => [e.id, e])), equipped = /* @__PURE__ */ new Set();
  let artifacts = /* @__PURE__ */ new Map();
  if (s.specialists !== void 0) {
    const state = object2(s.specialists, "state.specialists", ["artifacts", "structures", "nextArtifactId", "nextStructureId"], ["shots", "nextShotId"]);
    artifacts = validateArtifacts(s, state, entities);
    validateStructures(s, state, entities);
    validateShots(s, state);
  }
  if (s.specialists === void 0 && s.entities.some((e) => e.hp > 0 && e.kind === "building" && buildingFor(s, e).tags?.includes("barricade"))) bad2("state.specialists", "living barricade requires temporary structure records");
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
  const record2 = (v, path, fields2, optional = []) => {
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
  const world = record2(input, "state", ["version", "biome", "levels", "transitions", "bridges", "fires", "sites", "creatures", "dayLength", "seasonLength", "weatherLength", "nextEnvironmentAt", "iceTiles", "thawWarned"], ["revision"]);
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
  const ids = /* @__PURE__ */ new Set(), id2 = (v, path, allocate = true) => {
    const n = number4(v, path, 1, nextId - 1, true);
    if (allocate) {
      if (ids.has(n)) fail2(`${path}duplicate`);
      ids.add(n);
    }
    return n;
  };
  const cost2 = (v, path) => {
    const c = record2(v, path, ["wood", "ore", "crystal"]);
    for (const kind of ["wood", "ore", "crystal"]) number4(c[kind], `${path}.${kind}`, 0, 1e9);
  };
  for (let i = 0; i < levels.length; i++) {
    const l = record2(levels[i], `levels${i}`, ["id", "title", "terrain", "elevation"]);
    if (l.id !== i || typeof l.title !== "string" || l.title.length > 80) fail2(`levels${i}.id/title`);
    const terrain = list4(l.terrain, `levels${i}.terrain`, area), elevation = list4(l.elevation, `levels${i}.elevation`, area);
    if (terrain.length !== area || elevation.length !== area) fail2(`levels${i}.dimensions`);
    terrain.forEach((t, j) => {
      if (typeof t !== "string" || !Object.hasOwn(TERRAIN, t)) fail2(`levels${i}.terrain${j}`);
    });
    elevation.forEach((e, j) => number4(e, `levels${i}.elevation${j}`, 0, 3, true));
  }
  const transitionIds = /* @__PURE__ */ new Set();
  for (const [i, v] of list4(world.transitions, "transitions", 64).entries()) {
    const t = record2(v, `transition${i}`, ["id", "from", "to"]), n = number4(t.id, `transition${i}.id`, 1, 2147483647, true);
    if (transitionIds.has(n)) fail2(`transition${i}.duplicate`);
    transitionIds.add(n);
    for (const field of ["from", "to"]) coord(record2(t[field], `transition${i}.${field}`, ["x", "y", "level"]), `transition${i}.${field}`);
    if (t.from.level === t.to.level) fail2(`transition${i}.levels`);
  }
  for (const [i, v] of list4(world.bridges, "bridges", 512).entries()) {
    const b = record2(v, `bridge${i}`, ["id", "x", "y", "level", "hp", "maxHp", "tiles", "rebuilding", "repairSide"]);
    id2(b.id, `bridge${i}.id`);
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
    const f = record2(v, `fire${i}`, ["x", "y", "level", "heat", "expires", "nextSpread"]);
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
    const site = record2(v, `site${i}`, ["id", "x", "y", "level", "kind", "owner", "loyalty", "progress", "capturing", "reward", "rewarded", "request", "supplied", "creatureIds", "respawnAt"]);
    siteIds.add(id2(site.id, `site${i}.id`));
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
      const target = id2(n, `site${i}.creatureId`, false);
      if (creatureRefs.has(target)) fail2(`site${i}.duplicateCreature`);
      creatureRefs.add(target);
    }
    number4(site.respawnAt, `site${i}.respawnAt`);
  }
  const creatures = list4(world.creatures, "creatures", 2048), creatureIds = /* @__PURE__ */ new Set();
  for (const [i, v] of creatures.entries()) {
    const creature = record2(v, `creature${i}`, ["id", "site", "x", "y", "level", "hp", "maxHp", "cooldown", "target", "path", "patrol", "respawnAt"]), n = id2(creature.id, `creature${i}.id`);
    creatureIds.add(n);
    coord(creature, `creature${i}`);
    if (!siteIds.has(number4(creature.site, `creature${i}.site`, 1, nextId - 1, true))) fail2(`creature${i}.site`);
    const max = number4(creature.maxHp, `creature${i}.maxHp`, 1, 1e9);
    number4(creature.hp, `creature${i}.hp`, 0, max);
    for (const field of ["cooldown", "patrol", "respawnAt"]) number4(creature[field], `creature${i}.${field}`);
    if (creature.target !== null) id2(creature.target, `creature${i}.target`, false);
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
    const ice = record2(v, `ice${i}`, ["level", "tile"]);
    number4(ice.level, `ice${i}.level`, 0, levels.length - 1, true);
    number4(ice.tile, `ice${i}.tile`, 0, area - 1, true);
    const k = `${ice.level},${ice.tile}`;
    if (iceKeys.has(k)) fail2(`ice${i}.duplicate`);
    iceKeys.add(k);
  }
  for (const field of ["dayLength", "seasonLength", "weatherLength"]) number4(world[field], field, 0.05, 1e6);
  number4(world.nextEnvironmentAt, "nextEnvironmentAt");
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
function bad3(path, detail) {
  throw new Error(`Invalid save at ${path}: ${detail}.`);
}
function object3(value, path, required, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad3(path, "expected an object");
  const record2 = value;
  for (const key of required) if (!Object.hasOwn(record2, key)) bad3(`${path}.${key}`, "missing field");
  for (const key of Object.keys(record2)) if (!required.includes(key) && !optional.includes(key)) bad3(`${path}.${key}`, "unknown field");
  return record2;
}
function number3(value, path, min = 0, max = MAX_VALUE, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) bad3(path, `expected ${integer ? "an integer" : "a finite number"} between ${min} and ${max}`);
  return value;
}
function flag3(value, path) {
  if (typeof value !== "boolean") bad3(path, "expected a boolean");
  return value;
}
function choice3(value, path, choices) {
  if (typeof value !== "string" || !choices.includes(value)) bad3(path, "unknown value");
  return value;
}
function list3(value, path, max, length) {
  if (!Array.isArray(value) || value.length > max || length !== void 0 && value.length !== length) bad3(path, "invalid array length");
  return value;
}
function optionalNumber(record2, key, path, min = 0, max = MAX_VALUE, integer = false) {
  if (record2[key] !== void 0) number3(record2[key], `${path}.${key}`, min, max, integer);
}
function optionalFlag(record2, key, path) {
  if (record2[key] !== void 0) flag3(record2[key], `${path}.${key}`);
}
function id(value, path, c) {
  return number3(value, path, 1, c.nextId - 1, true);
}
function point(value, path, c) {
  const p = object3(value, path, ["x", "y"], ["level"]);
  number3(p.x, `${path}.x`, 0, c.width);
  number3(p.y, `${path}.y`, 0, c.height);
  optionalNumber(p, "level", path, 0, c.levels - 1, true);
}
function coordinates(value, path, c) {
  number3(value.x, `${path}.x`, 0, c.width);
  number3(value.y, `${path}.y`, 0, c.height);
  optionalNumber(value, "level", path, 0, c.levels - 1, true);
}
function order(value, path, c) {
  const o = object3(value, path, ["type"], ["x", "y", "target", "transition", "level"]);
  choice3(o.type, `${path}.type`, ["idle", "hold", "move", "attackMove", "attack", "gather", "build", "traverse", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"]);
  if (o.type === "move" || o.type === "attackMove") {
    object3(value, path, ["type", "x", "y"], ["level"]);
    coordinates(o, path, c);
  } else if (["attack", "gather", "build", "worldAttack", "repairBridge", "captureSite", "supportVillage", "recruitVillage"].includes(o.type)) {
    object3(value, path, ["type", "target"]);
    id(o.target, `${path}.target`, c);
  } else if (o.type === "traverse") {
    object3(value, path, ["type", "transition"]);
    number3(o.transition, `${path}.transition`, 1, 2147483647, true);
  } else object3(value, path, ["type"]);
}
function uniqueIds(values, path, max) {
  const result = /* @__PURE__ */ new Set();
  values.forEach((v, i) => {
    const n = number3(v, `${path}[${i}]`, 0, max, true);
    if (result.has(n)) bad3(path, "duplicate value");
    result.add(n);
  });
  return result;
}
function fog(value, path, c) {
  return list3(value, path, c.playerCount, c.playerCount).map((v, i) => uniqueIds(list3(v, `${path}[${i}]`, c.cells), `${path}[${i}]`, c.cells - 1));
}
function validateEntity(value, path, c) {
  const e = object3(value, path, ["id", "side", "kind", "role", "x", "y", "hp", "maxHp", "order", "cooldown", "progress", "queue", "trainProgress", "researchProgress", "facing", "animation", "animTime", "momentum", "illusion", "expires", "carried", "carriedKind", "path"], ["tactics", "factionState", "level", "definitionId", "definitionFaction", "queueDefinitionIds", "queuePaidCosts", "orderQueue", "research", "researchPaidCost", "rally", "gateOpen", "lastAttacker", "abilityReadyAt", "entrenchedAt", "raised", "shield", "maxShield", "lastDamagedAt", "surgeUntil", "veteran", "equipment", "specialistBuffs", "siegeMode", "burning", "beacon"]);
  const entityId = id(e.id, `${path}.id`, c);
  if (c.entityIds.has(entityId)) bad3(`${path}.id`, "duplicate entity or resource id");
  c.entityIds.add(entityId);
  c.entities.set(entityId, e);
  number3(e.side, `${path}.side`, 0, c.playerCount - 1, true);
  choice3(e.kind, `${path}.kind`, ["unit", "building"]);
  choice3(e.role, `${path}.role`, e.kind === "unit" ? UNIT_ROLES : BUILDING_ROLES);
  coordinates(e, path, c);
  const maxHp = number3(e.maxHp, `${path}.maxHp`, Number.MIN_VALUE, 1e9);
  number3(e.hp, `${path}.hp`, 0, maxHp);
  order(e.order, `${path}.order`, c);
  for (const key of ["cooldown", "animTime", "expires"]) number3(e[key], `${path}.${key}`);
  for (const key of ["progress", "trainProgress"]) number3(e[key], `${path}.${key}`, 0, 1);
  number3(e.researchProgress, `${path}.researchProgress`, 0, 2);
  number3(e.facing, `${path}.facing`, 0, 7, true);
  choice3(e.animation, `${path}.animation`, ["idle", "walk", "attack", "death"]);
  number3(e.momentum, `${path}.momentum`, 0, 1);
  flag3(e.illusion, `${path}.illusion`);
  number3(e.carried, `${path}.carried`, 0, 18);
  choice3(e.carriedKind, `${path}.carriedKind`, RESOURCE_KINDS2);
  if (e.definitionFaction !== void 0) {
    choice3(e.definitionFaction, `${path}.definitionFaction`, Object.keys(contentFactions(c.state.content)));
    if (!c.state.players.some((player) => player.faction === e.definitionFaction) || e.kind !== "unit" || !e.illusion && e.raised !== true && e.role !== "siege" && (e.role === "worker" || e.tactics?.surrenderedTo !== e.side)) bad3(`${path}.definitionFaction`, "original faction requires a captured engine, surrendered combat troop or admitted summon from a match faction");
  }
  if (e.definitionId !== void 0) {
    if (typeof e.definitionId !== "string" || e.definitionId.length > 100) bad3(`${path}.definitionId`, "invalid ID");
    try {
      entityDefinition(c.state, e);
    } catch {
      bad3(`${path}.definitionId`, "definition is absent from the pinned faction or has another role");
    }
  }
  if (e.definitionFaction !== void 0 && !e.illusion && e.maxHp !== entityDefinition(c.state, e).hp) bad3(`${path}.maxHp`, "captured troop health capacity differs from its original definition");
  const queue = list3(e.queue, `${path}.queue`, 5);
  queue.forEach((role, i) => {
    choice3(role, `${path}.queue[${i}]`, UNIT_ROLES);
    if (e.kind !== "building" || e.role !== "hq" && e.role !== "barracks" || e.role === "hq" && role !== "worker" || e.role === "barracks" && role === "worker") bad3(`${path}.queue`, "invalid producer or recruit");
  });
  if (e.queueDefinitionIds !== void 0) {
    list3(e.queueDefinitionIds, `${path}.queueDefinitionIds`, 5, queue.length).forEach((id2, i) => {
      const def = availableUnits(c.state, e.side).find((d) => d.id === id2);
      if (!def || def.role !== queue[i]) bad3(`${path}.queueDefinitionIds[${i}]`, "definition is absent from the pinned faction or has another role");
    });
  } else if (c.state.content && queue.length) bad3(`${path}.queueDefinitionIds`, "pinned production requires definition IDs");
  if (e.queuePaidCosts !== void 0) {
    list3(e.queuePaidCosts, `${path}.queuePaidCosts`, 5, queue.length).forEach((value2, i) => {
      const paid = object3(value2, `${path}.queuePaidCosts[${i}]`, ["wood", "ore", "crystal"]);
      for (const key of RESOURCE_KINDS2) number3(paid[key], `${path}.queuePaidCosts[${i}].${key}`, 0, 1e5);
      const expected = availableUnits(c.state, e.side).find((d) => d.id === e.queueDefinitionIds?.[i])?.cost;
      if (!expected || RESOURCE_KINDS2.some((key) => paid[key] !== expected[key])) bad3(`${path}.queuePaidCosts[${i}]`, "paid cost differs from pinned definition");
    });
  } else if (c.state.content && queue.length) bad3(`${path}.queuePaidCosts`, "pinned production requires charged cost records");
  list3(e.path, `${path}.path`, c.cells * 16).forEach((p, i) => point(p, `${path}.path[${i}]`, c));
  if (e.orderQueue !== void 0) {
    if (e.kind !== "unit" || e.illusion) bad3(`${path}.orderQueue`, "only real units can queue orders");
    list3(e.orderQueue, `${path}.orderQueue`, MAX_ORDER_QUEUE).forEach((o, i) => order(o, `${path}.orderQueue[${i}]`, c));
  }
  if (e.research !== void 0) {
    const upgrades = upgradesFor(c.state, e.side);
    choice3(e.research, `${path}.research`, Object.keys(upgrades));
    if (e.kind !== "building" || upgrades[e.research].building !== e.role) bad3(`${path}.research`, "wrong research building");
  }
  if (e.research !== void 0 && upgradesFor(c.state, e.side)[e.research].exclusiveGroup && e.researchPaidCost === void 0) bad3(`${path}.researchPaidCost`, "exclusive research requires the original charged cost");
  if (e.researchPaidCost !== void 0) {
    if (e.research === void 0) bad3(`${path}.researchPaidCost`, "charged research cost requires pending research");
    const paid = object3(e.researchPaidCost, `${path}.researchPaidCost`, ["wood", "ore", "crystal"]), expected = upgradesFor(c.state, e.side)[e.research].cost;
    for (const key of RESOURCE_KINDS2) {
      number3(paid[key], `${path}.researchPaidCost.${key}`, 0, 1e5);
      if (paid[key] !== expected[key]) bad3(`${path}.researchPaidCost`, "charged cost differs from pinned research");
    }
  }
  if (e.rally !== void 0) point(e.rally, `${path}.rally`, c);
  for (const key of ["gateOpen", "raised"]) optionalFlag(e, key, path);
  if (e.raised === true) {
    const original = contentFactions(c.state.content)[e.definitionFaction ?? c.state.players[e.side].faction], definition = entityDefinition(c.state, e);
    const healthFactor = e.illusion ? 0.4 : 1, lifetime = e.illusion ? 15 : 35;
    if (e.kind !== "unit" || e.role !== "melee" || c.version === 4 && !(original.unitDefinitions ?? Object.values(original.units)).some((d) => d.ability === "raise") || !(original.unitDefinitions ?? Object.values(original.units)).some((d) => d.role === "melee" && d.id === definition.id) || e.maxHp !== definition.hp * healthFactor || e.expires <= 0 || e.expires > c.time + lifetime + 1e-8) bad3(`${path}.raised`, "raised troops require an admitted raising faction melee definition and their summon lifetime");
  }
  if (e.lastAttacker !== void 0) id(e.lastAttacker, `${path}.lastAttacker`, c);
  for (const key of ["abilityReadyAt", "entrenchedAt", "lastDamagedAt", "surgeUntil", "shield", "maxShield"]) optionalNumber(e, key, path);
  if (e.factionState !== void 0) validateFactionUnit(e.factionState, `${path}.factionState`, c, e);
  if (e.tactics !== void 0) validateTactics(e.tactics, `${path}.tactics`, c, e);
  if (e.shield !== void 0 && e.shield > (e.maxShield ?? 0)) bad3(`${path}.shield`, "shield exceeds capacity");
  if (e.maxShield !== void 0) {
    const capacity = e.kind === "unit" ? entityDefinition(c.state, e).shield : e.factionState?.power ? 80 : void 0;
    if (capacity === void 0 || e.maxShield !== capacity) bad3(`${path}.maxShield`, "shield capacity differs from admitted definition or power network");
  }
}
function validateBody(value, path, c) {
  const body = object3(value, path, ["id", "x", "y", "expires"], ["level"]);
  id(body.id, `${path}.id`, c);
  coordinates(body, path, c);
  number3(body.expires, `${path}.expires`);
  if (body.level !== void 0) number3(body.level, `${path}.level`, 0, c.levels - 1, true);
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
    const root2 = c.entities.get(power.root), rootPower = root2?.factionState?.power;
    if (!root2 || root2.kind !== "building" || root2.role !== "hq" || root2.side !== e.side || root2.progress !== 1 || (root2.level ?? 0) !== (e.level ?? 0) || !rootPower?.connected || rootPower.root !== root2.id || components.get(e.id) !== components.get(root2.id)) bad3(`state.entities[${e.id}].factionState.power.root`, "power root requires a completed owned headquarters connected within eight-tile building links on the same level");
  }
}
function validateFactionUnit(value, path, c, e) {
  const f = object3(value, path, [], ["trophyKills", "chant", "swapReadyAt", "artillery", "tunnel", "corpseCargo", "deliveredCorpses", "corpseOrder", "power", "nextDecoyAt", "waterReadyAt"]);
  if (f.trophyKills !== void 0) {
    if (e.kind !== "unit" || e.illusion) bad3(`${path}.trophyKills`, "trophies require real troops");
    number3(f.trophyKills, `${path}.trophyKills`, 0, 1e9, true);
  }
  for (const key of ["swapReadyAt", "nextDecoyAt", "waterReadyAt"]) optionalNumber(f, key, path, 0, c.time + 60);
  if (f.swapReadyAt !== void 0 && (e.kind !== "unit" || e.illusion || ["worker", "siege"].includes(e.role))) bad3(`${path}.swapReadyAt`, "illusion swapping requires real military troops");
  if (f.waterReadyAt !== void 0 && (e.kind !== "unit" || e.illusion || e.role !== "special" || entityDefinition(c.state, e).ability !== "surge")) bad3(`${path}.waterReadyAt`, "water shaping requires an admitted Tidecaller");
  if (f.nextDecoyAt !== void 0 && (e.kind !== "building" || e.definitionId !== "core:fairies-enchanted-grove")) bad3(`${path}.nextDecoyAt`, "decoy cooldown requires an Enchanted Grove");
  if (f.chant !== void 0) {
    if (e.kind !== "unit" || e.illusion || ["worker", "siege"].includes(e.role) || c.state.players[e.side].faction !== "orcs") bad3(`${path}.chant`, "war chants require owned Ironclad military troops");
    const chant = object3(f.chant, `${path}.chant`, ["kind", "until"]);
    choice3(chant.kind, `${path}.chant.kind`, ["assault", "bulwark"]);
    number3(chant.until, `${path}.chant.until`, 0, c.time + 12);
  }
  if (f.artillery !== void 0) {
    if (e.kind !== "unit" || e.illusion || e.role !== "siege" && (e.role !== "special" || entityDefinition(c.state, e).ability !== "entrench")) bad3(`${path}.artillery`, "fittings require siege artillery or an admitted Siege Cannon");
    choice3(f.artillery, `${path}.artillery`, ["stone", "grapeshot", "incendiary", "reinforced"]);
  }
  if (f.tunnel !== void 0) {
    if (e.kind !== "unit" || e.illusion || e.raised || c.state.players[e.side].faction !== "dwarves") bad3(`${path}.tunnel`, "tunnel orders require owned real Deepforge troops");
    const tunnel = object3(f.tunnel, `${path}.tunnel`, ["target", "progress"]);
    id(tunnel.target, `${path}.tunnel.target`, c);
    number3(tunnel.progress, `${path}.tunnel.progress`, 0, 1);
  }
  for (const key of ["corpseCargo", "deliveredCorpses"]) if (f[key] !== void 0) {
    if (e.kind !== "unit" || e.illusion || key === "corpseCargo" && e.definitionId !== "core:undead-corpse-wagon" || key === "deliveredCorpses" && (e.role !== "special" || entityDefinition(c.state, e).ability !== "raise")) bad3(`${path}.${key}`, "wrong corpse carrier");
    list3(f[key], `${path}.${key}`, key === "corpseCargo" ? 6 : 12).forEach((v, i) => validateBody(v, `${path}.${key}[${i}]`, c));
  }
  if (f.corpseOrder !== void 0) {
    const order2 = object3(f.corpseOrder, `${path}.corpseOrder`, ["type", "target", "progress"]);
    choice3(order2.type, `${path}.corpseOrder.type`, ["collect", "deliver"]);
    id(order2.target, `${path}.corpseOrder.target`, c);
    number3(order2.progress, `${path}.corpseOrder.progress`, 0, 1);
    if (e.kind !== "unit" || e.illusion || e.definitionId !== "core:undead-corpse-wagon" || c.state.players[e.side].faction !== "undead") bad3(`${path}.corpseOrder`, "active corpse orders require an owned Ashen Host corpse wagon");
  }
  if (f.power !== void 0) {
    const power = object3(f.power, `${path}.power`, ["connected", "root"]);
    flag3(power.connected, `${path}.power.connected`);
    if (power.root !== null) id(power.root, `${path}.power.root`, c);
    if (power.connected !== (power.root !== null) || e.kind !== "building" || e.progress !== 1 || c.state.players[e.side].faction !== "automata" || e.maxShield !== 80 || e.shield === void 0) bad3(`${path}.power`, "power requires a completed Automata building with an 80-point shield capacity");
  }
}
function validateFactionSystem(value, path, c) {
  const system = object3(value, path, ["version", "fury", "terrainEffects"]);
  if (system.version !== 1) bad3(`${path}.version`, "unknown faction schema");
  list3(system.fury, `${path}.fury`, c.playerCount, c.playerCount).forEach((v, i) => number3(v, `${path}.fury[${i}]`, 0, 100));
  const ids = /* @__PURE__ */ new Set();
  list3(system.terrainEffects, `${path}.terrainEffects`, c.maxEntities).forEach((v, i) => {
    const p = `${path}.terrainEffects[${i}]`, effect = object3(v, p, ["id", "side", "until", "tiles"]), n = id(effect.id, `${p}.id`, c);
    if (ids.has(n) || c.entityIds.has(n) || c.resourceIds.has(n)) bad3(`${p}.id`, "duplicate effect ID");
    ids.add(n);
    number3(effect.side, `${p}.side`, 0, c.playerCount - 1, true);
    number3(effect.until, `${p}.until`, 0, c.time + 20);
    list3(effect.tiles, `${p}.tiles`, 25).forEach((v2, j) => {
      const q = `${p}.tiles[${j}]`, tile = object3(v2, q, ["x", "y", "level", "before", "after"]);
      coordinates(tile, q, c);
      number3(tile.level, `${q}.level`, 0, c.levels - 1, true);
      choice3(tile.before, `${q}.before`, Object.keys(TERRAIN));
      choice3(tile.after, `${q}.after`, ["mud", "shallows", "water"]);
    });
  });
}
function validateTactics(value, path, c, e) {
  const t = object3(value, path, ["morale", "recentLoss"], ["formation", "retreat", "surrenderedTo", "ambush", "charge", "guard", "siegeCrew", "capture"]);
  if (e.kind !== "unit") bad3(path, "tactics requires a unit");
  number3(t.morale, `${path}.morale`, 0, 100);
  number3(t.recentLoss, `${path}.recentLoss`, 0, 60);
  if (t.surrenderedTo !== void 0) {
    number3(t.surrenderedTo, `${path}.surrenderedTo`, 0, c.playerCount - 1, true);
    if (t.surrenderedTo !== e.side || e.illusion || ["worker", "siege"].includes(e.role) || e.definitionFaction === void 0) bad3(`${path}.surrenderedTo`, "surrender requires the current owner and original combat troop definition");
  }
  if (t.retreat !== void 0) {
    const r = object3(t.retreat, `${path}.retreat`, ["x", "y", "until"], ["level"]);
    coordinates(r, `${path}.retreat`, c);
    number3(r.until, `${path}.retreat.until`, 0, c.time + 8.01);
  }
  if (t.formation !== void 0) {
    if (e.illusion || ["worker", "siege"].includes(e.role)) bad3(`${path}.formation`, "formations require real military troops");
    const f = object3(t.formation, `${path}.formation`, ["kind", "group", "slot", "count", "spacing", "facing", "anchor", "phase"]);
    choice3(f.kind, `${path}.formation.kind`, ["line", "wedge", "square", "loose"]);
    if (typeof f.group !== "string" || !f.group.length || f.group.length > 1200) bad3(`${path}.formation.group`, "invalid formation group");
    const count = number3(f.count, `${path}.formation.count`, 1, 100, true);
    number3(f.slot, `${path}.formation.slot`, 0, count - 1, true);
    number3(f.spacing, `${path}.formation.spacing`, 0.65, 3);
    number3(f.facing, `${path}.formation.facing`, 0, 7, true);
    point(f.anchor, `${path}.formation.anchor`, c);
    choice3(f.phase, `${path}.formation.phase`, ["moving", "broken", "regrouping", "formed"]);
  }
  if (t.ambush !== void 0) {
    const a = object3(t.ambush, `${path}.ambush`, ["radius", "target", "concealed", "armedAt"]);
    number3(a.radius, `${path}.ambush.radius`, 0.75, 10);
    choice3(a.target, `${path}.ambush.target`, ["any", "unit", "building", ...UNIT_ROLES]);
    flag3(a.concealed, `${path}.ambush.concealed`);
    number3(a.armedAt, `${path}.ambush.armedAt`, 0, c.time);
    if (e.role === "worker" || e.role === "siege" || e.illusion) bad3(`${path}.ambush`, "ineligible ambusher");
  }
  if (t.charge !== void 0) {
    const charge = object3(t.charge, `${path}.charge`, ["distance", "heading", "lastMovedAt"]);
    number3(charge.distance, `${path}.charge.distance`, 0, 5);
    number3(charge.heading, `${path}.charge.heading`, 0, 7, true);
    number3(charge.lastMovedAt, `${path}.charge.lastMovedAt`, 0, c.time);
    if (e.role !== "cavalry" || e.illusion) bad3(`${path}.charge`, "charge requires real cavalry");
  }
  if (t.guard !== void 0) {
    const originalFaction = e.definitionFaction ?? c.state.players[e.side].faction;
    if (e.role !== "melee" || !["dwarves", "tideborn", "automata"].includes(originalFaction)) bad3(`${path}.guard`, "guard requires an admitted shield bearer");
    const guard = object3(t.guard, `${path}.guard`, ["value", "max", "lastDamagedAt"]);
    const max = number3(guard.max, `${path}.guard.max`, 40, 40);
    number3(guard.value, `${path}.guard.value`, 0, max);
    number3(guard.lastDamagedAt, `${path}.guard.lastDamagedAt`, 0, c.time);
  }
  if (t.siegeCrew !== void 0) {
    const crew = object3(t.siegeCrew, `${path}.siegeCrew`, ["hp", "maxHp", "uncrewed"]);
    const max = number3(crew.maxHp, `${path}.siegeCrew.maxHp`, 42, 42);
    number3(crew.hp, `${path}.siegeCrew.hp`, 0, max);
    flag3(crew.uncrewed, `${path}.siegeCrew.uncrewed`);
    if (e.role !== "siege" || e.illusion || crew.uncrewed !== (crew.hp === 0)) bad3(`${path}.siegeCrew`, "invalid siege crew");
  }
  if (t.capture !== void 0) {
    const capture = object3(t.capture, `${path}.capture`, ["target", "progress"]);
    id(capture.target, `${path}.capture.target`, c);
    number3(capture.progress, `${path}.capture.progress`, 0, 1);
    if (!["worker", "melee", "spear", "special"].includes(e.role) || e.illusion || e.raised) bad3(`${path}.capture`, "ineligible capturer");
  }
}
function playersArray(value, path, c, check) {
  list3(value, path, c.playerCount, c.playerCount).forEach((v, i) => check(v, `${path}[${i}]`));
}
function entries(value, path, max, c, check) {
  const seen = /* @__PURE__ */ new Set();
  list3(value, path, max).forEach((entry, i) => {
    const p = `${path}[${i}]`, parts = list3(entry, p, 2, 2), key = id(parts[0], `${p}[0]`, c);
    if (seen.has(key)) bad3(path, "duplicate map key");
    seen.add(key);
    check(parts[1], `${p}[1]`);
  });
}
function validateRuntime2(value, c, version, teams) {
  const fields2 = ["fog", "ai", "aiTurns", "hits", "routes", "abilities", "returning", "queuedGather", "aiWave", "initialScoutDispatched", "expansionScout", "expansionScoutDispatched", "knownEnemyBuildings", "enemyStartCleared", "searched"];
  const path = "runtime", r = object3(value, path, version === 1 ? fields2 : version === 2 ? [...fields2, "clearedEnemyStarts"] : [...fields2, "clearedEnemyStarts", "aiBatchTurns", "aiDecisionAt", "aiDecisionTurns", "knownEnemyUnits", "retreating", "producedFighters"], version >= 3 ? ["teamAI"] : []);
  number3(r.fog, "runtime.fog", -0.25, 0.2);
  number3(r.ai, "runtime.ai", -0.25, 1);
  number3(r.aiTurns, "runtime.aiTurns", 0, MAX_VALUE, true);
  list3(r.hits, "runtime.hits", c.maxEntities).forEach((v, i) => {
    const p = `runtime.hits[${i}]`, h = object3(v, p, ["source", "target", "amount", "event"]);
    for (const key of ["source", "target"]) if (!c.entityIds.has(id(h[key], `${p}.${key}`, c))) bad3(`${p}.${key}`, "missing hit entity");
    number3(h.amount, `${p}.amount`, 0, 1e9);
    number3(h.event, `${p}.event`, 0, c.eventCount - 1, true);
  });
  entries(r.routes, "runtime.routes", MAX_ID2, c, (v, p) => {
    const route2 = object3(v, p, ["key", "at"]);
    if (typeof route2.key !== "string" || route2.key.length > 128) bad3(`${p}.key`, "invalid route key");
    number3(route2.at, `${p}.at`, 0, c.time);
  });
  entries(r.abilities, "runtime.abilities", MAX_ID2, c, (v, p) => number3(v, p));
  uniqueIds(list3(r.returning, "runtime.returning", MAX_ID2), "runtime.returning", c.nextId - 1).forEach((n) => {
    if (n === 0) bad3("runtime.returning", "invalid entity id");
  });
  uniqueIds(list3(r.queuedGather, "runtime.queuedGather", c.maxEntities), "runtime.queuedGather", c.nextId - 1).forEach((n) => {
    const e = c.entities.get(n);
    if (!e || e.hp <= 0 || e.kind !== "unit" || e.role !== "worker" || e.order.type !== "gather") bad3("runtime.queuedGather", "expected a living worker gathering");
  });
  playersArray(r.aiWave, "runtime.aiWave", c, (v, p) => number3(v, p, 0, c.time));
  for (const key of ["initialScoutDispatched", "expansionScoutDispatched", "enemyStartCleared"]) playersArray(r[key], `runtime.${key}`, c, flag3);
  playersArray(r.expansionScout, "runtime.expansionScout", c, (v, p) => {
    if (v !== null) id(v, p, c);
  });
  playersArray(r.knownEnemyBuildings, "runtime.knownEnemyBuildings", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
    const b = object3(value2, q, ["x", "y", "role"], ["level"]);
    coordinates(b, q, c);
    choice3(b.role, `${q}.role`, BUILDING_ROLES);
  }));
  playersArray(r.searched, "runtime.searched", c, (v, p) => uniqueIds(list3(v, p, c.cells), p, c.cells - 1));
  if (version >= 2) playersArray(r.clearedEnemyStarts, "runtime.clearedEnemyStarts", c, (v, p) => uniqueIds(list3(v, p, c.playerCount), p, c.playerCount - 1));
  if (version >= 3) {
    number3(r.aiBatchTurns, "runtime.aiBatchTurns", 0, MAX_VALUE, true);
    playersArray(r.aiDecisionAt, "runtime.aiDecisionAt", c, (v, p) => number3(v, p, 0, c.time + 3));
    for (const key of ["aiDecisionTurns", "producedFighters"]) playersArray(r[key], `runtime.${key}`, c, (v, p) => number3(v, p, 0, MAX_VALUE, true));
    playersArray(r.knownEnemyUnits, "runtime.knownEnemyUnits", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
      const observation = object3(value2, q, ["x", "y", "role", "seenAt", "hpFraction"], ["level"]);
      coordinates(observation, q, c);
      choice3(observation.role, `${q}.role`, UNIT_ROLES.filter((role) => role !== "worker"));
      number3(observation.seenAt, `${q}.seenAt`, 0, c.time);
      number3(observation.hpFraction, `${q}.hpFraction`, 0, 1);
    }));
    playersArray(r.retreating, "runtime.retreating", c, (v, p) => entries(v, p, c.maxEntities, c, (value2, q) => {
      const record2 = object3(value2, q, ["until", "produced", "afterId"]);
      number3(record2.until, `${q}.until`, 0, c.time + 30);
      number3(record2.produced, `${q}.produced`, 0, MAX_VALUE, true);
      number3(record2.afterId, `${q}.afterId`, 0, c.nextId - 1, true);
    }));
    if (r.teamAI !== void 0) validateTeamAiState(r.teamAI, { playerCount: c.playerCount, teams, time: c.time, nextEntityId: c.nextId, width: c.width, height: c.height, levels: c.levels, entityLevels: new Map([...c.entities].map(([id2, e]) => [id2, e.level ?? 0])), entitySides: new Map([...c.entities].filter(([, e]) => e.hp > 0 && e.kind === "unit" && e.role !== "worker" && !e.illusion).map(([id2, e]) => [id2, e.side])) });
  }
}
function validate(envelope, version) {
  const save = object3(envelope, "save", ["format", "version", "state", "runtime"]);
  if (save.format !== "orcs-vs-fairies-save") bad3("format", "unknown save format");
  if (save.version !== version) bad3("version", `unsupported version ${String(save.version)}`);
  const s = object3(save.state, "state", version === 1 ? STATE_FIELDS : version === 2 ? [...STATE_FIELDS, ...TEAM_FIELDS] : [...STATE_FIELDS, ...TEAM_FIELDS, "aiConfigs"], version >= 3 ? ["content", "world", "specialists", "rules", "objectives", "draft", "scenario", "economy", "friendlyFire", "projectiles", "factionSystems"] : []);
  if (s.content !== void 0) s.content = version < 4 ? decodeHistoricalContentBundle(s.content) : decodeContentBundle(s.content);
  const playerCount = list3(s.players, "state.players", version === 1 ? 2 : MAX_PLAYERS, version === 1 ? 2 : void 0).length;
  if (playerCount === 0) bad3("state.players", "expected between 1 and 8 players");
  const width = number3(s.width, "state.width", 8, 256, true), height = number3(s.height, "state.height", 8, 256, true), nextId = number3(s.nextId, "state.nextId", 1, MAX_ID2, true);
  const levels = s.world === void 0 ? 1 : Array.isArray(s.world.levels) ? s.world.levels.length : 0;
  if (levels < 1 || levels > 2) bad3("world.levels", "expected1 or2 levels");
  const c = { version, state: s, levels, width, height, cells: width * height * levels, time: number3(s.time, "state.time"), nextId, playerCount, maxEntities: version === 1 ? 4096 : MAX_ENTITIES, entityIds: /* @__PURE__ */ new Set(), entities: /* @__PURE__ */ new Map(), resourceIds: /* @__PURE__ */ new Set(), eventCount: 0 };
  if (version >= 3) playersArray(s.aiConfigs, "state.aiConfigs", c, (v, p) => {
    const config = object3(v, p, ["difficulty", "personality", "opening"]);
    choice3(config.difficulty, `${p}.difficulty`, ["easy", "normal", "hard"]);
    choice3(config.personality, `${p}.personality`, ["balanced", "rush", "fortify", "expand", "raid"]);
    choice3(config.opening, `${p}.opening`, ["infantry-rush", "tower-defense", "fast-expansion", "cavalry-raids"]);
  });
  playersArray(s.controllers, "state.controllers", c, (v, p) => choice3(v, p, ["human", "ai", "external"]));
  choice3(s.mapSize, "state.mapSize", ["small", "medium", "large", "huge"]);
  number3(s.mapVersion, "state.mapVersion", 1, MAP_VERSION, true);
  list3(s.terrain, "state.terrain", width * height, width * height).forEach((v, i) => choice3(v, `state.terrain[${i}]`, Object.keys(TERRAIN)));
  playersArray(s.starts, "state.starts", c, (v, p) => point(v, p, c));
  flag3(s.draw, "state.draw");
  number3(s.tick, "state.tick", 0, MAX_VALUE, true);
  number3(s.time, "state.time");
  number3(s.seed, "state.seed", 0, 4294967295, true);
  if (version >= 2) {
    playersArray(s.teams, "state.teams", c, (v, p) => number3(v, p, 0, MAX_PLAYERS - 1, true));
    playersArray(s.incomeFactors, "state.incomeFactors", c, (v, p) => number3(v, p, 0, 10));
    playersArray(s.populationLimits, "state.populationLimits", c, (v, p) => number3(v, p, 1, 500, true));
    playersArray(s.eliminated, "state.eliminated", c, flag3);
    flag3(s.sharedVision, "state.sharedVision");
  }
  list3(s.entities, "state.entities", c.maxEntities).forEach((v, i) => validateEntity(v, `state.entities[${i}]`, c));
  validatePowerConnections(c);
  if (s.friendlyFire !== void 0) flag3(s.friendlyFire, "state.friendlyFire");
  if (s.projectiles !== void 0) list3(s.projectiles, "state.projectiles", c.maxEntities).forEach((v, i) => {
    const path = `state.projectiles[${i}]`, shell = object3(v, path, ["id", "source", "side", "faction", "from", "x", "y", "damage", "buildingMultiplier", "impactAt", "radius"], ["modification", "level"]), key = id(shell.id, `${path}.id`, c);
    if (c.entityIds.has(key) || c.resourceIds.has(key)) bad3(`${path}.id`, "duplicate projectile ID");
    c.resourceIds.add(key);
    id(shell.source, `${path}.source`, c);
    number3(shell.side, `${path}.side`, 0, c.playerCount - 1, true);
    choice3(shell.faction, `${path}.faction`, Object.keys(contentFactions(c.state.content)));
    const origin = object3(shell.from, `${path}.from`, ["x", "y"], ["level", "elevation"]);
    coordinates(origin, `${path}.from`, c);
    optionalNumber(origin, "elevation", `${path}.from`, 0, 3);
    coordinates(shell, path, c);
    number3(shell.damage, `${path}.damage`, 0, 1e9);
    number3(shell.buildingMultiplier, `${path}.buildingMultiplier`, 0, 100);
    number3(shell.impactAt, `${path}.impactAt`, c.time, c.time + 30);
    number3(shell.radius, `${path}.radius`, 0.1, 10);
    if (shell.modification !== void 0) choice3(shell.modification, `${path}.modification`, ["stone", "grapeshot", "incendiary", "reinforced"]);
  });
  list3(s.resources, "state.resources", MAX_RESOURCES).forEach((v, i) => {
    const p = `state.resources[${i}]`, r = object3(v, p, ["id", "x", "y", "kind", "amount", "maxAmount"], ["level"]), key = id(r.id, `${p}.id`, c);
    if (c.entityIds.has(key) || c.resourceIds.has(key)) bad3(`${p}.id`, "duplicate entity or resource id");
    c.resourceIds.add(key);
    coordinates(r, p, c);
    choice3(r.kind, `${p}.kind`, RESOURCE_KINDS2);
    const max = number3(r.maxAmount, `${p}.maxAmount`, 0, 1e9);
    number3(r.amount, `${p}.amount`, 0, max);
  });
  playersArray(s.players, "state.players", c, (v, p) => {
    const player = object3(v, p, ["faction", "wood", "ore", "crystal", "population", "cap", "upgrades"], ["heroRecovery"]);
    choice3(player.faction, `${p}.faction`, Object.keys(contentFactions(c.state.content)));
    for (const key of RESOURCE_KINDS2) number3(player[key], `${p}.${key}`);
    number3(player.population, `${p}.population`, 0, c.maxEntities, true);
    number3(player.cap, `${p}.cap`, 0, version === 1 ? 100 : 500, true);
    const available = upgradesFor(c.state, s.players.indexOf(v)), upgrades = list3(player.upgrades, `${p}.upgrades`, Object.keys(available).length);
    upgrades.forEach((u, i) => choice3(u, `${p}.upgrades[${i}]`, Object.keys(available)));
    if (new Set(upgrades).size !== upgrades.length) bad3(`${p}.upgrades`, "duplicate upgrade");
  });
  const researching = Array.from({ length: playerCount }, () => /* @__PURE__ */ new Set()), choices = Array.from({ length: playerCount }, () => /* @__PURE__ */ new Map()), players = s.players;
  for (let side = 0; side < playerCount; side++) {
    const definitions = upgradesFor(c.state, side);
    for (const id2 of players[side].upgrades) {
      const group = definitions[id2].exclusiveGroup;
      if (group) {
        if (choices[side].has(group)) bad3(`state.players[${side}].upgrades`, "exclusive technology choices conflict");
        choices[side].set(group, id2);
      }
    }
  }
  for (const e of c.entities.values()) if (e.hp > 0 && e.research !== void 0) {
    const side = e.side, upgrade = e.research;
    if (players[side].upgrades.includes(upgrade) || researching[side].has(upgrade)) bad3("state.entities.research", "upgrade is already complete or being researched");
    researching[side].add(upgrade);
    const group = upgradesFor(c.state, side)[upgrade].exclusiveGroup;
    if (group) {
      if (choices[side].has(group)) bad3("state.entities.research", "exclusive technology choice is already complete or being researched");
      choices[side].set(group, upgrade);
    }
  }
  if (s.winner !== null) number3(s.winner, "state.winner", 0, playerCount - 1, true);
  if (s.draw && s.winner !== null) bad3("state.winner", "draw cannot have a winner");
  if (version >= 2) {
    if (s.winningTeam !== null) {
      number3(s.winningTeam, "state.winningTeam", 0, MAX_PLAYERS - 1, true);
      if (!s.teams.includes(s.winningTeam)) bad3("state.winningTeam", "team has no player");
    }
    if (s.winner === null !== (s.winningTeam === null) || s.winner !== null && s.teams[s.winner] !== s.winningTeam) bad3("state.winner", "winner must belong to the winning team");
    if (s.draw && s.winningTeam !== null) bad3("state.winningTeam", "draw cannot have a winning team");
  }
  list3(s.corpses, "state.corpses", c.maxEntities * 2).forEach((v, i) => {
    const p = `state.corpses[${i}]`, corpse = object3(v, p, ["id", "x", "y", "expires"], ["level"]);
    id(corpse.id, `${p}.id`, c);
    coordinates(corpse, p, c);
    number3(corpse.expires, `${p}.expires`);
  });
  if (s.factionSystems !== void 0) validateFactionSystem(s.factionSystems, "state.factionSystems", c);
  const bodyOwners = /* @__PURE__ */ new Set();
  const claimBody = (body, path) => {
    const b = body, n = b.id;
    if (bodyOwners.has(n)) bad3(path, "body belongs to more than one location");
    bodyOwners.add(n);
  };
  s.corpses.forEach((b, i) => claimBody(b, `state.corpses[${i}]`));
  for (const e of c.entities.values()) {
    const f = e.factionState;
    if (f) {
      for (const key of ["corpseCargo", "deliveredCorpses"]) if (f[key]) for (const b of f[key]) claimBody(b, `state.entities[${e.id}].factionState.${key}`);
    }
  }
  const events = list3(s.events, "state.events", c.maxEntities * 4);
  c.eventCount = events.length;
  events.forEach((v, i) => {
    const p = `state.events[${i}]`, event = object3(v, p, ["type", "x", "y", "side"], ["text", "target", "source", "amount", "resource", "level"]);
    choice3(event.type, `${p}.type`, ["attack", "death", "build", "train", "gather", "message", "ability", "research"]);
    coordinates(event, p, c);
    number3(event.side, `${p}.side`, 0, playerCount - 1, true);
    for (const key of ["source", "target"]) if (event[key] !== void 0) id(event[key], `${p}.${key}`, c);
    optionalNumber(event, "amount", p);
    if (event.resource !== void 0) choice3(event.resource, `${p}.resource`, RESOURCE_KINDS2);
    if (event.text !== void 0 && (typeof event.text !== "string" || event.text.length > 4096)) bad3(`${p}.text`, "invalid message text");
  });
  const explored = fog(s.explored, "state.explored", c), visible = fog(s.visible, "state.visible", c);
  visible.forEach((tiles, side) => {
    for (const tile of tiles) if (!explored[side].has(tile)) bad3(`state.visible[${side}]`, "visible tiles must be explored");
  });
  if (s.world !== void 0) {
    validateWorldState(s.world, width, height, nextId, playerCount);
    const world = s.world;
    for (const allocated of [...world.bridges, ...world.sites, ...world.creatures]) if (c.entityIds.has(allocated.id) || c.resourceIds.has(allocated.id)) bad3("world.id", "collision with entity or resource");
    if (world.levels[0].terrain.some((t, i) => t !== s.terrain[i])) bad3("world.levels[0].terrain", "must match surface terrain");
  }
  if (s.economy !== void 0) validateEconomyState(s.economy, { width, height, time: c.time, nextId, playerCount, entities: s.entities, resources: s.resources, levels: c.levels, world: c.state.world });
  validateRuntime2(save.runtime, c, version, s.teams);
  validateSpecialists(c.state);
  if (version >= 3) {
    const count = ["rules", "objectives", "draft"].filter((k) => Object.hasOwn(s, k)).length;
    if (count !== 0 && count !== 3) bad3("state.rules", "rules, objectives and draft must be stored together");
    if (count === 3) {
      const state = s;
      state.rules = validateSavedRules(s.rules, state.content);
      validateDraftState(s.draft, draftPlayers(state), state.rules, state.content);
      validateObjectiveState(s.objectives, state);
      validateModeRoster(state);
      if (version === 4) {
        for (const [i, e] of state.entities.entries()) if ((e.raised || e.illusion) && !definitionAllowed(state, e.side, entityDefinition(state, e).id)) bad3(`state.entities[${i}].${e.raised ? "raised" : "illusion"}`, "summoned definition is prohibited by the current owner match rules");
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
  envelope.version = 3;
}
function copyJson(value) {
  let nodes = 0, bytes = 0;
  const parents = /* @__PURE__ */ new Set();
  function copy(v, path, depth) {
    if (++nodes > 2e6 || depth > 32) bad3(path, "save is too large or deeply nested");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) bad3(path, "numbers must be finite");
      return v;
    }
    if (typeof v === "string") {
      bytes += v.length * 2;
      if (bytes > MAX_SAVE_BYTES) bad3(path, "save exceeds size limit");
      return v;
    }
    if (!v || typeof v !== "object") bad3(path, "expected JSON data");
    if (parents.has(v)) bad3(path, "cyclic reference");
    parents.add(v);
    let result;
    if (Array.isArray(v)) {
      if (v.length > 1e5) bad3(path, "array exceeds size limit");
      if (Object.getOwnPropertySymbols(v).length) bad3(path, "invalid array properties");
      for (const key of Object.getOwnPropertyNames(v)) {
        if (!("value" in Object.getOwnPropertyDescriptor(v, key))) bad3(path, "array accessors are forbidden");
        if (key !== "length") {
          const index = Number(key);
          if (!Number.isSafeInteger(index) || index < 0 || index >= v.length || String(index) !== key) bad3(path, "invalid array properties");
        }
      }
      const array = [];
      for (let i = 0; i < v.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
        if (!descriptor || !("value" in descriptor)) bad3(path, "array accessors and gaps are forbidden");
        array.push(copy(descriptor.value, `${path}[${i}]`, depth + 1));
      }
      result = array;
    } else {
      const prototype = Object.getPrototypeOf(v);
      if (prototype !== Object.prototype && prototype !== null) bad3(path, "expected a plain object");
      const keys = Object.keys(v);
      if (keys.length > 1e5 || Object.getOwnPropertySymbols(v).length) bad3(path, "invalid object properties");
      const record2 = {};
      for (const key of keys) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") bad3(path, "unsafe property name");
        const descriptor = Object.getOwnPropertyDescriptor(v, key);
        if (!("value" in descriptor)) bad3(path, "accessors are forbidden");
        if (descriptor.value !== void 0) record2[key] = copy(descriptor.value, `${path}.${key}`, depth + 1);
      }
      result = record2;
    }
    parents.delete(v);
    return result;
  }
  return copy(value, "save", 0);
}
function checkSize(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_SAVE_BYTES) bad3("save", "save exceeds size limit");
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
  let source = input;
  if (typeof input === "string") {
    if (input.length > MAX_SAVE_BYTES || new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) bad3("save", "save exceeds size limit");
    try {
      source = JSON.parse(input);
    } catch {
      bad3("save", "invalid JSON");
    }
  }
  const envelope = copyJson(source);
  checkSize(envelope);
  const record2 = object3(envelope, "save", ["format", "version", "state", "runtime"]);
  if (record2.version === 1) migrateLegacy(record2);
  if (record2.version === 2) migrateAi(record2);
  if (record2.version === 3) migrateV3(record2);
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

// src/core/replays.ts
function replayChecksum(state, version = SAVE_VERSION) {
  if (version !== SAVE_VERSION) throw new Error("Historical replay checksums require the original serialized save envelope.");
  const text2 = JSON.stringify(saveGame(state));
  let hash = 2166136261;
  for (let i = 0; i < text2.length; i++) {
    hash ^= text2.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// work/final-ai-prep/audit-ladder401-r2.ts
var [sourcePin, run, output] = process.argv.slice(2);
var root = join("docs/evidence", run);
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), sourcePin);
assert.equal(SAVE_VERSION, 4);
assert.equal(SIMULATION_REVISION, "4.0.1");
var sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
var json = (path) => JSON.parse(readFileSync(path, "utf8"));
var method = json(join(root, "method.json"));
var summary = json(join(root, "summary.json"));
assert.equal(method.sourceCommit, sourcePin);
assert.equal(method.saveVersion, 4);
assert.equal(method.simulationRevision, "4.0.1");
assert.equal(method.runtime.executable, process.execPath);
assert.equal(method.runtime.node, process.version);
assert.equal(method.games, 108);
assert.deepEqual(method.seeds, [4127]);
assert.deepEqual(method.sizes, ["small", "medium", "large"]);
assert.equal(method.pairSelection, "all-ordered");
assert.equal(method.pairs.length, 36);
assert.deepEqual(json(join(root, "verification/source-before.json")), json(join(root, "verification/source-after.json")));
for (const [path, digest] of Object.entries(method.sourceSha256)) {
  assert.equal(sha(readFileSync(path)), digest, `Actual source ${path}`);
  assert.equal(sha(readFileSync(join(root, "source", path))), digest, `Captured source ${path}`);
  assert.deepEqual(readFileSync(path), execFileSync("git", ["show", `${sourcePin}:${path}`]), `Git source ${path}`);
}
var reportNames = readdirSync(root).filter((name) => name.endsWith(".json") && !["method.json", "summary.json"].includes(name)).sort();
assert.equal(reportNames.length, 108);
assert.equal(readdirSync(join(root, "saves")).length, 108);
var records = [];
var pairs = /* @__PURE__ */ new Set();
for (const name of reportNames) {
  const report = json(join(root, name)), savePath = join(root, report.finalSaveFile), bytes = readFileSync(savePath), native = JSON.parse(bytes.toString());
  assert.equal(report.sourceCommit, sourcePin);
  assert.equal(report.saveVersion, 4);
  assert.equal(report.simulationRevision, "4.0.1");
  assert.equal(native.format, "orcs-vs-fairies-save");
  assert.equal(native.version, 4);
  assert.equal(report.finalSaveVersion, 4);
  assert.equal(sha(bytes), report.finalSaveSha256);
  assert.deepEqual(native.state.players.map((player) => player.faction), [report.faction, report.opponent]);
  assert.equal(native.state.seed, report.seed);
  assert.equal(native.state.time, report.seconds);
  assert.deepEqual(native.state.players, report.finalPlayers);
  assert.equal(native.state.winner, report.winner);
  assert.equal(native.state.winningTeam, report.winningTeam);
  assert.equal(native.state.draw, report.draw);
  assert.equal(report.invalidEconomy, false);
  assert.equal(report.invalidPosition, false);
  assert.equal(report.saveRoundTrip, true);
  assert.equal(report.saveProof.passed, true);
  assert.equal(report.saveProof.attemptedSteps, 20);
  assert.equal(report.saveProof.checks.length, 20);
  assert(report.saveProof.checks.every((check) => check.equal && check.terminalUnchanged !== false));
  const restored = loadGame(bytes.toString()), resaved = saveGame(restored);
  assert.deepEqual(resaved, native, `Native load/resave ${name}`);
  assert.equal(replayChecksum(restored), report.finalReplayChecksum);
  resaved.state.visible = resaved.state.visible.map((cells) => cells.slice().sort((a, b) => a - b));
  resaved.state.explored = resaved.state.explored.map((cells) => cells.slice().sort((a, b) => a - b));
  assert.equal(sha(JSON.stringify(resaved)), report.finalStateSha256);
  if (report.winner !== null) assert(!native.state.entities.some((entity) => entity.role === "hq" && entity.side !== report.winner && entity.hp > 0), "Losing HQ must be absent/dead in the native save");
  const key = `${report.seed}/${report.mapSize}/${report.faction}/${report.opponent}`;
  assert(!pairs.has(key));
  pairs.add(key);
  records.push({ report: name, save: report.finalSaveFile, sha256: sha(bytes), version: native.version, tick: native.state.tick, seconds: native.state.time, winner: native.state.winner, timeout: report.timeout, proofMode: report.saveProof.mode, exactNativeEnvelopeLoadResave: true });
}
assert.equal(summary.games, 108);
assert.equal(summary.completed, records.filter((record2) => !record2.timeout).length);
var evidence = { sourcePin, run, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, result: "passed", actualReports: records.length, actualNativeSaves: records.length, methodSha256: sha(readFileSync(join(root, "method.json"))), summarySha256: sha(readFileSync(join(root, "summary.json"))), records, scope: "Reads every actual final SAVE4 file, verifies its digest and corresponding gameplay report, loads/resaves current native state exactly, and checks the recorded 20-step proof rows. Does not re-run the completed matches." };
writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ sourcePin, run, result: evidence.result, actualReports: records.length, actualNativeSaves: records.length }));
