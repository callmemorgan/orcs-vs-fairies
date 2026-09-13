import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, isVisible } from '../src/core/simulation';
import { walkable } from '../src/core/navigation';
import { abilityTargetReason } from '../src/ui/availability';
import type { FactionId } from '../src/core/types';

function casterGame(faction:FactionId){
  const state=createGame(faction,4127,'fairies',{controllers:['external','external']});
  const caster=state.entities.find(e=>e.side===0&&e.role==='melee')!;
  caster.role='special';
  return {state,caster};
}
describe('target explanations agree with actual ability commands',()=>{
  it('blocks a ward with no damaged shields, then accepts it after shield damage',()=>{
    const {state,caster}=casterGame('automata');
    expect(abilityTargetReason(state,[caster])).toBe('Nearby shields are full');
    expect(issueCommand(state,0,{type:'ability',ids:[caster.id]})).toBe(false);
    caster.shield=0;
    expect(abilityTargetReason(state,[caster])).toBe('');
    expect(issueCommand(state,0,{type:'ability',ids:[caster.id]})).toBe(true);
    expect(caster.shield).toBe(24);
  });
  it('requires a reachable visible corpse and free supply for raising',()=>{
    const {state,caster}=casterGame('undead');
    expect(abilityTargetReason(state,[caster])).toMatch(/No usable corpses/);
    expect(issueCommand(state,0,{type:'ability',ids:[caster.id]})).toBe(false);
    const points=[...state.visible[0]].map(i=>({x:i%state.width+.5,y:Math.floor(i/state.width)+.5}));
    const point=points.find(p=>Math.hypot(p.x-caster.x,p.y-caster.y)<=6&&walkable(state,p.x,p.y)&&isVisible(state,0,p.x,p.y))!;
    expect(point).toBeDefined();
    state.corpses.push({...point,id:9000,expires:30});
    const originalIds=new Set(state.entities.map(e=>e.id));
    const worker=state.entities.find(e=>e.side===0&&e.role==='worker')!;
    for(let i=0;i<6;i++)state.entities.push({...structuredClone(worker),id:state.nextId++});
    state.players[0].population=12;
    expect(abilityTargetReason(state,[caster])).toMatch(/supply/);
    expect(issueCommand(state,0,{type:'ability',ids:[caster.id]})).toBe(false);
    state.entities=state.entities.filter(e=>originalIds.has(e.id));state.players[0].population=6;
    expect(abilityTargetReason(state,[caster])).toBe('');
    expect(issueCommand(state,0,{type:'ability',ids:[caster.id]})).toBe(true);
    expect(state.entities.some(e=>e.raised)).toBe(true);
  });
  it('allows a full-health Tidecaller because surge also boosts movement',()=>{
    const {state,caster}=casterGame('tideborn');
    expect(abilityTargetReason(state,[caster])).toBe('');
    expect(issueCommand(state,0,{type:'ability',ids:[caster.id]})).toBe(true);
    expect(caster.surgeUntil).toBe(6);
  });
});
