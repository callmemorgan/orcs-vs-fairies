import { describe,expect,it } from 'vitest';
import { createGame,createMatch } from '../src/core/simulation';
import { PlayerView,observedHealth } from '../src/core/observation';
import { applyOnlineRenderState,observationToRenderState } from '../src/online/render-state';
import type { PlayerObservation } from '../src/online/protocol';
import type { Side,FactionId } from '../src/core/types';

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
});
