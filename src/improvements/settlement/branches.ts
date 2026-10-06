import { registerGameImprovement } from '../../core/improvements';
import type { UpgradeDef, UnitRole } from '../../core/types';
const army:UnitRole[]=['melee','ranged','spear','cavalry','special','siege'];
export const BRANCH_UPGRADES:UpgradeDef[]=([
 {id:'rapid-assault',name:'Rapid Assault',description:'All military units gain 15% damage and 20% speed, but lose 1 armor. Permanently excludes Fortified Ranks.',branch:'military-doctrine',appliesTo:army,building:'barracks',age:2,cost:{wood:180,ore:200,crystal:30},researchTime:50,effects:{damage:1.15,speed:1.2,armor:-1}},
 {id:'fortified-ranks',name:'Fortified Ranks',description:'All military units gain 2 armor, but move 15% slower. Permanently excludes Rapid Assault.',branch:'military-doctrine',appliesTo:army,building:'barracks',age:2,cost:{wood:180,ore:200,crystal:30},researchTime:50,effects:{armor:2,speed:.85}},
 {id:'bulk-harvest',name:'Bulk Harvest',description:'Workers gather 25% faster, but move 15% slower. Permanently excludes Swift Haul.',branch:'economic-doctrine',appliesTo:'worker',building:'hq',age:2,cost:{wood:150,ore:100,crystal:0},researchTime:40,effects:{gather:1.25,speed:.85}},
 {id:'swift-haul',name:'Swift Haul',description:'Workers move 25% faster, but gather 10% slower. Permanently excludes Bulk Harvest.',branch:'economic-doctrine',appliesTo:'worker',building:'hq',age:2,cost:{wood:150,ore:100,crystal:0},researchTime:40,effects:{gather:.9,speed:1.25}},
] satisfies Omit<UpgradeDef,'improvement'>[]).map(def=>({...def,improvement:'feature-042'}));
registerGameImprovement({id:'feature-042',initialState:()=>null});
