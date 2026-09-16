"""Current public NEIS register check for the user's newly renamed high schools.
A not-returned result is not proof of nonexistence. BCs and universities are outside this endpoint.
"""
import importlib.util,json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('neis',root/'check-neis.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
approved=json.loads((root/'user-renames-v031.json').read_text())
old=json.loads((root/'renames.json').read_text())['names']
names=[n for orig,n in approved['names'].items() if n!=old.get(orig,orig) and n.endswith(('고','BC'))]
with ThreadPoolExecutor(max_workers=3) as ex:rows=list(ex.map(m.check,names))
report={'checkedAt':'2026-09-16','scope':'NEIS current exact school names and suffix-based regional-prefix aliases. BC outside register. No absence guarantee.','results':rows,'overseasNameCheck':{'name':'미국 롱아일랜드하버대','query':'"Long Island Harbor University" "롱아일랜드하버대"','status':'검색 결과에서 동일 전체 명칭 미확인; 실존하지 않음을 보장하지 않음','nearbyRealInstitution':'Long Island University (LIU) — not the fictional Harbor name','source':'https://www.liu.edu/'}}
(root/'user-name-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Reviewed',len(rows),'high-school/club changed names')
for r in rows:
 if r['matches'] or r['status'].startswith('unverified'):print(r)
print('Exact/alias matches:',sum(bool(r['matches']) for r in rows))
