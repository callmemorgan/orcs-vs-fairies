# Scenario finale reward UI review

I reviewed `84851a1961e07a541a3eb05ceb2ba2513a922cd6` over `4e737ea58bd094de1b65792e5a0c2b228b797e87` with GPT-5.6 Sol. The commit is admitted with no findings.

The source change is limited to the main application wiring and `ScenarioCampaignHost`; the other changes are one focused test file and documentation. The host exposes the claim only for a decoded current-rules campaign with no active mission and four completed chapters. It sends a structured clone of the complete profile and the canonical fourth chapter ID. The client callback requires a known signed-in account, submits through `CosmeticApi.claimCampaignVictory`, refreshes cosmetic inventory, and checks both account ID and account epoch after each awaited operation.

The lifecycle checks are consistent. Host construction completes before account callbacks can run. Every owner replacement calls `clear`, which increments the reward generation and resets pending and claimed state. Starting or restoring campaigns and realms, installing an ordinary session, replacing the match, opening a replay, starting a skirmish, and launching authored or community content all use that owner lifecycle. An account identity change calls `resetCampaignReward`, which also increments the generation without clearing completed campaign progress. Switching away and back still changes the epoch, so an older response cannot become current again.

One request can run at a time. A verifier or network failure reports the error and clears only the pending flag, which permits retry. A successful current request marks the button claimed only after the cosmetic refresh completes. If the owner or account changes during either await, the changed generation suppresses the old host response; the main callback also rejects stale account identity and epoch. A successful server award followed by refresh failure remains retryable, relying on the server's documented duplicate gate to avoid a second reward.

The new tests disclose that their four history entries are synthetic and test only the UI callback boundary. They cover a finished current campaign, canonical finale selection, full cloned profile submission, unfinished and historical rejection, duplicate-click suppression, retry after failure, match replacement, account switch after success, and account switch while pending. Existing host tests cover ordinary owner installation and clearing. The worker tests cover busy admission, timeout, unavailable modules, worker failure recovery, and the longer campaign client timeout.

In a detached checkout at the exact commit, the three focused files passed 19 of 19 tests. `tsc --noEmit` also passed. `git diff --check` passed, and all commit-message trailers are valid.

This review does not claim a canonical four-chapter completion or a packaged HTTP/browser reward run on the final assembled source. The commit and documentation state that limit directly.
