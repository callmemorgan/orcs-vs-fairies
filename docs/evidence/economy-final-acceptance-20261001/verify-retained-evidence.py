#!/usr/bin/env python3
"""Audit retained proof bytes and full native JSON equality without replay execution."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
repo = Path(sys.argv[1]).resolve()
approved_economy_pin = sys.argv[2]
FINAL_PIN = "c86e273c70738f144a00fe75f5ecf39e7fa324d8"
DB_PIN = "db36593f816a57e29220d760de14455cec969f0b"
CONFIG_PATHS = ["package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "vitest.config.ts", "index.html", "editor.html"]
SCRIPT_PATHS = ["scripts/controls-proof", "scripts/minimap-alerts", "scripts/verify_minimap_levels.mjs"]
TEST_PATHS = ["tests/appearance.test.ts", "tests/display-settings.test.ts", "tests/gamepad.test.ts", "tests/minimap-alerts.test.ts", "tests/minimap-level-focus.test.ts", "tests/session-storage.test.ts", "tests/session-tools.test.ts"]
ECONOMY_PATHS = ["scripts/economy", "scripts/verify_economy_ui.mjs", "scripts/verify_economy_combined_ui.mjs", "scripts/verify_settlement_runtime_ui.mjs"]
INPUT_ROOTS = {"sourceFiles": ["src"], "assetFiles": ["public"], "configFiles": CONFIG_PATHS, "scriptFiles": SCRIPT_PATHS, "testFiles": TEST_PATHS, "economyScriptFiles": ECONOMY_PATHS}
POLICY = {"economy": (FINAL_PIN, "4.0.1", "browser", "economy", "final-economy-4.0.1", "environment-c86e273-after.json"), "modal": (DB_PIN, "4.0.0", "modal-browser", "economy-modal", "db36593", "environment-db36593-after.json"), "settlement": (DB_PIN, "4.0.0", "settlement-runtime", "settlement-runtime", "db36593", "environment-db36593-after.json")}
MODULE_ENTRIES = {"schema.mjs": "scripts/controls-proof/schema.ts", "generate-scenario.mjs": "scripts/economy/generate-scenario.ts", "verify-native-session.mjs": "scripts/economy/verify-native-session.ts"}
checks = 0
blob_cache = {}

def require(value, message):
    global checks
    checks += 1
    if not value:
        raise AssertionError(message)

def read(path):
    return json.loads(path.read_text())

def digest(data):
    return hashlib.sha256(data).hexdigest()

def retained(relative, parent=root):
    path = (parent / relative).resolve()
    require(path.is_relative_to(parent.resolve()), "Retained path boundary " + str(relative))
    return path

def git_paths(pin, roots):
    return sorted(subprocess.check_output(["git", "-C", str(repo), "ls-tree", "-r", "--name-only", pin, "--", *roots], text=True).splitlines())

def blob(pin, path):
    key = (pin, path)
    if key not in blob_cache:
        blob_cache[key] = subprocess.check_output(["git", "-C", str(repo), "show", pin + ":" + path])
    return blob_cache[key]

def file_inventory(directory):
    return {str(path.relative_to(directory)): {"bytes": path.stat().st_size, "sha256": digest(path.read_bytes())} for path in directory.rglob("*") if path.is_file()}

def verify_record(path, record):
    data = path.read_bytes()
    require(len(data) == record["bytes"], str(path) + " size")
    require(digest(data) == record["sha256"], str(path) + " SHA-256")

archive_manifest = read(root / "artifact-hashes.json")
actual = {str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()}
require(actual - {"artifact-hashes.json"} == set(archive_manifest), "Complete archive inventory")
for relative, record in archive_manifest.items():
    verify_record(root / relative, record)

omissions = read(root / "omitted-build-assets.json")
require(len({item["archive"] for item in omissions}) == len(omissions), "Unique omitted snapshot associations")
omission_by_archive = {item["archive"]: item for item in omissions}
OMISSION_POLICY = {"first-failures-af44": "af44-artifact-inventory.json", "db36593": "db36593-artifact-inventory.json", "final-economy-4.0.1": "c86e273-artifact-inventory.json"}
require(set(omission_by_archive) == set(OMISSION_POLICY), "Exact omitted snapshot inventory")
for omission in omissions:
    require(omission["omittedDirectory"] == "dist" and omission["inventoryFile"] == OMISSION_POLICY[omission["archive"]], "Fixed omitted directory/inventory association")
    directory = retained(omission["archive"])
    build = read(directory / "build-manifest.json")
    require(omission["compiledFiles"] == build["compiledFiles"], "Omitted build mapping " + omission["archive"])
    inventory_name = omission["inventoryFile"]
    original_inventory = read(directory / inventory_name)
    prefix = omission["omittedDirectory"].rstrip("/") + "/"
    expected_retained = {name for name in original_inventory if not name.startswith(prefix)}
    actual_retained = {str(path.relative_to(directory)) for path in directory.rglob("*") if path.is_file()}
    require(actual_retained == expected_retained | {inventory_name}, "Complete retained snapshot " + omission["archive"])
    for relative in expected_retained:
        verify_record(directory / relative, original_inventory[relative])
    omitted = {name.removeprefix(prefix): value for name, value in original_inventory.items() if name.startswith(prefix)}
    require(omitted == build["compiledFiles"], "Original inventory omitted build mapping " + omission["archive"])

accepted = read(root / "accepted-runs.json")
require(set(accepted) == set(POLICY), "Accepted family inventory")
require(re.fullmatch("[0-9a-f]{40}", approved_economy_pin) is not None, "Externally approved economy pin")
require(approved_economy_pin == FINAL_PIN, "Released immutable economy freeze")
for family, expected_count in [("economy", 25), ("modal", 12), ("settlement", 8)]:
    association = accepted[family]
    pin, revision, family_directory, feature, snapshot_name, environment_name = POLICY[family]
    require((association["sourcePin"], association["simulationRevision"], association["familyDirectory"]) == (pin, revision, family_directory), family + " fixed family policy")
    require(association["snapshot"] == snapshot_name and association["environmentAfter"] == environment_name, family + " fixed snapshot/environment association")
    snapshot = retained(association["snapshot"])
    directory = retained(association["familyDirectory"], snapshot)
    prepare = read(snapshot / "prepare.json")
    proof = read(directory / "browser-proof.json")
    modules = read(snapshot / "modules" / "manifest.json")
    build = read(snapshot / "build-manifest.json")
    manifest = read(directory / "manifest.json")
    environment = read(snapshot / environment_name)
    if (snapshot / "dist").exists():
        require(file_inventory(snapshot / "dist") == build["compiledFiles"], family + " retained compiled bytes")
    else:
        require(association["snapshot"] in omission_by_archive, family + " omitted compiled association")
    require(prepare["sourcePin"] == association["sourcePin"], family + " approved pin")
    require(proof["sourcePin"] == prepare["sourcePin"] == modules["sourcePin"] == build["sourcePin"] == manifest["sourcePin"], family + " source association")
    require(proof["productionSourceCommit"] == pin and proof.get("sourceCommit", pin) == pin, family + " driver source association")
    require(proof["feature"] == manifest["feature"] == feature, family + " proof feature")
    require(prepare["schema"]["saveVersion"] == 4, family + " SAVE4")
    require(prepare["schema"]["simulationRevision"] == association["simulationRevision"], family + " approved revision")
    require(proof["schema"] == prepare["schema"] == modules["schema"] == manifest["schema"], family + " schema association")
    require(proof["buildId"] == prepare["buildId"] == modules["buildId"] == build["buildId"] == manifest["buildId"], family + " build ID")
    require((environment["sourcePin"], environment["sourceDigest"], environment["buildId"]) == (pin, prepare["sourceDigest"], prepare["buildId"]), family + " post-run environment identity")
    require(environment["sourceAndScriptBytesMatchPin"] is True and environment["compiledAndModuleInventoriesStable"] is True, family + " post-run input stability")
    preview = environment["ownedPreview"]
    require(preview["port"] == 5398 and preview["pid"] > 0 and preview["exitCode"] == 143 and preview["clear"] is True, family + " owned preview closure")
    environment_family = environment["families"][family_directory]
    require(environment_family["exitCode"] == 0 and environment_family["checks"] == expected_count and environment_family["result"] == "passed" and environment_family["pageErrors"] == [] and environment_family["fullServedInventoryStable"] is True, family + " recorded browser exit/result")
    require([item["name"] for item in environment_family["nativeExports"]] == ["commanded", "reloaded", "replayed"] and all(item["exitCode"] == 0 for item in environment_family["nativeExports"]), family + " recorded native exits")
    source_inputs = {**prepare["sourceFiles"], **prepare["configFiles"]}
    source_digest = digest("".join(path + "\0" + record["sha256"] + "\n" for path, record in sorted(source_inputs.items())).encode())
    require(source_digest == prepare["sourceDigest"] == modules["sourceDigest"], family + " source digest")
    require(proof["passed"] is True and proof["result"] == "passed", family + " passing finalizer")
    evidence = proof.get("checks", proof.get("evidence"))
    require(len(evidence) == expected_count, family + " intended check count")
    if isinstance(evidence, dict):
        require(all(value is True for value in evidence.values()), family + " true economy checks")
    else:
        require(all("value" in item and item["value"] is not None and item["value"] is not False for item in evidence), family + " completed checks")
    for key in ["pageErrors", "consoleErrors", "failedRequests", "httpErrors", "errors"]:
        require(proof.get(key, []) == [], family + " empty " + key)
    require(proof["browserClosed"] is True, family + " browser closed")
    require(proof["economyScriptFiles"] == prepare["economyScriptFiles"], family + " browser driver script association")
    if family == "economy":
        observation = proof["responseObservation"]
        require(observation["drained"] is True and observation["httpStatusesObservedThroughClose"] is True and observation["observedTaskCount"] > 0 and "error" not in observation, family + " bounded response drain")
    require(proof["allServedBefore"] == proof["allServedAfter"] == build["compiledFiles"], family + " complete served build equality")
    require(proof["servedBefore"] == proof["servedAfter"], family + " primary served equality")
    require(digest((snapshot / "modules" / "manifest.json").read_bytes()) == prepare["moduleManifestSha256"], family + " module manifest")
    require(digest((snapshot / "build-manifest.json").read_bytes()) == prepare["buildManifestSha256"], family + " build manifest")
    for path, record in modules["modules"].items():
        verify_record(snapshot / "modules" / path, record)
    actual_modules = file_inventory(snapshot / "modules")
    del actual_modules["manifest.json"]
    require(actual_modules == modules["modules"], family + " complete module inventory")
    require(modules["entries"] == MODULE_ENTRIES, family + " exact bundled entries")
    for key in ["sourceFiles", "assetFiles", "configFiles", "scriptFiles", "testFiles", "economyScriptFiles"]:
        require(prepare[key] == modules[key] == build[key], family + " input map " + key)
        require(sorted(prepare[key]) == git_paths(pin, INPUT_ROOTS[key]), family + " complete pinned inventory " + key)
        if key != "economyScriptFiles":
            require(manifest[key] == prepare[key], family + " family input map " + key)
        for path, record in prepare[key].items():
            data = blob(pin, path)
            require(digest(data) == record["sha256"], family + " Git blob " + path)
            require(len(data) == record["bytes"], family + " Git blob size " + path)
            if key != "economyScriptFiles":
                require(record["gitBlob"] == subprocess.check_output(["git", "-C", str(repo), "rev-parse", pin + ":" + path], text=True).strip(), family + " Git object association " + path)
    source_paths = git_paths(pin, ["src"])
    require(sorted(source_paths) == sorted(prepare["sourceFiles"]), family + " full source inventory")
    build_hash = hashlib.sha256()
    for path in source_paths:
        if path.endswith((".ts", ".css")):
            build_hash.update(path.removeprefix("src/").encode())
            build_hash.update(blob(pin, path))
    require(build_hash.hexdigest() == prepare["buildId"], family + " recomputed production build ID")
    canonical_tests = re.findall(r"""['"](tests/[^'"]+\.test\.ts)['"]""", blob(pin, "scripts/controls-proof/canonical.vitest.config.ts").decode())
    require(sorted(canonical_tests) == sorted(TEST_PATHS), family + " every configured canonical test")
    all_inputs = {path: record for key in INPUT_ROOTS for path, record in prepare[key].items()}
    for module_name, entry in modules["entries"].items():
        meta = read(snapshot / "modules" / (module_name + ".meta.json"))
        for path, record in meta["inputs"].items():
            if path.startswith(("src/", "scripts/")):
                source_path = re.split("[?#]", path)[0]
                require(source_path in all_inputs, family + " bundled input association " + path)
                require(record["bytes"] == len(blob(pin, source_path)), family + " bundled input size " + path)
        require(len(meta["outputs"]) == 1, family + " one bundled output " + module_name)
        output = next(iter(meta["outputs"].values()))
        require(output["entryPoint"] == entry and output["bytes"] == modules["modules"][module_name]["bytes"], family + " esbuild output association " + module_name)
    require(manifest["compiledFiles"] == build["compiledFiles"], family + " family compiled inventory")
    for path, record in manifest["artifacts"].items():
        verify_record(retained(path, directory), record)
    actual_family = file_inventory(directory)
    expected_family = {path: record for path, record in actual_family.items() if path != "manifest.json" and not path.endswith(".log") and not path.endswith("-native-verification.json")}
    require(manifest["artifacts"] == expected_family, family + " complete browser artifact manifest")
    for item in proof["browserAssetResponses"]:
        require(item["status"] == 200, family + " observed browser asset status")
        require({"sha256": item["sha256"], "bytes": item["bytes"]} == build["compiledFiles"][item["path"]], family + " observed browser asset")
    for item in proof.get("browserApiResponses", []):
        require(item["resourceType"] in ["fetch", "xhr"] and "/api/" in item["url"], family + " separate API observation")
        if 300 <= item["status"] < 400:
            require(item["sha256"] is None and item["bytes"] is None and bool(item["bodyUnavailable"]), family + " explicit redirect body limit")
        else:
            require(re.fullmatch("[0-9a-f]{64}", item["sha256"]) is not None and item["bytes"] >= 0, family + " API body hash")
    api_responses = proof["browserApiResponses"]
    require(any(item["url"].endswith("/api/session") and item["status"] == 200 and item["resourceType"] in ["fetch", "xhr"] and item["contentType"].startswith("text/html") and re.fullmatch("[0-9a-f]{64}", item["sha256"] or "") is not None for item in api_responses), family + " classified API session HTML response")
    if family == "modal":
        require(any(item["url"].endswith("/api/tournaments/configs") for item in api_responses), family + " modal tournaments API observation")
    sessions = {name: read(directory / (name + "-session.json")) for name in ["commanded", "reloaded", "replayed"]}
    report = read(directory / "report.json")
    require(report["format"] == "orcs-vs-fairies/bug-report" and report["version"] == 1 and report["versions"]["replay"] == prepare["schema"]["replayVersion"] and report["versions"]["replaySimulation"] == prepare["schema"]["replayChecksumVersion"], family + " bug report envelope/replay metadata")
    require(report["versions"]["buildId"] == prepare["buildId"], family + " native application build ID")
    require(report["versions"]["save"] == 4 and report["versions"]["simulationRevision"] == association["simulationRevision"], family + " native application versions")
    require(sessions["commanded"] == report["session"], family + " complete save/report equality")
    require(sessions["commanded"] == sessions["reloaded"] == sessions["replayed"], family + " complete native session JSON equality")
    require((directory / "commanded-session.json").read_bytes() == (directory / "reloaded-session.json").read_bytes() == (directory / "replayed-session.json").read_bytes(), family + " native session byte equality")
    require(sessions["commanded"]["game"] == sessions["reloaded"]["game"] == sessions["replayed"]["game"], family + " complete game equality")
    require(sessions["commanded"]["replay"] == read(directory / "exported-replay.json"), family + " complete replay export")
    equality = read(directory / "native-session-equality.json")
    require(equality == proof["sessionEquality"], family + " equality receipt association")
    require(equality["fullSaveEqualsReportSession"] is True and equality["fullGameEqualsReloadExport"] is True and equality["fullGameEqualsReplayExport"] is True, family + " native equality flags")
    require(equality["saveVersion"] == 4 and equality["simulationRevision"] == revision, family + " equality versions")
    require(equality["initialTick"] == sessions["commanded"]["replay"]["initial"]["state"]["tick"] and equality["finalTick"] == sessions["commanded"]["game"]["state"]["tick"], family + " equality ticks")
    require(equality["exports"] == ["commanded-session.json", "reloaded-session.json", "replayed-session.json", "exported-replay.json", "report.json"], family + " equality exports")
    game_hash = subprocess.check_output(["node", "-e", "const fs=require('node:fs'),crypto=require('node:crypto');const file=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(crypto.createHash('sha256').update(JSON.stringify(file.game)).digest('hex'));", str(directory / "commanded-session.json")], text=True)
    require(game_hash == equality["gameSha256"], family + " full game hash")
    for name in sessions:
        path = directory / (name + "-session.json")
        receipt = read(directory / (name + "-native-verification.json"))
        log_prefix = {"browser": "browser", "modal-browser": "modal", "settlement-runtime": "settlement"}[association["familyDirectory"]]
        require(read(snapshot / (log_prefix + "-" + name + "-native.log")) == receipt, family + " native command log " + name)
        require(next(item["verification"] for item in environment_family["nativeExports"] if item["name"] == name) == receipt, family + " post-run native receipt " + name)
        session = sessions[name]
        schema = prepare["schema"]
        require(session["format"] == schema["sessionFormat"] and session["version"] == schema["sessionVersion"] and session["game"]["format"] == schema["saveFormat"] and session["game"]["version"] == schema["saveVersion"], family + " native session/save formats " + name)
        require(session["replay"]["format"] == schema["replayFormat"] and session["replay"]["version"] == schema["replayVersion"] and session["replay"]["checksumVersion"] == schema["replayChecksumVersion"] and session["replay"]["initial"]["format"] == schema["saveFormat"] and session["replay"]["initial"]["version"] == schema["replayInitialSaveVersion"], family + " native replay formats " + name)
        require(session["version"] == 1 and session["game"]["version"] == 4 and session["replay"]["version"] == 1, family + " native envelope versions " + name)
        require(session["replay"]["initial"]["version"] == 4 and session["replay"]["checksumVersion"] == 4 and session["replay"]["simulationRevision"] == association["simulationRevision"], family + " native replay versions " + name)
        require(session["game"]["state"]["tick"] == session["replay"]["finalTick"], family + " native replay tick " + name)
        require(receipt["inputSha256"] == digest(path.read_bytes()), family + " native input " + name)
        require(receipt["sourcePin"] == association["sourcePin"] and receipt["simulationRevision"] == association["simulationRevision"], family + " native association " + name)
        require(receipt["sourceDigest"] == source_digest and receipt["saveVersion"] == 4 and receipt["fixtureWithoutReplay"] is False, family + " native source/schema " + name)
        require(receipt["executedCheckerSha256"] == modules["modules"]["verify-native-session.mjs"]["sha256"], family + " executed checker " + name)
        require(receipt["fullFileDecodeEqualsInput"] is True and receipt["fullGameLoadResaveEqualsInput"] is True and receipt["fullGameReplayEqualsInput"] is True, family + " native equality " + name)
        require(receipt["finalTick"] == sessions[name]["game"]["state"]["tick"], family + " native final tick " + name)

print(json.dumps({"passed": True, "checks": checks, "approvedEconomyPin": approved_economy_pin, "accepted": accepted, "scope": "Retained-byte, Git-input and full-JSON equality audit; no browser or replay rerun."}))
