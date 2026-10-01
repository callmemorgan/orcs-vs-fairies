import { entityDefinition, unitFor } from './content-registry';
import type { Entity, GameState, Side, UnitRole } from './types';
import type { ArtifactDefinitionId, ArtifactItem, EquipmentSlot, PromotionId, VeteranState } from './specialist-types';
export const RANK_THRESHOLDS=[0,40,100,200] as const;
export const PROMOTIONS:Record<PromotionId,{name:string;description:string;roles:UnitRole[];damage?:number;speed?:number;armor?:number;range?:number}>={
 vanguard:{name:'Vanguard',description:'Deal 15% more damage.',roles:['melee','spear'],damage:1.15},bulwark:{name:'Bulwark',description:'Gain 3 armor.',roles:['melee','spear','cavalry','special'],armor:3},
 skirmisher:{name:'Skirmisher',description:'Move 15% faster.',roles:['melee','spear','special'],speed:1.15},sharpshooter:{name:'Sharpshooter',description:'Gain 1 weapon range.',roles:['ranged','special'],range:1},pathfinder:{name:'Pathfinder',description:'Move 20% faster.',roles:['ranged','cavalry'],speed:1.2},cavalier:{name:'Cavalier',description:'Deal 20% more damage.',roles:['cavalry'],damage:1.2},
 'siege-master':{name:'Siege Master',description:'Deal 20% more damage.',roles:['siege'],damage:1.2},engineer:{name:'Field Engineer',description:'Move 20% faster and gain 1 armor.',roles:['siege','worker'],speed:1.2,armor:1},medic:{name:'Battle Medic',description:'Gain 2 armor.',roles:['worker','special'],armor:2},
};
export const ARTIFACTS:Record<ArtifactDefinitionId,{name:string;slot:EquipmentSlot;roles:UnitRole[];damage?:number;speed?:number;armor?:number;range?:number}>={
 'core:ember-blade':{name:'Ember Blade',slot:'weapon',roles:['special','melee','cavalry'],damage:1.25},
 'core:iron-aegis':{name:'Iron Aegis',slot:'armor',roles:['special','melee','spear','cavalry'],armor:4},
 'core:wind-charm':{name:'Wind Charm',slot:'trinket',roles:['special','ranged','cavalry'],speed:1.25},
};
function eligible(e:Entity):boolean{return e.kind==='unit'&&!e.illusion&&!e.raised;}
export function veteranRank(experience:number):0|1|2|3 {return experience>=200?3:experience>=100?2:experience>=40?1:0;}
function award(s:GameState,e:Entity,amount:number):void{
 const v=e.veteran??={experience:0,rank:0,nextSurvivalAt:s.time+60,lastCombatAt:s.time,promotions:[]};v.experience=Math.min(300,v.experience+amount);v.rank=veteranRank(v.experience);v.lastCombatAt=s.time;
 const pending=([1,2,3] as const).find(rank=>rank<=v.rank&&!v.promotions.some(p=>p.rank===rank));if(pending)v.pendingPromotion=pending;
}
/** Credit only damage paid by living hostile actors; decoys and disposable summons cannot farm ranks. */
export function creditCombat(s:GameState,attacker:Entity,target:Entity,amount:number,killed=false):void{
 if(!eligible(attacker)||attacker.hp<=0||target.illusion||target.raised||s.teams[attacker.side]===s.teams[target.side]||amount<=0)return;
 award(s,attacker,Math.min(30,amount*.3)+(killed?(target.kind==='building'?25:target.role==='worker'?8:18):0));
}
export function stepVeterans(s:GameState):void {for(const e of s.entities){const v=e.veteran;if(!v||!eligible(e)||e.hp<=0)continue;if(s.time>=v.nextSurvivalAt){v.nextSurvivalAt=s.time+60;if(s.time-v.lastCombatAt<20)award(s,e,5);}}}
export function promotionChoices(s:GameState,e:Entity):PromotionId[]{if(!e.veteran?.pendingPromotion)return [];return (Object.keys(PROMOTIONS) as PromotionId[]).filter(id=>PROMOTIONS[id].roles.includes(unitFor(s,e).role));}
export function promote(s:GameState,side:Side,id:number,promotion:PromotionId):boolean {const e=s.entities.find(e=>e.id===id&&e.side===side&&e.hp>0),v=e?.veteran;if(!e||!eligible(e)||!v?.pendingPromotion||!promotionChoices(s,e).includes(promotion))return false;v.promotions.push({rank:v.pendingPromotion,id:promotion});delete v.pendingPromotion;const next=([1,2,3] as const).find(rank=>rank<=v.rank&&!v.promotions.some(p=>p.rank===rank));if(next)v.pendingPromotion=next;s.events.push({type:'message',side,x:e.x,y:e.y,source:e.id,text:`${unitFor(s,e).name} promoted to ${PROMOTIONS[promotion].name}.`});return true;}
export function specialistState(s:GameState){return s.specialists??={artifacts:[],structures:[],nextArtifactId:1,nextStructureId:1};}
function equipmentEligible(s:GameState,e:Entity):boolean{return eligible(e)&&!!unitFor(s,e).tags?.some(tag=>tag==='hero'||tag==='engineer');}
export function createArtifact(s:GameState,definitionId:ArtifactDefinitionId,position:Entity|{x:number;y:number}):ArtifactItem {const state=specialistState(s),item:ArtifactItem={id:state.nextArtifactId++,definitionId,position:{x:position.x,y:position.y}};state.artifacts.push(item);return item;}
export function recoverArtifact(s:GameState,side:Side,id:number,artifact:number):boolean {const e=s.entities.find(e=>e.id===id&&e.side===side&&e.hp>0),item=s.specialists?.artifacts.find(item=>item.id===artifact);if(!e||!equipmentEligible(s,e)||!item?.position||item.holder!==undefined||item.owner!==undefined&&item.owner!==side||Math.hypot(e.x-item.position.x,e.y-item.position.y)>2)return false;const tile=Math.floor(item.position.y)*s.width+Math.floor(item.position.x);if(!s.visible[side].has(tile))return false;item.owner=side;item.holder=e.id;delete item.position;return true;}
export function equipArtifact(s:GameState,side:Side,id:number,artifact:number):boolean {const e=s.entities.find(e=>e.id===id&&e.side===side&&e.hp>0),item=s.specialists?.artifacts.find(item=>item.id===artifact),def=item?ARTIFACTS[item.definitionId]:undefined;if(!e||!equipmentEligible(s,e)||!item||!def||item.owner!==side||item.holder!==e.id||!def.roles.includes(unitFor(s,e).role))return false;e.equipment??={};e.equipment[def.slot]=artifact;return true;}
export function unequipArtifact(s:GameState,side:Side,id:number,slot:EquipmentSlot):boolean {const e=s.entities.find(e=>e.id===id&&e.side===side&&e.hp>0);if(!e?.equipment?.[slot])return false;delete e.equipment[slot];return true;}
export function dropArtifacts(s:GameState,e:Entity):void {for(const item of s.specialists?.artifacts??[])if(item.holder===e.id){delete item.holder;delete item.owner;item.position={x:e.x,y:e.y};}delete e.equipment;}
export function progressionStats(s:GameState,e:Entity):{damageFactor:number;speedFactor:number;armor:number;range:number} {
 let damageFactor=1+(e.veteran?.rank??0)*.05,speedFactor=1,armor=e.veteran?.rank??0,range=0;
 for(const promotion of e.veteran?.promotions??[]){const p=PROMOTIONS[promotion.id];damageFactor*=p.damage??1;speedFactor*=p.speed??1;armor+=p.armor??0;range+=p.range??0;}
 for(const artifact of Object.values(e.equipment??{})){const item=s.specialists?.artifacts.find(item=>item.id===artifact);if(!item||item.holder!==e.id)continue;const d=ARTIFACTS[item.definitionId];damageFactor*=d.damage??1;speedFactor*=d.speed??1;armor+=d.armor??0;range+=d.range??0;}
 for(const buff of e.specialistBuffs??[]){if(buff.until<=s.time)continue;damageFactor*=buff.damageFactor??1;speedFactor*=buff.rooted?0:buff.speedFactor??1;armor+=buff.armor??0;}
 return {damageFactor,speedFactor,armor,range};
}
/** Deterministic finite drop: one artifact from each hostile commander's death. */
export function commanderArtifact(s:GameState,e:Entity):void{if(e.kind==='unit'&&unitFor(s,e).tags?.includes('hero'))createArtifact(s,(['core:ember-blade','core:iron-aegis','core:wind-charm'] as ArtifactDefinitionId[])[e.id%3],e);}
export function observedArtifacts(s:GameState,side:Side):ArtifactItem[]{return (s.specialists?.artifacts??[]).filter(item=>item.owner===side||item.position&&s.visible[side].has(Math.floor(item.position.y)*s.width+Math.floor(item.position.x))).map(item=>({...item,position:item.position?{...item.position}:undefined}));}
