import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertSessionIdentity, comparePersisted, compareReplayExport, digest, freshArtifact } from './native-contract.mjs';

// All writes below are native DOM/pointer/keyboard input or browser downloads.
// page.evaluate is used only to observe state and compute canvas coordinates.
export function createNativeContext({page,out,fixtures,manifest,identity,evidence,observeNative}) {
  const sessions=page.getByRole('dialog',{name:'Session tools',exact:true});
  const tactics=page.getByLabel('Army tactics controls',{exact:true});
  const faction=page.getByLabel('Faction power controls',{exact:true});
  let importCount=0;
  const wait=(predicate,arg,timeout=15000)=>page.waitForFunction(predicate,arg,{timeout,polling:20});
  const snap=()=>page.evaluate(()=>{
    const r=window.rts;
    return JSON.parse(JSON.stringify({...r.state,selected:r.selected,mode:r.mode,viewLevel:r.viewLevel,viewSide:r.viewSide,paused:r.paused,art:r.art},(_key,value)=>value instanceof Set?[...value]:value instanceof Map?Object.fromEntries(value):value));
  });
  const ready=()=>wait(()=>document.querySelector('.loading-battle')?.hidden&&!!window.rts?.camera&&!!document.querySelector('#game-canvas canvas')&&window.rts.art.loaded,null,60000);
  const record=(name,observed={})=>{evidence.checks.push({name,...observed});console.log(`PASS ${name}`);};
  async function check(name,fn){const observed=await fn();record(name,observed??{});return observed;}
  async function closePanels(){
    for(const name of ['Close army tactics','Close faction powers']){const button=page.getByRole('button',{name,exact:true});if(await button.isVisible())await button.click();}
  }
  async function closeSessions(){if(await sessions.isVisible())await sessions.getByRole('button',{name:'Close session tools',exact:true}).click();}
  async function openSessions(tab){
    await closePanels();
    if(await sessions.isVisible())await page.locator(`[data-session-tab="${tab}"]`).click();
    else await page.locator(`[data-session-tool="${tab}"]`).click();
    await sessions.waitFor({state:'visible'});await wait(()=>window.rts.paused);
  }
  async function download(buttonName,filename){
    const path=resolve(out,filename);await freshArtifact(path);
    const pending=page.waitForEvent('download');await sessions.getByRole('button',{name:buttonName,exact:true}).click();
    await (await pending).saveAs(path);const bytes=await readFile(path);
    evidence.downloads[filename]={sha256:digest(bytes),bytes:bytes.length};return JSON.parse(bytes.toString());
  }
  async function exportSave(name){await openSessions('saves');const file=await download('Export save',`${name}-save.json`);assertSessionIdentity(file,name,identity,true);return file;}
  async function importSave(path,name){
    const file=JSON.parse(await readFile(path,'utf8'));assertSessionIdentity(file,name,identity);
    await openSessions('saves');await sessions.getByLabel('Import save JSON',{exact:true}).setInputFiles(path);
    await sessions.getByRole('button',{name:'Import save',exact:true}).click();
    await wait(()=>document.querySelector('[aria-label="Import save JSON"]')?.files?.length===0&&[...document.querySelectorAll('.session-notice')].some(e=>!e.hidden&&e.textContent==='Save loaded.'),null,60000);
    await ready();const state=await snap();assert.equal(state.tick,file.game.state.tick);assert.equal(state.mode,'local');
    const native=await exportSave(`native-import-${++importCount}`);comparePersisted(native.game,file.game,`${name} native import`);
    return {file,state,native};
  }
  async function loadScenario(name){
    const scenario=manifest.scenarios[name];assert(scenario,`Declared fixture ${name}`);
    const path=resolve(fixtures,scenario.file);await importSave(path,name);
    record(`Native import preserves ${name}`,{fixtureSha256:digest(await readFile(path)),authored:scenario.authored});
    await closeSessions();return scenario;
  }
  async function openWorld(){const world=page.locator('.world-tools');await world.waitFor({state:'visible'});if(await world.getAttribute('open')===null)await world.locator(':scope > summary').click();return world;}
  async function selectTroop(id){
    await closePanels();const world=await openWorld();const summary=world.getByText('Owned troops by level',{exact:true}),list=summary.locator('..');
    if(await list.getAttribute('open')===null)await summary.click();
    await list.getByRole('button',{name:new RegExp(`^[a-z]+ #${id} `)}).click();
    await wait(id=>window.rts.selected.length===1&&window.rts.selected[0]===id,id);
  }
  async function point(x,y,level){
    if(level!==undefined){const current=await snap();if(current.viewLevel!==level){const world=await openWorld();await world.getByLabel('Map level',{exact:true}).selectOption(String(level));await wait(level=>window.rts.viewLevel===level,level);}}
    return page.evaluate(({x,y})=>{const c=window.rts.camera,canvas=document.querySelector('#game-canvas canvas'),box=canvas.getBoundingClientRect(),scaleX=box.width/c.width,scaleY=box.height/c.height;return{x:box.left+((1600+(x-y)*32-c.x)*c.zoom+c.width/2*(1-c.zoom))*scaleX,y:box.top+((80+(x+y)*16-c.y)*c.zoom+c.height/2*(1-c.zoom))*scaleY,zoom:c.zoom,scaleX,scaleY,camera:{...c},canvas:{left:box.left,top:box.top,width:box.width,height:box.height}};},{x,y});
  }
  async function canvasInput(screen){const world=page.locator('.world-tools');if(await world.isVisible()&&await world.getAttribute('open')!==null)await world.locator(':scope > summary').click();assert(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)===document.querySelector('#game-canvas canvas'),screen),'Native pointer action must reach the battlefield canvas');}
  async function ground(p,button='left'){await closePanels();const before=await snap();assert(p.level===undefined||p.level===before.viewLevel||!before.selected.length,'Changing Map level would discard the acting selection');const screen=await point(p.x,p.y,p.level);await canvasInput(screen);await page.mouse.click(screen.x,screen.y,{button});}
  async function entityClick(id,button='left'){
    await closePanels();const state=await snap(),entity=state.entities.find(e=>e.id===id);assert(entity,`Entity ${id}`);
    const screen=await point(entity.x,entity.y,entity.level??0),hit={...screen,y:screen.y-30*screen.zoom*screen.scaleY};await canvasInput(hit);
    const key=(entity.level??0)*state.width*state.height+Math.floor(entity.y)*state.width+Math.floor(entity.x);
    (evidence.nativePointerInputs??=[]).push({kind:'entity',button,target:id,tick:state.tick,selected:state.selected,viewSide:state.viewSide,viewLevelBefore:state.viewLevel,targetWorld:{x:entity.x,y:entity.y,level:entity.level??0},targetFogKey:key,targetFogVisible:state.visible[state.viewSide].includes(key),screen:hit});
    await page.mouse.click(hit.x,hit.y,{button});
  }
  async function selectBuilding(id){await entityClick(id);await wait(id=>window.rts.selected.includes(id),id);}
  async function selectMany(ids){
    assert(ids.length);await selectTroop(ids[0]);
    await page.keyboard.down('Shift');try{for(const id of ids.slice(1))await entityClick(id);}finally{await page.keyboard.up('Shift');}
    await wait(ids=>window.rts.selected.length===ids.length&&ids.every(id=>window.rts.selected.includes(id)),ids);
  }
  async function openTactics(){await closePanels();await page.locator('[data-tactics-launch]').click();await tactics.waitFor({state:'visible'});return tactics;}
  async function openFaction(){await closePanels();await page.locator('[data-faction-launch]').click();await faction.waitFor({state:'visible'});return faction;}
  async function pause(){await closeSessions();if(!(await snap()).paused){await page.locator('#pause-button').click();await wait(()=>window.rts.paused);}}
  async function resume(){await closeSessions();if((await snap()).paused){const overlay=page.locator('#resume-button');if(await overlay.isVisible())await overlay.click();else await page.locator('#pause-button').click();await wait(()=>!window.rts.paused);}}
  async function runUntil(predicate,{timeout=15000,label='native condition'}={}){
    await resume();const deadline=Date.now()+timeout;let state;
    while(Date.now()<deadline){state=await snap();if(await predicate(state)){await pause();return await snap();}await page.waitForTimeout(20);}
    await pause();assert.fail(`Timed out: ${label}`);
  }
  async function screenshot(name){const path=resolve(out,`${name}.png`);await freshArtifact(path);await page.mouse.move(720,140);await page.screenshot({path});}
  async function persistence(name,saved,replay=true){
    const restored=await importSave(resolve(out,`${name}-save.json`),`${name} saved checkpoint`);comparePersisted(restored.native.game,saved.game,name);
    record(`${name} complete native round trip`,{gameSha256:digest(JSON.stringify(restored.native.game))});
    if(replay){
      assert(saved.replay);await openSessions('replay');const archive=await download('Export replay',`${name}-replay.json`);compareReplayExport(archive,saved.replay,name,identity);
      await sessions.getByLabel('Import replay JSON',{exact:true}).setInputFiles(resolve(out,`${name}-replay.json`));await sessions.getByRole('button',{name:'Import replay',exact:true}).click();
      await wait(()=>document.querySelector('[aria-label="Import replay JSON"]')?.files?.length===0&&[...document.querySelectorAll('.session-notice')].some(e=>!e.hidden&&e.textContent==='Replay loaded.'),null,60000);
      await wait(()=>window.rts?.mode==='replay');await ready();await sessions.getByLabel('Replay tick',{exact:true}).press('End');await wait(tick=>window.rts.state.tick===tick,archive.finalTick,60000);
      const endpoint=await exportSave(`${name}-replay-endpoint`);comparePersisted(endpoint.game,saved.game,`${name} replay`);
      record(`${name} complete replay endpoint`,{tick:archive.finalTick,checksum:archive.finalChecksum,commands:archive.actions.filter(a=>a.type==='command')});
      await closeSessions();await screenshot(`${name}-replay`);
    }
  }
  async function exportAndVerify(name){const file=await exportSave(name);await persistence(name,file,true);await importSave(resolve(out,`${name}-save.json`),`${name} resume original`);await closeSessions();return file;}
  return {page,out,evidenceDir:out,fixturesDir:fixtures,manifest,identity,evidence,sessions,tactics,faction,wait,snap,snapshot:snap,ready,record,check,closePanels,closeSessions,openSessions,download,exportSave,importSave,loadScenario,loadFixture:loadScenario,openWorld,selectTroop,selectUnit:selectTroop,selectBuilding,selectMany,point,battlefieldPoint:point,entityClick,ground,openTactics,openFaction,pause,resume,runUntil,screenshot,persistence,exportAndVerify,observeNative};
}
