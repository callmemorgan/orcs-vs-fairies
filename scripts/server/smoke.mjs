import { WebSocket } from 'ws';
import { writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin=new URL(process.argv[2]??'http://127.0.0.1:8787').origin;
const savedFile=process.argv[4];
const mode=process.argv[3];
class Client {
  cookie='';
  async request(path,value){
    const response=await fetch(origin+path,{method:value===undefined?'GET':'POST',headers:{Origin:origin,...(this.cookie?{Cookie:this.cookie}:{}),...(value===undefined?{}:{'Content-Type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})});
    const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
    const data=await response.json();assert(response.ok,`${path}: ${response.status} ${data.error??''}`);return data;
  }
  async connect(matchId){
    const {ticket}=await this.request(`/api/matches/${matchId}/ticket`,{role:'player'});
    return new Peer(`${origin.replace(/^http/,'ws')}/ws?ticket=${ticket}`,this.cookie);
  }
}
class Peer {
  messages=[];waiters=[];
  constructor(url,cookie){
    this.ws=new WebSocket(url,{headers:{Cookie:cookie,Origin:origin}});
    this.ws.on('message',raw=>{
      const message=JSON.parse(raw.toString()),waiter=this.waiters.find(waiter=>waiter.predicate(message));
      if(waiter){this.waiters.splice(this.waiters.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve(message);}else this.messages.push(message);
    });
    this.ws.on('error',error=>{for(const waiter of this.waiters){clearTimeout(waiter.timer);waiter.reject(error);}this.waiters=[];});
  }
  next(predicate){
    const index=this.messages.findIndex(predicate);if(index>=0)return Promise.resolve(this.messages.splice(index,1)[0]);
    return new Promise((resolve,reject)=>{const waiter={predicate,resolve,reject,timer:setTimeout(()=>{this.waiters=this.waiters.filter(item=>item!==waiter);reject(new Error('Network receipt timed out.'));},5000)};this.waiters.push(waiter);});
  }
  async command(clientSeq,command,observedTick=0){
    this.ws.send(JSON.stringify({kind:'command',protocolVersion:1,clientSeq,observedTick,command}));
    return await this.next(message=>message.kind==='commandAck'&&message.clientSeq===clientSeq);
  }
  close(){this.ws.terminate();}
}

if(mode==='--resume'){
  assert(savedFile,'Provide a private smoke state file after --resume.');
  const saved=JSON.parse(await readFile(savedFile,'utf8')),client=new Client();client.cookie=saved.cookie;
  assert.equal((await client.request('/api/session')).account.id,saved.accountId);
  const peer=await client.connect(saved.matchId);
  try{
    const hello=await peer.next(message=>message.kind==='hello');assert.equal(hello.lastClientSeq,2);
    assert.deepEqual(await peer.command(2,saved.command),saved.ack);
    const frame=await peer.next(message=>message.kind==='snapshot');assert(frame.tick>=saved.tick);
    console.log(JSON.stringify({ok:true,path:'production-restart',tick:frame.tick,receiptPreserved:true,sessionPreserved:true}));
  }finally{peer.close();}
}else{
  const host=new Client(),guest=new Client();
  const first=await host.request('/api/auth/guest',{username:'SmokeHost'});await guest.request('/api/auth/guest',{username:'SmokeGuest'});
  let {lobby}=await host.request('/api/lobbies',{settings:{mapSize:'small',factions:['orcs','fairies']},seed:4127});
  ({lobby}=await guest.request(`/api/lobbies/${lobby.id}/join`,{expectedRevision:lobby.revision}));
  ({lobby}=await host.request(`/api/lobbies/${lobby.id}/ready`,{expectedRevision:lobby.revision,ready:true}));
  ({lobby}=await guest.request(`/api/lobbies/${lobby.id}/ready`,{expectedRevision:lobby.revision,ready:true}));
  ({lobby}=await host.request(`/api/lobbies/${lobby.id}/start`,{expectedRevision:lobby.revision}));
  const a=await host.connect(lobby.matchId),b=await guest.connect(lobby.matchId);
  try{
    await Promise.all([a.next(message=>message.kind==='hello'),b.next(message=>message.kind==='hello')]);
    const [own,other]=await Promise.all([a.next(message=>message.kind==='snapshot'),b.next(message=>message.kind==='snapshot')]);
    assert.equal(own.view.side,0);assert.equal(other.view.side,1);
    assert(own.view.entities.every(entity=>entity.side===0));assert(other.view.entities.every(entity=>entity.side===1));
    assert(!Object.hasOwn(own.view.map,'seed'));assert.equal(own.view.map.starts[1],null);
    const enemy=other.view.entities.find(entity=>entity.role==='worker');
    assert.equal((await a.command(1,{type:'move',ids:[enemy.id],x:10,y:10})).reason,'ownership');
    const hq=own.view.entities.find(entity=>entity.role==='hq'),command={type:'train',id:hq.id,role:'worker'};
    const ack=await a.command(2,command);assert.equal(ack.accepted,true);assert.deepEqual(await a.command(2,command),ack);
    const frame=await a.next(message=>message.kind==='snapshot'&&message.tick>ack.appliedTick);
    assert.equal(frame.view.player.wood,own.view.player.wood-50);
    if(mode==='--save'){
      assert(savedFile,'Provide a private smoke state file after --save.');
      await writeFile(savedFile,JSON.stringify({cookie:host.cookie,accountId:first.account.id,matchId:lobby.matchId,command,ack,tick:frame.tick}),{mode:0o600});
    }
    console.log(JSON.stringify({ok:true,path:'production-two-clients',tick:frame.tick,ownershipRejected:true,fogFiltered:true,duplicateSpentOnce:true}));
  }finally{a.close();b.close();}
}
