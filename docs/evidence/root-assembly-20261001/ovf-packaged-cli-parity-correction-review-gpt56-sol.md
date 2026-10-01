# Packaged CLI parity correction review

Verdict: no findings. Admit `97cb570dfda1a2344a76c3d3588cc71e3176559e`, then correction `13d4fbcfa6238696cc1ab4903a76c384e1190fc8`.

I reviewed the correction with GPT-5.6 Sol. The pinned correction diff is `/tmp/ovf-packaged-cli-correction-review.diff`, and the context diff is `/tmp/ovf-packaged-cli-correction-review-context.diff`.

`13d4fbc` adds one write when the midpoint checkpoint is the initial state. It changes no replay, command, advance, comparison, checksum, process, source-manifest, or build-manifest logic. The accompanying decision row records the earlier finding and leaves fixed-pin execution proof pending rather than claiming unrun evidence.

The correction closes the finding in `/tmp/ovf-packaged-cli-parity-review-gpt56-sol.md`. My command-only rerun passed at `/tmp/ovf-packaged-cli-command-only-fixed.q9TFkd/result.json` and now contains `continuation-checkpoint.json` at tick 0, action index 0, offset 0. My one-tick rerun passed at `/tmp/ovf-packaged-cli-one-tick-fixed.56r4TD/result.json` and contains the checkpoint at tick 25, action index 0, offset 0. Both runs compared all accepted commands and complete saves through fresh packaged CLI processes, reloaded the initial checkpoint, preserved state across rejected requests, exited cleanly with empty stderr, and proved unchanged HEAD, working tree, 4,608 source files, and build bytes.

The owner reran the original clean fixture at `work/packaged-cli-parity/clean-pin-13d4fbc/result.json`. It passed 2,402 ticks, six commands, a tick-1,201 continuation in batches of 1,200 and one, complete native session equality, unchanged source, and unchanged builds. The owner also retained separate four-command command-only and one-tick runs under `work/packaged-cli-parity/`.

Ordering: the new evidence write occurs after the initial CLI load and save comparison and before action playback. Runtime command and tick order is unchanged.

Failure paths: the output directory must be new. A checkpoint write failure reaches the existing outer failure handler before playback. No error is swallowed.

Observability: short successful runs now retain the same documented checkpoint file as longer runs. Existing result, process, stdin, stdout, stderr, comparison, source, and build records are unchanged.

Stale writes: none. Each verifier invocation owns a new output directory, and every evidence write uses `wx`.

Test delta: the original command-only reproduction passed while omitting the checkpoint. The corrected command-only and one-tick runs pass and retain it. The 2,402-tick case confirms the pre-existing in-advance checkpoint path still passes.
