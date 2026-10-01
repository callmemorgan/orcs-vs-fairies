const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try {
const page=await browser.newPage({viewport:{width:1100,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.padSample=null;Object.defineProperty(navigator,'getGamepads',{value:()=>[window.padSample]});});
await page.goto(`${process.argv[2]??'http://127.0.0.1:5293'}/scripts/controls/fixture.html?art=placeholder`);await page.waitForFunction(()=>window.ready===true);
const evidence={};
const key=async code=>{await page.keyboard.press(code);await page.waitForTimeout(35);};
const snap=()=>page.evaluate(()=>({time:scene.state.time,paused:scene.paused,photo:scene.photoMode,camera:{x:scene.cameras.main.scrollX,y:scene.cameras.main.scrollY,zoom:scene.cameras.main.zoom},selection:[...scene.selected],steps:checks.steps,slots:[...checks.slots]}));
// Drive actual keyboard and verify fixed simulation step callback.
await page.waitForTimeout(150);assert((await snap()).steps>0);const panBefore=await snap();await key('ArrowRight');await page.waitForTimeout(40);assert((await snap()).camera.x>panBefore.camera.x);evidence.keyboardPan=true;
// Save a binding through public profile API, then drive its new key through scene.
await page.evaluate(()=>{scene.controls.saveProfile('Browser proof');scene.controls.setBinding('cameraRight','KeyR');});const rebound=await snap();await key('KeyR');await page.waitForTimeout(40);assert((await snap()).camera.x>rebound.camera.x);evidence.reboundPan=true;
// F2 selects army. A starts attack move instead of panning with a selection.
await key('F2');assert((await snap()).selection.length>0);await key('KeyA');assert.equal(await page.evaluate(()=>scene.attackMode),true);await key('Escape');
// Profile-driven action slots reach the UI callback once, even on auto-repeat.
await page.keyboard.down('KeyZ');await page.waitForTimeout(80);await page.keyboard.up('KeyZ');assert.deepEqual((await snap()).slots,[1]);evidence.slotCallback=true;
// Shift appends movement and attack-move commands through the same guarded dispatcher.
await page.evaluate(()=>{const unit=scene.state.entities.find(e=>e.side===0&&e.role==='melee');scene.selectEntities([unit.id]);scene.centerOn(unit.x,unit.y);});await page.waitForTimeout(40);
const destination=await page.evaluate(()=>{const unit=scene.state.entities.find(e=>e.side===0&&e.role==='melee'),world=project(unit.x+3,unit.y+3);return scene.cameras.main.matrixCombined.transformPoint(world.x,world.y);});
await page.keyboard.down('Shift');await page.mouse.click(destination.x,destination.y,{button:'right'});await page.keyboard.up('Shift');await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>checks.commands.at(-1).command.queued),true);assert.equal(await page.evaluate(()=>checks.commands.at(-1).command.type),'move');
await key('KeyA');await page.keyboard.down('Shift');await page.mouse.click(destination.x,destination.y);await page.keyboard.up('Shift');await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>checks.commands.at(-1).command.queued),true);assert.equal(await page.evaluate(()=>checks.commands.at(-1).command.type),'attackMove');evidence.shiftQueuedOrders=true;
await page.evaluate(()=>scene.controls.setBinding('queueModifier','KeyL'));await page.keyboard.down('KeyL');await page.mouse.click(destination.x,destination.y,{button:'right'});await page.keyboard.up('KeyL');await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>checks.commands.at(-1).command.queued),true);evidence.reboundQueueModifier=true;
// Photo mode pauses and hides all overlay graphics, restores prior running state.
await key('F9');const photo=await snap();assert.equal(photo.photo,true);assert.equal(photo.paused,true);assert.equal(await page.locator('#hud').isHidden(),true);const photoTime=photo.time;await page.waitForTimeout(120);assert.equal((await snap()).time,photoTime);const photoCamera=await snap();await key('KeyR');assert((await snap()).camera.x>photoCamera.camera.x);await page.screenshot({path:'work/controls-photo.png'});await key('Escape');assert.equal((await snap()).photo,false);assert.equal((await snap()).paused,false);evidence.photoRestoresRunning=true;
await key('KeyP');assert.equal((await snap()).paused,true);await key('F9');await key('F9');assert.equal((await snap()).paused,true);evidence.photoRestoresPaused=true;await key('KeyP');
// Forms suppress shortcut commands and camera taps.
await page.locator('#focus').focus();const formBefore=await snap();await key('KeyR');await key('KeyP');assert.equal((await snap()).paused,false);assert.equal((await snap()).camera.x,formBefore.camera.x);await page.locator('#focus').evaluate(input=>input.blur());evidence.formSuppression=true;
// Read-only replay blocks mutations but still supports camera and either side's selection.
await page.evaluate(()=>{scene.readOnly=true;scene.simulationEnabled=false;scene.viewSide=1;});await key('F2');assert(await page.evaluate(()=>scene.selected.every(id=>scene.state.entities.find(e=>e.id===id)?.side===1)));const readBefore=await page.evaluate(()=>JSON.stringify(scene.state.entities.map(e=>e.order)));await key('KeyX');assert.equal(await page.evaluate(()=>JSON.stringify(scene.state.entities.map(e=>e.order))),readBefore);evidence.readOnlyPerspective=true;
// A standard virtual device exercises the same navigator polling path as a physical controller.
await page.evaluate(()=>{scene.readOnly=false;scene.simulationEnabled=true;scene.viewSide=0;window.padSample={index:0,id:'proof controller',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array(17).fill(0)};});await page.waitForTimeout(50);const padBefore=await snap();await page.evaluate(()=>{padSample.axes=[1,0,0,0];});await page.waitForTimeout(100);assert((await snap()).camera.x>padBefore.camera.x);await page.evaluate(()=>{padSample.axes=[0,0,0,0];padSample.buttons[5]=1;});await page.waitForTimeout(50);const picked=(await snap()).selection;assert.equal(picked.length,1);await page.waitForTimeout(80);assert.deepEqual((await snap()).selection,picked);evidence.gamepadPanAndSelectionEdge=true;
await page.evaluate(()=>{padSample.buttons=Array(17).fill(0);});await page.waitForTimeout(30);await page.evaluate(()=>{padSample.buttons[11]=1;padSample.buttons[0]=1;});await page.waitForTimeout(50);assert.deepEqual((await snap()).slots,[1,1]);evidence.gamepadActionSlot=true;
// Modal suppression blocks both analog camera movement and pause shortcut.
await page.evaluate(()=>{scene.inputBlocked=true;padSample.axes=[1,0,0,0];});const blocked=await snap();await page.waitForTimeout(80);await key('KeyP');assert.equal((await snap()).camera.x,blocked.camera.x);assert.equal((await snap()).paused,blocked.paused);evidence.modalSuppression=true;
assert.deepEqual(errors,[]);await writeFile('work/controls-proof.json',JSON.stringify({evidence,errors,final:await snap()},null,2));console.log(JSON.stringify(evidence));
} finally {await browser.close();}
