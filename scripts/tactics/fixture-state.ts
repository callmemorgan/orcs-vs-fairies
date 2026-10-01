import { FACTIONS } from '../../src/core/content';
import { createGame, refreshVisibility, stepGame } from '../../src/core/simulation';
import { initializeTactics } from '../../src/core/tactics';
import type { Entity, GameState } from '../../src/core/types';

/** Explicit browser/test scenario setup. Actions after setup use production commands. */
export function createTacticsFixture(){
  const state=createGame('orcs',4127,'fairies',{controllers:['external','external']});
  state.terrain.fill('grass');
  const soldier=state.entities.find(item=>item.side===0&&item.role==='melee')!;
  const worker=state.entities.find(item=>item.side===0&&item.role==='worker')!;
  soldier.x=12;soldier.y=14;worker.x=11;worker.y=14;
  const army:Entity[]=[soldier];
  for(let index=1;index<4;index++){const unit={...structuredClone(soldier),id:state.nextId++,x:12+index*.8,y:14,order:{type:'idle'} as const,path:[]};state.entities.push(unit);army.push(unit);}
  state.resources=[{id:state.nextId++,kind:'wood',x:12,y:15.2,amount:500,maxAmount:500}];
  const enemy=state.entities.find(item=>item.side===1&&item.role==='melee')!;
  const definition=FACTIONS.fairies.units.siege;
  const engine:Entity={...structuredClone(enemy),id:state.nextId++,role:'siege',definitionFaction:'fairies',x:11,y:15,hp:definition.hp,maxHp:definition.hp,order:{type:'idle'},path:[],tactics:undefined};
  initializeTactics(state,engine).siegeCrew={hp:0,maxHp:42,uncrewed:true};state.entities.push(engine);
  for(const unit of army)initializeTactics(state,unit);
  initializeTactics(state,worker);refreshVisibility(state);
  return {state,army,worker,enemy,engine};
}
export function advanceTacticsFixture(state:GameState,seconds:number){for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.05)stepGame(state,.05);}
