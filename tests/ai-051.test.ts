import { describe, expect, it } from 'vitest';
import { refreshVisibility, stepGame } from '../src/core/simulation';
import { isJsonValue } from '../src/core/improvements';
import { aiFixture, advance } from './ai-improvements-fixture';
import { moveTo } from '../src/improvements/ai/shared';

describe('scouted flank mining',()=>{
  it('preserves the resolved retreat route around an occupied headquarters center',()=>{
    const game=aiFixture({'feature-051':{}}),worker=game.entities.find(e=>e.side===0&&e.role==='worker')!,hq=game.entities.find(e=>e.side===0&&e.role==='hq')!;
    worker.x=20;worker.y=20;
    expect(moveTo(game,0,worker,hq)).toBe(true);
    const order=worker.order;worker.path=[{x:18,y:18}];
    expect(moveTo(game,0,worker,hq)).toBe(true);expect(worker.order).toBe(order);expect(worker.path).toEqual([{x:18,y:18}]);
  });
  it('remembers the camp after the scout leaves, builds a depot, and delivers harvested resources',()=>{
    const game=aiFixture({'feature-051':{}}),scout=game.entities.find(e=>e.side===0&&e.role==='melee')!;
    const node={id:game.nextId++,kind:'wood' as const,x:12.5,y:32.5,amount:1200,maxAmount:1200};game.resources.push(node);
    scout.x=12.5;scout.y=31.5;refreshVisibility(game);stepGame(game,.25);
    scout.x=10;scout.y=10;refreshVisibility(game);
    const state=game.improvements!['feature-051'].state as {sides:{crew:number[];memory:{id:number}[];delivered:number}[]};
    expect(state.sides[0].memory.some(n=>n.id===node.id)).toBe(true);
    advance(game,160);
    expect(game.entities.some(e=>e.side===0&&e.role==='depot'&&e.progress===1&&Math.hypot(e.x-node.x,e.y-node.y)<8)).toBe(true);
    expect(state.sides[0].delivered).toBeGreaterThan(18);
    expect(state.sides[0].crew.length).toBeLessThanOrEqual(3);
    expect(game.entities.filter(e=>e.side===0&&e.role==='worker').length-state.sides[0].crew.length).toBeGreaterThanOrEqual(3);
    expect(isJsonValue(game.improvements!['feature-051'].state)).toBe(true);
  });
  it('never discovers hidden deposits or reads their changed reserves',()=>{
    const game=aiFixture({'feature-051':{}});game.resources.push({id:game.nextId++,kind:'ore',x:30,y:40,amount:3000,maxAmount:3000});
    advance(game,2);const state=game.improvements!['feature-051'].state as {sides:{deposit:number|null;memory:unknown[]}[]};
    expect(state.sides[0].deposit).toBeNull();expect(state.sides[0].memory).toEqual([]);
  });
});
