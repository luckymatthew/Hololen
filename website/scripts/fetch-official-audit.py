"""Read-only official card evidence capture; never marks a translation reviewed."""
import argparse, concurrent.futures, datetime, hashlib, html as html_lib, json, pathlib, re, urllib.parse, urllib.request
from html.parser import HTMLParser

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def has(self, cls): return cls in self.attrs.get('class', '').split()
    def all(self, predicate):
        out=[]
        for c in self.children:
            if isinstance(c, Node):
                if predicate(c): out.append(c)
                out.extend(c.all(predicate))
        return out
    def html(self):
        attrs=''.join(' '+k+'="'+html_lib.escape(v or '', quote=True)+'"' for k,v in self.attrs.items())
        inner=''.join(c.html() if isinstance(c,Node) else html_lib.escape(c) for c in self.children)
        return '<'+self.tag+attrs+'>'+inner+('' if self.tag in {'img','br','meta','link','input','hr','source','wbr','area','base','embed','param'} else '</'+self.tag+'>')
    def text(self, skip_spans=False):
        if skip_spans and self.tag=='span': return ''
        if self.tag=='br': return '\n'
        if self.tag=='img': return self.attrs.get('alt','')
        return ''.join(c.text(skip_spans) if isinstance(c,Node) else c for c in self.children)

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.root=Node();self.current=self.root
    def handle_starttag(self,tag,attrs):
        n=Node(tag,attrs,self.current);self.current.children.append(n)
        if tag not in {'img','br','meta','link','input','hr','source','wbr','area','base','embed','param'}:self.current=n
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
    def handle_endtag(self,tag):
        n=self.current
        while n.parent and n.tag!=tag:n=n.parent
        if n.parent:self.current=n.parent
    def handle_data(self,data):self.current.children.append(data)

def clean(t):return re.sub(r'[\t\r ]+',' ',t).strip()
def absolute_url(url):return urllib.parse.urljoin('https://hololive-official-cardgame.com',url)
def images(node):return [{'src':absolute_url(x.attrs.get('src','')),'alt':x.attrs.get('alt',''),'class':x.attrs.get('class','')} for x in node.all(lambda x:x.tag=='img')]
def extract(html,url):
    parser=Parser();parser.feed(html);cards=[]
    for number in parser.root.all(lambda n:n.tag=='p' and n.has('number')):
        li=number
        while li.parent and li.tag!='li':li=li.parent
        names=li.all(lambda n:n.tag=='p' and n.has('name'))
        if not names:continue
        links=li.all(lambda n:n.tag=='a')
        row={'number':number.text().strip(),'jpName':names[0].text().strip(),'sourceUrl':absolute_url(links[0].attrs['href']) if links else url,'listUrl':url,'fields':[],'info':{},'infoDetails':{}}
        card_images=li.all(lambda n:n.tag=='img' and '/images/cardlist/' in n.attrs.get('src',''))
        row['imageUrl']=absolute_url(card_images[0].attrs['src']) if card_images else ''
        row['officialId']=urllib.parse.parse_qs(urllib.parse.urlparse(row['sourceUrl']).query).get('id',[None])[0]
        row['html']=li.html()
        for dl in li.all(lambda n:n.tag=='dl'):
            term=''
            for node in dl.children:
                if not isinstance(node,Node):continue
                if node.tag=='dt':term=clean(node.text())
                if node.tag=='dd':
                    row['info'][term]=clean(node.text())
                    row['infoDetails'][term]={'text':clean(node.text()),'images':images(node),'html':node.html()}
        for n in li.all(lambda n:n.tag=='div' and any(n.has(k) for k in ['skill','arts','keyword','extra','ability'])):
            ps=[c for c in n.children if isinstance(c,Node) and c.tag=='p']
            row['fields'].append({'class':n.attrs.get('class',''),'label':clean(ps[0].text()) if ps else '', 'text':clean(n.text()),'effect':clean(ps[1].text(True)) if len(ps)>1 else clean(n.text()),'heading':clean(''.join(x.text() for x in ps[1].children if isinstance(x,Node) and x.tag=='span')) if len(ps)>1 else '', 'icons':[x.attrs.get('src') for x in n.all(lambda x:x.tag=='img')],'images':images(n),'headingImages':[image for x in ps[1].children if isinstance(x,Node) and x.tag=='span' for image in images(x)] if len(ps)>1 else [],'headingHtml':''.join(x.html() for x in ps[1].children if isinstance(x,Node) and x.tag=='span') if len(ps)>1 else '', 'html':n.html(),'paragraphs':[{'text':clean(x.text()),'html':x.html(),'images':images(x)} for x in ps]})
        cards.append(row)
    return cards

def extract_products(html, source_url):
    parser=Parser();parser.feed(html);products={}
    for anchor in parser.root.all(lambda n:n.tag=='a' and n.has('anchor') and 'expansion=' in n.attrs.get('href','')):
        names=anchor.all(lambda n:n.has('name'))
        dates=anchor.all(lambda n:n.tag=='dd')
        if not names:continue
        label=clean(names[0].text())
        date_match=re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日',' '.join(n.text() for n in dates))
        if not date_match:continue
        y,m,d=map(int,date_match.groups())
        products[label]={'releaseDate':datetime.date(y,m,d).isoformat(),'sourceUrl':source_url,'cardListUrl':absolute_url(anchor.attrs['href']),'expansion':urllib.parse.parse_qs(urllib.parse.urlparse(anchor.attrs['href']).query).get('expansion',[''])[0]}
    return products

def extract_detail(html, row):
    parser=Parser();parser.feed(html)
    boxes=parser.root.all(lambda n:n.has('cardlist-Detail_Box'))
    if not boxes:raise ValueError('Official detail response has no card box')
    box=boxes[0]
    card_images=box.all(lambda n:n.tag=='img' and '/images/cardlist/' in n.attrs.get('src',''))
    if not card_images or absolute_url(card_images[0].attrs['src'])!=row['imageUrl']:
        raise ValueError('Official detail image does not match printing')
    numbers=box.all(lambda n:n.tag=='p' and n.has('number'))
    if not numbers or row['number'] not in numbers[0].text():
        raise ValueError('Official detail number does not match printing')
    artists=box.all(lambda n:n.has('ill-name'))
    artist_spans=artists[0].all(lambda n:n.tag=='span') if artists else []
    row['illustrator']=clean(artist_spans[0].text()) if artist_spans else ''
    row['qaCount']=len(parser.root.all(lambda n:n.has('qa-List_Item')))
    row['detailProducts']={}
    for product_box in parser.root.all(lambda n:n.has('products')):
        names=product_box.all(lambda n:n.has('products-ttl'))
        if not names:continue
        labels=names[0].all(lambda n:n.tag=='p')
        if not labels:continue
        label=clean(labels[0].text())
        matches=re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日',product_box.text())
        links=product_box.all(lambda n:n.tag=='a' and n.text().strip()=='MORE')
        if matches:
            y,m,d=map(int,matches.groups());row['detailProducts'][label]={'releaseDate':datetime.date(y,m,d).isoformat(),'sourceUrl':row['sourceUrl'],'productUrl':absolute_url(links[0].attrs['href']) if links else ''}
    return row

def validate_snapshot(payload):
    rows=payload.get('printings',[])
    if payload.get('successfulPages')!=payload.get('pages') or payload.get('errors') or len(rows)!=payload.get('totalResults'):
        raise ValueError(f"Incomplete official capture: {len(rows)}/{payload.get('totalResults')} rows; errors={payload.get('errors')}")
    ids=[row.get('officialId') for row in rows]
    if any(not str(value or '').isdigit() for value in ids) or len(set(ids))!=len(rows):
        raise ValueError('Official capture has missing or duplicate official IDs; refusing pagination drift')
    for row in rows:
        if re.fullmatch(r'[A-Za-z0-9]+-\d{3}',row.get('number','')) and not row.get('imageUrl','').startswith('https://hololive-official-cardgame.com/wp-content/images/cardlist/'):
            raise ValueError(f"Missing official card image: {row.get('number')}")

def fetch_file(url, file, resume=False):
    """Fetch fresh by default; cache reuse is explicit and never gets a new source time."""
    started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    metadata_file=file.with_name(file.name+'.capture.json')
    reused=bool(resume and file.exists())
    if reused:
        data=file.read_bytes();digest=hashlib.sha256(data).hexdigest()
        recorded=json.loads(metadata_file.read_text()) if metadata_file.exists() else {}
        matching=recorded.get('url')==url and recorded.get('sha256')==digest
        evidence={'url':url,'sha256':digest,'sourceFetchedAt':recorded.get('sourceFetchedAt') if matching else None,'sourceTimeBasis':'recorded-network-fetch' if matching else 'unknown-legacy-cache','httpDate':recorded.get('httpDate') if matching else None}
    else:
        req=urllib.request.Request(url,headers={'User-Agent':'HoloPocketLab-TranslationReview/0.2'})
        with urllib.request.urlopen(req,timeout=30) as response:
            data=response.read();http_date=response.headers.get('Date')
        completed=datetime.datetime.now(datetime.timezone.utc).isoformat()
        digest=hashlib.sha256(data).hexdigest();file.write_bytes(data)
        evidence={'url':url,'sha256':digest,'sourceFetchedAt':completed,'sourceTimeBasis':'recorded-network-fetch','httpDate':http_date}
        metadata_file.write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
    evidence.update({'reusedCache':reused,'readStartedAt':started,'readCompletedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cachedFileModifiedAt':datetime.datetime.fromtimestamp(file.stat().st_mtime,datetime.timezone.utc).isoformat()})
    return data,evidence

def main():
    p=argparse.ArgumentParser();p.add_argument('--directory',required=True);p.add_argument('--details-for-new-printings',metavar='CATALOG_JSON');p.add_argument('--resume',action='store_true',help='Explicitly reuse local evidence; original source timestamps are retained/marked unknown');a=p.parse_args();out=pathlib.Path(a.directory);raw=out/'raw';raw.mkdir(parents=True,exist_ok=True)
    capture_started_at=datetime.datetime.now(datetime.timezone.utc).isoformat();captures=[]
    base='https://hololive-official-cardgame.com/cardlist/cardsearch/?view=text'
    def fetch(page):
        url=base if page==1 else f'https://hololive-official-cardgame.com/cardlist/cardsearch_ex?view=text&page={page}'
        file=raw/f'{page:03d}.html'
        try:
            data,evidence=fetch_file(url,file,a.resume);captures.append(evidence)
            html=data.decode('utf-8');rows=extract(html,url)
            if not rows:raise ValueError('No cards in response')
            return {'page':page,**evidence,'cards':rows}
        except Exception as e:return {'page':page,'url':url,'error':str(e)}
    first=fetch(1)
    if 'error' in first:raise RuntimeError(first)
    total_results=int(re.search(r'検索結果\s*([0-9,]+)\s*件',re.sub(r'<[^>]+>','',(raw/'001.html').read_text())).group(1).replace(',',''))
    total=int(re.search(r'var max_page = (\d+)',(raw/'001.html').read_text()).group(1))
    results=[first]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(fetch,range(2,total+1)):
            results.append(result)
            if len(results)%15==0:print(f'Captured {len(results)}/{total} official pages',flush=True)
    rows=[c for r in results for c in r.get('cards',[])]
    products_url='https://hololive-official-cardgame.com/cardlist/'
    product_file=raw/'products-index.html'
    product_data,product_evidence=fetch_file(products_url,product_file,a.resume);captures.append(product_evidence)
    products=extract_products(product_data.decode('utf-8'),products_url)
    if a.details_for_new_printings:
        catalog=json.loads(pathlib.Path(a.details_for_new_printings).read_text())
        existing={(card['number'],variant['image']) for card in catalog['cards'] for variant in card.get('variants',[])}
        delta=[row for row in rows if re.fullmatch(r'[A-Za-z0-9]+-\d{3}',row['number']) and (row['number'],row['imageUrl']) not in existing]
        def detail(row):
            file=raw/f"detail-{row['officialId']}.html"
            data,evidence=fetch_file(row['sourceUrl'],file,a.resume);captures.append(evidence)
            extract_detail(data.decode('utf-8'),row)
            row['detailEvidence']=evidence
            return row
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(detail,delta))
        for row in delta:products.update(row.get('detailProducts',{}))
    payload={'schemaVersion':2,'products':products,'productEvidence':product_evidence,'capture':{'mode':'resume' if a.resume else 'fresh-network','scope':'full official list; optional new-printing details','startedAt':capture_started_at,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reusedCache':any(e['reusedCache'] for e in captures),'reusedFiles':sum(e['reusedCache'] for e in captures),'freshFiles':sum(not e['reusedCache'] for e in captures)},'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'totalResults':total_results,'pages':total,'successfulPages':sum('error' not in r for r in results),'errors':[r for r in results if 'error' in r],'pageEvidence':[{k:v for k,v in r.items() if k!='cards'} for r in results],'printings':rows}
    validate_snapshot(payload)
    (out/'official-snapshot.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
    print(json.dumps({'totalResults':total_results,'pages':total,'successfulPages':payload['successfulPages'],'printings':len(rows),'cardNumbers':len(set(c['number'] for c in rows)),'errors':payload['errors']},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
