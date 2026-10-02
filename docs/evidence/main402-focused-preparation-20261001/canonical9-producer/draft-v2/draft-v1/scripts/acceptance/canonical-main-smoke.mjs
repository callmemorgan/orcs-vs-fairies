import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertSessionIdentity } from './native-contract.mjs';

export const CANONICAL_CASES=['formation-line','formation-wedge','formation-square','formation-loose','charge-pike-front','charge-pike-rear','siege-full-crew-capture','ambush-selected-trigger','morale-supported-full-fight'];
const entity=(s,id)=>{const e=s.entities.find(e=>e.id===id);assert(e,`Entity #${id}`);return e;};
const hp=(s,id)=>s.entities.find(e=>e.id===id)?.hp??0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const sameIds=(a,b)=>a.length===b.length&&[...a].sort((a,b)=>a-b).every((id,i)=>id===[...b].sort((a,b)=>a-b)[i]);
const commands=file=>file.replay.actions.filter(a=>a.type==='command');
const command=(file,type,predicate)=>{const action=commands(file).find(a=>a.side===0&&a.command.type===type&&predicate(a.command));assert(action,`Accepted native side0 ${type}`);return action.command;};
const offset=(kind,slot,count,spacing)=>{
 if(kind==='line')return{x:0,y:(slot-(count-1)/2)*spacing};
 if(kind==='wedge'){if(!slot)return{x:0,y:0};const row=Math.ceil(slot/2);return{x:-row*spacing,y:(slot%2?-1:1)*row*spacing*.75};}
 const columns=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/columns),row=Math.floor(slot/columns),inRow=Math.min(columns,count-row*columns),scale=kind==='loose'?1.8:1;
 return{x:(row-(rows-1)/2)*spacing*scale,y:(slot%columns-(inRow-1)/2)*spacing*scale};
};

/** Native input and read-only observations. No issueCommand/stepGame/browser state writes. */
export async function runCanonicalTacticsSmoke(ctx){
 assert.equal(ctx.identity.saveVersion,4);assert.equal(ctx.identity.simulationRevision,'4.0.2');
 assert.equal(ctx.manifest.simulationRevision,'4.0.2');assert.equal(ctx.manifest.sourceCommit,ctx.evidence.source.commit);
 const exports=[],continuations=[],results={},traces={},requiredEventAudits=[];
 let active,tracked=[];const progress={activeCase:null,completedCases:[],exports,continuations,results,requiredEventAudits};ctx.evidence.canonicalProgress=progress;
 function collect(s){
  const trace=traces[active];if(!trace||trace.seen.has(s.tick))return;trace.seen.add(s.tick);
  trace.samples.push({tick:s.tick,time:s.time,actors:tracked.map(id=>{const e=s.entities.find(e=>e.id===id);return e?{id,side:e.side,x:e.x,y:e.y,level:e.level??0,hp:e.hp,maxHp:e.maxHp,cooldown:e.cooldown,facing:e.facing,order:e.order,tactics:e.tactics}:{id,missing:true,hp:0};}),projectiles:s.projectiles??[]});
  trace.events.push(...(s.events??[]).map(event=>({tick:s.tick,time:s.time,event})));
 }
 async function load(name){active=name;progress.activeCase=name;tracked=[];traces[name]={seen:new Set(),samples:[],events:[]};const fixture=await ctx.loadScenario(name);await ctx.pause();assert.equal((await ctx.snap()).mode,'local');return fixture;}
 async function until(predicate,label,timeout=30000){return ctx.runUntil(s=>{collect(s);return predicate(s);},{label,timeout});}
 async function verified(name){const file=await ctx.exportAndVerify(name);await ctx.pause();assertSessionIdentity(file,name,ctx.identity,true);assert(commands(file).every(a=>a.side===0),'No opponent command injected after authoring');exports.push({name,file:`${name}-save.json`,tick:file.game.state.tick});return file;}
 function continuation(from,a,to,b){assert(b.game.state.tick>a.game.state.tick);assert.deepEqual(a.replay.initial,b.replay.initial);continuations.push({checkpoint:`${from}-save.json`,final:`${to}-save.json`,checkpointTick:a.game.state.tick,finalTick:b.game.state.tick,scope:'Complete native saved game and runtime; later source-bound audit must execute the retained command/tick suffix.'});}
 async function hold(){await ctx.resume();await ctx.closePanels();await ctx.page.getByRole('button',{name:/^Hold position(?:\s|$)/}).click();await ctx.pause();}
 async function attack(ids,target){await ctx.selectMany(ids);await ctx.resume();await ctx.entityClick(target,'right');await ctx.wait(({ids,target})=>ids.every(id=>{const o=window.rts.state.entities.find(e=>e.id===id)?.order;return o?.type==='attack'&&o.target===target;}),{ids,target});}
 async function finishTrace(name){const trace=traces[name];delete trace.seen;await writeFile(resolve(ctx.out,`${name}-observations.json`),`${JSON.stringify(trace,null,2)}\n`,{flag:'wx'});progress.completedCases.push(name);}
 try{
 for(const kind of ['line','wedge','square','loose']){
  const name=`formation-${kind}`,{ids}=await load(name);tracked=ids.army;const initial=await ctx.snap();assert(ids.army.every(id=>hp(initial,id)===entity(initial,id).maxHp));collect(initial);
  await ctx.selectMany(ids.army);await ctx.resume();const panel=await ctx.openTactics();await panel.getByLabel('Troop facing',{exact:true}).selectOption('0');await panel.getByLabel('Formation spacing',{exact:true}).fill('.8');
  await panel.getByRole('button',{name:kind[0].toUpperCase()+kind.slice(1),exact:true}).click();await ctx.wait(({army,kind})=>army.every(id=>window.rts.state.entities.find(e=>e.id===id)?.tactics?.formation?.kind===kind),{army:ids.army,kind});
  assert.equal(await panel.getByRole('status').innerText(),`${kind[0].toUpperCase()+kind.slice(1)} applied to 6 units.`);await ctx.pause();await ctx.screenshot(`${name}-panel`);await ctx.closePanels();await ctx.resume();await ctx.ground(ids.destination,'right');
  await ctx.wait(({army,destination})=>army.every(id=>{const f=window.rts.state.entities.find(e=>e.id===id)?.tactics?.formation;return f&&Math.hypot(f.anchor.x-destination.x,f.anchor.y-destination.y)<.05;}),{army:ids.army,destination:ids.destination});const actualAnchor=entity(await ctx.snap(),ids.army[0]).tactics.formation.anchor;
  const settled=await until(s=>ids.army.slice().sort((a,b)=>a-b).every((id,slot)=>{
   const troop=entity(s,id),f=troop.tactics?.formation,o=offset(kind,slot,6,.8);
   return troop.hp>0&&f?.kind===kind&&f.slot===slot&&f.count===6&&f.spacing===.8&&f.facing===0&&f.phase==='formed'&&f.anchor.x===actualAnchor.x&&f.anchor.y===actualAnchor.y&&troop.facing===0&&troop.order.type==='hold'&&Math.hypot(troop.x-actualAnchor.x-o.x,troop.y-actualAnchor.y-o.y)<.7;
  }),`${name} six living troops settle`);
  assert.equal(new Set(ids.army.map(id=>entity(settled,id).tactics.formation.group)).size,1);
  assert(traces[name].samples.some(sample=>sample.actors.some(e=>e.x>23&&e.x<26&&Math.abs(e.y-20.5)>=1.27)),'Observed detour around the owned depot');
  await ctx.screenshot(`${name}-settled`);const file=await verified(`${name}-settled`);
  command(file,'formation',c=>sameIds(c.ids,ids.army)&&c.formation===kind&&c.spacing===.8&&c.facing===0);const acceptedMove=command(file,'move',c=>sameIds(c.ids,ids.army)&&Math.hypot(c.x-ids.destination.x,c.y-ids.destination.y)<.05);assert.equal(acceptedMove.x,actualAnchor.x);assert.equal(acceptedMove.y,actualAnchor.y);
  results[name]={tick:settled.tick,army:ids.army,requestedDestination:ids.destination,acceptedMove,actualAnchor,group:entity(settled,ids.army[0]).tactics.formation.group};ctx.record(`${name} applies through main Tactics, moves and persists six living troops`,results[name]);await finishTrace(name);
 }
 for(const direction of ['front','rear']){
  const name=`charge-pike-${direction}`,{ids}=await load(name);tracked=[ids.source,ids.target];const before=await ctx.snap();assert.equal(hp(before,ids.source),entity(before,ids.source).maxHp);assert.equal(hp(before,ids.target),entity(before,ids.target).maxHp);collect(before);
  await attack([ids.source],ids.target);const moving=await until(s=>(entity(s,ids.source).tactics?.charge?.distance??0)>=4&&hp(s,ids.target)===hp(before,ids.target),`${name} charged before first hit`);collect(moving);
  const movingName=`${name}-moving`,movingFile=await verified(movingName);command(movingFile,'attack',c=>sameIds(c.ids,[ids.source])&&c.target===ids.target);assert((entity(movingFile.game.state,ids.source).tactics?.charge?.distance??0)>=4);assert.equal(hp(movingFile.game.state,ids.target),hp(before,ids.target));
  const impact=await until(s=>hp(s,ids.target)<hp(before,ids.target),`${name} first hit`);collect(impact);
  const result={tick:impact.tick,targetLoss:hp(before,ids.target)-hp(impact,ids.target),riderLoss:hp(before,ids.source)-hp(impact,ids.source),chargeAfter:entity(impact,ids.source).tactics?.charge?.distance??0,targetFacing:entity(impact,ids.target).facing,targetOrder:entity(impact,ids.target).order};
  assert.equal(result.targetOrder.type,'hold');assert.equal(result.targetFacing,direction==='front'?4:0);
  if(direction==='front'){assert(Math.abs(result.targetLoss-17)<=1e-6);assert(result.riderLoss>10);assert.equal(result.chargeAfter,0);}else{assert.equal(result.riderLoss,0);assert(result.targetLoss>results['charge-pike-front'].targetLoss*1.5);}
  // Preserve the first-hit snapshot separately; stop later hits before persistence work.
  await hold();await ctx.screenshot(`${name}-impact`);const impactName=`${name}-impact`,impactFile=await verified(impactName);command(impactFile,'attack',c=>c.ids.includes(ids.source)&&c.target===ids.target);assert.equal(hp(impactFile.game.state,ids.target),hp(impact,ids.target),'Hold prevents a second rider hit before export');continuation(movingName,movingFile,impactName,impactFile);
  requiredEventAudits.push({scenario:name,kind:'first-cavalry-hit',source:ids.source,target:ids.target,observedFirstTick:impact.tick,observedEvents:traces[name].events.filter(item=>item.event.type==='attack')});
  results[name]=result;ctx.record(`${name} first impact and return damage`,result);await finishTrace(name);
 }
 {
  const name='siege-full-crew-capture',{ids,authored}=await load(name);tracked=[ids.captor,ids.engine,ids.target];const before=await ctx.snap(),initial=entity(before,ids.engine);
  assert.equal(initial.side,1);assert.equal(initial.hp,initial.maxHp);assert.deepEqual(initial.tactics.siegeCrew,{hp:42,maxHp:42,uncrewed:false});collect(before);
  await attack([ids.captor],ids.engine);const defeated=await until(s=>entity(s,ids.engine).tactics.siegeCrew.uncrewed,'Real full crew defeated',20000);collect(defeated);assert.equal(entity(defeated,ids.engine).tactics.siegeCrew.hp,0);assert.equal(hp(defeated,ids.engine),authored.engineHullHealth);
  await hold();await ctx.screenshot('siege-crew-defeated');const crewless=await verified('siege-crew-defeated');command(crewless,'attack',c=>c.ids.includes(ids.captor)&&c.target===ids.engine);assert.equal(hp(crewless.game.state,ids.engine),authored.engineHullHealth);
  await ctx.selectTroop(ids.captor);await ctx.resume();const panel=await ctx.openTactics();await panel.getByLabel('Abandoned siege engine',{exact:true}).selectOption(String(ids.engine));assert(await panel.getByRole('button',{name:'Capture siege engine',exact:true}).isEnabled());await panel.getByRole('button',{name:'Capture siege engine',exact:true}).click();
  await until(s=>{const c=entity(s,ids.captor).tactics?.capture;return c?.target===ids.engine&&c.progress>=.35&&c.progress<.75;},'Incomplete ordinary capture channel',15000);await ctx.screenshot('siege-mid-capture');const partial=await verified('siege-mid-capture');command(partial,'captureSiege',c=>c.ids.includes(ids.captor)&&c.target===ids.engine);assert.equal(entity(partial.game.state,ids.engine).side,1);assert(entity(partial.game.state,ids.engine).tactics.siegeCrew.uncrewed);
  await until(s=>entity(s,ids.engine).side===0&&!entity(s,ids.engine).tactics.siegeCrew.uncrewed,'Capture completes after native reimport',15000);await ctx.screenshot('siege-new-owner');const captured=await verified('siege-new-owner'),owned=entity(captured.game.state,ids.engine);
  assert.equal(owned.definitionFaction,'orcs');assert.equal(owned.definitionId,authored.engineDefinitionId);assert.equal(owned.hp,authored.engineHullHealth);assert.equal(owned.maxHp,authored.engineHullHealth);assert.deepEqual(owned.tactics.siegeCrew,{hp:42,maxHp:42,uncrewed:false});assert.equal(entity(captured.game.state,ids.captor).tactics.capture,undefined);
  await ctx.selectTroop(ids.engine);await ctx.resume();await ctx.ground(ids.moveDestination,'right');await until(s=>distance(entity(s,ids.engine),ids.moveDestination)<.8&&entity(s,ids.engine).order.type!=='move','New owner moves engine',20000);const moved=await verified('siege-new-owner-moved');command(moved,'move',c=>c.ids.includes(ids.engine)&&Math.hypot(c.x-ids.moveDestination.x,c.y-ids.moveDestination.y)<.05);
  await attack([ids.engine],ids.target);await until(s=>(s.projectiles??[]).some(p=>p.source===ids.engine&&p.side===0),'New-owner pending shell',20000);const pending=await verified('siege-new-owner-pending-shot'),shell=pending.game.state.projectiles.find(p=>p.source===ids.engine);assert.equal(shell.side,0);assert.equal(shell.faction,'orcs');assert.equal(hp(pending.game.state,ids.target),authored.targetHealth);
  await until(s=>hp(s,ids.target)<authored.targetHealth,'Reimported shell impacts',15000);const impact=await verified('siege-new-owner-impact');command(impact,'attack',c=>c.ids.includes(ids.engine)&&c.target===ids.target);continuation('siege-mid-capture',partial,'siege-new-owner-impact',impact);continuation('siege-new-owner-pending-shot',pending,'siege-new-owner-impact',impact);
  requiredEventAudits.push({scenario:name,kind:'real-full-crew-defeat-and-new-owner-shot',captor:ids.captor,engine:ids.engine,target:ids.target,observedEvents:traces[name].events.filter(item=>['attack','message'].includes(item.event.type))});
  results[name]={initialCrew:initial.tactics.siegeCrew,defeatedTick:defeated.tick,capturedTick:captured.game.state.tick,targetLoss:authored.targetHealth-hp(impact.game.state,ids.target)};ctx.record('Full crew defeat, ordinary capture and new-owner movement/firing',results[name]);await finishTrace(name);
 }
 {
  const name='ambush-selected-trigger',{ids,authored}=await load(name);tracked=[ids.ambusher,ids.wrongTarget,ids.trigger];await ctx.selectTroop(ids.dryTroop);await ctx.resume();let panel=await ctx.openTactics();assert(!(await panel.getByRole('button',{name:'Set ambush',exact:true}).isEnabled()));assert.match(await panel.innerText(),/Move selected troops into woodland or beside standing trees first/);await ctx.pause();ctx.record('Main Tactics disables ambush on dry ground',{dryTroop:ids.dryTroop});
  await ctx.selectTroop(ids.ambusher);await ctx.resume();panel=await ctx.openTactics();await panel.getByLabel('Ambush trigger radius',{exact:true}).fill('2');await panel.getByLabel('Ambush target',{exact:true}).selectOption('melee');assert(await panel.getByRole('button',{name:'Set ambush',exact:true}).isEnabled());await panel.getByRole('button',{name:'Set ambush',exact:true}).click();await ctx.wait(id=>window.rts.state.entities.find(e=>e.id===id)?.tactics?.ambush?.concealed,ids.ambusher);
  const ready=await until(s=>entity(s,ids.ambusher).cooldown===0&&entity(s,ids.ambusher).tactics?.ambush?.concealed&&distance(entity(s,ids.trigger),entity(s,ids.ambusher))>2.5,'Ambusher ready before selected-role approach',15000);
  const held=await until(s=>s.tick>=ready.tick+20&&entity(s,ids.ambusher).cooldown===0&&entity(s,ids.ambusher).tactics?.ambush?.concealed&&distance(entity(s,ids.trigger),entity(s,ids.ambusher))>2.5,'Ready fire withheld for20 real ticks',5000);assert.equal(hp(held,ids.wrongTarget),authored.wrongTargetHealth);assert.equal(hp(held,ids.trigger),authored.triggerHealth);assert(distance(entity(held,ids.wrongTarget),entity(held,ids.ambusher))<2);
  panel=await ctx.openTactics();assert.match(await panel.getByLabel('Selected unit tactics',{exact:true}).innerText(),/Ambush concealed.*melee within 2/);await ctx.screenshot('ambush-concealed-panel');const concealed=await verified('ambush-concealed');command(concealed,'ambush',c=>sameIds(c.ids,[ids.ambusher])&&c.radius===2&&c.target==='melee');
  const triggered=await until(s=>!entity(s,ids.ambusher).tactics?.ambush?.concealed&&hp(s,ids.trigger)<authored.triggerHealth,'Authored melee march triggers actual ambush',25000);assert(distance(entity(triggered,ids.trigger),entity(triggered,ids.ambusher))<=2);assert.equal(hp(triggered,ids.wrongTarget),authored.wrongTargetHealth);assert.equal(entity(triggered,ids.ambusher).tactics.ambush.radius,2);assert.equal(entity(triggered,ids.ambusher).tactics.ambush.target,'melee');
  await ctx.screenshot('ambush-triggered');const final=await verified('ambush-triggered');continuation('ambush-concealed',concealed,'ambush-triggered',final);requiredEventAudits.push({scenario:name,kind:'selected-role-ambush-hit',source:ids.ambusher,target:ids.trigger,observedEvents:traces[name].events.filter(item=>item.event.type==='attack')});
  results[name]={readyTick:ready.tick,concealedTick:held.tick,triggeredTick:triggered.tick,wrongTargetHp:hp(triggered,ids.wrongTarget),targetHp:hp(triggered,ids.trigger)};ctx.record('Ready concealed archer ignores worker and fires on authored melee approach',results[name]);await finishTrace(name);
 }
 {
  const name='morale-supported-full-fight',{ids}=await load(name);tracked=[...ids.siege,...ids.squad];const initial=await ctx.snap();
  collect(initial);for(const id of ids.squad){const e=entity(initial,id);assert.equal(e.hp,e.maxHp);assert.equal(e.tactics.morale,100);assert.equal(e.tactics.recentLoss,0);}
  await ctx.selectTroop(ids.siege[0]);const panel=await ctx.openTactics();assert.match(await panel.getByLabel('Selected unit tactics',{exact:true}).innerText(),/Morale 100%/);await ctx.screenshot('morale-full-baseline-panel');await ctx.closePanels();await ctx.ground({x:17.5,y:21.5,level:0},'left');await ctx.page.keyboard.press('F2');await ctx.wait(ids=>window.rts.selected.length===ids.length&&ids.every(id=>window.rts.selected.includes(id)),ids.siege);await ctx.resume();await ctx.entityClick(ids.primary,'right');
  let wounded;
  const retreat=await until(s=>{
   const a=entity(s,ids.primary),b=entity(s,ids.support);if(a.hp>0&&b.hp>0&&(a.hp<a.maxHp||b.hp<b.maxHp)&&!wounded)wounded={tick:s.tick,primary:a,support:b};
   if(!(a.hp>0&&b.hp>0&&ids.ranged.every(id=>hp(s,id)===0)))return false;
   return [a,b].some(e=>e.tactics?.retreat&&e.tactics.morale<22&&distance(a,b)<4.5&&(a.level??0)===(b.level??0)&&s.teams[a.side]===s.teams[b.side]);
  },'Combat wounds/casualties cause a surviving supported retreat',20000);collect(retreat);
  const retreater=[entity(retreat,ids.primary),entity(retreat,ids.support)].find(e=>e.tactics?.retreat&&e.tactics.morale<22),support=entity(retreat,retreater.id===ids.primary?ids.support:ids.primary);assert(wounded);assert(retreater.hp>0&&retreater.hp<retreater.maxHp);assert(support.hp>0);assert(distance(retreater,support)<4.5);
  const threat=ids.siege.map(id=>entity(retreat,id)).find(e=>e.hp>0&&distance(e,retreater)<5.5&&retreat.visible[retreater.side].includes((e.level??0)*retreat.width*retreat.height+Math.floor(e.y)*retreat.width+Math.floor(e.x)));assert(threat,'A live visible threat exists at retreat');assert.equal(retreater.side,1);
  // The seven attackers remain selected; a native hold prevents a later volley.
  await hold();await ctx.screenshot('morale-supported-retreat');const activeSave=await verified('morale-supported-retreat');command(activeSave,'attack',c=>sameIds(c.ids,ids.siege)&&c.target===ids.primary);
  const origin={x:entity(activeSave.game.state,retreater.id).x,y:entity(activeSave.game.state,retreater.id).y};const moved=await until(s=>s.tick>=activeSave.game.state.tick+20&&hp(s,retreater.id)>0&&distance(entity(s,retreater.id),origin)>.3,'Saved automatic retreat continues moving',10000);const movedSave=await verified('morale-supported-retreat-moved');continuation('morale-supported-retreat',activeSave,'morale-supported-retreat-moved',movedSave);
  // Inspect the damaged squad's owned morale through native replay perspective.
  await ctx.openSessions('replay');await ctx.sessions.getByLabel('Import replay JSON',{exact:true}).setInputFiles(resolve(ctx.out,'morale-supported-retreat-replay.json'));await ctx.sessions.getByRole('button',{name:'Import replay',exact:true}).click();await ctx.wait(()=>window.rts.mode==='replay');await ctx.ready();await ctx.sessions.getByLabel('Replay tick',{exact:true}).press('End');await ctx.wait(tick=>window.rts.state.tick===tick,activeSave.game.state.tick);await ctx.sessions.getByLabel('Replay perspective',{exact:true}).selectOption('1');await ctx.wait(()=>window.rts.viewSide===1);await ctx.closeSessions();await ctx.selectTroop(retreater.id);const stats=await ctx.openTactics();assert((await stats.getByLabel('Selected unit tactics',{exact:true}).innerText()).includes(`Morale ${Math.round(entity(activeSave.game.state,retreater.id).tactics.morale)}%`));await ctx.screenshot('morale-retreater-owned-panel');await ctx.importSave(resolve(ctx.out,'morale-supported-retreat-moved-save.json'),'Restore native morale continuation');await ctx.closeSessions();await ctx.pause();
  requiredEventAudits.push({scenario:name,kind:'full-morale-combat-causal-chain',attackerIds:ids.siege,squadIds:ids.squad,deadAllies:ids.ranged,retreater:retreater.id,observedEvents:traces[name].events.filter(item=>['attack','death','message'].includes(item.event.type))});
  results[name]={initialSquad:ids.squad.map(id=>entity(initial,id)),wounded,retreat:{tick:retreat.tick,retreater,support,supportDistance:distance(retreater,support),visibleThreat:threat.id},movedTick:moved.tick,movement:distance(entity(moved,retreater.id),origin)};ctx.record('Full-health morale100 squad suffers real wounds/deaths and retreats with a live close ally',results[name]);await finishTrace(name);
 }
 return{completed:true,scope:'Nine bounded canonical production-main encounters; no full39-case or stress certification',caseNames:CANONICAL_CASES,exports,continuations,results,requiredEventAudits,status:'Native observations and complete browser persistence only. Root must inspect transient event/replay continuation evidence before admission.'};
 }catch(error){
  progress.failure={case:active,message:String(error.stack??error)};const trace=traces[active];if(trace)try{await writeFile(resolve(ctx.out,`${active}-failure-observations.json`),`${JSON.stringify({samples:trace.samples,events:trace.events},null,2)}\n`,{flag:'wx'});}catch(captureError){progress.failure.traceCaptureError=String(captureError.stack??captureError);}throw error;
 }
}

