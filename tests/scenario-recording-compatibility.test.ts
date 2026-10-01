import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeScenarioRecording, ScenarioRecorder, scenarioCheckpointChecksum, scenarioRecordingRulesCompatibility, scenarioRecordingRulesCompatible, verifyScenarioRecording } from '../src/core/scenario-recordings';
import { captureScenario, createScenario, restoreScenario } from '../src/core/scenarios';
import { SAVE_VERSION } from '../src/core/saves';
import { SIMULATION_REVISION } from '../src/core/versions';
import { SCENARIOS } from '../src/scenarios/campaigns';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/scenario-save3-3.2/${name}.json`, import.meta.url), 'utf8'));

describe('scenario journal rules compatibility', () => {
  it('preserves genuine legacy recording bytes and hashes its original final checkpoint', () => {
    const raw = fixture('scenario-recording'), checkpoint = fixture('scenario-final'), text = JSON.stringify(raw), final = JSON.stringify(checkpoint);
    const decoded = decodeScenarioRecording(raw);
    expect(JSON.stringify(decoded)).toBe(text); expect(JSON.stringify(raw)).toBe(text);
    expect(scenarioCheckpointChecksum(checkpoint)).toBe(raw.finalChecksum); expect(JSON.stringify(checkpoint)).toBe(final);
    expect(scenarioRecordingRulesCompatible(decoded)).toBe(false); expect(scenarioRecordingRulesCompatibility(decoded).reason).toContain('no pinned simulation rules');
    expect(() => verifyScenarioRecording(decoded)).toThrow('inspection');
    expect(() => new ScenarioRecorder(restoreScenario(checkpoint), decoded)).toThrow('inspection');
  });

  it('keeps an omitted derived evaluation guard omitted in a legacy initial checkpoint', () => {
    const raw = fixture('scenario-recording'); delete raw.initial.runtime.lastEvaluatedTick;
    expect(Object.hasOwn(decodeScenarioRecording(raw).initial.runtime, 'lastEvaluatedTick')).toBe(false);
  });

  it('pins both versions on new journals and verifies current state', () => {
    const session = createScenario(SCENARIOS['automata-2']), recorder = new ScenarioRecorder(session), recording = recorder.archive(); recorder.destroy();
    expect(recording).toMatchObject({ version: 2, simulationRevision: SIMULATION_REVISION, checksumVersion: SAVE_VERSION });
    expect(scenarioRecordingRulesCompatible(recording)).toBe(true); expect(captureScenario(verifyScenarioRecording(recording))).toEqual(captureScenario(session));
  });

  it('blocks old rules before executing valid recorded commands', () => {
    const session = createScenario(SCENARIOS['automata-2']), recorder = new ScenarioRecorder(session), raw = recorder.archive(); recorder.destroy();
    if (raw.version !== 2) throw new Error('Expected current recording.');
    raw.simulationRevision = '0.0.0'; raw.commands = [{ tick: 0, side: 0, command: { type: 'move', ids: [999999], x: 8, y: 8 } }];
    expect(decodeScenarioRecording(raw)).toEqual(raw);
    expect(() => verifyScenarioRecording(raw)).toThrow('rules 0.0.0');
    expect(() => new ScenarioRecorder(session, raw)).toThrow('rules 0.0.0');
    expect(session.state.tick).toBe(0);
  });

  it.each(['simulationRevision', 'checksumVersion'])('requires the version 2 %s pin', key => {
    const recorder = new ScenarioRecorder(createScenario(SCENARIOS['automata-2'])), raw = recorder.archive(); recorder.destroy();
    delete (raw as unknown as Record<string, unknown>)[key]; expect(() => decodeScenarioRecording(raw)).toThrow('Unsupported');
  });
});
