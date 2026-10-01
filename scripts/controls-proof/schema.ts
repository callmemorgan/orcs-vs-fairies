import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionFile } from '../../src/core/session-storage';
import { MatchRecorder } from '../../src/core/replays';
import { SAVE_VERSION } from '../../src/core/saves';
import { createGame } from '../../src/core/simulation';
import { SIMULATION_REVISION } from '../../src/core/versions';

// Use actual constructors for wrapper versions; this isolated match never advances.
function currentSchema() {
  const state = createGame('orcs', 1977, 'fairies', { mapSize: 'small' });
  const recorder = new MatchRecorder(state);
  try {
    const replay = recorder.export();
    const session = createSessionFile(state, replay);
    return {
      saveVersion: SAVE_VERSION,
      simulationRevision: SIMULATION_REVISION,
      saveFormat: session.game.format,
      sessionVersion: session.version,
      sessionFormat: session.format,
      replayVersion: replay.version,
      replayFormat: replay.format,
      replayChecksumVersion: replay.checksumVersion,
      replayInitialSaveVersion: replay.initial.version,
    };
  } finally {
    recorder.dispose();
  }
}

export const proofSchema = Object.freeze(currentSchema());

// Dynamic imports expose metadata without writing any files.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const outputPath = process.argv[2];
  assert(outputPath, 'Usage: node schema.mjs <metadata-output.json>');
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(proofSchema, null, 2)}\n`);
  console.log(JSON.stringify(proofSchema));
}
