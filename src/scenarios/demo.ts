import Phaser from 'phaser';
import { UPGRADES } from '../core/content';
import { campaignProgress, campaignRulesCompatibility, checkpointCampaignMission, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, prepareCampaignMission, resetCampaignMission } from '../core/campaign';
import type { CampaignMission, CampaignProfile } from '../core/campaign';
import { checkpointConquestBattle, completeConquestBattle, conquestRulesCompatibility, createConquestProfile, decodeConquestProfile, prepareConquestBattle, proposeConquest, waitConquestTurn } from '../core/conquest';
import type { ConquestMission, ConquestProfile } from '../core/conquest-types';
import type { ScenarioRecorder } from '../core/scenario-recordings';
import { afterScenarioStep, captureScenario, issueScenarioCommand, resetScenario, restoreScenario, scenarioRulesCompatibility } from '../core/scenarios';
import type { ScenarioSession } from '../core/scenario-types';
import type { BuildingRole, Command, GameEvent, Side } from '../core/types';
import { ControlProfiles, displayBinding } from '../game/Controls';
import type { ControlAction } from '../game/Controls';
import GameScene, { project, unproject } from '../game/GameScene';
import { ScenarioOverlay } from '../game/ScenarioOverlay';
import { mountShell } from '../ui/Hud';
import type { HudCallbacks } from '../ui/Hud';
import { ScenarioTools } from '../ui/ScenarioTools';
import { ConquestTools } from '../ui/ConquestTools';
import { CAMPAIGNS, SCENARIOS } from './campaigns';

const root = document.querySelector<HTMLElement>('#app')!;
const shell = mountShell(root, () => {});
root.querySelector<HTMLElement>('.war-menu')!.hidden = true;
const controls = new ControlProfiles(null);
let game: Phaser.Game | undefined;
let scene: GameScene | undefined;
let overlay: ScenarioOverlay | undefined;
let session: ScenarioSession | null = null;
let retiring: Phaser.Game | undefined;
let ready = false;
let generation = 0;
let campaignProfile: CampaignProfile | null = null;
let campaignRecorder: ScenarioRecorder | null = null;
let conquestProfile: ConquestProfile | null = null;
let conquestRecorder: ScenarioRecorder | null = null;
let practiceInspectionReason: string | null = null;
let realmSaved = false;
let completionError = false;
const profileKey = 'ovf.campaign.demo.v1';
const realmKey = 'ovf.conquest.demo.v1';
const commands: Array<{ tick: number; side: Side; command: Command; accepted: boolean }> = [];
const battleEvents: Array<GameEvent & { tick: number }> = [];
const launches: Array<{ id: string; checkpoint: ReturnType<typeof captureScenario> }> = [];
const panel = document.querySelector<HTMLElement>('#scenario-panel')!;
const toggle = document.querySelector<HTMLButtonElement>('#mission-panel-toggle')!;
let panelScene: GameScene | undefined;
let pausedBeforePanel = true;
let modalOpen = false;
panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Mission and realm profiles'); panel.tabIndex = -1;
function syncModal(): void {
  const open = !panel.hidden || Array.from(document.querySelectorAll<HTMLElement>('dialog[open],[role="dialog"][aria-modal="true"]')).some(dialog => dialog !== panel && (dialog.tagName !== 'DIALOG' || dialog.hasAttribute('open')) && !dialog.closest('[hidden]'));
  if (open && (!modalOpen || panelScene !== scene)) { panelScene = scene; pausedBeforePanel = scene?.paused ?? true; }
  if (scene) { scene.inputBlocked = open; if (open) scene.paused = true; else if (modalOpen && scene === panelScene) scene.paused = scene.readOnly || pausedBeforePanel; }
  modalOpen = open;
  if (!open) panelScene = undefined;
}
function setPanelOpen(open: boolean): void {
  panel.hidden = !open; toggle.textContent = open ? 'Hide missions' : 'Show missions'; toggle.setAttribute('aria-expanded', String(open));
  syncModal();
  update();
  if (open) panel.focus();
}
toggle.onclick = () => setPanelOpen(panel.hidden);
panel.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setPanelOpen(false); toggle.focus(); return; }
  if (event.key !== 'Tab') return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(item => item.getClientRects().length && !item.closest('[hidden]'));
  const first = items[0], last = items.at(-1);
  if (!first) { event.preventDefault(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last!.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
const toolbar = document.createElement('nav'); toolbar.setAttribute('aria-label', 'Mission view controls');
Object.assign(toolbar.style, { position: 'fixed', right: '16px', top: '70px', zIndex: '36', display: 'flex', gap: '6px' });
toggle.style.position = 'static';
const photoButton = document.createElement('button'); photoButton.id = 'mission-photo-button'; photoButton.type = 'button'; photoButton.textContent = 'Photo mode'; photoButton.disabled = true;
Object.assign(photoButton.style, { color: '#f3e6cf', background: '#30454b', border: '1px solid #7c8e87', borderRadius: '4px', padding: '4px 10px' });
toolbar.append(photoButton, toggle); document.body.append(toolbar);
const photoControls = document.createElement('section'); photoControls.className = 'photo-controls'; photoControls.hidden = true;
const photoDownload = document.createElement('button'); photoDownload.type = 'button'; photoDownload.textContent = 'Download photo';
const photoExit = document.createElement('button'); photoExit.id = 'mission-photo-exit'; photoExit.type = 'button'; photoExit.textContent = 'Leave photo mode';
const photoHint = document.createElement('span'); photoHint.textContent = `Press ${controls.bindingsFor('cancel').map(displayBinding).join(' / ')} or Select / View to leave photo mode.`;
photoControls.append(photoDownload, photoExit, photoHint); document.body.append(photoControls);
photoButton.onclick = () => { if (!scene || !ready) return; setPanelOpen(false); scene.setPhotoMode(true); };
photoExit.onclick = () => scene?.setPhotoMode(false);
photoDownload.onclick = () => { if (!game || !scene?.photoMode) return; const anchor = document.createElement('a'); anchor.href = game.canvas.toDataURL('image/png'); anchor.download = `${session?.definition.id ?? 'mission'}-${session?.state.tick ?? 0}.png`; anchor.click(); };
function syncPhotoMode(enabled: boolean): void { root.classList.toggle('photo-mode', enabled); toolbar.hidden = enabled; panel.style.visibility = enabled ? 'hidden' : ''; document.querySelector<HTMLElement>('#mission-introduction')!.style.visibility = enabled ? 'hidden' : ''; photoControls.hidden = !enabled; }
new MutationObserver(syncModal).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
const profileControls = document.createElement('section'); profileControls.setAttribute('aria-label', 'Campaign profile'); profileControls.className = 'scenario-tools';
const profileStatus = document.createElement('p'); profileStatus.setAttribute('role', 'status');
const resumeProfile = document.createElement('button'); resumeProfile.textContent = 'Resume saved campaign';
const saveProfile = document.createElement('button'); saveProfile.textContent = 'Save campaign profile'; saveProfile.disabled = true;
const profileFile = document.createElement('input'); profileFile.type = 'file'; profileFile.accept = '.json,application/json'; profileFile.setAttribute('aria-label', 'Import campaign profile');
const profileLabel = document.createElement('label'); profileLabel.textContent = 'Load campaign profile'; profileLabel.append(profileFile);
profileControls.append(profileStatus, resumeProfile, saveProfile, profileLabel); panel.append(profileControls);
function profileNotice(error: unknown): void { profileStatus.textContent = error instanceof Error ? error.message : 'The campaign could not be saved.'; shell.notice(profileStatus.textContent); }
function campaignReadOnlyReason(): string | null { return campaignProfile ? campaignRulesCompatibility(campaignProfile).reason : null; }
function conquestReadOnlyReason(): string | null { return conquestProfile ? conquestRulesCompatibility(conquestProfile).reason : null; }
function readOnlyReason(): string | null { return campaignReadOnlyReason() ?? conquestReadOnlyReason() ?? practiceInspectionReason ?? (session ? scenarioRulesCompatibility(session).reason : null); }
function persistProfile(): void {
  if (!campaignProfile || campaignReadOnlyReason() !== null) return;
  try { localStorage.setItem(profileKey, JSON.stringify(campaignProfile)); resumeProfile.disabled = false; } catch (error) { profileNotice(error); }
}
function checkpointProfile(): void {
  if (ready && session && campaignReadOnlyReason() === null && campaignProfile?.active && campaignRecorder && session.runtime.outcome === 'playing') campaignProfile = checkpointCampaignMission(campaignProfile, session, campaignRecorder);
  persistProfile();
  if (ready && session && conquestReadOnlyReason() === null && conquestProfile?.active && conquestRecorder && session.runtime.outcome === 'playing') conquestProfile = checkpointConquestBattle(conquestProfile, session, conquestRecorder);
  persistRealm();
}
function clearConquest(): void { conquestTools.cancelPendingImport(); conquestRecorder?.destroy(); conquestRecorder = null; conquestProfile = null; }
function clearCampaign(): void { campaignRecorder?.destroy(); campaignRecorder = null; campaignProfile = null; }
function launchPractice(next: ScenarioSession, inspectionReason?: string): void { clearCampaign(); clearConquest(); practiceInspectionReason = inspectionReason ?? scenarioRulesCompatibility(next).reason; completionError = false; launch(next); }
function launchCampaign(run: CampaignMission): void {
  clearConquest(); practiceInspectionReason = null; campaignRecorder?.destroy(); campaignProfile = run.profile; campaignRecorder = run.recorder; completionError = false; launch(run.session); persistProfile();
}
function restoreProfile(input: unknown): void {
  const profile = decodeCampaignProfile(input);
  practiceInspectionReason = null;
  if (!campaignRulesCompatibility(profile).compatible) {
    clearConquest(); campaignRecorder?.destroy(); campaignRecorder = null; campaignProfile = profile; completionError = false;
    const checkpoint = profile.active?.checkpoint ?? profile.history.at(-1)?.checkpoint;
    if (checkpoint) launch(restoreScenario(checkpoint)); else showOverview();
  } else if (profile.active || profile.history.length === 0) launchCampaign(prepareCampaignMission(profile));
  else {
    clearConquest();
    campaignRecorder?.destroy(); campaignRecorder = null; campaignProfile = profile; completionError = false;
    launch(restoreScenario(profile.history.at(-1)!.checkpoint)); persistProfile();
  }
}
function resetMission(): void {
  const reason = readOnlyReason(); if (reason !== null) { shell.notice(reason); return; }
  if (campaignProfile?.active) launchCampaign(resetCampaignMission(campaignProfile));
  else if (conquestProfile?.active) launchConquest(prepareConquestBattle({ ...conquestProfile, active: null }, conquestProfile.active.regionId, conquestProfile.active.mode));
  else if (conquestProfile) showRealm(conquestProfile);
  else if (session) launchPractice(resetScenario(session));
}
function persistRealm(): void {
  if (!conquestProfile || conquestReadOnlyReason() !== null) return;
  try { localStorage.setItem(realmKey, JSON.stringify(conquestProfile)); realmSaved = true; } catch (error) { shell.notice(error instanceof Error ? error.message : 'The realm could not be saved.'); }
}
function launchConquest(run: ConquestMission): void {
  conquestTools.cancelPendingImport(); clearCampaign(); practiceInspectionReason = null; conquestRecorder?.destroy(); conquestProfile = run.profile; conquestRecorder = run.recorder; completionError = false; launch(run.session); persistRealm();
}
function showRealm(profile: ConquestProfile): void {
  conquestTools.cancelPendingImport(); clearCampaign(); practiceInspectionReason = null; conquestRecorder?.destroy(); conquestRecorder = null; conquestProfile = profile; completionError = false;
  showOverview();
  persistRealm();
}
function showOverview(): void {
  const request = ++generation;
  retire(() => { if (request !== generation) return; session = null; shell.showMenu(); root.querySelector<HTMLElement>('.war-menu')!.hidden = true; document.querySelector<HTMLElement>('#mission-introduction')!.hidden = false; setPanelOpen(true); });
}
function restoreRealm(input: unknown): void {
  const profile = decodeConquestProfile(input);
  practiceInspectionReason = null;
  if (!conquestRulesCompatibility(profile).compatible && profile.active) {
    conquestTools.cancelPendingImport(); clearCampaign(); conquestRecorder?.destroy(); conquestRecorder = null; conquestProfile = profile; completionError = false;
    launch(restoreScenario(profile.active.checkpoint));
  } else if (profile.active) launchConquest(prepareConquestBattle(profile, profile.active.regionId, profile.active.mode));
  else showRealm(profile);
}
function downloadProfile(name: string, profile: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
try { realmSaved = !!localStorage.getItem(realmKey); } catch { realmSaved = false; }
try { resumeProfile.disabled = !localStorage.getItem(profileKey); } catch (error) { resumeProfile.disabled = true; profileNotice(error); }
resumeProfile.onclick = () => { try { const saved = localStorage.getItem(profileKey); if (!saved) throw new Error('No campaign is saved on this browser.'); restoreProfile(saved); } catch (error) { profileNotice(error); } };
saveProfile.onclick = () => {
  if (!campaignProfile) return;
  checkpointProfile();
  const url = URL.createObjectURL(new Blob([JSON.stringify(campaignProfile, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${campaignProfile.id}-campaign.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
profileFile.onchange = () => {
  const file = profileFile.files?.[0]; profileFile.value = '';
  if (file) void (async () => { try { if (file.size > 20 * 1024 * 1024) throw new Error('Campaign profile is too large.'); restoreProfile(await file.text()); } catch (error) { profileNotice(error); } })();
};

function dispatch(side: Side, command: Command): boolean {
  if (!session || !scene || !ready || scene.readOnly || readOnlyReason() !== null || scene.photoMode || modalOpen || scene.paused || side !== 0 || session.runtime.outcome !== 'playing') return false;
  const accepted = issueScenarioCommand(session, side, command);
  commands.push({ tick: session.state.tick, side, command: structuredClone(command), accepted });
  if (commands.length > 1000) commands.shift();
  update();
  return accepted;
}
function selectedProducer(role: BuildingRole): number | undefined {
  return scene?.selected.find(id => session?.state.entities.some(e => e.id === id && e.side === 0 && e.role === role && e.kind === 'building'));
}
function select(ids: number[]): void {
  scene?.selectEntities(ids);
  const owned = session?.state.entities.filter(e => ids.includes(e.id) && e.side === 0 && e.hp > 0) ?? [];
  if (owned.length) scene?.centerOn(owned.reduce((n, e) => n + e.x, 0) / owned.length, owned.reduce((n, e) => n + e.y, 0) / owned.length);
  update();
}
const callbacks: HudCallbacks = {
  build: (role, definitionId) => scene?.setBuildRole(role, definitionId),
  train: (role, definitionId) => { const id = selectedProducer(role === 'worker' ? 'hq' : 'barracks'); if (id !== undefined && !scene?.command({ type: 'train', id, role, definitionId })) shell.notice('The mission recruitment rules or resources prevent this order.'); },
  cancelTrain: (id, index, expectedQueue) => { const producer = session?.state.entities.find(e => e.id === id); if (producer && JSON.stringify(producer.queue) === expectedQueue) scene?.command({ type: 'cancelTrain', id, index }); },
  research: (upgrade, building) => { const id = building ?? selectedProducer(UPGRADES[upgrade].building); if (id !== undefined) scene?.command({ type: 'research', id, upgrade }); },
  ability: () => { if (scene && !scene.useAbility()) shell.notice('No selected ability is ready or has an eligible target.'); },
  clearRally: () => { if (scene) scene.command({ type: 'clearRally', ids: scene.selected }); },
  toggleGate: () => { if (scene) scene.command({ type: 'toggleGate', ids: scene.selected }); },
  stop: () => { if (scene) scene.command({ type: 'stop', ids: scene.selected }); },
  hold: () => { scene?.holdPosition(); }, attackMove: () => scene?.beginAttackMove(), select,
  pause: () => { if (!modalOpen && readOnlyReason() === null) scene?.togglePause(); update(); },
  restart: resetMission,
  center: (x, y) => scene?.centerOn(x, y),
  toggleMuted: () => { scene?.toggleMuted(); }, isMuted: () => scene?.muted ?? false,
  isPaused: () => scene?.paused ?? true, side: () => 0,
  canCommand: () => !!scene && !modalOpen && !scene.readOnly && !scene.photoMode && readOnlyReason() === null && session?.runtime.outcome === 'playing',
  canPause: () => !modalOpen && readOnlyReason() === null,
  isInspection: () => readOnlyReason() !== null,
  command: command => scene?.command(command) ?? false,
  engineerBuild: kind => scene?.beginEngineerBuild(kind), fieldRepair: () => scene?.beginFieldRepair(),
  level: () => scene?.viewLevel ?? 0,
  bindingLabel: action => controls.bindingsFor(action as ControlAction).map(displayBinding).join(' / '),
  groups: () => scene?.controlGroups() ?? {}, recallGroup: group => scene?.recallGroup(group),
  cameraCorners: () => {
    if (!scene?.cameras?.main) return [];
    const camera = scene.cameras.main, bounds = shell.battlefieldBounds();
    return [[0, bounds.top], [innerWidth, bounds.top], [innerWidth, bounds.bottom], [0, bounds.bottom]].map(([x, y]) => { const p = camera.getWorldPoint(x, y); return unproject(p.x, p.y); });
  },
};
const tools = new ScenarioTools(panel, {
  session: () => session, start: launchPractice,
  readOnlyReason,
  reset: resetMission,
  select, center: (x, y) => scene?.centerOn(x, y), notice: text => shell.notice(text),
  campaign: {
    progress: () => campaignProfile ? campaignProgress(campaignProfile) : null,
    start: campaignId => launchCampaign(prepareCampaignMission(createCampaignProfile(campaignId, crypto.randomUUID()))),
    continue: () => { if (campaignProfile && campaignReadOnlyReason() === null) launchCampaign(prepareCampaignMission(campaignProfile)); },
    choose: choiceId => { if (campaignProfile && campaignReadOnlyReason() === null) { campaignProfile = chooseCampaignBranch(campaignProfile, choiceId); persistProfile(); } },
  },
}, { campaigns: CAMPAIGNS, scenarios: SCENARIOS });
const conquestTools = new ConquestTools(panel, {
  profile: () => conquestProfile,
  readOnlyReason: conquestReadOnlyReason,
  start: faction => showRealm(createConquestProfile(faction, crypto.randomUUID())),
  battle: (regionId, mode) => { if (conquestProfile && conquestReadOnlyReason() === null) launchConquest(prepareConquestBattle(conquestProfile, regionId, mode)); },
  proposal: action => { if (conquestProfile && conquestReadOnlyReason() === null) { conquestProfile = proposeConquest(conquestProfile, action); persistRealm(); } },
  wait: () => { if (conquestProfile && conquestReadOnlyReason() === null) { conquestProfile = waitConquestTurn(conquestProfile); persistRealm(); } },
  resume: () => { const saved = localStorage.getItem(realmKey); if (!saved) throw new Error('No realm is saved on this browser.'); restoreRealm(saved); },
  hasSave: () => realmSaved,
  save: () => { if (conquestProfile) { checkpointProfile(); downloadProfile(`${conquestProfile.id}-realm.json`, conquestProfile); } },
  import: restoreRealm,
  notice: text => shell.notice(text),
});
const missionPicker = panel.querySelector<HTMLDetailsElement>('.scenario-tools details')!;
const realmPicker = panel.querySelector<HTMLDetailsElement>('.conquest-tools')!;
panel.prepend(realmPicker);
realmPicker.addEventListener('toggle', () => { if (realmPicker.open) missionPicker.open = false; });
missionPicker.addEventListener('toggle', () => { if (missionPicker.open) realmPicker.open = false; });
missionPicker.open = true;

function retire(done: () => void): void {
  ready = false;
  if (retiring) { retiring.events.once(Phaser.Core.Events.DESTROY, done); return; }
  if (!game) { done(); return; }
  scene!.setPhotoMode(false);
  syncPhotoMode(false);
  scene!.paused = true;
  overlay?.destroy(); overlay = undefined;
  const previous = game; retiring = previous; game = undefined; scene = undefined;
  previous.events.once(Phaser.Core.Events.DESTROY, () => { if (retiring === previous) retiring = undefined; done(); });
  previous.destroy(true);
}
function launch(next: ScenarioSession): void {
  const request = ++generation;
  retire(() => {
    if (request !== generation) return;
    session = next;
    setPanelOpen(false);
    launches.push({ id: next.definition.id, checkpoint: captureScenario(next) });
    commands.length = 0;
    battleEvents.length = 0;
    document.querySelector<HTMLElement>('#mission-introduction')!.hidden = true;
    missionPicker.open = false;
    shell.showGame();
    const inspection = readOnlyReason() !== null;
    scene = new GameScene({ state: next.state, controls, viewSide: 0, readOnly: inspection, simulationEnabled: !inspection,
      onCommand: dispatch,
      onSelection: () => update(), onNotice: text => shell.notice(text),
      onReady: () => {
        ready = true;
        scene!.paused = true;
        syncModal();
        overlay = new ScenarioOverlay(scene!, project);
        const army = next.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.role !== 'worker');
        if (army.length) scene!.centerOn(army.reduce((sum, e) => sum + e.x, 0) / army.length, army.reduce((sum, e) => sum + e.y, 0) / army.length);
        shell.ready(); update();
      },
      onStep: () => { if (session === next && !scene?.readOnly && readOnlyReason() === null) { afterScenarioStep(next, .05); battleEvents.push(...next.state.events.filter(event => event.type === 'attack' || event.type === 'death').map(event => ({ ...event, tick: next.state.tick }))); } },
      onPause: () => { if (scene && (scene.readOnly || modalOpen)) scene.paused = true; update(); }, onActionSlot: slot => { shell.activateActionSlot(slot); },
      onPhotoMode: syncPhotoMode,
      viewBounds: () => shell.battlefieldBounds(),
    });
    game = new Phaser.Game({ type: Phaser.CANVAS, parent: 'game-canvas', backgroundColor: '#14201e', antialias: true,
      scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight }, scene: [scene], fps: { target: 60 }, render: { pixelArt: false } });
    update();
  });
}
function update(): void {
  syncModal();
  const reason = readOnlyReason(), inspection = reason !== null;
  if (session && scene && ready) {
    if (!inspection && campaignProfile?.active && campaignRecorder && session.runtime.outcome === 'won' && !completionError) {
      try { campaignProfile = completeCampaignMission(campaignProfile, session, campaignRecorder.archive()); campaignRecorder.destroy(); campaignRecorder = null; persistProfile(); }
      catch (error) { completionError = true; profileNotice(error); }
    }
    if (!inspection && conquestProfile?.active && conquestRecorder && session.runtime.outcome !== 'playing' && !completionError) {
      try { conquestProfile = completeConquestBattle(conquestProfile, session, conquestRecorder.archive()); conquestRecorder.destroy(); conquestRecorder = null; persistRealm(); }
      catch (error) { completionError = true; shell.notice(error instanceof Error ? error.message : 'The conquest result could not be saved.'); }
    }
    shell.update(session.state, scene.selected, callbacks);
    for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>('#restart-button,#overlay-restart'))) { button.disabled = inspection; button.title = inspection ? reason : ''; }
    root.querySelector<HTMLElement>('.objective-tag')!.textContent = `${session.definition.title} · ${inspection ? session.runtime.outcome === 'won' ? 'Recorded victory' : session.runtime.outcome === 'lost' ? 'Recorded defeat' : 'Recorded battlefield' : session.runtime.outcome === 'playing' ? 'Complete the mission objectives' : session.runtime.outcome === 'won' ? 'Mission complete' : 'Mission failed'} · seed ${session.state.seed}`;
    if (scene.paused || session.runtime.outcome !== 'playing') {
      root.querySelector<HTMLElement>('#overlay-eyebrow')!.textContent = 'MISSION';
      root.querySelector<HTMLElement>('#overlay-title')!.textContent = inspection ? session.runtime.outcome === 'won' ? 'Recorded victory' : session.runtime.outcome === 'lost' ? 'Recorded defeat' : 'Recorded battlefield' : session.runtime.outcome === 'won' ? 'Mission complete' : session.runtime.outcome === 'lost' ? 'Mission failed' : session.state.tick === 0 ? 'Mission briefing' : 'Mission paused';
      root.querySelector<HTMLElement>('#overlay-description')!.textContent = inspection ? reason : session.runtime.outcome === 'won' ? session.definition.successText : session.runtime.outcome === 'lost' ? session.definition.failureText : session.definition.briefing;
    }
    overlay?.update(session, scene.photoMode);
  }
  tools.update();
  conquestTools.update();
  photoButton.disabled = !ready || !scene;
  saveProfile.disabled = !campaignProfile;
  if (!completionError) profileStatus.textContent = campaignProfile ? `${CAMPAIGNS[campaignProfile.campaignId].title} · ${campaignProfile.history.length}/4 chapters ${inspection ? 'recorded' : 'completed'}${campaignProfile.choiceId ? ` · route ${campaignProfile.choiceId}` : ''}${inspection ? ` · ${reason}` : campaignProfile.active ? ' · active mission saved every two seconds' : ''}` : 'Campaign profiles preserve the army and chosen route. Practice missions use their supplied army.';
}
setInterval(update, 50);
setInterval(checkpointProfile, 2000);
window.addEventListener('pagehide', checkpointProfile);

// Browser proofs may inspect a copied snapshot; all player actions use visible controls.
Object.defineProperty(window, 'scenarioDiagnostics', { configurable: true, get: () => {
  if (!session || !scene || !ready) return structuredClone({ ready: false, conquest: conquestProfile, campaignProfile, readOnlyReason: readOnlyReason() });
  const point = (x: number, y: number) => { const p = project(x, y), q = scene!.cameras.main.matrixCombined.transformPoint(p.x, p.y); return { x: q.x, y: q.y }; };
  return structuredClone({
    ready, id: session.definition.id, title: session.definition.title, paused: scene.paused, readOnly: scene.readOnly, simulationEnabled: scene.simulationEnabled, readOnlyReason: readOnlyReason(), campaignProfile,
    checkpoint: captureScenario(session), selected: [...scene.selected], commands, battleEvents, conquest: conquestProfile,
    launches: launches.map(item => ({ id: item.id, checkpoint: item.checkpoint })),
    actorScreens: Object.fromEntries(Object.entries(session.runtime.labels).map(([label, id]) => { const actor = session!.state.entities.find(e => e.id === id); return [label, actor ? point(actor.x, actor.y) : null]; })),
    objectiveScreens: session.definition.objectives.map(objective => ({ id: objective.id, text: objective.text })),
    warningScreen: session.runtime.boss.telegraph ? { ...point(session.runtime.boss.telegraph.x, session.runtime.boss.telegraph.y), width: session.runtime.boss.telegraph.radius * 90.51 * scene.cameras.main.zoom, height: session.runtime.boss.telegraph.radius * 45.255 * scene.cameras.main.zoom } : null,
    camera: { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY, zoom: scene.cameras.main.zoom },
    art: scene.artStatus,
    campaign: campaignProfile ? { id: campaignProfile.id, campaignId: campaignProfile.campaignId, choiceId: campaignProfile.choiceId, revision: campaignProfile.revision, progress: campaignProgress(campaignProfile),
      history: campaignProfile.history.map(result => ({ missionId: result.missionId, resultId: result.resultId, survivorIds: result.checkpoint.game.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0 && !e.illusion && !e.raised).map(e => e.id) })),
      active: campaignProfile.active ? { missionId: campaignProfile.active.missionId, deployedIds: campaignProfile.active.deployedIds } : null } : null,
  });
} });
