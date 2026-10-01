# Final economy acceptance evidence, 2026-10-01

The fresh economy browser proof passed all 25 guards at source pin `c86e273c70738f144a00fe75f5ecf39e7fa324d8`, SAVE4, and simulation revision `4.0.1`. Its three commanded, reloaded, and replayed native validators exited 0. The complete session files are byte-identical, the report contains the same session, and the replay export matches the recorded replay. The final game tick is 8494.

The selected modal and settlement proofs remain the successful runs at `db36593f816a57e29220d760de14455cec969f0b`, SAVE4, revision `4.0.0`. They passed 12 and eight guards and six native validators. These families were retained as root requested; they were not rerun or relabeled as 4.0.1. The selected acceptance therefore contains nine native validations with two honest source pins and revisions.

| Selected family | Snapshot | Source pin | Rules | Guards | Native validations |
| --- | --- | --- | --- | --- | --- |
| Economy | `final-economy-4.0.1/browser` | `c86e273c70738f144a00fe75f5ecf39e7fa324d8` | 4.0.1 | 25 | 3 |
| Modal | `db36593/modal-browser` | `db36593f816a57e29220d760de14455cec969f0b` | 4.0.0 | 12 | 3 |
| Settlement | `db36593/settlement-runtime` | `db36593f816a57e29220d760de14455cec969f0b` | 4.0.0 | 8 | 3 |

`accepted-runs.json` fixes this selection. Original failures remain in `first-failures-af44` and `db36593/browser`. The af44 economy run stopped after 21 guards at an ambiguous Map level locator and API response classification failures. The db36593 economy run completed 25 guards and native equality but failed while reading a pending API response body after browser closure. Both remain failed. The independent prior-run review records their receipts, native checks, and original output inventories.

The fresh run authenticated pinned Git bytes, bundled schema, generator, and checker with esbuild metafiles, generated and validated the mixed fixture, typechecked, and built browser/editor, CLI, server, and tournament entries. Every command exit is retained. Its source digest is `24ef16d7e77323366b2c41f0cc15a93299d068587572dbce5366aa5088cca7c4`; application build ID is `af4b40282bb086e0dccf5aad4e8c38819b2d2eb80370fb749e728a9f33cdb87a`.

The browser exercised native controls for construction, grove growth, canvas harvesting, caravan routes, finite markets, raids, salvage, contracts, specialization, cavern visibility/payment, and specialist selection. It recorded 340 compiled-asset responses and 62 API responses. The finalizer removed two body listeners and drained its fixed set of 405 response tasks before browser closure. There were no page, console, request, HTTP, or driver errors. The complete 397-file served inventory matched the prepared build both before and after the run. All five screenshots were visually inspected.

Node was v24.21.0, npm 11.19.0, Playwright 1.62.1, and the existing headless Chromium executable was Google Chrome for Testing 151.0.7922.34. The executable SHA-256 was `e11fc9ce65c96313476f7ee9844b6fb6a9220fb048693cfe9eee00acf4170a9f`. Source, proof scripts, modules, fixture, generated browser files, and executable hashes stayed unchanged. The owned preview PID 3914341 received SIGTERM after the validations and exited 143. Both the socket listing and a direct bind confirmed port 5398 clear; the process was absent.

## Retained files and omissions

The package retains original non-dist proof files byte-for-byte, including sessions, reports, replay exports, screenshots, logs, receipts, modules, metafiles, provenance, and inventories. `omitted-build-assets.json` lists every omitted generated dist path with byte count and SHA-256, and associates it with its original output inventory. Original generated builds remain in their temporary output directories. The fresh dist contains 397 files totaling 70,874,533 bytes; each old dist contains 397 files totaling 70,874,298 bytes.

The response classification and teardown probe folders retain the admitted repairs' browser probes and independent admission. Eighteen classification probes cover API fallback HTML, redirects, workers, importScripts, executable MIME responses, and known/tampered JSON. Five fault cases cover observation teardown. The fixed 25/12/8 guards and full native equality comparisons were kept throughout.

The historical `docs/evidence/economy-final-rerun-recipe.md` describes preparation before this final execution. Its old unexecuted status is not the acceptance status of this package. No full test suite was rerun for this economy acceptance. No production, codec, ledger, or decision trail files were changed.

## Portable retained-byte audit

`verify-retained-evidence.py` validates the package inventory, exact accepted snapshot policy, original output mappings, complete pinned input inventories and Git bytes, source/build IDs, bundled module inventories/metafiles, response classification/drain evidence, post-run identities/exit codes/port closure, browser artifact manifests, all nine selected native receipts, and complete native session/report/replay equality. It recomputes game hashes with Node JSON.stringify to match the application. It does not execute the browser, simulation, save loader, or replay checker.

Run from any checkout containing the retained Git pins, using Node and Python:

```sh
python3 verify-retained-evidence.py /path/to/orcs-vs-Fairies c86e273c70738f144a00fe75f5ecf39e7fa324d8
```

`artifact-hashes.json` hashes every package file except itself. The evidence commit binds that manifest. The manifest's final external digest is reported outside the package to avoid recursive self-inventory. Native receipt logs and successful audit output remain available alongside the selected snapshots.

The independent final admission reviewed the 243-file package before its report and audit log were copied into the archive. Its recorded manifest digest therefore identifies that reviewed baseline. The report's packaging note attributes the 9,548-to-9,550 check increase to new assertions. The verifier did not change between those runs: adding the retained audit log added two inventory assertions, one for size and one for hash. The initial audit log is preserved, and the main audit log is replaced with the complete final package's result before regenerating hashes and rerunning the audit. No original proof snapshot changes during this final packaging.
