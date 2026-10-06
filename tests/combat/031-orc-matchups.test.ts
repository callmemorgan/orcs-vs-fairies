import { expect, it } from 'vitest';
import { FACTIONS } from '../../src/core/content';
import { createGame } from '../../src/core/simulation';
import { fight } from '../../scripts/combat/compare';
it('produces the tuned Ironjaw hull and keeps its recruitment cost',()=>{
 const s=createGame('orcs',4127,'fairies',{controllers:['external','external']});
 expect(s.entities.find(e=>e.side===0&&e.role==='melee')?.maxHp).toBe(165);
 expect(FACTIONS.orcs.units.melee.cost).toEqual({wood:70,ore:25,crystal:0});
});
it('Boltspitters now win the same-budget ranged encounter in both orientations',()=>{
 for(const side of [0,1] as const){const result=fight('undead',side,0,['ranged']);expect(result.winner).toBe(side);expect(result.costs[side]).toEqual({wood:850,ore:350,crystal:0});}
});
