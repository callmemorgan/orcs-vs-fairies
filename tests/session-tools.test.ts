// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../src/core/simulation';
import type { Entity, GameState } from '../src/core/types';
import { mountSessionTools, SESSION_IMPORT_MAX_BYTES, type SessionAnalysis, type SessionBinding, type SessionReplayStatus, type SessionSave } from '../src/ui/SessionTools';

type Tools = ReturnType<typeof mountSessionTools>;
type Callbacks = Parameters<typeof mountSessionTools>[1];
type Status = Parameters<Tools['update']>[1];

const mounted: Tools[] = [];
afterEach(() => {
  for (const tools of mounted.splice(0)) tools.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function button(root: ParentNode, name: string | RegExp): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(element => {
    const label = element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '';
    return typeof name === 'string' ? label === name : name.test(label);
  });
  expect(found, `Missing button ${String(name)}`).toBeDefined();
  return found!;
}

function setInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function addProducer(state: GameState): Entity {
  const headquarters = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  const barracks: Entity = {
    ...structuredClone(headquarters),
    id: state.nextId++,
    role: 'barracks',
    x: headquarters.x + 6,
    queue: [],
    trainProgress: 0,
    progress: 1,
  };
  state.entities.push(barracks);
  return barracks;
}

function makeCallbacks() {
  return {
    listSaves: vi.fn<Callbacks['listSaves']>(() => []),
    save: vi.fn((_name: string) => true),
    load: vi.fn((_id: string) => true),
    deleteSave: vi.fn((_id: string) => true),
    importSave: vi.fn((_value: unknown) => true),
    exportSave: vi.fn(() => ({ format: 'save', seed: 4127 })),
    getAutosave: vi.fn(() => ({ enabled: false, intervalSeconds: 60 })),
    setAutosave: vi.fn((_settings: { enabled: boolean; intervalSeconds: number }) => true),
    getReplay: vi.fn((): SessionReplayStatus | null => null),
    importReplay: vi.fn((_value: unknown) => true),
    exportReplay: vi.fn(() => ({ format: 'replay', commands: [] })),
    seekReplay: vi.fn((_tick: number) => true),
    setReplayPlaying: vi.fn((_playing: boolean) => true),
    setReplaySpeed: vi.fn((_speed: .25 | .5 | 1 | 2 | 4) => true),
    setReplayPerspective: vi.fn((_side: 0 | 1) => true),
    getAnalysis: vi.fn((): SessionAnalysis | null => null),
    train: vi.fn((_id: number, _role: Parameters<Callbacks['train']>[1]) => true),
    cancelTrain: vi.fn((_id: number, _index: number, _expectedQueue: string) => true),
    reorderTrain: vi.fn((_id: number, _from: number, _to: number, _expectedQueue: string) => true),
    selectBuilding: vi.fn((_id: number) => {}),
    getBindings: vi.fn((): SessionBinding[] => [
      { action: 'attackMove', label: 'Attack move', key: 'A' },
      { action: 'stop', label: 'Stop', key: 'S' },
    ]),
    getBindingProfiles: vi.fn(() => ['Default', 'Laptop']),
    setBinding: vi.fn((_action: string, _key: string) => true),
    saveBindingProfile: vi.fn((_name: string) => true),
    loadBindingProfile: vi.fn((_name: string) => true),
    resetBindings: vi.fn(() => true),
    bugReport: vi.fn((description: string) => ({ description, replay: { seed: 4127 }, diagnostics: { tick: 0 } })),
    photo: vi.fn(() => {}),
    onModal: vi.fn((_open: boolean) => {}),
    download: vi.fn((_filename: string, _value: unknown) => true),
  } satisfies Callbacks;
}

function setup(callbacks = makeCallbacks(), status: Status = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const state = createGame('orcs', 4127, 'fairies', { controllers: ['human', 'human'] });
  const tools = mountSessionTools(root, callbacks);
  mounted.push(tools);
  tools.update(state, status);
  return { root, state, tools, callbacks, status };
}

function panel(root: ParentNode, name: string): HTMLElement {
  return root.querySelector<HTMLElement>(`[data-session-page="${name}"]`)!;
}

function field<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement = HTMLInputElement>(root: ParentNode, label: string): T {
  const found = Array.from(root.querySelectorAll<T>('input,select,textarea')).find(element => element.getAttribute('aria-label') === label);
  expect(found, `Missing input ${label}`).toBeDefined();
  return found!;
}

function open(root: ParentNode, name: string) {
  root.querySelector<HTMLButtonElement>(`[data-session-tool="${name}"]`)!.click();
  return panel(root, name);
}

function chooseFile(input: HTMLInputElement, text: string, size?: number) {
  const file = new File([text], 'match.json', { type: 'application/json' });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const recordedAnalysis = (): SessionAnalysis => ({
  complete: true,
  samples: [
    { tick: 0, time: 0, players: [{ wood: 100, ore: 40, crystal: 0, army: 3, losses: 0 }, { wood: 9000, ore: 3000, crystal: 7000, army: 80, losses: 0 }] },
    { tick: 1200, time: 120, players: [{ wood: 60, ore: 20, crystal: 5, army: 5, losses: 2 }, { wood: 4000, ore: 3000, crystal: 1000, army: 75, losses: 4 }] },
  ],
  technologies: [
    { side: 0, tick: 200, time: 20, name: 'Town Age' },
    { side: 1, tick: 400, time: 40, name: 'SECRET TECHNOLOGY' },
  ],
  playerNames: ['Orcs', 'Fairies'],
});

describe('saved sessions and autosaves', () => {
  it('lists saved matches newest first, reports load failure, and deletes the chosen save', async () => {
    const callbacks = makeCallbacks();
    callbacks.listSaves.mockReturnValue([
      { id: 'old', name: 'Older match', savedAt: '2026-09-29T18:00:00Z', tick: 10 },
      { id: 'new', name: 'Latest autosave', savedAt: '2026-10-01T18:00:00Z', tick: 120, autosave: true },
    ]);
    callbacks.load.mockImplementation(() => { throw new Error('Save checksum failed'); });
    const { root } = setup(callbacks);
    const page = open(root, 'saves');
    await vi.waitFor(() => expect(page.querySelectorAll('li')).toHaveLength(2));
    expect(page.querySelector('li')!.textContent).toContain('Latest autosave');
    expect(page.querySelector('li')!.textContent).toContain('Autosave');
    expect(page.querySelector('li')!.textContent).toContain('tick 120');
    button(page, 'Load Older match').click();
    await vi.waitFor(() => expect(root.querySelector('[role="status"]')!.textContent).toContain('Save checksum failed'));
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Your current match has been kept');
    expect(callbacks.load).toHaveBeenCalledWith('old');
    button(page, 'Delete Latest autosave').click();
    await vi.waitFor(() => expect(callbacks.deleteSave).toHaveBeenCalledWith('new'));
  });

  it('retains the name draft across frame updates and saves its trimmed value', async () => {
    const { root, tools, state, callbacks } = setup();
    const page = open(root, 'saves');
    const name = field(page, 'Save name');
    setInput(name, '  Mountain siege  ');
    name.focus();
    state.tick = 50;
    tools.update(state, { paused: true });
    expect(field(page, 'Save name')).toBe(name);
    expect(name.value).toBe('  Mountain siege  ');
    expect(document.activeElement).toBe(name);
    button(page, 'Save match').click();
    await vi.waitFor(() => expect(callbacks.save).toHaveBeenCalledWith('Mountain siege'));
    await vi.waitFor(() => expect(root.querySelector('[role="status"]')!.textContent).toBe('Match saved.'));
  });

  it('rejects blank save names and disables save exports without a match', () => {
    const { root, tools, callbacks } = setup();
    const page = open(root, 'saves');
    button(page, 'Save match').click();
    expect(callbacks.save).not.toHaveBeenCalled();
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Enter a name');
    expect(document.activeElement).toBe(field(page, 'Save name'));
    tools.update(null, {});
    expect(button(page, 'Save match').disabled).toBe(true);
    expect(button(page, 'Export save').disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-session-tool="photo"]')!.disabled).toBe(true);
  });

  it('loads autosave settings and preserves edits until they are applied', async () => {
    const callbacks = makeCallbacks();
    callbacks.getAutosave.mockReturnValue({ enabled: true, intervalSeconds: 45 });
    const { root, tools, state } = setup(callbacks);
    const page = open(root, 'saves');
    const enabled = field(page, 'Enable autosaves');
    const frequency = field<HTMLSelectElement>(page, 'Autosave frequency');
    expect(enabled.checked).toBe(true);
    expect(frequency.value).toBe('45');
    enabled.checked = false;
    setInput(frequency, '120');
    tools.update(state, {});
    expect(enabled.checked).toBe(false);
    expect(frequency.value).toBe('120');
    button(page, 'Apply autosave settings').click();
    await vi.waitFor(() => expect(callbacks.setAutosave).toHaveBeenCalledWith({ enabled: false, intervalSeconds: 120 }));
  });

  it.each(['{', 'null', '[]', '"save"'])('rejects invalid save input %s before invoking import', async text => {
    const { root, callbacks } = setup();
    const page = open(root, 'saves');
    chooseFile(field(page, 'Import save JSON'), text);
    button(page, 'Import save').click();
    await vi.waitFor(() => expect(root.querySelector('[role="status"]')!.textContent).toContain('Could not read save'));
    expect(callbacks.importSave).not.toHaveBeenCalled();
  });

  it('imports a JSON object and reports backend validation failures without claiming success', async () => {
    const callbacks = makeCallbacks();
    callbacks.importSave.mockReturnValue(false);
    const { root } = setup(callbacks);
    const page = open(root, 'saves');
    const value = { format: 'save', seed: 4127 };
    chooseFile(field(page, 'Import save JSON'), JSON.stringify(value));
    button(page, 'Import save').click();
    await vi.waitFor(() => expect(callbacks.importSave).toHaveBeenCalledWith(value));
    await vi.waitFor(() => expect(root.querySelector('[role="status"]')!.textContent).toContain('Your current match has been kept'));
    expect(root.querySelector('[role="status"]')!.textContent).not.toBe('Save loaded.');
  });

  it('rejects files above the import limit and exports through the host download hook', async () => {
    const { root, callbacks } = setup();
    const page = open(root, 'saves');
    chooseFile(field(page, 'Import save JSON'), '{}', SESSION_IMPORT_MAX_BYTES + 1);
    button(page, 'Import save').click();
    await vi.waitFor(() => expect(root.querySelector('[role="status"]')!.textContent).toContain('too large'));
    expect(callbacks.importSave).not.toHaveBeenCalled();
    button(page, 'Export save').click();
    await vi.waitFor(() => expect(callbacks.download).toHaveBeenCalledWith('orcs-vs-fairies-save.json', { format: 'save', seed: 4127 }));
  });

  it('renders save names as text rather than HTML', async () => {
    const callbacks = makeCallbacks();
    callbacks.listSaves.mockReturnValue([{ id: 'html', name: '<img src=x onerror=alert(1)>', savedAt: 0 }]);
    const { root } = setup(callbacks);
    const page = open(root, 'saves');
    await vi.waitFor(() => expect(page.querySelector('strong')!.textContent).toContain('<img'));
    expect(page.querySelector('img')).toBeNull();
  });

  it('ignores older save-list responses and pending responses after disposal', async () => {
    const callbacks = makeCallbacks();
    let resolveOld!: (value: SessionSave[]) => void;
    let resolveNew!: (value: SessionSave[]) => void;
    const old = new Promise<SessionSave[]>(resolve => { resolveOld = resolve; });
    const fresh = new Promise<SessionSave[]>(resolve => { resolveNew = resolve; });
    callbacks.listSaves.mockReturnValueOnce(old).mockReturnValueOnce(fresh);
    const { root, tools } = setup(callbacks);
    const page = open(root, 'saves');
    button(page, 'Refresh saves').click();
    resolveNew([{ id: 'new', name: 'Newest response', savedAt: 10 }]);
    await vi.waitFor(() => expect(page.querySelector('strong')!.textContent).toBe('Newest response'));
    resolveOld([{ id: 'old', name: 'Stale response', savedAt: 20 }]);
    await old;
    await Promise.resolve();
    expect(page.querySelector('strong')!.textContent).toBe('Newest response');
    let resolveDisposed!: (value: SessionSave[]) => void;
    const pending = new Promise<SessionSave[]>(resolve => { resolveDisposed = resolve; });
    callbacks.listSaves.mockReturnValueOnce(pending);
    button(page, 'Refresh saves').click();
    tools.dispose();
    resolveDisposed([{ id: 'late', name: 'After disposal', savedAt: 30 }]);
    await pending;
    await Promise.resolve();
    expect(root.querySelector('.session-tools')).toBeNull();
    expect(page.querySelector('strong')!.textContent).toBe('Newest response');
  });
});

describe('replay and analysis', () => {
  it('keeps playback controls disabled until a replay is loaded', () => {
    const { root } = setup();
    const page = open(root, 'replay');
    expect(button(page, 'Play replay').disabled).toBe(true);
    for (const label of ['Replay tick', 'Replay speed', 'Replay perspective']) expect(field(page, label).disabled).toBe(true);
  });

  it('seeks, changes speed and perspective, and toggles replay playback', async () => {
    const callbacks = makeCallbacks();
    const replay: SessionReplayStatus = { tick: 20, initialTick: 0, totalTicks: 200, playing: false, speed: 1, perspective: 0 };
    callbacks.getReplay.mockReturnValue(replay);
    const { root, tools, state } = setup(callbacks);
    const page = open(root, 'replay');
    expect(page.textContent).toContain('Tick 20 of 200');
    const seek = field(page, 'Replay tick');
    expect(seek.max).toBe('200');
    setInput(seek, '80');
    setInput(field<HTMLSelectElement>(page, 'Replay speed'), '2');
    setInput(field<HTMLSelectElement>(page, 'Replay perspective'), '1');
    button(page, 'Play replay').click();
    await vi.waitFor(() => {
      expect(callbacks.seekReplay).toHaveBeenCalledWith(80);
      expect(callbacks.setReplaySpeed).toHaveBeenCalledWith(2);
      expect(callbacks.setReplayPerspective).toHaveBeenCalledWith(1);
      expect(callbacks.setReplayPlaying).toHaveBeenCalledWith(true);
    });
    replay.playing = true;
    replay.tick = 90;
    tools.update(state, { replaySpectator: true });
    expect(button(page, 'Pause replay')).toBeDefined();
    button(page, 'Pause replay').click();
    await vi.waitFor(() => expect(callbacks.setReplayPlaying).toHaveBeenLastCalledWith(false));
  });

  it('keeps a focused seek draft stable during playback updates and exports replay data', async () => {
    const callbacks = makeCallbacks();
    const replay: SessionReplayStatus = { tick: 20, initialTick: 0, totalTicks: 200, playing: true, speed: 1, perspective: 0 };
    callbacks.getReplay.mockReturnValue(replay);
    const { root, tools, state } = setup(callbacks);
    const page = open(root, 'replay');
    const seek = field(page, 'Replay tick');
    seek.focus();
    seek.value = '100';
    replay.tick = 21;
    tools.update(state, { replaySpectator: true });
    expect(seek.value).toBe('100');
    seek.blur();
    tools.update(state, { replaySpectator: true });
    expect(seek.value).toBe('21');
    button(page, 'Export replay').click();
    await vi.waitFor(() => expect(callbacks.download).toHaveBeenCalledWith('orcs-vs-fairies-replay.json', { format: 'replay', commands: [] }));
  });
  it('starts saved-state replays at their initial tick and rejects stale seeks before that tick', async () => {
    const callbacks=makeCallbacks();
    const replay:SessionReplayStatus={tick:800,initialTick:600,totalTicks:1200,playing:false,speed:1,perspective:0};
    callbacks.getReplay.mockReturnValue(replay);
    const {root}=setup(callbacks),page=open(root,'replay'),seek=field(page,'Replay tick');
    expect(seek.min).toBe('600');expect(seek.max).toBe('1200');expect(seek.value).toBe('800');
    setInput(seek,'600');await vi.waitFor(()=>expect(callbacks.seekReplay).toHaveBeenCalledWith(600));
    callbacks.seekReplay.mockClear();seek.value='700';replay.initialTick=750;
    seek.dispatchEvent(new Event('change',{bubbles:true}));await Promise.resolve();
    expect(callbacks.seekReplay).not.toHaveBeenCalled();
  });

  it('validates replay JSON before importing it', async () => {
    const { root, callbacks } = setup();
    const page = open(root, 'replay');
    const input = field(page, 'Import replay JSON');
    chooseFile(input, '[]');
    button(page, 'Import replay').click();
    await vi.waitFor(() => expect(root.querySelector('[role="status"]')!.textContent).toContain('Could not read replay'));
    expect(callbacks.importReplay).not.toHaveBeenCalled();
    chooseFile(input, '{"format":"replay","commands":[]}');
    button(page, 'Import replay').click();
    await vi.waitFor(() => expect(callbacks.importReplay).toHaveBeenCalledWith({ format: 'replay', commands: [] }));
  });

  it('does not expose enemy economy or technology during a live match even if analysis is complete', () => {
    const callbacks = makeCallbacks();
    callbacks.getAnalysis.mockReturnValue(recordedAnalysis());
    const { root } = setup(callbacks);
    const page = open(root, 'analysis');
    expect(page.textContent).toContain('Enemy economy and technology remain private');
    expect(page.querySelector('svg')).toBeNull();
    expect(page.textContent).not.toContain('SECRET TECHNOLOGY');
    expect(page.textContent).not.toContain('Fairies');
  });

  it.each(['win', 'draw', 'replay'] as const)('shows recorded charts and technology timing after %s', mode => {
    const callbacks = makeCallbacks();
    callbacks.getAnalysis.mockReturnValue(recordedAnalysis());
    const { root, state, tools } = setup(callbacks);
    if (mode === 'win') state.winner = 0;
    if (mode === 'draw') state.draw = true;
    tools.update(state, { replaySpectator: mode === 'replay' });
    const page = open(root, 'analysis');
    expect(page.querySelectorAll('svg[role="img"]')).toHaveLength(4);
    expect(page.textContent).toContain('Resources held');
    expect(page.textContent).toContain('Army strength');
    expect(page.textContent).toContain('Cumulative losses');
    expect(page.textContent).toContain('SECRET TECHNOLOGY');
    expect(page.textContent).toContain('0:40 (tick 400)');
    expect(page.querySelector('svg[aria-label="Resources held over match time"] title')!.textContent).toContain('Orcs:');
  });
  it('shows gathered economy, army and building values, and separate unit and building losses',()=>{
    const callbacks=makeCallbacks(),analysis=recordedAnalysis();
    for(const [index,sample] of analysis.samples.entries())for(const player of sample.players)Object.assign(player,{gathered:100+index*500,buildings:2+index,armyValue:200+index*300,buildingLosses:index,lostValue:index*75});
    callbacks.getAnalysis.mockReturnValue(analysis);
    const {root}=setup(callbacks,{replaySpectator:true}),page=open(root,'analysis');
    for(const title of ['Resources held','Resources gathered','Army strength','Army value','Buildings','Cumulative losses','Cumulative building losses','Cumulative loss value'])expect(page.querySelector(`svg[aria-label="${title} over match time"]`)).not.toBeNull();
    expect(page.querySelector('svg[aria-label="Resources gathered over match time"] title')!.textContent).toContain('2:00 600');
    expect(page.querySelector('svg[aria-label="Cumulative building losses over match time"] title')!.textContent).toContain('2:00 1');
    expect(page.querySelector('svg[aria-label="Cumulative loss value over match time"] title')!.textContent).toContain('2:00 75');
  });
  it.each(['Resources held','Army strength','Cumulative losses'])('opens the replay from clickable and keyboard-accessible %s timestamps',async chart=>{
    const callbacks=makeCallbacks();callbacks.getAnalysis.mockReturnValue(recordedAnalysis());callbacks.getReplay.mockReturnValue({tick:0,initialTick:0,totalTicks:1200,playing:false,speed:1,perspective:0});
    const {root}=setup(callbacks,{replaySpectator:true}),page=open(root,'analysis');
    const plot=page.querySelector(`svg[aria-label="${chart} over match time"]`)!;
    expect(plot.getAttribute('role')).toBe('group');
    const point=plot.querySelector<SVGCircleElement>('[data-analysis-tick="1200"]')!;
    expect(point.getAttribute('tabindex')).toBe('0');expect(point.getAttribute('role')).toBe('button');
    expect(point.getAttribute('aria-label')).toContain('2:00');
    point.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    await vi.waitFor(()=>expect(callbacks.seekReplay).toHaveBeenLastCalledWith(1200));
    await vi.waitFor(()=>expect(panel(root,'replay').hidden).toBe(false));
    open(root,'analysis');const key=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});point.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);await vi.waitFor(()=>expect(callbacks.seekReplay).toHaveBeenCalledTimes(2));
    await vi.waitFor(()=>expect(panel(root,'replay').hidden).toBe(false));
  });
  it('links technology completion ticks to replay and keeps failed seeks on analysis',async()=>{
    const callbacks=makeCallbacks();callbacks.getAnalysis.mockReturnValue(recordedAnalysis());callbacks.getReplay.mockReturnValue({tick:0,initialTick:0,totalTicks:1200,playing:false,speed:1,perspective:0});
    const {root}=setup(callbacks,{replaySpectator:true}),page=open(root,'analysis');
    page.querySelector<HTMLButtonElement>('[data-analysis-technology-tick="400"]')!.click();
    await vi.waitFor(()=>expect(callbacks.seekReplay).toHaveBeenLastCalledWith(400));await vi.waitFor(()=>expect(panel(root,'replay').hidden).toBe(false));
    open(root,'analysis');callbacks.seekReplay.mockReturnValue(false);page.querySelector<HTMLButtonElement>('[data-analysis-technology-tick="200"]')!.click();
    await vi.waitFor(()=>expect(root.querySelector('[role="status"]')!.textContent).toContain('could not be opened'));
    expect(page.hidden).toBe(false);expect(panel(root,'replay').hidden).toBe(true);
  });
  it('does not offer analysis seeks outside a saved replay interval',()=>{
    const callbacks=makeCallbacks();callbacks.getAnalysis.mockReturnValue(recordedAnalysis());callbacks.getReplay.mockReturnValue({tick:600,initialTick:600,totalTicks:1200,playing:false,speed:1,perspective:0});
    const {root}=setup(callbacks,{replaySpectator:true}),page=open(root,'analysis');
    expect(page.querySelector('[data-analysis-tick="0"]')).toBeNull();
    expect(page.querySelector('[data-analysis-tick="1200"]')).not.toBeNull();
    const oldTechnology=page.querySelector<HTMLButtonElement>('[data-analysis-technology-tick="400"]')!;
    expect(oldTechnology.disabled).toBe(true);oldTechnology.click();expect(callbacks.seekReplay).not.toHaveBeenCalled();
  });
});

describe('global production', () => {
  it('shows owned recruitment buildings, sends recruit/select commands, and omits enemies', async () => {
    const { root, state, tools, callbacks } = setup();
    const barracks = addProducer(state);
    Object.assign(state.players[0], { wood: 2000, ore: 2000, crystal: 2000 });
    tools.update(state, {});
    const page = open(root, 'production');
    expect(page.querySelectorAll('[data-production-building]')).toHaveLength(2);
    const enemy = state.entities.find(entity => entity.side === 1 && entity.role === 'hq')!;
    expect(page.querySelector(`[data-production-building="${enemy.id}"]`)).toBeNull();
    const card = page.querySelector<HTMLElement>(`[data-production-building="${barracks.id}"]`)!;
    card.querySelector<HTMLButtonElement>('[data-recruit="melee"]')!.click();
    await vi.waitFor(() => expect(callbacks.train).toHaveBeenCalledWith(barracks.id, 'melee'));
    button(card, 'Select building').click();
    expect(callbacks.selectBuilding).toHaveBeenCalledWith(barracks.id);
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
  });

  it('keeps the active recruit in its slot and uses the displayed queue snapshot for reorder and cancellation', async () => {
    const { root, state, tools, callbacks } = setup();
    const barracks = addProducer(state);
    barracks.queue = ['melee', 'ranged', 'special'];
    barracks.trainProgress = .6;
    tools.update(state, {});
    const page = open(root, 'production');
    const card = page.querySelector<HTMLElement>(`[data-production-building="${barracks.id}"]`)!;
    const active = card.querySelector<HTMLElement>('[data-queue-index="0"]')!;
    expect(active.draggable).toBe(false);
    expect(active.querySelector('progress')!.value).toBe(.6);
    expect(active.querySelector('[aria-label^="Move"]')).toBeNull();
    const second = card.querySelector<HTMLElement>('[data-queue-index="1"]')!;
    expect(button(second, /^Move up /).disabled).toBe(true);
    button(second, /^Move up /).click();
    expect(callbacks.reorderTrain).not.toHaveBeenCalled();
    button(second, /^Move down /).click();
    await vi.waitFor(() => expect(callbacks.reorderTrain).toHaveBeenCalledWith(barracks.id, 1, 2, '["melee","ranged","special"]'));
    barracks.queue.splice(0, 1);
    button(second, /^Cancel /).click();
    await vi.waitFor(() => expect(callbacks.cancelTrain).toHaveBeenCalledWith(barracks.id, 1, '["melee","ranged","special"]'));
  });

  it('drags waiting recruits while refusing drops onto the active recruit or a changed queue', async () => {
    const { root, state, tools, callbacks } = setup();
    const barracks = addProducer(state);
    barracks.queue = ['melee', 'ranged', 'special'];
    const headquarters = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
    headquarters.queue = ['worker', 'worker'];
    tools.update(state, {});
    const page = open(root, 'production');
    const card = () => page.querySelector<HTMLElement>(`[data-production-building="${barracks.id}"]`)!;
    const row = (index: number) => card().querySelector<HTMLElement>(`[data-queue-index="${index}"]`)!;
    row(2).dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    row(0).dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    expect(callbacks.reorderTrain).not.toHaveBeenCalled();
    row(2).dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    page.querySelector<HTMLElement>(`[data-production-building="${headquarters.id}"] [data-queue-index="1"]`)!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    expect(callbacks.reorderTrain).not.toHaveBeenCalled();
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
    const transfer = { setData: vi.fn(), effectAllowed: '' };
    Object.defineProperty(dragStart, 'dataTransfer', { value: transfer });
    row(2).dispatchEvent(dragStart);
    expect(transfer.setData).toHaveBeenCalledWith('text/plain', JSON.stringify({ id: barracks.id, from: 2, expected: '["melee","ranged","special"]' }));
    expect(transfer.effectAllowed).toBe('move');
    const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
    row(1).dispatchEvent(dragOver);
    expect(dragOver.defaultPrevented).toBe(true);
    row(1).dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(callbacks.reorderTrain).toHaveBeenCalledWith(barracks.id, 2, 1, '["melee","ranged","special"]'));
    callbacks.reorderTrain.mockClear();
    row(2).dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    barracks.queue.splice(0, 1);
    tools.update(state, {});
    row(1).dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    expect(callbacks.reorderTrain).not.toHaveBeenCalled();
  });

  it('updates cost, age, construction, and supply restrictions without replacing recruit controls', () => {
    const { root, state, tools, callbacks } = setup();
    const barracks = addProducer(state);
    Object.assign(state.players[0], { wood: 2000, ore: 2000, crystal: 2000 });
    tools.update(state, {});
    const page = open(root, 'production');
    const card = page.querySelector<HTMLElement>(`[data-production-building="${barracks.id}"]`)!;
    const cavalry = card.querySelector<HTMLButtonElement>('[data-recruit="cavalry"]')!;
    const melee = card.querySelector<HTMLButtonElement>('[data-recruit="melee"]')!;
    expect(cavalry.disabled).toBe(true);
    expect(cavalry.title).toContain('Requires Town Age');
    cavalry.click();
    expect(callbacks.train).not.toHaveBeenCalled();
    state.players[0].upgrades.push('town-age');
    tools.update(state, {});
    expect(card.querySelector('[data-recruit="cavalry"]')).toBe(cavalry);
    expect(cavalry.disabled).toBe(false);
    state.players[0].wood = 0;
    state.players[0].ore = 0;
    tools.update(state, {});
    expect(melee.disabled).toBe(true);
    expect(melee.title).toContain('Need');
    Object.assign(state.players[0], { wood: 2000, ore: 2000, cap: state.players[0].population });
    tools.update(state, {});
    expect(melee.title).toBe('Build a depot for supply');
    state.players[0].cap += 10;
    barracks.progress = .5;
    tools.update(state, {});
    expect(melee.title).toBe('Under construction');
  });

  it.each(['replay', 'ended'] as const)('disables all production mutations during %s', mode => {
    const { root, state, tools, callbacks } = setup();
    const barracks = addProducer(state);
    barracks.queue = ['melee', 'ranged', 'special'];
    if (mode === 'ended') state.winner = 0;
    tools.update(state, { replaySpectator: mode === 'replay' });
    const page = open(root, 'production');
    const mutations = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-recruit],[aria-label^="Cancel"],[aria-label^="Move"]'));
    expect(mutations.length).toBeGreaterThan(0);
    for (const control of mutations) { expect(control.disabled).toBe(true); control.click(); }
    expect(callbacks.train).not.toHaveBeenCalled();
    expect(callbacks.cancelTrain).not.toHaveBeenCalled();
    expect(callbacks.reorderTrain).not.toHaveBeenCalled();
  });
});

describe('bindings, reports, and modal lifecycle', () => {
  it('captures a key combination, reports a conflict, and preserves the draft across updates', async () => {
    const callbacks = makeCallbacks();
    callbacks.setBinding.mockImplementation(() => { throw new Error('Shortcut already assigned to Stop'); });
    const { root, state, tools } = setup(callbacks);
    const page = open(root, 'controls');
    const input = field(page, 'Attack move shortcut');
    input.focus();
    const key = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(input.value).toBe('Ctrl+Shift+K');
    state.tick++;
    tools.update(state, {});
    expect(field(page, 'Attack move shortcut')).toBe(input);
    expect(input.value).toBe('Ctrl+Shift+K');
    button(page, 'Apply Attack move shortcut').click();
    await vi.waitFor(() => expect(callbacks.setBinding).toHaveBeenCalledWith('attackMove', 'Ctrl+Shift+K'));
    await vi.waitFor(() => expect(root.querySelector('[role="status"]')!.textContent).toBe('Shortcut already assigned to Stop'));
    expect(callbacks.getBindings()[0].key).toBe('A');
  });

  it('captures shifted physical keys and limits control profile names to the supported length', async () => {
    const { root, callbacks } = setup();
    const page = open(root, 'controls');
    const input = field(page, 'Attack move shortcut');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '!', code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true }));
    expect(input.value).toBe('Shift+1');
    button(page, 'Apply Attack move shortcut').click();
    await vi.waitFor(() => expect(callbacks.setBinding).toHaveBeenCalledWith('attackMove', 'Shift+1'));
    expect(field(page, 'Control profile name').maxLength).toBe(40);
  });
  it.each([
    ['Control','ControlLeft',{ctrlKey:true}],['Alt','AltRight',{altKey:true}],['Shift','ShiftRight',{shiftKey:true}],['Meta','MetaLeft',{metaKey:true}],
  ] as const)('captures a bare %s key only for the queue modifier',async(key,code,modifiers)=>{
    const callbacks=makeCallbacks();callbacks.getBindings.mockReturnValue([...callbacks.getBindings(),{action:'queueModifier',label:'Queue orders / add selection',key:'Left Shift'}]);
    const {root}=setup(callbacks),page=open(root,'controls'),queue=field(page,'Queue orders / add selection shortcut'),normal=field(page,'Attack move shortcut');
    const press=()=>new KeyboardEvent('keydown',{key,code,...modifiers,bubbles:true,cancelable:true});
    normal.dispatchEvent(press());expect(normal.value).toBe('A');
    queue.dispatchEvent(press());expect(queue.value).toBe(code);button(page,'Apply Queue orders / add selection shortcut').click();
    await vi.waitFor(()=>expect(callbacks.setBinding).toHaveBeenCalledWith('queueModifier',code));
  });

  it('saves, loads, and restores control profiles through the callbacks', async () => {
    const { root, callbacks } = setup();
    const page = open(root, 'controls');
    setInput(field(page, 'Control profile name'), '  My keyboard  ');
    button(page, 'Save control profile').click();
    await vi.waitFor(() => expect(callbacks.saveBindingProfile).toHaveBeenCalledWith('My keyboard'));
    setInput(field<HTMLSelectElement>(page, 'Saved control profiles'), 'Laptop');
    button(page, 'Load control profile').click();
    await vi.waitFor(() => expect(callbacks.loadBindingProfile).toHaveBeenCalledWith('Laptop'));
    button(page, 'Restore default controls').click();
    await vi.waitFor(() => expect(callbacks.resetBindings).toHaveBeenCalledOnce());
  });

  it('keeps a bug description draft and downloads the report returned by the host', async () => {
    const { root, state, tools, callbacks } = setup();
    const page = open(root, 'report');
    button(page, 'Download bug report').click();
    expect(callbacks.bugReport).not.toHaveBeenCalled();
    const description = field<HTMLTextAreaElement>(page, 'Bug description');
    setInput(description, '  Cavalry stopped after crossing the bridge.  ');
    tools.update(state, {});
    expect(description.value).toBe('  Cavalry stopped after crossing the bridge.  ');
    button(page, 'Download bug report').click();
    await vi.waitFor(() => expect(callbacks.bugReport).toHaveBeenCalledWith('Cavalry stopped after crossing the bridge.'));
    await vi.waitFor(() => expect(callbacks.download).toHaveBeenCalledWith('orcs-vs-fairies-bug-report.json', {
      description: 'Cavalry stopped after crossing the bridge.', replay: { seed: 4127 }, diagnostics: { tick: 0 },
    }));
  });

  it('blocks battlefield keyboard events while open, traps focus, and restores the launcher on Escape', () => {
    const { root, callbacks } = setup();
    const launch = root.querySelector<HTMLButtonElement>('[data-session-tool="report"]')!;
    launch.focus();
    const page = open(root, 'report');
    expect(callbacks.onModal).toHaveBeenCalledWith(true);
    const close = button(root, 'Close session tools');
    expect(document.activeElement).toBe(close);
    const fieldKey = vi.fn();
    root.addEventListener('keydown', fieldKey);
    field<HTMLTextAreaElement>(page, 'Bug description').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(fieldKey).not.toHaveBeenCalled();
    const last = button(page, 'Download bug report');
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
    expect(root.querySelector<HTMLElement>('.session-overlay')!.hidden).toBe(true);
    expect(document.activeElement).toBe(launch);
  });
  it('passes camera and photo shortcuts from the restored toolbar focus while isolating modal input',()=>{
    const {root}=setup(),launch=root.querySelector<HTMLButtonElement>('[data-session-tool="controls"]')!,battlefield=vi.fn();
    window.addEventListener('keydown',battlefield);
    try{
      launch.focus();open(root,'controls');
      button(root,'Close session tools').dispatchEvent(new KeyboardEvent('keydown',{key:'r',code:'KeyR',bubbles:true}));
      document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'F9',code:'F9',bubbles:true}));
      expect(battlefield).not.toHaveBeenCalled();
      button(root,'Close session tools').click();expect(document.activeElement).toBe(launch);
      for(const [key,code] of [['r','KeyR'],['F9','F9']])launch.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true}));
      expect(battlefield).toHaveBeenCalledTimes(2);
      for(const key of ['Enter',' ']){const activation=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});launch.dispatchEvent(activation);expect(activation.defaultPrevented).toBe(false);}
      expect(battlefield).toHaveBeenCalledTimes(2);
    }finally{window.removeEventListener('keydown',battlefield);}
  });

  it('closes the modal for photo mode and removes controls and keyboard interception on disposal', () => {
    const { root, tools, state, callbacks } = setup();
    open(root, 'controls');
    root.querySelector<HTMLButtonElement>('[data-session-tool="photo"]')!.click();
    expect(callbacks.photo).toHaveBeenCalledOnce();
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
    open(root, 'report');
    tools.dispose();
    expect(callbacks.onModal).toHaveBeenLastCalledWith(false);
    expect(root.querySelector('.session-tools')).toBeNull();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    tools.update(state, {});
    expect(root.children).toHaveLength(0);
  });
});
