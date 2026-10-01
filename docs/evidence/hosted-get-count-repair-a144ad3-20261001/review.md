# Static review of the hosted GET-count candidate

No source-scope or assertion defect found. The candidate applies to `scripts/server/verify-hosted-teams-browser.mjs` from base `473ab17642211c3610aed648ae5f813b7680edc1`. Root `4b829cfe9c12c98c97419d25a8573e634df1b25d` still has the same 48,236-byte Git blob with SHA-256 `d844ab8547cbfc186ab98f62f727f7df46317c8e86a603e70fe11966fe59a30a`, so the candidate has the same applicability there.

The candidate diff has SHA-256 `e43a69496f3860d8f21a94bdf5186c9d19539fd1635aaf8b49f2221f31ccaf8a`. The complete candidate file is 48,361 bytes with SHA-256 `6c7757471a8435ef8ec3459e10a2114d7dd4e7d5907712c0cf2f1ab8fd650b8e`. It replaces one assertion in `uiResponse`, at the single `@@ -71,7 +71,9 @@` hunk.

The helper still records the response status, parsed data, and observed request count, then returns the same `{ status, data }` outcome. GET actions now require at least one observed matching request. Every non-GET action, including guest creation, lobby creation, join, ready, and start POSTs, still requires exactly one matching request.

The rest of the verifier is byte-identical. Existing caller checks remain, including GET status 200, guest POST status 200, lobby creation status 201 and returned lobby data, join/ready/start status and 409 handling, ownership rejection, accepted allied transfer and bank changes, enemy-transfer rejection, spectator restrictions, team visibility, coordinated AI observation, and restart receipt/bank assertions. The candidate changes proof observation strictness for idempotent GET requests only; it does not relax the gameplay assertions used for original requirements 61–64.

The failed run result is 188,459 bytes with SHA-256 `9e8677bf8b3c85ceef6a5c86c7c5a85df568db028fde849069408097dfd129bb`. Its failure is the old exact-count assertion, `2 !== 1`. The retained failure wire has SHA-256 `6d1954af04651220996b3e5335c1b2f67749078ef24169ed31dfe5243c379af4`. Actor `4v4-side-3` records one successful guest POST with count 1 and one successful `GET /api/lobbies` with status 200 and count 2. It has no hello, command, receipt, or error before the failure. Every POST recorded in that failure wire has count 1.

`OnlineLobby.ts` can start periodic `refresh()` without acquiring the `run` busy state, while the manual refresh button calls `run(refresh)`. A poll begun before the manual click can therefore overlap the clicked GET. The retained wire has no per-request timestamps or initiators, so it cannot establish that this caused the second request. The candidate does not depend on that attribution; it requires at least one idempotent GET and preserves the observed count.

The preparation records a successful `node --check`, but this review authenticated that receipt rather than rerunning it. No module import, runtime, browser, build, test, server, dependency, checkout, or source edit was performed. Runtime success remains unproved.

The first audit is preserved at `/tmp/ovf-hosted-get-count-candidate-473-static-review-audit-first-gpt56-sol.json`. It had a false failure from an incorrect selector substring condition in the audit logic; the Git source hash and refresh mechanisms matched. The corrected audit is `/tmp/ovf-hosted-get-count-candidate-473-static-review-audit-gpt56-sol.json`.
