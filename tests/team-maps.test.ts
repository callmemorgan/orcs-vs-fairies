import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateMap, generateMatchMap, MAP_SIZES, TERRAIN, validateMap } from '../src/core/maps';
import type { GeneratedMap } from '../src/core/maps';
import { route, segmentWalkable, walkable } from '../src/core/navigation';
import { createGame, createMatch, issueCommand, stepGame } from '../src/core/simulation';
import type { GameState, MapSize, Side, Vec } from '../src/core/types';

function navigationState(map:GeneratedMap):GameState{
 const s=createGame('orcs',1977,'orcs',{controllers:['external','external']});
 const hq=s.entities.find(e=>e.role==='hq')!;
 s.width=map.width;s.height=map.height;s.mapSize=map.size;s.terrain=map.terrain;
 s.starts=map.starts;
 s.resources=map.resources.map((resource,id)=>({...resource,id:100+id}));
 // All HQs can share a faction for this check: navigation uses their footprints, not teams.
 s.entities=map.starts.map((start,id)=>({...structuredClone(hq),...start,id:id+1,side:0}));
 return s;
}

it.each([
 ['small','5469881b31178cf142ff59c71b114b9112d853038c1fa94e2613e5a76b3f4e9a'],
 ['medium','5a3ae4debe1fb0435790ee35679d0d527f1d7dab05c91012d292a38495be2896'],
 ['large','ce3ebfa53db86771bdc651100720c17b9c1d4ca992c4405954330028b9f89c95'],
 ['huge','a0f66e23a2d625d8a8bd1ac6427ca1fc8cf6ed3c39a0779a5ca63b081f4d33f4'],
] as const)('preserves the complete legacy %s duel map output',(size,hash)=>{
 const legacy=[0,1,4127,4294967295].map(seed=>generateMap(seed,size));
 expect(createHash('sha256').update(JSON.stringify(legacy)).digest('hex')).toBe(hash);
 expect(legacy).toEqual([0,1,4127,4294967295].map(seed=>generateMatchMap(seed,size,2)));
});

it.each([1,2,3,4,5,6,7,8])('generates reproducible connected maps for %i players across 30 seeds',(count)=>{
 for(let seed=0;seed<30;seed++){
  const map=generateMatchMap(seed,'small',count),validation=validateMap(map);
  expect(map.starts).toHaveLength(count);
  expect(map.size).toBe(count>4?'huge':count>2?'large':'small');
  expect(map.width).toBe(MAP_SIZES[map.size]);
  expect(validation.issues,`${count}/${seed}`).toEqual([]);
  expect(validation.reachableResources).toBe(map.resources.length);
 }
 expect(generateMatchMap(4127,'small',count)).toEqual(generateMatchMap(4127,'small',count));
},30_000);

it('keeps the requested size for one/two players and already-large matches',()=>{
 for(const size of Object.keys(MAP_SIZES) as MapSize[]){
  const original=generateMap(4127,size),single=generateMatchMap(4127,size,1);
  expect(single).toEqual({...original,starts:[original.starts[0]]});
  expect(generateMatchMap(4127,size,2)).toEqual(original);
 }
 expect(generateMatchMap(4127,'huge',3).size).toBe('huge');
 expect(generateMatchMap(4127,'large',4).size).toBe('large');
});

it.each([3,4,5,6,7,8])('gives all %i players identical private reserves with no opening collisions',(count)=>{
 const map=generateMatchMap(4127,'medium',count),s=navigationState(map);
 const expected=[['wood',2600],['wood',2600],['wood',2600],['ore',2800],['ore',2800],['crystal',180]];
 for(const start of map.starts){
  const nearby=map.resources.filter(r=>Math.hypot(r.x-start.x,r.y-start.y)<9);
  expect(nearby.map(r=>[r.kind,r.amount])).toEqual(expected);
  const dir=start.y<map.height/2?1:-1;
  expect(nearby.map(r=>[(r.x-start.x)*dir||0,(r.y-start.y)*dir||0])).toEqual([[-4,4],[-2,6],[-5,1],[5,-3],[6,0],[5,4]]);
  for(let y=Math.floor(start.y-2);y<=Math.floor(start.y+2);y++)for(let x=Math.floor(start.x-2);x<=Math.floor(start.x+2);x++)expect(TERRAIN[map.terrain[y*map.width+x]].buildable).toBe(true);
  for(const dir of [-1,1]){
   for(let worker=0;worker<5;worker++)expect(walkable(s,start.x+(-2+worker*.85)*dir,start.y+3*dir)).toBe(true);
   expect(walkable(s,start.x+3*dir,start.y+dir)).toBe(true);
  }
 }
 for(let a=0;a<map.starts.length;a++)for(let b=a+1;b<map.starts.length;b++)expect(Math.hypot(map.starts[a].x-map.starts[b].x,map.starts[a].y-map.starts[b].y)).toBeGreaterThan(16.2);
 for(const resource of map.resources)for(const start of map.starts)expect(Math.abs(resource.x-start.x)>=2.7||Math.abs(resource.y-start.y)>=2.7).toBe(true);
 for(let a=0;a<map.resources.length;a++)for(let b=a+1;b<map.resources.length;b++)expect(Math.hypot(map.resources[a].x-map.resources[b].x,map.resources[a].y-map.resources[b].y)).toBeGreaterThanOrEqual(2.05);
 expect(map.resources.filter(r=>map.starts.every(p=>Math.hypot(r.x-p.x,r.y-p.y)>=9))).toHaveLength(count*3);
});

it.each([3,4,8])('gives all %i opening armies the same gathering distance and income',(count)=>{
 const s=createMatch({map:{seed:4127,size:'small'},players:Array.from({length:count},(_,id)=>({id:id as Side,teamId:id as Side,factionId:'orcs',controller:'external'}))});
 const distances:number[][]=[];
 for(let side=0;side<count;side++){
  const start=s.starts[side],wood=s.resources.filter(r=>r.kind==='wood'&&Math.hypot(r.x-start.x,r.y-start.y)<9);
  const workers=s.entities.filter(e=>e.side===side&&e.role==='worker');
  distances.push(workers.map(worker=>{
   const node=[...wood].sort((a,b)=>Math.hypot(a.x-worker.x,a.y-worker.y)-Math.hypot(b.x-worker.x,b.y-worker.y))[0];
   expect(issueCommand(s,side as Side,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);
   return Math.hypot(node.x-worker.x,node.y-worker.y);
  }));
 }
 for(const values of distances)for(let worker=0;worker<values.length;worker++)expect(values[worker]).toBeCloseTo(distances[0][worker],10);
 for(let tick=0;tick<400;tick++)stepGame(s,.05);
 const incomes=s.players.map(player=>player.wood-420);
 expect(incomes[0]).toBeGreaterThan(0);
 for(const income of incomes)expect(income).toBe(incomes[0]);
},30_000);

it.each([1,2,3,4,5,6,7,8])('routes from every opening army to every HQ approach with %i players',(count)=>{
 const map=generateMatchMap(91873,'small',count),s=navigationState(map);
 for(const from of map.starts.map(p=>({x:p.x,y:p.y+3})))for(const start of map.starts)for(const [dx,dy] of [[0,3],[0,-3],[3,0],[-3,0]]){
  const to={x:start.x+dx,y:start.y+dy};
  expect(walkable(s,from.x,from.y)).toBe(true);expect(walkable(s,to.x,to.y)).toBe(true);
  const path=route(s,from,to,0);
  expect(path.length,`${count}: ${JSON.stringify(from)} -> ${JSON.stringify(to)}`).toBeGreaterThan(0);
  let previous:Vec=from;
  for(const point of path){expect(segmentWalkable(s,previous,point)).toBe(true);previous=point;}
  expect(Math.hypot(previous.x-to.x,previous.y-to.y)).toBeLessThanOrEqual(.4);
 }
},60_000);

it.each([3,4,5,6,7,8])('lets every player gather its private reserves and the contested camps with %i players',(count)=>{
 const map=generateMatchMap(72931,'small',count),s=navigationState(map);
 for(const start of map.starts){
  const from={x:start.x,y:start.y+3};
  const deposits=map.resources.filter(r=>Math.hypot(r.x-start.x,r.y-start.y)<9||map.starts.every(p=>Math.hypot(r.x-p.x,r.y-p.y)>=9));
  for(const deposit of deposits){
   const path=route(s,from,deposit,1);
   expect(path.length,`${count}: ${JSON.stringify(from)} -> ${JSON.stringify(deposit)}`).toBeGreaterThan(0);
   let previous:Vec=from;for(const point of path){expect(segmentWalkable(s,previous,point)).toBe(true);previous=point;}
   expect(Math.hypot(previous.x-deposit.x,previous.y-deposit.y)).toBeLessThanOrEqual(1.2);
  }
 }
},60_000);

it('checks all starts and rejects a separated multiplayer map',()=>{
 const map=generateMatchMap(4127,'large',4);
 for(let y=0;y<map.height;y++)map.terrain[y*map.width+map.width/2]='water';
 expect(validateMap(map).startsConnected).toBe(false);
 expect(validateMap(map).issues).toContain('Starting armies are disconnected.');
 const missing=generateMatchMap(4127,'large',4),last=missing.starts[3];
 missing.resources=missing.resources.filter(r=>r.kind!=='wood'||Math.hypot(r.x-last.x,r.y-last.y)>=9);
 expect(validateMap(missing).issues).toContain('Missing starting wood.');
});

it('rejects unsupported player counts without accepting invalid map input',()=>{
 for(const count of [0,-1,1.5,9,NaN,Infinity])expect(()=>generateMatchMap(4127,'medium',count)).toThrow('Player count');
 expect(()=>generateMatchMap(4127,'endless' as MapSize,8)).toThrow('Map size');
 expect(()=>generateMatchMap(-1,'medium',8)).toThrow('Map seed');
});

it('refreshes navigation when terrain is changed in place after a cached search',()=>{
 const s=createGame('orcs',4127,'orcs',{controllers:['external','external']});
 s.terrain.fill('grass');s.entities=[];s.resources=[];
 const from={x:10.5,y:20.5},to={x:30.5,y:20.5};
 expect(route(s,from,to,0).length).toBeGreaterThan(0);
 for(let y=0;y<s.height;y++)s.terrain[y*s.width+20]='water';
 expect(route(s,from,to,0)).toEqual([]);
 // Opening a bridge reuses the same terrain array and must permit routing again.
 for(let y=19;y<=21;y++)s.terrain[y*s.width+20]='bridge';
 const crossing=route(s,from,to,0);expect(crossing.length).toBeGreaterThan(0);
 let previous:Vec=from;for(const point of crossing){expect(segmentWalkable(s,previous,point)).toBe(true);previous=point;}
});
