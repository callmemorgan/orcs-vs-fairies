const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.padSample=null;Object.defineProperty(navigator,'getGamepads',{value:()=>[window.padSample]});});
  await page.goto(`${process.argv[2]??'http://127.0.0.1:5293'}/scripts/appearance/fixture.html?art=placeholder`);await page.waitForFunction(()=>window.ready===true);
  await mkdir('work',{recursive:true});
  const evidence={},sample=()=>page.evaluate(()=>{
    const battlefield=game.canvas.getContext('2d'),map=document.querySelector('#minimap').getContext('2d');
    return {battle:Array.from(battlefield.getImageData(430,300,520,360).data),map:Array.from(map.getImageData(0,0,216,216).data)};
  });
  const difference=(a,b)=>a.reduce((count,value,index)=>count+(value!==b[index]?1:0),0);
  await page.evaluate(()=>{appearance.reset();});await page.waitForTimeout(70);const defaults=await sample();
  await page.locator('#display-button').click();await page.getByLabel('Color palette',{exact:true}).selectOption('deuteranopia');await page.keyboard.press('Escape');await page.waitForTimeout(70);
  const deuter=await sample();evidence.deuteranopiaPixels={battle:difference(defaults.battle,deuter.battle),minimap:difference(defaults.map,deuter.map)};assert(evidence.deuteranopiaPixels.battle>500);assert(evidence.deuteranopiaPixels.minimap>100);
  await page.locator('#display-button').click();await page.getByLabel('Color palette',{exact:true}).selectOption('tritanopia');await page.keyboard.press('Escape');await page.waitForTimeout(70);
  const tritan=await sample();evidence.tritanopiaPixels={battle:difference(deuter.battle,tritan.battle),minimap:difference(deuter.map,tritan.map)};assert(evidence.tritanopiaPixels.battle>500);assert(evidence.tritanopiaPixels.minimap>100);
  await page.screenshot({path:'work/appearance-tritanopia.png'});
  await page.locator('#display-button').click();await page.getByLabel('Player shapes and patterns',{exact:true}).uncheck();await page.keyboard.press('Escape');await page.waitForTimeout(70);const unpatterned=await sample();evidence.patternPixels={battle:difference(tritan.battle,unpatterned.battle),minimap:difference(tritan.map,unpatterned.map)};assert(evidence.patternPixels.battle>50);assert(evidence.patternPixels.minimap>50);
  await page.locator('#display-button').click();await page.getByLabel('Outlines for your units, allies and enemies',{exact:true}).uncheck();await page.keyboard.press('Escape');await page.waitForTimeout(70);const noOutline=await sample();evidence.outlinePixels={battle:difference(unpatterned.battle,noOutline.battle),minimap:difference(unpatterned.map,noOutline.map)};assert(evidence.outlinePixels.battle>500);assert(evidence.outlinePixels.minimap>100);
  // Modal suppresses both keyboard and gamepad panning while preserving native form keys.
  await page.locator('#display-button').focus();await page.keyboard.press('Enter');const before=await page.evaluate(()=>scene.cameras.main.scrollX);await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>scene.cameras.main.scrollX),before);
  await page.evaluate(()=>{window.padSample={index:0,id:'display proof',mapping:'standard',connected:true,axes:[1,0,0,0],buttons:Array(17).fill(0)};});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scene.cameras.main.scrollX),before);evidence.gamepadDialogSuppression=true;
  await page.getByLabel('Player shapes and patterns',{exact:true}).focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>appearance.value.patterns),true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'display-button');evidence.keyboardDialog=true;await page.waitForTimeout(100);assert(await page.evaluate(()=>scene.cameras.main.scrollX)>before);await page.evaluate(()=>{window.padSample=null;});
  // Preferences survive a fresh scene/store with all choices restored.
  await page.reload();await page.waitForFunction(()=>window.ready===true);assert.deepEqual(await page.evaluate(()=>appearance.value),{palette:'tritanopia',patterns:true,outlines:false});evidence.persistedPreferences=true;
  // Construct fog-safe raid fixtures. A hidden attacker event must locate the owned target.
  await page.evaluate(()=>{
    appearance.set({outlines:true});state.time=3;state.tick=60;const own=state.entities.find(e=>e.id===200),enemy=state.entities.find(e=>e.id===102),expansion=state.entities.find(e=>e.id===201);
    for(const entity of state.entities.filter(e=>e.side!==0)){entity.x=40;entity.y=40;state.visible[0].delete(Math.floor(entity.y)*state.width+Math.floor(entity.x));}
    enemy.x=own.x+3;enemy.y=own.y;state.visible[0].delete(Math.floor(enemy.y)*state.width+Math.floor(enemy.x));
    state.events=[{type:'attack',side:enemy.side,source:enemy.id,target:own.id,x:enemy.x,y:enemy.y}];own.lastDamagedAt=3;expansion.x=36;expansion.lastDamagedAt=3;paint();
  });
  const alerts=await page.evaluate(()=>shell.minimapAlerts.current);assert(alerts.some(a=>a.entity===200&&a.kind==='raid'&&a.x===23&&a.y===17));assert(alerts.some(a=>a.entity===201&&a.kind==='expansion'&&a.x===36));assert(!alerts.some(a=>a.entity===102));evidence.hiddenAttackerTargetOnly=true;
  const mapWithAlerts=await page.evaluate(()=>Array.from(document.querySelector('#minimap').getContext('2d').getImageData(0,0,216,216).data));
  await page.locator('.minimap-alert-list [data-kind="expansion"]').focus();await page.keyboard.press('Enter');assert.deepEqual(await page.evaluate(()=>centers.at(-1)),{x:36,y:22});evidence.keyboardAlertCenter=true;
  await page.screenshot({path:'work/minimap-alerts.png'});
  await page.evaluate(()=>{state.time=12;state.tick=240;state.events=[];paint();});await page.waitForTimeout(50);
  assert(!(await page.evaluate(()=>shell.minimapAlerts.current)).some(a=>a.kind!=='idle'));evidence.damageMarkersExpire=true;
  const mapWithoutAlerts=await page.evaluate(()=>Array.from(document.querySelector('#minimap').getContext('2d').getImageData(0,0,216,216).data));assert(difference(mapWithAlerts,mapWithoutAlerts)>100);evidence.alertMarkerPixels=difference(mapWithAlerts,mapWithoutAlerts);
  await page.evaluate(()=>{state.time=16;state.tick=320;paint();});assert((await page.evaluate(()=>shell.minimapAlerts.current)).some(a=>a.kind==='idle'&&a.entity===200));
  await page.evaluate(()=>{state.entities.find(e=>e.id===200).queue=['worker'];paint();});assert(!(await page.evaluate(()=>shell.minimapAlerts.current)).some(a=>a.entity===200));evidence.idleRecruitmentClears=true;
  await page.evaluate(()=>{state.entities.find(e=>e.id===200).queue=[];paint();window.replayProof=true;const next=structuredClone(state);next.time=40;next.tick=800;scene.state=next;paint();});assert(!(await page.evaluate(()=>shell.minimapAlerts.current)).some(a=>a.kind==='idle'));evidence.forwardReplaySeekResetsIdle=true;
  assert.deepEqual(errors,[]);await writeFile('work/appearance-proof.json',JSON.stringify({evidence,errors},null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}
