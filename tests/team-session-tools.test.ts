// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch, issueCommand } from '../src/core/simulation';
import type { GameState, MatchConfig, Side } from '../src/core/types';
import { mountSessionTools, type SessionAnalysis, type SessionReplayStatus } from '../src/ui/SessionTools';

type Tools = ReturnType<typeof mountSessionTools>;
type Callbacks = Parameters<typeof mountSessionTools>[1];
type Status = Parameters<Tools['update']>[1];
const mounted: Tools[] = [];

afterEach(() => {
  for (const tools of mounted.splice(0)) tools.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function match(count: number): GameState {
  const config: MatchConfig = {
    map: { seed: 4127, size: 'small' },
    players: Array.from({ length: count }, (_, id) => ({
      id: id as Side,
      teamId: (id < count / 2 ? 0 : 1) as Side,
      factionId: id % 2 ? 'fairies' : 'orcs',
      controller: 'external',
    })),
    rules: { sharedVision: false },
  };
  return createMatch(config);
}

function analysis(count: number): SessionAnalysis {
  return {
    complete: true,
    playerNames: Array.from({ length: count }, (_, side) => `Commander ${side + 1}`),
    samples: [600, 800, 1200].map((tick, index) => ({
      tick,
      time: tick / 20,
      players: Array.from({ length: count }, (_, side) => ({
        wood: (side + 1) * 100 + index * 20,
        ore: side * 10,
        crystal: index * 5,
        army: side + 2 + index,
        losses: index * side,
        gathered: (side + 1) * 1000 + index * 200,
        buildings: 2 + side + index,
        armyValue: (side + 1) * 200 + index * 30,
        buildingLosses: index * (side + 1),
        lostValue: index * 75 * (side + 1),
      })),
    })),
    technologies: Array.from({ length: count }, (_, side) => ({
      side: side as Side,
      tick: 680 + side * 20,
      time: 34 + side,
      name: `Technology for slot ${side + 1}`,
    })),
  };
}

function replay(count: number): SessionReplayStatus {
  return {
    tick: 800,
    initialTick: 600,
    totalTicks: 1200,
    playing: false,
    speed: 1,
    perspective: (count - 1) as Side,
    roster: Array.from({ length: count }, (_, id) => ({ id: id as Side, name: `Commander ${id + 1}` })),
  };
}

function callbacks() {
  return {
    listSaves: vi.fn<Callbacks['listSaves']>(() => []),
    save: vi.fn<Callbacks['save']>(() => true),
    load: vi.fn<Callbacks['load']>(() => true),
    deleteSave: vi.fn<Callbacks['deleteSave']>(() => true),
    importSave: vi.fn<Callbacks['importSave']>(() => true),
    exportSave: vi.fn<Callbacks['exportSave']>(() => ({})),
    getAutosave: vi.fn<Callbacks['getAutosave']>(() => ({ enabled: false, intervalSeconds: 60 })),
    setAutosave: vi.fn<Callbacks['setAutosave']>(() => true),
    getReplay: vi.fn<Callbacks['getReplay']>(() => null),
    importReplay: vi.fn<Callbacks['importReplay']>(() => true),
    exportReplay: vi.fn<Callbacks['exportReplay']>(() => ({})),
    seekReplay: vi.fn<Callbacks['seekReplay']>(() => true),
    setReplayPlaying: vi.fn<Callbacks['setReplayPlaying']>(() => true),
    setReplaySpeed: vi.fn<Callbacks['setReplaySpeed']>(() => true),
    setReplayPerspective: vi.fn<Callbacks['setReplayPerspective']>(() => true),
    getAnalysis: vi.fn<Callbacks['getAnalysis']>(() => null),
    train: vi.fn<Callbacks['train']>(() => true),
    cancelTrain: vi.fn<Callbacks['cancelTrain']>(() => true),
    reorderTrain: vi.fn<Callbacks['reorderTrain']>(() => true),
    selectBuilding: vi.fn<Callbacks['selectBuilding']>(() => {}),
    getBindings: vi.fn<Callbacks['getBindings']>(() => []),
    getBindingProfiles: vi.fn<Callbacks['getBindingProfiles']>(() => []),
    setBinding: vi.fn<Callbacks['setBinding']>(() => true),
    saveBindingProfile: vi.fn<Callbacks['saveBindingProfile']>(() => true),
    loadBindingProfile: vi.fn<Callbacks['loadBindingProfile']>(() => true),
    resetBindings: vi.fn<Callbacks['resetBindings']>(() => true),
    bugReport: vi.fn<Callbacks['bugReport']>(() => ({})),
    photo: vi.fn<Callbacks['photo']>(() => {}),
    onModal: vi.fn<Callbacks['onModal']>(() => {}),
    download: vi.fn<NonNullable<Callbacks['download']>>(() => true),
  } satisfies Callbacks;
}

function setup(count = 8, status: Status = { replaySpectator: true }) {
  const root = document.createElement('div');
  document.body.append(root);
  const state = match(count), cb = callbacks(), tools = mountSessionTools(root, cb);
  mounted.push(tools);
  tools.update(state, status);
  return { root, state, cb, tools };
}

function page(root: HTMLElement, name: string): HTMLElement {
  const button = root.querySelector<HTMLButtonElement>(`[data-session-tool="${name}"]`)!;
  button.click();
  return root.querySelector<HTMLElement>(`[data-session-page="${name}"]`)!;
}

function field<T extends HTMLInputElement | HTMLSelectElement>(root: ParentNode, name: string): T {
  const control = root.querySelector<T>(`[aria-label="${name}"]`);
  expect(control, `Missing field ${name}`).not.toBeNull();
  return control!;
}

function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  control.value = value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function plot(root: ParentNode, title: string): SVGSVGElement {
  const result = root.querySelector<SVGSVGElement>(`svg[aria-label="${title} over match time"]`);
  expect(result, `Missing chart ${title}`).not.toBeNull();
  return result!;
}

const chartTitles = [
  'Resources held', 'Resources gathered', 'Army size (units)', 'Army recruitment value',
  'Buildings', 'Cumulative losses', 'Cumulative building losses', 'Cumulative loss value',
];

describe('team session analysis', () => {
  it.each([6, 8])('renders every player and recorded value in all %i-player charts', count => {
    const { root, cb } = setup(count);
    cb.getAnalysis.mockReturnValue(analysis(count));
    cb.getReplay.mockReturnValue(replay(count));
    const panel = page(root, 'analysis');
    const lastValues: Record<string, number> = {
      'Resources held': count * 100 + (count - 1) * 10 + 50,
      'Resources gathered': count * 1000 + 400,
      'Army size (units)': count + 3,
      'Army recruitment value': count * 200 + 60,
      'Buildings': count + 3,
      'Cumulative losses': 2 * (count - 1),
      'Cumulative building losses': 2 * count,
      'Cumulative loss value': 150 * count,
    };
    for (const title of chartTitles) {
      const graph = plot(panel, title), paths = Array.from(graph.querySelectorAll<SVGPathElement>('path[data-analysis-side]'));
      expect(paths.map(path => Number(path.dataset.analysisSide)).sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, side) => side));
      expect(graph.querySelectorAll('circle[data-analysis-side]')).toHaveLength(count * 3);
      for (const [side, path] of paths.entries()) {
        expect(path.querySelector('title')!.textContent).toContain(`Commander ${Number(path.dataset.analysisSide) + 1}`);
        expect(path.getAttribute('d')).toMatch(/^M .*L /);
        expect(graph.querySelectorAll(`circle[data-analysis-side="${side}"]`)).toHaveLength(3);
      }
      const last = graph.querySelector<SVGCircleElement>(`circle[data-analysis-side="${count - 1}"][data-analysis-tick="1200"]`)!;
      const previous = graph.querySelector<SVGCircleElement>(`circle[data-analysis-side="${count - 2}"][data-analysis-tick="1200"]`)!;
      expect(last.querySelector('title')!.textContent).toContain(`: ${lastValues[title]} at`);
      expect(Number(last.getAttribute('cy'))).toBeGreaterThanOrEqual(0);
      expect(Number(last.getAttribute('cy'))).toBeLessThan(Number(previous.getAttribute('cy')));
      expect(last.getAttribute('cx')).toBe(previous.getAttribute('cx'));
    }
    expect(panel.textContent).not.toContain('undefined');
  });

  it('gives all eight players distinct graph styles and uses them consistently across metrics', () => {
    const { root, cb } = setup();
    cb.getAnalysis.mockReturnValue(analysis(8));
    const panel = page(root, 'analysis');
    const styles = (title: string) => Array.from(plot(panel, title).querySelectorAll('path[data-analysis-side]')).map(path => [
      path.getAttribute('data-analysis-side'), `${path.getAttribute('stroke')}|${path.getAttribute('stroke-dasharray') ?? ''}`,
    ]);
    const resourceStyles = styles('Resources held');
    expect(new Set(resourceStyles.map(([, style]) => style)).size).toBe(8);
    expect(styles('Cumulative loss value')).toEqual(resourceStyles);
  });

  it('renders all eight technology rows and keeps the final row inside its timeline', async () => {
    const { root, cb } = setup();
    cb.getAnalysis.mockReturnValue(analysis(8));
    cb.getReplay.mockReturnValue(replay(8));
    const panel = page(root, 'analysis');
    const timeline = panel.querySelector<SVGSVGElement>('svg[aria-label="Completed technologies by match time"]')!;
    expect(timeline.querySelectorAll('line[data-analysis-side]')).toHaveLength(8);
    const marker = timeline.querySelector<SVGCircleElement>('circle[data-analysis-side="7"]')!;
    const [, y, , height] = timeline.getAttribute('viewBox')!.split(/\s+/).map(Number);
    expect(Number(marker.getAttribute('cy'))).toBeGreaterThanOrEqual(y + Number(marker.getAttribute('r')));
    expect(Number(marker.getAttribute('cy')) + Number(marker.getAttribute('r'))).toBeLessThanOrEqual(y + height);
    expect(marker.querySelector('title')!.textContent).toContain('Commander 8');
    const link = panel.querySelector<HTMLButtonElement>('[data-analysis-technology-tick="820"]')!;
    expect(link.textContent).toContain('Player 8');
    expect(link.textContent).toContain('Technology for slot 8');
    link.click();
    await vi.waitFor(() => expect(cb.seekReplay).toHaveBeenCalledWith(820));
  });

  it('uses player numbers when names are missing and identifies equal player names separately', () => {
    const { root, cb } = setup();
    const values = analysis(8);
    values.playerNames = ['Same commander', 'Same commander'];
    cb.getAnalysis.mockReturnValue(values);
    const panel = page(root, 'analysis'), graph = plot(panel, 'Resources held');
    for (const side of [0, 1]) {
      const text = graph.querySelector(`path[data-analysis-side="${side}"] title`)!.textContent;
      expect(text).toContain(`Player ${side + 1}`);
      expect(text).toContain('Same commander');
    }
    expect(graph.querySelector('path[data-analysis-side="7"] title')!.textContent).toContain('Player 8');
    expect(panel.textContent).not.toContain('undefined');
  });

  it('finds optional metrics recorded only for the eighth player', () => {
    const { root, cb } = setup(), values = analysis(8);
    for (const sample of values.samples) for (const [side, player] of sample.players.entries()) {
      if (side === 7) continue;
      delete player.gathered; delete player.armyValue; delete player.buildings; delete player.buildingLosses; delete player.lostValue;
    }
    cb.getAnalysis.mockReturnValue(values);
    const panel = page(root, 'analysis');
    for (const title of ['Resources gathered', 'Army recruitment value', 'Buildings', 'Cumulative building losses', 'Cumulative loss value']) {
      const graph = plot(panel, title);
      expect(graph.querySelectorAll('circle[data-analysis-side="7"]')).toHaveLength(3);
      expect(graph.querySelectorAll('circle[data-analysis-side="0"]')).toHaveLength(0);
      expect(graph.querySelector('path[data-analysis-side="7"] title')!.textContent).toContain('Commander 8');
    }
  });

  it.each([6, 8])('keeps every enemy economy and technology private during a live %i-player match', count => {
    const { root, cb } = setup(count, { side: (count - 1) as Side });
    cb.getAnalysis.mockReturnValue(analysis(count));
    const panel = page(root, 'analysis');
    expect(panel.textContent).toContain('Enemy economy and technology remain private');
    expect(panel.querySelector('svg')).toBeNull();
    expect(panel.textContent).not.toContain('Technology for slot');
    expect(panel.textContent).not.toContain('Commander');
  });
});

describe('team replay perspective', () => {
  it('lists all eight replay players and switches to the eighth perspective', async () => {
    const { root, cb } = setup(), current = replay(8);
    current.perspective = 0;
    current.roster = current.roster!.map(player => ({ ...player, name: 'Same faction' }));
    cb.getReplay.mockReturnValue(current);
    const selector = field<HTMLSelectElement>(page(root, 'replay'), 'Replay perspective');
    expect(Array.from(selector.options).map(option => option.value)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect(selector.options[7].textContent).toContain('Player 8');
    expect(selector.options[7].textContent).toContain('Same faction');
    change(selector, '7');
    await vi.waitFor(() => expect(cb.setReplayPerspective).toHaveBeenCalledWith(7));
  });

  it('uses the actual match player count when optional replay roster metadata is absent', () => {
    const { root, cb } = setup(), current = replay(8);
    delete current.roster;
    cb.getReplay.mockReturnValue(current);
    const selector = field<HTMLSelectElement>(page(root, 'replay'), 'Replay perspective');
    expect(selector.options).toHaveLength(8);
    expect(selector.value).toBe('7');
    expect(selector.options[7].textContent).toContain('Player 8');
  });

  it('orders reversed replay roster metadata by player ID without changing the caller array', () => {
    const { root, cb } = setup(), current = replay(8);
    current.roster = Array.from(current.roster!).reverse();
    const before = structuredClone(current.roster);
    cb.getReplay.mockReturnValue(current);
    const selector = field<HTMLSelectElement>(page(root, 'replay'), 'Replay perspective');
    expect(Array.from(selector.options).map(option => option.value)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    for (const [side, option] of Array.from(selector.options).entries()) {
      expect(option.textContent).toContain(`Player ${side + 1}`);
      expect(option.textContent).toContain(`Commander ${side + 1}`);
    }
    expect(selector.value).toBe('7');
    expect(current.roster).toEqual(before);
  });

  it('uses replay roster metadata while the previously displayed live state still has eight players', () => {
    const { root, cb } = setup();
    cb.getReplay.mockReturnValue(replay(2));
    const selector = field<HTMLSelectElement>(page(root, 'replay'), 'Replay perspective');
    expect(Array.from(selector.options).map(option => option.value)).toEqual(['0', '1']);
    expect(selector.value).toBe('1');
  });

  it('removes a stale eighth-player selection on roster replacement even while the field is focused', () => {
    const { root, cb, tools } = setup();
    cb.getReplay.mockReturnValue(replay(8));
    const selector = field<HTMLSelectElement>(page(root, 'replay'), 'Replay perspective');
    selector.focus();
    expect(selector.value).toBe('7');
    const replacement = replay(2);
    replacement.perspective = 0;
    cb.getReplay.mockReturnValue(replacement);
    tools.update(match(2), { replaySpectator: true });
    expect(document.activeElement).toBe(selector);
    expect(Array.from(selector.options).map(option => option.value)).toEqual(['0', '1']);
    expect(selector.value).toBe('0');
    expect(cb.setReplayPerspective).not.toHaveBeenCalled();
  });

  it('rejects perspective events against a stale roster and permits a remaining player', async () => {
    const { root, cb } = setup();
    cb.getReplay.mockReturnValue(replay(8));
    const selector = field<HTMLSelectElement>(page(root, 'replay'), 'Replay perspective');
    cb.getReplay.mockReturnValue(replay(2));
    change(selector, '7');
    await Promise.resolve();
    expect(cb.setReplayPerspective).not.toHaveBeenCalled();
    change(selector, '1');
    await vi.waitFor(() => expect(cb.setReplayPerspective).toHaveBeenCalledWith(1));
  });

  it.each(['', '-1', '1.5', '8', 'NaN'])('rejects invalid perspective value %s', async value => {
    const { root, cb } = setup();
    cb.getReplay.mockReturnValue(replay(8));
    const selector = field<HTMLSelectElement>(page(root, 'replay'), 'Replay perspective');
    const stale = document.createElement('option');
    stale.value = value; selector.append(stale);
    change(selector, value);
    await Promise.resolve();
    expect(cb.setReplayPerspective).not.toHaveBeenCalled();
  });
});

describe('saved replay tick intervals', () => {
  it('permits the initial and final tick while the current tick is in between', async () => {
    const { root, cb } = setup();
    cb.getReplay.mockReturnValue(replay(8));
    const slider = field<HTMLInputElement>(page(root, 'replay'), 'Replay tick');
    expect([slider.min, slider.value, slider.max]).toEqual(['600', '800', '1200']);
    change(slider, '600');
    await vi.waitFor(() => expect(cb.seekReplay).toHaveBeenLastCalledWith(600));
    change(slider, '1200');
    await vi.waitFor(() => expect(cb.seekReplay).toHaveBeenLastCalledWith(1200));
  });

  it('rejects stale slider drafts before a new initial tick or after a shortened final tick', async () => {
    const { root, cb } = setup(), current = replay(8);
    cb.getReplay.mockReturnValue(current);
    const slider = field<HTMLInputElement>(page(root, 'replay'), 'Replay tick');
    slider.value = '700'; current.initialTick = 900; current.tick = 1000;
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(cb.seekReplay).not.toHaveBeenCalled();
    slider.value = '1100'; current.totalTicks = 1000;
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(cb.seekReplay).not.toHaveBeenCalled();
  });

  it.each([
    { oldInitial: 0, oldTick: 20, oldFinal: 200, draft: '100', nextInitial: 800, nextTick: 900, nextFinal: 1600 },
    { oldInitial: 800, oldTick: 900, oldFinal: 1600, draft: '1000', nextInitial: 0, nextTick: 20, nextFinal: 200 },
  ])('resets a focused seek field when a replacement interval begins at $nextInitial', values => {
    const { root, cb, tools, state } = setup(), current = replay(8);
    Object.assign(current, { initialTick: values.oldInitial, tick: values.oldTick, totalTicks: values.oldFinal });
    cb.getReplay.mockReturnValue(current);
    const slider = field<HTMLInputElement>(page(root, 'replay'), 'Replay tick');
    slider.focus(); slider.value = values.draft;
    Object.assign(current, { initialTick: values.nextInitial, tick: values.nextTick, totalTicks: values.nextFinal });
    tools.update(state, { replaySpectator: true });
    expect(document.activeElement).toBe(slider);
    expect([slider.min, slider.value, slider.max]).toEqual([String(values.nextInitial), String(values.nextTick), String(values.nextFinal)]);
    expect(cb.seekReplay).not.toHaveBeenCalled();
  });

  it('preserves a focused seek draft during playback within the same saved interval', () => {
    const { root, cb, tools, state } = setup(), current = replay(8);
    cb.getReplay.mockReturnValue(current);
    const slider = field<HTMLInputElement>(page(root, 'replay'), 'Replay tick');
    slider.focus(); slider.value = '1000'; current.tick = 801;
    tools.update(state, { replaySpectator: true });
    expect(slider.value).toBe('1000');
    slider.blur(); tools.update(state, { replaySpectator: true });
    expect(slider.value).toBe('801');
  });

  it('revalidates retained chart and technology buttons against replacement bounds', async () => {
    const { root, cb } = setup(), current = replay(8);
    cb.getReplay.mockReturnValue(current); cb.getAnalysis.mockReturnValue(analysis(8));
    const panel = page(root, 'analysis');
    const earlier = plot(panel, 'Resources held').querySelector<SVGCircleElement>('[data-analysis-side="7"][data-analysis-tick="600"]')!;
    const later = plot(panel, 'Resources held').querySelector<SVGCircleElement>('[data-analysis-side="7"][data-analysis-tick="1200"]')!;
    const technology = panel.querySelector<HTMLButtonElement>('[data-analysis-technology-tick="820"]')!;
    cb.getReplay.mockReturnValue({ ...current, initialTick: 900, tick: 1000, totalTicks: 1100 });
    earlier.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    later.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    technology.click();
    await Promise.resolve();
    expect(cb.seekReplay).not.toHaveBeenCalled();
    expect(panel.hidden).toBe(false);
  });
});

describe('eighth-player production', () => {
  it('shows and recruits through only the selected player headquarters in an actual team match', async () => {
    const { root, state, cb, tools } = setup(8, { side: 7 });
    const headquarters = state.entities.find(entity => entity.side === 7 && entity.role === 'hq')!;
    const otherQueues = state.entities.filter(entity => entity.side !== 7 && entity.role === 'hq').map(entity => ({ id: entity.id, queue: [...entity.queue] }));
    const previousWood = state.players[7].wood;
    cb.train.mockImplementation((id, role) => issueCommand(state, 7, { type: 'train', id, role }));
    const panel = page(root, 'production');
    expect(Array.from(panel.querySelectorAll<HTMLElement>('[data-production-building]')).map(card => Number(card.dataset.productionBuilding))).toEqual([headquarters.id]);
    panel.querySelector<HTMLButtonElement>(`[data-production-building="${headquarters.id}"] [data-recruit="worker"]`)!.click();
    await vi.waitFor(() => expect(headquarters.queue).toEqual(['worker']));
    expect(cb.train).toHaveBeenCalledWith(headquarters.id, 'worker');
    expect(state.players[7].wood).toBeLessThan(previousWood);
    for (const previous of otherQueues) expect(state.entities.find(entity => entity.id === previous.id)!.queue).toEqual(previous.queue);
    tools.update(state, { side: 0 });
    expect(panel.querySelector(`[data-production-building="${headquarters.id}"]`)).toBeNull();
    const firstHeadquarters = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
    expect(panel.querySelector(`[data-production-building="${firstHeadquarters.id}"]`)).not.toBeNull();
  });
});
