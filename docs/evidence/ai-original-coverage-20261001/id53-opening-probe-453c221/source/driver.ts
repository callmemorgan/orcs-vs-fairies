import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createMatch, issueCommand, stepGame, isGameOver, captureRuntime } from '@ovf/core/simulation';
import { PlayerView } from '@ovf/core/observation';
import { MatchRecorder } from '@ovf/core/replays';
import { createSessionFile } from '@ovf/core/session-storage';
import { economicState } from '@ovf/core/economy';
import { FACTIONS, UPGRADES } from '@ovf/core/content';
import { AI_OPENINGS } from '@ovf/core/ai-policy';
import type { AiOpening } from '@ovf/core/ai-policy';
import type { Command, Cost, Entity, GameEvent, GameState, MatchConfig, Vec, UnitRole } from '@ovf/core/types';
import { authenticate, fileInventory, productProvenance, sha256, writeJson } from './provenance';

const [outputArg,pin,manifestPath] = process.argv.slice(2);
assert(outputArg && pin && manifestPath,'Usage: node driver.mjs <fresh-output-directory> <pin> <build-manifest>');
const output=resolve(outputArg),start=performance.now(),startedAt=new Date().toISOString();
const provenance=authenticate(pin,manifestPath,'driver');
const recipePath=join(provenance.helper.directory,'recipe.json'),recipeBytes=readFileSync(recipePath);
const recipe=JSON.parse(recipeBytes.toString());
assert.equal(recipe.productPin,pin);
mkdirSync(output);
writeJson(join(output,'executed-recipe.json'),recipe);

type Observation=ReturnType<PlayerView['observe']>;
type Owned=Observation['entities'][number] & Pick<Entity,'order'|'queue'|'trainProgress'|'illusion'>;
type Audit={tick:number;time:number;players:GameState['players'];entities:Entity[];paidCosts:Array<{entityId:number;stock:Cost}>;producedFighters:number[]};
type Stamp={tick:number;time:number;id:number;role:string;[key:string]:unknown};
const costKeys=['wood','ore','crystal'] as const;
const zero=():Cost=>({wood:0,ore:0,crystal:0});
const bank=(p:Cost):Cost=>({wood:p.wood,ore:p.ore,crystal:p.crystal});
const add=(a:Cost,b:Cost)=>{for(const key of costKeys)a[key]+=b[key];};
const equalCost=(a:Cost,b:Cost)=>costKeys.every(key=>Math.abs(a[key]-b[key])<1e-6);
const d2=(a:Vec,b:Vec)=>(a.x-b.x)**2+(a.y-b.y)**2;
const ownEntities=(o:Observation):Owned[]=>o.entities.filter(e=>e.side===0 && e.owner===0) as Owned[];
const snapshot=(s:GameState):Audit=>({tick:s.tick,time:s.time,players:structuredClone(s.players),entities:structuredClone(s.entities),paidCosts:structuredClone(economicState(s)?.paidCosts??[]),producedFighters:captureRuntime(s).producedFighters});
const logLimits:Record<string,number>={'command-observations.jsonl':16*1024*1024,'paid-spend-and-production.jsonl':32*1024*1024,'ordinary-hit-events.jsonl':16*1024*1024};
const logTotals=new Map<string,{bytes:number;rows:number}>();
const line=(path:string,value:unknown)=>{
  const bytes=Buffer.from(JSON.stringify(value)+'\n'),total=logTotals.get(path)??{bytes:0,rows:0};
  assert(total.bytes+bytes.length<=logLimits[basename(path)],'Raw JSONL output cap reached; retain bounded incomplete arm');
  appendFileSync(path,bytes);logTotals.set(path,{bytes:total.bytes+bytes.length,rows:total.rows+1});
};
const configFor=(opening:AiOpening):MatchConfig=>({map:{seed:4127,size:'small'},rules:{startingAge:1},players:[
  {id:0,teamId:0,factionId:'orcs',controller:'external',ai:{difficulty:'normal',personality:'balanced',opening:'infantry-rush'}},
  {id:1,teamId:1,factionId:'orcs',controller:'ai',ai:{difficulty:'normal',personality:'balanced',opening}}
]});

// This auditor receives full state only after policy decisions. Its results never
// choose a gameplay actor, target, economy command or pressure release time.
function accounting(before:Audit,after:Audit,events:GameEvent[]) {
  return after.players.map((_,side)=>{
    const income=zero(),foundationSpend=zero(),queueSpend=zero(),researchSpend=zero();
    const priorPaid=new Set(before.paidCosts.map(p=>p.entityId));
    const foundations=after.paidCosts.filter(p=>!priorPaid.has(p.entityId)).flatMap(p=>{
      const entity=after.entities.find(e=>e.id===p.entityId && e.side===side && e.kind==='building');
      if(!entity)return []; add(foundationSpend,p.stock); return [{entityId:entity.id,role:entity.role,cost:p.stock}];
    });
    for(const event of events)if(event.side===side && event.type==='gather' && event.resource && (event.amount??0)>0)income[event.resource]+=event.amount!;
    const queued=(audit:Audit,role:UnitRole)=>audit.entities.filter(e=>e.side===side && e.kind==='building').reduce((n,e)=>n+e.queue.filter(r=>r===role).length,0);
    const queueChanges:Array<{role:UnitRole;before:number;after:number;completed:number;added:number;cost:Cost}>=[];
    for(const role of Object.keys(FACTIONS.orcs.units) as UnitRole[]) {
      const completed=events.filter(event=>event.side===side && event.type==='train' && after.entities.some(e=>e.id===event.source && e.kind==='unit' && e.role===role && !e.illusion && !e.raised)).length;
      const old=queued(before,role),now=queued(after,role),added=Math.max(0,now-old+completed),cost=FACTIONS.orcs.units[role].cost;
      if(old!==now || completed || added){queueChanges.push({role,before:old,after:now,completed,added,cost:{...cost}});for(let i=0;i<added;i++)add(queueSpend,cost);}
    }
    const researchStarts=events.filter(e=>e.side===side && e.type==='research' && e.text?.endsWith(' started')).flatMap(event=>{
      const entity=after.entities.find(e=>e.id===event.source),upgrade=entity?.research;
      if(!upgrade || !UPGRADES[upgrade])return []; const cost=UPGRADES[upgrade].cost;add(researchSpend,cost);return [{producer:event.source,upgrade,cost:{...cost}}];
    });
    const accountedSpend=zero();add(accountedSpend,foundationSpend);add(accountedSpend,queueSpend);add(accountedSpend,researchSpend);
    const residual=zero();for(const key of costKeys)residual[key]=before.players[side][key]+income[key]-accountedSpend[key]-after.players[side][key];
    return {side,beforeBank:bank(before.players[side]),afterBank:bank(after.players[side]),income,foundations,foundationSpend,queueChanges,queueSpend,researchStarts,researchSpend,accountedSpend,residual,fullyAccounted:equalCost(residual,zero()),limitation:'Queue counts retain all native arrays below. Death/refund/repair or other spending may leave a residual; never describe it as building cost.'};
  });
}

function candidateSites(o:Observation,hq:Owned) {
  const visible=new Set(o.visible),size=o.content.faction.buildings.barracks.size,enemy=o.map.starts[1];
  const candidates:Vec[]=[];
  for(let y=Math.max(.5,Math.floor(hq.y-7)+.5);y<=Math.min(o.map.height-.5,hq.y+7);y++)for(let x=Math.max(.5,Math.floor(hq.x-7)+.5);x<=Math.min(o.map.width-.5,hq.x+7);x++) {
    const distance=d2({x,y},hq);if(distance<4.5**2 || distance>7**2)continue;
    let observed=true;
    for(let ty=Math.floor(y-size/2);ty<Math.ceil(y+size/2);ty++)for(let tx=Math.floor(x-size/2);tx<Math.ceil(x+size/2);tx++) {
      const index=ty*o.map.width+tx;
      if(tx<0||ty<0||tx>=o.map.width||ty>=o.map.height||!visible.has(index)||o.map.terrain[index]===null)observed=false;
    }
    if(observed)candidates.push({x,y,level:hq.level??0});
  }
  const projection=(p:Vec)=>(p.x-hq.x)*(enemy.x-hq.x)+(p.y-hq.y)*(enemy.y-hq.y);
  return candidates.sort((a,b)=>projection(b)-projection(a)||d2(a,hq)-d2(b,hq)||a.y-b.y||a.x-b.x);
}

function runArm(name:string,opening:AiOpening) {
  const directory=join(output,name);mkdirSync(directory);
  for(const file of ['command-observations.jsonl','paid-spend-and-production.jsonl','ordinary-hit-events.jsonl'])writeJsonEmpty(join(directory,file));
  const state=createMatch(configFor(opening)),recorder=new MatchRecorder(state),view=new PlayerView(0);
  const initial=recorder.export().initial;
  writeJson(join(directory,'initial-save4.json'),initial);
  assert.equal(state.tick,0);assert.deepEqual(state.controllers,['external','ai']);
  for(const p of state.players){assert.deepEqual(bank(p),{wood:420,ore:220,crystal:0});assert.equal(p.cap,12);}
  assert.deepEqual(state.incomeFactors,[1,1]);assert.deepEqual(state.populationLimits,[100,100]);
  const initialIds=new Set(view.observe(state).entities.filter(e=>e.side===0).map(e=>e.id));
  const initialDefenderIds=new Set(state.entities.filter(e=>e.side===1).map(e=>e.id));
  const originalWorkerIds=view.observe(state).entities.filter(e=>e.side===0 && e.kind==='unit' && e.role==='worker').map(e=>e.id).sort((a,b)=>a-b);
  assert.equal(originalWorkerIds.length,5);
  const initialStarterIds=view.observe(state).entities.filter(e=>e.side===0 && e.kind==='unit' && e.role!=='worker').map(e=>e.id);
  assert.equal(initialStarterIds.length,1);
  const defenderStarterIds=state.entities.filter(e=>e.side===1 && e.kind==='unit' && e.role!=='worker').map(e=>e.id);
  let barracksId:number|undefined,acceptedTrains=0,commandOrdinal=0,checkpoint:Record<string,unknown>|null=null;
  const pendingTrains:Array<{commandOrdinal:number;tick:number;producerId:number;paidCost:Cost}>=[];
  const paidPolicyIds=new Set<number>();
  const ownCompletions=new Map<number,Record<string,unknown>>();
  const acceptedAttacks=new Map<number,{commandOrdinal:number;tick:number;target:number;observation:Observation}>();
  const defenderPaidIds=new Set<number>();
  let firstPaidBuilding:Stamp|null=null,firstBarracksFoundation:Stamp|null=null,firstBarracksComplete:Stamp|null=null,firstCombatQueue:Stamp|null=null,firstPaidFighter:Stamp|null=null;
  let firstPaidWorkerHitTick:number|null=null,responseEndTick:number|null=null,stopReason='bounded-180-simulated-seconds';
  let evidenceFailure:Record<string,unknown>|null=null;
  const allWorkerHits:Array<Record<string,unknown>>=[];
  const ownTrainReceipts:Array<Record<string,unknown>>=[];

  const command=(value:Command) => {
    const own=view.observe(state),beforeBank=bank(own.player),beforeQueues=ownEntities(own).filter(e=>e.kind==='building').map(e=>({id:e.id,queue:[...e.queue]}));
    commandOrdinal++;
    const accepted=issueCommand(state,0,value),after=view.observe(state);
    const record={commandOrdinal,tick:own.tick,time:own.time,side:0,command:value,accepted,observation:own,beforeBank,afterBank:bank(after.player),beforeQueues,afterQueues:ownEntities(after).filter(e=>e.kind==='building').map(e=>({id:e.id,queue:[...e.queue]}))};
    if(accepted && 'ids' in value)for(const id of value.ids){
      if(value.type==='attack')acceptedAttacks.set(id,{commandOrdinal,tick:own.tick,target:value.target,observation:own});
      else if(['hold','stop','attackMove','move'].includes(value.type))acceptedAttacks.delete(id);
    }
    if(accepted && value.type==='attack' && !checkpoint && own.entities.some(e=>e.id===value.target && e.side===1 && e.kind==='unit' && e.role==='worker')) {
      const file=createSessionFile(state,recorder.export());
      const path=join(directory,'checkpoint-at-first-worker-attack-command-session.json');writeJson(path,file);
      checkpoint={path,commandOrdinal,tick:state.tick,time:state.time,replayActionIndex:file.replay!.actions.length-1,point:'after-first-accepted-observed-worker-attack-command-before-next-step'};
    }
    if(accepted && value.type==='train') {
      assert.equal(value.role,'melee');assert(acceptedTrains<3);
      const cost=own.content.faction.units.melee.cost,debited=zero();for(const key of costKeys)debited[key]=beforeBank[key]-after.player[key];
      assert(equalCost(debited,cost),'Accepted ordinary train must debit the observed native price');
      const prior=beforeQueues.find(q=>q.id===value.id)!,now=ownEntities(after).find(e=>e.id===value.id)!;
      assert.equal(now.queue.length,prior.queue.length+1);assert.equal(now.queue.at(-1),'melee');
      acceptedTrains++;const token={commandOrdinal,tick:own.tick,producerId:value.id,paidCost:{...cost}};
      pendingTrains.push(token);ownTrainReceipts.push({...token,beforeBank,afterBank:bank(after.player),debited,accepted:true});
    }
    if(accepted && value.type==='build') {
      const cost=own.content.faction.buildings.barracks.cost,debited=zero();for(const key of costKeys)debited[key]=beforeBank[key]-after.player[key];
      assert(equalCost(debited,cost));
      const born=ownEntities(after).filter(e=>e.kind==='building' && e.role==='barracks' && !own.entities.some(old=>old.id===e.id));
      assert.equal(born.length,1);barracksId=born[0].id;
      line(join(directory,'paid-spend-and-production.jsonl'),{type:'external-paid-foundation',commandOrdinal,tick:own.tick,foundationId:barracksId,paidCost:{...cost},beforeBank,afterBank:bank(after.player),ordinaryCooperativeBuilderIds:value.ids});
    }
    line(join(directory,'command-observations.jsonl'),record);
    return accepted;
  };

  const policy=() => {
    let own=view.observe(state);if(own.tick<20)return;
    let actors=ownEntities(own),hq=actors.find(e=>e.kind==='building' && e.role==='hq');
    if(!hq)return;
    if(barracksId===undefined) {
      const workers=actors.filter(e=>originalWorkerIds.includes(e.id) && e.kind==='unit' && e.role==='worker').map(e=>e.id).sort((a,b)=>a-b);
      if(workers.length)for(const site of candidateSites(own,hq))if(command({type:'build',ids:workers,role:'barracks',...site}))break;
    }
    own=view.observe(state);actors=ownEntities(own);
    const barracks=actors.find(e=>e.id===barracksId && e.kind==='building' && e.role==='barracks');
    if(barracks?.progress===1) {
      const workers=actors.filter(e=>originalWorkerIds.includes(e.id) && e.kind==='unit' && e.role==='worker').sort((a,b)=>a.id-b.id);
      for(const [index,worker] of workers.entries()) {
        own=view.observe(state);const kind=index<3?'wood':'ore';
        const nodes=own.resources.filter(r=>r.visible===true && r.amount>0 && r.kind===kind && (r.level??0)===(worker.level??0)).sort((a,b)=>d2(a,worker)-d2(b,worker)||a.id-b.id);
        const order=ownEntities(own).find(e=>e.id===worker.id)?.order;
        if(order?.type==='gather' && nodes.some(r=>r.id===order.target))continue;
        if(nodes[0])command({type:'gather',ids:[worker.id],target:nodes[0].id});
      }
      while(acceptedTrains<3) {
        own=view.observe(state);const producer=ownEntities(own).find(e=>e.id===barracksId),cost=own.content.faction.units.melee.cost;
        if(!producer || producer.progress!==1 || producer.queue.length>=5 || costKeys.some(key=>own.player[key]<cost[key]))break;
        if(!command({type:'train',id:producer.id,role:'melee'}))break;
      }
    }
    own=view.observe(state);
    for(const id of [...paidPolicyIds].sort((a,b)=>a-b)) {
      own=view.observe(state);const actor=ownEntities(own).find(e=>e.id===id && e.kind==='unit');if(!actor)continue;
      if(own.tick<1200) {if(actor.order.type!=='hold')command({type:'hold',ids:[id]});continue;}
      const worker=own.entities.filter(e=>e.side===1 && e.kind==='unit' && e.role==='worker' && (e.level??0)===(actor.level??0)).sort((a,b)=>d2(a,actor)-d2(b,actor)||a.id-b.id)[0];
      if(worker) {
        if(actor.order.type!=='attack' || actor.order.target!==worker.id)command({type:'attack',ids:[id],target:worker.id});
      } else if(actor.order.type!=='attackMove' && actor.order.type!=='attack')command({type:'attackMove',ids:[id],...own.map.starts[1]});
    }
  };

  try {
    try {
    command({type:'hold',ids:initialStarterIds});
    for(let index=0;index<3600;index++) {
      if(state.tick%20===0)policy();
      const before=snapshot(state);stepGame(state,.05);assert.equal(state.tick,before.tick+1);
      const events=structuredClone(state.events),after=snapshot(state),own=view.observe(state);
      // New live own melee IDs come only from own observation. Native events and
      // queue-dequeue reconciliation below authenticate payments in the auditor.
      for(const actor of ownEntities(own))if(actor.kind==='unit' && actor.role==='melee' && !actor.illusion && !actor.raised && !initialIds.has(actor.id))paidPolicyIds.add(actor.id);
      const ownTrainEvents=events.filter(event=>event.side===0 && event.type==='train' && after.entities.some(e=>e.id===event.source && e.kind==='unit' && e.role==='melee' && !e.illusion && !e.raised));
      const oldProducer=before.entities.find(e=>e.id===barracksId),newProducer=after.entities.find(e=>e.id===barracksId);
      const ownDequeues=(oldProducer?.queue.length??0)-(newProducer?.queue.length??0);
      assert(ownDequeues===ownTrainEvents.length,'Owned queue drop/refund lacks matching native train event; stop incomplete instead of misattributing a later recruit');
      for(const event of ownTrainEvents) {
        const actor=after.entities.find(e=>e.id===event.source)!;
        if(!initialIds.has(actor.id)) {
          const paid=pendingTrains.shift();assert(paid,'Owned recruit must correspond to an accepted ordinary paid train');
          ownCompletions.set(actor.id,{...paid,completionTick:after.tick,completionTime:after.time,unitId:actor.id,nativeActor:actor,observedActor:ownEntities(own).find(e=>e.id===actor.id)??null,nativePaidRecordAfter:after.paidCosts.find(p=>p.entityId===actor.id)??null,nativeTrainEvent:event});
        }
      }
      const accounts=accounting(before,after,events),account=accounts[1];
      const oldPaid=new Set(before.paidCosts.map(p=>p.entityId));
      const newPaid=after.paidCosts.filter(p=>!oldPaid.has(p.entityId));
      for(const paid of newPaid) {
        const actor=after.entities.find(e=>e.id===paid.entityId && e.side===1);if(!actor || initialDefenderIds.has(actor.id))continue;
        const stamp:Stamp={tick:after.tick,time:after.time,id:actor.id,role:actor.role,paidCost:paid.stock,nativeActor:actor,accounting:account};
        if(actor.kind==='building') {
          if(!firstPaidBuilding && actor.role!=='hq')firstPaidBuilding=stamp;
          if(!firstBarracksFoundation && actor.role==='barracks')firstBarracksFoundation=stamp;
        }
      }
      // The native train boundary remains valid when death removes its paid-cost
      // ledger record later in this same step. Do not require source survival.
      for(const event of events.filter(e=>e.type==='train' && e.side===1)) {
        const actor=after.entities.find(e=>e.id===event.source && e.kind==='unit' && e.role!=='worker' && !e.illusion && !e.raised);
        if(!actor || initialDefenderIds.has(actor.id) || after.producedFighters[1]<=before.producedFighters[1])continue;
        const priorPaidProducerCandidates=before.entities.filter(e=>e.side===1 && e.kind==='building' && e.role==='barracks' && e.queue[0]===actor.role);
        const producer=priorPaidProducerCandidates[0];
        if(!producer)continue;
        const paidRecord=after.paidCosts.find(p=>p.entityId===actor.id)??null;
        const paidCost=producer.queuePaidCosts?.[0]??FACTIONS.orcs.units[actor.role as UnitRole].cost;
        if(paidRecord)assert(equalCost(paidRecord.stock,paidCost));
        const stamp:Stamp={tick:after.tick,time:after.time,id:actor.id,role:actor.role,paidCost:{...paidCost},nativeActor:actor,nativeTrainEvent:event,nativePaidRecordAfter:paidRecord,priorPaidProducerCandidates,producerAttribution:'Native train event omits producer; retain compatible paid-queue candidates without claiming one exact producer.',producedFighterCounterBefore:before.producedFighters[1],producedFighterCounterAfter:after.producedFighters[1],accounting:account};
        defenderPaidIds.add(actor.id);if(!firstPaidFighter)firstPaidFighter=stamp;
      }
      for(const actor of after.entities.filter(e=>e.side===1 && e.kind==='building' && e.role==='barracks')) {
        const prior=before.entities.find(e=>e.id===actor.id);
        if(!firstBarracksComplete && actor.progress===1 && prior && prior.progress<1)firstBarracksComplete={tick:after.tick,time:after.time,id:actor.id,role:actor.role,nativeActor:actor};
      }
      if(!firstCombatQueue) {
        const added=account.queueChanges.filter(q=>q.role!=='worker' && q.added>0);
        if(added.length)firstCombatQueue={tick:after.tick,time:after.time,id:after.entities.find(e=>e.side===1 && e.kind==='building' && e.queue.some(role=>role!=='worker'))!.id,role:'paid-combat-queue',added,accounting:account};
      }
      const attackEvents=events.filter(e=>e.type==='attack');
      for(const event of attackEvents) {
        const victim=before.entities.find(e=>e.id===event.target)??after.entities.find(e=>e.id===event.target);
        const victimAfter=after.entities.find(e=>e.id===event.target),sourceBefore=before.entities.find(e=>e.id===event.source),sourceAfter=after.entities.find(e=>e.id===event.source);
        const completion=event.source===undefined?undefined:ownCompletions.get(event.source),paidRecord=before.paidCosts.find(p=>p.entityId===event.source)??after.paidCosts.find(p=>p.entityId===event.source);
        const accepted=event.source===undefined?undefined:acceptedAttacks.get(event.source);
        const workerHit=event.side===0 && victim?.side===1 && victim.kind==='unit' && victim.role==='worker' && (event.amount??0)>0;
        const hpBefore=victim?.hp??null,hpAfter=victimAfter?.hp??null,death=events.find(e=>e.type==='death' && e.source===event.target)??null;
        const paidSource=!!completion && !!paidRecord && equalCost(paidRecord.stock,FACTIONS.orcs.units.melee.cost);
        const observedTarget=!!accepted && accepted.target===event.target && accepted.observation.entities.some(e=>e.id===event.target && e.side===1 && e.kind==='unit' && e.role==='worker');
        const resolvedLoss=hpBefore!==null && ((hpAfter!==null && hpAfter<hpBefore)||!!death);
        const qualifying=workerHit && paidSource && observedTarget && resolvedLoss;
        if(workerHit && paidSource && firstPaidWorkerHitTick===null)firstPaidWorkerHitTick=after.tick;
        const evidence={tick:after.tick,time:after.time,event,workerHit,paidSource,observedTarget,resolvedLoss,qualifying,sourceBefore:sourceBefore??null,sourceAfter:sourceAfter??null,victimBefore:victim??null,victimAfter:victimAfter??null,hpBefore,hpAfter,shieldBefore:victim?.shield??0,shieldAfter:victimAfter?.shield??0,death,acceptedAttack:accepted??null,paidCompletion:completion??null,nativePaidRecord:paidRecord??null,ordinaryAttackEventsThisStep:attackEvents,defenderStarterIds,defenderPaidFighterIds:[...defenderPaidIds],defenderUnits:after.entities.filter(e=>e.side===1 && e.kind==='unit' && e.hp>0),firstBarracksFoundationTick:firstBarracksFoundation?.tick??null,firstBarracksCompleteTick:firstBarracksComplete?.tick??null,firstCombatQueueTick:firstCombatQueue?.tick??null};
        line(join(directory,'ordinary-hit-events.jsonl'),evidence);
        if(workerHit)allWorkerHits.push({tick:after.tick,time:after.time,source:event.source,target:event.target,amount:event.amount,qualifying,paidSource,observedTarget,resolvedLoss,commandOrdinal:accepted?.commandOrdinal??null});
      }
      const queueAndResearch=(audit:Audit)=>audit.entities.filter(e=>e.kind==='building').map(e=>({id:e.id,queue:e.queue,queueDefinitionIds:e.queueDefinitionIds,queuePaidCosts:e.queuePaidCosts,research:e.research,researchPaidCost:e.researchPaidCost}));
      const changed=JSON.stringify(before.players)!==JSON.stringify(after.players) || newPaid.length>0 || events.some(e=>['build','train','research','attack','death'].includes(e.type)) || JSON.stringify(queueAndResearch(before))!==JSON.stringify(queueAndResearch(after));
      if(changed)line(join(directory,'paid-spend-and-production.jsonl'),{type:'read-only-step-audit',tick:after.tick,time:after.time,before,after,events,accounts});
      if(isGameOver(state)){stopReason='native-game-over';break;}
      if(responseEndTick===null && acceptedTrains===3 && firstPaidFighter && firstPaidWorkerHitTick!==null)responseEndTick=after.tick+240;
      if(responseEndTick!==null && after.tick>=responseEndTick){stopReason='completed-12-second-response-window';break;}
    }
    } catch(error) {
      evidenceFailure=error instanceof Error?{name:error.name,message:error.message,tick:state.tick}: {message:String(error),tick:state.tick};
      stopReason='incomplete-proof-audit-or-output-cap';
    }
    const endpoint=createSessionFile(state,recorder.export());writeJson(join(directory,'endpoint-session.json'),endpoint);
    const receipt={status:evidenceFailure?'unmet':'recorded-awaiting-native-validation',evidenceComplete:evidenceFailure===null,evidenceFailure,sourcePin:pin,name,opening,advertisedOpening:AI_OPENINGS[opening],config:configFor(opening),initialStarterIds,defenderStarterIds,acceptedTrains,ownTrainReceipts,ownPaidCompletions:[...ownCompletions.values()],checkpoint,firstPaidBuilding,firstBarracksFoundation,firstBarracksComplete,firstCombatQueue,firstPaidFighter,firstPaidWorkerHitTick,responseEndTick,allWorkerHits,stop:{reason:stopReason,tick:state.tick,simulatedSeconds:state.time,terminal:isGameOver(state)},jsonlOutputs:[...logTotals].filter(([path])=>path.startsWith(directory+'/')).map(([path,total])=>({path,...total,limitBytes:logLimits[basename(path)]})),noPostRecorderDirectMutation:true,policyInformation:'Persistent PlayerView(0), including currently visible resource/worker targets; full state is read-only audit only.',causalLimit:'Later paid fighter completion is the outcome under matched pressure. Retained pre-hit milestones support the earlier spending delay; subsequent harassment can compound it.',inventoryExcludes:['run-receipt.json'],files:fileInventory(directory)};
    writeJson(join(directory,'run-receipt.json'),receipt);
    return {initial,receipt};
  } finally {recorder.dispose();}
}

// JSONL files are empty until real observations/events are appended.
function writeJsonEmpty(path:string){appendFileSync(path,'',{flag:'wx'});}
function differences(a:unknown,b:unknown,path='$'):Array<{path:string;left:unknown;right:unknown}> {
  if(a===b)return [];
  if(a && b && typeof a==='object' && typeof b==='object' && Array.isArray(a)===Array.isArray(b)) {
    const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>;
    return [...new Set([...Object.keys(aa),...Object.keys(bb)])].sort().flatMap(key=>differences(aa[key],bb[key],path+(Array.isArray(a)?`[${key}]`:'.'+key)));
  }
  return [{path,left:a??null,right:b??null}];
}

try {
  const control=runArm('infantry-control','infantry-rush'),expansion=runArm('depot-first-pressure','fast-expansion');
  const initialDifferences=differences(control.initial,expansion.initial);
  const equalInitialExceptOpening=initialDifferences.length===1 && initialDifferences[0].path==='$.state.aiConfigs[1].opening' && initialDifferences[0].left==='infantry-rush' && initialDifferences[0].right==='fast-expansion';
  const firstCostValid=(r:typeof control.receipt,role:'barracks'|'depot')=>r.firstPaidBuilding?.role===role && equalCost(r.firstPaidBuilding.paidCost as Cost,FACTIONS.orcs.buildings[role].cost) && (r.firstPaidBuilding.accounting as ReturnType<typeof accounting>[number]).fullyAccounted;
  const recognizable=firstCostValid(control.receipt,'barracks') && firstCostValid(expansion.receipt,'depot');
  const controlFirst=control.receipt.firstPaidFighter?.tick??null,expansionFirst=expansion.receipt.firstPaidFighter?.tick??null;
  const matchingHits=expansion.receipt.allWorkerHits.filter(h=>h.qualifying===true && controlFirst!==null && expansionFirst!==null && controlFirst<(h.tick as number) && (h.tick as number)<expansionFirst);
  const preHitMilestones=(r:typeof control.receipt)=>r.firstPaidWorkerHitTick!==null && [r.firstBarracksFoundation,r.firstBarracksComplete,r.firstCombatQueue].every(m=>m!==null && m.tick<r.firstPaidWorkerHitTick!);
  const causality=preHitMilestones(control.receipt) && preHitMilestones(expansion.receipt);
  const paidRecruitment=control.receipt.acceptedTrains===3 && expansion.receipt.acceptedTrains===3 && control.receipt.ownTrainReceipts.length===3 && expansion.receipt.ownTrainReceipts.length===3;
  const completeEvidence=control.receipt.evidenceComplete && expansion.receipt.evidenceComplete;
  const measured={equalInitialExceptOpening,initialDifferences,recognizable,paidRecruitment,completeEvidence,controlFirstPaidFighterTick:controlFirst,expansionFirstPaidFighterTick:expansionFirst,matchingHits,preHitMilestones:{control:preHitMilestones(control.receipt),expansion:preHitMilestones(expansion.receipt)},causality,openingDelayTicks:controlFirst!==null && expansionFirst!==null?expansionFirst-controlFirst:null,openingDelayMilliseconds:controlFirst!==null && expansionFirst!==null?(expansionFirst-controlFirst)*50:null,passesMeasuredGate:equalInitialExceptOpening && recognizable && paidRecruitment && completeEvidence && matchingHits.length>0 && causality};
  assert.deepEqual(productProvenance(pin),provenance.product,'Product bytes changed during probe');
  writeJson(join(output,'comparison.json'),{status:measured.passesMeasuredGate?'measured-gate-passed-awaiting-native-validation':'unmet',sourcePin:pin,originalRequirement:'opponents use recognizable builds with exploitable weaknesses.',measured,causalLimit:'First paid fighter completion is measured under this fixed ordinary pressure policy. Later worker harassment may compound the opening-related delay. No unpressured baseline or full-match victory is claimed.'});
  writeJson(join(output,'driver-receipt.json'),{status:'recorded-awaiting-native-validation',sourcePin:pin,startedAt,finishedAt:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,provenance,recipe:{path:recipePath,bytes:recipeBytes.length,sha256:sha256(recipeBytes)},arms:['infantry-control','depot-first-pressure'],measuredGate:measured.passesMeasuredGate,inventoryExcludes:['driver-receipt.json'],files:fileInventory(output)});
  process.stdout.write(JSON.stringify({status:'recorded-awaiting-native-validation',output,measuredGate:measured.passesMeasuredGate})+'\n');
} catch(error) {
  writeJson(join(output,'driver-failure.json'),{status:'unmet',sourcePin:pin,startedAt,finishedAt:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,failure:error instanceof Error?{name:error.name,message:error.message}:String(error),files:fileInventory(output)});
  process.stderr.write(String(error)+'\n');process.exitCode=1;
}
