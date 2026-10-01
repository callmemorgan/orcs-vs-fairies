import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Verify the mounted panel and production simulation, using only fixture UI actions. */
export async function verifyTactics(page,baseUrl='http://127.0.0.1:5296',capture=async()=>{}){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${baseUrl}/scripts/tactics/fixture.html?art=placeholder`);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#proof-data').textContent).ready);
  const snapshot=async()=>JSON.parse(await page.locator('#proof-data').textContent());
  const action=name=>page.getByRole('button',{name,exact:true});
  const waitFor=async predicate=>{for(let retry=0;retry<100;retry++){const state=await snapshot();if(predicate(state))return state;await page.waitForTimeout(50);}throw new Error('Tactics simulation did not reach the expected state.');};
  const initial=await snapshot(),evidence={};
  assert.deepEqual(initial.selected,initial.army.map(item=>item.id));assert.equal(initial.army.length,4);
  await page.getByLabel('Troop facing',{exact:true}).selectOption('4');await action('Apply facing').click();
  const faced=await waitFor(state=>state.army.every(item=>item.facing===4&&item.order.type==='hold'));
  assert(faced.commands.some(item=>item.accepted&&item.command.type==='face'));evidence.facingReachesHeldArmy=true;
  await page.getByLabel('Troop facing',{exact:true}).selectOption('6');await page.getByLabel('Formation spacing',{exact:true}).fill('1.4');
  for(const name of ['Line','Wedge','Square','Loose']){
    await action(name).click();const formed=await waitFor(state=>state.army.every(item=>item.tactics.formation?.kind===name.toLowerCase()));
    assert(formed.commands.some(item=>item.accepted&&item.command.type==='formation'&&item.command.formation===name.toLowerCase()));
    evidence[`${name.toLowerCase()}FormationReachesArmy`]=true;
    if(name==='Line'){
      await waitFor(state=>state.army.some((item,index)=>Math.hypot(item.x-initial.army[index].x,item.y-initial.army[index].y)>.2));
      await page.locator('#game canvas').click({button:'right',position:(await snapshot()).points.formationMove});
      const moved=await waitFor(state=>state.commands.some(item=>item.accepted&&item.command.type==='move'));
      assert(moved.army.every(item=>item.tactics.formation.kind==='line'&&Math.abs(item.tactics.formation.anchor.x-16)<.1&&Math.abs(item.tactics.formation.anchor.y-14)<.1));evidence.battlefieldMovePreservesFormation=true;await capture('line');
    }
  }
  await action('Place fixture army in woodland').click();
  await page.getByLabel('Ambush trigger radius',{exact:true}).fill('2.75');await page.getByLabel('Ambush target',{exact:true}).selectOption('cavalry');await action('Set ambush').click();
  const hidden=await waitFor(state=>state.army.every(item=>item.tactics.ambush?.concealed));
  assert(hidden.army.every(item=>item.tactics.ambush.radius===2.75&&item.tactics.ambush.target==='cavalry'));evidence.ambushConditionReachesConcealedArmy=true;await capture('ambush');
  await action('Release ambush').click();await waitFor(state=>state.army.every(item=>!item.tactics.ambush));evidence.ambushReleaseReachesArmy=true;
  await action('Select fixture worker').click();await action('Capture siege engine').click();
  const captured=await waitFor(state=>state.engine.side===0&&!state.engine.uncrewed);
  assert.equal(captured.engine.faction,'fairies');assert(captured.commands.some(item=>item.accepted&&item.command.type==='captureSiege'&&item.command.ids.includes(captured.worker.id)));evidence.captureCompletesAndPreservesEngineFaction=true;
  await action('Select fixture engine').click();assert((await page.getByLabel('Selected unit tactics').textContent()).includes('Crew 42/42'));evidence.capturedCrewAppearsInSelectedUnitStats=true;await page.getByLabel('Selected unit tactics').scrollIntoViewIfNeeded();await capture('captured');
  await action('Select fixture army').click();await action('Toggle fixture read-only').click();
  for(const name of ['Line','Wedge','Square','Loose','Apply facing','Set ambush','Release ambush','Capture siege engine'])assert.equal(await action(name).isEnabled(),false);
  assert((await page.getByText('Tactics commands are unavailable in this view.',{exact:true}).count())>0);evidence.readOnlyDisablesCommands=true;await capture('read-only');
  await action('Close army tactics').click();assert.equal(await page.locator('[data-tactics-launch]').getAttribute('aria-expanded'),'false');await page.locator('[data-tactics-launch]').click();assert.equal(await page.locator('[data-tactics-launch]').getAttribute('aria-expanded'),'true');evidence.panelReopens=true;
  assert.deepEqual(errors,[]);return {evidence,initial,captured,final:await snapshot(),browserErrors:errors};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const output=resolve('work/tactics-ui-proof');await mkdir(output,{recursive:true});
  const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage({viewport:{width:1280,height:900}});const result=await verifyTactics(page,process.env.OVF_TACTICS_URL??'http://127.0.0.1:5296',name=>page.screenshot({path:resolve(output,`${name}.png`)}));await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.evidence,null,2));}finally{await browser.close();}
}
