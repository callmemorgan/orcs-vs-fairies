No concrete static blocker found for the camera correction at 8db0f2dd0b38302f0f588c80316db082bc49e9b3. Candidate SHA-256 09d1eaecb6722e2b2eabf4330e203e3db80d507a7e4462575cbace695df1e2e1 changes only canonical-main-smoke.mjs line43 by adding await ctx.selectTroop(ids.army[0]) before F2 selection.

The former selectMany began with that same public troop-list selection. Its button selects and centers the chosen troop through WorldTools, main and GameScene.centerOn. The added call restores that camera setup while F2 and its complete expected-ID check remain unchanged. No fixture, product or behavior assertion changes.

The r3 report retains all six selected IDs and accepted line formation before canvasInput rejects the destination click. At the recorded viewport size, the previous native troop-list-centered camera projects the destination to 1104,621.5 and F2 focus to656,429.5. Source-derived HQ centering places the destination under the tactical HUD. R3 display scroll coordinates were recorded at startup before cases, so they are not treated as a failure-time camera sample.

This is a static review. A fresh authorized native run must prove the camera correction and later cases. No runtime, root writes, signals or original evidence changes occurred.
