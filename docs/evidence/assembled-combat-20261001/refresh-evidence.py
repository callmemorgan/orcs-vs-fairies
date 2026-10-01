#!/usr/bin/env python3
"""Archive a combat checkpoint, then freeze evidence after the final rerun.

Run archive BEFORE overwriting checkpoint logs/downloads/screenshots. Run refresh
AFTER committing source/proof code, rebuilding, rerunning the browser and focused
tests, and finishing README/commands edits. Both commands print deterministic JSON.
No build, browser, test or Git mutation is performed by this helper.

verification-command-results.json must contain sourceCommit, sourceBuildId and a
commands array. Required names are focused-tests, typecheck, browser-build,
cli-build and server-build. Each entry contains command (argv array), log (path
relative to evidence), returncode, sourceBuildId, startedAt and completedAt.
logSha256 and sourceCommit are optional, but validated when present. Focused tests
must be named explicitly in argv so the proof manifest covers the files run.
An optional repository-tests outcome (returncode 0 or 1) refreshes the retained
baseline comparison from its completed log and rejects new failure names.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime


EVIDENCE = Path("docs/evidence/assembled-combat-20261001")
CHECKPOINT = "27cb80e6618d6bdd6a3ca9788513d8986d55b4d9"
ARCHIVE = "pre-gravecaller-27cb80e"
ROLES = ("focused-tests", "typecheck", "browser-build", "cli-build", "server-build")
REPOSITORY_ROLE = "repository-tests"
PROOF_SCRIPTS = ("scripts/combined_combat_scenarios.ts", "scripts/verify_combined_combat.mjs")
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def read_json(path: Path) -> dict:
    value = json.loads(path.read_bytes())
    require(isinstance(value, dict), f"Expected JSON object: {path}")
    return value


def git(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(repo), *args])


def commit_id(repo: Path, ref: str) -> str:
    return git(repo, "rev-parse", "--verify", f"{ref}^{{commit}}").decode().strip()


def safe_relative(value: str) -> Path:
    path = Path(value)
    require(bool(value) and not path.is_absolute() and ".." not in path.parts,
            f"Unsafe relative path: {value!r}")
    require("\n" not in value and "\r" not in value and "\\" not in value,
            f"Unsupported manifest path: {value!r}")
    return path


def regular_files(root: Path) -> list[Path]:
    require(root.is_dir(), f"Missing directory: {root}")
    entries = list(root.rglob("*"))
    require(not any(p.is_symlink() for p in entries), f"Symlinked paths are not frozen: {root}")
    paths = sorted((p for p in entries if p.is_file()), key=lambda p: p.as_posix())
    return paths


def snapshot(root: Path, paths: list[Path]) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in paths}


def manifest(contents: dict[str, bytes]) -> bytes:
    return "".join(f"{digest(contents[path])}  {path}\n" for path in sorted(contents)).encode()


def parse_manifest(data: bytes) -> dict[str, str]:
    records = {}
    for line in data.decode().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        require(match is not None, f"Malformed SHA-256 record: {line!r}")
        sha, path = match.groups()
        safe_relative(path)
        require(path not in records, f"Duplicate SHA-256 path: {path}")
        records[path] = sha
    return records


def tree_files(repo: Path, commit: str, prefix: str) -> dict[str, str]:
    paths = {}
    for item in git(repo, "ls-tree", "-r", "-z", "--full-tree", commit, "--", prefix).split(b"\0"):
        if not item:
            continue
        header, raw_path = item.split(b"\t", 1)
        mode, kind, oid = header.decode().split()
        path = raw_path.decode()
        require(kind == "blob" and mode in ("100644", "100755"),
                f"Expected regular Git source file: {path} ({mode}, {kind})")
        paths[path] = oid
    return paths


def compare_git_bytes(repo: Path, commit: str, contents: dict[str, bytes], expected: dict[str, str]) -> dict:
    extra = sorted(set(contents) - set(expected))
    missing = sorted(set(expected) - set(contents))
    rows = []
    for path in sorted(set(contents) & set(expected)):
        committed = git(repo, "cat-file", "blob", expected[path])
        actual = contents[path]
        rows.append({"path": path, "bytesMatch": actual == committed,
                     "workingTreeSha256": digest(actual), "commitSha256": digest(committed)})
    changed = [row["path"] for row in rows if not row["bytesMatch"]]
    return {"sourceCommit": commit, "allBytesMatchCommit": not (extra or missing or changed),
            "workingTreeFileCount": len(contents), "commitFileCount": len(expected),
            "extraFiles": extra, "missingFiles": missing, "changedFiles": changed, "files": rows}


def check_archive(archive: Path) -> dict:
    # The parent may already have copied the checkpoint and generated a relocated
    # archive.sha256. Validate those bytes without adding or rewriting any record.
    if not (archive / "archive-record.json").exists():
        summary = read_json(archive / "verification-summary.json")
        require(summary.get("sourceCommit") == CHECKPOINT, "Archive checkpoint identity differs")
        require(archive.parent.parent.parent.name == "docs", "Unexpected archive location")
        repo = archive.parents[3]
        hashes = parse_manifest((archive / "archive.sha256").read_bytes())
        actual = {p.relative_to(repo).as_posix(): p.read_bytes() for p in regular_files(archive)
                  if p != archive / "archive.sha256"}
        require(set(hashes) == set(actual), "Archive file set differs from archive.sha256")
        require(all(digest(data) == hashes[path] for path, data in actual.items()), "Archive bytes changed")
        return {"sourceCommit": CHECKPOINT, "checkpointFileCount": len(actual)}
    record = read_json(archive / "archive-record.json")
    require(record.get("sourceCommit") == CHECKPOINT, "Archive checkpoint identity differs")
    hashes = parse_manifest((archive / "archive-files.sha256").read_bytes())
    actual = {p.relative_to(archive).as_posix(): p.read_bytes() for p in regular_files(archive)
              if p.name != "archive-files.sha256"}
    require(set(hashes) == set(actual), "Archive file set differs from archive-files.sha256")
    require(all(digest(data) == hashes[path] for path, data in actual.items()), "Archive bytes changed")
    return record


def archive_checkpoint(repo: Path, evidence: Path) -> dict:
    archive = evidence / ARCHIVE
    if archive.exists():
        record = check_archive(archive)
        return {"action": "archive", "archive": archive.as_posix(), "alreadyExists": True,
                "sourceCommit": record["sourceCommit"], "checkpointFileCount": record["checkpointFileCount"]}
    checkpoint = commit_id(repo, CHECKPOINT)
    summary = read_json(evidence / "verification-summary.json")
    browser = read_json(evidence / "browser-combined-combat.json")
    require(summary.get("sourceCommit") == checkpoint, "Run archive before replacing the checkpoint summary")
    require(browser.get("source", {}).get("commit") == checkpoint,
            "Run archive before replacing the checkpoint browser JSON")
    require(summary.get("sourceBuildId") == browser["source"]["expectedBuildId"],
            "Checkpoint summary/browser build identities differ")
    paths = [p for p in regular_files(evidence)
             if len(p.relative_to(evidence).parts) == 1
             or not p.relative_to(evidence).parts[0].startswith(("pre-", ".pre-"))]
    frozen = snapshot(evidence, paths)
    old_source = parse_manifest(frozen["source-files.sha256"])
    committed = tree_files(repo, checkpoint, "src")
    require(set(old_source) <= set(committed), "Checkpoint source manifest has paths absent from Git")
    require(all(digest(git(repo, "cat-file", "blob", committed[path])) == sha
                for path, sha in old_source.items()), "Checkpoint source hashes differ from Git bytes")
    record = {"sourceCommit": checkpoint, "sourceBuildId": summary["sourceBuildId"],
              "browserCompletedAt": browser.get("completedAt"), "checkpointFileCount": len(frozen),
              "checkpointFiles": sorted(frozen), "sourceManifestFileCount": len(old_source),
              "sourceCommitFileCount": len(committed), "sourceManifestHashesMatchCommit": True,
              "sourceFilesAbsentFromHistoricalManifest": sorted(set(committed) - set(old_source))}
    frozen["archive-record.json"] = json_bytes(record)
    frozen["archive-files.sha256"] = manifest(frozen)
    staging = Path(tempfile.mkdtemp(prefix=f".{ARCHIVE}.", dir=evidence))
    try:
        for path, data in frozen.items():
            target = staging / safe_relative(path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        check_archive(staging)
        staging.rename(archive)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return {"action": "archive", "archive": archive.as_posix(), "alreadyExists": False,
            "sourceCommit": checkpoint, "checkpointFileCount": record["checkpointFileCount"]}


def command_outcomes(evidence: Path, source_commit: str, build_id: str) -> tuple[dict, dict, list[str]]:
    result_path = evidence / "verification-command-results.json"
    results = read_json(result_path)
    require(results.get("sourceCommit") == source_commit, "Command results sourceCommit differs")
    require(results.get("sourceBuildId") == build_id, "Command results sourceBuildId differs")
    commands = results.get("commands")
    require(isinstance(commands, list), "Command results commands must be an array")
    selected = {}
    for entry in commands:
        require(isinstance(entry, dict), "Command result must be an object")
        name = entry.get("name")
        if name == "repository-excluding-soak":
            name = REPOSITORY_ROLE
        if name not in (*ROLES, REPOSITORY_ROLE):
            continue
        require(name not in selected, f"Duplicate command outcome: {name}")
        permitted = (0, 1) if name == REPOSITORY_ROLE else (0,)
        require(entry.get("returncode") in permitted and type(entry.get("returncode")) is int,
                f"Command returncode is not admitted: {name}")
        require(entry.get("sourceBuildId") == build_id, f"Command sourceBuildId differs: {name}")
        require(entry.get("sourceCommit", source_commit) == source_commit, f"Command sourceCommit differs: {name}")
        argv = entry.get("command")
        require(isinstance(argv, list) and argv and all(isinstance(v, str) for v in argv),
                f"Command argv must be a nonempty string array: {name}")
        for key in ("startedAt", "completedAt"):
            require(isinstance(entry.get(key), str), f"Missing {key}: {name}")
        start = datetime.fromisoformat(entry["startedAt"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(entry["completedAt"].replace("Z", "+00:00"))
        require(start.tzinfo is not None and end.tzinfo is not None and start <= end,
                f"Invalid command timestamp interval: {name}")
        log_path = evidence / safe_relative(entry.get("log", ""))
        data = log_path.read_bytes()
        if "logSha256" in entry:
            require(entry["logSha256"] == digest(data), f"Command log hash differs: {name}")
        selected[name] = {**entry, "logSha256": digest(data)}
    require(set(ROLES) <= set(selected), f"Missing command outcomes: {sorted(set(ROLES) - set(selected))}")
    tests_log = ANSI.sub("", (evidence / selected["focused-tests"]["log"]).read_text())
    counts = {}
    for label, key in (("Test Files", "files"), ("Tests", "tests")):
        matches = re.findall(rf"(?m)^\s*{label}\s+(\d+) passed \((\d+)\)\s*$", tests_log)
        require(len(matches) == 1, f"Need one all-passed {label} summary in focused log")
        passed, total = map(int, matches[0])
        require(passed == total and passed > 0, f"Focused {label} count is not fully passing")
        counts[key] = passed
    test_paths = sorted({v for v in selected["focused-tests"]["command"]
                         if v.startswith("tests/") and v.endswith(".test.ts")})
    require(len(test_paths) == counts["files"], "Explicit focused test paths/count differ")
    return results, selected, test_paths


def repository_verification(evidence: Path, outcomes: dict, commit: str) -> tuple[dict, dict | None]:
    if REPOSITORY_ROLE not in outcomes:
        return {}, None
    entry = outcomes[REPOSITORY_ROLE]
    require("--exclude" in entry["command"] and "tests/skirmish.test.ts" in entry["command"],
            "Repository outcome must explicitly exclude only the retained skirmish soak")
    require(entry["command"].count("--exclude") == 1, "Unexpected extra repository exclusion")
    text = ANSI.sub("", (evidence / entry["log"]).read_text())
    parsed = {}
    for label, key in (("Test Files", "files"), ("Tests", "tests")):
        rows = re.findall(rf"(?m)^\s*{label}\s+(.+?)\s+\((\d+)\)\s*$", text)
        require(len(rows) == 1, f"Need one completed repository {label} summary")
        values, total = rows[0]
        counts = {name: int(n) for n, name in re.findall(r"(\d+) (passed|failed|skipped|todo)", values)}
        require(sum(counts.values()) == int(total), f"Repository {label} counts do not add up")
        parsed[key] = {"total": int(total), **counts}
    failures = sorted(set(re.findall(r"(?m)^\s*FAIL\s+(tests/[^\n]+?)\s*$", text)))
    failed = parsed["tests"].get("failed", 0)
    require(len(failures) == failed, "Repository failure names/count differ")
    require(entry["returncode"] == (1 if failed else 0), "Repository returncode/count disagree")
    baseline = read_json(evidence / ARCHIVE / "baseline-failure-comparison.json")
    same_names = failures == sorted(baseline["failures"])
    require(not failed or same_names, "Repository has failures outside the retained baseline")
    comparison = {"baselineCommit": baseline["baselineCommit"], "currentSourceCommit": commit,
                  "sameFailureNames": same_names, "failedTests": failed,
                  "baselineFiles": baseline["baselineFiles"], "currentFiles": parsed["files"]["total"],
                  "currentPassedTests": parsed["tests"].get("passed", 0),
                  "excluded": "tests/skirmish.test.ts", "commandLog": entry["log"], "failures": failures}
    fields = {"preAdmissionBaselineCommit": baseline["baselineCommit"],
              "baselineFailedTests": len(baseline["failures"]), "baselineFiles": baseline["baselineFiles"],
              "repositoryTestFilesExcludingSoak": parsed["files"]["total"],
              "repositoryPassedTestsExcludingSoak": parsed["tests"].get("passed", 0),
              "repositoryFailedTestsExcludingSoak": failed, "repositorySameBaselineFailureNames": same_names,
              "repositorySoakCompleted": False, "repositorySourceCommit": commit,
              "repositoryCommandLog": entry["log"]}
    old_summary = read_json(evidence / ARCHIVE / "verification-summary.json")
    if "baselinePassedTests" in old_summary:
        fields["baselinePassedTests"] = old_summary["baselinePassedTests"]
    return fields, comparison


def refresh(repo: Path, evidence: Path, ref: str, extra_proof: list[str]) -> dict:
    archive = evidence / ARCHIVE
    check_archive(archive)
    old_summary = read_json(archive / "verification-summary.json")
    commit = commit_id(repo, ref)
    require(commit_id(repo, "HEAD") == commit, "Frozen commit must be the current HEAD")
    source = snapshot(repo, regular_files(repo / "src"))
    comparison = compare_git_bytes(repo, commit, source, tree_files(repo, commit, "src"))
    require(comparison["allBytesMatchCommit"], "Source bytes differ from Git: " + json.dumps(
        {k: comparison[k] for k in ("extraFiles", "missingFiles", "changedFiles")}))
    build_inputs = {p: source[p] for p in sorted(source) if p.endswith((".ts", ".css"))}
    build_hash = hashlib.sha256()
    for path, data in build_inputs.items():
        build_hash.update(path.removeprefix("src/").encode()); build_hash.update(data)
    build_id = build_hash.hexdigest()
    _, outcomes, test_paths = command_outcomes(evidence, commit, build_id)
    proof_paths = sorted(set(PROOF_SCRIPTS) | set(test_paths) | set(extra_proof))
    for path in proof_paths:
        safe_relative(path)
        require((repo / path).is_file() and not (repo / path).is_symlink(), f"Proof code must be a regular file: {path}")
    proof = {p: (repo / p).read_bytes() for p in proof_paths}
    proof_git = {p: git(repo, "rev-parse", f"{commit}:{p}").decode().strip() for p in proof_paths}
    proof_comparison = compare_git_bytes(repo, commit, proof, proof_git)
    require(proof_comparison["allBytesMatchCommit"], "Proof code bytes differ from frozen commit")
    builds = snapshot(repo, [p for name in ("dist", "dist-cli", "dist-server")
                             for p in regular_files(repo / name)])
    require(all(p in builds for p in ("dist/index.html", "dist-cli/rts.js", "dist-server/rts-server.js")),
            "Production outputs are incomplete")
    browser = read_json(evidence / "browser-combined-combat.json")
    require(browser.get("completed") is True and browser.get("errors") == [] and "failure" not in browser,
            "Browser proof is not a completed success with no errors")
    require(browser.get("source", {}).get("commit") == commit, "Browser source commit differs")
    require(browser["source"].get("expectedBuildId") == build_id, "Browser source build ID differs")
    html_hash = digest(builds["dist/index.html"])
    require(browser["source"].get("distHtmlSha256") == html_hash == browser["source"].get("servedHtmlSha256"),
            "Browser served/local/current production HTML hashes differ")
    checks = browser.get("checks")
    require(isinstance(checks, list) and checks and all(isinstance(c.get("name"), str) for c in checks),
            "Browser check records are missing")
    require(len({c["name"] for c in checks}) == len(checks), "Duplicate browser check names")
    fixtures = read_json(evidence / "fixtures/manifest.json")
    require(browser.get("setup") == fixtures.get("setup"), "Browser/fixture setup descriptions differ")
    for name, scenario in fixtures["scenarios"].items():
        matches = [c for c in checks if c["name"] == f"Native session import preserves {name} authored world and underground troop"]
        require(len(matches) == 1, f"Missing native fixture import check: {name}")
        data = (evidence / "fixtures" / safe_relative(scenario["file"])).read_bytes()
        require(matches[0].get("scenarioSha256") == digest(data), f"Browser fixture hash differs: {name}")
    downloads = browser.get("downloads")
    require(isinstance(downloads, dict) and "production-build-report.json" in downloads,
            "Browser native report download is missing")
    for path, recorded in downloads.items():
        data = (evidence / safe_relative(path)).read_bytes()
        require(recorded.get("sha256") == digest(data) and recorded.get("bytes") == len(data),
                f"Browser download bytes/hash differ: {path}")
    report = read_json(evidence / "production-build-report.json")
    versions = report["versions"]
    require(versions["buildId"] == build_id, "Native report build ID differs")
    require(report["session"]["game"]["version"] == versions["save"], "Native report save version differs")
    require(report["session"]["game"]["state"]["tick"] == report["session"]["replay"]["finalTick"],
            "Native report game/replay final ticks differ")
    screenshots = ("orcs-line-formation", "orcs-loose-formation", "orcs-chants-and-standard", "orcs-morale-rallied",
                   "dwarves-loaded-stone-cannon", "dwarves-world-bridge-impact", "automata-relay-construction",
                   "automata-relay-connected", "orcs-formation-replay", "orcs-rally-replay", "dwarves-in-flight-replay",
                   "dwarves-impact-replay", "automata-relay-replay")
    require(all((evidence / f"{name}.png").is_file() for name in screenshots), "Production screenshots are incomplete")
    tests_log = ANSI.sub("", (evidence / outcomes["focused-tests"]["log"]).read_text())
    focused_tests = int(re.search(r"(?m)^\s*Tests\s+(\d+) passed", tests_log).group(1))
    output = {"source-files.sha256": manifest(source), "proof-code.sha256": manifest(proof),
              "production-build.sha256": manifest(builds),
              "source-byte-comparison.json": json_bytes({"source": comparison, "proofCode": proof_comparison})}
    historical_keys = ("preAdmissionBaselineCommit", "baselineFailedTests", "baselinePassedTests", "baselineFiles",
                       "repositoryTestFilesExcludingSoak", "repositoryPassedTestsExcludingSoak",
                       "repositoryFailedTestsExcludingSoak", "repositorySameBaselineFailureNames", "repositorySoakCompleted")
    summary = {"sourceCommit": commit, "sourceBuildId": build_id, "allSourceBytesMatchCommit": True,
               "allProofCodeBytesMatchCommit": True, "sourceFileCount": len(source),
               "sourceBuildInputFileCount": len(build_inputs), "proofCodeFileCount": len(proof),
               "browserChecks": len(checks), "browserErrors": browser["errors"],
               "browserCompletedAt": browser["completedAt"], "browserProductionHtmlHash": html_hash,
               "focusedTests": focused_tests, "focusedTestFiles": len(test_paths),
               "saveVersion": versions["save"], "simulationRevision": versions["simulationRevision"],
               "verificationCommandResults": "verification-command-results.json",
               "verifiedCommands": {role: {"returncode": 0, "log": outcomes[role]["log"],
                                           "logSha256": outcomes[role]["logSha256"]} for role in ROLES},
               "manifests": {name: digest(data) for name, data in output.items()},
               "historicalRepositoryVerification": {"sourceCommit": old_summary["sourceCommit"],
                   "summary": f"{ARCHIVE}/verification-summary.json",
                   **{k: old_summary[k] for k in historical_keys if k in old_summary}}}
    repository_fields, repository_comparison = repository_verification(evidence, outcomes, commit)
    summary.update(repository_fields)
    if repository_comparison is not None:
        output["baseline-failure-comparison.json"] = json_bytes(repository_comparison)
    output["verification-summary.json"] = json_bytes(summary)
    # Re-read frozen input bytes immediately before publishing the manifests.
    for contents in (source, proof, builds):
        require(all((repo / p).read_bytes() == data for p, data in contents.items()),
                "Frozen source/proof/build input changed during refresh")
    require(all(digest((evidence / entry["log"]).read_bytes()) == entry["logSha256"] for entry in outcomes.values()),
            "A verified command log changed during refresh")
    for name, data in output.items():
        (evidence / name).write_bytes(data)
    evidence_files = {p.relative_to(repo).as_posix(): p.read_bytes() for p in regular_files(evidence)
                      if p != evidence / "evidence.sha256"}
    (evidence / "evidence.sha256").write_bytes(manifest(evidence_files))
    return {"action": "refresh", "evidence": evidence.as_posix(), "sourceCommit": commit,
            "sourceBuildId": build_id, "sourceFiles": len(source), "proofCodeFiles": len(proof),
            "productionBuildFiles": len(builds), "evidenceFiles": len(evidence_files),
            "focusedTests": focused_tests, "focusedTestFiles": len(test_paths), "browserChecks": len(checks)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--evidence", type=Path, default=EVIDENCE)
    subparsers = parser.add_subparsers(dest="action", required=True)
    subparsers.add_parser("archive")
    final = subparsers.add_parser("refresh")
    final.add_argument("--commit", default="HEAD")
    final.add_argument("--proof-file", action="append", default=[])
    args = parser.parse_args()
    repo = args.repo.resolve()
    evidence = args.evidence if args.evidence.is_absolute() else repo / args.evidence
    evidence = evidence.resolve()
    require(evidence.is_relative_to(repo), "Evidence directory must be inside the source checkout")
    result = archive_checkpoint(repo, evidence) if args.action == "archive" else refresh(repo, evidence, args.commit, args.proof_file)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        print(f"Evidence freeze rejected: {error}", file=sys.stderr)
        raise SystemExit(1)
