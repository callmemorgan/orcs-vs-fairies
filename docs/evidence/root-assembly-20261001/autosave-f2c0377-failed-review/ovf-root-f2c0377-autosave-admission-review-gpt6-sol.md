One blocking finding prevents exact retention admission of `f2c03771e63cc940467e11b4ad7bfbdd57ad160b`: five compiled app files named by the retention manifest are absent from the commit. The requirement 90 evidence itself is internally consistent, every other copied artifact and source comparison passed, and the ledger edit is correct, but the committed packet does not contain the 69 files and 11,181,643 bytes it claims to retain.

# Scope and method

I reviewed the single clean commit `f2c03771e63cc940467e11b4ad7bfbdd57ad160b` against parent `523f395e45a3823482fffae0dd774bd834c6b63f`. `HEAD` resolves to the reviewed commit and the merge base is the parent. The commit changes 73 files: 71 additions and two modifications, all under `docs/`. Product source, public assets, scripts, configuration, and entry HTML are unchanged.

I created fixed zero-context and contextual diffs, confirmed the known-negative search returned no match, and then read the committed Git blobs rather than relying on the working tree. I also compared the retained records with their frozen source directory and the immutable `453c2218af9973b9eca8fb78392435bd9d46a740` public tree. I did not run a build, browser, game, server, validator, TypeScript, or repository module. I opened the four retained screenshots and inspected them directly. I made no repository changes.

# Findings (risk)

## Five compiled app files were not committed

The retention manifest declares 69 files totaling 11,181,643 bytes (`f2c0377`, `docs/evidence/autosave-453c221-passed-20261001/retention.json`, added hunk `+1–2668`, lines 7–8). It includes these five compiled app paths at lines 214–233:

- `prepared/dist/assets/main-BxMb13AF.js` — 2,454,689 bytes
- `prepared/dist/assets/main-CxCO6VnC.css` — 77,477 bytes
- `prepared/dist/editor.html` — 454 bytes
- `prepared/dist/favicon.ico` — 32,038 bytes
- `prepared/dist/index.html` — 500 bytes

None of those paths exists in the `f2c0377` Git tree. The committed `raw/` tree contains 64 manifest-listed files totaling 8,616,485 bytes, leaving 2,565,158 declared bytes outside the commit. All five files still exist in the frozen source directory and match the recorded sizes and SHA-256 values. `git check-ignore -v` shows that the repository-wide `dist/` rule ignored every missing destination, which explains why ordinary staging skipped them.

This contradicts the README statement that "all other packet files, generated native modules, compiled app entries and the favicon are retained" (`f2c0377`, `docs/evidence/autosave-453c221-passed-20261001/README.md`, added hunk `+1–13`, line 9). It also prevents the committed evidence tree from preserving the browser build that produced the accepted run. Once the source worktree is removed, the app bundle, stylesheet, HTML entries, and compiled favicon bytes cannot be recovered from this commit.

Force-add the five files at the manifest paths and amend or follow with a corrected admission commit. Their current source bytes already match the manifest, so no rerun or manifest rewrite is needed.

# Checks that passed

The packet manifest has 461 entries and its committed SHA-256 is `49a163b153ca8faf0019230cb00e7a7718acbdaef928e8a84262a5c65d636472`. All 461 frozen source files match its recorded sizes and hashes. The inventory divides into 68 selected packet files plus 393 compiled public copies; `packet-manifest.json` records the first 68 and is the sixty-ninth retained file. The 393 external copies all match both their frozen compiled bytes and the corresponding blobs in the immutable `453c221` public tree. The five missing files belong to the selected retained set, not the external public-copy set.

Every one of the 64 present retained files matches `retention.json` and its frozen source. Both independent review copies match their manifest records and source files. The prior root integration review directory contains its two listed copies plus its retention manifest; the committed bytes match the accepted `/tmp` sources, including review SHA-256 `000db3bde66a48240005731bb375bea4ad81c21abfdf2d72dd1743a9491e94f3` and audit SHA-256 `9416ccda28e7a51793a31eda3d58d6e3f3e45e1771819ec493d81da3cef2df3c`.

The retained browser result is bound to product/source pin `453c221` and proof pin `9e5fd2340b9a0823d1ab9f566c52b947a094278e`. It records six passed checks, an empty page-error array, empty console-error array, no failed requests, no HTTP errors, and browser closure (`f2c0377`, `docs/evidence/autosave-453c221-passed-20261001/raw/autosave-browser-r1/browser-proof.json`, added hunk `+1–3260`, lines 3–4, 17–18, 216–219, and 230). The four screenshots show the named save, 30-second autosave setting, current and previous autosave rows, recovery state, and the empty fresh-context list with its one-minute default.

The wrapper record contains seven child steps, all with exit code zero, and records successful cleanup, an empty port, and unchanged frozen bytes (`f2c0377`, `docs/evidence/autosave-453c221-passed-20261001/raw/autosave-runtime-r1/run.json`, added hunk `+1–161`, lines 9–111 and 158–159). The three native reports each record SAVE4, rules `4.0.1`, current decoding, complete envelope and replay checks, analysis and technology timing checks, 100 advancing continuation ticks, six accepted continuation commands, and the four continuation equality checks. The retained inspection has 4,747 passed checks and no failure. The original blank context line at line 4 of `wrapper-adaptation.patch` was preserved and was not treated as an error.

The failed C074 evidence directory has the same Git tree object at the parent and tip. The retained record continues to say that its second console string is individually unattributed; this review does not assign either historical string to a resource.

# Ledger review

The semantic requirements diff changes only ID 90. It moves from `in-progress` to `verified` and adds five evidence paths (`f2c0377`, `docs/features/requirements.json`, hunks `@@ -988 +988 @@` and `@@ -994 +994,6 @@`; final lines 985–1000). Every cited path exists at the tip. No other requirement object changes.

The decisions file preserves all parent bytes and appends one row (`f2c0377`, `docs/features/decisions.tsv`, hunk `@@ -225,0 +226 @@`). The final ledger contains 63 verified requirements and 37 in progress. The commit message has the required Codex/GPT-6 footer.

# Behavioral interrogation

Ordering: none. Failure paths: none. Observability: none. Stale writes: none. This commit changes retained evidence and ledger metadata, not product behavior. Test delta: no new execution occurred during this review; I authenticated the recorded browser, wrapper, and native results. The missing compiled files are a retention failure rather than an untested behavior change.

# Admission decision

Do not accept `f2c0377` as the final self-contained evidence admission in its current form. The requirement 90 status change and evidence results need no behavioral correction, but the five manifest-listed build files must be present in Git before the retention and README claims are true.
