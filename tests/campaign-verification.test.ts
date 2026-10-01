import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCampaignVerificationWorker } from '../src/server/campaign-verification';
import { CosmeticApi } from '../src/online/cosmetic-client';

const directories:string[]=[];
afterEach(async()=>{while(directories.length)await rm(directories.pop()!,{recursive:true,force:true});});
async function modulePath(contents?:string){const directory=await mkdtemp(join(tmpdir(),'ovf-campaign-verifier-'));directories.push(directory);const path=join(directory,'canonical.mjs');if(contents!==undefined)await writeFile(path,contents);return path;}
const canonicalModule=`export async function verifyCanonicalCampaignVictory(input,missionId){
  if(input.fail)throw new Error('Recording did not win.');
  if(input.exit)process.exit(23);
  if(input.crash){setTimeout(()=>{throw new Error('Uncaught worker failure.');},0);await new Promise(()=>{});}
  if(input.loop)while(true){}
  if(input.delay)await new Promise(resolve=>setTimeout(resolve,input.delay));
  return {campaignId:'campaign-orcs',missionId,factionId:'orcs'};
}`;

describe('bounded trusted campaign replay worker',()=>{
  it('rejects concurrent work and releases the slot after a verified result or rejected recording',async()=>{
    const verify=createCampaignVerificationWorker(await modulePath(canonicalModule),5000),pending=verify({delay:80},'finale');
    expect(()=>verify({},'finale')).toThrow('verification is busy');
    await expect(pending).resolves.toEqual({campaignId:'campaign-orcs',missionId:'finale',factionId:'orcs'});
    await expect(verify({fail:true},'finale')).rejects.toMatchObject({status:400,message:'Recording did not win.'});
    await expect(verify({},'finale')).resolves.toMatchObject({factionId:'orcs'});
  });
  it('terminates a timed-out replay and accepts the next verification',async()=>{
    const verify=createCampaignVerificationWorker(await modulePath(canonicalModule),500);
    await expect(verify({loop:true},'finale')).rejects.toMatchObject({status:504});
    await expect(verify({},'finale')).resolves.toMatchObject({missionId:'finale'});
  });
  it('reports unavailable modules and missing verifier exports as service failures',async()=>{
    const path=await modulePath(),verify=createCampaignVerificationWorker(path,5000);
    await expect(verify({},'finale')).rejects.toMatchObject({status:503});
    await writeFile(path,canonicalModule);
    await expect(verify({},'finale')).resolves.toMatchObject({factionId:'orcs'});
    await expect(createCampaignVerificationWorker(await modulePath('export const unrelated=true;'))({},'finale')).rejects.toMatchObject({status:503});
  });
  it('recovers from uncloneable input and unexpected worker exit',async()=>{
    const verify=createCampaignVerificationWorker(await modulePath(canonicalModule),5000);
    await expect(verify({uncloneable:()=>true},'finale')).rejects.toMatchObject({status:503});
    await expect(verify({exit:true},'finale')).rejects.toMatchObject({status:503,message:expect.stringContaining('(23)')});
    await expect(verify({crash:true},'finale')).rejects.toMatchObject({status:503,message:expect.stringContaining('Uncaught worker failure.')});
    await expect(verify({},'finale')).resolves.toMatchObject({factionId:'orcs'});
    for(const value of [0,60001,Infinity,NaN])expect(()=>createCampaignVerificationWorker('unused',value)).toThrow('timeout');
  });
  it('gives campaign uploads enough time for the bounded verifier without extending ordinary profile requests',async()=>{
    const signals:AbortSignal[]=[];
    const api=new CosmeticApi({baseUrl:'http://fixture',timeoutMs:1,fetch:async(_url,options)=>{
      const signal=options!.signal!;signals.push(signal);await new Promise(resolve=>setTimeout(resolve,20));
      if(signal.aborted)throw new Error('Request aborted.');
      return new Response(JSON.stringify({verified:{campaignId:'campaign-orcs',missionId:'finale',factionId:'orcs'},profile:{owned:[],wins:{},equipment:{}}}));
    }});
    await expect(api.claimCampaignVictory('finale',{})).resolves.toMatchObject({verified:{missionId:'finale'}});
    await expect(api.cosmetics()).rejects.toThrow('did not respond in time');
    expect(signals.map(signal=>signal.aborted)).toEqual([false,true]);
  });
});
