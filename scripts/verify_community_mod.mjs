import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { worldSourceProof, checkCurrentSession, downloadWorldBuildReport, sha } from './world/proof-common.mjs';
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');

// Run after the combined content/editor build is available. The default server
// binds an unused loopback port and serves this checkout's production dist.
// OVF_COMMUNITY_MOD_FIXTURE selects another Lantern-compatible manifest.
// OVF_COMMUNITY_MOD_DEPENDENCIES is a JSON array of exact dependency file paths.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const evidence = path.resolve(process.env.OVF_EDITOR_EVIDENCE_DIR || path.join(root, 'docs/evidence/community-mod-browser-20261001'));
const staticDir = path.resolve(process.env.OVF_COMMUNITY_MOD_STATIC_DIR || process.env.OVF_PROOF_DIST || path.join(root, 'dist'));
const fixturePath = path.resolve(process.env.OVF_COMMUNITY_MOD_FIXTURE || path.join(root, 'public/mods/lantern/manifest.json'));
const dependencyPaths = JSON.parse(process.env.OVF_COMMUNITY_MOD_DEPENDENCIES || '[]');
assert(Array.isArray(dependencyPaths) && dependencyPaths.every(value => typeof value === 'string'), 'Dependencies must be a JSON array of file paths');
const port = Number(process.env.OVF_COMMUNITY_MOD_PORT || 0);
assert(Number.isSafeInteger(port) && port >= 0 && port <= 65535 && port !== 4173, 'Choose an unused local port; the root preview port 4173 is reserved');
await mkdir(path.dirname(evidence), { recursive: true }); await mkdir(evidence);
const source = await worldSourceProof(process.env.OVF_PRODUCTION_SOURCE_COMMIT ?? process.env.OVF_SOURCE_PIN);
assert.equal(execFileSync('git', ['diff', source.sourcePin, '--name-only', '--', 'scripts/verify_community_mod.mjs'], { encoding: 'utf8' }).trim(), '', 'Community mod driver must match the source pin');
const scriptSha256 = sha(await readFile(fileURLToPath(import.meta.url))), inputHashes = {};
const results = [], errors = [];
let helperDir, dataDir, server, browser, publisherPage, receiverPage, base, failure, helpers, publisherAccount;
let original, updated, originalBundle, updatedBundle, publishedOriginal, publishedUpdated;

function checked(name, details = {}) {
  results.push({ name, ...details });
  process.stdout.write(`PASS ${name}\n`);
}
async function save(name, value) {
  await writeFile(path.join(evidence, name), JSON.stringify(value, null, 2));
}
async function diagnostics(page) {
  return page.evaluate(() => window.editorDiagnostics?.());
}
async function servedAssetHashes(build) {
  const values = {};
  for (const url of [...build.scripts, ...build.stylesheets]) {
    const response = await fetch(url);
    assert.equal(response.status, 200, 'The served production entry asset is readable');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, await readFile(path.resolve(staticDir, `.${new URL(url).pathname}`)), 'The served asset matches this production build');
    values[new URL(url).pathname] = createHash('sha256').update(bytes).digest('hex');
  }
  return values;
}
async function openCommunity(page) {
  await page.getByRole('button', { name: 'Community packages', exact: true }).click();
  await page.getByRole('dialog', { name: 'Community packages', exact: true }).waitFor();
}
async function openWorkbench(page) {
  await page.goto(`${base}/editor.html`);
  const loaded = await page.evaluate(() => ({
    scripts: [...document.querySelectorAll('script[type=module]')].map(element => element.src),
    stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map(element => element.href),
  }));
  assert(loaded.scripts.length > 0);
  assert(loaded.scripts.every(url => !url.includes('/@vite/') && !url.includes('/src/') && !url.endsWith('.ts')), 'The browser uses production output');
  await page.getByRole('button', { name: 'Close editor', exact: true }).click();
  await openCommunity(page);
  return loaded;
}
async function register(page, name) {
  await page.getByLabel('Community username', { exact: true }).fill(name);
  await page.getByLabel('Community password', { exact: true }).fill('Community mod proof password');
  const waiting = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create community account', exact: true }).click();
  const response = await waiting;
  assert.equal(response.status(), 200);
  const account = (await response.json()).account;
  await page.locator('.community-account').getByText(`Signed in as ${name}.`, { exact: true }).waitFor();
  return account;
}
async function publishFile(file, expected) {
  const waiting = publisherPage.waitForResponse(response => response.url().endsWith('/api/packages') && response.request().method() === 'POST');
  const [response] = await Promise.all([
    waiting,
    publisherPage.getByLabel('Package file to publish', { exact: true }).setInputFiles(file),
  ]);
  assert.equal(response.status(), 201, `Publication accepts ${expected.id ?? expected.scenario?.id}@${expected.version ?? expected.revision}`);
  assert.deepEqual(response.request().postDataJSON().package, expected, 'Publication uses the exact fixture content');
  await publisherPage.locator('.community-status').filter({ hasText: 'Package file published.' }).waitFor();
  await publisherPage.locator('.community-details .community-hash').filter({ hasText: `Download checksum ${helpers.contentHash(expected)}` }).waitFor();
  await publisherPage.getByLabel('Published revision', { exact: true }).evaluate((select, version) => {
    if (select.value !== version) throw new Error(`Published revision ${select.value} differs from ${version}`);
  }, String(expected.version ?? expected.revision));
  // The page validates its POST receipt. CDP can discard a large response body,
  // so inspect the immutable publication through authenticated read-only GETs.
  const kind = expected.scenario ? 'scenario' : 'mod', localId = expected.id ?? expected.scenario.id;
  const params = new URLSearchParams({ q: localId, kind, pageSize: '50' });
  const searchResponse = await publisherPage.request.get(`${base}/api/packages?${params}`);
  assert.equal(searchResponse.status(), 200);
  const matching = (await searchResponse.json()).items.filter(item => item.localId === localId && item.kind === kind && item.publisher.id === publisherAccount.id);
  assert.equal(matching.length, 1, 'The authenticated publisher has one exact package identity');
  const detailResponse = await publisherPage.request.get(`${base}/api/packages/${matching[0].id}`);
  assert.equal(detailResponse.status(), 200);
  const { detail } = await detailResponse.json();
  const publication = { detail, verification: { mutationStatus: response.status(), receipt: 'authenticated immutable publication GET' } };
  assert(detail.revisions.some(revision => revision.version === String(expected.version ?? expected.revision) && revision.packageHash === expected.hash));
  assert.equal(publication.detail.packageHash, expected.hash);
  assert.equal(publication.detail.hash, helpers.contentHash(expected));
  return publication;
}
async function searchMod(page) {
  await page.getByLabel('Search packages', { exact: true }).fill(original.id);
  await page.getByLabel('Package kind', { exact: true }).selectOption('mod');
  const waiting = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/packages' && url.searchParams.get('q') === original.id && url.searchParams.get('kind') === 'mod' && response.request().method() === 'GET';
  });
  await page.getByRole('button', { name: 'Search community', exact: true }).click();
  const response = await waiting;
  assert.equal(response.status(), 200);
  const metadata = (await response.json()).items.find(item => item.localId === original.id);
  assert(metadata, 'The exact published mod appears in search metadata');
  const row = page.locator('.community-results article').filter({ has: page.getByRole('heading', { name: metadata.title, exact: true }) });
  await row.getByRole('button', { name: 'View package', exact: true }).click();
  await page.getByLabel('Published revision', { exact: true }).waitFor();
}
async function installRevision(page, publication, pkg) {
  await page.getByLabel('Published revision', { exact: true }).selectOption(pkg.version);
  const waiting = page.waitForResponse(response => response.url().endsWith(`/api/packages/content/${publication.detail.hash}`) && response.request().method() === 'GET');
  const details = page.locator('.community-details');
  const fresh = details.getByRole('button', { name: 'Download and install', exact: true });
  await (await fresh.count() ? fresh : details.getByRole('button', { name: 'Verify and reinstall revision', exact: true })).click();
  const response = await waiting;
  assert.equal(response.status(), 200);
  assert.deepEqual((await response.json()).package, pkg);
  await page.locator('.community-status').filter({ hasText: `Installed ${pkg.name}, version ${pkg.version}.` }).waitFor();
  const batch = await page.evaluate(hash => {
    const raw = localStorage.getItem(`ovf.community.library.v1.batch.${hash}`);
    return raw === null ? null : JSON.parse(raw);
  }, publication.detail.hash);
  assert(batch && batch.schemaVersion === 1, 'Installation persists a versioned immutable batch');
  const expected = pkg === original ? originalBundle : updatedBundle;
  assert.deepEqual(helpers.createContentBundle(batch.records.map(record => record.package)), expected, 'The installed root closure is exact');
  const byHash = new Map(batch.records.map(record => [record.hash, record]));
  for (const record of batch.records) {
    assert.equal(record.hash, helpers.contentHash(record.package));
    assert.equal(record.packageHash, record.package.hash);
    assert.deepEqual(record.dependencies.map(hash => {
      const dependency = byHash.get(hash);
      assert(dependency, 'Each installed dependency belongs to this root closure');
      return { id: dependency.localId, version: dependency.version, hash: dependency.packageHash };
    }), record.package.dependencies);
  }
  await save(`installed-closure-${pkg.version}.json`, batch);
  return batch;
}
function assertMatch(snapshot, pkg, expectedBundle) {
  assert(snapshot, 'Editor diagnostics exist');
  assert(snapshot.content, 'Editor diagnostics must expose the copied match content bundle');
  assert(snapshot.art, 'Editor diagnostics must expose copied scene.artStatus');
  assert(snapshot.camera, 'Editor diagnostics must expose copied camera scroll, zoom, width and height');
  assert.equal(snapshot.packageHash, pkg.hash);
  assert.equal(snapshot.players[0].faction, pkg.factions[0].id);
  assert.deepEqual(snapshot.content, expectedBundle, 'Actual match uses only this revision and its exact dependency closure');
  assert.equal(snapshot.art.enabled, true);
  assert.equal(snapshot.art.loaded, true, 'Required packaged custom textures and built-in art loaded');
}
async function playInstalled(page, pkg, expectedBundle) {
  await page.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await page.waitForFunction(hash => {
    const value = window.editorDiagnostics?.();
    return value?.packageHash === hash && value.tick > 0 && value.art?.loaded;
  }, pkg.hash, { timeout: 45000 });
  const snapshot = await diagnostics(page);
  assertMatch(snapshot, pkg, expectedBundle);
  assert.equal(await page.getByLabel('Running community package', { exact: true }).innerText(), `${pkg.name} · version ${pkg.version}`);
  assert.equal(await page.locator('#faction-name').innerText(), pkg.factions[0].name);
  return snapshot;
}
async function screenPoint(page, x, y) {
  const { camera } = await diagnostics(page);
  assert(camera && [camera.x, camera.y, camera.zoom, camera.width, camera.height].every(Number.isFinite));
  return {
    x: (1600 + (x - y) * 32 - camera.x) * camera.zoom + camera.width / 2 * (1 - camera.zoom),
    y: (80 + (x + y) * 16 - camera.y) * camera.zoom + camera.height / 2 * (1 - camera.zoom),
  };
}
async function clickEntity(page, entity) {
  const point = await screenPoint(page, entity.x, entity.y);
  await page.mouse.click(point.x, point.y - 30);
  await page.waitForFunction(id => window.editorDiagnostics?.()?.selected.includes(id), entity.id);
}
function placementCandidates(snapshot, hall) {
  const model = { content: originalBundle, players: snapshot.players };
  const hq = snapshot.entities.find(entity => entity.side === 0 && entity.role === 'hq' && entity.hp > 0);
  assert(hq, 'The normal mod match has a headquarters');
  const candidates = [], r = hall.size / 2;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const x = Math.floor(hq.x + dx) + 0.5, y = Math.floor(hq.y + dy) + 0.5;
    if (x - r < 0.5 || y - r < 0.5 || x + r > snapshot.width - 0.5 || y + r > snapshot.height - 0.5) continue;
    if (Math.hypot(dx, dy) + Math.SQRT2 * r > 8) continue;
    let ground = true;
    for (let ty = Math.floor(y - r); ty < Math.ceil(y + r); ty++) for (let tx = Math.floor(x - r); tx < Math.ceil(x + r); tx++) {
      if (!['grass', 'road'].includes(snapshot.terrain[ty * snapshot.width + tx])) ground = false;
    }
    if (!ground || snapshot.resources.some(resource => resource.amount > 0 && Math.abs(resource.x - x) < r + 0.8 && Math.abs(resource.y - y) < r + 0.8)) continue;
    if (snapshot.entities.some(entity => entity.hp > 0 && entity.kind === 'building' &&
      Math.abs(entity.x - x) < helpers.buildingFor(model, entity.side, entity.role, entity.definitionId).size / 2 + r + 0.4 &&
      Math.abs(entity.y - y) < helpers.buildingFor(model, entity.side, entity.role, entity.definitionId).size / 2 + r + 0.4)) continue;
    candidates.push({ x, y });
  }
  return candidates.sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y));
}

try {
  // This matches verify_community_browser.mjs: bundle the real server into an
  // ignored local directory so its external packages resolve through node_modules.
  await mkdir(path.join(root, 'dist-server'), { recursive: true });
  helperDir = await mkdtemp(path.join(root, 'dist-server/community-mod-proof-'));
  const entry = path.join(helperDir, 'entry.ts'), bundle = path.join(helperDir, 'entry.mjs');
  await writeFile(entry, [
    `export { createRtsServer } from ${JSON.stringify(path.join(root, 'src/server/server.ts'))};`,
    `export { decodeScenarioPackage } from ${JSON.stringify(path.join(root, 'src/editor/scenario-package.ts'))};`,
    `export { decodeContentPackage, createContentBundle, contentHash, buildingFor } from ${JSON.stringify(path.join(root, 'src/core/content-registry.ts'))};`,
  ].join('\n'));
  await promisify(execFile)(path.join(root, 'node_modules/.bin/esbuild'), [entry, '--bundle', '--platform=node', '--format=esm', '--packages=external', `--outfile=${bundle}`]);
  helpers = await import(pathToFileURL(bundle).href);
  const sourceText = await readFile(fixturePath, 'utf8');
  inputHashes[fixturePath] = sha(sourceText);
  original = helpers.decodeContentPackage(JSON.parse(sourceText));
  const dependencies = [];
  for (const file of dependencyPaths) { const input = path.resolve(file), bytes = await readFile(input); inputHashes[input] = sha(bytes); dependencies.push(helpers.decodeContentPackage(JSON.parse(bytes.toString()))); }
  // Default proof exercises recursive dependency downloads, using two small
  // faction-only manifests so Lantern's gameplay definitions stay unchanged.
  if (dependencies.length === 0 && original.dependencies.length === 0) {
    const support = (id, deps) => {
      const body = { format: original.format, schemaVersion: 1, engineVersion: original.engineVersion,
        id, version: '1.0.0', name: `Proof ${id}`, dependencies: deps,
        factions: [{ id: `${id}:helpers`, baseFaction: 'fairies', name: `Proof ${id}`, subtitle: 'Lantern dependency',
          description: 'Faction-only dependency for the native immutable installation proof.', color: 15973717, accent: '#f3bd55', units: [], buildings: [], research: [] }], art: {} };
      return helpers.decodeContentPackage({ ...body, hash: helpers.contentHash(body) });
    };
    const leaf = support('aaa-lantern-proof-leaf', []);
    const middle = support('aaa-lantern-proof-support', [{ id: leaf.id, version: leaf.version, hash: leaf.hash }]);
    dependencies.push(leaf, middle);
    const { hash: _hash, ...body } = original;
    body.dependencies = [{ id: middle.id, version: middle.version, hash: middle.hash }];
    original = helpers.decodeContentPackage({ ...body, hash: helpers.contentHash(body) });
  }
  originalBundle = helpers.createContentBundle([...dependencies, original]);
  if (!dependencyPaths.length) assert.notEqual(originalBundle.packages[0].id, original.id, 'Dependency ordering makes a bundle-first faction launch fail this proof');
  await save('mod-original.json', original);
  await save('expected-original-bundle.json', originalBundle);
  const faction = original.factions[0];
  const hall = faction.buildings.find(value => value.id === faction.defaultBuildings?.barracks);
  const recruits = faction.units.filter(value => value.role === 'melee').slice(0, 2);
  assert(hall && recruits.length === 2, 'The proof fixture needs a custom default barracks and two custom melee definitions');

  const unsigned = structuredClone(original);
  delete unsigned.hash;
  const version = original.version.split('.').map(Number);
  unsigned.version = `${version[0]}.${version[1]}.${version[2] + 1}`;
  unsigned.name = `${original.name} revised`;
  const revisedUnit = unsigned.factions[0].units.find(value => value.id === recruits[1].id);
  revisedUnit.damage += 1;
  revisedUnit.hp += 1;
  updated = helpers.decodeContentPackage({ ...unsigned, hash: helpers.contentHash(unsigned) });
  updatedBundle = helpers.createContentBundle([...dependencies, updated]);
  await save('mod-updated.json', updated);
  await save('expected-updated-bundle.json', updatedBundle);

  dataDir = await mkdtemp(path.join(tmpdir(), 'ovf-community-mod-'));
  server = await helpers.createRtsServer({ host: '127.0.0.1', port, dataDir, staticDir });
  base = server.url;
  browser = await chromium.launch({ headless: true });
  const publisher = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
  const receiver = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
  publisherPage = await publisher.newPage(); receiverPage = await receiver.newPage();
  for (const page of [publisherPage, receiverPage]) { page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message)); }
  const publisherBuild = await openWorkbench(publisherPage), receiverBuild = await openWorkbench(receiverPage);
  await promisify(execFile)(process.execPath, [path.join(root, 'scripts/verify_served_build.mjs'), `${base}/editor.html`, path.join(evidence, 'served-build.json'), staticDir], { cwd: root });
  const servedBuild = JSON.parse(await readFile(path.join(evidence, 'served-build.json'), 'utf8')); assert.equal(servedBuild.commit, source.sourcePin); assert.equal(servedBuild.sourceSha256, source.buildId);
  const suffix = Date.now().toString(36);
  const author = await register(publisherPage, `ModPublisher${suffix}`);
  publisherAccount = author;
  const viewer = await register(receiverPage, `ModReceiver${suffix}`);
  assert.notEqual(author.id, viewer.id);
  const publisherCookies = await publisher.cookies(base), receiverCookies = await receiver.cookies(base);
  assert.notEqual(publisherCookies.find(value => value.name === 'ovf_session')?.value, receiverCookies.find(value => value.name === 'ovf_session')?.value);
  const publisherAssets = await servedAssetHashes(publisherBuild), receiverAssets = await servedAssetHashes(receiverBuild);
  assert.deepEqual(receiverAssets, publisherAssets, 'Both browser profiles receive the same production entry assets');
  const sourceHead = await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: root });
  const sourceStatus = await promisify(execFile)('git', ['status', '--short'], { cwd: root });
  assert.equal(sourceHead.stdout.trim(), source.sourcePin);
  await save('production-build.json', { staticDir, publisherBuild, receiverBuild, source, scriptSha256, inputHashes, sourceCommit: sourceHead.stdout.trim(), sourceStatus: sourceStatus.stdout.trim(), servedEntryAssets: publisherAssets, serverBundleSha256: createHash('sha256').update(await readFile(bundle)).digest('hex') });
  checked('real temporary server serves production output to two independent authenticated profiles');

  const byId = new Map([...dependencies, original].map(pkg => [pkg.id, pkg])), published = new Set();
  async function publishClosure(pkg) {
    if (published.has(pkg.id)) return;
    for (const dependency of pkg.dependencies) await publishClosure(byId.get(dependency.id));
    const file = pkg === original ? path.join(evidence, 'mod-original.json') : path.join(evidence, `dependency-${pkg.id}.json`);
    if (pkg !== original) await save(`dependency-${pkg.id}.json`, pkg);
    const publication = await publishFile(file, pkg);
    await save(`publication-${pkg.id}-${pkg.version}.json`, publication);
    if (pkg === original) publishedOriginal = publication;
    published.add(pkg.id);
  }
  await publishClosure(original);
  checked('publisher uploads the exact validated mod and its pinned dependencies', { manifestHash: original.hash, downloadHash: publishedOriginal.detail.hash });
  await searchMod(receiverPage);
  await receiverPage.locator('.community-preview').getByText(`${faction.name}: ${faction.units.length} custom units and ${faction.buildings.length} buildings.`, { exact: true }).waitFor();
  const installedOriginal = await installRevision(receiverPage, publishedOriginal, original);
  assert.equal(installedOriginal.records.length, originalBundle.packages.length);
  checked('native installation preserves the recursive dependency graph', { packages: installedOriginal.records.map(record => ({ id: record.localId, version: record.version, dependencies: record.dependencies })) });
  await receiverPage.screenshot({ path: path.join(evidence, 'community-mod-preview.png'), fullPage: true });
  checked('receiver finds, recursively downloads, verifies and installs the exact root closure');

  const initial = await playInstalled(receiverPage, original, originalBundle);
  await save('community-mod-initial.json', initial);
  checked('ordinary installed-revision launch passes the custom faction, pinned bundle and art into the actual match', { tick: initial.tick, contentHash: initial.content.hash });
  const worker = initial.entities.filter(entity => entity.side === 0 && entity.role === 'worker' && entity.hp > 0).sort((a, b) => a.x - b.x)[0];
  assert(worker);
  await clickEntity(receiverPage, worker);
  const buildTab = receiverPage.locator('[data-mode="build"]');
  if (await buildTab.isVisible()) await buildTab.click();
  const candidates = placementCandidates(await diagnostics(receiverPage), hall);
  assert(candidates.length, 'An ordinary starting settlement has room for the custom hall');
  let producer;
  for (const point of candidates.slice(0, 12)) {
    await receiverPage.getByRole('button', { name: hall.name, exact: true }).click();
    const pixel = await screenPoint(receiverPage, point.x, point.y);
    await receiverPage.mouse.click(pixel.x, pixel.y);
    await receiverPage.waitForTimeout(100);
    producer = (await diagnostics(receiverPage)).entities.find(entity => entity.side === 0 && entity.definitionId === hall.id);
    if (producer) break;
    await receiverPage.keyboard.press('Escape');
  }
  assert(producer, 'The ordinary build control creates the custom hall');
  assert.equal(producer.maxHp, hall.hp);
  await receiverPage.waitForFunction(id => window.editorDiagnostics?.()?.entities.find(entity => entity.id === id)?.progress === 1, producer.id, { timeout: 45000 });
  producer = (await diagnostics(receiverPage)).entities.find(entity => entity.id === producer.id);
  await clickEntity(receiverPage, producer);
  assert.equal(await receiverPage.locator('#selection-name').innerText(), hall.name);
  const beforeRecruit = await diagnostics(receiverPage), beforeIds = new Set(beforeRecruit.entities.map(entity => entity.id));
  for (const recruit of recruits) await receiverPage.getByRole('button', { name: recruit.name, exact: true }).click();
  const queued = await diagnostics(receiverPage), queue = queued.entities.find(entity => entity.id === producer.id);
  assert.deepEqual(queue.queueDefinitionIds, recruits.map(value => value.id));
  for (const resource of ['wood', 'ore', 'crystal']) assert.equal(queued.players[0][resource], beforeRecruit.players[0][resource] - recruits.reduce((sum, recruit) => sum + recruit.cost[resource], 0));
  await save('community-mod-queued.json', queued);
  for (const recruit of recruits) await receiverPage.getByRole('button', { name: `Cancel ${recruit.name} in queue slot ${recruits.indexOf(recruit) + 1}`, exact: true }).waitFor();
  await receiverPage.waitForFunction(({ definitions, existing }) => definitions.every(id => window.editorDiagnostics?.()?.entities.some(entity => entity.side === 0 && entity.definitionId === id && entity.hp > 0 && !existing.includes(entity.id))), { definitions: recruits.map(value => value.id), existing: [...beforeIds] }, { timeout: 45000 });
  const trained = await diagnostics(receiverPage);
  for (const recruit of recruits) {
    const entity = trained.entities.find(value => value.side === 0 && value.definitionId === recruit.id && !beforeIds.has(value.id));
    assert(entity, `Normal production creates a new ${recruit.name}`);
    assert.equal(entity.maxHp, recruit.hp);
  }
  const secondRecruit = trained.entities.find(value => value.side === 0 && value.definitionId === recruits[1].id && !beforeIds.has(value.id));
  await clickEntity(receiverPage, secondRecruit);
  assert.equal(await receiverPage.locator('#selection-name').innerText(), recruits[1].name);
  const stats = await receiverPage.locator('#selection-stats span').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.firstChild.textContent.trim(), node.querySelector('b').textContent])));
  for (const [label, value] of [['ATK', recruits[1].damage], ['ARM', recruits[1].armor], ['RNG', recruits[1].range], ['SPD', recruits[1].speed]]) assert.equal(stats[label], String(value), `HUD displays ${label} ${value} from the authored definition`);
  assert.equal(await receiverPage.locator('#portrait').getAttribute('data-asset'), recruits[1].id);
  const portrait = await receiverPage.locator('#portrait img').evaluate(image => ({ alt: image.alt, src: image.src, decoded: image.complete && image.naturalWidth > 0 }));
  assert.equal(portrait.alt, recruits[1].name);
  assert(portrait.src.startsWith('data:image/svg+xml'));
  assert(portrait.decoded, 'The packaged custom SVG portrait decoded');
  const svgPayload = portrait.src.slice(portrait.src.indexOf(',') + 1);
  const svg = portrait.src.slice(0, portrait.src.indexOf(',')).includes(';base64') ? Buffer.from(svgPayload, 'base64').toString('utf8') : decodeURIComponent(svgPayload);
  assert.equal(svg, original.art[recruits[1].id].svg);
  await save('community-mod-trained.json', trained);
  await receiverPage.screenshot({ path: path.join(evidence, 'community-mod-trained.png'), fullPage: true });
  checked('ordinary custom producer trains two same-role definitions with authored costs, names, health, combat stats and SVG art');
  await receiverPage.locator('[data-session-tool="saves"]').click();
  const nativeDownloading = receiverPage.waitForEvent('download'); await receiverPage.getByRole('button', { name: 'Export save', exact: true }).click();
  await (await nativeDownloading).saveAs(path.join(evidence, 'community-mod-trained.save.json'));
  checkCurrentSession(JSON.parse(await readFile(path.join(evidence, 'community-mod-trained.save.json'), 'utf8')), source);
  const buildEvidence = {}; await downloadWorldBuildReport(receiverPage, { out: evidence, provenance: source }, 'community-mod-build-report.json', buildEvidence);
  await receiverPage.getByRole('button', { name: 'Close session tools', exact: true }).click();
  checked('installed mod match exports SAVE4, current replay rules and the frozen application build', { nativeExport: 'community-mod-trained.save.json', ...buildEvidence });

  publishedUpdated = await publishFile(path.join(evidence, 'mod-updated.json'), updated);
  assert.notEqual(publishedUpdated.detail.hash, publishedOriginal.detail.hash);
  assert(publishedUpdated.detail.revisions.some(revision => revision.version === original.version && revision.hash === publishedOriginal.detail.hash));
  await save('publication-updated.json', publishedUpdated);
  await openCommunity(receiverPage);
  await searchMod(receiverPage);
  await installRevision(receiverPage, publishedUpdated, updated);
  const revised = await playInstalled(receiverPage, updated, updatedBundle);
  assert.deepEqual(revised.content.packages.find(pkg => pkg.id === updated.id), updated);
  await save('community-mod-updated-revision-match.json', revised);
  checked('the revised mod launches its changed definitions and exact dependency closure');
  await openCommunity(receiverPage);
  await searchMod(receiverPage);
  await receiverPage.getByLabel('Published revision', { exact: true }).selectOption(original.version);
  const installed = await receiverPage.locator('.community-installed').innerText();
  assert(installed.includes(`version ${original.version}`) && installed.includes(`version ${updated.version}`));
  await receiverPage.screenshot({ path: path.join(evidence, 'community-mod-pinned-revisions.png'), fullPage: true });
  const pinned = await playInstalled(receiverPage, original, originalBundle);
  assert.deepEqual(pinned.content.packages.find(pkg => pkg.id === original.id), original);
  assert(!pinned.content.packages.some(pkg => pkg.id === original.id && pkg.version === updated.version));
  await save('community-mod-old-revision-match.json', pinned);
  checked('installing a changed revision preserves the old installed package and its exact launch closure');

  await receiverPage.getByRole('button', { name: 'Map and scenario editor', exact: true }).click();
  await receiverPage.getByRole('tab', { name: 'Scenario editor', exact: true }).click();
  await receiverPage.getByLabel('Scenario content', { exact: true }).selectOption(publishedOriginal.detail.hash);
  await receiverPage.getByRole('button', { name: 'Use selected scenario content', exact: true }).click();
  await receiverPage.getByLabel('Player faction', { exact: true }).selectOption(original.factions[0].id);
  for (const [name, value] of [['Scenario ID', `lantern-mission-${suffix}`], ['Scenario title', 'Pinned Lantern survival'], ['Actor 1 custom definition ID', recruits[1].id], ['Objective 1 success seconds', '2']]) {
    const field = receiverPage.getByLabel(name, { exact: true }); await field.fill(value); await field.press('Tab');
  }
  const scenarioDownloading = receiverPage.waitForEvent('download');
  await receiverPage.getByRole('button', { name: 'Export scenario', exact: true }).click();
  const scenarioFile = path.join(evidence, 'authored-pinned-lantern-scenario.json');
  await (await scenarioDownloading).saveAs(scenarioFile);
  const scenarioPackage = helpers.decodeScenarioPackage(JSON.parse(await readFile(scenarioFile, 'utf8')));
  assert.equal(scenarioPackage.simulationVersion, source.saveVersion); assert.equal(scenarioPackage.map.simulationVersion, source.saveVersion);
  assert.deepEqual(scenarioPackage.scenario.content, originalBundle);
  assert.equal(scenarioPackage.scenario.army[0].definitionId, recruits[1].id);
  const scenarioPublication = await publishFile(scenarioFile, scenarioPackage);
  await save('published-pinned-lantern-scenario.json', scenarioPublication);
  await receiverPage.getByRole('button', { name: 'Close editor', exact: true }).click();
  await openCommunity(receiverPage);
  await receiverPage.getByLabel('Search packages', { exact: true }).fill(scenarioPackage.scenario.id);
  await receiverPage.getByLabel('Package kind', { exact: true }).selectOption('scenario');
  const scenarioSearch = receiverPage.waitForResponse(response => new URL(response.url()).pathname === '/api/packages' && new URL(response.url()).searchParams.get('kind') === 'scenario');
  await receiverPage.getByRole('button', { name: 'Search community', exact: true }).click(); assert.equal((await scenarioSearch).status(), 200);
  await receiverPage.locator('.community-results article').getByRole('button', { name: 'View package', exact: true }).click();
  await receiverPage.locator('.community-details').getByRole('button', { name: 'Download and install', exact: true }).click();
  await receiverPage.locator('.community-status').filter({ hasText: 'Installed Pinned Lantern survival, version 1.' }).waitFor();
  await receiverPage.locator('.community-details').getByRole('button', { name: 'Play installed revision', exact: true }).click();
  await receiverPage.waitForFunction(hash => window.editorDiagnostics?.()?.packageHash === hash && window.editorDiagnostics().scenario?.runtime.outcome === 'won', scenarioPackage.hash, { timeout: 20000 });
  const playedScenario = await diagnostics(receiverPage);
  assert.deepEqual(playedScenario.content, originalBundle);
  assert.deepEqual(playedScenario.scenario.definition.content, originalBundle);
  const actor = playedScenario.entities.find(entity => entity.id === playedScenario.scenario.runtime.labels.commander);
  assert.equal(actor.definitionId, recruits[1].id); assert.equal(actor.maxHp, recruits[1].hp);
  await receiverPage.waitForFunction(reason => document.querySelector('#overlay-description')?.textContent === reason, playedScenario.scenario.runtime.reason);
  assert.equal(await receiverPage.locator('#overlay-description').innerText(), playedScenario.scenario.runtime.reason);
  assert(!(await receiverPage.locator('#overlay-description').innerText()).includes('stronghold'));
  await save('played-pinned-lantern-scenario.json', playedScenario);
  await receiverPage.screenshot({ path: path.join(evidence, 'pinned-lantern-scenario-victory.png'), fullPage: true });
  checked('native authoring, remote publication, installation and scenario launch preserve the old mod closure and custom actor definition');
  assert.deepEqual(await worldSourceProof(source.sourcePin), source, 'Source changed during community mod proof');
  for (const [input, digest] of Object.entries(inputHashes)) assert.equal(sha(await readFile(input)), digest, `Mod input changed during proof: ${input}`);
  assert.deepEqual(errors, []);
  checked('both production browser profiles have no uncaught errors');
} catch (error) {
  failure = String(error);
  for (const [label, page] of [['publisher', publisherPage], ['receiver', receiverPage]]) if (page) {
    await page.screenshot({ path: path.join(evidence, `community-mod-${label}-failure.png`), fullPage: true }).catch(() => {});
    await save(`community-mod-${label}-failure.json`, { diagnostics: await diagnostics(page).catch(() => null), status: await page.locator('.community-status, .notice').allTextContents().catch(() => []) });
  }
  throw error;
} finally {
  await save('result.json', { base, staticDir, fixturePath, source, scriptSha256, inputHashes, results, errors, failure, checkedAt: new Date().toISOString(), scope: 'Temporary local real server and production browsers; community publication, immutable installation, normal mod play/build/train, exact pinned root closure and authored custom-content scenario publication/install/play.' });
  await browser?.close();
  await server?.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (helperDir) await rm(helperDir, { recursive: true, force: true });
}
