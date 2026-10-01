# World Map-level locator correction review

GPT-5.6 Sol accepts `9c6dc8285f396adab3fb5adc8ddc2f05175b5833` over `af44da406acf7ab44436e978cb1f571b93e28d23` with no finding.

The commit changes only `scripts/verify_world.mjs`: both unscoped `page.getByLabel('Map level', { exact: true })` calls become `page.locator('.world-tools').getByLabel('Map level', { exact: true })`. Replacing those two expressions in the parent produces the tip byte for byte. No assertion, wait, evidence record, screenshot, save download, build-report download, failure handling, or cleanup changes.

The production `WorldTools` component creates `details.world-tools`, gives it the accessible name `World tools`, and appends the `select[aria-label="Map level"]` inside it. The map editor also has a `Map level` control, so the added scope selects the live world control and removes the strict-locator ambiguity. Other admitted drivers already use the same `.world-tools` scope for this control.

`node --check` passes on the committed file. Ordering, errors, evidence output, and write behavior are unchanged. The final frozen world browser run still has to execute the corrected driver; this review admits the script correction, not that pending runtime result.
