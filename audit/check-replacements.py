import importlib.util,json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('checker',root/'check-neis.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ren=json.loads((root/'renames.json').read_text())['names']
names=[n for n in ren.values() if n.endswith(('고','BC'))]
with ThreadPoolExecutor(max_workers=3) as ex:rows=list(ex.map(m.check,names))
(root/'replacement-check.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for r in rows:
 if r['matches'] or r['status'].startswith('unverified'):print(r)
print('Checked',len(rows),'replacements; exact/alias collisions',sum(bool(r['matches']) for r in rows))
assert not any(r['matches'] for r in rows)
