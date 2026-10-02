import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {inventory,sha} from '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/scripts/controls-proof/browser-common.mjs';
const [directory,phase]=process.argv.slice(2),out=resolve(directory);assert(['before','after'].includes(phase));
const sourcePin='83941bc80ce9ec08840b0645d9b33e8018d5309a';assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourcePin);
const modulePath='/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const require=createRequire(modulePath),packagePath=require.resolve('playwright/package.json'),corePackagePath=require.resolve('playwright-core/package.json');
const launcher='/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/recipe';
const paths={adapter:join(launcher,'playwright-chromium-1243.mjs'),driver:join(launcher,'followup-83941bc-r1-chromium1243.sh'),chromium:'/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',playwrightEntry:modulePath};
const files={};for(const [name,path] of Object.entries(paths)){const bytes=await readFile(path);files[name]={path,realpath:await realpath(path),bytes:bytes.length,sha256:sha(bytes)};}
assert.equal(files.adapter.sha256,'7fe266503ffb4a65da331e6ae3fa7ffa248f805595dcb5e417a7669fc73bbd6d');assert.equal(files.driver.sha256,'81e0f62d4012a50338819d82466556a5a093cac78a69d884619e51f8b5ea84da');assert.equal(files.chromium.sha256,'8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e');
const packages={};for(const [name,path] of Object.entries({playwright:dirname(packagePath),playwrightCore:dirname(corePackagePath),ws:await realpath('node_modules/ws')})){const data=JSON.parse(await readFile(join(path,'package.json')));packages[name]={path,version:data.version,files:await inventory(path)};}
const helper=fileURLToPath(import.meta.url),helperBytes=await readFile(helper);
const record={sourcePin,files,packages,chromiumCliVersion:execFileSync(paths.chromium,['--version'],{encoding:'utf8'}).trim(),helper:{path:helper,bytes:helperBytes.length,sha256:sha(helperBytes)},limits:'Authenticates named actual launcher/browser files and all files in the selected installed Playwright, playwright-core and ws packages before/after. CLI --version identifies the pinned executable; actual phase process captures establish launch. Does not authenticate every shared library or the complete host environment. Frozen verifiers do not expose browser.version() to this external observer.'};
await mkdir(out,{recursive:true});await writeFile(join(out,phase+'.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
if(phase==='before')await writeFile(join(out,'browser-provenance.mjs'),helperBytes,{flag:'wx'});else assert.deepEqual(record,JSON.parse(await readFile(join(out,'before.json'))));
console.log(JSON.stringify({phase,files:Object.keys(files).length,packages:Object.fromEntries(Object.entries(packages).map(([name,p])=>[name,{version:p.version,files:Object.keys(p.files).length}])),chromiumCliVersion:record.chromiumCliVersion,manifestSha256:sha(await readFile(join(out,phase+'.json')))}));
