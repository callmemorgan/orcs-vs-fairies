import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
const [runnerArg, rootArg, directoryArg, requestedRef = '5cba15c8f4113af57dde2f1f05c3fa82f42bce3d'] = process.argv.slice(2);
assert(runnerArg && rootArg && directoryArg, 'Usage: node fault-probes.mjs RUNNER_PATH SOURCE_REPOSITORY NEW_OUTPUT_DIRECTORY [SAVE4_SOURCE_REF]');
const runnerPath = resolve(runnerArg), root = resolve(rootArg), directory = resolve(directoryArg);
await mkdir(directory); // Refuse reuse: every invocation owns an independent archive/index.
const ref = execFileSync('git', ['rev-parse', `${requestedRef}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
const sourceRoot = `${directory}/source-freeze-probe`; await mkdir(sourceRoot);
const proofInputs = ['scripts/verify_combined_combat.mjs', 'scripts/combined_combat_scenarios.ts', 'vite.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'index.html', 'editor.html'];
const archive = execFileSync('git', ['archive', ref, 'src', ...proofInputs], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
execFileSync('tar', ['-x', '-C', sourceRoot], { input: archive });
execFileSync('git', ['init', '--quiet', sourceRoot]);
const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
await writeFile(`${sourceRoot}/.git/objects/info/alternates`, `${resolve(root, common, 'objects')}\n`);
await writeFile(`${sourceRoot}/.git/HEAD`, `${ref}\n`);
execFileSync('git', ['read-tree', ref], { cwd: sourceRoot });
const producer = `import { writeFileSync } from 'node:fs';
import { createGame } from './src/core/simulation';
import { MatchRecorder } from './src/core/replays';
import { createSessionFile } from './src/core/session-storage';
const state=createGame('orcs',4127,'fairies',{controllers:['external','external']});
const recorder=new MatchRecorder(state);
const file=createSessionFile(state,recorder.export());
recorder.dispose();
if(file.game.version!==4)throw new Error('Expected native SAVE4 fixture');
writeFileSync(process.argv[2],JSON.stringify(file,null,2)+'\\n');
`;
await writeFile(`${sourceRoot}/probe-fixture.ts`, producer);
await writeFile(`${directory}/probe-fixture.ts`, producer);
const esbuild = resolve(process.env.OVF_ESBUILD_BINARY ?? `${root}/node_modules/.bin/esbuild`);
const bundlePath = `${directory}/save4-probe-fixture.mjs`, metafilePath = `${directory}/save4-probe-metafile.json`, fixturePath = `${directory}/save4-probe-session.json`;
const buildArgs = ['probe-fixture.ts', '--bundle', '--platform=node', '--format=esm', `--outfile=${bundlePath}`, `--metafile=${metafilePath}`];
function execute(command, args) {
  const result = spawnSync(command, args, { cwd: sourceRoot, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}`);
  return { command, args, cwd: sourceRoot, exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}
const buildReceipt = execute(esbuild, buildArgs), runArgs = [bundlePath, fixturePath];
const runReceipt = execute(process.execPath, runArgs);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const metafileBytes = await readFile(metafilePath), metafile = JSON.parse(metafileBytes);
const generatorInputs = [];
for (const [path, metadata] of Object.entries(metafile.inputs)) {
  const inputPath = resolve(sourceRoot, path), inputBytes = await readFile(inputPath), repoPath = relative(sourceRoot, inputPath).split('\\').join('/');
  assert.equal(inputBytes.length, metadata.bytes, `${repoPath} esbuild input byte count`);
  const committed = repoPath !== 'probe-fixture.ts';
  if (committed) assert.deepEqual(inputBytes, execFileSync('git', ['show', `${ref}:${repoPath}`], { cwd: sourceRoot, maxBuffer: 16 * 1024 * 1024 }), `${repoPath} generator input must equal pinned Git blob`);
  generatorInputs.push({ path: repoPath, bytes: inputBytes.length, sha256: sha256(inputBytes), committed });
}
await writeFile(`${directory}/generation-receipt.json`, JSON.stringify({ sourceRef: ref, build: buildReceipt, run: runReceipt, producerSha256: sha256(Buffer.from(producer)), bundleSha256: sha256(await readFile(bundlePath)), metafileSha256: sha256(metafileBytes), fixtureSha256: sha256(await readFile(fixturePath)), inputs: generatorInputs }, null, 2)+'\n');
const runner = await readFile(runnerPath, 'utf8');
// Use the exact production-proof helper source, without running browser orchestration.
const helpers = runner.slice(0, runner.indexOf('// Seal after the parent'));
await writeFile(`${directory}/exact-contract-helpers.mjs`, `${helpers}\nexport { assertCommittedInputs, regularFiles, comparePersisted, compareReplayExport, assertSessionIdentity, assertAssetBytes, fingerprints, safePath, htmlAssets };\n`);
const contract = await import(pathToFileURL(`${directory}/exact-contract-helpers.mjs`).href);
const bytes = await readFile(`${directory}/save4-probe-session.json`), native = JSON.parse(bytes);
const identity = { saveVersion: 4, simulationRevision: native.replay.simulationRevision };
const rows = [];
function pass(name, observation) { rows.push({ name, ...observation }); console.log(`PASS ${name}`); }
contract.assertSessionIdentity(native, 'Public SAVE4 control', identity, true);
contract.comparePersisted(structuredClone(native.game), native.game, 'Public SAVE4 control');
pass('Full native SAVE4 positive control', { saveVersion: native.game.version, rulesRevision: identity.simulationRevision });
const legacy = (actual, expected) => {
  for (const key of ['tick', 'time', 'entities', 'players', 'world', 'specialists', 'projectiles', 'factionSystems']) assert.deepEqual(actual.state[key], expected.state[key]);
};
for (const [name, corrupt] of [
  ['Missing runtime change', game => { game.runtime.aiTurns++; }],
  ['Missing rules change', game => { game.state.rules.friendlyFire = !game.state.rules.friendlyFire; }],
  ['Missing economy ledger change', game => { game.state.economy.ledgers[0].gathered.wood++; }],
  ['Missing event change', game => { game.state.events.push({type:'message',side:0,x:1,y:1,text:'assertion-only corruption'}); }],
]) {
  const candidate = structuredClone(native.game); corrupt(candidate);
  legacy(candidate, native.game);
  assert.throws(() => contract.comparePersisted(candidate, native.game, name), /complete native saved game envelope/);
  pass(name, { oldAllowlistAccepted: true, fullNativeEnvelopeRejected: true });
}
const oldSave = structuredClone(native); oldSave.game.version = 3;
assert.throws(() => contract.assertSessionIdentity(oldSave, 'Old fixture', identity), /current save version/);
pass('SAVE3 fixture rejected', { rejectedBeforeBrowser: true });
const oldRules = structuredClone(native.replay); oldRules.simulationRevision = 'modeled-incompatible-rules';
assert.throws(() => contract.compareReplayExport(oldRules, native.replay, 'Wrong replay rules', identity), /simulation revision/);
pass('Incompatible replay revision rejected', { rejected: true });
const history = structuredClone(native.replay); history.initial.runtime.aiTurns++;
assert.throws(() => contract.compareReplayExport(history, native.replay, 'Altered replay initial', identity), /replay initial/);
pass('Altered original replay initial rejected', { rejected: true });
const pinned = { bytes: 8, sha256: createHash('sha256').update('export{}').digest('hex') };
contract.assertAssetBytes(Buffer.from('export{}'), pinned, 'Pinned JS');
assert.throws(() => contract.assertAssetBytes(Buffer.from('export[]'), pinned, 'Stale served JS'), /SHA-256/);
assert.throws(() => contract.assertAssetBytes(Buffer.from('export{}'), undefined, 'Unpinned executed JS'), /absent from frozen dist/);
pass('Executed asset byte and identity faults rejected', { sameSizeStaleBytesRejected: true, unknownAssetRejected: true });
const declared = contract.htmlAssets('<script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css">', 'http://127.0.0.1:5397');
assert.deepEqual(declared, ['http://127.0.0.1:5397/assets/main.js', 'http://127.0.0.1:5397/assets/main.css']);
assert.throws(() => contract.htmlAssets('<html></html>', 'http://127.0.0.1:5397'), /declare executable assets/);
assert.throws(() => contract.safePath(`${directory}/dist`, '../outside.js'), /escapes/);
pass('Executable entry and path controls', { scriptAndCssRequired: true, emptyEntryRejected: true, traversalRejected: true });
const fixtureDirectory = `${directory}/freeze-artifact-probe`; await mkdir(fixtureDirectory, { recursive: true });
await writeFile(`${fixtureDirectory}/fixture.json`, 'original');
const originalFingerprint = await contract.fingerprints(fixtureDirectory, ['fixture.json']);
await writeFile(`${fixtureDirectory}/fixture.json`, 'modified');
assert.notDeepEqual(await contract.fingerprints(fixtureDirectory, ['fixture.json']), originalFingerprint);
await writeFile(`${fixtureDirectory}/fixture.json`, 'original');
pass('Frozen fixture bytes detect mutation', { rejected: true });
// This /tmp repository uses existing commit objects read-only through alternates.
let sourcePaths = await contract.regularFiles(`${sourceRoot}/src`);
await contract.assertCommittedInputs(sourceRoot, ref, sourcePaths);
pass('Source/Git blob positive control', { sourceRef: ref, sourceFiles: sourcePaths.length });
const removed = 'core/versions.ts', originalSource = await readFile(`${sourceRoot}/src/${removed}`);
const { unlink } = await import('node:fs/promises'); await unlink(`${sourceRoot}/src/${removed}`);
sourcePaths = await contract.regularFiles(`${sourceRoot}/src`);
await assert.rejects(() => contract.assertCommittedInputs(sourceRoot, ref, sourcePaths), /Disk source inventory/);
await writeFile(`${sourceRoot}/src/${removed}`, originalSource);
pass('Deleted committed source rejected before seal', { rejected: true });
execFileSync('git', ['update-index', '--assume-unchanged', `src/${removed}`], { cwd: sourceRoot });
await writeFile(`${sourceRoot}/src/${removed}`, Buffer.concat([originalSource, Buffer.from('\n// assertion-only source corruption\n')]));
assert.equal(execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'src'], { cwd: sourceRoot, encoding:'utf8' }).trim(), '');
sourcePaths = await contract.regularFiles(`${sourceRoot}/src`);
await assert.rejects(() => contract.assertCommittedInputs(sourceRoot, ref, sourcePaths), /bytes must equal the pinned Git blob/);
await writeFile(`${sourceRoot}/src/${removed}`, originalSource);
execFileSync('git', ['update-index', '--no-assume-unchanged', `src/${removed}`], { cwd: sourceRoot });
pass('Index-hidden source mutation rejected', { gitDiffAccepted: true, gitBlobCheckRejected: true });
const svg = sourcePaths.find(path=>path.endsWith('.svg')); assert(svg, 'Production source SVG probe');
const originalSvg = await readFile(`${sourceRoot}/src/${svg}`);
await writeFile(`${sourceRoot}/src/${svg}`, Buffer.concat([originalSvg, Buffer.from('\n<!-- assertion-only corruption -->\n')]));
await assert.rejects(() => contract.assertCommittedInputs(sourceRoot, ref, sourcePaths), /bytes must equal the pinned Git blob/);
await writeFile(`${sourceRoot}/src/${svg}`, originalSvg);
pass('Raw SVG source corruption rejected', { viteBuildIdScopeOmitsSvg: true, sourceBlobCheckRejectsSvg: true });
await contract.assertCommittedInputs(sourceRoot, ref, await contract.regularFiles(`${sourceRoot}/src`));
const output = { completed: true, scope: 'Offline proof-contract fault probes; no browser or CLI final proof', sourceRef: ref, runnerPath, sourceRepository: root, generationReceipt: `${directory}/generation-receipt.json`, nativeFixtureSha256: createHash('sha256').update(bytes).digest('hex'), runnerSha256: createHash('sha256').update(runner).digest('hex'), checks: rows };
await writeFile(`${directory}/fault-probes.json`, JSON.stringify(output, null, 2)+'\n');
console.log(`Verified ${rows.length} offline proof-contract cases.`);
