# R7 prelaunch octal-format correction

The corrected candidate changes one regex in `normalized_rows`: `0?[0-7]{3,4}` becomes `(?:0o)?0?[0-7]{3,4}`. This accepts the established lowercase `0o` prefix while retaining every format accepted by the previous pattern. Conversion still uses `int(permission, 8)`, and the existing integer mode bounds remain unchanged. No other candidate bytes changed.

Root reported that the first checker invocation exited 1 on a PRODUCT inventory mode such as `0o644`, before any report write or capture launch. This preparation did not read that execution directory, current bindings/control, processes, ports, or database/profile data. The original candidate and packet remain unchanged. The correction is a fresh external candidate, neither executed nor imported.

The CLI remains:

```text
env -u PYTHONOPTIMIZE <reviewed-python-executable> /tmp/ovf-feature63-r7-prelaunch-octal-correction-architecture-mkuAdGVP/authenticate-prelaunch-r7.py EXPECTATION_JSON EXPECTATION_SHA256
```

The expectation schema is unchanged: `feature63-r7-root-prelaunch-expectation-v1`, with exactly `schema`, `sourcePin`, `bindingDirectory`, `controlDirectory`, `reportDirectory`, `readback`, `assignment`, `launcher`, `disposition`, `r7StaticReview`, and `launcherTemplate`. The copied `expectation-schema.json` retains its original bytes and SHA-256. The four generated artifact fields require integer-mode descriptors with `path`, `bytes`, `sha256`, and `mode`. Root supplies the full source pin, canonical generated binding/control paths, and a fresh empty UID-owned mode0700 report directory under `/tmp/ovf-feature63-r7-prelaunch-report-<suffix>`. The expectation itself remains UID-owned mode0400 or0600, outside those three directories, with its SHA-256 supplied separately through CLI.

The fixed review/template descriptors and every authentication, process/listener, expiry, output, and qualification gate are unchanged. Root must review the corrected candidate and independently confirm the unconsumed capture state before any corrected prelaunch invocation. The candidate writes only its external report after authentication gates pass. It admits no launch, native custody, extraction, audit, feature63 qualification, or complete descendant exclusion.

`inverse-byte-proof.json` records the one substitution and shows that reversing it reproduces all original bytes. `regex-only.diff` has one changed source line. `syntax-evidence.json` records AST parsing without candidate execution or import.
