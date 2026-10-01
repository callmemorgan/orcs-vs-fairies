import { playerAge } from './progression';
import { FACTION_STRUCTURE_INFO, factionStructureKind, TROPHY_STANDARD } from './faction-systems-content';
import type { FactionStructureKind } from './faction-systems-content';
import { canObserveTacticalEntity, initializeTactics, isCrewless, tacticalUnitDef } from './tactics';
import type { Corpse, Cost, Entity, GameState, Side, TerrainKind, UnitDef, Vec } from './types';
export { FACTION_STRUCTURE_INFO } from './faction-systems-content';
export type ChantKind='assault'|'bulwark';
export type ArtilleryModification='stone'|'grapeshot'|'incendiary'|'reinforced';
export type FactionCommand=
 | {type:'warChant';ids:number[];chant:ChantKind}
 | {type:'trophyStandard';ids:number[]}
 | {type:'illusionSwap';ids:number[];target:number}
 | {type:'modifyArtillery';ids:number[];modification:ArtilleryModification}
 | {type:'buildFactionStructure';ids:number[];structure:FactionStructureKind;x:number;y:number;level?:number}
 | {type:'tunnelTravel';ids:number[];target:number}
 | {type:'collectCorpses';ids:number[];target:number}
 | {type:'deliverCorpses';ids:number[];target:number}
 | {type:'shapeWater';ids:number[];x:number;y:number;level?:number;terrain:'mud'|'shallows'|'water'};
export interface FactionUnitState {
 trophyKills?:number;chant?:{kind:ChantKind;until:number};swapReadyAt?:number;
 artillery?:ArtilleryModification;tunnel?:{target:number;progress:number};
 corpseCargo?:Corpse[];deliveredCorpses?:Corpse[];corpseOrder?:{type:'collect'|'deliver';target:number;progress:number};
 power?:{connected:boolean;root:number|null};nextDecoyAt?:number;waterReadyAt?:number;
}
export interface FactionTerrainEffect {id:number;side:Side;until:number;tiles:{x:number;y:number;level:number;before:TerrainKind;after:TerrainKind}[]}
export interface FactionSystemState {version:1;fury:number[];terrainEffects:FactionTerrainEffect[]}
export interface FactionSystemHooks {
 canPlace:(side:Side,point:Vec,definitionId:string)=>boolean;
 spawnDefinition:(side:Side,definitionId:string,point:Vec,progress?:number)=>Entity;
 move:(e:Entity,to:Vec,dt:number,reach:number)=>boolean;
 openDestination:(to:Vec,from:Vec)=>Vec|undefined;
 terrainAt:(point:Vec)=>TerrainKind;
 setTerrain:(point:Vec,kind:TerrainKind)=>boolean;
}
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y),sameLevel=(a:Vec,b:Vec)=>(a.level??0)===(b.level??0);
const allied=(s:GameState,a:Side,b:Side)=>s.teams[a]===s.teams[b];
const observed=(s:GameState,side:Side,p:Vec)=>s.visible[side]?.has((p.level??0)*s.width*s.height+Math.floor(p.y)*s.width+Math.floor(p.x))??false;
const real=(e:Entity)=>e.hp>0&&e.kind==='unit'&&!e.illusion&&!isCrewless(e);
export function initializeFactionSystems(s:GameState):FactionSystemState{return s.factionSystems??={version:1,fury:s.players.map(()=>0),terrainEffects:[]};}
function owned(s:GameState,side:Side,ids:readonly number[]):Entity[]{return s.entities.filter(e=>e.side===side&&real(e)&&ids.includes(e.id)).sort((a,b)=>a.id-b.id);}
function affordable(s:GameState,side:Side,cost:Cost):boolean{return (['wood','ore','crystal'] as const).every(kind=>s.players[side][kind]>=cost[kind]);}
function pay(s:GameState,side:Side,cost:Cost):void{for(const kind of ['wood','ore','crystal'] as const)s.players[side][kind]-=cost[kind];}
function note(s:GameState,e:Entity,text:string,target?:number):void{s.events.push({type:'message',x:e.x,y:e.y,side:e.side,source:e.id,text,target});}
function military(e:Entity):boolean{return real(e)&&e.role!=='worker'&&e.role!=='siege';}
export function isFactionCaster(s:GameState,e:Entity,ability:UnitDef['ability']):boolean{return real(e)&&e.role==='special'&&tacticalUnitDef(s,e).ability===ability;}
export function isCorpseWagon(e:Entity):boolean{return e.definitionId==='core:undead-corpse-wagon';}
export function isFactionCommand(c:{type:string}):c is FactionCommand{return ['warChant','trophyStandard','illusionSwap','modifyArtillery','buildFactionStructure','tunnelTravel','collectCorpses','deliverCorpses','shapeWater'].includes(c.type);}
/** Shared reasons for both local UI and authoritative commands; never inspects hidden targets. */
export function factionCommandReason(s:GameState,side:Side,c:FactionCommand):string|null {
 if(!s.players[side]||s.eliminated[side]||s.winner!==null||s.draw)return 'This player cannot issue faction orders.';
 const units=owned(s,side,c.ids);if(!units.length)return 'Select eligible owned troops.';const faction=s.players[side].faction;
 if(c.type==='warChant'){if(faction!=='orcs')return 'War chants require the Ironclad.';if(!units.some(military))return 'Select combat troops for the chant.';return (s.factionSystems?.fury[side]??0)>=25?null:'Need 25 Fury.';}
 if(c.type==='trophyStandard')return faction==='orcs'&&units.some(e=>military(e)&&(e.factionState?.trophyKills??0)>=2)?null:'A victorious Ironclad troop needs two trophies.';
 if(c.type==='illusionSwap'){if(faction!=='fairies')return 'Illusion swapping requires the Wild Court.';const target=s.entities.find(e=>e.id===c.target&&e.side===side&&e.hp>0&&e.illusion);if(!target)return 'Choose an owned living illusion.';if(!units.some(e=>military(e)&&sameLevel(e,target)&&distance(e,target)<=10&&(e.factionState?.swapReadyAt??0)<=s.time))return 'Select a ready combat troop within ten tiles of the illusion.';return affordable(s,side,{wood:0,ore:0,crystal:15})?null:'Need 15 crystal.';}
 if(c.type==='modifyArtillery'){if(faction!=='dwarves')return 'Workshop modifications require Deepforge.';if(!units.some(e=>e.role==='siege'||e.role==='special'&&isFactionCaster(s,e,'entrench')))return 'Select a siege engine or a Siege Cannon.';return affordable(s,side,{wood:25*units.filter(e=>e.role==='siege'||isFactionCaster(s,e,'entrench')).length,ore:20*units.filter(e=>e.role==='siege'||isFactionCaster(s,e,'entrench')).length,crystal:0})?null:'Need 25 wood and 20 ore per artillery unit.';}
 if(c.type==='buildFactionStructure'){const info=FACTION_STRUCTURE_INFO[c.structure];if(!info||faction!==info.faction)return 'That structure belongs to another faction.';if(!units.some(e=>e.role==='worker'&&(e.level??0)===(c.level??0)))return 'Select a worker on the construction level.';if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<1.5||c.y<1.5||c.x>s.width-1.5||c.y>s.height-1.5)return 'Choose an in-bounds construction point.';if(!observed(s,side,c))return 'The construction point must be visible.';return affordable(s,side,info.definition.cost)?null:`Need ${info.definition.cost.wood} wood, ${info.definition.cost.ore} ore and ${info.definition.cost.crystal} crystal.`;}
 if(c.type==='tunnelTravel'){if(faction!=='dwarves')return 'Tunnel travel requires Deepforge.';const target=s.entities.find(e=>e.id===c.target&&e.side===side&&e.hp>0&&e.progress===1&&e.definitionId===FACTION_STRUCTURE_INFO.tunnel.definition.id);if(!target)return 'Choose a completed owned tunnel entrance.';return units.some(e=>!e.raised&&s.entities.some(t=>t.id!==target.id&&t.side===side&&t.hp>0&&t.progress===1&&t.definitionId===target.definitionId&&sameLevel(t,e)&&distance(t,e)<=3))?null:'Troops must stand within three tiles of another completed entrance.';}
 if(c.type==='collectCorpses'){if(faction!=='undead'||!units.some(isCorpseWagon))return 'Select an Ashen Host corpse wagon.';const corpse=s.corpses.find(body=>body.id===c.target&&body.expires>s.time&&observed(s,side,body));if(!corpse)return 'Choose a visible unclaimed body.';return units.some(e=>isCorpseWagon(e)&&sameLevel(e,corpse)&&(e.factionState?.corpseCargo?.length??0)<6)?null:'The wagon is full or on another level.';}
 if(c.type==='deliverCorpses'){if(faction!=='undead'||!units.some(e=>isCorpseWagon(e)&&e.factionState?.corpseCargo?.some(body=>body.expires>s.time)))return 'Select a corpse wagon carrying a fresh body.';const target=s.entities.find(e=>e.id===c.target&&e.side===side&&isFactionCaster(s,e,'raise'));return target&&units.some(e=>isCorpseWagon(e)&&sameLevel(e,target)&&e.factionState?.corpseCargo?.some(body=>body.expires>s.time))?null:'Choose an owned Gravecaller on the wagon level.';}
 if(faction!=='tideborn')return 'Water shaping requires the Tideborn.';if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||!observed(s,side,c))return 'Choose visible ground.';if(!units.some(e=>isFactionCaster(s,e,'surge')&&sameLevel(e,c)&&distance(e,c)<=6&&(e.factionState?.waterReadyAt??0)<=s.time))return 'Select a ready Tidecaller within six tiles.';return affordable(s,side,{wood:0,ore:0,crystal:25})?null:'Need 25 crystal.';
}
export function wagonRecruitmentReason(s:GameState,side:Side,id:number):string|null {
 if(!s.players[side]||s.players[side].faction!=='undead')return 'Corpse wagons require the Ashen Host.';if(s.eliminated[side]||s.winner!==null||s.draw)return 'The match has ended for this player.';const producer=s.entities.find(e=>e.id===id&&e.side===side&&e.hp>0&&e.kind==='building'&&e.role==='barracks'&&e.progress===1);if(!producer)return 'Choose a completed owned barracks.';if(playerAge(s.players[side])<2)return 'Corpse wagons require Town Age.';if(producer.queue.length>=5)return 'The recruitment queue is full.';const reserved=s.entities.filter(e=>e.side===side&&e.hp>0).reduce((n,e)=>n+e.queue.length,0);if(s.players[side].population+reserved>=s.players[side].cap)return 'Build a depot for more supply.';return affordable(s,side,{wood:100,ore:45,crystal:0})?null:'Need 100 wood and 45 ore.';
}
export function factionConcealment(s:GameState,e:Entity):boolean {return real(e)&&e.role!=='worker'&&e.role!=='siege'&&s.entities.some(g=>g.hp>0&&g.progress===1&&g.definitionId===FACTION_STRUCTURE_INFO['enchanted-grove'].definition.id&&allied(s,g.side,e.side)&&sameLevel(g,e)&&distance(g,e)<=4)&&s.time-(e.lastDamagedAt??-100)>2&&e.animation!=='attack';}
export function factionDamageFactor(s:GameState,e:Entity,target?:Entity):number {let factor=1;const f=e.factionState;if(f?.chant?.kind==='assault'&&f.chant.until>s.time)factor*=1.25;if(s.entities.some(b=>b.hp>0&&(!b.expires||b.expires>s.time)&&b.progress===1&&b.definitionId===TROPHY_STANDARD.id&&allied(s,b.side,e.side)&&sameLevel(b,e)&&distance(b,e)<=6))factor*=1.1;if(f?.artillery==='grapeshot'&&target?.kind==='unit')factor*=1.5;if(f?.artillery==='stone'&&target?.kind==='building')factor*=1.25;if(e.kind==='building'&&s.players[e.side].faction==='automata'&&f?.power?.connected&&e.role==='tower')factor*=1.25;return factor;}
export function factionArmorBonus(s:GameState,e:Entity):number{return (e.factionState?.chant?.kind==='bulwark'&&e.factionState.chant.until>s.time?3:0)+(e.factionState?.artillery==='reinforced'?3:0);}
export function factionMovementFactor(e:Entity):number{return e.factionState?.artillery==='reinforced'?.85:1;}
export function factionSplashRadius(e:Entity):number{return e.factionState?.artillery==='grapeshot'?2.5:1.75;}
export function factionCanFire(s:GameState,e:Entity):boolean{return !isCorpseWagon(e)&&!(e.kind==='building'&&e.role==='tower'&&s.players[e.side].faction==='automata'&&!e.factionState?.power?.connected);}

export function issueFactionCommand(s:GameState,side:Side,c:FactionCommand,h:FactionSystemHooks):boolean {
 if(factionCommandReason(s,side,c))return false;const system=initializeFactionSystems(s),units=owned(s,side,c.ids);
 if(c.type==='warChant'){system.fury[side]-=25;for(const e of units.filter(military))(e.factionState??={}).chant={kind:c.chant,until:s.time+12};note(s,units[0],`${c.chant==='assault'?'Assault':'Bulwark'} chant: 25 Fury spent`);return true;}
 if(c.type==='trophyStandard'){const e=units.find(e=>military(e)&&(e.factionState?.trophyKills??0)>=2)!,point=h.openDestination({x:e.x+1,y:e.y,level:e.level},e);if(!point||!h.canPlace(side,point,TROPHY_STANDARD.id))return false;e.factionState!.trophyKills!-=2;const banner=h.spawnDefinition(side,TROPHY_STANDARD.id,point,1);banner.expires=s.time+180;note(s,e,'Trophy standard raised',banner.id);return true;}
 if(c.type==='illusionSwap'){const target=s.entities.find(e=>e.id===c.target)!,e=units.find(e=>military(e)&&sameLevel(e,target)&&distance(e,target)<=10&&(e.factionState?.swapReadyAt??0)<=s.time)!;const from=h.openDestination(e,e),to=h.openDestination(target,target);if(!from||!to||distance(from,e)>.001||distance(to,target)>.001)return false;pay(s,side,{wood:0,ore:0,crystal:15});const p={x:e.x,y:e.y,level:e.level};e.x=target.x;e.y=target.y;e.level=target.level;target.x=p.x;target.y=p.y;target.level=p.level;for(const actor of [e,target]){actor.path=[];actor.order={type:'hold'};delete actor.orderQueue;delete actor.tactics?.formation;}(e.factionState??={}).swapReadyAt=s.time+10;note(s,e,'Position exchanged with an illusion',target.id);return true;}
 if(c.type==='modifyArtillery'){const artillery=units.filter(e=>e.role==='siege'||e.role==='special'&&isFactionCaster(s,e,'entrench'));pay(s,side,{wood:25*artillery.length,ore:20*artillery.length,crystal:0});for(const e of artillery)(e.factionState??={}).artillery=c.modification;note(s,artillery[0],`Workshop fitted ${c.modification}`);return true;}
 if(c.type==='buildFactionStructure'){const info=FACTION_STRUCTURE_INFO[c.structure];if(!h.canPlace(side,c,info.definition.id))return false;pay(s,side,info.definition.cost);const building=h.spawnDefinition(side,info.definition.id,c,0);for(const e of units.filter(e=>e.role==='worker'&&sameLevel(e,c))){e.order={type:'build',target:building.id};e.path=[];delete e.orderQueue;delete e.tactics?.formation;}note(s,units[0],`${info.definition.name} construction ordered`,building.id);return true;}
 if(c.type==='tunnelTravel'){const target=s.entities.find(e=>e.id===c.target)!;let assigned=false;for(const e of units)if(!e.raised&&s.entities.some(t=>t.id!==target.id&&t.side===side&&t.hp>0&&t.progress===1&&t.definitionId===target.definitionId&&sameLevel(t,e)&&distance(t,e)<=3)){(e.factionState??={}).tunnel={target:target.id,progress:0};e.order={type:'hold'};e.path=[];delete e.orderQueue;delete e.tactics?.formation;assigned=true;}return assigned;}
 if(c.type==='collectCorpses'||c.type==='deliverCorpses'){const eligible=units.filter(e=>isCorpseWagon(e)&&(c.type==='collectCorpses'?(e.factionState?.corpseCargo?.length??0)<6:!!e.factionState?.corpseCargo?.some(body=>body.expires>s.time)));for(const e of eligible){(e.factionState??={}).corpseOrder={type:c.type==='collectCorpses'?'collect':'deliver',target:c.target,progress:0};e.order={type:'hold'};e.path=[];delete e.orderQueue;}return eligible.length>0;}
 const casterUnit=units.find(e=>isFactionCaster(s,e,'surge')&&sameLevel(e,c)&&distance(e,c)<=6&&(e.factionState?.waterReadyAt??0)<=s.time)!;const tiles:FactionTerrainEffect['tiles']=[];
 for(let y=Math.max(0,Math.floor(c.y-2));y<=Math.min(s.height-1,Math.floor(c.y+2));y++)for(let x=Math.max(0,Math.floor(c.x-2));x<=Math.min(s.width-1,Math.floor(c.x+2));x++){const p={x:x+.5,y:y+.5,level:c.level??0},before=h.terrainAt(p);if(distance(p,c)<=2&&observed(s,side,p)&&!['rock','bridge','forest'].includes(before)&&!s.entities.some(e=>e.hp>0&&e.kind==='building'&&sameLevel(e,p)&&distance(e,p)<1.7)&&!s.resources.some(r=>r.amount>0&&sameLevel(r,p)&&distance(r,p)<.8)&&!(c.terrain==='water'&&s.entities.some(e=>e.hp>0&&e.kind==='unit'&&sameLevel(e,p)&&distance(e,p)<.8))&&before!==c.terrain)tiles.push({...p,before:system.terrainEffects.flatMap(effect=>effect.tiles).find(tile=>sameLevel(tile,p)&&tile.x===p.x&&tile.y===p.y)?.before??before,after:c.terrain});}
 if(!tiles.length)return false;pay(s,side,{wood:0,ore:0,crystal:25});for(const tile of tiles)h.setTerrain(tile,tile.after);system.terrainEffects.push({id:s.nextId++,side,until:s.time+20,tiles});(casterUnit.factionState??={}).waterReadyAt=s.time+20;note(s,casterUnit,'Water-shaped approach lasts twenty seconds');return true;
}
export function recordFactionDamage(s:GameState,source:Entity|undefined,amount:number):void {if(source&&source.kind==='unit'&&!source.illusion&&s.players[source.side].faction==='orcs')initializeFactionSystems(s).fury[source.side]=Math.min(100,initializeFactionSystems(s).fury[source.side]+Math.max(0,amount)*.12);}
export function recordFactionDeath(s:GameState,victim:Entity):void {
 if(victim.kind!=='unit'||victim.illusion||victim.raised)return;const source=s.entities.find(e=>e.id===victim.lastAttacker);if(source&&source.kind==='unit'&&!source.illusion&&s.players[source.side].faction==='orcs'&&!allied(s,source.side,victim.side))(source.factionState??={}).trophyKills=(source.factionState?.trophyKills??0)+1;
}
export function takeDeliveredCorpses(s:GameState,caster:Entity,count:number):Corpse[]{const cargo=caster.factionState?.deliveredCorpses;if(!cargo)return [];const fresh=cargo.filter(body=>body.expires>s.time);caster.factionState!.deliveredCorpses=fresh.slice(count);return fresh.slice(0,count);}
export function stepFactionActor(s:GameState,e:Entity,dt:number,h:FactionSystemHooks):boolean {
 const f=e.factionState;if(!f)return false;if(f.chant&&f.chant.until<=s.time)delete f.chant;if(f.corpseCargo)f.corpseCargo=f.corpseCargo.filter(body=>body.expires>s.time);if(f.deliveredCorpses)f.deliveredCorpses=f.deliveredCorpses.filter(body=>body.expires>s.time);
 if(f.tunnel){const destination=s.entities.find(t=>t.id===f.tunnel!.target&&t.hp>0&&t.side===e.side&&t.progress===1&&t.definitionId===FACTION_STRUCTURE_INFO.tunnel.definition.id),entrance=s.entities.find(t=>t.id!==destination?.id&&t.hp>0&&t.side===e.side&&t.progress===1&&t.definitionId===FACTION_STRUCTURE_INFO.tunnel.definition.id&&sameLevel(t,e)&&distance(t,e)<=3);if(!destination||!entrance||s.time-(e.lastDamagedAt??-100)<.2){delete f.tunnel;return false;}f.tunnel.progress=Math.min(1,f.tunnel.progress+dt/3);if(f.tunnel.progress>=1){const point=h.openDestination({x:destination.x+1.8,y:destination.y,level:destination.level},destination);if(point){e.x=point.x;e.y=point.y;e.level=point.level;e.path=[];e.order={type:'hold'};delete f.tunnel;note(s,e,'Squad arrived through the tunnel',destination.id);}}return true;}
 if(f.corpseOrder){const order=f.corpseOrder,target=order.type==='collect'?s.corpses.find(body=>body.id===order.target&&body.expires>s.time&&observed(s,e.side,body)):s.entities.find(t=>t.id===order.target&&t.side===e.side&&isFactionCaster(s,t,'raise'));if(!target||!sameLevel(e,target)){delete f.corpseOrder;return false;}if(distance(e,target)>1.4){h.move(e,target,dt,1.3);order.progress=0;return true;}order.progress=Math.min(1,order.progress+dt);if(order.progress<1)return true;
  if(order.type==='collect'){if((f.corpseCargo?.length??0)<6){const index=s.corpses.findIndex(body=>body.id===target.id);if(index>=0)(f.corpseCargo??=[]).push(s.corpses.splice(index,1)[0]);note(s,e,'Body loaded without extending its decay deadline',target.id);}}
  else {const recipient=target as Entity,cargo=f.corpseCargo??=[];recipient.factionState??={};const cache=recipient.factionState.deliveredCorpses??=[];const delivered=cargo.splice(0,Math.max(0,12-cache.length));cache.push(...delivered.map(body=>({...body,x:recipient.x,y:recipient.y,level:recipient.level}))); note(s,e,`Delivered ${delivered.length} bodies to a Gravecaller`,recipient.id);}delete f.corpseOrder;return true;
 }
 return false;
}
export function refreshPowerNetworks(s:GameState,dt:number):void {
 for(const side of s.players.map((_,i)=>i as Side)){if(s.players[side].faction!=='automata')continue;const nodes=s.entities.filter(e=>e.side===side&&e.kind==='building'&&e.hp>0&&e.progress===1).sort((a,b)=>a.id-b.id),roots=new Map<number,number|null>(),visited=new Set<number>();
  for(const first of nodes){if(visited.has(first.id))continue;const component=[first];visited.add(first.id);for(let i=0;i<component.length;i++)for(const e of nodes)if(!visited.has(e.id)&&sameLevel(e,component[i])&&distance(e,component[i])<=8){visited.add(e.id);component.push(e);}const root=component.filter(e=>e.role==='hq').sort((a,b)=>a.id-b.id)[0]?.id??null;for(const e of component)roots.set(e.id,root);}
  for(const node of nodes){const root=roots.get(node.id)??null,power=(node.factionState??={}).power={connected:root!==null,root};node.maxShield??=80;node.shield??=80;if(power.connected&&s.time-(node.lastDamagedAt??-100)>6)node.shield=Math.min(node.maxShield,node.shield+dt*2);}
 }
}
export function absorbFactionShield(s:GameState,target:Entity,amount:number):number {
 if(target.kind!=='building'||!target.factionState?.power?.connected)return 0;const nodes=s.entities.filter(e=>e.side===target.side&&e.hp>0&&e.kind==='building'&&e.factionState?.power?.connected&&e.factionState.power.root===target.factionState!.power!.root&&sameLevel(e,target)).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id);let remaining=amount;
 for(const node of nodes){const absorbed=Math.min(node.shield??0,remaining);if(absorbed){node.shield!-=absorbed;remaining-=absorbed;node.lastDamagedAt=s.time;}if(remaining<=0)break;}return amount-remaining;
}
export function stepFactionSystems(s:GameState,dt:number,h:FactionSystemHooks):void {
 const system=initializeFactionSystems(s),expired=system.terrainEffects.filter(effect=>effect.until<=s.time);for(const effect of expired)for(const tile of effect.tiles)if(h.terrainAt(tile)===tile.after&&!system.terrainEffects.some(other=>other!==effect&&other.until>s.time&&other.tiles.some(p=>sameLevel(p,tile)&&p.x===tile.x&&p.y===tile.y)))h.setTerrain(tile,tile.before);system.terrainEffects=system.terrainEffects.filter(effect=>effect.until>s.time);
 refreshPowerNetworks(s,dt);
 for(const e of s.entities){if(e.hp<=0||e.kind!=='unit'||e.illusion||isCrewless(e))continue;const standard=s.entities.some(b=>b.hp>0&&(!b.expires||b.expires>s.time)&&b.progress===1&&b.definitionId===TROPHY_STANDARD.id&&allied(s,b.side,e.side)&&sameLevel(b,e)&&distance(b,e)<=6);if(standard)initializeTactics(s,e).morale=Math.min(100,initializeTactics(s,e).morale+dt*3);
  if(e.raised&&s.entities.some(b=>b.hp>0&&b.progress===1&&b.definitionId===FACTION_STRUCTURE_INFO.necropolis.definition.id&&allied(s,b.side,e.side)&&sameLevel(b,e)&&distance(b,e)<=6)){e.expires+=dt;e.hp=Math.min(e.maxHp,e.hp+dt*2);}
 }
 for(const grove of s.entities.filter(e=>e.hp>0&&e.progress===1&&e.definitionId===FACTION_STRUCTURE_INFO['enchanted-grove'].definition.id)){
  const f=grove.factionState??={};if(s.time<(f.nextDecoyAt??0))continue;const scout=s.entities.filter(e=>real(e)&&e.role==='cavalry'&&!allied(s,e.side,grove.side)&&sameLevel(e,grove)&&canObserveTacticalEntity(s,grove.side,e)&&distance(e,grove)<8).sort((a,b)=>distance(a,grove)-distance(b,grove)||a.id-b.id)[0];if(!scout)continue;const template=s.entities.find(e=>real(e)&&military(e)&&e.side===grove.side&&sameLevel(e,grove)&&distance(e,grove)<=4);if(!template)continue;
  const point=h.openDestination({x:grove.x+Math.sign(scout.x-grove.x)*2,y:grove.y+Math.sign(scout.y-grove.y)*2,level:grove.level},grove);if(!point)continue;const clone={...structuredClone(template),id:s.nextId++,x:point.x,y:point.y,level:point.level,hp:template.maxHp*.4,maxHp:template.maxHp*.4,illusion:true,expires:s.time+15,cooldown:100,order:{type:'move' as const,x:scout.x,y:scout.y},path:[],tactics:undefined,factionState:undefined};delete clone.orderQueue;s.entities.push(clone);f.nextDecoyAt=s.time+20;note(s,grove,'Grove sent a decoy toward an observed scout',clone.id);
 }
}
