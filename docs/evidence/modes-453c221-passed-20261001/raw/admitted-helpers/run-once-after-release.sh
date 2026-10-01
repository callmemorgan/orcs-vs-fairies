#!/usr/bin/env bash
set -euo pipefail
: "${OVF_MODES_CPU_RELEASE:?Root must release CPU before this acceptance run is invoked}"
[[ "$OVF_MODES_CPU_RELEASE" == 1 ]]
final_pin="${1:?Pass the full final source pin}"
proof_checkout="${2:?Pass the fresh frozen checkout from preparation}"
proof_root="${3:?Pass the fresh prepared output from preparation}"
proof_port="${4:-9241}"
[[ "$final_pin" =~ ^[0-9a-f]{40}$ ]]
cd "$proof_checkout"
[[ "$(git rev-parse HEAD)" == "$final_pin" ]]
[[ ! -e "$proof_root/run.json" ]]
python3 - "$proof_root" "$final_pin" "$proof_port" <<'PY'
import json,sys,subprocess
from pathlib import Path
root=Path(sys.argv[1]);pin=sys.argv[2];port=int(sys.argv[3])
assert 1024<=port<=65535
prepared=json.loads((root/'prepare.json').read_text())
assert prepared['sourcePin']==pin and prepared['schema']['simulationRevision']=='4.0.1'
assert not subprocess.check_output(['ss','-ltn',f'( sport = :{port} )'],text=True).splitlines()[1:]
PY
export OVF_PLAYWRIGHT_MODULE=/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
# Replace this wrapper so interruption reaches the admitted launcher's cleanup.
exec node scripts/modes/run.mjs "$final_pin" "$proof_root" "$proof_port"
