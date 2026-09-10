import { expect, it } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';

it('finishes move orders aimed inside an ore deposit at a safe nearby point',()=>{
 const s=createGame('orcs');s.terrain.fill('grass');const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
 s.entities=s.entities.filter(e=>e.kind==='building'||e===worker);s.players[1].wood=s.players[1].ore=0;
 worker.x=20.5;worker.y=20.5;s.resources=[{id:s.nextId++,kind:'ore',x:24,y:20,amount:100,maxAmount:100}];
 issueCommand(s,0,{type:'move',ids:[worker.id],x:24,y:20});
 for(let i=0;i<500;i++){stepGame(s,.05);expect(Math.hypot(worker.x-24,worker.y-20)).toBeGreaterThanOrEqual(.7-1e-7);}
 expect(worker.order.type).toBe('idle');
 expect(Math.hypot(worker.x-24,worker.y-20)).toBeLessThan(1.8);
});

it('starts mirror armies at rotated positions with equal resource access',()=>{
 const s=createGame('orcs',4127,'orcs');
 const a=s.entities.filter(e=>e.side===0),b=s.entities.filter(e=>e.side===1);
 for(let i=0;i<a.length;i++){
  expect(b[i].role).toBe(a[i].role);
  expect(b[i].x).toBeCloseTo(s.width-a[i].x,8);
  expect(b[i].y).toBeCloseTo(s.height-a[i].y,8);
 }
});

it('uses a narrow passage between buildings without taking a long detour',()=>{
 const s=createGame('orcs');s.terrain.fill('grass');const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,template=s.entities.find(e=>e.role==='hq')!;
 s.entities=s.entities.filter(e=>e.kind==='building'||e===worker);s.players[1].wood=s.players[1].ore=0;s.resources=[];
 worker.x=18.5;worker.y=20.25;
 for(const y of [18.28,22.22])s.entities.push({...structuredClone(template),id:s.nextId++,role:'barracks',x:22,y});
 issueCommand(s,0,{type:'move',ids:[worker.id],x:25.5,y:20.25});
 for(let i=0;i<150;i++){stepGame(s,.05);expect(Math.abs(worker.y-20.25)).toBeLessThan(.2);}
 expect(worker.order.type).toBe('idle');expect(worker.x).toBeGreaterThan(25);
});

it('moves a crowded group around a building and finishes the formation order',()=>{
 const s=createGame('orcs');s.terrain.fill('grass');const first=s.entities.find(e=>e.side===0&&e.role==='worker')!,template=s.entities.find(e=>e.role==='hq')!;
 s.entities=s.entities.filter(e=>e.kind==='building');s.players[1].wood=s.players[1].ore=0;s.resources=[];
 const army=Array.from({length:16},(_,i)=>({...structuredClone(first),id:s.nextId++,x:16+(i%4)*.65,y:18+Math.floor(i/4)*.65}));s.entities.push(...army);
 const obstacle={...structuredClone(template),id:s.nextId++,role:'barracks' as const,x:21,y:20};s.entities.push(obstacle);
 issueCommand(s,0,{type:'move',ids:army.map(e=>e.id),x:27,y:20});
 for(let i=0;i<700;i++){
  stepGame(s,.05);
  for(const e of army)expect(Math.abs(e.x-21)>=1.77-1e-6||Math.abs(e.y-20)>=1.77-1e-6).toBe(true);
 }
 expect(army.every(e=>e.order.type==='idle')).toBe(true);
 expect(army.every(e=>Math.hypot(e.x-27,e.y-20)<2.5)).toBe(true);
});

it('lets both sides execute lethal attacks from the same simulation step',()=>{
 const s=createGame('orcs',4127,'orcs');s.terrain.fill('grass');s.resources=[];s.players[1].wood=s.players[1].ore=0;
 const fighters=s.entities.filter(e=>e.role==='melee');s.entities=s.entities.filter(e=>e.kind==='building'||e.role==='melee');
 fighters.forEach((e,i)=>{e.x=20+i;e.y=20;e.hp=1;e.order={type:'hold'};});
 stepGame(s,.05);
 expect(fighters.map(e=>e.hp)).toEqual([0,0]);
});

it('runs both built-in controllers on the same first decision step',()=>{
 const s=createGame('orcs',4127,'orcs',{controllers:['ai','ai']});stepGame(s,.05);
 expect(s.players[0].wood).toBe(s.players[1].wood);expect(s.players[0].ore).toBe(s.players[1].ore);
 for(const side of [0,1]){
  expect(s.entities.some(e=>e.side===side&&e.order.type==='gather')).toBe(true);
  expect(s.entities.some(e=>e.side===side&&e.role==='barracks')).toBe(true);
 }
});

it('leaves external controllers idle until their agent issues commands',()=>{
 const s=createGame('orcs',4127,'orcs',{controllers:['external','external']});
 for(let i=0;i<100;i++)stepGame(s,.05);
 expect(s.players.map(p=>p.wood)).toEqual([420,420]);
 expect(s.entities.every(e=>e.order.type==='idle')).toBe(true);
});

it('reaches a legal destination in a one-tile gap missed by half-tile centers',()=>{
 const s=createGame('orcs',4127,'orcs',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];
 const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!,template=s.entities.find(e=>e.role==='hq')!;
 s.entities=s.entities.filter(e=>e.kind==='building'||e===worker);worker.x=18;worker.y=20.5;
 for(const y of [18.5,22.5])s.entities.push({...structuredClone(template),id:s.nextId++,role:'barracks',x:22,y});
 expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:22,y:20.5})).toBe(true);
 for(let i=0;i<160;i++)stepGame(s,.05);
 expect(worker.order.type).toBe('idle');expect(Math.hypot(worker.x-22,worker.y-20.5)).toBeLessThan(.6);
});

it('places the first AI foundations at rotated mirror coordinates',()=>{
 const s=createGame('orcs',4127,'orcs',{controllers:['ai','ai'],mapSize:'small'});stepGame(s,.05);
 const a=s.entities.find(e=>e.side===0&&e.role==='barracks')!,b=s.entities.find(e=>e.side===1&&e.role==='barracks')!;
 expect(b.x).toBeCloseTo(s.width-a.x,8);expect(b.y).toBeCloseTo(s.height-a.y,8);
});

it('does not let two troops deadlock while converging on a shared grid waypoint',()=>{
 const s=createGame('orcs',4127,'orcs',{controllers:['external','external']});s.terrain.fill('grass');s.resources=[];
 const first=s.entities.find(e=>e.side===0&&e.role==='melee')!,building=s.entities.find(e=>e.side===0&&e.role==='hq')!;
 s.entities=s.entities.filter(e=>e.kind==='building');
 const troops=[{...structuredClone(first),id:s.nextId++,x:7.58,y:2.80},{...structuredClone(first),id:s.nextId++,x:7.92,y:2.69}];s.entities.push(...troops);
 for(const [role,x] of [['barracks',5.5],['depot',9.5]] as const)s.entities.push({...structuredClone(building),id:s.nextId++,role,x,y:2.5});
 issueCommand(s,0,{type:'attackMove',ids:troops.map(e=>e.id),x:22.5,y:18.5});
 for(let i=0;i<400;i++)stepGame(s,.05);
 expect(troops.every(e=>Math.hypot(e.x-7.75,e.y-2.75)>8)).toBe(true);
});
