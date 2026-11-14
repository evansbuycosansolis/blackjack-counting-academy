# Regenerate numeric regression fixtures from the author's public combinatorial tables.
# Only mathematical numeric facts are retained; no page copy or images ship in the app.
import urllib.request,json,re,concurrent.futures
from reference_parser import Tables
from pathlib import Path
specs=[(d,h,False) for d in [1,2,4,6,8] for h in [False,True]]+[(d,h,True) for d in [6,8] for h in [False,True]]
def get(spec):
 d,h,e=spec;slug=('euro-' if e else '')+str(d)+'d'+('h17' if h else 's17')+'r4'
 url='https://wizardofodds.com/games/blackjack/appendix/9/'+slug+'/'
 cache=Path('reference/'+slug+'.html')
 if not cache.exists(): cache.write_text(urllib.request.urlopen(url,timeout=30).read().decode(),encoding='utf-8')
 parser=Tables();parser.feed(cache.read_text(encoding='utf-8'))
 out={}
 for t in parser.tables[:2]:
  if t[0][:3]!=['Dealer','Player','Stand']:raise ValueError((slug,t[:1]))
  for row in t[1:]:
   up=11 if row[0]=='A' else int(row[0]);rs=sorted(11 if x=='A' else int(x) for x in row[1].split(','));key=str(up)+':'+','.join(map(str,rs))
   nums=[None if x=="N/V" else float(x.replace("--","-")) for x in row[2:]]
   # Older European pages use -1 as an unavailable-action placeholder.
   # Newer pages print N/V. Do not expose these placeholders as actual EV.
   hard=11 not in rs
   if e and hard and sum(rs)>11: nums[2]=None
   if e and hard and sum(rs)>=17: nums[1]=None
   out[key]=nums[:5] if len(nums)==6 else nums[:3]
 if len(out)!=550:raise ValueError((slug,len(out)))
 return slug,{'source':url,'values':out}
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex: result=dict(ex.map(get,specs))
 Path('src/engine/reference-values.json').write_text(json.dumps(result,separators=(',',':')))
 print('Saved',len(result),'profiles,',sum(len(v['values']) for v in result.values()),'initial situations')


