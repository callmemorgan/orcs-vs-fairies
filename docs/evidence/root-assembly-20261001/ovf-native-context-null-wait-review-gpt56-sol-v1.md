# Native replay-mode wait correction review

GPT-5.6 Sol accepts the proposed one-expression proof-runner correction for a fresh retry. It changes `window.rts.mode==='replay'` to `window.rts?.mode==='replay'` in `scripts/acceptance/native-context.mjs:93`. No game source changes.

The first retained browser run fails in `page.waitForFunction` after six checks and ten downloads with `Cannot read properties of null (reading 'mode')`. The stack points to the reviewed expression. The application replacement path clears `scene` before launching the replay scene, and the public `window.rts` getter returns null until the new scene has a camera. The successful `Replay loaded.` notice can therefore precede a non-null observation.

The proposed file equals the `c86e273` Git blob with one replacement and no other byte change. Its SHA-256 is `30a272340d4283cc8baedaf20d147f3aa80630f8c213fb383b3e082f6096c3b5`; the patch SHA-256 is `a4ae2c7966d971afbe8adea3056d35f803e208468e82a705bc6d207bfd34fa56`. The frozen writer still matches Git at SHA-256 `bac722da055afd9e69dae6c1b9bb92ab41afa48f372efaed69fc7df1816bbec5`.

The optional chain changes only the transient-null failure path. While `window.rts` is null the predicate returns false, so the existing 60-second wait continues. Success still requires strict `mode === 'replay'`. The following `ready()` check still requires a camera, canvas, and loaded art. The End-key seek, final-tick wait, and complete persisted endpoint comparison are unchanged. Ordering, logs, downloads, and shared writes are unchanged. A permanently absent or wrong-mode scene still fails through the existing timeout.

The corrected named-file `node --check` receipt exits zero against the proposed SHA. The earlier stdin syntax invocation remains preserved as an invocation error. The fresh browser retry is still required; this review admits only the source correction.

The independent audit is `/tmp/ovf-native-context-null-wait-audit.json`. No finding remains.
