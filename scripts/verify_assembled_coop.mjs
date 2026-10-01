import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');
const base=process.argv[2]??'http://127.0.0.1:8788';
const out=resolve(process.env.OVF_COOP_PROOF_DIR??'work/hundred-features/online-coop-proof');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const profiles=[],errors=[],captureErrors=[],evidence={base,startedAt:new Date().toISOString(),buildLabel:process.env.OVF_ONLINE_BUILD_LABEL??null,pageBuilds:[],checks:[],limits:[]};
let phase='opening two normal browser profiles';
const record=(name,details=true)=>{evidence.checks.push({name,details});console.log(`${name}: ${JSON.stringify(details)}`);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function guest(name) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  const profile={name,context,page,snapshots:[],sent:[],receipts:[],hellos:[],observedIds:new Map(),aiAttacks:[]};profiles.push(profile);
  page.on('pageerror',error=>errors.push({profile:name,message:error.message}));
  page.on('websocket',socket=>{
    socket.on('framesent',event=>{try{const message=JSON.parse(event.payload);if(message.kind==='command')profile.sent.push(message);}catch(error){captureErrors.push({profile:name,direction:'sent',message:String(error)});}});
    socket.on('framereceived',event=>{try{
      const message=JSON.parse(event.payload);
      if(message.kind==='hello')profile.hellos.push(message);
      if(message.kind==='commandAck')profile.receipts.push(message);
      if(message.kind!=='snapshot')return;
      profile.snapshots.push(message);
      for(const entity of message.view.entities)profile.observedIds.set(entity.id,{side:entity.side,kind:entity.kind});
      for(const event of message.view.events) {
        if(event.type!=='attack'||![2,3].includes(event.side)||!(event.amount>0))continue;
        const attacker=message.view.entities.find(entity=>entity.id===event.source);
        const target=profile.observedIds.get(event.target);
        if(attacker?.side!==event.side||target?.kind!=='unit'||![0,1].includes(target.side))continue;
        profile.aiAttacks.push({profile:name,tick:event.tick,frameTick:message.tick,eventId:event.eventId,side:event.side,source:event.source,target:event.target,targetSide:target.side,targetKind:target.kind,amount:event.amount,x:event.x,y:event.y});
      }
    }catch(error){captureErrors.push({profile:name,direction:'received',message:String(error)});}});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  evidence.pageBuilds.push({profile:name,...await page.evaluate(()=>({url:location.href,moduleScripts:Array.from(document.querySelectorAll('script[type="module"][src]'),node=>node.src),stylesheets:Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'),node=>node.href)}))});
  await page.getByRole('button',{name:'Online',exact:true}).click();
  await page.getByRole('button',{name:'Play as guest',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.online-account')?.hidden&&document.querySelector('.online-username')?.textContent?.startsWith('Guest'),{},{timeout:15000});
  profile.username=await page.locator('.online-username').textContent();return profile;
}
async function refresh(profile){await profile.page.getByRole('button',{name:'Refresh lobbies',exact:true}).click();}
async function battlefield(profile,side) {
  await profile.page.waitForSelector('.online-overlay[hidden]',{state:'attached',timeout:60000});
  await profile.page.waitForSelector('.loading-battle[hidden]',{state:'attached',timeout:60000});
  await profile.page.waitForFunction(expected=>{try{const rts=window.rts;return rts?.mode==='online'&&rts.viewSide===expected&&rts.state.players.length===4&&rts.state.explored[expected].size>0;}catch{return false;}},side,{timeout:60000});
  const diagnostics=await profile.page.evaluate(()=>({paused:window.rts.paused,readOnly:window.rts.readOnly,simulationEnabled:window.rts.simulationEnabled,teams:window.rts.state.teams}));
  assert.deepEqual(diagnostics,{paused:false,readOnly:false,simulationEnabled:false,teams:[0,0,1,1]});
  assert.equal(await profile.page.locator('#game-canvas canvas').isVisible(),true);
}
async function receipt(profile,clientSeq) {
  for(let attempt=0;attempt<150;attempt++){const value=profile.receipts.find(item=>item.clientSeq===clientSeq);if(value)return value;await sleep(100);}
  throw new Error(`${profile.name} did not receive receipt ${clientSeq}.`);
}
async function hudRecruit(profile,side) {
  await profile.page.locator('[data-session-tool="production"]').click();
  await profile.page.waitForSelector('.session-tools:not(.planning-tools) .session-overlay:not([hidden])');
  const producer=profile.page.locator('[data-production-building]').first(),id=Number(await producer.getAttribute('data-production-building'));
  await producer.getByRole('button',{name:'Select building',exact:true}).click();
  await profile.page.waitForSelector('.session-tools:not(.planning-tools) .session-overlay[hidden]',{state:'attached'});
  await profile.page.waitForFunction(id=>window.rts.selected.includes(id),id);
  assert.equal(await profile.page.evaluate(()=>window.rts.paused),false);
  const recruit=profile.page.locator('#action-buttons .action-button').first();assert.equal(await recruit.getAttribute('aria-disabled'),'false');
  const before=profile.sent.length;await recruit.click();
  for(let attempt=0;attempt<100&&profile.sent.length===before;attempt++)await sleep(20);
  const command=profile.sent.at(-1);assert.ok(profile.sent.length>before);assert.deepEqual(command.command,{type:'train',id,role:'worker'});
  const ack=await receipt(profile,command.clientSeq);assert.equal(ack.accepted,true);
  await profile.page.waitForFunction(({id,side})=>window.rts.state.entities.some(entity=>entity.id===id&&entity.side===side&&entity.queue.includes('worker')),{id,side});
  return {side,producerId:id,command,receipt:ack};
}
function sharedFrame(first,second,minimumTick=0) {
  const other=new Map(second.snapshots.map(frame=>[frame.tick,frame]));
  for(const frame of [...first.snapshots].reverse()){const partner=other.get(frame.tick);if(partner&&frame.tick>=minimumTick)return [frame,partner];}
  throw new Error('The two players have no matching authoritative frame tick.');
}
async function appliedVision(profile) {
  const display=await profile.page.evaluate(()=>{const rts=window.rts,state=rts.state;return {tick:state.tick,side:rts.viewSide,visible:[...state.visible[rts.viewSide]].sort((a,b)=>a-b),explored:[...state.explored[rts.viewSide]].sort((a,b)=>a-b),alliedHqs:state.entities.filter(entity=>entity.side!==rts.viewSide&&state.teams[entity.side]===state.teams[rts.viewSide]&&entity.role==='hq').map(entity=>entity.id).sort((a,b)=>a-b)};});
  let frame;
  for(let attempt=0;attempt<30&&!frame;attempt++){frame=profile.snapshots.findLast(value=>value.tick===display.tick);if(!frame)await sleep(20);}
  assert.ok(frame,'Displayed vision must have a captured authoritative frame');
  assert.deepEqual(display.visible,frame.view.visible);assert.deepEqual(display.explored,frame.view.explored);
  const alliedIds=frame.view.allies.map(ally=>ally.side);
  assert.deepEqual(display.alliedHqs,frame.view.entities.filter(entity=>alliedIds.includes(entity.side)&&entity.role==='hq').map(entity=>entity.id).sort((a,b)=>a-b));
  await writeFile(join(out,`${profile.name}-applied-vision.json`),JSON.stringify({display,authoritativeFrame:frame},null,2));
  assert.ok(display.alliedHqs.length>0);return {tick:display.tick,side:display.side,visibleTiles:display.visible.length,exploredTiles:display.explored.length,alliedHqs:display.alliedHqs};
}
function checkSharedVision(frames) {
  const [first,second]=frames.map(frame=>frame.view);
  assert.equal(first.side,0);assert.equal(second.side,1);
  for(const view of [first,second]){assert.equal(view.teamId,0);assert.equal(view.sharedVision,true);assert.deepEqual(view.allies.map(player=>player.side),[1-view.side]);assert.deepEqual(view.opponents.map(player=>player.side),[2,3]);}
  assert.deepEqual(first.visible,second.visible);assert.deepEqual(first.explored,second.explored);
  const contribution=[];
  for(const view of [first,second]) {
    const own=view.entities.filter(entity=>entity.side===view.side),ally=view.entities.find(entity=>entity.side===1-view.side&&entity.role==='hq');assert.ok(ally);
    const definition=view.content.faction;
    const ownObserverCovers=own.some(entity=>Math.hypot(entity.x-ally.x,entity.y-ally.y)<=(entity.kind==='unit'?definition.units[entity.role].sight:definition.buildings[entity.role].sight)+1);
    assert.equal(ownObserverCovers,false,'The teammate HQ must be beyond the own army vision radius at this frame');
    const cell=Math.floor(ally.y)*view.map.width+Math.floor(ally.x);assert.ok(view.visible.includes(cell));
    contribution.push({viewer:view.side,ally:ally.side,allyHq:ally.id,allyHqVisibleBeyondOwnSight:true});
  }
  return {tick:frames[0].tick,visibleTiles:first.visible.length,exploredTiles:first.explored.length,contribution};
}
async function attackMove(profile,side,target) {
  const targetCell=await profile.page.evaluate(({side,target})=>{const state=window.rts.state,cell=Math.floor(target.y)*state.width+Math.floor(target.x);return {cell,explored:state.explored[side].has(cell)};},{side,target});
  assert.equal(targetCell.explored,false,'The scout target must begin outside explored terrain');
  await profile.page.keyboard.press('F2');
  await profile.page.waitForFunction(expected=>window.rts.selected.length>0&&window.rts.state.entities.filter(entity=>window.rts.selected.includes(entity.id)).every(entity=>entity.side===expected&&entity.role!=='worker'),side);
  const map=await profile.page.locator('#minimap').boundingBox(),dimensions=await profile.page.evaluate(()=>({width:window.rts.state.width,height:window.rts.state.height}));
  await profile.page.mouse.click(map.x+target.x/dimensions.width*map.width,map.y+target.y/dimensions.height*map.height);
  await profile.page.keyboard.press('a');
  const canvas=await profile.page.locator('#game-canvas canvas').boundingBox(),camera=await profile.page.evaluate(()=>window.rts.camera);
  const projected={x:1600+(target.x-target.y)*32,y:80+(target.x+target.y)*16};
  const point={x:canvas.x+(projected.x-camera.x)*camera.zoom*canvas.width/camera.width,y:canvas.y+(projected.y-camera.y)*camera.zoom*canvas.height/camera.height};
  const before=profile.sent.length;await profile.page.mouse.click(point.x,point.y);
  for(let attempt=0;attempt<100&&profile.sent.length===before;attempt++)await sleep(20);
  assert.ok(profile.sent.length>before);const command=profile.sent.at(-1);assert.equal(command.command.type,'attackMove');
  assert.ok(Math.abs(command.command.x-target.x)<.1&&Math.abs(command.command.y-target.y)<.1,'The transmitted attack-move must target the clicked map location');
  const ack=await receipt(profile,command.clientSeq);assert.equal(ack.accepted,true);
  return {side,target,targetCell:targetCell.cell,initiallyUnexplored:true,ids:command.command.ids,clientSeq:command.clientSeq,appliedTick:ack.appliedTick};
}
function observedAiConstruction() {
  return [2,3].map(side=>{
    const buildings=new Map();
    for(const profile of profiles)for(const frame of profile.snapshots)for(const entity of frame.view.entities){
      if(entity.side!==side||entity.kind!=='building'||entity.role!=='barracks')continue;
      const samples=buildings.get(entity.id)??[];samples.push({tick:frame.tick,progress:entity.progress});buildings.set(entity.id,samples);
    }
    for(const [id,samples] of buildings){samples.sort((a,b)=>a.tick-b.tick);const first=samples[0],last=samples.at(-1);if(last.tick>first.tick&&last.progress>first.progress+.01)return {side,id,role:'barracks',first,last};}
    throw new Error(`AI player ${side} did not show a progressing barracks foundation in authoritative observations.`);
  });
}
async function waitForBothAiAttacks(timeoutMs=90000) {
  const started=Date.now();
  while(Date.now()-started<timeoutMs) {
    const attacks=profiles.flatMap(profile=>profile.aiAttacks),sides=new Set(attacks.map(event=>event.side));
    if(sides.has(2)&&sides.has(3))return attacks;
    await sleep(500);
  }
  throw new Error(`Observed positive AI attacks from sides ${[...new Set(profiles.flatMap(profile=>profile.aiAttacks).map(event=>event.side))]}; both enemy AI players must attack observed human units.`);
}

try {
  const first=await guest('human-one'),second=await guest('human-two');assert.notEqual(first.username,second.username);
  record('Two isolated browser profiles receive different real guest accounts',{guests:[first.username,second.username]});
  phase='creating two-human versus two-AI cooperative lobby';
  await first.page.getByLabel('Lobby player count',{exact:true}).selectOption('4');await first.page.getByLabel('Lobby map size',{exact:true}).selectOption('large');
  for(let player=1;player<=4;player++){await first.page.getByLabel(`Lobby player ${player} team`,{exact:true}).selectOption(player<=2?'0':'1');await first.page.getByLabel(`Lobby player ${player} controller`,{exact:true}).selectOption(player<=2?'human':'ai');}
  await first.page.getByLabel('Lobby shared vision',{exact:true}).check();
  await first.page.getByRole('button',{name:'Create lobby',exact:true}).click();await first.page.waitForSelector('.online-current:not([hidden])');
  const lobbyId=(await first.page.locator('.online-lobby-id').textContent()).trim();evidence.lobbyId=lobbyId;
  await refresh(second);await second.page.getByRole('button',{name:`Join lobby ${lobbyId}`,exact:true}).click();await second.page.waitForSelector('.online-current:not([hidden])');
  await refresh(first);await first.page.locator('[data-online="ready"]').click();await first.page.waitForFunction(()=>document.querySelector('[data-online="ready"]')?.getAttribute('aria-pressed')==='true');
  await refresh(second);await second.page.locator('[data-online="ready"]').click();await second.page.waitForFunction(()=>document.querySelector('[data-online="ready"]')?.getAttribute('aria-pressed')==='true');
  await refresh(first);await first.page.getByRole('button',{name:'Start match',exact:true}).click({trial:true});
  const seats=await first.page.locator('.online-seats li').allTextContents();assert.equal(seats.length,4);assert.ok(seats.slice(0,2).every(text=>/Guest.*Team 1/.test(text)));assert.ok(seats.slice(2).every(text=>/AI.*Team 2.*AI ready/.test(text)));
  await first.page.screenshot({path:join(out,'cooperative-lobby.png')});record('Server lobby has two human teammates and two AI opponents',{lobbyId,seats});
  await first.page.getByRole('button',{name:'Start match',exact:true}).click();await battlefield(first,0);
  await refresh(second);await second.page.locator('.online-current [data-online="rejoin"]').click();await battlefield(second,1);
  evidence.matchId=first.hellos.at(-1).matchId;assert.equal(second.hellos.at(-1).matchId,evidence.matchId);
  record('Both playable clients join the same authoritative cooperative match',{matchId:evidence.matchId,teams:[0,0,1,1]});
  phase='checking initial shared vision and human commands';
  const common=sharedFrame(first,second);record('Each human sees teammate vision beyond its own observers',checkSharedVision(common));
  await writeFile(join(out,'shared-vision-frames.json'),JSON.stringify(common,null,2));
  record('Both browser renderers apply their authoritative allied vision',{players:[await appliedVision(first),await appliedVision(second)]});
  record('First human HUD recruitment is accepted',await hudRecruit(first,0));record('Second human HUD recruitment is accepted',await hudRecruit(second,1));
  phase='scouting through normal attack-move controls';
  const scouts=[];
  for(const [profile,side] of [[first,0],[second,1]]) {
    const target=await profile.page.evaluate(()=>{const state=window.rts.state,hq=state.entities.find(entity=>entity.side===window.rts.viewSide&&entity.role==='hq');return {x:hq.x,y:state.height*.7};});
    const scout=await attackMove(profile,side,target);scouts.push({profile,scout});record(`${profile.name} scouts unexplored terrain with an accepted attack-move`,scout);
  }
  phase='waiting for real enemy AI combat';
  const attacks=await waitForBothAiAttacks();
  const unique=new Map(attacks.map(event=>[event.eventId??JSON.stringify(event),event])),combat=[...unique.values()];
  for(const side of [2,3])assert.ok(combat.some(event=>event.side===side&&[0,1].includes(event.targetSide)&&event.amount>0));
  record('Both enemy AI players attack human-team units in authoritative observations',{sides:[2,3],eventCount:combat.length,examples:[2,3].map(side=>combat.find(event=>event.side===side))});
  await writeFile(join(out,'observed-ai-combat.json'),JSON.stringify(combat,null,2));
  const exploration=scouts.map(({profile,scout})=>{const frame=profile.snapshots.find(frame=>frame.tick>=scout.appliedTick&&frame.view.explored.includes(scout.targetCell));assert.ok(frame,'The accepted scout target must later become explored');return {side:scout.side,targetCell:scout.targetCell,appliedTick:scout.appliedTick,exploredAtTick:frame.tick};});record('Both accepted attack-move targets later become explored',exploration);
  record('Both AI opponents advance construction without human control',observedAiConstruction());
  const latestAttackTick=Math.max(...[2,3].map(side=>combat.find(event=>event.side===side).frameTick));
  let combatPair;
  for(let attempt=0;attempt<40&&!combatPair;attempt++){try{combatPair=sharedFrame(first,second,latestAttackTick);}catch{await sleep(50);}}
  assert.ok(combatPair,'Combat vision comparison must follow both enemy attacks');assert.deepEqual(combatPair[0].view.visible,combatPair[1].view.visible);record('Allied shared vision remains equal during combat',{tick:combatPair[0].tick,afterAttackFrameTick:latestAttackTick,visibleTiles:combatPair[0].view.visible.length});
  for(const profile of profiles) {
    const view=profile.snapshots.at(-1).view;
    assert.ok(view.entities.some(entity=>[2,3].includes(entity.side)));
    assert.ok(view.entities.filter(entity=>[2,3].includes(entity.side)).every(entity=>entity.order===undefined&&entity.queue===undefined&&entity.research===undefined));
    await profile.page.screenshot({path:join(out,`${profile.name}-combat.png`)});
    await writeFile(join(out,`${profile.name}-commands.json`),JSON.stringify({hellos:profile.hellos,sent:profile.sent,receipts:profile.receipts,latestFrame:profile.snapshots.at(-1)},null,2));
    await writeFile(join(out,`${profile.name}-authoritative-frames.json`),JSON.stringify(profile.snapshots,null,2));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(captureErrors,[]);record('Neither browser reports page errors or WebSocket capture errors');
  evidence.limits.push('This proves human co-op, shared team vision, and autonomous combat from both AI opponents. It does not prove synchronized AI waves or a shared target planner; the current AI makes per-player decisions.');
  evidence.completed=true;evidence.completedAt=new Date().toISOString();await writeFile(join(out,'results.json'),JSON.stringify(evidence,null,2));console.log(`Verified ${evidence.checks.length} cooperative online behaviors. Evidence: ${out}`);
}catch(error) {
  evidence.completed=false;evidence.failure={phase,message:error instanceof Error?error.message:String(error)};evidence.pageErrors=errors;evidence.captureErrors=captureErrors;
  for(const profile of profiles)try{await profile.page.screenshot({path:join(out,`${profile.name}-failure.png`)});}catch{}
  await writeFile(join(out,'results.json'),JSON.stringify(evidence,null,2));throw error;
}finally {for(const profile of profiles)await profile.context.close();await browser.close();}
