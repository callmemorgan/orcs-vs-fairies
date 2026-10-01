import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Account, CommandAck, LobbySettings, LobbySeat, PlayerObservation } from '../online/protocol';
import type { GameState, Side, DraftState, MatchConfig as CoreMatchConfig } from '../core/types';
import { saveGame, loadGame } from '../core/saves';

export interface StoredLobby {
  id:string; hostId:string; revision:number; settings:LobbySettings;
  seats:LobbySeat[]; seed:number; matchId:string|null; draft?:DraftState; draftDeadlineAt?:number;
}
export interface MatchConfig extends LobbySettings { seed:number; matchConfig?:CoreMatchConfig }
export interface StoredMatch {
  id:string; lobbyId:string; config:MatchConfig; tick:number;
  save:ReturnType<typeof saveGame>; memory:ResourceMemory[]; generation:number[];
  checkpointTick:number; finished:boolean;
  engineHash:string; stateHash:string;
}
export type ResourceMemory=PlayerObservation['resources'];
export interface StoredCommand {
  side:Side; clientSeq:number; payload:string; appliedTick:number; ordinal:number;
  command:unknown; ack:CommandAck;
}
export interface StoredFrame { tick:number; views:PlayerObservation[] }

/** The transaction writes a tick and its receipts together before clients see either. */
export class ServerStore {
  readonly db:DatabaseSync;
  constructor(directory:string,readonly engineHash:string){
    mkdirSync(directory,{recursive:true});this.db=new DatabaseSync(join(directory,'server.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS lobbies(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,lobby_id TEXT NOT NULL,config TEXT NOT NULL,tick INTEGER NOT NULL,checkpoint_tick INTEGER NOT NULL,checkpoint TEXT NOT NULL,memory TEXT NOT NULL,generation TEXT NOT NULL,finished INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS commands(match_id TEXT NOT NULL REFERENCES matches(id),side INTEGER NOT NULL,client_seq INTEGER NOT NULL,payload TEXT NOT NULL,tick INTEGER NOT NULL,ordinal INTEGER NOT NULL,command TEXT NOT NULL,ack TEXT NOT NULL,PRIMARY KEY(match_id,side,client_seq));
      CREATE INDEX IF NOT EXISTS command_ticks ON commands(match_id,tick,ordinal);
      CREATE TABLE IF NOT EXISTS frames(match_id TEXT NOT NULL REFERENCES matches(id),tick INTEGER NOT NULL,views TEXT NOT NULL,PRIMARY KEY(match_id,tick));`);
    const columns=new Set(this.db.prepare('PRAGMA table_info(matches)').all().map(row=>row.name));
    if(!columns.has('engine_hash'))this.db.exec("ALTER TABLE matches ADD COLUMN engine_hash TEXT NOT NULL DEFAULT ''");
    if(!columns.has('state_hash'))this.db.exec("ALTER TABLE matches ADD COLUMN state_hash TEXT NOT NULL DEFAULT ''");
  }
  userByName(username:string):({id:string;username:string;password:string})|undefined {
    return this.db.prepare('SELECT id,username,password FROM users WHERE username=? COLLATE NOCASE').get(username) as {id:string;username:string;password:string}|undefined;
  }
  addUser(account:Account,password:string){this.db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run(account.id,account.username,password);}
  session(token:string,now:number):Account|undefined {
    return this.db.prepare('SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND expires>?').get(token,now) as Account|undefined;
  }
  addSession(token:string,userId:string,expires:number){this.db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').run(token,userId,expires);}
  deleteSession(token:string){this.db.prepare('DELETE FROM sessions WHERE token=?').run(token);}
  saveLobby(lobby:StoredLobby){this.db.prepare('INSERT INTO lobbies(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(lobby.id,JSON.stringify(lobby));}
  lobbies():StoredLobby[]{return this.db.prepare('SELECT data FROM lobbies').all().map(row=>JSON.parse(row.data as string) as StoredLobby);}
  addMatch(id:string,lobbyId:string,config:MatchConfig,state:GameState,memory:ResourceMemory[],generation:number[]){
    this.db.prepare('INSERT INTO matches(id,lobby_id,config,tick,checkpoint_tick,checkpoint,memory,generation,engine_hash,state_hash) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,lobbyId,JSON.stringify(config),state.tick,state.tick,JSON.stringify(saveGame(state)),JSON.stringify(memory),JSON.stringify(generation),this.engineHash,this.hashState(state,memory));
  }
  startMatch(lobby:StoredLobby,state:GameState,memory:ResourceMemory[],generation:number[],frame:StoredFrame,matchConfig?:CoreMatchConfig){
    if(!lobby.matchId)throw new Error('Started lobby requires a match ID.');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.addMatch(lobby.matchId,lobby.id,{...lobby.settings,seed:lobby.seed,matchConfig},state,memory,generation);
      this.db.prepare('INSERT INTO frames(match_id,tick,views) VALUES(?,?,?)').run(lobby.matchId,frame.tick,JSON.stringify(frame.views));
      this.saveLobby(lobby);this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  matches():StoredMatch[]{
    return this.db.prepare('SELECT * FROM matches').all().map(row=>({id:row.id as string,lobbyId:row.lobby_id as string,config:JSON.parse(row.config as string),tick:row.tick as number,checkpointTick:row.checkpoint_tick as number,save:JSON.parse(row.checkpoint as string),memory:JSON.parse(row.memory as string),generation:JSON.parse(row.generation as string),finished:!!row.finished,engineHash:row.engine_hash as string,stateHash:row.state_hash as string}));
  }
  commands(matchId:string,afterTick=-1):StoredCommand[]{
    return this.db.prepare('SELECT * FROM commands WHERE match_id=? AND tick>? ORDER BY tick,ordinal').all(matchId,afterTick).map(row=>({side:row.side as Side,clientSeq:row.client_seq as number,payload:row.payload as string,appliedTick:row.tick as number,ordinal:row.ordinal as number,command:JSON.parse(row.command as string),ack:JSON.parse(row.ack as string)}));
  }
  frames(matchId:string,minimumTick:number):StoredFrame[]{return this.db.prepare('SELECT tick,views FROM frames WHERE match_id=? AND tick>=? ORDER BY tick').all(matchId,minimumTick).map(row=>({tick:row.tick as number,views:JSON.parse(row.views as string)}));}
  generation(matchId:string,generation:number[]){this.db.prepare('UPDATE matches SET generation=? WHERE id=?').run(JSON.stringify(generation),matchId);}
  commitTick(matchId:string,state:GameState,commands:StoredCommand[],memory:ResourceMemory[],frame?:StoredFrame,checkpoint=false){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const insert=this.db.prepare('INSERT INTO commands(match_id,side,client_seq,payload,tick,ordinal,command,ack) VALUES(?,?,?,?,?,?,?,?)');
      for(const entry of commands)insert.run(matchId,entry.side,entry.clientSeq,entry.payload,entry.appliedTick,entry.ordinal,JSON.stringify(entry.command),JSON.stringify(entry.ack));
      this.db.prepare('UPDATE matches SET tick=?,finished=?,state_hash=? WHERE id=?').run(state.tick,state.winner!==null||state.draw?1:0,this.hashState(state,memory),matchId);
      if(checkpoint)this.db.prepare('UPDATE matches SET checkpoint_tick=?,checkpoint=?,memory=? WHERE id=?').run(state.tick,JSON.stringify(saveGame(state)),JSON.stringify(memory),matchId);
      if(frame){this.db.prepare('INSERT OR REPLACE INTO frames(match_id,tick,views) VALUES(?,?,?)').run(matchId,frame.tick,JSON.stringify(frame.views));this.db.prepare('DELETE FROM frames WHERE match_id=? AND tick<?').run(matchId,frame.tick-2400);}
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  restore(match:StoredMatch){return loadGame(match.save);}
  hashState(state:GameState,memory:ResourceMemory[]){return createHash('sha256').update(JSON.stringify({save:saveGame(state),memory})).digest('hex');}
  verifyRecovery(match:StoredMatch,state:GameState,memory:ResourceMemory[]){
    if(match.engineHash!==this.engineHash)throw new Error(`Match ${match.id} requires its original server/simulation build. Preserve the database and run that compatible build.`);
    if(match.stateHash!==this.hashState(state,memory))throw new Error(`Match ${match.id} recovery differs from its durable state hash.`);
  }
  close(){this.db.close();}
}
