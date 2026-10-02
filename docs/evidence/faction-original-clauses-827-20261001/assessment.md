# Original-clause assessment for faction IDs 21–30

Recommend root consider IDs 21, 22, 26, 27, 29 and 30 complete under their original wording. IDs 23 and 24 are supported under the ownership and constructed-Grove/disguised-decoy interpretations stated below. ID 25 lacks direct execution of successful squads through constructed underground entrances. ID 28 lacks the direct capture→paid necropolis→real summon→local sustain composition. Root decides statuses; this assessment makes no source, ledger, status or existing-evidence change.

The 367-pass focused suite executed at `827496b06bb660b6639257e5113ac2f199be29ba`; the retained full suite executed at `4a71cd07bacc12d214acaf5a0f95a7d9b486f52c` and records 2,920 passed, zero failed, 157 files, exit 0 and passing input integrity. Exact individual names/statuses below come from the full-suite JSON. Focused stdout reports complete file counts and 367 passing tests but does not print every fast individual name. Some supporting assertions are full-suite-only; the facts identify that distinction for each case.

Current source was read at `703fc036c6327a830a79d5746eec805188cbbaa6`; it was unchanged throughout this consolidation. I directly matched 111 case references (110 unique full names) to one passed record each with empty failures. I authenticated 101 relevant source/test/UI/static-import/configuration paths against the full-suite source-before inventory, both executed Git pins and current Git/working bytes. Relevant mechanisms are unchanged. The only inspected full-suite→focused difference is main.ts adding `if(id)` before an account-cosmetics refresh; faction mounting and callbacks are unchanged. These are source applicability reads, not fresh application execution.

The partial r2 native browser recipe remains failed/incomplete. It retained eight checks and three save/replay pairs, then stopped during ID 21 on Fury expected 49.97288/observed 52.09508. Target 56 lost 17.685 HP, whose 12% Fury credit is 2.12220, matching the excess above a 25 debit. The endpoints are consistent with the expected debit plus later earnings. The instantaneous historical debit was not retained and its replay ends before casting. Native Bulwark/expiry and IDs 22–30 were not reached. The failed recipe gains no whole-group pass; its unrun supplemental assertions do not add acceptance clauses.

Codex / GPT-6 wrote this data/source assessment. No runtime, tests, builds, browser, simulation, service, retry, replay execution or application import ran. All new artifacts are separate files under `/tmp`.

## ID 21: Orc war chants

Original requirement: "spend Fury on temporary offensive or defensive army buffs."

Recommend sufficient evidence for the original clause. Production command tests spend Fury 40→15, compare increased real outgoing HP damage and incoming HP damage reduced by 3, then remove the temporary chant. Mounted production-panel tests spend authored Fury 100→75, apply the chosen variant to selected military units and expire it after 13 seconds. Their Happy DOM callback invokes real issueCommand; scene clock and browser input are not exercised.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `faction mechanics through authoritative encounters hostile damage earns bounded Fury, selected assault raises real damage, and the chant expires` | Hostile attack earns HP-loss × 0.12 Fury; unaffordable Assault fails; authored 40→15 spends 25; next real hit exceeds baseline; after 12.1 seconds chant is absent. |
| `faction mechanics through authoritative encounters bulwark reduces damage on selected troops and another faction cannot spend Fury` | Accepted Bulwark makes actual incoming HP loss equal baseline minus 3; another faction cannot spend Fury. |
| `live faction powers panel spends Fury and applies the assault chant through the real authority` | Real mounted-panel click spends 25, applies 1.25 damage factor to the selected eligible troop, excludes worker/foreign troop, and expires through production stepping. |
| `live faction powers panel spends Fury and applies the bulwark chant through the real authority` | Real mounted-panel click spends 25, applies 3 armor to the selected eligible troop, and expires through production stepping. |

## ID 22: Orc trophy standards

Original requirement: "victorious troops establish banners that strengthen nearby allies."

Recommend sufficient evidence for the original clause. Two production hostile kills give the victorious troop two trophies; its accepted command consumes them to establish a banner. One second near that banner raises authored morale 50 above 53. The separate mounted-panel assertion checks 1.1 damage strengthening and displays the troop statistics. Its starting trophies are authored, so the combat encounter supplies the victory-derived earning proof. Current aura code restricts effects to live completed allied banners within six tiles on the same level.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `faction mechanics through authoritative encounters two hostile mortal kills earn a destructible trophy standard without supply or drop-off` | Public attacks kill two authored HP-1 enemies, earn two trophies, create a 160-HP banner, spend trophies, and raise nearby morale above 53 from 50. |
| `live faction powers panel consumes earned trophies to raise a real standard and refreshes selected troop stats` | Panel click uses real authority, consumes authored trophies, creates the banner and checks 1.1 damage factor plus troop/structure display. |
| `faction mechanics through authoritative encounters expired standards stop their aura before entity cleanup` | Nearby live standard damage factor 1.1 becomes 1 at expiry. |

## ID 23: Fairy illusion swapping

Original requirement: "exchange a real unit’s position with its illusion."

Recommend sufficient evidence if "its illusion" means an illusion owned by the same player. The mounted panel creates a double through the public Fairy ability, then swaps both coordinate pairs through the public faction command. The implementation admits any owned double and enforces no exclusive originating-unit relationship. The recorded panel scenario swaps a melee troop with a Veilweaver double. It does not directly execute the creator swapping with its own created clone, although the same owned-military predicates permit that path. Missing origin tracking therefore does not establish that creator-to-own-clone exchange is absent. Root should preserve the executed pairing qualification without adding an exclusive-lineage requirement.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `faction mechanics through authoritative encounters illusion swapping exchanges positions and clears orders for a paid cooldown, rejecting foreign doubles` | Authored real/illusion positions exchange; 15 crystal is spent; real order becomes hold; cooldown blocks immediate reuse and allows it after 10 seconds; foreign double rejected. |
| `live faction powers panel conjures real doubles and swaps a selected combat troop through the owned illusion picker` | Ability-created double and real troop exchange both {x,y} pairs through mounted panel; 15 crystal spent; panel shows ten-second readiness. |
| `faction mechanics through authoritative encounters a blocked swap is atomic and neither spends crystal nor moves actors` | Invalid destination rejects the command while both positions and crystal remain unchanged. |

## ID 24: Fairy enchanted groves

Original requirement: "cultivated forests conceal allies and mislead enemy scouts."

Recommend sufficient evidence under the constructed-Grove and disguised-decoy meaning of the original sentence. A production-panel worker builds and pays for a Grove; direct encounters conceal nearby allies from hostile observation and reject a hostile attack on a concealed troop. A Grove creates a harmless moving double toward an observed hostile cavalry scout. Separate hostile PlayerView assertions disguise native illusion health and omit the illusion flag. Current source joins those same illusion/observation paths. The evidence does not show an AI choosing or attacking that Grove decoy or browser rendering. Cultivation is a Grove building; no underlying forest-terrain conversion exists. Those qualifications belong in the status decision, without inventing AI response or terrain conversion as additional mandatory clauses.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `live faction powers panel constructs the fairies faction structure through selected workers` | Selected-worker panel build pays definition cost, creates a foundation, completes it after 35 seconds and conceals the fixture soldier. |
| `faction mechanics through authoritative encounters groves conceal nearby allies until attacking, contact or scouts reveal them` | Grove ally absent from hostile PlayerView and hostile public attack rejected; nearby cavalry, attacking and recent damage expose it. Test title says contact; body has no separate contact-distance assertion. |
| `faction mechanics through authoritative encounters a grove sends a harmless moving decoy only toward an observed hostile scout` | No owner-visible scout means no clone; refreshed visibility creates a moving double with long attack cooldown; scout HP stays unchanged and double moves. |
| `team observations shows allied illusions truthfully and disguises them for hostile players` | Hostile PlayerView omits illusion property and shows health scaled to original definition; ally sees truthful illusion capacity and flag. |

## ID 25: Dwarf tunnels

Original requirement: "transfer squads between constructed underground entrances."

Recommend retaining in progress for the original qualifiers not directly executed together. Paid panel construction and completed single-actor tunnel travel pass, but the successful travel cases use authored completed level-0 entrances. Two level-1 cases install a single-actor channel and then interrupt it for surrender/crew defeat; neither completes underground arrival. Source loops over selected units and copies exit level, so multi-unit underground travel is supported by implementation inspection. No inspected executed case proves successful squad transfer through entrances constructed by workers underground. This is a narrow evidence gap, not a confirmed missing runtime mechanic. The world-map "tunnel transit" case uses ordinary traverse on generated world transitions and receives no constructed Dwarf tunnel credit.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `live faction powers panel constructs the dwarves faction structure through selected workers` | Mounted real panel deducts definition cost, orders a worker onto a new foundation and completes a level-0 entrance; it does not use the new entrance for travel. |
| `faction mechanics through authoritative encounters tunnel travel channels, preserves a mid-channel save, and arrives at a walkable exit` | One actor travels between two authored completed surface entrances, reaches half progress at 1.5 seconds, completes after another 1.6 seconds and matches save continuation. |
| `live faction powers panel shows normalized tunnel channel progress and completes travel to the selected owned exit` | Panel selects one soldier and authored surface exit, shows 33% after one second, then completes arrival near exit and holds. |

## ID 26: Dwarf workshop modifications

Original requirement: "choose different ammunition or attachments for artillery."

Recommend sufficient evidence for the original choice clause. The production panel offers and executes stone, grapeshot, incendiary and reinforced on both the special artillery and ordinary siege engine. All four choices check fitted values, per-engine payment and selected-unit text. Public engine commands retain shot payloads, hit real targets and distinguish reinforced movement; other retained joint tests prove target-class multipliers, splash and ignition. Mounted-panel choice proof is Happy DOM, with real command authority and production stepping.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `live faction powers panel fits stone to real selected artillery with per-engine payment` | Both artillery roles receive stone, worker receives none, two-engine payment is 50 wood/40 ore and selected detail displays the choice. |
| `live faction powers panel fits grapeshot to real selected artillery with per-engine payment` | Same real player-choice path selects grapeshot on both artillery roles with per-engine payment. |
| `live faction powers panel fits incendiary to real selected artillery with per-engine payment` | Same real player-choice path selects incendiary on both artillery roles with per-engine payment. |
| `live faction powers panel fits reinforced to real selected artillery with per-engine payment` | Same real player-choice path selects reinforced on both artillery roles with per-engine payment. |
| `faction mechanics through authoritative encounters incendiary engines and fitted cannons pay ammunition at launch and retain payload after source removal` | Public fitting and firing spend 15 wood/5 ore per launch, retain incendiary payload after source removal, damage real target and match save continuation. |

## ID 27: Undead corpse wagons

Original requirement: "collect bodies and deliver them to Gravecallers."

Recommend sufficient evidence for collection and Gravecaller delivery. A mounted panel collects the authored body through real commands, carries its ID and original decay deadline, then delivers it to the selected real Gravecaller. The core encounter proves competing wagons cannot claim the same body and delivery feeds one real raise. Initial corpse fixtures are authored; the collection, movement, delivery and simulation are production paths. Native battlefield corpse generation and later browser continuation are unrun supplemental assertions.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `live faction powers panel collects a body and delivers it to the selected Gravecaller without extending its decay deadline` | Collect click removes ground body and carries its same ID/deadline; Deliver click empties wagon and places same body in Gravecaller stock; panel stock decays on original clock. |
| `faction mechanics through authoritative encounters two wagons cannot claim one corpse; delivery feeds raising once while expiry remains unchanged` | Two public collectors yield one total cargo body; delivery is accepted, consumes cargo/stock and produces exactly one raised unit through equal saved continuation. |

## ID 28: Undead necropolises

Original requirement: "convert captured territory into ground that sustains summoned troops."

Credit paid necropolis construction, real summoned troops and local sustain as executed. The direct sustain case heals a raised ally from HP 30 to 38 during four seconds and preserves its remaining three-second lifetime, then kills it after leaving the area. Full-suite level-0/level-1 bridge-expiry cases create canonical troops through public Gravecaller raising and preserve their original 35-second remaining lifetime for 59.75 seconds beside a necropolis. Capture/recapture passes separately. No inspected executed case connects capture, paid forward necropolis construction, public summon and sustain on that captured ground. Retain that narrow composition as unresolved if root requires a direct witness of the original captured-territory wording; root may explicitly accept the composition of separately passed capabilities. Current construction has no site-owner gate, and the original wording does not demand captured-only placement, recapture deactivation or a terrain-type conversion.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `faction mechanics through authoritative encounters necropolis sustains and heals raised allies until they leave its territory` | Authored completed necropolis preserves lifetime and heals an authored raised troop locally; leaving makes remaining lifetime expire. |
| `temporary crossing expiry without reachable shore kills a real level-0 raised troop at bridge expiry while a Necropolis sustains its lifetime` | Public raise creates canonical undead melee from a corpse; necropolis preserves real summon remaining lifetime 35 through 59.75 seconds before environmental death. |
| `temporary crossing expiry without reachable shore kills a real level-1 raised troop at bridge expiry while a Necropolis sustains its lifetime` | Same real summoned-troop lifetime support occurs underground at level 1; authored necropolis supplies local support. |
| `neutral features through normal match commands, ticks and checkpoints captures a cavern relic, changes ordinary combat damage and loses the bonus after enemy recapture` | Public capture and enemy recapture change ownership and combat bonus; this separate case has no necropolis or summon. |

## ID 29: Tideborn water shaping

Original requirement: "create temporary shallows, mud or flooded defensive approaches."

Recommend sufficient evidence for the original clause. All three real panel choices change actual terrain cells, spend 25 crystal, disable the action during the 20-second cooldown, then restore original grass and reenable the action after 20.1 seconds. Core cases protect rock and correctly restore overlapping effects. Separate production movement assertions show mud/shallows speed ordinary troops less and Tideborn more; ordinary pathfinding avoids deep water. Native same-choke comparisons and browser checkpoint continuations were not reached and are supplemental.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `live faction powers panel shapes mud terrain and restores it through real simulation expiry` | Real panel creates nonempty mud tiles, spends crystal and restores all modified grass cells after 20.1 seconds. |
| `live faction powers panel shapes shallows terrain and restores it through real simulation expiry` | Same real command/expiry path creates temporary shallows and restores modified cells. |
| `live faction powers panel shapes water terrain and restores it through real simulation expiry` | Same real command/expiry path creates temporary water and restores modified cells. |
| `Tideborn cross wet terrain faster than grass while ordinary troops slow down` | After one real second, each mud/shallows Tideborn distance exceeds its grass baseline, while ordinary Orc distance is lower than its grass baseline. |

## ID 30: Automata power networks

Original requirement: "connected structures share shields and power specialized defenses."

Recommend sufficient evidence for the original clause. A production HQ→relay→tower network enables an actual tower hit. Incoming damage consumes tower shields without HP loss, then draws the relay reserve when the tower shield is empty. Destroying the relay disconnects the tower and an otherwise ready tower stops firing. The mounted panel separately pays for a relay, completes construction and connects a tower. Independent headquarters/component and save cases support the same production graph; native paid relay rebuilding and browser histories are unrun supplemental checks.

| Exact passed assertion | Executed semantics |
| --- | --- |
| `faction mechanics through authoritative encounters a powered tower fires and shares real shield damage; a broken relay disconnects it` | Eight-tile HQ-relay-tower chain connects; enemy HP falls; hostile damage leaves tower HP equal and drains shields including relay reserve; broken relay disconnects and stops fire. |
| `live faction powers panel constructs the automata faction structure through selected workers` | Real panel builds and pays for relay; after 35 seconds completion connects tower and panel reports Power connected/Shield 80/80. |
| `faction mechanics through authoritative encounters power networks with separate headquarters cannot borrow an unrelated component shield` | Disconnected headquarters components retain distinct power roots. |

## Review inputs

The [facts](/tmp/ovf-faction21-30-original-clauses-consolidated-5on5wxwr/facts.final.json) contain all exact passed cases, per-case focused/full-only provenance, current requirements, 101 source fingerprints, raw packet/log measurements and qualifications. [Input measurements](/tmp/ovf-faction21-30-original-clauses-consolidated-5on5wxwr/inputs.final.json) preserve report and artifact hashes. The original detailed assessments remain unchanged.

- [IDs 21–22](/tmp/ovf-faction-id21-22-clause-review-20261001-ghemb2f2/assessment.md) and [facts](/tmp/ovf-faction-id21-22-clause-review-20261001-ghemb2f2/facts.json).
- [Final IDs 23–26 report fingerprints](/tmp/ovf-faction21-30-consolidated-cross-review-7qvpblzg/final-assessment-manifest.json), with the four reports; the older manifest is retained and its inner 23/24 hashes precede their final provenance additions.
- [IDs 27–30](/tmp/ovf-faction-original27-30-clause-review-20261001.md) and [facts](/tmp/ovf-faction-original27-30-clause-facts-20261001.json).
- [Captured-territory assessment](/tmp/ovf-faction-id28-clause-review-20261001.md).

The [independent review](/tmp/ovf-faction21-30-consolidated-cross-review-7qvpblzg/review.md) confirmed the exact passed records and source applicability, and its two requested corrections are applied. [Minimal future proof](/tmp/ovf-faction21-30-original-clauses-consolidated-5on5wxwr/minimal-proof-plan.md) describes one bounded production-command encounter for each remaining composition. They are plans, not executed evidence.

Feature status changes and artifact admission remain root’s responsibility. Earlier packet statements that kept all features pending remain historical whole-attempt outcome records; they are not extra gates for the original clauses in this assessment.
