# Node and Chrome replay determinism

Two terminal processes played both seat orientations of seed 4127 on a small map with normal starting resources. The original replay first differed between Node and Chrome at tick 3010. At tick 3009 both state hashes were `af77491ceb12c727aafaf3c2f1da321b2d39fa7c66ce2f585221f46e4baf995f`. At 3010 the hashes were `b7b2eff3d929635c6452686d2f47cc59102c5e4799961349a89e955436c47781` in Node and `3dc4ca439879e121ba64d79af52141c7a9fa7bd003b90c1dee089c4c8ea5f2ca` in Chrome. The captured positions differ; this was a movement change rather than checksum noise. `original-*-drift.json.gz` retains both traces, and `original-tournament.json.gz` retains the recorded commands, steps, configuration, process evidence and source pins.

Replacing core `Math.hypot` with `sqrt(x*x+y*y)` moved the first difference to tick 3080. Full saved states at 3079 were identical. At 3080 the unit positions were still identical but a path and route cache entry differed. The chosen destination cache key was `56,60,0.7` in Node and `60,56,0.7` in Chrome. Both saved states before and after that divergence are retained as `sqrt-*-3079.json.gz` and `sqrt-*-3080.json.gz`.

The first walkable ring in `openDestination` had radius 1.5. Candidate 10 was `(30.285813188362642,28.325960099853532)`, with distance `16.478143141345512`; candidate 22 was `(28.32598960311624,30.28582540901419)`, with distance `16.47814314134551`. Those mirrored candidates tie in exact geometry. Their computed distances differed by `3.552713678800501e-15`. Node chose 22 and Chrome chose 10. Trigonometric approximation and sorting by the rounded distance made this tie consequential.

`src/core/geometry.ts` now contains shared binary64 direction tables, a square-root 2D norm and an eight-sector facing function. `openDestination` rotates those vectors using multiplication and addition, and visits candidates by increasing angular deviation, with mirror ties in index order. Gameplay shove, production and AI placement rings use the same tables. Multiplayer starts use fixed vectors too. State and checksum fields retain their full values; no tolerance or rounding was added. This changes simulation behavior and requires the canonical rules revision to advance before release.

The final two recorded battles ended at ticks 3863 and 3933. Every saved-state SHA-256 matched between Node v24.21.0 and Chrome 151.0.7922.34, including the initial state: 3864 and 3934 hashes. Each runtime also resumed a saved midpoint to the same final state and checked forward and backward checkpoint seeks. `parity-summary.json` pins every core source file, the test entry, both compiled bundles and the bytes Chrome fetched. The fetched browser bundle hash equals the compiled browser bundle hash. The four compressed `match-*.json.gz` files retain every tick hash and the continuation and seek results.

The core regressions passed 526 tests across 12 files, recorded in `core-regressions.log`. `geometry-tests.log` records another 28 numeric and navigation tests, including positive and negative facing boundary ties and a reduced instance of the blocked HQ approach. `typescript.log` is the successful whole-project TypeScript output. `report-verification.log` records verification of both recorded matches through the CLI. `artifact-sha256.json` pins the captured files other than this README.

To repeat the runtime comparison at this simulation revision, decompress `verified-tournament.json.gz`, then run:

```sh
gzip -dc docs/evidence/deterministic-replay/verified-tournament.json.gz > /tmp/ovf-verified-tournament.json
node scripts/tournaments/verify-runtime-parity.mjs /tmp/ovf-verified-tournament.json /tmp/ovf-new-parity-proof
```

The output directory must be new. The script uses the installed Codex Playwright runtime by default; set `OVF_PLAYWRIGHT_MODULE` to another installed Playwright module if needed. It compares full save hashes at every tick and rejects a replay checksum failure. These captures prove the pinned builds and matches. New rules or source changes require new competition recordings and another parity run.
