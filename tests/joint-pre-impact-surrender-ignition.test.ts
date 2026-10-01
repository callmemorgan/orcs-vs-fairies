import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { environmentPhase } from '../src/core/environment';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { saveGame } from '../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import type { Command, GameEvent, GameState, Side } from '../src/core/types';

function command(state: GameState, side: Side, value: Command) {
  expect(issueCommand(state, side, value), JSON.stringify(value)).toBe(true);
}
function advance(state: GameState, seconds: number): GameEvent[] {
  const end=state.time+seconds,events:GameEvent[]=[];
  while(state.time+1e-8<end){const before=state.time;stepGame(state,Math.min(.05,end-state.time));expect(state.time).toBeGreaterThan(before);events.push(...state.events.map(event=>({...event})));}
  return events;
}

describe('real surrender before a fitted special incendiary shell impacts',()=>{
  it.each([0,1])('keeps original launch-side world ignition after public surrender on level %s',level=>{
    const state=createMatch({map:{seed:4127,size:'small',biome:'forest'},rules:{startingAge:3,friendlyFire:false},players:[
      {id:0,teamId:0,factionId:'dwarves',controller:'external',handicap:{startingResources:{wood:2000,ore:2000,crystal:500}}},
      {id:1,teamId:1,factionId:'orcs',controller:'external'},
      {id:2,teamId:2,factionId:'fairies',controller:'external'},
    ]});
    state.entities=state.entities.filter(entity=>entity.role==='hq');state.resources=[];
    for(const [index,hq] of state.entities.entries()){hq.x=3.5+index*14;hq.y=3.5;}
    for(const layer of state.world!.levels){layer.terrain.fill('grass');layer.elevation.fill(0);}
    Object.assign(state.world!,{revision:0,transitions:[],bridges:[],sites:[],creatures:[],fires:[],iceTiles:[],dayLength:10000,seasonLength:10000,weatherLength:10000});
    for(let seed=1;seed<=1000;seed++){state.seed=seed;if(environmentPhase(state).weather==='clear')break;}
    const impact={x:23.5,y:18.5,level};
    state.world!.levels[level].terrain[18*state.width+23]='forest';
    state.resources.push({id:state.nextId++,...impact,kind:'wood',amount:500,maxAmount:500});
    function actor(side:Side,id:string,x:number,y:number){const entity=spawnDefinition(state,side,'unit',id,x,y,1,level);entity.order={type:'hold'};entity.cooldown=100;entity.facing=4;return entity;}
    const gun=actor(0,FACTIONS.dwarves.units.special.id,18.5,18.5);gun.cooldown=0;gun.tactics!.morale=23.5;
    const victim=actor(2,'core:fairies-engineer',impact.x,impact.y);
    // Authored Wardrums begin in three nearby sectors. Their real first hits
    // break morale while the already-launched shell is still in flight.
    const captors=[[17.4,18.5],[18.5,17.4],[18.5,19.6]].map(([x,y])=>actor(1,FACTIONS.orcs.units.special.id,x,y));
    for(const captor of captors)captor.cooldown=0;
    refreshVisibility(state);const recorder=new MatchRecorder(state);
    try{
      command(state,0,{type:'modifyArtillery',ids:[gun.id],modification:'incendiary'});
      command(state,0,{type:'attack',ids:[gun.id],target:victim.id});
      command(state,1,{type:'attack',ids:captors.map(entity=>entity.id),target:gun.id});
      advance(state,.05);expect(state.projectiles).toHaveLength(1);expect(gun.side).toBe(0);
      const shot=state.projectiles![0];expect(shot.side).toBe(0);expect(shot.source).toBe(gun.id);expect(shot.modification).toBe('incendiary');
      const transfer=advance(state,.05);expect(gun.side).toBe(1);expect(gun.tactics!.surrenderedTo).toBe(1);expect(gun.definitionFaction).toBe('dwarves');
      expect(transfer.filter(event=>event.source===gun.id&&event.text==='A surrounded unit surrendered')).toHaveLength(1);
      expect(state.time).toBeLessThan(shot.impactAt);expect(state.world!.fires).toHaveLength(0);expect(state.projectiles).toHaveLength(1);
      command(state,1,{type:'move',ids:[gun.id,...captors.map(entity=>entity.id)],x:12.5,y:18.5,level});
      const paid={wood:state.players[0].wood,ore:state.players[0].ore},resumed=decodeSessionFile(JSON.stringify(createSessionFile(state,recorder.export()))).state;
      expect(saveGame(resumed)).toEqual(saveGame(state));
      expect(resumed.entities.find(entity=>entity.id===gun.id)!.side).toBe(1);expect(resumed.projectiles![0].side).toBe(0);
      const remaining=shot.impactAt-state.time,events=advance(state,remaining);advance(resumed,remaining);
      expect(gun.side).toBe(1);expect(state.projectiles).toHaveLength(0);expect(state.world!.fires).toHaveLength(1);
      expect(state.world!.fires[0]).toMatchObject(impact);
      expect(events.filter(event=>event.text==='Incendiary shell ignited timber.')).toHaveLength(1);
      expect(events.find(event=>event.text==='Incendiary shell ignited timber.')).toMatchObject({side:0,source:gun.id,level});
      expect({wood:state.players[0].wood,ore:state.players[0].ore}).toEqual(paid);expect(saveGame(resumed)).toEqual(saveGame(state));
      const replay=new ReplayPlayer(recorder.export());try{replay.seek(state.tick);expect(saveGame(replay.state)).toEqual(saveGame(state));}finally{replay.dispose();}
    }finally{recorder.dispose();}
  });
});
