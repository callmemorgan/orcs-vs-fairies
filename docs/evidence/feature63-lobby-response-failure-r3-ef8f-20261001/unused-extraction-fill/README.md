# Root fill utility for first r3 extraction

`fill-extraction-input63.py` is prepared source, not executed or imported. It reads retained non-database files and writes the existing 30-field extraction input to a fresh private external directory. It does not open or stat a raw database, start a process, run the frozen helper, inspect native lifetime, replay, run an auditor, or issue approval. Root reads it and decides whether to use it after a passing actual r3 capture and root-owned closure/custody work.

The frozen helper remains `/tmp/feature63-root-extraction-candidate-r2-LSZWmJUg/extract-closed63.py`, SHA-256 `fccd7ba02a92c2496b56699cb8fbb323f16cb2a817596093951b10a72446e7d8`. The future full pin is supplied explicitly; the utility does not read HEAD or infer it from old evidence. The intended actual capture prefix must be `work/feature63-human-wave-composition-r3`. Failed r1/r2 raw databases are never read or reused.

## Root inputs

Use `root-control-r3.pending.json` as the control shape. Root supplies its `outputRoot` (the future fresh helper output directory), `approved`, `extractAuthorized`, and `ownedNativeLifetimeIndependentlyAdmitted` decisions. The pending control keeps those approvals false and lifetime unknown. The utility copies those values unchanged. It does not infer them from PASS, custody, or closure reports. `nativeAuditAuthorized` and `rootExtractionAdmissionApproved` must remain false in the control and always remain false in the filled first-extraction input.

The remaining arguments identify original retained bytes:

| Argument | Root supplies |
|---|---|
| `--bindings` | The actual root capture-assignment JSON used for the passing r3 capture. It supplies the full source/checkout/prefix and retained source, build, producer, collector, and auditor descriptors. |
| `--capture-result` | Actual `<prefix>/lifecycle/driver-result.json`, recording the passing closed capture. |
| `--closed-raw` | Root's completed `feature63-closed-raw-v1` receipt after actual fresh raw closure/sealing. |
| `--custody` | Root's completed `feature63-root-raw-custody-v1` receipt, with the same actual raw metadata and original capture-result/closed-receipt descriptors. |
| `--lifetime` | Root's completed `feature63-root-native-lifetime-disposition-v1` receipt. Its capture-result descriptor and explicit native lifetime decision agree with root's control. |
| `--schema-review` | Root's separate schema-review receipt for the actual future pin and frozen auditor. The existing minimal shape is in the field-map packet. |
| `--public-driver` | The actual wrapper file used for the passing capture. Its digest must equal the actual capture assignment's `wrapperSha256`. |
| `--source-pin` | The complete actual 40-character root-assigned pin, matching all actual capture and root receipt identities. |
| `--output-directory` | A fresh private external directory for the filled input, separate from control `outputRoot` and outside both checkouts. |

The pending receipt shapes and field map are `/tmp/feature63-r3-extraction-input-map-nfNB1jVK`. Root completes the receipts from its actual decisions and closure facts. This utility binds their original bytes without altering their schema, approval fields, facts, paths, or provenance. It rejects inconsistent custody/lifetime references rather than rewriting an approved receipt.

The utility derives `serverBuild` from the actual build receipt's `rts-server.js` row, binds the actual runtime collector assignment, hashes the complete original nine public files and every retained collector checkpoint plus receipt/query log, and fills their existing descriptor maps. It never hashes the raw database. `rawDatabase` comes only from root's closed receipt metadata and the actual passing capture's device/inode identity.

## Executable forms for root

These commands are a recipe for later root use. They are not authorization to execute now. To obtain descriptors for root-created non-database receipts before filling their cross-references:

```sh
python3 /tmp/feature63-r3-root-fill-utility-V1J0sejh/fill-extraction-input63.py describe \
  --file /ABSOLUTE/ACTUAL/r3/lifecycle/driver-result.json \
  --file /ABSOLUTE/ACTUAL/closed-raw-r3.json
```

The describe form prints only descriptors, never file bodies. Root uses those descriptors in the custody and lifetime receipts. The raw file is prohibited as a utility input.

After root has completed its actual control and receipts:

```sh
python3 /tmp/feature63-r3-root-fill-utility-V1J0sejh/fill-extraction-input63.py fill \
  --control /ABSOLUTE/ACTUAL/root-control-r3.json \
  --bindings /ABSOLUTE/ACTUAL/capture-assignment-r3.json \
  --capture-result /ABSOLUTE/ACTUAL/r3/lifecycle/driver-result.json \
  --closed-raw /ABSOLUTE/ACTUAL/closed-raw-r3.json \
  --custody /ABSOLUTE/ACTUAL/root-custody-r3.json \
  --lifetime /ABSOLUTE/ACTUAL/root-native-lifetime-r3.json \
  --schema-review /ABSOLUTE/ACTUAL/native-schema-review-r3.json \
  --public-driver /ABSOLUTE/ACTUAL/run-minimal63.py \
  --source-pin FULL_ACTUAL_FUTURE_PIN \
  --output-directory /ABSOLUTE/FRESH/root-filled-input-r3
```

The output is `root-extraction-input-r3.json`, plus `retained-receipt-references.json`. Original bindings, receipts, control and runtime bytes stay unchanged. The utility creates the packet with mode 0700 and files with mode 0444. Standard output contains the new input descriptor and false audit/admission decisions. Root inspects and separately authenticates the input digest before any later helper invocation. The utility's printed digest does not supply execution authority by itself.

## Approval after concrete extraction

The first helper output remains unapproved for audit and admission. Root inspects its complete original packet, preserves it unchanged, then applies the separate approved-copy procedure under `/tmp/feature63-native-schema-promotion-basis-architecture-ct70a5d6`. Its recorded 1257/r2 pin and prefix are prior context; root rebinds the procedure to the actual future r3 pin, wrapper and paths.

Promotion copies the entire original bundle to a fresh private external directory, changes only the copied native assignment's `auditAuthorized`, recomputes its digest and complete copied-bundle inventory, and issues separate fresh admission and audit-phase wrapper assignments after root approval. This utility offers no promotion or audit command and changes no root decision after filling.

The original same-wave match criteria are unchanged. Runtime and SQLite behavior remain unverified by this preparation. No review chain is introduced.
