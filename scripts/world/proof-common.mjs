import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {inventory,sha,sourceProvenance} from '../controls-proof/browser-common.mjs';

export {sha};
const scriptPaths=['scripts/world','scripts/mods/scenario.ts','scripts/verify_world.mjs','scripts/verify_world_actions.mjs','scripts/verify_served_build.mjs',
 'scripts/verify_mods.mjs','scripts/verify_editors.mjs','scripts/verify_scenario_editor.mjs','scripts/verify_layered_scenario_editor.mjs','scripts/verify_community_mod.mjs','scripts/verify_community_browser.mjs'];
export async function worldSourceProof(sourcePin=process.env.OVF_PRODUCTION_SOURCE_COMMIT??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()) {
 const provenance=await sourceProvenance(sourcePin);
 assert.equal(execFileSync('git',['diff',sourcePin,'--name-only','--',...scriptPaths],{encoding:'utf8'}).trim(),'','World drivers must match the recorded source');
 const scripts=execFileSync('git',['ls-tree','-r','--name-only',sourcePin,'--',...scriptPaths],{encoding:'utf8'}).trim().split('\n').filter(Boolean),worldScriptFiles={};
 for(const path of scripts)worldScriptFiles[path]={sha256:sha(await readFile(path))};
 const saveSource=await readFile('src/core/saves.ts','utf8'),rulesSource=await readFile('src/core/versions.ts','utf8');
 const saveVersion=Number(saveSource.match(/export const SAVE_VERSION\s*=\s*(\d+)/)?.[1]),simulationRevision=rulesSource.match(/export const SIMULATION_REVISION\s*=\s*['"]([^'"]+)/)?.[1];
 assert.equal(saveVersion,4,'Regenerate final proof from SAVE4 source');assert.equal(simulationRevision,'4.0.0','Use the approved SAVE4 rules revision');
 return {...provenance,worldScriptFiles,saveVersion,simulationRevision};
}

export function worldBundleProof(provenance) {
 const compiledPin=typeof __OVF_WORLD_PROOF_PIN__==='string'?__OVF_WORLD_PROOF_PIN__:undefined;
 assert.equal(compiledPin,provenance.sourcePin,'Bundle this driver with --define:__OVF_WORLD_PROOF_PIN__="FULL_SOURCE_PIN"');
 const path=resolve(process.argv[1]);return {path,sha256:sha(readFileSync(path)),sourcePin:compiledPin};
}

export function checkCurrentSession(file,provenance) {
 assert.equal(file.game.version,provenance.saveVersion);
 assert(file.replay,'Native export must retain recorder history');
 assert.equal(file.replay.initial.version,provenance.saveVersion);assert.equal(file.replay.checksumVersion,provenance.saveVersion);
 assert.equal(file.replay.simulationRevision,provenance.simulationRevision);assert.equal(file.replay.finalTick,file.game.state.tick);
}

export async function prepareWorldProof(url,out,kind) {
 await mkdir(out,{recursive:true});
 const provenance=await worldSourceProof(),scriptFiles=provenance.worldScriptFiles;
 const compiledFiles=await inventory('dist');assert(compiledFiles['index.html'],'Build the production application before world proof');
 const servedPath=join(out,`served-${kind}-build.json`);
 execFileSync(process.execPath,['scripts/verify_served_build.mjs',url,servedPath],{stdio:'pipe'});
 const servedBuild=JSON.parse(await readFile(servedPath,'utf8'));assert.equal(servedBuild.commit,provenance.sourcePin);assert.equal(servedBuild.sourceSha256,provenance.buildId);
 return {url,out:resolve(out),kind,provenance,scriptFiles,compiledFiles,servedBuild};
}

export async function finishWorldProof(context,evidence) {
 const end=await worldSourceProof(context.provenance.sourcePin);
 assert.deepEqual(end,context.provenance,'Source changed during world proof');assert.deepEqual(await inventory('dist'),context.compiledFiles,'Production build changed during world proof');
 for(const [path,item] of Object.entries(context.scriptFiles))assert.equal(sha(await readFile(path)),item.sha256,`World driver changed: ${path}`);
 const afterPath=join(context.out,`served-${context.kind}-after-build.json`);execFileSync(process.execPath,['scripts/verify_served_build.mjs',context.url,afterPath],{stdio:'pipe'});const servedAfter=JSON.parse(await readFile(afterPath,'utf8'));
 assert.equal(servedAfter.htmlSha256,context.servedBuild.htmlSha256);assert.deepEqual(servedAfter.assets,context.servedBuild.assets,'Served production bytes changed during world proof');
 const artifacts=await inventory(context.out);for(const name of Object.keys(artifacts))if(name.endsWith('.log')||name.endsWith('-manifest.json'))delete artifacts[name];
 await writeFile(join(context.out,`${context.kind}-manifest.json`),JSON.stringify({...context.provenance,scriptFiles:context.scriptFiles,compiledFiles:context.compiledFiles,servedBuild:context.servedBuild,servedAfter,artifacts,result:evidence.failure?'failed':'passed'},null,2)+'\n',{flag:'wx'});
}

export async function downloadWorldSave(page,context,name,evidence) {
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export save',exact:true}).click();const path=join(context.out,name);await (await pending).saveAs(path);
 const bytes=await readFile(path),file=JSON.parse(bytes);checkCurrentSession(file,context.provenance);
 evidence.nativeExports??=[];evidence.nativeExports.push({path:name,sha256:sha(bytes),saveVersion:file.game.version,simulationRevision:file.replay.simulationRevision,tick:file.game.state.tick});return file;
}

export async function downloadWorldBuildReport(page,context,name,evidence) {
 await page.locator('[data-session-tab="report"]').click();await page.getByLabel('Bug description',{exact:true}).fill('Fresh SAVE4 world verification.');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download bug report',exact:true}).click();const path=join(context.out,name);await (await pending).saveAs(path);
 const bytes=await readFile(path),report=JSON.parse(bytes);assert.equal(report.versions.buildId,context.provenance.buildId);assert.equal(report.versions.save,context.provenance.saveVersion);assert.equal(report.versions.simulationRevision,context.provenance.simulationRevision);checkCurrentSession(report.session,context.provenance);
 evidence.applicationBuild={path:name,sha256:sha(bytes),buildId:report.versions.buildId};return report;
}
