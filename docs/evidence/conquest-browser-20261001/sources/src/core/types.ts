import type { MatchRules, MatchRulesInput, ObjectiveState, DraftState } from './match-rules';
export type { MatchRules, MatchRulesInput, ObjectiveState, DraftState } from './match-rules';
import type { AiConfig } from './ai-policy';
import type { Biome, WorldCommand, WorldMapData, WorldState } from './world-types';
export type FactionId = 'orcs' | 'fairies' | 'dwarves' | 'undead' | 'tideborn' | 'automata';
export type Side = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TeamId = Side;
export type Controller = 'human' | 'ai' | 'external';
export type MapSize = 'small' | 'medium' | 'large' | 'huge';
export type TerrainKind = 'grass' | 'road' | 'mud' | 'shallows' | 'water' | 'rock' | 'bridge' | 'sand' | 'snow' | 'forest' | 'ice';
export interface GameOptions { controllers?:[Controller,Controller]; mapSize?:MapSize; ai?:Partial<AiConfig>[]; biome?:Biome; world?:WorldMapData }
export interface MatchPlayerConfig { id:Side; teamId:TeamId; factionId:FactionId; controller:Controller; ai?:Partial<AiConfig>; startingSlot?:number; handicap?:{startingResources?:Cost;incomeFactor?:number;populationCap?:number} }
export interface MatchConfig { schemaVersion?:1; map:{seed:number;size?:MapSize;biome?:Biome;world?:WorldMapData}; players:MatchPlayerConfig[]; rules?:MatchRulesInput; draft?:DraftState }
export type UnitRole = 'worker' | 'melee' | 'ranged' | 'special' | 'cavalry' | 'spear' | 'siege';
export type BuildingRole = 'hq' | 'depot' | 'barracks' | 'tower' | 'wall' | 'gate';
export type ResourceKind = 'wood' | 'ore' | 'crystal';
export type Age = 1 | 2 | 3;
export type UpgradeId = 'worker-harvest' | 'worker-speed' | 'town-age' | 'citadel-age' | 'forged-weapons' | 'tempered-armor' | 'veteran-arms';
export interface Vec { x:number; y:number; level?:number }
export interface Cost { wood:number; ore:number; crystal:number }
export interface UpgradeDef { id:UpgradeId; name:string; description:string; cost:Cost; researchTime:number; building:BuildingRole; appliesTo:UnitRole; age?:Age; requires?:UpgradeId[]; advancesTo?:Age; effects:{gather?:number;speed?:number;damage?:number;armor?:number} }
export interface UnitDef { id:string; name:string; role:UnitRole; cost:Cost; hp:number; shield?:number; damage:number; buildingDamageMultiplier?:number; age?:Age; bonusAgainst?:Partial<Record<UnitRole,number>>; armor:number; range:number; speed:number; cooldown:number; trainTime:number; sight:number; ability?:'momentum'|'illusion'|'heal'|'entrench'|'raise'|'surge'|'ward'; description:string }
export interface BuildingDef { age?:Age; id:string; name:string; role:BuildingRole; cost:Cost; hp:number; size:number; buildTime:number; sight:number; description:string; ability?:'heal' }
export interface FactionDef { id:FactionId; name:string; subtitle:string; color:number; accent:string; description:string; terrainSpeeds?:Partial<Record<TerrainKind,number>>; units:Record<UnitRole,UnitDef>; buildings:Record<BuildingRole,BuildingDef>; ai:{aggression:number; armySize:number; composition?:Partial<Record<Exclude<UnitRole,'worker'>,number>>} }
export type Order = {type:'idle'|'hold'} | ({type:'move'|'attackMove'} & Vec) | {type:'attack'|'gather'|'build'|'worldAttack'|'repairBridge'|'captureSite'|'supportVillage'|'recruitVillage';target:number} | {type:'traverse';transition:number};
export interface Entity extends Vec { id:number; side:Side; kind:'unit'|'building'; role:UnitRole|BuildingRole; hp:number; maxHp:number; order:Order; orderQueue?:Order[]; cooldown:number; progress:number; queue:UnitRole[]; trainProgress:number; research?:UpgradeId; researchProgress:number; rally?:Vec; gateOpen?:boolean; facing:number; animation:'idle'|'walk'|'attack'|'death'; animTime:number; momentum:number; illusion:boolean; expires:number; carried:number; carriedKind:ResourceKind; path:Vec[]; lastAttacker?:number; abilityReadyAt?:number; entrenchedAt?:number; raised?:boolean; shield?:number; maxShield?:number; lastDamagedAt?:number; surgeUntil?:number }
export interface ResourceNode extends Vec {id:number;kind:ResourceKind;amount:number;maxAmount:number}
export interface Player { faction:FactionId; wood:number; ore:number; crystal:number; population:number; cap:number; upgrades:UpgradeId[] }
export interface GameEvent extends Vec {type:'attack'|'death'|'build'|'train'|'gather'|'message'|'ability'|'research';side:Side;text?:string;target?:number; source?:number;amount?:number;resource?:ResourceKind}
export interface Corpse extends Vec { id:number; expires:number }
export interface GameState { world?:WorldState; rules:MatchRules; objectives:ObjectiveState; draft:DraftState; controllers:Controller[]; aiConfigs:AiConfig[]; teams:TeamId[]; incomeFactors:number[]; populationLimits:number[]; sharedVision:boolean; eliminated:boolean[]; winningTeam:TeamId|null; mapSize:MapSize; mapVersion:number; terrain:TerrainKind[]; starts:Vec[]; draw:boolean; tick:number; corpses:Corpse[]; time:number; seed:number; width:number; height:number; entities:Entity[]; resources:ResourceNode[]; players:Player[]; winner:Side|null; events:GameEvent[]; explored:Set<number>[]; visible:Set<number>[]; nextId:number }
export type Command = ({type:'draftChoice';definitionId:string} | {type:'collectRelic';id:number;relicId:number} | {type:'dropRelic';id:number} | ({type:'move'|'attackMove';ids:number[]} & Vec) | {type:'attack'|'gather'|'repair';ids:number[];target:number} | ({type:'build';ids:number[];role:BuildingRole} & Vec) | {type:'train';id:number;role:UnitRole} | {type:'cancelTrain';id:number;index:number} | {type:'reorderTrain';id:number;from:number;to:number} | {type:'research';id:number;upgrade:UpgradeId} | {type:'stop'|'hold';ids:number[]} | {type:'ability';ids:number[]} | ({type:'setRally';ids:number[]} & Vec) | {type:'clearRally';ids:number[]} | {type:'toggleGate';ids:number[]} | WorldCommand) & {queued?:boolean};
