// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FACTIONS } from '../src/core/content';
import {
  addBlueprint, applyWorkerTargets, assignBlueprintWorkers, cancelBlueprint,
  createConstructionPlan, executeBlueprints, syncConstructionPlan,
} from '../src/core/planning';
import { createGame, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { BuildingRole, ResourceKind, Vec } from '../src/core/types';
import { mountPlanningTools } from '../src/ui/PlanningTools';

type Tools = ReturnType<typeof mountPlanningTools>;
type Callbacks = Parameters<typeof mountPlanningTools>[1];
type Status = Parameters<Tools['update']>[1];

const mounted: Tools[] = [];
afterEach(() => {
  for (const tools of mounted.splice(0)) tools.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function button(root: ParentNode, name: string | RegExp): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(element => {
    const labels = [element.getAttribute('aria-label') ?? '', element.textContent?.trim() ?? ''];
    return labels.some(label => typeof name === 'string' ? label === name : name.test(label));
  });
  expect(found, `Missing button ${String(name)}`).toBeDefined();
  return found!;
}

function field<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(root: ParentNode, label: string): T {
  const found = Array.from(root.querySelectorAll<T>('input,select')).find(element => element.getAttribute('aria-label') === label);
  expect(found, `Missing input ${label}`).toBeDefined();
  return found!;
}

function setInput(element: HTMLInputElement | HTMLSelectElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function action(root: ParentNode, label: string) {
  const control = button(root, label);
  control.click();
  await vi.waitFor(() => expect(control.dataset.busy).not.toBe('true'));
}

function fixture() {
  const state = createGame('orcs', 4127, 'fairies', { controllers: ['human', 'human'] });
  state.terrain.fill('grass');
  const hq = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  state.resources = (['wood', 'ore', 'crystal'] as ResourceKind[]).map((kind, index) => ({
    id: state.nextId++, kind, x: hq.x + 7, y: hq.y + 3 + index * 1.5,
    amount: 1000, maxAmount: 1000,
  }));
  refreshVisibility(state);
  const workers = state.entities.filter(entity => entity.side === 0 && entity.role === 'worker');
  const points = [{ x: hq.x + 6, y: hq.y }, { x: hq.x - 6, y: hq.y }, { x: hq.x, y: hq.y - 6 }];
  return { state, workers, hq, points };
}

function setup(status: Status = {}, toolbar?:HTMLElement) {
  const fixtureData = fixture();
  const { state, workers } = fixtureData;
  const plan = createConstructionPlan(0);
  let targets = { wood: 0, ore: 0, crystal: 0 };
  let selected = workers.slice(0, 2).map(worker => worker.id);
  const callbacks = {
    getPlan: vi.fn(() => { syncConstructionPlan(state, plan); return plan; }),
    getTargets: vi.fn(() => ({ ...targets })),
    setTargets: vi.fn<Callbacks['setTargets']>(value => { targets = { ...value }; return true; }),
    applyTargets: vi.fn<Callbacks['applyTargets']>(value => applyWorkerTargets(state, 0, value)),
    addBlueprint: vi.fn<Callbacks['addBlueprint']>(value => addBlueprint(state, 0, plan, value)),
    assignBlueprintWorkers: vi.fn<Callbacks['assignBlueprintWorkers']>((id, ids) => assignBlueprintWorkers(state, 0, plan, id, ids)),
    cancelBlueprint: vi.fn<Callbacks['cancelBlueprint']>(id => cancelBlueprint(plan, id)),
    executeBlueprints: vi.fn<Callbacks['executeBlueprints']>(() => executeBlueprints(state, 0, plan)),
    selectedWorkerIds: vi.fn(() => selected.slice()),
    onPreview: vi.fn<NonNullable<Callbacks['onPreview']>>(),
    onModal: vi.fn<Callbacks['onModal']>(),
    beginPlacement: vi.fn<NonNullable<Callbacks['beginPlacement']>>(),
    cancelPlacement: vi.fn<NonNullable<Callbacks['cancelPlacement']>>(),
  } satisfies Callbacks;
  const root = document.createElement('div');
  document.body.append(root);
  const tools = mountPlanningTools(root, { ...callbacks, toolbar });
  mounted.push(tools);
  tools.update(state, status);
  return { ...fixtureData, root, tools, callbacks, plan, select: (ids: number[]) => { selected = ids; } };
}

function open(root: ParentNode): HTMLElement {
  root.querySelector<HTMLButtonElement>('[data-planning-launch]')!.click();
  const dialog = root.querySelector<HTMLElement>('[role="dialog"][aria-label="Settlement planning"]');
  expect(dialog).not.toBeNull();
  return dialog!;
}

function message(root: ParentNode): string {
  return root.querySelector('[role="status"]')?.textContent ?? '';
}

function setTargets(root: ParentNode, wood: string, ore: string, crystal: string) {
  setInput(field(root, 'Wood worker target'), wood);
  setInput(field(root, 'Ore worker target'), ore);
  setInput(field(root, 'Crystal worker target'), crystal);
}

async function addPlan(root: ParentNode, point: Vec, role: BuildingRole = 'depot') {
  setInput(field<HTMLSelectElement>(root, 'Blueprint building'), role);
  setInput(field(root, 'Blueprint X'), String(point.x));
  setInput(field(root, 'Blueprint Y'), String(point.y));
  await action(root, 'Add blueprint');
}

function blueprint(root: ParentNode, id: string): HTMLElement {
  const item = root.querySelector<HTMLElement>(`[data-blueprint-id="${id}"]`);
  expect(item, `Missing blueprint ${id}`).not.toBeNull();
  return item!;
}

describe('worker allocation panel', () => {
  it('saves targets without changing orders, then issues real gathering commands when applied', async () => {
    const { root, callbacks, workers, state } = setup();
    const dialog = open(root);
    const resources = structuredClone(state.players[0]);
    setTargets(dialog, '2', '1', '1');
    await action(dialog, 'Save worker targets');
    expect(callbacks.setTargets).toHaveBeenCalledWith({ wood: 2, ore: 1, crystal: 1 });
    expect(callbacks.getTargets()).toEqual({ wood: 2, ore: 1, crystal: 1 });
    expect(workers.every(worker => worker.order.type === 'idle')).toBe(true);
    expect(state.players[0]).toEqual(resources);

    await action(dialog, 'Apply worker targets');
    expect(callbacks.applyTargets).toHaveBeenCalledWith({ wood: 2, ore: 1, crystal: 1 });
    const allocation = { wood: 0, ore: 0, crystal: 0 };
    for (const worker of workers) {
      if (worker.order.type !== 'gather') continue;
      const target = worker.order.target;
      const resource = state.resources.find(node => node.id === target)!;
      allocation[resource.kind]++;
    }
    expect(allocation).toEqual({ wood: 2, ore: 1, crystal: 1 });
    expect(workers.filter(worker => worker.order.type === 'idle')).toHaveLength(1);
    expect(state.players[0]).toEqual(resources);
    for (let tick = 0; tick < 400; tick++) stepGame(state, .05);
    expect(state.resources.every(node => node.amount < node.maxAmount)).toBe(true);
    expect(state.players[0].wood).toBeGreaterThan(resources.wood);
  });

  it('retains worker drafts and focused input across simulation frame updates', async () => {
    const { root, state, tools, callbacks } = setup();
    const dialog = open(root);
    const wood = field(dialog, 'Wood worker target');
    setTargets(dialog, '3', '0', '2');
    wood.focus();
    state.tick = 80;
    tools.update(state, {});
    expect(field(dialog, 'Wood worker target')).toBe(wood);
    expect(wood.value).toBe('3');
    expect(document.activeElement).toBe(wood);
    await action(dialog, 'Apply worker targets');
    expect(callbacks.applyTargets).toHaveBeenCalledWith({ wood: 3, ore: 0, crystal: 2 });
  });

  it.each(['-1', '1.5', ''])('rejects invalid worker target %s before invoking mutations', async value => {
    const { root, callbacks } = setup();
    const dialog = open(root);
    setTargets(dialog, value, '0', '0');
    await action(dialog, 'Save worker targets');
    await action(dialog, 'Apply worker targets');
    expect(callbacks.setTargets).not.toHaveBeenCalled();
    expect(callbacks.applyTargets).not.toHaveBeenCalled();
    expect(message(root)).toMatch(/target|whole|number|valid/i);
  });
});

describe('construction blueprint panel', () => {
  it('plans several buildings with no cost, assigns workers, and pays only for issued construction', async () => {
    const { root, callbacks, workers, state, points } = setup();
    const dialog = open(root);
    const before = structuredClone(state.players[0]);
    const initialBuildings = state.entities.filter(entity => entity.kind === 'building').length;
    await addPlan(dialog, points[0]);
    await addPlan(dialog, points[1]);
    expect(callbacks.addBlueprint).toHaveBeenCalledTimes(2);
    const [first, second] = callbacks.addBlueprint.mock.results.map(result => result.value);
    expect(state.players[0]).toEqual(before);
    expect(workers.every(worker => worker.order.type === 'idle')).toBe(true);
    expect(state.entities.filter(entity => entity.kind === 'building')).toHaveLength(initialBuildings);
    expect(root.querySelector('[aria-label="Planned construction preview"]')).not.toBeNull();
    await action(blueprint(dialog, first.id), 'Assign selected workers');
    expect(callbacks.assignBlueprintWorkers).toHaveBeenCalledWith(first.id, workers.slice(0, 2).map(worker => worker.id));
    expect(state.players[0]).toEqual(before);
    await action(dialog, 'Construct assigned plans');
    expect(callbacks.executeBlueprints).toHaveBeenCalledTimes(1);
    const cost = FACTIONS.orcs.buildings.depot.cost;
    expect(state.players[0].wood).toBe(before.wood - cost.wood);
    expect(state.players[0].ore).toBe(before.ore - cost.ore);
    expect(state.players[0].crystal).toBe(before.crystal - cost.crystal);
    const started = state.entities.find(entity => entity.side === 0 && entity.kind === 'building' && entity.role === 'depot')!;
    expect(started.progress).toBeLessThan(1);
    expect(workers[0].order).toEqual({ type: 'build', target: started.id });
    expect(workers[1].order).toEqual({ type: 'build', target: started.id });
    expect(blueprint(dialog, second.id)).not.toBeNull();
    for (let tick = 0; tick < 700; tick++) stepGame(state, .05);
    expect(started.progress).toBe(1);
    expect(state.players[0].cap).toBe(before.cap + 10);
  });

  it('keeps an assigned blueprint when resources are insufficient and starts it after resources recover', async () => {
    const { root, state, tools, points, callbacks } = setup();
    const dialog = open(root);
    state.players[0].wood = 0;
    await addPlan(dialog, points[0]);
    const plan = callbacks.addBlueprint.mock.results[0].value;
    await action(blueprint(dialog, plan.id), 'Assign selected workers');
    await action(dialog, 'Construct assigned plans');
    expect(state.entities.some(entity => entity.side === 0 && entity.role === 'depot')).toBe(false);
    expect(state.players[0].wood).toBe(0);
    expect(blueprint(dialog, plan.id).textContent).toMatch(/wood|resource|afford/i);
    state.players[0].wood = FACTIONS.orcs.buildings.depot.cost.wood;
    tools.update(state, {});
    await action(dialog, 'Construct assigned plans');
    expect(state.entities.some(entity => entity.side === 0 && entity.role === 'depot')).toBe(true);
    expect(state.players[0].wood).toBe(0);
  });

  it('excludes foreign workers from battlefield selection without giving them orders or spending resources', async () => {
    const { root, state, select, points, callbacks } = setup();
    const dialog = open(root);
    await addPlan(dialog, points[0]);
    const plan = callbacks.addBlueprint.mock.results[0].value;
    const foreign = state.entities.find(entity => entity.side === 1 && entity.role === 'worker')!;
    select([foreign.id]);
    const before = structuredClone(state.players[0]);
    button(dialog, 'Use battlefield selection').click();
    expect(button(blueprint(dialog, plan.id), 'Assign selected workers').disabled).toBe(true);
    button(blueprint(dialog, plan.id), 'Assign selected workers').click();
    expect(callbacks.assignBlueprintWorkers).not.toHaveBeenCalled();
    button(dialog, 'Construct assigned plans').click();
    expect(foreign.order.type).toBe('idle');
    expect(state.players[0]).toEqual(before);
    expect(state.entities.some(entity => entity.side === 0 && entity.role === 'depot')).toBe(false);
  });

  it('cancels a pending blueprint without issuing a command or changing resources', async () => {
    const { root, points, callbacks, state, workers } = setup();
    const dialog = open(root);
    const before = structuredClone(state.players[0]);
    await addPlan(dialog, points[0]);
    const plan = callbacks.addBlueprint.mock.results[0].value;
    await action(blueprint(dialog, plan.id), 'Cancel blueprint');
    expect(callbacks.cancelBlueprint).toHaveBeenCalledWith(plan.id);
    expect(root.querySelector(`[data-blueprint-id="${plan.id}"]`)).toBeNull();
    expect(state.players[0]).toEqual(before);
    expect(workers.every(worker => worker.order.type === 'idle')).toBe(true);
  });

  it('retains building and coordinate drafts across frame updates', async () => {
    const { root, state, tools, points, callbacks } = setup();
    const dialog = open(root);
    const x = field(dialog, 'Blueprint X');
    setInput(field<HTMLSelectElement>(dialog, 'Blueprint building'), 'barracks');
    setInput(x, String(points[0].x));
    setInput(field(dialog, 'Blueprint Y'), String(points[0].y));
    x.focus();
    state.tick = 120;
    tools.update(state, {});
    expect(field(dialog, 'Blueprint X')).toBe(x);
    expect(document.activeElement).toBe(x);
    await action(dialog, 'Add blueprint');
    expect(callbacks.addBlueprint).toHaveBeenCalledWith({ role: 'barracks', ...points[0] });
  });

  it('assigns a replacement worker and resumes a stopped foundation without buying another building', async () => {
    const { root, callbacks, points, state, workers, select, tools } = setup();
    select([workers[0].id]);
    const dialog = open(root);
    await addPlan(dialog, points[0]);
    const plan = callbacks.addBlueprint.mock.results[0].value;
    await action(blueprint(dialog, plan.id), 'Assign selected workers');
    await action(dialog, 'Construct assigned plans');
    const foundation = state.entities.find(entity => entity.id === plan.buildingId)!;
    const paid = structuredClone(state.players[0]);
    expect(issueCommand(state, 0, { type: 'stop', ids: [workers[0].id] })).toBe(true);
    tools.update(state, {});
    for (const choice of Array.from(dialog.querySelectorAll<HTMLInputElement>('[data-worker-choice]'))) {
      choice.checked = Number(choice.dataset.workerChoice) === workers[3].id;
      choice.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(button(blueprint(dialog, plan.id), 'Assign selected workers').disabled).toBe(false);
    await action(blueprint(dialog, plan.id), 'Assign selected workers');
    expect(callbacks.assignBlueprintWorkers).toHaveBeenLastCalledWith(plan.id, [workers[3].id]);
    await action(dialog, 'Construct assigned plans');
    expect(workers[3].order).toEqual({ type: 'build', target: foundation.id });
    expect(state.entities.filter(entity => entity.side === 0 && entity.role === 'depot')).toHaveLength(1);
    expect(state.players[0]).toEqual(paid);
    for (let tick = 0; tick < 800; tick++) stepGame(state, .05);
    expect(foundation.progress).toBe(1);
  });

  it('publishes completed and destroyed blueprints while its dialog is closed', async () => {
    const { root, callbacks, points, state, tools } = setup();
    const dialog = open(root);
    await addPlan(dialog, points[0]);
    const plan = callbacks.addBlueprint.mock.results[0].value;
    await action(blueprint(dialog, plan.id), 'Assign selected workers');
    await action(dialog, 'Construct assigned plans');
    const foundation = state.entities.find(entity => entity.id === plan.buildingId)!;
    button(dialog, /close/i).click();
    callbacks.onPreview.mockClear();
    for (let tick = 0; tick < 700; tick++) stepGame(state, .05);
    tools.update(state, {});
    expect(callbacks.onPreview).toHaveBeenLastCalledWith([expect.objectContaining({ id: plan.id, status: 'complete', buildingId: foundation.id })]);
    foundation.hp = 0;
    tools.update(state, {});
    expect(callbacks.onPreview).toHaveBeenLastCalledWith([expect.objectContaining({ id: plan.id, status: 'planned' })]);
    expect(callbacks.onPreview.mock.lastCall![0][0].buildingId).toBeUndefined();
  });
});

describe('planning panel lifecycle and failures', () => {
  it('disables mutations while observing a read-only match', async () => {
    const { root, state, tools, callbacks, points } = setup();
    const dialog = open(root);
    await addPlan(dialog, points[0]);
    const plan = callbacks.addBlueprint.mock.results[0].value;
    tools.update(state, { readOnly: true });
    for (const label of ['Save worker targets', 'Apply worker targets', 'Add blueprint', 'Place on battlefield', 'Construct assigned plans']) {
      expect(button(dialog, label).disabled, label).toBe(true);
      button(dialog, label).click();
    }
    for (const label of ['Assign selected workers', 'Cancel blueprint']) {
      expect(button(blueprint(dialog, plan.id), label).disabled, label).toBe(true);
      button(blueprint(dialog, plan.id), label).click();
    }
    expect(callbacks.setTargets).not.toHaveBeenCalled();
    expect(callbacks.applyTargets).not.toHaveBeenCalled();
    expect(callbacks.addBlueprint).toHaveBeenCalledTimes(1);
    expect(callbacks.assignBlueprintWorkers).not.toHaveBeenCalled();
    expect(callbacks.cancelBlueprint).not.toHaveBeenCalled();
    expect(callbacks.executeBlueprints).not.toHaveBeenCalled();
    expect(callbacks.beginPlacement).not.toHaveBeenCalled();
  });

  it('blocks the launcher while another modal is open and releases its modal on close or disposal', () => {
    const { root, state, tools, callbacks } = setup({ blocked: true });
    const launch = root.querySelector<HTMLButtonElement>('[data-planning-launch]')!;
    expect(launch.disabled).toBe(true);
    launch.click();
    expect(callbacks.onModal).not.toHaveBeenCalledWith(true);
    tools.update(state, {});
    const dialog = open(root);
    launch.click();
    expect(callbacks.onModal.mock.calls.filter(([open]) => open)).toHaveLength(1);
    button(dialog, /close/i).click();
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
    open(root);
    tools.dispose();
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
    expect(root.querySelector('[data-planning-launch]')).toBeNull();
  });

  it('closes on Escape and prevents planning without an active match', () => {
    const { root, state, tools, callbacks } = setup();
    open(root);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
    tools.update(null, {});
    expect(root.querySelector<HTMLButtonElement>('[data-planning-launch]')!.disabled).toBe(true);
    tools.update(state, {});
    expect(root.querySelector<HTMLButtonElement>('[data-planning-launch]')!.disabled).toBe(false);
  });

  it('reports callback failures and renders exception messages as text', async () => {
    const { root, callbacks, points, state } = setup();
    const dialog = open(root);
    const before = structuredClone(state.players[0]);
    callbacks.setTargets.mockReturnValue(false);
    setTargets(dialog, '2', '0', '0');
    await action(dialog, 'Save worker targets');
    expect(message(root)).toMatch(/could not|failed|unable/i);
    callbacks.setTargets.mockReturnValue(true);
    callbacks.applyTargets.mockImplementation(() => { throw new Error('Allocation unavailable'); });
    await action(dialog, 'Apply worker targets');
    expect(message(root)).toContain('Allocation unavailable');
    callbacks.addBlueprint.mockImplementation(() => { throw new Error('Invalid <img src=x onerror=alert(1)>'); });
    await addPlan(dialog, points[0]);
    expect(message(root)).toContain('Invalid <img');
    expect(root.querySelector('img')).toBeNull();
    expect(state.players[0]).toEqual(before);
    expect(state.entities.some(entity => entity.side === 0 && entity.role === 'depot')).toBe(false);
  });

  it('refuses a second visible modal and restores focus after the planning dialog closes', () => {
    const { root, callbacks } = setup();
    const other = document.createElement('section');
    other.setAttribute('role', 'dialog');
    other.setAttribute('aria-modal', 'true');
    document.body.append(other);
    const launch = root.querySelector<HTMLButtonElement>('[data-planning-launch]')!;
    launch.focus();
    launch.click();
    expect(callbacks.onModal).not.toHaveBeenCalledWith(true);
    other.hidden = true;
    const dialog = open(root);
    expect(document.activeElement).toBe(button(dialog, /close/i));
    button(dialog, /close/i).click();
    expect(document.activeElement).toBe(launch);
  });

  it('uses worker checkboxes to assign a different owned crew to a blueprint', async () => {
    const { root, callbacks, workers, points } = setup();
    const dialog = open(root);
    await addPlan(dialog, points[0]);
    const plan = callbacks.addBlueprint.mock.results[0].value;
    for (const choice of Array.from(dialog.querySelectorAll<HTMLInputElement>('[data-worker-choice]'))) {
      choice.checked = Number(choice.dataset.workerChoice) === workers[3].id;
      choice.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await action(blueprint(dialog, plan.id), 'Assign selected workers');
    expect(callbacks.assignBlueprintWorkers).toHaveBeenCalledWith(plan.id, [workers[3].id]);
    await action(dialog, 'Construct assigned plans');
    expect(workers[3].order.type).toBe('build');
    expect(workers.filter(worker => worker.order.type === 'build')).toHaveLength(1);
  });

  it('accepts battlefield placement without paying costs and returns to the planning dialog', async () => {
    const { root, callbacks, points, state } = setup();
    const dialog = open(root);
    const before = structuredClone(state.players[0]);
    setInput(field<HTMLSelectElement>(dialog, 'Blueprint building'), 'barracks');
    button(dialog, 'Place on battlefield').click();
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
    expect(callbacks.beginPlacement).toHaveBeenCalledTimes(1);
    const [role, accept] = callbacks.beginPlacement.mock.calls[0];
    expect(role).toBe('barracks');
    accept(points[0]);
    await vi.waitFor(() => expect(callbacks.addBlueprint).toHaveBeenCalledWith({ role: 'barracks', ...points[0] }));
    await vi.waitFor(() => expect(root.querySelectorAll('[data-blueprint-id]')).toHaveLength(1));
    expect(callbacks.onModal).toHaveBeenLastCalledWith(true);
    expect(field(dialog, 'Blueprint X').value).toBe(String(points[0].x));
    expect(field(dialog, 'Blueprint Y').value).toBe(String(points[0].y));
    expect(state.players[0]).toEqual(before);
    expect(state.entities.some(entity => entity.side === 0 && entity.role === 'barracks')).toBe(false);
    button(dialog, 'Place on battlefield').click();
    const cancel = callbacks.beginPlacement.mock.calls[1][2];
    cancel();
    expect(callbacks.onModal).toHaveBeenLastCalledWith(true);
    expect(message(root)).toContain('placement canceled');
    expect(callbacks.addBlueprint).toHaveBeenCalledTimes(1);
  });

  it('cancels placement on disposal and ignores old placement callbacks', () => {
    const { root, tools, callbacks, points } = setup();
    const dialog = open(root);
    button(dialog, 'Place on battlefield').click();
    const [, accept, cancel] = callbacks.beginPlacement.mock.calls[0];
    tools.dispose();
    expect(callbacks.cancelPlacement).toHaveBeenCalledTimes(1);
    const modalCalls = callbacks.onModal.mock.calls.length;
    accept(points[0]);
    cancel();
    expect(callbacks.addBlueprint).not.toHaveBeenCalled();
    expect(callbacks.onModal).toHaveBeenCalledTimes(modalCalls);
    expect(root.childElementCount).toBe(0);
  });

  it('reports battlefield placement errors and returns to the dialog', () => {
    const { root, callbacks } = setup();
    const dialog = open(root);
    callbacks.beginPlacement.mockImplementation(() => { throw new Error('Battlefield unavailable'); });
    button(dialog, 'Place on battlefield').click();
    expect(callbacks.onModal).toHaveBeenLastCalledWith(true);
    expect(message(root)).toContain('Battlefield unavailable');
    expect(callbacks.addBlueprint).not.toHaveBeenCalled();
  });

  it('blocks duplicate clicks while an action is pending and does not restore a disposed panel', async () => {
    const { root, tools, callbacks } = setup();
    const dialog = open(root);
    let resolve!: (value: boolean) => void;
    const pending = new Promise<boolean>(done => { resolve = done; });
    callbacks.setTargets.mockReturnValue(pending);
    const save = button(dialog, 'Save worker targets');
    save.click();
    save.click();
    expect(callbacks.setTargets).toHaveBeenCalledTimes(1);
    expect(save.disabled).toBe(true);
    tools.dispose();
    resolve(true);
    await pending;
    await Promise.resolve();
    expect(root.childElementCount).toBe(0);
  });
});


it('uses and cleans up the host toolbar for the planning launcher',()=>{
 const toolbar=document.createElement('nav');document.body.append(toolbar);const f=setup({},toolbar),launch=toolbar.querySelector<HTMLButtonElement>('[data-planning-launch]')!;
 expect(launch).toBeDefined();expect(f.root.querySelector('.session-toolbar')).toBeNull();launch.click();expect(f.root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(false);
 f.tools.dispose();expect(toolbar.children).toHaveLength(0);expect(f.callbacks.onModal).toHaveBeenLastCalledWith(false);
});
