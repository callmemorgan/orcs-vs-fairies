#!/usr/bin/env python3
"""Root-only closed extraction candidate. Never launch, close, seal, replay or audit."""
import argparse
import datetime
import hashlib
import json
import math
import os
import re
import sqlite3
import stat
import subprocess
import sys
import time
from pathlib import Path

PROTECTED = Path('/home/morgana/Projects/orcs-vs-Fairies')
# Filled only from the separately authenticated future root assignment.
SOURCE_ROOT = None
PREFIX = None
RAW_PATH = None
MAX_NATIVE = 8 * 1024 * 1024
MAX_PUBLIC = 64 * 1024 * 1024
MAX_RECEIPTS = 1024 * 1024
MAX_RAW = 1024 * 1024 * 1024
PUBLIC_NAMES = (
    'public-results.json', 'public-identities.json', 'public-windows.json',
    'public-cleanup.json', 'public-match-identity.json', 'human-one-wire.ndjson',
    'human-two-wire.ndjson', 'human-one-ui-actions.ndjson', 'human-two-ui-actions.ndjson',
)
SOURCE_PATHS = (
    'src/core/team-ai.ts', 'src/core/simulation.ts', 'src/core/saves.ts',
    'src/core/observation.ts', 'src/core/commands.ts', 'src/core/ally-directives.ts',
    'src/server/server.ts', 'src/server/store.ts', 'src/server/views.ts',
    'src/online/protocol.ts', 'src/online/render-state.ts', 'src/core/economy.ts',
    'src/core/economy-types.ts', 'src/core/tactics.ts', 'src/game/GameScene.ts',
    'src/game/Controls.ts', 'src/main.ts', 'src/ui/Hud.ts', 'src/ui/OnlineLobby.ts',
    'src/core/types.ts', 'src/core/navigation.ts', 'src/ui/SessionTools.ts',
)
MATCH_QUERY = 'SELECT id,lobby_id,config,tick,checkpoint_tick,checkpoint,engine_hash,state_hash FROM matches WHERE id=?'
SIZE_QUERY = 'SELECT length(CAST(config AS BLOB)),length(CAST(checkpoint AS BLOB)) FROM matches WHERE id=?'
BRACKET_QUERY = "SELECT tick,json_extract(views,'$[0].time'),length(CAST(views AS BLOB)) FROM frames WHERE match_id=? AND tick IN (?,?) ORDER BY tick"
COLLECTOR_BOUNDS = {'totalCollectorBytes': MAX_NATIVE, 'metadataReserveBytes': 2*1024*1024,
                    'checkpointPayloadUpperBoundBytes': 6*1024*1024, 'queryLogBytes': 640*1024,
                    'maxSeconds': 300, 'pollSeconds': 1, 'maxQueries': 300, 'maxRecords': 4}


class Held(Exception):
    pass


def require(value, reason):
    if not value:
        raise Held(reason)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def integer(value, name, low=0, high=2**53-1):
    require(type(value) is int and low <= value <= high, name + ': invalid integer')
    return value


def finite(value, name):
    require(type(value) in (int, float) and math.isfinite(value) and value >= 0, name + ': invalid number')
    return value


def digest(value, name):
    require(type(value) is str and re.fullmatch('[0-9a-f]{64}', value), name + ': invalid digest')
    return value


def exact(value, names, label):
    require(type(value) is dict and set(value) == set(names), label + ': invalid fields')
    return value


def parse(raw, label):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, label + ': duplicate JSON key')
            result[key] = value
        return result
    value = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                       parse_constant=lambda _item: (_ for _ in ()).throw(Held(label + ': nonfinite JSON')))
    pending = [value]
    while pending:
        item = pending.pop()
        if type(item) is float:
            require(math.isfinite(item), label + ': nonfinite number')
        elif type(item) is dict:
            pending.extend(item.values())
        elif type(item) is list:
            pending.extend(item)
    return value


def encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False)+'\n').encode('utf-8')


def canonical(value):
    path = Path(value)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), 'Noncanonical path')
    return path


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns, info.st_mode, info.st_nlink)


def read_bound(descriptor, cap, expected=None):
    exact(descriptor, ('path', 'bytes', 'sha256'), 'bound descriptor')
    path = canonical(descriptor['path'])
    require(path.suffix not in ('.sqlite','.db') and not any(path.name.endswith(v) for v in ('.sqlite-wal','.sqlite-shm','.sqlite-journal'))
            and '/ai-save401-final-83941bc-r1/' not in str(path), 'Raw database input is prohibited outside the closed DB reader')
    if expected is not None:
        require(path == expected, 'Descriptor is outside its assigned literal path')
    size = integer(descriptor['bytes'], str(path), 0, cap)
    digest(descriptor['sha256'], str(path))
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size == size, 'Bound file identity/size differs')
        chunks, remaining = [], size
        while remaining:
            chunk = os.read(fd, min(remaining, 1024*1024))
            require(chunk, 'Bound input short read')
            chunks.append(chunk)
            remaining -= len(chunk)
        require(not os.read(fd, 1) and identity(info) == identity(os.fstat(fd)) and identity(info) == identity(path.lstat()),
                'Bound input changed while reading')
        raw = b''.join(chunks)
        require(sha(raw) == descriptor['sha256'], 'Bound input digest differs')
        return raw
    finally:
        os.close(fd)


def bound_json(descriptor, cap=2*1024*1024, expected=None):
    raw = read_bound(descriptor, cap, expected)
    return parse(raw, descriptor['path']), raw


def descriptor(name, raw):
    return {'file': name, 'bytes': len(raw), 'sha256': sha(raw)}


def file_descriptor(path, raw):
    return {'path': str(path), 'bytes': len(raw), 'sha256': sha(raw)}


def git(args):
    return subprocess.check_output(['git'] + args, cwd=SOURCE_ROOT, env=dict(os.environ, GIT_OPTIONAL_LOCKS='0'))


def authenticate_source(a, capture, collector):
    inventory, _raw = bound_json(a['sourceInventory'])
    require(capture['sourceBinding'] == a['sourceInventory'] and collector['sourceInventory'] == a['sourceInventory'],
            'Capture and collector source inventory differs')
    require(inventory.get('schema') == 'feature63-new-source-binding-v1' and inventory.get('sourcePin') == a['sourcePin']
            and inventory.get('approved') is True and inventory.get('status') == 'PASS'
            and inventory.get('authenticatedInputs') is True and inventory.get('requiredInputSetAuthenticatedByRoot') is True
            and inventory.get('includesSourceConfigPublicBuildAndProof') is True, 'Actual source inventory is held')
    require(git(['rev-parse', 'HEAD']).decode().strip() == a['sourcePin'], 'Owned source HEAD differs from root pin')
    require(git(['status', '--porcelain', '--untracked-files=no']) == b'', 'Owned tracked source is dirty')
    records = inventory.get('records')
    require(type(records) is list and inventory.get('inputCount') == len(records), 'Source inventory count differs')
    seen, actual = set(), {}
    for record in records:
        exact(record, ('path','bytes','sha256','mode'), 'source inventory row')
        rel = Path(record['path'])
        require(not rel.is_absolute() and '..' not in rel.parts and str(rel) == record['path'] and str(rel) not in seen,
                'Source inventory relative path differs')
        path = SOURCE_ROOT / rel
        raw = read_bound({'path': str(path), 'bytes': record['bytes'], 'sha256': record['sha256']}, MAX_RAW)
        require(stat.S_IMODE(path.stat().st_mode) == record['mode'], 'Source inventory mode differs')
        actual[str(rel)] = raw
        seen.add(str(rel))
    require(set(SOURCE_PATHS) <= seen, 'Missing required native source inputs')
    inputs = []
    for path in SOURCE_PATHS:
        row = git(['ls-tree', a['sourcePin'], '--', path]).decode().strip().split()
        require(len(row) == 4 and row[1] == 'blob' and row[3] == path and row[0] in ('100644','100755'), 'Git source row differs')
        blob = git(['cat-file', 'blob', row[2]])
        require(blob == actual[path], 'Pinned source blob differs from actual input')
        inputs.append({'path': path, 'gitMode': row[0], 'gitBlob': row[2], 'bytes': len(blob), 'sha256': sha(blob)})
    review, _raw = bound_json(a['nativeSchemaReview'])
    require(review.get('approved') is True and review.get('status') == 'approved' and review.get('sourcePin') == a['sourcePin']
            and review.get('auditorSha256') == a['auditor']['sha256'], 'Native schema review is held')
    build, _raw = bound_json(a['buildBinding'])
    require(capture['buildBinding'] == a['buildBinding'] and build.get('schema') == 'feature63-build-binding-v1'
            and build.get('approved') is True and build.get('sourcePin') == a['sourcePin'] and build.get('productVersion') == '4.0.2'
            and build.get('producerSha256') == a['publicProducer']['sha256']
            and build.get('publicDriverSha256') == a['publicDriver']['sha256'], 'Actual build binding differs')
    server = read_bound(a['serverBuild'], MAX_RAW, PREFIX / 'server/rts-server.js')
    require(build.get('serverBuildPath') == str(PREFIX / 'server') and
            {'path':'rts-server.js','bytes':len(server),'sha256':sha(server),'mode':stat.S_IMODE((PREFIX/'server/rts-server.js').stat().st_mode)}
            in build.get('serverRecords', []), 'Production server bytes are absent from build binding')
    return {'schema': 'feature63-source-binding-v1', 'sourcePin': a['sourcePin'], 'productVersion': '4.0.2',
            'allActualInputsAuthenticated': True, 'serverBuildSha256': sha(server), 'inputs': inputs,
            'collectorSourceInventorySha256': a['sourceInventory']['sha256'],
            'schemaReview': {'status':'approved','sourcePin':a['sourcePin'],'auditorSha256':a['auditor']['sha256']},
            'actualSourceInventory': a['sourceInventory'], 'nativeSchemaReview': a['nativeSchemaReview'], 'actualBuildBinding':a['buildBinding']}


def entities(view):
    require(type(view) is dict and type(view.get('entities')) is list, 'Public entity list missing')
    values = {}
    for entity in view['entities']:
        eid = integer(entity.get('id'), 'entity ID', 1, 0x7fffffff)
        require(eid not in values, 'Duplicate entity ID')
        finite(entity.get('hp'), 'entity HP')
        values[eid] = entity
    return values


def eligible(view, side):
    economy = view.get('economy') or {}
    require(type(economy) is dict and type(economy.get('caravans', [])) is list, 'Invalid public economy')
    excluded = {v if type(v) is int else v.get('entityId') for v in economy.get('caravans', [])}
    result = set()
    for eid, entity in entities(view).items():
        tactics = entity.get('tactics') or {}
        crew = tactics.get('siegeCrew') or {}
        if (entity.get('owner') == side and entity.get('side') == side and entity.get('kind') == 'unit'
                and entity.get('role') != 'worker' and entity['hp'] > 0 and entity.get('illusion') is False
                and entity.get('definitionId') != 'economy:caravan' and eid not in excluded and crew.get('uncrewed') is not True):
            result.add(eid)
    return result


def ndjson(raw, label):
    require(raw.endswith(b'\n') and b'\r' not in raw, label + ': incomplete NDJSON')
    rows = raw.splitlines()
    require(rows and len(rows) <= 200000 and all(rows), label + ': blank or unbounded NDJSON rows')
    return [parse(row, label) for row in rows]


def public_selection(public, pin, match):
    identity = parse(public['public-match-identity.json'], 'public identity')
    result = parse(public['public-results.json'], 'public result')
    windows = parse(public['public-windows.json'], 'public windows')
    identities = parse(public['public-identities.json'], 'public identities')
    cleanup = parse(public['public-cleanup.json'], 'public cleanup')
    for value in (identity, result, windows, identities):
        require(value.get('matchId') == match, 'Public match identity differs')
    require(identity.get('sourcePin') == pin and identities.get('sourcePin') == pin, 'Public source differs')
    require(result.get('publicCandidatePassed') is True and result.get('cleanupPassed') is True
            and result.get('feature63Qualified') is False and result.get('firstFailure') is None and result.get('errors') == []
            and result.get('acquisitionFailures') == [] and cleanup.get('schema') == 'feature63-public-cleanup-v1'
            and cleanup.get('matchId') == match and cleanup.get('browserClosed') is True and cleanup.get('allOwnedBrowsersClosed') is True
            and cleanup.get('failures') == [] and cleanup.get('captureFailures') == [], 'Public capture is held')
    require(type(cleanup.get('contexts')) is list and len(cleanup['contexts']) == 2
            and all(v.get('closed') is True for v in cleanup['contexts']), 'Public contexts are not closed')
    candidates = windows.get('candidates')
    require(type(candidates) is list and 1 <= len(candidates) <= 2000, 'Invalid public candidate count')
    index = integer(windows.get('selectedCandidateIndex'), 'selected candidate', 0, len(candidates)-1)
    require(result.get('selectedCandidateIndex') == index, 'Public selected candidate index differs')
    candidate = candidates[index]
    start, end = integer(candidate.get('startTick'), 'start'), integer(candidate.get('endTick'), 'end')
    require(0 < end-start <= 400 and (end-start)%4 == 0 and candidate.get('maxTicks') == 400
            and candidate.get('publicPredicatePassed') is True and candidate.get('bothHumansAliveThroughout') is True, 'Invalid public fight bounds')
    snapshots, wires, actions_by_profile = {}, {}, {}
    for profile, side in (('human-one',0),('human-two',1)):
        snapshots[profile], wires[profile] = {}, {}
        actions_by_profile[profile] = ndjson(public[profile+'-ui-actions.ndjson'], profile+' actions')
        for index, row in enumerate(ndjson(public[profile+'-wire.ndjson'], profile+' wire'), 1):
            require(row.get('schema') == 'feature63-public-wire-v1' and row.get('profile') == profile and row.get('ordinal') == index
                    and row.get('payloadType') == 'string' and row.get('binaryBase64') is None, 'Public wire provenance differs')
            message = parse(row['payload'].encode('utf-8'), profile+' payload')
            wires[profile][index] = (row, message)
            if row.get('direction') == 'received' and message.get('kind') == 'snapshot':
                tick = integer(message.get('tick'), 'public frame tick')
                require(message.get('matchId') == match and message.get('frameSeq') == tick and tick not in snapshots[profile], 'Public frame match/cadence differs')
                snapshots[profile][tick] = (index, message['view'])
        require(sorted(t for t in snapshots[profile] if start <= t <= end) == list(range(start,end+1,4)) and start-4 in snapshots[profile], 'Incomplete public fight/preceding frame')
        for tick in range(start-4,end+1,4):
            require_humans_alive(snapshots[profile][tick][1])
    commanded = {0:set(),1:set()}
    accepted = candidate.get('acceptedAttackMoves')
    require(type(accepted) is list and 2 <= len(accepted) <= 32, 'Invalid accepted command count')
    for entry in accepted:
        profile = entry.get('profile')
        require(profile in snapshots and entry.get('side') == ('human-one','human-two').index(profile), 'Accepted command owner differs')
        side = entry['side']
        co, ao = entry.get('commandWireOrdinal'), entry.get('ackWireOrdinal')
        require(co in wires[profile] and ao in wires[profile], 'Accepted command wire missing')
        crow, message = wires[profile][co]
        arow, ack = wires[profile][ao]
        require(crow['direction'] == 'sent' and arow['direction'] == 'received' and co < ao
                and message == entry.get('command') and ack == entry.get('ack') and message.get('kind') == 'command'
                and ack.get('kind') == 'commandAck' and ack.get('accepted') is True and 'reason' not in ack
                and message.get('clientSeq') == ack.get('clientSeq') == entry.get('clientSeq')
                and ack.get('appliedTick') == entry.get('appliedTick') and ack['appliedTick'] <= start, 'Accepted command/ack identity differs')
        command = message['command']
        require(command.get('type') == 'attackMove' and not command.get('queued'), 'Accepted command is not direct attackMove')
        ids = command.get('ids')
        require(type(ids) is list and 0 < len(ids) <= 100 and len(set(ids)) == len(ids), 'Invalid commanded IDs')
        tick = entry.get('eligibilityFrameTick')
        require(tick in snapshots[profile] and snapshots[profile][tick][0] == entry.get('eligibilityWireOrdinal')
                and snapshots[profile][tick][0] < co and tick < ack['appliedTick'], 'Eligibility frame is not contemporaneous')
        valid = sorted(set(ids) & eligible(snapshots[profile][tick][1], side))
        require(valid == sorted(ids) == entry.get('eligibleCommandedIds'), 'Commanded actors lack authenticated eligibility')
        # Full normal UI lifecycle is retained literally and independently checked by native-audit.py.
        actions = actions_by_profile[profile]
        matched = [v for v in actions if v.get('actionId') == entry.get('uiActionId') and v.get('state') == 'accepted']
        require(len(matched) == 1 and matched[0].get('command') == message and matched[0].get('ack') == ack,
                'Accepted UI transcript does not bind command/ack')
        commanded[side].update(valid)
    require(all(commanded.values()), 'Both humans need eligible accepted commands')
    return identity, candidate, snapshots, commanded



def require_humans_alive(view):
    eliminated = view.get('eliminated')
    require(type(eliminated) is list and len(eliminated) == 4 and all(type(v) is bool for v in eliminated)
            and eliminated == view.get('result',{}).get('eliminated') and eliminated[0] is False and eliminated[1] is False,
            'Actual public/native frame eliminates a human')
    values = entities(view)
    for side in (0,1):
        require(any(v.get('side') == side and v.get('owner') == side and v.get('kind') == 'building'
                    and v.get('role') == 'hq' and v['hp'] > 0 and v.get('progress') == 1 for v in values.values()),
                'Actual frame lacks a complete living human HQ')
    return values


def validate_native_launch(checkpoint_raw, choice, frame_views):
    save = parse(checkpoint_raw, 'selected launch checkpoint')
    state, runtime = save['state'], save['runtime']
    coordinator = runtime['teamAI']['coordinator']
    found = [v for v in coordinator['waves'] if v.get('id') == choice['waveId']]
    require(len(found) == 1, 'Selected native wave is ambiguous')
    wave = exact(found[0], ('id','teamId','target','participants','launchAt','expiresAt','launched'), 'selected wave')
    require(integer(coordinator.get('nextWaveId'),'next wave ID',1) > integer(wave['id'],'wave ID',1), 'Selected wave is not retained by coordinator')
    target = wave['target']
    require(type(target) is dict and set(target) == {'key','kind','observer','seenAt','x','y'} | ({'level'} if 'level' in target else set())
            and target.get('kind') in ('hq','building','unit','start') and target.get('observer') in (2,3)
            and type(target.get('key')) is str and bool(target['key']), 'Native planner target differs')
    require(finite(target.get('seenAt'),'target seen time') <= choice['checkpointTime'], 'Planner target time differs')
    width, height = finite(state.get('width'),'map width'), finite(state.get('height'),'map height')
    require(width >= 1 and height >= 1 and type(state.get('starts')) is list and len(state['starts']) == 4, 'Native map geometry missing')
    before, after = frame_views[choice['launchBeforeTick']], frame_views[choice['launchAfterTick']]
    for views in (before,after):
        for side in (0,1):
            require_humans_alive(views[side])
    for participant in wave['participants']:
        exact(participant, ('side','ids'), 'wave participant')
        side = integer(participant['side'],'wave participant side',2,3)
        intended = sorted(participant['ids'])
        require(0 < len(intended) <= 500 and len(set(intended)) == len(intended), 'Native wave IDs differ')
        old, new = entities(before[side]), entities(after[side])
        for base in range(0,len(intended),100):
            chunk = intended[base:base+100]
            columns = math.ceil(math.sqrt(len(chunk)))
            direction = 1 if finite(state['starts'][side].get('y'),'start y') < height/2 else -1
            for index,eid in enumerate(chunk):
                require(eid in old and eid in new, 'Retained participant missing from native launch bracket')
                first, last = old[eid], new[eid]
                require(first.get('owner') == last.get('owner') == side and first.get('side') == last.get('side') == side
                        and first.get('kind') == last.get('kind') == 'unit' and first.get('role') != 'worker'
                        and first['hp'] > 0 and last['hp'] > 0 and not first.get('illusion') and not last.get('illusion'),
                        'Native launch participant identity differs')
                require(not first.get('tactics',{}).get('formation') and not last.get('tactics',{}).get('formation'), 'Native formation semantics require review')
                dx = 0 if len(chunk) == 1 else (index%columns-(columns-1)/2)*.8*direction
                dy = 0 if len(chunk) == 1 else (index//columns-(columns-1)/2)*.8*direction
                expected = {'type':'attackMove','x':max(.6,min(width-.6,finite(target['x'],'target x')+dx)),
                            'y':max(.6,min(height-.6,finite(target['y'],'target y')+dy))}
                if 'level' in target:
                    expected['level'] = integer(target['level'],'target level',0,1)
                observed = last.get('order')
                require(type(observed) is dict and first.get('order') != observed and set(observed) == set(expected)
                        and all(abs(observed[k]-expected[k]) <= 1e-9 if k in ('x','y') else observed[k] == expected[k] for k in expected),
                        'Native source-derived shared attackMove transition differs')


def choose_wave(checkpoints, candidate, snapshots, commanded):
    start, end = candidate['startTick'], candidate['endTick']
    choices = []
    for name, raw in checkpoints.items():
        save = parse(raw, name)
        runtime, state = save['runtime'], save['state']
        ai = runtime['teamAI']
        if ai.get('directives') != [] or ai.get('transfers') != []:
            continue
        cp_tick, cp_time = integer(state['tick'],'checkpoint tick'), finite(state['time'],'checkpoint time')
        clocks = runtime.get('aiWave')
        if not (type(clocks) is list and len(clocks)==4 and clocks[2]==clocks[3] and finite(clocks[2],'wave time')>0):
            continue
        wave_time = clocks[2]
        elapsed = (cp_time-wave_time)*20
        launch_tick = cp_tick-round(elapsed)
        if elapsed < 0 or abs(elapsed-round(elapsed)) > 1e-7 or end <= launch_tick:
            continue
        for wave in ai['coordinator']['waves']:
            if (wave.get('teamId') != 1 or wave.get('launched') is not True
                    or not wave['launchAt'] <= wave_time <= cp_time < wave['expiresAt']):
                continue
            owners = {}
            parts = wave.get('participants')
            if not (type(parts) is list and len(parts)==2 and sorted(p.get('side') for p in parts)==[2,3]):
                continue
            for part in parts:
                for eid in part['ids']:
                    require(eid not in owners, 'Duplicate wave participant')
                    owners[integer(eid,'wave participant',1,0x7fffffff)] = part['side']
            if len(owners) < 4:
                continue
            observations, ticks = [], {start,end}
            for profile, side in (('human-one',0),('human-two',1)):
                for tick in range(start,end+1,4):
                    ordinal, view = snapshots[profile][tick]
                    mapping = entities(view)
                    for event in view.get('events', []):
                        if event.get('type') != 'attack':
                            continue
                        event_tick = integer(event.get('tick'),'event tick')
                        require(tick-4 < event_tick <= tick, 'Attack event outside authoritative buffer')
                        if not start < event_tick <= end or finite(event.get('amount'),'event amount') <= 0:
                            continue
                        actor, victim = mapping.get(event.get('source')), mapping.get(event.get('target'))
                        if not actor or not victim or actor.get('kind')!='unit' or victim.get('kind')!='unit':
                            continue
                        owner, victim_owner = actor.get('owner'), victim.get('owner')
                        if (actor.get('side') != owner or victim.get('side') != victim_owner or event.get('side') != owner
                                or owner not in (0,1) or event['source'] not in commanded[owner]
                                or event['target'] not in owners or owners[event['target']] != victim_owner):
                            continue
                        require(view['time'] > wave_time and event_tick > launch_tick, 'Human event precedes committed wave launch')
                        ticks.add(tick)
                        observations.append({'profile':profile,'wireOrdinal':ordinal,'frameTick':tick,'eventId':event.get('eventId'),
                                             'eventTick':event_tick,'sourceOwner':owner,'targetOwner':victim_owner,
                                             'source':event['source'],'target':event['target']})
            if {v['sourceOwner'] for v in observations}!={0,1} or {v['targetOwner'] for v in observations}!={2,3}:
                continue
            after = launch_tick + ((start-launch_tick)%4)
            before = after-4
            if before < 0:
                continue
            ticks.update((before,after))
            choices.append({'checkpointFile':name,'waveId':wave['id'],'waveTime':wave_time,'launchTick':launch_tick,'checkpointTick':cp_tick,'checkpointTime':cp_time,
                            'launchBeforeTick':before,'launchAfterTick':after,'frameTicks':sorted(ticks),
                            'humanObservations':observations})
    require(choices, 'No retained collector wave matches the complete fixed public candidate')
    choices.sort(key=lambda v:(len(v['frameTicks']),v['checkpointFile'],v['waveId']))
    choice = choices[0]
    require(2 <= len(choice['frameTicks']) <= 16, 'Required full native frame set exceeds16; no truncation')
    return choice


class ClosedDatabase:
    def __init__(self, a, closed):
        self.path = canonical(a['rawDatabase']['path'])
        require(self.path == RAW_PATH, 'Only the capture-assigned fresh DB is permitted')
        self.expected = a['rawDatabase']
        self.match = closed['matchId']
        exact(self.expected, ('path','bytes','sha256','device','inode'), 'raw database descriptor')
        require(self.expected['bytes'] == closed['rawBytes'] and self.expected['sha256'] == closed['rawSha256']
                and closed['dbIdentity'] == {'device':self.expected['device'],'inode':self.expected['inode']}, 'Root seal/raw identity differs')
        self.fd, self.connection, self.before = None, None, None
        self.discovery = []
        self.started = time.monotonic()

    def absent_sidecars(self):
        for suffix in ('-wal','-shm','-journal'):
            require(not os.path.lexists(str(self.path)+suffix), 'Closed fresh raw sidecar is present')

    def verify(self):
        self.absent_sidecars()
        info = os.fstat(self.fd)
        require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_size==integer(self.expected['bytes'],'raw bytes',1,MAX_RAW)
                and info.st_dev==integer(self.expected['device'],'raw device') and info.st_ino==integer(self.expected['inode'],'raw inode',1)
                and stat.S_IMODE(info.st_mode)&0o222==0, 'Closed raw identity or filesystem seal differs')
        require(identity(info)==identity(self.path.lstat()), 'Raw path no longer names the authenticated inode')
        if self.before is not None:
            require(identity(info)==self.before, 'Closed raw stat identity changed')
        self.before = identity(info)
        hasher, offset = hashlib.sha256(), 0
        while offset < info.st_size:
            chunk = os.pread(self.fd,min(1024*1024,info.st_size-offset),offset)
            require(chunk, 'Closed raw short hash read')
            hasher.update(chunk)
            offset += len(chunk)
        require(hasher.hexdigest()==digest(self.expected['sha256'],'raw digest') and identity(info)==identity(os.fstat(self.fd))
                and identity(info)==identity(self.path.lstat()), 'Closed raw changed/digest differs')
        self.absent_sidecars()
        return {'path':str(self.path),'bytes':info.st_size,'sha256':hasher.hexdigest(),
                'device':info.st_dev,'inode':info.st_ino,'mtimeNs':info.st_mtime_ns,'ctimeNs':info.st_ctime_ns,
                'mode':stat.S_IMODE(info.st_mode),'linkCount':info.st_nlink}

    def __enter__(self):
        self.absent_sidecars()
        self.fd = os.open(self.path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
        try:
            self.before_record = self.verify()
            # The already authenticated open FD binds SQLite to the same inode. Immutable mode never creates sidecars.
            self.connection = sqlite3.connect('file:/proc/self/fd/'+str(self.fd)+'?mode=ro&immutable=1',uri=True,timeout=0)
            self.connection.text_factory = bytes
            columns = {'matches': {'id','lobby_id','config','tick','checkpoint_tick','checkpoint','engine_hash','state_hash'},
                       'frames': {'match_id','tick','views'}}
            def authorize(action, first, second, database, _trigger):
                admitted = action == sqlite3.SQLITE_SELECT
                if action == sqlite3.SQLITE_READ:
                    admitted = database == 'main' and first in columns and second in columns[first]
                elif action == sqlite3.SQLITE_FUNCTION:
                    admitted = second in ('length','json_extract')
                return sqlite3.SQLITE_OK if admitted else sqlite3.SQLITE_DENY
            self.connection.set_authorizer(authorize)
            self.started = time.monotonic()
            self.connection.set_progress_handler(lambda: 1 if time.monotonic()-self.started>60 else 0,1000)
            self.connection.setlimit(sqlite3.SQLITE_LIMIT_LENGTH,MAX_NATIVE)
            return self
        except Exception:
            if self.connection is not None:
                self.connection.close()
            os.close(self.fd)
            self.fd = None
            raise

    def query(self, text, parameters, discovery=False):
        require(type(parameters) is list and parameters and parameters[0] == self.match, 'SELECT is not bound to the actual match')
        frame_tail = ' FROM frames WHERE match_id=? AND tick IN (' + ','.join('?' for _ in parameters[1:]) + ') ORDER BY tick'
        allowed_text = {MATCH_QUERY, SIZE_QUERY, BRACKET_QUERY,
                        'SELECT tick,views' + frame_tail, 'SELECT tick,length(CAST(views AS BLOB))' + frame_tail}
        require(text in allowed_text and ';' not in text, 'Only fixed match/frame SELECTs are admitted')
        if text in (MATCH_QUERY,SIZE_QUERY):
            require(parameters == [self.match], 'Match SELECT parameter count differs')
        else:
            ticks = parameters[1:]
            require(2 <= len(ticks) <= 16 and all(type(t) is int and t >= 0 for t in ticks)
                    and ticks == sorted(set(ticks)), 'Frame SELECT ticks are not sorted unique/bounded')
            if text == BRACKET_QUERY:
                require(len(ticks) == 2 and ticks[1]-ticks[0] == 4, 'Launch SELECT is not adjacent')
        rows = self.connection.execute(text,parameters).fetchall()
        if discovery:
            require(len(self.discovery)<10, 'Discovery SELECT count exceeded')
            self.discovery.append({'kind':'bounded-selection','text':text,'parameters':parameters,'returnedRows':len(rows)})
        return rows

    def __exit__(self, kind, value, traceback):
        try:
            self.connection.close()
            self.after_record = self.verify()
        finally:
            os.close(self.fd)
        return False


def write(path, raw):
    fd = os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        with os.fdopen(fd,'wb',closefd=False) as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(fd)
        os.fchmod(fd,0o444)
    finally:
        os.close(fd)


def extract(a, assignment_raw, anchor):
    global SOURCE_ROOT, PREFIX, RAW_PATH
    require(a.get('schema')=='feature63-root-closed-extraction-assignment-v1' and a.get('approved') is True
            and a.get('assignedBy')=='/root' and a.get('extractAuthorized') is True, 'Root extraction is held')
    require(type(a.get('sourcePin')) is str and re.fullmatch('[0-9a-f]{40}',a['sourcePin']) and a.get('productVersion')=='4.0.2', 'Root full pin/version absent')
    require(a.get('helperSha256')==sha(Path(__file__).read_bytes()), 'Root helper digest differs')
    require(a.get('ownedNativeLifetimeIndependentlyAdmitted') is True, 'Root native lifetime disposition pending')
    for key in ('nativeAuditAuthorized','rootExtractionAdmissionApproved'):
        require(type(a.get(key)) is bool, 'Root disposition boolean must be supplied: '+key)
    SOURCE_ROOT = canonical(a['sourceRoot'])
    relative_prefix = Path(a['freshPrefix'])
    require(SOURCE_ROOT.is_dir() and SOURCE_ROOT!=PROTECTED and PROTECTED not in SOURCE_ROOT.parents
            and not relative_prefix.is_absolute() and '..' not in relative_prefix.parts and str(relative_prefix)==a['freshPrefix']
            and len(relative_prefix.parts)>=2 and relative_prefix.parts[0]=='work'
            and re.fullmatch('feature63-human-wave-composition-r[1-9][0-9]*',relative_prefix.parts[-1]), 'Future owned source/fresh prefix differs')
    PREFIX = canonical(str(SOURCE_ROOT/relative_prefix))
    RAW_PATH = PREFIX/'server-data/server.sqlite'
    require(PREFIX.is_dir() and '/ai-save401-final-83941bc-r1/' not in str(PREFIX), 'Old runtime prefix prohibited')
    output = canonical(a['outputRoot'])
    require(not output.exists() and output.parent.is_dir() and PROTECTED not in output.parents and SOURCE_ROOT not in output.parents
            and output!=PROTECTED and output!=SOURCE_ROOT and '/ai-save401-final-83941bc-r1/' not in str(output), 'Output must be fresh and external')
    capture, _ = bound_json(a['captureAssignment'])
    result, _ = bound_json(a['captureResult'],16*1024*1024,PREFIX/'lifecycle/driver-result.json')
    require(capture.get('schema')=='feature63-dedicated-wrapper-assignment-v1' and capture.get('phase')=='capture'
            and capture.get('approved') is True and capture.get('assignedBy')=='/root' and capture.get('sourcePin')==a['sourcePin']
            and capture.get('sourceRoot')==str(SOURCE_ROOT) and capture.get('freshPrefix')==a['freshPrefix']
            and capture.get('productVersion')=='4.0.2', 'Authenticated actual capture assignment differs')
    require(result.get('schema')=='feature63-dedicated-capture-result-v1' and result.get('sourcePin')==a['sourcePin']
            and result.get('status')=='CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING' and result.get('firstFailure') is None
            and result.get('cleanupFailures')==[] and result.get('protectedFinalReadback',{}).get('status')=='PASS', 'Capture is not admitted closed')
    match = result['matchId']
    raw_identity = {'path':str(RAW_PATH),'device':a['rawDatabase']['device'],'inode':a['rawDatabase']['inode']}
    require(result.get('closedFreshDatabaseIdentity')==raw_identity, 'Capture fresh raw identity differs')
    closed, closed_raw = bound_json(a['closedRawReceipt'],MAX_RECEIPTS)
    require(closed.get('schema')=='feature63-closed-raw-v1' and closed.get('sourcePin')==a['sourcePin'] and closed.get('matchId')==match
            and all(closed.get(k) is True for k in ('producerClosed','ownedProcessesClosed','rootSealed','sidecarsAbsent')), 'Root closure/seal is held')
    custody, _ = bound_json(a['rootCustodyReceipt'])
    require(custody.get('schema')=='feature63-root-raw-custody-v1' and custody.get('approved') is True and custody.get('assignedBy')=='/root'
            and custody.get('sourcePin')==a['sourcePin'] and custody.get('matchId')==match and custody.get('rawDatabase')==a['rawDatabase']
            and custody.get('closedRawReceipt')==a['closedRawReceipt'] and custody.get('captureResult')==a['captureResult']
            and all(custody.get(k) is True for k in ('freshDatabaseAuthenticated','oldRawNeverReadOrReused','rootSealed','noLivePrivateReadback')),
            'Separate root fresh raw custody is held')
    lifetime, _ = bound_json(a['rootNativeLifetimeReceipt'])
    require(lifetime.get('schema')=='feature63-root-native-lifetime-disposition-v1' and lifetime.get('approved') is True
            and lifetime.get('assignedBy')=='/root' and lifetime.get('sourcePin')==a['sourcePin'] and lifetime.get('matchId')==match
            and lifetime.get('captureResult')==a['captureResult'] and lifetime.get('ownedNativeLifetimeIndependentlyAdmitted') is True,
            'Independent root lifetime disposition is held; capture reports cannot supply it')
    evidence = lifetime.get('closureEvidenceDescriptors')
    require(type(evidence) is list and evidence, 'Root lifetime must bind independent closure evidence')
    for record in evidence:
        read_bound(record,16*1024*1024)
    for key, capture_key in (('publicProducer','publicProducer'),('auditor','auditor'),('publicDriver',None),('collector','collector')):
        read_bound(a[key],MAX_NATIVE)
        require((capture['wrapperSha256']==a[key]['sha256']) if capture_key is None else capture[capture_key]==a[key], 'Capture script binding differs')
    collector_assignment, _ = bound_json(a['collectorAssignment'],2*1024*1024,PREFIX/'lifecycle/collector-assignment.json')
    require(collector_assignment.get('kind')=='feature63-passive-wave-collector-assignment-v1' and collector_assignment.get('rootApproved') is True
            and collector_assignment.get('sourcePin')==a['sourcePin'] and collector_assignment.get('freshDatabase')==raw_identity
            and collector_assignment.get('collectorSha256')==a['collector']['sha256'], 'Actual collector assignment differs')
    collector_files = a.get('collectorFiles')
    require(type(collector_files) is dict and 'collector-receipt.json' in collector_files, 'Collector output descriptors missing')
    allowed_collector_names = {'collector-receipt.json','queries.ndjson'} | {'native-wave-checkpoint-'+str(n).zfill(2)+'.json' for n in range(1,5)}
    require(set(collector_files) <= allowed_collector_names and 'queries.ndjson' in collector_files, 'Collector literal filename allowlist differs')
    require(sum(integer(v.get('bytes'),'collector bytes') for v in collector_files.values())<=MAX_NATIVE, 'Complete collector exceeds8MiB')
    collector_raws = {name:read_bound(record,MAX_NATIVE,PREFIX/'native-collector'/name) for name,record in collector_files.items()}
    collector = parse(collector_raws['collector-receipt.json'],'collector receipt')
    require(collector.get('schema')=='feature63-passive-wave-collector-v1' and collector.get('sourcePin')==a['sourcePin'] and collector.get('matchId')==match
            and collector.get('status')=='PASS' and collector.get('failure') is None and collector.get('activeQuery') is None
            and all(collector.get(k) is True for k in ('closed','readOnly','noFeedback')) and collector.get('bounds')==COLLECTOR_BOUNDS
            and collector.get('assignmentIdentity')==a['collectorAssignment'] and collector.get('dbIdentity')==closed.get('dbIdentity'), 'Collector closure/provenance differs')
    require(collector.get('sourceInventory')==a['sourceInventory'] and collector_assignment.get('sourceInventory')==a['sourceInventory'], 'Collector inventory binding differs')
    review, _ = bound_json(collector_assignment['reviewReceipt'])
    require(review.get('status')=='PASS' and review.get('sourcePin')==a['sourcePin'] and review.get('collectorSha256')==a['collector']['sha256']
            and collector.get('reviewIdentity')==collector_assignment['reviewReceipt'], 'Collector independent review differs')
    rows = collector.get('rows')
    require(type(rows) is list and 1<=len(rows)<=4 and collector.get('records')==len(rows), 'Actual retained wave rows missing')
    checkpoint_names = ['native-wave-checkpoint-'+str(n).zfill(2)+'.json' for n in range(1,len(rows)+1)]
    require(set(collector_files)==set(checkpoint_names)|{'collector-receipt.json','queries.ndjson'}, 'Collector complete literal file set differs')
    require({p.name for p in (PREFIX/'native-collector').iterdir()}==set(collector_files), 'Collector actual file set differs')
    checkpoints, references = {}, []
    for number,(name, row) in enumerate(zip(checkpoint_names,rows),1):
        raw = collector_raws[name]
        save = parse(raw,name)
        require(row.get('file')==name and row.get('collectorOrdinal')==number and row.get('matchId')==match
                and row.get('bytes')==len(raw) and row.get('checkpointTextSha256')==sha(raw)
                and row.get('checkpointTick')==save['state']['tick'], 'Literal collector checkpoint differs')
        checkpoints[name]=raw
        references.append({'file':name,'matchId':match,'tick':save['state']['tick'],'collectorOrdinal':number})
    require(collector.get('checkpointPayloadBytes')==sum(len(v) for v in checkpoints.values()), 'Collector payload total differs')
    require(set(a['publicFiles'])==set(PUBLIC_NAMES) and sum(integer(v.get('bytes'),'public bytes') for v in a['publicFiles'].values())<=MAX_PUBLIC,
            'Nine literal public inputs missing or exceed64MiB')
    public = {name:read_bound(a['publicFiles'][name],MAX_PUBLIC,PREFIX/'public'/name) for name in PUBLIC_NAMES}
    require(collector.get('publicMatchIdentity')==a['publicFiles']['public-match-identity.json']
            and collector_assignment.get('publicMatchIdentity')==a['publicFiles']['public-match-identity.json'], 'Collector early public identity differs')
    public_identity,candidate,snapshots,commanded=public_selection(public,a['sourcePin'],match)
    choice=choose_wave(checkpoints,candidate,snapshots,commanded)
    source = authenticate_source(a,capture,collector_assignment)
    native = dict(checkpoints)
    with ClosedDatabase(a,closed) as db:
        sizes=db.query(SIZE_QUERY,[match],True)
        require(len(sizes)==1 and integer(sizes[0][0],'config bytes',1,65536)+integer(sizes[0][1],'checkpoint bytes',1,MAX_NATIVE)
                +sum(len(v) for v in native.values())<=MAX_NATIVE, 'Complete match TEXT exceeds native budget')
        matches=db.query(MATCH_QUERY,[match])
        require(len(matches)==1,'Assigned match is absent or ambiguous')
        mid,lobby,config_text,tick,cp_tick,checkpoint,engine_hash,state_hash=matches[0]
        require(all(type(v) is bytes for v in (mid,lobby,config_text,checkpoint,engine_hash,state_hash)), 'Original SQLite UTF-8 TEXT missing')
        require(mid.decode('utf-8')==match and lobby.decode('utf-8')==public_identity['lobbyId'], 'Native public match/lobby differs')
        config=parse(config_text,'native config')
        metadata={'id':match,'lobby_id':lobby.decode('utf-8'),'config':config,'configText':config_text.decode('utf-8'),
                  'tick':tick,'checkpoint_tick':cp_tick,'engine_hash':engine_hash.decode('utf-8'),'state_hash':state_hash.decode('utf-8')}
        require(metadata['engine_hash']==source['serverBuildSha256'], 'Native engine differs from production build bytes')
        native['match-row.json']=encoded(metadata)
        native['native-checkpoint.json']=checkpoint
        require(parse(checkpoint,'final checkpoint')['state']['tick']==cp_tick, 'Final checkpoint tick differs')
        before,after=choice['launchBeforeTick'],choice['launchAfterTick']
        brackets=db.query(BRACKET_QUERY,[match,before,after],True)
        require(len(brackets)==2 and [v[0] for v in brackets]==[before,after]
                and brackets[0][1]<choice['waveTime']<=brackets[1][1]<=choice['checkpointTime'] and after<=choice['checkpointTick'], 'Actual adjacent launch bracket is missing')
        elapsed=(choice['waveTime']-brackets[0][1])*20
        require(1<=round(elapsed)<=4 and abs(elapsed-round(elapsed))<=1e-7 and before+round(elapsed)==choice['launchTick'], 'Native launch clock/tick mapping differs')
        selected=choice['frameTicks']
        size_query='SELECT tick,length(CAST(views AS BLOB)) FROM frames WHERE match_id=? AND tick IN ('+','.join('?' for _ in selected)+') ORDER BY tick'
        sizes=db.query(size_query,[match]+selected,True)
        require([v[0] for v in sizes]==selected and sum(integer(v[1],'views bytes',1,MAX_NATIVE) for v in sizes)+sum(len(v) for v in native.values())<=MAX_NATIVE,
                'Complete required native frame set missing or exceeds8MiB; no truncation')
        frame_query='SELECT tick,views FROM frames WHERE match_id=? AND tick IN ('+','.join('?' for _ in selected)+') ORDER BY tick'
        frames=db.query(frame_query,[match]+selected)
        require([v[0] for v in frames]==selected,'Final frame rows differ from selection')
        frame_rows=[]
        frame_views={}
        for number,(frame_tick,views_raw) in enumerate(frames,1):
            require(type(views_raw) is bytes,'Original views TEXT missing')
            views=parse(views_raw,'native frame')
            require(type(views) is list and len(views)==4 and all(v.get('tick')==frame_tick and v.get('side')==side for side,v in enumerate(views))
                    and len({finite(v.get('time'),'native frame time') for v in views}) == 1, 'Complete four-view native frame differs')
            for profile,side in (('human-one',0),('human-two',1)):
                if frame_tick in snapshots[profile]:
                    require(views[side]==snapshots[profile][frame_tick][1],'Native/public same-tick full view differs')
            frame_views[frame_tick]=views
            name='native-frame-'+str(number).zfill(2)+'.json'
            native[name]=views_raw
            frame_rows.append({'file':name,'matchId':match,'tick':frame_tick})
        validate_native_launch(checkpoints[choice['checkpointFile']],choice,frame_views)
    # No bundle or admission exists until after the connection closes and second full raw hash passes.
    require(db.before_record==db.after_record,'Raw receipt changed across extraction')
    require(sum(len(v) for v in native.values())<=MAX_NATIVE,'Complete native output exceeds8MiB')
    selection={'schema':'feature63-root-native-selection-v1','sourcePin':a['sourcePin'],'matchId':match,'selection':choice,
               'selectedCandidateIndex':parse(public['public-windows.json'],'windows')['selectedCandidateIndex'],
               'boundedDiscoveryQueries':db.discovery,'inputAssignmentSha256':anchor,
               'completeQualifyingHumanFramesRetained':True,'truncated':False}
    verification={'schema':'feature63-root-raw-verification-v1','sourcePin':a['sourcePin'],'matchId':match,
                  'before':db.before_record,'after':db.after_record,'unchanged':True,'closedOnly':True}
    selection_raw, verification_raw = encoded(selection), encoded(verification)
    extraction={'schema':'feature63-native-extraction-v1','sourcePin':a['sourcePin'],'sealId':closed['sealId'],'matchId':match,
                'lobbyId':metadata['lobby_id'],'closedOnly':True,'rawUnchanged':True,'noLivePrivateReadback':True,'noReplay':True,
                'nativeFiles':[descriptor(n,v) for n,v in sorted(native.items())],
                'publicFiles':[descriptor(n,public[n]) for n in PUBLIC_NAMES],'frameRows':frame_rows,'waveCheckpointRows':references,
                'candidateCheckpointFile':choice['checkpointFile'],'candidateWaveId':choice['waveId'],
                'launchBeforeTick':before,'launchAfterTick':after,
                'queries':[{'kind':'match','text':MATCH_QUERY,'parameters':[match]},
                           {'kind':'frames','text':frame_query,'parameters':[match]+selected}],
                'selectionReceipt':file_descriptor(output/'selection-receipt.json',selection_raw),
                'rawVerificationReceipt':file_descriptor(output/'raw-verification-receipt.json',verification_raw),
                'rootCustodyReceipt':a['rootCustodyReceipt'],'rootNativeLifetimeReceipt':a['rootNativeLifetimeReceipt']}
    bundle_bytes=dict(public,**native)
    bundle_bytes['source-binding-receipt.json']=encoded(source)
    bundle_bytes['closed-raw-receipt.json']=closed_raw
    bundle_bytes['collector-receipt.json']=collector_raws['collector-receipt.json']
    bundle_bytes['extraction-receipt.json']=encoded(extraction)
    audit_assignment={'schema':'feature63-root-audit-assignment-v1','scope':'original-feature63-closed-native-composition',
                      'sourcePin':a['sourcePin'],'productVersion':'4.0.2','auditAuthorized':a['nativeAuditAuthorized'],
                      'auditorSha256':a['auditor']['sha256'],'publicProducerSha256':a['publicProducer']['sha256'],
                      'publicDriverSha256':a['publicDriver']['sha256'],
                      'sourceBindingReceipt':descriptor('source-binding-receipt.json',bundle_bytes['source-binding-receipt.json']),
                      'closedRawReceipt':descriptor('closed-raw-receipt.json',closed_raw),
                      'extractionReceipt':descriptor('extraction-receipt.json',bundle_bytes['extraction-receipt.json']),
                      'collectorReceipt':descriptor('collector-receipt.json',bundle_bytes['collector-receipt.json'])}
    bundle_bytes['root-assignment.json']=encoded(audit_assignment)
    require(sum(len(v) for n,v in bundle_bytes.items() if n in ('root-assignment.json','source-binding-receipt.json','closed-raw-receipt.json','collector-receipt.json','extraction-receipt.json'))<=MAX_RECEIPTS,
            'Aggregate native-auditor receipt bytes exceed1MiB')
    output.mkdir(mode=0o700)
    bundle=output/'bundle'
    bundle.mkdir(mode=0o700)
    for name,raw in bundle_bytes.items():
        write(bundle/name,raw)
    assignment_digest=sha(bundle_bytes['root-assignment.json'])
    write(output/'selection-receipt.json',selection_raw)
    write(output/'raw-verification-receipt.json',verification_raw)
    write(output/'root-extraction-input.json',assignment_raw)
    records=[{'path':n,'bytes':len(v),'sha256':sha(v),'mode':0o444} for n,v in sorted(bundle_bytes.items())]
    admission={'schema':'feature63-root-extraction-admission-v1','sourcePin':a['sourcePin'],
               'approved':a['rootExtractionAdmissionApproved'],'closedFreshRawAuthenticated':True,
               'completeSelectedTextAndQueryMetadataAuthenticated':True,'matchId':match,'auditorSha256':a['auditor']['sha256'],
               'rootAssignmentSha256':assignment_digest,'bundlePath':str(bundle),'bundleRecords':records,
               'ownedNativeLifetimeIndependentlyAdmitted':a['ownedNativeLifetimeIndependentlyAdmitted'],
               'rootNativeLifetimeReceipt':a['rootNativeLifetimeReceipt'],'rootCustodyReceipt':a['rootCustodyReceipt'],
               'captureResult':a['captureResult'],'inputAssignmentSha256':anchor}
    admission_raw=encoded(admission)
    write(output/'root-extraction-admission.json',admission_raw)
    report={'schema':'feature63-root-extraction-result-v1','status':'EXTRACTED_PENDING_ROOT_REVIEW',
            'sourcePin':a['sourcePin'],'matchId':match,'feature63Qualified':False,'auditorExecuted':False,
            'nativeBundle':str(bundle),'nativeAuditAssignment':file_descriptor(bundle/'root-assignment.json',bundle_bytes['root-assignment.json']),
            'rootExtractionAdmission':file_descriptor(output/'root-extraction-admission.json',admission_raw),
            'rootAssignmentSha256MustBeAuthenticatedSeparatelyByRoot':assignment_digest,
            'rootAuditAuthorizationSupplied':a['nativeAuditAuthorized'],'rootAdmissionApprovalSupplied':a['rootExtractionAdmissionApproved']}
    write(output/'extraction-result.json',encoded(report))
    # stdout contains descriptors only, never private checkpoint/views/event bodies.
    print(json.dumps(report,sort_keys=True,allow_nan=False))


def main():
    require(sys.flags.optimize==0,'Python optimization prohibited')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assignment',required=True)
    parser.add_argument('--assignment-sha256',required=True,help='root-authenticated digest supplied outside the assignment')
    args=parser.parse_args()
    path=canonical(args.assignment)
    anchor=digest(args.assignment_sha256,'separate root extraction assignment digest')
    require(path.stat().st_size<=128*1024,'Root extraction assignment exceeds128KiB')
    # Root anchors the assignment outside its own bytes; no source pin or admission is inferred from HEAD.
    raw=read_bound({'path':str(path),'bytes':path.stat().st_size,'sha256':anchor},128*1024)
    extract(parse(raw,'root extraction assignment'),raw,anchor)
    return 0


if __name__=='__main__':
    try:
        raise SystemExit(main())
    except (Held,OSError,ValueError,KeyError,TypeError,AttributeError,sqlite3.Error,subprocess.SubprocessError,RecursionError):
        # Errors can contain private values; keep detail in root-only local inspection, never stdout/UI.
        print('HELD: extraction rejected; no retry, replay, truncation or audit.',file=sys.stderr)
        raise SystemExit(1)
