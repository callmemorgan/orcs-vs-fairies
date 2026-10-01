import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Account } from '../online/protocol';

export type CommunityPackageKind='map'|'scenario'|'mod';
export const COMMUNITY_PACKAGE_MAX_BYTES=16*1024*1024;
export interface CommunityPackageValidators {
 /** Map admission must include playable-map validation after structural decoding. */
 map(input:unknown):unknown;
 scenario(input:unknown):unknown;
 mod(input:unknown):unknown;
 /** The real content-bundle validator checks the exact resolved dependency closure. */
 modClosure?(packages:unknown[]):unknown;
}
export interface CommunityDependency {kind:CommunityPackageKind;localId:string;version:string;hash:string;packageHash:string}
export type CommunityPreview=
 | {type:'map';width:number;height:number;levels:{id:number;columns:number;rows:number;terrain:string[]}[];starts:{x:number;y:number;level:number;slot:number}[];resources:{kind:string;count:number}[];sites:number}
 | {type:'scenario';map:Extract<CommunityPreview,{type:'map'}>;actors:number;objectives:number;events:number}
 | {type:'mod';factions:{id:string;name:string;color:number;units:number;buildings:number}[]};
export interface CommunityRevision {
 version:string;hash:string;packageHash:string;contentHash:string|null;simulationVersion:number;
 dependencies:CommunityDependency[];preview:CommunityPreview;title:string;publishedAt:number;
}
export interface CommunityPackageSummary {
 id:string;kind:CommunityPackageKind;localId:string;title:string;publisher:Account;
 version:string;hash:string;packageHash:string;createdAt:number;publishedAt:number;preview:CommunityPreview;
}
export interface CommunityPackageDetail extends CommunityPackageSummary {revisions:CommunityRevision[]}
export interface CommunitySearch {query?:string;kind?:CommunityPackageKind;page?:number;pageSize?:number}
export class CommunityPackageError extends Error {constructor(readonly status:number,message:string){super(message);this.name='CommunityPackageError';}}
type RecordValue=Record<string,unknown>;
interface Admission {
 kind:CommunityPackageKind;localId:string;title:string;version:string;versionSort:string;
 packageHash:string;contentHash:string|null;simulationVersion:number;body:string;hash:string;
 value:RecordValue;preview:CommunityPreview;dependencies:CommunityDependency[];embedded:{hash:string;kind:CommunityPackageKind;body:string}[];
}
const KINDS:CommunityPackageKind[]=['map','scenario','mod'];
const HASH=/^[a-f0-9]{64}$/;
const SHA=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
function error(status:number,message:string):never {throw new CommunityPackageError(status,message);}
function record(value:unknown,label:string):RecordValue {if(!value||typeof value!=='object'||Array.isArray(value))error(400,`${label} must be an object.`);return value as RecordValue;}
function text(value:unknown,label:string,max=200):string {if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))error(400,`Invalid ${label}.`);return value;}
function integer(value:unknown,label:string,min=0,max=0x7fffffff):number {if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)error(400,`Invalid ${label}.`);return value;}
function array(value:unknown,label:string,max:number):unknown[] {if(!Array.isArray(value)||value.length>max)error(400,`Invalid ${label}.`);return value;}
function kindOf(value:RecordValue):CommunityPackageKind {if(value.kind==='map'||value.kind==='scenario')return value.kind;if(value.format==='orcs-vs-fairies-mod')return 'mod';return error(400,'Expected a map, scenario or mod package.');}
function canonical(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(value&&typeof value==='object'){const r=value as RecordValue;return `{${Object.keys(r).sort().map(key=>`${JSON.stringify(key)}:${canonical(r[key])}`).join(',')}}`;}
 return JSON.stringify(value);
}
/** Bounded descriptor copying prevents unsafe input from reaching a decoder callback. */
function json(input:unknown):unknown {
 if(typeof input==='string'){
  if(Buffer.byteLength(input)>COMMUNITY_PACKAGE_MAX_BYTES)error(413,'Package exceeds the 16 MiB limit.');
  try{input=JSON.parse(input);}catch{error(400,'Invalid package JSON.');}
 }
 let nodes=0,bytes=0;const parents=new Set<object>();
 function copy(value:unknown,depth:number):unknown {
  if(++nodes>750000||depth>64)error(413,'Package is too large or deeply nested.');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))error(400,'Package numbers must be finite.');return Object.is(value,-0)?0:value;}
  if(typeof value==='string'){bytes+=Buffer.byteLength(value);if(bytes>COMMUNITY_PACKAGE_MAX_BYTES)error(413,'Package exceeds the 16 MiB limit.');return value;}
  if(!value||typeof value!=='object')error(400,'Package must contain JSON data.');
  if(parents.has(value))error(400,'Package cycles are forbidden.');parents.add(value);
  let result:unknown;
  if(Array.isArray(value)){
   if(value.length>65536||Reflect.ownKeys(value).length!==value.length+1)error(400,'Package arrays cannot have gaps or extra properties.');
   const out:unknown[]=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!('value' in d)||!d.enumerable)error(400,'Package array accessors and gaps are forbidden.');out.push(copy(d.value,depth+1));}result=out;
  }else{
   if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))error(400,'Package objects must be plain JSON objects.');
   const names=Reflect.ownKeys(value);if(names.length>256||names.some(key=>typeof key!=='string'))error(400,'Package has invalid object properties.');
   const out:RecordValue=Object.create(null);for(const key of names as string[]){const d=Object.getOwnPropertyDescriptor(value,key)!;if(!('value' in d)||!d.enumerable||['__proto__','constructor','prototype'].includes(key))error(400,'Package accessors and unsafe properties are forbidden.');out[key]=copy(d.value,depth+1);}result=out;
  }
  parents.delete(value);return result;
 }
 const result=copy(input,0);if(Buffer.byteLength(canonical(result))>COMMUNITY_PACKAGE_MAX_BYTES)error(413,'Package exceeds the 16 MiB limit.');return result;
}
function packageIdentity(owner:string,kind:CommunityPackageKind,id:string):string {return SHA(canonical([owner,kind,id]));}
function mapPreview(input:unknown):Extract<CommunityPreview,{type:'map'}> {
 const map=record(input,'Map preview'),width=integer(map.width,'map width',8,128),height=integer(map.height,'map height',8,128),columns=Math.min(width,32),rows=Math.min(height,32);
 const terrainKinds=['grass','road','mud','shallows','water','rock','bridge','sand','snow','forest','ice'];
 const levels=array(map.levels,'map levels',2).map(value=>{
  const level=record(value,'Map level'),terrain=array(level.terrain,'map terrain',width*height),tiles:string[]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const kind=terrain[Math.floor((y+.5)*height/rows)*width+Math.floor((x+.5)*width/columns)];if(typeof kind!=='string'||!terrainKinds.includes(kind))error(400,'Invalid terrain preview.');tiles.push(kind);}
  return {id:integer(level.id,'level ID',0,1),columns,rows,terrain:tiles};
 });
 const starts=array(map.starts,'map starts',8).map(value=>{const p=record(value,'Start');if(typeof p.x!=='number'||!Number.isFinite(p.x)||typeof p.y!=='number'||!Number.isFinite(p.y))error(400,'Invalid start geometry.');return {x:p.x,y:p.y,level:integer(p.level,'start level',0,1),slot:integer(p.slot,'start slot',0,7)};});
 const nodes=array(map.resources,'map resources',2048);
 return {type:'map',width,height,levels,starts,resources:['wood','ore','crystal'].map(kind=>({kind,count:nodes.filter(node=>record(node,'Resource').kind===kind).length})),sites:array(map.sites,'map sites',128).length};
}
function preview(kind:CommunityPackageKind,value:RecordValue):CommunityPreview {
 if(kind==='map')return mapPreview(value.map);
 if(kind==='scenario'){const scenario=record(value.scenario,'Scenario');return {type:'scenario',map:mapPreview(record(value.map,'Map package').map),actors:array(scenario.army,'scenario actors',512).length,objectives:array(scenario.objectives,'scenario objectives',64).length,events:array(scenario.events,'scenario events',256).length};}
 return {type:'mod',factions:array(value.factions,'mod factions',16).map(input=>{const f=record(input,'Faction');return {id:text(f.id,'faction ID',100),name:text(f.name,'faction name'),color:integer(f.color,'faction color',0,0xffffff),units:array(f.units,'faction units',128).length,buildings:array(f.buildings,'faction buildings',128).length};})};
}

/** Publications share the server account database; package bodies and revisions never change. */
export class CommunityPackages {
 constructor(readonly db:DatabaseSync,readonly validators:CommunityPackageValidators){
  db.exec(`PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS community_packages(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('map','scenario','mod')),local_id TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(owner_id,kind,local_id));
   CREATE TABLE IF NOT EXISTS community_blobs(hash TEXT PRIMARY KEY CHECK(length(hash)=64),kind TEXT NOT NULL CHECK(kind IN ('map','scenario','mod')),body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS community_revisions(package_id TEXT NOT NULL REFERENCES community_packages(id),version TEXT NOT NULL,version_sort TEXT NOT NULL,hash TEXT NOT NULL REFERENCES community_blobs(hash),package_hash TEXT NOT NULL,content_hash TEXT,simulation_version INTEGER NOT NULL,title TEXT NOT NULL,published_at INTEGER NOT NULL,dependencies TEXT NOT NULL,preview TEXT NOT NULL,PRIMARY KEY(package_id,version));
   CREATE INDEX IF NOT EXISTS community_local_ids ON community_packages(kind,local_id);
   CREATE INDEX IF NOT EXISTS community_inner_hashes ON community_revisions(package_hash,version);
   CREATE INDEX IF NOT EXISTS community_versions ON community_revisions(package_id,version_sort DESC);
   CREATE TRIGGER IF NOT EXISTS community_packages_no_update BEFORE UPDATE ON community_packages BEGIN SELECT RAISE(ABORT,'Published package identities are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_revisions_no_update BEFORE UPDATE ON community_revisions BEGIN SELECT RAISE(ABORT,'Published revisions are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_revisions_no_delete BEFORE DELETE ON community_revisions BEGIN SELECT RAISE(ABORT,'Published revisions are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_blobs_no_update BEFORE UPDATE ON community_blobs BEGIN SELECT RAISE(ABORT,'Published blobs are immutable');END;
   CREATE TRIGGER IF NOT EXISTS community_blobs_no_delete BEFORE DELETE ON community_blobs BEGIN SELECT RAISE(ABORT,'Published blobs are immutable');END;`);
 }
 private decode(kind:CommunityPackageKind,input:unknown):RecordValue {
  try{const value=record(json(this.validators[kind](json(input))),'Validated package');if(kindOf(value)!==kind)error(400,'Decoder returned a different package kind.');return value;}
  catch(cause){if(cause instanceof CommunityPackageError)throw cause;error(400,cause instanceof Error?cause.message:'Package validation failed.');}
 }
 private blob(hash:string):{kind:CommunityPackageKind;body:string} {
  const row=this.db.prepare('SELECT kind,body FROM community_blobs WHERE hash=?').get(hash);if(!row)error(404,'Package download was not found.');
  const body=row.body as string;if(SHA(body)!==hash)error(500,'Stored package integrity check failed.');return {kind:row.kind as CommunityPackageKind,body};
 }
 private resolveMod(value:RecordValue):{dependencies:CommunityDependency[];closure:RecordValue[]} {
  const closure:RecordValue[]=[],dependencies:CommunityDependency[]=[],seen=new Set<string>(),visiting=new Set<string>();
  const visit=(pkg:RecordValue,top=false)=>{
   const id=text(pkg.id,'mod ID',64),version=text(pkg.version,'mod version',30),inner=text(pkg.hash,'mod checksum',64),identity=`${id}@${version}:${inner}`;
   if(visiting.has(identity))error(400,'Mod dependencies contain a cycle.');if(seen.has(identity))return;
   if(closure.length+visiting.size>=32)error(400,'Mod dependency closure exceeds 32 packages.');visiting.add(identity);
   for(const raw of array(pkg.dependencies,'mod dependencies',16)){
    const d=record(raw,'Mod dependency'),localId=text(d.id,'dependency ID',64),dependencyVersion=text(d.version,'dependency version',30),packageHash=text(d.hash,'dependency checksum',64);if(!HASH.test(packageHash))error(400,'Invalid mod dependency checksum.');
    const row=this.db.prepare("SELECT r.hash FROM community_revisions r JOIN community_packages p ON p.id=r.package_id WHERE p.kind='mod' AND p.local_id=? AND r.version=? AND r.package_hash=? ORDER BY r.hash LIMIT 1").get(localId,dependencyVersion,packageHash);
    if(!row)error(409,`Publish the exact dependency ${localId}@${dependencyVersion} (${packageHash}) first.`);
    const hash=row.hash as string,stored=this.blob(hash);if(stored.kind!=='mod')error(500,'Stored dependency has an invalid kind.');
    const decoded=this.decode('mod',JSON.parse(stored.body));if(decoded.id!==localId||decoded.version!==dependencyVersion||decoded.hash!==packageHash)error(500,'Stored dependency identity differs from its publication.');
    if(top)dependencies.push({kind:'mod',localId,version:dependencyVersion,hash,packageHash});visit(decoded);
   }
   visiting.delete(identity);seen.add(identity);closure.push(pkg);
  };
  visit(value,true);
  if(!this.validators.modClosure)error(503,'Mod bundle validation is unavailable.');
  try{this.validators.modClosure(closure);}catch(cause){error(400,cause instanceof Error?cause.message:'Mod dependency validation failed.');}
  return {dependencies,closure};
 }
 private admit(input:unknown):Admission {
  const raw=record(json(input),'Package'),kind=kindOf(raw),value=this.decode(kind,raw),source=kind==='scenario'?record(value.scenario,'Scenario'):value;
  const localId=text(source.id,'package ID',64);if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(localId))error(400,'Invalid local package ID.');
  const title=text(kind==='mod'?source.name:source.title,'package title'),packageHash=text(value.hash,'package checksum',64);
  if(!(kind==='mod'?HASH:/^[a-f0-9]{16}$/).test(packageHash))error(400,'Invalid package checksum.');
  let version:string,versionSort:string;
  if(kind==='mod'){
   version=text(value.version,'mod version',30);if(!/^\d+\.\d+\.\d+$/.test(version))error(400,'Mod version must be an exact semantic version.');
   versionSort=version.split('.').map(part=>integer(Number(part),'semantic version component').toString().padStart(10,'0')).join('.');
  }else{version=String(integer(value.revision,'package revision',1));versionSort=version.padStart(10,'0');}
  const body=canonical(value),hash=SHA(body),dependencies:CommunityDependency[]=[],embedded:Admission['embedded']=[];
  if(kind==='scenario'){
   const map=this.decode('map',value.map),mapBody=canonical(map),mapHash=SHA(mapBody);if(value.mapHash!==map.hash)error(400,'Scenario map dependency checksum differs.');
   dependencies.push({kind:'map',localId:text(map.id,'map ID',64),version:String(integer(map.revision,'map revision',1)),hash:mapHash,packageHash:text(map.hash,'map checksum',16)});embedded.push({hash:mapHash,kind:'map',body:mapBody});
  }
  if(kind==='mod')dependencies.push(...this.resolveMod(value).dependencies);
  return {kind,localId,title,version,versionSort,packageHash,contentHash:typeof value.contentHash==='string'?value.contentHash:kind==='mod'?packageHash:null,simulationVersion:integer(kind==='mod'?value.engineVersion:value.simulationVersion,'simulation version',1),body,hash,value,preview:preview(kind,value),dependencies,embedded};
 }
 publish(account:Account,input:unknown):{created:boolean;detail:CommunityPackageDetail} {
  if(!account||typeof account.id!=='string'||typeof account.username!=='string')error(401,'Sign in before publishing a package.');
  const user=this.db.prepare('SELECT id,username FROM users WHERE id=?').get(account.id);if(!user||user.username!==account.username)error(401,'Sign in before publishing a package.');
  const value=this.admit(input),id=packageIdentity(account.id,value.kind,value.localId),now=Date.now();let created=true;
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const prior=this.db.prepare('SELECT hash FROM community_revisions WHERE package_id=? AND version=?').get(id,value.version);
   if(prior){if(prior.hash!==value.hash)error(409,'This published version is immutable. Increase the revision or version.');created=false;}
   else{
    this.db.prepare('INSERT INTO community_packages(id,owner_id,kind,local_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id,account.id,value.kind,value.localId,now);
    const put=this.db.prepare('INSERT INTO community_blobs(hash,kind,body) VALUES(?,?,?) ON CONFLICT(hash) DO NOTHING');
    for(const blob of [...value.embedded,{hash:value.hash,kind:value.kind,body:value.body}]){
     put.run(blob.hash,blob.kind,blob.body);const stored=this.blob(blob.hash);if(stored.kind!==blob.kind||stored.body!==blob.body)error(500,'Stored package identity is inconsistent.');
    }
    this.db.prepare('INSERT INTO community_revisions(package_id,version,version_sort,hash,package_hash,content_hash,simulation_version,title,published_at,dependencies,preview) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,value.version,value.versionSort,value.hash,value.packageHash,value.contentHash,value.simulationVersion,value.title,now,JSON.stringify(value.dependencies),JSON.stringify(value.preview));
   }
   this.db.exec('COMMIT');
  }catch(cause){this.db.exec('ROLLBACK');throw cause;}
  return {created,detail:this.detail(id)};
 }
 private summary(row:RecordValue):CommunityPackageSummary {
  return {id:row.id as string,kind:row.kind as CommunityPackageKind,localId:row.local_id as string,title:row.title as string,publisher:{id:row.owner_id as string,username:row.username as string},version:row.version as string,hash:row.hash as string,packageHash:row.package_hash as string,createdAt:row.created_at as number,publishedAt:row.published_at as number,preview:JSON.parse(row.preview as string)};
 }
 search(options:CommunitySearch={}):{items:CommunityPackageSummary[];total:number;page:number;pageSize:number} {
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['query','kind','page','pageSize'].includes(key)))error(400,'Invalid community search options.');
  const page=integer(options.page??1,'page',1,10000),pageSize=integer(options.pageSize??20,'page size',1,50);
  const query=options.query===undefined||options.query===''?'':text(options.query,'search query',120).trim();if(options.kind!==undefined&&!KINDS.includes(options.kind))error(400,'Unknown package kind.');
  const escaped=query.replace(/[\\%_]/g,char=>`\\${char}`),pattern=`%${escaped}%`,condition="(?='' OR p.kind=?) AND (?='' OR r.title LIKE ? ESCAPE '\\' OR p.local_id LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\')";
  const base="FROM community_packages p JOIN users u ON u.id=p.owner_id JOIN community_revisions r ON r.package_id=p.id AND r.version=(SELECT latest.version FROM community_revisions latest WHERE latest.package_id=p.id ORDER BY latest.version_sort DESC LIMIT 1)",params=[options.kind??'',options.kind??'',query,pattern,pattern,pattern];
  const total=this.db.prepare(`SELECT count(*) AS total ${base} WHERE ${condition}`).get(...params)!.total as number;
  const rows=this.db.prepare(`SELECT p.*,u.username,r.* ${base} WHERE ${condition} ORDER BY r.published_at DESC,p.id LIMIT ? OFFSET ?`).all(...params,pageSize,(page-1)*pageSize);
  return {items:rows.map(row=>this.summary(row)),total,page,pageSize};
 }
 detail(id:string):CommunityPackageDetail {
  if(typeof id!=='string'||!HASH.test(id))error(400,'Invalid community package ID.');
  const row=this.db.prepare('SELECT p.*,u.username,r.* FROM community_packages p JOIN users u ON u.id=p.owner_id JOIN community_revisions r ON r.package_id=p.id WHERE p.id=? ORDER BY r.version_sort DESC LIMIT 1').get(id);if(!row)error(404,'Community package was not found.');
  const revisions=this.db.prepare('SELECT * FROM community_revisions WHERE package_id=? ORDER BY version_sort DESC').all(id).map(r=>({version:r.version as string,hash:r.hash as string,packageHash:r.package_hash as string,contentHash:r.content_hash as string|null,simulationVersion:r.simulation_version as number,dependencies:JSON.parse(r.dependencies as string),preview:JSON.parse(r.preview as string),title:r.title as string,publishedAt:r.published_at as number}));
  return {...this.summary(row),revisions};
 }
 download(hash:string):unknown {
  if(typeof hash!=='string'||!HASH.test(hash))error(400,'Invalid package download checksum.');
  const stored=this.blob(hash),input=JSON.parse(stored.body),value=this.decode(stored.kind,input);
  if(canonical(value)!==stored.body)error(409,'Stored package requires its original compatible decoder.');
  if(stored.kind==='mod')this.resolveMod(value);return JSON.parse(stored.body);
 }
}
