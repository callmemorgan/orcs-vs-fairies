# Content packages

The local Mod library accepts JSON packages and launches their factions from the skirmish menu. The Lantern Keepers example is available through Install example and Download example JSON. Its Sentinels and Duelists share the melee role but retain different definition IDs, prices, health, speed, damage and artwork. Lantern Hall construction, recruitment, Bright Blades research and Renewal use ordinary battlefield controls.

A match owns an immutable content bundle. Saves and replays embed its package manifests, dependency closure and SVG sources. Installing another version does not alter an active match or an older replay. A package hash covers the canonical manifest without its own `hash` field, using SHA-256. The bundle pins each package and the built-in content fingerprint. A different engine or built-in fingerprint receives a specific compatibility error.

## Package schema

A package has `format: "orcs-vs-fairies-mod"`, `schemaVersion: 1`, `engineVersion: 3`, a lowercase `id`, exact semantic `version`, `name`, `dependencies`, `factions`, `art` and `hash`. Dependencies contain exact `{id, version, hash}` values. Admission checks all dependencies together and rejects missing, repeated, cyclic or incompatible packages. There is one version of each package in a match; older replays retain their embedded versions.

Each faction declares a namespaced ID, built-in base faction, title and description, colors, full unit/building/research definitions, and optional `defaultUnits` or `defaultBuildings` maps. Default role entries select an authored definition; additional definitions remain separately recruitable. The base faction supplies unchanged roles and terrain behavior. Unit and building IDs belong to the package namespace, such as `lantern:duelist`.

Units declare role, cost, health, damage, armor, range, speed, attack interval, training time, sight and description. Buildings declare role, cost, health, footprint, construction time, sight and description. Research declares role, production building, prerequisites, cost, time and permitted gather, speed, damage or armor effects. Abilities select existing deterministic handlers. JavaScript, unknown fields and unsupported effects are rejected.

Every custom unit and building requires an `art` entry. Art contains a package-local SVG path, complete embedded `svg` source, raster dimensions and anchor. The loader accepts static shapes and local gradients, and rejects script, event attributes, external references, CSS, animation, XML declarations and numeric XML escapes. The embedded source determines what the game draws. It does not download mutable artwork at replay time.

Package files are limited to 2 MiB, a pinned closure to 4 MiB, artwork entries to 128 per package, decoded artwork to 16 MiB per package and 64 MiB per closure. Unit/building/research counts and all numeric stats have explicit bounds. Array gaps, accessors, duplicate IDs, bad default-role references, missing art and research prerequisite cycles fail admission.

## Reproducing the local proof

Run `npm run build` and serve `dist` on a separate preview port. Generate the scenario and package fixtures, then exercise the browser:

```sh
npx esbuild scripts/mods/scenario.ts --bundle --platform=node --format=esm --loader:.svg=text --outfile=work/hundred-features/mods/scenario.mjs
node work/hundred-features/mods/scenario.mjs
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify_mods.mjs http://127.0.0.1:5186
```

The scenario is an authored verification setup imported through the normal save UI. It supplies resources and a distant hostile soldier; browser actions construct the hall, recruit both units, heal, research and command combat. The browser proof uses state diagnostics only for observations. It exports a save/replay and seeks that replay with the same embedded package hash.

`tests/content-registry.test.ts` checks manifest/hash and dependency admission. `tests/mod-gameplay.test.ts` checks charged-cost conservation, reserved population, distinct combat/ability/economy behavior, queue identity, save/resume hashes and replay content. `tests/mod-library.test.ts` checks normal import/error/launch controls. The recorded browser artifacts are under `docs/evidence/content-mods-20261001` and were captured on isolated integration commit `f4a9b93`. They do not verify the later assembled 100-feature branch.
