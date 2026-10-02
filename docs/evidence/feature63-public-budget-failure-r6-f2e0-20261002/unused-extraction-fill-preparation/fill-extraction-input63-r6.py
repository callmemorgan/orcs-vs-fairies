#!/usr/bin/env python3
"""Fill the R6 extraction input from root-controlled retained files.

No SQLite, process, capture, extraction, audit, source mutation, or approval logic.
Root decision fields are copied from an explicit control in a fresh receipt directory;
native audit and extraction admission stay false for the first extraction.
"""
import argparse
import hashlib
import json
import os
import re
import stat
from pathlib import Path

SOURCE_PIN = 'f2e0025937b8caf5dc8f6f9f3de134d92a2d547a'
FRESH_PREFIX = 'work/feature63-human-wave-composition-r6'
BINDINGS_DIRECTORY = Path('/tmp/ovf-root-feature63-r6-bindings-xyvt_n02')
CAPTURE_ASSIGNMENT = BINDINGS_DIRECTORY / 'capture-assignment.json'
CAPTURE_ASSIGNMENT_SHA256 = '470e711127a4bb12c9e00e30a06a97529e2bd0e46ade9d1da6d637f1931210e5'
HELPER_SHA256 = 'fccd7ba02a92c2496b56699cb8fbb323f16cb2a817596093951b10a72446e7d8'
AUDITOR_SHA256 = '4862672ef96aba39799d3ef9c6280be9fbeaa8194391b3f2b5acefb5e7cd76fb'
FIELD_MAP = Path('/tmp/feature63-r3-extraction-input-map-nfNB1jVK/field-map.json')
FIELD_MAP_SHA256 = '08f1483941731d719f8764bb8ecf5a86af33e640a55189a880637794c999843e'
PENDING_TEMPLATE = Path('/tmp/feature63-r3-extraction-input-map-nfNB1jVK/root-extraction-input-r3.pending.json')
PENDING_TEMPLATE_SHA256 = '5dfca2438ffceb1cc2a763caa0552d69aacf96ca3e0f91450da5b6dfcb5b1ce5'
INPUT_FIELDS = {
    'schema', 'approved', 'assignedBy', 'extractAuthorized', 'sourcePin', 'productVersion', 'helperSha256', 'sourceRoot',
    'freshPrefix', 'outputRoot', 'ownedNativeLifetimeIndependentlyAdmitted', 'nativeAuditAuthorized',
    'rootExtractionAdmissionApproved', 'rawDatabase', 'captureAssignment', 'captureResult', 'sourceInventory',
    'buildBinding', 'serverBuild', 'nativeSchemaReview', 'publicProducer', 'publicDriver', 'collector', 'auditor',
    'collectorAssignment', 'closedRawReceipt', 'rootCustodyReceipt', 'rootNativeLifetimeReceipt', 'collectorFiles',
    'publicFiles',
}
DESCRIPTOR_FIELDS = {'path', 'bytes', 'sha256'}
RAW_DATABASE_FIELDS = {'path', 'bytes', 'sha256', 'device', 'inode'}
PUBLIC_NAMES = (
    'public-results.json', 'public-identities.json', 'public-windows.json', 'public-cleanup.json',
    'public-match-identity.json', 'human-one-wire.ndjson', 'human-two-wire.ndjson',
    'human-one-ui-actions.ndjson', 'human-two-ui-actions.ndjson',
)
PROTECTED = Path('/home/morgana/Projects/orcs-vs-Fairies')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def parse(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'Duplicate JSON key')
            result[key] = value
        return result
    return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                      parse_constant=lambda _value: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))


def canonical(value):
    path = Path(value)
    require(path.is_absolute() and path.resolve() == path and not path.is_symlink(), 'Noncanonical path')
    return path


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns, info.st_mode, info.st_nlink)


def read(path, cap):
    path = canonical(path)
    require(path.suffix not in ('.sqlite', '.db') and not any(path.name.endswith(value) for value in ('-wal', '-shm', '-journal')),
            'Database and sidecar inputs are prohibited')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= cap,
                'Nonregular, linked, or oversized file')
        chunks, remaining = [], before.st_size
        while remaining:
            chunk = os.read(fd, min(remaining, 1024 * 1024))
            require(bool(chunk), 'Short file read')
            chunks.append(chunk)
            remaining -= len(chunk)
        require(not os.read(fd, 1) and identity(before) == identity(os.fstat(fd)) and identity(before) == identity(path.lstat()),
                'File changed while reading')
        raw = b''.join(chunks)
        return raw, {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    finally:
        os.close(fd)


def bound(record, cap=2 * 1024 * 1024):
    require(type(record) is dict and set(record) == DESCRIPTOR_FIELDS,
            'Descriptor must have exact path/bytes/sha256 fields')
    raw, actual = read(record['path'], cap)
    require(actual == record, 'Retained descriptor differs from actual bytes')
    return parse(raw)


def json_file(path, cap=2 * 1024 * 1024):
    raw, record = read(path, cap)
    return parse(raw), record


def write_new(path, value):
    raw = (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb', closefd=False) as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(fd)
        os.fchmod(fd, 0o444)
    finally:
        os.close(fd)
    return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def direct_receipt(path, receipt_directory):
    path = canonical(path)
    require(path.parent == receipt_directory, 'Root receipt must be a direct child of the supplied fresh receipt directory')
    return path


def outside_checkouts(path, source_root):
    return (path != PROTECTED and PROTECTED not in path.parents and path != source_root and source_root not in path.parents)


def fill(args):
    field_map, field_map_record = json_file(FIELD_MAP, 128 * 1024)
    template, template_record = json_file(PENDING_TEMPLATE, 128 * 1024)
    require(field_map_record['sha256'] == FIELD_MAP_SHA256 and template_record['sha256'] == PENDING_TEMPLATE_SHA256,
            'Reviewed field map or pending template differs')
    require(field_map['descriptorExactKeys'] == ['path', 'bytes', 'sha256']
            and field_map['rawDatabaseExactKeys'] == ['path', 'bytes', 'sha256', 'device', 'inode']
            and set(template) == INPUT_FIELDS and len(template) == 30,
            'Reviewed 30-field input shape differs')

    receipt_directory = canonical(args.receipt_directory)
    require(receipt_directory.is_dir() and not receipt_directory.is_symlink(), 'Fresh receipt directory is absent or invalid')
    receipt_paths = {
        name: direct_receipt(getattr(args, name), receipt_directory)
        for name in ('control', 'closed_raw', 'custody', 'lifetime', 'schema_review')
    }
    require(len(set(receipt_paths.values())) == len(receipt_paths), 'Root receipt paths must be distinct')

    control, _control_record = json_file(receipt_paths['control'], 128 * 1024)
    require(type(control) is dict and set(control) == INPUT_FIELDS and len(control) == 30,
            'Control must use the reviewed exact 30-field input shape')
    require(control['schema'] == template['schema'] == 'feature63-root-closed-extraction-assignment-v1'
            and control['assignedBy'] == template['assignedBy'] == '/root', 'Wrong root control schema or assigner')
    require(type(control['approved']) is bool and type(control['extractAuthorized']) is bool
            and (type(control['ownedNativeLifetimeIndependentlyAdmitted']) is bool
                 or control['ownedNativeLifetimeIndependentlyAdmitted'] is None),
            'Root must supply explicit decision values')
    require(control['nativeAuditAuthorized'] is False and control['rootExtractionAdmissionApproved'] is False,
            'First extraction control must retain false audit and admission decisions')
    require(control['sourcePin'] in (None, SOURCE_PIN) and control['freshPrefix'] == FRESH_PREFIX,
            'Control pin or prefix differs')
    require(control['helperSha256'] == template['helperSha256'] == HELPER_SHA256
            and control['productVersion'] == template['productVersion'] == '4.0.2',
            'Control helper or product version differs')

    capture, capture_record = json_file(CAPTURE_ASSIGNMENT, 128 * 1024)
    require(capture_record['sha256'] == CAPTURE_ASSIGNMENT_SHA256, 'Bound R6 capture assignment differs')
    require(capture['schema'] == 'feature63-dedicated-wrapper-assignment-v1' and capture['phase'] == 'capture'
            and capture['sourcePin'] == SOURCE_PIN and capture['freshPrefix'] == FRESH_PREFIX
            and capture['productVersion'] == '4.0.2', 'Actual R6 capture binding differs')
    source_root = canonical(capture['sourceRoot'])
    prefix = source_root / FRESH_PREFIX
    require(outside_checkouts(receipt_directory, source_root), 'Receipt directory must be outside both checkouts')

    capture_result_path = canonical(args.capture_result)
    result, result_record = json_file(capture_result_path, 16 * 1024 * 1024)
    require(result_record['path'] == str(prefix / 'lifecycle/driver-result.json') and result['sourcePin'] == SOURCE_PIN
            and result['status'] == 'CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING' and result['firstFailure'] is None
            and result['cleanupFailures'] == [] and result['protectedFinalReadback']['status'] == 'PASS',
            'Actual capture is not the passing closed R6 result')

    closed, closed_record = json_file(receipt_paths['closed_raw'])
    custody, custody_record = json_file(receipt_paths['custody'])
    lifetime, lifetime_record = json_file(receipt_paths['lifetime'])
    schema, schema_record = json_file(receipt_paths['schema_review'])
    match = result['matchId']
    for value, label in ((closed, 'closed raw'), (custody, 'custody'), (lifetime, 'lifetime')):
        require(value['sourcePin'] == SOURCE_PIN and value['matchId'] == match, label + ' identity differs')
    require(closed['schema'] == 'feature63-closed-raw-v1' and custody['schema'] == 'feature63-root-raw-custody-v1'
            and lifetime['schema'] == 'feature63-root-native-lifetime-disposition-v1', 'Root receipt schema differs')
    require(schema['sourcePin'] == SOURCE_PIN and schema['auditorSha256'] == AUDITOR_SHA256,
            'Root schema receipt binding differs')

    # Root supplies metadata from its closed receipt. This utility never opens or stats the raw database.
    raw_database = {
        'path': str(prefix / 'server-data/server.sqlite'),
        'bytes': closed['rawBytes'],
        'sha256': closed['rawSha256'],
        'device': closed['dbIdentity']['device'],
        'inode': closed['dbIdentity']['inode'],
    }
    require(set(raw_database) == RAW_DATABASE_FIELDS, 'Raw database fields changed')
    require(result['closedFreshDatabaseIdentity'] == {key: raw_database[key] for key in ('path', 'device', 'inode')},
            'Capture fresh raw identity differs')
    require(custody['rawDatabase'] == raw_database and custody['closedRawReceipt'] == closed_record
            and custody['captureResult'] == result_record,
            'Root custody references must identify the original retained files')
    require(lifetime['captureResult'] == result_record
            and lifetime['ownedNativeLifetimeIndependentlyAdmitted'] == control['ownedNativeLifetimeIndependentlyAdmitted'],
            'Root lifetime references or decision differ from the explicit control')

    producer, collector, auditor = capture['publicProducer'], capture['collector'], capture['auditor']
    for record in (producer, collector, auditor):
        _actual_raw, actual_record = read(record['path'], 8 * 1024 * 1024)
        require(actual_record == record, 'Actual frozen script descriptor differs')
    require(auditor['sha256'] == AUDITOR_SHA256, 'Frozen auditor differs')
    public_driver_path = source_root / 'scripts/feature63/run-minimal63.py'
    _wrapper, wrapper_record = read(public_driver_path, 8 * 1024 * 1024)
    require(wrapper_record['sha256'] == capture['wrapperSha256'], 'Actual invoked wrapper differs')

    source_inventory = bound(capture['sourceBinding'])
    build = bound(capture['buildBinding'])
    require(source_inventory['sourcePin'] == SOURCE_PIN and build['sourcePin'] == SOURCE_PIN,
            'Existing source or build pin differs')
    server_rows = [value for value in build['serverRecords'] if value['path'] == 'rts-server.js']
    require(len(server_rows) == 1, 'Production server row missing or ambiguous')
    server_record = {
        'path': str(prefix / 'server/rts-server.js'),
        'bytes': server_rows[0]['bytes'],
        'sha256': server_rows[0]['sha256'],
    }
    _server, actual_server = read(server_record['path'], 1024 * 1024 * 1024)
    require(actual_server == server_record, 'Production server descriptor differs')

    collector_assignment, collector_assignment_record = json_file(prefix / 'lifecycle/collector-assignment.json')
    collector_receipt, collector_receipt_record = json_file(prefix / 'native-collector/collector-receipt.json', 8 * 1024 * 1024)
    require(collector_assignment['sourcePin'] == collector_receipt['sourcePin'] == SOURCE_PIN
            and collector_receipt['matchId'] == match, 'Actual collector identity differs')
    rows = collector_receipt['rows']
    require(type(rows) is list and 1 <= len(rows) <= 4, 'Actual retained checkpoints missing')
    names = ['collector-receipt.json', 'queries.ndjson'] + [
        'native-wave-checkpoint-' + str(index).zfill(2) + '.json' for index in range(1, len(rows) + 1)
    ]
    require([value['file'] for value in rows] == names[2:], 'Actual collector checkpoint names differ')
    require({value.name for value in (prefix / 'native-collector').iterdir()} == set(names),
            'Complete collector filename set differs')
    collector_files = {}
    for name in names:
        _raw, record = read(prefix / 'native-collector' / name, 8 * 1024 * 1024)
        collector_files[name] = record
    require(sum(value['bytes'] for value in collector_files.values()) <= 8 * 1024 * 1024,
            'Collector byte cap exceeded')

    public_files = {}
    for name in PUBLIC_NAMES:
        _raw, record = read(prefix / 'public' / name, 64 * 1024 * 1024)
        public_files[name] = record
    require(sum(value['bytes'] for value in public_files.values()) <= 64 * 1024 * 1024,
            'Public byte cap exceeded')
    require(collector_receipt['assignmentIdentity'] == collector_assignment_record
            and collector_receipt['sourceInventory'] == collector_assignment['sourceInventory'] == capture['sourceBinding']
            and collector_receipt['publicMatchIdentity'] == collector_assignment['publicMatchIdentity']
            == public_files['public-match-identity.json'], 'Actual collector descriptors differ')

    # Copy root decisions without deriving approval or lifetime from a report.
    filled = dict(control)
    filled.update({
        'sourcePin': SOURCE_PIN,
        'sourceRoot': str(source_root),
        'freshPrefix': FRESH_PREFIX,
        'captureAssignment': capture_record,
        'captureResult': result_record,
        'sourceInventory': capture['sourceBinding'],
        'buildBinding': capture['buildBinding'],
        'serverBuild': server_record,
        'publicProducer': producer,
        'publicDriver': wrapper_record,
        'collector': collector,
        'auditor': auditor,
        'collectorAssignment': collector_assignment_record,
        'collectorFiles': collector_files,
        'publicFiles': public_files,
        'rawDatabase': raw_database,
        'closedRawReceipt': closed_record,
        'rootCustodyReceipt': custody_record,
        'rootNativeLifetimeReceipt': lifetime_record,
        'nativeSchemaReview': schema_record,
        'nativeAuditAuthorized': False,
        'rootExtractionAdmissionApproved': False,
    })
    extraction_output = canonical(filled['outputRoot'])
    packet = canonical(args.output_directory)
    for path in (extraction_output, packet):
        require(not path.exists() and path.parent.is_dir() and outside_checkouts(path, source_root),
                'Output must be fresh and outside both checkouts')
    require(packet != extraction_output and packet not in extraction_output.parents and extraction_output not in packet.parents,
            'Input packet and extraction output must be separate')
    require(receipt_directory not in packet.parents and packet not in receipt_directory.parents
            and receipt_directory not in extraction_output.parents and extraction_output not in receipt_directory.parents,
            'Receipt directory, input packet, and extraction output must be separate')
    require(set(filled) == INPUT_FIELDS and len(filled) == 30, 'Filled input fields changed')

    packet.mkdir(mode=0o700)
    input_record = write_new(packet / 'root-extraction-input-r6.json', filled)
    write_new(packet / 'retained-receipt-references.json', {
        'captureResult': result_record,
        'closedRawReceipt': closed_record,
        'rootCustodyReceipt': custody_record,
        'rootNativeLifetimeReceipt': lifetime_record,
        'nativeSchemaReview': schema_record,
    })
    # This utility never supplies the separately authenticated execution anchor or invokes another program.
    print(json.dumps({
        'status': 'FILLED_FOR_ROOT_INSPECTION',
        'input': input_record,
        'nativeAuditAuthorized': False,
        'rootExtractionAdmissionApproved': False,
        'rootDecisionsCopiedWithoutInference': True,
        'helperExecuted': False,
        'rawOpened': False,
    }, sort_keys=True))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    describe = commands.add_parser('describe', help='Describe retained non-database files; no approvals')
    describe.add_argument('--file', action='append', required=True)
    fill_parser = commands.add_parser('fill', help='Fill only the first unapproved-audit R6 extraction input')
    for name in ('receipt-directory', 'control', 'capture-result', 'closed-raw', 'custody', 'lifetime',
                 'schema-review', 'output-directory'):
        fill_parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    if args.command == 'describe':
        print(json.dumps([read(path, 16 * 1024 * 1024)[1] for path in args.file], indent=2, sort_keys=True))
    else:
        fill(args)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        raise SystemExit('HELD: R6 fill rejected; retained files and decisions unchanged.')
