# Requirement 65 promotion admission

Accepted with no findings.

I independently authenticated `/tmp/ovf-id65-season-coverage-c074.json` at SHA-256 `f3712dfc6fcd69b4baf3207af02458f3e82f253cbb8ef363676a9051ea1d3f40`. The supplied independent audit is also internally consistent at SHA-256 `90d766abe376a96a981529fc4c219bb0e9a884d15078e91717ce9975e431c7d5`.

The original clause at C074 is “track competitive results with periodic rating resets.” Both parts have admitted behavioral evidence. The 4a71cd0 suite report is retained in C074 with SHA-256 `8711be82822ba830200c91af9936e476c3db3617a6ce6b33089cf329da0590e5`; it records exit code 0, input-integrity success, and 2,920 of 2,920 tests passing. Its retained `tests.json` has SHA-256 `ced75e92e6e198d8bad063fc0e4b276bfd7ee1936bf1849830cafcd21f7a11a9`, matching the report.

For “track competitive results,” the recorded assertion at `$.testResults[106].assertionResults[3]` passed. The functional test in `tests/server-competitions.test.ts:63-74` finishes a hosted ranked match, verifies the two updated ratings and one played match each, reads the durable result with its season and before/after ratings, restarts the server twice, and verifies that standings and the result survive. It also proves duplicate and later surrender commands do not create a second result. The implementation stores season-keyed rating, played, win, draw, and loss values and a per-match result in `src/server/competitions.ts:23-54`. Current and archived standings and participant result APIs are present at `src/server/server.ts:238-244` and `:317-322`.

For “periodic rating resets,” the recorded assertion at `$.testResults[106].assertionResults[7]` passed. The functional test in `tests/server-competitions.test.ts:107-112` gives the same two accounts a match before and after the UTC month boundary, verifies that both begin the new season at 1000, retains the prior month’s standings, and checks the December-to-January boundary. `seasonAt` defines monthly UTC periods and a 1000 initial rating in `src/server/competitions.ts:7-9`; ratings are keyed by season and initialized to 1000 at `:23` and `:43-45`. This is a full periodic reset through a new season record, while prior results remain available.

The historical evidence applies to C074. I independently checked 39 complete bridge entries, or 78 commit/path object sides, against their recorded Git blob IDs, SHA-256 values, and byte counts. All matched. The eight main competition source/test files are byte-identical between 4a71cd0 and C074. The complete `src`/`tests` changed-path list contains only `src/main.ts`; its only change skips a cosmetic refresh when no account is signed in. The competition mount and `joinOnline` slices are unchanged. The relevant eight files and `src/main.ts` are also unchanged from C074 to the current observed root HEAD `ce3face`.

The retained UI and client source show rating, played, wins, draws, losses, the current season, reset time, starting rating, and archived-season selection. Native UI was not executed by this audit. That is not a gap in the original clause because the hosted functional tests directly prove result tracking and the reset behavior, while the unchanged UI/client bridge establishes access to those records.

No new product, balance, placement, partial-reset, detailed-ledger, or native-rollover requirement is needed for promotion. Root’s final-pin regression may proceed as planned, but it is not needed to close a missing clause in this admission.

No repository, ledger, server, browser, build, test, or simulation was changed or run.
