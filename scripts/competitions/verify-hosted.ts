import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { WebSocket } from 'ws';
import { createRtsServer } from '../../src/server/server';
import { createMatch } from '../../src/core/simulation';
import type { CommandMessage, SnapshotMessage, ServerMessage } from '../../src/online/protocol';

const directory=await mkdtemp(join(tmpdir(),'ovf-hosted-daily-')),evidence=resolve('docs/evidence/competitions-hosted');await mkdir(evidence,{recursive:true});
let server=await createRtsServer({dataDir:directory,port:0,tickIntervalMs:1,competitionNow:()=>Date.UTC(2026,9,1),spectatorDelaySeconds:0}),cookie='';
async function request(path:string,body?:unknown){
  const response=await fetch(server.url+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;assert.ok(response.ok,`${path}: ${response.status}`);return response.json() as Promise<any>;
}
async function attempt(waitTicks:number){
  const run=await request('/api/challenges/daily/start',{}),matchId=run.lobby.matchId;
  // The fixed challenge publicly supplies its complete seed and starting configuration.
  const enemy=createMatch(run.challenge.config).starts[1],ticket=await request(`/api/matches/${matchId}/ticket`,{role:'player'});
  const socket=new WebSocket(server.url.replace(/^http/,'ws')+'/ws?ticket='+ticket.ticket,{headers:{Cookie:cookie}});
  const commands:CommandMessage[]=[],receipts:ServerMessage[]=[];let seq=0,last=-100,lastSnapshot:SnapshotMessage|undefined;
  try{
    await new Promise<void>((resolveFinished,reject)=>{
      const deadline=setTimeout(()=>reject(new Error('Hosted daily victory did not finish within 90 seconds.')),90000);
      socket.on('error',reject);
      socket.on('message',raw=>{
        const message=JSON.parse(raw.toString()) as ServerMessage;
        if(message.kind==='error'){clearTimeout(deadline);reject(new Error(message.message));return;}
        if(message.kind==='commandAck'){receipts.push(message);return;}
        if(message.kind!=='snapshot')return;lastSnapshot=message;const view=message.view;
        if(view.result.finished){clearTimeout(deadline);resolveFinished();return;}
        if(view.tick<waitTicks||view.tick-last<40)return;last=view.tick;
        const owned=view.entities.filter(entity=>entity.side===0&&entity.hp>0),hq=owned.find(entity=>entity.role==='hq');
        if(!hq)return;
        const send=(command:CommandMessage['command'])=>{const entry:CommandMessage={kind:'command',protocolVersion:1,clientSeq:++seq,observedTick:view.tick,command};commands.push(entry);socket.send(JSON.stringify(entry));};
        if(hq.queue&&hq.queue.length<2&&view.player.wood>=50&&view.player.population+hq.queue.length<view.player.cap)send({type:'train',id:hq.id,role:'worker'});
        const ids=owned.filter(entity=>entity.kind==='unit'&&entity.order&&['idle','hold','move'].includes(entity.order.type)).map(entity=>entity.id);
        if(ids.length)send({type:'attackMove',ids,x:enemy.x,y:enemy.y});
      });
    });
    assert.equal(lastSnapshot?.view.result.outcome,'win');
    const stored=await request('/api/competitions/results/'+matchId);assert.equal(stored.result.won,true);assert.equal(stored.result.tick,lastSnapshot!.tick);
    return {matchId,challenge:run.challenge,tick:stored.result.tick,commands,receipts,final:lastSnapshot!.view.result};
  }finally{socket.terminate();}
}
try{
  await request('/api/auth/register',{username:'HostedDailyProof',password:'hosted-ordinary-input-proof'});
  const first=await attempt(0);console.log(`PASS hosted victory: ${first.tick} ticks / ${first.tick/20} seconds`);
  const second=await attempt(100);assert.deepEqual(second.challenge,first.challenge);console.log(`PASS same-account second hosted victory: ${second.tick} ticks`);
  const standings=(await request('/api/challenges/daily')).standings;assert.equal(standings.length,1);assert.equal(standings[0].tick,Math.min(first.tick,second.tick));
  assert.equal(standings[0].seconds,standings[0].tick/20);console.log('PASS leaderboard retains only the fastest verified victory');
  const last=second.commands.at(-1)!;
  // Retry a paid input from this finished run over a new generation; its receipt stays the same.
  const ticket=await request(`/api/matches/${second.matchId}/ticket`,{role:'player'}),socket=new WebSocket(server.url.replace(/^http/,'ws')+'/ws?ticket='+ticket.ticket,{headers:{Cookie:cookie}});
  await new Promise<void>((resolveRetry,reject)=>{const timer=setTimeout(()=>reject(new Error('Duplicate receipt timed out.')),5000);socket.on('message',raw=>{const message=JSON.parse(raw.toString());if(message.kind==='hello')socket.send(JSON.stringify(last));if(message.kind==='commandAck'){assert.deepEqual(message,second.receipts.find((receipt:any)=>receipt.clientSeq===last.clientSeq));clearTimeout(timer);resolveRetry();}});socket.on('error',reject);});socket.terminate();
  assert.deepEqual((await request('/api/challenges/daily')).standings,standings);console.log('PASS command retry does not award another score');
  await server.close();server=await createRtsServer({dataDir:directory,port:0,tickIntervalMs:1,competitionNow:()=>Date.UTC(2026,9,1),spectatorDelaySeconds:0});
  assert.deepEqual((await request('/api/challenges/daily')).standings,standings);assert.equal((await request('/api/competitions/results/'+first.matchId)).result.won,true);console.log('PASS winning results and fastest score survive a real server restart');
  await writeFile(resolve(evidence,'result.json'),JSON.stringify({first,second,standings,method:'The trusted test server advances unchanged 1/20-second simulation steps every 1ms. Both human slots remain external. Only normal authenticated HTTP and WebSocket commands control the matches; no state, winner or score is supplied by the client.'},null,2));
}finally{await server.close();await rm(directory,{recursive:true,force:true});}
