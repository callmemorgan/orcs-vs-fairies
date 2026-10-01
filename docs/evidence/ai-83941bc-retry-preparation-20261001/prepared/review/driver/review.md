# Static review of the 839 retry preparation

Reviewer: Codex GPT-6.1 Sol. The active runtime/model context supplied that identity. The requested GPT-5.6 Sol override did not take effect, so I have not relabeled this review as GPT-5.6 Sol.

Reviewed at `2026-10-01T22:19:39Z`. This was a static inspection. I did not invoke the driver, adapter, applicability helper, observer helpers, build, compiler, test, simulation, browser, server, installation, or checkout mutation. I wrote only this review directory.

## Result

The retry driver, source-applicability claims, runbook, and cleanup preparation are supported by the Git objects and prepared bytes. The final runbook requires serial execution, stops after any failed phase, and permits `online-ui` only after `coop-ui` passes. I found no remaining static preparation defect.

## Verified facts

Git identifies `efeb9a8e1363e3360774699ba3facc82ccf3f836` as the parent of `83941bc80ce9ec08840b0645d9b33e8018d5309a`. That commit changes only `scripts/verify_assembled_coop.mjs` and `scripts/verify_assembled_online.mjs`. In each file, replacing the added `.split(' · ',1)[0]` expression with the prior expression reproduces the parent blob byte for byte. The parent blobs equal the blobs at `453c2218af9973b9eca8fb78392435bd9d46a740`. The prepared parser patch matches the Git diff. The `assert` token counts remain 43 in the co-op verifier and 91 in the online verifier.

An independent Git tree comparison reproduced the applicability receipt. All 598 recorded inputs match the sealed 453 source record. The two proof scripts are the only differences at 839. The 565 runtime and build paths are identical, including `src`, `public`, package manifests, Vite and TypeScript configuration, HTML entries, and `scripts/build-server.mjs`.

The driver is 4,954 bytes with SHA-256 `81e0f62d4012a50338819d82466556a5a093cac78a69d884619e51f8b5ea84da`. Its prepared patch matches the diff from the approved 453 driver. It checks the owned checkout path and 839 HEAD before accepting only `build-web`, `build-server`, `serve`, `coop-ui`, or `online-ui`. It uses the fresh `work/ai-save401-final-83941bc-r1` prefix and binds the server to `127.0.0.1:5371` with the 30-second spectator delay.

The copied wrapper is byte-identical to the accepted wrapper at SHA-256 `bb8c80fc33ca6a25e044a5df60350030bb2177461d265025b9bfcffcdc3a1cd2`. Its browser bindings still require passed web and server build envelopes at the same source pin, the documented build commands, full source-record equality, exact artifact inventories, and unchanged before/after source, compiled, served, and build-binding records. Old 453 build envelopes cannot satisfy those 839 checks.

The copied adapter is byte-identical to the approved adapter at SHA-256 `7fe266503ffb4a65da331e6ae3fa7ffa248f805595dcb5e417a7669fc73bbd6d`. Static hashes of the selected Playwright entry, Playwright package, and Chromium-1243 executable match the prepared constants. The package file reports Playwright 1.62.1. This establishes the prepared selection, not a future run's browser identity.

The final README says to execute phases serially, stop after any failure, retain a failed co-op result, and skip online after co-op failure. These rules are operational instructions; the individual phase driver does not orchestrate the sequence. The failed-envelope observer authenticates only a complete exit-1 failed envelope and states that it grants no acceptance. Its patch matches `audit-envelope.py` exactly.

The four original observer derivation patches and two additional observer patches match their stated source and destination files. The cleanup helper has SHA-256 `f61490a5a264e51e8fa34f3d20e0cd71e6a3863d04ce1dedccb3e65e2d85082f`. It checks the server PID's cwd, argv, start ticks, and port 5371 ownership before SIGTERM. It excludes that target from the protected 4173 listener holders, compares the complete protected listener identities before and after, derives the touched flag, and includes the protected-port result in `passed`. It reads R3 process captures independently of completed launch traces and also derives ownership from original browser DEBUG stderr. A partial phase directory without observed launch ownership makes cleanup fail closed.

The new scoped browser-close helper has SHA-256 `2bcb75f17ac11c382e2cdbf38d49c56b112e60595f894ae19b6294415fbe18ff`. Before signaling one PID, it checks caller-supplied captured start ticks, the Chromium-1243 executable, owned checkout, debugging pipe, Playwright profile, and exclusion of that root from protected 4173 sockets. It records the before state, rechecks start ticks immediately before SIGTERM, and requires the root to disappear while 4173 listener identities remain unchanged. Its stated limit is correct: it closes only the checked root and does not establish that descendants are gone. The runbook requires direct PID and start-ticks checks for any remaining descendants.

The browser provenance helper states that it omits complete shared-library and host provenance and cannot obtain `browser.version()` from the frozen verifiers. The trace helper states that it cannot reconstruct an earlier live `/proc` observation or `browser.version()`. The wrapper states that installed dependencies and the complete host are not pinned. No runtime success or browser-version claim follows from this review.

The owned checkout remains at 453 with no tracked changes. The existing evidence directories and `node_modules` are untracked and were not modified. The copied sealed manifest remains SHA-256 `bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681` and describes 590 files totaling 373,014,330 bytes. I did not rehash those 590 payload files in this review.
