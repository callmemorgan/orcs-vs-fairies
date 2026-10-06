import { registerGameImprovement } from '../../core/improvements';
import { practiceUnit } from './scenario';
import { openDestination } from '../../core/navigation';
import { isVisible } from '../../core/simulation';
import type { GameState, JsonValue } from '../../core/types';
export const TUTORIAL='feature-001';
/** A type alias (not an interface) so the progress record stays assignable to JsonValue. */
export type TutorialProgress={ gathered:number; built:boolean; recruited:boolean; target:number|null; battleStarted:boolean; complete:boolean };
/** 0 gather, 1 build, 2 recruit, 3 battle, 4 complete. */
export const tutorialStage=(s:TutorialProgress)=>s.gathered<18?0:!s.built?1:!s.recruited?2:!s.complete?3:4;
const progress=(state:JsonValue)=>state as TutorialProgress;
function enemyPoint(game:GameState){const home=game.starts[0],point=openDestination(game,{x:home.x+6,y:home.y+4},home);return point&&isVisible(game,0,point.x,point.y)?point:undefined;}
registerGameImprovement({
 id:TUTORIAL,
 initialState:():TutorialProgress=>({gathered:0,built:false,recruited:false,target:null,battleStarted:false,complete:false}),
 start:game=>{game.controllers[1]='external';},
 step:(game,_dt,value)=>{
  const state=progress(value);
  for(const event of game.events){
   if(event.side!==0)continue;
   if(event.type==='gather')state.gathered+=event.amount??0;
   if(event.type==='train'&&game.entities.some(e=>e.id===event.source&&e.role==='melee'))state.recruited=true;
  }
  state.built ||=game.entities.some(e=>e.side===0&&e.role==='barracks'&&e.progress===1&&e.hp>0);
  state.complete ||=state.battleStarted&&game.entities.every(e=>e.id!==state.target||e.hp<=0);
 },
 validate:(game,side,command,value)=>{
  const state=progress(value);
  return side===0&&command.action==='battle'&&command.ids.length===0&&command.payload===undefined&&tutorialStage(state)===3&&!state.battleStarted&&!!enemyPoint(game);
 },
 command:(game,_side,_command,value)=>{
  const state=progress(value),point=enemyPoint(game);if(!point)return false;
  const target=practiceUnit(game,1,'melee',point);
  target.hp=Math.min(target.hp,65);state.target=target.id;state.battleStarted=true;return true;
 },
 observe:(_game,side,state)=>side===0?state:null
});
