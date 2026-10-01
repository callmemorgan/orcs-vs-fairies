import { describe,expect,it } from 'vitest';
import { createGame } from '../src/core/simulation';
import { PlayerView,observedHealth } from '../src/core/observation';
import { applyOnlineRenderState,observationToRenderState } from '../src/online/render-state';
import type { PlayerObservation } from '../src/online/protocol';

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
});
