import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnlineApi, OnlineMatchConnection, OnlineRequestError } from '../src/online/client';
import type { PlayerObservation } from '../src/online/protocol';

class Socket extends EventTarget {
  readyState=1;sent:string[]=[];
  send(value:string){this.sent.push(value);}
  close(code=1000){this.readyState=3;this.dispatchEvent(Object.assign(new Event('close'),{code}));}
  receive(value:unknown){this.dispatchEvent(Object.assign(new Event('message'),{data:JSON.stringify(value)}));}
}
const sockets:Socket[]=[],connections:OnlineMatchConnection[]=[];
afterEach(()=>{for(const connection of connections.splice(0))connection.dispose();sockets.length=0;vi.useRealTimers();vi.restoreAllMocks();});
function setup(role:'player'|'spectator'='player') {
  const api=new OnlineApi({baseUrl:'https://battle.example'});
  vi.spyOn(api,'ticket').mockResolvedValue({ticket:'one-use',protocolVersion:1,role,side:1,delayTicks:role==='spectator'?600:0});
  const onObservation=vi.fn(),onStatus=vi.fn(),onReceipt=vi.fn();
  const connection=new OnlineMatchConnection({api,matchId:'m1',role,onObservation,onStatus,onReceipt,reconnectDelayMs:10,createSocket:url=>{
    expect(url).toBe('wss://battle.example/ws?ticket=one-use');const socket=new Socket();sockets.push(socket);return socket as unknown as WebSocket;
  }});connections.push(connection);return {api,connection,onObservation,onStatus,onReceipt};
}
const hello=(lastClientSeq=0,role:'player'|'spectator'='player')=>({kind:'hello',protocolVersion:1,matchId:'m1',role,side:1,generation:1,lastClientSeq,delayTicks:role==='spectator'?600:0});
const frame=(tick=4,frameSeq=1)=>({kind:'snapshot',matchId:'m1',frameSeq,tick,view:{side:1,tick} as PlayerObservation});

describe('online HTTP client',()=>{
  it('uses cookie authentication, encoded lobby paths and the observed revision',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({lobby:{id:'new'}}),{status:200}));
    const api=new OnlineApi({baseUrl:'https://battle.example/',fetch:fetcher});
    await api.changeLobby({id:'lobby/name',revision:7} as never,'ready',{ready:true,expectedRevision:99});
    expect(fetcher).toHaveBeenCalledWith('https://battle.example/api/lobbies/lobby%2Fname/ready',expect.objectContaining({method:'POST',credentials:'include',body:JSON.stringify({ready:true,expectedRevision:7})}));
  });
  it('preserves server conflict information without repeating a mutation',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({error:'Lobby changed. Refresh its current revision.'}),{status:409}));
    const api=new OnlineApi({fetch:fetcher});
    await expect(api.createLobby({mapSize:'small',factions:['orcs','fairies']})).rejects.toMatchObject({status:409,message:'Lobby changed. Refresh its current revision.'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports failed connections and invalid response bodies',async()=>{
    const api=new OnlineApi({fetch:vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))});
    await expect(api.session()).rejects.toBeInstanceOf(OnlineRequestError);
    const invalid=new OnlineApi({fetch:vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>',{status:502}))});
    await expect(invalid.session()).rejects.toMatchObject({status:502,message:'The online server returned an unreadable response.'});
  });
});

describe('authoritative match connection',()=>{
  it('waits for a server snapshot, reports server receipts, and never predicts a game state',async()=>{
    const {connection,onObservation,onReceipt}=setup();await connection.connect();sockets[0].receive(hello(12));
    await expect(connection.send({type:'stop',ids:[1]})).rejects.toThrow('first server snapshot');
    sockets[0].receive(frame());const command={type:'move' as const,ids:[10],x:5,y:8};const promise=connection.send(command);
    command.ids.push(99);
    expect(JSON.parse(sockets[0].sent[0])).toEqual({kind:'command',protocolVersion:1,clientSeq:13,observedTick:4,command:{type:'move',ids:[10],x:5,y:8}});
    expect(onObservation).toHaveBeenCalledTimes(1);
    const ack={kind:'commandAck',clientSeq:13,appliedTick:5,accepted:false,reason:'ownership'};sockets[0].receive(ack);
    await expect(promise).resolves.toEqual(ack);expect(onReceipt).toHaveBeenCalledWith(ack);expect(connection.pendingCommands).toBe(0);
  });
  it('reconnects with a fresh ticket and resends an unresolved command with its original sequence and tick',async()=>{
    vi.useFakeTimers();const {connection,api}=setup();await connection.connect();sockets[0].receive(hello());sockets[0].receive(frame());
    const promise=connection.send({type:'stop',ids:[10]});const payload=sockets[0].sent[0];sockets[0].close(1006);
    expect(connection.status).toBe('reconnecting');await vi.advanceTimersByTimeAsync(10);
    expect(api.ticket).toHaveBeenCalledTimes(2);sockets[1].receive(hello(1));
    expect(sockets[1].sent).toEqual([payload]);const ack={kind:'commandAck',clientSeq:1,appliedTick:5,accepted:true};sockets[1].receive(ack);await expect(promise).resolves.toEqual(ack);
    sockets[1].receive(frame(8));const next=connection.send({type:'hold',ids:[10]});expect(JSON.parse(sockets[1].sent[1]).clientSeq).toBe(2);
    sockets[1].receive({kind:'commandAck',clientSeq:2,appliedTick:9,accepted:true});await next;
  });
  it('ignores stale frames and prohibits spectator commands',async()=>{
    const {connection,onObservation}=setup('spectator');await connection.connect();sockets[0].receive(hello(0,'spectator'));
    sockets[0].receive(frame(20,5));sockets[0].receive(frame(18,6));sockets[0].receive(frame(20,4));
    expect(onObservation).toHaveBeenCalledTimes(1);expect(connection.latestTick).toBe(20);
    expect(connection.dispatch({type:'stop',ids:[1]})).toBe(false);await expect(connection.send({type:'stop',ids:[1]})).rejects.toThrow('Spectators');expect(sockets[0].sent).toEqual([]);
  });
  it('stops reconnecting when another browser takes control, and can explicitly rejoin',async()=>{
    vi.useFakeTimers();const {connection,api}=setup();await connection.connect();sockets[0].receive(hello());sockets[0].close(4001);
    expect(connection.status).toBe('disconnected');await vi.advanceTimersByTimeAsync(30000);expect(api.ticket).toHaveBeenCalledTimes(1);
    await connection.connect();expect(api.ticket).toHaveBeenCalledTimes(2);
  });
  it('fails closed for snapshots before hello and mismatched protocol versions',async()=>{
    vi.useFakeTimers();const {connection,api,onObservation}=setup();await connection.connect();sockets[0].receive(frame());
    expect(connection.status).toBe('disconnected');expect(onObservation).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(30000);expect(api.ticket).toHaveBeenCalledTimes(1);
    await connection.connect();sockets[1].receive({...hello(),protocolVersion:2});expect(connection.status).toBe('disconnected');
  });
  it('resets an abandoned sequence after takeover and rejects storage failures',async()=>{
    const {connection}=setup();await connection.connect();sockets[0].receive(hello());sockets[0].receive(frame());
    const abandoned=connection.send({type:'stop',ids:[1]});const rejected=expect(abandoned).rejects.toThrow('Another browser');sockets[0].close(4001);await rejected;
    await connection.connect();sockets[1].receive(hello());sockets[1].receive(frame());const pending=connection.send({type:'hold',ids:[1]});
    expect(JSON.parse(sockets[1].sent[0]).clientSeq).toBe(1);const failed=expect(pending).rejects.toThrow('persistence');
    sockets[1].receive({kind:'error',code:'storage-failure',message:'The match paused after a persistence failure.'});await failed;expect(connection.status).toBe('disconnected');
  });
  it('expires missing receipts even when reconnection remains offline',async()=>{
    vi.useFakeTimers();const {connection,api}=setup();await connection.connect();sockets[0].receive(hello());sockets[0].receive(frame());
    const pending=connection.send({type:'stop',ids:[1]});const result=expect(pending).rejects.toThrow('could not confirm');
    vi.mocked(api.ticket).mockRejectedValue(new OnlineRequestError(0,'Could not reach the online server.'));
    await vi.advanceTimersByTimeAsync(60000);await result;expect(connection.pendingCommands).toBe(0);expect(connection.status).toBe('disconnected');
  });
  it('keeps initial connection readiness pending until a usable server snapshot arrives',async()=>{
    const {connection}=setup();await connection.connect();const first=connection.waitForSnapshot();sockets[0].receive(hello());
    sockets[0].receive(frame());await expect(first).resolves.toMatchObject({side:1,tick:4});
    await expect(connection.waitForSnapshot()).resolves.toMatchObject({side:1,tick:4});
  });
});
