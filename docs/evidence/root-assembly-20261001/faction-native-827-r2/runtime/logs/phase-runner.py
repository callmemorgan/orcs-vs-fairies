import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

packet = Path('/tmp/ovf-faction-827-readiness-20261001-r2')
plan_bytes = (packet / 'execution-plan.json').read_bytes()
if hashlib.sha256(plan_bytes).hexdigest() != '53feafc6b5d9bee15dd2c20ae0b85e2485410b5e8e88666ee49e9b45f8469893':
    raise RuntimeError('Reviewed plan bytes changed')
plan = json.loads(plan_bytes)
phase = plan['phases'][int(sys.argv[1]) - 1]

def git(*args):
    return subprocess.check_output(['git', '--no-replace-objects', *args], cwd=phase['cwd'], text=True)

if git('rev-parse', 'HEAD').strip() != plan['executionPin'] or git('status', '--porcelain'):
    raise RuntimeError('Owned source changed before phase')
env = os.environ.copy()
env.pop('ESBUILD_BINARY_PATH', None)
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
started = time.monotonic()
with Path(phase['stdout']).open('xb') as out, Path(phase['stderr']).open('xb') as err:
    result = subprocess.run(phase['supervisorArgv'], cwd=phase['cwd'], env=env, stdout=out, stderr=err)
receipt = {
    'kind': 'supervised-original-faction-phase',
    'phase': phase['name'], 'sourcePin': plan['executionPin'], 'cwd': phase['cwd'],
    'argv': phase['supervisorArgv'], 'command': phase['command'], 'unit': phase['unit'],
    'activeRuntimeCapSeconds': phase['activeRuntimeCapSeconds'],
    'startupCapSeconds': phase['startupCapSeconds'], 'stopGraceSeconds': phase['stopGraceSeconds'],
    'start': start, 'end': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'observedWallSeconds': round(time.monotonic() - started, 6), 'exitCode': result.returncode,
    'stdout': phase['stdout'], 'stderr': phase['stderr'],
    'sourcePinAfter': git('rev-parse', 'HEAD').strip(), 'sourceStatusAfter': git('status', '--porcelain'),
    'rawLogHashes': {name: hashlib.sha256(Path(phase[name]).read_bytes()).hexdigest() for name in ('stdout', 'stderr')},
    'retryPerformed': False,
}
with Path(phase['receipt']).open('x') as file:
    json.dump(receipt, file, indent=2)
    file.write('\n')
print(json.dumps(receipt, indent=2))
for name in ('stdout', 'stderr'):
    lines = Path(phase[name]).read_text(errors='replace').splitlines()
    print(json.dumps({'log': phase[name], 'lastLines': lines[-15:]}))
if receipt['sourcePinAfter'] != plan['executionPin'] or receipt['sourceStatusAfter']:
    raise RuntimeError('Owned source changed during phase')
raise SystemExit(result.returncode)
