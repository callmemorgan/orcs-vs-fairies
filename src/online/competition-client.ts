import { OnlineApi } from './client';
import type { LobbyObservation, LobbySettings } from './protocol';
import type { DailyChallenge, DailyStanding, RankedResult, RankedStanding, Season } from './competitions';

export class CompetitionApi extends OnlineApi {
  seasons(){return this.request<{current:Season;seasons:Season[];rules:string}>('/api/ranked/seasons');}
  standings(season?:string){return this.request<{seasonId:string;standings:RankedStanding[]}>(`/api/ranked/standings${season?'?season='+encodeURIComponent(season):''}`);}
  daily(){return this.request<{challenge:DailyChallenge;standings:DailyStanding[];rules:string}>('/api/challenges/daily');}
  myMatches(){return this.request<{matches:Array<{id:string;finished:boolean;tick:number;failed:boolean}>}>('/api/matches');}
  dailyStandings(date:string){return this.request<{date:string;standings:DailyStanding[]}>('/api/challenges/daily/standings?date='+encodeURIComponent(date));}
  async createRanked(settings:LobbySettings){return (await this.request<{lobby:LobbyObservation}>('/api/lobbies',{settings,ranked:true})).lobby;}
  startDaily(){return this.request<{lobby:LobbyObservation;challenge:DailyChallenge}>('/api/challenges/daily/start',{});}
  result(matchId:string){return this.request<{result:RankedResult|{matchId:string;date:string;won:boolean;tick:number}|null;finished:boolean;failed:boolean}>('/api/competitions/results/'+encodeURIComponent(matchId));}
}
