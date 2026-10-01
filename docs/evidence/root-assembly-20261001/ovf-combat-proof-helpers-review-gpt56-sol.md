# Combat proof helper review

Verdict: no findings. Admit `0644aa7e2a3ca891cf3a3f65a198b838a9ab6154`, then `3f963008a3ce79e4615a8ca115954f9f4ce077ab` for the final frozen-source proof. Both commits change proof scripts only.

I reviewed these commits with GPT-5.6 Sol. The browser runner now requires SAVE4, the pinned simulation revision, exact committed source inventory and bytes, the executed runner's equality with its committed file, sealed fixture and production build bytes, a fresh evidence path, and actual same-origin script and stylesheet response bytes. It compares the complete native `.game` envelope after every import, save round trip, replay endpoint, and bug-report export. Its replay-export comparison excludes only derived analysis and technology summaries, then proves playback through the complete endpoint game.

The runner's 15 portable fault probes passed. They show that the prior field allowlist could miss runtime, rules, economy-ledger, and event changes while the complete envelope rejects them. They also reject SAVE3 input, incompatible rules, altered replay initial state, stale or unknown served assets, empty entry assets, path traversal, mutated frozen fixtures, deleted committed source, index-hidden source changes, and raw SVG source corruption. The executed runner SHA-256 `6919e61c36a86ab2ee0efb2f110a9c5078d0bc2a2ef432d6aa037b3e76ad180a` matches the exact `0644aa7` Git file. Browser execution remains pending on the final assembled build.

The CLI adapter authenticates each original native session before projection through strict decoding, complete save round trip, full unmodified replay playback, final checksum, and complete final game equality. It rejects scenario-bound inputs, side-0 AI, another human controller, commands from another side, and non-0.05 advances. Its only projection changes `state.controllers[0]` from human to external. It re-records every public command and tick, then requires the projected complete final game to equal the original after that one controller change.

Checkpoint suffix construction preserves command order and coalesces only adjacent equal-timestep advances. It retains commands after a same-tick checkpoint and the remaining ticks of a partially consumed final advance. Both the original and projected checkpoint continuation must reach the uninterrupted complete final game. Pending projectile identities must exist in the checkpoint and resolve by the final state.

The adapter pins every `src` path and Git blob, including deleted and index-hidden changes, pins its TypeScript Git blob, retains original inputs, and requires its executed bundle to equal a fresh rebuild. The three actual runs at `/tmp/owned-combat-cli-pending-proof-20261001`, `/tmp/owned-combat-cli-coalesced-proof-20261001`, and `/tmp/owned-combat-cli-planning-proof-20261001` all bind `3f96300`; their 36 listed artifacts match their recorded hashes. Pending continuation preserves a same-tick command, coalesced continuation preserves a 20-tick suffix, and the planning wrapper is validated and retained only in the original input. The derived CLI wrapper makes no planning claim.

The earlier isolated proof passed 27 adapter and fault cases plus focused TypeScript checking. Those runs use SAVE3 and simulation revision 3.2.0 as preparation evidence. The helper imports version constants dynamically, but the final assembly must rebuild it from the final source and run the native browser exports and packaged CLI driver there.

Ordering: proof operations remain serial. The adapter reproduces replay action order and never coalesces across commands.

Failure paths: runner and adapter assertions reject stale source, stale builds, incompatible sessions, altered replay histories, reused artifact paths, unsupported controller layouts, and incomplete simulation. The runner records a failed phase; the adapter retains original inputs and a failure record.

Observability: both helpers add hashes, command receipts, process/build records, complete envelopes, and explicit scope fields. They change no production telemetry.

Stale writes: the browser runner uses fresh artifact names and rechecks frozen inputs after execution. The adapter requires a new or empty output directory and rechecks source and helper bytes after projection.

Test delta: the portable runner probes cover 15 contract faults. The adapter probes cover 27 action, controller, planning, source, executable, and replay faults. Final browser and packaged-driver execution remains a final-freeze requirement.
