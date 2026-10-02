# Root's bounded 9+6 recipe

This recipe is unexecuted preparation for fifteen named production-main encounters at SAVE4 and rules 4.0.2. Nine canonical cases cover original IDs 1, 4, 8, 9 and 10. Root's six ruin cases cover ID6. It establishes examples of the original clauses after execution and review; the pre-volley checkpoint documents provenance and does not strengthen the gameplay requirements. No full39 generator or group runner belongs in this recipe.

## Source and build binding

Root first reviews and integrates the two new modules from `canonical-main.patch` and its own thin builder, freeze and wrapper. Guard the existing ruin generator's CLI tail before importing it. Root alone resolves a future full integration pin, inventories the effective source and helpers, builds the isolated production app, and binds source-derived build ID and served HTML/JS/CSS asset hashes. The reference root freeze f7 is not a label for modified future source. Preserve the existing `native-contract.mjs`, `native-context.mjs` and root-authenticated observer unless separately reviewed. Avoid importing the broad native fixture producer, whose faction branch has a different rules pin.

The canonical generator is a library on import. Root's thin builder calls `buildCanonicalMainFixtures` into a fresh canonical subdirectory and its guarded `buildRuinCoverFixtures` into a separate fresh ruin subdirectory, passing the same future integration pin. It combines only metadata and relative fixture paths; original generated fixture bytes and both generator manifests are retained. The combined manifest must contain the following fifteen names and consistent source/SAVE/rules identity. Repeated generator output comparison, if root performs it later, must use new directories and compare complete fixture/manifest bytes.

| Group | Names |
| --- | --- |
| Canonical | `formation-line`, `formation-wedge`, `formation-square`, `formation-loose`, `charge-pike-front`, `charge-pike-rear`, `siege-full-crew-capture`, `ambush-selected-trigger`, `morale-supported-full-fight` |
| Ruin | `ruin-control`, `ruin-covered`, `ruin-other-level`, `ruin-beyond-victim`, `ruin-inside-near-victim`, `ruin-capture` |

## Thin native wrapper

Root owns preview/browser launch and cleanup. Use one fresh downloads-enabled browser context at native density one, one production `/index.html` page, and an unused isolated preview port. The protected port 4173/PID1063/dist and retained failures remain untouched. Click `.begin-match`, require the mounted production canvas/artwork/local mode, authenticate served assets and build identity, then create the existing native context with the combined manifest and `{saveVersion:4, simulationRevision:'4.0.2'}`.

Import `runCanonicalTacticsSmoke` from `canonical-main-smoke.mjs`, run its nine cases serially, then call root's `runRuinCoverMainSmoke(ctx)` for the six declared ruin cases. The canonical result has `completed` and `caseNames`. The ruin result has `results`, `capture` and `visualAcceptanceRequired:true`; it does not expose canonical completion fields. Root must verify those six named results and capture separately, and must not treat a missing `completed` field as failure or invent a result.

The wrapper retains partial progress and downloads on error, captures the failed screenshot/diagnostics, and closes its owned context and browser using cleanup that still attempts browser closure if context closure fails. Keep cleanup failures separately. Root also retains the final native bug report, compares its entire session game with the paused final checkpoint, checks page/asset failures, and rechecks source/helper/fixture/served-asset/download identities. Feature admission follows evidence review.

## Native checkpoints

| Encounter | Complete native checkpoint names | Behavioral boundary |
| --- | --- | --- |
| Four formations | `formation-KIND-settled` | Six living mixed troops, shared group, stable slots/count, requested shape/facing/spacing, independent expected positions, real depot detour. Anchor equals accepted continuous native move coordinates. |
| Front/rear pike | `charge-pike-DIRECTION-moving`, `charge-pike-DIRECTION-impact` | Moving charge at least four tiles before any target damage; retain first-hit observation separately, then native Hold. Front/rear damage and return damage use the ordinary pike path. |
| Siege crew/capture | `siege-crew-defeated`, `siege-mid-capture`, `siege-new-owner`, `siege-new-owner-moved`, `siege-new-owner-pending-shot`, `siege-new-owner-impact` | Real full-42-HP crew loss with full hull retained, incomplete four-second channel, original Orc definition after ownership, move and ordinary new-owner shell/impact. Native attack precedes damage. |
| Selected-role ambush | `ambush-concealed`, `ambush-triggered` | Dry-ground disabled control, ready concealed archer withholding fire for at least twenty ordinary ticks while worker is in radius, actual selected melee approach and hit, worker HP unchanged. |
| Supported morale | `morale-native-attack-before-volley`, `morale-supported-retreat`, `morale-supported-retreat-moved` | Full-health/morale 100/recentLoss0 baseline; accepted seven-engine native attack while baseline remains intact, then actual wounds and nearby casualties, living supported retreater, automatic movement after save reload and owned morale panel via native replay perspective. |
| Root's ruin cases | Root-owned first-hit/fog/level/capture names | Compare first ranged hits, inspect the pillar and fog/level cleanup, retain real neutral relic capture progress and completion. |

Each canonical checkpoint uses the existing `exportAndVerify`: native save, reimport reexport, separate replay and browser replay endpoint, with complete native `.game` comparison including runtime. Native reimport clears selection. Restore a single source through the owned-troop list while paused; battlefield multi-selection requires resume. The morale case uses resumed empty-ground focus and F2, checking that exactly the seven engines are selected. No owned-list additive selection exists. Driver event samples can miss transient events, so sampled absence cannot prove no event occurred.

Hold still defends automatically in range. It is not a cease-fire. The pike first-hit observation is retained separately, and its saved target HP must still match after the brief Hold input and native pause. Morale continuation observes ordinary movement and does not claim Hold suppresses later volleys. No cooldown reset or added retreat command is used.

The canonical driver declares seven later source-bound continuation comparisons: each pike moving→impact; siege partial capture→new-owner impact; siege pending shell→impact; ambush concealed→triggered; morale pre-volley→supported retreat; morale supported retreat→moved. Root's later auditor must run each recorded command/tick suffix from the saved checkpoint and compare the complete final save/runtime. Browser endpoint comparisons remain useful but do not replace that suffix audit.

## Bounds and combat chronology

Formation settle and pike approach/impact waits are at most thirty seconds each. Crew defeat, movement and launch use twenty seconds; capture and shell impact use fifteen. Ambush ready, withheld-fire and selected-role trigger use fifteen, five and twenty-five seconds. Morale retreat and continuation use twenty and ten seconds. These are observation bounds. A failure is retained; it never authorizes edits to a recorded game.

For crew defeat, retain the accepted native attack before any crew damage and real attack amounts until the crew reaches zero. The initial captor is outside weapon range and every hostile initial cooldown is disclosed. For ambush, retain the accepted native selected-role command and the authored hostile march that predates the recorder; no hostile command is injected later. Its initial cooldown six protects arming and is never reset.

For morale, the engines begin one normal weapon cooldown period from ready. The native attack checkpoint proves the command precedes firing while all six targets still have normal maximum HP, morale 100 and recentLoss0. Then let ordinary damage and casualty timing occur. Require actual nearby death events and actual hit amounts in the later audit, but no predicted casualty count or exact damage total. At retreat a surviving allied cavalry must be on the same level and within 4.5 tiles, and a living visible siege threat must be within 5.5. Siege attackers cannot capture surrendered units, so the bounded case proves supported retreat; earlier surrender evidence remains separate.

Root must inspect combat chronology through source-bound replay events for pike impacts, full-crew defeat, selected-role ambush and the full-morale causal chain. Command ticks come from replay initial tick plus advance prefixes. Raw core event objects have no own tick; retained sampled events receive the sampled state tick, and the later auditor must associate replay events with their generating step. No attack is invented from HP differences. Screenshots establish only what was inspected, including the panel and root's ruin visuals.

## Retention

Keep all initial authored fixtures, original generator manifests, combined manifest, exact helper/driver/generator bytes, current source/build/assets, native downloads, failed artifacts, screenshots, first-hit observations and command histories. Preserve superseded candidate bytes and prior broad failures. Results describe only these fifteen named encounters and remain unqualified until root completes the native run, full-envelope suffix/event checks and visual review. This packet contains no passing execution or feature-admission claim.
