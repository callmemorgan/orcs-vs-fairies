This evidence verifies the isolated scenario and campaign integration at
`e5cf87e`, using SAVE3 and simulation revision `3.2.0`. It precedes the final root
assembly, SAVE4 migration, content revision and newer main-app import fences.
These results must be regenerated against the frozen combined source.

All 30 authored missions won through ordinary scenario commands. Their journals
replayed to identical final checkpoints. Both campaign choices completed all
four chapters for all six factions, with profile reload, surviving soldier
identity, casualty removal and reserve retention checks. The conquest proof
verified five journals, expired passage protection, history bounds and funded
allied reinforcements.

The persistent-army report verifies combat-earned rank and promotions, a native
Iron Aegis, paired tower hits of 13 and 17 damage, a deployed casualty, retained
reserves, destination artifact ID remapping and recorded save continuation. Its
42 assertions pass, and the regression test repeats the full proof with the same
fingerprint. The source and evidence paths are in `provenance.json`; full private
journals remain at those paths. Earlier numbered attempts are retained.

The main-app browser observations used the CUA browser API at
`http://127.0.0.1:5183/`. A normal HUD hold order appears in the named ordinary
save's campaign journal. Reload restores the owner and mission. A genuine
historical bound SAVE3 checkpoint remains at tick 934 with commands and
simulation disabled through mission-panel and photo-mode checks. The corrected
result overlay shows the authored mission outcome. The download observer timed
out even though the interface confirmed "Save downloaded"; named storage and
reload supplied the inspected session artifact.

Rerun commands are in `scripts/scenarios/persistent-army/README.md`. The other
generators are `prove-campaigns.ts` (`all`), `prove-alternate-profiles.ts` (output
path, then `primary` or `alternate`), and `prove-conquest-review.ts` (`corrected`,
output path, private archive directory). Bundle them with esbuild for Node and
run from the checkout root. Every proof output is append-only.
