
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {decodeCampaignProfile,prepareCampaignMission} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/core/campaign.ts";
import {captureScenario,createScenario} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/core/scenarios.ts";
import {scenarioStateEquals} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/core/scenario-recordings.ts";
import {createSessionFile,decodeSessionFile} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/core/session-storage.ts";
import {SAVE_VERSION} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/core/saves.ts";
import {SIMULATION_REVISION} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/core/versions.ts";
import {makeMapPackage} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/editor/map-package.ts";
import {makeScenarioPackage,decodeScenarioPackage} from "/tmp/ovf-scenario-453-readiness.yqkz996z/execution/source/src/editor/scenario-package.ts";

export async function derive(native,output,pin){
 assert.equal(SAVE_VERSION,4);assert.equal(SIMULATION_REVISION,'4.0.1');
 const json=async path=>JSON.parse(await readFile(path,'utf8'));
 const save=async(name,value)=>writeFile(join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const hashes={};
 const nativeArtifacts=(await json(join(native,'native-admission.json'))).artifacts;
 const sourceJson=async(path,label)=>{const bytes=await readFile(path);const receipt=nativeArtifacts[resolve(path)];assert(receipt,'Unadmitted native input: '+path);assert.equal(createHash('sha256').update(bytes).digest('hex'),receipt.sha256);assert.equal(bytes.length,receipt.bytes);hashes[label]={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};return JSON.parse(bytes.toString());};
 const rawEquipped=await sourceJson(join(native,'persistent-army/chapter1-equipped-active-profile.json'),'earnedEquippedProfile');
 const originalCheckpoint=await sourceJson(join(native,'persistent-army/chapter1-equipped-checkpoint.json'),'earnedEquippedCheckpoint');
 const equipped=prepareCampaignMission(decodeCampaignProfile(rawEquipped));
 try{
  assert.deepEqual(equipped.profile,rawEquipped);assert.deepEqual(captureScenario(equipped.session),originalCheckpoint);
  const generic=createSessionFile(equipped.session.state,undefined,undefined,{kind:'campaign',profile:equipped.profile});
  const loaded=decodeSessionFile(generic);assert(scenarioStateEquals({...equipped.session,state:loaded.state,runtime:loaded.state.scenario.runtime},equipped.session));
  const actor=equipped.session.state.entities.find(entity=>entity.side===0&&entity.equipment?.armor);
  assert(actor);assert.equal(equipped.session.state.specialists.artifacts.find(item=>item.id===actor.equipment.armor)?.definitionId,'core:iron-aegis');
  await save('current-equipped-session.json',generic);
 }finally{equipped.recorder.destroy();}
 const primary=await sourceJson(join(native,'primary.json'),'primaryReport');
 const earned=primary.profiles.find(profile=>profile.campaignId==='campaign-orcs');assert(earned);
 const completed=decodeCampaignProfile(await sourceJson(earned.profilePath,'earnedCompletedOrcProfile'));
 assert.equal(completed.history.length,4);assert.equal(completed.active,null);
 const prefix=decodeCampaignProfile({...completed,history:completed.history.slice(0,3),active:null});
 const finale=prepareCampaignMission(prefix);
 try{
  assert.equal(finale.profile.active.missionId,'orcs-4');assert.deepEqual(finale.profile.history,completed.history.slice(0,3));
  assert.equal(finale.profile.id,completed.id);assert.equal(finale.profile.choiceId,completed.choiceId);
  await save('canonical-orcs-active-finale.json',finale.profile);
 }finally{finale.recorder.destroy();}
 const width=36,height=36;
 const map={width,height,size:'small',seed:96101,
  levels:[{id:0,title:'Ground',terrain:Array(width*height).fill('grass'),elevation:Array(width*height).fill(0)}],
  starts:[{slot:0,level:0,x:6.5,y:26.5},{slot:1,level:0,x:28.5,y:6.5}],resources:[],sites:[],transitions:[]};
 const mapPackage=makeMapPackage({id:'commander-field',title:'Commander field',author:'Native scenario proof',revision:1},map);
 const mark={x:14.5,y:26.5};
 const condition={type:'at',actor:'commander',point:mark,radius:.75};
 const definition={schemaVersion:1,id:'authored-command-field',title:'Command field',briefing:'Use Iron Command beside the allied line, then reach the signal mark.',
  successText:'The signal is raised.',failureText:'The commander was lost.',faction:'orcs',opponent:'fairies',seed:map.seed,
  army:[{label:'commander',side:0,kind:'unit',role:'special',definitionId:'core:orcs-commander',x:6.5,y:26.5,order:{type:'hold'}},
        {label:'line-a',side:0,kind:'unit',role:'melee',x:8.5,y:25.5,order:{type:'hold'}},
        {label:'line-b',side:0,kind:'unit',role:'ranged',x:8.5,y:27.5,order:{type:'hold'}}],
  objectives:[{id:'signal-mark',text:'Reach the signal mark.',success:condition,failure:{type:'dead',actor:'commander'}}],
  events:[{id:'raise-signal',when:condition,actions:[{type:'finish',outcome:'won',reason:'Reached the signal mark.'}]}],
  rules:{fixedArmy:true,reinforcementBudget:0,resources:{wood:0,ore:0,crystal:0},timeLimit:600}};
 const authored=decodeScenarioPackage(makeScenarioPackage({author:'Native scenario proof',revision:1},definition,mapPackage));
 const authoredSession=createScenario(authored.scenario);decodeSessionFile(createSessionFile(authoredSession.state));
 await save('authored-commander-scenario.json',authored);
 await save('derivation.json',{sourceCommit:pin,simulationRevision:SIMULATION_REVISION,saveVersion:SAVE_VERSION,sourceInputs:hashes,
  finale:'The same first three earned chapter records are selected from the genuine completed primary profile; native preparation creates the finale deployment.',
  equipped:'Native restore and session APIs preserve the original checkpoint, accepted command prefix and earned Iron Aegis.',
  authored:'This authored field is a new declared scenario fixture, not an earned campaign result. No gameplay command is authored by this generator; native validation replays genuine current journals.',
  visible:{authored:{commander:{x:6.5,y:26.5},abilityTarget:{x:7.5,y:26.5},finishMark:mark,mapEditCell:{level:0,x:18,y:18,from:'grass',to:'mud'}},
   equipped:{commander:rawEquipped.active.checkpoint.runtime.labels.commander},finale:{commander:finale.profile.active.checkpoint.runtime.labels.commander}}});
}