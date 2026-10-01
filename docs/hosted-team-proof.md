# Hosted team browser proof

`scripts/server/verify-hosted-teams.mjs` builds the checkout's Vite app and production server package, then serves that app through the packaged server entry. Its browser driver creates ordinary accounts and lobbies, joins human seats, readies them, and starts mounted authoritative games. The output directory must be new.

Run it from the checkout whose source you want to verify:

```sh
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  node scripts/server/verify-hosted-teams.mjs work/hosted-teams/new-run
```

The driver exercises all-human 2v2, 3v3 and 4v4 layouts, then two human accounts on the same team against two AI opponents. It checks authenticated seat ownership, accepted owned commands, rejected foreign control, shared team vision, foreign bank and queue redaction, and player/team spectator restrictions. The one-second spectator delay is part of the packaged server configuration for this short proof. Frame comparisons use common ticks newer than every participating connection's first frame.

Human seats have distinct starting banks and zero income multipliers, configured through the native lobby handicap controls, so the proof can check the exact debit and credit of a public resource transfer. The cooperative fixture gives both Undead AI seats age three and larger starting banks through those same controls to reach a joint attack within the bounded run. Public team spectator frames expose their orders. An observed shared attack interval and subsequent movement support the joint-attack claim; the 200 ms frame interval does not identify the exact simulation step or prove a coordinator wave ID.

The runner preserves source HEAD, selected source and script hashes, the Vite build ID, every served browser and server package file hash, browser version, and runtime version. It checks that source and packages remain unchanged across the run. It restarts the same production package and durable data directory gracefully, then verifies native rejoin and recovered command receipts.

Commands that test missing controls use the page's captured native WebSocket with the authenticated public protocol. The verifier does not assign game state, invoke simulation internals, surrender players, or manufacture a winner. Brief runs prove layout and transport behavior. Natural coordinated team victory needs a separate longer run.

The result and browser evidence omit cookies, passwords and socket ticket URLs. The private server data directory is created with mode 0700 and must remain local. Screenshots and selected authoritative frames support the assertions; they do not replace them. Loopback hosting does not establish deployment on a remote public server.

After importing the scripts into the canonical checkout, run them again after the final save-format changes. Evidence from an earlier source hash does not verify the integrated checkout.
