import { normalizeMatchRules, createDraft, applyDraftChoice, legalDraftChoices, validateDraftState } from '../core/match-rules';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { isIP } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { FACTIONS } from '../core/content';
import { isPlayerCommand, validateCommand } from '../core/commands';
import { createMatch, isGameOver, issueCommand, stepGame, playerSides } from '../core/simulation';
import type { GameState, Side, MatchConfig as CoreMatchConfig, MatchPlayerConfig, Cost } from '../core/types';
import { PROTOCOL_VERSION, TICK_RATE } from '../online/protocol';
import type { Account, CommandAck, LobbyObservation, LobbySettings, LobbyPlayerSettings, LobbySeat, ServerMessage, PlayerObservation } from '../online/protocol';
import { ServerStore, type StoredLobby, type StoredCommand, type StoredFrame } from './store';
import { OnlineView } from './views';
import { teamObservation } from './team-view';
import { createTournamentService } from '../tournament/service';
import { createCommunityHttp } from './community-http';
import { CommunityPackageError } from './community-packages';

const scrypt=promisify(scryptCallback);
const SESSION_LIFETIME=7*24*60*60*1000;
const MAX_BODY_BYTES=64*1024;
const MAP_SIZES=['small','medium','large','huge'];
function jsonHash(value:unknown):string {
  // Iteration permits bounded wire JSON with deep nesting without recursive stack overflow.
  const hash=createHash('sha256'),tasks:Array<{value?:unknown;text?:string}>=[{value}];
  while(tasks.length){
    const task=tasks.pop()!;if(task.text!==undefined){hash.update(task.text);continue;}
    const item=task.value;
    if(Array.isArray(item)){hash.update(`a:${item.length}:`);for(let i=item.length-1;i>=0;i--)tasks.push({value:item[i]});}
    else if(item&&typeof item==='object'){
      const names=Object.keys(item).sort();hash.update(`o:${names.length}:`);
      for(let i=names.length-1;i>=0;i--){tasks.push({value:(item as Record<string,unknown>)[names[i]]});tasks.push({text:`k:${JSON.stringify(names[i])}:`});}
    }else hash.update(`${typeof item}:${JSON.stringify(item)??'undefined'}:`);
  }
  return hash.digest('hex');
}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,allowed:string[]){return Object.keys(value).every(key=>allowed.includes(key));}
function integer(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number{return Number.isSafeInteger(value)&&(value as number)>=min&&(value as number)<=max;}
function compatibilityFingerprint(){
  const hash=createHash('sha256'),ownFile=fileURLToPath(import.meta.url),coreDirectory=resolve(ownFile,'../../core');
  if(existsSync(coreDirectory)){
    for(const directory of [coreDirectory,resolve(ownFile,'..')])for(const filename of readdirSync(directory).filter(filename=>filename.endsWith('.ts')).sort())hash.update(`${directory.endsWith('core')?'core':'server'}/${filename}`).update(readFileSync(resolve(directory,filename)));
    hash.update(readFileSync(resolve(ownFile,'../../online/protocol.ts')));
  }else hash.update(readFileSync(ownFile)); // Production bundle contains the complete core and server.
  return hash.digest('hex');
}
class HttpError extends Error {constructor(readonly status:number,message:string){super(message);}}
interface Ticket {account:Account;matchId:string;role:'player'|'spectator';side:Side;expires:number;perspective:'player'|'team'}
interface Peer extends Ticket {socket:WebSocket;generation:number;lastFrameTick:number;messages:number;rateAt:number}
interface Pending {side:Side;clientSeq:number;payload:string;command:unknown;socket:WebSocket;generation:number}
function isSurrender(value:unknown):value is {type:'surrender'}{return record(value)&&keys(value,['type'])&&value.type==='surrender';}
function applyInput(state:GameState,side:Side,command:unknown):boolean {
  if(isSurrender(command)){
    if(isGameOver(state)||!state.players[side]||state.eliminated[side])return false;
    const units=state.entities.filter(entity=>entity.side===side&&entity.hp>0&&entity.kind==='unit'&&!entity.illusion);
    // Stop through the core so its route, return-trip and queued-gather state is cleared.
    if(units.length)issueCommand(state,side,{type:'stop',ids:units.map(entity=>entity.id)});
    for(const entity of state.entities)if(entity.side===side&&entity.hp>0){entity.hp=0;entity.animation='death';entity.animTime=0;entity.order={type:'idle'};delete entity.orderQueue;entity.path=[];}
    return true;
  }
  return validateCommand(command)&&issueCommand(state,side,command);
}
interface ActiveMatch {
  id:string;lobbyId:string;state:GameState;views:OnlineView[];frames:StoredFrame[];
  generations:number[];pending:Pending[];receipts:Map<string,StoredCommand>;
  peers:Set<Peer>;lastSeq:number[];failed:boolean;finishedAt?:number;
  eventBuffers:Array<PlayerObservation['events']>;
}
export interface ServerOptions {
  host?:string;port?:number;dataDir:string;staticDir?:string;origin?:string;
  secureCookie?:boolean;spectatorDelaySeconds?:number;
  trustProxy?:boolean;
  /** Configurations are supplied by the server operator, never by an HTTP request. */
  tournaments?:{cwd:string;configs:unknown[];outputRoot?:string};
}

/** Independent clients send inputs; only this process owns and advances GameState. */
export async function createRtsServer(options:ServerOptions){
  const host=options.host??'127.0.0.1',port=options.port??8787;
  const delaySeconds=options.spectatorDelaySeconds??30;
  if(!Number.isFinite(delaySeconds)||delaySeconds<0||delaySeconds>120)throw new Error('Spectator delay must be from 0 to 120 seconds.');
  const delayTicks=Math.ceil(delaySeconds*TICK_RATE);
  const externalOrigin=options.origin?.trim()||undefined;
  if(externalOrigin){const parsed=new URL(externalOrigin);if(parsed.origin!==externalOrigin||!['http:','https:'].includes(parsed.protocol))throw new Error('RTS_ORIGIN must be an exact HTTP(S) origin without a trailing slash.');}
  const store=new ServerStore(options.dataDir,compatibilityFingerprint());
  const communityHttp=createCommunityHttp(store.db);
  const lobbies=new Map<string,StoredLobby>(store.lobbies().map(lobby=>{const normalized=settings(lobby.settings),draft=lobby.draft?validateDraftState(lobby.draft,normalized.players!.map((p,id)=>({...p,id:id as Side})),normalizeMatchRules(normalized.rules)):createDraft(normalized.players!.map((p,id)=>({...p,id:id as Side})),normalizeMatchRules(normalized.rules));return [lobby.id,{...lobby,draft,settings:normalized,seats:roster(normalized,lobby.seats,undefined,false)}];}));
  const matches=new Map<string,ActiveMatch>();
  const tickets=new Map<string,Ticket>();
  const attempts=new Map<string,{count:number;at:number}>();
  let closing=false;

  try{for(const saved of store.matches()){
    if(saved.engineHash!==store.engineHash)throw new Error(`Stored match ${saved.id} needs its original compatible server build. Keep its data and deploy that build.`);
    const state=store.restore(saved),sides=playerSides(state),views=sides.map(side=>new OnlineView(side,saved.memory[side]));
    const receipts=new Map<string,StoredCommand>(),lastSeq=sides.map(()=>0);
    const records=store.commands(saved.id);
    for(const entry of records){receipts.set(`${entry.side}:${entry.clientSeq}`,entry);lastSeq[entry.side]=Math.max(lastSeq[entry.side],entry.clientSeq);}
    const pendingReplay=records.filter(entry=>entry.appliedTick>saved.checkpointTick);
    let cursor=0;const eventBuffers:Array<PlayerObservation['events']>=sides.map(()=>[]);
    while(state.tick<saved.tick){
      const targetTick=state.tick+1;
      while(cursor<pendingReplay.length&&pendingReplay[cursor].appliedTick===targetTick){
        const entry=pendingReplay[cursor++];
        if(entry.ack.accepted&&!applyInput(state,entry.side,entry.command))throw new Error(`Stored match ${saved.id} diverged at tick ${targetTick}.`);
      }
      stepGame(state,1/TICK_RATE);views.forEach((view,side)=>eventBuffers[side].push(...view.observe(state).events));
      if(state.tick%4===0)eventBuffers.forEach(events=>{events.length=0;});
      if(isGameOver(state)&&state.tick<saved.tick)throw new Error(`Stored match ${saved.id} ended before its journal.`);
    }
    store.verifyRecovery(saved,state,views.map(view=>view.snapshot()));
    matches.set(saved.id,{id:saved.id,lobbyId:saved.lobbyId,state,views,frames:store.frames(saved.id,Math.max(0,state.tick-delayTicks-80)),generations:saved.generation,pending:[],receipts,lastSeq,peers:new Set(),eventBuffers,failed:false,finishedAt:saved.finished?Date.now():undefined});
  }}catch(error){store.close();throw error;}

  function publicLobby(lobby:StoredLobby):LobbyObservation{
    return {id:lobby.id,hostId:lobby.hostId,revision:lobby.revision,settings:lobby.settings,seats:lobby.seats,matchId:lobby.matchId,draft:lobby.draft?{...structuredClone(lobby.draft),remainingTicks:lobby.draftDeadlineAt?Math.max(1,Math.ceil((lobby.draftDeadlineAt-Date.now())/(1000/TICK_RATE))):lobby.draft.remainingTicks}:undefined};
  }
  function send(socket:WebSocket,message:ServerMessage){
    if(socket.readyState===WebSocket.OPEN){
      if(socket.bufferedAmount>4*1024*1024){socket.close(4008,'Slow consumer');return;}
      socket.send(JSON.stringify(message));
    }
  }
  function fail(socket:WebSocket,code:string,message:string){send(socket,{kind:'error',code,message});}
  function session(req:IncomingMessage):Account|undefined {
    const cookie=req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('ovf_session='))?.slice('ovf_session='.length);
    if(!cookie||!/^[a-f0-9]{64}$/.test(cookie))return undefined;
    return store.session(createHash('sha256').update(cookie).digest('hex'),Date.now());
  }
  function account(req:IncomingMessage){const result=session(req);if(!result)throw new HttpError(401,'Sign in first.');return result;}
  function allowedOrigin(req:IncomingMessage):boolean {
    if(!req.headers.origin)return true;
    const expected=externalOrigin??`http://${req.headers.host}`;
    return req.headers.origin===expected;
  }
  function respond(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
  async function body(req:IncomingMessage,maximumBytes=MAX_BODY_BYTES):Promise<Record<string,unknown>> {
    if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new HttpError(415,'Use application/json.');
    let bytes=0;const chunks:Buffer[]=[];
    for await(const part of req){const chunk=Buffer.from(part);bytes+=chunk.length;if(bytes>maximumBytes)throw new HttpError(413,'Request too large.');chunks.push(chunk);}
    let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'Invalid JSON.');}
    if(!record(value))throw new HttpError(400,'Expected an object.');return value;
  }
  function setSession(res:ServerResponse,user:Account){
    const token=randomBytes(32).toString('hex');store.addSession(createHash('sha256').update(token).digest('hex'),user.id,Date.now()+SESSION_LIFETIME);
    res.setHeader('Set-Cookie',`ovf_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_LIFETIME/1000}${options.secureCookie?'; Secure':''}`);
  }
  function credentials(value:Record<string,unknown>){
    if(!keys(value,['username','password'])||typeof value.username!=='string'||!/^[-_a-zA-Z0-9]{3,32}$/.test(value.username)||typeof value.password!=='string'||value.password.length<8||value.password.length>128)throw new HttpError(400,'Username must be 3–32 letters, digits, underscores or hyphens; password must be 8–128 characters.');
    return {username:value.username,password:value.password};
  }
  function authLimit(req:IncomingMessage){
    const address=req.socket.remoteAddress??'unknown';
    const forwarded=typeof req.headers['x-forwarded-for']==='string'?req.headers['x-forwarded-for'].split(',').at(-1)?.trim():undefined;
    const key=options.trustProxy&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)&&forwarded&&isIP(forwarded)?forwarded:address;
    const now=Date.now();let entry=attempts.get(key);
    if(!entry||now-entry.at>60000){entry={count:0,at:now};attempts.set(key,entry);}
    if(++entry.count>30)throw new HttpError(429,'Too many sign-in attempts. Try again in a minute.');
  }
  function settings(value:unknown):LobbySettings{
    if(!record(value)||!keys(value,['mapSize','factions','players','sharedVision','startingAge','rules'])||!MAP_SIZES.includes(value.mapSize as string))throw new HttpError(400,'Expected a supported map size and player roster.');
    const knownFaction=(id:unknown)=>typeof id==='string'&&Object.hasOwn(FACTIONS,id);
    let players:LobbyPlayerSettings[];
    if(value.players!==undefined){
      if(!Array.isArray(value.players)||value.players.length<2||value.players.length>8)throw new HttpError(400,'A lobby needs 2–8 player slots.');
      players=value.players.map(player=>{
        if(!record(player)||!keys(player,['factionId','teamId','controller','handicap'])||!knownFaction(player.factionId)||!integer(player.teamId,0,7)||!['human','ai'].includes(player.controller as string))throw new HttpError(400,'Each slot needs a known faction, team 0–7 and human/AI controller.');
        let handicap:MatchPlayerConfig['handicap'];
        if(player.handicap!==undefined){
          const h=player.handicap;if(!record(h)||!keys(h,['startingResources','incomeFactor','populationCap']))throw new HttpError(400,'Invalid handicap.');
          handicap={};
          if(h.startingResources!==undefined){const r=h.startingResources;if(!record(r)||!keys(r,['wood','ore','crystal'])||!['wood','ore','crystal'].every(key=>typeof r[key]==='number'&&Number.isFinite(r[key])&&(r[key] as number)>=0&&(r[key] as number)<=1e9))throw new HttpError(400,'Starting resources must specify finite wood, ore and crystal amounts.');handicap.startingResources={wood:r.wood,ore:r.ore,crystal:r.crystal} as Cost;}
          if(h.incomeFactor!==undefined){if(typeof h.incomeFactor!=='number'||!Number.isFinite(h.incomeFactor)||h.incomeFactor<0||h.incomeFactor>10)throw new HttpError(400,'Income factor must be 0–10.');handicap.incomeFactor=h.incomeFactor;}
          if(h.populationCap!==undefined){if(!integer(h.populationCap,1,500))throw new HttpError(400,'Population cap must be 1–500.');handicap.populationCap=h.populationCap;}
        }
        return {factionId:player.factionId as LobbyPlayerSettings['factionId'],teamId:player.teamId as Side,controller:player.controller as 'human'|'ai',...(handicap?{handicap}:{})};
      });
      if(value.factions!==undefined&&(!Array.isArray(value.factions)||value.factions.length!==players.length||value.factions.some((id,index)=>id!==players[index].factionId)))throw new HttpError(400,'Faction list must match the player roster.');
    }else{
      if(!Array.isArray(value.factions)||value.factions.length<2||value.factions.length>8||!value.factions.every(knownFaction))throw new HttpError(400,'Expected 2–8 known factions.');
      players=value.factions.map((factionId,index)=>({factionId:factionId as LobbyPlayerSettings['factionId'],teamId:index as Side,controller:'human'}));
    }
    if(!players.some(player=>player.controller==='human')||new Set(players.map(player=>player.teamId)).size<2)throw new HttpError(400,'A match needs a human slot and at least two teams.');
    if(value.sharedVision!==undefined&&typeof value.sharedVision!=='boolean')throw new HttpError(400,'Shared vision must be boolean.');
    if(value.startingAge!==undefined&&!integer(value.startingAge,1,3))throw new HttpError(400,'Starting age must be 1–3.');
    if(value.rules!==undefined&&!record(value.rules))throw new HttpError(400,'Match rules must be an object.');
    let rules:ReturnType<typeof normalizeMatchRules>;try{rules=normalizeMatchRules({...((value.rules??{}) as object),...(value.startingAge===undefined?{}:{startingAge:value.startingAge}),...(value.sharedVision===undefined?{}:{sharedVision:value.sharedVision})});if(rules.mode==='scenario')throw new Error('Launch authored scenarios from the scenario menu.');if(rules.mode==='survival'&&(!players.some(p=>p.teamId===rules.survival.defenderTeam)||new Set(players.map(p=>p.teamId)).size!==2))throw new Error('Survival requires a defender team and one opposing wave team.');createDraft(players.map((p,id)=>({...p,id:id as Side})),rules);createMatch({map:{seed:0,size:value.mapSize as CoreMatchConfig['map']['size']},players:players.map((p,id)=>({...p,id:id as Side})),rules});}catch(error){throw new HttpError(400,error instanceof Error?error.message:'Invalid match rules.');}
    return {rules,mapSize:value.mapSize as LobbySettings['mapSize'],factions:players.map(player=>player.factionId),players,sharedVision:rules.sharedVision,startingAge:rules.startingAge};
  }
  function roster(config:LobbySettings,previous:LobbySeat[]=[],creator?:Account,resetReadiness=true):LobbySeat[]{
    const members=previous.flatMap(seat=>seat.account?[seat.account]:[]);if(creator&&!members.some(member=>member.id===creator.id))members.push(creator);
    if(config.players!.filter(player=>player.controller==='human').length<members.length)throw new HttpError(409,'The new roster has too few human slots for present participants.');
    const assigned=new Set<string>();
    const seats=config.players!.map((player,index)=>{const former=previous[index]?.account;const account=player.controller==='human'&&former&&!assigned.has(former.id)?former:null;if(account)assigned.add(account.id);return {side:index as Side,account,ready:false,...player};});
    for(const member of members)if(!assigned.has(member.id)){const empty=seats.find(seat=>seat.controller==='human'&&!seat.account)!;empty.account=member;assigned.add(member.id);}
    if(!resetReadiness)for(const seat of seats)seat.ready=seat.controller==='human'&&!!seat.account&&!!previous.find(former=>former.account?.id===seat.account!.id)?.ready;
    return seats;
  }
  function matchConfig(lobby:StoredLobby):CoreMatchConfig{return {schemaVersion:1,map:{seed:lobby.seed,size:lobby.settings.mapSize},players:lobby.settings.players!.map((player,index)=>({id:index as Side,teamId:player.teamId,factionId:player.factionId,controller:player.controller==='human'?'external':'ai',handicap:player.handicap})),rules:lobby.settings.rules,draft:lobby.draft};}
  function getLobby(id:string){const result=lobbies.get(id);if(!result)throw new HttpError(404,'Lobby not found.');return result;}
  function editLobby(lobby:StoredLobby,value:Record<string,unknown>){if(value.expectedRevision!==lobby.revision)throw new HttpError(409,'Lobby changed. Refresh its current revision.');if(lobby.matchId)throw new HttpError(409,'The match has started.');}
  function resetDraft(lobby:StoredLobby){lobby.draft=createDraft(lobby.settings.players!.map((p,id)=>({...p,id:id as Side})),normalizeMatchRules(lobby.settings.rules));delete lobby.draftDeadlineAt;if(!lobby.seats.some(seat=>seat.controller==='human'&&!seat.account)&&lobby.draft.status==='drafting')lobby.draftDeadlineAt=Date.now()+lobby.draft.remainingTicks*1000/TICK_RATE;}
  function changed(lobby:StoredLobby){lobby.revision++;store.saveLobby(lobby);lobbies.set(lobby.id,lobby);}
  function matchSummary(match:ActiveMatch){return {id:match.id,lobbyId:match.lobbyId,tick:match.state.tick,finished:isGameOver(match.state),failed:match.failed};}
  const tournaments=options.tournaments?createTournamentService({cwd:options.tournaments.cwd,configs:options.tournaments.configs,outputRoot:options.tournaments.outputRoot??resolve(options.dataDir,'tournaments'),authorize:req=>!!session(req),principal:req=>session(req)?.id}):undefined;

  async function route(req:IncomingMessage,res:ServerResponse){
    const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`),path=url.pathname;
    if(req.method!=='GET'&&!allowedOrigin(req))throw new HttpError(403,'Origin is not allowed.');
    if(req.method==='GET'&&path==='/api/health'){respond(res,200,{ok:!closing,protocolVersion:PROTOCOL_VERSION,tickRate:TICK_RATE,activeMatches:[...matches.values()].filter(match=>!isGameOver(match.state)&&!match.failed).length});return;}
    if(req.method==='GET'&&path==='/api/session'){respond(res,200,{account:session(req)??null});return;}
    if(req.method==='POST'&&path==='/api/auth/guest'){
      authLimit(req);const value=await body(req);
      if(!keys(value,['username'])||(value.username!==undefined&&(typeof value.username!=='string'||!/^[-_a-zA-Z0-9]{3,24}$/.test(value.username))))throw new HttpError(400,'Guest name must be 3–24 letters, digits, underscores or hyphens.');
      const user={id:randomUUID(),username:`${value.username??'Guest'}-${randomBytes(3).toString('hex')}`};
      // An unknowable randomized credential prevents password-login takeover of a guest identity.
      const salt=randomBytes(16).toString('hex'),hash=(await scrypt(randomBytes(32).toString('hex'),salt,64)) as Buffer;
      store.addUser(user,`${salt}:${hash.toString('hex')}`);setSession(res,user);respond(res,200,{account:user,guest:true});return;
    }
    if(req.method==='POST'&&(path==='/api/auth/register'||path==='/api/auth/login')){
      authLimit(req);const value=credentials(await body(req));let user:Account;
      if(path.endsWith('register')){
        if(store.userByName(value.username))throw new HttpError(409,'That username is already registered.');
        const salt=randomBytes(16).toString('hex'),hash=(await scrypt(value.password,salt,64)) as Buffer;
        user={id:randomUUID(),username:value.username};
        try{store.addUser(user,`${salt}:${hash.toString('hex')}`);}catch{throw new HttpError(409,'That username is already registered.');}
      }else{
        const saved=store.userByName(value.username);const [salt,hash]=saved?.password.split(':')??['0'.repeat(32),'0'.repeat(128)];
        const candidate=(await scrypt(value.password,salt,64)) as Buffer;
        if(!saved||!timingSafeEqual(candidate,Buffer.from(hash,'hex')))throw new HttpError(401,'Username or password is incorrect.');
        user={id:saved.id,username:saved.username};
      }
      setSession(res,user);respond(res,200,{account:user});return;
    }
    if(req.method==='POST'&&path==='/api/auth/logout'){
      const cookie=req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('ovf_session='))?.slice('ovf_session='.length);
      if(cookie)store.deleteSession(createHash('sha256').update(cookie).digest('hex'));
      res.setHeader('Set-Cookie','ovf_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');respond(res,200,{ok:true});return;
    }
    if(path.startsWith('/api/')){
      const user=account(req);
      if(await communityHttp({req,res,url,user,body,respond}))return;
      if(tournaments&&await tournaments.handle(req,res))return;
      if(req.method==='GET'&&path==='/api/lobbies'){respond(res,200,{lobbies:[...lobbies.values()].map(publicLobby)});return;}
      if(req.method==='POST'&&path==='/api/lobbies'){
        const value=await body(req);if(!keys(value,['settings','seed'])||(value.seed!==undefined&&!integer(value.seed,0,0xffffffff)))throw new HttpError(400,'Invalid lobby fields.');
        const configuration=settings(value.settings??{mapSize:'medium',factions:['orcs','fairies']});
        const lobby:StoredLobby={id:randomUUID(),hostId:user.id,revision:1,settings:configuration,seed:(value.seed as number|undefined)??randomBytes(4).readUInt32LE(),seats:roster(configuration,[],user),matchId:null};
        resetDraft(lobby);store.saveLobby(lobby);lobbies.set(lobby.id,lobby);respond(res,201,{lobby:publicLobby(lobby)});return;
      }
      const lobbyRoute=/^\/api\/lobbies\/([^/]+)(?:\/(join|settings|ready|start|leave|draft))?$/.exec(path);
      if(lobbyRoute){
        const existing=getLobby(lobbyRoute[1]),action=lobbyRoute[2];
        if(req.method==='GET'&&!action){respond(res,200,{lobby:publicLobby(existing)});return;}
        const lobby=structuredClone(existing);
        if(req.method!=='POST')throw new HttpError(405,'Use POST.');
        const value=await body(req);editLobby(lobby,value);
        const own=lobby.seats.find(seat=>seat.account?.id===user.id);
        if(action==='join'){
          if(!keys(value,['expectedRevision']))throw new HttpError(400,'Unknown join field.');
          if(!own){const empty=lobby.seats.find(seat=>seat.controller==='human'&&!seat.account);if(!empty)throw new HttpError(409,'Human slots are full.');empty.account=user;if(!lobby.hostId)lobby.hostId=user.id;lobby.seats.forEach(seat=>{seat.ready=false;});resetDraft(lobby);changed(lobby);}
        }else if(action==='settings'){
          if(user.id!==lobby.hostId)throw new HttpError(403,'Only the host may change settings.');
          if(!keys(value,['expectedRevision','settings','seed'])||(value.seed!==undefined&&!integer(value.seed,0,0xffffffff)))throw new HttpError(400,'Unknown or invalid settings field.');
          const configuration=settings(value.settings),seats=roster(configuration,lobby.seats);lobby.settings=configuration;lobby.seats=seats;if(value.seed!==undefined)lobby.seed=value.seed as number;resetDraft(lobby);changed(lobby);
        }else if(action==='ready'){
          if(!own)throw new HttpError(403,'Join a seat first.');
          if(!keys(value,['expectedRevision','ready'])||typeof value.ready!=='boolean')throw new HttpError(400,'Expected readiness.');if(value.ready&&lobby.draft?.status==='drafting')throw new HttpError(409,'Finish the draft before becoming ready.');own.ready=value.ready;changed(lobby);
        }else if(action==='leave'){
          if(!own)throw new HttpError(403,'You are not in this lobby.');
          if(!keys(value,['expectedRevision']))throw new HttpError(400,'Unknown leave field.');own.account=null;own.ready=false;lobby.seats.forEach(seat=>{seat.ready=false;});
          if(user.id===lobby.hostId)lobby.hostId=lobby.seats.find(seat=>seat.account)?.account?.id??'';resetDraft(lobby);changed(lobby);
        }else if(action==='draft'){
          if(!own)throw new HttpError(403,'Join a seat first.');
          if(!keys(value,['expectedRevision','definitionId'])||typeof value.definitionId!=='string')throw new HttpError(400,'Expected a definition ID.');
          if(lobby.seats.some(seat=>seat.controller==='human'&&!seat.account))throw new HttpError(409,'All human players must be present before the draft.');
          if(!lobby.draft||!applyDraftChoice(lobby.draft,normalizeMatchRules(lobby.settings.rules),lobby.settings.players!.map((p,id)=>({...p,id:id as Side})),own.side,value.definitionId))throw new HttpError(409,'Illegal choice, duplicate definition, or another player owns this draft turn.');
          lobby.draftDeadlineAt=lobby.draft.status==='drafting'?Date.now()+lobby.draft.remainingTicks*1000/TICK_RATE:undefined;lobby.seats.forEach(seat=>{seat.ready=false;});changed(lobby);
        }else if(action==='start'){
          if(user.id!==lobby.hostId)throw new HttpError(403,'Only the host may start.');
          if(!keys(value,['expectedRevision']))throw new HttpError(400,'Unknown start field.');
          if(lobby.seats.some(seat=>seat.controller==='human'&&(!seat.account||!seat.ready)))throw new HttpError(409,'All human players must be present and ready.');
          if(lobby.draft?.status==='drafting')throw new HttpError(409,'Finish the draft before launching.');
          const configuration=matchConfig(lobby),state=createMatch(configuration),sides=playerSides(state);
          const id=randomUUID(),views=sides.map(side=>new OnlineView(side)),frame={tick:0,views:views.map(view=>view.observe(state))},generations=sides.map(()=>0);
          const started={...lobby,matchId:id,revision:lobby.revision+1};
          store.startMatch(started,state,views.map(view=>view.snapshot()),generations,frame,configuration);
          matches.set(id,{id,lobbyId:lobby.id,state,views,frames:[frame],generations,pending:[],receipts:new Map(),lastSeq:sides.map(()=>0),peers:new Set(),eventBuffers:sides.map(()=>[]),failed:false});
          Object.assign(lobby,started);
          lobbies.set(lobby.id,lobby);
        }else throw new HttpError(404,'Unknown lobby action.');
        respond(res,200,{lobby:publicLobby(lobby)});return;
      }
      if(req.method==='GET'&&path==='/api/matches'){
        respond(res,200,{matches:[...matches.values()].filter(match=>lobbies.get(match.lobbyId)?.seats.some(seat=>seat.account?.id===user.id)).map(matchSummary)});return;
      }
      const matchRoute=/^\/api\/matches\/([^/]+)\/ticket$/.exec(path);
      if(req.method==='POST'&&matchRoute){
        const match=matches.get(matchRoute[1]);if(!match)throw new HttpError(404,'Match not found.');
        const value=await body(req);if(!keys(value,['role','perspective','view'])||!['player','spectator'].includes(value.role as string)||(value.perspective!==undefined&&!integer(value.perspective,0,match.state.players.length-1))||(value.view!==undefined&&!['player','team'].includes(value.view as string)))throw new HttpError(400,'Expected a player/spectator role and a valid player/team perspective.');
        const seat=lobbies.get(match.lobbyId)!.seats.find(seat=>seat.account?.id===user.id);
        if(value.role==='player'&&!seat)throw new HttpError(403,'You do not own a seat.');
        const role=value.role as 'player'|'spectator',side=role==='player'?seat!.side:(value.perspective??0) as Side;
        const perspective=role==='spectator'&&value.view==='team'?'team':'player';
        const token=randomBytes(32).toString('hex');tickets.set(token,{account:user,matchId:match.id,role,side,perspective,expires:Date.now()+60000});
        respond(res,200,{ticket:token,expiresInSeconds:60,protocolVersion:PROTOCOL_VERSION,role,side,perspective,delayTicks:role==='spectator'?delayTicks:0});return;
      }
      throw new HttpError(404,'API endpoint not found.');
    }
    if(req.method!=='GET')throw new HttpError(405,'Use GET.');
    if(!options.staticDir)throw new HttpError(404,'Build the browser or configure RTS_STATIC_DIR.');
    const directory=resolve(options.staticDir);let filename=resolve(directory,`.${decodeURIComponent(path)}`);
    if(filename!==directory&&!filename.startsWith(directory+sep))throw new HttpError(403,'Invalid file path.');
    try{if((await stat(filename)).isDirectory())filename=resolve(filename,'index.html');await stat(filename);}catch{if(extname(path))throw new HttpError(404,'File not found.');filename=resolve(directory,'index.html');}
    const data=await readFile(filename),types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
    res.writeHead(200,{'Content-Type':types[extname(filename)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':extname(filename)==='.html'?'no-cache':'public,max-age=3600'});res.end(data);
  }
  const http=createServer((req,res)=>{void route(req,res).catch(error=>{if(res.headersSent){res.destroy();return;}const known=error instanceof HttpError||error instanceof CommunityPackageError;respond(res,known?error.status:500,{error:known?error.message:'Server request failed.'});});});
  const websocket=new WebSocketServer({noServer:true,maxPayload:MAX_BODY_BYTES,perMessageDeflate:false});

  function deliver(peer:Peer,match:ActiveMatch){
    const effectiveTick=match.state.tick+(match.finishedAt===undefined?0:Math.floor((Date.now()-match.finishedAt)/1000*TICK_RATE));
    const cutoff=peer.role==='spectator'?effectiveTick-delayTicks:match.state.tick;
    const frame=[...match.frames].reverse().find(frame=>frame.tick<=cutoff);
    if(!frame){if(peer.lastFrameTick<0){send(peer.socket,{kind:'waiting',availableAtTick:delayTicks,currentTick:effectiveTick});peer.lastFrameTick=-2;}return;}
    if(frame.tick<=peer.lastFrameTick)return;
    send(peer.socket,{kind:'snapshot',matchId:match.id,frameSeq:frame.tick,tick:frame.tick,view:peer.perspective==='team'?teamObservation(frame.views,peer.side):frame.views[peer.side]});peer.lastFrameTick=frame.tick;
  }
  http.on('upgrade',(req,socket,head)=>{
    try{
    const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`),token=url.searchParams.get('ticket');
    const ticket=token?tickets.get(token):undefined,user=session(req);
    if(url.pathname!=='/ws'||!allowedOrigin(req)||!ticket||ticket.expires<Date.now()||user?.id!==ticket.account.id){socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();return;}
    tickets.delete(token!);
    const match=matches.get(ticket.matchId)!;
    websocket.handleUpgrade(req,socket,head,ws=>{
      let generation=0;
      if(ticket.role==='player'){
        generation=match.generations[ticket.side]+1;
        const generations=[...match.generations];generations[ticket.side]=generation;
        try{store.generation(match.id,generations);}catch{ws.close(1011,'Persistence failed');return;}
        match.generations=generations;
        // Unacknowledged inputs belonged to the old connection; the new client retries from durable lastSeq.
        match.pending=match.pending.filter(entry=>entry.side!==ticket.side);
        for(const peer of match.peers)if(peer.role==='player'&&peer.side===ticket.side)peer.socket.close(4001,'Connection replaced');
      }
      const peer:Peer={...ticket,socket:ws,generation,lastFrameTick:-1,messages:0,rateAt:Date.now()};match.peers.add(peer);
      send(ws,{kind:'hello',protocolVersion:PROTOCOL_VERSION,matchId:match.id,role:peer.role,side:peer.side,generation,perspective:peer.perspective,lastClientSeq:peer.role==='player'?match.lastSeq[peer.side]:0,delayTicks:peer.role==='spectator'?delayTicks:0});deliver(peer,match);
      ws.on('message',data=>{
        if(peer.role==='player'&&peer.generation!==match.generations[peer.side]){fail(ws,'replaced','This connection was replaced.');return;}
        const now=Date.now();if(now-peer.rateAt>1000){peer.messages=0;peer.rateAt=now;}
        if(++peer.messages>100){ws.close(4008,'Command rate exceeded');return;}
        let value:unknown;try{value=JSON.parse(data.toString());}catch{fail(ws,'invalid-message','Invalid JSON.');return;}
        if(record(value)&&value.kind==='ping'&&keys(value,['kind','requestId'])&&(value.requestId===undefined||typeof value.requestId==='string')){send(ws,{kind:'pong',requestId:value.requestId as string|undefined});return;}
        if(peer.role!=='player'){fail(ws,'spectator','Spectators cannot issue commands.');return;}
        if(!record(value)||!keys(value,['kind','protocolVersion','clientSeq','observedTick','command'])||value.kind!=='command'||value.protocolVersion!==PROTOCOL_VERSION||!integer(value.clientSeq,1)||!integer(value.observedTick)||value.observedTick>match.state.tick){fail(ws,'invalid-message','Invalid command envelope.');return;}
        const valid=validateCommand(value.command)||isSurrender(value.command),command=valid?value.command:null;
        const payload=jsonHash(value.command);
        const key=`${peer.side}:${value.clientSeq}`,stored=match.receipts.get(key);
        if(stored){if(stored.payload===payload)send(ws,stored.ack);else fail(ws,'sequence-conflict','A command sequence cannot have a different payload.');return;}
        const pending=match.pending.find(entry=>entry.side===peer.side&&entry.clientSeq===value.clientSeq);
        if(pending){if(pending.payload!==payload)fail(ws,'sequence-conflict','A command sequence cannot have a different payload.');else{pending.socket=ws;pending.generation=peer.generation;}return;}
        const previous=match.pending.filter(entry=>entry.side===peer.side).at(-1)?.clientSeq??match.lastSeq[peer.side];
        if(value.clientSeq!==previous+1){fail(ws,'sequence-gap',`Expected command sequence ${previous+1}.`);return;}
        if(match.failed){fail(ws,'storage-failure','This match is paused after a persistence failure.');return;}
        if(isGameOver(match.state)){
          const ack:CommandAck={kind:'commandAck',clientSeq:value.clientSeq,appliedTick:match.state.tick,accepted:false,reason:'ended'};
          const entry:StoredCommand={side:peer.side,clientSeq:value.clientSeq,payload,appliedTick:match.state.tick,ordinal:0,command,ack};
          try{store.commitTick(match.id,match.state,[entry],match.views.map(view=>view.snapshot()));}catch{match.failed=true;fail(ws,'storage-failure','Receipt persistence failed.');return;}
          match.receipts.set(key,entry);match.lastSeq[peer.side]=value.clientSeq;send(ws,ack);return;
        }
        match.pending.push({side:peer.side,clientSeq:value.clientSeq,payload,command,socket:ws,generation:peer.generation});
      });
      ws.on('close',()=>match.peers.delete(peer));ws.on('error',()=>match.peers.delete(peer));
    });
    }catch{socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');socket.destroy();}
  });

  function advance(match:ActiveMatch){
    if(match.failed)return;
    if(isGameOver(match.state)){for(const peer of match.peers)deliver(peer,match);return;}
    const appliedTick=match.state.tick+1,entries:StoredCommand[]=[];
    const pending=match.pending.splice(0);
    // Receive order is authoritative and recorded; each receipt is durable before delivery.
    for(const [ordinal,entry] of pending.entries()){
      let accepted=false,reason:CommandAck['reason'];
      if(isSurrender(entry.command)){accepted=applyInput(match.state,entry.side,entry.command);if(!accepted)reason='unavailable';}
      else if(!validateCommand(entry.command))reason='invalid-command';
      else if(isPlayerCommand(entry.command)){accepted=issueCommand(match.state,entry.side,entry.command);if(!accepted)reason='unavailable';}
      else{
        const ids='ids' in entry.command?entry.command.ids:'id' in entry.command?[entry.command.id]:[];
        if(!ids.length||ids.some(id=>!match.state.entities.some(entity=>entity.id===id&&entity.side===entry.side&&entity.hp>0)))reason='ownership';
        else{accepted=issueCommand(match.state,entry.side,entry.command);if(!accepted)reason='unavailable';}
      }
      const ack:CommandAck={kind:'commandAck',clientSeq:entry.clientSeq,appliedTick,accepted,...(reason?{reason}:{})};
      entries.push({side:entry.side,clientSeq:entry.clientSeq,payload:entry.payload,appliedTick,ordinal,command:entry.command,ack});
    }
    stepGame(match.state,1/TICK_RATE);
    const views=match.views.map(view=>view.observe(match.state));
    views.forEach((view,side)=>match.eventBuffers[side].push(...view.events));
    const finished=isGameOver(match.state),frame=match.state.tick%4===0||finished?{tick:match.state.tick,views:views.map((view,side)=>({...view,events:match.eventBuffers[side].splice(0)}))}:undefined;
    try{store.commitTick(match.id,match.state,entries,match.views.map(view=>view.snapshot()),frame,match.state.tick%20===0||finished);}catch(error){
      match.failed=true;for(const peer of match.peers)fail(peer.socket,'storage-failure','This match paused because its tick could not be persisted.');return;
    }
    if(frame){match.frames.push(frame);match.frames=match.frames.filter(frame=>frame.tick>=match.state.tick-delayTicks-80);}
    if(finished)match.finishedAt=Date.now();
    for(const [index,entry] of entries.entries()){
      match.receipts.set(`${entry.side}:${entry.clientSeq}`,entry);match.lastSeq[entry.side]=entry.clientSeq;
      const original=pending[index];if(original.generation===match.generations[entry.side])send(original.socket,entry.ack);
    }
    for(const peer of match.peers)deliver(peer,match);
  }
  function advanceDrafts(){for(const lobby of lobbies.values()){if(lobby.matchId||lobby.draft?.status!=='drafting'||!lobby.draftDeadlineAt)continue;const turn=lobby.draft.order[lobby.draft.turn];if(lobby.seats[turn.side].controller!=='ai'&&Date.now()<lobby.draftDeadlineAt)continue;const next=structuredClone(lobby),rules=normalizeMatchRules(next.settings.rules),players=next.settings.players!.map((p,id)=>({...p,id:id as Side}));for(const id of legalDraftChoices(next.draft!,players,turn.side))if(applyDraftChoice(next.draft!,rules,players,turn.side,id))break;next.draftDeadlineAt=next.draft!.status==='drafting'?Date.now()+next.draft!.remainingTicks*1000/TICK_RATE:undefined;next.seats.forEach(seat=>{seat.ready=false;});changed(next);}}
  const timer=setInterval(()=>{try{advanceDrafts();}catch{}for(const match of matches.values()){try{advance(match);}catch{match.failed=true;for(const peer of match.peers)fail(peer.socket,'match-failure','The match paused after an internal error.');}}const now=Date.now();for(const [token,ticket] of tickets)if(ticket.expires<now)tickets.delete(token);},1000/TICK_RATE);
  try{await new Promise<void>((resolveListening,reject)=>{http.once('error',reject);http.listen(port,host,()=>{http.off('error',reject);resolveListening();});});}
  catch(error){clearInterval(timer);await tournaments?.dispose();websocket.close();store.close();throw error;}
  const address=http.address();if(!address||typeof address==='string')throw new Error('No server address.');
  return {
    url:`http://${host==='0.0.0.0'?'127.0.0.1':host}:${address.port}`,
    port:address.port,
    async close(){
      if(closing)return;closing=true;clearInterval(timer);
      await tournaments?.dispose();
      for(const match of matches.values())for(const peer of match.peers)peer.socket.terminate();
      await new Promise<void>(resolveClosed=>websocket.close(()=>resolveClosed()));
      await new Promise<void>(resolveClosed=>http.close(()=>resolveClosed()));store.close();
    }
  };
}
