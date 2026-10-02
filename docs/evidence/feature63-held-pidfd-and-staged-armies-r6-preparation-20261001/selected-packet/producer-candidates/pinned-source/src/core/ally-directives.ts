import { validateCommand } from './commands';
import { factionFor } from './content-registry';
import { levelOf, sameLevel } from './world-map';
import { length2D } from './geometry';
import { MAX_TEAM_DIRECTIVES, MAX_TEAM_TRANSFERS } from './team-ai';
import type { AllyDirective, TeamAiState } from './team-ai';
import type { AlliedCommand, Command, Entity, GameState, Side, Vec } from './types';

const kinds=['wood','ore','crystal'] as const;
const active=(d:AllyDirective)=>d.status==='accepted'||d.status==='active';
const distance=(a:Vec,b:Vec)=>sameLevel(a,b)?length2D(a.x-b.x,a.y-b.y):Infinity;
type Visibility=(side:Side,x:number,y:number,level?:number)=>boolean;
function allies(s:GameState,a:Side,b:Side):boolean{return a!==b&&!!s.players[a]&&!!s.players[b]&&s.teams[a]===s.teams[b]&&!s.eliminated[a]&&!s.eliminated[b];}
function trimDirectives(state:TeamAiState):void {
 while(state.directives.length>MAX_TEAM_DIRECTIVES){const index=state.directives.findIndex(d=>!active(d));if(index<0)break;state.directives.splice(index,1);}
}

/** The caller's authenticated side is the sole payer or request issuer. */
export function applyAlliedPlayerCommand(s:GameState,side:Side,c:AlliedCommand,state:TeamAiState,visible:Visibility):boolean {
 if(!validateCommand(c)||!s.players[side]||s.eliminated[side])return false;
 if(c.type==='transferResources'){
  if(!allies(s,side,c.recipient))return false;
  const payer=s.players[side],recipient=s.players[c.recipient];
  if(kinds.some(k=>payer[k]<c.resources[k]||!Number.isFinite(recipient[k]+c.resources[k])||recipient[k]+c.resources[k]>1e12))return false;
  for(const kind of kinds){payer[kind]-=c.resources[kind];recipient[kind]+=c.resources[kind];}
  state.transfers.push({id:state.nextTransferId++,sender:side,recipient:c.recipient,resources:{...c.resources},time:s.time});
  state.transfers=state.transfers.slice(-MAX_TEAM_TRANSFERS);return true;
 }
 if(c.type==='cancelAllyDirective'){
  const d=state.directives.find(d=>d.id===c.directiveId&&d.issuer===side&&active(d));if(!d)return false;
  d.status='cancelled';d.assigned=[];d.reason='Cancelled by requester.';return true;
 }
 if(!allies(s,side,c.ally)||s.controllers[c.ally]!=='ai')return false;
 let destination:Vec|undefined,observedTarget:number|undefined;
 if(c.directive!=='support'){
  if('target' in c){const target=s.entities.find(e=>e.id===c.target&&e.hp>0&&s.teams[e.side]!==s.teams[side]&&visible(side,e.x,e.y,levelOf(e)));if(!target)return false;destination={x:target.x,y:target.y,...(target.level===undefined?{}:{level:target.level})};observedTarget=target.id;}
  else destination={x:c.x,y:c.y,...(c.level===undefined?{}:{level:c.level})};
  if(levelOf(destination)>=(s.world?.levels.length??1)||destination.x<0||destination.y<0||destination.x>=s.width||destination.y>=s.height)return false;
 }
 const previous=state.directives.find(d=>d.recipient===c.ally&&active(d));
 if(previous&&previous.issuer!==side)return false;
 if(previous){previous.status='cancelled';previous.assigned=[];previous.reason='Replaced by requester.';}
 const duration=c.directive==='support'?30:c.directive==='defend'?90:c.directive==='scout'?150:180;
 state.directives.push({id:state.nextDirectiveId++,issuer:side,recipient:c.ally,kind:c.directive,
  ...(destination?{destination}:{}),...(observedTarget!==undefined?{observedTarget}:{}),
  ...(c.directive==='support'?{resources:{...c.resources}}:{}),createdAt:s.time,expiresAt:s.time+duration,status:'accepted',assigned:[]});
 trimDirectives(state);return true;
}

function sendMove(s:GameState,side:Side,units:Entity[],point:Vec,type:'move'|'attackMove',execute:(side:Side,c:Command)=>boolean):boolean {
 if(!units.length)return false;
 const formation=Math.max(1.5,Math.sqrt(units.length));
 if(units.every(e=>e.order.type===type&&distance(e.order,point)<formation||distance(e,point)<2&&e.order.type==='hold'))return true;
 let accepted=false;for(let i=0;i<units.length;i+=100)if(execute(side,{type,ids:units.slice(i,i+100).map(e=>e.id),x:point.x,y:point.y,...(point.level===undefined?{}:{level:point.level})}))accepted=true;return accepted;
}

/** Execute one recipient's requests with owned troops and ordinary public commands. */
export function processAllyDirectives(s:GameState,side:Side,state:TeamAiState,available:Entity[],emergency:boolean,visible:Visibility,execute:(side:Side,c:Command)=>boolean):Set<number> {
 for(const d of state.directives.filter(active))if(s.time>=d.expiresAt||!allies(s,d.issuer,d.recipient)||s.controllers[d.recipient]!=='ai'){
  d.status='failed';d.assigned=[];d.reason=s.time>=d.expiresAt?'Request expired.':'Ally is unavailable.';
 }
 const reserved=new Set<number>(),d=state.directives.find(d=>d.recipient===side&&active(d));if(!d)return reserved;
 if(d.kind==='support'){
  d.status='active';
  if(emergency){d.reason='Defending the stronghold before sending supplies.';return reserved;}
  const resources=d.resources!,p=s.players[side],worker=factionFor(s,side).units.worker.cost;
  if(p.wood<resources.wood+worker.wood||p.ore<resources.ore+worker.ore||p.crystal<resources.crystal+worker.crystal){d.reason='Waiting for spare resources.';return reserved;}
  if(execute(side,{type:'transferResources',recipient:d.issuer,resources:{...resources}})){d.status='completed';d.reason='Resources transferred.';}
  return reserved;
 }
 available=available.filter(e=>sameLevel(e,d.destination!));
 const availableIds=new Set(available.map(e=>e.id));d.assigned=d.assigned.filter(id=>availableIds.has(id));
 if(!d.assigned.length){
  delete d.arrivedAt;
  const sorted=[...available].sort((a,b)=>d.kind==='scout'?Number(b.role==='cavalry')-Number(a.role==='cavalry')||a.id-b.id:a.id-b.id);
  d.assigned=sorted.slice(0,d.kind==='scout'?1:d.kind==='defend'?3:sorted.length).map(e=>e.id);
 }
 d.assigned.forEach(id=>reserved.add(id));
 if(!d.assigned.length){d.reason='Waiting for available troops.';return reserved;}
 if(emergency){delete d.arrivedAt;d.reason='Defending the stronghold before continuing the request.';return reserved;}
 const units=available.filter(e=>reserved.has(e.id)),point=d.destination!;
 d.status='active';delete d.reason;
 // Ordinary move commands spread each batch of at most 100 units around the point.
 const formationRadius=.4*(Math.ceil(Math.sqrt(Math.min(100,units.length)))-1)*length2D(1,1)+1;
 const arrived=units.every(e=>distance(e,point)<Math.max(3,formationRadius))&&visible(side,point.x,point.y,levelOf(point));
 if(d.kind==='scout'&&arrived){d.status='completed';d.reason='Scout reached and observed the destination.';d.assigned=[];return new Set();}
 if(d.kind==='scout'){sendMove(s,side,units,point,'move',execute);return reserved;}
 const enemies=s.entities.filter(e=>e.hp>0&&s.teams[e.side]!==s.teams[side]&&visible(side,e.x,e.y,levelOf(e))&&distance(e,point)<7);
 if(d.kind==='attack'){
  if(arrived&&!enemies.length){d.arrivedAt??=s.time;if(s.time-d.arrivedAt>=3){d.status='completed';d.reason='Requested area observed and cleared.';d.assigned=[];return new Set();}}
  else delete d.arrivedAt;
  sendMove(s,side,units,point,'attackMove',execute);return reserved;
 }
 if(arrived){d.arrivedAt??=s.time;if(s.time-d.arrivedAt>=20){d.status='completed';d.reason='Troops guarded the destination.';d.assigned=[];return new Set();}}
 else delete d.arrivedAt;
 const threat=enemies[0];
 if(threat)sendMove(s,side,units,threat,'attackMove',execute);
 else if(arrived){const moving=units.filter(e=>e.order.type!=='hold');if(moving.length)execute(side,{type:'hold',ids:moving.map(e=>e.id)});}
 else sendMove(s,side,units,point,'attackMove',execute);
 return reserved;
}

/** Public team receipts omit assigned units, private orders and private banks. */
export function alliedAiObservation(s:GameState,side:Side,state:TeamAiState){
 const team=s.teams[side];
 return {allies:s.players.flatMap((p,i)=>i!==side&&s.teams[i]===team&&s.controllers[i]==='ai'&&!s.eliminated[i]?[{side:i as Side,faction:p.faction}]:[]),
  directives:state.directives.filter(d=>s.teams[d.issuer]===team).map(({assigned:_assigned,...d})=>structuredClone(d)),
  transfers:state.transfers.filter(t=>s.teams[t.sender]===team).map(t=>structuredClone(t))};
}
