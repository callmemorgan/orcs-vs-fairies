import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {decodeSessionFile} from '../../src/core/session-storage';
import {saveGame,SAVE_VERSION} from '../../src/core/saves';
import {ReplayPlayer} from '../../src/core/replays';
import {SIMULATION_REVISION} from '../../src/core/versions';

declare const __OVF_PROOF_PIN__:string;
declare const __OVF_PROOF_SOURCE_DIGEST__:string;
const [inputPath,outputPath,sourcePin,manifestPath,mode]=process.argv.slice(2);
assert(inputPath&&outputPath&&manifestPath,'Pass input session, output record, approved source SHA and module manifest.');
assert.equal(sourcePin,__OVF_PROOF_PIN__,'The executed checker bundle uses a different source pin.');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourcePin);
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));assert.equal(manifest.sourcePin,sourcePin);assert.equal(manifest.sourceDigest,__OVF_PROOF_SOURCE_DIGEST__);
const executable=readFileSync(resolve(process.argv[1]));assert.equal(sha(executable),manifest.modules['verify-native-session.mjs'].sha256,'Executed checker bytes differ from preparation.');
const inputs={...manifest.sourceFiles,...manifest.configFiles};
for(const [path,record] of Object.entries(inputs) as [string,{sha256:string}][]){const bytes=readFileSync(path),pinned=execFileSync('git',['show',`${sourcePin}:${path}`],{maxBuffer:128*1024*1024});assert(bytes.equals(pinned),path);assert.equal(sha(bytes),record.sha256,path);}
const paths=execFileSync('git',['ls-tree','-r','--name-only',sourcePin,'--','src'],{encoding:'utf8'}).trim().split('\n').sort();assert.deepEqual(Object.keys(manifest.sourceFiles).sort(),paths,'Checker source inventory differs from the pinned tree.');
const digest=sha(Object.entries(inputs).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,item])=>`${path}\0${(item as {sha256:string}).sha256}\n`).join(''));assert.equal(digest,__OVF_PROOF_SOURCE_DIGEST__);
const raw=readFileSync(inputPath),file=JSON.parse(raw.toString()),decoded=decodeSessionFile(raw.toString());assert.equal(file.game.version,SAVE_VERSION);assert.equal(SAVE_VERSION,4);assert.equal(manifest.schema.simulationRevision,SIMULATION_REVISION);assert.deepEqual(decoded.file,file);assert.deepEqual(saveGame(decoded.state),file.game,'Complete loaded and resaved game differs.');
let replayVerified=false;
if(file.replay){
 assert.equal(file.replay.initial.version,SAVE_VERSION);assert.equal(file.replay.checksumVersion,SAVE_VERSION);assert.equal(file.replay.simulationRevision,SIMULATION_REVISION);
 const player=new ReplayPlayer(file.replay);
 try{while(!player.finished)player.advance(200);assert.deepEqual(saveGame(player.state),file.game,'Complete replay endpoint differs from native exported game.');replayVerified=true;}
 finally{player.dispose();}
}else assert.equal(mode,'--fixture','Every native browser export must contain replay history.');
const result={inputPath,inputSha256:sha(raw),sourcePin,sourceDigest:digest,executedCheckerSha256:sha(executable),saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,fullFileDecodeEqualsInput:true,fullGameLoadResaveEqualsInput:true,fullGameReplayEqualsInput:replayVerified,fixtureWithoutReplay:!file.replay,finalTick:file.game.state.tick};
writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
