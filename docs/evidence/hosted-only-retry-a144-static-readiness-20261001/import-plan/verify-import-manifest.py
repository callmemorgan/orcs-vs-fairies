#!/usr/bin/env python3
"""Verify the bounded hosted a144 import manifest without copying payloads."""

from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
MANIFEST_PATH = HERE / "import-manifest.json"
ROOT = Path("/home/morgana/Projects/orcs-vs-Fairies")
EXPECTED_DESTINATION = ROOT / "docs/evidence/hosted-only-retry-a144-static-readiness-20261001"
EXPECTED_REVIEW_SHA256 = "4f5ca9b4239a9e74f01d0c0012d5b1aa2d8ee4744a41e30e2d6e817f02135242"
EXPECTED_HASHES_SHA256 = "82f1015375316f3c240c67b10a6c090bd9b7300a3aebe3386352ef0c3b8a9625"


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


post_import = sys.argv[1:] == ["--post-import"]
require(post_import or sys.argv[1:] == [], "usage: verify-import-manifest.py [--post-import]")
manifest = json.loads(MANIFEST_PATH.read_bytes())
entries = manifest["entries"]
require(manifest["destinationRoot"] == str(EXPECTED_DESTINATION), "destination root")
require(manifest["bounds"]["importFileCount"] == len(entries) == 20, "entry count")
require(manifest["bounds"]["importBytes"] == sum(row["bytes"] for row in entries) == 439321, "entry bytes")
require(manifest["bounds"]["productFilesCopied"] == 0, "product file copies")
require(len({row["sourcePath"] for row in entries}) == len(entries), "duplicate source")
require(len({row["destinationPath"] for row in entries}) == len(entries), "destination collision")

observed = {}
for row in entries:
    source = Path(row["sourcePath"])
    destination = Path(row["destinationPath"])
    source_stat = source.lstat()
    require(stat.S_ISREG(source_stat.st_mode) and not source.is_symlink(), f"source type {source}")
    require(f"0o{stat.S_IMODE(source_stat.st_mode):03o}" == row["mode"], f"source mode {source}")
    require(source_stat.st_size == row["bytes"], f"source size {source}")
    require(sha_file(source) == row["sha256"], f"source hash {source}")
    require(destination.is_relative_to(EXPECTED_DESTINATION), f"destination escape {destination}")
    require(row["destinationRelativePath"] == str(destination.relative_to(ROOT)), f"relative destination {destination}")
    if post_import:
        target_stat = destination.lstat()
        require(stat.S_ISREG(target_stat.st_mode) and not destination.is_symlink(), f"destination type {destination}")
        require(f"0o{stat.S_IMODE(target_stat.st_mode):03o}" == row["mode"], f"destination mode {destination}")
        require(target_stat.st_size == row["bytes"], f"destination size {destination}")
        require(sha_file(destination) == row["sha256"], f"destination hash {destination}")
    else:
        require(not os.path.lexists(destination), f"destination exists {destination}")
    observed[source.name] = row["sha256"]

for alias in manifest["deduplicatedAliases"]:
    source = Path(alias["sourcePath"])
    canonical = Path(alias["canonicalImportedSourcePath"])
    for path in (source, canonical):
        path_stat = path.lstat()
        require(stat.S_ISREG(path_stat.st_mode) and not path.is_symlink(), f"alias type {path}")
    require(source.stat().st_size == canonical.stat().st_size == alias["bytes"], f"alias size {source}")
    require(sha_file(source) == sha_file(canonical) == alias["sha256"], f"alias hash {source}")
    require(f"0o{stat.S_IMODE(source.stat().st_mode):03o}" == alias["mode"], f"alias mode {source}")

for reference in manifest["externalReferences"]:
    path = Path(reference["path"])
    path_stat = path.lstat()
    require(stat.S_ISREG(path_stat.st_mode) and not path.is_symlink(), f"external type {path}")
    require(path_stat.st_size == reference["bytes"], f"external size {path}")
    require(sha_file(path) == reference["sha256"], f"external hash {path}")

review = next(row for row in entries if row["sourcePath"].endswith("static-admission-review-gpt6-sol.md"))
hashes = next(row for row in entries if row["sourcePath"].endswith("static-admission-review-hashes-gpt6-sol.json"))
require(review["sha256"] == EXPECTED_REVIEW_SHA256, "final review identity")
require(hashes["sha256"] == EXPECTED_HASHES_SHA256, "final hashes identity")
hash_manifest = json.loads(Path(hashes["sourcePath"]).read_bytes())
for record in hash_manifest["files"].values():
    path = Path(record["path"])
    require(path.stat().st_size == record["bytes"] and sha_file(path) == record["sha256"], f"final artifact hashes {path}")

print(json.dumps({
    "status": "passed",
    "mode": "post-import" if post_import else "pre-import",
    "manifest": str(MANIFEST_PATH),
    "destinationRoot": str(EXPECTED_DESTINATION),
    "importFileCount": len(entries),
    "importBytes": sum(row["bytes"] for row in entries),
    "deduplicatedAliasPaths": len(manifest["deduplicatedAliases"]),
    "externalReferences": len(manifest["externalReferences"]),
    "productFilesCopied": 0,
    "symlinksAccepted": 0,
    "finalReviewSha256": review["sha256"],
    "finalHashesSha256": hashes["sha256"],
}, indent=2, sort_keys=True))
