import type { Account, LobbySettings } from './protocol';
import type { MatchConfig } from '../core/types';

export interface Season { id:string; startsAt:string; endsAt:string; initialRating:1000; kFactor:32 }
export interface RankedStanding { rank:number; account:Account; rating:number; played:number; wins:number; draws:number; losses:number }
export interface RankedResult { matchId:string; seasonId:string; winner:string|null; tick:number; ratings:Array<{accountId:string;before:number;after:number}> }
export interface DailyChallenge { date:string; seed:number; expiresAt:string; config:MatchConfig; scoring:'fastest-victory'; tickRate:20 }
export interface DailyStanding { rank:number; account:Account; matchId:string; tick:number; seconds:number }
export type CompetitionEntry =
  | {kind:'ranked'; seasonId:string; participants:[Account,Account]}
  | {kind:'daily'; date:string; participant:Account; challenge:DailyChallenge};
export const RANKED_RULES='Ranked is one human versus one human, with no handicaps and age 1 starts. Ratings use Elo, K=32 and a 400-point scale. Every UTC calendar month resets ratings to 1000. A match counts in the season when it starts. Surrender counts as a loss; draws count as half a win.';
export function rankedEligibility(settings:LobbySettings):string|undefined {
  const players=settings.players??settings.factions.map((factionId,index)=>({factionId,teamId:index,controller:'human' as const}));
  if(players.length!==2||players.some(player=>player.controller!=='human'))return 'Ranked requires two human players.';
  if(players[0].teamId===players[1].teamId)return 'Ranked players must be on opposing teams.';
  if(players.some(player=>'handicap' in player&&player.handicap!==undefined))return 'Ranked does not allow handicaps.';
  if((settings.startingAge??1)!==1)return 'Ranked starts in age 1.';
  return undefined;
}
