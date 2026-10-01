#!/usr/bin/env python3
"""File-only verification of hosted a144 retention at immutable commit 9a4921f."""

from __future__ import annotations

import hashlib
import json
import os
import stat
import subprocess
import sys
from pathlib import Path, PurePosixPath


REPO = Path("/home/morgana/Projects/orcs-vs-Fairies")
COMMIT = "9a4921fbcb16e59d89d409f1806fb7317285648d"
TREE = "9737385f0cfe8512863eb82c18ac16bb2017aab5"
PARENT = "1c064c46f8f775b508f03e3434e6263183db441f"
BASE = PurePosixPath("docs/evidence/hosted-only-retry-a144-static-readiness-20261001")
RETENTION_PATH = BASE / "root-retention.json"
EXPECTED_REVIEW_SHA256 = "4f5ca9b4239a9e74f01d0c0012d5b1aa2d8ee4744a41e30e2d6e817f02135242"
EXPECTED_HASHES_SHA256 = "82f1015375316f3c240c67b10a6c090bd9b7300a3aebe3386352ef0c3b8a9625"


def git(*args: str, text: bool = True):
    output = subprocess.run(
        ["git", "-C", str(REPO), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ).stdout
    return output.decode() if text else output


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_file_identity(path: Path) -> dict[str, object]:
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and not path.is_symlink(), f"regular external original {path}")
    digest = hashlib.sha256()
    with path.open("rb") as source:
        opened = os.fstat(source.fileno())
        require(opened.st_dev == before.st_dev and opened.st_ino == before.st_ino, f"source changed before read {path}")
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
        after = os.fstat(source.fileno())
    require(
        (opened.st_size, opened.st_mtime_ns, opened.st_ino, opened.st_dev)
        == (after.st_size, after.st_mtime_ns, after.st_ino, after.st_dev),
        f"source changed during read {path}",
    )
    return {
        "bytes": after.st_size,
        "sha256": digest.hexdigest(),
        "mode": f"0o{stat.S_IMODE(after.st_mode):03o}",
        "fileType": "regular",
        "isSymlink": False,
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def tree_entries(commit: str) -> dict[str, dict[str, str]]:
    raw = git("ls-tree", "-r", "-z", "--full-tree", commit, "--", str(BASE), text=False)
    result = {}
    for row in raw.split(b"\0"):
        if not row:
            continue
        metadata, raw_path = row.split(b"\t", 1)
        mode, kind, oid = metadata.decode().split()
        result[raw_path.decode()] = {"mode": mode, "kind": kind, "oid": oid}
    return result


def blob_bytes(oid: str) -> bytes:
    return git("cat-file", "blob", oid, text=False)


try:
    require(git("rev-parse", COMMIT).strip() == COMMIT, "commit resolution")
    require(git("rev-parse", f"{COMMIT}^{{tree}}").strip() == TREE, "commit tree")
    require(git("rev-parse", f"{COMMIT}^").strip() == PARENT, "commit parent")
    tree = tree_entries(COMMIT)
    retention_entry = tree[str(RETENTION_PATH)]
    retention_bytes = blob_bytes(retention_entry["oid"])
    retention = json.loads(retention_bytes)
    rows = retention["originalFiles"]
    require(retention["fileCount"] == len(rows) == 24, "retained file count")
    require(retention["bytes"] == sum(row["bytes"] for row in rows) == 477088, "retained byte count")
    require(retention["allCopiesByteEqual"] is True and retention["aliasesByteEqual"] is True, "retention equality claims")
    require(retention["runtimeHeld"] is True, "runtime held")
    require(retention["heavySlotOwner"] == "/root/combat_tactics", "heavy slot owner")
    require(len({row["source"] for row in rows}) == 24, "unique external originals")
    require(len({row["target"] for row in rows}) == 24, "unique retained targets")

    verified_rows = []
    git_payloads: dict[str, bytes] = {}
    for row in rows:
        relative = PurePosixPath(row["target"])
        require(not relative.is_absolute() and ".." not in relative.parts, f"safe target {relative}")
        target = str(BASE / relative)
        require(target in tree, f"target in immutable tree {target}")
        item = tree[target]
        require(item["kind"] == "blob" and item["mode"] == "100644", f"Git type/mode {target}")
        data = blob_bytes(item["oid"])
        git_payloads[target] = data
        require(len(data) == row["bytes"] and sha_bytes(data) == row["sha256"], f"Git blob identity {target}")
        source = Path(row["source"])
        source_identity = stable_file_identity(source)
        require(
            source_identity["bytes"] == row["bytes"]
            and source_identity["sha256"] == row["sha256"]
            and source_identity["mode"] == row["mode"] == "0o644",
            f"external original identity {source}",
        )
        git_oid = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        require(git_oid == item["oid"], f"Git object id {target}")
        verified_rows.append({
            "source": str(source),
            "target": target,
            "bytes": row["bytes"],
            "sha256": row["sha256"],
            "mode": row["mode"],
            "gitBlob": item["oid"],
            "externalEqualsCommitBlob": True,
        })

    review = next(row for row in rows if row["target"].endswith("static-admission-review-gpt6-sol.md"))
    hashes = next(row for row in rows if row["target"].endswith("static-admission-review-hashes-gpt6-sol.json"))
    require(review["sha256"] == EXPECTED_REVIEW_SHA256, "final review SHA-256")
    require(hashes["sha256"] == EXPECTED_HASHES_SHA256, "final hashes SHA-256")

    imported_manifest_target = str(BASE / "import-plan/import-manifest.json")
    imported_manifest = json.loads(git_payloads[imported_manifest_target])
    aliases = imported_manifest["deduplicatedAliases"]
    require(len(aliases) == 6, "alias count")
    verified_aliases = []
    for alias in aliases:
        alias_path = Path(alias["sourcePath"])
        canonical_source = Path(alias["canonicalImportedSourcePath"])
        alias_identity = stable_file_identity(alias_path)
        canonical_identity = stable_file_identity(canonical_source)
        canonical_target = alias["canonicalDestinationRelativePath"]
        require(canonical_target in tree, f"alias canonical Git target {canonical_target}")
        canonical_blob = blob_bytes(tree[canonical_target]["oid"])
        require(tree[canonical_target]["mode"] == "100644", f"alias canonical mode {canonical_target}")
        for identity in (alias_identity, canonical_identity):
            require(identity["bytes"] == alias["bytes"], f"alias bytes {alias_path}")
            require(identity["sha256"] == alias["sha256"], f"alias hash {alias_path}")
            require(identity["mode"] == alias["mode"] == "0o644", f"alias mode {alias_path}")
        require(len(canonical_blob) == alias["bytes"] and sha_bytes(canonical_blob) == alias["sha256"], f"alias Git bytes {canonical_target}")
        verified_aliases.append({
            "source": str(alias_path),
            "canonicalExternalSource": str(canonical_source),
            "canonicalTarget": canonical_target,
            "bytes": alias["bytes"],
            "sha256": alias["sha256"],
            "mode": alias["mode"],
            "gitBlob": tree[canonical_target]["oid"],
            "allThreeByteIdentitiesEqual": True,
        })

    external_rows = retention["externalReferencesStatOnly"]
    manifest_external = {row["path"]: row for row in imported_manifest["externalReferences"]}
    require(len(external_rows) == len(manifest_external) == 8, "external reference count")
    stat_only = []
    for row in external_rows:
        path = Path(row["path"])
        observed = path.lstat()
        require(stat.S_ISREG(observed.st_mode) and not path.is_symlink(), f"external reference type {path}")
        require(observed.st_size == row["bytes"], f"external reference bytes {path}")
        require(row["path"] in manifest_external and manifest_external[row["path"]]["bytes"] == row["bytes"], f"external reference manifest {path}")
        stat_only.append({
            "path": str(path),
            "bytes": observed.st_size,
            "fileType": "regular",
            "isSymlink": False,
            "contentOpened": False,
            "expectedSha256FromRetainedAdmission": manifest_external[row["path"]]["sha256"],
        })
    sqlite = next(row for row in stat_only if row["path"].endswith("/server.sqlite"))
    require(sqlite["bytes"] == 378163200 and sqlite["contentOpened"] is False, "SQLite stat-only preservation")

    changed = [line for line in git("diff-tree", "--no-commit-id", "--name-only", "-r", COMMIT).splitlines() if line]
    expected_payload = {str(BASE / PurePosixPath(row["target"])) for row in rows}
    expected_changed = expected_payload | {str(BASE / "root-README.md"), str(RETENTION_PATH), "docs/features/decisions.tsv"}
    require(set(changed) == expected_changed and len(changed) == 27, "exact commit path scope")
    require(not any(path.startswith(("src/", "public/", "tests/", "scripts/")) for path in changed), "product or proof source changed")
    decision_diff = git("diff", f"{COMMIT}^", COMMIT, "--", "docs/features/decisions.tsv")
    added_decisions = [line[1:] for line in decision_diff.splitlines() if line.startswith("+") and not line.startswith("+++")]
    require(len(added_decisions) == 1, "decision row count")
    require("69 verified / 31 in progress" in added_decisions[0] and "runtime held" in added_decisions[0], "no feature-status change")

    self_path = Path(__file__).resolve()
    checker_identity = stable_file_identity(self_path)
    receipt = {
        "format": "ovf-hosted-only-retry-a144-exact-commit-retention-verification",
        "formatVersion": 1,
        "status": "passed",
        "reviewer": {"harness": "Codex", "model": "GPT-6 Sol", "agent": "/root/trail_review"},
        "exactCommit": COMMIT,
        "commitTree": TREE,
        "parentCommit": PARENT,
        "retention": {
            "path": str(RETENTION_PATH),
            "gitBlob": retention_entry["oid"],
            "bytes": len(retention_bytes),
            "sha256": sha_bytes(retention_bytes),
        },
        "verification": {
            "originalRecords": len(verified_rows),
            "originalBytes": sum(row["bytes"] for row in verified_rows),
            "allExternalOriginalsEqualImmutableCommitBlobs": True,
            "allGitModes": "100644",
            "aliases": len(verified_aliases),
            "allAliasesEqualCanonicalExternalAndCommitBytes": True,
            "externalReferencesStatOnly": len(stat_only),
            "externalReferenceContentsOpened": 0,
            "changedPathsInCommit": len(changed),
            "productOrProofSourcePathsChanged": 0,
            "addedDecisionRows": 1,
            "featureCountBeforeAndAfter": "69 verified / 31 in progress",
            "runtimeHeld": True,
        },
        "method": {
            "suppliedImportVerifierExecuted": False,
            "reason": "The supplied verifier hashes all external references, including the preserved 378,163,200-byte SQLite file. This verification honors the bounded no-open rule for those eight paths.",
            "replacementChecks": "SHA-256, size, mode, regular-file type, and no-symlink checks for 24 external originals and six aliases; immutable readback of 24 Git blobs; lstat-only type and size checks for eight external references.",
            "builds": 0,
            "tests": 0,
            "servers": 0,
            "browserLaunches": 0,
            "simulations": 0,
            "projectModuleExecutions": 0,
            "checkoutMoves": 0,
            "repositoryWrites": 0,
        },
        "scope": {
            "featureStatusChanged": False,
            "runtimeResultClaimed": False,
            "sourcePin": retention["sourcePin"],
            "productFreeze": retention["productFreeze"],
            "qualification": retention["qualification"],
        },
        "records": verified_rows,
        "aliases": verified_aliases,
        "externalReferences": stat_only,
        "commitChangedPaths": changed,
        "decisionRow": added_decisions[0],
        "checker": {"path": str(self_path), **checker_identity},
    }
    print(json.dumps(receipt, indent=2, sort_keys=True))
except Exception as error:
    print(json.dumps({
        "format": "ovf-hosted-only-retry-a144-exact-commit-retention-verification",
        "status": "failed",
        "exactCommit": COMMIT,
        "reviewer": {"harness": "Codex", "model": "GPT-6 Sol", "agent": "/root/trail_review"},
        "error": f"{type(error).__name__}: {error}",
    }, indent=2, sort_keys=True))
    sys.exit(1)
