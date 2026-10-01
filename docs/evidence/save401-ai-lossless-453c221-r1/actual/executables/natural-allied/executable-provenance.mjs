import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventory,sha} from '../../scripts/controls-proof/browser-common.mjs';

const [sourcePin,directory,phase]=process.argv.slice(2),out=resolve(directory??'');
assert.match(sourcePin??'',/^[0-9a-f]{40}$/);assert(['before','after'].includes(phase));assert(directory);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourcePin);
await mkdir(out,{recursive:true});
async function executable(name){
 for(const root of process.env.PATH.split(':')){
  const path=join(root,name);
  if(await access(path,constants.X_OK).then(()=>true).catch(()=>false))return path;
 }
 assert.fail(`Executable is absent from PATH: ${name}`);
}
const paths={node:process.execPath,nodeFromPath:await executable('node'),npm:await executable('npm'),npx:await executable('npx'),python3:await executable('python3'),git:await executable('git'),shell:'/bin/sh',
 vitest:'node_modules/.bin/vitest',vite:'node_modules/.bin/vite',esbuild:'node_modules/.bin/esbuild',typescript:'node_modules/.bin/tsc'};
const executables={};
for(const [name,path] of Object.entries(paths)){
 const target=await realpath(path),bytes=await readFile(target);
 executables[name]={path:resolve(path),realpath:target,bytes:bytes.length,sha256:sha(bytes)};
}
const packageNames=['vitest','vite','typescript','esbuild','@esbuild/linux-x64','rollup','@rollup/rollup-linux-x64-gnu',
 '@vitest/runner','@vitest/mocker','@vitest/expect','@vitest/snapshot','@vitest/utils','@vitest/spy','@vitest/pretty-format'];
const packages={};
for(const name of packageNames){
 const path=await realpath(`node_modules/${name}`),metadata=JSON.parse(await readFile(join(path,'package.json')));
 packages[name]={path,version:metadata.version,files:await inventory(path)};
}
const npmRoot=resolve(dirname(executables.npm.realpath),'..');
packages.npm={path:npmRoot,version:JSON.parse(await readFile(join(npmRoot,'package.json'))).version,files:await inventory(npmRoot)};
const ownPath=fileURLToPath(import.meta.url),ownBytes=await readFile(ownPath);
const record={sourcePin,executables,packages,helper:{path:ownPath,sha256:sha(ownBytes),bytes:ownBytes.length},versions:{node:process.version,python:execFileSync(paths.python3,['--version'],{encoding:'utf8'}).trim()},limits:'Pins the named actual executable bytes and installed runner/compiler package files. Does not pin every transitive dependency, shared library, Python standard-library file, cache or complete host environment.'};
await writeFile(join(out,`${phase}.json`),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
if(phase==='before')await writeFile(join(out,'executable-provenance.mjs'),ownBytes,{flag:'wx'});
else assert.deepEqual(record,JSON.parse(await readFile(join(out,'before.json'))),'Actual executables or pinned runner/compiler bytes changed during the proof');
console.log(JSON.stringify({sourcePin,phase,executables:Object.keys(executables).length,packages:Object.keys(packages).length,manifestSha256:sha(await readFile(join(out,`${phase}.json`)))}));
