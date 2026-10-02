# R7 prelaunch authentication candidate

The candidate authenticates one root-pinned expectation and the files it binds. It does not launch the capture. Root must independently review the saved candidate bytes before its single execution. Preparation used source reads and AST parsing only; the candidate was neither executed nor imported.

The CLI has two positional arguments:

```text
env -u PYTHONOPTIMIZE <reviewed-python-executable> /tmp/ovf-feature63-r7-prelaunch-preparation-architecture-Ey24e3td/authenticate-prelaunch-r7.py EXPECTATION_JSON EXPECTATION_SHA256
```

Use canonical absolute paths and a lowercase SHA-256 computed by root over the final expectation bytes. The checker rejects `-O`, `-OO`, or a present `PYTHONOPTIMIZE` before reading an authority input. Root creates the expectation after the reviewed binding generator succeeds. The future source pin stays a CLI-pinned expectation value; the candidate contains no chosen future commit ID.

The expectation is a JSON object with exactly these eleven fields. Duplicate keys and nonfinite numbers are rejected. Modes are integer permission modes, so `0644`, `0600`, `0700`, and `0400` become decimal `420`, `384`, `448`, and `256` in JSON.

| Field | Required value |
| --- | --- |
| `schema` | `feature63-r7-root-prelaunch-expectation-v1` |
| `sourcePin` | Full lowercase 40-character future commit ID, matching both checkouts and every new definition |
| `bindingDirectory` | Canonical `/tmp/ovf-root-feature63-r7-bindings-<suffix>` returned by the generator |
| `controlDirectory` | Canonical `/tmp/ovf-feature63-r7-capture-control-<suffix>` returned by the generator |
| `reportDirectory` | New empty UID-owned mode `0700` directory directly under `/tmp`, named `ovf-feature63-r7-prelaunch-report-<suffix>` |
| `readback` | Root descriptor for `bindingDirectory/root-binding-readback.json`, mode `0644` |
| `assignment` | Root descriptor for `bindingDirectory/capture-assignment.json`, mode `0644` |
| `launcher` | Root descriptor for `bindingDirectory/launch-capture.r7.py`, mode `0600` |
| `disposition` | Root descriptor for `bindingDirectory/root-capture-disposition.json`, mode `0644` |
| `r7StaticReview` | Fixed descriptor below |
| `launcherTemplate` | Fixed descriptor below |

Each descriptor has exactly `path`, `bytes`, `sha256`, and `mode`. `bytes` and `mode` are JSON integers. `path` is canonical and absolute. `sha256` is lowercase and 64 characters long. The expectation file must be UID-owned, mode `0400` or `0600`, and outside the binding, control, and report directories. The three directories must be distinct.

The fixed review descriptor is:

```json
{
  "path": "/tmp/ovf-feature63-r7-final-static-independent-review-upsx1DQX/review.json",
  "bytes": 10341,
  "sha256": "9be9b64bdd2a5637bed71ad6d8a36423b0e4242c3f1bd9afe519f172f3c9bd53",
  "mode": 420
}
```

The fixed launcher template descriptor is:

```json
{
  "path": "/tmp/ovf-feature63-static-prep-r3-zsttudqb/independent-launcher/launch-capture.r3.template.py",
  "bytes": 19356,
  "sha256": "1b99137e822c004361ee4ff1906f10f4284453312914092441666dd721f0feb3",
  "mode": 384
}
```

All supplied artifact descriptors are verified before their buffers are parsed or used. The checker retains definitions and parses each verified byte buffer once. Stable reads use one `O_NOFOLLOW` descriptor, regular-file and size checks, and equal before/after/named identities. Overlapping inventories reuse a verified descriptor while requiring the named identity to remain unchanged. Final identity checks detect changes to retained files and complete filename sets before writing the report.

The generated binding directory must contain the nine inventoried generated files plus readback itself. The assignment selects the five definitions, executables, producer, collector, and frozen auditor. The known static review must have its reviewed status, `runtimeExecuted=false`, no capture authorization, and the five unique reviewed roles. Both root and owned scripts must match those reviewed bytes. All 570 product files and 966 source files are authenticated in both checkouts; the protected 397-file dist, R7 398-file web and 22-file server, 114-file Playwright tree, and 303-file Chromium tree receive complete file-set checks. The original product/protected definitions also match their blobs at the expected Git pin. Git runs with optional locks and fsmonitor disabled.

The launcher is reconstructed from the frozen R3 bytes using only the generator's R3-to-R7 prefix/token literals and nine expected anchor substitutions. The checker builds the substitution map from pinned expectation values and reviewed digests, compares it to readback, compares the resulting launcher bytes, and parses those bytes as Python source. It never executes the launcher.

Slot objects and tokens must agree across assignment, disposition, browser, public, collector, and launcher. The token uses the expected pin prefix and generated binding suffix. Expiry must be UTC and remain more than 510 seconds away at the final output gate. Control must remain empty, UID-owned, and mode `0700`; the R7 prefix must still contain only dist and server before launch.

Only the later authorized checker execution reads the protected process and listener state. It checks PID `1063`, start tick `874`, SID `1063`, fd `22` bound to `socket:[3783]`, and current argv/cwd/executable against the assignment. It repeats bounded process snapshots and listener reads, requires protected port `4173` to contain that socket, and requires private ports `5373`/`5374` to be absent. Preparation performed none of these probes.

After all authentication gates pass, the checker exclusively creates `reportDirectory/root-independent-prelaunch-readback.json`, mode `0400`, fsyncs it, and reads the saved bytes back. An existing report makes the directory nonempty and prevents reuse. Mode `0400` and exclusive creation preserve the completed report through this utility; this does not claim a filesystem immutable attribute or prevent its owner from changing permissions later. A write failure may leave a partial report, and never produces a successful stdout result. The checker writes nothing in the binding directory, control directory, either checkout, build trees, or dependency trees.

The report records prelaunch authentication only. It grants no further capture authority and asserts no launch, native custody, extraction, native audit, feature63 qualification, or complete descendant exclusion. It does not enumerate prior SQLite custody metadata or read database/profile contents. Comparing the declared future collector database path is a string comparison only.
