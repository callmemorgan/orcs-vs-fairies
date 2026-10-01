import { OnlineApi } from './client';
import type { FactionId } from '../core/types';
import type { Account } from './protocol';
import type { Cosmetic, CosmeticProfile, CosmeticEquipment, MatchCosmeticEquipment } from './cosmetics';
export class CosmeticApi extends OnlineApi {
  cosmetics(){return this.request<{catalog:Cosmetic[];profile:CosmeticProfile;rules:string;account?:Account}>('/api/cosmetics');}
  equip(factionId:FactionId,expectedRevision:number,loadout:CosmeticEquipment){return this.request<{equipped:{factionId:FactionId;revision:number;loadout:CosmeticEquipment};profile:CosmeticProfile;account?:Account}>('/api/cosmetics/equip',{factionId,expectedRevision,loadout});}
  matchCosmetics(matchId:string){return this.request<{players:MatchCosmeticEquipment[]}>('/api/matches/'+encodeURIComponent(matchId)+'/cosmetics');}
  claimCampaignVictory(missionId:string,recording:unknown){return this.request<{verified:{campaignId:string;missionId:string;factionId:FactionId};profile:CosmeticProfile}>('/api/cosmetics/campaign-victory',{missionId,recording},60000);}
}
