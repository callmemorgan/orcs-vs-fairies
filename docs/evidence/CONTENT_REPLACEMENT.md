# Content replacement browser verification

## Setup

`scripts/prepare_content_variant.py` prepares a separate source snapshot under `work/content-variant`. Run preparation only after current source edits have finished:

```bash
python3 scripts/prepare_content_variant.py
cd work/content-variant
npm run dev -- --port 5174
```

Open `http://127.0.0.1:5174/?qa=1` and choose orcs through the normal menu. This fixture appends an override only to its copied `src/core/content.ts`. The orc worker becomes `Grove Scrapper`, uses the existing `fairy-worker` artwork, has 95 HP, costs 35 wood and no ore, trains in six seconds, and has the existing illusion ability. All other source files are copied without edits. The override does not replace or modify shared simulation, commands, rendering, or HUD logic.

The fixture copies `src`, `index.html`, package files, TypeScript configuration and Vite configuration. It shares `node_modules` and `public` through symlinks for read-only usage. A fixture-only Vite wrapper and dev-script configuration keep optimization caches in the fixture's `work/vite-cache`; Vite's runner config loader avoids writing a temporary config bundle through the shared dependency symlink. Do not install dependencies, generate assets or write into either shared directory from the fixture. This is an operational read-only convention, not filesystem permission enforcement.

The primary source and production build are unaffected. The script refuses to replace an existing output directory so a verified fixture remains available. Use `--output work/content-variant-2` to prepare another snapshot. It records source and fixture hashes, the exact override, symlink targets and launch instructions in `fixture-manifest.json`, and checks that the only modified copied source file is `src/core/content.ts`. It also checks that primary input files did not change while the copy was being prepared.

Browser verification should inspect an initial Grove Scrapper's name, health and fairy artwork, then select the headquarters and recruit a new one using the normal button. Confirm a 35-wood charge and completion after six simulated seconds. Select the recruited unit and activate Veil Doubles with its normal Q control; confirm temporary doubles appear. Record the screenshots and the fixture's `work/browser-session.jsonl` evidence without injecting commands or outcomes through developer state. Confirm the primary game still uses ordinary Scrappers in a separate normal session.

Setup alone is not verification. The observed results below apply only to this recorded override. The fixture remains local and is not a production feature.

## Prepared snapshot

The fixture was prepared and its Vite server started on port 5174 on 2026-09-05. An HTTP request returned status 200 and the game HTML. No browser interaction was performed by the preparation task. `work/content-variant/fixture-manifest.json` records the exact timestamp and hashes. Every copied source file matches that snapshot except the appended content override; the current fixture files also match their recorded post-override hashes.

After the snapshot, the primary `GameScene.ts` received a separate native Shift-click selection fix. The fixture intentionally retains its recorded pre-fix renderer so its content-only comparison remains reproducible. The primary and fixture simulation remain byte-identical, and primary content remains unchanged by the fixture. This is a known snapshot difference, not an additional fixture override.

## Browser result: pass for this override

The coordinating browser run used a 1280×720 viewport and selected orcs through the normal menu. It showed an orc Iron Hall, five fairy worker sprites and the ordinary orc Ironjaw. The headquarters offered `Grove Scrapper` for 35 wood, zero ore and a displayed six-second training time. Clicking recruitment reduced wood from 420 to 385. The queue completed and population increased from six to seven.

Selecting a worker showed 95/95 HP and the reassigned Veil Doubles ability. Activating Q through the normal control showed its 35-second cooldown and visible ghost copies. The ability was demonstrated on starting worker ID 2; the newly recruited worker's existence and health were verified separately. The browser did not inject entity data or outcomes to produce these observations. The six-second value was verified in the button and content definition; this record does not claim a separate stopwatch measurement.

`content-variant-ability.json` records the state at 67.95 simulated seconds: the player remains faction `orcs`, wood is 385, ore is 220, population is seven, the headquarters queue is empty, six real workers have 95/95 HP, and two worker illusions have 38/38 HP. Final artwork is enabled and loaded with all 31 assets. The selected worker is ID 2 and has a recorded ability cooldown. `content-variant-session.jsonl` preserves all 18 fixture telemetry snapshots, from 2.95 through 87.95 simulated seconds.

The source snapshot was prepared at `2026-09-05T05:42:43.512071+00:00`. Hash checks after the browser run confirmed that primary content and simulation still match the original snapshot:

```text
ff84c20e0f0badec8c3194c20cc4bb5aba7b82189ea94a8eacd0cd8b60e5a3bf  primary src/core/content.ts
d20bba498e772a26dade03fd4d242cb261ba67eec1462305642eb61b1d917f5a  fixture src/core/content.ts
b259c9e3a8a5f9459898fd672b1b04e581c95db8bbea62dd09de92cae982a000  primary and fixture src/core/simulation.ts
```

This proves that this worker's displayed identity, artwork, health, recruitment cost and ability assignment can change through content while using the existing simulation and UI. It does not prove arbitrary future roster schemas, every ability combination or new mechanics that have not been implemented. The original production content was not replaced. The fixture and its evidence remain on disk; its dev server was stopped with Ctrl+C after the browser tab closed.
