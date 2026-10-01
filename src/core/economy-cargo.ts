import { addCost, costTotal, distance, economyMessage, economyStock, hasCost, payCost, RESOURCE_KINDS, takeCost, zeroCost, levelOf, sameLevel } from './economy-common';
import { ECONOMY_RULES } from './economy-definitions';
import type { EconomyCargo, EconomyCommand, EconomyHooks, EconomyMarket, EconomyState, EconomyTask, ResourceContract } from './economy-types';
import type { Cost, Entity, GameState, ResourceKind, Side } from './types';

const EPSILON = 1e-8;
const active = (entity:Entity) => entity.hp > 0 && !entity.illusion && !entity.raised;
const cargoFor = (economy:EconomyState,id:number) => economy.cargo.find(cargo => cargo.entityId === id);
const entityFor = (s:GameState,id:number) => s.entities.find(entity => entity.id === id && entity.hp > 0);
const validAmount = (amount:number,max=10000) => Number.isFinite(amount) && amount > 0 && amount <= max;
const validCost = (stock:Cost) => !!stock && RESOURCE_KINDS.every(kind => Number.isFinite(stock[kind]) && stock[kind] >= 0) && validAmount(costTotal(stock));
const completeBuilding = (entity:Entity) => entity.kind === 'building' && entity.progress === 1 && (entity.role === 'hq' || entity.role === 'depot');
const capacityFor = (economy:EconomyState,entity:Entity) => economy.caravans.includes(entity.id) ? ECONOMY_RULES.caravan.capacity : entity.role === 'worker' ? 18 : ECONOMY_RULES.raid.capacity;

export function marketCurrency(kind:ResourceKind):ResourceKind { return kind === 'wood' ? 'ore' : 'wood'; }

const priceRatio = (market:EconomyMarket,kind:ResourceKind) => 1 + (ECONOMY_RULES.market.stock - market.stock[kind] + market.demand[kind]) / ECONOMY_RULES.market.stock;
const clampPrice = (value:number) => Math.max(.5,Math.min(3,value));
const basePrice = (kind:ResourceKind) => ECONOMY_RULES.market.basePrices[kind] / (kind === 'wood' ? ECONOMY_RULES.market.basePrices.ore : 1);

/** Prices are expressed in ore for wood, and wood for ore and crystal. */
export function marketPrices(market:EconomyMarket):Cost {
 return {wood:basePrice('wood')*clampPrice(priceRatio(market,'wood')),ore:basePrice('ore')*clampPrice(priceRatio(market,'ore')),crystal:basePrice('crystal')*clampPrice(priceRatio(market,'crystal'))};
}

function integratePrice(start:number,slope:number,length:number):number {
 const boundaries=[0,length];
 if(slope!==0)for(const limit of [.5,3]){const crossing=(limit-start)/slope;if(crossing>0&&crossing<length)boundaries.push(crossing);}
 boundaries.sort((a,b)=>a-b);
 let result=0;
 for(let index=1;index<boundaries.length;index++){const low=boundaries[index-1],high=boundaries[index];result+=(clampPrice(start+slope*low)+clampPrice(start+slope*high))*.5*(high-low);}
 return result;
}

/** Integrating the curve makes a bulk purchase cost the same as consecutive smaller purchases. */
export function marketQuote(market:EconomyMarket,kind:ResourceKind,amount:number,direction:'buy'|'sell'):number {
 if(!validAmount(amount))return Number.NaN;
 const initial=priceRatio(market,kind),reserve=ECONOMY_RULES.market.stock;
 if(direction==='buy')return basePrice(kind)*integratePrice(initial,2/reserve,amount);
 const pressured=Math.min(amount,market.demand[kind]);
 const total=integratePrice(initial,-2/reserve,pressured)+integratePrice(initial-2*pressured/reserve,-1/reserve,amount-pressured);
 return basePrice(kind)*ECONOMY_RULES.market.sellFactor*total;
}

/** A normal move or attack cancels the job, while the unit keeps its paid cargo. */
export function cancelCargoTask(entity:Entity,economy:EconomyState):void {
 cancelTasks(economy,entity.id);
 const cargo=cargoFor(economy,entity.id);
 if(cargo){delete cargo.destinationId;cargo.tradeValue=0;delete cargo.contractId;cargo.origin='delivery';}
}

function cancelTasks(economy:EconomyState,entityId:number):void {
 for(const task of economy.tasks)if(task.entityId===entityId&&task.kind==='plant'){
  const grove=economy.groves.find(item=>item.id===task.targetId&&item.plantedAt<0);
  if(grove)grove.burned=true;
 }
 economy.tasks=economy.tasks.filter(task=>task.entityId!==entityId);
}

function startTask(s:GameState,entity:Entity,task:EconomyTask,economy:EconomyState,hooks:EconomyHooks):void {
 cancelTasks(economy,entity.id);
 delete entity.orderQueue;
 hooks.assign(s,entity,{type:'hold'});
 economy.tasks.push(task);
}

function finishTask(s:GameState,entity:Entity,economy:EconomyState,hooks:EconomyHooks):void {
 economy.tasks=economy.tasks.filter(task => task.entityId !== entity.id);
 hooks.assign(s,entity,{type:'idle'});
}

function permittedStorage(s:GameState,side:Side,id:number,hooks:EconomyHooks):Entity|undefined {
 const entity=entityFor(s,id);
 return entity && completeBuilding(entity) && hooks.allied(s,side,entity.side) && (entity.side===side||hooks.visible(s,side,entity)) ? entity : undefined;
}

function remainingCapacity(economy:EconomyState,id:number):number {
 const warehouse=economy.structures.find(item => item.entityId === id && item.kind === 'warehouse');
 return warehouse ? Math.max(0,warehouse.capacity-costTotal(warehouse.stock)) : Number.POSITIVE_INFINITY;
}

function nearestStorage(s:GameState,entity:Entity,economy:EconomyState):Entity|undefined {
 return s.entities.filter(storage => storage.hp>0 && storage.side===entity.side && sameLevel(entity,storage) && completeBuilding(storage) && remainingCapacity(economy,storage.id)>EPSILON).sort((a,b)=>distance(entity,a)-distance(entity,b)||a.id-b.id)[0];
}

function createCargo(entity:Entity,economy:EconomyState,origin:EconomyCargo['origin']):EconomyCargo {
 let cargo=cargoFor(economy,entity.id);
 if(!cargo){cargo={entityId:entity.id,stock:zeroCost(),capacity:capacityFor(economy,entity),origin,tradeValue:0};economy.cargo.push(cargo);}
 return cargo;
}

function ownUnit(s:GameState,side:Side,id:number):Entity|undefined {
 const entity=entityFor(s,id);
 return entity && entity.side===side && entity.kind==='unit' && active(entity) ? entity : undefined;
}

function canLoad(entity:Entity,economy:EconomyState):boolean {
 return entity.carried<=EPSILON && costTotal(cargoFor(economy,entity.id)?.stock??zeroCost())<=EPSILON;
}

function routeCommand(s:GameState,side:Side,entity:Entity,sourceId:number,targetId:number,stock:Cost,repeat:boolean,origin:'trade'|'delivery'|'contract',economy:EconomyState,hooks:EconomyHooks,contract?:ResourceContract):boolean {
 const source=permittedStorage(s,side,sourceId,hooks),target=contract??permittedStorage(s,side,targetId,hooks);
 if(!source||source.side!==side||!target||!sameLevel(entity,source)||!sameLevel(source,target)||sourceId===targetId||!validCost(stock)||costTotal(stock)>capacityFor(economy,entity)+EPSILON||!canLoad(entity,economy))return false;
 if(origin==='trade'&&distance(source,target)<8)return false;
 const sourceStock=economyStock(s,economy,sourceId);
 if(!sourceStock||!hasCost(sourceStock,stock))return false;
 const cargo=createCargo(entity,economy,origin);
 cargo.origin=origin;cargo.sourceId=sourceId;cargo.destinationId=targetId;cargo.tradeValue=0;
 if(contract)cargo.contractId=contract.id;else delete cargo.contractId;
 startTask(s,entity,{entityId:entity.id,kind:'route',targetId,sourceId,progress:0,repeat,phase:'loading',amount:{...stock},...(contract?{contractId:contract.id}:{})},economy,hooks);
 return true;
}

function availableContractReward(economy:EconomyState,contract:ResourceContract):boolean {
 const village=economy.villages.find(item=>item.id===contract.villageId);
 if(!village)return false;
 const promised={...contract.reward};
 for(const current of economy.contracts)if(current.id!==contract.id&&current.villageId===contract.villageId&&current.status==='accepted')addCost(promised,current.reward);
 return hasCost(village.rewardPool,promised);
}

export function applyCargoCommand(s:GameState,side:Side,command:EconomyCommand,economy:EconomyState,hooks:EconomyHooks):boolean|undefined {
 if(!['tradeRoute','deliverStock','deliverContract','marketTrade','acceptContract','raidSupply','collectSalvage'].includes(command.type))return undefined;
 if(!s.players[side]||s.eliminated[side]||s.winner!==null||s.draw)return false;
 if(command.type==='tradeRoute'||command.type==='deliverStock'||command.type==='deliverContract'){
  const entity=ownUnit(s,side,command.id);
  if(!entity||!economy.caravans.includes(entity.id))return false;
  if(command.type==='deliverStock')return routeCommand(s,side,entity,command.source,command.target,command.stock,false,'delivery',economy,hooks);
  if(command.type==='tradeRoute'){
   if(!RESOURCE_KINDS.includes(command.kind)||!validAmount(command.amount,ECONOMY_RULES.caravan.capacity)||typeof command.repeat!=='boolean')return false;
   const stock=zeroCost();stock[command.kind]=command.amount;
   return routeCommand(s,side,entity,command.source,command.target,stock,command.repeat,'trade',economy,hooks);
  }
  const contract=economy.contracts.find(item=>item.id===command.contract&&item.side===side&&item.status==='accepted'&&item.deadline>s.time);
  if(!contract)return false;
  const amount=Math.min(capacityFor(economy,entity),contract.amount-contract.delivered);
  if(amount<=EPSILON)return false;
  const stock=zeroCost();stock[contract.kind]=amount;
  return routeCommand(s,side,entity,command.source,contract.id,stock,false,'contract',economy,hooks,contract);
 }
 if(command.type==='marketTrade'){
  if(!RESOURCE_KINDS.includes(command.kind)||!validAmount(command.amount)||!['buy','sell'].includes(command.direction))return false;
  const market=economy.markets.find(item=>item.id===command.market),wallet=s.players[side];
  if(!market||!wallet||!hooks.visible(s,side,market))return false;
  const unit=s.entities.find(entity=>entity.side===side&&entity.kind==='unit'&&active(entity)&&distance(entity,market)<=3);
  if(!unit)return false;
  const currency=marketCurrency(command.kind),quote=marketQuote(market,command.kind,command.amount,command.direction);
  if(command.direction==='buy'){
   if(wallet[currency]+EPSILON<quote||market.stock[command.kind]+EPSILON<command.amount)return false;
   wallet[currency]=Math.max(0,wallet[currency]-quote);market.stock[currency]+=quote;
   market.stock[command.kind]=Math.max(0,market.stock[command.kind]-command.amount);wallet[command.kind]+=command.amount;
   market.demand[command.kind]+=command.amount;
  }else{
   if(wallet[command.kind]+EPSILON<command.amount||market.stock[currency]+EPSILON<quote)return false;
   wallet[command.kind]=Math.max(0,wallet[command.kind]-command.amount);market.stock[command.kind]+=command.amount;
   market.stock[currency]=Math.max(0,market.stock[currency]-quote);wallet[currency]+=quote;
   market.demand[command.kind]=Math.max(0,market.demand[command.kind]-command.amount);
  }
  economyMessage(s,unit,`${command.direction==='buy'?'Bought':'Sold'} ${command.amount} ${command.kind} for ${quote.toFixed(1)} ${currency}.`,market.id);
  return true;
 }
 if(command.type==='acceptContract'){
  const contract=economy.contracts.find(item=>item.id===command.id&&item.status==='open'&&item.deadline>s.time);
  if(!contract||!hooks.visible(s,side,contract)||!availableContractReward(economy,contract))return false;
  const unit=s.entities.find(entity=>entity.side===side&&entity.kind==='unit'&&active(entity)&&distance(entity,contract)<=3);
  if(!unit)return false;
  contract.side=side;contract.status='accepted';
  economyMessage(s,unit,`Accepted delivery of ${contract.amount} ${contract.kind}.`,contract.id);
  return true;
 }
 if(command.type==='raidSupply'||command.type==='collectSalvage'){
  if(!Array.isArray(command.ids))return false;
  const collecting=command.type==='collectSalvage';
  const salvage=collecting?economy.salvage.find(item=>item.id===command.target&&item.expiresAt>s.time&&costTotal(item.stock)>EPSILON):undefined;
  const target=collecting?salvage:entityFor(s,command.target);
  if(!target||!hooks.visible(s,side,target))return false;
  if(!collecting){
   const enemy=target as Entity;
   if(hooks.allied(s,side,enemy.side)||(!cargoFor(economy,enemy.id)&&!economy.structures.some(structure=>structure.entityId===enemy.id&&structure.kind==='warehouse')))return false;
  }
  let accepted=false;
  for(const id of new Set(command.ids)){
   const entity=ownUnit(s,side,id);
   if(!entity||!canLoad(entity,economy)||economy.caravans.includes(entity.id)||(collecting?entity.role!=='worker':entity.role==='worker'))continue;
   startTask(s,entity,{entityId:id,kind:collecting?'collect':'raid',targetId:command.target,progress:0},economy,hooks);accepted=true;
  }
  return accepted;
 }
 return undefined;
}

function returnCargo(s:GameState,entity:Entity,cargo:EconomyCargo,economy:EconomyState,hooks:EconomyHooks):void {
 cargo.origin='delivery';cargo.tradeValue=0;delete cargo.contractId;
 const storage=nearestStorage(s,entity,economy);
 if(!storage){delete cargo.destinationId;finishTask(s,entity,economy,hooks);return;}
 cargo.destinationId=storage.id;
 startTask(s,entity,{entityId:entity.id,kind:'route',targetId:storage.id,sourceId:cargo.sourceId??storage.id,progress:0,repeat:false,phase:'delivery',amount:{...cargo.stock}},economy,hooks);
}

function depositCargo(s:GameState,entity:Entity,target:Entity,cargo:EconomyCargo,economy:EconomyState):boolean {
 const stock=economyStock(s,economy,target.id);
 if(!stock)return false;
 const originalTotal=costTotal(cargo.stock),deposited=takeCost(cargo.stock,remainingCapacity(economy,target.id));
 if(costTotal(deposited)<=EPSILON)return false;
 addCost(stock,deposited);addCost(economy.ledgers[entity.side].delivered,deposited);
 if(cargo.origin==='trade'&&cargo.tradeValue>EPSILON){
  // Public markets fund a finite crystal reward. Travelling does not create resources.
  const market=economy.markets.filter(item=>sameLevel(target,item)&&item.stock.crystal>EPSILON).sort((a,b)=>distance(target,a)-distance(target,b)||a.id-b.id)[0];
  const earned=cargo.tradeValue*costTotal(deposited)/originalTotal;
  if(market){const reward=Math.min(market.stock.crystal,earned);market.stock.crystal-=reward;s.players[entity.side].crystal+=reward;economy.ledgers[entity.side].traded.crystal+=reward;}
  cargo.tradeValue=Math.max(0,cargo.tradeValue-earned);
 }
 if(costTotal(cargo.stock)<=EPSILON){cargo.stock=zeroCost();cargo.tradeValue=0;return true;}
 return false;
}

function tickRoute(s:GameState,dt:number,entity:Entity,task:Extract<EconomyTask,{kind:'route'}>,economy:EconomyState,hooks:EconomyHooks):void {
 const cargo=cargoFor(economy,entity.id);
 if(!cargo){finishTask(s,entity,economy,hooks);return;}
 const contract=task.contractId===undefined?undefined:economy.contracts.find(item=>item.id===task.contractId);
 if(task.contractId!==undefined&&(!contract||contract.status!=='accepted'||contract.side!==entity.side||contract.deadline<=s.time)){
  if(costTotal(cargo.stock)>EPSILON)returnCargo(s,entity,cargo,economy,hooks);else finishTask(s,entity,economy,hooks);return;
 }
 if(task.phase==='loading'){
  const source=permittedStorage(s,entity.side,task.sourceId,hooks),target=contract??permittedStorage(s,entity.side,task.targetId,hooks);
  if(!source||source.side!==entity.side||!target){finishTask(s,entity,economy,hooks);return;}
  if(!hooks.move(s,entity,source,dt,hooks.radius(s,source)+1))return;
  const sourceStock=economyStock(s,economy,source.id);
  if(!sourceStock||!payCost(sourceStock,task.amount))return;
  cargo.stock={...task.amount};cargo.sourceId=source.id;cargo.destinationId=task.targetId;
  cargo.tradeValue=cargo.origin==='trade'?costTotal(cargo.stock)*Math.min(.5,distance(source,target)*.015):0;
  task.phase='delivery';task.progress=0;
  return;
 }
 const target=contract??permittedStorage(s,entity.side,task.targetId,hooks);
 if(!target){returnCargo(s,entity,cargo,economy,hooks);return;}
 const reach=contract?2:hooks.radius(s,target as Entity)+1;
 if(!hooks.move(s,entity,target,dt,reach))return;
 if(contract){
  const amount=Math.min(cargo.stock[contract.kind],Math.max(0,contract.amount-contract.delivered));
  cargo.stock[contract.kind]-=amount;contract.delivered+=amount;
  economy.ledgers[entity.side].delivered[contract.kind]+=amount;
  if(contract.delivered+EPSILON>=contract.amount){
   const village=economy.villages.find(item=>item.id===contract.villageId);
   if(village&&payCost(village.rewardPool,contract.reward)){addCost(s.players[entity.side],contract.reward);addCost(economy.ledgers[entity.side].contractRewards,contract.reward);contract.status='complete';economyMessage(s,entity,'Resource contract completed.',contract.id);}
  }
  if(costTotal(cargo.stock)>EPSILON)returnCargo(s,entity,cargo,economy,hooks);else finishTask(s,entity,economy,hooks);
  return;
 }
 if(costTotal(cargo.stock)>EPSILON&&!depositCargo(s,entity,target as Entity,cargo,economy))return;
 if(task.repeat){task.phase='loading';task.progress=0;cargo.destinationId=task.targetId;}
 else finishTask(s,entity,economy,hooks);
}

function tickCollection(s:GameState,dt:number,entity:Entity,task:Extract<EconomyTask,{kind:'collect'|'raid'}>,economy:EconomyState,hooks:EconomyHooks):void {
 const collecting=task.kind==='collect';
 const salvage=collecting?economy.salvage.find(item=>item.id===task.targetId&&item.expiresAt>s.time):undefined;
 const enemy=collecting?undefined:entityFor(s,task.targetId);
 const target=salvage??enemy;
 const structure=enemy?economy.structures.find(item=>item.entityId===enemy.id&&item.kind==='warehouse'):undefined;
 const hostileCargo=enemy?cargoFor(economy,enemy.id):undefined;
 if(!target||!hooks.visible(s,entity.side,target)||enemy&&hooks.allied(s,entity.side,enemy.side)||!collecting&&!structure&&!hostileCargo){finishTask(s,entity,economy,hooks);return;}
 const reach=enemy?hooks.radius(s,enemy)+.8:1;
 if(distance(entity,target)>reach){task.progress=0;hooks.move(s,entity,target,dt,reach);return;}
 entity.animation='attack';task.progress+=dt/(collecting?ECONOMY_RULES.salvage.channelSeconds:ECONOMY_RULES.raid.channelSeconds);
 if(task.progress<1)return;
 const stock=salvage?.stock??structure?.stock??hostileCargo?.stock;
 if(!stock||costTotal(stock)<=EPSILON){finishTask(s,entity,economy,hooks);return;}
 const before=costTotal(stock),cargo=createCargo(entity,economy,collecting?'salvage':'raid');
 cargo.stock=takeCost(stock,cargo.capacity);cargo.origin=collecting?'salvage':'raid';cargo.sourceId=target.id;cargo.tradeValue=0;
 if(hostileCargo&&stock===hostileCargo.stock)hostileCargo.tradeValue*=Math.max(0,1-costTotal(cargo.stock)/before);
 addCost(collecting?economy.ledgers[entity.side].salvaged:economy.ledgers[entity.side].raided,cargo.stock);
 const destination=nearestStorage(s,entity,economy);
 if(destination){cargo.destinationId=destination.id;startTask(s,entity,{entityId:entity.id,kind:'route',targetId:destination.id,sourceId:target.id,progress:0,repeat:false,phase:'delivery',amount:{...cargo.stock}},economy,hooks);}
 else finishTask(s,entity,economy,hooks);
}

export function tickCargo(s:GameState,dt:number,economy:EconomyState,hooks:EconomyHooks):void {
 if(!Number.isFinite(dt)||dt<=0)return;
 const retainedIds=new Set(s.entities.map(entity=>entity.id));
 economy.deathClaims=economy.deathClaims.filter(id=>retainedIds.has(id));
 economy.paidCosts=economy.paidCosts.filter(item=>retainedIds.has(item.entityId));
 economy.salvage=economy.salvage.filter(item=>item.expiresAt>s.time&&costTotal(item.stock)>EPSILON);
 for(const contract of economy.contracts)if((contract.status==='open'||contract.status==='accepted')&&contract.deadline<=s.time)contract.status='expired';
 for(const market of economy.markets){
  const elapsed=Math.max(0,s.time-market.recoverAt);
  if(elapsed>0){for(const kind of RESOURCE_KINDS)market.demand[kind]=Math.max(0,market.demand[kind]-elapsed*ECONOMY_RULES.market.stock*ECONOMY_RULES.market.recoveryPerSecond);market.recoverAt=s.time;}
 }
 for(const task of [...economy.tasks]){
  if(task.kind==='plant'||!economy.tasks.includes(task))continue;
  const entity=entityFor(s,task.entityId);
  if(!entity||!active(entity)){economy.tasks=economy.tasks.filter(item=>item!==task);continue;}
  if(task.kind==='route')tickRoute(s,dt,entity,task,economy,hooks);else tickCollection(s,dt,entity,task,economy,hooks);
 }
 for(const cargo of economy.cargo){
  const entity=entityFor(s,cargo.entityId);
  if(!entity||economy.tasks.some(task=>task.entityId===entity.id)||costTotal(cargo.stock)<=EPSILON)continue;
  cargo.origin='delivery';cargo.tradeValue=0;delete cargo.contractId;
  const target=nearestStorage(s,entity,economy);
  if(target&&distance(entity,target)<=hooks.radius(s,target)+1)depositCargo(s,entity,target,cargo,economy);
 }
 economy.salvage=economy.salvage.filter(item=>item.expiresAt>s.time&&costTotal(item.stock)>EPSILON);
 for(const task of [...economy.tasks])if(task.kind==='collect'&&!economy.salvage.some(item=>item.id===task.targetId)){
  const entity=entityFor(s,task.entityId);
  if(entity)finishTask(s,entity,economy,hooks);else economy.tasks=economy.tasks.filter(item=>item!==task);
 }
}

/** Only recorded paid structures and siege engines create new salvage; carried stock transfers once. */
export function economicDeath(s:GameState,entity:Entity,economy:EconomyState,_hooks:EconomyHooks):void {
 if(economy.deathClaims.includes(entity.id))return;
 economy.deathClaims.push(entity.id);
 const cargo=cargoFor(economy,entity.id),structure=economy.structures.find(item=>item.entityId===entity.id),paid=economy.paidCosts.find(item=>item.entityId===entity.id);
 const dropped=zeroCost();
 if(!entity.illusion&&!entity.raised){
  if(cargo)addCost(dropped,cargo.stock);
  if(structure)addCost(dropped,structure.stock);
  if(entity.carried>0&&Number.isFinite(entity.carried)&&RESOURCE_KINDS.includes(entity.carriedKind))dropped[entity.carriedKind]+=Math.min(18,entity.carried);
 }
 if(costTotal(dropped)>EPSILON)economy.salvage.push({id:s.nextId++,x:entity.x,y:entity.y,level:levelOf(entity),stock:dropped,expiresAt:s.time+ECONOMY_RULES.salvage.expiresSeconds,owner:entity.side,kind:'cargo'});
 if(paid&&!entity.illusion&&!entity.raised&&(entity.kind==='building'||entity.role==='siege')){
  const eligible=zeroCost(),fraction=.25*Math.max(.1,Math.min(1,entity.progress)),scale=Math.min(1,350/Math.max(EPSILON,costTotal(paid.stock)*fraction));
  for(const kind of RESOURCE_KINDS)eligible[kind]=paid.stock[kind]*fraction*scale;
  if(costTotal(eligible)>EPSILON)economy.salvage.push({id:s.nextId++,x:entity.x,y:entity.y,level:levelOf(entity),stock:eligible,expiresAt:s.time+ECONOMY_RULES.salvage.expiresSeconds,owner:entity.side,kind:'salvage'});
 }
 if(structure)structure.stock=zeroCost();
 economy.structures=economy.structures.filter(item=>item.entityId!==entity.id);
 economy.specializations=economy.specializations.filter(item=>item.entityId!==entity.id);
 entity.carried=0;
 economy.cargo=economy.cargo.filter(item=>item.entityId!==entity.id);
 cancelTasks(economy,entity.id);
 economy.caravans=economy.caravans.filter(id=>id!==entity.id);
 economy.paidCosts=economy.paidCosts.filter(item=>item.entityId!==entity.id);
 economy.workerWarehouses=economy.workerWarehouses.filter(item=>item.entityId!==entity.id&&item.warehouseId!==entity.id);
 for(const recruit of economy.recruits)if(recruit.producerId===entity.id&&s.players[recruit.side])addCost(s.players[recruit.side],ECONOMY_RULES.caravan.cost);
 economy.recruits=economy.recruits.filter(recruit=>recruit.producerId!==entity.id);
}
