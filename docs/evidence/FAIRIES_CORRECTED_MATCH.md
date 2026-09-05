# Fairy match on the corrected production build

On 2026-09-05, a normal browser match as fairies against orc AI ended in defeat at 496.80 simulated seconds (8:16). The production bundle was `index-6tDjccOB.js`, with current movement and scouting fixes. Source and production output stayed unchanged throughout the match. This is a completed human-controlled match, but its duration is below the requested 10–15-minute target.

The match ran through normal browser controls at 1920×1080. The earlier fairy match recovered at 7:15 was lost during turn-end tab cleanup; it is excluded. This fresh run began at `http://127.0.0.1:4173/?qa=1&match=fairies-final`. Its 105 retained telemetry snapshots start at 2.40 seconds and end at 496.80 seconds. Telemetry observes the simulation; it did not issue orders or inject resources, units or outcomes.

## Play observations

- Drag-selected workers gathered wood and ore. The Elderheart recruited more Tenders, reaching eleven workers before combat losses. Control groups recalled the headquarters, producers and construction workers.
- The first Bloomspire completed by 0:59. A Moonwell ordered at 1:06 had its builder accidentally redirected to ore; right-clicking its unfinished frame with a new Tender resumed construction. A second Bloomspire completed before 1:57. This was an input mistake during play, not a simulation stall.
- Mothbows, Thornblades and Veilweavers were recruited with paid queues. A Thornwatch and second Moonwell covered the approach. The UI rejected additional recruitment when living units plus reserved queue slots exhausted supply; losing a Moonwell later reduced available capacity.
- At 4:16 the army moved through the central ruins using attack-move and minimap camera controls. Advancing units revealed terrain and the orc settlement through fog. Seven combat units were selected at 4:31. No permanently stuck movement was observed during these advances; this does not prove all possible routes are clear.
- The first push met the grouped orc defense around 4:48. Q created illusion doubles. The attack lost most of the army; right-click retreat brought survivors toward the healing groves. The surviving Veilweaver later displayed 50/105 health during the defense. This run does not independently quantify healing rates.
- A third Bloomspire completed by 6:08. The counterattack destroyed the outer Moonwell, tower, builders and producers. Recruitment attempts during the supply shortage failed, and replacements arriving afterward were killed. A new Moonwell construction attempt was destroyed before completion.
- Five remaining workers built an inner Thornwatch behind the Elderheart by 7:53 and began a replacement Bloomspire at 8:05. The headquarters fell at 8:16 despite the attempted recovery. The defeat overlay appeared and the simulation recorded winner 1, orcs.

Two building placements were rejected for insufficient space; subsequent placements on clear ground were accepted. Some selected troops were obscured by trees or roofs; F2 and health bars helped track the army, but the overlap limitation remains.

## End and restart

The defeat snapshot records the fairy headquarters at zero health, five surviving fairy workers and no population capacity. Player resources were approximately 1,973 wood and 1,452 ore; orcs retained approximately 4,950 wood and 2,387 ore. Large banks alongside empty military forces suggest that production throughput, supply losses and combat losses mattered more than resource exhaustion in this particular game. They do not establish a balance fix.

Clicking the end-screen **New skirmish** reset the clock to 00:00, resources to 420 wood / 220 ore, population to 6/12 and selection to empty. The fresh match was paused at 11.50 seconds. The saved restart snapshot was captured after resetting the temporary viewport override, so its viewport is the ordinary panel size rather than 1920×1080. The tab was explicitly marked for retention in a later turn.

Browser error/warning logs were empty when checked after restart. Audio telemetry during the completed match recorded 20 training cues, eight construction completions, 365 attack cues and one defeat cue, with a running unmuted audio graph and nonzero signal. This verifies scheduling and graph activity, not physical listening.

Evidence:

- `fairies-corrected-session.jsonl`: isolated normal-match snapshots.
- `fairies-corrected-defeat.json`: final outcome, economy, entities and audio.
- `fairies-corrected-restart.json`: paused fresh match after end-screen restart.
- `pre-harvest-current-verification.json`: source hashes and the retained 58-test result for this unchanged build.

The match proves current-build gameplay through defeat and restart. It does not prove the pacing target, competitive faction balance or a current-build fairy victory. Earlier fairy victory and orc outcome evidence remains separately versioned.
