import type { Cost, FactionId, TerrainKind } from './types';
import type { CampaignSoldier } from './campaign';
import type { ScenarioCheckpoint, ScenarioSession } from './scenario-types';
import type { ScenarioRecorder, ScenarioRecording } from './scenario-recordings';

export interface ConquestRegionDefinition {
  id: string; name: string; owner: FactionId; neighbors: string[]; terrain: TerrainKind;
  garrison: number; supply: Cost; objective: 'siege' | 'crossing' | 'hold'; briefing: string;
}
export interface ConquestWorldDefinition { id: string; title: string; introduction: string; regions: ConquestRegionDefinition[] }
export interface ConquestRegion { owner: FactionId; garrison: number }
export interface ConquestRelation { score: number; warPressure: number; alliance: boolean; truceUntil: number; treasury: Cost }
export interface ConquestBattle {
  regionId: string; mode: 'attack' | 'passage'; deployedIds: number[];
  checkpoint: ScenarioCheckpoint; recording: ScenarioRecording;
}
export type ConquestAction =
  | { type: 'tribute'; faction: FactionId; amount: number }
  | { type: 'truce'; faction: FactionId; turns: number }
  | { type: 'alliance'; faction: FactionId }
  | { type: 'wait' }
  | { type: 'battle'; regionId: string; mode: 'attack' | 'passage'; recording: ScenarioRecording };
export interface ConquestProfile {
  format: 'orcs-vs-fairies-conquest'; version: 1; id: string; worldId: string; faction: FactionId;
  turn: number; treasury: Cost; regions: Record<string, ConquestRegion>; relations: Record<string, ConquestRelation>;
  army: CampaignSoldier[]; history: ConquestAction[]; active: ConquestBattle | null;
}
export interface ConquestMission { profile: ConquestProfile; session: ScenarioSession; recorder: ScenarioRecorder }
