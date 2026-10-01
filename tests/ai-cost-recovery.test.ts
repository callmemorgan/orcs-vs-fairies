import {describe,expect,it} from 'vitest';
import {contentHash,createContentBundle,factionFor} from '../src/core/content-registry';
import {exampleMod} from '../src/core/example-mod';
import {FACTIONS} from '../src/core/content';
import {captureRuntime,createMatch,issueCommand,refreshVisibility,restoreRuntime,runAI,stepGame} from '../src/core/simulation';
import {loadGame,saveGame} from '../src/core/saves';
import type {ContentBundle} from '../src/core/content-registry';
import type {Entity,GameState,ResourceKind} from '../src/core/types';

function custom():ContentBundle{
 const mod=JSON.parse(JSON.stringify(exampleMod()));
 mod.factions[0].units[0].cost.crystal=9;
 const ranged={...FACTIONS.fairies.units.ranged,id:'lantern:archer',cost:{wood:80,ore:40,crystal:9}},spear={...FACTIONS.fairies.units.spear,id:'lantern:pike',cost:{wood:55,ore:25,crystal:9}},worker={...FACTIONS.fairies.units.worker,id:'lantern:laborer',cost:{wood:50,ore:0,crystal:9}};
 mod.factions[0].units.push(ranged,spear,worker);mod.factions[0].defaultUnits.spear=spear.id;mod.factions[0].defaultUnits.ranged=ranged.id;mod.factions[0].defaultUnits.worker=worker.id;
 mod.factions[0].units[1].cost={wood:1,ore:0,crystal:0};
 for(const unit of [ranged,spear,worker])mod.art[unit.id]={...mod.art['lantern:sentinel'],path:`/mods/lantern/${unit.id.split(':')[1]}.svg`};
 const {hash:_,...body}=mod;mod.hash=contentHash(body);return createContentBundle([mod]);
}
function fixture(content?:ContentBundle):{s:GameState;soldier:Entity;worker:Entity;factory:Entity}{
 const s=createMatch({...(content?{content}:{}),map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:content?'lantern:keepers':'orcs',controller:'external'},{id:1,teamId:1,factionId:'orcs',controller:'external'}]});
 s.terrain.fill('grass');s.resources=[];s.time=100;
 const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!,soldier=s.entities.find(e=>e.side===0&&e.role==='melee')!,worker=s.entities.find(e=>e.side===0&&e.role==='worker')!;
 Object.assign(soldier,{x:hq.x+3,y:hq.y+1,hp:1,order:{type:'idle'}});Object.assign(worker,{x:hq.x+3,y:hq.y+2,order:{type:'hold'}});
 const def=factionFor(s,0).buildings.barracks,factory={...structuredClone(hq),id:s.nextId++,role:'barracks' as const,definitionId:content?def.id:undefined,x:hq.x+6,y:hq.y+5,hp:def.hp,maxHp:def.hp};
 s.entities=s.entities.filter(e=>e.kind==='building'||e.id===soldier.id||e.id===worker.id);s.entities.push(factory);
 Object.assign(s.players[0],{wood:0,ore:0,crystal:0,population:2,cap:2});s.populationLimits[0]=2;
 const rt=captureRuntime(s);rt.retreating[0]=[[soldier.id,{until:80,produced:0,afterId:s.nextId-1}]];restoreRuntime(s,rt);refreshVisibility(s);return {s,soldier,worker,factory};
}
function node(s:GameState,kind:ResourceKind,amount:number,x?:number,y?:number){const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;const n={id:s.nextId++,kind,amount,maxAmount:Math.max(1,amount),x:x??hq.x+5,y:y??hq.y+1};s.resources.push(n);refreshVisibility(s);return n;}
function assault(s:GameState,soldier:Entity){runAI(s,0);expect(captureRuntime(s).retreating[0]).toEqual([]);expect(soldier.order.type).toBe('attackMove');}
function regroup(s:GameState,soldier:Entity){runAI(s,0);expect(captureRuntime(s).retreating[0]).toHaveLength(1);expect(soldier.order.type).toBe('idle');}

describe('full resource cost AI recovery',()=>{
 it('makes a final assault when ore is exhausted despite reachable wood income',()=>{const {s,soldier}=fixture();s.players[0].wood=500;node(s,'wood',1000);assault(s,soldier);});
 it('does not count optional cheap custom recruits when the selected defaults require crystal',()=>{const {s,soldier}=fixture(custom());Object.assign(s.players[0],{wood:500,ore:500});node(s,'wood',1000);assault(s,soldier);});
 it('retains recovery when every default cost can be collected and delivered',()=>{const {s,soldier}=fixture();node(s,'wood',70);const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;node(s,'ore',25,hq.x+5,hq.y+3);regroup(s,soldier);});
 it('turns reachable finite deposits into delivered bank funds and a legal paid recruit',()=>{
  const {s,soldier,worker,factory}=fixture();const hq=s.entities.find(e=>e.side===0&&e.role==='hq')!;s.populationLimits[0]=12;s.players[0].cap=12;
  const wood=node(s,'wood',56),ore=node(s,'ore',26,hq.x+5,hq.y+3);regroup(s,soldier);
  expect(issueCommand(s,0,{type:'gather',ids:[worker.id],target:wood.id})).toBe(true);
  for(let i=0;i<2000&&s.players[0].wood<56;i++)stepGame(s,.05);expect(s.players[0].wood).toBeCloseTo(56);
  expect(issueCommand(s,0,{type:'gather',ids:[worker.id],target:ore.id})).toBe(true);
  for(let i=0;i<2000&&s.players[0].ore<26;i++)stepGame(s,.05);expect(s.players[0].ore).toBeCloseTo(26);
  expect(issueCommand(s,0,{type:'train',id:factory.id,role:'spear'})).toBe(true);expect(factory.queue).toContain('spear');expect(s.players[0].wood).toBeCloseTo(1);expect(s.players[0].ore).toBeCloseTo(1);
 });
 it('does not treat a deposit below one recruit cost as unlimited future income',()=>{const {s,soldier}=fixture();s.players[0].ore=25;node(s,'wood',54);assault(s,soldier);});
 it('does not replenish funds when the income factor is zero',()=>{const {s,soldier}=fixture();s.incomeFactors[0]=0;s.players[0].ore=25;node(s,'wood',1000);assault(s,soldier);});
 it('does not count insufficient carried wood as an unlimited income source',()=>{const {s,soldier,worker}=fixture();Object.assign(s.players[0],{wood:22,ore:400});Object.assign(worker,{carried:18,carriedKind:'wood'});assault(s,soldier);});
 it('waits for an already paid custom fighter with no remaining crystal or deposits',()=>{const {s,soldier,factory,worker}=fixture(custom());s.entities=s.entities.filter(e=>e.id!==worker.id);s.players[0].population=1;Object.assign(s.players[0],{wood:55,ore:35});expect(issueCommand(s,0,{type:'train',id:factory.id,role:'melee',definitionId:'lantern:duelist'})).toBe(true);regroup(s,soldier);expect(factory.queuePaidCosts?.[0]).toEqual({wood:1,ore:0,crystal:0});});
 it('does not promise a custom worker when its crystal cost is unavailable',()=>{const {s,soldier,worker}=fixture(custom());s.entities=s.entities.filter(e=>e.id!==worker.id);s.players[0].population=1;Object.assign(s.players[0],{wood:60,ore:500});node(s,'wood',1000);node(s,'crystal',1000);assault(s,soldier);});
 it('requires an observed collection route across a fully explored water barrier',()=>{const {s,soldier,worker}=fixture();s.players[0].ore=25;const barrier=Math.floor(worker.x)+1;node(s,'wood',1000,barrier+3,worker.y);for(let y=0;y<s.height;y++){const tile=y*s.width+barrier;s.terrain[tile]='water';s.explored[0].add(tile);}refreshVisibility(s);assault(s,soldier);});
 it('uses the final assault when a partial same-kind cargo load cannot reach collection or enter return',()=>{
  const {s,soldier,worker}=fixture();Object.assign(s.players[0],{wood:45,ore:25});Object.assign(worker,{carried:10,carriedKind:'wood',order:{type:'idle'}});const barrier=Math.floor(worker.x)+1;
  node(s,'wood',1000,barrier+3,worker.y);for(let y=0;y<s.height;y++){const tile=y*s.width+barrier;s.terrain[tile]='water';s.explored[0].add(tile);}refreshVisibility(s);assault(s,soldier);
  for(let i=0;i<2000;i++)stepGame(s,.05);expect(s.players[0].wood).toBe(45);expect(worker.carried).toBe(10);
 });
 it('produces the same decisions when hidden terrain and obstacles change',()=>{const {s,soldier}=fixture();s.players[0].ore=25;node(s,'wood',1000);const other=loadGame(saveGame(s));const cell=(other.height-2)*other.width+other.width-2;expect(s.explored[0].has(cell)).toBe(false);other.terrain[cell]='rock';other.resources.push({id:other.nextId++,kind:'crystal',amount:1000,maxAmount:1000,x:other.width-2,y:other.height-2});regroup(s,soldier);regroup(other,other.entities.find(e=>e.id===soldier.id)!);expect(captureRuntime(other).retreating[0]).toEqual(captureRuntime(s).retreating[0]);expect(other.entities.find(e=>e.id===soldier.id)!.order).toEqual(soldier.order);});
 it('continues the no-income final assault identically through a real save',()=>{const {s,soldier}=fixture(custom());Object.assign(s.players[0],{wood:500,ore:500});s.controllers[0]='ai';assault(s,soldier);const restored=loadGame(saveGame(s));for(let i=0;i<100;i++){stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}});
});
