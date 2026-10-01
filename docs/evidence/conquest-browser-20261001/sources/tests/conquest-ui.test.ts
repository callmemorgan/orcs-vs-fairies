// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConquestProfile, prepareConquestBattle, proposeConquest } from '../src/core/conquest';
import type { ConquestProfile } from '../src/core/conquest-types';
import { ConquestTools, type ConquestToolsCallbacks } from '../src/ui/ConquestTools';

const mounted: ConquestTools[] = [];
afterEach(() => {
  for (const tools of mounted.splice(0)) tools.destroy();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function button(root: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(control => control.textContent === label);
  expect(found, `Missing button ${label}`).toBeDefined();
  return found!;
}

function field<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(root: ParentNode, label: string): T {
  const found = root.querySelector<T>(`[aria-label="${label}"]`);
  expect(found, `Missing input ${label}`).not.toBeNull();
  return found!;
}

function setInput(control: HTMLInputElement | HTMLSelectElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function setup(profile: ConquestProfile | null = createConquestProfile('orcs', 'conquest-ui')) {
  const root = document.createElement('div');
  document.body.append(root);
  const callbacks = {
    profile: () => profile,
    start: vi.fn<ConquestToolsCallbacks['start']>(),
    battle: vi.fn<ConquestToolsCallbacks['battle']>(),
    proposal: vi.fn<ConquestToolsCallbacks['proposal']>(),
    wait: vi.fn<ConquestToolsCallbacks['wait']>(),
    resume: vi.fn<ConquestToolsCallbacks['resume']>(),
    hasSave: () => true,
    save: vi.fn<NonNullable<ConquestToolsCallbacks['save']>>(),
    import: vi.fn<NonNullable<ConquestToolsCallbacks['import']>>(),
    notice: vi.fn<NonNullable<ConquestToolsCallbacks['notice']>>(),
  } satisfies ConquestToolsCallbacks;
  const tools = new ConquestTools(root, callbacks);
  mounted.push(tools);
  return { root, callbacks, tools, profile };
}

function chooseFile(root: ParentNode, file: File): void {
  const input = field(root, 'Import realm profile');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('conquest decision controls', () => {
  it('shows connected roads, ownership, garrisons and supplies, and only submits reachable attacks', () => {
    const { root, profile, callbacks, tools } = setup();
    const before = structuredClone(profile);
    const grove = root.querySelector<HTMLElement>('[data-region="grove"]')!;
    expect(root.querySelectorAll('[data-region]')).toHaveLength(7);
    expect(grove.textContent).toContain('fairies');
    expect(grove.textContent).toContain('garrison 3');
    expect(grove.textContent).toContain('Supply: 190 wood · 20 ore · 18 crystal');
    expect(grove.textContent).toContain('Roads: Hearth Valley, Brass Crossroads');
    expect(button(root, 'Attack: Ashwing Grove').disabled).toBe(false);
    expect(button(root, 'Attack: Deep Gate Quarry').disabled).toBe(false);
    expect(button(root, 'Attack: Brass Crossroads').disabled).toBe(true);
    expect(button(root, "Attack: The Regent's Keep").disabled).toBe(true);
    button(root, 'Attack: Brass Crossroads').click();
    button(root, 'Attack: Ashwing Grove').click();
    expect(callbacks.battle).toHaveBeenCalledExactlyOnceWith('grove', 'attack');
    tools.update();
    expect(profile).toEqual(before);
  });

  it('offers protected passage and permits an attack through a real negotiated truce route', () => {
    let profile = createConquestProfile('orcs', 'conquest-ui-truce');
    profile = proposeConquest(profile, { type: 'tribute', faction: 'fairies', amount: 100 });
    profile = proposeConquest(profile, { type: 'truce', faction: 'fairies', turns: 2 });
    const before = structuredClone(profile);
    const { root, callbacks } = setup(profile);
    const grove = root.querySelector<HTMLElement>('[data-region="grove"]')!;
    expect(grove.textContent).toContain('truce passage');
    expect(grove.querySelector('button')!.textContent).toBe('Passage: Ashwing Grove');
    expect(button(root, 'Passage: Ashwing Grove').disabled).toBe(false);
    expect(button(root, 'Attack: Brass Crossroads').disabled).toBe(false);
    expect(button(root, "Attack: The Regent's Keep").disabled).toBe(true);
    button(root, 'Passage: Ashwing Grove').click();
    button(root, 'Attack: Brass Crossroads').click();
    expect(callbacks.battle.mock.calls).toEqual([['grove', 'passage'], ['crossroads', 'attack']]);
    expect(profile).toEqual(before);
  });

  it('validates proposal inputs and sends decisions to the host without modifying the realm', () => {
    const profile = proposeConquest(createConquestProfile('orcs', 'conquest-ui-diplomacy'), { type: 'tribute', faction: 'fairies', amount: 250 });
    const before = structuredClone(profile);
    const { root, callbacks } = setup(profile);
    setInput(field<HTMLSelectElement>(root, 'Foreign faction'), 'fairies');
    expect(root.textContent).toContain('relations 50');
    expect(root.textContent).toContain('Foreign treasury: 150 wood · 350 ore · 20 crystal');
    expect(root.textContent).toContain('Treasury: 500 wood · 100 ore · 100 crystal');
    for (const invalid of ['24', '101', '25.5', '']) {
      setInput(field(root, 'Tribute ore'), invalid);
      expect(button(root, 'Offer tribute').disabled, invalid).toBe(true);
      button(root, 'Offer tribute').click();
    }
    expect(callbacks.proposal).not.toHaveBeenCalled();
    setInput(field(root, 'Tribute ore'), '75');
    setInput(field(root, 'Truce turns'), '9');
    expect(button(root, 'Request truce').disabled).toBe(true);
    setInput(field(root, 'Truce turns'), '4');
    button(root, 'Offer tribute').click();
    button(root, 'Request truce').click();
    button(root, 'Request alliance').click();
    button(root, 'Wait one turn').click();
    button(root, 'Export realm profile').click();
    button(root, 'Resume saved realm').click();
    setInput(field<HTMLSelectElement>(root, 'Conquest faction'), 'dwarves');
    button(root, 'Create realm').click();
    expect(callbacks.proposal.mock.calls).toEqual([
      [{ type: 'tribute', faction: 'fairies', amount: 75 }],
      [{ type: 'truce', faction: 'fairies', turns: 4 }],
      [{ type: 'alliance', faction: 'fairies' }],
    ]);
    expect(callbacks.wait).toHaveBeenCalledOnce();
    expect(callbacks.save).toHaveBeenCalledOnce();
    expect(callbacks.resume).toHaveBeenCalledOnce();
    expect(callbacks.start).toHaveBeenCalledExactlyOnceWith('dwarves');
    expect(profile).toEqual(before);
  });

  it('disables new realms, diplomacy, waiting and region decisions during a real active battle', () => {
    const relationProfile = proposeConquest(createConquestProfile('orcs', 'conquest-ui-active'), { type: 'tribute', faction: 'fairies', amount: 250 });
    const battle = prepareConquestBattle(relationProfile, 'quarry');
    battle.recorder.destroy();
    const before = structuredClone(battle.profile);
    const { root, callbacks } = setup(battle.profile);
    expect(root.querySelector('[role="status"]')!.textContent).toContain('battle in Deep Gate Quarry');
    for (const label of ['Create realm', 'Offer tribute', 'Request truce', 'Request alliance', 'Wait one turn', 'Attack: Ashwing Grove', 'Attack: Deep Gate Quarry']) {
      const control = button(root, label);
      expect(control.disabled, label).toBe(true);
      control.click();
    }
    for (const label of ['Foreign faction', 'Tribute ore', 'Truce turns']) expect(field(root, label).disabled, label).toBe(true);
    expect(callbacks.start).not.toHaveBeenCalled();
    expect(callbacks.proposal).not.toHaveBeenCalled();
    expect(callbacks.wait).not.toHaveBeenCalled();
    expect(callbacks.battle).not.toHaveBeenCalled();
    expect(battle.profile).toEqual(before);
  });
});

describe('conquest profile import lifecycle', () => {
  it('submits a selected profile file through the host import callback', async () => {
    const { root, callbacks } = setup(null);
    const text = JSON.stringify(createConquestProfile('fairies', 'conquest-ui-import'));
    chooseFile(root, new File([text], 'realm.json', { type: 'application/json' }));
    await vi.waitFor(() => expect(callbacks.import).toHaveBeenCalledExactlyOnceWith(text));
    expect(root.querySelector('details')!.open).toBe(true);
    expect(root.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(true);
  });

  it.each(['new realm', 'host cancellation', 'destroy'] as const)('ignores delayed file text after %s', async interruption => {
    const { root, callbacks, tools, profile } = setup();
    const before = structuredClone(profile);
    let resolve!: (text: string) => void;
    const pending = new Promise<string>(done => { resolve = done; });
    const file = new File(['delayed'], 'realm.json', { type: 'application/json' });
    vi.spyOn(file, 'text').mockReturnValue(pending);
    chooseFile(root, file);
    expect(file.text).toHaveBeenCalledOnce();
    if (interruption === 'new realm') {
      setInput(field<HTMLSelectElement>(root, 'Conquest faction'), 'dwarves');
      button(root, 'Create realm').click();
      expect(callbacks.start).toHaveBeenCalledExactlyOnceWith('dwarves');
    } else if (interruption === 'host cancellation') {
      tools.cancelPendingImport();
    } else {
      tools.destroy();
    }
    resolve(JSON.stringify(createConquestProfile('fairies', 'stale-conquest-ui')));
    await pending;
    await Promise.resolve();
    expect(callbacks.import).not.toHaveBeenCalled();
    expect(callbacks.notice).not.toHaveBeenCalled();
    expect(profile).toEqual(before);
    if (interruption === 'destroy') expect(root.childElementCount).toBe(0);
  });
});
