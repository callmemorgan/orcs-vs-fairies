import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const cwd=process.cwd(),directory=resolve(cwd,'work/online-client-proof');
await rm(directory,{recursive:true,force:true});await mkdir(directory,{recursive:true});
await build({entryPoints:[resolve(cwd,'scripts/online/browser-entry.ts')],bundle:true,format:'esm',platform:'browser',outfile:join(directory,'fixture.js')});
await writeFile(join(directory,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="fixture.css"></head><body style="background:#112326;color:#eee"><div id="app"></div><script type="module" src="fixture.js"></script></body></html>');
const serverEntry=process.env.RTS_SERVER_ENTRY??resolve(cwd,'src/server/server.ts');
await build({entryPoints:[serverEntry],bundle:true,format:'esm',platform:'node',packages:'external',outfile:join(directory,'server.mjs')});
const {createRtsServer}=await import(pathToFileURL(join(directory,'server.mjs')).href);
const server=await createRtsServer({host:'127.0.0.1',port:0,dataDir:join(directory,'data'),staticDir:directory,spectatorDelaySeconds:2});
const playwright=await import(process.env.OVF_PLAYWRIGHT_MODULE??'playwright');
const browser=await playwright.chromium.launch({headless:true});
const contexts=[];const errors=[];
async function profile(){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(server.url);await page.getByRole('button',{name:'Online',exact:true}).click();await page.getByRole('button',{name:'Play as guest'}).click();await page.waitForFunction(()=>window.onlineFixture.lobby.account!==null);return page;}
try {
  const first=await profile(),second=await profile();
  const firstId=await first.evaluate(()=>window.onlineFixture.lobby.account.id),secondId=await second.evaluate(()=>window.onlineFixture.lobby.account.id);assert.notEqual(firstId,secondId,'Profiles must have separate server accounts');
  await first.getByRole('button',{name:'Create lobby',exact:true}).click();await first.waitForFunction(()=>window.onlineFixture.lobby.currentLobby!==null);
  const lobbyId=await first.evaluate(()=>window.onlineFixture.lobby.currentLobby.id);
  await second.getByRole('button',{name:'Refresh lobbies',exact:true}).click();await second.getByRole('button',{name:`Join lobby ${lobbyId}`,exact:true}).click();
  await second.waitForFunction(()=>window.onlineFixture.lobby.currentLobby!==null);
  await first.getByRole('button',{name:'Refresh lobbies',exact:true}).click();await first.getByRole('button',{name:'Ready',exact:true}).click();await first.waitForFunction(()=>window.onlineFixture.lobby.currentLobby.seats[0].ready);
  await second.getByRole('button',{name:'Refresh lobbies',exact:true}).click();await second.getByRole('button',{name:'Ready',exact:true}).click();await second.waitForFunction(()=>window.onlineFixture.lobby.currentLobby.seats.every(seat=>seat.ready));
  await first.getByRole('button',{name:'Refresh lobbies',exact:true}).click();await first.screenshot({path:join(directory,'lobby-ready.png')});await first.getByRole('button',{name:'Start match',exact:true}).click();await first.waitForFunction(()=>window.onlineFixture.view?.tick>=0);
  await second.getByRole('button',{name:'Refresh lobbies',exact:true}).click();await second.getByRole('button',{name:'Rejoin match',exact:true}).last().click();await second.waitForFunction(()=>window.onlineFixture.view?.side===1);
  const matchId=await first.evaluate(()=>window.onlineFixture.connection.matchId);
  const views=await Promise.all([first,second].map(page=>page.evaluate(()=>window.onlineFixture.view)));
  assert.equal(views[0].side,0);assert.equal(views[1].side,1);
  for(const view of views){assert.equal(view.map.seed,undefined);assert.equal(view.map.starts[1-view.side],null);assert.ok(view.map.terrain.some(tile=>tile===null));assert.equal(view.opponent.wood,undefined);for(const entity of view.entities.filter(entity=>entity.side!==view.side)){assert.equal(entity.order,undefined);assert.equal(entity.queue,undefined);}}
  await first.getByRole('button',{name:'Train worker',exact:true}).click();await first.waitForFunction(()=>window.onlineFixture.receipts.some(receipt=>receipt.accepted));
  await first.waitForFunction(()=>window.onlineFixture.view.entities.some(entity=>entity.side===0&&entity.role==='hq'&&entity.queue.includes('worker')));
  const generation=await second.evaluate(()=>window.onlineFixture.connection.connectionInfo.generation);
  await second.getByRole('button',{name:'Reconnect player',exact:true}).click();await second.waitForFunction(previous=>window.onlineFixture.connection.connectionInfo?.generation>previous,generation);
  await second.getByRole('button',{name:'Train worker',exact:true}).click();await second.waitForFunction(()=>window.onlineFixture.receipts.some(receipt=>receipt.accepted));
  const spectator=await profile();await spectator.getByLabel('Spectator match ID').fill(matchId);await spectator.getByLabel('Spectator perspective').selectOption('1');await spectator.getByRole('button',{name:'Spectate match',exact:true}).click();
  await spectator.waitForFunction(()=>window.onlineFixture.view?.side===1);assert.equal(await spectator.evaluate(()=>window.onlineFixture.connection.connectionInfo.delayTicks),40);
  await first.waitForFunction(()=>window.onlineFixture.view.tick>50);const liveTick=await second.evaluate(()=>window.onlineFixture.view.tick),delayedTick=await spectator.evaluate(()=>window.onlineFixture.view.tick);assert.ok(liveTick-delayedTick>=32,'Spectator must receive delayed frames');
  assert.equal(await spectator.evaluate(()=>window.onlineFixture.connection.dispatch({type:'stop',ids:[1]})),false);
  await first.screenshot({path:join(directory,'player-one.png')});await second.screenshot({path:join(directory,'player-two.png')});await spectator.screenshot({path:join(directory,'spectator.png')});assert.deepEqual(errors,[]);
  const result={checks:12,matchId,lobbyId,firstSide:0,secondSide:1,liveTick,delayedTick,receipts:await first.evaluate(()=>window.onlineFixture.receipts)};await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally {for(const context of contexts)await context.close();await browser.close();await server.close();}
