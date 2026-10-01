import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {worldSourceProof,freshWorldOutput,compileWorldModule,WORLD_MODULE_ENTRIES,WORLD_COMPILER_OPTIONS,sha} from './proof-common.mjs';

const sourcePin=process.argv[2],out=resolve(process.argv[3]??'');
assert.match(sourcePin??'',/^[0-9a-f]{40}$/,'Pass the full committed source pin');
assert(process.argv[3],'Pass the full source pin and a fresh modules directory');
const provenance=await worldSourceProof(sourcePin);await freshWorldOutput(out);
const compiler={version:execFileSync('node_modules/.bin/esbuild',['--version'],{encoding:'utf8'}).trim(),options:WORLD_COMPILER_OPTIONS},modules={};
for(const name of Object.keys(WORLD_MODULE_ENTRIES))modules[name]=await compileWorldModule(provenance,name,out);
assert.deepEqual(await worldSourceProof(sourcePin),provenance,'Authenticated source changed during preparation');
const manifest={format:1,provenance,entries:WORLD_MODULE_ENTRIES,compiler,modules},manifestBytes=JSON.stringify(manifest,null,2)+'\n';
await writeFile(join(out,'manifest.json'),manifestBytes,{flag:'wx'});
const receipt={format:1,sourcePin,sourceDigest:provenance.sourceDigest,manifestSha256:sha(manifestBytes),preparedAt:new Date().toISOString(),browserRun:false},receiptBytes=JSON.stringify(receipt,null,2)+'\n';
await writeFile(join(out,'prepare.json'),receiptBytes,{flag:'wx'});
console.log(JSON.stringify({sourcePin,sourceDigest:provenance.sourceDigest,modulesDir:out,preparationSha256:sha(receiptBytes),browserRun:false}));
