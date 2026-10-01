import { upgradeFor } from './content-registry';
import type { Age, BuildingDef, GameState, Player, Side, UnitDef, UpgradeDef, UpgradeId } from './types';

export const AGE_NAMES:Record<Age,string>={1:'Settlement Age',2:'Town Age',3:'Citadel Age'};
export function buildingAgeRequired(def:Pick<BuildingDef,'role'|'age'>):Age {return def.age??(def.role==='hq'?2:1);}
export function playerAge(player:Player):Age {
  return player.upgrades.includes('citadel-age')?3:player.upgrades.includes('town-age')?2:1;
}

/** Shared by command validation, AI and the technology tree. */
function requirement(s:GameState,side:Side,id:UpgradeId,excludeEntity?:number):string|undefined {
  const player=s.players[side],def=upgradeFor(s,side,id);
  if(player.upgrades.includes(id))return 'Already researched';
  const pending=s.entities.filter(e=>e.id!==excludeEntity&&e.side===side&&e.hp>0&&e.research);
  if(pending.some(e=>e.research===id))return 'Already researching';
  if(def.exclusiveGroup){
    const chosen=player.upgrades.find(other=>upgradeFor(s,side,other).exclusiveGroup===def.exclusiveGroup);
    if(chosen)return `Locked by ${upgradeFor(s,side,chosen).name}`;
    const reserved=pending.find(e=>upgradeFor(s,side,e.research!).exclusiveGroup===def.exclusiveGroup);
    if(reserved)return `Locked while ${upgradeFor(s,side,reserved.research!).name} is researching`;
  }
  if(playerAge(player)<(def.age??1))return `Requires ${AGE_NAMES[def.age!]}`;
  const missing=def.requires?.find(required=>!player.upgrades.includes(required));
  if(missing)return `Requires ${upgradeFor(s,side,missing).name}`;
  return undefined;
}

export function researchRequirement(s:GameState,side:Side,id:UpgradeId):string|undefined {return requirement(s,side,id);}

/** Recheck completion against other buildings; the completing building does not block itself. */
export function canCompleteResearch(s:GameState,side:Side,id:UpgradeId,entityId:number):boolean {return requirement(s,side,id,entityId)===undefined;}

/** Optional definition targets narrow a role upgrade without affecting other units in that role. */
export function upgradeAppliesTo(upgrade:UpgradeDef,unit:Pick<UnitDef,'id'|'role'>):boolean {
  return upgrade.appliesTo===unit.role&&(!upgrade.appliesToDefinitions||upgrade.appliesToDefinitions.includes(unit.id));
}
