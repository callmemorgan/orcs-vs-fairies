import type { Side } from '../core/types';
import { PROTOCOL_VERSION } from './protocol';
import type { Account, CommandAck, CommandMessage, LobbyObservation, LobbySettings, OnlineCommand,PlayerObservation, ServerMessage } from './protocol';

export class OnlineRequestError extends Error {
  constructor(readonly status:number,message:string){super(message);this.name='OnlineRequestError';}
}
export interface MatchTicket { ticket:string; protocolVersion:number; role:'player'|'spectator'; side:Side; delayTicks:number }
export type OnlineInput=OnlineCommand;
export interface OnlineApiOptions { baseUrl?:string; fetch?:typeof fetch; timeoutMs?:number }

/** Cookies remain HttpOnly. Nothing in the client stores passwords or session tokens. */
export class OnlineApi {
  readonly baseUrl:string;
  private fetcher:typeof fetch;
  private timeoutMs:number;
  constructor(options:OnlineApiOptions={}) {
    this.baseUrl=(options.baseUrl??globalThis.location?.origin??'http://localhost').replace(/\/$/,'');
    this.fetcher=options.fetch??globalThis.fetch.bind(globalThis);this.timeoutMs=options.timeoutMs??10000;
  }
  protected async request<T>(path:string,body?:unknown,timeoutMs=this.timeoutMs):Promise<T> {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await this.fetcher(`${this.baseUrl}${path}`,{
        method:body===undefined?'GET':'POST',credentials:'include',cache:'no-store',signal:controller.signal,
        ...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
      });
      let value:unknown;
      try {value=await response.json();}catch {throw new OnlineRequestError(response.status,'The online server returned an unreadable response.');}
      if(!response.ok)throw new OnlineRequestError(response.status,
        value&&typeof value==='object'&&'error' in value&&typeof value.error==='string'?value.error:`Online request failed (${response.status}).`);
      return value as T;
    }catch(error) {
      if(controller.signal.aborted)throw new OnlineRequestError(0,'The online server did not respond in time.');
      if(error instanceof OnlineRequestError)throw error;
      throw new OnlineRequestError(0,'Could not reach the online server.');
    }finally {clearTimeout(timer);}
  }
  async session(){return (await this.request<{account:Account|null}>('/api/session')).account;}
  async login(username:string,password:string){return (await this.request<{account:Account}>('/api/auth/login',{username,password})).account;}
  async register(username:string,password:string){return (await this.request<{account:Account}>('/api/auth/register',{username,password})).account;}
  async guest(){return (await this.request<{account:Account}>('/api/auth/guest',{})).account;}
  async logout(){await this.request('/api/auth/logout',{});}
  async lobbies(){return (await this.request<{lobbies:LobbyObservation[]}>('/api/lobbies')).lobbies;}
  async lobby(id:string){return (await this.request<{lobby:LobbyObservation}>(`/api/lobbies/${encodeURIComponent(id)}`)).lobby;}
  async createLobby(settings:LobbySettings,seed?:number) {
    return (await this.request<{lobby:LobbyObservation}>('/api/lobbies',{settings,...(seed===undefined?{}:{seed})})).lobby;
  }
  async changeLobby(lobby:LobbyObservation,action:'join'|'leave'|'ready'|'settings'|'start'|'draft',value:Record<string,unknown>={}) {
    return (await this.request<{lobby:LobbyObservation}>(`/api/lobbies/${encodeURIComponent(lobby.id)}/${action}`,{...value,expectedRevision:lobby.revision})).lobby;
  }
  async ticket(matchId:string,role:'player'|'spectator',perspective?:Side,view?:'player'|'team') {
    return this.request<MatchTicket>(`/api/matches/${encodeURIComponent(matchId)}/ticket`,{role,...(perspective===undefined?{}:{perspective}),...(view===undefined?{}:{view})});
  }
  socketUrl(ticket:string){const url=new URL('/ws',this.baseUrl);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('ticket',ticket);return url.href;}
}

export type MatchConnectionStatus='connecting'|'connected'|'reconnecting'|'disconnected'|'closed';
export interface MatchConnectionInfo {
  matchId:string;role:'player'|'spectator';side:Side;delayTicks:number;generation:number;
}
export interface MatchConnectionCallbacks {
  onObservation:(view:PlayerObservation,tick:number)=>void;
  onStatus?:(status:MatchConnectionStatus,message:string)=>void;
  onHello?:(info:MatchConnectionInfo)=>void;
  onReceipt?:(receipt:CommandAck)=>void;
  onNotice?:(message:string)=>void;
  onWaiting?:(availableAtTick:number,currentTick:number)=>void;
}
export interface MatchConnectionOptions extends MatchConnectionCallbacks {
  api:OnlineApi;matchId:string;role:'player'|'spectator';perspective?:Side;view?:'player'|'team';
  createSocket?:(url:string)=>WebSocket;reconnectDelayMs?:number;receiptTimeoutMs?:number;
}
type WireCommandMessage=CommandMessage;
interface PendingCommand { message:WireCommandMessage;createdAt:number;resolve:(receipt:CommandAck)=>void;reject:(error:Error)=>void }

/** Authoritative snapshots replace the display. Accepted receipts never mutate it locally. */
export class OnlineMatchConnection {
  readonly matchId:string;
  private options:MatchConnectionOptions;
  private socket:WebSocket|undefined;
  private pending=new Map<number,PendingCommand>();
  private nextSeq=1;
  private tick=-1;
  private frameSeq=-1;
  private retries=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private helloTimer:ReturnType<typeof setTimeout>|undefined;
  private receiptTimer:ReturnType<typeof setTimeout>|undefined;
  private pendingDeadline:ReturnType<typeof setTimeout>|undefined;
  private disposed=false;
  private terminal=false;
  private generation=0;
  private _status:MatchConnectionStatus='disconnected';
  private info:MatchConnectionInfo|undefined;
  private lastView:PlayerObservation|undefined;
  private snapshotWaiters=new Set<{resolve:(view:PlayerObservation)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(options:MatchConnectionOptions){this.options=options;this.matchId=options.matchId;}
  get status(){return this._status;}
  get connected(){return this._status==='connected';}
  get latestTick(){return this.tick;}
  get connectionInfo(){return this.info;}
  get pendingCommands(){return this.pending.size;}
  private statusChange(status:MatchConnectionStatus,message:string){this._status=status;this.options.onStatus?.(status,message);}
  async connect():Promise<void> {
    if(this.disposed||this._status==='connecting'||this.connected)return;
    this.terminal=false;
    if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
    const attempt=++this.generation;
    this.statusChange(this.retries?'reconnecting':'connecting',this.retries?'Reconnecting to the match…':'Connecting to the match…');
    try {
      const ticket=await this.options.api.ticket(this.matchId,this.options.role,this.options.perspective,this.options.view);
      if(this.disposed||attempt!==this.generation)return;
      if(ticket.protocolVersion!==PROTOCOL_VERSION)throw new Error('The online server uses an unsupported protocol version.');
      const socket=this.options.createSocket?.(this.options.api.socketUrl(ticket.ticket))??new WebSocket(this.options.api.socketUrl(ticket.ticket));
      this.socket=socket;this.frameSeq=-1;this.lastView=undefined;
      this.helloTimer=setTimeout(()=>{if(this.socket===socket&&!this.connected)socket.close(4000,'Handshake timeout');},10000);
      socket.addEventListener('message',event=>{if(this.socket===socket&&!this.disposed)this.message(event.data,socket);});
      socket.addEventListener('close',event=>{
        if(this.socket!==socket||this.disposed)return;
        this.clearHelloTimer();this.clearReceiptTimer();this.socket=undefined;
        if(event.code===4001){this.stop('Another browser took control of this player. Rejoin to take control again.');return;}
        this.scheduleReconnect('Connection lost. Orders are waiting for server receipts.');
      });
      socket.addEventListener('error',()=>{if(this.socket===socket&&!this.disposed)this.options.onNotice?.('The match connection encountered a network error.');});
    }catch(error) {
      if(this.disposed||attempt!==this.generation)return;
      const message=error instanceof Error?error.message:'Match connection failed.';
      if(error instanceof OnlineRequestError&&(error.status===401||error.status===403||error.status===404))this.stop(message);
      else if(message.includes('unsupported protocol'))this.stop(message);
      else this.scheduleReconnect(message);
    }
  }
  private clearHelloTimer(){if(this.helloTimer)clearTimeout(this.helloTimer);this.helloTimer=undefined;}
  private clearReceiptTimer(){if(this.receiptTimer)clearTimeout(this.receiptTimer);this.receiptTimer=undefined;}
  private watchDeadline(){
    if(this.pendingDeadline)clearTimeout(this.pendingDeadline);this.pendingDeadline=undefined;
    if(!this.pending.size)return;
    const deadline=Math.min(...Array.from(this.pending.values(),item=>item.createdAt))+60000;
    this.pendingDeadline=setTimeout(()=>{
      this.pendingDeadline=undefined;this.stop('The server could not confirm an order. Rejoin the match before issuing more orders.');this.socket?.close(4000,'Receipt deadline');
    },Math.max(0,deadline-Date.now()));
  }
  private watchReceipts(){
    this.clearReceiptTimer();if(!this.pending.size||!this.connected)return;
    const age=Date.now()-Math.min(...Array.from(this.pending.values(),item=>item.createdAt));
    if(age>=60000){this.stop('The server could not confirm an order. Rejoin the match before issuing more orders.');this.socket?.close(4000,'Receipt deadline');return;}
    this.receiptTimer=setTimeout(()=>{
      this.receiptTimer=undefined;
      this.socket?.close(4000,'Receipt timeout');
    },Math.min(this.options.receiptTimeoutMs??15000,60000-age));
  }
  private scheduleReconnect(message:string){
    if(this.disposed||this.terminal)return;
    this.statusChange('reconnecting',message);
    const wait=Math.min(8000,(this.options.reconnectDelayMs??500)*2**Math.min(this.retries++,4));
    if(this.timer)clearTimeout(this.timer);
    this.timer=setTimeout(()=>{this.timer=undefined;void this.connect();},wait);
  }
  private message(raw:unknown,socket:WebSocket) {
    let message:ServerMessage;
    try {if(typeof raw!=='string'||raw.length>8*1024*1024)throw new Error();message=JSON.parse(raw) as ServerMessage;
      if(!message||typeof message!=='object'||typeof message.kind!=='string')throw new Error();
    }catch {this.stop('The server sent an invalid match message.');socket.close(4002,'Invalid message');return;}
    if(message.kind==='hello') {
      if(message.protocolVersion!==PROTOCOL_VERSION||message.matchId!==this.matchId||message.role!==this.options.role||!Number.isSafeInteger(message.lastClientSeq)||message.lastClientSeq<0) {
        this.stop('The server sent an incompatible match handshake.');socket.close(4002,'Invalid handshake');return;
      }
      this.clearHelloTimer();this.nextSeq=Math.max(message.lastClientSeq,...this.pending.keys())+1;
      this.info={matchId:this.matchId,role:message.role,side:message.side,delayTicks:message.delayTicks,generation:message.generation};
      this.retries=0;this.statusChange('connected',message.role==='spectator'?`Spectating with a ${message.delayTicks/20}-second delay.`:'Connected to the match.');
      this.options.onHello?.(this.info);
      // An unacknowledged command keeps its original observed tick and sequence.
      // The server returns its stored receipt rather than applying it twice.
      for(const item of this.pending.values())socket.send(JSON.stringify(item.message));
      this.watchReceipts();
      return;
    }
    if(!this.connected){this.stop('The server sent a match frame before its handshake.');socket.close(4002,'Missing handshake');return;}
    if(message.kind==='snapshot') {
      if(message.matchId!==this.matchId||!Number.isSafeInteger(message.frameSeq)||!Number.isSafeInteger(message.tick)||message.tick<0||!message.view||message.view.tick!==message.tick||message.view.side!==this.info?.side){this.stop('The server sent an invalid match frame.');socket.close(4002,'Invalid snapshot');return;}
      if(message.frameSeq<=this.frameSeq||message.tick<this.tick)return;
      this.frameSeq=message.frameSeq;this.tick=message.tick;this.lastView=message.view;this.options.onObservation(message.view,message.tick);
      for(const waiter of this.snapshotWaiters){clearTimeout(waiter.timer);waiter.resolve(message.view);}this.snapshotWaiters.clear();
    }else if(message.kind==='commandAck') {
      const item=this.pending.get(message.clientSeq);if(!item)return;
      this.pending.delete(message.clientSeq);item.resolve(message);this.watchDeadline();this.watchReceipts();this.options.onReceipt?.(message);
      if(!message.accepted)this.options.onNotice?.(`Order rejected by the server: ${message.reason??'unavailable'}.`);
    }else if(message.kind==='waiting')this.options.onWaiting?.(message.availableAtTick,message.currentTick);
    else if(message.kind==='error'){
      this.options.onNotice?.(message.message);this.stop(message.message);socket.close(4002,message.code.slice(0,100));
    }
  }
  send(command:OnlineInput):Promise<CommandAck> {
    if(!this.connected||this.socket?.readyState!==1)return Promise.reject(new Error('Wait for the match connection before issuing orders.'));
    if(this.options.role==='spectator')return Promise.reject(new Error('Spectators cannot issue orders.'));
    if(this.tick<0)return Promise.reject(new Error('Wait for the first server snapshot before issuing orders.'));
    if(this.pending.size>=64)return Promise.reject(new Error('Too many orders are waiting for server receipts.'));
    // Snapshot the payload so selection mutations cannot change retransmission.
    const message:WireCommandMessage={kind:'command',protocolVersion:PROTOCOL_VERSION,clientSeq:this.nextSeq++,observedTick:this.tick,command:structuredClone(command)};
    return new Promise((resolve,reject)=>{
      this.pending.set(message.clientSeq,{message,createdAt:Date.now(),resolve,reject});
      this.watchDeadline();
      try {this.socket!.send(JSON.stringify(message));this.watchReceipts();}
      catch {this.socket?.close();this.scheduleReconnect('The order is waiting for reconnection.');}
    });
  }
  /** Keep the current local match until the server has delivered a usable frame. */
  waitForSnapshot(timeoutMs=15000):Promise<PlayerObservation> {
    if(this.connected&&this.lastView)return Promise.resolve(this.lastView);
    if(this.disposed||this.terminal)return Promise.reject(new Error('The online match is disconnected.'));
    return new Promise((resolve,reject)=>{
      const waiter={resolve,reject,timer:setTimeout(()=>{this.snapshotWaiters.delete(waiter);reject(new Error('No server snapshot arrived. The current match has been kept.'));},timeoutMs)};
      this.snapshotWaiters.add(waiter);
    });
  }
  /** GameScene's synchronous command callback reports dispatch; receipts report acceptance. */
  dispatch(command:OnlineInput):boolean {
    if(!this.connected||this.options.role==='spectator'||this.tick<0||this.pending.size>=64)return false;
    void this.send(command).catch(error=>this.options.onNotice?.(error instanceof Error?error.message:'The order could not be sent.'));
    return true;
  }
  private stop(message:string){
    this.terminal=true;
    this.clearHelloTimer();this.clearReceiptTimer();if(this.timer)clearTimeout(this.timer);this.timer=undefined;
    if(this.pendingDeadline)clearTimeout(this.pendingDeadline);this.pendingDeadline=undefined;
    this.statusChange('disconnected',message);
    for(const item of this.pending.values())item.reject(new Error(message));this.pending.clear();
    for(const waiter of this.snapshotWaiters){clearTimeout(waiter.timer);waiter.reject(new Error(message));}this.snapshotWaiters.clear();
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.generation++;this.stop('Left the online match.');
    const socket=this.socket;this.socket=undefined;socket?.close(1000,'Client left');this.statusChange('closed','Left the online match.');
  }
}
