# Fresh SAVE4 mode and objective proof

Wait for the final committed source pin before preparation or execution. The preparation command requires a full Git commit, checks source and proof scripts against committed blobs, bundles the native verifiers from those pinned inputs, and builds the ordinary Vite app and canonical authoritative server into a fresh output root. The runtime and browser runners reject changed source, scripts, modules or build files.

## Run from the frozen source

Use a detached checkout, an independent dependency installation, a fresh output root and an unused local port. Set `OVF_PLAYWRIGHT_MODULE` to an installed Playwright module if Playwright is outside the project.

```sh
: "${OVF_FINAL_SAVE4_PIN:?Set the full frozen source pin}"
proof_checkout="$(mktemp -d /tmp/ovf-modes-frozen.XXXXXX)"
git -C /home/morgana/Projects/orcs-vs-Fairies worktree add \
  --detach "$proof_checkout" "$OVF_FINAL_SAVE4_PIN"
cd "$proof_checkout"
npm ci
proof_root="$(mktemp -d /tmp/ovf-modes-proof.XXXXXX)"
export OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
node scripts/modes/prepare.mjs "$OVF_FINAL_SAVE4_PIN" "$proof_root"
node scripts/modes/run.mjs "$OVF_FINAL_SAVE4_PIN" "$proof_root" 9241
```

Preparation performs no natural-match or browser proof. The runner executes five natural objective matches, starts its owned server, drives the primary app in three fresh browser profiles, verifies both downloaded native sessions, and closes the server. A repeated or interrupted run needs a new output root. Historical evidence directories remain separate from these fresh outputs.

## What the proof establishes

The runtime uses public match creation, AI, stepping, native saves and replay APIs. It requires hill duel, relic duel, contested relic and hill 2v2 victories while an opposing headquarters remains alive. Survival must defeat five spawned waves and resume four recovery checkpoints. Every case resumes a persisted checkpoint at tick 300. It compares complete save envelopes on every resumed tick, requires each resumed segment to advance, and compares the continued recorder histories. Persisted final saves and sessions must decode and resave to the complete original envelope. Full playback from the replay start, recomputed analysis and technology timings, and endpoint seeking must also agree.

The browser driver retains its existing main-app checks: Lantern Keepers rules and exact starter, local human/AI draft completion, objective-modal input blocking while ticks advance, normal minimap and Phaser movement, hill marker/HUD, replay export/import, photo launcher visibility, two real online guests, both lobby picks, and accepted relic collect/drop command receipts. It downloads a native custom-match session and a native bug report through SessionTools. The bug report identifies the running build, save schema and simulation revision. The shared native checker validates the complete `.game`, replay endpoint, analysis and technologies, then compares loaded and replayed branches through six accepted commands and 100 normal ticks and verifies both extended histories.

The shared controls provenance helper pins source, configuration and public assets. The modes wrapper additionally pins every mode proof script, the main browser driver and the canonical server builder. Preparation records verifier input metadata and bundle hashes. Runtime embeds the source pin and source/configuration digest and checks the executing bundle against the prepared inventory. The browser compares primary HTML, observed response bytes, and every compiled JavaScript/CSS chunk against the frozen local build before and after the run. The launcher records the server package hashes and the path, SHA-256 and PID of the process it starts. The isolated server package receives a recorded `node_modules` link to the checkout's installation because its canonical builder leaves `ws` external. Final inventories follow process cleanup and completed logs.

## Output and limits

Review `run.json`, `runtime/runtime-results.json`, `browser/browser-proof.json`, both `native/*.verification.json` files, screenshots, native downloads, logs, `final-manifest.json` and `final-hashes.tsv`. Open the captured screenshots and check the saved artifacts before certifying the result.

The natural matches establish the five named configurations. The main browser flow establishes controls, presentation and real server command handling; it does not wait for a browser objective victory. The photo check establishes launcher hiding. Replay seeking is to the endpoint. The native continuation exercises the captured custom match through core APIs; those continuation commands are separate from browser input. Installed dependencies and the complete machine environment are not pinned by the source manifest. These drivers must run after the final freeze; preparation checks alone do not certify SAVE4 gameplay.
