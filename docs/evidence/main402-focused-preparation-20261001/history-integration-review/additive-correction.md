# Additive correction: main15 native event/history audit

This correction preserves [`static-integration-review.md`](/tmp/ovf-main402-history-integration-review-sMkVDKtJ/static-integration-review.md), SHA-256 `37b05d06e12f28da5be9a0323009e61429a80f77d6fc2acc78e63da5edc54b71`, and withdraws its call-site blocker after review of the separately staged supervisor and bridge.

Approval decision: approve the scope `main15 native event/history audit` for the exact source and staged integration bytes listed below. This is static approval only. It does not authorize or report runtime execution.

The original finding treated `verify-main-smoke402.mjs` as the owner of the history call. The combined recipe assigns that call to the supervisor after the browser process exits. [`main15-bounded.v4.py`](/tmp/ovf-main15-bounded-preparation-f7-kyew2suh/main15-bounded.v4.py:250) runs the browser verifier with the observation helper. Line 251 then reads the persisted browser receipt and requires both `completed === true` and `cleanup.completed === true`. Lines 255-258 recheck the frozen helper and fixture outputs, the retained review bytes, the bridge bytes, and the source/build invariants before history verification begins.

Lines 259-267 run `invoke-focused-history-audit.v2.mjs` as a separate phase with `helpers/history.mjs`. The phase receives a 300-second bound, requires the history result file, checks its source commit and complete save/runtime flag, binds its completed-receipt hash to the browser receipt, and only then records `main15HistoryCompleted`. The supervisor's `phase` function at lines 126-139 enforces the bound, stops the owned process on timeout, and rejects a nonzero exit without retry.

[`invoke-focused-history-audit.v2.mjs`](/tmp/ovf-main15-bounded-preparation-f7-kyew2suh/invoke-focused-history-audit.v2.mjs:8) imports the committed provenance and digest functions through the supplied root. Line 10 loads the third bundle through `loadPinnedHelper` at the admitted pin and requires the entry `scripts/acceptance/main-smoke402-history-audit.ts`. Lines 11-15 require the expected export and completed browser cleanup before calling `verifyMainSmoke402Artifacts` with the original manifest, receipt, evidence directory, fixture directory, and source pin. Lines 16-24 compare the `wx` result file to the returned value, require complete original save/runtime verification, and retain the helper provenance, counts, output size, and output hash in another `wx` file.

This ordering matches the audit contract. [`main-smoke402-history-audit.ts`](/home/morgana/Projects/orcs-vs-Fairies/scripts/acceptance/main-smoke402-history-audit.ts:106) binds the supplied receipt to the persisted browser receipt, and lines 112-113 require browser and cleanup completion. The browser wrapper should not invoke this audit before its own `finally` block. The staged supervisor provides the required post-cleanup call and failure propagation.

No concrete blocker remains in the reviewed event/history audit integration. The approval applies to these exact bytes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/acceptance/main-smoke402-history-audit.ts` | 31,983 | `5f4471498a48113a135207d9195cb9cf8b4504d56f448258812bdfe16e21389f` |
| `scripts/acceptance/build-native-helpers.mjs` | 3,856 | `7ba069179c6a2e3f2c644f1a3fd3c2b05df434cb3ac70509d8c27424e7306a98` |
| `scripts/acceptance/main-smoke-fixtures.ts` | 2,129 | `13b3f0770de577f3902697006b5f8d0b73f12d279db92ef4b75add6838747188` |
| `scripts/acceptance/verify-main-smoke402.mjs` | 11,204 | `1e0758ad72de4b40eb65a725676596d77fe142f5040ed7215932bd93ee6dd40c` |
| `main15-bounded.v4.py` | 25,439 | `934ee65ef3de116274d4cdef9a709262496d194aa550c27c06171c7f2a0736fb` |
| `invoke-focused-history-audit.v2.mjs` | 2,281 | `f2057fd8f45c026248b33bb22d72183c0f2aae21f3d5dad7c1171ae5e1482aa7` |
| `main15-static-recipe.v4.md` | 10,492 | `a4a2ee864dedf0f1e14a453b83929504429f4a0d473655de8ebbb85b2b871298` |

The scripts remain uncommitted at root HEAD `b65df28c73656465c5be5a02829fa68b87e24f35`, and the preparation packet has `integrationPin: null`. Before execution, the machine-readable history review required by supervisor lines 171-173 must bind this approval to the new commit containing these same bytes. Any source or staged-driver hash change requires another review. The tested product/build pin remains `f7f3e187ea40079492589a6fce39f0b33f77f04a`.

This correction used static reads only. It performed no browser, helper, Node, TypeScript, test, build, simulation, server, or database execution; made no root edits; and sent no signals. Reviewer: OpenAI GPT-6.1 Sol in Codex.
