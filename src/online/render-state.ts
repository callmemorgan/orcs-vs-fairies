import type { Controller, Entity, FactionId, GameEvent, GameState, Player, Side, TerrainKind, Vec } from '../core/types';
import type { PlayerObservation } from './protocol';

type PublicPlayer={side:Side;teamId:number;faction:FactionId};
type TeamObservation=PlayerObservation & {
  teamId?:number;allies?:PublicPlayer[];opponents?:PublicPlayer[];sharedVision?:boolean;
  result:PlayerObservation['result'] & {winningTeam?:number|null;eliminated?:boolean[]};
};
export interface OnlineRenderState {
  state:GameState;localSide:Side;role:'player'|'spectator';privateSides:ReadonlySet<Side>;
  hiddenStarts:ReadonlySet<Side>;unknownTerrain:ReadonlySet<number>;
  resourceMemory:PlayerObservation['resources'];
}

function ownPlayer(player:Player):Player {
  return {faction:player.faction,wood:player.wood,ore:player.ore,crystal:player.crystal,
    population:player.population,cap:player.cap,upgrades:[...player.upgrades]};
}
function emptyPlayer(faction:FactionId):Player {
  // These are display placeholders. HUDs must use privateSides before showing banks.
  return {faction,wood:0,ore:0,crystal:0,population:0,cap:0,upgrades:[]};
}

/** Convert only fields the server disclosed. Never construct a local simulation. */
export function observationToRenderState(view:PlayerObservation,role:'player'|'spectator'='player'):OnlineRenderState {
  const observation=view as TeamObservation,localSide=view.side;
  const roster:PublicPlayer[]=[{side:localSide,teamId:observation.teamId??localSide,faction:view.player.faction},...(observation.allies??[]),...(observation.opponents??[])];
  if(!observation.opponents&&view.opponent)roster.push({side:view.opponent.side as Side,teamId:view.opponent.side,faction:view.opponent.faction});
  const count=Math.max(2,view.map.starts.length,...roster.map(player=>player.side+1));
  const players:Player[]=Array.from({length:count},()=>emptyPlayer('orcs'));
  const teams:number[]=Array.from({length:count},(_,index)=>index);
  for(const player of roster){players[player.side]=emptyPlayer(player.faction);teams[player.side]=player.teamId;}
  players[localSide]=ownPlayer(view.player);
  const visible=Array.from({length:count},()=>new Set<number>()),explored=Array.from({length:count},()=>new Set<number>());
  visible[localSide]=new Set(view.visible);explored[localSide]=new Set(view.explored);
  const unknownTerrain=new Set<number>();
  const terrain:TerrainKind[]=view.map.terrain.map((tile,index)=>{
    if(tile===null||!explored[localSide].has(index)){unknownTerrain.add(index);return 'grass';}
    return tile;
  });
  const hiddenStarts=new Set<Side>();
  const starts:Vec[]=Array.from({length:count},(_,index)=>{
    const start=view.map.starts[index];if(start)return {x:start.x,y:start.y};
    hiddenStarts.add(index as Side);return {x:view.map.width/2,y:view.map.height/2};
  });
  const alliedSides=new Set([localSide,...(observation.allies??[]).map(player=>player.side)]);
  const entities:Entity[]=view.entities.map(source=>{
    // Using an allowlist also discards accidental private fields in hostile records.
    const entity:Entity={
      id:source.id,side:source.side,kind:source.kind,role:source.role,x:source.x,y:source.y,
      hp:source.hp,maxHp:source.maxHp,progress:source.progress,gateOpen:source.gateOpen,
      shield:source.shield,maxShield:source.maxShield,raised:source.raised,
      entrenchedAt:source.entrenchedAt,surgeUntil:source.surgeUntil,
      facing:source.facing,animation:['idle','walk','attack','death'].includes(source.animation)?source.animation as Entity['animation']:'idle',animTime:source.animTime,
      order:{type:'idle'},cooldown:0,queue:[],trainProgress:0,researchProgress:0,
      momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[],
    };
    if(source.side===localSide&&'order' in source) {
      entity.order={...source.order};entity.queue=[...source.queue];entity.rally=source.rally?{...source.rally}:undefined;
      entity.trainProgress=source.trainProgress;entity.research=source.research;entity.researchProgress=source.researchProgress;
      entity.carried=source.carried;entity.carriedKind=source.carriedKind;entity.cooldown=source.cooldown;
      entity.abilityReadyAt=source.abilityReadyAt;entity.expires=source.expires;entity.illusion=source.illusion;
      if('orderQueue' in source&&Array.isArray(source.orderQueue))entity.orderQueue=source.orderQueue.map(order=>({...order}));
    }else if(alliedSides.has(source.side)&&'illusion' in source)entity.illusion=source.illusion;
    // Enemy health is already disguised. Setting illusion=true would disguise it twice.
    return entity;
  });
  const events:GameEvent[]=view.events.map(source=>({
    type:source.type as GameEvent['type'],x:source.x,y:source.y,side:source.side??localSide,
    text:source.text,target:source.target,source:source.source,amount:source.amount,resource:source.resource as GameEvent['resource'],
  }));
  const state={
    controllers:Array.from({length:count},():Controller=>'external'),mapSize:view.map.size,mapVersion:view.map.version,
    terrain,starts,draw:view.result.draw,tick:view.tick,time:view.time,seed:0,width:view.map.width,height:view.map.height,
    entities,resources:view.resources.map(resource=>({id:resource.id,x:resource.x,y:resource.y,kind:resource.kind,amount:resource.amount,maxAmount:resource.maxAmount})),
    players,winner:view.result.winner,events,explored,visible,nextId:1,
    corpses:view.corpses.map(corpse=>({id:corpse.id,x:corpse.x,y:corpse.y,expires:corpse.expires})),
    teams,sharedVision:observation.sharedVision??false,winningTeam:observation.result.winningTeam??null,
    eliminated:[...(observation.result.eliminated??Array.from({length:count},()=>false))],
    incomeFactors:Array.from({length:count},()=>1),populationLimits:Array.from({length:count},()=>200),
  } as unknown as GameState;
  return {state,localSide,role,privateSides:new Set([localSide]),hiddenStarts,unknownTerrain,
    resourceMemory:view.resources.map(resource=>({...resource}))};
}

/** Keep Phaser's references stable as authoritative frames arrive. No stepGame call. */
export function applyOnlineRenderState(target:GameState,source:OnlineRenderState):void {
  for(const key of Object.keys(target))if(!(key in source.state))delete (target as unknown as Record<string,unknown>)[key];
  Object.assign(target,source.state);
}
