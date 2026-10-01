import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { normalizeAiConfig, type AiDifficulty, type AiPersonality } from '../src/core/ai-policy';
import { subscribeSimulation } from '../src/core/history-hooks';
import { loadGame, saveGame } from '../src/core/saves';
import { captureRuntime, createGame, createMatch, issueCommand, refreshVisibility, runAI, stepGame } from '../src/core/simulation';
import type { Command, Entity, GameState, UnitRole } from '../src/core/types';

function advance(s:GameState,seconds:number){for(let tick=0;tick<seconds*20;tick++)stepGame(s,.05);}
function troop(s:GameState,side:0|1,role:UnitRole,x:number,y:number):Entity {
 const def=FACTIONS[s.players[side].faction].units[role],template=s.entities.find(e=>e.side===side&&e.kind==='unit')!;
 const entity:Entity={...structuredClone(template),id:s.nextId++,role,x,y,hp:def.hp,maxHp:def.hp,order:{type:'idle'},queue:[],path:[],shield:def.shield,maxShield:def.shield};s.entities.push(entity);return entity;
}
function battle(difficulty:AiDifficulty='hard') {
 const s=createMatch({map:{seed:4127,size:'medium'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',ai:{difficulty}},{id:1,teamId:1,factionId:'fairies',controller:'external'}],rules:{startingAge:2}});
 s.resources=[];s.terrain.fill('grass');s.players[0].wood=s.players[0].ore=1000;
 const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;refreshVisibility(s);
 expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'barracks',x:13.5,y:8.5})).toBe(true);
 const barracks=s.entities.at(-1)!;barracks.progress=1;barracks.hp=barracks.maxHp;worker.order={type:'idle'};
 return {s,barracks};
}
describe('AI modes in the running simulation',()=>{
 it('starts every difficulty with identical resources, troops, terrain and income',()=>{
  const saves=(['easy','normal','hard'] as const).map(difficulty=>saveGame(createGame('orcs',4127,'fairies',{ai:[{difficulty},{difficulty}]})));
  const withoutConfig=saves.map(save=>{const copy=structuredClone(save);delete (copy.state as Partial<typeof copy.state>).aiConfigs;return copy;});
  expect(withoutConfig[1]).toEqual(withoutConfig[0]);expect(withoutConfig[2]).toEqual(withoutConfig[0]);
  expect(saves.every(save=>save.state.incomeFactors.every(factor=>factor===1))).toBe(true);
 });
 it('uses the same gathering rate when given the same orders at each difficulty',()=>{
  const states=(['easy','normal','hard'] as const).map(difficulty=>createGame('orcs',4127,'orcs',{controllers:['external','external'],ai:[{difficulty},{difficulty}]}));
  for(const s of states){const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,node=s.resources.find(e=>e.kind==='wood')!;worker.x=node.x+1.1;worker.y=node.y;refreshVisibility(s);expect(issueCommand(s,0,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);advance(s,20);}
  expect(states[1].players).toEqual(states[0].players);expect(states[2].players).toEqual(states[0].players);expect(states[0].players[0].wood).toBeGreaterThan(420);
 });
 it('changes real decision cadence and easy hesitation without changing simulation speed',()=>{
  const states=(['easy','normal','hard'] as const).map(difficulty=>createGame('orcs',4127,'fairies',{controllers:['ai','external'],ai:[{difficulty}]}));
  for(const s of states)advance(s,15);
  const turns=states.map(s=>captureRuntime(s).aiDecisionTurns[0]);expect(turns[0]).toBeLessThan(turns[1]);expect(turns[1]).toBeLessThan(turns[2]);
  expect(states.map(s=>s.tick)).toEqual([300,300,300]);expect(turns[0]).toBeGreaterThanOrEqual(5);
 });
 it.each([['rush','barracks'],['expand','depot'],['raid','barracks']] as const)('commits the %s opening to a real %s foundation',(personality,role)=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],ai:[{personality}]});runAI(s,0);
  expect(s.entities.filter(e=>e.side===0&&e.kind==='building'&&e.role!=='hq').map(e=>e.role)).toEqual([role]);
  expect(s.players[0].wood).toBeLessThan(420);
 });
 it('gathers crystal before committing the fortify opening to its first tower',()=>{
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],ai:[{personality:'fortify'}]});
  for(let second=0;second<35&&!s.entities.some(e=>e.side===0&&e.role!=='hq'&&e.kind==='building');second++){runAI(s,0);advance(s,1);}
  expect(s.entities.filter(e=>e.side===0&&e.kind==='building'&&e.role!=='hq').map(e=>e.role)).toEqual(['tower']);
 });
 it('recruits a cavalry counter after scouting and remembers it when the cavalry enters fog',()=>{
  const {s,barracks}=battle();const scout=s.entities.find(e=>e.side===0&&e.role==='melee')!;scout.x=20;scout.y=20;
  const cavalry=troop(s,1,'cavalry',23,20);refreshVisibility(s);runAI(s,0);
  expect(barracks.queue[0]).toBe('spear');expect(captureRuntime(s).knownEnemyUnits[0].some(([id])=>id===cavalry.id)).toBe(true);
  cavalry.x=s.width-5;cavalry.y=s.height-5;refreshVisibility(s);barracks.queue=[];barracks.research=undefined;runAI(s,0);
  expect(barracks.queue[0]).toBe('spear');expect(captureRuntime(s).knownEnemyUnits[0]).toHaveLength(1);
 });
 it('issues identical orders when unobserved armies have different roles and health',()=>{
  const {s}=battle();const hidden=troop(s,1,'cavalry',s.width-5,s.height-5);refreshVisibility(s);const altered=loadGame(saveGame(s)),other=altered.entities.find(e=>e.id===hidden.id)!;other.role='ranged';other.hp=1;
  const orders:Command[][]=[[],[]];[s,altered].forEach((state,i)=>subscribeSimulation(state,{command:(_side,command)=>orders[i].push(command)}));
  runAI(s,0);runAI(altered,0);expect(orders[1]).toEqual(orders[0]);expect(captureRuntime(s).knownEnemyUnits[0]).toEqual([]);
 });
 it('retreats wounded troops, waits for a newly trained reinforcement, then returns them to the army',()=>{
  const {s,barracks}=battle('normal');const fighter=s.entities.find(e=>e.side===0&&e.role==='melee')!;fighter.x=23;fighter.y=20;fighter.hp=fighter.maxHp*.2;
  const hostile=troop(s,1,'melee',25,20);refreshVisibility(s);runAI(s,0);
  expect(fighter.order.type).toBe('move');expect(captureRuntime(s).retreating[0].map(([id])=>id)).toContain(fighter.id);expect(barracks.rally).toBeDefined();
  hostile.x=s.width-5;hostile.y=s.height-5;refreshVisibility(s);
  // Let a real paid recruit complete and reach the same rally point.
  barracks.research=undefined;expect(barracks.queue.length).toBeGreaterThan(0);advance(s,19);runAI(s,0);expect(captureRuntime(s).retreating[0].map(([id])=>id)).toContain(fighter.id);
  advance(s,25);runAI(s,0);
  expect(captureRuntime(s).producedFighters[0]).toBeGreaterThan(0);expect(captureRuntime(s).retreating[0].map(([id])=>id)).not.toContain(fighter.id);
  expect(s.entities.some(e=>e.side===0&&e.role!=='worker'&&e.id!==fighter.id&&Math.hypot(e.x-barracks.rally!.x,e.y-barracks.rally!.y)<3)).toBe(true);
 });
 it('keeps retreating soldiers at the rally when a paid reinforcement dies before regrouping',()=>{
  const {s,barracks}=battle('normal'),fighter=s.entities.find(e=>e.side===0&&e.role==='melee')!;fighter.x=23;fighter.y=20;fighter.hp=1;
  const enemy=troop(s,1,'melee',25,20);refreshVisibility(s);runAI(s,0);enemy.x=s.width-5;enemy.y=s.height-5;refreshVisibility(s);barracks.research=undefined;
  advance(s,41);expect(captureRuntime(s).producedFighters[0]).toBeGreaterThan(0);
  for(const unit of s.entities)if(unit.side===0&&unit.kind==='unit'&&unit.role!=='worker'&&unit.id!==fighter.id)unit.hp=0;
  barracks.queue=[];runAI(s,0);expect(captureRuntime(s).retreating[0].map(([id])=>id)).toContain(fighter.id);
 });
 it('withdraws from a visible outnumbered fight while ignoring a large hidden army',()=>{
  const {s}=battle();const fighter=s.entities.find(e=>e.side===0&&e.role==='melee')!;fighter.x=23;fighter.y=20;
  for(let i=0;i<5;i++)troop(s,1,'melee',25+i*.4,20);
  refreshVisibility(s);runAI(s,0);expect(captureRuntime(s).retreating[0].map(([id])=>id)).toContain(fighter.id);
 });
 it('preserves configured modes, observed armies, retreat decisions and future cadence through saving',()=>{
  const {s}=battle();const fighter=s.entities.find(e=>e.side===0&&e.role==='melee')!;fighter.x=23;fighter.y=20;fighter.hp=1;troop(s,1,'cavalry',25,20);refreshVisibility(s);runAI(s,0);
  const loaded=loadGame(saveGame(s));expect(saveGame(loaded)).toEqual(saveGame(s));
  for(let tick=0;tick<160;tick++){stepGame(s,.05);stepGame(loaded,.05);expect(saveGame(loaded)).toEqual(saveGame(s));}
 });
});
