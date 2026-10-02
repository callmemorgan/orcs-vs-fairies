# ID8 retained combined evidence review

ID8 has a qualified acceptance candidate for root review. The retained native run establishes that moving cavalry builds extra impact. The immutable passing suite establishes that frontal holding pikes cancel that extra impact and damage the rider, on core source that is byte-identical to the native run. This proposal interprets "stopping the charge" as canceling charge impact. It does not establish a separate forced halt of rider movement. Root owns admission; this report changes no feature status and claims no completed native group.

## Original requirement and scope

The earliest local ledger at `ff604bfe4b3defd06cfb97c0c8b34477c6981cb0:docs/features/requirements.json` contains 100 features, identifies its source as `User-provided pasted-text-1.txt`, and records ID8 as "Cavalry charges" with the requirement "build impact through movement, with pikes stopping the charge." That complete ledger blob is 20932 bytes, SHA-256 `6ae20c93fe08e111d1dc4df1eb619d524edde69ee8918a72156d4cf4066a0d97`. The current f18 ledger preserves the same wording at `docs/features/requirements.json:60` and still records ID8 as `in-progress` with no evidence entries. The original pasted file was not independently found or authenticated; this is the original 100 wording retained in local ledger history.

The architecture row at `docs/HUNDRED_FEATURE_ARCHITECTURE.md:188` adds continuous movement, turns, stops, combat, bracing, facing and return damage. Those details explain the implementation but are not substituted for the original requirement. A full five-tile cap and all six browser charge encounters are also separate from the two original clauses.

This is a static review only. It read Git blobs, source, retained JSON and existing payload bytes. No game module was imported, stepped or invoked; no tests, builds, checker stages, fixtures, browser sessions or retries ran. The only write is this derived report in a new private /tmp directory.

## Clause assessment

| Original clause | Established behavior | Evidence and qualification |
|---|---|---|
| "build impact through movement" | A moving native Stag Rider accumulated 4.899999999999992 charge distance by tick39 and dealt 29.400000000000006 target damage at tick47. Its stationary control dealt15 at tick66. Both riders lost0 health. | Native checks70–79 and the sealed full SAVE4/replay payloads establish native attack input, state and endpoint equality. The arithmetic comparison29.4 >15×1.5 is a derived observation here; the runner's later aggregate comparison at direction-defense:175 was not reached. The unchanged pinned simulation test also passed. |
| "with pikes stopping the charge" | Against a frontal holding spear, the pinned simulation test asserts damage approximately17, rider damage >10 and charge distance0. Rear impact >front×1.5 and rider damage0 establish the facing counter. | Immutable tests.json assertion `/testResults/20/assertionResults/15` is passed. The test uses accepted ordinary attack commands and actual stepGame progression, not a mocked impact function. Core source identity transfers this recorded behavior to f18. Both browser pike cases were unrun. The test establishes impact cancellation; it does not assert a forced movement halt. |

Under the impact-cancellation reading, both original clauses are established by the combined record, so root may consider ID8 alone for qualified acceptance. If "stopping" requires physical immobilization, a timed pause in movement, all-angle pike stopping, or a native pike round trip, that clause still has the corresponding evidence gap. This report does not infer those stronger behaviors.

## Immutable passing suite provenance

Authoritative retained suite directory: `/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies/docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0`.

`report.json` SHA-256 `8711be82822ba830200c91af9936e476c3db3617a6ce6b33089cf329da0590e5` records actual tested HEAD `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c`, command exit0, 2920 passed tests, 157 test files and input integrity passed. `tests.json` is 1,017,281 bytes, SHA-256 `ced75e92e6e198d8bad063fc0e4b276bfd7ee1936bf1849830cafcd21f7a11a9`, reports success=true and 2920/2920 tests passed. Its JSON itself has no Git commit field; the immutable report supplies that association. The before and after source inventories are byte-identical at SHA-256 `53a7006baf049eba955a8cb382ce6355ba3cb6b9e7816848363b386b82df7694` and identify the same actual tested pin.

The two targeted tests at `tests/combat-tactics.test.ts:72` and`:76` are recorded as passed at JSON assertion indices14 and15 in testResults20. The movement test accumulates >4 charge distance through move commands, compares ordinary combat damage with a stationary control, and shows smaller damage after stop or sharp turn. The pike test creates a holding spear target, charges through move progression, then uses the helper at test line22, which requires issueCommand(attack) to return true and advances stepGame. Its assertions at line78 check the real health and charge state described above. Initial troop positions, role definitions, terrain, facing and cooldowns are authored setup; these tests do not establish a browser encounter.

`tests/progression.test.ts:87` separately records the ordinary spear damage counter against cavalry as passed. The 24 cases in `tests/tactics-direction-saves.test.ts:10` record heading persistence, equal save continuation and core replay endpoint equality across directions and layers. Those are supporting checks, not substitute native pike observations.

## Source identity

Compared immutable pins are actual Git `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c` and native runtime HEAD `f18a50d904c57ae1652f157b946ebd39d8d8923c`, with `GIT_NO_REPLACE_OBJECTS=1`. No latest root pin was substituted. All 55 core files (792,089 bytes) matched both actual Git blobs and local bytes. Every core SHA-256 also matched the suite's before/after inventories, native receipt source inventory and frozen native source inventory. The sorted55-file inventory, formatted `SHA256  path\n`, has SHA-256 `12a6fcc79541057a6378e541fc22735286374104c55a8719ba2e2475115f0782`. The three selected test files likewise matched both Git pins, local bytes and the suite before/after hashes.

The independent read-only child source review also found an empty endpoint diff across all 55 core files and 190 tests-tree files. These whole-directory Git tree identities are equal at both pins; scenario and content-art trees cover core imports outside its own directory.

| Directory | Equal Git tree identity |
|---|---|
| `src/core` | `d73253481ba0cb85afdf71bc09948a710981902f` |
| `tests` | `dc095381fd75be2a6b54dc1d6d4bc9dfd733a488` |
| `src/scenarios` | `da3a97a3d227cef7264d91a2e171707022630e0f` |
| `src/content-art` | `f9464465b8e40446b303d84f390d2ce26c76255b` |

| File | Bytes | Equal whole-file SHA-256 |
|---|---:|---|
| `src/core/tactics.ts` | 18531 | `31e5e81e058e83bf94181c1c7203e1022d64aa0d8f715fb1e0082f04173c9797` |
| `src/core/simulation.ts` | 106228 | `e301c65d0352ffe648a5bc4ee6acbda1f562164deacdfe60f8f3b03e7bdccf35` |
| `src/core/content.ts` | 19805 | `4495966583a38f122f23f40c8cfbc0c7655b00cc463b37efdf26a0c9b0a86160` |
| `src/core/commands.ts` | 7202 | `efd360936cb2dc168402299eea06eda1c50247c79ad675237a0a7a7318dd4632` |
| `src/core/navigation.ts` | 9590 | `27924b6c886d55ee2288a61101e2fa2f34853f6a20241e770c9c50c5d9c796a0` |
| `src/core/geometry.ts` | 4909 | `d01cb8c5003443415cd43bef63dd087dad7238b1e82732222a1f6bb0bbccd283` |
| `src/core/types.ts` | 8433 | `9f2c6c337d2dd6669c1cd8dbee30c01c89c41de3d9caf962d57854310fe8dd33` |
| `tests/combat-tactics.test.ts` | 16841 | `930e2db43072914103ae6ca8bed0b44a615e8f805d669abc7b211dfd589dc75d` |
| `tests/progression.test.ts` | 10047 | `b6170803243233951cf9089c06aad88aece054614d21ca54bf23238fe8c62057` |
| `tests/tactics-direction-saves.test.ts` | 2939 | `f55046466166d8318bbf9728478fd6ff89f8c210d5d12d2a71a4e3cc73c4e656` |

`src/core/tactics.ts:125` accumulates movement charge. Its impact function at`:131` removes the extra factor for a charged rider attacking a frontal holding spear and returns pike damage. `src/core/simulation.ts:419` applies the impact factor to the normal weapon hit and queues the pike return hit at`:421`. The pike check is automatic combat logic on the ordinary attack path. The five-tile source cap is present, but the native record only directly retains4.9; this report makes no observed-cap claim.

## Native partial checks and payloads

Original native run: `/tmp/ovf-native-combat-f18a50d-retry-20261001-zssa25k5`. Browser source identity is `f18a50d904c57ae1652f157b946ebd39d8d8923c`, SAVE4, simulation4.0.1, expected source-derived build ID `5e49e689af13d4eef08c0760f904ad0bce2c2eebaa1144dea5d89cadecf310c0`. Its frozen-input contract is SHA-256 `66f880c7ef685437e56b83708c03972c47cf5cbdb8f7846b243839b613e9fc31`. The separate actual checker/docs pin is `37bf0e794e7f62cf33347d2e92c739d593bf1cc4`.

Native check indices below are zero-based JSON array indices. Each "complete" label describes that individual check; completed=false and groups={} remain true for the full receipt.

| Check index | Retained name | Retained fields excluding authored setup |
|---:|---|---|
| 70 | `Native import preserves charge-stationary` | `{"name":"Native import preserves charge-stationary","fixtureSha256":"cbc3f18f0528b9d09dbc6bea80cb421147db4f01686b040ce54a5362de2d1619"}` |
| 71 | `charge-stationary-impact complete native round trip` | `{"name":"charge-stationary-impact complete native round trip","gameSha256":"7f294a7babe17024d11fc585a5c7d8408ae3ec2a8506fafb08274c40c79d8adb"}` |
| 72 | `charge-stationary-impact complete replay endpoint` | `{"name":"charge-stationary-impact complete replay endpoint","tick":66,"checksum":"86a8a388","commands":[{"type":"command","side":0,"command":{"type":"attack","ids":[51],"target":52,"queued":false}}]}` |
| 73 | `Native cavalry stationary impact records target and rider health` | `{"name":"Native cavalry stationary impact records target and rider health","targetLoss":15,"riderLoss":0,"tick":66,"chargeAfter":0}` |
| 74 | `Native import preserves charge-charge` | `{"name":"Native import preserves charge-charge","fixtureSha256":"6f1bfd0c84311bbfe774b4e6594388422d90ac9ecf31fea38186453cb6ab2650"}` |
| 75 | `charge-charge-moving complete native round trip` | `{"name":"charge-charge-moving complete native round trip","gameSha256":"0c4711a6aa9d4bc2e8768bd2be79f4dae3ce6c7fab009f0ccc25e6c1b0f75bfe"}` |
| 76 | `charge-charge-moving complete replay endpoint` | `{"name":"charge-charge-moving complete replay endpoint","tick":39,"checksum":"febf6d8e","commands":[{"type":"command","side":0,"command":{"type":"attack","ids":[51],"target":52,"queued":false}}]}` |
| 77 | `charge-charge-impact complete native round trip` | `{"name":"charge-charge-impact complete native round trip","gameSha256":"31cb4ec1f1f03a24e5bee989aa343bcdcc8197973b16ae8fd8b855c0d14e67ac"}` |
| 78 | `charge-charge-impact complete replay endpoint` | `{"name":"charge-charge-impact complete replay endpoint","tick":47,"checksum":"26571493","commands":[{"type":"command","side":0,"command":{"type":"attack","ids":[51],"target":52,"queued":false}}]}` |
| 79 | `Native cavalry charge impact records target and rider health` | `{"name":"Native cavalry charge impact records target and rider health","targetLoss":29.400000000000006,"riderLoss":0,"tick":47,"chargeAfter":0}` |
| 80 | `Native import preserves charge-stop` | `{"name":"Native import preserves charge-stop","fixtureSha256":"b6656cf9b1c38d3b350664a25c948a1407df699da4852328e06185b07718daa7"}` |
| 81 | `charge-stop-moving complete native round trip` | `{"name":"charge-stop-moving complete native round trip","gameSha256":"ee5c36956c3928b04e8c76289d6d90a07db80fce60ade5086fa7bca14f5821b2"}` |
| 82 | `charge-stop-moving complete replay endpoint` | `{"name":"charge-stop-moving complete replay endpoint","tick":38,"checksum":"9fff07a0","commands":[{"type":"command","side":0,"command":{"type":"move","ids":[51],"x":23.59375,"y":24.5,"level":0,"queued":false}}]}` |
| 83 | `charge-stop-interrupted complete native round trip` | `{"name":"charge-stop-interrupted complete native round trip","gameSha256":"5bbbaeb46804a65d3a3514741f6effaf5d5265bf5c1820662f46b320cdd386f6"}` |

Static full-payload readings corroborate the native observations. The target starts at 175 health in both authored charge-control initial states. Its stationary endpoint has 160 health; the moving endpoint has 145.6. Both riders retain 210 health. This uses only serialized state; no replay was stepped during this review.

| Saved checkpoint | Tick | Rider charge | Rider health | Target health | Retained equality |
|---|---:|---:|---:|---:|---|
| `charge-stationary-impact` | 66 | 0 | 210 | 160 | save and replay endpoint are byte-identical |
| `charge-charge-moving` | 39 | 4.899999999999992 | 210 | 175 | save and replay endpoint are byte-identical |
| `charge-charge-impact` | 47 | 0 | 210 | 145.6 | save and replay endpoint are byte-identical |

The native rider was selected via public UI controls and received attack commands. Receipt nativePointerInputs 10 and 11 retain target 52 visible to side 0, selected rider 51, displayed level 0, and right-click coordinates. The moving and impact replay records retain the ordinary public attack command. The movement checkpoint and stationary/charged impact save files are byte-identical to their exported replay endpoint save files, as retained and rechecked here.

## Failure and remaining gates

The browser stage stopped at `charge-stop-interrupted` replay readiness. It reached the native save round trip, then `native-context.mjs:96` timed out in ready() after replay import and before the endpoint seek/export. The retained lastState is replay tick 0, paused, with art.loaded=false. The required ready() conjunction therefore failed at least that art term. This does not establish missing camera or canvas fields, which were not retained in that snapshot.

The charge-stop interruption checkpoint retains charge distance0, but its replay endpoint failed. The later stop impact, sharp-turn case, frontal pike and rear pike encounters were not reached. No pike native check or pike native download appears in the receipt. The loop's aggregate comparisons at direction-defense:175–181 were not executed. No inference from generated fixtures or authored expected values is used as native proof.

The full 39 retry completed stages00–05, failed stage06, completed zero groups, and ran neither stage07 native history nor stage08 final asset acceptance. All 39 native encounters remain open in the sealed first-failure record. This ID8 proposal does not promote the group, relabel that failed run, claim native pike acceptance, or claim those skipped gates passed.

## Retained byte identities

The original first-failure manifest is SHA-256 `922c604e7d17c015d878cfd4f1ce0f133df2c208ef5f7ad9ca8b0a9c2b8d9fba`. A static hash-only reread in this assignment found all 303 original files, 94,034,440 bytes, equal to that manifest with zero mismatches. That check verifies retained bytes only; it is not stage08, native history, source execution or asset acceptance.

Selected original paths below are relative to the immutable run directory.

| Original retained path | Bytes | SHA-256 |
|---|---:|---|
| `browser/browser-native-acceptance.json` | 304363 | `7c24b87e4a1d8ef89e6164e86a544b29c272a5d00f2cf8d2c604b681a2fbd3a4` |
| `browser/charge-stationary-impact-save.json` | 363729 | `26c301669812bafa92c898d4df3328b4804df2cf71be91eb228507e80ced4242` |
| `browser/charge-stationary-impact-replay.json` | 172900 | `5837942d7e20b161c8f2043c2381999206949466b684bc1505fa9bd909fa1a59` |
| `browser/charge-stationary-impact-replay-endpoint-save.json` | 363729 | `26c301669812bafa92c898d4df3328b4804df2cf71be91eb228507e80ced4242` |
| `browser/charge-charge-moving-save.json` | 364454 | `3efa49bea4f2325874f66a87863ea122688d90655092cbff002b6e6f84af6601` |
| `browser/charge-charge-moving-replay.json` | 172863 | `201d411ee2f690fdc29f2682e8dbbb1f5b66a2f724e8f2f7c4627782a4268055` |
| `browser/charge-charge-moving-replay-endpoint-save.json` | 364454 | `3efa49bea4f2325874f66a87863ea122688d90655092cbff002b6e6f84af6601` |
| `browser/charge-charge-impact-save.json` | 365071 | `2cc229ebf303f3afd4fd6342ba2493f6f2814186d8993a633328be109b32b8af` |
| `browser/charge-charge-impact-replay.json` | 172864 | `e84746eb31db6421f0cde5626c7070843d83032887a594fad3d391edf2bfc36b` |
| `browser/charge-charge-impact-replay-endpoint-save.json` | 365071 | `2cc229ebf303f3afd4fd6342ba2493f6f2814186d8993a633328be109b32b8af` |
| `browser/charge-stop-interrupted-save.json` | 364736 | `6f9af6f29b31a1f0684df498ab73f54bee87c5523b99f1609e26a98e2520373f` |
| `browser/charge-stop-interrupted-replay.json` | 173122 | `25a6656c971a95e7b20e33dc85156601aaa6d992d39adcbae8201f16671d95f2` |
| `browser/native-acceptance-first-failure.png` | 138733 | `c97c786a8f562cb78c1065d01756afbadef81faf079a4f91cf797894fc9adb6f` |

The exact failing stop-interrupted replay and first-failure screenshot remain in their original sealed paths. This report is derived and sits outside that 303-file original set. The protected main checkout, dist and server were not written or controlled. The owned checkout remains at f18 with its pre-existing untracked node_modules symlink; no product, proof-script, ledger, trail or Git state was changed.
