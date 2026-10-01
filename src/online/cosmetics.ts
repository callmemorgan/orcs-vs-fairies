import type { FactionId, Side } from '../core/types';
export type CosmeticSlot='banner'|'decoration'|'portrait';
export interface Cosmetic {id:string;factionId:FactionId;slot:CosmeticSlot;name:string;requiresWins:number}
export interface CosmeticEquipment {banner:string|null;decoration:string|null;portrait:string|null}
export interface CosmeticProfile {owned:string[];wins:Partial<Record<FactionId,number>>;equipment:Partial<Record<FactionId,{revision:number;loadout:CosmeticEquipment}>>}
const factionNames:Record<FactionId,string>={orcs:'Ironclad',fairies:'Wild Court',dwarves:'Deepforge',undead:'Ashen Host',tideborn:'Tideborn',automata:'Automata'};
export const COSMETICS:ReadonlyArray<Cosmetic>=Object.entries(factionNames).flatMap(([factionId,name])=>[
  {id:`${factionId}-victory-banner`,factionId:factionId as FactionId,slot:'banner' as const,name:`${name} victory banner`,requiresWins:1},
  {id:`${factionId}-honor-seal`,factionId:factionId as FactionId,slot:'decoration' as const,name:`${name} honor seal`,requiresWins:3},
  {id:`${factionId}-commander`,factionId:factionId as FactionId,slot:'portrait' as const,name:`${name} commander portrait`,requiresWins:5},
]);
export const EMPTY_COSMETIC_EQUIPMENT:Readonly<CosmeticEquipment>={banner:null,decoration:null,portrait:null};
export interface MatchCosmeticEquipment {side:Side;factionId:FactionId;loadout:CosmeticEquipment}
