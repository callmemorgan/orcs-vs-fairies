import type { FactionId, MapSize, Command, Side, Vec } from '../core/types';
import type { PlayerView } from '../core/observation';

export const PROTOCOL_VERSION = 1;
export const TICK_RATE = 20;
export interface Account { id:string; username:string }
export interface LobbySettings { mapSize:MapSize; factions:[FactionId,FactionId] }
export interface LobbySeat { side:Side; account:Account|null; ready:boolean }
export interface LobbyObservation {
  id:string; hostId:string; revision:number; settings:LobbySettings;
  seats:LobbySeat[]; matchId:string|null;
}
type CoreObservation=ReturnType<PlayerView['observe']>;
export type PlayerObservation=Omit<CoreObservation,'map'|'entities'|'events'> & {
  map:Omit<CoreObservation['map'],'seed'|'starts'> & {starts:Array<Vec|null>};
  entities:Array<CoreObservation['entities'][number] & {
    facing:number; animation:string; animTime:number;
  }>;
  events:Array<Partial<CoreObservation['entities'][number]> & {
    type:string; tick:number; x:number; y:number; side?:Side; text?:string;
    target?:number; source?:number; amount?:number; resource?:string;
  }>;
};
export interface CommandMessage {
  kind:'command'; protocolVersion:typeof PROTOCOL_VERSION;
  clientSeq:number; observedTick:number; command:Command;
}
export interface CommandAck {
  kind:'commandAck'; clientSeq:number; appliedTick:number; accepted:boolean;
  reason?:'invalid-command'|'ownership'|'unavailable'|'ended';
}
export interface SnapshotMessage {
  kind:'snapshot'; matchId:string; frameSeq:number; tick:number;
  view:PlayerObservation;
}
export type ServerMessage=
  | {kind:'hello'; protocolVersion:number; matchId:string; role:'player'|'spectator';
      side:Side; generation:number; lastClientSeq:number; delayTicks:number}
  | SnapshotMessage
  | CommandAck
  | {kind:'waiting'; availableAtTick:number; currentTick:number}
  | {kind:'error'; code:string; message:string}
  | {kind:'pong'; requestId?:string};
