"""Read/hash the admitted producer packet; never copies, serves, or loads modules."""
import hashlib
import json
import pathlib
import sys

def require(condition, message):
    if not condition:
        raise ValueError(message)

def receipt(raw):
    return {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}

def inventory(directory):
    files = {}
    for path in sorted(directory.rglob('*')):
        require(not path.is_symlink(), f'Unsupported symlink: {path}')
        if path.is_file():
            files[path.relative_to(directory).as_posix()] = receipt(path.read_bytes())
        else:
            require(path.is_dir(), f'Unsupported entry: {path}')
    return files

bridge_path, prepared, output = map(lambda value: pathlib.Path(value).resolve(), sys.argv[1:])
packet = prepared.parent
require(packet not in output.parents, 'Write the receipt outside the admitted producer packet')
bridge_bytes = bridge_path.read_bytes()
bridge = json.loads(bridge_bytes)
inputs = {name: (prepared / name).read_bytes()
          for name in ['prepare.json', 'build-manifest.json', 'schema.json', 'modules/manifest.json']}
preparation, build, schema, modules = [json.loads(inputs[name])
                                    for name in ['prepare.json', 'build-manifest.json', 'schema.json', 'modules/manifest.json']]
for item in [preparation, build, modules]:
    require(item['sourcePin'] == bridge['productFreeze'], 'Admitted producer must name exact453')
require(preparation['schema'] == schema == modules['schema'], 'Stored schemas differ')
require(schema['saveVersion'] == schema['replayChecksumVersion'] == schema['replayInitialSaveVersion'] == 4, 'Actual stored SAVE4 required')
require(schema['simulationRevision'] == '4.0.1', 'Actual stored rules4.0.1 required')
require(pathlib.Path(preparation['outputRoot']).resolve() == prepared, 'Producer metadata names another output')
require(pathlib.Path(preparation['distDir']).resolve() == prepared / 'dist', 'Producer dist path mismatch')
require(pathlib.Path(preparation['modulesDir']).resolve() == prepared / 'modules', 'Producer module path mismatch')
require(preparation['buildManifestSha256'] == receipt(inputs['build-manifest.json'])['sha256'], 'Build manifest hash differs')
require(preparation['moduleManifestSha256'] == receipt(inputs['modules/manifest.json'])['sha256'], 'Module manifest hash differs')
require(build['buildId'] == bridge['sourceFingerprint'], 'Producer src fingerprint differs')
counts = {}
for kind in ['sourceFiles', 'assetFiles', 'configFiles', 'scriptFiles', 'testFiles']:
    expected = {}
    for path in build[kind]:
        require(path in bridge['productInventory'], f'Input absent from453: {path}')
        item = bridge['productInventory'][path]
        expected[path] = {key: item[key] for key in ['sha256', 'bytes', 'gitBlob']}
    require(build[kind] == expected == preparation[kind], f'Producer {kind} differs from453 or prepare metadata')
    if kind in modules:
        require(modules[kind] == expected, f'Module manifest {kind} differs')
    counts[kind] = len(expected)
require(set(build['sourceFiles']) == {path for path in bridge['productInventory'] if path.startswith('src/')}, 'All src inputs required')
require(set(build['assetFiles']) == set(bridge['publicInventory']), 'All public inputs required')
source_digest = hashlib.sha256(''.join(f'{path}\0{item["sha256"]}\n'
                                     for path, item in sorted({**build['sourceFiles'], **build['configFiles']}.items())).encode()).hexdigest()
require(preparation['sourceDigest'] == modules['sourceDigest'] == source_digest, 'Producer source digest differs')
prepared_files, packet_files = inventory(prepared), inventory(packet)
actual_dist = {path[5:]: item for path, item in prepared_files.items() if path.startswith('dist/')}
require(actual_dist == build['compiledFiles'], 'Full dist bytes differ from manifest')
actual_modules = {path[8:]: item for path, item in prepared_files.items()
                  if path.startswith('modules/') and path != 'modules/manifest.json'}
require(actual_modules == modules['modules'], 'Full compiled module bytes differ from manifest')
for path, item in build['assetFiles'].items():
    require(actual_dist.get(path[7:]) == {key: item[key] for key in ['sha256', 'bytes']}, f'Public copy missing or changed: {path}')
require(inventory(packet) == packet_files, 'Admitted packet changed during the read')
require(bridge_path.read_bytes() == bridge_bytes, 'Source bridge changed during the read')
for name, raw in inputs.items():
    require((prepared / name).read_bytes() == raw, f'Producer metadata changed during the read: {name}')
result = {'format': 'ovf-admitted-453-producer-static-read-map', 'version': 1,
          'status': 'passed-file-only-read; execution-held', 'executionHeld': True,
          'sourceCommit': bridge['productFreeze'], 'rootAdmission': 'Root explicitly supplied and admitted this intact packet in the current assignment.',
          'packetRoot': str(packet), 'preparedRoot': str(prepared), 'packetFiles': len(packet_files),
          'preparedFiles': len(prepared_files), 'distFiles': len(actual_dist), 'inputCounts': counts,
          'sourceDigest': source_digest, 'schema': schema,
          'metadata': {name: {'path': str(prepared / name), **receipt(raw)} for name, raw in inputs.items()},
          'preparedInventory': prepared_files, 'packetInventory': packet_files,
          'limits': 'Read/hash mapping of existing root-admitted output only. No copy, build, test, module invocation, browser, simulation, server, or HTTP occurred.'}
with output.open('x') as stream:
    json.dump(result, stream, indent=2, sort_keys=True)
    stream.write('\n')
print(json.dumps({key: result[key] for key in ['status', 'preparedFiles', 'packetFiles', 'distFiles', 'inputCounts']}))
