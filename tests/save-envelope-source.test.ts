import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, checksumSaveEnvelope, decodeOriginalSaveEnvelope, decodeSaveSource, loadGame, saveGame } from '../src/core/saves';

const fixture=(version:number)=>JSON.parse(readFileSync(new URL(`./fixtures/legacy-replay-v${version}.json`,import.meta.url),'utf8')).initial;
describe('original serialized save sources',()=>{
 it.each([[1,'5db9ad74'],[2,'0d8ff1ef'],[3,'e05eef18']] as const)('retains the genuine SAVE%i representation before migration', (version,checksum)=>{
  const source=fixture(version),before=JSON.stringify(source),{original,state}=decodeSaveSource(source);
  expect(original.version).toBe(version);expect(JSON.stringify(original)).toBe(before);expect(JSON.stringify(source)).toBe(before);
  expect(checksumSaveEnvelope(original)).toBe(checksum);expect(saveGame(state).version).toBe(SAVE_VERSION);
  expect(checksumSaveEnvelope(decodeSaveSource(JSON.stringify(source,null,2)).original)).toBe(checksum);
 });
 it('retains the historical final session game without reconstructing its defaults',()=>{
  const session=JSON.parse(readFileSync(new URL('../docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json',import.meta.url),'utf8')),before=JSON.stringify(session.game),{original,state}=decodeSaveSource(session.game);
  expect(checksumSaveEnvelope(original)).toBe('2556964e');expect(JSON.stringify(original)).toBe(before);expect(state.rules).toBeDefined();expect(original.state.rules).toBeUndefined();
  const reordered={...original,state:Object.fromEntries(Object.entries(original.state).reverse())};expect(checksumSaveEnvelope(reordered)).not.toBe(session.replay.finalChecksum);
 });
 it('does not bypass unrecognized content validation to return a checksum',()=>{
  const source=JSON.parse(readFileSync(new URL('../docs/evidence/content-root-integration-20261001/browser-save.json',import.meta.url),'utf8')).game;
  source.state.content.baseHash='0'.repeat(64);expect(()=>checksumSaveEnvelope(source)).toThrow('built-in content');
 });
 it('uses UTF-16 code units for supplementary characters and omits undefined object values',()=>{
  const session=JSON.parse(readFileSync(new URL('../docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json',import.meta.url),'utf8'));
  session.game.state.events.push({type:'message',x:1,y:1,side:0,text:'🌿'});
  expect(checksumSaveEnvelope(session.game)).toBe('2e4c9127');session.game.state.world=undefined;expect(checksumSaveEnvelope(session.game)).toBe('2e4c9127');
 });
 it('rejects non-JSON properties without invoking accessors',()=>{
  let reads=0;for(const field of ['object','array-index','array-extra','array-symbol','gap','undefined','cycle','unsafe','nonfinite']){
   const source=fixture(1);
   if(field==='object')Object.defineProperty(source.state,'x',{enumerable:true,get(){reads++;return 1;}});
   if(field==='array-index')Object.defineProperty(source.state.entities,'0',{get(){reads++;return 1;}});
   if(field==='array-extra')Object.defineProperty(source.state.corpses,'x',{get(){reads++;return 1;}});
   if(field==='array-symbol')source.state.corpses[Symbol('x')]=1;
   if(field==='gap')delete source.state.entities[0];
   if(field==='undefined')source.state.entities[0]=undefined;
   if(field==='cycle')source.state.loop=source;
   if(field==='unsafe')Object.defineProperty(source.state,'__proto__',{enumerable:true,value:1});
   if(field==='nonfinite')source.state.time=NaN;
   expect(()=>checksumSaveEnvelope(source),field).toThrow();
  }expect(reads).toBe(0);
 });
 it.each(['extra','01','00','-0','+0','0.0','0e0','4294967295'])('rejects array data property %s without changing the source',key=>{
  for(const enumerable of [true,false]){
   const source=fixture(1),array=source.state.entities;Object.defineProperty(array,key,{value:{marker:7},enumerable,configurable:true});
   const before=JSON.stringify(source),descriptors=Object.getOwnPropertyDescriptors(array);
   for(const decode of [decodeOriginalSaveEnvelope,checksumSaveEnvelope,decodeSaveSource,loadGame])expect(()=>decode(source)).toThrow('invalid array properties');
   expect(Object.getOwnPropertyDescriptors(array)).toEqual(descriptors);expect(JSON.stringify(source)).toBe(before);
  }
 });
 it('retains canonical nonenumerable array indices in the serialized source',()=>{
  const source=fixture(1),array=source.state.entities;Object.defineProperty(array,'0',{enumerable:false});
  const before=JSON.stringify(source),descriptors=Object.getOwnPropertyDescriptors(array),{original}=decodeSaveSource(source);
  expect(JSON.stringify(original)).toBe(before);expect(checksumSaveEnvelope(original)).toBe('5db9ad74');expect(Object.getOwnPropertyDescriptors(array)).toEqual(descriptors);expect(JSON.stringify(source)).toBe(before);
 });
 it('rejects noncanonical array accessors without invoking them or changing their descriptors',()=>{
  for(const key of ['extra','01','-0']){
   let reads=0;const source=fixture(1),array=source.state.entities;Object.defineProperty(array,key,{get(){reads++;return 7;},enumerable:false,configurable:true});
   const descriptors=Object.getOwnPropertyDescriptors(array);
   for(const decode of [decodeOriginalSaveEnvelope,checksumSaveEnvelope,decodeSaveSource,loadGame])expect(()=>decode(source)).toThrow('array accessors are forbidden');
   expect(reads).toBe(0);expect(Object.getOwnPropertyDescriptors(array)).toEqual(descriptors);
  }
 });
});
