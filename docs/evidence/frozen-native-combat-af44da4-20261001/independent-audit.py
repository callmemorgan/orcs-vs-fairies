import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path('/tmp/ovf-final-native-combat-20261001')
PIN = 'af44da406acf7ab44436e978cb1f571b93e28d23'
REPO = pathlib.Path('/home/morgana/Projects/orcs-vs-Fairies')


def load(path):
    return json.loads((ROOT / path).read_text())


def digest_bytes(data):
    return hashlib.sha256(data).hexdigest()


def digest_file(path):
    return digest_bytes(path.read_bytes())


def git_bytes(path):
    return subprocess.check_output(
        ['git', '-C', str(REPO), 'show', f'{PIN}:{path}']
    )


prep = load('preparation-result.json')
result = load('orchestration-result.json')
failure = load('orchestration-failure.json')
assert prep['status'] == 'prepared' and prep['sourcePin'] == PIN
assert result['status'] == 'passed' and result['sourcePin'] == PIN
assert result['nativeExportsChecked'] == 21
assert failure['sourcePin'] == PIN
assert failure['error'] == 'NameError("name \'esbuild\' is not defined")'
commands = load('commands.json')
assert commands['sourcePin'] == PIN
assert len(commands['receipts']) == 32
assert all(item['exitCode'] == 0 for item in commands['receipts'])

browser = load('browser-combined-combat.json')
assert browser['completed'] is True
assert browser['source']['commit'] == PIN
assert len(browser['checks']) == 29
assert len(browser['downloads']) == 27
assert browser['assetFailures'] == [] and browser['errors'] == []
for name, item in browser['downloads'].items():
    path = ROOT / name
    assert path.stat().st_size == item['bytes']
    assert digest_file(path) == item['sha256']
for item in browser['source']['files']:
    data = git_bytes(item['path'])
    assert len(data) == item['bytes']
    assert digest_bytes(data) == item['sha256']

parities = sorted(ROOT.glob('*.native-parity.json'))
assert len(parities) == 21
for path in parities:
    item = json.loads(path.read_text())
    assert item['sourcePin'] == PIN
    assert item['nativeDecoderPassed'] is True
    assert item['completeEnvelopeRoundtripPassed'] is True
    assert item['completeReplayEnvelopePassed'] is True
    source = pathlib.Path(item['input'])
    assert source.is_file()
    assert digest_file(source) == item['sha256']

prov = load('executable-provenance.json')
assert prov['sourcePin'] == PIN
assert len(prov['bundles']) == 3
input_count = 0
for bundle in prov['bundles']:
    bundle_path = ROOT / bundle['bundle']
    meta_path = ROOT / bundle['metafile']
    assert bundle_path.stat().st_size == bundle['bytes']
    assert digest_file(bundle_path) == bundle['sha256']
    assert digest_file(meta_path) == bundle['metafileSha256']
    for item in bundle['inputs']:
        data = git_bytes(item['path'])
        assert len(data) == item['bytes']
        assert digest_bytes(data) == item['sha256']
        assert item['matchesCommittedGitBytes'] is True
        input_count += 1
assert input_count == 144

projection = load('dwarf-cli-projection/projection.json')
assert projection['sourcePin'] == PIN
assert projection['native']['initialTick'] == 0
assert projection['native']['finalTick'] == 76
assert projection['projected']['acceptedCommands'] == 4
assert projection['projected']['completeEnvelopeParityAfterControllerProjection'] is True
assert projection['checkpoint']['native']['initialTick'] == 0
assert projection['checkpoint']['native']['finalTick'] == 42
assert projection['checkpoint']['nativeContinuation']['finalTick'] == 76
assert projection['checkpoint']['nativeContinuation']['acceptedCommands'] == 1
assert projection['checkpoint']['completeContinuationEnvelopeParity'] is True
assert load('dwarf-cli-projection/proof-build.process.json')['status'] == 0

final_hashes = set()
for directory, ticks, commands in (
    ('dwarf-packaged-full', 76, 4),
    ('dwarf-packaged-pending', 34, 1),
):
    packaged = load(f'{directory}/result.json')
    assert packaged['status'] == 'passed'
    assert packaged['source']['head'] == PIN
    assert packaged['cleanupErrors'] == []
    assert packaged['checks'][0]['ticksChecked'] == ticks
    assert packaged['checks'][0]['commandsChecked'] == commands
    assert packaged['checks'][0]['nativeSessionFinalEqual'] is True
    assert packaged['checks'][1]['rejectedRequestsPreserveState'] is True
    final_hashes.add(packaged['checks'][0]['finalSha256'])
    assert (ROOT / directory / 'source-before.json').read_bytes() == (ROOT / directory / 'source-after.json').read_bytes()
    assert (ROOT / directory / 'builds-before.json').read_bytes() == (ROOT / directory / 'builds-after.json').read_bytes()
    for process in ('main.process.json', 'continuation.process.json'):
        data = load(f'{directory}/{process}')
        assert data['code'] == 0 and data['signal'] is None
    for stderr in ('main.stderr.log', 'continuation.stderr.log'):
        assert (ROOT / directory / stderr).read_bytes() == b''
assert final_hashes == {'a1d5f45422b69c7522d531b7fda664f7f5512f5654f4dd370aa528a43ec4e6f5'}

preview = load('preview.process.json')
assert preview['exitCode'] == 143 and preview['intentionalShutdown'] is True
inspection = load('screenshot-inspection.json')
assert inspection['sourcePin'] == PIN
assert len(inspection['inspected']) == 13
assert set(inspection['inspected']) == {p.name for p in ROOT.glob('*.png')}
assert (ROOT / inspection['derivedMontage']).is_file()

manifest_lines = (ROOT / 'artifact-hashes.sha256').read_text().splitlines()
assert len(manifest_lines) == 248

print('PASS source pin:', PIN)
print('PASS command receipts: 32 of 32 exit zero')
print('PASS browser: 29 checks, 27 downloads, no recorded errors')
print('PASS native exports: 21 decoder/roundtrip/replay receipts')
print('PASS executable provenance: 3 bundles, 144 committed Git input entries')
print('PASS Dwarf projection: native 0->76, checkpoint 42->76, four plus one accepted commands')
print('PASS packaged CLI: 76 plus 34 ticks, zero exits, empty stderr, identical final SHA-256')
print('PASS screenshots: 13 files and retained montage')
print('PASS artifact manifest: 248 entries (sha256sum checked separately)')
print('RECORDED procedural failure:', failure['error'])
