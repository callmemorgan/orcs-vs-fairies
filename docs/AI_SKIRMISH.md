# Skirmish AI

Each player has a difficulty, personality and opening. Set these through `MatchPlayerConfig.ai` or the legacy two-player helper's `GameOptions.ai` array. The constructor validates choices and fills missing values. `state.aiConfigs` contains the complete choices and saves preserve them. The default is normal difficulty, balanced personality and an infantry opening.

## Difficulty

| Setting | Decision interval | Decisions skipped | Recruitment queue target | Observed army counters |
| --- | --- | --- | --- | --- |
| Easy | 2.8 seconds | Every fifth decision | 1 | Stays with its opening composition |
| Normal | 1 second | None | 2 | Adjusts composition after scouting |
| Hard | 0.55 seconds | None | 3 | Makes larger composition adjustments |

Difficulty does not change starting resources, gathering rates, costs, damage, health or population limits. Explicit match handicaps remain separate. Easy hesitation emits a message in the match events. Every AI order passes the same command validation as a human order.

## Personalities and openings

Rush uses fewer workers, sends smaller attacks sooner and delays economic research until 100 seconds. Fortify gathers crystal for a tower before its first barracks, then waits for a larger army. Expand starts with a depot, recruits more workers and claims an observed outer deposit earlier. Raid favors cavalry and sends small waves toward observed workers or depots. Balanced keeps the original worker goals and attack sizes.

Openings can be selected separately from personality. Infantry rush starts with a barracks. Tower defense funds its tower with normal crystal gathering before building a barracks. Fast expansion starts with a depot and then a barracks. Cavalry raids starts with a barracks and prioritizes Town Age research before economic upgrades. The menu describes each plan and weakness through `SkirmishOptions`; the main application must mount that module and pass its choices to the match constructor.

## Observation and regrouping

The commander reads its own troops and resources, visible deposits and visible hostile entities. Shared team vision follows the match rules. Enemy unit sightings are remembered for 90 seconds and affect recruitment, including spears against cavalry and cavalry against ranged troops. Moving an unobserved army or changing its roles does not alter AI orders. Remembered buildings and public starting positions guide scouting and attacks.

A wounded or outnumbered fighter away from its headquarters retreats toward an owned rally point. It waits for its regroup deadline and for a living fighter recruited after the retreat began to reach that rally point. A recruit that dies before arriving does not satisfy the requirement. Other healthy fighters continue fighting. Production buildings send new troops to the same rally point using public rally commands.

Version 3 saves preserve each player's decision deadline, decision count, observed unit memory, retreat records and recruited fighter count. Version 1 and 2 saves pass their original strict validators before migration. Importing an older state does not promise the old AI's future behavior or historical replay playback.

## Repeating the checks

Run the targeted behavior and migration checks with:

```sh
npx vitest run tests/ai-policy.test.ts tests/ai-modes.test.ts tests/ai-saves.test.ts tests/skirmish-options.test.ts tests/saves.test.ts tests/team-saves.test.ts tests/factions.test.ts tests/team-observation.test.ts tests/team-match.test.ts
```

Run the six-faction subset with four personalities and both starting-slot arrangements with:

```sh
AI_LADDER_OUTPUT=work/ai-modes/ladder npx vitest run --config vitest.ai.config.ts
```

The subset tests completion, recruitment, deposits, combat, positions and nonnegative economy. It compares hard personalities against a normal balanced opponent; its eight games do not establish faction balance or relative difficulty win rates. The full faction ladder remains necessary after the assembled game changes.
