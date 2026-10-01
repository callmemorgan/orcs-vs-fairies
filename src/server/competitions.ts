import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import type { GameState, FactionId } from '../core/types';
import type { CompetitionEntry, DailyChallenge, DailyStanding, RankedResult, RankedStanding, Season } from '../online/competitions';

/** Only the server clock determines dates. This function has no client date input. */
export function seasonAt(now:number):Season {
  const date=new Date(now),year=date.getUTCFullYear(),month=date.getUTCMonth();
  return {id:`${year}-${String(month+1).padStart(2,'0')}`,startsAt:new Date(Date.UTC(year,month,1)).toISOString(),endsAt:new Date(Date.UTC(year,month+1,1)).toISOString(),initialRating:1000,kFactor:32};
}
export function dailyAt(now:number):DailyChallenge {
  const date=new Date(now).toISOString().slice(0,10),seed=createHash('sha256').update(`orcs-vs-fairies:daily:v1:${date}`).digest().readUInt32LE();
  const factions:FactionId[]=['orcs','fairies','dwarves','undead','tideborn','automata'];
  return {date,seed,expiresAt:new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString(),scoring:'fastest-victory',tickRate:20,
    config:{schemaVersion:1,map:{seed,size:'small'},players:[{id:0,teamId:0,factionId:factions[seed%6],controller:'external'},
      {id:1,teamId:1,factionId:factions[(seed%6+1)%6],controller:'ai',ai:{difficulty:'normal',personality:'balanced',opening:'infantry-rush'}}],rules:{sharedVision:true,startingAge:1}}};
}

/** These writes are called within ServerStore's tick transaction. */
export class CompetitionStore {
  constructor(private db:DatabaseSync){
    db.exec(`CREATE TABLE IF NOT EXISTS ranked_seasons(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ranked_ratings(season_id TEXT NOT NULL REFERENCES ranked_seasons(id),user_id TEXT NOT NULL REFERENCES users(id),rating INTEGER NOT NULL,played INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0,draws INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(season_id,user_id));
      CREATE TABLE IF NOT EXISTS competition_results(match_id TEXT PRIMARY KEY REFERENCES matches(id),kind TEXT NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_challenges(date TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_scores(date TEXT NOT NULL REFERENCES daily_challenges(date),user_id TEXT NOT NULL REFERENCES users(id),match_id TEXT NOT NULL REFERENCES matches(id),tick INTEGER NOT NULL,PRIMARY KEY(date,user_id));`);
  }
  season(now:number):Season {
    const season=seasonAt(now);this.db.prepare('INSERT OR IGNORE INTO ranked_seasons(id,data) VALUES(?,?)').run(season.id,JSON.stringify(season));
    return season;
  }
  seasons():Season[]{return this.db.prepare('SELECT data FROM ranked_seasons ORDER BY id DESC').all().map(row=>JSON.parse(row.data as string));}
  challenge(now:number):DailyChallenge {
    const challenge=dailyAt(now);this.db.prepare('INSERT OR IGNORE INTO daily_challenges(date,data) VALUES(?,?)').run(challenge.date,JSON.stringify(challenge));
    return JSON.parse(this.db.prepare('SELECT data FROM daily_challenges WHERE date=?').get(challenge.date)!.data as string);
  }
  standings(seasonId:string):RankedStanding[]{return this.db.prepare('SELECT users.id,users.username,ranked_ratings.* FROM ranked_ratings JOIN users ON users.id=user_id WHERE season_id=? ORDER BY rating DESC,wins DESC,users.username COLLATE NOCASE,users.id').all(seasonId).map((row,index)=>({rank:index+1,account:{id:row.id as string,username:row.username as string},rating:row.rating as number,played:row.played as number,wins:row.wins as number,draws:row.draws as number,losses:row.losses as number}));}
  dailyStandings(date:string):DailyStanding[]{return this.db.prepare('SELECT users.id,users.username,daily_scores.* FROM daily_scores JOIN users ON users.id=user_id WHERE date=? ORDER BY tick,users.username COLLATE NOCASE,users.id').all(date).map((row,index)=>({rank:index+1,account:{id:row.id as string,username:row.username as string},matchId:row.match_id as string,tick:row.tick as number,seconds:(row.tick as number)/20}));}
  result(matchId:string):RankedResult|{matchId:string;date:string;won:boolean;tick:number}|null {const row=this.db.prepare('SELECT data FROM competition_results WHERE match_id=?').get(matchId);return row?JSON.parse(row.data as string):null;}
  finish(matchId:string,entry:CompetitionEntry|undefined,state:GameState){
    if(!entry||(state.winner===null&&!state.draw)||this.result(matchId))return;
    if(entry.kind==='ranked'){
      const ratings=entry.participants.map(account=>{
        this.db.prepare('INSERT OR IGNORE INTO ranked_ratings(season_id,user_id,rating) VALUES(?,?,1000)').run(entry.seasonId,account.id);
        return this.db.prepare('SELECT rating FROM ranked_ratings WHERE season_id=? AND user_id=?').get(entry.seasonId,account.id)!.rating as number;
      });
      const score=state.draw?.5:state.winningTeam===state.teams[0]?1:0;
      const change=Math.round(32*(score-1/(1+10**((ratings[1]-ratings[0])/400))));
      const result:RankedResult={matchId,seasonId:entry.seasonId,winner:state.draw?null:entry.participants[score===1?0:1].id,tick:state.tick,ratings:entry.participants.map((account,index)=>({accountId:account.id,before:ratings[index],after:ratings[index]+(index===0?change:-change)}))};
      for(const [index,account] of entry.participants.entries()){
        const own=state.draw?.5:index===0?score:1-score;
        this.db.prepare('UPDATE ranked_ratings SET rating=?,played=played+1,wins=wins+?,draws=draws+?,losses=losses+? WHERE season_id=? AND user_id=?').run(result.ratings[index].after,own===1?1:0,own===.5?1:0,own===0?1:0,entry.seasonId,account.id);
      }
      this.db.prepare('INSERT INTO competition_results(match_id,kind,data) VALUES(?,?,?)').run(matchId,'ranked',JSON.stringify(result));
    }else{
      const won=!state.draw&&state.winningTeam===state.teams[0];
      this.db.prepare('INSERT INTO competition_results(match_id,kind,data) VALUES(?,?,?)').run(matchId,'daily',JSON.stringify({matchId,date:entry.date,won,tick:state.tick}));
      if(won)this.db.prepare('INSERT INTO daily_scores(date,user_id,match_id,tick) VALUES(?,?,?,?) ON CONFLICT(date,user_id) DO UPDATE SET match_id=excluded.match_id,tick=excluded.tick WHERE excluded.tick<daily_scores.tick').run(entry.date,entry.participant.id,matchId,state.tick);
    }
  }
}
