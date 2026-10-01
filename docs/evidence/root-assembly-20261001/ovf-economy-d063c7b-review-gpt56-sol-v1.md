# Economy evidence review at d063c7b

GPT-5.6 Sol accepts evidence-only commit `d063c7b4e29ad9d204273d34ac15b1e04082d5f6` with no package finding. It recommends promoting feature IDs **12, 13, 16, 19 and 20**. IDs **11, 14, 15, 17 and 18** should remain in progress until the named direct behaviors have current assertions or fresh browser checks.

## Commit and package admission

`d063c7b` has one parent, `417b367`, and imports evidence-only source commit `c6991eea7bbefb6609c339b3d354ef72c35716bc`. The independent import audit checks all 246 added paths, their parent entries, result blob IDs and modes; it reports an exact import with no non-additions or mismatches. The commit changes no product or test source.

The retained package is `docs/evidence/economy-final-acceptance-20261001`. I recomputed every entry in its self-excluding hash manifest. The package has 246 files: 245 listed files plus `artifact-hashes.json`. Every listed byte count and SHA-256 matches, with no missing or extra entries. The external SHA-256 of `artifact-hashes.json` is `84fac82af4ed7b3e90432d9f3817ccd55ce14dd4c108ec68799e6be6164c7317`.

`accepted-runs.json` keeps the families separate. Economy uses `final-economy-4.0.1/browser` at source `c86e273c70738f144a00fe75f5ecf39e7fa324d8` and rules `4.0.1`. Modal and settlement remain at `db36593f816a57e29220d760de14455cec969f0b` and rules `4.0.0`. The preserved first-failure economy, modal and settlement browser proofs still say `passed: false` and `result: "failed"`; the package does not relabel them.

The fresh economy proof records 25 true checks, no page, console, request or HTTP errors, and a closed browser. Its source pin and production source commit are `c86e273`; its build ID is `af4b40282bb086e0dccf5aad4e8c38819b2d2eb80370fb749e728a9f33cdb87a`. The environment identity says source and script bytes match the pin, compiled and module inventories are stable, and the observed HTTP work drained through browser close.

The commanded, reloaded and replayed native receipts all exit through the accepted family, decode the complete file, load and resave the complete game, and replay to complete-game equality. All three identify SAVE4, rules `4.0.1`, final tick 8,494, and the same input SHA-256 `7f474c8981ff609c04f1f83913e50e6b93a55038ddc9b1d740620920efebcd8b`.

The historical modal proof retains 12 checks and the settlement proof retains eight. Both remain pinned to `db36593`, rules `4.0.0`, and both retain complete save/report/reload/replay equality. They support their historical claims only.

The current full-suite evidence is the accepted 157-file, 2,920-test run. Its 917 inputs match Git at `4a71cd0`, and the retained runtime bridge proves the same path, mode and blob IDs at the frozen gameplay pin `c86e273`. I did not rerun the suite or browser for this evidence-only review.

## Promotion recommendations

| ID | Fresh browser checks | Current full-suite evidence | Recommendation |
| --- | --- | --- | --- |
| 11 Forestry | `forestryOrderAndPayment`, `actualConstructionAndGroveMaturity`, `canvasHarvestDepositedWood` | `tests/economy-settlements.test.ts:18` proves payment, save continuity, growth, harvest and fire. `tests/economy-world-integration.test.ts:117-121` proves layer-specific burning. `tests/economy-cancellation.test.ts:17-44` proves interrupted planting and later maturity. | Hold. No direct current test or fresh browser check rejects planting on an obstructed valid-level tile, although the requirement names obstruction. |
| 12 Deep mines | `deepMineFoundation` | `tests/economy-settlements.test.ts:19` rejects a live deposit, builds on depletion, exhausts the finite second reserve and rejects a second mine. `tests/economy-tools.test.ts:45-49,90-91` covers the native controls and exhausted-site display. | Promote. |
| 13 Crystal overcharging | `extractorFoundation`, `overchargeToggled` | `tests/economy-settlements.test.ts:20` compares equal-time normal and overcharge harvest, reproduces the seeded damage through save continuation, disables overcharge and repairs the extractor. | Promote. |
| 14 Trade caravans | `caravanRecruitmentPaid`, `physicalTradeRouteOrdered`, `completedRoutePaidFromFiniteMarket` | `tests/economy-cargo.test.ts:40-96` proves physical loading, arrival-only income, capacity bounds, destination loss and loaded checkpoints. `tests/economy-cargo-integration.test.ts:38-53` proves a constructed-settlement route. `tests/economy-world-integration.test.ts:96-115` proves killed cargo loses the trade reward and drops finite stock. | Hold. Capacity and lost delivery are covered, but no current test or fresh browser comparison proves that route distance changes trade value. |
| 15 Neutral markets | `marketDemandAndCurrency` | `tests/economy-cargo.test.ts:100-140` proves demand-priced quotes, conservation, currency choice, price clamps and atomic insufficient-funds/exhausted-stock rejection. `tests/economy-cargo-integration.test.ts:55-62` proves a real visible market transaction and save. | Hold. No current assertion or fresh browser check proves bounded demand recovery over time. |
| 16 Supply raids | `militarySupplyRaidOrdered`, `raidAndSalvageReachedOwnedStorage` | `tests/economy-cargo.test.ts:143-182` proves storage theft, carried stock, required return, raid ledger separation and death drops. `tests/economy-cargo-integration.test.ts:64-70` proves the public command, save continuation and wallet deposit. `tests/economy-world-integration.test.ts:96-115` proves finite cargo recovery after carrier death. | Promote. |
| 17 Battlefield salvage | `workerSalvageCollectionOrdered`, `raidAndSalvageReachedOwnedStorage` | `tests/economy-cargo.test.ts:163-176` proves bounded paid-cost salvage and one-time collection by competing workers. `tests/economy-cargo-integration.test.ts:72-82` destroys a paid structure, collects with a real worker and deposits once. `tests/economy-world-integration.test.ts:146-154` proves a paid mod siege cost produces salvage. | Hold. No current assertion or fresh browser check proves expiry or decay. |
| 18 Regional warehouses | `warehouseFoundationAndWorkerOrder`, `workerLocalDeliveryConfigured`, `localStockDeliveryOrdered` | `tests/economy-settlements.test.ts:21` proves local gathering leaves the wallet unchanged until physical delivery. `tests/economy-cargo.test.ts:57-79` proves local stocks, capacity waiting and allied endpoints. `tests/economy-world-integration.test.ts:57-65` preserves a loaded route while a warehouse is placed. | Hold. No current direct case destroys a transfer source and proves that only already-delivered stock remains. |
| 19 Settlement specialization | `expansionSpecializationPaid` | `tests/economy-settlements.test.ts:22-25` proves paid exclusive mining, research and military choices with local 1.3, 1.35 and 1.3 effects and save equality. `tests/settlement-military-runtime.test.ts:94-192` proves exact paid production timing, SAVE4 continuation and complete command replay. `tests/settlement-mining-runtime.test.ts:33-75` covers paid mining locality and exclusivity. | Promote. |
| 20 Resource contracts | `contractAcceptedAndDeliveryOrdered`, `completedContractReward` | `tests/economy-cargo.test.ts:186-215` proves nearby acceptance, physical delivery, one reward, finite village funding, preserved deadlines, expiration and late-delivery refund without reward. `tests/economy-cargo-integration.test.ts:84-94` proves the public command path, SAVE4 continuation and finite reward. | Promote. |

These recommendations treat every clause in `docs/HUNDRED_FEATURE_ARCHITECTURE.md:196-205` as required. The five holds are evidence gaps, not confirmed product defects.

## Behavioral review

Ordering: none. The commit adds immutable evidence files and does not change runtime ordering.

Failure paths: none in product code. The archive keeps the failed runs under their original labels and adds separate accepted-run pointers.

Observability: the commit adds source/build inventories, browser response records, logs, screenshots, complete sessions, native verification receipts, accepted-run metadata and a portable retained-evidence auditor. It does not change game telemetry.

Stale writes: none. The commit contains additions only; it changes no shared runtime state or writer.

Test delta: none. No test source changes in this commit. Runtime support comes from the previously accepted 2,920-test suite and the fresh 25-check economy browser family.

The machine-readable audit is `/tmp/ovf-economy-d063c7b-package-promotion-audit.json`, SHA-256 `24de5cca843d1330c9da50381c586a34cf45d8bf0d943dcad70e4d1c82bd4946`. The exact-import audit is `/tmp/ovf-economy-d063c7b-import-audit.json`, SHA-256 `51004eae980000df99903938bd68703a5bf40e39129508b5d623ec604c7ecc5d`.
