import { length2D } from './geometry';
import type { Cost, Entity, GameState, ResourceKind } from './types';
import type { EconomyState } from './economy-types';
export const RESOURCE_KINDS:ResourceKind[]=['wood','ore','crystal'];
export const zeroCost=():Cost=>({wood:0,ore:0,crystal:0});
export const costTotal=(c:Cost)=>c.wood+c.ore+c.crystal;
export function addCost(target:Cost,cost:Cost):void{for(const kind of RESOURCE_KINDS)target[kind]+=cost[kind];}
export function subCost(target:Cost,cost:Cost):void{for(const kind of RESOURCE_KINDS)target[kind]=Math.max(0,target[kind]-cost[kind]);}
export function hasCost(target:Cost,cost:Cost):boolean{return RESOURCE_KINDS.every(kind=>target[kind]+1e-8>=cost[kind]);}
export function payCost(target:Cost,cost:Cost):boolean{if(!hasCost(target,cost))return false;subCost(target,cost);return true;}
export function takeCost(source:Cost,capacity:number):Cost{const result=zeroCost();for(const kind of RESOURCE_KINDS){const amount=Math.min(source[kind],Math.max(0,capacity-costTotal(result)));result[kind]=amount;source[kind]=Math.max(0,source[kind]-amount);}return result;}
export function economicState(s:GameState):EconomyState|undefined{return (s as GameState & {economy?:EconomyState}).economy;}
export function createEconomyState(playerCount:number):EconomyState {
 return {version:1,groves:[],structures:[],caravans:[],cargo:[],tasks:[],salvage:[],markets:[],villages:[],contracts:[],specializations:[],workerWarehouses:[],deepSites:[],deathClaims:[],paidCosts:[],recruits:[],ledgers:Array.from({length:playerCount},()=>({gathered:zeroCost(),delivered:zeroCost(),traded:zeroCost(),raided:zeroCost(),salvaged:zeroCost(),contractRewards:zeroCost()}))};
}
export function ensureEconomy(s:GameState):EconomyState {
 const existing=economicState(s);if(existing)return existing;
 const economy=createEconomyState(s.players.length);
 (s as GameState & {economy?:EconomyState}).economy=economy;return economy;
}
export function economyStock(s:GameState,economy:EconomyState,id:number):Cost|undefined{const entity=s.entities.find(e=>e.id===id&&e.hp>0&&e.kind==='building'&&e.progress===1&&(e.role==='hq'||e.role==='depot'));if(!entity)return undefined;return economy.structures.find(item=>item.entityId===id&&item.kind==='warehouse')?.stock??s.players[entity.side];}
export const levelOf=(p:{level?:number})=>p.level??0;
export const sameLevel=(a:{level?:number},b:{level?:number})=>levelOf(a)===levelOf(b);
export const distance=(a:{x:number;y:number;level?:number},b:{x:number;y:number;level?:number})=>sameLevel(a,b)?length2D(a.x-b.x,a.y-b.y):Infinity;
export function economyMessage(s:GameState,e:Entity,text:string,target?:number):void{s.events.push({type:'message',x:e.x,y:e.y,level:levelOf(e),side:e.side,source:e.id,text,...(target===undefined?{}:{target})});}
