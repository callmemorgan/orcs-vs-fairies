import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {resolve, join, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const [destination, frozenHead] = process.argv.slice(2);
assert(destination && /^[a-f0-9]{40}$/.test(frozenHead));
const cwd = process.cwd(), output = resolve(destination), ownPath = fileURLToPath(import.meta.url);
const tsx = '/home/morgana/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/cli.mjs';
const recipe = join(cwd, 'scripts/competitions/verify-hosted.ts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
assert.equal(git('rev-parse', 'HEAD'), frozenHead);
assert.equal(git('diff', '--name-only', 'HEAD'), '');
assert.match(await readFile(join(cwd, 'src/core/saves.ts'), 'utf8'), /SAVE_VERSION\s*=\s*4\s*;/);
assert.match(await readFile(join(cwd, 'src/core/versions.ts'), 'utf8'), /SIMULATION_REVISION\s*=\s*['"]4\.0\.1['"]\s*;/);
assert.equal(await stat(output).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e)), null, 'Daily output must be new');
const files = {}, digest = createHash('sha256');
const selected = p => /^(src\/|scripts\/|package(?:-lock)?\.json$|tsconfig[^/]*\.json$)/.test(p);
const blobs = new Map(git('ls-tree', '-r', '-z', '--full-tree', frozenHead).split('\0').filter(Boolean).map(row => {const tab = row.indexOf('\t'); return [row.slice(tab + 1), row.slice(0, tab).split(' ')[2]];}).filter(([p]) => selected(p)));
const paths = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(selected).sort();
assert.deepEqual(paths, [...blobs.keys()].sort(), 'Checkout source paths differ from frozen Git tree');
for (const path of paths) {
  const bytes = await readFile(join(cwd, path)), blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'); assert.equal(blob, blobs.get(path), `${path} differs from frozen Git blob`); files[path] = {sha256: hash(bytes), bytes: bytes.length, gitBlob: blob}; digest.update(path).update('\0').update(bytes).update('\0');
}
const source = {head: frozenHead, tree: git('rev-parse', 'HEAD^{tree}'), saveVersion: 4, simulationRevision: '4.0.1', sha256: digest.digest('hex'), files};
const runtime = {node: process.execPath, nodeVersion: process.version, tsx, tsxVersion: '4.23.15', tsxSha256: hash(await readFile(tsx)), recipe, recipeSha256: hash(await readFile(recipe)), supervisorSha256: hash(await readFile(ownPath))};
await mkdir(output, {recursive: false});
const args = [tsx, '--no-cache', '--tsconfig', join(cwd, 'tsconfig.json'), recipe];
const child = spawn(process.execPath, args, {cwd: output, env: process.env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']});
const stdout = [], stderr = []; child.stdout.on('data', b => {stdout.push(b); process.stdout.write(b);}); child.stderr.on('data', b => {stderr.push(b); process.stderr.write(b);});
const closed = new Promise((r,j) => {child.once('error', j); child.once('close', (code,signal) => r({code,signal}));});
let status, result, failure, exited = false;
closed.then(() => {exited = true;}, () => {exited = true;});
function stopOwnedProcesses(reason) {
  failure ??= new Error(reason); if (exited || !child.pid) return;
  try {if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL');} catch (e) {if (e.code !== 'ESRCH') failure = e;}
}
const sigint = () => stopOwnedProcesses('Daily proof cancelled by SIGINT'), sigterm = () => stopOwnedProcesses('Daily proof cancelled by SIGTERM');
process.on('SIGINT', sigint); process.on('SIGTERM', sigterm);
const timer = setTimeout(() => stopOwnedProcesses('Daily proof exceeded 5 minutes'), 300000);
try {
  status = await closed; clearTimeout(timer); if (failure) throw failure;
  assert.equal(status.code, 0, `Daily recipe failed: ${JSON.stringify(status)}`);
  assert.equal(git('rev-parse', 'HEAD'), source.head); assert.equal(git('rev-parse', 'HEAD^{tree}'), source.tree); assert.equal(git('diff', '--name-only', 'HEAD'), '');
  assert.deepEqual(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(selected).sort(), paths, 'Checkout source paths changed during daily proof');
  for (const [path, pin] of Object.entries(source.files)) assert.equal(hash(await readFile(join(cwd, path))), pin.sha256, `${path} changed during proof`);
  const resultPath = join(output, 'docs/evidence/competitions-hosted/result.json');
  result = JSON.parse(await readFile(resultPath, 'utf8'));
  assert.equal(result.first.final.outcome, 'win'); assert.equal(result.second.final.outcome, 'win');
  assert.equal(result.standings.length, 1); assert.equal(result.standings[0].tick, Math.min(result.first.tick, result.second.tick));
  assert.equal(result.standings[0].seconds, result.standings[0].tick / 20);
  assert.deepEqual(result.cosmeticProfile.wins, {orcs: 2}); assert.deepEqual(result.cosmeticProfile.owned, ['orcs-victory-banner']);
} catch (error) {failure ??= error;}
finally {
  clearTimeout(timer);
  process.off('SIGINT', sigint); process.off('SIGTERM', sigterm);
  await writeFile(join(output, 'stdout.log'), Buffer.concat(stdout)); await writeFile(join(output, 'stderr.log'), Buffer.concat(stderr));
  await writeFile(join(dirname(output), `${basename(output)}-audit.json`), JSON.stringify({status: failure ? 'failed' : 'passed', generatedAt: new Date().toISOString(), source, runtime, output, childStatus: status, resultPath: 'docs/evidence/competitions-hosted/result.json', method: 'Unchanged source recipe through tsx. Fixed October1 challenge; external side0 versus normal balanced infantry-rush AI. Normal authenticated HTTP and WebSocket commands. Server advances unchanged 1/20-second steps every1ms. Checks both actual wins, fastest-only score, durable command retry, cosmetic reward and restart persistence.', ...(failure ? {error: failure.stack ?? String(failure)} : {})}, null, 2));
}
if (failure) throw failure;
console.log(`Daily frozen-source audit: ${join(dirname(output), `${basename(output)}-audit.json`)}`);
