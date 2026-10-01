import { generateMatchMap, MAP_VERSION, TERRAIN } from '../core/maps';
import { SAVE_VERSION } from '../core/saves';
import { validateWorldMap } from '../core/world-map';
import type { MapSize, TerrainKind } from '../core/types';
import type { WorldMapData, WorldPoint } from '../core/world-types';

export type EditorPoint=WorldPoint;
export type EditorMapData=WorldMapData;
export interface MapPackage {
 schemaVersion:1; kind:'map'; id:string; title:string; author:string; revision:number;
 simulationVersion:number; mapVersion:number; contentHash:string; hash:string; map:EditorMapData;
}
export interface MapPackageMetadata {
 id:string; title:string; author:string; revision:number; simulationVersion?:number; mapVersion?:number;
}
export type MapMetadata=MapPackageMetadata;
export interface EditorMapValidation {
 valid:boolean; issues:string[]; startsConnected:boolean; reachableResources:number;
 totalResources:number; reachableTiles:number;
}
export const EDITOR_MAP_LIMITS={minimumDimension:8,maximumDimension:128,levels:2,elevation:3,resources:2048,sites:128,transitions:64,bytes:16*1024*1024} as const;
// Save versions identify the current simulation until a separate version is introduced.
export const EDITOR_SIMULATION_VERSION=SAVE_VERSION;
type RecordValue=Record<string,unknown>;
const MAP_FIELDS=['width','height','size','seed','levels','starts','resources','sites','transitions'];
const PACKAGE_FIELDS=['schemaVersion','kind','id','title','author','revision','simulationVersion','mapVersion','contentHash','hash','map'];
const HASH_PATTERN=/^[0-9a-f]{16}$/;
function bad(path:string,detail:string):never {throw new Error(`Invalid editor map at ${path}: ${detail}.`);}

/** Copy bounded JSON without invoking input getters or accepting class instances. */
function copyJson(input:unknown):unknown {
 let nodes=0,stringBytes=0;const ancestors=new Set<object>();
 function copy(value:unknown,path:string,depth:number):unknown {
  if(++nodes>500000||depth>16)bad(path,'document exceeds size or depth limit');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))bad(path,'expected finite JSON number');return Object.is(value,-0)?0:value;}
  if(typeof value==='string'){stringBytes+=value.length*2;if(stringBytes>EDITOR_MAP_LIMITS.bytes)bad(path,'document exceeds byte limit');return value;}
  if(!value||typeof value!=='object')bad(path,'expected JSON data');
  if(ancestors.has(value))bad(path,'cyclic references are forbidden');
  ancestors.add(value);let result:unknown;
  if(Array.isArray(value)){
   if(value.length>EDITOR_MAP_LIMITS.maximumDimension**2)bad(path,'array exceeds length limit');
   const keys=Reflect.ownKeys(value);if(keys.length!==value.length+1||keys.some(k=>typeof k!=='string'||(k!=='length'&&!/^(0|[1-9][0-9]*)$/.test(k))))bad(path,'array gaps or extra properties are forbidden');
   const array:unknown[]=[];
   for(let i=0;i<value.length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor||!('value' in descriptor))bad(`${path}[${i}]`,'array gaps and accessors are forbidden');array.push(copy(descriptor.value,`${path}[${i}]`,depth+1));}
   result=array;
  }else{
   const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)bad(path,'expected plain object');
   const keys=Reflect.ownKeys(value);if(keys.length>32||keys.some(key=>typeof key!=='string'))bad(path,'invalid object properties');
   const record:RecordValue=Object.create(null);
   for(const key of keys as string[]){const descriptor=Object.getOwnPropertyDescriptor(value,key)!;if(!('value' in descriptor)||!descriptor.enumerable)bad(`${path}.${key}`,'accessors and hidden fields are forbidden');if(['__proto__','constructor','prototype'].includes(key))bad(path,'unsafe property name');record[key]=copy(descriptor.value,`${path}.${key}`,depth+1);}
   result=record;
  }
  ancestors.delete(value);return result;
 }
 const result=copy(input,'map',0);
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>EDITOR_MAP_LIMITS.bytes)bad('map','document exceeds byte limit');
 return result;
}
function source(input:unknown):unknown {
 if(typeof input!=='string')return copyJson(input);
 if(input.length>EDITOR_MAP_LIMITS.bytes||new TextEncoder().encode(input).byteLength>EDITOR_MAP_LIMITS.bytes)bad('map','document exceeds byte limit');
 let parsed:unknown;try{parsed=JSON.parse(input);}catch{bad('map','invalid JSON');}return copyJson(parsed);
}
function object(value:unknown,path:string,fields:readonly string[]):RecordValue {
 if(!value||typeof value!=='object'||Array.isArray(value))bad(path,'expected object');
 const record=value as RecordValue;
 for(const key of fields)if(!Object.hasOwn(record,key))bad(`${path}.${key}`,'missing field');
 for(const key of Object.keys(record))if(!fields.includes(key))bad(`${path}.${key}`,'unknown field');
 return record;
}
function number(value:unknown,path:string,min:number,max:number,integer=false):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))bad(path,`expected ${integer?'integer':'number'} between ${min} and ${max}`);
 return value;
}
function textValue(value:unknown,path:string,max:number,allowEmpty=false):string {
 if(typeof value!=='string'||value.length>max||(!allowEmpty&&!value.trim())||/[\u0000-\u001f\u007f]/.test(value))bad(path,'invalid text');
 return value;
}
function choice<T extends string>(value:unknown,path:string,choices:readonly T[]):T {if(typeof value!=='string'||!choices.includes(value as T))bad(path,'unknown value');return value as T;}
function array(value:unknown,path:string,max:number,length?:number):unknown[] {if(!Array.isArray(value)||value.length>max||(length!==undefined&&value.length!==length))bad(path,'invalid array length');return value;}
function unique(set:Set<number>,value:number,path:string):void {if(set.has(value))bad(path,'duplicate ID or slot');set.add(value);}
function readMap(value:unknown):EditorMapData {
 const m=object(value,'map',MAP_FIELDS),width=number(m.width,'map.width',8,128,true),height=number(m.height,'map.height',8,128,true),cells=width*height;
 choice(m.size,'map.size',['small','medium','large','huge']);number(m.seed,'map.seed',0,0xffffffff,true);
 const levelIds=new Set<number>(),levels=array(m.levels,'map.levels',2);if(!levels.length)bad('map.levels','at least one level is required');
 levels.forEach((value,index)=>{const path=`map.levels[${index}]`,level=object(value,path,['id','title','terrain','elevation']);unique(levelIds,number(level.id,`${path}.id`,0,1,true),`${path}.id`);if(level.id!==index)bad(`${path}.id`,'levels must be ordered from 0');textValue(level.title,`${path}.title`,80);array(level.terrain,`${path}.terrain`,cells,cells).forEach((kind,tile)=>choice(kind,`${path}.terrain[${tile}]`,Object.keys(TERRAIN) as TerrainKind[]));array(level.elevation,`${path}.elevation`,cells,cells).forEach((height,tile)=>number(height,`${path}.elevation[${tile}]`,0,3,true));});
 if(!levelIds.has(0))bad('map.levels','ground level 0 is required');
 const point=(p:RecordValue,path:string)=>{number(p.x,`${path}.x`,.5,width-.5);number(p.y,`${path}.y`,.5,height-.5);const level=number(p.level,`${path}.level`,0,1,true);if(!levelIds.has(level))bad(`${path}.level`,'unknown level');};
 const slots=new Set<number>();array(m.starts,'map.starts',8).forEach((value,index)=>{const path=`map.starts[${index}]`,start=object(value,path,['x','y','level','slot']);point(start,path);unique(slots,number(start.slot,`${path}.slot`,0,7,true),`${path}.slot`);});
 array(m.resources,'map.resources',EDITOR_MAP_LIMITS.resources).forEach((value,index)=>{const path=`map.resources[${index}]`,resource=object(value,path,['x','y','level','kind','amount','maxAmount']);point(resource,path);choice(resource.kind,`${path}.kind`,['wood','ore','crystal']);const max=number(resource.maxAmount,`${path}.maxAmount`,0,1e9);number(resource.amount,`${path}.amount`,0,max);});
 const siteIds=new Set<number>();array(m.sites,'map.sites',EDITOR_MAP_LIMITS.sites).forEach((value,index)=>{const path=`map.sites[${index}]`,site=object(value,path,['id','x','y','level','kind']);point(site,path);unique(siteIds,number(site.id,`${path}.id`,1,0x7fffffff,true),`${path}.id`);choice(site.kind,`${path}.kind`,['relic','village','monster']);});
 const transitionIds=new Set<number>();array(m.transitions,'map.transitions',EDITOR_MAP_LIMITS.transitions).forEach((value,index)=>{const path=`map.transitions[${index}]`,transition=object(value,path,['id','from','to']);unique(transitionIds,number(transition.id,`${path}.id`,1,0x7fffffff,true),`${path}.id`);point(object(transition.from,`${path}.from`,['x','y','level']),`${path}.from`);point(object(transition.to,`${path}.to`,['x','y','level']),`${path}.to`);});
 // Rebuild ordinary objects so callers receive a detached, conventional editable document.
 return JSON.parse(JSON.stringify(m)) as EditorMapData;
}

/** Shape, limits and references only. Physical errors remain editable after import. */
export function decodeEditorMap(input:unknown):EditorMapData {return readMap(source(input));}
export function createEditorMap(seed:number,size:MapSize='medium',players=2):EditorMapData {
 const map=generateMatchMap(seed,size,players);
 return {width:map.width,height:map.height,size:map.size,seed:map.seed,levels:[{id:0,title:'Ground',terrain:[...map.terrain],elevation:Array(map.width*map.height).fill(0)}],starts:map.starts.map((p,slot)=>({...p,level:0,slot})),resources:map.resources.map(p=>({...p,level:0})),sites:[],transitions:[]};
}

function canonical(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(value&&typeof value==='object'){const record=value as RecordValue;return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;}
 return JSON.stringify(value);
}
/** Two independent 32-bit checksums; integrity/version marker, not an authentication signature. */
function checksum(value:unknown):string {
 const bytes=new TextEncoder().encode(canonical(value));let a=0x811c9dc5,b=0x9e3779b9;
 for(const byte of bytes){a=Math.imul(a^byte,0x01000193)>>>0;b=Math.imul(b^byte,0x85ebca6b)>>>0;}
 return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}
export function canonicalMapHash(input:unknown):string {return checksum(decodeEditorMap(input));}
function metadata(value:unknown):MapPackageMetadata {
 const m=object(value,'package',['id','title','author','revision','simulationVersion','mapVersion']);
 const id=textValue(m.id,'package.id',64);if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id))bad('package.id','expected letters, numbers, dots, underscores or hyphens');
 textValue(m.title,'package.title',120);textValue(m.author,'package.author',120);number(m.revision,'package.revision',1,0x7fffffff,true);
 if(m.simulationVersion!==EDITOR_SIMULATION_VERSION)bad('package.simulationVersion',`unsupported simulation version; expected ${EDITOR_SIMULATION_VERSION}`);
 if(m.mapVersion!==MAP_VERSION)bad('package.mapVersion',`unsupported map version; expected ${MAP_VERSION}`);
 return m as unknown as MapPackageMetadata;
}
export function canonicalPackageHash(input:Omit<MapPackage,'hash'>):string {
 const value=object(source(input),'package',PACKAGE_FIELDS.filter(key=>key!=='hash'));
 if(value.schemaVersion!==1||value.kind!=='map')bad('package','unsupported package schema or kind');
 const m=metadata({id:value.id,title:value.title,author:value.author,revision:value.revision,simulationVersion:value.simulationVersion,mapVersion:value.mapVersion});
 const map=readMap(value.map),contentHash=canonicalMapHash(map);if(value.contentHash!==contentHash)bad('package.contentHash','map checksum mismatch');
 return checksum({schemaVersion:1,kind:'map',...m,contentHash,map});
}
export function makeMapPackage(input:MapPackageMetadata,mapInput:EditorMapData):MapPackage {
 const copied=source(input),m=object(copied,'metadata',['id','title','author','revision',...(['simulationVersion','mapVersion'].filter(key=>!!copied&&typeof copied==='object'&&Object.hasOwn(copied,key)))]);
 for(const key of Object.keys(m))if(!['id','title','author','revision','simulationVersion','mapVersion'].includes(key))bad(`metadata.${key}`,'unknown field');
 const info=metadata({...m,simulationVersion:Object.hasOwn(m,'simulationVersion')?m.simulationVersion:EDITOR_SIMULATION_VERSION,mapVersion:Object.hasOwn(m,'mapVersion')?m.mapVersion:MAP_VERSION}),map=decodeEditorMap(mapInput),validation=validateEditorMap(map);
 if(!validation.valid)bad('map',validation.issues.join('; '));
 const data:Omit<MapPackage,'hash'>={schemaVersion:1,kind:'map',id:info.id,title:info.title,author:info.author,revision:info.revision,simulationVersion:info.simulationVersion!,mapVersion:info.mapVersion!,contentHash:canonicalMapHash(map),map};
 return {...data,hash:canonicalPackageHash(data)};
}
/** Verify integrity/current versions while keeping physical validation issues editable. */
export function decodeMapPackage(input:unknown):MapPackage {
 const value=object(source(input),'package',PACKAGE_FIELDS);
 if(value.schemaVersion!==1||value.kind!=='map')bad('package','unsupported package schema or kind');
 for(const key of ['hash','contentHash'])if(typeof value[key]!=='string'||!HASH_PATTERN.test(value[key] as string))bad(`package.${key}`,'invalid checksum');
 const {hash,...withoutHash}=value;if(hash!==canonicalPackageHash(withoutHash as unknown as Omit<MapPackage,'hash'>))bad('package.hash','package checksum mismatch');
 return {...withoutHash,map:readMap(value.map),hash} as unknown as MapPackage;
}

const UNIT_RADIUS=.27,HQ_RADIUS=1.5,HQ_CLEARANCE=1.77,RESOURCE_RADIUS=.7;
type Point=EditorPoint;
function sameLevel(a:Point,b:Point):boolean {return a.level===b.level;}
function separation(a:Point,b:Point):number {return sameLevel(a,b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;}
function opening(start:EditorMapData['starts'][number],height:number):Point[] {
 const dir=start.y<height/2?1:-1;
 return [...Array.from({length:5},(_,i)=>({x:start.x+(-2+i*.85)*dir,y:start.y+3*dir,level:start.level})),{x:start.x+3*dir,y:start.y+dir,level:start.level}];
}
/** Play checks allow asymmetric terrain and economies; every opening and deposit must be reachable. */
export function validateEditorMap(input:unknown):EditorMapValidation {
 let map:EditorMapData;try{map=decodeEditorMap(input);}catch(error){return {valid:false,issues:[error instanceof Error?error.message:String(error)],startsConnected:false,reachableResources:0,totalResources:0,reachableTiles:0};}
 let result=validatePlayableMap(map,.5);
 // Match navigation's quarter-tile retry for legal passages missed by half-tile centers.
 if(!result.valid&&result.issues.every(issue=>/disconnected|unreachable|endpoints must be passable/.test(issue)))result=validatePlayableMap(map,.25);
 const issues=[...new Set([...result.issues,...validateWorldMap(map).issues])];
 return {...result,valid:issues.length===0,issues};
}
function validatePlayableMap(map:EditorMapData,CELL:number):EditorMapValidation {
 const {width,height,starts,resources,sites,transitions}=map,issues:string[]=[],levels=new Map(map.levels.map(level=>[level.id,level]));
 const tile=(p:Point)=>Math.floor(p.y)*width+Math.floor(p.x);
 const terrain=(p:Point)=>levels.get(p.level)!.terrain[tile(p)];
 const resourceBuckets=new Map<string,EditorMapData['resources']>();
 for(const resource of resources){const key=`${resource.level},${Math.floor(resource.x)},${Math.floor(resource.y)}`,bucket=resourceBuckets.get(key)??[];bucket.push(resource);resourceBuckets.set(key,bucket);}
 const nearby=(p:Point,radius:number)=>{const result:EditorMapData['resources']=[];for(let y=Math.floor(p.y-radius);y<=Math.floor(p.y+radius);y++)for(let x=Math.floor(p.x-radius);x<=Math.floor(p.x+radius);x++)result.push(...(resourceBuckets.get(`${p.level},${x},${y}`)??[]));return result;};
 const walkable=(p:Point)=>{
  if(p.x<.35||p.y<.35||p.x>width-.35||p.y>height-.35)return false;
  const level=levels.get(p.level)!;
  for(let y=Math.floor(p.y-UNIT_RADIUS);y<=Math.floor(p.y+UNIT_RADIUS);y++)for(let x=Math.floor(p.x-UNIT_RADIUS);x<=Math.floor(p.x+UNIT_RADIUS);x++)if(!TERRAIN[level.terrain[y*width+x]??'rock'].walkable)return false;
  if(starts.some(start=>sameLevel(p,start)&&Math.abs(p.x-start.x)<HQ_CLEARANCE&&Math.abs(p.y-start.y)<HQ_CLEARANCE))return false;
  return !nearby(p,RESOURCE_RADIUS).some(resource=>resource.amount>0&&separation(resource,p)<RESOURCE_RADIUS);
 };
 const segment=(a:Point,b:Point)=>{
  if(!sameLevel(a,b)||!walkable(a)||!walkable(b))return false;
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  for(const resource of nearby({x:(a.x+b.x)/2,y:(a.y+b.y)/2,level:a.level},RESOURCE_RADIUS+Math.sqrt(length)/2)){if(resource.amount<=0)continue;const t=length?Math.max(0,Math.min(1,((resource.x-a.x)*dx+(resource.y-a.y)*dy)/length)):0;if(Math.hypot(a.x+t*dx-resource.x,a.y+t*dy-resource.y)<RESOURCE_RADIUS)return false;}
  const level=levels.get(a.level)!;let previous=level.elevation[tile(a)];
  for(let step=1;step<=4;step++){const p={x:a.x+dx*step/4,y:a.y+dy*step/4,level:a.level},height=level.elevation[tile(p)];if(!walkable(p)||Math.abs(height-previous)>1)return false;previous=height;}
  return true;
 };
 if(!starts.length)issues.push('At least one starting position is required.');
 if(starts.some((_,i)=>!starts.some(start=>start.slot===i)))issues.push('Starting slots must be contiguous from 0.');
 for(const start of starts){
  if(start.x-HQ_RADIUS<.5||start.y-HQ_RADIUS<.5||start.x+HQ_RADIUS>width-.5||start.y+HQ_RADIUS>height-.5)issues.push(`Start ${start.slot} headquarters lies outside the playable border.`);
  const level=levels.get(start.level)!,elevation=level.elevation[tile(start)];let clear=true;
  for(let y=Math.floor(start.y-HQ_RADIUS);y<Math.ceil(start.y+HQ_RADIUS);y++)for(let x=Math.floor(start.x-HQ_RADIUS);x<Math.ceil(start.x+HQ_RADIUS);x++)if(!TERRAIN[level.terrain[y*width+x]??'rock'].buildable||level.elevation[y*width+x]!==elevation)clear=false;
  if(!clear)issues.push(`Start ${start.slot} headquarters requires flat buildable terrain.`);
  if(resources.some(resource=>resource.amount>0&&sameLevel(resource,start)&&Math.abs(resource.x-start.x)<HQ_RADIUS+.8&&Math.abs(resource.y-start.y)<HQ_RADIUS+.8))issues.push(`Start ${start.slot} headquarters overlaps a resource.`);
  if(opening(start,height).some(point=>!walkable(point)))issues.push(`Start ${start.slot} opening units overlap blocked terrain or objects.`);
 }
 for(let a=0;a<starts.length;a++)for(let b=a+1;b<starts.length;b++)if(sameLevel(starts[a],starts[b])&&Math.abs(starts[a].x-starts[b].x)<HQ_RADIUS*2+.4&&Math.abs(starts[a].y-starts[b].y)<HQ_RADIUS*2+.4)issues.push(`Starts ${starts[a].slot} and ${starts[b].slot} headquarters overlap.`);
 resources.forEach((resource,index)=>{if(!TERRAIN[terrain(resource)].walkable)issues.push(`Resource ${index} lies on impassable terrain.`);if(nearby(resource,1.4).some(other=>other!==resource&&separation(resource,other)<1.4))issues.push(`Resource ${index} overlaps another resource.`);});
 sites.forEach(site=>{if(!walkable(site))issues.push(`Site ${site.id} lies on blocked terrain or objects.`);if(sites.some(other=>other!==site&&separation(other,site)<1.4))issues.push(`Site ${site.id} overlaps another site.`);});
 const gridWidth=width/CELL,gridHeight=height/CELL,perLevel=gridWidth*gridHeight,total=perLevel*map.levels.length;
 const offsets=new Map(map.levels.map((level,index)=>[level.id,index*perLevel]));
 const gridPoint=(key:number):Point=>{const offset=Math.floor(key/perLevel),local=key%perLevel;return {x:(local%gridWidth+.5)*CELL,y:(Math.floor(local/gridWidth)+.5)*CELL,level:map.levels[offset].id};};
 const blocked=new Uint8Array(total),seen=new Uint8Array(total);
 for(let key=0;key<total;key++)if(!walkable(gridPoint(key)))blocked[key]=1;
 const connectors=(p:Point)=>{const keys:number[]=[],sx=Math.floor(p.x/CELL),sy=Math.floor(p.y/CELL),offset=offsets.get(p.level)!;for(let y=Math.max(0,sy-1);y<=Math.min(gridHeight-1,sy+1);y++)for(let x=Math.max(0,sx-1);x<=Math.min(gridWidth-1,sx+1);x++){const key=offset+y*gridWidth+x;if(!blocked[key]&&segment(p,gridPoint(key)))keys.push(key);}return keys;};
 const links=new Map<number,number[]>(),pairs=new Set<string>();
 for(const transition of transitions){
  const {from,to}=transition,a=connectors(from),b=connectors(to),endpoint=(p:Point)=>`${p.level},${p.x},${p.y}`,pair=[endpoint(from),endpoint(to)].sort().join(':');
  if(from.level===to.level){issues.push(`Transition ${transition.id} must connect different levels.`);continue;}
  if(endpoint(from)===endpoint(to)||pairs.has(pair)){issues.push(`Transition ${transition.id} repeats an endpoint or connection.`);continue;}pairs.add(pair);
  if(!a.length||!b.length){issues.push(`Transition ${transition.id} endpoints must be passable and reachable from adjacent tiles.`);continue;}
  for(const source of a){const targets=links.get(source)??[];targets.push(...b);links.set(source,targets);}for(const source of b){const targets=links.get(source)??[];targets.push(...a);links.set(source,targets);}
 }
 const queue:number[]=starts.length?connectors(opening(starts[0],height)[0]):[];
 for(const key of queue)seen[key]=1;
 for(let i=0;i<queue.length;i++){
  const key=queue[i],local=key%perLevel,x=local%gridWidth,y=Math.floor(local/gridWidth),p=gridPoint(key);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=gridWidth||ny>=gridHeight)continue;const next=key+dy*gridWidth+dx;if(!seen[next]&&!blocked[next]&&segment(p,gridPoint(next))){seen[next]=1;queue.push(next);}}
  for(const next of links.get(key)??[])if(!seen[next]){seen[next]=1;queue.push(next);}
 }
 const reached=(p:Point)=>connectors(p).some(key=>seen[key]);
 const startsConnected=starts.length>0&&starts.every(start=>opening(start,height).every(reached));if(!startsConnected)issues.push('Starting armies are disconnected.');
 let reachableResources=0;
 resources.forEach((resource,index)=>{const offset=offsets.get(resource.level)!;let found=false;for(let y=Math.max(0,Math.floor((resource.y-1.2)/CELL));y<Math.min(gridHeight,Math.ceil((resource.y+1.2)/CELL));y++)for(let x=Math.max(0,Math.floor((resource.x-1.2)/CELL));x<Math.min(gridWidth,Math.ceil((resource.x+1.2)/CELL));x++){const key=offset+y*gridWidth+x;if(seen[key]&&separation(resource,gridPoint(key))<=1.2)found=true;}if(found)reachableResources++;else issues.push(`Resource ${index} is unreachable by starting workers.`);});
 for(const site of sites)if(!reached(site))issues.push(`Site ${site.id} is unreachable by starting units.`);
 const tiles=new Set<number>();for(const key of queue){const p=gridPoint(key);tiles.add(p.level*width*height+tile(p));}
 return {valid:issues.length===0,issues,startsConnected,reachableResources,totalResources:resources.length,reachableTiles:tiles.size};
}
