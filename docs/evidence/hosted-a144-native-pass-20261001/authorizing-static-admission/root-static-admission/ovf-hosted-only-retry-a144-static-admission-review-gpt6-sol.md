# Static admission review: hosted-only a144 retry

Admit this packet for one hosted-only execution at `a144ad3f3dddd0003f9553541908e2254f2444c6`. This is execution admission, not admission of clauses 63 or 64. Those clauses still require the fresh runtime result, audit, browser evidence, package identities, and cleanup receipt.

## Authentication

The plan is the requested 15,802-byte file with SHA-256 `7d58d49e2dbde08e6d42180cdd35ec3068f57de62a2731d0d5385323d69cac1d`. The packet manifest authenticates eight regular mode-0644 files totaling 341,112 bytes. `verification.json` is an additional redundant self-report outside that sealed list; I hashed it separately as `58796ec4c110191eb4925a66978304d2c631f6c66847c8495af944fde2225f34` and did not rely on it.

I reconstructed the selected source inventory from immutable Git objects at `a144ad3f3dddd0003f9553541908e2254f2444c6`. All 748 paths, modes, blob IDs, byte counts, and file hashes match `source-a144.json`. The tree is `ff0690aeb2fc5096180ab4e600fe4f378fb2ed87`, the aggregate source digest is `dbcd5071f68d2d00a6a20c27a366389202c2354e752f7c5d38b16cfd7e998c8d`, and the build ID is `5e49e689af13d4eef08c0760f904ad0bce2c2eebaa1144dea5d89cadecf310c0`. The source still declares SAVE version 4 and simulation revision 4.0.1.

The product scope (`src`, `public`, `tests`, package and build configuration, and entry HTML files) is byte-identical between product freeze `453c2218af9973b9eca8fb78392435bd9d46a740` and the target. Within the packet's selected-source scope, the only change from original run `473ab17642211c3610aed648ae5f813b7680edc1` is `scripts/server/verify-hosted-teams-browser.mjs`.

## Reviewed change

Commit `a144ad3f3dddd0003f9553541908e2254f2444c6`, "Allow overlapping lobby reads in hosted verification," changes one hunk in `scripts/server/verify-hosted-teams-browser.mjs` at target lines 74-76. Its saved 967-byte diff matches Git byte for byte and contains three additions and one removal. GET actions now require at least one observed request. POST actions still require one request. Response capture, response status, JSON parsing, mutation-count evidence, and downstream lobby status and data assertions remain in place.

The earlier commits in the reviewed range contain retained evidence only: `33d08ab0b2ae630a92cac1fa95576ea719733a1e` adds 9,429 lines across 17 evidence and decision files; `663f640cd7d7c5ff4f8c2160264378fdf7940398` adds 4,113 lines across six evidence and decision files; and `4b829cfe9c12c98c97419d25a8573e634df1b25d` adds 1,344 lines across 11 evidence and decision files. None changes the selected source inventory.

For ordering, the helper change introduces no concurrency or reordering. For failure handling, a GET with no observed request still fails, one or more GETs pass, and POST remains exactly one. For observability, the recorded request count and response status remain, with no log or event-order change. For stale writes, the helper writes no durable state and adds no retry or cancellation path. There is no focused regression test for the three-line change; the held hosted retry is the direct exercise.

## Runtime and execution envelope

All ten recorded runtime files match their sizes and SHA-256 values. The installed packages are Playwright 1.62.1 and Playwright Core 1.62.1. Their browser registry maps the default headless shell to revision 1234 and browser version `151.0.7922.34`. The recorded executable is 196,975,952 bytes with SHA-256 `e11fc9ce65c96313476f7ee9844b6fb6a9220fb048693cfe9eee00acf4170a9f`. Full Chromium revision 1234 is absent. The recorded version came from the prior authorized launch; this static review did not launch it.

The copied supervisor is byte-identical to the retained supervisor and hashes to `5883fb1c63a6f2d85bc1947bfb1eec15ada00097d408e7c51d7bc9090a3a6781`. It rechecks the frozen source and runtime, builds into a new destination, captures complete server and browser package hashes, compares generation-one served index, favicon, JavaScript, and CSS bytes with the package, requires two server-generation records, and rehashes the packages after verification. Fresh package hashes and the fresh browser version do not exist yet and must come from the authorized run.

The dispatcher parses as Python, requires the explicit release argument and pin-specific environment value, requires the owned checkout at the target and tracked-clean, refuses existing output paths, and rehashes prepared executables, runtime files, source files, and the preserved original artifacts. It invokes only the hosted supervisor. Its child timer is 21 minutes, followed by bounded 8-second TERM, 5-second KILL, and 1-second reap stages. Preflight and postflight hashing sit outside the child timer, so 21 minutes is not a total process wall-clock bound. Cleanup uses recorded PID and start-time identities, forbids PID 1063, and does not use process-name or port sweeps.

All four fresh output paths are absent. The owned checkout remains at `473ab17642211c3610aed648ae5f813b7680edc1` with no tracked changes, as the preparation plan requires before root moves it.

## Preserved evidence and protected root

All seven original-473 artifacts still match the plan. The result, audit, and native summary retain failed status. The failure wire records two GET `/api/lobbies` requests for one native refresh, which is the condition the old exactly-one assertion rejected. The 378,163,200-byte SQLite file remains present with SHA-256 `c2240e5d1482c09d637f3664388b7add6969e0dc1d036375fb8b8d9bb9b9111e`; the WAL and SHM identities also match. The historical package manifest equals both the failed result's package map and the audit's pre-run package map. The retry does not reuse those packages.

The prior protected-root baseline hashes to `7b5a72514815ec968654e0e569579d4868d1ecd415af92357035fa4c27b14ba9`. Its schema differs from the preparation snapshot, but PID 1063, command line, working directory, port-4173 capture, root `dist` path, and all 397 file identities are equal.

## Findings (risk)

The plan calls human 4v4 supplemental, but `verifyBrowser` runs 2v2, 3v3, then 4v4 before the cooperative and restart/spectator targets, and it propagates any 4v4 error. A 4v4-only failure would therefore stop the run before it produces evidence for clauses 63 and 64. This does not block the controlled execution because it cannot create a false pass, but it can make the run inconclusive. Root must keep 4v4 supplemental and must not treat it as a new acceptance requirement.

The helper change has no focused automated regression test. The fresh hosted run exercises the failing path through the mounted UI and records the observed count, so this gap does not block the single retry.

## Admission boundary

The runtime targets are clause 63's cooperative coordinated-opponent observation and clause 64's delayed player/team spectators plus zero-delay live spectator and restart persistence. Human 4v4 remains supplemental. The packet authorizes no canonical or daily rerun, no ledger or status update, and no new acceptance gate. After execution, root must inspect the actual result, audit, native evidence, controller configuration, execution receipt, package identities, browser identity, protected-root comparison, cleanup state, and preserved original hashes before admitting either clause.

Reviewer: GPT-6 Sol in Codex. Method: static file and Git-object reads, SHA-256 hashing, JSON parsing, and Python AST parsing only. No build, test, server, browser, simulation, project-module execution, checkout move, or repository write was performed.
