// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { UPGRADES } from '../src/core/content';
import { canPlace, createMatch, issueCommand, stepGame } from '../src/core/simulation';
import type { UpgradeId } from '../src/core/types';
import { mountShell, type HudCallbacks } from '../src/ui/Hud';
import { canvasContextStub } from './helpers/canvas-context';
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
const advance = (state: ReturnType<typeof createMatch>, seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 10); i++) stepGame(state, .1); };
function setup() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContextStub());
  const root = document.createElement('div'); document.body.append(root);
  const shell = mountShell(root, () => {}); shell.showGame();
  const state = createMatch({ map: { seed: 4127, size: 'small' }, rules: { startingAge: 3 }, players: [
    { id: 0, teamId: 0, factionId: 'fairies', controller: 'external', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 1000 } } },
    { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' }] });
  const worker = state.entities.find(e => e.side === 0 && e.role === 'worker')!;
  let built = false;
  for (let y = 2.5; y < state.height - 2 && !built; y++) for (let x = 2.5; x < state.width - 2 && !built; x++) if (canPlace(state, 0, 'barracks', x, y)) built = issueCommand(state, 0, { type: 'build', ids: [worker.id], role: 'barracks', x, y });
  expect(built).toBe(true); advance(state, 70);
  const barracks = state.entities.find(e => e.side === 0 && e.role === 'barracks')!;
  const research = vi.fn((upgrade: UpgradeId, id?: number) => issueCommand(state, 0, { type: 'research', id: id!, upgrade }));
  const callbacks = { isMuted: () => false, groups: () => ({}), cameraCorners: () => [], research } as unknown as HudCallbacks;
  shell.update(state, [], callbacks); root.querySelector<HTMLButtonElement>('#technology-button')!.click();
  const update = () => shell.update(state, [], callbacks);
  const button = (id: string) => root.querySelector<HTMLButtonElement>(`[data-technology="${id}"]`)!;
  return { root, state, barracks, shell, callbacks, research, update, button };
}

it('presents the exclusive alternatives, reserves the selected branch and permanently locks its alternative', () => {
  const { root, state, barracks, research, update, button } = setup();
  expect(button('core:ranged-focus').disabled).toBe(true);
  expect(button('core:ranged-focus').textContent).toContain('Requires Ranged Arms');
  expect(button('core:ranged-focus').querySelector('[data-technology-group]')!.textContent).toBe('Choose one: Focused Volleys or Skirmish Drills');
  button('core:ranged-arms').click(); update();
  expect(research).toHaveBeenLastCalledWith('core:ranged-arms', barracks.id);
  advance(state, UPGRADES['core:ranged-arms'].researchTime + .2); update();
  expect(button('core:ranged-focus').disabled).toBe(false);
  expect(button('core:ranged-mobility').disabled).toBe(false);
  button('core:ranged-focus').click(); update();
  expect(button('core:ranged-focus').textContent).toContain('Researching');
  expect(button('core:ranged-mobility').disabled).toBe(true);
  expect(button('core:ranged-mobility').textContent).toContain('Locked while Focused Volleys is researching');
  const calls = research.mock.calls.length; button('core:ranged-mobility').click();
  expect(research).toHaveBeenCalledTimes(calls);
  advance(state, UPGRADES['core:ranged-focus'].researchTime + .2); update();
  expect(button('core:ranged-focus').textContent).toContain('Already researched');
  expect(button('core:ranged-mobility').disabled).toBe(true);
  expect(button('core:ranged-mobility').textContent).toContain('Locked by Focused Volleys');
  expect(root.querySelector('.technology-tree')!.textContent).toContain('Cavalry Barding');
  expect(root.querySelector('.technology-tree')!.textContent).toContain('Siege Gears');
});

it('shows researched damage, armor and speed for owned roles while preserving enemy research privacy', () => {
  const { root, state, barracks, shell, callbacks, update, button } = setup();
  for (const id of ['core:ranged-arms', 'core:cavalry-barding', 'core:siege-gears'] as UpgradeId[]) {
    button(id).click(); advance(state, UPGRADES[id].researchTime + .2); update();
  }
  root.querySelector<HTMLButtonElement>('[aria-label="Close technology tree"]')!.click();
  for (const role of ['ranged', 'cavalry', 'siege'] as const) {
    expect(issueCommand(state, 0, { type: 'train', id: barracks.id, role })).toBe(true); advance(state, 70);
    const unit = state.entities.find(e => e.side === 0 && e.role === role)!;
    shell.update(state, [unit.id], callbacks);
    const stats = root.querySelector('#selection-stats')!.textContent;
    if (role === 'ranged') expect(stats).toContain('ATK 21.6');
    if (role === 'cavalry') expect(stats).toContain('ARM 4');
    if (role === 'siege') expect(stats).toContain('SPD 1.4');
  }
  const enemy = state.entities.find(e => e.side === 1 && e.role === 'melee')!;
  state.visible[0].add(Math.floor(enemy.y) * state.width + Math.floor(enemy.x));
  shell.update(state, [enemy.id], callbacks);
  expect(root.querySelector('#selection-stats [title="Base movement speed; enemy research is private"]')).not.toBeNull();
});
