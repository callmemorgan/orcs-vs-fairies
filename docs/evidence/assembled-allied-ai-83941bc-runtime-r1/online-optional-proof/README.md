# Optional `heroRecovery` comparison candidate

This directory contains an external verifier candidate for the first failure in the single 839 online attempt. It does not change the owned checkout or product source. It contains no browser, server, build, simulation, database, codec, or retry result.

The preserved attempt stopped at `scripts/verify_assembled_online.mjs:100`. Its stderr records a private player 0 object whose displayed fields equal the authorized server player, except the rendered object has an own `heroRecovery` key with value `undefined` and the parsed server object omits that key. The preserved `results.json` contains six checks, `completed: false`, and the same first failure. The source files remain at their original paths with SHA-256 values recorded in `provenance.json`.

## Cause

At commit `83941bc80ce9ec08840b0645d9b33e8018d5309a`, [`Player.heroRecovery`](/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/src/core/types.ts:36) is optional. [`PlayerView.observe()`](/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/src/core/observation.ts:71) constructs the server observation with a `heroRecovery` property whose value is `undefined` when no recovery exists. The server sends snapshots through [`JSON.stringify(message)`](/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/src/server/server.ts:139), and JSON object serialization omits properties valued `undefined`. The client reconstructs the wire object with [`JSON.parse(raw)`](/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/src/online/client.ts:162), so the received player has no `heroRecovery` key. The renderer's [`ownPlayer()`](/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies/src/online/render-state.ts:42) constructs that key again with value `undefined`. Node's strict deep comparison distinguishes an absent key from an own key valued `undefined`.

## Candidate

[`candidate/verify_assembled_online.mjs`](candidate/verify_assembled_online.mjs) is the complete verifier copied from the 839 Git blob. The patch shallow-copies only a private rendered player. It deletes only `heroRecovery` when its value is `undefined`, then applies the original strict deep equality to that copy and the authorized server player.

Defined `heroRecovery` remains in the copy and must match. `null` remains in the copy and must match. Every other key, including any other key valued `undefined`, remains subject to the strict comparison. The candidate does not mutate the renderer object and does not serialize, recursively normalize, pick a general field list, or weaken entity, state, save, replay, resource, terrain, visibility, receipt, privacy, or browser assertions.

The minimal patch is [`patch/private-player-optional-hero-recovery.patch`](patch/private-player-optional-hero-recovery.patch). The source and candidate each contain 91 `assert` tokens and 17 `assert.deepEqual` tokens. Qualification proves that applying the one recorded source replacement produces the complete candidate byte for byte.

## Qualification and limits

`node qualification/qualify.mjs` passed 11 pure Node cases. The fixture uses the values printed in the preserved assertion diagnostic. It accepts the absent-versus-undefined `heroRecovery` case and an equal defined recovery. It rejects a defined recovery against an omitted key, changed recovery contents, `null` against omission, another private-field change, another undefined key, another defined key, and a missing ordinary key. The script imports only Node built-ins and reads the two external verifier files; it does not import product code.

This qualification establishes only the comparison's narrow behavior and that all other verifier bytes are unchanged. The browser candidate has not run. The second player comparison on line 177 and every later check remain unproven, including pause policy, both recruitment paths, authoritative time samples, normal controls, local file restrictions, photo mode, rejoin, delayed team spectator behavior, hostile privacy, screenshots, and page-error checks. A later failure remains possible. Do not treat this preparation as an online acceptance result.
