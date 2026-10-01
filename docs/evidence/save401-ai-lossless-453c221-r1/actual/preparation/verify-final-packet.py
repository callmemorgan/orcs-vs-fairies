#!/usr/bin/env python3
import hashlib, json, pathlib, sys

base = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'work/ai-save401-final-453c221-r1')
manifest = base / 'final-manifest.json'
value = json.loads(manifest.read_text())
actual = {}
for file in sorted(base.rglob('*')):
    if file.is_file() and file != manifest:
        data = file.read_bytes()
        actual[str(file.relative_to(base))] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
assert actual == value['files'], 'Final packet bytes or inventory changed'
print(json.dumps({'passed': True, 'sourcePin': value['sourcePin'], 'files': len(actual),
                  'manifestSha256': hashlib.sha256(manifest.read_bytes()).hexdigest()}))
