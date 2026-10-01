import { chromium as installedChromium } from '/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

export const chromiumExecutablePath = '/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

export const chromium = new Proxy(installedChromium, {
  get(target, property, receiver) {
    if (property === 'launch') {
      return (options = {}) => target.launch({ ...options, executablePath: chromiumExecutablePath });
    }
    return Reflect.get(target, property, receiver);
  },
});
