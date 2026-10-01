import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys

pin, build_arg, static_arg, db_arg, receipt, stage, process_id = sys.argv[1:]
assert re.fullmatch(r"[a-f0-9]{40}", pin)
source = pathlib.Path.cwd().resolve()
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == pin
build, static, db = map(lambda value: pathlib.Path(value).resolve(), [build_arg, static_arg, db_arg])
manifest_path = static.parent / 'build-manifest.json'
manifest_bytes = manifest_path.read_bytes()
manifest = json.loads(manifest_bytes)
assert manifest['sourcePin'] == pin
artifacts = {}
for name in ['rts-server.js', 'canonical-campaign.mjs', 'campaign-runtime.mjs']:
    path = build / name
    if stage == 'unavailable' and name == 'campaign-runtime.mjs':
        assert not path.exists()
        artifacts[name] = {'deliberatelyAbsent': True}
    else:
        data = path.read_bytes()
        artifacts[name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
index = (static / 'index.html').read_bytes()
result = {'format': 'ovf-scenario-owned-server-launch', 'version': 1,
          'sourceCommit': pin, 'stage': stage, 'cwd': str(source),
          'processId': int(process_id), 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'serverDirectory': str(build), 'staticDirectory': str(static), 'databaseDirectory': str(db),
          'origin': 'http://127.0.0.2:5307', 'url': 'http://127.0.0.2:5307/index.html',
          'node': subprocess.check_output(['node', '--version'], text=True).strip(),
          'bundles': artifacts,
          'controlsManifest': {'path': str(manifest_path), 'sha256': hashlib.sha256(manifest_bytes).hexdigest()},
          'index': {'sha256': hashlib.sha256(index).hexdigest(), 'bytes': len(index)},
          'ownership': 'Recipe instances hold one shared exclusive DB lock. Root confirms prior writer termination before each handoff.'}
with pathlib.Path(receipt + '.launch.json').open('x') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
