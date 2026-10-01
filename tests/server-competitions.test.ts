import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WebSocket } from 'ws';
import { request as httpRequest } from 'node:http';
import { createRtsServer } from '../src/server/server';
import { ServerStore } from '../src/server/store';
import { dailyAt, seasonAt } from '../src/server/competitions';
import { createMatch, stepGame } from '../src/core/simulation';
import { OnlineView } from '../src/server/views';
import type { LobbyObservation, ServerMessage, SnapshotMessage } from '../src/online/protocol';

class Client {
  cookie='';constructor(public url:string){}
  async request(path:string,body?:unknown){const response=await fetch(this.url+path,{method:body===undefined?'GET':'POST',headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];return {status:response.status,data:await response.json() as any};}
  async register(username:string){expect((await this.request('/api/auth/register',{username,password:'hosted-proof-password'})).status).toBe(200);}
  async edit(lobby:LobbyObservation,action:string,value={}){const result=await this.request(`/api/lobbies/${lobby.id}/${action}`,{expectedRevision:lobby.revision,...value});expect(result.status).toBe(200);return result.data.lobby as LobbyObservation;}
  async peer(matchId:string){const response=await this.request(`/api/matches/${matchId}/ticket`,{role:'player'});expect(response.status).toBe(200);const peer=new Peer(this.url.replace('http','ws')+'/ws?ticket='+response.data.ticket,this.cookie);await peer.next(message=>message.kind==='hello');return peer;}
}
class Peer {
  ws:WebSocket;messages:ServerMessage[]=[];
  constructor(url:string,cookie:string){this.ws=new WebSocket(url,{headers:{Cookie:cookie}});this.ws.on('message',data=>this.messages.push(JSON.parse(data.toString())));}
  async next(predicate:(message:ServerMessage)=>boolean):Promise<ServerMessage>{const deadline=Date.now()+10000;while(Date.now()<deadline){const index=this.messages.findIndex(predicate);if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('No hosted message arrived.');}
  async command(seq:number,command:unknown){this.ws.send(JSON.stringify({kind:'command',protocolVersion:1,clientSeq:seq,observedTick:0,command}));return this.next(message=>message.kind==='commandAck'&&message.clientSeq===seq);}
  snapshot(){return this.next(message=>message.kind==='snapshot') as Promise<SnapshotMessage>;}
}
const cleanup:Array<()=>Promise<unknown>>=[];
afterEach(async()=>{while(cleanup.length)await cleanup.pop()!();});
async function setup(now=Date.UTC(2026,9,31,23,59,59),interval=50){let clock=now;const directory=await mkdtemp(join(tmpdir(),'ovf-competition-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));const server=await createRtsServer({dataDir:directory,port:0,spectatorDelaySeconds:0,competitionNow:()=>clock,tickIntervalMs:interval});cleanup.push(()=>server.close());const host=new Client(server.url),guest=new Client(server.url);await host.register('rankingHost');await guest.register('rankingGuest');return {server,host,guest,directory,setClock:(value:number)=>{clock=value;},clock:()=>clock};}
async function ranked(host:Client,guest:Client){const response=await host.request('/api/lobbies',{ranked:true,settings:{mapSize:'small',factions:['orcs','fairies']}});expect(response.status).toBe(201);let lobby=response.data.lobby as LobbyObservation;lobby=await guest.edit(lobby,'join');lobby=await host.edit(lobby,'ready',{ready:true});lobby=await guest.edit(lobby,'ready',{ready:true});return host.edit(lobby,'start');}

describe('durable ranked seasons and hosted daily challenges',()=>{
  it('keeps failed final awards unfinished and restricts opponent inspection until recovery commits the result',async()=>{
    const {host,guest,server,directory}=await setup();const lobby=await ranked(host,guest),matchId=lobby.matchId!,peer=await guest.peer(matchId);cleanup.push(async()=>peer.ws.terminate());await peer.snapshot();
    const db=new DatabaseSync(join(directory,'server.sqlite'));
    db.exec("CREATE TRIGGER reject_hosted_award BEFORE INSERT ON competition_results BEGIN SELECT RAISE(ABORT,'hosted award rejected'); END;");
    peer.ws.send(JSON.stringify({kind:'command',protocolVersion:1,clientSeq:1,observedTick:0,command:{type:'surrender'}}));
    expect(await peer.next(message=>message.kind==='error')).toMatchObject({code:'storage-failure'});
    expect((await guest.request('/api/competitions/results/'+matchId)).data).toEqual({result:null,finished:false,failed:true});
    expect((await guest.request(`/api/matches/${matchId}/ticket`,{role:'spectator',perspective:0})).status).toBe(403);
    expect(db.prepare('SELECT finished FROM matches WHERE id=?').get(matchId)!.finished).toBe(0);expect(db.prepare('SELECT COUNT(*) n FROM commands WHERE match_id=?').get(matchId)!.n).toBe(0);expect(db.prepare('SELECT COUNT(*) n FROM competition_results').get()!.n).toBe(0);
    await server.close();db.exec('DROP TRIGGER reject_hosted_award');db.close();
    const recovered=await createRtsServer({dataDir:directory,port:0});cleanup.push(()=>recovered.close());host.url=guest.url=recovered.url;
    const retry=await guest.peer(matchId);cleanup.push(async()=>retry.ws.terminate());expect((await retry.snapshot()).view.result.finished).toBe(false);expect(await retry.command(1,{type:'surrender'})).toMatchObject({accepted:true});
    expect((await guest.request('/api/competitions/results/'+matchId)).data).toMatchObject({finished:true,failed:false});expect((await host.request('/api/ranked/standings')).data.standings.map((row:any)=>row.played)).toEqual([1,1]);
  });
  it('records simultaneous forfeits as one draw with unchanged ratings',async()=>{
    const {host,guest}=await setup(Date.UTC(2026,9,1),1000),lobby=await ranked(host,guest),a=await host.peer(lobby.matchId!),b=await guest.peer(lobby.matchId!);cleanup.push(async()=>{a.ws.terminate();b.ws.terminate();});await a.snapshot();await b.snapshot();
    await Promise.all([a.command(1,{type:'surrender'}),b.command(1,{type:'surrender'})]);
    expect((await host.request('/api/competitions/results/'+lobby.matchId)).data.result).toMatchObject({winner:null,ratings:[{before:1000,after:1000},{before:1000,after:1000}]});
    expect((await host.request('/api/ranked/standings')).data.standings.map((row:any)=>[row.played,row.draws,row.wins,row.losses])).toEqual([[1,1,0,0],[1,1,0,0]]);
  });
  it('rejects a concurrent start whose body finishes after the lobby revision changes',async()=>{
    const {host,guest,directory}=await setup();let lobby=(await host.request('/api/lobbies',{ranked:true})).data.lobby as LobbyObservation;
    lobby=await guest.edit(lobby,'join');lobby=await host.edit(lobby,'ready',{ready:true});lobby=await guest.edit(lobby,'ready',{ready:true});
    const payload=JSON.stringify({expectedRevision:lobby.revision});let finishSlow!:()=>void;
    const slow=new Promise<number>((resolve,reject)=>{const req=httpRequest(host.url+`/api/lobbies/${lobby.id}/start`,{method:'POST',headers:{Cookie:host.cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});req.on('error',reject);req.write(payload.slice(0,1));finishSlow=()=>req.end(payload.slice(1));});
    await new Promise(resolve=>setTimeout(resolve,25));expect((await host.request(`/api/lobbies/${lobby.id}/start`,{expectedRevision:lobby.revision})).status).toBe(200);finishSlow();expect(await slow).toBe(409);
    const db=new DatabaseSync(join(directory,'server.sqlite'),{readOnly:true});expect(db.prepare('SELECT COUNT(*) n FROM matches WHERE lobby_id=?').get(lobby.id)!.n).toBe(1);db.close();
  });
  it('awards one result across retries, post-game receipts and restarts, and keeps its starting season',async()=>{
    const context=await setup(),{host,guest,server,directory}=context;const lobby=await ranked(host,guest),matchId=lobby.matchId!;
    const peer=await guest.peer(matchId);cleanup.push(async()=>peer.ws.terminate());await peer.snapshot();
    context.setClock(Date.UTC(2026,10,1));const ack=await peer.command(1,{type:'surrender'});expect(ack).toMatchObject({accepted:true});
    expect(await peer.command(1,{type:'surrender'})).toEqual(ack);expect(await peer.command(2,{type:'surrender'})).toMatchObject({accepted:false,reason:'ended'});
    let standings=(await host.request('/api/ranked/standings?season=2026-10')).data.standings;expect(standings.map((row:any)=>[row.rating,row.played])).toEqual([[1016,1],[984,1]]);
    expect((await host.request('/api/ranked/seasons')).data.current).toMatchObject({id:'2026-11',initialRating:1000,startsAt:'2026-11-01T00:00:00.000Z',endsAt:'2026-12-01T00:00:00.000Z'});
    expect((await host.request('/api/ranked/standings')).data.standings).toEqual([]);
    const result=(await host.request('/api/competitions/results/'+matchId)).data.result;expect(result).toMatchObject({seasonId:'2026-10',ratings:[{before:1000,after:1016},{before:1000,after:984}]});
    await server.close();
    for(let index=0;index<2;index++){const restarted=await createRtsServer({dataDir:directory,port:0,competitionNow:context.clock});host.url=restarted.url;guest.url=restarted.url;expect((await host.request('/api/ranked/standings?season=2026-10')).data.standings).toEqual(standings);expect((await host.request('/api/competitions/results/'+matchId)).data.result).toEqual(result);await restarted.close();}
    const db=new DatabaseSync(join(directory,'server.sqlite'),{readOnly:true});expect(db.prepare('SELECT COUNT(*) n FROM competition_results').get()!.n).toBe(1);expect(db.prepare('SELECT COUNT(*) n FROM commands WHERE match_id=?').get(matchId)!.n).toBe(2);db.close();
  });
  it('rejects AI, handicaps, seed overrides, advanced starts and opponent spectator views for ranked entrants',async()=>{
    const {host,guest}=await setup();
    for(const settings of [{mapSize:'small',factions:['orcs','fairies'],startingAge:2},{mapSize:'small',players:[{factionId:'orcs',teamId:0,controller:'human'},{factionId:'fairies',teamId:1,controller:'ai'}]},{mapSize:'small',players:[{factionId:'orcs',teamId:0,controller:'human',handicap:{incomeFactor:1}},{factionId:'fairies',teamId:1,controller:'human'}]}])expect((await host.request('/api/lobbies',{ranked:true,settings})).status).toBe(400);
    expect((await host.request('/api/lobbies',{ranked:true,seed:99})).status).toBe(400);
    const lobby=await ranked(host,guest);expect((await guest.request(`/api/matches/${lobby.matchId}/ticket`,{role:'spectator',perspective:0})).status).toBe(403);
    expect((await guest.request(`/api/matches/${lobby.matchId}/ticket`,{role:'spectator'})).data.side).toBe(1);
    const normal=await host.request('/api/lobbies',{settings:{mapSize:'small',factions:['orcs','fairies']},seed:1});expect(normal.status).toBe(201);
  });
  it('uses server UTC daily conditions, resumes duplicate starts, and refuses forged scores or dates',async()=>{
    const context=await setup(),{host,guest}=context;
    const first=(await host.request('/api/challenges/daily')).data.challenge,second=(await guest.request('/api/challenges/daily')).data.challenge;expect(first).toEqual(second);expect(first).toEqual(dailyAt(context.clock()));
    for(const value of [{date:'2020-01-01'},{seed:1},{winner:0},{tick:1},{config:first.config}])expect((await host.request('/api/challenges/daily/start',value)).status).toBe(400);
    const launch=await host.request('/api/challenges/daily/start',{}),duplicate=await host.request('/api/challenges/daily/start',{});expect(launch.status).toBe(201);expect(duplicate.status).toBe(200);expect(duplicate.data.lobby.matchId).toBe(launch.data.lobby.matchId);
    expect((await host.request('/api/challenges/daily/score',{winner:0,tick:1})).status).toBe(404);
    const peer=await host.peer(launch.data.lobby.matchId);cleanup.push(async()=>peer.ws.terminate());await peer.snapshot();context.setClock(Date.UTC(2026,10,1));await peer.command(1,{type:'surrender'});
    expect((await host.request('/api/competitions/results/'+launch.data.lobby.matchId)).data.result).toMatchObject({date:'2026-10-31',won:false});expect((await host.request('/api/challenges/daily/standings?date=2026-10-31')).data.standings).toEqual([]);
    const tomorrow=await host.request('/api/challenges/daily/start',{});expect(tomorrow.data.challenge.date).toBe('2026-11-01');expect(tomorrow.data.challenge.seed).not.toBe(first.seed);
    expect((await guest.request('/api/competitions/results/'+launch.data.lobby.matchId)).status).toBe(403);
  });
  it('commits ratings and outcomes in the tick transaction and rolls all of them back on award failure',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'ovf-award-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));const store=new ServerStore(directory,'award-engine');cleanup.push(async()=>store.close());
    const players=[{id:'a',username:'Alice'},{id:'b',username:'Bob'}];players.forEach(player=>store.addUser(player,'unused'));
    const config={map:{seed:1,size:'small' as const},players:[{id:0 as const,teamId:0 as const,factionId:'orcs' as const,controller:'external' as const},{id:1 as const,teamId:1 as const,factionId:'fairies' as const,controller:'external' as const}]};
    const state=createMatch(config),views=[new OnlineView(0),new OnlineView(1)],memory=views.map(view=>view.snapshot());store.competitions.season(Date.UTC(2026,9,1));
    const lobby={id:'atomic-lobby',hostId:'a',revision:1,settings:{mapSize:'small' as const,factions:['orcs' as const,'fairies' as const]},seats:players.map((account,side)=>({side:side as 0|1,account,ready:true})),seed:1,matchId:'atomic-match',ranked:true};
    store.startMatch(lobby,state,memory,[0,0],{tick:0,views:views.map(view=>view.observe(state))},config,{kind:'ranked',seasonId:'2026-10',participants:players as [typeof players[0],typeof players[0]]});
    state.entities.filter(entity=>entity.side===1).forEach(entity=>{entity.hp=0;});stepGame(state,.05);expect(state.winner).toBe(0);
    store.db.exec("CREATE TEMP TRIGGER reject_award BEFORE INSERT ON competition_results BEGIN SELECT RAISE(ABORT,'award rejected'); END;");
    expect(()=>store.commitTick('atomic-match',state,[],memory,undefined,true)).toThrow('award rejected');expect(store.matches()[0]).toMatchObject({tick:0,finished:false});expect(store.competitions.standings('2026-10')).toEqual([]);expect(store.competitions.result('atomic-match')).toBeNull();
    store.db.exec('DROP TRIGGER reject_award');store.commitTick('atomic-match',state,[],memory,undefined,true);store.commitTick('atomic-match',state,[],memory,undefined,true);expect(store.competitions.standings('2026-10').map(row=>row.played)).toEqual([1,1]);
  });
  it('resets to the full 1000 baseline in the next season while retaining archived ratings',async()=>{
    const context=await setup(),{host,guest}=context;const first=await ranked(host,guest),loser=await guest.peer(first.matchId!);cleanup.push(async()=>loser.ws.terminate());await loser.snapshot();await loser.command(1,{type:'surrender'});
    context.setClock(Date.UTC(2026,10,1));const second=await ranked(host,guest),other=await host.peer(second.matchId!);cleanup.push(async()=>other.ws.terminate());await other.snapshot();await other.command(1,{type:'surrender'});
    expect((await host.request('/api/competitions/results/'+second.matchId)).data.result.ratings).toEqual([{accountId:(await host.request('/api/session')).data.account.id,before:1000,after:984},{accountId:(await guest.request('/api/session')).data.account.id,before:1000,after:1016}]);
    expect((await host.request('/api/ranked/standings?season=2026-10')).data.standings[0].account.username).toBe('rankingHost');expect((await host.request('/api/ranked/standings')).data.standings[0].account.username).toBe('rankingGuest');
    expect(seasonAt(Date.UTC(2026,11,31))).toMatchObject({id:'2026-12',endsAt:'2027-01-01T00:00:00.000Z'});
  });
});
