# Combat proof preparation

These records prove the verification helpers and their preparation cases. They do not claim a final production browser run, packaged CLI run, or complete feature acceptance. The parent owns those runs after freezing the assembled SAVE4 source.

The browser runner is pinned to `0644aa7e2a3ca891cf3a3f65a198b838a9ab6154`. The CLI projection adapter is pinned to `3f963008a3ce79e4615a8ca115954f9f4ce077ab`. Import those commits in that order. Both change proof scripts only. The baseline fixture corrections and their separate review archive remain independent of this archive.

## Results and source versions

| Record | Source and version | Observed result |
| --- | --- | --- |
| `runner/fault-probes.json` | Public fixture producer `5cba15c8f4113af57dde2f1f05c3fa82f42bce3d`; SAVE4, rules 4.0.0. Exact runner bytes from `0644aa7`. | 15 offline contract cases passed. |
| `projection/commands.json` | `3f963008a3ce79e4615a8ca115954f9f4ce077ab`; SAVE3, rules 3.2.0. | All seven build, generation, projection and fault-suite commands exited 0. |
| `projection/work/pending-projection/projection.json` | Same SAVE3 preparation pin. | Eight accepted public commands, 138 ticks, complete native and projected game equality. Real pending shell at tick 41, then a same-tick stop and 97 remaining ticks. |
| `projection/work/coalesced-projection/projection.json` | Same SAVE3 preparation pin. | Real pending shell at tick 118. The checkpoint consumes 57 of the final 77 coalesced ticks; the remaining 20 ticks reproduce the full game. |
| `projection/work/projection-fault-proof-3f96300-retained/result.json` | Same SAVE3 preparation pin. | 27 action, replay, controller, planning, source and executable cases passed. |

The public producer authors terrain, starting resources, entity positions and initial orders before recording. All later actions use public commands and engine steps. It pays 15 ore to load the cannon and 25 wood plus 20 ore for its stone fitting. Two native pending shells resolve and cause 414 total damage. Both native checkpoint continuations and both projected continuations must equal the uninterrupted complete game.

The adapter verifies the original native session before deriving any CLI input. It checks strict decoding, complete save round trip, unmodified replay playback, final checksum and complete final game equality. The derived histories change only `state.controllers[0]` from `human` to `external`. Original planning metadata stays in the retained original input and is validated by the native decoder; derived CLI wrappers omit it and make no outer-planning parity claim. Other human sides, side-0 AI, nonzero command sides, non-.05 ticks and scenario bindings are rejected.

The runner compares the complete native `.game` envelope after fixture imports, exported-save imports, replay endpoints and the final bug report. It requires SAVE4 and the pinned rules revision, committed source inventory and Git bytes, sealed fixtures/build assets, fresh output paths and matching observed script/style response bytes. It blocks service workers and rechecks source, seal and downloads at completion. The offline cases exercise its actual helper source, including changes the former eight-field comparison missed.

## Retained files and verification

`retained-paths.json` maps historical absolute paths to exact retained copies. Reports retain their original bytes and paths. Bundles, metafiles, producer source, native sessions, derived sessions, command receipts, build outputs, fault inputs and failure records are retained. Scratch Git metadata and whole source checkouts are excluded; their source pins and per-input hashes are recorded.

`runner/generation-receipt.json` binds the executed SAVE4 producer to its bundle, metafile, native output and 48 input hashes, each committed input checked against the pinned Git blob. `projection/generation-receipt.json` binds the regenerated SAVE3 producer before execution to its committed inputs and records its executed bundle, metafile, output hashes and generation command. The projection reports independently retain the executed adapter, deterministic fresh rebuild, source manifest and original inputs.

`artifact-hashes.sha256` covers every archive file except itself. After importing this evidence commit, verify exact committed bytes and the retained source provenance with:

```sh
python3 docs/evidence/combat-proof-runner-20261001/verify-retained.py FULL_EVIDENCE_COMMIT
```

GPT-5.6 Sol's source review is retained in `independent-review.md`. It admitted both helper commits with no findings. The evidence-only review is a separate follow-up; final production execution still needs the assembled source.

## Reproducing preparation

Run from a repository that contains the recorded source commits and has its dependencies installed. Every output directory must be new. Neither command modifies production source or the parent's checkout.

```sh
node docs/evidence/combat-proof-runner-20261001/fault-probes.mjs \
  scripts/verify_combined_combat.mjs "$PWD" \
  /ABS/NEW-RUNNER-PREPARATION \
  5cba15c8f4113af57dde2f1f05c3fa82f42bce3d

python3 docs/evidence/combat-proof-runner-20261001/reproduce-projection.py \
  3f963008a3ce79e4615a8ca115954f9f4ce077ab \
  /ABS/NEW-PROJECTION-PREPARATION
```

The first command reads the current runner file. To reproduce the recorded runner bytes, use its committed `0644aa7` file or the retained `runner/executed-runner.mjs`; the output records its hash. The second command reconstructs the recorded adapter/source in an isolated checkout, regenerates fixtures, bundles the committed adapter, runs both checkpoints and repeats the 27-case fault suite. The source versions in these preparation records must remain explicit.

## Final frozen SAVE4 recipe

The following commands are instructions for the parent, not completed-run claims. Start at a committed final SAVE4 checkout, use a fresh evidence directory, and retain each command, exit code, stdout and stderr. Set `FINAL_PIN` to its full commit and `COMBAT_PROOF` to an absolute new output path. Keep generated evidence outside the frozen source inventory.

```sh
FINAL_PIN=$(git rev-parse HEAD)
COMBAT_PROOF=/ABS/FRESH-COMBAT-EVIDENCE
mkdir "$COMBAT_PROOF"
npm run build
node_modules/.bin/esbuild scripts/combined_combat_scenarios.ts \
  --bundle --platform=node --format=esm \
  --outfile="$COMBAT_PROOF/fixture-generator.mjs" \
  --metafile="$COMBAT_PROOF/fixture-generator-metafile.json"
node "$COMBAT_PROOF/fixture-generator.mjs" "$COMBAT_PROOF/fixtures"
node scripts/verify_combined_combat.mjs --freeze \
  "$PWD" "$COMBAT_PROOF/fixtures" \
  "$COMBAT_PROOF/frozen-inputs.json" "$FINAL_PIN"
```

Record the generator source, executed bundle and metafile hashes; verify every committed metafile input against `git show "$FINAL_PIN:PATH"`; retain the executed generation receipt and all output hashes. The freeze seals resulting input bytes and does not by itself prove generator execution. Start the preview in a separate terminal:

```sh
npm run preview -- --port 5397 --strictPort
```

Run the native production browser proof against the sealed build:

```sh
OVF_PLAYWRIGHT_MODULE=/ABS/PLAYWRIGHT/index.mjs \
OVF_COMBAT_EVIDENCE="$COMBAT_PROOF" \
OVF_COMBAT_FIXTURES="$COMBAT_PROOF/fixtures" \
OVF_COMBAT_FREEZE="$COMBAT_PROOF/frozen-inputs.json" \
node scripts/verify_combined_combat.mjs http://127.0.0.1:5397 "$PWD"
```

Bundle `scripts/minimap-alerts/verify-native-export.ts` from that same source and check every exported native save, including each faction specialist export. Preserve original browser downloads. The combined runner checks complete native envelopes itself; this checker adds standalone replay/decoder records for each download.

Bundle the adapter from the same frozen SAVE4 checkout. Use the actual final Dwarf browser export and its actual pending browser checkpoint, which must share the same original replay history. Do not substitute the SAVE3 preparation files:

```sh
node_modules/.bin/esbuild scripts/prepare_combat_cli_projection.ts \
  --bundle --platform=node --format=esm \
  --outfile="$COMBAT_PROOF/prepare-cli-projection.mjs" \
  --metafile="$COMBAT_PROOF/prepare-cli-projection-metafile.json"
node "$COMBAT_PROOF/prepare-cli-projection.mjs" \
  "$COMBAT_PROOF/dwarves-impact-save.json" \
  "$COMBAT_PROOF/dwarf-cli-projection" "$FINAL_PIN" \
  --checkpoint "$COMBAT_PROOF/dwarves-in-flight-save.json" --root "$PWD"
node scripts/tournaments/verify-packaged-cli-parity.mjs \
  "$COMBAT_PROOF/dwarf-cli-projection/projected-full.session.json" \
  "$COMBAT_PROOF/dwarf-packaged-full"
node scripts/tournaments/verify-packaged-cli-parity.mjs \
  "$COMBAT_PROOF/dwarf-cli-projection/projected-pending.session.json" \
  "$COMBAT_PROOF/dwarf-packaged-pending"
```

The existing packaged driver is owned separately, with import order `97cb570` then `13d4fbc`. It builds and runs the packaged CLI and retains protocol requests, responses, command logs, full native checkpoints and subprocess log replay. Keep the original unprojected browser equality claim separate from the explicitly labeled controller projection. Apply the adapter/driver pair to other browser encounters using fresh output directories when claiming their CLI parity.

## Acceptance still requiring native production proof

The combined four encounters cover formation controls, morale retreat/rally, Orc chants/standard, paid Dwarf fitting/pending bridge impact and an Automata relay. This preparation does not complete every production UI acceptance for IDs 1, 2, 4–10, 32, 33 and 35–40. Existing core tests remain useful but must pass on the final source.

| Acceptance | Remaining native production evidence |
| --- | --- |
| Formation and flank | Mixed roles, obstacle routes, casualty regroup and measured front/side/rear damage. |
| Morale, shield and cover | Surrender, save during active retreat, directional shield depletion/bypass and cover destruction. |
| Friendly fire and charge | On/off rule contrast with allied collateral, momentum interruption and pike counter. |
| Capture and ambush | Real crew defeat, mid-capture save, new-owner movement and firing; native ambush controls, trigger and observer visibility. |
| Six faction specialists | One native save/replay and parity record per faction on the final build. |
| Veterans, promotions and heroes | Visible insignia, duplicate-promotion rejection and hero death/recovery/rerecruitment. |
| Artifacts, beacons and engineers | Concrete artifact combat effects; intrusion alert, link destruction and sight loss; crossing, obstruction and expiry. |

Earlier fixture-page tactics checks and old SAVE3 archives cannot replace these final native app records. Mark feature acceptance only for the behavior the final retained records demonstrate.
