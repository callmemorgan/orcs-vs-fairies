import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const productRoot = '/home/morgana/.codex/worktrees/assembled-rules401/orcs-vs-Fairies';
const productPin = 'c074cc5e610fc128d7b6ac894a61258d418463d4';
const out = resolve(productRoot, 'work/verification/ui-c074cc5-20261001/autosave-diagnostic-r1');
const base = 'http://127.0.0.1:5299/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {cwd: productRoot}).toString().trim(), productPin);
const playwrightModule = '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const executablePath = '/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const {chromium} = await import(playwrightModule);
const report = {productPin, base, playwrightModule, executablePath, method: 'Two fresh native browser contexts open the unchanged production menu for two seconds each. No match started, game commands, state writes, route mocking or filtering.', startedAt: new Date().toISOString(), pages: [], previewResponses: [], result: 'running'};
const browser = await chromium.launch({headless: true, executablePath, args: ['--disable-dev-shm-usage']});
report.browserVersion = browser.version();
try {
  for (let index = 1; index <= 2; index++) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true, serviceWorkers: 'block'});
    const page = await context.newPage();
    const observation = {index, console: [], pageErrors: [], pageRequests: [], pageResponses: [], contextRequests: [], contextResponses: [], cdpRequests: [], cdpResponses: [], cdpLoadingFailures: []};
    report.pages.push(observation);
    const request = r => ({url: r.url(), method: r.method(), resourceType: r.resourceType(), headers: r.headers()});
    const response = r => ({url: r.url(), status: r.status(), headers: r.headers(), resourceType: r.request().resourceType()});
    page.on('console', message => observation.console.push({type: message.type(), text: message.text(), location: message.location()}));
    page.on('pageerror', error => observation.pageErrors.push(String(error.stack ?? error)));
    page.on('request', r => observation.pageRequests.push(request(r)));
    page.on('response', r => observation.pageResponses.push(response(r)));
    context.on('request', r => observation.contextRequests.push(request(r)));
    context.on('response', r => observation.contextResponses.push(response(r)));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', e => observation.cdpRequests.push({requestId: e.requestId, url: e.request.url, method: e.request.method, headers: e.request.headers, type: e.type, initiator: e.initiator}));
    cdp.on('Network.responseReceived', e => observation.cdpResponses.push({requestId: e.requestId, url: e.response.url, status: e.response.status, headers: e.response.headers, type: e.type}));
    cdp.on('Network.loadingFailed', e => observation.cdpLoadingFailures.push(e));
    const served = await page.goto(base);
    assert.equal(served.status(), 200);
    observation.html = {url: served.url(), status: served.status(), sha256: sha(await served.body())};
    await page.waitForTimeout(2000);
    observation.matchStarted = await page.evaluate(() => Boolean(window.rts));
    assert.equal(observation.matchStarted, false);
    await cdp.detach();
    await context.close();
    observation.contextClosed = true;
  }
  const implicated = new Map();
  for (const observation of report.pages) {
    for (const item of observation.console.filter(item => item.type === 'error')) {
      assert(item.location?.url, 'Diagnostic records the actual console error URL');
      const headers = observation.cdpRequests.find(request => request.url === item.location.url)?.headers;
      implicated.set(item.location.url, headers ?? {});
    }
    for (const response of observation.cdpResponses.filter(response => response.status >= 400)) {
      const headers = observation.cdpRequests.find(request => request.url === response.url)?.headers;
      implicated.set(response.url, headers ?? {});
    }
  }
  for (const [url, requestHeaders] of implicated) {
    const headers = {};
    for (const [key, value] of Object.entries(requestHeaders)) {
      if (['accept', 'user-agent', 'referer'].includes(key.toLowerCase())) headers[key] = value;
    }
    const actual = await fetch(url, {headers, cache: 'no-store'});
    const bytes = Buffer.from(await actual.arrayBuffer());
    report.previewResponses.push({url, requestHeaders: headers, status: actual.status, headers: Object.fromEntries(actual.headers), bytes: bytes.length, sha256: sha(bytes), text: bytes.toString('utf8').slice(0, 500)});
  }
  report.result = 'observed';
} catch (error) {
  report.result = 'failed'; report.failure = String(error.stack ?? error); throw error;
} finally {
  await browser.close(); report.browserClosed = !browser.isConnected(); report.finishedAt = new Date().toISOString();
  await writeFile(resolve(out, 'browser-diagnostic.json'), `${JSON.stringify(report, null, 2)}\n`, {flag: 'wx'});
  console.log(JSON.stringify({result: report.result, pages: report.pages.map(page => ({index: page.index, errors: page.console.filter(item => item.type === 'error'), httpErrors: page.cdpResponses.filter(item => item.status >= 400)})), previewResponses: report.previewResponses, browserClosed: report.browserClosed}));
}
