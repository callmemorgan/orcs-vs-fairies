import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Prepared without execution. Root must release this exact full pin explicitly.
const args = process.argv.slice(2);
assert.equal(args.length, 4, 'Pass frozen checkout, full source pin, admitted native output, and fresh supplemental output.');
const [sourceArgument, pin, nativeArgument, outputArgument] = args;
for (const path of [sourceArgument, nativeArgument, outputArgument]) assert(isAbsolute(path), 'Every directory argument must be absolute.');
assert.match(pin, /^[a-f0-9]{40}$/);
assert.equal(process.env.OVF_SCENARIO_RELEASED_PIN, pin, 'Execution is held until root releases this full pin using OVF_SCENARIO_RELEASED_PIN.');
const source = resolve(sourceArgument), native = resolve(nativeArgument), output = resolve(outputArgument);
const ownDirectory = dirname(fileURLToPath(import.meta.url));
const sha = data => createHash('sha256').update(data).digest('hex');
const gitBlob = data => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const fileReceipt = async path => { const bytes = await readFile(path); return { sha256: sha(bytes), bytes: bytes.length }; };
const within = (base, path) => { const local = relative(base, path); return local !== '' && !isAbsolute(local) && local !== '..' && !local.startsWith('..' + sep); };
assert(!within(source, output) && !within(native, output) && !within(output, source) && !within(output, native) && source !== output && native !== output,
  'Use a new evidence directory outside the source checkout and admitted native output.');
await mkdir(output); // No recursive option: an existing output is never reused.
let phase = 'authenticate', failure = null;
const startedAt = new Date().toISOString();
try {
  assert.equal(execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin);
  const matrixPath = join(ownDirectory, 'matrix.json'), matrixBytes = await readFile(matrixPath), matrix = JSON.parse(matrixBytes.toString());
  assert.equal(sha(matrixBytes), 'b33d21041e1a85422094c32d431434d870d0802a7e75916946c8c392b521f748', 'Prepared supplemental matrix bytes changed.');
  assert.equal(matrix.format, 'ovf-scenario-supplemental-fixture-readiness');
  assert.equal(matrix.version, 1);
  const sourceAfterPath = join(native, 'source-after.json'), admissionPath = join(native, 'native-admission.json');
  const sourceAfter = await json(sourceAfterPath), admission = await json(admissionPath);
  assert.equal(sourceAfter.format, 'orcs-vs-fairies-native-scenario-authenticated-inputs');
  assert.equal(admission.format, 'orcs-vs-fairies-native-scenario-result-admission');
  for (const value of [sourceAfter, admission]) {
    assert.equal(value.sourceCommit, pin); assert.equal(value.simulationRevision, '4.0.1'); assert.equal(value.saveVersion, 4);
  }
  assert.equal(admission.status, 'passed');
  assert.equal(admission.counts.missions, 30);
  assert.equal(admission.counts.conquestJournals, 5);
  assert.equal(admission.counts.persistentArmyRegressionRepeats, 2);
  await writeFile(join(output, 'generator.mjs'), await readFile(fileURLToPath(import.meta.url)), { flag: 'wx' });
  await writeFile(join(output, 'matrix.json'), matrixBytes, { flag: 'wx' });
  await writeFile(join(output, 'native-source-after.json'), await readFile(sourceAfterPath), { flag: 'wx' });
  await writeFile(join(output, 'native-admission.json'), await readFile(admissionPath), { flag: 'wx' });
  const tree = new Map();
  for (const entry of execFileSync('git', ['-C', source, 'ls-tree', '-r', '-z', pin]).toString().split('\0').filter(Boolean)) {
    const split = entry.indexOf('\t'), [mode, kind, blob] = entry.slice(0, split).split(' ');
    tree.set(entry.slice(split + 1), { mode, kind, blob });
  }
  const authenticate = async path => {
    assert(!isAbsolute(path) && within(source, resolve(source, path)), `Source path escapes checkout: ${path}`);
    const expected = sourceAfter.files[path], pinned = tree.get(path);
    assert(expected && pinned, `Source input is not in the admitted full pin: ${path}`);
    assert.equal(pinned.kind, 'blob'); assert(['100644', '100755'].includes(pinned.mode));
    const absolute = join(source, path), stat = await lstat(absolute);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Source input is not a regular pinned file: ${path}`);
    const bytes = await readFile(absolute);
    assert.equal(bytes.length, expected.bytes, `Source byte count changed: ${path}`);
    assert.equal(sha(bytes), expected.sha256, `Source hash changed: ${path}`);
    assert.equal(gitBlob(bytes), pinned.blob, `Source differs from full Git pin: ${path}`);
    assert.equal(expected.gitBlob, pinned.blob, `Native input manifest disagrees with full Git pin: ${path}`);
    return { bytes, receipt: { ...expected, gitMode: pinned.mode } };
  };
  phase = 'retain-raw-inputs';
  const retained = {};
  for (const [path, expected] of Object.entries(matrix.rawInputs)) {
    const admitted = await authenticate(path);
    assert.equal(sha(admitted.bytes), expected.sha256, `Readiness matrix input changed: ${path}`);
    assert.equal(admitted.bytes.length, expected.bytes, `Readiness matrix byte count changed: ${path}`);
    const retainedPath = join('raw', path), destination = join(output, retainedPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, admitted.bytes, { flag: 'wx' });
    assert.equal(sha(await readFile(destination)), expected.sha256);
    retained[path] = { ...admitted.receipt, retainedPath, status: 'original-bytes-retained' };
  }
  phase = 'bundle-supplemental-derivation';
  const esbuildMetadataPath = join(source, 'node_modules/esbuild/package.json');
  const esbuildMetadata = await readFile(esbuildMetadataPath);
  const dependency = sourceAfter.runtime.dependencies.esbuild;
  assert.equal(sha(esbuildMetadata), dependency.sha256); assert.equal(esbuildMetadata.length, dependency.bytes);
  const compiler = await import(pathToFileURL(join(source, 'node_modules/esbuild/lib/main.js')).href);
  assert.equal(compiler.version, dependency.version);
  const templateBytes = await readFile(join(ownDirectory, 'fixture-source.ts.template'));
  assert.equal(sha(templateBytes), 'dea00928088c039c26b63cd5046012a18cfcdd7a1d726a51bd7d75f5f8dfca0e', 'Reviewed supplemental template bytes changed.');
  await writeFile(join(output, 'fixture-source.ts.template'), templateBytes, { flag: 'wx' });
  const template = templateBytes.toString();
  assert(template.includes('__SOURCE_ROOT__'));
  const fixtureSource = template.replace(/__SOURCE_ROOT__ \+ '([^']+)'/g, (_match, local) => JSON.stringify(join(source, local.replace(/^\//, ''))));
  assert(!fixtureSource.includes('__SOURCE_ROOT__'), 'Every prepared native import must resolve to the explicit frozen checkout.');
  const fixturePath = join(output, 'fixture-source.ts'), runtimePath = join(output, 'fixture-runtime.mjs');
  await writeFile(fixturePath, fixtureSource, { flag: 'wx' });
  const result = await compiler.build({ absWorkingDir: source, entryPoints: [fixturePath], bundle: true, platform: 'node', format: 'esm',
    metafile: true, outfile: runtimePath, logLevel: 'silent' });
  await writeJson(join(output, 'fixture-runtime.meta.json'), result.metafile);
  const bundledInputs = {}, generatedInputs = {};
  for (const name of Object.keys(result.metafile.inputs)) {
    const absolute = resolve(source, name);
    if (absolute === fixturePath) {
      const bytes = await readFile(absolute); assert.equal(sha(bytes), sha(fixtureSource));
      generatedInputs[name] = { path: absolute, sha256: sha(bytes), bytes: bytes.length, derivation: 'Retained prepared template with only the source root substituted.' };
      continue;
    }
    assert(within(source, absolute), `Bundle input outside frozen checkout: ${name}`);
    const local = relative(source, absolute), authenticated = await authenticate(local);
    bundledInputs[local] = authenticated.receipt;
  }
  assert.equal(Object.keys(generatedInputs).length, 1, 'Exactly one declared generated entry is permitted.');
  for (const required of ['src/core/commander-rules.ts', 'src/core/versions.ts', 'src/core/campaign.ts', 'src/core/conquest.ts',
    'src/core/scenarios.ts', 'src/core/session-storage.ts', 'src/core/scenario-recordings.ts', 'src/core/content-registry.ts'])
    assert(bundledInputs[required], `Required native API is absent from the actual graph: ${required}`);
  const runtimeReceipt = await fileReceipt(runtimePath);
  await writeJson(join(output, 'bundle-provenance.json'), { sourceCommit: pin, simulationRevision: '4.0.1', compilerVersion: compiler.version,
    preparedTemplate: { path: 'fixture-source.ts.template', sha256: sha(templateBytes), bytes: templateBytes.length },
    compilerPackage: { sha256: sha(esbuildMetadata), bytes: esbuildMetadata.length },
    compilerLoader: await fileReceipt(join(source, 'node_modules/esbuild/lib/main.js')), generatedInputs, bundledInputs,
    bundle: runtimeReceipt, metafile: await fileReceipt(join(output, 'fixture-runtime.meta.json')) });
  phase = 'native-derivation-after-release';
  const runtime = await import(pathToFileURL(runtimePath).href);
  await runtime.derive(output, pin, retained);
  phase = 'post-derivation-authentication';
  for (const path of new Set([...Object.keys(retained), ...Object.keys(bundledInputs)])) await authenticate(path);
  assert.equal(execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin);
  assert.deepEqual(await fileReceipt(runtimePath), runtimeReceipt);
  assert.equal(sha(await readFile(join(output, 'fixture-source.ts.template'))), sha(templateBytes));
  const fixtures = await json(join(output, 'supplemental-fixtures.json'));
  for (const artifact of Object.values(fixtures.files)) assert.deepEqual(await fileReceipt(join(output, artifact.path)), { sha256: artifact.sha256, bytes: artifact.bytes });
  for (const [path, expected] of Object.entries(retained)) assert.equal(sha(await readFile(join(output, expected.retainedPath))), expected.sha256, path);
  await writeJson(join(output, 'supplemental-admission.json'), { format: 'ovf-scenario-supplemental-fixture-admission', version: 1,
    sourceCommit: pin, simulationRevision: '4.0.1', saveVersion: 4, status: 'passed', retainedInputs: retained,
    fixtureManifest: await fileReceipt(join(output, 'supplemental-fixtures.json')), derivation: await fileReceipt(join(output, 'derivation.json')),
    matrix: { sha256: sha(matrixBytes), bytes: matrixBytes.length }, generator: await fileReceipt(join(output, 'generator.mjs')),
    sourceAfter: await fileReceipt(sourceAfterPath), nativeAdmission: await fileReceipt(admissionPath),
    bundleProvenance: await fileReceipt(join(output, 'bundle-provenance.json')),
    limitations: ['This is fixture derivation and native decoder validation. Canonical browser actions, raw UI exports and independent evidence admission remain separate.',
      'No direct accepted player command, simulation step or replay verifier is invoked by this generator. Native decoder-internal replay is permitted only after root release.',
      'Completed historical conquest has no main-session companion because native owner binding would require replaying its historical journal.'] });
  phase = 'complete';
} catch (error) {
  failure = { phase, name: error.name, message: error.message, stack: error.stack }; throw error;
} finally {
  await writeJson(join(output, 'generation-status.json'), { sourceCommit: pin, simulationRevision: '4.0.1',
    status: failure ? 'failed' : 'passed', phase, startedAt, finishedAt: new Date().toISOString(), failure });
}
