import { describe, expect, it } from 'vitest';
import { createGame, issueCommand, stepGame } from '../src/core/simulation';
import { SaveRepository, createSessionFile, decodeSessionFile, createBugReport } from '../src/core/session-storage';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { saveGame } from '../src/core/saves';

class MemoryStorage {
  values=new Map<string,string>();fail=false;
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){if(this.fail)throw new Error('Quota exceeded');this.values.set(key,value);}
  removeItem(key:string){this.values.delete(key);}
}
describe('save repository and report files',()=>{
  it('saves, lists, loads, exports and deletes actual matches with replay history',()=>{
    const storage=new MemoryStorage(),repo=new SaveRepository(storage,()=>new Date('2026-10-01T10:00:00Z'));
    const state=createGame('fairies',43,'dwarves',{mapSize:'small',controllers:['human','external']}),recorder=new MatchRecorder(state);
    for(let i=0;i<3;i++)stepGame(state,.05);
    const file=createSessionFile(state,recorder.export()),id=repo.save('My match',file);
    expect(repo.list()).toEqual([expect.objectContaining({id,name:'My match',faction:'fairies',autosave:false})]);
    expect(saveGame(repo.load(id).state)).toEqual(saveGame(state));
    expect(decodeSessionFile(JSON.stringify(file)).file).toEqual(file);
    repo.delete(id);expect(repo.list()).toEqual([]);recorder.dispose();
  });
  it('rotates three autosaves and preserves all old data on a quota failure',()=>{
    const storage=new MemoryStorage(),repo=new SaveRepository(storage),state=createGame('orcs',4,'fairies',{mapSize:'small'});
    const id=repo.save('Named',createSessionFile(state));repo.save('Autosave',createSessionFile(state),true);
    stepGame(state,.05);repo.save('Autosave',createSessionFile(state),true);
    expect(repo.list()).toHaveLength(3);expect(repo.load('autosave').state.tick).toBe(1);expect(repo.load('autosave-1').state.tick).toBe(0);
    stepGame(state,.05);repo.save('Autosave',createSessionFile(state),true);
    stepGame(state,.05);repo.save('Autosave',createSessionFile(state),true);
    expect(repo.list()).toHaveLength(4);expect(repo.load('autosave').state.tick).toBe(3);expect(repo.load('autosave-1').state.tick).toBe(2);expect(repo.load('autosave-2').state.tick).toBe(1);
    const old=[...storage.values];storage.fail=true;
    expect(()=>repo.save('Failed',createSessionFile(state))).toThrow('preserved');
    expect([...storage.values]).toEqual(old);expect(repo.load(id).state.tick).toBe(0);
  });
  it('validates imports, names, capacity and autosave settings without replacing a match',()=>{
    const storage=new MemoryStorage(),repo=new SaveRepository(storage),state=createGame('orcs',4,'fairies',{mapSize:'small',controllers:['external','external']});
    expect(()=>decodeSessionFile({format:'orcs-vs-fairies/session',version:8,game:{}})).toThrow();
    expect(()=>repo.save(' ',createSessionFile(state))).toThrow();
    expect(()=>repo.setAutosave({enabled:true,intervalSeconds:0})).toThrow();
    repo.setAutosave({enabled:false,intervalSeconds:120});expect(repo.getAutosave()).toEqual({enabled:false,intervalSeconds:120});
    for(let i=0;i<12;i++)repo.save(`Match ${i}`,createSessionFile(state));
    expect(()=>repo.save('Too many',createSessionFile(state))).toThrow('12 save slots');
    expect(()=>repo.load('missing')).toThrow();expect(repo.list()).toHaveLength(12);
    repo.save('Autosave',createSessionFile(state),true);expect(repo.list()).toHaveLength(13);
  });
  it('exports a bug report whose embedded replay reproduces the reported state',()=>{
    const state=createGame('orcs',4127,'fairies',{mapSize:'small',controllers:['human','external']}),recorder=new MatchRecorder(state);
    const worker=state.entities.find(e=>e.side===0&&e.role==='worker')!;
    issueCommand(state,0,{type:'move',ids:[worker.id],x:worker.x+1,y:worker.y});
    for(let i=0;i<10;i++)stepGame(state,.05);
    const report=createBugReport('Worker stopped by the mine',state,recorder.export(),{renderDensity:1},'verified-source-sha256');
    const reproduced=new ReplayPlayer(report.session.replay);reproduced.advance(10);
    expect(saveGame(reproduced.state)).toEqual(saveGame(state));expect(report.description).toBe('Worker stopped by the mine');
    expect(report.id).toMatch(/^local-/);expect(report.versions.buildId).toBe('verified-source-sha256');expect(report.versions.contentHash).toMatch(/^[0-9a-f]{8}$/);
    expect(()=>createBugReport('',state,recorder.export())).toThrow();recorder.dispose();
  });
});
