#!/usr/bin/env python3
"""Record only the explicitly scoped redesign over the reviewed card/footer checkpoint."""
import argparse, difflib, hashlib, json, subprocess
from pathlib import Path
BASELINE = '211da7e605978c815dda47f4bf75b3e7c02f3408'
CHANGED = ['app/CardScanner.tsx', 'app/ConfirmDialog.tsx', 'app/WebsiteUpdateLog.tsx', 'app/account/FirebaseAccount.tsx', 'app/download/DownloadClient.tsx', 'app/layout.tsx', 'app/page.tsx', 'app/simulator/SimulatorClient.tsx', 'firebase/main.tsx']
ADDED = ['app/StudioHeader.tsx', 'app/design-system.css', 'app/motion.css', 'app/ui-motion.tsx']
parser = argparse.ArgumentParser(); parser.add_argument('--baseline', required=True); args = parser.parse_args()
if args.baseline != BASELINE: raise SystemExit('Use the exact reviewed integrated card/footer checkpoint, never an inferred baseline.')
root = Path(__file__).resolve().parents[1]
def sha(value): return hashlib.sha256(value.encode()).hexdigest()
changes=[]
for name in CHANGED:
    before = subprocess.check_output(['git', 'show', f'{BASELINE}:website/{name}'], cwd=root).decode()
    after = (root/name).read_text()
    if before == after: raise SystemExit(f'Expected deliberate UI change not present: {name}')
    old, new = before.splitlines(keepends=True), after.splitlines(keepends=True)
    groups=list(difflib.SequenceMatcher(None, old, new, autojunk=False).get_grouped_opcodes(4))
    patches=[]
    for group in groups:
        patch={'before': ''.join(old[group[0][1]:group[-1][2]]), 'after': ''.join(new[group[0][3]:group[-1][4]])}
        if not patch['before'] or not patch['after'] or before.count(patch['before'])!=1 or after.count(patch['after'])!=1:
            patches=[{'before':before,'after':after}]; break
        patches.append(patch)
    restored=after
    for patch in reversed(patches):
        if restored.count(patch['after'])!=1: raise SystemExit(f'Ambiguous restoration: {name}')
        restored=restored.replace(patch['after'],patch['before'])
    if restored!=before: raise SystemExit(f'Restoration mismatch: {name}')
    changes.append({'path':f'website/{name}', 'beforeSha256':sha(before), 'afterSha256':sha(after), 'patches':patches})
fixture={'schemaVersion':1,'baselineSourceCommit':BASELINE,'baselineTree':'43dbfac0ac2c682364996207a746cc1dce3cd313','scope':'Presentation, accessible state/motion and shared navigation only; no card data, engine, auth, storage or download endpoint edits.','changes':changes,'addedPaths':[f'website/{name}' for name in ADDED],'addedSha256':{f'website/{name}':sha((root/name).read_text()) for name in ADDED}}
(root/'tests/fixtures/ui-redesign-2026-10-29-runtime-changes.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n')
print(f'Recorded {len(changes)} explicitly reversible source changes and {len(ADDED)} added runtime files.')
