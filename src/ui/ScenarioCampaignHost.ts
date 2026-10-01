import { campaignProgress, campaignRulesCompatibility, checkpointCampaignMission, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, prepareCampaignMission, resetCampaignMission } from '../core/campaign';
import { conquestRulesCompatibility, checkpointConquestBattle, completeConquestBattle, createConquestProfile, decodeConquestProfile, prepareConquestBattle, proposeConquest, waitConquestTurn } from '../core/conquest';
import { ScenarioRecorder } from '../core/scenario-recordings';
import { resetScenario, restoreScenario, scenarioRulesCompatibility, scenarioSessionForState } from '../core/scenarios';
import type { CampaignMission } from '../core/campaign';
import type { ConquestMission } from '../core/conquest-types';
import type { GameState } from '../core/types';
import type { ScenarioSession } from '../core/scenario-types';
import type { SessionScenarioProfile } from '../core/session-storage';
import { CAMPAIGNS, SCENARIOS } from '../scenarios/campaigns';
import { ConquestTools } from './ConquestTools';
import { ScenarioTools } from './ScenarioTools';
import './scenario-host.css';

interface HostCallbacks {
  state: () => GameState | null;
  launch: (session: ScenarioSession, inspectionReason?: string) => void;
  menu: () => void;
  select: (ids: number[]) => void;
  center: (x: number, y: number) => void;
  notice: (text: string) => void;
  visibility: (open: boolean) => void;
  inspection: () => string | null;
}
const campaignKey = 'ovf.campaign.v1', realmKey = 'ovf.conquest.v1';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => { const item = document.createElement(tag); if (text !== undefined) item.textContent = text; return item; };
function download(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })), anchor = node('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Owns strategic profiles while the main application owns simulation and ordinary saves. */
export class ScenarioCampaignHost {
  private owner: SessionScenarioProfile | undefined;
  private recorder: ScenarioRecorder | undefined;
  private completionError = false;
  private checkpointAt = 0;
  private inspectionReason: string | undefined;
  private readonly panel = node('section');
  private readonly status = node('p');
  private readonly missionTools: ScenarioTools;
  private readonly realmTools: ConquestTools;
  private readonly saveCampaign = node('button', 'Save campaign profile');
  private readonly resumeCampaign = node('button', 'Resume saved campaign');

  constructor(root: HTMLElement, toolbar: HTMLElement, private readonly callbacks: HostCallbacks, private readonly storage: Storage = localStorage) {
    this.panel.className = 'scenario-host-panel'; this.panel.hidden = true; this.panel.setAttribute('aria-label', 'Campaigns, missions and realms');
    const menuButton = node('button', 'Campaigns and realms'); menuButton.className = 'campaign-menu-button';
    root.querySelector('.begin-match')!.before(menuButton);
    const toolbarButton = node('button', 'Missions and realms'); toolbarButton.className = 'scenario-toolbar-button'; toolbar.append(toolbarButton);
    const close = node('button', 'Close missions'); close.className = 'scenario-host-close'; close.onclick = () => this.setOpen(false);
    menuButton.onclick = toolbarButton.onclick = () => this.setOpen(this.panel.hidden);
    this.panel.append(close); root.append(this.panel);
    this.missionTools = new ScenarioTools(this.panel, {
      session: () => this.session(), start: (session, reason) => { this.clear(); this.launch(session, reason); },
      reset: () => this.reset(), select: callbacks.select, center: callbacks.center, notice: callbacks.notice, readOnlyReason: () => this.reason(),
      campaign: {
        progress: () => this.owner?.kind === 'campaign' ? campaignProgress(this.owner.profile) : null,
        start: id => this.installRun('campaign', prepareCampaignMission(createCampaignProfile(id, crypto.randomUUID()))),
        continue: () => { if (this.owner?.kind === 'campaign') this.installRun('campaign', prepareCampaignMission(this.owner.profile)); },
        choose: id => { if (this.owner?.kind === 'campaign') { this.owner.profile = chooseCampaignBranch(this.owner.profile, id); this.persist(); this.update(); } },
      },
    }, { campaigns: CAMPAIGNS, scenarios: { ...SCENARIOS } });
    const profileControls = node('section'); profileControls.className = 'scenario-tools'; profileControls.setAttribute('aria-label', 'Campaign profile');
    this.status.setAttribute('role', 'status');
    this.resumeCampaign.onclick = () => this.run(() => { const saved = this.storage.getItem(campaignKey); if (!saved) throw new Error('No campaign is saved in this browser.'); this.restoreCampaign(saved); });
    this.saveCampaign.onclick = () => this.run(() => { if (this.owner?.kind === 'campaign') { const owner = this.snapshot()!; download(`${owner.profile.id}-campaign.json`, owner.profile); } });
    const file = node('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', 'Import campaign profile');
    file.onchange = () => { const selected = file.files?.[0]; file.value = ''; if (selected) void (async () => { try { if (selected.size > 20 * 1024 * 1024) throw new Error('Campaign profile exceeds 20 MiB.'); this.restoreCampaign(await selected.text()); } catch (error) { this.error(error); } })(); };
    const label = node('label', 'Load campaign profile'); label.append(file); profileControls.append(this.status, this.resumeCampaign, this.saveCampaign, label); this.panel.append(profileControls);
    this.realmTools = new ConquestTools(this.panel, {
      profile: () => this.owner?.kind === 'conquest' ? this.owner.profile : null, readOnlyReason: () => this.reason(),
      start: faction => this.showRealm({ kind: 'conquest', profile: createConquestProfile(faction, crypto.randomUUID()) }),
      battle: (region, mode) => { if (this.owner?.kind === 'conquest') this.installRun('conquest', prepareConquestBattle(this.owner.profile, region, mode)); },
      proposal: action => { if (this.owner?.kind === 'conquest') { this.owner.profile = proposeConquest(this.owner.profile, action); this.persist(); } },
      wait: () => { if (this.owner?.kind === 'conquest') { this.owner.profile = waitConquestTurn(this.owner.profile); this.persist(); } },
      resume: () => { const saved = this.storage.getItem(realmKey); if (!saved) throw new Error('No realm is saved in this browser.'); this.restoreRealm(saved); },
      hasSave: () => !!this.storage.getItem(realmKey), import: input => this.restoreRealm(input),
      save: () => { if (this.owner?.kind === 'conquest') { const owner = this.snapshot()!; download(`${owner.profile.id}-realm.json`, owner.profile); } }, notice: callbacks.notice,
    });
    const missions = this.panel.querySelector<HTMLDetailsElement>('.scenario-tools details')!, realms = this.panel.querySelector<HTMLDetailsElement>('.conquest-tools')!;
    realms.addEventListener('toggle', () => { if (realms.open) missions.open = false; }); missions.addEventListener('toggle', () => { if (missions.open) realms.open = false; });
    this.panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); this.setOpen(false); } });
    this.update();
  }
  private session(): ScenarioSession | null { const state = this.callbacks.state(); return state ? scenarioSessionForState(state) : null; }
  reason(): string | null {
    if (this.owner) return (this.owner.kind === 'campaign' ? campaignRulesCompatibility(this.owner.profile) : conquestRulesCompatibility(this.owner.profile)).reason ?? this.inspectionReason ?? this.callbacks.inspection();
    const session = this.session(); return this.inspectionReason ?? (session ? scenarioRulesCompatibility(session).reason : null) ?? this.callbacks.inspection();
  }
  private error(error: unknown): void { this.callbacks.notice(error instanceof Error ? error.message : 'The campaign could not be opened.'); }
  private run(action: () => void): void { try { action(); this.update(); } catch (error) { this.error(error); } }
  private setOpen(open: boolean): void { this.panel.hidden = !open; this.callbacks.visibility(open); if (open) this.update(); }
  private persist(): void { if (this.owner) this.storage.setItem(this.owner.kind === 'campaign' ? campaignKey : realmKey, JSON.stringify(this.owner.profile)); }
  clear(): void { this.realmTools?.cancelPendingImport(); this.recorder?.destroy(); this.recorder = undefined; this.owner = undefined; this.inspectionReason = undefined; this.completionError = false; }
  private launch(session: ScenarioSession, reason?: string): void { this.inspectionReason = reason; this.setOpen(false); this.callbacks.launch(session, reason); this.checkpointAt = session.state.time; this.update(); }
  private installRun(kind: 'campaign', run: CampaignMission): void;
  private installRun(kind: 'conquest', run: ConquestMission): void;
  private installRun(kind: 'campaign' | 'conquest', run: CampaignMission | ConquestMission): void {
    this.clear(); this.owner = { kind, profile: run.profile } as SessionScenarioProfile; this.recorder = run.recorder; this.launch(run.session); this.persist();
  }
  private showRealm(owner: Extract<SessionScenarioProfile, { kind: 'conquest' }>): void { this.clear(); this.owner = owner; this.callbacks.menu(); this.persist(); this.setOpen(true); }
  private restoreCampaign(input: unknown): void {
    const profile = decodeCampaignProfile(input), reason = campaignRulesCompatibility(profile).reason;
    if (!reason && (profile.active || profile.history.length === 0)) { this.installRun('campaign', prepareCampaignMission(profile)); return; }
    this.clear(); this.owner = { kind: 'campaign', profile };
    const checkpoint = profile.active?.checkpoint ?? profile.history.at(-1)?.checkpoint;
    if (checkpoint) this.launch(restoreScenario(checkpoint), reason ?? undefined);
    else { this.callbacks.menu(); this.setOpen(true); }
    this.persist(); this.update();
  }
  private restoreRealm(input: unknown): void {
    const profile = decodeConquestProfile(input), reason = conquestRulesCompatibility(profile).reason;
    if (profile.active && !reason) { this.installRun('conquest', prepareConquestBattle(profile, profile.active.regionId, profile.active.mode)); return; }
    if (profile.active) { this.clear(); this.owner = { kind: 'conquest', profile }; this.launch(restoreScenario(profile.active.checkpoint), reason!); this.persist(); }
    else this.showRealm({ kind: 'conquest', profile });
  }
  install(owner: SessionScenarioProfile | undefined, state: GameState): string | null {
    this.clear(); this.owner = owner; const session = scenarioSessionForState(state);
    const reason = owner ? (owner.kind === 'campaign' ? campaignRulesCompatibility(owner.profile) : conquestRulesCompatibility(owner.profile)).reason : session ? scenarioRulesCompatibility(session).reason : null;
    this.inspectionReason = reason ?? undefined;
    if (owner?.profile.active && session && !reason) this.recorder = new ScenarioRecorder(session, owner.profile.active.recording);
    this.checkpointAt = state.time; this.update(); return reason;
  }
  snapshot(): SessionScenarioProfile | undefined {
    const session = this.session();
    if (this.owner?.profile.active && session && this.recorder && !this.reason()) {
      this.owner.profile = this.owner.kind === 'campaign' ? checkpointCampaignMission(this.owner.profile, session, this.recorder) : checkpointConquestBattle(this.owner.profile, session, this.recorder);
      this.checkpointAt = session.state.time; this.persist();
    }
    return this.owner ? structuredClone(this.owner) : undefined;
  }
  step(): void {
    const session = this.session(); if (!this.owner?.profile.active || !session || !this.recorder || this.completionError || this.reason()) return;
    if (session.runtime.outcome !== 'playing' && (this.owner.kind === 'conquest' || session.runtime.outcome === 'won')) {
      try {
        const recording = this.recorder.archive(); this.owner.profile = this.owner.kind === 'campaign' ? completeCampaignMission(this.owner.profile, session, recording) : completeConquestBattle(this.owner.profile, session, recording);
        this.recorder.destroy(); this.recorder = undefined; this.persist(); this.update();
      } catch (error) { this.completionError = true; this.error(error); }
    } else if (session.state.time - this.checkpointAt >= 2) { try { this.snapshot(); } catch (error) { this.completionError = true; this.error(error); } }
  }
  private reset(): void {
    if (this.reason()) throw new Error(this.reason()!);
    if (this.owner?.kind === 'campaign' && this.owner.profile.active) this.installRun('campaign', resetCampaignMission(this.owner.profile));
    else if (this.owner?.kind === 'conquest' && this.owner.profile.active) this.installRun('conquest', prepareConquestBattle({ ...this.owner.profile, active: null }, this.owner.profile.active.regionId, this.owner.profile.active.mode));
    else { const session = this.session(); if (session) { this.clear(); this.launch(resetScenario(session)); } }
  }
  update(options: { blocked?: boolean; photo?: boolean } = {}): void {
    if ((options.blocked || options.photo) && !this.panel.hidden) this.setOpen(false);
    this.panel.classList.toggle('scenario-photo-hidden', !!options.photo);
    this.missionTools?.update(); this.realmTools?.update();
    this.saveCampaign.disabled = this.owner?.kind !== 'campaign';
    try { this.resumeCampaign.disabled = !this.storage.getItem(campaignKey); } catch { this.resumeCampaign.disabled = true; }
    this.status.textContent = this.owner?.kind === 'campaign' ? `${CAMPAIGNS[this.owner.profile.campaignId].title} · ${this.owner.profile.history.length}/4 chapters completed${this.reason() ? ` · ${this.reason()}` : ''}` : 'Campaign profiles preserve the army and chosen route.';
  }
}
