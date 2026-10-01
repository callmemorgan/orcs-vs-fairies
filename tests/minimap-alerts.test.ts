import { describe, expect, it } from 'vitest';
import { createGame, stepGame } from '../src/core/simulation';
import type { Entity, GameState } from '../src/core/types';
import { MinimapAlerts } from '../src/ui/MinimapAlerts';

function fixture(){const state=createGame('orcs',4127,'fairies',{controllers:['external','external']});state.events=[];const own=state.entities.find(e=>e.side===0&&e.role==='hq')!,enemy=state.entities.find(e=>e.side===1&&e.role==='melee')!;return {state,own,enemy,alerts:new MinimapAlerts()};}
function advance(state:GameState,time:number){state.time=time;state.tick=Math.round(time*20);state.events=[];}
function show(state:GameState,entity:Entity){const index=Math.floor(entity.y)*state.width+Math.floor(entity.x);state.visible[0].add(index);state.explored[0].add(index);}

describe('fog-safe minimap alerts',()=>{
  it('does not inspect hidden raiders or unrelated hidden production',()=>{
    const {state,own,enemy,alerts}=fixture();enemy.x=own.x+2;enemy.y=own.y;
    state.visible[0].delete(Math.floor(enemy.y)*state.width+Math.floor(enemy.x));
    state.events=[{type:'train',side:1,x:enemy.x,y:enemy.y,source:enemy.id}];
    expect(alerts.update(state,0)).toEqual([]);
  });
  it('shows hidden-attacker damage at the owned target, never event coordinates',()=>{
    const {state,own,enemy,alerts}=fixture();state.time=3;state.tick=60;
    state.events=[{type:'attack',side:1,x:enemy.x,y:enemy.y,source:enemy.id,target:own.id}];
    const markers=alerts.update(state,0);
    expect(markers).toEqual([expect.objectContaining({kind:'raid',entity:own.id,x:own.x,y:own.y})]);
    expect(markers.some(a=>a.x===enemy.x&&a.y===enemy.y)).toBe(false);
    advance(state,10.99);expect(alerts.update(state,0).some(a=>a.kind==='raid')).toBe(true);
    advance(state,11);expect(alerts.update(state,0).some(a=>a.kind==='raid')).toBe(false);
  });
  it('uses actual combat damage even when polling missed the attack event',()=>{
    const {state,own,enemy,alerts}=fixture();enemy.x=own.x+1;enemy.y=own.y;enemy.order={type:'attack',target:own.id};
    for(let tick=0;tick<6;tick++)stepGame(state,.05);
    expect(own.lastDamagedAt).toBeDefined();expect(own.hp).toBeLessThan(own.maxHp);
    state.events=[];
    expect(alerts.update(state,0)).toContainEqual(expect.objectContaining({kind:'raid',entity:own.id,x:own.x,y:own.y}));
  });
  it('marks visible raiders and removes their location immediately after losing vision',()=>{
    const {state,own,enemy,alerts}=fixture();enemy.x=own.x+2;enemy.y=own.y;show(state,enemy);
    expect(alerts.update(state,0)).toContainEqual(expect.objectContaining({kind:'raid',entity:enemy.id}));
    state.visible[0].delete(Math.floor(enemy.y)*state.width+Math.floor(enemy.x));state.tick++;
    expect(alerts.update(state,0).some(a=>a.entity===enemy.id)).toBe(false);
    expect(alerts.current.some(a=>a.kind==='raid')).toBe(false);
  });
  it('marks an attacked expansion using its known position',()=>{
    const {state,own,alerts}=fixture();const expansion={...structuredClone(own),id:state.nextId++,role:'depot' as const,x:own.x+12};state.entities.push(expansion);expansion.lastDamagedAt=state.time;
    expect(alerts.update(state,0)).toContainEqual(expect.objectContaining({kind:'expansion',x:expansion.x,y:expansion.y}));
  });
  it('delays idle recruitment and clears it on recruiting, research or destruction',()=>{
    const {state,own,alerts}=fixture();alerts.update(state,0);advance(state,11.99);expect(alerts.update(state,0).some(a=>a.kind==='idle')).toBe(false);
    advance(state,12);expect(alerts.update(state,0)).toContainEqual(expect.objectContaining({kind:'idle',entity:own.id}));
    own.queue=['worker'];expect(alerts.update(state,0).some(a=>a.entity===own.id)).toBe(false);
    own.queue=[];alerts.update(state,0);advance(state,24);own.research='worker-speed';expect(alerts.update(state,0).some(a=>a.entity===own.id)).toBe(false);
    own.research=undefined;alerts.update(state,0);advance(state,36);own.hp=0;expect(alerts.update(state,0).some(a=>a.entity===own.id)).toBe(false);
  });
  it('never discloses teammate production and hides teammate threat outside vision',()=>{
    const {state,enemy,alerts}=fixture();const alliedState=state as GameState&{teams:number[]};alliedState.teams=[0,0];enemy.lastDamagedAt=state.time;
    const enemyHQ=state.entities.find(e=>e.side===1&&e.role==='hq')!;
    alerts.update(alliedState,0);advance(state,12);
    expect(alerts.update(alliedState,0).some(a=>a.entity===enemy.id||a.entity===enemyHQ.id)).toBe(false);
    show(state,enemy);show(state,enemyHQ);enemy.lastDamagedAt=state.time;
    expect(alerts.update(alliedState,0).some(a=>a.entity===enemy.id)).toBe(false);
    expect(alerts.current.some(a=>a.kind==='idle'&&a.entity===enemyHQ.id)).toBe(false);
  });
  it('does not reveal hidden allied damage history on first sight',()=>{
    const {state,alerts}=fixture();const alliedState=state as GameState&{teams:number[]};alliedState.teams=[0,0];
    const ally=state.entities.find(e=>e.side===1&&e.role==='hq')!;
    alerts.update(alliedState,0);advance(state,12);ally.lastDamagedAt=11;show(state,ally);
    const before=structuredClone(alerts.update(alliedState,0));delete ally.lastDamagedAt;
    expect(alerts.update(alliedState,0)).toEqual(before);expect(before.some(a=>a.entity===ally.id)).toBe(false);
  });
  it('resets timers after replay rewind, perspective switch and new match',()=>{
    const {state,alerts}=fixture();alerts.update(state,0);advance(state,13);expect(alerts.update(state,0).some(a=>a.kind==='idle')).toBe(true);
    advance(state,1);expect(alerts.update(state,0).some(a=>a.kind==='idle')).toBe(false);
    advance(state,20);expect(alerts.update(state,1).some(a=>a.kind==='idle')).toBe(false);
    state.seed++;advance(state,40);expect(alerts.update(state,1).some(a=>a.kind==='idle')).toBe(false);
  });
});
