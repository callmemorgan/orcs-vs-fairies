import { availableUnits, buildingFor } from './content-registry';
import { DIRECTIONS_32, length2D } from './geometry';
import { fogKey, levelOf, sameLevel } from './world-map';
import { walkable } from './navigation';
import { TERRAIN } from './maps';
import type { Command, Entity, GameState, Side, TeamId, UnitRole, Vec } from './types';
import { definitionAllowed, validateModeRoster, type ObjectiveState } from './match-rules';
interface Actions {spawn:(s:GameState,side:Side,kind:Entity['kind'],role:UnitRole,x:number,y:number,progress?:number,definitionId?:string,level?:number)=>Entity;command:(s:GameState,side:Side,c:Command)=>boolean}
const alive=(e:Entity)=>e.hp>0&&!e.illusion;
function freePoint(s:GameState,point:Vec,offset=0):Vec {
 const level=levelOf(point);
 for(let radius=0;radius<=Math.max(s.width,s.height);radius++)for(let i=0;i<(radius?32:1);i++){
  const [dx,dy]=DIRECTIONS_32[(i+offset)%32],x=Math.floor(point.x+dx*radius)+.5,y=Math.floor(point.y+dy*radius)+.5;
  if(x<.5||y<.5||x>s.width-.5||y>s.height-.5)continue;
  if(walkable(s,x,y,level))return {x,y,...(s.world||level?{level}:{})};
 }
 throw new Error('No walkable objective position.');
}
const distance=(a:Vec,b:Vec)=>sameLevel(a,b)?length2D(a.x-b.x,a.y-b.y):Infinity;
/** Cross-level objectives use the same visible entrances and traversal orders as players. */
function objectiveOrder(s:GameState,unit:Entity,target:Vec,command:Actions['command'],attack=true):boolean {
 if(sameLevel(unit,target))return command(s,unit.side,{type:attack?'attackMove':'move',ids:[unit.id],x:target.x,y:target.y,...(target.level===undefined?{}:{level:target.level})});
 const passage=s.world?.transitions.map(transition=>{const entry=[transition.from,transition.to].find(point=>sameLevel(point,unit)),exit=entry===transition.from?transition.to:transition.from;return {transition,entry,exit};}).filter(value=>value.entry&&sameLevel(value.exit,target)).sort((a,b)=>distance(unit,a.entry!)+distance(a.exit,target)-distance(unit,b.entry!)-distance(b.exit,target)||a.transition.id-b.transition.id)[0];
 if(!passage?.entry)return false;
 if(unit.order.type==='traverse'&&unit.order.transition===passage.transition.id)return true;
 if(s.visible[unit.side].has(fogKey(s,passage.entry)))return command(s,unit.side,{type:'traverse',ids:[unit.id],transition:passage.transition.id});
 return command(s,unit.side,{type:attack?'attackMove':'move',ids:[unit.id],...passage.entry});
}
function placeRelic(relic:ObjectiveState['relics'][number],point:Vec){relic.x=point.x;relic.y=point.y;if(point.level===undefined)delete relic.level;else relic.level=point.level;}
export function emptyObjectives(s:Pick<GameState,'width'|'height'> & Partial<Pick<GameState,'world'>>):ObjectiveState {return {hill:{x:Math.floor(s.width/2)+.5,y:Math.floor(s.height/2)+.5,...(s.world?{level:0}:{}),ownerTeam:null,captureTeam:null,captureTicks:0,holdTicks:0,contested:false},relics:[],relicHoldTicks:Array(8).fill(0),survival:{wave:0,nextWaveTick:0,spawnedIds:[],phase:'waiting'}};}
export function initializeObjectives(s:GameState):void {
 s.objectives=emptyObjectives(s);s.objectives.hill={...s.objectives.hill,...freePoint(s,s.objectives.hill)};
 if(s.rules.mode==='relic')for(let i=0;i<s.rules.relic.count;i++){const [dx,dy]=DIRECTIONS_32[Math.round(i*32/s.rules.relic.count)%32],point=freePoint(s,{x:s.width/2+dx*6,y:s.height/2+dy*6},i);s.objectives.relics.push({id:i+1,...point,carrierId:null,heldTeam:null});}
 if(s.rules.mode==='survival'){
  validateModeRoster(s);
  // The wave roster is a published replacement for the opposing starting base/army.
  s.entities=s.entities.filter(e=>s.teams[e.side]===s.rules.survival.defenderTeam);s.objectives.survival.nextWaveTick=s.tick+s.rules.survival.intervalTicks;
 }
}
function finish(s:GameState,team:TeamId,text:string):void {if(s.winner!==null||s.draw)return;s.winningTeam=team;s.winner=s.teams.findIndex(t=>t===team) as Side;const point=s.starts[s.winner];s.events.push({type:'message',side:s.winner,...point,text});}
export function collectRelic(s:GameState,side:Side,id:number,relicId:number):boolean {
 if(s.rules.mode!=='relic'||s.draft.status!=='complete')return false;
 const unit=s.entities.find(e=>e.id===id&&e.side===side&&e.kind==='unit'&&alive(e)),relic=s.objectives.relics.find(r=>r.id===relicId);
 if(!unit||!relic||relic.carrierId!==null||s.objectives.relics.some(r=>r.carrierId===id)||distance(unit,relic)>s.rules.relic.pickupRadius)return false;
 relic.carrierId=id;relic.heldTeam=null;placeRelic(relic,unit);s.events.push({type:'message',side,x:unit.x,y:unit.y,...(unit.level===undefined?{}:{level:unit.level}),text:`Relic ${relicId} collected`,source:id});return true;
}
export function dropRelic(s:GameState,side:Side,id:number):boolean {
 const unit=s.entities.find(e=>e.id===id&&e.side===side&&e.kind==='unit'&&alive(e)),relic=s.objectives.relics.find(r=>r.carrierId===id);if(!unit||!relic)return false;
 relic.carrierId=null;relic.heldTeam=null;placeRelic(relic,unit);return true;
}
export function evaluateObjectives(s:GameState,actions:Actions):void {
 if(s.winner!==null||s.draw)return;
 if(s.rules.mode==='hill'){
  const h=s.objectives.hill,present=[...new Set(s.entities.filter(e=>alive(e)&&e.kind==='unit'&&!s.eliminated[e.side]&&distance(e,h)<=s.rules.hill.radius).map(e=>s.teams[e.side]))];
  h.contested=present.length>1;
  if(present.length!==1){h.captureTeam=null;h.captureTicks=0;if(h.contested)h.holdTicks=0;return;}
  const team=present[0];if(h.ownerTeam!==team){if(h.captureTeam!==team){h.captureTeam=team;h.captureTicks=0;}h.captureTicks++;h.holdTicks=0;if(h.captureTicks>=s.rules.hill.captureTicks){h.ownerTeam=team;h.captureTeam=null;h.captureTicks=0;}}
  else {h.captureTeam=null;h.captureTicks=0;h.holdTicks++;if(h.holdTicks>=s.rules.hill.holdTicks)finish(s,team,'The hill defense is complete.');}
 }
 if(s.rules.mode==='relic'){
  for(const relic of s.objectives.relics){
   if(relic.carrierId!==null){const carrier=s.entities.find(e=>e.id===relic.carrierId&&alive(e));if(!carrier){const fallen=s.entities.find(e=>e.id===relic.carrierId)||s.corpses.find(e=>e.id===relic.carrierId);if(fallen)placeRelic(relic,fallen);relic.carrierId=null;relic.heldTeam=null;continue;}placeRelic(relic,carrier);
    const shrine=s.entities.find(e=>alive(e)&&e.kind==='building'&&e.role==='hq'&&e.progress===1&&s.teams[e.side]===s.teams[carrier.side]&&distance(e,carrier)<=buildingFor(s,e).size/2+2.5);
    if(shrine){relic.carrierId=null;relic.heldTeam=s.teams[carrier.side];placeRelic(relic,carrier);}
   }
   if(relic.heldTeam!==null&&!s.entities.some(e=>alive(e)&&e.kind==='building'&&e.role==='hq'&&e.progress===1&&s.teams[e.side]===relic.heldTeam&&distance(e,relic)<=buildingFor(s,e).size/2+2.5))relic.heldTeam=null;
  }
  for(const team of [...new Set(s.teams)]){const held=s.objectives.relics.filter(r=>r.heldTeam===team).length;if(held>=s.rules.relic.required)s.objectives.relicHoldTicks[team]++;else s.objectives.relicHoldTicks[team]=0;if(s.objectives.relicHoldTicks[team]>=s.rules.relic.holdTicks)finish(s,team,'The required relics have been defended.');}
 }
 if(s.rules.mode==='survival'){
  const rules=s.rules.survival,wave=s.objectives.survival,defenders=s.entities.filter(e=>alive(e)&&e.role==='hq'&&e.progress===1&&s.teams[e.side]===rules.defenderTeam),opponents=s.players.map((_,id)=>id as Side).filter(side=>s.teams[side]!==rules.defenderTeam);
  if(!defenders.length){wave.phase='complete';finish(s,s.teams[opponents[0]],'The defenders lost their last stronghold.');return;}
  if(wave.phase==='fighting')for(const unit of s.entities.filter(e=>wave.spawnedIds.includes(e.id)&&alive(e)&&e.order.type==='idle')){
   const target=[...defenders].sort((a,b)=>distance(a,unit)-distance(b,unit)||a.id-b.id)[0];if(target)objectiveOrder(s,unit,target,actions.command);
  }
  if(wave.phase==='fighting'&&!s.entities.some(e=>wave.spawnedIds.includes(e.id)&&alive(e))){
   const survivors=s.players.map((_,id)=>id as Side).filter(side=>s.teams[side]===rules.defenderTeam);
   // Each defender receives the visible, configured wave reward.
   for(const side of survivors)for(const resource of ['wood','ore','crystal'] as const)s.players[side][resource]+=rules.rewardPerWave[resource];
   if(wave.wave===rules.waveCount){wave.phase='complete';finish(s,rules.defenderTeam,'The final survival wave is defeated.');return;}
   wave.phase='recovery';wave.nextWaveTick=s.tick+rules.recoveryTicks;
  }
  if((wave.phase==='waiting'||wave.phase==='recovery')&&s.tick>=wave.nextWaveTick){
   wave.wave++;wave.spawnedIds=[];wave.phase='fighting';const roles:UnitRole[]=wave.wave===1?['melee','ranged']:wave.wave===2?['spear','ranged','cavalry']:['melee','special','siege','cavalry'];
   for(let i=0;i<rules.unitsPerWave*wave.wave;i++){const side=opponents[i%opponents.length],point=freePoint(s,{x:Math.max(.5,Math.min(s.width-.5,s.starts[side].x+(i%5)-2)),y:Math.max(.5,Math.min(s.height-.5,s.starts[side].y+(Math.floor(i/5)%5)*.8)),...(s.starts[side].level===undefined?{}:{level:s.starts[side].level})},i),allowed=availableUnits(s,side).filter(unit=>unit.role!=='worker'&&definitionAllowed(s,side,unit.id)),preferred=roles[i%roles.length],chosen=allowed.find(unit=>unit.role===preferred)??allowed[i%allowed.length],unit=actions.spawn(s,side,'unit',chosen.role,point.x,point.y,1,chosen.id,levelOf(point));wave.spawnedIds.push(unit.id);const target=defenders[i%defenders.length];objectiveOrder(s,unit,target,actions.command);}
   s.events.push({type:'message',side:defenders[0].side,...s.starts[defenders[0].side],text:`Survival wave ${wave.wave}: ${wave.spawnedIds.length} attackers`});
  }
 }
}
export function objectiveAi(s:GameState,side:Side,command:Actions['command']):void {
 if(s.rules.mode==='annihilation'||s.rules.mode==='scenario'||s.rules.mode==='survival')return;
 const units=s.entities.filter(e=>e.side===side&&e.kind==='unit'&&e.role!=='worker'&&alive(e));if(!units.length)return;
 if(s.rules.mode==='hill')for(const unit of units)objectiveOrder(s,unit,s.objectives.hill,command);
 if(s.rules.mode==='relic')for(const unit of units){const carried=s.objectives.relics.find(r=>r.carrierId===unit.id),hq=s.entities.find(e=>e.side===side&&e.role==='hq'&&alive(e));
  if(carried&&hq){objectiveOrder(s,unit,hq,command,false);continue;}
  const target=s.objectives.relics.filter(r=>r.carrierId===null&&r.heldTeam!==s.teams[side]).sort((a,b)=>distance(a,unit)-distance(b,unit)||a.id-b.id)[0];if(!target)continue;
  if(!collectRelic(s,side,unit.id,target.id))objectiveOrder(s,unit,target,command);
 }
}
/** Landmarks and counters are public; an unseen enemy carrier's position is not. */
export function publicObjectives(s:GameState,side:Side){return {...structuredClone(s.objectives),relics:s.objectives.relics.map(r=>{
 const carrier=r.carrierId===null?null:s.entities.find(e=>e.id===r.carrierId),seen=!carrier||carrier.side===side||s.visible[side].has(fogKey(s,carrier));
 if(seen)return {...r};const {level:_level,...publicRelic}=r;return {...publicRelic,x:null,y:null,carrierId:null,hidden:true};
 })};}
