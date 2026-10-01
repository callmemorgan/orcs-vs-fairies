import { PROMOTIONS } from './unit-progression';
import { isEconomyCommand, validateEconomyCommand } from './economy-validation';
import { UPGRADES } from './content';
import type { AlliedCommand, Command } from './types';

const roles=['worker','melee','ranged','special','spear','cavalry','siege'];
const buildings=['hq','depot','barracks','tower','wall','gate'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0;
const index=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
const definition=(v:unknown)=>v===undefined||typeof v==='string'&&/^[a-z][a-z0-9:-]{0,99}$/.test(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const keys=(o:Record<string,unknown>,allowed:string[])=>Object.keys(o).every(k=>allowed.includes(k));
const side=(v:unknown):v is number=>index(v)&&(v as number)<8;
const cost=(v:unknown):boolean=>record(v)&&keys(v,['wood','ore','crystal'])&&['wood','ore','crystal'].every(k=>finite(v[k])&&(v[k] as number)>=0&&(v[k] as number)<=1e9)&&['wood','ore','crystal'].some(k=>(v[k] as number)>0);
export function isPlayerCommand(command:Command):command is AlliedCommand{return ['allyDirective','cancelAllyDirective','transferResources'].includes(command.type);}

/** One strict command boundary for terminal, replay, and future remote inputs. */
export function validateCommand(v:unknown):v is Command {
  if(!record(v)||typeof v.type!=='string')return false;
  if(isEconomyCommand(v as {type:string}))return validateEconomyCommand(v);
  const queued=['move','attackMove','attack','gather','repair'].includes(v.type);
  if('queued' in v&&(!queued||typeof v.queued!=='boolean'))return false;
  if(v.type==='draftChoice')return keys(v,['type','definitionId'])&&typeof v.definitionId==='string'&&v.definitionId.length>0&&v.definitionId.length<=128;
  if(v.type==='collectRelic')return keys(v,['type','id','relicId'])&&id(v.id)&&id(v.relicId);
  if(v.type==='dropRelic')return keys(v,['type','id'])&&id(v.id);
  const allowed=(fields:string[])=>keys(v,queued?[...fields,'queued']:fields);
  if(v.type==='transferResources')return allowed(['type','recipient','resources'])&&side(v.recipient)&&cost(v.resources);
  if(v.type==='cancelAllyDirective')return allowed(['type','directiveId'])&&id(v.directiveId);
  if(v.type==='allyDirective'){
    if(!side(v.ally))return false;
    if(v.directive==='support')return allowed(['type','ally','directive','resources'])&&cost(v.resources);
    if(v.directive==='attack'&&'target' in v)return allowed(['type','ally','directive','target'])&&id(v.target);
    return ['defend','scout','attack'].includes(v.directive as string)&&allowed(['type','ally','directive','x','y','level'])&&finite(v.x)&&finite(v.y)&&(v.level===undefined||Number.isInteger(v.level)&&(v.level as number)>=0&&(v.level as number)<=1);
  }
  if(v.type==='cancelTrain')return allowed(['type','id','index'])&&id(v.id)&&index(v.index);
  if(v.type==='reorderTrain')return allowed(['type','id','from','to'])&&id(v.id)&&index(v.from)&&index(v.to);
  if(v.type==='train')return allowed(['type','id','role','definitionId'])&&id(v.id)&&roles.includes(v.role as string)&&definition(v.definitionId);
  if(v.type==='research')return allowed(['type','id','upgrade'])&&id(v.id)&&typeof v.upgrade==='string'&&(Object.hasOwn(UPGRADES,v.upgrade)||/^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(v.upgrade));
  if(v.type==='promote')return allowed(['type','id','promotion'])&&id(v.id)&&typeof v.promotion==='string'&&Object.hasOwn(PROMOTIONS,v.promotion);
  if(['recoverArtifact','equipArtifact','dropArtifact'].includes(v.type))return allowed(['type','id','artifact'])&&id(v.id)&&id(v.artifact);
  if(v.type==='unequipArtifact')return allowed(['type','id','slot'])&&id(v.id)&&['weapon','armor','trinket'].includes(v.slot as string);
  if(v.type==='fieldRepair')return allowed(['type','id','target'])&&id(v.id)&&id(v.target);
  if(!Array.isArray(v.ids)||!v.ids.length||v.ids.length>100||!v.ids.every(id))return false;
  if(v.type==='warChant')return allowed(['type','ids','chant'])&&['assault','bulwark'].includes(v.chant as string);
  if(v.type==='trophyStandard')return allowed(['type','ids']);
  if(['illusionSwap','tunnelTravel','collectCorpses','deliverCorpses'].includes(v.type))return allowed(['type','ids','target'])&&id(v.target);
  if(v.type==='modifyArtillery')return allowed(['type','ids','modification'])&&['stone','grapeshot','incendiary','reinforced'].includes(v.modification as string);
  if(v.type==='buildFactionStructure')return allowed(['type','ids','structure','x','y','level'])&&['enchanted-grove','tunnel','necropolis','power-relay'].includes(v.structure as string)&&finite(v.x)&&finite(v.y)&&(v.level===undefined||index(v.level)&&v.level<=1);
  if(v.type==='shapeWater')return allowed(['type','ids','x','y','level','terrain'])&&['mud','shallows','water'].includes(v.terrain as string)&&finite(v.x)&&finite(v.y)&&(v.level===undefined||index(v.level)&&v.level<=1);
  if(v.type==='formation')return allowed(['type','ids','formation','spacing','facing'])&&['line','wedge','square','loose'].includes(v.formation as string)&&finite(v.spacing)&&v.spacing>=.65&&v.spacing<=3&&index(v.facing)&&v.facing<=7;
  if(v.type==='face')return allowed(['type','ids','facing'])&&index(v.facing)&&v.facing<=7;
  if(v.type==='ambush')return allowed(['type','ids','radius','target'])&&finite(v.radius)&&v.radius>=.75&&v.radius<=10&&['any','unit','building',...roles].includes(v.target as string);
  if(v.type==='releaseAmbush')return allowed(['type','ids']);
  if(v.type==='captureSiege')return allowed(['type','ids','target'])&&id(v.target);
  if(['stop','hold','clearRally','toggleGate'].includes(v.type))return allowed(['type','ids']);
  if(['move','attackMove','setRally','ignite','firebreak'].includes(v.type))return allowed(['type','ids','x','y','level'])&&finite(v.x)&&finite(v.y)&&(v.level===undefined||Number.isInteger(v.level)&&(v.level as number)>=0&&(v.level as number)<=1);
  if(v.type==='traverse')return allowed(['type','ids','transition'])&&id(v.transition);
  if(['worldAttack','repairBridge','captureSite','supportVillage','recruitVillage'].includes(v.type))return allowed(['type','ids','target'])&&id(v.target);
  if(v.type==='ability')return allowed(['type','ids','x','y','level','target'])&&(!('target' in v)||id(v.target))&&(!('level' in v)||index(v.level)&&(v.level as number)<=1)&&((!('x' in v)&&!('y' in v))||finite(v.x)&&finite(v.y))&&(!(('x' in v)||('y' in v))||!('target' in v));
  if(v.type==='engineerBuild')return allowed(['type','ids','kind','x','y','level'])&&['bridge','barricade'].includes(v.kind as string)&&finite(v.x)&&finite(v.y)&&(!('level' in v)||index(v.level)&&(v.level as number)<=1);
  if(['attack','gather','repair'].includes(v.type))return allowed(['type','ids','target'])&&id(v.target);
  return v.type==='build'&&allowed(['type','ids','role','x','y','definitionId','level'])&&definition(v.definitionId)&&(v.level===undefined||Number.isInteger(v.level)&&(v.level as number)>=0&&(v.level as number)<=1)&&buildings.includes(v.role as string)&&finite(v.x)&&finite(v.y);
}
