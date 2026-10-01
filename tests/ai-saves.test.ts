import { describe, expect, it } from 'vitest';
import { loadGame, MAX_SAVE_BYTES, SAVE_VERSION, saveGame } from '../src/core/saves';
import { captureRuntime, createGame, createMatch, runAI, stepGame } from '../src/core/simulation';

const aiFields=['aiDecisionAt','aiDecisionTurns','knownEnemyUnits','retreating','producedFighters'] as const;
function match(){return createGame('orcs',4127,'fairies',{controllers:['external','external']});}
describe('AI save version 3',()=>{
 it('migrates a complete version 2 snapshot after validating the original schema',()=>{
  const state=match();for(let tick=0;tick<100;tick++)stepGame(state,.05);const save:any=saveGame(state);save.version=2;for(const key of ['rules','objectives','draft'])delete save.state[key];delete save.state.aiConfigs;delete save.runtime.aiBatchTurns;for(const key of aiFields)delete save.runtime[key];
  const before=structuredClone(save),loaded=loadGame(save);expect(save).toEqual(before);expect(saveGame(loaded).version).toBe(SAVE_VERSION);expect(loaded.aiConfigs).toEqual([{difficulty:'normal',personality:'balanced',opening:'infantry-rush'},{difficulty:'normal',personality:'balanced',opening:'infantry-rush'}]);
  expect(captureRuntime(loaded).aiDecisionAt).toEqual([state.time,state.time]);expect(captureRuntime(loaded).knownEnemyUnits).toEqual([[],[]]);expect(loaded.entities).toEqual(state.entities);
  const corrupted=structuredClone(save);delete corrupted.runtime.knownEnemyBuildings;expect(()=>loadGame(corrupted)).toThrow(/missing field/);
 });
 it('checks the byte limit again after a valid legacy migration adds AI fields',()=>{
  const save:any=saveGame(match());save.version=2;for(const key of ['rules','objectives','draft'])delete save.state[key];delete save.state.aiConfigs;delete save.runtime.aiBatchTurns;for(const key of aiFields)delete save.runtime[key];
  const event={type:'message',x:0,y:0,side:0,text:''},full={...event,text:'一'.repeat(4000)};
  const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength,target=MAX_SAVE_BYTES-64;
  const count=Math.floor((target-bytes(save))/(bytes(full)+1));save.state.events=Array.from({length:count},()=>({...full}));
  let remaining=target-bytes(save);if(remaining<bytes(event)+1){save.state.events.pop();remaining=target-bytes(save);}
  const textBytes=remaining-bytes(event)-1;save.state.events.push({...event,text:'一'.repeat(Math.floor(textBytes/3))+'x'.repeat(textBytes%3)});
  expect(bytes(save)).toBe(target);expect(()=>loadGame(save)).toThrow(/size limit/);
  // The original schema is valid; leaving room for the added fields permits loading and saving.
  save.state.events.at(-1).text=save.state.events.at(-1).text.slice(0,-1500);const loaded=loadGame(save);expect(()=>saveGame(loaded)).not.toThrow();
 },10000);
 it('validates per-player configuration on construction and saving',()=>{
  expect(()=>createMatch({map:{seed:1},players:[{id:0,teamId:0,factionId:'orcs',controller:'ai',ai:{difficulty:'impossible' as 'hard'}}]})).toThrow(/difficulty/);
  expect(()=>createGame('orcs',1,'fairies',{ai:[{incomeFactor:2} as never]})).toThrow(/configuration/);
  const save:any=saveGame(match());save.state.aiConfigs[1].difficulty='impossible';expect(()=>loadGame(save)).toThrow(/difficulty/);
 });
 it.each(['aiConfigs',...aiFields])('rejects wrong per-player array length in %s',field=>{
  const save:any=saveGame(match());(field==='aiConfigs'?save.state:save.runtime)[field].pop();expect(()=>loadGame(save)).toThrow(/array length/);
 });
 it.each([
  ['future observation',(save:any):unknown=>save.runtime.knownEnemyUnits[0]=[[2,{role:'cavalry',x:1,y:1,seenAt:1,hpFraction:1}]]],
  ['worker observation',(save:any):unknown=>save.runtime.knownEnemyUnits[0]=[[2,{role:'worker',x:1,y:1,seenAt:0,hpFraction:1}]]],
  ['invalid health',(save:any):unknown=>save.runtime.knownEnemyUnits[0]=[[2,{role:'cavalry',x:1,y:1,seenAt:0,hpFraction:2}]]],
  ['future decision',(save:any):unknown=>save.runtime.aiDecisionAt[0]=10],
  ['negative produced fighters',(save:any):unknown=>save.runtime.producedFighters[0]=-1],
  ['future retreat',(save:any):unknown=>save.runtime.retreating[0]=[[2,{until:100,produced:0,afterId:2}]]],
  ['unknown config property',(save:any):unknown=>save.state.aiConfigs[0].woodBonus=2],
  ['missing observations',(save:any):unknown=>delete save.runtime.knownEnemyUnits],
 ] as const)('rejects %s without changing the supplied envelope',(_name,mutate)=>{
  const save=saveGame(match());mutate(save);const before=structuredClone(save);expect(()=>loadGame(save)).toThrow();expect(save).toEqual(before);
 });
 it('does not share observed-memory maps or configuration objects after restoration',()=>{
  const state=match();const enemy=state.entities.find(e=>e.side===1&&e.role==='melee')!;enemy.x=12;enemy.y=10;const cell=Math.floor(enemy.y)*state.width+Math.floor(enemy.x);state.visible[0].add(cell);state.explored[0].add(cell);runAI(state,0);
  const save=saveGame(state),loaded=loadGame(save);loaded.aiConfigs[0].difficulty='easy';save.runtime.knownEnemyUnits[0][0][1].role='cavalry';
  expect(state.aiConfigs[0].difficulty).toBe('normal');expect(captureRuntime(loaded).knownEnemyUnits[0][0][1].role).toBe('melee');
 });
});
