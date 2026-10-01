import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile,realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { digest, fingerprints, regularFiles, safePath } from './native-contract.mjs';

export const helperBuildOptions = (root,entry,path) => ({absWorkingDir:root,entryPoints:[entry],outfile:path,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true,write:false});
export async function configuredCompiler(root) {
  assert(!process.env.ESBUILD_BINARY_PATH,'Use the installed locked esbuild binary without an override');
  const moduleUrl=import.meta.resolve(process.env.OVF_ESBUILD_MODULE??'esbuild');assert(moduleUrl.startsWith('file:'));
  const modulePath=await realpath(fileURLToPath(moduleUrl)),require=createRequire(modulePath);
  const esbuild=await import(moduleUrl),lock=JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8'));
  assert.equal(esbuild.version,lock.packages['node_modules/esbuild'].version,'Configured compiler version matches the pinned package lock');
  const binaryPackage=`@esbuild/${process.platform}-${process.arch}`,binaryPath=await realpath(require.resolve(`${binaryPackage}/${process.platform==='win32'?'esbuild.exe':'bin/esbuild'}`));
  assert.equal(esbuild.version,lock.packages[`node_modules/${binaryPackage}`].version,'Native compiler package matches the pinned lock');
  const fingerprint=async path=>{const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:digest(bytes)};};
  return {esbuild,identity:{version:esbuild.version,module:await fingerprint(modulePath),binary:await fingerprint(binaryPath)}};
}
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
  const {esbuild,identity:compiler}=await configuredCompiler(root);assert.equal(provenance.esbuildVersion,esbuild.version);assert.deepEqual(provenance.compiler,compiler,'Configured compiler JS/native binary identity matches retained receipt');
  const rebuilt=await esbuild.build(helperBuildOptions(root,expectedEntry,path));assert.equal(rebuilt.outputFiles.length,1);
  assert.deepEqual(Buffer.from(rebuilt.outputFiles[0].contents),bytes,'Executing helper equals deterministic fresh build from pinned source/config');
  assert.deepEqual(JSON.parse(await readFile(`${path}.metafile.json`,'utf8')),rebuilt.metafile,'Retained helper input graph equals fresh compiler graph');
  const inputs=Object.keys(rebuilt.metafile.inputs).map(input=>relative(root,resolve(root,input)).split(sep).join('/')).sort();
  assert(inputs.includes(expectedEntry));assert(inputs.every(input=>inventory.some(file=>file.path===input)));
  assert.deepEqual(provenance.inputs,inventory.filter(file=>inputs.includes(file.path)),'Every actual compiler dependency is retained and pinned');
  assert.deepEqual(await committedHelperInventory(root,pin),inventory,'Source/config remain unchanged while rebuilding helper');
  return { module: await import(pathToFileURL(path).href), provenance };
}
