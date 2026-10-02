#!/usr/bin/env python3
"""Fill the existing r3 extraction input from root-controlled retained files.

No SQLite, process, capture, extraction, audit, source mutation or approval logic.
Root decision fields are copied from the explicit control; audit/admission stay false.
"""
import argparse
import hashlib
import json
import os
import re
import stat
from pathlib import Path

HELPER_SHA256 = 'fccd7ba02a92c2496b56699cb8fbb323f16cb2a817596093951b10a72446e7d8'
AUDITOR_SHA256 = '4862672ef96aba39799d3ef9c6280be9fbeaa8194391b3f2b5acefb5e7cd76fb'
INPUT_FIELDS = {
    'schema','approved','assignedBy','extractAuthorized','sourcePin','productVersion','helperSha256','sourceRoot','freshPrefix','outputRoot',
    'ownedNativeLifetimeIndependentlyAdmitted','nativeAuditAuthorized','rootExtractionAdmissionApproved','rawDatabase','captureAssignment',
    'captureResult','sourceInventory','buildBinding','serverBuild','nativeSchemaReview','publicProducer','publicDriver','collector','auditor',
    'collectorAssignment','closedRawReceipt','rootCustodyReceipt','rootNativeLifetimeReceipt','collectorFiles','publicFiles',
}
PUBLIC_NAMES = (
    'public-results.json','public-identities.json','public-windows.json','public-cleanup.json','public-match-identity.json',
    'human-one-wire.ndjson','human-two-wire.ndjson','human-one-ui-actions.ndjson','human-two-ui-actions.ndjson',
)
PROTECTED = Path('/home/morgana/Projects/orcs-vs-Fairies')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def parse(raw):
    def pairs(items):
        result = {}
        for key,value in items:
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
    return (info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns,info.st_ctime_ns,info.st_mode,info.st_nlink)


def read(path, cap):
    path = canonical(path)
    require(path.suffix not in ('.sqlite','.db') and not any(path.name.endswith(v) for v in ('-wal','-shm','-journal')),
            'Database and sidecar inputs are prohibited')
    fd = os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size <= cap, 'Nonregular, linked or oversized file')
        chunks,remaining = [],before.st_size
        while remaining:
            chunk = os.read(fd,min(remaining,1024*1024))
            require(bool(chunk),'Short file read')
            chunks.append(chunk)
            remaining -= len(chunk)
        require(not os.read(fd,1) and identity(before)==identity(os.fstat(fd)) and identity(before)==identity(path.lstat()), 'File changed while reading')
        raw = b''.join(chunks)
        return raw,{'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    finally:
        os.close(fd)


def bound(record, cap=2*1024*1024):
    require(type(record) is dict and set(record)=={'path','bytes','sha256'}, 'Descriptor must have exact path/bytes/sha256 fields')
    raw,actual = read(record['path'],cap)
    require(actual==record,'Retained descriptor differs from actual bytes')
    return parse(raw)


def json_file(path, cap=2*1024*1024):
    raw,record = read(path,cap)
    return parse(raw),record


def write_new(path,value):
    raw = (json.dumps(value,indent=2,sort_keys=True,ensure_ascii=False,allow_nan=False)+'\n').encode('utf-8')
    fd = os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        with os.fdopen(fd,'wb',closefd=False) as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(fd)
        os.fchmod(fd,0o444)
    finally:
        os.close(fd)
    return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}


def fill(args):
    require(re.fullmatch('[0-9a-f]{40}',args.source_pin),'Supply the full actual future pin')
    control,_ = json_file(args.control,128*1024)
    require(type(control) is dict and set(control)==INPUT_FIELDS,'Control must use the existing exact30-field input shape')
    require(control['schema']=='feature63-root-closed-extraction-assignment-v1' and control['assignedBy']=='/root', 'Wrong root control schema/assigner')
    require(type(control['approved']) is bool and type(control['extractAuthorized']) is bool
            and (type(control['ownedNativeLifetimeIndependentlyAdmitted']) is bool or control['ownedNativeLifetimeIndependentlyAdmitted'] is None),
            'Root must supply explicit decision values')
    require(control['nativeAuditAuthorized'] is False and control['rootExtractionAdmissionApproved'] is False,
            'First extraction control must retain false audit/admission decisions')
    require(control['sourcePin'] in (None,args.source_pin),'Control pin differs')
    require(control['helperSha256']==HELPER_SHA256 and control['productVersion']=='4.0.2','Control helper/version differs')
    capture,capture_record = json_file(args.bindings)
    require(capture['schema']=='feature63-dedicated-wrapper-assignment-v1' and capture['phase']=='capture'
            and capture['sourcePin']==args.source_pin and capture['freshPrefix']=='work/feature63-human-wave-composition-r3'
            and capture['productVersion']=='4.0.2','Actual r3 capture binding differs')
    source_root = canonical(capture['sourceRoot'])
    prefix = source_root/capture['freshPrefix']
    result,result_record = json_file(args.capture_result,16*1024*1024)
    require(result_record['path']==str(prefix/'lifecycle/driver-result.json') and result['sourcePin']==args.source_pin
            and result['status']=='CAPTURE_PASS_ROOT_SEAL_AND_EXTRACTION_PENDING' and result['firstFailure'] is None
            and result['cleanupFailures']==[] and result['protectedFinalReadback']['status']=='PASS','Actual capture is not passing closed r3')
    closed,closed_record = json_file(args.closed_raw)
    custody,custody_record = json_file(args.custody)
    lifetime,lifetime_record = json_file(args.lifetime)
    schema,schema_record = json_file(args.schema_review)
    match = result['matchId']
    for value,label in ((closed,'closed raw'),(custody,'custody'),(lifetime,'lifetime')):
        require(value['sourcePin']==args.source_pin and value['matchId']==match,label+' identity differs')
    require(closed['schema']=='feature63-closed-raw-v1' and custody['schema']=='feature63-root-raw-custody-v1'
            and lifetime['schema']=='feature63-root-native-lifetime-disposition-v1','Root receipt schema differs')
    require(schema['sourcePin']==args.source_pin and schema['auditorSha256']==AUDITOR_SHA256,'Root schema receipt binding differs')
    # These are root-provided metadata only. This utility never opens or stats the raw database.
    raw_database={'path':str(prefix/'server-data/server.sqlite'),'bytes':closed['rawBytes'],'sha256':closed['rawSha256'],
                  'device':closed['dbIdentity']['device'],'inode':closed['dbIdentity']['inode']}
    require(result['closedFreshDatabaseIdentity']=={k:raw_database[k] for k in ('path','device','inode')},'Capture fresh raw identity differs')
    require(custody['rawDatabase']==raw_database and custody['closedRawReceipt']==closed_record and custody['captureResult']==result_record,
            'Root custody references must identify the actual original retained files')
    require(lifetime['captureResult']==result_record
            and lifetime['ownedNativeLifetimeIndependentlyAdmitted']==control['ownedNativeLifetimeIndependentlyAdmitted'],
            'Root lifetime references/decision differ from explicit control')
    producer,collector,auditor = capture['publicProducer'],capture['collector'],capture['auditor']
    for record in (producer,collector,auditor):
        actual_raw,actual_record = read(record['path'],8*1024*1024)
        require(actual_record==record,'Actual frozen script descriptor differs')
    require(auditor['sha256']==AUDITOR_SHA256,'Frozen auditor differs')
    _wrapper,wrapper_record = read(args.public_driver,8*1024*1024)
    require(wrapper_record['sha256']==capture['wrapperSha256'],'Actual invoked wrapper differs')
    source_inventory=bound(capture['sourceBinding'])
    build=bound(capture['buildBinding'])
    require(source_inventory['sourcePin']==args.source_pin and build['sourcePin']==args.source_pin,'Existing source/build pin differs')
    server_rows=[v for v in build['serverRecords'] if v['path']=='rts-server.js']
    require(len(server_rows)==1,'Production server row missing or ambiguous')
    server_record={'path':str(prefix/'server/rts-server.js'),'bytes':server_rows[0]['bytes'],'sha256':server_rows[0]['sha256']}
    _server,actual_server = read(server_record['path'],1024*1024*1024)
    require(actual_server==server_record,'Production server descriptor differs')
    collector_assignment,collector_assignment_record=json_file(prefix/'lifecycle/collector-assignment.json')
    collector_receipt,collector_receipt_record=json_file(prefix/'native-collector/collector-receipt.json',8*1024*1024)
    require(collector_assignment['sourcePin']==collector_receipt['sourcePin']==args.source_pin and collector_receipt['matchId']==match,
            'Actual collector identity differs')
    rows=collector_receipt['rows']
    require(type(rows) is list and 1<=len(rows)<=4,'Actual retained checkpoints missing')
    names=['collector-receipt.json','queries.ndjson']+['native-wave-checkpoint-'+str(i).zfill(2)+'.json' for i in range(1,len(rows)+1)]
    require([v['file'] for v in rows]==names[2:],'Actual collector checkpoint names differ')
    require({v.name for v in (prefix/'native-collector').iterdir()}==set(names),'Complete collector filename set differs')
    collector_files={}
    for name in names:
        _raw,record=read(prefix/'native-collector'/name,8*1024*1024)
        collector_files[name]=record
    require(sum(v['bytes'] for v in collector_files.values())<=8*1024*1024,'Collector byte cap exceeded')
    public_files={}
    for name in PUBLIC_NAMES:
        _raw,record=read(prefix/'public'/name,64*1024*1024)
        public_files[name]=record
    require(sum(v['bytes'] for v in public_files.values())<=64*1024*1024,'Public byte cap exceeded')
    require(collector_receipt['assignmentIdentity']==collector_assignment_record
            and collector_receipt['sourceInventory']==collector_assignment['sourceInventory']==capture['sourceBinding']
            and collector_receipt['publicMatchIdentity']==collector_assignment['publicMatchIdentity']==public_files['public-match-identity.json'],
            'Actual collector descriptors differ')
    # Copy root's decisions without deriving approval or lifetime from a report.
    filled=dict(control)
    filled.update({'sourcePin':args.source_pin,'sourceRoot':str(source_root),'freshPrefix':capture['freshPrefix'],
        'captureAssignment':capture_record,'captureResult':result_record,'sourceInventory':capture['sourceBinding'],'buildBinding':capture['buildBinding'],
        'serverBuild':server_record,'publicProducer':producer,'publicDriver':wrapper_record,'collector':collector,'auditor':auditor,
        'collectorAssignment':collector_assignment_record,'collectorFiles':collector_files,'publicFiles':public_files,'rawDatabase':raw_database,
        'closedRawReceipt':closed_record,'rootCustodyReceipt':custody_record,'rootNativeLifetimeReceipt':lifetime_record,'nativeSchemaReview':schema_record,
        'nativeAuditAuthorized':False,'rootExtractionAdmissionApproved':False})
    extraction_output=canonical(filled['outputRoot'])
    packet=canonical(args.output_directory)
    for path in (extraction_output,packet):
        require(not path.exists() and path.parent.is_dir() and path!=PROTECTED and PROTECTED not in path.parents
                and path!=source_root and source_root not in path.parents,'Output must be fresh and outside both checkouts')
    require(packet!=extraction_output and packet not in extraction_output.parents and extraction_output not in packet.parents,'Input packet and extraction output must be separate')
    require(set(filled)==INPUT_FIELDS,'Filled input fields changed')
    packet.mkdir(mode=0o700)
    input_record=write_new(packet/'root-extraction-input-r3.json',filled)
    write_new(packet/'retained-receipt-references.json',{'captureResult':result_record,'closedRawReceipt':closed_record,
        'rootCustodyReceipt':custody_record,'rootNativeLifetimeReceipt':lifetime_record,'nativeSchemaReview':schema_record})
    # This utility never supplies the separately authenticated execution anchor or invokes another program.
    print(json.dumps({'status':'FILLED_FOR_ROOT_INSPECTION','input':input_record,'nativeAuditAuthorized':False,
        'rootExtractionAdmissionApproved':False,'rootDecisionsCopiedWithoutInference':True,'helperExecuted':False,'rawOpened':False},sort_keys=True))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    commands=parser.add_subparsers(dest='command',required=True)
    describe=commands.add_parser('describe',help='Describe retained non-database files; no approvals')
    describe.add_argument('--file',action='append',required=True)
    fill_parser=commands.add_parser('fill',help='Fill only the first unapproved-audit extraction input')
    for name in ('control','bindings','capture-result','closed-raw','custody','lifetime','schema-review','public-driver','source-pin','output-directory'):
        fill_parser.add_argument('--'+name,required=True)
    args=parser.parse_args()
    if args.command=='describe':
        print(json.dumps([read(path,16*1024*1024)[1] for path in args.file],indent=2,sort_keys=True))
    else:
        fill(args)


if __name__=='__main__':
    try:
        main()
    except (OSError,ValueError,TypeError,KeyError,AttributeError):
        raise SystemExit('HELD: fill rejected; retained files and decisions unchanged.')
