import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { assertSessionIdentity,digest,fingerprints,regularFiles,safePath } from './native-contract.mjs';
import { loadPinnedHelper } from './helper-provenance.mjs';

const configPaths=['vite.config.ts','package.json','package-lock.json','tsconfig.json','index.html','editor.html'];
const proofDirectory='scripts/acceptance';
const git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const tree=(root,pin,path)=>git(root,['ls-tree','-r','--name-only','-z',pin,'--',path]).toString().split('\0').filter(Boolean).sort();
async function committedInventory(root,pin,directory){
  const disk=(await regularFiles(resolve(root,directory))).map(name=>`${directory}/${name}`),expected=tree(root,pin,directory);
  assert.deepEqual(disk,expected,`${directory} inventory must equal frozen Git tree`);
  for(const path of disk)assert.deepEqual(await readFile(resolve(root,path)),git(root,['show',`${pin}:${path}`]),`${path} must equal frozen Git bytes`);
  return disk;
}
export async function captureAcceptanceFreeze(root,fixtures,pin){
  assert.match(pin,/^[0-9a-f]{40}$/,'Pass full frozen commit');
  assert.equal(git(root,['rev-parse','HEAD']).toString().trim(),pin,'HEAD must equal requested full source pin');
  const src=await committedInventory(root,pin,'src'),proof=await committedInventory(root,pin,proofDirectory);
  assert(proof.length,'Committed acceptance proof modules required');
  for(const path of configPaths)assert.deepEqual(await readFile(resolve(root,path)),git(root,['show',`${pin}:${path}`]),`${path} committed config bytes`);
  const self=fileURLToPath(import.meta.url);assert.equal(self,resolve(root,proofDirectory,'native-freeze.mjs'),'Execute proof modules from the pinned checkout');assert.deepEqual(await readFile(self),await readFile(resolve(root,proofDirectory,'native-freeze.mjs')),'Executing freeze module must equal pinned proof source');
  const saveText=await readFile(resolve(root,'src/core/saves.ts'),'utf8'),revisionText=await readFile(resolve(root,'src/core/versions.ts'),'utf8');
  const saveVersion=Number(saveText.match(/export const SAVE_VERSION\s*=\s*(\d+)\s*;/)?.[1]);
  const simulationRevision=revisionText.match(/export const SIMULATION_REVISION\s*=\s*['"]([^'"]+)['"]\s*;/)?.[1];
  assert.equal(saveVersion,4,'Native acceptance requires current SAVE4');assert(simulationRevision,'Dynamic frozen simulation revision');
  const identity={saveVersion,simulationRevision},manifest=JSON.parse(await readFile(resolve(fixtures,'manifest.json'),'utf8'));
  assert.equal(manifest.schema,1);assert(Object.keys(manifest.scenarios??{}).length,'Declared authored scenarios required');
  assert.equal(manifest.sourceCommit,pin,'Fixture generation uses the frozen source commit');assert.equal(manifest.saveVersion,saveVersion);assert.equal(manifest.simulationRevision,simulationRevision);
  const generation=JSON.parse(await readFile(resolve(fixtures,'generation-receipt.json'),'utf8'));
  assert.equal(generation.sourceCommit,pin);assert.equal(generation.helper.entry,'scripts/acceptance/native-fixtures.ts');assert.equal(generation.helper.sourceCommit,pin);
  const fixturePaths=(await regularFiles(fixtures)).filter(path=>path!=='generation-receipt.json');
  assert.deepEqual(generation.fixtures,await fingerprints(fixtures,fixturePaths),'Complete generated fixture inventory and bytes remain unchanged');
  const {module:producer,provenance}=await loadPinnedHelper(root,pin,generation.helper.bundle.path,'scripts/acceptance/native-fixtures.ts');
  assert.deepEqual(generation.helper,provenance,'Generation receipt uses the verified producer bundle');
  const reproductionParent=await mkdtemp(resolve(tmpdir(),'ovf-native-fixture-authenticity-'));
  try{const reproduction=resolve(reproductionParent,'fixtures');producer.buildNativeAcceptanceFixtures(reproduction,pin);assert.deepEqual(await fingerprints(reproduction,await regularFiles(reproduction)),generation.fixtures,'Generated fixture bytes equal fresh production from frozen authoring source');}
  finally{await rm(reproductionParent,{recursive:true,force:true});}
  for(const [name,scenario] of Object.entries(manifest.scenarios)){
    const file=JSON.parse(await readFile(safePath(fixtures,scenario.file),'utf8'));assertSessionIdentity(file,name,identity);
    assert.equal(file.game.state.tick,scenario.initialTick,`${name} authored initial tick`);
    assert(scenario.authored&&typeof scenario.authored==='object',`${name} declares setup authoring`);
  }
  const buildHash=createHash('sha256');for(const path of src.filter(path=>/\.(ts|css)$/.test(path))){buildHash.update(path.slice(4));buildHash.update(await readFile(resolve(root,path)));}
  const distPaths=(await regularFiles(resolve(root,'dist'))).filter(path=>/\.(html|js|css)$/.test(path));assert(distPaths.includes('index.html'));
  return {schema:1,source:{commit:pin,...identity,expectedBuildId:buildHash.digest('hex'),files:await fingerprints(root,[...src,...proof,...configPaths].sort())},fixtures:await fingerprints(fixtures,await regularFiles(fixtures)),dist:await fingerprints(resolve(root,'dist'),distPaths)};
}
export async function assertAcceptanceFreeze(root,fixtures,frozen){assert.deepEqual(await captureAcceptanceFreeze(root,fixtures,frozen.source.commit),frozen,'Source, proof modules, fixtures and dist remain frozen');}
