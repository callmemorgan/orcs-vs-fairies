// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScenarioCampaignHost } from '../src/ui/ScenarioCampaignHost';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { issueCommand, stepGame } from '../src/core/simulation';
import { loadGame, saveGame } from '../src/core/saves';
import type { GameState } from '../src/core/types';
import { createCampaignProfile } from '../src/core/campaign';
import { verifyScenarioRecording } from '../src/core/scenario-recordings';

const fixture = (name: string) => readFileSync(`${process.cwd()}/tests/fixtures/scenario-save3-3.2/${name}.json`, 'utf8');
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); });
function setup() {
  const root = document.createElement('div'); root.innerHTML = '<button class="begin-match">Begin</button><div class="session-toolbar"></div>'; document.body.append(root);
  let state: GameState | null = null; const visibility = vi.fn(), launch = vi.fn(), notice = vi.fn();
  const host = new ScenarioCampaignHost(root, root.querySelector('.session-toolbar')!, {
    state: () => state, launch: (session, reason) => { state = session.state; launch(session, reason); }, menu: () => { state = null; },
    select: vi.fn(), center: vi.fn(), notice, visibility, inspection: () => null,
  });
  const button = (text: string) => Array.from(root.querySelectorAll('button')).find(item => item.textContent === text)!;
  const installFile = (input: unknown) => {
    const restored = decodeSessionFile(input); state = restored.state;
    return { ...restored, reason: host.install(restored.file.scenarioProfile, restored.state) };
  };
  return { root, host, visibility, launch, notice, button, installFile, getState: () => state! };
}

describe('campaign controls in the canonical app host', () => {
  function deferredFile(input: HTMLInputElement, name: string) {
    let resolve!: (text: string) => void, reject!: (error: Error) => void;
    const text = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
    const file = new File(['placeholder'], name, { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => text });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    return { resolve, reject };
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  it('discards a campaign file read after another match clears strategic ownership', async () => {
    const ui = setup(), input = ui.root.querySelector<HTMLInputElement>('[aria-label="Import campaign profile"]')!;
    const pending = deferredFile(input, 'old-campaign.json');
    ui.host.clear(); pending.resolve(JSON.stringify(createCampaignProfile('campaign-orcs', 'old'))); await settle();
    expect(ui.launch).not.toHaveBeenCalled(); expect(ui.host.snapshot()).toBeUndefined();
    expect(localStorage.getItem('ovf.campaign.v1')).toBeNull();
  });

  it('keeps the newer campaign when two file reads resolve out of order', async () => {
    const ui = setup(), input = ui.root.querySelector<HTMLInputElement>('[aria-label="Import campaign profile"]')!;
    const old = deferredFile(input, 'old.json'), current = deferredFile(input, 'current.json');
    current.resolve(JSON.stringify(createCampaignProfile('campaign-dwarves', 'current'))); await settle();
    old.resolve(JSON.stringify(createCampaignProfile('campaign-orcs', 'old'))); await settle();
    expect(ui.launch).toHaveBeenCalledTimes(1); expect(ui.getState().scenario!.definition.id).toBe('dwarves-1');
    expect(ui.host.snapshot()!.profile.id).toBe('current');
    expect(JSON.parse(localStorage.getItem('ovf.campaign.v1')!).id).toBe('current');
  });

  it('ignores stale read errors and reports an admitted current read error', async () => {
    const ui = setup(), input = ui.root.querySelector<HTMLInputElement>('[aria-label="Import campaign profile"]')!;
    const stale = deferredFile(input, 'stale.json'); ui.host.clear(); stale.reject(new Error('Stale failure')); await settle();
    expect(ui.notice).not.toHaveBeenCalled();
    const current = deferredFile(input, 'current.json'); current.reject(new Error('Current failure')); await settle();
    expect(ui.notice).toHaveBeenLastCalledWith('Current failure'); expect(ui.launch).not.toHaveBeenCalled();
  });
  it('starts a campaign from the menu and retains normal commands in generic save ownership', () => {
    const ui = setup(); ui.button('Campaigns and realms').click(); expect(ui.visibility).toHaveBeenCalledWith(true);
    ui.root.querySelector<HTMLButtonElement>('[data-campaign="campaign-dwarves"]')!.click();
    const state = ui.getState(); expect(state.scenario?.definition.id).toBe('dwarves-1'); expect(ui.launch.mock.calls[0][1]).toBeUndefined();
    expect(issueCommand(state, 0, { type: 'hold', ids: [state.scenario!.runtime.labels.commander] })).toBe(true); stepGame(state, .05); ui.host.step();
    const owner = ui.host.snapshot()!; expect(owner.kind).toBe('campaign'); expect(owner.profile.active!.recording.commands).toHaveLength(1);
    const restored = decodeSessionFile(createSessionFile(state, undefined, undefined, owner));
    expect(ui.host.install(restored.file.scenarioProfile, restored.state)).toBeNull();
  });

  it('continues an equipped SAVE4 campaign after ordinary save installation without replacing or duplicating its journal', () => {
    const ui = setup();
    try {
      ui.root.querySelector<HTMLButtonElement>('[data-campaign="campaign-dwarves"]')!.click();
      const state = ui.getState(), commander = state.scenario!.runtime.labels.commander, raider = state.scenario!.runtime.labels.raider;
      expect(issueCommand(state, 0, { type: 'attackMove', ids: [commander], x: 25, y: 24 })).toBe(true);
      for (let tick = 0; tick < 600 && state.entities.find(entity => entity.id === raider)!.hp > 0; tick++) { stepGame(state, .05); ui.host.step(); }
      expect(state.entities.find(entity => entity.id === raider)!.hp).toBe(0);
      const artifact = state.specialists!.artifacts.find(item => item.definitionId === 'core:iron-aegis')!;
      expect(artifact).toBeDefined();
      expect(issueCommand(state, 0, { type: 'move', ids: [commander], x: artifact.position!.x, y: artifact.position!.y })).toBe(true);
      const hero = state.entities.find(entity => entity.id === commander)!;
      for (let tick = 0; tick < 200 && Math.hypot(hero.x - artifact.position!.x, hero.y - artifact.position!.y) > 2; tick++) { stepGame(state, .05); ui.host.step(); }
      expect(issueCommand(state, 0, { type: 'recoverArtifact', id: commander, artifact: artifact.id })).toBe(true);
      expect(issueCommand(state, 0, { type: 'equipArtifact', id: commander, artifact: artifact.id })).toBe(true);
      stepGame(state, .05); ui.host.step();
      const owner = ui.host.snapshot()!, original = structuredClone(owner.profile.active!.recording);
      const file = createSessionFile(state, undefined, undefined, owner);
      expect(file.game.version).toBe(4); expect(original.initial.game.version).toBe(4);
      expect(state.entities.find(entity => entity.id === commander)!.equipment).toEqual({ armor: artifact.id });

      const restored = ui.installFile(JSON.stringify(file)), tick = restored.state.tick;
      expect(restored.reason).toBeNull(); expect(saveGame(restored.state)).toEqual(file.game);
      expect(restored.state.entities.find(entity => entity.id === commander)!.equipment).toEqual({ armor: artifact.id });
      expect(restored.state.specialists!.artifacts.find(item => item.id === artifact.id)).toEqual({ id: artifact.id, definitionId: 'core:iron-aegis', owner: 0, holder: commander });
      const accepted = { type: 'hold' as const, ids: [commander] }, holds = restored.state.scenario!.runtime.commandCounts.hold ?? 0;
      expect(issueCommand(restored.state, 0, accepted)).toBe(true);
      expect(restored.state.scenario!.runtime.commandCounts.hold).toBe(holds + 1);
      stepGame(restored.state, .05); ui.host.step();
      const continued = ui.host.snapshot()!.profile.active!.recording;
      expect(continued.initial).toEqual(original.initial);
      expect(continued.commands).toEqual([...original.commands, { tick, side: 0, command: accepted }]);
      expect(continued.finalTick).toBe(tick + 1);
      expect(saveGame(verifyScenarioRecording(continued).state)).toEqual(saveGame(restored.state));
      expect(ui.host.snapshot()!.profile.active!.recording).toEqual(continued);
      expect(owner.profile.active!.recording).toEqual(original);
    } finally { ui.host.clear(); }
  });

  it('opens an old saved campaign as an inspected checkpoint without starting or changing it', () => {
    localStorage.setItem('ovf.campaign.v1', fixture('campaign-active')); const ui = setup(); ui.button('Resume saved campaign').click();
    expect(ui.launch).toHaveBeenCalledTimes(1); expect(ui.launch.mock.calls[0][1]).toContain('inspection'); expect(ui.host.reason()).toContain('inspection');
    expect(ui.host.snapshot()?.profile).toEqual(JSON.parse(fixture('campaign-active')));
    ui.button('Reset mission').click(); expect(ui.launch).toHaveBeenCalledTimes(1);
    expect(ui.root.querySelector('.scenario-compatibility')?.textContent).toContain('inspection');
  });

  it('preserves a historical empty campaign and displays its compatibility reason', () => {
    const old = JSON.parse(fixture('campaign-active')); old.active = null; old.history = [];
    localStorage.setItem('ovf.campaign.v1', JSON.stringify(old)); const ui = setup(); ui.button('Resume saved campaign').click();
    expect(ui.launch).not.toHaveBeenCalled(); expect(ui.host.reason()).toContain('no pinned'); expect(ui.host.snapshot()?.profile).toEqual(old);
    expect(ui.root.querySelector('.scenario-host-panel')?.hasAttribute('hidden')).toBe(false);
  });

  it('detects a bound historical generic save without a replay or profile', () => {
    const ui = setup(), state = loadGame(JSON.parse(fixture('generic-bound-final')));
    expect(ui.host.install(undefined, state)).toContain('no pinned'); expect(ui.launch).not.toHaveBeenCalled();
  });

  it('closes the mission modal when photo mode or another modal blocks it', () => {
    const ui = setup(); ui.button('Missions and realms').click(); ui.host.update({ photo: true });
    expect(ui.visibility).toHaveBeenLastCalledWith(false); expect(ui.root.querySelector('.scenario-host-panel')?.hasAttribute('hidden')).toBe(true);
    ui.host.update({ photo: false }); ui.button('Missions and realms').click(); ui.host.update({ blocked: true }); expect(ui.visibility).toHaveBeenLastCalledWith(false);
  });
});
