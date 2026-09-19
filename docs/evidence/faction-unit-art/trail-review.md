# Decision-trail review

reviewed by gpt-5.6-terra

The corrective provenance rows resolve the earlier broken links. The old-model claim now names `bed3c77:art/blender/progression.py`, and the trail states that the intermediate samples were overwritten. The final-art evidence is consistent with the recorded export: every source hash matches the current generator, packer, review fixture, and 18 scene files; the frame check reconstructs all 3,456 frames; and the browser record covers 576 frames for each faction. The baseline copy used for the timeout reproduction also matches all 40 files from `bed3c77`.

## Attention

- The intermediate approval and upright siege-death pose cannot be independently inspected because their sample sheets were overwritten. The README and appended provenance row disclose that limit. The final images and final-frame checks do not restore the intermediate evidence.
- The browser evidence uses software-rendered headless Chromium and the GameScene fixture loads Orcs and Fairies only. It proves all six factions through `ArtRuntime`, and a 100-unit synthetic scene for two factions, but it does not measure hardware frame rate, a live match with the other four factions, balance, or human play.
- The 239-test full-suite result used `--testTimeout=20000`. The fresh focused default-timeout roster run completed after rendering with all 8 tests passing in 5.97 seconds. There is no fresh full-suite default-timeout result after rendering, so retain the command qualifier and the initial-timeout context in the PR.
