# Scenario binding review reproductions

The original self-contained `.mjs` programs were bundled from the uncommitted scenario binding above `5645300bad7ba126bf046759007633ee88df1d66`, before the observer isolation and save dictionary budget fixes. Their original stdout, stderr and exit status are preserved beside them. The `.ts` files reproduce the original probe source; imports resolve from the repository working directory when esbuild reads the source through stdin.

The original observer probe proves that a listener exception escaped after command mutation and omitted the command from canonical history. The original label-limit probe proves that a validated 129-actor scenario could export its scenario checkpoint while generic save and recorder construction failed.

The current programs use those same probe sources bundled after the fixes. Their outputs show the changed behavior. The expected caught observer exception is still reported on stderr.

This folder is a focused review record, not campaign completion evidence. No repository files were edited by the reviewer.
