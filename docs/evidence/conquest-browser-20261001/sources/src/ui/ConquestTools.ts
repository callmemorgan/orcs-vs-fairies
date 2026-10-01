import { FACTIONS } from '../core/content';
import { conquestSupply, reachableConquestRegions } from '../core/conquest';
import type { ConquestAction, ConquestProfile } from '../core/conquest-types';
import type { Cost, FactionId } from '../core/types';
import { conquestWorldFor } from '../scenarios/conquest-world';
import './conquest-tools.css';

type Proposal = Exclude<ConquestAction, { type: 'battle' | 'wait' }>;
export interface ConquestToolsCallbacks {
  profile: () => ConquestProfile | null;
  start: (faction: FactionId) => void;
  battle: (regionId: string, mode: 'attack' | 'passage') => void;
  proposal: (action: Proposal) => void;
  wait: () => void;
  resume: () => void;
  hasSave?: () => boolean;
  save?: () => void;
  import?: (input: string) => void;
  notice?: (text: string) => void;
}
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
const bank = (cost: Cost) => `${cost.wood} wood · ${cost.ore} ore · ${cost.crystal} crystal`;
const name = (faction: FactionId) => `${FACTIONS[faction].name} (${faction})`;

/** The host owns profiles and battles; these controls only submit player decisions. */
export class ConquestTools {
  private readonly root = element('details');
  private readonly status = element('p');
  private readonly overview = element('div');
  private readonly regions = element('div');
  private readonly diplomacy = element('section');
  private readonly relation = element('p');
  private readonly foreign = element('select');
  private readonly tribute = element('input');
  private readonly turns = element('input');
  private readonly tributeButton = element('button', 'Offer tribute');
  private readonly truceButton = element('button', 'Request truce');
  private readonly allianceButton = element('button', 'Request alliance');
  private readonly waitButton = element('button', 'Wait one turn');
  private readonly startButton = element('button', 'Create realm');
  private readonly resumeButton = element('button', 'Resume saved realm');
  private readonly saveButton = element('button', 'Export realm profile');
  private readonly error = element('p');
  private lastKey = '';
  private actionGeneration = 0;

  constructor(host: HTMLElement, private readonly callbacks: ConquestToolsCallbacks) {
    this.root.className = 'conquest-tools'; this.root.setAttribute('aria-label', 'World conquest');
    this.root.append(element('summary', 'World conquest and diplomacy'));
    const introduction = element('p', 'Connect your realm through captured land and treaties. Battles preserve surviving troops; waiting collects supplies from connected holdings.');
    const faction = element('select'); faction.setAttribute('aria-label', 'Conquest faction');
    for (const id of Object.keys(FACTIONS) as FactionId[]) { const option = element('option', name(id)); option.value = id; faction.append(option); }
    const factionLabel = element('label', 'Starting army'); factionLabel.append(faction);
    const start = this.startButton; start.onclick = () => this.run(() => callbacks.start(faction.value as FactionId));
    this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    this.overview.className = 'conquest-overview'; this.regions.className = 'conquest-regions'; this.regions.setAttribute('aria-label', 'Connected region map');
    this.diplomacy.setAttribute('aria-label', 'Diplomacy'); this.diplomacy.append(element('h3', 'Foreign relations'));
    this.foreign.setAttribute('aria-label', 'Foreign faction'); this.foreign.onchange = () => this.updateDiplomacy();
    const foreignLabel = element('label', 'Negotiate with'); foreignLabel.append(this.foreign);
    this.tribute.type = 'number'; this.tribute.min = '25'; this.tribute.max = '300'; this.tribute.step = '1'; this.tribute.value = '100'; this.tribute.setAttribute('aria-label', 'Tribute ore');
    this.turns.type = 'number'; this.turns.min = '1'; this.turns.max = '8'; this.turns.step = '1'; this.turns.value = '2'; this.turns.setAttribute('aria-label', 'Truce turns');
    this.tribute.oninput = this.turns.oninput = () => this.updateDiplomacy();
    const tributeLabel = element('label', 'Tribute in ore'); tributeLabel.append(this.tribute);
    const turnsLabel = element('label', 'Truce duration in turns'); turnsLabel.append(this.turns);
    this.tributeButton.onclick = () => this.run(() => callbacks.proposal({ type: 'tribute', faction: this.foreign.value as FactionId, amount: this.tribute.valueAsNumber }));
    this.truceButton.onclick = () => this.run(() => callbacks.proposal({ type: 'truce', faction: this.foreign.value as FactionId, turns: this.turns.valueAsNumber }));
    this.allianceButton.onclick = () => this.run(() => callbacks.proposal({ type: 'alliance', faction: this.foreign.value as FactionId }));
    this.waitButton.onclick = () => this.run(callbacks.wait);
    const proposals = element('div'); proposals.className = 'conquest-actions'; proposals.append(this.tributeButton, this.truceButton, this.allianceButton);
    this.diplomacy.append(foreignLabel, this.relation, tributeLabel, turnsLabel, proposals);
    this.resumeButton.onclick = () => this.run(callbacks.resume);
    this.saveButton.hidden = !callbacks.save; this.saveButton.onclick = () => this.run(() => callbacks.save?.());
    const storage = element('div'); storage.className = 'conquest-actions'; storage.append(this.waitButton, this.resumeButton, this.saveButton);
    if (callbacks.import) {
      const file = element('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', 'Import realm profile');
      file.onchange = () => { const selected = file.files?.[0]; file.value = ''; if (selected) void this.importFile(selected); };
      const label = element('label', 'Load realm profile'); label.append(file); storage.append(label);
    }
    this.error.className = 'conquest-error'; this.error.setAttribute('role', 'alert'); this.error.hidden = true;
    this.root.append(introduction, factionLabel, start, this.status, this.overview, this.regions, this.diplomacy, storage, this.error); host.append(this.root); this.update();
  }

  private run(action: () => void): void { this.actionGeneration++; try { action(); this.error.hidden = true; this.lastKey = ''; this.update(); } catch (error) { this.showError(error); } }
  private showError(error: unknown): void { this.error.textContent = error instanceof Error ? error.message : 'The realm decision could not be completed.'; this.error.hidden = false; this.callbacks.notice?.(this.error.textContent); }
  private async importFile(file: File): Promise<void> {
    const request = ++this.actionGeneration;
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('Realm profile is too large.');
      const text = await file.text(); if (request !== this.actionGeneration) return;
      this.callbacks.import?.(text); this.error.hidden = true; this.lastKey = ''; this.root.open = true; this.update();
    } catch (error) { if (request === this.actionGeneration) this.showError(error); }
  }

  private updateDiplomacy(): void {
    const profile = this.callbacks.profile(), faction = this.foreign.value as FactionId;
    if (!profile || !profile.relations[faction]) return;
    const relation = profile.relations[faction], remaining = Math.max(0, relation.truceUntil - profile.turn), active = !!profile.active;
    const truceScore = 20 + 8 * relation.warPressure, allianceScore = 50 + 12 * relation.warPressure;
    this.relation.textContent = `${name(faction)} · relations ${relation.score} · war pressure ${relation.warPressure} · ${relation.alliance ? 'allied' : remaining ? `truce for ${remaining} more turns` : 'no treaty'}. Foreign treasury: ${bank(relation.treasury)}. Truce requires ${truceScore} relations; alliance requires ${allianceScore}. Allied reinforcements cost ${bank(FACTIONS[profile.faction].units.ranged.cost)} from the foreign treasury for each troop.`;
    const amount = this.tribute.valueAsNumber, turns = this.turns.valueAsNumber;
    this.foreign.disabled = this.tribute.disabled = this.turns.disabled = active;
    this.tributeButton.disabled = active || !Number.isSafeInteger(amount) || amount < 25 || amount > 300 || profile.treasury.ore < amount;
    this.truceButton.disabled = active || relation.alliance || relation.score < truceScore || !Number.isSafeInteger(turns) || turns < 1 || turns > 8;
    this.allianceButton.disabled = active || relation.alliance || relation.score < allianceScore;
    this.tributeButton.title = active ? 'Finish the current battlefield before negotiating.' : 'Transfer 25–300 ore; every five ore adds one relation point.';
    this.truceButton.title = active ? 'Finish the current battlefield before negotiating.' : `Requires ${truceScore} relations. A battlefield truce protects passage for 15 seconds per remaining turn.`;
    this.allianceButton.title = active ? 'Finish the current battlefield before negotiating.' : `Requires ${allianceScore} relations; allied territory permits passage.`;
  }

  update(): void {
    const profile = this.callbacks.profile(), hasSave = this.callbacks.hasSave?.() ?? !!profile;
    this.startButton.disabled = !!profile?.active; this.startButton.title = profile?.active ? 'Finish the current battlefield before creating another realm.' : 'Create a new realm with the chosen army.';
    this.resumeButton.disabled = !hasSave; this.saveButton.disabled = !profile; this.waitButton.disabled = !profile || !!profile.active || profile.turn >= 1000;
    this.overview.hidden = this.regions.hidden = this.diplomacy.hidden = !profile;
    if (!profile) { this.status.textContent = 'Create a realm or resume a profile saved on this browser.'; this.lastKey = ''; return; }
    const key = JSON.stringify([profile.faction, profile.turn, profile.treasury, profile.regions, profile.relations, profile.army.map(s => s.entity.id), profile.active && [profile.active.regionId, profile.active.mode]]);
    this.updateDiplomacy();
    if (key === this.lastKey) return; this.lastKey = key;
    const definition = conquestWorldFor(profile.faction), reachable = new Set(reachableConquestRegions(profile));
    this.status.textContent = `${definition.title} · ${name(profile.faction)} · turn ${profile.turn}${profile.active ? ` · ${profile.active.mode === 'attack' ? 'battle' : 'passage'} in ${definition.regions.find(r => r.id === profile.active!.regionId)!.name}; finish or resume it before another decision` : ''}`;
    this.overview.replaceChildren(element('p', `Treasury: ${bank(profile.treasury)}. Connected income per turn: ${bank(conquestSupply(profile))}. Persistent army: ${profile.army.length} survivors.`));
    const previous = this.foreign.value; this.foreign.replaceChildren();
    for (const id of Object.keys(FACTIONS) as FactionId[]) if (id !== profile.faction) { const option = element('option', name(id)); option.value = id; this.foreign.append(option); }
    if (previous && previous !== profile.faction) this.foreign.value = previous;
    this.regions.replaceChildren();
    for (const site of definition.regions) {
      const region = profile.regions[site.id], relation = profile.relations[region.owner], owned = region.owner === profile.faction;
      const protectedRegion = owned || relation.alliance || relation.truceUntil > profile.turn, connected = site.id === 'hearth' || reachable.has(site.id);
      const card = element('article'); card.dataset.region = site.id; card.dataset.reachable = String(connected); card.dataset.owner = region.owner;
      card.append(element('h3', site.name), element('p', `${name(region.owner)} · garrison ${region.garrison} · ${site.terrain} · ${owned ? 'owned' : protectedRegion ? relation.alliance ? 'allied passage' : 'truce passage' : 'hostile'}`), element('p', `Supply: ${bank(site.supply)}`), element('p', `Roads: ${site.neighbors.map(id => definition.regions.find(r => r.id === id)!.name).join(', ')}`));
      const briefing = element('details'); briefing.append(element('summary', 'Region briefing'), element('p', site.briefing)); card.append(briefing);
      if (!owned) {
        const mode = protectedRegion ? 'passage' : 'attack', button = element('button', `${mode === 'attack' ? 'Attack' : 'Passage'}: ${site.name}`);
        button.disabled = !connected || !!profile.active; button.title = !connected ? 'Connect a route through owned or treaty-protected territory.' : profile.active ? 'Finish the active battlefield first.' : protectedRegion ? 'Move the commander through the treaty-protected garrison.' : 'Deploy the persistent army to capture this region.';
        button.onclick = () => this.run(() => this.callbacks.battle(site.id, mode)); card.append(button);
        if (!connected) card.append(element('p', 'No connected route from Hearth Valley.'));
      }
      this.regions.append(card);
    }
    this.updateDiplomacy();
  }

  cancelPendingImport(): void { this.actionGeneration++; }
  destroy(): void { this.cancelPendingImport(); this.root.remove(); }
}
