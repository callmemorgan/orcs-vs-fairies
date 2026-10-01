import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadGame, saveGame } from './save-check.mjs';
const root = new URL('./', import.meta.url).pathname;
const repo = process.env.TEAM_EVIDENCE_REPO ?? execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
const sourceSha = 'c1f22643fc3b73e16e58965f4e31bd10bfc08e04';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceManifest = readdirSync(root + 'source/core').filter(file => file.endsWith('.ts')).sort().map(file => {
  const copied = readFileSync(root + 'source/core/' + file);
  const committed = execFileSync('git', ['show', sourceSha + ':src/core/' + file], { cwd: repo });
  const row = { file: 'src/core/' + file, copiedSha256: sha256(copied), committedSha256: sha256(committed), matchesCommit: copied.equals(committed) };
  if (!row.matchesCommit) throw new Error('Copied source differs from frozen commit: ' + row.file);
  return row;
});
// Esbuild writes source-path comments; copied files have different filesystem paths.
const stripSourcePathComments = code => code.replace(/^\/\/[^\n]*\n/gm, '');
const original = readFileSync(root + 'frozen.mjs', 'utf8'), rebuilt = readFileSync(root + 'rebuilt.mjs', 'utf8');
const originalCodeSha256 = sha256(stripSourcePathComments(original)), rebuiltCodeSha256 = sha256(stripSourcePathComments(rebuilt));
if (originalCodeSha256 !== rebuiltCodeSha256) throw new Error('Frozen bundle differs from copied-source rebuild after source-path comments are removed.');
const saves = ['2v2', '3v3', '4v4'].map(label => {
  const saved = JSON.parse(readFileSync(root + label + '-final-save.json'));
  const result = JSON.parse(readFileSync(root + label + '-result.json'));
  const loaded = loadGame(saved), roundTrip = saveGame(loaded);
  const exactRoundTrip = JSON.stringify(roundTrip) === JSON.stringify(saved);
  const matchesResult = loaded.tick === result.ticks && loaded.time === result.seconds && loaded.winner === result.winner && loaded.winningTeam === result.winningTeam && JSON.stringify(loaded.players) === JSON.stringify(result.finalPlayers);
  if (!exactRoundTrip || !matchesResult) throw new Error('Saved state does not round-trip or match result: ' + label);
  return { label, exactRoundTrip, matchesResult };
});
const report = { sourceSha, sourceManifest, frozenBundleSha256: sha256(original), rebuiltBundleSha256: sha256(rebuilt), comparison: 'Remove standalone esbuild source-path comments only; compare all remaining bytes', originalCodeSha256, rebuiltCodeSha256, bundlesMatch: originalCodeSha256 === rebuiltCodeSha256, saves };
writeFileSync(root + 'provenance-and-save-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
