import { describe, expect, it } from 'vitest';
import { economicState, ECONOMY_RULES } from '../src/core/economy';
import { marketQuote } from '../src/core/economy-cargo';
import { createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import { loadGame, saveGame } from '../src/core/saves';
import type { Entity, GameState, Side } from '../src/core/types';

const run=(s:GameState,seconds:number)=>{for(let index=0;index<Math.round(seconds*20);index++)stepGame(s,.05);};
const hq=(s:GameState,side:Side=0)=>s.entities.find(entity=>entity.side===side&&entity.kind==='building'&&entity.role==='hq'&&entity.hp>0)!;
const workers=(s:GameState,side:Side=0)=>s.entities.filter(entity=>entity.side===side&&entity.kind==='unit'&&entity.role==='worker'&&!economicState(s)!.caravans.includes(entity.id));

function fixture():GameState {
 const s=createMatch({map:{seed:4127,size:'small'},players:[{id:0,teamId:0,factionId:'orcs',controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:500}}},{id:1,teamId:1,factionId:'fairies',controller:'external',handicap:{startingResources:{wood:5000,ore:5000,crystal:500}}}],rules:{startingAge:3}});
 s.terrain.fill('grass');s.resources=[];refreshVisibility(s);return s;
}

function caravan(s:GameState):Entity {
 expect(issueCommand(s,0,{type:'trainCaravan',id:hq(s).id})).toBe(true);run(s,20);
 return s.entities.find(entity=>entity.id===economicState(s)!.caravans.at(-1))!;
}

function expansion(s:GameState):Entity {
 const start=hq(s),worker=workers(s)[0],x=start.x+15,y=start.y+3;
 expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:x-2,y:y+3})).toBe(true);run(s,12);refreshVisibility(s);
 expect(issueCommand(s,0,{type:'build',ids:[worker.id],role:'hq',x,y})).toBe(true);
 const entity=s.entities.at(-1)!;run(s,100);expect(entity.progress).toBe(1);return entity;
}

function enemyWarehouse(s:GameState):Entity {
 const start=hq(s,1),worker=workers(s,1)[0],x=start.x-6,y=start.y-5;
 expect(issueCommand(s,1,{type:'buildEconomy',ids:[worker.id],kind:'warehouse',x,y})).toBe(true);
 const entity=s.entities.at(-1)!;run(s,70);expect(entity.progress).toBe(1);
 s.entities=s.entities.filter(item=>item.side!==1||item.kind==='building');refreshVisibility(s);
 return entity;
}

describe('cargo through simulation commands and navigation',()=>{
 it('trains a caravan, trades between real constructed settlements and restores a loaded save',()=>{
  const s=fixture(),target=expansion(s),cart=caravan(s),economy=economicState(s)!;
  const wood=s.players[0].wood,crystal=s.players[0].crystal,marketReserve=economy.markets.reduce((sum,item)=>sum+item.stock.crystal,0);
  expect(issueCommand(s,0,{type:'tradeRoute',id:cart.id,source:hq(s).id,target:target.id,kind:'wood',amount:40,repeat:false})).toBe(true);
  expect(s.players[0].wood).toBe(wood);run(s,3);expect(economy.cargo.find(item=>item.entityId===cart.id)!.stock.wood).toBe(40);expect(s.players[0].crystal).toBe(crystal);
  const restored=loadGame(saveGame(s));run(s,30);run(restored,30);expect(saveGame(restored)).toEqual(saveGame(s));
  expect(s.players[0].wood).toBe(wood);expect(s.players[0].crystal).toBeGreaterThan(crystal);
  expect(s.players[0].crystal-crystal).toBeCloseTo(marketReserve-economy.markets.reduce((sum,item)=>sum+item.stock.crystal,0),7);
 });
 it('stopping a loaded route retains its cargo and prevents a cancelled trip reward',()=>{
  const s=fixture(),target=expansion(s),cart=caravan(s),economy=economicState(s)!,wood=s.players[0].wood,crystal=s.players[0].crystal;
  expect(issueCommand(s,0,{type:'tradeRoute',id:cart.id,source:hq(s).id,target:target.id,kind:'wood',amount:40,repeat:false})).toBe(true);run(s,3);
  expect(issueCommand(s,0,{type:'stop',ids:[cart.id]})).toBe(true);run(s,.1);
  expect(economy.tasks.some(item=>item.entityId===cart.id)).toBe(false);expect(economy.cargo.find(item=>item.entityId===cart.id)!.stock.wood).toBe(40);
  expect(issueCommand(s,0,{type:'move',ids:[cart.id],x:hq(s).x+1.9,y:hq(s).y})).toBe(true);run(s,30);
  expect(s.players[0].wood).toBe(wood);expect(s.players[0].crystal).toBe(crystal);expect(economy.cargo.find(item=>item.entityId===cart.id)!.stock.wood).toBe(0);
 });
 it('requires a scouting unit at a finite market and pays an integrated quote atomically',()=>{
  const s=fixture(),economy=economicState(s)!,market=economy.markets[0],worker=workers(s)[0],command={type:'marketTrade' as const,market:market.id,kind:'ore' as const,amount:50,direction:'buy' as const};
  expect(issueCommand(s,0,command)).toBe(false);
  expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:market.x,y:market.y})).toBe(true);run(s,30);
  const wood=s.players[0].wood,ore=s.players[0].ore,price=marketQuote(market,'ore',50,'buy');
  expect(issueCommand(s,0,command)).toBe(true);expect(s.players[0].wood).toBeCloseTo(wood-price,7);expect(s.players[0].ore).toBe(ore+50);
  expect(issueCommand(s,0,{...command,direction:'sell'})).toBe(true);expect(s.players[0].wood).toBeLessThan(wood);expect(s.players[0].ore).toBe(ore);
  expect(loadGame(saveGame(s)).economy).toEqual(s.economy);
 });
 it('raids a paid hostile warehouse, saves the channel, and returns stolen local stock',()=>{
  const s=fixture(),warehouse=enemyWarehouse(s),economy=economicState(s)!,structure=economy.structures.find(item=>item.entityId===warehouse.id)!,raider=s.entities.find(entity=>entity.side===0&&entity.role==='melee')!;
  s.players[1].wood-=80;structure.stock.wood=80;
  expect(issueCommand(s,0,{type:'move',ids:[raider.id],x:warehouse.x-2,y:warehouse.y})).toBe(true);run(s,40);refreshVisibility(s);
  const wood=s.players[0].wood;expect(issueCommand(s,0,{type:'raidSupply',ids:[raider.id],target:warehouse.id})).toBe(true);run(s,2.5);
  expect(structure.stock.wood).toBe(80);const restored=loadGame(saveGame(s));run(s,60);run(restored,60);expect(saveGame(restored)).toEqual(saveGame(s));
  expect(structure.stock.wood).toBe(80-ECONOMY_RULES.raid.capacity);expect(s.players[0].wood).toBe(wood+ECONOMY_RULES.raid.capacity);
 });
 it('destroys a paid structure in combat and collects its finite salvage with a real worker',()=>{
  const s=fixture(),warehouse=enemyWarehouse(s),economy=economicState(s)!,fighter=s.entities.find(entity=>entity.side===0&&entity.role==='melee')!;
  expect(economy.paidCosts.find(item=>item.entityId===warehouse.id)?.stock).toEqual(ECONOMY_RULES.warehouse.cost);
  warehouse.hp=1;
  expect(issueCommand(s,0,{type:'move',ids:[fighter.id],x:warehouse.x-2,y:warehouse.y})).toBe(true);run(s,40);refreshVisibility(s);
  if(warehouse.hp>0){expect(issueCommand(s,0,{type:'attack',ids:[fighter.id],target:warehouse.id})).toBe(true);run(s,5);}
  expect(warehouse.hp).toBe(0);expect(economy.structures.some(item=>item.entityId===warehouse.id)).toBe(false);
  const pile=economy.salvage.find(item=>item.kind==='salvage'&&item.owner===1)!;expect(pile.stock.wood).toBe(ECONOMY_RULES.warehouse.cost.wood*.25);
  const worker=workers(s)[0];expect(issueCommand(s,0,{type:'move',ids:[worker.id],x:pile.x-1,y:pile.y})).toBe(true);run(s,25);refreshVisibility(s);
  const wood=s.players[0].wood;expect(issueCommand(s,0,{type:'collectSalvage',ids:[worker.id],target:pile.id})).toBe(true);run(s,35);
  expect(economy.ledgers[0].salvaged.wood).toBe(18);expect(s.players[0].wood).toBe(wood+18);expect(loadGame(saveGame(s)).economy).toEqual(s.economy);
 });
 it('accepts a neutral contract locally and delivers its stock for a finite village reward',()=>{
  const s=fixture(),cart=caravan(s),economy=economicState(s)!,contract=economy.contracts.find(item=>item.kind==='ore')!,village=economy.villages.find(item=>item.id===contract.villageId)!;
  expect(issueCommand(s,0,{type:'acceptContract',id:contract.id})).toBe(false);
  expect(issueCommand(s,0,{type:'move',ids:[cart.id],x:contract.x,y:contract.y})).toBe(true);run(s,30);
  expect(issueCommand(s,0,{type:'acceptContract',id:contract.id})).toBe(true);
  const balance={wood:s.players[0].wood,ore:s.players[0].ore,crystal:s.players[0].crystal},rewardBefore={...village.rewardPool};
  expect(issueCommand(s,0,{type:'deliverContract',id:cart.id,contract:contract.id,source:hq(s).id})).toBe(true);
  const restored=loadGame(saveGame(s));run(s,70);run(restored,70);expect(saveGame(restored)).toEqual(saveGame(s));
  expect(contract.status).toBe('complete');expect(contract.delivered).toBe(contract.amount);expect(s.players[0].ore).toBe(balance.ore-contract.amount+contract.reward.ore);
  expect(s.players[0].crystal).toBe(balance.crystal+contract.reward.crystal);expect(village.rewardPool.crystal).toBe(rewardBefore.crystal-contract.reward.crystal);
  expect(issueCommand(s,0,{type:'deliverContract',id:cart.id,contract:contract.id,source:hq(s).id})).toBe(false);
 });
});
