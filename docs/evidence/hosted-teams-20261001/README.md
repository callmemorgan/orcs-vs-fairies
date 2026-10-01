# Hosted team browser evidence

The production browser proof passed all seven grouped checks at `bec34d8575e3d0379222bf0e793a824128224fac`, based on canonical root `5c22a8912b09e79dee7e97b5332f14d820afae38`. The tested source digest is `589c18a7a0fbda35618d97ad2986093f67f7e7b063a9a8e84eb7dbfba716fb42`; the Vite build ID is `b3a600bdedc03c120311151fe35e94cc7782ef74e67c7f2343fea2b455e54784`. The result pins 622 source, public asset and script files, the production server bundle, and all 393 served browser files.

The runner builds and launches the normal packaged server entry, then drives the actual mounted Vite game in separate authenticated browser contexts. Accounts, lobby settings, joining, readiness, match entry, F2/Stop and spectator settings use native controls. Ownership and transfer probes use the captured native WebSocket and the public authenticated protocol. No simulation internals, game-state writes, surrender commands or fabricated winners were used.

## Results

| Layout | Human seats | Initial common tick | Historical team spectator comparison |
| --- | --- | --- | --- |
| 2v2 | 0–3 | 268 | Player banks and owned entities match the team view at tick 944 |
| 3v3 | 0–5 | 732 | Same comparison at tick 2076 |
| 4v4 | 0–7 | 1516 | Same comparison at tick 3144 |
| Two humans against two AI | Humans 0–1; AI 2–3 | 44 | Human views agree; delayed AI team view exposes permitted AI orders and banks |

Every human seat sent a native Stop command and received an accepted authenticated acknowledgement. Each layout rejected control of another human's unit and a transfer to the enemy team. A ten-wood transfer debited side 0 and credited side 1, with other human banks unchanged. Shared team vision agreed at identical ticks, normal player frames omitted other banks and private orders, and rendered foreign banks were zero placeholders. Both player and team spectators had a twenty-tick delay, disabled production and command controls, and a server rejection for a command sent on their spectator socket.

The cooperative AI frame at tick 1420 precedes the frame at tick 1424 in which both AI owners have new attack-move orders to the same formation destinations. Both owners moved by tick 1428. These retained frames prove a shared 200 ms attack interval and movement. They do not expose a coordinator wave ID or identify the exact simulation step.

After a graceful production-server restart, both cooperative accounts rejoined their original seats through the native lobby list. Their new native commands followed the durable sequence in the recovered hello. Retrying the unchanged original transfer envelope returned the identical original receipt from applied tick 63. Both human banks were identical before and after the retry at common ticks 1688 and 1692. There were no page errors, capture parse errors, unexpected socket errors or cleanup errors. Source and served package hashes remained unchanged.

## Retained artifacts

`passed/result.json` contains source and package pins, grouped checks and browser results. `passed/native-browser/summary.json` contains the layout fixtures, native actions, selected frame references and screenshots. Frame and wire JSON are gzip compressed; each reference includes the decoded and compressed SHA-256 hashes and byte counts. `passed/native-browser/restart.json` records rejoin, sequence recovery and the original receipt retry. Build and server logs are retained alongside the result.

The artifact audit checked all 214 retained frame-reference occurrences, compared gzip and decoded hashes and sizes, confirmed the four-tick AI interval, and compared the original and replayed envelope, receipt and banks. Saved JSON and wire artifacts contain no cookie, password, ticket or authorization fields. The private server data directory, browser cookies and socket ticket URLs are excluded from this evidence.

`failures/attempt-01` and `failures/attempt-02` preserve the first two runs. Their 2v2 human seat, command, transfer and privacy checks passed, then a team frame comparison timed out after the spectator rejection probe. The normal client closes its connection on that server error. The corrected script performs the team comparison and AI observation before that final rejection probe. Attempt 02 additionally records every retained tick at the timeout. Assertions were retained.

`separate-world-review.json` records a source-audit defect outside this hosted proof. The world-site union retains a later teammate's per-player `rewardClaimed` flag, and the renderer attributes that flag to the base spectator. A constructed world fixture confirms claims disappearing or changing owner. Ordinary hosted lobby configuration cannot create that world case, so this audit is separate from the native browser results. The defect was introduced in `83b4db6`; no gameplay source fix is included here.

## Rerun

Run from the checkout whose source is being verified, with a new output directory:

```sh
OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
  node scripts/server/verify-hosted-teams.mjs work/hosted-teams/new-run
```

This proof used loopback production hosting. It does not verify a remote public deployment or natural coordinated team victory. The canonical root must rerun the scripts after the final SAVE4 integration; these source pins do not verify that later checkout. No requirement-ledger entries were changed.
