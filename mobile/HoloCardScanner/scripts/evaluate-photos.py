"""Visual-only regression of user-supplied photos. Photos are never included in the APK.
This host test does NOT measure ML Kit OCR or Android phone latency.
"""
import argparse, importlib.util, json, pathlib, struct, time
import cv2
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('indexer',ROOT/'scripts/build-image-index.py');indexer=importlib.util.module_from_spec(spec);spec.loader.exec_module(indexer)
cv2.setNumThreads(2)

def ordered(p):
    p=p.reshape(4,2);center=p.mean(axis=0);p=p[np.argsort(np.arctan2(p[:,1]-center[1],p[:,0]-center[0]))]
    return np.roll(p,-np.argmin(p.sum(axis=1)),axis=0)

def prepare(image):
    h,w=image.shape[:2];scale=min(1,1000/max(w,h));image=cv2.resize(image,(round(w*scale),round(h*scale)))
    gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY);edge=cv2.Canny(cv2.GaussianBlur(gray,(5,5),0),45,140)
    edge=cv2.morphologyEx(edge,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8));contours,_=cv2.findContours(edge,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    best=None;bestArea=gray.size*.16
    for c in contours:
        p=cv2.approxPolyDP(c,.025*cv2.arcLength(c,True),True);area=cv2.contourArea(p)
        if len(p)!=4 or area<bestArea or not cv2.isContourConvex(p):continue
        p=ordered(p);w=(np.linalg.norm(p[0]-p[1])+np.linalg.norm(p[2]-p[3]))/2;h=(np.linalg.norm(p[1]-p[2])+np.linalg.norm(p[3]-p[0]))/2
        sides=[np.linalg.norm(p[i]-p[(i+1)%4]) for i in range(4)]
        if 1.18<max(w,h)/min(w,h)<1.85 and max(sides[0],sides[2])/min(sides[0],sides[2])<1.3 and max(sides[1],sides[3])/min(sides[1],sides[3])<1.3:best=p;bestArea=area
    if best is not None:
        landscape=np.linalg.norm(best[0]-best[1])>np.linalg.norm(best[1]-best[2]);w,h=(1000,716) if landscape else (716,1000)
        transform=cv2.getPerspectiveTransform(best.astype(np.float32),np.float32([[0,0],[w-1,0],[w-1,h-1],[0,h-1]]));image=cv2.warpPerspective(image,transform,(w,h))
        if landscape:image=cv2.rotate(image,cv2.ROTATE_90_CLOCKWISE)
    return image,best is not None

def read_index():
    data=(ROOT/'app/src/main/assets/image-index.bin').read_bytes();assert data[:8]==b'HCIX0001';count=struct.unpack_from('>I',data,8)[0];offset=12;rows=[]
    for _ in range(count):
        text=[]
        for k in range(2):n=struct.unpack_from('>H',data,offset)[0];offset+=2;text.append(data[offset:offset+n].decode());offset+=n
        hs=struct.unpack_from('>5Q',data,offset);offset+=40;n=struct.unpack_from('>H',data,offset)[0];offset+=2
        points=np.frombuffer(data,dtype='>f4',count=n*2,offset=offset).astype(np.float32).reshape(-1,2);offset+=n*8
        desc=np.frombuffer(data,dtype=np.uint8,count=n*32,offset=offset).reshape(-1,32);offset+=n*32
        rows.append({'number':text[0],'key':text[1],'hashes':hs,'points':points,'desc':desc})
    return rows

def distance(a,b):
    q=sorted((x^y).bit_count() for x,y in zip(a[1:],b[1:]));return (a[0]^b[0]).bit_count()*.4+sum(q[:3])*.2

class LocalIndex:
    def __init__(self,rows):
        data=(ROOT/'app/src/main/assets/local-index.bin').read_bytes();assert data[:8]==b'HCLI0001'
        count,tables=struct.unpack_from('>II',data,8);assert count==len(rows);offset=16;self.tables=[];self.rows=rows
        for _ in range(tables):
            bits=np.frombuffer(data,dtype=np.uint8,count=16,offset=offset);offset+=16
            count=struct.unpack_from('>I',data,offset)[0];offset+=4
            offsets=np.frombuffer(data,dtype='>u4',count=65537,offset=offset);offset+=65537*4
            postings=np.frombuffer(data,dtype='>u4',count=count,offset=offset);offset+=count*4
            self.tables.append((bits,offsets,postings))
        self.desc=np.concatenate([r['desc'] for r in rows]);self.base=np.concatenate(([0],np.cumsum([len(r['desc']) for r in rows])))
        self.popcount=np.array([i.bit_count() for i in range(256)],dtype=np.uint8)

    def candidates(self,query):
        if query is None:return []
        keys=[]
        for bits,offsets,postings in self.tables:
            k=np.zeros(len(query),dtype=np.uint16)
            for j,b in enumerate(bits):k|=(((query[:,int(b)//8]>>(int(b)%8))&1).astype(np.uint16)<<j)
            keys.append(k)
        scores=np.zeros(len(self.rows),dtype=np.int32)
        for qi,q in enumerate(query):
            buckets=[]
            for t,(bits,offsets,postings) in enumerate(self.tables):
                key=int(keys[t][qi]);probes=[key]+[key^(1<<j) for j in range(16)]
                for k in probes:
                    start,end=offsets[k:k+2]
                    if 0<end-start<=256:buckets.append(postings[start:end])
            if not buckets:continue
            packed=np.unique(np.concatenate(buckets));ids=(packed>>10).astype(np.int32);features=(packed&1023).astype(np.int32)
            distance=self.popcount[np.bitwise_xor(self.desc[self.base[ids]+features],q)].sum(axis=1)
            best=np.full(len(self.rows),71,dtype=np.int32);np.minimum.at(best,ids,distance)
            valid=best<=68;scores[valid]+=70-best[valid]
        return [self.rows[i] for i in np.argsort(-scores,kind='stable')[:32] if scores[i]>0]

def match(image,rows):
    image,found=prepare(image);scale=755/max(image.shape[:2]);gray=cv2.resize(cv2.cvtColor(image,cv2.COLOR_BGR2GRAY),(round(image.shape[1]*scale),round(image.shape[0]*scale)));hs=indexer.hashes(gray);rev=indexer.hashes(cv2.rotate(gray,cv2.ROTATE_180))
    selected=sorted(rows,key=lambda r:min(distance(hs,r['hashes']),distance(rev,r['hashes'])))[:12]
    enhanced=cv2.createCLAHE(2,(8,8)).apply(gray);orb=cv2.ORB_create(nfeatures=650,scaleFactor=1.2,nlevels=8,edgeThreshold=15,fastThreshold=12);kp,desc=orb.detectAndCompute(enhanced,None);best={}
    if not hasattr(match,'local'):match.local=LocalIndex(rows)
    seen={r['key'] for r in selected}
    for r in match.local.candidates(desc):
        if r['key'] not in seen:selected.append(r);seen.add(r['key'])
    if desc is not None:
        bf=cv2.BFMatcher(cv2.NORM_HAMMING)
        for r in selected:
            if len(r['desc'])<8:continue
            pairs=bf.knnMatch(desc,r['desc'],k=2);good=[];used=set()
            for pair in pairs:
                if len(pair)==2 and pair[0].distance<.72*pair[1].distance and pair[0].trainIdx not in used:good.append(pair[0]);used.add(pair[0].trainIdx)
            if len(good)<8:continue
            src=np.float32([r['points'][m.trainIdx] for m in good]);dst=np.float32([kp[m.queryIdx].pt for m in good]);H,mask=cv2.findHomography(src,dst,cv2.RANSAC,3.5,maxIters=1000,confidence=.995)
            if H is None:continue
            inliers=int(mask.sum());x,y,w,h=cv2.boundingRect(src[mask.ravel()!=0]);coverage=w*h/(360*503);ratio=inliers/len(good)
            if inliers>=7 and (r['number'] not in best or best[r['number']]['inliers']<inliers):best[r['number']]={'number':r['number'],'inliers':inliers,'ratio':ratio,'coverage':coverage,'key':r['key']}
    ranked=sorted(best.values(),key=lambda r:r['inliers'],reverse=True);auto=None
    if ranked:
        b=ranked[0];next=ranked[1]['inliers'] if len(ranked)>1 else 0
        if b['inliers']>=18 and b['ratio']>=.42 and b['coverage']>=.045 and b['inliers']-next>=7:auto=b['number']
    return ranked,auto,found

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--photos',required=True);parser.add_argument('--report',required=True);args=parser.parse_args();rows=read_index();results=[]
    fixtures={'01-7340.jpg':'hBP01-060','02-7341.jpg':'hBP01-061','03-7342.jpg':'hSD01-018','04-7344.jpg':'hBP04-105','05-7345.jpg':'hEB01-019','06-7343.jpg':'hBP07-094','07-7346.jpg':'hSD01-016','08-7347.jpg':'hEB01-024','09-7348.jpg':'hBP01-104','10-7349.jpg':'hEB01-023'}
    for name,expected in fixtures.items():
        path=pathlib.Path(args.photos)/name
        if not path.exists():results.append({'photo':name,'expected':expected,'missing':True});continue
        image=cv2.imread(str(path));start=time.perf_counter();ranked,auto,found=match(image,rows)
        result={'photo':name,'expected':expected,'automatic':auto,'correctAutomatic':auto==expected,'wrongAutomatic':auto is not None and auto!=expected,'candidateCorrect':any(r['number']==expected for r in ranked[:5]),'foundCard':found,'hostVisualMilliseconds':round((time.perf_counter()-start)*1000),'candidates':ranked[:5]};results.append(result);print(json.dumps(result),flush=True)
    report={'scope':'Host OpenCV visual-only regression; no Android ML Kit OCR, no real-device performance measurement','referenceCount':len(rows),'results':results}
    pathlib.Path(args.report).parent.mkdir(parents=True,exist_ok=True);pathlib.Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
