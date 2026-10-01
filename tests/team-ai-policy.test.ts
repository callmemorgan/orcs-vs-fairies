import { describe, expect, it } from 'vitest';
import {
 coordinateTeamAi, emptyTeamAiState, hasTeamAiMemory, validateTeamAiState,
 TEAM_ATTACK_MIN_FIGHTERS, TEAM_ATTACK_MIN_PARTICIPANTS, TEAM_AI_WAVE_LIFETIME,
 MAX_TEAM_DIRECTIVES, MAX_TEAM_TRANSFERS,
} from '../src/core/team-ai';
import type { TeamAiReport, TeamAiState, TeamAiValidationContext } from '../src/core/team-ai';
import type { Side } from '../src/core/types';
import { validateCommand } from '../src/core/commands';

function report(side:Side,overrides:Partial<TeamAiReport>={}):TeamAiReport {
 return {side,teamId:3,time:10,hq:{x:side*5+5,y:5},fighters:Array.from({length:4},(_,i)=>({id:side*100+i+1,role:'melee' as const,x:side*5+5+i,y:7})),threats:[],targets:[{key:'start:1',kind:'start',x:40,y:40,observer:side,seenAt:0}],readyToAttack:true,waveReadyAt:10,scoutingNeeded:false,...overrides};
}
const empty=()=>emptyTeamAiState().coordinator;
function fresh(reports:TeamAiReport[],time:number){return reports.map(r=>({...r,time}));}
const context=(time=10):TeamAiValidationContext=>({playerCount:8,teams:[3,7,3,7,3,7,3,7],time,nextEntityId:1000,width:64,height:64});
function saved():TeamAiState {
 const state=emptyTeamAiState();state.coordinator=coordinateTeamAi(state.coordinator,[report(0),report(2)],10).coordinator;
 state.nextDirectiveId=2;state.directives=[{id:1,issuer:0,recipient:2,kind:'scout',destination:{x:30,y:30},createdAt:10,expiresAt:70,status:'active',assigned:[205]}];
 state.nextTransferId=2;state.transfers=[{id:1,sender:2,recipient:0,resources:{wood:50,ore:0,crystal:0},time:10}];return state;
}

describe('owned team AI coordination',()=>{
 it('produces the same assignments and saved plan regardless of report or entity order',()=>{
  const a=report(0,{scoutingNeeded:true,expansion:{x:20,y:20}}),b=report(2,{scoutingNeeded:true,expansion:{x:20,y:20}});
  a.targets.push({key:'hq:900',kind:'hq',x:42,y:40,observer:0,seenAt:10});b.targets.push({key:'hq:900',kind:'hq',x:42,y:40,observer:2,seenAt:10});
  const before=structuredClone([a,b]),result=coordinateTeamAi(empty(),[a,b],10);
  expect(coordinateTeamAi(empty(),[b,a].map(r=>({...r,fighters:[...r.fighters].reverse(),targets:[...r.targets].reverse()})),10)).toEqual(result);
  expect([a,b]).toEqual(before);expect(result.coordinator.waves[0].target.key).toBe('hq:900');
 });

 it('uses combined readiness below a solo threshold and launches all owners once in one pass',()=>{
  const reports=[report(0,{fighters:report(0).fighters.slice(0,2),scoutingNeeded:true}),report(2,{fighters:report(2).fighters.slice(0,2)})];
  expect(TEAM_ATTACK_MIN_FIGHTERS).toBe(4);expect(TEAM_ATTACK_MIN_PARTICIPANTS).toBe(2);
  const planned=coordinateTeamAi(empty(),reports,10),wave=planned.coordinator.waves[0];
  expect(wave.participants).toEqual([{side:0,ids:[1,2]},{side:2,ids:[201,202]}]);expect(planned.launches).toEqual([]);
  expect(planned.assignments.some(a=>a.role==='scout')).toBe(false);
  const before=coordinateTeamAi(planned.coordinator,fresh(reports,wave.launchAt-.1),wave.launchAt-.1);expect(before.launches).toEqual([]);
  const launched=coordinateTeamAi(before.coordinator,fresh(reports,wave.launchAt),wave.launchAt);
  expect(launched.launches).toEqual([{side:0,ids:[1,2],destination:{x:40,y:40},waveId:wave.id},{side:2,ids:[201,202],destination:{x:40,y:40},waveId:wave.id}]);
  expect(launched.coordinator.waves[0].launched).toBe(true);
  expect(coordinateTeamAi(launched.coordinator,fresh(reports,wave.launchAt),wave.launchAt).launches).toEqual([]);
  expect(coordinateTeamAi(launched.coordinator,fresh(reports,wave.launchAt+1),wave.launchAt+1).launches).toEqual([]);
 });

 it('coordinates independent teams in the same simulation step without mixing owners',()=>{
  const reports=[report(0),report(2),report(1,{teamId:7}),report(3,{teamId:7})];
  const plan=coordinateTeamAi(empty(),reports,10),launched=coordinateTeamAi(plan.coordinator,fresh(reports,13),13);
  expect(launched.launches.map(l=>l.side)).toEqual([0,1,2,3]);
  expect(launched.launches.filter(l=>l.waveId===1).map(l=>l.side)).toEqual([0,2]);
  expect(launched.launches.filter(l=>l.waveId===2).map(l=>l.side)).toEqual([1,3]);
  for(const launch of launched.launches)expect(launch.ids.every(id=>reports.find(r=>r.side===launch.side)!.fighters.some(f=>f.id===id))).toBe(true);
 });

 it('splits large approved armies into ordinary valid commands launched in the same step',()=>{
  const reports=[report(0),report(2)];for(const r of reports)r.fighters=Array.from({length:105},(_,i)=>({id:r.side*100+i+1,role:'melee',x:r.hq.x,y:7}));
  const plan=coordinateTeamAi(empty(),reports,10),launch=coordinateTeamAi(plan.coordinator,fresh(reports,13),13);
  expect(launch.launches.map(l=>[l.side,l.ids.length])).toEqual([[0,100],[0,5],[2,100],[2,5]]);
  expect(launch.launches.every(l=>validateCommand({type:'attackMove',ids:l.ids,...l.destination}))).toBe(true);
  expect(new Set(launch.launches.flatMap(l=>l.ids)).size).toBe(210);
  expect(coordinateTeamAi(launch.coordinator,fresh(reports,13),13).launches).toEqual([]);
 });

 it('does not replace solo AI behavior or form an alliance across different teams',()=>{
  expect(coordinateTeamAi(empty(),[report(0)],10)).toEqual({coordinator:empty(),assignments:[],launches:[]});
  expect(coordinateTeamAi(empty(),[report(0),report(2,{teamId:7})],10).assignments).toEqual([]);
  expect(()=>coordinateTeamAi(empty(),[report(0),report(0)],10)).toThrow(/Duplicate/);
 });

 it('waits one wave lifetime before a full owned army attacks with a worker-only ally',()=>{
  const reports=[report(0,{soloReadyToAttack:true,scoutingNeeded:true}),report(2,{fighters:[],readyToAttack:false})];
  const scouting=coordinateTeamAi(empty(),reports,10),deadline=10+TEAM_AI_WAVE_LIFETIME;
  expect(scouting.coordinator.reservations.find(r=>r.role==='scout')!.ids).toEqual([1]);
  const waiting=coordinateTeamAi(scouting.coordinator,fresh(reports,deadline-.001),deadline-.001);
  expect(waiting.launches).toEqual([]);expect(waiting.coordinator.waves).toEqual([]);
  const launched=coordinateTeamAi(waiting.coordinator,fresh(reports,deadline),deadline);
  expect(launched.launches).toEqual([{side:0,ids:[1,2,3,4],destination:{x:40,y:40},waveId:1}]);
  expect(launched.coordinator.waves[0]).toMatchObject({participants:[{side:0,ids:[1,2,3,4]}],launchAt:deadline,expiresAt:deadline+TEAM_AI_WAVE_LIFETIME,launched:true});
  expect(launched.coordinator.reservations.some(r=>r.role==='scout')).toBe(false);
 });

 it('requires the ordinary owned army threshold before falling back from an unready ally',()=>{
  const reports=[report(0,{soloReadyToAttack:false}),report(2,{readyToAttack:false})],deadline=10+TEAM_AI_WAVE_LIFETIME;
  expect(coordinateTeamAi(empty(),fresh(reports,deadline),deadline).launches).toEqual([]);
  reports[0].soloReadyToAttack=true;
  expect(coordinateTeamAi(empty(),fresh(reports,deadline),deadline).launches.map(l=>l.side)).toEqual([0]);
 });

 it('lets only the earliest ready owner attack its own private target in the solo fallback',()=>{
  const a=report(0,{soloReadyToAttack:true,waveReadyAt:10,targets:[{key:'hq:900',kind:'hq',x:20,y:30,observer:0,seenAt:10}]}),b=report(2,{soloReadyToAttack:true,waveReadyAt:9,targets:[{key:'hq:901',kind:'hq',x:55,y:30,observer:2,seenAt:9}]});
  const reports=fresh([a,b],22),launched=coordinateTeamAi(empty(),reports,22);
  expect(launched.launches).toEqual([{side:2,ids:[201,202,203,204],destination:{x:55,y:30},waveId:1}]);
  expect(launched.coordinator.waves[0].target).toEqual(b.targets[0]);
  expect(launched.assignments.some(a=>a.side===0&&a.role==='attack')).toBe(false);
  expect(coordinateTeamAi(empty(),[...reports].reverse(),22)).toEqual(launched);
  b.waveReadyAt=10;
  expect(coordinateTeamAi(empty(),fresh([b,a],22),22).launches.map(l=>l.side)).toEqual([0]);
 });

 it('plans a common allied wave before launching an eligible solo fallback',()=>{
  const reports=[report(0,{soloReadyToAttack:true}),report(2,{soloReadyToAttack:true})],deadline=10+TEAM_AI_WAVE_LIFETIME;
  const planned=coordinateTeamAi(empty(),fresh(reports,deadline),deadline),wave=planned.coordinator.waves[0];
  expect(planned.launches).toEqual([]);expect(wave.participants.map(p=>p.side)).toEqual([0,2]);expect(wave.launched).toBe(false);
  const launched=coordinateTeamAi(planned.coordinator,fresh(reports,wave.launchAt),wave.launchAt);
  expect(launched.launches.map(l=>l.side)).toEqual([0,2]);expect(launched.coordinator.nextWaveId).toBe(2);
 });

 it('does not repeat a solo fallback launch after validating and loading its saved wave',()=>{
  const reports=[report(0,{soloReadyToAttack:true}),report(2,{fighters:[],readyToAttack:false})],deadline=10+TEAM_AI_WAVE_LIFETIME;
  const launched=coordinateTeamAi(empty(),fresh(reports,deadline),deadline),state=emptyTeamAiState();state.coordinator=launched.coordinator;
  const loaded=validateTeamAiState(JSON.parse(JSON.stringify(state)),context(deadline));
  for(const time of [deadline,deadline+.05,deadline+1,deadline+TEAM_AI_WAVE_LIFETIME-.05]){
   const continued=coordinateTeamAi(loaded.coordinator,fresh(reports,time),time);
   expect(continued.launches).toEqual([]);expect(continued.coordinator.nextWaveId).toBe(2);
   expect(continued.coordinator.waves[0].launched).toBe(true);
  }
 });

 it('releases a surviving pending allied wave at its deadline before any solo fallback',()=>{
  const reports=[report(0,{soloReadyToAttack:true}),report(2,{soloReadyToAttack:true})],plan=coordinateTeamAi(empty(),reports,10),deadline=10+TEAM_AI_WAVE_LIFETIME;
  reports[0].fighters=[];
  const waiting=coordinateTeamAi(plan.coordinator,fresh(reports,deadline-.05),deadline-.05);expect(waiting.launches).toEqual([]);
  const released=coordinateTeamAi(waiting.coordinator,fresh(reports,deadline),deadline);
  expect(released.launches).toEqual([{side:2,ids:[201,202,203,204],destination:{x:40,y:40},waveId:1}]);
  expect(released.coordinator.nextWaveId).toBe(2);expect(released.coordinator.waves).toEqual([]);
 });

 it('assigns one scout and expansion to different owners and keeps copied lease destinations',()=>{
  const reports=[report(0,{readyToAttack:false,scoutingNeeded:true,expansion:{x:20,y:20}}),report(2,{readyToAttack:false,scoutingNeeded:true,expansion:{x:20,y:20}})];
  const plan=coordinateTeamAi(empty(),reports,10);
  expect(plan.assignments.map(a=>[a.side,a.role])).toEqual([[0,'scout'],[2,'expand']]);
  expect(plan.assignments[0].ids).toEqual([1]);expect(plan.assignments[1].ids).toEqual([]);
  reports[0].targets[0].x=60;reports[1].expansion!.x=25;
  expect(plan.assignments[0].destination).toEqual({x:40,y:40});expect(plan.assignments[1].destination).toEqual({x:20,y:20});
  const continued=coordinateTeamAi(plan.coordinator,fresh(reports,11),11);
  expect(continued.assignments.find(a=>a.role==='scout')!.destination).toEqual({x:40,y:40});
  expect(continued.assignments.filter(a=>a.role==='scout')).toHaveLength(1);expect(continued.assignments.filter(a=>a.role==='expand')).toHaveLength(1);
 });

 it('reassigns a dead scout and a removed expansion owner without retaining dangling roles',()=>{
  const reports=[report(0,{readyToAttack:false,scoutingNeeded:true}),report(2,{readyToAttack:false,scoutingNeeded:true,expansion:{x:20,y:20}}),report(4,{readyToAttack:false,scoutingNeeded:true,expansion:{x:20,y:20}})];
  const plan=coordinateTeamAi(empty(),reports,10),oldScout=plan.coordinator.reservations.find(r=>r.role==='scout')!;
  reports[0].fighters=[];
  const continued=coordinateTeamAi(plan.coordinator,fresh([reports[0],reports[2]],11),11);
  expect(continued.coordinator.reservations.some(r=>r.side===2)).toBe(false);
  expect(continued.coordinator.reservations.find(r=>r.role==='scout')!.ids).not.toEqual(oldScout.ids);
  expect(continued.assignments.some(a=>a.side===4&&a.role==='expand')).toBe(true);
 });

 it('gives defense priority over planned attacks and releases threatened scout reservations',()=>{
  const reports=[report(0),report(2)],plan=coordinateTeamAi(empty(),reports,10);
  reports[0].threats=[{id:900,x:6,y:7}];
  const defending=coordinateTeamAi(plan.coordinator,fresh(reports,13),13),defense=defending.assignments.filter(a=>a.role==='defend');
  expect(defense).toHaveLength(1);expect(defense[0].side).toBe(0);expect(defense[0].ids).toEqual([1,2,3]);
  const defended=new Set(defense.flatMap(a=>a.ids));expect(defending.launches).toHaveLength(2);
  expect(defending.launches.every(l=>l.ids.every(id=>!defended.has(id)))).toBe(true);
  const scouting=coordinateTeamAi(empty(),[report(0,{readyToAttack:false,scoutingNeeded:true}),report(2,{readyToAttack:false})],10);
  const diverted=coordinateTeamAi(scouting.coordinator,fresh(reports,11),11);
  expect(diverted.assignments.some(a=>a.role==='scout')).toBe(false);expect(diverted.assignments.some(a=>a.role==='expand')).toBe(false);
 });

 it('uses shared public starts when other owners have different private sightings',()=>{
  const a=report(0),b=report(2);
  a.targets.unshift({key:'hq:900',kind:'hq',x:20,y:30,observer:0,seenAt:10});
  b.targets.unshift({key:'hq:901',kind:'hq',x:55,y:30,observer:2,seenAt:10});
  const plan=coordinateTeamAi(empty(),[a,b],10);expect(plan.coordinator.waves[0].target.key).toBe('start:1');
  a.readyToAttack=false;b.readyToAttack=false;a.scoutingNeeded=true;a.targets=[];
  const scout=coordinateTeamAi(empty(),[a,b],10);expect(scout.assignments.some(a=>a.role==='scout')).toBe(false);
  b.scoutingNeeded=true;const ownScout=coordinateTeamAi(empty(),[a,b],10).assignments.find(a=>a.role==='scout')!;
  expect(ownScout.side).toBe(2);expect(ownScout.destination).toEqual({x:55,y:30});
 });

 it('does not coordinate an enemy location different recipients observed at different coordinates',()=>{
  const a=report(0),b=report(2);a.targets=[{key:'unit:900',kind:'unit',x:30,y:30,observer:0,seenAt:10}];b.targets=[{key:'unit:900',kind:'unit',x:31,y:30,observer:2,seenAt:10}];
  expect(coordinateTeamAi(empty(),[a,b],10).coordinator.waves).toEqual([]);
 });

 it('lets an informed consenting pair attack without an uninformed third owner blocking them',()=>{
  const a=report(0),b=report(2),uninformed=report(4,{targets:[]});
  const plan=coordinateTeamAi(empty(),[a,b,uninformed],10);expect(plan.coordinator.waves[0].participants.map(p=>p.side)).toEqual([0,2]);
  expect(plan.assignments.some(a=>a.side===4&&a.role==='attack')).toBe(false);
 });

 it('retains an agreed remembered position when another owner has a newer private sighting',()=>{
  const a=report(0),b=report(2),newer=report(4);
  for(const r of [a,b])r.targets=[{key:'unit:900',kind:'unit',x:30,y:30,observer:r.side,seenAt:8}];
  newer.targets=[{key:'unit:900',kind:'unit',x:31,y:30,observer:4,seenAt:10}];
  const plan=coordinateTeamAi(empty(),[a,b,newer],10);expect(plan.coordinator.waves[0].participants.map(p=>p.side)).toEqual([0,2]);
  expect(plan.coordinator.waves[0].target).toMatchObject({x:30,y:30,seenAt:8});
 });

 it('freezes previously approved target coordinates until launch and never aliases supplied sightings',()=>{
  const reports=[report(0),report(2)];for(const r of reports)r.targets=[{key:'unit:900',kind:'unit',x:30,y:30,observer:r.side,seenAt:8}];
  const plan=coordinateTeamAi(empty(),reports,10),before=structuredClone(plan.coordinator);
  for(const r of reports){r.targets[0].x=55;r.targets[0].seenAt=12;}
  const launch=coordinateTeamAi(plan.coordinator,fresh(reports,13),13);
  expect(launch.launches.every(l=>l.destination.x===30)).toBe(true);expect(plan.coordinator).toEqual(before);
  launch.coordinator.waves[0].target.x=1;launch.launches[0].ids[0]=999;expect(plan.coordinator).toEqual(before);
 });

 it('cleans dead and eliminated participants while preserving available owned IDs',()=>{
  const reports=[report(0),report(2),report(4)],plan=coordinateTeamAi(empty(),reports,10);
  reports[0].fighters=reports[0].fighters.slice(1);
  const launch=coordinateTeamAi(plan.coordinator,fresh([reports[0],reports[2]],13),13);
  expect(launch.launches.map(l=>l.side)).toEqual([0,4]);expect(launch.launches[0].ids).toEqual([2,3,4]);
  expect(launch.coordinator.waves[0].participants.some(p=>p.side===2)).toBe(false);
  const solo=coordinateTeamAi(plan.coordinator,fresh([reports[0]],13),13);expect(solo.assignments).toEqual([]);expect(solo.coordinator.waves).toEqual([]);
 });

 it('launches a surviving approved force at the deadline instead of waiting for paid replacements',()=>{
  const reports=[report(0),report(2)],plan=coordinateTeamAi(empty(),reports,10),deadline=10+TEAM_AI_WAVE_LIFETIME;
  reports[0].fighters=[];reports[1].fighters=reports[1].fighters.slice(0,1);
  const wait=coordinateTeamAi(plan.coordinator,fresh(reports,13),13);expect(wait.launches).toEqual([]);
  const released=coordinateTeamAi(wait.coordinator,fresh(reports,deadline),deadline);
  expect(released.launches).toEqual([{side:2,ids:[201],destination:{x:40,y:40},waveId:1}]);expect(released.coordinator.waves).toEqual([]);
  expect(released.assignments.filter(a=>a.role==='attack'||a.role==='scout')).toEqual([]);
  expect(coordinateTeamAi(released.coordinator,fresh(reports,deadline+1),deadline+1).launches).toEqual([]);
 });

 it('clears a plan with no surviving approved force and ignores old or future reports',()=>{
  const reports=[report(0),report(2)],plan=coordinateTeamAi(empty(),reports,10);for(const r of reports)r.fighters=[];
  const cleared=coordinateTeamAi(plan.coordinator,fresh(reports,13),13);expect(cleared.coordinator.waves).toEqual([]);expect(cleared.launches).toEqual([]);
  expect(coordinateTeamAi(empty(),[report(0,{time:1}),report(2,{time:11})],10).assignments).toEqual([]);
 });

 it('respects future owner cooldowns without creating an unbounded attack appointment',()=>{
  const reports=[report(0,{waveReadyAt:18}),report(2,{waveReadyAt:18})],plan=coordinateTeamAi(empty(),reports,10);
  expect(plan.coordinator.waves[0].launchAt).toBe(18);expect(plan.coordinator.waves[0].expiresAt).toBe(22);
  expect(coordinateTeamAi(plan.coordinator,fresh(reports,17),17).launches).toEqual([]);
  expect(coordinateTeamAi(plan.coordinator,fresh(reports,18),18).launches).toHaveLength(2);
  expect(coordinateTeamAi(empty(),[report(0,{waveReadyAt:200}),report(2,{waveReadyAt:200})],10).coordinator.waves).toEqual([]);
 });
});

describe('saved team AI namespace',()=>{
 it('omits only a pristine namespace and preserves all behavioral counters',()=>{
  const state=emptyTeamAiState();expect(hasTeamAiMemory(state)).toBe(false);
  for(const field of ['nextDirectiveId','nextTransferId'] as const){const changed=emptyTeamAiState();changed[field]++;expect(hasTeamAiMemory(changed)).toBe(true);}
  state.coordinator.nextWaveId++;expect(hasTeamAiMemory(state)).toBe(true);
  expect(validateTeamAiState(emptyTeamAiState(),context())).toEqual(emptyTeamAiState());
 });

 it('round-trips independent plain directive, wave and conserved-transfer records including side zero',()=>{
  const original=saved(),copy=validateTeamAiState(JSON.parse(JSON.stringify(original)),context());expect(copy).toEqual(original);
  copy.directives[0].assigned[0]=999;copy.coordinator.waves[0].target.x=1;copy.transfers[0].resources.wood=0;
  expect(original.directives[0].assigned).toEqual([205]);expect(original.coordinator.waves[0].target.x).toBe(40);expect(original.transfers[0].resources.wood).toBe(50);
 });

 it('checks present active ownership while allowing historical removed IDs on finished requests',()=>{
  const state=saved(),entitySides=new Map< number,Side >([[1,0],[2,0],[3,0],[4,0],[201,2],[202,2],[203,2],[204,2],[205,2]]);
  expect(()=>validateTeamAiState(state,{...context(),entitySides})).not.toThrow();
  entitySides.set(205,0);expect(()=>validateTeamAiState(state,{...context(),entitySides})).toThrow(/owner/);
  state.directives[0].status='completed';entitySides.delete(205);expect(()=>validateTeamAiState(state,{...context(),entitySides})).not.toThrow();
  state.directives[0].status='active';expect(()=>validateTeamAiState(state,{...context(),entitySides})).toThrow(/owner/);
 });

 it.each([
  ['unknown namespace field',(s:any):unknown=>s.cheat=true],
  ['zero directive ID',(s:any):unknown=>s.directives[0].id=0],
  ['reused counter',(s:any):unknown=>s.nextDirectiveId=1],
  ['duplicate directive',(s:any):unknown=>s.directives.push({...s.directives[0]})],
  ['duplicate assigned troop',(s:any):unknown=>s.directives[0].assigned=[205,205]],
  ['troop reused across roles',(s:any):unknown=>s.directives[0].assigned=[201]],
  ['two active requests for one recipient',(s:any):unknown=>{s.nextDirectiveId=3;s.directives.push({...s.directives[0],id:2,assigned:[206]});return undefined;}],
  ['future arrival',(s:any):unknown=>s.directives[0].arrivedAt=11],
  ['negative resources',(s:any):unknown=>s.transfers[0].resources.wood=-1],
  ['empty transfer',(s:any):unknown=>s.transfers[0].resources.wood=0],
  ['oversized resource transfer',(s:any):unknown=>s.transfers[0].resources.wood=1e9+1],
  ['forged issuer',(s:any):unknown=>s.directives[0].sender=4],
  ['hostile recipient',(s:any):unknown=>s.directives[0].recipient=1],
  ['self directive',(s:any):unknown=>s.directives[0].recipient=0],
  ['outside map',(s:any):unknown=>s.directives[0].destination.x=65],
  ['unbounded expiry',(s:any):unknown=>s.directives[0].expiresAt=191],
  ['future target',(s:any):unknown=>s.coordinator.waves[0].target.seenAt=11],
  ['hostile target observer',(s:any):unknown=>s.coordinator.waves[0].target.observer=1],
  ['duplicate wave participant',(s:any):unknown=>s.coordinator.waves[0].participants.push({...s.coordinator.waves[0].participants[0]})],
  ['wrong participant team',(s:any):unknown=>s.coordinator.waves[0].participants[0].side=1],
  ['unbounded wave deadline',(s:any):unknown=>s.coordinator.waves[0].expiresAt=100],
  ['launched before its future appointment',(s:any):unknown=>{s.coordinator.waves[0].launched=true;s.coordinator.waves[0].launchAt=20;return undefined;}],
  ['hostile transfer',(s:any):unknown=>s.transfers[0].recipient=1],
  ['duplicate transfer',(s:any):unknown=>s.transfers.push({...s.transfers[0]})],
  ['future transfer',(s:any):unknown=>s.transfers[0].time=11],
  ['wrong status',(s:any):unknown=>s.directives[0].status='won'],
  ['resource support with troops',(s:any):unknown=>{s.directives[0].kind='support';s.directives[0].resources={wood:50,ore:0,crystal:0};delete s.directives[0].destination;return undefined;}],
 ] as const)('rejects %s without changing the supplied data',(_label,mutate)=>{
  const state=saved();mutate(state);const before=structuredClone(state);expect(()=>validateTeamAiState(state,context())).toThrow(/Invalid team AI/);expect(state).toEqual(before);
 });

 it('bounds record history and refuses getters or sparse saved arrays',()=>{
  const state=saved();state.directives=Array.from({length:MAX_TEAM_DIRECTIVES+1},()=>state.directives[0]);expect(()=>validateTeamAiState(state,context())).toThrow(/array/);
  const transfer=saved();transfer.transfers=Array.from({length:MAX_TEAM_TRANSFERS+1},()=>transfer.transfers[0]);expect(()=>validateTeamAiState(transfer,context())).toThrow(/array/);
  const sparse=saved();delete sparse.directives[0];expect(()=>validateTeamAiState(sparse,context())).toThrow(/gaps/);
  const getter=saved();Object.defineProperty(getter.directives[0],'destination',{get(){throw new Error('Getter ran.');},enumerable:true});expect(()=>validateTeamAiState(getter,context())).toThrow(/accessors/);
  const hiddenGetter=saved();Object.defineProperty(hiddenGetter,'coordinator',{get(){throw new Error('Getter ran.');},enumerable:false});expect(()=>validateTeamAiState(hiddenGetter,context())).toThrow(/accessors/);
  const customMap=saved();Object.defineProperty(customMap.transfers,'map',{value:()=>[{id:0,sender:0,recipient:1,resources:{wood:-1,ore:0,crystal:0},time:Infinity}],enumerable:true});expect(()=>validateTeamAiState(customMap,context())).toThrow(/array properties/);
 });

 it('continues a saved pending wave through the same one-shot output as an uninterrupted plan',()=>{
  const reports=[report(0),report(2)],state=emptyTeamAiState();state.coordinator=coordinateTeamAi(state.coordinator,reports,10).coordinator;
  const restored=validateTeamAiState(JSON.parse(JSON.stringify(state)),context());
  expect(coordinateTeamAi(restored.coordinator,fresh(reports,13),13)).toEqual(coordinateTeamAi(state.coordinator,fresh(reports,13),13));
 });
});
