# Packaged CLI preparation proof

This evidence was generated on clean `13d4fbcfa6238696cc1ab4903a76c384e1190fc8`,
after the verifier source commit `97cb570`. The source is based on `5c6a022`.
It uses SAVE3 and simulation revision 3.2.0. It proves the packaged CLI verifier
on that historical source; it is not final combined SAVE4 proof and does not
promote any feature in the requirement ledger.

The fresh production `dist-cli/rts.js` agreed with a separately bundled
direct-core reference at every one of 2,402 ticks and all six accepted commands,
including the command at the final tick. The complete final native save also
equaled the retained native session game. Its checksum is `c322204e` and its
SHA-256 is `3b9f73d7eb6761da25279bde387809b192a0330b4852e16c1206156e74188c4b`.
A second CLI process loaded the actual tick 1,201 save and reached the same full
final save with batches of 1,200 and one tick. Both processes exited with code
zero and empty stderr. Invalid advance and command requests returned public
protocol errors without changing the state.

The additional native sessions exercise command-only history at tick zero and
one-tick history from tick 25 to 26. Each has four accepted commands and retains
its chosen initial continuation checkpoint. The one-tick session was also read
from an ordinary gzip file. Independent GPT-5.6 Sol review found the missing
checkpoint file for short archives in `97cb570`; `13d4fbc` fixes it. The reviewer
admitted both source commits after independent command-only and one-tick reruns
and the fixed-pin 2,402-tick result.

The CLI intentionally changes controller arrangements on load. These fixtures
have an external controlled player and an AI opponent. The verifier rejects
human controllers, commands for another side, and advances with a different
timestep. The rejected inputs and their failing results are retained. A second
attempt to use the same output directory also failed and preserved the existing
result byte-for-byte. Human-controller browser exports require a separate,
explicit controller-adjustment proof; these results do not cover them.

`archive-manifest.json` records 224 retained run artifacts, their compressed and
decoded hashes, and byte counts. Most original files are gzip-compressed without
changing the decoded bytes; the already-compressed public protocol traffic is
preserved as-is. The original output path in each result is historical. The
corresponding retained file is in the same run directory under this archive.

`artifact-audit.json` verifies all 224 artifacts, all 4,608 source hashes against
Git blobs at the recorded pin, the combined source digest, before/after source
and build equality, checkpoint presence, public request/response counts and
process exits. `protocol-audit.json` separately reads the retained public CLI
stdout and recomputes all 2,459 native save hashes and UTF-16 FNV checksums. It
checks those against the direct-core comparison records, the CLI hash logs and
the native session's final game.

To repeat the archive audits from the repository root:

```sh
python3 docs/evidence/packaged-cli-parity-20261001/audit.py
node docs/evidence/packaged-cli-parity-20261001/audit-protocol.mjs
```

The four passing run directories are `clean-pin-13d4fbc`,
`command-only-13d4fbc`, `one-tick-13d4fbc` and `one-tick-gzip-13d4fbc`.
The three `reject-*-13d4fbc` directories contain expected failures.
`support/` contains the public short-fixture generator and compiler metadata,
the original gzip input, and the output-reuse check.

Use [the run recipe](../../features/PACKAGED_CLI_VERIFICATION.md) after final
source freeze. The verifier imports the current save version and simulation
revision, builds both packages fresh, and can generate a compatible fixture
from the final SAVE4 checkout. Node/browser helper parity, browser workflows,
the production hosted server and the full AI ladder remain separate checks.
