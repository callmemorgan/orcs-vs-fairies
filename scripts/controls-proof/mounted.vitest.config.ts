import assert from 'node:assert/strict';
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const requestedOutput = process.env.OVF_PROOF_MOUNTED_OUTPUT;
assert(requestedOutput && isAbsolute(requestedOutput), 'Set OVF_PROOF_MOUNTED_OUTPUT to a fresh absolute output directory');
assert(existsSync(requestedOutput), 'Create a fresh mounted output directory with mktemp -d before running');
const output = realpathSync(requestedOutput);
assert(statSync(output).isDirectory(), 'Mounted output must be a directory');
assert(relative(root, output).startsWith(`..${sep}`), 'Mounted proof output must be outside the checkout');
assert(!output.includes('/docs/evidence/'), 'Historical evidence must remain immutable');
for (const name of ['.vite', 'mounted-observations.json', 'vitest-results.json']) assert(!existsSync(join(output, name)), `Use a fresh mounted output directory: ${name} exists`);
assert(readdirSync(output).every(name => name.endsWith('.log')), 'Use a fresh mounted output directory; only an open log may already exist');

// Run with --configLoader runner so Vite never bundles this config into shared node_modules/.vite-temp.
export default defineConfig({
  root,
  cacheDir: join(output, '.vite'),
  optimizeDeps: { noDiscovery: true, include: [] },
  test: {
    include: ['scripts/controls-proof/mounted.test.ts', 'tests/minimap-level-focus.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    reporters: ['default', 'json'],
    outputFile: { json: join(output, 'vitest-results.json') },
    attachmentsDir: join(output, 'attachments'),
    deps: { optimizer: { client: { enabled: false }, ssr: { enabled: false } } },
  },
});
