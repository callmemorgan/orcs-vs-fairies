# Independent static review of pending evidence importer

No blocking defect was found against the requested Claude flags for the two reviewed, pinned allowlists. This is static source and plan review; the importer was not executed, no payload was copied or staged, and no large payload or database was read or rehashed.

Reviewed producer/retain_evidence_packet.py SHA-256 8980143a326de3216ee0dbfbb2e0e9d2ec5547939cbb2e4e8e3769e8507a634e (7,043 bytes), faction.json SHA-256 186489e43f866e607e7b1eb85c4f9d2446b0f029bf57c8bbae6d457c52f63ad4 (423,126 bytes), and hosted.json SHA-256 4cd28edb76a570b581ade69b8be2da7f8ce247dd628f53d19996d40c0b638a1f (238,287 bytes). The observed root HEAD was 703fc036c6327a830a79d5746eec805188cbbaa6; the importer requires the caller's expected HEAD before performing retention.

## Requested flags

Explicit pinned allowlist: lines 55-63 pin HEAD, the exact normalized plan bytes, and the source-plan seal. Lines 40-49 restrict each row to its docs/evidence packet prefix and reject absolute paths, parent traversal, symlink destinations/ancestors, and repository escapes. The two actual plans contain canonical, unique destinations, no Git pathspec metacharacters, and no collision with the generated receipt path. They have 181 faction rows totaling 37,650,106 bytes and 185 hosted rows totaling 27,607,138 bytes. All rows are regular-file retention entries with declared mode 0o644. No database or dependency-tree row is included.

No bare asserts: none occur in the producer. require() at lines 16-18 raises ValueError, so interpreter optimization does not remove these checks.

Ignored paths: line 93 uses git add -f -- with only the row destinations. It does not stage packet directories or expand an enumerated directory tree. The explicit plan paths contain no wildcard/pathspec syntax. check-ignore at lines 89-90 permits only normal ignored/not-ignored return codes.

Full-byte index readback: lines 95-100 read each complete staged blob with git show, verify length and SHA-256 against its pinned row, and check stage 0 plus expected executable/nonexecutable Git mode. A clean/smudge or EOL transformation cannot produce a passing row unless the index bytes still match the supplied seal. Receipt construction and writing occur only after every row passes.

Modes and original equality: lines 29-36 reject nonregular source files and verify full bytes plus exact source/destination permission mode where supplied. Lines 69-72 compare optional originalSource bytes and originalGitBlob bytes to the staged source before any copying. Hosted has 175 originalSource rows and six originalGitBlob rows; their normalized fields match the source plan. All 175 originalSource permission modes also match 0o644 by lstat-only metadata inspection. The optional originalSource comparison itself is byte-only; the importer explicitly checks permissions for the retained source and destination. Faction has no optional original equality fields because its rows point directly to the sealed originals.

Failure propagation: git() uses subprocess check=True. Validation, filesystem and Git failures exit nonzero through lines 130-132; unexpected uncaught exceptions also prevent completion. Ignore-check failures become ValueError. No success receipt is written before the complete copy/readback/index verification sequence. The script does not commit. Its newly generated receipt is not staged by the row-only git add; root must retain that metadata separately when committing.

## Plan correspondence and limits

The faction normalized plan contains all 178 source-plan importFiles with matching origin, destination, bytes, SHA-256, mode and classification, plus the final source plan and two finalization-review metadata files. Its 615 immutable references equal the source plan verbatim and identify commit 827496b06bb660b6639257e5113ac2f199be29ba. The hosted plan contains all 183 source-plan entries with matching staged source, destination, bytes, SHA-256, mode and classification, plus the import manifest and verification metadata. Its six Git-blob mappings match originGitBlob and its 175 original-source mappings match originPath. Hosted's 394 immutable references identify a144ad3f3dddd0003f9553541908e2254f2444c6. Both source-plan metadata hashes were read and matched their normalized seals.

Immutable-reference verification in lines 76-79 checks Git object identity rather than renewing full-byte hashes, and the receipt says renewedFullByteHash=false. Hosted's two external references equal the source-plan metadata verbatim: the 899,215,360-byte SQLite file has no fresh hash, and the dependency symlink is preserved externally. They are qualified references, not copied or fully authenticated payloads. This review did not read them.

The importer relies on root remaining the sole writer through its preflight, copying and staging sequence; HEAD is checked at entry rather than locked across the operation. Failure can leave copied files or staged rows for root to inspect, but cannot reach a new passing receipt before verification completes. This review establishes the source logic and normalized plan correspondence, not successful execution or independent authenticity of retained reviews.

Ordering is serial: complete row/reference preflight precedes copying, then staging, complete index verification, and receipt writing. No concurrency is introduced. Existing destination mismatches fail rather than overwrite. Observability consists of per-row verification flags and the final receipt; neither runtime feature acceptance nor admission is asserted. No importer test or failure-injection run occurred under this light-only assignment.
