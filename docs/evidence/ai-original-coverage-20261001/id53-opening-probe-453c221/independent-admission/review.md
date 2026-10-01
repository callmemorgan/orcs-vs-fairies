# Original requirement 53 runtime evidence review

Pass. The retained evidence is sufficient for the original requirement, "opponents use recognizable builds with exploitable weaknesses." It proves two recognizable opening builds and shows that the fast-expansion opening delays its first paid fighter by 500 ticks, or 25 seconds, under the same ordinary paid infantry pressure. I recommend admitting the receipt as requirement 53 evidence and marking the original requirement complete within this scope.

## Review scope

I reviewed files and Git objects only. I did not run a build, simulation, game, browser, server, TypeScript module, or native verifier, and I did not change the repository. The reviewed runtime is frozen at product commit `453c2218af9973b9eca8fb78392435bd9d46a740`. The requested current root was `202b739fb398d1f94fd2c53f659e10860eba3fc6`; the shared checkout advanced during review to `37bf0e794e7f62cf33347d2e92c739d593bf1cc4`.

The product applicability check compared every file in the build manifest at all three commits. All 170 `src/` and public/config files have the same Git blob, byte count, and SHA-256 at the product pin, requested root, and live root. The file set is also the same. Requirement 53 has the same text, `in-progress` status, and empty evidence array at each root.

## Artifact integrity

The master inventory contains 44 files and 13,929,699 bytes: 18 source and execution records, five build files, and 21 result files. I rehashed every entry and found no missing, extra, duplicate, or changed file across the three retained directories. The final receipt hash is `b2e110667230bfb6c37806581f3259dedd15e3bdb1e30c2c704eb01e19afe547`, which matches the supplied hash.

The nested inventories also agree with the retained bytes. The final receipt authenticates its 20 prior result files, the driver receipt authenticates its 16 prior files, and each arm receipt authenticates its six pre-verification files. The build helper digest, both bundles, both metafiles, and every listed bundle input match their recorded hashes. The driver metafile has the same 51 inputs as its manifest entry, and the validator metafile has the same 50 inputs as its entry. Runtime provenance in the driver receipt and both endpoint verification receipts agrees with the retained build manifest.

Each endpoint verification receipt has status `passed` and authenticates two session files: the endpoint and the checkpoint immediately after the first accepted worker attack command. All four entries record equality for the complete decoded session, resaved envelope, replay envelope, analysis, and technology timings. Their ticks agree with the corresponding session game state and replay final tick. Both receipts say `not-run; no survival gate` for continuation.

## Recognizable openings

An independent recursive comparison of the two complete initial SAVE4 envelopes found one difference:

| Path | Infantry control | Depot-first pressure |
| --- | --- | --- |
| `$.state.aiConfigs[1].opening` | `infantry-rush` | `fast-expansion` |

The retained opening descriptions are concrete. Infantry rush says, "Barracks first, then an early infantry attack," with the weakness, "The first attack leaves few defenders at home." Fast expansion says, "Depot first, more workers, then an observed outer resource base," with the weakness, "Extra workers and buildings delay the first army."

The raw spend and production logs show the expected opening shapes:

| Recorded event | Infantry control | Depot-first pressure |
| --- | ---: | ---: |
| First paid building | Barracks, tick 1 | Depot, tick 1 |
| Barracks foundation | Tick 1 | Tick 501 |
| Barracks complete | Tick 718 | Tick 1203 |
| First paid combat queue | Tick 721 | Tick 1221 |
| First paid fighter | Tick 1521 | Tick 2021 |
| First qualifying worker hit | Tick 1421 | Tick 1390 |
| Qualifying worker hits retained | 13 | 18 |
| Stop | Tick 1761, nonterminal | Tick 2261, nonterminal |

This is enough to recognize the builds from runtime behavior. The infantry arm opens with its barracks. The expansion arm spends first on a depot and starts its barracks 500 ticks later.

## Exploitable weakness

Both arms received the same pressure policy. Each accepted three melee train commands at tick 180 from the observed barracks. Every command debited 70 wood and 25 ore, and the first paid melee completed at tick 901 in both arms.

The fast-expansion barracks foundation was 500 ticks later, its combat queue began 500 ticks later, and its first paid fighter completed 500 ticks later. Queue-to-fighter production took 800 ticks in both arms, so the fighter difference follows the earlier opening schedule rather than a different production duration. Barracks completion differed by 485 ticks, and each arm had its foundation, completion, and first combat queue recorded before the first qualifying worker hit.

The ordinary paid attacker reached an observed worker at tick 1390 in the expansion arm, 631 ticks before the first paid defender fighter completed. In the control arm, the first qualifying worker hit was 100 ticks before its first paid fighter. Every qualifying record links the attack event to a paid attacker completion, the accepted attack command, an enemy worker present in that command's observation, and a resolved hit-point loss or death. This demonstrates that the delayed military timing can be exploited through worker harassment.

The causal claim remains narrow. The comparison measures the opening under fixed ordinary pressure. Later harassment may add delay, and the evidence does not include an unpressured baseline. The pre-hit foundation, completion, and queue records establish the early build-order delay before harassment could cause it.

## Public command policy

I checked all 30 infantry-control command records and all 38 depot-first command records. Every command actor ID exists as an owned entity in the saved observation taken before that command. Build and gather actors are observed owned workers. Gather targets are observed visible resources with stock remaining. Attack targets are observed enemy workers. Train producers are observed owned buildings, and every accepted train has the expected bank debit and queue addition. Rejected build attempts do not change the bank. Attack-move coordinates equal the public opponent start in the observation.

The retained driver source uses one persistent `PlayerView(0)`. Its command wrapper observes before calling `issueCommand`, then records the post-command observation. Policy choices for actors, bank availability, queues, resources, and worker targets come from those observations. The opponent start is used only for attack-move scouting guidance. The source has one `issueCommand` call, one `stepGame` call, and no direct assignment to the game state after recorder creation. Full state snapshots feed the read-only payment and hit auditor after the policy decision.

## Execution result and limits

The final receipt status is `passed`, runtime exit is zero, and its error list is empty. The supervisor records three successful processes, no deadline, no remaining owned runnable process group, and about 4.293 seconds of native wall time. Both arms stopped after their 12-second response windows and remained nonterminal.

No full-match victory, endpoint continuation, or survival result was run or claimed. Those are not required by the original clause, and this review does not infer them.

The machine-readable audit is `/tmp/ovf-id53-runtime-453c221-review-audit-gpt6-sol.json`. Its deterministic checker is `/tmp/orcs_id53_file_audit.py`. The checker reports 29 passed checks and zero failures.
