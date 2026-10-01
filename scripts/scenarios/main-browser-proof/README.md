# Main production browser proof

Use this preparation helper after the implementation is frozen. It does not start a browser, server, production build, campaign solver, or gameplay. It compiles the native download auditor while packaging inputs. Follow `checklist.md` in the visible canonical `/index.html` application through CUA. Keep its transcript, screenshots, photo download, and cosmetic receipts beside the downloaded JSON artifacts.

The fixture owner supplies a JSON manifest with `sourceCommit` equal to the frozen commit and a `files` object containing the six paths below. Paths may be absolute or relative to that manifest. Historical inputs retain their original JSON; current inputs must be generated from the frozen source.

```json
{
  "sourceCommit": "<full frozen commit>",
  "files": {
    "currentCampaignSession": "current-equipped-session.json",
    "authoredScenarioPackage": "authored-commander-scenario.json",
    "historicalGenericSession": "historical-save3-session.json",
    "historicalCampaignProfile": "historical-campaign.json",
    "historicalRealmProfile": "historical-realm.json",
    "finaleCampaignProfile": "canonical-orcs-active-finale.json"
  }
}
```

`currentCampaignSession` must contain a compatible active canonical campaign owner, an earned equipped soldier, and the unchanged original mission checkpoint/command prefix. Its generic replay is optional on input; the main application starts ordinary history from the installed checkpoint if none is supplied. `authoredScenarioPackage` should include a visible `core:orcs-commander`, safe target ground within five tiles of allies, and a result trigger that leaves time to test targeting. Packaging extracts its existing `map` member to `fixtures/editorMapPackage.json` for the native map import; it preserves that member's metadata, hash and world without generating gameplay. Change one terrain cell in the map case; keep its dimensions, levels, elevation, starts, resources, sites and transitions. In the separate scenario case, import the original authored package and keep the entire definition except visible title, briefing, victory/defeat text, and existing finish-action reason text. Keep the existing finish graph and outcome. Export promptly after Iron Command so its cooldown and eight-second buff remain visible in the saved state. `finaleCampaignProfile` must contain exactly three completed canonical Orc chapters and the compatible active `orcs-4` mission. Supply safe visible actors and destinations separately in the fixture notes.

Build and serve the frozen checkout through the project's existing production workflow, then package the proof inputs:

```bash
node scripts/scenarios/main-browser-proof.mjs pack \
  /absolute/frozen/checkout <full-frozen-commit> \
  http://127.0.0.1:PORT/index.html \
  /absolute/fixture-manifest.json /absolute/new-evidence-directory
```

Packaging checks every tracked file against its pinned Git blob and checks the complete `src` inventory, including untracked additions or missing tracked files. It computes the same TypeScript/CSS source fingerprint as Vite and requires it in production JavaScript. It fetches every served production file and compares its bytes with the complete local `dist` inventory. The package retains a Git bundle of the frozen source, production files, fixtures, helper, native auditor source and bundle, and a hashed export template. The executing helper and all helper sources must belong to the frozen commit. The output directory must not exist; a failed or completed package is never overwritten.

Copy `exports-template.json` to a separate UI export manifest and replace each path with the preserved download for that case. The files are:

| Names | Download and comparison |
| --- | --- |
| `ordinaryBefore`, `ordinaryReloaded` | Same paused normal match before named save/load and afterward. |
| `editorMapPackage`, `editorMapImported` | Exported edited map package, then exported again after reimport. Do not make another edit or export between the first export and reimport. |
| `editorMapBefore`, `editorMapReloaded` | Same paused edited-map match before and after ordinary save/load. |
| `authoredPackage`, `authoredImported` | Exported authored scenario package and the reexport after native reimport. |
| `authoredBefore`, `authoredReloaded` | Same paused authored mission before and after ordinary save/load. |
| `authoredAbility` | Authored mission after one native targeted Iron Command, with that accepted action in the ordinary replay. |
| `campaignBefore` | Equipped campaign after initial native import, before a new gameplay command. |
| `campaignContinued` | Same installed campaign after one visible Hold position order. No other player command belongs between these two captures. |
| `historicalBefore`, `historicalAfter` | Main SAVE4 exports of the same historical generic mission before/after wall time and attempted blocked actions. Input remains SAVE3. |
| `historicalCampaignExport`, `historicalRealmExport` | Raw profiles downloaded through Save campaign profile / Export realm profile. |
| `finaleSession`, `finaleCampaignExport` | Main session and full canonical profile after the real Orc finale wins. |
| `buildReport` | Native Report a bug download from the served production application. |

Opening Saves pauses a local match. Keep the dialog open across each export/load/export pair so equality compares the same tick. A running capture, an editor package with another revision, or a command issued during an equality pair is a different case. Record the difference instead of editing the downloaded JSON to make it match.

Audit the downloads after the CUA run:

```bash
node scripts/scenarios/main-browser-proof.mjs audit \
  /absolute/evidence-directory /absolute/ui-exports-manifest.json
```

The audit verifies archived source, production, packaged fixture, and auditor bytes again before and after execution. It fetches the served production files again and compares them with the archived build. Native decoders and replay engines check the complete saved game, both recording histories, scenario ownership and equipment, historical inspection, canonical finale/War Cry/reason, and the build fingerprint in the UI report. It copies the unmodified JSON downloads into `exports`, retains the UI export manifest, and writes one append-only `export-audit.json` with every download's hash.

Afterward, the package can be checked on another machine without the original worktree, download folder or server:

```bash
node /absolute/evidence-directory/helper.mjs verify /absolute/evidence-directory
```

This offline command verifies the frozen commit and source files from the archived Git bundle, all packaged bytes and downloaded artifacts, and the recorded before/after served-file inventories. It reruns the native artifact audit and writes no result over the original evidence. The package manifest's checksum is stored in the audit report; a manifest cannot hash itself. Keep the final report/hash in the parent's independent evidence record as well.

The artifact audit cannot establish what the browser showed or who issued an action. The CUA transcript and screenshots must independently prove actual imports, editor interaction, paused clocks, Escape behavior, native targeting, reward eligibility/retry/account switching, equip receipts, visual appearance, and the rendered photo. Inspect the downloaded photo as an image. A successful artifact audit alone is not a completed browser proof.

The source fingerprint covers `src/**/*.ts` and `src/**/*.css`, matching the current Vite build ID. The tracked-source and dist inventories record the other files; a native UI bug report binds the served application's source fingerprint. Dependencies and the server process still require the final production workflow's own build/runtime record.
