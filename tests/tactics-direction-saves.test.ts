import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { DIRECTIONS_32 } from '../src/core/geometry';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';

describe('tactical directions in native saves and replays', () => {
  const cases = [undefined, 0, 1].flatMap(level => Array.from({length: 8}, (_, facing) => [level, facing] as const));
  it.each(cases)('preserves direction %s/%s independently of map layers', (level, facing) => {
    const s = createMatch({ map: {seed: 4127, size: 'small', ...(level === undefined ? {} : {biome: 'forest' as const})}, players: [
      {id: 0, teamId: 0, factionId: 'orcs', controller: 'external'},
      {id: 1, teamId: 1, factionId: 'fairies', controller: 'external'},
    ] });
    s.entities = s.entities.filter(e => e.role === 'hq'); s.resources = [];
    for(const hq of s.entities){hq.x=hq.side===0?2.5:s.width-2.5;hq.y=hq.side===0?2.5:s.height-2.5;}
    s.terrain.fill('grass');
    for (const layer of s.world?.levels ?? []) {layer.terrain.fill('grass');layer.elevation.fill(0);}
    if(s.world)Object.assign(s.world,{bridges:[],transitions:[],sites:[],creatures:[],fires:[],iceTiles:[]});
    const troop=spawnDefinition(s,0,'unit',FACTIONS.orcs.units.melee.id,18.5,18.5,1,level),rider=spawnDefinition(s,0,'unit',FACTIONS.orcs.units.cavalry.id,26.5,26.5,1,level);
    troop.order={type:'hold'};rider.order={type:'hold'};refreshVisibility(s);
    const recorder=new MatchRecorder(s),[dx,dy]=DIRECTIONS_32[facing*4];
    expect(issueCommand(s,0,{type:'formation',ids:[troop.id],formation:'wedge',spacing:1,facing})).toBe(true);
    expect(issueCommand(s,0,{type:'move',ids:[rider.id],x:rider.x+dx*5,y:rider.y+dy*5,level})).toBe(true);
    for(let i=0;i<10;i++)stepGame(s,.05);
    expect(rider.tactics?.charge?.heading).toBe(facing);expect(rider.tactics?.charge?.distance).toBeGreaterThan(0);
    const restored=loadGame(saveGame(s));
    expect(restored.entities.find(e=>e.id===troop.id)?.tactics?.formation?.facing).toBe(facing);
    expect(restored.entities.find(e=>e.id===rider.id)?.tactics?.charge?.heading).toBe(facing);
    for(let i=0;i<10;i++){stepGame(s,.05);stepGame(restored,.05);}
    expect(saveGame(restored)).toEqual(saveGame(s));
    const replay=new ReplayPlayer(recorder.export());replay.seek(s.tick);expect(saveGame(replay.state)).toEqual(saveGame(s));
    const invalid=saveGame(s);invalid.state.entities.find(e=>e.id===troop.id)!.tactics!.formation!.facing=8;
    expect(()=>loadGame(invalid)).toThrow(/facing/);
    const invalidCharge=saveGame(s);invalidCharge.state.entities.find(e=>e.id===rider.id)!.tactics!.charge!.heading=8;
    expect(()=>loadGame(invalidCharge)).toThrow(/heading/);recorder.dispose();replay.dispose();
  });
});
