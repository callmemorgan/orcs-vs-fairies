"""Verify retained bytes and optional live inputs; execute no gameplay code."""
import hashlib
import json
import pathlib
import stat
import subprocess
import sys

ARCHIVE = pathlib.Path(__file__).resolve().parent
PROOF = "287583c6bf90b0df76475f8541e6694df1d5f901"
PRODUCT = "c86e273c70738f144a00fe75f5ecf39e7fa324d8"
REPAIR = "0b697f781fb718752a554c6884b352b995311c06"
EXCLUDED = {"artifact-manifest.json", "retention-audit.json"}


def fingerprint(path):
    assert stat.S_ISREG(path.lstat().st_mode), f"Not a regular file: {path}"
    data = path.read_bytes()
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def load(path):
    return json.loads(path.read_bytes())


def verify_files(base, files):
    for name, expected in files.items():
        relative = pathlib.PurePosixPath(name)
        assert not relative.is_absolute() and ".." not in relative.parts, name
        actual = fingerprint(base / name)
        assert all(actual[key] == expected[key] for key in actual), name


manifest = load(ARCHIVE / "artifact-manifest.json")
actual_paths = set()
for path in ARCHIVE.rglob("*"):
    assert not path.is_symlink(), f"Unexpected symlink: {path}"
    if path.is_file():
        actual_paths.add(path.relative_to(ARCHIVE).as_posix())
assert actual_paths - EXCLUDED == set(manifest["files"]), "Archive inventory changed"
verify_files(ARCHIVE, manifest["files"])

run = ARCHIVE / "run"
original = load(run / "first-failure-artifact-manifest.json")
assert original["actualProofCommit"] == PROOF
assert original["productSourceCommit"] == PRODUCT
assert len(original["files"]) == 182
verify_files(run, original["files"])
run_paths = {p.relative_to(run).as_posix() for p in run.rglob("*") if p.is_file()}
assert len(run_paths) == 205
assert len(run_paths - set(original["files"])) == 23
browser = load(run / "browser/browser-native-acceptance.json")
assert browser["completed"] is False
assert browser["source"]["commit"] == PROOF
assert browser["source"]["saveVersion"] == 4
assert browser["source"]["simulationRevision"] == "4.0.1"
assert browser["source"]["expectedBuildId"] == "af4b40282bb086e0dccf5aad4e8c38819b2d2eb80370fb749e728a9f33cdb87a"
assert len(browser["checks"]) == 46 and len(browser["downloads"]) == 79
assert not browser["groups"]
assert "Timeout 15000ms exceeded" in browser["failure"]["message"]
verify_files(run / "browser", browser["downloads"])
assert load(run / "logs/06-browser.receipt.json")["exitCode"] == 1
screenshots = load(run / "screenshot-qa/manifest.json")["screenshots"]
assert len(screenshots) == 22
for item in screenshots:
    assert fingerprint(run / "browser" / item["file"])["sha256"] == item["sha256"]
bridge = load(run / "rock-proof-only-retry-product-bridge.json")
assert bridge["proofRetryCommit"] == REPAIR
assert bridge["productSourceCommit"] == PRODUCT
assert bridge["productCount"] == 567 and bridge["runtimeRetryExecuted"] is False

source_check = None
if len(sys.argv) > 1:
    root = pathlib.Path(sys.argv[1]).resolve(strict=True)
    footprint = load(ARCHIVE / "source-footprint-0b.json")
    assert footprint["pin"] == REPAIR
    raw_tree = subprocess.check_output(["git", "ls-tree", "-rz", "--full-tree", REPAIR], cwd=root)
    tree = {}
    for record in raw_tree.split(b"\0"):
        if not record:
            continue
        metadata, path = record.split(b"\t", 1)
        mode, kind, blob = metadata.decode().split()
        tree[path.decode()] = {"mode": mode, "gitBlob": blob, "kind": kind}
    selected = footprint["files"]
    product_paths = {p for p in tree if p.startswith(("src/", "public/"))} | set(footprint["productRootPaths"])
    proof_paths = {p for p in tree if p.startswith("scripts/acceptance/")}
    assert product_paths == set(footprint["productPaths"])
    assert proof_paths == set(footprint["proofPaths"])
    assert set(selected) == product_paths | proof_paths
    live_inventory = set()
    for directory in ("src", "public", "scripts/acceptance"):
        for path in root.joinpath(directory).rglob("*"):
            assert not path.is_symlink(), f"Unexpected input symlink: {path}"
            if path.is_file():
                live_inventory.add(path.relative_to(root).as_posix())
    assert live_inventory == (product_paths - set(footprint["productRootPaths"])) | proof_paths
    verify_files(root, selected)
    for name, item in selected.items():
        assert tree[name]["kind"] == "blob"
        assert tree[name]["mode"] == item["mode"] and tree[name]["gitBlob"] == item["gitBlob"], name
        live_mode = "100755" if root.joinpath(name).stat().st_mode & 0o111 else "100644"
        assert live_mode == item["mode"], name
        raw = root.joinpath(name).read_bytes()
        git_hash = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
        assert git_hash == item["gitBlob"], name
    source_check = {"root": str(root), "pin": REPAIR, "productInputs": len(product_paths), "proofInputs": len(proof_paths), "allLiveBytesAndModesEqual": True}

print(json.dumps({"schema": 1, "archive": str(ARCHIVE), "manifestSha256": fingerprint(ARCHIVE / "artifact-manifest.json")["sha256"], "manifestFilesVerified": len(manifest["files"]), "originalRunFilesVerified": 182, "copiedRunFilesVerified": 205, "laterRunArtifacts": 23, "nativeDownloadsVerified": 79, "screenshotsVerified": 22, "runProofCommit": PROOF, "runProductSourceCommit": PRODUCT, "laterRepairCommit": REPAIR, "runCompleted": False, "nativeChecks": 46, "browserExitCode": 1, "completeGroups": 0, "gameplayExecutedByThisAudit": False, "liveSourceCheck": source_check}, indent=2))
