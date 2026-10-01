import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

// This helper packages inputs and audits native UI downloads. Browser actions use CUA.
const scriptPath = fileURLToPath(import.meta.url), scriptRelative = 'scripts/scenarios/main-browser-proof.mjs';
const fixtureNames = ['currentCampaignSession', 'authoredScenarioPackage', 'historicalGenericSession', 'historicalCampaignProfile', 'historicalRealmProfile', 'finaleCampaignProfile'];
const exportNames = ['ordinaryBefore', 'ordinaryReloaded', 'editorMapPackage', 'editorMapImported', 'editorMapBefore', 'editorMapReloaded', 'authoredPackage', 'authoredImported', 'authoredBefore', 'authoredReloaded', 'authoredAbility', 'campaignBefore', 'campaignContinued', 'historicalBefore', 'historicalAfter', 'historicalCampaignExport', 'historicalRealmExport', 'finaleSession', 'finaleCampaignExport', 'buildReport'];
const buildConfigPaths = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'vitest.config.ts', 'index.html', 'editor.html'];
const buildScriptRoots = ['scripts/controls-proof', 'scripts/minimap-alerts', 'scripts/verify_minimap_levels.mjs'];
const buildTestPaths = ['tests/appearance.test.ts', 'tests/display-settings.test.ts', 'tests/gamepad.test.ts', 'tests/minimap-alerts.test.ts', 'tests/minimap-level-focus.test.ts', 'tests/session-storage.test.ts', 'tests/session-tools.test.ts'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { maxBuffer: 64 * 1024 * 1024 });
const treeFiles = (root, commit) => git(root, ['ls-tree', '-r', '-z', commit]).toString().split('\0').filter(Boolean).map(entry => {
  const separator = entry.indexOf('\t'), [mode, type, gitBlob] = entry.slice(0, separator).split(' ');
  assert.equal(type, 'blob'); assert.ok(['100644', '100755'].includes(mode), `Unsupported frozen file mode: ${entry.slice(separator + 1)}`);
  return { path: entry.slice(separator + 1), gitBlob };
});
async function filesUnder(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, path));
    else { assert.equal(entry.isFile(), true, `Unsupported non-file ${path}`); files.push(path.replaceAll('\\', '/')); }
  }
  return files.sort();
}
async function inventory(root) {
  const result = {};
  for (const path of await filesUnder(root)) { const bytes = await readFile(join(root, path)); result[path] = { sha256: hash(bytes), bytes: bytes.length }; }
  return result;
}
async function sourcePin(root, commit) {
  const exact = git(root, ['rev-parse', `${commit}^{commit}`]).toString().trim();
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), exact, 'Source checkout must be at the frozen commit.');
  const entries = treeFiles(root, exact), paths = entries.map(entry => entry.path), files = {};
  for (const { path, gitBlob } of entries) {
    const actual = await readFile(join(root, path)), expected = git(root, ['show', `${exact}:${path}`]);
    assert.equal(hash(actual), hash(expected), `Tracked bytes differ from the frozen commit: ${path}`);
    files[path] = { sha256: hash(actual), bytes: actual.length, gitBlob };
  }
  const sourcePaths = paths.filter(path => path.startsWith('src/')).map(path => path.slice(4)).sort();
  assert.deepEqual(await filesUnder(join(root, 'src')), sourcePaths, 'The complete src inventory must match the frozen Git tree.');
  assert.deepEqual(await filesUnder(join(root, 'public')), paths.filter(path => path.startsWith('public/')).map(path => path.slice(7)).sort(), 'The complete public inventory must match the frozen Git tree.');
  const fingerprint = createHash('sha256');
  for (const path of sourcePaths.filter(path => /\.(ts|css)$/.test(path))) { fingerprint.update(path); fingerprint.update(await readFile(join(root, 'src', path))); }
  assert.equal(hash(await readFile(scriptPath)), files[scriptRelative]?.sha256, 'Executing helper must match the frozen helper bytes.');
  return { commit: exact, files, sourceFingerprint: fingerprint.digest('hex') };
}
function verifyBuildManifest(build, pinned, dist) {
  const select = accepts => Object.fromEntries(Object.entries(pinned.files).filter(([path]) => accepts(path)));
  const named = paths => Object.fromEntries(paths.map(path => { assert.ok(pinned.files[path], `Canonical build input missing from frozen source: ${path}`); return [path, pinned.files[path]]; }));
  assert.equal(build.sourcePin, pinned.commit, 'Build manifest must name the frozen source commit.');
  assert.equal(build.buildId, pinned.sourceFingerprint, 'Build manifest must name the frozen source fingerprint.');
  const expected = {
    sourceFiles: select(path => path.startsWith('src/')),
    assetFiles: select(path => path.startsWith('public/')),
    configFiles: named(buildConfigPaths),
    scriptFiles: select(path => buildScriptRoots.some(root => path === root || path.startsWith(`${root}/`))),
    testFiles: named(buildTestPaths),
  };
  for (const path of ['scripts/controls-proof/prepare.mjs', 'scripts/controls-proof/browser-common.mjs']) assert.ok(expected.scriptFiles[path], `Canonical build producer missing from frozen source: ${path}`);
  for (const [kind, files] of Object.entries(expected)) assert.deepEqual(build[kind], files, `Build manifest ${kind} differ from the frozen Git inputs.`);
  assert.deepEqual(build.compiledFiles, dist, 'Compiled production bytes differ from the canonical build manifest.');
}
async function newDirectory(path) {
  await mkdir(dirname(path), { recursive: true });
  try { await mkdir(path); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Evidence outputs are append-only. Choose a new directory.'); throw error; }
}
async function verifyPackage(output) {
  const manifest = await json(join(output, 'package.json'));
  assert.equal(manifest.format, 'orcs-vs-fairies-main-browser-proof'); assert.equal(manifest.version, 1);
  for (const [path, expected] of Object.entries(manifest.packageFiles)) {
    const bytes = await readFile(join(output, path)); assert.equal(hash(bytes), expected.sha256, `Packaged bytes changed: ${path}`); assert.equal(bytes.length, expected.bytes);
  }
  assert.deepEqual(await inventory(join(output, 'production')), manifest.dist);
  const temporary = await mkdtemp(join(tmpdir(), 'ovf-main-browser-bundle-'));
  try {
    git(temporary, ['init', '--bare', '--quiet']);
    git(temporary, ['fetch', '--quiet', join(output, 'source.bundle'), 'HEAD']);
    const exact = git(temporary, ['rev-parse', 'FETCH_HEAD']).toString().trim();
    assert.equal(exact, manifest.source.commit);
    const entries = treeFiles(temporary, exact), paths = entries.map(entry => entry.path), files = {}, fingerprint = createHash('sha256');
    for (const { path, gitBlob } of entries) { const bytes = git(temporary, ['show', `${exact}:${path}`]); files[path] = { sha256: hash(bytes), bytes: bytes.length, gitBlob }; }
    for (const path of paths.filter(path => /^src\/.*\.(ts|css)$/.test(path)).sort()) { fingerprint.update(path.slice(4)); fingerprint.update(git(temporary, ['show', `${exact}:${path}`])); }
    assert.deepEqual({ commit: exact, files, sourceFingerprint: fingerprint.digest('hex') }, manifest.source);
    assert.equal(manifest.buildManifest.path, 'build-manifest.json');
    const buildBytes = await readFile(join(output, manifest.buildManifest.path));
    assert.equal(hash(buildBytes), manifest.buildManifest.sha256); assert.equal(buildBytes.length, manifest.buildManifest.bytes);
    verifyBuildManifest(JSON.parse(buildBytes.toString()), manifest.source, manifest.dist);
    assert.equal(hash(await readFile(scriptPath)), files[scriptRelative]?.sha256, 'Executing helper must match the archived frozen helper.');
    for (const [packaged, source] of [['helper.mjs', scriptRelative], ['audit-source.ts', 'scripts/scenarios/main-browser-proof/audit.ts'], ['checklist.md', 'scripts/scenarios/main-browser-proof/checklist.md'], ['README.md', 'scripts/scenarios/main-browser-proof/README.md']]) assert.equal(hash(await readFile(join(output, packaged))), files[source]?.sha256, `Packaged helper source differs: ${packaged}`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return manifest;
}
async function verifyServed(url, expected) {
  const paths = Object.keys(expected), served = {};
  for (let start = 0; start < paths.length; start += 8) await Promise.all(paths.slice(start, start + 8).map(async path => {
    const target = new URL(path, url), response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `Cannot read served production file ${target}`);
    const bytes = Buffer.from(await response.arrayBuffer()); served[path] = { sha256: hash(bytes), bytes: bytes.length };
    assert.deepEqual(served[path], expected[path], `Served production bytes differ: ${path}`);
  }));
  return { checkedAt: new Date().toISOString(), files: Object.fromEntries(paths.map(path => [path, served[path]])) };
}

async function pack([source, commit, target, supplied, preparedBuild, destination]) {
  assert.ok(source && commit && target && supplied && preparedBuild && destination, 'pack requires SOURCE_ROOT COMMIT URL FIXTURES_JSON BUILD_MANIFEST_JSON NEW_OUTPUT');
  const root = resolve(source), output = resolve(destination), url = new URL(target), buildPath = resolve(preparedBuild), distRoot = join(dirname(buildPath), 'dist');
  assert.equal(url.pathname, '/index.html', 'Use the canonical main /index.html application.');
  const pinned = await sourcePin(root, commit), dist = await inventory(distRoot), buildBytes = await readFile(buildPath);
  verifyBuildManifest(JSON.parse(buildBytes.toString()), pinned, dist);
  assert.ok(dist['index.html'], 'Build the frozen production application before packaging.');
  const bundles = Object.keys(dist).filter(path => path.endsWith('.js'));
  assert.ok((await Promise.all(bundles.map(path => readFile(join(distRoot, path), 'utf8')))).some(bytes => bytes.includes(pinned.sourceFingerprint)), 'Production JavaScript lacks the frozen src fingerprint.');
  const suppliedPath = resolve(supplied), fixtureManifest = await json(suppliedPath);
  assert.equal(fixtureManifest.sourceCommit, pinned.commit, 'Current fixtures must name the frozen source commit.');
  for (const name of fixtureNames) assert.equal(typeof fixtureManifest.files?.[name], 'string', `Missing fixture path ${name}`);
  for (const required of ['scripts/scenarios/main-browser-proof/audit.ts', 'scripts/scenarios/main-browser-proof/checklist.md', 'scripts/scenarios/main-browser-proof/README.md']) assert.ok(pinned.files[required], `Helper source is not in the frozen tree: ${required}`);
  const servedBefore = await verifyServed(url.href, dist);
  await newDirectory(output); await mkdir(join(output, 'fixtures')); await mkdir(join(output, 'production'));
  git(root, ['bundle', 'create', join(output, 'source.bundle'), 'HEAD']);
  for (const path of Object.keys(dist)) { await mkdir(dirname(join(output, 'production', path)), { recursive: true }); await copyFile(join(distRoot, path), join(output, 'production', path)); }
  await writeFile(join(output, 'build-manifest.json'), buildBytes, { flag: 'wx' });
  const fixtures = {};
  for (const name of fixtureNames) {
    const sourcePath = resolve(dirname(suppliedPath), fixtureManifest.files[name]), path = `fixtures/${name}.json`;
    JSON.parse(await readFile(sourcePath, 'utf8')); await copyFile(sourcePath, join(output, path)); fixtures[name] = path;
  }
  const authored = await json(join(output, fixtures.authoredScenarioPackage));
  assert.equal(authored.kind, 'scenario'); assert.equal(authored.map?.kind, 'map');
  fixtures.editorMapPackage = 'fixtures/editorMapPackage.json';
  await writeFile(join(output, fixtures.editorMapPackage), JSON.stringify(authored.map, null, 2) + '\n');
  const helperDirectory = join(root, 'scripts/scenarios/main-browser-proof');
  await copyFile(join(root, scriptRelative), join(output, 'helper.mjs'));
  await copyFile(join(helperDirectory, 'checklist.md'), join(output, 'checklist.md'));
  await copyFile(join(helperDirectory, 'README.md'), join(output, 'README.md'));
  await copyFile(join(helperDirectory, 'audit.ts'), join(output, 'audit-source.ts'));
  // Resolve esbuild from the frozen checkout instead of relying on a global executable.
  const esbuild = await import(pathToFileURL(join(root, 'node_modules/esbuild/lib/main.js')).href);
  await esbuild.build({ entryPoints: [join(helperDirectory, 'audit.ts')], bundle: true, platform: 'node', format: 'esm', outfile: join(output, 'audit.mjs'), logLevel: 'silent' });
  await writeFile(join(output, 'exports-template.json'), JSON.stringify({ sourceCommit: pinned.commit, files: Object.fromEntries(exportNames.map(name => [name, `downloads/${name}.json`])) }, null, 2) + '\n');
  assert.deepEqual(await sourcePin(root, commit), pinned); assert.deepEqual(await inventory(distRoot), dist); assert.deepEqual(await readFile(buildPath), buildBytes, 'Canonical build manifest changed during packaging.');
  const packageFiles = await inventory(output);
  const manifest = { format: 'orcs-vs-fairies-main-browser-proof', version: 1, createdAt: new Date().toISOString(), url: url.href, source: pinned, dist, buildManifest: { path: 'build-manifest.json', sha256: hash(buildBytes), bytes: buildBytes.length, producer: 'scripts/controls-proof/prepare.mjs' }, fixtures, packageFiles, servedBefore, runtime: { node: process.version, esbuild: esbuild.version }, limits: 'This binds archived source, admitted canonical build preparation, production files and downloaded artifact audits. The CUA transcript and screenshots prove native browser actions, appearance, modal pause and cosmetics.' };
  await writeFile(join(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  await verifyPackage(output);
  process.stdout.write(JSON.stringify({ status: 'prepared; browser not executed', output, url: manifest.url, sourceCommit: pinned.commit, sourceFingerprint: pinned.sourceFingerprint, fixtures }) + '\n');
}

async function audit([destination, supplied]) {
  assert.ok(destination && supplied, 'audit requires PACKAGE_DIRECTORY UI_EXPORTS_JSON');
  const output = resolve(destination), suppliedPath = resolve(supplied), reportPath = join(output, 'export-audit.json'), retainedManifestPath = join(output, 'ui-exports-manifest.json');
  for (const path of [reportPath, retainedManifestPath]) {
    try { await lstat(path); throw new Error('Export audit is append-only. Choose a new evidence package to rerun.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await newDirectory(join(output, 'exports'));
  const exportFiles = {}, retentionErrors = [];
  let manifest, exportsManifest, exportManifestSha256, fixturePackageSha256, servedAfter, result, failure, phase = 'retain manifest';
  try {
    const manifestBytes = await readFile(suppliedPath);
    await writeFile(retainedManifestPath, manifestBytes, { flag: 'wx' }); exportManifestSha256 = hash(manifestBytes);
    exportsManifest = JSON.parse(manifestBytes.toString()); phase = 'retain downloads';
    for (const name of exportNames) {
      try {
        assert.equal(typeof exportsManifest.files?.[name], 'string', `Missing UI download ${name}`);
        const original = resolve(dirname(suppliedPath), exportsManifest.files[name]), bytes = await readFile(original), path = `exports/${name}.json`;
        await writeFile(join(output, path), bytes, { flag: 'wx' });
        exportFiles[name] = { path, sha256: hash(bytes), bytes: bytes.length };
        assert.equal(hash(await readFile(join(output, path))), exportFiles[name].sha256);
      } catch (error) { retentionErrors.push({ name, error: error instanceof Error ? error.message : String(error) }); }
    }
    assert.equal(retentionErrors.length, 0, 'Some UI downloads could not be retained; see retentionErrors in export-audit.json.');
    phase = 'verify package'; fixturePackageSha256 = hash(await readFile(join(output, 'package.json'))); manifest = await verifyPackage(output);
    assert.equal(exportsManifest.sourceCommit, manifest.source.commit);
    const fixtures = {}, exports = {};
    for (const [name, path] of Object.entries(manifest.fixtures)) fixtures[name] = await json(join(output, path));
    phase = 'decode downloads';
    for (const name of exportNames) exports[name] = await json(join(output, exportFiles[name].path));
    phase = 'verify served production'; servedAfter = await verifyServed(manifest.url, manifest.dist);
    phase = 'audit native exports';
    const auditor = await import(pathToFileURL(join(output, 'audit.mjs')).href);
    result = auditor.auditMainBrowserExports(fixtures, exports, manifest.source.sourceFingerprint);
    phase = 'verify package after audit'; await verifyPackage(output); phase = 'complete';
  } catch (error) { failure = error; }
  await writeFile(reportPath, JSON.stringify({ ...result, format: 'orcs-vs-fairies-main-browser-export-audit', version: 1, status: failure ? 'failed' : 'passed', phase, sourceCommit: manifest?.source.commit ?? exportsManifest?.sourceCommit ?? null, fixturePackageSha256, exportManifestSha256, exportFiles, retentionErrors, servedAfter, error: failure ? { name: failure instanceof Error ? failure.name : 'Error', message: failure instanceof Error ? failure.message : String(failure) } : null }, null, 2) + '\n', { flag: 'wx' });
  if (failure) throw failure;
  process.stdout.write(JSON.stringify({ status: 'downloaded artifacts verified; CUA observations remain separate', reportPath, ...result }) + '\n');
}

async function verify([destination]) {
  assert.ok(destination, 'verify requires PACKAGE_DIRECTORY');
  const output = resolve(destination), manifest = await verifyPackage(output), report = await json(join(output, 'export-audit.json')), fixtures = {}, exports = {};
  assert.equal(report.format, 'orcs-vs-fairies-main-browser-export-audit'); assert.equal(report.version, 1); assert.equal(report.status, 'passed', 'A failed export audit remains evidence, not a verified browser proof.');
  assert.equal(report.sourceCommit, manifest.source.commit); assert.equal(report.fixturePackageSha256, hash(await readFile(join(output, 'package.json'))));
  assert.equal(report.exportManifestSha256, hash(await readFile(join(output, 'ui-exports-manifest.json'))));
  for (const [name, path] of Object.entries(manifest.fixtures)) fixtures[name] = await json(join(output, path));
  for (const name of exportNames) { const entry = report.exportFiles[name], bytes = await readFile(join(output, entry.path)); assert.equal(hash(bytes), entry.sha256); assert.equal(bytes.length, entry.bytes); exports[name] = JSON.parse(bytes.toString()); }
  const auditor = await import(pathToFileURL(join(output, 'audit.mjs')).href), result = auditor.auditMainBrowserExports(fixtures, exports, manifest.source.sourceFingerprint);
  assert.deepEqual(result.checks, report.checks); assert.deepEqual(report.servedAfter.files, manifest.dist); assert.deepEqual(manifest.servedBefore.files, manifest.dist);
  process.stdout.write(JSON.stringify({ status: 'archived package and native downloads independently verified; no live checkout or server needed', ...result }) + '\n');
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'pack') await pack(args);
else if (mode === 'audit') await audit(args);
else if (mode === 'verify') await verify(args);
else throw new Error('Usage: node scripts/scenarios/main-browser-proof.mjs pack SOURCE_ROOT COMMIT URL FIXTURES_JSON BUILD_MANIFEST_JSON NEW_OUTPUT | audit PACKAGE_DIRECTORY UI_EXPORTS_JSON | verify PACKAGE_DIRECTORY');
