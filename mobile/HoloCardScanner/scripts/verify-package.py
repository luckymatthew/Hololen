"""Verify installable preview packaging; this is not a real-phone test."""
import argparse, hashlib, json, pathlib, re, subprocess, zipfile
p=argparse.ArgumentParser();p.add_argument('--sdk',required=True);p.add_argument('--apk',required=True);p.add_argument('--report',required=True);args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];apk=pathlib.Path(args.apk);build=pathlib.Path(args.sdk)/'build-tools/35.0.0'
def run(*cmd):return subprocess.run(cmd,capture_output=True,text=True,check=True).stdout
signature=run(str(build/'apksigner'),'verify','--verbose',str(apk))
run(str(build/'zipalign'),'-c','-P','16','4',str(apk))
manifest=run(str(build/'aapt'),'dump','badging',str(apk))
assert "targetSdkVersion:'36'" in manifest
with zipfile.ZipFile(apk) as z:
    names=z.namelist()
    assert not any('/photos/' in n or n.endswith('.jks') or 'simulator' in n.lower() for n in names)
    for asset in ('cards.json','scanner-ja.json','image-index.bin','local-index.bin','holosim-card-index.json','app/index.html','app/app.js'):assert 'assets/'+asset in names
    cards=json.loads(z.read('assets/cards.json'));images=json.loads(z.read('assets/art-map.json'))
    native=[n for n in names if n.startswith('lib/') and n.endswith('.so')]
    assert native and all('/arm64-v8a/' in n for n in native)
    assert any('japanese' in n.lower() for n in names),'Japanese recognition assets missing'
alignments={}
for name in native:
    lib=root/'app/build/intermediates/merged_native_libs/debug/mergeDebugNativeLibs/out'/name
    headers=run('readelf','-lW',str(lib))
    values=[int(line.split()[-1],16) for line in headers.splitlines() if line.strip().startswith('LOAD ')]
    assert values and min(values)>=16384,(name,values)
    alignments[name]=values
digest=hashlib.sha256(apk.read_bytes()).hexdigest()
report={'apk':apk.name,'sha256':digest,'bytes':apk.stat().st_size,'targetSdk':36,'minimumSdk':35,'abi':'arm64-v8a','signatureVerified':True,'signing':'Debug-signed preview, not production release','zipAligned16KiB':True,'nativeLoadSegmentAlignment':alignments,'bundledCards':len(cards['cards']),'bundledImageReferences':len(images),'cardsWithOfflineArtwork':sum(any(v['image'] in images for v in c.get('variants',[])) for c in cards['cards']),'snapshot':cards['meta']['snapshotDate'],'privatePhotosInApk':False,'deviceTest':'Not established by this packaging check'}
pathlib.Path(args.report).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
