import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');
const base=process.argv[2]??'http://127.0.0.1:8788';
const out=resolve(process.env.OVF_ONLINE_MAIN_PROOF_DIR??'work/hundred-features/online-main-proof');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const profiles=[],errors=[],evidence={base,startedAt:new Date().toISOString(),buildLabel:process.env.OVF_ONLINE_BUILD_LABEL??null,pageBuilds:[],checks:[]};
let phase='opening normal application';
const record=(name,details=true)=>{evidence.checks.push({name,details});console.log(`${name}: ${JSON.stringify(details)}`);};
const byId=values=>[...values].sort((a,b)=>a.id-b.id);

async function profile(name,source='menu') {
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage(),profile={name,context,page,snapshots:[],sent:[],receipts:[],hellos:[],downloads:[]};profiles.push(profile);
  page.on('pageerror',error=>errors.push({profile:name,message:error.message}));
  page.on('download',download=>profile.downloads.push(download.suggestedFilename()));
  page.on('websocket',socket=>{
    socket.on('framesent',event=>{try{const message=JSON.parse(event.payload);if(message.kind==='command')profile.sent.push(message);}catch{}});
    socket.on('framereceived',event=>{try{const message=JSON.parse(event.payload);
      if(message.kind==='snapshot')profile.snapshots.push(message);
      else if(message.kind==='commandAck')profile.receipts.push(message);
      else if(message.kind==='hello')profile.hellos.push(message);
    }catch{}});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  evidence.pageBuilds.push({profile:name,capturedAt:new Date().toISOString(),...await page.evaluate(()=>({
    url:location.href,
    moduleScripts:Array.from(document.querySelectorAll('script[type="module"][src]'),node=>node.src),
    stylesheets:Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'),node=>node.href),
  }))});
  if(source!=='menu')await preparePausedSource(profile,source);
  await page.getByRole('button',{name:'Online',exact:true}).click();
  await page.getByRole('button',{name:'Play as guest',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.online-account')?.hidden&&document.querySelector('.online-username')?.textContent?.startsWith('Guest'),{},{timeout:15000});
  return profile;
}
async function preparePausedSource(profile,source) {
  const {page,name}=profile;
  phase=`preparing ${name} paused ${source}`;
  await page.locator('#map-size').selectOption('small');await page.locator('.begin-match').click();
  await page.waitForSelector('.loading-battle[hidden]',{state:'attached',timeout:60000});
  await page.waitForFunction(()=>window.rts?.mode==='local'&&window.rts.state.tick>=12,{},{timeout:60000});
  if(source==='local') {
    await page.locator('#pause-button').click();await page.waitForFunction(()=>window.rts.paused===true);
    assert.equal(await page.locator('.game-overlay').isVisible(),true);
  }else if(source==='replay') {
    await openTool(profile,'replay');
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export replay',exact:true}).click();
    const path=join(out,`${name}-paused-source-replay.json`);await (await downloadPromise).saveAs(path);
    await page.getByLabel('Import replay JSON',{exact:true}).setInputFiles(path);
    await page.getByRole('button',{name:'Import replay',exact:true}).click();
    await page.waitForFunction(()=>{try{return window.rts?.mode==='replay'&&window.rts.paused&&window.rts.readOnly;}catch{return false;}},{},{timeout:60000});
    await page.waitForSelector('.loading-battle[hidden]',{state:'attached',timeout:60000});
    await closeTool(profile);
  }else throw new Error(`Unknown paused source ${source}`);
  const before=await page.evaluate(()=>({mode:window.rts.mode,paused:window.rts.paused,tick:window.rts.state.tick}));
  assert.equal(before.mode,source);assert.equal(before.paused,true);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.rts.state.tick),before.tick);
  await page.screenshot({path:join(out,`${name}-paused-${source}.png`)});
  record(`${name} starts from a paused ${source} through normal controls`,before);
}
async function refresh(profile){await profile.page.getByRole('button',{name:'Refresh lobbies',exact:true}).click();}
async function waitBattlefield(profile,side) {
  await profile.page.waitForSelector('.online-overlay[hidden]',{state:'attached',timeout:60000});
  await profile.page.waitForSelector('.loading-battle[hidden]',{state:'attached',timeout:60000});
  await profile.page.waitForFunction(expected=>window.rts?.state.players.length===8&&window.rts.state.explored[expected].size>0,side,{timeout:60000});
  assert.equal(await profile.page.locator('#game-canvas canvas').isVisible(),true);
  assert.equal(await profile.page.locator('.online-overlay').isVisible(),false);
}
async function inspect(profile) {
  return profile.page.evaluate(()=>{
    const value=window.rts;if(!value)return null;
    return {mode:value.mode,simulationEnabled:value.simulationEnabled,readOnly:value.readOnly,viewSide:value.viewSide,privateSides:Array.from(value.online?.privateSides??[]),
      selected:value.selected,paused:value.paused,tick:value.state.tick,time:value.state.time,seed:value.state.seed,teams:value.state.teams,
      players:value.state.players,entities:value.state.entities,resources:value.state.resources,terrain:value.state.terrain,
      explored:value.state.explored.map(values=>[...values].sort((a,b)=>a-b)),visible:value.state.visible.map(values=>[...values].sort((a,b)=>a-b)),
      diagnosticHasSetter:typeof Object.getOwnPropertyDescriptor(window,'rts')?.set==='function'};
  });
}
async function matchingSnapshot(profile,render) {
  for(let attempt=0;attempt<20;attempt++) {
    const snapshot=profile.snapshots.findLast(message=>message.tick===render.tick);if(snapshot)return snapshot;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error(`${profile.name} renderer tick ${render.tick} never arrived in a server snapshot.`);
}
async function assertFilteredRenderer(profile,side,privateSides=[side]) {
  const render=await inspect(profile);assert.ok(render,`${profile.name} has a renderer`);
  const {view}=await matchingSnapshot(profile,render);
  assert.ok(String(render.mode).includes('online'),`${profile.name} reports online mode`);assert.equal(render.simulationEnabled,false,'The browser must not step the online simulation');
  assert.equal(render.diagnosticHasSetter,false);assert.deepEqual(render.privateSides.sort((a,b)=>a-b),privateSides);
  assert.equal(view.side,side);if(render.viewSide!==undefined)assert.equal(render.viewSide,side);
  assert.ok(Math.abs(render.time-view.time)<1e-7,'Renderer time must equal the authoritative frame time');
  assert.equal(render.seed,0);assert.equal(view.map.seed,undefined);assert.deepEqual(render.teams,[0,1,0,1,0,1,0,1]);
  const disclosedPlayers=new Map([[side,view.player],...(view.teamPlayers??[]).map(member=>[member.side,member.player])]);
  for(let player=0;player<8;player++) {
    if(privateSides.includes(player))assert.deepEqual(render.players[player],disclosedPlayers.get(player),`Private player ${player} must match its authorized server view`);
    else assert.deepEqual(render.players[player],{faction:render.players[player].faction,wood:0,ore:0,crystal:0,population:0,cap:0,upgrades:[]},`Player ${player} economy must remain unavailable`);
    assert.deepEqual(render.explored[player],player===side?[...view.explored].sort((a,b)=>a-b):[]);
    assert.deepEqual(render.visible[player],player===side?[...view.visible].sort((a,b)=>a-b):[]);
  }
  assert.deepEqual(render.entities.map(entity=>entity.id).sort((a,b)=>a-b),view.entities.map(entity=>entity.id).sort((a,b)=>a-b));
  for(const displayed of render.entities) {
    const source=view.entities.find(entity=>entity.id===displayed.id);assert.equal(displayed.hp,source.hp);assert.equal(displayed.maxHp,source.maxHp);
    if(privateSides.includes(displayed.side)&&source.order) {
      assert.deepEqual(displayed.order,source.order);assert.deepEqual(displayed.queue,source.queue);assert.deepEqual(displayed.orderQueue,source.orderQueue);
    }else {
      assert.deepEqual(displayed.order,{type:'idle'});assert.deepEqual(displayed.queue,[]);assert.equal(displayed.orderQueue,undefined);
      assert.equal(displayed.research,undefined);assert.equal(displayed.carried,0);assert.equal(displayed.lastDamagedAt,undefined);
    }
    if(render.teams[displayed.side]!==render.teams[side]) {
      assert.equal(source.illusion,undefined);assert.equal(source.order,undefined);assert.equal(source.queue,undefined);assert.equal(source.research,undefined);assert.equal(source.carried,undefined);assert.equal(displayed.illusion,false);
    }
  }
  assert.deepEqual(byId(render.resources),byId(view.resources.map(({id,kind,x,y,amount,maxAmount})=>({id,kind,x,y,amount,maxAmount}))));
  for(let tile=0;tile<render.terrain.length;tile++)assert.equal(render.terrain[tile],view.map.terrain[tile]??'grass');
  return {tick:render.tick,entities:render.entities.length,disclosedResources:render.resources.length,unknownTerrain:view.map.terrain.filter(tile=>tile===null).length,
    visibleHostiles:render.entities.filter(entity=>render.teams[entity.side]!==render.teams[side]).length};
}
async function openTool(profile,name){await profile.page.locator(`[data-session-tool="${name}"]`).click();await profile.page.waitForSelector('.session-tools:not(.planning-tools) .session-overlay:not([hidden])');}
async function closeTool(profile){await profile.page.getByRole('button',{name:'Close session tools',exact:true}).click();await profile.page.waitForSelector('.session-tools:not(.planning-tools) .session-overlay[hidden]',{state:'attached'});}
async function tickAdvance(profile,by=8){const before=await profile.page.evaluate(()=>window.rts.state.tick);await profile.page.waitForFunction(({before,by})=>window.rts.state.tick>=before+by,{before,by},{timeout:15000});return {before,after:await profile.page.evaluate(()=>window.rts.state.tick)};}
async function waitReceipt(profile,count){
  for(let attempt=0;attempt<150;attempt++){if(profile.receipts.length>count)return profile.receipts.at(-1);await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error(`${profile.name} never received a server command receipt.`);
}
async function scoutWithNormalControls(first,second) {
  await first.page.keyboard.press('F2');await first.page.waitForFunction(()=>window.rts.selected.length>0);
  const render=await inspect(first),army=render.entities.filter(entity=>render.selected.includes(entity.id));
  assert.ok(army.every(entity=>entity.side===0&&entity.kind==='unit'&&entity.role!=='worker'));
  const center={x:army.reduce((sum,entity)=>sum+entity.x,0)/army.length,y:army.reduce((sum,entity)=>sum+entity.y,0)/army.length};
  const targets=second.snapshots.at(-1).view.entities.filter(entity=>entity.kind==='building'&&entity.role==='hq');
  const target=targets.sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y))[0];assert.ok(target);
  const minimap=await first.page.locator('#minimap').boundingBox();const dimensions=await first.page.evaluate(()=>({width:window.rts.state.width,height:window.rts.state.height}));
  await first.page.mouse.click(minimap.x+target.x/dimensions.width*minimap.width,minimap.y+target.y/dimensions.height*minimap.height);
  await first.page.keyboard.press('a');
  const canvas=await first.page.locator('#game-canvas canvas').boundingBox(),camera=await first.page.evaluate(()=>window.rts.camera);
  const projected={x:1600+(target.x-target.y)*32,y:80+(target.x+target.y)*16};
  const point={x:canvas.x+(projected.x-camera.x)*camera.zoom*canvas.width/camera.width,y:canvas.y+(projected.y-camera.y)*camera.zoom*canvas.height/camera.height};
  const count=first.receipts.length;await first.page.mouse.click(point.x,point.y);const receipt=await waitReceipt(first,count);assert.equal(receipt.accepted,true);
  assert.equal(first.sent.at(-1).command.type,'attackMove');return {army:army.map(entity=>entity.id),targetSide:target.side,appliedTick:receipt.appliedTick};
}
async function gatedAction(profile,button) {
  const target=profile.page.getByRole('button',{name:button,exact:true});
  if(await target.isDisabled())return 'disabled';
  await target.click();await profile.page.waitForFunction(label=>{
    const notice=document.querySelector('.session-tools:not(.planning-tools) .session-notice'),control=Array.from(document.querySelectorAll('.session-tools:not(.planning-tools) .session-dialog button')).find(node=>node.textContent?.trim()===label);
    return notice&&!notice.hidden&&notice.classList.contains('session-error')&&/online|server/i.test(notice.textContent??'')&&control?.dataset.busy!=='true';
  },button,{timeout:10000});
  return (await profile.page.locator('.session-tools:not(.planning-tools) .session-notice').textContent()).trim();
}

try {
  const first=await profile('player-one','local'),second=await profile('player-two','replay');
  const firstName=await first.page.locator('.online-username').textContent(),secondName=await second.page.locator('.online-username').textContent();assert.notEqual(firstName,secondName);
  record('Separate browser profiles receive separate server guest accounts');
  phase='creating eight-slot lobby';
  await first.page.getByLabel('Lobby player count',{exact:true}).selectOption('8');await first.page.getByLabel('Lobby map size',{exact:true}).selectOption('huge');
  for(let player=3;player<=8;player++){await first.page.getByLabel(`Lobby player ${player} team`,{exact:true}).selectOption(String((player-1)%2));await first.page.getByLabel(`Lobby player ${player} controller`,{exact:true}).selectOption('ai');}
  await first.page.getByRole('button',{name:'Create lobby',exact:true}).click();await first.page.waitForSelector('.online-current:not([hidden])');
  const lobbyId=(await first.page.locator('.online-lobby-id').textContent()).trim();
  await refresh(second);await second.page.getByRole('button',{name:`Join lobby ${lobbyId}`,exact:true}).click();await second.page.waitForSelector('.online-current:not([hidden])');
  await refresh(first);await first.page.locator('[data-online="ready"]').click();await first.page.waitForFunction(()=>document.querySelector('[data-online="ready"]')?.getAttribute('aria-pressed')==='true');
  await refresh(second);await second.page.locator('[data-online="ready"]').click();await second.page.waitForFunction(()=>document.querySelector('[data-online="ready"]')?.getAttribute('aria-pressed')==='true');
  await refresh(first);await first.page.getByRole('button',{name:'Start match',exact:true}).click({trial:true});await first.page.screenshot({path:join(out,'eight-player-lobby.png')});
  await first.page.getByRole('button',{name:'Start match',exact:true}).click();await waitBattlefield(first,0);
  await refresh(second);await second.page.locator('.online-current [data-online="rejoin"]').click();await waitBattlefield(second,1);
  const matchId=first.hellos.at(-1).matchId;assert.equal(second.hellos.at(-1).matchId,matchId);evidence.matchId=matchId;evidence.lobbyId=lobbyId;
  record('Normal lobby starts eight-slot server match and both Phaser clients join',{matchId,teams:[0,1,0,1,0,1,0,1]});
  for(const [profile,source] of [[first,'local'],[second,'replay']]) {
    assert.equal((await inspect(profile)).paused,false);assert.equal(await profile.page.locator('.game-overlay').isVisible(),false);
    record(`${profile.name} joins online from paused ${source} with input unpaused`);
  }
  record('Player one renderer contains only authorized observations',await assertFilteredRenderer(first,0));record('Player two renderer contains only authorized observations',await assertFilteredRenderer(second,1));
  assert.equal(await first.page.locator('#pause-button').isDisabled(),true);assert.equal(await second.page.locator('#pause-button').isDisabled(),true);
  record('Online pause controls are disabled');
  phase='recruiting through global production and HUD';
  await openTool(first,'production');const production=first.page.locator('[data-production-building]').first();const producerId=Number(await production.getAttribute('data-production-building'));
  const beforeReceipt=first.receipts.length;await production.locator('[data-recruit="worker"]').click();const globalReceipt=await waitReceipt(first,beforeReceipt);assert.equal(globalReceipt.accepted,true);
  await first.page.waitForFunction(id=>window.rts.state.entities.find(entity=>entity.id===id)?.queue.includes('worker'),producerId);
  record('Session global production receives an accepted server receipt',{clientSeq:globalReceipt.clientSeq,appliedTick:globalReceipt.appliedTick,producerId});
  await first.page.locator(`[data-production-building="${producerId}"]`).getByRole('button',{name:'Select building',exact:true}).click();await first.page.waitForSelector('.session-tools:not(.planning-tools) .session-overlay[hidden]',{state:'attached'});
  await first.page.waitForFunction(id=>window.rts.selected.includes(id),producerId);const hudRecruit=first.page.locator('#action-buttons .action-button').first();assert.equal(await hudRecruit.getAttribute('aria-disabled'),'false');
  const beforeHud=first.receipts.length;await hudRecruit.click();const hudReceipt=await waitReceipt(first,beforeHud);assert.equal(hudReceipt.accepted,true);
  await first.page.waitForFunction(id=>window.rts.state.entities.find(entity=>entity.id===id)?.queue.length>=2,producerId);
  record('HUD recruitment uses an authoritative receipt and observed queue',{clientSeq:hudReceipt.clientSeq,appliedTick:hudReceipt.appliedTick});
  await openTool(second,'production');const secondProducer=second.page.locator('[data-production-building]').first();
  const secondProducerId=Number(await secondProducer.getAttribute('data-production-building'));
  await secondProducer.getByRole('button',{name:'Select building',exact:true}).click();
  await second.page.waitForSelector('.session-tools:not(.planning-tools) .session-overlay[hidden]',{state:'attached'});
  await second.page.waitForFunction(id=>window.rts.selected.includes(id),secondProducerId);
  const secondHud=second.page.locator('#action-buttons .action-button').first();assert.equal(await secondHud.getAttribute('aria-disabled'),'false');
  const beforeSecond=second.receipts.length;await secondHud.click();const secondReceipt=await waitReceipt(second,beforeSecond);assert.equal(secondReceipt.accepted,true);
  await second.page.waitForFunction(id=>window.rts.state.entities.find(entity=>entity.id===id)?.queue.includes('worker'),secondProducerId);
  record('Player two accepts normal HUD recruitment after paused replay transition',{clientSeq:secondReceipt.clientSeq,appliedTick:secondReceipt.appliedTick,producerId:secondProducerId});
  const badTickSamples=[];
  for(let sample=0;sample<25;sample++) {
    const value=await first.page.evaluate(()=>({tick:window.rts.state.tick,time:window.rts.state.time}));const frame=await matchingSnapshot(first,value);
    if(Math.abs(value.time-frame.view.time)>1e-7)badTickSamples.push(value);
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert.deepEqual(badTickSamples,[]);record('Every sampled browser tick and time came from a server frame',{samples:25});
  record('Normal selection and attack-move send scouts toward another player base',await scoutWithNormalControls(first,second));
  phase='verifying modal clock and local file policy';
  await openTool(first,'controls');const beforeModalOrders=first.sent.length;await first.page.keyboard.press('z');
  const modalTicks=await tickAdvance(first);assert.equal(first.sent.length,beforeModalOrders);assert.equal(await first.page.evaluate(()=>window.rts.paused),true);
  record('Modal blocks battlefield shortcuts while server snapshots advance',modalTicks);
  await first.page.locator('[data-session-tab="saves"]').click();await first.page.getByLabel('Save name',{exact:true}).fill('Forbidden local online save');
  const downloadCount=first.downloads.length;const savePolicy=await gatedAction(first,'Save match');const exportPolicy=await gatedAction(first,'Export save');
  assert.equal(await first.page.locator('.session-save-list').textContent().then(value=>value.includes('Forbidden local online save')),false);assert.equal(first.downloads.length,downloadCount);
  record('Local saves and save exports are gated',{savePolicy,exportPolicy});
  const invalidMatchId=first.hellos.at(-1).matchId,previousNotice=await first.page.locator('.session-tools:not(.planning-tools) .session-notice').textContent();await first.page.getByLabel('Import save JSON',{exact:true}).setInputFiles({name:'invalid-online-import.json',mimeType:'application/json',buffer:Buffer.from('{"format":"invalid"}')});
  await first.page.getByRole('button',{name:'Import save',exact:true}).click();await first.page.waitForFunction(previous=>{const notice=document.querySelector('.session-tools:not(.planning-tools) .session-notice.session-error');return notice&&!notice.hidden&&notice.textContent!==previous;},previousNotice);
  await tickAdvance(first);assert.equal(first.hellos.at(-1).matchId,invalidMatchId);record('Failed local import keeps the online renderer');
  await first.page.locator('[data-session-tab="replay"]').click();const replayPolicy=await gatedAction(first,'Export replay');assert.equal(first.downloads.length,downloadCount);record('Online local replay export is gated',replayPolicy);
  await first.page.locator('[data-session-tab="report"]').click();await first.page.getByLabel('Bug description',{exact:true}).fill('Online verification report must not export hidden server state.');
  const reportPolicy=await gatedAction(first,'Preview report');assert.equal(await first.page.locator('[aria-label="Bug report preview"]').isVisible(),false);assert.equal(first.downloads.length,downloadCount);record('Online replay-backed bug report is gated',reportPolicy);
  await closeTool(first);
  phase='verifying live photo mode';
  await first.page.locator('[data-session-tool="photo"]').click();await first.page.waitForSelector('.photo-controls:not([hidden])');assert.equal(await first.page.locator('.war-hud').isVisible(),false);
  const beforePhotoOrders=first.sent.length;await first.page.keyboard.press('z');const photoTicks=await tickAdvance(first);assert.equal(first.sent.length,beforePhotoOrders);
  const photoDownload=first.page.waitForEvent('download');await first.page.getByRole('button',{name:'Download photo',exact:true}).click();await (await photoDownload).saveAs(join(out,'online-photo.png'));
  const png=await readFile(join(out,'online-photo.png'));assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.ok(png.length>1000);
  record('Photo mode blocks orders, keeps the server clock running and downloads canvas',photoTicks);
  await first.page.getByRole('button',{name:'Exit photo mode',exact:true}).click();await first.page.waitForSelector('.photo-controls[hidden]',{state:'attached'});assert.equal(await first.page.locator('.war-hud').isVisible(),true);
  phase='rejoining through normal lobby';
  const previousGeneration=second.hellos.at(-1).generation;await second.page.getByRole('button',{name:'Online',exact:true}).click();await second.page.locator('.online-current [data-online="rejoin"]').click();await waitBattlefield(second,1);
  assert.ok(second.hellos.at(-1).generation>previousGeneration);record('Lobby rejoin receives a fresh generation and filtered resource memory',await assertFilteredRenderer(second,1));
  phase='joining delayed team spectator';
  const spectator=await profile('team-spectator');await spectator.page.getByLabel('Spectator match ID',{exact:true}).fill(matchId);await spectator.page.getByLabel('Spectator perspective',{exact:true}).selectOption('1');await spectator.page.getByLabel('Spectator view',{exact:true}).selectOption('team');
  await spectator.page.getByRole('button',{name:'Spectate match',exact:true}).click();await waitBattlefield(spectator,1);
  const hello=spectator.hellos.at(-1);assert.equal(hello.role,'spectator');assert.ok(hello.delayTicks>0);assert.equal(spectator.snapshots.at(-1).view.teamPerspective,true);
  assert.deepEqual(spectator.snapshots.at(-1).view.teamPlayers.map(player=>player.side),[1,3,5,7]);
  const liveTick=await second.page.evaluate(()=>window.rts.state.tick),delayedTick=await spectator.page.evaluate(()=>window.rts.state.tick);assert.ok(liveTick-delayedTick>=hello.delayTicks-8,`Spectator expected ${hello.delayTicks}-tick delay, saw ${liveTick-delayedTick}`);
  record('Team spectator receives delayed authorized team observations',{...await assertFilteredRenderer(spectator,1,[1,3,5,7]),delayTicks:hello.delayTicks,liveTick,delayedTick});
  assert.equal((await inspect(spectator)).readOnly,true);
  await openTool(spectator,'production');const spectatorRecruit=spectator.page.locator('[data-recruit="worker"]').first();assert.equal(await spectatorRecruit.isDisabled(),true);
  await spectator.page.locator('[data-production-building]').first().getByRole('button',{name:'Select building',exact:true}).click();await spectator.page.waitForSelector('.session-tools:not(.planning-tools) .session-overlay[hidden]',{state:'attached'});
  const spectatorAction=spectator.page.locator('#action-buttons .action-button').first();assert.equal(await spectatorAction.getAttribute('aria-disabled'),'true');assert.match(await spectatorAction.getAttribute('data-tooltip'),/Viewing match/);
  const beforeSpectatorOrders=spectator.sent.length,actionBox=await spectatorAction.boundingBox();
  await spectator.page.mouse.click(actionBox.x+actionBox.width/2,actionBox.y+actionBox.height/2);await spectator.page.keyboard.press('z');await tickAdvance(spectator);assert.equal(spectator.sent.length,beforeSpectatorOrders);
  record('Spectator production and battlefield orders remain disabled');
  phase='checking visible hostile entity privacy';
  await first.page.waitForFunction(()=>window.rts.state.entities.some(entity=>window.rts.state.teams[entity.side]!==window.rts.state.teams[0]),{},{timeout:90000});
  const hostileProof=await assertFilteredRenderer(first,0);assert.ok(hostileProof.visibleHostiles>0);record('Visible hostile entities keep orders, queues, research and cargo private',hostileProof);
  for(const profile of profiles)await profile.page.screenshot({path:join(out,`${profile.name}.png`)});
  assert.deepEqual(errors,[]);record('No browser page errors');
  evidence.completed=true;evidence.completedAt=new Date().toISOString();await writeFile(join(out,'results.json'),JSON.stringify(evidence,null,2));console.log(`Verified ${evidence.checks.length} assembled online behaviors. Evidence: ${out}`);
}catch(error) {
  evidence.completed=false;evidence.failure={phase,message:error instanceof Error?error.message:String(error)};evidence.pageErrors=errors;
  for(const profile of profiles)try{await profile.page.screenshot({path:join(out,`${profile.name}-failure.png`)});}catch{}
  await writeFile(join(out,'results.json'),JSON.stringify(evidence,null,2));throw error;
}finally {for(const profile of profiles)await profile.context.close();await browser.close();}
