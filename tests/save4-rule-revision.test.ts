import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay, MatchRecorder, ReplayPlayer, replayRulesCompatible } from '../src/core/replays';
import { checksumSaveEnvelope, saveGame } from '../src/core/saves';
import { createSessionFile, decodeSessionFile } from '../src/core/session-storage';
import { issueCommand, stepGame } from '../src/core/simulation';
import { LEGACY_SIMULATION_REVISIONS, SIMULATION_REVISION } from '../src/core/versions';

const capturedSession = () => {
  const bytes = readFileSync(new URL('../docs/evidence/controls-final-af44da4-20261001/gamepad/gamepad-native-session.json', import.meta.url));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('91ae02c1fc5b43c37257a31f8594ca98b291d10a58158b06038615bd7d7241ca');
  return JSON.parse(bytes.toString());
};

describe('SAVE4 rules 4.0.0 history after the 4.0.1 gameplay repairs', () => {
  it('preserves the genuine browser game and replay while requiring new history for continuation', () => {
    const source = capturedSession(), before = JSON.stringify(source);
    const restored = decodeSessionFile(source);
    expect(SIMULATION_REVISION).toBe('4.0.1');
    expect(restored.file).toEqual(source);
    expect(restored.file.game.version).toBe(4);
    expect(checksumSaveEnvelope(restored.file.game)).toBe('00ac2f44');
    expect(saveGame(restored.state)).toEqual(source.game);
    expect(restored.file.replay!.simulationRevision).toBe('4.0.0');
    expect(replayRulesCompatible(restored.file.replay!)).toBe(false);
    expect(() => new ReplayPlayer(restored.file.replay)).toThrow('rules 4.0.0');
    expect(() => new MatchRecorder(restored.state, restored.file.replay)).toThrow('Older replay history');

    const fresh = new MatchRecorder(restored.state);
    try {
      const worker = restored.state.entities.find(entity => entity.side === 0 && entity.role === 'worker' && entity.hp > 0)!;
      expect(issueCommand(restored.state, 0, { type: 'hold', ids: [worker.id] })).toBe(true);
      for (let tick = 0; tick < 20; tick++) stepGame(restored.state, .05);
      const continued = createSessionFile(restored.state, fresh.export());
      expect(continued.replay!.simulationRevision).toBe('4.0.1');
      expect(continued.game.state.tick).toBe(126);
      const playback = new ReplayPlayer(continued.replay);
      try {
        expect(playback.advance(20)).toBe(20);
        expect(playback.finished).toBe(true);
        expect(saveGame(playback.state)).toEqual(continued.game);
      } finally { playback.dispose(); }
      expect(decodeSessionFile(continued).file).toEqual(continued);
    } finally { fresh.dispose(); }
    expect(JSON.stringify(source)).toBe(before);
  });

  it('keeps an omitted SAVE4 replay rules pin mapped to its original revision', () => {
    // Only the rules metadata is modified; this is a disclosed synthetic wrapper.
    const replay = capturedSession().replay;
    delete replay.simulationRevision;
    const before = JSON.stringify(replay), decoded = decodeReplay(replay);
    expect(LEGACY_SIMULATION_REVISIONS[4]).toBe('4.0.0');
    expect(decoded.initial.version).toBe(4);
    expect(decoded.simulationRevision).toBe('4.0.0');
    expect(replayRulesCompatible(decoded)).toBe(false);
    expect(() => new ReplayPlayer(decoded)).toThrow('rules 4.0.0');
    expect(JSON.stringify(replay)).toBe(before);
  });
});
