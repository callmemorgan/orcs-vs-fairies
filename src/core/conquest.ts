import { FACTIONS } from './content';
import { deployScenarioArmy, survivingScenarioArmy, type CampaignSoldier } from './campaign';
import { captureScenario, createScenario, restoreScenario } from './scenarios';
import { decodeScenarioRecording, ScenarioRecorder, scenarioCheckpointChecksum, scenarioRecordingRulesCompatibility, scenarioStateEquals, verifyScenarioRecording } from './scenario-recordings';
import { SIMULATION_REVISION } from './versions';
import { scenarioJson } from './scenario-validation';
import { conquestWorldFor } from '../scenarios/conquest-world';
import type { ConquestAction, ConquestBattle, ConquestMission, ConquestProfile } from './conquest-types';
import type { ScenarioActor, ScenarioDefinition, ScenarioSession } from './scenario-types';
import type { ScenarioRecording } from './scenario-recordings';
import type { Cost, FactionId, TerrainKind } from './types';

const copy = <T>(value: T): T => structuredClone(value);
const CONQUEST_PROFILE_LIMITS = { maxBytes: 30 * 1024 * 1024, maxNodes: 1500000, maxArrayLength: 100000 };
function boundedProfile(profile: ConquestProfile): ConquestProfile { scenarioJson(profile, CONQUEST_PROFILE_LIMITS); return profile; }
const resources = ['wood', 'ore', 'crystal'] as const;
const empty = (): Cost => ({ wood: 0, ore: 0, crystal: 0 });
const total = (a: Cost, b: Cost): Cost => ({ wood: Math.min(1000000, a.wood + b.wood), ore: Math.min(1000000, a.ore + b.ore), crystal: Math.min(1000000, a.crystal + b.crystal) });
const world = (profile: ConquestProfile) => conquestWorldFor(profile.faction);
const region = (profile: ConquestProfile, id: string) => { const found = world(profile).regions.find(r => r.id === id); if (!found) throw new Error('Unknown conquest region.'); return found; };
const protectedFaction = (profile: ConquestProfile, faction: FactionId) => faction === profile.faction || profile.relations[faction].alliance || profile.relations[faction].truceUntil > profile.turn;
function requireDecisionRoom(profile: ConquestProfile): void { if (profile.history.length >= 256) throw new Error('The conquest decision history is full. Start another realm.'); }
function conquestAid(profile: ConquestProfile): string[] {
  const cost = FACTIONS[profile.faction].units.ranged.cost;
  return Object.entries(profile.relations).filter(([, relation]) => relation.alliance && resources.every(key => relation.treasury[key] >= cost[key])).slice(0, 2).map(([faction]) => faction);
}

export function conquestRulesCompatibility(profile: ConquestProfile): { compatible: boolean; reason: string | null; revision: string } {
  const revision = profile.simulationRevision ?? 'unknown';
  let reason = profile.simulationRevision === undefined ? 'This conquest has no pinned simulation rules. It is available for inspection.'
    : revision !== SIMULATION_REVISION ? `This conquest uses simulation rules ${revision}; this build uses ${SIMULATION_REVISION}. It is available for inspection.` : null;
  if (reason === null) for (const recording of [...profile.history.flatMap(action => action.type === 'battle' ? [action.recording] : []), ...(profile.active ? [profile.active.recording] : [])]) {
    const journal = scenarioRecordingRulesCompatibility(recording);
    if (!journal.compatible) { reason = journal.reason; break; }
  }
  return { compatible: reason === null, reason, revision };
}
function requireConquestRules(profile: ConquestProfile): void {
  const result = conquestRulesCompatibility(profile); if (!result.compatible) throw new Error(result.reason!);
}

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
  return survivingScenarioArmy(session);
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
  const allies = conquestAid(profile);
  for (const [index, ally] of allies.entries()) army.push({ label: `aid-${ally}`, side: 0, kind: 'unit', role: 'ranged', x: 11, y: 14 + index * 2 });
  const required = mode === 'passage' || site.objective === 'crossing' ? { type: 'at' as const, actor: 'commander', point: { x: 29, y: 16 }, radius: 1 } : { type: 'cleared' as const, side: 1 as const, buildings: true };
  const events: ScenarioDefinition['events'] = [];
  if (mode === 'passage') {
    events.push({ id: 'treaty-protection', when: { type: 'time', seconds: 0 }, actions: [{ type: 'alliance', allied: true }, { type: 'set', key: 'diplomacy.protected', value: 1 }, { type: 'message', text: profile.relations[owner].alliance ? 'The alliance grants passage. The garrison will hold its fire.' : `The truce grants passage for ${(profile.relations[owner].truceUntil - profile.turn) * 15} seconds.` }] });
    if (!profile.relations[owner].alliance) events.push({ id: 'truce-expiry', when: { type: 'time', seconds: (profile.relations[owner].truceUntil - profile.turn) * 15 }, actions: [{ type: 'alliance', allied: false }, { type: 'set', key: 'diplomacy.protected', value: 0 }, { type: 'message', text: 'The truce has expired. The garrison is hostile again.' }] });
  }
  if (site.objective === 'hold' && mode === 'attack') events.push({ id: 'counterattack', when: { type: 'time', seconds: 15 }, actions: [{ type: 'order', actors: army.filter(a => a.side === 1).map(a => a.label), order: { type: 'attackMove', x: 8, y: 16 } }] });
  return {
    schemaVersion: 1, id: `conquest-${profile.faction}-${regionId}-${mode}`, title: `${mode === 'attack' ? 'Capture' : 'Pass through'} ${site.name}`,
    briefing: `${site.briefing} ${mode === 'attack' ? `Defeat its ${profile.regions[regionId].garrison} defenders with the persistent detachment.` : 'Move the commander to the eastern exit while the treaty protects the detachment.'}`,
    successText: mode === 'attack' ? `${site.name} joins your realm.` : 'The detachment completed its passage.', failureText: 'The detachment could not complete its mission.', faction: profile.faction, opponent: owner,
    seed: 73100 + world(profile).regions.findIndex(r => r.id === regionId), map: { size: 'small', width, height, terrain, starts: [{ x: 5, y: 26 }, { x: 28, y: 26 }], resources: [{ x: 10, y: 22, kind: 'wood', amount: site.supply.wood * 4 + 100, maxAmount: site.supply.wood * 4 + 100 }, { x: 13, y: 22, kind: 'ore', amount: site.supply.ore * 4 + 80, maxAmount: site.supply.ore * 4 + 80 }] }, army,
    objectives: [{ id: 'region', text: mode === 'passage' ? 'Reach the eastern exit under treaty protection.' : site.objective === 'crossing' ? 'Clear the crossing and reach the far bank.' : site.objective === 'hold' ? 'Survive the counterattack and eliminate its garrison.' : 'Eliminate the defending garrison.', success: mode === 'passage' ? { type: 'all', conditions: [required, { type: 'variable', key: 'diplomacy.protected', op: 'eq', value: 1 }] } : site.objective === 'crossing' ? { type: 'all', conditions: [required, { type: 'cleared', side: 1 }] } : site.objective === 'hold' ? { type: 'all', conditions: [required, { type: 'time', seconds: 25 }] } : required, failure: { type: 'dead', actor: 'commander' } }], events,
    rules: { fixedArmy: false, reinforcementBudget: Math.min(6, 2 + Math.floor(conquestSupply(profile).ore / 30)), resources: copy(profile.treasury), timeLimit: 180 },
  };
}

export function createConquestProfile(faction: FactionId, id: string): ConquestProfile {
  if (!Object.hasOwn(FACTIONS, faction) || typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(id)) throw new Error('Invalid conquest faction or profile ID.');
  const definition = conquestWorldFor(faction);
  const profile: ConquestProfile = { format: 'orcs-vs-fairies-conquest', version: 1, simulationRevision: SIMULATION_REVISION, id, worldId: definition.id, faction, turn: 0, treasury: { wood: 500, ore: 350, crystal: 100 }, regions: Object.fromEntries(definition.regions.map(r => [r.id, { owner: r.owner, garrison: r.garrison }])), relations: Object.fromEntries(Object.keys(FACTIONS).map(other => [other, { score: 0, warPressure: 0, alliance: false, truceUntil: 0, treasury: { wood: 150, ore: 100, crystal: 20 } }])), army: [], history: [], active: null };
  profile.army = friendlyArmy(createScenario(battleDefinition(profile, 'grove', 'attack'))); return boundedProfile(profile);
}

export function proposeConquest(profile: ConquestProfile, action: Exclude<ConquestAction, { type: 'battle' | 'wait' }>): ConquestProfile {
  requireConquestRules(profile);
  if (profile.active) throw new Error('Finish the active battlefield before negotiating.');
  requireDecisionRoom(profile);
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
  next.history.push(copy(action)); return boundedProfile(next);
}

export function waitConquestTurn(profile: ConquestProfile): ConquestProfile {
  requireConquestRules(profile);
  if (profile.active || profile.turn >= 1000) throw new Error('A conquest turn cannot advance now.');
  requireDecisionRoom(profile);
  return boundedProfile({ ...copy(profile), turn: profile.turn + 1, treasury: total(profile.treasury, conquestSupply(profile)), history: [...profile.history, { type: 'wait' }] });
}

export function prepareConquestBattle(profile: ConquestProfile, regionId: string, mode: 'attack' | 'passage' = 'attack'): ConquestMission {
  requireConquestRules(profile);
  if (profile.active) { if (profile.active.regionId !== regionId || profile.active.mode !== mode) throw new Error('A different conquest battle is active.'); const session = restoreScenario(profile.active.checkpoint); return { profile, session, recorder: new ScenarioRecorder(session, profile.active.recording) }; }
  requireDecisionRoom(profile);
  if (!reachableConquestRegions(profile).includes(regionId)) throw new Error('This region is unreachable from owned or treaty-protected territory.');
  const owner = profile.regions[regionId].owner;
  if (owner === profile.faction) throw new Error('This region already belongs to your realm.');
  if (mode !== 'attack' && mode !== 'passage' || mode === 'attack' && protectedFaction(profile, owner) || mode === 'passage' && !protectedFaction(profile, owner)) throw new Error('The current agreement does not permit this battlefield action.');
  const largest = Math.max(0, ...profile.army.map(s => s.entity.id), ...profile.history.flatMap(a => a.type === 'battle' ? [a.recording.initial.game.state.nextId + 4096] : []));
  const session = createScenario(battleDefinition(profile, regionId, mode), { firstEntityId: largest + 1 }), deployedIds = deployScenarioArmy(session, profile.army, { omitLabels: conquestAid(profile).map(faction => `aid-${faction}`) }), recorder = new ScenarioRecorder(session);
  const replacements = session.definition.army.filter(a => a.side === 0 && a.kind === 'unit' && !a.label.startsWith('aid-')).map(a => session.runtime.labels[a.label]).filter(id => !deployedIds.includes(id));
  session.state.entities = session.state.entities.filter(e => !replacements.includes(e.id));
  // Campaign casualties cannot be replaced by authored starting placeholders.
  session.state.players[0].population = session.state.entities.filter(e => e.side === 0 && e.kind === 'unit').length;
  recorder.destroy(); const readyRecorder = new ScenarioRecorder(session);
  const active: ConquestBattle = { regionId, mode, deployedIds, checkpoint: captureScenario(session), recording: readyRecorder.archive() };
  try { return { profile: boundedProfile({ ...copy(profile), active }), session, recorder: readyRecorder }; }
  catch (error) { readyRecorder.destroy(); throw error; }
}

export function checkpointConquestBattle(profile: ConquestProfile, session: ScenarioSession, recorder: ScenarioRecorder): ConquestProfile {
  requireConquestRules(profile);
  if (!profile.active || profile.active.checkpoint.definition.id !== session.definition.id) throw new Error('This battlefield does not belong to the conquest profile.');
  return boundedProfile({ ...copy(profile), active: { ...profile.active, checkpoint: captureScenario(session), recording: recorder.archive() } });
}

export function completeConquestBattle(profile: ConquestProfile, session: ScenarioSession, input: ScenarioRecording): ConquestProfile {
  requireConquestRules(profile);
  const recording = decodeScenarioRecording(input), compatibility = scenarioRecordingRulesCompatibility(recording);
  if (!compatibility.compatible) throw new Error(compatibility.reason!);
  const prior = profile.history.find(a => a.type === 'battle' && a.recording.initial.definition.id === session.definition.id && JSON.stringify(a.recording) === JSON.stringify(input));
  if (prior) return profile;
  if (!profile.active || profile.active.checkpoint.definition.id !== session.definition.id) throw new Error('Only the active battlefield can update conquest.');
  const canonical = prepareConquestBattle({ ...profile, active: null }, profile.active.regionId, profile.active.mode); canonical.recorder.destroy();
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
  for (const [faction, relation] of Object.entries(next.relations)) if (relation.alliance && verified.runtime.labels[`aid-${faction}`]) for (const key of resources) relation.treasury[key] -= FACTIONS[profile.faction].units.ranged.cost[key];
  next.active = null; next.turn++; next.history.push({ type: 'battle', regionId, mode, recording }); return boundedProfile(next);
}

/** Historical realms retain their recorded ownership; current realms must match their decisions. */
export function decodeConquestProfile(input: unknown): ConquestProfile {
  let raw = input; if (typeof raw === 'string') { if (raw.length > 30 * 1024 * 1024) throw new Error('Conquest profile is too large.'); raw = JSON.parse(raw); }
  const saved = scenarioJson(raw, CONQUEST_PROFILE_LIMITS) as ConquestProfile;
  const exact = (value: unknown, fields: string[], optional: string[] = []) => !!value && typeof value === 'object' && !Array.isArray(value) && fields.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => fields.includes(k) || optional.includes(k));
  const finite = (value: unknown, min: number, max: number, integer = false): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isSafeInteger(value));
  const point = (value: { x: number; y: number; level?: number }) => exact(value, ['x', 'y'], ['level']) && finite(value.x, 0, 4096) && finite(value.y, 0, 4096) && (value.level === undefined || finite(value.level, 0, 63, true));
  const order = (value: CampaignSoldier['entity']['order']) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.type === 'idle' || value.type === 'hold') return exact(value, ['type']);
    if (value.type === 'move' || value.type === 'attackMove') return exact(value, ['type', 'x', 'y'], ['level']) && point({ x: value.x, y: value.y, ...(value.level === undefined ? {} : { level: value.level }) });
    if (value.type === 'traverse') return exact(value, ['type', 'transition']) && finite(value.transition, 1, 0x7fffffff, true);
    return ['attack', 'gather', 'build', 'worldAttack', 'repairBridge', 'captureSite', 'supportVillage', 'recruitVillage'].includes(value.type) && exact(value, ['type', 'target']) && finite('target' in value ? value.target : undefined, 1, 0x7fffffff, true);
  };
  const faction = (value: unknown) => typeof value === 'string' && Object.hasOwn(FACTIONS, value);
  const cost = (value: Cost) => exact(value, [...resources]) && resources.every(key => finite(value[key], 0, 1000000));
  if (!exact(saved, ['format', 'version', 'id', 'worldId', 'faction', 'turn', 'treasury', 'regions', 'relations', 'army', 'history', 'active'], ['simulationRevision']) || saved.format !== 'orcs-vs-fairies-conquest' || saved.version !== 1 || !Array.isArray(saved.history) || saved.history.length > 256 || saved.simulationRevision !== undefined && (typeof saved.simulationRevision !== 'string' || saved.simulationRevision.length > 80 || !/^\d+\.\d+\.\d+$/.test(saved.simulationRevision))) throw new Error('Invalid conquest profile.');
  if (!faction(saved.faction) || typeof saved.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(saved.id)) throw new Error('Invalid conquest faction or profile ID.');
  const definition = conquestWorldFor(saved.faction), regionIds = definition.regions.map(region => region.id);
  if (saved.worldId !== definition.id) throw new Error('Unknown conquest world.');
  if (!finite(saved.turn, 0, 1000, true) || !cost(saved.treasury) || !exact(saved.regions, regionIds) || !exact(saved.relations, Object.keys(FACTIONS))) throw new Error('Invalid conquest ownership, treasury or relations.');
  for (const value of Object.values(saved.regions)) if (!exact(value, ['owner', 'garrison']) || !faction(value.owner) || !finite(value.garrison, 1, CONQUEST_PROFILE_LIMITS.maxArrayLength, true)) throw new Error('Invalid conquest region.');
  for (const value of Object.values(saved.relations)) if (!exact(value, ['score', 'warPressure', 'alliance', 'truceUntil', 'treasury']) || !finite(value.score, -100, 100, true) || !finite(value.warPressure, 0, 10, true) || typeof value.alliance !== 'boolean' || !finite(value.truceUntil, 0, 1008, true) || !cost(value.treasury)) throw new Error('Invalid conquest relation.');
  if (!Array.isArray(saved.army)) throw new Error('Invalid conquest army.');
  const armyIds = new Set<number>();
  for (const soldier of saved.army) {
    const entity = soldier?.entity;
    if (!exact(soldier, ['entity', 'label'], ['artifacts']) || !entity || typeof entity !== 'object' || Array.isArray(entity) || !finite(entity.id, 1, 0x7fffffff, true) || armyIds.has(entity.id) || entity.side !== 0 || entity.kind !== 'unit' || !['worker', 'melee', 'ranged', 'special', 'cavalry', 'spear', 'siege'].includes(entity.role) || !finite(entity.maxHp, Number.MIN_VALUE, 1e9) || !finite(entity.hp, Number.MIN_VALUE, entity.maxHp) || entity.illusion !== false || entity.raised !== undefined && entity.raised !== false || soldier.label !== null && (typeof soldier.label !== 'string' || soldier.label.length > 96 || !/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(soldier.label))) throw new Error('Invalid conquest soldier.');
    for (const key of ['x', 'y', 'cooldown', 'animTime', 'expires'] as const) if (!finite(entity[key], 0, 1e9)) throw new Error('Invalid conquest soldier state.');
    for (const key of ['progress', 'trainProgress', 'momentum'] as const) if (!finite(entity[key], 0, 1)) throw new Error('Invalid conquest soldier state.');
    for (const key of ['abilityReadyAt', 'entrenchedAt', 'lastDamagedAt', 'surgeUntil', 'shield', 'maxShield'] as const) if (entity[key] !== undefined && !finite(entity[key], 0, 1e9)) throw new Error('Invalid conquest soldier state.');
    for (const key of ['definitionId', 'definitionFaction'] as const) if (entity[key] !== undefined && (typeof entity[key] !== 'string' || entity[key]!.length < 1 || entity[key]!.length > 100)) throw new Error('Invalid conquest soldier definition.');
    if (entity.lastAttacker !== undefined && !finite(entity.lastAttacker, 1, 0x7fffffff, true) || entity.gateOpen !== undefined && typeof entity.gateOpen !== 'boolean' || entity.shield !== undefined && entity.shield > (entity.maxShield ?? 0)) throw new Error('Invalid conquest soldier state.');
    if (!finite(entity.researchProgress, 0, 2) || !finite(entity.facing, 0, 7, true) || !finite(entity.carried, 0, 18) || !resources.includes(entity.carriedKind) || !['idle', 'walk', 'attack', 'death'].includes(entity.animation) || !order(entity.order) || !Array.isArray(entity.queue) || entity.queue.length !== 0 || !Array.isArray(entity.path) || entity.path.some(value => !point(value)) || entity.orderQueue !== undefined && (!Array.isArray(entity.orderQueue) || entity.orderQueue.some(value => !order(value))) || entity.level !== undefined && !finite(entity.level, 0, 63, true)) throw new Error('Invalid conquest soldier state.');
    const artifacts = soldier.artifacts ?? [], artifactIds = new Set<number>();
    if (!Array.isArray(artifacts)) throw new Error('Invalid conquest soldier artifacts.');
    for (const item of artifacts) {
      if (!exact(item, ['id', 'definitionId', 'owner', 'holder']) || !finite(item.id, 1, 0x7fffffff, true) || artifactIds.has(item.id) || !['core:ember-blade', 'core:iron-aegis', 'core:wind-charm'].includes(item.definitionId) || item.owner !== 0 || item.holder !== entity.id) throw new Error('Invalid conquest soldier artifact.');
      artifactIds.add(item.id);
    }
    if (entity.equipment !== undefined && (!exact(entity.equipment, [], ['weapon', 'armor', 'trinket']) || Object.values(entity.equipment).some(id => !artifactIds.has(id)))) throw new Error('Invalid conquest soldier equipment.');
    armyIds.add(entity.id);
  }
  const validateRecording = (recording: ScenarioRecording, regionId: string, mode: 'attack' | 'passage') => {
    if (!regionIds.includes(regionId) || !['attack', 'passage'].includes(mode)) throw new Error('Invalid conquest battle reference.');
    const decoded = decodeScenarioRecording(recording), expected = `conquest-${saved.faction}-${regionId}-${mode}`;
    if (decoded.initial.definition.id !== expected || decoded.initial.runtime.definitionId !== expected || decoded.initial.definition.faction !== saved.faction) throw new Error('Invalid conquest battle identity.');
    return decoded;
  };
  let turns = 0;
  for (const action of saved.history) {
    const fields = action?.type === 'tribute' ? ['type', 'faction', 'amount'] : action?.type === 'truce' ? ['type', 'faction', 'turns'] : action?.type === 'alliance' ? ['type', 'faction'] : action?.type === 'wait' ? ['type'] : action?.type === 'battle' ? ['type', 'regionId', 'mode', 'recording'] : [];
    if (!fields.length || !exact(action, fields)) throw new Error('Invalid conquest decision.');
    if (action.type === 'battle') { validateRecording(action.recording, action.regionId, action.mode); turns++; }
    else if (action.type === 'wait') turns++;
    else if (!faction(action.faction) || action.faction === saved.faction || action.type === 'tribute' && !finite(action.amount, 25, 300, true) || action.type === 'truce' && !finite(action.turns, 1, 8, true)) throw new Error('Invalid conquest diplomatic decision.');
  }
  if (saved.turn !== turns) throw new Error('Conquest turn disagrees with its recorded decisions.');
  if (saved.active !== null) {
    if (!exact(saved.active, ['regionId', 'mode', 'deployedIds', 'checkpoint', 'recording']) || !Array.isArray(saved.active.deployedIds) || saved.active.deployedIds.length > 4096 || saved.active.deployedIds.some(id => !finite(id, 1, 0x7fffffff, true)) || new Set(saved.active.deployedIds).size !== saved.active.deployedIds.length) throw new Error('Invalid active conquest battle.');
    const recording = validateRecording(saved.active.recording, saved.active.regionId, saved.active.mode), checkpoint = restoreScenario(saved.active.checkpoint);
    if (checkpoint.definition.id !== recording.initial.definition.id || JSON.stringify(saved.active.checkpoint.definition) !== JSON.stringify(recording.initial.definition) || recording.finalTick !== saved.active.checkpoint.game.state.tick || recording.finalChecksum !== scenarioCheckpointChecksum(saved.active.checkpoint)) throw new Error('The conquest checkpoint disagrees with its recording.');
    if (saved.active.deployedIds.some(id => !armyIds.has(id) || !recording.initial.game.state.entities.some(entity => entity.id === id && entity.side === 0 && entity.kind === 'unit'))) throw new Error('Invalid conquest deployed army.');
  }
  if (!conquestRulesCompatibility(saved).compatible) return saved;

  let canonical = createConquestProfile(saved.faction, saved.id);
  for (const action of saved.history) {
    if (action.type === 'battle') {
      const prepared = prepareConquestBattle(canonical, action.regionId, action.mode); prepared.recorder.destroy();
      const verified = verifyScenarioRecording(action.recording); canonical = completeConquestBattle(prepared.profile, verified, action.recording);
    } else if (action.type === 'wait') canonical = waitConquestTurn(canonical);
    else canonical = proposeConquest(canonical, action);
  }
  if (saved.active !== null) {
    const prepared = prepareConquestBattle(canonical, saved.active.regionId, saved.active.mode); prepared.recorder.destroy();
    if (!scenarioStateEquals(prepared.session, restoreScenario(saved.active.recording.initial)) || JSON.stringify(prepared.profile.active!.deployedIds) !== JSON.stringify(saved.active.deployedIds)) throw new Error('The saved conquest detachment was altered.');
    const replayed = verifyScenarioRecording(saved.active.recording);
    if (!scenarioStateEquals(replayed, restoreScenario(saved.active.checkpoint))) throw new Error('The conquest checkpoint does not match its replay.');
    canonical.active = copy(saved.active);
  }
  if (JSON.stringify({ ...saved, active: null }) !== JSON.stringify({ ...canonical, active: null })) throw new Error('Conquest ownership, supply, army or relations disagree with its decisions.');
  return canonical;
}
