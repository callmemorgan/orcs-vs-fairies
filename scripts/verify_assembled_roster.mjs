import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');
const base=process.argv[2]??'http://127.0.0.1:8788';
const legacyPath=resolve(process.argv[3]??'work/hundred-features/legacy-browser-save-v1.json');
const out=resolve(process.env.OVF_ROSTER_PROOF_DIR??'work/hundred-features/assembled-roster-proof');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const contexts=[],pages=[],errors=[],evidence={base,startedAt:new Date().toISOString(),buildLabel:process.env.OVF_ONLINE_BUILD_LABEL??null,pageBuilds:[],checks:[]};
let phase='opening production app';
const record=(name,details=true)=>{evidence.checks.push({name,details});console.log(`${name}: ${JSON.stringify(details)}`);};
const toolHost='.session-tools:not(.planning-tools)';
async function pageFor(name){
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});contexts.push(context);
  const page=await context.newPage();pages.push({name,page});page.on('pageerror',error=>errors.push({profile:name,message:error.message}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await captureBuild(page,name);return page;
}
async function captureBuild(page,profile){evidence.pageBuilds.push({profile,capturedAt:new Date().toISOString(),...await page.evaluate(()=>({url:location.href,moduleScripts:Array.from(document.querySelectorAll('script[type="module"][src]'),node=>node.src),stylesheets:Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'),node=>node.href)}))});}
async function openTool(page,name){await page.locator(`[data-session-tool="${name}"]`).click();await page.waitForSelector(`${toolHost} .session-overlay:not([hidden])`);}
async function closeTool(page){await page.getByRole('button',{name:'Close session tools',exact:true}).click();await page.waitForSelector(`${toolHost} .session-overlay[hidden]`,{state:'attached'});}
async function waitMode(page,mode){await page.waitForFunction(mode=>{try{return window.rts?.mode===mode;}catch{return false;}},mode,{timeout:60000});await page.waitForSelector('.loading-battle[hidden]',{state:'attached',timeout:60000});}
async function readState(page){return page.evaluate(()=>{const r=window.rts,s=r.state;return {mode:r.mode,paused:r.paused,readOnly:r.readOnly,simulationEnabled:r.simulationEnabled,tick:s.tick,time:s.time,seed:s.seed,players:s.players,controllers:s.controllers,teams:s.teams,aiConfigs:s.aiConfigs,incomeFactors:s.incomeFactors,populationLimits:s.populationLimits,sharedVision:s.sharedVision,entities:s.entities,resources:s.resources,visible:s.visible.map(v=>[...v]),explored:s.explored.map(v=>[...v]),width:s.width,height:s.height,camera:r.camera};});}
async function exportData(page,button,filename){const promise=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();const path=join(out,filename);await (await promise).saveAs(path);return {path,data:JSON.parse(await readFile(path,'utf8'))};}
async function importReplay(page,path){
  await openTool(page,'replay');await page.getByLabel('Import replay JSON',{exact:true}).setInputFiles(path);await page.getByRole('button',{name:'Import replay',exact:true}).click();
  await waitMode(page,'replay');await closeTool(page);const state=await readState(page);assert.equal(state.paused,true);assert.equal(state.readOnly,true);assert.equal(state.simulationEnabled,false);return state;
}
async function provePreset(preset,count){
  phase=`starting real ${preset}`;const page=await pageFor(preset);
  await page.locator('[data-faction="tideborn"]').click();await page.locator('#opponent').selectOption('automata');await page.locator('#map-size').selectOption('large');
  await page.getByLabel('Enable team match setup',{exact:true}).check();await page.getByLabel('Match preset',{exact:true}).selectOption(preset);
  assert.equal(await page.getByLabel('Player count',{exact:true}).inputValue(),String(count));
  const factions=['tideborn','automata','dwarves','undead','orcs','fairies','tideborn','automata'].slice(0,count);
  for(let side=1;side<count;side++)await page.getByLabel(`Player ${side+1} faction`,{exact:true}).selectOption(factions[side]);
  const teams=Array.from({length:count},(_,side)=>side<count/2?0:1),controllers=Array.from({length:count},(_,side)=>side===0?'human':'ai');
  const sharedVision=preset!=='3v3';await page.getByLabel('Shared team vision',{exact:true}).setChecked(sharedVision);
  const incomeFactors=Array(count).fill(1),populationLimits=Array(count).fill(100),banks=Array.from({length:count},()=>({wood:420,ore:220,crystal:0}));
  if(preset==='4v4'){
    await page.getByLabel('Starting age',{exact:true}).selectOption('3');
    for(let side=0;side<count;side++){
      const row=page.locator(`[data-roster-player="${side}"]`);await row.locator('.skirmish-roster-handicap > summary').click();
      banks[side]={wood:820+side*100,ore:320+side*20,crystal:200+side*10};incomeFactors[side]=side===0?1.5:side===7?.75:1;populationLimits[side]=24+side*8;
      for(const key of ['wood','ore','crystal'])await page.getByLabel(`Player ${side+1} starting ${key}`,{exact:true}).fill(String(banks[side][key]));
      await page.getByLabel(`Player ${side+1} income factor`,{exact:true}).fill(String(incomeFactors[side]));await page.getByLabel(`Player ${side+1} population cap`,{exact:true}).fill(String(populationLimits[side]));
      assert.match(await row.locator('.skirmish-roster-handicap-summary').textContent(),new RegExp(`Income ×${incomeFactors[side]}`));
    }
    await page.getByLabel('Player 2 difficulty',{exact:true}).selectOption('hard');await page.getByLabel('Player 2 personality',{exact:true}).selectOption('raid');await page.getByLabel('Player 2 opening',{exact:true}).selectOption('cavalry-raids');
  }
  await page.locator('.skirmish-roster').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,`${preset}-setup.png`)});
  await page.locator('.begin-match').click();await waitMode(page,'local');await page.waitForFunction(()=>window.rts.state.tick>=8,{},{timeout:60000});
  await openTool(page,'replay');const rendered=await readState(page);assert.equal(rendered.simulationEnabled,true);assert.equal(rendered.players.length,count);
  assert.deepEqual(rendered.players.map(p=>p.faction),factions);assert.deepEqual(rendered.controllers,controllers);assert.deepEqual(rendered.teams,teams);
  assert.deepEqual(rendered.incomeFactors,incomeFactors);assert.deepEqual(rendered.populationLimits,populationLimits);assert.equal(rendered.sharedVision,sharedVision);
  const {path,data:archive}=await exportData(page,'Export replay',`${preset}-replay.json`);const initial=archive.initial.state;
  assert.deepEqual(initial.players.map(({wood,ore,crystal})=>({wood,ore,crystal})),banks);assert.deepEqual(initial.teams,teams);assert.deepEqual(initial.incomeFactors,incomeFactors);assert.deepEqual(initial.populationLimits,populationLimits);
  if(preset==='4v4')assert.deepEqual(rendered.aiConfigs[1],{difficulty:'hard',personality:'raid',opening:'cavalry-raids'});
  const alliedHqs=rendered.entities.filter(e=>e.role==='hq'&&teams[e.side]===teams[0]);
  if(sharedVision)for(const hq of alliedHqs)assert.ok(rendered.visible[0].includes(Math.floor(hq.y)*rendered.width+Math.floor(hq.x)),`Shared vision must include allied HQ ${hq.id}`);
  await closeTool(page);await page.screenshot({path:join(out,`${preset}-battle.png`)});
  record(`Normal ${preset} preset launches ${count} players with its chosen factions, controllers and teams`,{count,teams,factions,controllers,sharedVision,initialTick:initial.tick,finalTick:archive.finalTick});
  if(preset==='4v4')record('Visible handicap controls reach exact initial banks and live income/population limits',{banks,incomeFactors,populationLimits,ai:rendered.aiConfigs[1]});
  return {page,path};
}
async function pixels(page){return page.evaluate(()=>Array.from(document.querySelector('#minimap').getContext('2d').getImageData(0,0,216,216).data));}
const differences=(a,b)=>a.reduce((count,value,index)=>count+(value!==b[index]?1:0),0);
async function fieldShot(page,name){return page.screenshot({path:join(out,`${name}.png`),clip:{x:240,y:140,width:900,height:600}});}
async function imageDifference(page,left,right){return page.evaluate(async({left,right})=>{
  async function decode(encoded){const image=new Image();image.src=`data:image/png;base64,${encoded}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);return context.getImageData(0,0,image.width,image.height).data;}
  const a=await decode(left),b=await decode(right);if(a.length!==b.length)throw new Error('Screenshot dimensions changed');let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;return changed;
},{left:left.toString('base64'),right:right.toString('base64')});}
async function display(page,patch){
  await page.locator('#display-button').click();await page.waitForSelector('.display-settings-overlay:not([hidden])');
  if(patch.palette)await page.getByLabel('Color palette',{exact:true}).selectOption(patch.palette);
  if(patch.patterns!==undefined)await page.getByLabel('Player shapes and patterns',{exact:true}).setChecked(patch.patterns);
  if(patch.outlines!==undefined)await page.getByLabel('Outlines for your units, allies and enemies',{exact:true}).setChecked(patch.outlines);
  await page.getByRole('button',{name:'Close display settings',exact:true}).click();await page.waitForTimeout(180);
}
async function proveAppearance(page,replayPath){
  phase='changing real battlefield appearance';await importReplay(page,replayPath);const before=await readState(page);
  await display(page,{palette:'default',patterns:true,outlines:true});let oldMap=await pixels(page),oldField=await fieldShot(page,'appearance-default');
  await page.waitForTimeout(180);const stableField=await fieldShot(page,'appearance-default-control'),stableMap=await pixels(page);
  const control={battle:await imageDifference(page,oldField,stableField),minimap:differences(oldMap,stableMap)};
  evidence.appearanceControl=control;
  assert.equal(control.minimap,0,'Paused replay minimap must be stable before comparing settings');
  for(const [name,patch,minBattle,minMap] of [
    ['appearance-deuteranopia',{palette:'deuteranopia'},100,10],
    ['appearance-tritanopia',{palette:'tritanopia'},100,10],
    ['appearance-no-patterns',{patterns:false},20,10],
    ['appearance-no-outlines',{outlines:false},100,10],
  ]){
    await display(page,patch);const nextMap=await pixels(page),nextField=await fieldShot(page,name),changed={battle:await imageDifference(page,oldField,nextField),minimap:differences(oldMap,nextMap)};
    assert.ok(changed.battle>Math.max(minBattle,control.battle),`${name} must alter battlefield pixels beyond the paused control`);assert.ok(changed.minimap>minMap,`${name} must alter minimap pixels`);
    assert.equal((await readState(page)).tick,before.tick);assert.deepEqual((await readState(page)).camera,before.camera);record(`${name} changes real battlefield and minimap pixels while replay time and camera stay fixed`,changed);oldMap=nextMap;oldField=nextField;
  }
  const desired={version:1,palette:'tritanopia',patterns:false,outlines:false};assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ovf.appearance.v1'))),desired);
  await page.reload({waitUntil:'domcontentloaded'});await captureBuild(page,'appearance-reload');await page.locator('#map-size').selectOption('small');await page.locator('.begin-match').click();await waitMode(page,'local');
  await page.locator('#display-button').click();await page.waitForSelector('.display-settings-overlay:not([hidden])');
  assert.equal(await page.getByLabel('Color palette',{exact:true}).inputValue(),desired.palette);assert.equal(await page.getByLabel('Player shapes and patterns',{exact:true}).isChecked(),false);assert.equal(await page.getByLabel('Outlines for your units, allies and enemies',{exact:true}).isChecked(),false);
  await page.screenshot({path:join(out,'appearance-restored.png')});await page.getByRole('button',{name:'Close display settings',exact:true}).click();
  record('Palette, patterns and outlines persist through a real page reload and new match',desired);
  await importReplay(page,replayPath);
}
async function proveLegacy(page){
  phase='importing historical session through production UI';const source=await readFile(legacyPath),historical=JSON.parse(source.toString('utf8')),sourceSha256=createHash('sha256').update(source).digest('hex');assert.equal(historical.game.version,1);
  const capturedSource=join(out,'historical-source-session-v1.json');await writeFile(capturedSource,source);
  assert.equal((await readState(page)).mode,'replay');assert.equal((await readState(page)).paused,true);
  await openTool(page,'saves');await page.getByLabel('Import save JSON',{exact:true}).setInputFiles(capturedSource);await page.getByRole('button',{name:'Import save',exact:true}).click();
  await waitMode(page,'local');await page.waitForFunction(tick=>window.rts.state.tick===tick,historical.game.state.tick,{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.session-tools:not(.planning-tools) .session-notice')?.textContent==='Save loaded.');
  const {data:migrated}=await exportData(page,'Export save','migrated-historical-save.json');
  assert.equal(migrated.game.version,4);
  for(const [key,value] of Object.entries(historical.game.state))if(key!=='entities')assert.deepEqual(migrated.game.state[key],value,`Historical state.${key} must be preserved`);
  assert.deepEqual(migrated.game.state.entities.map(entity=>entity.id),historical.game.state.entities.map(entity=>entity.id),'Historical entity count, IDs and ordering must be preserved');
  for(const [index,entity] of historical.game.state.entities.entries()) {
    const current=migrated.game.state.entities[index];
    assert.deepEqual(Object.keys(current).sort(),[...Object.keys(entity),...(entity.kind==='unit'?['tactics']:[])].sort(),`Historical entity ${entity.id} may gain only required SAVE4 tactics`);
    for(const [key,value] of Object.entries(entity))assert.deepEqual(current[key],value,`Historical entity ${entity.id}.${key} must be preserved`);
    if(entity.kind==='unit')assert.deepEqual(current.tactics,{morale:100,recentLoss:0},`Historical unit ${entity.id} must receive SAVE4 tactics defaults`);
  }
  for(const [key,value] of Object.entries(historical.game.runtime))assert.deepEqual(migrated.game.runtime[key],value,`Historical runtime.${key} must be preserved`);
  assert.deepEqual(migrated.game.state.teams,[0,1]);assert.deepEqual(migrated.game.state.incomeFactors,[1,1]);assert.deepEqual(migrated.game.state.populationLimits,[100,100]);assert.equal(migrated.game.state.sharedVision,true);
  assert.equal(migrated.replay.initial.state.tick,historical.game.state.tick);assert.equal(migrated.replay.finalTick,historical.game.state.tick);
  assert.match(await page.locator('.war-hud .notice').textContent(),/older simulation rules/);
  record('Unchanged historical version 1 session imports as version 4 with original state/runtime fields, team defaults and unit tactics defaults',{source:legacyPath,capturedSource,sourceSha256,sourceVersion:historical.game.version,migratedVersion:migrated.game.version,tick:migrated.game.state.tick,teams:migrated.game.state.teams,replayInitialTick:migrated.replay.initial.state.tick,tacticsDefaults:migrated.game.state.entities.filter(entity=>entity.kind==='unit').map(entity=>({id:entity.id,tactics:entity.tactics}))});
  await closeTool(page);await page.waitForFunction(()=>window.rts.paused===false);await page.waitForFunction(tick=>window.rts.state.tick>tick+4,historical.game.state.tick);
  assert.equal(await page.locator('.game-overlay').isVisible(),false);record('Historical save replacing a paused replay resumes its new local simulation');
  await openTool(page,'production');const row=page.locator('[data-production-building]').first();const id=Number(await row.getAttribute('data-production-building'));
  await row.getByRole('button',{name:'Select building',exact:true}).click();await page.waitForSelector(`${toolHost} .session-overlay[hidden]`,{state:'attached'});
  await page.waitForFunction(id=>window.rts.selected.includes(id),id);const action=page.locator('#action-buttons .action-button').first();assert.equal(await action.getAttribute('aria-disabled'),'false');
  const beforeWorkers=await page.evaluate(id=>window.rts.state.entities.find(entity=>entity.id===id).queue.filter(role=>role==='worker').length,id);
  await action.click();await page.waitForFunction(({id,beforeWorkers})=>window.rts.state.entities.find(entity=>entity.id===id)?.queue.filter(role=>role==='worker').length>beforeWorkers,{id,beforeWorkers});record('Migrated historical match accepts normal HUD recruitment',{producerId:id,beforeWorkers,afterWorkers:await page.evaluate(id=>window.rts.state.entities.find(entity=>entity.id===id).queue.filter(role=>role==='worker').length,id)});
  await page.screenshot({path:join(out,'historical-match.png')});
}
try{
  await provePreset('2v2',4);await provePreset('3v3',6);const {page,path}=await provePreset('4v4',8);
  await proveAppearance(page,path);await proveLegacy(page);assert.deepEqual(errors,[]);record('No browser page errors');evidence.completed=true;evidence.completedAt=new Date().toISOString();
  await writeFile(join(out,'results.json'),JSON.stringify(evidence,null,2));console.log(`Verified ${evidence.checks.length} assembled roster/session/appearance behaviors. Evidence: ${out}`);
}catch(error){
  evidence.completed=false;evidence.failure={phase,message:error instanceof Error?error.message:String(error)};evidence.pageErrors=errors;
  for(const {name,page} of pages)try{await page.screenshot({path:join(out,`${name}-failure.png`)});}catch{}
  await writeFile(join(out,'results.json'),JSON.stringify(evidence,null,2));throw error;
}finally{for(const context of contexts)await context.close();await browser.close();}
