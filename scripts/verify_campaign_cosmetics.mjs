import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const campaignSource=resolve(process.argv[2]??'.'),sourceCommit=process.argv[3]??execFileSync('git',['-C',campaignSource,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),supplementalCommits=process.argv[4]?.split(',')??[];
const output=resolve('work/competitions/canonical-campaign.mjs');await mkdir(resolve('work/competitions'),{recursive:true});
await build({stdin:{contents:`import {CAMPAIGNS} from ${JSON.stringify(join(campaignSource,'src/scenarios/campaigns.ts'))};
  import {createCampaignProfile,chooseCampaignBranch,prepareCampaignMission,completeCampaignMission} from ${JSON.stringify(join(campaignSource,'src/core/campaign.ts'))};
  import {solveMission} from ${JSON.stringify(join(campaignSource,'scripts/scenarios/mission-strategy.ts'))};
  import {restoreScenario,captureScenario,issueScenarioCommand,stepScenario} from ${JSON.stringify(join(campaignSource,'src/core/scenarios.ts'))};
  import {scenarioChecksum,verifyScenarioRecording} from ${JSON.stringify(join(campaignSource,'src/core/scenario-recordings.ts'))};
  export {verifyCanonicalCampaignVictory} from ${JSON.stringify(join(campaignSource,'src/core/campaign.ts'))};
  export function alteredCanonicalProfile(profile){const forged=structuredClone(profile),chapter=forged.history[0];chapter.recording.initial.runtime.variables.cosmeticForgery=1;const session=restoreScenario(chapter.recording.initial);let index=0;while(session.state.tick<=chapter.recording.finalTick){while(index<chapter.recording.commands.length&&chapter.recording.commands[index].tick===session.state.tick){const action=chapter.recording.commands[index++];if(!issueScenarioCommand(session,action.side,action.command))throw new Error('Altered fixture command diverged.');}if(session.state.tick===chapter.recording.finalTick)break;stepScenario(session);}chapter.checkpoint=captureScenario(session);chapter.recording.finalChecksum=scenarioChecksum(session);verifyScenarioRecording(chapter.recording);return forged;}
  export function completedProfile(){const definition=CAMPAIGNS['campaign-orcs'];let profile=createCampaignProfile(definition.id,'Campaign-Server-Proof');for(let chapter=0;chapter<4;chapter++){if(chapter===2)profile=chooseCampaignBranch(profile,definition.choice.options[0].id);const run=prepareCampaignMission(profile);profile=run.profile;solveMission(run.session);if(run.session.runtime.outcome!=='won')throw new Error('Canonical mission did not win.');const journal=run.recorder.archive();run.recorder.destroy();profile=completeCampaignMission(profile,run.session,journal);}return profile;}`,resolveDir:campaignSource,sourcefile:'cosmetics-canonical-proof.ts'},bundle:true,platform:'node',format:'esm',outfile:output});
await build({entryPoints:['src/server/server.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'work/competitions/campaign-server.mjs'});
await build({entryPoints:['src/server/campaign-verification.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'work/competitions/campaign-worker.mjs'});
const canonical=await import(output),{createRtsServer}=await import(resolve('work/competitions/campaign-server.mjs')),{createCampaignVerificationWorker}=await import(resolve('work/competitions/campaign-worker.mjs'));
const profile=canonical.completedProfile(),missionId=profile.history.at(-1).missionId;
assert.equal(profile.history.length,4);const metadata=canonical.verifyCanonicalCampaignVictory(profile,missionId);
const directory=await mkdtemp(join(tmpdir(),'ovf-campaign-cosmetics-'));let server=await createRtsServer({port:0,dataDir:directory,competitionNow:()=>Date.UTC(2026,9,1),verifyCampaignVictory:createCampaignVerificationWorker(output)}),cookie='';
const checks=[];const record=name=>{checks.push(name);console.log('PASS '+name);};
async function request(path,value){const response=await fetch(server.url+path,{method:value===undefined?'GET':'POST',headers:{Cookie:cookie,...(value===undefined?{}:{'Content-Type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;return {status:response.status,data:await response.json()};}
try{
  assert.equal((await request('/api/cosmetics/campaign-victory',{missionId,recording:profile})).status,401);
  assert.equal((await request('/api/auth/register',{username:'CanonicalCampaignProof',password:'canonical-campaign-proof'})).status,200);
  const daily=(await request('/api/challenges/daily/start',{})).data.lobby.matchId;
  const before=(await request('/api/matches')).data.matches.find(match=>match.id===daily).tick;
  const pending=request('/api/cosmetics/campaign-victory',{missionId,recording:profile});let healthReads=0,complete=false;pending.finally(()=>{complete=true;});
  while(!complete){assert.equal((await request('/api/health')).status,200);healthReads++;await new Promise(resolve=>setTimeout(resolve,10));}
  const first=await pending;assert.equal(first.status,200);assert.deepEqual(first.data.verified,metadata);assert.deepEqual(first.data.profile.wins,{orcs:1});assert.deepEqual(first.data.profile.owned,['orcs-victory-banner']);record('four canonical chapters replay on the server and grant one authenticated faction victory');
  const after=(await request('/api/matches')).data.matches.find(match=>match.id===daily).tick;assert.ok(after>before);assert.ok(healthReads>0);record('authoritative hosted ticks and health requests continue during off-thread campaign replay');
  const duplicate=await request('/api/cosmetics/campaign-victory',{missionId,recording:profile});assert.equal(duplicate.status,200);assert.deepEqual(duplicate.data.profile,first.data.profile);
  const renamed=structuredClone(profile);renamed.id='Edited-Profile-Name';renamed.history.forEach(result=>{result.resultId=renamed.id+'/'+result.missionId;});const renamedClaim=await request('/api/cosmetics/campaign-victory',{missionId,recording:renamed});assert.equal(renamedClaim.status,200);assert.deepEqual(renamedClaim.data.profile,first.data.profile);record('retry and edited local profile IDs do not grant the canonical campaign twice');
  const forged=structuredClone(profile);forged.history.at(-1).recording.finalChecksum='00000000';assert.equal((await request('/api/cosmetics/campaign-victory',{missionId,recording:forged})).status,400);
  assert.equal((await request('/api/cosmetics/campaign-victory',{missionId:profile.history[0].missionId,recording:profile})).status,400);assert.equal((await request('/api/cosmetics/campaign-victory',{missionId,recording:profile,winner:0})).status,400);assert.deepEqual((await request('/api/cosmetics')).data.profile,first.data.profile);record('forged checksums, wrong finales and client winner fields cannot award inventory');
  const altered=canonical.alteredCanonicalProfile(profile);assert.equal((await request('/api/cosmetics/campaign-victory',{missionId,recording:altered})).status,400);assert.deepEqual((await request('/api/cosmetics')).data.profile,first.data.profile);record('a replay-valid recording with recomputed checksum and altered initial state cannot authorize canonical rewards');
  await server.close();server=await createRtsServer({port:0,dataDir:directory,competitionNow:()=>Date.UTC(2026,9,1),verifyCampaignVictory:createCampaignVerificationWorker(output)});assert.deepEqual((await request('/api/cosmetics')).data.profile,first.data.profile);assert.deepEqual((await request('/api/cosmetics/campaign-victory',{missionId,recording:profile})).data.profile,first.data.profile);record('campaign reward and canonical duplicate gate survive a real server restart');
  const evidence=resolve('docs/evidence/cosmetics-campaign');await mkdir(evidence,{recursive:true});
  const recordingFile='campaign-recording.json.gz';await writeFile(join(evidence,recordingFile),gzipSync(JSON.stringify(profile)));
  const recordingBytes=await readFile(join(evidence,recordingFile));assert.deepEqual(JSON.parse(gunzipSync(recordingBytes).toString()),profile);
  await writeFile(join(evidence,'result.json'),JSON.stringify({checks,sourceCommit,supplementalCommits,metadata,profile:first.data.profile,recordingArtifact:{file:recordingFile,sha256:createHash('sha256').update(recordingBytes).digest('hex'),bytes:recordingBytes.length},hostedTicks:{before,after,healthReads},method:'The authoritative service loads the canonical module in a worker, replays all chapter commands, compares the full normalized canonical initial detachments and carried-army checkpoints, and awards by authenticated account plus canonical campaign/finale. The service is never given a client winner or score.'},null,2));
}finally{await server.close();await rm(directory,{recursive:true,force:true});}
