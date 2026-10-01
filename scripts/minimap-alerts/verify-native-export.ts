import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { decodeSessionFile } from '../../src/core/session-storage';
import { saveGame, SAVE_VERSION } from '../../src/core/saves';
import { ReplayPlayer, replayChecksum } from '../../src/core/replays';

// Run from the repository root after bundling against the current core source.
const inputPath = process.argv[2];
assert(inputPath, 'Pass a native exported session JSON path');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourcePin = process.argv[4] ?? head;
assert.equal(sourcePin, head, 'The checker must use the requested committed source');
assert.equal(execFileSync('git', ['diff', 'HEAD', '--name-only', '--', 'src'], { encoding: 'utf8' }).trim(), '', 'Core source must match the recorded source pin');
const checkerScriptPath = 'scripts/minimap-alerts/verify-native-export.ts';
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const bytes = readFileSync(inputPath);
const input = JSON.parse(bytes.toString());
const decoded = decodeSessionFile(bytes.toString());
assert.equal(input.game.version, SAVE_VERSION, 'Regenerate the fixture and native export for the current save version');
assert.deepEqual(decoded.file.game, input.game);
assert.deepEqual(saveGame(decoded.state), input.game);
assert(input.replay, 'Native export must include recorder history');
const player = new ReplayPlayer(input.replay);
try {
  const initialTick = player.state.tick;
  const advanced = player.advance(input.replay.finalTick - initialTick);
  assert(player.finished);
  assert.equal(player.state.tick, input.game.state.tick);
  assert.equal(replayChecksum(player.state), input.replay.finalChecksum);
  assert.deepEqual(saveGame(player.state), input.game);
  const result = {
    input: inputPath, sha256: sha256(bytes), sourcePin,
    checkerScriptPath, checkerScriptSha256: sha256(readFileSync(checkerScriptPath)),
    nativeDecoderPassed: true, completeEnvelopeRoundtripPassed: true,
    completeReplayEnvelopePassed: true, initialTick, advanced,
    finalTick: player.state.tick, checksum: input.replay.finalChecksum,
    saveVersion: input.game.version, simulationRevision: input.replay.simulationRevision,
  };
  if (process.argv[3]) writeFileSync(process.argv[3], `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  player.dispose();
}
