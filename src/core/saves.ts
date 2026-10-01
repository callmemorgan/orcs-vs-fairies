import { normalizeMatchRules, createDraft, draftPlayers, validateDraftState, validateObjectiveState, validateSavedRules, validateModeRoster } from './match-rules';
import { emptyObjectives } from './objectives';
import { validateEconomyState } from './economy-validation';
import { normalizeAiConfig } from './ai-policy';
import { validateScenarioBinding } from './scenarios';
import { validateSpecialists } from './specialist-validation';
import { availableBuildings, availableUnits, buildingFor, contentFactions, decodeContentBundle, entityDefinition, upgradesFor } from './content-registry';
import type { Entity, Side, UnitDef } from './types';
import { MAP_VERSION, TERRAIN } from './maps';
import { validateWorldState } from './world-validation';
import { validateTeamAiState } from './team-ai';
import { captureRuntime, MAX_ORDER_QUEUE, restoreRuntime } from './simulation';
import type { RuntimeSnapshot } from './simulation';
import type { GameState, TeamId } from './types';

export const SAVE_VERSION=3;
export const MAX_SAVE_BYTES=16*1024*1024;
type SerializedState=Omit<GameState,'explored'|'visible'> & {explored:number[][];visible:number[][]};
export interface SaveEnvelope {format:'orcs-vs-fairies-save';version:typeof SAVE_VERSION;state:SerializedState;runtime:RuntimeSnapshot}
const MAX_ID=0x7fffffff,MAX_VALUE=1e12,MAX_PLAYERS=8,MAX_ENTITIES=8192,MAX_RESOURCES=8192;
const STATE_FIELDS=['controllers','mapSize','mapVersion','terrain','starts','draw','tick','corpses','time','seed','width','height','entities','resources','players','winner','events','explored','visible','nextId'];
const TEAM_FIELDS=['teams','incomeFactors','populationLimits','sharedVision','eliminated','winningTeam'];
const UNIT_ROLES=['worker','melee','ranged','special','cavalry','spear','siege'];
const BUILDING_ROLES=['hq','depot','barracks','tower','wall','gate'];
const RESOURCE_KINDS=['wood','ore','crystal'];
type RecordValue=Record<string,unknown>;
function bad(path:string,detail:string):never {throw new Error(`Invalid save at ${path}: ${detail}.`);}
function object(value:unknown,path:string,required:string[],optional:string[]=[]):RecordValue {
 if(!value||typeof value!=='object'||Array.isArray(value))bad(path,'expected an object');
 const record=value as RecordValue;
 for(const key of required)if(!Object.hasOwn(record,key))bad(`${path}.${key}`,'missing field');
 for(const key of Object.keys(record))if(!required.includes(key)&&!optional.includes(key))bad(`${path}.${key}`,'unknown field');
 return record;
}
function number(value:unknown,path:string,min=0,max=MAX_VALUE,integer=false):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))bad(path,`expected ${integer?'an integer':'a finite number'} between ${min} and ${max}`);
 return value;
}
function flag(value:unknown,path:string):boolean {if(typeof value!=='boolean')bad(path,'expected a boolean');return value;}
function choice(value:unknown,path:string,choices:readonly string[]):string {if(typeof value!=='string'||!choices.includes(value))bad(path,'unknown value');return value;}
function list(value:unknown,path:string,max:number,length?:number):unknown[] {if(!Array.isArray(value)||value.length>max||(length!==undefined&&value.length!==length))bad(path,'invalid array length');return value;}
function optionalNumber(record:RecordValue,key:string,path:string,min=0,max=MAX_VALUE,integer=false):void {if(record[key]!==undefined)number(record[key],`${path}.${key}`,min,max,integer);}
function optionalFlag(record:RecordValue,key:string,path:string):void {if(record[key]!==undefined)flag(record[key],`${path}.${key}`);}
interface Context {state:GameState;levels:number;width:number;height:number;cells:number;time:number;nextId:number;playerCount:number;maxEntities:number;entityIds:Set<number>;entities:Map<number,RecordValue>;resourceIds:Set<number>;eventCount:number}
function id(value:unknown,path:string,c:Context):number {return number(value,path,1,c.nextId-1,true);}
function point(value:unknown,path:string,c:Context):void {const p=object(value,path,['x','y'],['level']);number(p.x,`${path}.x`,0,c.width);number(p.y,`${path}.y`,0,c.height);optionalNumber(p,'level',path,0,c.levels-1,true);}
function coordinates(value:RecordValue,path:string,c:Context):void {number(value.x,`${path}.x`,0,c.width);number(value.y,`${path}.y`,0,c.height);optionalNumber(value,'level',path,0,c.levels-1,true);}
function order(value:unknown,path:string,c:Context):void {
 const o=object(value,path,['type'],['x','y','target','transition','level']);
 choice(o.type,`${path}.type`,['idle','hold','move','attackMove','attack','gather','build','traverse','worldAttack','repairBridge','captureSite','supportVillage','recruitVillage']);
 if(o.type==='move'||o.type==='attackMove'){object(value,path,['type','x','y'],['level']);coordinates(o,path,c);}
 else if(['attack','gather','build','worldAttack','repairBridge','captureSite','supportVillage','recruitVillage'].includes(o.type as string)){object(value,path,['type','target']);id(o.target,`${path}.target`,c);}
 else if(o.type==='traverse'){object(value,path,['type','transition']);number(o.transition,`${path}.transition`,1,0x7fffffff,true);}
 else object(value,path,['type']);
}
function uniqueIds(values:unknown[],path:string,max:number):Set<number> {
 const result=new Set<number>();values.forEach((v,i)=>{const n=number(v,`${path}[${i}]`,0,max,true);if(result.has(n))bad(path,'duplicate value');result.add(n);});return result;
}
function fog(value:unknown,path:string,c:Context):Set<number>[] {
 return list(value,path,c.playerCount,c.playerCount).map((v,i)=>uniqueIds(list(v,`${path}[${i}]`,c.cells),`${path}[${i}]`,c.cells-1));
}
function validateEntity(value:unknown,path:string,c:Context):void {
 const e=object(value,path,['id','side','kind','role','x','y','hp','maxHp','order','cooldown','progress','queue','trainProgress','researchProgress','facing','animation','animTime','momentum','illusion','expires','carried','carriedKind','path'],['tactics','factionState','level','definitionId','definitionFaction','queueDefinitionIds','queuePaidCosts','orderQueue','research','researchPaidCost','rally','gateOpen','lastAttacker','abilityReadyAt','entrenchedAt','raised','shield','maxShield','lastDamagedAt','surgeUntil','veteran','equipment','specialistBuffs','siegeMode','burning','beacon']);
 const entityId=id(e.id,`${path}.id`,c);if(c.entityIds.has(entityId))bad(`${path}.id`,'duplicate entity or resource id');c.entityIds.add(entityId);c.entities.set(entityId,e);
 number(e.side,`${path}.side`,0,c.playerCount-1,true);choice(e.kind,`${path}.kind`,['unit','building']);choice(e.role,`${path}.role`,e.kind==='unit'?UNIT_ROLES:BUILDING_ROLES);coordinates(e,path,c);
 const maxHp=number(e.maxHp,`${path}.maxHp`,Number.MIN_VALUE,1e9);number(e.hp,`${path}.hp`,0,maxHp);order(e.order,`${path}.order`,c);
 for(const key of ['cooldown','animTime','expires'])number(e[key],`${path}.${key}`);
 for(const key of ['progress','trainProgress'])number(e[key],`${path}.${key}`,0,1);
 // Completed research can reach 1+dt for a single tick before being reset.
 number(e.researchProgress,`${path}.researchProgress`,0,2);
 number(e.facing,`${path}.facing`,0,7,true);choice(e.animation,`${path}.animation`,['idle','walk','attack','death']);number(e.momentum,`${path}.momentum`,0,1);flag(e.illusion,`${path}.illusion`);number(e.carried,`${path}.carried`,0,18);choice(e.carriedKind,`${path}.carriedKind`,RESOURCE_KINDS);
 if(e.definitionFaction!==undefined){choice(e.definitionFaction,`${path}.definitionFaction`,Object.keys(contentFactions(c.state.content)));if(!c.state.players.some(player=>player.faction===e.definitionFaction)||e.kind!=='unit'||!e.illusion&&e.role!=='siege'&&(e.role==='worker'||(e.tactics as {surrenderedTo?:number}|undefined)?.surrenderedTo!==e.side))bad(`${path}.definitionFaction`,'original faction requires a captured engine or surrendered combat troop from a match faction');}
 if(e.definitionId!==undefined){if(typeof e.definitionId!=='string'||e.definitionId.length>100)bad(`${path}.definitionId`,'invalid ID');try{entityDefinition(c.state,e as unknown as Entity);}catch{bad(`${path}.definitionId`,'definition is absent from the pinned faction or has another role');}}
 if(e.definitionFaction!==undefined&&!e.illusion&&e.maxHp!==entityDefinition(c.state,e as unknown as Entity).hp)bad(`${path}.maxHp`,'captured troop health capacity differs from its original definition');
 const queue=list(e.queue,`${path}.queue`,5);queue.forEach((role,i)=>{choice(role,`${path}.queue[${i}]`,UNIT_ROLES);if(e.kind!=='building'||(e.role!=='hq'&&e.role!=='barracks')||(e.role==='hq'&&role!=='worker')||(e.role==='barracks'&&role==='worker'))bad(`${path}.queue`,'invalid producer or recruit');});
 if(e.queueDefinitionIds!==undefined){list(e.queueDefinitionIds,`${path}.queueDefinitionIds`,5,queue.length).forEach((id,i)=>{const def=availableUnits(c.state,e.side as Side).find(d=>d.id===id);if(!def||def.role!==queue[i])bad(`${path}.queueDefinitionIds[${i}]`,'definition is absent from the pinned faction or has another role');});}else if(c.state.content&&queue.length)bad(`${path}.queueDefinitionIds`,'pinned production requires definition IDs');
 if(e.queuePaidCosts!==undefined){list(e.queuePaidCosts,`${path}.queuePaidCosts`,5,queue.length).forEach((value,i)=>{const paid=object(value,`${path}.queuePaidCosts[${i}]`,['wood','ore','crystal']);for(const key of RESOURCE_KINDS)number(paid[key],`${path}.queuePaidCosts[${i}].${key}`,0,100000);const expected=availableUnits(c.state,e.side as Side).find(d=>d.id===(e.queueDefinitionIds as string[]|undefined)?.[i])?.cost;if(!expected||RESOURCE_KINDS.some(key=>paid[key]!==expected[key as keyof typeof expected]))bad(`${path}.queuePaidCosts[${i}]`,'paid cost differs from pinned definition');});}else if(c.state.content&&queue.length)bad(`${path}.queuePaidCosts`,'pinned production requires charged cost records');
 list(e.path,`${path}.path`,c.cells*16).forEach((p,i)=>point(p,`${path}.path[${i}]`,c));
 if(e.orderQueue!==undefined){if(e.kind!=='unit'||e.illusion)bad(`${path}.orderQueue`,'only real units can queue orders');list(e.orderQueue,`${path}.orderQueue`,MAX_ORDER_QUEUE).forEach((o,i)=>order(o,`${path}.orderQueue[${i}]`,c));}
 if(e.research!==undefined){const upgrades=upgradesFor(c.state,e.side as Side);choice(e.research,`${path}.research`,Object.keys(upgrades));if(e.kind!=='building'||upgrades[e.research as keyof typeof upgrades].building!==e.role)bad(`${path}.research`,'wrong research building');}
 if(e.research!==undefined&&upgradesFor(c.state,e.side as Side)[e.research as keyof ReturnType<typeof upgradesFor>].exclusiveGroup&&e.researchPaidCost===undefined)bad(`${path}.researchPaidCost`,'exclusive research requires the original charged cost');
 if(e.researchPaidCost!==undefined){if(e.research===undefined)bad(`${path}.researchPaidCost`,'charged research cost requires pending research');const paid=object(e.researchPaidCost,`${path}.researchPaidCost`,['wood','ore','crystal']),expected=upgradesFor(c.state,e.side as Side)[e.research as keyof ReturnType<typeof upgradesFor>].cost;for(const key of RESOURCE_KINDS){number(paid[key],`${path}.researchPaidCost.${key}`,0,100000);if(paid[key]!==expected[key as keyof typeof expected])bad(`${path}.researchPaidCost`,'charged cost differs from pinned research');}}
 if(e.rally!==undefined)point(e.rally,`${path}.rally`,c);
 for(const key of ['gateOpen','raised'])optionalFlag(e,key,path);
 if(e.lastAttacker!==undefined)id(e.lastAttacker,`${path}.lastAttacker`,c);
 for(const key of ['abilityReadyAt','entrenchedAt','lastDamagedAt','surgeUntil','shield','maxShield'])optionalNumber(e,key,path);
 if(e.factionState!==undefined)validateFactionUnit(e.factionState,`${path}.factionState`,c,e);
 if(e.tactics!==undefined)validateTactics(e.tactics,`${path}.tactics`,c,e);
 if(e.shield!==undefined&&(e.shield as number)>(e.maxShield as number|undefined??0))bad(`${path}.shield`,'shield exceeds capacity');
 if(e.maxShield!==undefined){const capacity=e.kind==='unit'?(entityDefinition(c.state,e as unknown as Entity) as UnitDef).shield:(e.factionState as {power?:unknown}|undefined)?.power?80:undefined;if(capacity===undefined||e.maxShield!==capacity)bad(`${path}.maxShield`,'shield capacity differs from admitted definition or power network');}
}
function validateBody(value:unknown,path:string,c:Context):void {const body=object(value,path,['id','x','y','expires'],['level']);id(body.id,`${path}.id`,c);coordinates(body,path,c);number(body.expires,`${path}.expires`);if(body.level!==undefined)number(body.level,`${path}.level`,0,c.levels-1,true);}
function validatePowerConnections(c:Context):void {
 const groups=new Map<string,RecordValue[]>(),components=new Map<number,number>();
 // Power refresh precedes combat. Retained dead buildings can connect a snapshot
 // until the next step recomputes its network, so include them in this graph.
 for(const e of c.entities.values()){const power=(e.factionState as {power?:{connected:boolean;root:number|null}}|undefined)?.power;if(e.kind==='building'&&e.progress===1&&power?.connected){const key=`${e.side}:${e.level??0}:${power.root}`,nodes=groups.get(key)??[];nodes.push(e);groups.set(key,nodes);}}
 for(const nodes of groups.values())for(const first of nodes){if(components.has(first.id as number))continue;const component=[first],componentId=first.id as number;components.set(componentId,componentId);for(let i=0;i<component.length;i++)for(const candidate of nodes)if(!components.has(candidate.id as number)&&Math.hypot((candidate.x as number)-(component[i].x as number),(candidate.y as number)-(component[i].y as number))<=8){components.set(candidate.id as number,componentId);component.push(candidate);}}
 for(const e of c.entities.values()){const power=(e.factionState as {power?:{connected:boolean;root:number|null}}|undefined)?.power;if(!power?.connected||(e.hp as number)<=0)continue;const root=c.entities.get(power.root!),rootPower=(root?.factionState as {power?:{connected:boolean;root:number|null}}|undefined)?.power;if(!root||root.kind!=='building'||root.role!=='hq'||root.side!==e.side||root.progress!==1||(root.level??0)!==(e.level??0)||!rootPower?.connected||rootPower.root!==root.id||components.get(e.id as number)!==components.get(root.id as number))bad(`state.entities[${e.id}].factionState.power.root`,'power root requires a completed owned headquarters connected within eight-tile building links on the same level');}
}
function validateFactionUnit(value:unknown,path:string,c:Context,e:RecordValue):void {
 const f=object(value,path,[],['trophyKills','chant','swapReadyAt','artillery','tunnel','corpseCargo','deliveredCorpses','corpseOrder','power','nextDecoyAt','waterReadyAt']);
 if(f.trophyKills!==undefined){if(e.kind!=='unit'||e.illusion)bad(`${path}.trophyKills`,'trophies require real troops');number(f.trophyKills,`${path}.trophyKills`,0,1e9,true);}
 for(const key of ['swapReadyAt','nextDecoyAt','waterReadyAt'])optionalNumber(f,key,path,0,c.time+60);
 if(f.swapReadyAt!==undefined&&(e.kind!=='unit'||e.illusion||['worker','siege'].includes(e.role as string)))bad(`${path}.swapReadyAt`,'illusion swapping requires real military troops');
 if(f.waterReadyAt!==undefined&&(e.kind!=='unit'||e.illusion||e.role!=='special'||(entityDefinition(c.state,e as unknown as Entity) as UnitDef).ability!=='surge'))bad(`${path}.waterReadyAt`,'water shaping requires an admitted Tidecaller');
 if(f.nextDecoyAt!==undefined&&(e.kind!=='building'||e.definitionId!=='core:fairies-enchanted-grove'))bad(`${path}.nextDecoyAt`,'decoy cooldown requires an Enchanted Grove');
 if(f.chant!==undefined){if(e.kind!=='unit'||e.illusion||['worker','siege'].includes(e.role as string)||c.state.players[e.side as Side].faction!=='orcs')bad(`${path}.chant`,'war chants require owned Ironclad military troops');const chant=object(f.chant,`${path}.chant`,['kind','until']);choice(chant.kind,`${path}.chant.kind`,['assault','bulwark']);number(chant.until,`${path}.chant.until`,0,c.time+12);}
 if(f.artillery!==undefined){if(e.kind!=='unit'||e.illusion||e.role!=='siege'&&(e.role!=='special'||(entityDefinition(c.state,e as unknown as Entity) as UnitDef).ability!=='entrench'))bad(`${path}.artillery`,'fittings require siege artillery or an admitted Siege Cannon');choice(f.artillery,`${path}.artillery`,['stone','grapeshot','incendiary','reinforced']);}
 if(f.tunnel!==undefined){if(e.kind!=='unit'||e.illusion||e.raised||c.state.players[e.side as Side].faction!=='dwarves')bad(`${path}.tunnel`,'tunnel orders require owned real Deepforge troops');const tunnel=object(f.tunnel,`${path}.tunnel`,['target','progress']);id(tunnel.target,`${path}.tunnel.target`,c);number(tunnel.progress,`${path}.tunnel.progress`,0,1);}
 for(const key of ['corpseCargo','deliveredCorpses'])if(f[key]!==undefined){if(e.kind!=='unit'||e.illusion||key==='corpseCargo'&&e.definitionId!=='core:undead-corpse-wagon'||key==='deliveredCorpses'&&(e.role!=='special'||(entityDefinition(c.state,e as unknown as Entity) as UnitDef).ability!=='raise'))bad(`${path}.${key}`,'wrong corpse carrier');list(f[key],`${path}.${key}`,key==='corpseCargo'?6:12).forEach((v,i)=>validateBody(v,`${path}.${key}[${i}]`,c));}
 if(f.corpseOrder!==undefined){const order=object(f.corpseOrder,`${path}.corpseOrder`,['type','target','progress']);choice(order.type,`${path}.corpseOrder.type`,['collect','deliver']);id(order.target,`${path}.corpseOrder.target`,c);number(order.progress,`${path}.corpseOrder.progress`,0,1);if(e.kind!=='unit'||e.illusion||e.definitionId!=='core:undead-corpse-wagon'||c.state.players[e.side as Side].faction!=='undead')bad(`${path}.corpseOrder`,'active corpse orders require an owned Ashen Host corpse wagon');}
 if(f.power!==undefined){const power=object(f.power,`${path}.power`,['connected','root']);flag(power.connected,`${path}.power.connected`);if(power.root!==null)id(power.root,`${path}.power.root`,c);if(power.connected!==(power.root!==null)||e.kind!=='building'||e.progress!==1||c.state.players[e.side as Side].faction!=='automata'||e.maxShield!==80||e.shield===undefined)bad(`${path}.power`,'power requires a completed Automata building with an 80-point shield capacity');}
}
function validateFactionSystem(value:unknown,path:string,c:Context):void {
 const system=object(value,path,['version','fury','terrainEffects']);if(system.version!==1)bad(`${path}.version`,'unknown faction schema');list(system.fury,`${path}.fury`,c.playerCount,c.playerCount).forEach((v,i)=>number(v,`${path}.fury[${i}]`,0,100));
 const ids=new Set<number>();list(system.terrainEffects,`${path}.terrainEffects`,c.maxEntities).forEach((v,i)=>{const p=`${path}.terrainEffects[${i}]`,effect=object(v,p,['id','side','until','tiles']),n=id(effect.id,`${p}.id`,c);if(ids.has(n)||c.entityIds.has(n)||c.resourceIds.has(n))bad(`${p}.id`,'duplicate effect ID');ids.add(n);number(effect.side,`${p}.side`,0,c.playerCount-1,true);number(effect.until,`${p}.until`,0,c.time+20);list(effect.tiles,`${p}.tiles`,25).forEach((v,j)=>{const q=`${p}.tiles[${j}]`,tile=object(v,q,['x','y','level','before','after']);coordinates(tile,q,c);number(tile.level,`${q}.level`,0,c.levels-1,true);choice(tile.before,`${q}.before`,Object.keys(TERRAIN));choice(tile.after,`${q}.after`,['mud','shallows','water']);});});
}
function validateTactics(value:unknown,path:string,c:Context,e:RecordValue):void {
 const t=object(value,path,['morale','recentLoss'],['formation','retreat','surrenderedTo','ambush','charge','guard','siegeCrew','capture']);
 if(e.kind!=='unit')bad(path,'tactics requires a unit');number(t.morale,`${path}.morale`,0,100);number(t.recentLoss,`${path}.recentLoss`,0,60);
 if(t.surrenderedTo!==undefined){number(t.surrenderedTo,`${path}.surrenderedTo`,0,c.playerCount-1,true);if(t.surrenderedTo!==e.side||e.illusion||['worker','siege'].includes(e.role as string)||e.definitionFaction===undefined)bad(`${path}.surrenderedTo`,'surrender requires the current owner and original combat troop definition');}
 if(t.retreat!==undefined){const r=object(t.retreat,`${path}.retreat`,['x','y','until'],['level']);coordinates(r,`${path}.retreat`,c);number(r.until,`${path}.retreat.until`,0,c.time+8.01);}
 if(t.formation!==undefined){if(e.illusion||['worker','siege'].includes(e.role as string))bad(`${path}.formation`,'formations require real military troops');const f=object(t.formation,`${path}.formation`,['kind','group','slot','count','spacing','facing','anchor','phase']);choice(f.kind,`${path}.formation.kind`,['line','wedge','square','loose']);if(typeof f.group!=='string'||!f.group.length||f.group.length>1200)bad(`${path}.formation.group`,'invalid formation group');const count=number(f.count,`${path}.formation.count`,1,100,true);number(f.slot,`${path}.formation.slot`,0,count-1,true);number(f.spacing,`${path}.formation.spacing`,.65,3);number(f.facing,`${path}.formation.facing`,0,7,true);point(f.anchor,`${path}.formation.anchor`,c);choice(f.phase,`${path}.formation.phase`,['moving','broken','regrouping','formed']);}
 if(t.ambush!==undefined){const a=object(t.ambush,`${path}.ambush`,['radius','target','concealed','armedAt']);number(a.radius,`${path}.ambush.radius`,.75,10);choice(a.target,`${path}.ambush.target`,['any','unit','building',...UNIT_ROLES]);flag(a.concealed,`${path}.ambush.concealed`);number(a.armedAt,`${path}.ambush.armedAt`,0,c.time);if(e.role==='worker'||e.role==='siege'||e.illusion)bad(`${path}.ambush`,'ineligible ambusher');}
 if(t.charge!==undefined){const charge=object(t.charge,`${path}.charge`,['distance','heading','lastMovedAt']);number(charge.distance,`${path}.charge.distance`,0,5);number(charge.heading,`${path}.charge.heading`,0,7,true);number(charge.lastMovedAt,`${path}.charge.lastMovedAt`,0,c.time);if(e.role!=='cavalry'||e.illusion)bad(`${path}.charge`,'charge requires real cavalry');}
 if(t.guard!==undefined){const originalFaction=e.definitionFaction??c.state.players[e.side as Side].faction;if(e.role!=='melee'||!['dwarves','tideborn','automata'].includes(originalFaction as string))bad(`${path}.guard`,'guard requires an admitted shield bearer');const guard=object(t.guard,`${path}.guard`,['value','max','lastDamagedAt']);const max=number(guard.max,`${path}.guard.max`,40,40);number(guard.value,`${path}.guard.value`,0,max);number(guard.lastDamagedAt,`${path}.guard.lastDamagedAt`,0,c.time);}
 if(t.siegeCrew!==undefined){const crew=object(t.siegeCrew,`${path}.siegeCrew`,['hp','maxHp','uncrewed']);const max=number(crew.maxHp,`${path}.siegeCrew.maxHp`,42,42);number(crew.hp,`${path}.siegeCrew.hp`,0,max);flag(crew.uncrewed,`${path}.siegeCrew.uncrewed`);if(e.role!=='siege'||e.illusion||crew.uncrewed!==((crew.hp as number)===0))bad(`${path}.siegeCrew`,'invalid siege crew');}
 if(t.capture!==undefined){const capture=object(t.capture,`${path}.capture`,['target','progress']);id(capture.target,`${path}.capture.target`,c);number(capture.progress,`${path}.capture.progress`,0,1);if(!['worker','melee','spear','special'].includes(e.role as string)||e.illusion||e.raised)bad(`${path}.capture`,'ineligible capturer');}
}
function playersArray(value:unknown,path:string,c:Context,check:(v:unknown,p:string)=>void):void {list(value,path,c.playerCount,c.playerCount).forEach((v,i)=>check(v,`${path}[${i}]`));}
function entries(value:unknown,path:string,max:number,c:Context,check:(v:unknown,p:string)=>void):void {
 const seen=new Set<number>();list(value,path,max).forEach((entry,i)=>{const p=`${path}[${i}]`,parts=list(entry,p,2,2),key=id(parts[0],`${p}[0]`,c);if(seen.has(key))bad(path,'duplicate map key');seen.add(key);check(parts[1],`${p}[1]`);});
}
function validateRuntime(value:unknown,c:Context,version:1|2|3,teams?:TeamId[]):void {
 const fields=['fog','ai','aiTurns','hits','routes','abilities','returning','queuedGather','aiWave','initialScoutDispatched','expansionScout','expansionScoutDispatched','knownEnemyBuildings','enemyStartCleared','searched'];
 const path='runtime',r=object(value,path,version===1?fields:version===2?[...fields,'clearedEnemyStarts']:[...fields,'clearedEnemyStarts','aiBatchTurns','aiDecisionAt','aiDecisionTurns','knownEnemyUnits','retreating','producedFighters'],version===3?['teamAI']:[]);
 number(r.fog,'runtime.fog',-.25,.2);number(r.ai,'runtime.ai',-.25,1);number(r.aiTurns,'runtime.aiTurns',0,MAX_VALUE,true);
 list(r.hits,'runtime.hits',c.maxEntities).forEach((v,i)=>{const p=`runtime.hits[${i}]`,h=object(v,p,['source','target','amount','event']);for(const key of ['source','target'])if(!c.entityIds.has(id(h[key],`${p}.${key}`,c)))bad(`${p}.${key}`,'missing hit entity');number(h.amount,`${p}.amount`,0,1e9);number(h.event,`${p}.event`,0,c.eventCount-1,true);});
 entries(r.routes,'runtime.routes',MAX_ID,c,(v,p)=>{const route=object(v,p,['key','at']);if(typeof route.key!=='string'||route.key.length>128)bad(`${p}.key`,'invalid route key');number(route.at,`${p}.at`,0,c.time);});
 entries(r.abilities,'runtime.abilities',MAX_ID,c,(v,p)=>number(v,p));
 uniqueIds(list(r.returning,'runtime.returning',MAX_ID),'runtime.returning',c.nextId-1).forEach(n=>{if(n===0)bad('runtime.returning','invalid entity id');});
 uniqueIds(list(r.queuedGather,'runtime.queuedGather',c.maxEntities),'runtime.queuedGather',c.nextId-1).forEach(n=>{const e=c.entities.get(n);if(!e||(e.hp as number)<=0||e.kind!=='unit'||e.role!=='worker'||(e.order as RecordValue).type!=='gather')bad('runtime.queuedGather','expected a living worker gathering');});
 playersArray(r.aiWave,'runtime.aiWave',c,(v,p)=>number(v,p,0,c.time));
 for(const key of ['initialScoutDispatched','expansionScoutDispatched','enemyStartCleared'])playersArray(r[key],`runtime.${key}`,c,flag);
 playersArray(r.expansionScout,'runtime.expansionScout',c,(v,p)=>{if(v!==null)id(v,p,c);});
 playersArray(r.knownEnemyBuildings,'runtime.knownEnemyBuildings',c,(v,p)=>entries(v,p,c.maxEntities,c,(value,q)=>{const b=object(value,q,['x','y','role'],['level']);coordinates(b,q,c);choice(b.role,`${q}.role`,BUILDING_ROLES);}));
 playersArray(r.searched,'runtime.searched',c,(v,p)=>uniqueIds(list(v,p,c.cells),p,c.cells-1));
 if(version>=2)playersArray(r.clearedEnemyStarts,'runtime.clearedEnemyStarts',c,(v,p)=>uniqueIds(list(v,p,c.playerCount),p,c.playerCount-1));
 if(version===3){
  number(r.aiBatchTurns,'runtime.aiBatchTurns',0,MAX_VALUE,true);
  playersArray(r.aiDecisionAt,'runtime.aiDecisionAt',c,(v,p)=>number(v,p,0,c.time+3));
  for(const key of ['aiDecisionTurns','producedFighters'])playersArray(r[key],`runtime.${key}`,c,(v,p)=>number(v,p,0,MAX_VALUE,true));
  playersArray(r.knownEnemyUnits,'runtime.knownEnemyUnits',c,(v,p)=>entries(v,p,c.maxEntities,c,(value,q)=>{const observation=object(value,q,['x','y','role','seenAt','hpFraction'],['level']);coordinates(observation,q,c);choice(observation.role,`${q}.role`,UNIT_ROLES.filter(role=>role!=='worker'));number(observation.seenAt,`${q}.seenAt`,0,c.time);number(observation.hpFraction,`${q}.hpFraction`,0,1);}));
  playersArray(r.retreating,'runtime.retreating',c,(v,p)=>entries(v,p,c.maxEntities,c,(value,q)=>{const record=object(value,q,['until','produced','afterId']);number(record.until,`${q}.until`,0,c.time+30);number(record.produced,`${q}.produced`,0,MAX_VALUE,true);number(record.afterId,`${q}.afterId`,0,c.nextId-1,true);}));
  if(r.teamAI!==undefined)validateTeamAiState(r.teamAI,{playerCount:c.playerCount,teams:teams!,time:c.time,nextEntityId:c.nextId,width:c.width,height:c.height,levels:c.levels,entityLevels:new Map([...c.entities].map(([id,e])=>[id,(e.level as number|undefined)??0])),entitySides:new Map([...c.entities].filter(([,e])=>(e.hp as number)>0&&e.kind==='unit'&&e.role!=='worker'&&!e.illusion).map(([id,e])=>[id,e.side as Side]))});
 }

}
function validate(envelope:unknown,version:1|2|3):void {
 const save=object(envelope,'save',['format','version','state','runtime']);if(save.format!=='orcs-vs-fairies-save')bad('format','unknown save format');if(save.version!==version)bad('version',`unsupported version ${String(save.version)}`);
 const s=object(save.state,'state',version===1?STATE_FIELDS:version===2?[...STATE_FIELDS,...TEAM_FIELDS]:[...STATE_FIELDS,...TEAM_FIELDS,'aiConfigs'],version===3?['content','world','specialists','rules','objectives','draft','scenario','economy','friendlyFire','projectiles','factionSystems']:[]);
 if(s.content!==undefined)s.content=decodeContentBundle(s.content);
 const playerCount=list(s.players,'state.players',version===1?2:MAX_PLAYERS,version===1?2:undefined).length;
 if(playerCount===0)bad('state.players','expected between 1 and 8 players');
 const width=number(s.width,'state.width',8,256,true),height=number(s.height,'state.height',8,256,true),nextId=number(s.nextId,'state.nextId',1,MAX_ID,true);
 const levels=s.world===undefined?1:Array.isArray((s.world as RecordValue).levels)?((s.world as RecordValue).levels as unknown[]).length:0;if(levels<1||levels>2)bad('world.levels','expected1 or2 levels');
 const c:Context={state:s as unknown as GameState,levels,width,height,cells:width*height*levels,time:number(s.time,'state.time'),nextId,playerCount,maxEntities:version===1?4096:MAX_ENTITIES,entityIds:new Set(),entities:new Map(),resourceIds:new Set(),eventCount:0};
 if(version===3)playersArray(s.aiConfigs,'state.aiConfigs',c,(v,p)=>{const config=object(v,p,['difficulty','personality','opening']);choice(config.difficulty,`${p}.difficulty`,['easy','normal','hard']);choice(config.personality,`${p}.personality`,['balanced','rush','fortify','expand','raid']);choice(config.opening,`${p}.opening`,['infantry-rush','tower-defense','fast-expansion','cavalry-raids']);});
 playersArray(s.controllers,'state.controllers',c,(v,p)=>choice(v,p,['human','ai','external']));choice(s.mapSize,'state.mapSize',['small','medium','large','huge']);number(s.mapVersion,'state.mapVersion',1,MAP_VERSION,true);
 list(s.terrain,'state.terrain',width*height,width*height).forEach((v,i)=>choice(v,`state.terrain[${i}]`,Object.keys(TERRAIN)));playersArray(s.starts,'state.starts',c,(v,p)=>point(v,p,c));flag(s.draw,'state.draw');number(s.tick,'state.tick',0,MAX_VALUE,true);number(s.time,'state.time');number(s.seed,'state.seed',0,0xffffffff,true);
 if(version>=2){
  playersArray(s.teams,'state.teams',c,(v,p)=>number(v,p,0,MAX_PLAYERS-1,true));
  playersArray(s.incomeFactors,'state.incomeFactors',c,(v,p)=>number(v,p,0,10));
  playersArray(s.populationLimits,'state.populationLimits',c,(v,p)=>number(v,p,1,500,true));
  playersArray(s.eliminated,'state.eliminated',c,flag);flag(s.sharedVision,'state.sharedVision');
 }
 list(s.entities,'state.entities',c.maxEntities).forEach((v,i)=>validateEntity(v,`state.entities[${i}]`,c));
 validatePowerConnections(c);
 if(s.friendlyFire!==undefined)flag(s.friendlyFire,'state.friendlyFire');
 if(s.projectiles!==undefined)list(s.projectiles,'state.projectiles',c.maxEntities).forEach((v,i)=>{const path=`state.projectiles[${i}]`,shell=object(v,path,['id','source','side','faction','from','x','y','damage','buildingMultiplier','impactAt','radius'],['modification','level']),key=id(shell.id,`${path}.id`,c);if(c.entityIds.has(key)||c.resourceIds.has(key))bad(`${path}.id`,'duplicate projectile ID');c.resourceIds.add(key);id(shell.source,`${path}.source`,c);number(shell.side,`${path}.side`,0,c.playerCount-1,true);choice(shell.faction,`${path}.faction`,Object.keys(contentFactions(c.state.content)));const origin=object(shell.from,`${path}.from`,['x','y'],['level','elevation']);coordinates(origin,`${path}.from`,c);optionalNumber(origin,'elevation',`${path}.from`,0,3);coordinates(shell,path,c);number(shell.damage,`${path}.damage`,0,1e9);number(shell.buildingMultiplier,`${path}.buildingMultiplier`,0,100);number(shell.impactAt,`${path}.impactAt`,c.time,c.time+30);number(shell.radius,`${path}.radius`,.1,10);if(shell.modification!==undefined)choice(shell.modification,`${path}.modification`,['stone','grapeshot','incendiary','reinforced']);});
 list(s.resources,'state.resources',MAX_RESOURCES).forEach((v,i)=>{const p=`state.resources[${i}]`,r=object(v,p,['id','x','y','kind','amount','maxAmount'],['level']),key=id(r.id,`${p}.id`,c);if(c.entityIds.has(key)||c.resourceIds.has(key))bad(`${p}.id`,'duplicate entity or resource id');c.resourceIds.add(key);coordinates(r,p,c);choice(r.kind,`${p}.kind`,RESOURCE_KINDS);const max=number(r.maxAmount,`${p}.maxAmount`,0,1e9);number(r.amount,`${p}.amount`,0,max);});
 playersArray(s.players,'state.players',c,(v,p)=>{const player=object(v,p,['faction','wood','ore','crystal','population','cap','upgrades'],['heroRecovery']);choice(player.faction,`${p}.faction`,Object.keys(contentFactions(c.state.content)));for(const key of RESOURCE_KINDS)number(player[key],`${p}.${key}`);number(player.population,`${p}.population`,0,c.maxEntities,true);number(player.cap,`${p}.cap`,0,version===1?100:500,true);const available=upgradesFor(c.state,(s.players as unknown[]).indexOf(v) as Side),upgrades=list(player.upgrades,`${p}.upgrades`,Object.keys(available).length);upgrades.forEach((u,i)=>choice(u,`${p}.upgrades[${i}]`,Object.keys(available)));if(new Set(upgrades).size!==upgrades.length)bad(`${p}.upgrades`,'duplicate upgrade');});
 const researching=Array.from({length:playerCount},()=>new Set<string>()),choices=Array.from({length:playerCount},()=>new Map<string,string>()),players=s.players as RecordValue[];
 for(let side=0;side<playerCount;side++){const definitions=upgradesFor(c.state,side as Side);for(const id of players[side].upgrades as string[]){const group=definitions[id as keyof typeof definitions].exclusiveGroup;if(group){if(choices[side].has(group))bad(`state.players[${side}].upgrades`,'exclusive technology choices conflict');choices[side].set(group,id);}}}
 for(const e of c.entities.values())if((e.hp as number)>0&&e.research!==undefined){const side=e.side as number,upgrade=e.research as string;if((players[side].upgrades as string[]).includes(upgrade)||researching[side].has(upgrade))bad('state.entities.research','upgrade is already complete or being researched');researching[side].add(upgrade);const group=upgradesFor(c.state,side as Side)[upgrade as keyof ReturnType<typeof upgradesFor>].exclusiveGroup;if(group){if(choices[side].has(group))bad('state.entities.research','exclusive technology choice is already complete or being researched');choices[side].set(group,upgrade);}}
 if(s.winner!==null)number(s.winner,'state.winner',0,playerCount-1,true);if(s.draw&&s.winner!==null)bad('state.winner','draw cannot have a winner');
 if(version>=2){
  if(s.winningTeam!==null){number(s.winningTeam,'state.winningTeam',0,MAX_PLAYERS-1,true);if(!(s.teams as number[]).includes(s.winningTeam as number))bad('state.winningTeam','team has no player');}
  if((s.winner===null)!==(s.winningTeam===null)||(s.winner!==null&&(s.teams as number[])[s.winner as number]!==s.winningTeam))bad('state.winner','winner must belong to the winning team');
  if(s.draw&&s.winningTeam!==null)bad('state.winningTeam','draw cannot have a winning team');
 }
 list(s.corpses,'state.corpses',c.maxEntities*2).forEach((v,i)=>{const p=`state.corpses[${i}]`,corpse=object(v,p,['id','x','y','expires'],['level']);id(corpse.id,`${p}.id`,c);coordinates(corpse,p,c);number(corpse.expires,`${p}.expires`);});
 if(s.factionSystems!==undefined)validateFactionSystem(s.factionSystems,'state.factionSystems',c);
 const bodyOwners=new Set<number>();const claimBody=(body:unknown,path:string)=>{const b=body as RecordValue,n=b.id as number;if(bodyOwners.has(n))bad(path,'body belongs to more than one location');bodyOwners.add(n);};(s.corpses as unknown[]).forEach((b,i)=>claimBody(b,`state.corpses[${i}]`));for(const e of c.entities.values()){const f=e.factionState as RecordValue|undefined;if(f)for(const key of ['corpseCargo','deliveredCorpses'])if(f[key])for(const b of f[key] as unknown[])claimBody(b,`state.entities[${e.id}].factionState.${key}`);}
 const events=list(s.events,'state.events',c.maxEntities*4);c.eventCount=events.length;
 events.forEach((v,i)=>{const p=`state.events[${i}]`,event=object(v,p,['type','x','y','side'],['text','target','source','amount','resource','level']);choice(event.type,`${p}.type`,['attack','death','build','train','gather','message','ability','research']);coordinates(event,p,c);number(event.side,`${p}.side`,0,playerCount-1,true);for(const key of ['source','target'])if(event[key]!==undefined)id(event[key],`${p}.${key}`,c);optionalNumber(event,'amount',p);if(event.resource!==undefined)choice(event.resource,`${p}.resource`,RESOURCE_KINDS);if(event.text!==undefined&&(typeof event.text!=='string'||event.text.length>4096))bad(`${p}.text`,'invalid message text');});
 const explored=fog(s.explored,'state.explored',c),visible=fog(s.visible,'state.visible',c);visible.forEach((tiles,side)=>{for(const tile of tiles)if(!explored[side].has(tile))bad(`state.visible[${side}]`,'visible tiles must be explored');});
 if(s.world!==undefined){validateWorldState(s.world,width,height,nextId,playerCount);const world=s.world;for(const allocated of [...world.bridges,...world.sites,...world.creatures])if(c.entityIds.has(allocated.id)||c.resourceIds.has(allocated.id))bad('world.id','collision with entity or resource');if(world.levels[0].terrain.some((t,i)=>t!==(s.terrain as unknown[])[i]))bad('world.levels[0].terrain','must match surface terrain');}
 if(s.economy!==undefined)validateEconomyState(s.economy,{width,height,time:c.time,nextId,playerCount,entities:s.entities as GameState['entities'],resources:s.resources as GameState['resources'],levels:c.levels,world:c.state.world});
 validateRuntime(save.runtime,c,version,s.teams as TeamId[]|undefined);
 validateSpecialists(c.state);
 if(version===3){const count=['rules','objectives','draft'].filter(k=>Object.hasOwn(s,k)).length;if(count!==0&&count!==3)bad('state.rules','rules, objectives and draft must be stored together');if(count===3){const state=s as unknown as GameState;state.rules=validateSavedRules(s.rules,state.content);validateDraftState(s.draft,draftPlayers(state),state.rules,state.content);validateObjectiveState(s.objectives,state);validateModeRoster(state);}}
 if(s.scenario!==undefined)s.scenario=validateScenarioBinding(s.scenario,c.state);
}
function validateCurrent(envelope:unknown):asserts envelope is SaveEnvelope {validate(envelope,SAVE_VERSION);}
/** Add team rules only after the complete two-player v1 schema has passed validation. */
function migrateLegacy(envelope:RecordValue):void {
 validate(envelope,1);const state=envelope.state as RecordValue,entities=state.entities as RecordValue[];
 Object.assign(state,{teams:[0,1],incomeFactors:[1,1],populationLimits:[100,100],sharedVision:true,eliminated:[0,1].map(side=>!entities.some(e=>e.side===side&&e.kind==='building'&&e.role==='hq'&&(e.hp as number)>0&&e.progress===1)),winningTeam:state.winner});
 const runtime=envelope.runtime as RecordValue,cleared=runtime.enemyStartCleared as boolean[];runtime.clearedEnemyStarts=cleared.map((value,side)=>value?[1-side]:[]);
 envelope.version=2;
}
function migrateAi(envelope:RecordValue):void {
 validate(envelope,2);const state=envelope.state as RecordValue,runtime=envelope.runtime as RecordValue,count=(state.players as unknown[]).length;
 state.aiConfigs=Array.from({length:count},()=>normalizeAiConfig());
 Object.assign(runtime,{aiBatchTurns:0,aiDecisionAt:Array(count).fill(state.time as number),aiDecisionTurns:Array(count).fill(0),knownEnemyUnits:Array.from({length:count},()=>[]),retreating:Array.from({length:count},()=>[]),producedFighters:Array(count).fill(0)});envelope.version=SAVE_VERSION;
}
/** Copy only bounded JSON data. Accessors, class instances and cycles are rejected. */
function copyJson(value:unknown):unknown {
 let nodes=0,bytes=0;const parents=new Set<object>();
 function copy(v:unknown,path:string,depth:number):unknown {
  if(++nodes>2000000||depth>32)bad(path,'save is too large or deeply nested');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))bad(path,'numbers must be finite');return v;}
  if(typeof v==='string'){bytes+=v.length*2;if(bytes>MAX_SAVE_BYTES)bad(path,'save exceeds size limit');return v;}
  if(!v||typeof v!=='object')bad(path,'expected JSON data');
  if(parents.has(v))bad(path,'cyclic reference');parents.add(v);
  let result:unknown;
  if(Array.isArray(v)){
   if(v.length>100000)bad(path,'array exceeds size limit');
   const array:unknown[]=[];for(let i=0;i<v.length;i++){const descriptor=Object.getOwnPropertyDescriptor(v,String(i));if(!descriptor||!('value' in descriptor))bad(path,'array accessors and gaps are forbidden');array.push(copy(descriptor.value,`${path}[${i}]`,depth+1));}result=array;
  }else{
   const prototype=Object.getPrototypeOf(v);if(prototype!==Object.prototype&&prototype!==null)bad(path,'expected a plain object');
   // Authored actor labels and runtime counters can exceed fixed-schema key counts.
   // Their own validators retain semantic bounds; this copy shares the array budget.
   const keys=Object.keys(v);if(keys.length>100000||Object.getOwnPropertySymbols(v).length)bad(path,'invalid object properties');
   const record:RecordValue={};for(const key of keys){if(key==='__proto__'||key==='constructor'||key==='prototype')bad(path,'unsafe property name');const descriptor=Object.getOwnPropertyDescriptor(v,key)!;if(!('value' in descriptor))bad(path,'accessors are forbidden');if(descriptor.value!==undefined)record[key]=copy(descriptor.value,`${path}.${key}`,depth+1);}
   result=record;
  }
  parents.delete(v);return result;
 }
 return copy(value,'save',0);
}
function checkSize(value:unknown):void {if(new TextEncoder().encode(JSON.stringify(value)).byteLength>MAX_SAVE_BYTES)bad('save','save exceeds size limit');}
export function saveGame(state:GameState):SaveEnvelope {
 const envelope=copyJson({format:'orcs-vs-fairies-save',version:SAVE_VERSION,state:{...state,explored:state.explored.map(set=>[...set]),visible:state.visible.map(set=>[...set])},runtime:captureRuntime(state)});
 checkSize(envelope);validateCurrent(envelope);return envelope;
}
export function loadGame(input:unknown):GameState {
 let source=input;
 if(typeof input==='string'){if(input.length>MAX_SAVE_BYTES||new TextEncoder().encode(input).byteLength>MAX_SAVE_BYTES)bad('save','save exceeds size limit');try{source=JSON.parse(input);}catch{bad('save','invalid JSON');}}
 const envelope=copyJson(source);checkSize(envelope);const record=object(envelope,'save',['format','version','state','runtime']);
 if(record.version===1)migrateLegacy(record);if(record.version===2)migrateAi(record);
 validateCurrent(envelope);if(!envelope.state.rules){const state=envelope.state as unknown as GameState;state.rules=normalizeMatchRules({sharedVision:state.sharedVision},state.content);state.draft=createDraft(draftPlayers(state),state.rules,state.content);state.objectives=emptyObjectives(state);}
 checkSize(envelope);validateCurrent(envelope);
 const state:GameState={...envelope.state,explored:envelope.state.explored.map(values=>new Set(values)),visible:envelope.state.visible.map(values=>new Set(values))};
 if(state.world)state.world.levels[0].terrain=state.terrain;
 restoreRuntime(state,envelope.runtime);return state;
}
