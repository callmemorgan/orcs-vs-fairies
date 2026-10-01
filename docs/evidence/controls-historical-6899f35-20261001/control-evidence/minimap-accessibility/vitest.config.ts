import { defineConfig } from 'vitest/config';
export default defineConfig({ cacheDir: 'control-evidence/minimap-accessibility/.vite', test: { include: ['control-evidence/minimap-accessibility/*.test.ts'], fileParallelism: false, reporters: ['default', 'json'], outputFile: { json: 'control-evidence/minimap-accessibility/vitest-results.json' } } });
