import type { BuildingDef, Cost, Entity, GameState, ResourceKind, Side, UnitDef, Vec } from './types';

export type EconomyBuilding = 'warehouse' | 'extractor' | 'deep-mine';
export type SettlementSpecialization = 'mining' | 'military' | 'research';
export interface EconomyStructure { entityId:number; kind:EconomyBuilding; resourceId?:number; stock:Cost; capacity:number; overcharge:boolean; nextIncident:number }
export interface Grove extends Vec {id:number;side:Side;plantedAt:number;maturesAt:number;burned:boolean;resourceId?:number}
export interface EconomyCargo {entityId:number;stock:Cost;capacity:number;origin:'delivery'|'trade'|'raid'|'salvage'|'contract';sourceId?:number;destinationId?:number;tradeValue:number;contractId?:number}
export type EconomyTask = {entityId:number;kind:'plant';targetId:number;progress:number} | {entityId:number;kind:'collect';targetId:number;progress:number} | {entityId:number;kind:'raid';targetId:number;progress:number} | {entityId:number;kind:'route';targetId:number;sourceId:number;progress:number;repeat:boolean;phase:'loading'|'delivery';amount:Cost;contractId?:number};
export interface Salvage extends Vec {id:number;stock:Cost;expiresAt:number;owner:Side|null;kind:'salvage'|'cargo'}
export interface EconomyMarket extends Vec {id:number;stock:Cost;demand:Cost;recoverAt:number}
export interface ResourceContract {id:number;villageId:number;x:number;y:number;level?:number;side:Side|null;kind:ResourceKind;amount:number;delivered:number;deadline:number;reward:Cost;status:'open'|'accepted'|'complete'|'expired'}
export interface EconomyVillage extends Vec {id:number;rewardPool:Cost}
export interface EconomyLedger {gathered:Cost;delivered:Cost;traded:Cost;raided:Cost;salvaged:Cost;contractRewards:Cost}
export interface EconomyState {version:1;groves:Grove[];structures:EconomyStructure[];caravans:number[];cargo:EconomyCargo[];tasks:EconomyTask[];salvage:Salvage[];markets:EconomyMarket[];villages:EconomyVillage[];contracts:ResourceContract[];specializations:{entityId:number;kind:SettlementSpecialization}[];workerWarehouses:{entityId:number;warehouseId:number}[];deepSites:number[];deathClaims:number[];paidCosts:{entityId:number;stock:Cost}[];recruits:{producerId:number;side:Side;readyAt:number}[];ledgers:EconomyLedger[]}
export type EconomyCommand =
 | {type:'plantGrove';ids:number[];x:number;y:number;level?:number}
 | {type:'buildEconomy';ids:number[];kind:'warehouse';x:number;y:number;level?:number}
 | {type:'buildEconomy';ids:number[];kind:'extractor'|'deep-mine';target:number}
 | {type:'setOvercharge';id:number;enabled:boolean}
 | {type:'trainCaravan';id:number}
 | {type:'tradeRoute';id:number;source:number;target:number;kind:ResourceKind;amount:number;repeat:boolean}
 | {type:'deliverStock';id:number;source:number;target:number;stock:Cost}
 | {type:'marketTrade';market:number;kind:ResourceKind;amount:number;direction:'buy'|'sell'}
 | {type:'raidSupply';ids:number[];target:number}
 | {type:'collectSalvage';ids:number[];target:number}
 | {type:'setWarehouse';ids:number[];target:number|null}
 | {type:'specializeSettlement';id:number;kind:SettlementSpecialization}
 | {type:'acceptContract';id:number}
 | {type:'deliverContract';id:number;contract:number;source:number};
export interface EconomyHooks { visible:(s:GameState,side:Side,p:Vec)=>boolean; allied:(s:GameState,a:Side,b:Side)=>boolean; spawn:(s:GameState,side:Side,kind:Entity['kind'],role:Entity['role'],x:number,y:number,progress?:number)=>Entity; assign:(s:GameState,e:Entity,order:Entity['order'])=>void; move:(s:GameState,e:Entity,target:Vec,dt:number,reach:number)=>boolean; canPlace:(s:GameState,side:Side,x:number,y:number,level?:number)=>boolean; radius:(s:GameState,e:Entity)=>number; buildingDef:(s:GameState,e:Entity)=>BuildingDef; unitDef:(s:GameState,e:Entity)=>UnitDef }
export interface EconomyView {version:1;deepSites:number[];recruits:{producerId:number;readyAt:number}[];groves:Grove[];structures:(EconomyStructure & Vec & {hp:number;maxHp:number;progress:number;side:Side})[];caravans:(EconomyCargo & Vec & {side:Side;hp:number;maxHp:number;task?:EconomyTask})[];salvage:Salvage[];markets:(EconomyMarket & {prices:Cost})[];contracts:ResourceContract[];specializations:{entityId:number;kind:SettlementSpecialization}[];workerWarehouses:{entityId:number;warehouseId:number}[];ledger:EconomyLedger}
