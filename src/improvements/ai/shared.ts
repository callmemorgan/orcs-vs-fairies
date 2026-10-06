import { FACTIONS } from '../../core/content';
import { isVisible, issueCommand, canPlace } from '../../core/simulation';
import type { BuildingRole, Entity, GameState, Side, Vec } from '../../core/types';
import type { State as FlankMiningState } from './051-flank-mining';

export const distance = (a:Vec,b:Vec) => Math.hypot(a.x-b.x,a.y-b.y);
export function computer(game:GameState,side:Side):boolean {
  const difficulty=game.improvements?.['feature-005']?.state as {active?:boolean}|undefined;
  return game.controllers[side]==='ai'||side===1&&game.controllers[side]==='external'&&difficulty?.active===true;
}
export const owned=(game:GameState,side:Side)=>game.entities.filter(e=>e.side===side&&e.hp>0);
export const seen=(game:GameState,side:Side)=>game.entities.filter(e=>e.side!==side&&e.hp>0&&isVisible(game,side,e.x,e.y));
export function moveTo(game:GameState,side:Side,unit:Entity,point:Vec):boolean {
  const building=point as Partial<Entity>;
  const reach=building.kind==='building'&&building.side!==undefined&&building.role
    ?FACTIONS[game.players[building.side].faction].buildings[building.role as BuildingRole].size/2+1.2:1.4;
  // Ordinary movement resolves occupied centers to a nearby open point. Keep that route.
  if(unit.order.type==='move'&&distance(unit.order,point)<reach+1)return true;
  if(distance(unit,point)<reach)return true;
  return issueCommand(game,side,{type:'move',ids:[unit.id],x:point.x,y:point.y});
}
export function buildNear(game:GameState,side:Side,worker:Entity,role:BuildingRole,point:Vec):boolean {
  // An unaffordable build fails at every slot, so skip the placement scan.
  const player=game.players[side],cost=FACTIONS[player.faction].buildings[role]?.cost;
  if(!cost||player.wood<cost.wood||player.ore<cost.ore||player.crystal<cost.crystal)return false;
  // Every half-tile center in the bounded ring, including narrow buildable patches.
  const cx=Math.floor(point.x)+.5,cy=Math.floor(point.y)+.5;
  for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
    const r=Math.hypot(dx,dy);if(r<3||r>6.5)continue;
    const x=cx+dx,y=cy+dy;
    if(canPlace(game,side,role,x,y)&&issueCommand(game,side,{type:'build',ids:[worker.id],role,x,y}))return true;
  }
  return false;
}
/** Reservations contain only the AI's own unit IDs and remain replayable JSON. */
export function reservedWorkers(game:GameState,side:Side):Set<number> {
  const state=game.improvements?.['feature-051']?.state as unknown as FlankMiningState|undefined;
  return new Set(state?.sides?.[side]?.crew??[]);
}
