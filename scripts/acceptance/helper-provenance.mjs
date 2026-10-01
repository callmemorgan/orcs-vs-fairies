import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { digest, fingerprints, regularFiles, safePath } from './native-contract.mjs';

export const helperBuildOptions = (root,entry,path) => ({absWorkingDir:root,entryPoints:[entry],outfile:path,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true,write:false});
export async function committedHelperInventory(root,pin) {
  const git=(args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
  assert.equal(git(['rev-parse','HEAD']).toString().trim(),pin);
  const paths=[...(await regularFiles(resolve(root,'src'))).map(path=>`src/${path}`),...(await regularFiles(resolve(root,'scripts/acceptance'))).map(path=>`scripts/acceptance/${path}`)].sort();
  const tracked=git(['ls-tree','-r','--name-only','-z',pin,'--','src','scripts/acceptance']).toString().split('\0').filter(Boolean).sort();
  assert.deepEqual(paths,tracked,'Full helper source/proof inventory matches pinned Git tree');
  const files=await fingerprints(root,[...paths,'tsconfig.json','package.json','package-lock.json'].sort());
  for(const file of files)assert.deepEqual(await readFile(safePath(root,file.path)),git(['show',`${pin}:${file.path}`]),`${file.path} matches raw pinned helper source/config bytes`);
  return files;
}

export async function loadPinnedHelper(root, pin, bundlePath, expectedEntry) {
  assert.equal(fileURLToPath(import.meta.url),resolve(root,'scripts/acceptance/helper-provenance.mjs'),'Load helper verifier from pinned checkout');
  const path = resolve(bundlePath), provenance = JSON.parse(await readFile(`${path}.provenance.json`, 'utf8'));
  assert.equal(provenance.schema, 1); assert.equal(provenance.sourceCommit, pin);
  assert.equal(provenance.entry, expectedEntry); assert.equal(provenance.bundle.path, path);
  const bytes = await readFile(path); assert.equal(bytes.length, provenance.bundle.bytes);
  assert.equal(digest(bytes), provenance.bundle.sha256, 'Executing helper bundle matches retained build receipt');
  const inventory=await committedHelperInventory(root,pin);
  assert.deepEqual(provenance.inventory,inventory,'Receipt retains complete pinned source/proof/config inventory');
  assert.equal(provenance.builder.path,'scripts/acceptance/build-native-helpers.mjs');
  assert.equal(provenance.builder.sha256,digest(await readFile(resolve(root,provenance.builder.path))));
  const esbuild=await import(process.env.OVF_ESBUILD_MODULE??'esbuild');assert.equal(provenance.esbuildVersion,esbuild.version);
  const rebuilt=await esbuild.build(helperBuildOptions(root,expectedEntry,path));assert.equal(rebuilt.outputFiles.length,1);
  assert.deepEqual(Buffer.from(rebuilt.outputFiles[0].contents),bytes,'Executing helper equals deterministic fresh build from pinned source/config');
  assert.deepEqual(JSON.parse(await readFile(`${path}.metafile.json`,'utf8')),rebuilt.metafile,'Retained helper input graph equals fresh compiler graph');
  const inputs=Object.keys(rebuilt.metafile.inputs).map(input=>relative(root,resolve(root,input)).split(sep).join('/')).sort();
  assert(inputs.includes(expectedEntry));assert(inputs.every(input=>inventory.some(file=>file.path===input)));
  assert.deepEqual(provenance.inputs,inventory.filter(file=>inputs.includes(file.path)),'Every actual compiler dependency is retained and pinned');
  assert.deepEqual(await committedHelperInventory(root,pin),inventory,'Source/config remain unchanged while rebuilding helper');
  return { module: await import(pathToFileURL(path).href), provenance };
}
