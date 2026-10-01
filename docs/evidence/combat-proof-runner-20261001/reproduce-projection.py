#!/usr/bin/env python3
"""Run the retained adapter preparation in an isolated, pinned source checkout."""
import io
import hashlib
import json
import subprocess
import sys
import tarfile
from pathlib import Path

proof = Path(__file__).resolve().parent
root = proof.parents[2]
source_ref = sys.argv[1] if len(sys.argv) > 1 else "3f963008a3ce79e4615a8ca115954f9f4ce077ab"
assert len(sys.argv) > 2, "Pass SOURCE_REF NEW_OUTPUT_DIRECTORY."
output = Path(sys.argv[2]).resolve()
output.mkdir()
scratch = output / "source"
scratch.mkdir()

def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)

source_ref = git("rev-parse", f"{source_ref}^{{commit}}").decode().strip()
archive = git("archive", source_ref, "src", "scripts/prepare_combat_cli_projection.ts", "package.json", "tsconfig.json")
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    tar.extractall(scratch, filter="data")
subprocess.run(["git", "init", "--quiet", str(scratch)], check=True)
common = (root / git("rev-parse", "--git-common-dir").decode().strip()).resolve()
(scratch / ".git/objects/info/alternates").write_text(str(common / "objects") + "\n")
(scratch / ".git/HEAD").write_text(source_ref + "\n")
subprocess.run(["git", "read-tree", source_ref], cwd=scratch, check=True)
dependencies = (root / "node_modules").resolve()
(scratch / "node_modules").symlink_to(dependencies, target_is_directory=True)
work = scratch / "work"
work.mkdir()
producer = (proof / "projection-fixture.ts.txt").read_text()
producer = producer.replace("const ROOT = '/tmp/combat-cli-parity-b2e8e6-rHYrDn';", f"const ROOT = {json.dumps(str(scratch))};")
producer = producer.replace("const PIN = 'b2e8e6daa87dc38d0d37e547afe465052103a436';", f"const PIN = {json.dumps(source_ref)};")
(work / "combat-projection-fixture.ts").write_text(producer)
(work / "combat-projection-faults.ts").write_bytes((proof / "projection-faults.ts.txt").read_bytes())
receipts = []

def execute(label, command):
    run = subprocess.run(command, cwd=scratch, capture_output=True, text=True, timeout=60)
    (output / f"{label}.stdout").write_text(run.stdout)
    (output / f"{label}.stderr").write_text(run.stderr)
    receipts.append({"label": label, "command": command, "cwd": str(scratch), "exitCode": run.returncode})
    (output / "commands.json").write_text(json.dumps({"sourceRef": source_ref, "receipts": receipts}, indent=2) + "\n")
    assert run.returncode == 0, f"{label}: {run.stderr}"

esbuild = str(root / "node_modules/.bin/esbuild")
for label, source, target in [
    ("adapter-build", "scripts/prepare_combat_cli_projection.ts", "work/prepare-combat-cli-projection.mjs"),
    ("fixture-build", "work/combat-projection-fixture.ts", "work/combat-projection-fixture.mjs"),
    ("fault-build", "work/combat-projection-faults.ts", "work/combat-projection-faults.mjs"),
]:
    execute(label, [esbuild, source, "--bundle", "--platform=node", "--format=esm", f"--outfile={target}", f"--metafile={target}.metafile.json"])
# Bind the executed public producer to its recorded source inputs before generation.
producer_inputs = []
producer_meta = work / "combat-projection-fixture.mjs.metafile.json"
for name, metadata in json.loads(producer_meta.read_text())["inputs"].items():
    input_path = scratch / name
    input_bytes = input_path.read_bytes()
    assert len(input_bytes) == metadata["bytes"], f"Producer input size changed: {name}"
    committed = name.startswith("src/")
    if committed:
        assert input_bytes == git("show", f"{source_ref}:{name}"), f"Producer input differs from pinned Git: {name}"
    else:
        assert name == "work/combat-projection-fixture.ts", f"Unexpected uncommitted producer input: {name}"
    producer_inputs.append({"path": name, "bytes": len(input_bytes), "sha256": hashlib.sha256(input_bytes).hexdigest(), "committed": committed})
execute("fixture-generation", ["node", "work/combat-projection-fixture.mjs", "work/projection-fixtures"])
producer_receipt = {"sourceRef": source_ref, "inputs": producer_inputs,
                    "producerSha256": hashlib.sha256((work / "combat-projection-fixture.ts").read_bytes()).hexdigest(),
                    "bundleSha256": hashlib.sha256((work / "combat-projection-fixture.mjs").read_bytes()).hexdigest(),
                    "metafileSha256": hashlib.sha256(producer_meta.read_bytes()).hexdigest(),
                    "generationCommand": receipts[-1],
                    "outputs": [{"path": str(path.relative_to(work)), "bytes": path.stat().st_size,
                                 "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                                for path in sorted((work / "projection-fixtures").iterdir()) if path.is_file()]}
(output / "generation-receipt.json").write_text(json.dumps(producer_receipt, indent=2) + "\n")
for label, checkpoint in [("pending", "pending.session.json"), ("coalesced", "coalesced-pending.session.json")]:
    execute(label, ["node", "work/prepare-combat-cli-projection.mjs", "work/projection-fixtures/final.session.json", f"work/{label}-projection", source_ref, "--checkpoint", f"work/projection-fixtures/{checkpoint}", "--root", str(scratch)])
execute("faults", ["node", "work/combat-projection-faults.mjs", source_ref, "retained"])
print(json.dumps({"sourceRef": source_ref, "output": str(output), "faultResult": str(work / f"projection-fault-proof-{source_ref[:7]}-retained/result.json")}))
