// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACTIONS } from '../src/core/content';
import { createPlanningRuntime, decodePlanningRuntime } from '../src/core/planning';
import { loadGame, saveGame } from '../src/core/saves';
import { createGame, createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { Command, GameState, ResourceKind, Side, Vec } from '../src/core/types';
import { mountPlanningSession } from '../src/game/PlanningSession';
import type { PlanningEditContext, PlanningSession, PlanningSessionHost } from '../src/game/PlanningSession';

const mounted: PlanningSession[] = [];
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => {
  for (const session of mounted.splice(0)) session.destroy();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function button(root: ParentNode, label: string): HTMLButtonElement {
  const control = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(element => element.textContent === label || element.getAttribute('aria-label') === label);
  expect(control, `Missing button ${label}`).toBeDefined();
  return control!;
}
async function action(root: ParentNode, label: string) {
  const control = button(root, label);
  control.click();
  await vi.waitFor(() => expect(control.dataset.busy).not.toBe('true'));
}
function input(root: ParentNode, label: string, value: number | string) {
  const control = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
  expect(control).not.toBeNull();
  control.value = String(value);
  control.dispatchEvent(new Event('change', { bubbles: true }));
}
function targets(root: ParentNode, wood: number, ore = 0, crystal = 0) {
  input(root, 'Wood worker target', wood);
  input(root, 'Ore worker target', ore);
  input(root, 'Crystal worker target', crystal);
}
function advance(state: GameState, seconds: number, session?: PlanningSession) {
  for (let tick = 0; tick < Math.round(seconds / .05); tick++) {
    stepGame(state, .05);
    session?.update();
  }
}
function fixture(count = 2) {
  const state = count === 2
    ? createGame('orcs', 4127, 'fairies', { controllers: ['external', 'external'] })
    : createMatch({ map: { seed: 4127 }, players: Array.from({ length: count }, (_, side) => ({
      id: side as Side, teamId: side as Side, factionId: 'orcs' as const, controller: 'external' as const,
    })) });
  state.terrain.fill('grass');
  state.resources = state.players.flatMap((_, side) => {
    const home = state.starts[side];
    return (['wood', 'ore', 'crystal'] as ResourceKind[]).map((kind, index) => ({
      id: state.nextId++, kind, x: home.x + 7, y: home.y + 3 + index * 1.5, amount: 1000, maxAmount: 1000,
    }));
  });
  refreshVisibility(state);
  return state;
}
function setup(initial = fixture()) {
  let state: GameState | null = initial, side: Side = 0;
  let permission = (_side: Side, _kind: PlanningEditContext) => true;
  let pointCallback: ((point: Vec) => void) | undefined, cancelCallback: (() => void) | undefined;
  const cleanup = vi.fn();
  const root = document.createElement('div');
  document.body.append(root);
  const host: PlanningSessionHost = {
    getState: () => state,
    getSide: () => side,
    dispatch: vi.fn((commandSide: Side, command: Command) => !!state && issueCommand(state, commandSide, command)),
    canEdit: vi.fn((commandSide, kind) => permission(commandSide, kind)),
    onVisibility: vi.fn(),
    selectedWorkerIds: () => state?.entities.filter(entity => entity.side === side && entity.role === 'worker').slice(0, 1).map(entity => entity.id) ?? [],
    beginPlacement: vi.fn((_role, onPoint, onCancel) => { pointCallback = onPoint; cancelCallback = onCancel; return cleanup; }),
    setBlueprints: vi.fn(),
  };
  const session = mountPlanningSession(root, host);
  mounted.push(session);
  const workers = () => state!.entities.filter(entity => entity.side === side && entity.role === 'worker');
  return {
    root, session, host, cleanup, initial, workers,
    replace: (next: GameState | null) => { state = next; },
    changeSide: (next: Side) => { side = next; },
    allow: (next: typeof permission) => { permission = next; },
    accept: (point: Vec) => pointCallback?.(point),
    cancel: () => cancelCallback?.(),
  };
}
function open(root: ParentNode) {
  button(root, 'Settlement planning').click();
  expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(false);
}
function close(root: ParentNode) { button(root, 'Close settlement planning').click(); }
async function addPlan(root: ParentNode, point: Vec) {
  input(root, 'Blueprint building', 'depot');
  input(root, 'Blueprint X', point.x);
  input(root, 'Blueprint Y', point.y);
  await action(root, 'Add blueprint');
}

describe('planning session allocation', () => {
  it('keeps default targets inactive and saved targets pending until explicitly applied', async () => {
    const { root, session, host, initial: state, workers } = setup();
    const worker = workers()[0], wood = state.resources.find(node => node.kind === 'wood')!;
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id })).toBe(true);
    advance(state, 2, session);
    expect(worker.order).toEqual({ type: 'gather', target: wood.id });
    expect(host.dispatch).not.toHaveBeenCalled();
    expect(session.snapshot()!.automaticSides).toEqual([]);
    open(root);
    targets(root, 2, 1);
    await action(root, 'Save worker targets');
    close(root);
    advance(state, 2, session);
    expect(host.dispatch).not.toHaveBeenCalled();
    expect(session.snapshot()!.players[0].targets).toEqual({ wood: 2, ore: 1, crystal: 0 });
    open(root);
    await action(root, 'Apply worker targets');
    expect(workers().filter(entity => entity.order.type === 'gather')).toHaveLength(3);
    expect(session.snapshot()!.automaticSides).toEqual([0]);
    expect(host.dispatch).toHaveBeenCalled();
  });

  it('maintains applied targets once per simulation second and issues no redundant orders', async () => {
    const { root, session, host, initial: state, workers } = setup();
    open(root);
    targets(root, 1);
    await action(root, 'Apply worker targets');
    close(root);
    const worker = workers().find(entity => entity.order.type === 'gather')!;
    expect(issueCommand(state, 0, { type: 'stop', ids: [worker.id] })).toBe(true);
    vi.mocked(host.dispatch).mockClear();
    advance(state, .95, session);
    expect(worker.order.type).toBe('idle');
    expect(host.dispatch).not.toHaveBeenCalled();
    advance(state, .05, session);
    expect(worker.order.type).toBe('gather');
    expect(host.dispatch).toHaveBeenCalledTimes(1);
    advance(state, 2, session);
    expect(host.dispatch).toHaveBeenCalledTimes(1);
    for (let iteration = 0; iteration < 20; iteration++) session.update();
    expect(host.dispatch).toHaveBeenCalledTimes(1);
  });

  it('keeps explicitly applied zero targets active and saving new targets deactivates them', async () => {
    const { root, session, host, initial: state, workers } = setup();
    const worker = workers()[0], wood = state.resources.find(node => node.kind === 'wood')!;
    open(root);
    targets(root, 0);
    await action(root, 'Apply worker targets');
    close(root);
    expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: wood.id })).toBe(true);
    advance(state, 1, session);
    expect(worker.order.type).toBe('idle');
    expect(session.snapshot()!.automaticSides).toEqual([0]);
    open(root);
    targets(root, 1);
    await action(root, 'Save worker targets');
    close(root);
    vi.mocked(host.dispatch).mockClear();
    advance(state, 2, session);
    expect(host.dispatch).not.toHaveBeenCalled();
    expect(session.snapshot()!.automaticSides).toEqual([]);
  });

  it('skips maintenance during its dialog and obeys host mode permissions on every action', async () => {
    const { root, session, host, initial: state, workers, allow } = setup();
    let ownModal = false;
    vi.mocked(host.onVisibility).mockImplementation(value => { ownModal = value; });
    allow((_side, kind) => kind === 'dialog' && ownModal || kind === 'maintenance' && !ownModal);
    session.update();
    open(root);
    session.update();
    targets(root, 1);
    await action(root, 'Apply worker targets');
    const worker = workers().find(entity => entity.order.type === 'gather')!;
    issueCommand(state, 0, { type: 'stop', ids: [worker.id] });
    vi.mocked(host.dispatch).mockClear();
    advance(state, 2, session);
    expect(host.dispatch).not.toHaveBeenCalled();
    close(root);
    session.update();
    expect(worker.order.type).toBe('gather');
    expect(host.dispatch).toHaveBeenCalledTimes(1);
    open(root);
    const before = session.snapshot();
    allow(() => false);
    targets(root, 4);
    // Cached UI status cannot grant permission after the host revokes it.
    await action(root, 'Apply worker targets');
    expect(session.snapshot()).toEqual(before);
    expect(root.querySelector('[role="status"]')!.textContent).toContain('unavailable');
    close(root);
    issueCommand(state, 0, { type: 'stop', ids: [worker.id] });
    advance(state, 2, session);
    expect(host.dispatch).toHaveBeenCalledTimes(1);
  });

  it('retains separate runtime and cadence for every roster side', async () => {
    const { root, session, host, initial: state, changeSide } = setup(fixture(4));
    open(root);
    targets(root, 1);
    await action(root, 'Apply worker targets');
    close(root);
    changeSide(3);
    session.update();
    open(root);
    targets(root, 0, 1);
    await action(root, 'Apply worker targets');
    close(root);
    const snapshot = session.snapshot()!;
    expect(snapshot.players).toHaveLength(4);
    expect(snapshot.players[0].targets).toEqual({ wood: 1, ore: 0, crystal: 0 });
    expect(snapshot.players[3].targets).toEqual({ wood: 0, ore: 1, crystal: 0 });
    expect(snapshot.automaticSides).toEqual([0, 3]);
    for (const side of [0, 3] as const) {
      const worker = state.entities.find(entity => entity.side === side && entity.order.type === 'gather')!;
      expect(issueCommand(state, side, { type: 'stop', ids: [worker.id] })).toBe(true);
    }
    vi.mocked(host.dispatch).mockClear();
    advance(state, 1, session);
    expect(vi.mocked(host.dispatch).mock.calls.map(([side]) => side)).toEqual([0, 3]);
  });
});

describe('planning session construction and persistence', () => {
  it('spends resources only on an explicit construction action and snapshots real progress', async () => {
    const { root, session, host, initial: state, workers } = setup();
    Object.assign(state.players[0], { wood: 5000, ore: 5000, crystal: 5000 });
    const worker = workers()[0], home = state.starts[0];
    const bank = state.players[0].wood;
    open(root);
    await addPlan(root, { x: home.x + 6, y: home.y });
    await action(root, 'Assign selected workers to blueprint blueprint-1');
    close(root);
    advance(state, 2, session);
    expect(state.players[0].wood).toBe(bank);
    expect(worker.order.type).toBe('idle');
    expect(host.dispatch).not.toHaveBeenCalled();
    open(root);
    await action(root, 'Construct assigned plans');
    expect(state.players[0].wood).toBe(bank - FACTIONS.orcs.buildings.depot.cost.wood);
    const blueprint = session.snapshot()!.players[0].construction.blueprints[0];
    expect(blueprint).toMatchObject({ status: 'building', workerIds: [worker.id] });
    expect(worker.order).toEqual({ type: 'build', target: blueprint.buildingId });
    close(root);
    advance(state, 40, session);
    expect(session.snapshot()!.players[0].construction.blueprints[0].status).toBe('complete');
    expect(host.dispatch).toHaveBeenCalledTimes(1);
  });

  it('synchronizes destroyed buildings and dead workers before snapshot without an update', async () => {
    const { root, session, initial: state, workers } = setup();
    Object.assign(state.players[0], { wood: 5000, ore: 5000, crystal: 5000 });
    open(root);
    await addPlan(root, { x: state.starts[0].x + 6, y: state.starts[0].y });
    await action(root, 'Assign selected workers to blueprint blueprint-1');
    await action(root, 'Construct assigned plans');
    const first = session.snapshot()!;
    const building = state.entities.find(entity => entity.id === first.players[0].construction.blueprints[0].buildingId)!;
    building.hp = 0;
    workers()[0].hp = 0;
    const saved = session.snapshot()!;
    expect(saved.players[0].construction.blueprints[0]).toMatchObject({ status: 'planned', workerIds: [] });
    expect(saved.players[0].construction.blueprints[0].buildingId).toBeUndefined();
    expect(decodePlanningRuntime(saved.players[0], state, 0)).toEqual(saved.players[0]);
  });

  it('round trips planning alongside a real game save without dispatching or sharing references', async () => {
    const { root, session, host, initial: state, replace } = setup();
    open(root);
    targets(root, 1, 1);
    await action(root, 'Apply worker targets');
    await addPlan(root, { x: state.starts[0].x + 6, y: state.starts[0].y });
    await action(root, 'Assign selected workers to blueprint blueprint-1');
    close(root);
    const saved = session.snapshot()!, next = loadGame(saveGame(state));
    replace(next);
    vi.mocked(host.dispatch).mockClear();
    expect(session.restore(saved, next)).toBe(true);
    expect(session.snapshot()).toEqual(saved);
    expect(host.dispatch).not.toHaveBeenCalled();
    saved.players[0].targets.wood = 999;
    saved.players[0].construction.blueprints[0].workerIds.length = 0;
    saved.automaticSides.length = 0;
    const independent = session.snapshot()!;
    expect(independent.players[0].targets.wood).toBe(1);
    expect(independent.players[0].construction.blueprints[0].workerIds).toHaveLength(1);
    expect(independent.automaticSides).toEqual([0]);
    independent.players[0].construction.blueprints[0].x = 1;
    expect(session.snapshot()!.players[0].construction.blueprints[0].x).not.toBe(1);
  });

  it('rejects every invalid restore before changing metadata, placement or dialog visibility', async () => {
    const { root, session, host, initial: state } = setup();
    open(root);
    targets(root, 2);
    await action(root, 'Save worker targets');
    const before = session.snapshot()!;
    const mutations = [
      null, [], {}, { ...before, version: 2 }, { ...before, extra: true },
      { ...before, players: before.players.slice(0, 1) },
      { ...before, players: [before.players[0], before.players[0]] },
      { ...before, automaticSides: [0, 0] }, { ...before, automaticSides: [2] },
      { ...before, automaticSides: null },
      { ...before, automaticSides: Array(1) },
      { ...before, automaticSides: '0' }, { ...before, automaticSides: [.5] },
      { ...before, players: [before.players[0], { ...before.players[1], targets: { wood: -1, ore: 0, crystal: 0 } }] },
    ];
    vi.mocked(host.onVisibility).mockClear();
    for (const invalid of mutations) {
      expect(session.restore(invalid, state)).toBe(false);
      expect(session.snapshot()).toEqual(before);
    }
    expect(host.onVisibility).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(false);
    expect(host.dispatch).not.toHaveBeenCalled();
  });

  it('restores older metadata with no automaticSides as inactive', () => {
    const { session, initial: state } = setup();
    const players = state.players.map((_, side) => createPlanningRuntime(side as Side));
    players[0].targets.wood = 2;
    expect(session.restore({ version: 1, players })).toBe(true);
    expect(session.snapshot()!.automaticSides).toEqual([]);
  });

  it('resets metadata when the match is replaced and clears old ghosts and modal state', async () => {
    const { root, session, host, replace, initial: state } = setup();
    open(root);
    await addPlan(root, { x: state.starts[0].x + 6, y: state.starts[0].y });
    targets(root, 1);
    await action(root, 'Apply worker targets');
    const next = fixture(4);
    replace(next);
    session.update();
    expect(session.snapshot()!.players).toEqual(next.players.map((_, side) => createPlanningRuntime(side as Side)));
    expect(session.snapshot()!.automaticSides).toEqual([]);
    expect(host.setBlueprints).toHaveBeenCalledWith([], 0);
    expect(host.onVisibility).toHaveBeenLastCalledWith(false);
    expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(true);
    replace(null);
    session.update();
    expect(session.snapshot()).toBeNull();
    expect(button(root, 'Settlement planning').disabled).toBe(true);
  });

  it.each(['reset', 'restore'] as const)('keeps one panel when visibility callbacks reenter %s', operation => {
    const { root, session, host, replace } = setup();
    open(root);
    const next = fixture(4);
    replace(next);
    let entered = false;
    vi.mocked(host.onVisibility).mockImplementation(visible => {
      if (!visible && !entered) { entered = true; session.update(); }
    });
    if (operation === 'reset') session.update();
    else expect(session.restore({ version: 1, players: next.players.map((_, side) => createPlanningRuntime(side as Side)), automaticSides: [] }, next)).toBe(true);
    expect(entered).toBe(true);
    expect(root.querySelectorAll('.planning-tools')).toHaveLength(1);
    expect(session.snapshot()!.players).toHaveLength(4);
    session.destroy();
    expect(root.children).toHaveLength(0);
  });

  it('does not recreate the panel when a visibility callback destroys it during reset', () => {
    const { root, session, host, replace } = setup();
    open(root);
    replace(fixture());
    vi.mocked(host.onVisibility).mockImplementation(visible => { if (!visible) session.destroy(); });
    session.update();
    expect(root.children).toHaveLength(0);
    expect(session.snapshot()).toBeNull();
  });

  it.each(['ended', 'eliminated'] as const)('rejects %s player commands even if the host allows them', async condition => {
    const { root, session, host, initial: state } = setup();
    open(root);
    targets(root, 2);
    if (condition === 'ended') state.winner = 1;
    else state.eliminated[0] = true;
    await action(root, 'Apply worker targets');
    expect(session.snapshot()!.players[0].targets).toEqual({ wood: 0, ore: 0, crystal: 0 });
    expect(host.dispatch).not.toHaveBeenCalled();
  });
});

describe('planning session battlefield placement', () => {
  it.each(['point', 'cancel'] as const)('cleans synchronous %s completion before reopening the dialog', async completion => {
    const { root, session, host, initial: state } = setup();
    let modalOpen = false;
    const events: string[] = [];
    vi.mocked(host.onVisibility).mockImplementation(visible => { modalOpen = visible; events.push(`visible-${visible}`); });
    vi.mocked(host.beginPlacement!).mockImplementation((_role, onPoint, onCancel) => {
      if (completion === 'point') onPoint({ x: state.starts[0].x + 6, y: state.starts[0].y });
      else onCancel();
      return () => { modalOpen = false; events.push('cleanup'); };
    });
    open(root);
    button(root, 'Place on battlefield').click();
    if (completion === 'point') await vi.waitFor(() => expect(session.snapshot()!.players[0].construction.blueprints).toHaveLength(1));
    else expect(session.snapshot()!.players[0].construction.blueprints).toEqual([]);
    expect(events).toEqual(['visible-true', 'visible-false', 'cleanup', 'visible-true']);
    expect(modalOpen).toBe(true);
    expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(false);
  });

  it('hides the panel, commits an accepted point, cleans pointer handlers and reopens', async () => {
    const { root, session, host, cleanup, initial: state, accept } = setup();
    const point = { x: state.starts[0].x + 6, y: state.starts[0].y };
    open(root);
    input(root, 'Blueprint building', 'depot');
    button(root, 'Place on battlefield').click();
    expect(host.onVisibility).toHaveBeenLastCalledWith(false);
    expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(true);
    accept(point);
    await vi.waitFor(() => expect(session.snapshot()!.players[0].construction.blueprints).toHaveLength(1));
    expect(session.snapshot()!.players[0].construction.blueprints[0]).toMatchObject({ ...point, role: 'depot', status: 'planned' });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(host.onVisibility).toHaveBeenLastCalledWith(true);
    expect(host.dispatch).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(false);
  });

  it.each(['state', 'side', 'permission', 'reset', 'destroy'] as const)('invalidates late placement callbacks after %s changes', async change => {
    const { root, session, host, cleanup, initial: state, accept, cancel, replace, changeSide, allow } = setup();
    open(root);
    button(root, 'Place on battlefield').click();
    vi.mocked(host.onVisibility).mockClear();
    if (change === 'state') { replace(fixture()); session.update(); }
    if (change === 'side') { changeSide(1); session.update(); }
    if (change === 'permission') { allow(() => false); session.update(); }
    if (change === 'reset') session.reset();
    if (change === 'destroy') session.destroy();
    accept({ x: state.starts[0].x + 6, y: state.starts[0].y });
    cancel();
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(host.onVisibility).not.toHaveBeenCalledWith(true);
    expect(host.dispatch).not.toHaveBeenCalled();
    if (change !== 'destroy') expect(session.snapshot()!.players.every(runtime => runtime.construction.blueprints.length === 0)).toBe(true);
    expect(host.setBlueprints).toHaveBeenCalledWith([], 0);
  });

  it('cancels placement and reopens without adding a blueprint', () => {
    const { root, session, cleanup, cancel } = setup();
    open(root);
    button(root, 'Place on battlefield').click();
    cancel();
    expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(false);
    expect(session.snapshot()!.players[0].construction.blueprints).toEqual([]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('disposes the UI and clears previews once; later update/restore calls cannot revive it', () => {
    const { root, session, host } = setup();
    open(root);
    session.destroy();
    expect(root.children).toHaveLength(0);
    expect(host.onVisibility).toHaveBeenLastCalledWith(false);
    expect(host.setBlueprints).toHaveBeenLastCalledWith([], 0);
    const calls = vi.mocked(host.setBlueprints).mock.calls.length;
    session.destroy();
    session.update();
    session.reset();
    expect(session.restore({ version: 1, players: [] })).toBe(false);
    expect(session.snapshot()).toBeNull();
    expect(root.children).toHaveLength(0);
    expect(host.setBlueprints).toHaveBeenCalledTimes(calls);
  });
});
