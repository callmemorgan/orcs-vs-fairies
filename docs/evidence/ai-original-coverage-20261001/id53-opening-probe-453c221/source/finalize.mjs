import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [directoryArg,exitArg,startedArg,pin,manifestPath]=process.argv.slice(2);
assert(directoryArg && exitArg!==undefined && startedArg && pin && manifestPath);
const directory=resolve(directoryArg),runtimeExit=Number(exitArg),startedMilliseconds=Number(startedArg);
assert(Number.isSafeInteger(runtimeExit) && Number.isSafeInteger(startedMilliseconds));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!existsSync(directory))mkdirSync(directory);
const errors=[];
const read=relative=>{
  const path=join(directory,relative);if(!existsSync(path))return null;
  try{return JSON.parse(readFileSync(path,'utf8'));}
  catch(error){errors.push('Absent/unreadable/malformed receipt '+relative+': '+error.message);return null;}
};
const array=value=>Array.isArray(value)?value:[];
const comparison=read('comparison.json'),driver=read('driver-receipt.json');
const supervisor=read('supervisor-receipt.json');
const check=(name,condition)=>{if(!condition)errors.push(name);};
check('guarded processes exited successfully',runtimeExit===0);
check('native process groups drained before finalization',supervisor?.remainingOwnedRunnableGroups===0);
check('comparison and driver use product pin',comparison?.sourcePin===pin && driver?.sourcePin===pin);
check('measured feature53 comparison passed',comparison?.measured?.passesMeasuredGate===true);
check('driver recorded exactly two arms',JSON.stringify(driver?.arms)===JSON.stringify(['infantry-control','depot-first-pressure']));
for(const file of array(driver?.files)) {
  const path=join(directory,file.path);
  check('driver-retained raw bytes unchanged: '+file.path,existsSync(path) && lstatSync(path).isFile() && readFileSync(path).length===file.bytes && sha256(readFileSync(path))===file.sha256);
}
const arms=[];
for(const name of ['infantry-control','depot-first-pressure']) {
  const arm=read(name+'/run-receipt.json'),native=read(name+'/endpoint-verification.json');
  check(name+' receipt present at product pin',arm?.sourcePin===pin);
  check(name+' natural bounded stop',Number.isInteger(arm?.stop?.tick) && arm.stop.tick<=3600 && arm.stop.simulatedSeconds<=180+1e-6);
  check(name+' three ordinary paid trains',arm?.acceptedTrains===3 && arm?.ownTrainReceipts?.length===3);
  check(name+' complete proof evidence retained',arm?.evidenceComplete===true);
  check(name+' native validator passed at pin',native?.status==='passed' && native?.sourcePin===pin);
  const expected=[join(directory,name,'endpoint-session.json')];
  if(arm?.checkpoint)expected.push(join(directory,name,'checkpoint-at-first-worker-attack-command-session.json'));
  check(name+' every emitted session verified',JSON.stringify(array(native?.verified).map(v=>v.path))===JSON.stringify(expected));
  for(const verified of array(native?.verified)) {
    check(name+' verified raw input unchanged: '+verified.path,existsSync(verified.path) && readFileSync(verified.path).length===verified.bytes && sha256(readFileSync(verified.path))===verified.sha256);
    check(name+' complete native equality retained',verified.completeDecoderSessionEqual && verified.completeResaveEnvelopeEqual && verified.completeReplayEnvelopeEqual && verified.analysisEqual && verified.technologyTimingsEqual);
  }
  arms.push({name,stop:arm?.stop??null,nativeStatus:native?.status??'absent',verifiedSessions:native?.verified?.length??0});
}
const walk=(dir,prefix='')=>readdirSync(dir).sort().flatMap(name=>{
  const path=join(dir,name),relative=prefix+name,stat=lstatSync(path);assert(!stat.isSymbolicLink());
  return stat.isDirectory()?walk(path,relative+'/'):[{path:relative,bytes:stat.size,sha256:sha256(readFileSync(path))}];
});
const manifestBytes=readFileSync(manifestPath);
const files=walk(directory),jsonlBytes=files.filter(file=>file.path.endsWith('.jsonl')).reduce((sum,file)=>sum+file.bytes,0),allRetainedBytesBeforeFinalReceipt=files.reduce((sum,file)=>sum+file.bytes,0);
const result={status:errors.length?'unmet':'passed',sourcePin:pin,originalRequirement:'opponents use recognizable builds with exploitable weaknesses.',startedAt:new Date(startedMilliseconds).toISOString(),finishedAt:new Date().toISOString(),observedWallSeconds:(Date.now()-startedMilliseconds)/1000,guard:{nativeProcessGroupHardKillSeconds:180,driverTermSeconds:115,driverKillBySeconds:120,validatorTermSecondsEach:25,validatorKillBySecondsEach:30,maxArms:2,automaticRetries:0,postGuardWork:'artifact metadata reads/writes only'},runtimeExit,errors,arms,measured:comparison?.measured??null,buildManifest:{path:resolve(manifestPath),bytes:manifestBytes.length,sha256:sha256(manifestBytes)},outputTotals:{jsonlBytes,allRetainedBytesBeforeFinalReceipt},inventoryExcludes:['final-receipt.json'],files};
writeFileSync(join(directory,'final-receipt.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:result.status,receipt:join(directory,'final-receipt.json'),errors})+'\n');
process.exitCode=errors.length?1:0;
