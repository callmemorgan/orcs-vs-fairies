"""Bind released product inputs to original admitted proof; no game execution."""
import datetime
import hashlib
import json
import pathlib
import re
import stat
import subprocess
import sys

PROOF = "0b697f781fb718752a554c6884b352b995311c06"
CHANGE = "c074cc5e610fc128d7b6ac894a61258d418463d4"
BASELINE_SHA256 = "f9d5fada4c3eb7572576370dec34c7cdf67ec75bce7ff620bb3c7e8fe78f653d"
SUPPLEMENTAL_CONFIG = "editor.html"


def require(condition, message="Source applicability check failed"):
    if not condition:
        raise SystemExit(message)


require(len(sys.argv) == 6, "Use DOCS_GIT_ROOT DOCS_FULL_PIN PRODUCT_ROOT PRODUCT_FULL_PIN NEW_EXTERNAL_RECEIPT")
docs_root = pathlib.Path(sys.argv[1]).resolve(strict=True)
docs_pin = sys.argv[2]
root = pathlib.Path(sys.argv[3]).resolve(strict=True)
pin = sys.argv[4]
require(re.fullmatch(r"[0-9a-f]{40}", docs_pin), "Full immutable checker/docs pin required")
require(re.fullmatch(r"[0-9a-f]{40}", pin), "Full immutable product pin required")
require(pin == CHANGE, "Current runtime product/proof freeze is c074cc5e610fc128d7b6ac894a61258d418463d4")
output = pathlib.Path(sys.argv[5])
output = output.parent.resolve(strict=True) / output.name
require(not output.is_relative_to(root) and not output.is_relative_to(docs_root), "Receipt belongs outside both source roots")
require(not output.exists() and (not output.is_symlink()), 'Use a fresh receipt')


def git(*args):
    return subprocess.check_output(["git", "--no-replace-objects", *args], cwd=root)


def docs_git(*args):
    return subprocess.check_output(["git", "--no-replace-objects", *args], cwd=docs_root)


def tree(ref):
    result = {}
    for record in git("ls-tree", "-rz", "--full-tree", ref).split(b"\0"):
        if record:
            metadata, name = record.split(b"\t", 1)
            mode, kind, blob = metadata.decode().split()
            result[name.decode()] = {"mode": mode, "kind": kind, "gitBlob": blob}
    return result


require(git('rev-parse', 'HEAD').decode().strip() == pin, 'Checkout HEAD equals released pin')
relative_self = "docs/evidence/native-combat-next-retry-preparation-0b-20261001/verify-product-applicability.py"
require(docs_git("rev-parse", docs_pin).decode().strip() == docs_pin, "Separate checker/docs Git pin resolves exactly")
checker_bytes = pathlib.Path(__file__).read_bytes()
require(checker_bytes == docs_git("show", f"{docs_pin}:{relative_self}"), "Executing external checker equals separate pinned docs source")
baseline_path = "docs/evidence/native-combat-second-failure-287583c-20261001/source-footprint-0b.json"
baseline_bytes = docs_git("show", f"{docs_pin}:{baseline_path}")
require(hashlib.sha256(baseline_bytes).hexdigest() == BASELINE_SHA256, "Baseline equals the independently admitted 034f0fe footprint seal")
baseline = json.loads(baseline_bytes)
require(baseline['pin'] == PROOF and len(baseline['productPaths']) == 567)
original = tree(PROOF)
authorized = tree(CHANGE)
actual = tree(pin)
product = {p for p in actual if p.startswith(("src/", "public/"))} | set(baseline["productRootPaths"])
proof = {p for p in actual if p.startswith("scripts/acceptance/")}
require(product == set(baseline['productPaths']), 'Complete product path sets equal')
require(proof == set(baseline['proofPaths']), 'Complete original proof path sets equal')
require(len(proof) == 19)
require({p for p in original if p.startswith(('src/', 'public/'))} | set(baseline['productRootPaths']) == product)
require({p for p in original if p.startswith('scripts/acceptance/')} == proof)
changed = [p for p in sorted(product) if actual[p] != original[p]]
require(changed == ['src/main.ts'], 'Only reviewed anonymous-cosmetics product change permitted')
require(actual['src/main.ts'] == authorized['src/main.ts'], 'Use reviewed product change bytes and mode')
require(all(actual[p] == original[p] for p in proof), "All original proof module identities retained")
require(actual[SUPPLEMENTAL_CONFIG] == original[SUPPLEMENTAL_CONFIG], "Vite editor entry and native freeze config remain equal to original proof")

live = set()
for directory in ("src", "public", "scripts/acceptance"):
    for path in root.joinpath(directory).rglob("*"):
        require(not path.is_symlink(), f'Unexpected input symlink: {path}')
        if path.is_file():
            live.add(path.relative_to(root).as_posix())
require(live == product - set(baseline['productRootPaths']) | proof, 'Complete live input inventory equals Git')
files = {}
raw_sources = {}
for name in sorted(product | proof | {SUPPLEMENTAL_CONFIG}):
    path = root / name
    require(stat.S_ISREG(path.lstat().st_mode), name)
    raw = path.read_bytes()
    mode = "100755" if path.stat().st_mode & 0o111 else "100644"
    git_blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    require(actual[name]['kind'] == 'blob' and mode == actual[name]['mode'] and (git_blob == actual[name]['gitBlob']), name)
    item = {"mode": mode, "gitBlob": git_blob, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    if name in baseline["files"]:
        expected = baseline["files"][name]
        require(original[name]["gitBlob"] == expected["gitBlob"] and original[name]["mode"] == expected["mode"], name)
        if name != "src/main.ts":
            require(item == expected, f"Unchanged input bytes: {name}")
    files[name] = item
    if name.startswith("src/"):
        raw_sources[name] = raw
require(re.search(b'export const SAVE_VERSION\\s*=\\s*4\\s*;', raw_sources['src/core/saves.ts']))
require(re.search(b'export const SIMULATION_REVISION\\s*=\\s*[\'\\"]4\\.0\\.1[\'\\"]\\s*;', raw_sources['src/core/versions.ts']))
build = hashlib.sha256()
for name in sorted(raw_sources):
    if name.endswith((".ts", ".css")):
        build.update(name[4:].encode())
        build.update(raw_sources[name])
require(git('rev-parse', 'HEAD').decode().strip() == pin, 'Pin unchanged during source check')
receipt = {"schema": 1, "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sourceRoot": str(root), "runtimeProductProofPin": pin, "checkerDocsRoot": str(docs_root), "checkerDocsPin": docs_pin, "executedCheckerSha256": hashlib.sha256(checker_bytes).hexdigest(), "baselineFootprintSha256": BASELINE_SHA256, "supplementalFreezeConfig": [SUPPLEMENTAL_CONFIG], "originalProofSourcePin": PROOF, "authorizedProductChangeCommit": CHANGE, "productInputs": len(product), "unchangedProductInputs": len(product) - len(changed), "changedProductPaths": changed, "originalProofModules": len(proof), "completePathSetsAndLiveBytesVerified": True, "saveVersion": 4, "simulationRevision": "4.0.1", "sourceDerivedExpectedBuildId": build.hexdigest(), "runtimeExecuted": False, "uiRegressionAdmission": "Root must separately admit the fresh UI regression before execution", "files": files}
with output.open("x") as stream:
    json.dump(receipt, stream, indent=2)
    stream.write("\n")
print(json.dumps({k: v for k, v in receipt.items() if k != "files"}, indent=2))
