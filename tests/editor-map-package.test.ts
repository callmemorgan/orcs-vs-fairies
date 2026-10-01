import { describe, expect, it } from 'vitest';
import { MAP_VERSION } from '../src/core/maps';
import { SAVE_VERSION } from '../src/core/saves';
import { canonicalMapHash, canonicalPackageHash, createEditorMap, decodeEditorMap, decodeMapPackage, EDITOR_SIMULATION_VERSION, makeMapPackage, validateEditorMap } from '../src/editor/map-package';
import type { EditorMapData, MapPackage, MapPackageMetadata } from '../src/editor/map-package';

const info:MapPackageMetadata={id:'custom.map-1',title:'Asymmetric valley',author:'Morgan',revision:1};
function flat():EditorMapData {
 const width=32,height=32;
 return {width,height,size:'small',seed:4127,levels:[{id:0,title:'Ground',terrain:Array(width*height).fill('grass'),elevation:Array(width*height).fill(0)}],starts:[{x:6.5,y:6.5,level:0,slot:0},{x:25.5,y:25.5,level:0,slot:1}],resources:[{x:2.5,y:10.5,level:0,kind:'wood',amount:1800,maxAmount:2000},{x:29.5,y:21.5,level:0,kind:'ore',amount:100,maxAmount:100},{x:11.5,y:3.5,level:0,kind:'ore',amount:1000,maxAmount:1000},{x:11.5,y:10.5,level:0,kind:'crystal',amount:100,maxAmount:100},{x:27.5,y:19.5,level:0,kind:'wood',amount:1000,maxAmount:1000},{x:20.5,y:21.5,level:0,kind:'crystal',amount:100,maxAmount:100}],sites:[],transitions:[]};
}
function twoLevels():EditorMapData {
 const map=flat();map.levels.push({id:1,title:'Cavern',terrain:Array(map.width*map.height).fill('grass'),elevation:Array(map.width*map.height).fill(0)});return map;
}
function wall(map:EditorMapData):void {for(let y=0;y<map.height;y++)map.levels[0].terrain[y*map.width+15]='water';}
function integrityPackage(map:EditorMapData):MapPackage {
 const data={schemaVersion:1 as const,kind:'map' as const,...info,simulationVersion:EDITOR_SIMULATION_VERSION,mapVersion:MAP_VERSION,contentHash:canonicalMapHash(map),map};
 return {...data,hash:canonicalPackageHash(data)};
}

describe('editor map packages',()=>{
 it('exports and imports detached asymmetric maps with bounded metadata',()=>{
  const map=flat();map.levels[0].terrain[1*map.width+11]='rock';map.sites.push({id:1,x:17.5,y:17.5,level:0,kind:'relic'});
  const pkg=makeMapPackage({...info,title:'Valley / 渓谷'},map),loaded=decodeMapPackage(JSON.stringify(pkg));
  expect(loaded).toEqual(pkg);expect(pkg.simulationVersion).toBe(SAVE_VERSION);expect(pkg.mapVersion).toBe(MAP_VERSION);
  expect(pkg.map).not.toBe(map);expect(loaded.map.levels[0].terrain).not.toBe(pkg.map.levels[0].terrain);
  map.levels[0].terrain[0]='water';expect(loaded.map.levels[0].terrain[0]).toBe('grass');
  expect(pkg.contentHash).toMatch(/^[0-9a-f]{16}$/);expect(pkg.hash).toMatch(/^[0-9a-f]{16}$/);
 });

 it.each([1,2,3,4,5,6,7,8])('makes a connected generated document for %i players',(players)=>{
  const map=createEditorMap(4127,'small',players),result=validateEditorMap(map);
  expect(result.issues).toEqual([]);expect(result.startsConnected).toBe(true);expect(result.reachableResources).toBe(map.resources.length);
  expect(map.starts).toHaveLength(players);expect(decodeEditorMap(map)).toEqual(map);
 },30_000);

 it('retains edits and disconnection during structural imports while gating exports',()=>{
  const map=flat();wall(map);
  expect(decodeEditorMap(map)).toEqual(map);expect(validateEditorMap(map).startsConnected).toBe(false);
  expect(decodeMapPackage(integrityPackage(map)).map).toEqual(map);
  expect(()=>makeMapPackage(info,map)).toThrow(/disconnected/);
  const overlap=flat();overlap.resources[0].x=overlap.starts[0].x;overlap.resources[0].y=overlap.starts[0].y;
  expect(decodeEditorMap(overlap)).toEqual(overlap);expect(validateEditorMap(overlap).issues.join(' ')).toMatch(/overlaps a resource/);
 });

 it('hashes canonical key order, preserves numeric values, and covers content and metadata',()=>{
  const map=flat(),reordered=Object.fromEntries(Object.entries(map).reverse()),pkg=makeMapPackage(info,map);
  expect(canonicalMapHash(reordered)).toBe(pkg.contentHash);
  const changed=structuredClone(map);changed.seed++;expect(canonicalMapHash(changed)).not.toBe(pkg.contentHash);
  const changedMetadata={...pkg,title:'Other title'};expect(()=>decodeMapPackage(changedMetadata)).toThrow(/package checksum mismatch/);
  const changedContent={...pkg,map:changed};expect(()=>decodeMapPackage(changedContent)).toThrow(/map checksum mismatch/);
  const minusZero=structuredClone(map);minusZero.seed=-0;const zero=structuredClone(map);zero.seed=0;expect(canonicalMapHash(minusZero)).toBe(canonicalMapHash(zero));
 });

 it.each([
  ['schemaVersion',2],['kind','scenario'],['simulationVersion',SAVE_VERSION+1],['simulationVersion',SAVE_VERSION-1],['mapVersion',MAP_VERSION+1],['mapVersion',MAP_VERSION-1],['hash','invalid'],['contentHash','0'.repeat(16)],['unknown',true],
 ])('rejects unsupported or damaged package field %s',(key,value)=>{
  const pkg=makeMapPackage(info,flat());expect(()=>decodeMapPackage({...pkg,[key]:value})).toThrow();
 });

 it.each([
  ['id','../escape'],['id','x'.repeat(65)],['title',' '],['title','a\nb'],['author',''],['revision',0],['revision',1.5],['simulationVersion',null],['mapVersion',0],['unknown',true],
 ])('rejects invalid export metadata %s',(key,value)=>{
  expect(()=>makeMapPackage({...info,[key]:value},flat())).toThrow();
 });

 it('rejects non-JSON values and accessors without executing them',()=>{
  const map=flat();let invoked=false;
  Object.defineProperty(map,'seed',{get(){invoked=true;return 1;},enumerable:true});expect(()=>decodeEditorMap(map)).toThrow(/accessors/);expect(invoked).toBe(false);
  const hidden=flat();Object.defineProperty(hidden,'extra',{value:1});expect(()=>decodeEditorMap(hidden)).toThrow(/hidden fields/);
  const symbol=flat();Object.assign(symbol,{[Symbol('extra')]:1});expect(()=>decodeEditorMap(symbol)).toThrow(/properties/);
  const cycle=flat() as unknown as Record<string,unknown>;cycle.extra=cycle;expect(()=>decodeEditorMap(cycle)).toThrow(/cyclic/);
  expect(()=>decodeEditorMap(new Date())).toThrow(/plain object/);expect(()=>decodeEditorMap('{')).toThrow(/invalid JSON/);
  const arrayExtra=flat();Object.assign(arrayExtra.starts,{extra:1});expect(()=>decodeEditorMap(arrayExtra)).toThrow(/extra properties/);
  const sparse=flat();delete sparse.levels[0].terrain[5];expect(()=>decodeEditorMap(sparse)).toThrow(/gaps/);
 });

 it.each([
  ['width',7],['height',257],['width',16.5],['seed',-1],['seed',4294967296],['seed',Infinity],['size','giant'],['levels',[]],['extra',true],
 ])('rejects invalid map field %s',(key,value)=>{expect(()=>decodeEditorMap({...flat(),[key]:value})).toThrow();});

 it('rejects bad level grids, levels, enums and elevations',()=>{
  const mutations:((map:EditorMapData)=>void)[]=[
   m=>m.levels[0].terrain.pop(),m=>m.levels[0].elevation.push(0),m=>m.levels[0].terrain[0]='lava' as never,
   m=>m.levels[0].elevation[0]=4,m=>m.levels[0].elevation[0]=-.1,m=>m.levels[0].elevation[0]=.5,
   m=>m.levels[0].id=1,m=>m.levels.push(structuredClone(m.levels[0])),m=>m.starts[0].level=1,
   m=>m.resources[0].kind='gold' as never,m=>m.resources[0].amount=2001,m=>m.resources[0].maxAmount=-1,
   m=>m.starts[0].x=m.width,m=>m.starts[0].y=-.1,m=>m.starts[0].x=NaN,m=>m.starts[1].slot=0,
   m=>m.sites.push({id:1,x:15,y:15,level:0,kind:'dragon' as never}),
   m=>m.transitions.push({id:1,from:{x:15,y:15,level:0},to:{x:15,y:15,level:1}}),
  ];
  for(const mutate of mutations){const map=flat();mutate(map);expect(()=>decodeEditorMap(map)).toThrow();}
 });

 it('rejects duplicate site/transition IDs, excessive records and nested unknown keys',()=>{
  const map=twoLevels(),site={id:1,x:15,y:15,level:0,kind:'village' as const},transition={id:1,from:{x:15,y:15,level:0},to:{x:15,y:15,level:1}};
  map.sites=[site,{...site,x:18}];expect(()=>decodeEditorMap(map)).toThrow(/duplicate/);map.sites=[];
  map.transitions=[transition,{...transition}];expect(()=>decodeEditorMap(map)).toThrow(/duplicate/);map.transitions=[];
  Object.assign(map.levels[0],{extra:1});expect(()=>decodeEditorMap(map)).toThrow(/unknown field/);
  expect(()=>decodeEditorMap({...flat(),resources:Array(2049).fill(flat().resources[0])})).toThrow(/array length/);
 });

 it('uses the core map limits and terrain contract without blocking repairable drafts',()=>{
  const map=twoLevels();map.levels[0].terrain[1]='sand';map.levels[0].terrain[2]='snow';map.levels[0].terrain[3]='forest';
  expect(decodeEditorMap(map)).toEqual(map);expect(validateEditorMap(map).issues.join(' ')).toMatch(/cavern has no entrance/);
  expect(()=>decodeEditorMap({...map,levels:[map.levels[1],map.levels[0]]})).toThrow(/ordered/);
  const title=flat();title.levels[0].title='a'.repeat(81);expect(()=>decodeEditorMap(title)).toThrow(/invalid text/);
  expect(()=>decodeEditorMap({...flat(),width:129})).toThrow();
  const noCrystal=flat();noCrystal.resources=noCrystal.resources.filter(resource=>resource.kind!=='crystal');
  expect(decodeEditorMap(noCrystal)).toEqual(noCrystal);expect(validateEditorMap(noCrystal).issues.join(' ')).toMatch(/lacks nearbycrystal/);
 });

 it('requires starts before play, allows editable missing and noncontiguous starts',()=>{
  const empty=flat();empty.starts=[];expect(decodeEditorMap(empty).starts).toEqual([]);expect(validateEditorMap(empty).issues.join(' ')).toMatch(/starting position/);
  const slots=flat();slots.starts[1].slot=7;expect(validateEditorMap(slots).issues.join(' ')).toMatch(/contiguous/);
 });

 it('checks opening terrain, HQ footprint, elevation, resource and HQ collisions',()=>{
  const mutations:[(map:EditorMapData)=>void,RegExp][]=[
   [m=>m.starts[0].x=1.5,/playable border/],
   [m=>m.levels[0].terrain[6*m.width+6]='water',/buildable terrain/],
   [m=>m.levels[0].elevation[6*m.width+6]=1,/flat buildable terrain/],
   [m=>m.levels[0].terrain[9*m.width+4]='rock',/opening units/],
   [m=>{m.resources[0].x=6.5;m.resources[0].y=6.5;},/overlaps a resource/],
   [m=>{m.starts[1].x=7.5;m.starts[1].y=7.5;},/headquarters overlap/],
   [m=>m.resources.push({...m.resources[0]}),/another resource/],
   [m=>m.levels[0].terrain[10*m.width+2]='water',/impassable terrain/],
   [m=>m.sites.push({id:1,x:6.5,y:6.5,level:0,kind:'monster'}),/Site 1 lies on blocked/],
  ];
  for(const [mutate,issue] of mutations){const map=flat();mutate(map);expect(validateEditorMap(map).issues.join(' ')).toMatch(issue);}
 });

 it('supports a traversable bridge and blocks cliffs higher than a single elevation step',()=>{
  const map=flat();wall(map);expect(validateEditorMap(map).startsConnected).toBe(false);
  map.levels[0].terrain[16*map.width+15]='bridge';expect(validateEditorMap(map).issues).toEqual([]);
  map.levels[0].terrain.fill('grass');for(let y=0;y<map.height;y++)for(let x=16;x<map.width;x++)map.levels[0].elevation[y*map.width+x]=3;
  expect(validateEditorMap(map).startsConnected).toBe(false);
  for(let y=0;y<map.height;y++){map.levels[0].elevation[y*map.width+14]=1;map.levels[0].elevation[y*map.width+15]=2;}
  expect(validateEditorMap(map).issues).toEqual([]);
 });

 it('connects armies and resources across multiple bidirectional level transitions',()=>{
  const map=twoLevels();wall(map);map.transitions=[{id:1,from:{x:11.5,y:16.5,level:0},to:{x:11.5,y:16.5,level:1}},{id:2,from:{x:20.5,y:16.5,level:1},to:{x:20.5,y:16.5,level:0}}];
  map.resources.push({x:17.5,y:13.5,level:1,kind:'crystal',amount:400,maxAmount:400});map.sites.push({id:1,x:17.5,y:17.5,level:1,kind:'village'});
  expect(validateEditorMap(map).issues).toEqual([]);expect(makeMapPackage(info,map).map.transitions).toEqual(map.transitions);
  map.transitions.pop();expect(validateEditorMap(map).startsConnected).toBe(false);
 });

 it('does not confuse identical coordinates on different levels',()=>{
  const map=twoLevels();map.starts[1]={...map.starts[0],slot:1,level:1};map.resources.push(...[0,2,3].map(index=>({...map.resources[index],level:1})));map.transitions=[{id:1,from:{x:16.5,y:16.5,level:0},to:{x:16.5,y:16.5,level:1}}];
  expect(validateEditorMap(map).issues).toEqual([]);
 });

 it('rejects blocked, same-level and repeated transition connections before play',()=>{
  const map=twoLevels(),transition={id:1,from:{x:16.5,y:16.5,level:0},to:{x:16.5,y:16.5,level:1}};
  map.transitions=[{...transition,from:{x:6.5,y:6.5,level:0}}];expect(validateEditorMap(map).issues.join(' ')).toMatch(/endpoints must be passable/);
  map.transitions=[{...transition,to:{x:20.5,y:20.5,level:0}}];expect(validateEditorMap(map).issues.join(' ')).toMatch(/different levels/);
  map.transitions=[transition,{id:2,from:transition.to,to:transition.from}];expect(validateEditorMap(map).issues.join(' ')).toMatch(/repeats/);
 });

 it('requires a reachable gather point instead of testing the blocked deposit center',()=>{
  const map=flat(),resource=map.resources[1];for(let y=20;y<=22;y++)for(let x=28;x<=30;x++)map.levels[0].terrain[y*map.width+x]='rock';map.levels[0].terrain[21*map.width+29]='grass';
  const result=validateEditorMap(map);expect(result.startsConnected).toBe(true);expect(result.reachableResources).toBe(5);expect(result.issues.join(' ')).toMatch(/Resource 1 is unreachable/);expect(resource.amount).toBe(100);
 });
});
