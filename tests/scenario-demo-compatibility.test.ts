// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CampaignProfile } from '../src/core/campaign';
import type { ConquestProfile } from '../src/core/conquest-types';
import type { ScenarioCheckpoint } from '../src/core/scenario-types';
import type { Command, GameState } from '../src/core/types';
import type { GameSceneOptions } from '../src/game/GameScene';
import type { HudCallbacks } from '../src/ui/Hud';

interface SceneDouble {
  options: GameSceneOptions;
  state: GameState;
  selected: number[];
  paused: boolean;
  readOnly: boolean;
  simulationEnabled: boolean;
  inputBlocked: boolean;
  photoMode: boolean;
  useAbility: ReturnType<typeof vi.fn<() => boolean>>;
  command: ReturnType<typeof vi.fn<(command: Command) => boolean>>;
  setPhotoMode: ReturnType<typeof vi.fn<(enabled: boolean) => void>>;
}

const renderer = vi.hoisted(() => ({
  scenes: [] as SceneDouble[],
  hud: undefined as HudCallbacks | undefined,
  notice: vi.fn<(text: string) => void>(),
  overlayUpdate: vi.fn(),
  destroyed: vi.fn(),
}));

vi.mock('phaser', () => ({ default: {
  CANVAS: 1, Scale: { RESIZE: 1 }, Core: { Events: { DESTROY: 'destroy' } },
  Game: class {
    private listeners: Array<() => void> = [];
    events = { once: (_event: string, listener: () => void) => this.listeners.push(listener) };
    constructor(options: { scene: SceneDouble[] }) { options.scene[0].options.onReady?.(); }
    destroy() { renderer.destroyed(); for (const listener of this.listeners.splice(0)) listener(); }
  },
} }));

vi.mock('../src/game/GameScene', () => ({
  project: (x: number, y: number) => ({ x, y }),
  unproject: (x: number, y: number) => ({ x, y }),
  default: class {
    state: GameState;
    selected: number[] = [];
    paused = false;
    readOnly: boolean;
    simulationEnabled: boolean;
    inputBlocked = false;
    photoMode = false;
    muted = false;
    artStatus = {};
    private previousPhotoPause = false;
    cameras = { main: { scrollX: 0, scrollY: 0, zoom: 1,
      getWorldPoint: (x: number, y: number) => ({ x, y }),
      matrixCombined: { transformPoint: (x: number, y: number) => ({ x, y }) },
    } };
    constructor(public options: GameSceneOptions) {
      this.state = options.state;
      this.readOnly = options.readOnly ?? false;
      this.simulationEnabled = options.simulationEnabled ?? true;
      renderer.scenes.push(this);
    }
    // This double forwards commands even for inspection scenes so the demo's own guard is tested.
    command = vi.fn((command: Command) => this.options.onCommand?.(0, command) ?? false);
    useAbility = vi.fn(() => true);
    selectEntities(ids: number[]) { this.selected = [...ids]; this.options.onSelection(ids); }
    centerOn() {}
    setBuildRole() {}
    beginAttackMove() {}
    holdPosition() { return this.command({ type: 'hold', ids: this.selected }); }
    controlGroups() { return {}; }
    recallGroup() {}
    toggleMuted() { this.muted = !this.muted; }
    togglePause() {
      if (this.photoMode || this.state.winner !== null || this.state.draw) return;
      this.paused = !this.paused;
      this.options.onPause?.(this.paused);
    }
    setPhotoMode = vi.fn((enabled: boolean) => {
      if (this.photoMode === enabled) return;
      if (enabled) { this.previousPhotoPause = this.paused; this.paused = true; }
      else this.paused = this.previousPhotoPause;
      this.photoMode = enabled;
      this.options.onPhotoMode?.(enabled);
      this.options.onPause?.(this.paused);
    });
  },
}));

vi.mock('../src/game/ScenarioOverlay', () => ({ ScenarioOverlay: class {
  update = renderer.overlayUpdate;
  destroy() {}
} }));

vi.mock('../src/ui/Hud', () => ({ mountShell: (root: HTMLElement) => {
  root.innerHTML = '<main class="war-shell"><div id="game-canvas"></div><section class="war-menu"></section><section class="war-hud" hidden><p class="objective-tag"></p></section><section class="battle-overlay"><p id="overlay-eyebrow"></p><h2 id="overlay-title"></h2><p id="overlay-description"></p></section></main>';
  return {
    showMenu: () => { root.querySelector<HTMLElement>('.war-menu')!.hidden = false; },
    showGame: () => { root.querySelector<HTMLElement>('.war-menu')!.hidden = true; root.querySelector<HTMLElement>('.war-hud')!.hidden = false; },
    ready: () => {},
    update: (_state: GameState, _selected: number[], callbacks: HudCallbacks) => { renderer.hud = callbacks; },
    battlefieldBounds: () => ({ top: 80, bottom: 600 }),
    notice: renderer.notice,
    activateActionSlot: () => false,
  };
} }));

type Profile = CampaignProfile | ConquestProfile;
type Kind = 'campaign' | 'conquest';
interface Diagnostics {
  ready: boolean;
  readOnly: boolean;
  simulationEnabled: boolean;
  readOnlyReason: string | null;
  campaignProfile: CampaignProfile | null;
  conquest: ConquestProfile | null;
  checkpoint?: ScenarioCheckpoint;
  commands?: unknown[];
}

let browser: Window;
const campaignKey = 'ovf.campaign.demo.v1';
const conquestKey = 'ovf.conquest.demo.v1';
const fixture = <T extends Profile | ScenarioCheckpoint = Profile>(name: string): T => JSON.parse(readFileSync(resolve(`tests/fixtures/scenario-save3-3.2/${name}.json`), 'utf8'));
const diagnostic = (): Diagnostics => (window as unknown as { scenarioDiagnostics: Diagnostics }).scenarioDiagnostics;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  renderer.scenes.length = 0;
  renderer.hud = undefined;
  browser = new Window({ url: 'http://localhost/scenario-demo.html' });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', browser.document);
  vi.stubGlobal('localStorage', browser.localStorage);
  vi.stubGlobal('MutationObserver', browser.MutationObserver);
  vi.stubGlobal('innerWidth', 1024);
  vi.stubGlobal('innerHeight', 768);
  const html = readFileSync(resolve('scenario-demo.html'), 'utf8');
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script\b[\s\S]*?<\/script>/g, '');
});

afterEach(async () => {
  vi.clearAllTimers();
  await browser.happyDOM.abort();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function button(label: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(control => control.textContent?.trim() === label);
  expect(found, `Missing button ${label}`).toBeDefined();
  return found!;
}

async function settle(): Promise<void> {
  await browser.happyDOM.waitUntilComplete();
  await vi.advanceTimersByTimeAsync(0);
}

async function uploadFile(label: string, name: string, value: unknown): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  expect(input).not.toBeNull();
  const file = new browser.File([JSON.stringify(value)], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

async function upload(kind: Kind, profile: Profile): Promise<void> {
  await uploadFile(kind === 'campaign' ? 'Import campaign profile' : 'Import realm profile', `${kind}.json`, profile);
}

async function boot(saved?: { kind: Kind; profile: Profile }) {
  if (saved) localStorage.setItem(saved.kind === 'campaign' ? campaignKey : conquestKey, JSON.stringify(saved.profile));
  const writes = vi.spyOn(Object.getPrototypeOf(localStorage), 'setItem');
  const [campaign, conquest, recordings, scenarios] = await Promise.all([
    import('../src/core/campaign'), import('../src/core/conquest'),
    import('../src/core/scenario-recordings'), import('../src/core/scenarios'),
  ]);
  const RealRecorder = recordings.ScenarioRecorder;
  // Return the real instance: a constructor spy alone loses its prototype in this Vitest version.
  const constructRecorder = function (...args: ConstructorParameters<typeof RealRecorder>) { return new RealRecorder(...args); };
  const mutations = {
    campaignPrepare: vi.spyOn(campaign, 'prepareCampaignMission'),
    campaignReset: vi.spyOn(campaign, 'resetCampaignMission'),
    campaignCheckpoint: vi.spyOn(campaign, 'checkpointCampaignMission'),
    campaignComplete: vi.spyOn(campaign, 'completeCampaignMission'),
    campaignChoose: vi.spyOn(campaign, 'chooseCampaignBranch'),
    conquestPrepare: vi.spyOn(conquest, 'prepareConquestBattle'),
    conquestCheckpoint: vi.spyOn(conquest, 'checkpointConquestBattle'),
    conquestComplete: vi.spyOn(conquest, 'completeConquestBattle'),
    conquestProposal: vi.spyOn(conquest, 'proposeConquest'),
    conquestWait: vi.spyOn(conquest, 'waitConquestTurn'),
    practiceReset: vi.spyOn(scenarios, 'resetScenario'),
    command: vi.spyOn(scenarios, 'issueScenarioCommand'),
    scenarioStep: vi.spyOn(scenarios, 'afterScenarioStep'),
    recorder: vi.spyOn(recordings, 'ScenarioRecorder').mockImplementation(constructRecorder as unknown as typeof RealRecorder),
  };
  const blobs: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { blobs.push(blob as Blob); return `blob:profile-${blobs.length}`; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(Object.getPrototypeOf(document.createElement('a')), 'click').mockImplementation(() => {});
  await import('../src/scenarios/demo');
  await settle();
  return { campaign, conquest, scenarios, writes, mutations, blobs };
}

function expectNoMutations(mutations: Awaited<ReturnType<typeof boot>>['mutations']): void {
  for (const [name, mutation] of Object.entries(mutations)) expect(mutation, name).not.toHaveBeenCalled();
}

function expectHistoricalProfile(kind: Kind, profile: Profile): void {
  const view = diagnostic();
  if (view.ready) {
    expect(view.readOnly).toBe(true);
    expect(view.simulationEnabled).toBe(false);
  }
  expect(view.readOnlyReason).toMatch(/inspection|read.only|rules|pinned/i);
  expect(view[kind === 'campaign' ? 'campaignProfile' : 'conquest']).toEqual(profile);
  const notice = document.querySelector<HTMLElement>(kind === 'campaign' ? '.scenario-compatibility' : '.conquest-compatibility')!;
  expect(notice.hidden).toBe(false);
  expect(notice.textContent).toContain(view.readOnlyReason);
}

describe('historical demo profile inspection', () => {
  it.each([
    ['campaign', 'active', 'import'], ['campaign', 'active', 'resume'],
    ['campaign', 'completed', 'import'], ['campaign', 'completed', 'resume'],
    ['conquest', 'active', 'import'], ['conquest', 'active', 'resume'],
    ['conquest', 'completed', 'import'], ['conquest', 'completed', 'resume'],
  ] as const)('preserves a legacy %s %s profile through %s, blocked actions, export and periodic saves', async (kind, state, entry) => {
    const raw = fixture(`${kind}-${state}`), original = JSON.stringify(raw);
    const harness = await boot(entry === 'resume' ? { kind, profile: raw } : undefined);
    if (entry === 'resume') { button(kind === 'campaign' ? 'Resume saved campaign' : 'Resume saved realm').click(); await settle(); }
    else await upload(kind, raw);
    expectHistoricalProfile(kind, raw);
    const scene = renderer.scenes.at(-1);
    if (kind === 'campaign' || state === 'active') {
      expect(scene).toBeDefined();
      expect(scene!.options).toMatchObject({ readOnly: true, simulationEnabled: false });
      const snapshot = JSON.stringify(diagnostic().checkpoint);
      const owned = scene!.state.entities.find(entity => entity.side === 0 && entity.kind === 'unit')!;
      expect(scene!.options.onCommand?.(0, { type: 'hold', ids: [owned.id] })).toBe(false);
      scene!.options.onStep?.(scene!.state);
      renderer.hud!.restart();
      button('Reset mission').click();
      expect(button('Reset mission').disabled).toBe(true);
      expect(JSON.stringify(diagnostic().checkpoint)).toBe(snapshot);
      if (kind === 'campaign' && state === 'completed') {
        expect(document.querySelector('.objective-tag')!.textContent).toMatch(/recorded victory/i);
        expect(document.querySelector('#overlay-title')!.textContent).toMatch(/recorded victory/i);
        expect(button('Continue campaign').disabled).toBe(true);
        button('Continue campaign').click();
      }
    } else {
      expect(scene).toBeUndefined();
      expect(diagnostic().ready).toBe(false);
    }
    if (kind === 'conquest') {
      for (const label of ['Wait one turn', 'Offer tribute', 'Request truce', 'Request alliance']) {
        expect(button(label).disabled, label).toBe(true);
        button(label).click();
      }
      for (const control of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-region] > button'))) {
        expect(control.disabled).toBe(true);
        control.click();
      }
      if (state === 'active') expect(document.querySelector('.conquest-tools [role="status"]')!.textContent).toContain('recorded passage');
    }
    await vi.advanceTimersByTimeAsync(4100);
    window.dispatchEvent(new Event('pagehide'));
    expectHistoricalProfile(kind, raw);
    button(kind === 'campaign' ? 'Save campaign profile' : 'Export realm profile').click();
    expect(harness.blobs).toHaveLength(1);
    expect(JSON.stringify(JSON.parse(await harness.blobs[0].text()))).toBe(original);
    expect(JSON.stringify(raw)).toBe(original);
    expect(harness.writes).not.toHaveBeenCalled();
    expectNoMutations(harness.mutations);
  });

  it.each(['campaign', 'conquest'] as const)('keeps an empty unpinned legacy %s profile in inspection without launching a battle', async kind => {
    const harness = await boot();
    let raw: Profile;
    if (kind === 'campaign') {
      raw = { ...fixture<CampaignProfile>('campaign-active'), active: null, history: [], choiceId: null, revision: 0 };
    } else {
      raw = harness.conquest.createConquestProfile('orcs', 'legacy-empty-realm');
      delete (raw as unknown as Record<string, unknown>).simulationRevision;
    }
    await upload(kind, raw);
    expectHistoricalProfile(kind, raw);
    expect(renderer.scenes).toHaveLength(0);
    expect(diagnostic().ready).toBe(false);
    await vi.advanceTimersByTimeAsync(4100);
    window.dispatchEvent(new Event('pagehide'));
    button(kind === 'campaign' ? 'Save campaign profile' : 'Export realm profile').click();
    expect(JSON.parse(await harness.blobs[0].text())).toEqual(raw);
    expect(harness.writes).not.toHaveBeenCalled();
    expectNoMutations(harness.mutations);
  });

  it.each(['campaign', 'conquest'] as const)('preserves an explicitly old rules pin in the %s import controls', async kind => {
    // Modified copies isolate explicit old-pin UI behavior. The original genuine
    // fixture files remain unchanged, and these inputs are not new captures.
    const raw = fixture<Profile>(`${kind}-active`); raw.simulationRevision = '3.2.0';
    const before = JSON.stringify(raw), harness = await boot();
    await upload(kind, raw); expectHistoricalProfile(kind, raw);
    expect(diagnostic().readOnlyReason).toContain('3.2.0');
    const scene = renderer.scenes.at(-1)!;
    expect(scene.options).toMatchObject({ readOnly: true, simulationEnabled: false });
    const owned = scene.state.entities.find(entity => entity.side === 0 && entity.kind === 'unit')!;
    expect(scene.options.onCommand?.(0, { type: 'hold', ids: [owned.id] })).toBe(false);
    scene.options.onStep?.(scene.state);
    await vi.advanceTimersByTimeAsync(4100); window.dispatchEvent(new Event('pagehide'));
    button(kind === 'campaign' ? 'Save campaign profile' : 'Export realm profile').click();
    expect(JSON.stringify(JSON.parse(await harness.blobs[0].text()))).toBe(before);
    expect(JSON.stringify(raw)).toBe(before); expect(harness.writes).not.toHaveBeenCalled();
    expectNoMutations(harness.mutations);
  });

  it('does not complete an imported legacy victory that was saved as the active campaign battle', async () => {
    const raw = fixture<CampaignProfile>('campaign-active');
    const { resultId: _resultId, ...battle } = fixture<CampaignProfile>('campaign-completed').history[0];
    raw.active = battle;
    const harness = await boot();
    await upload('campaign', raw);
    expectHistoricalProfile('campaign', raw);
    expect(diagnostic().checkpoint!.runtime.outcome).toBe('won');
    await vi.advanceTimersByTimeAsync(2050);
    renderer.hud!.restart();
    expectHistoricalProfile('campaign', raw);
    expectNoMutations(harness.mutations);
    expect(harness.writes).not.toHaveBeenCalled();
  });

  it('inspects a standalone legacy mission checkpoint and clears that restriction when a new practice mission launches', async () => {
    const raw = fixture<ScenarioCheckpoint>('scenario-final'), original = JSON.stringify(raw);
    const harness = await boot();
    button('Launch practice mission').click();
    expect(diagnostic()).toMatchObject({ ready: true, readOnly: false, simulationEnabled: true, readOnlyReason: null });
    await uploadFile('Import mission checkpoint', 'legacy-mission.json', raw);
    expect(renderer.scenes).toHaveLength(2);
    const inspected = renderer.scenes.at(-1)!;
    expect(inspected.options).toMatchObject({ readOnly: true, simulationEnabled: false });
    expect(diagnostic()).toMatchObject({ ready: true, readOnly: true, simulationEnabled: false, campaignProfile: null, conquest: null });
    expect(diagnostic().readOnlyReason).toMatch(/inspection|rules|pinned/i);
    expect(diagnostic().checkpoint!.runtime.outcome).toBe('won');
    expect(document.querySelector('.objective-tag')!.textContent).toMatch(/recorded victory/i);
    expect(document.querySelector('#overlay-title')!.textContent).toMatch(/recorded victory/i);
    expect(document.querySelector<HTMLElement>('.scenario-compatibility')!.hidden).toBe(false);
    expect(renderer.hud!.canCommand?.()).toBe(false);
    expect(renderer.hud!.canPause?.()).toBe(false);
    const snapshot = JSON.stringify(diagnostic().checkpoint);
    const owned = inspected.state.entities.find(entity => entity.side === 0 && entity.kind === 'unit')!;
    expect(inspected.options.onCommand?.(0, { type: 'hold', ids: [owned.id] })).toBe(false);
    inspected.options.onStep?.(inspected.state);
    renderer.hud!.restart();
    expect(button('Reset mission').disabled).toBe(true);
    button('Reset mission').click();
    await vi.advanceTimersByTimeAsync(2050);
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.stringify(diagnostic().checkpoint)).toBe(snapshot);
    expect(JSON.stringify(raw)).toBe(original);
    expect(harness.writes).not.toHaveBeenCalled();
    expectNoMutations(harness.mutations);

    document.querySelector<HTMLSelectElement>('[aria-label="Practice mission"]')!.value = 'automata-2';
    button('Launch practice mission').click();
    expect(renderer.scenes).toHaveLength(3);
    const practice = renderer.scenes.at(-1)!;
    expect(practice.options).toMatchObject({ readOnly: false, simulationEnabled: true });
    expect(diagnostic()).toMatchObject({ ready: true, readOnly: false, simulationEnabled: true, readOnlyReason: null });
    expect(document.querySelector<HTMLElement>('.scenario-compatibility')!.hidden).toBe(true);
    expect(button('Reset mission').disabled).toBe(false);
    renderer.hud!.pause();
    const actor = practice.state.entities.find(entity => entity.side === 0 && entity.kind === 'unit')!;
    expect(practice.options.onCommand?.(0, { type: 'hold', ids: [actor.id] })).toBe(true);
    expect(harness.mutations.command).toHaveBeenCalledOnce();
  });
});

describe('writable demo controls', () => {
  it('launches and saves a current campaign through the same profile import controls', async () => {
    const harness = await boot();
    const profile = harness.campaign.createCampaignProfile('campaign-dwarves', 'current-demo-campaign');
    expect(harness.campaign.campaignRulesCompatibility(profile).compatible).toBe(true);
    await upload('campaign', profile);
    expect(renderer.notice.mock.calls).toEqual([]);
    expect(diagnostic()).toMatchObject({ ready: true, readOnly: false, simulationEnabled: true, readOnlyReason: null });
    expect(renderer.scenes.at(-1)!.options).toMatchObject({ readOnly: false, simulationEnabled: true });
    expect(harness.mutations.campaignPrepare).toHaveBeenCalledOnce();
    expect(harness.mutations.recorder).toHaveBeenCalledOnce();
    expect(harness.writes).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2050);
    expect(harness.mutations.campaignCheckpoint).toHaveBeenCalledOnce();
    button('Reset mission').click();
    expect(harness.mutations.campaignReset).toHaveBeenCalledOnce();
    expect(renderer.scenes).toHaveLength(2);
  });

  it('creates a current writable realm and launches its reachable battlefield', async () => {
    const harness = await boot();
    button('Create realm').click();
    expect(harness.conquest.conquestRulesCompatibility(diagnostic().conquest!).compatible).toBe(true);
    expect(button('Wait one turn').disabled).toBe(false);
    const attack = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-region] > button')).find(control => !control.disabled)!;
    expect(attack).toBeDefined();
    attack.click();
    expect(renderer.notice.mock.calls).toEqual([]);
    expect(diagnostic()).toMatchObject({ ready: true, readOnly: false, simulationEnabled: true, readOnlyReason: null });
    expect(renderer.scenes.at(-1)!.options).toMatchObject({ readOnly: false, simulationEnabled: true });
    expect(harness.mutations.conquestPrepare).toHaveBeenCalledOnce();
    expect(harness.mutations.recorder).toHaveBeenCalled();
    expect(harness.writes).toHaveBeenCalled();
  });

  it('routes the HUD ability action through the scene targeting method', async () => {
    await boot();
    button('Launch practice mission').click();
    const scene = renderer.scenes.at(-1)!;
    renderer.hud!.ability();
    expect(scene.useAbility).toHaveBeenCalledOnce();
    expect(scene.command).not.toHaveBeenCalled();
  });

  it('restores the prior pause state and input ownership after the mission panel or a native dialog closes', async () => {
    await boot();
    button('Launch practice mission').click();
    const scene = renderer.scenes.at(-1)!;
    const panel = document.querySelector<HTMLElement>('#scenario-panel')!;
    const toggle = document.querySelector<HTMLButtonElement>('#mission-panel-toggle')!;
    expect(panel.hidden).toBe(true);
    expect(scene.paused).toBe(true);
    expect(scene.inputBlocked).toBe(false);
    renderer.hud!.pause();
    expect(scene.paused).toBe(false);
    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(scene.paused).toBe(true);
    expect(scene.inputBlocked).toBe(true);
    toggle.click();
    expect(scene.paused).toBe(false);
    expect(scene.inputBlocked).toBe(false);

    const worldKey = vi.fn();
    window.addEventListener('keydown', worldKey);
    toggle.click();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(worldKey).not.toHaveBeenCalled();
    expect(panel.hidden).toBe(true);
    expect(scene.paused).toBe(false);
    expect(scene.inputBlocked).toBe(false);

    renderer.hud!.pause();
    toggle.click(); toggle.click();
    expect(scene.paused).toBe(true);
    renderer.hud!.pause();
    const dialog = document.createElement('dialog');
    document.body.append(dialog);
    dialog.open = true;
    await settle();
    expect(scene.paused).toBe(true);
    expect(scene.inputBlocked).toBe(true);
    dialog.open = false;
    await settle();
    expect(scene.paused).toBe(false);
    expect(scene.inputBlocked).toBe(false);
  });

  it('starts a replacement practice mission paused after the picker closes without inheriting its old pause ownership', async () => {
    await boot();
    button('Launch practice mission').click();
    renderer.hud!.pause();
    document.querySelector<HTMLButtonElement>('#mission-panel-toggle')!.click();
    expect(renderer.scenes[0].inputBlocked).toBe(true);
    const selection = document.querySelector<HTMLSelectElement>('[aria-label="Practice mission"]')!;
    selection.value = 'dwarves-1';
    button('Launch practice mission').click();
    expect(renderer.destroyed).toHaveBeenCalledOnce();
    expect(renderer.scenes).toHaveLength(2);
    expect(renderer.scenes[1]).toMatchObject({ paused: true, inputBlocked: false });
    expect(document.querySelector<HTMLElement>('#scenario-panel')!.hidden).toBe(true);
    renderer.hud!.pause();
    expect(renderer.scenes[1].paused).toBe(false);
  });

  it.each([false, true])('toggles photo mode through the visible buttons and restores a prior pause state of %s', async paused => {
    await boot();
    button('Launch practice mission').click();
    const scene = renderer.scenes.at(-1)!;
    if (!paused) renderer.hud!.pause();
    const photo = document.querySelector<HTMLButtonElement>('#mission-photo-button')!;
    const exit = document.querySelector<HTMLButtonElement>('#mission-photo-exit')!;
    expect(photo).not.toBeNull();
    expect(exit).not.toBeNull();
    photo.click();
    expect(scene.setPhotoMode).toHaveBeenLastCalledWith(true);
    expect(scene.photoMode).toBe(true);
    expect(scene.paused).toBe(true);
    expect(exit.closest('[hidden]')).toBeNull();
    exit.click();
    expect(scene.setPhotoMode).toHaveBeenLastCalledWith(false);
    expect(scene.photoMode).toBe(false);
    expect(scene.paused).toBe(paused);
    expect(exit.closest('[hidden]')).not.toBeNull();
  });
});
