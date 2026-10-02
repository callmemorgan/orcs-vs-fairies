#!/usr/bin/env python3
"""Held candidate: retain ordinary launched-wave checkpoint TEXT without UI feedback."""
import datetime
import hashlib
import json
import os
import signal
import sqlite3
import stat
import sys
import time
from pathlib import Path

CHECKOUT = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
PREFIX = CHECKOUT / 'work/feature63-human-wave-composition-r4'
DB = PREFIX / 'server-data/server.sqlite'
OUTPUT = PREFIX / 'native-collector'
PROTECTED = Path('/home/morgana/Projects/orcs-vs-Fairies')
MAX_BYTES = 8 * 1024 * 1024
METADATA_RESERVE_BYTES = 2 * 1024 * 1024
MAX_QUERY_LOG_BYTES = 640 * 1024
MAX_RECORDS = 4
MAX_SECONDS = 300
MAX_QUERIES = 300
QUERY = """SELECT id,tick,checkpoint_tick,
 length(CAST(checkpoint AS BLOB)) AS checkpoint_bytes,
 CASE WHEN length(CAST(checkpoint AS BLOB))<=?
 AND length(CAST(generation AS BLOB))<=4096 AND length(CAST(config AS BLOB))<=65536
 THEN checkpoint ELSE NULL END AS checkpoint,
 CASE WHEN length(CAST(generation AS BLOB))<=4096 THEN generation ELSE NULL END AS generation,
 CASE WHEN length(CAST(config AS BLOB))<=65536 THEN config ELSE NULL END AS config
 FROM matches WHERE id=? AND EXISTS (
 SELECT 1 FROM json_each(json_extract(checkpoint,'$.runtime.teamAI.coordinator.waves')) AS w
 WHERE json_extract(w.value,'$.launched')=1
 AND json_extract(w.value,'$.id') NOT IN (SELECT value FROM json_each(?))
 AND EXISTS (SELECT 1 FROM json_each(json_extract(w.value,'$.participants')) AS p WHERE json_extract(p.value,'$.side')=2)
 AND EXISTS (SELECT 1 FROM json_each(json_extract(w.value,'$.participants')) AS p WHERE json_extract(p.value,'$.side')=3))"""
STOP_REQUESTED = False


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_bound_file(descriptor, maximum=2 * 1024 * 1024):
    path = Path(descriptor['path'])
    require(path.is_absolute() and not path.is_symlink(), 'Bound receipt path must be absolute and not a symlink')
    require(stat.S_ISREG(path.lstat().st_mode), 'Bound receipt is not regular')
    require(path.stat().st_size <= maximum, 'Bound receipt exceeds its static byte limit')
    data = path.read_bytes()
    require(sha(data) == descriptor['sha256'], 'Bound receipt bytes changed: ' + path.name)
    return json.loads(data), {'path': str(path), 'bytes': len(data), 'sha256': sha(data)}


def process_identity(pid):
    directory = Path('/proc') / str(pid)
    try:
        raw = (directory / 'stat').read_text()
        fields = raw[raw.rfind(')') + 2:].split()
        return {'pid': pid, 'startTicks': int(fields[19]), 'executable': os.readlink(directory / 'exe'),
                'cwd': os.readlink(directory / 'cwd'),
                'argv': [value.decode() for value in (directory / 'cmdline').read_bytes().split(b'\0') if value]}
    except (FileNotFoundError, ProcessLookupError):
        return None


def listening_inodes(port):
    result = set()
    for name in ['tcp', 'tcp6']:
        path = Path('/proc/net') / name
        if not path.exists():
            continue
        for line in path.read_text().splitlines()[1:]:
            columns = line.split()
            if len(columns) > 9 and columns[3] == '0A' and int(columns[1].rsplit(':', 1)[1], 16) == port:
                result.add('socket:[' + columns[9] + ']')
    return result


def process_fds(pid):
    result = set()
    for path in (Path('/proc') / str(pid) / 'fd').iterdir():
        try:
            result.add(os.readlink(path))
        except FileNotFoundError:
            continue
    return result


def check_owned(assignment):
    server = assignment['ownedServer']
    require(process_identity(server['pid']) == server, 'Assigned server identity changed or is absent')
    protected = process_identity(1063)
    require(protected is not None and protected['startTicks'] == 874, 'Protected root identity changed')
    require(server['pid'] != 1063 and server['cwd'] == str(CHECKOUT), 'Server is outside the assigned owned checkout')
    namespace = os.readlink('/proc/self/ns/net')
    require(os.readlink('/proc/' + str(server['pid']) + '/ns/net') == namespace
            and os.readlink('/proc/1063/ns/net') == namespace, 'Assigned processes have different network namespaces')
    owned_listeners = listening_inodes(5373)
    protected_listeners = listening_inodes(4173)
    server_fds = process_fds(server['pid'])
    protected_fds = process_fds(1063)
    require(owned_listeners and owned_listeners <= server_fds, 'Assigned server does not exclusively own the observed5373 listener inodes')
    require(protected_listeners and protected_listeners <= protected_fds and not (protected_listeners & server_fds),
            'Protected4173 listener ownership changed or the assigned server holds it')
    require(str(DB) in assignment['freshDatabase']['path'], 'Fresh DB path differs')
    require(not DB.is_symlink() and DB.resolve() == DB, 'Fresh DB path must resolve directly without symlinks')
    mode = DB.lstat().st_mode
    require(stat.S_ISREG(mode), 'Fresh database is not regular')
    info = DB.stat()
    expected = assignment['freshDatabase']
    require(expected['path'] == str(DB) and info.st_dev == expected['device'] and info.st_ino == expected['inode'],
            'Fresh database inode differs from the admitted identity')
    require(info.st_nlink == 1, 'Fresh database has an unexpected hardlink')
    require(info.st_size <= 1024 * 1024 * 1024, 'Fresh raw DB byte budget exceeded')
    require(PROTECTED not in DB.parents and '/ai-save401-final-83941bc-r1/' not in str(DB), 'Old or protected DB is prohibited')
    return {'path': str(DB), 'device': info.st_dev, 'inode': info.st_ino, 'bytes': info.st_size, 'linkCount': info.st_nlink}


def exclusive_bytes(path, data):
    with path.open('xb') as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())


def request_stop(_signum, _frame):
    global STOP_REQUESTED
    STOP_REQUESTED = True


def validate_assignment(path):
    require(sys.flags.optimize == 0, 'Python optimization is prohibited')
    require(path.is_absolute() and not path.is_symlink(), 'Explicit assignment must be absolute and not a symlink')
    raw = path.read_bytes()
    require(len(raw) <= 65536, 'Assignment byte limit exceeded')
    assignment = json.loads(raw)
    require(assignment['kind'] == 'feature63-passive-wave-collector-assignment-v1', 'Assignment kind differs')
    require(assignment['rootApproved'] is True and assignment['heavySlot']['assigned'] is True
            and assignment['heavySlot']['exclusive'] is True and bool(assignment['heavySlot']['slotId']),
            'Root approval and exclusive heavy-slot assignment are required')
    pin = assignment['sourcePin']
    require(isinstance(pin, str) and len(pin) == 40 and all(c in '0123456789abcdef' for c in pin), 'Root source pin is missing')
    require(assignment['checkout'] == str(CHECKOUT) and assignment['outputPrefix'] == 'work/feature63-human-wave-composition-r4',
            'Assignment checkout or prefix differs')
    require(assignment['collectorSha256'] == sha(Path(__file__).read_bytes()), 'Collector candidate bytes differ')
    inventory, inventory_id = load_bound_file(assignment['sourceInventory'])
    require(inventory['sourcePin'] == pin and inventory['status'] == 'PASS', 'Current source byte-binding receipt is absent')
    review, review_id = load_bound_file(assignment['reviewReceipt'])
    require(review['status'] == 'PASS' and review['sourcePin'] == pin and review['collectorSha256'] == assignment['collectorSha256'],
            'Fresh admitted collector review is absent')
    public, public_id = load_bound_file(assignment['publicMatchIdentity'])
    require(public['schema'] == 'feature63-public-match-identity-v1' and public['sourcePin'] == pin, 'Public identity source differs')
    require(public['matchId'] and {row['side'] for row in public['hellos']} == {0, 1}, 'Both public player hellos are required')
    require(len(public['accounts']) == 2 and len({row['account']['id'] for row in public['accounts']}) == 2,
            'Distinct public account IDs are required')
    for row in public['hellos']:
        message = row['message']
        require(message['kind'] == 'hello' and message['role'] == 'player' and message['side'] == row['side']
                and message['matchId'] == public['matchId'], 'Public hello identity differs')
    require(public['expectedTeams'] == [0, 0, 1, 1] and public['expectedControllers'] == ['external', 'external', 'ai', 'ai'],
            'Public topology differs')
    require(assignment['bounds'] == {'maxSeconds': MAX_SECONDS, 'pollIntervalSeconds': 1, 'maxQueries': MAX_QUERIES,
                                    'maxRecords': MAX_RECORDS, 'maxCheckpointBytes': MAX_BYTES}, 'Admitted bounds differ')
    return assignment, public, {'path': str(path), 'bytes': len(raw), 'sha256': sha(raw)}, inventory_id, review_id, public_id


def main():
    require(len(sys.argv) == 2, 'Supply exactly one explicit root-approved assignment path; pending specimen will fail')
    assignment, public, assignment_id, inventory_id, review_id, public_id = validate_assignment(Path(sys.argv[1]))
    database_before = check_owned(assignment)
    require(not OUTPUT.exists() and OUTPUT.parent == PREFIX, 'Collector output must be fresh')
    OUTPUT.mkdir()
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    receipt = {'schema': 'feature63-passive-wave-collector-v1', 'sourcePin': assignment['sourcePin'],
               'matchId': public['matchId'], 'startedAt': now(), 'closed': False, 'readOnly': True, 'noFeedback': True,
               'assignmentIdentity': assignment_id, 'reviewIdentity': review_id, 'sourceInventory': inventory_id,
               'publicMatchIdentity': public_id, 'dbIdentity': {'device': database_before['device'], 'inode': database_before['inode']},
               'databaseBefore': database_before, 'rows': [], 'failure': None, 'activeQuery': None,
               'limits': 'Complete selected checkpoint TEXT only. No DB hash/copy, engine writes or private state feedback to human controls.'}
    connection = None
    reason = None
    retained = set()
    total = 0
    started = time.monotonic()
    try:
        connection = sqlite3.connect(DB.as_uri() + '?mode=ro', uri=True, timeout=1)
        connection.set_progress_handler(lambda: 1 if STOP_REQUESTED or time.monotonic() - started >= MAX_SECONDS else 0, 1000)
        connection.execute('PRAGMA query_only=ON')
        require(connection.execute('PRAGMA query_only').fetchone()[0] == 1, 'Read-only query mode was not enabled')
        for query_ordinal in range(1, MAX_QUERIES + 1):
            if STOP_REQUESTED:
                reason = 'owned_stop_signal'
                break
            if time.monotonic() - started >= MAX_SECONDS:
                reason = 'lifetime_bound'
                break
            check_owned(assignment)
            parameters = [MAX_BYTES - METADATA_RESERVE_BYTES - total, public['matchId'], json.dumps(sorted(retained), separators=(',', ':'))]
            query_record = {'queryOrdinal': query_ordinal, 'at': now(), 'query': QUERY, 'parameters': parameters}
            query_bytes = (json.dumps(query_record, separators=(',', ':'), ensure_ascii=False) + '\n').encode('utf-8')
            require(len(query_bytes) <= 2048, 'Query metadata record byte limit exceeded')
            query_path = OUTPUT / 'queries.ndjson'
            require((query_path.stat().st_size if query_path.exists() else 0) + len(query_bytes) <= MAX_QUERY_LOG_BYTES,
                    'Query metadata aggregate byte limit exceeded')
            with query_path.open('ab') as queries:
                queries.write(query_bytes)
                queries.flush()
                os.fsync(queries.fileno())
            receipt['activeQuery'] = query_record
            row = connection.execute(QUERY, parameters).fetchone()
            query_record['returned'] = row is not None
            receipt['activeQuery'] = None
            if row is not None:
                match_id, match_tick, checkpoint_tick, checkpoint_bytes, checkpoint_text, generation_text, config_text = row
                receipt['lastReturnedMetadata'] = {'matchId': match_id, 'matchTick': match_tick, 'checkpointTick': checkpoint_tick,
                                                   'checkpointBytes': checkpoint_bytes, 'generationText': generation_text,
                                                   'configText': config_text, 'queryOrdinal': query_ordinal}
                require(checkpoint_text is not None, 'Native TEXT exceeds remaining checkpoint/metadata bounds; SQL selected metadata/null only')
                payload = checkpoint_text.encode('utf-8')
                require(len(payload) == checkpoint_bytes and total + len(payload) <= MAX_BYTES - METADATA_RESERVE_BYTES,
                        'Selected checkpoint byte count differs or exceeds reserved payload budget')
                ordinal = len(receipt['rows']) + 1
                filename = 'native-wave-checkpoint-' + str(ordinal).zfill(2) + '.json'
                exclusive_bytes(OUTPUT / filename, payload)
                total += len(payload)
                receipt['lastReturnedMetadata'].update({'file': filename, 'bytes': len(payload), 'checkpointTextSha256': sha(payload)})
                require(isinstance(generation_text, str) and isinstance(config_text, str), 'Native TEXT provenance columns are absent')
                require(len(generation_text.encode('utf-8')) <= 4096 and len(config_text.encode('utf-8')) <= 65536
                        and not any(ord(value) < 32 for value in generation_text + config_text),
                        'Native generation/config TEXT exceeds reserved metadata bounds')
                wave_ids = []
                record = {'file': filename, 'bytes': len(payload), 'checkpointTextSha256': sha(payload),
                          'query': QUERY, 'parameters': parameters, 'queryOrdinal': query_ordinal, 'collectorOrdinal': ordinal,
                          'matchId': match_id, 'matchTick': match_tick, 'checkpointTick': checkpoint_tick,
                          'generationText': generation_text, 'generationTextSha256': sha(generation_text.encode('utf-8')),
                          'generation': None, 'configText': config_text,
                          'configTextSha256': sha(config_text.encode('utf-8')), 'waveIds': wave_ids, 'observedAt': now()}
                receipt['rows'].append(record)
                record['generation'] = json.loads(generation_text)
                save = json.loads(checkpoint_text)
                require(save['format'] == 'orcs-vs-fairies-save' and save['version'] == 4
                        and save['state']['tick'] == checkpoint_tick, 'Native checkpoint envelope/tick differs')
                state = save['state']
                require(state['controllers'] == ['external', 'external', 'ai', 'ai'] and state['teams'] == [0, 0, 1, 1], 'Native topology differs')
                candidates = [wave for wave in save['runtime']['teamAI']['coordinator']['waves']
                              if wave['launched'] is True and wave['id'] not in retained
                              and {participant['side'] for participant in wave['participants']} == {2, 3}]
                require(candidates and match_id == public['matchId'], 'SQL selection and native wave identities differ')
                wave_ids = sorted(wave['id'] for wave in candidates)
                require(len(retained | set(wave_ids)) <= MAX_RECORDS, 'Unique launched-wave cap exceeded')
                record['waveIds'] = wave_ids
                retained.update(wave_ids)
                if len(receipt['rows']) >= MAX_RECORDS:
                    reason = 'record_bound'
                    break
            # Require at least one full second after the preceding SELECT completes.
            next_poll = time.monotonic() + 1
            while not STOP_REQUESTED and time.monotonic() < next_poll and time.monotonic() - started < MAX_SECONDS:
                time.sleep(max(0, min(0.1, next_poll - time.monotonic())))
        else:
            reason = 'query_bound'
    except sqlite3.OperationalError as error:
        interrupted = getattr(error, 'sqlite_errorcode', None) == sqlite3.SQLITE_INTERRUPT
        if interrupted and (STOP_REQUESTED or time.monotonic() - started >= MAX_SECONDS):
            reason = 'owned_stop_signal' if STOP_REQUESTED else 'lifetime_bound'
            receipt['boundedQueryInterruption'] = {'query': receipt['activeQuery'], 'at': now()}
            receipt['activeQuery'] = None
        else:
            receipt['failure'] = {'type': type(error).__name__, 'message': str(error), 'at': now()}
            reason = 'first_failure'
    except Exception as error:
        receipt['failure'] = {'type': type(error).__name__, 'message': str(error), 'at': now()}
        reason = 'first_failure'
    finally:
        if connection is not None:
            connection.close()
        receipt.update({'closed': True, 'closedAt': now(), 'stopReason': reason, 'records': len(receipt['rows']),
                        'checkpointPayloadBytes': total, 'elapsedSeconds': time.monotonic() - started,
                        'status': 'PASS' if receipt['failure'] is None else 'FAIL',
                        'qualification': 'Collector retention status only; no feature63 qualification or human combat claim.'})
        receipt['bounds'] = {'totalCollectorBytes': MAX_BYTES, 'metadataReserveBytes': METADATA_RESERVE_BYTES,
                             'checkpointPayloadUpperBoundBytes': MAX_BYTES - METADATA_RESERVE_BYTES,
                             'queryLogBytes': MAX_QUERY_LOG_BYTES, 'maxSeconds': MAX_SECONDS, 'pollSeconds': 1,
                             'maxQueries': MAX_QUERIES, 'maxRecords': MAX_RECORDS}
        receipt_bytes = (json.dumps(receipt, indent=2, sort_keys=True, ensure_ascii=False) + '\n').encode('utf-8')
        existing_bytes = sum(path.stat().st_size for path in OUTPUT.iterdir() if path.is_file())
        require(existing_bytes + len(receipt_bytes) <= MAX_BYTES, 'Complete collector output byte budget exceeded')
        exclusive_bytes(OUTPUT / 'collector-receipt.json', receipt_bytes)
    print('Owned passive collector closed; receipt retained.')
    return 1 if receipt['failure'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
