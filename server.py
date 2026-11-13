import json, os, sqlite3, smtplib
from email.message import EmailMessage
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
ROOT=Path(__file__).parent
DB=Path(os.environ.get('REPORTS_DB',str(ROOT/'reports.sqlite3')))
def connect():
 c=sqlite3.connect(DB); c.execute('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, data TEXT)'); return c
def state():
 with connect() as c:
  row=c.execute('SELECT data FROM state WHERE id=1').fetchone()
 return json.loads(row[0]) if row else {'productions':[], 'reports':[]}
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT/'static'),**kw)
 def reply(self,data,status=200):
  self.send_response(status); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(json.dumps(data).encode())
 def do_GET(self):
  if self.path=='/api/state': return self.reply(state())
  return super().do_GET()
 def do_POST(self):
  try:
   data=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))))
   if self.path=='/api/state':
    with connect() as c:c.execute('INSERT OR REPLACE INTO state VALUES (1,?)',(json.dumps(data),))
    return self.reply({'ok':True})
   if self.path=='/api/send':
    s=state(); r=next(x for x in s['reports'] if x['id']==data['id']); p=next(x for x in s['productions'] if x['id']==r['production'])
    managers=[x.strip() for x in p['managers'].split(',') if x.strip()]
    cast=list(set(x['email'] for x in p['people'] if x['role']=='Cast'))
    crew=list(set(x['email'] for x in p['people'] if x['role']!='Cast')-set(cast)-set(managers))
    cast=list(set(cast)-set(managers))
    if not managers or not cast or not crew:raise ValueError('Add manager, cast, and non-cast email recipients before sending.')
    if not os.environ.get('SMTP_HOST'):raise ValueError('Email is not configured. Set SMTP_HOST and SMTP_FROM on the server.')
    subject=f"{r['type'].upper()} REPORT: {p['name']} — {r['date']}"
    body='\n\n'.join(f'{k}:\n{v}' for k,v in r['fields'].items() if v)+f"\n\nSchedule: {p.get('schedule','')}\nProduction folder: {p.get('folder','')}"
    sent=[]
    with smtplib.SMTP(os.environ['SMTP_HOST'],int(os.environ.get('SMTP_PORT','587')),timeout=20) as smtp:
     smtp.starttls()
     if os.environ.get('SMTP_USER'):smtp.login(os.environ['SMTP_USER'],os.environ['SMTP_PASSWORD'])
     for label,recipients in [('Cast',cast),('Production team',crew)]:
      msg=EmailMessage(); msg['From']=os.environ['SMTP_FROM']; msg['To']=', '.join(managers); msg['Subject']=subject
      if label=='Production team':msg['Cc']=', '.join(recipients)
      msg.set_content(body)
      try:
       refused=smtp.send_message(msg,to_addrs=managers+recipients)
       if refused:raise ValueError('Some recipients were rejected')
       sent.append(label)
      except Exception: return self.reply({'error':f'Delivery interrupted. Accepted copies: {", ".join(sent) or "none"}. Check mail logs before retrying.'},502)
    return self.reply({'ok':True,'message':'Both copies accepted by the mail server.'})
   self.reply({'error':'Not found'},404)
  except Exception as e:self.reply({'error':str(e)},400)
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('PORT','8000'))),Handler).serve_forever()
