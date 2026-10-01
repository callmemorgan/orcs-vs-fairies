#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const [reportFile, outputDirectory] = process.argv.slice(2);
if (!reportFile || !outputDirectory) throw new Error('Use node scripts/tournaments/verify-runtime-parity.mjs TOURNAMENT_JSON NEW_OUTPUT_DIRECTORY.');
const output = path.resolve(outputDirectory), root = process.cwd();
await mkdir(path.dirname(output), { recursive: true }); await mkdir(output);
const entry = path.join(root, 'scripts/tournaments/parity-entry.ts');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: path.join(output, 'parity-node.mjs') });
await build({ entryPoints: [entry], bundle: true, platform: 'browser', format: 'iife', outfile: path.join(output, 'parity-browser.js') });
const { checkReplay } = await import(pathToFileURL(path.join(output, 'parity-node.mjs')).href);
const report = JSON.parse(await readFile(reportFile, 'utf8'));
const browserBundle = await readFile(path.join(output, 'parity-browser.js'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const coreSources = await Promise.all((await readdir(path.join(root, 'src/core'))).filter(file => file.endsWith('.ts')).sort()
  .map(async file => ({ path: `src/core/${file}`, sha256: sha256(await readFile(path.join(root, 'src/core', file))) })));
const server = createServer((request, response) => {
  if (request.url === '/parity.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(browserBundle); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><title>Replay runtime parity</title><script src="/parity.js"></script></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { chromium } = await import(process.env.OVF_PLAYWRIGHT_MODULE ?? '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true });
const evidence = { node: process.version, browser: browser.version(), reportSha256: sha256(await readFile(reportFile)), coreSources,
  entrySha256: sha256(await readFile(entry)), nodeBundleSha256: sha256(await readFile(path.join(output, 'parity-node.mjs'))),
  browserBundleSha256: sha256(browserBundle), servedBrowserBundleSha256: null, matches: [] };
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  evidence.servedBrowserBundleSha256 = await page.evaluate(async () => {
    const bytes = await (await fetch('/parity.js')).arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  });
  if (evidence.servedBrowserBundleSha256 !== evidence.browserBundleSha256) throw new Error('Browser served a different parity bundle.');
  for (const match of report.matches) {
    const nodeResult = await checkReplay(match.replay);
    const browserResult = await page.evaluate(archive => window.tournamentParity(archive, true), match.replay);
    await writeFile(path.join(output, `${match.id}.node.json`), JSON.stringify(nodeResult) + '\n');
    await writeFile(path.join(output, `${match.id}.browser.json`), JSON.stringify(browserResult) + '\n');
    if (JSON.stringify(nodeResult) !== JSON.stringify(browserResult)) {
      const first = nodeResult.tickHashes.findIndex((hash, index) => hash !== browserResult.tickHashes[index]);
      throw new Error(`Node/browser divergence in ${match.id} at tick ${first}.`);
    }
    evidence.matches.push({ matchId: match.id, ticksChecked: nodeResult.tickHashes.length, finalTick: nodeResult.finalTick,
      allTickHashesEqual: true, finalHash: nodeResult.finalHash, savedContinuationEqual: true, checkpointSeeksEqual: true });
    console.log(JSON.stringify(evidence.matches.at(-1)));
  }
  await writeFile(path.join(output, 'summary.json'), JSON.stringify(evidence, null, 2) + '\n');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
