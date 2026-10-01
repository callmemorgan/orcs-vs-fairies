import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ContentLibrary, canonicalContent, contentHash, createContentBundle, decodeContentPackage } from '../../src/core/content-registry';
import type { ContentDependency, ContentPackage } from '../../src/core/content-registry';
import { canonicalMapHash, canonicalPackageHash, createEditorMap, decodeMapPackage, makeMapPackage, validateEditorMap } from '../../src/editor/map-package';
import type { MapPackage } from '../../src/editor/map-package';
import { createScenarioDraft, decodeScenarioPackage, makeScenarioPackage } from '../../src/editor/scenario-package';
import { ServerStore } from '../../src/server/store';
import { CommunityPackages, CommunityPackageError, COMMUNITY_PACKAGE_MAX_BYTES } from '../../src/server/community-packages';
import type { CommunityPackageValidators } from '../../src/server/community-packages';
import type { Account } from '../../src/online/protocol';

const alice:Account={id:'account-alice',username:'Alice'},bob:Account={id:'account-bob',username:'Bob'};
const map=makeMapPackage({id:'river',title:'River pass',author:'Declared author',revision:1},createEditorMap(4127,'small',2));
const validators:CommunityPackageValidators={
 map(input){const value=decodeMapPackage(input),validation=validateEditorMap(value.map);if(!validation.valid)throw new Error(validation.issues.join('; '));return value;},
 scenario:decodeScenarioPackage,mod:decodeContentPackage,modClosure:createContentBundle,
};
function revision(value:number,title='River pass'):MapPackage {return makeMapPackage({id:'river',title,author:'Declared author',revision:value},map.map);}
function mod(id='alpha',version='1.0.0',dependencies:ContentDependency[]=[]):ContentPackage {
 const body={format:'orcs-vs-fairies-mod' as const,schemaVersion:1 as const,engineVersion:3 as const,id,version,name:`${id} peoples`,dependencies,
 factions:[{id:`${id}:folk` as const,baseFaction:'fairies' as const,name:`${id} Folk`,subtitle:'Community faction',description:'An inherited fairy roster.',color:0x124678,accent:'#124678',units:[],buildings:[],research:[]}],art:{}};
 return decodeContentPackage({...body,hash:contentHash(body)});
}
function resign(value:ContentPackage):ContentPackage {const {hash:_,...body}=value;return {...body,hash:contentHash(body)};}
function expectStatus(fn:()=>unknown,status:number,pattern?:RegExp):void {
 try{fn();throw new Error('Expected CommunityPackageError.');}catch(error){expect(error).toBeInstanceOf(CommunityPackageError);expect((error as CommunityPackageError).status).toBe(status);if(pattern)expect((error as Error).message).toMatch(pattern);}
}
let directory:string,store:ServerStore,community:CommunityPackages;
beforeEach(()=>{directory=mkdtempSync(join(tmpdir(),'ovf-community-'));store=new ServerStore(directory,'community-test');store.addUser(alice,'unused-test-password-hash');store.addUser(bob,'unused-test-password-hash');community=new CommunityPackages(store.db,validators);});
afterEach(()=>{store.close();rmSync(directory,{recursive:true,force:true});});

describe('durable community publications',()=>{
 it('binds the complete validated body to a SHA-256 download address',()=>{
  const result=community.publish(alice,map),detail=result.detail,download=community.download(detail.hash);
  expect(result.created).toBe(true);expect(detail.publisher).toEqual(alice);expect(detail.localId).toBe('river');expect(detail.packageHash).toBe(map.hash);
  expect(detail.hash).toBe(createHash('sha256').update(canonicalContent(map)).digest('hex'));expect(download).toEqual(map);
  expect((download as MapPackage).author).toBe('Declared author');expect(decodeMapPackage(download)).toEqual(map);
  expect(detail.preview.type).toBe('map');expect(detail.revisions[0].dependencies).toEqual([]);expect(detail.revisions[0].contentHash).toBe(map.contentHash);
 });

 it('preserves every revision and body across actual SQLite restart and a second profile',()=>{
  const first=community.publish(alice,map).detail,second=community.publish(alice,revision(2,'River pass revised')).detail;
  store.close();store=new ServerStore(directory,'community-test');community=new CommunityPackages(store.db,validators);
  const detail=community.detail(first.id);expect(detail.hash).toBe(second.hash);expect(detail.version).toBe('2');expect(detail.revisions.map(r=>r.version)).toEqual(['2','1']);
  expect(community.download(first.hash)).toEqual(map);expect(community.search({query:'revised'}).items[0].id).toBe(first.id);
  const other=community.publish(bob,community.download(first.hash)).detail;expect(other.id).not.toBe(first.id);expect(other.hash).toBe(first.hash);expect(other.publisher).toEqual(bob);
  expect(store.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
 });

 it('returns idempotent results for equivalent JSON while rejecting modified published versions',()=>{
  const first=community.publish(alice,map),reordered=Object.fromEntries(Object.entries(map).reverse());
  expect(community.publish(alice,JSON.stringify(reordered))).toEqual({created:false,detail:first.detail});
  expectStatus(()=>community.publish(alice,revision(1,'Different bytes')),409,/immutable/);
  expect(community.detail(first.detail.id).revisions).toHaveLength(1);expect(community.download(first.detail.hash)).toEqual(map);
 });

 it('selects the greatest version, including when older revisions arrive later',()=>{
  community.publish(alice,revision(10,'Tenth revision'));const detail=community.publish(alice,revision(2,'Second revision')).detail;
  expect(detail.version).toBe('10');expect(detail.title).toBe('Tenth revision');expect(community.search().items[0].version).toBe('10');
  community.publish(bob,mod('alpha','1.10.0'));const mods=community.publish(bob,mod('alpha','1.2.0')).detail;
  expect(mods.version).toBe('1.10.0');expect(mods.revisions.map(r=>r.version)).toEqual(['1.10.0','1.2.0']);
 });

 it('keeps identical local IDs independent across publishers and kinds',()=>{
  const first=community.publish(alice,map).detail,other=community.publish(bob,revision(1,'Bob river')).detail;
  const draft=createScenarioDraft();draft.id='river';draft.army=[{label:'commander',side:0,kind:'unit',role:'melee',x:map.map.starts[0].x+3,y:map.map.starts[0].y+1}];
  const mission=community.publish(alice,makeScenarioPackage({author:'Alice',revision:1},draft,map)).detail;
  expect(new Set([first.id,other.id,mission.id]).size).toBe(3);expect(community.search().total).toBe(3);expect(community.detail(first.id).title).toBe('River pass');
 });

 it('publishes scenarios using the shared graph decoder and preserves their embedded map dependency',()=>{
  const draft=createScenarioDraft();draft.army=[{label:'commander',side:0,kind:'unit',role:'melee',x:map.map.starts[0].x+3,y:map.map.starts[0].y+1}];
  const pkg=makeScenarioPackage({author:'Alice',revision:1},draft,map),detail=community.publish(alice,pkg).detail,dependency=detail.revisions[0].dependencies[0];
  expect(detail.localId).toBe(draft.id);expect(detail.title).toBe(draft.title);expect(detail.preview).toMatchObject({type:'scenario',actors:1,objectives:1,events:0});
  expect(dependency).toEqual({kind:'map',localId:map.id,version:'1',hash:createHash('sha256').update(canonicalContent(map)).digest('hex'),packageHash:map.hash});
  expect(community.download(dependency.hash)).toEqual(map);expect(decodeScenarioPackage(community.download(detail.hash))).toEqual(pkg);
  expect(community.search({kind:'map'}).total).toBe(0);expect(community.search({kind:'scenario'}).total).toBe(1);
 });

 it('rejects invalid graphs, hash tampering, incompatible versions and nonplayable maps without writing rows',()=>{
  const mission=createScenarioDraft();mission.army=[{label:'commander',side:0,kind:'unit',role:'melee',x:map.map.starts[0].x+3,y:map.map.starts[0].y+1}];
  const scenario=makeScenarioPackage({author:'Alice',revision:1},mission,map),badScenario=structuredClone(scenario);badScenario.scenario.objectives[0].success={type:'alive',actor:'missing'};
  const mutations=[{...map,hash:'0'.repeat(16)},{...map,simulationVersion:999},{...map,unknown:true},badScenario,{...scenario,mapHash:'0'.repeat(16)}];
  for(const input of mutations)expectStatus(()=>community.publish(alice,input),400);
  const invalidMap=structuredClone(map);for(let y=0;y<invalidMap.map.height;y++)invalidMap.map.levels[0].terrain[y*invalidMap.map.width+18]='water';
  invalidMap.contentHash=canonicalMapHash(invalidMap.map);const {hash:_,...body}=invalidMap;invalidMap.hash=canonicalPackageHash(body);
  expect(decodeMapPackage(invalidMap)).toEqual(invalidMap);expectStatus(()=>community.publish(alice,invalidMap),400,/disconnected|Unreachable/);
  expect(community.search().total).toBe(0);expect(store.db.prepare('SELECT count(*) AS total FROM community_blobs').get()!.total).toBe(0);
 });

 it('requires a current authenticated server account and never trusts supplied author text as ownership',()=>{
  for(const account of [undefined,{id:'missing',username:'Missing'},{id:alice.id,username:'Spoof'}])expectStatus(()=>community.publish(account as Account,map),401);
  expect(community.publish(alice,map).detail.publisher).toEqual(alice);
 });

 it('protects published identities, revisions and blobs from direct SQLite overwrites and deletion',()=>{
  const detail=community.publish(alice,map).detail;
  for(const sql of ["UPDATE community_packages SET owner_id='account-bob'","UPDATE community_revisions SET title='replaced'",'DELETE FROM community_revisions',"UPDATE community_blobs SET body='{}'",'DELETE FROM community_blobs'])expect(()=>store.db.exec(sql)).toThrow(/immutable/);
  expect(community.download(detail.hash)).toEqual(map);expect(community.detail(detail.id).publisher).toEqual(alice);
 });

 it('detects stored corruption on download instead of returning damaged JSON',()=>{
  const detail=community.publish(alice,map).detail;store.db.exec('DROP TRIGGER community_blobs_no_update');store.db.prepare('UPDATE community_blobs SET body=? WHERE hash=?').run('{}',detail.hash);
  expectStatus(()=>community.download(detail.hash),500,/integrity/);
  expectStatus(()=>community.publish(bob,map),500,/integrity/);expect(community.search().total).toBe(1);
 });

 it('reports unavailable or changed decoder compatibility without changing durable package bytes',()=>{
  const detail=community.publish(alice,map).detail,changed=new CommunityPackages(store.db,{...validators,map(input){const pkg=validators.map(input) as MapPackage;return {...pkg,title:pkg.title+' migrated'};}});
  expectStatus(()=>changed.download(detail.hash),409,/original compatible decoder/);expect(community.download(detail.hash)).toEqual(map);
 });

 it('limits caller JSON before executing getters or entering a write transaction',()=>{
  let invoked=false;const getter={get kind(){invoked=true;return 'map';}};
  expectStatus(()=>community.publish(alice,getter),400,/accessors/);expect(invoked).toBe(false);
  const cycle:Record<string,unknown>={kind:'map'};cycle.self=cycle;expectStatus(()=>community.publish(alice,cycle),400,/cycles/);
  expectStatus(()=>community.publish(alice,' '.repeat(COMMUNITY_PACKAGE_MAX_BYTES+1)),413);
  expectStatus(()=>community.publish(alice,'{'),400,/JSON/);
  const sparse={...map,map:{...map.map,resources:Array(2)}};expectStatus(()=>community.publish(alice,sparse),400,/gaps/);
  expectStatus(()=>community.publish(alice,{...map,revision:Infinity}),400,/finite/);
  expect(community.search().total).toBe(0);
 });

 it('generates bounded geometry and count previews without including executable content',()=>{
  const pkg=mod(),body=structuredClone(pkg);body.name='<svg onload=alert(1)>';const admitted=resign(body),detail=community.publish(alice,admitted).detail;
  expect(detail.preview).toEqual({type:'mod',factions:[{id:'alpha:folk',name:'alpha Folk',color:0x124678,units:0,buildings:0}]});
  expect(JSON.stringify(detail.preview)).not.toMatch(/svg|onload|script/);expect(detail.title).toBe(body.name);
  const terrain=community.publish(alice,map).detail.preview;expect(terrain.type).toBe('map');if(terrain.type==='map')for(const level of terrain.levels)expect(level.terrain.length).toBeLessThanOrEqual(1024);
 });
});

describe('published exact mod dependencies',()=>{
 it('admits another publisher’s exact package and a transitive closure through the real content bundle',()=>{
  const alpha=mod(),alphaDetail=community.publish(alice,alpha).detail,beta=mod('beta','1.0.0',[{id:alpha.id,version:alpha.version,hash:alpha.hash}]),betaDetail=community.publish(bob,beta).detail;
  const gamma=mod('gamma','1.0.0',[{id:beta.id,version:beta.version,hash:beta.hash}]),gammaDetail=community.publish(alice,gamma).detail;
  expect(betaDetail.revisions[0].dependencies).toEqual([{kind:'mod',localId:'alpha',version:'1.0.0',hash:alphaDetail.hash,packageHash:alpha.hash}]);
  expect(gammaDetail.revisions[0].dependencies[0].hash).toBe(betaDetail.hash);
  const library=new ContentLibrary();library.install(community.download(alphaDetail.hash));library.install(community.download(betaDetail.hash));library.install(community.download(gammaDetail.hash));
  expect(library.bundle().packages.map(p=>p.id)).toEqual(['alpha','beta','gamma']);
  store.close();store=new ServerStore(directory,'community-test');community=new CommunityPackages(store.db,validators);expect(community.download(gammaDetail.hash)).toEqual(gamma);
 });

 it('rejects missing, mismatched hash and mismatched version dependencies atomically',()=>{
  const alpha=mod();community.publish(alice,alpha);
  for(const dependency of [{id:'missing',version:'1.0.0',hash:alpha.hash},{id:'alpha',version:'2.0.0',hash:alpha.hash},{id:'alpha',version:'1.0.0',hash:'0'.repeat(64)}])expectStatus(()=>community.publish(bob,mod('beta','1.0.0',[dependency])),409,/exact dependency/);
  expect(community.search().total).toBe(1);
 });

 it('checks reference compatibility, research cycles and duplicate dependency namespaces beyond syntax',()=>{
  const alpha=mod();community.publish(alice,alpha);
  const invalid=structuredClone(mod('beta'));invalid.factions[0].defaultUnits={melee:'beta:missing'};
  expect(decodeContentPackage(resign(invalid)).id).toBe('beta');expectStatus(()=>community.publish(bob,resign(invalid)),400,/absent/);
  const cyclic=structuredClone(mod('beta'));cyclic.factions[0].research=[{id:'beta:research',name:'Cycle',description:'Invalid cycle.',cost:{wood:1,ore:0,crystal:0},researchTime:1,building:'barracks',appliesTo:'melee',requires:['beta:research'],effects:{damage:1.1}}];
  expectStatus(()=>community.publish(bob,resign(cyclic)),400,/prerequisite cycle/);
  const dependency={id:'alpha',version:'1.0.0',hash:alpha.hash};expectStatus(()=>community.publish(bob,mod('beta','1.0.0',[dependency,dependency])),400,/duplicate dependency/);
  expect(community.search().total).toBe(1);
 });

 it('rejects two versions of the same namespace inside a transitive dependency closure',()=>{
  const alpha=mod(),alphaRef={id:alpha.id,version:alpha.version,hash:alpha.hash};community.publish(alice,alpha);
  const beta=mod('beta','1.0.0',[alphaRef]);community.publish(bob,beta);
  expectStatus(()=>community.publish(alice,mod('alpha','2.0.0',[{id:beta.id,version:beta.version,hash:beta.hash}])),400,/two versions/);
  expect(community.search().total).toBe(2);
 });

 it('refuses mod publication when the real bundle compatibility validator is unavailable',()=>{
  const incomplete=new CommunityPackages(store.db,{map:validators.map,scenario:validators.scenario,mod:validators.mod});
  expectStatus(()=>incomplete.publish(alice,mod()),503,/bundle validation/);expect(community.search().total).toBe(0);
 });
});

describe('bounded community lookup',()=>{
 it('filters kinds and literal queries, escapes SQL wildcards and paginates deterministically',()=>{
  for(let i=0;i<5;i++)community.publish(alice,makeMapPackage({id:`map-${i}`,title:i===0?'Literal %_ title':`Map ${i}`,author:'Alice',revision:1},map.map));community.publish(bob,mod());
  expect(community.search({kind:'map'}).total).toBe(5);expect(community.search({kind:'mod'}).items).toHaveLength(1);
  expect(community.search({query:'%_'}).items.map(p=>p.title)).toEqual(['Literal %_ title']);expect(community.search({query:"' OR 1=1 --"}).total).toBe(0);
  expect(community.search({query:'Alice'}).total).toBe(5);expect(community.search({query:''}).total).toBe(6);
  const first=community.search({page:1,pageSize:2}),second=community.search({page:2,pageSize:2});expect(first.items).toHaveLength(2);expect(second.items).toHaveLength(2);expect(new Set([...first.items,...second.items].map(p=>p.id)).size).toBe(4);
  expect(community.search({page:10000,pageSize:50}).items).toEqual([]);
 });

 it.each([{page:0},{page:1.5},{page:10001},{pageSize:0},{pageSize:51},{query:'x'.repeat(121)},{kind:'asset'},{unknown:true}])('rejects out-of-bounds search %j',options=>expectStatus(()=>community.search(options as never),400));

 it('distinguishes malformed identifiers from unknown valid identifiers',()=>{
  expectStatus(()=>community.detail('../escape'),400);expectStatus(()=>community.detail('0'.repeat(64)),404);
  expectStatus(()=>community.download('not-a-hash'),400);expectStatus(()=>community.download('0'.repeat(64)),404);
 });
});
