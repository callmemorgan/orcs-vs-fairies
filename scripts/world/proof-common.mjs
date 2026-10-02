import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {readFileSync,lstatSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {inventory,sha,sourceProvenance} from '../controls-proof/browser-common.mjs';

export {sha};
export const WORLD_MODULE_ENTRIES={generate:'scripts/world/generate-browser-fixtures.ts',native:'scripts/world/verify-native-export.ts',cli:'scripts/world/verify-cli.ts','mod-fixture':'scripts/mods/scenario.ts'};
export const WORLD_COMPILER_OPTIONS=['--bundle','--platform=node','--format=esm','--loader:.svg=text'];
const scriptPaths=['scripts/world','scripts/mods/scenario.ts','scripts/verify_world.mjs','scripts/verify_world_actions.mjs','scripts/verify_served_build.mjs',
 'scripts/verify_mods.mjs','scripts/verify_editors.mjs','scripts/verify_scenario_editor.mjs','scripts/verify_layered_scenario_editor.mjs','scripts/verify_community_mod.mjs','scripts/verify_community_browser.mjs'];
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();

async function regularProjectFile(path) {
 const parts=path.split('/');
 for(let i=1;i<=parts.length;i++) {
  const name=parts.slice(0,i).join('/'),info=await lstat(name);
  assert(!info.isSymbolicLink(),`Proof input must not be a symlink: ${name}`);
  assert(i===parts.length?info.isFile():info.isDirectory(),`Proof input must be a regular file: ${path}`);
 }
}
async function projectFiles(directory) {
 assert((await lstat(directory)).isDirectory(),`Proof input must be a directory: ${directory}`);
 const paths=[];
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  const path=`${directory}/${entry.name}`,info=await lstat(path);
  assert(!info.isSymbolicLink(),`Proof input must not be a symlink: ${path}`);
  if(info.isDirectory())paths.push(...await projectFiles(path));
  else {assert(info.isFile(),`Proof input must be a regular file: ${path}`);paths.push(path);}
 }
 return paths.sort();
}
export function worldInputFiles(provenance) {
 return {...provenance.sourceFiles,...provenance.assetFiles,...provenance.configFiles,...provenance.scriptFiles,...provenance.testFiles,...provenance.worldScriptFiles};
}
export async function worldSourceProof(sourcePin=process.env.OVF_PRODUCTION_SOURCE_COMMIT??git(['rev-parse','HEAD'])) {
 const provenance=await sourceProvenance(sourcePin);
 const tree=execFileSync('git',['ls-tree','-r','-z',sourcePin,'--',...scriptPaths],{encoding:'utf8'}).split('\0').filter(Boolean),worldScriptFiles={};
 for(const record of tree) {
  const match=record.match(/^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/);assert(match,`World driver must be a regular Git blob: ${record}`);
  const [,,gitBlob,path]=match;await regularProjectFile(path);
  const bytes=await readFile(path),pinned=execFileSync('git',['cat-file','blob',gitBlob],{maxBuffer:128*1024*1024});
  assert(bytes.equals(pinned),`World driver bytes differ from the pin: ${path}`);
  worldScriptFiles[path]={sha256:sha(bytes),bytes:bytes.length,gitBlob};
 }
 const inputs=worldInputFiles({...provenance,worldScriptFiles});
 const flags=execFileSync('git',['ls-files','-v','-z','--',...Object.keys(inputs)],{encoding:'utf8'}).split('\0').filter(Boolean);
 for(const entry of flags)assert(entry[0]!=='S'&&entry[0]===entry[0].toUpperCase(),`Proof input index flags must not hide changes: ${entry.slice(2)}`);
 for(const path of Object.keys(inputs))await regularProjectFile(path);
 for(const directory of ['src','public','scripts/controls-proof','scripts/minimap-alerts','scripts/world']) {
  assert.deepEqual(await projectFiles(directory),Object.keys(inputs).filter(path=>path.startsWith(`${directory}/`)).sort(),`Proof input inventory must match Git: ${directory}`);
 }
 const sourceDigest=sha(Object.entries(inputs).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,item])=>`${path}\0${item.sha256}\n`).join(''));
 const saveSource=await readFile('src/core/saves.ts','utf8'),rulesSource=await readFile('src/core/versions.ts','utf8');
 const saveVersion=Number(saveSource.match(/export const SAVE_VERSION\s*=\s*(\d+)/)?.[1]),simulationRevision=rulesSource.match(/export const SIMULATION_REVISION\s*=\s*['"]([^'"]+)/)?.[1];
 assert.equal(saveVersion,4,'Regenerate final proof from SAVE4 source');assert.equal(simulationRevision,'4.0.2','Use the approved SAVE4 rules revision');
 return {...provenance,worldScriptFiles,sourceDigest,saveVersion,simulationRevision};
}

export function worldMetafileInputs(meta,provenance) {
 const verified=worldInputFiles(provenance),inputs={};
 for(const [raw,item] of Object.entries(meta.inputs)) {
  const path=raw.replace(/\?raw$/,'').split('\\').join('/');
  assert(verified[path],`Compiler consumed an unpinned project input: ${path}`);
  assert.equal(item.bytes,verified[path].bytes,`Compiler input byte count differs: ${path}`);
  inputs[path]=verified[path];
 }
 return inputs;
}
export async function compileWorldModule(provenance,name,directory) {
 const entry=WORLD_MODULE_ENTRIES[name];assert(entry,`Unknown world module: ${name}`);
 const path=`${name}.mjs`,metafilePath=`${name}.meta.json`,outputPath=join(directory,path);
 execFileSync('node_modules/.bin/esbuild',[entry,...WORLD_COMPILER_OPTIONS,
  `--define:__OVF_WORLD_PROOF_PIN__=${JSON.stringify(provenance.sourcePin)}`,
  `--define:__OVF_WORLD_SOURCE_DIGEST__=${JSON.stringify(provenance.sourceDigest)}`,
  `--metafile=${join(directory,metafilePath)}`,`--outfile=${outputPath}`],{stdio:'pipe'});
 const bytes=await readFile(outputPath),metafileBytes=await readFile(join(directory,metafilePath)),meta=JSON.parse(metafileBytes);
 const outputs=Object.entries(meta.outputs);assert.equal(outputs.length,1,'Native preparation must emit only the named bundle');assert.equal(outputs[0][1].entryPoint,entry);
 return {entry,path,sha256:sha(bytes),bytes:bytes.length,metafile:{path:metafilePath,sha256:sha(metafileBytes)},inputs:worldMetafileInputs(meta,provenance)};
}

function preparedFile(path) {
 assert(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink(),`Prepared artifact must be a regular file: ${path}`);
 return readFileSync(path);
}
export function verifyWorldPreparation(provenance,directory,preparationSha256) {
 assert(directory,'Pass the current prepared modules directory');
 assert.match(preparationSha256??'',/^[0-9a-f]{64}$/,'Pass the retained preparation receipt SHA256');
 const out=resolve(directory);assert(lstatSync(out).isDirectory()&&!lstatSync(out).isSymbolicLink(),'Prepared modules must be a directory without a symlink');
 const receiptPath=join(out,'prepare.json'),receiptBytes=preparedFile(receiptPath);
 assert.equal(sha(receiptBytes),preparationSha256,'Preparation receipt bytes changed');
 const receipt=JSON.parse(receiptBytes),manifestPath=join(out,'manifest.json'),manifestBytes=preparedFile(manifestPath),manifest=JSON.parse(manifestBytes);
 assert.equal(receipt.format,1);assert.equal(manifest.format,1);
 assert.equal(receipt.manifestSha256,sha(manifestBytes),'Prepared module manifest bytes changed');
 assert.deepEqual(manifest.provenance,provenance,'Prepared inputs differ from the Git-authenticated source');
 assert.equal(receipt.sourcePin,provenance.sourcePin);assert.equal(receipt.sourceDigest,provenance.sourceDigest);
 assert.deepEqual(manifest.entries,WORLD_MODULE_ENTRIES);assert.deepEqual(manifest.compiler.options,WORLD_COMPILER_OPTIONS);
 assert.deepEqual(Object.keys(manifest.modules).sort(),Object.keys(WORLD_MODULE_ENTRIES).sort());
 for(const [name,item] of Object.entries(manifest.modules)) {
  assert.equal(item.path,`${name}.mjs`);assert.equal(item.metafile.path,`${name}.meta.json`);assert.equal(item.entry,WORLD_MODULE_ENTRIES[name]);
  const bytes=preparedFile(join(out,item.path)),meta=preparedFile(join(out,item.metafile.path));
  assert.equal(sha(bytes),item.sha256,`Prepared bundle bytes changed: ${name}`);assert.equal(bytes.length,item.bytes);
  assert.equal(sha(meta),item.metafile.sha256,`Prepared compiler metafile changed: ${name}`);
  assert.deepEqual(item.inputs,worldMetafileInputs(JSON.parse(meta),provenance),`Prepared compiler inputs differ: ${name}`);
 }
 const paths=readdirSyncFiles(out);assert.deepEqual(paths,Object.values(manifest.modules).flatMap(item=>[item.path,item.metafile.path]).concat(['prepare.json','manifest.json']).sort(),'Prepared module inventory changed');
 return {out,receiptPath,preparationSha256,manifestPath,manifestSha256:sha(manifestBytes),manifest};
}
function readdirSyncFiles(directory) {
 // The prepared directory is intentionally flat; no caches or unrecorded outputs belong here.
 const paths=readdirSync(directory);for(const name of paths)preparedFile(join(directory,name));return paths.sort();
}
export function worldBundleProof(provenance) {
 const compiledPin=typeof __OVF_WORLD_PROOF_PIN__==='string'?__OVF_WORLD_PROOF_PIN__:undefined;
 const compiledDigest=typeof __OVF_WORLD_SOURCE_DIGEST__==='string'?__OVF_WORLD_SOURCE_DIGEST__:undefined;
 assert.equal(compiledPin,provenance.sourcePin,'Native module must be prepared from the current full source pin');
 assert.equal(compiledDigest,provenance.sourceDigest,'Native module must be prepared from the current authenticated inputs');
 const path=resolve(process.argv[1]),prepared=verifyWorldPreparation(provenance,process.env.OVF_WORLD_MODULES??dirname(path),process.env.OVF_WORLD_PREPARATION_SHA256);
 const entry=prepared.manifest.modules[process.env.OVF_WORLD_MODULE_NAME];assert(entry,'Executing native module must be named by the authenticated launcher');
 assert.equal(path,process.env.OVF_WORLD_EXECUTED_MODULE,'Execute the private bundle rebuilt by the current launcher');
 const sha256=sha(preparedFile(path));assert.equal(sha256,entry.sha256,'Executing native module bytes differ from preparation');
 assert.equal(sha256,process.env.OVF_WORLD_REBUILT_SHA256,'Run the native module through the current authenticated launcher and fresh rebuild');
 return {path,sha256,sourcePin:compiledPin,sourceDigest:compiledDigest,preparationSha256:prepared.preparationSha256,manifestSha256:prepared.manifestSha256,launcherExpectedSha256:process.env.OVF_WORLD_REBUILT_SHA256,preparedPath:join(prepared.out,entry.path)};
}

export async function freshWorldOutput(out) {
 await mkdir(out,{recursive:true});assert((await lstat(out)).isDirectory()&&!(await lstat(out)).isSymbolicLink(),'Proof output must be a directory without a symlink');
 assert.deepEqual(await readdir(out),[],'Use an empty fresh world output directory; partial prior captures cannot be reused');
}

export function checkCurrentSession(file,provenance) {
 assert.equal(file.game.version,provenance.saveVersion);
 assert(file.replay,'Native export must retain recorder history');
 assert.equal(file.replay.initial.version,provenance.saveVersion);assert.equal(file.replay.checksumVersion,provenance.saveVersion);
 assert.equal(file.replay.simulationRevision,provenance.simulationRevision);assert.equal(file.replay.finalTick,file.game.state.tick);
}

export async function prepareWorldProof(url,out,kind) {
 await freshWorldOutput(out);
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
