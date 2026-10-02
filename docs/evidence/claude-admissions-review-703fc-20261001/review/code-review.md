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
