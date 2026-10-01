// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { availableUnits, unitFor } from '../src/core/content-registry';
import { canPlace, createMatch, issueCommand, stepGame } from '../src/core/simulation';
import { updateBeacons } from '../src/core/specialist-systems';
import { createArtifact, creditCombat } from '../src/core/unit-progression';
import type { BuildingRole, BuiltinFactionId, Command, Entity, GameState, UnitRole } from '../src/core/types';
import { mountShell, type HudCallbacks } from '../src/ui/Hud';
import { canvasContextStub } from './helpers/canvas-context';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
const advance = (s: GameState, seconds: number) => { for (let i = 0; i < seconds * 20; i++) stepGame(s, .05); };
function build(s: GameState, role: BuildingRole, definitionId?: string) {
  const worker = s.entities.find(e => e.side === 0 && e.role === 'worker')!;
  for (let y = 2.5; y < s.height - 2; y++) for (let x = 2.5; x < s.width - 2; x++) if (canPlace(s, 0, role, x, y, definitionId)) {
    expect(issueCommand(s, 0, { type: 'build', ids: [worker.id], role, definitionId, x, y })).toBe(true);
    const e = s.entities.at(-1)!; advance(s, 70); expect(e.progress).toBe(1); return e;
  }
  throw new Error('No construction site.');
}
function setup(faction: BuiltinFactionId = 'fairies') {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContextStub());
  const root = document.createElement('div'); document.body.append(root);
  const shell = mountShell(root, () => {}); shell.showGame();
  const state = createMatch({ map: { seed: 4127, size: 'small' }, rules: { startingAge: 3 }, players: [
    { id: 0, teamId: 0, factionId: faction, controller: 'external', handicap: { startingResources: { wood: 5000, ore: 5000, crystal: 1000 } } },
    { id: 1, teamId: 1, factionId: 'orcs', controller: 'external' },
  ] });
  const barracks = build(state, 'barracks'), commands: Command[] = [];
  const command = vi.fn((c: Command) => { commands.push(c); return issueCommand(state, 0, c); });
  const callbacks = {
    command, isMuted: () => false, groups: () => ({}), cameraCorners: () => [], engineerBuild: vi.fn(), fieldRepair: vi.fn(),
    train: vi.fn((role: UnitRole, definitionId?: string) => issueCommand(state, 0, { type: 'train', id: barracks.id, role, definitionId })),
    build: vi.fn(),
  } as unknown as HudCallbacks;
  const update = (ids: number[]) => shell.update(state, ids, callbacks);
  const button = (label: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(b => b.getAttribute('aria-label') === label || b.textContent === label)!;
  const train = (definitionId: string) => {
    const def = availableUnits(state, 0).find(d => d.id === definitionId)!;
    expect(issueCommand(state, 0, { type: 'train', id: barracks.id, role: def.role, definitionId })).toBe(true);
    advance(state, def.trainTime + 1);
    return state.entities.find(e => e.side === 0 && e.definitionId === definitionId)!;
  };
  return { root, shell, state, barracks, callbacks, commands, command, update, button, train };
}

it.each([
  ['orcs', 'Gorak Ironvoice'], ['fairies', 'Queen Lyra'], ['dwarves', 'Thane Bera'],
  ['undead', 'Morwen Ashseer'], ['tideborn', 'Admiral Neri'], ['automata', 'Prime Artificer'],
] as const)('recruits the named %s commander and explains the queue and recovery limits', (faction, name) => {
  const { root, state, barracks, callbacks, update, button } = setup(faction);
  update([barracks.id]);
  button(name).click(); update([barracks.id]);
  expect(callbacks.train).toHaveBeenLastCalledWith('special', 'core:' + faction + '-commander');
  expect(barracks.queueDefinitionIds).toContain('core:' + faction + '-commander');
  expect(button(name).getAttribute('aria-disabled')).toBe('true');
  expect(button(name).dataset.tooltip).toContain('A commander is already alive or queued');
  button(name).click(); expect(callbacks.train).toHaveBeenCalledTimes(1);
  expect(root.querySelector('.queue-item')!.getAttribute('aria-label')).toContain(name);
  barracks.queue = []; barracks.queueDefinitionIds = []; barracks.queuePaidCosts = [];
  state.players[0].heroRecovery = [{ definitionId: 'core:' + faction + '-commander', availableAt: state.time + 30 }];
  update([barracks.id]); expect(button(name).dataset.tooltip).toContain('Commander recovery: 30s');
  state.time += 30; update([barracks.id]); expect(button(name).getAttribute('aria-disabled')).toBe('false');
});

it('offers earned role promotions and updates the rank, experience and combat stats after a choice', () => {
  const { root, state, commands, update, button, train } = setup();
  const ranged = train('fairy-ranged'), target = state.entities.find(e => e.side === 1 && e.role === 'melee')!;
  creditCombat(state, ranged, target, 30, true); creditCombat(state, ranged, target, 30, true);
  update([ranged.id]);
  expect(root.querySelector('#selection-veteran')!.textContent).toContain('Veteran · Rank 1 · 54 / 100 XP · Choose a promotion');
  expect(button('Promote Mothbow: Sharpshooter')).toBeDefined();
  expect(button('Promote Mothbow: Vanguard')).toBeUndefined();
  button('Promote Mothbow: Sharpshooter').click(); update([ranged.id]);
  expect(commands.at(-1)).toEqual({ type: 'promote', id: ranged.id, promotion: 'sharpshooter' });
  expect(ranged.veteran!.promotions).toEqual([{ rank: 1, id: 'sharpshooter' }]);
  expect(root.querySelector('#selection-stats')!.textContent).toContain('RNG 8');
  expect(root.querySelector('#selection-veteran')!.textContent).toContain('Sharpshooter');
  expect(root.querySelector('#specialist-controls')!.childElementCount).toBe(0);
});

it('recovers, equips, unequips and drops an observed artifact through the selected commander controls', () => {
  const { root, state, commands, update, button, train } = setup();
  const hero = train('core:fairies-commander'), item = createArtifact(state, 'core:ember-blade', hero);
  createArtifact(state, 'core:wind-charm', { x: state.width - 2, y: state.height - 2 });
  state.visible[0].add(Math.floor(hero.y) * state.width + Math.floor(hero.x));
  update([hero.id]);
  expect(root.querySelector('#specialist-controls')!.textContent).not.toContain('Wind Charm');
  button('Recover Ember Blade').click(); update([hero.id]);
  expect(item.holder).toBe(hero.id); expect(item.position).toBeUndefined();
  expect(commands.at(-1)).toEqual({ type: 'recoverArtifact', id: hero.id, artifact: item.id });
  button('Equip Ember Blade').click(); update([hero.id]);
  expect(hero.equipment!.weapon).toBe(item.id); expect(root.querySelector('#selection-stats')!.textContent).toContain('ATK 28.8');
  button('Unequip Ember Blade').click(); update([hero.id]);
  expect(hero.equipment!.weapon).toBeUndefined(); expect(root.querySelector('#selection-stats')!.textContent).toContain('ATK 23');
  button('Drop Ember Blade').click(); update([hero.id]);
  expect(commands.at(-1)).toEqual({ type: 'dropArtifact', id: hero.id, artifact: item.id });
  expect(item.position).toEqual({ x: hero.x, y: hero.y }); expect(item.holder).toBeUndefined();
  expect(button('Recover Ember Blade')).toBeDefined();
});

it('limits artifact recovery by distance and hides enemy equipment and experience', () => {
  const { root, state, commands, update, button, train } = setup();
  const hero = train('core:fairies-commander'), item = createArtifact(state, 'core:iron-aegis', { x: hero.x + 3, y: hero.y });
  state.visible[0].add(Math.floor(item.position!.y) * state.width + Math.floor(item.position!.x));
  update([hero.id]); expect(button('Recover Iron Aegis').disabled).toBe(true);
  expect(button('Recover Iron Aegis').title).toBe('Move within 2 tiles to recover');
  button('Recover Iron Aegis').click(); expect(commands).toHaveLength(0);
  const enemy = state.entities.find(e => e.side === 1 && e.role === 'melee')!;
  enemy.veteran = { experience: 299, rank: 3, nextSurvivalAt: 0, lastCombatAt: 0, pendingPromotion: 1, promotions: [] };
  state.visible[0].add(Math.floor(enemy.y) * state.width + Math.floor(enemy.x));
  update([enemy.id]);
  expect(root.querySelector('#selection-veteran')!.textContent).toBe('Champion · Rank 3');
  expect(root.querySelector('#specialist-controls')!.childElementCount).toBe(0);
});

it('offers engineer cursor actions and disables unaffordable or paused actions', () => {
  const { state, callbacks, update, button, train } = setup(), engineer = train('core:fairies-engineer');
  update([engineer.id]); button('Temporary bridge').click(); button('Field barricade').click(); button('Field repair').click();
  expect(callbacks.engineerBuild).toHaveBeenNthCalledWith(1, 'bridge');
  expect(callbacks.engineerBuild).toHaveBeenNthCalledWith(2, 'barricade'); expect(callbacks.fieldRepair).toHaveBeenCalledTimes(1);
  state.players[0].wood = 59; update([engineer.id]);
  expect(button('Temporary bridge').getAttribute('aria-disabled')).toBe('true'); button('Temporary bridge').click();
  expect(callbacks.engineerBuild).toHaveBeenCalledTimes(2);
  callbacks.isPaused = () => true; update([engineer.id]); button('Field repair').click();
  expect(callbacks.fieldRepair).toHaveBeenCalledTimes(1); expect(button('Field repair').dataset.tooltip).toContain('Battle paused');
});

it('shows the extra beacon build definition and reports its connection and invasion alert', () => {
  const { root, state, callbacks, update, button } = setup(), worker = state.entities.find(e => e.side === 0 && e.role === 'worker')!;
  update([worker.id]); button('Wild Court Signal Beacon').click(); expect(callbacks.build).toHaveBeenLastCalledWith('tower', 'core:fairies-beacon');
  const beacon = build(state, 'tower', 'core:fairies-beacon'), hq = state.entities.find(e => e.side === 0 && e.role === 'hq')!;
  beacon.x = hq.x + 3; beacon.y = hq.y; updateBeacons(state); update([beacon.id]);
  expect(root.querySelector('#selection-beacon')!.textContent).toContain('Beacon connected · Team vision shared');
  beacon.beacon!.nextAlertAt = state.time + 8; update([beacon.id]); expect(root.querySelector('#selection-beacon')!.textContent).toContain('Invasion alert');
  beacon.x = state.width - 2; beacon.y = state.height - 2; updateBeacons(state); update([beacon.id]);
  expect(root.querySelector('#selection-beacon')!.textContent).toContain('Beacon disconnected');
});
