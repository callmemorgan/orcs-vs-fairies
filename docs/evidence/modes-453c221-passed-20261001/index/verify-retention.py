"""Verify retained bytes and omitted pinned Git blobs; no product execution.
Usage: python3 verify-retention.py PACKET_OR_RETAINED_SUBSET GIT_REPOSITORY
"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
index=Path(__file__).resolve().parent
packet=Path(sys.argv[1]).resolve()
repo=Path(sys.argv[2]).resolve()
summary=json.loads((index/'retention-summary.json').read_text())
retained=json.loads((index/'retained-packet-files.json').read_text())['artifacts']
omissions=json.loads((index/'git-preserved-omissions.json').read_text())['artifacts']
links=json.loads((index/'external-link-metadata.json').read_text())['links']
pin=summary['sourcePin']
def record(data):return {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
assert len(retained)==153 and len(omissions)==989 and len(links)==1
assert len(retained)+len(omissions)+len(links)==summary['wholePacketPathsIncludingIndices']==1143
assert len({item['packetPath'] for item in omissions})==989
assert not (set(retained)&{item['packetPath'] for item in omissions})
manifest=json.loads((packet/'packet-manifest.json').read_text())
assert manifest['sourcePin']==pin
assert record((packet/'packet-manifest.json').read_bytes())['sha256']==summary['sealedPacketManifestSha256']
assert record((packet/'packet-hashes.tsv').read_bytes())['sha256']==summary['sealedPacketHashesTsvSha256']
all_records={name:metadata for name,metadata in retained.items() if name not in ['packet-manifest.json','packet-hashes.tsv']}
all_records.update({item['packetPath']:{key:item[key] for key in ['bytes','sha256']} for item in omissions})
all_records.update(links)
assert all_records==manifest['artifacts']
for name,metadata in retained.items():
 path=packet/name
 assert path.is_file() and not path.is_symlink(),name
 assert record(path.read_bytes())==metadata,name
rawtree=subprocess.check_output(['git','-C',str(repo),'ls-tree','-rz',pin])
tree={}
for entry in rawtree.split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1)
 mode,kind,blob=meta.decode().split()
 tree[name.decode()]={'gitMode':mode,'gitType':kind,'gitBlob':blob}
reader=subprocess.Popen(['git','-C',str(repo),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
cache={}
present_omissions=0
for item in omissions:
 assert tree[item['gitPath']]=={key:item[key] for key in ['gitMode','gitType','gitBlob']},item
 blob=item['gitBlob']
 if blob not in cache:
  reader.stdin.write((blob+'\n').encode());reader.stdin.flush()
  header=reader.stdout.readline().decode().rstrip().split()
  assert header[:2]==[blob,'blob'],header
  data=reader.stdout.read(int(header[2]));assert len(data)==int(header[2])
  assert reader.stdout.read(1)==b'\n'
  cache[blob]=record(data)
 assert cache[blob]=={key:item[key] for key in ['bytes','sha256']},item['packetPath']
 path=packet/item['packetPath']
 if path.exists():
  assert path.is_file() and not path.is_symlink()
  assert record(path.read_bytes())==cache[blob],item['packetPath']
  present_omissions+=1
reader.stdin.close();assert reader.wait()==0
for name,metadata in links.items():
 assert record(metadata['symlink'].encode())=={key:metadata[key] for key in ['bytes','sha256']}
 path=packet/name
 if path.is_symlink():assert os.readlink(path)==metadata['symlink']
 elif path.exists():raise AssertionError('External dependency symlink replaced with other bytes: '+name)
assert (index/'retain-paths.txt').read_text().splitlines()==sorted(retained)
assert sum(item['bytes'] for item in retained.values())==summary['retainedRegularFileBytes']
assert sum(item['bytes'] for item in omissions)==summary['omittedGitAuthenticatedBytes']
seal=json.loads((index/'external-packet-seal.json').read_text())
assert seal['packetManifestSha256']==summary['sealedPacketManifestSha256']
assert seal['packetHashesTsvSha256']==summary['sealedPacketHashesTsvSha256']
print(json.dumps({'result':'passed retained bytes and pinned Git omission mapping','sourcePin':pin,'retainedFilesChecked':len(retained),'omittedCopiesAuthenticatedAgainstGit':len(omissions),'omittedCopiesAlsoPresentAndChecked':present_omissions,'externalSymlinksRepresentedByMetadata':len(links),'productExecution':False,'rootWrites':False,'packetWrites':False}))
