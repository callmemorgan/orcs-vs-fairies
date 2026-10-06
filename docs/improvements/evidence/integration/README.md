This is the integration checkpoint at source `69c6840c9486cc2d5cc5afd36d831f0e1c903fa5`. The preview contains 14 published features. Its full suite passed 334 tests in 36 files, and the browser and terminal builds passed. The logs and JSON summaries here describe the checks that ran; they do not establish all 100 requirements.

The built terminal client completed all six faction practice missions with military research, income tracking, and the river layout enabled. It accepted ordinary commands, rejected early and duplicate practice fights, kept opposing income and practice progress private, and verified 63 replay entries. The first comparison attempt failed because JavaScript observations contained undefined properties omitted from JSON. The preserved result uses the same JSON representation as the terminal protocol.

Mounted client checks cover income on the winning tick, expiry exactly 60 seconds after a deposit, fresh practice/tutorial/skirmish state, and disposal of worker and income labels. Scene-event checks consume visible and hidden attacks through the actual GameScene method with the Phaser Scene class mocked. They establish routing, not rendered gameplay or trusted real-time audio.

The practice-focus fixture records an open defect at this checkpoint: selecting mission troops leaves focus on the button, so Q is suppressed until a canvas receives focus. Its button assertion describes that historical behavior. Learning accepted a repair for feature 004; update the expected button result and run the same input path when that published correction is integrated.

Run the checks from the repository root after installing dependencies. Outputs go to ignored work directories. The terminal check requires a freshly built CLI.

```sh
mkdir -p work/brainstorm100
npm run build:cli
npx esbuild scripts/integration/verify-practice-income.ts --bundle --platform=node --format=esm --outfile=work/brainstorm100/verify-practice-income.mjs
node work/brainstorm100/verify-practice-income.mjs
npx esbuild scripts/integration/verify-content-isolation.ts --bundle --platform=node --format=esm --outfile=work/brainstorm100/verify-content-isolation.mjs
node work/brainstorm100/verify-content-isolation.mjs
npx esbuild scripts/integration/verify-observer-purity.ts --bundle --platform=node --format=esm --outfile=work/brainstorm100/verify-observer-purity.mjs
node work/brainstorm100/verify-observer-purity.mjs
npx vitest run --config scripts/integration/vitest.config.ts
```

The observer probe compares 400 identical ticks with 0, 400, and 1,200 observation calls while income, military research, AI expansion, and river rules are enabled. Current resource memory remains inside PlayerView rather than authoritative game state. Repeat the check after persisted observation memory and save continuation are implemented.

Aggregate rendering, remapped input, trusted audio, player-1 networking and spectator privacy, bridge/tide caches, save continuation, and queued builder cancellation/restoration remain pending. Role-profile combat checks establish the changed damage and movement; they do not establish faction balance. The earlier AI placement and lead-gathering defects have an owner repair awaiting integration at this checkpoint.
