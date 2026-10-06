import { FACTIONS, UPGRADES } from './content';
import type { Age, Entity, GameState, Player, Side, UnitRole, UpgradeDef, UpgradeId } from './types';

export const AGE_NAMES:Record<Age,string>={1:'Settlement Age',2:'Town Age',3:'Citadel Age'};
export function playerAge(player:Player):Age {
  return player.upgrades.includes('citadel-age')?3:player.upgrades.includes('town-age')?2:1;
}

export function upgradeEnabled(s:GameState,def:UpgradeDef):boolean {
  return !def.improvement||!!s.improvements?.[def.improvement];
}

function activeResearch(s:GameState,side:Side):UpgradeId[] {
  return s.entities.flatMap(e=>e.side===side&&e.hp>0&&e.research?[e.research]:[]);
}

/** Shared by command validation, AI and the technology tree. */
export function researchRequirement(s:GameState,side:Side,id:UpgradeId):string|undefined {
  const player=s.players[side],def=UPGRADES[id];
  if(!upgradeEnabled(s,def))return 'Technology disabled for this match';
  if(player.upgrades.includes(id))return 'Already researched';
  const pending=activeResearch(s,side);
  if(def.branch){
   const choice=player.researchChoices?.[def.branch]??[...player.upgrades,...pending].find(other=>UPGRADES[other].branch===def.branch);
   if(choice&&choice!==id)return `Excluded by ${UPGRADES[choice].name}`;
  }
  if(pending.includes(id))return 'Already researching';
  if(playerAge(player)<(def.age??1))return `Requires ${AGE_NAMES[def.age!]}`;
  const missing=def.requires?.find(required=>!player.upgrades.includes(required));
  if(missing)return `Requires ${UPGRADES[missing].name}`;
  return undefined;
}

/** Shared base statistics for UI and simulation; terrain and ability bonuses apply separately. */
export function upgradeEffects(player:Player,role:Entity['role']){
 const effects={gather:1,speed:1,damage:1,armor:0};
 for(const id of player.upgrades){const def=UPGRADES[id];if(!upgradeAppliesTo(def,role))continue;const e=def.effects;
  effects.gather*=e.gather??1;effects.speed*=e.speed??1;effects.damage*=e.damage??1;effects.armor+=e.armor??0;
 }
 return effects;
}
export function effectiveUnitStats(player:Player,role:UnitRole){
 const base=FACTIONS[player.faction].units[role],effects=upgradeEffects(player,role);
 return {...base,damage:base.damage*effects.damage,speed:base.speed*effects.speed,armor:base.armor+effects.armor};
}

export function upgradeAppliesTo(def:UpgradeDef,role:Entity['role']):boolean {
 return Array.isArray(def.appliesTo)?def.appliesTo.some(r=>r===role):def.appliesTo===role;
}

/** Save loaders can reject contradictory completed, reserved or in-flight branches. */
export function researchBranchesValid(s:GameState):boolean {
 for(const side of [0,1] as Side[]){
  const player=s.players[side],choices=new Map<string,UpgradeId>(Object.entries(player.researchChoices??{}));
  if([...choices].some(([branch,id])=>UPGRADES[id]?.branch!==branch))return false;
  for(const id of [...player.upgrades,...activeResearch(s,side)]){
   const def=UPGRADES[id];if(!def)return false;if(!def.branch)continue;
   if((choices.get(def.branch)??id)!==id)return false;choices.set(def.branch,id);
  }
 }
 return true;
}
