"""Compare official structured card evidence without changing the production catalog.

Normalization treats zero/blank baton and null/colorless/composite color encodings
as equivalent. A listing difference is evidence to inspect, never an automatic
rules correction: official HTML can disagree with the printed card PNG.
"""
import argparse,importlib.util,json,re,pathlib,collections
script_directory=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('fetch',script_directory/'fetch-official-audit.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
color={'白':'white','緑':'green','綠':'green','赤':'red','紅':'red','青':'blue','藍':'blue','紫':'purple','黄':'yellow','黃':'yellow','無':'colorless','無色':'colorless','◇':'colorless','null':'colorless'}
def normalized_colors(values):
 out=[]
 for value in values:
  parts=value.split('_') if '_' in value else list(value) if value and all(ch in color for ch in value) else [value]
  out.extend(color.get(part,part) for part in parts)
 return sorted(out)

def numeric(v):
 t=str(v or '').strip();return int(t) if t.isdigit() else None

def artstats(field):
 p=m.Parser();p.feed(field.get('headingHtml',''))
 spans=p.root.all(lambda n:n.tag=='span')
 if not spans:raise ValueError('No arts heading')
 span=spans[0]
 specials=span.all(lambda n:n.has('tokkou'))
 def is_bonus(img):
  n=img.parent
  while n and n is not span:
   if n.has('tokkou'):return True
   n=n.parent
  return False
 costs=[img.attrs.get('alt','') for img in span.all(lambda n:n.tag=='img') if not is_bonus(img)]
 plain=''.join(c.text() if isinstance(c,m.Node) and not c.has('tokkou') and c.tag!='img' else c if isinstance(c,str) else '' for c in span.children).strip()
 match=re.search(r'(\d+)([+±×x-]?)\s*$',plain)
 if not match:raise ValueError('No damage in '+repr(plain))
 targets=[color.get(re.sub(r'\+\d+','',img.attrs.get('alt','')),re.sub(r'\+\d+','',img.attrs.get('alt',''))) for bonus in specials for img in bonus.all(lambda n:n.tag=='img')]
 values=[int(n) for bonus in specials for n in re.findall(r'\+(\d+)',bonus.text())]
 return {'damage':int(match.group(1)),'damageModifier':match.group(2),'cost':[color.get(c,c) for c in costs],'specialTargets':targets,'specialValues':values}

def stats(row):
 i=row['info'];images=row.get('infoDetails',{}).get('色',{}).get('images',[])
 arts=[];errors=[]
 for f in row['fields']:
  if 'arts' not in f['class'].split():continue
  try:arts.append(artstats(f))
  except Exception as e:errors.append(str(e))
 return {'hp':numeric(i.get('HP')),'life':numeric(i.get('LIFE')),'stage':i.get('Bloomレベル',''),'colorCodes':normalized_colors([im['alt'] for im in images]),'baton':len(row.get('infoDetails',{}).get('バトンタッチ',{}).get('images',[])),'arts':arts},errors

def catalogstats(c):
 arts=[]
 for a in c.get('arts',[]):
  arts.append({'damage':a.get('damage'),'damageModifier':a.get('damageModifier',''),'cost':[color.get(v,v) for v in a.get('cost',[])],'specialTargets':[color.get(v,v) for v in a.get('specialTargets',[])],'specialValues':a.get('specialValues',[])})
 return {**{k:c.get(k) for k in ['hp','life','stage','baton']},'colorCodes':normalized_colors(c.get('colorCodes',[])),'baton':c.get('baton') or 0,'arts':arts}

def main():
 parser=argparse.ArgumentParser(description='Read-only structured metadata audit; does not rewrite translated effects or catalog rules')
 parser.add_argument('snapshot');parser.add_argument('baseline_catalog');parser.add_argument('output');args=parser.parse_args()
 snapshot=json.loads(pathlib.Path(args.snapshot).read_text());catalog=json.loads(pathlib.Path(args.baseline_catalog).read_text());cards={c['number']:c for c in catalog['cards']}
 official=[r for r in snapshot['printings'] if re.fullmatch(r'[A-Za-z0-9]+-\d{3}',r['number'])];bysource={(r['number'],r['imageUrl']):r for r in official};existing={(c['number'],v['image']):v for c in catalog['cards'] if not c.get('simOnly') for v in c['variants']};missing=[r for k,r in bysource.items() if k not in existing];absent=[{'number':k[0],**v} for k,v in existing.items() if k not in bysource];newnums=sorted(set(r['number'] for r in missing)-set(cards))
 changes=[];parse_errors=[];pernumber=collections.defaultdict(list)
 for row in official:
  actual,errors=stats(row)
  if errors:parse_errors.append({'number':row['number'],'sourceUrl':row['sourceUrl'],'errors':errors})
  pernumber[row['number']].append({'sourceUrl':row['sourceUrl'],'imageUrl':row['imageUrl'],'stats':actual})
  c=cards.get(row['number'])
  if c:
   expected=catalogstats(c)
   diff={k:{'catalog':expected[k],'official':actual[k]} for k in expected if expected[k]!=actual[k]}
   if diff:changes.append({'number':row['number'],'sourceUrl':row['sourceUrl'],'imageUrl':row['imageUrl'],'diff':diff})
 inconsistencies=[]
 for number,rows in pernumber.items():
  signatures={json.dumps(r['stats'],ensure_ascii=False,sort_keys=True) for r in rows}
  if len(signatures)>1:inconsistencies.append({'number':number,'rows':rows})
 summary={'officialListingRows':len(snapshot['printings']),'officialNumberedPrintings':len(official),'officialUniqueCardNumbers':len(pernumber),'baselineCards':len(catalog['cards']),'baselineNumberedPrintings':len(existing),'newCardNumbers':newnums,'newCards':len(newnums),'missingPrintings':len(missing),'absentExistingPrintings':len(absent),'existingMetadataMismatchRows':len(changes),'existingMetadataMismatchCards':len(set(r['number'] for r in changes)),'sameNumberMetadataInconsistencies':len(inconsistencies),'parseErrorRows':len(parse_errors)}
 payload={'summary':summary,'newPrintings':missing,'absentExisting':absent,'existingMetadataDifferences':changes,'sameNumberInconsistencies':inconsistencies,'parseErrors':parse_errors}
 pathlib.Path(args.output).write_text(json.dumps(payload,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
