#!/usr/bin/env python3
"""Static admission checks for the sealed a144 hosted-only retry packet.

This script reads files, immutable Git objects, and JSON. It does not import or
execute project modules, launch a browser or server, build, test, or move a
checkout.
"""

from __future__ import annotations

import ast
import gzip
import hashlib
import json
import re
import stat
import subprocess
import sys
from pathlib import Path


PACKET = Path("/tmp/ovf-hosted-only-retry-a144-readiness-jmgrn3ta")
REPO = Path("/home/morgana/.codex/worktrees/hosted-team-proof/orcs-vs-Fairies")
TARGET = "a144ad3f3dddd0003f9553541908e2254f2444c6"
TARGET_TREE = "ff0690aeb2fc5096180ab4e600fe4f378fb2ed87"
PRODUCT_FREEZE = "453c2218af9973b9eca8fb78392435bd9d46a740"
ORIGINAL = "473ab17642211c3610aed648ae5f813b7680edc1"
PLAN_SHA256 = "7d58d49e2dbde08e6d42180cdd35ec3068f57de62a2731d0d5385323d69cac1d"
MANIFEST_SHA256 = "cafc3dd6187338d964dd67431ec4831265e9dc8c34101d8d86c3b2b1a60ad6c7"
VERIFICATION_SHA256 = "58796ec4c110191eb4925a66978304d2c631f6c66847c8495af944fde2225f34"
SOURCE_SHA256 = "dbcd5071f68d2d00a6a20c27a366389202c2354e752f7c5d38b16cfd7e998c8d"
BUILD_ID = "5e49e689af13d4eef08c0760f904ad0bce2c2eebaa1144dea5d89cadecf310c0"
PRIOR_BASELINE = Path("/tmp/ovf-native-combat-453c221-retry-20261001-85q9lr0g/protected-root-before.json")
PRIOR_BASELINE_SHA256 = "7b5a72514815ec968654e0e569579d4868d1ecd415af92357035fa4c27b14ba9"
ORIGINAL_SUPERVISOR = REPO / "work/final-freeze-proof-20261001/supervise-proof-live-rules401.mjs"
HELPER = "scripts/server/verify-hosted-teams-browser.mjs"
SELECTED = re.compile(
    r"^(src/|public/|scripts/|package(?:-lock)?\.json$|tsconfig[^/]*\.json$|"
    r"vite\.config\.|(?:index|editor)\.html$|Dockerfile\.server$|\.dockerignore$)"
)


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path):
    return json.loads(path.read_bytes())


def git(*args: str, text: bool = True):
    result = subprocess.run(
        ["git", "-C", str(REPO), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ).stdout
    return result.decode() if text else result


def git_tree(commit: str) -> dict[str, dict[str, str]]:
    raw = git("ls-tree", "-r", "-z", "--full-tree", commit, text=False)
    result = {}
    for row in raw.split(b"\0"):
        if not row:
            continue
        metadata, raw_path = row.split(b"\t", 1)
        mode, kind, oid = metadata.decode().split()
        result[raw_path.decode()] = {"mode": mode, "kind": kind, "oid": oid}
    return result


def git_blobs(oids: list[str]) -> dict[str, bytes]:
    unique = sorted(set(oids))
    process = subprocess.Popen(
        ["git", "-C", str(REPO), "cat-file", "--batch"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None and process.stdout is not None
    process.stdin.write(b"".join(oid.encode() + b"\n" for oid in unique))
    process.stdin.close()
    result = {}
    for requested in unique:
        header = process.stdout.readline().rstrip(b"\n").decode()
        actual, kind, size_text = header.split()
        assert actual == requested and kind == "blob", header
        size = int(size_text)
        data = process.stdout.read(size)
        assert len(data) == size and process.stdout.read(1) == b"\n"
        result[requested] = data
    stderr = process.stderr.read().decode() if process.stderr else ""
    assert process.wait() == 0, stderr
    return result


checks: dict[str, object] = {}
warnings: list[dict[str, str]] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


try:
    plan_path = PACKET / "plan.json"
    manifest_path = PACKET / "packet-manifest.json"
    verification_path = PACKET / "verification.json"
    require(sha_file(plan_path) == PLAN_SHA256, "plan hash")
    require(sha_file(manifest_path) == MANIFEST_SHA256, "packet manifest hash")
    require(sha_file(verification_path) == VERIFICATION_SHA256, "verification hash")
    plan = load_json(plan_path)
    manifest = load_json(manifest_path)
    verification = load_json(verification_path)
    require(plan["targetPin"] == TARGET and manifest["targetPin"] == TARGET, "target pin")
    require(plan["productFreeze"] == PRODUCT_FREEZE, "product freeze")
    require(plan["functionalRuns"] == plan["checkoutMoves"] == plan["sharedRootWrites"] == 0, "static preparation counters")
    checks["packetIdentity"] = {
        "planSha256": PLAN_SHA256,
        "manifestSha256": MANIFEST_SHA256,
        "verificationSha256": VERIFICATION_SHA256,
        "verificationIsOutsideSealedManifest": "verification.json" not in manifest["files"],
    }

    require(len(manifest["files"]) == 8, "sealed packet file count")
    total = 0
    for name, record in manifest["files"].items():
        path = Path(record["path"])
        require(path == PACKET / name, f"manifest path {name}")
        mode = path.stat().st_mode
        require(stat.S_ISREG(mode), f"regular file {name}")
        require(stat.S_IMODE(mode) == 0o644, f"mode 0644 {name}")
        require(path.stat().st_size == record["bytes"], f"size {name}")
        require(sha_file(path) == record["sha256"], f"hash {name}")
        total += record["bytes"]
    require(total == manifest["totalBytes"] == 341112, "sealed byte total")
    checks["sealedPacket"] = {"files": 8, "bytes": total, "allRegularMode0644": True}

    source_manifest = load_json(PACKET / "source-a144.json")
    require(git("rev-parse", f"{TARGET}^{{tree}}").strip() == TARGET_TREE, "target tree")
    tree = git_tree(TARGET)
    selected_tree = {path: row for path, row in tree.items() if SELECTED.search(path)}
    require(len(selected_tree) == 748, "selected Git path count")
    require(set(selected_tree) == set(source_manifest["files"]), "selected source path set")
    blobs = git_blobs([row["oid"] for row in selected_tree.values()])
    aggregate = hashlib.sha256()
    build = hashlib.sha256()
    for path in sorted(selected_tree):
        row = selected_tree[path]
        require(row["kind"] == "blob", f"Git kind {path}")
        data = blobs[row["oid"]]
        expected = source_manifest["files"][path]
        require(
            expected == {
                "gitBlob": row["oid"],
                "bytes": len(data),
                "sha256": sha_bytes(data),
                "mode": row["mode"],
            },
            f"source record {path}",
        )
        aggregate.update(path.encode())
        aggregate.update(b"\0")
        aggregate.update(data)
        aggregate.update(b"\0")
        if path.startswith("src/") and (path.endswith(".ts") or path.endswith(".css")):
            build.update(path[4:].encode())
            build.update(data)
    require(aggregate.hexdigest() == source_manifest["sha256"] == SOURCE_SHA256, "source digest")
    require(build.hexdigest() == source_manifest["buildId"] == BUILD_ID, "build id")
    require(source_manifest["head"] == TARGET and source_manifest["tree"] == TARGET_TREE, "source commit identity")
    require(source_manifest["selectedFileCount"] == 748, "source manifest count")
    require(source_manifest["saveVersion"] == 4 and source_manifest["simulationRevision"] == "4.0.1", "SAVE and simulation versions")
    saves = blobs[selected_tree["src/core/saves.ts"]["oid"]].decode()
    versions = blobs[selected_tree["src/core/versions.ts"]["oid"]].decode()
    require(re.search(r"SAVE_VERSION\s*=\s*4\s*;", saves) is not None, "SAVE_VERSION source")
    require(re.search(r"SIMULATION_REVISION\s*=\s*['\"]4\.0\.1['\"]\s*;", versions) is not None, "simulation revision source")
    checks["targetSource"] = {
        "commit": TARGET,
        "tree": TARGET_TREE,
        "selectedFiles": 748,
        "sha256": SOURCE_SHA256,
        "buildId": BUILD_ID,
        "saveVersion": 4,
        "simulationRevision": "4.0.1",
    }

    product_paths = [
        "src", "public", "tests", "package.json", "package-lock.json", "tsconfig.json",
        "tsconfig.node.json", "vite.config.ts", "index.html", "editor.html", "Dockerfile.server", ".dockerignore",
    ]
    product_changes = [line for line in git("diff", "--name-only", PRODUCT_FREEZE, TARGET, "--", *product_paths).splitlines() if line]
    require(product_changes == [], "product bytes differ from product freeze")
    selected_changes = [line for line in git("diff", "--name-only", ORIGINAL, TARGET, "--", *sorted(selected_tree)).splitlines() if line]
    require(selected_changes == [HELPER], "selected-source change scope from original473")
    checks["productFreeze"] = {
        "commit": PRODUCT_FREEZE,
        "scope": product_paths,
        "changedPaths": product_changes,
        "selectedChangesFromOriginal473": selected_changes,
    }

    saved_diff = (PACKET / "reviewed-proof-change.diff").read_bytes()
    actual_diff = git("diff", ORIGINAL, TARGET, "--", HELPER, text=False)
    require(saved_diff == actual_diff, "saved helper diff")
    helper = blobs[selected_tree[HELPER]["oid"]].decode()
    required_helper_text = [
        "evidence.status = response.status();",
        "const data = await response.json(); evidence.mutations = mutations;",
        "if (method === 'GET') assert(mutations >= 1, 'Native GET action must issue at least one observed request');",
        "else assert.equal(mutations, 1);",
        "return { status: response.status(), data };",
        "assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data.lobby;",
    ]
    require(all(text in helper for text in required_helper_text), "helper response, count, or lobby guards")
    diff_lines = saved_diff.splitlines()
    added_lines = [line for line in diff_lines if line.startswith(b"+") and not line.startswith(b"+++")]
    removed_lines = [line for line in diff_lines if line.startswith(b"-") and not line.startswith(b"---")]
    require(len(added_lines) == 3 and len(removed_lines) == 1, "helper diff line count")
    checks["reviewedHelperChange"] = {
        "path": HELPER,
        "gitBlob": selected_tree[HELPER]["oid"],
        "bytes": len(blobs[selected_tree[HELPER]["oid"]]),
        "sha256": sha_bytes(blobs[selected_tree[HELPER]["oid"]]),
        "diffSha256": sha_bytes(saved_diff),
        "diffAddedLines": 3,
        "diffRemovedLines": 1,
        "getCountRule": ">= 1",
        "postCountRule": "== 1",
        "responseAndLobbyGuardsRetained": True,
    }

    runtime = load_json(PACKET / "browser-runtime-readiness.json")
    require(runtime["status"] == "passed-readiness-only", "runtime readiness status")
    require(runtime["module"] == plan["runtime"]["module"], "runtime module")
    require(len(runtime["files"]) == len(plan["runtime"]["currentByteRecords"]) == 10, "runtime file count")
    for path_text, record in runtime["files"].items():
        path = Path(path_text)
        require(path.is_file(), f"runtime path {path}")
        require(path.stat().st_size == record["bytes"] and sha_file(path) == record["sha256"], f"runtime bytes {path}")
    pw = load_json(Path(runtime["module"]).parent / "package.json")
    core_dir = Path(runtime["module"]).parent.parent / "playwright-core"
    pw_core = load_json(core_dir / "package.json")
    browsers = load_json(core_dir / "browsers.json")
    headless = next(row for row in browsers["browsers"] if row["name"] == "chromium-headless-shell")
    require(pw["version"] == pw_core["version"] == runtime["playwrightVersion"] == "1.62.1", "Playwright versions")
    require(headless["revision"] == "1234" and headless["installByDefault"] is True, "headless revision")
    require(headless["browserVersion"] == runtime["headlessChromiumVersion"] == "151.0.7922.34", "headless browser version")
    require(runtime["headlessExecutable"].endswith("chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"), "headless executable path")
    require(not Path("/home/morgana/.cache/ms-playwright/chromium-1234").exists(), "full Chromium 1234 unexpectedly present")
    checks["browserRuntime"] = {
        "playwrightVersion": "1.62.1",
        "playwrightCoreVersion": "1.62.1",
        "headlessRevision": "1234",
        "headlessVersion": "151.0.7922.34",
        "headlessExecutable": runtime["headlessExecutable"],
        "headlessExecutableSha256": runtime["files"][runtime["headlessExecutable"]]["sha256"],
        "authenticatedFiles": 10,
        "fullChromium1234Absent": True,
        "versionCaptureMethod": runtime["method"],
    }

    copied_supervisor = PACKET / "supervise-proof-live-rules401.mjs"
    require(copied_supervisor.read_bytes() == ORIGINAL_SUPERVISOR.read_bytes(), "copied supervisor bytes")
    dispatcher = PACKET / "dispatch-hosted-after-release.py"
    dispatcher_text = dispatcher.read_text()
    ast.parse(dispatcher_text, filename=str(dispatcher))
    require(plan["invocation"][2] == "hosted" and plan["invocation"][3] == plan["freshPaths"]["hostedOutput"] and plan["invocation"][4] == TARGET, "hosted invocation")
    for required in [
        "sys.argv[1:]==['--execute-after-root-release']",
        "os.environ.get('OVF_HEAVY_SLOT_RELEASE')==PIN",
        "time.monotonic()-started>1260",
        "end=time.monotonic()+8",
        "end=time.monotonic()+5",
        "child.wait(timeout=1)",
        "assert pid!=1063 and pid!=os.getpid()",
    ]:
        require(required in dispatcher_text, f"dispatcher guard {required}")
    require(
        re.search(r"subprocess\.\w+\(\s*\[['\"](?:pkill|killall)", dispatcher_text) is None,
        "global cleanup command",
    )
    supervisor_text = copied_supervisor.read_text()
    require("1200000" in supervisor_text and "generations.size, 2" in supervisor_text, "supervisor bound or generations")
    require("packageAfter, packageBefore" in supervisor_text and "verifyBrowserRuntime" in supervisor_text, "supervisor package/runtime recheck")
    require("served.filter(row => row.path === 'index.html').length, 1" in supervisor_text, "served index assertion")
    require("served.filter(row => row.path === 'favicon.ico').length, 1" in supervisor_text, "served favicon assertion")
    checks["executionEnvelope"] = {
        "dispatcherAstParsed": True,
        "supervisorCopiedByteForByte": True,
        "invocationKind": "hosted",
        "supervisorBoundSeconds": 1200,
        "dispatcherChildBoundSeconds": 1260,
        "cleanupBoundsSeconds": {"term": 8, "kill": 5, "reap": 1},
        "canonicalOrDailyInvoked": False,
        "freshPackageAndServedIdentityCapture": True,
    }

    preserved = plan["preservedOriginal473Artifacts"]
    require(len(preserved) == 7, "preserved artifact count")
    for record in preserved:
        path = Path(record["path"])
        require(path.is_file(), f"preserved artifact {path}")
        require(path.stat().st_size == record["bytes"] and sha_file(path) == record["sha256"], f"preserved bytes {path}")
    old_result = load_json(Path(preserved[0]["path"]))
    old_audit = load_json(Path(preserved[1]["path"]))
    old_summary = load_json(Path(preserved[2]["path"]))
    wire_raw = gzip.decompress(Path(preserved[3]["path"]).read_bytes())
    wire = json.loads(wire_raw)
    require(old_result["status"] == old_audit["status"] == "failed" and old_summary["passed"] is False, "original473 failure status")
    require("2 !== 1" in old_result["error"] and "uiResponse" in old_result["error"], "original473 failure reason")
    failed_4v4 = next(row for row in old_summary["layouts"] if row["name"] == "4v4")
    require("2 !== 1" in failed_4v4["error"], "4v4 failure")
    require(any(action.get("method") == "GET" and action.get("mutations") == 2 for actor in wire for action in actor["uiActions"]), "failure wire overlapping GET")
    sqlite_record = next(record for record in preserved if record["path"].endswith("server.sqlite"))
    require(sqlite_record["bytes"] == 378163200 and sqlite_record["sha256"] == "c2240e5d1482c09d637f3664388b7add6969e0dc1d036375fb8b8d9bb9b9111e", "oversized SQLite identity")
    historical = load_json(PACKET / "historical-hosted-package-identities.json")
    require(historical["sourcePin"] == ORIGINAL and historical["resultStatus"] == "failed", "historical source/status")
    require(historical["resultArtifact"] == preserved[0], "historical result identity")
    require(historical["packagesCopied"] == old_result["packages"] == old_audit["packagesBefore"], "historical package identities")
    checks["preservedOriginal473"] = {
        "artifacts": 7,
        "status": "failed",
        "failure": "GET /api/lobbies observed twice where the old helper required exactly one request",
        "failureWireUncompressedSha256": sha_bytes(wire_raw),
        "sqliteBytes": sqlite_record["bytes"],
        "sqliteSha256": sqlite_record["sha256"],
        "historicalPackageFiles": {kind: len(files) for kind, files in historical["packagesCopied"].items()},
    }

    require(sha_file(PRIOR_BASELINE) == PRIOR_BASELINE_SHA256, "prior protected-root baseline hash")
    prepared_root = load_json(PACKET / "protected-root-preparation.json")
    prior_root = load_json(PRIOR_BASELINE)
    require(prepared_root["pid"]["pid"] == prior_root["pid"] == 1063, "protected pid")
    require(prepared_root["pid"]["cmdline"] == prior_root["pidCmdline"], "protected cmdline")
    require(prepared_root["pid"]["cwd"] == prior_root["pidCwd"], "protected cwd")
    require(prepared_root["port4173"] == prior_root["port4173"], "protected port")
    require(prepared_root["rootDist"] == prior_root["rootDist"], "protected dist path")
    require(prepared_root["distFiles"] == prior_root["distFiles"] and len(prepared_root["distFiles"]) == 397, "protected dist files")
    checks["protectedRootBaseline"] = {
        "priorBaselineSha256": PRIOR_BASELINE_SHA256,
        "pid": 1063,
        "port": 4173,
        "distFiles": 397,
        "semanticFieldsEqual": ["pid", "cmdline", "cwd", "port4173", "rootDist", "distFiles"],
    }

    fresh_state = {name: Path(path).exists() for name, path in plan["freshPaths"].items()}
    require(not any(fresh_state.values()), "fresh output path already exists")
    head = git("rev-parse", "HEAD").strip()
    tracked = git("diff", "--name-only", "HEAD").strip()
    require(head == ORIGINAL and tracked == "", "owned checkout preparation state")
    checks["preDispatchState"] = {"freshPathsExist": fresh_state, "ownedCheckoutHead": head, "trackedChanges": []}

    require("export const layouts = [2, 3, 4]" in helper, "2v2/3v3/4v4 layouts")
    require("export const cooperativeLayout" in helper and "jointAiWave(watcher)" in helper, "cooperative target")
    require("verifyRestart" in helper and "expectedDelayTicks" in helper and "zero-delay spectator" in helper, "spectator/restart target")
    require("for (const layout of [...layouts, cooperativeLayout])" in helper, "layout ordering")
    require("throw error;" in helper[helper.index("for (const layout of [...layouts, cooperativeLayout])"):], "layout failure propagation")
    warnings.append({
        "id": "supplemental-4v4-precedes-runtime-targets",
        "severity": "non-blocking-execution-risk",
        "text": "The recipe calls 4v4 supplemental, but verifyBrowser runs it before the cooperative and restart/spectator targets and propagates a 4v4 error. A 4v4-only failure would make the retry inconclusive for clauses 63/64; it must not become a new admission requirement.",
    })
    warnings.append({
        "id": "no-focused-helper-regression-test",
        "severity": "non-blocking-test-gap",
        "text": "The three-line GET-count relaxation has no focused unit test. The held hosted retry is the direct regression exercise.",
    })
    checks["runtimeScope"] = {
        "admissionTargets": [
            "63: cooperative coordinated opponents",
            "64: delayed player/team and zero-delay live spectators with restart persistence",
        ],
        "supplemental": ["human 4v4"],
        "canonicalOrDailyRerun": False,
        "newAcceptanceGateAuthorized": False,
    }

    result = {
        "status": "passed",
        "reviewer": {"harness": "Codex", "model": "GPT-6 Sol"},
        "method": "Static reads, hashing, JSON parsing, Python AST parsing, and immutable Git object reads only.",
        "checks": checks,
        "warnings": warnings,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
except Exception as error:
    print(json.dumps({
        "status": "failed",
        "reviewer": {"harness": "Codex", "model": "GPT-6 Sol"},
        "error": f"{type(error).__name__}: {error}",
        "checksCompleted": checks,
        "warnings": warnings,
    }, indent=2, sort_keys=True))
    sys.exit(1)
