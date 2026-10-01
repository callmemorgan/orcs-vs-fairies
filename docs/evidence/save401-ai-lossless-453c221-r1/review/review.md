# Independent closing review of 453 lossless retention

Reviewer: GPT-5.6 Sol in Codex

Result: pass. I found no admission-blocking defect in the executed retention records, the recorded byte partitions, the child-process closure, or the proposed bounded import policy.

## Scope

This was a file-only closing review. I inspected the execution source, sealed indexes, compact result records, job receipts, closing correction, release record, and import-plan source. I did not run any retention script, Git restoration, codec, checker, build, browser, server, or runtime stage. I did not reread or rehash the raw SQLite, decoded SQLite, gzip, restored public tree, or retained native payloads.

The large-payload conclusions below admit the full-read execution receipts and compare their recorded path, size, SHA-256, pin, and seal values across independent metadata. The pre-review allowlist is itself SHA-256 `9e26e079653666c20a998e3768cd1eb80d174f313e2dd3945b4bfdb70549440d`.

## Findings

None.

## Admission evidence

The sealed manifest contains 590 unique relative paths and 373,014,330 bytes at source pin `453c2218af9973b9eca8fb78392435bd9d46a740`. The index partitions those paths into 394 source-backed public duplicates totaling 68,373,454 bytes and 196 actual-byte entries totaling 304,640,876 bytes. The sets are disjoint and complete. The actual-byte set contains the 222,466,048-byte raw SQLite plus 195 native entries totaling 82,174,828 bytes.

The retained-native result covers those 195 non-SQLite paths. Every recorded size and SHA-256 equals the corresponding sealed index record. The public restore result covers all 394 public paths, with each source path, blob ID, size, and SHA-256 matching the two-pin index. The full derivative result covers all 590 paths as 394 restored public blobs, 195 retained native files, and one decoded SQLite sidecar. Its aggregate byte count equals the sealed manifest total, and every record says that the compared bytes were equal.

The codec result records a 39,472,569-byte single-member gzip with SHA-256 `ec1ced7f55eec3cf836b7f816ffbd612407d5760564702939c82af3858c37cfc`. The raw and decoded records both contain 222,466,048 bytes and SHA-256 `68634fdb8c709812659afbd36558b97ff98eb3874df918ef631355b106f346d5`. The source requires explicit slot release, pins source and output identities, creates sidecars exclusively with no symlink following, caps encoded input and decoded output, rejects truncation, trailing bytes, and extra gzip members, compares every decoded byte to the raw source, and forbids raw removal.

The public restoration source checks the sealed manifest and source inventory, requires the old and comparison Git trees to name the same blob and mode, reads the pinned blob, verifies its size and SHA-256, and writes each output exclusively beneath a fresh directory. The retention readback pins file identities while comparing bytes and requires the 394-plus-196 partition to cover all 590 entries.

All eight child jobs have matching start and end identities. Each end receipt reports exit code zero, an absent `/proc/<pid>` path after waiting, and no live process with the recorded start time. The original verifier receipts match before and after. The history snapshots and logs match at 838 entries and 68,452,550 bytes.

The first closing observer failure remains in `closing-first-attempt-failure.json`. It records that the observer expected seven jobs when eight existed and that an unguarded follow-on command appended a premature success row. The append-only decision trail keeps that row, then explicitly supersedes it. The saved observer requires eight end receipts, directly checks every recorded PID path, scans for owned codec, restore, and retention commands, and records that no browser, server, protected port, or 839 execution ran. The corrected closing receipt reports all eight PID paths absent. The later release receipt points to that corrected receipt and leaves only file-only review and the final allowlist.

Both pinned commits remain reachable from named refs. The reachability receipt records `453c2218af9973b9eca8fb78392435bd9d46a740` and `83941bc80ce9ec08840b0645d9b33e8018d5309a` as ancestors of `refs/heads/codex/100-features` at `37bf0e794e7f62cf33347d2e92c739d593bf1cc4`; the 453 pin also remains under `refs/heads/codex/hosted-zero-delay-favicon-proof`.

## Import bounds

The preserved pre-review allowlist contains 241 files and 123,680,921 bytes. Its payload portion is 195 retained native files plus the gzip, totaling 121,647,397 bytes. It excludes the raw SQLite, decoded proof, and restored public tree. Destinations are unique and remain beneath `docs/evidence/save401-ai-lossless-453c221-r1`.

The final plan generator can bind unchanged large payload records to the prior full-read plan after checking that the current source is a regular non-symlink file with the same path, category, destination, and byte count. It will hash current metadata and this review. The plan records that provenance and requires the importer to verify every written file against its listed size and SHA-256. This is sufficient for admission because the slot-release record says the payload paths remain preserved under sole-writer ownership; import-time verification will reject a later same-size mutation.

The pre-review plan does not contain this review, the heavy-slot release, or the later reachability receipt. Root must generate a new reviewed allowlist before import.

## Limits

Public reconstruction still depends on preserving reachable Git objects for both pinned commits and their indexed public blobs. The reachability receipt proves this at its timestamp; the import must retain that reachability.

The raw SQLite and decoded equality proof remain local. The bounded import excludes both, and no local disk bytes were reclaimed. Hosted failed SQLite evidence and any future 839 runtime acceptance remain outside this review.

Three review-tool failures are preserved separately in `first-failures.json`. None was a payload-check failure, and none changes the result.
