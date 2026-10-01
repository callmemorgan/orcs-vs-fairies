import { describe, expect, it } from 'vitest';
import { applyCargoCommand, cancelCargoTask, economicDeath, marketCurrency, marketPrices, marketQuote, tickCargo } from '../src/core/economy-cargo';
import { costTotal, ensureEconomy, zeroCost } from '../src/core/economy-common';
import { ECONOMY_RULES } from '../src/core/economy-definitions';
import { FACTIONS } from '../src/core/content';
import { createGame } from '../src/core/simulation';
import type { EconomyHooks, EconomyMarket, EconomyState } from '../src/core/economy-types';
import type { Entity, GameState, Side, UnitRole } from '../src/core/types';

function fixture() {
 const s=createGame('orcs',1337,'fairies',{controllers:['human','human']});
 const economy=ensureEconomy(s),hq=s.entities.find(entity=>entity.side===0&&entity.role==='hq')!;
 economy.markets=[];economy.villages=[];economy.contracts=[];
 const destination={...structuredClone(hq),id:s.nextId++,x:hq.x+12,y:hq.y};s.entities.push(destination);
 const caravan=s.entities.find(entity=>entity.side===0&&entity.role==='worker')!;caravan.x=hq.x;caravan.y=hq.y;economy.caravans.push(caravan.id);
 const market:EconomyMarket={id:s.nextId++,x:hq.x,y:hq.y,stock:{wood:1500,ore:1500,crystal:1500},demand:zeroCost(),recoverAt:0};economy.markets.push(market);
 const hooks:EconomyHooks={
  visible:()=>true,allied:(state,a,b)=>state.teams[a]===state.teams[b],
  assign:(_state,entity,order)=>{entity.order=order;entity.path=[];},
  invalidateNavigation:(_state,entity)=>{entity.path=[];entity.entrenchedAt=undefined;},
  move:(_state,entity,target,dt,reach)=>{const distance=Math.hypot(target.x-entity.x,target.y-entity.y);if(distance<=reach+1e-8)return true;const travel=Math.min(distance-reach,1.8*dt);entity.x+=(target.x-entity.x)/distance*travel;entity.y+=(target.y-entity.y)/distance*travel;return distance-travel<=reach+1e-8;},
  radius:(_state,entity)=>entity.kind==='building'?1:.3,canPlace:()=>true,
  buildingDef:(state,entity)=>FACTIONS[state.players[entity.side].faction].buildings[entity.role as 'hq'],
  unitDef:(state,entity)=>FACTIONS[state.players[entity.side].faction].units[entity.role as UnitRole],
  spawn:()=>{throw new Error('Cargo does not spawn actors.');},
 };
 return {s,economy,hq,destination,caravan,market,hooks};
}

function run(s:GameState,economy:EconomyState,hooks:EconomyHooks,seconds:number) {
 for(let time=0;time<seconds;time+=.1){s.time+=.1;tickCargo(s,.1,economy,hooks);}
}

function soldier(s:GameState,side:Side,x:number,y:number):Entity {
 const template=s.entities.find(entity=>entity.kind==='unit'&&entity.role==='melee')!;
 const entity={...structuredClone(template),id:s.nextId++,side,x,y};s.entities.push(entity);return entity;
}

describe('physical deliveries and trade',()=>{
 it('debits only after loading and pays only after arrival from a finite public reserve',()=>{
  const {s,economy,hq,destination,caravan,market,hooks}=fixture();caravan.x=hq.x+5;
  const wood=s.players[0].wood,crystal=s.players[0].crystal,reserve=market.stock.crystal;
  expect(applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'wood',amount:30,repeat:false},economy,hooks)).toBe(true);
  expect(s.players[0].wood).toBe(wood);expect(s.players[0].crystal).toBe(crystal);
  run(s,economy,hooks,2);expect(s.players[0].wood).toBe(wood-30);expect(s.players[0].crystal).toBe(crystal);
  expect(economy.cargo[0].stock.wood).toBe(30);
  run(s,economy,hooks,10);expect(s.players[0].wood).toBe(wood);expect(s.players[0].crystal).toBeCloseTo(crystal+5.4);
  expect(market.stock.crystal+s.players[0].crystal).toBeCloseTo(reserve+crystal);expect(economy.tasks).toHaveLength(0);
 });
 it('repeated travel exhausts the reserve without creating income afterward',()=>{
  const {s,economy,hq,destination,caravan,market,hooks}=fixture();market.stock.crystal=3;
  expect(applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'wood',amount:30,repeat:true},economy,hooks)).toBe(true);
  run(s,economy,hooks,60);expect(s.players[0].crystal).toBeCloseTo(3);expect(market.stock.crystal).toBe(0);
  run(s,economy,hooks,60);expect(s.players[0].crystal).toBeCloseTo(3);expect(economy.ledgers[0].traded.crystal).toBeCloseTo(3);
 });
 it('moves real local stock and waits for warehouse capacity',()=>{
  const {s,economy,hq,destination,caravan,hooks}=fixture();
  economy.structures.push({entityId:hq.id,kind:'warehouse',stock:{wood:40,ore:0,crystal:0},capacity:50,overcharge:false,nextIncident:0},{entityId:destination.id,kind:'warehouse',stock:{wood:40,ore:0,crystal:0},capacity:50,overcharge:false,nextIncident:0});
  const wallet=s.players[0].wood;
  expect(applyCargoCommand(s,0,{type:'deliverStock',id:caravan.id,source:hq.id,target:destination.id,stock:{wood:30,ore:0,crystal:0}},economy,hooks)).toBe(true);
  run(s,economy,hooks,15);expect(economy.structures[0].stock.wood).toBe(10);expect(economy.structures[1].stock.wood).toBe(50);expect(economy.cargo[0].stock.wood).toBe(20);expect(s.players[0].wood).toBe(wallet);
  economy.structures[1].stock.wood=20;run(s,economy,hooks,1);expect(economy.structures[1].stock.wood).toBe(40);expect(economy.cargo[0].stock.wood).toBe(0);
 });
 it('gates endpoints, capacity, source funds and loaded-caravan replacement',()=>{
  const {s,economy,hq,destination,caravan,hooks}=fixture();const enemy=s.entities.find(entity=>entity.side===1&&entity.role==='hq')!;
  for(const target of [hq.id,enemy.id,9999])expect(applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target,kind:'wood',amount:30,repeat:false},economy,hooks)).toBe(false);
  for(const amount of [0,-1,91,Number.NaN,Number.POSITIVE_INFINITY])expect(applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'wood',amount,repeat:false},economy,hooks)).toBe(false);
  s.players[0].wood=10;expect(applyCargoCommand(s,0,{type:'deliverStock',id:caravan.id,source:hq.id,target:destination.id,stock:{wood:30,ore:0,crystal:0}},economy,hooks)).toBe(false);
  s.players[0].wood=100;expect(applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'wood',amount:30,repeat:false},economy,hooks)).toBe(true);
  run(s,economy,hooks,.1);expect(applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'ore',amount:20,repeat:false},economy,hooks)).toBe(false);
 });
 it('allows visible allied deliveries but cannot withdraw from an allied wallet',()=>{
  const {s,economy,hq,caravan,hooks}=fixture(),ally=s.entities.find(entity=>entity.side===1&&entity.role==='hq')!;s.teams[1]=s.teams[0];
  const base={type:'deliverStock' as const,id:caravan.id,stock:{wood:20,ore:0,crystal:0}};
  expect(applyCargoCommand(s,0,{...base,source:ally.id,target:hq.id},economy,hooks)).toBe(false);
  expect(applyCargoCommand(s,0,{...base,source:hq.id,target:ally.id},economy,{...hooks,visible:()=>false})).toBe(false);
  expect(applyCargoCommand(s,0,{...base,source:hq.id,target:ally.id},economy,hooks)).toBe(true);
 });
 it('returns paid cargo after destination loss, without a trade reward',()=>{
  const {s,economy,hq,destination,caravan,hooks}=fixture();const wood=s.players[0].wood;
  applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'wood',amount:30,repeat:false},economy,hooks);run(s,economy,hooks,2);
  destination.hp=0;run(s,economy,hooks,6);expect(s.players[0].wood).toBeCloseTo(wood);expect(s.players[0].crystal).toBe(0);expect(economy.cargo[0].stock.wood).toBe(0);
 });
 it('cancels a route without deleting physical stock, which can still be delivered',()=>{
  const {s,economy,hq,destination,caravan,hooks}=fixture();const wood=s.players[0].wood;
  applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'wood',amount:30,repeat:false},economy,hooks);run(s,economy,hooks,3);
  cancelCargoTask(caravan,economy);expect(economy.tasks).toHaveLength(0);expect(economy.cargo[0].stock.wood).toBe(30);expect(economy.cargo[0].tradeValue).toBe(0);
  caravan.x=hq.x;caravan.y=hq.y;run(s,economy,hooks,.1);expect(s.players[0].wood).toBe(wood);expect(s.players[0].crystal).toBe(0);
 });
 it('survives a JSON checkpoint halfway through a loaded route',()=>{
  const {s,economy,hq,destination,caravan,hooks}=fixture();
  applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'ore',amount:20,repeat:false},economy,hooks);run(s,economy,hooks,3);
  const restored=JSON.parse(JSON.stringify(s)) as GameState,restoredEconomy=(restored as GameState&{economy:EconomyState}).economy;
  run(s,economy,hooks,10);run(restored,restoredEconomy,hooks,10);
  expect(restored.players).toEqual(s.players);expect(restoredEconomy).toEqual(economy);
 });
});

describe('finite neutral market',()=>{
 it('requires a nearby real owned unit and visible market',()=>{
  const {s,economy,market,hooks}=fixture();for(const entity of s.entities)if(entity.side===0){entity.x=market.x+20;entity.y=market.y+20;}
  const command={type:'marketTrade' as const,market:market.id,kind:'ore' as const,amount:10,direction:'buy' as const};
  expect(applyCargoCommand(s,0,command,economy,hooks)).toBe(false);
  const unit=s.entities.find(entity=>entity.side===0&&entity.kind==='unit')!;unit.x=market.x;unit.y=market.y;unit.illusion=true;expect(applyCargoCommand(s,0,command,economy,hooks)).toBe(false);
  unit.illusion=false;expect(applyCargoCommand(s,0,command,economy,{...hooks,visible:()=>false})).toBe(false);expect(applyCargoCommand(s,0,command,economy,hooks)).toBe(true);
 });
 it('uses the right currencies, changes quotes and conserves wallet plus market stock',()=>{
  const {s,economy,market,hooks}=fixture();expect(marketCurrency('wood')).toBe('ore');expect(marketCurrency('crystal')).toBe('wood');
  const total={wood:s.players[0].wood+market.stock.wood,ore:s.players[0].ore+market.stock.ore,crystal:s.players[0].crystal+market.stock.crystal},before=marketPrices(market).ore;
  expect(applyCargoCommand(s,0,{type:'marketTrade',market:market.id,kind:'ore',amount:20,direction:'buy'},economy,hooks)).toBe(true);
  expect(marketPrices(market).ore).toBeGreaterThan(before);
  for(const kind of ['wood','ore','crystal'] as const)expect(s.players[0][kind]+market.stock[kind]).toBeCloseTo(total[kind]);
  const stock={...market.stock};run(s,economy,hooks,60);expect(market.stock).toEqual(stock);
 });
 it('charges identical integrated prices for bulk and split transactions',()=>{
  const {market}=fixture();market.stock.ore=750;market.demand.ore=80;
  const bulk=marketQuote(market,'ore',200,'buy');let split=0;
  for(let step=0;step<20;step++){split+=marketQuote(market,'ore',10,'buy');market.stock.ore-=10;market.demand.ore+=10;}
  expect(split).toBeCloseTo(bulk,9);
  const soldBulk=marketQuote(market,'ore',200,'sell');split=0;
  for(let step=0;step<20;step++){split+=marketQuote(market,'ore',10,'sell');market.stock.ore+=10;market.demand.ore=Math.max(0,market.demand.ore-10);}
  expect(split).toBeCloseTo(soldBulk,9);
 });
 it('a same-market purchase and sale loses currency, including price-clamp crossings',()=>{
  for(const demand of [0,740,3000])for(const kind of ['wood','ore','crystal'] as const){
   const {s,economy,market,hooks}=fixture();market.demand[kind]=demand;s.players[0].wood=10000;s.players[0].ore=10000;
   const currency=marketCurrency(kind),before=s.players[0][currency];
   expect(applyCargoCommand(s,0,{type:'marketTrade',market:market.id,kind,amount:100,direction:'buy'},economy,hooks)).toBe(true);
   expect(applyCargoCommand(s,0,{type:'marketTrade',market:market.id,kind,amount:100,direction:'sell'},economy,hooks)).toBe(true);
   expect(s.players[0][currency]).toBeLessThan(before);
  }
 });
 it('rejects exhausted stock or insufficient funds atomically',()=>{
  const {s,economy,market,hooks}=fixture();market.stock.ore=5;s.players[0].wood=2;
  const before=JSON.stringify({players:s.players,market});
  expect(applyCargoCommand(s,0,{type:'marketTrade',market:market.id,kind:'ore',amount:10,direction:'buy'},economy,hooks)).toBe(false);
  expect(JSON.stringify({players:s.players,market})).toBe(before);
  market.stock.wood=0;expect(applyCargoCommand(s,0,{type:'marketTrade',market:market.id,kind:'ore',amount:1,direction:'sell'},economy,hooks)).toBe(false);
 });
});

describe('supply raids and battlefield salvage',()=>{
 it('channels against visible hostile local storage and brings stolen stock home',()=>{
  const {s,economy,hq,hooks}=fixture();const enemy=s.entities.find(entity=>entity.side===1&&entity.role==='hq')!;enemy.x=hq.x+7;enemy.y=hq.y;
  economy.structures.push({entityId:enemy.id,kind:'warehouse',stock:{wood:40,ore:5,crystal:0},capacity:900,overcharge:false,nextIncident:0});
  const raider=soldier(s,0,enemy.x-1,enemy.y),wood=s.players[0].wood;
  expect(applyCargoCommand(s,0,{type:'raidSupply',ids:[raider.id],target:enemy.id},economy,hooks)).toBe(true);
  run(s,economy,hooks,2);expect(economy.structures[0].stock.wood).toBe(40);expect(s.players[0].wood).toBe(wood);
  run(s,economy,hooks,1.1);expect(economy.structures[0].stock.wood).toBe(16);expect(s.players[0].wood).toBe(wood);expect(economy.cargo.find(item=>item.entityId===raider.id)?.stock.wood).toBe(24);
  run(s,economy,hooks,10);expect(s.players[0].wood).toBe(wood+24);expect(economy.ledgers[0].raided.wood).toBe(24);
 });
 it('forbids allied or hidden raids, civilian raids and military collection',()=>{
  const {s,economy,hq,caravan,hooks}=fixture(),raider=soldier(s,0,hq.x,hq.y);
  economy.structures.push({entityId:hq.id,kind:'warehouse',stock:{wood:50,ore:0,crystal:0},capacity:900,overcharge:false,nextIncident:0});
  expect(applyCargoCommand(s,0,{type:'raidSupply',ids:[raider.id],target:hq.id},economy,hooks)).toBe(false);
  const enemy=s.entities.find(entity=>entity.side===1&&entity.role==='hq')!;economy.structures.push({...economy.structures[0],entityId:enemy.id});
  expect(applyCargoCommand(s,0,{type:'raidSupply',ids:[raider.id],target:enemy.id},economy,{...hooks,visible:()=>false})).toBe(false);
  expect(applyCargoCommand(s,0,{type:'raidSupply',ids:[caravan.id],target:enemy.id},economy,hooks)).toBe(false);
  economy.salvage.push({id:s.nextId++,x:hq.x,y:hq.y,stock:{wood:5,ore:0,crystal:0},expiresAt:100,owner:null,kind:'salvage'});
  expect(applyCargoCommand(s,0,{type:'collectSalvage',ids:[raider.id],target:economy.salvage[0].id},economy,hooks)).toBe(false);
 });
 it('creates bounded salvage only from recorded paid costs and drops finite stock once',()=>{
  const {s,economy,hq,caravan,hooks}=fixture();
  economy.paidCosts.push({entityId:hq.id,stock:{wood:10000,ore:10000,crystal:10000}});economy.structures.push({entityId:hq.id,kind:'warehouse',stock:{wood:20,ore:5,crystal:0},capacity:900,overcharge:false,nextIncident:0});
  economicDeath(s,hq,economy,hooks);economicDeath(s,hq,economy,hooks);
  expect(economy.salvage).toHaveLength(2);expect(costTotal(economy.salvage.find(item=>item.kind==='salvage')!.stock)).toBeCloseTo(350);expect(costTotal(economy.salvage.find(item=>item.kind==='cargo')!.stock)).toBe(25);
  const enemy=s.entities.find(entity=>entity.side===1&&entity.role==='hq')!;economicDeath(s,enemy,economy,hooks);expect(economy.salvage).toHaveLength(2);
  caravan.carried=7;economicDeath(s,caravan,economy,hooks);economicDeath(s,caravan,economy,hooks);expect(economy.salvage).toHaveLength(3);expect(caravan.carried).toBe(0);
 });
 it('collects each finite salvage pile at most once even with competing workers',()=>{
  const {s,economy,hq,hooks}=fixture(),workers=s.entities.filter(entity=>entity.side===0&&entity.role==='worker').slice(1,3),wood=s.players[0].wood;
  for(const worker of workers){worker.x=hq.x;worker.y=hq.y;}
  const salvage={id:s.nextId++,x:hq.x+1,y:hq.y,stock:{wood:12,ore:0,crystal:0},expiresAt:100,owner:null,kind:'salvage' as const};economy.salvage.push(salvage);
  expect(applyCargoCommand(s,0,{type:'collectSalvage',ids:workers.map(worker=>worker.id),target:salvage.id},economy,hooks)).toBe(true);
  run(s,economy,hooks,5);expect(s.players[0].wood).toBeCloseTo(wood+12);expect(economy.ledgers[0].salvaged.wood).toBe(12);expect(economy.salvage).toHaveLength(0);
 });
 it('a slain loaded carrier drops only its remaining stock and refunds pending caravan recruits',()=>{
  const {s,economy,hq,destination,caravan,hooks}=fixture();applyCargoCommand(s,0,{type:'tradeRoute',id:caravan.id,source:hq.id,target:destination.id,kind:'wood',amount:30,repeat:false},economy,hooks);run(s,economy,hooks,2);
  economicDeath(s,caravan,economy,hooks);expect(economy.cargo).toHaveLength(0);expect(economy.tasks).toHaveLength(0);expect(economy.salvage[0].stock.wood).toBe(30);
  economy.recruits.push({producerId:hq.id,side:0,readyAt:100},{producerId:hq.id,side:0,readyAt:110});const wood=s.players[0].wood;economicDeath(s,hq,economy,hooks);expect(s.players[0].wood).toBe(wood+2*ECONOMY_RULES.caravan.cost.wood);expect(economy.recruits).toHaveLength(0);
  economicDeath(s,hq,economy,hooks);expect(s.players[0].wood).toBe(wood+2*ECONOMY_RULES.caravan.cost.wood);
 });
});

describe('neutral resource contracts',()=>{
 function contractFixture() {
  const data=fixture(),{s,economy,hq}=data,village={id:s.nextId++,x:hq.x+10,y:hq.y,rewardPool:{wood:35,ore:25,crystal:10}};
  economy.villages.push(village);const contract={id:s.nextId++,villageId:village.id,x:village.x,y:village.y,side:null,kind:'ore' as const,amount:60,delivered:0,deadline:180,reward:{wood:35,ore:25,crystal:10},status:'open' as const};economy.contracts.push(contract);
  return {...data,village,contract};
 }
 it('accepts locally, delivers physically, and pays from the village pool once',()=>{
  const {s,economy,hq,caravan,hooks,contract,village}=contractFixture();
  expect(applyCargoCommand(s,0,{type:'acceptContract',id:contract.id},economy,hooks)).toBe(false);
  caravan.x=village.x;caravan.y=village.y;expect(applyCargoCommand(s,0,{type:'acceptContract',id:contract.id},economy,hooks)).toBe(true);
  const before={wood:s.players[0].wood,ore:s.players[0].ore,crystal:s.players[0].crystal};
  expect(applyCargoCommand(s,0,{type:'deliverContract',id:caravan.id,contract:contract.id,source:hq.id},economy,hooks)).toBe(true);
  run(s,economy,hooks,3);expect(s.players[0].ore).toBe(before.ore);expect(contract.delivered).toBe(0);
  run(s,economy,hooks,15);expect(contract.status).toBe('complete');expect(contract.delivered).toBe(60);expect(village.rewardPool).toEqual(zeroCost());expect(s.players[0].ore).toBe(before.ore-60+25);expect(s.players[0].wood).toBe(before.wood+35);expect(s.players[0].crystal).toBe(10);
  expect(applyCargoCommand(s,0,{type:'deliverContract',id:caravan.id,contract:contract.id,source:hq.id},economy,hooks)).toBe(false);run(s,economy,hooks,10);expect(s.players[0].crystal).toBe(10);
 });
 it('reserves promises against the finite pool and preserves deadlines',()=>{
  const {s,economy,caravan,hooks,contract,village}=contractFixture();caravan.x=village.x;caravan.y=village.y;
  economy.contracts.push({...contract,id:s.nextId++});
  expect(applyCargoCommand(s,0,{type:'acceptContract',id:contract.id},economy,hooks)).toBe(true);
  expect(applyCargoCommand(s,0,{type:'acceptContract',id:economy.contracts[1].id},economy,hooks)).toBe(false);
  const snapshot=JSON.parse(JSON.stringify(economy));expect(snapshot.contracts[0].deadline).toBe(180);expect(snapshot.contracts[0].status).toBe('accepted');
  s.time=181;tickCargo(s,.1,economy,hooks);expect(contract.status).toBe('expired');expect(economy.contracts[1].status).toBe('expired');expect(village.rewardPool.crystal).toBe(10);
 });
 it('returns an expired delivery rather than paying a late reward',()=>{
  const {s,economy,hq,caravan,hooks,contract,village}=contractFixture();caravan.x=village.x;caravan.y=village.y;
  applyCargoCommand(s,0,{type:'acceptContract',id:contract.id},economy,hooks);caravan.x=hq.x;caravan.y=hq.y;applyCargoCommand(s,0,{type:'deliverContract',id:caravan.id,contract:contract.id,source:hq.id},economy,hooks);
  const ore=s.players[0].ore;run(s,economy,hooks,2);expect(s.players[0].ore).toBe(ore-60);
  contract.deadline=s.time;run(s,economy,hooks,10);expect(contract.status).toBe('expired');expect(s.players[0].ore).toBe(ore);expect(s.players[0].crystal).toBe(0);expect(village.rewardPool.crystal).toBe(10);
 });
});
