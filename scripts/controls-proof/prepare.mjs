import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceProvenance,inventory,sha} from './browser-common.mjs';

const sourcePin=process.argv[2],out=resolve(process.argv[3]??'');
assert(process.argv[3],'Pass the fresh proof output root');
assert(!out.includes('/docs/evidence/'),'Prepare proof output outside captured evidence directories');
await mkdir(out,{recursive:true});
assert.deepEqual(await readdir(out),[],'Use an empty fresh output root; partial prior preparations cannot be reused');
const provenance=await sourceProvenance(sourcePin);
const sourceDigest=sha(Object.entries({...provenance.sourceFiles,...provenance.configFiles})
  .sort(([left],[right])=>left<right?-1:left>right?1:0)
  .map(([path,entry])=>`${path}\0${entry.sha256}\n`).join(''));
const modules=join(out,'modules');await mkdir(modules,{recursive:true});
const entries={
  'schema.mjs':'scripts/controls-proof/schema.ts',
  'verify-native.mjs':'scripts/controls-proof/verify-native.ts',
  'level-scenario.mjs':'scripts/minimap-alerts/level-scenario.ts',
};
for(const [name,entry] of Object.entries(entries)) {
  execFileSync('node_modules/.bin/esbuild',[entry,'--bundle','--platform=node','--format=esm','--loader:.svg=text',
    `--define:__OVF_PROOF_PIN__=${JSON.stringify(sourcePin)}`,
    `--define:__OVF_PROOF_SOURCE_DIGEST__=${JSON.stringify(sourceDigest)}`,
    `--metafile=${join(modules,`${name}.meta.json`)}`,`--outfile=${join(modules,name)}`],{stdio:'inherit'});
}
const {proofSchema:schema}=await import(pathToFileURL(join(modules,'schema.mjs')).href);
assert.equal(schema.saveVersion,4,'The combined controls certification requires the final SAVE4 source');
assert.equal(schema.replayChecksumVersion,schema.saveVersion);
assert.equal(schema.sessionVersion,1);assert.equal(schema.replayVersion,1);
await writeFile(join(modules,'manifest.json'),JSON.stringify({sourcePin,sourceDigest,schema,
  sourceFiles:provenance.sourceFiles,assetFiles:provenance.assetFiles,configFiles:provenance.configFiles,
  entries,modules:await inventory(modules)},null,2)+'\n');
await writeFile(join(out,'schema.json'),JSON.stringify(schema,null,2)+'\n');
const minimap=join(out,'minimap');await mkdir(minimap,{recursive:true});
execFileSync(process.execPath,[join(modules,'level-scenario.mjs'),minimap],{stdio:'inherit'});
execFileSync('node_modules/.bin/tsc',['--noEmit'],{stdio:'inherit'});
const build=execFileSync('node_modules/.bin/vite',['build','--outDir',join(out,'dist')],{encoding:'utf8'});
await writeFile(join(out,'build.log'),build);
const finalProvenance=await sourceProvenance(sourcePin);
assert.deepEqual(finalProvenance,provenance,'Source/configuration/scripts changed during preparation');
const compiledFiles=await inventory(join(out,'dist'));
await writeFile(join(out,'build-manifest.json'),JSON.stringify({...provenance,compiledFiles},null,2)+'\n');
await writeFile(join(out,'prepare.json'),JSON.stringify({sourcePin,sourceDigest,schema,outputRoot:out,
  distDir:join(out,'dist'),modulesDir:modules,sourceFiles:provenance.sourceFiles,
  assetFiles:provenance.assetFiles,configFiles:provenance.configFiles,scriptFiles:provenance.scriptFiles,
  moduleManifestSha256:sha(await readFile(join(modules,'manifest.json'))),
  buildManifestSha256:sha(await readFile(join(out,'build-manifest.json'))),
  preparedAt:new Date().toISOString(),browserRun:false},null,2)+'\n');
console.log(JSON.stringify({sourcePin,schema,out,modules,distDir:join(out,'dist'),browserRun:false}));
