import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

// node scripts/server/verify-hosted-teams.mjs NEW_OUTPUT_DIRECTORY
// Builds and runs the production server entry and Vite app from this checkout.
// The browser driver uses ordinary accounts/lobbies and authenticated public commands.
const execute = promisify(execFile), cwd = process.cwd();
const output = resolve(process.argv[2] ?? `work/hosted-teams/${new Date().toISOString().replace(/[:.]/g, '-')}`);
const browserModule = fileURLToPath(new URL('./verify-hosted-teams-browser.mjs', import.meta.url));
const serverDirectory = join(output, 'server'), browserDirectory = join(output, 'app'), dataDirectory = join(output, 'private-data');
const checks = [], cleanupErrors = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let browser, server, base, generation = 0, created = false, source, packages, result, failure;

async function bounded(promise, milliseconds, description) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${description} exceeded ${milliseconds}ms`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
function pass(name, evidence) { checks.push({ name, ...(evidence === undefined ? {} : { evidence }) }); console.log(`PASS ${name}`); }
async function sourceSnapshot() {
  const [{ stdout: head }, { stdout: state }, { stdout: listing }] = await Promise.all([
    execute('git', ['rev-parse', 'HEAD'], { cwd }), execute('git', ['status', '--porcelain'], { cwd }),
    execute('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd, maxBuffer: 8 * 1024 * 1024 }),
  ]);
  const selected = [...new Set(listing.split('\0').filter(file => /^(src\/|public\/|scripts\/|package(?:-lock)?\.json$|tsconfig[^/]*\.json$|vite\.config\.|(?:index|editor)\.html$|Dockerfile\.server$|\.dockerignore$)/.test(file)))].sort();
  const files = {}, digest = createHash('sha256');
  for (const file of selected) { const bytes = await readFile(join(cwd, file)); files[file] = { sha256: hash(bytes), bytes: bytes.length }; digest.update(file).update('\0').update(bytes).update('\0'); }
  const buildDigest = createHash('sha256');
  for (const file of selected.filter(file => file.startsWith('src/') && /\.(ts|css)$/.test(file))) { buildDigest.update(file.slice(4)); buildDigest.update(await readFile(join(cwd, file))); }
  return { head: head.trim(), workingTree: state.trim(), sha256: digest.digest('hex'), buildId: buildDigest.digest('hex'), files };
}
async function packageSnapshot(directory) {
  const files = {};
  async function walk(folder) { for (const item of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const path = join(folder, item.name); if (item.isDirectory()) await walk(path); else if (item.isFile()) { const bytes = await readFile(path); files[relative(directory, path)] = { sha256: hash(bytes), bytes: bytes.length }; } } }
  await walk(directory); return files;
}
async function run(command, args, name) {
  const log = createWriteStream(join(output, `${name}.log`)), child = spawn(command, args, { cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const closed = new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolveExit({ code, signal })); });
  let status;
  try { status = await bounded(closed, 180000, name); }
  catch (error) {
    // npm starts a shell and compiler descendants. Stop their process group so a
    // failed build cannot continue writing the package or hold its log pipe open.
    if (process.platform !== 'win32' && child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (killError) { if (killError.code !== 'ESRCH') throw killError; } }
    else child.kill('SIGKILL');
    await bounded(closed, 5000, `${name} cleanup`).catch(() => {}); throw error;
  }
  finally { log.end(); await finished(log); }
  assert.equal(status.code, 0, `${name} failed (${status.code ?? status.signal}); inspect ${name}.log`);
}
async function launch(port = 0) {
  const log = createWriteStream(join(output, `server-${++generation}.log`));
  const child = spawn(process.execPath, [join(serverDirectory, 'rts-server.js')], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env, RTS_HOST: '127.0.0.1', RTS_PORT: String(port), RTS_DATA_DIR: dataDirectory,
    RTS_STATIC_DIR: browserDirectory, RTS_ORIGIN: '', RTS_SECURE_COOKIE: '0', RTS_TRUST_PROXY: '0', RTS_SPECTATOR_DELAY_SECONDS: '1',
  } });
  let buffer = '', ready, failed;
  const address = new Promise((resolveAddress, rejectAddress) => { ready = resolveAddress; failed = rejectAddress; });
  const exited = new Promise(resolveExit => {
    child.once('close', (code, signal) => { log.end(); failed(new Error(`Production server exited (${code ?? signal})`)); resolveExit({ code, signal }); });
    child.once('error', error => { log.end(); failed(error); resolveExit({ code: null, error: error.message }); });
  });
  child.stdout.on('data', chunk => { log.write(chunk); buffer = (buffer + chunk.toString()).slice(-16384); const found = /Orcs vs Fairies authoritative server: (http:\/\/127\.0\.0\.1:\d+)/.exec(buffer); if (found) ready(found[1]); });
  child.stderr.on('data', chunk => log.write(chunk)); server = { child, exited, log };
  base = await bounded(address, 15000, 'production server startup');
  const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) }); assert.equal(health.status, 200); return health.json();
}
async function stop() {
  if (!server) return;
  const current = server; server = undefined;
  if (current.child.exitCode === null && current.child.signalCode === null) current.child.kill('SIGTERM');
  let status;
  try { status = await bounded(current.exited, 10000, 'graceful server shutdown'); }
  catch (error) { current.child.kill('SIGKILL'); await bounded(current.exited, 5000, 'forced shutdown').catch(() => {}); throw error; }
  finally { await finished(current.log); }
  assert.equal(status.code, 0, `Production server shutdown failed (${status.code ?? status.signal ?? status.error})`);
}

try {
  source = await sourceSnapshot();
  const { verifyBrowser, verifyRestart } = await import(pathToFileURL(browserModule).href);
  assert.equal(typeof verifyBrowser, 'function'); assert.equal(typeof verifyRestart, 'function');
  await mkdir(dirname(output), { recursive: true }); await mkdir(output, { recursive: false }); created = true;
  await mkdir(dataDirectory, { mode: 0o700 });
  await run('npm', ['run', 'build', '--', '--outDir', browserDirectory, '--emptyOutDir'], 'vite-build');
  const manifest = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
  // Both production build scripts accept a destination: the original esbuild
  // script accepts its final outfile flag, and build-server.mjs takes a directory.
  // A fresh destination prevents old ignored dist-server files entering the proof.
  if (/\besbuild\b/.test(manifest.scripts['build:server'])) await run('npm', ['run', 'build:server', '--', `--outfile=${join(serverDirectory, 'rts-server.js')}`], 'server-build');
  else if (/scripts\/build-server\.mjs/.test(manifest.scripts['build:server'])) await run('npm', ['run', 'build:server', '--', serverDirectory], 'server-build');
  else throw new Error('Unsupported production build:server destination; update this verifier before running it.');
  await symlink(resolve(cwd, 'node_modules'), join(serverDirectory, 'node_modules'), 'dir');
  packages = { server: await packageSnapshot(serverDirectory), browser: await packageSnapshot(browserDirectory) };
  assert(packages.server['rts-server.js']); assert(packages.browser['index.html']);
  assert.equal((await sourceSnapshot()).sha256, source.sha256, 'Source changed during build');
  const health = await launch();
  const expectedProtocol = Number(/PROTOCOL_VERSION\s*=\s*(\d+)/.exec(await readFile(join(cwd, 'src/online/protocol.ts'), 'utf8'))?.[1]);
  assert.equal(health.protocolVersion, expectedProtocol); assert.equal(health.tickRate, 20);
  const module = process.env.OVF_PLAYWRIGHT_MODULE ?? createRequire(join(cwd, 'package.json')).resolve('playwright');
  const { chromium } = await import(module); browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  pass('current production server package and Vite app start', { protocolVersion: health.protocolVersion, buildId: source.buildId, browserVersion: browser.version(), nodeVersion: process.version });
  const { restart, ...serializable } = await verifyBrowser({ browser, base, output, protocolVersion: health.protocolVersion, checks, expectedBuildId: source.buildId });
  assert(restart, 'Browser proof must preserve an in-memory restart descriptor'); result = serializable;
  const port = Number(new URL(base).port); await stop(); const recoveredHealth = await launch(port); assert.equal(recoveredHealth.protocolVersion, health.protocolVersion);
  result.restart = await verifyRestart({ browser, base, output, protocolVersion: health.protocolVersion, checks, restart });
  assert.equal((await sourceSnapshot()).sha256, source.sha256, 'Source changed during verification');
  assert.deepEqual({ server: await packageSnapshot(serverDirectory), browser: await packageSnapshot(browserDirectory) }, packages, 'Served packages changed during verification');
  pass('source and served package hashes remain unchanged');
} catch (error) { failure = error; }
finally {
  await browser?.close().catch(error => cleanupErrors.push(error.message));
  await stop().catch(error => cleanupErrors.push(error.message));
  if (!failure && cleanupErrors.length) failure = new Error(`Cleanup failed: ${cleanupErrors.join('; ')}`);
  if (created) await writeFile(join(output, 'result.json'), JSON.stringify({ status: failure ? 'failed' : 'passed', generatedAt: new Date().toISOString(), cwd, output, source, packages, checks, browser: result, cleanupErrors, ...(failure ? { error: failure.stack ?? String(failure) } : {}), method: 'Build and serve the production server entry and Vite app. Native browser accounts, lobby controls and mounted authoritative games; public authenticated commands on captured native WebSockets. One-second delayed player/team spectator views. Graceful restart with the same package and durable data. No direct game-state writes, surrender, fabricated winners or natural-victory claim.', limits: ['Loopback production hosting; remote public deployment was not tested.', 'Brief layout, ownership, view and transport runs do not prove natural coordinated team victory.'] }, null, 2));
}
if (failure) throw failure;
console.log(`Evidence: ${join(output, 'result.json')}`);
