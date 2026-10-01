import { normalizeAiConfig, type AiConfig } from '../core/ai-policy';
import { contentFactions, type ContentBundle } from '../core/content-registry';
import { AGE_NAMES } from '../core/progression';
import type { Age, Cost, FactionId, MatchConfig, MatchRules, MatchPlayerConfig, Side } from '../core/types';
import { MATCH_RULE_DEFAULTS, MatchRulesForm } from './MatchRules';
import { SkirmishOptions } from './SkirmishOptions';
import './skirmish-roster.css';

type Preset = 'duel' | '2v2' | '3v3' | '4v4' | 'co-op' | 'custom';
type Rules = MatchRules;
type HandicapKey = keyof Cost | 'income' | 'population';
interface PlayerRow {
  id: Side;
  card: HTMLElement;
  faction: HTMLSelectElement;
  team: HTMLSelectElement;
  controller: HTMLSelectElement;
  inputs: Record<HandicapKey, HTMLInputElement>;
  summary: HTMLElement;
  ai?: SkirmishOptions;
  aiEdited: boolean;
  resourceEdited: boolean;
  removeListeners: Array<() => void>;
}
const colors = ['#efb86b', '#8fbded', '#f08c7c', '#b9a0ef', '#9dcc82', '#e99cc4', '#82d7d3', '#e0d78a'];
const presets: Record<Preset, string> = {
  duel: 'Duel', '2v2': '2 vs 2', '3v3': '3 vs 3', '4v4': '4 vs 4', 'co-op': 'Co-op: you and a computer ally', custom: 'Custom teams',
};
const defaults: Record<HandicapKey, number> = { wood: 420, ore: 220, crystal: 0, income: 1, population: 100 };
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function label(parent: HTMLElement, name: string, control: HTMLElement) {
  const node = element('label', name); node.append(control); parent.append(node);
}
function select(parent: HTMLElement, name: string, choices: ReadonlyArray<readonly [string, string]>) {
  const control = element('select'); control.setAttribute('aria-label', name);
  for (const [value, text] of choices) { const option = element('option', text); option.value = value; control.append(option); }
  label(parent, name, control); return control;
}
function faction(value: FactionId,content?:ContentBundle): FactionId {
  if (!Object.hasOwn(contentFactions(content), value)) throw new Error('Choose a known faction.'); return value;
}

/** Player 1 is the local human. Other slots are computer allies or opponents. */
export class SkirmishRoster {
  readonly localSide: Side = 0;
  private readonly host: HTMLElement;
  private readonly enable: HTMLInputElement;
  private readonly body: HTMLElement;
  private readonly customRules: MatchRulesForm;
  private readonly preset: HTMLSelectElement;
  private readonly count: HTMLSelectElement;
  private readonly sharedVision: HTMLInputElement;
  private readonly startingAge: HTMLSelectElement;
  private readonly playersHost: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly error: HTMLElement;
  private readonly rows: PlayerRow[] = [];
  private readonly removeListeners: Array<() => void> = [];
  private defaultFaction: FactionId = 'orcs';
  private defaultOpponent: FactionId = 'fairies';
  private defaultAi = normalizeAiConfig();
  private destroyed = false;
  private content:ContentBundle|undefined;
  setContent(content?:ContentBundle){if(this.destroyed)return;this.content=content;this.customRules.setContent(content);for(const row of this.rows){const current=row.faction.value;row.faction.replaceChildren();for(const [value,text] of [['',`${row.id===0?'Selected faction':'Selected opponent'}: ${contentFactions(content)[row.id===0?this.defaultFaction:this.defaultOpponent].name}`],...Object.values(contentFactions(content)).map(f=>[f.id,f.name])]){const option=element('option',text);option.value=value;row.faction.append(option);}row.faction.value=current;}this.refresh();}

  constructor(root: HTMLElement, private readonly onChange?: () => void) {
    this.host = element('section', undefined, 'skirmish-roster'); this.host.setAttribute('aria-label', 'Local team match setup');
    const header = element('div', undefined, 'skirmish-roster-header');
    this.enable = element('input'); this.enable.type = 'checkbox'; this.enable.setAttribute('aria-label', 'Enable team match setup');
    const enabledLabel = element('label', undefined, 'skirmish-roster-enable'); enabledLabel.append(this.enable, document.createTextNode('Enable team match setup')); header.append(enabledLabel);
    header.append(element('p', 'Player 1 is you. All other players are computers; teammates share victory. Co-op adds a computer ally.'));
    this.body = element('div', undefined, 'skirmish-roster-body'); this.body.hidden = true;
    const controls = element('div', undefined, 'skirmish-roster-controls');
    this.preset = select(controls, 'Match preset', Object.entries(presets));
    this.count = select(controls, 'Player count', Array.from({ length: 7 }, (_, index) => [String(index + 2), String(index + 2)] as const));
    this.sharedVision = element('input'); this.sharedVision.type = 'checkbox'; this.sharedVision.checked = true; this.sharedVision.setAttribute('aria-label', 'Shared team vision'); label(controls, 'Shared team vision', this.sharedVision);
    this.startingAge = select(controls, 'Starting age', ([1, 2, 3] as Age[]).map(age => [String(age), AGE_NAMES[age]]));
    this.summary = element('p', undefined, 'skirmish-roster-summary'); this.summary.setAttribute('aria-live', 'polite');
    this.error = element('p', undefined, 'skirmish-roster-error'); this.error.setAttribute('role', 'alert'); this.error.hidden = true;
    this.playersHost = element('div', undefined, 'skirmish-roster-players');
    this.customRules = new MatchRulesForm(this.body, { includeTeamSettings: false, onChange: () => { try { const resources = this.customRules.value.startingResources; for (const row of this.rows) if (!row.resourceEdited) for (const key of ['wood', 'ore', 'crystal'] as const) row.inputs[key].value = String(resources[key]); } catch {} this.refresh(); this.emit(); } });
    this.body.prepend(controls, this.summary, this.error); this.body.append(this.playersHost); this.host.append(header, this.body); root.append(this.host);
    this.resize(2); this.applyPreset('duel');
    this.listen(this.enable, 'change', () => { this.body.hidden = !this.enabled; this.refresh(); this.emit(); });
    this.listen(this.preset, 'change', () => {
      if (!Object.hasOwn(presets, this.preset.value)) { this.preset.value = 'custom'; this.refresh(); return; }
      this.applyPreset(this.preset.value as Preset); this.emit();
    });
    this.listen(this.count, 'change', () => {
      const count = Number(this.count.value);
      if (!Number.isInteger(count) || count < 2 || count > 8) { this.count.value = String(this.rows.length); return; }
      this.resize(count); this.preset.value = 'custom'; this.refresh(); this.emit();
    });
    this.listen(this.sharedVision, 'change', () => { this.refresh(); this.emit(); });
    this.listen(this.startingAge, 'change', () => { this.refresh(); this.emit(); });
    this.refresh();
  }

  get enabled(): boolean { return !this.destroyed && this.enable.checked; }

  updateDefaults(defaultFaction: FactionId, defaultOpponent: FactionId, aiConfig?: Partial<AiConfig>): void {
    if (this.destroyed) return;
    const ownFaction = faction(defaultFaction,this.content), ownOpponent = faction(defaultOpponent,this.content), ai = aiConfig === undefined ? this.defaultAi : normalizeAiConfig(aiConfig);
    this.defaultFaction = ownFaction; this.defaultOpponent = ownOpponent; this.defaultAi = ai;
    for (const row of this.rows) {
      row.faction.options[0].textContent = `${row.id === 0 ? 'Selected faction' : 'Selected opponent'}: ${contentFactions(this.content)[row.id === 0 ? this.defaultFaction : this.defaultOpponent].name}`;
      if (row.ai && !row.aiEdited) row.ai.update(this.defaultAi);
    }
    this.refresh();
  }

  getPlayers(defaultFaction: FactionId, defaultOpponent: FactionId, aiConfig?: Partial<AiConfig>): MatchPlayerConfig[] {
    if (this.destroyed) throw new Error('Match setup has been closed.');
    try {
      this.updateDefaults(defaultFaction, defaultOpponent, aiConfig);
      const players = this.enabled ? this.readPlayers() : [0, 1].map(id => ({
        id: id as Side, teamId: id as Side, factionId: id === 0 ? this.defaultFaction : this.defaultOpponent,
        controller: id === 0 ? 'human' as const : 'ai' as const, ...(id === 1 ? { ai: { ...this.defaultAi } } : {}),
      }));
      this.showError(''); return players;
    } catch (error) { this.showError(error instanceof Error ? error.message : 'Check the match setup.'); throw error; }
  }

  getRules(): Rules {
    if (this.destroyed) throw new Error('Match setup has been closed.');
    if (!this.enabled) return structuredClone(MATCH_RULE_DEFAULTS);
    const age = Number(this.startingAge.value);
    if (!Number.isInteger(age) || age < 1 || age > 3) { this.showError('Choose a starting age.'); throw new Error('Choose a starting age.'); }
    return { ...this.customRules.value, sharedVision: this.sharedVision.checked, startingAge: age as Age };
  }

  destroy(): void {
    if (this.destroyed) return; this.destroyed = true;
    for (const remove of this.removeListeners.splice(0)) remove();
    this.customRules.destroy();
    for (const row of this.rows.splice(0)) this.destroyRow(row);
    this.host.remove();
  }

  private listen(target: HTMLElement, type: string, run: () => void, removers = this.removeListeners): void {
    target.addEventListener(type, run); removers.push(() => target.removeEventListener(type, run));
  }
  private emit(): void { if (!this.destroyed) this.onChange?.(); }
  private showError(message: string): void { this.error.textContent = message; this.error.hidden = !message; }
  private applyPreset(preset: Preset): void {
    if (preset === 'custom') { this.refresh(); return; }
    const count = preset === 'duel' ? 2 : preset === '3v3' ? 6 : preset === '4v4' ? 8 : 4;
    this.resize(count);
    for (const row of this.rows) row.team.value = String(row.id < count / 2 ? 0 : 1);
    this.preset.value = preset; if (preset === 'co-op') this.sharedVision.checked = true; this.refresh();
  }
  private resize(count: number): void {
    while (this.rows.length > count) this.destroyRow(this.rows.pop()!);
    while (this.rows.length < count) { const row = this.makeRow(this.rows.length as Side); this.rows.push(row); this.playersHost.append(row.card); }
    this.count.value = String(count);
    for (const row of this.rows) { row.faction.disabled = row.id === 0 || count === 2; if (row.faction.disabled) row.faction.value = ''; }
  }
  private destroyRow(row: PlayerRow): void { for (const remove of row.removeListeners.splice(0)) remove(); row.ai?.destroy(); row.card.remove(); }
  private makeRow(id: Side): PlayerRow {
    const number = id + 1, card = element('section', undefined, 'skirmish-roster-player'); card.dataset.rosterPlayer = String(id); card.style.setProperty('--player-color', colors[id]); card.setAttribute('aria-label', `Player ${number} setup`);
    const heading = element('h3', undefined, 'skirmish-roster-player-heading'), swatch = element('span', String(number), 'skirmish-roster-player-number'); swatch.setAttribute('aria-hidden', 'true'); heading.append(swatch, document.createTextNode(`Player ${number}${id === 0 ? ' · You' : ' · Computer'}`)); card.append(heading);
    const fields = element('div', undefined, 'skirmish-roster-fields');
    const factionSelect = select(fields, `Player ${number} faction`, [['', `${id === 0 ? 'Selected faction' : 'Selected opponent'}: ${contentFactions(this.content)[id === 0 ? this.defaultFaction : this.defaultOpponent].name}`], ...Object.values(contentFactions(this.content)).map(f => [f.id, f.name] as const)]);
    const team = select(fields, `Player ${number} team`, Array.from({ length: 8 }, (_, team) => [String(team), `Team ${team + 1}`] as const)); team.value = String(id === 0 ? 0 : 1);
    const controller = select(fields, `Player ${number} controller`, [[id === 0 ? 'human' : 'ai', id === 0 ? 'You (local player)' : 'Computer (AI)']]); controller.disabled = true;
    const summary = element('p', undefined, 'skirmish-roster-handicap-summary'); summary.setAttribute('aria-live', 'polite');
    const handicap = element('details', undefined, 'skirmish-roster-handicap'); handicap.append(element('summary', 'Edit starting resources and handicap'));
    const handicapFields = element('div', undefined, 'skirmish-roster-handicap-fields'), inputs = {} as Record<HandicapKey, HTMLInputElement>;
    for (const [key, text] of [['wood', 'starting wood'], ['ore', 'starting ore'], ['crystal', 'starting crystal'], ['income', 'income factor'], ['population', 'population cap']] as [HandicapKey, string][]) {
      const input = element('input'); input.type = 'number'; input.min = key === 'population' ? '1' : '0'; input.max = key === 'income' ? '10' : key === 'population' ? '500' : '1000000000'; input.step = key === 'income' ? '0.05' : '1'; input.value = String(['wood', 'ore', 'crystal'].includes(key) ? this.customRules.value.startingResources[key as keyof Cost] : defaults[key]); input.setAttribute('aria-label', `Player ${number} ${text}`); inputs[key] = input; label(handicapFields, `Player ${number} ${text}`, input);
    }
    handicap.append(handicapFields, element('p', 'Income scales deposited resources. Population limit is the maximum supply; buildings still provide supply.'));
    card.append(fields, summary, handicap);
    const row: PlayerRow = { id, card, faction: factionSelect, team, controller, inputs, summary, aiEdited: false, resourceEdited: false, removeListeners: [] };
    if (id !== 0) {
      const ai = element('details', undefined, 'skirmish-roster-ai'); ai.open = true; ai.append(element('summary', `Player ${number} computer strategy`)); card.append(ai);
      row.ai = new SkirmishOptions(ai, this.defaultAi, () => { row.aiEdited = true; this.refresh(); this.emit(); });
      ai.querySelector('.skirmish-options')?.setAttribute('aria-label', `Player ${number} AI`);
      for (const control of Array.from(ai.querySelectorAll<HTMLSelectElement>('[data-ai-option]'))) {
        const name = `Player ${number} ${control.dataset.aiOption}`; control.setAttribute('aria-label', name);
        if (control.parentElement?.firstChild?.nodeType === Node.TEXT_NODE) control.parentElement.firstChild.textContent = name;
      }
    }
    this.listen(factionSelect, 'change', () => { this.refresh(); this.emit(); }, row.removeListeners);
    this.listen(team, 'change', () => { this.preset.value = 'custom'; this.refresh(); this.emit(); }, row.removeListeners);
    for (const [key, input] of Object.entries(inputs)) this.listen(input, 'input', () => { if (['wood', 'ore', 'crystal'].includes(key)) row.resourceEdited = true; this.refresh(); this.emit(); }, row.removeListeners);
    return row;
  }
  private number(row: PlayerRow, key: HandicapKey): number {
    const raw = row.inputs[key].value, value = raw.trim() === '' ? NaN : Number(raw), max = key === 'income' ? 10 : key === 'population' ? 500 : 1e9;
    if (!Number.isFinite(value) || value < (key === 'population' ? 1 : 0) || value > max || key === 'population' && !Number.isSafeInteger(value)) throw new Error(`Player ${row.id + 1}: enter a valid ${key === 'income' ? 'income factor from 0 to 10' : key === 'population' ? 'whole population limit from 1 to 500' : `starting ${key} amount from 0 to 1000000000`}.`);
    return value;
  }
  private readPlayers(): MatchPlayerConfig[] {
    const matchResources = this.customRules.value.startingResources;
    const players = this.rows.map(row => {
      const team = Number(row.team.value);
      if (!row.team.value || !Number.isInteger(team) || team < 0 || team > 7) throw new Error(`Player ${row.id + 1}: choose a team.`);
      if (row.controller.value !== (row.id === 0 ? 'human' : 'ai')) throw new Error('Player 1 must be the only local human; all other players must be computers.');
      const ownFaction = row.id === 0 ? this.defaultFaction : this.rows.length === 2 || !row.faction.value ? this.defaultOpponent : faction(row.faction.value as FactionId,this.content);
      const resources = { wood: this.number(row, 'wood'), ore: this.number(row, 'ore'), crystal: this.number(row, 'crystal') };
      const inherited = !row.resourceEdited;
      const player: MatchPlayerConfig = { id: row.id, teamId: team as Side, factionId: ownFaction, controller: row.id === 0 ? 'human' : 'ai', handicap: { startingResources: inherited ? { ...matchResources } : resources, incomeFactor: this.number(row, 'income'), populationCap: this.number(row, 'population') } };
      if (row.ai) player.ai = normalizeAiConfig(row.ai.value);
      return player;
    });
    if (new Set(players.map(player => player.teamId)).size < 2) throw new Error('Choose at least two opposing teams.');
    return players;
  }
  private refresh(): void {
    if (this.destroyed) return;
    for (const row of this.rows) {
      try { row.summary.textContent = `Starting resources: ${this.number(row, 'wood')} wood, ${this.number(row, 'ore')} ore, ${this.number(row, 'crystal')} crystal · Income ×${this.number(row, 'income')} · Population limit ${this.number(row, 'population')}`; }
      catch { row.summary.textContent = 'Complete the starting resources and handicap fields below.'; }
    }
    if (!this.enabled) { this.showError(''); this.summary.textContent = 'The selected faction and opponent start a standard duel.'; return; }
    try {
      const players = this.readPlayers(), rules = this.getRules(), teams = [...new Set(players.map(player => player.teamId))];
      this.summary.textContent = `${players.length} players · ${teams.map(team => `Team ${team + 1}: ${players.filter(player => player.teamId === team).map(player => `Player ${player.id + 1}`).join(', ')}`).join(' · ')} · ${rules.sharedVision ? 'Shared team vision' : 'Individual vision'} · ${AGE_NAMES[rules.startingAge]}`;
      this.showError('');
    } catch (error) { this.summary.textContent = 'Check the match setup before starting.'; this.showError(error instanceof Error ? error.message : 'Check the match setup.'); }
  }
}

export function mountSkirmishRoster(root: HTMLElement, onChange?: () => void): SkirmishRoster { return new SkirmishRoster(root, onChange); }
