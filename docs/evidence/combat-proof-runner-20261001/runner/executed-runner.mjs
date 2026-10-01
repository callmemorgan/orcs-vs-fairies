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

// Seal after the parent builds and regenerates fixtures from its frozen source.
// This binds input bytes for the run; generator execution provenance is recorded separately.
if (process.argv[2] === '--freeze') {
  const [, , , rootArg, fixturesArg, outputArg, commit] = process.argv;
  assert(rootArg && fixturesArg && outputArg && commit, 'Use --freeze ROOT FIXTURES NEW_CONTRACT FULL_COMMIT');
  const output = resolve(outputArg), fixtureDirectory = resolve(fixturesArg);
  assert(!output.startsWith(`${fixtureDirectory}${sep}`), 'Seal contract must be outside the frozen fixture directory');
  const frozen = await captureFreeze(resolve(rootArg), fixtureDirectory, commit);
  await writeFile(output, `${JSON.stringify(frozen, null, 2)}\n`, { flag: 'wx' });
  console.log(`Sealed SAVE${frozen.source.saveVersion} combat proof inputs at ${commit}`); process.exit(0);
}

// Run against the assembled production root. No fixture routes, browser state
// writes, private scene calls, simulated commands or callback replacements.
const base = process.argv[2] ?? 'http://127.0.0.1:5397';
const root = resolve(process.argv[3] ?? '.');
const out = resolve(process.env.OVF_COMBAT_EVIDENCE ?? `${root}/docs/evidence/assembled-combat-20261001`);
const fixtures = resolve(process.env.OVF_COMBAT_FIXTURES ?? `${out}/fixtures`);
assert(out !== fixtures && !out.startsWith(`${fixtures}${sep}`), 'Native evidence output must be outside frozen fixtures');
assert(process.env.OVF_COMBAT_FREEZE, 'Seal inputs with --freeze and pass OVF_COMBAT_FREEZE before final browser proof');
const freezePath = resolve(process.env.OVF_COMBAT_FREEZE);
const freezeBytes = await readFile(freezePath);
const frozen = JSON.parse(freezeBytes.toString('utf8'));
await assertFreeze(root, fixtures, frozen);
const identity = { saveVersion: frozen.source.saveVersion, simulationRevision: frozen.source.simulationRevision };
const expectedBuildId = frozen.source.expectedBuildId;
const manifest = JSON.parse(await readFile(`${fixtures}/manifest.json`, 'utf8'));
const distHtml = await readFile(`${root}/dist/index.html`), declaredAssets = htmlAssets(distHtml.toString('utf8'), base);
const evidence = {
  completed: false, base, startedAt: new Date().toISOString(), setup: manifest.setup,
  source: { ...frozen.source, sealedContractSha256: digest(freezeBytes), executedRunnerSha256: frozen.executedRunnerSha256, distHtmlSha256: digest(distHtml) },
  checks: [], downloads: {}, servedAssets: [], assetFailures: [], errors: [],
};
await mkdir(out, { recursive: true });
await writeFile(`${out}/browser-combined-combat.json`, JSON.stringify(evidence, null, 2), { flag: 'wx' });
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true, serviceWorkers: 'block' });
const page = await context.newPage();
page.on('pageerror', error => evidence.errors.push(error.message));
const origin = new URL(base).origin, capturedAssets = new Set(), assetPromises = [];
const pinnedAssets = new Map(frozen.dist.map(file => [file.path, file]));
const captureAsset = response => {
  const type = response.request().resourceType(), url = new URL(response.url());
  if (!['script', 'stylesheet'].includes(type) && !/\.(js|css)$/.test(url.pathname)) return;
  assetPromises.push((async () => {
    assert.equal(url.origin, origin, `Executed asset must be same-origin and frozen: ${url.href}`);
    const path = decodeURIComponent(url.pathname).replace(/^\//, '');
    assert(response.ok(), `Executed asset response must succeed: ${url.href}`);
    const bytes = await response.body(), pinned = pinnedAssets.get(path);
    assertAssetBytes(bytes, pinned, url.href);
    assert.deepEqual(bytes, await readFile(safePath(`${root}/dist`, path)), `${url.href} executed bytes must equal frozen dist`);
    capturedAssets.add(url.href);
    evidence.servedAssets.push({ url: url.href, path, resourceType: type, bytes: bytes.length, sha256: digest(bytes) });
  })().catch(error => evidence.assetFailures.push(String(error.stack ?? error))));
};
page.on('response', captureAsset);
page.on('requestfailed', request => {
  if (['script', 'stylesheet'].includes(request.resourceType()) || /\.(js|css)$/.test(new URL(request.url()).pathname)) evidence.assetFailures.push(`${request.url()}: ${request.failure()?.errorText ?? 'asset request failed'}`);
});
async function verifyServedAssets() {
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  let settled = 0;
  while (settled < assetPromises.length) { const count = assetPromises.length; await Promise.all(assetPromises.slice(settled, count)); settled = count; }
  page.off('response', captureAsset);
  assert.deepEqual(evidence.assetFailures, [], 'All executed scripts/stylesheets must match frozen dist bytes');
  for (const url of declaredAssets) assert(capturedAssets.has(url), `Production HTML asset must have an observed matching response: ${url}`);
}
let phase = 'open production application';
const sessions = page.getByRole('dialog', { name: 'Session tools', exact: true });
const tactics = page.getByLabel('Army tactics controls', { exact: true });
const faction = page.getByLabel('Faction power controls', { exact: true });
const snap = () => page.evaluate(() => {
  const r = window.rts, s = r.state;
  return JSON.parse(JSON.stringify({ tick: s.tick, time: s.time, entities: s.entities, players: s.players, world: s.world, specialists: s.specialists, projectiles: s.projectiles, factionSystems: s.factionSystems, selected: r.selected, mode: r.mode, viewLevel: r.viewLevel, paused: r.paused, art: r.art }));
});
const ready = () => page.waitForFunction(() => {
  try { return document.querySelector('.loading-battle')?.hidden && !!window.rts?.camera && !!document.querySelector('#game-canvas canvas') && window.rts.art.loaded; } catch { return false; }
}, null, { timeout: 60000 });
const wait = (predicate, arg, timeout = 15000) => page.waitForFunction(predicate, arg, { timeout, polling: 20 });
function entity(state, id) { const found = state.entities.find(e => e.id === id); assert(found, `Expected entity #${id}`); return found; }
function record(name, observed) { evidence.checks.push({ name, ...observed }); console.log(`PASS ${name}`); }
async function screenshot(name) { await freshArtifact(`${out}/${name}.png`); await page.mouse.move(720, 140); await page.screenshot({ path: `${out}/${name}.png` }); }
async function closePanels() {
  const closeTactics = page.getByRole('button', { name: 'Close army tactics', exact: true });
  if (await closeTactics.isVisible()) await closeTactics.click();
  const closeFaction = page.getByRole('button', { name: 'Close faction powers', exact: true });
  if (await closeFaction.isVisible()) await closeFaction.click();
}
async function closeSessions() { if (await sessions.isVisible()) await sessions.getByRole('button', { name: 'Close session tools', exact: true }).click(); }
async function openSessions(tab) {
  await closePanels();
  if (await sessions.isVisible()) await page.locator(`[data-session-tab="${tab}"]`).click();
  else await page.locator(`[data-session-tool="${tab}"]`).click();
  await sessions.waitFor({ state: 'visible' }); await wait(() => window.rts.paused);
}
let importCount = 0;
async function importSave(path, name) {
  phase = `native import ${name}`; await openSessions('saves');
  const file = JSON.parse(await readFile(path, 'utf8')); assertSessionIdentity(file, name, identity);
  await sessions.getByLabel('Import save JSON', { exact: true }).setInputFiles(path);
  await sessions.getByRole('button', { name: 'Import save', exact: true }).click();
  await wait(() => document.querySelector('[aria-label="Import save JSON"]')?.files?.length === 0 && [...document.querySelectorAll('.session-notice')].some(e => !e.hidden && e.textContent === 'Save loaded.'), null, 60000);
  await ready(); const state = await snap();
  assert.equal(state.tick, file.game.state.tick); assert.equal(state.mode, 'local');
  assert.equal(state.world.levels.length, 2); assert(state.entities.some(e => e.side === 0 && e.level === 1));
  const native = await exportSave(`native-import-${++importCount}`);
  comparePersisted(native.game, file.game, `${name} native import`);
  return { file, state, native };
}
async function loadScenario(name) {
  const scenario = manifest.scenarios[name], path = `${fixtures}/${scenario.file}`;
  const { state } = await importSave(path, name);
  record(`Native session import preserves ${name} authored world and underground troop`, { tick: state.tick, scenarioSha256: digest(await readFile(path)), authored: scenario.authored });
  await closeSessions(); return scenario.ids;
}
async function openWorld() {
  const world = page.locator('.world-tools'); await world.waitFor({ state: 'visible' });
  if (await world.getAttribute('open') === null) await page.locator('.world-tools > summary').click();
  return world;
}
async function selectTroop(id) {
  await closePanels(); const world = await openWorld();
  const summary = world.getByText('Owned troops by level', { exact: true }), list = summary.locator('..');
  if (await list.getAttribute('open') === null) await summary.click();
  await list.getByRole('button', { name: new RegExp(`^[a-z]+ #${id} `) }).click();
  await wait(id => window.rts.selected.length === 1 && window.rts.selected[0] === id, id);
}
async function openTactics() { await closePanels(); await page.locator('[data-tactics-launch]').click(); await tactics.waitFor({ state: 'visible' }); }
async function openFaction() { await closePanels(); await page.locator('[data-faction-launch]').click(); await faction.waitFor({ state: 'visible' }); }
async function download(buttonName, filename) {
  await freshArtifact(`${out}/${filename}`);
  const pending = page.waitForEvent('download'); await sessions.getByRole('button', { name: buttonName, exact: true }).click();
  const file = await pending; await file.saveAs(`${out}/${filename}`);
  const bytes = await readFile(`${out}/${filename}`); evidence.downloads[filename] = { sha256: digest(bytes), bytes: bytes.length };
  return JSON.parse(bytes.toString('utf8'));
}
async function exportSave(name) {
  await openSessions('saves');
  const file = await download('Export save', `${name}-save.json`);
  assertSessionIdentity(file, name, identity, true); return file;
}
async function persistence(name, saved, replay = true) {
  phase = `${name} save round trip`;
  const { state: imported, native: restored } = await importSave(`${out}/${name}-save.json`, `${name} exported save`);
  comparePersisted(restored.game, saved.game, name);
  record(`${name} native exported save restores the complete saved state and runtime`, { tick: imported.tick, gameSha256: digest(JSON.stringify(restored.game)) });
  if (replay) {
    assert(saved.replay); await openSessions('replay');
    const exported = await download('Export replay', `${name}-replay.json`);
    compareReplayExport(exported, saved.replay, name, identity);
    await sessions.getByLabel('Import replay JSON', { exact: true }).setInputFiles(`${out}/${name}-replay.json`);
    await sessions.getByRole('button', { name: 'Import replay', exact: true }).click();
    await wait(() => document.querySelector('[aria-label="Import replay JSON"]')?.files?.length === 0 && [...document.querySelectorAll('.session-notice')].some(e => !e.hidden && e.textContent === 'Replay loaded.'), null, 60000);
    await wait(() => window.rts?.mode === 'replay', null, 60000); await ready();
    const slider = sessions.getByLabel('Replay tick', { exact: true }); await slider.press('End');
    await wait(tick => window.rts.state.tick === tick, exported.finalTick, 60000);
    const replayed = await snap(), endpoint = await exportSave(`${name}-replay-endpoint`);
    comparePersisted(endpoint.game, saved.game, `${name} replay`);
    record(`${name} native replay reaches the complete matching saved state and runtime`, { tick: replayed.tick, checksum: exported.finalChecksum, commands: exported.actions.filter(a => a.type === 'command').map(a => a.command.type) });
    await closeSessions(); await screenshot(`${name}-replay`);
  }
}

try {
  const response = await page.goto(base); assert(response?.ok());
  const servedHtml = await response.body();
  assert.deepEqual(servedHtml, distHtml, 'Navigation must execute the frozen production HTML');
  evidence.source.servedHtmlSha256 = digest(servedHtml);
  assert.equal(evidence.source.servedHtmlSha256, evidence.source.distHtmlSha256, 'Server must serve the current production dist/index.html');
  await page.locator('.begin-match').click(); await ready();

  let ids = await loadScenario('orcs-formation');
  phase = 'formations through tactics panel';
  await page.locator('#game-canvas canvas').click({ position: { x: 850, y: 500 } }); await page.keyboard.press('F2');
  await wait(ids => ids.length === window.rts.selected.length && ids.every(id => window.rts.selected.includes(id)), ids.army);
  await openTactics(); await tactics.getByLabel('Troop facing', { exact: true }).selectOption('6'); await tactics.getByLabel('Formation spacing', { exact: true }).fill('1.4');
  const initial = await snap();
  for (const kind of ['line', 'wedge', 'square', 'loose']) {
    await tactics.getByRole('button', { name: kind[0].toUpperCase() + kind.slice(1), exact: true }).click();
    await wait(({ ids, kind }) => ids.every(id => { const f = window.rts.state.entities.find(e => e.id === id)?.tactics?.formation; return f?.kind === kind && f.facing === 6 && f.spacing === 1.4 && f.count === ids.length; }), { ids: ids.army, kind });
    record(`${kind} formation reaches selected army through Tactics controls`, { tick: (await snap()).tick, army: ids.army, facing: 6, spacing: 1.4 });
    if (kind === 'line') {
      await wait(({ ids, initial }) => ids.some(id => { const current = window.rts.state.entities.find(e => e.id === id), before = initial.find(e => e.id === id); return Math.hypot(current.x - before.x, current.y - before.y) > .25; }), { ids: ids.army, initial: initial.entities });
      await screenshot('orcs-line-formation');
    }
  }
  await tactics.getByRole('button', { name: 'Apply facing', exact: true }).click();
  await wait(ids => ids.every(id => window.rts.state.entities.find(e => e.id === id)?.facing === 6), ids.army);
  assert.match(await tactics.getByLabel('Selected unit tactics', { exact: true }).innerText(), /Morale/);
  await screenshot('orcs-loose-formation');
  const formationSave = await exportSave('orcs-formation');
  await persistence('orcs-formation', formationSave);

  ids = await loadScenario('orcs-rally');
  phase = 'low morale retreat and standard rally';
  await wait(id => !!window.rts.state.entities.find(e => e.id === id)?.tactics?.retreat, ids.retreater);
  const retreating = entity(await snap(), ids.retreater); assert(retreating.tactics.morale < 22);
  record('Wounded isolated warrior enters a real low morale retreat', { entity: retreating });
  await selectTroop(ids.bearer); await openFaction();
  const beforeChants = await snap(); assert.equal(beforeChants.factionSystems.fury[0], 50); assert.equal(entity(beforeChants, ids.bearer).factionState.trophyKills, 2);
  await faction.getByRole('button', { name: 'Assault chant', exact: true }).click();
  await wait(id => window.rts.state.entities.find(e => e.id === id)?.factionState?.chant?.kind === 'assault', ids.bearer);
  const assault = await snap(); assert.equal(assault.factionSystems.fury[0], 25);
  await faction.getByRole('button', { name: 'Bulwark chant', exact: true }).click();
  await wait(id => window.rts.state.entities.find(e => e.id === id)?.factionState?.chant?.kind === 'bulwark', ids.bearer);
  const bulwark = await snap(); assert.equal(bulwark.factionSystems.fury[0], 0);
  record('Assault and Bulwark chants each spend 25 authored Fury through Faction controls', { before: beforeChants.factionSystems, after: bulwark.factionSystems, bearer: entity(bulwark, ids.bearer) });
  await faction.getByRole('button', { name: 'Raise trophy standard', exact: true }).click();
  await wait(id => window.rts.state.entities.find(e => e.id === id)?.factionState?.trophyKills === 0 && window.rts.state.entities.some(e => e.definitionId === 'core:orcs-trophy-standard' && e.progress === 1), ids.bearer);
  const raised = await snap(), standard = raised.entities.find(e => e.definitionId === 'core:orcs-trophy-standard');
  record('Trophy standard consumes two authored trophies and creates a completed production structure', { standard, bearer: entity(raised, ids.bearer) });
  await screenshot('orcs-chants-and-standard');
  await wait(id => { const e = window.rts.state.entities.find(e => e.id === id); return !e.tactics.retreat && e.tactics.morale >= 30 && e.x < 20; }, ids.retreater, 20000);
  await selectTroop(ids.retreater); await openTactics(); const rallied = entity(await snap(), ids.retreater);
  assert.match(await tactics.getByLabel('Selected unit tactics', { exact: true }).innerText(), /Morale/);
  record('Retreating warrior recovers morale near allied support and standard, then returns to holding', { before: retreating, after: rallied }); await screenshot('orcs-morale-rallied');
  await wait(id => !window.rts.state.entities.find(e => e.id === id)?.factionState?.chant, ids.bearer, 15000);
  record('War chant expires during real running production ticks', { tick: (await snap()).tick });
  const rallySave = await exportSave('orcs-rally'); await persistence('orcs-rally', rallySave);

  ids = await loadScenario('dwarves'); phase = 'paid deployed cannon and workshop fitting';
  await selectTroop(ids.cannon); const unloaded = await snap();
  await page.getByRole('button', { name: 'Deploy Ammunition', exact: true }).click();
  await wait(id => { const e = window.rts.state.entities.find(e => e.id === id); return e.siegeMode?.deployed && e.siegeMode.ammo === 5; }, ids.cannon);
  const loaded = await snap(); assert.equal(unloaded.players[0].ore - loaded.players[0].ore, 15);
  await openFaction(); await faction.getByRole('button', { name: 'Stone shot', exact: true }).click();
  await wait(id => window.rts.state.entities.find(e => e.id === id)?.factionState?.artillery === 'stone', ids.cannon);
  const fitted = await snap(); assert.equal(loaded.players[0].wood - fitted.players[0].wood, 25); assert.equal(loaded.players[0].ore - fitted.players[0].ore, 20);
  record('Deepforge specialist cannon loads five shells for 15 ore and fits stone for 25 wood / 20 ore', { cannon: entity(fitted, ids.cannon), resourcesBefore: unloaded.players[0], resourcesAfter: fitted.players[0] });
  await screenshot('dwarves-loaded-stone-cannon'); await closePanels(); const world = await openWorld();
  const row = world.locator('.world-row').filter({ has: page.getByText(`Bridge #${ids.bridge}`, { exact: true }) });
  await row.getByRole('button', { name: 'Attack bridge', exact: true }).click();
  await wait(id => window.rts.state.specialists?.shots?.some(shot => shot.source.id === id && shot.payload.kind === 'cannon' && shot.modification === 'stone' && shot.impactAt > window.rts.state.time), ids.cannon);
  // Opening the real Session tools pauses before impact. This captures the shot
  // that was launched through World tools rather than manufacturing pending data.
  const flightSave = await exportSave('dwarves-in-flight');
  const pending = flightSave.game.state.specialists.shots.find(shot => shot.source.id === ids.cannon);
  assert(pending); assert.equal(pending.modification, 'stone'); assert.equal(pending.payload.kind, 'cannon'); assert.equal(pending.target.level, 0);
  assert.equal(entity(flightSave.game.state, ids.cannon).siegeMode.ammo, 4);
  assert.equal(flightSave.game.state.world.bridges.find(b => b.id === ids.bridge).hp, 1000);
  record('World tools bridge order launches fitted specialist projectile and consumes one real shell', { tick: flightSave.game.state.tick, pending, cannon: entity(flightSave.game.state, ids.cannon) });
  await persistence('dwarves-in-flight', flightSave);
  await importSave(`${out}/dwarves-in-flight-save.json`, 'dwarf pending impact'); await closeSessions();
  await wait(id => window.rts.state.world.bridges.find(b => b.id === id).hp < 1000, ids.bridge);
  const impacted = await snap(), bridge = impacted.world.bridges.find(b => b.id === ids.bridge);
  assert.equal(entity(impacted, ids.cannon).siegeMode.ammo, 4); assert.equal(impacted.specialists.shots.length, 0);
  assert(bridge.hp > 0 && bridge.hp < 1000);
  record('Imported in-flight cannon shell resolves against the real world bridge once', { tick: impacted.tick, bridge, cannon: entity(impacted, ids.cannon) });
  await selectTroop(ids.cannon); await page.getByRole('button', { name: 'Hold position', exact: true }).click();
  await wait(id => window.rts.state.entities.find(e => e.id === id)?.order.type === 'hold', ids.cannon);
  await screenshot('dwarves-world-bridge-impact');
  const impactSave = await exportSave('dwarves-impact'); await persistence('dwarves-impact', impactSave);

  ids = await loadScenario('automata'); phase = 'worker constructs connected power relay';
  await wait(id => window.rts.state.entities.find(e => e.id === id)?.factionState?.power?.connected === false, ids.tower);
  await selectTroop(ids.worker); await openFaction();
  await faction.getByLabel('Faction destination X', { exact: true }).fill(String(ids.placement.x)); await faction.getByLabel('Faction destination Y', { exact: true }).fill(String(ids.placement.y)); await faction.getByLabel('Faction destination level', { exact: true }).selectOption('0');
  const beforeRelay = await snap(); await faction.getByRole('button', { name: 'Build power relay', exact: true }).click();
  await wait(() => window.rts.state.entities.some(e => e.definitionId === 'core:automata-power-relay' && e.progress < 1));
  const building = await snap(), relay = building.entities.find(e => e.definitionId === 'core:automata-power-relay');
  assert.equal(beforeRelay.players[0].wood - building.players[0].wood, 70); assert.equal(beforeRelay.players[0].ore - building.players[0].ore, 30); assert.equal(beforeRelay.players[0].crystal - building.players[0].crystal, 10);
  assert.equal(entity(building, ids.worker).order.target, relay.id);
  record('Faction destination controls pay for Power Relay and assign the selected worker construction', { relay, worker: entity(building, ids.worker) });
  await screenshot('automata-relay-construction');
  await wait(({ relay, tower }) => window.rts.state.entities.find(e => e.id === relay)?.progress === 1 && window.rts.state.entities.find(e => e.id === tower)?.factionState?.power?.connected === true, { relay: relay.id, tower: ids.tower }, 30000);
  const powered = await snap(); assert.equal(entity(powered, ids.tower).factionState.power.root, ids.hq);
  assert.match(await faction.getByLabel('Owned faction structures', { exact: true }).innerText(), /Power Relay/);
  record('Completed production relay connects remote tower to headquarters', { relay: entity(powered, relay.id), tower: entity(powered, ids.tower), hq: ids.hq }); await screenshot('automata-relay-connected');
  const relaySave = await exportSave('automata-relay'); await persistence('automata-relay', relaySave);

  phase = 'verify served build identity through native bug report';
  await importSave(`${out}/automata-relay-save.json`, 'final connected relay'); await openSessions('report');
  await sessions.getByLabel('Bug description', { exact: true }).fill('Combined production proof: formations, low morale retreat and rally, Orc chants and trophy standard, paid fitted cannon world bridge impact with pending save/replay persistence, and worker-built Automata relay.');
  await sessions.getByRole('button', { name: 'Preview report', exact: true }).click();
  await wait(() => !!document.querySelector('[aria-label="Report JSON preview"]')?.value);
  const report = await download('Download bug report', 'production-build-report.json');
  assert.equal(report.versions.buildId, expectedBuildId, 'Production source build identity must match all current src files');
  assert.equal(report.versions.save, identity.saveVersion); assert.equal(report.versions.replaySimulation, identity.saveVersion);
  assert.equal(report.versions.replay, 1); assert.equal(report.versions.simulationRevision, identity.simulationRevision);
  assertSessionIdentity(report.session, 'Native bug report', identity, true);
  comparePersisted(report.session.game, relaySave.game, 'Native bug report');
  record('Native bug report confirms served production build identity and matching recorded session', { buildId: report.versions.buildId, tick: report.session.game.state.tick });
  await verifyServedAssets(); await assertFreeze(root, fixtures, frozen);
  assert.deepEqual(await readFile(freezePath), freezeBytes, 'Sealed contract must remain unchanged');
  for (const [name, fingerprint] of Object.entries(evidence.downloads)) assertAssetBytes(await readFile(`${out}/${name}`), fingerprint, `Native download ${name}`);
  assert.deepEqual(evidence.errors, []); evidence.completed = true; evidence.completedAt = new Date().toISOString();
  await writeFile(`${out}/browser-combined-combat.json`, JSON.stringify(evidence, null, 2));
  console.log(`Verified ${evidence.checks.length} combined production behaviors. Evidence: ${out}`);
} catch (error) {
  evidence.failure = { phase, message: String(error.stack ?? error) };
  try { evidence.lastState = await snap(); await screenshot('combined-combat-failure'); } catch {}
  await writeFile(`${out}/browser-combined-combat.json`, JSON.stringify(evidence, null, 2)); throw error;
} finally { await context.close(); await browser.close(); }
