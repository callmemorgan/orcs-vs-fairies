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

When a commander cannot replenish recruitment funds, expired retreats release without waiting for another recruit. The check runs after spending. It compares every wood, ore and crystal cost of an age-legal default recruit with its bank, finite owned cargo and finite visible deposits. A worker must be able to collect and deliver the resource through permitted terrain and obstacles to the nearest completed owned drop-off. Paid fighter queues still count because their costs are already charged. A new worker must be legally payable, including custom crystal costs; an absent barracks adds its construction cost. Hidden deposits and obstacles do not alter the decision. Surviving fighters can then attack without the normal army-size threshold. No resources, health or damage are added.

Version 3 saves preserve the actual AI decision batch count and each player's decision deadline, decision count, observed unit memory, retreat records and recruited fighter count. Version 1 and 2 saves pass their original strict validators before migration. Importing an older state does not promise the old AI's future behavior or historical replay playback.

## Allied coordination

Two or more living allied AI commanders coordinate from reports of their own available troops, visible threats, remembered buildings and public starting positions. The planner never reads a full match. One commander scouts at a time, and one can reserve an observed expansion deposit. Scout reservations last 30 seconds and expansion reservations last 45 seconds.

A shared attack needs at least two owners and four combined fighters. Every owner must already know the target's coordinates. A wave waits at least three seconds, has a 12-second deadline, and issues all participating owners' ordinary attack-move commands in the same simulation step. If a commander has enough troops for its ordinary solo wave but no shared attack forms, it waits at most 12 seconds beyond its wave deadline before attacking a location it already knows. Death, elimination, a request or an emergency defense can remove troops from a pending wave. A commander that cannot recover its income keeps its final assault and leaves coordination; a remaining commander resumes ordinary solo waves.

A commander can report a visible threat near its headquarters and ask allied troops to help at that waypoint. This communication works when shared vision is disabled. The recipient receives attack-move coordinates, but gains no enemy entity, targetable enemy ID, observed-unit memory, recruitment counter information or visible fog tiles. Moving the reported enemy through the fog does not update the recipient's knowledge.

## Ally requests

The shared toolbar opens the "Ally requests" dialog, which sends defend, scout, attack and resource-support requests to a living allied computer player. It shows accepted, active, completed, failed and cancelled statuses. Each recipient accepts one active request. Its requester can replace or cancel it; another ally cannot overwrite it. Headquarters defense takes priority, and a request can wait for troops or spare resources.

Defend requests expire after 90 seconds and complete after assigned troops guard the observed destination for 20 seconds. Scout requests expire after 150 seconds and complete when the scout reaches and observes the destination. Attack requests expire after 180 seconds and complete after the troops observe a cleared area for three seconds. Arrival allows for the army's ordinary formation. A visible target request copies its position and map level once; it never follows hidden movement. Losing every assigned troop or moving every assignee to another map level resets the arrival clock before replacement troops take over. Taking control of the recipient in a loaded terminal session fails its pending AI request on the next simulation step.

Resource support expires after 30 seconds. The recipient sends the requested amount once it can retain its faction's worker cost in wood, ore and crystal. The transfer debits and credits spendable wallets atomically and records a receipt. Direct transfers can also go to a living human ally. They conserve each resource and cannot debit another player's wallet.

The terminal and online server accept the same JSON commands. The terminal session or authenticated server seat supplies the issuer and payer; these fields cannot be supplied in the command. Player indices start at zero.

```json
{"type":"allyDirective","ally":1,"directive":"defend","x":20,"y":24}
{"type":"allyDirective","ally":1,"directive":"scout","x":32,"y":28}
{"type":"allyDirective","ally":1,"directive":"attack","target":123}
{"type":"allyDirective","ally":1,"directive":"support","resources":{"wood":50,"ore":20,"crystal":0}}
{"type":"cancelAllyDirective","directiveId":1}
{"type":"transferResources","recipient":1,"resources":{"wood":50,"ore":20,"crystal":0}}
```

Requests and transfer receipts are visible only to teammates. Public observations exclude assigned troop IDs, the planner's memory, private unit orders and private resource balances. Saves preserve pending requests, arrival clocks, reservations, waves and bounded receipts, and validate active assignments against living owned fighters on the destination level.

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

Run allied policy, simulation, UI, terminal and actual HTTP/WebSocket checks with:

```sh
npx vitest run tests/team-ai-policy.test.ts tests/allied-ai.test.ts tests/ally-directives-ui.test.ts tests/allied-cli.test.ts tests/server-allied.test.ts
```

Run natural four-AI matches with ordinary starting resources and no requests with:

```sh
AI_TEAM_OUTPUT=work/ai-team/local npx vitest run --config vitest.ai-team.config.ts
```

Four-player small and medium map requests both normalize to large 64x64 maps, so the runner omits the duplicate original-order medium case. The swapped-faction case adds a distinct arrangement. The reports count retained shared waves; a wave removed immediately at its deadline can be absent from that count. These checks establish allied behavior and completion, not team balance.
