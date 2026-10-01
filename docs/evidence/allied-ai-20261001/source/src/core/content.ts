import type { FactionId, FactionDef, UnitDef, UnitRole, BuildingDef, BuildingRole, UpgradeDef } from './types';
export const ECONOMY = { harvestPerSecond: 2.28 } as const;

const unit=(id:string,name:string,role:UnitRole,wood:number,ore:number,hp:number,damage:number,armor:number,range:number,speed:number,cooldown:number,trainTime:number,ability:UnitDef['ability'],description:string):UnitDef=>({id,name,role,cost:{wood,ore,crystal:role==='special'?12:0},hp,damage,armor,range,speed,cooldown,trainTime,sight:role==='ranged'?9:7,ability,description});
const building=(id:string,name:string,role:BuildingRole,wood:number,ore:number,hp:number,size:number,buildTime:number,description:string,ability?:'heal'):BuildingDef=>({id,name,role,cost:{wood,ore,crystal:role==='tower'?6:0},hp,size,buildTime,sight:role==='tower'?11:9,description,ability});
type BaseFaction=Omit<FactionDef,'units'|'buildings'> & {units:Record<'worker'|'melee'|'ranged'|'special',UnitDef>;buildings:Record<'hq'|'depot'|'barracks'|'tower',BuildingDef>};
const BASE_FACTIONS:Record<FactionId,BaseFaction>={
 orcs:{id:'orcs',name:'Ironclad',subtitle:'Strength in the struggle',color:0xd07745,accent:'#dba35d',description:'Armored warbands gather fury as they fight. Hold the line, build momentum, and break the enemy stronghold.',ai:{aggression:1,armySize:9,composition:{melee:.45,ranged:.35,special:.20}},units:{
 worker:unit('orc-worker','Scrapper','worker',50,0,85,5,1,1.3,2.1,1.4,12,undefined,'Harvest timber, ore and crystal. Raise and repair your settlement.'),
 melee:unit('orc-melee','Ironjaw','melee',70,25,175,15,3,1.4,1.8,1.15,36,'momentum','Armored front line. Sustained attacks build Fury, granting up to 40% damage and 15% attack speed.'),
 ranged:unit('orc-ranged','Boltspitter','ranged',85,35,100,15,1,6.5,2,1.5,40,'momentum','Crossbow volleys punish exposed enemies. Builds Fury with each hit.'),
 special:unit('orc-special','Wardrum','special',120,70,190,21,3,1.6,1.65,1.65,56,'momentum','Heavy shock infantry. Fury makes prolonged brawls devastating.')},buildings:{
 hq:building('orc-hq','Iron Hall','hq',240,120,1800,3,55,'Your stronghold. Trains Scrappers and supports 12 population.'),
 depot:building('orc-depot','Timber Yard','depot',100,0,600,2,22,'Resource drop-off. Adds 10 population capacity.'),
 barracks:building('orc-barracks','War Foundry','barracks',160,50,950,3,35,'Trains Ironjaws, Boltspitters, and Wardrums.'),
 tower:building('orc-tower','Watchtower','tower',120,80,750,2,30,'Defends nearby ground with heavy bolts.')}},
 fairies:{id:'fairies',name:'Wild Court',subtitle:'The forest remembers',color:0x70d8bd,accent:'#a1e1c6',description:'Swift woodland defenders weave deceptive doubles and recover beneath healing groves. Strike, vanish, and return.',ai:{aggression:.9,armySize:10,composition:{melee:.45,ranged:.35,special:.20}},units:{
 worker:unit('fairy-worker','Tender','worker',50,0,65,4,0,1.3,2.5,1.3,12,undefined,'Gather timber, ore and crystal. Cultivate the living buildings of the Court.'),
 melee:unit('fairy-melee','Thornblade','melee',65,25,140,17,2,1.5,2.75,1,34,undefined,'Swift spear guardians. Reposition quickly and protect fragile casters.'),
 ranged:unit('fairy-ranged','Mothbow','ranged',80,40,85,18,0,7,2.6,1.4,40,undefined,'Long-range arrows and quick wings reward careful positioning.'),
 special:unit('fairy-special','Veilweaver','special',110,75,105,13,1,5,2.5,1.5,56,'illusion','Conjures temporary doubles to draw enemy attacks. Activate with Q.')},buildings:{
 hq:building('fairy-hq','Elderheart','hq',240,120,1650,3,55,'The heart of your settlement. Trains Tenders and supports 12 population.'),
 depot:building('fairy-depot','Moonwell','depot',100,0,520,2,22,'Resource drop-off. Passively heals nearby friendly units at 2.5 HP/s within 6 tiles. Adds 10 population capacity.','heal'),
 barracks:building('fairy-barracks','Bloomspire','barracks',160,50,800,3,35,'Trains Thornblades, Mothbows, and Veilweavers.'),
 tower:building('fairy-tower','Thornwatch','tower',120,80,650,2,30,'A living defensive spire that guards the surrounding grove.')}},
 dwarves:{id:'dwarves',name:'Deepforge',subtitle:'Choose the ground. Hold it.',color:0xe7b551,accent:'#edc675',description:'Engineers prepare firing positions. Emplace your troops for protection and cannon range, then pack up to advance.',ai:{aggression:1,armySize:9,composition:{melee:.40,ranged:.35,special:.25}},units:{
 worker:unit('dwarf-worker','Mason','worker',50,0,80,5,1,1.3,2.1,1.4,12,undefined,'Gather wood, ore and crystal. Construct and repair the Deepforge settlement.'),
 melee:unit('dwarf-melee','Shieldguard','melee',70,30,170,15,3,1.4,1.9,1.15,35,'entrench','Protect the gun line. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up.'),
 ranged:unit('dwarf-ranged','Thunderlock','ranged',85,40,95,20,1,6.5,2,1.7,40,'entrench','Musket infantry. Q emplaces: after 3 seconds, gain 2 armor and 15% damage. Movement packs up.'),
 special:{...unit('dwarf-special','Siege Cannon','special',130,85,145,32,2,6,1.45,2.6,58,'entrench','Long-range artillery deals 80% bonus damage to buildings. Q emplaces: after 3 seconds, gain 3 range, 2 armor and 15% damage. Movement packs up.'),sight:11,buildingDamageMultiplier:1.8}},buildings:{
 hq:building('dwarf-hq','Mountain Keep','hq',240,120,1800,3,55,'Your stronghold. Trains Masons and supports 12 population.'),
 depot:building('dwarf-depot','Supply Vault','depot',100,0,620,2,22,'Resource drop-off. Adds 10 population capacity.'),
 barracks:building('dwarf-barracks','Gunsmith Hall','barracks',160,50,950,3,35,'Trains Shieldguards, Thunderlocks and Siege Cannons.'),
 tower:building('dwarf-tower','Gun Bastion','tower',120,80,800,2,30,'A stone gun emplacement that protects your prepared position.')}},
 undead:{id:'undead',name:'Ashen Host',subtitle:'The fallen march again',color:0xa899d9,accent:'#c5b5ed',description:'Expendable ranks screen the Gravecaller, who consumes nearby corpses to raise temporary warriors. Protect your casters to sustain the attack.',ai:{aggression:1.1,armySize:11,composition:{melee:.55,ranged:.30,special:.15}},units:{
 worker:unit('undead-worker','Gravedigger','worker',50,0,60,4,0,1.3,2.3,1.3,12,undefined,'Gather wood, ore and crystal. Raise and repair the necropolis.'),
 melee:unit('undead-melee','Boneguard','melee',45,15,115,14,1,1.4,2.35,1,24,undefined,'Cheap, fragile infantry. Fallen mortal troops leave corpses for Gravecallers.'),
 ranged:unit('undead-ranged','Gravebow','ranged',65,30,80,17,0,6.5,2.25,1.4,32,undefined,'Brittle archers. Keep a screen of Boneguards between them and the enemy.'),
 special:unit('undead-special','Gravecaller','special',110,80,95,12,0,5.5,2.1,1.6,48,'raise','Automatically (or Q) consumes up to 2 corpses within 6 tiles, raising half-health Boneguards for 35 seconds. 22s cooldown. Raised troops use population and cannot be raised again.')},buildings:{
 hq:building('undead-hq','Necropolis','hq',240,120,1650,3,55,'Your stronghold. Trains Gravediggers and supports 12 population.'),
 depot:building('undead-depot','Ossuary','depot',100,0,500,2,22,'Resource drop-off. Adds 10 population capacity.'),
 barracks:building('undead-barracks','Crypt','barracks',160,50,800,3,35,'Trains Boneguards, Gravebows and Gravecallers.'),
 tower:building('undead-tower','Soul Spire','tower',120,80,650,2,30,'A funerary spire that fires at intruders.')}},
 tideborn:{id:'tideborn',terrainSpeeds:{mud:1.1,shallows:1.1},name:'Tideborn',subtitle:'Follow the returning tide',color:0x57a7a3,accent:'#e2b897',description:'Amphibious defenders cross mud and shallows at full speed. Tidecallers heal their formation and send it forward in a surge.',ai:{aggression:1,armySize:9,composition:{melee:.45,ranged:.35,special:.20}},units:{
 worker:unit('tideborn-worker','Reef Tender','worker',50,0,70,4,0,1.3,2.3,1.3,12,undefined,'Gather wood, ore and crystal. Cross mud and shallows without slowing.'),
 melee:unit('tideborn-melee','Shellguard','melee',70,25,170,16,3,1.4,2.15,1.15,35,undefined,'Shell-armored infantry. Wet ground gives this steady formation a route around slower enemies.'),
 ranged:unit('tideborn-ranged','Harpooner','ranged',80,35,90,20,0,6.5,2.3,1.45,38,undefined,'Harpoons strike from behind the Shellguard line. Moves freely through mud and shallows.'),
 special:unit('tideborn-special','Tidecaller','special',110,75,115,11,1,5.5,2.2,1.6,54,'surge','Q restores 35 HP to nearby allies and grants 25% movement speed for 6 seconds. 20s cooldown. Casts automatically when nearby allies are wounded in combat.')},buildings:{
 hq:building('tideborn-hq','Coral Hold','hq',240,120,1700,3,55,'Trains Reef Tenders and supports 12 population.'),
 depot:building('tideborn-depot','Tidal Basin','depot',100,0,560,2,22,'Resource drop-off for wood, ore and crystal. Adds 10 population capacity.'),
 barracks:building('tideborn-barracks','Reef Lodge','barracks',160,50,860,3,35,'Trains Shellguards, Harpooners and Tidecallers.'),
 tower:building('tideborn-tower','Conch Spire','tower',120,80,700,2,30,'A fortified conch that fires at nearby invaders.')}},
 automata:{id:'automata',name:'Automata',subtitle:'Repair. Recharge. Return.',color:0xb69ae9,accent:'#d8cbb0',description:'Ceramic machines carry shields that recharge after six seconds without damage. Ward Engines restore shields to sustain the formation.',ai:{aggression:.95,armySize:8,composition:{melee:.45,ranged:.35,special:.20}},units:{
 worker:{...unit('automata-worker','Assembler','worker',50,0,55,4,0,1.3,2.15,1.4,12,undefined,'Gather wood, ore and crystal. Carries a 12-point rechargeable shield.'),shield:12},
 melee:{...unit('automata-melee','Sentinel','melee',70,25,135,15,2,1.4,1.95,1.2,35,undefined,'A 45-point shield absorbs damage before ceramic armor takes harm. Shields recharge at 4/s after 6 seconds without damage.'),shield:45},
 ranged:{...unit('automata-ranged','Prism Archer','ranged',85,40,75,19,0,7,2.1,1.6,42,undefined,'Crystal beams reach across the front line. Carries a 35-point rechargeable shield.'),shield:35},
 special:{...unit('automata-special','Ward Engine','special',120,80,135,12,2,5,1.8,1.7,56,'ward','Q restores 24 shield to nearby friendly machines. Casts automatically when shields are damaged. 20s cooldown. Carries a 45-point shield.'),shield:45}},buildings:{
 hq:building('automata-hq','Core Foundry','hq',240,120,1750,3,55,'Trains Assemblers and supports 12 population.'),
 depot:building('automata-depot','Crystal Depot','depot',100,0,580,2,22,'Resource drop-off for wood, ore and crystal. Adds 10 population capacity.'),
 barracks:building('automata-barracks','Assembly Hall','barracks',160,50,900,3,35,'Trains Sentinels, Prism Archers and Ward Engines.'),
 tower:building('automata-tower','Prism Tower','tower',120,80,740,2,30,'Focused crystal beams defend the foundry.')}}


};

// The three shared battlefield roles have faction-specific names and materials in art.
const expansionNames:Record<FactionId,[string,string,string]>={
 orcs:['Boar Rider','Pikejaw','Iron Catapult'],fairies:['Stag Rider','Briar Pike','Thorn Trebuchet'],
 dwarves:['Mountain Rider','Deep Pike','Stone Thrower'],undead:['Dread Rider','Bone Pike','Grave Catapult'],
 tideborn:['Shell Rider','Reef Pike','Coral Mangonel'],automata:['Strider','Lance Sentinel','Siege Engine'],
};
export const FACTIONS:Record<FactionId,FactionDef>=Object.fromEntries(Object.entries(BASE_FACTIONS).map(([id,base])=>{
 const faction=id as FactionId,prefix=base.units.worker.id.split('-')[0],names=expansionNames[faction];
 return [id,{...base,buildings:{...base.buildings,
  wall:{...building(`${prefix}-wall`,'Stone Wall','wall',30,25,1100,1,15,'A durable barrier. Siege engines break walls quickly.'),age:2},
  gate:{...building(`${prefix}-gate`,'Town Gate','gate',90,65,1400,2,28,'Open to let armies pass. An open gate also admits enemies. Cannot close on a unit.'),age:2},
 },units:{...base.units,special:{...base.units.special,age:2},
  cavalry:{...unit(`${prefix}-cavalry`,names[0],'cavalry',100,65,210,18,2,1.5,3.5,1.3,42,undefined,'Fast raider. Strong against ranged troops; vulnerable to pikes.'),age:2,bonusAgainst:{ranged:1.7}},
  spear:{...unit(`${prefix}-spear`,names[1],'spear',55,25,125,11,1,1.9,2.1,1.25,28,undefined,'Long pike infantry. Deals triple damage to cavalry.'),age:1,bonusAgainst:{cavalry:3}},
  siege:{...unit(`${prefix}-siege`,names[2],'siege',180,140,185,28,2,8.5,1.05,3.8,65,undefined,'Long-range siege engine. Deals quadruple damage to buildings. Protect it from raiders.'),age:3,cost:{wood:180,ore:140,crystal:25},buildingDamageMultiplier:4,sight:11},
 }}];
})) as Record<FactionId,FactionDef>;

export const ABILITIES={
 surge:{name:'Returning Tide',description:'Restore 35 HP to allies within 5 tiles and grant 25% movement speed for 6 seconds.',cooldown:20},
 ward:{name:'Restore Wards',description:'Restore 24 shield to friendly machines within 5 tiles.',cooldown:20},
 entrench:{name:'Emplace / Pack up',description:'Hold position and prepare for 3 seconds to gain armor and damage. Cannons also gain range. Movement cancels emplacement.',cooldown:0},
 raise:{name:'Raise Fallen',description:'Consume up to two nearby corpses to raise temporary Boneguards. Requires free population.',cooldown:22},
 momentum:{name:'War Cry',description:'Build a burst of Fury. Sustained attacks keep the momentum alive.',cooldown:25},
 illusion:{name:'Veil Doubles',description:'Conjure two short-lived doubles that draw attacks and deal reduced damage.',cooldown:35},
 heal:{name:'Renewal',description:'Restore health to nearby friendly units.',cooldown:18}
} as const;

export const UPGRADES:Record<UpgradeDef['id'],UpgradeDef>={
 'town-age':{id:'town-age',name:'Town Age',description:'Unlock advanced troops, fortifications and expansion strongholds.',cost:{wood:260,ore:180,crystal:0},researchTime:65,building:'hq',appliesTo:'worker',advancesTo:2,effects:{}},
 'citadel-age':{id:'citadel-age',name:'Citadel Age',description:'Unlock siege engines and veteran military technology.',cost:{wood:420,ore:320,crystal:60},researchTime:90,building:'hq',appliesTo:'worker',age:2,requires:['town-age'],advancesTo:3,effects:{}},
 'forged-weapons':{id:'forged-weapons',name:'Forged Weapons',description:'Melee troops deal 20% more damage.',cost:{wood:100,ore:130,crystal:0},researchTime:35,building:'barracks',appliesTo:'melee',age:2,effects:{damage:1.2}},
 'tempered-armor':{id:'tempered-armor',name:'Tempered Armor',description:'Melee troops gain 2 armor.',cost:{wood:80,ore:150,crystal:0},researchTime:40,building:'barracks',appliesTo:'melee',age:2,effects:{armor:2}},
 'veteran-arms':{id:'veteran-arms',name:'Veteran Arms',description:'Melee troops deal another 25% damage.',cost:{wood:160,ore:220,crystal:35},researchTime:50,building:'barracks',appliesTo:'melee',age:3,requires:['forged-weapons'],effects:{damage:1.25}},

 'worker-harvest':{id:'worker-harvest',name:'Harvest Drills',description:'Workers gather 30% faster.',cost:{wood:100,ore:50,crystal:0},researchTime:30,building:'hq',appliesTo:'worker',effects:{gather:1.3}},
 'worker-speed':{id:'worker-speed',name:'Courier Training',description:'Workers move 20% faster.',cost:{wood:75,ore:50,crystal:0},researchTime:25,building:'hq',appliesTo:'worker',effects:{speed:1.2}},
};
