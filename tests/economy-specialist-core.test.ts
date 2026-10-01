import { describe, expect, it } from 'vitest';
import { createEconomyState, zeroCost } from '../src/core/economy-common';
import { ECONOMY_RULES, ensureEconomy, recordEconomyPaid } from '../src/core/economy';
import { availableUnits } from '../src/core/content-registry';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, spawnEntity, stepGame } from '../src/core/simulation';
import { definitionAllowed } from '../src/core/match-rules';
import { saveGame, loadGame } from '../src/core/saves';
import { createScenario } from '../src/core/scenarios';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { createArtifact } from '../src/core/unit-progression';
import type { GameState } from '../src/core/types';
import type { ScenarioDefinition } from '../src/core/scenario-types';

function fixture(rules:Parameters<typeof createMatch>[0]['rules']={}) {
 const s=createMatch({map:{seed:4127,size:'small',biome:'forest'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external'},{id:1,teamId:1,factionId:'fairies',controller:'external'}],rules:{startingAge:3,startingResources:{wood:5000,ore:5000,crystal:500},...rules}});
 s.entities=s.entities.filter(e=>e.kind==='building'&&e.role==='hq');s.resources=[];
 for(const level of s.world!.levels){level.terrain.fill('grass');level.elevation.fill(0);}
 Object.assign(s.world!,{transitions:[],bridges:[],sites:[],creatures:[],fires:[],iceTiles:[],dayLength:10000,seasonLength:10000,weatherLength:10000});
 s.economy=createEconomyState(2);refreshVisibility(s);return s;
}
const run=(s:GameState,ticks:number)=>{for(let i=0;i<ticks;i++)stepGame(s,.05);};
function loadedRoute() {
 const s=fixture(),hq=s.entities.find(e=>e.side===0)!,source=spawnEntity(s,0,'building','hq',10.5,8.5),target=spawnEntity(s,0,'building','hq',26.5,8.5);
 expect(issueCommand(s,0,{type:'trainCaravan',id:hq.id})).toBe(true);run(s,362);
 const cart=s.entities.find(e=>e.id===s.economy!.caravans[0])!;Object.assign(cart,{x:10.5,y:10.5});refreshVisibility(s);
 expect(issueCommand(s,0,{type:'deliverStock',id:cart.id,source:source.id,target:target.id,stock:{wood:30,ore:0,crystal:0}})).toBe(true);stepGame(s,.05);
 const cargo=s.economy!.cargo.find(c=>c.entityId===cart.id)!;expect(cargo.stock.wood).toBe(30);Object.assign(cart,{x:14.5,y:10.5,path:[]});return {s,cart,cargo};
}
function sameContinuation(s:GameState){const loaded=loadGame(saveGame(s));run(s,20);run(loaded,20);expect(saveGame(loaded)).toEqual(saveGame(s));}

describe('specialist effects on physical economic work',()=>{
 it('cancels a feared caravan route and moves away once while retaining goods',()=>{
  const {s,cart,cargo}=loadedRoute(),start={x:cart.x,y:cart.y};cart.specialistBuffs=[{until:s.time+3,fearedFrom:{x:cart.x+2,y:cart.y,level:0}}];
  stepGame(s,.05);expect(s.economy!.tasks).toEqual([]);expect(cart.x).toBeLessThan(start.x);expect(Math.hypot(cart.x-start.x,cart.y-start.y)).toBeLessThanOrEqual(.090001);expect(cargo.stock.wood).toBe(30);expect(cargo.origin).toBe('delivery');expect(cargo.tradeValue).toBe(0);sameContinuation(s);
 });
 it('holds a rooted route in place and applies the flood slow to cargo movement',()=>{
  const {s,cart,cargo}=loadedRoute(),start={x:cart.x,y:cart.y};cart.specialistBuffs=[{until:s.time+4,rooted:true}];stepGame(s,.05);
  expect({x:cart.x,y:cart.y}).toEqual(start);expect(cargo.stock.wood).toBe(30);expect(s.economy!.tasks).toHaveLength(1);
  cart.specialistBuffs=[];const baseline=loadGame(saveGame(s)),ordinary=baseline.entities.find(e=>e.id===cart.id)!;cart.specialistBuffs=[{until:s.time+6,speedFactor:.5}];stepGame(s,.05);stepGame(baseline,.05);
  const slowed=Math.hypot(cart.x-start.x,cart.y-start.y),normal=Math.hypot(ordinary.x-start.x,ordinary.y-start.y);expect(normal).toBeGreaterThan(0);expect(slowed).toBeCloseTo(normal*.5,6);sameContinuation(s);
 });
 it('passes a fatal extractor incident through shared cleanup once',()=>{
  const s=fixture(),extractor=spawnEntity(s,0,'building','depot',15.5,15.5,1,'economy:extractor');extractor.hp=1;
  const ore={id:s.nextId++,kind:'crystal' as const,x:20.5,y:15.5,amount:100,maxAmount:100};s.resources.push(ore);
  s.economy!.structures.push({entityId:extractor.id,kind:'extractor',resourceId:ore.id,stock:zeroCost(),capacity:0,overcharge:true,nextIncident:s.time});recordEconomyPaid(s,extractor,ECONOMY_RULES.extractor.cost);
  const resumed=loadGame(saveGame(s));let deaths=0;for(let i=0;i<1500&&extractor.hp>0;i++){stepGame(s,.05);stepGame(resumed,.05);deaths+=s.events.filter(e=>e.type==='death'&&e.source===extractor.id).length;}
  expect(extractor.hp).toBe(0);expect(deaths).toBe(1);expect(extractor.animation).toBe('death');expect(extractor.order).toEqual({type:'idle'});expect(s.economy!.deathClaims.filter(id=>id===extractor.id)).toHaveLength(1);expect(s.economy!.structures).toEqual([]);
  const drops=s.economy!.salvage.filter(item=>item.x===extractor.x&&item.y===extractor.y);expect(drops.filter(item=>item.kind==='cargo')).toEqual([]);expect(drops.find(item=>item.kind==='salvage')?.stock).toEqual({wood:25,ore:22.5,crystal:3.75});expect(saveGame(resumed)).toEqual(saveGame(s));sameContinuation(s);
 });
});

describe('caravan admission through match restrictions',()=>{
 it('recognizes caravans as worker supply after draft completion without adding them to the combat pool',()=>{
  const s=fixture({draft:{enabled:true,banRounds:0,pickRounds:1,turnTicks:100}}),base=s.entities.find(e=>e.side===0)!;
  expect(availableUnits(s,0).some(d=>d.id==='economy:caravan')).toBe(false);expect(s.draft.pool).not.toContain('economy:caravan');const before=saveGame(s);expect(issueCommand(s,0,{type:'trainCaravan',id:base.id})).toBe(false);expect(saveGame(s)).toEqual(before);
  while(s.draft.status==='drafting'){const turn=s.draft.order[s.draft.turn],id=s.draft.pool.find(id=>id.startsWith(`${s.players[turn.side].faction}-`)||id.startsWith(`core:${s.players[turn.side].faction}-`))!;expect(issueCommand(s,turn.side,{type:'draftChoice',definitionId:id})).toBe(true);}
  expect(definitionAllowed(s,0,'economy:caravan')).toBe(true);expect(issueCommand(s,0,{type:'trainCaravan',id:base.id})).toBe(true);expect(loadGame(saveGame(s)).economy?.recruits).toHaveLength(1);
 });
 it('rejects explicitly disabled caravan recruitment without charging or reserving supply',()=>{
  const s=fixture({disabledDefinitionIds:['economy:caravan']}),base=s.entities.find(e=>e.side===0)!,before=saveGame(s);expect(definitionAllowed(s,0,'economy:caravan')).toBe(false);expect(issueCommand(s,0,{type:'trainCaravan',id:base.id})).toBe(false);expect(saveGame(s)).toEqual(before);expect(saveGame(loadGame(before))).toEqual(before);
 });
});

it('keeps commander cargo, artifact, recovery, corpse and history cleanup together during a boss casualty',()=>{
 const mission:ScenarioDefinition={schemaVersion:1,id:'loaded-boss',title:'Loaded boss',briefing:'Hold.',successText:'Held.',failureText:'Lost.',faction:'fairies',opponent:'orcs',seed:22,
  map:{size:'small',width:36,height:36,terrain:Array(36*36).fill('grass'),starts:[{x:4,y:4},{x:31,y:31}],resources:[]},army:[{label:'guard',side:0,kind:'unit',role:'special',x:2,y:2,order:{type:'hold'}},{label:'boss',side:1,kind:'unit',role:'special',x:16,y:8,order:{type:'hold'}}],objectives:[{id:'hold',text:'Hold.',success:{type:'time',seconds:35}}],events:[],rules:{fixedArmy:true,reinforcementBudget:0,resources:{wood:5000,ore:5000,crystal:500},timeLimit:120},
  boss:{actor:'boss',name:'Warden',health:1000,phases:[1,.5].map(below=>({below,name:'Strike',radius:2,damage:100,warningSeconds:.5,cooldown:20,interruptDamage:1000,adds:[]}))}};
 const session=createScenario(mission),s=session.state,hero=spawnDefinition(s,0,'unit','core:fairies-commander',12,8);hero.hp=20;hero.order={type:'hold'};
 const artifact=createArtifact(s,'core:ember-blade',hero);refreshVisibility(s);expect(issueCommand(s,0,{type:'recoverArtifact',id:hero.id,artifact:artifact.id})).toBe(true);expect(issueCommand(s,0,{type:'equipArtifact',id:hero.id,artifact:artifact.id})).toBe(true);
 ensureEconomy(s).cargo.push({entityId:hero.id,stock:{wood:12,ore:0,crystal:0},capacity:24,origin:'raid',tradeValue:0});session.runtime.boss.nextAttack=0;
 const recorder=new MatchRecorder(s);let deaths=0;for(let i=0;i<20&&hero.hp>0;i++){stepGame(s,.05);deaths+=s.events.filter(e=>e.type==='death'&&e.source===hero.id).length;}
 expect(hero.hp).toBe(0);expect(deaths).toBe(1);expect(s.players[0].heroRecovery).toEqual([{definitionId:'core:fairies-commander',availableAt:s.time+30}]);expect(hero.equipment).toBeUndefined();expect(s.specialists!.artifacts.find(a=>a.id===artifact.id)?.position).toEqual({x:hero.x,y:hero.y});expect(s.corpses.filter(c=>c.id===hero.id)).toHaveLength(1);
 expect(s.economy!.cargo).toEqual([]);expect(s.economy!.salvage.filter(c=>c.kind==='cargo')).toHaveLength(1);expect(s.economy!.salvage.find(c=>c.kind==='cargo')?.stock).toEqual({wood:12,ore:0,crystal:0});expect(s.economy!.salvage.filter(c=>c.kind==='salvage')).toHaveLength(0);expect(session.runtime.variables['deaths.0']).toBe(1);
 const replay=new ReplayPlayer(recorder.export());while(!replay.finished)replay.advance(20);expect(saveGame(replay.state)).toEqual(saveGame(s));replay.dispose();recorder.dispose();sameContinuation(s);
});
