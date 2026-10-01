import { describe,expect,it } from 'vitest';
import { createGame,createMatch,issueCommand,refreshVisibility } from '../src/core/simulation';
import { FACTIONS } from '../src/core/content';
import { factionCommandReason } from '../src/core/faction-systems';
import { initializeTactics,isCrewless,tacticalUnitDef } from '../src/core/tactics';
import { PlayerView,observedHealth } from '../src/core/observation';
import { applyOnlineRenderState,observationToRenderState } from '../src/online/render-state';
import type { PlayerObservation } from '../src/online/protocol';
import type { GameState,Side,FactionId } from '../src/core/types';
import { OnlineView } from '../src/server/views';
import { teamObservation } from '../src/server/team-view';
import { advanceFactionFixture,createFactionFixture } from '../scripts/factions/fixture-state';
import { advanceTacticsFixture,createTacticsFixture } from '../scripts/tactics/fixture-state';

/** Use the production server projection and its JSON wire representation. */
function onlineObservation(state:GameState,side:Side=0):PlayerObservation {
  return JSON.parse(JSON.stringify(new OnlineView(side).observe(state))) as PlayerObservation;
}
function ownedEntry(view:PlayerObservation,id:number){
  const entity=view.entities.find(item=>item.id===id);
  if(!entity||!('order' in entity))throw new Error(`Expected an owned observation for entity ${id}.`);
  return entity;
}

function observation(side:0|1=1):PlayerObservation {
  const state=createGame('orcs',4127,'fairies',{controllers:['external','external']});
  const raw=new PlayerView(side).observe(state);
  const {seed:_seed,starts:_starts,...map}=raw.map;
  return {...raw,map:{...map,starts:state.starts.map((start,index)=>index===side?start:null)},entities:raw.entities.map(entity=>({...entity,facing:1,animation:'idle',animTime:0})),events:[]} as PlayerObservation;
}
describe('display-only online state',()=>{
  it('preserves the local side, private economy and authorized terrain while keeping missing information unavailable',()=>{
    const view=observation(),render=observationToRenderState(view);
    expect(render.localSide).toBe(1);expect(render.state.players[1]).toEqual(view.player);expect(render.privateSides).toEqual(new Set([1]));
    expect(render.state.players[0]).toEqual({faction:'orcs',wood:0,ore:0,crystal:0,population:0,cap:0,upgrades:[]});
    expect(render.state.seed).toBe(0);expect(render.hiddenStarts).toEqual(new Set([0]));
    expect(render.state.explored[1]).toEqual(new Set(view.explored));expect(render.state.visible[0].size).toBe(0);
    expect(render.unknownTerrain.size).toBeGreaterThan(0);expect(render.state.entities.map(entity=>entity.id)).toEqual(view.entities.map(entity=>entity.id));
    view.player.upgrades.push('worker-speed');expect(render.state.players[1].upgrades).toEqual([]);
  });
  it('does not reveal enemy private fields or double-disguise already public health',()=>{
    const view=observation();const own=view.entities[0];
    const enemy={...own,id:999,side:0,hp:65,maxHp:130,illusion:true,order:{type:'attack',target:77},queue:['siege'],research:'citadel-age',researchProgress:.9,carried:999,rally:{x:1,y:1},path:[{x:0,y:0}]};
    view.entities.push(enemy as never);const render=observationToRenderState(view),display=render.state.entities.find(entity=>entity.id===999)!;
    expect(display).toMatchObject({hp:65,maxHp:130,illusion:false,order:{type:'idle'},queue:[],researchProgress:0,carried:0,path:[]});
    expect(display.research).toBeUndefined();expect(display.rally).toBeUndefined();expect(observedHealth(render.state,1,display)).toEqual({hp:65,maxHp:130});
  });
  it('applies authoritative snapshots without retaining unknown extra fields',()=>{
    const old=createGame('orcs',9127);(old as unknown as Record<string,unknown>).serverSecret='old';
    const render=observationToRenderState(observation(),'spectator');applyOnlineRenderState(old,render);
    expect(old.tick).toBe(render.state.tick);expect(old.players[1].faction).toBe('fairies');expect('serverSecret' in old).toBe(false);expect(render.role).toBe('spectator');
  });
  it('preserves an eight-player public roster and teams without importing allied economy or orders',()=>{
    const factions:FactionId[]=['orcs','fairies','dwarves','undead','tideborn','automata','fairies','dwarves'];
    const state=createMatch({map:{seed:919,size:'huge'},players:factions.map((factionId,id)=>({id:id as Side,teamId:(id%2) as Side,factionId,controller:'external'})),rules:{sharedVision:true}});
    const raw=new PlayerView(7).observe(state),{seed:_seed,starts:_starts,...map}=raw.map;
    const view={...raw,map:{...map,starts:state.starts.map((start,index)=>index%2===1?start:null)},entities:raw.entities.map(entity=>({...entity,facing:1,animation:'idle',animTime:0})),events:[]} as PlayerObservation;
    const render=observationToRenderState(view);expect(render.localSide).toBe(7);expect(render.state.players.map(player=>player.faction)).toEqual(factions);expect(render.state.teams).toEqual([0,1,0,1,0,1,0,1]);
    expect(render.state.sharedVision).toBe(true);expect(render.state.players[7].wood).toBe(state.players[7].wood);expect(render.privateSides).toEqual(new Set([7]));
    for(let side=0;side<7;side++){expect(render.state.players[side].wood).toBe(0);expect(render.state.players[side].upgrades).toEqual([]);}
    const ally=render.state.entities.find(entity=>entity.side===1)!;expect(ally).toBeDefined();expect(ally.order).toEqual({type:'idle'});expect(ally.queue).toEqual([]);
    expect(render.hiddenStarts).toEqual(new Set([0,2,4,6]));expect(render.state.eliminated).toEqual(raw.result.eliminated);
  });
  it('preserves owned damage timestamps while rejecting public enemy timestamps',()=>{
    const view=observation(),own=view.entities[0];Object.assign(own,{lastDamagedAt:9});view.entities.push({...own,id:999,side:0,lastDamagedAt:77} as never);
    const render=observationToRenderState(view);expect(render.state.entities[0].lastDamagedAt).toBe(9);expect(render.state.entities.find(entity=>entity.id===999)!.lastDamagedAt).toBeUndefined();
  });
  it('shows private team economy only for an authorized spectator team perspective',()=>{
    const state=createMatch({map:{seed:81,size:'large'},players:[0,1,2,3].map(id=>({id:id as Side,teamId:(id%2) as Side,factionId:'orcs',controller:'external'})),rules:{sharedVision:true}});
    state.players[2].wood=987;const raw=new PlayerView(0).observe(state),member=new PlayerView(2).observe(state),{seed:_seed,starts:_starts,...map}=raw.map;
    const view={...raw,map:{...map,starts:state.starts.map((start,index)=>index%2===0?start:null)},entities:raw.entities.map(entity=>({...entity,facing:1,animation:'idle',animTime:0})),events:[],teamPerspective:true,teamPlayers:[{side:2,player:member.player},{side:1,player:{...state.players[1],wood:9999}}]} as PlayerObservation;
    expect(observationToRenderState(view,'player').state.players[2].wood).toBe(0);
    const render=observationToRenderState(view,'spectator');expect(render.privateSides).toEqual(new Set([0,2]));expect(render.state.players[2].wood).toBe(987);expect(render.state.players[1].wood).toBe(0);
  });

  it('preserves an owned formation and paid chant through OnlineView, JSON and hydration',()=>{
    const f=createFactionFixture();
    expect(issueCommand(f.state,0,{type:'formation',ids:[f.soldier.id],formation:'wedge',spacing:1.4,facing:6})).toBe(true);
    expect(issueCommand(f.state,0,{type:'warChant',ids:[f.soldier.id],chant:'assault'})).toBe(true);
    const tactics=initializeTactics(f.state,f.soldier);tactics.morale=73;tactics.recentLoss=8;tactics.retreat={x:10,y:17,level:0,until:8};tactics.surrenderedTo=1;tactics.charge={distance:2,heading:6,lastMovedAt:0};tactics.ambush={radius:2,target:'cavalry',concealed:true,armedAt:0};tactics.capture={target:f.siege.id,progress:.4};
    const view=onlineObservation(f.state),render=observationToRenderState(view),unit=render.state.entities.find(item=>item.id===f.soldier.id)!;
    expect(unit.tactics).toEqual(f.soldier.tactics);expect(unit.factionState).toEqual(f.soldier.factionState);expect(unit.facing).toBe(6);expect(unit.order).toEqual(f.soldier.order);
    expect(render.state.factionSystems).toEqual({version:1,fury:[75,0],terrainEffects:[]});
    expect(factionCommandReason(render.state,0,{type:'warChant',ids:[unit.id],chant:'bulwark'})).toBeNull();
    const source=ownedEntry(view,unit.id);source.tactics!.formation!.anchor.x=999;source.tactics!.charge!.distance=999;source.factionState!.chant!.until=999;
    expect(unit.tactics!.formation!.anchor.x).toBe(f.soldier.tactics!.formation!.anchor.x);expect(unit.tactics!.charge!.distance).toBe(2);expect(unit.factionState!.chant!.until).toBe(12);
    expect(render.state.tick).toBe(view.tick);expect(render.state.time).toBe(view.time);
  });

  it('preserves owned wagon manifests, recruitment costs and delivery state from real commands',()=>{
    const f=createFactionFixture('undead'),wagonId=f.wagon!.id,deadline=f.corpse!.expires;
    expect(issueCommand(f.state,0,{type:'train',id:f.barracks.id,role:'special',definitionId:'core:undead-corpse-wagon'})).toBe(true);
    expect(issueCommand(f.state,0,{type:'collectCorpses',ids:[wagonId],target:f.corpse!.id})).toBe(true);advanceFactionFixture(f.state,1.1);
    const view=onlineObservation(f.state),render=observationToRenderState(view),wagon=render.state.entities.find(item=>item.id===wagonId)!,barracks=render.state.entities.find(item=>item.id===f.barracks.id)!;
    expect(wagon.definitionId).toBe('core:undead-corpse-wagon');expect(tacticalUnitDef(render.state,wagon).name).toBe('Corpse Wagon');expect(wagon.factionState!.corpseCargo).toEqual(f.wagon!.factionState!.corpseCargo);expect(wagon.factionState!.corpseCargo![0].expires).toBe(deadline);
    expect(barracks.queueDefinitionIds).toEqual(['core:undead-corpse-wagon']);expect(barracks.queuePaidCosts).toEqual([{wood:100,ore:45,crystal:0}]);expect(barracks.trainProgress).toBe(f.barracks.trainProgress);
    expect(factionCommandReason(render.state,0,{type:'deliverCorpses',ids:[wagonId],target:f.special.id})).toBeNull();
    const wagonSource=ownedEntry(view,wagonId),barracksSource=ownedEntry(view,f.barracks.id);
    wagonSource.factionState!.corpseCargo![0].expires=999;if('queuePaidCosts' in barracksSource)barracksSource.queuePaidCosts![0].wood=999;
    expect(wagon.factionState!.corpseCargo![0].expires).toBe(deadline);expect(barracks.queuePaidCosts![0].wood).toBe(100);
    expect(issueCommand(f.state,0,{type:'deliverCorpses',ids:[wagonId],target:f.special.id})).toBe(true);advanceFactionFixture(f.state,1);
    const channel=observationToRenderState(onlineObservation(f.state)).state.entities.find(item=>item.id===wagonId)!;expect(channel.factionState!.corpseOrder).toEqual(f.wagon!.factionState!.corpseOrder);expect(channel.factionState!.corpseOrder!.progress).toBeGreaterThan(0);
    advanceFactionFixture(f.state,4);applyOnlineRenderState(render.state,observationToRenderState(onlineObservation(f.state)));
    expect(render.state.entities.find(item=>item.id===wagonId)!.factionState!.corpseCargo).toEqual([]);const delivered=render.state.entities.find(item=>item.id===f.special.id)!.factionState!.deliveredCorpses!;expect(delivered).toEqual(f.special.factionState!.deliveredCorpses);expect(delivered[0].expires).toBe(deadline);
  });

  it('strips injected hostile manifests, orders and timers while retaining public tactics and faction effects',()=>{
    const f=createFactionFixture(),hostile=f.state.entities.find(item=>item.side===1&&item.role==='melee')!;hostile.x=15;hostile.y=18;refreshVisibility(f.state);
    const view=onlineObservation(f.state),source=view.entities.find(item=>item.id===hostile.id)!;expect(source).toBeDefined();
    Object.assign(source,{owner:0,definitionId:'core:dwarves-siege',definitionFaction:'dwarves',order:{type:'attack',target:f.worker.id},orderQueue:[{type:'gather',target:90}],queue:['siege'],queueDefinitionIds:['secret:weapon'],queuePaidCosts:[{wood:999,ore:777,crystal:555}],rally:{x:30,y:30},carried:999,carriedKind:'crystal',cooldown:90,abilityReadyAt:95,expires:99,lastDamagedAt:92,research:'citadel-age',researchProgress:.9,path:[{x:30,y:30}],factionState:{chant:{kind:'bulwark',until:12,secret:'chant'},artillery:'reinforced',power:{connected:true,root:987,secret:'power'},trophyKills:12,swapReadyAt:95,tunnel:{target:98,progress:.5},corpseCargo:[{id:99,x:30,y:30,expires:100}],deliveredCorpses:[{id:100,x:30,y:30,expires:100}],corpseOrder:{type:'deliver',target:101,progress:.2},nextDecoyAt:88,waterReadyAt:77,secret:'faction'},tactics:{morale:61,recentLoss:90,siegeCrew:{hp:42,maxHp:42,uncrewed:false,secret:'crew'},guard:{value:17,max:40,lastDamagedAt:6,secret:'guard'},formation:{kind:'square',group:'secret',slot:0,count:4,spacing:1,facing:2,anchor:{x:30,y:30},phase:'moving'},retreat:{x:31,y:31,until:45},surrenderedTo:0,ambush:{radius:5,target:'worker',concealed:true,armedAt:3},charge:{distance:8,heading:4,lastMovedAt:7},capture:{target:777,progress:.9},secret:'tactics'}});
    const display=observationToRenderState(view).state.entities.find(item=>item.id===hostile.id)!;
    expect(display).toMatchObject({definitionId:'core:dwarves-siege',definitionFaction:'dwarves',order:{type:'idle'},queue:[],cooldown:0,expires:0,carried:0,path:[]});
    for(const key of ['orderQueue','queueDefinitionIds','queuePaidCosts','rally','abilityReadyAt','lastDamagedAt','research'])expect(display).not.toHaveProperty(key);
    expect(display.tactics).toEqual({morale:61,recentLoss:0,siegeCrew:{hp:42,maxHp:42,uncrewed:false},guard:{value:17,max:40,lastDamagedAt:6}});
    expect(display.factionState).toEqual({chant:{kind:'bulwark',until:12},artillery:'reinforced',power:{connected:true,root:null}});
  });

  it('preserves neutral engine crew and captured definitions without trusting injected private ownership',()=>{
    const f=createTacticsFixture();f.engine.side=0;f.engine.definitionId=FACTIONS.fairies.units.siege.id;f.engine.lastDamagedAt=9;refreshVisibility(f.state);
    const view=onlineObservation(f.state),source=view.entities.find(item=>item.id===f.engine.id)!;expect(source.owner).toBeNull();expect(source).not.toHaveProperty('order');
    Object.assign(source,{order:{type:'attack',target:777},queue:['siege'],queueDefinitionIds:['secret:engine'],queuePaidCosts:[{wood:999,ore:999,crystal:999}],rally:{x:30,y:30},cooldown:88,abilityReadyAt:77,factionState:{swapReadyAt:99,corpseCargo:[{id:99,x:30,y:30,expires:99}]},tactics:{...source.tactics,formation:{kind:'square',group:'secret',slot:0,count:4,spacing:1,facing:2,anchor:{x:30,y:30},phase:'moving'}}});
    const render=observationToRenderState(view),neutral=render.state.entities.find(item=>item.id===f.engine.id)!;expect(isCrewless(neutral)).toBe(true);expect(neutral.definitionFaction).toBe('fairies');expect(tacticalUnitDef(render.state,neutral).id).toBe(FACTIONS.fairies.units.siege.id);expect(neutral.order).toEqual({type:'idle'});expect(neutral.queue).toEqual([]);expect(neutral.queueDefinitionIds).toBeUndefined();expect(neutral.cooldown).toBe(0);expect(neutral.lastDamagedAt).toBeUndefined();expect(neutral.factionState).toEqual({});expect(neutral.tactics!.formation).toBeUndefined();
    expect(issueCommand(f.state,0,{type:'captureSiege',ids:[f.worker.id],target:f.engine.id})).toBe(true);advanceTacticsFixture(f.state,6);
    applyOnlineRenderState(render.state,observationToRenderState(onlineObservation(f.state)));const captured=render.state.entities.find(item=>item.id===f.engine.id)!;
    expect(isCrewless(captured)).toBe(false);expect(captured.side).toBe(0);expect(captured.definitionFaction).toBe('fairies');expect(captured.definitionId).toBe(FACTIONS.fairies.units.siege.id);expect(tacticalUnitDef(render.state,captured).name).toBe(FACTIONS.fairies.units.siege.name);expect(captured.tactics!.siegeCrew!.hp).toBe(42);
  });

  it('hydrates full teammate tactics only for the authorized spectator team perspective',()=>{
    const state=createMatch({map:{seed:81,size:'large'},players:[0,1,2,3].map(id=>({id:id as Side,teamId:(id%2) as Side,factionId:'orcs',controller:'external'})),rules:{sharedVision:true}}),ally=state.entities.find(item=>item.side===2&&item.role==='melee')!;
    expect(issueCommand(state,2,{type:'formation',ids:[ally.id],formation:'line',spacing:1.2,facing:4})).toBe(true);ally.factionState={trophyKills:3,chant:{kind:'assault',until:12},swapReadyAt:17};state.factionSystems!.fury=[25,90,55,80];
    const view=teamObservation(state.players.map((_,side)=>onlineObservation(state,side as Side)),0),player=observationToRenderState(view),spectator=observationToRenderState(view,'spectator'),publicAlly=player.state.entities.find(item=>item.id===ally.id)!,privateAlly=spectator.state.entities.find(item=>item.id===ally.id)!;
    expect(player.privateSides).toEqual(new Set([0]));expect(publicAlly.tactics!.formation).toBeUndefined();expect(publicAlly.factionState).toEqual({chant:{kind:'assault',until:12}});expect(publicAlly.order).toEqual({type:'idle'});
    expect(spectator.privateSides).toEqual(new Set([0,2]));expect(privateAlly.tactics).toEqual(ally.tactics);expect(privateAlly.factionState).toEqual(ally.factionState);expect(privateAlly.order).toEqual(ally.order);expect(spectator.state.factionSystems!.fury).toEqual([25,0,0,0]);
  });

  it('retains disclosed projectiles and splash rules without copying damage or hidden launch origins',()=>{
    const f=createFactionFixture('dwarves'),own=f.siege,enemy=f.state.entities.find(item=>item.side===1&&item.role==='melee')!;
    f.state.friendlyFire=false;f.state.rules.friendlyFire=false;f.state.projectiles=[
      {id:f.state.nextId++,source:own.id,side:0,faction:'dwarves',from:{x:own.x,y:own.y,level:0},x:16,y:17,damage:89,buildingMultiplier:2,impactAt:2,radius:2.5,modification:'grapeshot'},
      {id:f.state.nextId++,source:enemy.id,side:1,faction:'orcs',from:{x:f.state.width-2,y:f.state.height-2},x:15,y:17,damage:777,buildingMultiplier:3,impactAt:3,radius:1.75},
      {id:f.state.nextId++,source:enemy.id,side:1,faction:'orcs',from:{x:f.state.width-2,y:f.state.height-2},x:f.state.width-2,y:f.state.height-2,damage:999,buildingMultiplier:5,impactAt:4,radius:9},
    ];refreshVisibility(f.state);
    const view=onlineObservation(f.state);expect(view.projectiles).toHaveLength(2);expect(view.projectiles[1].from).toBeUndefined();
    Object.assign(view.projectiles[0],{damage:999,source:999,buildingMultiplier:999,modification:'incendiary'});view.projectiles[1].from={x:f.state.width-2,y:f.state.height-2};Object.assign(view.rules,{privateUpgrade:'secret'});Object.assign(view.rules.hill,{privateClock:777});Object.assign(view.rules.survival.rewardPerWave,{privateBalance:999});Object.assign(view.rules.startingResources,{privateIncome:666});
    const render=observationToRenderState(view);expect(render.state.projectiles).toEqual([{id:f.state.projectiles[0].id,side:0,x:16,y:17,from:{x:own.x,y:own.y,level:0},impactAt:2,radius:2.5},{id:f.state.projectiles[1].id,side:1,x:15,y:17,from:undefined,impactAt:3,radius:1.75}]);
    expect(render.state.friendlyFire).toBe(false);expect(render.state.rules).toEqual(f.state.rules);expect(render.objectiveView.rules).toEqual(f.state.rules);
    view.projectiles[0].from!.x=999;view.rules.friendlyFire=true;view.rules.hill.holdTicks++;view.rules.survival.rewardPerWave.wood++;view.rules.disabledDefinitionIds.push('worker-speed');
    expect(render.state.projectiles![0].from.x).toBe(own.x);expect(render.state.friendlyFire).toBe(false);expect(render.state.rules).toEqual(f.state.rules);expect(render.objectiveView.rules).toEqual(f.state.rules);
    render.state.rules.hill.holdTicks++;expect(render.objectiveView.rules.hill.holdTicks).toBe(f.state.rules.hill.holdTicks);
  });

  it('copies disclosed spatial levels and only the local Fury scalar, with no hidden runtime effects',()=>{
    const f=createFactionFixture('undead');f.worker.level=1;f.state.starts[0].level=1;f.state.corpses.push({id:f.state.nextId++,x:f.worker.x,y:f.worker.y,level:1,expires:45});f.state.resources.push({id:f.state.nextId++,kind:'ore',x:f.worker.x,y:f.worker.y,level:1,amount:12,maxAmount:20});
    // Both layers are disclosed here; hydration must retain each coordinate's level.
    const tile=Math.floor(f.worker.y)*f.state.width+Math.floor(f.worker.x);f.state.visible[0].add(tile);f.state.visible[0].add(f.state.width*f.state.height+tile);f.state.factionSystems!.fury=[31,99];
    const view=onlineObservation(f.state);Object.assign(view.factionSystems,{terrainEffects:[{id:999,side:1,until:99,tiles:[{x:1,y:1,level:0,before:'grass',after:'water'}]}],otherFury:[31,99]});
    const render=observationToRenderState(view);expect(render.state.entities.find(item=>item.id===f.worker.id)!.level).toBe(1);expect(render.state.starts[0].level).toBe(1);expect(render.state.resources.find(item=>item.kind==='ore')!.level).toBe(1);expect(render.state.corpses.find(item=>item.level===1)).toBeDefined();expect(render.state.factionSystems).toEqual({version:1,fury:[31,0],terrainEffects:[]});
    (view.factionSystems as unknown as {fury:number[]}).fury=[31,99];expect(observationToRenderState(view).state.factionSystems!.fury).toEqual([0,0]);
    const legacy={...view,factionSystems:undefined,projectiles:undefined,rules:undefined} as unknown as PlayerObservation;const old=observationToRenderState(legacy);expect(old.state.projectiles).toEqual([]);expect(old.state.factionSystems!.fury).toEqual([0,0]);expect(old.state.friendlyFire).toBe(true);
  });
});
