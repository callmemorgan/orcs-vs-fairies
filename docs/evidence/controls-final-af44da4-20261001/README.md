# SAVE4 controls evidence

This is the first fresh controls run at frozen source `af44da406acf7ab44436e978cb1f571b93e28d23`. Preparation and all 17 combined steps passed on October 1, 2026. The run used SAVE4, rules `4.0.0`, session/replay wrappers 1, an independent `npm ci`, Playwright `1.62.1`, and default headless Chromium `151.0.7922.34`. The native bug reports identify build `8c107a5f0ae792b00d7554879cc62d23fe835eccf415a2642243889331717452`. No failed run was replaced or rerun.

The execution checkout was `/tmp/ovf-controls-frozen.lBHzBT`, and the original output remains at `/tmp/ovf-controls-proof.XwAm0f`. The preview ran on port 5195. All four browser drivers closed their browsers, the owned preview stopped, and both the runner and a later `ss` check found no remaining listener. Production code, proof scripts, canonical tests, historical evidence, the requirements ledger, and the decision trail were unchanged.

## Results

Mounted coverage passed 12/12 cases, and the current controls suite passed 98/98 cases. Each browser used its own fresh context against the same isolated production build. Browser evaluation only read runtime state, DOM, or pixels; the Gamepad driver additionally replaced `navigator.getGamepads` and updated its virtual standard-controller sample.

| Feature | Observed result | Main record |
| --- | --- | --- |
| 81: minimap alerts | Native layered import; ordinary damage and idle alerts; authored level labels; raid, expansion, idle cycling and surface return; fog and level marker filtering. 12 browser checks passed. | [minimap/browser-proof.json](minimap/browser-proof.json) |
| 87: display accessibility | All three palettes and eight preview marker shapes; own/allied/enemy outlines; independent toggles; close/reopen and reload persistence; reset. 16 browser checks passed. | [display/browser-proof.json](display/browser-proof.json) |
| 89: gamepad | Camera pan/zoom, shoulder selection edges, hold/stop/move/queued move, pause/resume, modal suppression and reconnect safety. 13 browser checks passed. | [gamepad/browser-proof.json](gamepad/browser-proof.json) |
| 90: saves and recovery | Named save/load, failed import preservation, three natural 30-second rotations, pagehide checkpoint, reload recovery, disabled preference persistence and fresh-context import. 13 browser checks passed. | [saves/browser-proof.json](saves/browser-proof.json) |

The gamepad export retained six commands for side 0, worker 2: hold, stop, move, queued move, hold, stop, at replay action indices 1, 3, 5, 7, 9 and 11. Its endpoint was tick 106, checksum `00ac2f44`. The checker independently continued it to tick 206, checksum `91d2e48e`, and verified both extended replay histories.

Named save, load, rejected import, and fresh-context import preserved the complete tick-8 envelope. Autosave observations reached simulation times 30.40, 60.45 and 90.50 seconds after 31.16, 61.33 and 91.71 normal wall-clock seconds. The manual slot survived every rotation. The complete pre-pagehide, forced checkpoint, and recovered envelopes matched at tick 1825, checksum `730b800b`. Disabled autosaves allowed 31.80 simulation seconds over 33.02 wall-clock seconds without a new checkpoint and stayed disabled after reload.

## Native validation and visual inspection

All 11 retained native verification records passed the current decoder, complete-envelope load/resave comparison, full ReplayPlayer endpoint comparison, recomputed analysis and technology timings. Each checker independently continued the loaded state and warm replay endpoint through 100 normal 0.05-second steps. It compared complete state and recorder histories at every phase, retained all six continuation commands, measured movement during the movement phase, and compared both extended replay archives with the final continued envelope. Captured native files were unchanged.

All 25 captured PNGs were opened and inspected: nine Display images, one Gamepad image, eight Saves images, and seven minimap images. The images show the expected controls, marker changes, saved-match lists, recovery UI, and authored map-level selection. [visual-inspection.json](visual-inspection.json) records the inspected files and their hashes. No visual defect was found in these captures.

The complete pass and cleanup record is [run.json](run.json). [final-manifest.json](final-manifest.json) and [final-hashes.tsv](final-hashes.tsv) are unmodified copies of the original full-run inventory. The native executed bundles and esbuild metadata are retained under `modules/`; the generated HTML, JavaScript and CSS are retained under `dist/`. Fresh test records are under `mounted/` and `current-tests/`, and completed process logs are under `logs/`.

The independent read-only audit passed 3,700 comparisons with no mismatches. It rehashed the frozen source and Git blobs, six executed module files, 397 compiled files, all 500 original proof artifacts, served entry/response records, 11 native records, archive copies, and every omitted asset mapping. It verified the owned preview PID and port were absent and preserved matching before/after output inventories. The separate native-record reviewer also passed all 11 records. The [independent report](independent-review/report.md), [detailed audit](independent-review/audit.json), and [native-record audit](independent-review/native-audit.json) are retained byte-for-byte. Reviewers inspected captured evidence and did not rerun browsers or simulation. Browser closure is recorded by the drivers; individual Chromium child PIDs were not retained.

## Archive scope and limits

[archive-import.json](archive-import.json) records 109 original files copied byte-for-byte, totaling 24,874,521 bytes, plus the external preparation and combined logs. The original full manifest inventories 500 artifacts totaling 92,961,452 bytes. This archive omits only 393 `dist/` copies that match public assets already present at the frozen Git pin, totaling 68,341,416 bytes. Each omitted path maps to its `public/` path, Git blob, SHA-256 and byte count. The original full output is preserved unchanged.

[archive-hashes.tsv](archive-hashes.tsv) inventories the retained originals, logs, review records, visual inspection and this README. It excludes its own hash. The original final manifest remains scoped to the original full output; the archive hash list describes the committed subset and its review documents.

Gamepad input is a virtual standard controller; physical hardware was not exercised. The Display preview covers eight example players, while its ordinary match has two factions. These checks do not measure human color perception or contrast. Save coverage is local skirmishes on one origin; campaign/online saves, historical imports, quota exhaustion, all 12 slots, and a separate visibility-hidden event are outside this run. Recovery uses the Saves UI and requires retained browser data and origin. The minimap match begins from a strict authored native session; damage and alert creation then follow normal simulation.

To rerun from a fresh checkout and fresh output, follow the committed [controls proof recipe](../../../scripts/controls-proof/README.md) at the full source pin above. This archive adds evidence only and preserves all historical captures.
