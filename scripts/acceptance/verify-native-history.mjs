import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './native-contract.mjs';
import { loadPinnedHelper } from './helper-provenance.mjs';
const [, , rootArg, bundleArg, fixturesArg, evidenceArg, pin] = process.argv;
assert(rootArg && bundleArg && fixturesArg && evidenceArg && pin, 'Use ROOT AUDIT_BUNDLE FIXTURES BROWSER_EVIDENCE FULL_SOURCE_COMMIT');
assert.equal(fileURLToPath(import.meta.url),resolve(rootArg,'scripts/acceptance/verify-native-history.mjs'),'Run native history wrapper from pinned checkout');
const evidenceDir = resolve(evidenceArg), fixturesDir = resolve(fixturesArg);
const receipt = JSON.parse(await readFile(resolve(evidenceDir, 'browser-native-acceptance.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(fixturesDir, 'manifest.json'), 'utf8'));
const { module, provenance } = await loadPinnedHelper(resolve(rootArg), pin, bundleArg, 'scripts/acceptance/native-audit.ts');
try {
  const result = module.verifyNativeAcceptanceArtifacts({ evidenceDir, fixturesDir, manifest, receipt, sourceCommit: pin });
  await writeFile(resolve(evidenceDir, 'native-history-helper-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`, { flag: 'wx' });
  console.log(`Verified ${result.completeNativeSaves} complete native saves and their original unprojected replay endpoints`);
} catch (error) {
  await writeFile(resolve(evidenceDir, 'native-history-first-failure.json'), `${JSON.stringify({ sourceCommit: pin, bundleSha256: provenance.bundle.sha256, message: String(error.stack ?? error), browserReceiptSha256: digest(await readFile(resolve(evidenceDir, 'browser-native-acceptance.json'))) }, null, 2)}\n`, { flag: 'wx' });
  throw error;
}
