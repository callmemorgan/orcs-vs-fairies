import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCanonicalMainFixtures } from './canonical-main-fixtures';
import { buildRuinCoverFixtures } from './ruin-cover-fixtures';

/** Compose declared starting conditions. Neither producer advances the simulation. */
export function buildFocusedMainFixtures(output: string, sourceCommit: string) {
  const out = resolve(output);
  assert(!existsSync(out), 'Use a new output directory');
  mkdirSync(out, { recursive: true });
  const tactics = buildCanonicalMainFixtures(resolve(out, 'tactics'), sourceCommit);
  const ruins = buildRuinCoverFixtures(resolve(out, 'ruins'), sourceCommit);
  assert.equal(Object.keys(tactics.scenarios).length, 9);
  assert.equal(Object.keys(ruins.scenarios).length, 6);
  const scenarios: Record<string, unknown> = {};
  for (const [directory, manifest] of [['tactics', tactics], ['ruins', ruins]] as const) {
    assert.equal(manifest.sourceCommit, sourceCommit);
    assert.equal(manifest.saveVersion, 4);
    assert.equal(manifest.simulationRevision, '4.0.2');
    for (const [name, scenario] of Object.entries(manifest.scenarios)) {
      assert(!Object.hasOwn(scenarios, name));
      scenarios[name] = { ...scenario, file: `${directory}/${scenario.file}`,
        ...(scenario.inputMap ? { inputMap: { ...scenario.inputMap, file: `${directory}/${scenario.inputMap.file}` } } : {}) };
    }
  }
  const manifest = { schema: 1, sourceCommit, saveVersion: 4, simulationRevision: '4.0.2',
    setup: 'Fifteen declared initial encounters. Production main controls issue commands and advance every recorded tick.',
    scenarios };
  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return manifest;
}
