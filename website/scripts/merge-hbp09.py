"""Merge the complete, pinned official hBP09 set without replacing unrelated cards.
Requires beautifulsoup4 only for source conversion. No downloaded code is executed.
"""
import argparse, copy, hashlib, json, pathlib, re
from collections import Counter, defaultdict
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent
SET = 'hBP09 ボリュームヴォルテックス / Volume Vortex'
DATE = '2026-09-19'
VERSION = '2026-09-17-hBP09'
COLORS = {'white':'白','green':'綠','red':'紅','blue':'藍','purple':'紫','yellow':'黃','null':'無色'}
TYPES = {
 '推しホロメン': ('oshi','oshiCharacter','推し Holomen'),
 'ホロメン': ('holomem','character','Holomen'),
 'Buzzホロメン': ('holomem','buzzCharacter','Buzz Holomen'),
 'エール': ('cheer','supportCheer','應援'),
 'サポート・イベント': ('support','supportEvent','事件'),
 'サポート・イベント・LIMITED': ('support','supportEventLimited','事件・LIMITED'),
 'サポート・アイテム': ('support','supportItem','道具'),
 'サポート・アイテム・LIMITED': ('support','supportItemLimited','道具・LIMITED'),
 'サポート・ツール': ('support','supportTool','工具'),
 'サポート・ファン': ('support','supportFan','粉絲'),
 'サポート・マスコット': ('support','supportMascot','吉祥物'),
}

def load(path): return json.loads(pathlib.Path(path).read_text(encoding='utf-8'))
def dump(path, value):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
def clean(text): return re.sub(r'[\t\r ]+', ' ', text).strip()
def number(value):
    match = re.fullmatch(r'\s*(\d+)\s*', str(value))
    return int(match[1]) if match else None

def fields(row):
    result = {'arts': [], 'extra': '', 'keyword': None, 'stageSkill': None, 'oshiSkill': None, 'spOshiSkill': None}
    for field in row['fields']:
        soup = BeautifulSoup(field['html'], 'html.parser')
        div = soup.find('div'); paragraphs = div.find_all('p', recursive=False)
        if len(paragraphs) != 2: raise ValueError(f'Unexpected field format: {row["number"]}')
        body = paragraphs[1]; heading = body.find('span', recursive=False)
        classes = field['class'].split()
        if 'extra' in classes:
            result['extra'] = clean(body.get_text()); continue
        if heading is None: raise ValueError(f'Missing field heading: {row["number"]} {classes}')
        icons = [dict(img.attrs) for img in heading.find_all('img')]
        special = heading.select_one('.tokkou')
        special_icons = [dict(img.attrs) for img in special.find_all('img')] if special else []
        if special: special.extract()
        title = clean(heading.get_text()); heading.extract()
        effect = clean(body.get_text())
        power = re.search(r'\[ホロパワー:\s*[-−]([0-9]+|X)\]', effect)
        if power: effect = effect.replace(power[0], '').strip()
        if 'arts' in classes:
            match = re.fullmatch(r'(.*?)\s*(\d+)([+±\-−]*)', title)
            if not match: raise ValueError(f'Unparsed arts damage: {row["number"]} {title!r}')
            costs = []
            for icon in icons:
                m = re.search(r'/arts_([a-z]+)\.png', icon.get('src',''))
                if m:
                    if m[1] not in COLORS: raise ValueError(f'Unknown cost: {m[1]}')
                    costs.append(COLORS[m[1]])
            targets = []; values = []
            for icon in special_icons:
                m = re.search(r'/tokkou_(\d+)_([a-z]+)\.png', icon.get('src',''))
                if not m: raise ValueError(f'Unknown special damage: {icon}')
                targets.append(COLORS[m[2]]); values.append(int(m[1]))
            result['arts'].append({'name':match[1].strip(),'effect':effect,'damage':int(match[2]),'damageModifier':match[3],'cost':costs,'specialTargets':targets,'specialValues':values})
        elif 'keyword' in classes:
            keyword = next((re.search(r'/(gift|bloom|collab)\.png', i.get('src','')) for i in icons if re.search(r'/(gift|bloom|collab)\.png', i.get('src',''))), None)
            if not keyword: raise ValueError(f'Unknown keyword icon: {row["number"]} {icons}')
            result['keyword'] = {'type':keyword[1], 'name':title, 'effect':effect}
        elif 'skill' in classes:
            key = 'stageSkill' if 'stage' in classes else 'spOshiSkill' if 'sp' in classes else 'oshiSkill'
            skill = {'name':title,'effect':effect,'timing':''}
            if key != 'stageSkill':
                if not power: raise ValueError(f'Missing Holo Power: {row["number"]} {key}')
                cost = int(power[1]) if power[1].isdigit() else power[1]
                skill.update({'holoPower':cost,'holoPowerCost':cost,'timing':f'Holo Power -{cost}'})
            result[key] = skill
        else: raise ValueError(f'Unrecognized field: {classes}')
    return result

def build_release(source, names, existing):
    rows = source['printings']; grouped = defaultdict(list)
    if len(rows) != 255 or len({r['image'] for r in rows}) != 255: raise ValueError('Expected exactly 255 unique official card images')
    for row in rows: grouped[row['number']].append(row)
    if len(grouped) != 131: raise ValueError('Expected 131 set-associated card numbers')
    if {n for n in grouped if n.startswith('hBP09-')} != {f'hBP09-{i:03}' for i in range(1,112)}: raise ValueError('Missing hBP09 numbered card')
    cards = []; japanese = {}
    base_rarities = ['OSR','RR','R','U','C','S','SY','SR','UR','OUR','HR','SEC']
    for card_number, printings in sorted(grouped.items()):
        def rarity(r): return r['info'].get('レアリティ',{}).get('text','')
        row = min(printings, key=lambda r: base_rarities.index(rarity(r)) if rarity(r) in base_rarities else 99)
        info = row['info']; kind = info.get('カードタイプ',{}).get('text','')
        if kind not in TYPES: raise ValueError(f'Unknown type: {kind}')
        group, typecode, label = TYPES[kind]
        colors = []
        for icon in info.get('色',{}).get('images',[]):
            m = re.search(r'/type_([a-z]+)\.png',icon.get('src',''))
            if not m or m[1] not in COLORS: raise ValueError(f'Unrecognized color: {icon}')
            colors.append(m[1])
        abilities = fields(row)
        ability = info.get('能力テキスト',{}).get('text','').strip()
        if group == 'support' and not ability: raise ValueError(f'Missing support effect: {card_number}')
        hp = number(info.get('HP',{}).get('text','')); life = number(info.get('LIFE',{}).get('text',''))
        if group == 'holomem' and (hp is None or not abilities['arts']): raise ValueError(f'Missing Holomen stats: {card_number}')
        if group == 'oshi' and (life is None or not abilities['oshiSkill']): raise ValueError(f'Missing oshi stats: {card_number}')
        variants = [{'id':'hbp09-'+pathlib.PurePosixPath(r['image']).stem,'rarity':rarity(r),'image':r['image'],'sets':[SET],'releaseDate':DATE,'sourceUrl':r['sourceUrl']} for r in printings]
        variants.sort(key=lambda v:(base_rarities.index(v['rarity']) if v['rarity'] in base_rarities else 99,v['id']))
        unlimited = '何枚でも' in abilities['extra']
        name = names.get(row['name'], row['name'])
        if group == 'cheer': name = (COLORS[colors[0]] if colors else '') + '色應援'
        card = {'id':variants[0]['id'],'number':card_number,'name':name,'jpName':row['name'],'enName':'','group':group,'type':label,'typeCode':typecode,'colors':[COLORS[c] for c in colors],'colorCodes':colors,'stage':info.get('Bloomレベル',{}).get('text','').replace(' Buzz',''),'hp':hp,'life':life,'rarity':rarity(row),'set':SET,'sets':[SET],'tags':info.get('タグ',{}).get('text','').split(),'illustrator':'','baton':len(info.get('バトンタッチ',{}).get('images',[])) if 'バトンタッチ' in info else None,'image':row['image'],'variants':variants,'abilityText':ability,**abilities,'qaCount':0,'maxCopies':1 if group=='oshi' else 20 if group=='cheer' else 99 if unlimited else 4,'unlimited':unlimited,'restricted':False,'preview':False,'simOnly':False,'releaseDate':DATE,'catalogVersion':VERSION,'effectLanguage':'ja','translationStatus':'official-japanese-fallback','sourceUrl':row['sourceUrl'],'simulationStatus':'not-audited'}
        japanese[card_number] = {'titles':[row['name']] + [s['name'] for key in ['keyword','stageSkill','oshiSkill','spOshiSkill'] if (s:=card.get(key))] + [a['name'] for a in card['arts']], 'effects':[t for t in [ability,card['extra']] + [s['effect'] for key in ['keyword','stageSkill','oshiSkill','spOshiSkill'] if (s:=card.get(key))] + [a['effect'] for a in card['arts']] if t]}
        cards.append(card)
    return {'meta':{'catalogVersion':VERSION,'releaseDate':DATE,'set':SET,'officialPrintings':255,'officialBaseCards':125,'officialParallels':130,'numberedNewCards':111,'reprintedCardNumbers':14,'newCheerNumbers':6,'sourceUrl':source['productUrl'],'translationStatus':'Japanese originals; no unverified machine translation substituted'},'cards':cards}, japanese

def merge(base, release, local_images=None):
    result = copy.deepcopy(base); current = {c['number']:c for c in result['cards']}
    if len(current) != len(result['cards']): raise ValueError('Duplicate card numbers in destination')
    added = 0; added_variants = 0
    for incoming in release['cards']:
        incoming = copy.deepcopy(incoming); n = incoming['number']; old = current.get(n)
        if local_images is not None:
            for obj in [incoming] + incoming['variants']:
                if obj['image'] not in local_images: raise ValueError(f'Unbundled new image: {obj["image"]}')
                obj['image'] = local_images[obj['image']]
        if old is None:
            current[n] = incoming; added += 1; added_variants += len(incoming['variants']); continue
        # Non-hBP09 reprints retain all original rules, translations, IDs and restrictions.
        replace = n.startswith('hBP09-') or n.startswith('hY') and old.get('catalogVersion') == VERSION
        out = {**old, **incoming, 'id':old['id']} if replace else copy.deepcopy(old)
        out['sets'] = list(dict.fromkeys([s for s in old.get('sets',[old.get('set','')]) if '先行公開' not in s] + [SET]))
        out['variants'] = copy.deepcopy(old.get('variants',[])); images = {v['image']:v for v in out['variants']}
        for variant in incoming['variants']:
            if variant['image'] in images:
                existing_variant = images[variant['image']]
                existing_variant['sets'] = list(dict.fromkeys(existing_variant.get('sets',[]) + [SET]))
            else:
                out['variants'].append(variant); images[variant['image']] = variant; added_variants += 1
        current[n] = out
    result['cards'] = sorted(current.values(),key=lambda c:c['number'])
    result['meta'] = {**result.get('meta',{}),'snapshotDate':'2026-09-17','catalogVersion':VERSION,'uniqueCards':len(current),'sourceUniqueCards':sum(not c.get('simOnly',False) for c in current.values()),'printings':sum(len(c.get('variants',[])) for c in current.values()),'latestRelease':SET+'（2026-09-19 發售）','latestReleasePrintings':255,'latestReleaseBaseCards':125,'latestReleaseParallels':130,'latestReleaseDate':DATE,'hbp09':release['meta'],'note':'卡名沿用現有繁中名稱；hBP09 新效果目前附官方日文原文，並非已核准繁中翻譯。新卡實際效果及對戰支援須另行驗證；正式對戰以官方日文卡面與最新裁定為準。'}
    return result, {'addedCards':added,'addedVariants':added_variants,'totalCards':len(current),'totalPrintings':result['meta']['printings']}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--cards',default=str(ROOT.parent/'public/cards.json')); args=parser.parse_args()
    base=load(args.cards); source=load(ROOT/'hbp09-official.json'); names=load(ROOT/'name-zh.json')
    release,japanese=build_release(source,names,{c['number']:c for c in base['cards']})
    output,summary=merge(base,release)
    again,repeat=merge(output,release)
    if output!=again or repeat['addedCards'] or repeat['addedVariants']: raise ValueError('Merge is not idempotent')
    dump(args.cards,output); dump(ROOT.parent/'public/hbp09-cards.json',release); dump(ROOT.parent/'public/hbp09-scanner-ja.json',japanese)
    scanner_path=ROOT.parent/'public/scanner-ja.json'; scanner=load(scanner_path); scanner['cards'].update(japanese); scanner.setdefault('meta',{})['hbp09CatalogVersion']=VERSION;dump(scanner_path,scanner)
    dump(ROOT.parent/'docs/hbp09-import-report.json',summary)
    print(json.dumps(summary))

if __name__=='__main__': main()
