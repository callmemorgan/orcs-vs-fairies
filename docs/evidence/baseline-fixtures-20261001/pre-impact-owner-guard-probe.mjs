import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const repo=process.argv[2]??execFileSync('git',['rev-parse','--show-toplevel'],{cwd:fileURLToPath(new URL('.',import.meta.url)),encoding:'utf8'}).trim();
const {build}=await import(pathToFileURL(`${repo}/node_modules/esbuild/lib/main.js`).href);
const original=await readFile(`${repo}/tests/joint-pre-impact-surrender-ignition.test.ts`,'utf8');
const source=original.replace('const remaining=shot.impactAt-state.time,events=',"console.log('pending-after-real-transfer',JSON.stringify({level,time:state.time,sourceSide:gun.side,launchSide:shot.side,impactAt:shot.impactAt,fires:state.world.fires.length}));const remaining=shot.impactAt-state.time,events=");
for(const guard of [false,true]){
  globalThis.__probeFailures=[];globalThis.__probeResults=[];
  const virtual=`import assert from 'node:assert/strict';export const describe=(_name,fn)=>fn();export const it={each:values=>(name,fn)=>{for(const value of values){try{fn(value);globalThis.__probeResults.push({level:value,passed:true});}catch(error){globalThis.__probeFailures.push({level:value,error:error.message});}}}};
  function subset(value,want){assert.notEqual(value,undefined);for(const [k,v] of Object.entries(want)){if(v&&typeof v==='object')subset(value[k],v);else assert.equal(value[k],v);}}
  export function expect(value){return {toBe(want){assert.equal(value,want);},toEqual(want){assert.deepEqual(value,want);},toHaveLength(want){assert.equal(value.length,want);},toBeGreaterThan(want){assert.ok(value>want);},toBeLessThan(want){assert.ok(value<want);},toMatchObject(want){subset(value,want);}};}`;
  const bundled=await build({stdin:{contents:source,resolveDir:`${repo}/tests`,sourcefile:'joint-pre-impact-surrender-ignition.test.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[{name:'virtual',setup(b){b.onResolve({filter:/^vitest$/},()=>({path:'vitest',namespace:'virtual'}));b.onLoad({filter:/.*/,namespace:'virtual'},()=>({contents:virtual,loader:'js'}));if(guard)b.onLoad({filter:/\/src\/core\/environment\.ts$/},async args=>{const text=await readFile(args.path,'utf8'),old='source.id>=s.nextId))return false;',change='source.id>=s.nextId||s.entities.some(e=>e.id===source.id&&e.side!==source.side)))return false;';assert.ok(text.includes(old));return{contents:text.replace(old,change),loader:'ts'};});}}]});
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}#guard=${guard}`);
  console.log(JSON.stringify({restoredObsoleteCurrentOwnerGuard:guard,passes:globalThis.__probeResults,failures:globalThis.__probeFailures},null,2));
  assert.equal(globalThis.__probeFailures.length,guard?2:0);assert.equal(globalThis.__probeResults.length,guard?0:2);
}
