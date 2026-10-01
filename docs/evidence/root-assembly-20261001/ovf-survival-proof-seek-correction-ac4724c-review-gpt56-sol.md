# Survival endpoint-seek proof correction

GPT-5.6 Sol accepts tool-only commit `ac4724c1040fbb221051a375437cc0637150faae` over `574ed5a6f1abc310dfda610954bba2e91bed6e10`.

The original runner called `seek(finalTick)` immediately after `advance` had already reached `finalTick`, so its saved-state comparison was real but its endpoint-seek label was unsupported. The correction seeks back to the original tick, asserts that tick, then seeks to the endpoint and compares the full saved game. It records `endpointSeekFromTick` in the report.

The survival replay spans 497 ticks, below the 600-tick checkpoint interval. The first seek therefore resets to the original replay state, and the second seek traverses all 497 ticks. The committed tip equals the parent with only those seek/report changes, and `node --check` passes.

The production admission for `574ed5a` is unchanged. The original v1 red/green runs still prove ordinary continuation, complete-envelope equality, recorder equality, full forward replay, analysis, and technology timings, but their endpoint-seek claim is superseded. Accept endpoint-seek evidence only from fresh v2 runs made with `ac4724c`.
