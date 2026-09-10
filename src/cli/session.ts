import { createHash } from 'node:crypto';
import { FACTIONS } from '../core/content';
import { PlayerView } from '../core/observation';
import { createGame, isGameOver, issueCommand, stepGame } from '../core/simulation';
import type { Command, FactionId, GameState, MapSize, Side } from '../core/types';
const roles=['worker','melee','ranged','special'];
const buildings=['hq','depot','barracks','tower'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown):v is number=>Number.isSafeInteger(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const keys=(o:Record<string,unknown>,allowed:string[])=>Object.keys(o).every(k=>allowed.includes(k));
function validateCommand(v:unknown):v is Command{
 if(!record(v)||typeof v.type!=='string')return false;
 if(v.type==='train')return keys(v,['type','id','role'])&&integer(v.id)&&roles.includes(v.role as string);
 if(!Array.isArray(v.ids)||!v.ids.length||v.ids.length>100||!v.ids.every(integer))return false;
 if(['stop','hold','ability'].includes(v.type))return keys(v,['type','ids']);
 if(['move','attackMove'].includes(v.type))return keys(v,['type','ids','x','y'])&&finite(v.x)&&finite(v.y);
 if(['attack','gather','repair'].includes(v.type))return keys(v,['type','ids','target'])&&integer(v.target);
 return v.type==='build'&&keys(v,['type','ids','role','x','y'])&&buildings.includes(v.role as string)&&finite(v.x)&&finite(v.y);
}
export interface ReplayEntry {input:unknown;hash:string}
export function stateHash(s:GameState):string{
 const json=JSON.stringify({...s,visible:s.visible.map(x=>[...x].sort((a,b)=>a-b)),explored:s.explored.map(x=>[...x].sort((a,b)=>a-b))});
 return createHash('sha256').update(json).digest('hex');
}
export class TerminalSession {
 state:GameState|undefined;
 private view:PlayerView|undefined;
 readonly replay:ReplayEntry[]=[];
 handle(input:unknown):unknown{
  if(!record(input)||typeof input.op!=='string')throw new Error('Expected an object with an op string.');
  let result:unknown;
  if(input.op==='start'){
   if(this.state)throw new Error('A match already exists. Start a new process for another match.');
   if(!keys(input,['op','faction','opponent','side','seed','mapSize']))throw new Error('Unknown start field.');
   const faction=input.faction??'orcs',opponent=input.opponent??'fairies',size=input.mapSize??'medium',seed=input.seed??4127,side=input.side??1;
   if(typeof faction!=='string'||!Object.hasOwn(FACTIONS,faction)||typeof opponent!=='string'||!Object.hasOwn(FACTIONS,opponent))throw new Error('Unknown faction.');
   if(!['small','medium','large'].includes(size as string)||!integer(seed)||seed<0||seed>0xffffffff||(side!==0&&side!==1))throw new Error('Invalid map size, seed or side.');
   this.state=createGame((side===0?faction:opponent) as FactionId,seed,(side===1?faction:opponent) as FactionId,{mapSize:size as MapSize,controllers:side===0?['external','ai']:['ai','external']});
   this.view=new PlayerView(side);result=this.view.observe(this.state);
  }else{
   if(!this.state||!this.view)throw new Error('Start a match first.');
   const s=this.state,view=this.view;
   if(input.op==='observe'){
    if(!keys(input,['op']))throw new Error('Unknown observe field.');result=view.observe(s);
   }else if(input.op==='command'){
    if(!keys(input,['op','command'])||!validateCommand(input.command))throw new Error('Malformed command.');
    result={accepted:issueCommand(s,view.side,input.command),tick:s.tick};view.update(s);
   }else if(input.op==='advance'){
    if(!keys(input,['op','ticks'])||!integer(input.ticks)||input.ticks<1||input.ticks>1200)throw new Error('ticks must be an integer from 1 to 1200 (at 20 ticks/second).');
    const events=[];let advanced=0;
    for(;advanced<input.ticks&&!isGameOver(s);advanced++){stepGame(s,.05);view.update(s);events.push(...view.events(s));}
    result={advanced,events,observation:view.observe(s)};
   }else if(input.op==='result'){
    if(!keys(input,['op']))throw new Error('Unknown result field.');result={finished:isGameOver(s),winner:s.winner,draw:s.draw,time:s.time,tick:s.tick,side:view.side,outcome:isGameOver(s)?s.draw?'draw':s.winner===view.side?'win':'loss':null};
   }else throw new Error('Unknown op. Use start, observe, command, advance or result.');
  }
  this.replay.push({input:structuredClone(input),hash:stateHash(this.state!)});
  return {ok:true,result};
 }
}
export function replayMatch(entries:ReplayEntry[]){
 const session=new TerminalSession();let response:unknown;
 for(const [i,entry] of entries.entries()){
  response=session.handle(entry.input);
  if(session.replay.at(-1)!.hash!==entry.hash)throw new Error(`Replay diverged at entry ${i+1}.`);
 }
 return {verified:entries.length,response};
}
