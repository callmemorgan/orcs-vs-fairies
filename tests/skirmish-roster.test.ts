// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_OPENINGS, AI_PERSONALITIES, DEFAULT_AI_CONFIG, type AiConfig } from '../src/core/ai-policy';
import { FACTIONS } from '../src/core/content';
import { playerAge } from '../src/core/progression';
import { createMatch, isAllied, isHostile, isVisible, issueCommand, stepGame } from '../src/core/simulation';
import type { FactionId, MatchConfig } from '../src/core/types';
import { SkirmishRoster } from '../src/ui/SkirmishRoster';

const mounted: SkirmishRoster[] = [];
afterEach(() => {
  for (const roster of mounted.splice(0)) roster.destroy();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup(faction: FactionId = 'orcs', opponent: FactionId = 'fairies', ai: Partial<AiConfig> = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const onChange = vi.fn();
  const roster = new SkirmishRoster(root, onChange);
  mounted.push(roster);
  roster.updateDefaults?.(faction, opponent, ai);
  const players = () => roster.getPlayers(faction, opponent, ai);
  const config = (): MatchConfig => ({ map: { seed: 4127, size: 'huge' }, players: players(), rules: roster.getRules() });
  return { root, roster, onChange, players, config };
}

function field<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(root: ParentNode, label: string): T {
  const control = Array.from(root.querySelectorAll<T>('input,select')).find(element => element.getAttribute('aria-label') === label);
  expect(control, `Missing control ${label}`).toBeDefined();
  return control!;
}

function row(root: ParentNode, id: number): HTMLElement {
  const card = root.querySelector<HTMLElement>(`[data-roster-player="${id}"]`);
  expect(card, `Missing player ${id + 1}`).not.toBeNull();
  return card!;
}

function change(control: HTMLInputElement | HTMLSelectElement, value: string | boolean) {
  if (typeof value === 'boolean') (control as HTMLInputElement).checked = value;
  else control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function enable(root: ParentNode) {
  change(field(root, 'Enable team match setup'), true);
}

function preset(root: ParentNode, value: string) {
  change(field<HTMLSelectElement>(root, 'Match preset'), value);
}

function aiField(root: ParentNode, id: number, key: keyof AiConfig): HTMLSelectElement {
  const control = row(root, id).querySelector<HTMLSelectElement>(`[data-ai-option="${key}"]`);
  expect(control, `Missing player ${id + 1} AI ${key}`).not.toBeNull();
  return control!;
}

function injectValue(control: HTMLSelectElement, value: string) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  control.append(option);
  control.value = value;
}

function advance(state: ReturnType<typeof createMatch>, seconds: number) {
  for (let tick = 0; tick < Math.ceil(seconds / .25); tick++) stepGame(state, .25);
}

describe('local skirmish roster', () => {
  it('keeps the legacy duel as the default and uses the selected faction cards and AI config', () => {
    const { root, roster, players, onChange, config } = setup('undead', 'automata', { difficulty: 'hard', personality: 'raid' });
    expect(roster.enabled).toBe(false);
    expect(roster.localSide).toBe(0);
    expect(field(root, 'Enable team match setup').checked).toBe(false);
    const result = players();
    expect(result).toHaveLength(2);
    expect(result.map(player => [player.id, player.teamId, player.factionId, player.controller])).toEqual([
      [0, 0, 'undead', 'human'], [1, 1, 'automata', 'ai'],
    ]);
    const state = createMatch(config());
    expect(state.aiConfigs[1]).toEqual({ difficulty: 'hard', personality: 'raid', opening: 'cavalry-raids' });
    expect(state.players.map(player => [player.wood, player.ore, player.crystal])).toEqual([[420, 220, 0], [420, 220, 0]]);
    expect(state.incomeFactors).toEqual([1, 1]);
    expect(state.populationLimits).toEqual([100, 100]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses labelled native controls and keeps the local human fixed to the faction card', () => {
    const { root, roster, players } = setup('tideborn', 'dwarves');
    enable(root);
    expect(roster.enabled).toBe(true);
    expect(field(root, 'Enable team match setup').type).toBe('checkbox');
    expect(Array.from(field<HTMLSelectElement>(root, 'Player count').options, option => option.value)).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(Array.from(field<HTMLSelectElement>(root, 'Starting age').options, option => option.value)).toEqual(['1', '2', '3']);
    expect(field(root, 'Shared team vision').type).toBe('checkbox');
    for (let id = 0; id < 2; id++) {
      const card = row(root, id);
      expect(card.textContent).toContain(`Player ${id + 1}`);
      expect(field<HTMLSelectElement>(card, `Player ${id + 1} faction`).disabled).toBe(true);
      const controller = field<HTMLSelectElement>(card, `Player ${id + 1} controller`);
      expect(controller.value).toBe(id === 0 ? 'human' : 'ai');
      expect(controller.disabled).toBe(true);
      const teams = field<HTMLSelectElement>(card, `Player ${id + 1} team`);
      expect(Array.from(teams.options, option => [option.value, option.textContent])).toEqual(
        Array.from({ length: 8 }, (_, team) => [String(team), `Team ${team + 1}`]),
      );
    }
    expect(row(root, 0).querySelector('[data-ai-option]')).toBeNull();
    expect(players().map(player => player.factionId)).toEqual(['tideborn', 'dwarves']);
  });

  it.each([
    ['duel', 2], ['2v2', 4], ['3v3', 6], ['4v4', 8],
  ] as const)('turns the %s preset into a complete playable %s-player match', (name, count) => {
    const { root, roster, config } = setup();
    enable(root);
    preset(root, name);
    expect(field<HTMLSelectElement>(root, 'Player count').value).toBe(String(count));
    expect(root.querySelectorAll('[data-roster-player]')).toHaveLength(count);
    const match = config();
    expect(match.players.map(player => player.id)).toEqual(Array.from({ length: count }, (_, id) => id));
    expect(match.players.filter(player => player.controller === 'human').map(player => player.id)).toEqual([roster.localSide]);
    expect(match.players.slice(1).every(player => player.controller === 'ai')).toBe(true);
    expect(new Set(match.players.map(player => player.teamId)).size).toBe(2);
    for (const team of new Set(match.players.map(player => player.teamId))) {
      expect(match.players.filter(player => player.teamId === team)).toHaveLength(count / 2);
    }
    const state = createMatch(match);
    expect(state.players).toHaveLength(count);
    expect(state.teams).toEqual(match.players.map(player => player.teamId));
    expect(state.controllers).toEqual(match.players.map(player => player.controller));
    expect(state.sharedVision).toBe(match.rules!.sharedVision);
    expect(state.starts).toHaveLength(count);
    for (const player of match.players) {
      expect(state.entities.filter(entity => entity.side === player.id && entity.role === 'worker')).toHaveLength(5);
      expect(state.entities.filter(entity => entity.side === player.id && entity.role === 'hq')).toHaveLength(1);
      expect(state.aiConfigs[player.id]).toEqual(DEFAULT_AI_CONFIG);
      expect(playerAge(state.players[player.id])).toBe(match.rules!.startingAge);
    }
  });

  it('makes co-op a human and AI ally against two AI opponents with shared vision', () => {
    const { root, config } = setup();
    enable(root);
    change(field(root, 'Shared team vision'), false);
    preset(root, 'co-op');
    const match = config();
    expect(match.players).toHaveLength(4);
    expect(match.players[0].controller).toBe('human');
    expect(match.players.slice(1).every(player => player.controller === 'ai')).toBe(true);
    expect(match.rules!.sharedVision).toBe(true);
    const state = createMatch(match);
    const ally = match.players.slice(1).find(player => player.teamId === match.players[0].teamId)!;
    const hostiles = match.players.filter(player => player.teamId !== match.players[0].teamId);
    expect(ally).toBeDefined();
    expect(hostiles).toHaveLength(2);
    expect(isAllied(state, 0, ally.id)).toBe(true);
    for (const enemy of hostiles) expect(isHostile(state, 0, enemy.id)).toBe(true);
    expect([...state.visible[0]].sort()).toEqual([...state.visible[ally.id]].sort());
  });

  it.each([2, 3, 4, 5, 6, 7, 8])('supports a custom %s-player roster with more than two teams', count => {
    const { root, config } = setup('fairies', 'orcs');
    enable(root);
    preset(root, 'custom');
    change(field<HTMLSelectElement>(root, 'Player count'), String(count));
    for (let id = 0; id < count; id++) change(field<HTMLSelectElement>(row(root, id), `Player ${id + 1} team`), String(id % 3));
    const match = config();
    expect(match.players).toHaveLength(count);
    expect(match.players.map(player => player.teamId)).toEqual(Array.from({ length: count }, (_, id) => id % 3));
    const state = createMatch(match);
    expect(state.teams).toEqual(match.players.map(player => player.teamId));
    expect(state.players[0].faction).toBe('fairies');
  });

  it('inherits the opponent faction for unedited CPU rows and retains concrete overrides when cards change', () => {
    const { root, roster, players } = setup('orcs', 'fairies');
    enable(root);
    preset(root, '2v2');
    for (let id = 1; id < 4; id++) expect(field<HTMLSelectElement>(row(root, id), `Player ${id + 1} faction`).value).toBe('');
    change(field<HTMLSelectElement>(row(root, 2), 'Player 3 faction'), 'automata');
    expect(players().map(player => player.factionId)).toEqual(['orcs', 'fairies', 'automata', 'fairies']);
    roster.updateDefaults?.('undead', 'dwarves');
    expect(roster.getPlayers('undead', 'dwarves').map(player => player.factionId)).toEqual(['undead', 'dwarves', 'automata', 'dwarves']);
    change(field<HTMLSelectElement>(row(root, 2), 'Player 3 faction'), '');
    expect(roster.getPlayers('undead', 'dwarves')[2].factionId).toBe('dwarves');
  });

  it('takes the legacy selected faction cards again when reduced back to a duel', () => {
    const { root, roster } = setup();
    enable(root);
    preset(root, '4v4');
    change(field<HTMLSelectElement>(row(root, 1), 'Player 2 faction'), 'undead');
    preset(root, 'duel');
    const result = roster.getPlayers('dwarves', 'tideborn');
    expect(result.map(player => player.factionId)).toEqual(['dwarves', 'tideborn']);
    const opponent = field<HTMLSelectElement>(row(root, 1), 'Player 2 faction');
    expect(opponent.disabled).toBe(true);
    expect(opponent.value).toBe('');
    expect(opponent.selectedOptions[0].textContent).toBe(`Selected opponent: ${FACTIONS.tideborn.name}`);
  });

  it('configures AI separately for every CPU and applies personality openings before the callback', () => {
    const { root, players, onChange, config } = setup();
    enable(root);
    preset(root, '2v2');
    onChange.mockClear();
    const personality = aiField(root, 2, 'personality');
    onChange.mockImplementation(() => {
      expect(players()[2].ai!.opening).toBe('tower-defense');
      expect(aiField(root, 2, 'opening').value).toBe('tower-defense');
      expect(row(root, 2).querySelector('[data-ai-opening-weakness]')!.textContent).toContain(AI_OPENINGS['tower-defense'].weakness);
    });
    change(personality, 'fortify');
    expect(onChange).toHaveBeenCalledTimes(1);
    onChange.mockReset();
    change(aiField(root, 1, 'difficulty'), 'easy');
    change(aiField(root, 3, 'opening'), 'cavalry-raids');
    expect(players().slice(1).map(player => player.ai)).toEqual([
      { difficulty: 'easy', personality: 'balanced', opening: 'infantry-rush' },
      { difficulty: 'normal', personality: 'fortify', opening: 'tower-defense' },
      { difficulty: 'normal', personality: 'balanced', opening: 'cavalry-raids' },
    ]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(createMatch(config()).aiConfigs.slice(1)).toEqual(players().slice(1).map(player => player.ai));
  });

  it.each(Object.entries(AI_PERSONALITIES))('shows the %s CPU personality plan and its weakness', (personality, definition) => {
    const { root, players } = setup();
    enable(root);
    preset(root, '2v2');
    if (personality === 'balanced') change(aiField(root, 1, 'personality'), 'rush');
    change(aiField(root, 1, 'personality'), personality);
    const ai = players()[1].ai!;
    expect(ai.personality).toBe(personality);
    expect(ai.opening).toBe(definition.opening);
    expect(row(root, 1).querySelector('[data-ai-opening-plan]')!.textContent).toContain(AI_OPENINGS[definition.opening].plan);
    expect(row(root, 1).querySelector('[data-ai-opening-weakness]')!.textContent).toContain(AI_OPENINGS[definition.opening].weakness);
  });

  it('shows explicit handicaps for every player and applies custom resources, income, population, age and vision', () => {
    const { root, config } = setup('automata', 'tideborn');
    enable(root);
    preset(root, '2v2');
    change(field(root, 'Shared team vision'), false);
    change(field<HTMLSelectElement>(root, 'Starting age'), '3');
    for (let id = 0; id < 4; id++) {
      const card = row(root, id);
      expect(card.querySelector('details')).not.toBeNull();
      const summary = card.querySelector<HTMLElement>('.skirmish-roster-handicap-summary')!;
      expect(summary.closest('details')).toBeNull();
      expect(summary.hidden).toBe(false);
      expect(summary.textContent).toContain('420 wood, 220 ore, 0 crystal');
      expect(summary.textContent).toContain('Income ×1');
      expect(summary.textContent).toContain('Population limit 100');
      change(field(card, `Player ${id + 1} starting wood`), String(500 + id));
      change(field(card, `Player ${id + 1} starting ore`), String(300 + id));
      change(field(card, `Player ${id + 1} starting crystal`), String(40 + id));
      change(field(card, `Player ${id + 1} income factor`), String(.5 + id * .5));
      change(field(card, `Player ${id + 1} population cap`), String(20 + id));
      expect(summary.textContent).toContain(`${500 + id} wood, ${300 + id} ore, ${40 + id} crystal`);
      expect(summary.textContent).toContain(`Income ×${.5 + id * .5}`);
      expect(summary.textContent).toContain(`Population limit ${20 + id}`);
    }
    const state = createMatch(config());
    expect(state.sharedVision).toBe(false);
    expect(state.incomeFactors).toEqual([.5, 1, 1.5, 2]);
    expect(state.populationLimits).toEqual([20, 21, 22, 23]);
    for (let id = 0; id < 4; id++) {
      expect(state.players[id]).toMatchObject({ wood: 500 + id, ore: 300 + id, crystal: 40 + id });
      expect(playerAge(state.players[id])).toBe(3);
      expect(state.players[id].upgrades).toContain('citadel-age');
    }
  });

  it.each([1, 2, 3] as const)('starts every player at age %s selected in the roster', age => {
    const { root, config } = setup();
    enable(root);
    preset(root, '3v3');
    change(field<HTMLSelectElement>(root, 'Starting age'), String(age));
    const state = createMatch(config());
    expect(state.players.map(playerAge)).toEqual(Array(6).fill(age));
    for (const player of state.players) {
      expect(player.upgrades.includes('town-age')).toBe(age >= 2);
      expect(player.upgrades.includes('citadel-age')).toBe(age === 3);
    }
  });

  it('uses a zero-resource, zero-income, minimum-cap handicap without substituting defaults', () => {
    const { root, config } = setup();
    enable(root);
    for (const resource of ['wood', 'ore', 'crystal']) change(field(row(root, 1), `Player 2 starting ${resource}`), '0');
    change(field(row(root, 1), 'Player 2 income factor'), '0');
    change(field(row(root, 1), 'Player 2 population cap'), '1');
    const state = createMatch(config());
    expect(state.players[1]).toMatchObject({ wood: 0, ore: 0, crystal: 0, population: 6, cap: 1 });
    expect(state.incomeFactors[1]).toBe(0);
    const hq = state.entities.find(entity => entity.side === 1 && entity.role === 'hq')!;
    expect(issueCommand(state, 1, { type: 'train', id: hq.id, role: 'worker' })).toBe(false);
    const deposited: number[] = [];
    for (let tick = 0; tick < 240; tick++) {
      stepGame(state, .25);
      deposited.push(...state.events.filter(event => event.type === 'gather' && event.side === 1).map(event => event.amount!));
    }
    expect(deposited.length).toBeGreaterThan(0);
    expect(deposited.every(amount => amount === 0)).toBe(true);
    expect(state.players[1].wood).toBe(0);
  });

  it('changes real delivered harvest income from the human handicap', () => {
    function harvest(factor: number) {
      const { root, config } = setup();
      enable(root);
      change(field(row(root, 0), 'Player 1 income factor'), String(factor));
      const state = createMatch(config());
      const worker = state.entities.find(entity => entity.side === 0 && entity.role === 'worker')!;
      const node = state.resources.filter(resource => resource.kind === 'wood' && isVisible(state, 0, resource.x, resource.y))
        .sort((a, b) => Math.hypot(a.x - worker.x, a.y - worker.y) - Math.hypot(b.x - worker.x, b.y - worker.y))[0];
      expect(node).toBeDefined();
      const before = { wood: state.players[0].wood, amount: node.amount };
      expect(issueCommand(state, 0, { type: 'gather', ids: [worker.id], target: node.id })).toBe(true);
      advance(state, 40);
      return { income: state.players[0].wood - before.wood, extracted: before.amount - node.amount, carried: worker.carried };
    }
    const ordinary = harvest(1), doubled = harvest(2);
    expect(ordinary.income).toBeGreaterThan(0);
    expect(doubled.income).toBeCloseTo(ordinary.income * 2, 6);
    expect(doubled.extracted).toBeCloseTo(ordinary.extracted, 6);
    expect(doubled.carried).toBeCloseTo(ordinary.carried, 6);
  });

  it.each(['2v2', '4v4'])('runs every local CPU economy from the %s UI config', name => {
    const { root, config } = setup();
    enable(root);
    preset(root, name);
    for (let id = 1; id < root.querySelectorAll('[data-roster-player]').length; id++) {
      for (const resource of ['wood', 'ore', 'crystal']) change(field(row(root, id), `Player ${id + 1} starting ${resource}`), '0');
    }
    const state = createMatch(config());
    expect(state.players.slice(1).every(player => player.wood === 0 && player.ore === 0 && player.crystal === 0)).toBe(true);
    const deposits = state.players.map(() => 0), trains = state.players.map(() => 0);
    for (let tick = 0; tick < 400; tick++) {
      stepGame(state, .25);
      for (const event of state.events) {
        if (event.type === 'gather') deposits[event.side] += event.amount ?? 0;
        if (event.type === 'train') trains[event.side]++;
      }
    }
    for (let side = 1; side < state.players.length; side++) {
      expect(deposits[side], `Player ${side + 1} never deposited resources`).toBeGreaterThan(0);
      expect(trains[side], `Player ${side + 1} never trained a unit`).toBeGreaterThan(0);
      expect(state.entities.some(entity => entity.side === side && entity.role === 'barracks'), `Player ${side + 1} never funded barracks construction`).toBe(true);
      expect(state.players[side].wood).toBeGreaterThanOrEqual(0);
      expect(state.players[side].ore).toBeGreaterThanOrEqual(0);
    }
    expect(deposits[0]).toBe(0);
    expect(trains[0]).toBe(0);
    expect(state.entities.filter(entity => entity.side === 0 && entity.role === 'worker').every(worker => worker.order.type === 'idle')).toBe(true);
  }, 30_000);

  it('returns detached player, AI, handicap, resource and rules objects', () => {
    const { root, roster, players, config } = setup();
    enable(root);
    preset(root, '2v2');
    const first = players(), second = players(), rules = roster.getRules();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    for (let id = 0; id < 4; id++) {
      expect(second[id]).not.toBe(first[id]);
      expect(second[id].handicap).not.toBe(first[id].handicap);
      expect(second[id].handicap!.startingResources).not.toBe(first[id].handicap!.startingResources);
      if (id > 0) {
        expect(second[id].ai).not.toBe(first[id].ai);
        expect(first[id].ai).not.toBe(first[1 + id % 3].ai);
      }
    }
    first[0].factionId = 'undead';
    first[0].teamId = 7;
    first[0].handicap!.startingResources!.wood = 999;
    first[0].handicap!.incomeFactor = 8;
    first[0].handicap!.populationCap = 1;
    first[1].ai!.difficulty = 'hard';
    first.splice(2);
    rules.startingAge = 3;
    rules.sharedVision = !rules.sharedVision;
    expect(players()).toEqual(second);
    expect(roster.getRules()).not.toEqual(rules);
    const state = createMatch(config());
    expect(state.players[0]).toMatchObject({ faction: 'orcs', wood: 420 });
    expect(state.aiConfigs[1].difficulty).toBe('normal');
  });

  it('copies defaults and updates untouched AI rows without losing CPU edits or focused drafts', () => {
    const initial: Partial<AiConfig> = { difficulty: 'easy', personality: 'expand' };
    const { root, roster, onChange } = setup('orcs', 'fairies', initial);
    enable(root);
    preset(root, '2v2');
    initial.difficulty = 'hard';
    expect(roster.getPlayers('orcs', 'fairies')[1].ai!.difficulty).toBe('easy');
    change(aiField(root, 2, 'difficulty'), 'hard');
    const wood = field(row(root, 2), 'Player 3 starting wood');
    wood.focus();
    change(wood, '731');
    const card = row(root, 2), opening = aiField(root, 2, 'opening');
    onChange.mockClear();
    const next: Partial<AiConfig> = { difficulty: 'normal', personality: 'fortify' };
    roster.updateDefaults?.('undead', 'automata', next);
    next.personality = 'rush';
    expect(row(root, 2)).toBe(card);
    expect(field(row(root, 2), 'Player 3 starting wood')).toBe(wood);
    expect(aiField(root, 2, 'opening')).toBe(opening);
    expect(document.activeElement).toBe(wood);
    const result = roster.getPlayers('undead', 'automata');
    expect(result[1].ai).toEqual({ difficulty: 'normal', personality: 'fortify', opening: 'tower-defense' });
    expect(result[2].ai!.difficulty).toBe('hard');
    expect(result[2].handicap!.startingResources!.wood).toBe(731);
    expect(result[0].factionId).toBe('undead');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits one callback per semantic edit and leaves controls and focus intact', () => {
    const { root, roster, onChange, players } = setup();
    const checkbox = field(root, 'Enable team match setup');
    change(checkbox, true);
    expect(onChange).toHaveBeenCalledTimes(1);
    preset(root, '2v2');
    expect(onChange).toHaveBeenCalledTimes(2);
    const team = field<HTMLSelectElement>(row(root, 2), 'Player 3 team');
    team.focus();
    change(team, '7');
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(field(row(root, 2), 'Player 3 team')).toBe(team);
    expect(document.activeElement).toBe(team);
    const wood = field(row(root, 2), 'Player 3 starting wood');
    wood.focus();
    change(wood, '600');
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(field(row(root, 2), 'Player 3 starting wood')).toBe(wood);
    expect(document.activeElement).toBe(wood);
    players();
    roster.getRules();
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('disabling team setup returns the legacy duel without applying custom player handicaps', () => {
    const { root, roster } = setup();
    enable(root);
    preset(root, '4v4');
    change(field(row(root, 0), 'Player 1 starting wood'), '999');
    change(aiField(root, 1, 'difficulty'), 'easy');
    change(field(root, 'Enable team match setup'), false);
    expect(roster.enabled).toBe(false);
    const players = roster.getPlayers('dwarves', 'undead', { difficulty: 'hard', personality: 'raid' });
    const state = createMatch({ map: { seed: 4127 }, players, rules: roster.getRules() });
    expect(players.map(player => [player.teamId, player.factionId, player.controller])).toEqual([[0, 'dwarves', 'human'], [1, 'undead', 'ai']]);
    expect(state.players[0].wood).toBe(420);
    expect(state.aiConfigs[1]).toEqual({ difficulty: 'hard', personality: 'raid', opening: 'cavalry-raids' });
  });

  it('removes its listeners and owned DOM while preserving neighboring menu controls', () => {
    const { root, roster, onChange } = setup();
    enable(root);
    const checkbox = field(root, 'Enable team match setup');
    const wood = field(row(root, 1), 'Player 2 starting wood');
    const difficulty = aiField(root, 1, 'difficulty');
    const sibling = document.createElement('button');
    sibling.textContent = 'Start match';
    root.append(sibling);
    const otherChange = vi.fn();
    const other = new SkirmishRoster(root, otherChange);
    mounted.push(other);
    const ids = Array.from(root.querySelectorAll('[id]'), element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    onChange.mockClear();
    roster.destroy();
    roster.destroy();
    change(checkbox, false);
    change(wood, '999');
    change(difficulty, 'hard');
    roster.updateDefaults?.('undead', 'automata');
    expect(onChange).not.toHaveBeenCalled();
    expect(root.contains(sibling)).toBe(true);
    expect(root.querySelectorAll('[aria-label="Enable team match setup"]')).toHaveLength(1);
    enable(root);
    expect(otherChange).toHaveBeenCalledTimes(1);
    expect(other.enabled).toBe(true);
    expect(() => roster.getPlayers('orcs', 'fairies')).toThrow('closed');
    expect(() => roster.getRules()).toThrow('closed');
  });

  it('disposes removed CPU row listeners before rebuilding a smaller roster', () => {
    const { root, players, onChange } = setup();
    enable(root);
    preset(root, '4v4');
    const old = row(root, 7);
    const wood = field(old, 'Player 8 starting wood');
    const difficulty = aiField(root, 7, 'difficulty');
    change(wood, '1234');
    change(difficulty, 'hard');
    preset(root, 'duel');
    onChange.mockClear();
    change(wood, '9999');
    change(difficulty, 'easy');
    expect(old.isConnected).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(players()).toHaveLength(2);
    preset(root, '4v4');
    const replacement = row(root, 7);
    expect(replacement).not.toBe(old);
    expect(field(replacement, 'Player 8 starting wood').value).toBe('420');
    expect(aiField(root, 7, 'difficulty').value).toBe('normal');
    onChange.mockClear();
    change(field(replacement, 'Player 8 starting wood'), '650');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(players()[7].handicap!.startingResources!.wood).toBe(650);
  });
});

describe('roster configuration validation', () => {
  it.each([
    ['starting wood', ''], ['starting wood', '-1'], ['starting wood', 'NaN'], ['starting wood', 'Infinity'], ['starting wood', '1000000001'],
    ['starting ore', ''], ['starting ore', '-1'], ['starting crystal', ''], ['starting crystal', '-1'],
    ['income factor', ''], ['income factor', '-.1'], ['income factor', '10.1'], ['income factor', 'Infinity'],
    ['population cap', ''], ['population cap', '0'], ['population cap', '501'], ['population cap', '7.5'], ['population cap', 'NaN'],
  ])('rejects invalid Player 2 %s %s instead of using a fallback', (name, value) => {
    const { root, players } = setup();
    enable(root);
    const control = field(row(root, 1), `Player 2 ${name}`);
    control.value = value;
    expect(() => players()).toThrow();
  });

  it.each(['', '-1', '8', '1.5', 'NaN', 'Infinity'])('rejects invalid team %s before match creation', value => {
    const { root, players } = setup();
    enable(root);
    injectValue(field<HTMLSelectElement>(row(root, 1), 'Player 2 team'), value);
    expect(() => players()).toThrow();
  });

  it('rejects a roster with no opposing team', () => {
    const { root, players } = setup();
    enable(root);
    preset(root, '2v2');
    for (let id = 0; id < 4; id++) change(field<HTMLSelectElement>(row(root, id), `Player ${id + 1} team`), '3');
    expect(() => players()).toThrow();
  });

  it('shows invalid draft feedback, preserves focused input, and recovers after correction', () => {
    const { root, players } = setup();
    enable(root);
    const wood = field(row(root, 1), 'Player 2 starting wood');
    wood.focus();
    change(wood, '');
    const alert = root.querySelector<HTMLElement>('[role="alert"]')!;
    expect(alert.hidden).toBe(false);
    expect(alert.textContent).toContain('Player 2');
    expect(alert.textContent).toContain('wood');
    expect(() => players()).toThrow();
    expect(document.activeElement).toBe(wood);
    expect(wood.value).toBe('');
    change(wood, '180');
    expect(alert.hidden).toBe(true);
    expect(players()[1].handicap!.startingResources!.wood).toBe(180);
    expect(field(row(root, 1), 'Player 2 starting wood')).toBe(wood);
    expect(document.activeElement).toBe(wood);
  });

  it('restores unsupported player count changes without creating or removing slots', () => {
    const { root, players, onChange } = setup();
    enable(root);
    preset(root, '2v2');
    onChange.mockClear();
    const count = field<HTMLSelectElement>(root, 'Player count');
    for (const value of ['', '1', '9', '3.5', 'NaN']) {
      injectValue(count, value);
      change(count, value);
      expect(count.value).toBe('4');
      expect(players()).toHaveLength(4);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['difficulty', 'personality', 'opening'] as const)('restores invalid CPU %s choices without changing its validated AI config', key => {
    const { root, players, onChange } = setup();
    enable(root);
    change(aiField(root, 1, 'difficulty'), 'hard');
    const previous = players()[1].ai;
    onChange.mockClear();
    const control = aiField(root, 1, key);
    injectValue(control, 'unknown');
    change(control, 'unknown');
    expect(players()[1].ai).toEqual(previous);
    expect(control.value).toBe(previous![key]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects unknown CPU faction values and fixed controller overrides', () => {
    const { root, players } = setup();
    enable(root);
    preset(root, '2v2');
    const faction = field<HTMLSelectElement>(row(root, 2), 'Player 3 faction');
    injectValue(faction, 'unknown');
    expect(() => players()).toThrow();
    faction.value = '';
    const controller = field<HTMLSelectElement>(row(root, 2), 'Player 3 controller');
    injectValue(controller, 'external');
    expect(() => players()).toThrow();
  });

  it.each(['', '0', '4', 'NaN'])('rejects invalid starting age %s', value => {
    const { root, roster } = setup();
    enable(root);
    injectValue(field<HTMLSelectElement>(root, 'Starting age'), value);
    expect(() => roster.getRules()).toThrow();
  });

  it('rejects invalid selected faction cards and AI configuration', () => {
    const { roster } = setup();
    expect(() => roster.getPlayers('unknown' as FactionId, 'fairies')).toThrow();
    expect(() => roster.getPlayers('orcs', 'unknown' as FactionId)).toThrow();
    expect(() => roster.getPlayers('orcs', 'fairies', { difficulty: 'unknown' } as never)).toThrow();
    expect(() => roster.getPlayers('orcs', 'fairies', { personality: 'unknown' } as never)).toThrow();
    expect(() => roster.getPlayers('orcs', 'fairies', { opening: 'unknown' } as never)).toThrow();
  });

  it('accepts the maximum supported handicap and preserves fractional resources', () => {
    const { root, config } = setup();
    enable(root);
    change(field(row(root, 0), 'Player 1 starting wood'), '1000000000');
    change(field(row(root, 0), 'Player 1 starting ore'), '2.5');
    change(field(row(root, 0), 'Player 1 starting crystal'), '.75');
    change(field(row(root, 0), 'Player 1 income factor'), '10');
    change(field(row(root, 0), 'Player 1 population cap'), '500');
    const state = createMatch(config());
    expect(state.players[0]).toMatchObject({ wood: 1000000000, ore: 2.5, crystal: .75 });
    expect(state.incomeFactors[0]).toBe(10);
    expect(state.populationLimits[0]).toBe(500);
  });

  it('renders faction names as text without creating markup', () => {
    const original = FACTIONS.automata.name;
    try {
      FACTIONS.automata.name = '<img src=x onerror=alert(1)>';
      const { root } = setup();
      enable(root);
      preset(root, '2v2');
      const options = field<HTMLSelectElement>(row(root, 2), 'Player 3 faction').options;
      expect(Array.from(options).find(option => option.value === 'automata')!.textContent).toContain(FACTIONS.automata.name);
      expect(root.querySelectorAll('img,script')).toHaveLength(0);
    } finally {
      FACTIONS.automata.name = original;
    }
  });
});
