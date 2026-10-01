# Packaged CLI verification

`scripts/tournaments/verify-packaged-cli-parity.mjs` builds the production CLI
through `npm run build:cli` into a new output directory. It starts that
`dist-cli/rts.js` in a child process and uses its public newline-delimited JSON
protocol. A separately bundled helper imports core operations directly. It does
not import `TerminalSession` or the CLI entry.

Run from the checkout being verified, after installing its dependencies:

```sh
node scripts/tournaments/verify-packaged-cli-parity.mjs \
  CURRENT_NATIVE_SESSION_OR_REPLAY.json work/packaged-cli-parity/final-new-run
```

The input can be a native session containing a replay, a native replay, or a gzip
of either JSON format. It must use the current save version and simulation
revision. The helper imports both constants from the checkout, so a SAVE4 run
does not reuse SAVE3 expectations.

For a modest fixture generated from the same checkout:

```sh
node scripts/tournaments/verify-packaged-cli-parity.mjs \
  --fixture work/packaged-cli-parity/final-fixture-new-run
```

The fixture runs 2,402 ticks with external Orcs and AI Fairies on a small map. It
issues accepted gather, recruitment, rally, stop and hold commands through the
ordinary simulation API, including a command at the final tick. It records a
native session and replay. Its midpoint continuation needs a 1,200-tick request
and a one-tick request. This proves the verifier with a short economy and
recruitment run; it is not evidence of a natural victory or a full tournament.

The output directory must not exist. Inside the checkout it must be Git-ignored,
such as `work/`. Each accepted command and every replay tick runs through public
CLI requests. The verifier requests a complete native save and compares its
entire JSON, SHA-256 and native replay checksum with the direct-core result. It
checks the archive's final checksum and, for session inputs, the saved game in
that native session. It retains the midpoint save and starts a second process
from it. That process checks load/resave equality and replays the remaining
commands and advances in batches of at most 1,200 ticks. Its full final save must
equal uninterrupted playback. Malformed advance and command requests must return
protocol errors and preserve the state. Both processes must exit with code zero
and empty stderr.

The CLI controls one player. Its public `load` operation sets that player's
controller to `external` and changes other `human` controllers to `ai`. This
verifier therefore requires an external controlled player, no human controllers,
commands for only that player, and 0.05-second ticks. It rejects incompatible
archives. Human-controller browser exports are not covered by this full-equality
runner. A separate, labeled adapter can authenticate such an export and produce
a controller-adjusted native session for this runner; that does not prove the
unmodified browser controller arrangement through the CLI.

The evidence contains:

| File | What it records |
| --- | --- |
| `result.json` | Pass/failure, checks, limits and cleanup errors |
| `input.native.json`, `input-manifest.json` | Retained native input and original/decoded byte hashes |
| `versions.json` | Current and input save versions, simulation revision, controlled side and runtimes |
| `source-before.json`, `source-after.json` | HEAD, working tree and every tracked or non-ignored checkout file, excluding installed `node_modules` |
| `builds-before.json`, `builds-after.json` | Fresh CLI and reference package byte counts and hashes |
| `dist-cli/`, `reference/` | Executed CLI, direct-core bundle and compiler input/output manifests |
| `cli-build-*.log`, `cli-build-command.json` | Production build command, output and exit |
| `main.*`, `continuation.*` | Gzip copies of public stdin/stdout, CLI hash logs, stderr, exits and selected full native saves |
| `comparisons.json` | Every full-save comparison, tick, label, native checksum and SHA-256 |
| `continuation-checkpoint.json` | Actual saved midpoint and remaining action position |

The verifier checks that HEAD, the working tree, complete checkout hashes and
compiled packages remain unchanged. Ignored output is hashed separately. Keep
source changes out of a verification checkout until the run finishes.

`verify-runtime-parity.mjs` is a separate Node/browser helper check. It does not
execute the packaged CLI. A passing CLI run also does not substitute for the
native browser proof, hosted server proof or AI ladder on the final source pin.
