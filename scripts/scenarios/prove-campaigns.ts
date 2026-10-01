import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CAMPAIGNS, SCENARIOS } from '../../src/scenarios/campaigns';
import { FACTIONS } from '../../src/core/content';
import { captureScenario, createScenario, resetScenario, restoreScenario, scenarioCondition, stepScenario } from '../../src/core/scenarios';
import { ScenarioRecorder, verifyScenarioRecording } from '../../src/core/scenario-recordings';
import type { ScenarioCondition, ScenarioSession } from '../../src/core/scenario-types';
import type { Entity, GameEvent, UnitRole } from '../../src/core/types';
import { puzzleStealthCommands, steerPuzzle, steerStealth } from './puzzle-stealth-strategy';
import { finaleCommands, steerFinale } from './finale-strategy';
import { routeCommands, steerDefense, steerEscort } from './route-strategy';

const hash=(value: unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
function missionKind(session: ScenarioSession): string {const definition=session.definition;return definition.boss?'boss':definition.escort?'escort':definition.stealth?'stealth':definition.rules.fixedArmy?'puzzle':'defense';}
function deadLabels(condition: ScenarioCondition): string[] {
  if(condition.type==='dead') return [condition.actor];
  if(condition.type==='all'||condition.type==='any') return condition.conditions.flatMap(deadLabels);
  return [];
}
const actorSummary=(entity:Entity|undefined)=>entity?{id:entity.id,role:entity.role,x:entity.x,y:entity.y,hp:entity.hp,shield:entity.shield,order:entity.order}:null;
const sourceFiles=['src/scenarios/campaigns.ts','src/core/scenario-types.ts','src/core/scenario-validation.ts','src/core/scenarios.ts','src/core/scenario-recordings.ts','src/core/content.ts','src/core/simulation.ts','src/core/maps.ts','src/core/types.ts','src/core/match-rules.ts','src/core/objectives.ts','src/core/saves.ts','src/core/navigation.ts','scripts/scenarios/prove-campaigns.ts','scripts/scenarios/puzzle-stealth-strategy.ts','scripts/scenarios/finale-strategy.ts','scripts/scenarios/route-strategy.ts'];

export function steerMission(session: ScenarioSession): void {
  switch(missionKind(session)) {
    case 'stealth': steerStealth(session);break;
    case 'puzzle': steerPuzzle(session);break;
    case 'boss': steerFinale(session);break;
    case 'escort': steerEscort(session);break;
    case 'defense': steerDefense(session);break;
  }
}

/** Completes a prepared campaign detachment using the same bounded player strategies. */
export function solveMission(session: ScenarioSession): ScenarioSession {
  const lastTick=session.state.tick+Math.ceil(session.definition.rules.timeLimit/.05)+10;
  while(session.runtime.outcome==='playing' && session.state.tick<lastTick) {steerMission(session);stepScenario(session);}
  return session;
}

export function proveCampaigns(kind='all', output=resolve(`docs/evidence/campaigns/author-playthrough-${kind}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`)): void {
if(existsSync(output)) throw new Error('Proof outputs are append-only. Choose a new output path.');
const archiveDirectory=resolve('work/campaign-content/recordings',new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(archiveDirectory,{recursive:true});
const attempts=[];
for(const definition of Object.values(SCENARIOS)) {
  const session=createScenario(definition), type=missionKind(session);
  if(kind!=='all' && !kind.split('-').includes(type)) continue;
  const recorder=new ScenarioRecorder(session);
  const initial=hash(captureScenario(session)), snapshots=[], combatEvents: Array<GameEvent & {time:number}>=[];
  const illusions=new Set<number>(), raised=new Set<number>(), consumedCorpses=new Set<number>(), prepared=new Set<number>(), boosted=new Set<number>();
  const abilityEvents:Record<string,number>={}, shieldRestores: Array<{time:number;id:number;before:number;after:number}>=[];
  const actualDeaths=new Set<number>();
  let peakFury=0,tick=0;
  const readEvents=(events:GameEvent[])=>{
    for(const event of events) {
      if(['ability','attack','death','train','build'].includes(event.type)) combatEvents.push({...event,time:session.state.time});
      if(event.type==='death' && event.source!==undefined) actualDeaths.add(event.source);
      if(event.type==='ability' && event.side===0 && event.source!==undefined) {
        const caster=session.state.entities.find(entity=>entity.id===event.source);
        const ability=caster?.kind==='unit'?FACTIONS[definition.faction].units[caster.role as UnitRole].ability:undefined;
        if(ability) abilityEvents[ability]=(abilityEvents[ability]??0)+1;
      }
    }
  };
  while(session.runtime.outcome==='playing' && tick<Math.ceil(definition.rules.timeLimit/.05)+10) {
    const eventsBefore=session.state.events.length;
    const corpsesBefore=new Map(session.state.corpses.map(corpse=>[corpse.id,corpse.expires]));
    const shieldsBefore=new Map(session.state.entities.filter(entity=>entity.side===0&&entity.hp>0).map(entity=>[entity.id,entity.shield??0]));
    steerMission(session);
    readEvents(session.state.events.slice(eventsBefore));
    stepScenario(session);tick++;
    readEvents(session.state.events);
    const corpsesAfter=new Set(session.state.corpses.map(corpse=>corpse.id));
    for(const [id,expires] of corpsesBefore) if(expires>session.state.time+1e-9&&!corpsesAfter.has(id)) consumedCorpses.add(id);
    for(const entity of session.state.entities.filter(entity=>entity.side===0&&entity.kind==='unit')) {
      if(entity.illusion) illusions.add(entity.id);
      if(entity.raised) raised.add(entity.id);
      if(entity.entrenchedAt!==undefined&&session.state.time-entity.entrenchedAt>=3) prepared.add(entity.id);
      if((entity.surgeUntil??0)>session.state.time) boosted.add(entity.id);
      peakFury=Math.max(peakFury,entity.momentum);
      const before=shieldsBefore.get(entity.id);
      if(before!==undefined && (entity.shield??0)>before+1) shieldRestores.push({time:session.state.time,id:entity.id,before,after:entity.shield!});
    }
    if(tick%100===0 || session.runtime.outcome!=='playing') snapshots.push({time:session.state.time,commander:actorSummary(session.state.entities.find(entity=>entity.id===session.runtime.labels.commander)),livingArmy:session.state.entities.filter(entity=>entity.side===0&&entity.hp>0&&entity.kind==='unit'&&!entity.illusion).length,variables:{...session.runtime.variables},completed:[...session.runtime.completed],boss:{...session.runtime.boss}});
  }
  const spawned=definition.events.flatMap(event=>event.actions.flatMap(action=>action.type==='spawn'?action.actors:[]));
  const targets=definition.objectives.flatMap(objective=>deadLabels(objective.success));
  const assertions:Record<string,boolean>={
    missionWon:session.runtime.outcome==='won',
    allRequiredObjectives:definition.objectives.filter(objective=>!objective.optional).every(objective=>session.runtime.completed.includes(objective.id)&&scenarioCondition(session,objective.success)),
    noFailureCondition:definition.objectives.every(objective=>!objective.failure||!scenarioCondition(session,objective.failure)),
    requiredActions:(definition.requiredActions??[]).every(action=>(session.runtime.commandCounts[action.action]??0)>=action.count),
    markedTargetsKilled:targets.every(label=>actualDeaths.has(session.runtime.labels[label])),
    resetRestoresInitialState:hash(captureScenario(resetScenario(session)))===initial,
    checkpointRoundtrip:hash(captureScenario(restoreScenario(captureScenario(session))))===hash(captureScenario(session)),
  };
  if(type==='escort'||type==='defense') {
    assertions.allAuthoredWavesFired=definition.events.filter(event=>event.actions.some(action=>action.type==='spawn')).every(event=>session.runtime.triggers[event.id]?.count===1);
    assertions.allWaveEnemiesKilled=spawned.every(actor=>actualDeaths.has(session.runtime.labels[actor.label]));
  }
  if(type==='escort') assertions.allEscortCheckpoints=session.runtime.escort.checkpoint===definition.escort!.route.length;
  if(type==='defense') assertions.finiteReinforcements=session.runtime.reinforcementRemaining>=0&&session.runtime.reinforcementRemaining<=definition.rules.reinforcementBudget;
  if(type==='stealth') {assertions.noAlarm=session.runtime.stealth.alarms===0;assertions.archiveRecovered=session.runtime.variables['archive.recovered']===1;}
  if(type==='boss') {
    assertions.allBossPhases=JSON.stringify(session.runtime.boss.phasesEntered)===JSON.stringify([0,1,2]);
    assertions.realBossDeath=actualDeaths.has(session.runtime.labels.boss);
    assertions.bossResponse=session.runtime.boss.interrupted+session.runtime.boss.dodged>=1;
    const faction=definition.faction;
    assertions.actualFactionMechanic=faction==='orcs'?(abilityEvents.momentum??0)>0&&peakFury>0:faction==='fairies'?(abilityEvents.illusion??0)>0&&illusions.size>=2:faction==='dwarves'?(abilityEvents.entrench??0)>0&&prepared.size>=1:faction==='undead'?(abilityEvents.raise??0)>0&&raised.size>=1&&consumedCorpses.size>=1:faction==='tideborn'?(abilityEvents.surge??0)>0&&boosted.size>=1:(abilityEvents.ward??0)>0&&shieldRestores.length>=1;
  }
  const archive=recorder.archive();recorder.destroy();
  const archivePath=resolve(archiveDirectory,`${definition.id}.json`);
  writeFileSync(archivePath,JSON.stringify(archive)+'\n');
  let journalError:string|null=null;
  try {
    const verified=verifyScenarioRecording(archive);
    assertions.journalRecomputed=verified.runtime.outcome===session.runtime.outcome&&hash(captureScenario(verified))===hash(captureScenario(session));
  } catch(error) {assertions.journalRecomputed=false;journalError=String(error);}
  const commands=type==='boss'?finaleCommands(session):type==='escort'||type==='defense'?routeCommands(session):puzzleStealthCommands(session);
  attempts.push({id:definition.id,type,seed:definition.seed,definitionSha256:hash(definition),initialSha256:initial,outcome:session.runtime.outcome,reason:session.runtime.reason,time:session.state.time,assertions,journal:{archivePath,sha256:fileHash(archivePath),finalChecksum:archive.finalChecksum,commandCount:archive.commands.length,finalTick:archive.finalTick,error:journalError},variables:session.runtime.variables,commandCounts:session.runtime.commandCounts,commandTrace:commands,triggers:session.runtime.triggers,completed:session.runtime.completed,mechanics:{abilityEvents,illusionIds:[...illusions],raisedIds:[...raised],consumedCorpseIds:[...consumedCorpses],preparedIds:[...prepared],boostedIds:[...boosted],peakFury,shieldRestores},combatEvents,snapshots,finalSha256:hash(captureScenario(session))});
  console.log(`${definition.id}: ${session.runtime.outcome} at ${session.state.time.toFixed(2)}s; failed assertions: ${Object.entries(assertions).filter(([,passed])=>!passed).map(([name])=>name).join(', ')||'none'}`);
}
mkdirSync(resolve(output,'..'),{recursive:true});
writeFileSync(output,JSON.stringify({format:'orcs-vs-fairies-authored-campaign-proof',version:2,generatedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceFiles:Object.fromEntries(sourceFiles.map(path=>[path,fileHash(path)])),sourceDefinitionSha256:hash(SCENARIOS),campaigns:Object.keys(CAMPAIGNS).length,missionCount:attempts.length,commandPath:'issueScenarioCommand',stepPath:'stepScenario',attempts},null,2)+'\n');
console.log(output);
if(attempts.some(attempt=>Object.values(attempt.assertions).some(passed=>!passed))) process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) proveCampaigns(process.argv[2]??'all',process.argv[3]?resolve(process.argv[3]):undefined);
