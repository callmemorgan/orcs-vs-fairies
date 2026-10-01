# SAVE4 packaged CLI proof

This archive retains one packaged CLI parity run from clean
`6a634b200bbc978e0bd8abe2e9ba55833190d129`. The run used SAVE4 and simulation
revision 4.0.0. It ran in a separate checkout with an independent dependency
copy. Every dependency file had a separate inode, and all dependency symlinks
resolved inside that copy. The root checkout, its dependencies, the feature
ledger and the decision trail were unchanged by this work.

The production `dist-cli/rts.js` was freshly built through `npm run build:cli`
and executed as a child process using public JSON stdin/stdout. It agreed with
a separately compiled direct-core reference on the complete native save after
each of 2,402 ticks and all six accepted commands, including the command at the
final tick. The final native save also equaled the generated native session's
game. Its checksum is `bd34d369`; its SHA-256 is
`7987e26a5fdf5c0d119e3f8b1803cd3e078a4b5df2c72855c6284c2ba1f76dad`.

A second CLI process loaded the actual tick 1,201 checkpoint and reached the
same complete final save after batches of 1,200 and one tick. Both processes
exited with code zero and empty stderr. Their public request counts were 4,819
and 13. The second process also rejected an oversized advance and a malformed
command without changing the state. This is continuation of the same proof,
not a second independently generated game.

The fixture has an external Orc player and an AI Fairy opponent. It tests a
short economy and recruitment run. It does not establish natural victory,
tournament outcomes, human-controller browser parity or behavior at a later
complete repository HEAD. The historical SAVE3 archive remains separate and
unchanged.

`support/production-and-driver-preflight.json.gz` records all 5,246 tracked
files and proves their bytes equal Git blobs at the pinned commit. The complete
source digest is `87004e6d082b948d9b273ce4653cebd3a4f33d5da94a40d9fb5c67a3cf518957`.
The before/after source manifests agree with that preflight. The dependency
manifests record all 7,693 files and symlinks in the independent copy, with
unchanged before/after digest
`47b6634f2a99064cc1c7e9931c8862a3171e26bf512ac31dbde478c5187c9d78`.
No dependency cache is archived.

`run/compiled-inputs-against-git.json.gz` verifies all 42 production CLI compiler
inputs and 48 direct-reference compiler inputs against those Git bytes. The
production input digest is
`7b0725fcfe7781226ca74662ef8cf0fb3a33de96da8f83d9e0385df12c7b037a`.
It can support a later comparison of unchanged production inputs. A later
complete-HEAD claim requires its own source comparison. Fresh package hashes
also match before and after execution. The exact driver, helper, package script
and lockfile bytes are retained under `frozen-source/`.

`run/input.native.json.gz` contains the generated native session and its initial
replay envelope. Its original JSON has 74,833 bytes and SHA-256
`648c92641dc0d897ef9d003e606537335b6e2ee438de596398b2f086aeedecad`.
Initial, midpoint and final native saves, all per-tick comparison receipts,
raw gzip public stdin/stdout, CLI hash logs, build logs, package/compiler
manifests, version identities and process reports are retained under `run/`.
The original output path recorded in each report is historical; the matching
retained artifact is under this archive's `run/` directory.

`run/protocol-audit.json` recomputes all 2,416 retained native saves' SHA-256 and
UTF-16 FNV checksums from public CLI stdout. It matches them against the
direct-core comparison records, the CLI's sorted-save hash log, and the native
session's complete final game. This audit only reads retained artifacts.
`archive-manifest.json` records 61 run/source/support artifacts with compressed
and decoded hashes and byte counts. `archive-audit.json` additionally verifies
all of them and the frozen Git source. Most original files were gzip-compressed
without changing their decoded bytes; existing gzip protocol files were copied
unchanged.

To audit the retained archive from the repository root:

```sh
python3 docs/evidence/packaged-cli-save4-guard-20261001/audit.py
```

To reproduce the parity proof, create a clean isolated checkout of the recorded
pin, install independent dependencies matching its lockfile, and run:

```sh
node scripts/tournaments/verify-packaged-cli-parity.mjs \
  --fixture work/packaged-cli-parity/final-save4-guard-NEW
```

The output directory must be new. For another source pin, preserve its own
identity and evidence; do not relabel these results. The retained preflight,
postflight and protocol-audit source under `support/` documents the extra byte
checks applied to this run.
