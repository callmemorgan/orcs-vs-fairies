# Allied AI evidence, October 1, 2026

Feature commit `ccdede6872933d74cae4d90dc7b8eefa1272bdce` adds coordinated allied AI and authenticated requests. The final core/server/runner files match all 27 recorded hashes and their archived source copies. The source-before HEAD predates the feature commit because the run started before committing; its file hashes match the committed implementation.

Both natural four-AI matches used starting wallets of 420 wood, 220 ore and zero crystal, income factor 1 and population limit 100. The runner issued no directives, transfers or injected orders. Every owner gathered resources, recruited paid fighters and attacked. The final losing headquarters died through ordinary combat. Actual final saves independently load and resave byte for byte.

| Arrangement | Finish | Observed shared launches | Observed solo launches |
| --- | ---: | ---: | ---: |
| small-orcs-fairies-dwarves-undead | 800.05s | 13 | 0 |
| medium-dwarves-undead-orcs-fairies | 992.60s | 12 | 3 |

Orcs/Fairies won team 0 in both arrangements. The swapped arrangement exercised the full-army solo fallback alongside shared launches. The reports contain headquarters damage and deaths, owner orders at launches, economy samples, saved games and SHA-256 digests. They record zero resource/order violations and zero directives/transfers.

The focused run passed 340 tests across 16 files. It includes strict commands and saved assignments, real scouting/defense/combat, the no-reinforcement final assault, the worker-only ally wait, 64-fighter formation arrival, fresh arrival clocks after death or emergency, saved continuation, UI guards, terminal replay, authenticated WebSocket commands, duplicate retries and durable restart conservation. TypeScript passed. The production build passed with the existing large Phaser chunk warning. Logs and the independent saved-game reload output are included.

Run the natural checks from the repository with:

```sh
AI_TEAM_OUTPUT=work/ai-team/local npx vitest run --config vitest.ai-team.config.ts -t 'small-orcs-fairies-dwarves-undead|medium-dwarves-undead-orcs-fairies'
```

Run the allied behavior checks with:

```sh
npx vitest run tests/team-ai-policy.test.ts tests/allied-ai.test.ts tests/ally-directives-ui.test.ts tests/allied-cli.test.ts tests/server-allied.test.ts
```

Four-player small and medium requests both normalize to large 64x64 maps. These two faction/slot arrangements establish integration and completion, not balance. Launch counts cover retained waves; deadline launches immediately removed from planner state can be absent. The earlier duplicate and intermediate evidence remains untouched in the working evidence folders.

This branch still uses the existing simulation and maps based on `2c21d97`. The new allied modules use an exact copied `geometry.ts` from the root's `d1171b9`; that dependency is excluded from the feature commit. These results do not prove the assembled numerical changes or cross-runtime replay identity. Root integration owns combined SAVE4/replay compatibility, the final online adapter and actual local/online browser panel verification.
