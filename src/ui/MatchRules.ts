import { FACTIONS, UPGRADES } from '../core/content';
import { normalizeMatchRules, type MatchRules, type MatchRulesInput as CoreMatchRulesInput } from '../core/match-rules';
import './match-rules.css';

export type MatchRulesValue = MatchRules;
export type MatchRulesInput = CoreMatchRulesInput;
export type MatchMode = MatchRules['mode'];
export const MATCH_MODE_NAMES: Record<MatchMode, string> = {
  annihilation: 'Annihilation', hill: 'King of the hill', relic: 'Relic control', survival: 'Co-op survival', scenario: 'Scenario objectives',
};
export const MATCH_RULE_DEFAULTS = normalizeMatchRules();
export const MATCH_DEFINITIONS = [
  ...Object.values(FACTIONS).flatMap(faction => [
    ...Object.values(faction.units).map(definition => ({ ...definition, faction: faction.name, kind: 'Unit' })),
  ]),
  ...Object.values(UPGRADES).map(definition => ({ ...definition, faction: 'All factions', kind: 'Technology' })),
].map(({ id, name, faction, kind }) => ({ id, name, faction, kind }));
export const definitionName = (id: string) => MATCH_DEFINITIONS.find(definition => definition.id === id)?.name ?? id;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
};
interface RulesFormOptions { labelPrefix?: string; includeTeamSettings?: boolean; onChange?: () => void }

/** Reusable native controls for both local matches and server lobby settings. */
export class MatchRulesForm {
  readonly host: HTMLElement;
  private readonly controls = new Map<string, HTMLInputElement | HTMLSelectElement>();
  private readonly groups = new Map<string, HTMLElement>();
  private readonly error: HTMLElement;
  private readonly description: HTMLElement;
  private readonly disabledIds = new Set<string>();
  private destroyed = false;
  private readonly removeListeners: Array<() => void> = [];
  private readonly prefix: string;
  constructor(root: HTMLElement, private readonly options: RulesFormOptions = {}) {
    this.prefix = options.labelPrefix ?? '';
    this.host = element('section', undefined, 'match-rules-form'); this.host.setAttribute('aria-label', `${this.prefix}Custom match rules`);
    const common = element('div', undefined, 'match-rules-fields');
    this.select(common, 'mode', 'Victory mode', Object.entries(MATCH_MODE_NAMES));
    this.check(common, 'standardDefeat', 'Eliminate teams with no headquarters');
    this.check(common, 'friendlyFire', 'Allow damage to allied units');
    if (options.includeTeamSettings !== false) {
      this.select(common, 'startingAge', 'Starting age', [['1', 'Settlement'], ['2', 'Town'], ['3', 'Citadel']]);
      this.check(common, 'sharedVision', 'Shared team vision');
    }
    this.description = element('p', undefined, 'match-rules-description');
    this.error = element('p', undefined, 'match-rules-error'); this.error.setAttribute('role', 'alert'); this.error.hidden = true;
    this.host.append(common, this.description, this.error);
    const resources = this.group('resources', 'Match starting resources', false);
    for (const key of ['wood', 'ore', 'crystal'] as const) this.number(resources, `startingResources.${key}`, `Match starting ${key}`, 0, 1e9);
    resources.append(element('p', 'Player handicaps can override these amounts.'));
    const hill = this.group('hill', 'Hill objective');
    this.number(hill, 'hill.radius', 'Hill radius', 1, 12, .5);
    this.seconds(hill, 'hill.captureTicks', 'Hill capture seconds'); this.seconds(hill, 'hill.holdTicks', 'Hill hold seconds');
    const relic = this.group('relic', 'Relic objective');
    this.number(relic, 'relic.count', 'Relic count', 1, 8); this.number(relic, 'relic.required', 'Relics needed to win', 1, 8);
    this.seconds(relic, 'relic.holdTicks', 'Relic hold seconds'); this.number(relic, 'relic.pickupRadius', 'Relic pickup radius', .5, 4, .5);
    const survival = this.group('survival', 'Survival waves');
    this.select(survival, 'survival.defenderTeam', 'Defending team', Array.from({ length: 8 }, (_, side) => [String(side), `Team ${side + 1}`]));
    this.number(survival, 'survival.waveCount', 'Survival wave count', 1, 20); this.number(survival, 'survival.unitsPerWave', 'Units per wave', 1, 20);
    this.seconds(survival, 'survival.intervalTicks', 'Seconds before next wave'); this.seconds(survival, 'survival.recoveryTicks', 'Recovery seconds');
    for (const key of ['wood', 'ore', 'crystal'] as const) this.number(survival, `survival.rewardPerWave.${key}`, `Wave reward ${key}`, 0, 1e9);
    survival.append(element('p', 'Defenders share victory by clearing every wave. Each cleared wave grants this reward to every defender.'));
    const scenario = this.group('scenario', 'Scenario objectives');
    scenario.append(element('p', 'Choose a scenario in the scenario menu to use its scripted objectives.'));
    const draft = this.group('draft', 'Army draft', false);
    this.check(draft, 'draft.enabled', 'Enable army draft'); this.number(draft, 'draft.banRounds', 'Draft ban rounds', 0, 2);
    this.number(draft, 'draft.pickRounds', 'Draft pick rounds', 1, 6); this.seconds(draft, 'draft.turnTicks', 'Draft turn seconds');
    draft.append(element('p', 'Players take turns banning and choosing army units and technologies before battle. Choices and bans apply to that match.'));
    const exclusions = this.group('disabled', 'Disable units or technologies', false);
    const list = element('div', undefined, 'match-rules-definitions');
    for (const definition of MATCH_DEFINITIONS) {
      const label = element('label', undefined, 'match-rules-check'); const input = element('input'); input.type = 'checkbox'; input.dataset.disabledDefinition = definition.id;
      input.setAttribute('aria-label', `${this.prefix}Disable ${definition.faction} ${definition.name}`);
      label.append(input, document.createTextNode(`${definition.name} · ${definition.faction} · ${definition.kind}`)); list.append(label);
      this.listen(input, 'change', () => { if (input.checked) this.disabledIds.add(definition.id); else this.disabledIds.delete(definition.id); this.changed(); });
    }
    exclusions.append(list); root.append(this.host); this.update();
  }
  private label(parent: HTMLElement, name: string, control: HTMLElement) {
    const label = element('label', name); control.setAttribute('aria-label', `${this.prefix}${name}`); label.append(control); parent.append(label); return label;
  }
  private select(parent: HTMLElement, key: string, name: string, choices: ReadonlyArray<readonly [string, string]>) {
    const input = element('select'); for (const [value, text] of choices) { const option = element('option', text); option.value = value; input.append(option); }
    this.label(parent, name, input); this.register(key, input);
  }
  private check(parent: HTMLElement, key: string, name: string) {
    const input = element('input'); input.type = 'checkbox'; this.label(parent, name, input).className = 'match-rules-check'; this.register(key, input);
  }
  private number(parent: HTMLElement, key: string, name: string, min: number, max: number, step: number | 'any' = 1) {
    const input = element('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step); input.required = true;
    this.label(parent, name, input); this.register(key, input);
  }
  private seconds(parent: HTMLElement, key: string, name: string) { this.number(parent, key, name, key === 'draft.turnTicks' || key === 'survival.intervalTicks' ? 1 : .05, key === 'draft.turnTicks' ? 120 : 3600, 'any'); this.controls.get(key)!.dataset.seconds = 'true'; }
  private register(key: string, input: HTMLInputElement | HTMLSelectElement) {
    this.controls.set(key, input); this.listen(input, input instanceof HTMLSelectElement || input.type === 'checkbox' ? 'change' : 'input', () => { if (key === 'mode') (this.controls.get('standardDefeat') as HTMLInputElement).checked = normalizeMatchRules({ mode: input.value }).standardDefeat; this.changed(); });
  }
  private group(key: string, title: string, modeOnly = true) {
    const details = element('details', undefined, 'match-rules-group'); details.open = modeOnly; details.dataset.ruleGroup = key; details.append(element('summary', title));
    const fields = element('div', undefined, 'match-rules-fields'); details.append(fields); this.host.append(details); this.groups.set(key, details); return fields;
  }
  private listen(target: HTMLElement, type: string, fn: () => void) { target.addEventListener(type, fn); this.removeListeners.push(() => target.removeEventListener(type, fn)); }
  private changed() { if (this.destroyed) return; this.refresh(); this.options.onChange?.(); }
  private refresh() {
    const mode = this.controls.get('mode')!.value;
    for (const [key, group] of this.groups) if (['hill', 'relic', 'survival', 'scenario'].includes(key)) { group.hidden = mode !== key; for (const control of Array.from(group.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select'))) control.disabled = group.hidden; }
    this.description.textContent = ({ annihilation: 'Defeat the opposing teams by destroying their headquarters.', hill: 'Capture the central hill, then hold it until the victory timer completes. Enemy units contest the hill.', relic: 'Collect relics with your units and hold the required number for the victory timer.', survival: 'Defend against scheduled enemy waves, recover between waves, and clear the final wave to win.', scenario: 'The selected scenario controls its objectives and victory conditions.' } as Record<string, string>)[mode] ?? '';
    this.host.dataset.mode = mode;
  }
  update(input: MatchRulesInput = {}) {
    if (this.destroyed) return;
    const rules = normalizeMatchRules(input);
    for (const [key, control] of this.controls) {
      const value = key.split('.').reduce<unknown>((current, part) => (current as Record<string, unknown>)[part], rules);
      if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = !!value;
      else control.value = String(control.dataset.seconds ? Number(value) / 20 : value);
    }
    this.disabledIds.clear(); for (const id of rules.disabledDefinitionIds) this.disabledIds.add(id);
    for (const control of Array.from(this.host.querySelectorAll<HTMLInputElement>('[data-disabled-definition]'))) control.checked = this.disabledIds.has(control.dataset.disabledDefinition!);
    this.error.hidden = true; this.refresh();
  }
  get value(): MatchRulesValue {
    if (this.destroyed) throw new Error('Match rules have been closed.');
    const rules = structuredClone(MATCH_RULE_DEFAULTS);
    try {
      for (const [key, control] of this.controls) {
        if (control.disabled) continue;
        let value: string | number | boolean = control.value;
        if (control instanceof HTMLInputElement) {
          if (control.type === 'checkbox') value = control.checked;
          else { value = control.value.trim() ? Number(control.value) : NaN; if (!Number.isFinite(value) || value < Number(control.min) || value > Number(control.max) || !control.checkValidity()) throw new Error(`Enter a valid ${control.getAttribute('aria-label')?.toLowerCase()}.`); if (control.dataset.seconds) { if (Math.abs(value * 20 - Math.round(value * 20)) > 1e-6) throw new Error('Durations must use increments of 0.05 seconds.'); value = Math.round(value * 20); } }
        } else if (!Array.from(control.options).some(option => option.value === value)) throw new Error(`Choose ${control.getAttribute('aria-label')?.toLowerCase()}.`);
        if (key === 'startingAge' || key === 'survival.defenderTeam') value = Number(value);
        const parts = key.split('.'), field = parts.pop()!;
        const target = parts.reduce<Record<string, unknown>>((current, part) => current[part] as Record<string, unknown>, rules as unknown as Record<string, unknown>); target[field] = value;
      }
      if (rules.relic.required > rules.relic.count) throw new Error('Relics needed to win cannot exceed the relic count.');
      rules.disabledDefinitionIds = [...this.disabledIds].sort(); this.error.hidden = true; return normalizeMatchRules(rules);
    } catch (error) { this.error.textContent = error instanceof Error ? error.message : 'Check the match rules.'; this.error.hidden = false; throw error; }
  }
  get isDefault() { return JSON.stringify(this.value) === JSON.stringify(MATCH_RULE_DEFAULTS); }
  destroy() { if (this.destroyed) return; this.destroyed = true; for (const remove of this.removeListeners.splice(0)) remove(); this.host.remove(); }
}
