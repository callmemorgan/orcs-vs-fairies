#!/usr/bin/env python3
"""Build a file-only import map. This script never copies into the repository."""
from pathlib import Path, PurePosixPath
import argparse
import csv
import datetime
import hashlib
import json

parser = argparse.ArgumentParser()
parser.add_argument('--include', action='append', nargs=2, default=[], metavar=('SOURCE', 'TARGET_SUFFIX'), help='Add a later final review/receipt with its exact source and proposed suffix.')
args = parser.parse_args()
plan_dir = Path(__file__).resolve().parent
source_dir = Path('/tmp/orcs-id53-executable-453c221-hvEbs6')
build_dir = Path('/tmp/orcs-id53-build-453c221-hvEbs6')
run_dir = Path('/tmp/orcs-id53-run-453c221-hvEbs6')
owner = Path('/home/morgana/.codex/worktrees/assembled-allied-ai/orcs-vs-Fairies')
repository = Path('/home/morgana/Projects/orcs-vs-Fairies')
target_base = 'docs/evidence/ai-original-coverage-20261001/id53-opening-probe-453c221'
pin = '453c2218af9973b9eca8fb78392435bd9d46a740'

def fingerprint(path):
    path = Path(path)
    assert path.is_file() and not path.is_symlink(), path
    raw = path.read_bytes()
    return {'sourcePath':str(path), 'bytes':len(raw), 'sha256':hashlib.sha256(raw).hexdigest(), 'mode':oct(path.stat().st_mode & 0o777)}

inventory_path = source_dir / 'artifact-inventory.json'
inventory = json.loads(inventory_path.read_text())
manifest = json.loads((build_dir / 'build-manifest.json').read_text())
preflight = json.loads((source_dir / 'execution-preflight.json').read_text())
recipe = json.loads((source_dir / 'recipe.json').read_text())
assert inventory['fileCount'] == len(inventory['files']) == 44
assert inventory['productPin'] == manifest['product']['sourcePin'] == pin
baseline = {Path(entry['path']):entry for entry in inventory['files']}
for path, entry in baseline.items():
    observed = fingerprint(path)
    assert observed['bytes'] == entry['bytes'] and observed['sha256'] == entry['sha256'], path

helper_sources = {entry['path'] for entry in manifest['helper']['files']}
def classification(group, relative):
    if group == 'source-and-execution-records':
        if relative in helper_sources:
            return 'executable-proof-source' if relative != 'recipe.json' else 'proof-configuration-source'
        if relative.endswith('.txt'):
            return 'raw-build-or-run-log'
        return 'source-authentication-review-or-execution-receipt'
    if group == 'build':
        return 'compiled-native-bundle' if relative.endswith('.mjs') else 'esbuild-metafile' if relative.endswith('.metafile.json') else 'build-identity-manifest'
    if relative.endswith('endpoint-session.json') or relative.endswith('checkpoint-at-first-worker-attack-command-session.json'):
        return 'raw-native-session'
    if relative.endswith('initial-save4.json'):
        return 'raw-native-initial-save'
    if relative.endswith('.jsonl'):
        return 'raw-command-payment-production-or-combat-evidence'
    return 'native-verification-review-comparison-or-run-receipt'

entries = []
observed_paths = set()
prefixes = {'source-and-execution-records':'source', 'build':'build', 'run':'run'}
roots = {'source-and-execution-records':source_dir, 'build':build_dir, 'run':run_dir}
for group, root in roots.items():
    for path in sorted(root.rglob('*')):
        if not path.is_file():
            continue
        observed_paths.add(path)
        relative = str(path.relative_to(root))
        suffix = 'artifact-inventory.json' if path == inventory_path else prefixes[group] + '/' + relative
        observed = fingerprint(path)
        entries.append({**observed, 'proposedDocsRelativeTarget':target_base+'/'+suffix, 'classification':'original-44-file-inventory' if path == inventory_path else classification(group,relative), 'inOriginal44Inventory':path in baseline, 'inclusionReason':'Preserve original inventory self-excluded from its own list.' if path == inventory_path else 'Preserve all original44 inventory entries byte for byte.' if path in baseline else 'Preserve result/review/receipt added after the original inventory; never discard a late file.'})
assert set(baseline).issubset(observed_paths)

outline = Path(recipe['originalOutline'])
outline_info = fingerprint(outline)
assert outline_info['sha256'] == recipe['originalOutlineSha256']
entries.append({**outline_info, 'proposedDocsRelativeTarget':target_base+'/preparation/id53-public-command-probe-outline.json', 'classification':'historical-outline-input', 'inOriginal44Inventory':False, 'inclusionReason':'Original outline is an untracked external input referenced by the executed recipe. Retain one copy with its existing historical metadata and hash.'})
for source, suffix in args.include:
    suffix_path = PurePosixPath(suffix)
    assert not suffix_path.is_absolute() and '..' not in suffix_path.parts
    entries.append({**fingerprint(Path(source).resolve()), 'proposedDocsRelativeTarget':target_base+'/'+str(suffix_path), 'classification':'late-final-review-or-receipt', 'inOriginal44Inventory':False, 'inclusionReason':'Explicit later final review/receipt supplied by root; retain unchanged.'})
entries.sort(key=lambda entry:entry['proposedDocsRelativeTarget'])
assert len({entry['sourcePath'] for entry in entries}) == len(entries), 'Duplicate source inclusion'
assert len({entry['proposedDocsRelativeTarget'] for entry in entries}) == len(entries), 'Proposed target collision'
for entry in entries:
    target = repository / entry['proposedDocsRelativeTarget']
    entry['proposedTargetExistsAtPlanTime'] = target.exists()
    entry['existingTargetHasSameBytes'] = fingerprint(target)['sha256'] == entry['sha256'] if target.is_file() else None

excluded = []
old_preparation = Path('/tmp/orcs-id53-opening-probe-453c221-cCI7Ch')
for path in sorted(old_preparation.iterdir()):
    if path.is_file():
        excluded.append({**fingerprint(path), 'category':'historical-held-preparation', 'reason':'Superseded held pseudocode/recipe/preparation, not executed by this probe and outside original44 corpus. Leave originals in place; no deletion or relabeling.'})
existing_outline = repository / 'docs/evidence/ai-original-coverage-20261001/id53-public-command-probe-outline.json'
existing_outline_info = fingerprint(existing_outline)
assert existing_outline_info['sha256'] == outline_info['sha256']
excluded.append({**existing_outline_info, 'category':'already-retained-duplicate-outline', 'reason':'Byte-identical to the included owner outline. Existing historical repository copy stays unchanged; the plan copies one owner original into the new packet.', 'alreadyRetainedDocsRelativeTarget':'docs/evidence/ai-original-coverage-20261001/id53-public-command-probe-outline.json'})
for entry in manifest['product']['files']:
    path = owner / entry['path']
    observed = fingerprint(path)
    assert observed['sha256'] == entry['sha256'] and observed['bytes'] == entry['bytes']
    excluded.append({**observed, 'category':'product-source-or-config-already-in-git', 'reason':'Already retained in the repository Git tree at the frozen product pin. Do not duplicate170 product files inside evidence. Exact Git blob/source hashes remain in the included build manifest and runtime receipts.', 'productPin':pin, 'repositoryRelativePath':entry['path'], 'gitBlob':entry['gitBlob']})
for entry in preflight['dependencies']:
    observed = fingerprint(Path(entry['path']))
    excluded.append({**observed, 'category':'installed-toolchain-original', 'reason':'Installed Node/esbuild files are execution-environment originals, not project evidence to vendor. Preserve their recorded execution fingerprints in included preflight/authentication records.', 'recordedExecutionBytes':entry['bytes'], 'recordedExecutionSha256':entry['sha256'], 'currentBytesMatchExecutionRecord':observed['bytes']==entry['bytes'] and observed['sha256']==entry['sha256']})

included_sources = {entry['sourcePath'] for entry in entries}
critical_references = []
for kind, bundle in manifest['bundles'].items():
    critical_references.extend([bundle['path'],bundle['metafile']['path']])
critical_references.append(str(build_dir/'build-manifest.json'))
for name in ('infantry-control','depot-first-pressure'):
    receipt_path=run_dir/name/'endpoint-verification.json'
    receipt=json.loads(receipt_path.read_text())
    critical_references.append(str(receipt_path))
    critical_references.extend(item['path'] for item in receipt['verified'])
assert len(set(critical_references)) == 11
assert set(critical_references).issubset(included_sources)

result = {'status':'prepared-external-import-plan-no-copy', 'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'productPin':pin, 'proposedDocsBase':target_base, 'copyOwner':'root only', 'sourceDirectories':{group:str(root) for group,root in roots.items()}, 'originalInventory':{**fingerprint(inventory_path), 'listedFileCount':44}, 'importFileCount':len(entries), 'importBytes':sum(entry['bytes'] for entry in entries), 'all44InventoryFilesIncludedAndRehashed':True, 'additionalPostInventorySourceBuildRunFiles':[entry for entry in entries if entry['sourcePath'] in {str(path) for path in observed_paths-set(baseline)}], 'criticalNativeBuildReferenceCount':11, 'allCriticalNativeBuildReferencesIncluded':True, 'entries':entries, 'excludedFileCount':len(excluded), 'excludedFiles':excluded, 'excludedHistoricalPackets':[{'path':str(outline.parent), 'reason':'Retain the one referenced outline only. The rest of the historical c86 packet is outside the executed corpus and is not needed for this import; existing external originals remain in place.'}], 'preservedDuplicates':[{'paths':['source/recipe.json','run/executed-recipe.json'], 'reason':'Preserve both original source bytes and actual runtime-emitted recipe bytes; do not normalize JSON or merge them.'}, {'paths':['source/source-inventory.json','artifact-inventory.json'], 'reason':'Preserve the earlier source-preparation index and later executed-corpus index as separate historical records.'}, {'paths':['run/infantry-control/initial-save4.json','run/depot-first-pressure/initial-save4.json','run/*/endpoint-session.json','run/*/checkpoint-at-first-worker-attack-command-session.json'], 'reason':'Retain standalone initial saves and both complete native sessions per arm even where initial/recorder content overlaps.'}], 'copyRules':['Copy bytes and file modes unchanged; never rewrite original absolute paths, source pins, schema fields, dates or verdicts inside evidence.','If a proposed target already exists, require identical bytes; root decides any changed target. No overwrites are performed by this plan.','Original external source/build/run directories and installed toolchain remain untouched. Retained paths are archival copies, not a claim that the already executed bundles have been relocated.','Only root imports files and promotes feature status. This task has performed file/Git inspection and external plan writes only.'], 'lateReceipts':{'refreshCommand':'python '+str(plan_dir/'generate.py'), 'explicitExternalReceiptExample':'python '+str(plan_dir/'generate.py')+' --include /absolute/path/to/final-review.json reviews/final-review.json', 'rule':'Refresh before copying to capture any late source/build/run files. Add final reviews created elsewhere with explicit --include mappings; preserve baseline44 hashes.'}}
(plan_dir/'import-map.json').write_text(json.dumps(result,indent=2)+'\n')
with (plan_dir/'import-map.tsv').open('w',newline='') as handle:
    writer=csv.writer(handle,delimiter='\t')
    writer.writerow(['source_path','proposed_docs_relative_target','bytes','sha256','mode','classification','in_original_44_inventory'])
    for entry in entries:writer.writerow([entry['sourcePath'],entry['proposedDocsRelativeTarget'],entry['bytes'],entry['sha256'],entry['mode'],entry['classification'],entry['inOriginal44Inventory']])
with (plan_dir/'excluded-files.tsv').open('w',newline='') as handle:
    writer=csv.writer(handle,delimiter='\t');writer.writerow(['source_path','bytes','sha256','category','reason'])
    for entry in excluded:writer.writerow([entry['sourcePath'],entry['bytes'],entry['sha256'],entry['category'],entry['reason']])
print(json.dumps({'status':result['status'],'importFileCount':len(entries),'importBytes':result['importBytes'],'excludedFileCount':len(excluded),'manifest':str(plan_dir/'import-map.json')},indent=2))
