import { captureScenario, createScenario, restoreScenario, validateScenario } from '../core/scenarios';
import type { CampaignDefinition, ScenarioDefinition, ScenarioSession } from '../core/scenario-types';
import './scenario-tools.css';

export interface CampaignProgressView { campaignId: string; chapter: number; choiceId?: string; completed: string[]; finished: boolean }
export interface ScenarioToolsCallbacks {
  session: () => ScenarioSession | null;
  start: (session: ScenarioSession) => void;
  reset: () => void;
  select: (ids: number[]) => void;
  center: (x: number, y: number) => void;
  notice?: (text: string) => void;
  campaign?: {
    progress: () => CampaignProgressView | null;
    start: (campaignId: string) => void;
    continue: () => void;
    choose: (choiceId: string) => void;
  };
}
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
function download(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = element('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Mission controls accept a local driver through callbacks and never mutate a battlefield. */
export class ScenarioTools {
  private readonly root: HTMLElement;
  private readonly picker: HTMLElement;
  private readonly status: HTMLElement;
  private readonly objectives: HTMLElement;
  private readonly mechanics: HTMLElement;
  private readonly messages: HTMLElement;
  private readonly error: HTMLElement;
  private readonly branches: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly controls: HTMLElement;
  private readonly scenarioSelect: HTMLSelectElement;
  private current: ScenarioSession | null = null;
  private lastKey = '';

  constructor(host: HTMLElement, private readonly callbacks: ScenarioToolsCallbacks, private readonly content: { campaigns: Record<string, CampaignDefinition>; scenarios: Record<string, ScenarioDefinition> }) {
    this.root = element('section'); this.root.className = 'scenario-tools'; this.root.setAttribute('aria-label', 'Campaigns and missions');
    const heading = element('h2', 'Campaigns and missions');
    this.picker = element('details'); const summary = element('summary', 'Choose a campaign or practice mission'); this.picker.append(summary);
    const campaigns = element('div'); campaigns.className = 'scenario-campaigns';
    for (const campaign of Object.values(content.campaigns)) {
      const card = element('article'); card.append(element('h3', campaign.title), element('p', `${campaign.commander} · ${campaign.faction}`), element('p', campaign.introduction));
      const button = element('button', 'Start campaign'); button.dataset.campaign = campaign.id; button.disabled = !callbacks.campaign;
      button.onclick = () => this.run(() => callbacks.campaign?.start(campaign.id)); card.append(button); campaigns.append(card);
    }
    const practice = element('label', 'Practice mission'); const select = this.scenarioSelect = element('select'); select.setAttribute('aria-label', 'Practice mission');
    for (const definition of Object.values(content.scenarios)) { const option = element('option', `${definition.faction} · ${definition.title}`); option.value = definition.id; select.append(option); }
    practice.append(select); const launch = element('button', 'Launch practice mission');
    launch.onclick = () => this.run(() => callbacks.start(createScenario(content.scenarios[select.value])));
    this.picker.append(campaigns, practice, launch);
    this.status = element('p'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    this.objectives = element('ol'); this.objectives.setAttribute('aria-label', 'Mission objectives');
    this.mechanics = element('p'); this.mechanics.className = 'scenario-mechanics';
    this.messages = element('p'); this.messages.className = 'scenario-dialogue';
    this.controls = element('div'); this.controls.className = 'scenario-controls';
    const army = element('button', 'Select mission army'); army.onclick = () => { const session = callbacks.session(); if (session) callbacks.select(session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.role !== 'worker' && e.hp > 0 && !e.illusion).map(e => e.id)); };
    const reset = element('button', 'Reset mission'); reset.onclick = () => this.run(() => callbacks.reset());
    const save = element('button', 'Save mission'); save.onclick = () => this.run(() => { const session = callbacks.session(); if (session) download(`${session.definition.id}-checkpoint.json`, captureScenario(session)); });
    const file = element('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', 'Import mission checkpoint');
    file.onchange = () => { const selected = file.files?.[0]; if (selected) void this.importFile(selected); file.value = ''; };
    const load = element('label', 'Load mission'); load.className = 'scenario-file'; load.append(file);
    this.continueButton = element('button', 'Continue campaign'); this.continueButton.onclick = () => this.run(() => callbacks.campaign?.continue());
    this.branches = element('div'); this.branches.className = 'scenario-branches';
    this.error = element('p'); this.error.setAttribute('role', 'alert'); this.error.className = 'scenario-error'; this.error.hidden = true;
    this.controls.append(army, reset, save, load, this.continueButton); this.root.append(heading, this.picker, this.status, this.objectives, this.mechanics, this.messages, this.controls, this.branches, this.error); host.append(this.root);
    this.update();
  }

  registerScenario(input: ScenarioDefinition): void {
    const definition = validateScenario(input);
    if (Object.hasOwn(this.content.scenarios, definition.id)) throw new Error('A mission with this ID is already registered. Use a new package ID.');
    this.content.scenarios[definition.id] = definition;
    const option = element('option', `${definition.faction} · ${definition.title}`); option.value = definition.id; this.scenarioSelect.append(option); this.scenarioSelect.value = definition.id;
    this.lastKey = ''; this.update();
  }

  private run(action: () => void): void { try { action(); this.error.hidden = true; this.lastKey = ''; this.update(); } catch (error) { this.showError(error); } }
  private showError(error: unknown): void { this.error.textContent = error instanceof Error ? error.message : 'The mission could not be opened.'; this.error.hidden = false; this.callbacks.notice?.(this.error.textContent); }
  private async importFile(file: File): Promise<void> { try { if (file.size > 18 * 1024 * 1024) throw new Error('Mission checkpoint exceeds its size limit.'); const session = restoreScenario(await file.text()); this.callbacks.start(session); this.error.hidden = true; this.lastKey = ''; this.update(); } catch (error) { this.showError(error); } }

  update(): void {
    const session = this.callbacks.session(); this.current = session;
    this.controls.hidden = !session;
    if (!session) { this.continueButton.hidden = true; this.status.textContent = 'Choose a campaign or launch a practice mission.'; this.objectives.replaceChildren(); this.mechanics.textContent = ''; this.messages.textContent = ''; this.branches.replaceChildren(); return; }
    const { definition, runtime, state } = session, progress = this.callbacks.campaign?.progress() ?? null;
    const boss = runtime.boss.telegraph;
    const key = JSON.stringify([definition.id, runtime.outcome, runtime.completed, runtime.reinforcementRemaining, runtime.escort.checkpoint, runtime.stealth.alarms, runtime.boss.phase, boss && [boss.resolveAt, boss.interrupted, Math.ceil((boss.resolveAt - state.time) * 10) / 10], runtime.messages.at(-1), progress]);
    if (key === this.lastKey) return; this.lastKey = key;
    this.continueButton.hidden = true;
    this.status.textContent = `${definition.title} · ${runtime.outcome === 'playing' ? 'Mission in progress' : runtime.outcome === 'won' ? 'Mission complete' : `Mission failed: ${runtime.reason}`}`;
    this.objectives.replaceChildren();
    for (const objective of definition.objectives) { const item = element('li', `${runtime.completed.includes(objective.id) ? 'Complete: ' : ''}${objective.text}${objective.optional ? ' (optional)' : ''}`); item.dataset.completed = String(runtime.completed.includes(objective.id)); this.objectives.append(item); }
    for (const requirement of definition.requiredActions ?? []) { const item = element('li', `${requirement.text} (${runtime.commandCounts[requirement.action] ?? 0}/${requirement.count})`); this.objectives.append(item); }
    const mechanics = [definition.rules.fixedArmy ? 'Fixed army; recruitment, construction and research are unavailable.' : `${runtime.reinforcementRemaining} reinforcement orders remain. Cancelled orders still use a reinforcement.`];
    if (definition.escort) mechanics.push(`Convoy checkpoint ${runtime.escort.checkpoint}/${definition.escort.route.length}; nearby escorts keep it moving.`);
    if (definition.stealth) mechanics.push(`Alarms ${runtime.stealth.alarms}/${definition.stealth.alarmLimit}. Guard cones detect real infiltrators; illusions can distract patrols.`);
    if (definition.boss) mechanics.push(`${definition.boss.name}: ${definition.boss.phases[Math.max(0, runtime.boss.phase)].name}.${boss ? ` ${boss.interrupted ? 'Attack interrupted.' : `Warning: move outside the marked circle in ${Math.max(0, boss.resolveAt - state.time).toFixed(1)}s.`}` : ''}`);
    this.mechanics.textContent = mechanics.join(' ');
    const latest = runtime.messages.at(-1); this.messages.textContent = latest ? `${latest.speaker ? `${latest.speaker}: ` : ''}${latest.text}` : '';
    this.branches.replaceChildren();
    if (progress && !progress.finished && runtime.outcome === 'won') {
      const campaign = this.content.campaigns[progress.campaignId];
      if (campaign && progress.chapter === 2 && !progress.choiceId) {
        this.branches.append(element('p', campaign.choice.prompt));
        for (const choice of campaign.choice.options) { const button = element('button', choice.text); button.dataset.choice = choice.id; button.title = choice.consequence; button.onclick = () => this.run(() => this.callbacks.campaign?.choose(choice.id)); this.branches.append(button, element('p', choice.consequence)); }
      } else this.continueButton.hidden = false;
    }
  }

  destroy(): void { this.current = null; this.root.remove(); }
}
