import { FACTIONS } from './content';
import { TERRAIN } from './maps';
import type { Command, Entity, GameState, Side, TeamId, UnitRole, Vec } from './types';
import type { ObjectiveState } from './match-rules';
interface Actions {spawn:(s:GameState,side:Side,kind:Entity['kind'],role:UnitRole,x:number,y:number)=>Entity;command:(s:GameState,side:Side,c:Command)=>boolean}
const alive=(e:Entity)=>e.hp>0&&!e.illusion;
function freePoint(s:GameState,point:Vec,offset=0):Vec {
 for(let radius=0;radius<=Math.max(s.width,s.height);radius++)for(let i=0;i<Math.max(1,radius*8);i++){
  const angle=(i+offset)*Math.PI*2/Math.max(1,radius*8),x=Math.floor(point.x+Math.cos(angle)*radius)+.5,y=Math.floor(point.y+Math.sin(angle)*radius)+.5;
  if(x<.5||y<.5||x>s.width-.5||y>s.height-.5)continue;
  const terrain=s.terrain[Math.floor(y)*s.width+Math.floor(x)];
  if(TERRAIN[terrain].walkable&&!s.entities.some(e=>e.hp>0&&e.kind==='building'&&Math.hypot(e.x-x,e.y-y)<3))return {x,y};
 }
 throw new Error('No reachable objective position.');
}
export function emptyObjectives(s:Pick<GameState,'width'|'height'>):ObjectiveState {return {hill:{x:Math.floor(s.width/2)+.5,y:Math.floor(s.height/2)+.5,ownerTeam:null,captureTeam:null,captureTicks:0,holdTicks:0,contested:false},relics:[],relicHoldTicks:Array(8).fill(0),survival:{wave:0,nextWaveTick:0,spawnedIds:[],phase:'waiting'}};}
export function initializeObjectives(s:GameState):void {
 s.objectives=emptyObjectives(s);s.objectives.hill={...s.objectives.hill,...freePoint(s,s.objectives.hill)};
 if(s.rules.mode==='relic')for(let i=0;i<s.rules.relic.count;i++){const angle=i*Math.PI*2/s.rules.relic.count,point=freePoint(s,{x:s.width/2+Math.cos(angle)*6,y:s.height/2+Math.sin(angle)*6},i);s.objectives.relics.push({id:i+1,...point,carrierId:null,heldTeam:null});}
 if(s.rules.mode==='survival'){
  if(!s.teams.includes(s.rules.survival.defenderTeam)||new Set(s.teams).size!==2)throw new Error('Survival requires a defender team and one opposing wave team.');
  // The wave roster is a published replacement for the opposing starting base/army.
  s.entities=s.entities.filter(e=>s.teams[e.side]===s.rules.survival.defenderTeam);s.objectives.survival.nextWaveTick=s.tick+s.rules.survival.intervalTicks;
 }
}
function finish(s:GameState,team:TeamId,text:string):void {if(s.winner!==null||s.draw)return;s.winningTeam=team;s.winner=s.teams.findIndex(t=>t===team) as Side;const point=s.starts[s.winner];s.events.push({type:'message',side:s.winner,...point,text});}
export function collectRelic(s:GameState,side:Side,id:number,relicId:number):boolean {
 if(s.rules.mode!=='relic'||s.draft.status!=='complete')return false;
 const unit=s.entities.find(e=>e.id===id&&e.side===side&&e.kind==='unit'&&alive(e)),relic=s.objectives.relics.find(r=>r.id===relicId);
 if(!unit||!relic||relic.carrierId!==null||s.objectives.relics.some(r=>r.carrierId===id)||Math.hypot(unit.x-relic.x,unit.y-relic.y)>s.rules.relic.pickupRadius)return false;
 relic.carrierId=id;relic.heldTeam=null;relic.x=unit.x;relic.y=unit.y;s.events.push({type:'message',side,x:unit.x,y:unit.y,text:`Relic ${relicId} collected`,source:id});return true;
}
export function dropRelic(s:GameState,side:Side,id:number):boolean {
 const unit=s.entities.find(e=>e.id===id&&e.side===side&&e.kind==='unit'&&alive(e)),relic=s.objectives.relics.find(r=>r.carrierId===id);if(!unit||!relic)return false;
 relic.carrierId=null;relic.heldTeam=null;relic.x=unit.x;relic.y=unit.y;return true;
}
export function evaluateObjectives(s:GameState,actions:Actions):void {
 if(s.winner!==null||s.draw)return;
 if(s.rules.mode==='hill'){
  const h=s.objectives.hill,present=[...new Set(s.entities.filter(e=>alive(e)&&e.kind==='unit'&&e.role!=='worker'&&!s.eliminated[e.side]&&Math.hypot(e.x-h.x,e.y-h.y)<=s.rules.hill.radius).map(e=>s.teams[e.side]))];
  h.contested=present.length>1;
  if(present.length!==1){h.captureTeam=null;h.captureTicks=0;if(h.contested)h.holdTicks=0;return;}
  const team=present[0];if(h.ownerTeam!==team){if(h.captureTeam!==team){h.captureTeam=team;h.captureTicks=0;}h.captureTicks++;h.holdTicks=0;if(h.captureTicks>=s.rules.hill.captureTicks){h.ownerTeam=team;h.captureTeam=null;h.captureTicks=0;}}
  else {h.captureTeam=null;h.captureTicks=0;h.holdTicks++;if(h.holdTicks>=s.rules.hill.holdTicks)finish(s,team,'The hill defense is complete.');}
 }
 if(s.rules.mode==='relic'){
  for(const relic of s.objectives.relics){
   if(relic.carrierId!==null){const carrier=s.entities.find(e=>e.id===relic.carrierId&&alive(e));if(!carrier){const fallen=s.entities.find(e=>e.id===relic.carrierId)||s.corpses.find(e=>e.id===relic.carrierId);if(fallen){relic.x=fallen.x;relic.y=fallen.y;}relic.carrierId=null;relic.heldTeam=null;continue;}relic.x=carrier.x;relic.y=carrier.y;
    const shrine=s.entities.find(e=>alive(e)&&e.kind==='building'&&e.role==='hq'&&e.progress===1&&s.teams[e.side]===s.teams[carrier.side]&&Math.hypot(e.x-carrier.x,e.y-carrier.y)<=3);
    if(shrine){relic.carrierId=null;relic.heldTeam=s.teams[carrier.side];relic.x=shrine.x;relic.y=shrine.y;}
   }
   if(relic.heldTeam!==null&&!s.entities.some(e=>alive(e)&&e.kind==='building'&&e.role==='hq'&&e.progress===1&&s.teams[e.side]===relic.heldTeam&&Math.hypot(e.x-relic.x,e.y-relic.y)<.1))relic.heldTeam=null;
  }
  for(const team of [...new Set(s.teams)]){const held=s.objectives.relics.filter(r=>r.heldTeam===team).length;if(held>=s.rules.relic.required)s.objectives.relicHoldTicks[team]++;else s.objectives.relicHoldTicks[team]=0;if(s.objectives.relicHoldTicks[team]>=s.rules.relic.holdTicks)finish(s,team,'The required relics have been defended.');}
 }
 if(s.rules.mode==='survival'){
  const rules=s.rules.survival,wave=s.objectives.survival,defenders=s.entities.filter(e=>alive(e)&&e.role==='hq'&&e.progress===1&&s.teams[e.side]===rules.defenderTeam),opponents=s.players.map((_,id)=>id as Side).filter(side=>s.teams[side]!==rules.defenderTeam);
  if(!defenders.length){wave.phase='complete';finish(s,s.teams[opponents[0]],'The defenders lost their last stronghold.');return;}
  if(wave.phase==='fighting'&&!s.entities.some(e=>wave.spawnedIds.includes(e.id)&&alive(e))){
   const survivors=s.players.map((_,id)=>id as Side).filter(side=>s.teams[side]===rules.defenderTeam&&s.entities.some(e=>alive(e)&&e.role==='hq'&&e.side===side));
   // Each surviving defender receives the visible, configured wave reward.
   for(const side of survivors)for(const resource of ['wood','ore','crystal'] as const)s.players[side][resource]+=rules.rewardPerWave[resource];
   if(wave.wave===rules.waveCount){wave.phase='complete';finish(s,rules.defenderTeam,'The final survival wave is defeated.');return;}
   wave.phase='recovery';wave.nextWaveTick=s.tick+rules.recoveryTicks;
  }
  if((wave.phase==='waiting'||wave.phase==='recovery')&&s.tick>=wave.nextWaveTick){
   wave.wave++;wave.spawnedIds=[];wave.phase='fighting';const roles:UnitRole[]=wave.wave===1?['melee','ranged']:wave.wave===2?['spear','ranged','cavalry']:['melee','special','siege','cavalry'];
   for(let i=0;i<rules.unitsPerWave*wave.wave;i++){const side=opponents[i%opponents.length],point=freePoint(s,{x:s.starts[side].x+(i%5)-2,y:s.starts[side].y+Math.floor(i/5)*.8},i),unit=actions.spawn(s,side,'unit',roles[i%roles.length],point.x,point.y);wave.spawnedIds.push(unit.id);const target=defenders[i%defenders.length];actions.command(s,side,{type:'attackMove',ids:[unit.id],x:target.x,y:target.y});}
   s.events.push({type:'message',side:defenders[0].side,...s.starts[defenders[0].side],text:`Survival wave ${wave.wave}: ${wave.spawnedIds.length} attackers`});
  }
 }
}
export function objectiveAi(s:GameState,side:Side,command:Actions['command']):void {
 if(s.rules.mode==='annihilation'||s.rules.mode==='scenario'||s.rules.mode==='survival')return;
 const units=s.entities.filter(e=>e.side===side&&e.kind==='unit'&&e.role!=='worker'&&alive(e));if(!units.length)return;
 if(s.rules.mode==='hill'){const hill=s.objectives.hill;command(s,side,{type:'attackMove',ids:units.map(e=>e.id),x:hill.x,y:hill.y});}
 if(s.rules.mode==='relic')for(const unit of units){const carried=s.objectives.relics.find(r=>r.carrierId===unit.id),hq=s.entities.find(e=>e.side===side&&e.role==='hq'&&alive(e));
  if(carried&&hq){command(s,side,{type:'move',ids:[unit.id],x:hq.x,y:hq.y+3});continue;}
  const target=s.objectives.relics.filter(r=>r.carrierId===null&&r.heldTeam!==s.teams[side]).sort((a,b)=>Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y))[0];if(!target)continue;
  if(!collectRelic(s,side,unit.id,target.id))command(s,side,{type:'attackMove',ids:[unit.id],x:target.x,y:target.y});
 }
}
/** Landmarks and counters are public; an unseen enemy carrier's position is not. */
export function publicObjectives(s:GameState,side:Side){return {...structuredClone(s.objectives),relics:s.objectives.relics.map(r=>{
 const carrier=r.carrierId===null?null:s.entities.find(e=>e.id===r.carrierId),seen=!carrier||s.teams[carrier.side]===s.teams[side]||s.visible[side].has(Math.floor(r.y)*s.width+Math.floor(r.x));
 return seen?{...r}:{...r,x:null,y:null,carrierId:null,hidden:true};
 })};}
