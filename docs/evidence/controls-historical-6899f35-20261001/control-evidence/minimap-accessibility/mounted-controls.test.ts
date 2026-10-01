// @vitest-environment happy-dom
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createGame, createMatch, canPlace, issueCommand, stepGame } from '../../src/core/simulation';
import { saveGame } from '../../src/core/saves';
import { replayChecksum } from '../../src/core/replays';
import { fogKey } from '../../src/core/world-map';
import type { GameState, Side, Entity } from '../../src/core/types';
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
      const g: any = { setDepth() { return this; } };
      for (const name of ['clear', 'fillStyle', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath', 'lineStyle', 'lineBetween', 'fillEllipse', 'fillTriangle', 'fillRect', 'fillCircle', 'strokeEllipse', 'strokeRect', 'strokeCircle', 'strokePath']) g[name] = vi.fn(() => g);
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
const proof: Record<string, unknown> = { source: '6899f35ae1e8d8b08781005bf766b9bcce2755b6', renderer: 'instrumented methods; no raster or artwork assertion' };
afterAll(() => writeFileSync(process.cwd() + '/control-evidence/minimap-accessibility/mounted-observations.json', JSON.stringify(proof, null, 2)));
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
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
  const alertButton = (kind: string) => root.querySelector<HTMLButtonElement>(`.minimap-alert-list [data-kind="${kind}"]`);
  update(); return { root, state, appearance, shell, trace, callbacks, update, button, alertButton, setLevel: (value: number) => { level = value; } };
}
function palette(root: HTMLElement, value: string) {
  const select = root.querySelector<HTMLSelectElement>('[data-display-setting="palette"]')!;
  select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
}
function shape(path: Path, x: number, y: number) { return path.map(([kind, ...args]) => [kind, ...args.map((n, i) => i === 0 ? +(n - x).toFixed(4) : i === 1 ? +(n - y).toFixed(4) : n)]); }

it('uses the normal Display button and native preferences to change minimap colors, eight shapes and ownership outlines, persist/reopen/reset, without changing save/checksum', () => {
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const state = createMatch({ map: { seed: 4127, size: 'huge' }, players: Array.from({ length: 8 }, (_, side) => ({ id: side as Side, teamId: side < 2 ? 0 : side, factionId: 'orcs' as const, controller: 'external' as const })) });
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
  alertButton('idle')!.click(); expect(callbacks.center).toHaveBeenLastCalledWith(hq.x, hq.y);
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
  alertButton('expansion')!.click(); expect(callbacks.center).toHaveBeenLastCalledWith(expansion.x, expansion.y);
  alertButton('raid')!.click(); expect(callbacks.center).toHaveBeenLastCalledWith(enemy.x, enemy.y);
  const active = structuredClone(shell.minimapAlerts.current); enemy.hp = 0; advance(state, 8.1); update();
  expect(alertButton('expansion')).toBeNull(); expect(alertButton('raid')).toBeNull();
  proof.combatHud = { site, completed: expansion.progress, actualDamage: expansion.maxHp - expansion.hp, alerts: active, center: vi.mocked(callbacks.center).mock.calls, clearsAfterDanger: true };
});

it('keeps hidden raiders out of HUD buttons and draw calls and reproduces off-layer alert navigation without a layer switch', () => {
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
  callbacks.center = (x, y) => scene.centerOn(x, y);
  const camera = vi.mocked(scene.cameras.main.centerOn); alertButton('raid')!.click();
  expect(scene.viewLevel).toBe(0); const p = project(hq.x, hq.y); expect(camera).toHaveBeenLastCalledWith(p.x, p.y);
  expect(alertButton('raid')!.getAttribute('aria-label')).not.toContain('cavern');
  proof.layerLimitation = { alert: shell.minimapAlerts.current.find(a => a.entity === hq.id), activeViewLevel: scene.viewLevel, plottedOnCurrentMap: false, buttonLabel: alertButton('raid')!.getAttribute('aria-label'), projectedCamera: camera.mock.calls, sameCoordinatesWrongLayer: true };
});

it('takes normal Display preferences through GameScene ownership rendering for all eight seats, suppressing shape/outline cues when toggled', () => {
  const state = createMatch({ map: { seed: 4127, size: 'huge' }, players: Array.from({ length: 8 }, (_, side) => ({ id: side as Side, teamId: side < 2 ? 0 : side, factionId: 'orcs' as const, controller: 'external' as const })) });
  state.entities = Array.from({ length: 8 }, (_, side) => state.entities.find(e => e.side === side && e.role === 'melee')!);
  state.entities.forEach((e, i) => { e.x = 10.5 + i * 4; e.y = 20.5; state.visible[0].add(fogKey(state, e)); state.explored[0].add(fogKey(state, e)); });
  const { root, appearance, button } = setup(state), scene = new GameScene({ state, appearance, onSelection() {}, onNotice() {}, simulationEnabled: false });
  scene.preload(); scene.create(); const overlay = (scene as any).graphics[4];
  const clear = () => Object.values(overlay).forEach((f: any) => { if (f?.mockClear) f.mockClear(); });
  button('Display').click(); palette(root, 'deuteranopia'); clear(); scene.update(0, 16);
  expect(overlay.fillPath).toHaveBeenCalledTimes(8); expect(overlay.strokeEllipse).toHaveBeenCalledTimes(16);
  expect(overlay.fillStyle.mock.calls.slice(0, 8).map((c: number[]) => c[0])).toEqual(PALETTES.deuteranopia);
  expect(overlay.lineStyle.mock.calls.filter((c: number[]) => c[0] === 1.5).map((c: number[]) => c[1])).toEqual(['own', 'own', 'ally', 'ally', ...Array(12).fill('enemy')].map(relation => relation === 'own' ? 0xffffff : relation === 'ally' ? 0x78dfff : 0xffc15b));
  const shapedLines = overlay.lineTo.mock.calls.length;
  root.querySelector<HTMLInputElement>('[data-display-setting="patterns"]')!.click(); root.querySelector<HTMLInputElement>('[data-display-setting="outlines"]')!.click(); clear(); scene.update(16, 16);
  expect(overlay.strokeEllipse).not.toHaveBeenCalled(); expect(overlay.fillPath).toHaveBeenCalledTimes(8); expect(overlay.lineTo).toHaveBeenCalledTimes(24); expect(shapedLines).toBeGreaterThan(24);
  expect(overlay.lineStyle.mock.calls.every((c: number[]) => c[0] === 1 && c[1] === 0x111a20)).toBe(true);
  proof.scenePreferences = { seats: 8, palette: 'deuteranopia', ownershipOutlines: ['own:white', 'ally:cyan', 'enemy:amber'], shapedLines, uniformSquareLines: 24, toggleClearsOwnershipEllipses: true, rendererMocked: true, artRuntimeMocked: true };
  button('Close display settings').click(); scene.events.emit('shutdown');
});
