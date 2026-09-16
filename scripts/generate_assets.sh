#!/usr/bin/env bash
# Run generators one at a time: shared GPU and output paths must have one writer.
set -euo pipefail

usage() {
  cat <<'HELP'
Usage: scripts/generate_assets.sh [--pack-only] [--help]

Default: render all environment, building and unit assets sequentially in Blender,
then pack every asset kind and validate the resulting public/assets manifest.

  --pack-only  Reuse complete art/blender/raw output; skip all Blender work.
  --help       Print this help without checking dependencies or changing files.

Requires Bash, flock, Blender (except --pack-only), and .venv/bin/python with Pillow.
Run from any directory. Sources and existing .blend files remain in the repository;
generated frames, .blend files, atlases and manifest are overwritten in place.
Logs go to work/asset-generation/. Do not run other generators concurrently.
HELP
}

pack_only=false
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --pack-only) pack_only=true ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; usage >&2; exit 2 ;;
  esac
done

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$project_root"
python_bin="$project_root/.venv/bin/python"
fail() { printf 'Asset generation failed: %s\n' "$1" >&2; exit 1; }
[[ -x "$python_bin" ]] || fail 'Missing .venv/bin/python. See docs/REGENERATING_ASSETS.md for setup.'
"$python_bin" -c 'from PIL import Image' >/dev/null 2>&1 || fail 'Pillow is missing from .venv. Run .venv/bin/python -m pip install -r requirements-assets.txt.'
command -v flock >/dev/null 2>&1 || fail 'flock is missing; install util-linux before running this script.'
if [[ "$pack_only" == false ]]; then
  command -v blender >/dev/null 2>&1 || fail 'Blender is missing from PATH.'
  for generator in environment buildings units expansion world_expansion ui_orders progression fortifications; do
    [[ -f "art/blender/$generator.py" ]] || fail "Missing art/blender/$generator.py."
  done
  [[ -f art/blender/common.py ]] || fail 'Missing art/blender/common.py.'
fi
for script in pack_assets validate_assets; do
  [[ -f "scripts/$script.py" ]] || fail "Missing scripts/$script.py."
done

mkdir -p work/asset-generation
exec 9>work/asset-generation.lock
flock -n 9 || fail 'Another generate_assets.sh process holds the project lock.'
log_dir="$project_root/work/asset-generation"
trap 'printf "Asset generation stopped at line %s; inspect %s.\n" "$LINENO" "$log_dir" >&2' ERR

if [[ "$pack_only" == false ]]; then
  blender --version | tee "$log_dir/blender-version.log"
  for generator in environment buildings units expansion world_expansion ui_orders progression fortifications; do
    printf 'Generating %s assets...\n' "$generator"
    blender --background --factory-startup --python-exit-code 1 \
      --python "art/blender/$generator.py" -- --all 2>&1 | tee "$log_dir/$generator.log"
  done
fi
printf 'Packing all asset kinds...\n'
"$python_bin" scripts/pack_assets.py --kinds units buildings environment 2>&1 | tee "$log_dir/pack.log"
printf 'Validating packed assets...\n'
"$python_bin" scripts/validate_assets.py 2>&1 | tee "$log_dir/validate.log"
printf 'Generation and structural validation finished. Browser and visual review remain separate.\n'
