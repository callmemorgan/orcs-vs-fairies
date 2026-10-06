import { describe, expect, it } from 'vitest';
import { canPlace, issueCommand, refreshVisibility, runAI, stepGame } from '../src/core/simulation';
import { isJsonValue } from '../src/core/improvements';
import { add, aiFixture, advance } from './ai-improvements-fixture';
import { buildNear, moveTo } from '../src/improvements/ai/shared';

describe('scouted flank mining',()=>{
  it('finds a narrow legal half-tile patch missed by angular samples',()=>{
    const game=aiFixture({'feature-051':{}});game.terrain.fill('mud');
    for(let y=32;y<=34;y++)for(let x=16;x<=18;x++)game.terrain[y*game.width+x]='grass';
    const worker=game.entities.find(e=>e.side===0&&e.role==='worker')!;worker.x=12.5;worker.y=32.5;refreshVisibility(game);
    expect(canPlace(game,0,'depot',17.5,33.5)).toBe(true);
    expect(buildNear(game,0,worker,'depot',{x:12.5,y:32.5})).toBe(true);
    expect(game.entities.some(e=>e.side===0&&e.role==='depot'&&e.x===17.5&&e.y===33.5)).toBe(true);
  });
  it('a lone lead mines and delivers when terrain prevents every depot, with bounded retries',()=>{
    const game=aiFixture({'feature-051':{}});game.terrain.fill('shallows');
    const hq=game.entities.find(e=>e.side===0&&e.role==='hq')!;hq.queue=Array(5).fill('worker');hq.trainProgress=-1000;
    const node={id:game.nextId++,kind:'wood' as const,x:12.5,y:32.5,amount:1200,maxAmount:1200};game.resources.push(node);
    const scout=game.entities.find(e=>e.side===0&&e.role==='melee')!;scout.x=12.5;scout.y=31.5;refreshVisibility(game);stepGame(game,.25);
    const state=game.improvements!['feature-051'].state as {sides:{crew:number[];delivered:number;placementAttempts:number}[]};
    game.entities.find(e=>e.id===state.sides[0].crew[1])!.hp=0;
    for(const worker of game.entities.filter(e=>e.side===0&&e.role==='worker'&&e.hp>0&&!state.sides[0].crew.includes(e.id)))issueCommand(game,0,{type:'hold',ids:[worker.id]});
    scout.x=10;scout.y=10;refreshVisibility(game);advance(game,100);
    expect(state.sides[0].crew).toHaveLength(1);expect(state.sides[0].delivered).toBeGreaterThan(0);expect(node.amount).toBeLessThan(1200);
    expect(state.sides[0].placementAttempts).toBeLessThanOrEqual(26);expect(game.entities.some(e=>e.role==='depot')).toBe(false);
  });
  it('builds local essential infrastructure while the reserved lead constructs remotely',()=>{
    const game=aiFixture({'feature-051':{}}),lead=game.entities.find(e=>e.side===0&&e.role==='worker')!;
    const depot=add(game,0,'depot',12,31,'building');depot.progress=.1;lead.order={type:'build',target:depot.id};
    const state=game.improvements!['feature-051'].state as {sides:{crew:number[]}[]};state.sides[0].crew=[lead.id];
    game.players[0].wood=500;game.players[0].ore=200;runAI(game,0);
    expect(game.entities.some(e=>e.side===0&&e.role==='barracks'&&e.progress===0)).toBe(true);expect(lead.order).toEqual({type:'build',target:depot.id});
  });
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
