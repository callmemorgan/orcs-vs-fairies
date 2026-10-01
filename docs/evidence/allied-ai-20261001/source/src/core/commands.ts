import { UPGRADES } from './content';
import type { AlliedCommand, Command } from './types';

const roles=['worker','melee','ranged','special','spear','cavalry','siege'];
const buildings=['hq','depot','barracks','tower','wall','gate'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0;
const index=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const keys=(o:Record<string,unknown>,allowed:string[])=>Object.keys(o).every(k=>allowed.includes(k));
const side=(v:unknown):v is number=>index(v)&&(v as number)<8;
const cost=(v:unknown):boolean=>record(v)&&keys(v,['wood','ore','crystal'])&&['wood','ore','crystal'].every(k=>finite(v[k])&&(v[k] as number)>=0&&(v[k] as number)<=1e9)&&['wood','ore','crystal'].some(k=>(v[k] as number)>0);
export function isPlayerCommand(command:Command):command is AlliedCommand{return ['allyDirective','cancelAllyDirective','transferResources'].includes(command.type);}

/** One strict command boundary for terminal, replay, and future remote inputs. */
export function validateCommand(v:unknown):v is Command {
  if(!record(v)||typeof v.type!=='string')return false;
  const queued=['move','attackMove','attack','gather','repair'].includes(v.type);
  if('queued' in v&&(!queued||typeof v.queued!=='boolean'))return false;
  const allowed=(fields:string[])=>keys(v,queued?[...fields,'queued']:fields);
  if(v.type==='transferResources')return allowed(['type','recipient','resources'])&&side(v.recipient)&&cost(v.resources);
  if(v.type==='cancelAllyDirective')return allowed(['type','directiveId'])&&id(v.directiveId);
  if(v.type==='allyDirective'){
    if(!side(v.ally))return false;
    if(v.directive==='support')return allowed(['type','ally','directive','resources'])&&cost(v.resources);
    if(v.directive==='attack'&&'target' in v)return allowed(['type','ally','directive','target'])&&id(v.target);
    return ['defend','scout','attack'].includes(v.directive as string)&&allowed(['type','ally','directive','x','y'])&&finite(v.x)&&finite(v.y);
  }
  if(v.type==='cancelTrain')return allowed(['type','id','index'])&&id(v.id)&&index(v.index);
  if(v.type==='reorderTrain')return allowed(['type','id','from','to'])&&id(v.id)&&index(v.from)&&index(v.to);
  if(v.type==='train')return allowed(['type','id','role'])&&id(v.id)&&roles.includes(v.role as string);
  if(v.type==='research')return allowed(['type','id','upgrade'])&&id(v.id)&&typeof v.upgrade==='string'&&Object.hasOwn(UPGRADES,v.upgrade);
  if(!Array.isArray(v.ids)||!v.ids.length||v.ids.length>100||!v.ids.every(id))return false;
  if(['stop','hold','ability','clearRally','toggleGate'].includes(v.type))return allowed(['type','ids']);
  if(['move','attackMove','setRally'].includes(v.type))return allowed(['type','ids','x','y'])&&finite(v.x)&&finite(v.y);
  if(['attack','gather','repair'].includes(v.type))return allowed(['type','ids','target'])&&id(v.target);
  return v.type==='build'&&allowed(['type','ids','role','x','y'])&&buildings.includes(v.role as string)&&finite(v.x)&&finite(v.y);
}
