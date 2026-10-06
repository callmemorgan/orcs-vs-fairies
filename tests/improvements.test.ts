import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerGameImprovement } from '../src/core/improvements';
import { createGame, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { PlayerView } from '../src/core/observation';
import { TerminalSession } from '../src/cli/session';
import type { JsonValue } from '../src/core/types';

const cleanup:Array<()=>void>=[];
afterEach(()=>{for(const dispose of cleanup.splice(0))dispose();});
function register(){
  const apply=vi.fn((_game,_side,_command,state)=>{state.count++;return true;});
  cleanup.push(registerGameImprovement({id:'test-counter',initialState:()=>({count:0}),validate:(_game,_side,command)=>command.action==='increment',command:apply,step:(_game,dt,state)=>{(state as {count:number}).count+=dt;},observe:(_game,_side,state)=>state}));
  return apply;
}
const options={controllers:['external','external'] as const,improvements:{'test-counter':{enabled:true}}};
function game(enabled=true){return createGame('orcs',4127,'fairies',{controllers:[...options.controllers],...(enabled?{improvements:options.improvements}:{})});}
describe('optional headless rules',()=>{
  it('leaves registration disabled until match options enable the rule',()=>{
    register();const plain=game(false),enabled=game();
    expect(plain.improvements).toBeUndefined();stepGame(plain,.05);
    expect(plain.improvements).toBeUndefined();
    expect(enabled.improvements?.['test-counter'].options).toEqual({enabled:true});
    stepGame(enabled,1);
    expect(enabled.improvements?.['test-counter'].state).toEqual({count:.25});
    expect(options.improvements).toEqual({'test-counter':{enabled:true}});
  });
  it('checks activation, ownership and the rule validator before applying a command',()=>{
    const apply=register(),s=game(),owned=s.entities.find(e=>e.side===0)!,enemy=s.entities.find(e=>e.side===1)!;
    const command={type:'improvement' as const,improvement:'test-counter',action:'increment',ids:[owned.id]};
    expect(issueCommand(game(false),0,command)).toBe(false);
    expect(issueCommand(s,0,{...command,ids:[enemy.id]})).toBe(false);
    expect(issueCommand(s,0,{...command,action:'unknown'})).toBe(false);
    expect(issueCommand(s,0,{...command,payload:NaN})).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(issueCommand(s,0,command)).toBe(true);
    s.winner=0;
    expect(issueCommand(s,0,command)).toBe(false);stepGame(s,.05);
    expect(s.improvements?.['test-counter'].state).toEqual({count:1});
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it('keeps feature state serializable and requires an explicit observed-state hook',()=>{
    register();cleanup.push(registerGameImprovement({id:'test-private',initialState:()=>({secret:123})}));
    const s=game();s.improvements!['test-private']={options:null,state:{secret:123}};
    const saved=JSON.parse(JSON.stringify(s.improvements));
    expect(saved).toEqual(s.improvements);
    const observation=new PlayerView(0).observe(s);
    expect(observation.improvements).toEqual({'test-counter':{count:0}});
    (observation.improvements!['test-counter'] as {count:number}).count=99;
    expect(s.improvements!['test-counter'].state).toEqual({count:0});
  });
  it('accepts opted-in feature commands through the terminal and reproduces state',()=>{
    register();const session=new TerminalSession();
    session.handle({op:'start',side:0,seed:4127,improvements:options.improvements});
    session.handle({op:'command',command:{type:'improvement',improvement:'test-counter',action:'increment',ids:[]}});
    expect(session.state?.improvements?.['test-counter'].state).toEqual({count:1});
    expect(()=>session.handle({op:'command',command:{type:'improvement',improvement:'test-counter',action:'increment',ids:[],payload:Infinity}})).toThrow('Malformed command');
    expect(()=>session.handle({op:'command',command:{type:'improvement',improvement:'test-counter',action:'increment',ids:[],extra:true}})).toThrow('Malformed command');
  });
  it('rejects non-JSON initial state',()=>{
    cleanup.push(registerGameImprovement({id:'test-bad',initialState:()=>new Set() as unknown as JsonValue}));
    expect(()=>createGame('orcs',4127,'fairies',{improvements:{'test-bad':null}})).toThrow('state must be JSON');
  });
});

it('uses the same rule order and state hash for reordered browser and terminal options',async()=>{
  const {stateHash}=await import('../src/cli/session');
  const calls:string[]=[];
  for(const id of ['order-z','order-a'])cleanup.push(registerGameImprovement({id,initialState:()=>null,start:()=>{calls.push(`start:${id}`);},step:()=>{calls.push(`step:${id}`);},observe:()=>{calls.push(`observe:${id}`);return null;}}));
  const first=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'order-z':null,'order-a':null}});
  const second=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'order-a':null,'order-z':null}});
  expect(calls).toEqual(['start:order-a','start:order-z','start:order-a','start:order-z']);
  expect(stateHash(first)).toBe(stateHash(second));
  first.improvements={'order-z':first.improvements!['order-z'],'order-a':first.improvements!['order-a']};
  calls.length=0;stepGame(first,.05);new PlayerView(0).observe(first);
  expect(calls).toEqual(['step:order-a','step:order-z','observe:order-a','observe:order-z']);
});

it('records the final HQ death in the accepted tick and rejects ticks after completion',()=>{
  cleanup.push(registerGameImprovement({id:'final-events',initialState:()=>({ticks:0,deaths:[],winner:null}),step:(s,_dt,state)=>{
    const saved=state as {ticks:number;deaths:number[];winner:number|null};saved.ticks++;saved.winner=s.winner;
    saved.deaths.push(...s.events.filter(e=>e.type==='death').map(e=>e.source!));
  }}));
  const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'final-events':null}});
  const attacker=s.entities.find(e=>e.side===0&&e.role==='melee')!,hq=s.entities.find(e=>e.side===1&&e.role==='hq')!;
  attacker.x=hq.x+2;attacker.y=hq.y;hq.hp=1;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'attack',ids:[attacker.id],target:hq.id})).toBe(true);
  stepGame(s,.05);
  expect(s.winner).toBe(0);expect(hq.hp).toBe(0);
  expect(s.improvements!['final-events'].state).toEqual({ticks:1,deaths:[hq.id],winner:0});
  const tick=s.tick,time=s.time;stepGame(s,.05);
  expect(s.tick).toBe(tick);expect(s.time).toBe(time);
  expect(s.improvements!['final-events'].state).toEqual({ticks:1,deaths:[hq.id],winner:0});
});
it('rejects sparse array options, initial state and custom command payloads before mutation',()=>{
  const apply=register(),hole=Array<JsonValue>(2);hole[1]=1;
  expect(()=>createGame('orcs',4127,'fairies',{improvements:{'test-counter':{nested:hole}}})).toThrow('options must be JSON');
  cleanup.push(registerGameImprovement({id:'sparse-state',initialState:()=>hole}));
  expect(()=>createGame('orcs',4127,'fairies',{improvements:{'sparse-state':null}})).toThrow('state must be JSON');
  const s=game();
  expect(issueCommand(s,0,{type:'improvement',improvement:'test-counter',action:'increment',ids:[],payload:hole})).toBe(false);
  expect(apply).not.toHaveBeenCalled();expect(s.improvements!['test-counter'].state).toEqual({count:0});
  expect(issueCommand(s,0,{type:'improvement',improvement:'test-counter',action:'increment',ids:[],payload:[null,1]})).toBe(true);
  expect(s.improvements!['test-counter'].state).toEqual({count:1});
});
