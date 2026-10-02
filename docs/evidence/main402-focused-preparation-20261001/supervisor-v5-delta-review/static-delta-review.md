# Main15 v5 supervisor and source-binding delta review

No static blocker was found in the v5 delta. The reviewed v5 supervisor and external driver/source contract are suitable for the prepared bounded run, subject to the existing final committed-pin seal and runtime admission steps. This review does not authorize or report runtime execution.

The preserved v4 supervisor matches its retained copy byte for byte at SHA-256 `934ee65ef3de116274d4cdef9a709262496d194aa550c27c06171c7f2a0736fb`. The v4-to-v5 wrapper diff contains one behavioral addition. [`main15-bounded.v5.py`](/tmp/ovf-main15-bounded-preparation-f7-kyew2suh/main15-bounded.v5.py:278) requires exactly three Photo mode capture facts, each with Photo mode active, complete native game/runtime equality, and paused state restored from true to true. The surrounding source-seal checks, 120-second placeholder phase, first-failure behavior, child tracking, signal guards, and final invariants are unchanged from the already reviewed v4 flow.

The active supervisor binds its own v5 basename through `Path(__file__).name` at line 163. Lines 164-170 require the reviewed source seal to contain the exact active supervisor, signal preload, history bridge, and placeholder driver bytes, then copy those bytes into run evidence. Lines 269-273 fingerprint the placeholder driver, pass that fingerprint through `OVF_PLACEHOLDER_DRIVER_SHA256`, and run it within the existing 120-second phase. Lines 275-281 require driver completion and cleanup, the three new Photo facts, unchanged helpers and fixtures, unchanged review inputs, and the existing final invariants.

[`placeholder-single-capture.mjs`](/tmp/ovf-main15-bounded-preparation-f7-kyew2suh/placeholder-single-capture.mjs:22) adds the four product files that implement Photo mode and checks their fingerprints against the same focused freeze at lines 56-59. Those live bytes match tested product pin `f7f3e187ea40079492589a6fce39f0b33f77f04a`. The driver also checks its own admitted SHA-256 at lines 27-29 before reading prior evidence or starting a browser.

The `photoScreenshot` helper at lines 163-210 starts from a paused native checkpoint and exports a native save before entering Photo mode. It uses the SessionTools `Photo mode` button at line 171, requires the product `photo-mode` class, paused state, hidden game overlays, a visible public `Exit photo mode` button, unchanged tick, and unchanged view level and side. Its `finally` block exits through the public button and waits for the prior paused state. It then exports another native save and calls `comparePersisted` on the full `.game` envelope, which includes state and runtime. It also rechecks tick and view state before recording a successful fact.

The helper is called for the neutral, intermediate capture-progress, and completed-ownership screenshots at lines 211, 221, and 238. Progress and final saves continue through the same native capture flow used by v4. The new wrapper assertion cannot pass with fewer or more than three facts. Driver success cannot record a fact unless public entry, public exit, overlay hiding, tick/view preservation, pause restoration, and complete `.game` equality have all passed.

The source contract matches the active files. `external-driver-source-contract.v5.json` names exactly `main15-bounded.v5.py`, `protected-signal-guard.v2.mjs`, `invoke-focused-history-audit.v2.mjs`, and `placeholder-single-capture.mjs` with their current sizes, hashes, and modes. Its Photo source rows match the current and tested-pin `SessionTools.ts`, `main.ts`, `GameScene.ts`, and `style.css` bytes. The v5 recipe accurately describes the added controls, checks, downloads, and unchanged phase bounds.

## Reviewed bytes

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `main15-bounded.v5.py` | 25,659 | `007081653f9eccc67a058b452c8cc92154e450d15e01d88f5742282d55595409` |
| `main15-bounded.v5.py.v5-delta.patch` | 966 | `25a5cd94842012508a9910e2759f3c7609937735c54a70be61f57ec567dfdb30` |
| `placeholder-single-capture.mjs` | 23,637 | `519ad8048c1fb597df4bb22c22a9ec7ccacf19afe5dd7ec11008412fbd694672` |
| `placeholder-single-capture.mjs.v5-delta.patch` | 9,664 | `c3b5dd871a572fcecd6623791000d125360a7e9776db1208872b87dc7e18448c` |
| `external-driver-source-contract.v5.json` | 4,672 | `08c7761d3e57ab8f8c0203bdc1b010db27e91c62b3017b18d922978f7a4027e2` |
| `preparation.v5.json` | 8,724 | `8b5e5a94e2a344317cc66108235f371d1f9758bd70ee2f6356979926f2ba42b3` |
| `main15-static-recipe.v5.md` | 12,024 | `78a138a014284ebdb92ac942afc6fd2543570c1cc2b481f2947c3e999cdbd8ca` |
| `protected-signal-guard.v2.mjs` | 2,837 | `65d10cfa6a398d814813ec350d3e4e468230bea21ce41107f81b4d621c2c6e2b` |
| `invoke-focused-history-audit.v2.mjs` | 2,281 | `f2057fd8f45c026248b33bb22d72183c0f2aae21f3d5dad7c1171ae5e1482aa7` |

This was an additive static review of the supervisor and source-binding delta. It performed no browser, helper, Node, TypeScript, test, build, simulation, server, or database execution; made no root or sealed-source edits; and sent no signals. The integration pin remains null and visual review remains pending. Reviewer: OpenAI GPT-6.1 Sol in Codex.
