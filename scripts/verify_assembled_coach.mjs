import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');
const base=process.argv[2]??'http://127.0.0.1:4173',out='work/hundred-features/coach-main-proof';
await mkdir(out,{recursive:true});
const hash=createHash('sha256');
for(const path of (await readdir('src',{recursive:true})).filter(path=>/\.(ts|css)$/.test(path)).sort()){
  hash.update(path);hash.update(await readFile(`src/${path}`));
}
const expectedBuildId=hash.digest('hex'),browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const evidence={},errors=[];let page;
try{
  page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);assert.equal(await page.locator('[data-practice-coach]').isVisible(),false);
  await page.locator('#map-size').selectOption('small');await page.locator('.begin-match').click();
  await page.waitForSelector('.loading-battle[hidden]',{state:'attached',timeout:60000});
  await page.locator('[data-coach-topic="idle-workers"]').waitFor({state:'visible',timeout:65000});
  evidence.realMatchShowsContextualAdvice=true;
  const snapshot=()=>page.evaluate(()=>{
    const {state,selected}=window.rts;
    return {tick:state.tick,selected,bank:{wood:state.players[0].wood,ore:state.players[0].ore,crystal:state.players[0].crystal},
      workers:state.entities.filter(e=>e.side===0&&e.role==='worker'&&e.hp>0).map(e=>({id:e.id,order:e.order,queue:e.orderQueue??[]}))};
  });
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForFunction(()=>window.rts?.paused===true);
  const before=await snapshot();assert(before.tick>=600);
  await page.getByRole('button',{name:'Show Workers need orders',exact:true}).click();
  const focused=await snapshot();assert.deepEqual(focused.selected,before.workers.map(e=>e.id));
  assert.deepEqual(focused.workers,before.workers);assert.deepEqual(focused.bank,before.bank);assert.equal(focused.tick,before.tick);
  evidence.showSelectsOwnedWorkersWithoutOrdersOrSpending=true;
  await page.getByText('Coach settings',{exact:true}).click();
  await page.getByLabel('Dismiss advice for',{exact:true}).selectOption('30');
  await page.getByRole('button',{name:'Dismiss Workers need orders',exact:true}).click();
  assert.equal(await page.locator('[data-coach-topic="idle-workers"]').count(),0);
  await page.waitForTimeout(1000);assert.equal((await snapshot()).tick,before.tick);
  assert.equal(await page.locator('[data-coach-topic="idle-workers"]').count(),0);
  evidence.pausedMatchPreservesDismissalCooldown=true;
  await page.getByLabel('Enable practice coach',{exact:true}).uncheck();
  const settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('orcs-vs-fairies/practice-coach/v1')));
  assert.deepEqual(settings,{version:1,enabled:false,cooldownSeconds:30});evidence.preferencesPersistThroughNormalControls=true;
  await page.getByLabel('Enable practice coach',{exact:true}).check();
  await page.getByRole('button',{name:'Photo mode',exact:true}).click();
  await page.locator('.photo-controls:not([hidden])').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-practice-coach]').isVisible(),false);
  await page.getByRole('button',{name:'Exit photo mode',exact:true}).click();
  await page.locator('[data-practice-coach]').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-coach-topic="idle-workers"]').count(),0);
  evidence.photoModeHidesCoachAndKeepsDismissals=true;
  await page.screenshot({path:`${out}/coach.png`});
  await page.locator('[data-session-tool="report"]').click();
  await page.getByLabel('Bug description',{exact:true}).fill('Mounted practice coach verification');
  const reportEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download bug report',exact:true}).click();
  const reportDownload=await reportEvent;await reportDownload.saveAs(`${out}/report.json`);
  const report=JSON.parse(await readFile(`${out}/report.json`,'utf8'));assert.equal(report.versions.buildId,expectedBuildId);
  evidence.productionBuildMatchesSource=true;
  await page.locator('[data-session-tab="replay"]').click();
  await page.getByLabel('Import replay JSON',{exact:true}).setInputFiles({name:'coach-replay.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(report.session.replay))});
  await page.getByRole('button',{name:'Import replay',exact:true}).click();
  await page.waitForFunction(()=>{try{return window.rts?.mode==='replay'&&window.rts.state.tick===0;}catch{return false;}},null,{timeout:60000});
  await page.getByRole('button',{name:'Close session tools',exact:true}).click();
  assert.equal(await page.locator('[data-practice-coach]').isVisible(),false);evidence.replayInspectionHidesCoach=true;
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/proof.json`,JSON.stringify({complete:true,base,buildId:expectedBuildId,evidence,errors},null,2));
  console.log(JSON.stringify({complete:true,buildId:expectedBuildId,evidence,errors}));
}catch(error){
  if(page)await page.screenshot({path:`${out}/failure.png`});
  await writeFile(`${out}/failure.json`,JSON.stringify({complete:false,base,evidence,errors,error:String(error)},null,2));throw error;
}finally{await browser.close();}
