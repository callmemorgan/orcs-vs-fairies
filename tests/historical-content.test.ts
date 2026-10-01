import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_CONTENT_HASH, CONTENT_ENGINE_VERSION, LEGACY_BASE_CONTENT_HASH, availableUnits, buildingFor, contentHash, createContentBundle, decodeContentBundle, decodeHistoricalContentBundle, migrateHistoricalContentBundle, unitFor, upgradesFor } from '../src/core/content-registry';
import type { ContentBundle } from '../src/core/content-registry';
import type { GameState } from '../src/core/types';

const fixture=()=>JSON.parse(readFileSync(new URL('../docs/evidence/content-root-integration-20261001/browser-save.json',import.meta.url),'utf8'));
const resign=(value:ContentBundle)=>{const {hash:_,...body}=value;value.hash=contentHash(body);return value;};

describe('historical built-in content admission',()=>{
 it('authenticates the genuine Lantern manifest against the shipped old definitions',()=>{
  const source=fixture(),raw=JSON.stringify(source.game.state.content),content=decodeHistoricalContentBundle(source.game.state.content);
  expect(LEGACY_BASE_CONTENT_HASH).toBe('c3b02a64fc43c9af0f634c2baaa22fdac78089a4b9850a2229ab8c1d2fe715f5');
  expect(content.hash).toBe('2fe954644f4b3a4d5b20e3d39b83744b9d39761869b325933446145304ba966a');
  expect(JSON.stringify(content)).toBe(raw);expect(JSON.stringify(source.game.state.content)).toBe(raw);
  const state={...source.game.state,content} as GameState;
  expect(unitFor(state,0,'melee','lantern:duelist').damage).toBe(24);
  expect(availableUnits(state,1).some(d=>d.id==='core:orcs-commander')).toBe(false);
  expect(()=>unitFor(state,1,'special','core:orcs-commander')).toThrow('absent');
  expect(()=>unitFor(state,1,'worker','economy:caravan')).toThrow('absent');
  expect(()=>buildingFor(state,1,'depot','economy:warehouse')).toThrow('absent');
  expect(Object.keys(upgradesFor(state,1)).some(id=>id.startsWith('core:'))).toBe(false);
 });
 it('repins only a migrated copy and preserves every existing definition and publication identity',()=>{
  const source=fixture(),raw=JSON.stringify(source.game.state.content),old=decodeHistoricalContentBundle(source.game.state.content),content=migrateHistoricalContentBundle(source.game.state.content);
  expect(content.baseHash).toBe(BASE_CONTENT_HASH);expect(content.engineVersion).toBe(3);expect(CONTENT_ENGINE_VERSION).toBe(3);
  expect(content.packages).toEqual(old.packages);expect(content.packages[0].hash).toBe('4990360f2ca64c5235f67ac69f91bf43b101bb05e9ef90eb47bb0e6aee98f2be');
  for(const side of [0,1] as const){const before={...source.game.state,content:old} as GameState,after={...source.game.state,content} as GameState,research=upgradesFor(after,side);for(const d of availableUnits(before,side))expect(unitFor(after,side,d.role,d.id)).toMatchObject(d);for(const [id,d] of Object.entries(upgradesFor(before,side)))expect(research[id as keyof typeof research]).toMatchObject(d);}
  expect(JSON.stringify(source.game.state.content)).toBe(raw);expect(()=>decodeContentBundle(old)).toThrow('built-in content');
 });
 it('rejects unrecognized snapshots and broken original bundle or package hashes',()=>{
  for(const mutate of [(b:ContentBundle)=>b.baseHash='0'.repeat(64),(b:ContentBundle)=>b.hash='0'.repeat(64),(b:ContentBundle)=>b.packages[0].factions[0].units[0].damage++]){const content=fixture().game.state.content;mutate(content);expect(()=>decodeHistoricalContentBundle(content)).toThrow(/historical|SHA-256/);expect(()=>migrateHistoricalContentBundle(content)).toThrow(/historical|SHA-256/);}
 });
 it('cannot add modern inherited research through an internally consistent historical hash',()=>{
  const content=fixture().game.state.content as ContentBundle,p=content.packages[0];p.factions[0].research[0].requires=['core:ranged-arms'];const {hash:_,...body}=p;p.hash=contentHash(body);resign(content);
  expect(()=>createContentBundle(content.packages)).not.toThrow();
  expect(()=>decodeHistoricalContentBundle(content)).toThrow('missing prerequisite');
 });
});
