import { FACTIONS } from './content';
import { deployScenarioArmy, type CampaignSoldier } from './campaign';
import { captureScenario, createScenario, restoreScenario } from './scenarios';
import { decodeScenarioRecording, ScenarioRecorder, scenarioStateEquals, verifyScenarioRecording } from './scenario-recordings';
import { scenarioJson } from './scenario-validation';
import { conquestWorldFor } from '../scenarios/conquest-world';
import type { ConquestAction, ConquestBattle, ConquestMission, ConquestProfile } from './conquest-types';
import type { ScenarioActor, ScenarioDefinition, ScenarioSession } from './scenario-types';
import type { ScenarioRecording } from './scenario-recordings';
import type { Cost, FactionId, TerrainKind } from './types';

const copy = <T>(value: T): T => structuredClone(value);
const resources = ['wood', 'ore', 'crystal'] as const;
const empty = (): Cost => ({ wood: 0, ore: 0, crystal: 0 });
const total = (a: Cost, b: Cost): Cost => ({ wood: Math.min(1000000, a.wood + b.wood), ore: Math.min(1000000, a.ore + b.ore), crystal: Math.min(1000000, a.crystal + b.crystal) });
const world = (profile: ConquestProfile) => conquestWorldFor(profile.faction);
const region = (profile: ConquestProfile, id: string) => { const found = world(profile).regions.find(r => r.id === id); if (!found) throw new Error('Unknown conquest region.'); return found; };
const protectedFaction = (profile: ConquestProfile, faction: FactionId) => faction === profile.faction || profile.relations[faction].alliance || profile.relations[faction].truceUntil > profile.turn;

/** Only owned and treaty-protected territory may connect an invasion to Hearth. */
export function reachableConquestRegions(profile: ConquestProfile): string[] {
  const seen = new Set(['hearth']), candidates = new Set<string>(), queue = ['hearth'];
  for (let index = 0; index < queue.length; index++) for (const id of region(profile, queue[index]).neighbors) {
    candidates.add(id);
    if (!seen.has(id) && protectedFaction(profile, profile.regions[id].owner)) { seen.add(id); queue.push(id); }
  }
  return [...candidates].filter(id => id !== 'hearth').sort();
}

export function conquestSupply(profile: ConquestProfile): Cost {
  const reachable = new Set(['hearth', ...reachableConquestRegions(profile)]);
  return world(profile).regions.filter(r => reachable.has(r.id) && profile.regions[r.id].owner === profile.faction).reduce((supply, r) => total(supply, r.supply), empty());
}

function friendlyArmy(session: ScenarioSession): CampaignSoldier[] {
  const labels = new Map(Object.entries(session.runtime.labels).map(([label, id]) => [id, label]));
  return session.state.entities.filter(e => e.side === 0 && e.kind === 'unit' && e.hp > 0 && !e.illusion && !e.raised).map(entity => ({ entity: copy(entity), label: labels.get(entity.id) ?? null }));
}

function battleDefinition(profile: ConquestProfile, regionId: string, mode: 'attack' | 'passage'): ScenarioDefinition {
  const site = region(profile, regionId), owner = profile.regions[regionId].owner, width = 36, height = 36;
  const terrain: TerrainKind[] = Array.from({ length: width * height }, (_, i) => {
    const x = i % width, y = Math.floor(i / width);
    if (x === 0 || y === 0 || x === 35 || y === 35) return 'rock';
    if (x >= 2 && x <= 14 && y >= 21 && y <= 30) return 'grass';
    if (site.objective === 'crossing' && x >= 17 && x <= 19) return y >= 14 && y <= 18 ? 'bridge' : 'water';
    if (site.terrain === 'rock') return x >= 16 && x <= 19 && (y < 14 || y > 18) ? 'rock' : y >= 14 && y <= 18 ? 'road' : 'grass';
    if (site.terrain === 'forest' && y >= 11 && y <= 20) return y >= 14 && y <= 18 ? 'road' : 'grass';
    return y >= 14 && y <= 18 ? 'road' : site.terrain;
  });
  const army: ScenarioActor[] = [
    { label: 'commander', side: 0, kind: 'unit', role: 'special', x: 8, y: 15 },
    ...(['ranged', 'ranged', 'melee', 'spear', 'worker'] as const).map((role, i) => ({ label: `detachment-${i}`, side: 0 as const, kind: 'unit' as const, role, x: 7 + i % 2, y: 13 + Math.floor(i / 2) * 2 })),
    { label: 'home-fort', side: 0, kind: 'building', role: 'hq', x: 5, y: 26 },
    { label: 'barracks', side: 0, kind: 'building', role: 'barracks', x: 10, y: 26 },
    ...Array.from({ length: profile.regions[regionId].garrison }, (_, i) => ({ label: `garrison-${i}`, side: 1 as const, kind: 'unit' as const, role: (i % 3 === 0 ? 'ranged' : 'melee') as 'ranged' | 'melee', x: 24 + i % 2 * 2, y: 13 + Math.floor(i / 2) * 2, order: { type: 'hold' as const } })),
  ];
  if (mode === 'attack' && site.objective === 'siege') army.push({ label: 'region-fort', side: 1, kind: 'building', role: 'tower', x: 29, y: 17 });
  const allies = Object.entries(profile.relations).filter(([, relation]) => relation.alliance && relation.treasury.ore >= 40);
  for (const [index, [ally]] of allies.slice(0, 2).entries()) army.push({ label: `aid-${ally}`, side: 0, kind: 'unit', role: 'ranged', x: 11, y: 14 + index * 2 });
  const treasury = allies.length ? total(profile.treasury, { wood: 60, ore: 40, crystal: 5 }) : profile.treasury;
  const required = mode === 'passage' || site.objective === 'crossing' ? { type: 'at' as const, actor: 'commander', point: { x: 29, y: 16 }, radius: 1 } : { type: 'cleared' as const, side: 1 as const, buildings: true };
  const events: ScenarioDefinition['events'] = [];
  if (mode === 'passage') {
    events.push({ id: 'treaty-protection', when: { type: 'time', seconds: 0 }, actions: [{ type: 'alliance', allied: true }, { type: 'message', text: profile.relations[owner].alliance ? 'The alliance grants passage. The garrison will hold its fire.' : `The truce grants passage for ${(profile.relations[owner].truceUntil - profile.turn) * 15} seconds.` }] });
    if (!profile.relations[owner].alliance) events.push({ id: 'truce-expiry', when: { type: 'time', seconds: (profile.relations[owner].truceUntil - profile.turn) * 15 }, actions: [{ type: 'alliance', allied: false }, { type: 'message', text: 'The truce has expired. The garrison is hostile again.' }] });
  }
  if (site.objective === 'hold' && mode === 'attack') events.push({ id: 'counterattack', when: { type: 'time', seconds: 15 }, actions: [{ type: 'order', actors: army.filter(a => a.side === 1).map(a => a.label), order: { type: 'attackMove', x: 8, y: 16 } }] });
  return {
    schemaVersion: 1, id: `conquest-${profile.faction}-${regionId}-${mode}`, title: `${mode === 'attack' ? 'Capture' : 'Pass through'} ${site.name}`,
    briefing: `${site.briefing} ${mode === 'attack' ? `Defeat its ${profile.regions[regionId].garrison} defenders with the persistent detachment.` : 'Move the commander to the eastern exit while the treaty protects the detachment.'}`,
    successText: mode === 'attack' ? `${site.name} joins your realm.` : 'The detachment completed its passage.', failureText: 'The detachment could not complete its mission.', faction: profile.faction, opponent: owner,
    seed: 73100 + world(profile).regions.findIndex(r => r.id === regionId), map: { size: 'small', width, height, terrain, starts: [{ x: 5, y: 26 }, { x: 28, y: 26 }], resources: [{ x: 10, y: 22, kind: 'wood', amount: site.supply.wood * 4 + 100, maxAmount: site.supply.wood * 4 + 100 }, { x: 13, y: 22, kind: 'ore', amount: site.supply.ore * 4 + 80, maxAmount: site.supply.ore * 4 + 80 }] }, army,
    objectives: [{ id: 'region', text: mode === 'passage' ? 'Reach the eastern exit under treaty protection.' : site.objective === 'crossing' ? 'Clear the crossing and reach the far bank.' : site.objective === 'hold' ? 'Survive the counterattack and eliminate its garrison.' : 'Eliminate the defending garrison.', success: mode === 'attack' && site.objective === 'crossing' ? { type: 'all', conditions: [required, { type: 'cleared', side: 1 }] } : mode === 'attack' && site.objective === 'hold' ? { type: 'all', conditions: [required, { type: 'time', seconds: 25 }] } : required, failure: { type: 'dead', actor: 'commander' } }], events,
    rules: { fixedArmy: false, reinforcementBudget: Math.min(6, 2 + Math.floor(conquestSupply(profile).ore / 30)), resources: copy(treasury), timeLimit: 180 },
  };
}

export function createConquestProfile(faction: FactionId, id: string): ConquestProfile {
  if (!Object.hasOwn(FACTIONS, faction) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(id)) throw new Error('Invalid conquest faction or profile ID.');
  const definition = conquestWorldFor(faction);
  const profile: ConquestProfile = { format: 'orcs-vs-fairies-conquest', version: 1, id, worldId: definition.id, faction, turn: 0, treasury: { wood: 500, ore: 350, crystal: 100 }, regions: Object.fromEntries(definition.regions.map(r => [r.id, { owner: r.owner, garrison: r.garrison }])), relations: Object.fromEntries(Object.keys(FACTIONS).map(other => [other, { score: 0, warPressure: 0, alliance: false, truceUntil: 0, treasury: { wood: 150, ore: 100, crystal: 20 } }])), army: [], history: [], active: null };
  profile.army = friendlyArmy(createScenario(battleDefinition(profile, 'grove', 'attack'))); return profile;
}

export function proposeConquest(profile: ConquestProfile, action: Exclude<ConquestAction, { type: 'battle' | 'wait' }>): ConquestProfile {
  if (profile.active) throw new Error('Finish the active battlefield before negotiating.');
  if (action.faction === profile.faction || !Object.hasOwn(profile.relations, action.faction)) throw new Error('Choose a foreign faction.');
  const next = copy(profile), relation = next.relations[action.faction];
  if (action.type === 'tribute') {
    if (!Number.isSafeInteger(action.amount) || action.amount < 25 || action.amount > 300 || next.treasury.ore < action.amount) throw new Error('Tribute requires 25–300 available ore.');
    next.treasury.ore -= action.amount; relation.treasury.ore += action.amount; relation.score = Math.min(100, relation.score + Math.floor(action.amount / 5));
  } else if (action.type === 'truce') {
    if (!Number.isSafeInteger(action.turns) || action.turns < 1 || action.turns > 8) throw new Error('A truce lasts one to eight turns.');
    if (relation.score < 20 + relation.warPressure * 8 || relation.alliance) throw new Error('The faction rejects a truce because relations and war pressure do not meet its terms.');
    relation.truceUntil = Math.max(relation.truceUntil, next.turn + action.turns);
  } else if (action.type === 'alliance') {
    if (relation.score < 50 + relation.warPressure * 12) throw new Error('The faction rejects an alliance because relations and war pressure do not meet its terms.');
    relation.alliance = true;
  } else throw new Error('Unknown diplomatic proposal.');
  next.history.push(copy(action)); return next;
}

export function waitConquestTurn(profile: ConquestProfile): ConquestProfile {
  if (profile.active || profile.turn >= 1000) throw new Error('A conquest turn cannot advance now.');
  return { ...copy(profile), turn: profile.turn + 1, treasury: total(profile.treasury, conquestSupply(profile)), history: [...profile.history, { type: 'wait' }] };
}

export function prepareConquestBattle(profile: ConquestProfile, regionId: string, mode: 'attack' | 'passage' = 'attack'): ConquestMission {
  if (profile.active) { if (profile.active.regionId !== regionId || profile.active.mode !== mode) throw new Error('A different conquest battle is active.'); const session = restoreScenario(profile.active.checkpoint); return { profile, session, recorder: new ScenarioRecorder(session, profile.active.recording) }; }
  if (!reachableConquestRegions(profile).includes(regionId)) throw new Error('This region is unreachable from owned or treaty-protected territory.');
  const owner = profile.regions[regionId].owner;
  if (owner === profile.faction) throw new Error('This region already belongs to your realm.');
  if (mode !== 'attack' && mode !== 'passage' || mode === 'attack' && protectedFaction(profile, owner) || mode === 'passage' && !protectedFaction(profile, owner)) throw new Error('The current agreement does not permit this battlefield action.');
  const largest = Math.max(0, ...profile.army.map(s => s.entity.id), ...profile.history.flatMap(a => a.type === 'battle' ? [a.recording.initial.game.state.nextId + 4096] : []));
  const session = createScenario(battleDefinition(profile, regionId, mode), { firstEntityId: largest + 1 }), deployedIds = deployScenarioArmy(session, profile.army), recorder = new ScenarioRecorder(session);
  const replacements = session.definition.army.filter(a => a.side === 0 && a.kind === 'unit' && !a.label.startsWith('aid-')).map(a => session.runtime.labels[a.label]).filter(id => !deployedIds.includes(id));
  session.state.entities = session.state.entities.filter(e => !replacements.includes(e.id));
  // Campaign casualties cannot be replaced by authored starting placeholders.
  session.state.players[0].population = session.state.entities.filter(e => e.side === 0 && e.kind === 'unit').length;
  recorder.destroy(); const readyRecorder = new ScenarioRecorder(session);
  const active: ConquestBattle = { regionId, mode, deployedIds, checkpoint: captureScenario(session), recording: readyRecorder.archive() };
  return { profile: { ...copy(profile), active }, session, recorder: readyRecorder };
}

export function checkpointConquestBattle(profile: ConquestProfile, session: ScenarioSession, recorder: ScenarioRecorder): ConquestProfile {
  if (!profile.active || profile.active.checkpoint.definition.id !== session.definition.id) throw new Error('This battlefield does not belong to the conquest profile.');
  return { ...copy(profile), active: { ...profile.active, checkpoint: captureScenario(session), recording: recorder.archive() } };
}

export function completeConquestBattle(profile: ConquestProfile, session: ScenarioSession, input: ScenarioRecording): ConquestProfile {
  const prior = profile.history.find(a => a.type === 'battle' && a.recording.initial.definition.id === session.definition.id && JSON.stringify(a.recording) === JSON.stringify(input));
  if (prior) return profile;
  if (!profile.active || profile.active.checkpoint.definition.id !== session.definition.id) throw new Error('Only the active battlefield can update conquest.');
  const recording = decodeScenarioRecording(input), canonical = prepareConquestBattle({ ...profile, active: null }, profile.active.regionId, profile.active.mode); canonical.recorder.destroy();
  if (!scenarioStateEquals(canonical.session, restoreScenario(recording.initial))) throw new Error('The conquest battle starts from an altered army or agreement.');
  const verified = verifyScenarioRecording(recording);
  if (verified.runtime.outcome === 'playing' || !scenarioStateEquals(verified, session)) throw new Error('The conquest battle result could not be verified.');
  const next = copy(profile), { regionId, mode, deployedIds } = profile.active;
  const won = verified.runtime.outcome === 'won';
  const reserves = profile.army.filter(s => !deployedIds.includes(s.entity.id));
  if (won) next.army = [...reserves, ...friendlyArmy(verified)].sort((a, b) => a.entity.id - b.entity.id);
  const oldOwner = next.regions[regionId].owner;
  if (mode === 'attack') {
    next.relations[oldOwner].warPressure = Math.min(10, next.relations[oldOwner].warPressure + 1); next.relations[oldOwner].score = Math.max(-100, next.relations[oldOwner].score - 15);
    if (won) next.regions[regionId] = { owner: profile.faction, garrison: Math.max(1, next.army.filter(s => s.entity.role !== 'worker').length) };
  }
  if (won) next.treasury = total({ wood: verified.state.players[0].wood, ore: verified.state.players[0].ore, crystal: verified.state.players[0].crystal }, conquestSupply(next));
  for (const [faction, relation] of Object.entries(next.relations)) if (relation.alliance && verified.runtime.labels[`aid-${faction}`]) relation.treasury.ore -= 40;
  next.active = null; next.turn++; next.history.push({ type: 'battle', regionId, mode, recording }); return next;
}

/** Rebuild the overworld from its accepted decisions and real battlefield journals. */
export function decodeConquestProfile(input: unknown): ConquestProfile {
  let raw = input; if (typeof raw === 'string') { if (raw.length > 30 * 1024 * 1024) throw new Error('Conquest profile is too large.'); raw = JSON.parse(raw); }
  const saved = scenarioJson(raw, { maxBytes: 30 * 1024 * 1024, maxNodes: 1500000, maxArrayLength: 100000 }) as ConquestProfile;
  const exact = (value: unknown, fields: string[]) => !!value && typeof value === 'object' && !Array.isArray(value) && fields.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => fields.includes(k));
  if (!exact(saved, ['format', 'version', 'id', 'worldId', 'faction', 'turn', 'treasury', 'regions', 'relations', 'army', 'history', 'active']) || saved.format !== 'orcs-vs-fairies-conquest' || saved.version !== 1 || !Array.isArray(saved.history) || saved.history.length > 256) throw new Error('Invalid conquest profile.');
  let canonical = createConquestProfile(saved.faction, saved.id);
  if (saved.worldId !== canonical.worldId) throw new Error('Unknown conquest world.');
  for (const action of saved.history) {
    const fields = action.type === 'tribute' ? ['type', 'faction', 'amount'] : action.type === 'truce' ? ['type', 'faction', 'turns'] : action.type === 'alliance' ? ['type', 'faction'] : action.type === 'wait' ? ['type'] : action.type === 'battle' ? ['type', 'regionId', 'mode', 'recording'] : [];
    if (!fields.length || !exact(action, fields)) throw new Error('Invalid conquest decision.');
    if (action.type === 'battle') {
      const prepared = prepareConquestBattle(canonical, action.regionId, action.mode); prepared.recorder.destroy();
      const verified = verifyScenarioRecording(action.recording); canonical = completeConquestBattle(prepared.profile, verified, action.recording);
    } else if (action.type === 'wait') canonical = waitConquestTurn(canonical);
    else canonical = proposeConquest(canonical, action);
  }
  if (saved.active) {
    if (!exact(saved.active, ['regionId', 'mode', 'deployedIds', 'checkpoint', 'recording'])) throw new Error('Invalid active conquest battle.');
    const prepared = prepareConquestBattle(canonical, saved.active.regionId, saved.active.mode); prepared.recorder.destroy();
    if (!scenarioStateEquals(prepared.session, restoreScenario(saved.active.recording.initial)) || JSON.stringify(prepared.profile.active!.deployedIds) !== JSON.stringify(saved.active.deployedIds)) throw new Error('The saved conquest detachment was altered.');
    const replayed = verifyScenarioRecording(saved.active.recording);
    if (!scenarioStateEquals(replayed, restoreScenario(saved.active.checkpoint))) throw new Error('The conquest checkpoint does not match its replay.');
    canonical.active = copy(saved.active);
  }
  if (JSON.stringify({ ...saved, active: null }) !== JSON.stringify({ ...canonical, active: null })) throw new Error('Conquest ownership, supply, army or relations disagree with its decisions.');
  return canonical;
}
