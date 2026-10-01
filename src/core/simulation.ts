import { normalizeMatchRules, createDraft, applyDraftChoice, tickDraft, draftPlayers, definitionAllowed, validateDraftState } from './match-rules';
import { afterScenarioCommand, afterScenarioStep, isScenarioScriptedCommand, scenarioCommandPermitted, scenarioSessionForState, scenarioStateRulesCompatible } from './scenarios';
import { initializeObjectives, emptyObjectives, evaluateObjectives, collectRelic, dropRelic, objectiveAi } from './objectives';
import { ECONOMY_BUILDINGS, applyEconomyCommand, cancelEconomyTask, depositEconomyGather, economicState, economyEntityBusy, economyGatherDepot, economyGatherFactor, economyProductionFactor, economyResearchFactor, economyUnitDefinition, initializeEconomySites, onEconomyDeath, recordEconomyPaid, tickEconomy } from './economy';
import { isEconomyCommand } from './economy-validation';
import type { EconomyHooks } from './economy-types';
import { DIRECTIONS_24, DIRECTIONS_32, facing8, length2D } from './geometry';
import { commanderArtifact, creditCombat, dropArtifact, dropArtifacts, equipArtifact, promote, progressionStats, recordCombatExposure, recoverArtifact, stepVeterans, unequipArtifact } from './unit-progression';
import { commanderDied, engineerBuild, fieldRepair, heroRecruitmentReason, launchSpecialistShot, resolveSpecialistShots, runSpecialistAI, specialistAbility, stepSpecialists, updateBeacons } from './specialist-systems';
import type { SpecialistHooks } from './specialist-systems';
import type { SpecialistSource } from './specialist-types';
import { aiProfile, chooseAiRecruit, counterWeights, normalizeAiConfig, openingBuilding, rememberObservedUnits, shouldRetreat, skipsAiDecision } from './ai-policy';
import type { EnemyMemory, EnemyObservation } from './ai-policy';
import { buildingAgeRequired, canCompleteResearch, playerAge, researchRequirement, upgradeAppliesTo } from './progression';
import { isPlayerCommand } from './commands';
import { coordinateTeamAi, emptyTeamAiState, hasTeamAiMemory } from './team-ai';
import type { TeamAiReport, TeamAiState } from './team-ai';
import { alliedAiObservation, applyAlliedPlayerCommand, processAllyDirectives } from './ally-directives';
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
interface Runtime { teamAI:TeamAiState; aiBatchTurns:number; aiDecisionAt:number[]; aiDecisionTurns:number[]; knownEnemyUnits:EnemyMemory[]; retreating:Map<number,RetreatRecord>[]; producedFighters:number[]; stepping?:boolean; fog:number; ai:number; aiTurns:number; hits:{source:Entity|SpecialistSource;target:Entity;amount:number;event:GameState['events'][number]}[]; routes:Map<number,{key:string;at:number}>; abilities:Map<number,number>; returning:Set<number>; queuedGather:Set<number>; aiWave:number[]; initialScoutDispatched:boolean[]; expansionScout:(number|null)[]; expansionScoutDispatched:boolean[]; knownEnemyBuildings:Map<number,Vec & {role:string}>[]; enemyStartCleared:boolean[]; clearedEnemyStarts:Set<Side>[]; searched:Set<number>[] }
/** The complete simulation memory that is not stored on GameState itself. */
export interface RuntimeSnapshot {
 teamAI?:TeamAiState;
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
// Reuse only within an AI batch, before movement, harvesting or fog can change.
const aiRecoveryScopes=new WeakMap<GameState,Map<Side,{key:string;value:boolean}>>();
function runtime(s:GameState):Runtime { let r=runtimes.get(s);if(!r){r={teamAI:emptyTeamAiState(),aiBatchTurns:0,aiDecisionAt:s.players.map(()=>0),aiDecisionTurns:s.players.map(()=>0),knownEnemyUnits:s.players.map(()=>new Map()),retreating:s.players.map(()=>new Map()),producedFighters:s.players.map(()=>0),fog:0,ai:0,aiTurns:0,hits:[],routes:new Map(),abilities:new Map(),returning:new Set(),queuedGather:new Set(),aiWave:s.players.map(()=>0),initialScoutDispatched:s.players.map(()=>false),expansionScout:s.players.map(()=>null),expansionScoutDispatched:s.players.map(()=>false),knownEnemyBuildings:s.players.map(()=>new Map()),enemyStartCleared:s.players.map(()=>false),clearedEnemyStarts:s.players.map(()=>new Set()),searched:s.players.map(()=>new Set())};runtimes.set(s,r);}return r; }
export function captureRuntime(s:GameState):RuntimeSnapshot {
 const r=runtime(s);
 return {...(hasTeamAiMemory(r.teamAI)?{teamAI:structuredClone(r.teamAI)}:{}),aiBatchTurns:r.aiBatchTurns,aiDecisionAt:[...r.aiDecisionAt],aiDecisionTurns:[...r.aiDecisionTurns],knownEnemyUnits:r.knownEnemyUnits.map(memory=>[...memory].map(([id,o])=>[id,{...o}])),retreating:r.retreating.map(memory=>[...memory].map(([id,o])=>[id,{...o}])),producedFighters:[...r.producedFighters],fog:r.fog,ai:r.ai,aiTurns:r.aiTurns,hits:r.hits.map(h=>({source:h.source.id,target:h.target.id,amount:h.amount,event:s.events.indexOf(h.event)})),routes:[...r.routes].map(([id,value])=>[id,{...value}]),abilities:[...r.abilities],returning:[...r.returning],queuedGather:[...r.queuedGather],aiWave:[...r.aiWave],initialScoutDispatched:[...r.initialScoutDispatched],expansionScout:[...r.expansionScout],expansionScoutDispatched:[...r.expansionScoutDispatched],knownEnemyBuildings:r.knownEnemyBuildings.map(memory=>[...memory].map(([id,p])=>[id,{...p}])),enemyStartCleared:[...r.enemyStartCleared],clearedEnemyStarts:r.clearedEnemyStarts.map(players=>[...players]),searched:r.searched.map(tiles=>[...tiles])};
}
/** Restore only a snapshot already validated by the save loader. */
export function restoreRuntime(s:GameState,r:RuntimeSnapshot):void {
 const entities=new Map(s.entities.map(e=>[e.id,e]));
 const hits=r.hits.map(h=>{const source=entities.get(h.source),target=entities.get(h.target),event=s.events[h.event];if(!source||!target||!event)throw new Error('Save runtime has an invalid hit reference.');return {source,target,amount:h.amount,event};});
 runtimes.set(s,{teamAI:r.teamAI?structuredClone(r.teamAI):emptyTeamAiState(),aiBatchTurns:r.aiBatchTurns,aiDecisionAt:[...r.aiDecisionAt],aiDecisionTurns:[...r.aiDecisionTurns],knownEnemyUnits:r.knownEnemyUnits.map(memory=>new Map(memory.map(([id,o])=>[id,{...o}]))),retreating:r.retreating.map(memory=>new Map(memory.map(([id,o])=>[id,{...o}]))),producedFighters:[...r.producedFighters],fog:r.fog,ai:r.ai,aiTurns:r.aiTurns,hits,routes:new Map(r.routes.map(([id,value])=>[id,{...value}])),abilities:new Map(r.abilities),returning:new Set(r.returning),queuedGather:new Set(r.queuedGather),aiWave:[...r.aiWave],initialScoutDispatched:[...r.initialScoutDispatched],expansionScout:[...r.expansionScout],expansionScoutDispatched:[...r.expansionScoutDispatched],knownEnemyBuildings:r.knownEnemyBuildings.map(memory=>new Map(memory.map(([id,p])=>[id,{...p}])) ),enemyStartCleared:[...r.enemyStartCleared],clearedEnemyStarts:r.clearedEnemyStarts.map(players=>new Set(players)),searched:r.searched.map(tiles=>new Set(tiles))});
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
 if(rules.mode==='scenario'&&!options.scenario)throw new Error('Scenario matches require a bound scenario definition.');
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
 for(const resource of map.resources)s.resources.push({...resource,id:s.nextId++});initializeWorldSites(s);if(!options.scenario)initializeEconomySites(s,s.world?.sites.filter(site=>site.kind==='village'));initializeObjectives(s);if(s.rules.draft.enabled&&s.draft.status==='complete')finalizeDraft(s);refreshVisibility(s);updatePopulation(s);return s;
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
function reserved(s:GameState,side:Side):number{return s.entities.filter(e=>e.side===side&&alive(e)).reduce((v,e)=>v+e.queue.length,0)+(economicState(s)?.recruits.filter(r=>r.side===side).length??0);}
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
 if(!s.players[side]||(level!==0&&!s.world?.levels[level]))return false;const def=definitionId?definitionId.startsWith('economy:')?Object.values(ECONOMY_BUILDINGS).find(d=>d.id===definitionId&&d.role===role):availableBuildings(s,side).find(d=>d.id===definitionId&&d.role===role):factionFor(s,side).buildings[role];if(!def||def.role!==role||playerAge(s.players[side])<buildingAgeRequired(def)||!Number.isFinite(x)||!Number.isFinite(y))return false;const r=def.size/2;if(x-r<.5||y-r<.5||x+r>s.width-.5||y+r>s.height-.5)return false;
 for(const dx of [-r,0,r])for(const dy of [-r,0,r])if(!isVisible(s,side,x+dx,y+dy,level))return false;
 for(let ty=Math.floor(y-r);ty<Math.ceil(y+r);ty++)for(let tx=Math.floor(x-r);tx<Math.ceil(x+r);tx++)if(!TERRAIN[terrainAt(s,tx+.5,ty+.5,level)].buildable)return false;
 if(s.entities.some(e=>alive(e)&&levelOf(e)===level&&e.kind==='building'&&Math.abs(e.x-x)<radius(s,e)+r+(['wall','gate'].includes(role)&&['wall','gate'].includes(e.role)?0:.4)&&Math.abs(e.y-y)<radius(s,e)+r+(['wall','gate'].includes(role)&&['wall','gate'].includes(e.role)?0:.4)))return false;
 if(s.entities.some(e=>alive(e)&&levelOf(e)===level&&e.kind==='unit'&&isHostile(s,e.side,side)&&footprintOverlap(e,x,y,def.size)))return false;
 if(s.resources.some(e=>e.amount>0&&levelOf(e)===level&&Math.abs(e.x-x)<r+.8&&Math.abs(e.y-y)<r+.8))return false;return true;
}
function assign(s:GameState,e:Entity,order:Entity['order']):void{cancelEconomyTask(s,e.id);if(e.siegeMode?.deployed&&(order.type==='move'||order.type==='attackMove'))e.siegeMode.deployed=false;if(order.type!=='hold')e.entrenchedAt=undefined;e.order=order;e.path=[];runtime(s).routes.delete(e.id);runtime(s).returning.delete(e.id);runtime(s).queuedGather.delete(e.id);}
function interruptWorldOrder(s:GameState,e:Entity):void {if(e.hp<=0)onEconomyDeath(s,e,economyHooks);delete e.orderQueue;assign(s,e,{type:'idle'});}
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
 if(!validateCommand(c)||!scenarioCommandPermitted(s,side,c))return false;
 const eventStart=s.events.length,rt=runtime(s),accepted=applyCommand(s,side,c);
 if(accepted&&!rt.stepping){if(rt.hits.length)resolveHits(s);if(c.type==='ability'||c.type==='engineerBuild')refreshVisibility(s);}
 if(accepted&&!rt.stepping&&!isScenarioScriptedCommand(s)){afterScenarioCommand(s,side,c,eventStart);notifyCommand(s,side,c);}
 return accepted;
}
function applyCommand(s:GameState,side:Side,c:Command):boolean{
 if(!validateCommand(c)||isGameOver(s)||!s.players[side]||s.eliminated[side])return false;
 if(c.type==='draftChoice'){const accepted=applyDraftChoice(s.draft,s.rules,draftPlayers(s),side,c.definitionId,s.content);if(accepted&&s.draft.status==='complete')finalizeDraft(s);return accepted;}
 if(s.draft.status!=='complete')return false;if(isEconomyCommand(c))return applyEconomyCommand(s,side,c,economyHooks);
 if(c.type==='collectRelic')return collectRelic(s,side,c.id,c.relicId);
 if(c.type==='dropRelic')return dropRelic(s,side,c.id);
 const p=s.players[side],f=factionFor(s,side);
 if(due.size){const offset=rt.aiBatchTurns++%sides.length;for(let i=0;i<sides.length;i++){const side=sides[(i+offset)%sides.length];if(due.has(side)){if(s.rules.mode!=='survival'||s.teams[side]===s.rules.survival.defenderTeam)runAI(s,side);objectiveAi(s,side,issueCommand);rt.aiDecisionAt[side]=s.time+aiProfile(s.aiConfigs[side]).decisionInterval;}}}
 tickEconomy(s,dt,economyHooks);
