import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

root = Path.cwd()
out = Path(sys.argv[1]).resolve()
phase = sys.argv[2]
out.mkdir(parents=True, exist_ok=False)
pin = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
assert not subprocess.check_output(['git', 'status', '--porcelain']), 'Root must be clean'
roots = ('src', 'tests', 'scripts', 'public')
config_names = {'package.json', 'package-lock.json', 'index.html'}

def selected(path):
    return path.split('/')[0] in roots or '/' not in path and (
        path in config_names or path.startswith(('tsconfig', 'vite.config', 'vitest.'))
    )

def snapshot():
    assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == pin
    entries = subprocess.check_output(['git', 'ls-tree', '-rz', pin]).split(b'\0')
    paths = {}
    for entry in entries:
        if not entry:
            continue
        meta, raw_path = entry.split(b'\t', 1)
        path = raw_path.decode()
        if selected(path):
            mode, kind, oid = meta.decode().split()
            assert kind == 'blob', (path, kind)
            paths[path] = (mode, oid)
    actual = set()
    for name in roots:
        for directory, dirs, files in os.walk(root / name, followlinks=False):
            if '__pycache__' in dirs:
                dirs.remove('__pycache__')
            for child in list(dirs):
                path = Path(directory) / child
                if path.is_symlink():
                    actual.add(path.relative_to(root).as_posix())
                    dirs.remove(child)
            for child in files:
                actual.add((Path(directory) / child).relative_to(root).as_posix())
    actual.update(path.name for path in root.iterdir() if path.is_file() and selected(path.name))
    assert actual == set(paths), {'extra': sorted(actual-set(paths)), 'missing': sorted(set(paths)-actual)}
    files = {}
    process = subprocess.Popen(['git', 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    try:
        for path, (mode, oid) in sorted(paths.items()):
            process.stdin.write((oid+'\n').encode()); process.stdin.flush()
            header = process.stdout.readline().decode().split()
            assert header[0] == oid and header[1] == 'blob', header
            expected = process.stdout.read(int(header[2]))
            assert process.stdout.read(1) == b'\n'
            disk = os.readlink(root/path).encode() if mode == '120000' else (root/path).read_bytes()
            assert disk == expected, f'Disk bytes differ from Git: {path}'
            files[path] = {'gitBlob': oid, 'sha256': hashlib.sha256(disk).hexdigest(), 'bytes': len(disk), 'mode': mode}
    finally:
        process.stdin.close(); process.wait()
    return {'head': pin, 'files': files}

before = snapshot()
(out/'source-before.json').write_text(json.dumps(before, indent=2)+'\n')
commands = [['npm', 'test', '--', '--reporter=default', '--reporter=json', '--outputFile.json='+str(out/'tests.json')]] if phase == 'tests' else [
    ['npm', 'run', 'build'], ['npm', 'run', 'build:cli'], ['npm', 'run', 'build:server'], ['npm', 'run', 'build:tournament']
]
report = {'head': pin, 'phase': phase, 'startedAt': datetime.now(timezone.utc).isoformat(), 'commands': [], 'runtime': {
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'npm': subprocess.check_output(['npm', '--version'], text=True).strip(),
    'dependencies': {name: json.loads((root/'node_modules'/name/'package.json').read_text())['version'] for name in ['vitest', 'typescript', 'vite', 'esbuild', 'phaser', 'ws']}
}}
failure = None
try:
    for index, command in enumerate(commands):
        log = f'command-{index+1}.log'
        with (out/log).open('xb') as handle:
            result = subprocess.run(command, stdout=handle, stderr=subprocess.STDOUT)
        report['commands'].append({'argv': command, 'log': log, 'exitCode': result.returncode})
        assert result.returncode == 0, f'Command failed: {command}'
    if phase == 'tests':
        tests = json.loads((out/'tests.json').read_text())
        assert tests['success'] and tests['numFailedTests'] == 0
        report['tests'] = {name: tests[name] for name in ['numTotalTests', 'numPassedTests', 'numFailedTests']}
        report['testFiles'] = len(tests['testResults'])
    else:
        report['compiledFiles'] = {p.relative_to(root).as_posix(): {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size} for name in ['dist', 'dist-cli', 'dist-server', 'dist-tournament'] for p in sorted((root/name).rglob('*')) if p.is_file()}
except BaseException as error:
    failure = error
    report['failure'] = str(error)
finally:
    try:
        after = snapshot()
        (out/'source-after.json').write_text(json.dumps(after, indent=2)+'\n')
        assert before == after
        assert not subprocess.check_output(['git', 'status', '--porcelain']), 'Root changed during verification'
        report['inputIntegrityPassed'] = True
    except BaseException as error:
        report['inputIntegrityPassed'] = False
        report['integrityFailure'] = str(error)
        if failure is None:
            failure = error
    report['finishedAt'] = datetime.now(timezone.utc).isoformat()
    report['passed'] = failure is None
    report['artifactHashes'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.iterdir()) if p.is_file()}
    (out/'report.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['compiledFiles', 'artifactHashes']}), flush=True)
if failure is not None:
    raise failure
