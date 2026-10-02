#!/usr/bin/env python3
"""Read the protected root process, socket and dist; never signal or write them."""
import hashlib
import json
import os
from pathlib import Path
import sys

def process(pid):
    p = Path('/proc') / str(pid)
    fields = (p / 'stat').read_text().rsplit(') ', 1)[1].split()
    return {'pid': pid, 'startTicks': int(fields[19]), 'exe': os.readlink(p / 'exe'),
            'cwd': os.readlink(p / 'cwd'),
            'argv': [a.decode() for a in (p / 'cmdline').read_bytes().split(b'\0') if a]}

def listeners(port):
    result = []
    for name in ('tcp', 'tcp6'):
        for line in (Path('/proc/net') / name).read_text().splitlines()[1:]:
            fields = line.split()
            if int(fields[1].rsplit(':', 1)[1], 16) == port and fields[3] == '0A':
                inode = fields[9]
                holders = []
                for p in Path('/proc').iterdir():
                    if not p.name.isdigit():
                        continue
                    try:
                        if any(os.readlink(fd) == 'socket:[' + inode + ']' for fd in (p / 'fd').iterdir()):
                            holders.append(process(int(p.name)))
                    except (FileNotFoundError, PermissionError, ProcessLookupError):
                        pass
                result.append({'network': name, 'localAddress': fields[1],
                               'inode': inode, 'holders': holders})
    return result

dist = Path('/home/morgana/Projects/orcs-vs-Fairies/dist')
files = {}
for path in sorted(dist.rglob('*')):
    assert not path.is_symlink(), 'Protected dist symlink needs explicit preservation'
    if path.is_file():
        sha = hashlib.sha256()
        total = 0
        with path.open('rb') as handle:
            while block := handle.read(1024 * 1024):
                sha.update(block)
                total += len(block)
        files[str(path.relative_to(dist))] = {'bytes': total, 'sha256': sha.hexdigest()}
record = {'protectedPid1063': process(1063), 'protectedPort4173Listeners': listeners(4173),
          'protectedDist': str(dist), 'protectedDistFiles': files,
          'ownedPort5371Listeners': listeners(5371)}
assert any(any(h['pid'] == 1063 for h in row['holders'])
           for row in record['protectedPort4173Listeners']), 'Protected owner is absent'
if len(sys.argv) > 2:
    old = json.loads(Path(sys.argv[2]).read_text())
    for key in ('protectedPid1063', 'protectedPort4173Listeners', 'protectedDist', 'protectedDistFiles'):
        assert record[key] == old[key], 'Protected root changed: ' + key
    record['protectedIdentityAndBytesEqualToBaseline'] = True
with Path(sys.argv[1]).open('x') as out:
    json.dump(record, out, indent=2)
    out.write('\n')
print(json.dumps({'protectedPid': 1063, 'protectedStartTicks': record['protectedPid1063']['startTicks'],
                  'protectedDistFiles': len(files), 'protectedDistBytes': sum(r['bytes'] for r in files.values()),
                  'port5371Listeners': len(record['ownedPort5371Listeners']),
                  'equalToBaseline': len(sys.argv) > 2}))
