import { describe, expect, it } from 'vitest';
import { afterScenarioStep, captureScenario, createScenario, guardDetects, issueScenarioCommand, resetScenario, restoreScenario, scenarioCondition, stepScenario, validateScenario, validateScenarioBinding } from '../src/core/scenarios';
import { decodeScenarioRecording, ScenarioRecorder } from '../src/core/scenario-recordings';
import type { ScenarioActor, ScenarioDefinition, ScenarioSession } from '../src/core/scenario-types';

const troop = (label: string, side: 0 | 1, role: ScenarioActor['role'], x: number, y: number, extra: Partial<ScenarioActor> = {}): ScenarioActor => ({ label, side, kind: 'unit', role, x, y, ...extra });
function definition(extra: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    schemaVersion: 1, id: 'proof', title: 'Mission proof', briefing: 'Complete the marked objective with the supplied troops.', successText: 'The route is secure.', failureText: 'The patrol stopped the mission.', faction: 'fairies', opponent: 'orcs', seed: 22,
    map: { size: 'small', width: 36, height: 36, terrain: Array.from({ length: 36 * 36 }, (_, i) => i % 36 === 0 || i % 36 === 35 || i < 36 || i >= 36 * 35 ? 'rock' : 'grass'), starts: [{ x: 4, y: 4 }, { x: 31, y: 31 }], resources: [] },
    army: [troop('commander', 0, 'special', 8, 8), troop('enemy', 1, 'melee', 25, 25)], objectives: [{ id: 'arrive', text: 'Reach the extraction point.', success: { type: 'at', actor: 'commander', point: { x: 12, y: 8 }, radius: 1 }, failure: { type: 'dead', actor: 'commander' } }], events: [],
    rules: { fixedArmy: true, reinforcementBudget: 0, resources: { wood: 0, ore: 0, crystal: 0 }, timeLimit: 120 }, ...extra,
  };
}
const advance = (session: ScenarioSession, seconds: number) => { for (let i = 0; i < seconds * 20 && session.runtime.outcome === 'playing'; i++) stepScenario(session); };
const owned = (session: ScenarioSession) => session.state.entities.filter(e => e.side === 0 && e.hp > 0 && e.kind === 'unit' && !e.illusion).map(e => e.id);

describe('shared scenario execution', () => {
  it('forwards a core tick once when the client also evaluates the scenario', () => {
    const session = createScenario(definition());
    stepScenario(session); const once = captureScenario(session);
    afterScenarioStep(session, .05); expect(captureScenario(session)).toEqual(once);
    expect(validateScenarioBinding({ definition: session.definition, runtime: session.runtime }, session.state).runtime.lastEvaluatedTick).toBe(1);
    const invalid = structuredClone(session.runtime); invalid.lastEvaluatedTick = 2;
    expect(() => validateScenarioBinding({ definition: session.definition, runtime: invalid }, session.state)).toThrow('evaluated tick');
  });

  it('rejects external control of the opposing authored army', () => {
    const session = createScenario(definition()), recorder = new ScenarioRecorder(session);
    expect(issueScenarioCommand(session, 1, { type: 'move', ids: [session.runtime.labels.enemy], x: 30, y: 30 })).toBe(false);
    const recording = recorder.archive(); recorder.destroy();
    recording.commands.push({ tick: 0, side: 1, command: { type: 'hold', ids: [session.runtime.labels.enemy] } });
    expect(() => decodeScenarioRecording(recording)).toThrow('Invalid scenario command');
  });

  it('rejects executable recording and checkpoint properties without evaluating them', () => {
    const session = createScenario(definition()), recorder = new ScenarioRecorder(session);
    const recording = recorder.archive(); recorder.destroy(); let evaluations = 0;
    Object.defineProperty(recording, 'finalTick', { enumerable: true, get() { evaluations++; return 0; } });
    expect(() => decodeScenarioRecording(recording)).toThrow('accessors');
    const checkpoint = captureScenario(session);
    Object.defineProperty(checkpoint, 'game', { enumerable: true, get() { evaluations++; return {}; } });
    expect(() => restoreScenario(checkpoint)).toThrow('accessors'); expect(evaluations).toBe(0);
  });
  it('moves ordinary troops through commands, ends without HQ destruction and resets the identical army', () => {
    const session = createScenario(definition()), initial = captureScenario(session);
    expect(session.state.entities.some(e => e.role === 'hq')).toBe(false);
    expect(issueScenarioCommand(session, 0, { type: 'move', ids: owned(session), x: 12, y: 8 })).toBe(true);
    advance(session, 3);
    expect(session.runtime.outcome).toBe('won'); expect(session.state.winner).toBe(0);
    expect(captureScenario(resetScenario(session))).toEqual(initial);
  });

  it('fails when the protected troop dies through ordinary combat', () => {
    const session = createScenario(definition({ army: [troop('commander', 0, 'special', 12, 12), ...Array.from({ length: 8 }, (_, i) => troop(`enemy-${i}`, 1, 'melee', 14 + i % 3, 12 + Math.floor(i / 3)))] }));
    expect(issueScenarioCommand(session, 0, { type: 'hold', ids: [session.runtime.labels.commander] })).toBe(true);
    advance(session, 20);
    expect(session.runtime.outcome).toBe('lost'); expect(session.state.winner).toBe(1);
    expect(session.state.events.some(e => e.type === 'death')).toBe(true);
  });

  it('escorts a real moving convoy through every checkpoint and fights the authored ambush', () => {
    const session = createScenario(definition({ army: [troop('convoy', 0, 'worker', 8, 8), troop('commander', 0, 'special', 9, 9), troop('bow-1', 0, 'ranged', 10, 9), troop('bow-2', 0, 'ranged', 10, 8)],
      escort: { actor: 'convoy', route: [{ x: 8, y: 8 }, { x: 13, y: 8 }, { x: 19, y: 8 }], radius: .8, escortRadius: 8 },
      objectives: [{ id: 'convoy', text: 'Escort the convoy to the third checkpoint.', success: { type: 'variable', key: 'escort.checkpoints', op: 'gte', value: 3 }, failure: { type: 'dead', actor: 'convoy' } }],
      events: [{ id: 'ambush', when: { type: 'variable', key: 'escort.checkpoints', op: 'gte', value: 2 }, actions: [{ type: 'spawn', actors: [troop('raider', 1, 'melee', 18, 13, { order: { type: 'attackMove', x: 14, y: 8 } })] }] }],
    }));
    const initialX = session.state.entities.find(e => e.id === session.runtime.labels.convoy)!.x;
    issueScenarioCommand(session, 0, { type: 'attackMove', ids: owned(session).filter(id => id !== session.runtime.labels.convoy), x: 19, y: 8 });
    advance(session, 30);
    expect(session.runtime.outcome).toBe('won'); expect(session.runtime.escort.checkpoint).toBe(3);
    expect(session.state.entities.find(e => e.id === session.runtime.labels.convoy)!.x).toBeGreaterThan(initialX + 9);
    expect(session.runtime.triggers.ambush.count).toBe(1);
    expect(session.runtime.labels.raider).toBeGreaterThan(0);
  });

  it('stops the convoy when escorts leave, instead of crediting elapsed time as arrival', () => {
    const session = createScenario(definition({ army: [troop('convoy', 0, 'worker', 8, 8), troop('commander', 0, 'special', 9, 8)], escort: { actor: 'convoy', route: [{ x: 8, y: 8 }, { x: 20, y: 8 }], radius: .8, escortRadius: 3 }, objectives: [{ id: 'convoy', text: 'Reach the far checkpoint.', success: { type: 'variable', key: 'escort.checkpoints', op: 'gte', value: 2 }, failure: { type: 'dead', actor: 'convoy' } }] }));
    issueScenarioCommand(session, 0, { type: 'move', ids: [session.runtime.labels.commander], x: 5, y: 20 }); advance(session, 10);
    expect(session.runtime.escort.moving).toBe(false); const convoy = session.state.entities.find(e => e.id === session.runtime.labels.convoy)!;
    const x = convoy.x; advance(session, 10); expect(convoy.x).toBe(x); expect(session.runtime.outcome).toBe('playing');
  });

  it('spends a finite reinforcement budget through real production and rejects excess orders', () => {
    const session = createScenario(definition({ faction: 'dwarves', army: [{ label: 'fortress', side: 0, kind: 'building', role: 'hq', x: 8, y: 8 }, { label: 'foundry', side: 0, kind: 'building', role: 'barracks', x: 13, y: 8 }, troop('commander', 0, 'special', 12, 12)],
      objectives: [{ id: 'hold', text: 'Keep the fortress standing for sixty seconds.', success: { type: 'time', seconds: 60 }, failure: { type: 'dead', actor: 'fortress' } }],
      rules: { fixedArmy: false, reinforcementBudget: 2, resources: { wood: 500, ore: 500, crystal: 40 }, timeLimit: 90 },
    }));
    const producer = session.runtime.labels.foundry;
    expect(issueScenarioCommand(session, 0, { type: 'train', id: producer, role: 'melee' })).toBe(true);
    expect(issueScenarioCommand(session, 0, { type: 'train', id: producer, role: 'ranged' })).toBe(true);
    expect(issueScenarioCommand(session, 0, { type: 'train', id: producer, role: 'melee' })).toBe(false);
    expect(session.runtime.reinforcementRemaining).toBe(0); advance(session, 60);
    expect(session.runtime.outcome).toBe('won'); expect(session.state.entities.filter(e => e.side === 0 && e.kind === 'unit')).toHaveLength(2);
    // The second recruit remains in production when the survival objective completes.
    expect(session.state.entities.find(e => e.id === producer)!.queue).toEqual(['ranged']);
  });

  it('survives authored waves and loses if the required fortress falls', () => {
    const d = definition({ faction: 'dwarves', army: [{ label: 'fortress', side: 0, kind: 'building', role: 'hq', x: 8, y: 8 }, ...Array.from({ length: 5 }, (_, i) => troop(`defender-${i}`, 0, 'ranged', 12, 8 + i))],
      objectives: [{ id: 'hold', text: 'Hold until the last wave is destroyed.', success: { type: 'all', conditions: [{ type: 'time', seconds: 20 }, { type: 'cleared', side: 1 }] }, failure: { type: 'dead', actor: 'fortress' } }],
      events: [5, 12].map((time, index) => ({ id: `wave-${index}`, when: { type: 'time' as const, seconds: time }, actions: [{ type: 'spawn' as const, actors: [troop(`raider-${index}`, 1, 'melee', 21, 11, { order: { type: 'attackMove', x: 8, y: 8 } })] }] })),
    });
    const win = createScenario(d); issueScenarioCommand(win, 0, { type: 'hold', ids: owned(win) }); advance(win, 35); expect(win.runtime.outcome).toBe('won'); expect(Object.keys(win.runtime.triggers)).toHaveLength(2);
    const loss = createScenario({ ...d, army: [{ ...d.army[0], hp: 100 }, ...Array.from({ length: 8 }, (_, i) => troop(`besieger-${i}`, 1, 'siege', 13 + i % 3, 8 + Math.floor(i / 3), { order: { type: 'attackMove', x: 8, y: 8 } }))], events: [] });
    advance(loss, 20); expect(loss.runtime.outcome).toBe('lost'); expect(loss.state.players[0].population).toBe(0);
  });

  it('infiltrates and extracts without alarms, then detects a scout inside a patrol cone', () => {
    const d = definition({ army: [troop('commander', 0, 'special', 8, 8), troop('guard', 1, 'melee', 17, 8, { order: { type: 'move', x: 17, y: 9 } })],
      stealth: { infiltrators: ['commander'], guards: ['guard'], alarmLimit: 1, detectionSeconds: .25, radius: 5, coneDegrees: 100, patrols: [{ actor: 'guard', route: [{ x: 17, y: 8 }, { x: 17, y: 9 }] }] },
      events: [{ id: 'recover', when: { type: 'at', actor: 'commander', point: { x: 9, y: 20 }, radius: 1 }, actions: [{ type: 'set', key: 'recovered', value: 1 }] }],
      objectives: [{ id: 'extract', text: 'Recover the documents and return.', success: { type: 'all', conditions: [{ type: 'variable', key: 'recovered', op: 'eq', value: 1 }, { type: 'at', actor: 'commander', point: { x: 8, y: 8 }, radius: 1 }] }, failure: { type: 'dead', actor: 'commander' } }],
    });
    const win = createScenario(d); issueScenarioCommand(win, 0, { type: 'move', ids: owned(win), x: 9, y: 20 }); advance(win, 6); issueScenarioCommand(win, 0, { type: 'move', ids: owned(win), x: 8, y: 8 }); advance(win, 6);
    expect(win.runtime.outcome).toBe('won'); expect(win.runtime.stealth.alarms).toBe(0);
    const loss = createScenario({ ...d, army: [troop('commander', 0, 'melee', 17, 12), d.army[1]] });
    const guard = loss.state.entities.find(e => e.id === loss.runtime.labels.guard)!, commander = loss.state.entities.find(e => e.id === loss.runtime.labels.commander)!;
    expect(guardDetects(loss, guard, commander)).toBe(true); advance(loss, 1);
    expect(loss.runtime.outcome).toBe('lost'); expect(loss.runtime.stealth.alarms).toBe(1); expect(guard.order.type).toBe('attackMove');
  });

  it('uses a legitimate Veilweaver cast to divert a guard while the real infiltrator escapes', () => {
    const session = createScenario(definition({ army: [troop('commander', 0, 'special', 17, 12), troop('guard', 1, 'melee', 17, 8, { order: { type: 'move', x: 17, y: 9 } })],
      stealth: { infiltrators: ['commander'], guards: ['guard'], alarmLimit: 1, detectionSeconds: .25, radius: 5, coneDegrees: 120, patrols: [{ actor: 'guard', route: [{ x: 17, y: 8 }, { x: 17, y: 9 }] }] },
      objectives: [{ id: 'escape', text: 'Divert the patrol and reach extraction.', success: { type: 'all', conditions: [{ type: 'at', actor: 'commander', point: { x: 21, y: 15 }, radius: 1 }, { type: 'variable', key: 'stealth.diversions', op: 'gte', value: 1 }] }, failure: { type: 'dead', actor: 'commander' } }],
    }));
    expect(issueScenarioCommand(session, 0, { type: 'ability', ids: owned(session) })).toBe(true);
    expect(session.state.entities.filter(e => e.illusion)).toHaveLength(2);
    issueScenarioCommand(session, 0, { type: 'move', ids: owned(session), x: 21, y: 15 }); advance(session, 4);
    expect(session.runtime.outcome).toBe('won'); expect(session.runtime.stealth.alarms).toBe(0); expect(session.runtime.variables['stealth.diversions']).toBeGreaterThanOrEqual(1);
  });

  it('fights all boss phases, interrupts a warning attack and defeats the target', () => {
    const session = createScenario(definition({ army: [...Array.from({ length: 6 }, (_, i) => troop(i ? `bow-${i}` : 'commander', 0, 'ranged', 9, 11 + i)), troop('boss', 1, 'special', 16, 14)],
      objectives: [{ id: 'boss', text: 'Break every phase and defeat the boss.', success: { type: 'all', conditions: [{ type: 'variable', key: 'boss.defeated', op: 'eq', value: 1 }, { type: 'variable', key: 'boss.phases', op: 'gte', value: 3 }, { type: 'variable', key: 'boss.interrupts', op: 'gte', value: 1 }] } }],
      boss: { actor: 'boss', name: 'The Iron Warden', health: 850, phases: [1, .7, .35].map((below, i) => ({ below, name: `Stance ${i + 1}`, radius: 3, damage: 100, warningSeconds: 2, cooldown: 3, interruptDamage: 30, adds: [] })) },
    }));
    issueScenarioCommand(session, 0, { type: 'attackMove', ids: owned(session), x: 16, y: 14 }); advance(session, 60);
    expect(session.runtime.outcome).toBe('won'); expect(session.runtime.boss.phasesEntered).toEqual([0, 1, 2]); expect(session.runtime.boss.interrupted).toBeGreaterThan(0); expect(session.runtime.boss.hits).toBe(0);
  });

  it('preserves schedules, orders, alarms and an active boss warning across exact checkpoints', () => {
    const session = createScenario(definition({ army: [troop('commander', 0, 'ranged', 10, 10), troop('boss', 1, 'special', 16, 10)], objectives: [{ id: 'hold', text: 'Observe all scheduled attacks and deliveries.', success: { type: 'time', seconds: 30 } }], boss: { actor: 'boss', name: 'The Keeper', health: 1200, phases: [1, .5].map(below => ({ below, name: 'Burning ground', radius: 3, damage: 30, warningSeconds: 3, cooldown: 8, interruptDamage: 1000, adds: [] })) }, events: [{ id: 'supply', when: { type: 'time', seconds: 8 }, actions: [{ type: 'add', key: 'delivered', value: 1 }], repeat: { seconds: 2, count: 3 } }] }));
    issueScenarioCommand(session, 0, { type: 'hold', ids: owned(session) }); advance(session, 4.5);
    expect(session.runtime.boss.telegraph).not.toBeNull(); const checkpoint = captureScenario(session), resumed = restoreScenario(checkpoint);
    for (let tick = 0; tick < 160; tick++) { stepScenario(session); stepScenario(resumed); expect(captureScenario(resumed)).toEqual(captureScenario(session)); }
    expect(session.runtime.triggers.supply.count).toBe(3);
    const corrupt = structuredClone(checkpoint); corrupt.runtime.triggers.unknown = { count: 1, lastTime: 1 };
    expect(() => restoreScenario(corrupt)).toThrow('trigger schedule');
  });

  it('rejects unknown references, impossible spawns, executable packages and oversized nested graphs', () => {
    const missing = definition(); missing.objectives[0].success = { type: 'dead', actor: 'missing' }; expect(() => validateScenario(missing)).toThrow('unknown actor');
    const rock = definition(); rock.army[0].x = .5; expect(() => validateScenario(rock)).toThrow('impassable');
    let executed = false; const executable = { ...definition() }; Object.defineProperty(executable, 'title', { enumerable: true, get() { executed = true; return 'bad'; } });
    expect(() => validateScenario(executable)).toThrow('accessors'); expect(executed).toBe(false);
    const repeat = definition({ events: [{ id: 'wave', when: { type: 'time', seconds: 2 }, actions: [{ type: 'spawn', actors: [troop('reinforcement', 1, 'melee', 20, 20)] }], repeat: { seconds: 1, count: 2 } }] }); expect(() => validateScenario(repeat)).toThrow('ambiguous');
    expect(scenarioCondition(createScenario(definition({ events: [{ id: 'later', when: { type: 'time', seconds: 10 }, actions: [{ type: 'spawn', actors: [troop('later-actor', 1, 'melee', 20, 20)] }] }] })), { type: 'dead', actor: 'later-actor' })).toBe(false);
  });
});
