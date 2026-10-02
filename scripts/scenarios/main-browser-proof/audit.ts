import assert from 'node:assert/strict';
import { decodeSessionFile } from '../../../src/core/session-storage';
import { SAVE_VERSION, saveGame } from '../../../src/core/saves';
import { ReplayPlayer } from '../../../src/core/replays';
import { restoreScenario, scenarioRulesCompatibility, scenarioSessionForState } from '../../../src/core/scenarios';
import type { ScenarioDefinition } from '../../../src/core/scenario-types';
import { verifyScenarioRecording } from '../../../src/core/scenario-recordings';
import { decodeCampaignProfile, verifyCanonicalCampaignVictory } from '../../../src/core/campaign';
import { decodeConquestProfile } from '../../../src/core/conquest';
import { decodeScenarioPackage } from '../../../src/editor/scenario-package';
import { decodeMapPackage } from '../../../src/editor/map-package';
import { SIMULATION_REVISION } from '../../../src/core/versions';

export const fixtureNames = ['currentCampaignSession', 'authoredScenarioPackage', 'editorMapPackage', 'historicalGenericSession', 'historicalCampaignProfile', 'historicalRealmProfile', 'finaleCampaignProfile'] as const;
export const exportNames = ['ordinaryBefore', 'ordinaryReloaded', 'editorMapPackage', 'editorMapImported', 'editorMapBefore', 'editorMapReloaded', 'authoredPackage', 'authoredImported', 'authoredBefore', 'authoredReloaded', 'authoredAbility', 'campaignBefore', 'campaignContinued', 'historicalBefore', 'historicalAfter', 'historicalCampaignExport', 'historicalRealmExport', 'finaleSession', 'finaleCampaignExport', 'buildReport'] as const;
type Documents = Record<string, unknown>;

/** Audit downloaded artifacts; the CUA transcript and screenshots prove their UI origin. */
export function auditMainBrowserExports(fixtures: Documents, exports: Documents, expectedBuild: string) {
  assert.equal(SAVE_VERSION, 4); assert.equal(SIMULATION_REVISION, '4.0.2');
  for (const name of fixtureNames) assert.ok(Object.hasOwn(fixtures, name), `Missing fixture ${name}`);
  for (const name of exportNames) assert.ok(Object.hasOwn(exports, name), `Missing UI export ${name}`);
  const checks: string[] = [];
  function current(name: string, input = exports[name]) {
    const result = decodeSessionFile(input);
    assert.equal(result.file.game.version, SAVE_VERSION, `${name}: SAVE4`);
    assert.ok(result.file.replay, `${name}: ordinary replay history is present`);
    assert.equal(result.file.replay.checksumVersion, SAVE_VERSION);
    assert.equal(result.file.replay.simulationRevision, SIMULATION_REVISION);
    const player = new ReplayPlayer(result.file.replay);
    try { while (!player.finished) player.advance(200); assert.deepEqual(saveGame(player.state), saveGame(result.state), `${name}: generic replay state`); }
    finally { player.dispose(); }
    return result;
  }
  function unchanged(before: string, after: string) {
    const left = current(before), right = current(after);
    assert.deepEqual(right.file.game, left.file.game, `${before}/${after}: paused game equality`);
    assert.deepEqual(right.file.replay, left.file.replay, `${before}/${after}: original ordinary history`);
    return left;
  }
  unchanged('ordinaryBefore', 'ordinaryReloaded'); checks.push('ordinary SAVE4 save/load and generic replay equality');
  const map = decodeMapPackage(exports.editorMapPackage);
  const suppliedMap = decodeMapPackage(fixtures.editorMapPackage);
  assert.deepEqual(suppliedMap, decodeScenarioPackage(fixtures.authoredScenarioPackage).map);
  assert.equal(map.id, suppliedMap.id);
  assert.deepEqual({ ...map.map, levels: [] }, { ...suppliedMap.map, levels: [] });
  assert.deepEqual(map.map.levels.map(level => ({ ...level, terrain: [] })), suppliedMap.map.levels.map(level => ({ ...level, terrain: [] })));
  assert.equal(map.map.levels.reduce((count, level, index) => count + level.terrain.filter((tile, cell) => tile !== suppliedMap.map.levels[index].terrain[cell]).length, 0), 1, 'The editor case changes one supplied terrain cell.');
  assert.deepEqual(decodeMapPackage(exports.editorMapImported), map);
  const edited = unchanged('editorMapBefore', 'editorMapReloaded');
  assert.equal(edited.state.scenario, undefined);
  assert.deepEqual(edited.state.terrain, map.map.levels[0].terrain);
  assert.deepEqual(edited.state.starts, map.map.starts.map(start => ({ x: start.x, y: start.y, level: start.level })));
  assert.deepEqual(edited.state.world!.levels, map.map.levels);
  assert.deepEqual(edited.state.world!.transitions, map.map.transitions);
  const positions = (items: Array<{ x: number; y: number; level?: number; kind: string }>) => items.map(({ x, y, level, kind }) => ({ x, y, level: level ?? 0, kind }));
  assert.deepEqual(positions(edited.state.resources), positions(map.map.resources));
  assert.deepEqual(positions(edited.state.world!.sites), positions(map.map.sites));
  checks.push('edited map package import and ordinary battlefield save/load');

  const authored = decodeScenarioPackage(exports.authoredPackage);
  assert.deepEqual(decodeScenarioPackage(exports.authoredImported), authored);
  const suppliedAuthored = decodeScenarioPackage(fixtures.authoredScenarioPackage);
  assert.equal(authored.scenario.id, suppliedAuthored.scenario.id);
  assert.deepEqual(authored.scenario.army, suppliedAuthored.scenario.army);
  assert.deepEqual(authored.scenario.content, suppliedAuthored.scenario.content);
  assert.deepEqual(authored.map.map, suppliedAuthored.map.map);
  const withoutEditableText = (definition: ScenarioDefinition) => ({ ...definition, title: '', briefing: '', successText: '', failureText: '', events: definition.events.map(event => ({ ...event, actions: event.actions.map(action => action.type === 'finish' ? { ...action, reason: '' } : action) })) });
  assert.deepEqual(withoutEditableText(authored.scenario), withoutEditableText(suppliedAuthored.scenario));
  const mission = unchanged('authoredBefore', 'authoredReloaded');
  assert.deepEqual(mission.state.scenario!.definition, authored.scenario);
  assert.equal(mission.state.scenario!.simulationRevision, SIMULATION_REVISION);
  const ability = current('authoredAbility'), command = ability.file.replay!.actions.filter(action => action.type === 'command').at(-1);
  assert.deepEqual(ability.state.scenario!.definition, mission.state.scenario!.definition);
  assert.deepEqual(ability.file.replay!.initial, mission.file.replay!.initial);
  const previousAbilityCommands = mission.file.replay!.actions.filter(action => action.type === 'command'), abilityCommands = ability.file.replay!.actions.filter(action => action.type === 'command');
  assert.deepEqual(abilityCommands.slice(0, previousAbilityCommands.length), previousAbilityCommands); assert.equal(abilityCommands.length, previousAbilityCommands.length + 1);
  assert.equal(command?.type, 'command');
  if (!command || command.type !== 'command' || command.command.type !== 'ability') throw new Error('The authored mission export lacks the native targeted ability command.');
  assert.equal(typeof command.command.x, 'number'); assert.equal(typeof command.command.y, 'number');
  assert.ok(command.command.ids.some(id => ability.state.entities.find(entity => entity.id === id)?.definitionId === 'core:orcs-commander'));
  const caster = ability.state.entities.find(entity => command.command.type === 'ability' && command.command.ids.includes(entity.id) && entity.definitionId === 'core:orcs-commander')!;
  assert.ok(caster.abilityReadyAt! > ability.state.time, 'Export while Iron Command cooldown is active.');
  assert.ok(ability.state.entities.some(entity => entity.side === 0 && entity.specialistBuffs?.some(buff => buff.damageFactor === 1.25 && buff.until > ability.state.time)), 'Export promptly while the native Iron Command buff is active.');
  assert.equal(ability.state.scenario!.runtime.commandCounts['ability.iron-command'], (mission.state.scenario!.runtime.commandCounts['ability.iron-command'] ?? 0) + 1);
  checks.push('authored scenario binding and one native targeted Iron Command');

  const before = current('campaignBefore'), continued = current('campaignContinued');
  assert.equal(before.file.scenarioProfile?.kind, 'campaign'); assert.equal(continued.file.scenarioProfile?.kind, 'campaign');
  const suppliedCampaign = decodeSessionFile(fixtures.currentCampaignSession);
  assert.equal(suppliedCampaign.file.scenarioProfile?.kind, 'campaign');
  const suppliedJournal = suppliedCampaign.file.scenarioProfile!.profile.active!.recording;
  const prior = before.file.scenarioProfile!.profile.active!, next = continued.file.scenarioProfile!.profile.active!;
  assert.equal(before.file.scenarioProfile!.profile.id, suppliedCampaign.file.scenarioProfile!.profile.id);
  assert.equal((before.file.scenarioProfile!.profile as { campaignId: string }).campaignId, (suppliedCampaign.file.scenarioProfile!.profile as { campaignId: string }).campaignId);
  assert.deepEqual(before.file.scenarioProfile!.profile.history, suppliedCampaign.file.scenarioProfile!.profile.history);
  assert.deepEqual(prior, suppliedCampaign.file.scenarioProfile!.profile.active);
  assert.deepEqual(before.file.game, suppliedCampaign.file.game);
  assert.deepEqual(prior.recording, suppliedJournal);
  assert.deepEqual(before.file.replay!.initial, suppliedCampaign.file.replay?.initial ?? saveGame(suppliedCampaign.state));
  const equipped = before.state.entities.find(entity => entity.side === 0 && Object.keys(entity.equipment ?? {}).length > 0);
  assert.ok(equipped, 'The imported campaign has an equipped soldier.');
  assert.deepEqual(before.state.entities.find(entity => entity.id === equipped.id)!.equipment, suppliedCampaign.state.entities.find(entity => entity.id === equipped.id)!.equipment);
  const artifact = before.state.specialists!.artifacts.find(item => item.id === equipped.equipment!.armor)!;
  assert.deepEqual(artifact, { id: equipped.equipment!.armor, definitionId: 'core:iron-aegis', owner: 0, holder: equipped.id });
  assert.deepEqual(continued.state.specialists!.artifacts.find(item => item.id === artifact.id), artifact);
  assert.deepEqual(continued.state.entities.find(entity => entity.id === equipped.id)!.equipment, equipped.equipment);
  assert.deepEqual(next.recording.initial, prior.recording.initial);
  assert.deepEqual(next.recording.commands.slice(0, prior.recording.commands.length), prior.recording.commands);
  assert.equal(next.recording.commands.length, prior.recording.commands.length + 1);
  const appended = next.recording.commands.at(-1)!;
  assert.equal(appended.command.type, 'hold'); assert.equal(appended.side, 0); assert.ok(appended.tick >= before.state.tick);
  assert.deepEqual(saveGame(verifyScenarioRecording(next.recording).state), saveGame(continued.state));
  assert.deepEqual(continued.file.replay!.initial, before.file.replay!.initial);
  const oldCommands = before.file.replay!.actions.filter(action => action.type === 'command'), newCommands = continued.file.replay!.actions.filter(action => action.type === 'command');
  assert.deepEqual(newCommands.slice(0, oldCommands.length), oldCommands); assert.equal(newCommands.length, oldCommands.length + 1);
  assert.deepEqual(newCommands.at(-1), { type: 'command', side: 0, command: appended.command });
  checks.push('equipped campaign journal and ordinary history keep their initial state and append one accepted input');

  const legacy = decodeSessionFile(fixtures.historicalGenericSession);
  assert.equal(legacy.file.game.version, 3);
  const historicalBefore = decodeSessionFile(exports.historicalBefore), historicalAfter = decodeSessionFile(exports.historicalAfter);
  assert.equal(historicalBefore.file.game.version, 4); assert.equal(historicalAfter.file.game.version, 4);
  assert.equal(historicalBefore.file.replay, undefined); assert.equal(historicalAfter.file.replay, undefined);
  assert.deepEqual(historicalBefore.file.game, saveGame(legacy.state));
  assert.deepEqual(historicalAfter.file.game, historicalBefore.file.game);
  assert.equal(scenarioRulesCompatibility(scenarioSessionForState(historicalAfter.state)!).compatible, false);
  assert.deepEqual(exports.historicalCampaignExport, fixtures.historicalCampaignProfile);
  assert.deepEqual(exports.historicalRealmExport, fixtures.historicalRealmProfile);
  decodeCampaignProfile(exports.historicalCampaignExport); decodeConquestProfile(exports.historicalRealmExport);
  checks.push('historical SAVE3 input remains inspectable and UI exports stay frozen under SAVE4');

  const finale = current('finaleSession'), profile = decodeCampaignProfile(exports.finaleCampaignExport), last = profile.history.at(-1)!;
  const suppliedFinale = decodeCampaignProfile(fixtures.finaleCampaignProfile);
  assert.equal(suppliedFinale.active?.missionId, 'orcs-4'); assert.equal(suppliedFinale.history.length, 3);
  assert.equal(profile.history.length, 4); assert.equal(profile.active, null);
  assert.equal(profile.campaignId, 'campaign-orcs'); assert.equal(profile.id, suppliedFinale.id);
  assert.deepEqual(profile.history.slice(0, 3), suppliedFinale.history);
  assert.equal(finale.file.scenarioProfile?.kind, 'campaign'); assert.deepEqual(finale.file.scenarioProfile!.profile, profile);
  assert.equal(last.missionId, 'orcs-4'); assert.equal(finale.state.players[0].faction, 'orcs');
  assert.deepEqual(last.recording.initial, suppliedFinale.active!.recording.initial);
  assert.deepEqual(last.recording.commands.slice(0, suppliedFinale.active!.recording.commands.length), suppliedFinale.active!.recording.commands);
  assert.ok(last.recording.finalTick >= suppliedFinale.active!.recording.finalTick);
  assert.deepEqual(finale.file.replay!.initial, saveGame(restoreScenario(suppliedFinale.active!.checkpoint).state));
  assert.equal(finale.state.scenario!.runtime.outcome, 'won'); assert.equal(finale.state.scenario!.runtime.reason, 'All required objectives completed.');
  assert.ok(finale.state.scenario!.runtime.commandCounts['ability.momentum'] >= 1, 'The Orc finale used ordinary War Cry.');
  assert.deepEqual(saveGame(verifyScenarioRecording(last.recording).state), saveGame(finale.state));
  assert.deepEqual(verifyCanonicalCampaignVictory(profile, last.missionId), { campaignId: 'campaign-orcs', missionId: 'orcs-4', factionId: 'orcs' });
  checks.push('canonical Orc campaign finale reason, required War Cry and full verified campaign');
  const report = exports.buildReport as { format?: string; version?: number; session?: unknown; versions?: { buildId?: string; save?: number; simulationRevision?: string } };
  assert.equal(report.format, 'orcs-vs-fairies/bug-report'); assert.equal(report.version, 1); current('buildReport.session', report.session);
  assert.equal(report.versions?.buildId, expectedBuild); assert.equal(report.versions?.save, SAVE_VERSION); assert.equal(report.versions?.simulationRevision, SIMULATION_REVISION);
  checks.push('UI bug report identifies the pinned production source fingerprint');
  return { checks, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION, browserEvidenceRequired: 'CUA transcript and screenshots must separately show modal pauses, targeting, result text, reward/equip controls, appearance and photo output.' };
}
