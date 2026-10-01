import type { FactionId, MapSize, Command, Side, Vec, MatchPlayerConfig, Age } from '../core/types';
import type { PlayerView } from '../core/observation';

export const PROTOCOL_VERSION = 1;
export const TICK_RATE = 20;
export interface Account { id:string; username:string }
export interface LobbyPlayerSettings {
  factionId:FactionId; teamId:Side; controller:'human'|'ai';
  handicap?:MatchPlayerConfig['handicap'];
}
export interface LobbySettings {
  mapSize:MapSize; factions:FactionId[]; players?:LobbyPlayerSettings[];
  sharedVision?:boolean; startingAge?:Age;
}
export interface LobbySeat {
  side:Side; account:Account|null; ready:boolean; controller?:'human'|'ai';
  teamId?:Side; factionId?:FactionId; handicap?:MatchPlayerConfig['handicap'];
}
export interface LobbyObservation {
  id:string; hostId:string; revision:number; settings:LobbySettings;
  seats:LobbySeat[]; matchId:string|null;
}
type CoreObservation=ReturnType<PlayerView['observe']>;
export type PlayerObservation=Omit<CoreObservation,'map'|'entities'|'events'> & {
  teamPerspective?:boolean;
  teamPlayers?:Array<{side:Side;player:CoreObservation['player']}>;
  map:Omit<CoreObservation['map'],'seed'|'starts'> & {starts:Array<Vec|null>};
  entities:Array<CoreObservation['entities'][number] & {
    facing:number; animation:string; animTime:number;
    lastDamagedAt?:number;
  }>;
  events:Array<Partial<CoreObservation['entities'][number]> & {
    type:string; tick:number; x:number; y:number; side?:Side; text?:string;
    target?:number; source?:number; amount?:number; resource?:string; eventId?:string;
  }>;
};
export type OnlineCommand=Command|{type:'surrender'};
export interface CommandMessage {
  kind:'command'; protocolVersion:typeof PROTOCOL_VERSION;
  clientSeq:number; observedTick:number; command:OnlineCommand;
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
      side:Side; generation:number; lastClientSeq:number; delayTicks:number; perspective?:'player'|'team'}
  | SnapshotMessage
  | CommandAck
  | {kind:'waiting'; availableAtTick:number; currentTick:number}
  | {kind:'error'; code:string; message:string}
  | {kind:'pong'; requestId?:string};
