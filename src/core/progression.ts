import { UPGRADES } from './content';
import type { Age, GameState, Player, Side, UpgradeId } from './types';

export const AGE_NAMES:Record<Age,string>={1:'Settlement Age',2:'Town Age',3:'Citadel Age'};
export function playerAge(player:Player):Age {
  return player.upgrades.includes('citadel-age')?3:player.upgrades.includes('town-age')?2:1;
}

/** Shared by command validation, AI and the technology tree. */
export function researchRequirement(s:GameState,side:Side,id:UpgradeId):string|undefined {
  const player=s.players[side],def=UPGRADES[id];
  if(player.upgrades.includes(id))return 'Already researched';
  if(s.entities.some(e=>e.side===side&&e.hp>0&&e.research===id))return 'Already researching';
  if(playerAge(player)<(def.age??1))return `Requires ${AGE_NAMES[def.age!]}`;
  const missing=def.requires?.find(required=>!player.upgrades.includes(required));
  if(missing)return `Requires ${UPGRADES[missing].name}`;
  return undefined;
}
