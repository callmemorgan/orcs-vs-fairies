import { BUILTIN_EXTRA_ART, BUILTIN_EXTRA_DEFINITIONS } from './specialist-content';
import { ABILITIES, ECONOMY, FACTIONS, UPGRADES } from './content';
import type { BuildingDef, BuildingRole, BuiltinFactionId, Entity, FactionDef, FactionId, GameState, Side, UnitDef, UnitRole, UpgradeDef, UpgradeId } from './types';

export const CONTENT_SCHEMA_VERSION = 1;
export const CONTENT_ENGINE_VERSION = 3;
export const MAX_BUNDLE_BYTES = 4 * 1024 * 1024;
export const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
export interface ContentDependency { id:string; version:string; hash:string }
export interface ContentArt { path:string; svg:string; width:number; height:number; anchor:[number,number]; visualTop?:number }
export interface ModFaction {
  id:FactionId; baseFaction:BuiltinFactionId; name:string; subtitle:string; description:string; color:number; accent:string;
  units:UnitDef[]; buildings:BuildingDef[]; research:UpgradeDef[];
  defaultUnits?:Partial<Record<UnitRole,string>>; defaultBuildings?:Partial<Record<BuildingRole,string>>;
}
export interface ContentPackage {
  format:'orcs-vs-fairies-mod'; schemaVersion:1; engineVersion:3; id:string; version:string; name:string;
  dependencies:ContentDependency[]; factions:ModFaction[]; art:Record<string,ContentArt>; hash:string;
}
export interface ContentBundle {
  format:'orcs-vs-fairies-content'; schemaVersion:1; engineVersion:3; baseHash:string; packages:ContentPackage[]; hash:string;
}
interface Registry { factions:Record<string,FactionDef>; art:Record<string,ContentArt> }
const unitRoles:UnitRole[]=['worker','melee','ranged','special','cavalry','spear','siege'];
const buildingRoles:BuildingRole[]=['hq','depot','barracks','tower','wall','gate'];
const builtinIds=Object.keys(FACTIONS) as BuiltinFactionId[];
const caches=new WeakMap<ContentBundle,Registry>();
function fail(path:string,message:string):never {throw new Error(`Invalid content at ${path}: ${message}.`);}
function obj(input:unknown,path:string,required:string[],optional:string[]=[]):Record<string,unknown>{
  if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail(path,'expected a plain object');
  const value=input as Record<string,unknown>;if(Object.getOwnPropertySymbols(value).length)fail(path,'symbol fields are unsupported');for(const key of Object.keys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!('value' in descriptor))fail(`${path}.${key}`,'accessors are unsupported');}
  for(const key of required)if(!Object.hasOwn(value,key))fail(`${path}.${key}`,'missing field');
  for(const key of Object.keys(value))if(!required.includes(key)&&!optional.includes(key))fail(`${path}.${key}`,'unsupported field');
  return value;
}
function num(v:unknown,path:string,min:number,max:number,integer=false):number {if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isSafeInteger(v))fail(path,`expected ${integer?'a whole':'a finite'} number from ${min} to ${max}`);return v;}
function str(v:unknown,path:string,max=200):string {if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))fail(path,'expected text');return v;}
function arr(v:unknown,path:string,max:number):unknown[]{if(!Array.isArray(v)||v.length>max)fail(path,`expected at most ${max} entries`);for(let i=0;i<v.length;i++)if(!Object.hasOwn(v,i))fail(path,'sparse arrays are not supported');else if(!('value' in Object.getOwnPropertyDescriptor(v,String(i))!))fail(path,'array accessors are unsupported');return v;}
function one(v:unknown,path:string,choices:readonly string[]):string {if(typeof v!=='string'||!choices.includes(v))fail(path,'unsupported value');return v;}
function definitionId(v:unknown,path:string,namespace?:string):string {const value=str(v,path,100);if(!/^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(value)||namespace&&!value.startsWith(`${namespace}:`))fail(path,`expected a namespaced definition ID${namespace?` owned by ${namespace}`:''}`);return value;}
function cost(v:unknown,path:string):void{const value=obj(v,path,['wood','ore','crystal']);for(const key of ['wood','ore','crystal'])num(value[key],`${path}.${key}`,0,100000);}
function unit(v:unknown,path:string,namespace:string):void {
  const value=obj(v,path,['id','name','role','cost','hp','damage','armor','range','speed','cooldown','trainTime','sight','description'],['shield','buildingDamageMultiplier','age','bonusAgainst','ability','tags']);
  definitionId(value.id,`${path}.id`,namespace);str(value.name,`${path}.name`);str(value.description,`${path}.description`,2000);one(value.role,`${path}.role`,unitRoles);cost(value.cost,`${path}.cost`);
  for(const [key,min,max] of [['hp',1,100000],['damage',0,10000],['armor',0,1000],['range',.5,30],['speed',.1,10],['cooldown',.05,60],['trainTime',.05,600],['sight',1,30]] as const)num(value[key],`${path}.${key}`,min,max);
  if(value.shield!==undefined)num(value.shield,`${path}.shield`,0,100000);
  if(value.buildingDamageMultiplier!==undefined)num(value.buildingDamageMultiplier,`${path}.buildingDamageMultiplier`,.1,10);
  if(value.age!==undefined)num(value.age,`${path}.age`,1,3,true);
  if(value.ability!==undefined)one(value.ability,`${path}.ability`,Object.keys(ABILITIES));if(value.tags!==undefined)arr(value.tags,`${path}.tags`,2).forEach((tag,i)=>one(tag,`${path}.tags[${i}]`,['hero','engineer']));
  if(value.bonusAgainst!==undefined){const bonuses=obj(value.bonusAgainst,`${path}.bonusAgainst`,[],unitRoles);for(const [key,factor] of Object.entries(bonuses))num(factor,`${path}.bonusAgainst.${key}`,.1,10);}
}
function building(v:unknown,path:string,namespace:string):void {
  const value=obj(v,path,['id','name','role','cost','hp','size','buildTime','sight','description'],['age','ability','tags']);
  definitionId(value.id,`${path}.id`,namespace);str(value.name,`${path}.name`);str(value.description,`${path}.description`,2000);one(value.role,`${path}.role`,buildingRoles);cost(value.cost,`${path}.cost`);
  for(const [key,min,max] of [['hp',1,100000],['size',1,6],['buildTime',.05,600],['sight',1,30]] as const)num(value[key],`${path}.${key}`,min,max,key==='size');
  if(value.tags!==undefined)arr(value.tags,`${path}.tags`,2).forEach((tag,i)=>one(tag,`${path}.tags[${i}]`,['beacon','barricade']));if(value.age!==undefined)num(value.age,`${path}.age`,1,3,true);if(value.ability!==undefined)one(value.ability,`${path}.ability`,['heal']);
}
function research(v:unknown,path:string,namespace:string):void {
  const value=obj(v,path,['id','name','description','cost','researchTime','building','appliesTo','effects'],['age','requires','exclusiveGroup','appliesToDefinitions']);
  definitionId(value.id,`${path}.id`,namespace);str(value.name,`${path}.name`);str(value.description,`${path}.description`,2000);cost(value.cost,`${path}.cost`);num(value.researchTime,`${path}.researchTime`,.05,600);one(value.building,`${path}.building`,buildingRoles);one(value.appliesTo,`${path}.appliesTo`,unitRoles);
  if(value.age!==undefined)num(value.age,`${path}.age`,1,3,true);
  if(value.requires!==undefined)arr(value.requires,`${path}.requires`,16).forEach((id,i)=>str(id,`${path}.requires[${i}]`,100));
  if(value.exclusiveGroup!==undefined)definitionId(value.exclusiveGroup,`${path}.exclusiveGroup`,namespace);
  if(value.appliesToDefinitions!==undefined){const targets=arr(value.appliesToDefinitions,`${path}.appliesToDefinitions`,64);if(!targets.length)fail(`${path}.appliesToDefinitions`,'at least one definition target is required');targets.forEach((id,i)=>str(id,`${path}.appliesToDefinitions[${i}]`,100));if(new Set(targets).size!==targets.length)fail(`${path}.appliesToDefinitions`,'duplicate definition target');}
  const effects=obj(value.effects,`${path}.effects`,[],['gather','speed','damage','armor']);
  if(!Object.keys(effects).length)fail(`${path}.effects`,'research must change a permitted stat');
  for(const [key,factor] of Object.entries(effects))num(factor,`${path}.effects.${key}`,key==='armor'?0:.1,key==='armor'?10:3);
}
/** Canonical JSON makes equivalent object key order produce the same content hash. */
export function canonicalContent(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalContent).join(',')}]`;
  return `{${Object.keys(value).filter(key=>(value as Record<string,unknown>)[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonicalContent((value as Record<string,unknown>)[key])}`).join(',')}}`;
}
/** Synchronous SHA-256, shared by browser, server and CLI; no platform APIs required. */
export function contentHash(value:unknown):string {
  const bytes=new TextEncoder().encode(canonicalContent(value)),length=bytes.length;
  const padded=new Uint8Array(Math.ceil((length+9)/64)*64);padded.set(bytes);padded[length]=128;
  const data=new DataView(padded.buffer);data.setUint32(padded.length-8,Math.floor(length*8/0x100000000));data.setUint32(padded.length-4,length*8);
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotate=(v:number,n:number)=>(v>>>n)|(v<<(32-n)),w=new Uint32Array(64);
  for(let offset=0;offset<padded.length;offset+=64){for(let i=0;i<16;i++)w[i]=data.getUint32(offset+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10));}
    let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const first=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]+w[i])|0,second=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))|0;j=g;g=f;f=e;e=(d+first)|0;d=c;c=b;b=a;a=(first+second)|0;}for(const [i,v] of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+v)|0;
  }
  return h.map(value=>(value>>>0).toString(16).padStart(8,'0')).join('');
}
export const BASE_CONTENT_HASH=contentHash({FACTIONS,UPGRADES,ECONOMY,ABILITIES,BUILTIN_EXTRA_DEFINITIONS,BUILTIN_EXTRA_ART});
function unsigned<T extends {hash:string}>(input:T):Omit<T,'hash'>{const {hash:_,...value}=input;return value;}
function freeze<T>(value:T):T {if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
/** Validate syntax and the supplied hash before considering package dependencies. */
export function decodeContentPackage(input:unknown):ContentPackage {
  if(typeof input==='string'){if(new TextEncoder().encode(input).length>MAX_CONTENT_BYTES)fail('package','file exceeds 2 MiB');try{input=JSON.parse(input);}catch{fail('package','expected valid JSON');}}
  const p=obj(input,'package',['format','schemaVersion','engineVersion','id','version','name','dependencies','factions','art','hash']);
  if(p.format!=='orcs-vs-fairies-mod'||p.schemaVersion!==1||p.engineVersion!==CONTENT_ENGINE_VERSION)fail('package','unsupported format, schema or engine version');
  const namespace=str(p.id,'package.id',40);if(['core','economy','builtin'].includes(namespace))fail('package.id','reserved built-in namespace');if(!/^[a-z][a-z0-9-]{0,39}$/.test(namespace))fail('package.id','expected a lowercase package ID');
  if(!/^\d+\.\d+\.\d+$/.test(str(p.version,'package.version',30)))fail('package.version','expected an exact semantic version');str(p.name,'package.name');
  arr(p.dependencies,'package.dependencies',16).forEach((v,i)=>{const d=obj(v,`package.dependencies[${i}]`,['id','version','hash']);str(d.id,`dependency[${i}].id`,40);str(d.version,`dependency[${i}].version`,30);if(!/^[a-f0-9]{64}$/.test(str(d.hash,`dependency[${i}].hash`,64)))fail(`dependency[${i}].hash`,'expected SHA-256');});
  const factions=arr(p.factions,'package.factions',16);if(!factions.length)fail('package.factions','at least one faction is required');
  factions.forEach((v,i)=>{const path=`package.factions[${i}]`,f=obj(v,path,['id','baseFaction','name','subtitle','description','color','accent','units','buildings','research'],['defaultUnits','defaultBuildings']);definitionId(f.id,`${path}.id`,namespace);one(f.baseFaction,`${path}.baseFaction`,builtinIds);for(const key of ['name','subtitle','description'])str(f[key],`${path}.${key}`,key==='description'?2000:200);num(f.color,`${path}.color`,0,0xffffff,true);if(!/^#[a-fA-F0-9]{6}$/.test(str(f.accent,`${path}.accent`,7)))fail(`${path}.accent`,'expected a six-digit color');
    arr(f.units,`${path}.units`,64).forEach((v,j)=>unit(v,`${path}.units[${j}]`,namespace));arr(f.buildings,`${path}.buildings`,32).forEach((v,j)=>building(v,`${path}.buildings[${j}]`,namespace));arr(f.research,`${path}.research`,64).forEach((v,j)=>research(v,`${path}.research[${j}]`,namespace));
    for(const [field,roles] of [['defaultUnits',unitRoles],['defaultBuildings',buildingRoles]] as const)if(f[field]!==undefined){const defaults=obj(f[field],`${path}.${field}`,[],roles);for(const [role,id] of Object.entries(defaults))definitionId(id,`${path}.${field}.${role}`);}
  });
  const art=obj(p.art,'package.art',[],Object.keys(p.art&&typeof p.art==='object'?p.art:{}));if(Object.keys(art).length>128)fail('package.art','too many assets');
  let pixels=0;
  for(const [id,input] of Object.entries(art)){definitionId(id,`package.art.${id}`,namespace);const a=obj(input,`package.art.${id}`,['path','svg','width','height','anchor'],['visualTop']);const path=str(a.path,`package.art.${id}.path`,300);if(!/^\/mods\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(path)||!path.startsWith(`/mods/${namespace}/`))fail(`package.art.${id}.path`,'expected a packaged SVG under its own /mods directory');if(typeof a.svg!=='string'||a.svg.length>100000||!a.svg.trim())fail(`art.${id}.svg`,'expected SVG source under 100000 characters');const svg=a.svg;if(!/^<svg\s/.test(svg)||!/<\/svg>\s*$/.test(svg)||/<(?:script|foreignObject|iframe|image|use|a|style|animate|set)\b|\bon[a-z]+\s*=|\bhref\s*=|\bstyle\s*=|&#|url\s*\(|<!|<\?/i.test(svg.replace(/url\(#[a-zA-Z][a-zA-Z0-9-]*\)/g,'')))fail(`art.${id}.svg`,'only self-contained static SVG is permitted');for(const tag of svg.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b/g))if(!['svg','g','path','rect','circle','ellipse','line','polyline','polygon','title','desc','defs','linearGradient','radialGradient','stop'].includes(tag[1]))fail(`art.${id}.svg`, `unsupported SVG element ${tag[1]}`);num(a.width,`art.${id}.width`,8,512,true);num(a.height,`art.${id}.height`,8,512,true);pixels+=(a.width as number)*(a.height as number);if(pixels>4*1024*1024)fail('package.art','decoded artwork exceeds 16 MiB');const anchor=arr(a.anchor,`art.${id}.anchor`,2);if(anchor.length!==2)fail(`art.${id}.anchor`,'expected two coordinates');num(anchor[0],`art.${id}.anchor[0]`,0,a.width as number);num(anchor[1],`art.${id}.anchor[1]`,0,a.height as number);if(a.visualTop!==undefined)num(a.visualTop,`art.${id}.visualTop`,0,a.height as number);}
  if(!/^[a-f0-9]{64}$/.test(str(p.hash,'package.hash',64))||p.hash!==contentHash(unsigned(p as unknown as ContentPackage)))fail('package.hash','SHA-256 does not match the manifest');
  if(new TextEncoder().encode(canonicalContent(p)).length>MAX_CONTENT_BYTES)fail('package','file exceeds 2 MiB');
  return freeze(JSON.parse(JSON.stringify(p)) as ContentPackage);
}
const PINNED_BASE_FACTIONS=freeze(JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(FACTIONS).map(([id,f])=>[id,{...f,unitDefinitions:[...Object.values(f.units),...BUILTIN_EXTRA_DEFINITIONS[id as BuiltinFactionId].units],buildingDefinitions:[...Object.values(f.buildings),...BUILTIN_EXTRA_DEFINITIONS[id as BuiltinFactionId].buildings]}]))))) as Record<FactionId,FactionDef>;
const PINNED_BASE_RESEARCH=freeze(JSON.parse(JSON.stringify(UPGRADES))) as typeof UPGRADES;
function buildRegistry(packages:ContentPackage[]):Registry {
  const factions:Record<string,FactionDef>={...PINNED_BASE_FACTIONS},art:Record<string,ContentArt>={...BUILTIN_EXTRA_ART},ids=new Set<string>(),byId=new Map(packages.map(p=>[p.id,p]));
  if(byId.size!==packages.length)fail('bundle.packages','two versions of one package cannot share a match');
  const visited=new Set<string>(),visiting=new Set<string>();
  const visit=(p:ContentPackage)=>{if(visiting.has(p.id))fail('dependencies',`cycle includes ${p.id}`);if(visited.has(p.id))return;visiting.add(p.id);const deps=new Set<string>();for(const d of p.dependencies){if(deps.has(d.id))fail('dependencies',`duplicate dependency ${d.id}`);deps.add(d.id);const found=byId.get(d.id);if(!found)fail('dependencies',`missing ${d.id}@${d.version}`);if(found.version!==d.version||found.hash!==d.hash)fail('dependencies',`incompatible ${d.id}@${d.version}`);visit(found);}visiting.delete(p.id);visited.add(p.id);};packages.forEach(visit);
  for(const p of packages)for(const f of p.factions){if(ids.has(f.id)||Object.hasOwn(factions,f.id))fail('definitions',`duplicate ${f.id}`);ids.add(f.id);const base=PINNED_BASE_FACTIONS[f.baseFaction],units={...base.units},buildings={...base.buildings};
    for(const d of [...f.units,...f.buildings,...f.research]){if(ids.has(d.id))fail('definitions',`duplicate ${d.id}`);ids.add(d.id);}
    for(const [role,id] of Object.entries(f.defaultUnits??{})){const d=f.units.find(d=>d.id===id);if(!d||d.role!==role)fail('defaultUnits',`${id} is absent or has another role`);units[role as UnitRole]=d;}
    for(const [role,id] of Object.entries(f.defaultBuildings??{})){const d=f.buildings.find(d=>d.id===id);if(!d||d.role!==role)fail('defaultBuildings',`${id} is absent or has another role`);buildings[role as BuildingRole]=d;}
    const targetUnits=[...Object.values(units),...f.units];for(const research of f.research)for(const id of research.appliesToDefinitions??[]){const target=targetUnits.find(unit=>unit.id===id);if(!target||target.role!==research.appliesTo)fail('research.appliesToDefinitions',`${id} is absent or has another role`);}
    const available=new Map([...Object.values(PINNED_BASE_RESEARCH),...f.research].map(d=>[d.id,d])),done=new Set<string>(),pending=new Set<string>();const check=(id:string)=>{if(pending.has(id))fail('research',`prerequisite cycle includes ${id}`);if(done.has(id))return;const d=available.get(id as UpgradeId);if(!d)fail('research',`missing prerequisite ${id}`);pending.add(id);for(const dep of d.requires??[])check(dep);pending.delete(id);done.add(id);};f.research.forEach(d=>check(d.id));
    for(const d of [...f.units,...f.buildings])if(!Object.hasOwn(p.art,d.id))fail('art',`missing custom artwork for ${d.id}`);
    factions[f.id]=freeze({...base,...f,units,buildings,unitDefinitions:[...Object.values(units),...(base.unitDefinitions??[]).filter(d=>!Object.values(base.units).some(x=>x.id===d.id)),...f.units.filter(d=>!Object.values(units).some(base=>base.id===d.id))],buildingDefinitions:[...Object.values(buildings),...(base.buildingDefinitions??[]).filter(d=>!Object.values(base.buildings).some(x=>x.id===d.id)),...f.buildings.filter(d=>!Object.values(buildings).some(base=>base.id===d.id))],research:f.research});Object.assign(art,p.art);
  }
  if(Object.values(art).reduce((sum,a)=>sum+a.width*a.height,0)>16*1024*1024)fail('bundle.art','decoded artwork exceeds 64 MiB');return freeze({factions,art});
}
export function createContentBundle(inputs:unknown[]):ContentBundle {
  if(inputs.length>32)fail('bundle.packages','at most 32 packages are supported');const packages=inputs.map(decodeContentPackage).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);const registry=buildRegistry(packages);
  const body={format:'orcs-vs-fairies-content' as const,schemaVersion:1 as const,engineVersion:CONTENT_ENGINE_VERSION,baseHash:BASE_CONTENT_HASH,packages};if(new TextEncoder().encode(canonicalContent(body)).length>MAX_BUNDLE_BYTES)fail('bundle','pinned package closure exceeds 4 MiB');const bundle=freeze({...body,hash:contentHash(body)}) as ContentBundle;caches.set(bundle,registry);return bundle;
}
export function decodeContentBundle(input:unknown):ContentBundle {
  const value=obj(input,'bundle',['format','schemaVersion','engineVersion','baseHash','packages','hash']);if(value.format!=='orcs-vs-fairies-content'||value.schemaVersion!==1||value.engineVersion!==CONTENT_ENGINE_VERSION)fail('bundle','unsupported content version');if(value.baseHash!==BASE_CONTENT_HASH)fail('bundle.baseHash','built-in content differs from this build');const bundle=createContentBundle(arr(value.packages,'bundle.packages',32));if(value.hash!==bundle.hash)fail('bundle.hash','SHA-256 does not match admitted packages');return bundle;
}
function registry(state:Pick<GameState,'content'>):Registry {if(!state.content)return {factions:FACTIONS,art:BUILTIN_EXTRA_ART};let value=caches.get(state.content);if(!value){const admitted=decodeContentBundle(state.content);value=caches.get(admitted)!;caches.set(state.content,value);}return value;}
export function contentFactions(content?:ContentBundle):Record<string,FactionDef>{return content?registry({content}).factions:PINNED_BASE_FACTIONS;}
export function contentArt(content?:ContentBundle):Record<string,ContentArt>{return registry({content}).art;}
export function factionFor(state:GameState,side:Side):FactionDef{const faction=registry(state).factions[state.players[side]?.faction];if(!faction)throw new Error('Faction is absent from pinned match content.');return faction;}
export function availableUnits(state:GameState,side:Side):UnitDef[]{const f=factionFor(state,side);return [...(f.unitDefinitions??[...Object.values(f.units),...(BUILTIN_EXTRA_DEFINITIONS[f.id as BuiltinFactionId]?.units??[])])];}
export function availableBuildings(state:GameState,side:Side):BuildingDef[]{const f=factionFor(state,side);return [...(f.buildingDefinitions??[...Object.values(f.buildings),...(BUILTIN_EXTRA_DEFINITIONS[f.id as BuiltinFactionId]?.buildings??[])])];}
export function unitFor(state:GameState,entity:Entity):UnitDef;
export function unitFor(state:GameState,side:Side,role:UnitRole,definitionId?:string):UnitDef;
export function unitFor(state:GameState,subject:Entity|Side,role?:UnitRole,id?:string):UnitDef {const side=typeof subject==='number'?subject:subject.side,kind=typeof subject==='number'?role:subject.role,definition=typeof subject==='number'?id:subject.definitionId;const f=typeof subject!=='number'&&subject.definitionFaction?registry(state).factions[subject.definitionFaction]:factionFor(state,side);if(!f)throw new Error('Original unit faction is absent from pinned content.');const value=definition?(f.unitDefinitions??[...Object.values(f.units),...(BUILTIN_EXTRA_DEFINITIONS[f.id as BuiltinFactionId]?.units??[])]).find(d=>d.id===definition):f.units[kind as UnitRole];if(!value||value.role!==kind)throw new Error(`Unit definition ${definition??kind} is absent from faction ${f.id}.`);return value;}
export function buildingFor(state:GameState,entity:Entity):BuildingDef;
export function buildingFor(state:GameState,side:Side,role:BuildingRole,definitionId?:string):BuildingDef;
export function buildingFor(state:GameState,subject:Entity|Side,role?:BuildingRole,id?:string):BuildingDef {const side=typeof subject==='number'?subject:subject.side,kind=typeof subject==='number'?role:subject.role,definition=typeof subject==='number'?id:subject.definitionId;const f=typeof subject!=='number'&&subject.definitionFaction?registry(state).factions[subject.definitionFaction]:factionFor(state,side);if(!f)throw new Error('Original building faction is absent from pinned content.');const value=definition?(f.buildingDefinitions??[...Object.values(f.buildings),...(BUILTIN_EXTRA_DEFINITIONS[f.id as BuiltinFactionId]?.buildings??[])]).find(d=>d.id===definition):f.buildings[kind as BuildingRole];if(!value||value.role!==kind)throw new Error(`Building definition ${definition??kind} is absent from faction ${f.id}.`);return value;}
export function entityDefinition(state:GameState,entity:Entity):UnitDef|BuildingDef{return entity.kind==='unit'?unitFor(state,entity):buildingFor(state,entity);}
export function upgradesFor(state:GameState,side:Side):Record<UpgradeId,UpgradeDef>{return {...(state.content?PINNED_BASE_RESEARCH:UPGRADES),...Object.fromEntries((factionFor(state,side).research??[]).map(d=>[d.id,d]))};}
export function upgradeFor(state:GameState,side:Side,id:UpgradeId):UpgradeDef{const d=upgradesFor(state,side)[id];if(!d)throw new Error(`Research ${id} is absent from faction content.`);return d;}
export function queuedUnitFor(state:GameState,producer:Entity,index:number):UnitDef{return unitFor(state,producer.side,producer.queue[index],producer.queueDefinitionIds?.[index]);}
export function svgDataUrl(svg:string):string {const bytes=new TextEncoder().encode(svg),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let encoded='';for(let i=0;i<bytes.length;i+=3){const value=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);encoded+=alphabet[(value>>>18)&63]+alphabet[(value>>>12)&63]+(i+1<bytes.length?alphabet[(value>>>6)&63]:'=')+(i+2<bytes.length?alphabet[value&63]:'=');}return `data:image/svg+xml;base64,${encoded}`;}
export function contentAssetUrl(state:GameState,id:string):string{const def=Object.values(contentFactions(state.content)).flatMap(f=>[...(f.unitDefinitions??Object.values(f.units)),...(f.buildingDefinitions??Object.values(f.buildings))]).find(d=>d.id===id),artId=def?.artId??id,art=contentArt(state.content)[artId];return art?svgDataUrl(art.svg):`/assets/thumb-${artId}.png`;}
export class ContentLibrary {
  private installed:ContentPackage[]=[];
  list():ContentPackage[]{return [...this.installed];}
  install(input:unknown):ContentPackage{const packageValue=decodeContentPackage(input),next=this.installed.filter(p=>p.id!==packageValue.id);next.push(packageValue);createContentBundle(next);this.installed=next;return packageValue;}
  restore(inputs:unknown[]):void{const next=inputs.map(decodeContentPackage);createContentBundle(next);this.installed=next;}
  bundle():ContentBundle{return createContentBundle(this.installed);}
}

/** Include same-role definitions and charged costs in stale UI queue checks. */
export function productionQueueKey(producer:Entity):string{return JSON.stringify(producer.queueDefinitionIds?[producer.queue,producer.queueDefinitionIds,producer.queuePaidCosts]:producer.queue);}
