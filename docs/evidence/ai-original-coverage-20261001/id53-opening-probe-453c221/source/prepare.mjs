import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// This entry point builds proof bundles. It has not been run during preparation.
const pin = '453c2218af9973b9eca8fb78392435bd9d46a740';
const [repositoryArg, buildArg] = process.argv.slice(2);
assert(repositoryArg && buildArg, 'Usage: node prepare.mjs <frozen-checkout> <fresh-build-directory>');
const repository = resolve(repositoryArg), buildDirectory = resolve(buildArg);
const helperDirectory = dirname(fileURLToPath(import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git',['-C',repository,...args],{maxBuffer:64*1024*1024});
const configPaths = ['package.json','package-lock.json','vite.config.ts','tsconfig.json','vitest.config.ts','index.html','editor.html'];
const helperPaths = ['driver.ts','finalize.mjs','native-validator.ts','prepare.mjs','provenance.ts','recipe.json','run.sh','run-supervisor.mjs'];
function productIdentity() {
  assert.equal(git('rev-parse','HEAD').toString().trim(),pin);
  const entries = git('ls-tree','-r','-z',pin).toString().split('\0').filter(Boolean).map(entry => {
    const [metadata,path] = entry.split('\t'),[mode,kind,blob] = metadata.split(' '); return {path,mode,kind,blob};
  }).filter(e => e.path.startsWith('src/') || configPaths.includes(e.path));
  const walk = (dir,prefix='src') => {
    assert(!lstatSync(dir).isSymbolicLink());
    return readdirSync(dir).sort().flatMap(name => {const path=join(dir,name),relative=prefix+'/'+name,stat=lstatSync(path);assert(!stat.isSymbolicLink());return stat.isDirectory()?walk(path,relative):[relative];});
  };
  assert.deepEqual(walk(join(repository,'src')).sort(),entries.filter(e=>e.path.startsWith('src/')).map(e=>e.path).sort());
  assert.deepEqual(entries.filter(e=>configPaths.includes(e.path)).map(e=>e.path).sort(),[...configPaths].sort());
  const files=entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(e=>{
    const path=join(repository,e.path),stat=lstatSync(path),bytes=readFileSync(path);assert(stat.isFile()&&!stat.isSymbolicLink()&&e.kind==='blob'&&['100644','100755'].includes(e.mode));
    assert(bytes.equals(git('cat-file','blob',e.blob)),`Different source/config bytes: ${e.path}`);
    return {path:e.path,bytes:bytes.length,sha256:sha256(bytes),gitBlob:e.blob,bytesMatchGit:true};
  });
  return {sourcePin:pin,digest:sha256(files.map(f=>`${f.path}\0${f.sha256}\n`).join('')),files};
}
const product = productIdentity();
const files=helperPaths.sort().map(path=>{const absolute=join(helperDirectory,path),stat=lstatSync(absolute),bytes=readFileSync(absolute);assert(stat.isFile()&&!stat.isSymbolicLink());return {path,bytes:bytes.length,sha256:sha256(bytes)};});
const helper={directory:helperDirectory,identityKind:'external-source-sha256',digest:sha256(files.map(f=>`${f.path}\0${f.sha256}\n`).join('')),files};
assert.equal(JSON.parse(readFileSync(join(helperDirectory,'recipe.json'),'utf8')).productPin,pin);
mkdirSync(buildDirectory); // A fresh directory is required; never overwrite retained bundles.
const esbuild=createRequire(join(repository,'package.json'))('esbuild');
const bundles={};
for (const [kind,entry] of [['driver','driver.ts'],['validator','native-validator.ts']]) {
  const outfile=join(buildDirectory,kind+'.mjs');
  const result=await esbuild.build({entryPoints:[join(helperDirectory,entry)],outfile,bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,
    define:{__OVF_PROOF_PIN__:JSON.stringify(pin),__OVF_PROOF_SOURCE_DIGEST__:JSON.stringify(product.digest),__OVF_HELPER_SOURCE_DIGEST__:JSON.stringify(helper.digest)},
    plugins:[{name:'frozen-native-core',setup(build){build.onResolve({filter:/^@ovf\/core\//},args=>{const name=args.path.slice('@ovf/core/'.length);assert(/^[a-z][a-z0-9-]*$/.test(name));return {path:join(repository,'src/core',name+'.ts')};});}}]});
  const metafilePath=join(buildDirectory,kind+'.metafile.json');
  writeFileSync(metafilePath,JSON.stringify(result.metafile,null,2)+'\n',{flag:'wx'});
  const inputs=Object.keys(result.metafile.inputs).sort().map(input=>{const path=resolve(input),bytes=readFileSync(path);return {path,bytes:bytes.length,sha256:sha256(bytes)};});
  const bytes=readFileSync(outfile),metaBytes=readFileSync(metafilePath);
  bundles[kind]={path:outfile,bytes:bytes.length,sha256:sha256(bytes),metafile:{path:metafilePath,bytes:metaBytes.length,sha256:sha256(metaBytes)},inputs};
}
assert.deepEqual(productIdentity(),product,'Product bytes changed during bundling');
for(const file of helper.files)assert.equal(sha256(readFileSync(join(helperDirectory,file.path))),file.sha256,'Helper changed during bundling');
writeFileSync(join(buildDirectory,'build-manifest.json'),JSON.stringify({status:'built-not-executed',builtAt:new Date().toISOString(),product,helper,bundles},null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:'built-not-executed',manifest:join(buildDirectory,'build-manifest.json'),sourcePin:pin})+'\n');
