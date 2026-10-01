# Combat proof preparation evidence review

I reviewed evidence commit `a764273203de6c4e7478d783c8e4d3966384ded1` over parent `3f963008a3ce79e4615a8ca115954f9f4ce077ab` with GPT-5.6 Sol. The commit is admitted with no findings. It changes only `docs/evidence/combat-proof-runner-20261001/`; it does not change production source, tests, scripts, or configuration.

The committed verifier passed against the evidence commit with bytecode generation disabled:

```text
{"archiveFiles": 164, "retainedCopies": 154, "runnerCases": 15, "projectionCases": 27, "sourceProvenanceVerified": true}
```

I separately checked the archive rather than relying on that verifier. `artifact-hashes.sha256` has 163 unique entries and the archive has 164 files including the hash list. Every listed digest matches. `retained-paths.json` has 154 unique retained paths and 154 unique original paths. All 154 original files still exist, and each original and retained copy has the recorded byte count and SHA-256.

The retained runner equals `0644aa7e2a3ca891cf3a3f65a198b838a9ab6154:scripts/verify_combined_combat.mjs` byte for byte. Its SHA-256 is `6919e61c36a86ab2ee0efb2f110a9c5078d0bc2a2ef432d6aa037b3e76ad180a`. The runner receipt binds 48 producer inputs to either the pinned `5cba15c8f4113af57dde2f1f05c3fa82f42bce3d` Git blob or the retained producer source. Its build and run both exited zero. The retained fault report records 15 completed contract checks.

The projection receipt binds 47 producer inputs to `3f963008a3ce79e4615a8ca115954f9f4ce077ab` or the retained producer source and binds five generated outputs. All seven recorded build, generation, projection, and fault commands exited zero. The retained fault result contains 27 records, all passing.

Both retained `projection.json` files assert complete native round trip, equality after unprojected native replay, complete game-envelope equality after changing only controller zero from human to external, complete checkpoint round trip, checkpoint replay equality, and complete continuation-envelope equality. All seven retained `proof-source.ts` files equal `3f96300:scripts/prepare_combat_cli_projection.ts`. All seven source manifests contain the correct source pin, SHA-256, and Git blob ID for each of their 1,127 total entries.

I ran `reproduce-projection.py` into a new directory at `/tmp/ovf-combat-projection-parent.c195QE/reproduction`. It created an isolated archive checkout, verified producer inputs before generation, and completed all seven commands with exit zero. Its 27 fault cases passed. The regenerated final, pending, coalesced-pending, original, and projected session files equal the retained archive files byte for byte. The parent checkout stayed at `a764273203de6c4e7478d783c8e4d3966384ded1`, and its tracked status hash remained the empty-status SHA-256 before and after.

This commit proves the portable preparation helpers and their retained SAVE4 runner and SAVE3 projection cases. It does not prove the final frozen SAVE4 browser run, packaged CLI run, or the remaining native UI acceptance cases listed in the README. Those final runs remain with root assembly.
