# Scenario ownership in the root app

The imported unique scenario chain adds pinned content actors, declared abilities, revision-aware journals/checkpoints/profiles, ownership metadata in ordinary session files, native commander identity in conquest armies, and the main campaign/mission/realm host. Root preserves the existing objective dialog input gate, live objective draft ticks, allied request controls and the shared measured toolbar.

The first combined root build failed at45e4c63. Root's conflict resolver mistakenly selected a scene assignment in place of the host/objective mount block, and ConquestTools lacked its read-only callback prerequisite. Root restored the mount block, imported the needed realm control guards and readonly UI tests from20af106, and kept ScenarioTools' read-only guards with the newer declared-ability counters. The build failure and both test runs are preserved.

At6899f35,130 tests in fifteen files and the production build pass. This is focused integration evidence. The campaign owner's later native commander missions and browser host proofs have not yet been imported. No campaign feature is promoted here, and root native/save4/revision/full-suite verification remains open.
