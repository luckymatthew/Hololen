"""Build deterministic ORB locality-sensitive buckets from the offline image index.
No network, learned weights or user photos. Run after build-image-index.py.
"""
import importlib.util, pathlib, struct
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('evaluation',ROOT/'scripts/evaluate-photos.py')
evaluation=importlib.util.module_from_spec(spec);spec.loader.exec_module(evaluation)

def main():
    rows=evaluation.read_index()
    descriptors=np.concatenate([r['desc'] for r in rows])
    postings=np.concatenate([np.arange(len(r['desc']),dtype=np.uint32)|(i<<10) for i,r in enumerate(rows)])
    rng=np.random.default_rng(20260905)
    target=ROOT/'app/src/main/assets/local-index.bin'
    with target.open('wb') as f:
        f.write(b'HCLI0001'+struct.pack('>II',len(rows),8))
        for table in range(8):
            bits=rng.choice(256,16,replace=False).astype(np.uint8)
            keys=np.zeros(len(descriptors),dtype=np.uint16)
            for i,b in enumerate(bits):keys|=(((descriptors[:,int(b)//8]>>(int(b)%8))&1).astype(np.uint16)<<i)
            order=np.argsort(keys,kind='stable')
            offsets=np.concatenate(([0],np.cumsum(np.bincount(keys,minlength=65536),dtype=np.uint32)))
            f.write(bits.tobytes());f.write(struct.pack('>I',len(postings)))
            f.write(offsets.astype('>u4').tobytes());f.write(postings[order].astype('>u4').tobytes())
            print(f'Local feature table {table+1}/8: {len(postings)} descriptors',flush=True)
    print(f'Saved {target.stat().st_size/1024/1024:.1f} MiB',flush=True)

if __name__=='__main__':main()
