import { UPGRADES } from './content';
import type { Command } from './types';

const roles=['worker','melee','ranged','special','spear','cavalry','siege'];
const buildings=['hq','depot','barracks','tower','wall','gate'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>0;
const index=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
const definition=(v:unknown)=>v===undefined||typeof v==='string'&&/^[a-z][a-z0-9:-]{0,99}$/.test(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const keys=(o:Record<string,unknown>,allowed:string[])=>Object.keys(o).every(k=>allowed.includes(k));

/** One strict command boundary for terminal, replay, and future remote inputs. */
export function validateCommand(v:unknown):v is Command {
  if(!record(v)||typeof v.type!=='string')return false;
  const queued=['move','attackMove','attack','gather','repair'].includes(v.type);
  if('queued' in v&&(!queued||typeof v.queued!=='boolean'))return false;
  const allowed=(fields:string[])=>keys(v,queued?[...fields,'queued']:fields);
  if(v.type==='cancelTrain')return allowed(['type','id','index'])&&id(v.id)&&index(v.index);
  if(v.type==='reorderTrain')return allowed(['type','id','from','to'])&&id(v.id)&&index(v.from)&&index(v.to);
  if(v.type==='train')return allowed(['type','id','role','definitionId'])&&id(v.id)&&roles.includes(v.role as string)&&definition(v.definitionId);
  if(v.type==='research')return allowed(['type','id','upgrade'])&&id(v.id)&&typeof v.upgrade==='string'&&(Object.hasOwn(UPGRADES,v.upgrade)||/^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,58}$/.test(v.upgrade));
  if(!Array.isArray(v.ids)||!v.ids.length||v.ids.length>100||!v.ids.every(id))return false;
  if(['stop','hold','ability','clearRally','toggleGate'].includes(v.type))return allowed(['type','ids']);
  if(['move','attackMove','setRally'].includes(v.type))return allowed(['type','ids','x','y'])&&finite(v.x)&&finite(v.y);
  if(['attack','gather','repair'].includes(v.type))return allowed(['type','ids','target'])&&id(v.target);
  return v.type==='build'&&allowed(['type','ids','role','x','y','definitionId'])&&definition(v.definitionId)&&buildings.includes(v.role as string)&&finite(v.x)&&finite(v.y);
}
