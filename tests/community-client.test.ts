import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommunityApi, CommunityLibrary, COMMUNITY_CLIENT_MAX_BYTES, communityPackageHash } from '../src/online/community-client';
import { OnlineApi, OnlineRequestError } from '../src/online/client';
import { createRtsServer } from '../src/server/server';
import { communityPackageValidators } from '../src/editor/package-validation';
import { createEditorMap, makeMapPackage } from '../src/editor/map-package';
import { createScenarioDraft, makeScenarioPackage } from '../src/editor/scenario-package';
import { canonicalContent, contentHash, decodeContentPackage } from '../src/core/content-registry';
import type { ContentDependency, ContentPackage } from '../src/core/content-registry';
import type { CommunityPackageDetail, CommunityPackageValidators } from '../src/server/community-packages';

class MemoryStorage implements Storage {
 values=new Map<string,string>();fail=false;
 get length(){return this.values.size;}
 key(index:number){return [...this.values.keys()][index]??null;}
 getItem(key:string){return this.values.get(key)??null;}
 setItem(key:string,value:string){if(this.fail)throw new Error('Storage quota exceeded.');this.values.set(key,value);}
 removeItem(key:string){this.values.delete(key);}
 clear(){this.values.clear();}
}
const original=makeMapPackage({id:'river',title:'River pass',author:'Local author',revision:1},createEditorMap(4127,'small',2));
function mapRevision(revision:number){return makeMapPackage({id:'river',title:`River pass ${revision}`,author:'Local author',revision},original.map);}
function mod(id:string,dependencies:ContentDependency[]=[]):ContentPackage {
 const body={format:'orcs-vs-fairies-mod' as const,schemaVersion:1 as const,engineVersion:3 as const,id,version:'1.0.0',name:`${id} people`,dependencies,
 factions:[{id:`${id}:folk` as const,baseFaction:'fairies' as const,name:`${id} Folk`,subtitle:'Community faction',description:'An inherited fairy roster.',color:0x124678,accent:'#124678',units:[],buildings:[],research:[]}],art:{}};
 return decodeContentPackage({...body,hash:contentHash(body)});
}
const cleanup:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{vi.restoreAllMocks();while(cleanup.length)await cleanup.pop()!();});
async function server(){const directory=await mkdtemp(join(tmpdir(),'ovf-community-client-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));const server=await createRtsServer({dataDir:directory,port:0});cleanup.push(()=>server.close());return server;}
function profile(baseUrl:string){
 let cookie='';const calls:{url:string;options:RequestInit|undefined}[]=[];
 const fetcher:typeof fetch=async(input,options)=>{const url=String(input);calls.push({url,options});const headers=new Headers(options?.headers);if(cookie)headers.set('Cookie',cookie);const response=await fetch(url,{...options,headers});const session=response.headers.get('set-cookie');if(session)cookie=session.split(';')[0];return response;};
 const auth=new OnlineApi({baseUrl,fetch:fetcher}),api=new CommunityApi({auth,fetch:fetcher});return {api,auth,calls,fetcher};
}
async function setup(){const host=await server(),alice=profile(host.url),bob=profile(host.url);await alice.auth.register('Alice','correct-horse-battery');await bob.auth.register('Bob','correct-horse-battery');return {host,alice,bob};}
function library(storage:Storage|null=new MemoryStorage(),validators:CommunityPackageValidators=communityPackageValidators){return new CommunityLibrary({storage,validators});}

describe('community HTTP client and pinned installation',()=>{
 it('uses the existing HttpOnly account session and exact authenticated publication routes',async()=>{
  const {alice,bob}=await setup();expect((await alice.api.auth.session())?.username).toBe('Alice');
  const published=await alice.api.publish(original),found=await bob.api.search({query:'River',kind:'map',page:1,pageSize:20}),detail=await bob.api.detail(found.items[0].id),download=await bob.api.download(detail.hash);
  expect(download).toEqual(original);expect(detail).toEqual(published.detail);expect(found.total).toBe(1);expect(detail.publisher.username).toBe('Alice');
  for(const request of alice.calls)expect(request.options?.credentials).toBe('include');
  expect(bob.calls.at(-1)?.url).toContain(`/api/packages/content/${detail.hash}`);
  const publication=alice.calls.find(call=>call.options?.method==='POST'&&call.url.endsWith('/api/packages'))!;expect(JSON.parse(publication.options?.body as string)).toEqual({package:original});
  await bob.auth.logout();await expect(bob.api.publish(mapRevision(2))).rejects.toMatchObject({status:401});
 });

 it('verifies canonical SHA-256 using full JSON including inner hashes',async()=>{
  expect(await communityPackageHash(original)).toBe(createHash('sha256').update(canonicalContent(original)).digest('hex'));
  expect(await communityPackageHash(Object.fromEntries(Object.entries(original).reverse()))).toBe(await communityPackageHash(original));
  const changed={...original,hash:'0'.repeat(16)};expect(await communityPackageHash(changed)).not.toBe(await communityPackageHash(original));
 });

 it('persists a verified installation and retains older pinned content after a new revision is installed',async()=>{
  const {alice,bob}=await setup(),storage=new MemoryStorage(),installed=library(storage),first=(await alice.api.publish(original)).detail;
  const old=await installed.install(bob.api,first),second=(await alice.api.publish(mapRevision(2))).detail,newer=await installed.install(bob.api,second);
  expect(installed.get(old.hash)).toBe(old);expect(old.package).toEqual(original);expect(old.version).toBe('1');expect(newer.version).toBe('2');expect(storage.length).toBe(2);
  expect(Object.isFrozen(old.package)).toBe(true);expect(Object.isFrozen(old)).toBe(true);expect(installed.packagesFor(old.hash)).toEqual([original]);
  const restored=library(storage);await restored.ready();expect(restored.list().map(record=>record.version).sort()).toEqual(['1','2']);expect(restored.get(old.hash)?.package).toEqual(original);
  const reinstalled=await installed.install(bob.api,second,'1');expect(reinstalled).toBe(old);
 });

 it('does not invoke shared decoders or change installed records after a tampered remote download',async()=>{
  const {alice,bob}=await setup(),detail=(await alice.api.publish(original)).detail,decoder=vi.fn(communityPackageValidators.map),installed=library(new MemoryStorage(),{...communityPackageValidators,map:decoder});
  const initial=await installed.install(bob.api,detail);decoder.mockClear();
  const altered={...original,title:'Tampered download'},api=new CommunityApi({baseUrl:bob.api.baseUrl,auth:bob.auth,fetch:async()=>new Response(JSON.stringify({package:altered}))});
  await expect(installed.install(api,detail)).rejects.toThrow(/download checksum/);expect(decoder).not.toHaveBeenCalled();expect(installed.list()).toEqual([initial]);
 });

 it('rejects a compatible-looking body when the shared decoder rejects it, before persistence',async()=>{
  const {alice,bob}=await setup(),detail=(await alice.api.publish(original)).detail,storage=new MemoryStorage(),installed=library(storage,{...communityPackageValidators,map(){throw new Error('Unsupported simulation version.');}});
  await expect(installed.install(bob.api,detail)).rejects.toThrow(/Unsupported simulation/);expect(installed.list()).toEqual([]);expect(storage.length).toBe(0);
 });

 it('keeps every installed record unchanged when atomic persistence fails',async()=>{
  const {alice,bob}=await setup(),storage=new MemoryStorage(),installed=library(storage),first=(await alice.api.publish(original)).detail;
  const initial=await installed.install(bob.api,first),second=(await alice.api.publish(mapRevision(2))).detail;storage.fail=true;
  await expect(installed.install(bob.api,second)).rejects.toThrow(/quota/);expect(installed.list()).toEqual([initial]);expect(storage.length).toBe(1);
 });

 it('uses immutable storage batches so independent local library instances preserve both revisions',async()=>{
  const {alice,bob}=await setup(),storage=new MemoryStorage(),first=library(storage),second=library(storage);await Promise.all([first.ready(),second.ready()]);
  const older=(await alice.api.publish(original)).detail,newer=(await alice.api.publish(mapRevision(2))).detail;
  await Promise.all([first.install(bob.api,older),second.install(bob.api,newer)]);expect(storage.length).toBe(2);
  const restored=library(storage);await restored.ready();expect(restored.list().map(record=>record.version).sort()).toEqual(['1','2']);
 });

 it('installs a scenario and its exact embedded map as a complete durable closure',async()=>{
  const {alice,bob}=await setup(),draft=createScenarioDraft();draft.army=[{label:'commander',side:0,kind:'unit',role:'melee',x:original.map.starts[0].x+3,y:original.map.starts[0].y+1}];
  const pkg=makeScenarioPackage({author:'Alice',revision:1},draft,original),detail=(await alice.api.publish(pkg)).detail,storage=new MemoryStorage(),installed=library(storage),record=await installed.install(bob.api,detail);
  expect(installed.closure(record.hash).map(record=>record.kind)).toEqual(['map','scenario']);expect(installed.packagesFor(record.hash)).toEqual([original,pkg]);
  const restored=library(storage);await restored.ready();expect(restored.get(record.hash)?.dependencies).toEqual(record.dependencies);
 });

 it('resolves exact transitive mod dependencies even when another publisher uses the same local ID',async()=>{
  const {alice,bob}=await setup(),alpha=mod('alpha'),alphaDetail=(await alice.api.publish(alpha)).detail;
  const other=structuredClone(alpha);other.name='Other alpha';const {hash:_,...unsigned}=other;other.hash=contentHash(unsigned);await bob.api.publish(other);
  const beta=mod('beta',[{id:alpha.id,version:alpha.version,hash:alpha.hash}]),betaDetail=(await alice.api.publish(beta)).detail,gamma=mod('gamma',[{id:beta.id,version:beta.version,hash:beta.hash}]),detail=(await alice.api.publish(gamma)).detail;
  const storage=new MemoryStorage(),installed=library(storage),record=await installed.install(bob.api,detail),closure=installed.closure(record.hash);
  expect(closure.map(record=>record.localId)).toEqual(['alpha','beta','gamma']);expect(closure[0].hash).toBe(alphaDetail.hash);expect(closure[1].hash).toBe(betaDetail.hash);expect(closure[0].package).toEqual(alpha);
  const restored=library(storage);await restored.ready();expect(restored.packagesFor(record.hash)).toEqual([alpha,beta,gamma]);
 });

 it('rejects missing remote dependencies and dependency cycles before any local mutation',async()=>{
  const {alice,bob}=await setup(),alpha=mod('alpha'),root=(await alice.api.publish(alpha)).detail,storage=new MemoryStorage(),installed=library(storage);
  const dependency={kind:'mod' as const,localId:'missing',version:'1.0.0',hash:'0'.repeat(64),packageHash:'0'.repeat(64)},missing=structuredClone(root);missing.revisions[0].dependencies=[dependency];
  await expect(installed.install(bob.api,missing)).rejects.toThrow(/missing/);expect(storage.length).toBe(0);
  const cyclic=structuredClone(root);cyclic.revisions[0].dependencies=[{kind:'mod',localId:'alpha',version:alpha.version,hash:root.hash,packageHash:alpha.hash}];
  const api=new CommunityApi({baseUrl:bob.api.baseUrl,auth:bob.auth,fetch:async(input,options)=>String(input).includes('/api/packages/content/')?bob.fetcher(input,options):String(input).includes('?')?new Response(JSON.stringify({items:[cyclic],total:1,page:1,pageSize:50})):new Response(JSON.stringify({detail:cyclic}))});
  await expect(installed.install(api,cyclic)).rejects.toThrow(/cycle/);expect(installed.list()).toEqual([]);expect(storage.length).toBe(0);
 });

 it('rejects stored tampering and mismatched metadata without loading partial batches',async()=>{
  const {alice,bob}=await setup(),detail=(await alice.api.publish(original)).detail,storage=new MemoryStorage(),installed=library(storage);await installed.install(bob.api,detail);
  const key=storage.key(0)!,batch=JSON.parse(storage.getItem(key)!);batch.records[0].package.title='Tampered local body';storage.setItem(key,JSON.stringify(batch));
  const restored=library(storage);await expect(restored.ready()).rejects.toThrow(/checksum/);expect(restored.list()).toEqual([]);
 });

 it('rejects installation metadata that disagrees with the verified requested revision',async()=>{
  const {alice,bob}=await setup(),detail=(await alice.api.publish(original)).detail,wrong=structuredClone(detail);wrong.revisions[0].packageHash='0'.repeat(16);
  const installed=library();await expect(installed.install(bob.api,wrong)).rejects.toThrow(/metadata differs/);expect(installed.list()).toEqual([]);
 });

 it('reports HTTP conflicts and malformed envelopes without retrying publication',async()=>{
  const {alice}=await setup();await alice.api.publish(original);await expect(alice.api.publish(mapRevision(1))).rejects.toMatchObject({status:409});
  const bad=new CommunityApi({baseUrl:'https://battle.example',fetch:async()=>new Response('<html>',{status:502})});await expect(bad.search()).rejects.toBeInstanceOf(OnlineRequestError);
  const envelope=new CommunityApi({baseUrl:'https://battle.example',fetch:async()=>new Response(JSON.stringify({items:[],total:0,page:1,pageSize:999}))});await expect(envelope.search()).rejects.toThrow(/number/);
 });

 it('bounds advertised and streamed responses and rejects unsafe input before fetching',async()=>{
  const advertised=new CommunityApi({baseUrl:'https://battle.example',fetch:async()=>new Response('{}',{headers:{'Content-Length':String(COMMUNITY_CLIENT_MAX_BYTES+1)}})});await expect(advertised.search()).rejects.toThrow(/limit/);
  const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(COMMUNITY_CLIENT_MAX_BYTES));controller.enqueue(new Uint8Array(1));controller.close();}}),streamed=new CommunityApi({baseUrl:'https://battle.example',fetch:async()=>new Response(stream)});await expect(streamed.search()).rejects.toThrow(/limit/);
  const fetcher=vi.fn<typeof fetch>(),api=new CommunityApi({baseUrl:'https://battle.example',fetch:fetcher});let invoked=false;
  await expect(api.publish({get kind(){invoked=true;return 'map';}})).rejects.toThrow(/accessors/);expect(invoked).toBe(false);expect(fetcher).not.toHaveBeenCalled();
  await expect(api.download('../escape')).rejects.toThrow(/checksum/);
 });

 it('requires explicit valid same-server configuration for authentication and content',()=>{
  expect(()=>new CommunityApi({baseUrl:'file:///tmp/packages'})).toThrow(/origin/);expect(()=>new CommunityApi({baseUrl:'https://battle.example/path'})).toThrow(/origin/);
  expect(()=>new CommunityApi({baseUrl:'https://battle.example',auth:new OnlineApi({baseUrl:'https://other.example'})})).toThrow(/same server/);
 });
});
