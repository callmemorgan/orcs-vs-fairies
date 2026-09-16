import { expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createGame, canPlace, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { TerrainKind } from '../src/core/types';

function flat(){const s=createGame('orcs',4127,'orcs',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];return s;}
it('roads speed movement and marshes slow it',()=>{
 const travelled=(terrain:TerrainKind)=>{const s=flat();s.terrain.fill(terrain);const unit=s.entities.find(e=>e.side===0&&e.role==='worker')!;unit.x=20.25;unit.y=20.25;issueCommand(s,0,{type:'move',ids:[unit.id],x:27.25,y:20.25});for(let i=0;i<20;i++)stepGame(s,.05);return unit.x-20.25;};
 expect(travelled('road')).toBeGreaterThan(travelled('grass'));expect(travelled('grass')).toBeGreaterThan(travelled('mud'));
});
it('allows construction on meadow but rejects the same footprint in marsh',()=>{
 const s=flat();refreshVisibility(s);expect(canPlace(s,0,'depot',13.5,8.5)).toBe(true);
 s.terrain.fill('mud');expect(canPlace(s,0,'depot',13.5,8.5)).toBe(false);
});
it('routes around deep water instead of crossing it',()=>{
 const s=flat();const unit=s.entities.find(e=>e.side===0&&e.role==='worker')!;unit.x=18.25;unit.y=20.25;
 for(let y=18;y<=22;y++)for(let x=21;x<=22;x++)s.terrain[y*s.width+x]='water';
 issueCommand(s,0,{type:'move',ids:[unit.id],x:26.25,y:20.25});
 for(let i=0;i<500;i++){stepGame(s,.05);expect(s.terrain[Math.floor(unit.y)*s.width+Math.floor(unit.x)]).not.toBe('water');}
 expect(unit.order.type).toBe('idle');expect(unit.x).toBeGreaterThan(25.5);
});
it('harvests crystal, returns it to the headquarters and emits the deposited amount',()=>{
 const s=flat(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;
 s.entities=s.entities.filter(e=>e.kind==='building'||e===worker);hq.x=18.5;hq.y=20.5;worker.x=21.5;worker.y=20.5;
 const node={id:s.nextId++,kind:'crystal' as const,x:23.5,y:20.5,amount:8,maxAmount:8};s.resources.push(node);refreshVisibility(s);
 expect(issueCommand(s,0,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);
 let deposited=0;for(let i=0;i<500;i++){stepGame(s,.05);for(const e of s.events)if(e.type==='gather'&&e.resource==='crystal')deposited+=e.amount??0;}
 expect(s.players[0].crystal).toBeCloseTo(8);expect(deposited).toBeCloseTo(8);expect(node.amount).toBe(0);
});
it('requires and spends crystal for advanced recruitment while basic recruits need none',()=>{
 const s=flat(),worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
 refreshVisibility(s);expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'barracks',x:13.5,y:8.5})).toBe(true);
 const hall=s.entities.at(-1)!;hall.progress=1;s.players[0].upgrades.push('town-age');
 expect(issueCommand(s,0,{type:'train',id:hall.id,role:'special'})).toBe(false);
 s.players[0].crystal=FACTIONS.orcs.units.special.cost.crystal;
 expect(issueCommand(s,0,{type:'train',id:hall.id,role:'special'})).toBe(true);expect(s.players[0].crystal).toBe(0);
 expect(issueCommand(s,0,{type:'train',id:hall.id,role:'melee'})).toBe(true);
});
it('AI workers discover and deposit crystal through ordinary gathering rules',()=>{
 const s=createGame('orcs',4127,'orcs',{controllers:['ai','ai']});const deposits=[0,0];
 for(let i=0;i<2400;i++){stepGame(s,.05);for(const e of s.events)if(e.type==='gather'&&e.resource==='crystal')deposits[e.side]+=e.amount??0;}
 expect(deposits[0]).toBeGreaterThan(0);expect(deposits[1]).toBeGreaterThan(0);
});

it('Tideborn route planning uses its own wet-terrain speed',async()=>{
 const {route}=await import('../src/core/navigation');
 const wetSteps=(faction:'orcs'|'tideborn')=>{
  const s=createGame(faction,4127,'orcs',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];
  for(let y=19;y<=21;y++)for(let x=20;x<=26;x++)s.terrain[y*s.width+x]='mud';
  const path=route(s,{x:18.5,y:20.5},{x:28.5,y:20.5},.5,0);
  return path.filter(p=>s.terrain[Math.floor(p.y)*s.width+Math.floor(p.x)]==='mud').length;
 };
 expect(wetSteps('tideborn')).toBeGreaterThan(wetSteps('orcs'));
});
