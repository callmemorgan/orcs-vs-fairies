# Packaged CLI parity verifier review

Verdict: one evidence-file defect remains in `97cb570dfda1a2344a76c3d3588cc71e3176559e`. The replay and continuation comparisons are sound for the clean 2,402-tick fixture, but the verifier accepts shorter archives for which it omits a file that its documentation promises.

I reviewed the commit with GPT-5.6 Sol against `5c6a02219b723102124f9775040a78b205a52a7d`. The pinned diff is `/tmp/ovf-packaged-cli-parity-review.diff`; the context diff is `/tmp/ovf-packaged-cli-parity-review-context.diff`.

## Finding

`verify-packaged-cli-parity.mjs:181-200` sets `checkpointChosen` when the midpoint equals the initial tick, but writes `continuation-checkpoint.json` only when choosing a checkpoint inside an advance action. Command-only archives and one-tick archives select the initial save and pass both processes without retaining the documented checkpoint file.

I constructed a valid current native session with three commands at tick zero. The verifier built and ran the production CLI, compared all three same-tick commands, reloaded the initial save in a second process, replayed the commands, matched the final save, and reported success. `/tmp/ovf-packaged-cli-command-only-2` contains no `continuation-checkpoint.json`, although `PACKAGED_CLI_VERIFICATION.md` says the evidence contains it and `result.json` says the method retains native checkpoints.

The reproduction input is `/tmp/ovf-packaged-cli-command-only-input.json`; the result is `/tmp/ovf-packaged-cli-command-only-2/result.json`. Write the initial checkpoint when `middleTick === state.tick`, or reject archives that cannot choose an in-advance midpoint and narrow the documentation.

## Checked behavior

The direct reference imports core operations and never imports `TerminalSession` or the CLI entry. The production process comes from `npm run build:cli`, communicates only through the newline-delimited public protocol, and records its stdin, stdout, stderr, CLI log, build command, and exit status.

Uninterrupted playback compares the complete native save JSON after the initial load, every command, every tick, and the final state. It also compares the native FNV checksum, the archive final checksum, and the native session game. The generated fixture includes a command after the final advance, and the clean run records six commands at final tick 2,402.

Continuation saves after tick 1,201 inside the long advance, reloads that save in a fresh CLI process, applies the unconsumed part of the current advance, then handles later same-tick commands. The offset is `tickOffset + 1`, so the saved tick is not repeated. Batches are capped at 1,200; the clean run uses 1,200 and one tick, then applies the final hold command.

Child-process requests are sequential and bounded. Spawn, stream, malformed JSON, unsolicited stdout, timeout, early exit, nonzero exit, stderr, and forced-shutdown failures reach the stored failure or cleanup errors. Successful closes are idempotent for the final cleanup pass.

The source snapshot uses Git's tracked and non-ignored path list, so a deleted tracked file causes the read to fail instead of disappearing from the manifest. It records HEAD, status, path hashes, byte counts, and symlink targets before and after. The ignored output is hashed separately, and the production and reference build snapshots must remain byte-identical after execution.

The clean fixture result at `work/packaged-cli-parity/clean-pin-97cb570/result.json` passes 2,402 ticks, six commands, exact native session final equality, rejected-request immutability, both process exits, source equality for 4,608 files, and build equality. Its stated limits correctly exclude human-controller preservation, multiple commanded sides, non-0.05 steps, natural victory, browser proof, hosted proof, and the AI ladder.
