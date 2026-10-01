import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {defineConfig} from 'vitest/config';

assert(process.env.OVF_PROOF_TEST_OUTPUT,'Set OVF_PROOF_TEST_OUTPUT to an isolated output directory');
const out=resolve(process.env.OVF_PROOF_TEST_OUTPUT);
export default defineConfig({cacheDir:join(out,'cache'),test:{
  include:['tests/appearance.test.ts','tests/display-settings.test.ts','tests/gamepad.test.ts',
    'tests/minimap-alerts.test.ts','tests/minimap-level-focus.test.ts','tests/session-storage.test.ts','tests/session-tools.test.ts'],
  reporters:['default','json'],outputFile:{json:join(out,'results.json')},attachmentsDir:join(out,'attachments'),
}});
