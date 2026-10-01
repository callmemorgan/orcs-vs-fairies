import hashlib
import json
import pathlib
import re
import subprocess
import sys

pin, rules, destination = sys.argv[1:]
assert re.fullmatch(r'[0-9a-f]{40}', pin), 'Supply a full source commit.'
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == pin
tree = subprocess.check_output(['git', 'ls-tree', '-r', '-z', pin])
files = {}
for raw in tree.split(b'\0'):
    if not raw:
        continue
    metadata, path_bytes = raw.split(b'\t', 1)
    mode, kind, blob_bytes = metadata.split()
    path = path_bytes.decode()
    assert kind == b'blob' and mode in [b'100644', b'100755'], path
    actual = pathlib.Path(path).read_bytes()
    native_blob = hashlib.sha1(f'blob {len(actual)}\0'.encode() + actual).hexdigest()
    assert native_blob == blob_bytes.decode(), f'Frozen source differs: {path}'
    files[path] = {'sha256': hashlib.sha256(actual).hexdigest(), 'bytes': len(actual), 'gitBlob': native_blob}
for directory in ['src', 'public']:
    actual_paths = sorted(str(path) for path in pathlib.Path(directory).rglob('*') if path.is_file())
    assert actual_paths == sorted(path for path in files if path.startswith(directory + '/')), directory
    assert not any(path.is_symlink() for path in pathlib.Path(directory).rglob('*')), directory
save_source = pathlib.Path('src/core/saves.ts').read_text()
rules_source = pathlib.Path('src/core/versions.ts').read_text()
assert re.search(r'export const SAVE_VERSION\s*=\s*4\b', save_source)
assert re.search(r"SIMULATION_REVISION\s*=\s*['\"]([^'\"]+)", rules_source).group(1) == rules
dependencies = {}
for package in ['esbuild', 'vitest', 'typescript', 'vite', 'ws']:
    metadata = pathlib.Path('node_modules') / package / 'package.json'
    raw = metadata.read_bytes()
    dependencies[package] = {'version': json.loads(raw)['version'], 'path': str(metadata.resolve()),
                             'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
result = {'format': 'orcs-vs-fairies-native-scenario-authenticated-inputs', 'version': 1,
          'sourceCommit': pin, 'simulationRevision': rules, 'saveVersion': 4, 'files': files,
          'runtime': {'node': subprocess.check_output(['node', '--version'], text=True).strip(),
                      'git': subprocess.check_output(['git', '--version'], text=True).strip(),
                      'dependencies': dependencies}}
with pathlib.Path(destination).open('x') as stream:
    json.dump(result, stream, indent=2, sort_keys=True)
    stream.write('\n')
print(json.dumps({'sourceCommit': pin, 'simulationRevision': rules, 'trackedFiles': len(files), 'destination': destination}))
