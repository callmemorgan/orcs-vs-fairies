#!/usr/bin/env python3
"""Plan file-only root admission; never copy or hash large runtime payloads."""
from pathlib import Path
from collections import Counter
import datetime, hashlib, json, subprocess, sys

BASE = Path('/home/morgana/.codex/worktrees/assembled-allied-ai')
REPO = BASE / 'orcs-vs-Fairies'
PACKET = REPO / 'work/ai-save401-final-83941bc-r1'
IMPORT = BASE / 'ai-839-runtime-import-r1'
PREFIX = 'docs/evidence/assembled-allied-ai-83941bc-runtime-r1'
phase = sys.argv[1]
assert phase in ['pre-review', 'final']
OUT = IMPORT / ('pre-review-import-plan.json' if phase == 'pre-review' else 'bounded-import-plan.json')
assert not OUT.exists(), 'Plan must be written once'

def digest(raw):
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

partition_path = IMPORT / 'packet-partition.json'
partition = json.loads(partition_path.read_bytes())
manifest = json.loads((PACKET / 'final-manifest.json').read_bytes())
entries = partition['entries']
assert len(entries) == 493
assert len({e['source_packet_relative'] for e in entries}) == 493
for e in entries:
    assert {'bytes': e['bytes'], 'sha256': e['sha256']} == manifest['files'][e['source_packet_relative']]
    assert e['logical_destination_relative'] == e['source_packet_relative']
assert sum(e['bytes'] for e in entries) == 418938592

copies = []
public = []
external = []
for e in entries:
    relative = e['source_packet_relative']
    if e['representation'] == 'native_byte_copy_required':
        copies.append({'source': str(PACKET / relative), 'destination': f'{PREFIX}/actual/{relative}', 'bytes': e['bytes'], 'sha256': e['sha256'], 'kind': 'sealed-runtime-native', 'hashBasis': 'Previously full-read authenticated immutable packet seal; no closing rehash.'})
    elif e['representation'] == 'immutable_git_object_reference':
        public.append(e)
    elif e['representation'] == 'sealed_raw_external_reference':
        external.append(e)
    else:
        raise AssertionError(e['representation'])
assert len(copies) == 98 and sum(x['bytes'] for x in copies) == 41239314
assert len(public) == 394 and sum(x['bytes'] for x in public) == 68373454
assert len(external) == 1 and external[0]['bytes'] == 309325824

manifest_raw = (PACKET / 'final-manifest.json').read_bytes()
assert digest(manifest_raw) == {'bytes': 76607, 'sha256': '71c5078ada0d33c61efd0aa5a00e9cd2f6bbe75f54bc331f9a15da511aaa5a66'}
copies.append({'source': str(PACKET / 'final-manifest.json'), 'destination': f'{PREFIX}/actual/final-manifest.json', **digest(manifest_raw), 'kind': 'original-sealed-manifest', 'hashBasis': 'Small original manifest bytes authenticated during closing.'})

directories = [
    (BASE / 'ai-839-runtime-control-r1', 'control'),
    (BASE / 'ai-839-online-optional-proof-r1', 'online-optional-proof'),
    (BASE / 'ai-839-coordination-bridge-r1', 'coordination-bridge'),
    (IMPORT, 'import-plan'),
]
if phase == 'final':
    review = BASE / 'ai-839-runtime-review-r1'
    assert review.is_dir() and (review / 'audit.json').is_file()
    directories.append((review, 'review'))
for directory, target in directories:
    for path in sorted(directory.rglob('*')):
        assert not path.is_symlink(), f'Supplemental symlink not allowed: {path}'
        if not path.is_file() or path == OUT:
            continue
        assert path.stat().st_size <= 2_000_000, f'Closing small-file budget exceeded: {path}'
        copies.append({'source': str(path), 'destination': f'{PREFIX}/{target}/{path.relative_to(directory).as_posix()}', **digest(path.read_bytes()), 'kind': 'closing-small-native', 'hashBasis': 'Direct full bytes of small external metadata/source/receipt/review.'})
assert len({x['destination'] for x in copies}) == len(copies)

old_commit = 'e665ab5bc9150a67147455a537ee470d8c0016f9'
old_prefix = 'docs/evidence/save401-ai-lossless-453c221-r1/actual/'
qualification = json.loads((BASE / 'ai-839-coordination-bridge-r1/qualification.json').read_bytes())
old_references = []
for record in qualification['permittedAuthentication']['files']:
    relative = Path(record['path']).relative_to(REPO / 'work/ai-save401-final-453c221-r1').as_posix()
    retained_path = old_prefix + relative
    # At most128374 bytes each; exact retained Git alias, not another payload copy.
    raw = subprocess.check_output(['git', 'show', f'{old_commit}:{retained_path}'], cwd=REPO)
    assert digest(raw) == {'bytes': record['bytes'], 'sha256': record['sha256']}
    blob = subprocess.check_output(['git', 'rev-parse', f'{old_commit}:{retained_path}'], cwd=REPO, text=True).strip()
    old_references.append({'sourceLocalPath': record['path'], 'commit': old_commit, 'path': retained_path, 'gitBlob': blob, 'bytes': record['bytes'], 'sha256': record['sha256'], 'actualRetainedGitBytesVerified': True})

counts = Counter(x['kind'] for x in copies)
plan = {
    'schema': 'bounded-root-import-v1', 'phase': phase,
    'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'file-only-plan-no-import',
    'repositoryRoot': '/home/morgana/Projects/orcs-vs-Fairies', 'repositoryPrefix': PREFIX,
    'sourcePin': partition['source_pin'],
    'originalPacket': {'path': str(PACKET), 'payloadEntries': 493, 'payloadBytes': 418938592, 'manifest': {'path': str(PACKET / 'final-manifest.json'), **digest(manifest_raw)}, 'all493AccountedOnce': True},
    'copies': copies,
    'nativeCopyTotals': {'files': len(copies), 'bytes': sum(x['bytes'] for x in copies), 'kindCounts': dict(counts)},
    'immutablePublicReferences': public,
    'externalRawReferences': external,
    'previouslyRetainedNaturalEvidenceReferences': old_references,
    'retainedSourceAndRegressionReferences': [
        {'commit': '83941bc80ce9ec08840b0645d9b33e8018d5309a', 'tree': 'f881294cb0479a6d1ed4f00112ac7f9cfa6c0551', 'requirement': 'Keep this immutable source/public tree and all referenced blob objects reachable.'},
        {'retainedAtCommit': '83941bc80ce9ec08840b0645d9b33e8018d5309a', 'testedSourcePin': '4a71cd07bacc12d214acaf5a0f95a7d9b486f52c', 'path': 'docs/evidence/root-assembly-20261001/combined-rules401-passing-suite-4a71cd0', 'qualification': 'Passing2920 suite retained in source history; exact artifact authentication remains attributed to root and selected metadata/assertions are qualified in coordination-bridge/qualification.json. The containing839 Git tree and sixfile blob entries were directly inspected before this plan was written; the suite test source remains4a71.'},
        {'commit': '202b739fb398d1f94fd2c53f659e10860eba3fc6', 'path': 'docs/evidence/ai-83941bc-retry-preparation-20261001', 'qualification': 'All45static preparation bytes authenticated before assigned retry; retained original preparation is reused.'},
        {'commit': '1c064c4', 'path': 'docs/evidence/serial-ai839-to-combatf18-transfer-20261001', 'qualification': 'Existing root closure receipt retention; new plan also preserves original native controls and packet manifest.'},
    ],
    'admissionEvidence': {'concrete63': 'control/closing/coordination-admission.json', 'rootDirectSQLiteEquality': 'control/closing/root-coordination-readback.json', 'unchangedSourceNaturalBridge': 'coordination-bridge/qualification.json', 'externalOnlineCandidate': 'online-optional-proof/candidate/verify_assembled_online.mjs', 'candidateReadback': 'control/closing/candidate-readback.json', 'distinctOutcomes': {'coop': 'passed14checks', 'online': 'failed-after6partialchecks-completedfalse'}, 'qualification': 'Concrete small63 evidence is separate from complete493packet retention. No human objective completion or co-op victory claim; online remains failed.'},
    'importRequirements': ['Root alone copies exact allowlisted native files and commits any repository/trail/ledger changes.', 'For every copied file, verify destination full-byte size and SHA256 against this plan. Do not report import completed before destination readback.', 'Reference394public files through complete immutable Git index and keep839 source objects reachable; do not duplicate them.', 'Keep the sealed raw309325824byte SQLite at its external path under its recorded SHA. No closing codec, largeDBhash, copy or deletion is authorized.', 'Keep all original failed/native candidate/qualification bytes. No source or product patch is applied by this plan.', 'Do not relabel online failure or treat pure Node candidate qualification as browser acceptance.'],
    'planSelfRetention': 'This plan excludes its own bytes to avoid self-reference. Root must retain the original plan under import-plan and verify the separately supplied final size/SHA256.',
    'limits': ['Runtime payload seals are reused after their earlier full-read authentication; no new runtime or large-payload hash occurred.', 'No raw workspace transcript directory exists; trail review must state this gap and use receipts/current compacted context.', 'Later stored co-op frames differ from the short browser observation interval.', 'Final plan adds reviewer artifacts and final trail checkpoint to the same pre-reviewed native/public/external partition; it does not alter original packet/candidate/qualification bytes.'],
}
OUT.write_text(json.dumps(plan, indent=2) + '\n')
print(json.dumps({'plan': str(OUT), **digest(OUT.read_bytes()), 'nativeCopyTotals': plan['nativeCopyTotals'], 'publicReferenceFiles': len(public), 'externalRawFiles': len(external)}, indent=2))
