#!/usr/bin/env python3
"""Rerun the retained diagnostic on its original production source."""
import subprocess
import tempfile
from pathlib import Path

PRODUCTION_REF = "5c6a02219b723102124f9775040a78b205a52a7d"
proof = Path(__file__).resolve().parent
root = proof.parents[2]
dependencies = (root / "node_modules").resolve()
assert (dependencies / "vitest/vitest.mjs").is_file(), "Install repository dependencies first."

with tempfile.TemporaryDirectory(prefix="ovf-emergency-attribution-") as directory:
    scratch = Path(directory)
    names = subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", PRODUCTION_REF, "--", "src", "package.json", "tsconfig.json", "vitest.config.ts"],
        cwd=root, text=True,
    ).splitlines()
    for name in names:
        target = scratch / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(subprocess.check_output(["git", "show", f"{PRODUCTION_REF}:{name}"], cwd=root))
    (scratch / "node_modules").symlink_to(dependencies, target_is_directory=True)
    test = scratch / "tests/emergency-variants.test.ts"
    test.parent.mkdir()
    test.write_bytes((proof / "emergency-variants.test.ts.txt").read_bytes())
    result = subprocess.run(
        ["node", str(dependencies / "vitest/vitest.mjs"), "run", "tests/emergency-variants.test.ts", "--reporter=dot", "--maxWorkers=1"],
        cwd=scratch,
    )
    raise SystemExit(result.returncode)
