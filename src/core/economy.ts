import { DIRECTIONS_32 } from './geometry';
import { ECONOMY_BUILDINGS, ECONOMY_CARAVAN, ECONOMY_RULES } from './economy-definitions';
import { createEconomyState, distance, economicState, economyMessage, ensureEconomy, payCost, RESOURCE_KINDS, zeroCost, levelOf, sameLevel } from './economy-common';
import { walkable, openDestination } from './navigation';
import { TERRAIN } from './maps';
import type { Cost, Entity, GameState, ResourceNode, Side, Vec } from './types';
import type { EconomyCommand, EconomyHooks, EconomyState, EconomyView, SettlementSpecialization } from './economy-types';
import { applyCargoCommand, cancelCargoTask, economicDeath, marketPrices, tickCargo } from './economy-cargo';
export { ECONOMY_BUILDINGS, ECONOMY_CARAVAN, ECONOMY_RULES } from './economy-definitions';
export { economicState, ensureEconomy } from './economy-common';
const own=(s:GameState,side:Side,id:number)=>s.entities.find(e=>e.id===id&&e.side===side&&e.hp>0&&!e.illusion);
const econDef=(e:Entity)=>(e as Entity & {definitionId?:string}).definitionId;
function markDefinition(e:Entity,id:string):void{(e as Entity & {definitionId?:string}).definitionId=id;}
function terrainFor(s:GameState,p:Vec){const world=(s as GameState&{world?:{levels:{terrain:GameState['terrain']}[]}}).world;const terrain=levelOf(p)===0?s.terrain:world?.levels[levelOf(p)]?.terrain;return TERRAIN[terrain?.[Math.floor(p.y)*s.width+Math.floor(p.x)]??'rock'];}
const canWalk=(s:GameState,p:Vec)=>(walkable as (s:GameState,x:number,y:number,level?:number)=>boolean)(s,p.x,p.y,levelOf(p));
export function economyBuildingDefinition(s:GameState,e:Entity){const entry=economicState(s)?.structures.find(item=>item.entityId===e.id);return entry?ECONOMY_BUILDINGS[entry.kind]:undefined;}
export function economyUnitDefinition(s:GameState,e:Entity){return economicState(s)?.caravans.includes(e.id)||econDef(e)==='economy:caravan'?ECONOMY_CARAVAN:undefined;}
export function recordEconomyPaid(s:GameState,e:Entity,stock:Cost):void{
 if(e.illusion||e.raised)return;const economy=ensureEconomy(s),record=economy.paidCosts.find(item=>item.entityId===e.id);
 if(record)record.stock={...stock};else economy.paidCosts.push({entityId:e.id,stock:{...stock}});
}
export function initializeEconomySites(s:GameState,sites?:Array<Vec & {id?:number}>):void {
 const economy=ensureEconomy(s);if(economy.markets.length)return;
 const locations=sites?.length?sites:[{x:s.width/2-6,y:s.height/2},{x:s.width/2+6,y:s.height/2}];
 for(const site of locations.slice(0,16)){
  const position={x:site.x,y:site.y,level:levelOf(site)},point=openDestination(s,position,position);if(!point)continue;
  const villageId=site.id??s.nextId++;economy.villages.push({id:villageId,...point,rewardPool:{...ECONOMY_RULES.contract.villagePool}});
  economy.markets.push({id:s.nextId++,...point,stock:{wood:ECONOMY_RULES.market.stock,ore:ECONOMY_RULES.market.stock,crystal:ECONOMY_RULES.market.stock},demand:zeroCost(),recoverAt:s.time});
  for(const kind of RESOURCE_KINDS)economy.contracts.push({id:s.nextId++,villageId,...point,side:null,kind,amount:ECONOMY_RULES.contract.amount,delivered:0,deadline:s.time+ECONOMY_RULES.contract.deadlineSeconds,reward:{...ECONOMY_RULES.contract.reward},status:'open'});
 }
}
function freeGrove(s:GameState,side:Side,p:Vec,hooks:EconomyHooks):boolean {
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<.8||p.y<.8||p.x>s.width-.8||p.y>s.height-.8||!hooks.visible(s,side,p))return false;
 if(!terrainFor(s,p).buildable||!canWalk(s,p))return false;
 return !ensureEconomy(s).groves.some(g=>!g.burned&&distance(g,p)<1.6)&&!s.entities.some(e=>e.hp>0&&e.kind==='building'&&distance(e,p)<hooks.radius(s,e)+1.1);
}
function chooseWork(s:GameState,side:Side,ids:number[],economy:EconomyState):Entity[]{return s.entities.filter(e=>ids.includes(e.id)&&e.side===side&&e.hp>0&&e.kind==='unit'&&e.role==='worker'&&!e.illusion&&!economy.caravans.includes(e.id));}
function buildEconomic(s:GameState,side:Side,c:Extract<EconomyCommand,{type:'buildEconomy'}>,hooks:EconomyHooks):boolean {
 const economy=ensureEconomy(s),workers=chooseWork(s,side,c.ids,economy);if(!workers.length||economy.structures.length>=1024)return false;
 let p:Vec,resource:ResourceNode|undefined;
 const level=c.kind==='warehouse'?c.level??levelOf(workers[0]):levelOf(s.resources.find(r=>r.id===c.target)??workers[0]);if(workers.some(w=>levelOf(w)!==level))return false;
 if(c.kind==='warehouse')p={x:c.x,y:c.y,level};
 else {
  resource=s.resources.find(r=>r.id===c.target&&r.kind===(c.kind==='extractor'?'crystal':'ore')&&hooks.visible(s,side,r));
  if(!resource||c.kind==='deep-mine'&&(resource.amount>1e-8||resource.maxAmount<=0||economy.deepSites.includes(resource.id))||economy.structures.some(item=>item.kind===c.kind&&item.resourceId===resource!.id))return false;
  const candidates:Vec[]=[];for(const r of [3.2,4,5])for(let i=0;i<16;i++){const [dx,dy]=DIRECTIONS_32[i*2],candidate={x:Math.floor(resource.x+dx*r)+.5,y:Math.floor(resource.y+dy*r)+.5,level};if(hooks.canPlace(s,side,candidate.x,candidate.y,level))candidates.push(candidate);}
  const candidate=candidates.sort((a,b)=>distance(workers[0],a)-distance(workers[0],b))[0];if(!candidate)return false;p=candidate;
 }
 if(!hooks.canPlace(s,side,p.x,p.y,level))return false;
 const def=ECONOMY_BUILDINGS[c.kind],shoves:{entity:Entity;point:Vec}[]=[];
 for(const unit of s.entities.filter(e=>e.hp>0&&e.kind==='unit'&&sameLevel(e,p)&&Math.abs(e.x-p.x)<def.size/2+.35&&Math.abs(e.y-p.y)<def.size/2+.35)){
  let destination:Vec|undefined;
  for(let ring=def.size/2+1;ring<=def.size/2+5&&!destination;ring+=.5)for(let i=0;i<32;i++){const [dx,dy]=DIRECTIONS_32[i],point={x:p.x+dx*ring,y:p.y+dy*ring,level};if((Math.abs(point.x-p.x)>=def.size/2+.3||Math.abs(point.y-p.y)>=def.size/2+.3)&&canWalk(s,point)){destination=point;break;}}
  if(!destination)return false;shoves.push({entity:unit,point:destination});
 }
 if(!payCost(s.players[side],def.cost))return false;
 const entity=hooks.spawn(s,side,'building','depot',p.x,p.y,0);entity.level=level;
 for(const shove of shoves){shove.entity.x=shove.point.x;shove.entity.y=shove.point.y;hooks.invalidateNavigation(s,shove.entity);}
 markDefinition(entity,def.id);entity.maxHp=def.hp;entity.hp=def.hp*.1;
 economy.structures.push({entityId:entity.id,kind:c.kind,...(resource?{resourceId:resource.id}:{}),stock:zeroCost(),capacity:c.kind==='warehouse'?ECONOMY_RULES.warehouse.capacity:0,overcharge:false,nextIncident:s.time+ECONOMY_RULES.extractor.incidentSeconds});
 if(c.kind==='deep-mine')economy.deepSites.push(resource!.id);
 recordEconomyPaid(s,entity,def.cost);for(const worker of workers){cancelEconomyTask(s,worker.id);hooks.assign(s,worker,{type:'build',target:entity.id});}economyMessage(s,entity,`${def.name} construction started.`);return true;
}
export function applyEconomyCommand(s:GameState,side:Side,c:EconomyCommand,hooks:EconomyHooks):boolean {
 if(!s.players[side]||s.eliminated[side]||s.winner!==null||s.draw)return false;const economy=ensureEconomy(s);
 if(c.type==='plantGrove'){
  const worker=chooseWork(s,side,c.ids,economy)[0],point={x:c.x,y:c.y,level:c.level??(worker?levelOf(worker):0)},retainedGroves=economy.groves.filter(g=>!g.burned||economy.tasks.some(task=>task.targetId===g.id));if(!worker||levelOf(worker)!==point.level||retainedGroves.length>=1600||economy.groves.filter(g=>g.side===side&&!g.burned).length>=ECONOMY_RULES.grove.limit||s.resources.length+economy.groves.filter(g=>!g.resourceId&&!g.burned).length>=8192||!freeGrove(s,side,point,hooks)||!payCost(s.players[side],ECONOMY_RULES.grove.cost))return false;
  const id=s.nextId++;economy.groves=retainedGroves;economy.groves.push({id,side,...point,plantedAt:-1,maturesAt:-1,burned:false});cancelEconomyTask(s,worker.id);hooks.assign(s,worker,{type:'idle'});economy.tasks.push({entityId:worker.id,kind:'plant',targetId:id,progress:0});economyMessage(s,worker,'Worker assigned to plant a grove.',id);return true;
 }
 if(c.type==='buildEconomy')return buildEconomic(s,side,c,hooks);
 if(c.type==='setOvercharge'){
  const entity=own(s,side,c.id),extractor=economy.structures.find(item=>item.entityId===c.id&&item.kind==='extractor');if(!entity||entity.progress<1||!extractor||extractor.overcharge===c.enabled)return false;extractor.overcharge=c.enabled;economyMessage(s,entity,c.enabled?'Extractor overcharged: increased harvest and damage risk.':'Extractor returned to normal output.');return true;
 }
 if(c.type==='trainCaravan'){
  const producer=own(s,side,c.id),reserved=s.entities.filter(e=>e.side===side&&e.hp>0).reduce((n,e)=>n+e.queue.length,0)+economy.recruits.filter(r=>r.side===side).length;
  if(!producer||producer.kind!=='building'||producer.role!=='hq'||producer.progress<1||economy.recruits.filter(r=>r.producerId===c.id).length>=3||s.players[side].population+reserved>=s.players[side].cap||!payCost(s.players[side],ECONOMY_RULES.caravan.cost))return false;
  const last=economy.recruits.filter(r=>r.producerId===c.id).at(-1)?.readyAt??s.time;economy.recruits.push({producerId:c.id,side,readyAt:Math.max(s.time,last)+ECONOMY_RULES.caravan.trainSeconds});economyMessage(s,producer,'Caravan recruitment started.');return true;
 }
 if(c.type==='setWarehouse'){
  const workers=chooseWork(s,side,c.ids,economy),target=c.target===null?undefined:own(s,side,c.target),warehouse=economy.structures.find(item=>item.entityId===c.target&&item.kind==='warehouse');
  if(!workers.length||c.target!==null&&(!target||target.progress<1||!warehouse||workers.some(worker=>!sameLevel(worker,target))))return false;
  for(const worker of workers){economy.workerWarehouses=economy.workerWarehouses.filter(item=>item.entityId!==worker.id);if(c.target!==null)economy.workerWarehouses.push({entityId:worker.id,warehouseId:c.target});}return true;
 }
 if(c.type==='specializeSettlement'){
  const hq=own(s,side,c.id);if(!hq||hq.role!=='hq'||hq.kind!=='building'||hq.progress<1||distance(hq,s.starts[side])<8||economy.specializations.some(item=>item.entityId===c.id)||!payCost(s.players[side],ECONOMY_RULES.specialization.cost))return false;
  economy.specializations.push({entityId:c.id,kind:c.kind});economyMessage(s,hq,`${c.kind} specialization established within ${ECONOMY_RULES.specialization.radius} tiles.`);return true;
 }
 return applyCargoCommand(s,side,c,economy,hooks)??false;
}
/** A new ordinary order cancels the route/channel while keeping any physical cargo. */
export function cancelEconomyTask(s:GameState,id:number):void{
 const economy=economicState(s);if(!economy)return;const actor=s.entities.find(e=>e.id===id);
 if(actor&&economy.tasks.some(task=>task.entityId===id))cancelCargoTask(actor,economy);
 else {for(const task of economy.tasks)if(task.entityId===id&&task.kind==='plant'){const grove=economy.groves.find(g=>g.id===task.targetId&&g.plantedAt<0);if(grove)grove.burned=true;}economy.tasks=economy.tasks.filter(task=>task.entityId!==id);}
 economy.workerWarehouses=economy.workerWarehouses.filter(item=>item.entityId!==id||!!actor&&s.entities.some(w=>w.id===item.warehouseId&&sameLevel(actor,w)));
}
export function economyEntityBusy(s:GameState,e:Entity):boolean{return !!economicState(s)?.tasks.some(task=>task.entityId===e.id);}
export function tickEconomy(s:GameState,dt:number,hooks:EconomyHooks):void {
 const economy=economicState(s);if(!economy)return;
 for(const task of [...economy.tasks])if(task.kind==='plant'){
  const worker=s.entities.find(e=>e.id===task.entityId&&e.hp>0),grove=economy.groves.find(g=>g.id===task.targetId);
  if(!worker||!grove||grove.burned){economy.tasks=economy.tasks.filter(item=>item!==task);continue;}
  if(!hooks.move(s,worker,grove,dt,1.1))continue;worker.animation='attack';task.progress+=dt/ECONOMY_RULES.grove.plantSeconds;
  if(task.progress>=1){grove.plantedAt=s.time;grove.maturesAt=s.time+ECONOMY_RULES.grove.growthSeconds;economy.tasks=economy.tasks.filter(item=>item!==task);hooks.assign(s,worker,{type:'idle'});economyMessage(s,worker,'Sapling planted. It becomes harvestable after one minute.',grove.id);}
 }
 for(const grove of economy.groves)if(!grove.burned&&!grove.resourceId&&grove.plantedAt>=0&&s.time>=grove.maturesAt){
  if(!terrainFor(s,grove).buildable||s.entities.some(e=>e.hp>0&&e.kind==='building'&&distance(e,grove)<hooks.radius(s,e)+1))continue;
  const resource={id:s.nextId++,x:grove.x,y:grove.y,level:levelOf(grove),kind:'wood' as const,amount:ECONOMY_RULES.grove.wood,maxAmount:ECONOMY_RULES.grove.wood};s.resources.push(resource);grove.resourceId=resource.id;s.events.push({type:'build',x:grove.x,y:grove.y,level:levelOf(grove),side:grove.side,text:'A cultivated grove is ready to harvest.'});
 }
 for(const structure of economy.structures){
  const entity=s.entities.find(e=>e.id===structure.entityId&&e.hp>0);if(!entity)continue;
  if(entity.progress<1)continue;
  if(structure.kind==='deep-mine'&&structure.capacity===0){const site=s.resources.find(r=>r.id===structure.resourceId);if(site){const yieldAmount=Math.min(ECONOMY_RULES.deepMine.yield,Math.max(1,site.maxAmount*.5));site.amount=yieldAmount;site.maxAmount=yieldAmount;structure.capacity=yieldAmount;economyMessage(s,entity,`Deep mine opened a finite reserve of ${Math.floor(yieldAmount)} ore.`,site.id);}}
  if(structure.kind==='extractor'&&s.time+1e-9>=structure.nextIncident){
   const cycle=Math.floor(structure.nextIncident/ECONOMY_RULES.extractor.incidentSeconds);let hash=(s.seed^Math.imul(entity.id,2654435761)^Math.imul(cycle,2246822519))>>>0;hash^=hash>>>16;hash=Math.imul(hash,2246822519)>>>0;const roll=(hash>>>0)/4294967296;
   structure.nextIncident+=ECONOMY_RULES.extractor.incidentSeconds;
   if(structure.overcharge&&roll<ECONOMY_RULES.extractor.incidentChance){const amount=Math.min(entity.hp,ECONOMY_RULES.extractor.incidentDamage);entity.hp-=amount;entity.lastDamagedAt=s.time;s.events.push({type:'attack',x:entity.x,y:entity.y,level:levelOf(entity),side:entity.side,source:entity.id,target:entity.id,amount,text:'Extractor overcharge incident'});if(entity.hp<=0){entity.animation='death';entity.animTime=0;economicDeath(s,entity,economy,hooks);s.events.push({type:'death',x:entity.x,y:entity.y,level:levelOf(entity),side:entity.side,source:entity.id,text:'Extractor destroyed by overcharge.'});}else economyMessage(s,entity,`Overcharge incident caused ${amount} damage. Workers can repair the extractor.`);}
  }
 }
 for(const recruit of [...economy.recruits]){
  const producer=s.entities.find(e=>e.id===recruit.producerId&&e.hp>0&&e.progress===1);
  if(!producer){for(const kind of RESOURCE_KINDS)s.players[recruit.side][kind]+=ECONOMY_RULES.caravan.cost[kind];economy.recruits=economy.recruits.filter(item=>item!==recruit);continue;}
  if(s.time<recruit.readyAt||s.players[recruit.side].population>=s.players[recruit.side].cap)continue;
  const point=openDestination(s,{x:producer.x+hooks.radius(s,producer)+1,y:producer.y,level:levelOf(producer)},producer);if(!point)continue;
  const caravan=hooks.spawn(s,recruit.side,'unit','worker',point.x,point.y);caravan.level=levelOf(producer);markDefinition(caravan,ECONOMY_CARAVAN.id);caravan.hp=caravan.maxHp=ECONOMY_CARAVAN.hp;caravan.shield=undefined;caravan.maxShield=undefined;s.players[recruit.side].population++;economy.caravans.push(caravan.id);economy.cargo.push({entityId:caravan.id,stock:zeroCost(),capacity:ECONOMY_RULES.caravan.capacity,origin:'delivery',tradeValue:0});recordEconomyPaid(s,caravan,ECONOMY_RULES.caravan.cost);economy.recruits=economy.recruits.filter(item=>item!==recruit);s.events.push({type:'train',x:caravan.x,y:caravan.y,level:levelOf(caravan),side:caravan.side,source:caravan.id,text:'Trade caravan recruited.'});
 }
 tickCargo(s,dt,economy,hooks);
 const aliveIds=new Set(s.entities.filter(e=>e.hp>0).map(e=>e.id));economy.workerWarehouses=economy.workerWarehouses.filter(item=>aliveIds.has(item.entityId)&&aliveIds.has(item.warehouseId)&&sameLevel(s.entities.find(e=>e.id===item.entityId)!,s.entities.find(e=>e.id===item.warehouseId)!));economy.specializations=economy.specializations.filter(item=>aliveIds.has(item.entityId));
}
export function onEconomyDeath(s:GameState,e:Entity,hooks:EconomyHooks):void{const economy=ensureEconomy(s);economicDeath(s,e,economy,hooks);}
export function burnEconomyAt(s:GameState,x:number,y:number,radius:number,level=0):void{const economy=economicState(s);if(!economy)return;for(const grove of economy.groves)if(distance(grove,{x,y,level})<=radius){grove.burned=true;if(grove.resourceId){const resource=s.resources.find(r=>r.id===grove.resourceId);if(resource)resource.amount=0;}}}
function region(s:GameState,side:Side,p:Vec):SettlementSpecialization|undefined{
 const economy=economicState(s);if(!economy)return;
 const nearest=s.entities.filter(e=>e.side===side&&e.hp>0&&e.role==='hq'&&e.kind==='building'&&e.progress===1&&distance(e,p)<=ECONOMY_RULES.specialization.radius).sort((a,b)=>distance(a,p)-distance(b,p)||a.id-b.id)[0];return nearest?economy.specializations.find(item=>item.entityId===nearest.id)?.kind:undefined;
}
export function economyGatherFactor(s:GameState,e:Entity,node:ResourceNode):number {
 let factor=region(s,e.side,node)==='mining'&&node.kind==='ore'?ECONOMY_RULES.specialization.mining:1;
 if(node.kind==='crystal'){const economy=economicState(s),extractor=economy?.structures.find(item=>item.kind==='extractor'&&item.resourceId===node.id&&s.entities.some(b=>b.id===item.entityId&&b.side===e.side&&b.hp>0&&b.progress===1));if(extractor)factor*=extractor.overcharge?ECONOMY_RULES.extractor.overchargeGather:ECONOMY_RULES.extractor.normalGather;}
 return factor;
}
export function economyProductionFactor(s:GameState,e:Entity):number{return region(s,e.side,e)==='military'?ECONOMY_RULES.specialization.military:1;}
export function economyResearchFactor(s:GameState,e:Entity):number{return region(s,e.side,e)==='research'?ECONOMY_RULES.specialization.research:1;}
export function economyGatherDepot(s:GameState,e:Entity):Entity|undefined{const record=economicState(s)?.workerWarehouses.find(item=>item.entityId===e.id);return record?s.entities.find(b=>b.id===record.warehouseId&&b.side===e.side&&b.hp>0&&b.progress===1&&sameLevel(e,b)):undefined;}
/** Return how much of a worker's raw carried amount was accepted. */
export function depositEconomyGather(s:GameState,e:Entity,depot:Entity,raw:number):number {
 const economy=ensureEconomy(s),warehouse=economy.structures.find(item=>item.entityId===depot.id&&item.kind==='warehouse'),factor=s.incomeFactors[e.side];
 const available=warehouse?Math.max(0,warehouse.capacity-warehouse.stock.wood-warehouse.stock.ore-warehouse.stock.crystal):Infinity;
 const accepted=factor>0?Math.min(raw,available/factor):raw,income=accepted*factor;
 if(warehouse)warehouse.stock[e.carriedKind]+=income;else s.players[e.side][e.carriedKind]+=income;economy.ledgers[e.side].gathered[e.carriedKind]+=income;return accepted;
}
export function observeEconomy(s:GameState,side:Side,hooks:Pick<EconomyHooks,'visible'>):EconomyView {
 const economy=economicState(s)??createEconomyState(s.players.length),visible=(p:Vec)=>hooks.visible(s,side,p),entities=new Map(s.entities.map(e=>[e.id,e]));
 const structures=economy.structures.flatMap(item=>{const e=entities.get(item.entityId);if(!e||e.hp<=0||e.side!==side&&!visible(e))return [];return [{...item,stock:e.side===side?{...item.stock}:zeroCost(),x:e.x,y:e.y,level:levelOf(e),hp:e.hp,maxHp:e.maxHp,progress:e.progress,side:e.side}];});
 const caravans=economy.cargo.flatMap(item=>{const e=entities.get(item.entityId);if(!e||e.hp<=0||!economy.caravans.includes(e.id)||e.side!==side&&!visible(e))return [];const task=e.side===side?economy.tasks.find(task=>task.entityId===e.id):undefined;return [{...item,origin:e.side===side?item.origin:'delivery' as const,stock:e.side===side?{...item.stock}:zeroCost(),sourceId:e.side===side?item.sourceId:undefined,destinationId:e.side===side?item.destinationId:undefined,tradeValue:e.side===side?item.tradeValue:0,contractId:e.side===side?item.contractId:undefined,x:e.x,y:e.y,level:levelOf(e),side:e.side,hp:e.hp,maxHp:e.maxHp,...(task?{task:structuredClone(task)}:{})}];});
 return {version:1,recruits:economy.recruits.filter(recruit=>recruit.side===side).map(({producerId,readyAt})=>({producerId,readyAt})),deepSites:economy.deepSites.filter(id=>s.resources.some(r=>r.id===id&&visible(r))),groves:economy.groves.filter(g=>g.side===side||visible(g)).map(g=>({...g})),structures,caravans,salvage:economy.salvage.filter(visible).map(item=>({...item,stock:{...item.stock}})),markets:economy.markets.filter(visible).map(m=>({...m,stock:{...m.stock},demand:{...m.demand},prices:marketPrices(m)})),contracts:economy.contracts.filter(c=>c.side===side||c.side===null&&visible(c)).map(c=>({...c,reward:{...c.reward}})),specializations:economy.specializations.filter(item=>entities.get(item.entityId)?.side===side).map(item=>({...item})),workerWarehouses:economy.workerWarehouses.filter(item=>entities.get(item.entityId)?.side===side).map(item=>({...item})),ledger:structuredClone(economy.ledgers[side])};
}
