import { expect, it } from 'vitest';
import { TerminalSession, replayMatch } from '../src/cli/session';
import { FACTIONS } from '../src/core/content';
import { PlayerView } from '../src/core/observation';
import { createGame, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { Entity } from '../src/core/types';
const result=(s:TerminalSession,input:unknown)=>(s.handle(input) as {result:any}).result;
it('starts the computer side externally and returns only its visible player state',()=>{
 const s=new TerminalSession(),o=result(s,{op:'start',faction:'automata',opponent:'tideborn',seed:991,mapSize:'small'});
 expect(o.side).toBe(1);expect(o.controller).toBe('external');expect(o.player.faction).toBe('automata');expect(s.state!.controllers).toEqual(['ai','external']);
 expect(o.entities.every((e:Entity)=>e.side===1)).toBe(true);expect(o.map.terrain).toContain(null);expect(o.resources.length).toBeLessThan(s.state!.resources.length);
 expect(o.opponent).not.toHaveProperty('wood');expect(o).not.toHaveProperty('players');expect(o.entities[0]).not.toHaveProperty('path');
});
it('does not expose hidden enemy orders, economy or production when the enemy becomes visible',()=>{
 const s=createGame('automata',4127,'tideborn',{controllers:['external','external']}),view=new PlayerView(0),scout=s.entities.find(e=>e.side===0&&e.role==='melee')!,hq=s.entities.find(e=>e.side===1&&e.role==='hq')!;
 scout.x=hq.x-3;scout.y=hq.y;hq.queue=['worker'];hq.trainProgress=.42;refreshVisibility(s);
 const observation=view.observe(s),enemy=observation.entities.find(e=>e.id===hq.id)!;
 expect(enemy).toBeDefined();for(const hidden of ['queue','trainProgress','order','path','cooldown','carried'])expect(enemy).not.toHaveProperty(hidden);
 expect(observation.opponent).toEqual({side:1,faction:'tideborn'});
});
it('remembers only the last visible resource amount and refreshes it on rediscovery',()=>{
 const s=createGame('orcs'),view=new PlayerView(0),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,node=s.resources.find(r=>r.x<15&&r.kind==='wood')!;
 worker.x=node.x+1;worker.y=node.y;refreshVisibility(s);let r=view.observe(s).resources.find(r=>r.id===node.id)!;expect(r.visible).toBe(true);const seenAmount=r.amount;
 s.entities=s.entities.filter(e=>e.side!==0||e===worker);worker.x=40;worker.y=4;refreshVisibility(s);node.amount=0;r=view.observe(s).resources.find(r=>r.id===node.id)!;expect(r.visible).toBe(false);expect(r.amount).toBe(seenAmount);
 worker.x=node.x+1;worker.y=node.y;refreshVisibility(s);r=view.observe(s).resources.find(r=>r.id===node.id)!;expect(r.visible).toBe(true);expect(r.amount).toBe(0);
});
it('rejects malformed protocol commands and cannot control the other side or hidden targets',()=>{
 const s=new TerminalSession();result(s,{op:'start'});
 for(const c of [{type:'move',ids:[1],x:NaN,y:1},{type:'stop',ids:'all'},{type:'train',id:1,role:'dragon'},{type:'train',id:1,role:'worker',side:0},{type:'build',ids:[1],role:'__proto__',x:1,y:1}])expect(()=>result(s,{op:'command',command:c})).toThrow();
 const own=s.state!.entities.find(e=>e.side===1&&e.kind==='unit')!,enemy=s.state!.entities.find(e=>e.side===0&&e.kind==='unit')!;
 expect(result(s,{op:'command',command:{type:'move',ids:[enemy.id],x:20,y:20}}).accepted).toBe(false);
 expect(result(s,{op:'command',command:{type:'attack',ids:[own.id],target:enemy.id}}).accepted).toBe(false);
 expect(()=>result(s,{op:'advance',ticks:1201})).toThrow();expect(()=>result(s,{op:'advance',ticks:1.5})).toThrow();expect(()=>result(s,{op:'observe',side:0})).toThrow();
});
it('uses normal recruitment costs and reserves population across repeated commands',()=>{
 const s=new TerminalSession(),o=result(s,{op:'start',faction:'automata'}),hq=o.entities.find((e:Entity)=>e.role==='hq');
 const first=result(s,{op:'command',command:{type:'train',id:hq.id,role:'worker'}});expect(first.accepted).toBe(true);expect(s.state!.players[1].wood).toBe(370);
 for(let i=0;i<7;i++)result(s,{op:'command',command:{type:'train',id:hq.id,role:'worker'}});
 expect(s.state!.entities.find(e=>e.id===hq.id)!.queue).toHaveLength(5);expect(s.state!.players[1].wood).toBe(170);
});
it('advances the same simulation as direct engine steps and verifies deterministic replays',()=>{
 const session=new TerminalSession();result(session,{op:'start',faction:'tideborn',opponent:'automata',seed:984,mapSize:'large',side:1});const direct=createGame('automata',984,'tideborn',{mapSize:'large',controllers:['ai','external']});
 result(session,{op:'advance',ticks:200});for(let i=0;i<200;i++)stepGame(direct,.05);
 expect(session.state).toEqual(direct);result(session,{op:'result'});expect(replayMatch(session.replay).verified).toBe(3);
 const tampered=structuredClone(session.replay);tampered[1].input={op:'advance',ticks:201};expect(()=>replayMatch(tampered)).toThrow('Replay diverged');
});
it('filters events outside the controlled player vision',()=>{
 const s=createGame('orcs'),view=new PlayerView(0);s.events=[{type:'build',side:1,x:40,y:40,source:999},{type:'gather',side:0,x:8,y:8,source:2,amount:18,resource:'ore'}];expect(view.events(s)).toHaveLength(1);expect(view.events(s)[0].source).toBe(2);
});
it('hides enemy veil doubles as ordinary full-health units of that role',()=>{
 const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});
 const scout=s.entities.find(e=>e.side===0&&e.role==='melee')!,weaver=s.entities.find(e=>e.side===1&&e.role==='melee')!,def=FACTIONS.fairies.units.special;
 weaver.role='special';weaver.hp=def.hp;weaver.maxHp=def.hp;weaver.x=scout.x+1;weaver.y=scout.y;
 expect(issueCommand(s,1,{type:'ability',ids:[weaver.id]})).toBe(true);refreshVisibility(s);
 const clones=s.entities.filter(e=>e.illusion&&e.side===1);expect(clones).toHaveLength(2);
 const owner=new PlayerView(1).observe(s),foe=new PlayerView(0).observe(s);
 for(const clone of clones){
  const mine=owner.entities.find(e=>e.id===clone.id)!;expect(mine.illusion).toBe(true);expect(mine.maxHp).toBe(clone.maxHp);expect(mine.hp).toBe(clone.hp);
  const seen=foe.entities.find(e=>e.id===clone.id)!;expect(seen).toBeDefined();expect(seen).not.toHaveProperty('illusion');
  expect(seen.maxHp).toBe(def.hp);expect(seen.maxHp).not.toBe(def.hp*.4);expect(seen.hp).toBeCloseTo(clone.hp*(def.hp/clone.maxHp));
  expect(seen.hp/seen.maxHp).toBeCloseTo(clone.hp/clone.maxHp);
  for(const hidden of ['queue','trainProgress','order','path','cooldown','carried'])expect(seen).not.toHaveProperty(hidden);
 }
 expect(foe.entities.find(e=>e.id===weaver.id)).not.toHaveProperty('illusion');
});
