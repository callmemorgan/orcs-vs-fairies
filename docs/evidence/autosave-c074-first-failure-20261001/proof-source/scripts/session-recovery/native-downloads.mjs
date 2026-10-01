import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function fingerprint(bytes) {
  assert(bytes instanceof Uint8Array, 'Native download bytes are a Buffer or Uint8Array');
  return { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function authenticatedDownloadPath(directory, filename) {
  assert(typeof filename === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(filename), 'Native download uses a safe JSON basename');
  assert.equal(basename(filename), filename, 'Native download cannot contain a path');
  const root = resolve(directory), path = resolve(root, filename);
  assert(path.startsWith(`${root}${sep}`), 'Native download remains in its evidence directory');
  return path;
}

export function readAuthenticatedDownload(directory, filename, downloads) {
  const path = authenticatedDownloadPath(directory, filename);
  assert(downloads && Object.hasOwn(downloads, filename), `Original browser fingerprint is required for ${filename}`);
  const original = downloads[filename];
  assert(original && typeof original === 'object', `Original browser fingerprint is required for ${filename}`);
  assert(Number.isSafeInteger(original.bytes) && original.bytes > 0, 'Native download fingerprint has a positive byte count');
  assert(typeof original.sha256 === 'string' && /^[0-9a-f]{64}$/.test(original.sha256), 'Native download fingerprint has a SHA-256 hash');
  const status = lstatSync(path);
  assert(status.isFile() && !status.isSymbolicLink(), `Native artifact ${filename} is a regular retained file`);
  const bytes = readFileSync(path);
  assert.equal(bytes.length, original.bytes, `${filename} retained download size`);
  assert.equal(fingerprint(bytes).sha256, original.sha256, `${filename} retained browser download hash`);
  return { bytes, path };
}

// Authenticate a retained browser download immediately before an offline audit.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [, , directory, filename, receiptPath] = process.argv;
  assert(directory && filename && receiptPath,
    'Usage: node native-downloads.mjs EVIDENCE_DIR NATIVE_FILENAME BROWSER_RECEIPT');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const native = readAuthenticatedDownload(directory, filename, receipt.downloads);
  console.log(JSON.stringify({file: filename, authenticated: true, ...fingerprint(native.bytes)}));
}
