"""Verify the tested Spotlight source/bundle and package a standalone release. Never touches other builds."""
from pathlib import Path
from html.parser import HTMLParser
import argparse,ast,hashlib,json,re,zipfile
p=argparse.ArgumentParser();p.add_argument('--artifact');args=p.parse_args()
root=Path(__file__).resolve().parents[1]
sha=lambda data:hashlib.sha256(data).hexdigest()
html=(root/'index.html').read_bytes();text=html.decode('utf-8')
assert 'BUILD 0.4' in text and 'draft-room-kbo-v4-spotlight' in text
assert 'VERSION=4,ROUNDS=5,POOL_SIZE=200' in text and 'ROUNDS=7' not in text
assert '/* INLINE_' not in text
# Independently replay the build mapping without overwriting the already-tested bundle.
tree=ast.parse((root/'build.py').read_text());files=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='files' for t in n.targets))
expected=(root/'src/template.html').read_text()
for marker,name in files.items():
 token='/* '+marker+' */';assert expected.count(token)==1;expected=expected.replace(token,(root/'src'/name).read_text())
assert expected.encode()==html,'Source differs from tested HTML'
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.scripts=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script':self.scripts+=1;assert not a.get('src')
  if tag=='link':assert a.get('rel')!='stylesheet'
parser=Parser();parser.feed(text);assert parser.scripts==12,parser.scripts
logs=(root/'tests/test-results.txt').read_text();assert re.search(r'fail 0\b',logs);count=int(re.search(r'tests (\d+)',logs)[1]);assert count==22
for key in ['cancelled','skipped']:assert re.search(key+r' 0\b',logs)
browser=(root/'tests/browser-results.txt').read_text();assert 'PASS 99 layout checks; no document overflow; no browser JS errors.' in browser;assert len(re.findall(r'PASS (?:390|768|1280)px',browser))==9
balance=json.loads((root/'tests/balance-results.json').read_text());assert balance['drafts']==600 and balance['picks']==33000
assert 'PASS all three difficulty balance checks.' in (root/'tests/balance-results.txt').read_text()
prior={}
for folder,expected_hash in [('kbo-draft-v0.3','4848c38208340366e5e46b8254a9db88eaeefd026d72b55db705f0e3d79098ee'),('kbo-draft-v0.3.1','b9c1dcba487f4282256356e1ea20119b55a72a263a4d7a178426c4c982865ee1')]:
 file=root.parent/folder/'index.html'
 if file.exists():prior[folder]=sha(file.read_bytes());assert prior[folder]==expected_hash,folder+' changed'
old_season=root.parent/'kbo-draft-v0.3.1/src/season.js'
if old_season.exists():assert old_season.read_bytes()==(root/'src/season.js').read_bytes(),'Physical rookie model changed'
if args.artifact:assert Path(args.artifact).read_bytes()==html,'Published artifact differs from tested bundle'
manifest={'version':'0.4.0','variant':'spotlight-five-round','saveKey':'draft-room-kbo-v4-spotlight','rounds':5,'poolSize':200,'htmlBytes':len(html),'htmlSha256':sha(html),'inlineScripts':12,'unitAndDomTests':count,'fullEngineFlows':60,'browserRuns':9,'browserWidths':[390,768,1280],'layoutChecks':99,'draftSimulations':600,'simulatedPicks':33000,'physicalPoolReferenceHashes':50,'previousBuildHashes':prior,'sourceHashes':{str(f.relative_to(root)):sha(f.read_bytes()) for f in sorted((root/'src').glob('*')) if f.is_file()},'checkedAt':'2026-09-16'}
(root/'build-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
archive=root.parent/(root.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in sorted(root.rglob('*')):
  if f.is_file() and not any(part in {'screenshots','node_modules','__pycache__'} for part in f.parts) and f.suffix!='.pyc':z.write(f,arcname=str(f.relative_to(root.parent)))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert z.read(root.name+'/index.html')==html
 for name in ['README.md','QA.md','src/rules04.js','src/press.js','src/view04.js','tests/core.test.cjs','audit/user-renames-v031.json']:assert root.name+'/'+name in z.namelist()
 print('ZIP verified:',len(z.namelist()),'files;',archive.stat().st_size,'bytes')
print(json.dumps({k:v for k,v in manifest.items() if k!='sourceHashes'},ensure_ascii=False,indent=2))
print('PASS: source equals tested HTML; 12 inline scripts; all logs pass; old builds unchanged where available; ZIP CRC passes; artifact equality checked when supplied.')
