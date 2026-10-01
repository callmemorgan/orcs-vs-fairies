// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioAction } from '../src/core/scenario-types';
import { generateWorldMap } from '../src/core/world-map';
import { createEditorMap, makeMapPackage, type EditorPoint, type MapPackage } from '../src/editor/map-package';
import { createScenarioDraft, decodeScenarioPackage, makeScenarioPackage, scenarioMapFromPackage, type ScenarioPackage } from '../src/editor/scenario-package';
import { createContentBundle } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { mountScenarioAuthoring } from '../src/ui/ScenarioAuthoring';

const mounted: ReturnType<typeof mountScenarioAuthoring>[] = [];
afterEach(() => {
  mounted.splice(0).forEach(panel => panel.destroy());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function playableMap(seed = 4127): MapPackage {
  const map = createEditorMap(seed, 'small');
  map.levels[0].terrain.fill('grass');
  return makeMapPackage({ id: `scenario-ground-${seed}`, title: 'Scenario ground', author: 'Map author', revision: 1 }, map);
}

function playableWorldMap(): MapPackage {
  const map = generateWorldMap(4127, 'small');
  map.levels.forEach(level => level.terrain.fill('grass'));
  return makeMapPackage({ id: 'scenario-world', title: 'Scenario world', author: 'Map author', revision: 1 }, map);
}

function setup(options: Pick<Parameters<typeof mountScenarioAuthoring>[1], 'contentOptions'> = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  let currentMap = playableMap(), placement: ((point: EditorPoint) => void) | null = null;
  const onChange = vi.fn(), playScenario = vi.fn(async (_scenario: ScenarioPackage) => {});
  const onImportMap = vi.fn((map: MapPackage) => { currentMap = map; });
  const setPlacement = vi.fn((handler: ((point: EditorPoint) => void) | null) => { placement = handler; });
  const panel = mountScenarioAuthoring(root, { ...options, getMap: () => currentMap, onChange, playScenario, onImportMap, setPlacement });
  mounted.push(panel);
  return {
    root, panel, onChange, playScenario, onImportMap, setPlacement,
    placement: () => placement,
    map: () => currentMap,
    useMap: (map: MapPackage) => { currentMap = map; },
  };
}

function control(root: HTMLElement, label: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const nodes = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')).filter(node => node.getAttribute('aria-label') === label);
  expect(nodes, `one control named ${label}`).toHaveLength(1);
  reveal(nodes[0]);
  return nodes[0];
}

function reveal(node: HTMLElement) {
  const ancestors: HTMLDetailsElement[] = [];
  for (let parent = node.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) ancestors.unshift(parent);
  for (const details of ancestors) {
    if (!details.open) details.querySelector<HTMLElement>('summary')!.click();
    expect(details.open).toBe(true);
  }
}

function change(root: HTMLElement, label: string, value: string | number) {
  const input = control(root, label);
  input.value = String(value);
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function click(root: HTMLElement, name: string) {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(button => button.textContent === name);
  expect(buttons, `one button named ${name}`).toHaveLength(1);
  expect(buttons[0].disabled, `${name} is enabled`).toBe(false);
  reveal(buttons[0]);
  buttons[0].click();
}

function toggle(root: HTMLElement, label: string) {
  const input = control(root, label);
  expect(input).toBeInstanceOf(HTMLInputElement);
  expect((input as HTMLInputElement).type).toBe('checkbox');
  (input as HTMLInputElement).click();
}

function status(root: HTMLElement) { return root.querySelector<HTMLElement>('[role="status"]')!; }

function importFile(root: HTMLElement, text: string) {
  const input = control(root, 'Import scenario package') as HTMLInputElement;
  const transfer = new DataTransfer();
  transfer.items.add(new File([text], 'mission.scenario.json', { type: 'application/json' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function deferredRead() {
  let resolve!: (text: string) => void;
  const promise = new Promise<string>(done => { resolve = done; });
  return { promise, resolve };
}

describe('scenario authoring controls', () => {
  it('commits edits through the controls and undoes and redoes each complete snapshot', () => {
    const { root, panel, onChange } = setup();
    const initial = panel.getScenario();
    expect(root.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    change(root, 'Scenario title', 'The last crossing');
    const titled = panel.getScenario();
    change(root, 'Briefing', 'Escort the commander across the valley.');
    const briefed = panel.getScenario();
    expect(onChange).toHaveBeenLastCalledWith(briefed);
    expect(control(root, 'Scenario title').value).toBe('The last crossing');
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(titled);
    expect(control(root, 'Briefing').value).toBe(initial.briefing);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(initial);
    click(root, 'Redo scenario edit');
    expect(panel.getScenario()).toEqual(titled);
    click(root, 'Redo scenario edit');
    expect(panel.getScenario()).toEqual(briefed);

    change(root, 'Mission time limit seconds', -1);
    expect(panel.getScenario()).toEqual(briefed);
    expect(control(root, 'Mission time limit seconds').value).toBe('600');
    expect(status(root).textContent).toContain('must be a finite number');
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(titled);
    change(root, 'Scenario title', 'A new crossing');
    expect(Array.from(root.querySelectorAll('button')).find(button => button.textContent === 'Redo scenario edit')!.disabled).toBe(true);
  });

  it('adds, edits and removes actors including health, faction side and initial orders', () => {
    const { root, panel } = setup();
    change(root, 'Actor 1 position X', 14.5);
    change(root, 'Actor 1 position Y', 15.5);
    click(root, 'Add initial actor');
    change(root, 'Actor 2 label', 'scout');
    change(root, 'Actor 2 side', '1');
    change(root, 'Actor 2 role', 'ranged');
    change(root, 'Actor 2 position X', 22.5);
    change(root, 'Actor 2 position Y', 23.5);
    toggle(root, 'Actor 2 custom health');
    change(root, 'Actor 2 health', 40);
    change(root, 'Actor 2 custom definition ID', 'forest-scout');
    toggle(root, 'Actor 2 initial order');
    change(root, 'Actor 2 order type', 'attack');
    change(root, 'Actor 2 attack target', 'commander');
    expect(panel.getScenario().army).toEqual([
      { label: 'commander', side: 0, kind: 'unit', role: 'melee', x: 14.5, y: 15.5 },
      { label: 'scout', side: 1, kind: 'unit', role: 'ranged', x: 22.5, y: 23.5, hp: 40, definitionId: 'forest-scout', order: { type: 'attack', actor: 'commander' } },
    ]);
    const edited = panel.getScenario();
    change(root, 'Actor 2 label', 'commander');
    expect(status(root).textContent).toContain('duplicate actor label');
    expect(panel.getScenario()).toEqual(edited);
    expect(control(root, 'Actor 2 label').value).toBe('scout');
    click(root, 'Remove actor 2');
    expect(panel.getScenario().army).toHaveLength(1);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(edited);
    change(root, 'Actor 2 kind', 'building');
    expect(panel.getScenario().army[1]).toMatchObject({ kind: 'building', role: 'tower' });
    expect(panel.getScenario().army[1].definitionId).toBeUndefined();
    toggle(root, 'Actor 2 custom health');
    toggle(root, 'Actor 2 initial order');
    expect(panel.getScenario().army[1].hp).toBeUndefined();
    expect(panel.getScenario().army[1].order).toBeUndefined();
  });

  it('authors nested all and not objective conditions and restores removed branches', () => {
    const { root, panel } = setup();
    click(root, 'Add objective');
    change(root, 'Objective 2 ID', 'crossing');
    change(root, 'Objective 2 text', 'Stay alive until the route opens.');
    toggle(root, 'Objective 2 optional');
    change(root, 'Objective 2 success type', 'all');
    change(root, 'Objective 2 success condition 1 type', 'alive');
    change(root, 'Objective 2 success condition 1 actor', 'commander');
    click(root, 'Add Objective 2 success condition');
    change(root, 'Objective 2 success condition 2 type', 'not');
    change(root, 'Objective 2 success condition 2 child type', 'variable');
    change(root, 'Objective 2 success condition 2 child variable', 'gate-closed');
    change(root, 'Objective 2 success condition 2 child comparison', 'eq');
    change(root, 'Objective 2 success condition 2 child value', 1);
    toggle(root, 'Objective 2 failure condition');
    change(root, 'Objective 2 failure type', 'any');
    change(root, 'Objective 2 failure condition 1 type', 'dead');
    expect(panel.getScenario().objectives[1]).toEqual({
      id: 'crossing', text: 'Stay alive until the route opens.', optional: true,
      success: { type: 'all', conditions: [
        { type: 'alive', actor: 'commander' },
        { type: 'not', condition: { type: 'variable', key: 'gate-closed', op: 'eq', value: 1 } },
      ] },
      failure: { type: 'any', conditions: [{ type: 'dead', actor: 'commander' }] },
    });
    const complete = panel.getScenario();
    click(root, 'Move objective 2 earlier');
    expect(panel.getScenario().objectives.map(objective => objective.id)).toEqual(['crossing', 'survive']);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(complete);
    click(root, 'Remove Objective 2 success condition 2');
    expect(panel.getScenario().objectives[1].success).toEqual({ type: 'all', conditions: [{ type: 'alive', actor: 'commander' }] });
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(complete);
    expect(control(root, 'Objective 2 success condition 2 child variable').value).toBe('gate-closed');
    click(root, 'Remove objective 2');
    expect(panel.getScenario().objectives).toHaveLength(1);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(complete);
  });

  it('authors spawn, order, variable, message, reward and finish actions in their event order', () => {
    const { root, panel } = setup();
    click(root, 'Add event');
    change(root, 'Event 1 ID', 'open-gate');
    change(root, 'Event 1 trigger type', 'variable');
    change(root, 'Event 1 trigger variable', 'progress');
    change(root, 'Event 1 trigger value', 2);
    change(root, 'Event 1 action 1 type', 'spawn');
    change(root, 'Event 1 action 1 actor 1 label', 'reinforcement');
    change(root, 'Event 1 action 1 actor 1 role', 'ranged');
    change(root, 'Event 1 action 1 actor 1 position X', 24.5);
    change(root, 'Event 1 action 1 actor 1 position Y', 25.5);
    toggle(root, 'Event 1 action 1 actor 1 initial order');
    change(root, 'Event 1 action 1 actor 1 order type', 'attackMove');
    change(root, 'Event 1 action 1 actor 1 destination X', 14.5);
    change(root, 'Event 1 action 1 actor 1 destination Y', 15.5);
    click(root, 'Add Event 1 action 1 actor');
    expect(new Set((panel.getScenario().events[0].actions[0] as Extract<ScenarioAction, { type: 'spawn' }>).actors.map(actor => actor.label)).size).toBe(2);
    click(root, 'Remove Event 1 action 1 actor 2');

    click(root, 'Add event 1 action');
    change(root, 'Event 1 action 2 type', 'order');
    change(root, 'Event 1 action 2 actor labels', 'commander, reinforcement');
    change(root, 'Event 1 action 2 order type', 'attack');
    change(root, 'Event 1 action 2 attack target', 'reinforcement');
    click(root, 'Add event 1 action');
    change(root, 'Event 1 action 3 type', 'set');
    change(root, 'Event 1 action 3 variable', 'gate-open');
    change(root, 'Event 1 action 3 value', 1);
    click(root, 'Add event 1 action');
    change(root, 'Event 1 action 4 type', 'add');
    change(root, 'Event 1 action 4 variable', 'progress');
    change(root, 'Event 1 action 4 value', 2);
    click(root, 'Add event 1 action');
    change(root, 'Event 1 action 5 message', 'The gate is open.');
    change(root, 'Event 1 action 5 speaker', 'Scout');
    click(root, 'Add event 1 action');
    change(root, 'Event 1 action 6 type', 'reward');
    change(root, 'Event 1 action 6 wood', 75);
    change(root, 'Event 1 action 6 ore', 25);
    change(root, 'Event 1 action 6 crystal', 10);
    click(root, 'Add event 1 action');
    change(root, 'Event 1 action 7 type', 'finish');
    change(root, 'Event 1 action 7 outcome', 'lost');
    change(root, 'Event 1 action 7 reason', 'The convoy was lost.');
    expect(panel.getScenario().events).toEqual([{
      id: 'open-gate', when: { type: 'variable', key: 'progress', op: 'gte', value: 2 }, actions: [
        { type: 'spawn', actors: [{ label: 'reinforcement', side: 1, kind: 'unit', role: 'ranged', x: 24.5, y: 25.5, order: { type: 'attackMove', x: 14.5, y: 15.5 } }] },
        { type: 'order', actors: ['commander', 'reinforcement'], order: { type: 'attack', actor: 'reinforcement' } },
        { type: 'set', key: 'gate-open', value: 1 }, { type: 'add', key: 'progress', value: 2 },
        { type: 'message', text: 'The gate is open.', speaker: 'Scout' },
        { type: 'reward', side: 0, resources: { wood: 75, ore: 25, crystal: 10 } },
        { type: 'finish', outcome: 'lost', reason: 'The convoy was lost.' },
      ],
    }]);
    const complete = panel.getScenario();
    click(root, 'Move event 1 action 7 earlier');
    expect(panel.getScenario().events[0].actions.map(action => action.type)).toEqual(['spawn', 'order', 'set', 'add', 'message', 'finish', 'reward']);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(complete);
    click(root, 'Remove event 1 action 4');
    expect(panel.getScenario().events[0].actions.map(action => action.type)).toEqual(['spawn', 'order', 'set', 'message', 'reward', 'finish']);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(complete);
    click(root, 'Remove event 1');
    expect(panel.getScenario().events).toEqual([]);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(complete);
    click(root, 'Validate scenario');
    expect(status(root).textContent).toBe('Scenario and its map dependency are valid.');
  });

  it('edits and reorders escort checkpoints and copies the destination into an objective', () => {
    const { root, panel } = setup();
    toggle(root, 'Enable escort route');
    change(root, 'Escort checkpoint radius', 1.5);
    change(root, 'Nearby escort radius', 6);
    change(root, 'Escort checkpoint 1 X', 13.5);
    change(root, 'Escort checkpoint 1 Y', 14.5);
    change(root, 'Escort checkpoint 2 X', 20.5);
    change(root, 'Escort checkpoint 2 Y', 21.5);
    click(root, 'Add escort checkpoint');
    change(root, 'Escort checkpoint 3 X', 28.5);
    change(root, 'Escort checkpoint 3 Y', 29.5);
    click(root, 'Move escort checkpoint 3 earlier');
    expect(panel.getScenario().escort).toEqual({ actor: 'commander', route: [{ x: 13.5, y: 14.5 }, { x: 28.5, y: 29.5 }, { x: 20.5, y: 21.5 }], radius: 1.5, escortRadius: 6 });
    click(root, 'Remove escort checkpoint 3');
    click(root, 'Add escort destination objective');
    const objective = panel.getScenario().objectives[1];
    expect(objective).toEqual({ id: 'escort-1', text: 'Escort the named actor to the final checkpoint.', success: { type: 'at', actor: 'commander', point: { x: 28.5, y: 29.5 }, radius: 1.5 }, failure: { type: 'dead', actor: 'commander' } });
    change(root, 'Escort checkpoint 2 X', 30.5);
    expect(panel.getScenario().objectives[1]).toEqual(objective);
    const withEscort = panel.getScenario();
    toggle(root, 'Enable escort route');
    expect(panel.getScenario().escort).toBeUndefined();
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(withEscort);
    click(root, 'Validate scenario');
    expect(status(root).textContent).toBe('Scenario and its map dependency are valid.');
  });

  it('expands timed arrivals into separate spawn events with unique actor labels and atomic undo', () => {
    const { root, panel } = setup();
    const before = panel.getScenario();
    change(root, 'Wave starts at seconds', 12);
    change(root, 'Wave interval seconds', 9);
    change(root, 'Wave arrivals', 3);
    change(root, 'Wave actor count', 2);
    change(root, 'Wave actor role', 'ranged');
    change(root, 'Wave spawn X', 24.5);
    change(root, 'Wave spawn Y', 26.5);
    change(root, 'Wave attack destination X', 14.5);
    change(root, 'Wave attack destination Y', 15.5);
    expect(panel.getScenario()).toEqual(before);
    click(root, 'Add timed wave');
    const events = panel.getScenario().events;
    expect(events.map(event => event.id)).toEqual(['wave-1', 'wave-2', 'wave-3']);
    expect(events.map(event => event.when)).toEqual([12, 21, 30].map(seconds => ({ type: 'time', seconds })));
    const labels: string[] = [];
    events.forEach(event => {
      expect(event.repeat).toBeUndefined();
      expect(event.actions).toHaveLength(1);
      expect(event.actions[0].type).toBe('spawn');
      const actors = (event.actions[0] as Extract<ScenarioAction, { type: 'spawn' }>).actors;
      expect(actors).toEqual([0, 1].map(index => ({ label: `${event.id}-actor-${index + 1}`, side: 1, kind: 'unit', role: 'ranged', x: 24.5 + index * .8, y: 26.5, order: { type: 'attackMove', x: 14.5, y: 15.5 } })));
      labels.push(...actors.map(actor => actor.label));
    });
    expect(new Set(labels).size).toBe(6);
    click(root, 'Move event 3 earlier');
    expect(panel.getScenario().events.map(event => event.id)).toEqual(['wave-1', 'wave-3', 'wave-2']);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario().events).toEqual(events);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(before);
    click(root, 'Redo scenario edit');
    expect(panel.getScenario().events).toEqual(events);
    click(root, 'Add timed wave');
    const repeated = panel.getScenario().events;
    expect(new Set(repeated.map(event => event.id)).size).toBe(6);
    expect(new Set(repeated.flatMap(event => (event.actions[0] as Extract<ScenarioAction, { type: 'spawn' }>).actors.map(actor => actor.label))).size).toBe(12);
    click(root, 'Validate scenario');
    expect(status(root).textContent).toBe('Scenario and its map dependency are valid.');
  });

  it('places map coordinates through the callback and cancels stale handlers with Escape', () => {
    const { root, panel, placement, setPlacement } = setup();
    expect(panel.isPlacing()).toBe(false);
    expect(panel.cancelPlacement()).toBe(false);
    click(root, 'Place Actor 1 position on map');
    expect(panel.isPlacing()).toBe(true);
    expect(status(root).textContent).toContain('Click the map to place Actor 1 position');
    expect(placement()).toBeTypeOf('function');
    placement()!({ x: 20.5, y: 21.5, level: 0 });
    expect(panel.getScenario().army[0]).toMatchObject({ x: 20.5, y: 21.5 });
    expect(control(root, 'Actor 1 position X').value).toBe('20.5');
    expect(setPlacement).toHaveBeenLastCalledWith(null);
    expect(panel.isPlacing()).toBe(false);
    const placed = panel.getScenario();
    click(root, 'Place Actor 1 position on map');
    const canceledHandler = placement()!;
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const parentEscapeBubble = vi.fn();
    window.addEventListener('keydown', parentEscapeBubble);
    document.body.dispatchEvent(escape);
    window.removeEventListener('keydown', parentEscapeBubble);
    expect(escape.defaultPrevented).toBe(true);
    expect(parentEscapeBubble).not.toHaveBeenCalled();
    expect(placement()).toBeNull();
    expect(status(root).textContent).toBe('Scenario placement canceled.');
    canceledHandler({ x: 30.5, y: 31.5, level: 0 });
    expect(panel.getScenario()).toEqual(placed);
    click(root, 'Place Actor 1 position on map');
    placement()!({ x: 30.5, y: 31.5, level: 1 });
    expect(panel.getScenario()).toEqual(placed);
    expect(status(root).textContent).toContain('level');
    click(root, 'Place Actor 1 position on map');
    const publiclyCanceled = placement()!;
    expect(panel.cancelPlacement()).toBe(true);
    expect(panel.cancelPlacement()).toBe(false);
    publiclyCanceled({ x: 32.5, y: 33.5, level: 0 });
    expect(panel.getScenario()).toEqual(placed);
    click(root, 'Place Actor 1 position on map');
    panel.destroy();
    expect(placement()).toBeNull();
    expect(root.children).toHaveLength(0);
  });

  it('ignores a canceled placement callback while a different placement is active', () => {
    const { root, panel, placement, setPlacement, onChange } = setup();
    change(root, 'Objective 1 success type', 'at');
    const before = panel.getScenario();
    click(root, 'Place Actor 1 position on map');
    const oldActorPlacement = placement()!;
    expect(panel.cancelPlacement()).toBe(true);
    click(root, 'Place Objective 1 success point on map');
    const currentObjectivePlacement = placement()!;
    const placementCalls = setPlacement.mock.calls.length, changes = onChange.mock.calls.length;
    oldActorPlacement({ x: 35.5, y: 36.5, level: 0 });
    expect(panel.getScenario()).toEqual(before);
    expect(onChange).toHaveBeenCalledTimes(changes);
    expect(setPlacement).toHaveBeenCalledTimes(placementCalls);
    expect(placement()).toBe(currentObjectivePlacement);
    expect(panel.isPlacing()).toBe(true);
    currentObjectivePlacement({ x: 18.5, y: 19.5, level: 0 });
    expect(panel.getScenario().army).toEqual(before.army);
    expect(panel.getScenario().objectives[0].success).toEqual({ type: 'at', actor: 'commander', point: { x: 18.5, y: 19.5 }, radius: 2 });
    expect(onChange).toHaveBeenCalledTimes(changes + 1);
    expect(placement()).toBeNull();
    expect(panel.isPlacing()).toBe(false);
    expect(setPlacement).toHaveBeenLastCalledWith(null);
  });

  it.each(['nonfinite', 'outside the map'])('rejects a %s map placement without changing the draft', kind => {
    const { root, panel, placement, setPlacement, onChange, map } = setup();
    const before = panel.getScenario();
    click(root, 'Place Actor 1 position on map');
    placement()!({ x: kind === 'nonfinite' ? NaN : map().map.width, y: 19.5, level: 0 });
    expect(panel.getScenario()).toEqual(before);
    expect(onChange).not.toHaveBeenCalled();
    expect(status(root).textContent).toBe('Choose a point inside the playable map.');
    expect(status(root).classList.contains('editor-error')).toBe(true);
    expect(panel.isPlacing()).toBe(false);
    expect(setPlacement).toHaveBeenLastCalledWith(null);
    expect(control(root, 'Actor 1 position X').value).toBe(String(before.army[0].x));
  });

  it('retains collapsed sections after edits and adds a required objective for a custom victory', () => {
    const { root, panel } = setup();
    const army = root.querySelector<HTMLDetailsElement>('[data-scenario-section="army"]')!;
    expect(army.open).toBe(true);
    army.querySelector<HTMLElement>('summary')!.click();
    change(root, 'Scenario title', 'Gate watchers');
    expect(root.querySelector<HTMLDetailsElement>('[data-scenario-section="army"]')!.open).toBe(false);
    click(root, 'Add custom win condition');
    const scenario = panel.getScenario();
    const when = { type: 'variable', key: 'progress', op: 'gte', value: 1 };
    expect(scenario.events).toEqual([{ id: 'custom-win-1', when, actions: [{ type: 'finish', outcome: 'won', reason: 'Custom victory condition completed.' }] }]);
    expect(scenario.objectives[1]).toEqual({ id: 'custom-victory-1', text: 'Complete the custom victory condition.', success: when });
    expect(scenario.objectives[1].optional).not.toBe(true);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario().events).toEqual([]);
    expect(panel.getScenario().objectives).toHaveLength(1);
  });

  it('retains an open event during a delayed toggle and ignores the detached section toggle', () => {
    const { root, panel } = setup();
    click(root, 'Add event');
    click(root, 'Add event');
    const oldDetails = root.querySelector<HTMLDetailsElement>('[data-scenario-section="event-1"]')!;
    const deferToggle = (event: Event) => event.stopImmediatePropagation();
    oldDetails.addEventListener('toggle', deferToggle, { capture: true });
    oldDetails.querySelector<HTMLElement>('summary')!.click();
    expect(oldDetails.open).toBe(true);
    change(root, 'Event 2 trigger type', 'all');
    const currentDetails = root.querySelector<HTMLDetailsElement>('[data-scenario-section="event-1"]')!;
    expect(currentDetails).not.toBe(oldDetails);
    expect(currentDetails.open).toBe(true);
    expect(oldDetails.isConnected).toBe(false);
    oldDetails.removeEventListener('toggle', deferToggle, { capture: true });
    oldDetails.querySelector<HTMLElement>('summary')!.click();
    expect(oldDetails.open).toBe(false);
    oldDetails.dispatchEvent(new Event('toggle'));
    change(root, 'Event 2 trigger condition 1 seconds', 25);
    expect(root.querySelector<HTMLDetailsElement>('[data-scenario-section="event-1"]')!.open).toBe(true);
    expect(panel.getScenario().events[1].when).toEqual({ type: 'all', conditions: [{ type: 'time', seconds: 25 }] });
  });

  it('keeps the newest file selection and ignores file reads superseded by an edit', async () => {
    const { root, panel, onImportMap } = setup();
    const oldRead = deferredRead(), latestRead = deferredRead(), editedRead = deferredRead();
    vi.spyOn(File.prototype, 'text').mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(latestRead.promise).mockReturnValueOnce(editedRead.promise);
    const oldDraft = createScenarioDraft(), latestDraft = createScenarioDraft();
    oldDraft.title = 'Older selection'; latestDraft.title = 'Newest selection';
    const oldPackage = makeScenarioPackage({ author: 'Old author', revision: 1 }, oldDraft, playableMap(4128));
    const latestPackage = makeScenarioPackage({ author: 'Latest author', revision: 2 }, latestDraft, playableMap(4129));
    importFile(root, JSON.stringify(oldPackage));
    importFile(root, JSON.stringify(latestPackage));
    latestRead.resolve(JSON.stringify(latestPackage));
    await vi.waitFor(() => expect(panel.getScenario()).toEqual(latestPackage.scenario));
    oldRead.resolve(JSON.stringify(oldPackage));
    await oldRead.promise;
    expect(panel.getScenario()).toEqual(latestPackage.scenario);
    expect(onImportMap).toHaveBeenCalledTimes(1);
    expect(onImportMap).toHaveBeenLastCalledWith(latestPackage.map);
    importFile(root, JSON.stringify(oldPackage));
    change(root, 'Scenario title', 'Edited while the file was read');
    const edited = panel.getScenario();
    editedRead.resolve(JSON.stringify(oldPackage));
    await editedRead.promise;
    expect(panel.getScenario()).toEqual(edited);
    expect(onImportMap).toHaveBeenCalledTimes(1);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(latestPackage.scenario);
  });

  it.each(['malformed JSON', 'tampered checksums'])('rejects %s from the file control without replacing the document or map', async kind => {
    const { root, panel, onChange, onImportMap, map } = setup();
    change(root, 'Scenario title', 'Keep this draft');
    const before = panel.getScenario(), currentMap = map(), changes = onChange.mock.calls.length;
    const imported = makeScenarioPackage({ author: 'Imported author', revision: 7 }, createScenarioDraft(), playableMap(4128));
    imported.scenario.title = 'Tampered title';
    importFile(root, kind === 'malformed JSON' ? '{' : JSON.stringify(imported));
    await vi.waitFor(() => expect(status(root).classList.contains('editor-error')).toBe(true));
    expect(status(root).textContent).toContain(kind === 'malformed JSON' ? 'invalid JSON' : 'checksum mismatch');
    expect(panel.getScenario()).toEqual(before);
    expect(control(root, 'Scenario title').value).toBe('Keep this draft');
    expect(onChange).toHaveBeenCalledTimes(changes);
    expect(onImportMap).not.toHaveBeenCalled();
    expect(map()).toBe(currentMap);
    click(root, 'Undo scenario edit');
    expect(panel.getScenario()).toEqual(createScenarioDraft());
  });

  it('imports the file package and binds play to the map currently supplied by the editor', async () => {
    const { root, panel, onImportMap, onChange, playScenario, useMap } = setup();
    const draft = createScenarioDraft();
    draft.id = 'river-crossing'; draft.title = 'River crossing'; draft.briefing = 'Keep the route open.';
    const imported = makeScenarioPackage({ author: 'Mission author', revision: 7 }, draft, playableMap(4128));
    importFile(root, JSON.stringify(imported));
    await vi.waitFor(() => expect(onImportMap).toHaveBeenCalledTimes(1));
    expect(onImportMap).toHaveBeenLastCalledWith(imported.map);
    expect(panel.getScenario()).toEqual(imported.scenario);
    expect(onChange).toHaveBeenLastCalledWith(imported.scenario);
    expect(control(root, 'Scenario title').value).toBe('River crossing');
    expect(control(root, 'Scenario author').value).toBe('Mission author');
    expect(control(root, 'Scenario revision').value).toBe('7');
    const currentMap = playableMap(4129);
    useMap(currentMap);
    click(root, 'Validate scenario');
    expect(status(root).textContent).toBe('Scenario and its map dependency are valid.');
    click(root, 'Play scenario');
    await vi.waitFor(() => expect(playScenario).toHaveBeenCalledTimes(1));
    const played = playScenario.mock.calls[0][0];
    expect(played).toMatchObject({ author: 'Mission author', revision: 7, mapHash: currentMap.hash, map: currentMap });
    expect(played.scenario).toEqual({ ...imported.scenario, seed: currentMap.map.seed, map: scenarioMapFromPackage(currentMap) });
    expect(decodeScenarioPackage(played)).toEqual(played);
    await vi.waitFor(() => expect(status(root).textContent).toBe('Playing River crossing.'));
    expect(panel.getScenario()).toEqual(imported.scenario);
  });

  it('exports a downloadable package containing authored metadata and the current map', async () => {
    const { root, panel, map } = setup();
    let downloaded: HTMLAnchorElement | undefined, exported: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { exported = blob as Blob; return 'blob:scenario-export'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloaded = this; });
    change(root, 'Scenario ID', 'last-crossing');
    change(root, 'Scenario title', 'The last crossing');
    change(root, 'Scenario author', 'Mission author');
    change(root, 'Scenario revision', 3);
    const before = panel.getScenario();
    click(root, 'Export scenario');
    expect(downloaded?.download).toBe('last-crossing-r3.scenario.json');
    expect(downloaded?.href).toBe('blob:scenario-export');
    expect(exported?.type).toBe('application/json');
    const packaged = decodeScenarioPackage(await exported!.text());
    expect(packaged).toMatchObject({ author: 'Mission author', revision: 3, map: map(), mapHash: map().hash });
    expect(packaged.scenario).toEqual({ ...before, seed: map().map.seed, map: scenarioMapFromPackage(map()) });
    expect(panel.getScenario()).toEqual(before);
    expect(status(root).textContent).toBe('Scenario exported with its map dependency and checksums.');
  });

  it('preserves imported world levels through coordinate edits, map placement, timed waves, export and play', async () => {
    const { root, panel, onImportMap, placement, playScenario } = setup();
    const worldMap = playableWorldMap(), draft = createScenarioDraft();
    draft.army[0] = { ...draft.army[0], level: 1, order: { type: 'move', x: 18.5, y: 19.5, level: 1 } };
    draft.objectives[0].success = { type: 'at', actor: 'commander', point: { x: 20.5, y: 21.5, level: 1 }, radius: 2 };
    draft.escort = { actor: 'commander', route: [{ x: 10.5, y: 11.5, level: 1 }, { x: 20.5, y: 21.5, level: 1 }], radius: 1.2, escortRadius: 5 };
    draft.events = [{ id: 'cavern-order', when: { type: 'time', seconds: 10 }, actions: [{ type: 'order', actors: ['commander'], order: { type: 'attackMove', x: 22.5, y: 23.5, level: 1 } }] }];
    const imported = makeScenarioPackage({ author: 'World author', revision: 4 }, draft, worldMap);
    importFile(root, JSON.stringify(imported));
    await vi.waitFor(() => expect(onImportMap).toHaveBeenCalledTimes(1));
    expect(panel.getScenario()).toEqual(imported.scenario);
    for (const label of ['Actor 1 position', 'Actor 1 destination', 'Objective 1 success point', 'Escort checkpoint 1', 'Escort checkpoint 2', 'Event 1 action 1 destination']) {
      expect(control(root, `${label} level`).value).toBe('1');
    }
    expect(Array.from((control(root, 'Actor 1 position level') as HTMLSelectElement).options).map(option => option.value)).toEqual(['0', '1']);
    change(root, 'Actor 1 position X', 12.5);
    expect(panel.getScenario().army[0]).toMatchObject({ x: 12.5, level: 1 });
    change(root, 'Actor 1 position level', '0');
    expect(panel.getScenario().army[0].level).toBe(0);
    change(root, 'Actor 1 position level', '1');
    change(root, 'Actor 1 destination X', 19.5);
    change(root, 'Objective 1 success point X', 24.5);
    change(root, 'Objective 1 success point level', '0');
    change(root, 'Objective 1 success point level', '1');
    change(root, 'Escort checkpoint 2 X', 25.5);
    click(root, 'Add escort checkpoint');
    expect(control(root, 'Escort checkpoint 3 level').value).toBe('1');
    change(root, 'Escort checkpoint 3 X', 26.5);
    change(root, 'Event 1 action 1 destination Y', 26.5);
    click(root, 'Place Actor 1 position on map');
    placement()!({ x: 14.5, y: 15.5, level: 1 });
    click(root, 'Place Objective 1 success point on map');
    placement()!({ x: 27.5, y: 28.5, level: 1 });
    const edited = panel.getScenario();
    expect(edited.army[0]).toMatchObject({ x: 14.5, y: 15.5, level: 1, order: { type: 'move', x: 19.5, y: 19.5, level: 1 } });
    expect(edited.objectives[0].success).toEqual({ type: 'at', actor: 'commander', point: { x: 27.5, y: 28.5, level: 1 }, radius: 2 });
    expect(edited.escort!.route).toEqual([{ x: 10.5, y: 11.5, level: 1 }, { x: 25.5, y: 21.5, level: 1 }, { x: 26.5, y: 21.5, level: 1 }]);
    expect((edited.events[0].actions[0] as Extract<ScenarioAction, { type: 'order' }>).order).toEqual({ type: 'attackMove', x: 22.5, y: 26.5, level: 1 });
    change(root, 'Wave starts at seconds', 20);
    change(root, 'Wave interval seconds', 10);
    change(root, 'Wave arrivals', 2);
    change(root, 'Wave actor count', 2);
    change(root, 'Wave spawn level', '1');
    change(root, 'Wave spawn X', 30.5);
    change(root, 'Wave spawn Y', 31.5);
    change(root, 'Wave attack destination level', '1');
    change(root, 'Wave attack destination X', 16.5);
    change(root, 'Wave attack destination Y', 17.5);
    click(root, 'Add timed wave');
    const authored = panel.getScenario();
    const arrivals = authored.events.slice(1);
    expect(arrivals.map(event => event.when)).toEqual([{ type: 'time', seconds: 20 }, { type: 'time', seconds: 30 }]);
    arrivals.forEach(event => {
      const actors = (event.actions[0] as Extract<ScenarioAction, { type: 'spawn' }>).actors;
      expect(actors).toHaveLength(2);
      actors.forEach(actor => expect(actor).toMatchObject({ level: 1, order: { type: 'attackMove', x: 16.5, y: 17.5, level: 1 } }));
    });
    let exported: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { exported = blob as Blob; return 'blob:scenario-world-export'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    click(root, 'Export scenario');
    const packaged = decodeScenarioPackage(await exported!.text());
    expect(packaged.scenario).toEqual(authored);
    expect(packaged.map).toEqual(worldMap);
    expect(packaged.scenario.map!.world).toEqual(worldMap.map);
    expect(packaged.scenario.map!.world!.levels).toHaveLength(2);
    expect(packaged.scenario.map!.world!.sites).toEqual(worldMap.map.sites);
    expect(packaged.scenario.map!.world!.transitions).toEqual(worldMap.map.transitions);
    click(root, 'Play scenario');
    await vi.waitFor(() => expect(playScenario).toHaveBeenCalledTimes(1));
    expect(decodeScenarioPackage(playScenario.mock.calls[0][0])).toEqual(packaged);
  });

  it('keeps unresolved actor references editable and prevents play until the author fixes them', async () => {
    const { root, panel, playScenario } = setup();
    change(root, 'Objective 1 failure actor', 'missing-actor');
    expect(panel.getScenario().objectives[0].failure).toEqual({ type: 'dead', actor: 'missing-actor' });
    expect(root.querySelector('[aria-label="Scenario validation"]')!.textContent).toContain('unknown actor label missing-actor');
    click(root, 'Play scenario');
    await vi.waitFor(() => expect(status(root).textContent).toContain('unknown actor label missing-actor'));
    expect(playScenario).not.toHaveBeenCalled();
    change(root, 'Objective 1 failure actor', 'commander');
    click(root, 'Play scenario');
    await vi.waitFor(() => expect(playScenario).toHaveBeenCalledTimes(1));
    expect(decodeScenarioPackage(playScenario.mock.calls[0][0]).scenario.objectives[0].failure).toEqual({ type: 'dead', actor: 'commander' });
  });
});


describe('scenario authoring with the assembled registry', () => {
  it('preserves a real commander definition and uses its health bound', () => {
    const { root, panel } = setup();
    change(root, 'Actor 1 role', 'special');
    change(root, 'Actor 1 custom definition ID', 'core:orcs-commander');
    toggle(root, 'Actor 1 custom health');
    expect(panel.getScenario().army[0].definitionId).toBe('core:orcs-commander');
    expect(panel.getScenario().army[0].hp).toBe(280);
    expect((control(root, 'Actor 1 health') as HTMLInputElement).max).toBe('280');
    expect(decodeScenarioPackage(panel.exportPackage()).scenario.army[0].definitionId).toBe('core:orcs-commander');
  });

  it('authors an alliance event without dropping its state', () => {
    const { root, panel } = setup();
    click(root, 'Add event');
    change(root, 'Event 1 action 1 type', 'alliance');
    expect(panel.getScenario().events[0].actions[0]).toEqual({ type: 'alliance', allied: true });
    toggle(root, 'Event 1 action 1 sides allied');
    expect(decodeScenarioPackage(panel.exportPackage()).scenario.events[0].actions[0]).toEqual({ type: 'alliance', allied: false });
  });
});


describe('self-contained custom scenario content', () => {
  it('uses a selected pinned package for authoring and preserves its complete export', () => {
    const content = createContentBundle([exampleMod()]);
    const { root, panel } = setup({ contentOptions: () => [{ id: 'lantern', label: 'Lantern Keepers 1.0.0', content }] });
    change(root, 'Scenario content', 'lantern'); click(root, 'Use selected scenario content');
    change(root, 'Player faction', 'lantern:keepers');
    change(root, 'Actor 1 custom definition ID', 'lantern:duelist');
    toggle(root, 'Actor 1 custom health');
    expect(panel.getScenario().army[0].hp).toBe(110);
    const exported = decodeScenarioPackage(panel.exportPackage());
    expect(exported.scenario.content).toEqual(content);
    expect(exported.scenario.faction).toBe('lantern:keepers');
    expect(exported.scenario.army[0].definitionId).toBe('lantern:duelist');
    const imported = setup(); imported.panel.importPackage(exported);
    expect(imported.panel.exportPackage()).toEqual(exported);
  });
});
