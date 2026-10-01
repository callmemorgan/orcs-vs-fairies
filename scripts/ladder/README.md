# Ladder evidence

Run the ladder from the repository root after committing the source and runner.
Every run requires a new `LADDER_RUN` beginning with `six-factions-`. The runner
refuses an existing output directory, including a partial run. Keep failed runs
and use a new name for retries.

The default matrix contains both seeds, all three map sizes and all 36 ordered
faction pairs, including mirrors (216 games). This command selects one seed for
108 games:

```sh
LADDER_SEEDS=4127 LADDER_SIZES=small,medium,large \
  LADDER_RUN=six-factions-new-name npm run test:ladder
```

Use `LADDER_PAIRS` to validate the runner with a smaller matrix. This command runs
two ordinary AI games with the same rules and limits as the full ladder:

```sh
LADDER_SEEDS=4127 LADDER_SIZES=small \
  LADDER_PAIRS=orcs:fairies,fairies:orcs \
  LADDER_RUN=six-factions-runner-check-new-name npm run test:ladder
```

The gameplay loop advances by 0.05 seconds for up to 45 simulation minutes. Each
Vitest case retains the 120-second wall timeout. A match with no winner at the
simulation limit stays a timeout; the runner adds no winner or tiebreak. It keeps
the original economy, position and losing-stronghold assertions and summary
metrics.

Cases run serially. Each synchronous simulation and save proof gets its own
120-second timer; concurrent cases on one JavaScript event loop can otherwise
charge another case's synchronous work against that timer.

Each run saves its method and reduced game reports at the output root. Complete
final save envelopes, including private simulation runtime, are under `saves/`.
Each game report names its save file and records the SHA-256 of its file bytes,
the full-state SHA-256, and the current replay checksum. Full-state SHA-256 sorts
only the visible and explored fog-cell arrays. All other array ordering and
numerical values remain unchanged. The replay checksum uses the raw envelope and
is an additional divergence check, rather than a cryptographic integrity check.

The runner loads each saved file and compares its full-state hash and replay
checksum with the live final state. For an unfinished match it compares 20 further
ordinary ticks on the live state and the restored state. For a finished match it
attempts the same steps and requires both states to remain equal to the terminal
save. Reports label these modes separately and retain every comparison. The
reported outcome, duration, economy and survivors are copied before proof steps.

`method.json` records Git HEAD, the exported save version and simulation revision,
actual default AI settings, selected matrix, Node executable/version and platform.
The runner recursively snapshots every TypeScript file in `src/core`, plus the
runner, reporter, this README, Vitest configurations, TypeScript configuration,
package manifest and lockfile. Before execution it requires every listed file to
match its committed bytes. `verification/source-before.json` and
`verification/source-after.json` contain the path set and hashes; an added,
removed or changed core TypeScript file or a changed HEAD fails the final check.

These manifests pin the listed file bytes at the two checks. They do not prove
the complete installed dependency tree, tool executable provenance, or all
environment settings. They do not establish packaged CLI/server or browser parity.
The match sample and movement diagnostic do not establish competitive balance or
prove that a flagged route is unreachable. Inspect the test exit status as well
as the reporter: a wall timeout may leave a completed game file while Vitest
still fails. `npm run test:ladder` only runs the reporter after Vitest succeeds.

To summarize retained results, run:

```sh
python3 scripts/ladder/report.py --run six-factions-existing-name
```

The reporter checks the snapshotted source hashes and original result metrics. It
does not independently rerun saves or continuation; those assertions belong to
the recorded runner execution.
