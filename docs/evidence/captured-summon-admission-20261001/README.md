# Captured summon rule admission

Source pin `c5b55ee` is based on root checkpoint `115a537`. A captured Gravecaller previously checked the new owner's allowed melee roster, then spawned the original faction default and ignored the selected definition. This could create an excluded or unpicked fighter. It also broke permitted alternative melee raises for uncaptured custom casters. Captured Fairy abilities and automatic Grove decoys likewise created new definitions without checking the current owner's restrictions.

The raise path now resolves the original faction roster, selects a permitted melee definition and spawns that exact ID with the original provenance. Fairy clones check the resolved original definition, and Grove template selection checks the template ID before allocation or cooldown. Saves accept any admitted permitted original-faction melee with the existing raising ability, health and lifetime requirements. The current save admission checks only born summons (`raised` or `illusion`) after validating match rules and draft history. Ordinary captured troops remain valid.

`focused-tests.log` records 92 passing tests across six files, including 27 new actual-surrender/public-command cases. Browser, CLI and server builds and TypeScript pass. The tests cover disabled, banned and unpicked actual summon IDs, explicit and implicit caster IDs, custom alternative melee definitions, mirror-faction drafted ownership, ordinary captured actor admission, rejected save/load, allowed continuation and forbidden/permitted Grove templates. Rejected public commands compare the complete saved state before and after, including corpses and cooldown state.

`public-capture-replay-results.json` records 16 additional actual-surrender/public-ability cases. Rejected commands leave the complete save state unchanged, including delivered bodies and nearby corpses. Permitted summons retain original definition IDs. Each case roundtrips the ordinary captured caster and seeks a recorded replay to the same complete saved state. Permitted cases also compare native and resumed continuation.

`grove-alternative-results.json` records seven independent Grove and alternative-raise cases. Rejected clones allocate no ID and consume no Grove cooldown. Permitted captured templates, raised templates and a custom original-faction melee alternative keep their identity through save/load and ten resumed steps. The two retained TypeScript probes can be bundled with esbuild and run directly against a checkout.

The first broader focused run had 86 passing tests and one inherited `combat-tactics.test.ts` failure. The same friendly-fire fixture failed on an untouched `115a537` archive with identical health values; `baseline-friendly-fire.log` records that comparison. Root has separately corrected this fixture with public match rules in `ea1b08b`. This evidence makes no claim about the complete root suite.

SAVE4 owner must merge the save restriction loop into current v4 admission and v3-to-v4 continuation while retaining historical v3 inspection. This branch retains save version 3 and simulation revision 3.2.0; it does not implement that migration. Source changes avoid corpse cargo, economy death and order interruption code.

```sh
npm test -- tests/captured-summon-rules.test.ts tests/modes-combined.test.ts tests/captured-gravecaller-definition.test.ts tests/captured-illusion-definition.test.ts tests/captured-gravecaller-grove.test.ts tests/faction-systems.test.ts
npm run build
npm run build:cli
npm run build:server
npx esbuild docs/evidence/captured-summon-admission-20261001/public-capture-replay-probe.ts --bundle --platform=node --format=esm --outfile=/tmp/captured-replay-probe.mjs
node /tmp/captured-replay-probe.mjs
npx esbuild docs/evidence/captured-summon-admission-20261001/grove-alternative-probe.ts --bundle --platform=node --format=esm --outfile=/tmp/captured-grove-probe.mjs
node /tmp/captured-grove-probe.mjs
```
