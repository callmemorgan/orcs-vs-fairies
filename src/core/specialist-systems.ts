import { DIRECTIONS_32, length2D } from './geometry';
import { ABILITIES } from './content';
import { availableUnits, buildingFor, unitFor } from './content-registry';
import { walkable } from './navigation';
import { terrainAt } from './maps';
import { promotionChoices as importPromotionChoices, specialistState } from './unit-progression';
import type { Command, Entity, GameState, Side, TerrainKind, Vec } from './types';
import type { SiegePayload, SpecialistAbility, SpecialistBuff, SpecialistSource } from './specialist-types';
export type { SiegePayload } from './specialist-types';
export interface SpecialistHooks {
 damage:(source:Entity|SpecialistSource,target:Entity,amount:number,options?:{armorPiercing?:boolean;ranged?:boolean})=>void;
 spawn:(side:Side,kind:Entity['kind'],definitionId:string,x:number,y:number,progress?:number,level?:number)=>Entity;
 setTerrain?:(point:Vec,kind:TerrainKind)=>boolean;
 terrainRevision?:(point:Vec)=>number;
}
const sameLevel=(a:Vec,b:Vec)=>(a.level??0)===(b.level??0);
const dist=(a:Vec,b:Vec)=>sameLevel(a,b)?length2D(a.x-b.x,a.y-b.y):Infinity;
const allied=(s:GameState,a:{side:Side},b:{side:Side})=>s.teams[a.side]===s.teams[b.side];
const visible=(s:GameState,side:Side,p:Vec)=>s.visible[side].has((p.level??0)*s.width*s.height+Math.floor(p.y)*s.width+Math.floor(p.x));
const active=(e:Entity)=>e.hp>0&&e.kind==='unit'&&!e.illusion&&!e.raised;
const targeted=new Set<SpecialistAbility>(['iron-command','queen-step','thane-ward','soul-drain','admiral-wave','prime-shield','forest-leap','shield-dash']);
const allAbilities=new Set<SpecialistAbility>(['iron-command','queen-step','thane-ward','soul-drain','admiral-wave','prime-shield','impact-fury','forest-leap','armored-brace','terror','wet-surge','shield-dash','incendiary-shell','rooting-shell','ammunition-cannon','corpse-shell','flood-shell','powered-beam']);
export function abilityNeedsTarget(s:GameState,e:Entity):boolean {return targeted.has(unitFor(s,e).ability as SpecialistAbility);}
function buff(s:GameState,e:Entity,value:Omit<SpecialistBuff,'until'>,seconds:number):void {e.specialistBuffs??=[];if(e.specialistBuffs.length>=64)e.specialistBuffs.shift();e.specialistBuffs.push({...value,until:s.time+seconds});}
export function heroRecruitmentReason(s:GameState,side:Side,definitionId:string):string|undefined {
 const def=s.players[side]&&availableUnits(s,side).find(def=>def.id===definitionId);if(!def?.tags?.includes('hero'))return undefined;
 if(s.entities.some(e=>e.side===side&&active(e)&&unitFor(s,e).tags?.includes('hero'))||s.entities.some(e=>e.side===side&&e.hp>0&&e.queueDefinitionIds?.some(id=>{return availableUnits(s,side).find(def=>def.id===id)?.tags?.includes('hero');})))return 'A commander is already alive or queued';
 const recovery=s.players[side].heroRecovery?.find(r=>r.definitionId===definitionId);if(recovery&&recovery.availableAt>s.time)return `Commander recovery: ${Math.ceil(recovery.availableAt-s.time)}s`;return undefined;
}
export function commanderDied(s:GameState,e:Entity):void {if(e.kind!=='unit'||e.illusion||e.raised||!unitFor(s,e).tags?.includes('hero'))return;const p=s.players[e.side];p.heroRecovery??=[];p.heroRecovery=p.heroRecovery.filter(r=>r.definitionId!==unitFor(s,e).id);p.heroRecovery.push({definitionId:unitFor(s,e).id,availableAt:s.time+30});}
export function specialistAbility(s:GameState,e:Entity,c:Extract<Command,{type:'ability'}>,hooks:SpecialistHooks):boolean|undefined {
 const ability=unitFor(s,e).ability as SpecialistAbility;if(!allAbilities.has(ability))return undefined;
 if(!active(e)||(e.abilityReadyAt??0)>s.time)return false;
 const target=c.target===undefined?undefined:s.entities.find(target=>target.id===c.target&&target.hp>0),point=c.x===undefined?target:{x:c.x,y:c.y!,level:c.level??e.level};
 const validPoint=(range:number)=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=.5&&point.y>=.5&&point.x<=s.width-.5&&point.y<=s.height-.5&&dist(e,point)<=range&&visible(s,e.side,point);
 const nearby=(point:Vec,radius:number)=>s.entities.filter(target=>active(target)&&dist(target,point)<=radius);
 switch(ability){
  case 'iron-command':if(!validPoint(8))return false;for(const ally of nearby(point!,5))if(allied(s,e,ally))buff(s,ally,{damageFactor:1.25},8);break;
  case 'queen-step':if(!validPoint(7)||!fieldWalkable(s,point!))return false;e.x=point!.x;e.y=point!.y;e.path=[];e.order={type:'idle'};for(const ally of nearby(e,4))if(allied(s,e,ally))ally.hp=Math.min(ally.maxHp,ally.hp+35);break;
  case 'thane-ward':if(!target||!active(target)||!allied(s,e,target)||dist(e,target)>8||!visible(s,e.side,target))return false;target.hp=Math.min(target.maxHp,target.hp+80);buff(s,target,{armor:4},10);break;
  case 'soul-drain':if(!target||!active(target)||allied(s,e,target)||dist(e,target)>7||!visible(s,e.side,target))return false;hooks.damage(e,target,60);e.hp=Math.min(e.maxHp,e.hp+45);break;
  case 'admiral-wave':if(!validPoint(8))return false;for(const actor of nearby(point!,4))if(allied(s,e,actor))actor.hp=Math.min(actor.maxHp,actor.hp+50);else hooks.damage(e,actor,35);break;
  case 'prime-shield':if(!target||!active(target)||!allied(s,e,target)||!target.maxShield||dist(e,target)>8||!visible(s,e.side,target))return false;target.shield=target.maxShield;buff(s,target,{armor:4},10);break;
  case 'impact-fury':buff(s,e,{damageFactor:1.35},6);e.momentum=1;break;
  case 'forest-leap':if(!validPoint(5)||!fieldWalkable(s,point!))return false;e.x=point!.x;e.y=point!.y;e.path=[];break;
  case 'armored-brace':buff(s,e,{armor:5,speedFactor:.75},8);break;
  case 'terror':{let count=0;for(const hostile of nearby(e,4))if(!allied(s,e,hostile)&&hostile.role!=='siege'){buff(s,hostile,{fearedFrom:{x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level})}},3);count++;}if(!count)return false;break;}
  case 'wet-surge':if(!['mud','shallows'].includes(fieldTerrainAt(s,e)))return false;buff(s,e,{speedFactor:1.6,damageFactor:1.2},8);break;
  case 'shield-dash':if(!validPoint(4)||!fieldWalkable(s,point!)||(e.shield??0)<15)return false;e.shield!-=15;e.x=point!.x;e.y=point!.y;e.path=[];break;
  case 'incendiary-shell':if(s.players[e.side].wood<8||e.siegeMode?.prepared)return false;s.players[e.side].wood-=8;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='incendiary';break;
  case 'rooting-shell':if(s.players[e.side].crystal<6||e.siegeMode?.prepared)return false;s.players[e.side].crystal-=6;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='rooting';break;
  case 'ammunition-cannon':if(e.animation==='walk')return false;if(e.siegeMode&&!e.siegeMode.deployed&&e.siegeMode.ammo>0){e.siegeMode.deployed=true;e.order={type:'hold'};break;}if(s.players[e.side].ore<15||(e.siegeMode?.ammo??0)>5)return false;s.players[e.side].ore-=15;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.ammo+=5;e.siegeMode.deployed=true;e.order={type:'hold'};break;
  case 'corpse-shell':{if(e.siegeMode?.prepared)return false;const corpse=s.corpses.find(c=>c.expires>s.time&&dist(e,c)<=6&&visible(s,e.side,c));if(!corpse)return false;s.corpses=s.corpses.filter(c=>c.id!==corpse.id);e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='corpse';break;}
  case 'flood-shell':if(s.players[e.side].crystal<6||e.siegeMode?.prepared)return false;s.players[e.side].crystal-=6;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.prepared='flood';break;
  case 'powered-beam':if(s.players[e.side].crystal<8||(e.siegeMode?.ammo??0)>4)return false;s.players[e.side].crystal-=8;e.siegeMode??={ammo:0,deployed:false};e.siegeMode.ammo+=4;break;
 }
 e.abilityReadyAt=s.time+ABILITIES[ability].cooldown;s.events.push({type:'ability',side:e.side,x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level}),source:e.id,text:ABILITIES[ability].name,target:target?.id});return true;
}
export function prepareSiegeShot(s:GameState,e:Entity):SiegePayload|false|undefined {
 if(e.kind!=='unit'||e.role!=='siege')return undefined;const ability=unitFor(s,e).ability,mode=e.siegeMode;
 if(ability==='ammunition-cannon'){if(!mode?.deployed||mode.ammo<=0)return false;mode.ammo--;return {kind:'cannon',damageFactor:1.5,armorPiercing:false,radius:0};}
 if(ability==='powered-beam'){if(!mode||mode.ammo<=0)return false;mode.ammo--;return {kind:'beam',damageFactor:1,armorPiercing:true,radius:0};}
 const prepared=mode?.prepared;if(!prepared)return undefined;delete mode!.prepared;return {kind:prepared,damageFactor:prepared==='corpse'?1.4:1,armorPiercing:false,radius:prepared==='corpse'?2.5:2};
}
/** undefined follows the normal weapon path, false blocks an unloaded cannon. */
export function launchSpecialistShot(s:GameState,e:Entity,target:Entity,rawDamage:number):boolean|undefined {
 if(e.illusion)return undefined;const payload=prepareSiegeShot(s,e);if(payload===undefined)return undefined;if(payload===false)return false;
 const state=specialistState(s);state.nextShotId??=1;state.shots??=[];state.shots.push({id:state.nextShotId++,source:{id:e.id,side:e.side,definitionId:unitFor(s,e).id,faction:e.definitionFaction??s.players[e.side].faction,x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level})},target:{x:target.x,y:target.y,...(target.level===undefined?{}:{level:target.level})},rawDamage,buildingMultiplier:unitFor(s,e).buildingDamageMultiplier??1,payload,impactAt:s.time+.25+dist(e,target)/12});
 s.events.push({type:'ability',side:e.side,x:e.x,y:e.y,...(e.level===undefined?{}:{level:e.level}),source:e.id,target:target.id,text:'Specialist siege shot launched.'});return true;
}
export function resolveSpecialistShots(s:GameState,hooks:SpecialistHooks):void {
 const state=s.specialists;if(!state?.shots)return;const pending:NonNullable<typeof state.shots>=[];
 const friendlyFire=(s as GameState & {rules?:{friendlyFire?:boolean};friendlyFire?:boolean}).rules?.friendlyFire??(s as GameState & {friendlyFire?:boolean}).friendlyFire??true;
 for(const shot of state.shots){if(shot.impactAt>s.time){pending.push(shot);continue;}
  const radius=shot.payload.radius;
  for(const actor of s.entities){if(actor.hp<=0||dist(actor,shot.target)>(radius||.75)+(actor.kind==='building'?buildingFor(s,actor).size/2:0)||!friendlyFire&&allied(s,shot.source,actor))continue;
   const falloff=radius?1-.4*Math.min(1,dist(actor,shot.target)/radius):1;
   hooks.damage(shot.source,actor,shot.rawDamage*shot.payload.damageFactor*(actor.kind==='building'?shot.buildingMultiplier:1)*falloff,{armorPiercing:shot.payload.armorPiercing,ranged:true});
   if(!active(actor))continue;
   if(shot.payload.kind==='rooting')buff(s,actor,{rooted:true},4);else if(shot.payload.kind==='flood')buff(s,actor,{speedFactor:.5},6);else if(shot.payload.kind==='incendiary'){actor.burning??=[];if(actor.burning.length>=64)actor.burning.shift();actor.burning.push({source:shot.source.id,side:shot.source.side,origin:{x:shot.source.x,y:shot.source.y,...(shot.source.level===undefined?{}:{level:shot.source.level})},until:s.time+6,nextAt:s.time+1,damage:5});}
  }
  s.events.push({type:'ability',side:shot.source.side,x:shot.target.x,y:shot.target.y,...(shot.target.level===undefined?{}:{level:shot.target.level}),source:shot.source.id,text:`${shot.payload.kind} impact.`});
 }
 state.shots=pending;
}
function fieldWalkable(s:GameState,point:Vec):boolean {return walkable(s,point.x,point.y,point.level??0);}
function fieldTerrainAt(s:GameState,point:Vec):TerrainKind {return terrainAt(s,point.x,point.y,point.level??0);}
function fieldSetTerrain(s:GameState,point:Vec,kind:TerrainKind,hooks:SpecialistHooks):boolean {if(hooks.setTerrain)return hooks.setTerrain(point,kind);if((point.level??0)!==0)return false;const index=Math.floor(point.y)*s.width+Math.floor(point.x);if(index<0||index>=s.terrain.length)return false;s.terrain[index]=kind;for(const e of s.entities)e.path=[];return true;}
export function engineerBuild(s:GameState,side:Side,c:Extract<Command,{type:'engineerBuild'}>,hooks:SpecialistHooks):boolean {
 const engineers=s.entities.filter(e=>e.side===side&&c.ids.includes(e.id)&&active(e)&&unitFor(s,e).tags?.includes('engineer')),point={x:Math.floor(c.x)+.5,y:Math.floor(c.y)+.5,...(c.level===undefined?{}:{level:c.level})};
 if(!Number.isFinite(c.x)||!Number.isFinite(c.y)||!engineers.some(e=>dist(e,point)<=4)||!visible(s,side,point))return false;
 const player=s.players[side],cost=c.kind==='bridge'?{wood:60,ore:0}:{wood:35,ore:15};if(player.wood<cost.wood||player.ore<cost.ore)return false;
 const state=specialistState(s);
 if(c.kind==='bridge'){
  const tiles=[-1,0,1].map(dx=>({...point,x:point.x+dx})),world=(s as GameState & {world?:{bridges?:Array<{level:number;tiles:number[]}>}}).world;if(world?.bridges?.some(bridge=>bridge.level===(point.level??0)&&bridge.tiles.some(tile=>tiles.some(p=>Math.floor(p.y)*s.width+Math.floor(p.x)===tile))))return false;if(tiles.some(tile=>tile.x<.5||tile.x>s.width-.5||tile.y<.5||tile.y>s.height-.5)||!tiles.some(tile=>fieldTerrainAt(s,tile)==='water')||tiles.some(tile=>!['water','shallows','grass','road'].includes(fieldTerrainAt(s,tile))||!visible(s,side,tile)||state.structures.some(item=>item.expires>s.time&&item.tiles?.some(prior=>dist(prior,tile)<.1))))return false;
  const saved=tiles.map(tile=>({...tile,previous:fieldTerrainAt(s,tile),placed:'bridge'}));const installed:typeof saved=[];
  for(const tile of saved){if(!fieldSetTerrain(s,tile,'bridge',hooks)){for(const prior of installed)fieldSetTerrain(s,prior,prior.previous as TerrainKind,hooks);return false;}if(hooks.terrainRevision)(tile as typeof tile & {stamp?:number}).stamp=hooks.terrainRevision(tile);installed.push(tile);}
  state.structures.push({id:state.nextStructureId++,kind:'bridge',owner:side,expires:s.time+60,tiles:saved});
 }else{
  if(point.x<.5||point.y<.5||point.x>s.width-.5||point.y>s.height-.5||!fieldWalkable(s,point)||s.entities.some(e=>e.hp>0&&dist(e,point)<1))return false;
  const barricade=hooks.spawn(side,'building','core:field-barricade',point.x,point.y,1,point.level);state.structures.push({id:state.nextStructureId++,kind:'barricade',owner:side,expires:s.time+60,entityId:barricade.id});
 }
 player.wood-=cost.wood;player.ore-=cost.ore;s.events.push({type:'build',side,x:point.x,y:point.y,...(point.level===undefined?{}:{level:point.level}),text:`Temporary ${c.kind}: expires in 60 seconds.`});return true;
}
export function fieldRepair(s:GameState,side:Side,id:number,targetId:number):boolean {
 const engineer=s.entities.find(e=>e.id===id&&e.side===side&&active(e)&&unitFor(s,e).tags?.includes('engineer')),target=s.entities.find(e=>e.id===targetId&&e.hp>0&&s.teams[e.side]===s.teams[side]);
 if(!engineer||!target||target.kind!=='building'&&target.role!=='siege'||target.hp>=target.maxHp||dist(engineer,target)>4||!visible(s,side,target))return false;
 const p=s.players[side],amount=Math.min(60,target.maxHp-target.hp),ore=Math.ceil(amount/10);if(p.ore<ore)return false;p.ore-=ore;target.hp+=amount;s.events.push({type:'ability',side,x:target.x,y:target.y,...(target.level===undefined?{}:{level:target.level}),source:engineer.id,target:target.id,text:`Field repair: ${amount} health for ${ore} ore.`});return true;
}
export function updateBeacons(s:GameState,alerts=true):void {
 const beacons=s.entities.filter(e=>e.kind==='building'&&e.hp>0&&e.progress===1&&buildingFor(s,e).tags?.includes('beacon')),connected=new Set<number>(),sources=s.entities.filter(e=>e.kind==='building'&&e.hp>0&&e.progress===1&&(e.role==='hq'||e.role==='depot')&&!buildingFor(s,e).tags?.includes('beacon'));
 for(let changed=true;changed;){changed=false;for(const beacon of beacons)if(!connected.has(beacon.id)&&[...sources,...beacons.filter(b=>connected.has(b.id))].some(source=>s.teams[source.side]===s.teams[beacon.side]&&dist(source,beacon)<=12)){connected.add(beacon.id);changed=true;}}
 for(const beacon of beacons){beacon.beacon??={connected:false,nextAlertAt:0};beacon.beacon.connected=connected.has(beacon.id);if(!alerts||!beacon.beacon.connected||s.time<beacon.beacon.nextAlertAt)continue;const intruder=s.entities.find(e=>e.hp>0&&s.teams[e.side]!==s.teams[beacon.side]&&dist(e,beacon)<=buildingFor(s,beacon).sight&&visible(s,beacon.side,e));if(intruder){s.events.push({type:'message',side:beacon.side,x:intruder.x,y:intruder.y,...(intruder.level===undefined?{}:{level:intruder.level}),source:beacon.id,target:intruder.id,text:'Beacon invasion alert.'});beacon.beacon.nextAlertAt=s.time+8;}}
}
export function stepSpecialists(s:GameState,hooks:SpecialistHooks):void {
 for(const e of s.entities){if(e.specialistBuffs)e.specialistBuffs=e.specialistBuffs.filter(buff=>buff.until>s.time);
  for(const fire of e.burning??[]){if(fire.until>s.time&&fire.nextAt<=s.time&&e.hp>0){const liveSource=s.entities.find(e=>e.id===fire.source&&e.side===fire.side),source=liveSource??{id:fire.source,side:fire.side,definitionId:'',faction:s.players[fire.side].faction,x:fire.origin?.x??e.x,y:fire.origin?.y??e.y,...((fire.origin?.level??e.level)===undefined?{}:{level:fire.origin?.level??e.level})};hooks.damage(source,e,fire.damage,{armorPiercing:true});fire.nextAt=s.time+1;}}
  if(e.burning)e.burning=e.burning.filter(fire=>fire.until>s.time);
 }
 const state=s.specialists;if(!state)return;
 for(const item of [...state.structures]){
  const entity=item.entityId===undefined?undefined:s.entities.find(e=>e.id===item.entityId);
  if(item.entityId!==undefined&&(!entity||entity.hp<=0)){state.structures=state.structures.filter(current=>current.id!==item.id);continue;}
  if(item.expires>s.time)continue;
  if(entity){entity.expires=s.time;}
  const restored:Vec[]=[];
  for(const tile of item.tiles??[])if(fieldTerrainAt(s,tile)===tile.placed&&(tile.stamp===undefined||!hooks.terrainRevision||hooks.terrainRevision(tile)===tile.stamp)&&fieldSetTerrain(s,tile,tile.previous as TerrainKind,hooks))restored.push(tile);
  for(const actor of s.entities)if(active(actor)&&restored.some(tile=>sameLevel(actor,tile)&&Math.abs(actor.x-tile.x)<.77&&Math.abs(actor.y-tile.y)<.77)&&!fieldWalkable(s,actor)){
   let shore:Vec|undefined;for(let ring=.5;ring<=8&&!shore;ring+=.5)for(const [dx,dy] of DIRECTIONS_32){const candidate={x:actor.x+dx*ring,y:actor.y+dy*ring,level:actor.level};if(fieldWalkable(s,candidate)){shore=candidate;break;}}
   if(shore){actor.x=shore.x;actor.y=shore.y;actor.path=[];actor.order={type:'idle'};delete actor.orderQueue;s.events.push({type:'message',side:actor.side,x:actor.x,y:actor.y,...(actor.level===undefined?{}:{level:actor.level}),source:actor.id,text:'Temporary bridge expired; moved to nearby shore.'});}
  }
  state.structures=state.structures.filter(current=>current.id!==item.id);
 }
}

/** The AI uses the same observed targets and paid commands as the player. */
export function runSpecialistAI(s:GameState,side:Side,issue:(command:Command)=>boolean):void {
 const actors=s.entities.filter(e=>e.side===side&&active(e)),hostiles=s.entities.filter(e=>e.hp>0&&!allied(s,{side},e)&&visible(s,side,e));
 for(const actor of actors){
  if(actor.veteran?.pendingPromotion){const choices=importPromotionChoices(s,actor);if(choices.length)issue({type:'promote',id:actor.id,promotion:choices[0]});}
  if(unitFor(s,actor).tags?.includes('engineer')){const damaged=s.entities.find(e=>e.hp>0&&allied(s,actor,e)&&(e.kind==='building'||e.role==='siege')&&e.hp<e.maxHp&&dist(actor,e)<=4&&visible(s,side,e));if(damaged)issue({type:'fieldRepair',id:actor.id,target:damaged.id});}
  const enemy=hostiles.filter(e=>dist(actor,e)<=(actor.role==='siege'?unitFor(s,actor).range+2:8)).sort((a,b)=>dist(actor,a)-dist(actor,b)||a.id-b.id)[0],ability=unitFor(s,actor).ability;
  if(!enemy||!allAbilities.has(ability as SpecialistAbility)||(actor.abilityReadyAt??0)>s.time)continue;
  const ally=actors.filter(e=>dist(actor,e)<=8).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];
  if(ability==='soul-drain'||ability==='admiral-wave')issue({type:'ability',ids:[actor.id],target:enemy.id});
  else if(ability==='thane-ward')issue({type:'ability',ids:[actor.id],target:ally.id});
  else if(ability==='prime-shield'){const machine=actors.find(e=>e.maxShield&&dist(actor,e)<=8&&(e.shield??0)<e.maxShield);if(machine)issue({type:'ability',ids:[actor.id],target:machine.id});}
  else if(ability==='iron-command'||ability==='queen-step')issue({type:'ability',ids:[actor.id],x:actor.x,y:actor.y,...(actor.level===undefined?{}:{level:actor.level})});
  else if(ability==='forest-leap'||ability==='shield-dash'){const length=dist(actor,enemy),travel=Math.min(length-1,ability==='forest-leap'?4:3);if(travel>0)issue({type:'ability',ids:[actor.id],x:actor.x+(enemy.x-actor.x)/length*travel,y:actor.y+(enemy.y-actor.y)/length*travel,...(actor.level===undefined?{}:{level:actor.level})});}
  else issue({type:'ability',ids:[actor.id]});
 }
}
