import { ECONOMY, FACTIONS } from './content';
import { walkable, segmentWalkable, openDestination, route } from './navigation';
import { generateMap, terrainAt, TERRAIN } from './maps';
import type { BuildingDef, BuildingRole, Command, Entity, FactionId, GameOptions, GameState, ResourceNode, Side, UnitDef, UnitRole, Vec } from './types';

const distance = (a:Vec,b:Vec) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
interface Runtime { fog:number; ai:number; aiTurns:number; hits:{source:Entity;target:Entity;amount:number;event:GameState['events'][number]}[]; routes:Map<number,{key:string;at:number}>; abilities:Map<number,number>; returning:Set<number>; aiWave:[number,number]; initialScoutDispatched:[boolean,boolean] }
const runtimes=new WeakMap<GameState,Runtime>();
function runtime(s:GameState):Runtime { let r=runtimes.get(s);if(!r){r={fog:0,ai:0,aiTurns:0,hits:[],routes:new Map(),abilities:new Map(),returning:new Set(),aiWave:[0,0],initialScoutDispatched:[false,false]};runtimes.set(s,r);}return r; }
const alive=(e:Entity)=>e.hp>0;
function unitDef(s:GameState,e:Entity):UnitDef{return FACTIONS[s.players[e.side].faction].units[e.role as UnitRole];}
function buildingDef(s:GameState,e:Entity):BuildingDef{return FACTIONS[s.players[e.side].faction].buildings[e.role as BuildingRole];}
function radius(s:GameState,e:Entity):number{return e.kind==='building'?buildingDef(s,e).size/2:0.3;}
function near(s:GameState,a:Entity,b:Entity|ResourceNode,range:number):boolean{return distance(a,b)<=range+('kind' in b&&b.kind==='building'?radius(s,b):0);}
function emit(s:GameState,type:GameState['events'][number]['type'],e:Vec & {side:Side;id?:number},target?:number,text?:string){const event:GameState['events'][number]={type,x:e.x,y:e.y,side:e.side,target,text,source:e.id};s.events.push(event);return event;}
function spawn(s:GameState,side:Side,kind:Entity['kind'],role:UnitRole|BuildingRole,x:number,y:number,progress=1):Entity{
 const f=FACTIONS[s.players[side].faction];const def=kind==='unit'?f.units[role as UnitRole]:f.buildings[role as BuildingRole];
 const e:Entity={id:s.nextId++,side,kind,role,x,y,hp:progress===1?def.hp:Math.max(1,def.hp*.1),maxHp:def.hp,order:{type:'idle'},cooldown:0,progress,queue:[],trainProgress:0,facing:2,animation:'idle',animTime:0,momentum:0,illusion:false,expires:0,carried:0,carriedKind:'wood',path:[]};if(kind==='unit'&&f.id==='automata'){e.maxShield=({worker:12,melee:30,ranged:22,special:35} as Record<string,number>)[role];e.shield=e.maxShield;}s.entities.push(e);return e;
}
export function createGame(faction:FactionId,seed=1977,opponent:FactionId=faction==='orcs'?'fairies':'orcs',options:GameOptions={}):GameState{
 const map=generateMap(seed,options.mapSize??'medium');
 const s:GameState={controllers:options.controllers??['human','ai'],mapSize:map.size,mapVersion:map.version,terrain:map.terrain,starts:map.starts,draw:false,tick:0,corpses:[],time:0,seed,width:map.width,height:map.height,entities:[],resources:[],players:[{faction,wood:420,ore:220,crystal:0,population:0,cap:12},{faction:opponent,wood:420,ore:220,crystal:0,population:0,cap:12}],winner:null,events:[],explored:[new Set(),new Set()],visible:[new Set(),new Set()],nextId:1};
 for(const side of [0,1] as Side[]){const {x,y}=s.starts[side],dir=side===0?1:-1;spawn(s,side,'building','hq',x,y);for(let i=0;i<5;i++)spawn(s,side,'unit','worker',x+(-2+i*.85)*dir,y+3*dir);spawn(s,side,'unit','melee',x+3*dir,y+dir);}
 for(const resource of map.resources)s.resources.push({...resource,id:s.nextId++});
 refreshVisibility(s);updatePopulation(s);return s;
}
export function isGameOver(s:GameState):boolean{return s.winner!==null||s.draw;}
export function isVisible(s:GameState,side:Side,x:number,y:number):boolean{return x>=0&&y>=0&&x<s.width&&y<s.height&&s.visible[side].has(Math.floor(y)*s.width+Math.floor(x));}
export function refreshVisibility(s:GameState):void{
 for(const side of [0,1] as Side[]){s.visible[side].clear();for(const e of s.entities){if(e.side!==side||!alive(e))continue;const sight=e.kind==='unit'?unitDef(s,e).sight:buildingDef(s,e).sight;for(let y=Math.max(0,Math.floor(e.y-sight));y<=Math.min(s.height-1,Math.ceil(e.y+sight));y++)for(let x=Math.max(0,Math.floor(e.x-sight));x<=Math.min(s.width-1,Math.ceil(e.x+sight));x++)if(Math.hypot(x+.5-e.x,y+.5-e.y)<=sight){const key=y*s.width+x;s.visible[side].add(key);s.explored[side].add(key);}}}
}
function updatePopulation(s:GameState):void{for(const side of [0,1] as Side[]){const es=s.entities.filter(e=>e.side===side&&alive(e));s.players[side].population=es.filter(e=>e.kind==='unit'&&!e.illusion).length;s.players[side].cap=Math.min(100,es.filter(e=>e.kind==='building'&&e.progress===1).reduce((v,e)=>v+(e.role==='hq'?12:e.role==='depot'?10:0),0));}}
function reserved(s:GameState,side:Side):number{return s.entities.filter(e=>e.side===side&&alive(e)).reduce((v,e)=>v+e.queue.length,0);}
export function canPlace(s:GameState,side:Side,role:BuildingRole,x:number,y:number):boolean{
 const def=FACTIONS[s.players[side].faction].buildings[role];if(!def||!Number.isFinite(x)||!Number.isFinite(y))return false;const r=def.size/2;if(x-r<.5||y-r<.5||x+r>s.width-.5||y+r>s.height-.5)return false;
 for(const dx of [-r,0,r])for(const dy of [-r,0,r])if(!isVisible(s,side,x+dx,y+dy))return false;
 for(let ty=Math.floor(y-r);ty<Math.ceil(y+r);ty++)for(let tx=Math.floor(x-r);tx<Math.ceil(x+r);tx++)if(!TERRAIN[terrainAt(s,tx+.5,ty+.5)].buildable)return false;
 if(s.entities.some(e=>alive(e)&&e.kind==='building'&&Math.abs(e.x-x)<radius(s,e)+r+.4&&Math.abs(e.y-y)<radius(s,e)+r+.4))return false;
 if(s.resources.some(e=>e.amount>0&&Math.abs(e.x-x)<r+.8&&Math.abs(e.y-y)<r+.8))return false;return true;
}
function assign(s:GameState,e:Entity,order:Entity['order']):void{if(order.type!=='hold')e.entrenchedAt=undefined;e.order=order;e.path=[];runtime(s).routes.delete(e.id);runtime(s).returning.delete(e.id);}
export function issueCommand(s:GameState,side:Side,c:Command):boolean{
 if(isGameOver(s))return false;const p=s.players[side],f=FACTIONS[p.faction];
 if(c.type==='train'){
 const e=s.entities.find(e=>e.id===c.id&&e.side===side&&alive(e)&&e.kind==='building'&&e.progress===1);const d=f.units[c.role];if(!e||!d||(c.role==='worker'?e.role!=='hq':e.role!=='barracks')||e.queue.length>=5||p.wood<d.cost.wood||p.ore<d.cost.ore||p.crystal<d.cost.crystal||p.population+reserved(s,side)>=p.cap)return false;
 p.wood-=d.cost.wood;p.ore-=d.cost.ore;p.crystal-=d.cost.crystal;e.queue.push(c.role);return true;
 }
 const units=s.entities.filter(e=>c.ids.includes(e.id)&&e.side===side&&alive(e)&&e.kind==='unit'&&!e.illusion);
 if(!units.length)return false;
 if(c.type==='build'){
 const workers=units.filter(e=>e.role==='worker');const d=f.buildings[c.role];if(!workers.length||!d||p.wood<d.cost.wood||p.ore<d.cost.ore||p.crystal<d.cost.crystal||!canPlace(s,side,c.role,c.x,c.y))return false;
 p.wood-=d.cost.wood;p.ore-=d.cost.ore;p.crystal-=d.cost.crystal;const b=spawn(s,side,'building',c.role,c.x,c.y,0);for(const u of s.entities.filter(e=>e.kind==='unit'&&alive(e)&&Math.abs(e.x-b.x)<d.size/2+.35&&Math.abs(e.y-b.y)<d.size/2+.35)){for(let ring=d.size/2+1;ring<d.size/2+5;ring+=.5){let freed=false;for(let i=0;i<32;i++){const a=i/32*Math.PI*2,x=b.x+Math.cos(a)*ring,y=b.y+Math.sin(a)*ring;if(walkable(s,x,y)){u.x=x;u.y=y;u.path=[];freed=true;break;}}if(freed)break;}}for(const e of workers)assign(s,e,{type:'build',target:b.id});emit(s,'build',b);return true;
 }
 if(c.type==='ability'){let success=false;for(const e of units){if(useAbility(s,e))success=true;}return success;}
 if(c.type==='move'||c.type==='attackMove'){
 if(!Number.isFinite(c.x)||!Number.isFinite(c.y))return false;
 const width=Math.ceil(Math.sqrt(units.length)),dir=side===0?1:-1;
 const destinations=units.map((e,i)=>{const dx=units.length===1?0:(i%width-(width-1)/2)*.8*dir,dy=units.length===1?0:(Math.floor(i/width)-(width-1)/2)*.8*dir;return openDestination(s,{x:clamp(c.x+dx,.6,s.width-.6),y:clamp(c.y+dy,.6,s.height-.6)},e);});
 if(destinations.some(p=>!p))return false;
 units.forEach((e,i)=>assign(s,e,{type:c.type,...destinations[i]!}));return true;
 }
 if(c.type==='stop'||c.type==='hold'){for(const e of units)assign(s,e,{type:c.type==='hold'?'hold':'idle'});return true;}
 if(!('target' in c))return false;
 const target=c.type==='gather'?s.resources.find(e=>e.id===c.target&&e.amount>0):s.entities.find(e=>e.id===c.target&&alive(e));
 if(!target||!isVisible(s,side,target.x,target.y))return false;
 if(c.type==='attack'){if(!('side' in target)||target.side===side)return false;for(const e of units)assign(s,e,{type:'attack',target:target.id});return true;}
 const workers=units.filter(e=>e.role==='worker');if(!workers.length)return false;
 if(c.type==='repair'&&(!('side' in target)||target.side!==side||target.kind!=='building'||(target.hp>=target.maxHp&&target.progress>=1)))return false;
 for(const e of workers)assign(s,e,{type:c.type==='gather'?'gather':'build',target:target.id});return true;
}
function useAbility(s:GameState,e:Entity):boolean{
 if((runtime(s).abilities.get(e.id)??0)>s.time)return false;const ability=unitDef(s,e).ability;if(!ability)return false;
 if(ability==='entrench'){
 if(e.entrenchedAt!==undefined){e.entrenchedAt=undefined;assign(s,e,{type:'idle'});}else{assign(s,e,{type:'hold'});e.entrenchedAt=s.time;}
 }else if(ability==='raise'){
 updatePopulation(s);let count=0;
 for(const corpse of [...s.corpses].sort((a,b)=>distance(e,a)-distance(e,b))){
 if(count>=2||s.players[e.side].population+reserved(s,e.side)>=s.players[e.side].cap)break;
 if(corpse.expires<=s.time||distance(e,corpse)>6||!isVisible(s,e.side,corpse.x,corpse.y)||!walkable(s,corpse.x,corpse.y))continue;
 const raised=spawn(s,e.side,'unit','melee',corpse.x,corpse.y);raised.hp=raised.maxHp*.5;raised.raised=true;raised.expires=s.time+35;raised.order={type:'attackMove',x:e.x,y:e.y};s.corpses=s.corpses.filter(c=>c.id!==corpse.id);count++;updatePopulation(s);
 }
 if(!count)return false;runtime(s).abilities.set(e.id,s.time+22);
 }else if(ability==='illusion'){
 for(const offset of [-.6,.6]){const clone=spawn(s,e.side,'unit',e.role,clamp(e.x+offset,.5,s.width-.5),clamp(e.y-offset,.5,s.height-.5));clone.illusion=true;clone.hp=clone.maxHp*.4;clone.maxHp=clone.hp;clone.expires=s.time+18;clone.order={...e.order};}runtime(s).abilities.set(e.id,s.time+35);
 }else if(ability==='surge'){
 let affected=false;for(const ally of s.entities)if(ally.side===e.side&&alive(ally)&&ally.kind==='unit'&&!ally.illusion&&distance(e,ally)<5){ally.hp=Math.min(ally.maxHp,ally.hp+35);ally.surgeUntil=s.time+6;affected=true;}if(!affected)return false;runtime(s).abilities.set(e.id,s.time+20);
 }else if(ability==='ward'){
 let restored=false;for(const ally of s.entities)if(ally.side===e.side&&alive(ally)&&ally.kind==='unit'&&!ally.illusion&&distance(e,ally)<5&&(ally.shield??0)<(ally.maxShield??0)){ally.shield=Math.min(ally.maxShield!,(ally.shield??0)+24);restored=true;}if(!restored)return false;runtime(s).abilities.set(e.id,s.time+20);
 }else if(ability==='heal'){
 let healed=false;for(const ally of s.entities)if(ally.side===e.side&&alive(ally)&&ally.kind==='unit'&&!ally.illusion&&distance(e,ally)<5&&ally.hp<ally.maxHp){ally.hp=Math.min(ally.maxHp,ally.hp+35);healed=true;}if(!healed)return false;runtime(s).abilities.set(e.id,s.time+18);
 }else {e.momentum=Math.min(1,e.momentum+.5);runtime(s).abilities.set(e.id,s.time+25);}
 e.abilityReadyAt=runtime(s).abilities.get(e.id)??s.time;
 emit(s,'ability',e);return true;
}
function walkTo(e:Entity,x:number,y:number):void{
 const dx=x-e.x,dy=y-e.y;
 if(dx!==0||dy!==0)e.facing=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8;
 e.x=x;e.y=y;e.animation='walk';
}
function movementSpeed(s:GameState,e:Entity):number{
 const terrain=terrainAt(s,e.x,e.y),wet=terrain==='mud'||terrain==='shallows';
 const terrainSpeed=s.players[e.side].faction==='tideborn'&&wet?1.1:TERRAIN[terrain].speed;
 return unitDef(s,e).speed*terrainSpeed*(e.illusion?1.08:1)*((e.surgeUntil??0)>s.time?1.25:1);
}
function move(s:GameState,e:Entity,to:Vec,dt:number,reach=.45):boolean{
 if(distance(e,to)<=reach){e.path=[];return true;}
 if(distance(e,to)<reach+.85){const d=distance(e,to),amount=Math.min(d-reach+.02,movementSpeed(s,e)*dt),x=e.x+(to.x-e.x)/d*amount,y=e.y+(to.y-e.y)/d*amount;if(segmentWalkable(s,e,{x,y})){walkTo(e,x,y);return distance(e,to)<=reach;}}
 const rt=runtime(s),key=`${Math.floor(to.x*2)},${Math.floor(to.y*2)},${reach.toFixed(1)}`,cache=rt.routes.get(e.id);
 if(!cache||cache.key!==key||(!e.path.length&&s.time-cache.at>1.3)||s.time-cache.at>5){e.path=route(s,e,to,reach);rt.routes.set(e.id,{key,at:s.time});}
 if(!e.path.length)return false;const p=e.path[0],d=distance(e,p),speed=movementSpeed(s,e),amount=Math.min(d,speed*dt);
 if(d<.09){e.path.shift();return false;}const nx=e.x+(p.x-e.x)/d*amount,ny=e.y+(p.y-e.y)/d*amount;
 if(segmentWalkable(s,e,{x:nx,y:ny})){walkTo(e,nx,ny);}else if(segmentWalkable(s,e,{x:nx,y:e.y})&&Math.abs(nx-e.x)>.001){walkTo(e,nx,e.y);}else if(segmentWalkable(s,e,{x:e.x,y:ny})&&Math.abs(ny-e.y)>.001){walkTo(e,e.x,ny);}else{e.path=[];rt.routes.delete(e.id);}
 if(d<=amount+.06)e.path.shift();return distance(e,to)<=reach;
}
function emplaced(s:GameState,e:Entity):boolean{return e.entrenchedAt!==undefined&&s.time-e.entrenchedAt>=3;}
function weaponRange(s:GameState,e:Entity):number{return e.kind==='building'?7:unitDef(s,e).range+(emplaced(s,e)&&e.role==='special'?3:0);}
function damage(s:GameState,a:Entity,b:Entity):void{
 const d=a.kind==='unit'?unitDef(s,a):null;const armor=(b.kind==='unit'?unitDef(s,b).armor:3)+(emplaced(s,b)?3:0);
 const base=d?.damage??19;const bonus=d?.ability==='momentum'?1+a.momentum*.30:emplaced(s,a)?1.25:1;const hit=Math.max(1,base*bonus*(b.kind==='building'?(d?.buildingDamageMultiplier??1):1)-armor)*(a.illusion?.25:1);
 a.cooldown=(d?.cooldown??1.4)/(d?.ability==='momentum'?1+a.momentum*.15:1);if(d?.ability==='momentum')a.momentum=Math.min(1,a.momentum+.15);a.animation='attack';a.animTime=0;const event=emit(s,'attack',a,b.id);runtime(s).hits.push({source:a,target:b,amount:hit,event});
}
function die(s:GameState,e:Entity):void{if(e.kind==='unit'&&!e.illusion&&!e.raised)s.corpses.push({id:e.id,x:e.x,y:e.y,expires:s.time+45});e.hp=0;e.animation='death';e.animTime=0;e.order={type:'idle'};e.path=[];emit(s,'death',e);}
function enemy(s:GameState,e:Entity,max:number,onlyInRange=false):Entity|undefined{
 let best:Entity|undefined,bestDist=Infinity;for(const b of s.entities){if(!alive(b)||b.side===e.side||!isVisible(s,e.side,b.x,b.y)||onlyInRange&&!near(s,e,b,max))continue;const d=distance(e,b)-radius(s,b);if(d<=max&&(d<bestDist||best?.kind==='building'&&b.kind==='unit')){best=b;bestDist=d;}}return best;
}
function fight(s:GameState,e:Entity,b:Entity,dt:number):void{const range=weaponRange(s,e);if(near(s,e,b,range)){e.facing=(Math.round(Math.atan2(b.y-e.y,b.x-e.x)/(Math.PI/4))+8)%8;if(e.cooldown<=0)damage(s,e,b);}else if(e.kind==='unit')move(s,e,b,dt,range+(b.kind==='building'?radius(s,b):0)-.1);}
function gather(s:GameState,e:Entity,target:number,dt:number):void{
 const node=s.resources.find(n=>n.id===target);const rt=runtime(s);if(e.carried>=18||node?.amount===0&&e.carried>0)rt.returning.add(e.id);
 if(rt.returning.has(e.id)){
 const depot=s.entities.filter(b=>b.side===e.side&&alive(b)&&b.kind==='building'&&b.progress===1&&(b.role==='hq'||b.role==='depot')).sort((a,b)=>distance(e,a)-distance(e,b))[0];
 if(!depot){assign(s,e,{type:'idle'});return;}if(near(s,e,depot,1.1)){s.players[e.side][e.carriedKind]+=e.carried;const deposit=emit(s,'gather',e,depot.id);deposit.amount=e.carried;deposit.resource=e.carriedKind;e.carried=0;rt.returning.delete(e.id);}else move(s,e,depot,dt,radius(s,depot)+1);return;
 }
 if(!node||node.amount<=0){const next=s.resources.filter(n=>n.amount>0&&n.kind===(node?.kind??e.carriedKind)&&isVisible(s,e.side,n.x,n.y)).sort((a,b)=>distance(e,a)-distance(e,b))[0];assign(s,e,next?{type:'gather',target:next.id}:{type:'idle'});return;}
 if(e.carried>0&&e.carriedKind!==node.kind){rt.returning.add(e.id);return;}
 if(distance(e,node)>1.2){move(s,e,node,dt,1.1);return;}
 e.animation='attack';e.carriedKind=node.kind;const amount=Math.min(node.amount,dt*ECONOMY.harvestPerSecond*(node.kind==='crystal'?.6:1),18-e.carried);node.amount-=amount;e.carried+=amount;
}
function construct(s:GameState,e:Entity,id:number,dt:number):void{
 const b=s.entities.find(b=>b.id===id&&alive(b)&&b.side===e.side&&b.kind==='building');if(!b){assign(s,e,{type:'idle'});return;}if(!near(s,e,b,1.2)){move(s,e,b,dt,radius(s,b)+1.1);return;}
 const def=buildingDef(s,b);e.animation='attack';if(b.progress<1){const amount=Math.min(1-b.progress,dt/def.buildTime);b.progress+=amount;b.hp=Math.min(b.maxHp,b.hp+amount*b.maxHp*.9);if(b.progress>=1){b.progress=1;emit(s,'build',b,undefined,'Construction complete');updatePopulation(s);}}
 else if(b.hp<b.maxHp){const p=s.players[e.side],amount=Math.min(b.maxHp-b.hp,dt*18,p.wood*10);p.wood-=amount*.1;b.hp+=amount;}
 else assign(s,e,{type:'idle'});
}
function production(s:GameState,e:Entity,dt:number):void{
 if(e.progress<1||!e.queue.length)return;const role=e.queue[0],d=FACTIONS[s.players[e.side].faction].units[role];if(s.players[e.side].population>=s.players[e.side].cap)return;e.trainProgress+=dt/d.trainTime;
 if(e.trainProgress>=1){let point:Vec|undefined;const r=radius(s,e)+1;for(let i=0;i<24;i++){const angle=i/24*Math.PI*2+(e.side===0?0:Math.PI),p={x:e.x+Math.cos(angle)*r,y:e.y+Math.sin(angle)*r};if(walkable(s,p.x,p.y)){point=p;break;}}
 if(!point)return;const u=spawn(s,e.side,'unit',role,point.x,point.y);e.trainProgress=0;e.queue.shift();emit(s,'train',u);updatePopulation(s);}
}
function separateUnits(s:GameState):void{
 const units=s.entities.filter(e=>e.kind==='unit'&&alive(e));for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){const a=units[i],b=units[j],d=distance(a,b);if(d>=.58)continue;const dx=d>.001?(a.x-b.x)/d:(a.id%2?1:-1),dy=d>.001?(a.y-b.y)/d:.3,push=(.58-d)*.22;const ax=a.x+dx*push,ay=a.y+dy*push,bx=b.x-dx*push,by=b.y-dy*push;if(walkable(s,ax,ay)){a.x=ax;a.y=ay;}if(walkable(s,bx,by)){b.x=bx;b.y=by;}}
}
// Units alive at the beginning of this step finish their attacks together.
// This prevents entity-array order from cancelling the other side's lethal hit.
function resolveHits(s:GameState):void{
 const groups=new Map<Entity,Runtime['hits']>();
 for(const hit of runtime(s).hits){const group=groups.get(hit.target)??[];group.push(hit);groups.set(hit.target,group);}
 for(const [target,hits] of groups){if(!alive(target))continue;const total=hits.reduce((n,h)=>n+h.amount,0),absorbed=Math.min(target.shield??0,total),actual=Math.min(target.hp,total-absorbed)+absorbed;target.shield=Math.max(0,(target.shield??0)-absorbed);target.hp=Math.max(0,target.hp-(total-absorbed));target.lastDamagedAt=s.time;
  for(const hit of hits)hit.event.amount=actual*hit.amount/total;
  target.lastAttacker=hits.reduce((best,h)=>h.amount>best.amount?h:best).source.id;
  if(target.hp===0)die(s,target);
 }
 const lost=[0,1].map(side=>!s.entities.some(e=>e.side===side&&e.role==='hq'&&alive(e)));
 if(lost[0]&&lost[1])s.draw=true;else if(lost[0]||lost[1])s.winner=lost[0]?1:0;
}
export function stepGame(s:GameState,dt:number):void{
 s.events=[];if(isGameOver(s)||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.25);s.time+=dt;s.tick++;const rt=runtime(s);rt.hits=[];rt.fog-=dt;if(rt.fog<=0){refreshVisibility(s);rt.fog=.2;}rt.ai-=dt;if(rt.ai<=0){for(const side of (rt.aiTurns++%2?[1,0]:[0,1]) as Side[])if(s.controllers[side]==='ai')runAI(s,side);rt.ai+=1;}
 for(const e of [...s.entities]){
 e.animTime+=dt;if(!alive(e))continue;if(e.expires&&s.time>=e.expires){die(s,e);continue;}e.cooldown=Math.max(0,e.cooldown-dt);if(e.animation!=='attack'||e.animTime>.4)e.animation='idle';e.momentum=Math.max(0,e.momentum-dt*.014);
 if(e.kind==='building'){if(e.progress===1&&buildingDef(s,e).ability==='heal')for(const ally of s.entities)if(ally.side===e.side&&alive(ally)&&ally.kind==='unit'&&distance(ally,e)<6)ally.hp=Math.min(ally.maxHp,ally.hp+dt*2.5);production(s,e,dt);if(e.role==='tower'&&e.progress===1){const b=enemy(s,e,7);if(b)fight(s,e,b,dt);}continue;}
 const d=unitDef(s,e);
 if(e.maxShield&&s.time-(e.lastDamagedAt??-6)>=6)e.shield=Math.min(e.maxShield,(e.shield??0)+4*dt);
 if(!e.illusion&&(d.ability==='raise'||d.ability==='ward'))useAbility(s,e);
 const o=e.order;
 // Holding units defend within weapon range without pursuing beyond their position.
 if(o.type==='hold'){const b=enemy(s,e,weaponRange(s,e),true);if(b&&near(s,e,b,weaponRange(s,e))){fight(s,e,b,dt);if(!e.illusion&&(d.ability==='illusion'||d.ability==='heal'||d.ability==='surge'&&s.entities.some(a=>a.side===e.side&&alive(a)&&a.kind==='unit'&&a.hp<=a.maxHp-15&&distance(e,a)<5)))useAbility(s,e);}continue;}
 if(o.type==='gather'){gather(s,e,o.target,dt);continue;}if(o.type==='build'){construct(s,e,o.target,dt);continue;}if(o.type==='move'){if(move(s,e,o,dt,.5))assign(s,e,{type:'idle'});continue;}
 if(o.type==='attack'){const b=s.entities.find(b=>b.id===o.target&&alive(b)&&b.side!==e.side);if(!b||!isVisible(s,e.side,b.x,b.y)){assign(s,e,{type:'idle'});continue;}fight(s,e,b,dt);continue;}
 const b=enemy(s,e,d.role==='worker'?2:Math.min(d.sight,7));if(b){fight(s,e,b,dt);if(!e.illusion&&(d.ability==='illusion'||d.ability==='heal'||d.ability==='surge'&&s.entities.some(a=>a.side===e.side&&alive(a)&&a.kind==='unit'&&a.hp<=a.maxHp-15&&distance(e,a)<5)))useAbility(s,e);}else if(o.type==='attackMove'&&move(s,e,o,dt,.65))assign(s,e,{type:'idle'});
 }
 resolveHits(s);
 s.corpses=s.corpses.filter(c=>c.expires>s.time);
 separateUnits(s);s.entities=s.entities.filter(e=>alive(e)||e.animTime<1.2);updatePopulation(s);
}
/** AI issues exactly the commands accepted for humans, using current visibility only. */
export function runAI(s:GameState,side:Side=1):void{
 if(isGameOver(s))return;const owned=s.entities.filter(e=>e.side===side&&alive(e)),workers=owned.filter(e=>e.kind==='unit'&&e.role==='worker'),buildings=owned.filter(e=>e.kind==='building'),hq=buildings.find(e=>e.role==='hq');if(!hq)return;
 const f=FACTIONS[s.players[side].faction],p=s.players[side];
 const available=s.resources.filter(n=>n.amount>0&&isVisible(s,side,n.x,n.y));
 const wantCrystal=buildings.some(b=>b.role==='barracks')&&available.some(n=>n.kind==='crystal')?(p.crystal<40?2:p.crystal<100?1:0):0;
 const desired={wood:Math.max(1,Math.ceil((workers.length-wantCrystal)*.6)),ore:Math.max(1,workers.length-wantCrystal-Math.ceil((workers.length-wantCrystal)*.6)),crystal:wantCrystal};
 const assigned={wood:0,ore:0,crystal:0};
 for(const worker of workers){if(worker.order.type==='gather'){const n=s.resources.find(n=>n.id===(worker.order as {target:number}).target);if(n&&n.amount>0)assigned[n.kind]++;}}
 for(const worker of workers.filter(e=>e.order.type==='idle'||e.order.type==='gather')){
  const current=worker.order.type==='gather'?s.resources.find(n=>n.id===(worker.order as {target:number}).target):undefined;
  if(current&&current.amount>0&&assigned[current.kind]<=desired[current.kind])continue;
  const kinds=(['wood','ore','crystal'] as const).filter(k=>available.some(n=>n.kind===k)).sort((a,b)=>(desired[b]-assigned[b])-(desired[a]-assigned[a]));
  const kind=kinds[0];if(!kind)continue;
  const node=available.filter(n=>n.kind===kind).sort((a,b)=>distance(worker,a)-distance(worker,b))[0];
  if(node&&issueCommand(s,side,{type:'gather',ids:[worker.id],target:node.id})){if(current)assigned[current.kind]--;assigned[kind]++;}
 }

 // Resume paid foundations before committing workers to additional buildings.
 for(const site of buildings.filter(b=>b.progress<1)){
  if(workers.some(w=>w.order.type==='build'&&w.order.target===site.id))continue;
  const builder=workers.filter(w=>w.order.type==='idle'||w.order.type==='gather').sort((a,b)=>distance(a,site)-distance(b,site))[0];
  if(builder)issueCommand(s,side,{type:'repair',ids:[builder.id],target:site.id});
 }
 if(workers.length+ hq.queue.filter(r=>r==='worker').length<9&&hq.queue.length<2)issueCommand(s,side,{type:'train',id:hq.id,role:'worker'});
 const queued=reserved(s,side);let buildRole:BuildingRole|undefined;
 if(!buildings.some(b=>b.role==='barracks'))buildRole='barracks';else if(p.cap-p.population-queued<5&&p.cap<100&&!buildings.some(b=>b.role==='depot'&&b.progress<1))buildRole='depot';else if(s.time>100&&!buildings.some(b=>b.role==='tower'))buildRole='tower';else if(s.time>180&&buildings.filter(b=>b.role==='barracks').length<(s.time>420&&p.wood>500&&p.ore>180?3:2))buildRole='barracks';
 if(buildRole&&!workers.some(e=>e.order.type==='build')){const builder=workers[0];if(builder){const dir=side===0?1:-1;let placed=false;for(let r=5;r<=10&&!placed;r+=2)for(let i=0;i<16&&!placed;i++){const angle=i*Math.PI/8;const x=hq.x+Math.round(Math.cos(angle)*r)*dir,y=hq.y+Math.round(Math.sin(angle)*r)*dir;if(canPlace(s,side,buildRole,x,y))placed=issueCommand(s,side,{type:'build',ids:[builder.id],role:buildRole,x,y});}}}
 const army=owned.filter(e=>e.kind==='unit'&&e.role!=='worker'&&!e.illusion);
 for(const b of buildings.filter(e=>e.role==='barracks'&&e.progress===1&&e.queue.length<2)){const n=army.length+b.queue.length;let role:UnitRole=n%5===4?'special':n%3===1?'ranged':'melee';
 if(f.ai.composition){
  const planned=[...army.filter(e=>!e.raised).map(e=>e.role),...buildings.flatMap(e=>e.queue).filter(r=>r!=='worker')];
  const roles=['melee','ranged','special'] as const;
  role=[...roles].sort((a,b)=>((planned.length+1)*f.ai.composition![b]-planned.filter(r=>r===b).length)-((planned.length+1)*f.ai.composition![a]-planned.filter(r=>r===a).length))[0];
 }
 issueCommand(s,side,{type:'train',id:b.id,role});}
 // Emplace within firing distance, and pack up when the position has no targets.
 for(const unit of army.filter(e=>unitDef(s,e).ability==='entrench')){
 const target=enemy(s,unit,unitDef(s,unit).range+(unit.role==='special'?3:0),true);
 if(target&&unit.entrenchedAt===undefined)issueCommand(s,side,{type:'ability',ids:[unit.id]});
 else if(!target&&unit.entrenchedAt!==undefined)issueCommand(s,side,{type:'ability',ids:[unit.id]});
 }
 const seen=s.entities.filter(e=>e.side!==side&&alive(e)&&isVisible(s,side,e.x,e.y));const threat=seen.find(e=>distance(e,hq)<12);const rt=runtime(s);
 if(threat){const ready=army.filter(e=>e.order.type!=='attack'&&e.entrenchedAt===undefined);if(ready.length)issueCommand(s,side,{type:'attackMove',ids:ready.map(e=>e.id),x:threat.x,y:threat.y});}
 else if(army.length>=f.ai.armySize&&s.time-rt.aiWave[side]>Math.max(25,65/f.ai.aggression)){
 const target=seen.find(e=>e.kind==='building'&&e.role==='hq')??seen[0];const destination=target??s.starts[side===0?1:0];issueCommand(s,side,{type:'attackMove',ids:army.filter(e=>e.entrenchedAt===undefined).map(e=>e.id),x:destination.x,y:destination.y});rt.aiWave[side]=s.time;
 }else if(!rt.initialScoutDispatched[side]&&s.time>65&&army.length&&army.every(e=>e.order.type==='idle')){const scout=army[0];if(issueCommand(s,side,{type:'attackMove',ids:[scout.id],x:hq.x+(s.starts[side===0?1:0].x-hq.x)*.7,y:hq.y+(s.starts[side===0?1:0].y-hq.y)*.7}))rt.initialScoutDispatched[side]=true;}
}
