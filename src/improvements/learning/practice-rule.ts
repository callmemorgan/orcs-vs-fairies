import { registerGameImprovement } from '../../core/improvements';
import { openDestination } from '../../core/navigation';
import { isVisible } from '../../core/simulation';
import { practiceUnit } from './scenario';
import type { GameState, JsonValue } from '../../core/types';
export const PRACTICE='feature-002';
export type PracticeProgress={actor:number;fighter:number;origin:{x:number;y:number};mechanic:boolean;initialTarget:number|null;target:number|null;battleStarted:boolean;complete:boolean;failed:boolean};
/** 0 learn the mechanic, 1 ready to fight, 2 fighting, 3 complete, 4 failed. */
export const practiceStage=(s:PracticeProgress)=>s.failed?4:s.complete?3:!s.mechanic?0:s.battleStarted?2:1;
function point(game:GameState,dx:number,dy:number){const home=game.starts[0];return openDestination(game,{x:home.x+dx,y:home.y+dy},home);}
function enemyPoint(game:GameState){const p=point(game,6,4);return p&&isVisible(game,0,p.x,p.y)?p:undefined;}
const data=(value:JsonValue)=>value as PracticeProgress;
registerGameImprovement({id:PRACTICE,
 initialState:():PracticeProgress=>({actor:0,fighter:0,origin:{x:0,y:0},mechanic:false,initialTarget:null,target:null,battleStarted:false,complete:false,failed:false}),
 start:(game,_options,value)=>{
  const state=data(value),faction=game.players[0].faction;
  game.controllers[1]='external';game.players[0].upgrades.push('town-age');
  const fighter=game.entities.find(e=>e.side===0&&e.role==='melee')!;fighter.order={type:'hold'};
  state.fighter=fighter.id;state.origin={x:fighter.x,y:fighter.y};
  if(faction==='orcs'||faction==='automata')state.actor=fighter.id;
  else{const [dx,dy]=faction==='undead'?[-4,-3]:[3,4],p=point(game,dx,dy);if(!p){state.failed=true;return;}state.actor=practiceUnit(game,0,'special',p).id;}
  if(faction==='tideborn')fighter.hp-=50;
  if(faction==='automata'){fighter.shield=0;fighter.lastDamagedAt=0;}
  if(faction==='undead'){const p=enemyPoint(game);if(!p){state.failed=true;return;}const enemy=practiceUnit(game,1,'melee',p);enemy.hp=Math.min(enemy.hp,30);state.initialTarget=enemy.id;}
 },
 step:(game,_dt,value)=>{
  const state=data(value);if(state.complete||state.failed)return;
  const actor=game.entities.find(e=>e.id===state.actor&&e.hp>0),fighter=game.entities.find(e=>e.id===state.fighter&&e.hp>0);
  if(!actor||!fighter){state.failed=true;return;}
  const faction=game.players[0].faction;
  state.mechanic ||=faction==='orcs'?actor.momentum>=.45:
   faction==='fairies'?game.entities.some(e=>e.side===0&&e.illusion&&e.hp>0):
   faction==='dwarves'?actor.entrenchedAt!==undefined&&game.time-actor.entrenchedAt>=3:
   faction==='undead'?game.entities.some(e=>e.side===0&&e.raised&&e.hp>0):
   faction==='tideborn'?(fighter.surgeUntil??0)>game.time:
   Math.hypot(fighter.x-state.origin.x,fighter.y-state.origin.y)>=2&&(fighter.shield??0)>=(fighter.maxShield??1);
  state.complete ||=state.battleStarted&&game.entities.every(e=>e.id!==state.target||e.hp<=0);
 },
 validate:(game,side,command,value)=>{
  const state=data(value);return side===0&&command.action==='battle'&&command.ids.length===0&&command.payload===undefined&&practiceStage(state)===1&&!!enemyPoint(game);
 },
 command:(game,_side,_command,value)=>{
  const state=data(value),p=enemyPoint(game);if(!p)return false;
  const enemy=practiceUnit(game,1,'melee',p);enemy.hp=Math.min(enemy.hp,65);state.target=enemy.id;state.battleStarted=true;return true;
 },observe:(_game,side,value)=>side===0?value:null
});
