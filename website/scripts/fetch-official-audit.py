"""Read-only official card evidence capture; never marks a translation reviewed."""
import argparse, concurrent.futures, datetime, hashlib, json, pathlib, re, urllib.request
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
def extract(html,url):
    parser=Parser();parser.feed(html);cards=[]
    for number in parser.root.all(lambda n:n.tag=='p' and n.has('number')):
        li=number
        while li.parent and li.tag!='li':li=li.parent
        names=li.all(lambda n:n.tag=='p' and n.has('name'))
        if not names:continue
        links=li.all(lambda n:n.tag=='a')
        row={'number':number.text().strip(),'jpName':names[0].text().strip(),'sourceUrl':'https://hololive-official-cardgame.com'+links[0].attrs['href'] if links else url,'listUrl':url,'fields':[],'info':{}}
        for dl in li.all(lambda n:n.tag=='dl'):
            term=''
            for node in dl.children:
                if not isinstance(node,Node):continue
                if node.tag=='dt':term=clean(node.text())
                if node.tag=='dd':row['info'][term]=clean(node.text())
        for n in li.all(lambda n:n.tag=='div' and any(n.has(k) for k in ['skill','arts','keyword','extra','ability'])):
            ps=[c for c in n.children if isinstance(c,Node) and c.tag=='p']
            row['fields'].append({'class':n.attrs.get('class',''),'label':clean(ps[0].text()) if ps else '', 'text':clean(n.text()),'effect':clean(ps[1].text(True)) if len(ps)>1 else clean(n.text()),'heading':clean(''.join(x.text() for x in ps[1].children if isinstance(x,Node) and x.tag=='span')) if len(ps)>1 else '', 'icons':[x.attrs.get('src') for x in n.all(lambda x:x.tag=='img')]})
        cards.append(row)
    return cards

def main():
    p=argparse.ArgumentParser();p.add_argument('--directory',required=True);a=p.parse_args();out=pathlib.Path(a.directory);raw=out/'raw';raw.mkdir(parents=True,exist_ok=True)
    base='https://hololive-official-cardgame.com/cardlist/cardsearch/?view=text'
    def fetch(page):
        url=base if page==1 else f'https://hololive-official-cardgame.com/cardlist/cardsearch_ex?view=text&page={page}'
        file=raw/f'{page:03d}.html'
        try:
            if not file.exists():
                req=urllib.request.Request(url,headers={'User-Agent':'HoloPocketLab-TranslationReview/0.1'})
                data=urllib.request.urlopen(req,timeout=30).read();file.write_bytes(data)
            data=file.read_bytes();html=data.decode('utf-8');rows=extract(html,url)
            if not rows:raise ValueError('No cards in response')
            return {'page':page,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'cards':rows}
        except Exception as e:return {'page':page,'url':url,'error':str(e)}
    first=fetch(1)
    if 'error' in first:raise RuntimeError(first)
    total=int(re.search(r'var max_page = (\d+)',(raw/'001.html').read_text()).group(1))
    results=[first]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(fetch,range(2,total+1)):
            results.append(result)
            if len(results)%15==0:print(f'Captured {len(results)}/{total} official pages',flush=True)
    rows=[c for r in results for c in r.get('cards',[])]
    payload={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pages':total,'successfulPages':sum('error' not in r for r in results),'errors':[r for r in results if 'error' in r],'pageEvidence':[{k:v for k,v in r.items() if k!='cards'} for r in results],'printings':rows}
    (out/'official-snapshot.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
    print(json.dumps({'pages':total,'successfulPages':payload['successfulPages'],'printings':len(rows),'cardNumbers':len(set(c['number'] for c in rows)),'errors':payload['errors']},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
