import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import { MatchRecorder, ReplayPlayer, decodeReplay, replayChecksum } from '../src/core/replays';
import { saveGame, loadGame } from '../src/core/saves';
import { FACTIONS, UPGRADES } from '../src/core/content';
import { SIMULATION_REVISION } from '../src/core/versions';

describe('browser replay simulation',()=>{
  it('rejects another deterministic rules revision before playback despite an unchanged save schema',()=>{
    const state=createGame('orcs',4127,'fairies',{mapSize:'small',controllers:['external','external']}),recorder=new MatchRecorder(state);
    stepGame(state,.05);const archive=recorder.export();recorder.dispose();
    expect(archive.simulationRevision).toBe(SIMULATION_REVISION);
    const changed={...archive,simulationRevision:'different-rules'};
    expect(()=>new ReplayPlayer(changed)).toThrow('rules different-rules');
    expect(()=>new MatchRecorder(loadGame(saveGame(state)),changed)).toThrow('Older replay history');
    expect(decodeReplay(changed).initial.version).toBe(archive.initial.version);
    expect(()=>decodeReplay({...archive,simulationRevision:{value:SIMULATION_REVISION}})).toThrow('rules revision');
    const same=new ReplayPlayer(archive);same.advance(1);expect(saveGame(same.state)).toEqual(saveGame(state));same.dispose();
  });
  it('reproduces external orders and AI decisions from accepted commands and completed steps',()=>{
    const state=createGame('orcs',4127,'automata',{mapSize:'small'}),recorder=new MatchRecorder(state);
    const worker=state.entities.find(e=>e.side===0&&e.role==='worker')!;
    expect(issueCommand(state,0,{type:'move',ids:[worker.id],x:worker.x+2,y:worker.y+1})).toBe(true);
    expect(issueCommand(state,0,{type:'move',ids:[999999],x:8,y:8})).toBe(false);
    for(let i=0;i<80;i++)stepGame(state,.05);
    expect(issueCommand(state,0,{type:'hold',ids:[worker.id]})).toBe(true);
    for(let i=0;i<40;i++)stepGame(state,.05);
    const archive=recorder.export();recorder.dispose();
    expect(archive.actions.filter(a=>a.type==='command')).toHaveLength(2);
    expect(archive.actions.filter(a=>a.type==='command').every(a=>a.side===0)).toBe(true);
    const player=new ReplayPlayer(archive);player.advance(120);
    expect(player.finished).toBe(true);expect(saveGame(player.state)).toEqual(saveGame(state));
    player.seek(20);expect(player.state.tick).toBe(20);player.seek(120);
    expect(replayChecksum(player.state)).toBe(archive.finalChecksum);
  });
  it('continues recording a restored saved match without losing its original history',()=>{
    const state=createGame('fairies',42,'orcs',{mapSize:'small',controllers:['human','external']}),first=new MatchRecorder(state);
    for(let i=0;i<20;i++)stepGame(state,.05);
    const checkpoint=saveGame(state),previous=first.export();first.dispose();
    const restored=loadGame(checkpoint),second=new MatchRecorder(restored,previous);
    const unit=restored.entities.find(e=>e.side===0&&e.role==='melee')!;
    expect(issueCommand(restored,0,{type:'hold',ids:[unit.id]})).toBe(true);
    for(let i=0;i<20;i++)stepGame(restored,.05);
    const archive=second.export(),player=new ReplayPlayer(archive);player.advance(40);
    expect(saveGame(player.state)).toEqual(saveGame(restored));second.dispose();
  });
  it('rejects unbounded work and malformed or divergent replay data',()=>{
    const state=createGame('orcs',3,'fairies',{mapSize:'small',controllers:['external','external']}),recorder=new MatchRecorder(state);
    for(let i=0;i<2;i++)stepGame(state,.05);
    const archive=recorder.export();recorder.dispose();
    const bad=structuredClone(archive);bad.actions=[{type:'advance',dt:.05,ticks:432001}];
    expect(()=>decodeReplay(bad)).toThrow();
    expect(()=>decodeReplay({...archive,actions:[{type:'command',side:0,command:{type:'move',ids:[1],x:NaN,y:4}}]})).toThrow();
    const divergent=new ReplayPlayer({...archive,finalChecksum:'00000000'});
    expect(()=>divergent.advance(2)).toThrow('diverged');
    expect(()=>new ReplayPlayer(archive).seek(3)).toThrow('outside');
  });
  it('does not record invalid or postgame timesteps',()=>{
    const state=createGame('orcs',1,'fairies',{mapSize:'small'}),recorder=new MatchRecorder(state);
    stepGame(state,NaN);stepGame(state,0);state.winner=0;state.winningTeam=state.teams[0];stepGame(state,.05);
    expect(recorder.export().actions).toEqual([]);recorder.dispose();
  });
  it('records research completion on its real tick rather than a chart sample interval',()=>{
    const state=createGame('orcs',1,'fairies',{mapSize:'small',controllers:['human','external']}),recorder=new MatchRecorder(state);
    const hq=state.entities.find(e=>e.side===0&&e.role==='hq')!;
    expect(issueCommand(state,0,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(true);
    while(!state.players[0].upgrades.includes('worker-harvest'))stepGame(state,.05);
    expect(recorder.technologyTimings).toEqual([{side:0,upgrade:'worker-harvest',tick:state.tick,time:state.time}]);
    expect(state.time).toBeGreaterThanOrEqual(UPGRADES['worker-harvest'].researchTime);
    const replay=new ReplayPlayer(recorder.export());replay.advance(state.tick);
    expect(replay.technologyTimings).toEqual(recorder.technologyTimings);recorder.dispose();replay.dispose();
  });
  it('seeks using proven checkpoints while preserving recording and future state',()=>{
    const state=createGame('fairies',42,'orcs',{mapSize:'small',controllers:['external','external']}),recorder=new MatchRecorder(state);
    for(let i=0;i<650;i++)stepGame(state,.05);
    const archive=recorder.export(),player=new ReplayPlayer(archive);player.advance(650);
    const candidate=player.forkForSeek(630);expect(candidate.state.tick).toBe(600);
    candidate.advance(50);expect(saveGame(candidate.state)).toEqual(saveGame(state));
    expect(candidate.exportCurrent().finalChecksum).toBe(archive.finalChecksum);
    expect(candidate.analysis).toEqual(player.analysis);
    player.seek(615);expect(player.state.tick).toBe(615);player.seek(650);expect(saveGame(player.state)).toEqual(saveGame(state));
    candidate.dispose();player.dispose();recorder.dispose();
  });
  it('keeps chart cadence unchanged by exports, reads and replay checkpoint creation',()=>{
    const state=createGame('fairies',42,'orcs',{mapSize:'small',controllers:['external','external']}),recorder=new MatchRecorder(state);
    for(let tick=0;tick<1300;tick++){stepGame(state,.05);if(tick%37===0){recorder.export();recorder.analysis;}}
    const archive=recorder.export(),player=new ReplayPlayer(archive);player.advance(1300);
    expect(player.analysis).toEqual(archive.analysis);
    const candidate=player.forkForSeek(1230);candidate.advance(1300-candidate.state.tick);
    expect(candidate.analysis).toEqual(archive.analysis);
    expect(archive.analysis.map(sample=>sample.tick)).toEqual(Array.from({length:14},(_,i)=>i*100));
    candidate.dispose();player.dispose();recorder.dispose();
  });
  it('derives economy deposits and unit/building loss values from simulation events',()=>{
    const state=createGame('orcs',2,'fairies',{mapSize:'small',controllers:['external','external']});
    const worker=state.entities.find(e=>e.side===0&&e.role==='worker')!,node=state.resources.find(r=>r.kind==='wood'&&state.visible[0].has(Math.floor(r.y)*state.width+Math.floor(r.x)))!;
    const recorder=new MatchRecorder(state),initialWood=state.players[0].wood;
    expect(issueCommand(state,0,{type:'gather',ids:[worker.id],target:node.id})).toBe(true);
    for(let i=0;i<900;i++)stepGame(state,.05);
    const economy=recorder.analysis.at(-1)!.players[0];expect(economy.gathered).toBeGreaterThan(0);expect(economy.gathered).toBeCloseTo(state.players[0].wood-initialWood,8);
    const enemy=state.entities.find(e=>e.side===1&&e.role==='melee')!;
    enemy.x=worker.x+.7;enemy.y=worker.y;stepGame(state,.25);worker.hp=1;
    expect(issueCommand(state,1,{type:'attack',ids:[enemy.id],target:worker.id})).toBe(true);
    for(let i=0;i<50&&worker.hp>0;i++)stepGame(state,.05);
    expect(worker.hp).toBe(0);expect(recorder.analysis.at(-1)!.players[0].losses).toBe(1);
    const hq=state.entities.find(e=>e.side===0&&e.role==='hq')!;enemy.x=hq.x+2;enemy.y=hq.y;enemy.cooldown=0;stepGame(state,.25);hq.hp=1;
    expect(issueCommand(state,1,{type:'attack',ids:[enemy.id],target:hq.id})).toBe(true);
    for(let i=0;i<60&&hq.hp>0;i++)stepGame(state,.05);
    const losses=recorder.analysis.at(-1)!.players[0],workerCost=FACTIONS.orcs.units.worker.cost,hqCost=FACTIONS.orcs.buildings.hq.cost;
    expect(hq.hp).toBe(0);expect(losses.buildingLosses).toBe(1);expect(losses.lostValue).toBeGreaterThanOrEqual(workerCost.wood+workerCost.ore+workerCost.crystal+hqCost.wood+hqCost.ore+hqCost.crystal);
    recorder.dispose();
  });
});
