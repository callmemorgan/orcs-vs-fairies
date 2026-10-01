import { describe, expect, it } from 'vitest';
import { createGame, captureRuntime, restoreRuntime, refreshVisibility, runAI, stepGame } from '../src/core/simulation';
import { subscribeSimulation } from '../src/core/history-hooks';
import { loadGame, saveGame } from '../src/core/saves';
import type { Command, Entity, FactionId, GameState } from '../src/core/types';

function stranded(faction:FactionId='orcs'):GameState {
 const s=createGame(faction,4127,'fairies',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];s.time=100;
 s.entities=s.entities.filter(e=>e.kind==='building'||e.side===0&&e.role==='melee');s.players[0].wood=22;s.players[0].ore=400;s.players[0].crystal=60;s.players[0].population=1;
 const fighter=s.entities.find(e=>e.role==='melee')!;fighter.hp=1;fighter.x=11;fighter.y=11;
 const r=captureRuntime(s);r.retreating[0]=[[fighter.id,{until:80,produced:0,afterId:s.nextId-1}]];restoreRuntime(s,r);refreshVisibility(s);return s;
}
function fighter(s:GameState):Entity {return s.entities.find(e=>e.side===0&&e.role==='melee')!;}
function woodSupply(s:GameState):void {const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;s.resources.push({id:s.nextId++,x:hq.x+2,y:hq.y+2,kind:'wood',amount:1000,maxAmount:1000});refreshVisibility(s);}
describe('AI recovery after losing its economy',()=>{
 it('uses its surviving fighter when it has no worker, worker funds or paid worker queue',()=>{
  const s=stranded(),before=structuredClone(s.players[0]);runAI(s,0);expect(captureRuntime(s).retreating[0]).toEqual([]);expect(fighter(s).order.type).toBe('attackMove');expect(s.players[0]).toEqual(before);
 });
 it('releases an expired retreat from its actual position even when it never reached the rally',()=>{
  const s=stranded();fighter(s).x=20;fighter(s).y=18;refreshVisibility(s);runAI(s,0);expect(fighter(s).order.type).toBe('attackMove');expect(captureRuntime(s).retreating[0]).toEqual([]);
 });
 it('does not make a final assault before the existing retreat deadline',()=>{
  const s=stranded(),r=captureRuntime(s);r.retreating[0][0][1].until=110;restoreRuntime(s,r);runAI(s,0);expect(captureRuntime(s).retreating[0]).toHaveLength(1);expect(fighter(s).order.type).toBe('idle');
 });
 it('does not abandon the ordinary recovery path when a worker can be afforded',()=>{
  const s=stranded();s.players[0].wood=50;woodSupply(s);runAI(s,0);expect(s.entities.find(e=>e.side===0&&e.role==='hq')!.queue).toContain('worker');expect(captureRuntime(s).retreating[0]).toHaveLength(1);expect(fighter(s).order.type).toBe('idle');
 });
 it('waits for a paid worker and keeps a live worker economy on normal regrouping rules',()=>{
  for(const queued of [true,false]){
   const s=stranded();woodSupply(s);if(queued)s.entities.find(e=>e.side===0&&e.role==='hq')!.queue=['worker'];else s.entities.push({...structuredClone(fighter(s)),id:s.nextId++,role:'worker',hp:85,maxHp:85});
   runAI(s,0);expect(captureRuntime(s).retreating[0]).toHaveLength(1);expect(fighter(s).order.type).toBe('idle');
  }
 });
 it('uses its army when surviving workers only have non-wood income',()=>{
  const s=stranded();s.entities.push({...structuredClone(fighter(s)),id:s.nextId++,role:'worker',hp:85,maxHp:85});const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;s.resources.push({id:s.nextId++,x:hq.x+2,y:hq.y+2,kind:'ore',amount:1000,maxAmount:1000});refreshVisibility(s);
  runAI(s,0);expect(captureRuntime(s).retreating[0]).toEqual([]);expect(fighter(s).order.type).toBe('attackMove');expect(s.players[0].wood).toBe(22);
 });
 it('does not count hidden wood deposits as a source of future reinforcements',()=>{
  const s=stranded();s.entities.push({...structuredClone(fighter(s)),id:s.nextId++,role:'worker',hp:85,maxHp:85});s.resources.push({id:s.nextId++,x:40,y:40,kind:'wood',amount:1000,maxAmount:1000});refreshVisibility(s);
  runAI(s,0);expect(captureRuntime(s).retreating[0]).toEqual([]);expect(fighter(s).order.type).toBe('attackMove');
 });
 it('keeps regrouping while an owned worker carries wood home',()=>{
  const s=stranded();s.entities.push({...structuredClone(fighter(s)),id:s.nextId++,role:'worker',hp:85,maxHp:85,carried:18,carriedKind:'wood'});runAI(s,0);expect(captureRuntime(s).retreating[0]).toHaveLength(1);
 });
 it('waits for a completing paid fighter even without another source of wood',()=>{
  const s=stranded(),hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;s.entities.push({...structuredClone(hq),id:s.nextId++,role:'barracks',queue:['melee'],x:hq.x+4});runAI(s,0);expect(captureRuntime(s).retreating[0]).toHaveLength(1);expect(fighter(s).order.type).toBe('idle');
 });
 it('counts a fighter paid for by the same decision before deciding to abandon regrouping',()=>{
  const s=stranded('undead'),soldier=fighter(s),hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;soldier.role='ranged';s.players[0].wood=45;const barracks={...structuredClone(hq),id:s.nextId++,role:'barracks' as const,queue:[],x:hq.x+4};s.entities.push(barracks);
  runAI(s,0);expect(barracks.queue).toEqual(['melee']);expect(s.players[0].wood).toBe(0);expect(captureRuntime(s).retreating[0]).toHaveLength(1);expect(soldier.order.type).toBe('idle');
 });
 it('includes a lone expansion scout in an emergency attack rather than excluding the only fighter',()=>{
  const s=stranded(),r=captureRuntime(s);r.expansionScout[0]=fighter(s).id;r.expansionScoutDispatched[0]=true;fighter(s).order={type:'move',x:20,y:20};restoreRuntime(s,r);runAI(s,0);expect(fighter(s).order.type).toBe('attackMove');
 });
 it('does not retreat from first visible contact solely because its last fighter has low health',()=>{
  const s=stranded();runAI(s,0);fighter(s).x=20;fighter(s).y=20;
  const enemy={...structuredClone(fighter(s)),id:s.nextId++,side:1 as const,x:23,y:20,hp:100,maxHp:100,order:{type:'hold' as const}};s.entities.push(enemy);refreshVisibility(s);runAI(s,0);expect(captureRuntime(s).retreating[0]).toEqual([]);expect(fighter(s).order.type).toBe('attackMove');
 });
 it('bases the final-assault decision on its own economy rather than hidden enemy roles or banks',()=>{
  const s=stranded(),other=loadGame(saveGame(s));other.players[1].wood=10000;other.players[1].ore=10000;const ownTemplate=fighter(other);other.entities.push({...structuredClone(ownTemplate),id:other.nextId++,side:1,role:'cavalry',x:40,y:40,hp:210,maxHp:210});refreshVisibility(other);
  const commands:Command[][]=[[],[]];[s,other].forEach((state,i)=>subscribeSimulation(state,{command:(_side,c)=>commands[i].push(c)}));runAI(s,0);runAI(other,0);expect(commands[1]).toEqual(commands[0]);
 });
 it('restores the same recovery decisions and ordinary attacks after saving',()=>{
  const s=stranded();s.controllers[0]='ai';const other=loadGame(saveGame(s));for(let tick=0;tick<200;tick++){stepGame(s,.05);stepGame(other,.05);expect(saveGame(other)).toEqual(saveGame(s));}
 });
});
