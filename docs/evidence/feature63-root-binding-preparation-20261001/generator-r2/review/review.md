# Static r2 correction review

The r2 correction passes with no findings. I did not run or import either generator, call their functions, execute a candidate, build, test, open a browser, read SQLite, or send signals. I parsed the new source as Python AST and used file, JSON, stat, hash and line-comparison helpers.

The source delta is one line. R1 required both the tested build ID and the literal text `__OVF_BUILD_ID__` in the authenticated built chunk. R2 still requires the tested ID and removes the literal-name conjunct. No other source line changed. `minimal-r2.diff` represents this replacement.

The change matches the build mechanism. `vite.config.ts:6` defines `__OVF_BUILD_ID__` as the JSON-encoded SHA256 digest, so Vite replaces the identifier during compilation. The authenticated `assets/main-3vb5PXT5.js` is 2,455,409 bytes with SHA256 `af386aa4c80682f388c4b5093c4e3f7a65098a50ca2fdfd90acd0e52f2241956`. It contains build ID `9c5d2f1ff26bd6849b1ad5e311300669fb5f02feebbe4d311b6f8d670df243e1` and does not contain the identifier name. Requiring the identifier in transformed output caused the preserved r1 failure.

The correction removes that false check without weakening the tested-build binding. The tested manifest still authenticates the expected build ID and original web inventory. The generator still compares the complete original and packaged web filename, byte, hash and numeric-mode inventories, and it still reads the embedded chunk through the authenticated manifest path before checking the tested ID. Source, build script, server, dependency, review, schema and assignment checks are unchanged.

The original generator remains at SHA256 `5d2005b7a8e08827c5a8a34672a51ab72c53f1aa45e156a5c41e56256b9504b1`. The new generator is 27,181 bytes with SHA256 `2e1d74eb6a731691528aa4e5df533d0af6e0c863187ba5845d3e614eb9500e99`. The pending parameter specimen is byte-identical to r1 and remains unapproved.

The correction receipt matches the new files and the preserved failure artifacts. The r1 stderr records `Embedded original tested build ID absent` at the removed conjunct, stdout is empty, and `/tmp/ovf-root-feature63-bindings-ct22qvla/bindings` remains absent. The README and decision trail describe diagnosis, the one-line correction, preserved artifacts and the fact that r2 has not run.

This review adds no gate or runtime authority. Root must supply a new parameter file and digest, run the generator separately, inspect its actual outputs, and create a new capture assignment anchor before any capture decision. The requested reviewer model was `gpt-5.6-sol`; provider identity was not independently authenticated.
