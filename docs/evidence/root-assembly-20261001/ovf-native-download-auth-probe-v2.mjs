import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { readAuthenticatedDownload } from '/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/scripts/acceptance/native-downloads.ts';

const root = '/tmp/ovf-native-download-auth-probe-v2';
await mkdir(root, { recursive: true });
const bytes = Buffer.from('{"ok":true}\n');
await writeFile(`${root}/valid-save.json`, bytes);
await writeFile('/tmp/ovf-native-download-auth-outside-v2.json', bytes);
try { await symlink('/tmp/ovf-native-download-auth-outside-v2.json', `${root}/linked-save.json`); } catch (error) { if (error.code !== 'EEXIST') throw error; }
const fingerprint = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
assert.deepEqual(readAuthenticatedDownload(root, 'valid-save.json', { 'valid-save.json': fingerprint }).bytes, bytes);

const cases = [
  ['relative traversal', '../ovf-native-download-auth-outside-v2.json', { '../ovf-native-download-auth-outside-v2.json': fingerprint }],
  ['absolute path', '/tmp/ovf-native-download-auth-outside-v2.json', { '/tmp/ovf-native-download-auth-outside-v2.json': fingerprint }],
  ['symlink', 'linked-save.json', { 'linked-save.json': fingerprint }],
  ['missing fingerprint', 'valid-save.json', {}],
  ['changed byte count', 'valid-save.json', { 'valid-save.json': { ...fingerprint, bytes: fingerprint.bytes + 1 } }],
  ['changed hash', 'valid-save.json', { 'valid-save.json': { ...fingerprint, sha256: '0'.repeat(64) } }],
];
const rejected = [];
for (const [label, name, downloads] of cases) {
  let error;
  try { readAuthenticatedDownload(root, name, downloads); } catch (caught) { error = caught; }
  assert(error, `invalid case was accepted: ${label}`);
  rejected.push({ label, name, message: String(error.message) });
}
assert.equal(rejected.length, cases.length);
console.log(JSON.stringify({ validRead: true, attemptedInvalidCases: cases.length, rejected }, null, 2));
