import { ABILITIES, FACTIONS, UPGRADES } from './content';
import { isAllied, isGameOver, isHostile, isVisible } from './simulation';
import type { Entity, GameEvent, GameState, ResourceNode, Side, UnitRole } from './types';

/** Health shown to a player, including enemy illusion disguises. */
export function observedHealth(s:GameState,side:Side,e:Entity):Pick<Entity,'hp'|'maxHp'>{
 const disguise=isHostile(s,side,e.side)&&e.illusion&&e.kind==='unit';
 const maxHp=disguise?FACTIONS[s.players[e.side].faction].units[e.role as UnitRole].hp:e.maxHp;
 const hp=disguise&&e.maxHp?e.hp*(maxHp/e.maxHp):e.hp;
 return {hp,maxHp};
}

/** Resource memory contains only values observed while a node was visible. */
export class PlayerView {
 private state:GameState|undefined;
 private resources=new Map<number,ResourceNode & {lastSeen:number}>();
 constructor(readonly side:Side){}
 update(s:GameState){
  if(!s.players[this.side])throw new Error('Observation side is not a player in this match.');
  if(this.state!==s){this.resources.clear();this.state=s;}
  for(const r of s.resources)if(isVisible(s,this.side,r.x,r.y))this.resources.set(r.id,{...r,lastSeen:s.time});
 }
 resourcesFor(s:GameState){this.update(s);return [...this.resources.values()].map(r=>({...r,visible:isVisible(s,this.side,r.x,r.y)}));}
 events(s:GameState,identify?:(event:GameEvent)=>string):Array<GameEvent & {eventId?:string}>{
  this.update(s);
  const side=this.side,entities=new Map(s.entities.map(e=>[e.id,e])),resources=new Map(s.resources.map(r=>[r.id,r]));
  const known=(id:number|undefined)=>{
   if(id===undefined)return false;
   const entity=entities.get(id);if(entity)return entity.side===side||isVisible(s,side,entity.x,entity.y);
   const resource=resources.get(id);return !!resource&&isVisible(s,side,resource.x,resource.y);
  };
  return s.events.flatMap(event=>{
   const own=event.side===side;
   if(!own&&['gather','research','message'].includes(event.type))return [];
   const target=event.target===undefined?undefined:entities.get(event.target);
   const affected=target&&isAllied(s,side,target.side)&&(target.side===side||isVisible(s,side,target.x,target.y));
   const visible=isVisible(s,side,event.x,event.y);
   if(!own&&!visible&&!affected)return [];
   const result:GameEvent & {eventId?:string}={...event};
   if(identify)result.eventId=identify(event);
   // A hit on an owned unit can be reported without revealing the hidden attacker.
   if(!own&&!visible&&affected){result.x=target.x;result.y=target.y;}
   if(!known(event.source)){
    // Death events can outlive their source entity. Their location identifies it
    // only if the event is owned or happened in the observing player's vision.
    if(!(event.type==='death'&&(own||visible)&&!entities.has(event.source!)))delete result.source;
   }
   if(!known(event.target))delete result.target;
   if(!own){delete result.text;delete result.resource;if(event.type!=='attack')delete result.amount;}
   return [result];
  });
 }
 observe(s:GameState){
  this.update(s);const side=this.side,teamId=s.teams[side];
  const roster=s.players.map((player,i)=>({side:i as Side,teamId:s.teams[i],faction:player.faction}));
  const opponents=roster.filter(player=>isHostile(s,side,player.side)),allies=roster.filter(player=>player.side!==side&&isAllied(s,side,player.side));
  const opponent=opponents[0];
  const finished=isGameOver(s),outcome=finished?s.draw?'draw':s.winningTeam===teamId?'win':'loss':null;
  return {
   version:1,tick:s.tick,time:s.time,side,teamId,controller:s.controllers[side],sharedVision:s.sharedVision,winningTeam:s.winningTeam,eliminated:[...s.eliminated],
   map:{size:s.mapSize,width:s.width,height:s.height,version:s.mapVersion,seed:s.seed,starts:s.starts.map(p=>({...p})),terrain:s.terrain.map((t,i)=>s.explored[side].has(i)?t:null)},
   player:{...s.players[side],upgrades:[...s.players[side].upgrades]},opponent:opponent?{side:opponent.side,faction:opponent.faction}:null,opponents,allies,
   entities:s.entities.filter(e=>e.hp>0&&(e.side===side||isVisible(s,side,e.x,e.y))).map(e=>{
    const {hp,maxHp}=observedHealth(s,side,e);
    const publicFields={id:e.id,side:e.side,kind:e.kind,role:e.role,x:e.x,y:e.y,hp,maxHp,progress:e.progress,gateOpen:e.gateOpen,shield:e.shield,maxShield:e.maxShield,raised:e.raised,entrenchedAt:e.entrenchedAt,surgeUntil:e.surgeUntil};
    return e.side===side?{...publicFields,illusion:e.illusion,order:{...e.order},orderQueue:e.orderQueue?.map(order=>({...order})),queue:[...e.queue],rally:e.rally?{...e.rally}:undefined,trainProgress:e.trainProgress,research:e.research,researchProgress:e.researchProgress,carried:e.carried,carriedKind:e.carriedKind,cooldown:e.cooldown,abilityReadyAt:e.abilityReadyAt,expires:e.expires,lastDamagedAt:e.lastDamagedAt}:isAllied(s,side,e.side)?{...publicFields,illusion:e.illusion}:publicFields;
   }),
   resources:this.resourcesFor(s),
   corpses:s.corpses.filter(c=>isVisible(s,side,c.x,c.y)).map(c=>({...c})),
   visible:[...s.visible[side]].sort((a,b)=>a-b),explored:[...s.explored[side]].sort((a,b)=>a-b),
   content:{faction:FACTIONS[s.players[side].faction],abilities:ABILITIES,upgrades:UPGRADES},
   result:{finished,winner:s.winner,winningTeam:s.winningTeam,draw:s.draw,eliminated:[...s.eliminated],outcome}
  };
 }
}
