from hashlib import sha256
from pathlib import Path
import json

root = Path('/home/morgana/.codex/worktrees/final-combat-proof/orcs-vs-Fairies')
rel = {
  'native': 'scripts/acceptance/native-audit.ts',
  'direction': 'scripts/acceptance/audit-direction-defense.ts',
  'capture': 'scripts/acceptance/capture-ambush-native-checks.ts',
  'downloads': 'scripts/acceptance/native-downloads.ts',
  'history': 'scripts/acceptance/verify-native-history.mjs',
}
text = {name: (root / path).read_text() for name, path in rel.items()}
checks = {
  'top_level_uses_authenticated_reader': 'readAuthenticatedDownload(evidenceDir, name, receipt.downloads)' in text['native'],
  'top_level_plain_resolve_removed': 'readFileSync(resolve(evidenceDir, name))' not in text['native'],
  'direction_reads_authenticated_exports': 'readAuthenticatedDownload(evidenceDir, item.file, downloads)' in text['direction'],
  'direction_requires_47_exports': 'expectedExportNames.length, 47' in text['direction'],
  'direction_requires_24_continuations': 'expectedContinuations.length, 24' in text['direction'],
  'direction_old_order_selection_removed': 'receipt.exports.filter' not in text['direction'],
  'capture_reads_authenticated_saves': 'readAuthenticatedDownload(out, filename, downloads)' in text['capture'],
  'capture_requires_15_saves': 'retained.length, expectedFiles.length' in text['capture'] and 'all fifteen required native saves' in text['capture'],
  'shared_reader_rejects_paths': 'basename(filename), filename' in text['downloads'] and 'path.startsWith' in text['downloads'],
  'shared_reader_rejects_symlinks': '!status.isSymbolicLink()' in text['downloads'],
  'shared_reader_checks_bytes_and_hash': 'bytes.length, fingerprint.bytes' in text['downloads'] and 'fingerprint.sha256' in text['downloads'],
  'history_requires_freeze_argument': 'FULL_SOURCE_COMMIT FROZEN_INPUTS' in text['history'],
  'history_checks_original_freeze_digest': 'receipt.source.sealedContractSha256,digest(freezeBytes)' in text['history'],
  'history_rechecks_freeze_after_audit': text['history'].count('assertAcceptanceFreeze') == 3,
}
assert all(checks.values()), checks
print(json.dumps({
  'commit': '4a13ca78b48fe476ce8fa5132dcc96efa006b975',
  'checks': checks,
  'sourceSha256': {name: sha256((root / path).read_bytes()).hexdigest() for name, path in rel.items()},
  'result': 'binding and path-containment correction present at every audited read site',
}, indent=2))
