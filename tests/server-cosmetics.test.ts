import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WebSocket } from 'ws';
import { createRtsServer, type ServerOptions } from '../src/server/server';
import { CampaignVerificationError, type VerifiedCampaignVictory } from '../src/server/campaign-verification';
import { COSMETICS } from '../src/online/cosmetics';
import { cosmeticSvg, resolveCosmeticLoadout } from '../src/game/Cosmetics';

class Client{
  cookie='';constructor(public url:string){}
  async request(path:string,body?:unknown){const response=await fetch(this.url+path,{method:body===undefined?'GET':'POST',headers:{Cookie:this.cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});this.cookie=response.headers.get('set-cookie')?.split(';')[0]??this.cookie;return {status:response.status,data:await response.json() as any};}
  async action(lobby:any,action:string,value={}){const response=await this.request(`/api/lobbies/${lobby.id}/${action}`,{expectedRevision:lobby.revision,...value});expect(response.status).toBe(200);return response.data.lobby;}
  async launch(guest:Client){let lobby=(await this.request('/api/lobbies',{ranked:true,settings:{mapSize:'small',factions:['orcs','fairies']}})).data.lobby;lobby=await guest.action(lobby,'join');lobby=await this.action(lobby,'ready',{ready:true});lobby=await guest.action(lobby,'ready',{ready:true});return this.action(lobby,'start');}
  async peer(matchId:string){const ticket=(await this.request(`/api/matches/${matchId}/ticket`,{role:'player'})).data.ticket;const peer=new Peer(this.url.replace('http','ws')+'/ws?ticket='+ticket,this.cookie);await peer.next(message=>message.kind==='snapshot');return peer;}
}
class Peer{
  ws:WebSocket;messages:any[]=[];constructor(url:string,cookie:string){this.ws=new WebSocket(url,{headers:{Cookie:cookie}});this.ws.on('message',data=>this.messages.push(JSON.parse(data.toString())));}
  async next(test:(message:any)=>boolean){const deadline=Date.now()+5000;while(Date.now()<deadline){const index=this.messages.findIndex(test);if(index>=0)return this.messages.splice(index,1)[0];await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Hosted receipt did not arrive.');}
  send(seq:number,command:unknown){this.ws.send(JSON.stringify({kind:'command',protocolVersion:1,clientSeq:seq,observedTick:0,command}));}
}
const cleanup:Array<()=>Promise<unknown>>=[];afterEach(async()=>{while(cleanup.length)await cleanup.pop()!();});
async function setup(options:Partial<ServerOptions>={}){const directory=await mkdtemp(join(tmpdir(),'ovf-cosmetic-'));cleanup.push(()=>rm(directory,{recursive:true,force:true}));const server=await createRtsServer({...options,dataDir:directory,port:0});cleanup.push(()=>server.close());const host=new Client(server.url),guest=new Client(server.url);for(const [index,client]of [host,guest].entries())expect((await client.request('/api/auth/register',{username:index?'CosmeticGuest':'CosmeticHost',password:'cosmetic-proof-password'})).status).toBe(200);return {directory,server,host,guest};}

describe('earned account cosmetics',()=>{
  it('awards each verified match once, unlocks all three cosmetic types and preserves choices through restart',async()=>{
    const {host,guest,server,directory}=await setup();expect((await new Client(server.url).request('/api/cosmetics')).status).toBe(401);
    const equipment={banner:'orcs-victory-banner',decoration:null,portrait:null};expect((await host.request('/api/cosmetics/equip',{factionId:'orcs',expectedRevision:0,loadout:equipment})).status).toBe(403);
    let matchId='';
    for(let index=0;index<5;index++){
      const lobby=await host.launch(guest);matchId=lobby.matchId;const loser=await guest.peer(matchId);cleanup.push(async()=>loser.ws.terminate());loser.send(1,{type:'surrender'});expect(await loser.next(message=>message.kind==='commandAck')).toMatchObject({accepted:true});loser.send(1,{type:'surrender'});expect(await loser.next(message=>message.kind==='commandAck')).toMatchObject({accepted:true});loser.send(2,{type:'surrender'});expect(await loser.next(message=>message.kind==='commandAck')).toMatchObject({accepted:false,reason:'ended'});
      const profile=(await host.request('/api/cosmetics')).data.profile;expect(profile.wins).toEqual({orcs:index+1});expect(profile.owned).toHaveLength(index<2?1:index<4?2:3);
    }
    expect((await guest.request('/api/cosmetics')).data.profile.owned).toEqual([]);
    const loadout={banner:'orcs-victory-banner',decoration:'orcs-honor-seal',portrait:'orcs-commander'};
    const db=new DatabaseSync(join(directory,'server.sqlite'),{readOnly:true}),hash=db.prepare('SELECT state_hash FROM matches WHERE id=?').get(matchId)!.state_hash;
    expect(db.prepare('SELECT COUNT(*) n FROM cosmetic_awards').get()!.n).toBe(5);
    const equipped=await host.request('/api/cosmetics/equip',{factionId:'orcs',expectedRevision:0,loadout});expect(equipped.status).toBe(200);expect(equipped.data.equipped).toEqual({factionId:'orcs',revision:1,loadout});
    expect((await host.request('/api/cosmetics/equip',{factionId:'orcs',expectedRevision:0,loadout})).status).toBe(409);
    expect((await host.request('/api/matches/'+matchId+'/cosmetics')).data.players[0]).toEqual({side:0,factionId:'orcs',loadout});
    expect(db.prepare('SELECT state_hash FROM matches WHERE id=?').get(matchId)!.state_hash).toBe(hash);db.close();
    const profile=(await host.request('/api/cosmetics')).data.profile;await server.close();const restarted=await createRtsServer({dataDir:directory,port:0});cleanup.push(()=>restarted.close());host.url=restarted.url;
    expect((await host.request('/api/cosmetics')).data.profile).toEqual(profile);expect((await host.request('/api/cosmetics/equip',{factionId:'orcs',expectedRevision:1,loadout:{banner:null,decoration:null,portrait:null}})).status).toBe(200);expect((await host.request('/api/cosmetics')).data.profile.owned).toHaveLength(3);
  });
  it('rejects wrong factions, wrong slots, unknown IDs and forged award fields',async()=>{
    const {host}=await setup();
    for(const loadout of [{banner:'fairies-victory-banner',decoration:null,portrait:null},{banner:'orcs-honor-seal',decoration:null,portrait:null},{banner:'invented',decoration:null,portrait:null},{banner:[],decoration:null,portrait:null},{banner:null,decoration:null}])expect((await host.request('/api/cosmetics/equip',{factionId:'orcs',expectedRevision:0,loadout})).status).toBe(400);
    expect((await host.request('/api/cosmetics/equip',{factionId:'orcs',expectedRevision:0,loadout:{banner:null,decoration:null,portrait:null},wins:100})).status).toBe(400);
    expect((await host.request('/api/cosmetics/award',{sourceId:'fake',factionId:'orcs',winner:0})).status).toBe(404);
  });
  it('rolls back result, rating and unlock writes together when a cosmetic award cannot persist',async()=>{
    const {host,guest,directory}=await setup(),lobby=await host.launch(guest),loser=await guest.peer(lobby.matchId);cleanup.push(async()=>loser.ws.terminate());const db=new DatabaseSync(join(directory,'server.sqlite'));
    db.exec("CREATE TRIGGER reject_cosmetics BEFORE INSERT ON cosmetic_unlocks BEGIN SELECT RAISE(ABORT,'cosmetic storage rejected'); END;");loser.send(1,{type:'surrender'});expect(await loser.next(message=>message.kind==='error')).toMatchObject({code:'storage-failure'});
    expect(db.prepare('SELECT finished FROM matches WHERE id=?').get(lobby.matchId)!.finished).toBe(0);
    for(const table of ['commands','competition_results','ranked_ratings','cosmetic_awards','cosmetic_wins','cosmetic_unlocks'])expect(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n).toBe(0);db.close();
    expect((await host.request('/api/cosmetics')).data.profile.owned).toEqual([]);
  });
  it('has faction-specific vector assets and resolves only matching equipment slots',()=>{
    expect(COSMETICS).toHaveLength(18);expect(new Set(COSMETICS.map(item=>item.id)).size).toBe(18);
    for(const item of COSMETICS){const svg=cosmeticSvg(item);expect(svg).toContain('<svg');expect(svg).toContain(item.name);expect(svg).not.toContain('<script');}
    expect(resolveCosmeticLoadout('orcs',{banner:'fairies-victory-banner',decoration:'orcs-victory-banner',portrait:null})).toEqual({});
  });
});

describe('canonical campaign reward adapter',()=>{
  const claim={missionId:'finale',recording:{trustedFixture:true}};
  it('requires the trusted verifier and rejects client winner fields before verification',async()=>{
    const unavailable=await setup();expect((await unavailable.host.request('/api/cosmetics/campaign-victory',claim)).status).toBe(503);
    let calls=0;const {host}=await setup({verifyCampaignVictory:()=>{calls++;return {campaignId:'campaign-orcs',missionId:'finale',factionId:'orcs'};}});
    for(const value of [{...claim,winner:0},{...claim,missionId:'../finale'},{missionId:'finale'}])expect((await host.request('/api/cosmetics/campaign-victory',value)).status).toBe(400);
    expect(calls).toBe(0);expect((await host.request('/api/cosmetics')).data.profile.owned).toEqual([]);
  });
  it('does not award rejected recordings, unavailable verification or invalid host metadata',async()=>{
    let result:unknown,error:Error|undefined;
    const {host}=await setup({verifyCampaignVictory:()=>{if(error)throw error;return result as VerifiedCampaignVictory;}});
    for(const value of [undefined,{}, {campaignId:123,missionId:'finale',factionId:'orcs'},{missionId:'finale',factionId:'orcs'},{campaignId:'campaign-orcs',missionId:'other',factionId:'orcs'},{campaignId:'campaign-orcs',missionId:'finale',factionId:'unknown'}]){result=value;expect((await host.request('/api/cosmetics/campaign-victory',claim)).status).toBe(500);}
    error=new Error('Replay is invalid.');expect((await host.request('/api/cosmetics/campaign-victory',claim)).status).toBe(400);
    for(const status of [503,504]){error=new CampaignVerificationError(status,'Verifier is unavailable.');expect((await host.request('/api/cosmetics/campaign-victory',claim)).status).toBe(status);}
    expect((await host.request('/api/cosmetics')).data.profile).toEqual({owned:[],wins:{},equipment:{}});
  });
  it('rolls back a failed campaign reward and permits one durable retry for each account',async()=>{
    const options={verifyCampaignVictory:()=>({campaignId:'campaign-orcs',missionId:'finale',factionId:'orcs' as const})};
    const {host,guest,directory}=await setup(options),db=new DatabaseSync(join(directory,'server.sqlite'));
    try{
      db.exec("CREATE TRIGGER reject_campaign_cosmetics BEFORE INSERT ON cosmetic_unlocks BEGIN SELECT RAISE(ABORT,'campaign reward rejected'); END;");
      expect((await host.request('/api/cosmetics/campaign-victory',claim)).status).toBe(500);
      for(const table of ['cosmetic_awards','cosmetic_wins','cosmetic_unlocks'])expect(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n).toBe(0);
      db.exec('DROP TRIGGER reject_campaign_cosmetics');
      const first=await host.request('/api/cosmetics/campaign-victory',claim);expect(first.status).toBe(200);expect(first.data.profile.wins).toEqual({orcs:1});
      expect((await host.request('/api/cosmetics/campaign-victory',claim)).data.profile).toEqual(first.data.profile);
      expect((await guest.request('/api/cosmetics/campaign-victory',claim)).data.profile.wins).toEqual({orcs:1});
      expect(db.prepare('SELECT COUNT(*) n FROM cosmetic_awards').get()!.n).toBe(2);
    }finally{db.close();}
  });
});
