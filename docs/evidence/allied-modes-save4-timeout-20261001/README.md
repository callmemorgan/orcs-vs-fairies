# Allied objective continuation test budget

Source commit `879a530` is based on frozen root `4e737ea58bd094de1b65792e5a0c2b228b797e87`, using SAVE4 and simulation revision 4.0.0. The two reported failures in `tests/allied-modes-binding.test.ts` are five-second test timeouts. The full-suite log reports 6,565 ms for hill and 6,087 ms for relic, without a behavior assertion or codec error. `root-red-excerpt.log` preserves both failures from the still-running root log.

The unchanged file passes all four cases in isolation. Its two continuation cases take 2,651 ms and 2,511 ms there. They each step a native state and a resumed state 430 times, validate and deep-compare both complete SAVE4 envelopes at every tick, then reproduce the final state through recorded replay. Their test runtime increases under full-suite worker contention.

The fix gives only those two cases a 20-second per-test timeout. Every fixture, public command, simulation tick, save comparison and replay assertion remains byte-identical. `causal-proof.json` records a mechanical comparison of the base and changed test body after removing the new budget and explanatory comment. No production source, codec, ledger or root checkout file changed.

`related-green.log` records 191 passing tests across allied mode binding, allied AI, allied/world composition, team saves and team replays. The hill and relic cases take 2,972 ms and 2,703 ms in that run. `unmodified-isolated.log` records the original isolated pass. These checks prove the unchanged behavior assertions succeed; they do not claim the entire root suite has completed. Root owns the final full-suite run after importing this one-file change.

Reproduce the focused related run with:

```sh
npm test -- tests/allied-modes-binding.test.ts tests/allied-ai.test.ts tests/allied-world-combined.test.ts tests/team-saves.test.ts tests/team-replays.test.ts --reporter=verbose
node docs/evidence/allied-modes-save4-timeout-20261001/verify-test-body.mjs
```
