// @vitest-environment happy-dom
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { createGame, createMatch, canPlace, issueCommand, stepGame } from '../../src/core/simulation';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import { replayChecksum } from '../../src/core/replays';
import { SIMULATION_REVISION } from '../../src/core/versions';
import { fogKey, levelOf } from '../../src/core/world-map';
import type { GameState, Side } from '../../src/core/types';
import { mountShell, type HudCallbacks } from '../../src/ui/Hud';
import { AppearancePreferences, APPEARANCE_STORAGE_KEY, PALETTES } from '../../src/game/Appearance';

vi.mock('phaser', () => {
  const emitter = () => {
    const handlers = new Map<string, Array<(...args: any[]) => void>>();
    return { on(name: string, handler: (...args: any[]) => void) { handlers.set(name, [...handlers.get(name) ?? [], handler]); },
      once(name: string, handler: (...args: any[]) => void) { this.on(name, handler); }, off() {},
      emit(name: string, ...args: any[]) { for (const handler of handlers.get(name) ?? []) handler(...args); } };
  };
  class Scene {
    game = { canvas: document.createElement('canvas') }; events = emitter(); time = { now: 0 }; graphics: any[] = [];
    input = { ...emitter(), mouse: { disableContextMenu() {} }, activePointer: { x: 0, y: 0, event: new MouseEvent('click') } };
    cameras = { main: { width: 1920, height: 1080, zoom: 1, scrollX: 0, scrollY: 0, setBackgroundColor() {},
      setBounds() { return this; }, setZoom(zoom: number) { this.zoom = zoom; return this; }, centerOn: vi.fn(),
      getWorldPoint(x: number, y: number) { return { x, y }; } } };
    add = { graphics: () => {
      let path: Array<[string, ...number[]]> = [], fillColor = 0, lineColor = 0, lineWidth = 0;
      const g: any = { paths: [] as unknown[], ellipses: [] as unknown[], setDepth: vi.fn(() => g) };
      const operations = ['clear', 'fillStyle', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath', 'lineStyle', 'lineBetween', 'fillEllipse', 'fillTriangle', 'fillRect', 'fillCircle', 'strokeEllipse', 'strokeRect', 'strokeCircle', 'strokePath'];
      for (const name of operations) g[name] = vi.fn((...args: number[]) => {
        if (name === 'clear') { g.paths.length = 0; g.ellipses.length = 0; path = []; }
        if (name === 'fillStyle') fillColor = args[0];
        if (name === 'lineStyle') { lineWidth = args[0]; lineColor = args[1]; }
        if (name === 'beginPath') path = [];
        if (name === 'moveTo' || name === 'lineTo' || name === 'closePath') path.push([name, ...args]);
        if (name === 'fillPath') g.paths.push({ color: fillColor, path: structuredClone(path) });
        if (name === 'strokeEllipse') g.ellipses.push({ color: lineColor, width: lineWidth, args });
        return g;
      });
      this.graphics.push(g); return g;
    } };
  }
  return { default: { Scene, Math: { Clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(max, n)) }, Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } } } };
});
vi.mock('../../src/game/ArtRuntime', () => ({ default: class {
  enabled = false; loaded = true; ground = vi.fn(); preload() {} ready() {} reset() {} begin() {} end() {}
  top() { return null; } contains() { return null; } entity() { return true; } environment() { return true; }
} }));
vi.mock('../../src/game/GameAudio', () => ({ default: class { play() {} dispose() {} reset() {} } }));
import GameScene, { project } from '../../src/game/GameScene';

type Path = Array<[string, ...number[]]>;
type Draw = { kind: string; color: string; width: number; path: Path };
const checkout = realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
assert.equal(realpathSync(process.cwd()), checkout, 'Run mounted proof from the frozen checkout root');
const git = (args: string[]) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim();
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sourcePin = process.env.OVF_PROOF_PIN ?? git(['rev-parse', 'HEAD']);
assert.match(sourcePin, /^[0-9a-f]{40}$/, 'OVF_PROOF_PIN must be a full committed pin');
const requestedOutput = process.env.OVF_PROOF_MOUNTED_OUTPUT;
assert(requestedOutput && isAbsolute(requestedOutput), 'Set OVF_PROOF_MOUNTED_OUTPUT to a fresh absolute output directory');
const output = realpathSync(requestedOutput);
assert(relative(checkout, output).startsWith(`..${sep}`), 'Mounted proof output must be outside the checkout');
assert(!output.includes('/docs/evidence/'), 'Historical evidence must remain immutable');

function auditSource() {
  assert.equal(git(['rev-parse', 'HEAD']), sourcePin, 'Checkout must remain on the requested source');
  assert.equal(git(['diff', 'HEAD', '--name-only', '--', 'src']), '', 'Tracked source must match the pin');
  const paths = git(['ls-tree', '-r', '--name-only', sourcePin, '--', 'src']).split('\n').filter(Boolean).sort();
  const actual: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(checkout, dir)).sort()) {
      const path = `${dir}/${name}`, info = lstatSync(join(checkout, path));
      assert(!info.isSymbolicLink(), `Source symlink is not a frozen source file: ${path}`);
      if (info.isDirectory()) walk(path);
      else { assert(info.isFile(), `Unexpected source entry: ${path}`); actual.push(path); }
    }
  };
  walk('src'); assert.deepEqual(actual.sort(), paths, 'Source inventory must match Git, including untracked files');
  const files: Record<string, { bytes: number; sha256: string; gitBlob: string }> = {}, build = createHash('sha256');
  for (const path of paths) {
    const bytes = readFileSync(join(checkout, path)), gitBlob = git(['rev-parse', `${sourcePin}:${path}`]);
    const pinned = execFileSync('git', ['cat-file', 'blob', gitBlob], { cwd: checkout });
    assert(bytes.equals(pinned), `Source bytes differ from the pin: ${path}`);
    files[path] = { bytes: bytes.length, sha256: hash(bytes), gitBlob };
    if (/\.(ts|css)$/.test(path)) { build.update(path.slice(4)); build.update(bytes); }
  }
  const canonical = 'tests/minimap-level-focus.test.ts';
  assert.equal(git(['diff', 'HEAD', '--name-only', '--', canonical]), '', 'Canonical level regressions must match the pin');
  const testBytes = readFileSync(join(checkout, canonical)), testBlob = git(['rev-parse', `${sourcePin}:${canonical}`]);
  assert(testBytes.equals(execFileSync('git', ['cat-file', 'blob', testBlob], { cwd: checkout })), 'Canonical level regression bytes differ from the pin');
  const testFiles = { [canonical]: { bytes: testBytes.length, sha256: hash(testBytes), gitBlob: testBlob } };
  return { sourcePin, buildId: build.digest('hex'), sourceFiles: files, testFiles };
}
const provenance = auditSource();
const scriptFiles = Object.fromEntries(['mounted.test.ts', 'mounted.vitest.config.ts'].map(name => {
  const bytes = readFileSync(join(checkout, 'scripts/controls-proof', name));
  return [`scripts/controls-proof/${name}`, { bytes: bytes.length, sha256: hash(bytes) }];
}));
const proof: Record<string, unknown> = {
  sourcePin, purpose: process.env.OVF_PROOF_PURPOSE ?? 'mounted controls verification',
  schema: { saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION },
  scope: 'Instrumented mounted HUD and GameScene with controlled fixtures. Phaser, artwork and audio are mocked; no raster, perception, hardware or production-browser assertion.',
  canonicalLevelRegressionFile: 'tests/minimap-level-focus.test.ts', provenance, scriptFiles,
};
const scenes: GameScene[] = [];
afterAll(() => {
  try { assert.deepEqual(auditSource(), provenance, 'Source changed during the mounted proof'); proof.sourceAuditAfterPassed = true; }
  finally { writeFileSync(join(output, 'mounted-observations.json'), `${JSON.stringify(proof, null, 2)}\n`); }
});
afterEach(() => { for (const scene of scenes.splice(0)) scene.events.emit('shutdown'); vi.restoreAllMocks(); document.body.replaceChildren(); });
const advance = (state: GameState, seconds: number) => { for (let i = 0; i < Math.round(seconds * 20); i++) stepGame(state, .05); };
function canvasTrace() {
  const draws: Draw[] = []; let path: Path = [];
  const ctx: any = { fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, fillRect() {},
    beginPath() { path = []; }, moveTo(...args: number[]) { path.push(['moveTo', ...args]); },
    lineTo(...args: number[]) { path.push(['lineTo', ...args]); }, closePath() { path.push(['closePath']); },
    rect(...args: number[]) { path.push(['rect', ...args]); }, arc(...args: number[]) { path.push(['arc', ...args]); },
    fill() { draws.push({ kind: 'fill', color: ctx.fillStyle, width: ctx.lineWidth, path: structuredClone(path) }); },
    stroke() { draws.push({ kind: 'stroke', color: ctx.strokeStyle, width: ctx.lineWidth, path: structuredClone(path) }); } };
  return { ctx: ctx as CanvasRenderingContext2D, draws, clear() { draws.length = 0; } };
}
function setup(state = createGame('orcs', 4127, 'fairies', { mapSize: 'small', controllers: ['external', 'external'] }), appearance = new AppearancePreferences(null)) {
  const trace = canvasTrace(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(trace.ctx);
  const root = document.createElement('div'); document.body.append(root);
  const shell = mountShell(root, () => {}, appearance); shell.showGame(); shell.ready();
  let selection: number[] = [], level = 0;
  const callbacks: HudCallbacks = { isMuted: () => false, groups: () => ({}), cameraCorners: () => [], side: () => 0, level: () => level,
    train: (role, definitionId) => { issueCommand(state, 0, { type: 'train', id: selection[0], role, definitionId }); },
    command: c => issueCommand(state, 0, c), build() {}, cancelTrain() {}, research() {}, ability() {}, clearRally() {}, stop() {}, hold() {}, attackMove() {}, select() {}, pause() {}, restart() {}, center: vi.fn(), toggleMuted() {}, recallGroup() {} };
  const update = (ids = selection) => { selection = ids; trace.clear(); shell.update(state, ids, callbacks); };
  const button = (label: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === label || b.getAttribute('aria-label') === label)!;
  const alertButton = (kind: string, atLevel?: number) => root.querySelector<HTMLButtonElement>(`.minimap-alert-list button[data-kind="${kind}"]${atLevel === undefined ? '' : `[data-level="${atLevel}"]`}`);
  update(); return { root, state, appearance, shell, trace, callbacks, update, button, alertButton, setLevel: (value: number) => { level = value; } };
}
function palette(root: HTMLElement, value: string) {
  const select = root.querySelector<HTMLSelectElement>('[data-display-setting="palette"]')!;
  select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
}
function shape(path: Path, x: number, y: number) { return path.map(([kind, ...args]) => [kind, ...args.map((n, i) => i === 0 ? +(n - x).toFixed(4) : i === 1 ? +(n - y).toFixed(4) : n)]); }

it('uses the normal Display button and native preferences to change minimap colors, eight shapes and ownership outlines, persist/reopen/reset, without changing save/checksum', () => {
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const state = createMatch({ map: { seed: 4127, size: 'huge' }, players: Array.from({ length: 8 }, (_, side) => ({ id: side as Side, teamId: (side < 2 ? 0 : side) as Side, factionId: 'orcs' as const, controller: 'external' as const })) });
  // A controlled eight-seat visibility fixture isolates marker presentation. No hidden marker is made visible by the UI.
  const markers = Array.from({ length: 8 }, (_, side) => state.entities.find(e => e.side === side && e.role === 'melee')!);
  state.entities = markers;
  markers.forEach((e, i) => { e.x = 10.5 + i * 4; e.y = 20.5; state.visible[0].add(fogKey(state, e)); state.explored[0].add(fogKey(state, e)); });
  const { root, appearance, trace, update, button } = setup(state, new AppearancePreferences(storage));
  const before = JSON.stringify(saveGame(state)), checksum = replayChecksum(state);
  button('Display').focus(); button('Display').click();
  const dialog = root.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')!;
  expect(dialog.closest('[hidden]')).toBeNull(); expect(document.activeElement?.getAttribute('aria-label')).toBe('Close display settings');
  const captures: unknown[] = [];
  for (const name of ['default', 'deuteranopia', 'tritanopia'] as const) {
    palette(root, name); update(); const fill = trace.draws.filter(d => d.kind === 'fill'); const stroke = trace.draws.filter(d => d.kind === 'stroke');
    expect(fill.map(d => d.color)).toEqual(PALETTES[name].map(n => `#${n.toString(16).padStart(6, '0')}`));
    expect(new Set(fill.map((d, i) => JSON.stringify(shape(d.path, markers[i].x * 216 / state.width, markers[i].y * 216 / state.height)))).size).toBe(8);
    expect(stroke.map(d => d.color)).toEqual(['#ffffff', '#78dfff', ...Array(6).fill('#ffc15b')]);
    expect(stroke.map(d => d.width)).toEqual(Array(8).fill(1.1));
    captures.push({ name, fill, stroke });
  }
  root.querySelector<HTMLInputElement>('[data-display-setting="patterns"]')!.click(); update();
  expect(new Set(trace.draws.filter(d => d.kind === 'fill').map((d, i) => JSON.stringify(shape(d.path, markers[i].x * 216 / state.width, markers[i].y * 216 / state.height)))).size).toBe(1);
  root.querySelector<HTMLInputElement>('[data-display-setting="outlines"]')!.click(); update();
  expect(trace.draws.filter(d => d.kind === 'stroke').every(d => d.color === '#101820' && d.width === .7)).toBe(true);
  expect(new AppearancePreferences(storage).value).toEqual({ palette: 'tritanopia', patterns: false, outlines: false });
  expect(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!)).toEqual({ version: 1, palette: 'tritanopia', patterns: false, outlines: false });
  button('Close display settings').click(); expect(document.activeElement).toBe(button('Display'));
  button('Display').click(); expect(root.querySelector<HTMLInputElement>('[data-display-setting="outlines"]')!.checked).toBe(false);
  button('Reset display settings').click(); update(); expect(appearance.value).toEqual({ palette: 'default', patterns: true, outlines: true });
  expect(JSON.stringify(saveGame(state))).toBe(before); expect(replayChecksum(state)).toBe(checksum);
  proof.displayHud = { allPalettes: captures, persisted: values.get(APPEARANCE_STORAGE_KEY), saveUnchanged: true, checksumUnchanged: true };
  button('Close display settings').click();
});

it('draws idle production after real simulation time, centers the normal alert button, and clears the alert through the normal Recruit action', () => {
  const { root, state, shell, trace, callbacks, update, button, alertButton } = setup();
  const hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!;
  expect(alertButton('idle')).toBeNull(); advance(state, 11.95); update(); expect(alertButton('idle')).toBeNull();
  advance(state, .1); update(); expect(alertButton('idle')!.textContent).toBe('Idle 1');
  const marker = trace.draws.find(d => d.kind === 'stroke' && d.color === '#f5de8c')!;
  expect(marker.path[0][0]).toBe('rect'); expect(root.querySelector('.minimap-alert-status')!.textContent).toBe('Idle: 1');
  alertButton('idle')!.click(); expect(callbacks.center).toHaveBeenLastCalledWith(hq.x, hq.y, levelOf(hq));
  update([hq.id]); const workerButton = button('Scrapper');
  expect(workerButton).toBeDefined(); workerButton.click(); update([hq.id]);
  expect(hq.queue).toContain('worker'); expect(alertButton('idle')).toBeNull(); expect(shell.minimapAlerts.current.some(a => a.kind === 'idle')).toBe(false);
  proof.idleHud = { time: state.time, marker, center: vi.mocked(callbacks.center).mock.calls, queued: hq.queue.slice(), clearsOnNormalRecruit: true };
});

it('draws threatened expansion and raid markers from accepted build/attack commands and actual damage, centers buttons, and removes markers after danger expires', () => {
  const { state, shell, trace, callbacks, update, alertButton } = setup();
  state.players[0].wood = 5000; state.players[0].ore = 5000;
  // Construction fixture supplies resources and known terrain; build completion and combat run through the simulation.
  for (let tile = 0; tile < state.width * state.height; tile++) { state.visible[0].add(tile); state.explored[0].add(tile); }
  const worker = state.entities.find(e => e.side === 0 && e.role === 'worker')!;
  const origin = state.starts[0]; let site: { x: number; y: number } | undefined;
  for (let y = 3.5; y < state.height - 3 && !site; y++) for (let x = 3.5; x < state.width - 3; x++) {
    const d = Math.hypot(x - origin.x, y - origin.y); if (d > 10 && d < 16 && canPlace(state, 0, 'depot', x, y)) { site = { x, y }; break; }
  }
  expect(site).toBeDefined(); expect(issueCommand(state, 0, { type: 'build', ids: [worker.id], role: 'depot', ...site! })).toBe(true);
  const expansion = state.entities.at(-1)!; advance(state, 70); expect(expansion.progress).toBe(1);
  // Relocate a starting raider to the completed building for a short deterministic combat setup.
  const enemy = state.entities.find(e => e.side === 1 && e.role === 'melee')!; enemy.x = expansion.x + 1; enemy.y = expansion.y;
  advance(state, .05); expect(issueCommand(state, 1, { type: 'attack', ids: [enemy.id], target: expansion.id })).toBe(true); advance(state, .3); update();
  expect(expansion.hp).toBeLessThan(expansion.maxHp); expect(expansion.lastDamagedAt).toBeDefined();
  expect(shell.minimapAlerts.current).toContainEqual(expect.objectContaining({ kind: 'expansion', entity: expansion.id, x: expansion.x, y: expansion.y }));
  expect(shell.minimapAlerts.current).toContainEqual(expect.objectContaining({ kind: 'raid', entity: enemy.id }));
  expect(trace.draws.some(d => d.kind === 'stroke' && d.color === '#78dfff' && d.width === 2 && d.path.length === 5)).toBe(true);
  expect(trace.draws.some(d => d.kind === 'stroke' && d.color === '#ffffff' && d.path[0][0] === 'arc')).toBe(true);
  alertButton('expansion')!.click(); expect(callbacks.center).toHaveBeenLastCalledWith(expansion.x, expansion.y, levelOf(expansion));
  alertButton('raid')!.click(); expect(callbacks.center).toHaveBeenLastCalledWith(enemy.x, enemy.y, levelOf(enemy));
  const active = structuredClone(shell.minimapAlerts.current); enemy.hp = 0; advance(state, 8.1); update();
  expect(alertButton('expansion')).toBeNull(); expect(alertButton('raid')).toBeNull();
  proof.combatHud = { site, completed: expansion.progress, actualDamage: expansion.maxHp - expansion.hp, alerts: active, center: vi.mocked(callbacks.center).mock.calls, clearsAfterDanger: true };
});

it('keeps hidden raiders out of HUD buttons and draw calls and switches to an off-level alert before centering', () => {
  const state = createGame('orcs', 4127, 'fairies', { mapSize: 'small', biome: 'forest', controllers: ['external', 'external'] });
  const { shell, trace, callbacks, update, alertButton } = setup(state);
  const hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!, enemy = state.entities.find(e => e.side === 1 && e.role === 'melee')!;
  enemy.x = hq.x + 2; enemy.y = hq.y; state.visible[0].delete(fogKey(state, enemy)); update();
  expect(alertButton('raid')).toBeNull(); expect(trace.draws.some(d => d.color === '#f08572')).toBe(false);
  // Ownership damage is known across layers. Fixture sets its level; UI must preserve the level when navigating.
  hq.level = 1; hq.lastDamagedAt = state.time; state.tick++; update();
  expect(shell.minimapAlerts.current).toContainEqual(expect.objectContaining({ kind: 'raid', entity: hq.id, level: 1 }));
  expect(alertButton('raid')).not.toBeNull(); expect(trace.draws.some(d => d.kind === 'stroke' && d.path[0][0] === 'arc')).toBe(false);
  const scene = new GameScene({ state, onSelection() {}, onNotice() {}, simulationEnabled: false });
  scenes.push(scene); callbacks.level = () => scene.viewLevel;
  callbacks.center = (x, y, level) => { if (level !== undefined) scene.setViewLevel(level); scene.centerOn(x, y); };
  const camera = vi.mocked(scene.cameras.main.centerOn); alertButton('raid')!.click();
  expect(scene.viewLevel).toBe(1); const p = project(hq.x, hq.y); expect(camera).toHaveBeenLastCalledWith(p.x, p.y);
  const levelTitle = state.world!.levels[1].title;
  for (const label of [alertButton('raid', 1)!.textContent, alertButton('raid', 1)!.title, alertButton('raid', 1)!.getAttribute('aria-label')]) expect(label).toContain(levelTitle);
  expect(shell.minimapAlerts.current).toContainEqual(expect.objectContaining({ entity: hq.id, level: 1 }));
  update(); expect(trace.draws.some(d => d.kind === 'stroke' && d.color === '#ffffff' && d.path[0][0] === 'arc')).toBe(true);
  proof.layerNavigation = { alert: shell.minimapAlerts.current.find(a => a.entity === hq.id), activeViewLevel: scene.viewLevel, plottedOnlyAfterLayerSwitch: true, buttonLabel: alertButton('raid')!.getAttribute('aria-label'), projectedCamera: camera.mock.calls, sameCoordinatesWrongLayer: false, levelTitle };
});

it('takes normal Display preferences through GameScene ownership rendering for all eight seats and toggles shapes and outlines independently', () => {
  const state = createMatch({ map: { seed: 4127, size: 'huge' }, players: Array.from({ length: 8 }, (_, side) => ({ id: side as Side, teamId: (side < 2 ? 0 : side) as Side, factionId: 'orcs' as const, controller: 'external' as const })) });
  state.entities = Array.from({ length: 8 }, (_, side) => state.entities.find(e => e.side === side && e.role === 'melee')!);
  state.entities.forEach((e, i) => { e.x = 10.5 + i * 4; e.y = 20.5; state.visible[0].add(fogKey(state, e)); state.explored[0].add(fogKey(state, e)); });
  const { root, appearance, button } = setup(state), scene = new GameScene({ state, appearance, onSelection() {}, onNotice() {}, simulationEnabled: false });
  scenes.push(scene); scene.preload(); scene.create();
  const overlay = (scene as unknown as { overlay: {
    paths: Array<{ color: number; path: Path }>; ellipses: Array<{ color: number; width: number; args: number[] }>;
    [key: string]: any;
  } }).overlay;
  expect(overlay.setDepth).toHaveBeenCalledWith(100001);
  const before = JSON.stringify(saveGame(state)), checksum = replayChecksum(state);
  const expectedRelations = [0xffffff, 0x78dfff, ...Array(6).fill(0xffc15b)];
  const capture = () => {
    for (const f of Object.values(overlay)) if (typeof f === 'function' && f.mockClear) f.mockClear();
    scene.update(0, 16);
    expect(overlay.paths).toHaveLength(8);
    const paths = overlay.paths.map((draw, i) => { const p = project(state.entities[i].x, state.entities[i].y); return shape(draw.path, p.x, p.y + 12); });
    return { paths, fills: overlay.paths.map(draw => draw.color), ellipses: structuredClone(overlay.ellipses), lines: structuredClone(overlay.lineStyle.mock.calls) };
  };
  const captures: unknown[] = [];
  button('Display').click();
  let referenceShapes: unknown;
  for (const name of ['default', 'deuteranopia', 'tritanopia'] as const) {
    palette(root, name); const frame = capture();
    expect(frame.fills).toEqual(PALETTES[name]);
    expect(new Set(frame.paths.map(path => JSON.stringify(path))).size).toBe(8);
    if (referenceShapes) expect(frame.paths).toEqual(referenceShapes); else referenceShapes = frame.paths;
    expect(frame.ellipses).toHaveLength(16);
    expect(frame.ellipses.filter(draw => draw.width === 4).map(draw => draw.color)).toEqual(Array(8).fill(0x111a20));
    expect(frame.ellipses.filter(draw => draw.width === 1.5).map(draw => draw.color)).toEqual(expectedRelations);
    expect(frame.lines.filter((args: number[]) => args[0] === 1.5).map((args: number[]) => args[1])).toEqual(expectedRelations.flatMap(color => [color, color]));
    captures.push({ name, ...frame });
  }
  root.querySelector<HTMLInputElement>('[data-display-setting="patterns"]')!.click();
  const unpatterned = capture();
  expect(new Set(unpatterned.paths.map(path => JSON.stringify(path))).size).toBe(1);
  expect(unpatterned.ellipses).toHaveLength(16); expect(unpatterned.fills).toEqual(PALETTES.tritanopia);
  root.querySelector<HTMLInputElement>('[data-display-setting="patterns"]')!.click();
  root.querySelector<HTMLInputElement>('[data-display-setting="outlines"]')!.click();
  const noOutlines = capture();
  expect(new Set(noOutlines.paths.map(path => JSON.stringify(path))).size).toBe(8);
  expect(noOutlines.ellipses).toHaveLength(0); expect(noOutlines.fills).toEqual(PALETTES.tritanopia);
  expect(noOutlines.lines).toHaveLength(8);
  expect(noOutlines.lines.every((args: number[]) => args[0] === 1 && args[1] === 0x111a20)).toBe(true);
  root.querySelector<HTMLInputElement>('[data-display-setting="patterns"]')!.click();
  const uniform = capture();
  expect(new Set(uniform.paths.map(path => JSON.stringify(path))).size).toBe(1); expect(uniform.ellipses).toHaveLength(0); expect(uniform.fills).toEqual(PALETTES.tritanopia);
  expect(overlay.lineTo).toHaveBeenCalledTimes(24);
  expect(JSON.stringify(saveGame(state))).toBe(before); expect(replayChecksum(state)).toBe(checksum);
  proof.scenePreferences = { seats: 8, palettes: captures, unpatterned, noOutlines, uniform, ownershipOutlines: ['own:white', 'ally:cyan', 'enemy:amber'], independentlyToggled: true, saveUnchanged: true, checksumUnchanged: true, rendererMocked: true, artRuntimeMocked: true };
  button('Close display settings').click();
});
