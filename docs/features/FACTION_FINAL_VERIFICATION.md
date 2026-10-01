# Held final faction verification

This document prepares acceptance for original feature IDs 21–30. Every new flow and every command below is HELD and unexecuted. Root owns the heavy execution slot, preview release, final source pin, retained evidence admission, and requirement ledger. This document changes no feature status.

The production source tree for this preparation is byte-identical to acceptance freeze c86e273c70738f144a00fe75f5ecf39e7fa324d8. That source uses SAVE4 and rules 4.0.1. RECIPE_PIN must be the later full committed source SHA containing this document and the admitted faction proof helpers; the execution record must retain its resolved full value. The historical source pins below remain separate. A successful historical run does not establish acceptance at c86e273 or at RECIPE_PIN.

The authored group uses scripts/acceptance/faction-powers-fixtures.ts, scripts/acceptance/faction-powers.mjs, and scripts/acceptance/audit-faction-powers.ts. It is registered as factions in the authenticated native generator, production browser runner and complete history auditor. The browser group is selected explicitly; the existing default groups remain direction, capture and specialists. This is preparation only. Do not run a builder, generator, build, focused suite, browser, offline engine audit, or CLI simulation before this integration is committed and root releases the serial slot.

The source defines 23 initial scenarios across all six factions. Each checkpoint exports and reimports the original complete native game, exports and imports its original replay, compares the unprojected replay endpoint, and retains a rendered replay screenshot. A separate hostile-perspective Grove replay checks production art against the hostile PlayerView while the real troop's tile is visible. The offline audit requires all 26 named continuation pairs, with distinct endpoints and no duplicates, before it replays any suffix. These source assertions are unexecuted and do not certify their outcomes.

## Historical sources and evidence

| Record | Tested identity | Retained result and scope |
| --- | --- | --- |
| [Isolated faction encounters](../evidence/faction-systems-20261001/README.md) | Its browser [results.json](../evidence/faction-systems-20261001/browser/results.json) contains SHA-256 values for 26 source/proof files. Neither that record nor its README supplies a Git source commit. | 32 authoritative encounters, 27 mounted browser checks, and 242 regression passes in nine files. The fixture uses placeholder art and authored starting resources, Fury, trophies, selection and Gravecaller cooldown. It proves that mounted fixture's controls and rendering. |
| [Assembled combat](../evidence/assembled-combat-20261001/README.md) | 470099e120ae270aa726d1eb831724d292006238; SAVE3; rules 3.2.0; source build ID 75019b785cd1829cd60ccab6a4c762209ed61f88aec0c42e00da19d582ce80c0. | [verification-summary.json](../evidence/assembled-combat-20261001/verification-summary.json) records 597 tests in 26 files and 29 production browser checks. Native browser controls cover Orc, Dwarf and Automata encounters. Fairy, Undead and Tideborn have simulation, mounted-panel and earlier isolated fixture coverage. The later economy/scenario merge and SAVE4 reconciliation are outside this pin. |
| [Frozen native combat](../evidence/frozen-native-combat-af44da4-20261001/README.md) | af44da406acf7ab44436e978cb1f571b93e28d23; SAVE4; rules 4.0.0; source build ID 8c107a5f0ae792b00d7554879cc62d23fe835eccf415a2642243889331717452. | [browser-combined-combat.json](../evidence/frozen-native-combat-af44da4-20261001/browser-combined-combat.json) records 29 checks, 21 native saves, five replays and a bug report. Every native save passed full round trip and replay endpoint checks. This is historical 4.0.0 evidence. |
| [Corrected faction/economy fixtures](../evidence/faction-economy-fixture-correction-20261001/README.md) | Runtime 65839dff2c22a2ad6f88f1607a9e5535ab86754c; fixture 3adb13e88cbad3e35b2804d04c2784440bf62282; unchanged baseline 115a537dd90d5e26ca04c7003f47310a71e67879; evidence 328f4f84cf18a43c20eaad57a15be934bd81aff7. | [source-manifest.json](../evidence/faction-economy-fixture-correction-20261001/source-manifest.json) records 32 focused and 391 surrounding passes in 16 files. The unchanged baseline has 29 failures and three passes. This isolated correction precedes root integration and SAVE4 reconciliation; it makes no native browser, full-suite or ladder claim. |

The immutable original entries in [requirements.json](requirements.json) decide completion. The faction-identity table of [HUNDRED_FEATURE_ARCHITECTURE.md](../HUNDRED_FEATURE_ARCHITECTURE.md) adds implementation and verification ideas; its expanded clauses are supplemental and do not add final acceptance gates. At the acceptance freeze, all ten original rows are in progress with empty evidence arrays. Root's [decisions.tsv](decisions.tsv) explicitly imports the assembled combat proof as historical, admits corrected faction/economy fixtures separately, and leaves final gameplay acceptance open.

## Historical coverage by original ID

| ID | Historical assertions and artifacts | Limits and supplemental architecture differences |
| --- | --- | --- |
| 21: Orc war chants | At the assembled pin, tests/faction-systems.test.ts earns bounded Fury from hostile HP loss, rejects insufficient Fury, spends 25 Fury, measures Assault damage and Bulwark's three-point reduction, and checks expiry. The isolated browser records both controls and expiry. The frozen native browser spends 25 authored Fury on each chant, expires the chant at tick 302, and retains orcs-rally-save.json and orcs-rally-replay.json. | The native initial Fury was authored, and native measured combat buffs remain to be proved. Selected eligible troops are valid army-buff recipients for original ID 21; nearby unselected allies are a supplemental architecture difference. |
| 22: Orc trophy standards | At the assembled pin, tests earn two trophies from hostile mortal kills, consume them for a 160-HP banner, measure morale and a 1.1 damage factor, destroy the banner, and stop its expired aura. Historical lethal-credit tests cover capture and delayed kills. Native artifacts include orcs-chants-and-standard.png and the rally save/replay. | The native trophies were authored. Its morale recovery has allied support and a standard together, so it does not isolate the banner effect. Earned placement, entering/leaving aura range, destruction and bounded stacking need explicit records. |
| 23: Fairy illusion swapping | Historical tests exchange positions, spend 15 crystal, clear orders, enforce a ten-second cooldown, reject foreign clones, and keep a blocked swap atomic. The isolated fixture creates real doubles with the ability before swapping; fairies-swap.png and browser/results.json retain the assertions. Corrected economy tests preserve cargo while the swap replaces the old route, then compare complete saves and replay continuation. | No assembled native main-app swap/save/replay flow is retained. The inspected simple swap cases do not complete the expired-clone, visibility and retained-health matrix. |
| 24: Fairy enchanted groves | Historical tests hide allies from hostile PlayerView, reject attacks against concealed units, reveal on scout proximity, attack or recent damage, and create a harmless moving decoy for an observed hostile scout. Captured-Gravecaller/Grove tests retain original summon/decoy definitions through saves and replay. The isolated browser constructs a Grove and records nearby concealment in fairies-grove.png. | Native cultivated-grove concealment and misleading scout effects remain to be proved. Constructing that Grove can satisfy original ID 24; enchanting an existing/planted economy grove is a supplemental architecture idea. |
| 25: Dwarf tunnels | Historical tests save halfway through a three-second channel and resume to a walkable exit, cancel on damage or ordinary orders, and reject foreign exits. The isolated fixture shows 33% progress, arrival and worker construction in dwarves-channel.png, dwarves-channel-battlefield.png and dwarves.png. Corrected economy tests interrupt loaded delivery and preserve later faction actions in old reachable saves. | No retained native flow constructs both entrances, moves a squad, saves in transit and destroys its exit. Three assembled ownership-cleanup cases call tactical callbacks directly because active faction channels precede tactical updates in ordinary steps; preserve that disclosed limit. |
| 26: Dwarf workshop modifications | Historical tests charge each artillery unit, exercise stone, grapeshot, reinforced and incendiary fittings, measure distinct target/area behavior and movement, retain delayed payload after source removal, and reject partial ammunition payment. Assembled world-ignition cases cover surface/cavern fire and save/replay continuation. The isolated browser records all four controls. Frozen native artifacts buy five shells for 15 ore and stone fitting for 25 wood/20 ore, save a live shell at tick 42 and reach the real bridge impact once. | Native coverage uses stone fitting. Other fittings' distinct armored-target/group impacts and replacement behavior need native assertions. |
| 27: Undead corpse wagons | Historical tests recruit/cancel/save wagons, race two collectors for one corpse, deliver and raise once, preserve original decay deadlines and drop surviving cargo on death. Isolated screenshots include undead-cargo.png and undead-delivery.png. Corrected economy tests cover corpse-order interruption, physical cargo, grouped cross-level selection and legacy continuation. | The isolated browser gives the Gravecaller a long cooldown to inspect delivery before raising. It does not prove delivery-to-raise or the competing claim through native production controls. |
| 28: Undead necropolises | Historical tests pay for construction and measure healing/sustained lifespan inside the radius and expiry after leaving. Assembled real Gravecaller summons are sustained by a Necropolis in bridge-expiry cases with native continuation and replay. The isolated browser records construction in undead-necropolis.png. Corrected economy tests cover planting replacement, paid costs and one-time salvage. | The inspected records do not demonstrate source capture, hostile cleansing or source destruction followed by decay. Construction alone is not lifespan evidence. |
| 29: Tideborn water shaping | Historical tests charge 25 crystal, mutate legal terrain, protect rock, restore overlapping effects once, check twenty-second expiry and compare save/replay continuation. The isolated browser records mud, shallows and water, caster cooldown and restoration in tideborn.png. | No retained native shaped-choke rerouting or amphibious crossing comparison was found in the inspected faction/economy/world reports. Economy specialist flood slowing at cf5cb85f15fcc628d2ba19d9f49afb66a788fe04 concerns movement modifiers, not shapeWater terrain/pathfinding. |
| 30: Automata power networks | Historical tests exercise powered firing, shared shield damage, relay loss disabling a tower, distinct components, joined HQ components, and save admission/continuation. The isolated fixture records connection and Shield 80/80. Frozen native artifacts record paid relay construction, completed connection and complete save/replay equality at tick 404. The native save SHA-256 is e0b5971a9e68d9031abb3b88b389844dda9a3aced054eeb4577b5bda61eba72d and checksum d23a9076. | The frozen native encounter does not attack the network or demonstrate powered defense behavior. Historical core tests prove shield sharing and disconnection. Capacity/overload and rebuild coverage are supplemental architecture ideas rather than original ID 30 gates. |

The frozen Dwarf projection uses the actual dwarves-impact-save.json and dwarves-in-flight-save.json downloads. Its full packaged run compares 76 ticks and four commands; its pending run compares 34 ticks and one remaining command after tick 42. Both reach the complete projected native envelope SHA-256 a1d5f45422b69c7522d531b7fda664f7f5512f5654f4dd370aa528a43ec4e6f5. The sole game projection changes controller zero from human to external. Original planning metadata stays in the original native downloads; derived CLI wrappers omit outer planning and make no outer-planning parity claim. This document's new browser/history recipe does not itself add a fresh packaged CLI execution.

## New native obligations

Every row below is HELD and unexecuted. The fixtures must disclose authored terrain, starting resources, entities, positions, health, cooldowns and orders in their authenticated manifests. Authored setup may make encounters practical, but it cannot replace a native behavior that the run claims. A claim of earning Fury/trophies, claiming corpses, building entrances, destroying structures or causing real combat needs the corresponding live action. After setup, actions use native controls, accepted public commands and production engine steps. Browser evaluation may read state and compute coordinates. It must not call diagnostic mutation functions, write simulation state or call scene methods to perform an action.

| ID | Native proof of the original requirement | Supplemental checks and retained checkpoints |
| --- | --- | --- |
| 21 | Cast Assault and Bulwark through the Faction panel; record Fury payment, selected eligible recipients, measured offensive/defensive differences, duration and expiry. Selected troops satisfy the original army-buff wording. | Prefer earning Fury from hostile combat. Reject insufficient/duplicate unaffordable spending without changing the complete game. Record an unselected nearby ally to disclose the supplemental recipient difference. Save/replay during an active chant and continue beyond expiry. |
| 22 | Earn trophies in a real engagement, place the standard through its control and measure nearby allied strengthening. | Measure aura effects inside/outside range, destroy the banner and check effect removal and the actual stacking rule. Save/replay an active standard. Check that illusions/summons or a stale owner's delayed hit cannot award a new trophy. |
| 23 | Create a double through the real ability, select it, swap through native targeting and record both exchanged positions. | Check health, resulting orders, payment/cooldown and hostile, expired, undisclosed or blocked target rejection. Save/replay after the swap. Preserve physical economy cargo on a successful swap; rejected swaps retain the old route. |
| 24 | Cultivate the currently supported Enchanted Grove through worker construction. Demonstrate allied concealment and misleading decoy effects through a hostile scout's observation while the true troop stays private. | Check detection/attack reveal, decoy lifetime/harmlessness/original definition and save/replay with an active Grove/decoy. Record construction versus enchanting an existing/planted forest as a supplemental difference, not an acceptance failure. |
| 25 | Complete two entrances through worker controls, order an eligible selected squad between them, and record transit and legal arrival. | Save during active travel and execute its suffix. Destroy the selected exit before arrival and record its cancellation/emergency result. Check invalid exits, damage/new orders and preserved cargo/unaffected out-of-level jobs. Exit destruction is supplemental to the original transfer requirement. |
| 26 | Choose different artillery ammunition/attachments through native controls and demonstrate their resulting behavior on actual artillery. | Exercise all supported fittings, costs/replacement, distinct armored/group effects, ammunition and incendiary payload. Save fitted artillery and a real pending shell, restore and resolve once. Check insufficient funds and source/ownership changes with complete state/runtime comparisons. |
| 27 | Produce wagons, collect real combat corpses, transport them as cargo and deliver them to a Gravecaller through native controls. | Raise from delivered stock once; race collectors and check no duplicate ground claim. Preserve decay clocks, cargo and unaffected routes. Save loaded cargo and active orders and compare replay/suffixes. Check invalid targets, death/drop and grouped cross-level selection. |
| 28 | Demonstrate an observable native territory-acquisition/capture step, construct a Necropolis in that captured territory, and show that its converted ground sustains real summoned troops. Compare the same summon inside/outside its area. An authored home patch alone does not prove captured territory. | Save sustained summons and continue through boundary/source loss to expiry. Capturing the Necropolis itself, destroying it and hostile cleansing are supplemental architecture checks where implemented; absent cleansing is not an original ID 28 gate. |
| 29 | Cast temporary shallows, mud and flooded defensive terrain through native controls; record actual tile changes and expiry/restoration. Deep water being unwalkable does not contradict the original terrain-shaping requirement. | Measure cost/cooldown/area bounds, non-amphibious path changes and Tideborn movement where passability permits. Save active terrain and continue past expiry. Check overlap, protected tiles, layers and invalid casts without partial changes. Amphibious deep-water crossing is supplemental. |
| 30 | Build connected structures, attack a defense and measure shared shield transfer and powered specialized defense behavior through native controls. | Destroy/rebuild a connector, compare an unrelated component and save connected/damaged/disconnected/rebuilt states. Capacity/overload is absent and supplemental; shield depletion is not an overload test. |

For every positive faction flow, retain the original native save and replay downloads and validate the complete .game envelope, including every state and runtime field. There is no permitted exclusion or normalization of queues, economy tasks/cargo, faction state, terrain effects, visibility, orders, routes, controllers or runtime. Compare import, full save round trip, unprojected replay endpoint and any promised checkpoint suffix with the uninterrupted native result. Retain command/tick/checksum assertions as additional evidence, not replacements for complete envelope equality.

## Known architecture wording gaps

The current chant command applies to selected eligible units. The architecture says buffs affect nearby allies. Root has clarified that selected troop buffs satisfy immutable original ID 21. Measure and disclose the recipients in the new run; keep the architecture difference as supplemental information without requiring a production change.

The current Grove command constructs a dedicated Enchanted Grove. The architecture says workers enchant an existing or planted grove. Root has clarified that original ID 24 requires native cultivated-grove concealment and misleading scout effects regardless of whether cultivation uses a new-structure command. Prove those effects. Record the absent enchant-existing-economy-grove operation as supplemental rather than withholding original completion for it.

The current Automata graph connects structures by range and component roots and supplies shields/defenses. It has no capacity/overload model. Root has clarified that capacity/overload is supplemental to original ID 30. Native shared shields and powered defenses decide original completion; disconnection/rebuilding provide additional graph evidence. Do not claim an overload test or capacity model from shield depletion.

All other expanded architecture clauses are supplemental as well. Record whether a planned supplemental flow was demonstrated, unsupported or unexecuted, without turning it into a new original requirement. Keep required original assertions and complete native state/runtime evidence intact. A source-only recipe or a supporting test does not establish an original native behavior.

## Held serial recipe

Use the owned isolated checkout with the completed, admitted proof source committed at RECIPE_PIN. Use a fresh absolute output directory outside the checkout. The proposed preview is http://127.0.0.1:5298, bound to 127.0.0.1 with a strict port. Root must release that port and the heavy slot. Run one phase at a time and wait for its recorded result before starting the next phase. A new source/proof change requires a new full pin, fresh preparation and a fresh evidence directory.

The estimates are planning estimates, not observed timings or timeout budgets. Allow about two minutes for the focused suite, about two minutes for the client/CLI builds and helper/generation/freeze phase, 10–20 minutes for the native six-faction controls, and about two minutes for the offline history audit and artifact checks. Native controls may take longer with slow UI, selection retries or long timed effects. Plan roughly 16–26 minutes in serial phases plus screenshot inspection and failure diagnosis; keep root informed when a phase exceeds its estimate.

All setup and commands in the following blocks are HELD. Use the committed recipe checkout and replace the output placeholder only after root releases the recipe. RECIPE_PIN reads that checkout's immutable HEAD; retain its full value with the command record. The output parent must be new; the wrappers require fresh child output paths. Record each executed command, environment overrides, timestamps, executable/module hashes, exit code, stdout and stderr in that output parent.

~~~sh
# HELD: configure only for the later committed and released run.
FACTION_ROOT="$PWD"
RECIPE_PIN=$(git rev-parse HEAD)
FACTION_OUT=/ABS/NEW-FACTION-ACCEPTANCE-OUTPUT
mkdir "$FACTION_OUT"
~~~

Phase 1 is the focused regression suite, about two minutes, HELD and unexecuted. It is a supporting interaction check, not native feature acceptance. Use one worker so cases do not compete with another heavy proof or one another's event-loop budget.

~~~sh
# HELD: execute only after root releases the serial slot.
node_modules/.bin/vitest run \
  tests/faction-systems.test.ts tests/faction-tools.test.ts \
  tests/faction-save-semantics.test.ts tests/faction-economy-interruption.test.ts \
  tests/captured-illusion-definition.test.ts tests/captured-gravecaller-definition.test.ts \
  tests/captured-gravecaller-grove.test.ts tests/captured-summon-rules.test.ts \
  tests/joint-combat-integration.test.ts tests/joint-trophy-ownership.test.ts \
  tests/joint-world-ignition.test.ts tests/joint-special-surrender-fire.test.ts \
  tests/economy-cargo-integration.test.ts tests/economy-cancellation.test.ts \
  tests/terrain-economy.test.ts tests/world-interruptions.test.ts \
  tests/team-observation.test.ts tests/online-render-state.test.ts \
  tests/saves.test.ts tests/replays.test.ts tests/save4-rule-revision.test.ts \
  --testTimeout=30000 --maxWorkers=1
~~~

Phase 2 builds the client and CLI, then bundles the source-bound helpers, generates authenticated fixtures and freezes the inputs. Allow about two minutes. Every command is HELD and unexecuted. This preparation must retain the complete source/config/proof inventory, compiler/module identities, helper bundles/metafiles, generation receipts, fixture hashes and actual production assets. The generator and observer rebuild checks must bind the new faction modules to RECIPE_PIN. The freeze alone is not evidence that the producer ran correctly.

~~~sh
# HELD: run serially from FACTION_ROOT after Phase 1 passes.
npm run build
npm run build:cli
node scripts/acceptance/build-native-helpers.mjs \
  "$PWD" "$FACTION_OUT/helpers" "$RECIPE_PIN"
node scripts/acceptance/generate-native-fixtures.mjs \
  "$FACTION_ROOT" "$FACTION_OUT/helpers/fixtures.mjs" \
  "$FACTION_OUT/fixtures" "$RECIPE_PIN"
node scripts/acceptance/verify-native-acceptance.mjs --freeze \
  "$FACTION_ROOT" "$FACTION_OUT/fixtures" \
  "$FACTION_OUT/freeze.json" "$RECIPE_PIN"
~~~

Phase 3 is the native production browser group, estimated at 10–20 minutes and possibly longer if controls are slow. It is HELD and unexecuted. Start the owned preview in its own terminal after the build and freeze pass. Record its PID and startup output. Set OVF_PLAYWRIGHT_MODULE to the verified installed Playwright module and OVF_CHROMIUM_EXECUTABLE to its matching browser executable. Require the observed same-origin HTML, JavaScript and CSS to match the frozen production build, with service workers blocked and no browser or asset failures accepted.

~~~sh
# HELD: preview in the owned checkout, only on root's released port.
npm run preview -- --host 127.0.0.1 --port 5298 --strictPort
~~~

~~~sh
# HELD: separate terminal, with the same FACTION_ROOT/RECIPE_PIN/FACTION_OUT.
node scripts/acceptance/verify-native-acceptance.mjs \
  http://127.0.0.1:5298 "$FACTION_ROOT" \
  "$FACTION_OUT/browser" "$FACTION_OUT/fixtures" \
  "$FACTION_OUT/freeze.json" "$FACTION_OUT/helpers/audit.mjs" factions
~~~

Phase 4 is the offline history audit, about two minutes plus artifact inspection. It is HELD and unexecuted and must follow the browser serially. It validates authenticated original downloads, complete native saves/replays and faction-specific checkpoint suffixes from the same source. It must not substitute historical sessions, synthesized exports or projected controller histories for the browser's original native equality claims.

~~~sh
# HELD: run after the retained native browser receipt is complete.
node scripts/acceptance/verify-native-history.mjs \
  "$FACTION_ROOT" "$FACTION_OUT/helpers/audit.mjs" \
  "$FACTION_OUT/fixtures" "$FACTION_OUT/browser" "$RECIPE_PIN" \
  "$FACTION_OUT/freeze.json"
~~~

Close only the owned preview after all required browser captures are finished, record its exit, and verify port 5298 has no remaining listener. Inspect every screenshot, check original download hashes and the complete artifact inventory, and submit the new archive for independent admission. Root alone appends acceptance decisions and updates the requirement ledger against the immutable original requirements. Until the original native flows and their evidence checks are complete, the new group remains unexecuted or unaccepted preparation. Supplemental architecture differences do not add completion gates.

## Failure retention and historical limits

Keep the first failing receipt, last readable native state, original downloads, screenshot and command output. Diagnose the failure before changing production/proof source or rerunning. Never overwrite a failed evidence root, suppress a required original assertion or remove a .game/runtime field to obtain equality. Record unsupported supplemental steps with their limits. A corrected run gets a new source pin when its source changed and always gets fresh output paths; both failed and corrected records remain retained.

The corrected faction/economy archive withdraws 70aba48. Its old legacy fixture appended a task, allowing duplicate-task admission failure instead of the intended behavior failure. The corrected fixture replaces the actor's task and asserts exactly one saved task before recording and stepping. The fixture Git blob is 35d25aabf43236f736ba407f2b6bc56ea350d52d and SHA-256 is 46fd16a47ef4513921fd6341df532854302a012e91c67861a832b4c5b3f2d3db. Root's independent baseline reproduction retains 29 failures and three passes against unchanged 115a537, with intended stale-route/planting assertions and no duplicate-task validation failures. An earlier grouped-wagon probe retains two failures. The corrected README references a former faction-economy-final-20261001 directory whose README is absent at c86e273; do not treat that missing reference as retained proof.

The assembled SAVE3 archive retains 1,813 repository passes and 16 failures reproduced on its pre-admission baseline, plus an unfinished AI soak. It makes no whole-repository green or completed-ladder claim. It also discloses ambiguous historical captured-Gravecaller SAVE3 definitions and the later migration responsibility. Its isolated/main-app scope and old rules identity must remain visible when citing it.

The frozen af44 native browser passed on its first run. A later orchestration resume raised NameError for a missing local esbuild variable before the native-checker build. The original failure is retained; the preview was closed, the executable path restored, and remaining native/projection/packaged checks proceeded serially without changing or rerunning browser artifacts. This procedural repair does not transform rules 4.0.0 evidence into rules 4.0.1 acceptance.

The existing 39-encounter direction/capture/specialist preparation contains no original-faction gameplay results and does not replace these ten obligations. The new six-faction group must independently authenticate its setup, native controls, source/build identity, complete state/runtime comparisons and downloads before it can support a new acceptance decision.
