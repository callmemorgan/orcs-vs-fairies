import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const [sourceArgument,pin,nativeArgument,outputArgument]=process.argv.slice(2);
assert(sourceArgument&&pin&&nativeArgument&&outputArgument,'Pass frozen checkout, full pin, completed native output and fresh fixture output.');
const source=resolve(sourceArgument),native=resolve(nativeArgument),output=resolve(outputArgument);
assert.match(pin,/^[a-f0-9]{40}$/);
assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
const inputs=await json(join(native,'source-after.json'));
const admission=await json(join(native,'native-admission.json'));
assert.equal(inputs.sourceCommit,pin);assert.equal(inputs.simulationRevision,'4.0.1');
assert.equal(admission.sourceCommit,pin);assert.equal(admission.status,'passed');
await mkdir(output); // Exclusive reservation; every failed preparation remains retained.
const compiler=await import(pathToFileURL(join(source,'node_modules/esbuild/lib/main.js')).href);
const absolute=path=>JSON.stringify(join(source,path));
const fixtureSource=`
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {decodeCampaignProfile,prepareCampaignMission} from ${absolute('src/core/campaign.ts')};
import {captureScenario,createScenario} from ${absolute('src/core/scenarios.ts')};
import {scenarioStateEquals} from ${absolute('src/core/scenario-recordings.ts')};
import {createSessionFile,decodeSessionFile} from ${absolute('src/core/session-storage.ts')};
import {SAVE_VERSION} from ${absolute('src/core/saves.ts')};
import {SIMULATION_REVISION} from ${absolute('src/core/versions.ts')};
import {makeMapPackage} from ${absolute('src/editor/map-package.ts')};
import {makeScenarioPackage,decodeScenarioPackage} from ${absolute('src/editor/scenario-package.ts')};

export async function derive(native,output,pin){
 assert.equal(SAVE_VERSION,4);assert.equal(SIMULATION_REVISION,'4.0.1');
 const json=async path=>JSON.parse(await readFile(path,'utf8'));
 const save=async(name,value)=>writeFile(join(output,name),JSON.stringify(value,null,2)+'\\n',{flag:'wx'});
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
}`;
await writeFile(join(output,'fixture-source.ts'),fixtureSource,{flag:'wx'});
await writeFile(join(output,'generator.mjs'),await readFile(fileURLToPath(import.meta.url)),{flag:'wx'});
let failure=null;
try{
 const result=await compiler.build({absWorkingDir:source,stdin:{contents:fixtureSource,resolveDir:source,sourcefile:'scenario-browser-fixture-input.ts'},bundle:true,platform:'node',format:'esm',metafile:true,outfile:join(output,'fixture-runtime.mjs'),logLevel:'silent'});
 await writeFile(join(output,'fixture-runtime.meta.json'),JSON.stringify(result.metafile,null,2)+'\n',{flag:'wx'});
 const bundledInputs={};
 for(const name of Object.keys(result.metafile.inputs)){
  if(name==='scenario-browser-fixture-input.ts'){bundledInputs[name]={sha256:sha(fixtureSource),bytes:Buffer.byteLength(fixtureSource),generated:true};continue;}
  const path=relative(source,resolve(source,name));assert(inputs.files[path],`Unpinned fixture module input: ${name}`);
  const data=await readFile(join(source,path));assert.equal(sha(data),inputs.files[path].sha256);assert.equal(data.length,inputs.files[path].bytes);
  bundledInputs[path]=inputs.files[path];
 }
 assert(bundledInputs['src/core/commander-rules.ts']);assert(bundledInputs['src/core/versions.ts']);
 const runtime=await import(pathToFileURL(join(output,'fixture-runtime.mjs')).href);
 await runtime.derive(native,output,pin);
 const historical={historicalGenericSession:'docs/evidence/campaigns/native-save3-20261001/current-campaign-session.json',historicalCampaignProfile:'tests/fixtures/scenario-save3-3.2/campaign-active.json',historicalRealmProfile:'tests/fixtures/scenario-save3-3.2/conquest-active.json'};
 const files={currentCampaignSession:'current-equipped-session.json',authoredScenarioPackage:'authored-commander-scenario.json',finaleCampaignProfile:'canonical-orcs-active-finale.json'};
 const retained={};
 for(const [name,path]of Object.entries(historical)){
  const data=await readFile(join(source,path));assert.equal(sha(data),inputs.files[path].sha256);
  const copied=`${name}.json`;await writeFile(join(output,copied),data,{flag:'wx'});files[name]=copied;
  retained[name]={original:path,sha256:sha(data),bytes:data.length};
 }
 await writeFile(join(output,'fixtures.json'),JSON.stringify({sourceCommit:pin,simulationRevision:'4.0.1',files,historicalInputs:retained},null,2)+'\n',{flag:'wx'});
 for(const [path,expected]of Object.entries(bundledInputs))if(!expected.generated)assert.equal(sha(await readFile(join(source,path))),expected.sha256);
 assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pin);
 await writeFile(join(output,'bundle-admission.json'),JSON.stringify({sourceCommit:pin,simulationRevision:'4.0.1',compilerVersion:compiler.version,bundledInputs,bundle:{sha256:sha(await readFile(join(output,'fixture-runtime.mjs')))},generatorSha256:sha(await readFile(fileURLToPath(import.meta.url))),status:'passed'},null,2)+'\n',{flag:'wx'});
}catch(error){failure={name:error.name,message:error.message,stack:error.stack};throw error;}
finally{await writeFile(join(output,'generation-status.json'),JSON.stringify({sourceCommit:pin,status:failure?'failed':'passed',failure},null,2)+'\n',{flag:'wx'});}
