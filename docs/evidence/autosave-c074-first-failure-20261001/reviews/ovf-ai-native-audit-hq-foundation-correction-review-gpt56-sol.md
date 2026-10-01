# AI native-audit HQ foundation correction review

Accept the proposed audit-only correction. The failed R2 assertion is broader than the frozen game rule: it treats every living HQ foundation as survival, while standard defeat counts only living HQs with `progress === 1`. Adding that completion condition and changing the message to “Losing completed HQ” aligns the audit with the product rule. I found no other change in the proposal.

The diagnosis and patch hashes match the supplied values: `1509b55bfe5e5a6fd2e2546464c2e36e1225ddcd71f4895bdf5bc0ea933485bb` and `fa93f48e044326b190ff281be44255f063da0ef5e47c808f1ce5b608e3fbfb0a`. The current R2 audit also retains its admitted hash, `59a080b7ea7c5372fbdf4068a246e67b6dc9ea075d07db509390f4b0a71b7361`.

The live `src/core/simulation.ts` equals Git at `c86e273c70738f144a00fe75f5ecf39e7fa324d8` and has SHA-256 `e301c65d0352ffe648a5bc4ee6acbda1f562164deacdfe60f8f3b03e7bdccf35`. At that pin, `alive(e)` means `e.hp > 0`, and line 491 considers an HQ surviving only when it is alive and `progress === 1`. The proposed audit predicate uses the same two conditions for a losing side.

The affected native file has SHA-256 `57dfb3e4a6fabe3c3c32e12a022b6b8f3507c1e6d1e551bfaf92d082482a03d9`. It records winner 1 at tick 7962 with `eliminated` equal to `[true, false]`. Side 0's completed HQ is dead. Its remaining HQ, entity 136, has HP `454.84443181817494` and progress `0.9490909090908873`, so it is an unfinished foundation and does not prevent elimination under the game rule.

I parsed all 108 retained reports and native saves for this predicate only. The old audit predicate rejects exactly this one outcome. The corrected predicate rejects none. The proposed patch has one removed line and one added line; reconstructing the proposed audit changes only that line, producing SHA-256 `5d1b9ff25dcae322675e68078ed95a714a206b4425b9c62504f6b30d2982cb54`.

The failed envelope remains correctly failed with exit code 1 and the old assertion message. I did not run the corrected audit, a build, a test, or a simulation. Acceptance of the correction does not admit a corrected audit result; that still requires its own successful retained envelope.

The machine-readable review is `/tmp/ovf-ai-native-audit-hq-foundation-correction-review-audit-gpt56-sol.json`. Its seventeen checks pass with no findings.
