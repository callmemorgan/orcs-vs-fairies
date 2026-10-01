import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.argv[2],json=p=>JSON.parse(readFileSync(`${root}/${p}`,'utf8')),sha=value=>createHash('sha256').update(value).digest('hex');
const checksum=value=>{const text=JSON.stringify(value);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16).padStart(8,'0');};
const configs=['package.json','package-lock.json','vite.config.ts','tsconfig.json','vitest.config.ts','index.html','editor.html'],results=[];
for(const label of ['corrected-red','green']){
 const report=json(`${label}/reproduction.json`),initial=json(`${label}/input.session.json`),final=json(`${label}/final.session.json`);
 const paths=execFileSync('git',['ls-tree','-r','--name-only',report.sourcePin,'--','src',...configs],{encoding:'utf8'}).trim().split('\n').sort();assert.deepEqual(Object.keys(report.pinned).sort(),paths);
 const committedTool=execFileSync('git',['show',`${report.toolPin}:${report.toolPath}`]),runner=readFileSync(`${root}/${label}/runner.mjs`);assert(committedTool.equals(runner));assert.equal(sha(committedTool),report.toolSha256);assert.equal(report.toolPin,'ac4724c1040fbb221051a375437cc0637150faae');
 assert(runner.toString().includes('replay.seek(startTick); assert.equal(replay.state.tick, startTick);'));
 assert(runner.toString().includes('replay.seek(state.tick); assert.deepEqual(core.saveGame(replay.state), core.saveGame(state));'));
 assert.equal(report.endpointSeekFromTick,6951);assert.equal(report.endpointSeekEqual,true);
 assert.deepEqual(final.replay.initial,initial.game,'New replay must start with the complete raw checkpoint');
 assert.equal(final.game.version,4);assert.equal(final.replay.initial.version,4);assert.equal(final.replay.checksumVersion,4);assert.equal(final.replay.version,1);assert.equal(final.version,1);
 assert.equal(final.replay.finalChecksum,checksum(final.game));assert.equal(initial.replay.finalChecksum,checksum(initial.game));
 assert.equal(final.replay.actions.filter(action=>action.type==='command').length,0);
 const advances=final.replay.actions.filter(action=>action.type==='advance');assert(advances.every(action=>action.dt===.05));assert.equal(advances.reduce((sum,action)=>sum+action.ticks,0),497);
 const crew=final.game.state.entities.find(entity=>entity.id===93).tactics.siegeCrew;assert.deepEqual(crew,{hp:0,maxHp:42,uncrewed:true});
 const spawnCrew=report.transitions[0].attackers.find(actor=>actor.id===93).crew;assert.deepEqual(spawnCrew,{hp:42,maxHp:42,uncrewed:false});
 const hqs=final.game.state.entities.filter(entity=>entity.role==='hq'&&entity.progress===1&&entity.hp>0&&final.game.state.teams[entity.side]===final.game.state.rules.survival.defenderTeam).map(({id,hp})=>({id,hp}));assert.deepEqual(hqs,report.afterExtraTicks.defenderHq);
 const meta=json(`${label}/bundle-meta.json`),metaInputPaths=Object.keys(meta.inputs).filter(path=>path.startsWith('git:')).map(path=>path.slice(4)).sort();assert.deepEqual(metaInputPaths,Object.keys(report.bundleInputs).sort());
 const digest=sha(Object.entries(report.pinned).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,entry])=>`${path}\0${entry.sha256}\n`).join(''));assert.equal(digest,report.sourceDigest);
 results.push({label,sourcePin:report.sourcePin,toolPin:report.toolPin,toolSha256:report.toolSha256,sourceConfigFiles:paths.length,compiledInputs:metaInputPaths.length,sourceDigest:digest,executedBundleSha256:report.executedBundleSha256,rawCheckpointEqualReplayInitial:true,recordedCommandCount:0,recordedStepTicks:497,finalChecksum:final.replay.finalChecksum,finalGameSha256:sha(JSON.stringify(final.game)),spawnCrew,finalCrew:crew,finalPhase:final.game.state.objectives.survival.phase,defenderHq:hqs,endpointSeekFromTick:report.endpointSeekFromTick,endpointSeekToTick:final.replay.finalTick});
}
const binding=json('checks/binding.json'),regression=readFileSync(`${root}/checks/regression.test.ts`),source=execFileSync('git',['show',`${binding.testSourcePin}:${binding.testSourcePath}`]);assert(regression.equals(source));
const redLog=readFileSync(`${root}/checks/red-tests.log`,'utf8'),greenLog=readFileSync(`${root}/checks/green-related-tests.log`,'utf8');assert(redLog.includes('Tests  2 failed (2)'));assert(redLog.includes("expected 'fighting' to be 'recovery'"));assert(redLog.includes("expected 'attackMove' to be 'idle'"));assert(greenLog.includes('Tests  37 passed (37)'));
console.log(JSON.stringify({additionalIndependentArtifactChecks:'passed',simulationExecuted:false,regressionSha256:sha(regression),retainedRegressionResults:{redFailures:2,greenPassed:37},results},null,2));
