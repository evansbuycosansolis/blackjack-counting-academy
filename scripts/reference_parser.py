import urllib.request,re
from html.parser import HTMLParser
class Tables(HTMLParser):
 def __init__(self): super().__init__();self.tables=[];self.t=None;self.r=None;self.c=None
 def handle_starttag(self,tag,attrs):
  if tag=='table': self.t=[]
  elif tag=='tr': self.r=[]
  elif tag in ['td','th']: self.c=''
 def handle_data(self,s):
  if self.c is not None:self.c+=s
 def handle_endtag(self,tag):
  if tag in ['td','th'] and self.c is not None:
   if self.r is not None:self.r.append(' '.join(self.c.split()))
   self.c=None
  elif tag=='tr' and self.r is not None:
   if self.t is not None:self.t.append(self.r)
   self.r=None
  elif tag=='table' and self.t is not None:self.tables.append(self.t);self.t=None

