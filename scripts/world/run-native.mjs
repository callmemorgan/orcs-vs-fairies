import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,lstat,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';

const [sourcePin,directory,preparationSha256,name,...args]=process.argv.slice(2);
assert.match(sourcePin??'',/^[0-9a-f]{40}$/,'Pass FULL_PIN MODULES_DIR RETAINED_PREPARATION_SHA256 MODULE_NAME [module arguments]');
assert(directory&&name,'Pass the prepared modules directory and module name');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourcePin,'Launcher checkout must match the requested pin');
assert.equal(fileURLToPath(import.meta.url),resolve('scripts/world/run-native.mjs'),'Use the launcher in the current pinned checkout');
// Authenticate unbundled code before importing its helpers. Old bundled checks are not trusted.
for(const path of ['scripts/world/run-native.mjs','scripts/world/proof-common.mjs','scripts/controls-proof/browser-common.mjs']) {
 const parts=path.split('/');for(let i=1;i<=parts.length;i++) {const info=await lstat(parts.slice(0,i).join('/'));assert(!info.isSymbolicLink()&&(i===parts.length?info.isFile():info.isDirectory()),`Launcher input must be regular: ${path}`);}
 const pinned=execFileSync('git',['show',`${sourcePin}:${path}`],{maxBuffer:128*1024*1024});
 assert((await readFile(path)).equals(pinned),`Launcher bytes differ from the pin: ${path}`);
}
const {worldSourceProof,verifyWorldPreparation,compileWorldModule,sha}=await import(pathToFileURL(resolve('scripts/world/proof-common.mjs')).href);
const provenance=await worldSourceProof(sourcePin),prepared=verifyWorldPreparation(provenance,directory,preparationSha256),module=prepared.manifest.modules[name];
assert(module,`Unknown prepared module: ${name}`);
assert.equal(execFileSync('node_modules/.bin/esbuild',['--version'],{encoding:'utf8'}).trim(),prepared.manifest.compiler.version,'Compiler version changed after preparation');
const rebuild=await mkdtemp(join(tmpdir(),'ovf-world-rebuild-'));let status;
try {
 const rebuilt=await compileWorldModule(provenance,name,rebuild);
 assert.equal(rebuilt.sha256,module.sha256,'Prepared bundle differs from a fresh build of the pinned inputs');
 assert.deepEqual(rebuilt.inputs,module.inputs,'Fresh compiler input inventory differs');
 assert.deepEqual(await worldSourceProof(sourcePin),provenance,'Source changed during fresh bundle verification');
 verifyWorldPreparation(provenance,directory,preparationSha256);
 const result=spawnSync(process.execPath,[join(prepared.out,module.path),...args],{stdio:'inherit',env:{...process.env,OVF_PRODUCTION_SOURCE_COMMIT:sourcePin,OVF_WORLD_MODULES:prepared.out,OVF_WORLD_PREPARATION_SHA256:preparationSha256,OVF_WORLD_REBUILT_SHA256:rebuilt.sha256}});
 assert(!result.error,result.error?.message);assert.equal(result.signal,null,'Native module was interrupted');status=result.status;
 assert.deepEqual(await worldSourceProof(sourcePin),provenance,'Source changed during native execution');
 verifyWorldPreparation(provenance,directory,preparationSha256);
 assert.equal(sha(await readFile(join(prepared.out,module.path))),rebuilt.sha256,'Executed bundle changed after fresh compilation');
} finally {await rm(rebuild,{recursive:true,force:true});}
assert.equal(status,0,`Native ${name} proof failed`);
