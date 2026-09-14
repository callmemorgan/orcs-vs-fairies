import {describe,it,expect} from 'vitest';
import {createGame,issueCommand,stepGame,runAI,isVisible,canPlace} from '../src/core/simulation';
import {PlayerView} from '../src/core/observation';
import {TerminalSession} from '../src/cli/session';
import {UPGRADES} from '../src/core/content';
import {walkable} from '../src/core/navigation';
function setup(){const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;return {s,hq};}
function finishResearch(s:ReturnType<typeof createGame>){let completed=false;for(let i=0;i<Math.ceil(UPGRADES['worker-harvest'].researchTime/.05)+2;i++){stepGame(s,.05);completed||=s.events.some(e=>e.type==='research'&&e.text==='Harvest Drills complete');}return completed;}
describe('building research',()=>{
 it('researches a worker upgrade at the headquarters over its research time',()=>{
  const {s,hq}=setup(),wood=s.players[0].wood,ore=s.players[0].ore;
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(true);
  expect(hq.research).toBe('worker-harvest');expect(s.players[0].wood).toBe(wood-100);expect(s.players[0].ore).toBe(ore-50);
  expect(finishResearch(s)).toBe(true);
  expect(s.players[0].upgrades).toEqual(['worker-harvest']);expect(hq.research).toBeUndefined();expect(hq.researchProgress).toBe(0);
 });
 it('rejects foreign, busy, unfinished and wrong-kind entities without spending',()=>{
  const {s,hq}=setup(),bank={...s.players[0]};
  expect(issueCommand(s,1,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(false);
  const unit=s.entities.find(e=>e.side===0&&e.role==='melee')!;
  expect(issueCommand(s,0,{type:'research',id:unit.id,upgrade:'worker-harvest'})).toBe(false);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(true);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-speed'})).toBe(false);
  expect(s.players[0].wood).toBe(bank.wood-100);expect(s.players[0].ore).toBe(bank.ore-50);
 });
 it('rejects insufficient funds and already-owned upgrades',()=>{
  const {s,hq}=setup();s.players[0].wood=90;
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(false);
  s.players[0].wood=400;s.players[0].upgrades.push('worker-harvest');
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(false);
  expect(issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-speed'})).toBe(true);
 });
 it('rejects research on a building under construction',()=>{
  const {s}=setup();const worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
  const point=[...s.visible[0]].map(i=>({x:i%s.width+.5,y:Math.floor(i/s.width)+.5})).find(p=>canPlace(s,0,'depot',p.x,p.y))!;
  expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'depot',...point})).toBe(true);
  const site=s.entities.find(e=>e.side===0&&e.role==='depot')!;
  expect(issueCommand(s,0,{type:'research',id:site.id,upgrade:'worker-harvest'})).toBe(false);
 });
 it('increases worker gather rate but not carry capacity',()=>{
  const a=createGame('orcs',4127,'fairies',{controllers:['external','external']}),b=createGame('orcs',4127,'fairies',{controllers:['external','external']});
  b.players[0].upgrades.push('worker-harvest');
  const node=a.resources.find(r=>r.kind==='wood'&&isVisible(a,0,r.x,r.y))!,nodeB=b.resources.find(r=>r.id===node.id)!;
  const wa=a.entities.find(e=>e.side===0&&e.role==='worker')!,wb=b.entities.find(e=>e.id===wa.id)!;
  wa.x=wb.x=node.x+1;wa.y=wb.y=node.y;
  expect(issueCommand(a,0,{type:'gather',ids:[wa.id],target:node.id})).toBe(true);expect(issueCommand(b,0,{type:'gather',ids:[wb.id],target:nodeB.id})).toBe(true);
  for(let i=0;i<80;i++){stepGame(a,.05);stepGame(b,.05);}
  expect(wb.carried/wa.carried).toBeCloseTo(1.3,1);expect(wb.carried).toBeLessThanOrEqual(18);
 });
 it('increases worker movement speed but leaves combat units unchanged',()=>{
  const a=createGame('orcs',4127,'fairies',{controllers:['external','external']}),b=createGame('orcs',4127,'fairies',{controllers:['external','external']});
  b.players[0].upgrades.push('worker-speed');
  const wa=a.entities.find(e=>e.side===0&&e.role==='worker')!,ma=a.entities.find(e=>e.side===0&&e.role==='melee')!;
  const wb=b.entities.find(e=>e.id===wa.id)!,mb=b.entities.find(e=>e.id===ma.id)!;
  const target=[...a.visible[0]].map(i=>({x:i%a.width+.5,y:Math.floor(i/a.width)+.5})).filter(p=>walkable(a,p.x,p.y)).sort((p,q)=>Math.hypot(q.x-wa.x,q.y-wa.y)-Math.hypot(p.x-wa.x,p.y-wa.y))[0];
  for(const [s,u,m] of [[a,wa,ma],[b,wb,mb]] as const){issueCommand(s,0,{type:'move',ids:[u.id],...target});issueCommand(s,0,{type:'move',ids:[m.id],...target});}
  for(let i=0;i<100;i++){stepGame(a,.05);stepGame(b,.05);}
  expect(Math.hypot(wb.x-wa.x,wb.y-wa.y)).toBeGreaterThan(Math.hypot(mb.x-ma.x,mb.y-ma.y)+.5);
 });
 it('exposes research to the owner only and reports upgrades in the observation',()=>{
  const {s,hq}=setup();issueCommand(s,0,{type:'research',id:hq.id,upgrade:'worker-harvest'});
  const own=new PlayerView(0).observe(s),ownHq=own.entities.find(e=>e.id===hq.id)!;
  expect(ownHq).toHaveProperty('research','worker-harvest');expect(own.player.upgrades).toEqual([]);expect(own.content.upgrades['worker-harvest'].name).toBe('Harvest Drills');
  s.visible[1]=new Set(s.visible[0]);
  const enemy=new PlayerView(1).observe(s).entities.find(e=>e.id===hq.id)!;
  expect(enemy).not.toHaveProperty('research');expect(enemy).not.toHaveProperty('researchProgress');
 });
 it('accepts research through the terminal protocol and rejects unknown upgrades',()=>{
  const session=new TerminalSession();const start=session.handle({op:'start',faction:'orcs',opponent:'fairies',side:0,mapSize:'small',seed:4127}) as {result:{entities:{id:number,role:string}[]}};
  const hq=start.result.entities.find(e=>e.role==='hq')!;
  const accepted=session.handle({op:'command',command:{type:'research',id:hq.id,upgrade:'worker-harvest'}}) as {result:{accepted:boolean}};
  expect(accepted.result.accepted).toBe(true);expect(session.state!.entities.find(e=>e.id===hq.id)!.research).toBe('worker-harvest');
  expect(()=>session.handle({op:'command',command:{type:'research',id:hq.id,upgrade:'dragon-armor'}})).toThrow('Malformed command');
 });
 it('lets the built-in AI research worker upgrades with a resource surplus',()=>{
  const {s,hq}=setup();Object.assign(s.players[0],{wood:2000,ore:2000,crystal:100});
  for(let i=0;i<2;i++)expect(issueCommand(s,0,{type:'train',id:hq.id,role:'worker'})).toBe(true);
  for(let i=0;i<Math.ceil(2*12/.05)+20&&s.entities.filter(e=>e.side===0&&e.role==='worker').length<7;i++)stepGame(s,.05);
  expect(s.entities.filter(e=>e.side===0&&e.role==='worker').length).toBeGreaterThanOrEqual(7);
  runAI(s,0);expect(hq.research).toBe('worker-harvest');
 });
});
