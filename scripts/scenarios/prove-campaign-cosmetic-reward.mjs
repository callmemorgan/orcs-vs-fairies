import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile, symlink, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Uses an existing completed profile. It does not regenerate a campaign or drive
// browser controls; the companion canonical CUA proof exercises the visible UI.
const [pin, input, destination] = process.argv.slice(2);
if (!pin || !input || !destination) throw new Error('Usage: node scripts/scenarios/prove-campaign-cosmetic-reward.mjs <full-frozen-commit> <completed-profile.json> <fresh-output-directory>');
const cwd = process.cwd(), output = resolve(destination), profilePath = resolve(input);
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), pin, 'Run only at the full frozen commit supplied by root.');
git('diff', '--quiet', 'HEAD', '--', 'src', 'scripts', 'tests/fixtures', 'package.json', 'package-lock.json');
assert.equal(await stat(output).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }), false, 'Proof outputs are append-only.');
const sha = value => createHash('sha256').update(value).digest('hex');
const profileBytes = await readFile(profilePath), profile = JSON.parse(profileBytes.toString());
const revisionSource = await readFile('src/core/versions.ts', 'utf8'), rules = revisionSource.match(/SIMULATION_REVISION\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.ok(rules); assert.equal(profile.simulationRevision, rules); assert.equal(profile.active, null); assert.equal(profile.history.length, 4);
for (const chapter of profile.history) {
  assert.equal(chapter.checkpoint.game.version, 4); assert.equal(chapter.checkpoint.simulationRevision, rules);
  assert.equal(chapter.recording.version, 2); assert.equal(chapter.recording.checksumVersion, 4);
  assert.equal(chapter.recording.simulationRevision, rules); assert.equal(chapter.recording.initial.game.version, 4); assert.equal(chapter.recording.initial.simulationRevision, rules);
}
const finale = profile.history.at(-1), missionId = finale.missionId, factionId = finale.checkpoint.definition.faction;
const sources = {};
for (const name of git('ls-files', 'src', 'scripts/build-server.mjs', 'scripts/scenarios/prove-campaign-cosmetic-reward.mjs', 'package.json', 'package-lock.json').split('\n').filter(Boolean)) {
  const bytes = await readFile(name), blob = execFileSync('git', ['hash-object', '--stdin'], { cwd, input: bytes, encoding: 'utf8' }).trim();
  assert.equal(blob, git('rev-parse', `${pin}:${name}`), `Source differs from the frozen tree: ${name}`); sources[name] = sha(bytes);
}
await mkdir(join(output, 'server'), { recursive: true });
await writeFile(join(output, 'completed-profile.json'), profileBytes);
const build = execFileSync(process.execPath, ['scripts/build-server.mjs', join(output, 'server')], { cwd, encoding: 'utf8' });
await writeFile(join(output, 'build.log'), build);
await symlink(resolve('node_modules'), join(output, 'server', 'node_modules'), 'dir');
const bundles = {};
for (const name of ['rts-server.js', 'canonical-campaign.mjs', 'campaign-runtime.mjs']) bundles[name] = sha(await readFile(join(output, 'server', name)));

let child, cookie = '', url = '', firstProfile, errorText;
const checks = [], responses = [];
async function start() {
  child = spawn(process.execPath, [join(output, 'server', 'rts-server.js')], {
    cwd, env: { ...process.env, RTS_HOST: '127.0.0.1', RTS_PORT: '0', RTS_DATA_DIR: join(output, 'data'), RTS_STATIC_DIR: resolve('dist'), RTS_ORIGIN: '', RTS_SECURE_COOKIE: '0', RTS_TRUST_PROXY: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  url = await new Promise((yes, no) => {
    let text = ''; const timer = setTimeout(() => no(new Error('Packaged campaign server did not start.')), 15000);
    child.once('exit', code => { clearTimeout(timer); no(new Error(`Packaged server exited (${code}).`)); });
    child.stdout.on('data', chunk => { void appendFile(join(output, 'server.log'), chunk); text += chunk.toString(); const match = text.match(/authoritative server: (http:\/\/\S+)/); if (match) { clearTimeout(timer); yes(match[1]); } });
    child.stderr.on('data', chunk => { void appendFile(join(output, 'server.log'), chunk); });
  });
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  await new Promise((yes, no) => { const timer = setTimeout(() => { current.kill('SIGKILL'); no(new Error('Packaged server did not close gracefully.')); }, 15000); current.once('exit', code => { clearTimeout(timer); code === 0 ? yes() : no(new Error(`Packaged server stopped (${code}).`)); }); current.kill('SIGTERM'); });
}
async function request(path, value) {
  const response = await fetch(url + path, { method: value === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(value === undefined ? {} : { body: JSON.stringify(value) }), signal: AbortSignal.timeout(65000) });
  cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
  const data = await response.json(); responses.push({ path, status: response.status }); return { status: response.status, data };
}
const claim = (recording = profile, finaleId = missionId) => request('/api/cosmetics/campaign-victory', { missionId: finaleId, recording });
try {
  await start(); assert.equal((await claim()).status, 401); checks.push('Unauthenticated claim rejected');
  assert.equal((await request('/api/auth/register', { username: 'FrozenCampaignProof', password: 'temporary-campaign-proof' })).status, 200);
  const first = await claim(); assert.equal(first.status, 200); assert.deepEqual(first.data.verified, { campaignId: profile.campaignId, missionId, factionId });
  firstProfile = first.data.profile; assert.deepEqual(firstProfile.wins, { [factionId]: 1 }); assert.deepEqual(firstProfile.owned, [`${factionId}-victory-banner`]); checks.push('Canonical four-chapter profile grants one faction win and banner');
  assert.deepEqual((await claim()).data.profile, firstProfile); checks.push('Duplicate claim grants no additional win');
  const forged = structuredClone(profile); forged.history.at(-1).recording.finalChecksum = '00000000'; assert.equal((await claim(forged)).status, 400);
  assert.equal((await claim(profile, profile.history[0].missionId)).status, 400); assert.deepEqual((await request('/api/cosmetics')).data.profile, firstProfile); checks.push('Forged checksum and wrong finale preserve inventory');
  const selected = { banner: `${factionId}-victory-banner`, decoration: null, portrait: null };
  const equipped = await request('/api/cosmetics/equip', { factionId, expectedRevision: 0, loadout: selected }); assert.equal(equipped.status, 200); assert.deepEqual(equipped.data.equipped.loadout, selected); firstProfile = equipped.data.profile; checks.push('Earned banner equips through the production endpoint');
  await stop(); await start(); assert.deepEqual((await request('/api/cosmetics')).data.profile, firstProfile); assert.deepEqual((await claim()).data.profile, firstProfile); checks.push('Equipment and duplicate gate survive a graceful packaged-server restart');
  assert.equal(git('rev-parse', 'HEAD'), pin); git('diff', '--quiet', 'HEAD', '--', 'src', 'scripts', 'tests/fixtures', 'package.json', 'package-lock.json');
} catch (error) { errorText = error instanceof Error ? error.message : String(error); throw error; }
finally {
  try { await stop(); } catch (error) { errorText ??= error instanceof Error ? error.message : String(error); }
  await writeFile(join(output, 'report.json'), JSON.stringify({ format: 'orcs-vs-fairies-frozen-campaign-cosmetic-proof', version: 1, sourceCommit: pin, simulationRevision: rules, saveVersion: 4, sourceFiles: sources, sourceFingerprint: sha(JSON.stringify(sources)), bundles, input: { path: profilePath, copiedFile: 'completed-profile.json', bytes: profileBytes.length, sha256: sha(profileBytes) }, metadata: { campaignId: profile.campaignId, missionId, factionId }, checks, responses, profile: firstProfile, error: errorText ?? null, limits: ['This HTTP proof uses an existing completed profile and does not generate campaign gameplay.', 'Visible claim controls, cosmetic locking, renderer pixels and unchanged gameplay bytes are verified by the canonical CUA browser proof.'] }, null, 2) + '\n');
  if (errorText) process.exitCode = 1;
}
