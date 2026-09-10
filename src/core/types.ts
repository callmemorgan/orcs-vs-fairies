export type FactionId = 'orcs' | 'fairies' | 'dwarves' | 'undead' | 'tideborn' | 'automata';
export type Side = 0 | 1;
export type Controller = 'human' | 'ai' | 'external';
export type MapSize = 'small' | 'medium' | 'large';
export type TerrainKind = 'grass' | 'road' | 'mud' | 'shallows' | 'water' | 'rock' | 'bridge';
export interface GameOptions { controllers?:[Controller,Controller]; mapSize?:MapSize }
export type UnitRole = 'worker' | 'melee' | 'ranged' | 'special';
export type BuildingRole = 'hq' | 'depot' | 'barracks' | 'tower';
export type ResourceKind = 'wood' | 'ore' | 'crystal';
export interface Vec { x:number; y:number }
export interface Cost { wood:number; ore:number; crystal:number }
export interface UnitDef { id:string; name:string; role:UnitRole; cost:Cost; hp:number; shield?:number; damage:number; buildingDamageMultiplier?:number; armor:number; range:number; speed:number; cooldown:number; trainTime:number; sight:number; ability?:'momentum'|'illusion'|'heal'|'entrench'|'raise'|'surge'|'ward'; description:string }
export interface BuildingDef { id:string; name:string; role:BuildingRole; cost:Cost; hp:number; size:number; buildTime:number; sight:number; description:string; ability?:'heal' }
export interface FactionDef { id:FactionId; name:string; subtitle:string; color:number; accent:string; description:string; terrainSpeeds?:Partial<Record<TerrainKind,number>>; units:Record<UnitRole,UnitDef>; buildings:Record<BuildingRole,BuildingDef>; ai:{aggression:number; armySize:number; composition?:Record<Exclude<UnitRole,'worker'>,number>} }
export type Order = {type:'idle'|'hold'} | {type:'move'|'attackMove';x:number;y:number} | {type:'attack'|'gather'|'build';target:number};
export interface Entity extends Vec { id:number; side:Side; kind:'unit'|'building'; role:UnitRole|BuildingRole; hp:number; maxHp:number; order:Order; cooldown:number; progress:number; queue:UnitRole[]; trainProgress:number; facing:number; animation:'idle'|'walk'|'attack'|'death'; animTime:number; momentum:number; illusion:boolean; expires:number; carried:number; carriedKind:ResourceKind; path:Vec[]; lastAttacker?:number; abilityReadyAt?:number; entrenchedAt?:number; raised?:boolean; shield?:number; maxShield?:number; lastDamagedAt?:number; surgeUntil?:number }
export interface ResourceNode extends Vec {id:number;kind:ResourceKind;amount:number;maxAmount:number}
export interface Player { faction:FactionId; wood:number; ore:number; crystal:number; population:number; cap:number }
export interface GameEvent {type:'attack'|'death'|'build'|'train'|'gather'|'message'|'ability';x:number;y:number;side:Side;text?:string;target?:number; source?:number;amount?:number;resource?:ResourceKind}
export interface Corpse extends Vec { id:number; expires:number }
export interface GameState { controllers:[Controller,Controller]; mapSize:MapSize; mapVersion:number; terrain:TerrainKind[]; starts:[Vec,Vec]; draw:boolean; tick:number; corpses:Corpse[]; time:number; seed:number; width:number; height:number; entities:Entity[]; resources:ResourceNode[]; players:[Player,Player]; winner:Side|null; events:GameEvent[]; explored:[Set<number>,Set<number>]; visible:[Set<number>,Set<number>]; nextId:number }
export type Command = {type:'move'|'attackMove';ids:number[];x:number;y:number} | {type:'attack'|'gather'|'repair';ids:number[];target:number} | {type:'build';ids:number[];role:BuildingRole;x:number;y:number} | {type:'train';id:number;role:UnitRole} | {type:'stop'|'hold';ids:number[]} | {type:'ability';ids:number[]};
