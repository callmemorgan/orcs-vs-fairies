#!/usr/bin/env python3
"""Read small native co-op artifacts and bind them to frozen source/build seals."""
from pathlib import Path
import datetime, hashlib, json, subprocess

BASE = Path('/home/morgana/.codex/worktrees/assembled-allied-ai')
REPO = BASE / 'orcs-vs-Fairies'
PACKET = REPO / 'work/ai-save401-final-83941bc-r1'
CONTROL = BASE / 'ai-839-runtime-control-r1'
PIN = '83941bc80ce9ec08840b0645d9b33e8018d5309a'
OUT = CONTROL / 'closing/coordination-admission.json'
assert not OUT.exists(), 'Append-only receipt must be fresh'

def digest(data):
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
def read(path):
    return json.loads(path.read_bytes())
checks = []
def check(name, condition, details=None):
    assert condition, name
    checks.append({'name': name, 'passed': True, 'details': details})

sealed = read(PACKET / 'final-manifest.json')
def packet_read(relative):
    path = PACKET / relative
    raw = path.read_bytes()
    check(f'small packet metadata remains sealed: {relative}', digest(raw) == sealed['files'][relative], digest(raw))
    return json.loads(raw)

coop = packet_read('coop-ui/results.json')
build = packet_read('envelopes/build-server/artifacts.json')
source = packet_read('envelopes/build-server/source-before.json')
audit = packet_read('audits/build-server-envelope.json')
check('co-op14-check UI outcome remains distinct and passed', coop['completed'] is True and len(coop['checks']) == 14)
limit = 'This proves human co-op, shared team vision, and autonomous combat from both AI opponents. It does not prove synchronized AI waves or a shared target planner; the current AI makes per-player decisions.'
check('original co-op limit sentence preserved verbatim', limit in coop['limits'])

extraction = read(CONTROL / 'coordination/closed-coop-extraction.json')
comparison = read(CONTROL / 'coordination/closed-coop-coordination-readback.json')
row = extraction['row']
check('closed match and lobby match the passed UI report', row['id'] == coop['matchId'] == comparison['match_id'] and row['lobby_id'] == coop['lobbyId'])
server = build['work/ai-save401-final-83941bc-r1/server']['rts-server.js']
check('same-match engine hash equals sealed compiled839 authoritative server hash', row['engine_hash'] == server['sha256'], server)
check('839 source and build envelope retained', source['sourcePin'] == audit['sourcePin'] == PIN and audit['result'] == 'passed' and audit['sourceBeforeAfterEqual'] and audit['sameSourceAsFreshWebBuild'])

source_records = {}
for relative in ['src/core/team-ai.ts', 'src/core/simulation.ts', 'src/server/server.ts', 'scripts/ai/team-regression.test.ts']:
    raw = (REPO / relative).read_bytes()
    pinned = subprocess.check_output(['git', 'show', f'{PIN}:{relative}'], cwd=REPO)
    record = next(group[relative] for group in source.values() if isinstance(group, dict) and relative in group)
    check(f'small source bytes equal pinned Git and bound build source: {relative}', raw == pinned and digest(raw) == {'bytes': record['bytes'], 'sha256': record['sha256']})
    source_records[relative] = {'sourcePin': PIN, **record}

relative = 'tests/allied-ai.test.ts'
raw = (REPO / relative).read_bytes()
pinned = subprocess.check_output(['git', 'show', f'{PIN}:{relative}'], cwd=REPO)
blob = subprocess.check_output(['git', 'rev-parse', f'{PIN}:{relative}'], cwd=REPO, text=True).strip()
check('retained allied assertion source equals pinned839 Git bytes', raw == pinned)
source_records[relative] = {'sourcePin': PIN, 'gitBlob': blob, **digest(raw), 'qualification': 'Retained regression source authenticated separately. This test file is not included in the runtime build envelope source index.'}

checkpoint_record = extraction['checkpoint']
checkpoint_path = Path(checkpoint_record['path'])
raw = checkpoint_path.read_bytes()
check('complete small native SAVE4 checkpoint matches extraction seal', digest(raw) == {'bytes': checkpoint_record['bytes'], 'sha256': checkpoint_record['sha256']}, digest(raw))
checkpoint = json.loads(raw)
check('checkpoint has two external humans and two allied AI', checkpoint['format'] == 'orcs-vs-fairies-save' and checkpoint['version'] == 4 and checkpoint['state']['controllers'] == ['external', 'external', 'ai', 'ai'] and checkpoint['state']['teams'] == [0, 0, 1, 1])
coordinator = checkpoint['runtime']['teamAI']['coordinator']
wave = checkpoint['runtime']['aiWave']
check('coordinator counter and equal AI launch times remain native SAVE4 values', coordinator['nextWaveId'] == 3 and wave[2] == wave[3] == 166.35000000000358, {'coordinator': coordinator, 'aiWave': wave})

frames = {}
frame_seals = []
for record in comparison['raw_frames']:
    path = Path(record['path']);raw = path.read_bytes()
    check(f'complete small native stored frame{record["tick"]} matches extraction seal', digest(raw) == {'bytes': record['bytes'], 'sha256': record['sha256']}, digest(raw))
    value = json.loads(raw)
    check(f'stored frame{record["tick"]} has all four own views at that tick', len(value) == 4 and all(view['tick'] == record['tick'] and view['side'] == side for side, view in enumerate(value)))
    frames[record['tick']] = value
    frame_seals.append(record)

transitions = []
for expected in comparison['AI_owner_order_changes']:
    side, entity_id = expected['side'], expected['id']
    before = next(e for e in frames[3324][side]['entities'] if e['id'] == entity_id and e['side'] == side)
    after = next(e for e in frames[3328][side]['entities'] if e['id'] == entity_id and e['side'] == side)
    check(f'ownAI{side} unit{entity_id} native idle-to-attackMove order matches retained comparison', before['order'] == expected['before'] == {'type': 'idle'} and after['order'] == expected['after'] and after['order']['type'] == 'attackMove')
    transitions.append({'side': side, 'id': entity_id, 'before': before['order'], 'after': after['order']})
destinations = {side: sorted((x['after']['x'], x['after']['y']) for x in transitions if x['side'] == side) for side in [2, 3]}
check('both AI owners use the same three formation destinations', destinations[2] == destinations[3] == [(47.1, 16.9), (47.9, 16.1), (47.9, 16.9)])

root = read(CONTROL / 'closing/root-coordination-readback.json')
check('root direct SQLite equality readback retained with19 passed checks', root['passed'] is True and len(root['checks']) == 19 and all(c['passed'] for c in root['checks']))
payload = {
    'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourcePin': PIN,
    'scope': 'Concrete small native/source/build evidence for the coordinated-opponent requirement. This admission is separate from retention of all493 packet payloads.',
    'checks': checks, 'passed': True,
    'matchId': coop['matchId'], 'lobbyId': coop['lobbyId'],
    'sourceRecords': source_records,
    'authoritativeServer': {'packetPath': 'server/rts-server.js', **server, 'sameMatchEngineHashEqual': True, 'qualification': 'Compiled server bytes were full-read authenticated during execution and final packet sealing. Closing admission checks the sealed small metadata binding; it does not build or rerun.'},
    'nativeArtifacts': {'checkpoint': checkpoint_record, 'frames': frame_seals, 'rootDirectSQLiteReadback': {'path': str(CONTROL / 'closing/root-coordination-readback.json'), **digest((CONTROL / 'closing/root-coordination-readback.json').read_bytes())}},
    'transitions': transitions, 'sharedFormationDestinations': destinations[2],
    'originalLimitVerbatim': limit,
    'qualification': 'The short browser test ends around tick408 and does not observe synchronized waves. Later stored frames3324/3328 and checkpoint4040 are from the same still-running839 server match, whose last stored match tick is4059. Root directly compared the complete checkpoint and both frame text byte streams with immutable closed SQLite rows. This file directly authenticates and reads those small extracted native bytes, and ties the match engine hash to the sealed compiled server. Per-player economic/tactical decisions coexist with the shared team planner. The original raw limit sentence remains unchanged.',
    'limits': ['Stored frame interval3324-to-3328 bounds the visible change; native checkpoint sharedaiWave records the equal launch time166.35000000000358. The frames alone do not identify the exact dispatch tick or show pending-wave participants.', 'Empty coordinator waves/reservations at checkpoint do not prove current wave membership; nextWaveId3 records prior coordinator allocations.', 'Human objective cooperation, complete match outcome and cooperative victory are not established.', 'Natural test applicability and full passing regression evidence remain a separate unchanged-source bridge; they are not this human UI run.', 'Online remains failed. No new runtime, simulation, browser, codec or large rawDB hash occurred during closing admission.'],
}
OUT.write_text(json.dumps(payload, indent=2) + '\n')
print(json.dumps({'receipt': str(OUT), **digest(OUT.read_bytes()), 'checks': len(checks), 'passed': True}, indent=2))
