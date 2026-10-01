import Phaser from 'phaser';
import { FACTIONS } from '../../src/core/content';
import {
  addBlueprint, applyWorkerTargets, assignBlueprintWorkers, cancelBlueprint,
  createConstructionPlan, executeBlueprints, syncConstructionPlan, validateWorkerTargets,
} from '../../src/core/planning';
import type { ConstructionBlueprint, WorkerTargets } from '../../src/core/planning';
import { canPlace, createGame, isVisible, issueCommand } from '../../src/core/simulation';
import type { BuildingRole, Command, Side, Vec } from '../../src/core/types';
import GameScene, { project, unproject } from '../../src/game/GameScene';
import { ControlProfiles } from '../../src/game/Controls';
import { mountPlanningTools } from '../../src/ui/PlanningTools';

// This fixture changes only its initial test budget. Terrain, visibility, resource
// nodes, workers and buildings come from the production seeded simulation.
const state = createGame('orcs', 4127, 'fairies', { controllers: ['external', 'external'] });
state.players[0].wood = 200;
const plan = createConstructionPlan(0);
let targets: WorkerTargets = { wood: 0, ore: 0, crystal: 0 };
const workerIds = state.entities.filter(entity => entity.side === 0 && entity.kind === 'unit' && entity.role === 'worker').map(entity => entity.id);
const sites: Vec[] = [{ x: 11.5, y: 6.5 }, { x: 8.5, y: 13.5 }, { x: 11.5, y: 15.5 }];
if (!sites.every(site => canPlace(state, 0, 'depot', site.x, site.y))) throw new Error('The seeded fixture sites are no longer legal. Update the browser proof setup.');
const commands: { side: Side; command: Command; accepted: boolean }[] = [];
const modalEvents: { open: boolean; paused: boolean; blocked: boolean; tick: number }[] = [];
let preview: readonly ConstructionBlueprint[] = [], modalOpen = false, previousPause = false, ready = false;
let placement: { role: BuildingRole; accept: (point: Vec) => void; cancel: () => void } | null = null;
const controls = new ControlProfiles(null);
controls.resetDefaults();

function permitted() {
  return !scene.readOnly && !scene.photoMode && scene.viewSide === 0 && state.winner === null && !state.draw;
}
function requireMutation() {
  if (!permitted()) throw new Error('Planning commands are unavailable in this view.');
}
function dispatch(side: Side, command: Command) {
  const accepted = permitted() && side === 0 && issueCommand(state, side, command);
  commands.push({ side, command: structuredClone(command), accepted });
  publishSnapshot();
  return accepted;
}
function onModal(open: boolean) {
  if (open && !modalOpen) {
    previousPause = scene.paused;
    scene.paused = true;
    scene.inputBlocked = true;
  } else if (!open && modalOpen) {
    scene.paused = previousPause;
    scene.inputBlocked = false;
  }
  modalOpen = open;
  modalEvents.push({ open, paused: scene.paused, blocked: scene.inputBlocked, tick: state.tick });
  publishSnapshot();
}
const scene = new GameScene({
  state, controls, onCommand: dispatch,
  onSelection: () => {},
  onNotice: text => { document.querySelector('#sites')!.textContent = text; },
  onReady: () => { ready = true; scene.selectEntities([workerIds[0]]); },
});
const tools = mountPlanningTools(document.querySelector<HTMLElement>('#planning-root')!, {
  getPlan: () => plan,
  getTargets: () => ({ ...targets }),
  setTargets: value => { requireMutation(); if (!validateWorkerTargets(value)) return false; targets = { ...value }; publishSnapshot(); return true; },
  applyTargets: value => { requireMutation(); const result = applyWorkerTargets(state, 0, value, dispatch); publishSnapshot(); return result; },
  addBlueprint: spec => { requireMutation(); const result = addBlueprint(state, 0, plan, spec); publishSnapshot(); return result; },
  assignBlueprintWorkers: (id, ids) => { requireMutation(); const result = assignBlueprintWorkers(state, 0, plan, id, ids); publishSnapshot(); return result; },
  cancelBlueprint: id => { requireMutation(); const result = cancelBlueprint(plan, id); publishSnapshot(); return result; },
  executeBlueprints: () => { requireMutation(); const result = executeBlueprints(state, 0, plan, dispatch); publishSnapshot(); return result; },
  selectedWorkerIds: () => [...scene.selected],
  onPreview: items => { preview = structuredClone(items); publishSnapshot(); },
  onModal,
  beginPlacement: (role, accept, cancel) => {
    requireMutation(); placement = { role, accept, cancel };
    scene.inputBlocked = true;
    document.querySelector('#sites')!.textContent = 'Test placement: click the battlefield to add a plan. Escape cancels. Resources are spent only by Construct assigned plans.';
    publishSnapshot();
  },
  cancelPlacement: () => { placement = null; scene.inputBlocked = modalOpen; publishSnapshot(); },
});
const game = new Phaser.Game({
  type: Phaser.CANVAS, parent: 'game', width: 1280, height: 950,
  scene: [scene], fps: { target: 60 },
});
game.events.once(Phaser.Core.Events.READY, () => {
  // Blueprint placement records a map position. The ordinary GameScene build
  // input is blocked during this test-only adapter's placement mode.
  game.canvas.addEventListener('pointerup', event => {
    if (!placement || event.button !== 0) return;
    const rect = game.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * game.canvas.width / rect.width;
    const y = (event.clientY - rect.top) * game.canvas.height / rect.height;
    const world = scene.cameras.main.getWorldPoint(x, y), point = unproject(world.x, world.y);
    const current = placement; placement = null; scene.inputBlocked = false;
    current.accept(current.role === 'gate'
      ? { x: Math.round(point.x), y: Math.round(point.y) }
      : { x: Math.floor(point.x) + .5, y: Math.floor(point.y) + .5 });
  });
});
window.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !placement) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const current = placement; placement = null; scene.inputBlocked = false; current.cancel();
}, true);
for (let index = 0; index < 3; index++) {
  document.querySelector(`#select-worker-${index + 1}`)!.addEventListener('click', () => {
    scene.selectEntities([workerIds[index]]);
    publishSnapshot();
  });
}
document.querySelector('#pause-fixture')!.addEventListener('click', () => { scene.togglePause(); publishSnapshot(); });
document.querySelector('#fund-fixture')!.addEventListener('click', () => { state.players[0].wood += 100; publishSnapshot(); });
document.querySelector('#read-only-fixture')!.addEventListener('click', () => { scene.readOnly = !scene.readOnly; publishSnapshot(); });
document.querySelector('#sites')!.textContent = `Legal depot sites: ${sites.map(site => `(${site.x}, ${site.y})`).join(', ')}.`;

function snapshot() {
  const current = scene.state;
  const ownedWorkers = current.entities.filter(entity => entity.side === 0 && entity.kind === 'unit' && entity.role === 'worker');
  const gatherCounts: WorkerTargets = { wood: 0, ore: 0, crystal: 0 };
  const workers = ownedWorkers.map(worker => {
    const targetId = worker.order.type === 'gather' ? worker.order.target : undefined;
    const node = targetId === undefined ? undefined : current.resources.find(resource => resource.id === targetId);
    if (node) gatherCounts[node.kind]++;
    return {
      id: worker.id, x: worker.x, y: worker.y, order: structuredClone(worker.order),
      carried: worker.carried, gatherKind: node?.kind,
      targetVisible: !!node && isVisible(current, 0, node.x, node.y), targetActive: !!node && node.amount > 0,
    };
  });
  return {
    ready, tick: current.tick, time: current.time, paused: scene.paused, inputBlocked: scene.inputBlocked,
    readOnly: scene.readOnly, modalOpen, selected: [...scene.selected],
    camera: { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY, zoom: scene.cameras.main.zoom },
    resources: { wood: current.players[0].wood, ore: current.players[0].ore, crystal: current.players[0].crystal },
    targets: { ...targets }, gatherCounts, workerIds, workers,
    buildings: current.entities.filter(entity => entity.side === 0 && entity.kind === 'building').map(entity => ({ id: entity.id, role: entity.role, x: entity.x, y: entity.y, progress: entity.progress })),
    blueprints: structuredClone(plan.blueprints), preview: structuredClone(preview),
    depotCost: { ...FACTIONS.orcs.buildings.depot.cost }, sites: structuredClone(sites),
    commands: structuredClone(commands), modalEvents: structuredClone(modalEvents),
    // Projected screen coordinates let a browser caller click the real canvas.
    siteScreens: sites.map(site => {
      const world = project(site.x, site.y);
      return scene.cameras.main.matrixCombined.transformPoint(world.x, world.y);
    }).map(point => ({ x: point.x, y: point.y })),
  };
}
Object.assign(window, { planningProof: { get ready() { return ready; }, snapshot }, scene, game });
function publishSnapshot() {
  if (!ready) return;
  const live = snapshot();
  document.querySelector('#proof-status')!.textContent = JSON.stringify({ tick: live.tick, paused: live.paused, inputBlocked: live.inputBlocked, resources: live.resources, gatherCounts: live.gatherCounts, plans: live.blueprints.map(item => ({ id: item.id, status: item.status, workers: item.workerIds, reason: item.reason })) }, null, 2);
  document.querySelector('#proof-data')!.textContent = JSON.stringify(live);
}
function refresh() {
  if (ready) {
    syncConstructionPlan(state, plan);
    tools.update(state, { side: 0, readOnly: scene.readOnly || scene.photoMode, blocked: scene.inputBlocked && !modalOpen });
    publishSnapshot();
  }
  requestAnimationFrame(refresh);
}
refresh();
