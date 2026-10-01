"""Independent read-only retention inventory and pinned Git byte audit."""
import csv
import hashlib
import json
import os
import stat
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent
INDEX = Path('/tmp/ovf-modes-retention-453c221.qa_ctwp2')
PACKET = Path('/tmp/ovf-modes-complete-packet-453c221.dgl9yk4w')
REPO = Path('/home/morgana/Projects/orcs-vs-Fairies')
PIN = '453c2218af9973b9eca8fb78392435bd9d46a740'
checks = []
reads = {}

def check(name, condition, detail=None):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
    if not condition:
        raise AssertionError(name)

def record(data):
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def read(path):
    data = path.read_bytes()
    reads[str(path)] = record(data)
    return data

def load(path):
    return json.loads(read(path))

def parse_hashes(path):
    rows = list(csv.DictReader(read(path).decode().splitlines(), delimiter='\t'))
    check('hash index has unique paths: ' + str(path), len({r['path'] for r in rows}) == len(rows))
    return {r['path']: {'bytes': int(r['bytes']), 'sha256': r['sha256']} for r in rows}

started = datetime.now(timezone.utc).isoformat()
summary = load(INDEX/'retention-summary.json')
retention_document = load(INDEX/'retained-packet-files.json')
omissions_document = load(INDEX/'git-preserved-omissions.json')
link_document = load(INDEX/'external-link-metadata.json')
manifest = load(PACKET/'packet-manifest.json')
retained = retention_document['artifacts']
omissions = omissions_document['artifacts']
links = link_document['links']
index_snapshot = record(read(INDEX/'retention-index-hashes.tsv'))
check('expected retention index SHA256', index_snapshot['sha256'] == 'a7a400adc21ef26351544e421aca2974873fbc5780c0b3dd85ed556c192b0956')
for name, document in [('summary',summary),('retained',retention_document),('omissions',omissions_document),('links',link_document),('manifest',manifest)]:
    check('immutable source pin: '+name, document['sourcePin'] == PIN)
check('feature status scope restricted to 69', summary['requiredFeatureStatusScope'] == [69])
indexed = parse_hashes(INDEX/'retention-index-hashes.tsv')
actual_index_files = {p.name for p in INDEX.iterdir() if p.is_file() and not p.is_symlink()}
check('all retention index files authenticated except hash index itself', set(indexed) == actual_index_files-{'retention-index-hashes.tsv'})
check('retention index has no additional nonregular paths', len(actual_index_files) == len(list(INDEX.iterdir())))
for name, expected in indexed.items():
    check('retention index bytes: '+name, record(read(INDEX/name)) == expected)

packet_hashes = parse_hashes(PACKET/'packet-hashes.tsv')
check('packet TSV agrees with full manifest', packet_hashes == {name:{k:value[k] for k in ['bytes','sha256']} for name,value in manifest['artifacts'].items()})
check('sealed packet manifest SHA256', record(read(PACKET/'packet-manifest.json'))['sha256'] == summary['sealedPacketManifestSha256'] == '07af4b0f3e142056a7d87f191ca74b8686195bc5f602701c99ec7495b23c7b40')
check('sealed packet hashes TSV SHA256', record(read(PACKET/'packet-hashes.tsv'))['sha256'] == summary['sealedPacketHashesTsvSha256'] == '8e362ffcc4b998d71f61a37363e6c343fd3ba7ecdbfa6d760e9fc198e937cd43')
seal = load(INDEX/'external-packet-seal.json')
check('external seal copy is unchanged', record(read(INDEX/'external-packet-seal.json'))['sha256'] == '3c103c4186767f5a68aafeb5a508e1ea4609d890a2e7bb40eb341edbe5a667d4')
check('external seal binds both full indices', seal['packetManifestSha256'] == summary['sealedPacketManifestSha256'] and seal['packetHashesTsvSha256'] == summary['sealedPacketHashesTsvSha256'])

regular = set()
actual_links = set()
for root, dirs, filenames in os.walk(PACKET, followlinks=False):
    for name in dirs[:]:
        path = Path(root)/name
        if path.is_symlink():
            actual_links.add(path.relative_to(PACKET).as_posix())
            dirs.remove(name)
    for name in filenames:
        path = Path(root)/name
        relative = path.relative_to(PACKET).as_posix()
        if path.is_symlink(): actual_links.add(relative)
        elif stat.S_ISREG(path.lstat().st_mode): regular.add(relative)
        else: check('packet has no special file: '+relative,False)
omitted = {item['packetPath']:item for item in omissions}
check('989 unique omission paths', len(omitted) == len(omissions) == 989)
check('153 retained regular files', len(retained) == retention_document['fileCount'] == summary['retainedRegularFiles'] == 153)
check('one external dependency symlink', set(links) == actual_links == {'proof/dist-server/node_modules'})
check('retained and omitted sets disjoint', not set(retained)&set(omitted))
check('complete physical packet partition including unchanged indices', regular == set(retained)|set(omitted) and len(regular|actual_links) == 1143)
merged = {name:value for name,value in retained.items() if name not in ['packet-manifest.json','packet-hashes.tsv']}
merged.update({name:{k:item[k] for k in ['bytes','sha256']} for name,item in omitted.items()})
merged.update(links)
check('reconstructed partition agrees with all 1141 full manifest entries', merged == manifest['artifacts'] and manifest['fileCount'] == 1141)
check('full manifest byte sum including link target text', sum(x['bytes'] for x in manifest['artifacts'].values()) == manifest['bytes'] == 164978883)
check('retained byte total', sum(x['bytes'] for x in retained.values()) == retention_document['bytes'] == summary['retainedRegularFileBytes'] == 26216711)
check('omitted byte total', sum(x['bytes'] for x in omissions) == omissions_document['omittedBytes'] == summary['omittedGitAuthenticatedBytes'] == 139079685)
check('retained sorted path list is complete', read(INDEX/'retain-paths.txt').decode().splitlines() == sorted(retained))
for name,value in retained.items():
    check('retained packet bytes: '+name, record(read(PACKET/name)) == value)

git_tree_data = subprocess.check_output(['git','-C',str(REPO),'ls-tree','-rz',PIN])
(OUT/'pinned-git-tree.nul').write_bytes(git_tree_data)
tree = {}
for entry in git_tree_data.split(b'\0'):
    if not entry: continue
    metadata,path = entry.split(b'\t',1)
    mode,kind,blob = metadata.decode().split()
    tree[path.decode()] = {'gitMode':mode,'gitType':kind,'gitBlob':blob}
blob_reader = subprocess.Popen(['git','-C',str(REPO),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
blob_records = {}
reasons = Counter()
for item in omissions:
    packet_path,git_path,reason = item['packetPath'],item['gitPath'],item['reason']
    reasons[reason] += 1
    check('pinned Git path/mode/type/blob: '+packet_path, tree.get(git_path) == {k:item[k] for k in ['gitMode','gitType','gitBlob']} and item['gitType'] == 'blob' and item['gitMode'] in ['100644','100755'])
    if reason == 'duplicate-pinned-source-input':
        check('source omission path relation: '+packet_path, packet_path == 'source-inputs/'+git_path and 'sourceInputCopy' not in item)
    elif reason == 'duplicate-pinned-public-dist-asset':
        check('public dist omission path relation: '+packet_path, packet_path.startswith('proof/dist/') and git_path == 'public/'+packet_path.removeprefix('proof/dist/') and packet_path != 'proof/dist/favicon.ico' and item['sourceInputCopy'] == 'source-inputs/'+git_path and item['gitMode'] == '100644')
        check('public dist equals authenticated source-input copy: '+packet_path, {k:item[k] for k in ['bytes','sha256','gitBlob','gitMode','gitType']} == {k:omitted[item['sourceInputCopy']][k] for k in ['bytes','sha256','gitBlob','gitMode','gitType']})
    else:
        check('known omission reason: '+packet_path,False)
    blob = item['gitBlob']
    if blob not in blob_records:
        blob_reader.stdin.write((blob+'\n').encode());blob_reader.stdin.flush()
        header = blob_reader.stdout.readline().decode().split()
        check('Git blob header: '+blob, len(header) == 3 and header[:2] == [blob,'blob'])
        data = blob_reader.stdout.read(int(header[2]))
        check('Git blob length and terminator: '+blob, len(data) == int(header[2]) and blob_reader.stdout.read(1) == b'\n')
        blob_records[blob] = record(data)
    expected = {k:item[k] for k in ['bytes','sha256']}
    check('omission bytes equal immutable Git blob: '+packet_path, expected == blob_records[blob] == record(read(PACKET/packet_path)))
blob_reader.stdin.close()
check('Git batch reader exits 0',blob_reader.wait() == 0)
check('source/public omission category counts', dict(reasons) == {'duplicate-pinned-source-input':596,'duplicate-pinned-public-dist-asset':393} and omissions_document['sourceInputCopies'] == summary['sourceInputOmissions'] == 596 and omissions_document['publicDistAssetCopies'] == summary['publicDistAssetOmissions'] == 393)
rows = list(csv.DictReader(read(INDEX/'git-preserved-omissions.tsv').decode().splitlines(),delimiter='\t'))
tsv_items = [{'packetPath':r['packet_path'],'gitPath':r['git_path'],'gitMode':r['git_mode'],'gitType':r['git_type'],'gitBlob':r['git_blob'],'bytes':int(r['bytes']),'sha256':r['sha256'],'reason':r['reason']} for r in rows]
check('omission TSV agrees with JSON path/mode/type/blob/bytes/hash/reason', tsv_items == [{k:item[k] for k in ['packetPath','gitPath','gitMode','gitType','gitBlob','bytes','sha256','reason']} for item in omissions])
build = load(PACKET/'proof/build-manifest.json')
expected_inputs = {}
for category in ['sourceFiles','assetFiles','configFiles','scriptFiles','testFiles','modeScriptFiles']:
    for name,value in build[category].items():
        if name in expected_inputs: check('duplicate provenance input metadata agrees: '+name,expected_inputs[name] == value)
        expected_inputs[name] = value
check('596 omitted source inputs are complete admitted build input set', set(expected_inputs) == {item['gitPath'] for item in omissions if item['reason']=='duplicate-pinned-source-input'} and len(expected_inputs) == 596)
for name,value in expected_inputs.items():
    item = omitted['source-inputs/'+name]
    check('omitted source agrees with actual build provenance: '+name, value == {k:item[k] for k in ['bytes','sha256','gitBlob']})
for name,value in links.items():
    check('dependency link actual target and target bytes', os.readlink(PACKET/name) == value['symlink'] and record(value['symlink'].encode()) == {k:value[k] for k in ['bytes','sha256']} and value['bytes'] == summary['symlinkTargetBytes'] == 51)

retention_receipt = load(INDEX/'retention-verifier-receipt.json')
retention_saved = load(INDEX/'retention-verifier.stdout.txt')
check('saved retention verifier argv and exit status', retention_receipt['argv'] == ['python3',str(INDEX/'verify-retention.py'),str(PACKET),str(REPO)] and retention_receipt['exitCode'] == 0)
check('saved retention verifier output matches checked counts', retention_saved['sourcePin'] == PIN and retention_saved['retainedFilesChecked'] == 153 and retention_saved['omittedCopiesAuthenticatedAgainstGit'] == retention_saved['omittedCopiesAlsoPresentAndChecked'] == 989 and retention_saved['externalSymlinksRepresentedByMetadata'] == 1)
check('saved retention verifier stderr empty',read(INDEX/'retention-verifier.stderr.txt') == b'')
packet_receipt = load(INDEX/'sealed-packet-verifier-receipt.json')
packet_saved = load(INDEX/'sealed-packet-verifier.stdout.txt')
check('saved packet verifier argv and exit status',packet_receipt['argv'] == ['python3',str(PACKET/'verify-packet.py'),str(PACKET)] and packet_receipt['exitCode'] == 0)
check('saved packet verifier output matches actual full indices',packet_saved['sourcePin'] == PIN and packet_saved['files'] == 1141 and packet_saved['packetManifestSha256'] == summary['sealedPacketManifestSha256'] and packet_saved['packetHashesTsvSha256'] == summary['sealedPacketHashesTsvSha256'])
check('saved packet verifier stderr empty',read(INDEX/'sealed-packet-verifier.stderr.txt') == b'')
check('retention index unchanged during audit',record(read(INDEX/'retention-index-hashes.tsv')) == index_snapshot)

audit = {
    'startedAtUtc':started,'finishedAtUtc':datetime.now(timezone.utc).isoformat(),
    'result':'passed independent bounded retention byte/path/Git audit',
    'sourcePin':PIN,'indexDirectory':str(INDEX),'packetDirectory':str(PACKET),
    'retentionIndexSha256':index_snapshot['sha256'],
    'retainedRegularFiles':153,'retainedRegularFileBytes':26216711,
    'omittedCopies':989,'omittedBytes':139079685,'sourceInputOmissions':596,'publicDistAssetOmissions':393,
    'externalSymlinkMetadataEntries':1,'externalSymlinkTargetBytes':51,
    'fullPacketPathsIncludingIndices':1143,'fullPacketManifestEntries':1141,
    'uniqueGitBlobsRead':len(blob_records),'checksPassed':len(checks),'checksTotal':len(checks),
    'rootWrites':False,'packetWrites':False,'indexWrites':False,'productExecution':False,
    'findings':[],'checks':checks,
    'limits':['This read-only audit verifies retention and immutable Git bytes without exercising product behavior.','Physical dependency bytes are external and are represented only by original link target text and retained receipts.','Root alone owns copying, commits, the ledger, and any promotion of original feature 69.']
}
(OUT/'audit.json').write_text(json.dumps(audit,indent=2,sort_keys=True)+'\n')
(OUT/'read-files.json').write_text(json.dumps(reads,indent=2,sort_keys=True)+'\n')
(OUT/'git-blob-records.json').write_text(json.dumps(blob_records,indent=2,sort_keys=True)+'\n')
print(json.dumps({k:v for k,v in audit.items() if k not in ['checks']},indent=2))
