# Retention and decision-trail review

No retention-plan or decision-trail defect found. This review covers the final static package at `/home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1` and identifies the reviewer as GPT-5.6 Sol.

## Decision trail

`decisions.tsv` has one header and five six-column data rows in the expected order: applicability, recipe, cleanup, retention, and readback. Every evidence path named by those rows exists. The applicability record binds 598 inputs, reports 565 identical runtime/build inputs, and limits the difference to two proof-parser files whose other assertions remain byte-identical. The recipe record is held. The cleanup row points to the revised helper record, and the retention row agrees with the final retention summary.

The readback row points to `applicability/retention-readback.json`, SHA-256 `ae1e2a11efbdc3c83e0afbfe0db93bf5efa3ed591627649965a88829fb57ccba`. It records a passed static readback of all ten prepared retention-file hashes, all 590 original-path mappings, the 394 public hash/blob chains, and the 196-entry actual-byte partition. Its scope excludes the large original payloads, held recipes, compression, and runtime claims.

The final snapshot establishes the five rows and their evidence. It does not by itself reconstruct earlier versions of the file, so historical append-only writing cannot be proved beyond this snapshot.

## Sealed packet index

The copied `sealed-final-manifest.json` is byte-identical to the current original manifest and has SHA-256 `bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681`. The copied build-web source inventory is also byte-identical to its original, with SHA-256 `eb414c0a5c82b49110c36e83c8fad83e16c35ff886560d1116511a334b52c910`.

The sealed manifest inventories 590 entries totaling 373,014,330 bytes. Including the 91,644-byte manifest gives 591 files and 373,105,974 bytes. Every row in `retention-index.tsv` matches one sealed manifest path, byte count, and SHA-256 value.

The index splits cleanly into two disjoint sets that cover all 590 entries. The 394 source-backed public copies total 68,373,454 bytes. For every row, the original `dist/` record matches the copied source inventory's `public/` record, and both Git pins have the same `100644` blob and byte count. This review checked metadata and Git trees; it did not read or hash the 68 MB of payloads.

The other 196 entries total 304,640,876 bytes and remain marked for actual-byte retention. Category counts and byte totals match the summary. This set includes the four generated web outputs, the 222,466,048-byte SQLite database, its shared-memory and empty WAL companions, native saves and replays, screenshots, transport captures, failed runs, corrections, build outputs, and provenance records.

All ten files listed by `retention-output-manifest.json` match their recorded sizes and hashes.

## Held recipes

The SQLite plan remains `HELD`. Encoded and decoded paths, sizes, and hashes are null; full byte equality and storage savings are also unknown. The unexecuted codec requires explicit slot release, pins source and output identities, rejects symlinks, caps encoded input at 230,854,656 bytes and decoded output at the raw size, requires one complete gzip member with no trailing data, and compares every decoded byte with the immutable raw source. It never permits raw removal.

The public restore recipe is also unexecuted. It requires a new output directory, reads each pinned Git blob, checks size and SHA-256, writes the restored copy, and reads it back before recording success. Neither recipe contains a deletion path.

## Cleanup trail

The revised cleanup helper checks that its server target does not own protected port 4173 before sending `SIGTERM`, then compares the full protected-listener identity afterward. It gathers partial browser ownership from completed launch traces, R3 process records, and original DEBUG stderr. If any attempted browser phase lacks ownership evidence, the helper refuses a complete cleanup claim.

The separate browser-close helper checks one live root PID, start ticks, executable, checkout, debugging-pipe token, profile, and protected-port exclusion before signaling that PID. Its own text limits the result to that root; captured descendants and profile processes require separate PID/start-tick inspection. Both helpers remain unexecuted.

## Attention flags

1. The 68,373,454 bytes of indexed public payloads were not re-read or rehashed. Their admission depends on the sealed metadata and matching Git blob, mode, and size chain.
2. The codec and restore recipes have not run. No encoded size, compression ratio, decoded hash, full equality result, or storage saving is known.
3. Cleanup is still a held recipe. Unknown partial-phase ownership blocks a complete claim, and the scoped close helper covers one verified browser root only.
4. The copied manifest and source inventory match their current originals, but this light review did not rehash the remaining 373 MB of packet payloads.
5. The final decision-trail snapshot cannot independently prove how earlier versions were appended.

This review performed no packet payload rehash, recipe execution, compression, restoration, runtime, browser, build, test, server, dependency, checkout, or original-packet mutation. The machine-readable audit is `review/trail/audit.json`.
