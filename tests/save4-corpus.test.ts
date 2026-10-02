import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checksumSaveEnvelope, decodeOriginalSaveEnvelope, decodeSaveSource, loadGame, saveGame, SAVE_VERSION } from '../src/core/saves';
import { MatchRecorder, ReplayPlayer, decodeReplay, replayRulesCompatible } from '../src/core/replays';
import { SaveRepository, createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { decodeScenarioRecording, scenarioCheckpointChecksum } from '../src/core/scenario-recordings';
import { restoreScenario, scenarioRulesCompatibility } from '../src/core/scenarios';
import { SIMULATION_REVISION } from '../src/core/versions';
import { stepGame } from '../src/core/simulation';
import { decodeHistoricalContentBundle } from '../src/core/content-registry';
import { applyDraftChoice, createDraft, draftPlayers, legalDraftChoices, normalizeMatchRules } from '../src/core/match-rules';
import { emptyObjectives } from '../src/core/objectives';

const json=(path:string)=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const sessions=[
 ['v1','../docs/evidence/roster-coop-integration-20261001/roster/historical-source-session-v1.json','2556964e'],
 ['Lantern','../docs/evidence/content-root-integration-20261001/browser-save.json','cdac7c02'],
 ['specialist','../docs/evidence/specialists-20261001/browser-save.json','49d3b724'],
 ['world','../docs/evidence/world-combined-20261001/world-browser-save.json','44df0737'],
] as const;

describe('SAVE4 genuine historical corpus',()=>{
 it.each(sessions)('preserves the %s original game/history pair through import and local storage',(_name,path,checksum)=>{
  const source=json(path),gameText=JSON.stringify(source.game),initialText=JSON.stringify(source.replay.initial),{file,state}=decodeSessionFile(source);
  expect(checksumSaveEnvelope(file.game)).toBe(checksum);expect(JSON.stringify(file.game)).toBe(gameText);expect(JSON.stringify(file.replay!.initial)).toBe(initialText);
  expect(saveGame(state).version).toBe(4);expect(SAVE_VERSION).toBe(4);expect(SIMULATION_REVISION).toBe('4.0.2');
  expect(state.projectiles).toBeDefined();expect(state.factionSystems).toBeDefined();expect(state.economy).toBeDefined();expect(state.entities.filter(e=>e.kind==='unit').every(e=>e.tactics)).toBe(true);
  expect(JSON.stringify(decodeSessionFile(JSON.stringify(file)).file.game)).toBe(gameText);
  const storage=new Map<string,string>(),repo=new SaveRepository({getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}}),id=repo.save('Historical match',file);
  expect(JSON.stringify(repo.load(id).file.game)).toBe(gameText);expect(JSON.stringify(repo.load(id).file.replay!.initial)).toBe(initialText);
  expect(replayRulesCompatible(file.replay!)).toBe(false);expect(()=>new ReplayPlayer(file.replay)).toThrow('simulation version');expect(()=>new MatchRecorder(state,file.replay)).toThrow('Older replay history');
  expect(()=>createSessionFile(state,file.replay)).toThrow('does not match');
  const recorder=new MatchRecorder(state),fresh=createSessionFile(state,recorder.export());recorder.dispose();const resumed=decodeSessionFile(fresh),player=new ReplayPlayer(fresh.replay);
  expect(resumed.file.game.version).toBe(4);expect(resumed.file.replay!.initial.version).toBe(4);expect(resumed.file.replay!.simulationRevision).toBe('4.0.2');expect(saveGame(player.state)).toEqual(saveGame(state));player.dispose();
  expect(JSON.stringify(source.game)).toBe(gameText);
 });
 it('authenticates the old content before admitting entity and queue definitions',()=>{
  const source=json(sessions[1][1]),unit=source.game.state.entities.find((e:any)=>e.side===1&&e.kind==='unit');unit.role='special';unit.definitionId='core:orcs-commander';unit.hp=unit.maxHp=280;
  expect(()=>decodeSaveSource(source.game)).toThrow('definition is absent');expect(()=>checksumSaveEnvelope(source.game)).toThrow('definition is absent');
  const queued=json(sessions[1][1]),hq=queued.game.state.entities.find((e:any)=>e.side===1&&e.role==='hq');hq.queue=['worker'];hq.queueDefinitionIds=['economy:caravan'];hq.queuePaidCosts=[{wood:80,ore:30,crystal:0}];
  expect(()=>decodeSaveSource(queued.game)).toThrow('definition is absent');
 });
 it('repins admitted old production without changing the queue, charged costs or resource balances',()=>{
  // Synthetic pending work inside a genuine old Lantern envelope.
  const source=json(sessions[1][1]).game,hq=source.state.entities.find((e:any)=>e.side===1&&e.role==='hq');
  Object.assign(hq,{queue:['worker'],queueDefinitionIds:['orc-worker'],queuePaidCosts:[{wood:50,ore:0,crystal:0}],trainProgress:.25,research:'worker-speed',researchPaidCost:{wood:75,ore:50,crystal:0},researchProgress:.4});
  Object.assign(source.state.players[1],{wood:295,ore:170});
  const before=JSON.stringify(source),{original,state}=decodeSaveSource(source),resumed=state.entities.find(e=>e.id===hq.id)!;
  expect(JSON.stringify(original)).toBe(before);expect(JSON.stringify(source)).toBe(before);
  for(const key of ['queue','queueDefinitionIds','queuePaidCosts','trainProgress','research','researchPaidCost','researchProgress'] as const)expect(resumed[key]).toEqual(hq[key]);
  expect(state.players[1]).toEqual(source.state.players[1]);expect(state.content!.packages).toEqual(source.state.content.packages);expect(state.content!.hash).not.toBe(source.state.content.hash);
  expect(loadGame(saveGame(state)).entities.find(e=>e.id===hq.id)!.queuePaidCosts).toEqual(hq.queuePaidCosts);
 });
 it('records and plays advanced SAVE4 history from a migrated old match',()=>{
  const {state}=decodeSessionFile(json(sessions[1][1])),start=state.tick,recorder=new MatchRecorder(state);
  for(let i=0;i<10;i++)stepGame(state,.05);
  const fresh=createSessionFile(state,recorder.export());recorder.dispose();expect(fresh.replay!.finalTick).toBe(start+10);
  const player=new ReplayPlayer(fresh.replay!);expect(player.advance(10)).toBe(10);expect(player.finished).toBe(true);expect(saveGame(player.state)).toEqual(fresh.game);player.dispose();
  const resumed=decodeSessionFile(fresh),continued=new MatchRecorder(resumed.state,resumed.file.replay);stepGame(resumed.state,.05);
  const next=createSessionFile(resumed.state,continued.export());continued.dispose();const replay=new ReplayPlayer(next.replay!);replay.advance(11);expect(saveGame(replay.state)).toEqual(next.game);replay.dispose();
 });
 it.each(['off','active','complete'] as const)('migrates the old %s draft pool while preserving choices and mode progress',phase=>{
  // Synthetic valid mode triple using the genuine envelope's historical registry.
  const source=json(sessions[1][1]).game,s=source.state,content=decodeHistoricalContentBundle(s.content),players=draftPlayers(s);
  s.rules=normalizeMatchRules({mode:'hill',disabledDefinitionIds:['orc-ranged'],draft:{enabled:phase!=='off',banRounds:1,pickRounds:2}},content);
  s.draft=createDraft(players,s.rules,content);s.objectives=emptyObjectives(s);Object.assign(s.objectives.hill,{ownerTeam:0,holdTicks:17});
  while(s.draft.status==='drafting'){
   const side=s.draft.order[s.draft.turn].side,id=legalDraftChoices(s.draft,players,side,content)[0];expect(applyDraftChoice(s.draft,s.rules,players,side,id,content)).toBe(true);
   if(phase==='active'){s.draft.remainingTicks=37;break;}
  }
  const before=JSON.stringify(source),original=decodeOriginalSaveEnvelope(source),checksum=checksumSaveEnvelope(original),{state}=decodeSaveSource(original);
  expect(JSON.stringify(original)).toBe(before);expect(JSON.stringify(source)).toBe(before);expect(checksumSaveEnvelope(original)).toBe(checksum);
  expect(state.rules).toEqual(s.rules);expect(state.objectives).toEqual(s.objectives);
  const {pool:oldPool,...oldDraft}=s.draft,{pool:newPool,...newDraft}=state.draft;expect(newDraft).toEqual(oldDraft);expect(newPool).toEqual(createDraft(players,state.rules,state.content).pool);expect(newPool.length).toBeGreaterThan(oldPool.length);
  expect(saveGame(loadGame(saveGame(state)))).toEqual(saveGame(state));
  const invalid=structuredClone(source);invalid.state.draft.pool.push('core:orcs-commander');expect(()=>decodeSaveSource(invalid)).toThrow('Draft order or pool differs');
 });
 it('rejects mixed versions, altered checksums, altered ticks and reordered original game fields',()=>{
  for(const mutate of [(s:any)=>s.game.version=4,(s:any)=>s.replay.checksumVersion=4,(s:any)=>s.replay.finalChecksum='00000000',(s:any)=>s.game.state.tick++,(s:any)=>s.game.state=Object.fromEntries(Object.entries(s.game.state).reverse())]){const source=json(sessions[0][1]);mutate(source);expect(()=>decodeSessionFile(source)).toThrow();}
 });
 it.each(['extra','01','-0','1\n'])('rejects raw session array property %s before copying the original pair',key=>{
  for(const enumerable of [true,false])for(const location of ['game','initial'] as const){
   const source=json(sessions[0][1]),array=(location==='game'?source.game:source.replay.initial).state.entities,before=JSON.stringify(source);
   Object.defineProperty(array,key,{value:{marker:7},enumerable,configurable:true});const descriptors=Object.getOwnPropertyDescriptors(array);
   expect(()=>decodeSessionFile(source)).toThrow('invalid array properties');expect(Object.getOwnPropertyDescriptors(array)).toEqual(descriptors);expect(JSON.stringify(source)).toBe(before);
   delete array[key];const {file}=decodeSessionFile(source);expect(JSON.stringify(file.game)).toBe(JSON.stringify(source.game));expect(JSON.stringify(file.replay!.initial)).toBe(JSON.stringify(source.replay.initial));expect(checksumSaveEnvelope(file.game)).toBe('2556964e');
  }
 });
 it.each(['0','01','extra'])('rejects raw session array accessor %s without invoking it or changing descriptors',key=>{
  for(const location of ['game','initial'] as const){
   let reads=0;const source=json(sessions[0][1]),array=(location==='game'?source.game:source.replay.initial).state.entities;
   Object.defineProperty(array,key,{get(){reads++;return 7;},enumerable:false,configurable:true});const descriptors=Object.getOwnPropertyDescriptors(array);
   expect(()=>decodeSessionFile(source)).toThrow('accessors are forbidden');expect(reads).toBe(0);expect(Object.getOwnPropertyDescriptors(array)).toEqual(descriptors);
  }
 });
 it('rejects raw session array symbols without changing the imported source',()=>{
  const source=json(sessions[0][1]),array=source.game.state.entities,key=Symbol('extra');array[key]=7;const descriptors=Object.getOwnPropertyDescriptors(array);
  expect(()=>decodeSessionFile(source)).toThrow('contains symbols');expect(Object.getOwnPropertyDescriptors(array)).toEqual(descriptors);
 });
 it('preserves canonical nonenumerable indices through historical and current wrapper round-trips',()=>{
  const historical=json(sessions[0][1]);for(const game of [historical.game,historical.replay.initial])Object.defineProperty(game.state.entities,'0',{enumerable:false});
  const before=JSON.stringify(historical),descriptors=Object.getOwnPropertyDescriptors(historical.game.state.entities),{file,state}=decodeSessionFile(historical);
  expect(JSON.stringify(file.game)).toBe(JSON.stringify(historical.game));expect(JSON.stringify(file.replay!.initial)).toBe(JSON.stringify(historical.replay.initial));expect(file.game.version).toBe(1);expect(file.replay!.initial.version).toBe(1);expect(file.replay!.checksumVersion).toBe(1);expect(file.replay!.simulationRevision).toBe('1.0.0');expect(historical.replay.checksumVersion).toBeUndefined();expect(historical.replay.simulationRevision).toBeUndefined();expect(checksumSaveEnvelope(file.game)).toBe('2556964e');expect(Object.getOwnPropertyDescriptors(historical.game.state.entities)).toEqual(descriptors);expect(JSON.stringify(historical)).toBe(before);
  const recorder=new MatchRecorder(state),current=createSessionFile(state,recorder.export());recorder.dispose();for(const game of [current.game,current.replay!.initial])Object.defineProperty(game.state.entities,'0',{enumerable:false});
  const currentBefore=JSON.stringify(current),currentDescriptors=Object.getOwnPropertyDescriptors(current.game.state.entities),decoded=decodeSessionFile(current);
  expect(JSON.stringify(decoded.file)).toBe(currentBefore);expect(decoded.file.game.version).toBe(4);expect(decoded.file.replay!.simulationRevision).toBe('4.0.2');expect(saveGame(decoded.state)).toEqual(decoded.file.game);expect(Object.getOwnPropertyDescriptors(current.game.state.entities)).toEqual(currentDescriptors);expect(JSON.stringify(current)).toBe(currentBefore);
 });
 it('keeps the scenario wrapper checksum separate from the nested core forwarding guard',()=>{
  const final=json('./fixtures/scenario-save3-3.2/scenario-final.json'),recording=json('./fixtures/scenario-save3-3.2/scenario-recording.json'),before=JSON.stringify(recording.initial);
  expect(scenarioCheckpointChecksum(final)).toBe('74458e1b');expect(JSON.stringify(decodeScenarioRecording(recording).initial)).toBe(before);expect(scenarioRulesCompatibility(restoreScenario(final)).compatible).toBe(false);
  final.runtime.lastEvaluatedTick=final.game.state.tick;expect(scenarioCheckpointChecksum(final)).toBe('74458e1b');
  const bound=json('./fixtures/scenario-save3-3.2/generic-bound-final.json');expect(checksumSaveEnvelope(bound)).toBe('8246aa1d');delete bound.state.scenario.runtime.lastEvaluatedTick;expect(()=>checksumSaveEnvelope(bound)).toThrow('runtime');
 });
 it('retains a real old wrong-owner summon for inspection and rejects ambiguous resume after its caster died',()=>{
  const source=json('./fixtures/captured-gravecaller-save3.json'),proof=json('./fixtures/captured-gravecaller-save3-provenance.json'),before=JSON.stringify(source.game),original=decodeOriginalSaveEnvelope(source.game),archive=decodeReplay(source.replay);
  expect(checksumSaveEnvelope(original)).toBe('37200660');expect(archive.finalChecksum).toBe(checksumSaveEnvelope(original));expect(archive.finalTick).toBe(original.state.tick);
  expect(original.state.entities.some(e=>e.id===proof.casterId)).toBe(false);const raised=original.state.entities.find(e=>e.id===proof.raisedId)!;expect(raised.definitionFaction).toBeUndefined();expect(raised.definitionId).toBeUndefined();expect(raised.maxHp).toBe(175);expect(raised.hp).toBe(87.5);
  expect(()=>loadGame(original)).toThrow('Legacy captured summon origin is absent');expect(()=>decodeSaveSource(original)).toThrow('cannot resume');expect(()=>decodeSessionFile(source)).toThrow('cannot resume');expect(JSON.stringify(original)).toBe(before);
 });
});
