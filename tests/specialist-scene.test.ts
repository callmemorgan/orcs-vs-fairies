// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { unitFor } from '../src/core/content-registry';
import { createMatch, issueCommand } from '../src/core/simulation';
import { createArtifact } from '../src/core/unit-progression';
import type { Command, Entity } from '../src/core/types';

vi.mock('phaser', () => {
  const emitter = () => {
    const handlers = new Map<string, Array<(...args: any[]) => void>>();
    return { handlers, on(name: string, handler: (...args: any[]) => void) { handlers.set(name, [...handlers.get(name) ?? [], handler]); },
      once(name: string, handler: (...args: any[]) => void) { this.on(name, handler); }, off() {},
      emit(name: string, ...args: any[]) { for (const handler of handlers.get(name) ?? []) handler(...args); } };
  };
  class Scene {
    game = { canvas: document.createElement('canvas') }; events = emitter();
    time = { now: 0 }; graphics: any[] = [];
    input = { ...emitter(), mouse: { disableContextMenu() {} }, activePointer: { x: 0, y: 0, event: new MouseEvent('click') } };
    cameras = { main: { width: 1920, height: 1080, zoom: 1, scrollX: 0, scrollY: 0, setBackgroundColor() {},
      setBounds() { return this; }, setZoom(zoom: number) { this.zoom = zoom; return this; }, centerOn() {},
      getWorldPoint(x: number, y: number) { return { x, y }; } } };
    add = { graphics: () => {
      const g: any = { setDepth() { return this; } };
      for (const name of ['clear', 'fillStyle', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath', 'lineStyle', 'lineBetween', 'fillEllipse', 'fillTriangle', 'fillRect', 'fillCircle', 'strokeEllipse', 'strokeRect', 'strokeCircle', 'strokePath']) g[name] = vi.fn(() => g);
      this.graphics.push(g); return g;
    } };
  }
  return { default: { Scene, Math: { Clamp: (n: number, min: number, max: number) => Math.max(min, Math.min(max, n)) },
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } } } };
});
vi.mock('../src/game/ArtRuntime', () => ({ default: class {
  enabled = false; loaded = true; ground = vi.fn(); preload() {} ready() {} reset() {} begin() {} end() {}
  top() { return null; } contains() { return null; } entity() { return true; } environment() { return true; }
} }));
vi.mock('../src/game/GameAudio', () => ({ default: class { play() {} dispose() {} reset() {} } }));
import GameScene, { project } from '../src/game/GameScene';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
function setup(faction: 'fairies' | 'dwarves' = 'fairies', accept = true) {
  const state = createMatch({ map: { seed: 4127, size: 'small' }, players: [
    { id: 0, teamId: 0, factionId: faction, controller: 'external' }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
  ] });
  const command = vi.fn((_side: number, _c: Command) => accept), notice = vi.fn();
  const scene = new GameScene({ state, onSelection: vi.fn(), onNotice: notice, onCommand: command, simulationEnabled: false });
  scene.preload(); scene.create();
  const actor = (definitionId: string, x: number, y: number) => {
    const template = state.entities.find(e => e.side === 0 && e.kind === 'unit')!;
    const def = unitFor(state, 0, 'special', definitionId);
    const entity: Entity = { ...structuredClone(template), id: state.nextId++, definitionId, side: 0, role: 'special', x, y, hp: def.hp, maxHp: def.hp };
    state.entities.push(entity); return entity;
  };
  const click = (x: number, y: number, button = 0) => {
    const point = project(x, y), pointer = { ...point, button, event: new MouseEvent('click'), rightButtonDown: () => button === 2, middleButtonDown: () => false };
    (scene.input as any).activePointer = pointer; scene.input.emit('pointerdown', pointer); scene.input.emit('pointerup', pointer);
  };
  const show = (x: number, y: number) => state.visible[0].add(Math.floor(y) * state.width + Math.floor(x));
  return { state, scene, command, notice, actor, click, show };
}

it('arms targeted abilities and emits ground coordinates on a normal battlefield click', () => {
  const { scene, command, actor, click, notice } = setup(), hero = actor('core:fairies-commander', 20.5, 20.5);
  scene.selectEntities([hero.id]); expect(scene.useAbility()).toBe(true); expect(command).not.toHaveBeenCalled();
  expect(notice).toHaveBeenLastCalledWith('Ability: click a visible target or ground. Esc cancels.');
  click(22.5, 20.5); expect(command).toHaveBeenLastCalledWith(0, { type: 'ability', ids: [hero.id], x: 22.5, y: 20.5, level: 0 });
  expect(scene.selected).toEqual([hero.id]);
  click(24.5, 20.5); expect(command).toHaveBeenCalledTimes(1); scene.events.emit('shutdown');
});

it('uses a visible entity target, keeps a rejected cursor ready and allows Esc or right click to cancel', () => {
  const { state, scene, command, actor, click, show } = setup('dwarves', false), hero = actor('core:dwarves-commander', 20.5, 20.5);
  const target = state.entities.find(e => e.side === 0 && e.role === 'melee')!; target.x = 22.5; target.y = 20.5; show(target.x, target.y);
  scene.selectEntities([hero.id]); scene.useAbility(); click(target.x, target.y);
  expect(command).toHaveBeenLastCalledWith(0, { type: 'ability', ids: [hero.id], target: target.id });
  click(target.x, target.y); expect(command).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); click(target.x, target.y); expect(command).toHaveBeenCalledTimes(2);
  scene.selectEntities([hero.id]); scene.useAbility(); click(21.5, 20.5, 2); click(target.x, target.y); expect(command).toHaveBeenCalledTimes(2);
  scene.events.emit('shutdown');
});

it('does not resolve a hidden entity as an ability target and suppresses commands when paused or read only', () => {
  const { state, scene, command, actor, click } = setup(), hero = actor('core:fairies-commander', 20.5, 20.5);
  const hidden = state.entities.find(e => e.side === 1 && e.kind === 'unit')!; hidden.x = 22.5; hidden.y = 20.5;
  state.visible[0].delete(Math.floor(hidden.y) * state.width + Math.floor(hidden.x));
  scene.selectEntities([hero.id]); scene.useAbility(); click(hidden.x, hidden.y);
  expect(command).toHaveBeenLastCalledWith(0, { type: 'ability', ids: [hero.id], x: hidden.x, y: hidden.y, level: 0 });
  scene.paused = true; expect(scene.useAbility()).toBe(false); click(23.5, 20.5); expect(command).toHaveBeenCalledTimes(1);
  scene.paused = false; scene.readOnly = true; expect(scene.useAbility()).toBe(false);
  expect(scene.beginEngineerBuild('bridge')).toBe(false); scene.events.emit('shutdown');
});

it('places bridge and barricade commands and targets field repair with the nearest selected engineer', () => {
  const { state, scene, command, actor, click } = setup(), far = actor('core:fairies-engineer', 20.5, 20.5), near = actor('core:fairies-engineer', 24.5, 20.5);
  scene.selectEntities([far.id, near.id]); expect(scene.beginEngineerBuild('bridge')).toBe(true); click(22.8, 20.7);
  expect(command).toHaveBeenLastCalledWith(0, { type: 'engineerBuild', ids: [far.id, near.id], kind: 'bridge', x: 22.5, y: 20.5, level: 0 });
  scene.beginEngineerBuild('barricade'); click(23.2, 21.9);
  expect(command).toHaveBeenLastCalledWith(0, { type: 'engineerBuild', ids: [far.id, near.id], kind: 'barricade', x: 23.5, y: 21.5, level: 0 });
  const hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!; hq.x = 25.5; hq.y = 20.5; hq.hp -= 60;
  scene.beginFieldRepair(); click(hq.x, hq.y); expect(command).toHaveBeenLastCalledWith(0, { type: 'fieldRepair', id: near.id, target: hq.id });
  expect(scene.selected).toEqual([far.id, near.id]); scene.events.emit('shutdown');
});

it('executes a targeted commander ability and engineer build and repair from registered pointer events', () => {
  const { state, scene, command, actor, click, show } = setup(), hero = actor('core:fairies-commander', 20.5, 20.5);
  command.mockImplementation((side, c) => issueCommand(state, side as 0, c));
  state.terrain[Math.floor(20.5) * state.width + Math.floor(22.5)] = 'grass'; show(22.5, 20.5);
  hero.hp -= 30; scene.selectEntities([hero.id]); scene.useAbility(); click(22.5, 20.5);
  expect(hero.x).toBe(22.5); expect(hero.y).toBe(20.5); expect(hero.hp).toBe(hero.maxHp); expect(hero.abilityReadyAt).toBeGreaterThan(state.time);
  hero.x = 18.5;
  const engineer = actor('core:fairies-engineer', 20.5, 20.5); scene.selectEntities([engineer.id]);
  for (const x of [21.5, 22.5, 23.5]) { state.terrain[20 * state.width + Math.floor(x)] = x === 22.5 ? 'water' : 'grass'; show(x, 20.5); }
  scene.beginEngineerBuild('bridge'); click(22.5, 20.5);
  expect(state.specialists!.structures).toHaveLength(1); expect(state.specialists!.structures[0].kind).toBe('bridge');
  expect(state.terrain[20 * state.width + 22]).toBe('bridge'); expect(state.players[0].wood).toBe(360);
  const hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!; hq.x = 22.5; hq.y = 21.5; hq.hp -= 60;
  const ore = state.players[0].ore; scene.beginFieldRepair(); click(hq.x, hq.y);
  expect(hq.hp).toBe(hq.maxHp); expect(state.players[0].ore).toBe(ore - 6); scene.events.emit('shutdown');
});

it('recovers a visible ground marker, draws veteran rank and experience, and redraws changed bridge terrain', () => {
  const { state, scene, command, actor, show } = setup(), hero = actor('core:fairies-commander', 20.5, 20.5);
  hero.veteran = { experience: 54, rank: 1, pendingPromotion: 1, nextSurvivalAt: 120, lastCombatAt: 0, promotions: [] };
  const item = createArtifact(state, 'core:ember-blade', { x: 21.5, y: 20.5 }); show(21.5, 20.5); scene.selectEntities([hero.id]);
  const marker = project(21.5, 20.5), pointer = { x: marker.x, y: marker.y - 12, button: 0, event: new MouseEvent('click'), rightButtonDown: () => false, middleButtonDown: () => false };
  (scene.input as any).activePointer = pointer; scene.input.emit('pointerdown', pointer); scene.input.emit('pointerup', pointer);
  expect(command).toHaveBeenLastCalledWith(0, { type: 'recoverArtifact', id: hero.id, artifact: item.id });
  scene.update(0, 16); const overlay = (scene as any).graphics[4], point = project(hero.x, hero.y);
  expect(overlay.lineBetween).toHaveBeenCalledWith(point.x - 5, point.y - 55, point.x, point.y - 58);
  expect(overlay.fillRect).toHaveBeenCalledWith(point.x - 15, point.y + 19, 7, 3);
  expect(overlay.strokeCircle).toHaveBeenCalledWith(marker.x, marker.y - 12, 14);
  const art = (scene as any).art; expect(art.ground).toHaveBeenCalledTimes(1);
  state.terrain[0] = 'bridge'; scene.update(16, 16); expect(art.ground).toHaveBeenCalledTimes(2);
  scene.update(32, 16); expect(art.ground).toHaveBeenCalledTimes(2); scene.events.emit('shutdown');
});
