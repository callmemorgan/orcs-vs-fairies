import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['scripts/ai/team-regression.test.ts'],fileParallelism:false}});
