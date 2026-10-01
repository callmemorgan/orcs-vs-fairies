import {afterEach,describe,it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket} from 'ws';
import {FACTIONS} from '../src/core/content';
import {createRtsServer} from '../src/server/server';
import type {LobbyObservation,SnapshotMessage,ServerMessage,CommandAck} from '../src/online/protocol';
class Client {
 cookie='';constructor(public url:string){}
 async request(path:string,value?:unknown){const response=await fetch(this.url+path,{method:value===undefined?'GET':'POST',headers:{Cookie:this.cookie,...(value===undefined?{}:{'Content-Type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})});const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];return {status:response.status,data:await response.json() as any};}
 async guest(){const r=await this.request('/api/auth/guest',{});expect(r.status).toBe(200);return r.data.account;}
 async lobby(id:string){return (await this.request(`/api/lobbies/${id}`)).data.lobby as LobbyObservation;}
 async change(lobby:LobbyObservation,action:string,value:Record<string,unknown>={}){return this.request(`/api/lobbies/${lobby.id}/${action}`,{expectedRevision:lobby.revision,...value});}
}
class Peer {
 messages:ServerMessage[]=[];socket:WebSocket;constructor(url:string,cookie:string){this.socket=new WebSocket(url,{headers:{Cookie:cookie}});this.socket.on('message',data=>this.messages.push(JSON.parse(data.toString())));}
 async next(predicate:(m:ServerMessage)=>boolean):Promise<ServerMessage>{for(let i=0;i<200;i++){const index=this.messages.findIndex(predicate);if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('No network message');}
 async command(seq:number,command:unknown){this.socket.send(JSON.stringify({kind:'command',protocolVersion:1,clientSeq:seq,observedTick:0,command}));return this.next(m=>m.kind==='commandAck'&&m.clientSeq===seq) as Promise<CommandAck>;}
}
const clean:Array<()=>Promise<unknown>>=[];afterEach(async()=>{while(clean.length)await clean.pop()!();});
async function setup(){const directory=await mkdtemp(join(tmpdir(),'ovf-modes-'));clean.push(()=>rm(directory,{recursive:true,force:true}));const server=await createRtsServer({dataDir:directory,port:0});clean.push(()=>server.close());const host=new Client(server.url),guest=new Client(server.url);await host.guest();await guest.guest();return {directory,server,host,guest};}
async function create(host:Client,guest:Client,ruleInput:any){const response=await host.request('/api/lobbies',{seed:4127,settings:{mapSize:'small',factions:['orcs','fairies'],rules:ruleInput}});expect(response.status).toBe(201);const lobby=response.data.lobby as LobbyObservation;const joined=await guest.change(lobby,'join');expect(joined.status).toBe(200);return joined.data.lobby as LobbyObservation;}

describe('custom online rules and saved draft authority',()=>{
 it('rejects stale/foreign choices and launches the chosen soldier with actual restricted commands',async()=>{
  const {host,guest}=await setup();let lobby=await create(host,guest,{mode:'hill',startingAge:3,startingResources:{wood:1200,ore:900,crystal:300},hill:{holdTicks:400},draft:{enabled:true,banRounds:1,pickRounds:2,turnTicks:600}});
  expect((await guest.lobby(lobby.id)).settings.rules).toMatchObject({mode:'hill',startingAge:3,startingResources:{wood:1200,ore:900,crystal:300}});
  expect((await host.change(lobby,'ready',{ready:true})).status).toBe(409);expect((await guest.change(lobby,'draft',{definitionId:FACTIONS.orcs.units.melee.id})).status).toBe(409);
  const stale=lobby;let response=await host.change(lobby,'draft',{definitionId:FACTIONS.orcs.units.melee.id});expect(response.status).toBe(200);lobby=response.data.lobby;
  expect((await host.change(stale,'ready',{ready:true})).status).toBe(409);expect((await guest.change(lobby,'draft',{definitionId:FACTIONS.orcs.units.melee.id})).status).toBe(409);
  for(const [client,id] of [[guest,FACTIONS.fairies.units.siege.id],[host,FACTIONS.orcs.units.ranged.id],[guest,FACTIONS.fairies.units.melee.id],[guest,'worker-harvest'],[host,'worker-speed']] as const){response=await client.change(lobby,'draft',{definitionId:id});expect(response.status).toBe(200);lobby=response.data.lobby;}
  expect(lobby.draft?.status).toBe('complete');response=await host.change(lobby,'ready',{ready:true});lobby=response.data.lobby;response=await guest.change(lobby,'ready',{ready:true});lobby=response.data.lobby;response=await host.change(lobby,'start');expect(response.status).toBe(200);lobby=response.data.lobby;
  const ticket=await host.request(`/api/matches/${lobby.matchId}/ticket`,{role:'player'});const peer=new Peer(host.url.replace(/^http/,'ws')+`/ws?ticket=${ticket.data.ticket}`,host.cookie);clean.push(async()=>peer.socket.terminate());await peer.next(m=>m.kind==='hello');const frame=await peer.next(m=>m.kind==='snapshot') as SnapshotMessage;
  expect(frame.view.rules.mode).toBe('hill');expect(frame.view.player.wood).toBe(1200);expect(frame.view.entities.filter(e=>e.side===0&&e.kind==='unit'&&e.role!=='worker').map(e=>e.role)).toEqual(['ranged']);
  const hq=frame.view.entities.find(e=>e.side===0&&e.role==='hq')!;expect(await peer.command(1,{type:'research',id:hq.id,upgrade:'worker-harvest'})).toMatchObject({accepted:false,reason:'unavailable'});expect(await peer.command(2,{type:'research',id:hq.id,upgrade:'worker-speed'})).toMatchObject({accepted:true});
 });
 it('retains the draft turn across process restart and advances expired server-owned turns',async()=>{
  const {directory,server,host,guest}=await setup();let lobby=await create(host,guest,{draft:{enabled:true,banRounds:0,pickRounds:1,turnTicks:20}});const before=lobby.draft!;await server.close();
  const restarted=await createRtsServer({dataDir:directory,port:0});clean.push(()=>restarted.close());host.url=restarted.url;guest.url=restarted.url;lobby=await guest.lobby(lobby.id);expect(lobby.draft?.turn).toBe(before.turn);expect(lobby.draft?.pool).toEqual(before.pool);expect(lobby.draft?.order).toEqual(before.order);
  for(let i=0;i<80&&lobby.draft?.status!=='complete';i++){await new Promise(resolve=>setTimeout(resolve,50));lobby=await host.lobby(lobby.id);}expect(lobby.draft?.status).toBe('complete');expect(lobby.draft?.picks.every(picks=>picks.length===1)).toBe(true);expect(lobby.seats.every(seat=>!seat.ready)).toBe(true);
 });
 it('clears prior draft choices/readiness after host departure and a settings revision',async()=>{
  const {host,guest}=await setup();let lobby=await create(host,guest,{draft:{enabled:true,banRounds:1,pickRounds:1}});let response=await host.change(lobby,'draft',{definitionId:'worker-harvest'});lobby=response.data.lobby;expect(lobby.draft?.turn).toBe(1);
  response=await host.change(lobby,'leave');expect(response.status).toBe(200);lobby=response.data.lobby;expect(lobby.draft?.turn).toBe(0);expect(lobby.draft?.banned).toEqual([]);expect(lobby.seats.every(seat=>!seat.ready)).toBe(true);expect(lobby.hostId).toBe(lobby.seats[1].account?.id);
  response=await guest.change(lobby,'settings',{settings:{mapSize:'large',factions:['orcs','fairies'],rules:{mode:'relic',draft:{enabled:false},startingResources:{wood:700,ore:400,crystal:20}}}});expect(response.status).toBe(200);lobby=response.data.lobby;expect(lobby.draft?.status).toBe('complete');expect(lobby.settings.rules?.mode).toBe('relic');expect(lobby.settings.rules?.startingResources?.wood).toBe(700);
 });
});
