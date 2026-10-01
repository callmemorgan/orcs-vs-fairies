# Native combat charge fixture repair static review

No defect found in the proposed fixture change. This was a static review only. I did not edit product code or run the candidate, compiler, build, tests, simulation, browser, server, or dependency commands.

## Reviewed material

The candidate is `/tmp/ovf-native-combat-453c221-retry-20261001-85q9lr0g/proposed-charge-fixture-repair/direction-defense-fixtures.ts`, SHA-256 `3d53ed12a4eb2ad1ab9777b44e4f0eda0d3229085b4083e0e18b28095d908703`. Its patch is SHA-256 `853add850701918c71b798240db2f4584b9a8ee6fa18f3a84ec33d0c33fc57ce`.

The original candidate-package file is SHA-256 `fb6f04ea660b122fd3aa6f952d78a5c01ec997d4f67a9bbd85f16d86b0564d8f`. It matches `scripts/acceptance/direction-defense-fixtures.ts` at both `453c2218af9973b9eca8fb78392435bd9d46a740` and `a144ad3f3dddd0003f9553541908e2254f2444c6`; both pins contain Git blob `3c25e9c72d0e7b4ab8f330f6be20cb04dfb450a3` with mode `100644`. The relevant visibility, combat, tactics, runner, and audit files also have identical Git blobs at those two pins.

The patch changes one line. Stationary remains at x=24.7. Stop and turn remain at x=18.5. Charge, pike-front, and pike-rear move from x=18.5 to x=19.5. Target position, facing, held order, cooldown, stop and turn destinations, generated metadata, runner behavior, and audit assertions are unchanged.

## Failure and visibility

The retained browser receipt is `/tmp/ovf-native-combat-453c221-retry-20261001-85q9lr0g/browser/browser-native-acceptance.json`, SHA-256 `e2769b8838bc77c32f87655e3eea901d5654ccbccc41cb7633b2d0393a6e3dad`. It completes the stationary case, imports charge-charge, then stops before pointer input because target 52 is not visible. Its last state has the rider at `(18.5, 24.5)`, target 52 at `(26, 24.5)`, visible tile 889, and missing target tile 890.

The target's fog tile center is `(26.5, 24.5)`. Visibility measures tile centers and uses `distance <= sight`. Cavalry uses the ordinary non-ranged sight value of 7. The fixture makes the surface flat grass at elevation zero and pins clear daylight, so the height bonus is zero, the environment factor is one, and the grass ray is unobstructed. The old source-to-tile-center distance is 8. The candidate distance is 7, so tile 890 becomes visible at the inclusive boundary and the runner's pre-pointer visibility assertion can pass.

## Movement and combat semantics

From x=19.5, the rider is 6.5 tiles from the target entity. Cavalry melee range is 1.5, leaving five tiles of travel before attack range. Charge accumulation is capped at five. The runner's moving checkpoint requires at least four charge tiles while target health is unchanged; after four tiles the entity separation is still 2.5, outside melee range. The candidate therefore retains both the four-tile checkpoint and the full five-charge cap.

The pike cases retain their combat distinction. Both still accumulate a full charge. Pike-front keeps the spear held and facing the rider, which meets the braced-pike condition and removes the charge damage bonus while returning pike damage. Pike-rear keeps the opposite facing, so it retains the charge bonus and returns no pike damage. The exact frontal target-loss assertion and the front/rear comparison remain supported by the same combat code.

Stop and turn need their original x=18.5 start. Their first command is a ground move to x=23.6, so it does not require the initially hidden target. The ordinary movement reach leaves enough travel to exceed the four-tile checkpoint before the hold or sharp-turn interruption. Starting those cases at x=19.5 would leave less than four tiles before the move completes. The conditional in the candidate limits the shift to the three cases that attack immediately.

## Result and limits

The one-line change addresses the recorded failure without weakening or bypassing the visibility assertion and without changing product behavior. I found no source-scope, visibility, pathing, charge, pike, or helper-assertion defect.

The candidate has not been executed. A later integration still needs a new generated fixture set, an integrated source/proof pin, the requested applicability bridge, and the native proof run. This review makes no runtime-success claim.
