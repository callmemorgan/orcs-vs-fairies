#!/usr/bin/env bash
set -euo pipefail
: "${SOURCE_ROOT:?SOURCE_ROOT must contain the source revision under test}"
: "${PRIVATE_ARCHIVE_DIR:?PRIVATE_ARCHIVE_DIR must name a private artifact directory}"
proof_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source_root=$(realpath -- "$SOURCE_ROOT")
archive_dir=$(realpath -m -- "$PRIVATE_ARCHIVE_DIR")
esbuild_bin=${ESBUILD_BIN:-$source_root/node_modules/.bin/esbuild}
if [[ -e "$archive_dir" ]]; then
  echo 'Proof outputs are append-only; choose a new archive directory.' >&2
  exit 1
fi
mkdir -p -- "$archive_dir"
"$esbuild_bin" "$proof_dir/carryover-proof.ts" --bundle --platform=node --format=esm --alias:review-source="$source_root/src" --alias:review-scripts="$source_root/scripts" --outfile="$archive_dir/carryover-proof.mjs" --metafile="$archive_dir/bundle-meta.json"
SOURCE_ROOT="$source_root" PRIVATE_ARCHIVE_DIR="$archive_dir" PROOF_DIRECTORY="$proof_dir" python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
source_root = Path(os.environ['SOURCE_ROOT'])
archive_dir = Path(os.environ['PRIVATE_ARCHIVE_DIR'])
proof_dir = Path(os.environ['PROOF_DIRECTORY'])
meta = json.loads((archive_dir/'bundle-meta.json').read_text())
hashes = {}
for name in meta['inputs']:
    path = Path(name).resolve()
    try:
        relative = path.relative_to(source_root)
    except ValueError:
        continue
    hashes[str(relative)] = hashlib.sha256(path.read_bytes()).hexdigest()
manifest = {'sourceRoot': str(source_root), 'sourceRevision': os.environ.get('SOURCE_REVISION', 'unspecified'), 'geometryDependencyRevision': 'd1171b9', 'runnerSha256': hashlib.sha256((proof_dir/'carryover-proof.ts').read_bytes()).hexdigest(), 'launcherSha256': hashlib.sha256((proof_dir/'run-carryover-proof.sh').read_bytes()).hexdigest(), 'sourceHashes': hashes}
(archive_dir/'source-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest))
PY
SOURCE_ROOT="$source_root" PRIVATE_ARCHIVE_DIR="$archive_dir" node "$archive_dir/carryover-proof.mjs"
PRIVATE_ARCHIVE_DIR="$archive_dir" python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
archive_dir = Path(os.environ['PRIVATE_ARCHIVE_DIR'])
journals = [{'path': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size} for path in sorted(archive_dir.glob('*-recording.json'))]
print(json.dumps({'journals': journals}))
PY
