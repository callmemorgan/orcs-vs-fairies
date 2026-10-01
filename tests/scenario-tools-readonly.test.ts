// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureScenario, createScenario, stepScenario } from '../src/core/scenarios';
import type { ScenarioDefinition, ScenarioSession } from '../src/core/scenario-types';
import { CAMPAIGNS, SCENARIOS } from '../src/scenarios/campaigns';
import { ScenarioTools, type CampaignProgressView, type ScenarioToolsCallbacks } from '../src/ui/ScenarioTools';

const mounted: ScenarioTools[] = [];
const legacyReason = 'This legacy campaign has no verified command recording. Start a new campaign to continue.';

afterEach(() => {
  for (const tools of mounted.splice(0)) tools.destroy();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function button(root: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(control => control.textContent === label);
  expect(found, `Missing button ${label}`).toBeDefined();
  return found!;
}

function visibleText(root: HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const text: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.parentElement?.closest('[hidden]')) text.push(node.textContent ?? '');
  }
  return text.join(' ');
}

function completedMission(): ScenarioSession {
  const definition: ScenarioDefinition = {
    schemaVersion: 1, id: 'readonly-mission', title: 'Recorded watch',
    briefing: 'Keep the commander standing while the watch ends.',
    successText: 'The watch is complete.', failureText: 'The commander was lost.',
    faction: 'orcs', opponent: 'fairies', seed: 21,
    map: {
      size: 'small', width: 36, height: 36,
      terrain: Array.from({ length: 36 * 36 }, (_, index) => index % 36 === 0 || index % 36 === 35 || index < 36 || index >= 36 * 35 ? 'rock' : 'grass'),
      starts: [{ x: 4, y: 4 }, { x: 31, y: 31 }], resources: [],
    },
    army: [
      { label: 'commander', side: 0, kind: 'unit', role: 'special', x: 8, y: 8, order: { type: 'hold' } },
      { label: 'guard', side: 1, kind: 'unit', role: 'melee', x: 28, y: 28, order: { type: 'hold' } },
    ],
    objectives: [{ id: 'watch', text: 'Finish the watch.', success: { type: 'time', seconds: .1 }, failure: { type: 'dead', actor: 'commander' } }],
    events: [], rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 30 },
  };
  const session = createScenario(definition);
  for (let tick = 0; tick < 4 && session.runtime.outcome === 'playing'; tick++) stepScenario(session);
  expect(session.runtime.outcome).toBe('won');
  return session;
}

function progress(chapter = 1): CampaignProgressView {
  return { campaignId: 'campaign-orcs', chapter, completed: ['orcs-1'], finished: false };
}

function setup(session: ScenarioSession | null, reason: string | null = null, campaignProgress: CampaignProgressView | null = progress(), includeReadOnlyReason = true) {
  const state = { session, reason, campaignProgress };
  const root = document.createElement('div');
  document.body.append(root);
  const callbacks = {
    session: () => state.session,
    readOnlyReason: () => state.reason,
    start: vi.fn<ScenarioToolsCallbacks['start']>(),
    reset: vi.fn<ScenarioToolsCallbacks['reset']>(),
    select: vi.fn<ScenarioToolsCallbacks['select']>(),
    center: vi.fn<ScenarioToolsCallbacks['center']>(),
    notice: vi.fn<NonNullable<ScenarioToolsCallbacks['notice']>>(),
    campaign: {
      progress: () => state.campaignProgress,
      start: vi.fn<(campaignId: string) => void>(),
      continue: vi.fn<() => void>(),
      choose: vi.fn<(choiceId: string) => void>(),
    },
  } satisfies ScenarioToolsCallbacks;
  const activeCallbacks: ScenarioToolsCallbacks = { ...callbacks };
  if (!includeReadOnlyReason) delete activeCallbacks.readOnlyReason;
  const tools = new ScenarioTools(root, activeCallbacks, { campaigns: { ...CAMPAIGNS }, scenarios: { ...SCENARIOS } });
  mounted.push(tools);
  return { root, callbacks, tools, state };
}

describe('read-only scenario controls', () => {
  it('displays the legacy reason without a battlefield and keeps new campaigns and practice missions available', () => {
    const { root, callbacks } = setup(null, legacyReason);
    expect(visibleText(root)).toContain(legacyReason);
    expect(root.querySelector<HTMLElement>('.scenario-controls')!.hidden).toBe(true);
    expect(root.querySelectorAll('[data-choice]')).toHaveLength(0);
    expect(button(root, 'Continue campaign').hidden).toBe(true);

    const campaigns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-campaign]'));
    expect(campaigns).toHaveLength(Object.keys(CAMPAIGNS).length);
    for (const control of campaigns) expect(control.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-campaign="campaign-orcs"]')!.click();
    expect(callbacks.campaign.start).toHaveBeenCalledExactlyOnceWith('campaign-orcs');

    const select = root.querySelector<HTMLSelectElement>('[aria-label="Practice mission"]')!;
    expect(select.disabled).toBe(false);
    expect(select.options).toHaveLength(Object.keys(SCENARIOS).length);
    select.value = 'dwarves-1';
    expect(button(root, 'Launch practice mission').disabled).toBe(false);
    button(root, 'Launch practice mission').click();
    expect(callbacks.start).toHaveBeenCalledOnce();
    expect(callbacks.start.mock.calls[0][0].definition.id).toBe('dwarves-1');
    expect(callbacks.start.mock.calls[0][0].runtime.outcome).toBe('playing');
  });

  it('labels a read-only win as a recorded victory and blocks reset and continuation while preserving inspection and save', async () => {
    vi.useFakeTimers();
    const session = completedMission();
    const before = captureScenario(session);
    const { root, callbacks, tools } = setup(session, legacyReason);
    expect(root.querySelector('[role="status"]')!.textContent).toMatch(/recorded victory/i);
    expect(visibleText(root)).toContain(legacyReason);
    expect(root.querySelector('[aria-label="Mission objectives"]')!.textContent).toContain('Recorded complete: Finish the watch.');

    for (const label of ['Reset mission', 'Continue campaign']) {
      const control = button(root, label);
      expect(control.disabled, label).toBe(true);
      control.click();
    }
    expect(button(root, 'Continue campaign').hidden).toBe(false);
    expect(callbacks.reset).not.toHaveBeenCalled();
    expect(callbacks.campaign.continue).not.toHaveBeenCalled();

    expect(button(root, 'Select mission army').disabled).toBe(false);
    button(root, 'Select mission army').click();
    expect(callbacks.select).toHaveBeenCalledExactlyOnceWith([session.runtime.labels.commander]);
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:readonly-checkpoint');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const downloads: Array<{ name: string; href: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, href: this.href });
    });
    expect(button(root, 'Save mission').disabled).toBe(false);
    button(root, 'Save mission').click();
    expect(createUrl).toHaveBeenCalledOnce();
    const blob = createUrl.mock.calls[0][0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(before);
    expect(downloads).toEqual([{ name: 'readonly-mission-checkpoint.json', href: 'blob:readonly-checkpoint' }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:readonly-checkpoint');

    expect(root.querySelector<HTMLInputElement>('[aria-label="Import mission checkpoint"]')!.disabled).toBe(false);
    expect(button(root, 'Launch practice mission').disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-campaign="campaign-orcs"]')!.disabled).toBe(false);
    tools.update();
    expect(captureScenario(session)).toEqual(before);
  });

  it('shows both authored campaign branches but prevents either read-only choice callback', () => {
    const session = completedMission();
    const before = captureScenario(session);
    const { root, callbacks } = setup(session, legacyReason, progress(2));
    expect(visibleText(root)).toContain(CAMPAIGNS['campaign-orcs'].choice.prompt);
    const choices = root.querySelectorAll<HTMLButtonElement>('[data-choice]');
    expect(choices).toHaveLength(2);
    for (const choice of CAMPAIGNS['campaign-orcs'].choice.options) {
      const control = root.querySelector<HTMLButtonElement>(`[data-choice="${choice.id}"]`)!;
      expect(control.textContent).toBe(choice.text);
      expect(control.disabled).toBe(true);
      control.click();
    }
    expect(callbacks.campaign.choose).not.toHaveBeenCalled();
    expect(button(root, 'Continue campaign').hidden).toBe(true);
    expect(captureScenario(session)).toEqual(before);
  });

  it.each([1, 2])('keeps the existing editable campaign actions when the reason is null in chapter %s', chapter => {
    const { root, callbacks, tools } = setup(completedMission(), null, progress(chapter));
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Mission complete');
    expect(root.querySelector('[role="status"]')!.textContent).not.toMatch(/recorded victory/i);
    expect(button(root, 'Reset mission').disabled).toBe(false);
    button(root, 'Reset mission').click();
    expect(callbacks.reset).toHaveBeenCalledOnce();
    tools.update();
    if (chapter === 1) {
      const continuation = button(root, 'Continue campaign');
      expect(continuation.hidden).toBe(false);
      expect(continuation.disabled).toBe(false);
      continuation.click();
      expect(callbacks.campaign.continue).toHaveBeenCalledOnce();
    } else {
      expect(button(root, 'Continue campaign').hidden).toBe(true);
      for (const choice of CAMPAIGNS['campaign-orcs'].choice.options) {
        const control = root.querySelector<HTMLButtonElement>(`[data-choice="${choice.id}"]`)!;
        expect(control.disabled).toBe(false);
        control.click();
      }
      expect(callbacks.campaign.choose.mock.calls).toEqual(CAMPAIGNS['campaign-orcs'].choice.options.map(choice => [choice.id]));
    }
  });

  it('keeps existing callers editable when they omit the optional read-only callback', () => {
    const { root, callbacks } = setup(completedMission(), legacyReason, progress(), false);
    expect(visibleText(root)).not.toContain(legacyReason);
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Mission complete');
    for (const label of ['Reset mission', 'Continue campaign']) {
      expect(button(root, label).disabled).toBe(false);
      button(root, label).click();
    }
    expect(callbacks.reset).toHaveBeenCalledOnce();
    expect(callbacks.campaign.continue).toHaveBeenCalledOnce();
  });

  it.each(['Reset mission', 'Continue campaign', 'branch'] as const)('checks the latest reason before an already rendered %s action', action => {
    const session = completedMission();
    const before = captureScenario(session);
    const { root, callbacks, state } = setup(session, null, progress(action === 'branch' ? 2 : 1));
    const label = action === 'branch' ? CAMPAIGNS['campaign-orcs'].choice.options[0].text : action;
    const control = button(root, label);
    expect(control.disabled).toBe(false);
    state.reason = legacyReason;
    control.click();
    expect(callbacks.reset).not.toHaveBeenCalled();
    expect(callbacks.campaign.continue).not.toHaveBeenCalled();
    expect(callbacks.campaign.choose).not.toHaveBeenCalled();
    expect(visibleText(root)).toContain(legacyReason);
    expect(button(root, label).disabled).toBe(true);
    expect(captureScenario(session)).toEqual(before);
  });

  it('refreshes status and mutating controls when only the read-only reason changes', () => {
    const session = completedMission();
    const before = captureScenario(session);
    const { root, callbacks, tools, state } = setup(session);
    const nextReason = 'This imported result is available for inspection.';
    expect(button(root, 'Reset mission').disabled).toBe(false);
    state.reason = legacyReason;
    tools.update();
    expect(visibleText(root)).toContain(legacyReason);
    expect(root.querySelector('[role="status"]')!.textContent).toMatch(/recorded victory/i);
    expect(button(root, 'Reset mission').disabled).toBe(true);
    expect(button(root, 'Continue campaign').disabled).toBe(true);
    button(root, 'Reset mission').click();
    button(root, 'Continue campaign').click();
    expect(callbacks.reset).not.toHaveBeenCalled();
    expect(callbacks.campaign.continue).not.toHaveBeenCalled();

    state.reason = nextReason;
    tools.update();
    expect(visibleText(root)).toContain(nextReason);
    expect(visibleText(root)).not.toContain(legacyReason);
    state.reason = null;
    tools.update();
    expect(visibleText(root)).not.toContain(nextReason);
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Mission complete');
    expect(button(root, 'Reset mission').disabled).toBe(false);
    expect(button(root, 'Continue campaign').disabled).toBe(false);
    expect(button(root, 'Continue campaign').hidden).toBe(false);
    expect(captureScenario(session)).toEqual(before);
  });

  it('refreshes an empty campaign notice when its reason is added, changed and removed', () => {
    const { root, tools, state } = setup(null);
    expect(visibleText(root)).toContain('Choose a campaign or launch a practice mission.');
    state.reason = legacyReason;
    tools.update();
    expect(visibleText(root)).toContain(legacyReason);
    state.reason = 'Only the campaign summary was preserved.';
    tools.update();
    expect(visibleText(root)).toContain(state.reason);
    expect(visibleText(root)).not.toContain(legacyReason);
    state.reason = null;
    tools.update();
    expect(visibleText(root)).not.toContain('Only the campaign summary was preserved.');
    expect(visibleText(root)).toContain('Choose a campaign or launch a practice mission.');
  });
});
