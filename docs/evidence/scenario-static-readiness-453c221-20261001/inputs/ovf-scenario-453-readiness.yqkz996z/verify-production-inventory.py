"""After release/build: verify all public and dist bytes without loading the app."""
import hashlib
import json
import pathlib
import sys

def require(condition, message):
    if not condition:
        raise ValueError(message)

def receipt(raw):
    return {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}

bridge_path, manifest_path, output_path = map(lambda value: pathlib.Path(value).resolve(), sys.argv[1:])
bridge_bytes = bridge_path.read_bytes()
manifest_bytes = manifest_path.read_bytes()
bridge = json.loads(bridge_bytes)
manifest = json.loads(manifest_bytes)
require(manifest['sourcePin'] == bridge['productFreeze'], 'Build must name the exact453 product freeze')
require(manifest['buildId'] == bridge['sourceFingerprint'], 'Build source fingerprint mismatch')
expected_public = {path: {key: item[key] for key in ['sha256', 'bytes', 'gitBlob']}
                   for path, item in bridge['publicInventory'].items()}
require(manifest['assetFiles'] == expected_public, 'All public paths and bytes must match453, including favicon')
dist_root = manifest_path.parent / 'dist'
require(dist_root.is_dir() and not dist_root.is_symlink(), 'Use the admitted sibling dist directory')
require(output_path != dist_root and dist_root.resolve() not in output_path.parents, 'Keep the report outside dist')
compiled = {}
for path in sorted(dist_root.rglob('*')):
    require(not path.is_symlink(), f'Dist symlink is unsupported: {path}')
    if path.is_file():
        compiled[path.relative_to(dist_root).as_posix()] = receipt(path.read_bytes())
    else:
        require(path.is_dir(), f'Unsupported dist entry: {path}')
require(compiled == manifest['compiledFiles'], 'Complete actual dist inventory differs from the admitted manifest')
for path, item in expected_public.items():
    require(compiled.get(path[7:]) == {key: item[key] for key in ['sha256', 'bytes']}, f'Public bytes missing or altered in dist: {path}')
require(compiled['favicon.ico']['sha256'] == '5e0bf0f72488bc693d779cd7a3ebc7fdfca8db9916a6e3e0811fff59113253c2', 'Exact favicon must reach dist')
report = {'status': 'complete-public-and-dist-inventory-passed', 'sourceCommit': bridge['productFreeze'],
          'saveVersion': 4, 'simulationRevision': '4.0.1', 'publicFiles': len(expected_public),
          'distFiles': len(compiled), 'favicon': compiled['favicon.ico'],
          'buildManifest': {'path': str(manifest_path), **receipt(manifest_bytes)},
          'sourceBridge': {'path': str(bridge_path), **receipt(bridge_bytes)},
          'compiledFiles': compiled,
          'limits': 'File inventory proof only. Frozen pack separately fetches every dist entry before and after native browser actions.'}
require(bridge_path.read_bytes() == bridge_bytes, 'Source bridge changed during checking')
require(manifest_path.read_bytes() == manifest_bytes, 'Build manifest changed during checking')
with output_path.open('x') as stream:
    json.dump(report, stream, indent=2, sort_keys=True)
    stream.write('\n')
print(json.dumps({'status': report['status'], 'output': str(output_path), 'publicFiles': len(expected_public), 'distFiles': len(compiled)}))
