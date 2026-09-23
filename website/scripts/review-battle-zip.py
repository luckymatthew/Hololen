"""Read a local review ZIP without extracting arbitrary paths or uploading data."""
import argparse,json,zipfile
from pathlib import Path
ALLOWED={'match.json','ai-review.json','manifest.json','README.txt','Holo-Device-Performance.json'}
def read_archive(path):
    with zipfile.ZipFile(path) as z:
        entries=z.infolist()
        names=[i.filename for i in entries]
        if len(set(names))!=len(names) or set(names)-ALLOWED: raise ValueError('Unexpected or duplicate ZIP entry')
        if len(entries)>5 or sum(i.file_size for i in entries)>32*1024*1024: raise ValueError('Archive too large')
        if any(i.file_size>16*1024*1024 or i.file_size>max(1024*1024,200*i.compress_size) for i in entries): raise ValueError('Unsafe expanded size')
        if z.testzip() is not None: raise ValueError('ZIP checksum mismatch')
        files={i.filename:z.read(i) for i in entries}
    match=json.loads(files['match.json']) if 'match.json' in files else None
    review=json.loads(files['ai-review.json']) if 'ai-review.json' in files else None
    if review and match and review.get('matchId')!=match.get('matchId'): raise ValueError('Mismatched match IDs')
    return {'files':names,'matchId':match.get('matchId') if match else None,'decisions':len(review.get('decisions',[])) if review else None,'legacy':review is None,'matchAvailable':match is not None,'replayVerified':False}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('zip');parser.add_argument('--out');args=parser.parse_args()
    result=json.dumps(read_archive(args.zip),ensure_ascii=False,indent=2)
    if args.out:Path(args.out).write_text(result,encoding='utf-8')
    print(result)
