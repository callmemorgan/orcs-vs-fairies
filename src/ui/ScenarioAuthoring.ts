import { FACTIONS } from '../core/content';
import { contentFactions } from '../core/content-registry';
import type { ScenarioAction, ScenarioActor, ScenarioCondition, ScenarioDefinition, ScenarioObjective, ScenarioOrder, ScenarioTrigger } from '../core/scenario-types';
import type { BuildingRole, FactionId, Side, UnitRole, Vec } from '../core/types';
import { EditorDocument } from '../editor/document';
import type { EditorPoint, MapPackage } from '../editor/map-package';
import { createScenarioDraft, decodeScenarioDefinition, decodeScenarioDraft, decodeScenarioPackage, makeScenarioPackage, scenarioMapFromPackage, SCENARIO_EDITOR_LIMITS } from '../editor/scenario-package';
import type { ScenarioPackage } from '../editor/scenario-package';
import './scenario-authoring.css';

export interface ScenarioAuthoringCallbacks {
  getMap: () => MapPackage;
  playScenario: (scenario: ScenarioPackage) => void | Promise<void>;
  onChange?: (scenario: ScenarioDefinition) => void;
  onImportMap?: (map: MapPackage) => void;
  setPlacement?: (handler: ((point: EditorPoint) => void) | null) => void;
}
const unitRoles: UnitRole[] = ['worker', 'melee', 'ranged', 'special', 'cavalry', 'spear', 'siege'];
const buildingRoles: BuildingRole[] = ['hq', 'depot', 'barracks', 'tower', 'wall', 'gate'];
const conditionTypes = ['alive', 'dead', 'at', 'time', 'variable', 'cleared', 'all', 'any', 'not'] as const;
const conditionNames: Record<ScenarioCondition['type'], string> = { alive: 'Actor is alive', dead: 'Actor is dead', at: 'Actor reaches a point', time: 'Elapsed time', variable: 'Variable comparison', cleared: 'Side has been cleared', all: 'All conditions', any: 'Any condition', not: 'Condition is false' };
const actionNames: Record<ScenarioAction['type'], string> = { spawn: 'Spawn actors', order: 'Order actors', set: 'Set variable', add: 'Add to variable', message: 'Show message', reward: 'Give resources', alliance: 'Change alliance', finish: 'Finish mission' };
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
function button(text: string, action: () => void): HTMLButtonElement { const node = element('button', text); node.type = 'button'; node.addEventListener('click', action); return node; }
function field(parent: HTMLElement, name: string, input: HTMLElement): void { const label = element('label'); label.className = 'editor-field'; label.append(element('span', name), input); parent.append(label); }
function group(parent: HTMLElement, title: string): HTMLFieldSetElement { const node = element('fieldset'); node.className = 'scenario-group'; node.append(element('legend', title)); parent.append(node); return node; }
function errorText(error: unknown): string { return error instanceof Error ? error.message : 'The scenario could not be changed.'; }

/** All authored edits use an independent undo history; play/export bind the current map package. */
export function mountScenarioAuthoring(parent: HTMLElement, callbacks: ScenarioAuthoringCallbacks) {
  const doc = new EditorDocument<ScenarioDefinition>(createScenarioDraft(), decodeScenarioDraft);
  let author = 'Local author', revision = 1, disposed = false, busy = false, placing = false, importGeneration = 0, placementGeneration = 0;
  let bounds = { width: 256, height: 256 };
  let levels = [{ id: 0, title: 'Ground' }];
  const openedSections = new Map<string, boolean>();
  const host = element('section'); host.className = 'scenario-authoring'; host.setAttribute('aria-label', 'Scenario authoring');
  const heading = element('h2', 'Scenario authoring');
  const intro = element('p', 'Place named actors, write objectives, and connect conditions to event actions. Changes have their own undo history. Play and export include the map currently open in the map editor.');
  const notice = element('p'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
  const validation = element('p'); validation.setAttribute('aria-label', 'Scenario validation');
  const toolbar = element('div'); toolbar.className = 'editor-actions';
  const undo = button('Undo scenario edit', () => run(() => { doc.undo(); changed(); }));
  const redo = button('Redo scenario edit', () => run(() => { doc.redo(); changed(); }));
  const check = button('Validate scenario', () => run(() => { exportPackage(); message('Scenario and its map dependency are valid.'); }));
  const play = button('Play scenario', () => { void playCurrent(); }); play.dataset.scenarioPlay = '';
  const exportButton = button('Export scenario', () => run(() => {
    const pkg = exportPackage(), blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = element('a');
    link.href = url; link.download = `${pkg.scenario.id}-r${pkg.revision}.scenario.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Scenario exported with its map dependency and checksums.');
  })); exportButton.dataset.scenarioExport = '';
  const importInput = element('input'); importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.setAttribute('aria-label', 'Import scenario package'); importInput.dataset.scenarioImport = '';
  importInput.addEventListener('change', () => {
    const generation = ++importGeneration, file = importInput.files?.[0]; if (!file) return;
    if (file.size > SCENARIO_EDITOR_LIMITS.bytes) { message('Scenario package exceeds the 20 MB import limit.', true); importInput.value = ''; return; }
    void file.text().then(text => { if (!disposed && generation === importGeneration) run(() => { importPackage(text); importInput.value = ''; message('Scenario and its embedded map imported.'); }); })
      .catch(error => { if (!disposed && generation === importGeneration) message(errorText(error), true); })
      .finally(() => { if (generation === importGeneration) importInput.value = ''; });
  });
  const reset = button('New scenario', () => run(() => { cancelPlacement(); doc.replace('New scenario', createScenarioDraft()); changed(); message('A new scenario draft is ready. Undo restores the previous draft.'); }));
  toolbar.append(undo, redo, check, play, exportButton, reset); field(toolbar, 'Import scenario package', importInput);
  const content = element('div'); content.className = 'scenario-content';
  host.append(heading, intro, toolbar, notice, validation, content); parent.append(host);

  function message(text: string, failed = false): void { notice.textContent = text; notice.classList.toggle('editor-error', failed); }
  function disclosure(parent: HTMLElement, title: string, key: string, initialOpen = false): HTMLElement {
    const details = element('details'); details.className = 'scenario-disclosure'; details.open = openedSections.get(key) ?? initialOpen; details.dataset.scenarioSection = key;
    details.append(element('summary', title)); details.addEventListener('toggle', () => { if (details.isConnected) openedSections.set(key, details.open); }); parent.append(details); return details;
  }
  function run(action: () => void): void { if (disposed || busy) return; try { action(); } catch (error) { message(errorText(error), true); refresh(); } }
  function changed(): void { ++importGeneration; callbacks.onChange?.(doc.snapshot()); refresh(); }
  function edit(label: string, mutator: (draft: ScenarioDefinition) => void): void { run(() => { cancelPlacement(); doc.edit(label, mutator); changed(); }); }
  function textInput(parent: HTMLElement, label: string, value: string, write: (value: string) => void, max = 200, multiline = false): HTMLInputElement | HTMLTextAreaElement {
    const node = multiline ? element('textarea') : element('input'); node.value = value; node.maxLength = max; node.setAttribute('aria-label', label); node.dataset.scenarioField = label;
    if (node instanceof HTMLTextAreaElement) node.rows = Math.min(5, Math.max(2, value.split('\n').length));
    node.addEventListener('change', () => write(node.value)); field(parent, label, node); return node;
  }
  function numberInput(parent: HTMLElement, label: string, value: number, write: (value: number) => void, min = 0, max = 1e9, step = 'any'): HTMLInputElement {
    const node = element('input'); node.type = 'number'; node.value = String(value); node.min = String(min); node.max = String(max); node.step = step; node.setAttribute('aria-label', label); node.dataset.scenarioField = label;
    node.addEventListener('change', () => { const n = node.value.trim() ? Number(node.value) : NaN; if (!Number.isFinite(n) || n < min || n > max || (step === '1' && !Number.isSafeInteger(n))) { message(`${label} must be ${step === '1' ? 'a whole number' : 'a finite number'} from ${min} through ${max}.`, true); node.value = String(value); return; } write(n); }); field(parent, label, node); return node;
  }
  function select<T extends string>(parent: HTMLElement, label: string, value: T, options: readonly T[], write: (value: T) => void, names?: Partial<Record<T, string>>): HTMLSelectElement {
    const node = element('select'); node.setAttribute('aria-label', label); node.dataset.scenarioField = label;
    for (const value of options) { const option = element('option', names?.[value] ?? value); option.value = value; node.append(option); } node.value = value;
    node.addEventListener('change', () => write(node.value as T)); field(parent, label, node); return node;
  }
  function checkbox(parent: HTMLElement, label: string, value: boolean, write: (value: boolean) => void): HTMLInputElement { const node = element('input'); node.type = 'checkbox'; node.checked = value; node.setAttribute('aria-label', label); node.dataset.scenarioField = label; node.addEventListener('change', () => write(node.checked)); field(parent, label, node); return node; }
  function actorReference(parent: HTMLElement, label: string, value: string, write: (value: string) => void): void { const input = textInput(parent, label, value, write, 64) as HTMLInputElement; input.setAttribute('list', `scenario-actor-labels-${instance}`); }
  function mapBounds(): { width: number; height: number } { return bounds; }
  function position(parent: HTMLElement, label: string, value: Vec, write: (point: Vec) => void): void {
    const { width, height } = mapBounds();
    if (levels.length > 1 || value.level !== undefined) select(parent, `${label} level`, String(value.level ?? 0), levels.map(level => String(level.id)), level => write({ ...value, level: Number(level) }), Object.fromEntries(levels.map(level => [String(level.id), level.title])));
    numberInput(parent, `${label} X`, value.x, x => write({ ...value, x }), .5, width - .5);
    numberInput(parent, `${label} Y`, value.y, y => write({ ...value, y }), .5, height - .5);
    if (callbacks.setPlacement) parent.append(button(`Place ${label} on map`, () => run(() => {
      cancelPlacement(); placing = true; const generation = ++placementGeneration;
      callbacks.setPlacement!(point => {
        if (disposed || !placing || generation !== placementGeneration) return; cancelPlacement();
        if (!levels.some(level => level.id === point.level)) { message('Choose a level that exists in the current map.', true); return; }
        const { width, height } = mapBounds();
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < .5 || point.y < .5 || point.x > width - .5 || point.y > height - .5) { message('Choose a point inside the playable map.', true); return; }
        write({ x: point.x, y: point.y, ...(point.level !== 0 || value.level !== undefined ? { level: point.level } : {}) }); message(`${label} placed at ${point.x}, ${point.y} on ${levels.find(level => level.id === point.level)!.title}.`);
      });
      message(`Click the map to place ${label}. Escape cancels placement.`);
    })));
  }
  function cancelPlacement(): boolean { if (!placing) return false; placing = false; ++placementGeneration; callbacks.setPlacement?.(null); return true; }
  function orderEditor(parent: HTMLElement, label: string, value: ScenarioOrder, write: (order: ScenarioOrder) => void): void {
    const box = group(parent, `${label} order`);
    select(box, `${label} order type`, value.type, ['move', 'attackMove', 'hold', 'stop', 'ability', 'attack'] as const, type => write(type === 'move' || type === 'attackMove' ? { type, x: 18, y: 18 } : type === 'attack' ? { type, actor: firstActor() } : { type }));
    if (value.type === 'move' || value.type === 'attackMove') position(box, `${label} destination`, value, point => write({ type: value.type, ...point }));
    if (value.type === 'attack') actorReference(box, `${label} attack target`, value.actor, actor => write({ type: 'attack', actor }));
  }
  function actorEditor(parent: HTMLElement, label: string, value: ScenarioActor, write: (actor: ScenarioActor) => void): void {
    const box = group(disclosure(parent, label, `actor-${label}`, label === 'Actor 1'), label);
    textInput(box, `${label} label`, value.label, next => write({ ...value, label: next }), 64);
    select(box, `${label} side`, String(value.side), ['0', '1'], side => write({ ...value, side: Number(side) as Side }), { '0': 'Player', '1': 'Opponent' });
    select(box, `${label} kind`, value.kind, ['unit', 'building'], kind => { const next: ScenarioActor = { ...value, kind, role: kind === 'unit' ? 'melee' : 'tower' }; delete next.definitionId; write(next); });
    select(box, `${label} role`, value.role, value.kind === 'unit' ? unitRoles : buildingRoles, role => { const next = { ...value, role }; delete next.definitionId; write(next); });
    position(box, `${label} position`, value, point => write({ ...value, ...point }));
    const faction = value.side === 0 ? doc.value.faction : doc.value.opponent;
    const catalog = contentFactions()[faction];
    const definitions = value.kind === 'unit' ? catalog.unitDefinitions : catalog.buildingDefinitions;
    const custom = definitions?.find(def => def.id === value.definitionId && def.role === value.role);
    const maxHp = custom?.hp ?? (value.kind === 'unit' ? catalog.units[value.role as UnitRole].hp : catalog.buildings[value.role as BuildingRole].hp);
    checkbox(box, `${label} custom health`, value.hp !== undefined, enabled => { const next = { ...value }; if (enabled) next.hp = maxHp; else delete next.hp; write(next); });
    if (value.hp !== undefined) numberInput(box, `${label} health`, value.hp, hp => write({ ...value, hp }), 1, maxHp);
    textInput(box, `${label} custom definition ID`, value.definitionId ?? '', definitionId => { const next = { ...value }; if (definitionId.trim()) next.definitionId = definitionId.trim(); else delete next.definitionId; write(next); }, 96);
    checkbox(box, `${label} initial order`, value.order !== undefined, enabled => { const next = { ...value }; if (enabled) next.order = { type: 'hold' }; else delete next.order; write(next); });
    if (value.order) orderEditor(box, label, value.order, order => write({ ...value, order }));
  }
  function firstActor(): string { return doc.value.army[0]?.label ?? 'commander'; }
  function defaultCondition(type: ScenarioCondition['type']): ScenarioCondition {
    if (type === 'alive' || type === 'dead') return { type, actor: firstActor() };
    if (type === 'at') return { type, actor: firstActor(), point: { x: 18, y: 18 }, radius: 2 };
    if (type === 'time') return { type, seconds: 60 };
    if (type === 'variable') return { type, key: 'progress', op: 'gte', value: 1 };
    if (type === 'cleared') return { type, side: 1, buildings: true };
    if (type === 'not') return { type, condition: { type: 'time', seconds: 60 } };
    return { type, conditions: [{ type: 'time', seconds: 60 }] };
  }
  function conditionEditor(parent: HTMLElement, label: string, value: ScenarioCondition, write: (condition: ScenarioCondition) => void, depth = 0): void {
    const box = group(parent, label); box.dataset.conditionDepth = String(depth);
    select(box, `${label} type`, value.type, depth >= SCENARIO_EDITOR_LIMITS.conditionDepth ? conditionTypes.filter(type => type !== 'all' && type !== 'any' && type !== 'not') : conditionTypes, type => write(defaultCondition(type)), conditionNames);
    if (value.type === 'alive' || value.type === 'dead') actorReference(box, `${label} actor`, value.actor, actor => write({ ...value, actor }));
    if (value.type === 'at') { actorReference(box, `${label} actor`, value.actor, actor => write({ ...value, actor })); position(box, `${label} point`, value.point, point => write({ ...value, point })); numberInput(box, `${label} radius`, value.radius, radius => write({ ...value, radius }), .5, 32); }
    if (value.type === 'time') numberInput(box, `${label} seconds`, value.seconds, seconds => write({ ...value, seconds }), 0, 7200);
    if (value.type === 'variable') { textInput(box, `${label} variable`, value.key, key => write({ ...value, key }), 64); select(box, `${label} comparison`, value.op, ['eq', 'gte', 'lte'], op => write({ ...value, op }), { eq: 'Equals', gte: 'At least', lte: 'At most' }); numberInput(box, `${label} value`, value.value, next => write({ ...value, value: next }), -1e9, 1e9); }
    if (value.type === 'cleared') { select(box, `${label} cleared side`, String(value.side), ['0', '1'], side => write({ ...value, side: Number(side) as Side }), { '0': 'Player', '1': 'Opponent' }); checkbox(box, `${label} include buildings`, value.buildings ?? false, buildings => write({ ...value, buildings })); }
    if (value.type === 'not') conditionEditor(box, `${label} child`, value.condition, condition => write({ ...value, condition }), depth + 1);
    if (value.type === 'all' || value.type === 'any') {
      value.conditions.forEach((child, index) => {
        conditionEditor(box, `${label} condition ${index + 1}`, child, condition => { const conditions = [...value.conditions]; conditions[index] = condition; write({ ...value, conditions }); }, depth + 1);
        const remove = button(`Remove ${label} condition ${index + 1}`, () => write({ ...value, conditions: value.conditions.filter((_, i) => i !== index) })); remove.disabled = value.conditions.length < 2; box.append(remove);
      });
      const add = button(`Add ${label} condition`, () => write({ ...value, conditions: [...value.conditions, { type: 'time', seconds: 60 }] })); add.disabled = value.conditions.length >= 16; box.append(add);
    }
  }
  function unique(prefix: string, existing: string[]): string { let n = 1; while (existing.includes(`${prefix}-${n}`)) n++; return `${prefix}-${n}`; }
  function allActorLabels(s = doc.value): string[] {
    return [...s.army.map(a => a.label), ...s.events.flatMap(e => e.actions.flatMap(a => a.type === 'spawn' ? a.actors.map(actor => actor.label) : [])), ...(s.boss?.phases.flatMap(p => p.adds.map(a => a.label)) ?? [])];
  }
  function newActor(side: Side = 0): ScenarioActor { const { width, height } = mapBounds(); return { label: unique(side === 0 ? 'ally' : 'enemy', allActorLabels()), side, kind: 'unit', role: 'melee', x: Math.min(width - 1, side ? width - 11.5 : 11.5), y: Math.min(height - 1, side ? height - 11.5 : 12.5) }; }
  function defaultAction(type: ScenarioAction['type']): ScenarioAction {
    if (type === 'spawn') return { type, actors: [newActor(1)] };
    if (type === 'order') return { type, actors: [firstActor()], order: { type: 'hold' } };
    if (type === 'set' || type === 'add') return { type, key: 'progress', value: 1 };
    if (type === 'message') return { type, text: 'Reinforcements have arrived.' };
    if (type === 'reward') return { type, side: 0, resources: { wood: 100, ore: 50, crystal: 0 } };
    if (type === 'alliance') return { type, allied: true };
    return { type, outcome: 'won', reason: 'Custom victory condition completed.' };
  }
  function actionEditor(parent: HTMLElement, label: string, value: ScenarioAction, write: (action: ScenarioAction) => void): void {
    const box = group(parent, label); select(box, `${label} type`, value.type, Object.keys(actionNames) as ScenarioAction['type'][], type => write(defaultAction(type)), actionNames);
    if (value.type === 'spawn') {
      value.actors.forEach((actor, index) => { actorEditor(box, `${label} actor ${index + 1}`, actor, next => { const actors = [...value.actors]; actors[index] = next; write({ ...value, actors }); }); const remove = button(`Remove ${label} actor ${index + 1}`, () => write({ ...value, actors: value.actors.filter((_, i) => i !== index) })); remove.disabled = value.actors.length < 2; box.append(remove); });
      const add = button(`Add ${label} actor`, () => write({ ...value, actors: [...value.actors, newActor(1)] })); add.disabled = value.actors.length >= SCENARIO_EDITOR_LIMITS.actors; box.append(add);
    }
    if (value.type === 'order') { textInput(box, `${label} actor labels`, value.actors.join(', '), text => write({ ...value, actors: text.split(',').map(v => v.trim()).filter(Boolean) }), 4096); orderEditor(box, label, value.order, order => write({ ...value, order })); }
    if (value.type === 'set' || value.type === 'add') { textInput(box, `${label} variable`, value.key, key => write({ ...value, key }), 64); numberInput(box, `${label} value`, value.value, next => write({ ...value, value: next }), -1e6, 1e6); }
    if (value.type === 'message') { textInput(box, `${label} message`, value.text, text => write({ ...value, text }), 8000, true); textInput(box, `${label} speaker`, value.speaker ?? '', speaker => { const next = { ...value }; if (speaker.trim()) next.speaker = speaker.trim(); else delete next.speaker; write(next); }, 120); }
    if (value.type === 'reward') { select(box, `${label} reward side`, String(value.side), ['0', '1'], side => write({ ...value, side: Number(side) as Side }), { '0': 'Player', '1': 'Opponent' }); for (const kind of ['wood', 'ore', 'crystal'] as const) numberInput(box, `${label} ${kind}`, value.resources[kind], amount => write({ ...value, resources: { ...value.resources, [kind]: amount } })); }
    if (value.type === 'alliance') checkbox(box, `${label} sides allied`, value.allied, allied => write({ ...value, allied }));
    if (value.type === 'finish') { select(box, `${label} outcome`, value.outcome, ['won', 'lost'], outcome => write({ ...value, outcome }), { won: 'Player victory', lost: 'Player defeat' }); textInput(box, `${label} reason`, value.reason, reason => write({ ...value, reason }), 2000, true); }
  }
  function objectiveEditor(parent: HTMLElement, objective: ScenarioObjective, index: number): void {
    const label = `Objective ${index + 1}`, box = group(disclosure(parent, `${label}: ${objective.text}`, `objective-${index}`, index === 0), label); box.dataset.scenarioObjective = String(index);
    const write = (next: ScenarioObjective) => edit(`Edit ${label.toLowerCase()}`, draft => { draft.objectives[index] = next; });
    textInput(box, `${label} ID`, objective.id, id => write({ ...objective, id }), 64); textInput(box, `${label} text`, objective.text, text => write({ ...objective, text }), 2000, true); checkbox(box, `${label} optional`, objective.optional ?? false, optional => write({ ...objective, optional }));
    conditionEditor(box, `${label} success`, objective.success, success => write({ ...objective, success }));
    checkbox(box, `${label} failure condition`, objective.failure !== undefined, enabled => { const next = { ...objective }; if (enabled) next.failure = { type: 'dead', actor: firstActor() }; else delete next.failure; write(next); });
    if (objective.failure) conditionEditor(box, `${label} failure`, objective.failure, failure => write({ ...objective, failure }));
    if (index > 0) box.append(button(`Move ${label.toLowerCase()} earlier`, () => edit(`Move ${label.toLowerCase()}`, draft => { [draft.objectives[index - 1], draft.objectives[index]] = [draft.objectives[index], draft.objectives[index - 1]]; })));
    if (index < doc.value.objectives.length - 1) box.append(button(`Move ${label.toLowerCase()} later`, () => edit(`Move ${label.toLowerCase()}`, draft => { [draft.objectives[index + 1], draft.objectives[index]] = [draft.objectives[index], draft.objectives[index + 1]]; })));
    box.append(button(`Remove ${label.toLowerCase()}`, () => edit(`Remove ${label.toLowerCase()}`, draft => { draft.objectives.splice(index, 1); })));
  }
  function eventEditor(parent: HTMLElement, event: ScenarioTrigger, index: number): void {
    const label = `Event ${index + 1}`, box = group(disclosure(parent, `${label}: ${event.id}`, `event-${index}`), label); box.dataset.scenarioEvent = String(index);
    const write = (next: ScenarioTrigger) => edit(`Edit ${label.toLowerCase()}`, draft => { draft.events[index] = next; });
    textInput(box, `${label} ID`, event.id, id => write({ ...event, id }), 64); conditionEditor(box, `${label} trigger`, event.when, when => write({ ...event, when }));
    checkbox(box, `${label} repeats`, event.repeat !== undefined, enabled => { const next = { ...event }; if (enabled) next.repeat = { seconds: 30, count: 3 }; else delete next.repeat; write(next); });
    if (event.repeat) { numberInput(box, `${label} repeat seconds`, event.repeat.seconds, seconds => write({ ...event, repeat: { ...event.repeat!, seconds } }), 1, 3600); numberInput(box, `${label} repeat count`, event.repeat.count, count => write({ ...event, repeat: { ...event.repeat!, count } }), 1, 256, '1'); }
    event.actions.forEach((action, actionIndex) => {
      actionEditor(box, `${label} action ${actionIndex + 1}`, action, next => { const actions = [...event.actions]; actions[actionIndex] = next; write({ ...event, actions }); });
      if (actionIndex > 0) box.append(button(`Move ${label.toLowerCase()} action ${actionIndex + 1} earlier`, () => { const actions = [...event.actions]; [actions[actionIndex - 1], actions[actionIndex]] = [actions[actionIndex], actions[actionIndex - 1]]; write({ ...event, actions }); }));
      if (actionIndex < event.actions.length - 1) box.append(button(`Move ${label.toLowerCase()} action ${actionIndex + 1} later`, () => { const actions = [...event.actions]; [actions[actionIndex + 1], actions[actionIndex]] = [actions[actionIndex], actions[actionIndex + 1]]; write({ ...event, actions }); }));
      box.append(button(`Remove ${label.toLowerCase()} action ${actionIndex + 1}`, () => write({ ...event, actions: event.actions.filter((_, i) => i !== actionIndex) })));
    });
    const add = button(`Add ${label.toLowerCase()} action`, () => write({ ...event, actions: [...event.actions, defaultAction('message')] })); add.disabled = event.actions.length >= SCENARIO_EDITOR_LIMITS.actions;
    if (index > 0) box.append(button(`Move ${label.toLowerCase()} earlier`, () => edit(`Move ${label.toLowerCase()}`, draft => { [draft.events[index - 1], draft.events[index]] = [draft.events[index], draft.events[index - 1]]; })));
    if (index < doc.value.events.length - 1) box.append(button(`Move ${label.toLowerCase()} later`, () => edit(`Move ${label.toLowerCase()}`, draft => { [draft.events[index + 1], draft.events[index]] = [draft.events[index], draft.events[index + 1]]; })));
    box.append(add, button(`Remove ${label.toLowerCase()}`, () => edit(`Remove ${label.toLowerCase()}`, draft => { draft.events.splice(index, 1); })));
  }
  function escortEditor(parent: HTMLElement, scenario: Readonly<ScenarioDefinition>): void {
    const box = group(disclosure(parent, 'Escort route', 'escort'), 'Escort route'); checkbox(box, 'Enable escort route', scenario.escort !== undefined, enabled => edit('Change escort route', draft => { if (enabled) draft.escort = { actor: firstActor(), route: [{ x: 12.5, y: 12.5 }, { x: 18, y: 18 }], radius: 1.2, escortRadius: 5 }; else delete draft.escort; }));
    if (!scenario.escort) return;
    const escort = scenario.escort, write = (next: NonNullable<ScenarioDefinition['escort']>) => edit('Edit escort route', draft => { draft.escort = next; });
    actorReference(box, 'Escort actor', escort.actor, actor => write({ ...escort, actor })); numberInput(box, 'Escort checkpoint radius', escort.radius, radius => write({ ...escort, radius }), .5, 5); numberInput(box, 'Nearby escort radius', escort.escortRadius, escortRadius => write({ ...escort, escortRadius }), 1, 32);
    box.append(element('p', 'The escort follows these checkpoints in order while a friendly escort stays nearby. Add an objective that checks the escort reaching its final point.'));
    escort.route.forEach((point, index) => { const row = group(box, `Checkpoint ${index + 1}`); position(row, `Escort checkpoint ${index + 1}`, point, next => { const route = [...escort.route]; route[index] = next; write({ ...escort, route }); }); const remove = button(`Remove escort checkpoint ${index + 1}`, () => write({ ...escort, route: escort.route.filter((_, i) => i !== index) })); remove.disabled = escort.route.length < 3; row.append(remove); if (index > 0) row.append(button(`Move escort checkpoint ${index + 1} earlier`, () => { const route = [...escort.route]; [route[index - 1], route[index]] = [route[index], route[index - 1]]; write({ ...escort, route }); })); });
    const add = button('Add escort checkpoint', () => write({ ...escort, route: [...escort.route, { ...escort.route.at(-1)! }] })); add.disabled = escort.route.length >= 64;
    const goal = button('Add escort destination objective', () => edit('Add escort objective', draft => { draft.objectives.push({ id: unique('escort', draft.objectives.map(o => o.id)), text: 'Escort the named actor to the final checkpoint.', success: { type: 'at', actor: escort.actor, point: { ...escort.route.at(-1)! }, radius: escort.radius }, failure: { type: 'dead', actor: escort.actor } }); })); goal.disabled = scenario.objectives.length >= SCENARIO_EDITOR_LIMITS.objectives; box.append(add, goal);
  }

  // A wave is an ordinary event with spawn actions, so authors can inspect and edit every value.
  let waveTime = 30, waveInterval = 30, waveRepeats = 1, waveCount = 3, waveRole: UnitRole = 'melee', waveSide: Side = 1, wavePoint: Vec = { x: 24.5, y: 24.5 }, waveTarget: Vec = { x: 12.5, y: 12.5 };
  function waveEditor(parent: HTMLElement): void {
    const box = group(disclosure(parent, 'Timed wave', 'timed-wave'), 'Timed wave'); box.append(element('p', 'Create one spawn event for each arrival with unique actor labels. The actors receive an attack move order toward the destination. Each generated event can be edited in the event graph.'));
    numberInput(box, 'Wave starts at seconds', waveTime, value => { waveTime = value; }, 0, 7200); numberInput(box, 'Wave interval seconds', waveInterval, value => { waveInterval = value; }, 1, 3600); numberInput(box, 'Wave arrivals', waveRepeats, value => { waveRepeats = value; }, 1, 128, '1'); numberInput(box, 'Wave actor count', waveCount, value => { waveCount = value; }, 1, 128, '1');
    select(box, 'Wave actor role', waveRole, unitRoles, value => { waveRole = value; }); select(box, 'Wave actor side', String(waveSide), ['0', '1'], value => { waveSide = Number(value) as Side; }, { '0': 'Player', '1': 'Opponent' });
    position(box, 'Wave spawn', wavePoint, value => { wavePoint = value; refresh(); }); position(box, 'Wave attack destination', waveTarget, value => { waveTarget = value; refresh(); });
    const add = button('Add timed wave', () => edit('Add timed wave', draft => {
      if (draft.events.length + waveRepeats > SCENARIO_EDITOR_LIMITS.events) throw new Error('The timed wave would exceed the 128 event limit.');
      if (waveTime + waveInterval * (waveRepeats - 1) > 7200) throw new Error('Every arrival must start within 7200 seconds.');
      const { width, height } = mapBounds(), labels = allActorLabels(draft);
      for (let arrival = 0; arrival < waveRepeats; arrival++) {
        const eventId = unique('wave', draft.events.map(e => e.id)), actors: ScenarioActor[] = [];
        for (let index = 0; index < waveCount; index++) { const label = unique(`${eventId}-actor`, labels); labels.push(label); const col = index % Math.ceil(Math.sqrt(waveCount)), row = Math.floor(index / Math.ceil(Math.sqrt(waveCount))); actors.push({ label, side: waveSide, kind: 'unit', role: waveRole, x: Math.min(width - .5, wavePoint.x + col * .8), y: Math.min(height - .5, wavePoint.y + row * .8), ...(wavePoint.level !== undefined ? { level: wavePoint.level } : {}), order: { type: 'attackMove', ...waveTarget } }); }
        draft.events.push({ id: eventId, when: { type: 'time', seconds: waveTime + arrival * waveInterval }, actions: [{ type: 'spawn', actors }] });
      }
    })); add.disabled = doc.value.events.length >= SCENARIO_EDITOR_LIMITS.events; box.append(add);
  }
  const instance = Math.random().toString(36).slice(2, 10);
  function refresh(): void {
    if (disposed) return;
    // Native toggle events arrive asynchronously; read live details before replacing them.
    for (const details of Array.from(content.querySelectorAll<HTMLDetailsElement>('[data-scenario-section]'))) openedSections.set(details.dataset.scenarioSection!, details.open);
    let currentMap: MapPackage | null = null, mapError: unknown;
    try { currentMap = callbacks.getMap(); bounds = { width: currentMap.map.width, height: currentMap.map.height }; levels = currentMap.map.levels.map(level => ({ id: level.id, title: level.title })); }
    catch (error) { mapError = error; }
    const active = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.scenarioField : undefined;
    const selection = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    undo.disabled = !doc.canUndo || busy; redo.disabled = !doc.canRedo || busy; undo.title = doc.undoLabel; redo.title = doc.redoLabel; play.disabled = busy;
    check.disabled = exportButton.disabled = reset.disabled = importInput.disabled = busy;
    const s = doc.value; content.replaceChildren();
    const labels = element('datalist'); labels.id = `scenario-actor-labels-${instance}`; for (const label of allActorLabels()) { const option = element('option'); option.value = label; labels.append(option); } content.append(labels);
    const metadata = group(content, 'Scenario');
    textInput(metadata, 'Scenario ID', s.id, id => edit('Change scenario ID', draft => { draft.id = id; }), 64); textInput(metadata, 'Scenario title', s.title, title => edit('Change scenario title', draft => { draft.title = title; }), 120);
    for (const [key, label] of [['briefing', 'Briefing'], ['successText', 'Victory text'], ['failureText', 'Defeat text']] as const) textInput(metadata, label, s[key], value => edit(`Change ${label.toLowerCase()}`, draft => { draft[key] = value; }), 8000, true);
    const factions = Object.keys(FACTIONS) as FactionId[], factionNames = Object.fromEntries(factions.map(id => [id, FACTIONS[id].name]));
    select(metadata, 'Player faction', s.faction, factions, faction => edit('Change player faction', draft => { draft.faction = faction; }), factionNames); select(metadata, 'Opponent faction', s.opponent, factions, opponent => edit('Change opponent faction', draft => { draft.opponent = opponent; }), factionNames);
    textInput(metadata, 'Scenario author', author, value => { author = value; }, 120); numberInput(metadata, 'Scenario revision', revision, value => { revision = value; }, 1, 0x7fffffff, '1');
    const rules = group(content, 'Mission rules'); checkbox(rules, 'Fixed army', s.rules.fixedArmy, fixedArmy => edit('Change army rule', draft => { draft.rules.fixedArmy = fixedArmy; if (fixedArmy) draft.rules.reinforcementBudget = 0; })); const budget = numberInput(rules, 'Reinforcement budget', s.rules.reinforcementBudget, value => edit('Change reinforcement budget', draft => { draft.rules.reinforcementBudget = value; }), 0, 256, '1'); budget.disabled = s.rules.fixedArmy; numberInput(rules, 'Mission time limit seconds', s.rules.timeLimit, value => edit('Change time limit', draft => { draft.rules.timeLimit = value; }), 1, 7200); for (const kind of ['wood', 'ore', 'crystal'] as const) numberInput(rules, `Starting ${kind}`, s.rules.resources[kind], value => edit(`Change starting ${kind}`, draft => { draft.rules.resources[kind] = value; }), 0, 1e6);
    const army = group(disclosure(content, `Initial actors (${s.army.length})`, 'army', true), 'Initial actors'); army.dataset.scenarioActors = ''; army.append(element('p', 'Use a unique label to reference an actor in conditions, orders and escort routes. Positions are map coordinates.'));
    s.army.forEach((actor, index) => { actorEditor(army, `Actor ${index + 1}`, actor, next => edit(`Edit actor ${index + 1}`, draft => { draft.army[index] = next; })); army.append(button(`Remove actor ${index + 1}`, () => edit(`Remove actor ${index + 1}`, draft => { draft.army.splice(index, 1); }))); }); const addActor = button('Add initial actor', () => edit('Add initial actor', draft => { draft.army.push(newActor()); })); addActor.disabled = s.army.length >= SCENARIO_EDITOR_LIMITS.actors; army.append(addActor);
    const objectives = group(disclosure(content, `Objectives (${s.objectives.length})`, 'objectives', true), 'Objectives'); s.objectives.forEach((objective, index) => objectiveEditor(objectives, objective, index)); const addObjective = button('Add objective', () => edit('Add objective', draft => { draft.objectives.push({ id: unique('objective', draft.objectives.map(o => o.id)), text: 'Complete this objective.', success: { type: 'time', seconds: 60 } }); })); addObjective.disabled = s.objectives.length >= SCENARIO_EDITOR_LIMITS.objectives; objectives.append(addObjective);
    const events = group(disclosure(content, `Event graph (${s.events.length})`, 'events'), 'Event graph'); events.append(element('p', 'Each event checks its condition, then applies its actions in order. All/any/not condition groups form branches. Finish mission actions provide a custom victory or defeat condition.')); s.events.forEach((event, index) => eventEditor(events, event, index));
    const addEvent = button('Add event', () => edit('Add event', draft => { draft.events.push({ id: unique('event', draft.events.map(e => e.id)), when: { type: 'time', seconds: 30 }, actions: [{ type: 'message', text: 'An event occurred.' }] }); }));
    const win = button('Add custom win condition', () => edit('Add custom win condition', draft => {
      draft.events.push({ id: unique('custom-win', draft.events.map(e => e.id)), when: { type: 'variable', key: 'progress', op: 'gte', value: 1 }, actions: [{ type: 'finish', outcome: 'won', reason: 'Custom victory condition completed.' }] });
      draft.objectives.push({ id: unique('custom-victory', draft.objectives.map(o => o.id)), text: 'Complete the custom victory condition.', success: { type: 'variable', key: 'progress', op: 'gte', value: 1 } });
    })); addEvent.disabled = s.events.length >= SCENARIO_EDITOR_LIMITS.events; win.disabled = addEvent.disabled || s.objectives.length >= SCENARIO_EDITOR_LIMITS.objectives; events.append(addEvent, win);
    escortEditor(content, s); waveEditor(content);
    try { if (!currentMap) throw mapError ?? new Error('A valid map is needed.'); decodeScenarioDefinition({ ...doc.snapshot(), map: scenarioMapFromPackage(currentMap), seed: currentMap.map.seed }); validation.textContent = 'Scenario references and values are valid. Validate checks the current map and package before play.'; validation.classList.remove('editor-error'); } catch (error) { validation.textContent = `Draft needs attention: ${errorText(error)}`; validation.classList.add('editor-error'); }
    if (busy) for (const control of Array.from(content.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input,textarea,select,button'))) control.disabled = true;
    if (active) { const node = Array.from(content.querySelectorAll<HTMLElement>('[data-scenario-field]')).find(node => node.dataset.scenarioField === active); node?.focus(); if (selection && (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) && node.type !== 'number') try { node.setSelectionRange(selection[0], selection[1]); } catch { /* Select elements do not have a text selection. */ } }
  }
  function exportPackage(): ScenarioPackage { return makeScenarioPackage({ author, revision }, doc.snapshot(), callbacks.getMap()); }
  function importPackage(input: unknown): ScenarioPackage {
    if (busy) throw new Error('Wait for scenario play to finish before importing.');
    const pkg = decodeScenarioPackage(input); cancelPlacement(); callbacks.onImportMap?.(pkg.map);
    doc.replace('Import scenario', pkg.scenario); author = pkg.author; revision = pkg.revision; changed(); return pkg;
  }
  async function playCurrent(): Promise<void> {
    if (disposed || busy) return;
    try { const pkg = exportPackage(); cancelPlacement(); busy = true; refresh(); await callbacks.playScenario(pkg); if (!disposed) message(`Playing ${pkg.scenario.title}.`); }
    catch (error) { if (!disposed) message(errorText(error), true); }
    finally { busy = false; if (!disposed) refresh(); }
  }
  function keyboard(event: KeyboardEvent): void {
    if (event.key === 'Escape' && placing) { event.preventDefault(); event.stopPropagation(); cancelPlacement(); message('Scenario placement canceled.'); }
    if (!host.contains(document.activeElement) || busy) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); run(() => { if (event.shiftKey) doc.redo(); else doc.undo(); changed(); }); }
  }
  document.addEventListener('keydown', keyboard, true); refresh();
  return { getScenario: () => doc.snapshot(), exportPackage, importPackage, refresh, cancelPlacement, isPlacing: () => placing, destroy() { if (disposed) return; cancelPlacement(); disposed = true; ++importGeneration; document.removeEventListener('keydown', keyboard, true); host.remove(); } };
}
