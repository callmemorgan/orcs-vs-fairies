import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = '/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies';
const paths = {
  wrapper: `${root}/work/final-ai-prep/proof-envelope.mjs`,
  frozenDriver: `${root}/work/final-ai-prep/followup-453c221-r4.sh`,
  adaptedDriver: `${root}/work/ai-save401-final-453c221-r1/launcher/followup-453c221-r4-chromium1243.sh`,
  adapter: `${root}/work/ai-save401-final-453c221-r1/launcher/playwright-chromium-1243.mjs`,
  playwrightIndex: '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  playwrightPackage: '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json',
  chromium: '/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
};
const expected = {
  wrapper: 'bb8c80fc33ca6a25e044a5df60350030bb2177461d265025b9bfcffcdc3a1cd2',
  frozenDriver: 'af8b95dfba349f6dbf67809902248203281469cb3a75e18dda77e37ee86ba747',
  adaptedDriver: '49721f151fd5cb98b80b5143c850c67051d7abe22b1deb1625f3a5932be65f9f',
  adapter: '7fe266503ffb4a65da331e6ae3fa7ffa248f805595dcb5e417a7669fc73bbd6d',
  playwrightIndex: 'a0f5715ea22354f922791a9c53dc012d5d5c067ff9cc4cd35ffb7cd272071a9f',
  playwrightPackage: 'ca170ec143a88ed3043ac953eb3b2377b2b97304104f4e1e23316684ce2c35af',
  chromium: '8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

for (const [name, path] of Object.entries(paths)) {
  assert.equal(sha(await readFile(path)), expected[name], `${name} bytes changed`);
}
const playwrightPackage = JSON.parse(await readFile(paths.playwrightPackage, 'utf8'));
assert.equal(playwrightPackage.version, '1.62.1');

const { chromium: installedChromium } = await import(paths.playwrightIndex);
const originalLaunch = installedChromium.launch;
let captured;
Object.defineProperty(installedChromium, 'launch', {
  configurable: true,
  writable: true,
  value: async options => {
    captured = options;
    return 'stub-browser';
  },
});
try {
  const adapter = await import(`${paths.adapter}?static-check=${Date.now()}`);
  assert.equal(adapter.chromiumExecutablePath, paths.chromium);
  assert.equal(adapter.chromium.name(), installedChromium.name());
  const result = await adapter.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  assert.equal(result, 'stub-browser');
  assert.deepEqual(captured, {
    headless: true,
    args: ['--disable-dev-shm-usage'],
    executablePath: paths.chromium,
  });
} finally {
  delete installedChromium.launch;
  assert.equal(installedChromium.launch, originalLaunch);
}

console.log(JSON.stringify({
  result: 'passed',
  browserLaunched: false,
  playwrightVersion: playwrightPackage.version,
  delegatedToSameInstalledChromium: true,
  capturedLaunchOptions: captured,
  hashes: expected,
}));
