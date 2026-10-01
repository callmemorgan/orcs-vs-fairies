# Fresh faction execution readiness at 827, attempt r2

The owned checkout is clean and pinned to `827496b06bb660b6639257e5113ac2f199be29ba`, tree `0ba9d13ae4c7de9819cec4150e5085e0daf6752d`. All 568 product inputs, 394 public assets, 22 acceptance modules, seven imported files and three approved helpers match their recorded identities. The original sparse pattern remains unchanged. Only two exact tracked historical JSON test inputs have been restored with ignore-skip-worktree-bits; their before/after identities are retained in historical-input-materialization.receipt.json. The remaining historical archive stays omitted. Do not reapply sparse checkout before execution; the strict preflight authenticates these inputs and 21 selected tests plus 95 reachable local files.

The original r1 focused phase is preserved at /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r1. Its three ENOENT failures came from these omitted inputs before feature assertions. No r1 browser proof or feature failure is inferred. Its source, dependency and protected-root cleanup passed; its heavy slot was released. This r2 is a fresh attempt and remains held until root releases it.

The required inputs are docs/evidence/rules-3.1-replay-20261001/replay.json (91,710 bytes, SHA-256 c13bbe05dea85d4e2a3d3f6c7f40ca470490eb4e10f704ed2de3e05a018e62d0) and docs/evidence/controls-final-af44da4-20261001/gamepad/gamepad-native-session.json (142,075 bytes, SHA-256 91ae02c1fc5b43c37257a31f8594ca98b291d10a58158b06038615bd7d7241ca). They match the existing 827 Git blobs. Product, tests and original assertions are unchanged.

Execution remains held. Root currently owns dispatch. The reserved evidence parent is empty; helpers, fixtures, browser output and freeze file do not exist.

## Dependencies and supervisor

Installed locked dependencies retain the original installed-readiness-baseline.json identity. The fresh receipt is readiness-r2.json. The project has no owned dependencies yet. After release, `link-dependencies-after-release.py` creates a private owned node_modules directory and links packages without changing installed package bytes. Vite .vite and .vite-temp caches then stay in the owned checkout. No installation, copy or link was performed during preparation.

Use Node `/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node`. Set OVF_PLAYWRIGHT_MODULE to `/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs` and OVF_CHROMIUM_EXECUTABLE to `/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`. Playwright 1.62.1 expects revision 1234; the installed executable is revision 1243, so the override is explicit and actual browser identity must be recorded during the run. ESBUILD_BINARY_PATH remains unset.

The installed systemd 262 user manager is running. Each phase uses an exact owned transient service, a startup cap of 30 seconds, TERM then SIGKILL after 10 seconds, and KillMode=control-group. This covers detached browser descendants. The browser active-runtime cap is 60 minutes. RuntimeMaxSec does not include startup or stop grace. No unit has been started.

## Held serial recipe

The exact argument arrays, environment, output paths and phase bounds are in `execution-plan.json`. First run the static inspector into a fresh preflight receipt while the evidence parent is still empty. Then create logs and the held package links. Run each phase to its recorded result before starting the next. Start the owned strict-port preview after freeze and before the browser. Stop the exact active and preview units on cancellation or failure. Retain --wait output/exit before --collect unloads them.

01-focused-tests has an active-runtime cap of 600 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-01-focused-tests --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=600s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node node_modules/vitest/vitest.mjs run tests/faction-systems.test.ts tests/faction-tools.test.ts tests/faction-save-semantics.test.ts tests/faction-economy-interruption.test.ts tests/captured-illusion-definition.test.ts tests/captured-gravecaller-definition.test.ts tests/captured-gravecaller-grove.test.ts tests/captured-summon-rules.test.ts tests/joint-combat-integration.test.ts tests/joint-trophy-ownership.test.ts tests/joint-world-ignition.test.ts tests/joint-special-surrender-fire.test.ts tests/economy-cargo-integration.test.ts tests/economy-cancellation.test.ts tests/terrain-economy.test.ts tests/world-interruptions.test.ts tests/team-observation.test.ts tests/online-render-state.test.ts tests/saves.test.ts tests/replays.test.ts tests/save4-rule-revision.test.ts --testTimeout=30000 --maxWorkers=1
```

02-client-build has an active-runtime cap of 600 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-02-client-build --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=600s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/lib/node_modules/npm/bin/npm-cli.js run build
```

03-cli-build has an active-runtime cap of 300 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-03-cli-build --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=300s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/lib/node_modules/npm/bin/npm-cli.js run build:cli
```

04-helpers has an active-runtime cap of 300 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-04-helpers --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=300s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node scripts/acceptance/build-native-helpers.mjs /home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/helpers 827496b06bb660b6639257e5113ac2f199be29ba
```

05-fixtures has an active-runtime cap of 600 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-05-fixtures --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=600s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node scripts/acceptance/generate-native-fixtures.mjs /home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/helpers/fixtures.mjs /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/fixtures 827496b06bb660b6639257e5113ac2f199be29ba
```

06-freeze has an active-runtime cap of 600 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-06-freeze --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=600s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node scripts/acceptance/verify-native-acceptance.mjs --freeze /home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/fixtures /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/freeze.json 827496b06bb660b6639257e5113ac2f199be29ba
```

07-faction-browser has an active-runtime cap of 3600 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-07-faction-browser --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=3600s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node scripts/acceptance/verify-native-acceptance.mjs http://127.0.0.1:5298 /home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/browser /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/fixtures /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/freeze.json /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/helpers/audit.mjs factions
```

08-native-history has an active-runtime cap of 600 seconds.

```sh
/usr/bin/systemd-run --user --wait --pipe --collect --unit=ovf-faction-827-r2-08-native-history --working-directory=/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies --property=Type=exec --property=RuntimeMaxSec=600s --property=TimeoutStartSec=30s --property=TimeoutStopSec=10s --property=KillMode=control-group --setenv=PATH=/home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin:/home/morgana/.local/bin:/usr/bin:/bin --setenv=OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs --setenv=OVF_CHROMIUM_EXECUTABLE=/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome -- /home/linuxbrew/.linuxbrew/Cellar/node@24/24.21.0/bin/node scripts/acceptance/verify-native-history.mjs /home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/helpers/audit.mjs /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/fixtures /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/browser 827496b06bb660b6639257e5113ac2f199be29ba /home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r2/freeze.json
```

The preview argv is retained in the plan. Record its MainPID, ControlGroup, raw output and readiness, and close it after the browser/history phases. Confirm port 5298 has no remaining listener; protected port 4173 stays untouched.

The original eight phase caps and preview cap are unchanged. Existing browser and native-history final frozen-source, dist, served-asset and helper checks remain required. No additional feature gate is added.

Original planning estimates are 16–26 minutes plus screenshot inspection, with 10–20 minutes for native controls. These are unmeasured estimates. The outer browser cap is 60 minutes because individual gameplay waits allow about 42 minutes and 109 checkpoints add persistence work. A timeout retains incomplete evidence and stops the recipe.

Inspect every screenshot and original download before independent admission. Use the full integrated 827 pin for helper, fixture, freeze, browser and history wrappers. Preserve recipe 0bd, source 906, guard 881 and product 453 as historical identities. Root alone updates requirements or decisions.

Prepared by Codex/GPT-6. Git/file/package/binary inspection and read-only manager/port checks only. No dependency population, build, browser, game, tests, fixture producer, application imports, preview, server or transient service execution.
