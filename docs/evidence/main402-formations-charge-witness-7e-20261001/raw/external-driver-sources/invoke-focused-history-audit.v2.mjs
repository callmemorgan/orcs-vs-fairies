import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [, , rootArg, pin, bundleArg, evidenceArg, fixturesArg] = process.argv;
assert(rootArg && /^[0-9a-f]{40}$/.test(pin ?? '') && bundleArg && evidenceArg && fixturesArg);
const root = resolve(rootArg), evidenceDir = resolve(evidenceArg), fixturesDir = resolve(fixturesArg);
const { loadPinnedHelper } = await import(pathToFileURL(resolve(root, 'scripts/acceptance/helper-provenance.mjs')).href);
const { digest } = await import(pathToFileURL(resolve(root, 'scripts/acceptance/native-contract.mjs')).href);
const { module: helper, provenance } = await loadPinnedHelper(root, pin, resolve(bundleArg), 'scripts/acceptance/main-smoke402-history-audit.ts');
assert.equal(typeof helper.verifyMainSmoke402Artifacts, 'function');
const manifest = JSON.parse(await readFile(resolve(fixturesDir, 'manifest.json'), 'utf8'));
const receipt = JSON.parse(await readFile(resolve(evidenceDir, 'browser-main-smoke402.json'), 'utf8'));
assert.equal(manifest.sourceCommit, pin); assert.equal(receipt.completed, true); assert.equal(receipt.cleanup?.completed, true);
const result = await helper.verifyMainSmoke402Artifacts({ evidenceDir, fixturesDir, manifest, receipt, sourceCommit: pin });
const auditPath = resolve(evidenceDir, 'main-smoke402-history-checks.json'), auditBytes = await readFile(auditPath);
assert.deepEqual(JSON.parse(auditBytes.toString()), result);
assert.equal(result.completeOriginalSaveAndRuntimeVerification, true);
const counts = { checks: result.checks.length, standaloneReplays: result.standaloneReplays.length,
  continuations: result.continuations.length, ordinaryTickHistories: result.ordinaryTickHistories.length };
await writeFile(resolve(evidenceDir, 'focused-history-helper-provenance.json'), JSON.stringify({ sourceCommit: pin,
  entry: 'scripts/acceptance/main-smoke402-history-audit.ts', provenance, counts,
  auditOutput: { path: auditPath, bytes: auditBytes.length, sha256: digest(auditBytes) },
  completeOriginalSaveAndRuntimeVerification: true }, null, 2) + '\n', { flag: 'wx' });
console.log('Focused main15 event/history audit completed; visual acceptance remains separate.');
