# Sealed packet retention plan

This is a static plan for `/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/work/ai-save401-final-453c221-r1`. The original packet remains unchanged. Its source pin is `453c2218af9973b9eca8fb78392435bd9d46a740`; the comparison Git pin is `83941bc80ce9ec08840b0645d9b33e8018d5309a`. The original `final-manifest.json` has SHA256 `bf8ed2449d14c0f3bcf00d32af4ca831885c08212be96fecc96ebd8d581ee681`.

The sealed manifest inventories 590 entries totaling 373,014,330 bytes and excludes itself. The manifest is 91,644 bytes. Counting it gives 591 packet files and 373,105,974 bytes. `retention-index.tsv` preserves the original packet, pin, path, SHA256 and byte count for every inventoried entry. The original manifest and sealed source inventory are copied here with their bytes unchanged.

## Public copies backed by Git

The 394 entries in `source-backed-public-duplicates.tsv` total 68,373,454 bytes. They map `dist/<path>` to `public/<path>` at the comparison pin. Each row passes this metadata chain:

1. The copied final manifest matches the supplied sealed manifest SHA256.
2. The original `envelopes/build-web/source-before.json` matches its sealed manifest record: 128,449 bytes and SHA256 `eb414c0a5c82b49110c36e83c8fad83e16c35ff886560d1116511a334b52c910`.
3. The source inventory's `assetFiles` entry has the same SHA256 and byte count as the original `dist` entry.
4. That source record's Git blob and byte count match the original source Git tree. The comparison Git tree has the same blob, `100644` mode and byte count.

This chain uses the recorded payload hashes and read-only Git tree metadata. This task did not read or hash the 68 MB of asset payloads again. The index records the comparison root tree as `f881294cb0479a6d1ed4f00112ac7f9cfa6c0551`.

A future derivative may represent these public copies through the index only if it retains the manifest, source inventory, index and a reachable Git object store containing the pinned commit and blobs. This plan authorizes no removal from the sealed packet. `restore-public-duplicates.py` is an unexecuted recipe that reads those blobs, checks their SHA256 and size, writes copies beneath a new retention subdirectory and reads the written copies back. No build is needed to restore them. The script has not been run or runtime-verified.

## Entries that need actual bytes

The other 196 inventoried entries total 304,640,876 bytes and appear in `retain-actual-bytes.tsv`. Preserve their actual bytes. These include native saves, replays, frames, screenshots, transport captures, failed runs, observer and reviewer records, corrections, package and source/build inventory records, run envelopes, history inventories, logs and generated executables. Equal hashes among these records do not authorize reducing them to references because their original paths and roles are part of the evidence.

Four generated web outputs need actual bytes: `dist/assets/main-BxMb13AF.js`, `dist/assets/main-CxCO6VnC.css`, `dist/editor.html` and `dist/index.html`. Together they total 2,533,120 bytes. They have no direct public-source copy mapping; another build would not prove byte equality with the sealed outputs.

The raw `server-data/server.sqlite` is 222,466,048 bytes with SHA256 `68634fdb8c709812659afbd36558b97ff98eb3874df918ef631355b106f346d5`. Preserve its recorded `server.sqlite-shm` and empty `server.sqlite-wal` separately. The recipe never opens SQLite or performs checkpoint, vacuum, backup or database edits.

## Held lossless encoding recipe

Compression is HELD while another task owns the heavy slot. `held-sqlite-plan.json` records unknown encoded and decoded values as `null`; it claims no compression, equality result or storage reduction. `held-sqlite-lossless.py` is an unexecuted recipe. Running it requires the current owner to release the slot explicitly and a new output directory name. The acknowledgement flag does not grant that release.

The recipe opens the raw source read-only, rejects symlinks and changed identity/metadata, checks the raw size and SHA256 while encoding, pins the output directories with descriptors and creates gzip and decoded sidecars relative to those descriptors, and retains all outputs on failure. Its decoder caps encoded input at 230,854,656 bytes and decoded output at the pinned raw size, requires one complete gzip member, rejects truncation and trailing bytes, and requires the recorded raw byte count. It then reads the decoded file back, records its SHA256 and compares every byte with the immutable raw source through simultaneous EOF. It records the encoded SHA256 and byte count from the closed encoded file during verification.

A future run must finish those checks and inspect its result record before reporting any lossless result. The raw database stays in place after successful verification. Encoding plus a decoded sidecar adds storage while raw bytes remain; no saving has been measured. Budget for the 222,466,048-byte decoded sidecar and a gzip sidecar that may be larger than the raw input. Stable-source checks detect changes; the immutable-source requirement prevents other tasks from changing the source during a future run.

Only after explicit slot release, these are the recipe commands. They are reference instructions, and this task has not executed either command:

```bash
python /home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/retention/held-sqlite-lossless.py --heavy-slot-released --run-name sqlite-codec-r1
python /home/morgana/.codex/worktrees/assembled-allied-ai/ai-83941bc-retry-prep-r1/retention/restore-public-duplicates.py --run-name restore-public-r1
```

This work performed no build, compiler, test, simulation, browser or server run, install, compression, archive, deletion or checkout mutation. The old 838 historical entries totaling 68,452,550 bytes and the `node_modules` symlink remain untouched. The plan does not change runtime acceptance, the sealed failed-run outcome, or any observer/reviewer correction.
