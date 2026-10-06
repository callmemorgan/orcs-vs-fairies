import { FACTIONS } from '../src/core/content';
import { createGame, refreshVisibility, stepGame } from '../src/core/simulation';
import type { BuildingRole, Entity, FactionId, GameState, JsonValue, Side, UnitRole } from '../src/core/types';
export function aiFixture(improvements:Record<string,JsonValue>,faction:FactionId='orcs'){
  const game=createGame(faction,1977,'fairies',{controllers:['ai','external'],mapSize:'large',improvements});
  game.terrain.fill('grass');game.resources=[];game.players[0].wood=200;game.players[0].ore=0;game.players[0].crystal=0;
  refreshVisibility(game);return game;
}
export function add(game:GameState,side:Side,role:UnitRole|BuildingRole,x:number,y:number,kind:Entity['kind']='unit'){
  const template=game.entities.find(e=>e.side===side&&e.kind===kind)!;
  const definition=kind==='unit'?FACTIONS[game.players[side].faction].units[role as UnitRole]:FACTIONS[game.players[side].faction].buildings[role as BuildingRole];
  const entity:Entity={...structuredClone(template),id:game.nextId++,kind,role,x,y,hp:definition.hp,maxHp:definition.hp,order:{type:'idle'},queue:[],path:[],progress:1};
  if(kind==='unit'&&(definition as {shield?:number}).shield){entity.maxShield=(definition as {shield:number}).shield;entity.shield=entity.maxShield;}
  game.entities.push(entity);refreshVisibility(game);return entity;
}
export function advance(game:GameState,seconds:number){for(let i=0;i<Math.ceil(seconds/.25);i++)stepGame(game,.25);}
