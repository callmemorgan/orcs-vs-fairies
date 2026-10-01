This proof plays the authored Dwarves campaign through three verified victories.
The cannon earns XP, rank and promotions through combat. Bryn defeats the wounded
enemy commander, recovers its native Iron Aegis and equips it. Paired saved runs
measure the artifact's effect on actual tower damage. A carried gunner dies in the
second chapter, and the northern works branch leaves earned and trained soldiers
in reserve for the third chapter.

The artifact allocation check uses a separate authored destination. Ordinary
combat creates a local native drop before the genuine survivor is deployed. This
forces its archived artifact ID to be remapped around an occupied destination ID.
That check does not advance the campaign profile.

Run from the repository root:

```sh
node_modules/.bin/esbuild scripts/scenarios/prove-persistent-army.ts --bundle --platform=node --format=esm --outfile=work/prove-persistent-army.mjs
node work/prove-persistent-army.mjs work/campaign-content/persistent-army/review-1
```

Each output directory is append-only. A failed run retains its checkpoint,
recording, active profile, accepted commands, combat events and failed assertions.
Successful runs also retain every intermediate active profile, replayed journal,
final checkpoint and the source hashes in `report.json`. Two runs against the same
source should produce the same `deterministicSha256`. The focused regression test
runs the proof twice and compares that value.

```sh
npx vitest run tests/campaign-persistent-army.test.ts
```
