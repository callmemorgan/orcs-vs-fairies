import { isServerObservation } from './presentation-observation';
import { factionConcealment } from './faction-systems';
import { buildingFor, unitFor } from './content-registry';
import { commanderAdmissionReason } from './commander-rules';
import type { ArtilleryModification } from './faction-systems';
import type { UnitDef, BuildingDef } from './types';
import { FACTIONS } from './content';
import { terrainAt } from './maps';
import type { Entity, FactionId, GameState, Side, UnitRole, Vec } from './types';

export type FormationKind='line'|'wedge'|'square'|'loose';
export type AmbushTarget='any'|'unit'|'building'|UnitRole;
export type TacticsCommand=
 | {type:'formation';ids:number[];formation:FormationKind;spacing:number;facing:number}
 | {type:'face';ids:number[];facing:number}
 | {type:'ambush';ids:number[];radius:number;target:AmbushTarget}
 | {type:'releaseAmbush';ids:number[]}
 | {type:'captureSiege';ids:number[];target:number};
export interface FormationState {kind:FormationKind;group:string;slot:number;count:number;spacing:number;facing:number;anchor:Vec;phase:'moving'|'broken'|'regrouping'|'formed'}
export interface TacticsState {
 morale:number;recentLoss:number;
 formation?:FormationState;
 retreat?:Vec & {until:number};
 surrenderedTo?:Side;
 ambush?:{radius:number;target:AmbushTarget;concealed:boolean;armedAt:number};
 charge?:{distance:number;heading:number;lastMovedAt:number};
 guard?:{value:number;max:number;lastDamagedAt:number};
 siegeCrew?:{hp:number;maxHp:number;uncrewed:boolean};
 capture?:{target:number;progress:number};
}
export interface SiegeProjectile extends Vec {id:number;source:number;side:Side;faction:FactionId;from:Vec & {elevation?:number};damage:number;buildingMultiplier:number;impactAt:number;radius:number;modification?:ArtilleryModification}
export const TACTICS={frontCos:.5,sideDamage:1.2,rearDamage:1.4,coverFactor:.65,shieldFraction:.6,shieldReach:3.5,shieldWidth:1.4,chargeDistance:5,chargeBonus:.8,pikeReturn:20,splashRadius:1.75,captureSeconds:4,crewHp:42,retreatMorale:22,surrenderMorale:10,scoutDetection:2.5,contactDetection:.8} as const;
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const level=(a:Vec)=>('level' in a?Number(a.level):0)||0;
const sameLevel=(a:Vec,b:Vec)=>level(a)===level(b);
const allied=(s:GameState,a:Side,b:Side)=>s.teams[a]===s.teams[b];
const hostile=(s:GameState,a:Side,b:Side)=>s.teams[a]!==s.teams[b];
const visible=(s:GameState,side:Side,p:Vec)=>s.visible[side]?.has(level(p)*s.width*s.height+Math.floor(p.y)*s.width+Math.floor(p.x))??false;
const dir=(facing:number)=>({x:Math.cos(facing*Math.PI/4),y:Math.sin(facing*Math.PI/4)});
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function tacticalUnitDef(s:GameState,e:Entity):UnitDef{return unitFor(s,e);}
export function isCrewless(e:Entity):boolean{return !!e.tactics?.siegeCrew?.uncrewed;}
export function initializeTactics(s:GameState,e:Entity):TacticsState {
 const t=e.tactics??={morale:100,recentLoss:0};
 if(e.kind==='unit'&&e.role==='siege'&&!t.siegeCrew)t.siegeCrew={hp:TACTICS.crewHp,maxHp:TACTICS.crewHp,uncrewed:false};
 if(e.kind==='unit'&&e.role==='melee'&&!t.guard&&['dwarves','tideborn','automata'].includes(e.definitionFaction??s.players[e.side].faction))t.guard={value:40,max:40,lastDamagedAt:0};
 return t;
}
export function canAmbush(s:GameState,e:Entity):boolean {
 if(e.kind!=='unit'||e.hp<=0||e.illusion||e.role==='worker'||e.role==='siege'||isCrewless(e))return false;
 // Forest maps expose wooded cover as tiles. Existing maps use live wood nodes.
 return (terrainAt(s,e.x,e.y,e.level??0) as string)==='forest'||s.resources.some(r=>r.kind==='wood'&&r.amount>0&&sameLevel(e,r)&&distance(e,r)<=1.5);
}
/** Concealment is evaluated independently for each viewer; another team's scout cannot reveal it. */
export function canObserveTacticalEntity(s:GameState,side:Side,e:Entity):boolean {
 if(isServerObservation(s))return true;
 if(e.side===side&&!isCrewless(e))return true;
 if(!visible(s,side,e))return false;
 if(!(e.tactics?.ambush?.concealed||factionConcealment(s,e))||allied(s,side,e.side))return true;
 return s.entities.some(observer=>observer.hp>0&&!observer.illusion&&!isCrewless(observer)&&sameLevel(observer,e)&&(observer.side===side||s.sharedVision&&allied(s,side,observer.side))&&distance(observer,e)<=(observer.role==='cavalry'?TACTICS.scoutDetection:TACTICS.contactDetection));
}
export function canCaptureSiege(s:GameState,captor:Entity,target:Entity):boolean {
 return captor.hp>0&&captor.kind==='unit'&&!captor.illusion&&!captor.raised&&!isCrewless(captor)&&['worker','melee','spear','special'].includes(captor.role)&&target.hp>0&&target.kind==='unit'&&target.role==='siege'&&isCrewless(target)&&sameLevel(captor,target)&&canObserveTacticalEntity(s,captor.side,target);
}
export function formationOffset(kind:FormationKind,slot:number,count:number,spacing:number):Vec {
 if(kind==='line')return {x:(slot-(count-1)/2)*spacing,y:0};
 if(kind==='wedge'){
  if(slot===0)return {x:0,y:0};const row=Math.ceil(slot/2);return {x:(slot%2?-1:1)*row*spacing*.75,y:-row*spacing};
 }
 const columns=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/columns),row=Math.floor(slot/columns),inRow=Math.min(columns,count-row*columns),scale=kind==='loose'?1.8:1;
 return {x:(slot%columns-(inRow-1)/2)*spacing*scale,y:(row-(rows-1)/2)*spacing*scale};
}
export function formationDestination(f:FormationState,s?:GameState):Vec {
 const offset=formationOffset(f.kind,f.slot,f.count,f.spacing),front=dir(f.facing);
 // Local x runs across the front; local y runs in its facing direction.
 return {x:clamp(f.anchor.x-front.y*offset.x+front.x*offset.y,s ? .6 : 0,s?s.width-.6:1e9),y:clamp(f.anchor.y+front.x*offset.x+front.y*offset.y,s ? .6 : 0,s?s.height-.6:1e9),...('level' in f.anchor?{level:f.anchor.level}:{})};
}
export function setFormation(s:GameState,units:Entity[],kind:FormationKind,spacing:number,facing:number,anchor:Vec):void {
 const sorted=[...units].sort((a,b)=>a.id-b.id),group=`${s.tick}:${sorted.map(e=>e.id).join(',')}`;
 const previous=new Set(sorted.map(e=>e.tactics?.formation?.group).filter(Boolean));
 for(const e of s.entities)if(e.tactics?.formation&&previous.has(e.tactics.formation.group)&&!sorted.includes(e))delete e.tactics.formation;
 sorted.forEach((e,slot)=>{const t=initializeTactics(s,e);delete t.ambush;delete t.capture;t.formation={kind,group,slot,count:sorted.length,spacing,facing,anchor:{...anchor},phase:'moving'};e.facing=facing;});
}
/** Repack casualties in ID order; individual routes may break the shape and regroup at its saved anchor. */
export function refreshFormations(s:GameState):void {
 const groups=new Map<string,Entity[]>();
 for(const e of s.entities)if(e.hp>0&&!isCrewless(e)&&e.tactics?.formation){const group=groups.get(e.tactics.formation.group)??[];group.push(e);groups.set(e.tactics.formation.group,group);}
 for(const units of groups.values()){
  units.sort((a,b)=>a.id-b.id);const changed=units.some(e=>e.tactics!.formation!.count!==units.length);
  units.forEach((e,slot)=>{const f=e.tactics!.formation!;if(changed){f.slot=slot;f.count=units.length;f.phase='regrouping';e.path=[];}if(f.phase!=='broken'){const destination=formationDestination(f,s);if(distance(e,destination)<=.55){f.phase='formed';e.facing=f.facing;}else if(e.order.type==='idle'||e.order.type==='hold'){f.phase='regrouping';e.order={type:'move',...destination};}}});
 }
}
export function facingDamageFactor(source:Vec,target:Entity):number {
 if(target.kind!=='unit'||distance(source,target)<.001)return 1;
 const front=dir(target.facing),d=distance(source,target),dot=((source.x-target.x)*front.x+(source.y-target.y)*front.y)/d;
 return dot>=TACTICS.frontCos?1:dot<=-TACTICS.frontCos?TACTICS.rearDamage:TACTICS.sideDamage;
}
function segmentDistance(point:Vec,a:Vec,b:Vec):number {
 const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/l,0,1):0;return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
export function rangedCoverFactor(s:GameState,source:Vec,target:Entity):number {
 if(!sameLevel(source,target))return 1;
 const length=distance(source,target);if(length<1.8)return 1;
 // Cover must stand between the shot and its victim, within three tiles of the victim.
 const between=(p:Vec,radius:number)=>sameLevel(p,target)&&distance(p,target)<radius+3&&distance(p,source)>radius+.4&&distance(p,target)>.3&&segmentDistance(p,source,target)<radius+.1;
 for(const e of s.entities)if(e.id!==target.id&&e.hp>0&&e.kind==='building'&&e.progress===1){const radius=buildingFor(s,e).size/2;if(between(e,radius))return TACTICS.coverFactor;}
 for(let y=Math.max(0,Math.floor(target.y-3));y<=Math.min(s.height-1,Math.ceil(target.y+3));y++)for(let x=Math.max(0,Math.floor(target.x-3));x<=Math.min(s.width-1,Math.ceil(target.x+3));x++)if(terrainAt(s,x+.5,y+.5,target.level??0)==='rock'&&between({x:x+.5,y:y+.5,level:target.level??0},.55))return TACTICS.coverFactor;
 return 1;
}
/** Shield energy absorbs intercepted damage; rear shots and shots outside the support cone bypass it. */
export function interceptDirectionalShield(s:GameState,source:Vec,target:Entity,amount:number):{remaining:number;intercepted:{bearer:Entity;amount:number}[]} {
 if(target.kind!=='unit')return {remaining:amount,intercepted:[]};
 const candidates=s.entities.filter(b=>b!==target&&b.hp>0&&b.kind==='unit'&&!b.illusion&&!isCrewless(b)&&sameLevel(b,target)&&allied(s,b.side,target.side)&&(b.tactics?.guard?.value??0)+(b.shield??0)>0).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id);
 let remaining=amount;const intercepted:{bearer:Entity;amount:number}[]=[];
 for(const bearer of candidates){const front=dir(bearer.facing),vx=target.x-bearer.x,vy=target.y-bearer.y,depth=-(vx*front.x+vy*front.y),width=Math.abs(vx*front.y-vy*front.x),shot=distance(source,bearer),attackFront=shot?((source.x-bearer.x)*front.x+(source.y-bearer.y)*front.y)/shot:0;
  if(depth<.2||depth>TACTICS.shieldReach||width>TACTICS.shieldWidth+depth*.2||attackFront<TACTICS.frontCos||segmentDistance(bearer,source,target)>.85)continue;
  const guard=bearer.tactics?.guard,available=(guard?.value??0)+(bearer.shield??0),absorbed=Math.min(remaining*TACTICS.shieldFraction,available);if(absorbed<=0)continue;
  let energy=absorbed;if(guard){const spent=Math.min(guard.value,energy);guard.value-=spent;energy-=spent;guard.lastDamagedAt=s.time;}bearer.shield=Math.max(0,(bearer.shield??0)-energy);bearer.lastDamagedAt=s.time;remaining-=absorbed;intercepted.push({bearer,amount:absorbed});
  // One bearer protects a shot. A line of shields cannot stack to immunity.
  break;
 }
 return {remaining,intercepted};
}
export function updateCharge(s:GameState,e:Entity,from:Vec,dt:number):void {
 if(e.role!=='cavalry'||e.illusion)return;const t=initializeTactics(s,e),moved=distance(from,e),c=t.charge??={distance:0,heading:e.facing,lastMovedAt:s.time};
 if(moved>dt*.5){const turn=Math.abs(Math.atan2(Math.sin((e.facing-c.heading)*Math.PI/4),Math.cos((e.facing-c.heading)*Math.PI/4)));if(turn>Math.PI/4+.01)c.distance=0;c.distance=Math.min(TACTICS.chargeDistance,c.distance+moved);c.heading=e.facing;c.lastMovedAt=s.time;}

}
export function ageCharge(s:GameState,e:Entity,dt:number):void {const c=e.tactics?.charge;if(c&&s.time-c.lastMovedAt>.25)c.distance=Math.max(0,c.distance-dt*5);}
export function cavalryImpact(s:GameState,source:Entity,target:Entity):{factor:number;pikeDamage:number} {
 if(source.role!=='cavalry'||source.illusion)return {factor:1,pikeDamage:0};
 const c=initializeTactics(s,source).charge,turn=c?Math.abs(Math.atan2(Math.sin((source.facing-c.heading)*Math.PI/4),Math.cos((source.facing-c.heading)*Math.PI/4))):0,distanceCharged=turn>Math.PI/4+.01?0:c?.distance??0,charged=distanceCharged>=1.5,front=facingDamageFactor(source,target)===1,braced=target.kind==='unit'&&target.role==='spear'&&target.order.type==='hold'&&front;
 if(c)c.distance=0;
 return braced&&charged?{factor:1,pikeDamage:TACTICS.pikeReturn*(distanceCharged/TACTICS.chargeDistance)}:{factor:1+TACTICS.chargeBonus*(distanceCharged/TACTICS.chargeDistance),pikeDamage:0};
}
export function recordTacticsDamage(s:GameState,target:Entity,damage:number):void {
 if(target.kind!=='unit'||target.illusion||isCrewless(target))return;const t=initializeTactics(s,target);t.morale=Math.max(0,t.morale-damage/target.maxHp*65);if(t.ambush?.concealed){t.ambush.concealed=false;s.events.push({type:'message',side:target.side,x:target.x,y:target.y,source:target.id,text:'Ambush exposed by damage'});}
}
export function recordTacticsDeath(s:GameState,target:Entity):void {
 if(target.kind!=='unit'||target.illusion||isCrewless(target))return;
 for(const ally of s.entities)if(ally!==target&&ally.hp>0&&ally.kind==='unit'&&!ally.illusion&&!isCrewless(ally)&&sameLevel(ally,target)&&allied(s,ally.side,target.side)&&distance(ally,target)<6){const t=initializeTactics(s,ally);t.recentLoss=Math.min(60,t.recentLoss+12);t.morale=Math.max(0,t.morale-12);}
}
export function updateTactics(s:GameState,e:Entity,dt:number,interruptOrder?:(actor:Entity)=>void):{skipCombat:boolean;retreat?:Vec} {
 const t=initializeTactics(s,e);if(isCrewless(e))return {skipCombat:true};
 if(t.guard&&s.time-t.guard.lastDamagedAt>=8)t.guard.value=Math.min(t.guard.max,t.guard.value+dt*2);
 t.recentLoss=Math.max(0,t.recentLoss-dt*2);
 if(e.role==='worker'||e.illusion||e.role==='siege')return {skipCombat:false};
 const support=s.entities.filter(a=>a!==e&&a.hp>0&&a.kind==='unit'&&a.role!=='worker'&&!a.illusion&&!isCrewless(a)&&sameLevel(a,e)&&allied(s,a.side,e.side)&&distance(a,e)<4.5).length;
 const enemies=s.entities.filter(a=>a.hp>0&&!isCrewless(a)&&sameLevel(a,e)&&hostile(s,a.side,e.side)&&canObserveTacticalEntity(s,e.side,a)&&distance(a,e)<5.5);
 const wounded=e.hp/e.maxHp<.65;
 t.morale=clamp(t.morale+dt*(support?Math.min(4,1+support*.65):enemies.length&&wounded?-4:enemies.length?-.4:2.5),0,100);
 if(t.morale<=TACTICS.surrenderMorale){const captors=enemies.filter(a=>a.kind==='unit'&&!a.illusion&&!a.raised&&['worker','melee','spear','special'].includes(a.role)&&distance(a,e)<2.5),sectors=new Set(captors.map(a=>(Math.round(Math.atan2(a.y-e.y,a.x-e.x)/(Math.PI/4))+8)%8)),surrounded=captors.length>=3&&sectors.size>=3&&captors.some(a=>captors.some(b=>(a.x-e.x)*(b.x-e.x)+(a.y-e.y)*(b.y-e.y)<0));
  if(surrounded){const captor=captors.sort((a,b)=>distance(a,e)-distance(b,e)||a.id-b.id)[0];
   if(e.raised||!unitFor(s,e).tags?.includes('hero')||!commanderAdmissionReason(s,captor.side)){
    const former=e.side;interruptOrder?.(e);e.definitionFaction??=s.players[former].faction;e.side=captor.side;if(e.factionState){delete e.factionState.chant;delete e.factionState.tunnel;delete e.factionState.corpseOrder;}t.morale=35;t.surrenderedTo=captor.side;delete t.retreat;delete t.formation;delete t.ambush;delete t.capture;e.order={type:'hold'};delete e.orderQueue;e.path=[];s.events.push({type:'message',side:former,x:e.x,y:e.y,source:e.id,text:'A surrounded unit surrendered'}, {type:'message',side:e.side,x:e.x,y:e.y,source:e.id,text:'Captured a surrendered unit'});return {skipCombat:true};
   }
  }
 }
 if(!t.retreat&&t.morale< TACTICS.retreatMorale&&enemies.length){
  const refuge=s.entities.filter(a=>a.hp>0&&!isCrewless(a)&&sameLevel(a,e)&&allied(s,a.side,e.side)&&a.kind==='building'&&(a.role==='hq'||a.role==='depot')&&(a.side===e.side||visible(s,e.side,a))).sort((a,b)=>distance(a,e)-distance(b,e))[0];
  let destination:Vec;if(refuge&&distance(refuge,e)>3)destination={x:refuge.x,y:refuge.y,...('level' in refuge?{level:refuge.level}:{})};else {const threats=enemies.reduce((p,a)=>({x:p.x+a.x,y:p.y+a.y}),{x:0,y:0}),dx=e.x-threats.x/enemies.length,dy=e.y-threats.y/enemies.length,d=Math.hypot(dx,dy)||1;destination={x:clamp(e.x+dx/d*6,.6,s.width-.6),y:clamp(e.y+dy/d*6,.6,s.height-.6),...('level' in e?{level:e.level}:{})};}
  interruptOrder?.(e);t.retreat={...destination,until:s.time+8};delete t.formation;delete t.ambush;delete t.capture;delete e.orderQueue;e.order={type:'move',...destination};e.path=[];s.events.push({type:'message',side:e.side,x:e.x,y:e.y,source:e.id,text:'Low morale: retreating to support'});
 }
 if(t.retreat){if(s.time>=t.retreat.until&&t.morale>=30){interruptOrder?.(e);delete t.retreat;e.order={type:'hold'};return {skipCombat:false};}return {skipCombat:true,retreat:t.retreat};}
 if(t.ambush?.concealed){if(!canAmbush(s,e)){t.ambush.concealed=false;s.events.push({type:'message',side:e.side,x:e.x,y:e.y,source:e.id,text:'Ambush lost concealment'});}else {const a=t.ambush,target=enemies.filter(b=>distance(e,b)<=a.radius&&(a.target==='any'||a.target===b.kind||a.target===b.role)).sort((x,y)=>distance(e,x)-distance(e,y)||x.id-y.id)[0];if(!target)return {skipCombat:true};interruptOrder?.(e);a.concealed=false;t.ambush=a;e.order={type:'attack',target:target.id};s.events.push({type:'message',side:e.side,x:e.x,y:e.y,source:e.id,text:'Ambush triggered'});}}
 return {skipCombat:false};
}
export function updateSiegeCapture(s:GameState,e:Entity,dt:number,interruptOrder?:(actor:Entity)=>void):{target?:Entity;complete:boolean} {
 const capture=e.tactics?.capture;if(!capture)return {complete:false};const target=s.entities.find(a=>a.id===capture.target);
 if(!target||!canCaptureSiege(s,e,target)){delete e.tactics!.capture;return {complete:false};}
 if(distance(e,target)>1.3)return {target,complete:false};
 const contested=s.entities.some(a=>a.hp>0&&!isCrewless(a)&&a.kind==='unit'&&sameLevel(a,target)&&hostile(s,e.side,a.side)&&canObserveTacticalEntity(s,e.side,a)&&distance(a,target)<2);
 if(contested){capture.progress=0;return {target,complete:false};}
 capture.progress=Math.min(1,capture.progress+dt/TACTICS.captureSeconds);
 if(capture.progress<1)return {target,complete:false};
 interruptOrder?.(target);interruptOrder?.(e);target.definitionFaction??=s.players[target.side].faction;target.side=e.side;if(target.factionState){delete target.factionState.chant;delete target.factionState.tunnel;delete target.factionState.corpseOrder;}const crew=target.tactics!.siegeCrew!;crew.uncrewed=false;crew.hp=crew.maxHp;target.order={type:'hold'};target.cooldown=1;delete target.tactics!.retreat;target.tactics!.morale=60;delete e.tactics!.capture;e.order={type:'hold'};s.events.push({type:'message',side:e.side,x:target.x,y:target.y,source:e.id,target:target.id,text:'Siege crew replaced: engine captured'});return {target,complete:true};
}
