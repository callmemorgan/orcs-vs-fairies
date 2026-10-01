# Assembled allied AI evidence

The implementation is pinned at `c9ae0fc`, based on the assembled world/content checkout `e9bdb46`. `f75fdd9` changes only the Close button colors. The natural runner's core/server source bytes are identical at both commits. Earlier evidence in `../allied-ai-20261001/` remains unchanged and retains its earlier simulation scope.

The combined run passed 588 tests in 27 files. It covers allied commands and HTTP/WebSocket authorization, custom production and full resource costs, finite stock and partial-cargo recovery, level-aware assignment and traversal cleanup, ownership/level save validation, exact saved continuation, observation/render privacy, and toolbar modal controls. The 30-second test timeout permits existing long natural roster checks; the unchanged `e9bdb46` baseline also exceeded their default five-second timeout. Web, terminal and server production builds passed.

The two natural four-AI matches use normal difficulty, balanced personalities, seed 4127, income factor 1, population cap 100 and ordinary 420/220/0 starting banks. The runner injects no orders, directives, transfers or resources. Original Orcs/Fairies versus Dwarves/Undead finished at 713.70 seconds; the swapped arrangement finished at 1816.05 seconds. Team 0 (Orcs/Fairies) won both. Every owner had shared launches, positive recruitment, gathering and combat. Losing headquarters died through combat. Both actual final saves reloaded byte for byte; the runner's source hashes were unchanged. Reports retain 11 and 13 shared waves respectively, plus one and six solo waves. A wave removed immediately at its deadline can be absent from those counts.

The strict production browser run passed 18 checks. Ordinary local controls start a human with an allied AI. The mounted dialog sends and cancels requests while owning its pause, blocks battlefield input, wraps focus, restores the previous state, and shows accepted/active/completed results from actual saved simulation. All four request kinds are exercised. Two real isolated guest accounts cover authenticated online commands, authoritative acknowledgements and snapshot transitions, resource-support receipts, foreign-bank/assigned-ID privacy, photo/replay guards and an enemy-perspective spectator delayed by 600 ticks. The exported production build ID matches the source hash. Browser and capture error lists are empty. The Close control was visually inspected after its color fix.

`summary.json` contains pinned commits, result totals, limitations and production file hashes. `natural/` contains source-before/after hashes, full reports and actual final saves. `browser/` contains compact command/ack pairs, selected authoritative frames, exported local saves/replay/report and screenshots. Complete transport captures remain under `work/assembled-allied-browser-final-css/`; they are omitted here because selected frames provide the relevant proof without retaining guest session tokens.

These checks do not establish balance for every faction/team arrangement, automatic AI traversal, public remote hosting or final root behavior-version migration. Four-player small and medium requests normalize to the same 64×64 layout, so the runner omits the duplicate original-order medium case.

Reproduce natural matches with:

```bash
AI_TEAM_OUTPUT=work/assembled-allied-natural npx vitest run --config vitest.ai-team.config.ts
```

Run the browser proof against a built authoritative server, passing the repository path explicitly:

```bash
OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
OVF_ALLIED_BROWSER_PROOF_OUTPUT=work/assembled-allied-browser-final \
node scripts/verify_assembled_allied.mjs http://127.0.0.1:5371 "$PWD"
```
