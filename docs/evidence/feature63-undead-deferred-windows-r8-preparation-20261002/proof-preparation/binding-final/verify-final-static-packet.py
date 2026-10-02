#!/usr/bin/env python3
from pathlib import Path
import ast, hashlib, json, stat
base=Path(__file__).resolve().parent
manifest=json.loads((base/'final-manifest.json').read_bytes())
def digest(raw): return hashlib.sha256(raw).hexdigest()
for row in manifest['artifacts']:
    path=Path(row['path']); raw=path.read_bytes()
    assert len(raw)==row['bytes'] and digest(raw)==row['sha256'] and stat.S_IMODE(path.stat().st_mode)==row['mode'], str(path)
source=Path(manifest['reviewedR7Utility']['path']).read_bytes()
intermediate=Path(manifest['preservedIntermediate']['path']).read_bytes()
candidate=(base/'fresh-r8-bindings.py').read_bytes()
assert digest(source)==manifest['reviewedR7Utility']['sha256']
assert digest(intermediate)==manifest['preservedIntermediate']['sha256']
rows=json.loads((base/'substitutions.json').read_bytes())['substitutions']
forward=source.decode()
for row in rows:
    assert forward.count(row['old'])==1
    forward=forward.replace(row['old'],row['new'],1)
assert forward.encode()==candidate
reverse=candidate.decode()
for row in reversed(rows):
    assert reverse.count(row['new'])==1
    reverse=reverse.replace(row['new'],row['old'],1)
assert reverse.encode()==source
ast.parse(source); tree=ast.parse(candidate)
assignments={node.targets[0].id:ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name) and node.targets[0].id in {'EXPECTED_REVIEW_SCHEMA','EXPECTED_REVIEW_STATUS','EXPECTED_SCRIPT_DESCRIPTORS'}}
assert assignments['EXPECTED_REVIEW_SCHEMA']==manifest['rootChosenReviewSchema']
assert assignments['EXPECTED_REVIEW_STATUS']==manifest['rootChosenReviewStatus']
assert assignments['EXPECTED_SCRIPT_DESCRIPTORS']=={role:{key:row[key] for key in ('bytes','sha256')} for role,row in manifest['approvedScriptRoles'].items()}
for role,row in manifest['approvedScriptRoles'].items():
    raw=Path(row['path']).read_bytes(); assert len(raw)==row['bytes'] and digest(raw)==row['sha256']
assert 'r7StaticReview' not in candidate.decode()
print(json.dumps({'savedArtifactReadback':'PASS','forwardBytes':'PASS','inverseBytes':'PASS','sourceAstParse':'PASS','candidateAstParse':'PASS','rootChosenReviewGuardReadback':'PASS','approvedScriptDescriptorAnchorsReadback':'PASS','preservedIntermediateReadback':'PASS','sourceOrCandidateExecutedOrImported':False},sort_keys=True))
