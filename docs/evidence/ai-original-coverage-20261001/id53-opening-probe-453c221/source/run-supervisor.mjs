import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Linux supervisor: no product import, bundle or simulation in this module.
const [repositoryArg,buildArg,outputArg]=process.argv.slice(2);
assert(repositoryArg && buildArg && outputArg,'Usage: node run-supervisor.mjs <frozen-checkout> <build-directory> <fresh-output-directory>');
assert.equal(process.platform,'linux','Group-drain inspection requires the current Linux host');
const repository=resolve(repositoryArg),build=resolve(buildArg),output=resolve(outputArg);
const helperDirectory=dirname(fileURLToPath(import.meta.url));
const pin='453c2218af9973b9eca8fb78392435bd9d46a740';
assert(!existsSync(output),'Output directory must be fresh');assert(existsSync(dirname(output)),'Output parent must exist');
const startedMilliseconds=Date.now(),start=performance.now(),deadline=start+180000;
const groups=new Set(),processes=[],signals=[];
let deadlineReached=false,failure=null,resolveGlobalDeadline;
const globalDeadlineEvent=new Promise(resolvePromise=>{resolveGlobalDeadline=resolvePromise;});
const elapsed=()=>Math.round((performance.now()-start)*1000)/1000000;
function signalGroup(group,signal,reason) {
  try {process.kill(-group,signal);signals.push({group,signal,reason,elapsedSeconds:elapsed(),sent:true});}
  catch(error){if(error.code!=='ESRCH')throw error;signals.push({group,signal,reason,elapsedSeconds:elapsed(),sent:false,detail:'group absent'});}
}
function runnableMembers(group) {
  return readdirSync('/proc').filter(name=>/^\d+$/.test(name)).flatMap(name=>{
    try {
      const stat=readFileSync('/proc/'+name+'/stat','utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
      return Number(fields[2])===group && !['Z','X'].includes(fields[0])?[{pid:Number(name),state:fields[0]}]:[];
    } catch(error){if(['ENOENT','ESRCH'].includes(error.code))return [];throw error;}
  });
}
const sleep=ms=>new Promise(resolvePromise=>setTimeout(resolvePromise,ms));
async function drain(group) {
  signalGroup(group,'SIGKILL','cleanup-after-leader-exit');
  // A killed descendant may briefly remain as a zombie. It cannot execute; keep
  // the real /proc states and require no runnable group member before proceeding.
  let members=runnableMembers(group);
  while(members.length) {
    signalGroup(group,'SIGKILL','drain-owned-descendants');
    if(performance.now()>=deadline){deadlineReached=true;break;}
    await sleep(10);members=runnableMembers(group);
  }
  if(!members.length)groups.delete(group);
  return {runnableMembers:members,checkedBy:'Linux /proc stat group/state after group KILL',elapsedSeconds:elapsed()};
}
const globalTimer=setTimeout(()=>{
  deadlineReached=true;for(const group of groups)signalGroup(group,'SIGKILL','global-180-second-deadline');
  resolveGlobalDeadline({code:null,signal:'SIGKILL',globalDeadline:true,leaderExitObserved:false});
},180000);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  for(const group of groups)signalGroup(group,'SIGKILL','supervisor-interrupted');process.exit(signal==='SIGINT'?130:143);
});

async function native(label,args,termSeconds,killSeconds) {
  if(deadlineReached || performance.now()>=deadline){deadlineReached=true;return 124;}
  const child=spawn(process.execPath,args,{cwd:repository,detached:true,stdio:'inherit'});
  if(!child.pid){child.once('error',()=>{});throw new Error('Native child did not obtain a process group');}
  const group=child.pid;groups.add(group);
  const record={label,executable:process.execPath,args,cwd:repository,group,startedElapsedSeconds:elapsed(),termSeconds,killSeconds};processes.push(record);
  const termTimer=setTimeout(()=>signalGroup(group,'SIGTERM',label+'-stage-TERM'),termSeconds*1000);
  const killTimer=setTimeout(()=>signalGroup(group,'SIGKILL',label+'-stage-KILL'),killSeconds*1000);
  try {
    const leaderExit=new Promise((resolvePromise,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolvePromise({code,signal,globalDeadline:false,leaderExitObserved:true}));});
    const ended=await Promise.race([leaderExit,globalDeadlineEvent]);
    record.exit=ended;record.waitEndedElapsedSeconds=elapsed();record.leaderEndedElapsedSeconds=ended.leaderExitObserved?elapsed():null;
    record.drain=await drain(group);record.finishedElapsedSeconds=elapsed();
    if(record.drain.runnableMembers.length)throw new Error('Owned descendants remain after global KILL; no next stage is authorized');
    return ended.code===0?0:ended.code??(ended.signal==='SIGKILL'?137:143);
  } finally {clearTimeout(termTimer);clearTimeout(killTimer);}
}

let runtimeExit=0;
try {
  runtimeExit=await native('two-arm-driver',[join(build,'driver.mjs'),output,pin,join(build,'build-manifest.json')],115,120);
  if(runtimeExit===0)for(const arm of ['infantry-control','depot-first-pressure']) {
    const args=[join(build,'validator.mjs'),join(output,arm,'endpoint-session.json'),join(output,arm,'endpoint-verification.json'),pin,join(build,'build-manifest.json')];
    const checkpoint=join(output,arm,'checkpoint-at-first-worker-attack-command-session.json');if(existsSync(checkpoint))args.push(checkpoint);
    const code=await native(arm+'-native-validator',args,25,30);if(code!==0)runtimeExit=code;
  }
  if(deadlineReached)runtimeExit=124;
} catch(error){runtimeExit=1;failure={name:error.name,message:error.message};}
finally {
  for(const group of [...groups])await drain(group);
  clearTimeout(globalTimer);
}
if(!existsSync(output))mkdirSync(output);
writeFileSync(join(output,'supervisor-receipt.json'),JSON.stringify({status:runtimeExit===0?'guarded-native-processes-complete':'unmet',sourcePin:pin,startedAt:new Date(startedMilliseconds).toISOString(),finishedAt:new Date().toISOString(),nativeWallSeconds:elapsed(),runtimeExit,deadlineReached,groupHardDeadlineSeconds:180,processes,signals,remainingOwnedRunnableGroups:groups.size,failure},null,2)+'\n',{flag:'wx'});
if(groups.size){process.stderr.write('Owned descendants still await KILL; artifact finalizer was not started.\n');process.exit(1);}
// Every native leader and runnable descendant has stopped before artifact-only
// finalization. No product import or command runs after this point.
const finalizer=spawn(process.execPath,[join(helperDirectory,'finalize.mjs'),output,String(runtimeExit),String(startedMilliseconds),pin,join(build,'build-manifest.json')],{stdio:'inherit'});
const finalExit=await new Promise((resolvePromise,reject)=>{finalizer.once('error',reject);finalizer.once('close',code=>resolvePromise(code??1));});
process.exitCode=finalExit;
