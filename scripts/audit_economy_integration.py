#!/usr/bin/env python3
"""Check retained economy integration evidence against its frozen Git source."""
import argparse
import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.check_output(["git", *args])


def load(path):
    return json.loads(path.read_text())


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("evidence", nargs="?", default="docs/evidence/economy-scenario-integration-20261001")
parser.add_argument("--write", action="store_true", help="Refresh generated source, artifact and comparison manifests.")
args = parser.parse_args()
root = Path(git("rev-parse", "--show-toplevel").decode().strip())
evidence = root / args.evidence
manifest = load(evidence / "integration.json")
trail = root / manifest["decisionTrailSnapshot"]["path"]
assert sha(trail.read_bytes()) == manifest["decisionTrailSnapshot"]["sha256"]
trail_rows = list(csv.reader(trail.read_text().splitlines(), delimiter="\t"))
assert all(len(row) == 6 for row in trail_rows)
assert len(trail_rows) - 1 == manifest["decisionTrailSnapshot"]["rows"]
commit = manifest["productionSourceCommit"]
paths = sorted(p for p in git("ls-tree", "-r", "--name-only", commit, "src").decode().splitlines() if p.endswith((".ts", ".css")))
fingerprint = hashlib.sha256()
source_files = []
for path in paths:
    data = git("show", f"{commit}:{path}")
    fingerprint.update(path.removeprefix("src/").encode())
    fingerprint.update(data)
    source_files.append({"path": path, "sha256": sha(data), "bytes": len(data)})
source_hash = fingerprint.hexdigest()
assert source_hash == manifest["sourceFingerprint"]
current_paths = sorted(p for p in (root / "src").rglob("*") if p.is_file() and p.suffix in {".ts", ".css"})
current = hashlib.sha256()
for path in current_paths:
    current.update(path.relative_to(root / "src").as_posix().encode())
    current.update(path.read_bytes())
current_matches = current.hexdigest() == source_hash

proof = load(evidence / "browser/proof.json")
report = load(evidence / "browser/report.json")
session = load(evidence / "browser/commanded-session.json")
snapshot = load(evidence / "browser/completed-state.json")
modal = load(evidence / "modal-browser/results.json")
assert proof["buildId"] == report["versions"]["buildId"] == source_hash
assert len(proof["evidence"]) == 25 and all(value is True for value in proof["evidence"].values())
assert proof["errors"] == modal["errors"] == []
assert session == report["session"]
assert session["game"]["version"] == report["versions"]["save"] == manifest["saveVersion"] == 3
assert session["replay"]["simulationRevision"] == report["versions"]["simulationRevision"] == manifest["simulationRevision"] == "3.2.0"
tick = session["game"]["state"]["tick"]
assert session["replay"]["finalTick"] == tick
assert modal["passed"] is True and len(modal["checks"]) == 12
assert modal["productionSourceCommit"] == commit
assert modal["sourceCommit"] == manifest["modalVerifierCommit"]
for check in modal["checks"]:
    assert check["value"] is not False
    if "Shared launcher hit tests" in check["name"]:
        value = check["value"]
        assert value["worldTop"] >= value["toolbar"]["bottom"] + 7
        assert all(button["hit"] is True for button in value["buttons"])
focused = (evidence / "focused-tests.log").read_text()
assert re.search(r"Test Files\s+47 passed \(47\)", focused)
assert re.search(r"Tests\s+872 passed \(872\)", focused)
assert "built in" in (evidence / "browser-build.log").read_text()
for name in ["cli", "server", "tournament"]:
    assert "Done in" in (evidence / f"{name}-build.log").read_text()
source_manifest = {"productionSourceCommit": commit, "algorithm": "SHA-256 of sorted src-relative .ts/.css paths followed by each file's bytes", "sourceFingerprint": source_hash, "fileCount": len(source_files), "files": source_files}
canonical = json.dumps(session, sort_keys=True, separators=(",", ":")).encode()
comparison = {"productionSourceCommit": commit, "sourceFingerprint": source_hash, "sourceFiles": len(source_files), "decisionTrailSnapshotRows": len(trail_rows) - 1, "economyBrowserChecks": 25, "modalBrowserChecks": 12, "pageErrors": [], "fullSaveEqualsReportSession": True, "canonicalSessionSha256": sha(canonical), "savedTick": tick, "reportTick": report["session"]["game"]["state"]["tick"], "replayFinalTick": session["replay"]["finalTick"], "preExportSnapshotTick": snapshot["tick"], "focusedTestFiles": 47, "focusedTests": 872, "buildsPassed": ["browser", "cli", "server", "tournament"], "saveVersion": 3, "simulationRevision": "3.2.0"}
if args.write:
    assert current_matches, "Only refresh manifests while the current production source matches the frozen source."
    write(evidence / "source-manifest.json", source_manifest)
    write(evidence / "artifact-verification.json", comparison)
else:
    assert load(evidence / "source-manifest.json") == source_manifest
    assert load(evidence / "artifact-verification.json") == comparison
excluded = {"artifact-sha256.json"}
artifacts = {path.relative_to(root).as_posix(): sha(path.read_bytes()) for path in sorted(evidence.rglob("*")) if path.is_file() and path.name not in excluded}
artifacts["scripts/audit_economy_integration.py"] = sha(Path(__file__).read_bytes())
for path in manifest["verificationScripts"]:
    artifacts[path] = sha((root / path).read_bytes())
if args.write:
    write(evidence / "artifact-sha256.json", artifacts)
else:
    assert load(evidence / "artifact-sha256.json") == artifacts, "A retained artifact or verifier has changed."
print(json.dumps({**comparison, "hashedArtifacts": len(artifacts), "currentSourceMatchesFrozenSource": current_matches}, indent=2))
