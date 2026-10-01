import assert from 'node:assert/strict';
import {readFile,readlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {sourceProvenance,inventory,sha} from '../controls-proof/browser-common.mjs';

export {inventory,sha};
export const sourceDigest=provenance=>sha(Object.entries({...provenance.sourceFiles,...provenance.configFiles})
  .sort(([left],[right])=>left<right?-1:left>right?1:0)
  .map(([path,entry])=>`${path}\0${entry.sha256}\n`).join(''));

export async function modeProvenance(sourcePin) {
  const provenance=await sourceProvenance(sourcePin);
  const paths=['scripts/modes','scripts/verify_assembled_modes.mjs','scripts/build-server.mjs','scripts/tournaments/smoke.json'];
  const tracked=execFileSync('git',['ls-tree','-r','--name-only',sourcePin,'--',...paths],{encoding:'utf8'}).trim().split('\n').filter(Boolean).sort();
  for(const path of paths.filter(path=>path!=='scripts/modes'))assert(tracked.includes(path),`Required proof input must be committed: ${path}`);
  assert.deepEqual(Object.keys(await inventory('scripts/modes')).map(path=>`scripts/modes/${path}`).sort(),
    tracked.filter(path=>path.startsWith('scripts/modes/')),'Mode proof script paths must match the pin');
  const modeScriptFiles={};
  for(const path of tracked) {
    const bytes=await readFile(path),pinned=execFileSync('git',['show',`${sourcePin}:${path}`]);
    assert(bytes.equals(pinned),`Mode proof script differs from the pin: ${path}`);
    modeScriptFiles[path]={bytes:bytes.length,sha256:sha(bytes),gitBlob:execFileSync('git',['rev-parse',`${sourcePin}:${path}`],{encoding:'utf8'}).trim()};
  }
  return {...provenance,modeScriptFiles};
}

export async function preparedInputs(sourcePin,root) {
  const prepared=JSON.parse(await readFile(`${root}/prepare.json`,'utf8'));
  assert.equal(prepared.sourcePin,sourcePin,'Prepared proof must match the frozen source');
  const provenance=await modeProvenance(sourcePin);
  assert.deepEqual(prepared.provenance,provenance,'Prepared source or proof scripts differ from the checkout');
  assert.equal(prepared.sourceDigest,sourceDigest(provenance));
  assert.equal(await readlink(prepared.serverDependencies.link),prepared.serverDependencies.target,'Isolated server dependency link changed');
  assert.equal(sha(await readFile(`${prepared.serverDependencies.target}/ws/package.json`)),prepared.serverDependencies.wsPackageSha256,'Installed server dependency metadata changed');
  for(const [directory,expected] of [[prepared.distDir,prepared.compiledFiles],[prepared.serverDir,prepared.serverFiles],[prepared.modulesDir,prepared.moduleFiles]]) {
    assert.deepEqual(await inventory(directory),expected,`Prepared bytes changed: ${directory}`);
  }
  return {prepared,provenance};
}

export async function servedChunks(context) {
  const chunks={};
  for(const path of Object.keys(context.compiledFiles).filter(path=>/\.(?:js|css)$/.test(path)).sort()) {
    const response=await fetch(new URL(path,context.base),{cache:'no-store'});
    assert.equal(response.status,200,`Serve every compiled JavaScript/CSS chunk: ${path}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(sha(bytes),context.compiledFiles[path].sha256,`Served chunk differs from the frozen build: ${path}`);
    chunks[path]={bytes:bytes.length,sha256:sha(bytes)};
  }
  assert(Object.keys(chunks).some(path=>path.endsWith('.js')));
  return chunks;
}
