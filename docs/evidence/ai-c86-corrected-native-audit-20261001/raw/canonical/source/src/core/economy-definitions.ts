import type { BuildingDef, UnitDef } from './types';
export const ECONOMY_RULES = {
 grove:{cost:{wood:8,ore:0,crystal:0},plantSeconds:4,growthSeconds:60,wood:100,limit:200},
 caravan:{cost:{wood:90,ore:35,crystal:0},capacity:90,trainSeconds:18},
 warehouse:{cost:{wood:130,ore:35,crystal:0},capacity:900},
 extractor:{cost:{wood:100,ore:90,crystal:15},normalGather:1.15,overchargeGather:1.9,incidentSeconds:12,incidentChance:.5,incidentDamage:75},
 deepMine:{cost:{wood:180,ore:200,crystal:20},yield:800},
 specialization:{cost:{wood:120,ore:80,crystal:30},radius:12,mining:1.3,military:1.3,research:1.35},
 market:{stock:1500,basePrices:{wood:1,ore:1.5,crystal:3},sellFactor:.65,recoveryPerSecond:.02},
 raid:{capacity:24,channelSeconds:3},salvage:{channelSeconds:2,expiresSeconds:120},
 contract:{amount:60,deadlineSeconds:180,reward:{wood:35,ore:25,crystal:10},villagePool:{wood:210,ore:150,crystal:60}}
} as const;
const depot=(kind:'warehouse'|'extractor'|'deep-mine',name:string,cost:BuildingDef['cost'],hp:number,buildTime:number,description:string):BuildingDef=>({id:`economy:${kind}`,name,role:'depot',cost:{...cost},hp,size:2,buildTime,sight:7,description});
export const ECONOMY_BUILDINGS = {
 warehouse:depot('warehouse','Regional warehouse',ECONOMY_RULES.warehouse.cost,720,26,'Holds 900 local resources. Assigned workers deposit here; caravans move stock to other settlements.'),
 extractor:depot('extractor','Crystal extractor',ECONOMY_RULES.extractor.cost,650,30,'Nearby crystal workers harvest faster. Overcharge increases output but can damage the extractor every 12 seconds.'),
 'deep-mine':depot('deep-mine','Deep mine',ECONOMY_RULES.deepMine.cost,800,38,'Extends one depleted ore deposit with a finite reserve of up to 800 ore.')
} satisfies Record<string,BuildingDef>;
export const ECONOMY_CARAVAN:UnitDef={id:'economy:caravan',name:'Trade caravan',role:'worker',cost:{...ECONOMY_RULES.caravan.cost},hp:150,damage:0,armor:1,range:0,speed:1.8,cooldown:2,trainTime:ECONOMY_RULES.caravan.trainSeconds,sight:6,description:'Carries up to 90 resources on physical delivery and trade routes. Losing the caravan drops its remaining cargo.'};
