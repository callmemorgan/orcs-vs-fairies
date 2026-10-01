# Faction proof import

The immutable packet imports the seven paths listed in `seven-files.txt` from source `906e0bd25577a9d99473c88cc50e71700235754a`, preserving recipe `0bd7d51476cd855505b91ce76b232795afae867f`. Its inspected root target is `8b96f5197adf5b4ddfa160c2fe5a550afdf7e9d8`; all 568 product inputs equal freeze `453c2218af9973b9eca8fb78392435bd9d46a740`.

The import manifest is a static preparation record. Candidate tree `db3dd3fc2b91431025fb444f7b1d0eee457e30bc` is a tree preview. Neither is an execution pin. Original recipe wording naming `c86e273c70738f144a00fe75f5ecf39e7fa324d8` stays unchanged; the import manifest records current applicability.

## Current reviewed amendment

The separate owned repair commit is `881dff253f0392c0e539efe21af744ed2a57b214`, parent `906e0bd25577a9d99473c88cc50e71700235754a`. It changes only the faction browser driver. The supplemental producer verified the current clean root at `e976502f25df468b3edf1298fed887de78cd4730`; its changes since the original target are evidence documents and the decision trail. Product files, all seven import bases and the three retained helpers are unchanged.

The amended tree preview for this current root is `0ba9d13ae4c7de9819cec4150e5085e0daf6752d`. Repair patch SHA-256 is `47345ada98dd11f434324dd29fa4729b6973d32cb789bb01247694bdc4a25023`; supplemental manifest SHA-256 is `0d571459c1dd5adaf75391a4171bdb8de9a739983310073948667184d785a152`. The original immutable packet and its hashes remain unchanged.

## Root actions

Confirm the current root has the inspected product and proof identities before importing. If root HEAD has advanced, compare the product inputs and the retained helper files against the recorded target before adapting the import. Root alone owns these mutations.

Restore exactly the seven paths from the original source, using this command from the root checkout:

```sh
git restore --source=906e0bd25577a9d99473c88cc50e71700235754a --staged --worktree -- \
  docs/features/FACTION_FINAL_VERIFICATION.md \
  scripts/acceptance/audit-faction-powers.ts \
  scripts/acceptance/faction-powers-fixtures.ts \
  scripts/acceptance/faction-powers.mjs \
  scripts/acceptance/native-audit.ts \
  scripts/acceptance/native-fixtures.ts \
  scripts/acceptance/verify-native-acceptance.mjs
```

Inspect the staged path list, modes, blobs and hashes against `import-manifest.json`. The original seven paths must match the immutable recipe before applying the separate amendment.

Apply `replay-wait-null-guard.patch` as a separately reviewed amendment, then stage its single file. The amendment changes only `window.rts.mode` to `window.rts?.mode` in the faction-local hostile replay import wait. It preserves the timeout, the following readiness wait, and all tick, perspective, concealment and replay assertions. Six imported files remain byte-identical to the recipe; only the browser faction driver has this one-character amendment. `replay-wait-null-guard-manifest.json` records the source and amended candidate identities.

Check that the complete staged diff still contains exactly the seven import paths. Preserve all 568 product paths and the root versions of `direction-defense-fixtures.ts`, `direction-defense.mjs` and `native-context.mjs`. Do not cherry-pick the whole isolated source commit or restore common helpers from it; that would replace root's approved grazing-rock lane, visible-pointer repair or null-safe replay wait.

Create the real integrated proof commit with the required Codex/GPT-6 footer, then report its full commit ID. Later build, fixture, freeze, browser, checkpoint and replay verification wrappers must receive that new integrated HEAD. Do not use the recipe, isolated source, preview tree or product freeze as the integrated execution pin.

Runtime remains held until root assigns the heavy slot. This packet makes no claim that IDs 21–30 passed current native execution. Existing default groups remain `direction,capture,specialists`; faction execution is selected explicitly.

## Attribution and preparation limits

Prepared in Codex by GPT-6 (`noreply@openai.com`). Git object/live-byte inspection, scratch indexes and syntax parsing only. No build, simulation, test suite, fixture generation, browser, server or dependency installation. Root worktree/index, ledger, decision trail, port 4173 and dist were untouched by this preparer.
