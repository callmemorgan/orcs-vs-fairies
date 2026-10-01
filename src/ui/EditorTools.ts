import { EditorDocument } from '../editor/document';
import { createEditorMap, decodeEditorMap, decodeMapPackage, makeMapPackage, validateEditorMap } from '../editor/map-package';
import type { EditorMapData, MapPackage, MapMetadata } from '../editor/map-package';
import { TERRAIN } from '../core/maps';
import type { MapSize, ResourceKind, TerrainKind } from '../core/types';
import { mountScenarioAuthoring } from './ScenarioAuthoring';
import type { ScenarioPackage } from '../editor/scenario-package';
import './editor-tools.css';

export interface EditorToolsCallbacks {
  playMap: (map: MapPackage) => void | Promise<void>;
  playScenario?: (scenario: ScenarioPackage) => void | Promise<void>;
  onOpen?: (open: boolean) => void;
  toolbar?: HTMLElement;
  blocked?: () => boolean;
}
export interface EditorTools {
  open: (mode?: 'map' | 'scenario') => void; close: () => void; destroy: () => void;
  getMap: () => MapPackage;
  getScenarioPackage: () => ScenarioPackage;
  importMap: (input: unknown) => MapPackage;
  importScenario: (input: unknown) => ScenarioPackage;
}
type Tool = 'terrain' | 'elevation' | 'resource' | 'start' | 'site' | 'entrance' | 'erase';
const COLORS: Record<TerrainKind, string> = { grass: '#597752', road: '#b0a380', mud: '#655e47', shallows: '#5d9698', water: '#305675', rock: '#41424a', bridge: '#a18460', sand: '#c9b576', snow: '#bccdd3', forest: '#294b35', ice: '#9ac7d5' };
const START_COLORS = ['#ffbf69', '#8dc7ff', '#fc877d', '#c2a3f3', '#c0e891', '#eda4cb', '#88ded9', '#e9df8b'];
const DRAFT_KEY = 'ovf.editor.draft.v1';
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result;
}
function field(parent: HTMLElement, label: string, control: HTMLElement): void { const wrapper = node('label', label); wrapper.append(control); parent.append(wrapper); control.setAttribute('aria-label', label); }
function select(parent: HTMLElement, label: string, options: Array<[string, string]>): HTMLSelectElement {
  const control = node('select'); for (const [value, text] of options) { const option = node('option', text); option.value = value; control.append(option); } field(parent, label, control); return control;
}
function button(parent: HTMLElement, text: string, action: () => void): HTMLButtonElement { const control = node('button', text); control.type = 'button'; control.addEventListener('click', action); parent.append(control); return control; }
function integer(input: HTMLInputElement, min: number, max: number, name: string): number {
  const value = Number(input.value); if (input.value.trim() === '' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be a whole number from ${min} through ${max}.`); return value;
}
function download(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = node('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Canvas editing keeps draft state separate from the running match. */
export function mountEditorTools(root: HTMLElement, callbacks: EditorToolsCallbacks): EditorTools {
  const entry = button(callbacks.toolbar ?? root, 'Map and scenario editor', () => open()); entry.classList.add('editor-entry');
  const overlay = node('section', undefined, 'editor-overlay'); overlay.hidden = true;
  const dialog = node('section', undefined, 'editor-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', 'Map and scenario editor');
  const header = node('header'); header.append(node('h2', 'Map and scenario editor')); button(header, 'Close editor', () => close());
  const metadata = node('div', undefined, 'editor-metadata');
  const title = node('input'); title.value = 'My battlefield'; title.maxLength = 100; field(metadata, 'Map title', title);
  const author = node('input'); author.value = 'Local author'; author.maxLength = 80; field(metadata, 'Author', author);
  const identity = node('input'); identity.value = 'my-battlefield'; identity.maxLength = 64; field(metadata, 'Package ID', identity);
  const creation = node('details', undefined, 'editor-creation'); creation.append(node('summary', 'New map settings'));
  const creationFields = node('div', undefined, 'editor-fields');
  const size = select(creationFields, 'New map size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge']]);
  const players = select(creationFields, 'New map player count', Array.from({ length: 8 }, (_, index) => [String(index + 1), String(index + 1)])); players.value = '2';
  const seed = node('input'); seed.type = 'number'; seed.min = '0'; seed.max = '4294967295'; seed.step = '1'; seed.value = '4127'; field(creationFields, 'New map seed', seed);
  let documentModel = new EditorDocument<EditorMapData>(createEditorMap(4127, 'small', 2), decodeEditorMap);
  let revision = 1, currentLevel = 0, activeTool: Tool = 'terrain', stroke = false, lastCell: { x: number; y: number } | undefined;
  let firstEntrance: { x: number; y: number; level: number } | undefined;
  let placement: ((point: { x: number; y: number; level: number }) => void) | null = null;
  let mode: 'map' | 'scenario' = 'map';
  const toolbar = node('div', undefined, 'editor-toolbar');
  const tool = select(toolbar, 'Editor tool', [['terrain', 'Paint terrain'], ['elevation', 'Paint elevation'], ['resource', 'Place resource'], ['start', 'Move player start'], ['site', 'Place site'], ['entrance', 'Connect levels'], ['erase', 'Erase resource or site']]);
  const terrain = select(toolbar, 'Terrain brush', Object.entries(TERRAIN).map(([value, definition]) => [value, definition.name]));
  const brush = select(toolbar, 'Brush width', [['1', '1 tile'], ['3', '3 tiles'], ['5', '5 tiles']]);
  const elevation = select(toolbar, 'Elevation height', [['0', '0 — Ground'], ['1', '1 — Rise'], ['2', '2 — Hill'], ['3', '3 — Summit']]);
  const resource = select(toolbar, 'Resource kind', [['wood', 'Wood'], ['ore', 'Ore'], ['crystal', 'Crystal']]);
  const amount = node('input'); amount.type = 'number'; amount.min = '1'; amount.max = '1000000'; amount.step = '1'; amount.value = '1000'; field(toolbar, 'Resource amount', amount);
  const start = select(toolbar, 'Player start slot', []);
  const site = select(toolbar, 'Site kind', [['relic', 'Relic site'], ['village', 'Village site'], ['monster', 'Monster site']]);
  const level = select(toolbar, 'Map level', []);
  const layers = node('div', undefined, 'editor-actions');
  button(layers, 'Add underground level', () => run(() => {
    if (documentModel.value.levels.length >= 2) throw new Error('A map supports two levels.');
    documentModel.edit('Add underground level', draft => draft.levels.push({ id: 1, title: 'Underground', terrain: Array(draft.width * draft.height).fill('rock'), elevation: Array(draft.width * draft.height).fill(0) }));
    currentLevel = 1; refresh(); notice('Underground level added. Paint a walkable chamber and connect an entrance to the surface.');
  }));
  button(layers, 'Remove underground level', () => run(() => {
    if (documentModel.value.levels.length < 2) throw new Error('This map has one level.');
    documentModel.edit('Remove underground level', draft => { draft.levels.splice(1); draft.starts = draft.starts.map(p => ({ ...p, level: 0 })); draft.resources = draft.resources.filter(p => p.level === 0); draft.sites = draft.sites.filter(p => p.level === 0); draft.transitions = []; });
    currentLevel = 0; firstEntrance = undefined; refresh();
  }));
  const undo = button(layers, 'Undo edit', () => { documentModel.undo(); refresh(); });
  const redo = button(layers, 'Redo edit', () => { documentModel.redo(); refresh(); });
  button(creationFields, 'Create new map', () => run(() => {
    const next = createEditorMap(integer(seed, 0, 0xffffffff, 'Seed'), size.value as MapSize, Number(players.value));
    documentModel.replace('Create new map', next); currentLevel = 0; firstEntrance = undefined; revision = 1; refresh(); notice('New map created.');
  })); creation.append(creationFields);
  const workspace = node('div', undefined, 'editor-workspace'), canvasWrap = node('div', undefined, 'editor-canvas-wrap');
  const canvas = node('canvas'); canvas.width = 792; canvas.height = 792; canvas.setAttribute('aria-label', 'Map painting canvas'); canvas.tabIndex = 0; canvasWrap.append(canvas);
  const context = canvas.getContext('2d')!;
  const aside = node('aside', undefined, 'editor-inspector');
  const instructions = node('p', 'Drag to paint. Choose a resource, start or site and click a tile to place it. An entrance takes two clicks, one on each level.');
  const coordinates = node('p', 'Pointer outside map', 'editor-coordinates'); coordinates.setAttribute('aria-live', 'off');
  const validation = node('div', undefined, 'editor-validation'); validation.setAttribute('aria-label', 'Map validation');
  const status = node('p', undefined, 'editor-status'); status.setAttribute('role', 'status');
  const actions = node('div', undefined, 'editor-actions');
  button(actions, 'Validate map', () => { refresh(); notice(validateEditorMap(documentModel.value).valid ? 'Map is ready to play.' : 'Fix the listed errors before exporting or playing.'); });
  button(actions, 'Save editor draft', () => run(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ schemaVersion: 1, map: documentModel.snapshot(), metadata: readMetadata(), revision })); notice('Editor draft saved on this device.');
  }));
  button(actions, 'Load editor draft', () => run(() => {
    const raw = localStorage.getItem(DRAFT_KEY); if (!raw) throw new Error('There is no editor draft on this device.');
    const draft = JSON.parse(raw); if (!draft || draft.schemaVersion !== 1 || !draft.metadata || !Number.isSafeInteger(draft.revision) || draft.revision < 1) throw new Error('The saved editor draft is invalid.');
    const map = decodeEditorMap(draft.map); checkMetadata(draft.metadata);
    documentModel.replace('Load editor draft', map); applyMetadata(draft.metadata); revision = draft.revision; currentLevel = 0; firstEntrance = undefined; refresh(); notice('Editor draft loaded.');
  }));
  button(actions, 'Export map package', () => run(() => { const pkg = getMap(); download(`${pkg.id}-v${pkg.revision}.ovf-map.json`, pkg); revision++; notice(`Exported ${pkg.title}, revision ${pkg.revision}.`); }));
  const file = node('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', 'Import map package'); field(actions, 'Import map package', file);
  file.addEventListener('change', () => { const selected = file.files?.[0]; file.value = ''; if (!selected) return;
    void (async () => { try {
      if (selected.size > 16 * 1024 * 1024) throw new Error('Map package exceeds 16 MiB.');
      const pkg = importMap(JSON.parse(await selected.text())); notice(`Imported ${pkg.title}.`);
    } catch (error) { notice(error instanceof Error ? error.message : 'Map import failed.', true); } })();
  });
  const play = button(actions, 'Play edited map', () => { void runAsync(async () => { const pkg = getMap(); await callbacks.playMap(pkg); close(); }); });
  aside.append(instructions, coordinates, validation, status, actions); workspace.append(canvasWrap, aside);
  const tabs = node('div', undefined, 'editor-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Editor mode');
  const mapTab = button(tabs, 'Map editor', () => switchMode('map')); mapTab.setAttribute('role', 'tab');
  const scenarioTab = button(tabs, 'Scenario editor', () => switchMode('scenario')); scenarioTab.setAttribute('role', 'tab');
  const mapControls = node('section'); mapControls.append(metadata, creation, toolbar, layers);
  const scenarioHost = node('section'); scenarioHost.hidden = true;
  const scenario = mountScenarioAuthoring(scenarioHost, {
    getMap, onImportMap: map => { importMap(map); },
    playScenario: async pkg => { if (!callbacks.playScenario) throw new Error('Scenario play is not connected in this window.'); await callbacks.playScenario(pkg); close(); },
    setPlacement: handler => { placement = handler; if (handler) { pointerUp(); firstEntrance = undefined; switchMode('map'); canvas.scrollIntoView({ block: 'center' }); canvas.focus(); notice('Click a tile for the scenario position. Escape cancels placement.'); } },
  });
  dialog.append(header, tabs, mapControls, scenarioHost, workspace); overlay.append(dialog); root.append(overlay);

  function checkMetadata(metadata: MapMetadata): void {
    if (typeof metadata.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(metadata.id)) throw new Error('Package ID must use up to 64 lowercase letters, numbers, dots, underscores or hyphens.');
    if (typeof metadata.title !== 'string' || !metadata.title.trim() || metadata.title.length > 100) throw new Error('Enter a map title from 1 through 100 characters.');
    if (typeof metadata.author !== 'string' || !metadata.author.trim() || metadata.author.length > 80) throw new Error('Enter an author from 1 through 80 characters.');
  }
  function readMetadata(): MapMetadata { const result = { id: identity.value, title: title.value.trim(), author: author.value.trim(), revision }; checkMetadata(result); return result; }
  function applyMetadata(metadata: MapMetadata): void { identity.value = metadata.id; title.value = metadata.title; author.value = metadata.author; }
  function getMap(): MapPackage { return makeMapPackage(readMetadata(), documentModel.snapshot()); }
  function importMap(input: unknown): MapPackage {
    const pkg = decodeMapPackage(input);
    documentModel.replace('Import map package', pkg.map); applyMetadata(pkg); revision = pkg.revision; currentLevel = 0; firstEntrance = undefined; refresh(); return pkg;
  }
  function switchMode(next: 'map' | 'scenario'): void {
    mode = next; mapControls.hidden = mode !== 'map'; scenarioHost.hidden = mode !== 'scenario';
    mapTab.setAttribute('aria-selected', String(mode === 'map')); scenarioTab.setAttribute('aria-selected', String(mode === 'scenario'));
    if (mode === 'scenario') scenario.refresh();
  }
  function notice(message: string, failed = false): void { status.textContent = message; status.classList.toggle('error', failed); }
  function run(action: () => void): void { try { action(); } catch (error) { notice(error instanceof Error ? error.message : 'Editor operation failed.', true); } }
  async function runAsync(action: () => Promise<void>): Promise<void> { try { await action(); } catch (error) { notice(error instanceof Error ? error.message : 'Editor operation failed.', true); } }
  function refresh(): void {
    const map = documentModel.value; if (!map.levels.some(item => item.id === currentLevel)) currentLevel = 0;
    const previousStart = start.value; start.replaceChildren(); for (const item of map.starts) { const option = node('option', `Player ${item.slot + 1}`); option.value = String(item.slot); start.append(option); } if (Array.from(start.options).some(item => item.value === previousStart)) start.value = previousStart;
    level.replaceChildren(); for (const item of map.levels) { const option = node('option', item.title); option.value = String(item.id); level.append(option); } level.value = String(currentLevel);
    undo.disabled = !documentModel.canUndo; undo.title = documentModel.undoLabel; redo.disabled = !documentModel.canRedo; redo.title = documentModel.redoLabel;
    const checked = validateEditorMap(map); validation.replaceChildren(node('p', `${checked.valid ? 'Ready to play' : `${checked.issues.length} map error${checked.issues.length === 1 ? '' : 's'}`} · ${map.width} × ${map.height} · ${map.levels.length} level${map.levels.length === 1 ? '' : 's'} · ${map.starts.length} player${map.starts.length === 1 ? '' : 's'}`));
    const list = node('ul'); for (const issue of checked.issues.slice(0, 12)) list.append(node('li', issue)); if (checked.issues.length > 12) list.append(node('li', `${checked.issues.length - 12} more errors.`)); validation.append(list); play.disabled = !checked.valid;
    updateTool(); draw();
  }
  function updateTool(): void {
    activeTool = tool.value as Tool;
    terrain.closest('label')!.hidden = activeTool !== 'terrain'; brush.closest('label')!.hidden = !['terrain', 'elevation'].includes(activeTool);
    elevation.closest('label')!.hidden = activeTool !== 'elevation'; resource.closest('label')!.hidden = activeTool !== 'resource'; amount.closest('label')!.hidden = activeTool !== 'resource'; start.closest('label')!.hidden = activeTool !== 'start'; site.closest('label')!.hidden = activeTool !== 'site';
  }
  function draw(): void {
    const map = documentModel.value, selected = map.levels.find(item => item.id === currentLevel)!;
    const tile = canvas.width / map.width; context.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const index = y * map.width + x; context.fillStyle = COLORS[selected.terrain[index]]; context.fillRect(x * tile, y * tile, tile + .25, tile + .25);
      const height = selected.elevation[index]; if (height) { context.fillStyle = `rgba(255,244,205,${height * .12})`; context.fillRect(x * tile, y * tile, tile, tile); if (tile > 12) { context.fillStyle = '#17231c'; context.font = `${Math.max(9, tile * .4)}px sans-serif`; context.fillText(String(height), (x + .12) * tile, (y + .65) * tile); } }
    }
    context.strokeStyle = '#00000022'; context.lineWidth = .6; for (let x = 0; x <= map.width; x++) { context.beginPath(); context.moveTo(x * tile, 0); context.lineTo(x * tile, canvas.height); context.stroke(); } for (let y = 0; y <= map.height; y++) { context.beginPath(); context.moveTo(0, y * tile); context.lineTo(canvas.width, y * tile); context.stroke(); }
    function marker(p: { x: number; y: number }, text: string, color: string, square = false): void {
      const radius = Math.max(4, tile * .38); context.fillStyle = color; context.strokeStyle = '#101717'; context.lineWidth = 2; context.beginPath();
      if (square) context.rect(p.x * tile - radius, p.y * tile - radius, radius * 2, radius * 2); else context.arc(p.x * tile, p.y * tile, radius, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = '#111'; context.font = `bold ${Math.max(9, tile * .4)}px sans-serif`; context.textAlign = 'center'; context.fillText(text, p.x * tile, p.y * tile + tile * .14);
    }
    for (const r of map.resources.filter(p => p.level === currentLevel)) marker(r, r.kind[0].toUpperCase(), r.kind === 'wood' ? '#add895' : r.kind === 'ore' ? '#d8d0c4' : '#b8a3ef');
    for (const p of map.starts.filter(p => p.level === currentLevel)) marker(p, String(p.slot + 1), START_COLORS[p.slot], true);
    for (const p of map.sites.filter(p => p.level === currentLevel)) marker(p, p.kind[0].toUpperCase(), '#f8e39b');
    for (const t of map.transitions) for (const p of [t.from, t.to]) if (p.level === currentLevel) marker(p, '↕', '#a7dedb', true);
    if (firstEntrance?.level === currentLevel) marker(firstEntrance, '1', '#ffefc0', true);
    context.textAlign = 'start';
  }
  function pointer(event: PointerEvent): { x: number; y: number } | undefined {
    const rect = canvas.getBoundingClientRect(), map = documentModel.value;
    const x = Math.floor((event.clientX - rect.left) / rect.width * map.width), y = Math.floor((event.clientY - rect.top) / rect.height * map.height);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return; return { x, y };
  }
  function paint(cell: { x: number; y: number }): void {
    const from = lastCell ?? cell, steps = Math.max(Math.abs(cell.x - from.x), Math.abs(cell.y - from.y)), cells = Array.from({ length: steps + 1 }, (_, index) => ({ x: Math.round(from.x + (cell.x - from.x) * (steps ? index / steps : 1)), y: Math.round(from.y + (cell.y - from.y) * (steps ? index / steps : 1)) }));
    documentModel.change(map => {
      const selected = map.levels.find(item => item.id === currentLevel)!, radius = Math.floor(Number(brush.value) / 2);
      for (const center of cells) for (let y = center.y - radius; y <= center.y + radius; y++) for (let x = center.x - radius; x <= center.x + radius; x++) if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
        const index = y * map.width + x; if (activeTool === 'terrain') selected.terrain[index] = terrain.value as TerrainKind; else selected.elevation[index] = Number(elevation.value);
      }
    }); lastCell = cell; draw();
  }
  function place(cell: { x: number; y: number }): void {
    const point = { x: cell.x + .5, y: cell.y + .5, level: currentLevel };
    if (activeTool === 'entrance' && !firstEntrance) { firstEntrance = point; draw(); notice('First entrance marked. Switch levels and choose its other end.'); return; }
    if (activeTool === 'entrance' && firstEntrance!.level === currentLevel) throw new Error('The second entrance must be on the other level.');
    documentModel.edit(`Place ${activeTool}`, map => {
      const onTile = (p: { x: number; y: number; level: number }) => p.level === currentLevel && Math.floor(p.x) === cell.x && Math.floor(p.y) === cell.y;
      if (activeTool === 'resource') { map.resources = map.resources.filter(p => !onTile(p)); const reserve = integer(amount, 1, 1000000, 'Resource amount'); map.resources.push({ ...point, kind: resource.value as ResourceKind, amount: reserve, maxAmount: reserve }); }
      else if (activeTool === 'start') { const slot = Number(start.value); const entry = map.starts.find(p => p.slot === slot); if (!entry) throw new Error('Choose a starting slot.'); Object.assign(entry, point); }
      else if (activeTool === 'site') { map.sites = map.sites.filter(p => !onTile(p)); map.sites.push({ ...point, id: nextId(map.sites.map(p => p.id)), kind: site.value as EditorMapData['sites'][number]['kind'] }); }
      else if (activeTool === 'entrance') map.transitions.push({ id: nextId(map.transitions.map(p => p.id)), from: firstEntrance!, to: point });
      else if (activeTool === 'erase') { map.resources = map.resources.filter(p => !onTile(p)); map.sites = map.sites.filter(p => !onTile(p)); map.transitions = map.transitions.filter(p => !onTile(p.from) && !onTile(p.to)); }
    }); if (activeTool === 'entrance') firstEntrance = undefined; refresh();
  }
  function nextId(ids: number[]): number { let id = 1; while (ids.includes(id)) id++; return id; }
  const pointerDown = (event: PointerEvent): void => { if (event.button !== 0) return; const cell = pointer(event); if (!cell) return; canvas.focus(); event.preventDefault(); run(() => {
    if (placement) { const handler = placement; placement = null; handler({ x: cell.x + .5, y: cell.y + .5, level: currentLevel }); switchMode('scenario'); return; }
    if (activeTool === 'terrain' || activeTool === 'elevation') { documentModel.begin(activeTool === 'terrain' ? 'Paint terrain' : 'Paint elevation'); stroke = true; lastCell = undefined; canvas.setPointerCapture(event.pointerId); paint(cell); }
    else place(cell);
  }); };
  const pointerMove = (event: PointerEvent): void => { const cell = pointer(event); coordinates.textContent = cell ? `Tile ${cell.x}, ${cell.y} · Level ${currentLevel}` : 'Pointer outside map'; if (stroke && cell) run(() => paint(cell)); };
  const pointerUp = (): void => { if (!stroke) return; stroke = false; lastCell = undefined; documentModel.finish(); refresh(); };
  const pointerCancel = (): void => { if (!stroke) return; stroke = false; lastCell = undefined; documentModel.cancel(); refresh(); };
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerCancel);
  tool.addEventListener('change', () => { pointerUp(); firstEntrance = undefined; updateTool(); draw(); }); level.addEventListener('change', () => { pointerUp(); currentLevel = Number(level.value); draw(); });
  const keyboard = (event: KeyboardEvent): void => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') { if (placement || scenario.isPlacing()) { scenario.cancelPlacement(); placement = null; notice('Scenario placement canceled.'); switchMode('scenario'); } else if (firstEntrance) { firstEntrance = undefined; draw(); notice('Entrance placement canceled.'); } else close(); event.preventDefault(); event.stopPropagation(); return; }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]')).filter(element => !('disabled' in element && element.disabled) && element.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
      else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
    }
    if (mode === 'scenario') return;
    if ((event.ctrlKey || event.metaKey) && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) {
      if (event.code === 'KeyZ') { event.shiftKey ? documentModel.redo() : documentModel.undo(); refresh(); event.preventDefault(); }
      else if (event.code === 'KeyY') { documentModel.redo(); refresh(); event.preventDefault(); }
    }
  };
  const previousFocus = { value: undefined as HTMLElement | undefined };
  function open(next: 'map' | 'scenario' = 'map'): void { if (callbacks.blocked?.() || !overlay.hidden) return; previousFocus.value = document.activeElement as HTMLElement; overlay.hidden = false; callbacks.onOpen?.(true); refresh(); switchMode(next); (next === 'map' ? title : scenarioTab).focus(); }
  function close(): void { pointerUp(); scenario.cancelPlacement(); overlay.hidden = true; firstEntrance = undefined; placement = null; callbacks.onOpen?.(false); previousFocus.value?.focus(); }
  window.addEventListener('keydown', keyboard, true); refresh(); switchMode('map');
  return { open, close, getMap, getScenarioPackage: scenario.exportPackage, importMap, importScenario: scenario.importPackage, destroy: () => { window.removeEventListener('keydown', keyboard, true); scenario.destroy(); overlay.remove(); entry.remove(); callbacks.onOpen?.(false); } };
}
