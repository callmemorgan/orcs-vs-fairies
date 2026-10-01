import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = data => createHash('sha256').update(data).digest('hex');
const runnerPath = fileURLToPath(import.meta.url);
const proofInputs = ['scripts/verify_combined_combat.mjs', 'scripts/combined_combat_scenarios.ts', 'vite.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'index.html', 'editor.html'];
async function regularFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(resolve(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert(!entry.isSymbolicLink(), `Frozen inputs must not be symlinks: ${path}`);
    if (entry.isDirectory()) files.push(...await regularFiles(directory, path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}
async function fingerprints(directory, paths) {
  return Promise.all(paths.map(async path => {
    const bytes = await readFile(resolve(directory, path));
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  }));
}
function safePath(directory, path) {
  const absolute = resolve(directory, path);
  assert(absolute.startsWith(`${resolve(directory)}${sep}`), `Input escapes its frozen directory: ${path}`);
  return absolute;
}
function assertGameIdentity(game, name, identity) {
  assert.equal(game?.format, 'orcs-vs-fairies-save', `${name} game format`);
  assert.equal(game?.version, identity.saveVersion, `${name} current save version`);
  assert(game.state && typeof game.state === 'object', `${name} state`);
  assert(game.runtime && typeof game.runtime === 'object', `${name} runtime`);
}
function assertReplayIdentity(archive, name, identity) {
  assert.equal(archive?.format, 'orcs-vs-fairies/replay', `${name} replay format`);
  assert.equal(archive?.version, 1, `${name} replay wrapper version`);
  assertGameIdentity(archive.initial, `${name} replay initial`, identity);
  assert.equal(archive.checksumVersion, identity.saveVersion, `${name} replay checksum version`);
  assert.equal(archive.simulationRevision, identity.simulationRevision, `${name} simulation revision`);
}
function assertSessionIdentity(file, name, identity, requireReplay = false) {
  assert.equal(file?.format, 'orcs-vs-fairies/session', `${name} session format`);
  assert.equal(file?.version, 1, `${name} session wrapper version`);
  assertGameIdentity(file.game, name, identity);
  if (requireReplay) assert(file.replay, `${name} recorded history`);
  if (file.replay) {
    assertReplayIdentity(file.replay, name, identity);
    assert.equal(file.replay.finalTick, file.game.state.tick, `${name} saved/replay tick`);
  }
}
function comparePersisted(actual, expected, name) {
  // No exclusions: the native game envelope includes all state and runtime.
  // Browser planning/profile data and UI flags are outside .game.
  assert.deepEqual(actual, expected, `${name} complete native saved game envelope`);
}
function compareReplayExport(actual, expected, name, identity) {
  assertReplayIdentity(actual, name, identity); assertReplayIdentity(expected, `${name} source`, identity);
  // Native import recomputes analysis/technologies; original playback data must match.
  for (const key of ['format', 'version', 'initial', 'actions', 'finalTick', 'finalChecksum', 'checksumVersion', 'simulationRevision']) assert.deepEqual(actual[key], expected[key], `${name} replay ${key}`);
}
async function assertCommittedInputs(root, expectedCommit, src) {
  const inputs = [...src.map(path => `src/${path}`), ...proofInputs].sort();
  const committedSrc = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', expectedCommit, '--', 'src'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  assert.deepEqual(src.map(path => `src/${path}`), committedSrc, 'Disk source inventory must equal the pinned commit, including deleted files');
  for (const path of inputs) {
    const committed = execFileSync('git', ['show', `${expectedCommit}:${path}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    assert.deepEqual(await readFile(resolve(root, path)), committed, `${path} bytes must equal the pinned Git blob`);
  }
  return inputs;
}
async function captureFreeze(root, fixtures, expectedCommit) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(commit, expectedCommit, 'HEAD must equal the explicitly frozen commit');
  const src = await regularFiles(`${root}/src`), inputs = await assertCommittedInputs(root, expectedCommit, src);
  assert.deepEqual(await readFile(runnerPath), await readFile(`${root}/scripts/verify_combined_combat.mjs`), 'Executed runner must match the committed proof input');
  const savesSource = await readFile(`${root}/src/core/saves.ts`, 'utf8'), versionsSource = await readFile(`${root}/src/core/versions.ts`, 'utf8');
  const saveVersion = Number(savesSource.match(/export const SAVE_VERSION\s*=\s*(\d+)\s*;/)?.[1]);
  const simulationRevision = versionsSource.match(/export const SIMULATION_REVISION\s*=\s*['"]([^'"]+)['"]\s*;/)?.[1];
  assert.equal(saveVersion, 4, 'This final combat proof requires fresh SAVE4 fixtures and source'); assert(simulationRevision, 'Pinned rules revision');
  const identity = { saveVersion, simulationRevision };
  const buildHash = createHash('sha256');
  for (const path of src.filter(path => /\.(ts|css)$/.test(path))) { buildHash.update(path); buildHash.update(await readFile(`${root}/src/${path}`)); }
  const manifest = JSON.parse(await readFile(`${fixtures}/manifest.json`, 'utf8'));
  assert.equal(manifest.schema, 1, 'Fixture manifest schema');
  assert.deepEqual(Object.keys(manifest.scenarios).sort(), ['automata', 'dwarves', 'orcs-formation', 'orcs-rally']);
  for (const [name, scenario] of Object.entries(manifest.scenarios)) {
    const file = JSON.parse(await readFile(safePath(fixtures, scenario.file), 'utf8'));
    assertSessionIdentity(file, `Fixture ${name}`, identity);
    assert.equal(file.game.state.tick, scenario.initialTick, `${name} authored initial tick`);
  }
  const distPaths = (await regularFiles(`${root}/dist`)).filter(path => /\.(?:html|js|css)$/.test(path));
  assert(distPaths.includes('index.html'), 'Frozen production HTML');
  return { schema: 1, source: { commit, ...identity, expectedBuildId: buildHash.digest('hex'), files: await fingerprints(root, inputs) }, fixtures: await fingerprints(fixtures, await regularFiles(fixtures)), dist: await fingerprints(`${root}/dist`, distPaths), executedRunnerSha256: digest(await readFile(runnerPath)) };
}
async function assertFreeze(root, fixtures, frozen) {
  assert.equal(frozen.schema, 1, 'Source freeze schema');
  assert.deepEqual(await captureFreeze(root, fixtures, frozen.source.commit), frozen, 'Source, runner, fixtures and dist must remain identical to the sealed inputs');
}
function assertAssetBytes(bytes, pinned, name) {
  assert(pinned, `Executed asset is absent from frozen dist: ${name}`);
  assert.equal(bytes.length, pinned.bytes, `${name} executed asset size`);
  assert.equal(digest(bytes), pinned.sha256, `${name} executed asset SHA-256`);
}
function htmlAssets(html, base) {
  const assets = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const attribute = name => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
    const source = /^<script\b/i.test(tag) ? attribute('src') : /^(?:stylesheet|modulepreload)$/i.test(attribute('rel') ?? '') ? attribute('href') : undefined;
    if (source) assets.push(new URL(source, base).href);
  }
  assert(assets.length, 'Production HTML must declare executable assets'); return assets;
}
async function freshArtifact(path) {
  try { await stat(path); assert.fail(`Evidence artifact already exists: ${path}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}


export { assertCommittedInputs, regularFiles, comparePersisted, compareReplayExport, assertSessionIdentity, assertAssetBytes, fingerprints, safePath, htmlAssets };
