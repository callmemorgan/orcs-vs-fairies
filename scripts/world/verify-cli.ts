import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createMatch,issueCommand,stepGame} from '../../src/core/simulation';
import {loadGame,saveGame} from '../../src/core/saves';
import {MatchRecorder} from '../../src/core/replays';
import {createSessionFile} from '../../src/core/session-storage';
import {worldSourceProof,worldBundleProof,sha,checkCurrentSession} from './proof-common.mjs';
import type {MatchConfig} from '../../src/core/types';

const out=process.argv[2];assert(out,'Pass a new CLI evidence directory and optional full source pin');mkdirSync(out,{recursive:true});
const provenance=await worldSourceProof(process.argv[3]),bundle=worldBundleProof(provenance),cli='dist-cli/rts.js',cliSha256=sha(readFileSync(cli));
const config:MatchConfig={map:{seed:4127,size:'small',biome:'forest'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external'},{id:1,teamId:1,factionId:'fairies',controller:'external'}]};
const native=createMatch(config),actor=native.entities.find(e=>e.side===0&&e.role==='melee')!,transition=native.world!.transitions[0],command={type:'traverse' as const,ids:[actor.id],transition:transition.id},recorder=new MatchRecorder(native);
const requests=[{op:'startMatch',side:0,config},{op:'command',command},{op:'advance',ticks:200},{op:'save'}];
function run(inputs:unknown[],log:string) {const processResult=spawnSync(process.execPath,[cli,'--log',join(out,log)],{input:inputs.map(input=>JSON.stringify(input)).join('\n')+'\n',encoding:'utf8',maxBuffer:128*1024*1024});assert.equal(processResult.status,0,processResult.stderr);const responses=processResult.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(responses.length,inputs.length);for(const response of responses)assert.equal(response.ok,true,response.error);return responses;}
try {
 const responses=run(requests,'cli-world.ndjson');assert.equal(responses[1].result.accepted,true);assert.equal(responses[2].result.advanced,200);
 assert(issueCommand(native,0,command));for(let i=0;i<200;i++)stepGame(native,.05);
 const saved=responses[3].result;assert.equal(saved.version,provenance.saveVersion);assert.equal(saved.state.entities.find((e:{id:number})=>e.id===actor.id).level,1);assert.deepEqual(saved,saveGame(native));
 const file=createSessionFile(native,recorder.export());checkCurrentSession(file,provenance);assert.deepEqual(file.game,saved);writeFileSync(join(out,'cli-world-session.json'),JSON.stringify(file,null,2)+'\n',{flag:'wx'});
 const resumedRequests=[{op:'load',side:0,save:saved},{op:'advance',ticks:20},{op:'save'}],resumedResponses=run(resumedRequests,'cli-world-resumed.ndjson'),restored=loadGame(saved);
 for(let i=0;i<20;i++)stepGame(restored,.05);assert.equal(resumedResponses[1].result.advanced,20);assert.deepEqual(resumedResponses[2].result,saveGame(restored));
 const replay=spawnSync(process.execPath,[cli,'--replay',join(out,'cli-world.ndjson')],{encoding:'utf8',maxBuffer:128*1024*1024});assert.equal(replay.status,0,replay.stderr);const verified=JSON.parse(replay.stdout);assert.equal(verified.verified,requests.length);assert.deepEqual(verified.response.result,saved);
 assert.equal(sha(readFileSync(cli)),cliSha256,'Compiled CLI changed during proof');assert.deepEqual(await worldSourceProof(provenance.sourcePin),provenance);
 const report={provenance,bundle,cli:{path:cli,sha256:cliSha256},driver:{path:'scripts/world/verify-cli.ts',sha256:sha(readFileSync('scripts/world/verify-cli.ts'))},requests,responses,resumedRequests,resumedResponses,accepted:true,levels:saved.state.world.levels.length,actorId:actor.id,traversedLevel:1,saveVersion:saved.version,completeNativeEnvelopeParity:true,completeResumedEnvelopeParity:true,resumedTicks:20,cliLogReplayPassed:true,verifiedLogEntries:verified.verified};
 writeFileSync(join(out,'cli-world.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({sourcePin:provenance.sourcePin,saveVersion:saved.version,actorId:actor.id,traversedLevel:1,completeNativeEnvelopeParity:true,resumedTicks:20,cliLogReplayPassed:true}));
}finally{recorder.dispose();}
