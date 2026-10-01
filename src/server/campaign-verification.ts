import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FactionId } from '../core/types';

export interface VerifiedCampaignVictory {campaignId:string;missionId:string;factionId:FactionId}
export type CampaignVictoryVerifier=(recording:unknown,missionId:string)=>Promise<VerifiedCampaignVictory>|VerifiedCampaignVictory;
export class CampaignVerificationError extends Error {constructor(readonly status:number,message:string){super(message);}}

/** The host supplies a compiled canonical module, never a URL or code from an HTTP request. */
export function createCampaignVerificationWorker(modulePath:string,timeoutMs=45000):CampaignVictoryVerifier{
  if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new Error('Campaign verification timeout must be 1–60000ms.');
  const moduleUrl=modulePath.startsWith('file:')?new URL(modulePath).href:pathToFileURL(resolve(modulePath)).href;
  let busy=false;
  return (recording,missionId)=>{
    if(busy)throw new CampaignVerificationError(503,'Campaign verification is busy. Retry this same completed campaign shortly.');
    busy=true;
    return new Promise<VerifiedCampaignVictory>((resolveVictory,reject)=>{
      let done=false;
      let worker:Worker;
      try{worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');
        const fail=(status,error)=>{parentPort.postMessage({ok:false,status,error:error instanceof Error?error.message:'Invalid campaign recording.'});parentPort.close();};
        import(workerData.moduleUrl).then(module=>{
          if(typeof module.verifyCanonicalCampaignVictory!=='function'){fail(503,new Error('Canonical campaign module has no verifier.'));return;}
          Promise.resolve().then(()=>module.verifyCanonicalCampaignVictory(workerData.recording,workerData.missionId))
            .then(value=>{parentPort.postMessage({ok:true,value});parentPort.close();},error=>fail(400,error));
        },error=>fail(503,error));`,{eval:true,workerData:{moduleUrl,recording,missionId},resourceLimits:{maxOldGenerationSizeMb:256}});}catch(error){busy=false;reject(new CampaignVerificationError(503,error instanceof Error?error.message:'Campaign verifier could not start.'));return;}
      const finish=(error:Error|undefined,value?:VerifiedCampaignVictory)=>{
        if(done)return;done=true;clearTimeout(timer);
        void worker.terminate().then(()=>{busy=false;if(error)reject(error);else resolveVictory(value!);},terminationError=>{busy=false;reject(terminationError);});
      };
      const timer=setTimeout(()=>finish(new CampaignVerificationError(504,'Campaign verification timed out. No reward was applied.')),timeoutMs);
      worker.once('message',message=>finish(message.ok?undefined:new CampaignVerificationError(message.status===503?503:400,String(message.error)),message.value));
      worker.once('error',error=>finish(new CampaignVerificationError(503,`Campaign verifier failed: ${error.message}`)));
      worker.once('exit',code=>{if(!done)finish(new CampaignVerificationError(503,`Campaign verifier stopped (${code}). No reward was applied.`));});
    });
  };
}
