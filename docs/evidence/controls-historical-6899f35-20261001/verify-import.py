#!/usr/bin/env python3
"""Verify preserved historical captures, optionally against their original archive."""

import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", type=Path, help="Original control-evidence directory")
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    manifest = json.loads((base / "import-manifest.json").read_text())
    rows = manifest["files"]
    expected_paths = {row["path"] for row in rows}
    actual_paths = {
        path.relative_to(base).as_posix()
        for path in (base / "control-evidence").rglob("*")
        if path.is_file()
    }
    assert actual_paths == expected_paths, "Preserved file inventory differs from manifest"
    assert len(rows) == manifest["count"] == 69, "Preserved file count differs"
    total_bytes = 0
    for row in rows:
        path = base / row["path"]
        data = path.read_bytes()
        assert len(data) == row["bytes"], f"Byte count differs: {row['path']}"
        assert hashlib.sha256(data).hexdigest() == row["sha256"], f"Hash differs: {row['path']}"
        if args.original:
            relative = Path(row["path"]).relative_to("control-evidence")
            assert data == (args.original / relative).read_bytes(), f"Original differs: {relative}"
        total_bytes += len(data)
    assert total_bytes == manifest["bytes"], "Total bytes differ"
    expected_tsv = "sha256\tbytes\tpath\n" + "".join(
        f"{row['sha256']}\t{row['bytes']}\t{row['path']}\n" for row in rows
    )
    assert (base / "import-hashes.tsv").read_text() == expected_tsv, "TSV differs from manifest"
    print(json.dumps({
        "historicalSourcePin": manifest["historicalSourcePin"],
        "preservedFiles": len(rows),
        "preservedBytes": total_bytes,
        "sha256Matches": len(rows),
        "originalByteEquality": True if args.original else None,
        "historicalEvidenceOnly": True,
    }, indent=2))


if __name__ == "__main__":
    main()
