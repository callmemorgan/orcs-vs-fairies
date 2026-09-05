# Uninterrupted Fairy defensive match

The unchanged current production build `index-BbPjUpKo.js` was played as Fairies from a fresh start through defeat at 546.3000000000509 game seconds (HUD 9:06), followed by a successful restart. The normal map, economy and AI were used. `fairies-defense-session.jsonl` retains 119 snapshots beginning at 3.60 seconds and ending after defeat. No interval between recorded game times exceeds seven seconds, and the match contains no pauses. The detached local preview stayed live throughout. `fairies-defense-provenance.json` binds the observed page script and viewport to the retained source and evidence hashes.

## Play and outcome

The player assigned two workers to wood and three to construction using drag selection. The first Bloomspire was ordered at about 0:27 and complete by 0:51. Its first Thornblade recruitment began at about 1:02; a Mothbow followed. Three Tenders were recruited from the Elderheart, two assigned to ore, and builders returned to wood between jobs. A Moonwell completed at 1:20. The opening was more orderly than the earlier harvest match, but it still had recruitment gaps and slow responses while the player operated the UI.

The single early Orc scout caused losses before a Thornwatch and nearby workers stopped it. The original Moonwell was destroyed and replaced. Both towers were positioned near the replacement Moonwell. The player built a second Bloomspire and kept a mixed force near these defenses. The first full Orc wave was repelled. The second Bloomspire survived at approximately 162/800 HP, but the player did not repair it before the next wave. Nine workers were the maximum in this match.

The surviving production buildings trained reinforcements while a third Bloomspire was built. Manual Q at about 7:34 visibly activated Veil Doubles and displayed a 35-second cooldown; the selected count rose from seven real combat units to nine including doubles. Earlier doubles were automatically created during eligible combat, as implemented in the shared simulation. The retained trace shows illusions around 348.60–353.60 seconds, 388.60–403.60 seconds, and 458.60–468.60 seconds. These groups are not all attributed to manual Q. The Moonwell was positioned near the army, but sampled HP changes in this match do not establish actual healing; the earlier harvest match separately does.

The second full Orc attack broke through around 7:49–8:37. The damaged Bloomspire fell, then the remaining defenses, production and workers. Attempts to build a fallback tower failed because the selected workers died before the command could be applied. The Elderheart fell at 9:06. Final state records no surviving Fairy units or supply, about 804 wood and 628 ore; Orcs had 18 population, 32 capacity, about 2715 wood and 1562 ore.

The real browser showed the Defeat overlay. New skirmish restored 00:00, 420 wood, 220 ore, 6/12 population and empty selection. The restart was paused at 10.20 seconds and saved in `fairies-defense-restart.json`. Warning/error logs were empty after defeat. The page script was read as `http://127.0.0.1:4173/assets/index-BbPjUpKo.js`, and the viewport was 1920 x 1080. All current verification source hashes still matched after play.

Audio diagnostics showed a running, unmuted graph with 20 train, eight build, 398 attack and one defeat cue, and a nonzero last signal. This verifies graph scheduling and signal, not physical speaker output.

## What this establishes

This is a complete current-build human-controlled browser match with continuous telemetry, successful defensive combat, manual and automatic illusion observations, defeat and restart. It strengthens the current Fairy gameplay evidence. It does not establish balanced factions or prove the 10–15 minute human pacing target: the observed loss was 9:06, and earlier queue gaps, an unrepaired building and slow responses remain confounding factors.

A bounded offline follow-up compared unchanged rules with 1.25x and 1.5x building HP. All normal AI matches still favored Orcs, and the Fairy-start duration barely changed. The results in `work/fortification-study` do not justify adopting larger building HP merely to extend the clock. Building values remain unchanged while comparable-cost mixed-army strength is investigated.
