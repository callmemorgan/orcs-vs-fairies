import { CAMPAIGNS, SCENARIOS } from '../scenarios/campaigns';
import { captureScenario, createScenario, restoreScenario } from './scenarios';
import { scenarioJson } from './scenario-validation';
import { decodeScenarioRecording, ScenarioRecorder, scenarioChecksum, verifyScenarioRecording } from './scenario-recordings';
import type { ScenarioRecording } from './scenario-recordings';
import type { ScenarioCheckpoint, ScenarioSession } from './scenario-types';
import type { Entity } from './types';

export interface CampaignBattle {
  missionId: string;
  checkpoint: ScenarioCheckpoint;
  recording: ScenarioRecording;
  deployedIds: number[];
}
export interface CampaignResult extends CampaignBattle { resultId: string }
export interface CampaignProfile {
  format: 'orcs-vs-fairies-campaign'; version: 1;
  id: string; campaignId: string; choiceId: string | null;
  revision: number;
  history: CampaignResult[];
  active: CampaignBattle | null;
}
export interface CampaignSoldier { entity: Entity; label: string | null }
export interface CampaignMission { profile: CampaignProfile; session: ScenarioSession; recorder: ScenarioRecorder }
const copy = <T>(value: T): T => structuredClone(value);
function campaign(profile: CampaignProfile) { const result = CAMPAIGNS[profile.campaignId]; if (!result) throw new Error('Unknown campaign.'); return result; }

export function createCampaignProfile(campaignId: string, id: string): CampaignProfile {
  if (!CAMPAIGNS[campaignId]) throw new Error('Unknown campaign.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(id)) throw new Error('Campaign profile ID is invalid.');
  return { format: 'orcs-vs-fairies-campaign', version: 1, id, campaignId, choiceId: null, revision: 0, history: [], active: null };
}

export function nextCampaignMission(profile: CampaignProfile): string | null {
  const definition = campaign(profile), completed = profile.history.length;
  if (completed >= 4) return null;
  if (completed === 2) {
    if (!profile.choiceId) return null;
    const choice = definition.choice.options.find(choice => choice.id === profile.choiceId); if (!choice) throw new Error('Unknown campaign branch.');
    return choice.chapter3;
  }
  return definition.chapters[completed];
}

export function campaignProgress(profile: CampaignProfile) {
  return { campaignId: profile.campaignId, chapter: profile.history.length, ...(profile.choiceId ? { choiceId: profile.choiceId } : {}), completed: profile.history.map(result => result.missionId), finished: profile.history.length === 4 };
}

export function chooseCampaignBranch(profile: CampaignProfile, choiceId: string): CampaignProfile {
  const definition = campaign(profile);
  if (profile.history.length !== 2 || profile.active) throw new Error('Choose a branch after completing chapter two.');
  if (!definition.choice.options.some(choice => choice.id === choiceId)) throw new Error('Unknown campaign branch.');
  if (profile.choiceId && profile.choiceId !== choiceId) throw new Error('This campaign already chose its branch. Start another profile to take the other route.');
  if (profile.choiceId === choiceId) return profile;
  return { ...profile, choiceId, revision: profile.revision + 1 };
}

/** Reserves survive while deployed losses disappear; illusions and raised troops never enter the roster. */
export function campaignArmy(profile: CampaignProfile): CampaignSoldier[] {
  const army = new Map<number, CampaignSoldier>();
  for (const result of profile.history) {
    for (const id of result.deployedIds) army.delete(id);
    const session = restoreScenario(result.checkpoint), labels = new Map(Object.entries(session.runtime.labels).map(([label, id]) => [id, label]));
    for (const entity of session.state.entities) if (entity.side === 0 && entity.kind === 'unit' && entity.hp > 0 && !entity.illusion && !entity.raised) army.set(entity.id, { entity: copy(entity), label: labels.get(entity.id) ?? null });
  }
  return [...army.values()].sort((a, b) => a.entity.id - b.entity.id);
}

function installArmy(session: ScenarioSession, soldiers: CampaignSoldier[]): number[] {
  const deployed: number[] = [], available = [...soldiers];
  // Chapter-specific detachments preserve the fixed army size; unused survivors remain in reserve.
  const slots = session.definition.army.filter(a => a.side === 0 && a.kind === 'unit').sort((a, b) => Number(b.label === 'commander') - Number(a.label === 'commander'));
  for (const slot of slots) {
    const placeholder = session.state.entities.find(e => e.id === session.runtime.labels[slot.label])!;
    const exactDefinition = (a: Entity, b: Entity) => (a as Entity & { definitionId?: string }).definitionId === (b as Entity & { definitionId?: string }).definitionId;
    const index = available.findIndex(soldier => soldier.entity.role === placeholder.role && exactDefinition(soldier.entity, placeholder) && (slot.label === 'commander' ? soldier.label === 'commander' : soldier.label !== 'commander'));
    if (index < 0) continue;
    const soldier = available.splice(index, 1)[0], entity = copy(soldier.entity);
    entity.x = placeholder.x; entity.y = placeholder.y; if (placeholder.level !== undefined) entity.level = placeholder.level; else delete entity.level;
    // The army rests between chapters. Rank, equipment and identity remain; wounds and cooldowns recover.
    entity.hp = entity.maxHp; entity.shield = entity.maxShield ?? 0; entity.order = copy(placeholder.order); delete entity.orderQueue; entity.path = []; entity.cooldown = 0; delete entity.abilityReadyAt; delete entity.entrenchedAt; delete entity.lastDamagedAt; delete entity.lastAttacker; delete entity.surgeUntil;
    entity.animation = 'idle'; entity.animTime = 0; entity.carried = 0; entity.expires = 0;
    const veteran = (entity as Entity & { veteran?: { nextSurvivalAt: number } }).veteran; if (veteran) veteran.nextSurvivalAt = 30;
    const position = session.state.entities.indexOf(placeholder); session.state.entities[position] = entity;
    session.runtime.labels[slot.label] = entity.id; deployed.push(entity.id);
    for (const event of session.state.events) if (event.source === placeholder.id) event.source = entity.id;
  }
  return deployed;
}

export function prepareCampaignMission(profile: CampaignProfile): CampaignMission {
  if (profile.active) {
    const session = restoreScenario(profile.active.checkpoint); return { profile, session, recorder: new ScenarioRecorder(session, profile.active.recording) };
  }
  const missionId = nextCampaignMission(profile);
  if (!missionId) throw new Error(profile.history.length === 4 ? 'This campaign is complete.' : 'Choose the next route before continuing.');
  const army = campaignArmy(profile), largestId = Math.max(0, ...army.map(s => s.entity.id), ...profile.history.map(h => h.checkpoint.game.state.nextId - 1));
  const session = createScenario(SCENARIOS[missionId], { firstEntityId: largestId + 1 });
  const deployedIds = installArmy(session, army), recorder = new ScenarioRecorder(session);
  const active: CampaignBattle = { missionId, checkpoint: captureScenario(session), recording: recorder.archive(), deployedIds };
  return { profile: { ...profile, active, revision: profile.revision + 1 }, session, recorder };
}

export function checkpointCampaignMission(profile: CampaignProfile, session: ScenarioSession, recorder: ScenarioRecorder): CampaignProfile {
  if (!profile.active || profile.active.missionId !== session.definition.id) throw new Error('The mission does not belong to the active campaign.');
  return { ...profile, revision: profile.revision + 1, active: { ...profile.active, checkpoint: captureScenario(session), recording: recorder.archive() } };
}

/** Applies a result once, after replaying its real commands and matching the authoritative checkpoint. */
export function completeCampaignMission(profile: CampaignProfile, session: ScenarioSession, input: ScenarioRecording): CampaignProfile {
  const resultId = `${profile.id}/${session.definition.id}`;
  const prior = profile.history.find(result => result.resultId === resultId);
  if (prior) {
    if (prior.recording.finalChecksum !== input.finalChecksum) throw new Error('A different result already completed this mission.');
    return profile;
  }
  if (!profile.active || profile.active.missionId !== nextCampaignMission(profile) || profile.active.missionId !== session.definition.id) throw new Error('Only the active campaign mission can advance its profile.');
  const recording = decodeScenarioRecording(input);
  if (JSON.stringify(recording.initial.definition) !== JSON.stringify(SCENARIOS[session.definition.id]) || scenarioChecksum(restoreScenario(recording.initial)) !== scenarioChecksum(restoreScenario(profile.active.recording.initial))) throw new Error('The mission recording does not start from this campaign army and map.');
  const verified = verifyScenarioRecording(recording);
  if (verified.runtime.outcome !== 'won' || verified.state.winner !== 0 || scenarioChecksum(verified) !== scenarioChecksum(session)) throw new Error('The mission result could not be verified.');
  const checkpoint = captureScenario(verified), result: CampaignResult = { resultId, missionId: session.definition.id, checkpoint, recording, deployedIds: [...profile.active.deployedIds] };
  return { ...profile, history: [...profile.history, result], active: null, revision: profile.revision + 1 };
}

export function resetCampaignMission(profile: CampaignProfile): CampaignMission {
  if (!profile.active) throw new Error('There is no active mission to reset.');
  const session = restoreScenario(profile.active.recording.initial), recorder = new ScenarioRecorder(session);
  const active = { ...profile.active, checkpoint: captureScenario(session), recording: recorder.archive() };
  return { profile: { ...profile, active, revision: profile.revision + 1 }, session, recorder };
}

export function decodeCampaignProfile(input: unknown): CampaignProfile {
  let raw = input;
  if (typeof raw === 'string') { if (raw.length > 20 * 1024 * 1024) throw new Error('Campaign profile is too large.'); raw = JSON.parse(raw); }
  const profile = scenarioJson(raw) as CampaignProfile;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) || Object.keys(profile).some(k => !['format', 'version', 'id', 'campaignId', 'choiceId', 'revision', 'history', 'active'].includes(k)) || profile.format !== 'orcs-vs-fairies-campaign' || profile.version !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(profile.id) || !Number.isSafeInteger(profile.revision) || profile.revision < 0 || !Array.isArray(profile.history) || profile.history.length > 4) throw new Error('Invalid campaign profile.');
  const definition = campaign(profile);
  if (profile.choiceId !== null && !definition.choice.options.some(c => c.id === profile.choiceId) || profile.history.length < 2 && profile.choiceId !== null || profile.history.length > 2 && profile.choiceId === null) throw new Error('Invalid saved campaign branch.');
  const seen = new Set<string>();
  let canonical = createCampaignProfile(profile.campaignId, profile.id);
  const validateBattle = (value: CampaignBattle, expected: string): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['missionId', 'checkpoint', 'recording', 'deployedIds', 'resultId'].includes(k)) || value.missionId !== expected || !Array.isArray(value.deployedIds) || value.deployedIds.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(value.deployedIds).size !== value.deployedIds.length) throw new Error('Invalid campaign battle.');
    const checkpoint = restoreScenario(value.checkpoint), recording = decodeScenarioRecording(value.recording);
    if (checkpoint.definition.id !== expected || JSON.stringify(recording.initial.definition) !== JSON.stringify(SCENARIOS[expected]) || recording.finalChecksum !== scenarioChecksum(checkpoint) || recording.finalTick !== checkpoint.state.tick) throw new Error('Campaign battle checkpoint disagrees with its recording.');
    if (value.deployedIds.some(id => !recording.initial.game.state.entities.some(e => e.id === id && e.side === 0 && e.kind === 'unit'))) throw new Error('Invalid campaign deployed army.');
  };
  profile.history.forEach((result, index) => {
    if (index === 2) canonical = chooseCampaignBranch(canonical, profile.choiceId!);
    const expected = index === 2 ? definition.choice.options.find(c => c.id === profile.choiceId)!.chapter3 : definition.chapters[index];
    validateBattle(result, expected);
    if (result.resultId !== `${profile.id}/${expected}` || seen.has(result.resultId)) throw new Error('Duplicate or invalid campaign result.'); seen.add(result.resultId);
    const prepared = prepareCampaignMission(canonical); prepared.recorder.destroy();
    if (scenarioChecksum(prepared.session) !== scenarioChecksum(restoreScenario(result.recording.initial)) || JSON.stringify(prepared.profile.active!.deployedIds) !== JSON.stringify(result.deployedIds)) throw new Error('Campaign history starts from an altered detachment.');
    if (verifyScenarioRecording(result.recording).runtime.outcome !== 'won') throw new Error('Campaign history contains an unverified victory.');
    canonical = { ...prepared.profile, history: [...canonical.history, result], active: null };
  });
  if (profile.history.length === 2 && profile.choiceId) canonical = chooseCampaignBranch(canonical, profile.choiceId);
  if (profile.active !== null) {
    const expected = nextCampaignMission({ ...profile, active: null }); if (!expected) throw new Error('A campaign cannot have an active battle before its branch choice or after its finale.');
    validateBattle(profile.active, expected);
    const prepared = prepareCampaignMission(canonical); prepared.recorder.destroy();
    if (scenarioChecksum(prepared.session) !== scenarioChecksum(restoreScenario(profile.active.recording.initial)) || JSON.stringify(prepared.profile.active!.deployedIds) !== JSON.stringify(profile.active.deployedIds)) throw new Error('Campaign battle starts from an altered detachment.');
    verifyScenarioRecording(profile.active.recording);
  }
  return profile;
}

/** Server achievements require all four canonical chapters and their real replayed outcomes. */
export function verifyCanonicalCampaignVictory(input: unknown, missionId: string) {
  const profile = decodeCampaignProfile(input), definition = campaign(profile), finale = profile.history.at(-1);
  if (profile.history.length !== 4 || profile.active || !finale || finale.missionId !== missionId || missionId !== definition.chapters[3]) throw new Error('Complete the canonical campaign finale before claiming this achievement.');
  return { campaignId: definition.id, missionId, factionId: definition.faction };
}
