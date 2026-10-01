import { FACTIONS } from './content';
import { openDestination, walkable } from './navigation';
import { levelOf, sameLevel, fogKey, setWorldTerrain } from './world-map';
import type { Command, Entity, GameState, Side, Vec } from './types';
import type { WorldBridge } from './world-types';

export interface WorldActionHooks { move(actor:Entity,to:Vec,dt:number,reach:number):boolean; finish(actor:Entity):void }
const known=(s:GameState,side:Side,point:Vec)=>s.visible[side].has(fogKey(s,point));
const distance=(a:Vec,b:Vec)=>sameLevel(a,b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
export function issueWorldAction(s:GameState,side:Side,c:Command,assign:(e:Entity,o:Entity['order'])=>void):boolean|undefined {
 if(!['traverse','worldAttack','repairBridge'].includes(c.type))return undefined;
 const world=s.world;if(!world||!('ids' in c))return false;
 const units=s.entities.filter(e=>c.ids.includes(e.id)&&e.side===side&&e.kind==='unit'&&e.hp>0&&!e.illusion);
 if(c.type==='traverse'){
  const transition=world.transitions.find(t=>t.id===c.transition);if(!transition)return false;let accepted=false;
  for(const e of units){const entrance=[transition.from,transition.to].find(p=>sameLevel(p,e));if(!entrance||!known(s,side,entrance))continue;assign(e,{type:'traverse',transition:transition.id});accepted=true;}
  return accepted;
 }
 if(!('target' in c))return false;const bridge=world.bridges.find(b=>b.id===c.target);if(!bridge)return c.type==='worldAttack'?undefined:false;
 if(!known(s,side,bridge))return false;
 if(c.type==='worldAttack'){
  if(bridge.hp<=0)return false;let accepted=false;for(const e of units)if(sameLevel(e,bridge)){assign(e,{type:'worldAttack',target:bridge.id});accepted=true;}return accepted;
 }
 const workers=units.filter(e=>e.role==='worker'&&sameLevel(e,bridge));if(!workers.length||bridge.hp===bridge.maxHp)return false;
 if(bridge.repairSide!==null&&s.teams[bridge.repairSide]!==s.teams[side])return false;
 if(bridge.hp===0&&bridge.repairSide===null){
  const p=s.players[side],wood=60+bridge.tiles.length*2,ore=20;if(p.wood<wood||p.ore<ore)return false;p.wood-=wood;p.ore-=ore;bridge.repairSide=side;bridge.rebuilding=0;
 }
 for(const e of workers)assign(e,{type:'repairBridge',target:bridge.id});return true;
}
function bridgeEdge(bridge:WorldBridge,s:GameState,e:Entity):Vec {
 const candidates=bridge.tiles.map(tile=>({x:tile%s.width+.5,y:Math.floor(tile/s.width)+.5,level:bridge.level}));
 return candidates.sort((a,b)=>distance(e,a)-distance(e,b))[0];
}
function evacuateBridge(s:GameState,bridge:WorldBridge):void {
 const tiles=new Set(bridge.tiles);
 for(const unit of s.entities.filter(e=>e.hp>0&&e.kind==='unit'&&sameLevel(e,bridge)&&tiles.has(Math.floor(e.y)*s.width+Math.floor(e.x)))){
  let escape:Vec|undefined;
  for(let ring=1;ring<=8&&!escape;ring++){
   const points:Vec[]=[];for(let y=Math.floor(unit.y)-ring;y<=Math.floor(unit.y)+ring;y++)for(let x=Math.floor(unit.x)-ring;x<=Math.floor(unit.x)+ring;x++)if(walkable(s,x+.5,y+.5,bridge.level))points.push({x:x+.5,y:y+.5,level:bridge.level});
   escape=points.sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
  }
  if(escape){unit.x=escape.x;unit.y=escape.y;unit.hp=Math.max(1,unit.hp-unit.maxHp*.25);s.events.push({type:'message',side:unit.side,x:unit.x,y:unit.y,level:levelOf(unit),source:unit.id,text:'Bridge destroyed: survivors reached the bank with injuries.'});}
  else{unit.hp=0;unit.animation='death';unit.animTime=0;s.events.push({type:'death',side:unit.side,x:unit.x,y:unit.y,level:levelOf(unit),source:unit.id,text:'A unit drowned when the bridge collapsed.'});if(!unit.illusion&&!unit.raised)s.corpses.push({id:unit.id,x:unit.x,y:unit.y,level:levelOf(unit),expires:s.time+45});}
  unit.order={type:'idle'};delete unit.orderQueue;unit.path=[];
 }
}
export function processWorldAction(s:GameState,e:Entity,dt:number,hooks:WorldActionHooks):boolean {
 const world=s.world,o=e.order;if(!world)return false;
 if(o.type==='traverse'){
  const transition=world.transitions.find(t=>t.id===o.transition),entry=transition&&[transition.from,transition.to].find(p=>sameLevel(p,e));
  if(!transition||!entry){hooks.finish(e);return true;}
  if(!hooks.move(e,entry,dt,.6))return true;
  const exit=entry===transition.from?transition.to:transition.from,destination=openDestination(s,exit,exit);
  if(!destination){s.events.push({type:'message',side:e.side,x:e.x,y:e.y,level:levelOf(e),text:'The entrance is blocked on the other level.'});return true;}
  e.x=destination.x;e.y=destination.y;e.level=exit.level;e.path=[];
  s.events.push({type:'message',side:e.side,x:e.x,y:e.y,level:levelOf(e),source:e.id,text:`Entered ${world.levels[exit.level].title}.`});hooks.finish(e);return true;
 }
 if(o.type!=='worldAttack'&&o.type!=='repairBridge')return false;
 const bridge=world.bridges.find(b=>b.id===o.target);if(!bridge)return false;
 if(!sameLevel(e,bridge)){hooks.finish(e);return true;}
 const def=FACTIONS[s.players[e.side].faction].units[e.role as 'melee'],edge=bridgeEdge(bridge,s,e),reach=o.type==='worldAttack'?def.range:1.4;
 if(!hooks.move(e,edge,dt,reach))return true;
 e.animation='attack';
 if(o.type==='worldAttack'){
  if(bridge.hp<=0){hooks.finish(e);return true;}if(e.cooldown>0)return true;
  const amount=Math.min(bridge.hp,Math.max(1,def.damage*(def.buildingDamageMultiplier??1)));bridge.hp-=amount;e.cooldown=def.cooldown;
  s.events.push({type:'attack',side:e.side,x:e.x,y:e.y,level:levelOf(e),source:e.id,target:bridge.id,amount});
  if(bridge.hp===0){for(const tile of bridge.tiles)setWorldTerrain(s,{x:tile%s.width+.5,y:Math.floor(tile/s.width)+.5,level:bridge.level},'water');for(const unit of s.entities)if(levelOf(unit)===bridge.level)unit.path=[];evacuateBridge(s,bridge);s.events.push({type:'message',side:e.side,x:bridge.x,y:bridge.y,level:bridge.level,target:bridge.id,text:'Bridge destroyed. Rebuild with workers to restore the crossing.'});hooks.finish(e);}
 }else{
  if(e.role!=='worker'||bridge.hp===bridge.maxHp){hooks.finish(e);return true;}
  if(bridge.hp===0){bridge.rebuilding=Math.min(1,bridge.rebuilding+dt/12);if(bridge.rebuilding===1){bridge.hp=bridge.maxHp;bridge.repairSide=null;for(const tile of bridge.tiles)setWorldTerrain(s,{x:tile%s.width+.5,y:Math.floor(tile/s.width)+.5,level:bridge.level},'bridge');s.events.push({type:'build',side:e.side,x:bridge.x,y:bridge.y,level:bridge.level,target:bridge.id,text:'Bridge rebuilt.'});hooks.finish(e);}}
  else{const p=s.players[e.side],amount=Math.min(bridge.maxHp-bridge.hp,dt*20,p.wood*10);p.wood-=amount*.1;bridge.hp+=amount;}
 }
 return true;
}
