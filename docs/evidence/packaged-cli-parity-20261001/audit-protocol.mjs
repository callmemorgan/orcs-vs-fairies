import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip, gunzipSync } from 'node:zlib';

const root = resolve('docs/evidence/packaged-cli-parity-20261001');
const runs = ['clean-pin-13d4fbc', 'command-only-13d4fbc', 'one-tick-13d4fbc', 'one-tick-gzip-13d4fbc'];
const sha256 = text => createHash('sha256').update(text).digest('hex');
async function json(file) { const bytes = await readFile(join(root, file)); return JSON.parse((file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8')); }
function checksum(text) { let hash = 2166136261; for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
const checks = [];
for (const run of runs) {
  const comparisons = await json(`${run}/comparisons.json.gz`), input = await json(`${run}/input.native.json.gz`);
  for (const name of ['main', 'continuation']) {
    const expected = comparisons.filter(comparison => comparison.process === name), recorded = await json(`${run}/${name}.process.json`);
    const lines = createInterface({ input: createReadStream(join(root, run, `${name}.stdout.ndjson.gz`)).pipe(createGunzip()), crlfDelay: Infinity });
    const saves = []; let replies = 0, rejected = 0;
    for await (const line of lines) {
      replies++; const response = JSON.parse(line); if (!response.ok) { rejected++; continue; }
      if (response.result?.format !== 'orcs-vs-fairies-save') continue;
      const save = response.result, text = JSON.stringify(save), comparison = expected[saves.length];
      assert(comparison, 'Unexpected native save in retained CLI stdout.');
      assert.equal(save.state.tick, comparison.tick); assert.equal(sha256(text), comparison.sha256); assert.equal(comparison.coreSha256, comparison.sha256);
      assert.equal(checksum(text), comparison.checksum); assert.equal(comparison.coreChecksum, comparison.checksum); assert.equal(Buffer.byteLength(text), comparison.bytes);
      save.state.visible = save.state.visible.map(cells => cells.sort((a, b) => a - b));
      save.state.explored = save.state.explored.map(cells => cells.sort((a, b) => a - b));
      saves.push({ nativeSha256: comparison.sha256, logSha256: sha256(JSON.stringify(save)) });
    }
    assert.equal(saves.length, expected.length); assert.equal(replies, recorded.requests); assert.equal(rejected, name === 'continuation' ? 2 : 0);
    const log = createInterface({ input: createReadStream(join(root, run, `${name}.cli-log.ndjson.gz`)).pipe(createGunzip()), crlfDelay: Infinity });
    let logged = 0, loggedSaves = 0;
    for await (const line of log) { logged++; const entry = JSON.parse(line); if (entry.input.op === 'save') { assert.equal(entry.hash, saves[loggedSaves]?.logSha256); loggedSaves++; } }
    assert.equal(loggedSaves, saves.length); assert.equal(logged, recorded.requests - rejected);
    const final = await json(`${run}/${name}.final.cli-save.json.gz`), finalText = JSON.stringify(final);
    assert.equal(sha256(finalText), saves.at(-1).nativeSha256);
    if (input.format === 'orcs-vs-fairies/session') assert.equal(JSON.stringify(final), JSON.stringify(input.game));
    checks.push({ run, process: name, publicRequests: recorded.requests, nativeSavesMatchedToComparisons: saves.length, cliHashLogEntries: logged, protocolErrors: rejected, nativeFinalSessionEqual: input.format === 'orcs-vs-fairies/session' });
  }
}
await writeFile(join(root, 'protocol-audit.json'), JSON.stringify({ status: 'passed', method: 'Read retained public CLI stdout. Recompute every native save SHA-256 and UTF-16 FNV checksum, compare to saved per-tick/core comparison records, compare sorted save SHA-256 to the CLI public hash log, and compare both process final saves to the retained native session game.', checks }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'passed', nativeSaves: checks.reduce((total, check) => total + check.nativeSavesMatchedToComparisons, 0), checks }));
