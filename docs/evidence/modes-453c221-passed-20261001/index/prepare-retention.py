"""Build a read-only, bounded retention plan for sealed modes evidence."""
import hashlib,json,os,subprocess
from pathlib import Path
from datetime import datetime,timezone
PACKET=Path('/tmp/ovf-modes-complete-packet-453c221.dgl9yk4w')
OUT=Path(__file__).resolve().parent
REPO=Path('/home/morgana/Projects/orcs-vs-Fairies')
PIN='453c2218af9973b9eca8fb78392435bd9d46a740'
def digest(data):return hashlib.sha256(data).hexdigest()
def write_json(name,value):(OUT/name).write_text(json.dumps(value,indent=2,sort_keys=True)+'\n')
manifest=json.loads((PACKET/'packet-manifest.json').read_text())
assert manifest['sourcePin']==PIN
artifacts=manifest['artifacts']
assert len(artifacts)==1141
rawtree=subprocess.check_output(['git','-C',str(REPO),'ls-tree','-rz',PIN])
tree={}
for entry in rawtree.split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1)
 mode,kind,blob=meta.decode().split()
 tree[name.decode()]={'gitMode':mode,'gitType':kind,'gitBlob':blob}
blob_reader=subprocess.Popen(['git','-C',str(REPO),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
cache={}
def git_data(blob):
 if blob in cache:return cache[blob]
 blob_reader.stdin.write((blob+'\n').encode());blob_reader.stdin.flush()
 head=blob_reader.stdout.readline().decode().rstrip().split()
 assert head[:2]==[blob,'blob'],head
 data=blob_reader.stdout.read(int(head[2]));assert len(data)==int(head[2])
 assert blob_reader.stdout.read(1)==b'\n'
 cache[blob]={'bytes':len(data),'sha256':digest(data)}
 return cache[blob]
omissions=[]
for path,record in sorted(artifacts.items()):
 if not path.startswith('source-inputs/'):continue
 gitpath=path.removeprefix('source-inputs/')
 assert gitpath in tree,gitpath
 gitrecord=tree[gitpath]
 assert gitrecord['gitType']=='blob' and gitrecord['gitMode'] in ['100644','100755'],gitrecord
 data=(PACKET/path).read_bytes()
 assert 'symlink' not in record
 assert {'bytes':len(data),'sha256':digest(data)}==record
 assert git_data(gitrecord['gitBlob'])==record,path
 omissions.append({'packetPath':path,'gitPath':gitpath,'reason':'duplicate-pinned-source-input',**gitrecord,**record})
source_count=len(omissions)
assert source_count==596,source_count
for path,record in sorted(artifacts.items()):
 if not path.startswith('proof/dist/') or path=='proof/dist/favicon.ico':continue
 gitpath='public/'+path.removeprefix('proof/dist/')
 if gitpath not in tree:continue
 gitrecord=tree[gitpath]
 assert gitrecord['gitType']=='blob' and gitrecord['gitMode']=='100644'
 sourcepath='source-inputs/'+gitpath
 assert sourcepath in artifacts
 data=(PACKET/path).read_bytes()
 assert 'symlink' not in record
 assert {'bytes':len(data),'sha256':digest(data)}==record
 assert record==artifacts[sourcepath]==git_data(gitrecord['gitBlob']),path
 omissions.append({'packetPath':path,'gitPath':gitpath,'sourceInputCopy':sourcepath,'reason':'duplicate-pinned-public-dist-asset',**gitrecord,**record})
public_count=len(omissions)-source_count
assert public_count==393,public_count
blob_reader.stdin.close();assert blob_reader.wait()==0
omit_paths={record['packetPath'] for record in omissions}
links={path:record for path,record in artifacts.items() if 'symlink' in record}
assert set(links)=={'proof/dist-server/node_modules'}
retained={path:record for path,record in artifacts.items() if path not in omit_paths and path not in links}
for path in ['packet-manifest.json','packet-hashes.tsv']:
 data=(PACKET/path).read_bytes();retained[path]={'bytes':len(data),'sha256':digest(data)}
assert len(retained)==153
assert len(retained)+len(omissions)+len(links)==1143
required=['proof/dist/favicon.ico','proof/final-manifest.json','proof/final-hashes.tsv','proof/run.json','proof/prepare.json','dispatch/first-cleanup-observer-failure.json','dispatch/first-cleanup-bind-traceback.txt','dispatch/cleanup-bind-capture-details.json','dispatch/final-direct-cleanup-observation.json','external-assets/favicon-http-receipt.json','external-assets/favicon-response.ico','admitted-helpers/prepare-after-release.sh','admitted-helpers/run-once-after-release.sh','admitted-helpers/verify-results.py','packet-summary.json','packet-manifest.json','packet-hashes.tsv']
assert all(path in retained for path in required)
for path in artifacts:
 if path.startswith(('proof/browser/','proof/native/','proof/runtime/','proof/modules/','proof/logs/','preparation-launch/','dispatch/','bound-recipe/','external-postflight/')):
  assert path in retained,path
write_json('git-preserved-omissions.json',{'sourcePin':PIN,'sourceInputCopies':source_count,'publicDistAssetCopies':public_count,'omissionCount':len(omissions),'omittedBytes':sum(item['bytes'] for item in omissions),'artifacts':omissions})
write_json('external-link-metadata.json',{'sourcePin':PIN,'packetDirectory':str(PACKET),'physicalLinkCopyRecommended':False,'links':links,'meaning':'Exact archived target text; full installed dependency bytes are external to this packet. Retain this metadata and existing preparation/dependency receipts. This does not provide portable dependencies.'})
write_json('retained-packet-files.json',{'packetDirectory':str(PACKET),'sourcePin':PIN,'fileCount':len(retained),'bytes':sum(record['bytes'] for record in retained.values()),'artifacts':retained})
(OUT/'retain-paths.txt').write_text(''.join(path+'\n' for path in sorted(retained)))
(OUT/'git-preserved-omissions.tsv').write_text('packet_path\tgit_path\tgit_mode\tgit_type\tgit_blob\tbytes\tsha256\treason\n'+''.join('\t'.join(str(item[key]) for key in ['packetPath','gitPath','gitMode','gitType','gitBlob','bytes','sha256','reason'])+'\n' for item in omissions))
summary={'createdAtUtc':datetime.now(timezone.utc).isoformat(),'sourcePin':PIN,'packetDirectory':str(PACKET),'sealedPacketManifestSha256':digest((PACKET/'packet-manifest.json').read_bytes()),'sealedPacketHashesTsvSha256':digest((PACKET/'packet-hashes.tsv').read_bytes()),'wholePacketPathsIncludingIndices':1143,'retainedRegularFiles':len(retained),'retainedRegularFileBytes':sum(record['bytes'] for record in retained.values()),'omittedGitAuthenticatedCopies':len(omissions),'omittedGitAuthenticatedBytes':sum(item['bytes'] for item in omissions),'sourceInputOmissions':source_count,'publicDistAssetOmissions':public_count,'externalSymlinksRepresentedByMetadata':len(links),'symlinkTargetBytes':sum(record['bytes'] for record in links.values()),'rootCheckoutWrites':False,'productExecution':False,'sealedPacketMutated':False,'externalOriginalsRemoved':False,'requiredFeatureStatusScope':[69],'limits':['Retention authenticates duplicate bytes against immutable Git blobs; it does not execute product code.','The original failed temporary bind observation remains failed, separately retained, and without established cause.','All original report paths and attempt labels remain unchanged. The retained subset is not a newly executed acceptance root.','The admitted packet and all external originals stay in place. Root owns review, copying, commit, and the feature ledger.']}
write_json('retention-summary.json',summary)
print(json.dumps(summary,indent=2))
