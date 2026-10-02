import type { Cost, Side, TeamId, UnitRole, Vec } from './types';
import { length2D } from './geometry';
import { levelOf, sameLevel } from './world-map';

export const TEAM_ATTACK_MIN_FIGHTERS=4;
export const TEAM_ATTACK_MIN_PARTICIPANTS=2;
export const TEAM_AI_REPORT_TTL=6;
export const TEAM_AI_WAVE_DELAY=3;
export const TEAM_AI_WAVE_LIFETIME=12;
export const TEAM_AI_COMMAND_IDS=100;
export const TEAM_AI_SCOUT_LEASE=30;
export const TEAM_AI_EXPANSION_LEASE=45;
export const MAX_TEAM_AI_RESERVATIONS=16;
export const MAX_TEAM_AI_WAVES=8;
export const MAX_TEAM_DIRECTIVES=32;
export const MAX_TEAM_TRANSFERS=64;

export interface TeamAiFighter extends Vec {id:number;role:Exclude<UnitRole,'worker'>}
export interface TeamAiTarget extends Vec {key:string;kind:'hq'|'building'|'unit'|'start';observer:Side;seenAt:number}
/** Owners supply available troops and their permitted observations, never a full match. */
export interface TeamAiReport {
 side:Side;teamId:TeamId;time:number;hq:Vec;fighters:TeamAiFighter[];
 threats:(Vec & {id:number})[];targets:TeamAiTarget[];
 readyToAttack:boolean;waveReadyAt:number;scoutingNeeded:boolean;expansion?:Vec;soloReadyToAttack?:boolean;soloAttackSize?:number;
}
export interface TeamAiReservation {
 teamId:TeamId;side:Side;role:'scout'|'expand';key:string;destination:Vec;
 ids:number[];createdAt:number;expiresAt:number;
}
export interface TeamAiWave {
 id:number;teamId:TeamId;target:TeamAiTarget;
 participants:{side:Side;ids:number[]}[];launchAt:number;expiresAt:number;launched:boolean;
}
export interface TeamAiCoordinator {nextWaveId:number;reservations:TeamAiReservation[];waves:TeamAiWave[]}
export type AllyDirectiveKind='defend'|'scout'|'attack'|'support';
export type AllyDirectiveStatus='accepted'|'active'|'completed'|'failed'|'cancelled';
export interface AllyDirective {
 id:number;issuer:Side;recipient:Side;kind:AllyDirectiveKind;destination?:Vec;
 observedTarget?:number;resources?:Cost;createdAt:number;expiresAt:number;
 status:AllyDirectiveStatus;assigned:number[];arrivedAt?:number;reason?:string;
}
export interface TeamAiTransfer {id:number;sender:Side;recipient:Side;resources:Cost;time:number}
export interface TeamAiState {
 coordinator:TeamAiCoordinator;directives:AllyDirective[];nextDirectiveId:number;
 nextTransferId:number;transfers:TeamAiTransfer[];
}
export interface TeamAiAssignment {
 side:Side;role:'defend'|'scout'|'expand'|'attack';ids:number[];destination:Vec;
 targetKey?:string;waveId?:number;launchAt?:number;
}
export interface TeamAiLaunch {side:Side;ids:number[];destination:Vec;waveId:number}
export interface TeamAiCoordination {coordinator:TeamAiCoordinator;assignments:TeamAiAssignment[];launches:TeamAiLaunch[]}

export function emptyTeamAiState():TeamAiState {
 return {coordinator:{nextWaveId:1,reservations:[],waves:[]},directives:[],nextDirectiveId:1,nextTransferId:1,transfers:[]};
}
export function hasTeamAiMemory(state:TeamAiState):boolean {
 return state.nextDirectiveId!==1||state.nextTransferId!==1||state.coordinator.nextWaveId!==1||
  state.directives.length>0||state.transfers.length>0||state.coordinator.reservations.length>0||state.coordinator.waves.length>0;
}
const point=(v:Vec):Vec=>({x:v.x,y:v.y,...(v.level===undefined?{}:{level:v.level})});
const distance=(a:Vec,b:Vec)=>sameLevel(a,b)?length2D(a.x-b.x,a.y-b.y):Infinity;
const targetRank={hq:0,building:1,unit:2,start:3};
const keyCompare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const pointKey=(v:Vec)=>`${levelOf(v)}:${v.x},${v.y}`;
const copyReservation=(r:TeamAiReservation):TeamAiReservation=>({...r,destination:point(r.destination),ids:[...r.ids].sort((a,b)=>a-b)});
const copyWave=(w:TeamAiWave):TeamAiWave=>({...w,target:{...w.target},participants:w.participants.map(p=>({side:p.side,ids:[...p.ids].sort((a,b)=>a-b)})).sort((a,b)=>a.side-b.side)});

/** Pure planning. Returned launch commands must be applied together in this step. */
export function coordinateTeamAi(previous:TeamAiCoordinator,reports:readonly TeamAiReport[],time:number):TeamAiCoordination {
 if(!Number.isFinite(time)||time<0)throw new Error('Invalid team AI planning time.');
 const sides=new Set<Side>();
 for(const report of reports){if(sides.has(report.side))throw new Error('Duplicate team AI owner report.');sides.add(report.side);}
 const current=reports.filter(r=>r.time<=time&&time-r.time<=TEAM_AI_REPORT_TTL).map(r=>({...r,hq:point(r.hq),fighters:r.fighters.map(f=>({...f})).sort((a,b)=>a.id-b.id),threats:r.threats.map(t=>({...t})),targets:r.targets.map(t=>({...t})),expansion:r.expansion?point(r.expansion):undefined})).sort((a,b)=>a.side-b.side);
 const groups=new Map<TeamId,TeamAiReport[]>();
 for(const report of current){const group=groups.get(report.teamId)??[];group.push(report);groups.set(report.teamId,group);}
 const coordinator:TeamAiCoordinator={nextWaveId:previous.nextWaveId,reservations:[],waves:[]};
 const assignments:TeamAiAssignment[]=[],launches:TeamAiLaunch[]=[];
 for(const [teamId,members] of [...groups].sort(([a],[b])=>a-b)){
  if(members.length<TEAM_ATTACK_MIN_PARTICIPANTS)continue;
  const memberBySide=new Map(members.map(m=>[m.side,m]));
  const fighters=members.flatMap(m=>m.fighters.map(f=>({...f,side:m.side})));
  const occupied=new Set<number>();
  const threats=new Map<number,Vec & {id:number}>();
  for(const member of [...members].sort((a,b)=>b.time-a.time||a.side-b.side))for(const threat of [...member.threats].sort((a,b)=>a.id-b.id))if(!threats.has(threat.id))threats.set(threat.id,{...threat});
  // The closest available owned troops answer each reported threat before other roles.
  for(const threat of [...threats.values()].sort((a,b)=>a.id-b.id)){
   const defenders=fighters.filter(f=>!occupied.has(f.id)&&sameLevel(f,threat)).sort((a,b)=>distance(a,threat)-distance(b,threat)||a.side-b.side||a.id-b.id).slice(0,3);
   for(const member of members){const ids=defenders.filter(f=>f.side===member.side).map(f=>f.id).sort((a,b)=>a-b);if(!ids.length)continue;ids.forEach(id=>occupied.add(id));assignments.push({side:member.side,role:'defend',ids,destination:point(threat),targetKey:`threat:${threat.id}`});}
  }
  const oldWave=previous.waves.filter(w=>w.teamId===teamId).sort((a,b)=>a.id-b.id)[0];
  let wave:TeamAiWave|undefined;
  let launchedThisStep=false;
  if(oldWave){
   wave=copyWave(oldWave);
   wave.participants=wave.participants.flatMap(p=>{
    const report=memberBySide.get(p.side);if(!report)return [];
    const available=new Set(report.fighters.filter(f=>sameLevel(f,wave!.target)).map(f=>f.id));
    const ids=p.ids.filter(id=>available.has(id)&&!occupied.has(id));return ids.length?[{side:p.side,ids}]:[];
   });
   const total=wave.participants.reduce((sum,p)=>sum+p.ids.length,0);
   if(!wave.launched&&wave.participants.length&&time>=wave.launchAt&&
    (wave.participants.length>=TEAM_ATTACK_MIN_PARTICIPANTS&&total>=TEAM_ATTACK_MIN_FIGHTERS||time>=wave.expiresAt)){
    for(const participant of wave.participants)for(let i=0;i<participant.ids.length;i+=TEAM_AI_COMMAND_IDS)launches.push({side:participant.side,ids:participant.ids.slice(i,i+TEAM_AI_COMMAND_IDS),destination:point(wave.target),waveId:wave.id});
    wave.launched=true;launchedThisStep=true;
    for(const p of wave.participants)p.ids.forEach(id=>occupied.add(id));
   }
   if(!wave.participants.length||time>=wave.expiresAt)wave=undefined;
  }
  // A saved scout belongs to one owner. Missing troops or a completed request release it.
  let reservations=previous.reservations.filter(r=>r.teamId===teamId&&r.expiresAt>time).map(copyReservation).filter(r=>{
   const report=memberBySide.get(r.side);if(!report)return false;
   if(r.role==='expand')return !!report.expansion&&pointKey(report.expansion)===pointKey(r.destination)&&!threats.size;
   return report.scoutingNeeded&&r.ids.length===1&&report.fighters.some(f=>f.id===r.ids[0]&&sameLevel(f,r.destination))&&!occupied.has(r.ids[0]);
  });
  if(wave){for(const p of wave.participants)p.ids.forEach(id=>occupied.add(id));reservations=reservations.filter(r=>r.role==='expand'||r.ids.every(id=>!occupied.has(id)));}
  const observed=new Map<string,TeamAiTarget>();
  for(const target of members.flatMap(m=>m.targets.filter(t=>t.seenAt<=m.time)).sort((a,b)=>b.seenAt-a.seenAt||a.observer-b.observer||targetRank[a.kind]-targetRank[b.kind]||keyCompare(a.key,b.key)||levelOf(a)-levelOf(b)||a.x-b.x||a.y-b.y)){
   const variant=`${target.key}@${pointKey(target)}`;if(!observed.has(variant))observed.set(variant,{...target});
  }
  const targets=[...observed.values()].sort((a,b)=>targetRank[a.kind]-targetRank[b.kind]||b.seenAt-a.seenAt||keyCompare(a.key,b.key)||levelOf(a)-levelOf(b)||a.x-b.x||a.y-b.y);
  if(!threats.size&&!wave&&!launchedThisStep){
   if(!reservations.some(r=>r.role==='scout')){
    const expandSides=new Set(reservations.filter(r=>r.role==='expand').map(r=>r.side));
    const scouts=members.filter(m=>m.scoutingNeeded&&m.fighters.some(f=>!occupied.has(f.id))&&m.targets.some(t=>t.seenAt<=m.time&&m.fighters.some(f=>sameLevel(f,t)&&!occupied.has(f.id)))).sort((a,b)=>Number(expandSides.has(a.side))-Number(expandSides.has(b.side))||a.side-b.side);
    const scout=scouts[0],scoutTargets=scout?.targets.filter(t=>t.seenAt<=scout.time&&scout.fighters.some(f=>sameLevel(f,t)&&!occupied.has(f.id))).sort((a,b)=>targetRank[a.kind]-targetRank[b.kind]||b.seenAt-a.seenAt||keyCompare(a.key,b.key)||levelOf(a)-levelOf(b))??[];
    const target=scoutTargets.find(t=>t.kind!=='unit')??scoutTargets[0];
    if(scout&&target){const fighter=[...scout.fighters].filter(f=>!occupied.has(f.id)&&sameLevel(f,target)).sort((a,b)=>Number(b.role==='cavalry')-Number(a.role==='cavalry')||a.id-b.id)[0];reservations.push({teamId,side:scout.side,role:'scout',key:target.key,destination:point(target),ids:[fighter.id],createdAt:time,expiresAt:time+TEAM_AI_SCOUT_LEASE});}
   }
   if(!reservations.some(r=>r.role==='expand')){
    const scoutSides=new Set(reservations.filter(r=>r.role==='scout').map(r=>r.side));
    const expanding=members.filter(m=>m.expansion).sort((a,b)=>Number(scoutSides.has(a.side))-Number(scoutSides.has(b.side))||distance(a.hq,a.expansion!)-distance(b.hq,b.expansion!)||a.side-b.side)[0];
    if(expanding)reservations.push({teamId,side:expanding.side,role:'expand',key:`expansion:${pointKey(expanding.expansion!)}`,destination:point(expanding.expansion!),ids:[],createdAt:time,expiresAt:time+TEAM_AI_EXPANSION_LEASE});
   }
   const ready=members.filter(m=>m.readyToAttack&&m.waveReadyAt<=time+TEAM_AI_WAVE_LIFETIME);
   const scoutIds=new Set(reservations.filter(r=>r.role==='scout').flatMap(r=>r.ids));
   // Each owner approves a location it already knows; private ally sightings stay private.
   let target:TeamAiTarget|undefined,participants:TeamAiWave['participants']=[];
   const useful=(army:TeamAiWave['participants'])=>army.length>=TEAM_ATTACK_MIN_PARTICIPANTS&&army.reduce((sum,p)=>sum+p.ids.length,0)>=TEAM_ATTACK_MIN_FIGHTERS;
   for(const candidate of targets){
    const approved=ready.filter(m=>m.fighters.filter(f=>sameLevel(f,candidate)).length>=2&&m.targets.some(known=>known.key===candidate.key&&known.x===candidate.x&&known.y===candidate.y&&sameLevel(known,candidate)&&known.seenAt<=m.time));
    let army=approved.map(m=>({side:m.side,ids:m.fighters.filter(f=>!scoutIds.has(f.id)&&sameLevel(f,candidate)).map(f=>f.id)})).filter(p=>p.ids.length);
    // Scouting cannot hold a useful combined army below its attack threshold forever.
    if(!useful(army))army=approved.map(m=>({side:m.side,ids:m.fighters.filter(f=>sameLevel(f,candidate)).map(f=>f.id)})).filter(p=>p.ids.length);
    if(useful(army)){target=candidate;participants=army;break;}
   }
   if(target){
    const launchAt=Math.max(time+TEAM_AI_WAVE_DELAY,...participants.map(p=>memberBySide.get(p.side)!.waveReadyAt));
    if(launchAt<=time+TEAM_AI_WAVE_LIFETIME){wave={id:coordinator.nextWaveId++,teamId,target:{...target},participants,launchAt,expiresAt:time+TEAM_AI_WAVE_LIFETIME,launched:false};for(const p of participants)p.ids.forEach(id=>occupied.add(id));reservations=reservations.filter(r=>r.role==='expand'||r.ids.every(id=>!occupied.has(id)));}
   }
   // A full owned army waits at most one wave lifetime for an allied attack.
   // A worker-only ally or different private sightings cannot keep it idle forever.
   if(!wave){
    const solos=members.filter(m=>m.soloReadyToAttack&&m.waveReadyAt+TEAM_AI_WAVE_LIFETIME<=time&&m.fighters.some(f=>!occupied.has(f.id))&&m.targets.some(t=>t.seenAt<=m.time&&m.fighters.some(f=>sameLevel(f,t)&&!occupied.has(f.id)))).sort((a,b)=>a.waveReadyAt-b.waveReadyAt||a.side-b.side);
    const solo=solos[0],known=solo?.targets.filter(t=>t.seenAt<=solo.time&&solo.fighters.filter(f=>sameLevel(f,t)&&!occupied.has(f.id)).length>=(solo.soloAttackSize??3)).sort((a,b)=>targetRank[a.kind]-targetRank[b.kind]||b.seenAt-a.seenAt||keyCompare(a.key,b.key)||levelOf(a)-levelOf(b)||a.x-b.x||a.y-b.y)[0];
    if(solo&&known){
     const ids=solo.fighters.filter(f=>!occupied.has(f.id)&&sameLevel(f,known)).map(f=>f.id),waveId=coordinator.nextWaveId++;
     wave={id:waveId,teamId,target:{...known},participants:[{side:solo.side,ids}],launchAt:time,expiresAt:time+TEAM_AI_WAVE_LIFETIME,launched:true};
     for(let i=0;i<ids.length;i+=TEAM_AI_COMMAND_IDS)launches.push({side:solo.side,ids:ids.slice(i,i+TEAM_AI_COMMAND_IDS),destination:point(known),waveId});
     ids.forEach(id=>occupied.add(id));reservations=reservations.filter(r=>r.role==='expand'||r.ids.every(id=>!occupied.has(id)));
    }
   }
  }
  if(wave){coordinator.waves.push(wave);for(const participant of wave.participants)assignments.push({side:participant.side,role:'attack',ids:[...participant.ids],destination:point(wave.target),targetKey:wave.target.key,waveId:wave.id,launchAt:wave.launchAt});}
  for(const reservation of reservations){coordinator.reservations.push(reservation);assignments.push({side:reservation.side,role:reservation.role,ids:[...reservation.ids],destination:point(reservation.destination),targetKey:reservation.key});}
 }
 coordinator.reservations=coordinator.reservations.slice(0,MAX_TEAM_AI_RESERVATIONS);
 coordinator.waves=coordinator.waves.slice(0,MAX_TEAM_AI_WAVES);
 assignments.sort((a,b)=>a.side-b.side||keyCompare(a.role,b.role)||keyCompare(a.targetKey??'',b.targetKey??''));
 launches.sort((a,b)=>a.side-b.side||a.waveId-b.waveId);
 return {coordinator,assignments,launches};
}

export interface TeamAiValidationContext {
 playerCount:number;teams:TeamId[];time:number;nextEntityId:number;width:number;height:number;levels?:number;
 entitySides?:ReadonlyMap<number,Side>;entityLevels?:ReadonlyMap<number,number>;
}
/** Strict saved-data boundary. Returns independent plain data, never the supplied object. */
export function validateTeamAiState(value:unknown,context:TeamAiValidationContext):TeamAiState {
 const fail=(path:string,reason:string):never=>{throw new Error(`Invalid team AI at ${path}: ${reason}.`);};
 const object=(v:unknown,path:string,required:string[],optional:string[]=[])=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null))fail(path,'expected a plain object');
  const record=v as Record<string,unknown>;
  const names=Object.getOwnPropertyNames(record);
  if(Object.getOwnPropertySymbols(record).length||names.some(k=>![...required,...optional].includes(k))||required.some(k=>!Object.hasOwn(record,k)))fail(path,'unexpected or missing field');
  for(const key of names)if(!('value' in Object.getOwnPropertyDescriptor(record,key)!))fail(path,'accessors are forbidden');
  return record;
 };
 const number=(v:unknown,path:string,min:number,max:number,integer=false):number=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isSafeInteger(v))fail(path,'invalid number');return v as number;
 };
 const list=(v:unknown,path:string,max:number):unknown[]=>{
  if(!Array.isArray(v)||v.length>max||Object.getPrototypeOf(v)!==Array.prototype)fail(path,'invalid array');
  const source=v as unknown[],array:unknown[]=[];
  if(Object.getOwnPropertySymbols(source).length||Object.getOwnPropertyNames(source).some(k=>k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=source.length)))fail(path,'unexpected array properties');
  for(let i=0;i<source.length;i++){const d=Object.getOwnPropertyDescriptor(source,String(i));if(!d||!('value' in d))fail(path,'array gaps and accessors are forbidden');array.push(d!.value);}
  return array;
 };
 const choice=<T extends string>(v:unknown,path:string,choices:readonly T[]):T=>{if(typeof v!=='string'||!choices.includes(v as T))fail(path,'unknown value');return v as T;};
 const text=(v:unknown,path:string,max=128):string=>{if(typeof v!=='string'||!v.length||v.length>max||/[\x00-\x1f]/.test(v))fail(path,'invalid text');return v as string;};
 number(context.playerCount,'context.playerCount',1,8,true);number(context.time,'context.time',0,1e12);number(context.nextEntityId,'context.nextEntityId',1,0x7fffffff,true);number(context.width,'context.width',1,256);number(context.height,'context.height',1,256);number(context.levels??1,'context.levels',1,2,true);
 if(context.teams.length!==context.playerCount)fail('context.teams','invalid roster');context.teams.forEach((t,i)=>number(t,`context.teams[${i}]`,0,7,true));
 const side=(v:unknown,path:string)=>number(v,path,0,context.playerCount-1,true) as Side;
 const id=(v:unknown,path:string)=>number(v,path,1,context.nextEntityId-1,true);
 const when=(v:unknown,path:string)=>number(v,path,0,context.time);
 const position=(v:unknown,path:string):Vec=>{const p=object(v,path,['x','y'],['level']);return {...(p.level===undefined?{}:{level:number(p.level,`${path}.level`,0,(context.levels??1)-1,true)}),x:number(p.x,`${path}.x`,0,context.width),y:number(p.y,`${path}.y`,0,context.height)};};
 const unique=(items:unknown[],path:string,read:(v:unknown,p:string)=>number):number[]=>{const seen=new Set<number>();return items.map((v,i)=>{const n=read(v,`${path}[${i}]`);if(seen.has(n))fail(path,'duplicate ID');seen.add(n);return n;});};
 const claimed=new Set<number>();
 const assigned=(v:unknown,path:string,owner:Side,active:boolean):number[]=>unique(list(v,path,500),path,id).map(n=>{if(active&&context.entitySides&&context.entitySides.get(n)!==owner)fail(path,'assigned entity has a different or missing owner');if(active){if(claimed.has(n))fail(path,'duplicate active troop assignment');claimed.add(n);}return n;});
 const assignedLevel=(ids:number[],destination:Vec,path:string,active=true)=>{if(active&&context.entityLevels&&ids.some(id=>context.entityLevels!.get(id)!==levelOf(destination)))fail(path,'assigned entity is on a different or missing level');};
 const cost=(v:unknown,path:string):Cost=>{const c=object(v,path,['wood','ore','crystal']);const result={wood:number(c.wood,`${path}.wood`,0,1e9),ore:number(c.ore,`${path}.ore`,0,1e9),crystal:number(c.crystal,`${path}.crystal`,0,1e9)};if(!result.wood&&!result.ore&&!result.crystal)fail(path,'empty resources');return result;};
 const allies=(a:Side,b:Side,path:string)=>{if(a===b||context.teams[a]!==context.teams[b])fail(path,'expected distinct allies');};
 const root=object(value,'state',['coordinator','directives','nextDirectiveId','nextTransferId','transfers']);
 const saved=object(root.coordinator,'coordinator',['nextWaveId','reservations','waves']);
 const nextWaveId=number(saved.nextWaveId,'coordinator.nextWaveId',1,1e12,true),nextDirectiveId=number(root.nextDirectiveId,'nextDirectiveId',1,1e12,true),nextTransferId=number(root.nextTransferId,'nextTransferId',1,1e12,true);
 const reservationKeys=new Set<string>();
 const reservations=list(saved.reservations,'coordinator.reservations',MAX_TEAM_AI_RESERVATIONS).map((v,i):TeamAiReservation=>{
  const path=`coordinator.reservations[${i}]`,r=object(v,path,['teamId','side','role','key','destination','ids','createdAt','expiresAt']);
  const owner=side(r.side,`${path}.side`),teamId=number(r.teamId,`${path}.teamId`,0,7,true) as TeamId;if(context.teams[owner]!==teamId)fail(path,'reservation team differs from owner');
  const role=choice(r.role,`${path}.role`,['scout','expand']),key=text(r.key,`${path}.key`),slot=`${teamId}:${role}`;if(reservationKeys.has(slot))fail(path,'duplicate reservation role');reservationKeys.add(slot);
  const ids=assigned(r.ids,`${path}.ids`,owner,true);if(role==='scout'?ids.length!==1:ids.length!==0)fail(path,'invalid role assignment');
  const createdAt=when(r.createdAt,`${path}.createdAt`),expiresAt=number(r.expiresAt,`${path}.expiresAt`,createdAt,createdAt+(role==='scout'?TEAM_AI_SCOUT_LEASE:TEAM_AI_EXPANSION_LEASE));
  const destination=position(r.destination,`${path}.destination`);assignedLevel(ids,destination,`${path}.ids`);return {teamId,side:owner,role,key,destination,ids,createdAt,expiresAt};
 });
 const waveIds=new Set<number>(),waveTeams=new Set<TeamId>();
 const waves=list(saved.waves,'coordinator.waves',MAX_TEAM_AI_WAVES).map((v,i):TeamAiWave=>{
  const path=`coordinator.waves[${i}]`,w=object(v,path,['id','teamId','target','participants','launchAt','expiresAt','launched']),waveId=number(w.id,`${path}.id`,1,nextWaveId-1,true),teamId=number(w.teamId,`${path}.teamId`,0,7,true) as TeamId;
  if(waveIds.has(waveId)||waveTeams.has(teamId))fail(path,'duplicate wave ID or team');waveIds.add(waveId);waveTeams.add(teamId);
  const t=object(w.target,`${path}.target`,['key','kind','observer','seenAt','x','y'],['level']),observer=side(t.observer,`${path}.target.observer`);if(context.teams[observer]!==teamId)fail(path,'target observer is not allied');
  const target:TeamAiTarget={...position({x:t.x,y:t.y,...(t.level===undefined?{}:{level:t.level})},`${path}.target.position`),key:text(t.key,`${path}.target.key`),kind:choice(t.kind,`${path}.target.kind`,['hq','building','unit','start']),observer,seenAt:when(t.seenAt,`${path}.target.seenAt`)};
  const participantSides=new Set<Side>(),troopIds=new Set<number>();
  const participants=list(w.participants,`${path}.participants`,8).map((v,j)=>{const ppath=`${path}.participants[${j}]`,p=object(v,ppath,['side','ids']),owner=side(p.side,`${ppath}.side`);if(context.teams[owner]!==teamId||participantSides.has(owner))fail(ppath,'duplicate or hostile participant');participantSides.add(owner);const ids=assigned(p.ids,`${ppath}.ids`,owner,true);assignedLevel(ids,target,`${ppath}.ids`);if(!ids.length)fail(ppath,'empty participant');for(const n of ids){if(troopIds.has(n))fail(ppath,'duplicate troop');troopIds.add(n);}return {side:owner,ids};});
  if(!participants.length)fail(path,'empty wave');
  const launchAt=number(w.launchAt,`${path}.launchAt`,0,context.time+TEAM_AI_WAVE_LIFETIME),expiresAt=number(w.expiresAt,`${path}.expiresAt`,launchAt,context.time+TEAM_AI_WAVE_LIFETIME);if(typeof w.launched!=='boolean')fail(path,'invalid launched flag');
  if(w.launched&&launchAt>context.time)fail(path,'launched wave has a future launch time');
  return {id:waveId,teamId,target,participants,launchAt,expiresAt,launched:w.launched as boolean};
 });
 const directiveIds=new Set<number>(),activeRecipients=new Set<Side>();
 const directives=list(root.directives,'directives',MAX_TEAM_DIRECTIVES).map((v,i):AllyDirective=>{
  const path=`directives[${i}]`,d=object(v,path,['id','issuer','recipient','kind','createdAt','expiresAt','status','assigned'],['destination','observedTarget','resources','arrivedAt','reason']);
  const directiveId=number(d.id,`${path}.id`,1,nextDirectiveId-1,true);if(directiveIds.has(directiveId))fail(path,'duplicate directive ID');directiveIds.add(directiveId);
  const issuer=side(d.issuer,`${path}.issuer`),recipient=side(d.recipient,`${path}.recipient`);allies(issuer,recipient,path);
  const kind=choice(d.kind,`${path}.kind`,['defend','scout','attack','support']),status=choice(d.status,`${path}.status`,['accepted','active','completed','failed','cancelled']);
  if(status==='accepted'||status==='active'){if(activeRecipients.has(recipient))fail(path,'duplicate active recipient');activeRecipients.add(recipient);}
  const createdAt=when(d.createdAt,`${path}.createdAt`),expiresAt=number(d.expiresAt,`${path}.expiresAt`,createdAt,createdAt+180);
  const result:AllyDirective={id:directiveId,issuer,recipient,kind,createdAt,expiresAt,status,assigned:assigned(d.assigned,`${path}.assigned`,recipient,status==='accepted'||status==='active')};
  if(kind==='support'){if(d.destination!==undefined||d.observedTarget!==undefined||result.assigned.length)fail(path,'support cannot assign troops or a destination');result.resources=cost(d.resources,`${path}.resources`);}
  else{if(d.resources!==undefined)fail(path,'only support has resources');result.destination=position(d.destination,`${path}.destination`);assignedLevel(result.assigned,result.destination,`${path}.assigned`,status==='accepted'||status==='active');}
  if(d.observedTarget!==undefined){if(kind!=='attack')fail(path,'only attack has an observed target');result.observedTarget=id(d.observedTarget,`${path}.observedTarget`);}
  if(d.arrivedAt!==undefined)result.arrivedAt=number(d.arrivedAt,`${path}.arrivedAt`,createdAt,context.time);
  if(d.reason!==undefined)result.reason=text(d.reason,`${path}.reason`,160);
  return result;
 });
 const transferIds=new Set<number>();
 const transfers=list(root.transfers,'transfers',MAX_TEAM_TRANSFERS).map((v,i):TeamAiTransfer=>{const path=`transfers[${i}]`,t=object(v,path,['id','sender','recipient','resources','time']),transferId=number(t.id,`${path}.id`,1,nextTransferId-1,true);if(transferIds.has(transferId))fail(path,'duplicate transfer ID');transferIds.add(transferId);const sender=side(t.sender,`${path}.sender`),recipient=side(t.recipient,`${path}.recipient`);allies(sender,recipient,path);return {id:transferId,sender,recipient,resources:cost(t.resources,`${path}.resources`),time:when(t.time,`${path}.time`)};});
 return {coordinator:{nextWaveId,reservations,waves},nextDirectiveId,directives,nextTransferId,transfers};
}
