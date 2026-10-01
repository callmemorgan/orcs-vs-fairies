import { length2D, DIRECTIONS_32 } from './geometry';
import { unitFor, upgradeFor } from './content-registry';
import { upgradeAppliesTo } from './progression';
import { fogKey, sameLevel, terrainLineOfSight } from './world-map';
import type { Cost, Entity, GameState, Side, UnitRole, Vec } from './types';
import type { NeutralCreature, WorldCommand, WorldPoint, WorldSite, WorldState } from './world-types';

type WorldGame = GameState & { world?:WorldState };
type NeutralOrder = { type:'worldAttack'|'captureSite'|'supportVillage'|'recruitVillage'; target:number };
export interface NeutralWorldHooks {
 move(actor:Entity|NeutralCreature,target:WorldPoint,dt:number,reach:number):boolean;
 spawn(side:Side,role:UnitRole,x:number,y:number,level:number):Entity|undefined;
 attack?:(source:Entity,target:NeutralCreature)=>void;
 hit(source:Entity|NeutralCreature,target:Entity|NeutralCreature,amount:number):void;
 attackStats?(entity:Entity):{damage:number;range:number;cooldown:number};
 recruitCost?(side:Side,role:UnitRole):Cost;
 lineOfSight?(from:WorldPoint,to:WorldPoint):boolean;
}

export const NEUTRAL_RULES = {
 captureSeconds:10, captureRadius:2.4, relicRadius:8, relicDamageBonus:.12,
 servicesLoyalty:60, supportLoyalty:60, raidLoyaltyLoss:30,
 monsterRespawnSeconds:90, defenderRespawnSeconds:45,
 supplyBundle:{wood:40,ore:30,crystal:10}, raidBundle:{wood:20,ore:15,crystal:5},
} as const;
const resources = ['wood','ore','crystal'] as const;
const orderKinds = ['worldAttack','captureSite','supportVillage','recruitVillage'];
const point = (p:Vec & {level?:number}):WorldPoint => ({x:p.x,y:p.y,level:p.level??0});
const distance = (a:Vec,b:Vec) => length2D(a.x-b.x,a.y-b.y);
const allied = (s:GameState,a:Side,b:Side) => !!s.players[a]&&!!s.players[b]&&s.teams[a]===s.teams[b];
const eligible = (e:Entity) => e.hp>0&&e.kind==='unit'&&!e.illusion;
const worldOrder = (e:Entity) => e.order as unknown as NeutralOrder;
function stop(e:Entity) { e.order={type:'idle'};e.path=[]; }
function visible(s:GameState,side:Side,p:WorldPoint) {
 return p.x>=0&&p.y>=0&&p.x<s.width&&p.y<s.height&&!!s.visible[side]?.has(fogKey(s,p));
}
function message(s:GameState,side:Side,at:WorldPoint,text:string) {
 s.events.push({type:'message',side,x:at.x,y:at.y,text,...{level:at.level}});
}
function transfer(from:Cost,to:Cost,amount:Cost) {
 for(const kind of resources){from[kind]-=amount[kind];to[kind]+=amount[kind];}
}
function boundedStock(stock:Cost,limit:Cost):Cost {
 return {wood:Math.min(stock.wood,limit.wood),ore:Math.min(stock.ore,limit.ore),crystal:Math.min(stock.crystal,limit.crystal)};
}
function affordable(stock:Cost,cost:Cost) { return resources.every(kind=>stock[kind]>=cost[kind]); }
function nonempty(stock:Cost) { return resources.some(kind=>stock[kind]>0); }
function services(site:WorldSite,side:Side) {
 return site.kind==='village'&&site.owner===side&&site.loyalty[side]>=NEUTRAL_RULES.servicesLoyalty&&site.supplied;
}
function updateVillageOwner(site:WorldSite) {
 const candidates=site.loyalty.flatMap((loyalty,side)=>loyalty>=NEUTRAL_RULES.servicesLoyalty?[side as Side]:[]);
 candidates.sort((a,b)=>site.loyalty[b]-site.loyalty[a]||(a===site.owner?-1:b===site.owner?1:a-b));
 site.owner=candidates[0]??null;
}
function creatureProfile(site:WorldSite) {
 return site.kind==='monster'?{hp:110,damage:10,range:1.4,cooldown:1.3,sight:6,leash:8}
  :{hp:140,damage:12,range:1.5,cooldown:1.15,sight:5,leash:6};
}
function addCreature(s:WorldGame,site:WorldSite,index:number):NeutralCreature {
 const stats=creatureProfile(site),offset=index===0?-.9:.9;
 const creature:NeutralCreature={id:s.nextId++,site:site.id,x:site.x+offset,y:site.y+.8,level:site.level,
  hp:stats.hp,maxHp:stats.hp,cooldown:0,target:null,path:[],patrol:index*4,respawnAt:0};
 s.world!.creatures.push(creature);site.creatureIds.push(creature.id);return creature;
}

/** Called once for a newly constructed world, never while restoring a checkpoint. */
export function initializeWorldSites(s:WorldGame):void {
 if(!s.world)return;
 for(const site of s.world.sites){
  if(site.kind==='relic'||site.creatureIds.length)continue;
  for(let i=0;i<(site.kind==='monster'?2:1);i++)addCreature(s,site,i);
 }
}

function validTarget(s:WorldGame,side:Side,c:NeutralOrder) {
 const world=s.world;if(!world)return false;
 const site=world.sites.find(site=>site.id===c.target),creature=world.creatures.find(creature=>creature.id===c.target);
 if(c.type==='worldAttack'){
  if(creature){const den=world.sites.find(site=>site.id===creature.site);return creature.hp>0&&!!den&&visible(s,side,creature)&&!(den.owner!==null&&allied(s,side,den.owner));}
  return !!site&&site.kind!=='relic'&&visible(s,side,site)&&!(site.owner!==null&&allied(s,side,site.owner))
   &&(world.creatures.some(creature=>creature.site===site.id&&creature.hp>0)||site.kind==='village'&&nonempty(site.reward));
 }
 if(!site||!visible(s,side,site))return false;
 if(c.type==='captureSite')return site.kind==='relic'&&!(site.owner!==null&&allied(s,side,site.owner));
 if(c.type==='supportVillage')return site.kind==='village'&&(!services(site,side)
  ?nonempty(site.request)&&affordable(s.players[side],site.request)
  :!site.rewarded.includes(side)&&nonempty(site.reward));
 return c.type==='recruitVillage'&&services(site,side)&&s.players[side].population<s.players[side].cap
  &&affordable(site.reward,unitFor(s,side,'melee').cost);
}

/** Undefined means another world command handler owns this command. */
export function issueNeutralWorldCommand(s:WorldGame,side:Side,command:WorldCommand):boolean|undefined {
 if(!orderKinds.includes(command.type))return undefined;
 if(!s.world||!s.players[side]||s.eliminated[side]||s.winner!==null||s.draw)return false;
 const c=command as NeutralOrder & {ids:number[]};
 if(!Number.isSafeInteger(c.target)||c.target<1||!Array.isArray(c.ids)||!c.ids.length||c.ids.length>8192||new Set(c.ids).size!==c.ids.length)return false;
 const units=c.ids.map(id=>s.entities.find(e=>e.id===id));
 if(units.some(e=>!e||e.side!==side||!eligible(e))||!validTarget(s,side,c))return false;
 const at=s.world.sites.find(site=>site.id===c.target)??s.world.creatures.find(creature=>creature.id===c.target)!;
 if(units.some(e=>!sameLevel(e!,at)))return false;
 // Deliveries and recruitment are one transaction even when a squad is selected.
 const assigned=c.type==='supportVillage'||c.type==='recruitVillage'?[units[0]!]:units as Entity[];
 for(const e of assigned){e.order={type:c.type,target:c.target} as unknown as Entity['order'];delete e.orderQueue;e.path=[];}
 return true;
}

function attackStats(s:GameState,e:Entity,hooks:NeutralWorldHooks) {
 if(hooks.attackStats)return hooks.attackStats(e);
 const def=unitFor(s,e);
 let damage=def.damage;
 for(const id of s.players[e.side].upgrades){const upgrade=upgradeFor(s,e.side,id);if(upgradeAppliesTo(upgrade,def))damage*=upgrade.effects.damage??1;}
 return {damage,range:def.range,cooldown:def.cooldown};
}
export function defeatCreature(s:WorldGame,creature:NeutralCreature,side:Side) {
 const site=s.world!.sites.find(site=>site.id===creature.site);if(!site||creature.respawnAt>0)return;
 creature.hp=0;creature.target=null;creature.path=[];
 creature.respawnAt=s.time+(site.kind==='monster'?NEUTRAL_RULES.monsterRespawnSeconds:NEUTRAL_RULES.defenderRespawnSeconds);
 site.respawnAt=Math.max(site.respawnAt,creature.respawnAt);
 if(site.kind==='village'){
  if(site.owner!==null){site.loyalty[site.owner]=Math.max(0,site.loyalty[site.owner]-NEUTRAL_RULES.raidLoyaltyLoss);updateVillageOwner(site);}
  return;
 }
 if(site.rewarded.length||s.world!.creatures.some(other=>other.site===site.id&&other.hp>0))return;
 const reward={...site.reward};transfer(site.reward,s.players[side],reward);site.rewarded.push(side);
 message(s,side,site,`Monster den cleared: ${reward.wood} wood, ${reward.ore} ore, ${reward.crystal} crystal. Its creatures return in ${NEUTRAL_RULES.monsterRespawnSeconds}s; the reward is claimed.`);
}

/** The simulation calls this before its ordinary order branches. */
export function processNeutralOrder(s:WorldGame,e:Entity,dt:number,hooks:NeutralWorldHooks):boolean {
 if(!orderKinds.includes(e.order.type))return false;
 const order=worldOrder(e),world=s.world;
 if(!world||!eligible(e)||!s.players[e.side]){stop(e);return true;}
 const site=world.sites.find(site=>site.id===order.target);
 if(order.type==='worldAttack'){
  let target=world.creatures.find(creature=>creature.id===order.target&&creature.hp>0);
  if(!target&&site)target=world.creatures.filter(creature=>creature.site===site.id&&creature.hp>0).sort((a,b)=>distance(e,a)-distance(e,b)||a.id-b.id)[0];
  const targetSite=site??world.sites.find(site=>site.id===target?.site);
  if(!targetSite||!sameLevel(e,targetSite)||targetSite.kind==='relic'||targetSite.owner!==null&&allied(s,e.side,targetSite.owner)){stop(e);return true;}
  const at=target??targetSite,stats=attackStats(s,e,hooks);
  if(!visible(s,e.side,at)){stop(e);return true;}
  if(distance(e,at)>stats.range){hooks.move(e,point(at),dt,stats.range);return true;}
  if(!(hooks.lineOfSight?.(point(e),point(at))??terrainLineOfSight(s,e,at))){hooks.move(e,point(at),dt,.8);return true;}
  if(e.cooldown>0)return true;
  if(target&&hooks.attack){hooks.attack(e,target);return true;}
  e.cooldown=stats.cooldown;e.animation='attack';e.animTime=0;
  if(target){hooks.hit(e,target,stats.damage);if(target.hp<=0)defeatCreature(s,target,e.side);}
  else if(targetSite.kind==='village'){
   if(targetSite.owner!==null)targetSite.loyalty[targetSite.owner]=Math.max(0,targetSite.loyalty[targetSite.owner]-NEUTRAL_RULES.raidLoyaltyLoss);
   targetSite.loyalty[e.side]=Math.max(0,targetSite.loyalty[e.side]-NEUTRAL_RULES.raidLoyaltyLoss);
   const stolen=boundedStock(targetSite.reward,NEUTRAL_RULES.raidBundle);transfer(targetSite.reward,s.players[e.side],stolen);
   updateVillageOwner(targetSite);message(s,e.side,targetSite,`Village raided: ${stolen.wood} wood, ${stolen.ore} ore, ${stolen.crystal} crystal. Loyalty fell.`);
   if(!nonempty(targetSite.reward))stop(e);
  }else stop(e);
  return true;
 }
 if(!site||!sameLevel(e,site)){stop(e);return true;}
 if(order.type==='captureSite'){
  if(site.kind!=='relic'||site.owner!==null&&allied(s,e.side,site.owner)){stop(e);return true;}
  if(!terrainLineOfSight(s,e,site))hooks.move(e,point(site),dt,.8);
  else if(distance(e,site)>NEUTRAL_RULES.captureRadius)hooks.move(e,point(site),dt,NEUTRAL_RULES.captureRadius-.2);
  return true;
 }
 if(!validTarget(s,e.side,order)){stop(e);return true;}
 if(!terrainLineOfSight(s,e,site)){hooks.move(e,point(site),dt,.8);return true;}
 if(distance(e,site)>2.3){hooks.move(e,point(site),dt,2.1);return true;}
 if(order.type==='supportVillage'){
  if(services(site,e.side)){
   const supplied=boundedStock(site.reward,NEUTRAL_RULES.supplyBundle);transfer(site.reward,s.players[e.side],supplied);site.rewarded.push(e.side);
   message(s,e.side,site,`Village supplies delivered: ${supplied.wood} wood, ${supplied.ore} ore, ${supplied.crystal} crystal.`);
  }else{
   transfer(s.players[e.side],site.reward,site.request);site.loyalty[e.side]=Math.min(100,site.loyalty[e.side]+NEUTRAL_RULES.supportLoyalty);site.supplied=true;updateVillageOwner(site);
   message(s,e.side,site,'Village request delivered. Loyalty increased; local supplies and defenders are available at 60 loyalty.');
  }
 }else{
  const cost=hooks.recruitCost?.(e.side,'melee')??unitFor(s,e.side,'melee').cost;
  if(affordable(site.reward,cost)&&s.players[e.side].population<s.players[e.side].cap){
   const recruit=hooks.spawn(e.side,'melee',site.x+1.7,site.y,site.level);
   if(recruit){for(const kind of resources)site.reward[kind]-=cost[kind];s.players[e.side].population++;
    message(s,e.side,site,'A local defender joined your army. Its equipment was paid from the village stock.');}
  }
 }
 stop(e);return true;
}

function creatureCanTarget(s:WorldGame,creature:NeutralCreature,site:WorldSite,e:Entity,hooks:NeutralWorldHooks) {
 const stats=creatureProfile(site);
 if(e.hp<=0||e.illusion||!sameLevel(creature,e)||distance(creature,e)>stats.sight||distance(site,e)>stats.leash)return false;
 if(!(hooks.lineOfSight?.(point(creature),point(e))??terrainLineOfSight(s,creature,e)))return false;
 if(site.kind==='monster')return true;
 if(site.owner!==null)return !allied(s,site.owner,e.side);
 const order=worldOrder(e);
 return order.type==='worldAttack'&&(order.target===site.id||site.creatureIds.includes(order.target));
}
function stepCaptures(s:WorldGame,dt:number) {
 for(const site of s.world!.sites){
  if(site.kind!=='relic')continue;
  const nearby=s.entities.filter(e=>eligible(e)&&sameLevel(e,site)&&distance(e,site)<=NEUTRAL_RULES.captureRadius&&terrainLineOfSight(s,e,site));
  const channels=nearby.filter(e=>worldOrder(e).type==='captureSite'&&worldOrder(e).target===site.id);
  const teams=new Set(nearby.map(e=>s.teams[e.side]));
  if(!channels.length||teams.size!==1){site.progress=0;site.capturing=null;continue;}
  const side=channels.reduce((a,e)=>e.side<a?e.side:a,channels[0].side);
  if(site.owner!==null&&allied(s,side,site.owner)){site.progress=0;site.capturing=null;continue;}
  if(site.capturing===null||!allied(s,site.capturing,side)){site.progress=0;site.capturing=side;}
  site.progress=Math.min(1,site.progress+dt/NEUTRAL_RULES.captureSeconds);
  if(site.progress+1e-9>=1){site.owner=site.capturing;site.progress=0;site.capturing=null;
   message(s,side,site,`Relic secured. Allied troops within ${NEUTRAL_RULES.relicRadius} tiles gain ${NEUTRAL_RULES.relicDamageBonus*100}% damage until the site is lost.`);}
 }
}

/** Creature decisions use their own local sight and leash, never player fog or distant armies. */
export function stepNeutralWorld(s:WorldGame,dt:number,hooks:NeutralWorldHooks):void {
 if(!s.world||!Number.isFinite(dt)||dt<=0)return;
 for(const creature of s.world.creatures){
  const site=s.world.sites.find(site=>site.id===creature.site);if(!site)continue;
  const stats=creatureProfile(site);
  if(creature.hp<=0){
   if(creature.respawnAt===0)creature.respawnAt=s.time+(site.kind==='monster'?NEUTRAL_RULES.monsterRespawnSeconds:NEUTRAL_RULES.defenderRespawnSeconds);
   if(creature.respawnAt>0&&s.time>=creature.respawnAt){creature.hp=creature.maxHp;creature.x=site.x;creature.y=site.y+.8;creature.cooldown=0;creature.respawnAt=0;creature.target=null;creature.path=[];}
   else continue;
  }
  creature.cooldown=Math.max(0,creature.cooldown-dt);
  const previous=s.entities.find(e=>e.id===creature.target);
  const target=previous&&creatureCanTarget(s,creature,site,previous,hooks)?previous:
   s.entities.filter(e=>creatureCanTarget(s,creature,site,e,hooks)).sort((a,b)=>distance(creature,a)-distance(creature,b)||a.id-b.id)[0];
  creature.target=target?.id??null;
  if(target){
   if(distance(creature,target)<=stats.range){if(creature.cooldown===0){hooks.hit(creature,target,stats.damage);creature.cooldown=stats.cooldown;}}
   else hooks.move(creature,point(target),dt,stats.range);
  }else{
   const [dx,dy]=DIRECTIONS_32[(creature.patrol%8)*4],to={x:site.x+dx*1.6,y:site.y+dy*1.6,level:site.level};
   if(hooks.move(creature,to,dt,.25))creature.patrol=(creature.patrol+1)%8;
  }
 }
 for(const site of s.world.sites)if(site.creatureIds.length&&s.world.creatures.every(creature=>creature.site!==site.id||creature.hp>0))site.respawnAt=0;
 stepCaptures(s,dt);
}

/** Add this fraction to ordinary weapon damage; ownership and distance are read each hit. */
export function relicBonus(s:WorldGame,side:Side,at:Vec & {level?:number}):number {
 return s.world?.sites.reduce((bonus,site)=>bonus+(site.kind==='relic'&&site.owner!==null&&allied(s,side,site.owner)&&sameLevel(at,site)&&distance(at,site)<=NEUTRAL_RULES.relicRadius?NEUTRAL_RULES.relicDamageBonus:0),0)??0;
}

/** Used by filtered world observations; creature targets and paths are never disclosed. */
export function observeNeutralWorld(s:WorldGame,side:Side) {
 return {
  sites:s.world?.sites.filter(site=>visible(s,side,site)).map(site=>({id:site.id,kind:site.kind,x:site.x,y:site.y,level:site.level,
   owner:site.owner,loyalty:site.loyalty[side],progress:site.progress,capturing:site.capturing,
   stock:{...site.reward},request:{...site.request},supplied:site.supplied,rewardClaimed:site.kind==='monster'?site.rewarded.length>0:site.rewarded.includes(side),respawnAt:site.respawnAt}))??[],
  creatures:s.world?.creatures.filter(creature=>creature.hp>0&&visible(s,side,creature)).map(creature=>({id:creature.id,site:creature.site,
   x:creature.x,y:creature.y,level:creature.level,hp:creature.hp,maxHp:creature.maxHp}))??[],
 };
}
