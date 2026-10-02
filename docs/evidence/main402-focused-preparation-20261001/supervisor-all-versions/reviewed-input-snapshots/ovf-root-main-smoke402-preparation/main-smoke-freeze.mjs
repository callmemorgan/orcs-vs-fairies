import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSessionIdentity, digest, fingerprints, freshArtifact, regularFiles, safePath } from './native-contract.mjs';
import { committedHelperInventory, loadPinnedHelper } from './helper-provenance.mjs';

const producerEntry = 'scripts/acceptance/main-smoke-fixtures.ts';
const configPaths = ['vite.config.ts', 'index.html', 'editor.html'];
const git = (root, ...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });

export async function generateFocusedFixtures(root, fixtures, pin, helperPath) {
  await freshArtifact(fixtures);
  const { module: producer, provenance } = await loadPinnedHelper(root, pin, helperPath, producerEntry);
  assert.equal(typeof producer.buildFocusedMainFixtures, 'function');
  const manifest = producer.buildFocusedMainFixtures(fixtures, pin);
  assert.equal(Object.keys(manifest.scenarios).length, 15);
  const files = await fingerprints(fixtures, await regularFiles(fixtures));
  const receipt = { schema: 1, sourceCommit: pin, scope: 'Nine tactics and six ruin initial encounters; zero simulation ticks.',
    helper: provenance, fixtures: files };
  await writeFile(resolve(fixtures, 'generation-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  return receipt;
}

/** This freeze names the focused producer; the historical full-recipe freeze remains separate. */
export async function captureAcceptanceFreeze(root, fixtures, pin) {
  assert.match(pin, /^[0-9a-f]{40}$/);
  assert.equal(git(root, 'rev-parse', 'HEAD').toString().trim(), pin);
  assert.equal(fileURLToPath(import.meta.url), resolve(root, 'scripts/acceptance/main-smoke-freeze.mjs'));
  const sourceFiles = await committedHelperInventory(root, pin);
  for (const path of configPaths) assert.deepEqual(await readFile(resolve(root, path)), git(root, 'show', `${pin}:${path}`));
  const identity = { saveVersion: 4, simulationRevision: '4.0.2' };
  const saveSource = await readFile(resolve(root, 'src/core/saves.ts'), 'utf8');
  const ruleSource = await readFile(resolve(root, 'src/core/versions.ts'), 'utf8');
  assert.equal(Number(saveSource.match(/export const SAVE_VERSION\s*=\s*(\d+)/)?.[1]), identity.saveVersion);
  assert.equal(ruleSource.match(/export const SIMULATION_REVISION\s*=\s*['"]([^'"]+)/)?.[1], identity.simulationRevision);
  const generation = JSON.parse(await readFile(resolve(fixtures, 'generation-receipt.json'), 'utf8'));
  assert.equal(generation.sourceCommit, pin);
  const loaded = await loadPinnedHelper(root, pin, generation.helper.bundle.path, producerEntry);
  assert.deepEqual(loaded.provenance, generation.helper);
  assert.deepEqual(await fingerprints(fixtures, (await regularFiles(fixtures)).filter(path => path !== 'generation-receipt.json')), generation.fixtures);
  const manifest = JSON.parse(await readFile(resolve(fixtures, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schema, 1); assert.equal(manifest.sourceCommit, pin);
  assert.equal(manifest.saveVersion, identity.saveVersion); assert.equal(manifest.simulationRevision, identity.simulationRevision);
  assert.equal(Object.keys(manifest.scenarios).length, 15);
  for (const [name, scenario] of Object.entries(manifest.scenarios)) {
    const raw = await readFile(safePath(fixtures, scenario.file));
    assert.equal(digest(raw), scenario.sha256);
    const file = JSON.parse(raw.toString()); assertSessionIdentity(file, name, identity, true);
    assert.equal(file.game.state.tick, 0); assert.equal(file.game.state.time, 0);
    assert.equal(file.replay.finalTick, 0); assert.deepEqual(file.replay.actions, []);
    assert.equal(scenario.initialTick, 0); assert(scenario.authored && typeof scenario.authored === 'object');
  }
  const buildHash = createHash('sha256');
  for (const file of sourceFiles.filter(file => file.path.startsWith('src/') && /\.(ts|css)$/.test(file.path))) {
    buildHash.update(file.path.slice(4)); buildHash.update(await readFile(resolve(root, file.path)));
  }
  const distPaths = (await regularFiles(resolve(root, 'dist'))).filter(path => /\.(html|js|css)$/.test(path));
  assert(distPaths.includes('index.html'));
  return { schema: 1, scope: 'Focused canonical main controls and ruin rendering; fifteen declared encounters.',
    source: { commit: pin, ...identity, expectedBuildId: buildHash.digest('hex'),
      files: [...sourceFiles, ...await fingerprints(root, configPaths)].sort((a, b) => a.path.localeCompare(b.path)) },
    fixtures: await fingerprints(fixtures, await regularFiles(fixtures)), dist: await fingerprints(resolve(root, 'dist'), distPaths) };
}

export async function assertAcceptanceFreeze(root, fixtures, frozen) {
  assert.deepEqual(await captureAcceptanceFreeze(root, fixtures, frozen.source.commit), frozen);
}

if (process.argv[2] === '--generate' && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [, , , root, fixtures, pin, helper] = process.argv;
  assert(root && fixtures && pin && helper, 'Use --generate ROOT NEW_FIXTURES PIN MAIN_HELPER');
  await generateFocusedFixtures(resolve(root), resolve(fixtures), pin, resolve(helper));
}
