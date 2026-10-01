import type { DatabaseSync } from 'node:sqlite';
import { COSMETICS, EMPTY_COSMETIC_EQUIPMENT } from '../online/cosmetics';
import type { CosmeticEquipment, CosmeticProfile } from '../online/cosmetics';
import type { FactionId } from '../core/types';

export class CosmeticRequestError extends Error {constructor(readonly status:number,message:string){super(message);}}
const isRecord=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

export class CosmeticStore {
  constructor(private db:DatabaseSync){db.exec(`
    CREATE TABLE IF NOT EXISTS cosmetic_awards(source_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),faction_id TEXT NOT NULL,PRIMARY KEY(source_id,user_id));
    CREATE TABLE IF NOT EXISTS cosmetic_wins(user_id TEXT NOT NULL REFERENCES users(id),faction_id TEXT NOT NULL,wins INTEGER NOT NULL,PRIMARY KEY(user_id,faction_id));
    CREATE TABLE IF NOT EXISTS cosmetic_unlocks(user_id TEXT NOT NULL REFERENCES users(id),cosmetic_id TEXT NOT NULL,source_id TEXT NOT NULL,PRIMARY KEY(user_id,cosmetic_id));
    CREATE TABLE IF NOT EXISTS cosmetic_equipment(user_id TEXT NOT NULL REFERENCES users(id),faction_id TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,faction_id));`);}
  /** Caller must verify the outcome and own the transaction. There is no public award endpoint. */
  awardVerifiedVictory(sourceId:string,accountId:string,factionId:FactionId){
    if(!sourceId||sourceId.length>256||!COSMETICS.some(item=>item.factionId===factionId))throw new Error('Invalid verified cosmetic award source.');
    const inserted=this.db.prepare('INSERT OR IGNORE INTO cosmetic_awards(source_id,user_id,faction_id) VALUES(?,?,?)').run(sourceId,accountId,factionId);
    if(inserted.changes===0)return;
    this.db.prepare('INSERT INTO cosmetic_wins(user_id,faction_id,wins) VALUES(?,?,1) ON CONFLICT(user_id,faction_id) DO UPDATE SET wins=wins+1').run(accountId,factionId);
    const wins=this.db.prepare('SELECT wins FROM cosmetic_wins WHERE user_id=? AND faction_id=?').get(accountId,factionId)!.wins as number;
    for(const item of COSMETICS.filter(item=>item.factionId===factionId&&item.requiresWins<=wins))this.db.prepare('INSERT OR IGNORE INTO cosmetic_unlocks(user_id,cosmetic_id,source_id) VALUES(?,?,?)').run(accountId,item.id,sourceId);
  }
  awardCampaignVictory(accountId:string,result:{campaignId:string;missionId:string;factionId:FactionId}){
    this.db.exec('BEGIN IMMEDIATE');
    try{this.awardVerifiedVictory(`campaign:${accountId}:${result.campaignId}:${result.missionId}`,accountId,result.factionId);this.db.exec('COMMIT');return this.profile(accountId);}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  profile(accountId:string):CosmeticProfile{
    const owned=this.db.prepare('SELECT cosmetic_id FROM cosmetic_unlocks WHERE user_id=? ORDER BY cosmetic_id').all(accountId).map(row=>row.cosmetic_id as string);
    const wins=Object.fromEntries(this.db.prepare('SELECT faction_id,wins FROM cosmetic_wins WHERE user_id=?').all(accountId).map(row=>[row.faction_id,row.wins]));
    const equipment=Object.fromEntries(this.db.prepare('SELECT faction_id,revision,data FROM cosmetic_equipment WHERE user_id=?').all(accountId).map(row=>[row.faction_id,{revision:row.revision as number,loadout:JSON.parse(row.data as string)}]));
    return {owned,wins,equipment};
  }
  loadout(accountId:string,factionId:FactionId):CosmeticEquipment{
    const row=this.db.prepare('SELECT data FROM cosmetic_equipment WHERE user_id=? AND faction_id=?').get(accountId,factionId);
    return row?JSON.parse(row.data as string):{...EMPTY_COSMETIC_EQUIPMENT};
  }
  equip(accountId:string,value:Record<string,unknown>){
    if(Object.keys(value).some(key=>!['factionId','expectedRevision','loadout'].includes(key))||!COSMETICS.some(item=>item.factionId===value.factionId)||!Number.isSafeInteger(value.expectedRevision)||(value.expectedRevision as number)<0||!isRecord(value.loadout)||Object.keys(value.loadout).length!==3||!['banner','decoration','portrait'].every(slot=>Object.hasOwn(value.loadout as object,slot)))throw new CosmeticRequestError(400,'Choose a known faction, its current revision and all three cosmetic slots.');
    const factionId=value.factionId as FactionId,loadout=value.loadout as unknown as CosmeticEquipment;
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const profile=this.profile(accountId),current=profile.equipment[factionId]?.revision??0;
      if(value.expectedRevision!==current)throw new CosmeticRequestError(409,'Cosmetic choices changed. Refresh before applying.');
      for(const slot of ['banner','decoration','portrait'] as const){const id=loadout[slot];if(id===null)continue;const item=COSMETICS.find(item=>item.id===id&&item.factionId===factionId&&item.slot===slot);if(!item)throw new CosmeticRequestError(400,'The cosmetic must match its faction and slot.');if(!profile.owned.includes(id))throw new CosmeticRequestError(403,'Earn this cosmetic before equipping it.');}
      const revision=current+1;
      this.db.prepare('INSERT INTO cosmetic_equipment(user_id,faction_id,revision,data) VALUES(?,?,?,?) ON CONFLICT(user_id,faction_id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(accountId,factionId,revision,JSON.stringify(loadout));
      this.db.exec('COMMIT');return {factionId,revision,loadout};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
}
