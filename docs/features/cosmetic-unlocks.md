# Cosmetic unlocks

Hosted victories earn cosmetics for the winning account's faction. One victory unlocks its banner, three unlock its building decoration, and five unlock its commander portrait. The eighteen faction assets are vector drawings with faction colors and emblems. A loss or draw does not grant a victory. Accounts keep progress and equipped choices through server restarts.

`ServerStore.startMatch` captures the participant account and side roster with the durable match configuration. The final tick calls `CosmeticStore.awardVerifiedVictory` for each winning participant inside the same transaction that persists the match outcome and ranked or daily result. The unique `(source_id, user_id)` key prevents repeated tick writes or reconnects from awarding again. A cosmetic storage failure rolls back the final tick, command receipts, rating, result, progress and unlocks together.

The equipment endpoint checks the current account, profile revision, faction, slot and earned item. A stale selection returns 409 and the browser refreshes the persisted choices. Unknown or mismatched items return 400; unearned items return 403. Equipping and clearing items changes account profile tables only; a test checks that the durable simulation state hash stays unchanged.

Campaign rewards require an authenticated upload of the complete campaign profile and its finale mission ID. The host loads its own compiled canonical campaign module through `createCampaignVerificationWorker`; HTTP input cannot select a module or supply executable code. The canonical verifier replays all four chapters and compares the full normalized initial state and carried-army checkpoints. FNV checksums remain replay diagnostics and do not authorize the army or campaign progression. A verified finale grants one victory per account and canonical campaign/finale, so retrying or renaming a local profile cannot grant another reward.

Campaign replay runs in a worker with a 256 MiB old-generation limit and a 45-second deadline. One worker runs at a time, allowing hosted ticks and ordinary HTTP requests to continue. Busy or unavailable verification returns 503; timeout returns 504. No reward is applied on these paths. `CosmeticApi.claimCampaignVictory` allows 60 seconds for the upload and worker response; ordinary online requests retain their usual timeout. Campaign reward writes use one SQLite transaction, and a failed unlock write rolls back the duplicate gate and progress so the same completed profile can be retried.

| Endpoint | Meaning |
| --- | --- |
| `GET /api/cosmetics` | Authenticated inventory, per-faction victories, equipment revisions and catalog. |
| `POST /api/cosmetics/equip` | Stores all three slots for one faction using `expectedRevision`; null selects the default appearance. |
| `POST /api/cosmetics/campaign-victory` | Verifies `{missionId, recording}` with the host's canonical verifier before granting a faction victory. `recording` is the complete `CampaignProfile`. Returns 503 when the host has no verifier. |
| `GET /api/matches/:matchId/cosmetics` | Public appearance choices of the match's participant accounts, identified by side and faction. Requires an online account. |

The browser mount is `mountCosmeticTools(root, { getFaction?, onEquipment, onVisibility? })` in `src/ui/CosmeticTools.ts`. `onEquipment(factionId, loadout)` receives resolved catalog objects only after loading a server profile or receiving a saved selection. The root should keep loadouts outside `GameState`. For online matches, `CosmeticApi.matchCosmetics(matchId)` supplies the other participants' public choices by side.

The graphics adapter is `drawCosmeticBuilding(graphics, loadout, projectedPosition, roofY)` in `src/game/Cosmetics.ts`. Phaser Graphics implements its method interface. Call it within the existing visible-building drawing loop, after base art, preferably for finished construction. Keep the account-to-side mapping outside the simulation. `renderCosmeticIdentity(container, loadout)` inserts the portrait and banner in a HUD container; `cosmeticImage(item)` returns the same vector preview as an image source.

The browser evidence uses the standalone mounts and the shared graphics renderer on a real canvas. Five normal ranked victories unlocked the full Ironclad set. Selecting and applying all three choices changed building pixels, displayed the portrait, and restored the same appearance after browser reload and server restart. The losing account had no earned items. Evidence is in `docs/evidence/competitions-browser/cosmetics-applied.png` and `result.json`. The hosted daily proof also checks two real daily victories grant two faction wins and that replayed command receipts do not add another award.

The campaign evidence replays a completed four-chapter campaign through the actual HTTP route and worker. It checks live hosted ticks during verification, duplicate uploads, renamed profiles, forged checksums, wrong finales, client winner fields, restart persistence, and an altered initial state whose command recording and recomputed checksum still replay successfully. The altered recording receives no reward because its full initial state differs from the canonical state. Evidence is in `docs/evidence/cosmetics-campaign/result.json`, including the fixed canonical source commit and its geometry dependency. The complete chapter journals and checkpoints are in `campaign-recording.json.gz`; the report records its SHA-256 digest.

The main game mounts cosmetic choices in the shared session toolbar. The modal uses the main pause and input coordinator. Account changes clear local choices and invalidate delayed profile responses. Hosted choices are keyed by player side, so two players with the same faction keep separate equipment. Finished, visible buildings render on a separate layer above their art and below fog, including during photo mode. The HUD reads the current side’s loadout on every update. These appearance values remain outside `GameState` and save/replay checksums.

`npm run build:server` emits `canonical-campaign.mjs` beside the production server. Its runtime adapter accepts unknown recordings and exposes only the verified reward metadata. When `src/core/campaign.ts` exists in the integrated source tree, the build emits a separate verifier-only `campaign-runtime.mjs` from that same core. When the scenario source is absent, the build removes any stale runtime and claims return 503. The canonical server resolves its adapter relative to its bundle. Scenario integration must supply the matching runtime and claim completed finales through `CosmeticApi.claimCampaignVictory`.

Campaign uploads reserve one shared admission slot before reading or parsing the body. Ordinary JSON remains limited to 64 KiB; campaign recording JSON is limited to 20 MiB with a ten-second upload deadline. The slot stays held through worker termination and the reward transaction, and releases on every failure. The existing worker retains its 45-second verification deadline and 256 MiB old-generation limit.

Run the repeatable proofs:

```sh
npx vitest run tests/campaign-verification.test.ts tests/server-cosmetics.test.ts tests/server-competitions.test.ts tests/server.test.ts tests/server-teams.test.ts
OVF_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify_competitions.mjs
npx esbuild scripts/competitions/verify-hosted.ts --bundle --platform=node --format=esm --packages=external --outfile=work/competitions/verify-hosted.mjs
node work/competitions/verify-hosted.mjs
node scripts/verify_campaign_cosmetics.mjs
```
