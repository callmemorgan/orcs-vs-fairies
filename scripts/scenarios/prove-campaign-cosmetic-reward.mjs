import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, writeFile, symlink, lstat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses an existing completed profile. It does not regenerate a campaign or drive
// browser controls; the companion canonical CUA proof exercises the visible UI.
const [pin, input, destination] = process.argv.slice(2);
if (!pin || !input || !destination) throw new Error('Usage: node scripts/scenarios/prove-campaign-cosmetic-reward.mjs <full-frozen-commit> <completed-profile.json> <fresh-output-directory>');
const cwd = process.cwd(), output = resolve(destination), profilePath = resolve(input);
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
assert.match(pin, /^[a-f0-9]{40}$/, 'Supply the full frozen commit.');
assert.equal(git('rev-parse', 'HEAD'), pin, 'Run only at the full frozen commit supplied by root.');
git('diff', '--quiet', 'HEAD', '--', 'src', 'scripts', 'tests/fixtures', 'package.json', 'package-lock.json');
assert.equal(await lstat(output).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }), false, 'Proof outputs are append-only.');
const sha = value => createHash('sha256').update(value).digest('hex');
async function filesUnder(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, path));
    else { assert.ok(entry.isFile(), `Unsupported source file: ${path}`); files.push(path.replaceAll('\\', '/')); }
  }
  return files.sort();
}
async function sourceFiles() {
  assert.equal(git('rev-parse', 'HEAD'), pin);
  const names = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', pin, '--', 'src', 'scripts', 'package.json', 'package-lock.json'], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean), files = {};
  assert.deepEqual(await filesUnder('src'), names.filter(name => name.startsWith('src/')).map(name => name.slice(4)).sort(), 'The complete src inventory must match the frozen tree.');
  for (const name of names) {
    const bytes = await readFile(name), blob = execFileSync('git', ['hash-object', '--stdin'], { cwd, input: bytes, encoding: 'utf8' }).trim();
    assert.equal(blob, git('rev-parse', `${pin}:${name}`), `Source differs from the frozen tree: ${name}`); files[name] = sha(bytes);
  }
  assert.equal(sha(await readFile(fileURLToPath(import.meta.url))), files['scripts/scenarios/prove-campaign-cosmetic-reward.mjs'], 'Executing helper must match the frozen helper.');
  return files;
}
const profileBytes = await readFile(profilePath), profile = JSON.parse(profileBytes.toString());
const revisionSource = await readFile('src/core/versions.ts', 'utf8'), rules = revisionSource.match(/SIMULATION_REVISION\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.ok(rules); assert.equal(profile.simulationRevision, rules); assert.equal(profile.active, null); assert.equal(profile.history.length, 4);
for (const chapter of profile.history) {
  assert.equal(chapter.checkpoint.game.version, 4); assert.equal(chapter.checkpoint.simulationRevision, rules);
  assert.equal(chapter.recording.version, 2); assert.equal(chapter.recording.checksumVersion, 4);
  assert.equal(chapter.recording.simulationRevision, rules); assert.equal(chapter.recording.initial.game.version, 4); assert.equal(chapter.recording.initial.simulationRevision, rules);
}
const finale = profile.history.at(-1), missionId = finale.missionId, factionId = finale.checkpoint.definition.faction;
const sources = await sourceFiles(), bundles = {};
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // Claim the directory exclusively, including racing proof runs.

let child, childClosed = Promise.resolve({ code: 0 }), shutdownRequested = false, cookie = '', url = '', firstProfile, errorText, logs = Promise.resolve();
const checks = [], responses = [];
async function start() {
  shutdownRequested = false;
  child = spawn(process.execPath, [join(output, 'server', 'rts-server.js')], {
    cwd, env: { ...process.env, RTS_HOST: '127.0.0.1', RTS_PORT: '0', RTS_DATA_DIR: join(output, 'data'), RTS_STATIC_DIR: resolve('dist'), RTS_ORIGIN: '', RTS_SECURE_COOKIE: '0', RTS_TRUST_PROXY: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  childClosed = new Promise(yes => { child.once('close', code => yes({ code })); });
  url = await new Promise((yes, no) => {
    let text = ''; const timer = setTimeout(() => no(new Error('Packaged campaign server did not start.')), 15000);
    child.once('error', error => { clearTimeout(timer); no(error); });
    child.once('exit', code => { clearTimeout(timer); no(new Error(`Packaged server exited (${code}).`)); });
    const log = chunk => { logs = logs.then(() => appendFile(join(output, 'server.log'), chunk)).catch(error => { errorText ??= error.message; }); };
    child.stdout.on('data', chunk => { log(chunk); text += chunk.toString(); const match = text.match(/authoritative server: (http:\/\/\S+)/); if (match) { clearTimeout(timer); yes(match[1]); } });
    child.stderr.on('data', log);
  });
}
async function stop() {
  if (!child) return;
  const current = child, running = current.exitCode === null && current.signalCode === null;
  let timer;
  try {
    const timeout = new Promise((_, no) => { timer = setTimeout(() => { current.kill('SIGKILL'); no(new Error('Packaged server did not close gracefully.')); }, 15000); });
    if (running) { shutdownRequested = true; current.kill('SIGTERM'); }
    const result = await Promise.race([childClosed, timeout]);
    if (result.code !== 0) throw new Error(`Packaged server stopped (${result.code}).`);
    if (!shutdownRequested) throw new Error('Packaged server exited before a requested shutdown.');
  } finally { clearTimeout(timer); }
  // 'close' follows drained stdout/stderr, so this includes every queued log.
  await logs;
}
async function request(path, value) {
  const response = await fetch(url + path, { method: value === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(value === undefined ? {} : { body: JSON.stringify(value) }), signal: AbortSignal.timeout(65000) });
  cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
  const data = await response.json(); responses.push({ path, status: response.status }); return { status: response.status, data };
}
const claim = (recording = profile, finaleId = missionId) => request('/api/cosmetics/campaign-victory', { missionId: finaleId, recording });
try {
  await writeFile(join(output, 'completed-profile.json'), profileBytes);
  await mkdir(join(output, 'server'));
  try {
    const build = execFileSync(process.execPath, ['scripts/build-server.mjs', join(output, 'server')], { cwd, encoding: 'utf8' });
    await writeFile(join(output, 'build.log'), build);
  } catch (error) { await writeFile(join(output, 'build.log'), `${error.stdout ?? ''}${error.stderr ?? ''}`); throw error; }
  await symlink(resolve('node_modules'), join(output, 'server', 'node_modules'), 'dir');
  for (const name of ['rts-server.js', 'canonical-campaign.mjs', 'campaign-runtime.mjs']) bundles[name] = sha(await readFile(join(output, 'server', name)));
  await start(); assert.equal((await claim()).status, 401); checks.push('Unauthenticated claim rejected');
  assert.equal((await request('/api/auth/register', { username: 'FrozenCampaignProof', password: 'temporary-campaign-proof' })).status, 200);
  const first = await claim(); assert.equal(first.status, 200); assert.deepEqual(first.data.verified, { campaignId: profile.campaignId, missionId, factionId });
  firstProfile = first.data.profile; assert.deepEqual(firstProfile, { wins: { [factionId]: 1 }, owned: [`${factionId}-victory-banner`], equipment: {} }); checks.push('Canonical four-chapter profile grants one faction win and banner');
  const duplicate = await claim(); assert.equal(duplicate.status, 200); assert.deepEqual(duplicate.data.profile, firstProfile); checks.push('Duplicate claim grants no additional win');
  const forged = structuredClone(profile); forged.history.at(-1).recording.finalChecksum = '00000000'; assert.equal((await claim(forged)).status, 400);
  assert.equal((await claim(profile, profile.history[0].missionId)).status, 400); const unchanged = await request('/api/cosmetics'); assert.equal(unchanged.status, 200); assert.deepEqual(unchanged.data.profile, firstProfile); checks.push('Forged checksum and wrong finale preserve inventory');
  const selected = { banner: `${factionId}-victory-banner`, decoration: null, portrait: null };
  const equipped = await request('/api/cosmetics/equip', { factionId, expectedRevision: 0, loadout: selected }); assert.equal(equipped.status, 200);
  assert.deepEqual(equipped.data.equipped, { factionId, revision: 1, loadout: selected });
  assert.deepEqual(equipped.data.profile, { ...firstProfile, equipment: { [factionId]: { revision: 1, loadout: selected } } });
  firstProfile = equipped.data.profile; checks.push('Earned banner persists with equipment revision one through the production endpoint');
  await stop(); await start(); const restored = await request('/api/cosmetics'), restartedDuplicate = await claim();
  assert.equal(restored.status, 200); assert.equal(restartedDuplicate.status, 200); assert.deepEqual(restored.data.profile, firstProfile); assert.deepEqual(restartedDuplicate.data.profile, firstProfile); checks.push('Equipment and duplicate gate survive a graceful packaged-server restart');
  assert.deepEqual(await sourceFiles(), sources);
} catch (error) { errorText = error instanceof Error ? error.message : String(error); throw error; }
finally {
  try { await stop(); } catch (error) { errorText ??= error instanceof Error ? error.message : String(error); }
  try { await logs; } catch (error) { errorText ??= error instanceof Error ? error.message : String(error); }
  await writeFile(join(output, 'report.json'), JSON.stringify({ format: 'orcs-vs-fairies-frozen-campaign-cosmetic-proof', version: 1, sourceCommit: pin, simulationRevision: rules, saveVersion: 4, sourceFiles: sources, sourceFingerprint: sha(JSON.stringify(sources)), bundles, input: { path: profilePath, copiedFile: 'completed-profile.json', bytes: profileBytes.length, sha256: sha(profileBytes) }, metadata: { campaignId: profile.campaignId, missionId, factionId }, checks, responses, profile: firstProfile, error: errorText ?? null, limits: ['This HTTP proof uses an existing completed profile and does not generate campaign gameplay.', 'Visible claim controls, cosmetic locking, renderer pixels and unchanged gameplay bytes are verified by the canonical CUA browser proof.'] }, null, 2) + '\n');
  if (errorText) process.exitCode = 1;
}
