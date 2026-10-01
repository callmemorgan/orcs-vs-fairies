#!/usr/bin/env python3
"""Read-only source/target hash check for root after the import."""
from pathlib import Path
import argparse
import hashlib
import json

parser=argparse.ArgumentParser()
parser.add_argument('import_map')
parser.add_argument('repository')
args=parser.parse_args()
plan=json.loads(Path(args.import_map).read_text())
repository=Path(args.repository).resolve()
errors=[]
checks=[]
for entry in plan['entries']:
    for role,path in [('source',Path(entry['sourcePath'])),('retained',repository/entry['proposedDocsRelativeTarget'])]:
        try:
            assert path.is_file() and not path.is_symlink()
            raw=path.read_bytes()
            assert len(raw)==entry['bytes'] and hashlib.sha256(raw).hexdigest()==entry['sha256']
            assert oct(path.stat().st_mode&0o777)==entry['mode']
            checks.append({'role':role,'path':str(path),'bytes':len(raw),'sha256':entry['sha256'],'passed':True})
        except (AssertionError,OSError) as error:errors.append({'role':role,'path':str(path),'error':str(error) or 'Missing file, bytes/hash or mode mismatch'})
print(json.dumps({'status':'passed' if not errors else 'unmet','checks':checks,'errors':errors},indent=2))
raise SystemExit(1 if errors else 0)
