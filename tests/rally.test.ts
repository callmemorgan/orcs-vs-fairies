import {describe,it,expect} from 'vitest';
import {createGame,issueCommand,stepGame,canPlace} from '../src/core/simulation';
import {FACTIONS} from '../src/core/content';
import {walkable} from '../src/core/navigation';
import {PlayerView} from '../src/core/observation';
import type {FactionId} from '../src/core/types';
const factions: FactionId[]=['orcs','fairies','dwarves','undead','tideborn','automata'];
function setup(faction:FactionId='orcs'){
 const s=createGame(faction,4127,'fairies',{controllers:['external','external']});const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
 const point=[...s.visible[0]].map(i=>({x:i%s.width+.5,y:Math.floor(i/s.width)+.5})).find(p=>walkable(s,p.x,p.y)&&Math.hypot(p.x-hq.x,p.y-hq.y)>5)!;
 return {s,hq,point};
}
describe('production rally points',()=>{
 it.each(factions)('sends a newly produced %s worker toward its rally',f=>{const {s,hq,point}=setup(f);const old=new Set(s.entities.map(e=>e.id));expect(issueCommand(s,0,{type:'setRally',ids:[hq.id],...point})).toBe(true);expect(issueCommand(s,0,{type:'train',id:hq.id,role:'worker'})).toBe(true);let produced;for(let i=0;i<600&&!produced;i++){stepGame(s,.05);produced=s.entities.find(e=>!old.has(e.id)&&e.side===0);}expect(produced?.order).toEqual({type:'move',...point});expect(hq.rally).toEqual(point);});
 it('rallies all six military roles from a barracks',()=>{
  const {s}=setup();Object.assign(s.players[0],{wood:2000,ore:2000,crystal:2000});
  const locations=[...s.visible[0]].map(i=>({x:i%s.width+.5,y:Math.floor(i/s.width)+.5}));
  const site=locations.find(p=>canPlace(s,0,'barracks',p.x,p.y))!;
  const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
  expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'barracks',...site})).toBe(true);
  const b=s.entities.find(e=>e.side===0&&e.role==='barracks')!;b.progress=1;b.hp=b.maxHp;
  const point=locations.find(p=>walkable(s,p.x,p.y)&&Math.hypot(p.x-b.x,p.y-b.y)>5)!;
  expect(issueCommand(s,0,{type:'setRally',ids:[b.id],...point})).toBe(true);
  s.players[0].upgrades.push('town-age','citadel-age');
  for(const role of ['melee','ranged','special','spear','cavalry','siege'] as const){
   const seen=new Set(s.entities.map(e=>e.id));
   expect(issueCommand(s,0,{type:'train',id:b.id,role})).toBe(true);
   let produced;
   for(let i=0;i<Math.ceil((FACTIONS.orcs.units[role].trainTime+1)/.05)&&!produced;i++){stepGame(s,.05);produced=s.entities.find(e=>!seen.has(e.id));}
   expect(produced?.role).toBe(role);expect(produced?.order).toEqual({type:'move',...point});
  }
 });
 it('clears a point and keeps it private to its owner',()=>{const {s,hq,point}=setup();issueCommand(s,0,{type:'setRally',ids:[hq.id],...point});expect(new PlayerView(0).observe(s).entities.find(e=>e.id===hq.id)).toHaveProperty('rally',point);s.visible[1]=new Set(s.visible[0]);expect(new PlayerView(1).observe(s).entities.find(e=>e.id===hq.id)).not.toHaveProperty('rally');expect(issueCommand(s,0,{type:'clearRally',ids:[hq.id]})).toBe(true);expect(hq.rally).toBeUndefined();});
 it('rejects enemy buildings, units, invalid coordinates and blocked tiles',()=>{const {s,hq,point}=setup();const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;expect(issueCommand(s,1,{type:'setRally',ids:[hq.id],...point})).toBe(false);expect(issueCommand(s,0,{type:'setRally',ids:[worker.id],...point})).toBe(false);for(const p of [{x:NaN,y:1},{x:-1,y:1},{x:s.width+1,y:1},{x:hq.x,y:hq.y}])expect(issueCommand(s,0,{type:'setRally',ids:[hq.id],...p})).toBe(false);expect(hq.rally).toBeUndefined();});
 it('rejects an unexplored tile even when the terrain is grass',()=>{
  const {s,hq}=setup();const i=[...Array(s.width*s.height).keys()].find(k=>!s.explored[0].has(k))!;s.terrain[i]='grass';
  expect(issueCommand(s,0,{type:'setRally',ids:[hq.id],x:i%s.width+.5,y:Math.floor(i/s.width)+.5})).toBe(false);expect(hq.rally).toBeUndefined();
 });
 it('rallies onto an explored fogged enemy building but still rejects a visible one',()=>{
  const {s,hq}=setup();
  const site=[...s.visible[0]].map(i=>({x:i%s.width+.5,y:Math.floor(i/s.width)+.5,key:i})).find(p=>walkable(s,p.x,p.y)&&Math.hypot(p.x-hq.x,p.y-hq.y)>5)!;
  const enemy={...structuredClone(s.entities.find(e=>e.side===1&&e.role==='hq')!),id:s.nextId++,x:site.x,y:site.y};
  s.entities.push(enemy);
  expect(issueCommand(s,0,{type:'setRally',ids:[hq.id],x:site.x,y:site.y})).toBe(false);
  s.visible[0].delete(site.key);
  expect(s.explored[0].has(site.key)).toBe(true);
  expect(issueCommand(s,0,{type:'setRally',ids:[hq.id],x:site.x,y:site.y})).toBe(true);
  expect(hq.rally).toEqual({x:site.x,y:site.y});
 });
});
