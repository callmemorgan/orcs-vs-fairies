# Focused remaining combat preparation r1 review

R1 is not ready for execution. It adds the intended three-case scope without changing the case bodies, but the new keyboard pause path can be blocked by Tactics focus, and receipt validation can skip the declared canonical scope when its payload is null. A third issue allows duplicate canonical scopes into the browser runner. These findings apply to preserved r1 only; later revisions are reviewed separately.

The base is committed `7e80356c9564151749a7753971fba13eec349509`. The candidate has no Git commit and no execution pin. Its identity is the three candidate byte hashes below. All three baseline files matched actual immutable Git blobs. I reconstructed the packet's exact patch in memory and obtained each candidate byte-for-byte. No patch was applied.

## Findings (risk)

1. The new setPaused helper at `canonical-main-smoke.mjs:127–130` closes only SessionTools before sending KeyP. Its changed hunk is `@@ -115,9 +116,24 @@`. The retained siege body at lines76–77 clicks Capture siege engine and immediately waits for the partial capture channel. Focus is on that Tactics panel button when runUntil needs to pause. At immutable base `src/ui/TacticsTools.ts:103`, the Tactics host stops every keydown from bubbling; `src/game/GameScene.ts:159` registers the game handler on window, so the new KeyP never reaches it. The same sequence follows the Set ambush button at canonical lines88–89. Tactics does not implement a pause shortcut itself; main 378 supplies no keyFor callback. The resulting wait at helper line129 times out instead of pausing. This is a static event-propagation conclusion, not an executed failure. Close the panel through existing public controls or put focus outside its host before sending KeyP.

2. The changed history auditor hunk `@@ -113,13 +114,15 @@`, candidate lines121–126, gates validation on payload truthiness. The same new guard is used for continuation/export validation in `@@ -208,15 +211,15 @@` and the three causal histories in `@@ -272,7 +275,8 @@`. A declared selectedGroups=['remaining-combat'] and groups['remaining-combat']=null has the expected exact group key yet skips these blocks. The prior canonical check was gated by selectedGroups and failed on an absent/null payload. Gate every relevant block by selected canonical scope, then validate the payload. This malformed-input path was reasoned from source only; no receipt was fabricated or auditor invoked.

3. The runner hunk `@@ -33,7 +33,7 @@`, candidate lines36–38, admits canonical and remaining-combat together because the strings are unique and both are known. The two runners reuse siege/ambush/morale filenames, so a later freshArtifact/write fails after redundant browser work. The auditor already rejects this combination at line118. Mirror that scope guard before browser launch.

## Retained behavior and limits

The remaining three browser case bodies are byte-identical to base: 13,954 bytes, SHA-256 `c8f7b20d2259d6aedd6824056a4fdd54bb64a958de8f1cea822349f45682f8d4`. Their three history causal bodies are also byte-identical: 9,907 bytes, SHA-256 `868850875662ea8dc6e61a0ac7af509999876fa624c2551f297ae7a0f4482748`. Formation and charge browser loops are skipped when remainingOnly is true, and their history observations stay behind selected canonical. The three remaining cases still run serially in siege, ambush, morale order. Scope selection must explicitly pass remaining-combat because the browser default remains canonical,ruins.

The candidate introduces no product/game-state assignment. The pause overlay is a plain section, so it does not itself suppress KeyP. SessionTools closure removes its modal and restores earlier focus. The focus blocker above comes from the separate Tactics host, rather than the pause overlay.

No runtime, imports, syntax checks, tests, builds, browser actions, simulation, replay, DB, server, signals, delegates, root/owned/Git/ledger writes or protected-preview operation occurred. Only these review reports are written beneath a fresh review directory. The original assertions are retained; this preparation contains no new test evidence.

| Candidate file | Bytes | SHA-256 |
|---|---:|---|
| `scripts/acceptance/canonical-main-smoke.mjs` | 26403 | `fc2a094f8441b3eb188a5aa6a3ac5c53c5ed75c7852e9076f8a9c3aeea6d97e9` |
| `scripts/acceptance/verify-main-smoke402.mjs` | 11309 | `19176a181be64618bb44496fa3c57a689666b667668a2bd28da62bbb26502b25` |
| `scripts/acceptance/main-smoke402-history-audit.ts` | 32361 | `cc288a0882d9d742a003a0d1088deb3090645d8021c86776ab0ab3fad6e17dc0` |

Preserved r1 patch SHA-256 `e1983c1aa374c176abab2604776af6b261925b8000544458cae03df19c97cee6`; source-seals SHA-256 `f7bb1a5d042b933bd0105391ca62501c45438f560d467e2bc5430640e9fab4f3`. R1 files are under `/tmp/ovf-remaining-combat-preparation-7e-20261001-hcjileau/draft-r1`.
