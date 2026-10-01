import { FACTIONS } from '../../src/core/content';
import { CORPSE_WAGON, FACTION_STRUCTURE_INFO } from '../../src/core/faction-systems-content';
import { initializeFactionSystems } from '../../src/core/faction-systems';
import { captureRuntime, createMatch, refreshVisibility, restoreRuntime, spawnFactionDefinition, stepGame } from '../../src/core/simulation';
import type { BuildingDef, Entity, FactionId, GameState, UnitDef, Vec } from '../../src/core/types';

/** Explicit, repeatable scenario setup. Subsequent panel actions use production commands. */
export function createFactionFixture(faction:FactionId='orcs'){
  const state=createMatch({map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:faction,controller:'external',handicap:{startingResources:{wood:2000,ore:2000,crystal:200}}},{id:1,teamId:1,factionId:'orcs',controller:'external'}],rules:{startingAge:2}});
  state.terrain.fill('grass');state.resources=[];
  const hq=state.entities.find(item=>item.side===0&&item.role==='hq')!,worker=state.entities.find(item=>item.side===0&&item.role==='worker')!,soldier=state.entities.find(item=>item.side===0&&item.role==='melee')!;
  hq.x=6;hq.y=16;state.starts[0]={x:hq.x,y:hq.y};
  const workers=state.entities.filter(item=>item.side===0&&item.role==='worker');
  for(const [index,item] of workers.entries()){item.x=index===0?12:9;item.y=index===0?14.5:18+index*.8;item.order={type:'hold'};}
  soldier.x=faction==='dwarves'?13.5:14;soldier.y=faction==='dwarves'?18.5:17.5;soldier.order={type:'hold'};
  function add(definition:UnitDef|BuildingDef,point:Vec,definitionId?:string):Entity{
    if(definitionId)return spawnFactionDefinition(state,0,definitionId,point);
    const entity:Entity={...structuredClone(soldier),id:state.nextId++,kind:'trainTime' in definition?'unit':'building',role:definition.role,definitionId,definitionFaction:faction,...point,hp:definition.hp,maxHp:definition.hp,order:{type:'hold'},progress:1,queue:[],path:[],tactics:undefined,factionState:undefined};
    if('shield' in definition&&definition.shield){entity.maxShield=definition.shield;entity.shield=definition.shield;}else {delete entity.maxShield;delete entity.shield;}
    state.entities.push(entity);return entity;
  }
  const special=add(FACTIONS[faction].units.special,{x:12,y:18.5}),siege=add(FACTIONS[faction].units.siege,{x:15,y:20.5}),barracks=add(FACTIONS[faction].buildings.barracks,{x:7,y:23});
  const tunnels=faction==='dwarves'?[add(FACTION_STRUCTURE_INFO.tunnel.definition,{x:12,y:20.5},FACTION_STRUCTURE_INFO.tunnel.definition.id),add(FACTION_STRUCTURE_INFO.tunnel.definition,{x:24,y:20.5},FACTION_STRUCTURE_INFO.tunnel.definition.id)]:[];
  const wagon=faction==='undead'?add(CORPSE_WAGON,{x:14,y:19},CORPSE_WAGON.id):undefined;
  const corpse=faction==='undead'?{id:state.nextId++,x:15,y:19,expires:state.time+45}:undefined;
  if(corpse)state.corpses.push(corpse);
  // A deterministic cooldown lets the cargo proof inspect a delivery before automatic raising.
  if(faction==='undead'){special.abilityReadyAt=60;const runtime=captureRuntime(state);runtime.abilities.push([special.id,60]);restoreRuntime(state,runtime);}
  const tower=faction==='automata'?add(FACTIONS.automata.buildings.tower,{x:20,y:14.5}):undefined;
  const system=initializeFactionSystems(state);system.fury[0]=100;
  soldier.factionState={trophyKills:faction==='orcs'?2:0};
  refreshVisibility(state);
  return {state,faction,hq,worker,workers,soldier,special,siege,barracks,tunnels,wagon,corpse,tower,placement:faction==='automata'?{x:13.5,y:14.5,level:0}:{x:16.5,y:14.5,level:0}};
}
export function advanceFactionFixture(state:GameState,seconds:number){for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.05)stepGame(state,.05);}
