# Root-only closed extraction candidate r2

R2 adds one timer reset after the initial authenticated raw hash and SQLite authorizer setup, immediately before the progress handler. The 60-second query deadline starts there. The original candidate and reviews remain unchanged in `/tmp/feature63-root-extraction-candidate-MMGhTuvE`. This correction changes no extraction query, receipt, filename, quota, source binding, or root authorization.

This is a prepared, unexecuted helper. It has not opened SQLite, launched a process family, replayed a match, run an auditor, or inspected the native lifetime. The failed first capture is not an extraction input. Root must supply a future passing capture, its full source pin, its fresh prefix, and independent closure and custody receipts.

The helper writes only a fresh external output directory. Its directory has mode 0700 and each output file has mode 0444. The output includes a `bundle` directory for the frozen native auditor, supplementary selection and raw-verification receipts, a wrapper extraction admission, and descriptors for root to review. Standard output contains descriptors and public match identity only. Root must keep this directory and any native auditor output outside the public producer, browser controls, and public UI.

## Root invocation

Root must read the helper and its static review, authenticate its bytes, complete a new extraction assignment, and supply the assignment digest independently. The following is an invocation form, not authorization to run it now:

```sh
python3 /ABSOLUTE/APPROVED/extract-closed63.py \
  --assignment /ABSOLUTE/ACTUAL/root-extraction-input.json \
  --assignment-sha256 ROOT_AUTHENTICATED_EXTRACTION_ASSIGNMENT_SHA256
```

The assignment uses `feature63-root-closed-extraction-assignment-v1`. `approved`, `extractAuthorized`, and `ownedNativeLifetimeIndependentlyAdmitted` must be true. `assignedBy` must be `/root`. Here `/root` identifies the assigning agent, not a Unix UID. The full 40-character pin comes from root's assignment and must match the authenticated capture and current owned checkout. The helper does not infer a pin from current HEAD. `helperSha256` must match the approved helper bytes.

`sourceRoot` and `freshPrefix` identify the future owned checkout and capture directory. The prefix must be a canonical relative `work/.../feature63-human-wave-composition-rN` path. The sole raw path is that prefix's `server-data/server.sqlite`; its device and inode must match the actual passing capture and collector. The raw file must have one link, no write permission bits, no WAL/SHM/journal sidecars, and a root-authenticated byte count and SHA-256. Root performs any checkpoint, closure, ownership authentication, custody transfer, and sealing before invocation. The helper does none of those actions.

All bound file descriptors have exactly `path`, `bytes`, and `sha256`. Root supplies actual descriptors for the capture assignment/result, source inventory, build binding, production `server/rts-server.js`, approved native schema review, current producer/driver/collector/auditor scripts, actual collector assignment, complete collector files, nine public inputs, root closed receipt, root custody receipt, and independent native lifetime receipt. Pending specimens deliberately contain false approvals and null identities. They cannot authorize extraction.

The root custody receipt uses `feature63-root-raw-custody-v1` and requires `approved=true`, `assignedBy=/root`, the same source pin and match ID, `rawDatabase`, `closedRawReceipt`, and `captureResult` descriptors, and true `freshDatabaseAuthenticated`, `oldRawNeverReadOrReused`, `rootSealed`, and `noLivePrivateReadback` fields. The independent lifetime receipt uses `feature63-root-native-lifetime-disposition-v1` and requires the same root identity, pin, match, and capture-result descriptor, `ownedNativeLifetimeIndependentlyAdmitted=true`, and nonempty bound `closureEvidenceDescriptors`. This receipt is a root disposition from actual closure. Capture or collector reports cannot substitute for it.

The native schema review is separately bound and requires `approved=true`, `status=approved`, the same source pin, and the frozen auditor digest. Root remains responsible for the review's substance. The helper verifies the capture source inventory's actual files, then checks each of the 22 required native source paths against the assigned Git commit's blob and mode. It emits the native auditor's distinct `feature63-source-binding-v1` receipt, with `collectorSourceInventorySha256` equal to the original collector inventory digest. `serverBuildSha256` is the digest of the authenticated production `rts-server.js`, whose bytes the server uses as `engine_hash`.

## Selection and byte preservation

The public candidate index stays the index recorded by the producer. The helper chooses among authenticated collector checkpoints and waves that contain both AI owners and whose eligible, accepted-command human attack observations cover both human owners and both AI target owners. It chooses deterministically by required frame count, checkpoint filename, and wave ID. It does not choose another public candidate or omit inconvenient events.

The retained ticks are the sorted unique union of the adjacent launch bracket, the public fight's first and last ticks, and every frame containing a qualifying human attack to that selected wave's participant set. The helper scans the complete fixed public window using original wire payloads and accepted-command eligibility snapshots. Both humans must remain alive in every public window and preceding frame. The selected native bracket must have living participants and source-derived shared `attackMove` transitions. Complete normal UI lifecycle, source/public account bindings, collector query provenance, and all frozen auditor predicates remain the native auditor's responsibility. A helper result never establishes feature 63 qualification.

The helper uses metadata-only, match-specific bounded SELECTs to check lengths and confirm the native launch bracket. It records their text, parameters, and row counts in `selection-receipt.json`, whose descriptor is bound by `extraction-receipt.json`. It then runs the auditor's required match SELECT and one exact bounded frames SELECT. `extraction-receipt.queries` contains only those two required entries, in their required order. No broad dump, replay, projection of checkpoint/views, or truncation is available.

SQLite uses a held, authenticated raw-file descriptor with `mode=ro&immutable=1`. The authorizer admits only `main.matches` and `main.frames` columns needed by the fixed SELECTs and the `length` and `json_extract` functions. SQL and parameters must match the helper's literal query forms. The helper hashes and verifies the raw file's path, inode, size, timestamps, mode, link count, and absent sidecars before opening SQLite and again after closing it. It publishes no bundle until both checks pass.

`native-checkpoint.json` contains the complete original selected checkpoint column bytes. Each native frame contains the complete original views column bytes. SQLite's `text_factory=bytes` avoids decoding and reencoding those outputs. `match-row.json` contains all selected row metadata, parsed config, and the complete original config text as a string. The checkpoint column is split into its own literal file, so it is not duplicated in the metadata row. Every original collector checkpoint is copied unchanged, with its sequential row reference. All nine public files and the collector and closed receipts are copied unchanged.

The native files have a combined 8 MiB cap, public files a combined 64 MiB cap, and auditor receipts a combined 1 MiB cap. Collector complete output also retains its original 8 MiB cap. NDJSON has the frozen auditor's 200,000-row cap. The helper rejects a required frame union over 16 frames or over the byte cap. It does not truncate, project, or retry. Extraction has a 60-second SQLite progress-handler bound; full before/after raw hashing is outside that query deadline.

## Root review and audit admission

`nativeAuditAuthorized` and `rootExtractionAdmissionApproved` are explicit root input booleans. Their pending values are false. Keep both false for an extraction whose concrete output root has not inspected. The helper copies them into the native assignment and wrapper admission; it never derives approval from a PASS report. The native lifetime boolean is separately required before any database open and comes from actual closure evidence.

The generated native assignment has the auditor's exact field set and file descriptors. The wrapper admission contains the generated bundle's complete filename, mode, byte-count, and hash inventory, the native assignment digest, actual bundle path, capture descriptor, and supplied root lifetime decision. Root must inspect the actual bundle, selection evidence, unchanged raw verification, and output descriptors before admitting it. If root changes authorization fields after inspection, root must recompute the native assignment digest, complete bundle inventory, and wrapper admission descriptor. The helper does not execute the auditor or update wrapper assignments.

After root admits the concrete output, the native auditor invocation form remains:

```sh
python3 /ABSOLUTE/APPROVED/native-audit.py \
  --bundle /ABSOLUTE/ACTUAL/output/bundle \
  --assignment-sha256 SEPARATELY_AUTHENTICATED_NATIVE_ROOT_ASSIGNMENT_SHA256
```

The dedicated wrapper consumes the returned `nativeAuditAssignment`, `rootExtractionAdmission`, and `nativeBundle` fields after root authenticates them and supplies a separately approved audit-phase wrapper assignment. The native auditor's pass remains `closed-native-composition-pass-pending-root-disposition` with `qualificationClaim=false`.

## Static preparation limits

The pending source receipt identifies only the source bytes read at preparation time. Its observed pin is context, not a future execution pin. Its root authorization, collector inventory, build binding, and schema review remain pending. Root must regenerate actual source binding against the authenticated future capture.

Static syntax and contract review do not prove that this helper's SQLite FD URI or authorizer works in the future runtime. Root alone may perform the approved closed extraction. If the deterministic collector wave fails the selected native launch checks, extraction stays held instead of trying a different wave or frame set. That limitation preserves a reviewable first failure; root must dispose of it from the original captured evidence.
