# Code review handoff: fc7c04d..703fc03 (AI839 retention, combat clause admissions, online verifier import)

## Scope and method

The review target is `fc7c04d37b43c6896565e9dfa0d4ff318060065d..703fc036c6327a830a79d5746eec805188cbbaa6` on branch `codex/100-features`. The working tree was clean and HEAD was `703fc03`. The range has four commits. The ledger rows below are matched to commits by timestamp.

| Commit | Committed (UTC) | Subject | Ledger row | Verified count after |
| --- | --- | --- | --- | --- |
| `b7fde8c` | 2026-10-02 00:18:37 | Retain AI839 runtime and verify cooperative skirmishes | `decisions.tsv:252` | 70 |
| `9024c59` | 2026-10-02 00:19:37 | Complete AI839 packaged evidence retention | `decisions.tsv:253` | 70 |
| `5b95400` | 2026-10-02 00:29:11 | Retain combat failure and verify original combat clauses | `decisions.tsv:254` | 74 |
| `703fc03` | 2026-10-02 00:35:47 | Verify remaining combat clauses and correct online proof comparison | `decisions.tsv:255`, `:256` | 78 |

The authoritative result is the saved `/code-review xhigh` report. It reviewed the four pinned commits and nothing later. It ran no builds, tests, browsers, servers, simulations, databases or codecs. It reported 15 findings, and all 15 appear below in the report's order. I have kept the report's claims as written. Where my own spot-check found a file says something slightly different, the finding says so.

To quote evidence for this handoff, I did a second round of bounded read-only lookups at HEAD, which is the same as `703fc03`. I used `git log` for commit timestamps and Read, Grep and Glob on the specific lines cited. That round confirmed nearly every cited line. It also found two places where the report's wording goes slightly further than the files support (findings 8 and 15). I did not open any SQLite file, raw megabyte payload or screenshot.

The session's don't-ask permission mode denied one Bash call I made while preparing this handoff. It was a `wc -c` / `ls` listing of evidence file sizes and directory contents, and I used Glob, Read and Grep instead. The saved review report does not mention any tool denials, so I can't tell whether the reviewer hit any.

Security review was skipped by request scope. See the "Security findings" section.

The original 100-feature text is not in the repository. `docs/features/requirements.json:3` names its source as "User-provided pasted-text-1.txt", and a Glob for `**/pasted-text-1.txt` found nothing. So every clause comparison below uses the requirement strings recorded in `requirements.json`, which the project says preserve the user's wording. If the pasted original differs, those comparisons need to be redone.

## What checked out

The review found that all retained hashes match their receipts. That covers the feature-63 artifacts, the combat clause reviews, the three remaining-clause copies, and the imported online verifier. The verifier is byte-identical to the reviewed candidate (sha256 `110669533d317e3d…`, 27,634 bytes per `root-online-verifier-import.json:12-13`). The review counted 253 AI839 files and 351 combat files tracked in Git, with no ignored files left untracked in either packet.

The full39 combat failure is preserved and not relabelled. The combat importer asserts it directly at `native-combat-f18a50d-first-failure-20261001/root-import.py:73`: `assert len(browser['downloads']) == 148 and len(browser['checks']) == 84 and not browser['completed']`. Its receipt outcome string is "Stage06failed after84checks;zero completedgroups;39encountersopen;07/08unrun". The packet README (`README.md:5`) repeats that the batch remains failed with stages 07 and 08 not run.

The online six-check partial failure is also preserved and not relabelled. It appears in `assembled-allied-ai-83941bc-runtime-r1/root-retention.json:2607` ("Failed after6partialchecks; candidate retained only"), in `root-online-verifier-import.json:18` ("Original online run remains failed after six partial checks"), and in `decisions.tsv:256` ("no product/runtime or status change;online originalfailed6partialchecks"). The verifier import changed no feature status.

Feature 6 (cover) stays in progress because ruins have no simulation geometry (`root-original-clause-admission.json:13`, `:20`). The review did not challenge that. For features 2, 5 and 7 the review raised no clause-specific issues. The only findings touching them are the cross-cutting ones about retention control and reviewer attribution.

## Clause summary

| ID | Requirement as recorded in `requirements.json` | Moved to verified in | Admission basis (abridged) | Review outcome |
| --- | --- | --- | --- | --- |
| 1 | arrange troops into lines, wedges, squares or loose skirmish groups. | `703fc03` | Four formation simulation tests plus happy-dom panel tests | Findings 2, 14 |
| 2 | reward attacks against an enemy's sides and rear. | `5b95400` | Native front/side/rear 12/15/18 plus passing test | No issues found |
| 4 | isolated or badly damaged squads can retreat or surrender. | `703fc03` | Isolated-wounded retreat and morale-1 surrender tests | Findings 2, 3 |
| 5 | shield units protect troops standing behind them. | `5b95400` | Native guard 6.8 vs 17, turned/rear bypass | No issues found |
| 7 | careless artillery placement can hurt your own army. | `5b95400` | Native allied impact 19.6 enabled, 0 disabled | No issues found |
| 8 | build impact through movement, with pikes stopping the charge. | `5b95400` | Native charge 29.4 vs 15; pike half from unit test only | Finding 10 |
| 9 | defeat their crews and claim the equipment. | `703fc03` | Crew-kill and capture simulation test | Finding 2 |
| 10 | conceal troops and set conditions for revealing them. | `703fc03` | Ambush simulation test plus panel dispatch test | Finding 2 |
| 63 | human teammates fight coordinated computer opponents. | `b7fde8c` | 14-check browser co-op run plus later same-match AI frames | Findings 1, 4, 5 |

## Correctness findings

### 1. Feature 63 is verified by joining two windows that do not overlap

Location: `docs/features/requirements.json:832` (entry spans `:828-843`). The admission is `docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-feature63-admission.json`, with ledger row `decisions.tsv:252`.

The requirement says "human teammates fight coordinated computer opponents." The evidence comes from two different parts of one match. Humans play through the browser only until about tick 408. The only coordinated action recorded is six AI units switching from idle to `attackMove` between frames 3324 and 3328, all aimed at side 1's HQ at (47.5, 16.5). That is roughly 2,900 ticks after the last recorded human input, and there is a later checkpoint at 4040. The run's own result file disclaims coordination:

```
docs/evidence/assembled-allied-ai-83941bc-runtime-r1/actual/coop-ui/results.json:292
"This proves human co-op, shared team vision, and autonomous combat from both AI opponents. It does not prove synchronized AI waves or a shared target planner; the current AI makes per-player decisions."
```

The packet README admits the gap but still calls the feature verified:

```
docs/evidence/assembled-allied-ai-83941bc-runtime-r1/README.md:5
The browser capture ends around tick 408; coordination records are later same-match evidence.
```

The ledger justification (`decisions.tsv:252`) is "Two human teammates and the same-match coordinated AI records satisfy the original cooperative-skirmish sentence." Nothing recorded shows the humans fighting while the AI acted in coordination. The admission is satisfied only by putting the two halves together.

I confirmed the `results.json` limit text and the README line. The frame numbers, target coordinates and tick gap come from the review report, and I did not re-derive them (that would mean opening the SQLite). Confidence in the facts is high. Confidence that this fails the clause is moderate to high, because it depends on how strictly the project reads "fight".

Suggested fix: return feature 63 to `in-progress` until one recorded window shows human commands during or after a coordinated AI action. One way is to extend the human browser session past the coordinated attack, or to trigger coordinated AI behaviour while both humans are commanding, and record both in one result. The other is to narrow the admission to what was shown and get the user to accept that narrower reading explicitly.

Safe verification: `git show 703fc03:docs/evidence/assembled-allied-ai-83941bc-runtime-r1/actual/coop-ui/results.json | grep -n 'does not prove'`. Then read the tick and frame fields in `root-feature63-admission.json` and `control/closing/coordination-admission.json` with a bounded `head` or `jq` on specific keys. Do not open `server.sqlite`.

### 2. Features 1, 4, 9 and 10 were verified without executed in-game proof against the current UI

Location: `docs/features/requirements.json:9` for feature 1. The status lines for features 4, 9 and 10 are at `:51`, `:118` and `:133`. The admission is `docs/evidence/native-combat-f18a50d-first-failure-20261001/root-remaining-clause-admission.json:8-19`, with ledger row `decisions.tsv:255`.

The project's own completion rule is at `docs/features/README.md:3`:

```
A file, option, or passing unit test alone does not make a feature complete: it must be reachable through the game, work through its real simulation or service path, and have evidence covering its stated behavior.
```

The panel evidence is a happy-dom test that mounts `TacticsTools` against a fake host:

```
tests/tactics-tools.test.ts:1   // @vitest-environment happy-dom
tests/tactics-tools.test.ts:20  const tools=mountTacticsTools(root,{state:()=>state,selected:()=>selected,side:()=>side,command,enabled:()=>permission,keyFor:action=>bindings[action]});mounted.push(tools);tools.open();
```

The real mount is a different call with different wiring:

```
src/main.ts:378  const tacticTools=mountTacticsTools(root,{toolbar:sessionToolbar,state:()=>scene?.state??null,selected:()=>scene?.selected??[],side:playerSide,enabled:()=>scene?.canIssueCommands??false,command:c=>scene?.command(c)??false});
```

According to the review, that mount was read but never run. The only in-game browser run predates the current panel, and the ledger itself calls it "corroboration" (`decisions.tsv:255`: "the old browser run is corroboration"; result column: "41 recorded assertions read;no fresh tests"). The native batch's capture group, which would cover ambush and capture, never ran because stage 06 failed first. Feature 4 has no in-game evidence of any kind.

To be fair to the admission: executed assertions do exist. They come from the earlier combined-rules suite at `testedPin` `4a71cd07…` (`root-remaining-clause-admission.json:20`). The admission also asserts `"coreTestsAndCurrentPanelDiffEmpty": true` and `"currentMainMatchesNativeF18": true` (`:22-23`). The gap is in-game execution of the current panel, not the absence of tests.

The practical risk is that a regression in the `main.ts` mount path would not be caught by any cited evidence, for example the toolbar wiring, the `enabled` flag, or `playerSide`. Confidence in the facts is high. Confidence that this breaks the project's bar is moderate: the panel is reachable in code, and someone could read the README rule as satisfied by reachability plus simulation tests.

Suggested fix: hold 1, 4, 9 and 10 in progress until a browser run against the current build exercises formation selection, an ambush order with its reveal condition, a crew kill followed by capture, and a morale retreat or surrender. Alternatively, record an explicit, user-approved exception to the README rule.

Safe verification: `git diff --stat 4a71cd0 703fc03 -- src/main.ts src/ui/TacticsTools.ts src/core/tactics.ts tests/combat-tactics.test.ts tests/tactics-tools.test.ts`. This shows whether `main.ts` changed between the tested pin and the admission. The admission only claims that core tests and the panel are unchanged, and I did not run this.

### 3. The feature-4 admission does not cover "isolated or badly damaged squads"

Location: `docs/evidence/native-combat-f18a50d-first-failure-20261001/root-remaining-clause-admission.json:16`, which cites `tests/combat-tactics.test.ts:44-54`.

The admission basis reads "Actual passed isolated wounded retreat and surrounded broken surrender cases with real simulation steps and ownership controls." The tests are:

```
tests/combat-tactics.test.ts:45  const alone=fixture(),fighter=unit(alone,0,'melee',25.5,25.5);fighter.hp=fighter.maxHp*.5;fighter.tactics!.morale=28;unit(alone,1,'melee',28.5,25.5);...
tests/combat-tactics.test.ts:47  const supported=fixture(),supportedFighter=unit(supported,0,'melee',25.5,25.5);supportedFighter.hp=supportedFighter.maxHp*.5;supportedFighter.tactics!.morale=28;unit(supported,0,'spear',25.5,27.5);...
tests/combat-tactics.test.ts:48  expect(supportedFighter.tactics!.retreat).toBeUndefined();expect(supportedFighter.tactics!.morale).toBeGreaterThan(28);
tests/combat-tactics.test.ts:52  const s=fixture('dwarves','fairies'),broken=unit(s,0,'ranged',24.5,24.5);broken.hp=30;broken.tactics!.morale=1;...
```

The test sets morale to 28 by hand, and retreat happens only when the unit is both isolated and at half health. A half-health unit with an ally next to it does not retreat (line 48). The surrender case sets `morale=1` directly, so no executed case shows morale falling through combat until a unit surrenders. The requirement says "isolated or badly damaged", and neither branch is shown alone. The admission also treats single units as "squads" without saying so.

For context, not as a separate finding: the code has damage-driven and death-driven morale loss at `src/core/tactics.ts:138` (`t.morale=Math.max(0,t.morale-damage/target.maxHp*65)`) and `:142`. The mechanism exists, but the admitted tests start from preset morale and never run it end to end.

Confidence in the test content is high. Confidence in the clause reading is moderate. The supported-fighter result could be a deliberate design choice, and in that case the requirement wording should be reconciled with the user rather than tested differently.

Suggested fix: add executed cases where (a) a badly damaged unit with allies nearby loses morale through real damage and retreats or surrenders, or the design choice that support prevents this is recorded and accepted; (b) an isolated, undamaged unit retreats; and (c) a unit reaches surrender through real damage or nearby deaths instead of `morale=1`. Then update the admission basis.

Safe verification: read `tests/combat-tactics.test.ts:44-54` and the retreat and surrender thresholds in `updateTactics` from `src/core/tactics.ts:144` on. Don't run the tests during review.

### 4. The AI839 reviewer identity is stated without qualification

Location: `docs/evidence/assembled-allied-ai-83941bc-runtime-r1/README.md:5`. Related lines are `review/review.md:3`, `review/audit.json:2-3` and `docs/evidence/native-combat-f18a50d-first-failure-20261001/import-review/review.md:3`.

```
assembled-allied-ai-83941bc-runtime-r1/review/review.md:3      Reviewer: GPT-5.6 Sol in Codex
assembled-allied-ai-83941bc-runtime-r1/review/audit.json:2-3   "reviewer": "GPT-5.6 Sol in Codex",
                                                               "review_type": "different-family file-only closing review of executed 839 retry",
assembled-allied-ai-83941bc-runtime-r1/README.md:5             GPT-5.6 Sol passed 41 static review checks with no findings.
native-combat-…/import-review/review.md:3                      Reviewer: `gpt-5.6-sol`
```

None of these records where the model identity came from. In the same window, the clause peer review shows that the same `gpt-5.6-sol` spawn override did not take effect:

```
native-combat-…/clause-peer-review/model-attribution-addendum.md:5
The parent requested `gpt-5.6-sol` when spawning this task. The active model was OpenAI GPT-6.1 Sol.
```

The combat packet README (`README.md:7`) and `root-online-verifier-import.json:19` ("requested different-family override is not independently established") both disclose this limit. The AI839 README and the feature-63 admission, which cites `review/review.md` as evidence in `requirements.json:840`, do not. Every root receipt in the range names its producer as `"model": "GPT-6"` (for example `root-import.py:89`). As the review notes, GPT-5.6 and GPT-6.x are both OpenAI models, so even a correct label would not make this a cross-family review.

Confidence is high that the label is unsupported, since no identity source is recorded. It is an inference, not a proven fact, that this particular AI839 review ran as GPT-6.1: the concurrent clause review used the same override and is documented as GPT-6.1. Whether GPT-5.6 versus GPT-6 counts as "different family" depends on the project's definition.

Suggested fix: do not rewrite the original review bytes. Add an addendum beside `review/review.md` stating the requested model, the unknown or actual running model, and an identity source if one exists. Amend `README.md:5` and the feature-63 admission to say that different-family review is not established. If the project requires cross-family review for admission, complete the Claude trail review that `root-online-verifier-import.json:19` says is "scheduled separately" before treating 63 as reviewed.

Safe verification: `grep -rn '5\.6' docs/evidence/assembled-allied-ai-83941bc-runtime-r1/README.md docs/evidence/assembled-allied-ai-83941bc-runtime-r1/review docs/evidence/native-combat-f18a50d-first-failure-20261001/import-review`.

### 5. The only primary source for the coordinated-opponent frames is in a gitignored temporary worktree

Location: `docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-retention.json:2597`, produced by `root-import.py:69-74`.

```
root-retention.json:2597-2601
"path": "/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/ai-save401-final-83941bc-r1/server-data/server.sqlite",
"bytes": 309325824,
"sha256": "a29a5ba1c0cba00c719cf39679fd40183610494eac5b332d846f08660a94834e",
"identityBasis": "Previously full-read seal; current stat checked only",

root-import.py:72-74
s = source.lstat()
assert stat.S_ISREG(s.st_mode) and s.st_size == row['bytes']
external.append({... 'identityBasis': 'Previously full-read seal; current stat checked only', ...})
```

The file is in a `work/` directory, which `.gitignore:6` ignores, inside a Codex worktree. The importer checked only its size. If someone removes or cleans the `assembled-allied-ai` worktree, the frames at 3324/3328 and the checkpoint at 4040 behind feature 63 can no longer be re-derived. That conflicts with `decisions.tsv:252` ("Retain the full reviewed AI839 packet"). The retained `control/closing/root-coordination-readback.json` is a derived readback, not the source.

Confidence in the facts is high. Whether the file still exists today was not checked, because the review deliberately read no databases.

Suggested fix: move the SQLite, or a reviewed and sealed extraction of the relevant frames and checkpoint, to storage the project controls (Git LFS, an archive bucket, or a non-ignored evidence path, keeping in mind that 309 MB is heavy for plain Git). Record the new location and a full-read hash. If that can't happen soon, document in the packet README that the source is ephemeral and protect the worktree from cleanup.

Safe verification: run `stat -c '%s %y'` on the path (metadata only). Do not open, hash or copy the database as part of review.

### 6. The cause of the Git-index omission is still in place: importers never stage files or check ignore rules

Location: `docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-import.py:76`, with the same gap in `docs/evidence/native-combat-f18a50d-first-failure-20261001/root-import.py:55-63`.

```
assembled …/root-import.py:76-85
copied = []
for row in rows:
    source = pathlib.Path(row['source'])
    data = authenticated(source, row['bytes'], row['sha256'])
    target = safe(row['destination'])
    ...
    assert authenticated(target, row['bytes'], row['sha256']) == data
    copied.append({**row, 'sourceFullByteReadbackPassed': True, 'destinationFullByteReadbackPassed': True})
...
:97    'limits': plan['limits'], 'status': 'all_original_copies_full_byte_verified'
```

Both importers verify bytes on disk and then write a receipt whose status says everything was verified. Neither looks at Git. `.gitignore` contains `dist/` (line 2), `dist-server/` (line 4) and `work/` (line 6). Those patterns are unanchored, so they match at any depth, including under `docs/evidence/**/actual/`. In `9024c59` the fix was a one-time manual force-add (`root-first-index-failure.json:23`: "Explicit force-add of the exact missing allowlisted paths, then full-byte readback of all253 Git-index blobs"). The next packet with a destination under `dist/`, `dist-server/` or `work/` will pass the importer and be committed without those files.

Confidence is high.

Suggested fix: after writing, the importer should run `git check-ignore --no-index` on every destination, then `git add -f --` on the allowlist, then read every blob back from the index (`git cat-file blob :<path>`), compare size and sha256, and only then write a receipt with a passing status. A second, independent option is to anchor the ignore patterns (`/dist/`, `/dist-server/`, `/work/`) if those build directories are only expected at the repo root. Check for nested build output before doing that.

Safe verification: `git ls-files --others --ignored --exclude-standard -- docs/evidence/` should print nothing. `git check-ignore -v --no-index docs/evidence/assembled-allied-ai-83941bc-runtime-r1/actual/dist/index.html` shows which rule matches. Both are read-only.

### 7. Review directories are hashed at import time, so the source check compares each file with itself

Location: `docs/evidence/native-combat-f18a50d-first-failure-20261001/root-import.py:44`, and the related lines `:41-43` and `:57`.

```
:41  for source, relative in [(PLAN, 'import-plan/full-native-retention-plan.json'), (handoff_path, 'import-plan/reviewed-derived-handoff.json')]:
:42      data = source.read_bytes()
:43      rows.append({... 'sha256': digest(data), 'kind': 'original-plan'})
:44  for directory, relative in [('/tmp/ovf-native-combat-retention-admission-gpt56.4tvqZy', 'import-review'), ('/tmp/ovf-original-combat-admission-review-20261001-b0mYjlat', 'clause-peer-review')]:
:46      for source in sorted(base.iterdir()):
:48              data = source.read_bytes()
:49              rows.append({... 'sha256': digest(data), 'kind': 'original-independent-review'})
...
:57      data = read(pathlib.Path(row['source']), row['bytes'], row['sha256'])
:63      copied.append({**row, 'sourceFullByteVerified': True, ...})
```

For these rows, the expected hash is computed from the same file a moment before it is "verified" at `:57`, so `sourceFullByteVerified` will always be true. `iterdir()` picks up every file in the two `/tmp` directories without an allowlist. A changed review, or a stray scratch file, would be kept and labelled `original-independent-review`.

The plan and handoff rows at `:41-43` are less exposed than the report's wording suggests. They were already checked against pinned hashes at `:28` (`PLAN_SHA`) and `:37` (pinned handoff sha), so the risk for them is limited to a change between those reads and `:42`. The review directories have no pin at all. Nothing suggests any review file was in fact altered. Confidence in the mechanism is high.

Suggested fix: pin review files to hashes the reviewer recorded independently, such as the reviewer's own audit file or an explicit allowlist, and reject unexpected files. For the existing copies, there is one partial cross-check: `clause-peer-review/model-attribution-addendum.md:15-16` lists sha256 values for `original-combat-admission-review.md` and `original-combat-admission-audit.json`. The addendum has the same provenance limits (finding 15).

Safe verification: `git show 703fc03:docs/evidence/native-combat-f18a50d-first-failure-20261001/clause-peer-review/original-combat-admission-review.md | sha256sum`. The expected value, per the addendum, is `34388e20…`.

### 8. The "preserved first failure" is a summary written after the fact

Location: `docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-first-index-failure.json:2`. Related lines are `:9-14` and `:22`.

```
:2   "observedAt": "2026-10-02T00:19:03.874506+00:00",
:9   "originalFailure": {
:10    "exitCode": 1,
:11    "command": "git show :docs/evidence/…/actual/dist/assets/main-BxMb13AF.js",
:12    "stderr": "fatal: path '…/main-BxMb13AF.js' exists on disk, but not in the index"
:14  "cause": "Generic git add respected ignore rules for packaged dist and dist-server directories. …",
:22  "rootExecutionMistake": "The root orchestration continued into commit after the index validator failed. …",
```

`git log` shows `b7fde8c` committed at 00:18:37Z and `9024c59` at 00:19:37Z, so this record was written 26 seconds after the commit it describes. There is no timestamp for the failure itself and no raw log file. The cause names `dist-server` directories, but a Grep for `dist-server` in the AI839 `root-retention.json` (which lists every copied destination) returns zero matches. All four missing paths (`:17-20`) are under `actual/dist/`.

One correction to the report: it says the record has "no raw stderr", but the file does contain a one-line `stderr` string, an exit code and the command. What is missing is a raw captured log and a failure timestamp, not stderr text altogether. The timing also fits a validator that ran after the commit, which would contradict "continued into commit after the index validator failed". The record cannot settle which order happened. Confidence is moderate.

Suggested fix: append a correction (do not rewrite the record) that fixes the cause text to `dist/` only and notes that the record postdates `b7fde8c` and has no failure timestamp. In future, the validator should write raw stdout, stderr and start and end times to a file before any commit step, and the commit should depend on its exit code.

Safe verification: `git log -1 --format=%cI b7fde8c`, then compare with `:2`. `grep -c dist-server docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-retention.json` should print 0.

### 9. Every integrity check in both importers is a bare `assert`

Location: `docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-import.py:31`, along with `:22-25`, `:29`, `:36-41`, `:54-62`, `:66-67`, `:73` and `:84`. The combat importer has the same pattern at `:18-20`, `:25`, `:30-35`, `:50-53`, `:62` and `:68-77`.

```
root-import.py:28-32
def authenticated(path, size, digest):
    assert stat.S_ISREG(path.lstat().st_mode), str(path)
    data = path.read_bytes()
    assert len(data) == size and sha(data) == digest, str(path)
    return data
```

`python -O` strips assert statements. Under `-O`, size and hash mismatches, unsafe destinations and pin reachability go unchecked, yet the script still writes `'status': 'all_original_copies_full_byte_verified'` (`:97`). The receipt does not record interpreter flags. These scripts have already run and are kept as evidence, so the risk is in reusing them, and nothing suggests they ran with `-O`. Confidence in the mechanism is high. The chance it has caused a problem is low.

Suggested fix: replace the asserts with a `check(cond, msg)` helper that raises `SystemExit`, refuse to run when `sys.flags.optimize` is set, and record `sys.version` and `sys.flags.optimize` in the receipt.

Safe verification: `grep -c '^\s*assert' docs/evidence/*/root-import.py`.

### 10. The pike half of feature 8 rests on a unit test, and "consumes the charge" is not pike-specific

Location: `docs/evidence/native-combat-f18a50d-first-failure-20261001/root-original-clause-admission.json:19`. The code is `src/core/tactics.ts:131-136`.

```
root-original-clause-admission.json:19
"8": "Native moving charge grows4.9and hits29.4vsstationary15. The passed frontal holding-pike assertion cancels impact bonus, consumes charge and damages rider on unchanged code."

src/core/tactics.ts:134-135
 if(c)c.distance=0;
 return braced&&charged?{factor:1,pikeDamage:TACTICS.pikeReturn*(distanceCharged/TACTICS.chargeDistance)}:{factor:1+TACTICS.chargeBonus*(distanceCharged/TACTICS.chargeDistance),pikeDamage:0};
```

Line 134 resets charge distance after every cavalry impact, braced or not. "Consumes charge" therefore happens on every hit and is not evidence for pikes. The only pike-specific effects are cancelling the bonus (`factor:1`) and the return damage (`pikeDamage`). The native run failed before either pike fixture, so neither was observed in the game. The packet README already says so (`README.md:3`: "there is no mounted browser pike or forced movement-halt claim"). That leaves open whether "pikes stopping the charge" requires halting the rider's movement, which the implementation does not do.

Confidence in the code reading is high. Confidence on whether the clause is met is moderate.

Suggested fix: drop "consumes charge" from the pike basis. Then either hold the pike half until an in-game pike fixture runs, or record the user's acceptance that "stopping" means cancelling the bonus plus return damage rather than a movement halt.

Safe verification: read `src/core/tactics.ts:125-136`.

### 11. The verifier's `phase` label stays stale through match start and the renderer checks

Location: `scripts/verify_assembled_online.mjs:163`. The next assignment is at `:183`.

```
:163  phase='creating eight-slot lobby';
:172  await first.page.getByRole('button',{name:'Start match',exact:true}).click();await waitBattlefield(first,0);
:180  record('Player one renderer contains only authorized observations',await assertFilteredRenderer(first,0));...
:183  phase='recruiting through global production and HUD';
```

Starting the match, both clients joining, the unpause checks, the filtered-renderer assertions and the pause-control checks (`:172-182`) are all reported as "creating eight-slot lobby". The review reports that the preserved online `results.json` gives `failure.phase` as that string, even though checks 4 to 6 show the lobby was created and both clients joined. I did not read that `results.json` field myself. The import commit touched this file but left the label, so the next retry will mislabel any failure in that block in the same way.

Confidence is high.

Suggested fix: set `phase` before `:172` (for example "starting match and joining clients") and before `:180` ("checking filtered renderers"). Do not edit the preserved `results.json`. Any edit to the script changes its sha256 away from the reviewed `110669533d…`, so under this project's process the change needs its own candidate review and import receipt.

Safe verification: `grep -n "phase=" scripts/verify_assembled_online.mjs`.

### 12. The verifier makes an exception for `heroRecovery` instead of fixing the product's object shape

Location: `scripts/verify_assembled_online.mjs:101`. The product side is `src/online/render-state.ts:42-45`.

```
scripts/verify_assembled_online.mjs:101
const privatePlayer={...render.players[player]};if(privatePlayer.heroRecovery===undefined)delete privatePlayer.heroRecovery;

src/online/render-state.ts:42-44
function ownPlayer(player:Player):PlayerObservation['player'] {
  return {faction:player.faction,wood:player.wood,ore:player.ore,crystal:player.crystal,
    population:player.population,cap:player.cap,heroRecovery:player.heroRecovery?.map(recovery=>({...recovery})),upgrades:[...player.upgrades]};

src/online/render-state.ts:51-52  (existing pattern for optional keys)
function copyPoint(point:Vec):Vec {
  return {x:point.x,y:point.y,...(point.level===undefined?{}:{level:point.level})};
```

`ownPlayer()` always creates a `heroRecovery` key, set to `undefined` when there is nothing to recover. JSON on the wire drops undefined-valued keys, so the strict comparison fails on the key, not the value. The verifier now removes that one key. Any future optional `Player` field will fail the same way and need another exception.

The exception itself is narrow and was reviewed: `root-online-verifier-import.json:15` says defined and null values stay strict. This finding is about the root cause, not about the verifier change being wrong. Confidence in the mechanism is high.

Suggested fix: in `ownPlayer`, add the key only when it is defined (`...(player.heroRecovery===undefined?{}:{heroRecovery:player.heroRecovery.map(r=>({...r}))})`), the same way `copyPoint` handles `level`. Then remove the verifier exception. This is a product change, and the ledger row says "no product/runtime or status change", so it should be a separate, recorded decision with render-state tests run once running tests is allowed.

Safe verification: read the two locations above. No execution is needed to confirm the shape mismatch.

### 13. `decisions.tsv:256` puts the SHA prefix where a byte count goes, and rows 252-256 run words together

Location: `docs/features/decisions.tsv:256` (result column), and also `:252-255`.

```
decisions.tsv:256  …	Exact1106695candidate bytes imported;11 retained pure Node cases passed;…
root-online-verifier-import.json:12-13
  "sourceAfterSha256": "110669533d317e3d7440661e5457e2ef5003053506044376e9c6fc298e5a9a4a",
  "candidateBytes": 27634,
```

Someone reading the ledger would take this as 1,106,695 bytes imported. The real figure is 27,634 bytes, and `1106695` is the start of the sha256. The neighbouring rows run tokens together in the same way: `:252` "253 originals45392276bytes full-byte verified;70 verified30 in progress;online failed6 partialchecks", `:254` "341 originals99854180bytes", `:255` "78 verified22 in progress;…;full39 batch remainsfailed;ruin6held". Row 249, which is before this range, already used this style. Rows 250-251 are spaced normally ("69 verified / 31 in progress"). So the style itself is not new to this range, but the wrong number is.

The review also notes that this breaks `~/.agents/writing-style.md`, which `~/.claude/CLAUDE.md` pulls in. That file asks for plain English and specifically warns against text that "stops being English and moves into a side-English". Confidence is high.

Suggested fix: if the ledger is append-only, add a correction row. Otherwise edit row 256 to something like "Exact reviewed 27,634-byte candidate (sha256 110669533d…) imported". Space out the tokens in rows 252-256. Check which convention the project uses before editing history rows.

Safe verification: `git show 703fc03:docs/features/decisions.tsv | sed -n '252,256p'`.

### 14. The combat packet README and KNOWN_LIMITATIONS were not updated for features 1, 4, 9 and 10

Location: `docs/evidence/native-combat-f18a50d-first-failure-20261001/README.md:3` and `docs/KNOWN_LIMITATIONS.md:9`.

```
native-combat-…/README.md:3
Original features 2, 5, 7 and 8 are verified through the completed native observations and actual passing simulation assertions on unchanged core and test code. …

docs/KNOWN_LIMITATIONS.md:9
… there are no branching exclusive technologies, naval units, trading, formations, diplomacy or save/load. …
```

`requirements.json:11-12` cites this packet directory for feature 1, and the 4, 9 and 10 entries cite it the same way. The packet README mentions only 2, 5, 7 and 8. KNOWN_LIMITATIONS still says there are no formations while feature 1 is marked verified. Confidence is high.

Suggested fix: append a paragraph to the packet README, or add a README in `remaining-clause-review/`, describing the later admission of 1, 4, 9 and 10 and its limits. Remove "formations" from `KNOWN_LIMITATIONS.md:9`. If finding 2 leads to reverting feature 1, reword the line to say formations exist but are not yet verified in-game instead of saying they don't exist. Other items in that sentence are outside this review's scope.

Safe verification: `grep -n formations docs/KNOWN_LIMITATIONS.md`, and read `README.md:1-7` of the packet.

### 15. The remaining-clause copy and index readback has no producer, no blob ids and no retained script

Location: `docs/evidence/native-combat-f18a50d-first-failure-20261001/root-remaining-clause-index-readback.json:1`. The whole file is lines 1-33.

```
:1-2   {
         "observedAt": "2026-10-02T00:35:46.885163+00:00",
:3     "originalReviewCopies": [
         { "source": "/tmp/ovf-original-combat-ids1-4-9-10-review-20261001-A7n0XjYz/original-combat-ids1-4-9-10-assessment.md", … "fullByteCopyVerified": true, "gitIndexFullByteVerified": true },
         …
         { "source": "/tmp/ovf-original-combat-admission-review-20261001-b0mYjlat/model-attribution-addendum.md",
           "destination": "…/clause-peer-review/model-attribution-addendum.md", … }
:31    "canonicalOnlineVerifierExactCandidateIndexVerified": true,
:32    "status": "passed"
```

Every other root receipt in the range has a `producer` block (for example `root-remaining-clause-admission.json:3-7`). This one has none, records no Git blob ids, and has no import script retained next to it. The claims `fullByteCopyVerified` and `gitIndexFullByteVerified` therefore can't be checked against a recorded procedure. The receipt also includes an unrelated flag about the online verifier (`:31`).

The addendum's source path is in the earlier clause reviewer's `/tmp` directory (`b0mYjlat`), and it is filed under `clause-peer-review/` as if it belonged to that original review. The addendum text (`model-attribution-addendum.md:1-17`) has no author line and no date. The review report says the IDs 1/4/9/10 reviewer wrote it. I could not confirm that from the file, which describes its identity source only as "the trusted active orchestration message from the parent/root host". Confidence in the missing fields is high. The authorship claim is the reviewer's inference.

Suggested fix: append a supplementary receipt with a producer, Git blob ids for the three paths, the exact commands used, and the copy script. Add a provenance note for the addendum saying who wrote it, when, into which directory, and why it is filed under `clause-peer-review/`. Leave the original bytes unchanged.

Safe verification: `git ls-tree 703fc03 -- docs/evidence/native-combat-f18a50d-first-failure-20261001/remaining-clause-review/assessment.md docs/evidence/native-combat-f18a50d-first-failure-20261001/remaining-clause-review/audit.json docs/evidence/native-combat-f18a50d-first-failure-20261001/clause-peer-review/model-attribution-addendum.md` lists the blob ids. Then pipe each `git show 703fc03:<path>` through `sha256sum` and compare with the receipt.

## Security findings

The security review was skipped by request scope, so no security analysis was done and none is reported. Do not read that as a clean security result. Findings 6, 7, 9 and 15 deal with evidence integrity (unpinned inputs, checks that can be stripped out, receipts that can't be audited). They are filed as correctness and process issues, not security vulnerabilities. Nobody probed any live system.

## Initial Git-index omission

`b7fde8c` committed the AI839 packet without four packaged originals under `actual/dist/`, because `.gitignore:2` (`dist/`) matches at any depth and the commit used a plain `git add`. `9024c59` force-added those four paths and recorded a full-byte readback of all 253 index blobs (`root-index-readback.json`, `decisions.tsv:253`). The review confirmed that 253 AI839 files are now tracked and none are left ignored. For this packet the correction is complete and changed no original bytes.

Two problems remain. First, the importers can still produce the same omission on the next packet (finding 6). Second, the failure record is a summary written after the commit, and its cause text names `dist-server` directories that are not in the allowlist (finding 8). The combat packet used the same importer pattern. The review reports no ignored files left in it, but that came from the paths it happened to contain, not from any check in the importer.

## Model attribution limits

Every root receipt names its producer as `{"harness": "Codex", "model": "GPT-6", "agent": "/root"}`. That value is self-reported and no identity source is recorded. For the reviews:

- The AI839 closing review says "GPT-5.6 Sol" and calls itself "different-family", with no qualification and no identity source (finding 4).
- The combat import review says `gpt-5.6-sol`, also without qualification.
- The clause peer review has an addendum saying the requested `gpt-5.6-sol` override did not take effect and that the review ran as GPT-6.1 Sol.
- The remaining-clause review's attribution is listed as "different-family attribution unverified" in `decisions.tsv:255`.
- `root-online-verifier-import.json:19` states the general limit.

No review in this range has an established identity outside the root's model family, so any admission that depends on an independent different-family review is in practice relying on same-family review. Feature 63 cites such a review, while the combat admissions carry the disclaimer.

## Coverage gaps and uncertainty

The reviewer ran no builds, tests, browsers, servers, simulations, databases or codecs, and neither did I. Every "passed" mentioned here refers to recorded results from earlier runs, not to anything executed during this review.

The original 100-feature text (`pasted-text-1.txt`) is not in the repository, so the clause checks compare against `requirements.json` wording.

`server.sqlite` was not opened. The frame numbers (3324, 3328), checkpoint (4040), HQ coordinates and the roughly 2,900-tick gap in finding 1 come from the review report and retained derived files, not from re-reading the database.

The review read the pinned commits. My extra spot-check read the working tree at HEAD, which matches `703fc03` with a clean status.

My one Bash call for file sizes and directory listings was denied by the don't-ask permission mode, so I did not independently confirm the 351 combat file count or the packet file sizes. The saved review report does not say whether its own tools were restricted.

I did not check whether `src/main.ts` changed between the tested pin `4a71cd0` and `703fc03`. The admission claims only that core tests and the current panel are unchanged. Finding 2 gives the command to check this.

I did not read the preserved online `results.json` `failure.phase` field. Finding 11 relies on the review report for it.

The authorship of `model-attribution-addendum.md` comes from the review report's inference (finding 15).

## Suggested order of work

Settle the status questions first, because they change the verified count. Those are findings 1, 2, 3 and 10, which decide whether features 63, 1, 4, 9, 10 and the pike half of 8 stay verified. Next, fix the attribution records (findings 4 and 15) without touching original bytes, and make the SQLite source durable (finding 5), since feature 63's evidence depends on it. After that, harden the importers before the next packet (findings 6, 7, 9 and 8). The verifier fixes (findings 11 and 12) and the documentation fixes (findings 13 and 14) are small and independent. Finding 11 needs a new reviewed-candidate cycle because it changes the verifier's hash.

## Safe read-only commands

None of these run builds, tests, browsers, servers, simulations, databases or codecs. They work as written in fish.

```
git log --format='%h %cI %s' fc7c04d..703fc03
git show 703fc03:docs/features/decisions.tsv | sed -n '252,256p'
git show 703fc03:scripts/verify_assembled_online.mjs | sha256sum        # expect 110669533d317e3d…
git ls-files --others --ignored --exclude-standard -- docs/evidence/assembled-allied-ai-83941bc-runtime-r1 docs/evidence/native-combat-f18a50d-first-failure-20261001
git check-ignore -v --no-index docs/evidence/assembled-allied-ai-83941bc-runtime-r1/actual/dist/index.html
grep -c dist-server docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-retention.json   # expect 0
git diff --stat 4a71cd0 703fc03 -- src/main.ts src/ui/TacticsTools.ts src/core/tactics.ts tests/combat-tactics.test.ts tests/tactics-tools.test.ts
git ls-tree 703fc03 -- docs/evidence/native-combat-f18a50d-first-failure-20261001/remaining-clause-review docs/evidence/native-combat-f18a50d-first-failure-20261001/clause-peer-review/model-attribution-addendum.md
grep -n 'does not prove' docs/evidence/assembled-allied-ai-83941bc-runtime-r1/actual/coop-ui/results.json
grep -rn '5\.6' docs/evidence/assembled-allied-ai-83941bc-runtime-r1/README.md docs/evidence/assembled-allied-ai-83941bc-runtime-r1/review docs/evidence/native-combat-f18a50d-first-failure-20261001/import-review
stat -c '%s %y' /home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/ai-save401-final-83941bc-r1/server-data/server.sqlite   # metadata only; do not open
```

## Original review reports

### code-review

I reviewed the four pinned commits (`b7fde8c`, `9024c59`, `5b95400`, `703fc03`). I ran no builds, tests, runtimes or database reads. The retained hashes all match their receipts: the feature-63 artifacts, the combat clause reviews, the 3 remaining-clause copies, and the imported verifier, which is byte-identical to the reviewed candidate at sha `110669533d…`. 253 AI839 files and 351 combat files are tracked, with no ignored files left behind. The full39 combat failure (84 checks, `completed:false`) and the online six-check partial failure are preserved and not relabelled.

```json
[
  {
    "file": "docs/features/requirements.json",
    "line": 832,
    "summary": "Feature 63 is marked verified by joining two time windows that do not overlap; no recorded window shows the human teammates fighting coordinated AI.",
    "failure_scenario": "The humans only played through the browser up to about tick 408. The run's own coop-ui/results.json limit says it 'does not prove synchronized AI waves… the current AI makes per-player decisions'. The only coordinated action is six AI units switching from idle to attackMove between frames 3324 and 3328, aimed at side 1's HQ at (47.5,16.5). That happened about 2,900 ticks after any recorded human input. The original sentence 'human teammates fight coordinated computer opponents' is therefore met only by putting two separate halves together."
  },
  {
    "file": "docs/features/requirements.json",
    "line": 9,
    "summary": "Features 1, 4, 9 and 10 were promoted to verified with no executed in-game proof against the current UI code, which docs/features/README.md requires ('must be reachable through the game').",
    "failure_scenario": "The panel tests mount TacticsTools in happy-dom with a fake host (tests/tactics-tools.test.ts:20). The main.ts:378 mount was only read, never run. The only in-game browser run predates the current panel and is labelled corroboration-only. The native batch's 'capture' group, which covers ambush and capture, never ran because stage 06 failed first. Feature 4 has no in-game evidence of any kind. A regression in the real mount path would not be caught."
  },
  {
    "file": "docs/evidence/native-combat-f18a50d-first-failure-20261001/root-remaining-clause-admission.json",
    "line": 16,
    "summary": "The feature-4 admission does not cover the 'isolated OR badly damaged squads' wording. Retreat is shown only when isolation and wounds occur together, from preset morale, and surrender only from morale set to 1 by the test.",
    "failure_scenario": "In tests/combat-tactics.test.ts:45 the fighter is set to morale 28 and must be both isolated and at half health to retreat. The half-health fighter with an ally next to it explicitly does not retreat (line 47-48). The surrender case at line 52 sets morale=1, so no fight-driven morale loss leads to surrender. 'Squads' was reinterpreted as single units. No executed case shows a badly damaged unit with allies nearby retreating or surrendering."
  },
  {
    "file": "docs/evidence/assembled-allied-ai-83941bc-runtime-r1/README.md",
    "line": 5,
    "summary": "The reviewer identity 'GPT-5.6 Sol' / 'different-family' is stated without qualification, although this same window shows that the gpt-5.6-sol spawn override actually ran GPT-6.1 Sol.",
    "failure_scenario": "review/review.md:3, review/audit.json:2-3 ('different-family file-only closing review') and the combat import-review/review.md:3 ('gpt-5.6-sol') give no model-identity source. The concurrent clause reviews proved the same override did not take effect. The feature-63 admission cites review.md but omits that limit, which root-online-verifier-import.json later admits. GPT-5.6 and GPT-6.x are also the same vendor family, so the review would not be independent across families even if the label were right."
  },
  {
    "file": "docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-retention.json",
    "line": 2597,
    "summary": "The only primary source for the coordinated-opponent frames and checkpoint is a 309 MB SQLite file left inside a gitignored work/ directory of a temporary Codex worktree. The importer only checked its size with stat.",
    "failure_scenario": "Removing or cleaning the 'assembled-allied-ai' worktree deletes server.sqlite. After that, the 3324/3328 frames and the 4040 checkpoint behind feature 63 can no longer be re-derived, even though decisions.tsv:252 says 'Retain the full reviewed AI839 packet'."
  },
  {
    "file": "docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-import.py",
    "line": 76,
    "summary": "The underlying cause of the Git-index omission is still there. The importers write and verify files on disk but never stage them or check git ignore rules, and the fix was a one-time manual force-add.",
    "failure_scenario": "Any later packet whose destinations include dist/, dist-server/ or work/ (all in .gitignore) will again pass 'all_original_copies_full_byte_verified' and then be committed without those files. The combat importer (native-combat…/root-import.py) has the same gap. The general fix is for the importer to run `git check-ignore` / `git add -f` on the allowlist and read back every blob from the index before writing its receipt."
  },
  {
    "file": "docs/evidence/native-combat-f18a50d-first-failure-20261001/root-import.py",
    "line": 44,
    "summary": "Review directories (and the re-read plan and handoff) are hashed from the source at import time, so the later 'sourceFullByteVerified' check compares each file with a hash taken from the same file and proves nothing about authenticity.",
    "failure_scenario": "sorted(base.iterdir()) copies every file in the two /tmp review directories, with no pinned hashes. A changed review, or a stray scratch file, would be kept and labelled 'original-independent-review' with sourceFullByteVerified=True. The import-review/ copies have no external seal to compare against."
  },
  {
    "file": "docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-first-index-failure.json",
    "line": 2,
    "summary": "The 'preserved first failure' is a JSON summary written after the fact. It has no timestamp for the original failure and no raw stderr, and its observedAt (00:19:03Z) is later than the b7fde8c commit (00:18:37Z) it describes.",
    "failure_scenario": "Nothing in the record shows that the validator ran and failed before the commit, as its 'continued into commit after the index validator failed' claim says. Its cause also names dist-server directories, but the allowlist contains no dist-server path, so the cause text does not match the four omitted dist files."
  },
  {
    "file": "docs/evidence/assembled-allied-ai-83941bc-runtime-r1/root-import.py",
    "line": 31,
    "summary": "Every integrity check in both importers is a bare `assert`, so running them under `python -O` removes all checks and still writes a receipt saying everything was verified.",
    "failure_scenario": "With `python -O root-import.py`, size and SHA mismatches, unsafe destinations and pin reachability are never checked. The script still writes root-retention.json with 'status': 'all_original_copies_full_byte_verified', and the receipt does not record the interpreter flags used."
  },
  {
    "file": "docs/evidence/native-combat-f18a50d-first-failure-20261001/root-original-clause-admission.json",
    "line": 19,
    "summary": "The pike half of feature 8 ('pikes stopping the charge') rests only on a unit test, and its 'consumes the charge' point is not specific to pikes.",
    "failure_scenario": "The native run failed before either pike fixture. src/core/tactics.ts:134 resets charge distance to 0 after every cavalry impact, braced or not. So the only pike-specific effects are cancelling the bonus and the return damage, and neither was observed in the game."
  },
  {
    "file": "scripts/verify_assembled_online.mjs",
    "line": 163,
    "summary": "`phase` stays 'creating eight-slot lobby' through match start and the renderer assertions at line 180, so failures there are recorded under the wrong phase.",
    "failure_scenario": "The preserved online results.json gives failure.phase 'creating eight-slot lobby', even though checks 4-6 show the lobby was created and both clients joined. The import touched this file but left the label, so the next retry will mislabel any failure at line 172-182 in the same way."
  },
  {
    "file": "scripts/verify_assembled_online.mjs",
    "line": 101,
    "summary": "The verifier makes a special case for heroRecovery instead of fixing the product so its object shape matches the wire format.",
    "failure_scenario": "src/online/render-state.ts:44 ownPlayer() always creates `heroRecovery: undefined`, while JSON on the wire drops it. Any future optional Player field will fail the strict comparison in the same way and need another exception. Omitting the key when it is undefined (as copyPoint does for `level` at line 52) would fix the root cause."
  },
  {
    "file": "docs/features/decisions.tsv",
    "line": 256,
    "summary": "The result field 'Exact1106695candidate bytes imported' gives the SHA prefix (1106695…) where a byte count would go. The candidate is 27,634 bytes.",
    "failure_scenario": "A reader of the ledger would take this as 1,106,695 bytes imported. It also breaks ~/.agents/writing-style.md (included via ~/.claude/CLAUDE.md), which says documentation must be 'plain English' and not text that 'stops being English and moves into a side-English'. Rows 252-256 use run-together tokens such as '70 verified30 in progress;online failed6 partialchecks'."
  },
  {
    "file": "docs/evidence/native-combat-f18a50d-first-failure-20261001/README.md",
    "line": 3,
    "summary": "This README was not updated when features 1/4/9/10 were admitted from this directory, and docs/KNOWN_LIMITATIONS.md:9 still says there are no formations.",
    "failure_scenario": "Feature 1 is now verified while KNOWN_LIMITATIONS says 'there are no … formations'. The packet README says only 2/5/7/8 are verified, so it disagrees with requirements.json, which cites this directory for 1/4/9/10."
  },
  {
    "file": "docs/evidence/native-combat-f18a50d-first-failure-20261001/root-remaining-clause-index-readback.json",
    "line": 1,
    "summary": "The remaining-clause copy and index readback have no producer, no Git blob ids and no retained import script, unlike every other root retention receipt.",
    "failure_scenario": "'fullByteCopyVerified' and 'gitIndexFullByteVerified' for assessment.md, audit.json and the model-attribution addendum cannot be checked against Git objects or a retained procedure. The addendum was written by the IDs 1/4/9/10 reviewer into the earlier reviewer's /tmp directory and has no author or timestamp, yet it is filed under clause-peer-review/ as if it belonged to the original review."
  }
]
```
