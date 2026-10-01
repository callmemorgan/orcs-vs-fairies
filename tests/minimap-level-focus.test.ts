// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame, issueCommand, refreshVisibility, spawnEntity, stepGame } from '../src/core/simulation';
import { fogKey, levelOf } from '../src/core/world-map';
import type { Entity, GameState } from '../src/core/types';
import { AppearancePreferences } from '../src/game/Appearance';
import { mountShell, type HudCallbacks } from '../src/ui/Hud';

vi.mock('phaser', () => {
  const emitter = () => {
    const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
    return { on(name: string, handler: (...args: unknown[]) => void) { handlers.set(name, [...handlers.get(name) ?? [], handler]); },
      once(name: string, handler: (...args: unknown[]) => void) { this.on(name, handler); }, off() {},
      emit(name: string, ...args: unknown[]) { for (const handler of handlers.get(name) ?? []) handler(...args); } };
  };
  class Scene {
    game = { canvas: document.createElement('canvas') }; events = emitter(); time = { now: 0 };
    input = { ...emitter(), mouse: { disableContextMenu() {} }, activePointer: { x: 0, y: 0, event: new MouseEvent('click') } };
    cameras = { main: { width: 1600, height: 1000, zoom: 1, scrollX: 0, scrollY: 0, setBackgroundColor() {},
      setBounds() { return this; }, setZoom(zoom: number) { this.zoom = zoom; return this; }, centerOn: vi.fn(),
      getWorldPoint(x: number, y: number) { return { x, y }; } } };
    add = { graphics: () => {
      const g: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const name of ['setDepth', 'clear', 'fillStyle', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath', 'lineStyle', 'lineBetween', 'fillEllipse', 'fillTriangle', 'fillRect', 'fillCircle', 'strokeEllipse', 'strokeRect', 'strokeCircle', 'strokePath']) g[name] = vi.fn(() => g);
      return g;
    } };
  }
  return { default: { Scene, Math: { Clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(max, n)) },
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } } } };
});
vi.mock('../src/game/ArtRuntime', () => ({ default: class {
  enabled = false; loaded = true; preload() {} ready() {} reset() {} begin() {} end() {} ground() {}
  top() { return null; } contains() { return null; } entity() { return true; } environment() { return true; }
} }));
vi.mock('../src/game/GameAudio', () => ({ default: class { play() {} dispose() {} reset() {} } }));
import GameScene, { project } from '../src/game/GameScene';

const scenes: GameScene[] = [];
afterEach(() => { for (const scene of scenes.splice(0)) scene.events.emit('shutdown'); vi.restoreAllMocks(); document.body.replaceChildren(); });
const advance = (state: GameState, seconds: number) => { for (let i = 0; i < Math.round(seconds * 20); i++) stepGame(state, .05); };

/** Flat, quiet two-level checkpoint; alerts below arise from accepted commands and simulation ticks. */
function fixture() {
  const state = createGame('orcs', 4127, 'fairies', { controllers: ['external', 'external'], mapSize: 'small', biome: 'forest' });
  state.entities = state.entities.filter(e => e.role === 'hq'); state.resources = [];
  for (const level of state.world!.levels) { level.terrain.fill('grass'); level.elevation.fill(0); }
  Object.assign(state.world!, { sites: [], creatures: [], bridges: [], fires: [], iceTiles: [], dayLength: 10000, weatherLength: 10000 });
  state.players[0].wood = 5000; state.players[0].ore = 5000;
  return state;
}
function build(state: GameState, role: 'barracks' | 'depot', x: number, y: number, level: number) {
  const worker = spawnEntity(state, 0, 'unit', 'worker', x - 2, y, 1, undefined, level); refreshVisibility(state);
  expect(issueCommand(state, 0, { type: 'build', ids: [worker.id], role, x, y, level })).toBe(true);
  const building = state.entities.at(-1)!; advance(state, 45); expect(building.progress).toBe(1); return building;
}
function attack(state: GameState, target: Entity) {
  const enemy = spawnEntity(state, 1, 'unit', 'melee', target.x + 1, target.y, 1, undefined, levelOf(target));
  refreshVisibility(state); expect(issueCommand(state, 1, { type: 'attack', ids: [enemy.id], target: target.id })).toBe(true);
  advance(state, .3); expect(target.hp).toBeLessThan(target.maxHp); expect(target.lastDamagedAt).toBeDefined(); return enemy;
}
function setup(state = fixture()) {
  const paths: Array<{ style: string; path: Array<[string, ...number[]]> }> = []; let path: Array<[string, ...number[]]> = [];
  const context = { fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, fillRect() {}, beginPath() { path = []; },
    moveTo(...args: number[]) { path.push(['moveTo', ...args]); }, lineTo(...args: number[]) { path.push(['lineTo', ...args]); }, closePath() { path.push(['closePath']); },
    rect(...args: number[]) { path.push(['rect', ...args]); }, arc(...args: number[]) { path.push(['arc', ...args]); }, fill() {},
    stroke() { if (context.lineWidth === 2) paths.push({ style: context.strokeStyle, path: structuredClone(path) }); } };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const root = document.createElement('div'); document.body.append(root);
  const shell = mountShell(root, () => {}, new AppearancePreferences(null)); shell.showGame(); shell.ready();
  const scene = new GameScene({ state, onSelection() {}, onNotice() {}, simulationEnabled: false }); scenes.push(scene); scene.preload(); scene.create();
  const camera = vi.mocked(scene.cameras.main.centerOn); camera.mockClear();
  const cameraLevels: number[] = [];
  camera.mockImplementation(() => { cameraLevels.push(scene.viewLevel); return scene.cameras.main; });
  const center = (x: number, y: number, level?: number) => { if (level !== undefined) scene.setViewLevel(level); scene.centerOn(x, y); };
  const callbacks: HudCallbacks = { center, side: () => 0, level: () => scene.viewLevel, isMuted: () => false, groups: () => ({}), cameraCorners: () => [],
    build() {}, train() {}, cancelTrain() {}, research() {}, ability() {}, clearRally() {}, stop() {}, hold() {}, attackMove() {}, select() {}, pause() {}, restart() {}, toggleMuted() {}, recallGroup() {} };
  const update = () => { paths.length = 0; shell.update(state, [], callbacks); };
  const button = (kind: string, level = 1) => root.querySelector<HTMLButtonElement>(`.minimap-alert-list button[data-kind="${kind}"][data-level="${level}"]`)!;
  const expectCamera = (entity: Entity) => { const p = project(entity.x, entity.y); expect(scene.viewLevel).toBe(levelOf(entity)); expect(camera).toHaveBeenLastCalledWith(p.x, p.y); expect(cameraLevels.at(-1)).toBe(levelOf(entity)); };
  update(); return { state, root, shell, scene, camera, cameraLevels, callbacks, paths, update, button, expectCamera };
}

// The source patch adds authored level names to alert labels; assertions below stay independent of punctuation.
function levelLabel(button: HTMLButtonElement, state: GameState, level: number) {
  for (const label of [button.textContent, button.title, button.getAttribute('aria-label')]) expect(label).toContain(state.world!.levels[level].title);
}

describe('minimap alert camera focus across world levels', () => {
  it('focuses the cavern before centering an underground raid from actual combat, and draws its marker only on that layer', () => {
    const state = fixture(), worker = spawnEntity(state, 0, 'unit', 'worker', 9.5, 9.5, 1, undefined, 1); attack(state, worker);
    const { shell, scene, paths, update, button, expectCamera } = setup(state);
    expect(scene.viewLevel).toBe(0); expect(shell.minimapAlerts.current).toContainEqual(expect.objectContaining({ kind: 'raid', entity: worker.id, level: 1 }));
    expect(paths.some(p => p.path[0]?.[0] === 'arc')).toBe(false); levelLabel(button('raid'), state, 1);
    button('raid').click(); expectCamera(worker); update();
    expect(paths.some(p => p.path[0]?.[0] === 'arc' && p.style === '#ffffff')).toBe(true);
  });

  it('cycles within cavern production and switches between surface and cavern groups without centering on the wrong layer', () => {
    const state = fixture(), producer = build(state, 'barracks', 10.5, 9.5, 1), secondProducer = build(state, 'barracks', 10.5, 14.5, 1);
    const hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!;
    const { shell, paths, update, button, expectCamera, cameraLevels } = setup(state);
    advance(state, 12.05); update();
    expect(shell.minimapAlerts.current.filter(a => a.kind === 'idle')).toEqual([
      expect.objectContaining({ entity: hq.id, level: 0 }), expect.objectContaining({ entity: producer.id, level: 1 }), expect.objectContaining({ entity: secondProducer.id, level: 1 }),
    ]);
    levelLabel(button('idle', 0), state, 0); levelLabel(button('idle', 1), state, 1);
    expect(paths.filter(p => p.path[0]?.[0] === 'rect')).toHaveLength(1);
    button('idle', 0).click(); expectCamera(hq); update();
    button('idle', 1).click(); expectCamera(producer); update(); expect(paths.filter(p => p.path[0]?.[0] === 'rect')).toHaveLength(2);
    button('idle', 1).click(); expectCamera(secondProducer); update();
    button('idle', 0).click(); expectCamera(hq); update(); expect(paths.filter(p => p.path[0]?.[0] === 'rect')).toHaveLength(1);
    button('idle', 1).click(); expectCamera(producer); expect(cameraLevels).toEqual([0, 1, 1, 0, 1]);
  });

  it('focuses a completed underground expansion threatened by an accepted attack and keeps its diamond off the surface minimap', () => {
    const state = fixture(), expansion = build(state, 'depot', 20.5, 7.5, 1); attack(state, expansion);
    const { shell, paths, update, button, expectCamera } = setup(state);
    expect(shell.minimapAlerts.current).toContainEqual(expect.objectContaining({ kind: 'expansion', entity: expansion.id, level: 1 }));
    expect(paths.some(p => p.style === '#78dfff')).toBe(false); levelLabel(button('expansion'), state, 1);
    button('expansion').click(); expectCamera(expansion); update(); expect(paths.some(p => p.style === '#78dfff' && p.path.length === 5)).toBe(true);
  });

  it('does not disclose a hidden cavern raider at a visible surface position or retain its button after vision is lost', () => {
    const state = fixture(), worker = spawnEntity(state, 0, 'unit', 'worker', 9.5, 9.5, 1, undefined, 1);
    const enemy = spawnEntity(state, 1, 'unit', 'melee', 10.5, 9.5, 1, undefined, 1); refreshVisibility(state);
    const { root, shell, scene, update, button } = setup(state); levelLabel(button('raid'), state, 1);
    state.visible[0].delete(fogKey(state, enemy)); state.visible[0].add(fogKey(state, { x: enemy.x, y: enemy.y, level: 0 })); state.tick++; update();
    expect(shell.minimapAlerts.current.some(a => a.entity === enemy.id)).toBe(false);
    expect(root.querySelector('.minimap-alert-list [data-kind="raid"]')).toBeNull(); expect(scene.viewLevel).toBe(0);
    expect(worker.hp).toBe(worker.maxHp);
  });

  it('refreshes authored layer labels and regrouping when an idle producer keeps its alert ID', () => {
    const state = fixture(), producer = build(state, 'barracks', 10.5, 9.5, 1);
    const { root, shell, update, button, expectCamera } = setup(state);
    advance(state, 12.05); update();
    const before = shell.minimapAlerts.current.find(a => a.kind === 'idle' && a.entity === producer.id)!;
    const oldButton = button('idle', 1), oldTitle = state.world!.levels[1].title;
    state.world!.levels[1].title = 'Quarry tunnels'; update();
    expect(shell.minimapAlerts.current.find(a => a.entity === producer.id)?.id).toBe(before.id);
    levelLabel(button('idle', 1), state, 1);
    expect(button('idle', 1).textContent).not.toContain(oldTitle);
    expect(root.querySelector('.minimap-alert-status')!.textContent).toContain('Quarry tunnels');
    expect(oldButton.isConnected).toBe(false);
    button('idle', 1).click(); expectCamera(producer);

    producer.level = 0; refreshVisibility(state); state.tick++; update();
    expect(shell.minimapAlerts.current.find(a => a.entity === producer.id)).toMatchObject({ id: before.id, level: 0 });
    expect(root.querySelector('.minimap-alert-list button[data-kind="idle"][data-level="1"]')).toBeNull();
    levelLabel(button('idle', 0), state, 0);
    expect(button('idle', 0).getAttribute('aria-label')).toContain('2 locations');
    button('idle', 0).click(); button('idle', 0).click(); expectCamera(producer);
  });

  it('keeps classic alert labels and explicitly focuses level zero with a legacy x/y-only callback', () => {
    const state = createGame('orcs', 4127, 'fairies', { controllers: ['external', 'external'], mapSize: 'small' });
    const { scene, callbacks, update, button, expectCamera } = setup(state), hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!;
    const legacy: HudCallbacks['center'] = vi.fn((x: number, y: number) => { scene.centerOn(x, y); }); callbacks.center = legacy;
    advance(state, 12.05); update(); expect(button('idle', 0).textContent).toBe('Idle 1');
    button('idle', 0).click(); expectCamera(hq); expect(legacy).toHaveBeenLastCalledWith(hq.x, hq.y, 0);
  });

  it('keeps x/y-only callback consumers valid and leaves ordinary minimap clicks on their current layer', () => {
    const { root, scene, callbacks, camera } = setup();
    const legacy: HudCallbacks['center'] = vi.fn((x: number, y: number) => { scene.centerOn(x, y); });
    callbacks.center = legacy; scene.setViewLevel(1);
    const map = root.querySelector<HTMLCanvasElement>('#minimap')!;
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 216, height: 216, bottom: 216, right: 216, toJSON() {} });
    map.dispatchEvent(new MouseEvent('click', { clientX: 108, clientY: 108, bubbles: true }));
    expect(legacy).toHaveBeenLastCalledWith(18, 18); expect(scene.viewLevel).toBe(1); const p = project(18, 18); expect(camera).toHaveBeenLastCalledWith(p.x, p.y);
  });
});
