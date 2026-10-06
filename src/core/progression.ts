import { FACTIONS, UPGRADES } from './content';
import type { Age, Entity, GameState, Player, Side, UnitRole, UpgradeDef, UpgradeId } from './types';

export const AGE_NAMES:Record<Age,string>={1:'Settlement Age',2:'Town Age',3:'Citadel Age'};
export function playerAge(player:Player):Age {
  return player.upgrades.includes('citadel-age')?3:player.upgrades.includes('town-age')?2:1;
}

export function upgradeEnabled(s:GameState,def:UpgradeDef):boolean {
  return !def.improvement||!!s.improvements?.[def.improvement];
}

/** Shared by command validation, AI and the technology tree. */
export function researchRequirement(s:GameState,side:Side,id:UpgradeId):string|undefined {
  const player=s.players[side],def=UPGRADES[id];
  if(!upgradeEnabled(s,def))return 'Technology disabled for this match';
  if(player.upgrades.includes(id))return 'Already researched';
  if(s.entities.some(e=>e.side===side&&e.hp>0&&e.research===id))return 'Already researching';
  if(playerAge(player)<(def.age??1))return `Requires ${AGE_NAMES[def.age!]}`;
  const missing=def.requires?.find(required=>!player.upgrades.includes(required));
  if(missing)return `Requires ${UPGRADES[missing].name}`;
  return undefined;
}

/** Shared base statistics for UI and simulation; terrain and ability bonuses apply separately. */
export function upgradeEffects(player:Player,role:Entity['role']){
 const effects={gather:1,speed:1,damage:1,armor:0};
 for(const id of player.upgrades){const def=UPGRADES[id];if(def.appliesTo!==role)continue;const e=def.effects;
  effects.gather*=e.gather??1;effects.speed*=e.speed??1;effects.damage*=e.damage??1;effects.armor+=e.armor??0;
 }
 return effects;
}
export function effectiveUnitStats(player:Player,role:UnitRole){
 const base=FACTIONS[player.faction].units[role],effects=upgradeEffects(player,role);
 return {...base,damage:base.damage*effects.damage,speed:base.speed*effects.speed,armor:base.armor+effects.armor};
}
