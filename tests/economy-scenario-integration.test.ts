import { describe, expect, it } from 'vitest';
import { captureScenario, createScenario, issueScenarioCommand } from '../src/core/scenarios';
import { ScenarioRecorder, verifyScenarioRecording } from '../src/core/scenario-recordings';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { saveGame, loadGame } from '../src/core/saves';
import { issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { generateWorldMap } from '../src/core/world-map';
import type { Command } from '../src/core/types';
import type { ScenarioDefinition } from '../src/core/scenario-types';

function mission(fixedArmy = false, reinforcementBudget = 3): ScenarioDefinition {
 return {schemaVersion:1,id:'economic-scenario',title:'Economic scenario',briefing:'Hold this settlement.',successText:'Held.',failureText:'Lost.',faction:'orcs',opponent:'fairies',seed:42,
  map:{size:'small',width:36,height:36,terrain:Array(36*36).fill('grass'),starts:[{x:5,y:5},{x:30,y:30}],resources:[]},
  army:[{label:'base',side:0,kind:'building',role:'hq',x:8,y:8},{label:'worker',side:0,kind:'unit',role:'worker',x:11,y:8},{label:'enemy',side:1,kind:'unit',role:'melee',x:28,y:28,order:{type:'hold'}}],
  objectives:[{id:'hold',text:'Hold until the signal.',success:{type:'time',seconds:100}}],events:[],rules:{fixedArmy,reinforcementBudget,resources:{wood:5000,ore:5000,crystal:500},timeLimit:120}};
}
const run=(state:ReturnType<typeof createScenario>['state'],ticks:number)=>{for(let i=0;i<ticks;i++)stepGame(state,.05);};

describe('economy inside canonical authored scenarios',()=>{
 it.each([1,50])('keeps generated markets absent from authored map and offset IDs starting at %s',firstEntityId=>{
  const session=createScenario(mission(),{firstEntityId});
  expect(session.state.economy).toBeUndefined();expect(session.state.nextId).toBe(firstEntityId+3);
  expect(captureScenario(createScenario(mission(),{firstEntityId}))).toEqual(captureScenario(session));
  expect(saveGame(loadGame(saveGame(session.state)))).toEqual(saveGame(session.state));
  const recorder=new MatchRecorder(session.state);run(session.state,10);const replay=new ReplayPlayer(recorder.export());while(!replay.finished)replay.advance(20);
  expect(saveGame(replay.state)).toEqual(saveGame(session.state));replay.dispose();recorder.dispose();
 });
 it('rejects fixed-army economic construction and reinforcements through wrapper and direct input without mutation',()=>{
  const session=createScenario(mission(true,0)),base=session.runtime.labels.base,worker=session.runtime.labels.worker;
  const commands:Command[]=[{type:'buildEconomy',ids:[worker],kind:'warehouse',x:14,y:8},{type:'plantGrove',ids:[worker],x:12,y:10},{type:'specializeSettlement',id:base,kind:'military'},{type:'trainCaravan',id:base}];
  for(const command of commands){const before=captureScenario(session);expect(issueCommand(session.state,0,command)).toBe(false);expect(issueScenarioCommand(session,0,command)).toBe(false);expect(captureScenario(session)).toEqual(before);}
 });
 it('charges caravan and ordinary reinforcements once across both histories and equal continuation',()=>{
  const session=createScenario(mission(false,2)),recorder=new MatchRecorder(session.state),journal=new ScenarioRecorder(session),base=session.runtime.labels.base;
  expect(issueScenarioCommand(session,0,{type:'trainCaravan',id:base})).toBe(true);expect(session.runtime.reinforcementRemaining).toBe(1);
  expect(issueCommand(session.state,0,{type:'train',id:base,role:'worker'})).toBe(true);expect(session.runtime.reinforcementRemaining).toBe(0);
  expect(session.runtime.commandCounts.trainCaravan).toBe(1);expect(session.runtime.commandCounts.train).toBe(1);
  expect(session.runtime.variables['action.trainCaravan']).toBe(1);expect(session.state.economy?.markets).toEqual([]);
  const before=saveGame(session.state);expect(issueCommand(session.state,0,{type:'trainCaravan',id:base})).toBe(false);expect(issueScenarioCommand(session,0,{type:'train',id:base,role:'worker'})).toBe(false);expect(saveGame(session.state)).toEqual(before);
  const resumed=loadGame(before);run(session.state,400);run(resumed,400);expect(saveGame(resumed)).toEqual(saveGame(session.state));expect(session.state.economy?.caravans).toHaveLength(1);
  const archive=recorder.export(),recording=journal.archive();expect(archive.actions.filter(a=>a.type==='command')).toHaveLength(2);expect(recording.commands).toHaveLength(2);
  const replay=new ReplayPlayer(archive);while(!replay.finished)replay.advance(50);expect(saveGame(replay.state)).toEqual(saveGame(session.state));
  expect(captureScenario(verifyScenarioRecording(recording))).toEqual(captureScenario(session));replay.dispose();recorder.dispose();journal.destroy();
 });
});


function villageMission(fixedArmy:boolean,budget:number){
 const input=mission(fixedArmy,budget),world=generateWorldMap(input.seed,'small',2,'forest');
 for(const level of world.levels){level.terrain.fill('grass');level.elevation.fill(0);}
 world.resources=[];world.sites=[{id:1,kind:'village',x:12.5,y:8.5,level:0}];input.map!.world=world;input.map!.starts=world.starts.map(({slot,...point})=>point);
 input.army.push({label:'engineer',side:0,kind:'unit',role:'special',definitionId:'core:orcs-engineer',x:11,y:11,order:{type:'hold'}});
 const session=createScenario(input),site=session.state.world!.sites[0];site.supplied=true;site.owner=0;site.loyalty[0]=60;site.reward={wood:500,ore:500,crystal:100};refreshVisibility(session.state);return {session,site};
}

it('rejects engineer construction and village recruitment in a fixed army before any state changes',()=>{
 const {session,site}=villageMission(true,0),before=captureScenario(session),engineer=session.runtime.labels.engineer,worker=session.runtime.labels.worker;
 for(const command of [{type:'engineerBuild',ids:[engineer],kind:'barricade',x:13.5,y:11.5},{type:'recruitVillage',ids:[worker],target:site.id}] as const){
  expect(issueCommand(session.state,0,{...command,ids:[...command.ids]})).toBe(false);expect(issueScenarioCommand(session,0,{...command,ids:[...command.ids]})).toBe(false);expect(captureScenario(session)).toEqual(before);
 }
});

it('uses one village reinforcement allowance for a selected squad and rejects later recruitment through both entry points',()=>{
 const {session,site}=villageMission(false,1),state=session.state,worker=session.runtime.labels.worker,engineer=session.runtime.labels.engineer,recorder=new MatchRecorder(state);
 const before=state.entities.filter(e=>e.side===0&&e.kind==='unit').length;expect(issueScenarioCommand(session,0,{type:'recruitVillage',ids:[worker,engineer],target:site.id})).toBe(true);
 expect(session.runtime.reinforcementRemaining).toBe(0);expect(session.runtime.commandCounts.recruitVillage).toBe(1);expect(session.runtime.variables['action.recruitVillage']).toBe(1);run(state,10);expect(state.entities.filter(e=>e.side===0&&e.kind==='unit')).toHaveLength(before+1);
 const saved=saveGame(state);expect(issueCommand(state,0,{type:'recruitVillage',ids:[worker],target:site.id})).toBe(false);expect(issueScenarioCommand(session,0,{type:'trainCaravan',id:session.runtime.labels.base})).toBe(false);expect(saveGame(state)).toEqual(saved);
 const replay=new ReplayPlayer(recorder.export());while(!replay.finished)replay.advance(20);expect(saveGame(replay.state)).toEqual(saved);replay.dispose();recorder.dispose();
});
