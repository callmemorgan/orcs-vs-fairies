// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerView } from '../src/core/observation';
import { coachAdvice, createCoachMemory, type CoachTopic } from '../src/core/coach';
import { createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { Controller, GameState, Side } from '../src/core/types';
import { mountPracticeCoach, PRACTICE_COACH_STORAGE_KEY } from '../src/ui/PracticeCoach';

type Coach = ReturnType<typeof mountPracticeCoach>;
type Callbacks = NonNullable<Parameters<typeof mountPracticeCoach>[1]>;
const mounted: Coach[] = [];

afterEach(() => {
  for (const coach of mounted.splice(0)) coach.dispose();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  document.body.replaceChildren();
});

function memoryStorage(initial: string | null = null): Storage {
  const values = new Map<string, string>();
  if (initial !== null) values.set(PRACTICE_COACH_STORAGE_KEY, initial);
  return {
    get length() { return values.size; },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
}

function fixture(controller: Controller = 'human', side: Side = 0) {
  const state = createMatch({
    map: { seed: 4127, size: 'medium' },
    players: Array.from({ length: Math.max(2, side + 1) }, (_, id) => ({
      id: id as Side, teamId: (id % 2) as Side, factionId: id % 2 ? 'fairies' : 'orcs',
      controller: id === side ? controller : 'external',
    })),
  });
  state.terrain.fill('grass');
  const hq = state.entities.find(entity => entity.side === side && entity.role === 'hq')!;
  const workers = state.entities.filter(entity => entity.side === side && entity.role === 'worker');
  state.resources = [{ id: state.nextId++, kind: 'wood', x: hq.x + 6, y: hq.y + 2, amount: 10000, maxAmount: 10000 }];
  refreshVisibility(state);
  return { state, hq, workers, observer: new PlayerView(side) };
}

function setup(storage: Storage | null = null, controller: Controller = 'human', side: Side = 0) {
  const data = fixture(controller, side);
  const root = document.createElement('div');
  document.body.append(root);
  const focus = vi.fn<NonNullable<Callbacks['focus']>>();
  const coach = mountPracticeCoach(root, { focus }, storage);
  mounted.push(coach);
  const update = () => coach.update(data.observer.observe(data.state));
  update();
  return { ...data, root, coach, focus, update };
}

function advance(state: GameState, seconds: number) {
  for (let step = 0; step < seconds * 4; step++) stepGame(state, .25);
}

function control<T extends HTMLInputElement | HTMLSelectElement>(root: ParentNode, label: string): T {
  const found = Array.from(root.querySelectorAll<T>('input,select')).find(element => {
    if (element.getAttribute('aria-label') === label) return true;
    return element.labels && Array.from(element.labels).some(candidate => candidate.textContent?.trim() === label);
  });
  expect(found, `Missing control ${label}`).toBeDefined();
  return found!;
}

function enableControl(root: ParentNode) { return control<HTMLInputElement>(root, 'Enable practice coach'); }
function cooldownControl(root: ParentNode) { return control<HTMLSelectElement>(root, 'Dismiss advice for'); }

function setCooldown(root: ParentNode, seconds: 30 | 60 | 120) {
  const select = cooldownControl(root);
  select.value = String(seconds);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function advice(root: ParentNode, topic: CoachTopic): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-coach-topic="${topic}"]`);
}

function adviceButton(row: ParentNode, action: 'Show' | 'Dismiss'): HTMLButtonElement {
  const found = Array.from(row.querySelectorAll<HTMLButtonElement>('button')).find(button => button.getAttribute('aria-label')?.startsWith(`${action} `));
  expect(found, `Missing ${action} advice button`).toBeDefined();
  return found!;
}

function host(root: HTMLElement): HTMLElement {
  expect(root.firstElementChild).toBeInstanceOf(HTMLElement);
  return root.firstElementChild as HTMLElement;
}

function ready(data: ReturnType<typeof setup>) {
  advance(data.state, 30);
  data.update();
  expect(advice(data.root, 'idle-workers')).not.toBeNull();
  expect(advice(data.root, 'idle-production')).not.toBeNull();
}

describe('practice coach preferences', () => {
  it('starts enabled with native labelled cooldown settings', () => {
    const { root, coach } = setup();
    expect(coach.getPreferences()).toEqual({ version: 1, enabled: true, cooldownSeconds: 60 });
    expect(enableControl(root).type).toBe('checkbox');
    expect(enableControl(root).checked).toBe(true);
    expect(cooldownControl(root).value).toBe('60');
    expect(Array.from(cooldownControl(root).options).map(option => option.value)).toEqual(['30', '60', '120']);
    expect(root.querySelector('[role="dialog"],dialog')).toBeNull();
  });

  it('persists disabled settings across remount and leaves a visible control to reenable advice', () => {
    const storage = memoryStorage();
    const first = setup(storage);
    ready(first);
    setCooldown(first.root, 120);
    enableControl(first.root).click();
    expect(first.coach.getPreferences()).toEqual({ version: 1, enabled: false, cooldownSeconds: 120 });
    expect(first.root.querySelector('[data-coach-topic]')).toBeNull();
    expect(host(first.root).hidden).toBe(false);
    expect(enableControl(first.root).hidden).toBe(false);
    expect(JSON.parse(storage.getItem(PRACTICE_COACH_STORAGE_KEY)!)).toEqual(first.coach.getPreferences());
    first.coach.dispose();

    const second = setup(storage);
    readyWithoutAdvice(second);
    expect(second.coach.getPreferences()).toEqual({ version: 1, enabled: false, cooldownSeconds: 120 });
    expect(enableControl(second.root).checked).toBe(false);
    expect(cooldownControl(second.root).value).toBe('120');
    enableControl(second.root).click();
    expect(second.coach.getPreferences().enabled).toBe(true);
    expect(advice(second.root, 'idle-workers')).not.toBeNull();
  });

  it('uses browser storage by default', () => {
    localStorage.setItem(PRACTICE_COACH_STORAGE_KEY, JSON.stringify({ version: 1, enabled: false, cooldownSeconds: 30 }));
    const root = document.createElement('div');
    document.body.append(root);
    const coach = mountPracticeCoach(root, {});
    mounted.push(coach);
    const data = fixture();
    coach.update(data.observer.observe(data.state));
    expect(coach.getPreferences()).toEqual({ version: 1, enabled: false, cooldownSeconds: 30 });
    enableControl(root).click();
    expect(JSON.parse(localStorage.getItem(PRACTICE_COACH_STORAGE_KEY)!)).toEqual({ version: 1, enabled: true, cooldownSeconds: 30 });
  });

  it.each([
    '{bad json', 'null', '[]', 'true', '{}',
    JSON.stringify({ version: 2, enabled: true, cooldownSeconds: 60 }),
    JSON.stringify({ version: 1, enabled: 'false', cooldownSeconds: 60 }),
    JSON.stringify({ version: 1, enabled: false, cooldownSeconds: 45 }),
    JSON.stringify({ version: 1, enabled: false, cooldownSeconds: '30' }),
  ])('falls back to defaults for malformed stored preferences %s', value => {
    const { coach, root } = setup(memoryStorage(value));
    expect(coach.getPreferences()).toEqual({ version: 1, enabled: true, cooldownSeconds: 60 });
    expect(enableControl(root).checked).toBe(true);
    expect(cooldownControl(root).value).toBe('60');
  });

  it('remains usable when stored preferences cannot be read', () => {
    const storage = memoryStorage();
    vi.mocked(storage.getItem).mockImplementation(() => { throw new Error('Storage denied'); });
    const data = setup(storage);
    ready(data);
    expect(data.coach.getPreferences()).toEqual({ version: 1, enabled: true, cooldownSeconds: 60 });
    adviceButton(advice(data.root, 'idle-workers')!, 'Dismiss').click();
    expect(advice(data.root, 'idle-workers')).toBeNull();
  });

  it('keeps a changed setting in memory and reports a save failure without blocking advice', () => {
    const storage = memoryStorage();
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error('Quota exceeded'); });
    const data = setup(storage);
    ready(data);
    setCooldown(data.root, 30);
    expect(data.coach.getPreferences().cooldownSeconds).toBe(30);
    expect(cooldownControl(data.root).value).toBe('30');
    expect(data.root.querySelector('[role="status"]')?.textContent).toMatch(/save|storage|remember|persist/i);
    adviceButton(advice(data.root, 'idle-workers')!, 'Dismiss').click();
    expect(advice(data.root, 'idle-workers')).toBeNull();
    expect(advice(data.root, 'idle-production')).not.toBeNull();
    stepGame(data.state, .25);
    data.update();
    expect(data.root.querySelector('[role="status"]')?.textContent).toMatch(/save|storage|remember|persist/i);
    expect((data.root.querySelector('[role="status"]') as HTMLElement).hidden).toBe(false);
  });

  it('returns a copied preference value', () => {
    const { coach } = setup();
    const preferences = coach.getPreferences();
    preferences.enabled = false;
    preferences.cooldownSeconds = 120;
    expect(coach.getPreferences()).toEqual({ version: 1, enabled: true, cooldownSeconds: 60 });
  });
});

function readyWithoutAdvice(data: ReturnType<typeof setup>) {
  advance(data.state, 30);
  data.update();
  expect(data.root.querySelector('[data-coach-topic]')).toBeNull();
}

describe('practice coach advice during a real match', () => {
  it('uses core advice titles and messages from the filtered observation', () => {
    const data = setup();
    ready(data);
    const view = data.observer.observe(data.state);
    const expected = coachAdvice(view, createCoachMemory(view.side));
    expect(expected.length).toBeGreaterThan(0);
    expect(Array.from(data.root.querySelectorAll<HTMLElement>('[data-coach-topic]')).map(row => row.dataset.coachTopic)).toEqual(expected.map(item => item.id));
    for (const item of expected) {
      const row = advice(data.root, item.id)!;
      expect(row.textContent).toContain(item.title);
      expect(row.textContent).toContain(item.message);
      expect(adviceButton(row, 'Show').getAttribute('aria-label')).toBe(`Show ${item.title}`);
      expect(adviceButton(row, 'Dismiss').getAttribute('aria-label')).toBe(`Dismiss ${item.title}`);
    }
  });

  it('clears idle-worker advice after actual gathering commands and delivers real income', () => {
    const data = setup();
    ready(data);
    const before = data.state.players[0].wood;
    expect(issueCommand(data.state, 0, { type: 'gather', ids: data.workers.map(worker => worker.id), target: data.state.resources[0].id })).toBe(true);
    data.update();
    expect(advice(data.root, 'idle-workers')).toBeNull();
    advance(data.state, 24);
    data.update();
    expect(data.workers.every(worker => worker.order.type === 'gather')).toBe(true);
    expect(data.state.players[0].wood).toBeGreaterThan(before);
    expect(data.state.resources[0].amount).toBeLessThan(data.state.resources[0].maxAmount);
    expect(advice(data.root, 'idle-workers')).toBeNull();
  });

  it('clears idle-production advice while the headquarters trains a paid worker', () => {
    const data = setup();
    ready(data);
    const before = data.state.players[0].wood;
    expect(issueCommand(data.state, 0, { type: 'train', id: data.hq.id, role: 'worker' })).toBe(true);
    advance(data.state, 1);
    data.update();
    expect(data.state.players[0].wood).toBeLessThan(before);
    expect(data.hq.queue).toEqual(['worker']);
    expect(data.hq.trainProgress).toBeGreaterThan(0);
    expect(advice(data.root, 'idle-production')).toBeNull();
    expect(advice(data.root, 'idle-workers')).not.toBeNull();
  });

  it.each([30, 60, 120] as const)('dismisses one topic for %s simulation seconds and keeps other advice', seconds => {
    const data = setup();
    ready(data);
    setCooldown(data.root, seconds);
    const dismissedAt = data.state.time;
    adviceButton(advice(data.root, 'idle-workers')!, 'Dismiss').click();
    expect(advice(data.root, 'idle-workers')).toBeNull();
    expect(advice(data.root, 'idle-production')).not.toBeNull();
    advance(data.state, seconds - .25);
    data.update();
    expect(data.state.time).toBe(dismissedAt + seconds - .25);
    expect(advice(data.root, 'idle-workers')).toBeNull();
    stepGame(data.state, .25);
    data.update();
    expect(data.state.time).toBe(dismissedAt + seconds);
    expect(advice(data.root, 'idle-workers')).not.toBeNull();
  });

  it('does not expire dismissed advice when only wall-clock time changes', () => {
    const data = setup();
    ready(data);
    vi.useFakeTimers();
    adviceButton(advice(data.root, 'idle-workers')!, 'Dismiss').click();
    vi.advanceTimersByTime(120000);
    data.update();
    expect(data.state.time).toBe(30);
    expect(advice(data.root, 'idle-workers')).toBeNull();
  });

  it('focuses copied own entity IDs and coordinates without mutating the game', () => {
    const data = setup();
    ready(data);
    const view = data.observer.observe(data.state);
    const expected = coachAdvice(view, createCoachMemory(0)).find(item => item.id === 'idle-workers')!;
    const before = structuredClone(data.state);
    adviceButton(advice(data.root, expected.id)!, 'Show').click();
    expect(data.focus).toHaveBeenCalledTimes(1);
    expect(data.focus).toHaveBeenCalledWith(expected.entityIds, expected.point);
    const [ids, point] = data.focus.mock.calls[0];
    expect(ids.every(id => data.state.entities.some(entity => entity.id === id && entity.side === 0))).toBe(true);
    (ids as number[]).push(-99);
    if (point) point.x = -99;
    expect(data.state).toEqual(before);
    adviceButton(advice(data.root, expected.id)!, 'Show').click();
    expect(data.focus.mock.calls[1][0]).toEqual(expected.entityIds);
    expect(data.focus.mock.calls[1][1]).toEqual(expected.point);
  });

  it('supports advice when a focus callback is not provided', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const coach = mountPracticeCoach(root, {}, null);
    mounted.push(coach);
    const data = fixture();
    advance(data.state, 30);
    coach.update(data.observer.observe(data.state));
    const row = advice(root, 'idle-workers')!;
    expect(() => adviceButton(row, 'Show').click()).not.toThrow();
    adviceButton(row, 'Dismiss').click();
    expect(advice(root, 'idle-workers')).toBeNull();
  });

  it('clears transient focus failures after an observation, successful Show or a new match', () => {
    const data = setup();
    ready(data);
    const status = () => data.root.querySelector<HTMLElement>('[role="status"]')!;
    const show = () => adviceButton(advice(data.root, 'idle-workers')!, 'Show');
    const failOnce = () => data.focus.mockImplementationOnce(() => { throw new Error('Entity no longer exists'); });
    failOnce();
    expect(() => show().click()).not.toThrow();
    expect(status().hidden).toBe(false);
    expect(status().textContent).toMatch(/no longer|refresh|available/i);
    stepGame(data.state, .25);
    data.update();
    expect(status().hidden).toBe(true);
    expect(status().textContent).toBe('');
    const afterObservation = structuredClone(data.state);

    failOnce();
    show().click();
    expect(status().hidden).toBe(false);
    show().click();
    expect(status().hidden).toBe(true);
    expect(status().textContent).toBe('');
    expect(data.state).toEqual(afterObservation);

    failOnce();
    show().click();
    expect(status().hidden).toBe(false);
    data.coach.update(null);
    const next = fixture();
    advance(next.state, 30);
    data.coach.update(next.observer.observe(next.state));
    expect(status().hidden).toBe(true);
    expect(status().textContent).toBe('');
    show().click();
    expect(data.focus.mock.lastCall![0]).toEqual(next.workers.map(worker => worker.id));
    expect(status().hidden).toBe(true);
  });

  it('does not expose hidden enemy resources, production, orders, health or location', () => {
    const data = setup();
    ready(data);
    const hidden = data.state.entities.filter(entity => entity.side === 1);
    expect(data.observer.observe(data.state).entities.some(entity => entity.side === 1)).toBe(false);
    const before = data.root.textContent;
    const ownIds = data.state.entities.filter(entity => entity.side === 0).map(entity => entity.id);
    data.state.players[1].wood = 987654;
    data.state.players[1].ore = 876543;
    data.state.players[1].upgrades.push('town-age', 'citadel-age');
    for (const enemy of hidden) {
      enemy.hp /= 2;
      enemy.queue = ['worker', 'worker'];
      enemy.order = { type: 'attackMove', x: 99.25, y: 97.5 };
      enemy.x = data.state.width - 3;
      enemy.y = data.state.height - 3;
    }
    refreshVisibility(data.state);
    expect(data.observer.observe(data.state).entities.some(entity => entity.side === 1)).toBe(false);
    data.update();
    expect(data.root.textContent).toBe(before);
    for (const row of Array.from(data.root.querySelectorAll<HTMLElement>('[data-coach-topic]'))) {
      adviceButton(row, 'Show').click();
      expect(data.focus.mock.lastCall![0].every(id => ownIds.includes(id))).toBe(true);
    }
    expect(data.root.textContent).not.toMatch(/987654|876543|99\.25|97\.5/);
  });

  it('uses the eighth human seat in a team match', () => {
    const data = setup(null, 'human', 7);
    ready(data);
    adviceButton(advice(data.root, 'idle-workers')!, 'Show').click();
    expect(data.focus.mock.lastCall![0]).toEqual(data.workers.map(worker => worker.id));
    expect(data.focus.mock.lastCall![0].every(id => data.state.entities.some(entity => entity.id === id && entity.side === 7))).toBe(true);
  });
});

describe('practice coach lifecycle and native controls', () => {
  it('preserves control nodes, selected values and native focus across frame updates', () => {
    const data = setup();
    ready(data);
    const checkbox = enableControl(data.root);
    const select = cooldownControl(data.root);
    setCooldown(data.root, 120);
    select.focus();
    for (let tick = 0; tick < 4; tick++) { stepGame(data.state, .25); data.update(); }
    expect(cooldownControl(data.root)).toBe(select);
    expect(select.value).toBe('120');
    expect(document.activeElement).toBe(select);
    checkbox.focus();
    expect(issueCommand(data.state, 0, { type: 'train', id: data.hq.id, role: 'worker' })).toBe(true);
    data.update();
    expect(enableControl(data.root)).toBe(checkbox);
    expect(document.activeElement).toBe(checkbox);
    expect(advice(data.root, 'idle-production')).toBeNull();
  });

  it('preserves focused advice buttons and an uncommitted select value across unchanged observations', () => {
    const data = setup();
    ready(data);
    const show = adviceButton(advice(data.root, 'idle-workers')!, 'Show');
    const select = cooldownControl(data.root);
    select.value = '120';
    show.focus();
    data.update();
    data.update();
    expect(adviceButton(advice(data.root, 'idle-workers')!, 'Show')).toBe(show);
    expect(document.activeElement).toBe(show);
    expect(cooldownControl(data.root)).toBe(select);
    expect(select.value).toBe('120');
    expect(data.coach.getPreferences().cooldownSeconds).toBe(60);
  });

  it.each(['pointerdown', 'pointerup', 'click', 'keydown'] as const)('blocks battlefield %s bubbling without preventing native controls', type => {
    const data = setup();
    const receive = vi.fn();
    document.body.addEventListener(type, receive);
    try {
      const event = type.startsWith('key')
        ? new KeyboardEvent(type, { key: 'Tab', bubbles: true, cancelable: true })
        : new MouseEvent(type, { bubbles: true, cancelable: true });
      cooldownControl(data.root).dispatchEvent(event);
      expect(receive).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    } finally { document.body.removeEventListener(type, receive); }
  });

  it('allows key release to reach battlefield cleanup after focus moves to coach controls', () => {
    const data = setup();
    const held = new Set<string>();
    const press = (event: KeyboardEvent) => held.add(event.code);
    const release = vi.fn((event: KeyboardEvent) => held.delete(event.code));
    window.addEventListener('keydown', press);
    window.addEventListener('keyup', release);
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown' }));
      expect(held.has('ArrowDown')).toBe(true);
      const select = cooldownControl(data.root);
      select.focus();
      const event = new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });
      select.dispatchEvent(event);
      expect(release).toHaveBeenCalledWith(event);
      expect(held.has('ArrowDown')).toBe(false);
      expect(event.defaultPrevented).toBe(false);
      select.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
      expect(held.has('ArrowDown')).toBe(false);
    } finally {
      window.removeEventListener('keydown', press);
      window.removeEventListener('keyup', release);
    }
  });

  it('hides and removes stale focus actions without a view, then resets match dismissal memory', () => {
    const data = setup();
    ready(data);
    const staleShow = adviceButton(advice(data.root, 'idle-production')!, 'Show');
    adviceButton(advice(data.root, 'idle-workers')!, 'Dismiss').click();
    data.coach.update(null);
    expect(host(data.root).hidden).toBe(true);
    staleShow.click();
    expect(data.focus).not.toHaveBeenCalled();
    data.update();
    expect(host(data.root).hidden).toBe(false);
    expect(advice(data.root, 'idle-workers')).not.toBeNull();
  });

  it.each(['ai', 'external'] as const)('hides the host for a %s observation and rejects stale focus actions', controller => {
    const data = setup();
    ready(data);
    const staleShow = adviceButton(advice(data.root, 'idle-workers')!, 'Show');
    data.state.controllers[0] = controller;
    data.update();
    expect(host(data.root).hidden).toBe(true);
    staleShow.click();
    expect(data.focus).not.toHaveBeenCalled();
  });

  it('hides the host for a finished match and rejects stale focus actions', () => {
    const data = setup();
    ready(data);
    const staleShow = adviceButton(advice(data.root, 'idle-workers')!, 'Show');
    data.state.winner = 0;
    data.state.winningTeam = 0;
    data.update();
    expect(host(data.root).hidden).toBe(true);
    staleShow.click();
    expect(data.focus).not.toHaveBeenCalled();
  });

  it('clears dismissal after a simulation rewind or observing a different human side', () => {
    const data = setup();
    ready(data);
    adviceButton(advice(data.root, 'idle-workers')!, 'Dismiss').click();
    const earlier = fixture();
    advance(earlier.state, 30 - .25);
    data.coach.update(earlier.observer.observe(earlier.state));
    stepGame(earlier.state, .25);
    data.coach.update(earlier.observer.observe(earlier.state));
    expect(advice(data.root, 'idle-workers')).not.toBeNull();
    adviceButton(advice(data.root, 'idle-workers')!, 'Dismiss').click();
    const other = fixture('human', 1);
    advance(other.state, 30);
    data.coach.update(other.observer.observe(other.state));
    expect(advice(data.root, 'idle-workers')).not.toBeNull();
    adviceButton(advice(data.root, 'idle-workers')!, 'Show').click();
    expect(data.focus.mock.lastCall![0]).toEqual(other.workers.map(worker => worker.id));
  });

  it('disposes controls and detached listeners and ignores later updates', () => {
    const data = setup(memoryStorage());
    ready(data);
    const show = adviceButton(advice(data.root, 'idle-workers')!, 'Show');
    const checkbox = enableControl(data.root);
    const select = cooldownControl(data.root);
    const preferences = data.coach.getPreferences();
    data.coach.dispose();
    expect(data.root.children).toHaveLength(0);
    show.click();
    checkbox.click();
    select.value = '120';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(data.focus).not.toHaveBeenCalled();
    expect(data.coach.getPreferences()).toEqual(preferences);
    data.update();
    expect(data.root.children).toHaveLength(0);
    expect(() => data.coach.dispose()).not.toThrow();
  });
});
