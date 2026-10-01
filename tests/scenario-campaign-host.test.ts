// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScenarioCampaignHost } from '../src/ui/ScenarioCampaignHost';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { issueCommand, stepGame } from '../src/core/simulation';
import { loadGame } from '../src/core/saves';
import type { GameState } from '../src/core/types';

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
  return { root, host, visibility, launch, notice, button, getState: () => state! };
}

describe('campaign controls in the canonical app host', () => {
  it('starts a campaign from the menu and retains normal commands in generic save ownership', () => {
    const ui = setup(); ui.button('Campaigns and realms').click(); expect(ui.visibility).toHaveBeenCalledWith(true);
    ui.root.querySelector<HTMLButtonElement>('[data-campaign="campaign-dwarves"]')!.click();
    const state = ui.getState(); expect(state.scenario?.definition.id).toBe('dwarves-1'); expect(ui.launch.mock.calls[0][1]).toBeUndefined();
    expect(issueCommand(state, 0, { type: 'hold', ids: [state.scenario!.runtime.labels.commander] })).toBe(true); stepGame(state, .05); ui.host.step();
    const owner = ui.host.snapshot()!; expect(owner.kind).toBe('campaign'); expect(owner.profile.active!.recording.commands).toHaveLength(1);
    const restored = decodeSessionFile(createSessionFile(state, undefined, undefined, owner));
    expect(ui.host.install(restored.file.scenarioProfile, restored.state)).toBeNull();
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
