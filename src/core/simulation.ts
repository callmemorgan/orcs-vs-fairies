import { normalizeMatchRules, createDraft, applyDraftChoice, tickDraft, draftPlayers, definitionAllowed, validateDraftState } from './match-rules';
import { initializeObjectives, emptyObjectives, evaluateObjectives, collectRelic, dropRelic, objectiveAi } from './objectives';
import { DIRECTIONS_24, DIRECTIONS_32, facing8, length2D } from './geometry';
import { commanderArtifact, creditCombat, dropArtifact, dropArtifacts, equipArtifact, promote, progressionStats, recordCombatExposure, recoverArtifact, stepVeterans, unequipArtifact } from './unit-progression';
import { commanderDied, engineerBuild, fieldRepair, heroRecruitmentReason, launchSpecialistShot, resolveSpecialistShots, runSpecialistAI, specialistAbility, stepSpecialists, updateBeacons } from './specialist-systems';
import type { SpecialistHooks } from './specialist-systems';
import type { SpecialistSource } from './specialist-types';
import { aiProfile, chooseAiRecruit, counterWeights, normalizeAiConfig, openingBuilding, rememberObservedUnits, shouldRetreat, skipsAiDecision } from './ai-policy';
import type { EnemyMemory, EnemyObservation } from './ai-policy';
import { buildingAgeRequired, canCompleteResearch, playerAge, researchRequirement, upgradeAppliesTo } from './progression';
import { ECONOMY, FACTIONS, UPGRADES } from './content';
import { availableBuildings, availableUnits, buildingFor, contentFactions, decodeContentBundle, factionFor, isNormalBuildingDefinition, queuedUnitFor, unitFor, upgradeFor } from './content-registry';
import { walkable, segmentWalkable, openDestination, route } from './navigation';
import { generateMatchMap, terrainAt, TERRAIN } from './maps';
import { notifyCommand, notifyStep } from './history-hooks';
import { validateCommand } from './commands';
import { BIOMES, fogKey, generatedMapFromWorld, generateWorldMap, highGroundDamageFactor, highGroundRangeBonus, highGroundSightBonus, initializeWorld, levelOf, sameLevel, setWorldTerrain, terrainLineOfSight } from './world-map';
import { issueWorldAction, processWorldAction, stepWorldActions } from './world-actions';
import { environmentalMovementFactor, environmentalSightFactor, issueEnvironmentCommand, projectileEnvironment, stepEnvironment } from './environment';
import { initializeWorldSites, issueNeutralWorldCommand, processNeutralOrder, relicBonus, stepNeutralWorld } from './neutral-world';
import type { NeutralCreature, WorldCommand } from './world-types';
import type { BuildingDef, BuildingRole, Command, Cost, Entity, FactionId, GameOptions, GameState, MatchConfig, ResourceNode, Side, UnitDef, UnitRole, UpgradeId, Vec } from './types';

const distance = (a:Vec,b:Vec) => sameLevel(a,b)?length2D(a.x-b.x,a.y-b.y):Infinity;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
interface RetreatRecord { until:number; produced:number; afterId:number }
interface Runtime { aiBatchTurns:number; aiDecisionAt:number[]; aiDecisionTurns:number[]; knownEnemyUnits:EnemyMemory[]; retreating:Map<number,RetreatRecord>[]; producedFighters:number[]; stepping?:boolean; fog:number; ai:number; aiTurns:number; hits:{source:Entity|SpecialistSource;target:Entity;amount:number;event:GameState['events'][number]}[]; routes:Map<number,{key:string;at:number}>; abilities:Map<number,number>; returning:Set<number>; queuedGather:Set<number>; aiWave:number[]; initialScoutDispatched:boolean[]; expansionScout:(number|null)[]; expansionScoutDispatched:boolean[]; knownEnemyBuildings:Map<number,Vec & {role:string}>[]; enemyStartCleared:boolean[]; clearedEnemyStarts:Set<Side>[]; searched:Set<number>[] }
/** The complete simulation memory that is not stored on GameState itself. */
export interface RuntimeSnapshot {
 aiBatchTurns:number; aiDecisionAt:number[]; aiDecisionTurns:number[];
 knownEnemyUnits:[number,EnemyObservation][][]; retreating:[number,RetreatRecord][][]; producedFighters:number[];
 fog:number; ai:number; aiTurns:number;
 hits:{source:number;target:number;amount:number;event:number}[];
 routes:[number,{key:string;at:number}][];
 abilities:[number,number][]; returning:number[]; queuedGather:number[];
 aiWave:number[]; initialScoutDispatched:boolean[];
 expansionScout:(number|null)[]; expansionScoutDispatched:boolean[];
 knownEnemyBuildings:[number,Vec & {role:string}][][];
 enemyStartCleared:boolean[]; clearedEnemyStarts:Side[][]; searched:number[][];
}
const runtimes=new WeakMap<GameState,Runtime>();
function runtime(s:GameState):Runtime { let r=runtimes.get(s);if(!r){r={aiBatchTurns:0,aiDecisionAt:s.players.map(()=>0),aiDecisionTurns:s.players.map(()=>0),knownEnemyUnits:s.players.map(()=>new Map()),retreating:s.players.map(()=>new Map()),producedFighters:s.players.map(()=>0),fog:0,ai:0,aiTurns:0,hits:[],routes:new Map(),abilities:new Map(),returning:new Set(),queuedGather:new Set(),aiWave:s.players.map(()=>0),initialScoutDispatched:s.players.map(()=>false),expansionScout:s.players.map(()=>null),expansionScoutDispatched:s.players.map(()=>false),knownEnemyBuildings:s.players.map(()=>new Map()),enemyStartCleared:s.players.map(()=>false),clearedEnemyStarts:s.players.map(()=>new Set()),searched:s.players.map(()=>new Set())};runtimes.set(s,r);}return r; }
export function captureRuntime(s:GameState):RuntimeSnapshot {
 const r=runtime(s);
 return {aiBatchTurns:r.aiBatchTurns,aiDecisionAt:[...r.aiDecisionAt],aiDecisionTurns:[...r.aiDecisionTurns],knownEnemyUnits:r.knownEnemyUnits.map(memory=>[...memory].map(([id,o])=>[id,{...o}])),retreating:r.retreating.map(memory=>[...memory].map(([id,o])=>[id,{...o}])),producedFighters:[...r.producedFighters],fog:r.fog,ai:r.ai,aiTurns:r.aiTurns,hits:r.hits.map(h=>({source:h.source.id,target:h.target.id,amount:h.amount,event:s.events.indexOf(h.event)})),routes:[...r.routes].map(([id,value])=>[id,{...value}]),abilities:[...r.abilities],returning:[...r.returning],queuedGather:[...r.queuedGather],aiWave:[...r.aiWave],initialScoutDispatched:[...r.initialScoutDispatched],expansionScout:[...r.expansionScout],expansionScoutDispatched:[...r.expansionScoutDispatched],knownEnemyBuildings:r.knownEnemyBuildings.map(memory=>[...memory].map(([id,p])=>[id,{...p}])),enemyStartCleared:[...r.enemyStartCleared],clearedEnemyStarts:r.clearedEnemyStarts.map(players=>[...players]),searched:r.searched.map(tiles=>[...tiles])};
}
/** Restore only a snapshot already validated by the save loader. */
export function restoreRuntime(s:GameState,r:RuntimeSnapshot):void {
 const entities=new Map(s.entities.map(e=>[e.id,e]));
 const hits=r.hits.map(h=>{const source=entities.get(h.source),target=entities.get(h.target),event=s.events[h.event];if(!source||!target||!event)throw new Error('Save runtime has an invalid hit reference.');return {source,target,amount:h.amount,event};});
 runtimes.set(s,{aiBatchTurns:r.aiBatchTurns,aiDecisionAt:[...r.aiDecisionAt],aiDecisionTurns:[...r.aiDecisionTurns],knownEnemyUnits:r.knownEnemyUnits.map(memory=>new Map(memory.map(([id,o])=>[id,{...o}]))),retreating:r.retreating.map(memory=>new Map(memory.map(([id,o])=>[id,{...o}]))),producedFighters:[...r.producedFighters],fog:r.fog,ai:r.ai,aiTurns:r.aiTurns,hits,routes:new Map(r.routes.map(([id,value])=>[id,{...value}])),abilities:new Map(r.abilities),returning:new Set(r.returning),queuedGather:new Set(r.queuedGather),aiWave:[...r.aiWave],initialScoutDispatched:[...r.initialScoutDispatched],expansionScout:[...r.expansionScout],expansionScoutDispatched:[...r.expansionScoutDispatched],knownEnemyBuildings:r.knownEnemyBuildings.map(memory=>new Map(memory.map(([id,p])=>[id,{...p}])) ),enemyStartCleared:[...r.enemyStartCleared],clearedEnemyStarts:r.clearedEnemyStarts.map(players=>new Set(players)),searched:r.searched.map(tiles=>new Set(tiles))});
}
export const MAX_ORDER_QUEUE=32;
const alive=(e:Entity)=>e.hp>0;
function unitDef(s:GameState,e:Entity):UnitDef{return unitFor(s,e);}
function buildingDef(s:GameState,e:Entity):BuildingDef{return buildingFor(s,e);}
function radius(s:GameState,e:Entity):number{return e.kind==='building'?buildingDef(s,e).size/2:0.3;}
function near(s:GameState,a:Entity,b:Entity|ResourceNode,range:number):boolean{return distance(a,b)<=range+('kind' in b&&b.kind==='building'?radius(s,b):0);}
function emit(s:GameState,type:GameState['events'][number]['type'],e:Vec & {side:Side;id?:number},target?:number,text?:string){const event:GameState['events'][number]={type,x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level}),side:e.side,target,text,source:e.id};s.events.push(event);return event;}
export function spawnEntity(s:GameState,side:Side,kind:Entity['kind'],role:UnitRole|BuildingRole,x:number,y:number,progress=1,definitionId?:string,level=0):Entity{
 const def=kind==='unit'?unitFor(s,side,role as UnitRole,definitionId):buildingFor(s,side,role as BuildingRole,definitionId);
 const e:Entity={id:s.nextId++,side,kind,role,x,y,...(s.world||level?{level}:{}),hp:progress===1?def.hp:Math.max(1,def.hp*.1),maxHp:def.hp,order:{type:'idle'},cooldown:0,progress,queue:[],trainProgress:0,researchProgress:0,facing:2,animation:'idle',animTime:0,momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[]};if(s.content||definitionId)e.definitionId=def.id;if(kind==='unit'&&(def as UnitDef).shield){e.maxShield=(def as UnitDef).shield;e.shield=e.maxShield;}s.entities.push(e);return e;
}
export function playerSides(s:GameState):Side[]{return s.players.map((_,i)=>i as Side);}
export function isAllied(s:GameState,a:Side,b:Side):boolean{return !!s.players[a]&&!!s.players[b]&&s.teams[a]===s.teams[b];}
export function isHostile(s:GameState,a:Side,b:Side):boolean{return !!s.players[a]&&!!s.players[b]&&s.teams[a]!==s.teams[b];}
function matchObject(value:unknown,allowed:string[],name:string):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).some(k=>!allowed.includes(k)))throw new Error(`Invalid ${name}.`);return value as Record<string,unknown>;
}
function matchNumber(value:unknown,min:number,max:number,name:string,integer=false):number{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))throw new Error(`Invalid ${name}.`);return value;}
export function createMatch(config:MatchConfig,options:{scenario?:boolean}={}):GameState{
 const c=matchObject(config,['schemaVersion','map','players','rules','content','draft'],'match configuration');if(c.schemaVersion!==undefined&&c.schemaVersion!==1)throw new Error('Unsupported match configuration version.');
 const content=c.content===undefined?undefined:decodeContentBundle(c.content),factions=contentFactions(content);
 const m=matchObject(c.map,['seed','size','biome','world'],'match map');const seed=matchNumber(m.seed,0,0xffffffff,'map seed',true),size=m.size===undefined?'medium':m.size;if(!['small','medium','large','huge'].includes(size as string))throw new Error('Invalid map size.');
 if(!Array.isArray(c.players)||c.players.length<1||c.players.length>8)throw new Error('A match requires 1 to 8 players.');
 for(let i=0;i<c.players.length;i++)if(!Object.hasOwn(c.players,i))throw new Error('Player slots cannot contain gaps.');
 const rules=normalizeMatchRules(c.rules===undefined?{}:c.rules,content);
 const slots=new Set<number>(),teams:Side[]=[],incomeFactors:number[]=[],populationLimits:number[]=[];
 const definitions=c.players.map((value,i)=>{
  const p=matchObject(value,['id','teamId','factionId','controller','startingSlot','handicap','ai'],'player');if(p.id!==i)throw new Error('Player IDs must be ordered contiguous slots starting at zero.');
  teams.push(matchNumber(p.teamId,0,7,'team',true) as Side);if(typeof p.factionId!=='string'||!Object.hasOwn(factions,p.factionId))throw new Error('Unknown faction.');if(!['human','ai','external'].includes(p.controller as string))throw new Error('Unknown controller.');
  const slot=matchNumber(p.startingSlot===undefined?i:p.startingSlot,0,c.players instanceof Array?c.players.length-1:0,'starting slot',true);if(slots.has(slot))throw new Error('Starting slots must be unique.');slots.add(slot);
  const h=p.handicap===undefined?{}:matchObject(p.handicap,['startingResources','incomeFactor','populationCap'],'handicap');
  const resources=h.startingResources===undefined?rules.startingResources:matchObject(h.startingResources,['wood','ore','crystal'],'starting resources');
  const wood=matchNumber(resources.wood,0,1e9,'starting wood'),ore=matchNumber(resources.ore,0,1e9,'starting ore'),crystal=matchNumber(resources.crystal,0,1e9,'starting crystal');
  incomeFactors.push(matchNumber(h.incomeFactor===undefined?1:h.incomeFactor,0,10,'income factor'));populationLimits.push(matchNumber(h.populationCap===undefined?100:h.populationCap,1,500,'population cap',true));
  return {faction:p.factionId as FactionId,controller:p.controller as GameState['controllers'][number],slot,wood,ore,crystal,ai:normalizeAiConfig(p.ai as Parameters<typeof normalizeAiConfig>[0])};
 });
 const age=rules.startingAge;
 if(m.biome!==undefined&&!BIOMES.includes(m.biome as typeof BIOMES[number]))throw new Error('Unknown biome.');
 const packageMap=m.world as import('./world-types').WorldMapData|undefined??(m.biome===undefined?undefined:generateWorldMap(seed,size as GameState['mapSize'],definitions.length,m.biome as typeof BIOMES[number]));
 const map=packageMap?generatedMapFromWorld(packageMap,definitions.length,options):generateMatchMap(seed,size as GameState['mapSize'],definitions.length);
 if(packageMap&&packageMap.seed!==seed)throw new Error('Map package seed must match the match configuration.');
 const s:GameState={rules,draft:c.draft===undefined?createDraft(config.players,rules,content):validateDraftState(c.draft,config.players,rules,content),objectives:emptyObjectives(map),controllers:definitions.map(p=>p.controller),aiConfigs:definitions.map(p=>p.ai),teams,incomeFactors,populationLimits,sharedVision:rules.sharedVision!==false,eliminated:definitions.map(()=>false),winningTeam:null,mapSize:map.size,mapVersion:map.version,terrain:map.terrain,starts:definitions.map(p=>({...map.starts[p.slot]})),draw:false,tick:0,corpses:[],time:0,seed,width:map.width,height:map.height,entities:[],resources:[],players:definitions.map(p=>({faction:p.faction,wood:p.wood,ore:p.ore,crystal:p.crystal,population:0,cap:12,upgrades:age===3?['town-age','citadel-age']:age===2?['town-age']:[]})),winner:null,events:[],explored:definitions.map(()=>new Set()),visible:definitions.map(()=>new Set()),nextId:1};
 if(content)s.content=content;
 if(packageMap)initializeWorld(s,packageMap,m.biome as typeof BIOMES[number]??'temperate');
 if(!options.scenario)for(const side of playerSides(s)){const {x,y}=s.starts[side],level=levelOf(s.starts[side]),dir=y<s.height/2?1:-1;spawnEntity(s,side,'building','hq',x,y,1,undefined,level);for(let i=0;i<5;i++)spawnEntity(s,side,'unit','worker',x+(-2+i*.85)*dir,y+3*dir,1,undefined,level);const starter=availableUnits(s,side).find(unit=>unit.role!=='worker'&&!rules.disabledDefinitionIds.includes(unit.id));if(starter)spawnEntity(s,side,'unit',starter.role,x+3*dir,y+dir,1,starter.id.includes(':')?starter.id:undefined,level);}
 for(const resource of map.resources)s.resources.push({...resource,id:s.nextId++});initializeWorldSites(s);initializeObjectives(s);if(s.rules.draft.enabled&&s.draft.status==='complete')finalizeDraft(s);refreshVisibility(s);updatePopulation(s);return s;
}
function finalizeDraft(s:GameState):void {
 // The standard one-soldier starting army uses the first drafted combat unit.
 for(const side of playerSides(s)){
  const available=availableUnits(s,side),picked=s.draft.picks[side].map(id=>available.find(u=>u.id===id)).find(u=>u&&u.role!=='worker');
  if(!picked)throw new Error('Completed draft requires a combat unit for every player.');
  const starters=s.entities.filter(e=>e.side===side&&e.kind==='unit'&&e.role!=='worker'&&e.hp>0);
  for(const unit of starters){s.entities=s.entities.filter(e=>e!==unit);spawnEntity(s,side,'unit',picked.role,unit.x,unit.y,1,picked.id,levelOf(unit));}
 }
 if(s.rules.mode==='survival')s.objectives.survival.nextWaveTick=s.tick+s.rules.survival.intervalTicks;
 updatePopulation(s);
}
export function createGame(faction:FactionId,seed=1977,opponent:FactionId=faction==='orcs'?'fairies':'orcs',options:GameOptions={}):GameState{
 const controllers=options.controllers??['human','ai'];return createMatch({map:{seed,size:options.mapSize??'medium',...(options.biome?{biome:options.biome}:{}),...(options.world?{world:options.world}:{})},players:[{id:0,teamId:0,factionId:faction,controller:controllers[0],ai:options.ai?.[0]},{id:1,teamId:1,factionId:opponent,controller:controllers[1],ai:options.ai?.[1]}]});
}
export function isGameOver(s:GameState):boolean{return s.winner!==null||s.draw;}
export function isVisible(s:GameState,side:Side,x:number,y:number,level=0):boolean{return x>=0&&y>=0&&x<s.width&&y<s.height&&!!s.visible[side]?.has(fogKey(s,{x,y,level}));}
export function refreshVisibility(s:GameState):void{
 updateBeacons(s,false);
 for(const visible of s.visible)visible.clear();
 for(const e of s.entities){if(!alive(e)||e.kind==='building'&&buildingDef(s,e).tags?.includes('beacon')&&!e.beacon?.connected)continue;const sight=((e.kind==='unit'?unitDef(s,e).sight:buildingDef(s,e).sight)+highGroundSightBonus(s,e))*environmentalSightFactor(s,e),side=e.side;
  for(let y=Math.max(0,Math.floor(e.y-sight));y<=Math.min(s.height-1,Math.ceil(e.y+sight));y++)for(let x=Math.max(0,Math.floor(e.x-sight));x<=Math.min(s.width-1,Math.ceil(e.x+sight));x++)if(length2D(x+.5-e.x,y+.5-e.y)<=sight&&terrainLineOfSight(s,e,{x:x+.5,y:y+.5,level:levelOf(e)})){const key=fogKey(s,{x,y,level:levelOf(e)});const recipients=e.beacon?.connected?playerSides(s).filter(other=>isAllied(s,side,other)):[side];for(const recipient of recipients){s.visible[recipient].add(key);s.explored[recipient].add(key);}}
 }
 if(s.sharedVision)for(const team of new Set(s.teams)){
  const members=playerSides(s).filter(side=>s.teams[side]===team),visible=new Set<number>(),explored=new Set<number>();
  for(const side of members){for(const tile of s.visible[side])visible.add(tile);for(const tile of s.explored[side])explored.add(tile);}
  for(const side of members){s.visible[side].clear();for(const tile of visible)s.visible[side].add(tile);for(const tile of explored)s.explored[side].add(tile);}
 }
}
function updatePopulation(s:GameState):void{for(const side of playerSides(s)){const es=s.entities.filter(e=>e.side===side&&alive(e));s.players[side].population=es.filter(e=>e.kind==='unit'&&!e.illusion).length;s.players[side].cap=Math.min(s.populationLimits[side],es.filter(e=>e.kind==='building'&&e.progress===1).reduce((v,e)=>v+(e.role==='hq'?12:e.role==='depot'?10:0),0));}}
function reserved(s:GameState,side:Side):number{return s.entities.filter(e=>e.side===side&&alive(e)).reduce((v,e)=>v+e.queue.length,0);}
function footprintOverlap(e:Entity,x:number,y:number,size:number):boolean{return Math.abs(e.x-x)<size/2+.35&&Math.abs(e.y-y)<size/2+.35;}
function shovePoint(s:GameState,x:number,y:number,size:number,level=0):Vec|undefined{
 // The building is not spawned yet; exclude its collision box, including navigation's .27 unit clearance.
 for(let ring=size/2+1;ring<size/2+5;ring+=.5)for(const [dx,dy] of DIRECTIONS_32){const px=x+dx*ring,py=y+dy*ring;if((Math.abs(px-x)>=size/2+.27||Math.abs(py-y)>=size/2+.27)&&walkable(s,px,py,level))return {x:px,y:py,...(level?{level}:{})};}
}
function rallyWalkable(s:GameState,side:Side,x:number,y:number,level=0):boolean{
 const fogged=new Set<Entity>();for(const e of s.entities)if(e.kind==='building'&&alive(e)&&isHostile(s,e.side,side)&&!isVisible(s,side,e.x,e.y,levelOf(e)))fogged.add(e);
 if(!fogged.size)return walkable(s,x,y,level);
 const kept=s.entities;s.entities=kept.filter(e=>!fogged.has(e));
 try{return walkable(s,x,y,level);}finally{s.entities=kept;}
}
/** Destination choices exposed in owned orders use only permitted obstacles. */
function commandDestination(s:GameState,side:Side,to:Vec,from:Vec):Vec|undefined{
 const observed={...s,entities:s.entities.filter(e=>e.side===side||isVisible(s,side,e.x,e.y,levelOf(e))),resources:s.resources.filter(r=>isVisible(s,side,r.x,r.y,levelOf(r)))};
 return openDestination(observed,to,from);
}
function movementOrder(s:GameState,e:Entity,order:Vec,dt:number,reach:number):boolean{
 // Keep pathfinding against physical obstacles private; an unseen obstacle must
 // not change the destination visible in the accepted command.
 const destination=openDestination(s,order,e);return destination?move(s,e,destination,dt,reach):false;
}
function refundCost(s:GameState,side:Side,role:UnitRole,id?:string,paid?:Cost):void{const cost=paid??unitFor(s,side,role,id).cost,p=s.players[side];p.wood+=cost.wood;p.ore+=cost.ore;p.crystal+=cost.crystal;}
function refundQueue(s:GameState,e:Entity):void{if(!e.queue.length)return;for(const [index,role] of e.queue.entries())refundCost(s,e.side,role,e.queueDefinitionIds?.[index],e.queuePaidCosts?.[index]);e.queue=[];delete e.queueDefinitionIds;delete e.queuePaidCosts;e.trainProgress=0;}
export function canPlace(s:GameState,side:Side,role:BuildingRole,x:number,y:number,definitionId?:string,level=0):boolean{
 if(!s.players[side]||(level!==0&&!s.world?.levels[level]))return false;const def=definitionId?availableBuildings(s,side).find(d=>d.id===definitionId&&d.role===role):factionFor(s,side).buildings[role];if(!def||playerAge(s.players[side])<buildingAgeRequired(def)||!Number.isFinite(x)||!Number.isFinite(y))return false;const r=def.size/2;if(x-r<.5||y-r<.5||x+r>s.width-.5||y+r>s.height-.5)return false;
 for(const dx of [-r,0,r])for(const dy of [-r,0,r])if(!isVisible(s,side,x+dx,y+dy,level))return false;
 for(let ty=Math.floor(y-r);ty<Math.ceil(y+r);ty++)for(let tx=Math.floor(x-r);tx<Math.ceil(x+r);tx++)if(!TERRAIN[terrainAt(s,tx+.5,ty+.5,level)].buildable)return false;
 if(s.entities.some(e=>alive(e)&&levelOf(e)===level&&e.kind==='building'&&Math.abs(e.x-x)<radius(s,e)+r+(['wall','gate'].includes(role)&&['wall','gate'].includes(e.role)?0:.4)&&Math.abs(e.y-y)<radius(s,e)+r+(['wall','gate'].includes(role)&&['wall','gate'].includes(e.role)?0:.4)))return false;
 if(s.entities.some(e=>alive(e)&&levelOf(e)===level&&e.kind==='unit'&&isHostile(s,e.side,side)&&footprintOverlap(e,x,y,def.size)))return false;
 if(s.resources.some(e=>e.amount>0&&levelOf(e)===level&&Math.abs(e.x-x)<r+.8&&Math.abs(e.y-y)<r+.8))return false;return true;
}
function assign(s:GameState,e:Entity,order:Entity['order']):void{if(e.siegeMode?.deployed&&(order.type==='move'||order.type==='attackMove'))e.siegeMode.deployed=false;if(order.type!=='hold')e.entrenchedAt=undefined;e.order=order;e.path=[];runtime(s).routes.delete(e.id);runtime(s).returning.delete(e.id);runtime(s).queuedGather.delete(e.id);}
function interruptWorldOrder(s:GameState,e:Entity):void {delete e.orderQueue;assign(s,e,{type:'idle'});}
function commandOrder(s:GameState,e:Entity,order:Entity['order'],queued=false):boolean {
 if(queued&&e.order.type!=='idle'&&e.order.type!=='hold'){
  if((e.orderQueue?.length??0)>=MAX_ORDER_QUEUE)return false;
  (e.orderQueue??=[]).push(order);return true;
 }
 delete e.orderQueue;assign(s,e,order);if(queued&&order.type==='gather')runtime(s).queuedGather.add(e.id);return true;
}
function finishOrder(s:GameState,e:Entity):void {
 while(e.orderQueue?.length){
  const order=e.orderQueue.shift()!;
  if(order.type==='attack'){const target=s.entities.find(t=>t.id===order.target&&alive(t)&&isHostile(s,t.side,e.side));if(!target||!sameLevel(e,target)||!isVisible(s,e.side,target.x,target.y,levelOf(target)))continue;}
  if(order.type==='gather'&&!s.resources.some(n=>n.id===order.target&&n.amount>0&&sameLevel(e,n)))continue;
  if(order.type==='build'&&!s.entities.some(t=>t.id===order.target&&alive(t)&&isAllied(s,t.side,e.side)&&t.kind==='building'&&sameLevel(e,t)&&(t.progress<1||t.hp<t.maxHp)))continue;
  if(!e.orderQueue.length)delete e.orderQueue;
  assign(s,e,order);if(order.type==='gather')runtime(s).queuedGather.add(e.id);return;
 }
 delete e.orderQueue;assign(s,e,{type:'idle'});
}
export function issueCommand(s:GameState,side:Side,c:Command):boolean{
 if(!validateCommand(c))return false;
 const accepted=applyCommand(s,side,c);if(accepted&&!runtime(s).stepping){if(runtime(s).hits.length)resolveHits(s);if(c.type==='ability'||c.type==='engineerBuild')refreshVisibility(s);}if(accepted&&!runtime(s).stepping)notifyCommand(s,side,c);return accepted;
}
function applyCommand(s:GameState,side:Side,c:Command):boolean{
 if(!validateCommand(c)||isGameOver(s)||!s.players[side]||s.eliminated[side])return false;
 if(c.type==='draftChoice'){const accepted=applyDraftChoice(s.draft,s.rules,draftPlayers(s),side,c.definitionId,s.content);if(accepted&&s.draft.status==='complete')finalizeDraft(s);return accepted;}
 if(s.draft.status!=='complete')return false;
 if(c.type==='collectRelic')return collectRelic(s,side,c.id,c.relicId);
 if(c.type==='dropRelic')return dropRelic(s,side,c.id);
 const p=s.players[side],f=factionFor(s,side);
 const environmentAction=issueEnvironmentCommand(s,side,c);if(environmentAction!==undefined)return environmentAction;
 const worldAction=issueWorldAction(s,side,c,(e,o)=>{commandOrder(s,e,o);});if(worldAction!==undefined)return worldAction;
 if(c.type==='recruitVillage'&&!definitionAllowed(s,side,unitFor(s,side,'melee').id))return false;
 const neutralAction=issueNeutralWorldCommand(s,side,c as WorldCommand);if(neutralAction!==undefined){if(neutralAction&&'ids' in c)for(const actor of s.entities)if(c.ids.includes(actor.id)&&actor.side===side&&['worldAttack','captureSite','supportVillage','recruitVillage'].includes(actor.order.type))assign(s,actor,{...actor.order});return neutralAction;}
 if(c.type==='toggleGate'){
  let changed=false;
  for(const gate of s.entities.filter(e=>c.ids.includes(e.id)&&e.side===side&&alive(e)&&e.role==='gate'&&e.progress===1)){
   if(gate.gateOpen&&s.entities.some(e=>alive(e)&&sameLevel(e,gate)&&e.kind==='unit'&&footprintOverlap(e,gate.x,gate.y,buildingDef(s,gate).size)))continue;
   gate.gateOpen=!gate.gateOpen;changed=true;
  }
  return changed;
 }
 if(c.type==='setRally'||c.type==='clearRally'){
  const producers=s.entities.filter(e=>c.ids.includes(e.id)&&e.side===side&&alive(e)&&e.kind==='building'&&(e.role==='hq'||e.role==='barracks'));
  if(!producers.length||(c.type==='setRally'&&producers.some(e=>levelOf(e)!==(c.level??0))))return false;
  if(c.type==='setRally'){
   if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<.5||c.y<.5||c.x>s.width-.5||c.y>s.height-.5)return false;
   if(!s.explored[side].has(fogKey(s,c)))return false;
   if(!rallyWalkable(s,side,c.x,c.y,c.level??0))return false;
  }
  for(const e of producers){if(c.type==='clearRally')delete e.rally;else e.rally={x:c.x,y:c.y,...(c.level===undefined?{}:{level:c.level})};}return true;
 }
 if(c.type==='cancelTrain'){
  const e=s.entities.find(e=>e.id===c.id&&e.side===side&&alive(e)&&e.kind==='building');
  if(!e||!Number.isInteger(c.index)||c.index<0||c.index>=e.queue.length)return false;
  refundCost(s,side,e.queue[c.index],e.queueDefinitionIds?.[c.index],e.queuePaidCosts?.[c.index]);
  e.queue.splice(c.index,1);e.queueDefinitionIds?.splice(c.index,1);e.queuePaidCosts?.splice(c.index,1);if(c.index===0)e.trainProgress=0;return true;
 }
 if(c.type==='reorderTrain'){
  const e=s.entities.find(e=>e.id===c.id&&e.side===side&&alive(e)&&e.kind==='building'&&e.progress===1&&(e.role==='hq'||e.role==='barracks'));
  if(!e||!Number.isInteger(c.from)||!Number.isInteger(c.to)||c.from<1||c.to<1||c.from>=e.queue.length||c.to>=e.queue.length||c.from===c.to)return false;
  const [role]=e.queue.splice(c.from,1);e.queue.splice(c.to,0,role);if(e.queueDefinitionIds){const [id]=e.queueDefinitionIds.splice(c.from,1);e.queueDefinitionIds.splice(c.to,0,id);if(e.queuePaidCosts){const [cost]=e.queuePaidCosts.splice(c.from,1);e.queuePaidCosts.splice(c.to,0,cost);}}return true;
 }
 if(c.type==='train'){
 const e=s.entities.find(e=>e.id===c.id&&e.side===side&&alive(e)&&e.kind==='building'&&e.progress===1);const d=c.definitionId?availableUnits(s,side).find(d=>d.id===c.definitionId&&d.role===c.role):f.units[c.role];if(!e||!d||d.tags?.includes('hero')&&heroRecruitmentReason(s,side,d.id)||!definitionAllowed(s,side,d.id)||playerAge(p)<(d.age??1)||(c.role==='worker'?e.role!=='hq':e.role!=='barracks')||e.queue.length>=5||p.wood<d.cost.wood||p.ore<d.cost.ore||p.crystal<d.cost.crystal||p.population+reserved(s,side)>=p.cap)return false;
 p.wood-=d.cost.wood;p.ore-=d.cost.ore;p.crystal-=d.cost.crystal;if(s.content||c.definitionId||e.queueDefinitionIds!==undefined||e.queuePaidCosts!==undefined){e.queueDefinitionIds??=e.queue.map(role=>f.units[role].id);e.queueDefinitionIds.push(d.id);e.queuePaidCosts??=e.queue.map(role=>({...f.units[role].cost}));e.queuePaidCosts.push({...d.cost});}e.queue.push(c.role);return true;
 }
 if(c.type==='research'){
 const e=s.entities.find(e=>e.id===c.id&&e.side===side&&alive(e)&&e.kind==='building'&&e.progress===1);const d=(()=>{try{return upgradeFor(s,side,c.upgrade);}catch{return undefined;}})();
 if(!e||!d||!definitionAllowed(s,side,c.upgrade)||d.building!==e.role||e.research||researchRequirement(s,side,c.upgrade)||p.wood<d.cost.wood||p.ore<d.cost.ore||p.crystal<d.cost.crystal)return false;
 p.wood-=d.cost.wood;p.ore-=d.cost.ore;p.crystal-=d.cost.crystal;e.research=c.upgrade;if(d.exclusiveGroup)e.researchPaidCost={...d.cost};e.researchProgress=0;emit(s,'research',e,undefined,`${d.name} started`);return true;
 }
 if(c.type==='promote')return promote(s,side,c.id,c.promotion);
 if(c.type==='recoverArtifact')return recoverArtifact(s,side,c.id,c.artifact);
 if(c.type==='equipArtifact')return equipArtifact(s,side,c.id,c.artifact);
 if(c.type==='unequipArtifact')return unequipArtifact(s,side,c.id,c.slot);
 if(c.type==='dropArtifact')return dropArtifact(s,side,c.id,c.artifact);
 if(c.type==='fieldRepair')return fieldRepair(s,side,c.id,c.target);
 if(c.type==='engineerBuild')return engineerBuild(s,side,c,specialistHooks(s));
 if(!('ids' in c))return false;
 const units=s.entities.filter(e=>c.ids.includes(e.id)&&e.side===side&&alive(e)&&e.kind==='unit'&&!e.illusion);
 if(!units.length)return false;
 if(c.type==='build'){
 const level=c.level??0,workers=units.filter(e=>e.role==='worker'&&levelOf(e)===level);const d=c.definitionId?availableBuildings(s,side).find(d=>d.id===c.definitionId&&d.role===c.role):f.buildings[c.role];if(!workers.length||!d||!isNormalBuildingDefinition(d)||playerAge(p)<buildingAgeRequired(d)||p.wood<d.cost.wood||p.ore<d.cost.ore||p.crystal<d.cost.crystal||!canPlace(s,side,c.role,c.x,c.y,c.definitionId,level))return false;
 const overlapping=s.entities.filter(e=>e.kind==='unit'&&alive(e)&&levelOf(e)===level&&isAllied(s,e.side,side)&&footprintOverlap(e,c.x,c.y,d.size));
 const shoves:{e:Entity;x:number;y:number}[]=[];
 for(const u of overlapping){const dest=shovePoint(s,c.x,c.y,d.size,level);if(!dest)return false;shoves.push({e:u,...dest});}
 p.wood-=d.cost.wood;p.ore-=d.cost.ore;p.crystal-=d.cost.crystal;const b=spawnEntity(s,side,'building',c.role,c.x,c.y,0,c.definitionId,level);for(const shove of shoves){shove.e.x=shove.x;shove.e.y=shove.y;shove.e.path=[];shove.e.entrenchedAt=undefined;runtime(s).routes.delete(shove.e.id);}for(const e of workers)commandOrder(s,e,{type:'build',target:b.id});emit(s,'build',b);return true;
 }
 if(c.type==='ability'){let success=false;for(const e of units){const special=specialistAbility(s,e,c,specialistHooks(s));if(special??useAbility(s,e))success=true;}return success;}
 if(c.type==='move'||c.type==='attackMove'){
 if(!Number.isFinite(c.x)||!Number.isFinite(c.y))return false;
 const width=Math.ceil(Math.sqrt(units.length)),dir=s.starts[side].y<s.height/2?1:-1;
 const destinations=units.map((e,i)=>{const dx=units.length===1?0:(i%width-(width-1)/2)*.8*dir,dy=units.length===1?0:(Math.floor(i/width)-(width-1)/2)*.8*dir;return commandDestination(s,side,{x:clamp(c.x+dx,.6,s.width-.6),y:clamp(c.y+dy,.6,s.height-.6),...(c.level===undefined?{}:{level:c.level})},e);});
 let moved=false;units.forEach((e,i)=>{if(destinations[i]&&commandOrder(s,e,{type:c.type,...destinations[i]!},c.queued))moved=true;});return moved;
 }
 if(c.type==='stop'||c.type==='hold'){for(const e of units)commandOrder(s,e,{type:c.type==='hold'?'hold':'idle'});return true;}
 if(!('target' in c))return false;
 const target=c.type==='gather'?s.resources.find(e=>e.id===c.target&&e.amount>0):s.entities.find(e=>e.id===c.target&&alive(e));
 if(!target||!isVisible(s,side,target.x,target.y,levelOf(target)))return false;
 if(c.type==='attack'){if(!('side' in target)||!isHostile(s,target.side,side))return false;return units.filter(e=>sameLevel(e,target)).reduce((accepted,e)=>commandOrder(s,e,{type:'attack',target:target.id},c.queued)||accepted,false);}
 const workers=units.filter(e=>e.role==='worker'&&sameLevel(e,target));if(!workers.length)return false;
 if(c.type==='repair'&&(!('side' in target)||!isAllied(s,target.side,side)||target.kind!=='building'||(target.hp>=target.maxHp&&target.progress>=1)))return false;
 return workers.reduce((accepted,e)=>commandOrder(s,e,{type:c.type==='gather'?'gather':'build',target:target.id},c.queued)||accepted,false);
}
function useAbility(s:GameState,e:Entity):boolean{
 if((runtime(s).abilities.get(e.id)??0)>s.time)return false;const ability=unitDef(s,e).ability;if(!ability)return false;
 if(ability==='entrench'){
 if(e.entrenchedAt!==undefined){e.entrenchedAt=undefined;commandOrder(s,e,{type:'idle'});}else{commandOrder(s,e,{type:'hold'});e.entrenchedAt=s.time;}
 }else if(ability==='raise'){
 const raisedDefinition=availableUnits(s,e.side).find(unit=>unit.role==='melee'&&definitionAllowed(s,e.side,unit.id));if(!raisedDefinition)return false;
 updatePopulation(s);let count=0;
 for(const corpse of [...s.corpses].sort((a,b)=>distance(e,a)-distance(e,b))){
 if(count>=2||s.players[e.side].population+reserved(s,e.side)>=s.players[e.side].cap)break;
 if(corpse.expires<=s.time||distance(e,corpse)>6||!isVisible(s,e.side,corpse.x,corpse.y,levelOf(corpse))||!walkable(s,corpse.x,corpse.y,levelOf(corpse)))continue;
 const raised=spawnEntity(s,e.side,'unit','melee',corpse.x,corpse.y,1,raisedDefinition.id,levelOf(corpse));raised.hp=raised.maxHp*.5;raised.raised=true;raised.expires=s.time+35;raised.order={type:'attackMove',x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level})};s.corpses=s.corpses.filter(c=>c.id!==corpse.id);count++;updatePopulation(s);
 }
 if(!count)return false;runtime(s).abilities.set(e.id,s.time+22);
 }else if(ability==='illusion'){
 let placed=0;
 for(const offset of [-.6,.6]){
  const desired={x:clamp(e.x+offset,.5,s.width-.5),y:clamp(e.y-offset,.5,s.height-.5),...(e.level===undefined?{}:{level:e.level})};
  const point=walkable(s,desired.x,desired.y,levelOf(e))?desired:openDestination(s,desired,e);if(!point)continue;
  const clone=spawnEntity(s,e.side,'unit',e.role,point.x,point.y,1,e.definitionId,levelOf(e));clone.illusion=true;clone.hp=clone.maxHp*.4;clone.maxHp=clone.hp;clone.expires=s.time+18;clone.order={...e.order};placed++;
 }
 if(!placed)return false;runtime(s).abilities.set(e.id,s.time+35);
 }else if(ability==='surge'){
 let affected=false;for(const ally of s.entities)if(isAllied(s,ally.side,e.side)&&alive(ally)&&ally.kind==='unit'&&!ally.illusion&&distance(e,ally)<5){ally.hp=Math.min(ally.maxHp,ally.hp+35);ally.surgeUntil=s.time+6;affected=true;}if(!affected)return false;runtime(s).abilities.set(e.id,s.time+20);
 }else if(ability==='ward'){
 let restored=false;for(const ally of s.entities)if(isAllied(s,ally.side,e.side)&&alive(ally)&&ally.kind==='unit'&&!ally.illusion&&distance(e,ally)<5&&(ally.shield??0)<(ally.maxShield??0)){ally.shield=Math.min(ally.maxShield!,(ally.shield??0)+24);restored=true;}if(!restored)return false;runtime(s).abilities.set(e.id,s.time+20);
 }else if(ability==='heal'){
 let healed=false;for(const ally of s.entities)if(isAllied(s,ally.side,e.side)&&alive(ally)&&ally.kind==='unit'&&!ally.illusion&&distance(e,ally)<5&&ally.hp<ally.maxHp){ally.hp=Math.min(ally.maxHp,ally.hp+35);healed=true;}if(!healed)return false;runtime(s).abilities.set(e.id,s.time+18);
 }else {e.momentum=Math.min(1,e.momentum+.5);runtime(s).abilities.set(e.id,s.time+25);}
 e.abilityReadyAt=runtime(s).abilities.get(e.id)??s.time;
 emit(s,'ability',e);return true;
}
function walkTo(e:Entity,x:number,y:number):void{if(e.siegeMode?.deployed&&Math.hypot(x-e.x,y-e.y)>.001)e.siegeMode.deployed=false;
 const dx=x-e.x,dy=y-e.y;
 if(dx!==0||dy!==0)e.facing=facing8(dx,dy);
 e.x=x;e.y=y;e.animation='walk';
}
function finishResearch(s:GameState,e:Entity):void {
 const id=e.research!,def=upgradeFor(s,e.side,id);
 if(canCompleteResearch(s,e.side,id,e.id)){
  s.players[e.side].upgrades.push(id);emit(s,'research',e,undefined,`${def.name} complete`);
 }else{
  // Only a command that charged this choice records a refundable cost.
  if(e.researchPaidCost)for(const resource of ['wood','ore','crystal'] as const)s.players[e.side][resource]+=e.researchPaidCost[resource];
  emit(s,'message',e,undefined,`${def.name} canceled: research requirements changed.`);
 }
 e.research=undefined;delete e.researchPaidCost;e.researchProgress=0;
}
function upgradeFactor(s:GameState,e:Entity,effect:'gather'|'speed'|'damage'):number{
 let factor=1;for(const id of s.players[e.side].upgrades){const u=upgradeFor(s,e.side,id);if(upgradeAppliesTo(u,unitDef(s,e)))factor*=u.effects[effect]??1;}return factor;
}
function movementSpeed(s:GameState,e:Entity):number{
 const terrain=terrainAt(s,e.x,e.y,levelOf(e));
 const terrainSpeed=factionFor(s,e.side).terrainSpeeds?.[terrain]??TERRAIN[terrain].speed;
 return unitDef(s,e).speed*progressionStats(s,e).speedFactor*terrainSpeed*environmentalMovementFactor(s,e)*upgradeFactor(s,e,'speed')*(e.illusion?1.08:1)*((e.surgeUntil??0)>s.time?1.25:1);
}
function move(s:GameState,e:Entity,to:Vec,dt:number,reach=.45):boolean{
 if(!sameLevel(e,to))return false;
 if(distance(e,to)<=reach){e.path=[];return true;}
 if(distance(e,to)<reach+.85){const d=distance(e,to),amount=Math.min(d-reach+.02,movementSpeed(s,e)*dt),x=e.x+(to.x-e.x)/d*amount,y=e.y+(to.y-e.y)/d*amount;if(segmentWalkable(s,e,{x,y,level:levelOf(e)})){walkTo(e,x,y);return distance(e,to)<=reach;}}
 const rt=runtime(s),key=`${s.world?.revision??0},${levelOf(to)},${Math.floor(to.x*2)},${Math.floor(to.y*2)},${reach.toFixed(1)}`,cache=rt.routes.get(e.id);
 if(!cache||cache.key!==key||(!e.path.length&&s.time-cache.at>1.3)||s.time-cache.at>5){e.path=route(s,e,to,reach,e.side);rt.routes.set(e.id,{key,at:s.time});}
 // Nearby troops may converge on the same grid center. Skip a nearby waypoint
 // when the following segment is already clear, rather than requiring exact arrival.
 while(e.path.length>1&&distance(e,e.path[0])<.6&&segmentWalkable(s,e,e.path[1]))e.path.shift();
 if(!e.path.length)return false;const p=e.path[0],d=distance(e,p),speed=movementSpeed(s,e),amount=Math.min(d,speed*dt);
 if(d<.09){e.path.shift();return false;}const nx=e.x+(p.x-e.x)/d*amount,ny=e.y+(p.y-e.y)/d*amount;
 if(segmentWalkable(s,e,{x:nx,y:ny,level:levelOf(e)})){walkTo(e,nx,ny);}else if(segmentWalkable(s,e,{x:nx,y:e.y,level:levelOf(e)})&&Math.abs(nx-e.x)>.001){walkTo(e,nx,e.y);}else if(segmentWalkable(s,e,{x:e.x,y:ny,level:levelOf(e)})&&Math.abs(ny-e.y)>.001){walkTo(e,e.x,ny);}else{e.path=[];rt.routes.delete(e.id);}
 if(d<=amount+.06)e.path.shift();return distance(e,to)<=reach;
}
function emplaced(s:GameState,e:Entity):boolean{return e.entrenchedAt!==undefined&&s.time-e.entrenchedAt>=3;}
function weaponRange(s:GameState,e:Entity):number{const range=e.kind==='building'?7:unitDef(s,e).range+progressionStats(s,e).range+(emplaced(s,e)&&e.role==='special'?3:0);return range+(range>2?highGroundRangeBonus(s,e):0);}
function damage(s:GameState,a:Entity,b:Entity):void{
 const d=a.kind==='unit'?unitDef(s,a):null;const armor=(b.kind==='unit'?unitDef(s,b).armor:3)+progressionStats(s,b).armor+(emplaced(s,b)?2:0)+s.players[b.side].upgrades.reduce((sum,id)=>{const upgrade=upgradeFor(s,b.side,id);return sum+(b.kind==='unit'&&upgradeAppliesTo(upgrade,unitDef(s,b))?(upgrade.effects.armor??0):0);},0);
 const environment=projectileEnvironment(s,a,b),base=(d?d.damage*upgradeFactor(s,a,'damage')*progressionStats(s,a).damageFactor:19)*(1+relicBonus(s,a.side,a));const bonus=d?.ability==='momentum'?1+a.momentum*.40:emplaced(s,a)?1.15:1;const hit=Math.max(1,base*bonus*((d?.range??7)>2?environment.damageFactor*highGroundDamageFactor(s,a,b):1)*(b.kind==='building'?(d?.buildingDamageMultiplier??1):(d?.bonusAgainst?.[b.role as UnitRole]??1))-armor)*(a.illusion?.25:1);
 if(a.kind==='unit'&&a.role==='siege'){const shot=launchSpecialistShot(s,a,b,base*bonus);if(shot===false)return;if(shot){a.cooldown=d!.cooldown;a.animation='attack';a.animTime=0;return;}}
 a.cooldown=(d?.cooldown??1.4)/(d?.ability==='momentum'?1+a.momentum*.15:1);if(d?.ability==='momentum')a.momentum=Math.min(1,a.momentum+.15);a.animation='attack';a.animTime=0;const event=emit(s,'attack',a,b.id);runtime(s).hits.push({source:a,target:b,amount:hit,event});
}
function die(s:GameState,e:Entity,text?:string):void{if(e.animation==='death')return;commanderDied(s,e);commanderArtifact(s,e);dropArtifacts(s,e);if(s.specialists)s.specialists.structures=s.specialists.structures.filter(item=>item.entityId!==e.id);if(e.kind==='building')refundQueue(s,e);if(e.kind==='unit'&&!e.illusion&&!e.raised)s.corpses.push({id:e.id,x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level}),expires:s.time+45});e.hp=0;e.animation='death';e.animTime=0;e.order={type:'idle'};delete e.orderQueue;runtime(s).queuedGather.delete(e.id);e.path=[];emit(s,'death',e,undefined,text);}
function enemy(s:GameState,e:Entity,max:number,onlyInRange=false):Entity|undefined{
 let best:Entity|undefined,bestDist=Infinity;for(const b of s.entities){if(!alive(b)||!isHostile(s,b.side,e.side)||!isVisible(s,e.side,b.x,b.y,levelOf(b))||onlyInRange&&!near(s,e,b,max))continue;const d=distance(e,b)-radius(s,b);if(d<=max&&(d<bestDist||best?.kind==='building'&&b.kind==='unit')){best=b;bestDist=d;}}return best;
}
function fight(s:GameState,e:Entity,b:Entity,dt:number):void{const range=weaponRange(s,e)*((e.kind==='building'||unitDef(s,e).range>2)?projectileEnvironment(s,e,b).rangeFactor:1);if(!sameLevel(e,b))return;if(near(s,e,b,range)&&terrainLineOfSight(s,e,b)){e.facing=facing8(b.x-e.x,b.y-e.y);if(e.cooldown<=0)damage(s,e,b);}else if(e.kind==='unit')move(s,e,b,dt,range+(b.kind==='building'?radius(s,b):0)-.1);}
function gather(s:GameState,e:Entity,target:number,dt:number):void{
 const node=s.resources.find(n=>n.id===target&&sameLevel(n,e));const rt=runtime(s),finite=rt.queuedGather.has(e.id)||!!e.orderQueue?.length;if(e.carried>=18||node?.amount===0&&e.carried>0||finite&&(!node||node.amount<=0)&&e.carried>0)rt.returning.add(e.id);
 if(rt.returning.has(e.id)){
 const depot=s.entities.filter(b=>b.side===e.side&&sameLevel(b,e)&&alive(b)&&b.kind==='building'&&b.progress===1&&(b.role==='hq'||b.role==='depot')).sort((a,b)=>distance(e,a)-distance(e,b))[0];
 if(!depot){finishOrder(s,e);return;}if(near(s,e,depot,1.1)){const income=e.carried*s.incomeFactors[e.side];s.players[e.side][e.carriedKind]+=income;const deposit=emit(s,'gather',e,depot.id);deposit.amount=income;deposit.resource=e.carriedKind;e.carried=0;rt.returning.delete(e.id);if(finite&&(!node||node.amount<=0))finishOrder(s,e);}else move(s,e,depot,dt,radius(s,depot)+1);return;
 }
 if(!node||node.amount<=0){if(finite){finishOrder(s,e);return;}const next=s.resources.filter(n=>n.amount>0&&sameLevel(n,e)&&n.kind===(node?.kind??e.carriedKind)&&isVisible(s,e.side,n.x,n.y,levelOf(n))).sort((a,b)=>distance(e,a)-distance(e,b))[0];assign(s,e,next?{type:'gather',target:next.id}:{type:'idle'});return;}
 if(e.carried>0&&e.carriedKind!==node.kind){rt.returning.add(e.id);return;}
 if(distance(e,node)>1.2){move(s,e,node,dt,1.1);return;}
 e.animation='attack';e.carriedKind=node.kind;const amount=Math.min(node.amount,dt*ECONOMY.harvestPerSecond*upgradeFactor(s,e,'gather')*(node.kind==='crystal'?.6:1),18-e.carried);node.amount-=amount;e.carried+=amount;
}
function construct(s:GameState,e:Entity,id:number,dt:number):void{
 const b=s.entities.find(b=>b.id===id&&alive(b)&&sameLevel(b,e)&&isAllied(s,b.side,e.side)&&b.kind==='building');if(!b){finishOrder(s,e);return;}if(!near(s,e,b,1.2)){move(s,e,b,dt,radius(s,b)+1.1);return;}
 const def=buildingDef(s,b);e.animation='attack';if(b.progress<1){const amount=Math.min(1-b.progress,dt/def.buildTime);b.progress+=amount;b.hp=Math.min(b.maxHp,b.hp+amount*b.maxHp*.9);if(b.progress>=1){b.progress=1;emit(s,'build',b,undefined,'Construction complete');updatePopulation(s);}}
 else if(b.hp<b.maxHp){const p=s.players[e.side],amount=Math.min(b.maxHp-b.hp,dt*18,p.wood*10);p.wood=Math.max(0,p.wood-amount*.1);b.hp+=amount;}
 else finishOrder(s,e);
}
function production(s:GameState,e:Entity,dt:number):void{
 if(e.progress<1||!e.queue.length)return;const role=e.queue[0],d=queuedUnitFor(s,e,0);if(s.players[e.side].population>=s.players[e.side].cap)return;
 if(e.trainProgress<1)e.trainProgress=Math.min(1,e.trainProgress+dt/d.trainTime);if(e.trainProgress<1)return;
 let point:Vec|undefined;const direction=e.side===0?1:-1;for(let ring=radius(s,e)+1;ring<=radius(s,e)+6&&!point;ring+=.5)for(const [dx,dy] of DIRECTIONS_24){const p={x:e.x+dx*ring*direction,y:e.y+dy*ring*direction,...(e.level===undefined?{}:{level:e.level})};if(walkable(s,p.x,p.y,levelOf(e))){point=p;break;}}
 if(!point){refundCost(s,e.side,role,e.queueDefinitionIds?.[0],e.queuePaidCosts?.[0]);e.queue.shift();e.queueDefinitionIds?.shift();e.queuePaidCosts?.shift();e.trainProgress=0;return;}
 const u=spawnEntity(s,e.side,'unit',role,point.x,point.y,1,e.queueDefinitionIds?.[0],levelOf(e));if(role!=='worker')runtime(s).producedFighters[e.side]++;e.trainProgress=0;e.queue.shift();e.queueDefinitionIds?.shift();e.queuePaidCosts?.shift();emit(s,'train',u);updatePopulation(s);if(e.rally)issueCommand(s,e.side,{type:'move',ids:[u.id],...e.rally});
}
function separateUnits(s:GameState):void{
 const units=s.entities.filter(e=>e.kind==='unit'&&alive(e));for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){const a=units[i],b=units[j],d=distance(a,b);if(d>=.58)continue;const dx=d>.001?(a.x-b.x)/d:(a.id%2?1:-1),dy=d>.001?(a.y-b.y)/d:.3,push=(.58-d)*.22;const ax=a.x+dx*push,ay=a.y+dy*push,bx=b.x-dx*push,by=b.y-dy*push;if(walkable(s,ax,ay,levelOf(a))){a.x=ax;a.y=ay;}if(walkable(s,bx,by,levelOf(b))){b.x=bx;b.y=by;}}
}
// Units alive at the beginning of this step finish their attacks together.
// This prevents entity-array order from cancelling the other side's lethal hit.
function resolveHits(s:GameState):void{
 const groups=new Map<Entity,Runtime['hits']>();
 for(const hit of runtime(s).hits){const group=groups.get(hit.target)??[];group.push(hit);groups.set(hit.target,group);}
 for(const [target,hits] of groups){if(!alive(target))continue;const total=hits.reduce((n,h)=>n+h.amount,0),absorbed=Math.min(target.shield??0,total),actual=Math.min(target.hp,total-absorbed)+absorbed;target.shield=Math.max(0,(target.shield??0)-absorbed);target.hp=Math.max(0,target.hp-(total-absorbed));target.lastDamagedAt=s.time;
  for(const hit of hits){hit.event.amount=total?actual*hit.amount/total:0;const attacker=s.entities.find(e=>e.id===hit.source.id);if(attacker&&attacker.side===hit.source.side)creditCombat(s,attacker,target,hit.event.amount);}
  if(actual>0&&hits.some(hit=>{const source=s.entities.find(e=>e.id===hit.source.id);return (hit.event.amount??0)>0&&s.teams[hit.source.side]!==s.teams[target.side]&&(!source||!source.illusion&&!source.raised);}))recordCombatExposure(s,target);
  target.lastAttacker=hits.reduce((best,h)=>h.amount>best.amount?h:best).source.id;
  if(target.hp===0){const killer=s.entities.find(e=>e.id===target.lastAttacker);if(killer&&killer.side===hits.reduce((best,h)=>h.amount>best.amount?h:best).source.side)creditCombat(s,killer,target,0,true);die(s,target);}
 }
 if(s.rules.standardDefeat){
 s.eliminated=playerSides(s).map(side=>!s.entities.some(e=>e.side===side&&e.role==='hq'&&alive(e)&&e.progress===1));
 const livingTeams=[...new Set(s.teams.filter((_,side)=>!s.eliminated[side]))];
 if(!livingTeams.length)s.draw=true;else if(livingTeams.length===1&&new Set(s.teams).size>1){s.winningTeam=livingTeams[0];s.winner=s.teams.findIndex(team=>team===s.winningTeam) as Side;}
 }
 runtime(s).hits=[];
}
function moveNeutral(s:GameState,actor:Entity|NeutralCreature,to:Vec,dt:number,reach:number):boolean {
 if('side' in actor)return move(s,actor,to,dt,reach);if(!sameLevel(actor,to))return false;
 const d=distance(actor,to);if(d<=reach){actor.path=[];return true;}
 if(!actor.path.length||distance(actor.path[actor.path.length-1],to)>reach+.7)actor.path=route(s,actor,to,reach);
 while(actor.path.length&&distance(actor,actor.path[0])<.08)actor.path.shift();const point=actor.path[0];if(!point)return false;
 const distanceTo=distance(actor,point),amount=Math.min(distanceTo,dt*1.7),next={x:actor.x+(point.x-actor.x)/distanceTo*amount,y:actor.y+(point.y-actor.y)/distanceTo*amount,level:levelOf(actor)};
 if(segmentWalkable(s,actor,next)){actor.x=next.x;actor.y=next.y;}else actor.path=[];
 return distance(actor,to)<=reach;
}
function neutralHooks(s:GameState){return {
 attackStats:(e:Entity)=>{const def=unitDef(s,e);return {damage:def.damage*upgradeFactor(s,e,'damage')*progressionStats(s,e).damageFactor,range:weaponRange(s,e),cooldown:def.cooldown};},
 recruitCost:(side:Side,role:UnitRole)=>unitFor(s,side,role).cost,
 move:(actor:Entity|NeutralCreature,to:Vec,dt:number,reach:number)=>moveNeutral(s,actor,to,dt,reach),
 spawn:(side:Side,role:UnitRole,x:number,y:number,level:number)=>{const definition=unitFor(s,side,role);if(!definitionAllowed(s,side,definition.id))return undefined;const point=openDestination(s,{x,y,level},{x,y,level});if(!point)return undefined;return spawnEntity(s,side,'unit',role,point.x,point.y,1,definition.id,level);},
 hit:(source:Entity|NeutralCreature,target:Entity|NeutralCreature,amount:number)=>{
  if('side' in source){const def=unitDef(s,source);amount*=1+relicBonus(s,source.side,source);if(def.range>2)amount*=projectileEnvironment(s,source,target).damageFactor*highGroundDamageFactor(s,source,target);}
  if('side' in target){const armor=(target.kind==='unit'?unitDef(s,target).armor:3)+progressionStats(s,target).armor;amount=Math.max(1,amount-armor);}const shield='shield' in target?Math.min(target.shield??0,amount):0,actual=Math.min(target.hp,amount-shield)+shield;
  if('shield' in target)target.shield=Math.max(0,(target.shield??0)-shield);target.hp=Math.max(0,target.hp-(amount-shield));
  if('side' in target){target.lastDamagedAt=s.time;target.lastAttacker=source.id;}const side='side' in source?source.side:'side' in target?target.side:0;
  s.events.push({type:'attack' as const,side,x:source.x,y:source.y,level:levelOf(source),source:source.id,target:target.id,amount:actual});if('side' in target&&target.hp===0)die(s,target);
 },
 lineOfSight:(from:Vec,to:Vec)=>terrainLineOfSight(s,from,to),
};}
export function stepGame(s:GameState,dt:number):void{
 const before=s.tick,rt=runtime(s);rt.stepping=true;
 try{applyStep(s,dt);}finally{rt.stepping=false;}
 if(s.tick!==before)notifyStep(s,Math.min(dt,.25));
}
function applyStep(s:GameState,dt:number):void{
 if(isGameOver(s)||!Number.isFinite(dt)||dt<=0)return;s.events=[];
 if(s.draft.status==='drafting'){tickDraft(s.draft,s.rules,draftPlayers(s),s.content);for(const side of playerSides(s))if(s.controllers[side]==='ai'&&s.draft.order[s.draft.turn]?.side===side){for(const id of s.draft.pool)if(applyDraftChoice(s.draft,s.rules,draftPlayers(s),side,id,s.content))break;}s.tick++;if(s.draft.turn===s.draft.order.length)finalizeDraft(s);return;}
 dt=Math.min(dt,.25);s.time+=dt;s.tick++;stepEnvironment(s,dt,{interrupt:actor=>interruptWorldOrder(s,actor),die:(actor,text)=>die(s,actor,text)});const rt=runtime(s);rt.hits=[];stepSpecialists(s,specialistHooks(s));resolveSpecialistShots(s,specialistHooks(s));stepVeterans(s);rt.fog-=dt;if(rt.fog<=0){refreshVisibility(s);rt.fog=.2;}rt.ai-=dt;if(rt.ai<=0){rt.aiTurns++;rt.ai+=1;}
 const sides=playerSides(s),due=new Set(sides.filter(side=>s.controllers[side]==='ai'&&!s.eliminated[side]&&s.time+1e-9>=rt.aiDecisionAt[side]));
 if(due.size){const offset=rt.aiBatchTurns++%sides.length;for(let i=0;i<sides.length;i++){const side=sides[(i+offset)%sides.length];if(due.has(side)){if(s.rules.mode!=='survival'||s.teams[side]===s.rules.survival.defenderTeam)runAI(s,side);objectiveAi(s,side,issueCommand);rt.aiDecisionAt[side]=s.time+aiProfile(s.aiConfigs[side]).decisionInterval;}}}
 for(const e of [...s.entities]){
 e.animTime+=dt;if(!alive(e)){if(e.kind==='building')refundQueue(s,e);continue;}if(e.expires&&s.time>=e.expires){die(s,e);continue;}e.cooldown=Math.max(0,e.cooldown-dt);if(e.animation!=='attack'||e.animTime>.4)e.animation='idle';e.momentum=Math.max(0,e.momentum-dt*.014);
 if(e.kind==='building'){if(e.progress===1&&buildingDef(s,e).ability==='heal')for(const ally of s.entities)if(isAllied(s,ally.side,e.side)&&alive(ally)&&ally.kind==='unit'&&!ally.illusion&&distance(ally,e)<6)ally.hp=Math.min(ally.maxHp,ally.hp+dt*2.5);if(e.research){e.researchProgress+=dt/upgradeFor(s,e.side,e.research).researchTime;if(e.researchProgress>=1)finishResearch(s,e);}production(s,e,dt);if(e.role==='tower'&&e.progress===1&&!buildingDef(s,e).tags?.includes('beacon')){const b=enemy(s,e,7);if(b)fight(s,e,b,dt);}continue;}
 const d=unitDef(s,e);
 if(e.maxShield&&s.time-(e.lastDamagedAt??-6)>=6)e.shield=Math.min(e.maxShield,(e.shield??0)+4*dt);
 if(!e.illusion&&(d.ability==='raise'||d.ability==='ward'))useAbility(s,e);
 const feared=e.specialistBuffs?.find(buff=>buff.until>s.time&&buff.fearedFrom)?.fearedFrom;if(feared){const dx=e.x-feared.x,dy=e.y-feared.y,len=length2D(dx,dy)||1;move(s,e,{x:clamp(e.x+dx/len*3,.6,s.width-.6),y:clamp(e.y+dy/len*3,.6,s.height-.6),level:levelOf(e)},dt,.1);continue;}
 const o=e.order;
 if(processWorldAction(s,e,dt,{move:(actor,to,delta,reach)=>move(s,actor,to,delta,reach),finish:actor=>finishOrder(s,actor),interrupt:actor=>interruptWorldOrder(s,actor),die:(actor,text)=>die(s,actor,text)}))continue;
 if(processNeutralOrder(s,e,dt,neutralHooks(s)))continue;
 // Holding units defend within weapon range without pursuing beyond their position.
 if(o.type==='hold'){const b=enemy(s,e,weaponRange(s,e),true);if(b&&near(s,e,b,weaponRange(s,e))){fight(s,e,b,dt);if(!e.illusion&&(d.ability==='illusion'||d.ability==='heal'||d.ability==='surge'&&s.entities.some(a=>isAllied(s,a.side,e.side)&&alive(a)&&a.kind==='unit'&&a.hp<=a.maxHp-15&&distance(e,a)<5)))useAbility(s,e);}continue;}
 if(o.type==='gather'){gather(s,e,o.target,dt);continue;}if(o.type==='build'){construct(s,e,o.target,dt);continue;}if(o.type==='move'){if(movementOrder(s,e,o,dt,.5))finishOrder(s,e);continue;}
 if(o.type==='attack'){const b=s.entities.find(b=>b.id===o.target&&alive(b)&&isHostile(s,b.side,e.side));if(!b||!sameLevel(e,b)||!isVisible(s,e.side,b.x,b.y,levelOf(b))){finishOrder(s,e);continue;}fight(s,e,b,dt);continue;}
 const b=enemy(s,e,d.role==='worker'?2:Math.min(d.sight,7));if(b){fight(s,e,b,dt);if(!e.illusion&&(d.ability==='illusion'||d.ability==='heal'||d.ability==='surge'&&s.entities.some(a=>isAllied(s,a.side,e.side)&&alive(a)&&a.kind==='unit'&&a.hp<=a.maxHp-15&&distance(e,a)<5)))useAbility(s,e);}else if(o.type==='attackMove'&&movementOrder(s,e,o,dt,.65))finishOrder(s,e);
 }
 stepWorldActions(s);
 stepNeutralWorld(s,dt,neutralHooks(s));
 resolveHits(s);updateBeacons(s);
 s.corpses=s.corpses.filter(c=>c.expires>s.time);
 separateUnits(s);s.entities=s.entities.filter(e=>alive(e)||e.animTime<1.2);updatePopulation(s);evaluateObjectives(s,{spawn:spawnEntity,command:issueCommand});
}
/** AI issues exactly the commands accepted for humans, using current visibility only. */
export function runAI(s:GameState,side:Side=1):void{
 if(isGameOver(s)||!s.players[side]||s.eliminated[side])return;const owned=s.entities.filter(e=>e.side===side&&alive(e)),workers=owned.filter(e=>e.kind==='unit'&&e.role==='worker'),buildings=owned.filter(e=>e.kind==='building'),hq=buildings.find(e=>e.role==='hq');if(!hq)return;
 const f=factionFor(s,side),p=s.players[side],age=playerAge(p),config=s.aiConfigs[side],profile=aiProfile(config),rt=runtime(s);
 if(skipsAiDecision(config,++rt.aiDecisionTurns[side])){emit(s,'message',hq,undefined,'Easy commander hesitates before issuing orders.');return;}
 const available=s.resources.filter(n=>n.amount>0&&isVisible(s,side,n.x,n.y,levelOf(n)));
 const wantCrystal=(config.opening==='tower-defense'||buildings.some(b=>b.role==='barracks'))&&available.some(n=>n.kind==='crystal')?(p.crystal<40?2:p.crystal<100?1:0):0;
 const desired={wood:Math.max(1,Math.ceil((workers.length-wantCrystal)*.6)),ore:Math.max(1,workers.length-wantCrystal-Math.ceil((workers.length-wantCrystal)*.6)),crystal:wantCrystal};
 const assigned={wood:0,ore:0,crystal:0};
 for(const worker of workers){if(worker.order.type==='gather'){const n=s.resources.find(n=>n.id===(worker.order as {target:number}).target);if(n&&n.amount>0)assigned[n.kind]++;}}
 for(const worker of workers.filter(e=>e.order.type==='idle'||e.order.type==='gather')){
  const current=worker.order.type==='gather'?s.resources.find(n=>n.id===(worker.order as {target:number}).target):undefined;
  if(current&&current.amount>0&&assigned[current.kind]<=desired[current.kind])continue;
  const kinds=(['wood','ore','crystal'] as const).filter(k=>available.some(n=>n.kind===k)).sort((a,b)=>(desired[b]-assigned[b])-(desired[a]-assigned[a]));
  const kind=kinds[0];if(!kind)continue;
  const node=available.filter(n=>n.kind===kind).sort((a,b)=>distance(worker,a)-distance(worker,b))[0];
  if(node&&issueCommand(s,side,{type:'gather',ids:[worker.id],target:node.id})){if(current)assigned[current.kind]--;assigned[kind]++;}
 }

 // Resume paid foundations before committing workers to additional buildings.
 for(const site of buildings.filter(b=>b.progress<1)){
  if(workers.some(w=>w.order.type==='build'&&w.order.target===site.id))continue;
  const builder=workers.filter(w=>w.order.type==='idle'||w.order.type==='gather').sort((a,b)=>distance(a,site)-distance(b,site))[0];
  if(builder)issueCommand(s,side,{type:'repair',ids:[builder.id],target:site.id});
 }
 if(workers.length+ hq.queue.filter(r=>r==='worker').length<(age===1?profile.workerTarget:age===2?profile.workerTarget+6:profile.workerTarget+11)&&hq.queue.length<profile.trainingQueue)issueCommand(s,side,{type:'train',id:hq.id,role:'worker'});
 const researchPlan:UpgradeId[]=config.opening==='cavalry-raids'?['town-age','worker-harvest','worker-speed','citadel-age']:['worker-harvest','worker-speed','town-age','citadel-age'];
 if(hq.progress===1&&!hq.research&&workers.length>=7&&(config.personality!=='rush'||s.time>100))for(const id of researchPlan){const u=UPGRADES[id];if(u.building==='hq'&&!researchRequirement(s,side,id)&&p.wood>=u.cost.wood+120&&p.ore>=u.cost.ore+80&&p.crystal>=u.cost.crystal){issueCommand(s,side,{type:'research',id:hq.id,upgrade:id});break;}}
 // Claim an observed outer deposit with a new production/drop-off center.
 if(age>=2&&workers.length>=profile.expansionWorkers&&buildings.filter(b=>b.role==='hq').length<2&&!workers.some(w=>w.order.type==='build')&&p.wood>=(config.personality==='expand'?340:400)&&p.ore>=(config.personality==='expand'?160:220)){
  const deposit=available.filter(n=>n.amount>300&&distance(n,hq)>14&&!buildings.some(b=>(b.role==='hq'||b.role==='depot')&&distance(b,n)<8)).sort((a,b)=>distance(a,hq)-distance(b,hq))[0];
  if(deposit){const builder=workers.filter(w=>w.order.type==='gather'||w.order.type==='idle').sort((a,b)=>distance(a,deposit)-distance(b,deposit))[0];
   if(builder){let placed=false;for(let r=4;r<=7&&!placed;r++)for(let i=0;i<24&&!placed;i+=2){const [dx,dy]=DIRECTIONS_24[i],x=Math.floor(deposit.x+dx*r)+.5,y=Math.floor(deposit.y+dy*r)+.5;if(canPlace(s,side,'hq',x,y))placed=issueCommand(s,side,{type:'build',ids:[builder.id],role:'hq',x,y});}}
  }
 }
 const queued=reserved(s,side);
 let buildRole:BuildingRole|undefined=openingBuilding(config,buildings.map(b=>b.role as BuildingRole));
 if(!buildRole){if(p.cap-p.population-queued<5&&p.cap<s.populationLimits[side]&&!buildings.some(b=>b.role==='depot'&&b.progress<1))buildRole='depot';else if(s.time>100&&!buildings.some(b=>b.role==='tower'))buildRole='tower';else if(s.time>180&&buildings.filter(b=>b.role==='barracks').length<(age===3&&p.wood>700&&p.ore>300?5:(age>=2||s.time>420)&&p.wood>400?3:2))buildRole='barracks';}
 if(buildRole&&!workers.some(e=>e.order.type==='build')){const builder=workers[0];if(builder){const dir=s.starts[side].y<s.height/2?1:-1;let placed=false;for(let r=5;r<=10&&!placed;r+=2)for(let i=0;i<32&&!placed;i+=2){const [dx,dy]=DIRECTIONS_32[i],x=hq.x+Math.round(dx*r)*dir,y=hq.y+Math.round(dy*r)*dir;if(canPlace(s,side,buildRole,x,y))placed=issueCommand(s,side,{type:'build',ids:[builder.id],role:buildRole,x,y});}}}
 // A short defensive screen beside the tower leaves a gate in the army's route.
 if(age>=2&&p.wood>220&&p.ore>160&&!workers.some(w=>w.order.type==='build')){
  const tower=buildings.find(b=>b.role==='tower'&&b.progress===1),builder=workers.find(w=>w.order.type==='gather'||w.order.type==='idle');
  if(tower&&builder){const dir=s.starts[side].y<s.height/2?1:-1;const slots:[BuildingRole,number,number][]=[['gate',0,3.5],['wall',-1.5,3.5],['wall',1.5,3.5],['wall',-2.5,3.5],['wall',2.5,3.5]];
   for(const [role,dx,dy] of slots){const x=tower.x+dx*dir,y=tower.y+dy*dir;if(buildings.some(b=>length2D(b.x-x,b.y-y)<.4))continue;if(canPlace(s,side,role,x,y)&&issueCommand(s,side,{type:'build',ids:[builder.id],role,x,y}))break;}
  }
 }
 for(const gate of buildings.filter(b=>b.role==='gate'&&b.progress===1)){
  const danger=s.entities.some(e=>isHostile(s,e.side,side)&&alive(e)&&isVisible(s,side,e.x,e.y,levelOf(e))&&distance(e,gate)<9);
  if(!!gate.gateOpen===danger)issueCommand(s,side,{type:'toggleGate',ids:[gate.id]});
 }
 const army=owned.filter(e=>e.kind==='unit'&&e.role!=='worker'&&!e.illusion);
 const visibleEnemy=s.entities.filter(e=>isHostile(s,e.side,side)&&alive(e)&&e.kind==='unit'&&isVisible(s,side,e.x,e.y,levelOf(e)));
 const planned=[...army.filter(e=>!e.raised).map(e=>e.role),...buildings.flatMap(e=>e.queue).filter(r=>r!=='worker')];
 rememberObservedUnits(rt.knownEnemyUnits[side],visibleEnemy,s.time);
 const weights=counterWeights(f,config,rt.knownEnemyUnits[side].values());
 const roles=(Object.keys(f.units) as UnitRole[]).filter(r=>r!=='worker'&&(f.units[r].age??1)<=age);
 for(const b of buildings.filter(e=>e.role==='barracks'&&e.progress===1)){
  if(age>=2&&!b.research&&army.length>=5)for(const id of ['forged-weapons','tempered-armor','veteran-arms'] as UpgradeId[]){const d=UPGRADES[id];if(!researchRequirement(s,side,id)&&p.wood>d.cost.wood+180&&p.ore>d.cost.ore+120){issueCommand(s,side,{type:'research',id:b.id,upgrade:id});break;}}
  if(b.queue.length>=profile.trainingQueue)continue;
  const commander=availableUnits(s,side).find(d=>d.tags?.includes('hero'));if(commander&&age>=2&&army.length>=5&&!heroRecruitmentReason(s,side,commander.id)&&p.wood>commander.cost.wood+220&&p.ore>commander.cost.ore+160&&p.crystal>=commander.cost.crystal&&issueCommand(s,side,{type:'train',id:b.id,role:commander.role,definitionId:commander.id}))continue;
  // Maintain a small defensive force, then save enough to advance.
  const nextAge:UpgradeId|undefined=age===1?'town-age':age===2?'citadel-age':undefined;
  if(nextAge&&army.length>=7&&!hq.research&&s.time>(age===1?150:380)&&!visibleEnemy.some(e=>distance(e,hq)<14)&&p.wood<UPGRADES[nextAge].cost.wood+120)continue;
  const role=chooseAiRecruit(roles,planned,weights);if(!role)continue;
  if(issueCommand(s,side,{type:'train',id:b.id,role}))planned.push(role);
 }
 // Evaluate after spending and recruitment so newly paid fighters count.
 // Workers cannot replenish recruitment funds after their visible wood runs out.
 // Count owned cargo and paid queues, but never inspect deposits in the fog.
 const workerCost=f.units.worker.cost;
 const workerRecoverable=workers.length>0||p.population<p.cap&&buildings.some(b=>b.role==='hq'&&b.progress===1&&b.queue.includes('worker'))||p.population+reserved(s,side)<p.cap&&p.wood>=workerCost.wood&&p.ore>=workerCost.ore&&p.crystal>=workerCost.crystal;
 const woodIncome=available.some(n=>n.kind==='wood')||workers.some(w=>w.carriedKind==='wood'&&w.carried>0);
 const recruitWood=Math.min(...roles.map(role=>f.units[role].cost.wood));
 const paidFighterQueued=p.population<p.cap&&buildings.some(b=>b.role==='barracks'&&b.progress===1&&b.queue.some(role=>role!=='worker'));
 const incomeRecoverable=paidFighterQueued||workerRecoverable&&(woodIncome||p.wood>=recruitWood);
 // Emplace within firing distance, and pack up when the position has no targets.
 for(const unit of army.filter(e=>unitDef(s,e).ability==='entrench')){
 const target=enemy(s,unit,unitDef(s,unit).range+(unit.role==='special'?3:0),true);
 if(target&&unit.entrenchedAt===undefined)issueCommand(s,side,{type:'ability',ids:[unit.id]});
 else if(!target&&unit.entrenchedAt!==undefined)issueCommand(s,side,{type:'ability',ids:[unit.id]});
 }
 const seen=s.entities.filter(e=>isHostile(s,e.side,side)&&alive(e)&&isVisible(s,side,e.x,e.y,levelOf(e)));const threat=seen.find(e=>distance(e,hq)<12);
 const remembered=rt.knownEnemyBuildings[side];
 for(const [id,point] of remembered)if(isVisible(s,side,point.x,point.y,levelOf(point))&&!seen.some(e=>e.id===id))remembered.delete(id);
 for(const e of seen)if(e.kind==='building')remembered.set(e.id,{x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level}),role:e.role});
 const enemySides=playerSides(s).filter(other=>isHostile(s,side,other)&&!s.eliminated[other]);const enemySide=enemySides.sort((a,b)=>distance(hq,s.starts[a])-distance(hq,s.starts[b]))[0];if(enemySide===undefined)return;const enemyStart=s.starts[enemySide];
 const forward={x:hq.x+(enemyStart.x-hq.x)*.12,y:hq.y+(enemyStart.y-hq.y)*.12};
 const rally=commandDestination(s,side,forward,hq)??{x:hq.x+4,y:hq.y};
 for(const producer of buildings.filter(e=>e.role==='barracks'&&e.progress===1&&!e.rally))issueCommand(s,side,{type:'setRally',ids:[producer.id],...rally});
 const retreats=rt.retreating[side];
 for(const [id,record] of retreats){const soldier=army.find(e=>e.id===id);if(!soldier){retreats.delete(id);continue;}if(s.time>=record.until&&(!incomeRecoverable||rt.producedFighters[side]>record.produced&&distance(soldier,rally)<9&&army.some(reinforcement=>!reinforcement.raised&&reinforcement.id>record.afterId&&distance(reinforcement,rally)<6&&!retreats.has(reinforcement.id))))retreats.delete(id);}
 for(const soldier of army){
  if(!incomeRecoverable||retreats.has(soldier.id)||distance(soldier,hq)<9)continue;
  const enemies=seen.filter(e=>(e.kind==='unit'&&e.role!=='worker'||e.role==='tower')&&distance(e,soldier)<7);
  const allies=army.filter(e=>distance(e,soldier)<7&&!retreats.has(e.id));
  if(shouldRetreat(config,soldier,allies,enemies)&&issueCommand(s,side,{type:'move',ids:[soldier.id],...rally})){retreats.set(soldier.id,{until:s.time+profile.regroupSeconds,produced:rt.producedFighters[side],afterId:s.nextId-1});emit(s,'message',soldier,undefined,'Retreating to rally with reinforcements.');}
 }
 const readyArmy=army.filter(e=>!retreats.has(e.id));if(isVisible(s,side,enemyStart.x,enemyStart.y,levelOf(enemyStart))&&!seen.some(e=>e.role==='hq'&&distance(e,enemyStart)<4))rt.clearedEnemyStarts[side].add(enemySide);rt.enemyStartCleared[side]=rt.clearedEnemyStarts[side].has(enemySide);

 if(incomeRecoverable&&age>=2&&(s.mapSize==='large'||s.mapSize==='huge')&&!rt.expansionScoutDispatched[side]&&readyArmy.length>=3){
  const scout=readyArmy.find(e=>e.role==='cavalry')??readyArmy.find(e=>e.role==='melee');
  const x=Math.floor(s.width*.23)+.5,y=Math.floor(s.height*.58)+.5;
  if(scout&&issueCommand(s,side,{type:'move',ids:[scout.id],x:s.starts[side].x<s.width/2?x:s.width-x,y:s.starts[side].y<s.height/2?y:s.height-y})){rt.expansionScout[side]=scout.id;rt.expansionScoutDispatched[side]=true;}
 }
 if(rt.expansionScout[side]!==null&&!army.some(e=>e.id===rt.expansionScout[side]&&e.order.type==='move'))rt.expansionScout[side]=null;

 if(threat){const ready=readyArmy.filter(e=>e.order.type!=='attack'&&e.entrenchedAt===undefined);if(ready.length)issueCommand(s,side,{type:'attackMove',ids:ready.map(e=>e.id),x:threat.x,y:threat.y});}
 else if(readyArmy.length>=(incomeRecoverable?Math.max(3,Math.ceil(f.ai.armySize*profile.attackSizeFactor)):1)&&s.time-rt.aiWave[side]>Math.max(15,65/f.ai.aggression*profile.waveIntervalFactor)){
 const raidTarget=config.personality==='raid'?seen.find(e=>e.role==='worker')??seen.find(e=>e.role==='depot'):undefined;
 const target=raidTarget??seen.find(e=>e.kind==='building'&&e.role==='hq')??[...remembered.values()].find(e=>e.role==='hq')??seen[0]??[...remembered.values()][0];
 let destination:Vec=target??enemyStart;
 if(!target&&rt.enemyStartCleared[side]){
  // Search the fog after clearing the known enemy base. Never inspect hidden HQs.
  const origin=readyArmy[0],candidates:Vec[]=[];
  for(let y=4.5;y<s.height-3;y+=6)for(let x=4.5;x<s.width-3;x+=6)if(!isVisible(s,side,x,y)&&!rt.searched[side].has(Math.floor(y)*s.width+Math.floor(x)))candidates.push({x,y});
  if(candidates.length){destination=candidates.sort((a,b)=>distance(origin,a)-distance(origin,b))[0];rt.searched[side].add(Math.floor(destination.y)*s.width+Math.floor(destination.x));}else rt.searched[side].clear();
 }
issueCommand(s,side,{type:'attackMove',ids:readyArmy.filter(e=>e.entrenchedAt===undefined&&(!incomeRecoverable||e.id!==rt.expansionScout[side])).map(e=>e.id),x:destination.x,y:destination.y});rt.aiWave[side]=s.time;
 }else if(!rt.initialScoutDispatched[side]&&s.time>profile.scoutAt&&readyArmy.length&&readyArmy.every(e=>e.order.type==='idle')){const scout=readyArmy[0];if(issueCommand(s,side,{type:'attackMove',ids:[scout.id],x:hq.x+(enemyStart.x-hq.x)*.7,y:hq.y+(enemyStart.y-hq.y)*.7}))rt.initialScoutDispatched[side]=true;}
 runSpecialistAI(s,side,c=>issueCommand(s,side,c));
}

/** Constructor for validated deterministic systems; the caller charges costs and checks rules. */
export function spawnDefinition(s:GameState,side:Side,kind:Entity['kind'],definitionId:string,x:number,y:number,progress=1,level?:number):Entity {const d=kind==='unit'?availableUnits(s,side).find(d=>d.id===definitionId):availableBuildings(s,side).find(d=>d.id===definitionId);if(!d)throw new Error('Definition is absent from player content.');return spawnEntity(s,side,kind,d.role,x,y,progress,definitionId,level??0);}

function specialistHooks(s:GameState):SpecialistHooks {return {die:(actor,text)=>die(s,actor,text),spawn:(...args)=>spawnDefinition(s,...args),setTerrain:(point,kind)=>setWorldTerrain(s,point,kind),damage:(source,target,raw,options)=>{if(target.hp<=0)return;if(options?.ranged)raw*=projectileEnvironment(s,source,target).damageFactor*highGroundDamageFactor(s,source,target);const def=target.kind==='unit'?unitFor(s,target):undefined,armor=options?.armorPiercing?0:(def?.armor??3)+progressionStats(s,target).armor+(emplaced(s,target)?2:0)+s.players[target.side].upgrades.reduce((sum,id)=>{const u=upgradeFor(s,target.side,id);return sum+(def&&upgradeAppliesTo(u,def)?u.effects.armor??0:0);},0),event=emit(s,'attack',source,target.id);runtime(s).hits.push({source,target,amount:Math.max(1,raw-armor),event});}};}
