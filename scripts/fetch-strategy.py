import urllib.request,re,json
from pathlib import Path
for name in ['1-deck','2-decks','european']:
 url='https://wizardofodds.com/games/blackjack/strategy/'+name+'/'
 html=urllib.request.urlopen(url).read().decode()
 Path('reference/'+name+'.html').write_text(html,encoding='utf-8')
 print(name, re.findall(r'<img[^>]+(?:src|data-src)=[\"\']([^\"\']+)[\"\'][^>]*>',html)[-30:])
 print('chart imgs',re.findall(r'<img[^>]*(?:blackjack|strategy|1d|2d)[^>]*>',html,re.I)[-15:])
