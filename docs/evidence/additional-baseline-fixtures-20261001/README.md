Five baseline failures reproduced at `5c6a02219b723102124f9775040a78b205a52a7d` are corrected by `6567c829817f87271917f10ac58c3e9196b661f1`. The commit changes three test files and no production source. `affected-red.txt` records 115 passing and five failing tests; `affected-green.txt` records the same 120 tests passing. `corrected-tests.tsv` retains each failing name, cause and correction. TypeScript checking exits 0, with its empty output retained in `typecheck.txt`. These are targeted results; the parent's full suite stopped before completion and no full-suite pass is claimed.

The HUD test now creates a registered Veilweaver and casts its public ability. It confirms two real Fairy clones and switches the HUD viewer for the owner's true-health assertion. The original full and half-health disguise, group total, tooltip, health-bar and raw-health assertions remain. Changing the clone's side to Orcs was invalid because its Fairy definition stayed attached to it. Production ownership transfers preserve the definition faction, and those paths exclude illusions.

The allied timer tests still pause for 25 seconds, destroy the hostile barracks through public siege attacks, restart after time 25, and wait a fresh 20-second defend or three-second attack period. Only these two cases disable friendly fire through the public match rule; assertions also prove their defender stays at full health. The retained eight-case diagnostic varies threat construction and friendly fire independently. Both original and native barracks leave the defender at 100.92/175 health when the threat dies at 25.80 seconds with eight shells pending; friendly fire kills it by 28.80 seconds, and the AI correctly waits for available troops. With friendly fire disabled, both constructions resume at 26.05 seconds and complete at 47.05 or 29.05 seconds. Native spawning alone does not fix the failure.

The roster still runs 400 quarter-second ticks, or 100 simulated seconds, with all economy assertions intact. The original 4v4 run needed 40.37 seconds of wall time and failed its 30-second allowance. Its test allowance is now 90 seconds. The markup fixture now supplies a hashed imported faction through `setContent`; the immutable registry does not read later mutations of exported base definitions. It asserts the literal name, selects that faction, and confirms that no image or script elements were created.

`source-sha256.txt` identifies 168 committed production, affected test and build-configuration files at the fixture commit. The eight-case diagnostic is retained as text because it is a scratch attribution probe, separate from the 120 affected tests. Its reproducer reads the original source directly from Git into a temporary directory, adds the unchanged diagnostic and uses the installed dependencies. It does not change the checkout. Console logs retain their recorded output, with trailing blank lines removed.

From the repository root:

```sh
node_modules/.bin/vitest run tests/hud-health.test.ts tests/allied-ai.test.ts tests/skirmish-roster.test.ts --testTimeout=30000 --maxWorkers=2
node_modules/.bin/tsc --noEmit
python3 docs/evidence/additional-baseline-fixtures-20261001/reproduce-emergency-attribution.py
sha256sum -c docs/evidence/additional-baseline-fixtures-20261001/source-sha256.txt
```

The hashes and retained runs describe the pre-SAVE4 source. Final assembled validation, browser proof and CLI proof belong to the parent. The parent owns the canonical decision log and feature ledger; this workstream sends facts without editing either file.

GPT-5.6 Sol independently admitted both commits with no findings. Its report is `independent-review.md`; retained runs reproduce the same five failures with 115/120 passing on the detached baseline, then pass 120/120 on the evidence tip and all eight attribution variants. Source and evidence hash checks also pass. `committed-verification.json` checks the original 19 evidence blobs at `ae4f612`; the final evidence hash file covers the retained review records and normalized log endings. The final assembled SAVE4 source still needs the parent's validation.
