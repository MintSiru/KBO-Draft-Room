"""Check the current catalog's high-school names against the public NEIS school register.

Read-only, no API key, no personal data. Needs network access to open.neis.go.kr.
An exact match means a real school already uses the name; "no match" is not proof of absence.
Usage: python3 audit/check-catalog-neis.py
"""
import json, subprocess, time, urllib.parse, urllib.request
from pathlib import Path

root = Path(__file__).resolve().parent.parent
catalog = json.loads(subprocess.run(
    ['node', '-e', "console.log(JSON.stringify(require('./src/core/catalog.js').institutions))"],
    cwd=root, capture_output=True, text=True, check=True).stdout)


def full_name(name):
    if name.endswith('공고'): return name[:-2] + '공업고등학교'
    if name.endswith('상고'): return name[:-2] + '상업고등학교'
    if name.endswith('고'): return name[:-1] + '고등학교'
    return None  # clubs (BC) are not in the school register


real = []
for x in catalog:
    query = full_name(x['name']) if x['kind'] == 'high-school' else None
    if not query:
        continue
    url = 'https://open.neis.go.kr/hub/schoolInfo?' + urllib.parse.urlencode({'Type': 'json', 'SCHUL_NM': query})
    data = json.loads(urllib.request.urlopen(url, timeout=25).read())
    rows = data.get('schoolInfo', [{}, {'row': []}])[1]['row']
    hits = [f"{r['SCHUL_NM']} ({r['LCTN_SC_NM']})" for r in rows if r['SCHUL_NM'].replace(' ', '') == query]
    if hits:
        real.append((x['id'], x['name'], hits))
    time.sleep(0.25)

for id_, name, hits in real:
    print(f'{id_}\t{name}\t-> {", ".join(hits)}')
print(f'{len(real)} exact matches with real schools')
