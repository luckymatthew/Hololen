"""Build offline reference features from public card artwork, not users' photos.
Run: python scripts/build-image-index.py --cache ../card-reference-cache
Dependencies: opencv-python-headless, numpy. Network uses the configured proxy.
"""
import argparse, concurrent.futures, hashlib, json, pathlib, struct, time, urllib.request
import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'app/src/main/assets'

def hashes(gray):
    h,w=gray.shape
    regions=[gray,gray[:h//2,:w//2],gray[:h//2,w//2:],gray[h//2:,:w//2],gray[h//2:,w//2:]]
    result=[]
    for region in regions:
        small=cv2.resize(region,(32,32),interpolation=cv2.INTER_AREA).astype(np.float32)
        coeff=cv2.dct(small)[:8,:8].flatten()
        median=np.median(coeff[1:])
        result.append(sum(1<<i for i,v in enumerate(coeff) if v>median))
    return result

def features(image):
    image=cv2.resize(image,(360,503),interpolation=cv2.INTER_AREA)
    gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    enhanced=cv2.createCLAHE(2.0,(8,8)).apply(gray)
    orb=cv2.ORB_create(nfeatures=360,scaleFactor=1.2,nlevels=8,edgeThreshold=15,fastThreshold=12)
    kp,des=orb.detectAndCompute(enhanced,None)
    return image,hashes(gray),kp,des

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--cache',required=True);parser.add_argument('--workers',type=int,default=8);parser.add_argument('--offline',action='store_true')
    args=parser.parse_args();cache=pathlib.Path(args.cache);cache.mkdir(parents=True,exist_ok=True)
    thumbs=ASSETS/'card-art';thumbs.mkdir(parents=True,exist_ok=True)
    cards=json.loads((ASSETS/'cards.json').read_text())['cards'];rows=[];seen=set()
    for card in cards:
        for v in card.get('variants') or [{'image':card.get('image')}]:
            url=v.get('image','')
            if not url.startswith('https://hololive-official-cardgame.com/') or url in seen:continue
            seen.add(url);rows.append((card['number'],url))
    # Keep foil/reference cards from the supplied examples early for diagnostics.
    rows.sort(key=lambda row:(not any(n in row[0] for n in ('hBP01-060','hBP01-061','hEB01-019','hEB01-020','hEB01-024','hSD01-018','hBP01-104')),row[0],row[1]))
    def fetch(row):
        number,url=row;key=hashlib.sha256(url.encode()).hexdigest()[:20];dest=cache/(key+'.png')
        try:
            if not dest.exists():
                if args.offline:raise FileNotFoundError('not cached')
                request=urllib.request.Request(url,headers={'User-Agent':'HoloCardScanner/0.1 personal offline card reader'})
                with urllib.request.urlopen(request,timeout=45) as response:raw=response.read(5_000_001)
                if len(raw)>5_000_000:raise ValueError('image too large')
                dest.write_bytes(raw)
            img=cv2.imdecode(np.frombuffer(dest.read_bytes(),np.uint8),cv2.IMREAD_COLOR)
            if img is None:raise ValueError('invalid image')
            img,hs,kp,des=features(img)
            cv2.imwrite(str(thumbs/(key+'.webp')),cv2.resize(img,(240,335)),[cv2.IMWRITE_WEBP_QUALITY,78])
            # Big-endian stream for Java ByteBuffer. Strings use ASCII lengths.
            record=b''
            for s in (number,key):
                b=s.encode('ascii');record+=struct.pack('>H',len(b))+b
            record+=struct.pack('>5QH',*hs,len(kp))
            for k in kp:record+=struct.pack('>ff',k.pt[0],k.pt[1])
            if des is not None:record+=des.tobytes()
            return url,key,record,None
        except Exception as e:return url,key,None,str(e)
    records=[];mapping={};errors=[];start=time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for i,(url,key,record,error) in enumerate(pool.map(fetch,rows),1):
            if error:errors.append({'url':url,'error':error})
            else:records.append(record);mapping[url]='/card-art/'+key+'.webp'
            if i%100==0 or i==len(rows):print(f'{i}/{len(rows)} references; failed={len(errors)}; elapsed={time.monotonic()-start:.0f}s',flush=True)
    (ASSETS/'image-index.bin').write_bytes(b'HCIX0001'+struct.pack('>I',len(records))+b''.join(records))
    (ASSETS/'art-map.json').write_text(json.dumps(mapping,separators=(',',':')))
    (ASSETS/'image-index-report.json').write_text(json.dumps({'referenceCount':len(records),'requested':len(rows),'errors':errors},indent=2))
    print('Image index complete',len(records),'references',flush=True)
if __name__=='__main__':main()
