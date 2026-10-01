import type { FactionId, Side, Vec } from './types';
export type PromotionId='vanguard'|'skirmisher'|'sharpshooter'|'pathfinder'|'cavalier'|'bulwark'|'siege-master'|'engineer'|'medic';
export interface VeteranState { experience:number; rank:0|1|2|3; nextSurvivalAt:number; lastCombatAt:number; pendingPromotion?:1|2|3; promotions:Array<{rank:1|2|3;id:PromotionId}> }
export type EquipmentSlot='weapon'|'armor'|'trinket';
export type ArtifactDefinitionId='core:ember-blade'|'core:iron-aegis'|'core:wind-charm';
export interface ArtifactItem { id:number;definitionId:ArtifactDefinitionId; owner?:Side;holder?:number;position?:Vec }
export interface HeroRecovery { definitionId:string;availableAt:number }
export interface BeaconState { connected:boolean;nextAlertAt:number }
export interface TemporaryFieldStructure { id:number;kind:'bridge'|'barricade';owner:Side;expires:number;entityId?:number;tiles?:Array<Vec & {previous:string;placed:string}> }
export interface SpecialistState {artifacts:ArtifactItem[];structures:TemporaryFieldStructure[];nextArtifactId:number;nextStructureId:number}
export type CommanderAbility='iron-command'|'queen-step'|'thane-ward'|'soul-drain'|'admiral-wave'|'prime-shield';
export type CavalryAbility='impact-fury'|'forest-leap'|'armored-brace'|'terror'|'wet-surge'|'shield-dash';
export type SiegeAbility='incendiary-shell'|'rooting-shell'|'ammunition-cannon'|'corpse-shell'|'flood-shell'|'powered-beam';
export type SpecialistAbility=CommanderAbility|CavalryAbility|SiegeAbility;
export interface SpecialistBuff {until:number;damageFactor?:number;speedFactor?:number;armor?:number;rooted?:boolean;fearedFrom?:Vec}
export interface DefinitionExtras {faction:FactionId;unitIds:string[];buildingIds:string[]}
