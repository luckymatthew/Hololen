"""Merge hBP09 JSON and artwork into a current native source, never its code.
Default is dry-run; --apply writes atomically with a backup and rollback.
"""
import argparse,hashlib,importlib.util,json,os,pathlib,shutil,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('hbp09_merge',ROOT/'merge-hbp09.py')
merge_module=importlib.util.module_from_spec(spec);spec.loader.exec_module(merge_module)
CATALOGS=('cards.json','app/offline-cards.json','native/firebase-cards.json')
def encoded(value):return json.dumps(value,ensure_ascii=False,separators=(',',':')).encode('utf-8')
def build_updates(assets,public,manifest):
    delta=merge_module.load(public/'hbp09-cards.json');japanese=merge_module.load(public/'hbp09-scanner-ja.json')
    if len(delta['cards'])!=131 or sum(len(c['variants']) for c in delta['cards'])!=255:raise ValueError('Incomplete release delta')
    if len(manifest)!=255:raise ValueError('Incomplete artwork manifest')
    mapping=merge_module.load(assets/'art-map.json')
    art={image['url']:image['path'] for image in manifest}
    originals={rel:merge_module.load(assets/rel) for rel in CATALOGS}
    offline_by_number={c['number']:c for c in originals['app/offline-cards.json']['cards']}
    aliases=dict(art)
    # The old offline catalog and art-map do not necessarily use the same URL
    # spelling. Pair variants by their stable IDs to recover their EXACT image
    # value, including legacy aliases, before de-duplicating reprinted images.
    for remote in originals['cards.json']['cards']:
        local=offline_by_number.get(remote['number'],{})
        local_variants={v['id']:v for v in local.get('variants',[])}
        for variant in remote.get('variants',[]):
            counterpart=local_variants.get(variant['id'])
            if variant['image'] in aliases and counterpart:
                aliases[variant['image']]=counterpart['image']
    release_by_number={c['number']:c for c in delta['cards']}
    def merge_one(before,offline):
        after,stats=merge_module.merge(before,delta,aliases if offline else None)
        if offline:
            before_numbers={c['number'] for c in before['cards']}
            for card in after['cards']:
                incoming=release_by_number.get(card['number'])
                if incoming and (card['number'].startswith('hBP09-') or card['number'] not in before_numbers or card.get('catalogVersion')==merge_module.VERSION):
                    card['image']=art[incoming['image']]
        return after,stats
    updates={};report={}
    for rel,before in originals.items():
        after,stats=merge_one(before,rel=='app/offline-cards.json')
        repeated,_=merge_one(after,rel=='app/offline-cards.json')
        if repeated!=after:raise ValueError('Non-idempotent data update')
        before_cards={c['number']:c for c in before['cards']};after_cards={c['number']:c for c in after['cards']}
        for n,old in before_cards.items():
            new=after_cards[n]
            if old['id']!=new['id']:raise ValueError(f'Card identity changed: {n}')
            if not {v['id'] for v in old.get('variants',[])}<={v['id'] for v in new.get('variants',[])}:raise ValueError(f'Printing identity lost: {n}')
            if n not in release_by_number and old!=new:raise ValueError(f'Unrelated card modified: {n}')
        updates[rel]=encoded(after);report[rel]=stats
    # Store new URLs separately from the compatibility aliases used only for
    # de-duplication; never insert a remote-URL-to-itself mapping.
    mapping.update(art);updates['art-map.json']=encoded(mapping)
    scanner=merge_module.load(assets/'scanner-ja.json')
    for n,row in japanese.items():
        old=scanner['cards'].get(n,{})
        scanner['cards'][n]={**old,**{k:list(dict.fromkeys(old.get(k,[])+row[k])) for k in ['titles','effects']}}
    scanner.setdefault('meta',{})['hbp09CatalogVersion']=merge_module.VERSION;updates['scanner-ja.json']=encoded(scanner)
    for image in manifest:
        rel=image['path'].lstrip('/');parts=pathlib.PurePosixPath(rel).parts
        if not parts or parts[0]!='card-art' or '..' in parts:raise ValueError('Invalid artwork path')
        data=(public/rel).read_bytes()
        if hashlib.sha256(data).hexdigest()!=image['sha256']:raise ValueError(f'Artwork checksum mismatch: {rel}')
        updates[rel]=data
    return updates,report

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--assets',type=pathlib.Path,required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    assets=args.assets.resolve()
    if not assets.is_dir():parser.error('--assets must be an existing app/src/main/assets directory')
    updates,report=build_updates(assets,ROOT.parent/'public',merge_module.load(ROOT/'hbp09-art-manifest.json'))
    changed={rel:data for rel,data in updates.items() if not (assets/rel).exists() or (assets/rel).read_bytes()!=data}
    output={'catalogVersion':merge_module.VERSION,'dryRun':not args.apply,'changedFiles':len(changed),'databases':report,'executableFilesTouched':0}
    if args.apply and changed:
        backup=assets.parent/('hbp09-catalog-backup-'+time.strftime('%Y%m%d-%H%M%S'));backup.mkdir(exist_ok=False)
        for rel in changed:
            source=assets/rel
            if source.exists():
                target=backup/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
        written=[]
        try:
            for rel,data in changed.items():
                target=assets/rel;target.parent.mkdir(parents=True,exist_ok=True)
                with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as handle:
                    handle.write(data);temporary=pathlib.Path(handle.name)
                os.replace(temporary,target);written.append(rel)
        except Exception:
            for rel in written:
                previous=backup/rel;target=assets/rel
                if previous.exists():shutil.copy2(previous,target)
                else:target.unlink(missing_ok=True)
            raise
        output['backup']=str(backup)
    print(json.dumps(output,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
