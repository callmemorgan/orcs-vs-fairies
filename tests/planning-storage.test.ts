import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/simulation';
import { addBlueprint, createPlanningRuntime } from '../src/core/planning';
import { createSessionFile, decodeSessionFile, decodeSessionPlanning } from '../src/core/session-storage';
import { MatchRecorder } from '../src/core/replays';
import { saveGame } from '../src/core/saves';

describe('session planning persistence',()=>{
  it('round-trips inactive and active targets and deferred fractional blueprints with the match',()=>{
    const state=createGame('orcs',4127,'fairies',{controllers:['external','external'],mapSize:'small'}),players=state.players.map((_,side)=>createPlanningRuntime(side as 0|1));
    players[0].targets={wood:2,ore:1,crystal:0};
    const start=state.starts[0];addBlueprint(state,0,players[0].construction,{role:'depot',x:start.x+6.123,y:start.y+2.345});
    const recorder=new MatchRecorder(state),planning={version:1 as const,players,automaticSides:[0 as const]},file=createSessionFile(state,recorder.export(),planning);
    const decoded=decodeSessionFile(JSON.stringify(file));
    expect(decoded.file.planning).toEqual(planning);expect(saveGame(decoded.state)).toEqual(saveGame(state));
    decoded.file.planning!.players[0].targets.wood=8;expect(planning.players[0].targets.wood).toBe(2);
    expect(decodeSessionPlanning({version:1,players},state).automaticSides).toEqual([]);recorder.dispose();
  });
  it('rejects malformed rosters, foreign plans and activation without mutating the live match',()=>{
    const state=createGame('orcs',4127,'fairies',{mapSize:'small'}),players=state.players.map((_,side)=>createPlanningRuntime(side as 0|1)),before=saveGame(state);
    const sparse=Array(2);sparse[0]=players[0];
    for(const planning of [
      {version:1,players:players.slice(1)}, {version:1,players:sparse},
      {version:1,players:[players[1],players[0]]}, {version:1,players,automaticSides:null},
      {version:1,players,automaticSides:Array(1)}, {version:1,players,automaticSides:[0,0]},
      {version:1,players,automaticSides:[2]}, {version:1,players,unexpected:true},
    ])expect(()=>decodeSessionPlanning(planning,state)).toThrow();
    expect(saveGame(state)).toEqual(before);
  });
});
