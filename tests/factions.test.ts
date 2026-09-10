import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createGame, issueCommand, refreshVisibility, runAI, stepGame } from '../src/core/simulation';
import type { Entity, FactionId, GameState, UnitRole } from '../src/core/types';
const ids=Object.keys(FACTIONS) as FactionId[];
function add(s:GameState,role:UnitRole,x:number,y:number,side:0|1=0):Entity {
 const def=FACTIONS[s.players[side].faction].units[role];
 const e={...s.entities.find(e=>e.kind==='unit')!,id:s.nextId++,side,role,x,y,hp:def.hp,maxHp:def.hp,order:{type:'idle'} as const,queue:[],path:[]};s.entities.push(e);return e;
}
function advance(s:GameState,seconds:number){for(let i=0;i<seconds*20;i++)stepGame(s,.05);}
// Use a real initial worker as the entity template; fixtures then isolate combat.
function combat(faction:FactionId){const s=createGame(faction,1977,'orcs');s.resources=[];s.terrain.fill('grass');s.players[1].wood=s.players[1].ore=0;for(const e of s.entities)if(e.kind==='unit'){e.x=e.side?42:3;e.y=e.side?42:3;}return s;}
describe('six factions',()=>{
 it.each(ids.flatMap(f=>ids.map(o=>[f,o] as const)))('%s can face %s with the correct starting roster',(f,o)=>{const s=createGame(f,1977,o);expect(s.players.map(p=>p.faction)).toEqual([f,o]);for(const side of [0,1] as const){const own=s.entities.filter(e=>e.side===side);expect(own.filter(e=>e.role==='worker')).toHaveLength(5);expect(own.find(e=>e.role==='hq')?.hp).toBe(FACTIONS[s.players[side].faction].buildings.hq.hp);}});
 it('has unique content IDs and complete rosters',()=>{const all=Object.values(FACTIONS).flatMap(f=>[...Object.values(f.units),...Object.values(f.buildings)]);expect(new Set(all.map(d=>d.id)).size).toBe(48);for(const d of all){expect(d.description.length).toBeGreaterThan(15);expect(d.hp).toBeGreaterThan(0);}});
 it('emplacement takes three seconds and movement packs up',()=>{const s=combat('dwarves'),u=add(s,'special',20,20);refreshVisibility(s);expect(issueCommand(s,0,{type:'ability',ids:[u.id]})).toBe(true);expect(u.order.type).toBe('hold');advance(s,2.9);expect(s.time-u.entrenchedAt!).toBeLessThan(3);advance(s,.2);expect(s.time-u.entrenchedAt!).toBeGreaterThanOrEqual(3);issueCommand(s,0,{type:'move',ids:[u.id],x:22,y:20});expect(u.entrenchedAt).toBeUndefined();advance(s,1);expect(u.x).toBeGreaterThan(20);});
 it('an emplaced cannon can hit a target outside its mobile range',()=>{const s=combat('dwarves'),u=add(s,'special',20,20),b=add(s,'melee',29,20,1);b.order={type:'hold'};refreshVisibility(s);issueCommand(s,0,{type:'hold',ids:[u.id]});advance(s,1);expect(b.hp).toBe(b.maxHp);issueCommand(s,0,{type:'ability',ids:[u.id]});advance(s,4);expect(b.hp).toBeLessThan(b.maxHp);expect(u.x).toBe(20);});
 it('AI emplaces in range and packs up when no target remains',()=>{const s=combat('dwarves'),u=add(s,'ranged',20,20),b=add(s,'melee',25,20,1);refreshVisibility(s);runAI(s,0);expect(u.entrenchedAt).toBe(0);s.entities=s.entities.filter(e=>e.id!==b.id);refreshVisibility(s);runAI(s,0);expect(u.entrenchedAt).toBeUndefined();});
 it('raises at most two corpses and consumes each once',()=>{const s=combat('undead'),u=add(s,'special',20,20);s.corpses=[{id:900,x:21,y:20,expires:45},{id:901,x:22,y:20,expires:45},{id:902,x:23,y:20,expires:45}];refreshVisibility(s);expect(issueCommand(s,0,{type:'ability',ids:[u.id]})).toBe(true);const raised=s.entities.filter(e=>e.raised);expect(raised).toHaveLength(2);expect(raised.every(e=>e.hp===e.maxHp*.5&&e.expires===35)).toBe(true);expect(s.corpses.map(c=>c.id)).toEqual([902]);expect(issueCommand(s,0,{type:'ability',ids:[u.id]})).toBe(false);});
 it('does not consume a corpse or cooldown without free population',()=>{const s=combat('undead'),u=add(s,'special',20,20);while(s.entities.filter(e=>e.side===0&&e.kind==='unit').length<12)add(s,'melee',15,15);s.corpses=[{id:900,x:21,y:20,expires:45}];refreshVisibility(s);expect(issueCommand(s,0,{type:'ability',ids:[u.id]})).toBe(false);expect(s.corpses).toHaveLength(1);expect(u.abilityReadyAt).toBeUndefined();});
 it('respects reserved population, expired corpses and sight',()=>{const s=combat('undead'),u=add(s,'special',20,20);s.entities.find(e=>e.role==='hq'&&e.side===0)!.queue=Array(5).fill('worker');s.corpses=[{id:900,x:21,y:20,expires:45}];refreshVisibility(s);expect(issueCommand(s,0,{type:'ability',ids:[u.id]})).toBe(false);s.entities.find(e=>e.role==='hq'&&e.side===0)!.queue=[];s.corpses[0].expires=0;expect(issueCommand(s,0,{type:'ability',ids:[u.id]})).toBe(false);s.corpses[0].expires=45;s.visible[0].clear();expect(issueCommand(s,0,{type:'ability',ids:[u.id]})).toBe(false);});
 it('automatically raises during combat, and summoned warriors leave no reusable corpse',()=>{const s=combat('undead'),u=add(s,'special',20,20);s.corpses=[{id:900,x:21,y:20,expires:45}];refreshVisibility(s);advance(s,.05);const raised=s.entities.find(e=>e.raised)!;expect(raised).toBeDefined();s.entities=s.entities.filter(e=>e.id!==u.id);raised.expires=s.time+.05;advance(s,.1);expect(raised.hp).toBe(0);expect(s.corpses.some(c=>c.id===raised.id)).toBe(false);});
 it('real combat deaths leave expiring corpses',()=>{const s=combat('dwarves'),u=add(s,'ranged',20,20),b=add(s,'melee',21,20,1);b.hp=1;refreshVisibility(s);issueCommand(s,0,{type:'attack',ids:[u.id],target:b.id});advance(s,.05);expect(s.corpses.find(c=>c.id===b.id)).toBeDefined();advance(s,46);expect(s.corpses.find(c=>c.id===b.id)).toBeUndefined();});
 it('emplacement increases actual damage and protects against incoming hits',()=>{
   const mobile=combat('dwarves'),prepared=combat('dwarves');
   const a=add(mobile,'ranged',20,20),b=add(mobile,'melee',24,20,1);
   const aa=add(prepared,'ranged',20,20),bb=add(prepared,'melee',24,20,1);
   b.order=bb.order={type:'hold'};
   issueCommand(prepared,0,{type:'ability',ids:[aa.id]});
   // Prepare without a target, then give both copies a fresh attack cooldown.
   bb.x=40;advance(prepared,3.1);bb.x=24;aa.cooldown=0;
   refreshVisibility(mobile);refreshVisibility(prepared);
   issueCommand(mobile,0,{type:'hold',ids:[a.id]});advance(mobile,.05);advance(prepared,.05);
   expect(bb.maxHp-bb.hp).toBeGreaterThan(b.maxHp-b.hp);
   b.x=bb.x=20.8;b.cooldown=bb.cooldown=0;a.cooldown=aa.cooldown=100;
   advance(mobile,.05);advance(prepared,.05);
   expect(aa.maxHp-aa.hp).toBeLessThan(a.maxHp-a.hp);
 });
 it('a late economy invests stockpiles in an additional production building',()=>{
   const s=createGame('dwarves');s.resources=[];s.terrain.fill('grass');s.time=421;s.players[0].wood=1000;s.players[0].ore=1000;s.players[0].crystal=1000;
   // Issue real build commands, then complete foundations to isolate the late AI choice.
   const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
   for(const [role,x,y] of [['barracks',13.5,8.5],['barracks',3.5,8.5],['tower',8.5,13.5]] as const){
     refreshVisibility(s);expect(issueCommand(s,0,{type:'build',ids:[worker.id],role,x,y})).toBe(true);
     const building=s.entities.at(-1)!;building.progress=1;building.hp=building.maxHp;worker.order={type:'idle'};
   }
   s.players[0].wood=s.players[0].ore=1000;runAI(s,0);
   expect(s.entities.filter(e=>e.side===0&&e.role==='barracks')).toHaveLength(3);
   expect(s.players[0].wood).toBeLessThan(1000);
 });

});
