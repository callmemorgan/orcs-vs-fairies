import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, fingerprints, freshArtifact, regularFiles, safePath } from './native-contract.mjs';
import { committedHelperInventory,configuredCompiler,helperBuildOptions } from './helper-provenance.mjs';

const [, , rootArg, outArg, pin] = process.argv;
assert(rootArg && outArg && /^[0-9a-f]{40}$/.test(pin ?? ''), 'Use ROOT NEW_OUTPUT FULL_SOURCE_COMMIT');
const root = resolve(rootArg), out = resolve(outArg);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), pin);
await freshArtifact(out); await mkdir(out, { recursive: true });
const self = fileURLToPath(import.meta.url);
assert.equal(self,resolve(root,'scripts/acceptance/build-native-helpers.mjs'),'Run helper builder from pinned checkout');
assert.deepEqual(await readFile(self), execFileSync('git', ['show', `${pin}:scripts/acceptance/build-native-helpers.mjs`], { cwd: root }));
const paths = [...(await regularFiles(resolve(root, 'src'))).map(path => `src/${path}`), ...(await regularFiles(resolve(root, 'scripts/acceptance'))).map(path => `scripts/acceptance/${path}`)].sort();
const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', pin, '--', 'src', 'scripts/acceptance'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).sort();
assert.deepEqual(paths, tracked, 'Complete source and acceptance inventories match the pinned Git tree');
const initial = await committedHelperInventory(root,pin);
for (const input of initial) assert.deepEqual(await readFile(safePath(root, input.path)), execFileSync('git', ['show', `${pin}:${input.path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 }));
const {esbuild,identity:compiler} = await configuredCompiler(root);
const mode = process.argv[5] ?? 'full';
assert(['full', 'main-smoke'].includes(mode), 'Known helper selection');
const entries = mode === 'main-smoke' ? [['fixtures', 'scripts/acceptance/main-smoke-fixtures.ts'], ['audit', 'scripts/acceptance/native-audit.ts'], ['history', 'scripts/acceptance/main-smoke402-history-audit.ts']] : [['fixtures', 'scripts/acceptance/native-fixtures.ts'], ['audit', 'scripts/acceptance/native-audit.ts']];
for (const [name, entry] of entries) {
  const bundlePath = resolve(out, `${name}.mjs`);
  const result = await esbuild.build(helperBuildOptions(root,entry,bundlePath));
  assert.equal(result.outputFiles.length, 1);
  const inputs = Object.keys(result.metafile.inputs).map(path => relative(root, resolve(root, path)).split(sep).join('/')).sort();
  assert(inputs.includes(entry)); assert(inputs.every(path => paths.includes(path)), 'Every bundled input belongs to pinned source/proof inventory');
  assert.deepEqual(await committedHelperInventory(root,pin), initial, 'All source/proof/config bytes remain unchanged during bundling');
  const bytes = result.outputFiles[0].contents;
  await writeFile(bundlePath, bytes, { flag: 'wx' });
  await writeFile(`${bundlePath}.metafile.json`, `${JSON.stringify(result.metafile, null, 2)}\n`, { flag: 'wx' });
  const provenance = { schema: 1, sourceCommit: pin, entry, bundle: { path: bundlePath, bytes: bytes.length, sha256: digest(bytes) }, builder: { path: 'scripts/acceptance/build-native-helpers.mjs', sha256: digest(await readFile(self)) }, esbuildVersion: esbuild.version, compiler, inventory:initial, inputs: initial.filter(input => inputs.includes(input.path)) };
  await writeFile(`${bundlePath}.provenance.json`, `${JSON.stringify(provenance, null, 2)}\n`, { flag: 'wx' });
}
await writeFile(resolve(out, 'source-inventory.json'), `${JSON.stringify({ sourceCommit: pin, files: initial }, null, 2)}\n`, { flag: 'wx' });
