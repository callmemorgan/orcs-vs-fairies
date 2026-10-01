import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { WebSocket } from 'ws';
import { createRtsServer } from '../src/server/server';
import { createGame } from '../src/core/simulation';
import { OnlineView } from '../src/server/views';
import type { ServerMessage, SnapshotMessage, CommandAck, LobbyObservation } from '../src/online/protocol';

class Client {
  cookie='';
  constructor(readonly url:string){}
  async request(path:string,value?:unknown){
    const response=await fetch(this.url+path,{method:value===undefined?'GET':'POST',headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(value===undefined?{}:{'Content-Type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})});
    const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
    return {status:response.status,data:await response.json() as Record<string,any>};
  }
  async register(username:string){const result=await this.request('/api/auth/register',{username,password:'correct-horse-battery'});expect(result.status).toBe(200);return result.data.account;}
  async socket(matchId:string,role='player',perspective=0){
    const result=await this.request(`/api/matches/${matchId}/ticket`,{role,perspective});expect(result.status).toBe(200);
    const peer=new WirePeer(this.url.replace(/^http/,'ws')+`/ws?ticket=${result.data.ticket}`,this.cookie);
    await peer.next(message=>message.kind==='hello');return peer;
  }
}
class WirePeer {
  readonly ws:WebSocket;
  readonly messages:ServerMessage[]=[];
  private waiters:Array<{predicate:(message:ServerMessage)=>boolean;resolve:(message:ServerMessage)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>=[];
  constructor(url:string,cookie:string){
    this.ws=new WebSocket(url,{headers:{Cookie:cookie}});
    this.ws.on('message',data=>{
      const message=JSON.parse(data.toString()) as ServerMessage;
      const waiter=this.waiters.find(waiter=>waiter.predicate(message));
      if(waiter){this.waiters.splice(this.waiters.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve(message);}else this.messages.push(message);
    });
    this.ws.on('error',error=>{for(const waiter of this.waiters){clearTimeout(waiter.timer);waiter.reject(error);}this.waiters=[];});
  }
  next(predicate:(message:ServerMessage)=>boolean,timeout=4000):Promise<ServerMessage>{
    const index=this.messages.findIndex(predicate);if(index>=0)return Promise.resolve(this.messages.splice(index,1)[0]);
    return new Promise((resolve,reject)=>{const waiter={predicate,resolve,reject,timer:setTimeout(()=>{this.waiters=this.waiters.filter(item=>item!==waiter);reject(new Error('Timed out waiting for network message.'));},timeout)};this.waiters.push(waiter);});
  }
  send(value:unknown){this.ws.send(JSON.stringify(value));}
  async snapshot(afterTick=-1){return await this.next(message=>message.kind==='snapshot'&&message.tick>afterTick) as SnapshotMessage;}
  async command(clientSeq:number,command:unknown,observedTick=0){this.send({kind:'command',protocolVersion:1,clientSeq,observedTick,command});return await this.next(message=>message.kind==='commandAck'&&message.clientSeq===clientSeq) as CommandAck;}
  close(){this.ws.terminate();}
}

const cleanup:Array<()=>Promise<unknown>>=[];
afterEach(async()=>{while(cleanup.length)await cleanup.pop()!();});
async function setup(delay=0){
  const directory=await mkdtemp(join(tmpdir(),'ovf-server-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
  const server=await createRtsServer({dataDir:directory,port:0,spectatorDelaySeconds:delay});cleanup.push(()=>server.close());
  const host=new Client(server.url),guest=new Client(server.url);
  const first=await host.register('host'),second=await guest.register('guest');
  return {directory,server,host,guest,first,second};
}
async function launch(host:Client,guest:Client){
  let result=await host.request('/api/lobbies',{settings:{mapSize:'small',factions:['orcs','fairies']},seed:4127});expect(result.status).toBe(201);
  let lobby=result.data.lobby as LobbyObservation;
  result=await guest.request(`/api/lobbies/${lobby.id}/join`,{expectedRevision:lobby.revision});expect(result.status).toBe(200);lobby=result.data.lobby;
  result=await host.request(`/api/lobbies/${lobby.id}/ready`,{expectedRevision:lobby.revision,ready:true});expect(result.status).toBe(200);lobby=result.data.lobby;
  result=await guest.request(`/api/lobbies/${lobby.id}/ready`,{expectedRevision:lobby.revision,ready:true});expect(result.status).toBe(200);lobby=result.data.lobby;
  result=await host.request(`/api/lobbies/${lobby.id}/start`,{expectedRevision:lobby.revision});expect(result.status).toBe(200);return result.data.lobby as LobbyObservation;
}

describe('authoritative HTTP and WebSocket server',()=>{
  it('authenticates, rejects stale lobby changes and requires readiness on current rules',async()=>{
    const {host,guest,server}=await setup();
    expect((await new Client(server.url).request('/api/lobbies')).status).toBe(401);
    let response=await host.request('/api/lobbies',{seed:7});let lobby=response.data.lobby as LobbyObservation;
    response=await guest.request(`/api/lobbies/${lobby.id}/join`,{expectedRevision:lobby.revision});lobby=response.data.lobby;
    expect((await host.request(`/api/lobbies/${lobby.id}/ready`,{expectedRevision:1,ready:true})).status).toBe(409);
    expect((await host.request(`/api/lobbies/${lobby.id}/start`,{expectedRevision:lobby.revision})).status).toBe(409);
    response=await host.request(`/api/lobbies/${lobby.id}/ready`,{expectedRevision:lobby.revision,ready:true});lobby=response.data.lobby;
    response=await host.request(`/api/lobbies/${lobby.id}/settings`,{expectedRevision:lobby.revision,settings:{mapSize:'large',factions:['dwarves','undead']}});lobby=response.data.lobby;
    expect(lobby.seats.every(seat=>!seat.ready)).toBe(true);
    expect(lobby.settings.mapSize).toBe('large');
    expect((await guest.request(`/api/lobbies/${lobby.id}/settings`,{expectedRevision:lobby.revision,settings:lobby.settings})).status).toBe(403);
    expect((await guest.request(`/api/lobbies/${lobby.id}/start`,{expectedRevision:lobby.revision})).status).toBe(403);
    expect((await host.request('/api/health')).data).toMatchObject({ok:true,tickRate:20,protocolVersion:1});
  });

  it('accepts real same-origin browser requests with an empty configured origin and rejects cross-origin writes',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'ovf-origin-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
    const server=await createRtsServer({dataDir:directory,port:0,origin:''});cleanup.push(()=>server.close());
    const request=(origin:string)=>fetch(server.url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({username:'browser',password:'long-enough-password'})});
    expect((await request('https://unrelated.example')).status).toBe(403);
    expect((await request(server.url)).status).toBe(200);
  });

  it('creates a real guest session and bounds malformed nested inputs without stopping a match',async()=>{
    const {host,guest,server}=await setup();const anonymous=new Client(server.url);
    const login=await anonymous.request('/api/auth/guest',{username:'Visitor'});expect(login.status).toBe(200);
    expect((await anonymous.request('/api/session')).data.account.id).toBe(login.data.account.id);
    const lobby=await launch(host,guest),peer=await host.socket(lobby.matchId!);cleanup.push(async()=>peer.close());
    const initial=await peer.snapshot();
    const nested='{"a":'.repeat(5000)+'0'+'}'.repeat(5000);
    peer.ws.send(`{"kind":"command","protocolVersion":1,"clientSeq":1,"observedTick":0,"command":${nested}}`);
    const ack=await peer.next(message=>message.kind==='commandAck');expect(ack).toMatchObject({accepted:false,reason:'invalid-command'});
    expect((await host.request('/api/health')).status).toBe(200);
    const later=await peer.snapshot(initial.tick);expect(later.tick).toBeGreaterThan(initial.tick);
    peer.ws.send(`{"kind":"command","protocolVersion":1,"clientSeq":1,"observedTick":${later.tick},"command":${nested}}`);
    expect(await peer.next(message=>message.kind==='commandAck')).toEqual(ack);
  });

  it('rejects malformed unauthenticated upgrade hosts without terminating HTTP service',async()=>{
    const {server,host}=await setup();
    const response=await new Promise<string>((resolve,reject)=>{
      const socket=connect(server.port,'127.0.0.1');let result='';
      socket.on('connect',()=>socket.write('GET /ws HTTP/1.1\r\nHost: [\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n'));
      socket.on('data',data=>{result+=data.toString();});socket.on('end',()=>resolve(result));socket.on('error',reject);
    });
    expect(response).toContain('400 Bad Request');expect((await host.request('/api/health')).status).toBe(200);
  });

  it('runs two independent human sockets, filters fog, enforces ownership and deduplicates paid commands',async()=>{
    const {host,guest,directory}=await setup();const lobby=await launch(host,guest),matchId=lobby.matchId!;
    const first=await host.socket(matchId),second=await guest.socket(matchId);cleanup.push(async()=>{first.close();second.close();});
    const a=await first.snapshot(),b=await second.snapshot();
    expect(a.view.side).toBe(0);expect(b.view.side).toBe(1);
    expect(a.view.entities.every(entity=>entity.side===0)).toBe(true);expect(b.view.entities.every(entity=>entity.side===1)).toBe(true);
    expect(a.view.map).not.toHaveProperty('seed');expect(a.view.map.starts[1]).toBeNull();
    expect(a.view).not.toHaveProperty('players');expect(a.view).not.toHaveProperty('state');
    const enemyWorker=b.view.entities.find(entity=>entity.kind==='unit'&&entity.role==='worker')!;
    expect(await first.command(1,{type:'move',ids:[enemyWorker.id],x:10,y:10})).toMatchObject({accepted:false,reason:'ownership'});
    const hq=a.view.entities.find(entity=>entity.kind==='building'&&entity.role==='hq')!;
    const recruit={type:'train',id:hq.id,role:'worker'};
    const ack=await first.command(2,recruit);expect(ack.accepted).toBe(true);
    const duplicate=await first.command(2,recruit);expect(duplicate).toEqual(ack);
    const newer=await first.snapshot(ack.appliedTick);expect(newer.view.player.wood).toBe(a.view.player.wood-50);
    const producer=newer.view.entities.find(entity=>entity.id===hq.id) as any;expect(producer.queue).toEqual(['worker']);
    first.send({kind:'command',protocolVersion:1,clientSeq:2,observedTick:0,command:{type:'train',id:hq.id,role:'melee'}});
    expect(await first.next(message=>message.kind==='error')).toMatchObject({code:'sequence-conflict'});
    expect(await first.command(3,{...recruit,side:1})).toMatchObject({accepted:false,reason:'invalid-command'});
    const db=new DatabaseSync(join(directory,'server.sqlite'),{readOnly:true});
    expect(db.prepare('SELECT COUNT(*) AS n FROM commands WHERE match_id=? AND side=0 AND client_seq=2').get(matchId)?.n).toBe(1);db.close();
  });

  it('fences an old player connection and preserves receipt identity after reconnect',async()=>{
    const {host,guest}=await setup();const lobby=await launch(host,guest),old=await host.socket(lobby.matchId!);cleanup.push(async()=>old.close());
    const initial=await old.snapshot(),hq=initial.view.entities.find(entity=>entity.role==='hq')!;
    const ack=await old.command(1,{type:'train',id:hq.id,role:'worker'});
    const closed=new Promise<number>(resolve=>old.ws.once('close',code=>resolve(code)));
    const newer=await host.socket(lobby.matchId!);cleanup.push(async()=>newer.close());
    expect(await closed).toBe(4001);
    expect(await newer.command(1,{type:'train',id:hq.id,role:'worker'})).toEqual(ack);
    const frame=await newer.snapshot(ack.appliedTick);expect(frame.view.player.wood).toBe(initial.view.player.wood-50);
    const ownWorker=frame.view.entities.find(entity=>entity.role==='worker')!;
    expect(await newer.command(2,{type:'move',ids:[ownWorker.id],x:ownWorker.x+1,y:ownWorker.y+1})).toMatchObject({accepted:true});
  });

  it('recovers command journal, account sessions and gathering memory after server restart',async()=>{
    const context=await setup();const {host,guest,server,directory}=context,lobby=await launch(host,guest),peer=await host.socket(lobby.matchId!);cleanup.push(async()=>peer.close());
    const initial=await peer.snapshot(),worker=initial.view.entities.find(entity=>entity.role==='worker')!,resource=initial.view.resources.find(node=>node.kind==='wood')!;
    const ack=await peer.command(1,{type:'gather',ids:[worker.id],target:resource.id});expect(ack.accepted).toBe(true);
    const before=await peer.snapshot(ack.appliedTick);await server.close();
    const resumed=await createRtsServer({dataDir:directory,port:0,spectatorDelaySeconds:0});cleanup.push(()=>resumed.close());
    const fresh=new Client(resumed.url);fresh.cookie=host.cookie;
    expect((await fresh.request('/api/session')).data.account.id).toBe(context.first.id);
    const connection=await fresh.socket(lobby.matchId!);cleanup.push(async()=>connection.close());
    const frame=await connection.snapshot();expect(frame.tick).toBeGreaterThanOrEqual(before.tick);
    const restored=frame.view.entities.find(entity=>entity.id===worker.id) as any;
    expect(restored.order).toMatchObject({type:'gather',target:resource.id});
    expect(frame.view.resources.find(node=>node.id===resource.id)).toBeDefined();
    expect(await connection.command(1,{type:'gather',ids:[worker.id],target:resource.id})).toEqual(ack);
  });

  it('delays actual spectator frames and rejects spectator commands',async()=>{
    const {host,guest,server}=await setup(.4);const lobby=await launch(host,guest),spectator=new Client(server.url);await spectator.register('watcher');
    const observer=await spectator.socket(lobby.matchId!,'spectator',0);cleanup.push(async()=>observer.close());
    expect(await observer.next(message=>message.kind==='waiting')).toMatchObject({availableAtTick:8});
    observer.send({kind:'command',protocolVersion:1,clientSeq:1,observedTick:0,command:{type:'hold',ids:[2]}});
    expect(await observer.next(message=>message.kind==='error')).toMatchObject({code:'spectator'});
    const frame=await observer.snapshot();const live=(await host.request('/api/matches')).data.matches[0];
    expect(live.tick-frame.tick).toBeGreaterThanOrEqual(8);
    expect(frame.view.side).toBe(0);expect(frame.view.entities.every(entity=>entity.side===0)).toBe(true);
    expect((await spectator.request(`/api/matches/${lobby.matchId}/ticket`,{role:'player'})).status).toBe(403);
  });

  it('redacts an unseen attacker independently of its known victim',()=>{
    const state=createGame('orcs',7,'fairies',{controllers:['external','external']});
    const victim=state.entities.find(entity=>entity.side===0&&entity.role==='worker')!,attacker=state.entities.find(entity=>entity.side===1&&entity.role==='melee')!;
    state.events=[{type:'attack',x:attacker.x,y:attacker.y,side:1,source:attacker.id,target:victim.id,text:'private position'}];
    const observation=new OnlineView(0).observe(state);
    expect(observation.events).toHaveLength(1);expect(observation.events[0]).toMatchObject({x:victim.x,y:victim.y,target:victim.id});
    expect(observation.events[0]).not.toHaveProperty('source');expect(observation.events[0]).not.toHaveProperty('side');expect(observation.events[0]).not.toHaveProperty('text');
    expect(observation.entities.some(entity=>entity.id===attacker.id)).toBe(false);
  });
});
