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
GUARD_CHANGE = "c074cc5e610fc128d7b6ac894a61258d418463d4"
RUNTIME = "453c2218af9973b9eca8fb78392435bd9d46a740"
FAVICON_PATH = "public/favicon.ico"
FAVICON_BLOB = "82fa500660fbf8a022166b806cb5cdb372ad83d5"
FAVICON_SHA256 = "5e0bf0f72488bc693d779cd7a3ebc7fdfca8db9916a6e3e0811fff59113253c2"
FAVICON_BYTES = 32038
BASELINE_SHA256 = "f9d5fada4c3eb7572576370dec34c7cdf67ec75bce7ff620bb3c7e8fe78f653d"
SUPPLEMENTAL_CONFIG = "editor.html"


def require(condition, message="Source applicability check failed"):
    if not condition:
        raise SystemExit(message)


arguments = sys.argv[1:]
dist_freeze = None
dist_reference = None
dist_reference_sha256 = None
if arguments and arguments[0] == "--dist":
    require(len(arguments) in (7, 9), "Use --dist DOCS_GIT_ROOT DOCS_FULL_PIN PRODUCT_ROOT PRODUCT_FULL_PIN FROZEN_INPUTS NEW_EXTERNAL_RECEIPT [FIRST_DIST_RECEIPT RETAINED_FIRST_SHA256]")
    _, docs_arg, docs_pin, root_arg, pin, freeze_arg, output_arg = arguments[:7]
    dist_freeze = pathlib.Path(freeze_arg).resolve(strict=True)
    if len(arguments) == 9:
        dist_reference = pathlib.Path(arguments[7]).resolve(strict=True)
        dist_reference_sha256 = arguments[8]
        require(re.fullmatch(r"[0-9a-f]{64}", dist_reference_sha256), "Previously retained first-receipt SHA-256 required")
else:
    require(len(arguments) == 5, "Use DOCS_GIT_ROOT DOCS_FULL_PIN PRODUCT_ROOT PRODUCT_FULL_PIN NEW_EXTERNAL_RECEIPT")
    docs_arg, docs_pin, root_arg, pin, output_arg = arguments
docs_root = pathlib.Path(docs_arg).resolve(strict=True)
root = pathlib.Path(root_arg).resolve(strict=True)
require(re.fullmatch(r"[0-9a-f]{40}", docs_pin), "Full immutable checker/docs pin required")
require(re.fullmatch(r"[0-9a-f]{40}", pin), "Full immutable product pin required")
require(pin == RUNTIME, "Current runtime product/proof freeze is 453c2218af9973b9eca8fb78392435bd9d46a740")
output = pathlib.Path(output_arg)
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
relative_self = "docs/evidence/native-combat-retry-preparation-453c221-20261001/verify-product-applicability.py"
require(docs_git("rev-parse", docs_pin).decode().strip() == docs_pin, "Separate checker/docs Git pin resolves exactly")
checker_bytes = pathlib.Path(__file__).read_bytes()
require(checker_bytes == docs_git("show", f"{docs_pin}:{relative_self}"), "Executing external checker equals separate pinned docs source")
baseline_path = "docs/evidence/native-combat-second-failure-287583c-20261001/source-footprint-0b.json"
baseline_bytes = docs_git("show", f"{docs_pin}:{baseline_path}")
require(hashlib.sha256(baseline_bytes).hexdigest() == BASELINE_SHA256, "Baseline equals the independently admitted 034f0fe footprint seal")
baseline = json.loads(baseline_bytes)
require(baseline['pin'] == PROOF and len(baseline['productPaths']) == 567)
original = tree(PROOF)
authorized = tree(GUARD_CHANGE)
actual = tree(pin)
product = {p for p in actual if p.startswith(("src/", "public/"))} | set(baseline["productRootPaths"])
proof = {p for p in actual if p.startswith("scripts/acceptance/")}
require(product == set(baseline['productPaths']) | {FAVICON_PATH} and len(product) == 568, 'Complete authorized 568-product path set')
require(proof == set(baseline['proofPaths']), 'Complete original proof path sets equal')
require(len(proof) == 19)
require({p for p in original if p.startswith(('src/', 'public/'))} | set(baseline['productRootPaths']) == product - {FAVICON_PATH})
require({p for p in original if p.startswith('scripts/acceptance/')} == proof)
changed = [p for p in sorted(product) if actual[p] != original.get(p)]
require(changed == [FAVICON_PATH, "src/main.ts"], "Only reviewed main guard and favicon addition permitted")
require(FAVICON_PATH not in original and FAVICON_PATH not in authorized, "Favicon is the sole authorized product addition")
require(actual[FAVICON_PATH] == {"mode": "100644", "kind": "blob", "gitBlob": FAVICON_BLOB}, "Reviewed favicon Git identity")
require(all(actual[p] == authorized[p] for p in baseline["productPaths"]), "All prior 567 c074 product entries remain unchanged")
require(actual['src/main.ts'] == authorized['src/main.ts'], 'Use reviewed product change bytes and mode')
require(all(actual[p] == original[p] for p in proof), "All original proof module identities retained")
require(actual[SUPPLEMENTAL_CONFIG] == original[SUPPLEMENTAL_CONFIG], "Vite editor entry and native freeze config remain equal to original proof")

live = set()
for directory in ("src", "public", "scripts/acceptance"):
    require(stat.S_ISDIR(root.joinpath(directory).lstat().st_mode), "Regular input directory: " + directory)
    for path in root.joinpath(directory).rglob("*"):
        path_mode = path.lstat().st_mode
        require(stat.S_ISDIR(path_mode) or stat.S_ISREG(path_mode), "Only directories and regular source files: " + str(path))
        if stat.S_ISREG(path_mode):
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
    if name == FAVICON_PATH:
        require(item["sha256"] == FAVICON_SHA256 and item["bytes"] == FAVICON_BYTES, "Reviewed favicon raw bytes")
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

dist_evidence = None
if dist_freeze is not None:
    require(not dist_freeze.is_relative_to(root) and not dist_freeze.is_relative_to(docs_root), "Frozen contract belongs outside both source roots")
    require(stat.S_ISREG(dist_freeze.lstat().st_mode), "Frozen contract is a regular file")
    freeze_bytes = dist_freeze.read_bytes()
    frozen = json.loads(freeze_bytes)
    require(frozen["schema"] == 1 and frozen["source"]["commit"] == pin, "Actual native frozen contract uses runtime 453 pin")
    require(frozen["source"]["saveVersion"] == 4 and frozen["source"]["simulationRevision"] == "4.0.1", "Actual frozen SAVE4/rules identity")
    require(frozen["source"]["expectedBuildId"] == build.hexdigest(), "Actual frozen source-derived build ID")
    config_paths = {"vite.config.ts", "package.json", "package-lock.json", "tsconfig.json", "index.html", "editor.html"}
    expected_frozen_sources = {name for name in files if name.startswith("src/")} | proof | config_paths
    frozen_sources = frozen["source"]["files"]
    require(len(frozen_sources) == len(expected_frozen_sources), "Complete frozen source inventory length")
    require({item["path"] for item in frozen_sources} == expected_frozen_sources, "Complete frozen source/config/proof path set")
    for item in frozen_sources:
        current = files[item["path"]]
        require(item["bytes"] == current["bytes"] and item["sha256"] == current["sha256"], "Frozen source fingerprint: " + item["path"])

    dist = root / "dist"
    require(dist.is_dir() and not dist.is_symlink(), "Actual dist is an owned regular directory")
    dist_files = {}
    for path in sorted(dist.rglob("*")):
        path_mode = path.lstat().st_mode
        require(stat.S_ISDIR(path_mode) or stat.S_ISREG(path_mode), "Only directories and regular dist files: " + str(path))
        if stat.S_ISREG(path_mode):
            raw = path.read_bytes()
            dist_files[path.relative_to(dist).as_posix()] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    frozen_dist = frozen["dist"]
    executable_paths = {name for name in dist_files if name.endswith((".html", ".js", ".css"))}
    require(len(frozen_dist) == len(executable_paths), "Complete frozen executable inventory length")
    require({item["path"] for item in frozen_dist} == executable_paths, "Complete actual HTML/JS/CSS path set equals frozen contract")
    for item in frozen_dist:
        name = item["path"]
        require({"bytes": item["bytes"], "sha256": item["sha256"]} == dist_files[name], "Actual frozen dist fingerprint: " + name)

    public_files = {}
    for source_name in sorted(name for name in product if name.startswith("public/")):
        dist_name = source_name[7:]
        require(dist_name in dist_files, "Copied public asset exists in actual dist: " + source_name)
        expected = files[source_name]
        require(dist_files[dist_name] == {"bytes": expected["bytes"], "sha256": expected["sha256"]}, "Copied public asset bytes match pinned product: " + source_name)
        public_files[dist_name] = dist_files[dist_name]
    require(len(public_files) == 394, "Complete 393 prior public assets plus favicon")
    require(public_files["favicon.ico"] == {"bytes": FAVICON_BYTES, "sha256": FAVICON_SHA256}, "Fresh actual dist favicon identity")
    require(dist_freeze.read_bytes() == freeze_bytes, "Frozen contract remains unchanged through byte audit")
    dist_evidence = {"frozenInputsPath": str(dist_freeze), "frozenInputsSha256": hashlib.sha256(freeze_bytes).hexdigest(), "actualDistPath": str(dist), "actualDistFiles": len(dist_files), "actualDistFingerprints": dist_files, "copiedPublicAssets": len(public_files), "publicAssetFingerprints": public_files, "frozenExecutableAssets": len(frozen_dist), "faviconVerified": True, "scope": "Actual file fingerprints and copied public-asset equality only; no fixture producer, build, browser or gameplay executed by this checker"}
    if dist_reference is not None:
        require(not dist_reference.is_relative_to(root) and not dist_reference.is_relative_to(docs_root), "Reference receipt belongs outside both source roots")
        require(stat.S_ISREG(dist_reference.lstat().st_mode), "Reference receipt is a regular file")
        reference_bytes = dist_reference.read_bytes()
        require(hashlib.sha256(reference_bytes).hexdigest() == dist_reference_sha256, "First receipt equals its previously retained digest before parsing")
        previous = json.loads(reference_bytes)
        require(previous["sourceRoot"] == str(root) and previous["runtimeProductProofPin"] == pin, "Reference receipt binds the same product checkout and runtime pin")
        require(previous["checkerDocsPin"] == docs_pin and previous["executedCheckerSha256"] == hashlib.sha256(checker_bytes).hexdigest(), "Reference checker provenance is unchanged")
        require(previous["originalProofSourcePin"] == PROOF and previous["baselineFootprintSha256"] == BASELINE_SHA256, "Reference original proof and baseline identities")
        require(previous["sourceDerivedExpectedBuildId"] == build.hexdigest() and previous["files"] == files, "All source/config/public/proof fingerprints equal the first asset receipt")
        previous_dist = previous["distEvidence"]
        require(previous_dist["frozenInputsSha256"] == dist_evidence["frozenInputsSha256"], "Reference uses the identical native frozen contract")
        require(previous_dist["actualDistFingerprints"] == dist_files and previous_dist["publicAssetFingerprints"] == public_files, "Complete actual dist and copied public fingerprints equal the first receipt")
        require(dist_reference.read_bytes() == reference_bytes, "Reference asset receipt remains unchanged through byte audit")
        dist_evidence["comparedFirstReceipt"] = {"path": str(dist_reference), "sha256": dist_reference_sha256, "allDistAndSourceFingerprintsEqual": True}

require(git('rev-parse', 'HEAD').decode().strip() == pin, 'Pin unchanged during source check')
receipt = {"schema": 1, "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sourceRoot": str(root), "runtimeProductProofPin": pin, "checkerDocsRoot": str(docs_root), "checkerDocsPin": docs_pin, "executedCheckerSha256": hashlib.sha256(checker_bytes).hexdigest(), "baselineFootprintSha256": BASELINE_SHA256, "supplementalFreezeConfig": [SUPPLEMENTAL_CONFIG], "originalProofSourcePin": PROOF, "reviewedMainGuardCommit": GUARD_CHANGE, "reviewedFaviconRuntimeCommit": RUNTIME, "unchangedPreviousProductInputs": len(baseline["productPaths"]), "productInputs": len(product), "unchangedProductInputs": len(product) - len(changed), "changedProductPaths": changed, "originalProofModules": len(proof), "completePathSetsAndLiveBytesVerified": True, "saveVersion": 4, "simulationRevision": "4.0.1", "sourceDerivedExpectedBuildId": build.hexdigest(), "runtimeExecuted": False, "uiRegressionAdmission": "Root must separately admit the fresh UI regression before execution", "distEvidence": dist_evidence, "files": files}
receipt_bytes = (json.dumps(receipt, indent=2) + "\n").encode()
with output.open("xb") as stream:
    stream.write(receipt_bytes)
require(output.read_bytes() == receipt_bytes, "Fresh receipt bytes remain equal before emitting retained digest")
print(json.dumps({"receiptPath": str(output), "receiptSha256": hashlib.sha256(receipt_bytes).hexdigest()}, indent=2))
print(json.dumps({k: v for k, v in receipt.items() if k not in {"files", "distEvidence"}}, indent=2))
if dist_evidence is not None:
    print(json.dumps({k: v for k, v in dist_evidence.items() if k not in {"actualDistFingerprints", "publicAssetFingerprints"}}, indent=2))
