import { ABILITIES } from './content';
import { buildingFor, unitFor } from './content-registry';
import { walkable } from './navigation';
import { terrainAt } from './maps';
import { specialistState } from './unit-progression';
import type { Command, Entity, GameState, Side, TerrainKind, Vec } from './types';
import type { SpecialistAbility, SpecialistBuff } from './specialist-types';
export interface SpecialistHooks {damage:(source:Entity,target:Entity,amount:number)=>void;spawn:(side:Side,kind:Entity['kind'],definitionId:string,x:number,y:number,progress?:number)=>Entity;setTerrain?:(point:Vec,kind:TerrainKind)=>boolean}
const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const allied=(s:GameState,a:Entity,b:Entity)=>s.teams[a.side]===s.teams[b.side];
const visible=(s:GameState,side:Side,p:Vec)=>s.visible[side].has(Math.floor(p.y)*s.width+Math.floor(p.x));
const active=(e:Entity)=>e.hp>0&&e.kind==='unit'&&!e.illusion;
const targeted=new Set<SpecialistAbility>(['iron-command','queen-step','thane-ward','soul-drain','admiral-wave','prime-shield','forest-leap','shield-dash']);
export function abilityNeedsTarget(s:GameState,e:Entity):boolean {return targeted.has(unitFor(s,e).ability as SpecialistAbility);}
function buff(s:GameState,e:Entity,value:Omit<SpecialistBuff,'until'>,seconds:number){e.specialistBuffs??=[];e.specialistBuffs.push({...value,until:s.time+seconds});}
export function heroRecruitmentReason(s:GameState,side:Side,definitionId:string):string|undefined {
 const def=s.players[side]&&unitFor(s,side,'special',definitionId);if(!def?.tags?.includes('hero'))return undefined;
 if(s.entities.some(e=>e.side===side&&e.hp>0&&e.kind==='unit'&&!e.illusion&&unitFor(s,e).tags?.includes('hero'))||s.entities.some(e=>e.side===side&&e.hp>0&&e.queueDefinitionIds?.some(id=>{try{return unitFor(s,side,'special',id).tags?.includes('hero');}catch{return false;}})))return 'A commander is already alive or queued';
 const recovery=s.players[side].heroRecovery?.find(r=>r.definitionId===definitionId);if(recovery&&recovery.availableAt>s.time)return `Commander recovery: ${Math.ceil(recovery.availableAt-s.time)}s`;return undefined;
}
export function commanderDied(s:GameState,e:Entity):void {if(e.kind!=='unit'||e.illusion||!unitFor(s,e).tags?.includes('hero'))return;const p=s.players[e.side];p.heroRecovery??=[];p.heroRecovery=p.heroRecovery.filter(r=>r.definitionId!==unitFor(s,e).id);p.heroRecovery.push({definitionId:unitFor(s,e).id,availableAt:s.time+30});}
export function specialistAbility(s:GameState,e:Entity,c:Extract<Command,{type:'ability'}>,hooks:SpecialistHooks):boolean|undefined {
 const ability=unitFor(s,e).ability as SpecialistAbility;if(!Object.hasOwn(ABILITIES,ability)||!['iron-command','queen-step','thane-ward','soul-drain','admiral-wave','prime-shield','impact-fury','forest-leap','armored-brace','terror','wet-surge','shield-dash','incendiary-shell','rooting-shell','ammunition-cannon','corpse-shell','flood-shell','powered-beam'].includes(ability))return undefined;
 if((e.abilityReadyAt??0)>s.time)return false;
 const target=c.target===undefined?undefined:s.entities.find(target=>target.id===c.target&&target.hp>0),point=c.x===undefined?target:{x:c.x,y:c.y!};
 const validPoint=(range:number)=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=.5&&point.y>=.5&&point.x<s.width-.5&&point.y<s.height-.5&&dist(e,point)<=range&&visible(s,e.side,point);
 const nearby=(point:Vec,radius:number)=>s.entities.filter(target=>active(target)&&dist(target,point)<=radius);
 switch(ability){
  case 'iron-command':if(!validPoint(8))return false;for(const ally of nearby(point!,5))if(allied(s,e,ally))buff(s,ally,{damageFactor:1.25},8);break;
  case 'queen-step':if(!validPoint(7)||!walkable(s,point!.x,point!.y))return false;e.x=point!.x;e.y=point!.y;e.path=[];e.order={type:'idle'};for(const ally of nearby(e,4))if(allied(s,e,ally))ally.hp=Math.min(ally.maxHp,ally.hp+35);break;
  case 'thane-ward':if(!target||!allied(s,e,target)||dist(e,target)>8||!visible(s,e.side,target))return false;target.hp=Math.min(target.maxHp,target.hp+80);buff(s,target,{armor:4},10);break;
  case 'soul-drain':if(!target||target.kind!=='unit'||target.illusion||target.raised||allied(s,e,target)||dist(e,target)>7||!visible(s,e.side,target))return false;hooks.damage(e,target,60);e.hp=Math.min(e.maxHp,e.hp+45);break;
  case 'admiral-wave':if(!validPoint(8))return false;for(const actor of nearby(point!,4))if(allied(s,e,actor))actor.hp=Math.min(actor.maxHp,actor.hp+50);else hooks.damage(e,actor,35);break;
  case 'prime-shield':if(!target||!allied(s,e,target)||!target.maxShield||dist(e,target)>8||!visible(s,e.side,target))return false;target.shield=target.maxShield;buff(s,target,{armor:4},10);break;
  case 'impact-fury':buff(s,e,{damageFactor:1.35},6);e.momentum=1;break;
  case 'forest-leap':if(!validPoint(5)||!walkable(s,point!.x,point!.y))return false;e.x=point!.x;e.y=point!.y;e.path=[];break;
  case 'armored-brace':buff(s,e,{armor:5,speedFactor:.75},8);break;
  case 'terror':{let count=0;for(const hostile of nearby(e,4))if(!allied(s,e,hostile)&&!hostile.illusion&&!hostile.raised&&hostile.role!=='siege'){buff(s,hostile,{fearedFrom:{x:e.x,y:e.y}},3);count++;}if(!count)return false;break;}
  case 'wet-surge':if(!['mud','shallows'].includes(terrainAt(s,e.x,e.y)))return false;buff(s,e,{speedFactor:1.6,damageFactor:1.2},8);break;
  case 'shield-dash':if(!validPoint(4)||!walkable(s,point!.x,point!.y)||(e.shield??0)<15)return false;e.shield!-=15;e.x=point!.x;e.y=point!.y;e.path=[];break;
  case 'incendiary-shell':if(s.players[e.side].wood<8)return false;s.players[e.side].wood-=8;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='incendiary';break;
  case 'rooting-shell':if(s.players[e.side].crystal<6)return false;s.players[e.side].crystal-=6;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='rooting';break;
  case 'ammunition-cannon':if(s.players[e.side].ore<15||e.animation==='walk')return false;s.players[e.side].ore-=15;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.ammo=Math.min(10,e.siegeMode.ammo+5);e.siegeMode.deployed=true;e.order={type:'hold'};break;
  case 'corpse-shell':{const corpse=s.corpses.find(c=>c.expires>s.time&&dist(e,c)<=6&&visible(s,e.side,c));if(!corpse)return false;s.corpses=s.corpses.filter(c=>c.id!==corpse.id);e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='corpse';break;}
  case 'flood-shell':if(s.players[e.side].crystal<6)return false;s.players[e.side].crystal-=6;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='flood';break;
  case 'powered-beam':if(s.players[e.side].crystal<8)return false;s.players[e.side].crystal-=8;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.ammo=Math.min(8,e.siegeMode.ammo+4);break;
 }
 e.abilityReadyAt=s.time+ABILITIES[ability].cooldown;s.events.push({type:'ability',side:e.side,x:e.x,y:e.y,source:e.id,text:ABILITIES[ability].name,target:target?.id});return true;
}
export interface SiegePayload {kind:'incendiary'|'rooting'|'corpse'|'flood'|'beam'|'cannon';damageFactor:number;armorPiercing:boolean;radius:number}
export function prepareSiegeShot(s:GameState,e:Entity):SiegePayload|false|undefined {
 if(e.kind!=='unit'||e.role!=='siege')return undefined;const ability=unitFor(s,e).ability,mode=e.siegeMode;
 if(ability==='ammunition-cannon'){if(!mode?.deployed||mode.ammo<=0)return false;mode.ammo--;return {kind:'cannon',damageFactor:1.5,armorPiercing:false,radius:0};}
 if(ability==='powered-beam'){if(!mode||mode.ammo<=0)return false;mode.ammo--;return {kind:'beam',damageFactor:1,armorPiercing:true,radius:0};}
 const prepared=mode?.prepared;if(!prepared)return undefined;delete mode!.prepared;return {kind:prepared,damageFactor:prepared==='corpse'?1.4:1,armorPiercing:false,radius:prepared==='corpse'?2.5:2};
}
export function siegeImpact(s:GameState,source:Entity,target:Entity,payload:SiegePayload,hooks:SpecialistHooks):void {
 if(payload.kind==='cannon'||payload.kind==='beam')return;for(const actor of s.entities){if(actor.hp<=0||actor.id===target.id||dist(actor,target)>payload.radius)continue;hooks.damage(source,actor,unitFor(s,source).damage*(payload.kind==='corpse'?.75:.4));}
 for(const actor of s.entities){if(!active(actor)||dist(actor,target)>payload.radius)continue;if(payload.kind==='rooting')buff(s,actor,{rooted:true},4);else if(payload.kind==='flood')buff(s,actor,{speedFactor:.5},6);else if(payload.kind==='incendiary'){actor.burning??=[];actor.burning.push({source:source.id,side:source.side,until:s.time+6,nextAt:s.time+1,damage:5});}}
}
function fieldSetTerrain(s:GameState,point:Vec,kind:TerrainKind,hooks:SpecialistHooks):boolean {if(hooks.setTerrain)return hooks.setTerrain(point,kind);const index=Math.floor(point.y)*s.width+Math.floor(point.x);if(index<0||index>=s.terrain.length)return false;s.terrain[index]=kind;for(const e of s.entities)e.path=[];return true;}
export function engineerBuild(s:GameState,side:Side,c:Extract<Command,{type:'engineerBuild'}>,hooks:SpecialistHooks):boolean {
 const engineers=s.entities.filter(e=>e.side===side&&c.ids.includes(e.id)&&active(e)&&unitFor(s,e).tags?.includes('engineer')),point={x:Math.floor(c.x)+.5,y:Math.floor(c.y)+.5};if(!engineers.some(e=>dist(e,point)<=4)||!visible(s,side,point))return false;const player=s.players[side],cost=c.kind==='bridge'?{wood:60,ore:0}:{wood:35,ore:15};if(player.wood<cost.wood||player.ore<cost.ore)return false;
 const state=specialistState(s);if(state.structures.some(item=>item.expires>s.time&&item.tiles?.some(tile=>tile.x===point.x&&tile.y===point.y)))return false;
 if(c.kind==='bridge'){const tiles=[-1,0,1].map(dx=>({x:point.x+dx,y:point.y}));if(tiles.some(tile=>tile.x<.5||tile.x>=s.width-.5)||!tiles.some(tile=>terrainAt(s,tile.x,tile.y)==='water')||tiles.some(tile=>!['water','shallows','grass','road'].includes(terrainAt(s,tile.x,tile.y))||!visible(s,side,tile)))return false;const saved=tiles.map(tile=>({...tile,previous:terrainAt(s,tile.x,tile.y),placed:'bridge'}));for(const tile of tiles)fieldSetTerrain(s,tile,'bridge',hooks);state.structures.push({id:state.nextStructureId++,kind:'bridge',owner:side,expires:s.time+60,tiles:saved});}
 else{if(!walkable(s,point.x,point.y)||s.entities.some(e=>e.hp>0&&dist(e,point)<1))return false;const barricade=hooks.spawn(side,'building','core:field-barricade',point.x,point.y,1);state.structures.push({id:state.nextStructureId++,kind:'barricade',owner:side,expires:s.time+60,entityId:barricade.id});}
 player.wood-=cost.wood;player.ore-=cost.ore;s.events.push({type:'build',side,x:point.x,y:point.y,text:`Temporary ${c.kind}: expires in 60 seconds.`});return true;
}
export function fieldRepair(s:GameState,side:Side,id:number,targetId:number):boolean {const engineer=s.entities.find(e=>e.id===id&&e.side===side&&active(e)&&unitFor(s,e).tags?.includes('engineer')),target=s.entities.find(e=>e.id===targetId&&e.hp>0&&s.teams[e.side]===s.teams[side]);if(!engineer||!target||target.kind!=='building'&&target.role!=='siege'||target.hp>=target.maxHp||dist(engineer,target)>4)return false;const p=s.players[side],amount=Math.min(60,target.maxHp-target.hp),ore=Math.ceil(amount/10);if(p.ore<ore)return false;p.ore-=ore;target.hp+=amount;s.events.push({type:'ability',side,x:target.x,y:target.y,source:engineer.id,target:target.id,text:`Field repair: ${amount} health for ${ore} ore.`});return true;}
export function updateBeacons(s:GameState):void {
 const beacons=s.entities.filter(e=>e.kind==='building'&&e.hp>0&&e.progress===1&&buildingFor(s,e).tags?.includes('beacon')),connected=new Set<number>(),sources=s.entities.filter(e=>e.kind==='building'&&e.hp>0&&e.progress===1&&(e.role==='hq'||e.role==='depot')&&!buildingFor(s,e).tags?.includes('beacon'));
 for(let changed=true;changed;){changed=false;for(const beacon of beacons)if(!connected.has(beacon.id)&&[...sources,...beacons.filter(b=>connected.has(b.id))].some(source=>s.teams[source.side]===s.teams[beacon.side]&&dist(source,beacon)<=12)){connected.add(beacon.id);changed=true;}}
 for(const beacon of beacons){beacon.beacon??={connected:false,nextAlertAt:0};beacon.beacon.connected=connected.has(beacon.id);if(!beacon.beacon.connected||s.time<beacon.beacon.nextAlertAt)continue;const intruder=s.entities.find(e=>e.hp>0&&s.teams[e.side]!==s.teams[beacon.side]&&dist(e,beacon)<=buildingFor(s,beacon).sight&&visible(s,beacon.side,e));if(intruder){s.events.push({type:'message',side:beacon.side,x:intruder.x,y:intruder.y,source:beacon.id,target:intruder.id,text:'Beacon invasion alert.'});beacon.beacon.nextAlertAt=s.time+8;}}
}
export function stepSpecialists(s:GameState,hooks:SpecialistHooks):void {
 for(const e of s.entities){e.specialistBuffs=e.specialistBuffs?.filter(buff=>buff.until>s.time);if(e.siegeMode?.deployed&&e.animation==='walk')e.siegeMode.deployed=false;for(const fire of e.burning??[]){if(fire.until>s.time&&fire.nextAt<=s.time){const source=s.entities.find(e=>e.id===fire.source);if(source&&e.hp>0){hooks.damage(source,e,fire.damage);fire.nextAt=s.time+1;}}}e.burning=e.burning?.filter(fire=>fire.until>s.time);}
 const state=s.specialists;if(state)for(const item of [...state.structures])if(item.expires<=s.time){if(item.entityId!==undefined){const entity=s.entities.find(e=>e.id===item.entityId);if(entity){entity.hp=0;entity.expires=s.time;entity.animation='death';}}for(const tile of item.tiles??[])if(terrainAt(s,tile.x,tile.y)===tile.placed)fieldSetTerrain(s,tile,tile.previous as TerrainKind,hooks);state.structures=state.structures.filter(current=>current.id!==item.id);}updateBeacons(s);
}
