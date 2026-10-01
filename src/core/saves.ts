import { normalizeMatchRules, createDraft, draftPlayers, validateDraftState, validateObjectiveState, validateSavedRules, validateModeRoster } from './match-rules';
import { emptyObjectives } from './objectives';
import { normalizeAiConfig } from './ai-policy';
import { validateScenarioBinding } from './scenarios';
import { validateSpecialists } from './specialist-validation';
import { availableBuildings, availableUnits, buildingFor, contentFactions, decodeContentBundle, entityDefinition, upgradesFor } from './content-registry';
import type { Entity, Side } from './types';
import { MAP_VERSION, TERRAIN } from './maps';
import { validateWorldState } from './world-validation';
import { captureRuntime, MAX_ORDER_QUEUE, restoreRuntime } from './simulation';
import type { RuntimeSnapshot } from './simulation';
import type { GameState } from './types';

export const SAVE_VERSION=3;
export const MAX_SAVE_BYTES=16*1024*1024;
type SerializedState=Omit<GameState,'explored'|'visible'> & {explored:number[][];visible:number[][]};
export interface SaveEnvelope {format:'orcs-vs-fairies-save';version:typeof SAVE_VERSION;state:SerializedState;runtime:RuntimeSnapshot}
const MAX_ID=0x7fffffff,MAX_VALUE=1e12,MAX_PLAYERS=8,MAX_ENTITIES=8192,MAX_RESOURCES=8192;
const STATE_FIELDS=['controllers','mapSize','mapVersion','terrain','starts','draw','tick','corpses','time','seed','width','height','entities','resources','players','winner','events','explored','visible','nextId'];
const TEAM_FIELDS=['teams','incomeFactors','populationLimits','sharedVision','eliminated','winningTeam'];
const UNIT_ROLES=['worker','melee','ranged','special','cavalry','spear','siege'];
const BUILDING_ROLES=['hq','depot','barracks','tower','wall','gate'];
const RESOURCE_KINDS=['wood','ore','crystal'];
type RecordValue=Record<string,unknown>;
function bad(path:string,detail:string):never {throw new Error(`Invalid save at ${path}: ${detail}.`);}
function object(value:unknown,path:string,required:string[],optional:string[]=[]):RecordValue {
 if(!value||typeof value!=='object'||Array.isArray(value))bad(path,'expected an object');
 const record=value as RecordValue;
 for(const key of required)if(!Object.hasOwn(record,key))bad(`${path}.${key}`,'missing field');
 for(const key of Object.keys(record))if(!required.includes(key)&&!optional.includes(key))bad(`${path}.${key}`,'unknown field');
 return record;
}
function number(value:unknown,path:string,min=0,max=MAX_VALUE,integer=false):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))bad(path,`expected ${integer?'an integer':'a finite number'} between ${min} and ${max}`);
 return value;
}
function flag(value:unknown,path:string):boolean {if(typeof value!=='boolean')bad(path,'expected a boolean');return value;}
function choice(value:unknown,path:string,choices:readonly string[]):string {if(typeof value!=='string'||!choices.includes(value))bad(path,'unknown value');return value;}
function list(value:unknown,path:string,max:number,length?:number):unknown[] {if(!Array.isArray(value)||value.length>max||(length!==undefined&&value.length!==length))bad(path,'invalid array length');return value;}
function optionalNumber(record:RecordValue,key:string,path:string,min=0,max=MAX_VALUE,integer=false):void {if(record[key]!==undefined)number(record[key],`${path}.${key}`,min,max,integer);}
function optionalFlag(record:RecordValue,key:string,path:string):void {if(record[key]!==undefined)flag(record[key],`${path}.${key}`);}
interface Context {state:GameState;levels:number;width:number;height:number;cells:number;time:number;nextId:number;playerCount:number;maxEntities:number;entityIds:Set<number>;entities:Map<number,RecordValue>;resourceIds:Set<number>;eventCount:number}
function id(value:unknown,path:string,c:Context):number {return number(value,path,1,c.nextId-1,true);}
function point(value:unknown,path:string,c:Context):void {const p=object(value,path,['x','y'],['level']);number(p.x,`${path}.x`,0,c.width);number(p.y,`${path}.y`,0,c.height);optionalNumber(p,'level',path,0,c.levels-1,true);}
function coordinates(value:RecordValue,path:string,c:Context):void {number(value.x,`${path}.x`,0,c.width);number(value.y,`${path}.y`,0,c.height);optionalNumber(value,'level',path,0,c.levels-1,true);}
function order(value:unknown,path:string,c:Context):void {
 const o=object(value,path,['type'],['x','y','target','transition','level']);
 choice(o.type,`${path}.type`,['idle','hold','move','attackMove','attack','gather','build','traverse','worldAttack','repairBridge','captureSite','supportVillage','recruitVillage']);
 if(o.type==='move'||o.type==='attackMove'){object(value,path,['type','x','y'],['level']);coordinates(o,path,c);}
 else if(['attack','gather','build','worldAttack','repairBridge','captureSite','supportVillage','recruitVillage'].includes(o.type as string)){object(value,path,['type','target']);id(o.target,`${path}.target`,c);}
 else if(o.type==='traverse'){object(value,path,['type','transition']);number(o.transition,`${path}.transition`,1,0x7fffffff,true);}
 else object(value,path,['type']);
}
function uniqueIds(values:unknown[],path:string,max:number):Set<number> {
 const result=new Set<number>();values.forEach((v,i)=>{const n=number(v,`${path}[${i}]`,0,max,true);if(result.has(n))bad(path,'duplicate value');result.add(n);});return result;
}
function fog(value:unknown,path:string,c:Context):Set<number>[] {
 return list(value,path,c.playerCount,c.playerCount).map((v,i)=>uniqueIds(list(v,`${path}[${i}]`,c.cells),`${path}[${i}]`,c.cells-1));
}
function validateEntity(value:unknown,path:string,c:Context):void {
 const e=object(value,path,['id','side','kind','role','x','y','hp','maxHp','order','cooldown','progress','queue','trainProgress','researchProgress','facing','animation','animTime','momentum','illusion','expires','carried','carriedKind','path'],['level','definitionId','definitionFaction','queueDefinitionIds','queuePaidCosts','orderQueue','research','researchPaidCost','rally','gateOpen','lastAttacker','abilityReadyAt','entrenchedAt','raised','shield','maxShield','lastDamagedAt','surgeUntil','veteran','equipment','specialistBuffs','siegeMode','burning','beacon']);
 const entityId=id(e.id,`${path}.id`,c);if(c.entityIds.has(entityId))bad(`${path}.id`,'duplicate entity or resource id');c.entityIds.add(entityId);c.entities.set(entityId,e);
 number(e.side,`${path}.side`,0,c.playerCount-1,true);choice(e.kind,`${path}.kind`,['unit','building']);choice(e.role,`${path}.role`,e.kind==='unit'?UNIT_ROLES:BUILDING_ROLES);coordinates(e,path,c);
 const maxHp=number(e.maxHp,`${path}.maxHp`,Number.MIN_VALUE,1e9);number(e.hp,`${path}.hp`,0,maxHp);order(e.order,`${path}.order`,c);
 for(const key of ['cooldown','animTime','expires'])number(e[key],`${path}.${key}`);
 for(const key of ['progress','trainProgress'])number(e[key],`${path}.${key}`,0,1);
 // Completed research can reach 1+dt for a single tick before being reset.
 number(e.researchProgress,`${path}.researchProgress`,0,2);
 number(e.facing,`${path}.facing`,0,7,true);choice(e.animation,`${path}.animation`,['idle','walk','attack','death']);number(e.momentum,`${path}.momentum`,0,1);flag(e.illusion,`${path}.illusion`);number(e.carried,`${path}.carried`,0,18);choice(e.carriedKind,`${path}.carriedKind`,RESOURCE_KINDS);
 if(e.definitionFaction!==undefined){choice(e.definitionFaction,`${path}.definitionFaction`,Object.keys(contentFactions(c.state.content)));if(e.kind!=='unit'||e.role!=='siege')bad(`${path}.definitionFaction`,'only captured siege can retain another faction definition');}
 if(e.definitionId!==undefined){if(typeof e.definitionId!=='string'||e.definitionId.length>100)bad(`${path}.definitionId`,'invalid ID');try{entityDefinition(c.state,e as unknown as Entity);}catch{bad(`${path}.definitionId`,'definition is absent from the pinned faction or has another role');}}
 const queue=list(e.queue,`${path}.queue`,5);queue.forEach((role,i)=>{choice(role,`${path}.queue[${i}]`,UNIT_ROLES);if(e.kind!=='building'||(e.role!=='hq'&&e.role!=='barracks')||(e.role==='hq'&&role!=='worker')||(e.role==='barracks'&&role==='worker'))bad(`${path}.queue`,'invalid producer or recruit');});
 if(e.queueDefinitionIds!==undefined){list(e.queueDefinitionIds,`${path}.queueDefinitionIds`,5,queue.length).forEach((id,i)=>{const def=availableUnits(c.state,e.side as Side).find(d=>d.id===id);if(!def||def.role!==queue[i])bad(`${path}.queueDefinitionIds[${i}]`,'definition is absent from the pinned faction or has another role');});}else if(c.state.content&&queue.length)bad(`${path}.queueDefinitionIds`,'pinned production requires definition IDs');
 if(e.queuePaidCosts!==undefined){list(e.queuePaidCosts,`${path}.queuePaidCosts`,5,queue.length).forEach((value,i)=>{const paid=object(value,`${path}.queuePaidCosts[${i}]`,['wood','ore','crystal']);for(const key of RESOURCE_KINDS)number(paid[key],`${path}.queuePaidCosts[${i}].${key}`,0,100000);const expected=availableUnits(c.state,e.side as Side).find(d=>d.id===(e.queueDefinitionIds as string[]|undefined)?.[i])?.cost;if(!expected||RESOURCE_KINDS.some(key=>paid[key]!==expected[key as keyof typeof expected]))bad(`${path}.queuePaidCosts[${i}]`,'paid cost differs from pinned definition');});}else if(c.state.content&&queue.length)bad(`${path}.queuePaidCosts`,'pinned production requires charged cost records');
 list(e.path,`${path}.path`,c.cells*16).forEach((p,i)=>point(p,`${path}.path[${i}]`,c));
 if(e.orderQueue!==undefined){if(e.kind!=='unit'||e.illusion)bad(`${path}.orderQueue`,'only real units can queue orders');list(e.orderQueue,`${path}.orderQueue`,MAX_ORDER_QUEUE).forEach((o,i)=>order(o,`${path}.orderQueue[${i}]`,c));}
 if(e.research!==undefined){const upgrades=upgradesFor(c.state,e.side as Side);choice(e.research,`${path}.research`,Object.keys(upgrades));if(e.kind!=='building'||upgrades[e.research as keyof typeof upgrades].building!==e.role)bad(`${path}.research`,'wrong research building');}
 if(e.research!==undefined&&upgradesFor(c.state,e.side as Side)[e.research as keyof ReturnType<typeof upgradesFor>].exclusiveGroup&&e.researchPaidCost===undefined)bad(`${path}.researchPaidCost`,'exclusive research requires the original charged cost');
 if(e.researchPaidCost!==undefined){if(e.research===undefined)bad(`${path}.researchPaidCost`,'charged research cost requires pending research');const paid=object(e.researchPaidCost,`${path}.researchPaidCost`,['wood','ore','crystal']),expected=upgradesFor(c.state,e.side as Side)[e.research as keyof ReturnType<typeof upgradesFor>].cost;for(const key of RESOURCE_KINDS){number(paid[key],`${path}.researchPaidCost.${key}`,0,100000);if(paid[key]!==expected[key as keyof typeof expected])bad(`${path}.researchPaidCost`,'charged cost differs from pinned research');}}
 if(e.rally!==undefined)point(e.rally,`${path}.rally`,c);
 for(const key of ['gateOpen','raised'])optionalFlag(e,key,path);
 if(e.lastAttacker!==undefined)id(e.lastAttacker,`${path}.lastAttacker`,c);
 for(const key of ['abilityReadyAt','entrenchedAt','lastDamagedAt','surgeUntil','shield','maxShield'])optionalNumber(e,key,path);
 if(e.shield!==undefined&&(e.shield as number)>(e.maxShield as number|undefined??0))bad(`${path}.shield`,'shield exceeds capacity');
}
function playersArray(value:unknown,path:string,c:Context,check:(v:unknown,p:string)=>void):void {list(value,path,c.playerCount,c.playerCount).forEach((v,i)=>check(v,`${path}[${i}]`));}
function entries(value:unknown,path:string,max:number,c:Context,check:(v:unknown,p:string)=>void):void {
 const seen=new Set<number>();list(value,path,max).forEach((entry,i)=>{const p=`${path}[${i}]`,parts=list(entry,p,2,2),key=id(parts[0],`${p}[0]`,c);if(seen.has(key))bad(path,'duplicate map key');seen.add(key);check(parts[1],`${p}[1]`);});
}
function validateRuntime(value:unknown,c:Context,version:1|2|3):void {
 const fields=['fog','ai','aiTurns','hits','routes','abilities','returning','queuedGather','aiWave','initialScoutDispatched','expansionScout','expansionScoutDispatched','knownEnemyBuildings','enemyStartCleared','searched'];
 const path='runtime',r=object(value,path,version===1?fields:version===2?[...fields,'clearedEnemyStarts']:[...fields,'clearedEnemyStarts','aiBatchTurns','aiDecisionAt','aiDecisionTurns','knownEnemyUnits','retreating','producedFighters']);
 number(r.fog,'runtime.fog',-.25,.2);number(r.ai,'runtime.ai',-.25,1);number(r.aiTurns,'runtime.aiTurns',0,MAX_VALUE,true);
 list(r.hits,'runtime.hits',c.maxEntities).forEach((v,i)=>{const p=`runtime.hits[${i}]`,h=object(v,p,['source','target','amount','event']);for(const key of ['source','target'])if(!c.entityIds.has(id(h[key],`${p}.${key}`,c)))bad(`${p}.${key}`,'missing hit entity');number(h.amount,`${p}.amount`,0,1e9);number(h.event,`${p}.event`,0,c.eventCount-1,true);});
 entries(r.routes,'runtime.routes',MAX_ID,c,(v,p)=>{const route=object(v,p,['key','at']);if(typeof route.key!=='string'||route.key.length>128)bad(`${p}.key`,'invalid route key');number(route.at,`${p}.at`,0,c.time);});
 entries(r.abilities,'runtime.abilities',MAX_ID,c,(v,p)=>number(v,p));
 uniqueIds(list(r.returning,'runtime.returning',MAX_ID),'runtime.returning',c.nextId-1).forEach(n=>{if(n===0)bad('runtime.returning','invalid entity id');});
 uniqueIds(list(r.queuedGather,'runtime.queuedGather',c.maxEntities),'runtime.queuedGather',c.nextId-1).forEach(n=>{const e=c.entities.get(n);if(!e||(e.hp as number)<=0||e.kind!=='unit'||e.role!=='worker'||(e.order as RecordValue).type!=='gather')bad('runtime.queuedGather','expected a living worker gathering');});
 playersArray(r.aiWave,'runtime.aiWave',c,(v,p)=>number(v,p,0,c.time));
 for(const key of ['initialScoutDispatched','expansionScoutDispatched','enemyStartCleared'])playersArray(r[key],`runtime.${key}`,c,flag);
 playersArray(r.expansionScout,'runtime.expansionScout',c,(v,p)=>{if(v!==null)id(v,p,c);});
 playersArray(r.knownEnemyBuildings,'runtime.knownEnemyBuildings',c,(v,p)=>entries(v,p,c.maxEntities,c,(value,q)=>{const b=object(value,q,['x','y','role'],['level']);coordinates(b,q,c);choice(b.role,`${q}.role`,BUILDING_ROLES);}));
 playersArray(r.searched,'runtime.searched',c,(v,p)=>uniqueIds(list(v,p,c.cells),p,c.cells-1));
 if(version>=2)playersArray(r.clearedEnemyStarts,'runtime.clearedEnemyStarts',c,(v,p)=>uniqueIds(list(v,p,c.playerCount),p,c.playerCount-1));
 if(version===3){
  number(r.aiBatchTurns,'runtime.aiBatchTurns',0,MAX_VALUE,true);
  playersArray(r.aiDecisionAt,'runtime.aiDecisionAt',c,(v,p)=>number(v,p,0,c.time+3));
  for(const key of ['aiDecisionTurns','producedFighters'])playersArray(r[key],`runtime.${key}`,c,(v,p)=>number(v,p,0,MAX_VALUE,true));
  playersArray(r.knownEnemyUnits,'runtime.knownEnemyUnits',c,(v,p)=>entries(v,p,c.maxEntities,c,(value,q)=>{const observation=object(value,q,['x','y','role','seenAt','hpFraction'],['level']);coordinates(observation,q,c);choice(observation.role,`${q}.role`,UNIT_ROLES.filter(role=>role!=='worker'));number(observation.seenAt,`${q}.seenAt`,0,c.time);number(observation.hpFraction,`${q}.hpFraction`,0,1);}));
  playersArray(r.retreating,'runtime.retreating',c,(v,p)=>entries(v,p,c.maxEntities,c,(value,q)=>{const record=object(value,q,['until','produced','afterId']);number(record.until,`${q}.until`,0,c.time+30);number(record.produced,`${q}.produced`,0,MAX_VALUE,true);number(record.afterId,`${q}.afterId`,0,c.nextId-1,true);}));
 }

}
function validate(envelope:unknown,version:1|2|3):void {
 const save=object(envelope,'save',['format','version','state','runtime']);if(save.format!=='orcs-vs-fairies-save')bad('format','unknown save format');if(save.version!==version)bad('version',`unsupported version ${String(save.version)}`);
 const s=object(save.state,'state',version===1?STATE_FIELDS:version===2?[...STATE_FIELDS,...TEAM_FIELDS]:[...STATE_FIELDS,...TEAM_FIELDS,'aiConfigs'],version===3?['content','world','specialists','rules','objectives','draft','scenario']:[]);
 if(s.content!==undefined)s.content=decodeContentBundle(s.content);
 const playerCount=list(s.players,'state.players',version===1?2:MAX_PLAYERS,version===1?2:undefined).length;
 if(playerCount===0)bad('state.players','expected between 1 and 8 players');
 const width=number(s.width,'state.width',8,256,true),height=number(s.height,'state.height',8,256,true),nextId=number(s.nextId,'state.nextId',1,MAX_ID,true);
 const levels=s.world===undefined?1:Array.isArray((s.world as RecordValue).levels)?((s.world as RecordValue).levels as unknown[]).length:0;if(levels<1||levels>2)bad('world.levels','expected1 or2 levels');
 const c:Context={state:s as unknown as GameState,levels,width,height,cells:width*height*levels,time:number(s.time,'state.time'),nextId,playerCount,maxEntities:version===1?4096:MAX_ENTITIES,entityIds:new Set(),entities:new Map(),resourceIds:new Set(),eventCount:0};
 if(version===3)playersArray(s.aiConfigs,'state.aiConfigs',c,(v,p)=>{const config=object(v,p,['difficulty','personality','opening']);choice(config.difficulty,`${p}.difficulty`,['easy','normal','hard']);choice(config.personality,`${p}.personality`,['balanced','rush','fortify','expand','raid']);choice(config.opening,`${p}.opening`,['infantry-rush','tower-defense','fast-expansion','cavalry-raids']);});
 playersArray(s.controllers,'state.controllers',c,(v,p)=>choice(v,p,['human','ai','external']));choice(s.mapSize,'state.mapSize',['small','medium','large','huge']);number(s.mapVersion,'state.mapVersion',1,MAP_VERSION,true);
 list(s.terrain,'state.terrain',width*height,width*height).forEach((v,i)=>choice(v,`state.terrain[${i}]`,Object.keys(TERRAIN)));playersArray(s.starts,'state.starts',c,(v,p)=>point(v,p,c));flag(s.draw,'state.draw');number(s.tick,'state.tick',0,MAX_VALUE,true);number(s.time,'state.time');number(s.seed,'state.seed',0,0xffffffff,true);
 if(version>=2){
  playersArray(s.teams,'state.teams',c,(v,p)=>number(v,p,0,MAX_PLAYERS-1,true));
  playersArray(s.incomeFactors,'state.incomeFactors',c,(v,p)=>number(v,p,0,10));
  playersArray(s.populationLimits,'state.populationLimits',c,(v,p)=>number(v,p,1,500,true));
  playersArray(s.eliminated,'state.eliminated',c,flag);flag(s.sharedVision,'state.sharedVision');
 }
 list(s.entities,'state.entities',c.maxEntities).forEach((v,i)=>validateEntity(v,`state.entities[${i}]`,c));
 list(s.resources,'state.resources',MAX_RESOURCES).forEach((v,i)=>{const p=`state.resources[${i}]`,r=object(v,p,['id','x','y','kind','amount','maxAmount'],['level']),key=id(r.id,`${p}.id`,c);if(c.entityIds.has(key)||c.resourceIds.has(key))bad(`${p}.id`,'duplicate entity or resource id');c.resourceIds.add(key);coordinates(r,p,c);choice(r.kind,`${p}.kind`,RESOURCE_KINDS);const max=number(r.maxAmount,`${p}.maxAmount`,0,1e9);number(r.amount,`${p}.amount`,0,max);});
 playersArray(s.players,'state.players',c,(v,p)=>{const player=object(v,p,['faction','wood','ore','crystal','population','cap','upgrades'],['heroRecovery']);choice(player.faction,`${p}.faction`,Object.keys(contentFactions(c.state.content)));for(const key of RESOURCE_KINDS)number(player[key],`${p}.${key}`);number(player.population,`${p}.population`,0,c.maxEntities,true);number(player.cap,`${p}.cap`,0,version===1?100:500,true);const available=upgradesFor(c.state,(s.players as unknown[]).indexOf(v) as Side),upgrades=list(player.upgrades,`${p}.upgrades`,Object.keys(available).length);upgrades.forEach((u,i)=>choice(u,`${p}.upgrades[${i}]`,Object.keys(available)));if(new Set(upgrades).size!==upgrades.length)bad(`${p}.upgrades`,'duplicate upgrade');});
 const researching=Array.from({length:playerCount},()=>new Set<string>()),choices=Array.from({length:playerCount},()=>new Map<string,string>()),players=s.players as RecordValue[];
 for(let side=0;side<playerCount;side++){const definitions=upgradesFor(c.state,side as Side);for(const id of players[side].upgrades as string[]){const group=definitions[id as keyof typeof definitions].exclusiveGroup;if(group){if(choices[side].has(group))bad(`state.players[${side}].upgrades`,'exclusive technology choices conflict');choices[side].set(group,id);}}}
 for(const e of c.entities.values())if((e.hp as number)>0&&e.research!==undefined){const side=e.side as number,upgrade=e.research as string;if((players[side].upgrades as string[]).includes(upgrade)||researching[side].has(upgrade))bad('state.entities.research','upgrade is already complete or being researched');researching[side].add(upgrade);const group=upgradesFor(c.state,side as Side)[upgrade as keyof ReturnType<typeof upgradesFor>].exclusiveGroup;if(group){if(choices[side].has(group))bad('state.entities.research','exclusive technology choice is already complete or being researched');choices[side].set(group,upgrade);}}
 if(s.winner!==null)number(s.winner,'state.winner',0,playerCount-1,true);if(s.draw&&s.winner!==null)bad('state.winner','draw cannot have a winner');
 if(version>=2){
  if(s.winningTeam!==null){number(s.winningTeam,'state.winningTeam',0,MAX_PLAYERS-1,true);if(!(s.teams as number[]).includes(s.winningTeam as number))bad('state.winningTeam','team has no player');}
  if((s.winner===null)!==(s.winningTeam===null)||(s.winner!==null&&(s.teams as number[])[s.winner as number]!==s.winningTeam))bad('state.winner','winner must belong to the winning team');
  if(s.draw&&s.winningTeam!==null)bad('state.winningTeam','draw cannot have a winning team');
 }
 list(s.corpses,'state.corpses',c.maxEntities*2).forEach((v,i)=>{const p=`state.corpses[${i}]`,corpse=object(v,p,['id','x','y','expires'],['level']);id(corpse.id,`${p}.id`,c);coordinates(corpse,p,c);number(corpse.expires,`${p}.expires`);});
 const events=list(s.events,'state.events',c.maxEntities*4);c.eventCount=events.length;
 events.forEach((v,i)=>{const p=`state.events[${i}]`,event=object(v,p,['type','x','y','side'],['text','target','source','amount','resource','level']);choice(event.type,`${p}.type`,['attack','death','build','train','gather','message','ability','research']);coordinates(event,p,c);number(event.side,`${p}.side`,0,playerCount-1,true);for(const key of ['source','target'])if(event[key]!==undefined)id(event[key],`${p}.${key}`,c);optionalNumber(event,'amount',p);if(event.resource!==undefined)choice(event.resource,`${p}.resource`,RESOURCE_KINDS);if(event.text!==undefined&&(typeof event.text!=='string'||event.text.length>4096))bad(`${p}.text`,'invalid message text');});
 const explored=fog(s.explored,'state.explored',c),visible=fog(s.visible,'state.visible',c);visible.forEach((tiles,side)=>{for(const tile of tiles)if(!explored[side].has(tile))bad(`state.visible[${side}]`,'visible tiles must be explored');});
 if(s.world!==undefined){validateWorldState(s.world,width,height,nextId,playerCount);const world=s.world;for(const allocated of [...world.bridges,...world.sites,...world.creatures])if(c.entityIds.has(allocated.id)||c.resourceIds.has(allocated.id))bad('world.id','collision with entity or resource');if(world.levels[0].terrain.some((t,i)=>t!==(s.terrain as unknown[])[i]))bad('world.levels[0].terrain','must match surface terrain');}
 validateRuntime(save.runtime,c,version);
 validateSpecialists(c.state);
 if(version===3){const count=['rules','objectives','draft'].filter(k=>Object.hasOwn(s,k)).length;if(count!==0&&count!==3)bad('state.rules','rules, objectives and draft must be stored together');if(count===3){const state=s as unknown as GameState;state.rules=validateSavedRules(s.rules,state.content);validateDraftState(s.draft,draftPlayers(state),state.rules,state.content);validateObjectiveState(s.objectives,state);validateModeRoster(state);}}
 if(s.scenario!==undefined)s.scenario=validateScenarioBinding(s.scenario,c.state);
}
function validateCurrent(envelope:unknown):asserts envelope is SaveEnvelope {validate(envelope,SAVE_VERSION);}
/** Add team rules only after the complete two-player v1 schema has passed validation. */
function migrateLegacy(envelope:RecordValue):void {
 validate(envelope,1);const state=envelope.state as RecordValue,entities=state.entities as RecordValue[];
 Object.assign(state,{teams:[0,1],incomeFactors:[1,1],populationLimits:[100,100],sharedVision:true,eliminated:[0,1].map(side=>!entities.some(e=>e.side===side&&e.kind==='building'&&e.role==='hq'&&(e.hp as number)>0&&e.progress===1)),winningTeam:state.winner});
 const runtime=envelope.runtime as RecordValue,cleared=runtime.enemyStartCleared as boolean[];runtime.clearedEnemyStarts=cleared.map((value,side)=>value?[1-side]:[]);
 envelope.version=2;
}
function migrateAi(envelope:RecordValue):void {
 validate(envelope,2);const state=envelope.state as RecordValue,runtime=envelope.runtime as RecordValue,count=(state.players as unknown[]).length;
 state.aiConfigs=Array.from({length:count},()=>normalizeAiConfig());
 Object.assign(runtime,{aiBatchTurns:0,aiDecisionAt:Array(count).fill(state.time as number),aiDecisionTurns:Array(count).fill(0),knownEnemyUnits:Array.from({length:count},()=>[]),retreating:Array.from({length:count},()=>[]),producedFighters:Array(count).fill(0)});envelope.version=SAVE_VERSION;
}
/** Copy only bounded JSON data. Accessors, class instances and cycles are rejected. */
function copyJson(value:unknown):unknown {
 let nodes=0,bytes=0;const parents=new Set<object>();
 function copy(v:unknown,path:string,depth:number):unknown {
  if(++nodes>2000000||depth>32)bad(path,'save is too large or deeply nested');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))bad(path,'numbers must be finite');return v;}
  if(typeof v==='string'){bytes+=v.length*2;if(bytes>MAX_SAVE_BYTES)bad(path,'save exceeds size limit');return v;}
  if(!v||typeof v!=='object')bad(path,'expected JSON data');
  if(parents.has(v))bad(path,'cyclic reference');parents.add(v);
  let result:unknown;
  if(Array.isArray(v)){
   if(v.length>100000)bad(path,'array exceeds size limit');
   const array:unknown[]=[];for(let i=0;i<v.length;i++){const descriptor=Object.getOwnPropertyDescriptor(v,String(i));if(!descriptor||!('value' in descriptor))bad(path,'array accessors and gaps are forbidden');array.push(copy(descriptor.value,`${path}[${i}]`,depth+1));}result=array;
  }else{
   const prototype=Object.getPrototypeOf(v);if(prototype!==Object.prototype&&prototype!==null)bad(path,'expected a plain object');
   // Authored actor labels and runtime counters can exceed fixed-schema key counts.
   // Their own validators retain semantic bounds; this copy shares the array budget.
   const keys=Object.keys(v);if(keys.length>100000||Object.getOwnPropertySymbols(v).length)bad(path,'invalid object properties');
   const record:RecordValue={};for(const key of keys){if(key==='__proto__'||key==='constructor'||key==='prototype')bad(path,'unsafe property name');const descriptor=Object.getOwnPropertyDescriptor(v,key)!;if(!('value' in descriptor))bad(path,'accessors are forbidden');if(descriptor.value!==undefined)record[key]=copy(descriptor.value,`${path}.${key}`,depth+1);}
   result=record;
  }
  parents.delete(v);return result;
 }
 return copy(value,'save',0);
}
function checkSize(value:unknown):void {if(new TextEncoder().encode(JSON.stringify(value)).byteLength>MAX_SAVE_BYTES)bad('save','save exceeds size limit');}
export function saveGame(state:GameState):SaveEnvelope {
 const envelope=copyJson({format:'orcs-vs-fairies-save',version:SAVE_VERSION,state:{...state,explored:state.explored.map(set=>[...set]),visible:state.visible.map(set=>[...set])},runtime:captureRuntime(state)});
 checkSize(envelope);validateCurrent(envelope);return envelope;
}
export function loadGame(input:unknown):GameState {
 let source=input;
 if(typeof input==='string'){if(input.length>MAX_SAVE_BYTES||new TextEncoder().encode(input).byteLength>MAX_SAVE_BYTES)bad('save','save exceeds size limit');try{source=JSON.parse(input);}catch{bad('save','invalid JSON');}}
 const envelope=copyJson(source);checkSize(envelope);const record=object(envelope,'save',['format','version','state','runtime']);
 if(record.version===1)migrateLegacy(record);if(record.version===2)migrateAi(record);
 validateCurrent(envelope);if(!envelope.state.rules){const state=envelope.state as unknown as GameState;state.rules=normalizeMatchRules({sharedVision:state.sharedVision},state.content);state.draft=createDraft(draftPlayers(state),state.rules,state.content);state.objectives=emptyObjectives(state);}
 checkSize(envelope);validateCurrent(envelope);
 const state:GameState={...envelope.state,explored:envelope.state.explored.map(values=>new Set(values)),visible:envelope.state.visible.map(values=>new Set(values))};
 if(state.world)state.world.levels[0].terrain=state.terrain;
 restoreRuntime(state,envelope.runtime);return state;
}
