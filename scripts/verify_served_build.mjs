import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [url, output, staticDir = 'dist'] = process.argv.slice(2);
if (!url || !output) throw new Error('Usage: node scripts/verify_served_build.mjs URL NEW_OUTPUT_JSON [STATIC_DIRECTORY]');
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceHash = createHash('sha256');
for (const file of (await readdir('src', { recursive: true })).map(String).filter(file => /\.(ts|css)$/.test(file)).sort()) {
  sourceHash.update(file); sourceHash.update(await readFile(resolve('src', file)));
}
const response = await fetch(url, { cache: 'no-store' });
assert.equal(response.status, 200);
const html = await response.text();
const pagePath = new URL(url).pathname;
const localHtml = await readFile(resolve(staticDir, pagePath === '/' ? 'index.html' : `.${pagePath}`), 'utf8');
assert.equal(html, localHtml, 'Served HTML differs from the current production build.');
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]);
assert(assets.some(file => file.endsWith('.js')), 'The page has no production script.');
const hashes = await Promise.all([...new Set(assets)].map(async file => {
  const served = await fetch(new URL(file, url), { cache: 'no-store' });
  assert.equal(served.status, 200);
  const bytes = Buffer.from(await served.arrayBuffer()), local = await readFile(resolve(staticDir, `.${file}`));
  assert.deepEqual(bytes, local, `Served ${file} differs from the current production build.`);
  return { path: file, bytes: bytes.length, sha256: sha(bytes) };
}));
const report = { url, capturedAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceSha256: sourceHash.digest('hex'), sourceDiffSha256: sha(execFileSync('git', ['diff', 'HEAD', '--', 'src'])),
  htmlSha256: sha(html), assets: hashes };
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
