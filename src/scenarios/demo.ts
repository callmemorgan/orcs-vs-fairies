import Phaser from 'phaser';
import { UPGRADES } from '../core/content';
import { campaignProgress, checkpointCampaignMission, chooseCampaignBranch, completeCampaignMission, createCampaignProfile, decodeCampaignProfile, prepareCampaignMission, resetCampaignMission } from '../core/campaign';
import type { CampaignMission, CampaignProfile } from '../core/campaign';
import type { ScenarioRecorder } from '../core/scenario-recordings';
import { afterScenarioStep, captureScenario, issueScenarioCommand, resetScenario, restoreScenario } from '../core/scenarios';
import type { ScenarioSession } from '../core/scenario-types';
import type { BuildingRole, Command, Side } from '../core/types';
import { ControlProfiles, displayBinding } from '../game/Controls';
import type { ControlAction } from '../game/Controls';
import GameScene, { project, unproject } from '../game/GameScene';
import { ScenarioOverlay } from '../game/ScenarioOverlay';
import { mountShell } from '../ui/Hud';
import type { HudCallbacks } from '../ui/Hud';
import { ScenarioTools } from '../ui/ScenarioTools';
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
let completionError = false;
const profileKey = 'ovf.campaign.demo.v1';
const commands: Array<{ tick: number; side: Side; command: Command; accepted: boolean }> = [];
const launches: Array<{ id: string; checkpoint: ReturnType<typeof captureScenario> }> = [];
const panel = document.querySelector<HTMLElement>('#scenario-panel')!;
const toggle = document.querySelector<HTMLButtonElement>('#mission-panel-toggle')!;
toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.textContent = panel.hidden ? 'Show missions' : 'Hide missions'; toggle.setAttribute('aria-expanded', String(!panel.hidden)); };
const profileControls = document.createElement('section'); profileControls.setAttribute('aria-label', 'Campaign profile'); profileControls.className = 'scenario-tools';
const profileStatus = document.createElement('p'); profileStatus.setAttribute('role', 'status');
const resumeProfile = document.createElement('button'); resumeProfile.textContent = 'Resume saved campaign';
const saveProfile = document.createElement('button'); saveProfile.textContent = 'Save campaign profile'; saveProfile.disabled = true;
const profileFile = document.createElement('input'); profileFile.type = 'file'; profileFile.accept = '.json,application/json'; profileFile.setAttribute('aria-label', 'Import campaign profile');
const profileLabel = document.createElement('label'); profileLabel.textContent = 'Load campaign profile'; profileLabel.append(profileFile);
profileControls.append(profileStatus, resumeProfile, saveProfile, profileLabel); panel.append(profileControls);
function profileNotice(error: unknown): void { profileStatus.textContent = error instanceof Error ? error.message : 'The campaign could not be saved.'; shell.notice(profileStatus.textContent); }
function persistProfile(): void {
  if (!campaignProfile) return;
  try { localStorage.setItem(profileKey, JSON.stringify(campaignProfile)); resumeProfile.disabled = false; } catch (error) { profileNotice(error); }
}
function checkpointProfile(): void {
  if (ready && session && campaignProfile?.active && campaignRecorder && session.runtime.outcome === 'playing') campaignProfile = checkpointCampaignMission(campaignProfile, session, campaignRecorder);
  persistProfile();
}
function launchPractice(next: ScenarioSession): void { campaignRecorder?.destroy(); campaignRecorder = null; campaignProfile = null; completionError = false; launch(next); }
function launchCampaign(run: CampaignMission): void {
  campaignRecorder?.destroy(); campaignProfile = run.profile; campaignRecorder = run.recorder; completionError = false; launch(run.session); persistProfile();
}
function restoreProfile(input: unknown): void {
  const profile = decodeCampaignProfile(input);
  if (profile.active || profile.history.length === 0) launchCampaign(prepareCampaignMission(profile));
  else {
    campaignRecorder?.destroy(); campaignRecorder = null; campaignProfile = profile; completionError = false;
    launch(restoreScenario(profile.history.at(-1)!.checkpoint)); persistProfile();
  }
}
function resetMission(): void {
  if (campaignProfile?.active) launchCampaign(resetCampaignMission(campaignProfile));
  else if (session) launchPractice(resetScenario(session));
}
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
  if (!session) return false;
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
  build: role => scene?.setBuildRole(role),
  train: role => { const id = selectedProducer(role === 'worker' ? 'hq' : 'barracks'); if (id !== undefined && !scene?.command({ type: 'train', id, role })) shell.notice('The mission recruitment rules or resources prevent this order.'); },
  cancelTrain: (id, index, expectedQueue) => { const producer = session?.state.entities.find(e => e.id === id); if (producer && JSON.stringify(producer.queue) === expectedQueue) scene?.command({ type: 'cancelTrain', id, index }); },
  research: (upgrade, building) => { const id = building ?? selectedProducer(UPGRADES[upgrade].building); if (id !== undefined) scene?.command({ type: 'research', id, upgrade }); },
  ability: () => { if (!scene?.command({ type: 'ability', ids: scene.selected })) shell.notice('No selected ability is ready or has an eligible target.'); },
  clearRally: () => { if (scene) scene.command({ type: 'clearRally', ids: scene.selected }); },
  toggleGate: () => { if (scene) scene.command({ type: 'toggleGate', ids: scene.selected }); },
  stop: () => { if (scene) scene.command({ type: 'stop', ids: scene.selected }); },
  hold: () => { scene?.holdPosition(); }, attackMove: () => scene?.beginAttackMove(), select,
  pause: () => { scene?.togglePause(); update(); },
  restart: resetMission,
  center: (x, y) => scene?.centerOn(x, y),
  toggleMuted: () => { scene?.toggleMuted(); }, isMuted: () => scene?.muted ?? false,
  isPaused: () => scene?.paused ?? true, side: () => 0,
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
  reset: resetMission,
  select, center: (x, y) => scene?.centerOn(x, y), notice: text => shell.notice(text),
  campaign: {
    progress: () => campaignProfile ? campaignProgress(campaignProfile) : null,
    start: campaignId => launchCampaign(prepareCampaignMission(createCampaignProfile(campaignId, crypto.randomUUID()))),
    continue: () => { if (campaignProfile) launchCampaign(prepareCampaignMission(campaignProfile)); },
    choose: choiceId => { if (campaignProfile) { campaignProfile = chooseCampaignBranch(campaignProfile, choiceId); persistProfile(); } },
  },
}, { campaigns: CAMPAIGNS, scenarios: SCENARIOS });
panel.querySelector<HTMLDetailsElement>('details')!.open = true;

function retire(done: () => void): void {
  if (retiring) { retiring.events.once(Phaser.Core.Events.DESTROY, done); return; }
  if (!game) { done(); return; }
  ready = false;
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
    launches.push({ id: next.definition.id, checkpoint: captureScenario(next) });
    commands.length = 0;
    document.querySelector<HTMLElement>('#mission-introduction')!.hidden = true;
    panel.querySelector<HTMLDetailsElement>('details')!.open = false;
    shell.showGame();
    scene = new GameScene({ state: next.state, controls, viewSide: 0,
      onCommand: dispatch,
      onSelection: () => update(), onNotice: text => shell.notice(text),
      onReady: () => {
        ready = true;
        scene!.paused = true;
        overlay = new ScenarioOverlay(scene!, project);
        const army = next.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.role !== 'worker');
        if (army.length) scene!.centerOn(army.reduce((sum, e) => sum + e.x, 0) / army.length, army.reduce((sum, e) => sum + e.y, 0) / army.length);
        shell.ready(); update();
      },
      onStep: () => { if (session === next) afterScenarioStep(next, .05); },
      onPause: () => update(), onActionSlot: slot => { shell.activateActionSlot(slot); },
      viewBounds: () => shell.battlefieldBounds(),
    });
    game = new Phaser.Game({ type: Phaser.CANVAS, parent: 'game-canvas', backgroundColor: '#14201e', antialias: true,
      scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight }, scene: [scene], fps: { target: 60 }, render: { pixelArt: false } });
    update();
  });
}
function update(): void {
  if (session && scene && ready) {
    if (campaignProfile?.active && campaignRecorder && session.runtime.outcome === 'won' && !completionError) {
      try { campaignProfile = completeCampaignMission(campaignProfile, session, campaignRecorder.archive()); campaignRecorder.destroy(); campaignRecorder = null; persistProfile(); }
      catch (error) { completionError = true; profileNotice(error); }
    }
    shell.update(session.state, scene.selected, callbacks);
    root.querySelector<HTMLElement>('.objective-tag')!.textContent = `${session.definition.title} · ${session.runtime.outcome === 'playing' ? 'Complete the mission objectives' : session.runtime.outcome === 'won' ? 'Mission complete' : 'Mission failed'} · seed ${session.state.seed}`;
    if (scene.paused || session.runtime.outcome !== 'playing') {
      root.querySelector<HTMLElement>('#overlay-eyebrow')!.textContent = 'MISSION';
      root.querySelector<HTMLElement>('#overlay-title')!.textContent = session.runtime.outcome === 'won' ? 'Mission complete' : session.runtime.outcome === 'lost' ? 'Mission failed' : session.state.tick === 0 ? 'Mission briefing' : 'Mission paused';
      root.querySelector<HTMLElement>('#overlay-description')!.textContent = session.runtime.outcome === 'won' ? session.definition.successText : session.runtime.outcome === 'lost' ? session.definition.failureText : session.definition.briefing;
    }
    overlay?.update(session, scene.photoMode);
  }
  tools.update();
  saveProfile.disabled = !campaignProfile;
  if (!completionError) profileStatus.textContent = campaignProfile ? `${CAMPAIGNS[campaignProfile.campaignId].title} · ${campaignProfile.history.length}/4 chapters completed${campaignProfile.choiceId ? ` · route ${campaignProfile.choiceId}` : ''}${campaignProfile.active ? ' · active mission saved every two seconds' : ''}` : 'Campaign profiles preserve the army and chosen route. Practice missions use their supplied army.';
}
setInterval(update, 50);
setInterval(checkpointProfile, 2000);
window.addEventListener('pagehide', checkpointProfile);

// Browser proofs may inspect a copied snapshot; all player actions use visible controls.
Object.defineProperty(window, 'scenarioDiagnostics', { get: () => {
  if (!session || !scene || !ready) return { ready: false };
  const point = (x: number, y: number) => { const p = project(x, y), q = scene!.cameras.main.matrixCombined.transformPoint(p.x, p.y); return { x: q.x, y: q.y }; };
  return structuredClone({
    ready, id: session.definition.id, title: session.definition.title, paused: scene.paused,
    checkpoint: captureScenario(session), selected: [...scene.selected], commands,
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
