import { registerGameImprovement } from '../../core/improvements';
import type { UpgradeDef } from '../../core/types';

/** Definitions are immutable; researching them changes only the match's player. */
export const MILITARY_UPGRADES:UpgradeDef[]=([
 {id:'ranged-drills',name:'Ranged Drills',description:'Ranged troops deal 20% more damage.',appliesTo:'ranged',age:2,cost:{wood:100,ore:130,crystal:0},effects:{damage:1.2}},
 {id:'pike-drills',name:'Pike Drills',description:'Pikes gain 2 armor and deal 15% more damage.',appliesTo:'spear',age:2,cost:{wood:80,ore:150,crystal:0},effects:{damage:1.15,armor:2}},
 {id:'cavalry-drills',name:'Cavalry Drills',description:'Cavalry move 15% faster and deal 15% more damage.',appliesTo:'cavalry',age:2,cost:{wood:140,ore:130,crystal:0},effects:{damage:1.15,speed:1.15}},
 {id:'specialist-drills',name:'Specialist Drills',description:'Specialists gain 1 armor and deal 20% more damage.',appliesTo:'special',age:2,cost:{wood:120,ore:150,crystal:25},effects:{damage:1.2,armor:1}},
 {id:'siege-drills',name:'Siege Drills',description:'Siege deals 25% more damage, including its building bonus.',appliesTo:'siege',age:3,requires:['citadel-age'],cost:{wood:160,ore:220,crystal:35},effects:{damage:1.25}},
] satisfies Omit<UpgradeDef,'improvement'|'building'|'researchTime'>[]).map((def):UpgradeDef=>({...def,improvement:'feature-041',building:'barracks',researchTime:40}));
registerGameImprovement({id:'feature-041',initialState:()=>null});
