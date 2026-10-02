import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build, version } from 'file:///tmp/ovf-id6-integration-703fc-20261001/node_modules/esbuild/lib/main.js';
const out=resolve(process.argv[2]); await mkdir(out,{recursive:false});
const root='/home/morgana/Projects/orcs-vs-Fairies';
const entries=['main-smoke-fixtures.ts','native-audit.ts','main-smoke402-history-audit.ts'];
const results=[];
for(const entry of entries){
 const outfile=resolve(out,entry.replace(/\.ts$/,'.mjs'));
 const result=await build({absWorkingDir:root,entryPoints:['scripts/acceptance/'+entry],outfile,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true,write:false});
 const bytes=result.outputFiles[0].contents;
 await writeFile(outfile,bytes,{flag:'wx'});await writeFile(outfile+'.metafile.json',JSON.stringify(result.metafile,null,2)+'\n',{flag:'wx'});
 results.push({entry,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),inputCount:Object.keys(result.metafile.inputs).length});
}
await writeFile(resolve(out,'compile-only-results.json'),JSON.stringify({compilerVersion:version,results,applicationModulesExecuted:false,fixturesGenerated:false,browserExecuted:false},null,2)+'\n',{flag:'wx'});
