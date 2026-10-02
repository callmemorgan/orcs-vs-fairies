# Static integration review: main15 native event/history audit

Approval decision: hold `main15 native event/history audit`.

## Finding

P1: the new history audit is built but never executed.

[`build-native-helpers.mjs`](/home/morgana/Projects/orcs-vs-Fairies/scripts/acceptance/build-native-helpers.mjs:23) recognizes `main-smoke` mode, and line 25 emits `fixtures.mjs`, `audit.mjs`, and `history.mjs`. [`verify-main-smoke402.mjs`](/home/morgana/Projects/orcs-vs-Fairies/scripts/acceptance/verify-main-smoke402.mjs:24) still accepts one helper argument. Its usage text names only `AUDIT_BUNDLE` at line 25, and lines 34-35 authenticate that argument as `scripts/acceptance/native-audit.ts` and use only `observeNative`. A repository search over acceptance TypeScript and JavaScript found no call to `verifyMainSmoke402Artifacts` and no consumer of `history.mjs`; the only other relevant references are the export itself and the builder entry.

As written, the browser verifier can set `evidence.completed = true` at line 94 and exit successfully without running any retained-history assertion or creating `main-smoke402-history-checks.json`. That leaves the requested event/history audit outside the executable acceptance path, so this scope cannot be approved.

The verifier needs a separate history bundle argument authenticated with:

```js
loadPinnedHelper(
  root,
  frozen.source.commit,
  historyArg,
  'scripts/acceptance/main-smoke402-history-audit.ts',
)
```

It must check that the loaded module exports `verifyMainSmoke402Artifacts`, then call it with `evidenceDir: out`, `fixturesDir: fixtures`, `manifest`, `receipt: evidence`, and `sourceCommit: frozen.source.commit`.

The call must occur after successful browser cleanup. [`main-smoke402-history-audit.ts`](/home/morgana/Projects/orcs-vs-Fairies/scripts/acceptance/main-smoke402-history-audit.ts:106) first requires the supplied receipt to equal the persisted `browser-main-smoke402.json`, then lines 112-113 require both `receipt.completed === true` and `receipt.cleanup.completed === true`. The browser verifier sets `completed` at line 94, but it does not set `cleanup` until line 105 or persist that state until line 107. Calling the history audit inside the existing `try` would fail the cleanup assertion. Calling it after the `try`/`catch`/`finally` block lets it run only after a successful browser phase and completed cleanup. Putting it unconditionally in `finally` could replace the original browser error with an audit assertion failure.

No second blocker was found in the four reviewed files on these bytes. The history module's internal checks and the composed 15-scenario fixture manifest remain consistent with the prior static review, but that does not compensate for the missing invocation.

## Reviewed inputs and limits

Root HEAD was `b65df28c73656465c5be5a02829fa68b87e24f35`. The unchanged product/build pin was `f7f3e187ea40079492589a6fce39f0b33f77f04a`.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/acceptance/main-smoke402-history-audit.ts` | 31,983 | `5f4471498a48113a135207d9195cb9cf8b4504d56f448258812bdfe16e21389f` |
| `scripts/acceptance/build-native-helpers.mjs` | 3,856 | `7ba069179c6a2e3f2c644f1a3fd3c2b05df434cb3ac70509d8c27424e7306a98` |
| `scripts/acceptance/main-smoke-fixtures.ts` | 2,129 | `13b3f0770de577f3902697006b5f8d0b73f12d279db92ef4b75add6838747188` |
| `scripts/acceptance/verify-main-smoke402.mjs` | 11,204 | `1e0758ad72de4b40eb65a725676596d77fe142f5040ed7215932bd93ee6dd40c` |

This was a bounded static review. It performed no browser, helper, TypeScript, test, build, simulation, or database execution; made no root edits; and sent no signals. It authorizes no runtime work. Reviewer: OpenAI GPT-6.1 Sol in Codex.
