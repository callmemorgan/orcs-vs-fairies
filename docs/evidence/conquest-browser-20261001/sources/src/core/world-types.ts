import type { Cost, MapSize, ResourceKind, Side, TerrainKind, Vec } from './types';

export type Biome = 'temperate' | 'desert' | 'marsh' | 'snow' | 'forest';
export interface WorldPoint extends Vec { level:number }
export interface WorldLevel { id:number; title:string; terrain:TerrainKind[]; elevation:number[] }
export interface WorldTransition { id:number; from:WorldPoint; to:WorldPoint }
export interface WorldMapData {
 width:number; height:number; size:MapSize; seed:number;
 levels:WorldLevel[];
 starts:(WorldPoint & {slot:number})[];
 resources:(WorldPoint & {kind:ResourceKind;amount:number;maxAmount:number})[];
 sites:(WorldPoint & {id:number;kind:'relic'|'village'|'monster'})[];
 transitions:WorldTransition[];
}
export interface WorldBridge extends WorldPoint { id:number; hp:number; maxHp:number; tiles:number[]; rebuilding:number; repairSide:Side|null }
export interface WorldFire extends WorldPoint { heat:number; expires:number; nextSpread:number }
export interface NeutralCreature extends WorldPoint {id:number;site:number;hp:number;maxHp:number;cooldown:number;target:number|null;path:Vec[];patrol:number;respawnAt:number}
export interface WorldSite extends WorldPoint {id:number;kind:'relic'|'village'|'monster';owner:Side|null;loyalty:number[];progress:number;capturing:Side|null;reward:Cost;rewarded:Side[];request:Cost;supplied:boolean;creatureIds:number[];respawnAt:number}
export interface WorldState {
 version:1; biome:Biome; levels:WorldLevel[]; transitions:WorldTransition[];
 bridges:WorldBridge[]; fires:WorldFire[]; sites:WorldSite[]; creatures:NeutralCreature[];
 dayLength:number; seasonLength:number; weatherLength:number; nextEnvironmentAt:number;
 iceTiles:{level:number;tile:number}[]; thawWarned:boolean;
}
export type WorldCommand =
 | {type:'traverse';ids:number[];transition:number}
 | {type:'worldAttack'|'repairBridge'|'captureSite'|'supportVillage'|'recruitVillage';ids:number[];target:number}
 | {type:'ignite'|'firebreak';ids:number[];x:number;y:number;level?:number};
