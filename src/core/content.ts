import type { FactionDef, UnitDef, UnitRole, BuildingDef, BuildingRole } from './types';
export const ECONOMY = { harvestPerSecond: 2.28 } as const;

const unit=(id:string,name:string,role:UnitRole,wood:number,ore:number,hp:number,damage:number,armor:number,range:number,speed:number,cooldown:number,trainTime:number,ability:UnitDef['ability'],description:string):UnitDef=>({id,name,role,cost:{wood,ore},hp,damage,armor,range,speed,cooldown,trainTime,sight:role==='ranged'?9:7,ability,description});
const building=(id:string,name:string,role:BuildingRole,wood:number,ore:number,hp:number,size:number,buildTime:number,description:string,ability?:'heal'):BuildingDef=>({id,name,role,cost:{wood,ore},hp,size,buildTime,sight:role==='tower'?11:9,description,ability});
export const FACTIONS:Record<'orcs'|'fairies',FactionDef>={
 orcs:{id:'orcs',name:'Ironclad',subtitle:'Strength in the struggle',color:0xd07745,accent:'#dba35d',description:'Armored warbands gather fury as they fight. Hold the line, build momentum, and break the enemy stronghold.',ai:{aggression:1,armySize:9},units:{
 worker:unit('orc-worker','Scrapper','worker',50,0,85,5,1,1.3,2.1,1.4,12,undefined,'Harvest timber and ore. Raise and repair your settlement.'),
 melee:unit('orc-melee','Ironjaw','melee',70,25,210,18,5,1.4,1.8,1.15,36,'momentum','Armored front line. Sustained attacks build Fury, increasing damage.'),
 ranged:unit('orc-ranged','Boltspitter','ranged',85,35,110,16,1,6.5,2,1.5,40,'momentum','Crossbow volleys punish exposed enemies. Builds Fury with each hit.'),
 special:unit('orc-special','Wardrum','special',120,70,260,28,4,1.6,1.65,1.65,56,'momentum','Heavy shock infantry. Fury makes prolonged brawls devastating.')},buildings:{
 hq:building('orc-hq','Iron Hall','hq',240,120,1800,3,55,'Your stronghold. Trains Scrappers and supports 12 population.'),
 depot:building('orc-depot','Timber Yard','depot',100,0,600,2,22,'Resource drop-off. Adds 10 population capacity.'),
 barracks:building('orc-barracks','War Foundry','barracks',160,50,950,3,35,'Trains Ironjaws, Boltspitters, and Wardrums.'),
 tower:building('orc-tower','Watchtower','tower',120,80,750,2,30,'Defends nearby ground with heavy bolts.')}},
 fairies:{id:'fairies',name:'Wild Court',subtitle:'The forest remembers',color:0x70d8bd,accent:'#a1e1c6',description:'Swift woodland defenders weave deceptive doubles and recover beneath healing groves. Strike, vanish, and return.',ai:{aggression:.9,armySize:10},units:{
 worker:unit('fairy-worker','Tender','worker',50,0,65,4,0,1.3,2.5,1.3,12,undefined,'Gather timber and ore. Cultivate the living buildings of the Court.'),
 melee:unit('fairy-melee','Thornblade','melee',65,25,140,17,2,1.5,2.75,1,34,undefined,'Swift spear guardians. Reposition quickly and protect fragile casters.'),
 ranged:unit('fairy-ranged','Mothbow','ranged',80,40,85,18,0,7,2.6,1.4,40,undefined,'Long-range arrows and quick wings reward careful positioning.'),
 special:unit('fairy-special','Veilweaver','special',110,75,105,13,1,5,2.5,1.5,56,'illusion','Conjures temporary doubles to draw enemy attacks. Activate with Q.')},buildings:{
 hq:building('fairy-hq','Elderheart','hq',240,120,1650,3,55,'The heart of your settlement. Trains Tenders and supports 12 population.'),
 depot:building('fairy-depot','Moonwell','depot',100,0,520,2,22,'Resource drop-off. Passively heals nearby friendly units at 2.5 HP/s within 6 tiles. Adds 10 population capacity.','heal'),
 barracks:building('fairy-barracks','Bloomspire','barracks',160,50,800,3,35,'Trains Thornblades, Mothbows, and Veilweavers.'),
 tower:building('fairy-tower','Thornwatch','tower',120,80,650,2,30,'A living defensive spire that guards the surrounding grove.')}}
};

export const ABILITIES={
 momentum:{name:'War Cry',description:'Build a burst of Fury. Sustained attacks keep the momentum alive.',cooldown:25},
 illusion:{name:'Veil Doubles',description:'Conjure two short-lived doubles that draw attacks and deal reduced damage.',cooldown:35},
 heal:{name:'Renewal',description:'Restore health to nearby friendly units.',cooldown:18}
} as const;
