"""Create a reproducible source handoff without tools, secrets or private photo fixtures."""
import argparse, pathlib, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args()
target=pathlib.Path(args.output).resolve()
allowed_qa={'package-verification.json','visual-local-features.json','unit-tests.xml','lint-results.txt','revision-0.2.json'}
files=[]
for source in sorted(ROOT.rglob('*')):
    if not source.is_file():continue
    relative=source.relative_to(ROOT)
    if any(part in {'build','.gradle','node_modules','__pycache__','.git','Vendor','DerivedData'} for part in relative.parts):continue
    if 'androidTest/assets' in relative.as_posix() or source.suffix in {'.apk','.jks','.keystore','.pyc'}:continue
    if source.name in {'local.properties','.env'} or source.name.startswith('.env.'):continue
    if relative.parts[0]=='qa' and (len(relative.parts)!=2 or source.name not in allowed_qa):continue
    files.append((source,pathlib.PurePosixPath(ROOT.name)/relative))
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for source,name in files:archive.write(source,str(name))
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert not any('/photos/' in name or name.endswith('.jks') or '/node_modules/' in name for name in archive.namelist())
print(f'{target.name}: {len(files)} files, {target.stat().st_size/1048576:.1f} MiB; no private photo fixtures or credentials')
