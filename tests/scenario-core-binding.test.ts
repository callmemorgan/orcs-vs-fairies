import { describe, expect, it, vi } from 'vitest';
import { createScenario, issueScenarioCommand, subscribeScenarioCommands } from '../src/core/scenarios';
import { ScenarioRecorder, verifyScenarioRecording } from '../src/core/scenario-recordings';
import { MatchRecorder, ReplayPlayer } from '../src/core/replays';
import { loadGame, saveGame } from '../src/core/saves';
import { createMatch, issueCommand, refreshVisibility, spawnDefinition, stepGame } from '../src/core/simulation';
import { createArtifact } from '../src/core/unit-progression';
import { subscribeSimulation } from '../src/core/history-hooks';
import type { ScenarioDefinition } from '../src/core/scenario-types';

function mission(extra: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    schemaVersion: 1, id: 'core-binding', title: 'Core binding', briefing: 'Hold the supplied position.',
    successText: 'Position held.', failureText: 'Position lost.', faction: 'fairies', opponent: 'orcs', seed: 22,
    map: { size: 'small', width: 36, height: 36, terrain: Array(36 * 36).fill('grass'), starts: [{ x: 4, y: 4 }, { x: 31, y: 31 }], resources: [] },
    army: [
      { label: 'caster', side: 0, kind: 'unit', role: 'special', x: 8, y: 8, order: { type: 'hold' } },
      { label: 'enemy', side: 1, kind: 'unit', role: 'melee', x: 28, y: 28, order: { type: 'hold' } },
    ],
    objectives: [{ id: 'hold', text: 'Hold until the signal.', success: { type: 'time', seconds: 35 } }],
    events: [{ id: 'cast', when: { type: 'time', seconds: .1 }, actions: [{ type: 'order', actors: ['caster'], order: { type: 'ability' } }] }],
    rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 5000, ore: 5000, crystal: 1000 }, timeLimit: 120 },
    ...extra,
  };
}

describe('scenarios through the canonical simulation and replay', () => {
  it('rejects unbound scenario creation and opposing commands before mutation', () => {
    expect(() => createMatch({ map: { seed: 22 }, players: [{ id: 0, teamId: 0, factionId: 'fairies', controller: 'human' }], rules: { mode: 'scenario' } })).toThrow('bound scenario');
    const session = createScenario(mission()), before = saveGame(session.state);
    expect(issueCommand(session.state, 1, { type: 'move', ids: [session.runtime.labels.enemy], x: 20, y: 20 })).toBe(false);
    expect(saveGame(session.state)).toEqual(before);
  });

  it('accounts for wrapper and direct commands once and excludes scripted commands from generic history', () => {
    const session = createScenario(mission()), recorder = new MatchRecorder(session.state);
    expect(issueScenarioCommand(session, 0, { type: 'hold', ids: [session.runtime.labels.caster] })).toBe(true);
    expect(session.runtime.commandCounts.hold).toBe(1);
    let notifiedClones = 0;
    const unsubscribe = subscribeSimulation(session.state, { step: () => { notifiedClones = session.state.entities.filter(e => e.illusion).length; } });
    stepGame(session.state, .05); stepGame(session.state, .05);
    expect(notifiedClones).toBe(2);
    const archive = recorder.export(); recorder.dispose(); unsubscribe();
    expect(archive.actions.filter(action => action.type === 'command')).toEqual([{ type: 'command', side: 0, command: { type: 'hold', ids: [session.runtime.labels.caster] } }]);
    const replay = new ReplayPlayer(archive); while (!replay.finished) replay.advance(20);
    expect(saveGame(replay.state)).toEqual(saveGame(session.state)); replay.dispose();
  });

  it('keeps generic save continuation and tick-600 replay seeking equal through a terminal mission', () => {
    const session = createScenario(mission()), recorder = new MatchRecorder(session.state);
    for (let tick = 0; tick < 600; tick++) stepGame(session.state, .05);
    const resumed = loadGame(saveGame(session.state));
    while (session.state.winner === null) { stepGame(session.state, .05); stepGame(resumed, .05); expect(saveGame(resumed)).toEqual(saveGame(session.state)); }
    expect(session.runtime.outcome).toBe('won'); expect(session.state.winner).toBe(0);
    const final = saveGame(session.state), events = session.state.events;
    stepGame(session.state, .05); stepGame(session.state, Number.NaN);
    expect(session.state.events).toBe(events); expect(saveGame(session.state)).toEqual(final);
    const archive = recorder.export(); recorder.dispose();
    const player = new ReplayPlayer(archive); while (!player.finished) player.advance(100);
    expect(saveGame(player.state)).toEqual(final);
    const seek = player.forkForSeek(600); while (!seek.finished) seek.advance(100);
    expect(saveGame(seek.state)).toEqual(final); seek.dispose(); player.dispose();
  });

  it('records accepted input in both histories when a scenario observer throws', () => {
    const session = createScenario(mission()), recorder = new MatchRecorder(session.state);
    const failure = new Error('observer failed'), report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = subscribeScenarioCommands(session, () => { throw failure; });
    const journal = new ScenarioRecorder(session), command = { type: 'move' as const, ids: [session.runtime.labels.caster], x: 10, y: 10 };
    try {
      expect(issueCommand(session.state, 0, command)).toBe(true);
      expect(session.runtime.commandCounts.move).toBe(1);
      expect(report).toHaveBeenCalledWith('Scenario command observer failed', failure);
      stepGame(session.state, .05); stepGame(session.state, .05);
      const archive = recorder.export(), recording = journal.archive();
      expect(archive.actions.filter(action => action.type === 'command')).toEqual([{ type: 'command', side: 0, command }]);
      expect(recording.commands).toEqual([{ tick: 0, side: 0, command }]);
      const replay = new ReplayPlayer(archive); while (!replay.finished) replay.advance(20);
      expect(saveGame(replay.state)).toEqual(saveGame(session.state)); replay.dispose();
      expect(saveGame(verifyScenarioRecording(recording).state)).toEqual(saveGame(session.state));
    } finally { journal.destroy(); recorder.dispose(); unsubscribe(); report.mockRestore(); }
  });

  it('saves and replays a valid mission with more than 128 actor labels and counters', () => {
    const session = createScenario(mission({ events: [], army: Array.from({ length: 129 }, (_, i) => ({ label: `troop-${i}`, side: i === 128 ? 1 : 0, kind: 'unit', role: 'melee', x: 2 + i % 15 * 2, y: 2 + Math.floor(i / 15) * 2, order: { type: 'hold' } })) }));
    session.runtime.variables = Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`counter-${i}`, i]));
    expect(Object.keys(session.runtime.labels)).toHaveLength(129);
    expect(saveGame(loadGame(saveGame(session.state)))).toEqual(saveGame(session.state));
    const recorder = new MatchRecorder(session.state);
    for (let tick = 0; tick < 2; tick++) stepGame(session.state, .05);
    const replay = new ReplayPlayer(recorder.export()); while (!replay.finished) replay.advance(20);
    expect(saveGame(replay.state)).toEqual(saveGame(session.state)); replay.dispose(); recorder.dispose();
    const invalid = saveGame(session.state);
    invalid.state.scenario!.runtime.variables = Object.fromEntries(Array.from({ length: 2049 }, (_, i) => [`counter-${i}`, i]));
    expect(() => loadGame(invalid)).toThrow('variables or reinforcement budget');
  });

  it('uses central commander death cleanup and records a boss casualty once', () => {
    const session = createScenario(mission({ events: [], army: [
      { label: 'caster', side: 0, kind: 'unit', role: 'special', x: 2, y: 2, order: { type: 'hold' } },
      { label: 'boss', side: 1, kind: 'unit', role: 'special', x: 16, y: 8, order: { type: 'hold' } },
    ], boss: { actor: 'boss', name: 'The Warden', health: 1000, phases: [1, .5].map(below => ({ below, name: 'Strike', radius: 2, damage: 100, warningSeconds: .5, cooldown: 20, interruptDamage: 1000, adds: [] })) } }));
    const hero = spawnDefinition(session.state, 0, 'unit', 'core:fairies-commander', 12, 8); hero.hp = 20; hero.order = { type: 'hold' };
    const artifact = createArtifact(session.state, 'core:ember-blade', hero); refreshVisibility(session.state);
    expect(issueCommand(session.state, 0, { type: 'recoverArtifact', id: hero.id, artifact: artifact.id })).toBe(true);
    expect(issueCommand(session.state, 0, { type: 'equipArtifact', id: hero.id, artifact: artifact.id })).toBe(true);
    session.runtime.boss.nextAttack = 0;
    const recorder = new MatchRecorder(session.state);
    for (let tick = 0; tick < 20 && hero.hp > 0; tick++) stepGame(session.state, .05);
    expect(hero.hp).toBe(0); expect(hero.animation).toBe('death');
    expect(session.state.players[0].heroRecovery).toEqual([{ definitionId: 'core:fairies-commander', availableAt: session.state.time + 30 }]);
    expect(session.state.specialists!.artifacts.find(item => item.id === artifact.id)).toEqual({ id: artifact.id, definitionId: 'core:ember-blade', position: { x: hero.x, y: hero.y } });
    expect(hero.equipment).toBeUndefined();
    expect(session.state.corpses.filter(corpse => corpse.id === hero.id)).toHaveLength(1);
    expect(session.runtime.variables['deaths.0']).toBe(1);
    const archive = recorder.export(); recorder.dispose();
    expect(archive.analysis.at(-1)!.players[0].losses).toBe(1);
    const replay = new ReplayPlayer(archive); while (!replay.finished) replay.advance(20);
    expect(saveGame(replay.state)).toEqual(saveGame(session.state)); replay.dispose();
  });
});
