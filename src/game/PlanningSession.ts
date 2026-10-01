import {
  addBlueprint, applyWorkerTargets, assignBlueprintWorkers, cancelBlueprint,
  createPlanningRuntime, decodePlanningRuntime, executeBlueprints,
  syncConstructionPlan, validPlanningSide, validateWorkerTargets,
} from '../core/planning';
import type { ConstructionBlueprint, PlanningRuntime } from '../core/planning';
import { isGameOver } from '../core/simulation';
import type { BuildingRole, Command, GameState, Side, Vec } from '../core/types';
import { mountPlanningTools } from '../ui/PlanningTools';

export type PlanningEditContext = 'maintenance' | 'dialog' | 'placement';
export interface PlanningSessionSnapshot {
  version: 1;
  /** Roster order is also the side index. */
  players: PlanningRuntime[];
  automaticSides: Side[];
}
export interface PlanningSessionHost {
  toolbar?: HTMLElement;
  getState: () => GameState | null;
  getSide: () => Side;
  /** A true result must synchronously apply the command to getState(). */
  dispatch: (side: Side, command: Command) => boolean;
  /** Dialog actions may be allowed during the pause caused by this panel. */
  canEdit: (side: Side, context: PlanningEditContext) => boolean;
  onVisibility: (open: boolean) => void;
  selectedWorkerIds?: () => number[];
  beginPlacement?: (role: BuildingRole, onPoint: (point: Vec) => void, onCancel: () => void) => () => void;
  setBlueprints: (blueprints: readonly ConstructionBlueprint[], side: Side) => void;
}
export interface PlanningSession {
  /** Call after simulation steps and when mode, perspective or modal state changes. */
  update: (status?: { blocked?: boolean }) => void;
  /** A replacement match gets fresh, inactive targets for every roster side. */
  reset: (state?: GameState | null) => void;
  /** Invalid input returns false without replacing any live planning metadata. */
  restore: (input: unknown, state?: GameState | null) => boolean;
  /** Synchronize lost entities and construction progress, then return detached data. */
  snapshot: () => PlanningSessionSnapshot | null;
  destroy: () => void;
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const emptyTargets = () => ({ wood: 0, ore: 0, crystal: 0 });
const copyBlueprints = (items: readonly ConstructionBlueprint[]): ConstructionBlueprint[] =>
  items.map(item => ({ ...item, workerIds: [...item.workerIds] }));

/** Local planning metadata and UI share one owner; simulation commands stay with the host. */
export function mountPlanningSession(root: HTMLElement, host: PlanningSessionHost): PlanningSession {
  let state: GameState | null = null;
  let perspective: Side = host.getSide();
  let runtimes: PlanningRuntime[] = [];
  let automaticSides = new Set<Side>();
  let lastMaintenance: number[] = [];
  let opened = false, destroyed = false, blocked = false, changing = false, deferredUpdate = false;
  let placement: { state: GameState; side: Side; cancel?: () => void } | undefined;
  let tools: ReturnType<typeof mountPlanningTools> | undefined;

  function currentSide(): Side { return host.getSide(); }
  function canEdit(side: Side, context: PlanningEditContext): boolean {
    return !destroyed && !!state && host.getState() === state && validPlanningSide(state, side)
      && (context === 'maintenance' || side === perspective && side === currentSide())
      && !isGameOver(state) && !state.eliminated[side] && host.canEdit(side, context);
  }
  function context(kind: PlanningEditContext): { state: GameState; side: Side; runtime: PlanningRuntime } {
    const side = currentSide();
    if (!canEdit(side, kind)) throw new Error('Planning commands are unavailable in this view.');
    return { state: state!, side, runtime: runtimes[side] };
  }
  function dispatchFor(targetState: GameState, side: Side, kind: PlanningEditContext) {
    return (commandSide: Side, command: Command) => state === targetState && commandSide === side
      && canEdit(side, kind) && host.dispatch(side, command);
  }
  function cancelPlacement() {
    const pending = placement;
    placement = undefined;
    // Invalidate accept/cancel callbacks before host cleanup can invoke them.
    pending?.cancel?.();
  }
  function publish(items: readonly ConstructionBlueprint[]) {
    host.setBlueprints(copyBlueprints(items), perspective);
  }
  function mount() {
    tools = mountPlanningTools(root, {
      toolbar: host.toolbar,
      getPlan: () => state && validPlanningSide(state, currentSide()) ? runtimes[currentSide()].construction : null,
      getTargets: () => state && validPlanningSide(state, currentSide()) ? { ...runtimes[currentSide()].targets } : emptyTargets(),
      setTargets: targets => {
        const { side, runtime } = context('dialog');
        if (!validateWorkerTargets(targets)) throw new Error('Invalid worker targets.');
        runtime.targets = { ...targets };
        // Saving targets alone must not issue orders on the next update.
        automaticSides.delete(side);
        return true;
      },
      applyTargets: targets => {
        const { state: live, side, runtime } = context('dialog');
        if (!validateWorkerTargets(targets)) throw new Error('Invalid worker targets.');
        runtime.targets = { ...targets };
        const result = applyWorkerTargets(live, side, runtime.targets, dispatchFor(live, side, 'dialog'));
        automaticSides.add(side);
        lastMaintenance[side] = live.time;
        return result;
      },
      addBlueprint: spec => {
        const { state: live, side, runtime } = context('dialog');
        return addBlueprint(live, side, runtime.construction, spec);
      },
      assignBlueprintWorkers: (id, workers) => {
        const { state: live, side, runtime } = context('dialog');
        return assignBlueprintWorkers(live, side, runtime.construction, id, workers);
      },
      cancelBlueprint: id => cancelBlueprint(context('dialog').runtime.construction, id),
      executeBlueprints: () => {
        const { state: live, side, runtime } = context('dialog');
        return executeBlueprints(live, side, runtime.construction, dispatchFor(live, side, 'dialog'));
      },
      selectedWorkerIds: () => host.selectedWorkerIds?.() ?? [],
      onPreview: publish,
      onModal: open => {
        opened = open;
        host.onVisibility(open);
        // The host may grant dialog permission only after applying its modal pause.
        tools?.update(state, { side: perspective, readOnly: !canEdit(perspective, 'dialog'), blocked });
      },
      ...(host.beginPlacement ? {
        beginPlacement: (role: BuildingRole, accept: (point: Vec) => void, cancel: () => void) => {
          const { state: live, side } = context('placement');
          cancelPlacement();
          const pending = { state: live, side } as NonNullable<typeof placement>;
          placement = pending;
          const valid = () => placement === pending && state === live && currentSide() === side && canEdit(side, 'placement');
          type Completion = { point: Vec } | { canceled: true };
          let installing = true, completion: Completion | undefined;
          const finish = (result: Completion) => {
            if (!valid()) return;
            placement = undefined;
            pending.cancel?.();
            if ('point' in result) accept(result.point);
            else cancel();
          };
          const complete = (result: Completion) => {
            if (!valid() || completion) return;
            if (installing) completion = result;
            else finish(result);
          };
          try {
            const cleanup = host.beginPlacement!(role, point => complete({ point: { x: point.x, y: point.y } }),
              () => complete({ canceled: true }));
            // The host may complete placement synchronously while installing it.
            if (typeof cleanup === 'function') {
              if (placement === pending) pending.cancel = cleanup;
              else cleanup();
            }
            installing = false;
            if (completion) finish(completion);
          } catch (error) {
            if (placement === pending) placement = undefined;
            throw error;
          }
        },
        cancelPlacement,
      } : {}),
    });
  }
  function remount() {
    const previousTools = tools;
    tools = undefined;
    cancelPlacement();
    previousTools?.dispose();
    opened = false;
    publish([]);
    if (!destroyed) mount();
  }
  function sync() {
    if (state) for (const runtime of runtimes) syncConstructionPlan(state, runtime.construction);
  }
  function change(operation: () => void) {
    changing = true;
    try { operation(); }
    finally {
      changing = false;
      if (deferredUpdate && !destroyed) { deferredUpdate = false; update(); }
    }
  }
  function resetState(nextState: GameState | null) {
    // Dispose while the old perspective still owns the previews and modal.
    remount();
    if (destroyed) return;
    state = nextState;
    perspective = currentSide();
    runtimes = state ? state.players.map((_, side) => createPlanningRuntime(side as Side)) : [];
    automaticSides = new Set();
    lastMaintenance = runtimes.map(() => state!.time);
    tools?.update(state, { side: perspective, readOnly: !canEdit(perspective, 'dialog'), blocked });
  }
  function reset(nextState: GameState | null = host.getState()) {
    if (destroyed) return;
    if (changing) { deferredUpdate = true; return; }
    change(() => resetState(nextState));
  }
  function update(status: { blocked?: boolean } = {}) {
    if (destroyed) return;
    if (status.blocked !== undefined) blocked = status.blocked;
    if (changing) { deferredUpdate = true; return; }
    change(() => updateState());
  }
  function updateState() {
    const nextState = host.getState(), nextSide = currentSide();
    if (state !== nextState || runtimes.length !== (nextState?.players.length ?? 0)) resetState(nextState);
    else if (perspective !== nextSide) {
      remount();
      perspective = nextSide;
    } else if (placement && !canEdit(placement.side, 'placement')) {
      // The UI must forget its placing flag as well as the host's pointer handler.
      remount();
    }
    if (destroyed) return;
    sync();
    if (state && !opened && !placement) for (const side of automaticSides) {
      if (!canEdit(side, 'maintenance')) continue;
      if (state.time < lastMaintenance[side]) lastMaintenance[side] = state.time;
      if (state.time - lastMaintenance[side] < 1 - 1e-9) continue;
      lastMaintenance[side] = state.time;
      applyWorkerTargets(state, side, runtimes[side].targets, dispatchFor(state, side, 'maintenance'));
    }
    tools?.update(state, { side: perspective, readOnly: !canEdit(perspective, 'dialog'), blocked });
  }
  function restore(input: unknown, nextState: GameState | null = host.getState()): boolean {
    if (destroyed || changing || !nextState || !record(input) || input.version !== 1
      || Object.keys(input).some(key => !['version', 'players', 'automaticSides'].includes(key))
      || !Array.isArray(input.players) || input.players.length !== nextState.players.length) return false;
    const decoded: PlanningRuntime[] = [];
    for (let side = 0; side < input.players.length; side++) {
      const runtime = decodePlanningRuntime(input.players[side], nextState, side as Side);
      if (!runtime) return false;
      decoded.push(runtime);
    }
    const active = input.automaticSides === undefined ? [] : input.automaticSides;
    if (!Array.isArray(active) || new Set(active).size !== active.length
      || Array.from(active).some(side => typeof side !== 'number' || !validPlanningSide(nextState, side))) return false;
    // Every field is validated before disposing UI or replacing existing metadata.
    change(() => {
      remount();
      if (destroyed) return;
      state = nextState;
      perspective = currentSide();
      runtimes = decoded;
      automaticSides = new Set(active as Side[]);
      lastMaintenance = decoded.map(() => nextState.time);
      tools?.update(state, { side: perspective, readOnly: !canEdit(perspective, 'dialog'), blocked });
    });
    return !destroyed;
  }
  function snapshot(): PlanningSessionSnapshot | null {
    if (destroyed || changing) return null;
    if (state !== host.getState()) reset(host.getState());
    if (!state) return null;
    sync();
    return {
      version: 1,
      players: runtimes.map(runtime => ({ version: 1, targets: { ...runtime.targets }, construction: {
        ...runtime.construction, blueprints: copyBlueprints(runtime.construction.blueprints),
      } })),
      automaticSides: [...automaticSides].sort((a, b) => a - b),
    };
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    remount();
    state = null;
    runtimes = [];
    automaticSides.clear();
  }

  reset();
  return { update, reset, restore, snapshot, destroy };
}
