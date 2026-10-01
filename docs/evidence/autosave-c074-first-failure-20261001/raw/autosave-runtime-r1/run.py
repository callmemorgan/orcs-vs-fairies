import hashlib
import json
import os
import pathlib
import shutil
import signal
import subprocess
import time
import urllib.request

product = pathlib.Path('/home/morgana/.codex/worktrees/assembled-rules401/orcs-vs-Fairies')
proof = pathlib.Path('/home/morgana/Projects/orcs-vs-fairies-autosave-proof')
product_pin = 'c074cc5e610fc128d7b6ac894a61258d418463d4'
proof_pin = '9e5fd2340b9a0823d1ab9f566c52b947a094278e'
parent = product / 'work/verification/ui-c074cc5-20261001'
prepared = parent / 'prepared'
evidence = parent / 'autosave-browser-r1'
runtime = parent / 'autosave-runtime-r1'
node = shutil.which('node')
base = 'http://127.0.0.1:5299/'
receipt = {'productPin': product_pin, 'proofPin': proof_pin, 'port': 5299,
           'base': base, 'preparation': str(prepared), 'evidence': str(evidence),
           'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'steps': [], 'result': 'running'}

def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

def persist():
    save_json(runtime / 'run.json', receipt)

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args]).decode().strip()

def fingerprint(path):
    assert path.is_file() and not path.is_symlink(), str(path)
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def inventory(root):
    return {str(path.relative_to(root)): fingerprint(path)
            for path in sorted(root.rglob('*')) if path.is_file()}

def seal():
    assert git(product, 'rev-parse', 'HEAD') == product_pin
    assert git(proof, 'rev-parse', 'HEAD') == proof_pin
    assert git(product, 'status', '--porcelain') == ''
    assert git(proof, 'status', '--porcelain') == ''
    preparation = json.loads((prepared / 'prepare.json').read_text())
    assert preparation['sourcePin'] == product_pin
    inputs = {}
    for group in ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles']:
        for name, expected in preparation[group].items():
            actual = fingerprint(product / name)
            assert actual['bytes'] == expected['bytes'] and actual['sha256'] == expected['sha256'], name
            inputs[name] = actual
    source = {str(path.relative_to(proof)): fingerprint(path)
              for path in sorted((proof / 'scripts/session-recovery').rglob('*')) if path.is_file()}
    return {'productPin': product_pin, 'proofPin': proof_pin, 'inputCount': len(inputs),
            'inputs': inputs, 'proofFiles': source, 'preparedFiles': inventory(prepared)}

env = dict(os.environ)
env.update(OVF_PROOF_DIST=str(prepared / 'dist'), OVF_PROOF_MODULES=str(prepared / 'modules'),
           OVF_PROOF_SCHEMA_MODULE=str(prepared / 'modules/schema.mjs'),
           OVF_PLAYWRIGHT_MODULE='/home/morgana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
           OVF_CHROMIUM_EXECUTABLE='/home/morgana/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome')
receipt['node'] = {'path': node, 'version': subprocess.check_output([node, '--version']).decode().strip()}
receipt['environment'] = {key: value for key, value in env.items() if key.startswith('OVF_')}

def run_step(name, args, timeout=240):
    step = {'name': name, 'args': args, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    receipt['steps'].append(step)
    persist()
    with (runtime / (name + '.log')).open('x') as log:
        child = subprocess.Popen(args, cwd=product, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        step['pid'] = child.pid
        persist()
        try:
            step['exitCode'] = child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            step['timedOut'] = True
            os.killpg(child.pid, signal.SIGTERM)
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
            step['exitCode'] = child.returncode
        finally:
            step['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            persist()
    assert step['exitCode'] == 0 and not step.get('timedOut'), name + ' failed; first output preserved'
    print(json.dumps({'step': name, 'exitCode': step['exitCode']}), flush=True)

preview = None
preview_log = None
try:
    assert not evidence.exists(), 'Browser output must be fresh'
    before = seal()
    save_json(runtime / 'inputs-before.json', before)
    listeners = subprocess.check_output(['ss', '-ltnp', '( sport = :5299 )']).decode()
    assert len(listeners.strip().splitlines()) == 1, 'Owned port 5299 must be unused'
    receipt['listenersBefore'] = listeners
    preview_log = (runtime / 'preview.log').open('x')
    preview_args = [node, str(product / 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1',
                    '--port', '5299', '--strictPort', '--outDir', str(prepared / 'dist')]
    preview = subprocess.Popen(preview_args, cwd=product, env=env, stdout=preview_log, stderr=subprocess.STDOUT, start_new_session=True)
    receipt['preview'] = {'pid': preview.pid, 'args': preview_args}
    persist()
    for _ in range(60):
        assert preview.poll() is None, 'Preview exited before readiness'
        try:
            with urllib.request.urlopen(base, timeout=1) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(.25)
    else:
        raise AssertionError('Preview never became ready')
    receipt['listenersRunning'] = subprocess.check_output(['ss', '-ltnp', '( sport = :5299 )']).decode()
    assert str(preview.pid) in receipt['listenersRunning'], 'Observed preview listener belongs to owned PID'
    persist()
    print(json.dumps({'previewPid': preview.pid, 'port': 5299, 'inputCount': before['inputCount']}), flush=True)
    run_step('browser', [node, str(proof / 'scripts/session-recovery/verify-autosave.mjs'), base,
                        str(product), product_pin, str(evidence), proof_pin])
    browser_receipt = json.loads((evidence / 'browser-proof.json').read_text())
    assert browser_receipt['result'] == 'passed' and len(browser_receipt['checks']) == 6
    receipt['browserReceipt'] = fingerprint(evidence / 'browser-proof.json')
    for name in ['recovered', 'continued', 'imported']:
        filename = 'native-' + name + '.json'
        run_step('authenticate-' + name, [node, str(proof / 'scripts/session-recovery/native-downloads.mjs'),
                                         str(evidence), filename, str(evidence / 'browser-proof.json')], timeout=30)
        run_step('validate-' + name, [node, str(prepared / 'modules/verify-native.mjs'), str(evidence / filename),
                                     str(runtime / (name + '-verification.json')), product_pin])
    receipt['result'] = 'passed'
except Exception as error:
    receipt['result'] = 'failed'
    receipt['failure'] = str(error)
finally:
    if preview:
        if preview.poll() is None:
            os.killpg(preview.pid, signal.SIGTERM)
            try:
                preview.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(preview.pid, signal.SIGKILL)
                preview.wait()
        receipt['preview']['exitCode'] = preview.returncode
        receipt['preview']['closed'] = preview.poll() is not None
        receipt['preview']['pidAbsent'] = not pathlib.Path('/proc/' + str(preview.pid)).exists()
    if preview_log:
        preview_log.close()
    receipt['listenersAfter'] = subprocess.check_output(['ss', '-ltnp', '( sport = :5299 )']).decode()
    receipt['portClosed'] = len(receipt['listenersAfter'].strip().splitlines()) == 1
    try:
        after = seal()
        save_json(runtime / 'inputs-after.json', after)
        assert before == after, 'Frozen product, proof and preparation bytes changed during run'
        assert receipt['portClosed'] and (not preview or receipt['preview']['pidAbsent'])
        if evidence.exists():
            save_json(runtime / 'browser-output-manifest.json', inventory(evidence))
        receipt['frozenBytesUnchanged'] = True
    except Exception as error:
        receipt['result'] = 'failed'
        receipt['cleanupFailure'] = str(error)
    receipt['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    persist()
    manifest = inventory(runtime)
    manifest.pop('full-manifest.json', None)
    save_json(runtime / 'full-manifest.json', {'browser': inventory(evidence) if evidence.exists() else {}, 'runtime': manifest})
    print(json.dumps({'result': receipt['result'], 'steps': len(receipt['steps']), 'portClosed': receipt['portClosed'],
                      'frozenBytesUnchanged': receipt.get('frozenBytesUnchanged'), 'runtime': str(runtime)}), flush=True)

raise SystemExit(0 if receipt['result'] == 'passed' else 1)
