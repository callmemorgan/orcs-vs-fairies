# Pending r3 extraction input

This packet maps the existing corrected helper's inputs. It does not approve capture, closure, extraction, schema disposition, native audit, or feature 63. The future full source pin remains null. The intended prefix is `work/feature63-human-wave-composition-r3`; root must take the actual checkout, prefix, and full pin from the passing future capture assignment. No old r1 or r2 database is an input.

The helper is `/tmp/feature63-root-extraction-candidate-r2-LSZWmJUg/extract-closed63.py`, SHA-256 `fccd7ba02a92c2496b56699cb8fbb323f16cb2a817596093951b10a72446e7d8`. This preparation neither imports nor executes it. All pending extraction approvals are false, audit/admission approvals are false, and native lifetime is unknown.

## Fields root fills

`field-map.json` gives each input's source and its required value equality. `root-extraction-input-r3.pending.json` contains only the helper's required input fields. File descriptors contain exactly `path`, `bytes`, and `sha256`; do not put modes, labels, or review metadata inside them. `rawDatabase` contains exactly those three keys plus `device` and `inode`.

Most fields come from existing capture bindings, rather than new receipts:

| Input | Fill from the actual passing future capture |
|---|---|
| `sourcePin`, `sourceRoot`, `freshPrefix` | Copy those values from the actual capture assignment. The full pin remains unknown in this packet. |
| `captureAssignment` | Descriptor of the complete actual root capture-assignment file bytes. |
| `sourceInventory`, `buildBinding` | Copy `captureAssignment.sourceBinding` and `.buildBinding` descriptors unchanged. |
| `publicProducer`, `collector`, `auditor` | Copy those capture-assignment descriptors unchanged. |
| `publicDriver` | Descriptor of the actual frozen wrapper file used to run the passing capture. Its digest equals `captureAssignment.wrapperSha256`; capture supplies this hash rather than a `publicDriver` descriptor. |
| `serverBuild` | Convert the actual build receipt's `serverRecords` row for `rts-server.js` to a descriptor at `<sourceRoot>/<freshPrefix>/server/rts-server.js`, using that row's bytes and hash. Omit its mode from this descriptor. |

After a passing capture and actual owned closure, root fills the output and custody fields:

| Input | Actual future evidence |
|---|---|
| `captureResult` | `<prefix>/lifecycle/driver-result.json`; it must record `CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING` with no first failure or cleanup failures. |
| `collectorAssignment` | `<prefix>/lifecycle/collector-assignment.json`, bound to the same fresh raw identity and early public match identity. |
| `collectorFiles` | `<prefix>/native-collector/collector-receipt.json`, `queries.ndjson`, and every actual checkpoint named consecutively from `native-wave-checkpoint-01.json` through the actual count, at most four. The pending map includes 01 as a shape placeholder; root appends 02–04 only when those files are retained. |
| `publicFiles` | The nine literal files already named in the pending input, at `<prefix>/public/<name>`, with unchanged complete bytes. |
| `rawDatabase` | Only `<prefix>/server-data/server.sqlite`, retaining the original capture path and its actual device/inode. Root supplies the byte count and digest from the newly closed and sealed r3 raw. |
| `closedRawReceipt` | Descriptor of root's completed `closed-raw-r3.pending.json` shape. |
| `rootCustodyReceipt` | Descriptor of root's completed `root-custody-r3.pending.json` shape, with identical raw, closed-receipt, and capture-result objects to the input. |
| `rootNativeLifetimeReceipt` | Descriptor of root's completed `root-native-lifetime-r3.pending.json` shape, binding the capture result and nonempty independent closure-evidence descriptors. |
| `ownedNativeLifetimeIndependentlyAdmitted` | Root's actual independent closure disposition, repeated in the lifetime receipt. Reports alone cannot supply this true value. |
| `nativeSchemaReview` | Descriptor of a separate four-field root schema review for the future actual pin and frozen auditor. Pending shape: `native-schema-review-r3.pending.json`. |
| `outputRoot` | One new canonical private external directory outside both checkouts. Its parent must exist and the output directory must not yet exist. |

Root establishes the fresh r3 raw's actual closure, custody and filesystem seal before filling the raw receipt. The helper requires a regular single-link file at the original r3 path, at most 1 GiB, with no writable permission bits and no WAL, SHM, or journal sidecars. Root's independently retained failed r1/r2 hardlinks are not reused, queried, or compared to the new match. This preparation does not inspect or hash any raw database.

Every receipt's `sourcePin` uses the actual future pin; every `matchId` uses the actual passing capture result's match. The capture fresh DB identity, collector assignment/receipt, closed receipt, custody object, and extraction raw descriptor must agree. Bind complete original JSON/NDJSON bytes without reformatting existing runtime files. Root-created receipts may be serialized once and then retained under their descriptor.

Root must eventually supply `approved=true` and `extractAuthorized=true` to authorize the concrete closed extraction input, with approved custody, lifetime and schema receipts. No such authorization is issued here. Keep `nativeAuditAuthorized=false` and `rootExtractionAdmissionApproved=false` for the first concrete extraction.

## Separate approval after extraction

The existing basis is `/tmp/feature63-native-schema-promotion-basis-architecture-ct70a5d6`. Read `native-schema-disposition-basis.json`, `post-extraction-promotion-procedure.json`, and `promotion-procedure.md` there. They record the older `1257b24db0121a72a12a6de10592397dc4996038`/r2 context. That pin and prefix are reference context; they do not fill or approve the future r3 capture. Root binds the actual future source/auditor and applies the procedure to the actual future pin and prefix.

The four-field schema receipt needs `approved`, `status`, `sourcePin`, and `auditorSha256`. The pending receipt has `approved=false`, `status=pending`, `sourcePin=null`, and the frozen auditor digest. Root's separate approved receipt, if issued after its review, uses the actual future pin and input auditor digest. This packet adds no required `schema` field to that receipt.

After root inspects the complete concrete extraction, preserve the original unapproved extraction directory unchanged. Apply the existing independent-copy procedure: copy the complete bundle into a fresh private external directory, change only the copied native assignment's `auditAuthorized`, compute its new digest and complete copied bundle inventory, and issue a fresh admission and audit-phase wrapper assignment outside that copied bundle. Original input, receipts and unapproved output stay unchanged. This preparation issues no promotion or audit authorization.

The match predicate remains the original same-wave composition criteria: accepted eligible human attack witnesses from both human owners collectively target both AI owners in the one authenticated native wave while both humans remain alive. This field map adds no victory, 4v4, AI-to-human hit, same-launch-and-hit-tick, or end-of-fight requirement.

## Future invocation form

Root alone may authorize and invoke the existing helper after the actual passing capture and closure evidence exist. This is a command form, not permission to execute now:

```sh
python3 /tmp/feature63-root-extraction-candidate-r2-LSZWmJUg/extract-closed63.py \
  --assignment /ABSOLUTE/ACTUAL/root-extraction-input-r3.json \
  --assignment-sha256 ROOT_AUTHENTICATED_EXTRACTION_INPUT_SHA256
```

The input digest is a separate root trust anchor, supplied outside the input file. Root retains the resulting unapproved packet for concrete review; the later native auditor uses its own separate approved assignment digest.
