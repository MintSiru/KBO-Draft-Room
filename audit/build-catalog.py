"""Generate the game's fictional institution catalog and transparent rename report."""
from pathlib import Path
import json,csv
root=Path(__file__).resolve().parent
req=json.loads((root/'requested-catalog.json').read_text())
ren=json.loads((root/'renames.json').read_text())
checks=json.loads((root/'neis-name-check.json').read_text())['results']
checkmap={r['requested']:r for r in checks}
approved=json.loads((root/'user-renames-v031.json').read_text())
rename={**ren['names'],**approved['names']}; rows=[]; out=[]
user_checks=json.loads((root/'user-name-check.json').read_text())
user_checkmap={r['requested']:r for r in user_checks['results']}
for tier,regions in req['highSchools'].items():
 for region,names in regions.items():
  for name in names:
   changed=rename.get(name,name);i=len(out)
   out.append(dict(id=f'hs{i:03}',name=changed,original=name,region=region,tier=tier,kind='hs-club' if changed.endswith('BC') else 'high-school',country='대한민국'))
college_regions=['서울','서울','경기·강원','대구·경북','인천','경남','부산·울산','경기·강원','대전·충청·전북','광주·전남·제주','대전·충청·전북','인천','광주·전남·제주','서울','경기·강원','대전·충청·전북']
k=0
for tier,names in req['colleges'].items():
 for name in names:
  out.append(dict(id=f'uni{k:02}',name=rename.get(name,name),original=name,region=college_regions[k],tier=tier,kind='college',country='대한민국'));k+=1
for i,name in enumerate(req['independents']):out.append(dict(id=f'ind{i:02}',name=name,original=name,region='경기·강원',tier=None,kind='independent',country='대한민국'))
for i,name in enumerate(req['overseas']):out.append(dict(id=f'ov{i:02}',name=rename.get(name,name),original=name,region=None,tier=None,kind='overseas-college',country=name.split()[0],weight=15 if i<6 else 2,academicStartMonth=9 if i<6 else 4 if name.startswith('일본') else 9,academicEndMonth=3 if name.startswith('일본') else 6))
assert set(approved['names']).issubset({x['original'] for x in out})
assert len({x['id'] for x in out})==len(out)
assert len({x['name'] for x in out})==len(out)
missing=[r['requested'] for r in checks if r['matches'] and r['requested'] not in rename]
assert not missing,missing
js='/* User-approved v0.3.1 names. Stable IDs preserve seeded players; school types follow applied names. */\n(function(root){\nconst institutions='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\nconst api={institutions,byId:Object.fromEntries(institutions.map(x=>[x.id,x]))};\nroot.DraftCatalog=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;\n})(typeof window!=="undefined"?window:globalThis);\n'
(root.parent/'src/catalog.js').write_text(js)
other={r['name']:r for r in ren['otherEvidence']}
for inst in out:
 name=inst['original'];audit=checkmap.get(name);ev=other.get(name)
 previous=ren['names'].get(name,name)
 changed=previous!=inst['name']
 current_check=user_checkmap.get(inst['name'])
 reason=('사용자 지정: 고교에서 고교 연령 BC로 변경' if name in approved['highSchoolToClubOriginals'] else '사용자 최종 지정 이름') if changed else 'v0.3 이름 유지'
 scope=current_check['status'] if current_check else ('해외 전체 명칭 웹 검색에서 동일명 미확인; 부재 보장 아님' if name=='미국 포틀랜드대' else '이번 수정판의 NEIS 학교명 확인 대상 외' if changed else 'v0.3 확인 범위 유지')
 rows.append({'소속 ID':inst['id'],'종류':inst['kind'],'지역':inst['region'] or inst['country'],'야구부 평판':inst['tier'] or '미분류','최초 요청 이름':name,'v0.3 이름':previous,'적용 이름':inst['name'],'변경 사유':reason,'이번 확인 범위':scope,'이번 확인 출처':current_check.get('source','NEIS 학교정보 대상 외') if current_check else 'user-name-check.json' if name=='미국 포틀랜드대' else '사용자 수정안 / 이전 audit 기록','v0.3 수정 사유':ev['reason'] if ev else ('공개 학교 명칭 또는 지역 약칭과 충돌' if name in ren['names'] else '원안 유지')})
with (root/'name-changes.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
with (root/'v031-changes.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(r for r in rows if r['v0.3 이름']!=r['적용 이름'])
print('Catalog:',len(out),'institutions;',sum(x['name']!=ren['names'].get(x['original'],x['original']) for x in out),'changed vs v0.3;',sum(x['kind']=='hs-club' for x in out),'HS clubs')
