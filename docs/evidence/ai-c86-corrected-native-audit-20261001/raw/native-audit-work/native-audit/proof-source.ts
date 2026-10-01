import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {loadGame,saveGame,SAVE_VERSION} from '../../src/core/saves';
import {replayChecksum} from '../../src/core/replays';
import {SIMULATION_REVISION} from '../../src/core/versions';
const [sourcePin,run,output]=process.argv.slice(2),root=join('docs/evidence',run);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourcePin);
assert.equal(SAVE_VERSION,4);assert.equal(SIMULATION_REVISION,'4.0.1');
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const method=json(join(root,'method.json')),summary=json(join(root,'summary.json'));
assert.equal(method.sourceCommit,sourcePin);assert.equal(method.saveVersion,4);assert.equal(method.simulationRevision,'4.0.1');
assert.equal(method.runtime.executable,process.execPath);assert.equal(method.runtime.node,process.version);
assert.equal(method.games,108);assert.deepEqual(method.seeds,[4127]);assert.deepEqual(method.sizes,['small','medium','large']);
assert.equal(method.pairSelection,'all-ordered');assert.equal(method.pairs.length,36);
assert.deepEqual(json(join(root,'verification/source-before.json')),json(join(root,'verification/source-after.json')));
for(const [path,digest] of Object.entries(method.sourceSha256)){
 assert.equal(sha(readFileSync(path)),digest,`Actual source ${path}`);
 assert.equal(sha(readFileSync(join(root,'source',path))),digest,`Captured source ${path}`);
 assert.deepEqual(readFileSync(path),execFileSync('git',['show',`${sourcePin}:${path}`]),`Git source ${path}`);
}
const reportNames=readdirSync(root).filter(name=>name.endsWith('.json')&&!['method.json','summary.json'].includes(name)).sort();
assert.equal(reportNames.length,108);assert.equal(readdirSync(join(root,'saves')).length,108);
const records=[],pairs=new Set<string>();
for(const name of reportNames){
 const report=json(join(root,name)),savePath=join(root,report.finalSaveFile),bytes=readFileSync(savePath),native=JSON.parse(bytes.toString());
 assert.equal(report.sourceCommit,sourcePin);assert.equal(report.saveVersion,4);assert.equal(report.simulationRevision,'4.0.1');
 assert.equal(native.format,'orcs-vs-fairies-save');assert.equal(native.version,4);assert.equal(report.finalSaveVersion,4);
 assert.equal(sha(bytes),report.finalSaveSha256);assert.deepEqual(native.state.players.map(player=>player.faction),[report.faction,report.opponent]);
 assert.equal(native.state.seed,report.seed);assert.equal(native.state.time,report.seconds);assert.deepEqual(native.state.players,report.finalPlayers);
 assert.equal(native.state.winner,report.winner);assert.equal(native.state.winningTeam,report.winningTeam);assert.equal(native.state.draw,report.draw);
 assert.equal(report.invalidEconomy,false);assert.equal(report.invalidPosition,false);assert.equal(report.saveRoundTrip,true);assert.equal(report.saveProof.passed,true);
 assert.equal(report.saveProof.attemptedSteps,20);assert.equal(report.saveProof.checks.length,20);
 assert(report.saveProof.checks.every(check=>check.equal&&check.terminalUnchanged!==false));
 const restored=loadGame(bytes.toString()),resaved=saveGame(restored);
 assert.deepEqual(resaved,native,`Native load/resave ${name}`);assert.equal(replayChecksum(restored),report.finalReplayChecksum);
 resaved.state.visible=resaved.state.visible.map(cells=>cells.slice().sort((a,b)=>a-b));
 resaved.state.explored=resaved.state.explored.map(cells=>cells.slice().sort((a,b)=>a-b));
 assert.equal(sha(JSON.stringify(resaved)),report.finalStateSha256);
 if(report.winner!==null)assert(!native.state.entities.some(entity=>entity.role==='hq'&&entity.side!==report.winner&&entity.hp>0),'Losing HQ must be absent/dead in the native save');
 const key=`${report.seed}/${report.mapSize}/${report.faction}/${report.opponent}`;assert(!pairs.has(key));pairs.add(key);
 records.push({report:name,save:report.finalSaveFile,sha256:sha(bytes),version:native.version,tick:native.state.tick,seconds:native.state.time,winner:native.state.winner,timeout:report.timeout,proofMode:report.saveProof.mode,exactNativeEnvelopeLoadResave:true});
}
assert.equal(summary.games,108);assert.equal(summary.completed,records.filter(record=>!record.timeout).length);
const evidence={sourcePin,run,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,result:'passed',actualReports:records.length,actualNativeSaves:records.length,methodSha256:sha(readFileSync(join(root,'method.json'))),summarySha256:sha(readFileSync(join(root,'summary.json'))),records,scope:'Reads every actual final SAVE4 file, verifies its digest and corresponding gameplay report, loads/resaves current native state exactly, and checks the recorded 20-step proof rows. Does not re-run the completed matches.'};
writeFileSync(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({sourcePin,run,result:evidence.result,actualReports:records.length,actualNativeSaves:records.length}));
