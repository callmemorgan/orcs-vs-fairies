// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildingFor, contentHash, createContentBundle } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import {
  addBlueprint, applyWorkerTargets, assignBlueprintWorkers, blueprintReason, cancelBlueprint,
  createConstructionPlan, decodeConstructionPlan, executeBlueprints,
} from '../src/core/planning';
import type { ConstructionPlan } from '../src/core/planning';
import { canPlace, createMatch, issueCommand } from '../src/core/simulation';
import type { BuildingRole, FactionId, GameState } from '../src/core/types';
import { mountShell, type HudCallbacks } from '../src/ui/Hud';
import { mountPlanningTools, type PlanningToolsCallbacks } from '../src/ui/PlanningTools';
import { canvasContextStub } from './helpers/canvas-context';

const tools: ReturnType<typeof mountPlanningTools>[] = [];
afterEach(() => {
  for (const tool of tools.splice(0)) tool.dispose();
  vi.restoreAllMocks(); document.body.replaceChildren();
});

function fixture(tag?: 'barricade' | 'beacon') {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    ...canvasContextStub(), clearRect() {}, setLineDash() {}, strokeRect() {}, fillText() {},
  } as unknown as CanvasRenderingContext2D);
  let faction: FactionId = 'orcs', content;
  if (tag) {
    const pkg = structuredClone(exampleMod());
    pkg.factions[0].buildings[0].tags = [tag];
    const { hash: _, ...body } = pkg; pkg.hash = contentHash(body);
    content = createContentBundle([pkg]); faction = 'lantern:keepers';
  }
  const state = createMatch({ content, map: { seed: 4127, size: 'small' }, rules: { startingAge: 3 }, players: [
    { id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 1000 } } },
    { id: 1, teamId: 1, factionId: 'fairies', controller: 'external' },
  ] });
  state.terrain.fill('grass'); state.resources = [];
  // Authority is tested at a fully observed, physically legal site.
  state.visible[0] = new Set(state.terrain.map((_, i) => i)); state.explored[0] = new Set(state.visible[0]);
  const worker = state.entities.find(e => e.side === 0 && e.role === 'worker')!;
  const point = (role: BuildingRole, definitionId?: string) => {
    for (let y = 2.5; y < state.height - 2; y++) for (let x = 2.5; x < state.width - 2; x++) if (canPlace(state, 0, role, x, y, definitionId)) return { x, y };
    throw new Error('No physically valid building site.');
  };
  return { state, worker, point };
}
function resources(s: GameState) {
  const { wood, ore, crystal } = s.players[0]; return { wood, ore, crystal };
}
function unchangedAfterRejectedBuild(s: GameState, worker: number, role: BuildingRole, point: { x: number; y: number }, definitionId?: string) {
  const before = { resources: resources(s), nextId: s.nextId, entities: structuredClone(s.entities) };
  expect(issueCommand(s, 0, { type: 'build', ids: [worker], role, definitionId, ...point })).toBe(false);
  expect(resources(s)).toEqual(before.resources); expect(s.nextId).toBe(before.nextId); expect(s.entities).toEqual(before.entities);
}
function mountHud(state: GameState, worker: number, build = vi.fn()) {
  const root = document.createElement('div'); document.body.append(root);
  const shell = mountShell(root, () => {}); shell.showGame();
  shell.update(state, [worker], { isMuted: () => false, groups: () => ({}), cameraCorners: () => [], build } as unknown as HudCallbacks);
  return root;
}
function mountPlanner(state: GameState, worker: number, plan = createConstructionPlan(0)) {
  const root = document.createElement('div'); document.body.append(root);
  const callbacks: PlanningToolsCallbacks = {
    getPlan: () => plan, getTargets: () => ({ wood: 0, ore: 0, crystal: 0 }), setTargets: () => true,
    applyTargets: targets => applyWorkerTargets(state, 0, targets),
    addBlueprint: input => addBlueprint(state, 0, plan, input),
    assignBlueprintWorkers: (id, ids) => assignBlueprintWorkers(state, 0, plan, id, ids),
    cancelBlueprint: id => cancelBlueprint(plan, id), executeBlueprints: () => executeBlueprints(state, 0, plan),
    selectedWorkerIds: () => [worker], onModal: vi.fn(),
  };
  const tool = mountPlanningTools(root, callbacks); tools.push(tool); tool.update(state);
  root.querySelector<HTMLButtonElement>('[data-planning-launch]')!.click();
  return { root, plan, select: root.querySelector<HTMLSelectElement>('[aria-label="Blueprint building"]')! };
}

describe('ordinary building authority', () => {
  it('hides specialist placements in the normal HUD and planning catalog while a beacon click creates a paid foundation', () => {
    const { state, worker, point } = fixture(), site = point('tower', 'core:orcs-beacon');
    const build = vi.fn((role: BuildingRole, definitionId?: string) => issueCommand(state, 0, { type: 'build', ids: [worker.id], role, definitionId, ...site }));
    const root = mountHud(state, worker.id, build), actions = root.querySelector('#action-buttons')!;
    expect(actions.querySelector('[aria-label="Trophy Standard"]')).toBeNull();
    expect(actions.querySelector('[aria-label="Field Barricade"]')).toBeNull();
    const def = buildingFor(state, 0, 'tower', 'core:orcs-beacon');
    const beacon = actions.querySelector<HTMLButtonElement>('[aria-label="' + def.name + '"]')!;
    expect(beacon).not.toBeNull(); expect(beacon.getAttribute('aria-disabled')).toBe('false');
    const before = resources(state);
    beacon.click(); expect(build).toHaveBeenLastCalledWith('tower', 'core:orcs-beacon');
    expect(resources(state)).toEqual({ wood: before.wood - def.cost.wood, ore: before.ore - def.cost.ore, crystal: before.crystal - def.cost.crystal });
    expect(state.entities.at(-1)).toMatchObject({ kind: 'building', definitionId: 'core:orcs-beacon', progress: 0, ...site });
    const planner = mountPlanner(state, worker.id);
    expect(Array.from(planner.select.options, option => option.value).sort()).toEqual(['barracks', 'depot', 'gate', 'hq', 'tower', 'wall']);
    expect(planner.select.textContent).not.toContain('Trophy Standard'); expect(planner.select.textContent).not.toContain('Field Barricade');
  });

  it.each([
    ['core:orcs-trophy-standard', 'depot'],
    ['core:field-barricade', 'wall'],
  ] as const)('rejects an explicit generic build of %s at a physically legal site without paying or placing a foundation', (definitionId, role) => {
    const { state, worker, point } = fixture(), site = point(role, definitionId);
    expect(canPlace(state, 0, role, site.x, site.y, definitionId)).toBe(true);
    unchangedAfterRejectedBuild(state, worker.id, role, site, definitionId);
  });

  it('excludes an admitted custom default barricade from HUD and planning, and rejects direct, parsed and forged blueprint placement', () => {
    const { state, worker, point } = fixture('barricade'), site = point('barracks', 'lantern:hall');
    expect(buildingFor(state, 0, 'barracks').tags).toEqual(['barricade']);
    expect(canPlace(state, 0, 'barracks', site.x, site.y, 'lantern:hall')).toBe(true);
    const hud = mountHud(state, worker.id);
    expect(hud.querySelector('#action-buttons [aria-label="Lantern Hall"]')).toBeNull();
    const { select, plan } = mountPlanner(state, worker.id);
    expect(Array.from(select.options, option => option.value)).not.toContain('barracks');
    expect(select.textContent).not.toContain('Lantern Hall');
    const before = resources(state);
    expect(() => addBlueprint(state, 0, plan, { role: 'barracks', ...site })).toThrow('specialized placement command');
    expect(plan).toEqual(createConstructionPlan(0)); expect(resources(state)).toEqual(before);
    unchangedAfterRejectedBuild(state, worker.id, 'barracks', site);
    unchangedAfterRejectedBuild(state, worker.id, 'barracks', site, 'lantern:hall');
    const forged: ConstructionPlan = { version: 1, side: 0, nextId: 2, blueprints: [
      { id: 'blueprint-1', role: 'barracks', ...site, workerIds: [worker.id], status: 'planned' },
    ] };
    expect(decodeConstructionPlan(forged, state, 0)).toBeUndefined();
    expect(blueprintReason(state, 0, forged.blueprints[0])).toContain('specialized placement command');
    const dispatch = vi.fn(() => true), entities = state.entities.length, nextId = state.nextId;
    expect(executeBlueprints(state, 0, forged, dispatch)).toEqual({ started: [], pending: [
      { id: 'blueprint-1', reason: 'This building requires its specialized placement command.' },
    ] });
    expect(dispatch).not.toHaveBeenCalled(); expect(resources(state)).toEqual(before);
    expect(state.entities).toHaveLength(entities); expect(state.nextId).toBe(nextId);
  });

  it('keeps an admitted paid default beacon in the planning catalog and constructs it through an assigned normal blueprint', () => {
    const { state, worker, point } = fixture('beacon'), site = point('barracks'), before = resources(state);
    const { select, plan } = mountPlanner(state, worker.id), def = buildingFor(state, 0, 'barracks');
    expect(def.tags).toEqual(['beacon']); expect(select.querySelector('option[value="barracks"]')!.textContent).toContain('Lantern Hall');
    const blueprint = addBlueprint(state, 0, plan, { role: 'barracks', ...site });
    expect(resources(state)).toEqual(before); expect(decodeConstructionPlan(plan, state, 0)).toBeDefined();
    expect(assignBlueprintWorkers(state, 0, plan, blueprint.id, [worker.id])).toBe(true);
    expect(blueprintReason(state, 0, blueprint)).toBe('');
    expect(executeBlueprints(state, 0, plan)).toEqual({ started: [blueprint.id], pending: [] });
    expect(resources(state)).toEqual({ wood: before.wood - def.cost.wood, ore: before.ore - def.cost.ore, crystal: before.crystal - def.cost.crystal });
    expect(state.entities.find(e => e.id === blueprint.buildingId)).toMatchObject({ kind: 'building', role: 'barracks', progress: 0, ...site });
  });
});
