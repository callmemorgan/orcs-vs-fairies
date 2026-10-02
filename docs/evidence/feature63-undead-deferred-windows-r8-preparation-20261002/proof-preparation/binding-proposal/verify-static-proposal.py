#!/usr/bin/env python3
from pathlib import Path
import ast
import hashlib
import json

base = Path(__file__).resolve().parent
expected_source_sha = "bbeb0bc68b2dd5cd24679f8ade43baa2403d748e9877a7e24bcf2c7fe1c1dc02"
manifest = json.loads((base / "manifest.json").read_bytes())
for row in manifest["artifacts"]:
    path = Path(row["path"])
    if path.parent != base and path.parent != base / "originals":
        raise RuntimeError("Artifact is outside this proposal")
    raw = path.read_bytes()
    if len(raw) != row["bytes"] or hashlib.sha256(raw).hexdigest() != row["sha256"] or path.stat().st_mode & 0o777 != row["mode"]:
        raise RuntimeError("Saved artifact differs: " + str(path))
source = (base / "originals/fresh-r7-bindings.py").read_bytes()
candidate = (base / "fresh-r8-bindings.py").read_bytes()
if hashlib.sha256(source).hexdigest() != expected_source_sha:
    raise RuntimeError("Reviewed source snapshot differs")
rows = json.loads((base / "substitutions.json").read_bytes())["substitutions"]
forward = source.decode()
for row in rows:
    if forward.count(row["old"]) != 1:
        raise RuntimeError("Forward count differs")
    forward = forward.replace(row["old"], row["new"], 1)
if forward.encode() != candidate:
    raise RuntimeError("Forward bytes differ")
reverse = candidate.decode()
for row in reversed(rows):
    if reverse.count(row["new"]) != 1:
        raise RuntimeError("Inverse count differs")
    reverse = reverse.replace(row["new"], row["old"], 1)
if reverse.encode() != source:
    raise RuntimeError("Inverse bytes differ")
ast.parse(source)
ast.parse(candidate)
print(json.dumps({"savedArtifactReadback": "PASS", "forwardBytes": "PASS", "inverseBytes": "PASS", "astParse": "PASS", "substitutionCount": len(rows), "sourceOrCandidateExecutedOrImported": False}, sort_keys=True))
