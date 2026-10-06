import { FACTIONS } from '../../src/core/content';
import { createGame, refreshVisibility, stepGame } from '../../src/core/simulation';
import type { Entity, FactionId, GameState, Side, UnitRole } from '../../src/core/types';
export function arena(faction:FactionId,opponent:FactionId=faction){const game=createGame(faction,4127,opponent,{controllers:['external','external']});game.terrain.fill('grass');game.resources=[];for(const e of game.entities)if(e.kind==='unit')e.hp=0;return game;}
export function unit(game:GameState,side:Side,role:UnitRole,x=20,y=20):Entity{const d=FACTIONS[game.players[side].faction].units[role],template=game.entities.find(e=>e.kind==='unit')!;const e:Entity={...structuredClone(template),id:game.nextId++,side,role,x,y,hp:d.hp,maxHp:d.hp,shield:d.shield,maxShield:d.shield,path:[],order:{type:'idle'}};game.entities.push(e);refreshVisibility(game);return e;}
export function advance(game:GameState,seconds:number){for(let i=0;i<Math.round(seconds/.05);i++)stepGame(game,.05);}
