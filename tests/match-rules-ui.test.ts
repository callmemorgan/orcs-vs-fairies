// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { MatchRulesForm } from '../src/ui/MatchRules';
import { SkirmishRoster } from '../src/ui/SkirmishRoster';
import { mountObjectivePanel } from '../src/ui/ObjectivePanel';
import { createMatch, issueCommand } from '../src/core/simulation';
import { mountOnlineLobby } from '../src/ui/OnlineLobby';
import { OnlineApi } from '../src/online/client';
import type { LobbyObservation } from '../src/online/protocol';
import { PlayerView } from '../src/core/observation';

const disposers: Array<() => void> = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); document.body.replaceChildren(); });
function root() { const node = document.createElement('div'); document.body.append(node); return node; }
function field<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(root: ParentNode, name: string) { return root.querySelector<T>(`[aria-label="${name}"]`)!; }
function set(root: ParentNode, name: string, value: string) { const control = field(root, name); control.value = value; control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }

it('allows changing modes after an incomplete hidden objective and restores its draft on return', () => {
  const node = root(), form = new MatchRulesForm(node); disposers.push(() => form.destroy());
  set(node, 'Victory mode', 'relic'); set(node, 'Relic count', '1'); expect(() => form.value).toThrow('Relics');
  set(node, 'Victory mode', 'annihilation'); expect(form.value.mode).toBe('annihilation'); expect(field(node, 'Relic count').disabled).toBe(true);
  set(node, 'Victory mode', 'relic'); expect(field(node, 'Relic count').value).toBe('1'); set(node, 'Relics needed to win', '1'); expect(form.value.relic.count).toBe(1);
});

it('shows inherited match resources in new local slots and respects an explicit default-value override', () => {
  const node = root(), roster = new SkirmishRoster(node); disposers.push(() => roster.destroy());
  const enable = field(node, 'Enable team match setup'); enable.checked = true; enable.dispatchEvent(new Event('change'));
  set(node, 'Match starting wood', '900'); set(node, 'Match preset', '2v2'); expect(field(node, 'Player 3 starting wood').value).toBe('900');
  set(node, 'Player 1 starting wood', '420'); const players = roster.getPlayers('orcs', 'fairies');
  const state = createMatch({ map: { seed: 4127 }, players, rules: roster.getRules() }); expect(state.players.map(player => player.wood)).toEqual([420, 900, 900, 900]);
  set(node, 'Victory mode', 'hill'); enable.checked = false; enable.dispatchEvent(new Event('change')); expect(roster.getRules().mode).toBe('annihilation');
});

it('keeps relic buttons focused while units move and dispatches collection from the public observation', async () => {
  const node = root(), state = createMatch({ map: { seed: 4127 }, players: [{ id: 0, teamId: 0, factionId: 'orcs', controller: 'human' }, { id: 1, teamId: 1, factionId: 'fairies', controller: 'external' }], rules: { mode: 'relic' } });
  const observer = new PlayerView(0), unit = state.entities.find(entity => entity.side === 0 && entity.kind === 'unit')!, relic = state.objectives.relics[0]; unit.x = relic.x; unit.y = relic.y;
  const submit = vi.fn(command => issueCommand(state, 0, command));
  const panel = mountObjectivePanel(node, { getState: () => state, getObservation: () => observer.observe(state), side: 0, submit }); disposers.push(() => panel.dispose());
  const button = node.querySelector<HTMLButtonElement>('[aria-label="Collect relic 1"]')!; button.focus(); unit.x += .01; panel.update();
  expect(node.querySelector('[aria-label="Collect relic 1"]')).toBe(button); expect(document.activeElement).toBe(button); button.click(); await vi.waitFor(() => expect(relic.carrierId).toBe(unit.id));
  expect(submit).toHaveBeenCalledWith({ type: 'collectRelic', id: unit.id, relicId: 1 }); expect(node.textContent).not.toContain('Draft complete');
});

it('disables orders and masks the location of an unseen enemy relic carrier', () => {
  const node = root(), state = createMatch({ map: { seed: 4127 }, players: [{ id: 0, teamId: 0, factionId: 'orcs', controller: 'human' }, { id: 1, teamId: 1, factionId: 'fairies', controller: 'external' }], rules: { mode: 'relic' } });
  const enemy = state.entities.find(entity => entity.side === 1 && entity.kind === 'unit')!, relic = state.objectives.relics[0]; relic.carrierId = enemy.id; relic.x = enemy.x; relic.y = enemy.y;
  const observer = new PlayerView(0), submit = vi.fn();
  const panel = mountObjectivePanel(node, { getState: () => state, side: 0, submit, canSubmit: () => false }); disposers.push(() => panel.dispose());
  expect(node.querySelector('[data-relic-id="1"]')!.textContent).toContain('Location hidden'); expect(node.querySelector<HTMLButtonElement>('[aria-label="Collect relic 1"]')!.disabled).toBe(true);
});

it('submits an explicit online resource override even when it equals the legacy defaults', async () => {
  const node = root(), account = { id: 'host', username: 'Host' }, api = new OnlineApi();
  let current: LobbyObservation = { id: 'lobby', hostId: account.id, revision: 1, settings: { mapSize: 'medium', factions: ['orcs', 'fairies'] }, seats: [{ side: 0, account, ready: false }, { side: 1, account: null, ready: false }], matchId: null };
  vi.spyOn(api, 'session').mockResolvedValue(account); vi.spyOn(api, 'lobbies').mockResolvedValue([]); vi.spyOn(api, 'lobby').mockImplementation(async () => current);
  const create = vi.spyOn(api, 'createLobby').mockImplementation(async settings => { current = { ...current, settings }; return current; });
  const lobby = mountOnlineLobby(node, { api, onJoinMatch: () => undefined }); disposers.push(() => lobby.dispose()); await lobby.show();
  set(node, 'Lobby Match starting wood', '900'); expect(field(node, 'Lobby player 2 starting wood').value).toBe('900'); set(node, 'Lobby player 1 starting wood', '420');
  node.querySelector('form.online-create')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(create).toHaveBeenCalledOnce()); const settings = create.mock.calls[0][0];
  expect(settings.rules?.startingResources?.wood).toBe(900); expect(settings.players![0].handicap?.startingResources?.wood).toBe(420); expect(settings.players![1].handicap).toBeUndefined();
});
