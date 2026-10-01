import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { aiProfile, chooseAiRecruit, counterWeights, normalizeAiConfig, openingBuilding, rememberObservedUnits, shouldRetreat, skipsAiDecision } from '../src/core/ai-policy';
import { createGame } from '../src/core/simulation';
import type { Entity } from '../src/core/types';

const config=normalizeAiConfig();
function troop(role:Entity['role']='melee',id=1):Entity {return {...createGame('orcs').entities.find(e=>e.role==='melee')!,id,role,x:20,y:20,hp:100,maxHp:100};}
describe('AI decisions using supplied observations',()=>{
 it('normalizes choices without introducing economic factors',()=>{
  expect(normalizeAiConfig({personality:'expand'})).toEqual({difficulty:'normal',personality:'expand',opening:'fast-expansion'});
  expect(()=>normalizeAiConfig({difficulty:'impossible' as 'hard'})).toThrow();
  for(const difficulty of ['easy','normal','hard'] as const){const p=aiProfile(normalizeAiConfig({difficulty}));expect(Object.keys(p).some(k=>/income|resource|damage/i.test(k))).toBe(false);}
  expect(aiProfile(normalizeAiConfig({difficulty:'hard'})).decisionInterval).toBeLessThan(aiProfile(config).decisionInterval);
  expect(aiProfile(normalizeAiConfig({difficulty:'easy'})).decisionInterval).toBeGreaterThan(aiProfile(config).decisionInterval);
 });
 it('makes easy opponents miss a predictable decision while other levels keep responding',()=>{
  expect(skipsAiDecision(normalizeAiConfig({difficulty:'easy'}),5)).toBe(true);
  expect(skipsAiDecision(config,5)).toBe(false);
  expect(skipsAiDecision(normalizeAiConfig({difficulty:'hard'}),5)).toBe(false);
 });
 it('offers different opening building commitments',()=>{
  expect(openingBuilding(normalizeAiConfig({personality:'rush'}),['hq'])).toBe('barracks');
  expect(openingBuilding(normalizeAiConfig({personality:'fortify'}),['hq'])).toBe('tower');
  expect(openingBuilding(normalizeAiConfig({personality:'expand'}),['hq'])).toBe('depot');
  expect(openingBuilding(normalizeAiConfig({personality:'expand'}),['hq','depot'])).toBe('barracks');
 });
 it('learns visible enemy cavalry and chooses spears, then forgets stale sightings',()=>{
  const memory=new Map();rememberObservedUnits(memory,[troop('cavalry',99)],10);
  const weights=counterWeights(FACTIONS.orcs,normalizeAiConfig({difficulty:'hard'}),memory.values());
  expect(chooseAiRecruit(['melee','ranged','spear'],[],weights)).toBe('spear');
  rememberObservedUnits(memory,[],60);expect(memory.size).toBe(1);
  rememberObservedUnits(memory,[],61);expect(memory.size).toBe(1);
  rememberObservedUnits(memory,[troop('cavalry',99)],70);
  rememberObservedUnits(memory,[],161);expect(memory.size).toBe(0);
 });
 it('does not learn workers or illusions as fighting forces',()=>{
  const memory=new Map();rememberObservedUnits(memory,[troop('worker',98),{...troop('cavalry',99),illusion:true}],10);expect(memory.size).toBe(0);
 });
 it('keeps easy opponents on their opening composition after enemy sightings',()=>{
  expect(counterWeights(FACTIONS.orcs,normalizeAiConfig({difficulty:'easy'}),[{role:'cavalry',seenAt:0,hpFraction:1,x:20,y:20}])).toEqual(counterWeights(FACTIONS.orcs,normalizeAiConfig({difficulty:'easy'}),[]));
 });
 it('retreats a wounded fighter only when enemies are seen and regroups when outnumbered',()=>{
  const unit={...troop(),hp:20};expect(shouldRetreat(config,unit,[unit],[])).toBe(false);
  expect(shouldRetreat(config,unit,[unit],[troop('melee',99)])).toBe(true);
  const healthy=troop();expect(shouldRetreat(config,healthy,[healthy],[troop('melee',98),troop('melee',99)])).toBe(true);
  expect(shouldRetreat(config,healthy,[healthy,troop('melee',2)],[troop('melee',99)])).toBe(false);
 });
});
