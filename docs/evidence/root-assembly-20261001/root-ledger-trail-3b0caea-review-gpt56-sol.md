# Root ledger and trail review at 3b0caea

GPT-5.6 Sol accepts `3b0caea19a24a68f4c3fad186a1a3917c194f76b` with no finding.

The four root imports match their reviewed source commits by stable patch ID: controls `d6add1d` to `d68fdf9`, combat `12c2943` to `2766a0a`, economy repair `82e9bed` to `6fa5382`, and world repair `9c6dc828` to `db36593`.

I reran `audit-imported-controls-combat.py` in a detached checkout at its required pin `db36593`. Its output is byte-identical to the committed audit. It verifies all 120 controls archive hashes, all 252 combat archive hashes, and all 565 production inputs against committed and working-tree bytes. The four controls records report the expected 12 minimap, 16 display, 13 gamepad, and 13 save checks at source pin `af44da4`, with no recorded browser, request, HTTP, page, or cleanup errors.

The requirements JSON remains valid and contains 100 unique IDs. IDs 81, 87, and 89 now have retained evidence for their stated scope. ID 90 remains in progress despite its added save evidence. ID 69 correctly returns to in progress: the retained failure stops after four completed cases, and the focused public-step reproduction shows wave 3 remains in `fighting` for another 100 ticks with only a living crewless siege engine among the spawned attackers.

The five appended decision rows match the evidence and status changes. The combined-rules row records a pending repair plan rather than completed verification; its full regression and gameplay proofs remain open. The pin-specific root audit must be run from `db36593`, as retained, rather than current `3b0caea`.
