"""Prepare pinned hBP09 sources and images. Requires beautifulsoup4, json5, Pillow.
Network inputs are parsed as data; no downloaded JavaScript is executed.
"""
import concurrent.futures, hashlib, io, json, pathlib, re, time, urllib.parse, urllib.request
from bs4 import BeautifulSoup
from PIL import Image
import json5

ROOT = pathlib.Path(__file__).resolve().parent
ORIGIN = 'https://hololive-official-cardgame.com'

def fetch(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Hololens-hBP09/1.0'})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except Exception:
            if attempt == 2: raise
            time.sleep(2 ** attempt)

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def objects(text):
    for match in re.finditer(r'\{id:\s*[\"\']hBP09-', text):
        start = match.start(); depth = 0; quote = None; escape = False
        for index in range(start, len(text)):
            char = text[index]
            if quote:
                if escape: escape = False
                elif char == '\\': escape = True
                elif char == quote: quote = None
            elif char in '\"\'': quote = char
            elif char == '{': depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    yield text[start:index + 1]
                    break

def main():
    records = []; samples = {}
    for file in sorted(pathlib.Path('evidence/raw').glob('*.html')):
        soup = BeautifulSoup(file.read_text(encoding='utf-8'), 'html.parser')
        # The initial page does not use ex-item; AJAX pages do.
        for number in soup.select('p.number'):
            li = number.find_parent('li')
            if li is None: continue
            name = li.select_one('p.name')
            if name is None: continue
            info = {}
            for dl in li.select('.info dl'):
                for dt in dl.find_all('dt', recursive=False):
                    dd = dt.find_next_sibling('dd')
                    info[dt.get_text(strip=True)] = {'text': dd.get_text(' ', strip=True), 'images': [dict(x.attrs) for x in dd.find_all('img')]} if dd else {}
            img = li.select_one('div.img img'); anchor = li.find('a')
            if not img or not anchor: raise ValueError(f'Missing image for {number.text}')
            row = {'number': number.get_text(strip=True), 'name': name.get_text(strip=True), 'image': urllib.parse.urljoin(ORIGIN, img['src']), 'sourceUrl': urllib.parse.urljoin(ORIGIN, anchor['href']), 'info': info, 'fields': []}
            for div in li.find_all('div'):
                classes = div.get('class', [])
                if not any(c in classes for c in ['skill', 'arts', 'keyword', 'extra', 'ability']): continue
                field = {'class': ' '.join(classes), 'html': str(div), 'text': div.get_text(' ', strip=True)}
                row['fields'].append(field); samples.setdefault(field['class'], str(div))
            records.append(row)
    if len(records) != 255 or len({r['image'] for r in records}) != 255 or len({r['number'] for r in records}) != 131:
        raise ValueError(f'Incomplete/duplicate official set: {len(records)} records')
    write_json(ROOT / 'hbp09-official.json', {'product': 'ボリュームヴォルテックス', 'releaseDate': '2026-09-19', 'productUrl': ORIGIN + '/products/post/volume-vortex/', 'snapshotDate': '2026-09-17', 'printings': records})
    page = fetch('https://tetsunekko.github.io/holotcgtw/').decode()
    scripts = re.findall(r'<script[^>]+src=[\"\']([^\"\']+)', page)
    translations = []; provenance = []; errors = []
    for script in scripts:
        url = urllib.parse.urljoin('https://tetsunekko.github.io/holotcgtw/', script)
        data = fetch(url); text = data.decode()
        provenance.append({'url': url, 'sha256': hashlib.sha256(data).hexdigest()})
        for snippet in objects(text):
            try: translations.append(json5.loads(snippet))
            except Exception as error: errors.append({'error': str(error), 'snippet': snippet[:500]})
        if 'hBP09' in text and not translations:
            start = max(0, text.find('hBP09') - 200)
            errors.append({'context': text[start:start + 2000]})
    write_json(ROOT / 'hbp09-source.json', {'provenance': provenance, 'cards': translations})
    write_json(ROOT.parent / 'docs/hbp09-source-inspection.json', {'officialCount': len(records), 'classes': samples, 'translationCount': len(translations), 'translationSamples': translations[:2], 'translationErrors': errors[:5], 'infoSamples': [{k: v for k, v in r.items() if k != 'fields'} for r in records[:4]]})
    media = ROOT.parent / 'public/card-art'; media.mkdir(parents=True, exist_ok=True)
    def convert_image(row):
        data = fetch(row['image']); image = Image.open(io.BytesIO(data)); image.load()
        if image.width < 300 or image.height < 400: raise ValueError('Unexpected card dimensions')
        filename = 'hbp09-' + hashlib.sha256(row['image'].encode()).hexdigest()[:20] + '.webp'
        image.convert('RGB').save(media / filename, 'WEBP', quality=92, method=6)
        return {'url': row['image'], 'path': '/card-art/' + filename, 'sha256': hashlib.sha256((media / filename).read_bytes()).hexdigest(), 'width': image.width, 'height': image.height}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        images = list(pool.map(convert_image, records))
    write_json(ROOT / 'hbp09-art-manifest.json', images)
    print(json.dumps({'officialPrintings': len(records), 'translations': len(translations), 'images': len(images)}))

if __name__ == '__main__': main()
