import { burnEconomyAt } from './economy';
import { length2D, DIRECTIONS_32 } from './geometry';
import { buildingFor, unitFor } from './content-registry';
import { setWorldTerrain } from './world-map';
import type { Entity, GameState, Side, TerrainKind, Vec } from './types';
import type { WorldCommand, WorldFire, WorldState } from './world-types';

type WorldGame = GameState & { world?:WorldState };
type Positioned = Vec & { level?:number };
export interface EnvironmentHooks { interrupt(actor:Entity):void; die?:(actor:Entity,text:string)=>void }
export interface EnvironmentPhase {
 day:'day'|'dusk'|'night'|'dawn'; season:'spring'|'summer'|'autumn'|'winter';
 weather:'clear'|'rain'|'fog'|'wind'; wind:Vec;
 dayProgress:number; seasonProgress:number; weatherEndsAt:number; thawIn:number|null;
}
export const ENVIRONMENT_RULES = {
 igniteWood:15, igniteOre:5, firebreakWood:5, workerReach:1.8,
 fireDamage:12, buildingFireDamage:8, woodBurnRate:18, fireLifetime:45,
 thawWarning:20, evacuationRadius:6, evacuationInjury:.25,
} as const;
const levelOf = (p:Positioned) => p.level??0;
const tileOf = (s:GameState,p:Vec) => Math.floor(p.y)*s.width+Math.floor(p.x);
const length = (n:number,fallback:number) => Number.isFinite(n)&&n>0?n:fallback;
const hash = (seed:number,a:number,b=0,c=0) => {
 let n=(seed^Math.imul(a+1,0x9e3779b1)^Math.imul(b+1,0x85ebca6b)^Math.imul(c+1,0xc2b2ae35))>>>0;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
};

/** All calendar and weather reads are pure; rendering cannot consume simulation randomness. */
export function environmentPhase(s:GameState):EnvironmentPhase {
 const world=(s as WorldGame).world;
 if(!world)return {day:'day',season:'spring',weather:'clear',wind:{x:0,y:0},dayProgress:0,seasonProgress:0,weatherEndsAt:Infinity,thawIn:null};
 const time=Math.max(0,s.time),dayLength=length(world.dayLength,240),seasonLength=length(world.seasonLength,300),weatherLength=length(world.weatherLength,70);
 const dayProgress=(time%dayLength)/dayLength;
 const day=dayProgress<.55?'day':dayProgress<.65?'dusk':dayProgress<.9?'night':'dawn';
 const seasonIndex=(Math.floor(time/seasonLength)+(world.biome==='snow'?3:0))%4;
 const season=(['spring','summer','autumn','winter'] as const)[seasonIndex],seasonProgress=(time%seasonLength)/seasonLength;
 const weatherIndex=Math.floor(time/weatherLength),roll=hash(s.seed,weatherIndex,21);
 const weather=roll<.4?'clear':roll<.62?'rain':roll<.8?'fog':'wind';
 // Saved seed and weather index select one fixed direction for the whole weather interval.
 const [windX,windY]=DIRECTIONS_32[Math.floor(hash(s.seed,weatherIndex,22)*DIRECTIONS_32.length)],strength=weather==='wind'?1:0;
 return {day,season,weather,wind:{x:windX*strength,y:windY*strength},dayProgress,seasonProgress,weatherEndsAt:(weatherIndex+1)*weatherLength,thawIn:season==='winter'?(1-seasonProgress)*seasonLength:null};
}

export function environmentalSightFactor(s:GameState,entity?:Entity):number {
 if(!(s as WorldGame).world||entity&&levelOf(entity)>0)return 1;
 const {day,weather}=environmentPhase(s);
 let light=day==='night'?.6:day==='day'?1:.8;
 if(entity&&entity.kind==='unit'&&s.players[entity.side]){
  const faction=s.players[entity.side].faction;
  if(day==='night'&&faction==='undead')light=1;
  else if(day==='night'&&faction==='tideborn'&&entity.role==='special')light=.9;
  // Buildings retain the ordinary night penalty.
 }
 return light*(weather==='fog'?.65:weather==='rain'?.9:1);
}

export function environmentalMovementFactor(s:GameState,entity?:Entity):number {
 if(!(s as WorldGame).world||entity&&levelOf(entity)>0)return 1;
 const phase=environmentPhase(s);
 if(phase.weather!=='rain')return 1;
 return entity&&s.players[entity.side]?.faction==='tideborn'?.95:.85;
}

export function projectileEnvironment(s:GameState,from:Positioned,to:Positioned):{damageFactor:number;rangeFactor:number;drift:Vec} {
 if(!(s as WorldGame).world||levelOf(from)>0||levelOf(to)>0)return {damageFactor:1,rangeFactor:1,drift:{x:0,y:0}};
 const {weather,wind}=environmentPhase(s),dx=to.x-from.x,dy=to.y-from.y,d=length2D(dx,dy);
 if(weather==='rain')return {damageFactor:.9,rangeFactor:.9,drift:{x:0,y:0}};
 if(weather!=='wind'||d===0)return {damageFactor:1,rangeFactor:1,drift:{x:0,y:0}};
 const along=(wind.x*dx+wind.y*dy)/d,cross=Math.abs(wind.x*dy-wind.y*dx)/d;
 return {damageFactor:1-.12*cross,rangeFactor:1+.12*along,drift:{x:wind.x*Math.min(d,12)*.045,y:wind.y*Math.min(d,12)*.045}};
}

function terrain(s:WorldGame,p:Positioned):string {
 const layer=s.world?.levels.find(l=>l.id===levelOf(p));
 return (layer?.terrain??(levelOf(p)===0?s.terrain:[]))[tileOf(s,p)]??'rock';
}
function setTerrain(s:WorldGame,p:Positioned,kind:string):void {setWorldTerrain(s,p,kind as TerrainKind);}
function woodAt(s:GameState,p:Positioned) {
 return s.resources.filter(n=>n.kind==='wood'&&n.amount>0&&levelOf(n)===levelOf(p)&&tileOf(s,n)===tileOf(s,p));
}
function flammable(s:WorldGame,p:Positioned):boolean {
 return p.x>=0&&p.y>=0&&p.x<s.width&&p.y<s.height&&(terrain(s,p)==='forest'||woodAt(s,p).length>0||s.economy?.groves.some(g=>!g.burned&&levelOf(g)===levelOf(p)&&tileOf(s,g)===tileOf(s,p))===true);
}
function message(s:GameState,side:Side,p:Positioned,text:string,type:'message'|'ability'='message',source?:number):void {
 const event={type,side,x:p.x,y:p.y,level:levelOf(p),text,source};s.events.push(event);
}
function hurt(s:GameState,e:Entity,amount:number,text:string,bypassShield=false,hooks?:EnvironmentHooks):void {
 const absorbed=bypassShield?0:Math.min(e.shield??0,amount);
 if(absorbed)e.shield=Math.max(0,(e.shield??0)-absorbed);
 const damage=Math.min(e.hp,amount-absorbed);e.hp=Math.max(0,e.hp-damage);e.lastDamagedAt=s.time;
 const event={type:'ability' as const,side:e.side,x:e.x,y:e.y,level:levelOf(e),source:e.id,target:e.id,amount:damage+absorbed,text};s.events.push(event);
 if(e.hp>0)return;
 if(hooks?.die){hooks.die(e,text);return;}
 e.animation='death';e.animTime=0;e.order={type:'idle'};e.path=[];delete e.orderQueue;
 hooks?.interrupt(e);
 if(e.kind==='unit'&&!e.illusion&&!e.raised){const corpse={id:e.id,x:e.x,y:e.y,level:levelOf(e),expires:s.time+45};s.corpses.push(corpse);}
 s.events.push({type:'death',side:e.side,x:e.x,y:e.y,source:e.id,text,level:levelOf(e)} as GameState['events'][number]);
}
function ignition(s:WorldGame,p:Positioned):WorldFire {
 return {x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5,level:levelOf(p),heat:1,expires:s.time+ENVIRONMENT_RULES.fireLifetime,nextSpread:s.time+2.5};
}

/** Artillery calls this at its saved impact point after paying ammunition at launch. */
export function igniteWorldAt(s:GameState,at:Vec,source?:{side:Side;id?:number}):boolean {
 const state=s as WorldGame,world=state.world,level=levelOf(at);if(!world||!Number.isFinite(at.x)||!Number.isFinite(at.y)||!Number.isInteger(level)||!world.levels.some(l=>l.id===level)||at.x<0||at.y<0||at.x>=s.width||at.y>=s.height||source&&!s.players[source.side])return false;
 if(source?.id!==undefined&&(!Number.isSafeInteger(source.id)||source.id<1||source.id>=s.nextId))return false;
 const p={x:Math.floor(at.x)+.5,y:Math.floor(at.y)+.5,level};if(!flammable(state,p)||world.fires.some(f=>f.level===level&&tileOf(s,f)===tileOf(s,p)))return false;
 world.fires.push(ignition(state,p));if(source)message(s,source.side,p,'Incendiary shell ignited timber.','ability',source.id);return true;
}
/** Environmental commands perform work only from a legal nearby unit, with no remote clearing. */
export function issueEnvironmentCommand(s:GameState,side:Side,command:WorldCommand|{type:string}):boolean|undefined {
 if(command.type!=='ignite'&&command.type!=='firebreak')return undefined;
 const c=command as Extract<WorldCommand,{type:'ignite'|'firebreak'}>,state=s as WorldGame,world=state.world;
 if(!world||s.winner!==null||s.draw||!s.players[side]||s.eliminated[side]||!Array.isArray(c.ids)||!c.ids.every(id=>Number.isSafeInteger(id)&&id>0))return false;
 const p={x:c.x,y:c.y,level:c.level??0};
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isSafeInteger(p.level)||!world.levels.some(l=>l.id===p.level)||p.x<0||p.y<0||p.x>=s.width||p.y>=s.height)return false;
 // Reach and the effect share the tile center, so clicking a tile edge cannot
 // clear or ignite a forest farther away than the unit's stated reach.
 p.x=Math.floor(p.x)+.5;p.y=Math.floor(p.y)+.5;
 const key=p.level*s.width*s.height+tileOf(s,p);
 if(!s.visible[side]?.has(key))return false;
 const fire=world.fires.find(f=>f.level===p.level&&tileOf(s,f)===tileOf(s,p));
 if(c.type==='ignite'&&(!flammable(state,p)||fire)||c.type==='firebreak'&&!flammable(state,p)&&!fire)return false;
 const actors=s.entities.filter(e=>c.ids.includes(e.id)&&e.side===side&&e.hp>0&&e.kind==='unit'&&!e.illusion&&levelOf(e)===p.level&&e.cooldown<=0&&(e.role==='worker'||c.type==='ignite'&&e.role==='siege'));
 const actor=actors.sort((a,b)=>a.id-b.id).find(e=>length2D(e.x-p.x,e.y-p.y)<=(e.role==='siege'?unitFor(s,e).range:ENVIRONMENT_RULES.workerReach));
 const player=s.players[side],wood=c.type==='ignite'?ENVIRONMENT_RULES.igniteWood:ENVIRONMENT_RULES.firebreakWood,ore=c.type==='ignite'?ENVIRONMENT_RULES.igniteOre:0;
 if(!actor||player.wood<wood||player.ore<ore)return false;
 player.wood-=wood;player.ore-=ore;actor.cooldown=actor.role==='siege'?1.5:.8;actor.animation='attack';actor.animTime=0;
 if(c.type==='ignite')igniteWorldAt(s,p);
 else {
  for(const node of woodAt(s,p))node.amount=0;burnEconomyAt(s,p.x,p.y,.8,levelOf(p));
  if(terrain(state,p)==='forest')setTerrain(state,p,'grass');
  world.fires=world.fires.filter(f=>f!==fire);
 }
 message(s,side,p,c.type==='ignite'?'Forest ignited (15 wood, 5 ore)':'Firebreak cleared (5 wood); timber is lost','ability',actor.id);
 return true;
}

function bankClear(s:WorldGame,p:Positioned):boolean {
 if(p.x<.35||p.y<.35||p.x>s.width-.35||p.y>s.height-.35)return false;
 for(let y=Math.floor(p.y-.27);y<=Math.floor(p.y+.27);y++)for(let x=Math.floor(p.x-.27);x<=Math.floor(p.x+.27);x++)if(['water','rock','forest','ice'].includes(terrain(s,{x:x+.5,y:y+.5,level:p.level})))return false;
 if(s.resources.some(n=>n.amount>0&&levelOf(n)===levelOf(p)&&length2D(n.x-p.x,n.y-p.y)<.7))return false;
 return !s.entities.some(e=>e.hp>0&&e.kind==='building'&&!e.gateOpen&&levelOf(e)===levelOf(p)&&Math.abs(e.x-p.x)<buildingFor(s,e).size/2+.27&&Math.abs(e.y-p.y)<buildingFor(s,e).size/2+.27);
}
function evacuate(s:WorldGame,e:Entity,hooks?:EnvironmentHooks):void {
 let best:Positioned|undefined,bestDistance=Infinity;
 for(let y=Math.max(0,Math.floor(e.y-ENVIRONMENT_RULES.evacuationRadius));y<Math.min(s.height,Math.ceil(e.y+ENVIRONMENT_RULES.evacuationRadius));y++)for(let x=Math.max(0,Math.floor(e.x-ENVIRONMENT_RULES.evacuationRadius));x<Math.min(s.width,Math.ceil(e.x+ENVIRONMENT_RULES.evacuationRadius));x++){
  const p={x:x+.5,y:y+.5,level:levelOf(e)},d=length2D(p.x-e.x,p.y-e.y);
  if(d<=ENVIRONMENT_RULES.evacuationRadius&&d<bestDistance&&bankClear(s,p)){best=p;bestDistance=d;}
 }
 // As with navigation's refined grid, a narrow legal bank can fall between
 // tile centers. Exhaust those rescue positions before declaring drowning.
 if(!best)for(let y=Math.max(0,Math.floor((e.y-ENVIRONMENT_RULES.evacuationRadius)*4));y<Math.min(s.height*4,Math.ceil((e.y+ENVIRONMENT_RULES.evacuationRadius)*4));y++)for(let x=Math.max(0,Math.floor((e.x-ENVIRONMENT_RULES.evacuationRadius)*4));x<Math.min(s.width*4,Math.ceil((e.x+ENVIRONMENT_RULES.evacuationRadius)*4));x++){
  const p={x:(x+.5)/4,y:(y+.5)/4,level:levelOf(e)},d=length2D(p.x-e.x,p.y-e.y);
  if(d<=ENVIRONMENT_RULES.evacuationRadius&&d<bestDistance&&bankClear(s,p)){best=p;bestDistance=d;}
 }
 if(!best){hurt(s,e,e.hp,'Lake thawed: trapped troop drowned; no bank within 6 tiles',true,hooks);return;}
 e.x=best.x;e.y=best.y;e.path=[];e.order={type:'idle'};delete e.orderQueue;
 hooks?.interrupt(e);
 hurt(s,e,Math.max(0,Math.min(e.hp-1,e.maxHp*ENVIRONMENT_RULES.evacuationInjury)),'Lake thawed: troop evacuated to bank, injured by up to 25% health',true);
}
function touchesIce(s:GameState,e:Entity,tiles:WorldState['iceTiles']):boolean {
 // Match navigation's .27 clearance, including troops straddling a bank edge.
 return tiles.some(t=>t.level===levelOf(e)&&t.tile%s.width>=Math.floor(e.x-.27)&&t.tile%s.width<=Math.floor(e.x+.27)&&Math.floor(t.tile/s.width)>=Math.floor(e.y-.27)&&Math.floor(t.tile/s.width)<=Math.floor(e.y+.27));
}
function exposed(s:GameState,e:Entity,fire:WorldFire):boolean {
 if(levelOf(e)!==fire.level)return false;
 const radius=e.kind==='building'?buildingFor(s,e).size/2:0;
 return length2D(Math.max(0,Math.abs(e.x-fire.x)-radius),Math.max(0,Math.abs(e.y-fire.y)-radius))<.9;
}
function seasons(s:WorldGame,phase:EnvironmentPhase,hooks?:EnvironmentHooks):void {
 const world=s.world!;
 if(phase.season==='winter'&&world.biome!=='desert'){
  // Cavern water never freezes. Saved iceTiles distinguish natural water from
  // bridge or engineered terrain so thaw restores only the seasonal crossings.
  const surface=world.levels.find(l=>l.id===0);
  const frozen=new Set(world.iceTiles.filter(ice=>ice.level===0).map(ice=>ice.tile));
  if(surface)for(let tile=0;tile<surface.terrain.length;tile++)if(surface.terrain[tile]==='water'){
   const p={x:tile%s.width+.5,y:Math.floor(tile/s.width)+.5,level:0};setTerrain(s,p,'ice');if(!frozen.has(tile)){world.iceTiles.push({level:0,tile});frozen.add(tile);}
  }
  const warning=Math.min(ENVIRONMENT_RULES.thawWarning,length(world.seasonLength,300)*.1);
  if(world.iceTiles.length&&!world.thawWarned&&phase.thawIn!==null&&phase.thawIn<=warning+1e-8){
   world.thawWarned=true;
   for(let side=0;side<s.players.length;side++){
    const troop=s.entities.find(e=>e.hp>0&&e.kind==='unit'&&e.side===side&&touchesIce(s,e,world.iceTiles));
    message(s,side as Side,troop??s.starts[side],`Lake ice thaws in ${Math.ceil(phase.thawIn)} seconds. Leave crossings: nearby banks cause injury; troops trapped over 6 tiles from a bank drown.`);
   }
  }
  return;
 }
 if(world.iceTiles.length){
  const melting=world.iceTiles.filter(t=>terrain(s,{x:t.tile%s.width+.5,y:Math.floor(t.tile/s.width)+.5,level:t.level})==='ice');
  for(const ice of melting)setTerrain(s,{x:ice.tile%s.width+.5,y:Math.floor(ice.tile/s.width)+.5,level:ice.level},'water');
  for(const e of s.entities)if(e.hp>0&&e.kind==='unit'&&touchesIce(s,e,melting))evacuate(s,e,hooks);
  world.iceTiles=[];
 }
 world.thawWarned=false;
}

/** Called once per simulation step after the clock advances, before unit actions. */
export function stepEnvironment(s:GameState,dt:number,hooks?:EnvironmentHooks):void {
 const state=s as WorldGame,world=state.world;
 if(!world||!Number.isFinite(dt)||dt<=0)return;
 const phase=environmentPhase(s),previous=environmentPhase({...s,time:Math.max(0,s.time-dt)}),added:WorldFire[]=[];
 if(previous.day!==phase.day||previous.weather!==phase.weather||previous.season!==phase.season)for(let side=0;side<s.players.length;side++)message(s,side as Side,s.starts[side],`${phase.day}; ${phase.weather}; ${phase.season}`);
 seasons(state,phase,hooks);
 for(const fire of [...world.fires]){
  if(fire.expires<=s.time||fire.heat<=0)continue;
  const wet=phase.weather==='rain'&&fire.level===0;
  fire.heat=Math.max(0,fire.heat-dt*(wet?.22:.004));
  const nodes=woodAt(s,fire),burn=dt*ENVIRONMENT_RULES.woodBurnRate*fire.heat*(wet?.35:1);
  for(const node of nodes)node.amount=Math.max(0,node.amount-burn);burnEconomyAt(s,fire.x,fire.y,.8,fire.level);
  // A bare forest tile contains vegetation even when it has no harvest node.
  if(terrain(state,fire)==='forest'&&(nodes.length?nodes.every(n=>n.amount===0):fire.expires-s.time<ENVIRONMENT_RULES.fireLifetime-5))setTerrain(state,fire,'grass');
  for(const e of s.entities)if(e.hp>0&&exposed(s,e,fire))hurt(s,e,dt*(e.kind==='building'?ENVIRONMENT_RULES.buildingFireDamage:ENVIRONMENT_RULES.fireDamage)*fire.heat,'Forest fire damage',false,hooks);
  if(wet||fire.heat<.35||s.time+1e-8<fire.nextSpread)continue;
  const spreadAt=fire.nextSpread;fire.nextSpread+=phase.weather==='wind'&&fire.level===0?1.5:2.5;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const p={x:fire.x+dx,y:fire.y+dy,level:fire.level};
   const chance=.45+.35*(phase.weather==='wind'&&fire.level===0?(phase.wind.x*dx+phase.wind.y*dy):0);
   if(!flammable(state,p)||world.fires.some(f=>f.level===p.level&&tileOf(s,f)===tileOf(s,p))||added.some(f=>f.level===p.level&&tileOf(s,f)===tileOf(s,p))||hash(s.seed,tileOf(s,p),Math.round(spreadAt*20),fire.level)>=chance)continue;
   added.push(ignition(state,p));
  }
 }
 world.fires=world.fires.filter(f=>f.expires>s.time&&f.heat>0).concat(added);
 const dayLength=length(world.dayLength,240),seasonLength=length(world.seasonLength,300),dayStart=Math.floor(s.time/dayLength)*dayLength;
 const dayNext=[.55,.65,.9,1].map(f=>dayStart+f*dayLength).find(t=>t>s.time+1e-8)??dayStart+dayLength;
 world.nextEnvironmentAt=Math.min(dayNext,phase.weatherEndsAt,(Math.floor(s.time/seasonLength)+1)*seasonLength);
}
