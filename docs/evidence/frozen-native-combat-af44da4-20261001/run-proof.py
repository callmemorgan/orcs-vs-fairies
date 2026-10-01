#!/usr/bin/env python3
"""Execute the admitted combat recipe only after root dispatches a final commit."""
import hashlib
import json
import os
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

checkout = Path('/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies')
evidence = Path(__file__).resolve().parent
browser_module = '/home/morgana/.t3/worktrees/orcs-vs-Fairies/t3code-f8849e6c/work/faction-assets/browser/node_modules/playwright-core/index.mjs'
assert len(sys.argv) == 2 and len(sys.argv[1]) == 40, 'Pass the root-dispatched full final commit.'
pin = sys.argv[1]
assert not (evidence / 'commands.json').exists(), 'Use a fresh evidence root for every final run.'
receipts = []
preview = None

def now():
    return datetime.now(timezone.utc).isoformat()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write(name, value):
    (evidence / name).write_text(json.dumps(value, indent=2) + '\n')

def git(*args):
    return subprocess.check_output(['git', *args], cwd=checkout)

def execute(label, command, env=None, timeout=240):
    print(f'Start {label}', flush=True)
    start = now()
    result = subprocess.run(command, cwd=checkout, env=env, capture_output=True, timeout=timeout)
    (evidence / f'{label}.stdout').write_bytes(result.stdout)
    (evidence / f'{label}.stderr').write_bytes(result.stderr)
    receipts.append({'label': label, 'command': command, 'cwd': str(checkout), 'startedAt': start, 'finishedAt': now(), 'exitCode': result.returncode, 'environmentOverrides': {key: env[key] for key in ['OVF_PLAYWRIGHT_MODULE', 'OVF_COMBAT_EVIDENCE', 'OVF_COMBAT_FIXTURES', 'OVF_COMBAT_FREEZE'] if env and key in env}})
    write('commands.json', {'sourcePin': pin, 'receipts': receipts})
    assert result.returncode == 0, f'{label} failed; read retained stderr.'
    print(f'Pass {label}', flush=True)

try:
    execute('checkout-final', ['git', 'switch', '--detach', pin])
    assert git('rev-parse', 'HEAD').decode().strip() == pin
    assert not git('diff', 'HEAD', '--name-only').strip(), 'Final tracked checkout must be clean.'
    write('execution-inputs.json', {'sourcePin': pin, 'checkout': str(checkout), 'orchestratorSha256': digest(Path(__file__).read_bytes()), 'playwrightModule': browser_module, 'playwrightModuleSha256': digest(Path(browser_module).read_bytes()), 'port': 5397, 'scope': 'Admitted combined native combat/faction encounters, all native exports, actual Dwarf full/pending projection and packaged CLI parity.'})
    execute('production-build', ['npm', 'run', 'build'])
    esbuild = str(checkout / 'node_modules/.bin/esbuild')
    def bundle(label, source, target):
        execute(label, [esbuild, source, '--bundle', '--platform=node', '--format=esm', f'--outfile={evidence / target}', f'--metafile={evidence / (target + ".metafile.json")}'])
    bundle('fixture-generator-build', 'scripts/combined_combat_scenarios.ts', 'fixture-generator.mjs')
    meta_path = evidence / 'fixture-generator.mjs.metafile.json'
    inputs = []
    for name, metadata in json.loads(meta_path.read_text())['inputs'].items():
        data = (checkout / name).read_bytes()
        assert len(data) == metadata['bytes']
        assert data == git('show', f'{pin}:{name}'), f'Generator input is not pinned: {name}'
        inputs.append({'path': name, 'bytes': len(data), 'sha256': digest(data)})
    execute('fixture-generation', ['node', str(evidence / 'fixture-generator.mjs'), str(evidence / 'fixtures')])
    write('generation-receipt.json', {'sourcePin': pin, 'inputs': inputs, 'bundleSha256': digest((evidence / 'fixture-generator.mjs').read_bytes()), 'metafileSha256': digest(meta_path.read_bytes()), 'generationCommand': receipts[-1], 'outputs': [{'path': str(path.relative_to(evidence)), 'bytes': path.stat().st_size, 'sha256': digest(path.read_bytes())} for path in sorted((evidence / 'fixtures').rglob('*')) if path.is_file()]})
    execute('freeze', ['node', 'scripts/verify_combined_combat.mjs', '--freeze', str(checkout), str(evidence / 'fixtures'), str(evidence / 'frozen-inputs.json'), pin])
    with socket.socket() as probe:
        assert probe.connect_ex(('127.0.0.1', 5397)) != 0, 'Port 5397 must be free.'
    preview_out = (evidence / 'preview.stdout').open('wb')
    preview_err = (evidence / 'preview.stderr').open('wb')
    preview_command = ['npm', 'run', 'preview', '--', '--host', '127.0.0.1', '--port', '5397', '--strictPort']
    preview = subprocess.Popen(preview_command, cwd=checkout, stdout=preview_out, stderr=preview_err, start_new_session=True)
    write('preview.process.json', {'command': preview_command, 'cwd': str(checkout), 'pid': preview.pid, 'startedAt': now()})
    for _ in range(100):
        assert preview.poll() is None, 'Preview exited before startup.'
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', 5397)) == 0:
                break
        time.sleep(.1)
    else:
        raise AssertionError('Preview did not listen on port5397.')
    environment = os.environ.copy()
    environment.update({'OVF_PLAYWRIGHT_MODULE': browser_module, 'OVF_COMBAT_EVIDENCE': str(evidence), 'OVF_COMBAT_FIXTURES': str(evidence / 'fixtures'), 'OVF_COMBAT_FREEZE': str(evidence / 'frozen-inputs.json')})
    execute('native-browser', ['node', 'scripts/verify_combined_combat.mjs', 'http://127.0.0.1:5397', str(checkout)], environment, timeout=600)
    browser = json.loads((evidence / 'browser-combined-combat.json').read_text())
    assert browser['completed'] and not browser['errors'] and not browser['assetFailures']
    bundle('native-checker-build', 'scripts/minimap-alerts/verify-native-export.ts', 'native-checker.mjs')
    native_exports = sorted(evidence.glob('*-save.json'))
    assert native_exports, 'Browser must retain native exports.'
    for path in native_exports:
        label = f'native-check-{path.stem}'
        execute(label, ['node', str(evidence / 'native-checker.mjs'), str(path), str(evidence / (path.stem + '.native-parity.json')), pin])
    bundle('projection-build', 'scripts/prepare_combat_cli_projection.ts', 'prepare-cli-projection.mjs')
    execute('dwarf-projection', ['node', str(evidence / 'prepare-cli-projection.mjs'), str(evidence / 'dwarves-impact-save.json'), str(evidence / 'dwarf-cli-projection'), pin, '--checkpoint', str(evidence / 'dwarves-in-flight-save.json'), '--root', str(checkout)])
    for name in ['full', 'pending']:
        execute(f'packaged-cli-{name}', ['node', 'scripts/tournaments/verify-packaged-cli-parity.mjs', str(evidence / 'dwarf-cli-projection' / f'projected-{name}.session.json'), str(evidence / f'dwarf-packaged-{name}')], timeout=600)
        assert json.loads((evidence / f'dwarf-packaged-{name}/result.json').read_text())['status'] == 'passed'
    assert git('rev-parse', 'HEAD').decode().strip() == pin
    assert not git('diff', 'HEAD', '--name-only').strip()
    write('orchestration-result.json', {'status': 'passed', 'sourcePin': pin, 'nativeExportsChecked': len(native_exports), 'commandCount': len(receipts), 'completedAt': now(), 'scope': 'Original complete native browser game equality plus explicitly labeled controller-zero CLI projection; no outer planning parity claim.'})
except BaseException as error:
    write('orchestration-failure.json', {'sourcePin': pin, 'error': repr(error), 'at': now()})
    raise
finally:
    if preview:
        import signal
        os.killpg(preview.pid, signal.SIGTERM)
        try:
            preview.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(preview.pid, signal.SIGKILL)
            preview.wait(timeout=10)
        preview_out.close()
        preview_err.close()
        record = json.loads((evidence / 'preview.process.json').read_text())
        record.update({'exitCode': preview.returncode, 'stoppedAt': now(), 'intentionalShutdown': True})
        write('preview.process.json', record)
