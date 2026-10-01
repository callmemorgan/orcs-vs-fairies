import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMatch, issueCommand, stepGame } from '../src/core/simulation';
import { MatchRecorder, ReplayPlayer, decodeReplay, replayChecksum } from '../src/core/replays';
import { loadGame, saveGame, checksumSaveEnvelope, SAVE_VERSION } from '../src/core/saves';
import { createSessionFile, decodeSessionFile, SaveRepository } from '../src/core/session-storage';
import type { FactionId, Side } from '../src/core/types';

const factions:FactionId[]=['orcs','fairies','dwarves','undead','tideborn','automata'];
const match=(count:number)=>createMatch({map:{seed:4127,size:'small'},players:Array.from({length:count},(_,i)=>({id:i as Side,teamId:(i%2) as Side,factionId:factions[i%factions.length],controller:'external' as const,handicap:{startingResources:{wood:400,ore:300,crystal:200}}}))});

describe('roster replay and session contracts',()=>{
  // The eight-player case runs several 900-tick replay branches. Allow for
  // contention with other simulation files in the complete suite.
  it.each([3,8])('replays high-side commands, gathering and research in a %i-player match',count=>{
    const state=match(count),side=(count-1) as Side,recorder=new MatchRecorder(state);
    const worker=state.entities.find(e=>e.side===side&&e.role==='worker')!,hq=state.entities.find(e=>e.side===side&&e.role==='hq')!;
    const wood=state.resources.filter(r=>r.kind==='wood'&&state.visible[side].has(Math.floor(r.y)*state.width+Math.floor(r.x))).sort((a,b)=>Math.hypot(a.x-worker.x,a.y-worker.y)-Math.hypot(b.x-worker.x,b.y-worker.y))[0];
    expect(issueCommand(state,side,{type:'gather',ids:[worker.id],target:wood.id})).toBe(true);
    expect(issueCommand(state,side,{type:'train',id:hq.id,role:'worker'})).toBe(true);
    expect(issueCommand(state,side,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toBe(true);
    for(let tick=0;tick<900;tick++)stepGame(state,.05);
    const archive=recorder.export();recorder.dispose();
    expect(archive.analysis.every(sample=>sample.players.length===count)).toBe(true);
    expect(archive.analysis.at(-1)!.players[side].gathered).toBeGreaterThan(0);
    expect(archive.technologies).toContainEqual(expect.objectContaining({side,upgrade:'worker-harvest'}));
    const player=new ReplayPlayer(archive);player.advance(900);
    expect(saveGame(player.state)).toEqual(saveGame(state));
    player.seek(630);player.seek(900);expect(saveGame(player.state)).toEqual(saveGame(state));
    const file=createSessionFile(state,archive),restored=decodeSessionFile(file),continuation=new MatchRecorder(restored.state,restored.file.replay);
    stepGame(restored.state,.05);const resumed=new ReplayPlayer(continuation.export());resumed.advance(901);
    expect(saveGame(resumed.state)).toEqual(saveGame(restored.state));
    resumed.dispose();continuation.dispose();player.dispose();
  },20_000);
  it.each([1,3,8])('validates analysis and action sides against the %i-player roster',count=>{
    const state=match(count),recorder=new MatchRecorder(state),archive=recorder.export();recorder.dispose();
    expect(decodeReplay(archive).analysis[0].players).toHaveLength(count);
    for(const players of [archive.analysis[0].players.slice(1),[...archive.analysis[0].players,archive.analysis[0].players[0]]])expect(()=>decodeReplay({...archive,analysis:[{...archive.analysis[0],players}]})).toThrow('sample');
    expect(()=>decodeReplay({...archive,actions:[{type:'command',side:count,command:{type:'stop',ids:[1]}}]})).toThrow('command');
    expect(()=>decodeReplay({...archive,technologies:[{side:count,upgrade:'worker-harvest',tick:0,time:0}]})).toThrow('technology');
    expect(()=>decodeReplay({...archive,checksumVersion:1})).toThrow('version');
    const player=new ReplayPlayer(archive);expect(saveGame(player.state)).toEqual(saveGame(state));player.dispose();
  });
  it('stores a one-player session without reading a nonexistent opponent',()=>{
    const values=new Map<string,string>(),repo=new SaveRepository({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
    const state=match(1),id=repo.save('Practice',createSessionFile(state));
    expect(repo.list()[0].opponent).toBe(state.players[0].faction);expect(saveGame(repo.load(id).state)).toEqual(saveGame(state));
  });
  it.each([{version:1,hash:'5db9ad74'},{version:2,hash:'0d8ff1ef'}])('keeps genuine v$version saves readable but rejects their old playback rules',({version,hash})=>{
    const source=JSON.parse(readFileSync(new URL(`./fixtures/legacy-replay-v${version}.json`,import.meta.url),'utf8'));
    const archive=decodeReplay(source),state=loadGame(archive.initial);
    expect(checksumSaveEnvelope(archive.initial)).toBe(hash);expect(()=>replayChecksum(state,version)).toThrow('original serialized');
    expect(archive.initial.version).toBe(version);expect(archive.checksumVersion).toBe(version);
    expect(saveGame(state).version).toBe(SAVE_VERSION);
    expect(()=>new ReplayPlayer(archive)).toThrow(`simulation version ${version}`);
    expect(()=>new MatchRecorder(state,archive)).toThrow('Older replay history');
    const recorder=new MatchRecorder(state),fresh=recorder.export(),player=new ReplayPlayer(fresh);
    expect(saveGame(player.state)).toEqual(saveGame(state));recorder.dispose();player.dispose();
  });
  it('retains a genuine prior v3 recording after an AI rule change without relabeling its history',()=>{
    const source=JSON.parse(readFileSync(new URL('./fixtures/legacy-replay-v3.json',import.meta.url),'utf8'));
    const archive=decodeReplay(source),state=loadGame(archive.initial);
    expect(archive.initial.version).toBe(3);expect(archive.simulationRevision).toBe('3.0.0');
    expect(archive.finalTick).toBe(11909);expect(archive.finalChecksum).toBe(source.finalChecksum);
    expect(()=>new ReplayPlayer(archive)).toThrow('rules 3.0.0');
    const fresh=new MatchRecorder(state);expect(fresh.export().simulationRevision).not.toBe('3.0.0');fresh.dispose();
  });
});
