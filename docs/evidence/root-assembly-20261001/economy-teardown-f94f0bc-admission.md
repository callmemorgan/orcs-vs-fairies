Admit `f94f0bc410f27c416750cd63ea73393d049b65e1` for the authorized proof teardown repair. Its parent is `db36593f816a57e29220d760de14455cec969f0b`. No remaining blocker was found in the reviewed diff.

The four-file scope is:

- [scripts/economy/browser-proof.mjs](/home/morgana/.codex/worktrees/economy-final-db36593/orcs-vs-Fairies/scripts/economy/browser-proof.mjs)
- [scripts/verify_economy_combined_ui.mjs](/home/morgana/.codex/worktrees/economy-final-db36593/orcs-vs-Fairies/scripts/verify_economy_combined_ui.mjs)
- [scripts/verify_economy_ui.mjs](/home/morgana/.codex/worktrees/economy-final-db36593/orcs-vs-Fairies/scripts/verify_economy_ui.mjs)
- [scripts/verify_settlement_runtime_ui.mjs](/home/morgana/.codex/worktrees/economy-final-db36593/orcs-vs-Fairies/scripts/verify_settlement_runtime_ui.mjs)

The committed helper SHA-256 is `261e69e4951bc4e5f5e28f00ffddb8b1034f311f10d7203c357bb30e7b7b08f5`. Both retained probe receipts identify the admitted commit and this helper hash.

The teardown change removes both proof-added response listeners synchronously before draining already observed body tasks. All three drivers drain before closing the browser. The observation record contains its start, cutoff, task count, timeout and completion or error. External response listeners remain attached, and a separate status listener preserves HTTP-error collection through close. Observed body failures remain errors. An incomplete drain makes finalization write failed records and manifests, then throw.

The five-case Chromium 151 fault probe reproduces the original early-close failure and verifies delayed body hashing before close, no new proof tasks from post-cutoff responses, retention of observed body failures, bounded timeout recording with cleanup, and retention of a late HTTP 503. All expected assertions passed. Receipt: [/tmp/ovf-economy-teardown-probe.JxBWnZ/at-commit/result.json](/tmp/ovf-economy-teardown-probe.JxBWnZ/at-commit/result.json); SHA-256 `ec1a4025692cf58b1269b39c0e41c173ad1220d394397ffaebcbe91493ff79a6`. Run log: [/tmp/ovf-economy-teardown-probe.JxBWnZ/at-commit/run.log](/tmp/ovf-economy-teardown-probe.JxBWnZ/at-commit/run.log); SHA-256 `c6637339e10fcb082a14d06726acca4f963d96a5aed358851f8c42cb6739769b`.

The eighteen-case classification rerun passed all expected acceptance and rejection assertions at the same commit. It retains unknown executable rejection, API metadata separation, redirect handling and prepared asset byte checks. Receipt: [/tmp/ovf-economy-teardown-probe.JxBWnZ/classification-at-commit/result.json](/tmp/ovf-economy-teardown-probe.JxBWnZ/classification-at-commit/result.json); SHA-256 `a6bf1e7f74aecff0ed76b1628d27bd77e50c627a1d9c0e8f1e3a230252edcfc2`. Run log: [/tmp/ovf-economy-teardown-probe.JxBWnZ/classification-at-commit/run.log](/tmp/ovf-economy-teardown-probe.JxBWnZ/classification-at-commit/run.log); SHA-256 `1b1116eab9a0360ffd34fc32f882752d57cefe1638bd621971bcd3a717e081c0`.

The diff preserves the 25 economy, 12 modal and eight settlement check guards, native full-session/full-game comparisons, and prepared source/module/build/served-byte checks. This review does not declare a new native rerun or service-worker coverage.

The reviewer inspected source, the commit diff, probe code and retained artifacts. Source remained read-only. The reviewer ran no browser, build or replay and performed no new testing. Only this Markdown review and its JSON companion were written.
