import { OnlineApi, OnlineRequestError } from './client';
import type { CommunityDependency, CommunityPackageDetail, CommunityPackageKind, CommunityPackageSummary, CommunityPackageValidators, CommunityRevision, CommunitySearch } from '../server/community-packages';

export const COMMUNITY_CLIENT_MAX_BYTES=16*1024*1024;
const MAX_INSTALL_BYTES=32*1024*1024,HASH=/^[a-f0-9]{64}$/;
type RecordValue=Record<string,unknown>;
export interface CommunityApiOptions {baseUrl?:string;auth?:OnlineApi;fetch?:typeof fetch;timeoutMs?:number}
export interface CommunityInstalledRecord {
 hash:string;kind:CommunityPackageKind;localId:string;title:string;version:string;packageHash:string;
 package:unknown;dependencies:string[];installedAt:number;
}
export interface CommunityLibraryOptions {validators:CommunityPackageValidators;storage?:Storage|null;key?:string}
function bad(message:string):never {throw new Error(message);}
function object(value:unknown):RecordValue {if(!value||typeof value!=='object'||Array.isArray(value))bad('Expected package JSON object.');return value as RecordValue;}
function string(value:unknown,max=200):string {if(typeof value!=='string'||value.length>max||!value.trim())bad('Invalid community metadata.');return value;}
function hash(value:unknown):string {if(typeof value!=='string'||!HASH.test(value))bad('Invalid community checksum.');return value;}
function integer(value:unknown,min=0,max=0x7fffffff):number {if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)bad('Invalid community number.');return value;}
function list(value:unknown,max:number):unknown[] {if(!Array.isArray(value)||value.length>max)bad('Invalid community array.');return value;}
function kindOf(value:RecordValue):CommunityPackageKind {if(value.kind==='map'||value.kind==='scenario')return value.kind;if(value.format==='orcs-vs-fairies-mod')return 'mod';return bad('Expected a map, scenario or mod package.');}
function kind(value:unknown):CommunityPackageKind {if(value==='map'||value==='scenario'||value==='mod')return value;return bad('Unknown community package kind.');}

function canonical(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(value&&typeof value==='object'){const record=value as RecordValue;return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;}
 return JSON.stringify(value);
}
/** Reject executable input before computing the same complete-body checksum as the server. */
function json(input:unknown):unknown {
 if(typeof input==='string'){if(new TextEncoder().encode(input).length>COMMUNITY_CLIENT_MAX_BYTES)bad('Package exceeds the 16 MiB limit.');try{input=JSON.parse(input);}catch{bad('Invalid package JSON.');}}
 let nodes=0,bytes=0;const parents=new Set<object>();
 function copy(value:unknown,depth:number):unknown {
  if(++nodes>750000||depth>64)bad('Package is too large or deeply nested.');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))bad('Package numbers must be finite.');return Object.is(value,-0)?0:value;}
  if(typeof value==='string'){bytes+=new TextEncoder().encode(value).length;if(bytes>COMMUNITY_CLIENT_MAX_BYTES)bad('Package exceeds the 16 MiB limit.');return value;}
  if(!value||typeof value!=='object')bad('Package must contain JSON data.');
  if(parents.has(value))bad('Package cycles are forbidden.');parents.add(value);let result:unknown;
  if(Array.isArray(value)){
   if(value.length>65536||Reflect.ownKeys(value).length!==value.length+1)bad('Package arrays cannot have gaps or extra properties.');
   const array:unknown[]=[];for(let i=0;i<value.length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor||!('value' in descriptor)||!descriptor.enumerable)bad('Package array accessors and gaps are forbidden.');array.push(copy(descriptor.value,depth+1));}result=array;
  }else{
   if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))bad('Package must contain plain JSON objects.');const keys=Reflect.ownKeys(value);if(keys.length>256||keys.some(key=>typeof key!=='string'))bad('Invalid package properties.');
   const record:RecordValue=Object.create(null);for(const key of keys as string[]){const descriptor=Object.getOwnPropertyDescriptor(value,key)!;if(!('value' in descriptor)||!descriptor.enumerable||['__proto__','constructor','prototype'].includes(key))bad('Package accessors and unsafe properties are forbidden.');record[key]=copy(descriptor.value,depth+1);}result=record;
  }
  parents.delete(value);return result;
 }
 const copied=copy(input,0),text=canonical(copied);if(new TextEncoder().encode(text).length>COMMUNITY_CLIENT_MAX_BYTES)bad('Package exceeds the 16 MiB limit.');return JSON.parse(text);
}
export async function communityPackageHash(input:unknown):Promise<string> {
 if(!globalThis.crypto?.subtle)bad('Package verification requires a secure browser connection.');
 const bytes=new TextEncoder().encode(canonical(json(input))),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function dependency(input:unknown):CommunityDependency {
 const value=object(input);return {kind:kind(value.kind),localId:string(value.localId,64),version:string(value.version,30),hash:hash(value.hash),packageHash:string(value.packageHash,64)};
}
function summary(input:unknown):CommunityPackageSummary {
 const value=object(input),publisher=object(value.publisher);hash(value.id);kind(value.kind);string(value.localId,64);string(value.title);string(publisher.id,100);string(publisher.username,32);string(value.version,30);hash(value.hash);string(value.packageHash,64);integer(value.createdAt,0,Number.MAX_SAFE_INTEGER);integer(value.publishedAt,0,Number.MAX_SAFE_INTEGER);object(value.preview);
 return value as unknown as CommunityPackageSummary;
}
function detail(input:unknown):CommunityPackageDetail {
 const value=summary(input) as CommunityPackageDetail;
 for(const input of list(value.revisions,512)){const revision=object(input);string(revision.version,30);hash(revision.hash);string(revision.packageHash,64);integer(revision.simulationVersion,1);string(revision.title);integer(revision.publishedAt,0,Number.MAX_SAFE_INTEGER);object(revision.preview);list(revision.dependencies,32).forEach(dependency);}
 if(!value.revisions.some(revision=>revision.version===value.version&&revision.hash===value.hash))bad('Community detail does not contain its latest revision.');
 return value;
}

export class CommunityApi {
 readonly auth:OnlineApi;readonly baseUrl:string;private fetcher:typeof fetch;private timeout:number;
 constructor(options:CommunityApiOptions={}){
  const base=options.baseUrl??options.auth?.baseUrl??globalThis.location?.origin??'http://localhost',url=new URL(base);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)bad('Community server must be an HTTP(S) origin.');
  this.baseUrl=url.origin;if(options.auth&&options.auth.baseUrl!==this.baseUrl)bad('Community and sign-in must use the same server.');
  this.fetcher=options.fetch??globalThis.fetch.bind(globalThis);this.auth=options.auth??new OnlineApi({baseUrl:this.baseUrl,fetch:this.fetcher,timeoutMs:options.timeoutMs});this.timeout=options.timeoutMs??15000;
 }
 private async request(path:string,body?:unknown):Promise<unknown> {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeout);
  try{
   const response=await this.fetcher(`${this.baseUrl}${path}`,{method:body===undefined?'GET':'POST',credentials:'include',cache:'no-store',signal:controller.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
   const declared=response.headers.get('Content-Length');if(declared&&Number(declared)>COMMUNITY_CLIENT_MAX_BYTES)bad('Community response exceeds the 16 MiB limit.');
   let text='';
   if(response.body){const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0;try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>COMMUNITY_CLIENT_MAX_BYTES){await reader.cancel();bad('Community response exceeds the 16 MiB limit.');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}}
   else{text=await response.text();if(new TextEncoder().encode(text).length>COMMUNITY_CLIENT_MAX_BYTES)bad('Community response exceeds the 16 MiB limit.');}
   let value:unknown;try{value=JSON.parse(text);}catch{throw new OnlineRequestError(response.status,'The community server returned unreadable JSON.');}
   if(!response.ok)throw new OnlineRequestError(response.status,value&&typeof value==='object'&&typeof (value as RecordValue).error==='string'?(value as RecordValue).error as string:`Community request failed (${response.status}).`);
   return value;
  }catch(error){if(controller.signal.aborted)throw new OnlineRequestError(0,'The community server did not respond in time.');if(error instanceof TypeError)throw new OnlineRequestError(0,'Could not reach the community server.');throw error;}
  finally{clearTimeout(timer);}
 }
 async search(options:CommunitySearch={}):Promise<{items:CommunityPackageSummary[];total:number;page:number;pageSize:number}>{
  const params=new URLSearchParams();if(options.query!==undefined)params.set('q',options.query);if(options.kind!==undefined)params.set('kind',kind(options.kind));params.set('page',String(integer(options.page??1,1,10000)));params.set('pageSize',String(integer(options.pageSize??20,1,50)));
  const value=object(await this.request(`/api/packages?${params}`));list(value.items,50).forEach(summary);integer(value.total);integer(value.page,1,10000);integer(value.pageSize,1,50);return value as unknown as {items:CommunityPackageSummary[];total:number;page:number;pageSize:number};
 }
 async detail(id:string):Promise<CommunityPackageDetail>{return detail(object(await this.request(`/api/packages/${hash(id)}`)).detail);}
 /** Integrity comes before any map, scenario or mod decoder callback. */
 async download(address:string):Promise<unknown>{const expected=hash(address),value=json(object(await this.request(`/api/packages/content/${expected}`)).package);if(await communityPackageHash(value)!==expected)bad('Community download checksum does not match. Nothing was installed.');return value;}
 async publish(input:unknown):Promise<{created:boolean;detail:CommunityPackageDetail}>{
  const pkg=json(input),expected=await communityPackageHash(pkg),response=object(await this.request('/api/packages',{package:pkg}));if(typeof response.created!=='boolean')bad('Invalid community publication receipt.');const value=detail(response.detail);if(!value.revisions.some(revision=>revision.hash===expected))bad('Community publication receipt differs from the submitted package.');return {created:response.created,detail:value};
 }
}
function frozen<T>(value:T):T {if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
function metadata(value:RecordValue):{kind:CommunityPackageKind;localId:string;title:string;version:string;packageHash:string} {
 const kind=kindOf(value),source=kind==='scenario'?object(value.scenario):value;
 return {kind,localId:string(source.id,64),title:string(kind==='mod'?source.name:source.title),version:kind==='mod'?string(value.version,30):String(integer(value.revision,1)),packageHash:string(value.hash,64)};
}

/** One immutable storage key per installation keeps concurrent revisions from overwriting each other. */
export class CommunityLibrary {
 private installed=new Map<string,CommunityInstalledRecord>();private storage:Storage|null;private key:string;private loading:Promise<void>|undefined;
 constructor(readonly options:CommunityLibraryOptions){this.storage=options.storage===undefined?(globalThis.localStorage??null):options.storage;this.key=options.key??'ovf.community.library.v1';}
 list():CommunityInstalledRecord[]{return [...this.installed.values()];}
 get(address:string):CommunityInstalledRecord|undefined{return this.installed.get(address);}
 closure(address:string):CommunityInstalledRecord[]{
  const root=this.get(address);if(!root)bad('Install the selected revision before playing it.');const records:CommunityInstalledRecord[]=[],seen=new Set<string>();
  const visit=(record:CommunityInstalledRecord)=>{if(seen.has(record.hash))return;seen.add(record.hash);for(const hash of record.dependencies){const child=this.get(hash);if(!child)bad('Pinned installed dependency is missing.');visit(child);}records.push(record);};visit(root);return records;
 }
 packagesFor(address:string):unknown[]{return this.closure(address).map(record=>record.package);}
 private async validate(address:string,input:unknown):Promise<RecordValue>{
  const value=json(input);if(await communityPackageHash(value)!==hash(address))bad('Installed package checksum does not match.');const packageKind=kindOf(object(value)),decoded=object(json(this.options.validators[packageKind](value)));if(kindOf(decoded)!==packageKind||await communityPackageHash(decoded)!==address)bad('The decoder changed pinned package content.');return decoded;
 }
 private validateModClosure(records:CommunityInstalledRecord[]):void {
  const mods=records.filter(record=>record.kind==='mod');if(!mods.length)return;if(!this.options.validators.modClosure)bad('Mod bundle validation is unavailable.');this.options.validators.modClosure(mods.map(record=>record.package));
 }
 ready():Promise<void>{
  if(this.loading)return this.loading;
  this.loading=(async()=>{
   if(!this.storage)return;const next=new Map(this.installed),keys:string[]=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key?.startsWith(`${this.key}.batch.`))keys.push(key);}if(keys.length>512)bad('Community library has too many installation batches.');
   for(const key of keys.sort()){
    const text=this.storage.getItem(key)!;if(new TextEncoder().encode(text).length>MAX_INSTALL_BYTES)bad('Saved installation is too large.');const batch=object(JSON.parse(text));if(batch.schemaVersion!==1)bad('Unknown community library version.');const records:CommunityInstalledRecord[]=[];
    for(const raw of list(batch.records,32)){const stored=object(raw),address=hash(stored.hash),value=await this.validate(address,stored.package),info=metadata(value),dependencies=list(stored.dependencies,32).map(hash),installedAt=integer(stored.installedAt,0,Number.MAX_SAFE_INTEGER);if(stored.kind!==info.kind||stored.localId!==info.localId||stored.title!==info.title||stored.version!==info.version||stored.packageHash!==info.packageHash)bad('Saved installation metadata differs from its pinned package.');records.push(frozen({hash:address,...info,package:value,dependencies,installedAt}));}
    this.verifyDependencies(records);this.validateModClosure(records);for(const record of records)next.set(record.hash,record);
   }
   this.installed=next;
  })();return this.loading;
 }
 private verifyDependencies(records:CommunityInstalledRecord[]):void {
  const byHash=new Map(records.map(record=>[record.hash,record]));
  for(const record of records){
   const pkg=object(record.package),expected=record.kind==='mod'?list(pkg.dependencies,16):record.kind==='scenario'?[metadata(object(pkg.map))]:[];
   if(record.dependencies.length!==expected.length)bad('Installed dependency graph differs from its package.');
   for(let i=0;i<expected.length;i++){
    const target=byHash.get(record.dependencies[i]);if(!target)bad('Installed dependency is missing.');
    if(record.kind==='mod'){const dep=object(expected[i]);if(target.kind!=='mod'||target.localId!==dep.id||target.version!==dep.version||target.packageHash!==dep.hash)bad('Installed mod dependency differs from its package.');}
    else if(record.kind==='scenario'){const map=object(pkg.map),info=metadata(map);if(target.kind!=='map'||target.localId!==info.localId||target.version!==info.version||target.packageHash!==info.packageHash||canonical(target.package)!==canonical(map))bad('Installed scenario map differs from its package.');}
   }
  }
  const visiting=new Set<string>(),done=new Set<string>();const visit=(record:CommunityInstalledRecord)=>{if(visiting.has(record.hash))bad('Installed dependencies contain a cycle.');if(done.has(record.hash))return;visiting.add(record.hash);for(const dependency of record.dependencies)visit(byHash.get(dependency)!);visiting.delete(record.hash);done.add(record.hash);};records.forEach(visit);
 }
 private async dependencyRevision(api:CommunityApi,dep:CommunityDependency):Promise<CommunityRevision>{
  for(let page=1;page<=10;page++){
   const result=await api.search({query:dep.localId,kind:dep.kind,page,pageSize:50});for(const item of result.items){if(item.localId!==dep.localId)continue;const detail=await api.detail(item.id),revision=detail.revisions.find(revision=>revision.hash===dep.hash&&revision.version===dep.version&&revision.packageHash===dep.packageHash);if(revision)return revision;}
   if(page*result.pageSize>=result.total)break;
  }
  bad(`The published dependency ${dep.localId} ${dep.version} is missing.`);
 }
 async install(api:CommunityApi,source:CommunityPackageDetail,version=source.version):Promise<CommunityInstalledRecord>{
  await this.ready();const checked=detail(source),root=checked.revisions.find(revision=>revision.version===version);if(!root)bad('Published revision was not found.');
  const staged=new Map<string,CommunityInstalledRecord>(),visiting=new Set<string>();let bytes=0;
  const visit=async(revision:CommunityRevision,expected?:CommunityDependency):Promise<CommunityInstalledRecord>=>{
   const address=hash(revision.hash);if(visiting.has(address))bad('Published dependencies contain a cycle.');const prior=staged.get(address);if(prior)return prior;if(staged.size+visiting.size>=32)bad('Installation exceeds 32 packages.');visiting.add(address);
   const value=await this.validate(address,await api.download(address)),info=metadata(value);if(info.version!==revision.version||info.packageHash!==revision.packageHash)bad('Published revision metadata differs from its pinned package.');if(expected&&(info.kind!==expected.kind||info.localId!==expected.localId||info.version!==expected.version||info.packageHash!==expected.packageHash))bad('Published dependency differs from its pinned package.');
   const dependencies:string[]=[];
   for(const raw of list(revision.dependencies,32)){
    const dep=dependency(raw);let childRevision:CommunityRevision;
    if(dep.kind==='map'&&info.kind==='scenario')childRevision={version:dep.version,hash:dep.hash,packageHash:dep.packageHash,contentHash:null,simulationVersion:integer(value.simulationVersion,1),dependencies:[],preview:revision.preview,title:dep.localId,publishedAt:revision.publishedAt};
    else childRevision=await this.dependencyRevision(api,dep);
    const child=await visit(childRevision,dep);dependencies.push(child.hash);
   }
   bytes+=new TextEncoder().encode(canonical(value)).length;if(bytes>MAX_INSTALL_BYTES)bad('Installation exceeds the 32 MiB limit.');
   const record=frozen({hash:address,...info,package:value,dependencies,installedAt:Date.now()});staged.set(address,record);visiting.delete(address);return record;
  };
  const result=await visit(root);if(result.kind!==checked.kind||result.localId!==checked.localId)bad('Published identity differs from its pinned package.');const records=[...staged.values()];this.verifyDependencies(records);this.validateModClosure(records);
  const batch=JSON.stringify({schemaVersion:1,records}),key=`${this.key}.batch.${result.hash}`;if(new TextEncoder().encode(batch).length>MAX_INSTALL_BYTES)bad('Saved installation exceeds the 32 MiB limit.');
  if(this.storage){const prior=this.storage.getItem(key);if(prior===null)this.storage.setItem(key,batch);else{const restored=object(JSON.parse(prior));if(restored.schemaVersion!==1||canonical(list(restored.records,32).map(record=>object(record).package))!==canonical(records.map(record=>record.package)))bad('Existing installation batch differs from its pinned packages.');}}
  for(const record of records)if(!this.installed.has(record.hash))this.installed.set(record.hash,record);return this.installed.get(result.hash)!;
 }
}
