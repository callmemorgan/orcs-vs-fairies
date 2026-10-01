import type { WorldState } from '../core/world-types';
import type { Controller, Entity, FactionId, GameEvent, GameState, Player, Side, TerrainKind, Vec } from '../core/types';
import type { PlayerObservation } from './protocol';

type PublicPlayer={side:Side;teamId:number;faction:FactionId};
type TeamObservation=PlayerObservation & {
  teamId?:number;allies?:PublicPlayer[];opponents?:PublicPlayer[];sharedVision?:boolean;
  result:PlayerObservation['result'] & {winningTeam?:number|null;eliminated?:boolean[]};
  teamPerspective?:boolean;teamPlayers?:Array<{side:Side;player:Player}>;
};
export interface OnlineRenderState {
  state:GameState;localSide:Side;role:'player'|'spectator';privateSides:ReadonlySet<Side>;
  hiddenStarts:ReadonlySet<Side>;unknownTerrain:ReadonlySet<number>;
  worldPhase?:NonNullable<PlayerObservation['world']>['phase'];
  resourceMemory:PlayerObservation['resources'];
  observedEvents:PlayerObservation['events'];
  objectiveView:Pick<PlayerObservation,'side'|'teamId'|'player'|'allies'|'opponents'|'tick'|'rules'|'draft'|'draftChoices'|'draftDefinitions'|'objectives'|'result'> & {entities:Array<Pick<Entity,'id'|'side'|'kind'|'role'|'x'|'y'|'level'|'hp'|'illusion'>>};
  alliedAi:PlayerObservation['alliedAi'];
}

function ownPlayer(player:Player):PlayerObservation['player'] {
  return {faction:player.faction,wood:player.wood,ore:player.ore,crystal:player.crystal,
    population:player.population,cap:player.cap,heroRecovery:player.heroRecovery?.map(recovery=>({...recovery})),upgrades:[...player.upgrades]};
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
  const privateSides=new Set<Side>([localSide]);
  if(role==='spectator'&&observation.teamPerspective)for(const member of observation.teamPlayers??[]) {
    if(member.side>=count||teams[member.side]!==teams[localSide])continue;
    players[member.side]=ownPlayer(member.player);privateSides.add(member.side);
  }
  const visible=Array.from({length:count},()=>new Set<number>()),explored=Array.from({length:count},()=>new Set<number>());
  visible[localSide]=new Set(view.visible);explored[localSide]=new Set(view.explored);
  const unknownTerrain=new Set<number>();
  const terrain:TerrainKind[]=view.map.terrain.map((tile,index)=>{
    if(tile===null||!explored[localSide].has(index)){unknownTerrain.add(index);return 'grass';}
    return tile;
  });
  const hiddenStarts=new Set<Side>();
  const starts:Vec[]=Array.from({length:count},(_,index)=>{
    const start=view.map.starts[index];if(start)return {...start};
    hiddenStarts.add(index as Side);return {x:view.map.width/2,y:view.map.height/2};
  });
  const alliedSides=new Set([localSide,...(observation.allies??[]).map(player=>player.side)]);
  const entities:Entity[]=view.entities.map(source=>{
    // Using an allowlist also discards accidental private fields in hostile records.
    const entity:Entity={
      id:source.id,side:source.side,kind:source.kind,role:source.role,x:source.x,y:source.y,...(source.level===undefined?{}:{level:source.level}),definitionId:source.definitionId,definitionFaction:source.definitionFaction,
      hp:source.hp,maxHp:source.maxHp,progress:source.progress,gateOpen:source.gateOpen,
      shield:source.shield,maxShield:source.maxShield,raised:source.raised,
      entrenchedAt:source.entrenchedAt,surgeUntil:source.surgeUntil,
      facing:source.facing,animation:['idle','walk','attack','death'].includes(source.animation)?source.animation as Entity['animation']:'idle',animTime:source.animTime,
      order:{type:'idle'},cooldown:0,queue:[],trainProgress:0,researchProgress:0,
      momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[],
    };
    if(privateSides.has(source.side)&&'order' in source) {
      entity.order={...source.order};entity.queue=[...source.queue];entity.queueDefinitionIds=source.queueDefinitionIds?[...source.queueDefinitionIds]:undefined;entity.queuePaidCosts=source.queuePaidCosts?.map(cost=>({...cost}));entity.rally=source.rally?{...source.rally}:undefined;
      entity.trainProgress=source.trainProgress;entity.research=source.research;entity.researchProgress=source.researchProgress;
      entity.carried=source.carried;entity.carriedKind=source.carriedKind;entity.cooldown=source.cooldown;
      entity.veteran=source.veteran?structuredClone(source.veteran):undefined;entity.equipment=source.equipment?{...source.equipment}:undefined;entity.specialistBuffs=source.specialistBuffs?.map(buff=>({...buff,fearedFrom:buff.fearedFrom?{...buff.fearedFrom}:undefined}));entity.beacon=source.beacon?{...source.beacon}:undefined;entity.siegeMode=source.siegeMode?{...source.siegeMode}:undefined;
      entity.abilityReadyAt=source.abilityReadyAt;entity.expires=source.expires;entity.illusion=source.illusion;
      if('orderQueue' in source&&Array.isArray(source.orderQueue))entity.orderQueue=source.orderQueue.map(order=>({...order}));
      if('lastDamagedAt' in source&&typeof source.lastDamagedAt==='number')entity.lastDamagedAt=source.lastDamagedAt;
    }else if(alliedSides.has(source.side)&&'illusion' in source)entity.illusion=source.illusion;
    // Enemy health is already disguised. Setting illusion=true would disguise it twice.
    return entity;
  });
  const events:GameEvent[]=view.events.map(source=>({
    type:source.type as GameEvent['type'],x:source.x,y:source.y,...(source.level===undefined?{}:{level:source.level}),side:source.side??localSide,
    text:source.text,target:source.target,source:source.source,amount:source.amount,resource:source.resource as GameEvent['resource'],
  }));
  const world:WorldState|undefined=view.world?{
    version:view.world.version,revision:view.world.revision,biome:view.world.biome,
    levels:view.world.levels.map(level=>({id:level.id,title:level.title,terrain:level.terrain.map((tile,index)=>{
      const key=level.id*view.map.width*view.map.height+index;if(tile===null||!explored[localSide].has(key)){unknownTerrain.add(key);return 'rock';}return tile;
    }),elevation:level.elevation.map((height,index)=>explored[localSide].has(level.id*view.map.width*view.map.height+index)?height??0:0)})),
    transitions:view.world.transitions.map(transition=>({id:transition.id,from:{...transition.from},to:{...transition.to}})),
    bridges:view.world.bridges.map(bridge=>({...bridge,tiles:[],repairSide:null})),fires:view.world.fires.map(fire=>({...fire})),
    sites:view.world.sites.map(site=>({...site,loyalty:players.map((_player,side)=>side===localSide?site.loyalty:0),reward:{...site.stock},request:{...site.request},rewarded:site.rewardClaimed?[localSide]:[],creatureIds:[],})),
    creatures:view.world.creatures.map(creature=>({...creature,cooldown:0,target:null,path:[],patrol:0,respawnAt:0})),
    dayLength:1,seasonLength:1,weatherLength:1,nextEnvironmentAt:0,iceTiles:[],thawWarned:false,
  }:undefined;
  // The disclosed phase is presentation data; no weather seed or private clocks arrive.
  const state={
    controllers:Array.from({length:count},():Controller=>'external'),mapSize:view.map.size,mapVersion:view.map.version,
    terrain,starts,...(world?{world}:{}),draw:view.result.draw,tick:view.tick,time:view.time,seed:0,width:view.map.width,height:view.map.height,
    entities,specialists:{artifacts:(view.artifacts??[]).map(item=>({...item,position:item.position?{...item.position}:undefined})),structures:[],nextArtifactId:1,nextStructureId:1},resources:view.resources.map(resource=>({id:resource.id,x:resource.x,y:resource.y,...(resource.level===undefined?{}:{level:resource.level}),kind:resource.kind,amount:resource.amount,maxAmount:resource.maxAmount})),
    players,rules:structuredClone(view.rules),draft:structuredClone(view.draft),winner:view.result.winner,events,explored,visible,nextId:1,
    corpses:view.corpses.map(corpse=>({id:corpse.id,x:corpse.x,y:corpse.y,...(corpse.level===undefined?{}:{level:corpse.level}),expires:corpse.expires})),
    teams,sharedVision:observation.sharedVision??false,winningTeam:observation.result.winningTeam??null,
    eliminated:[...(observation.result.eliminated??Array.from({length:count},()=>false))],
    incomeFactors:Array.from({length:count},()=>1),populationLimits:Array.from({length:count},()=>100),
  } as unknown as GameState;
  const objectiveView={side:view.side,teamId:view.teamId,player:{...ownPlayer(view.player)},allies:structuredClone(view.allies),opponents:structuredClone(view.opponents),tick:view.tick,rules:structuredClone(view.rules),draft:structuredClone(view.draft),draftChoices:[...view.draftChoices],draftDefinitions:structuredClone(view.draftDefinitions),objectives:structuredClone(view.objectives),result:{...view.result},entities:entities.map(entity=>({id:entity.id,side:entity.side,kind:entity.kind,role:entity.role,x:entity.x,y:entity.y,...(entity.level===undefined?{}:{level:entity.level}),hp:entity.hp,illusion:entity.illusion}))};
  return {state,localSide,role,privateSides,hiddenStarts,unknownTerrain,objectiveView,worldPhase:view.world?.phase?structuredClone(view.world.phase):undefined,
    alliedAi:structuredClone(view.alliedAi),resourceMemory:view.resources.map(resource=>({...resource})),observedEvents:view.events.map(event=>({
      type:event.type,tick:event.tick,x:event.x,y:event.y,...(event.level===undefined?{}:{level:event.level}),side:event.side,text:event.text,
      target:event.target,source:event.source,amount:event.amount,resource:event.resource,
    }))};
}

/** Keep Phaser's references stable as authoritative frames arrive. No stepGame call. */
export function applyOnlineRenderState(target:GameState,source:OnlineRenderState):void {
  for(const key of Object.keys(target))if(!(key in source.state))delete (target as unknown as Record<string,unknown>)[key];
  Object.assign(target,source.state);
}
