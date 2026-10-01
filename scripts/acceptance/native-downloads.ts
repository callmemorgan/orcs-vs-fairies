import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';

export type DownloadFingerprints = Record<string, { bytes: number; sha256: string }>;

export function authenticatedDownloadPath(directory: string, filename: string) {
  assert(typeof filename === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(filename), 'Native download uses a safe JSON basename');
  assert.equal(basename(filename), filename, 'Native download cannot contain a path');
  const root = resolve(directory), path = resolve(root, filename);
  assert(path.startsWith(`${root}${sep}`), 'Native download remains in its evidence directory');
  return path;
}

export function readAuthenticatedDownload(directory: string, filename: string, downloads: DownloadFingerprints) {
  const path = authenticatedDownloadPath(directory, filename);
  assert(downloads && Object.hasOwn(downloads, filename), `Original browser fingerprint is required for ${filename}`);
  const fingerprint = downloads[filename];
  assert(Number.isSafeInteger(fingerprint.bytes) && fingerprint.bytes > 0);
  assert.match(fingerprint.sha256, /^[0-9a-f]{64}$/);
  const status = lstatSync(path); assert(status.isFile() && !status.isSymbolicLink(), `Native artifact ${filename} is a regular retained file`);
  const bytes = readFileSync(path); assert.equal(bytes.length, fingerprint.bytes, `${filename} retained download size`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fingerprint.sha256, `${filename} retained browser download hash`);
  return { bytes, path };
}
