# Serial-transfer and hosted-preparation trail review

Commit `1c064c46f8f775b508f03e3434e6263183db441f` is a bounded transfer record. Its eight indexed originals total 150,097 bytes; every committed copy matches the size and SHA-256 in `root-retention.json`, and all eight external originals still match the committed bytes. The records support AI839 cleanup and slot release, 14 completed co-op checks, six partial online checks followed by failure, and fresh combat authorization at f18/docs37. The combat start receipt states `nativeStagesStarted: false`, so the commit makes no runtime-success claim. The complete 493-file AI packet and 309,325,824-byte SQLite remain external as stated.

Commit `9a4921fbcb16e59d89d409f1806fb7317285648d` is bounded hosted retry preparation. Its 24 indexed originals total 477,088 bytes; every committed copy matches its recorded size, SHA-256, and regular-file mode, and all 24 external originals still match. The retained review admits one later hosted-only run at a144 and explicitly leaves clauses 63 and 64 pending. It preserves the superseded preparation, identifies six deduplicated aliases, treats supplemental 4v4 as optional, and records that the 378,163,200-byte hosted SQLite and related raw runtime files remain external. The import did not rerun their large hashes, which matches the declared stat-only boundary.

Neither commit changes a feature record, source file, test file, or product configuration. The ledger remains 69 verified and 31 in progress. Each commit appends one decision row that accurately names the retained packet, the unchanged count, and the absence of a runtime or feature promotion.

One minor evidence gap remains in the first commit. The protected-root receipt independently records PID 1063, start tick 874, and port 4173 listening. The root-retention summary additionally records port 5371 closed, but no copied raw command receipt or transcript excerpt in this packet shows that specific 5371 observation. This does not weaken the documented AI release or combat authorization/start boundary, but a later audit of the direct port check must rely on the root-authored summary.

I did not review the active combat stages, the external co-op SQLite proof, or any later runtime result.

## Attention

reviewed by gpt-5.6-sol

- Port 5371 being closed is recorded only in `root-retention.json`; the retained raw protected-root receipt shows PID 1063/start tick 874 and port 4173, but does not contain the 5371 check.
