# World portable proof review

Verdict: admit `6318229a030f2bc2c83ecf95d73d30fca96a033e`, required correction `f79b8e46f9ee61f44efd0666c0cefdd1c7f7cfee`, and private-rebuild follow-up `9d32c5cada6d3515b1f999cecd16964b93320e9b` in that order. The final chain resolves the stale-bundle, source-inventory, and executable replacement findings. Final browser, CLI, mod, and editor execution remains pending the final assembled source freeze.

I performed this review with GPT-5.6 Sol. I pinned the range at parent `80628d73047041bfd796ab23a9073cb1c7110c1a` and tip `9d32c5cada6d3515b1f999cecd16964b93320e9b`.

## Findings (risk)

No unresolved findings remain in the two-commit chain.

The first commit trusted an injected source label in each native bundle. I proved that a bundle compiled from root `c386a9c`, with four source files different from `6318229`, passed the neutral fixture after receiving the `6318229` label. The first commit also used Git diff status for world scripts without checking each live file against its pinned Git blob. `f79b8e46` is required; do not import `6318229` alone. `9d32c5c` is also required because it executes the private fresh compilation instead of reopening the prepared bundle path after verification.

The remaining limit is execution coverage. The new authenticated preparation, generated fixtures, neutral native continuation, and focused fault cases passed independently. The full frozen browser, packaged CLI, mod, community content, and editor recipe has not run on the final assembled root.

## Per-commit review

`6318229` adds current SAVE4 fixtures and native verification for world, content-mod, community-content, and editor paths. The native verifier checks a complete session roundtrip, complete replay playback, checkpoint seeking, and 20 continued ticks. The CLI verifier exercises an underground traversal, 200 CLI ticks, a SAVE4 reload, 20 resumed ticks, and CLI log replay. Browser drivers retain downloaded native saves and build reports and compare the current save and replay envelopes. No production source file changes.

`f79b8e46` replaces label-only bundle checks with authenticated preparation and execution. `worldSourceProof` now reads the exact `scripts/world` tree and named world helper paths from Git, requires regular non-symlink files, compares every live helper byte to its Git blob, rejects hidden index flags, and checks the on-disk inventories for `src`, `public`, controls helpers, minimap helpers, and world helpers (`scripts/world/proof-common.mjs`, changed hunk at lines 9-61).

Preparation compiles four named modules, records the esbuild version and options, records each compiler input, hashes the bundle and metafile, rechecks source, and writes an exclusive manifest and receipt in a new directory (`scripts/world/prepare.mjs`, added lines 1-18). The unbundled launcher first authenticates itself and its two imported helpers against Git. It verifies the retained receipt and module inventory, rebuilds the selected module in a temporary directory with the recorded compiler version, requires byte and input equality, executes the prepared module synchronously, and repeats the source and preparation checks afterward (`scripts/world/run-native.mjs`, added lines 8-36). The bundled check requires the source pin, full source digest, receipt, named bundle hash, and fresh rebuild hash (`scripts/world/proof-common.mjs`, changed hunk at lines 114-123).

The correction also requires empty fresh module, fixture, CLI, browser, mod-fixture, and mod-browser directories. It separates generated mod fixtures from browser evidence and verifies their bundle against the retained preparation (`scripts/mods/scenario.ts`, changed hunk at lines 11-15; `scripts/verify_mods.mjs`, changed hunks at lines 7-20). It gives the world-actions browser run its own default directory. `git diff --check` and JavaScript syntax checks pass.

`9d32c5c` executes the private bundle produced in the launcher's new temporary directory. The child verifies that its own executable path equals the launcher-supplied private path and that its bytes equal the authenticated prepared module (`scripts/world/proof-common.mjs`, changed hunk at lines 119-124). After the child exits, the launcher rechecks the private executable and prepared bundle, removes the temporary directory, and writes a binding receipt with source, compiler, preparation, manifest, input, prepared bundle, executed bundle, and exit data (`scripts/world/run-native.mjs`, changed hunk at lines 23-43). This removes the prepared-path replacement interval between verification and execution.

## Independent verification

I created detached checkout `/tmp/ovf-world-correction-review.MUw1bw` at `f79b8e46`. Fresh preparation authenticated 162 source files, 393 public assets, seven configuration files, 15 shared proof scripts, seven canonical tests, and 17 world proof files. It compiled four modules with 50, 50, 50, and 54 authenticated inputs. The receipt, manifest, four bundles, and four metafiles all match their recorded SHA-256 values.

The authenticated launcher generated all four browser fixtures in a fresh directory. It then verified the neutral fixture through complete replay and 20 identical continued ticks. The generated fixture and native proof both record source digest `40e670e9d8a94a570675680974afe5f6d96ff75c5e412ae90572e7bbbe503339`, the retained receipt, the manifest hash, and bundle bytes equal to a fresh rebuild.

Four independent fault cases rejected as intended. A same-label bundle with rewritten bundle, manifest, and receipt hashes failed because its bytes differed from the fresh compile. Reusing the fixture output failed because it was nonempty. Reusing the module directory failed for the same reason. Marking an input `skip-worktree` failed the hidden-index check, and adding an untracked file under `scripts/world` failed the exact inventory check. Logs and generated artifacts are under `/tmp/ovf-world-correction-review.MUw1bw/independent`.

I then created detached checkout `/tmp/ovf-world-private-rebuild-review.g1kriz` at `9d32c5c`. Fresh preparation, four-fixture generation, neutral full replay, and 20-tick continuation passed. Both child records identify executable paths under private `/tmp/ovf-world-rebuild-*` directories. Their prepared and executed hashes match, the launcher receipts match the hashes printed in the logs, and the launcher removed both private executables after writing the result. Direct execution of a prepared module rejected, and a same-label prepared bundle with rewritten sidecars still rejected before execution.

I also audited the owner's final aggregate at `work/verification/world-save4-bundle-binding-final/preparation-proof.json`. All four fixture-native runs and the tick-200 CLI session record complete roundtrip and replay equality plus 20 identical continued ticks. Eight launcher binding receipts match their files and state that the private executables were removed. `fault-proof.json` records eight expected rejections, including a real stale bundle compiled from `c386a9c` with current pin and digest labels, original and rewritten receipt cases, hidden Git state, extra world input, and reused output directories. The module input counts and bundle hashes match the independent reproduction.

## Behavioral interrogation

Ordering: preparation compiles the four modules serially, then rechecks source before writing the manifest and receipt. The launcher verifies preparation, performs a fresh compile, rechecks source, runs the private rebuild synchronously, and rechecks source, prepared bytes, and private executed bytes after exit. It writes the binding receipt only after a zero child exit. Browser driver ordering is unchanged except that output freshness is checked before browser work.

Failure paths: compiler, source, receipt, inventory, fresh-build, child status, or post-run failures reject the command. The launcher always removes its temporary rebuild directory. Browser drivers retain failure JSON or screenshots where they already did and finalize their manifests from the failed result. No new rejection is swallowed.

Observability: preparation records source hashes, source digest, compiler version and options, bundle and metafile hashes, and compiler inputs. Native results record the source digest, receipt hash, manifest hash, prepared path, and private executed bundle hash. Each successful launcher call writes a separate binding receipt. Browser and fixture records retain the existing functional checks and now point to distinct fresh output directories.

Stale writes: module and feature output directories must be empty. Individual reports use exclusive writes where the driver creates a final named artifact. The launcher rejects extra prepared files, executes a private rebuild, and repeats source, receipt, manifest, prepared-module, and executed-module checks after native execution. Binding receipts use unique directories and exclusive writes. The same-label stale-bundle, direct-prepared-execution, and reused-output probes exercise these guards.

Test delta: these proof helpers have no dedicated unit test file. Independent preparation, fixture generation, native replay/continuation, exact-inventory, hidden-index, stale-bundle, and fresh-output probes passed. The full frozen recipe remains the final regression check and is still pending.
