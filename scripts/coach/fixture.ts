import Phaser from 'phaser';
import { coachAdvice, createCoachMemory } from '../../src/core/coach';
import type { CoachObservation } from '../../src/core/coach';
import { FACTIONS } from '../../src/core/content';
import { PlayerView } from '../../src/core/observation';
import { canPlace, createGame, isVisible, issueCommand, refreshVisibility, stepGame } from '../../src/core/simulation';
import type { Command, Entity, Vec } from '../../src/core/types';
import { ControlProfiles } from '../../src/game/Controls';
import GameScene from '../../src/game/GameScene';
import { mountPracticeCoach, PRACTICE_COACH_STORAGE_KEY } from '../../src/ui/PracticeCoach';

const state = createGame('orcs', 4127, 'fairies', { controllers: ['human', 'ai'] });
const view = new PlayerView(0);
const root = document.querySelector<HTMLElement>('#coach-root')!;
const controls = new ControlProfiles(null);
controls.resetDefaults();
const nativeStorage = window.localStorage;
const storagePrefix = `coach-proof/${new URLSearchParams(location.search).get('proof') ?? 'manual'}/`;
const storageKeys = () => Array.from({ length: nativeStorage.length }, (_, index) => nativeStorage.key(index)!).filter(key => key.startsWith(storagePrefix));
// Exercise native browser persistence without touching the game's setting key.
const fixtureStorage: Storage = {
  get length() { return storageKeys().length; },
  clear: () => { for (const key of storageKeys()) nativeStorage.removeItem(key); },
  getItem: key => nativeStorage.getItem(storagePrefix + key),
  key: index => storageKeys()[index]?.slice(storagePrefix.length) ?? null,
  removeItem: key => { nativeStorage.removeItem(storagePrefix + key); },
  setItem: (key, value) => { nativeStorage.setItem(storagePrefix + key, value); },
};
fixtureStorage.removeItem(PRACTICE_COACH_STORAGE_KEY);
let ready = false;
let privacy: null | {
  changed: { enemyBank: boolean; hiddenBuilding: boolean; hiddenResource: boolean };
  permittedViewUnchanged: boolean;
  adviceUnchanged: boolean;
  beforeViewHash: string;
  afterViewHash: string;
  beforeAdvice: unknown;
  afterAdvice: unknown;
} = null;
const commands: { command: Command; accepted: boolean }[] = [];
const focusEvents: { ids: number[]; point: Vec; selected: number[] }[] = [];
const fixtureEvents: { action: string; tick: number; time: number }[] = [];

function observe() { return view.observe(state); }
function generatedAdvice() { return coachAdvice(observe(), createCoachMemory(0), 6); }
function dispatch(command: Command) {
  const accepted = issueCommand(state, 0, command);
  commands.push({ command: structuredClone(command), accepted });
  return accepted;
}
function focus(ids: readonly number[], point?: Vec) {
  // The callback is the same selection/camera operation used by the game UI.
  const ownIds = new Set(observe().entities.filter(entity => entity.side === 0).map(entity => entity.id));
  scene.selectEntities(ids.filter(id => ownIds.has(id)));
  const target = point ?? observe().map.starts[0];
  scene.centerOn(target.x, target.y);
  focusEvents.push({ ids: [...ids], point: { ...target }, selected: [...scene.selected] });
  publish();
}
let coach = mountPracticeCoach(root, { focus }, fixtureStorage);
const scene = new GameScene({
  state, controls,
  onCommand: (side, command) => side === 0 && dispatch(command),
  onSelection: () => {},
  onNotice: text => { document.querySelector('#fixture-notice')!.textContent = text; },
  onReady: () => { ready = true; publish(); },
});
const game = new Phaser.Game({
  type: Phaser.CANVAS, parent: 'game', width: 1280, height: 950,
  scene: [scene], fps: { target: 60 },
});

function run(action: string, mutate: () => string | void) {
  if (!ready) return;
  const message = mutate();
  fixtureEvents.push({ action, tick: state.tick, time: state.time });
  document.querySelector('#fixture-notice')!.textContent = message ?? action;
  coach.update(observe());
  publish();
}
function bind(id: string, action: string, mutate: () => string | void) {
  document.querySelector(id)!.addEventListener('click', () => run(action, mutate));
}
function advance(seconds: number) {
  // Pause render-loop stepping before advancing so each test owns its duration.
  scene.paused = true;
  for (let tick = 0; tick < Math.round(seconds / .05); tick++) stepGame(state, .05);
  return `Advanced the simulation by ${seconds} second${seconds === 1 ? '' : 's'}.`;
}
bind('#freeze-fixture', 'Paused fixture match.', () => { scene.paused = true; });
bind('#resume-fixture', 'Resumed fixture match.', () => { scene.paused = false; });
bind('#advance-1', 'advance-1', () => advance(1));
bind('#advance-30', 'advance-30', () => advance(30));
bind('#gather-fixture', 'gather', () => {
  const observation = observe();
  const workers = observation.entities.filter(entity => entity.side === 0 && entity.kind === 'unit' && entity.role === 'worker');
  const wood = observation.resources.filter(resource => resource.visible && resource.kind === 'wood' && resource.amount > 0)
    .sort((a, b) => Math.hypot(a.x - workers[0].x, a.y - workers[0].y) - Math.hypot(b.x - workers[0].x, b.y - workers[0].y))[0];
  if (!wood) throw new Error('The fixture has no visible wood deposit.');
  return dispatch({ type: 'gather', ids: workers.map(worker => worker.id), target: wood.id }) ? 'Workers received normal gather commands.' : 'The gather command was rejected.';
});
bind('#train-fixture', 'train', () => {
  const hq = observe().entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  return dispatch({ type: 'train', id: hq.id, role: 'worker' }) ? 'The headquarters queued a worker through the normal train command.' : 'The train command was rejected.';
});
bind('#build-fixture', 'build', () => {
  const observation = observe();
  const worker = observation.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
  const sites: Vec[] = [];
  for (let y = .5; y < state.height; y++) for (let x = .5; x < state.width; x++) {
    if (canPlace(state, 0, 'depot', x, y)) sites.push({ x, y });
  }
  sites.sort((a, b) => Math.hypot(a.x - worker.x, a.y - worker.y) - Math.hypot(b.x - worker.x, b.y - worker.y));
  if (!sites.length) throw new Error('The fixture has no legal visible depot site.');
  return dispatch({ type: 'build', ids: [worker.id], role: 'depot', ...sites[0] }) ? 'A supply depot began through the normal build command.' : 'The build command was rejected.';
});
function copyOwnedUnit(template: Entity, point: Vec) {
  const entity: Entity = { ...structuredClone(template), id: state.nextId++, ...point, order: { type: 'idle' }, queue: [], path: [], carried: 0 };
  delete entity.orderQueue;
  state.entities.push(entity);
}
bind('#supply-fixture', 'supply-setup', () => {
  scene.paused = true;
  const template = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
  const ownUnits = state.entities.filter(entity => entity.side === 0 && entity.kind === 'unit' && entity.hp > 0);
  for (let index = ownUnits.length; index < state.players[0].cap; index++) copyOwnedUnit(template, { x: template.x + (index % 3) * .4, y: template.y + Math.floor(index / 3) * .4 });
  stepGame(state, .05);
  return 'Test setup added owned workers until the normal population cap was reached.';
});
bind('#bank-fixture', 'bank-setup', () => {
  scene.paused = true;
  state.players[0].wood = 2000;
  state.players[0].ore = 1000;
  state.players[0].crystal = 300;
  return 'Test setup gave the human player a large visible resource bank.';
});
bind('#army-fixture', 'army-setup', () => {
  scene.paused = true;
  const template = state.entities.find(entity => entity.side === 0 && entity.role === 'melee')!;
  const hq = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  for (let index = 0; index < 3; index++) copyOwnedUnit(template, { x: hq.x + 10, y: hq.y + index * .6 });
  for (let index = 0; index < 4; index++) copyOwnedUnit(template, { x: hq.x + index * .6, y: hq.y + 11 });
  refreshVisibility(state);
  stepGame(state, .05);
  return 'Test setup added two separated groups of owned melee units.';
});
function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}
bind('#privacy-fixture', 'privacy-setup', () => {
  scene.paused = true;
  const beforeView = observe();
  const beforeAdvice = coachAdvice(beforeView, createCoachMemory(0), 6);
  // Only this explicit test setup inspects hidden raw state. The coach input
  // before and after it remains PlayerView.observe, as in normal play.
  const enemyBuilding = state.entities.find(entity => entity.side === 1 && entity.kind === 'building' && !isVisible(state, 0, entity.x, entity.y));
  const hiddenResource = state.resources.find(resource => !isVisible(state, 0, resource.x, resource.y));
  state.players[1].wood += 10000;
  state.players[1].ore += 10000;
  state.players[1].crystal += 10000;
  if (enemyBuilding) { enemyBuilding.hp = Math.max(1, enemyBuilding.hp - 7); enemyBuilding.queue = ['worker', 'worker']; }
  if (hiddenResource) hiddenResource.amount = hiddenResource.amount > 0 ? 0 : hiddenResource.maxAmount;
  const afterView = observe();
  const afterAdvice = coachAdvice(afterView, createCoachMemory(0), 6);
  const before = JSON.stringify(beforeView), after = JSON.stringify(afterView);
  privacy = {
    changed: { enemyBank: true, hiddenBuilding: !!enemyBuilding, hiddenResource: !!hiddenResource },
    permittedViewUnchanged: before === after,
    adviceUnchanged: JSON.stringify(beforeAdvice) === JSON.stringify(afterAdvice),
    beforeViewHash: hash(before), afterViewHash: hash(after),
    beforeAdvice: structuredClone(beforeAdvice), afterAdvice: structuredClone(afterAdvice),
  };
  return privacy.permittedViewUnchanged && privacy.adviceUnchanged ? 'Hidden mutations left the permitted observation and advice unchanged.' : 'Hidden mutations changed the permitted observation or advice.';
});
bind('#remount-fixture', 'coach-remount', () => {
  coach.dispose();
  coach = mountPracticeCoach(root, { focus }, fixtureStorage);
  return 'Remounted the coach with its scoped browser preference store.';
});

function snapshot() {
  const observation = observe();
  type OwnEntity = Extract<CoachObservation['entities'][number], { order: unknown }>;
  const ownEntities = observation.entities.filter((entity): entity is OwnEntity => entity.side === 0 && 'order' in entity);
  return {
    ready, tick: state.tick, time: state.time, paused: scene.paused,
    controllers: [...state.controllers], selected: [...scene.selected],
    camera: ready ? { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY, zoom: scene.cameras.main.zoom } : null,
    player: { ...observation.player },
    workers: ownEntities.filter(entity => entity.role === 'worker').map(entity => ({ id: entity.id, x: entity.x, y: entity.y, order: entity.order, carried: entity.carried })),
    buildings: ownEntities.filter(entity => entity.kind === 'building').map(entity => ({ id: entity.id, role: entity.role, x: entity.x, y: entity.y, progress: entity.progress, queue: entity.queue })),
    army: ownEntities.filter(entity => entity.kind === 'unit' && entity.role !== 'worker').map(entity => ({ id: entity.id, x: entity.x, y: entity.y, order: entity.order })),
    visibleResources: observation.resources.filter(resource => resource.visible).map(resource => ({ id: resource.id, kind: resource.kind, amount: resource.amount })),
    generatedAdvice: structuredClone(generatedAdvice()),
    renderedTopics: Array.from(root.querySelectorAll('[data-coach-topic]')).map(row => row.getAttribute('data-coach-topic')),
    preferences: coach.getPreferences(), preferenceStorage: 'localStorage',
    storedPreferences: Object.fromEntries(storageKeys().map(key => [key, nativeStorage.getItem(key)])),
    commands: structuredClone(commands), focusEvents: structuredClone(focusEvents), fixtureEvents: structuredClone(fixtureEvents),
    costs: { worker: { ...FACTIONS.orcs.units.worker.cost }, depot: { ...FACTIONS.orcs.buildings.depot.cost } },
    privacy: structuredClone(privacy),
  };
}
Object.assign(window, { coachProof: { snapshot }, scene, game });
function publish() {
  if (!ready) return;
  const live = snapshot();
  document.querySelector('#proof-status')!.textContent = JSON.stringify({ time: Number(live.time.toFixed(2)), tick: live.tick, paused: live.paused, player: live.player, topics: live.renderedTopics, commands: live.commands.length }, null, 2);
  document.querySelector('#proof-data')!.textContent = JSON.stringify(live);
}
function refresh() {
  if (ready) { coach.update(observe()); publish(); }
  requestAnimationFrame(refresh);
}
refresh();
