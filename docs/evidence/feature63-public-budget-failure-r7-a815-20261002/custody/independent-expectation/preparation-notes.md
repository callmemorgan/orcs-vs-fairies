# R7 failure custody expectation candidate

This candidate follows the reviewed custody utility and schema for match `def0d24e-8c4a-45cf-b654-c2b017c2a1a2` at source pin `a8152d0dc83dff49fb93f09606e7bbf2c3510894`. It selects the failure branch, wrapper exit `1`, and the complete published 64 MiB failure object. The concrete launcher exited `0`; that exit is separate from the wrapper failure.

`approved` is false. The reviewed utility rejects this candidate at its root-approval gate before it loads authority files. This preparation issues no approval and grants no authority to execute custody. Root will independently derive and authenticate a separate approved expectation if authorized. Do not execute or change this candidate into authority as part of this preparation.

The fifteen authority descriptors use exactly `path`, `bytes`, and `sha256`; mode and stable-read metadata appear only in `field-provenance.json`. Driver registration keys and remembered launcher resource keys agree. Launcher and wrapper lifetime tuples come from `launch.json`; the launcher PID also matches operator metadata. Product/protected definition paths come from the authenticated package receipt selected by root-pinned binding readback. Their JSON definitions were read; their referenced product/build/dependency member files were not authenticated in this preparation.

The raw path/device/inode tuple comes only from matching server-ownership and capture-result metadata. No raw-file stat, open, read, hash, seal, link, SQL, extraction, audit, or checkpoint-file read occurred. Root's supplied external output parent is retained as a string. Its same-filesystem hardlink eligibility and the raw inode's current state remain for root's independent custody gates.

This packet contains a byte-exact copy of the reviewed utility (SHA-256 `da53c2865998eb6a6851eeb99a4b7e3cae85ef0b474baffc90059a5c5623e824`) and schema (SHA-256 `18d1444377e49c14120e7a9c399459de54e5757a889599a24ca4ef4b2c7862f2`). The utility was parsed as source and never executed or imported.

`unobservedDescendantsExcluded` remains false. The exact expectation schema has no field for that qualification, so this packet preserves it in provenance and points to the false values in the authenticated capture and closure metadata. No slot release, retry, custody admission, feature63 qualification, or checkout/control/raw mutation is claimed.
