import {describe,expect,it} from 'vitest';
import {alliedAiStatus,captureRuntime,createMatch,issueCommand,refreshVisibility,restoreRuntime,runAI,stepGame} from '../src/core/simulation';
import {loadGame,saveGame} from '../src/core/saves';
import {OnlineView} from '../src/server/views';
import {observationToRenderState} from '../src/online/render-state';
import {coordinateTeamAi,emptyTeamAiState,validateTeamAiState} from '../src/core/team-ai';
import {contentHash,createContentBundle} from '../src/core/content-registry';
import {exampleMod} from '../src/core/example-mod';
import {FACTIONS} from '../src/core/content';
import type {TeamAiReport,TeamAiValidationContext} from '../src/core/team-ai';
import type {GameState} from '../src/core/types';

function fixture(content?:ReturnType<typeof createContentBundle>):GameState{
 const s=createMatch({...(content?{content}:{}),map:{seed:4127,size:'medium',biome:'forest'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:420,ore:220,crystal:20}}},{id:1,teamId:0,factionId:content?'lantern:keepers':'orcs',controller:'ai'},{id:2,teamId:1,factionId:'orcs',controller:'external'}],rules:{sharedVision:false}});
 s.world!.levels[1].terrain.fill('grass');s.world!.levels[1].elevation.fill(0);s.world!.sites=[];s.world!.creatures=[];
 s.entities=s.entities.filter(e=>e.kind==='building'||e.role==='melee');s.resources=[];
 for(const p of s.players){p.wood=p.ore=p.crystal=0;p.population=1;p.cap=12;}refreshVisibility(s);return s;
}
const directive=(s:GameState)=>captureRuntime(s).teamAI!.directives[0];
function advancePair(s:GameState,restored:GameState,ticks:number){for(let i=0;i<ticks;i++){stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}}

describe('allied AI with assembled world and content',()=>{
 it('leaves surface troops unassigned to a cavern request and completes with real cavern movement after saving',()=>{
  const s=fixture(),fighter=s.entities.find(e=>e.side===1&&e.role==='melee')!,destination={x:14.5,y:12.5,level:1};fighter.x=8.5;fighter.y=12.5;fighter.level=0;refreshVisibility(s);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'scout',...destination})).toBe(true);runAI(s,1);
  expect(directive(s).assigned).toEqual([]);expect(directive(s).status).toBe('accepted');
  fighter.level=1;refreshVisibility(s);runAI(s,1);expect(directive(s).assigned).toEqual([fighter.id]);expect(fighter.order).toMatchObject({type:'move',level:1});
  const restored=loadGame(saveGame(s));advancePair(s,restored,180);expect(directive(s).status).toBe('completed');expect(fighter.x).toBeGreaterThan(11);expect(fighter.level).toBe(1);
 },20_000);

 it('copies a visible cavern target and retains that level when it traverses to the surface',()=>{
  const s=fixture(),entry=s.world!.transitions[0],target=s.entities.find(e=>e.side===2&&e.role==='melee')!,observer=s.entities.find(e=>e.side===0&&e.role==='melee')!;
  Object.assign(target,entry.to);Object.assign(observer,{...entry.to,x:entry.to.x+3});refreshVisibility(s);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'attack',target:target.id})).toBe(true);const frozen={...directive(s).destination!};expect(frozen.level).toBe(1);
  expect(issueCommand(s,2,{type:'traverse',ids:[target.id],transition:entry.id})).toBe(true);for(let i=0;i<50&&target.level===1;i++)stepGame(s,.05);
  expect(target.level).toBe(0);expect(directive(s).destination).toEqual(frozen);expect(directive(s).assigned).toEqual([]);
  const invalid=saveGame(s);invalid.runtime.teamAI!.directives[0].destination!.level=2;expect(()=>loadGame(invalid)).toThrow(/level/);
 });

 it('rejects shared attack approval and defense assignment across stacked map levels',()=>{
  const report=(side:0|1,level:number):TeamAiReport=>({side,teamId:0,time:10,hq:{x:5,y:5,level},fighters:[{id:side*10+1,role:'melee',x:6,y:5,level},{id:side*10+2,role:'melee',x:7,y:5,level}],threats:[],targets:[{key:'entity:99',kind:'hq',observer:side,seenAt:10,x:20,y:20,level}],readyToAttack:true,waveReadyAt:10,scoutingNeeded:false});
  const a=report(0,0),b=report(1,1);expect(coordinateTeamAi(emptyTeamAiState().coordinator,[a,b],10).coordinator.waves).toEqual([]);
  a.threats=[{id:99,x:6,y:5,level:0}];const help=coordinateTeamAi(emptyTeamAiState().coordinator,[a,b],10).assignments;
  expect(help.filter(x=>x.role==='defend').map(x=>x.side)).toEqual([0]);expect(help.find(x=>x.role==='defend')!.destination.level).toBe(0);
 });

 it('reserves a custom worker crystal cost and transfers support only once through public commands',()=>{
  const mod=JSON.parse(JSON.stringify(exampleMod())),worker={...FACTIONS.orcs.units.worker,id:'lantern:laborer',cost:{wood:70,ore:20,crystal:9}};mod.factions[0].units.push(worker);mod.factions[0].defaultUnits.worker=worker.id;mod.art[worker.id]={...mod.art['lantern:sentinel'],path:'/mods/lantern/laborer.svg'};const {hash:_,...body}=mod;mod.hash=contentHash(body);
  const s=fixture(createContentBundle([mod]));s.populationLimits[1]=1;s.players[1].cap=1;Object.assign(s.players[0],{wood:100,ore:100,crystal:10});Object.assign(s.players[1],{wood:150,ore:40,crystal:10});
  const requested={wood:80,ore:20,crystal:2};expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'support',resources:requested})).toBe(true);runAI(s,1);expect(directive(s).status).toBe('active');expect(captureRuntime(s).teamAI!.transfers).toEqual([]);
  expect(issueCommand(s,0,{type:'transferResources',recipient:1,resources:{wood:0,ore:0,crystal:1}})).toBe(true);const totals=s.players.reduce((a,p)=>({wood:a.wood+p.wood,ore:a.ore+p.ore,crystal:a.crystal+p.crystal}),{wood:0,ore:0,crystal:0});runAI(s,1);
  expect(directive(s).status).toBe('completed');expect(s.players[1]).toMatchObject({wood:70,ore:20,crystal:9});runAI(s,1);expect(captureRuntime(s).teamAI!.transfers).toHaveLength(2);
  expect(s.players.reduce((a,p)=>({wood:a.wood+p.wood,ore:a.ore+p.ore,crystal:a.crystal+p.crystal}),{wood:0,ore:0,crystal:0})).toEqual(totals);const restored=loadGame(saveGame(s));advancePair(s,restored,20);
 });

 it('releases a defender and its arrival timer during real traversal before the next AI decision',()=>{
  const s=fixture(),entry=s.world!.transitions[0],fighter=s.entities.find(e=>e.side===1&&e.role==='melee')!;Object.assign(fighter,entry.from);refreshVisibility(s);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'defend',...entry.from})).toBe(true);runAI(s,1);expect(directive(s).assigned).toEqual([fighter.id]);
  const rt=captureRuntime(s);rt.aiDecisionAt[1]=3;rt.teamAI!.directives[0].arrivedAt=s.time;restoreRuntime(s,rt);
  const malformed=saveGame(s);malformed.runtime.teamAI!.directives[0].destination!.level=1;expect(()=>loadGame(malformed)).toThrow(/level/);
  expect(issueCommand(s,1,{type:'traverse',ids:[fighter.id],transition:entry.id})).toBe(true);
  for(let i=0;i<60&&fighter.level===0;i++)stepGame(s,.05);expect(fighter.level).toBe(1);expect(directive(s).assigned).toEqual([]);expect(directive(s).arrivedAt).toBeUndefined();
  const restored=loadGame(saveGame(s));advancePair(s,restored,40);expect(directive(s).status).toBe('active');
 });

 it('chooses a full eligible solo army without a cavern fighter blocking its surface target',()=>{
  const a:TeamAiReport={side:0,teamId:0,time:22,hq:{x:5,y:5},fighters:Array.from({length:4},(_,i)=>({id:i+1,role:'melee',x:6+i,y:5,level:0})),threats:[],targets:[{key:'hq:99',kind:'hq',observer:0,seenAt:0,x:20,y:20,level:0}],readyToAttack:true,soloReadyToAttack:true,soloAttackSize:4,waveReadyAt:10,scoutingNeeded:false},b:TeamAiReport={...a,side:1,fighters:[],readyToAttack:false,soloReadyToAttack:false};
  a.fighters.push({id:5,role:'melee',x:6,y:5,level:1});expect(coordinateTeamAi(emptyTeamAiState().coordinator,[a,b],22).launches[0].ids).toEqual([1,2,3,4]);
  a.fighters=a.fighters.slice(0,2).concat(a.fighters.slice(4));expect(coordinateTeamAi(emptyTeamAiState().coordinator,[a,b],22).launches).toEqual([]);
 });

 it('keeps stacked target choice stable under target permutation and rejects malformed level counts',()=>{
  const context:TeamAiValidationContext={playerCount:2,teams:[0,0],time:0,nextEntityId:100,width:64,height:64};
  for(const levels of [NaN,Infinity,0,3,1.5])expect(()=>validateTeamAiState(emptyTeamAiState(),{...context,levels})).toThrow(/levels/);
  const target={key:'hq:99',kind:'hq' as const,observer:0 as const,seenAt:10,x:20,y:20};
  const report=(side:0|1):TeamAiReport=>({side,teamId:0,time:10,hq:{x:5,y:5},fighters:Array.from({length:4},(_,i)=>({id:side*10+i+1,role:'melee',x:6+i,y:5,level:i<2?0:1})),threats:[],targets:[{...target,observer:side,level:0},{...target,observer:side,level:1}],readyToAttack:true,waveReadyAt:10,scoutingNeeded:false});
  const reports=[report(0),report(1)],a=coordinateTeamAi(emptyTeamAiState().coordinator,reports,10),b=coordinateTeamAi(emptyTeamAiState().coordinator,reports.map(r=>({...r,targets:[...r.targets].reverse()})),10);expect(b).toEqual(a);expect(a.coordinator.waves[0].target.level).toBe(0);
 });

 it('keeps authoritative state and future simulation unchanged during observations and remote rendering',()=>{
  const s=fixture(),initial=JSON.stringify(saveGame(s));alliedAiStatus(s,0);const first=new OnlineView(0).observe(s);observationToRenderState(first);expect(JSON.stringify(saveGame(s))).toBe(initial);
  expect(issueCommand(s,0,{type:'allyDirective',ally:1,directive:'scout',x:12.5,y:12.5,level:1})).toBe(true);const restored=loadGame(saveGame(s));
  for(let i=0;i<50;i++){const before=JSON.stringify(saveGame(s)),view=new OnlineView(0).observe(s),render=observationToRenderState(view);expect(render.alliedAi).toEqual(view.alliedAi);expect(JSON.stringify(saveGame(s))).toBe(before);stepGame(s,.05);stepGame(restored,.05);expect(JSON.stringify(saveGame(restored))).toBe(JSON.stringify(saveGame(s)));}
 });
});
