This generator is prepared and unexecuted. The only check performed on executable code is `node --check` on `generate-supplemental-fixtures.mjs`. No bundle, generator run, fixture creation, game API, recording replay, simulation, test, browser, server or HTTP action has occurred during preparation.

After root supplies and releases the final full source commit, use four absolute arguments and set `OVF_SCENARIO_RELEASED_PIN` to that same commit:

```bash
OVF_SCENARIO_RELEASED_PIN=ROOT_RELEASED_FULL_PIN node /tmp/ovf-scenario-supplemental-generator.Any3mQ/generate-supplemental-fixtures.mjs \
  ABSOLUTE_FROZEN_CHECKOUT ROOT_RELEASED_FULL_PIN ABSOLUTE_ADMITTED_NATIVE_OUTPUT NEW_ABSOLUTE_SUPPLEMENTAL_OUTPUT
```

The release variable is an execution guard, not a substitute for root's release. The output directory must be new and outside both the frozen source checkout and the admitted native evidence. Every failed attempt remains in its reserved directory with its phase and error. Retries need a new output.

The draft follows the supplied matrix and authenticates its ten retained original inputs against the matrix SHA256 and byte count, the full frozen Git tree, and the admitted native source manifest. Actual esbuild module inputs must match both the native SHA256 entries and the frozen Git blobs. The generated entry is the sole permitted input outside the pinned source. Its retained template substitutes only absolute native import paths. The bundle, metafile, generated entry, compiler metadata and loader receive hash receipts; the source graph is authenticated again after derivation.

The intended fixture inventory is ten raw retained inputs, three newly derived SAVE4 main-session companions, two synthetic missing-pin empty profiles, four synthetic current-outer-pin owner profiles, and four Lantern artifacts. The raw-input set includes the pinned Lantern test source. The Lantern artifacts are a synthetic SAVE3 checkpoint, a synthetic main SessionFile with a SAVE3 game, a synthetic version-one journal, and unchanged genuine historical content extracted from the retained capture. Extracted JSON has new whitespace; the complete original capture is separately retained byte-for-byte.

The three SAVE4 companions use the original active campaign checkpoint, the latest earned completed campaign checkpoint, and the active conquest checkpoint. Native restore and SessionFile owner binding must preserve the raw owner and its missing rule pins. Full restored captures and normalized state comparisons must agree after decode. No generic replay or planning document is attached. The completed campaign input contains one earned chapter; it does not represent a finished four-chapter campaign.

Completed historical conquest remains in its original strategic profile. It cannot be bound through the existing main-session owner API because there is no saved final checkpoint; that API would verify its old final journal and reject historical replay. The generator does not invent one. Empty conquest means no decisions and no active battle; native creation still supplies its starting army.

The four synthetic outer-pin probes change only the outer owner revision to 4.0.1. All original nested checkpoints, journals, commands, checksums, history and strategic fields remain unchanged. Native decode and compatibility must retain an inspection-only result. A version-one SAVE3 journal reports legacy revision 3.0.0 even though its fixture directory contains 3.2 in its name; the generator does not change that value.

The Lantern recipe copies and authenticates genuine old content with hash `2fe954644f4b3a4d5b20e3d39b83744b9d39761869b325933446145304ba966a`. It creates a new native current mission at tick zero, then uses the pinned test recipe to make explicitly synthetic old SAVE3/3.2.0 wrappers. The migrated definition and game content must agree, restored checkpoint and bound-session captures must match, the original raw wrappers must remain unchanged, and the original synthetic journal checksum must survive decode. These wrappers do not claim old captured gameplay. Current Lantern accepted-command and replay behavior remains in the planned native test.

The generator invokes no direct accepted player command, simulation step, or replay verifier. It checks historical command permission through the pure native guard. Native decoders can perform internal replay when they admit compatible owners; any such execution is deferred until root release. These selected incompatible owners should take the native inspection-only path. Real rejected command/step/recorder attempts, owner writer/claim/reset attempts, UI imports/exports and frozen views remain obligations of the separate native suite and canonical browser verification.

The inspected source HEAD was `01b5ae61a365a45447df7aa548f7bfde9ed6cc22`. The supplied matrix's read pin was `c86e273c70738f144a00fe75f5ecf39e7fa324d8`. Independent source inspection found the relevant APIs and Lantern test unchanged between those pins. Neither is asserted to be the eventual released pin. All actual generated bytes and runtime semantic assertions remain unverified until that release.
