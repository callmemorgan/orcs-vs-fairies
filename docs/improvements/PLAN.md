# The 100 brainstorm improvements

This plan implements the numbered list from this thread. The older `codex/100-features` branch has a different list; its completion ledger does not count toward this one. Small existing algorithms may be ported with attribution and verification. Its large evidence history and unrelated systems are excluded.

The review target is `feature/brainstorm-100`, starting from master commit `a6b8dd99209f9d0657ffe14ed048c1719d3aaeb1`. Each feature gets a separate draft PR. Related features form ten native GitHub stacks. An aggregate preview branch is for integration testing; it does not merge or approve the draft PRs.

`requirements.json` preserves all 100 requirements and assigns each to one implementation lane. A feature is complete only when its player-facing behavior works, relevant verification passes, Claude simplify finishes and its actual edits are checked, and a draft PR exists. A definition, checkbox, helper, placeholder, or a passing build alone is insufficient.

Each lane has an isolated worktree and owns its branches and feature reports. The coordinator owns the integration checkout and the aggregate status. Each feature's simplify pass runs with no other writers in its worktree. The installed `claude-simplify` runner uses its default Opus model, xhigh effort and 9000-second deadline. Failed or incomplete cleanup is investigated before publication; quiet output is not a reason to restart it.

Agents run focused behavioral checks after cleanup and check visible flows for UI changes. Balance claims distinguish measured AI outcomes from human balance evidence. Performance claims include their measured workload and renderer settings. Multiplayer must run actual authoritative matches with reconnect and spectator support. Saves must preserve behavioral runtime, not only visible entity state. Audio additions must produce playable audio. Experimental map and mode ideas become working optional modes.

Lane stacks use branches named `improvements/NNN-short-name`. The bottom PR targets `feature/brainstorm-100`; each later PR targets its dependency branch. Only native stack registration is used; no shared local stack metadata is required. PRs remain drafts. Every PR is registered with the parent T3 thread.

Committed feature reports live in `docs/improvements/features/NNN.md`. Raw simplify artifacts and local command output remain in the lane's ignored working directory; reports identify the actual model, cleanup result, verification and any limits without including private configuration. PR descriptions explain the final change and checks in plain English, and never link local screenshots.

The coordinator checks all 100 feature IDs, PR URLs and cleanup evidence, resolves integration conflicts, verifies the assembled game, and publishes the aggregate preview branch. No changes are deployed to the existing hosted service as part of this request.
