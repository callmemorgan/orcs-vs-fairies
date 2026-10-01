# Root SAVE4 narrow fixture review

Verdict: no findings. Admit `879a5305194e5eab67f2f0d5017150f58f2d9431`, `08ac3ae6354327095189058e4db66f8bd7c8f5ed`, `b37bf4916a2a435da77dab982f08ddb2b1ab8006`, `cc2d0b514301be4903ed262ca8a58b597c45e2c1`, and allied evidence `51ac214358b52659f54dc9233c00cdaceec3555e` onto frozen root `4e737ea58bd094de1b65792e5a0c2b228b797e87`. Apply `b37bf49` before its child `cc2d0b5`; apply `879a530` before its evidence child `51ac214`.

I reviewed these commits with GPT-5.6 Sol. None changes production source, scripts, dependencies, build configuration, or the requirement ledger.

`879a530` adds a 20-second budget only to the two hill and relic continuation cases. The frozen full-suite log records timeout-only failures after 6,565 ms and 6,087 ms against the former five-second budget. Removing the comment and timeout argument makes the changed test file byte-identical to the frozen root version. The retained evidence at `51ac214` reports the unchanged cases passing alone in 2,651 ms and 2,511 ms, then 191 related tests passing with the patched cases taking 2,972 ms and 2,703 ms. I independently verified the six evidence hashes and reran its byte-comparison script.

`08ac3ae` adds the same 20-second budget only to the den checkpoint case. The frozen root log records a timeout after 5,753 ms and no behavioral assertion failure. Removing the timeout argument makes the changed file byte-identical to the frozen root version.

`b37bf49` adds four tests and no implementation. The mining pair uses paid public construction and specialization commands, a finite ore node, identical specialized and control paths, actual deposit events, worker cargo, bank and ledger accounting, complete SAVE4 continuation, native session decoding, and replay equality. It also proves that a resource path outside the specialized region remains equal to its control.

The military pair builds an expansion and two matching barracks through public commands. It checks exact construction and training payments, paid-cost records, the 1.3 production multiplier, earlier specialized completion, identical resumed state, full replay equality, disabled definitions, draft picks, foreign ownership, and rejected-command immutability. A retained focused run at `/tmp/settlement-runtime-gap-final.log` passes these four cases with the existing economy integration file, 24 of 24, and `/tmp/settlement-runtime-gap-final-types.log` records a successful no-output TypeScript check.

`cc2d0b5` changes two reference-identity assertions to `toStrictEqual`. The pinned content registry creates immutable copies, so identity is not part of the contract. Structural comparison keeps every definition field, missing-field distinction, size-sensitive placement assertion, paid siege cost, salvage amount, and continuation assertion. The frozen root failure reports identical serialization and recommends deep equality; the retained 24-test run passes the corrected case.

Ordering: production command and tick order is unchanged. The two timeout commits only extend test runner budgets. The new runtime tests execute commands and ticks serially and compare the resumed state at fixed checkpoints.

Failure paths: no production branch changes. The new tests assert foreign, disabled, unpicked, repeated-specialization, and pre-draft commands reject without changing the complete save.

Observability: no production log or telemetry changes. Evidence adds test output and causal records only.

Stale writes: no production writes change. The tests compare complete saves after rejected commands and compare original, resumed, and replayed states after accepted work.

Test delta: each behavior change here is a fixture or assertion correction. Root owns the in-progress combined rerun; this review does not claim its final result.
