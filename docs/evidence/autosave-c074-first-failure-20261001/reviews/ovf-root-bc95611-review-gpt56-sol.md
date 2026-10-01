# Root UI guard retention review

Accept commit `bc956114c106774ed5162f2159cf0b8c2e5b2198` as an exact retention of the fresh C074 UI preparation and scoped regression evidence. I found no retention or attribution error. Direct modes and cosmetics browser acceptance remains pending; this commit and review do not claim it passed.

The commit has parent `25fbfbd6c9a81b26bdd5c9a19908c745906a356a` and changes seventeen paths: sixteen evidence additions and an append-only three-row extension to `docs/features/decisions.tsv`. It changes no source, public asset, script, test, requirement status, or other feature-status file. The two retained reviews of root commit `6cc41a1` equal their accepted `/tmp` sources byte-for-byte.

The retention manifest lists thirteen copied artifacts. Every committed copy equals its named live source and matches the recorded byte count and SHA-256. Its external prepared-output index contains 411 files; all 411 remain under the owned assembled-rules401 worktree with the same path, byte count, and SHA-256, and there is no added or missing file in that prepared directory.

The preparation receipt records exit code 0 at source pin `c074cc5e610fc128d7b6ac894a61258d418463d4`. Its log hash matches the retained log. The prepared input manifest authenticates 585 selected source, asset, configuration, proof-script, and test files against C074 Git and the live checkout. The build manifest authenticates all 397 prepared distribution files, and the module manifest authenticates all six generated module files. Their hashes match the references in `prepare.json`. SAVE4 and simulation revision 4.0.1 are retained, and `browserRun` is false.

The adjacent regression receipt also records exit code 0 and an unchanged live-input set. Its retained log reports two passing files and fourteen passing tests. The JSON report independently contains fourteen passing assertions, seven in `competition-tools-integration.test.ts` and seven in `online-lobby.test.ts`, with no failed or pending test.

The full applicability manifest still authenticates all 918 product and prior-suite inputs against C074 Git and the live owned checkout. The worktree remains at C074 with no tracked or staged change. The retained counts remain 566 unchanged product inputs plus `src/main.ts`, and 916 unchanged prior-suite inputs plus the same file. Protected port 4173 is recorded untouched.

The parent base is also sound for this review: `25fbfbd` adds exactly the same 212 paths and bytes as accepted combat archive commit `034f0fe`. This UI commit preserves that imported archive and adds no new claim about its failed runtime result.

There is no application ordering, failure-path, observability, or stale-write change because the commit contains evidence and decision records only. The preparation and tests already completed before retention; this review did not rerun them. The direct browser guard, native autosave work, and any later runtime admission remain separate.

The machine-readable audit is `/tmp/ovf-root-bc95611-review-audit-gpt56-sol.json`. Its twenty-four checks pass, and every mismatch list is empty.
