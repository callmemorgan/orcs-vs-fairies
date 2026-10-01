import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {modeProvenance,sourceDigest,inventory,sha} from './proof-common.mjs';

const sourcePin=process.argv[2],out=resolve(process.argv[3]??'');
assert(process.argv[3],'Usage: node scripts/modes/prepare.mjs FULL_SOURCE_PIN NEW_OUTPUT_ROOT');
const provenance=await modeProvenance(sourcePin),digest=sourceDigest(provenance);
await mkdir(out,{recursive:true});
assert.deepEqual(await readdir(out),[],'Use an empty fresh output root; preserve partial prior proofs');
const modulesDir=join(out,'modules'),distDir=join(out,'dist'),serverDir=join(out,'dist-server');
await mkdir(modulesDir);
const entries={
  'schema.mjs':'scripts/controls-proof/schema.ts',
  'verify-native.mjs':'scripts/controls-proof/verify-native.ts',
  'verify-runtime.mjs':'scripts/modes/verify-runtime.ts',
};
const bundleInputs={},pinnedFiles={...provenance.sourceFiles,...provenance.configFiles,...provenance.assetFiles,...provenance.scriptFiles,...provenance.modeScriptFiles};
for(const [name,entry] of Object.entries(entries)) {
  const bundled=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',loader:{'.svg':'text'},metafile:true,outfile:join(modulesDir,name),
    define:{__OVF_PROOF_PIN__:JSON.stringify(sourcePin),__OVF_PROOF_SOURCE_DIGEST__:JSON.stringify(digest)},
    plugins:[{name:'pinned-proof-inputs',setup(builder){builder.onLoad({filter:/\.(?:[cm]?js|ts|svg)$/},async args=>{
      const path=args.path.slice(process.cwd().length+1).split('\\').join('/'),expected=pinnedFiles[path];
      if(!path.startsWith('src/')&&!path.startsWith('scripts/'))return;
      assert(expected,`Bundle input must be included in the pinned manifest: ${path}`);
      const bytes=execFileSync('git',['show',`${sourcePin}:${path}`],{maxBuffer:32*1024*1024});
      assert.equal(sha(bytes),expected.sha256);
      return {contents:bytes,loader:path.endsWith('.ts')?'ts':path.endsWith('.svg')?'text':'js'};
    });}}]});
  const inputs={};
  for(const path of Object.keys(bundled.metafile.inputs).sort()) {
    const bytes=await readFile(path),expected=pinnedFiles[path];
    if(path.startsWith('src/')||path.startsWith('scripts/'))assert.equal(sha(bytes),expected?.sha256,`Bundle input changed: ${path}`);
    inputs[path]={bytes:bytes.length,sha256:sha(bytes),...(expected?{gitBlob:expected.gitBlob}:{})};
  }
  bundleInputs[name]=inputs;
  await writeFile(join(modulesDir,`${name}.meta.json`),JSON.stringify(bundled.metafile,null,2)+'\n');
}
const {proofSchema:schema}=await import(pathToFileURL(join(modulesDir,'schema.mjs')).href);
assert.equal(schema.saveVersion,4,'Final mode proof requires SAVE4');
assert.equal(schema.replayChecksumVersion,schema.saveVersion);
await writeFile(join(modulesDir,'manifest.json'),JSON.stringify({...provenance,sourceDigest:digest,schema,entries,bundleInputs,modules:await inventory(modulesDir)},null,2)+'\n');
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{stdio:'inherit'});
const browserBuild=execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',distDir],{encoding:'utf8'});
await writeFile(join(out,'build.log'),browserBuild);
const serverBuild=execFileSync(process.execPath,['scripts/build-server.mjs',serverDir],{encoding:'utf8'});
await writeFile(join(out,'build-server.log'),serverBuild);
assert.deepEqual(await modeProvenance(sourcePin),provenance,'Source or proof scripts changed during preparation');
const compiledFiles=await inventory(distDir),serverFiles=await inventory(serverDir),moduleFiles=await inventory(modulesDir);
await writeFile(join(out,'build-manifest.json'),JSON.stringify({...provenance,compiledFiles,serverFiles},null,2)+'\n');
await writeFile(join(out,'prepare.json'),JSON.stringify({sourcePin,sourceDigest:digest,schema,provenance,modulesDir,distDir,serverDir,
  compiledFiles,serverFiles,moduleFiles,preparedAt:new Date().toISOString(),browserRun:false,naturalMatchesRun:false},null,2)+'\n');
console.log(JSON.stringify({sourcePin,schema,out,modulesDir,distDir,serverDir,browserRun:false,naturalMatchesRun:false}));
