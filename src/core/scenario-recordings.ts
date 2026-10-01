import { validateCommand } from './commands';
import { captureScenario, issueScenarioCommand, restoreScenario, stepScenario, subscribeScenarioCommands } from './scenarios';
import type { ScenarioCheckpoint, ScenarioSession } from './scenario-types';
import type { Command, Side } from './types';
import { scenarioJson } from './scenario-validation';

const SCENARIO_RECORDING_LIMITS = { maxBytes: 20 * 1024 * 1024, maxNodes: 1000000, maxArrayLength: 100000 };

export interface ScenarioRecording {
  format: 'orcs-vs-fairies-scenario-recording'; version: 1;
  initial: ScenarioCheckpoint;
  commands: Array<{ tick: number; side: Side; command: Command }>;
  finalTick: number;
  finalChecksum: string;
}
export function scenarioChecksum(session: ScenarioSession): string {
  const checkpoint = captureScenario(session);
  // The forwarding guard is derived from the authoritative tick. Exclude it
  // so existing mission journals retain their checksum after this migration.
  delete (checkpoint.runtime as Partial<typeof checkpoint.runtime>).lastEvaluatedTick;
  const text = JSON.stringify(checkpoint); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
/** Compare every normalized state value when authorizing progression or rewards. */
export function scenarioStateEquals(left: ScenarioSession, right: ScenarioSession): boolean {
  const text = (session: ScenarioSession) => {
    const checkpoint = captureScenario(session);
    delete (checkpoint.runtime as Partial<typeof checkpoint.runtime>).lastEvaluatedTick;
    const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, child]) => [key, canonical(child)])) : value;
    return JSON.stringify(canonical(checkpoint));
  };
  return text(left) === text(right);
}
export function decodeScenarioRecording(input: unknown): ScenarioRecording {
  let raw = input;
  if (typeof raw === 'string') { if (raw.length > 20 * 1024 * 1024) throw new Error('Scenario recording is too large.'); raw = JSON.parse(raw); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid scenario recording.');
  const record = scenarioJson(raw, SCENARIO_RECORDING_LIMITS) as ScenarioRecording;
  if (Object.keys(record).some(key => !['format', 'version', 'initial', 'commands', 'finalTick', 'finalChecksum'].includes(key)) || record.format !== 'orcs-vs-fairies-scenario-recording' || record.version !== 1) throw new Error('Unsupported scenario recording.');
  const initial = restoreScenario(record.initial);
  if (!Number.isSafeInteger(record.finalTick) || record.finalTick < initial.state.tick || record.finalTick - initial.state.tick > 144000 || typeof record.finalChecksum !== 'string' || !/^[a-f0-9]{8}$/.test(record.finalChecksum)) throw new Error('Invalid scenario recording duration or checksum.');
  if (!Array.isArray(record.commands) || record.commands.length > 100000) throw new Error('Invalid scenario command count.');
  let prior = initial.state.tick;
  for (let i = 0; i < record.commands.length; i++) {
    if (!Object.hasOwn(record.commands, i)) throw new Error('Scenario commands contain gaps.');
    const action = record.commands[i];
    if (!action || typeof action !== 'object' || Array.isArray(action) || Object.keys(action).some(key => !['tick', 'side', 'command'].includes(key)) || !Number.isSafeInteger(action.tick) || action.tick < prior || action.tick > record.finalTick || action.side !== 0 || !validateCommand(action.command)) throw new Error('Invalid scenario command.');
    prior = action.tick;
  }
  return { format: record.format, version: 1, initial: captureScenario(initial), commands: structuredClone(record.commands), finalTick: record.finalTick, finalChecksum: record.finalChecksum };
}
/** Reconstructs the actual mission from its initial state and accepted player input. */
export function verifyScenarioRecording(input: unknown): ScenarioSession {
  const recording = decodeScenarioRecording(input), session = restoreScenario(recording.initial);
  let index = 0;
  while (session.state.tick <= recording.finalTick) {
    while (index < recording.commands.length && recording.commands[index].tick === session.state.tick) {
      const action = recording.commands[index++]; if (!issueScenarioCommand(session, action.side, action.command)) throw new Error(`Scenario command diverged at tick ${session.state.tick}.`);
    }
    if (session.state.tick === recording.finalTick) break;
    if (session.runtime.outcome !== 'playing') throw new Error('Scenario recording continues after its result.');
    stepScenario(session);
  }
  if (index !== recording.commands.length || scenarioChecksum(session) !== recording.finalChecksum) throw new Error('Scenario recording checksum diverged.');
  return session;
}

export class ScenarioRecorder {
  private failure: string | null = null;
  private readonly initial: ScenarioCheckpoint;
  private readonly commands: ScenarioRecording['commands'];
  private readonly unsubscribe: () => void;
  constructor(private readonly session: ScenarioSession, previous?: ScenarioRecording) {
    if (previous) {
      const recording = decodeScenarioRecording(previous);
      if (recording.finalTick !== session.state.tick || !scenarioStateEquals(verifyScenarioRecording(recording), session)) throw new Error('Saved scenario recording does not match its checkpoint.');
      this.initial = recording.initial; this.commands = recording.commands;
    } else { this.initial = captureScenario(session); this.commands = []; }
    this.unsubscribe = subscribeScenarioCommands(session, (side, command) => {
      if (this.commands.length >= 100000) { this.failure = 'Scenario recording command limit reached.'; return; }
      this.commands.push({ tick: session.state.tick, side, command });
    });
  }
  archive(): ScenarioRecording { if (this.failure) throw new Error(this.failure); return decodeScenarioRecording({ format: 'orcs-vs-fairies-scenario-recording', version: 1, initial: structuredClone(this.initial), commands: structuredClone(this.commands), finalTick: this.session.state.tick, finalChecksum: scenarioChecksum(this.session) }); }
  destroy(): void { this.unsubscribe(); }
}
