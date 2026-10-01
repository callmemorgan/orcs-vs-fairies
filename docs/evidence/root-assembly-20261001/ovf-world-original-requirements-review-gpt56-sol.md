# Review of original world requirements 94, 95, and 97

Reviewed by GPT-5.6 Sol.

The retained world evidence supports promoting all three original requirements to `verified`. I found no uncovered behavior in their original wording and no finding that should block the ledger change. At root commit `a9f3a9af9de80c742cbc78dd3aaf75cbd2d9471f`, the three rows are still `in-progress` with empty evidence arrays; changing only IDs 94, 95, and 97 would move the ledger from 51 verified and 49 in progress to 54 verified and 46 in progress.

## Scope and provenance

I reviewed the retained package at `docs/evidence/world-save4-4.0.1-c86e273/` and its raw archive at `/home/morgana/.codex/worktrees/save4-den-resume/orcs-vs-Fairies/work/verification/world-save4-final-4.0.1-c86e273`. The evidence executed source commit `c86e273c70738f144a00fe75f5ecf39e7fa324d8`, SAVE4, and simulation revision 4.0.1.

The machine audit checked 37 relevant raw result, fixture, save, and native-report files. Every byte count and SHA-256 matched both the raw `artifact-hashes.json` and the committed `retained-artifact-hashes.tsv`. It also read each of the five verification scripts from Git at `c86e273` and matched those bytes to the corresponding result file's `scriptSha256`.

The five browser result files record 59 passing checks and no uncaught errors: map 17, flat scenario 9, layered scenario 8, community map 14, and community mod/scenario 11. The five relevant native reports pass decoding, complete save roundtrip, complete replay-envelope checks, and 20 identical continuation steps and ticks.

## ID 94: Map editor

The requirement is “paint terrain, place resources and define starting positions.” The retained evidence covers each clause through normal editor controls and then exercises the authored map in the game.

`scripts/verify_editors.mjs:44-136` paints terrain and elevation, checks undo and redo, moves player start slot 0, adds an underground resource, adds a relic site and transition, creates eight starting slots, launches the edited map, traverses the authored entrance, and exports the live SAVE4 session. The raw fixtures confirm the important values: cell `(1,1)` changes from grass to water; elevation cell 74 becomes 1; start slot 0 moves from `(7.5, 7.5)` to `(8.5, 7.5)`; slots 0 through 7 exist; and the underground map contains a crystal resource at `(15.5, 8.5)`, level 1, amount 999. The exported and imported two-level map objects are equal.

`map/result.json` records all 17 checks with no errors, including launch in the game core and retention of levels, elevation, sites, transitions, and starts. `native-reports/map.json` passes complete SAVE4 roundtrip, replay-envelope, and continuation checks from tick 22 through tick 42.

## ID 95: Scenario editor

The requirement is “create objectives, scripted events and custom victory conditions.” The flat and layered editor runs cover all three clauses, including runtime success and failure.

`flat/convoy-scenario.json` contains three objectives: elapsed-time survival, escort arrival, and a variable comparison. Its event graph contains a timed enemy wave and an `all` condition that ends the mission with `outcome: "won"`. `scripts/verify_scenario_editor.mjs:30-108` builds that graph through ordinary controls, verifies exact export/import, sees the wave and custom-win triggers fire once, reaches custom victory at tick 100, then authors a one-health commander case that loses at tick 1 without headquarters defeat. `flat/result.json` records all nine checks with no errors.

The layered run adds a level-aware actor and move order, a friendly timed wave, and a nested victory condition. `layered/cave-scenario-timeline.json` records the wave on level 1 at tick 20 and the custom victory at tick 40. `layered/result.json` records eight checks with no errors. `native-reports/flat.json` and `native-reports/layered.json` both pass complete SAVE4 roundtrip, replay-envelope, and 20-step continuation checks.

## ID 97: Community content browser

The requirement is “discover and install maps, scenarios and mods.” The evidence uses separate authenticated publisher and receiver profiles against the production community UI.

For maps, `community-map/result.json` records that the receiver searches remote metadata, sees the preview, downloads and checksum-verifies the revision, installs it, and plays its authored terrain. It also preserves distinct revisions 1 and 2 across a server restart. The 14 checks have no errors. `native-reports/community-map-complete.json` passes the complete native envelope and continuation checks.

For mods, `community-mod/result.json` records receiver search, recursive download, verification, installation, and play of the three-package dependency closure. It also retains the old installed revision after a changed revision is published. The 11 checks have no errors. `native-reports/community-mod.json` passes the complete native envelope and continuation checks.

The same production flow covers scenarios. In `scripts/verify_community_mod.mjs:426-445`, the receiver selects package kind `scenario`, searches the community service, views the result, clicks `Download and install`, waits for the installed receipt, and clicks `Play installed revision`. The played fixture reaches `won` at tick 40, retains the pinned three-package mod closure, and instantiates `lantern:duelist` with max HP 110. The result file records this as “native authoring, remote publication, installation and scenario launch preserve the old mod closure and custom actor definition.”

## Findings and risk

No findings.

This review admits existing evidence and recommends a requirements-ledger change. It does not change product execution. Ordering, failure handling, logging, and stale-write behavior are therefore unchanged. The regression evidence for each behavior is the pinned browser result and native report named above. I will review the root promotion commit separately to confirm that it changes only the three requested rows and produces the expected 54/46 counts.

I performed read-only parsing and hashing. I did not run a build, browser, server, generator, or simulation because another stream owns the execution slot.

## Artifacts

The machine-readable audit is `/tmp/ovf-world-original-requirements-audit-gpt56-sol.json` with SHA-256 `700cb2ae7bbdf2b2df564e5db49a99e8e71fbb7900d9abd66e7ea0ca50169639`.
