"""Package only after real effect tests, existing regression/build and bundle parity pass."""
import hashlib,json,pathlib,re,shutil,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
REPO=ROOT.parent
RESULTS=REPO/'hbp09-results'
OUT=REPO/'hbp09-package'

def copy(source,dest):
    dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
def tap(path):
    text=path.read_text(encoding='utf-8')
    def final(name):
        values=re.findall(r'^# '+re.escape(name)+r' (\d+)\s*$',text,re.M)
        if not values:raise ValueError(f'Missing {name} in {path}')
        return int(values[-1])
    result={k:final(k) for k in ['tests','pass','fail','skipped','cancelled']}
    if result['fail'] or result['cancelled'] or result['skipped'] or result['pass']!=result['tests']:raise ValueError('Cannot package failing or incomplete tests')
    return result

def main():
    actual=tap(RESULTS/'executable-tests.txt');regression=tap(RESULTS/'full-regression.txt')
    parity=json.loads((RESULTS/'native-parity.json').read_text())
    if parity['passed']!=5 or not all(r['equal'] for r in parity['scenarios']):raise ValueError('Native reference parity failed')
    if not (ROOT/'dist-firebase/index.html').is_file():raise ValueError('Production build missing')
    repeat=json.loads((RESULTS/'integration-repeat.json').read_text())
    if not repeat.get('alreadyApplied'):raise ValueError('Installer repeat check failed')
    if OUT.exists():shutil.rmtree(OUT)
    source=OUT/'source/website';reference=OUT/'reference/website'
    modules=ROOT/'lib/simulator/hbp09'
    for file in modules.iterdir():
        if file.suffix in ['.mjs','.txt']:copy(file,source/'lib/simulator/hbp09'/file.name)
    for name in ['apply-hbp09-effects.py','hbp09-test-contracts.py']:
        copy(ROOT/'scripts'/name,source/'scripts'/name)
    for name in ['hbp09-executable.test.mjs','hbp09-extra-cases.mjs','hbp09-native-parity.mjs']:
        copy(ROOT/'tests'/name,source/'tests'/name);copy(ROOT/'tests'/name,reference/'tests'/name)
    for name in ['engine.mjs','dice-actions.mjs','effect-catalog.mjs','oshi-skill-catalog.mjs']:
        copy(ROOT/'lib/simulator'/name,reference/'lib/simulator'/name)
    shutil.copytree(modules,reference/'lib/simulator/hbp09')
    copy(ROOT/'public/cards.json',reference/'public/cards.json')
    copy(ROOT/'public/hbp09-cards.json',OUT/'source-evidence/hbp09-cards.json')
    copy(ROOT/'docs/hbp09-effects/cards.md',OUT/'source-evidence/official-card-texts.md')
    shutil.copytree(RESULTS,OUT/'verification')
    copy(RESULTS/'native-reference/hbp09-rules.iife.js',OUT/'reference/native-reference/hbp09-rules.iife.js')
    diff=subprocess.check_output(['git','diff','--','website/lib/simulator/engine.mjs','website/lib/simulator/oshi-skill-catalog.mjs','website/lib/simulator/effect-catalog.mjs','website/tests/oshi-skill-regression.test.mjs','website/tests/simulator-effect-catalog.test.mjs'],cwd=REPO)
    (OUT/'integration-review.patch').write_bytes(diff)
    # The reference is a complete runnable reducer fixture, not merely source snippets.
    result=subprocess.run(['node','--test','tests/hbp09-executable.test.mjs'],cwd=reference,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    (OUT/'verification/packaged-reference-tests.txt').write_bytes(result.stdout)
    if result.returncode:raise ValueError('Packaged reference failed: '+result.stdout.decode(errors='replace')[-4000:])
    packaged=tap(OUT/'verification/packaged-reference-tests.txt')
    report={'version':'hbp09-executable-20260918.1','testedSourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),'originalEngine':json.loads((RESULTS/'integration.json').read_text())['originalEngineSha256'],'hbp09ScenarioTests':actual,'fullRegression':regression,'packagedReferenceTests':packaged,'typeScriptCheck':True,'productionBuild':True,'nativeBundleParityScenarios':parity['passed'],'apkBuilt':False,'deployed':False,'realDeviceTested':False,'allCrossSetRuleInteractionsAudited':False}
    (OUT/'verification-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    readme='''# Hololens hBP09 — executable effect source

This package contains actual effect handlers and a tested integration with the existing Hololens reducer. It is NOT a card-database-only update, an implementation wish list, a released APK, or a claim that every cross-set interaction has been exhaustively certified.

## Contents

- `source/website/lib/simulator/hbp09/runtime.mjs`: serializable effect continuations, validated card/zone/option choices, payments, card moves, damage, healing, draws and attachments.
- `programs.mjs`: explicit per-card Bloom, Collab, Arts, Oshi and support programs. No rule execution depends on Chinese display text.
- `hooks.mjs`: passive costs, bonuses, damage/Down/Baton/attachment events, variable X payment, Towa extra Arts/end window and Makeup extra Bloom.
- `engine-bridge.txt`: actual adapter code inserted into the current engine by the installer.
- `source/website/scripts/apply-hbp09-effects.py`: dry-run by default; exact source-anchor checks, backups, refusal on source drift, and repeat-safe installation.
- `reference/website`: a complete executable reducer fixture, including the official card data used for the tests. It is a test reference, NOT a replacement for the latest production project.
- `reference/native-reference/hbp09-rules.iife.js`: the same integrated reference reducer bundled with global `HololensHbp09Rules`. Five state-transition parity scenarios were compared with the ESM reducer. This is not proof of Android UI or device compatibility.
- `integration-review.patch`: reviewable exact changes to the tested engine and registries; use for code review/manual merge if source anchors drift. Do not apply both this patch and the Python installer.
- `verification-summary.json` and `verification/`: actual test/build reports. The old 155 Oshi cost distribution and 112 previous support-card assertions remain in the regression suite; only obsolete hBP09 database-only expectations are updated.

## Apply to the existing Codex project

1. Keep the CURRENT website and Android source, including latest AI/battle-report work. Back up the working tree.
2. Copy the package's `source/website/lib/simulator/hbp09/` directory and the listed scripts/tests into the corresponding current website project. These are new extension files, not an old whole-app snapshot.
3. From the website folder, run:

```sh
python scripts/apply-hbp09-effects.py
python scripts/apply-hbp09-effects.py --apply
node --test tests/hbp09-executable.test.mjs
npm test
```

A different target can be provided using `--website PATH_TO_WEBSITE`. All source anchors must match. A refusal is intentional: inspect `integration-review.patch` and merge those specific changes into the newer reducer; do not replace the current engine with an older reference just to make the installer pass.

The patch changes the reducer and live activation registries, not just simulationStatus or a UI flag. Pending choices reuse existing cardSelection, stageTarget and optionChoice interfaces. Holo Power X uses explicit legal amount options. Search choices, payments, once-per-turn limits and card-instance identity are checked by the reducer.

## Android integration

Port/merge the SAME reducer changes into the native app's current rule-engine source, then rebuild its existing native JavaScript bundle with its existing global/API contract. Merely copying JSON or source .mjs files into assets will NOT activate effects in a prebuilt `assets/native/engine.js`.

Do not blindly overwrite that file with the reference IIFE: the current app may expose a different global, wrapper API or newer AI functions. Preserve those exports and the current Android UI/choice bridge. Use the reference bundle for differential tests, then rebuild the current project and sign using its original signing process. No signing key, password, save file or authentication configuration is included or modified here.

The previous translation supplement remains separate; keep its source-preserving display integration. This package executes using stable card numbers and original rules, not translated strings.

## Run the self-contained reference tests

```sh
cd reference/website
node --test tests/hbp09-executable.test.mjs
```

Node 22 was used in CI. No npm dependency installation is needed for this reference test command.

## Verification boundaries

The verification summary records passing executable state-transition tests, the complete existing website regression suite, TypeScript checking, a production build and five reference-bundle parity scenarios. These are meaningful execution tests, but not an exhaustive proof of every permutation of the 111 new cards.

Before production release, the current Codex project must verify browser/PvP and native-device choice UIs, latest AI continuations, original signing compatibility, and preservation of existing saves. Cross-set replacement effects (especially substituting a Holomen ability's hand-archive cost), simultaneous multi-hit/Down reaction ordering, and arbitrary simultaneous end-of-performance trigger order require additional rules review. Those paths must not be described as fully audited merely because a registry entry exists. The stored Japanese snapshot must also be compared with any later official errata.

No website was deployed and no new APK was built by producing this source package.
'''
    (OUT/'README.md').write_text(readme,encoding='utf-8')
    (OUT/'給-Codex.txt').write_text('請將本包的可執行 hBP09 runtime/programs/hooks 與 engine bridge 合併入你目前已部署的專案。先閱讀 README.md 及 verification-summary.json。不要只修改卡庫或 automated 標籤。使用安全 installer；來源不符時按 integration-review.patch 合併，保留目前 AI、戰報、登入、牌組同步、存檔及原有簽署。Android 必須重新建置現有原生規則 bundle 並保留原來 API/global，不能只複製 JSON，亦不可用舊 reference engine 覆蓋新功能。執行本包及完整專案測試、原生選擇 UI 測試，補查 README 列出的跨系列替代與同時觸發情況，再沿你現有流程建置/發布。請使用已提供的實際效果程式，不要重新交一份只含計劃的清單。\n',encoding='utf-8')
    manifest={str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.rglob('*')) if p.is_file()}
    (OUT/'SHA256.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
