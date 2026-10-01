# Canonical competitions and cosmetics verification

The native packaged-main proof passed all 18 checks at `27f3d06d3e9c00092cbda995dc7925b0a8e833c2`. Its recorded source digest is `f6dad884b19dbddfc8a22073641313838ee72c6fd36c2c11b205b437ff4bd584`. The report pins 167 source files, both server files and all 392 built browser files. Source bytes were checked before and after the run. The final evidence was read back and its source/package hashes were independently compared with the files on disk.

The browser registered two independent accounts through Online play, created and entered five ranked matches through Competitions, and finished each with one accepted surrender command on the guest's captured game WebSocket. Main has no surrender control. No winners, inventory, game state or application callbacks were injected. The owner earned banner, building decoration and portrait at one, three and five wins; the losing account earned none. Native keyboard selection skipped each locked item.

The equipment form saved all three choices through the real server. Raw Photo-mode downloads changed 1,313 pixels, independently counted from the saved PNGs. Both complete paused exports are byte-identical, including all 22 private runtime fields. The HUD retained the portrait through normal refresh. In a sixth live orcs/orcs match, both views mapped equipment only to owner side 0, and both accounts rejoined that same match after reload.

Real delayed responses tested older hosted success (3,938 ms), older hosted transport failure (1,856 ms), and an anonymous session poll released after login (2,862 ms). The driver confirms delivery or the specific failed native request before comparing rendered equipment. Native daily entry/reload resumed the same seeded run. Logout cleared local equipment, building marks, banner and portrait. A graceful packaged-server restart retained both authoritative profiles. Cleanup reported no errors.

The final trace records 47 native HTTP actions with no no-request click retries. The driver can retry a native click only if neither its mutation nor its preparatory lobby GET started. It retains the first target request, requires successful preparation and rejects multiple observed mutations. The isolated driver probes in `driver-review` show that slow preparation sends one POST, failed preparation sends none and fails verification, and a click that sends no request can be retried once. Earlier failed entry/readiness/scene-wait runs are preserved in their own directories. The scene-wait failure accepted the previous rendered game before the new modal closed; the final driver requires modal closure and fresh ready rendering together.

The Docker build and four runtime checks passed at production source `0bfaf11e4af92e5977d272567ecf4e68b9372536` with image `sha256:9d6889efdc51ae29b081c2f417820150e81d3bab692208bb0cd74090d16e2306`. Later commits change verification and documentation only. The runtime served the game and account routes, launched both packaged fixed agents, preserved a verified cancellation report, and completed both full builtin smoke battles. Their final hashes are `9f0ec161d4327af1506c3c6af67fdca46ceaeb21bd43064888f584c6ea5bbd10` at tick 3863 and `27287fe0ed3d8f6ea81b9231de910ad08a5df28f0841df328048da30dae6ca89` at tick 3933. `/proc` contained no agent processes afterward. Graceful stop exited zero and the container was removed.

The focused and adjacent suite passed 87 tests across 11 files. The earlier 12-check canonical tournament proof also passed before the account race fixes. Its separate verifier is owned by the parent tournament integration and is not duplicated in this commit.

This checkout has no canonical scenario runtime, so the packaged campaign route correctly returns 503 without a reward. This report does not prove an assembled campaign victory. Native daily proof covers entry and resume; daily victory scoring remains the earlier separate hosted proof. SAVE_VERSION stays 3. Final combined-source verification and the root requirement ledger remain with integration.

Run from the repository root with a new output directory:

```sh
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/competitions/verify-canonical-main.mjs work/competitions/native-new-run
npm exec vitest run tests/competition-tools-integration.test.ts tests/online-lobby.test.ts tests/server-cosmetics.test.ts tests/server-competitions.test.ts tests/campaign-verification.test.ts tests/server.test.ts tests/server-teams.test.ts tests/online-client.test.ts tests/online-render-state.test.ts tests/tournament-runtime.test.ts tests/session-storage.test.ts
docker build -f Dockerfile.server -t ovf-competition-integration-proof:local .
```

`passed/result.json` contains the complete native source/build manifest, account-independent HTTP checks and browser result. `passed/summary.json` contains native requests, thresholds, accepted wire commands, equipment diagnostics and both profiles. Cookies and tickets remain in memory and are not copied into evidence. The paired raw saves and PNGs preserve the state and renderer comparisons. `docker/result.json`, logs and compressed full tournament reports preserve the runtime-image proof.
