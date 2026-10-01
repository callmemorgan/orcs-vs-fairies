# Tournament verification in the canonical app

Run `scripts/tournaments/verify-canonical-main.mjs` from the assembled repository after the authoritative server and main game mount the tournament service and dashboard. The script builds the actual Vite app and `src/server/main.ts`, starts that server with a fresh account database, and uses its registered `scripts/tournaments/smoke.json` configuration. It accepts no replacement HTTP handler, dashboard mount, or replay callback.

```sh
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  node scripts/tournaments/verify-canonical-main.mjs work/tournaments/canonical-main-UNIQUE
```

The output directory must be new. Node dependencies must be installed. Linux `/proc` and Chromium are required. The built-in smoke agents must remain the server's fixed configuration. The test does not edit that configuration, inject command argv, or substitute hanging agents. The real server entry must supply account identity as the service principal so only the run creator may cancel; authenticated accounts may inspect other accounts' runs.

HTTP checks cover anonymous rejection, authenticated configuration inspection, forbidden executable argv, rejected cross-origin mutations, cross-account cancellation, creator cancellation of two observed live child processes, replay/report access, and ownership persistence across a server restart. Process checks observe the server's direct tournament children and the launched Chromium root, retaining PID start times to distinguish exited children from reused PIDs. Graceful shutdown also occurs while a second configured run has live children.

The browser uses the actual main toolbar and dashboard. It checks focus wrapping, blocked battlefield input, local pause restoration, overlapping modal blocking, photo mode, real agent launch, verified standings and report download. It inspects both recorded battles and repeats the first through the shared replay importer. Session controls play and seek the displayed replay, then the app's own Export save action captures the state and its private simulation data. The saved values must equal the displayed paused `window.rts.state`, and the restored save's full hash must equal the tournament report. This uses the app's existing save path because an independently bundled reader has a different simulation WeakMap. Four distinct Phaser canvases must be removed, and window keyboard, blur and resize listener counts must return to the menu baseline.

`summary.json` records the source commit, built server hash, hashes of served main modules, checks, HTTP statuses, replay hashes, canvas/listener counts, observed process identities and final cleanup. Compressed reports and screenshots remain beside it. A failed run writes its error and available cleanup evidence and exits unsuccessfully. Preparing or running this script in a dependency checkout does not establish that the assembled root app passed; retain the root run's own output before declaring its integration verified.
