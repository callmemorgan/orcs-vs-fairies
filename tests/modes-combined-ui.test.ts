// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContentBundle } from '../src/core/content-registry';
import { exampleMod } from '../src/core/example-mod';
import { PlayerView } from '../src/core/observation';
import { canPlace, createMatch, issueCommand, refreshVisibility, stepGame } from '../src/core/simulation';
import type { GameState } from '../src/core/types';
import { MatchRulesForm, definitionName } from '../src/ui/MatchRules';
import { mountObjectivePanel, type ObjectiveView } from '../src/ui/ObjectivePanel';
import { SkirmishRoster } from '../src/ui/SkirmishRoster';

const disposers: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function root() {
  const node = document.createElement('div'); document.body.append(node); return node;
}
function field<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(node: ParentNode, label: string): T {
  const control = node.querySelector<T>(`[aria-label="${label}"]`);
  expect(control, `Missing ${label}`).not.toBeNull(); return control!;
}
function edit(node: ParentNode, label: string, value: string | boolean) {
  const control = field(node, label);
  if (typeof value === 'boolean') control.checked = value; else control.value = value;
  control.dispatchEvent(new Event(control.tagName === 'SELECT' || control.type === 'checkbox' ? 'change' : 'input', { bubbles: true }));
}
function match(mode: 'relic' | 'annihilation' = 'relic', draft = false) {
  return createMatch({
    content: createContentBundle([exampleMod()]), map: { seed: 4127, size: 'small' },
    players: [{ id: 0, teamId: 0, factionId: 'lantern:keepers', controller: 'human' }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }],
    rules: { mode, draft: { enabled: draft, banRounds: 0, pickRounds: 2 } },
  });
}
function buildHall(state: GameState) {
  const worker = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
  const hq = state.entities.find(entity => entity.side === 0 && entity.role === 'hq')!;
  for (let y = Math.floor(hq.y - 7) + .5; y < hq.y + 7; y++) {
    for (let x = Math.floor(hq.x - 7) + .5; x < hq.x + 7; x++) {
      if (!canPlace(state, 0, 'barracks', x, y, 'lantern:hall')) continue;
      expect(issueCommand(state, 0, { type: 'build', ids: [worker.id], role: 'barracks', definitionId: 'lantern:hall', x, y })).toBe(true);
      for (let tick = 0; tick < 700; tick++) stepGame(state, .05);
      const hall = state.entities.find(entity => entity.definitionId === 'lantern:hall')!;
      expect(hall.progress).toBe(1); return hall;
    }
  }
  throw new Error('No valid Lantern Hall location.');
}
function relicFixture() {
  const state = match(), observer = new PlayerView(0), relic = state.objectives.relics[0];
  const unit = state.entities.find(entity => entity.side === 0 && entity.role === 'melee')!;
  unit.x = relic.x; unit.y = relic.y; unit.level = relic.level;
  refreshVisibility(state);
  return { state, observer, unit, relic };
}

describe('content-aware match setup', () => {
  it('shows custom definition names and applies selected exclusions to recruitment and research', () => {
    const node = root(), content = createContentBundle([exampleMod()]);
    const form = new MatchRulesForm(node, { content }); disposers.push(() => form.destroy());
    expect(definitionName('lantern:duelist', content)).toBe('Lantern Duelist');
    expect(definitionName('lantern:bright-blades', content)).toBe('Bright Blades');
    const customUnit = field(node, 'Disable Lantern Keepers Lantern Duelist');
    const customTechnology = field(node, 'Disable Lantern Keepers Bright Blades');
    expect(customUnit.dataset.disabledDefinition).toBe('lantern:duelist');
    expect(customTechnology.dataset.disabledDefinition).toBe('lantern:bright-blades');
    expect(node.querySelectorAll('[data-disabled-definition="worker-speed"]')).toHaveLength(1);
    expect(node.querySelector('[data-disabled-definition="lantern:hall"]')).toBeNull();
    edit(node, 'Disable Lantern Keepers Lantern Duelist', true);
    edit(node, 'Disable Lantern Keepers Bright Blades', true);
    const rules = form.value;
    expect(rules.disabledDefinitionIds).toEqual(['lantern:bright-blades', 'lantern:duelist']);
    const state = createMatch({ content, map: { seed: 4127, size: 'small' }, players: [{ id: 0, teamId: 0, factionId: 'lantern:keepers', controller: 'human' }, { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }], rules });
    const hall = buildHall(state);
    const bank = [state.players[0].wood, state.players[0].ore];
    expect(issueCommand(state, 0, { type: 'train', id: hall.id, role: 'melee', definitionId: 'lantern:duelist' })).toBe(false);
    expect(issueCommand(state, 0, { type: 'research', id: hall.id, upgrade: 'lantern:bright-blades' })).toBe(false);
    expect([state.players[0].wood, state.players[0].ore]).toEqual(bank);
    expect(issueCommand(state, 0, { type: 'train', id: hall.id, role: 'melee', definitionId: 'lantern:sentinel' })).toBe(true);
    expect(hall.queueDefinitionIds).toEqual(['lantern:sentinel']);
  });

  it('adds content choices to an existing form while preserving rules and built-in exclusions', () => {
    const node = root(), form = new MatchRulesForm(node); disposers.push(() => form.destroy());
    edit(node, 'Victory mode', 'hill'); edit(node, 'Hill hold seconds', '50.05');
    const speed = node.querySelector<HTMLInputElement>('[data-disabled-definition="worker-speed"]')!;
    speed.checked = true; speed.dispatchEvent(new Event('change', { bubbles: true }));
    form.setContent(createContentBundle([exampleMod()]));
    expect(form.value).toMatchObject({ mode: 'hill', hill: { holdTicks: 1001 }, disabledDefinitionIds: ['worker-speed'] });
    expect(node.querySelectorAll('[data-disabled-definition="lantern:duelist"]')).toHaveLength(1);
    expect(node.querySelector<HTMLInputElement>('[data-disabled-definition="worker-speed"]')!.checked).toBe(true);
    edit(node, 'Disable Lantern Keepers Lantern Sentinel', true);
    expect(form.value.disabledDefinitionIds).toEqual(['lantern:sentinel', 'worker-speed']);
  });

  it('uses custom factions in existing and newly added roster slots and creates their configured match', () => {
    const node = root(), roster = new SkirmishRoster(node), content = createContentBundle([exampleMod()]);
    disposers.push(() => roster.destroy()); roster.setContent(content); roster.updateDefaults('lantern:keepers', 'orcs');
    edit(node, 'Enable team match setup', true); edit(node, 'Match preset', '2v2');
    const faction = field<HTMLSelectElement>(node, 'Player 3 faction');
    expect(Array.from(faction.options).filter(option => option.value === 'lantern:keepers').map(option => option.textContent)).toEqual(['Lantern Keepers']);
    edit(node, 'Player 3 faction', 'lantern:keepers'); edit(node, 'Player 4 faction', 'fairies');
    edit(node, 'Disable Lantern Keepers Lantern Duelist', true);
    const players = roster.getPlayers('lantern:keepers', 'orcs');
    expect(players.map(player => player.factionId)).toEqual(['lantern:keepers', 'orcs', 'lantern:keepers', 'fairies']);
    const state = createMatch({ content, map: { seed: 4127, size: 'small' }, players, rules: roster.getRules() });
    expect(state.content?.hash).toBe(content.hash);
    expect(state.players.map(player => player.faction)).toEqual(players.map(player => player.factionId));
    expect(state.entities.filter(entity => entity.role === 'melee' && [0, 2].includes(entity.side)).map(entity => entity.definitionId)).toEqual(['lantern:sentinel', 'lantern:sentinel']);
    expect(state.rules.disabledDefinitionIds).toEqual(['lantern:duelist']);
  });
});

describe('toolbar objective controls', () => {
  it('reports each visibility transition once and focuses the close control before restoring the opener', () => {
    const node = root(), toolbar = root(), { state, observer } = relicFixture(), onVisibility = vi.fn();
    const panel = mountObjectivePanel(node, { toolbar, getState: () => state, getObservation: () => observer.observe(state), side: 0, submit: vi.fn(), onVisibility }); disposers.push(() => panel.dispose());
    const launch = toolbar.querySelector<HTMLButtonElement>('[data-objective-tool]')!;
    const close = node.querySelector<HTMLButtonElement>('.objective-panel-close')!;
    expect(onVisibility).not.toHaveBeenCalled();
    launch.focus(); launch.click(); expect(document.activeElement).toBe(close);
    expect(onVisibility.mock.calls).toEqual([[true]]);
    panel.update(); expect(onVisibility.mock.calls).toEqual([[true]]);
    close.click(); expect(document.activeElement).toBe(launch);
    panel.close(); expect(onVisibility.mock.calls).toEqual([[true], [false]]);
    launch.click(); expect(onVisibility.mock.calls).toEqual([[true], [false], [true]]);
    panel.dispose(); expect(document.activeElement).not.toBe(close);
    expect(onVisibility.mock.calls).toEqual([[true], [false], [true], [false]]);
    panel.dispose(); expect(onVisibility).toHaveBeenCalledTimes(4);
  });

  it('closes when blocked, preserves another modal focus, and denies reopening until the blocker clears', () => {
    const node = root(), toolbar = root(), { state, observer } = relicFixture(), onVisibility = vi.fn();
    const otherModalControl = document.createElement('button'); document.body.append(otherModalControl);
    let blocked = false;
    const panel = mountObjectivePanel(node, { toolbar, getState: () => state, getObservation: () => observer.observe(state), side: 0, submit: vi.fn(), onVisibility, blocked: () => blocked }); disposers.push(() => panel.dispose());
    const launch = toolbar.querySelector<HTMLButtonElement>('[data-objective-tool]')!;
    const overlay = node.querySelector<HTMLElement>('.objective-overlay')!;
    launch.focus(); launch.click(); expect(overlay.hidden).toBe(false);
    otherModalControl.focus(); blocked = true; panel.update();
    expect(overlay.hidden).toBe(true); expect(launch.disabled).toBe(true); expect(document.activeElement).toBe(otherModalControl);
    launch.dispatchEvent(new MouseEvent('click', { bubbles: true })); panel.update();
    expect(overlay.hidden).toBe(true); expect(onVisibility.mock.calls).toEqual([[true], [false]]);
    blocked = false; panel.update(); expect(launch.disabled).toBe(false); expect(overlay.hidden).toBe(true);
    launch.focus(); launch.click(); expect(overlay.hidden).toBe(false);
    expect(onVisibility.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('wraps Tab and Shift+Tab within the dialog while skipping disabled draft choices', () => {
    const node = root(), toolbar = root(), state = match('annihilation', true), observer = new PlayerView(0);
    let canSubmit = false;
    const panel = mountObjectivePanel(node, { toolbar, getState: () => state, getObservation: () => observer.observe(state), side: 0, submit: vi.fn(), canSubmit: () => canSubmit }); disposers.push(() => panel.dispose());
    toolbar.querySelector<HTMLButtonElement>('[data-objective-tool]')!.click();
    const close = node.querySelector<HTMLButtonElement>('.objective-panel-close')!;
    expect(document.activeElement).toBe(close);
    expect(Array.from(node.querySelectorAll<HTMLButtonElement>('[data-draft-choice]')).every(button => button.disabled)).toBe(true);
    for (const shiftKey of [false, true]) {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      close.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(document.activeElement).toBe(close);
    }
    canSubmit = true; panel.update();
    const enabled = Array.from(node.querySelectorAll<HTMLButtonElement>('[data-draft-choice]')).filter(button => !button.disabled);
    expect(enabled.length).toBeGreaterThan(0);
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    close.dispatchEvent(backward); expect(backward.defaultPrevented).toBe(true); expect(document.activeElement).toBe(enabled.at(-1));
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    enabled.at(-1)!.dispatchEvent(forward); expect(forward.defaultPrevented).toBe(true); expect(document.activeElement).toBe(close);
  });

  it('captures Escape without reaching battlefield listeners and restores the previous focus', () => {
    const node = root(), toolbar = root(), { state, observer } = relicFixture(), battlefieldKey = vi.fn(), onVisibility = vi.fn();
    window.addEventListener('keydown', battlefieldKey);
    disposers.push(() => window.removeEventListener('keydown', battlefieldKey));
    const panel = mountObjectivePanel(node, { toolbar, getState: () => state, getObservation: () => observer.observe(state), side: 0, submit: vi.fn(), onVisibility }); disposers.push(() => panel.dispose());
    const launch = toolbar.querySelector<HTMLButtonElement>('[data-objective-tool]')!;
    launch.focus(); launch.click();
    const close = node.querySelector<HTMLButtonElement>('.objective-panel-close')!;
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    close.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true); expect(battlefieldKey).not.toHaveBeenCalled();
    expect(node.querySelector<HTMLElement>('.objective-overlay')!.hidden).toBe(true); expect(document.activeElement).toBe(launch);
    expect(onVisibility.mock.calls).toEqual([[true], [false]]);
    panel.dispose();
    const afterDispose = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    node.dispatchEvent(afterDispose); expect(afterDispose.defaultPrevented).toBe(false); expect(battlefieldKey).toHaveBeenCalledOnce();
  });

  it('returns escaped focus to the first or last dialog control on Tab or Shift+Tab', () => {
    const node = root(), toolbar = root(), { state, observer } = relicFixture();
    const outside = document.createElement('button'); document.body.append(outside);
    const panel = mountObjectivePanel(node, { toolbar, getState: () => state, getObservation: () => observer.observe(state), side: 0, submit: vi.fn() }); disposers.push(() => panel.dispose());
    toolbar.querySelector<HTMLButtonElement>('[data-objective-tool]')!.click();
    const controls = Array.from(node.querySelectorAll<HTMLButtonElement>('.objective-panel button:not(:disabled)')).filter(button => !button.closest('[hidden]'));
    expect(controls.length).toBeGreaterThan(1);
    outside.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    outside.dispatchEvent(forward); expect(forward.defaultPrevented).toBe(true); expect(document.activeElement).toBe(controls[0]);
    outside.focus();
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    outside.dispatchEvent(backward); expect(backward.defaultPrevented).toBe(true); expect(document.activeElement).toBe(controls.at(-1));
  });

  it('opens and closes from the toolbar, hides when observations disappear, and removes its controls on disposal', () => {
    const node = root(), toolbar = root(), { state, observer } = relicFixture();
    let received: ObjectiveView | null = observer.observe(state);
    const panel = mountObjectivePanel(node, { toolbar, getState: () => state, getObservation: () => received, side: 0, submit: vi.fn() }); disposers.push(() => panel.dispose());
    const launch = toolbar.querySelector<HTMLButtonElement>('[data-objective-tool="progress"]')!;
    const overlay = node.querySelector<HTMLElement>('.objective-overlay')!;
    expect(overlay.hidden).toBe(true); expect(launch.getAttribute('aria-expanded')).toBe('false');
    launch.click(); expect(overlay.hidden).toBe(false); expect(launch.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(launch.getAttribute('aria-controls')!)).toBe(node.querySelector('.objective-panel'));
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true })); expect(overlay.hidden).toBe(true);
    launch.click(); panel.close(); expect(launch.getAttribute('aria-expanded')).toBe('false');
    launch.click(); received = null; panel.update(); expect(overlay.hidden).toBe(true); expect(launch.hidden).toBe(true);
    panel.dispose(); expect(toolbar.querySelector('[data-objective-tool]')).toBeNull(); expect(node.querySelector('.objective-overlay')).toBeNull();
  });

  it.each(['paused', 'readOnly'] as const)('keeps progress available while %s prevents relic and draft commands, including clicks before repaint', async reason => {
    const node = root(), toolbar = root(), { state, observer, unit, relic } = relicFixture();
    const guards = { paused: false, readOnly: false }, submit = vi.fn();
    const options = { toolbar, getState: () => state, getObservation: () => observer.observe(state), side: 0 as const, submit, canSubmit: () => !guards.paused && !guards.readOnly };
    const panel = mountObjectivePanel(node, options); disposers.push(() => panel.dispose());
    toolbar.querySelector<HTMLButtonElement>('[data-objective-tool]')!.click();
    const collect = node.querySelector<HTMLButtonElement>('[aria-label="Collect relic 1"]')!; expect(collect.disabled).toBe(false);
    guards[reason] = true; collect.dispatchEvent(new MouseEvent('click', { bubbles: true })); await Promise.resolve(); expect(submit).not.toHaveBeenCalled();
    panel.update(); expect(collect.disabled).toBe(true); expect(node.querySelector<HTMLProgressElement>('progress')!.hidden).toBe(false);
    guards[reason] = false; relic.carrierId = unit.id; panel.update();
    const drop = node.querySelector<HTMLButtonElement>('[aria-label="Drop relic 1"]')!; expect(drop.disabled).toBe(false);
    guards[reason] = true; drop.dispatchEvent(new MouseEvent('click', { bubbles: true })); await Promise.resolve(); expect(submit).not.toHaveBeenCalled();
    panel.update(); expect(drop.disabled).toBe(true); panel.dispose();
    const drafting = match('annihilation', true), draftObserver = new PlayerView(0);
    guards[reason] = false;
    const draftPanel = mountObjectivePanel(node, { toolbar, getState: () => drafting, getObservation: () => draftObserver.observe(drafting), side: 0, submit, canSubmit: () => !guards.paused && !guards.readOnly }); disposers.push(() => draftPanel.dispose());
    const pick = node.querySelector<HTMLButtonElement>('[data-draft-choice]')!; expect(pick.disabled).toBe(false);
    guards[reason] = true; pick.dispatchEvent(new MouseEvent('click', { bubbles: true })); await Promise.resolve(); expect(submit).not.toHaveBeenCalled();
    draftPanel.update(); expect(Array.from(node.querySelectorAll<HTMLButtonElement>('[data-draft-choice]')).every(button => button.disabled)).toBe(true);
  });

  it('collects with an eligible observed unit instead of using a nearer unit from raw state', async () => {
    const node = root(), { state, observer, unit, relic } = relicFixture();
    const observedWorker = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
    observedWorker.x = relic.x + .3; observedWorker.y = relic.y; observedWorker.level = relic.level; refreshVisibility(state);
    const received = observer.observe(state); received.entities = received.entities.filter(entity => entity.id !== unit.id);
    const submit = vi.fn(command => issueCommand(state, 0, command));
    const panel = mountObjectivePanel(node, { getState: () => state, getObservation: () => received, side: 0, submit }); disposers.push(() => panel.dispose());
    node.querySelector<HTMLButtonElement>('[aria-label="Collect relic 1"]')!.click();
    await vi.waitFor(() => expect(relic.carrierId).toBe(observedWorker.id));
    expect(submit).toHaveBeenCalledWith({ type: 'collectRelic', id: observedWorker.id, relicId: relic.id });
  });

  it('opens an observation-only active draft and displays only permitted choices with received custom names', () => {
    const node = root(), toolbar = root(), state = match('annihilation', true);
    const received = new PlayerView(0).observe(state);
    expect(received.draftChoices).toContain('lantern:duelist');
    received.draftChoices = ['lantern:duelist'];
    const panel = mountObjectivePanel(node, { toolbar, getState: () => undefined, getObservation: () => received, side: 0, submit: vi.fn() }); disposers.push(() => panel.dispose());
    expect(node.querySelector<HTMLElement>('.objective-overlay')!.hidden).toBe(false);
    expect(document.activeElement).toBe(node.querySelector('.objective-panel-close'));
    const choices = Array.from(node.querySelectorAll<HTMLButtonElement>('[data-draft-choice]'));
    expect(choices.map(button => button.dataset.draftChoice)).toEqual(['lantern:duelist']);
    expect(choices[0].textContent).toBe('Lantern Duelist');
  });

  it('keeps an active replay draft closed until opened for inspection and disables its choices', () => {
    const node = root(), toolbar = root(), state = match('annihilation', true);
    const received = new PlayerView(0).observe(state), submit = vi.fn();
    const panel = mountObjectivePanel(node, { toolbar, getState: () => state, getObservation: () => received, side: 0, submit, canSubmit: () => false }); disposers.push(() => panel.dispose());
    const overlay = node.querySelector<HTMLElement>('.objective-overlay')!;
    const launch = toolbar.querySelector<HTMLButtonElement>('[data-objective-tool="progress"]')!;
    expect(received.draft.status).toBe('drafting'); expect(overlay.hidden).toBe(true);
    expect(launch.hidden).toBe(false); expect(launch.getAttribute('aria-expanded')).toBe('false');
    launch.click(); expect(overlay.hidden).toBe(false); expect(launch.getAttribute('aria-expanded')).toBe('true');
    expect(node.querySelector('.match-draft-status')!.textContent).toContain('Player 1 picks');
    const choices = Array.from(node.querySelectorAll<HTMLButtonElement>('[data-draft-choice]'));
    expect(choices.length).toBeGreaterThan(0); expect(choices.every(button => button.disabled)).toBe(true);
    choices[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); expect(submit).not.toHaveBeenCalled();
    panel.update(); expect(overlay.hidden).toBe(false);
  });

  it('rejects a stale relic button after the latest observation moves its chosen unit out of range', async () => {
    const node = root(), { state, observer, unit, relic } = relicFixture();
    const worker = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
    worker.x = relic.x + .3; worker.y = relic.y; worker.level = relic.level; refreshVisibility(state);
    let received = observer.observe(state);
    const submit = vi.fn(command => issueCommand(state, 0, command));
    const panel = mountObjectivePanel(node, { getState: () => state, getObservation: () => received, side: 0, submit }); disposers.push(() => panel.dispose());
    const collect = node.querySelector<HTMLButtonElement>('[aria-label="Collect relic 1"]')!; expect(collect.title).toContain(`Unit ${unit.id}`);
    unit.x = relic.x + 4; received = observer.observe(state);
    collect.click(); await Promise.resolve(); expect(submit).not.toHaveBeenCalled(); expect(relic.carrierId).toBeNull();
    panel.update(); expect(collect.title).toContain(`Unit ${worker.id}`); collect.click();
    await vi.waitFor(() => expect(relic.carrierId).toBe(worker.id));
    expect(submit).toHaveBeenCalledWith({ type: 'collectRelic', id: worker.id, relicId: relic.id });
  });
});
