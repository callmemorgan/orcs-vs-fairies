#!/usr/bin/env python3
"""Verify retained bytes, committed archive bytes and pinned producer inputs."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

proof = Path(__file__).resolve().parent
root = proof.parents[2]
digest = lambda value: hashlib.sha256(value).hexdigest()

def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)

def document(path):
    return json.loads((proof / path).read_text())

manifest = {}
for line in (proof / "artifact-hashes.sha256").read_text().splitlines():
    expected, name = line.split("  ", 1)
    assert name not in manifest, f"Duplicate artifact: {name}"
    manifest[name] = expected
    assert digest((proof / name).read_bytes()) == expected, f"Artifact changed: {name}"
files = {str(path.relative_to(proof)) for path in proof.rglob("*") if path.is_file()}
assert files == set(manifest) | {"artifact-hashes.sha256"}, "Archive file inventory changed"
if len(sys.argv) > 1:
    commit = git("rev-parse", f"{sys.argv[1]}^{{commit}}").decode().strip()
    relative = proof.relative_to(root)
    listing = git("ls-tree", "-r", "--name-only", commit, "--", str(relative)).decode().splitlines()
    assert set(listing) == {str(relative / name) for name in files}, "Committed archive inventory differs"
    for name in files:
        assert (proof / name).read_bytes() == git("show", f"{commit}:{relative / name}"), f"Committed archive differs: {name}"

for row in document("retained-paths.json")["artifacts"]:
    data = (proof / row["retainedPath"]).read_bytes()
    assert len(data) == row["bytes"] and digest(data) == row["sha256"], row["retainedPath"]

runner = document("runner/fault-probes.json")
assert runner["completed"] and len(runner["checks"]) == 15
assert digest((proof / "runner/executed-runner.mjs").read_bytes()) == runner["runnerSha256"]
assert (proof / "runner/executed-runner.mjs").read_bytes() == git("show", "0644aa7e2a3ca891cf3a3f65a198b838a9ab6154:scripts/verify_combined_combat.mjs")
receipt = document("runner/generation-receipt.json")
for field, name in [("producerSha256", "probe-fixture.ts"), ("bundleSha256", "save4-probe-fixture.mjs"), ("metafileSha256", "save4-probe-metafile.json"), ("fixtureSha256", "save4-probe-session.json")]:
    assert digest((proof / "runner" / name).read_bytes()) == receipt[field]
assert receipt["build"]["exitCode"] == receipt["run"]["exitCode"] == 0
for row in receipt["inputs"]:
    data = git("show", f'{receipt["sourceRef"]}:{row["path"]}') if row["committed"] else (proof / "runner/probe-fixture.ts").read_bytes()
    assert len(data) == row["bytes"] and digest(data) == row["sha256"], row["path"]

commands = document("projection/commands.json")
assert len(commands["receipts"]) == 7 and all(row["exitCode"] == 0 for row in commands["receipts"])
receipt = document("projection/generation-receipt.json")
for field, name in [("producerSha256", "combat-projection-fixture.ts"), ("bundleSha256", "combat-projection-fixture.mjs"), ("metafileSha256", "combat-projection-fixture.mjs.metafile.json")]:
    assert digest((proof / "projection/work" / name).read_bytes()) == receipt[field]
for row in receipt["inputs"]:
    data = git("show", f'{receipt["sourceRef"]}:{row["path"]}') if row["committed"] else (proof / "projection" / row["path"]).read_bytes()
    assert len(data) == row["bytes"] and digest(data) == row["sha256"], row["path"]
for row in receipt["outputs"]:
    data = (proof / "projection/work" / row["path"]).read_bytes()
    assert len(data) == row["bytes"] and digest(data) == row["sha256"], row["path"]

fault = document("projection/work/projection-fault-proof-3f96300-retained/result.json")
assert fault["passed"] == len(fault["records"]) == 27 and all(row["passed"] for row in fault["records"])
for report in (proof / "projection/work").rglob("projection.json"):
    value = json.loads(report.read_text())
    assert value["native"]["completeEnvelopeRoundtrip"] and value["native"]["unprojectedNativeReplayEnvelope"]
    assert value["projected"]["completeEnvelopeParityAfterControllerProjection"]
    for row in value["artifacts"]:
        data = (report.parent / row["path"]).read_bytes()
        assert len(data) == row["bytes"] and digest(data) == row["sha256"], row["path"]
    assert (report.parent / "proof-source.ts").read_bytes() == git("show", f'{value["sourcePin"]}:scripts/prepare_combat_cli_projection.ts')
    source = json.loads((report.parent / "source-manifest.json").read_text())
    for row in source["files"]:
        data = git("show", f'{source["sourcePin"]}:{row["path"]}')
        assert digest(data) == row["sha256"], row["path"]
print(json.dumps({"archiveFiles": len(files), "retainedCopies": len(document("retained-paths.json")["artifacts"]), "runnerCases": 15, "projectionCases": 27, "sourceProvenanceVerified": True}))
