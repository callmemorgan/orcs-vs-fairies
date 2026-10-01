# Common native proof source review

This is a source-only review of the four candidates in `/tmp/ovf-native-acceptance-common-20261001/`. No bundle, generator, engine, browser or test was executed, and no shared file was edited. Supporting reads covered the fixture aggregator, generator wrapper, native contract, browser/history wrappers and the specialist browser's actual export names.

## Findings

1. `helper-provenance.mjs:9–20` does not establish that pinned source produced the executed bundle. The adjacent JSON supplies both the expected bundle hash and its declared input list. Changing a bundle and that JSON together passes the byte check, and an input list containing only the current entry passes the source checks while omitting stale core dependencies. The loader does not compare an independently regenerated bundle, retained metafile, builder digest, compiler identity or complete inventory. `build-native-helpers.mjs:15–31` checks the source/proof inventory during its own honest run, but the loader cannot distinguish that run from an edited receipt. The builder also allows `OVF_ESBUILD_MODULE` and lets esbuild read root configuration without pinning the compiler module and configuration in the build receipt. Rebuild deterministically from the checked pin and validated compiler/configuration, then require the executed bundle bytes and actual imported input set to match that fresh build.

2. `native-freeze.mjs:33–35` accepts an incomplete generation receipt. It compares the source labels and fingerprints only the listed `generation.fixtures`; an empty or shortened array passes. It does not require that list to equal the actual generated inventory except the receipt itself, and it does not verify the generation helper's bundle/input provenance. Thus an unlisted changed fixture can be sealed as current generated evidence. Require an exact unique inventory, including the combined and group manifests, and validate the generation helper using the corrected provenance check before sealing.

3. `native-audit.ts:45,51,69,84–85` can report successful acceptance with no native saves or group checks. A receipt with the matching source, `completed:true`, `downloads:{}` and `groups:{}` reaches the successful report with `completeNativeSaves:0`; `selectedGroups` is never checked. Deleting a requested group also skips that group's required continuations and behavior audit. Validate a nonempty known `selectedGroups` list, require the exact completed group-key set and each group's expected retained exports, and reject a zero-save audit.

## Checks without findings

The common native audit strictly decodes each retained session, requires current schema/revision, compares `saveGame(decoded.state)` to the original whole envelope, and compares the full replay endpoint to that same whole native game. Its retained-download hashes are checked before decoding. These checks include runtime and all state fields.

`commandSuffix` compares the native initial games and command prefixes, consumes matching advance ticks across action boundaries, preserves the remaining portion of a coalesced advance, and includes later commands at the checkpoint tick. The continuation loop decodes the checkpoint, executes the suffix through public command/step functions, and compares the complete endpoint envelope. The specialist pending/active, recovery/rerecruitment, bridge expiry, barricade expiry and beacon destruction pairs match the browser module's real export names.

The direction callable audit receives the correct object signature, a group-filtered shared manifest and the direction group receipt. Prefixed `direction/` fixture paths resolve under `fixturesDir`. Its no-argv API, dynamic version checks, 22-case requirement and same-tick boundary checks fit this integration.

All findings above must be fixed before admitting the common provenance and whole-acceptance claims. No behavior pass is inferred from this source review.
