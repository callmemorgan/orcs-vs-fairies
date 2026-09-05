# Current-rate Orc match with interruption

The normal Orc skirmish in the in-app browser used `http://127.0.0.1:4173/?qa=1&match=orcs-harvest` and production `index-BbPjUpKo.js`. The script URL was read from the page after victory. All source hashes in `current-verification.json` still matched after the match. The browser viewport during the resumed battle was 1920 x 1080.

The player gathered both resources, recruited workers and mixed combat units, and built three Foundries, two Timber Yards and a Watchtower. An early attack lost units and retreated. After the browser panel was closed, the loaded tab survived and the simulation continued without player input from approximately 6:10 until recovery and pause at 10:20. This interval disqualifies the run as normal 10–15 minute pacing evidence.

On resumption, F2 selected 16 combat units. Attack-move took the combined army through the central ruins toward the Fairy outpost. The player queued more Ironjaws, Boltspitters and a Wardrum using recalled Foundry control groups. War Cry was activated during combat at approximately 10:59; the UI showed its 25-second cooldown. The visible army fought defenders around the Fairy buildings. The victory overlay appeared at 11:24, stating that the enemy stronghold had fallen. The HUD showed 3439 wood, 2876 ore and 26/32 population. Browser warning/error logs were empty at the final inspection. This is observed browser outcome evidence, not a claim of an uninterrupted or normally paced match.

Clicking the victory screen's New skirmish button reset the HUD to 00:00, 420 wood, 220 ore, 6/12 population and no selected units. The initial base and fog were visible again. The new match was paused at 8.35 seconds. `orcs-harvest-restart.json` records this paused restart state after telemetry was restored; it is not the victory state.

## Evidence gap

The local preview server was no longer listening on port 4173 when inspected after victory. The last existing telemetry snapshot was dated 2026-09-05T07:19:19.459Z at game time 43.10 seconds. The loaded browser game continued without its server, but subsequent QA POST requests could not be recorded. No full match trace or precise subsecond victory time is available. Do not label the old `work/browser-latest.json` snapshot as this outcome, reconstruct missing snapshots, or claim audio telemetry for the victory.

The preview server was restarted with `npm run preview -- --host 127.0.0.1 --port 4173`. Automatic snapshots resumed from the existing paused browser tab, demonstrating that the collector is operating again. A current-rate Fairy match and uninterrupted normal pacing observations remain open.
