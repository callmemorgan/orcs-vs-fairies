The final packet passes independent static review. No remaining discrepancy was found in the owned source, recorded installed-file identities, command arguments, bounds or fresh output paths. Execution remains held under root's release authority; this review admits no runtime evidence for original IDs 21–30.

Reviewed on 2026-10-01T22:43:16.513821+00:00 in Codex by GPT-6. A finer model variant is not exposed in this session. The reviewer used standalone Python, Git object reads, file reads, streaming hashes and installed manual pages. Neither packet script was run by this reviewer. This report is the only reviewer-authored write during this final packet review.

## Packet identities

Every recorded file size and SHA-256 in packet-hashes.json matches the actual bytes. The JSON documents were parsed with duplicate-key rejection. The packet-hashes.json SHA-256 is `31fff9084309bccd37d54e9129819745c03a45904e0bd1c36896d78d61f44288`.

| File | SHA-256 |
| --- | --- |
| inspect-readiness.py | `61f2e43ebdf5ddd6b2fba1e649384c22a8e54b05eba177329bd175bfb6f902a9` |
| link-dependencies-after-release.py | `645388e58fb84101d5a702ee2834b5a2194e8f4b31cbb9afe5085498b19924ba` |
| readiness.original-f66.json | `f66b6604836d95aaf2dc91f5472d9b7836d7a568d5d2b57c6743b506d3cdee2f` |
| readiness.json | `0d7a478d77c42b5294cb629ea9f469428bd069aa2213f6396efea9206f7bf538` |
| readiness-explicit-checks.json | `8e9552a5ab25edd58cfc4a1521ef9510972546f0b601907ca9043fdfb56131cf` |
| static-recheck-first-failure.txt | `0e75081cc400e1cb2e0fcca976ce763650abe25c82401f3025f6f7b0c32742b4` |
| execution-plan.json | `1a016cc87733db44fb71c39630825ae7a73c929910ce255efa7033dd22ca0626` |
| README.md | `201921dd1be0a154e6e9ada97a83683ab4e2e73f7863048935a7623d84754937` |

The preserved original readiness differs from readiness.json only in dependencyPlan.method: the current text states the package-write policy without implying filesystem read-only enforcement. The explicit-check receipt retains the same owned identities and installed fingerprints while recording the later root acceptance-file difference. The first failed static root-equality recheck is retained; no runtime phase failed or ran.

## Source and environment

The owned checkout `/home/morgana/.codex/worktrees/faction-economy-cleanup/orcs-vs-Fairies` remains clean at `827496b06bb660b6639257e5113ac2f199be29ba`, tree `0ba9d13ae4c7de9819cec4150e5085e0daf6752d`. Independent complete comparisons checked 591 distinct live files against recorded byte counts, SHA-256, Git blob identities and executable modes. The complete live inventories contain 163 src files, 394 public files and 22 acceptance files. All 568 product inputs retain product freeze `453c2218af9973b9eca8fb78392435bd9d46a740`.

All seven import entries match separate guard `881dff253f0392c0e539efe21af744ed2a57b214`. Six match immutable recipe `0bd7d51476cd855505b91ce76b232795afae867f`; source `906e0bd25577a9d99473c88cc50e71700235754a` retains the original recipe bytes. The driver differs solely by the reviewed ASCII question mark in the hostile replay wait. The three retained approved helpers still match pre-import target `8b96f5197adf5b4ddfa160c2fe5a550afdf7e9d8`. The [earlier import and local wait review](/tmp/ovf-faction-seven-file-import-453-8b96-20261001/independent-import-and-local-replay-wait-review.md) remains unchanged at SHA-256 `e6f478b54931236b10939e182c9c9c20ede512b889810381d30e19ea08ef8eb4`.

The per-worktree sparse pattern remains `/*` followed by `!/docs/evidence/`. No source, public or acceptance inventory entry is omitted. Root record provenance is separate from execution. The latest explicit-check receipt records root `f18a50d904c57ae1652f157b946ebd39d8d8923c`; the independent later read at root `202b739fb398d1f94fd2c53f659e10860eba3fc6` confirms all 568 selected product entries still match owned commit 827. Root's direction-defense-fixtures.ts has changed, and its recorded blob difference matches the live root tree. The checker records that difference while strictly requiring the owned 22 proof entries and owned 568 product entries. Every execution command still uses the owned checkout and pin.

All 186 installed-file fingerprints match after 323,492,439 bytes were streamed and hashed. These cover seven package manifests, the esbuild module and native binary, Node/npm, systemd-run, the selected Chromium executable, and complete Playwright inventories of 62 and 111 files. Installed manifest versions match the owned lockfile: TypeScript 5.9.3, Vite 7.3.6, esbuild/platform binary 0.28.2, Vitest 4.1.11, Phaser 4.2.1 and ws 8.22.0. Both Playwright packages are 1.62.1. ESBUILD_BINARY_PATH is unset. Package-manifest authentication establishes recorded versions; it does not authenticate every file in those seven packages.

Playwright metadata expects Chromium revision 1234, while the selected executable is under chromium-1243. The plan supplies the recorded explicit executable override. Browser launch, its actual version and compatibility remain unobserved by this review and must be recorded by the authorized native run.

## Held execution and findings

The complete supervisor argument arrays match all eight phase commands, source pins, environment values, unit names, cwd and stdout/stderr/receipt paths. The eight README shell blocks also parse to those same argument arrays. Focused tests select 21 existing files, one worker and a 30-second per-test timeout. The browser command explicitly ends in factions; the existing default direction,capture,specialists remains unchanged in the pinned wrapper. Helper, fixture, freeze and history argument order matches the pinned wrapper contracts.

Phase active-runtime caps are 600, 600, 300, 300, 600, 600, 3600 and 600 seconds. Each phase uses Type=exec, a 30-second startup cap, a 10-second stop grace and KillMode=control-group. Installed systemd documentation supports the specified wait, pipe, collect and timeout behavior. The preview uses its unique owned unit, strict loopback port 5298 and a 4500-second active-runtime cap, starting after freeze and before the browser. Cancellation stops the exact service unit; stopping only the systemd-run client is insufficient. Planned receipts retain raw output and results before collection. These are reviewed instructions and limits, not measured timings or proof that execution succeeded.

The release and provenance checks in both packet scripts now use explicit require/if branches that raise RuntimeError; Python optimization cannot remove them. The linker strictly resolves and validates every selected top-level package target inside the declared installed node_modules root before target.mkdir. It creates a real private top-level directory and package links without installing packages or writing their source bytes. No current top-level source symlink was found. The symlinks permit later package writes, so the plan's unchanged-package policy remains a command restriction. Vite's installed source places .vite and .vite-temp caches under the private owned directory for this configuration.

Ordering remains serial. A guard failure is reported before the inspector's exclusive output write or the linker's directory creation. Link creation errors remain visible and may leave a partial private directory, which the fresh-target guard prevents overwriting on retry. Observability changes are explicit guard errors and recorded root acceptance differences. New shared-package writes are none in the authored scripts. Tests for these packet-only changes are none; AST inspection and independent checks of the actual file/tree/hash/path values supplied the static verification. The later runtime receipts, native equality checks, original downloads and screenshot inspection remain required under the existing acceptance recipe.

The reserved evidence parent `/home/morgana/.codex/worktrees/faction-economy-cleanup/faction-native-827-20261001-r1` remains a real empty directory. All helper, fixture, browser, freeze, preflight, log and receipt paths are absent, and owned node_modules is absent. The review created no dependency links, copies, build outputs, fixtures, application imports, tests, simulations, browsers, services or servers. It changed no root checkout, index, ledger, trail, protected port or dist. Root alone releases execution and admits resulting evidence.
