import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run against the assembled production root. No fixture routes, browser state
// writes, private scene calls, simulated commands or callback replacements.
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5397';
const root = resolve(process.argv[3] ?? '.');
const out = resolve(process.env.OVF_COMBAT_EVIDENCE ?? `${root}/docs/evidence/assembled-combat-20261001`);
const fixtures = resolve(process.env.OVF_COMBAT_FIXTURES ?? `${out}/fixtures`);
const manifest = JSON.parse(await readFile(`${fixtures}/manifest.json`, 'utf8'));
await mkdir(out, { recursive: true });
const digest = data => createHash('sha256').update(data).digest('hex');
const sourceFiles = (await readdir(`${root}/src`, { recursive: true })).filter(p => /\.(ts|css)$/.test(p)).sort();
const buildHash = createHash('sha256');
for (const path of sourceFiles) { buildHash.update(path); buildHash.update(await readFile(`${root}/src/${path}`)); }
const expectedBuildId = buildHash.digest('hex');
const evidence = {
  completed: false, base, startedAt: new Date().toISOString(), setup: manifest.setup,
  source: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), status: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(), expectedBuildId, distHtmlSha256: digest(await readFile(`${root}/dist/index.html`)) },
  checks: [], downloads: {}, errors: [],
};
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', error => evidence.errors.push(error.message));
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
async function screenshot(name) { await page.mouse.move(720, 140); await page.screenshot({ path: `${out}/${name}.png` }); }
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
async function importSave(path, name) {
  phase = `native import ${name}`; await openSessions('saves');
  const file = JSON.parse(await readFile(path, 'utf8'));
  await sessions.getByLabel('Import save JSON', { exact: true }).setInputFiles(path);
  await sessions.getByRole('button', { name: 'Import save', exact: true }).click();
  await wait(() => [...document.querySelectorAll('.session-notice')].some(e => !e.hidden && e.textContent === 'Save loaded.'), null, 60000);
  await ready(); const state = await snap();
  assert.equal(state.tick, file.game.state.tick); assert.equal(state.mode, 'local');
  assert.equal(state.world.levels.length, 2); assert(state.entities.some(e => e.side === 0 && e.level === 1));
  return { file, state };
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
  const pending = page.waitForEvent('download'); await sessions.getByRole('button', { name: buttonName, exact: true }).click();
  const file = await pending; await file.saveAs(`${out}/${filename}`);
  const bytes = await readFile(`${out}/${filename}`); evidence.downloads[filename] = { sha256: digest(bytes), bytes: bytes.length };
  return JSON.parse(bytes.toString('utf8'));
}
async function exportSave(name) { await openSessions('saves'); return download('Export save', `${name}-save.json`); }
function comparePersisted(actual, expected, name) {
  for (const key of ['tick', 'time', 'entities', 'players', 'world', 'specialists', 'projectiles', 'factionSystems']) assert.deepEqual(actual[key], expected[key], `${name} restores state.${key}`);
}
async function persistence(name, saved, replay = true) {
  phase = `${name} save round trip`;
  const { state: imported } = await importSave(`${out}/${name}-save.json`, `${name} exported save`);
  comparePersisted(imported, saved.game.state, name);
  record(`${name} native exported save restores exact combat, faction and layered world fields`, { tick: imported.tick });
  if (replay) {
    assert(saved.replay); await openSessions('replay');
    const exported = await download('Export replay', `${name}-replay.json`);
    assert.equal(exported.finalChecksum, saved.replay.finalChecksum); assert.deepEqual(exported.actions, saved.replay.actions);
    await sessions.getByLabel('Import replay JSON', { exact: true }).setInputFiles(`${out}/${name}-replay.json`);
    await sessions.getByRole('button', { name: 'Import replay', exact: true }).click();
    await wait(() => window.rts?.mode === 'replay', null, 60000); await ready();
    const slider = sessions.getByLabel('Replay tick', { exact: true }); await slider.press('End');
    await wait(tick => window.rts.state.tick === tick, exported.finalTick, 60000);
    const replayed = await snap(); comparePersisted(replayed, saved.game.state, `${name} replay`);
    record(`${name} native replay reaches matching final combat and faction state`, { tick: replayed.tick, checksum: exported.finalChecksum, commands: exported.actions.filter(a => a.type === 'command').map(a => a.command.type) });
    await closeSessions(); await screenshot(`${name}-replay`);
  }
}

try {
  const response = await page.goto(base); assert(response?.ok());
  evidence.source.servedHtmlSha256 = digest(await response.text());
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
  assert.equal(report.session.game.state.tick, report.session.replay.finalTick);
  record('Native bug report confirms served production build identity and matching recorded session', { buildId: report.versions.buildId, tick: report.session.game.state.tick });
  assert.deepEqual(evidence.errors, []); evidence.completed = true; evidence.completedAt = new Date().toISOString();
  await writeFile(`${out}/browser-combined-combat.json`, JSON.stringify(evidence, null, 2));
  console.log(`Verified ${evidence.checks.length} combined production behaviors. Evidence: ${out}`);
} catch (error) {
  evidence.failure = { phase, message: String(error.stack ?? error) };
  try { evidence.lastState = await snap(); await screenshot('combined-combat-failure'); } catch {}
  await writeFile(`${out}/browser-combined-combat.json`, JSON.stringify(evidence, null, 2)); throw error;
} finally { await context.close(); await browser.close(); }
