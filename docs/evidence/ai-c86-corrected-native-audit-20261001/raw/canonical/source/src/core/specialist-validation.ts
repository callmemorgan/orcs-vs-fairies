import { availableUnits, buildingFor, contentFactions, unitFor } from './content-registry';
import { ARTIFACTS, PROMOTIONS, veteranRank } from './unit-progression';
import type { Entity, GameState, Side, UnitRole } from './types';
import type { ArtifactDefinitionId, EquipmentSlot, PromotionId } from './specialist-types';

const MAX_ID=0x7fffffff, MAX_RECORDS=8192;
const SLOTS:EquipmentSlot[]=['weapon','armor','trinket'];
const PREPARED:Record<string,string>={'incendiary-shell':'incendiary','rooting-shell':'rooting','corpse-shell':'corpse','flood-shell':'flood'};
type RecordValue=Record<string,unknown>;
function bad(path:string,detail:string):never {throw new Error(`Invalid save at ${path}: ${detail}.`);}
function object(value:unknown,path:string,required:string[],optional:string[]=[]):RecordValue {
 if(!value||typeof value!=='object'||Array.isArray(value))bad(path,'expected an object');
 const record=value as RecordValue;
 for(const key of required)if(!Object.hasOwn(record,key))bad(`${path}.${key}`,'missing field');
 for(const key of Object.keys(record))if(!required.includes(key)&&!optional.includes(key))bad(`${path}.${key}`,'unknown field');
 return record;
}
function number(value:unknown,path:string,min=0,max=MAX_ID,integer=false):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))bad(path,`expected ${integer?'an integer':'a finite number'} between ${min} and ${max}`);
 return value;
}
function flag(value:unknown,path:string):boolean {if(typeof value!=='boolean')bad(path,'expected a boolean');return value;}
function choice(value:unknown,path:string,values:readonly string[]):string {if(typeof value!=='string'||!values.includes(value))bad(path,'unknown value');return value;}
function list(value:unknown,path:string,max:number):unknown[] {if(!Array.isArray(value)||value.length>max)bad(path,'invalid array length');return value;}
function position(value:unknown,path:string,s:GameState,extraRequired:string[]=[],extraOptional:string[]=[]):RecordValue {
 const p=object(value,path,['x','y',...extraRequired],['level',...extraOptional]);
 number(p.x,`${path}.x`,0,s.width);number(p.y,`${path}.y`,0,s.height);
 if(p.level!==undefined){const level=number(p.level,`${path}.level`,0,1,true);if(level!==0&&!s.world?.levels[level])bad(`${path}.level`,'world level is absent');}
 return p;
}
function realUnit(e:Entity):boolean {return e.kind==='unit'&&!e.illusion&&!e.raised;}
function equipmentEligible(s:GameState,e:Entity):boolean {return realUnit(e)&&(e.role==='special'||!!unitFor(s,e).tags?.some(tag=>tag==='hero'||tag==='engineer'));}
function unitRole(s:GameState,e:Entity):UnitRole {return unitFor(s,e).role;}

function validateVeteran(s:GameState,e:Entity,path:string):void {
 if(e.veteran===undefined)return;
 const p=`${path}.veteran`,v=object(e.veteran,p,['experience','rank','nextSurvivalAt','lastCombatAt','promotions'],['pendingPromotion']);
 if(!realUnit(e))bad(p,'only real units can earn experience');
 const xp=number(v.experience,`${p}.experience`,0,300),rank=number(v.rank,`${p}.rank`,0,3,true);
 if(rank!==veteranRank(xp))bad(`${p}.rank`,'rank differs from earned experience');
 number(v.nextSurvivalAt,`${p}.nextSurvivalAt`,0,s.time+60);number(v.lastCombatAt,`${p}.lastCombatAt`,0,s.time);
 const promotions=list(v.promotions,`${p}.promotions`,3);
 promotions.forEach((value,i)=>{
  const q=`${p}.promotions[${i}]`,promotion=object(value,q,['rank','id']);
  if(number(promotion.rank,`${q}.rank`,1,3,true)!==i+1||i+1>rank)bad(`${q}.rank`,'promotions must follow earned ranks in order');
  const id=choice(promotion.id,`${q}.id`,Object.keys(PROMOTIONS)) as PromotionId;
  if(!PROMOTIONS[id].roles.includes(unitRole(s,e)))bad(`${q}.id`,'promotion does not apply to this unit role');
 });
 const pending=promotions.length<rank?promotions.length+1:undefined;
 if(v.pendingPromotion!==pending)bad(`${p}.pendingPromotion`,'expected the first unchosen earned rank');
}
function validateBuffs(s:GameState,e:Entity,path:string):void {
 if(e.specialistBuffs===undefined)return;
 if(!realUnit(e))bad(`${path}.specialistBuffs`,'only real units can receive specialist buffs');
 list(e.specialistBuffs,`${path}.specialistBuffs`,64).forEach((value,i)=>{
  const p=`${path}.specialistBuffs[${i}]`,buff=object(value,p,['until'],['damageFactor','speedFactor','armor','rooted','fearedFrom']);
  number(buff.until,`${p}.until`,0,s.time+30);
  if(Object.keys(buff).length===1)bad(p,'a buff requires an effect');
  for(const key of ['damageFactor','speedFactor'])if(buff[key]!==undefined)number(buff[key],`${p}.${key}`,0,4);
  if(buff.armor!==undefined)number(buff.armor,`${p}.armor`,0,100);
  if(buff.rooted!==undefined)flag(buff.rooted,`${p}.rooted`);
  if(buff.fearedFrom!==undefined)position(buff.fearedFrom,`${p}.fearedFrom`,s);
 });
}
function validateSiege(s:GameState,e:Entity,path:string):void {
 if(e.siegeMode===undefined)return;
 const p=`${path}.siegeMode`,mode=object(e.siegeMode,p,['ammo','deployed'],['prepared']);
 if(!realUnit(e)||e.role!=='siege')bad(p,'siege preparation requires a real siege unit');
 const ability=unitFor(s,e).ability??'',ammo=number(mode.ammo,`${p}.ammo`,0,ability==='powered-beam'?8:10,true),deployed=flag(mode.deployed,`${p}.deployed`);
 if(ability==='ammunition-cannon'){
  if(mode.prepared!==undefined)bad(`${p}.prepared`,'cannon uses ammunition rather than prepared shells');
 }else if(ability==='powered-beam'){
  if(deployed||mode.prepared!==undefined)bad(p,'beam has no deployment or prepared shell state');
 }else if(Object.hasOwn(PREPARED,ability)){
  if(ammo!==0||deployed)bad(p,'prepared shells have no ammunition or deployment state');
  if(mode.prepared!==undefined&&mode.prepared!==PREPARED[ability])bad(`${p}.prepared`,'prepared shell differs from the unit ability');
 }else bad(p,'unit has no siege preparation ability');
}
function validateBurning(s:GameState,e:Entity,path:string,entities:Map<number,Entity>):void {
 if(e.burning===undefined)return;
 list(e.burning,`${path}.burning`,64).forEach((value,i)=>{
  const p=`${path}.burning[${i}]`,fire=object(value,p,['source','side','until','nextAt','damage'],['origin']);
  const source=number(fire.source,`${p}.source`,1,s.nextId-1,true),side=number(fire.side,`${p}.side`,0,s.players.length-1,true);
  const actor=entities.get(source);
  if(actor&&actor.side!==side&&!(actor.kind==='unit'&&actor.role==='siege'&&actor.definitionFaction!==undefined))bad(`${p}.side`,'fire side differs from the source entity');
  number(fire.until,`${p}.until`,0,s.time+6);
  number(fire.nextAt,`${p}.nextAt`,0,s.time+1);number(fire.damage,`${p}.damage`,Number.MIN_VALUE,100);
  if(fire.origin!==undefined)position(fire.origin,`${p}.origin`,s);
 });
}
function validateBeacon(s:GameState,e:Entity,path:string):void {
 if(e.beacon===undefined)return;
 const p=`${path}.beacon`,beacon=object(e.beacon,p,['connected','nextAlertAt']);
 if(e.kind!=='building'||!buildingFor(s,e).tags?.includes('beacon'))bad(p,'beacon state requires a signal beacon');
 flag(beacon.connected,`${p}.connected`);number(beacon.nextAlertAt,`${p}.nextAlertAt`,0,s.time+8);
}
function validateArtifacts(s:GameState,state:RecordValue,entities:Map<number,Entity>):Map<number,RecordValue> {
 const records=new Map<number,RecordValue>(),held=new Map<number,number>(),counter=number(state.nextArtifactId,'state.specialists.nextArtifactId',1,MAX_ID,true);
 list(state.artifacts,'state.specialists.artifacts',MAX_RECORDS).forEach((value,i)=>{
  const p=`state.specialists.artifacts[${i}]`,item=object(value,p,['id','definitionId'],['owner','holder','position']),id=number(item.id,`${p}.id`,1,counter-1,true);
  if(records.has(id))bad(`${p}.id`,'duplicate artifact id');records.set(id,item);
  choice(item.definitionId,`${p}.definitionId`,Object.keys(ARTIFACTS));
  if(item.holder!==undefined){
   const holderId=number(item.holder,`${p}.holder`,1,s.nextId-1,true),holder=entities.get(holderId);
   if(!holder||holder.hp<=0||!equipmentEligible(s,holder))bad(`${p}.holder`,'artifact requires a living hero or specialist holder');
   number(item.owner,`${p}.owner`,0,s.players.length-1,true);
   if(item.owner!==holder.side)bad(`${p}.owner`,'artifact owner differs from its holder');
   if(item.position!==undefined)bad(`${p}.position`,'held artifacts cannot also have a ground position');
   held.set(holderId,(held.get(holderId)??0)+1);if(held.get(holderId)!>12)bad(`${p}.holder`,'holder inventory exceeds twelve artifacts');
  }else{
   if(item.owner!==undefined)bad(`${p}.owner`,'ground artifacts cannot have an owner');
   position(item.position,`${p}.position`,s);
  }
 });
 return records;
}
function validateEquipment(s:GameState,e:Entity,path:string,artifacts:Map<number,RecordValue>,equipped:Set<number>):void {
 if(e.equipment===undefined)return;
 const p=`${path}.equipment`,equipment=object(e.equipment,p,[],SLOTS);
 if(e.hp<=0||!equipmentEligible(s,e))bad(p,'equipment requires a living hero or specialist');
 for(const slot of SLOTS)if(equipment[slot]!==undefined){
  const id=number(equipment[slot],`${p}.${slot}`,1,MAX_ID,true),item=artifacts.get(id);
  if(!item||item.holder!==e.id||item.owner!==e.side)bad(`${p}.${slot}`,'equipped artifact must belong to this holder');
  const def=ARTIFACTS[item.definitionId as ArtifactDefinitionId];
  if(def.slot!==slot||!def.roles.includes(unitRole(s,e)))bad(`${p}.${slot}`,'artifact does not match this slot or unit role');
  if(equipped.has(id))bad(`${p}.${slot}`,'artifact is equipped more than once');equipped.add(id);
 }
}
function validateStructures(s:GameState,state:RecordValue,entities:Map<number,Entity>):void {
 const counter=number(state.nextStructureId,'state.specialists.nextStructureId',1,MAX_ID,true),ids=new Set<number>(),tiles=new Set<string>(),barricades=new Set<number>();
 list(state.structures,'state.specialists.structures',MAX_RECORDS).forEach((value,i)=>{
  const p=`state.specialists.structures[${i}]`,record=object(value,p,['id','kind','owner','expires'],['entityId','tiles']),id=number(record.id,`${p}.id`,1,counter-1,true);
  if(ids.has(id))bad(`${p}.id`,'duplicate temporary structure id');ids.add(id);
  const kind=choice(record.kind,`${p}.kind`,['bridge','barricade']),owner=number(record.owner,`${p}.owner`,0,s.players.length-1,true);
  number(record.expires,`${p}.expires`,0,s.time+60);
  if(kind==='barricade'){
   if(record.tiles!==undefined)bad(`${p}.tiles`,'barricades reference an entity rather than terrain tiles');
   const entityId=number(record.entityId,`${p}.entityId`,1,s.nextId-1,true),entity=entities.get(entityId);
   if(!entity||entity.kind!=='building'||entity.side!==owner||!buildingFor(s,entity).tags?.includes('barricade'))bad(`${p}.entityId`,'temporary barricade must reference its owned barricade entity');
   if(barricades.has(entityId))bad(`${p}.entityId`,'barricade entity is referenced more than once');barricades.add(entityId);
  }else{
   if(record.entityId!==undefined)bad(`${p}.entityId`,'bridges reference terrain tiles rather than an entity');
   const points=list(record.tiles,`${p}.tiles`,3);if(points.length!==3)bad(`${p}.tiles`,'temporary bridge requires three tiles');
   let previous:RecordValue|undefined;
   points.forEach((value,j)=>{
    const q=`${p}.tiles[${j}]`,point=position(value,q,s,['previous','placed'],['stamp']);
    if((point.x as number)%1!==.5||(point.y as number)%1!==.5)bad(q,'bridge tiles must use tile centers');
    if(point.stamp!==undefined)number(point.stamp,`${q}.stamp`,0,1e12,true);
    choice(point.previous,`${q}.previous`,['water','shallows','grass','road']);if(point.placed!=='bridge')bad(`${q}.placed`,'temporary bridge must place bridge terrain');
    if(previous&&((point.x as number)!==(previous.x as number)+1||point.y!==previous.y||(point.level??0)!==(previous.level??0)))bad(q,'bridge tiles must be consecutive on the same level');
    const key=`${point.level??0}:${point.x}:${point.y}`;if(tiles.has(key))bad(q,'temporary bridge tiles overlap');tiles.add(key);previous=point;
   });
  }
 });
 for(const e of s.entities)if(e.hp>0&&e.kind==='building'&&buildingFor(s,e).tags?.includes('barricade')&&!barricades.has(e.id))bad('state.specialists.structures','living barricade has no temporary structure record');
}
function validateShots(s:GameState,state:RecordValue):void {
 const counter=state.nextShotId===undefined?1:number(state.nextShotId,'state.specialists.nextShotId',1,MAX_ID,true),ids=new Set<number>();
 if(state.shots===undefined)return;
 list(state.shots,'state.specialists.shots',MAX_RECORDS).forEach((value,i)=>{
  const p=`state.specialists.shots[${i}]`,shot=object(value,p,['id','source','target','impactAt','rawDamage','buildingMultiplier','payload'],['modification']);
  const id=number(shot.id,`${p}.id`,1,counter-1,true);if(ids.has(id))bad(`${p}.id`,'duplicate siege shot id');ids.add(id);
  const source=position(shot.source,`${p}.source`,s,['id','side','definitionId','faction'],['elevation']);
  number(source.id,`${p}.source.id`,1,s.nextId-1,true);number(source.side,`${p}.source.side`,0,s.players.length-1,true);
  choice(source.faction,`${p}.source.faction`,Object.keys(contentFactions(s.content)));
  if(typeof source.definitionId!=='string'||source.definitionId.length>100)bad(`${p}.source.definitionId`,'invalid definition ID');
  let ability:string|undefined;
  try {ability=unitFor(s,{...source,kind:'unit',role:'siege',definitionFaction:source.faction} as unknown as Entity).ability;}
  catch {bad(`${p}.source.definitionId`,'shot source must resolve a siege definition in its original faction');}
  if(source.elevation!==undefined)number(source.elevation,`${p}.source.elevation`,0,3);if(shot.modification!==undefined)choice(shot.modification,`${p}.modification`,['stone','grapeshot','incendiary','reinforced']);
  const target=position(shot.target,`${p}.target`,s);if((target.level??0)!==(source.level??0))bad(`${p}.target.level`,'siege shots cannot cross world levels');number(shot.impactAt,`${p}.impactAt`,0,s.time+30);
  number(shot.rawDamage,`${p}.rawDamage`,0,1e9);number(shot.buildingMultiplier,`${p}.buildingMultiplier`,.1,10);
  const payload=object(shot.payload,`${p}.payload`,['kind','damageFactor','armorPiercing','radius']),kind=choice(payload.kind,`${p}.payload.kind`,['incendiary','rooting','corpse','flood','beam','cannon']);
  const expectedKind=ability==='ammunition-cannon'?'cannon':ability==='powered-beam'?'beam':PREPARED[ability??''];
  if(kind!==expectedKind)bad(`${p}.payload.kind`,'siege payload differs from its source ability');
  const expectedFactor=kind==='cannon'?1.5:kind==='corpse'?1.4:1,expectedRadius=kind==='cannon'||kind==='beam'?0:kind==='corpse'?2.5:2;
  if(payload.damageFactor!==expectedFactor)bad(`${p}.payload.damageFactor`,'siege payload has an invalid damage factor');
  if(payload.armorPiercing!==(kind==='beam'))bad(`${p}.payload.armorPiercing`,'siege payload has an invalid armor-piercing flag');
  if(payload.radius!==expectedRadius)bad(`${p}.payload.radius`,'siege payload has an invalid radius');
 });
}
function validateHeroes(s:GameState):void {
 for(let side=0;side<s.players.length;side++){
  const p=`state.players[${side}].heroRecovery`,player=s.players[side],heroes=availableUnits(s,side as Side).filter(def=>def.tags?.includes('hero')),heroIds=new Set(heroes.map(def=>def.id));
  let active=0;
  for(const e of s.entities)if(e.side===side&&e.hp>0){
   if(realUnit(e)&&unitFor(s,e).tags?.includes('hero'))active++;
   if(e.kind==='building')for(let i=0;i<e.queue.length;i++){const def=unitFor(s,side as Side,e.queue[i],e.queueDefinitionIds?.[i]);if(def.tags?.includes('hero'))active++;}
  }
  if(active>1)bad(`state.players[${side}]`,'a player cannot have multiple living or queued commanders');
  if(player.heroRecovery===undefined)continue;
  const seen=new Set<string>();list(player.heroRecovery,p,heroes.length).forEach((value,i)=>{
   const q=`${p}[${i}]`,recovery=object(value,q,['definitionId','availableAt']),id=choice(recovery.definitionId,`${q}.definitionId`,[...heroIds]);
   if(seen.has(id))bad(`${q}.definitionId`,'duplicate commander recovery');seen.add(id);
   const at=number(recovery.availableAt,`${q}.availableAt`,0,s.time+30);
   if(active&&at>s.time)bad(`${q}.availableAt`,'a recovering commander cannot already be alive or queued');
  });
 }
}
/** Validate specialty fields after the base save schema and definitions have passed. */
export function validateSpecialists(s:GameState):void {
 const entities=new Map(s.entities.map(e=>[e.id,e])),equipped=new Set<number>();let artifacts=new Map<number,RecordValue>();
 if(s.specialists!==undefined){const state=object(s.specialists,'state.specialists',['artifacts','structures','nextArtifactId','nextStructureId'],['shots','nextShotId']);artifacts=validateArtifacts(s,state,entities);validateStructures(s,state,entities);validateShots(s,state);}
 if(s.specialists===undefined&&s.entities.some(e=>e.hp>0&&e.kind==='building'&&buildingFor(s,e).tags?.includes('barricade')))bad('state.specialists','living barricade requires temporary structure records');
 s.entities.forEach((e,i)=>{const p=`state.entities[${i}]`;validateVeteran(s,e,p);validateBuffs(s,e,p);validateSiege(s,e,p);validateBurning(s,e,p,entities);validateBeacon(s,e,p);validateEquipment(s,e,p,artifacts,equipped);});
 validateHeroes(s);
}
