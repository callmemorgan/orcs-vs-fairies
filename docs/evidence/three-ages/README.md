# Three-age evidence

See [the feature and verification report](../../THREE_AGES.md) for findings and limits. This directory preserves the artifacts used to verify the three-age build.

| Evidence | Meaning |
| --- | --- |
| `tests-final.log` | Complete 237-test run, including 36 ordinary AI matches. |
| `progression-final.log` | 15 focused tests after the final HUD change and added expansion-delivery test. |
| `regression-matches/`, `regression-summary.json` | Single-seed ordered faction matrix, role/building/research coverage and outcomes. |
| `matches-v6/` | Additional complete small, large and huge matches. |
| `matches-final/`, `playtest-final.mjs` | Complete large match with direct flank-camp visit and extraction diagnostics; executable simulation snapshot. |
| `terminal-final.ndjson`, `terminal-final-replay.log` | 222-request terminal match and verified replay. |
| `frame-validation.json`, `asset-validation-final.json` | New-unit bounds and complete packed-art validation. |
| `browser/` | Actual UI screenshots, full-match telemetry, faction loading and final 100-unit performance measurement. |
| `source-sha256.json` | Source, test and manifest fingerprint matching the completed work. |
| `decisions.tsv`, `trail-review.md` | Append-only decision record and independent GPT-5.6 Sol audit. |

Log copies normalize trailing empty lines only. Selected earlier failed/intermediate logs are retained where cited by the trail. A successful individual test count in `tests-v2.log` does not make that suite pass: its aggregate assertion failed, as the corrective trail row records. Paths beginning `work/three-ages/` in historical trail rows identify the original local artifact; retained files use the same basename here. The early `matches/` report is retained under `matches-initial/`. Intermediate Blender logs prove rendering, not the visual conclusions in the transcript; final bounds reports and gate screenshots provide the durable completion evidence.

The human match telemetry was filtered to this run's huge-map, 1280-pixel browser sessions. No historical browser-session stream or private conversation transcript is included. Screenshots were taken through browser controls; game actions were issued through the ordinary UI. The benchmark is an explicit synthetic fixture and must not be used as match-outcome evidence.
