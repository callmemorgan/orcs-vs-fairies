import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile, readdir, writeFile, stat} from 'node:fs/promises';
import {resolve, join, relative, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

// Ignored proof supervisor. Does not change production source or proof recipes.
const [kind, destination, frozenHead] = process.argv.slice(2);
assert(['hosted', 'competitions'].includes(kind));
assert(destination && /^[a-f0-9]{40}$/.test(frozenHead));
const cwd = process.cwd(), output = resolve(destination), ownPath = fileURLToPath(import.meta.url);
const auditPath = join(dirname(output), `${basename(output)}-audit.json`);
const runner = kind === 'hosted' ? 'scripts/server/verify-hosted-teams.mjs' : 'scripts/competitions/verify-canonical-main.mjs';
const appDirectory = join(output, kind === 'hosted' ? 'app' : 'browser');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(r => setTimeout(r, ms));
const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
async function sourcePin() {
  assert.equal(git('rev-parse', 'HEAD'), frozenHead);
  assert.equal(git('diff', '--name-only', 'HEAD'), '', 'Tracked source is dirty');
  const files = {}, digest = createHash('sha256');
  const selected = p => /^(src\/|public\/|scripts\/|package(?:-lock)?\.json$|tsconfig[^/]*\.json$|vite\.config\.|(?:index|editor)\.html$|Dockerfile\.server$|\.dockerignore$)/.test(p);
  const blobs = new Map(git('ls-tree', '-r', '-z', '--full-tree', frozenHead).split('\0').filter(Boolean).map(row => {const tab = row.indexOf('\t'); return [row.slice(tab + 1), row.slice(0, tab).split(' ')[2]];}).filter(([p]) => selected(p)));
  const paths = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(selected).sort();
  assert.deepEqual(paths, [...blobs.keys()].sort(), 'Checkout source paths differ from frozen Git tree');
  for (const path of paths) { const bytes = await readFile(join(cwd, path)); const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'); assert.equal(blob, blobs.get(path), `${path} differs from frozen Git blob`); files[path] = {sha256: sha(bytes), bytes: bytes.length, gitBlob: blob}; digest.update(path).update('\0').update(bytes).update('\0'); }
  assert.match(await readFile(join(cwd, 'src/core/saves.ts'), 'utf8'), /SAVE_VERSION\s*=\s*4\s*;/);
  assert.match(await readFile(join(cwd, 'src/core/versions.ts'), 'utf8'), /SIMULATION_REVISION\s*=\s*['"]4\.0\.1['"]\s*;/);
  assert(files['public/favicon.ico'], 'Frozen source must include the admitted favicon');
  return {head: frozenHead, tree: git('rev-parse', 'HEAD^{tree}'), saveVersion: 4, simulationRevision: '4.0.1', sha256: digest.digest('hex'), files};
}
async function packagePin(directory) {
  const files = {};
  async function walk(folder) { for (const item of (await readdir(folder, {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) { const path = join(folder, item.name); if (item.isDirectory()) await walk(path); else if (item.isFile()) { const bytes = await readFile(path); files[relative(directory, path)] = {sha256: sha(bytes), bytes: bytes.length}; } } }
  await walk(directory); return files;
}
assert.equal(await stat(output).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e)), null, 'Runner output must be new');
const source = await sourcePin(), supervisor = {path: ownPath, sha256: sha(await readFile(ownPath)), nodeVersion: process.version};
const runtimePath = join(dirname(ownPath), 'browser-runtime-readiness.json');
const runtimeBytes = await readFile(runtimePath), browserRuntime = JSON.parse(runtimeBytes);
const runtimeManifest = {path: runtimePath, sha256: sha(runtimeBytes)};
assert.equal(process.env.OVF_PLAYWRIGHT_MODULE, browserRuntime.module, 'Use the prepared browser runtime');
async function verifyBrowserRuntime() {
  assert.equal(sha(await readFile(runtimePath)), runtimeManifest.sha256, 'Browser runtime manifest changed');
  for (const [path, pin] of Object.entries(browserRuntime.files)) {
    const digest = createHash('sha256'); for await (const chunk of createReadStream(path)) digest.update(chunk);
    assert.equal(digest.digest('hex'), pin.sha256, `${path} changed from prepared browser runtime`);
  }
}
await verifyBrowserRuntime();
let status, failure, packageBefore, packageAfter, saveEvidence;
const generations = new Map(), served = [];
const child = spawn(process.execPath, [runner, output], {cwd, env: process.env, detached: process.platform !== 'win32', stdio: ['ignore', 'inherit', 'inherit']});
const closed = new Promise((r,j) => {child.once('error', j); child.once('close', (code,signal) => r({code,signal}));});
let exited = false; closed.then(() => {exited = true;}, () => {exited = true;});
const watcher = (async () => {
  while (!exited) {
    const logs = await readdir(output).catch(e => e.code === 'ENOENT' ? [] : Promise.reject(e));
    for (const log of logs.filter(f => /^server-\d+\.log$/.test(f)).sort()) {
      if (generations.has(log)) continue;
      const contents = await readFile(join(output, log), 'utf8');
      const found = /Orcs vs Fairies authoritative server: (http:\/\/127\.0\.0\.1:\d+)/.exec(contents);
      if (!found) continue;
      generations.set(log, {base: found[1], servedBytesObserved: false});
      // The restart process can finish its two persistence requests before an
      // independent observer fetches static bytes. Its package is rehashed below.
      if (log !== 'server-1.log') continue;
      packageBefore ??= {server: await packagePin(join(output, 'server')), browser: await packagePin(appDirectory)};
      assert.equal(packageBefore.browser['favicon.ico']?.sha256, source.files['public/favicon.ico'].sha256, 'Built favicon differs from frozen public bytes');
      assert.equal(packageBefore.browser['favicon.ico']?.bytes, source.files['public/favicon.ico'].bytes);
      // Observe served static bytes from the same packaged process the browser uses.
      const paths = Object.keys(packageBefore.browser).filter(p => p === 'index.html' || p === 'favicon.ico' || /^assets\/.*\.(?:js|css)$/.test(p));
      await Promise.all(paths.map(async path => {
        const url = `${found[1]}/${path === 'index.html' ? '' : path}`;
        const response = await fetch(url, {signal: AbortSignal.timeout(10000)});
        assert.equal(response.status, 200, `${log} ${path}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(sha(bytes), packageBefore.browser[path].sha256, `Served ${path} differs from built bytes`);
        served.push({generation: log, path, status: response.status, sha256: sha(bytes), bytes: bytes.length});
      }));
      generations.get(log).servedBytesObserved = true;
    }
    await pause(100);
  }
})();
watcher.catch(error => {failure ??= error;});
function stopOwnedProcesses(reason) {
  failure ??= new Error(reason);
  if (exited || !child.pid) return;
  const owned = new Set([child.pid]);
  // Hosted builds detach their own groups. Enumerate this runner's descendants
  // before stopping its group so those compilers cannot outlive cancellation.
  if (process.platform !== 'win32') {
    const rows = execFileSync('ps', ['-eo', 'pid=,ppid='], {encoding: 'utf8'}).trim().split('\n').map(row => row.trim().split(/\s+/).map(Number));
    let changed; do {changed = false; for (const [pid, ppid] of rows) if (owned.has(ppid) && !owned.has(pid)) {owned.add(pid); changed = true;}} while (changed);
    try {process.kill(-child.pid, 'SIGKILL');} catch (e) {if (e.code !== 'ESRCH') failure = e;}
  }
  for (const pid of owned) try {process.kill(pid, 'SIGKILL');} catch (e) {if (e.code !== 'ESRCH') failure = e;}
}
const interrupt = signal => stopOwnedProcesses(`Proof supervisor cancelled by ${signal}`);
const sigint = () => interrupt('SIGINT'), sigterm = () => interrupt('SIGTERM');
process.on('SIGINT', sigint); process.on('SIGTERM', sigterm);
const timer = setTimeout(() => stopOwnedProcesses('Proof supervisor exceeded 20 minutes'), 1200000);
try {
  status = await closed; await watcher; clearTimeout(timer);
  if (failure) throw failure;
  assert.equal(status.code, 0, `Proof recipe failed: ${JSON.stringify(status)}`);
  await verifyBrowserRuntime();
  assert.equal((await sourcePin()).sha256, source.sha256, 'Source changed during proof');
  packageAfter = {server: await packagePin(join(output, 'server')), browser: await packagePin(appDirectory)};
  assert.deepEqual(packageAfter, packageBefore, 'Built packages changed during proof');
  for (const log of (await readdir(output)).filter(f => /^server-\d+\.log$/.test(f))) {
    const contents = await readFile(join(output, log), 'utf8');
    const found = /Orcs vs Fairies authoritative server: (http:\/\/127\.0\.0\.1:\d+)/.exec(contents);
    if (found && !generations.has(log)) generations.set(log, {base: found[1], servedBytesObserved: false});
  }
  assert.equal(generations.size, 2, 'Both packaged server generations must have launch records');
  assert.equal(served.filter(row => row.path === 'index.html').length, 1);
  assert.equal(served.filter(row => row.path === 'favicon.ico').length, 1);
  const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));
  assert.equal(result.status, 'passed'); assert.equal(result.source.head, frozenHead);
  if (kind === 'competitions') {
    const files = ['native-local-before-equipment.json', 'native-local-after-equipment.json'];
    const saves = await Promise.all(files.map(async file => JSON.parse(await readFile(join(output, 'native-browser', file), 'utf8'))));
    for (const save of saves) {
      assert.equal(save.game.version, 4, 'Native export must use SAVE_VERSION4');
      assert.equal(save.replay?.simulationRevision, source.simulationRevision, 'Native replay must record simulation revision4.0.1');
    }
    assert.deepEqual(saves[0].game, saves[1].game, 'Equipment must preserve full native SAVE4 state');
    saveEvidence = files.map((file, i) => ({path: `native-browser/${file}`, saveVersion: saves[i].game.version, simulationRevision: saves[i].replay.simulationRevision, gameSha256: sha(JSON.stringify(saves[i].game))}));
  }
} catch (error) {failure ??= error;}
finally {
  clearTimeout(timer);
  process.off('SIGINT', sigint); process.off('SIGTERM', sigterm);
  await writeFile(auditPath, JSON.stringify({status: failure ? 'failed' : 'passed', kind, output, generatedAt: new Date().toISOString(), source, supervisor, browserRuntime, runtimeManifest, runner, childStatus: status, packagesBefore: packageBefore, packagesAfter: packageAfter, serverGenerations: Object.fromEntries(generations), served, saveEvidence, ...(failure ? {error: failure.stack ?? String(failure)} : {})}, null, 2));
}
if (failure) throw failure;
console.log(`Frozen-source audit: ${auditPath}`);
