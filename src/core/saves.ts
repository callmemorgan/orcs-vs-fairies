import { FACTIONS, UPGRADES } from './content';
import { MAP_VERSION, TERRAIN } from './maps';
import { captureRuntime, MAX_ORDER_QUEUE, restoreRuntime } from './simulation';
import type { RuntimeSnapshot } from './simulation';
import type { GameState } from './types';

export const SAVE_VERSION=1;
export const MAX_SAVE_BYTES=16*1024*1024;
type SerializedState=Omit<GameState,'explored'|'visible'> & {explored:[number[],number[]];visible:[number[],number[]]};
export interface SaveEnvelope {format:'orcs-vs-fairies-save';version:typeof SAVE_VERSION;state:SerializedState;runtime:RuntimeSnapshot}
const MAX_ID=0x7fffffff,MAX_VALUE=1e12,MAX_ENTITIES=4096,MAX_RESOURCES=8192;
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
interface Context {width:number;height:number;cells:number;nextId:number;entityIds:Set<number>;resourceIds:Set<number>;eventCount:number}
function id(value:unknown,path:string,c:Context):number {return number(value,path,1,c.nextId-1,true);}
function point(value:unknown,path:string,c:Context):void {const p=object(value,path,['x','y']);number(p.x,`${path}.x`,0,c.width);number(p.y,`${path}.y`,0,c.height);}
function coordinates(value:RecordValue,path:string,c:Context):void {number(value.x,`${path}.x`,0,c.width);number(value.y,`${path}.y`,0,c.height);}
function order(value:unknown,path:string,c:Context):void {
 const o=object(value,path,['type'],['x','y','target']);
 choice(o.type,`${path}.type`,['idle','hold','move','attackMove','attack','gather','build']);
 if(o.type==='move'||o.type==='attackMove'){object(value,path,['type','x','y']);coordinates(o,path,c);}
 else if(o.type==='attack'||o.type==='gather'||o.type==='build'){object(value,path,['type','target']);id(o.target,`${path}.target`,c);}
 else object(value,path,['type']);
}
function uniqueIds(values:unknown[],path:string,max:number):Set<number> {
 const result=new Set<number>();values.forEach((v,i)=>{const n=number(v,`${path}[${i}]`,0,max,true);if(result.has(n))bad(path,'duplicate value');result.add(n);});return result;
}
function fog(value:unknown,path:string,c:Context):[Set<number>,Set<number>] {
 return list(value,path,2,2).map((v,i)=>uniqueIds(list(v,`${path}[${i}]`,c.cells),`${path}[${i}]`,c.cells-1)) as [Set<number>,Set<number>];
}
function validateEntity(value:unknown,path:string,c:Context):void {
 const e=object(value,path,['id','side','kind','role','x','y','hp','maxHp','order','cooldown','progress','queue','trainProgress','researchProgress','facing','animation','animTime','momentum','illusion','expires','carried','carriedKind','path'],['orderQueue','research','rally','gateOpen','lastAttacker','abilityReadyAt','entrenchedAt','raised','shield','maxShield','lastDamagedAt','surgeUntil']);
 const entityId=id(e.id,`${path}.id`,c);if(c.entityIds.has(entityId))bad(`${path}.id`,'duplicate entity or resource id');c.entityIds.add(entityId);
 number(e.side,`${path}.side`,0,1,true);choice(e.kind,`${path}.kind`,['unit','building']);choice(e.role,`${path}.role`,e.kind==='unit'?UNIT_ROLES:BUILDING_ROLES);coordinates(e,path,c);
 const maxHp=number(e.maxHp,`${path}.maxHp`,Number.MIN_VALUE,1e9);number(e.hp,`${path}.hp`,0,maxHp);order(e.order,`${path}.order`,c);
 for(const key of ['cooldown','animTime','expires'])number(e[key],`${path}.${key}`);
 for(const key of ['progress','trainProgress'])number(e[key],`${path}.${key}`,0,1);
 // Completed research can reach 1+dt for a single tick before being reset.
 number(e.researchProgress,`${path}.researchProgress`,0,2);
 number(e.facing,`${path}.facing`,0,7,true);choice(e.animation,`${path}.animation`,['idle','walk','attack','death']);number(e.momentum,`${path}.momentum`,0,1);flag(e.illusion,`${path}.illusion`);number(e.carried,`${path}.carried`,0,18);choice(e.carriedKind,`${path}.carriedKind`,RESOURCE_KINDS);
 const queue=list(e.queue,`${path}.queue`,5);queue.forEach((role,i)=>{choice(role,`${path}.queue[${i}]`,UNIT_ROLES);if(e.kind!=='building'||(e.role!=='hq'&&e.role!=='barracks')||(e.role==='hq'&&role!=='worker')||(e.role==='barracks'&&role==='worker'))bad(`${path}.queue`,'invalid producer or recruit');});
 list(e.path,`${path}.path`,c.cells*16).forEach((p,i)=>point(p,`${path}.path[${i}]`,c));
 if(e.orderQueue!==undefined){if(e.kind!=='unit'||e.illusion)bad(`${path}.orderQueue`,'only real units can queue orders');list(e.orderQueue,`${path}.orderQueue`,MAX_ORDER_QUEUE).forEach((o,i)=>order(o,`${path}.orderQueue[${i}]`,c));}
 if(e.research!==undefined){choice(e.research,`${path}.research`,Object.keys(UPGRADES));if(e.kind!=='building'||UPGRADES[e.research as keyof typeof UPGRADES].building!==e.role)bad(`${path}.research`,'wrong research building');}
 if(e.rally!==undefined)point(e.rally,`${path}.rally`,c);
 for(const key of ['gateOpen','raised'])optionalFlag(e,key,path);
 if(e.lastAttacker!==undefined)id(e.lastAttacker,`${path}.lastAttacker`,c);
 for(const key of ['abilityReadyAt','entrenchedAt','lastDamagedAt','surgeUntil','shield','maxShield'])optionalNumber(e,key,path);
 if(e.shield!==undefined&&(e.shield as number)>(e.maxShield as number|undefined??0))bad(`${path}.shield`,'shield exceeds capacity');
}
function pair(value:unknown,path:string,check:(v:unknown,p:string)=>void):void {list(value,path,2,2).forEach((v,i)=>check(v,`${path}[${i}]`));}
function entries(value:unknown,path:string,max:number,c:Context,check:(v:unknown,p:string)=>void):void {
 const seen=new Set<number>();list(value,path,max).forEach((entry,i)=>{const p=`${path}[${i}]`,parts=list(entry,p,2,2),key=id(parts[0],`${p}[0]`,c);if(seen.has(key))bad(path,'duplicate map key');seen.add(key);check(parts[1],`${p}[1]`);});
}
function validateRuntime(value:unknown,c:Context):void {
 const path='runtime',r=object(value,path,['fog','ai','aiTurns','hits','routes','abilities','returning','aiWave','initialScoutDispatched','expansionScout','expansionScoutDispatched','knownEnemyBuildings','enemyStartCleared','searched']);
 number(r.fog,'runtime.fog',-.25,.2);number(r.ai,'runtime.ai',-.25,1);number(r.aiTurns,'runtime.aiTurns',0,MAX_VALUE,true);
 list(r.hits,'runtime.hits',MAX_ENTITIES).forEach((v,i)=>{const p=`runtime.hits[${i}]`,h=object(v,p,['source','target','amount','event']);for(const key of ['source','target'])if(!c.entityIds.has(id(h[key],`${p}.${key}`,c)))bad(`${p}.${key}`,'missing hit entity');number(h.amount,`${p}.amount`,0,1e9);number(h.event,`${p}.event`,0,c.eventCount-1,true);});
 entries(r.routes,'runtime.routes',MAX_ID,c,(v,p)=>{const route=object(v,p,['key','at']);if(typeof route.key!=='string'||route.key.length>128)bad(`${p}.key`,'invalid route key');number(route.at,`${p}.at`);});
 entries(r.abilities,'runtime.abilities',MAX_ID,c,(v,p)=>number(v,p));
 uniqueIds(list(r.returning,'runtime.returning',MAX_ID),'runtime.returning',c.nextId-1).forEach(n=>{if(n===0)bad('runtime.returning','invalid entity id');});
 pair(r.aiWave,'runtime.aiWave',(v,p)=>number(v,p));
 for(const key of ['initialScoutDispatched','expansionScoutDispatched','enemyStartCleared'])pair(r[key],`runtime.${key}`,flag);
 pair(r.expansionScout,'runtime.expansionScout',(v,p)=>{if(v!==null)id(v,p,c);});
 pair(r.knownEnemyBuildings,'runtime.knownEnemyBuildings',(v,p)=>entries(v,p,MAX_ENTITIES,c,(value,q)=>{const b=object(value,q,['x','y','role']);coordinates(b,q,c);choice(b.role,`${q}.role`,BUILDING_ROLES);}));
 pair(r.searched,'runtime.searched',(v,p)=>uniqueIds(list(v,p,c.cells),p,c.cells-1));
}
function validate(envelope:unknown):asserts envelope is SaveEnvelope {
 const save=object(envelope,'save',['format','version','state','runtime']);if(save.format!=='orcs-vs-fairies-save')bad('format','unknown save format');if(save.version!==SAVE_VERSION)bad('version',`unsupported version ${String(save.version)}`);
 const s=object(save.state,'state',['controllers','mapSize','mapVersion','terrain','starts','draw','tick','corpses','time','seed','width','height','entities','resources','players','winner','events','explored','visible','nextId']);
 const width=number(s.width,'state.width',8,256,true),height=number(s.height,'state.height',8,256,true),nextId=number(s.nextId,'state.nextId',1,MAX_ID,true);
 const c:Context={width,height,cells:width*height,nextId,entityIds:new Set(),resourceIds:new Set(),eventCount:0};
 pair(s.controllers,'state.controllers',(v,p)=>choice(v,p,['human','ai','external']));choice(s.mapSize,'state.mapSize',['small','medium','large','huge']);number(s.mapVersion,'state.mapVersion',1,MAP_VERSION,true);
 list(s.terrain,'state.terrain',c.cells,c.cells).forEach((v,i)=>choice(v,`state.terrain[${i}]`,Object.keys(TERRAIN)));pair(s.starts,'state.starts',(v,p)=>point(v,p,c));flag(s.draw,'state.draw');number(s.tick,'state.tick',0,MAX_VALUE,true);number(s.time,'state.time');number(s.seed,'state.seed',0,0xffffffff,true);
 list(s.entities,'state.entities',MAX_ENTITIES).forEach((v,i)=>validateEntity(v,`state.entities[${i}]`,c));
 list(s.resources,'state.resources',MAX_RESOURCES).forEach((v,i)=>{const p=`state.resources[${i}]`,r=object(v,p,['id','x','y','kind','amount','maxAmount']),key=id(r.id,`${p}.id`,c);if(c.entityIds.has(key)||c.resourceIds.has(key))bad(`${p}.id`,'duplicate entity or resource id');c.resourceIds.add(key);coordinates(r,p,c);choice(r.kind,`${p}.kind`,RESOURCE_KINDS);const max=number(r.maxAmount,`${p}.maxAmount`,0,1e9);number(r.amount,`${p}.amount`,0,max);});
 pair(s.players,'state.players',(v,p)=>{const player=object(v,p,['faction','wood','ore','crystal','population','cap','upgrades']);choice(player.faction,`${p}.faction`,Object.keys(FACTIONS));for(const key of RESOURCE_KINDS)number(player[key],`${p}.${key}`);number(player.population,`${p}.population`,0,MAX_ENTITIES,true);number(player.cap,`${p}.cap`,0,100,true);const upgrades=list(player.upgrades,`${p}.upgrades`,Object.keys(UPGRADES).length);upgrades.forEach((u,i)=>choice(u,`${p}.upgrades[${i}]`,Object.keys(UPGRADES)));if(new Set(upgrades).size!==upgrades.length)bad(`${p}.upgrades`,'duplicate upgrade');});
 if(s.winner!==null)number(s.winner,'state.winner',0,1,true);if(s.draw&&s.winner!==null)bad('state.winner','draw cannot have a winner');
 list(s.corpses,'state.corpses',MAX_ENTITIES*2).forEach((v,i)=>{const p=`state.corpses[${i}]`,corpse=object(v,p,['id','x','y','expires']);id(corpse.id,`${p}.id`,c);coordinates(corpse,p,c);number(corpse.expires,`${p}.expires`);});
 const events=list(s.events,'state.events',MAX_ENTITIES*4);c.eventCount=events.length;
 events.forEach((v,i)=>{const p=`state.events[${i}]`,event=object(v,p,['type','x','y','side'],['text','target','source','amount','resource']);choice(event.type,`${p}.type`,['attack','death','build','train','gather','message','ability','research']);coordinates(event,p,c);number(event.side,`${p}.side`,0,1,true);for(const key of ['source','target'])if(event[key]!==undefined)id(event[key],`${p}.${key}`,c);optionalNumber(event,'amount',p);if(event.resource!==undefined)choice(event.resource,`${p}.resource`,RESOURCE_KINDS);if(event.text!==undefined&&(typeof event.text!=='string'||event.text.length>4096))bad(`${p}.text`,'invalid message text');});
 const explored=fog(s.explored,'state.explored',c),visible=fog(s.visible,'state.visible',c);visible.forEach((tiles,side)=>{for(const tile of tiles)if(!explored[side].has(tile))bad(`state.visible[${side}]`,'visible tiles must be explored');});
 validateRuntime(save.runtime,c);
}
/** Copy only bounded JSON data. Accessors, class instances and cycles are rejected. */
function copyJson(value:unknown):unknown {
 let nodes=0,bytes=0;const parents=new Set<object>();
 function copy(v:unknown,path:string,depth:number):unknown {
  if(++nodes>500000||depth>32)bad(path,'save is too large or deeply nested');
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
   const keys=Object.keys(v);if(keys.length>128||Object.getOwnPropertySymbols(v).length)bad(path,'invalid object properties');
   const record:RecordValue={};for(const key of keys){if(key==='__proto__'||key==='constructor'||key==='prototype')bad(path,'unsafe property name');const descriptor=Object.getOwnPropertyDescriptor(v,key)!;if(!('value' in descriptor))bad(path,'accessors are forbidden');if(descriptor.value!==undefined)record[key]=copy(descriptor.value,`${path}.${key}`,depth+1);}
   result=record;
  }
  parents.delete(v);return result;
 }
 return copy(value,'save',0);
}
export function saveGame(state:GameState):SaveEnvelope {
 const envelope=copyJson({format:'orcs-vs-fairies-save',version:SAVE_VERSION,state:{...state,explored:state.explored.map(set=>[...set]),visible:state.visible.map(set=>[...set])},runtime:captureRuntime(state)});
 validate(envelope);return envelope;
}
export function loadGame(input:unknown):GameState {
 let source=input;
 if(typeof input==='string'){if(input.length>MAX_SAVE_BYTES)bad('save','save exceeds size limit');try{source=JSON.parse(input);}catch{bad('save','invalid JSON');}}
 const envelope=copyJson(source);validate(envelope);
 const state:GameState={...envelope.state,explored:envelope.state.explored.map(values=>new Set(values)) as [Set<number>,Set<number>],visible:envelope.state.visible.map(values=>new Set(values)) as [Set<number>,Set<number>]};
 restoreRuntime(state,envelope.runtime);return state;
}
