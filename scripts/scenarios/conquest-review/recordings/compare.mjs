import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [originalDirectory,fixedDirectory,outputPath] = process.argv.slice(2);
assert(originalDirectory && fixedDirectory && outputPath, 'Usage: node compare.mjs ORIGINAL_RESULT_DIR FIXED_RESULT_DIR OUTPUT_JSON');
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const hashFile = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const runnerSha256 = hashFile(join(scriptDirectory,'runner.ts'));
const launcherSha256 = hashFile(join(scriptDirectory,'run.mjs'));
const read = directory => {
  const summaryPath = join(directory,'summary.json');
  const manifestPath = join(directory,'source-manifest.json');
  const summary = JSON.parse(readFileSync(summaryPath,'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath,'utf8'));
  assert.equal(manifest.runnerSha256,runnerSha256,'Runner hash does not match final source');
  assert.equal(manifest.launcherSha256,launcherSha256,'Launcher hash does not match final source');
  assert.equal(summary.sourceManifestSha256,hashFile(manifestPath),'Manifest hash does not match summary');
  assert(Object.values(summary.assertions).every(value=>value===true),'A proof assertion failed');
  for (const battle of summary.battles) assert.equal(hashFile(join(directory,battle.recording.privateRelativePath)),battle.recording.sha256,'Recording hash does not match summary');
  return {summary,manifest,summarySha256:hashFile(summaryPath),manifestSha256:hashFile(manifestPath)};
};
const original = read(originalDirectory), fixed = read(fixedDirectory);
assert.equal(original.summary.battles.length,fixed.summary.battles.length,'Battle count changed');
const resultFields = ['faction','region','outcome','tick','commands','resumedCount','history','initialChecksum','finalChecksum','finalCheckpointSha256','profileSha256'];
const battles = original.summary.battles.map((before,index)=>{
  const after = fixed.summary.battles[index];
  const fieldDifferences = resultFields.filter(field=>before[field]!==after[field]);
  const checkpointComparisonsEqual = JSON.stringify(before.checkpointComparisons)===JSON.stringify(after.checkpointComparisons);
  return {faction:before.faction,region:before.region,outcome:before.outcome,tick:before.tick,checkpointComparisons:before.resumedCount,fieldDifferences,checkpointComparisonsEqual,recordingsEqual:before.recording.sha256===after.recording.sha256};
});
const originalSources = new Map(original.manifest.sources.map(source=>[source.path,source.sha256]));
const changedSourceFiles = fixed.manifest.sources.filter(source=>originalSources.get(source.path)!==source.sha256).map(source=>source.path);
const comparison = {
  schemaVersion:1,proof:'conquest recording resume and reconstruction comparison',
  runnerSha256,launcherSha256,comparisonScriptSha256:hashFile(fileURLToPath(import.meta.url)),
  original:{revision:original.summary.sourceRevision,totals:original.summary.totals,summarySha256:original.summarySha256,manifestSha256:original.manifestSha256},
  fixed:{revision:fixed.summary.sourceRevision,totals:fixed.summary.totals,summarySha256:fixed.summarySha256,manifestSha256:fixed.manifestSha256},
  changedSourceFiles,
  assertions:{bothProofsPassed:true,finalRunnerHashesMatch:true,finalLauncherHashesMatch:true,allPrivateRecordingHashesMatch:true,allBattleResultsEqual:battles.every(battle=>battle.fieldDifferences.length===0),allCheckpointComparisonsEqual:battles.every(battle=>battle.checkpointComparisonsEqual),allRecordingsEqual:battles.every(battle=>battle.recordingsEqual)},
  battles,
};
writeFileSync(outputPath,JSON.stringify(comparison,null,2)+'\n');
process.stdout.write(JSON.stringify({outputPath,original:comparison.original,fixed:comparison.fixed,assertions:comparison.assertions})+'\n');
