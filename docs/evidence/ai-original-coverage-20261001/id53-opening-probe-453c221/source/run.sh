#!/usr/bin/env bash
set -euo pipefail
proof_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ $# == 3 ]] || { echo 'Usage: bash run.sh <frozen-checkout> <prepared-build-directory> <fresh-output-directory>' >&2; exit 2; }
exec node "$proof_dir/run-supervisor.mjs" "$1" "$2" "$3"
