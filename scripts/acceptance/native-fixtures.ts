import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDirectionDefenseFixtures } from './direction-defense-fixtures';
import { buildCaptureAmbushMoraleFixtures } from './capture-ambush-fixtures';
import { buildSpecialistLifecycleFixtures } from './specialist-lifecycle-fixtures';
import { buildFactionPowerFixtures } from './faction-powers-fixtures';
import { SAVE_VERSION } from '../../src/core/saves';
import { SIMULATION_REVISION } from '../../src/core/versions';

// This entry is bundled from the admitted source pin. The native browser owns
// every gameplay action after these declared starting conditions are imported.
export function buildNativeAcceptanceFixtures(output: string, sourceCommit: string) {
  assert.match(sourceCommit, /^[0-9a-f]{40}$/);
  const out = resolve(output); assert(!existsSync(out), 'Use a new fixture directory');
  mkdirSync(out, { recursive: true });
  const groups = {
    factions: buildFactionPowerFixtures(resolve(out, 'factions'), sourceCommit),
    direction: buildDirectionDefenseFixtures(resolve(out, 'direction'), sourceCommit),
    capture: buildCaptureAmbushMoraleFixtures(resolve(out, 'capture'), sourceCommit),
    specialists: (() => {
      buildSpecialistLifecycleFixtures(resolve(out, 'specialists'), sourceCommit);
      return JSON.parse(readFileSync(resolve(out, 'specialists/specialist-lifecycle-manifest.json'), 'utf8'));
    })(),
  };
  const scenarios: Record<string, unknown> = {};
  for (const [group, manifest] of Object.entries(groups)) {
    assert.equal(manifest.schema, 1); assert.equal(manifest.sourceCommit, sourceCommit);
    assert.equal(manifest.saveVersion, SAVE_VERSION); assert.equal(manifest.simulationRevision, SIMULATION_REVISION);
    for (const [name, scenario] of Object.entries(manifest.scenarios) as [string, { file: string }][]) {
      assert(!Object.hasOwn(scenarios, name), `Unique authored scenario ${name}`);
      scenarios[name] = { ...scenario, file: `${group}/${scenario.file}`, group };
    }
  }
  const manifest = {
    schema: 1, sourceCommit, saveVersion: SAVE_VERSION, simulationRevision: SIMULATION_REVISION,
    setup: 'Authored initial conditions only. Native production UI supplies all later player commands and simulation ticks. Group manifests retain each setup exception.',
    groups: Object.fromEntries(Object.entries(groups).map(([name, value]) => [name, { setup: value.setup, scenarios: Object.keys(value.scenarios) }])), scenarios,
  };
  writeFileSync(resolve(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return manifest;
}
