"""Read-only public NEIS school-name checks. No API key or personal/student data.
Exact current school-name matches only. INFO-200 is not proof of nonexistence.
"""
import json, time, urllib.request, urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parent
catalog=json.loads((root/'requested-catalog.json').read_text())
names=[n for rs in catalog['highSchools'].values() for ns in rs.values() for n in ns]
def full(n):
    n=n.removesuffix('BC')
    if n.endswith('공고'): return n[:-2]+'공업고등학교'
    if n.endswith('상고'): return n[:-2]+'상업고등학교'
    if n.endswith('고'): return n[:-1]+'고등학교'
    return None
def check(n):
    q=full(n)
    if not q:return {'requested':n,'query':None,'status':'club-outside-school-register','matches':[]}
    url='https://open.neis.go.kr/hub/schoolInfo?'+urllib.parse.urlencode({'Type':'json','SCHUL_NM':q})
    try:
        time.sleep(.25)
        data=json.loads(urllib.request.urlopen(url,timeout=25).read())
        if 'schoolInfo' in data:
            rows=data['schoolInfo'][1]['row']
            hits=[{'name':r['SCHUL_NM'],'area':r['LCTN_SC_NM'],'homepage':r['HMPG_ADRES']} for r in rows if r['SCHUL_NM'].replace(' ','').casefold().endswith(q.replace(' ','').casefold())]
            status=('exact-match' if any(h['name'].replace(' ','').casefold()==q.casefold() for h in hits) else 'regional-prefix-alias') if hits else 'no-exact-match-in-response'
        else:
            result=data.get('RESULT',{})
            status='not-returned' if result.get('CODE')=='INFO-200' else 'unverified:'+result.get('CODE','unknown')
            hits=[]
        return {'requested':n,'query':q,'status':status,'matches':hits,'source':url}
    except Exception as e:return {'requested':n,'query':q,'status':'unverified:'+str(e),'matches':[],'source':url}
if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=3) as ex: results=list(ex.map(check,names))
    (root/'neis-name-check.json').write_text(json.dumps({'checkedAt':'2026-09-16','scope':'Current exact names, regional-prefix aliases and BC school-name bases; no absence guarantee','results':results},ensure_ascii=False,indent=2))
    print('Entries',len(names),'internal duplicates',len(names)-len(set(names)))
    for r in results:
        if r['matches'] or r['status'].startswith('unverified'):print(r['requested'],r['status'],r['matches'])
