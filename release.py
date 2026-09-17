"""Package V0.6 source and already-verified HTML without old artifacts or dependencies."""
from pathlib import Path
import hashlib, json, shutil, zipfile
root=Path(__file__).resolve().parent
log=(root/'tests/v06-core-results.txt').read_text()
assert 'tests 21' in log and 'fail 0' in log
balance=json.loads((root/'tests/v06-balance-results.json').read_text())
browser=json.loads((root/'tests/v06-browser-results.json').read_text())
assert balance['drafts']==600
assert len(browser)==4 and all(not x['errors'] and x['seasons']==5 and x['exportImport'] for x in browser)
(root/'examples').mkdir(exist_ok=True)
browser_save=root/'tests/desktop-normal-on-save.json'
example=root/'examples/demo-v06-five-seasons.json'
# A source ZIP includes the validated example but not temporary browser downloads.
if browser_save.is_file():shutil.copyfile(browser_save,example)
assert example.is_file(), 'The validated V0.6 example save is missing.'
demo=json.loads(example.read_text())
assert demo.get('format')=='draft-room-v06' and demo.get('version')==6
assert len(demo['game']['career']['years'])==5
paths=[root/n for n in ['index.html','README.md','QA.md','CHANGELOG.md','build.py','release.py','package.json','package-lock.json','examples/demo-v06-five-seasons.json']]
paths+=sorted(p for p in (root/'src').iterdir() if p.is_file())
paths+=sorted(p for p in (root/'tests').glob('v06*') if p.is_file())
assert all(p.is_file() for p in paths)
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest={'release':'0.6.0','name':'Read the Player','automatedTests':21,'fullFlowCombinations':60,'balanceDrafts':600,'playerSeasons':225000,'chromiumViewports':4,'files':{str(p.relative_to(root)):sha(p.read_bytes()) for p in paths}}
mp=root/'build-manifest.json';mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');paths.append(mp)
standalone=root.parent/'DRAFT-ROOM-V0.6.html';shutil.copyfile(root/'index.html',standalone)
zp=root.parent/'kbo-draft-v0.6-scouting.zip'
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in paths:z.write(p,str(Path(root.name)/p.relative_to(root)))
with zipfile.ZipFile(zp) as z:
    assert z.testzip() is None
    assert z.read(root.name+'/index.html')==standalone.read_bytes()
    for p,h in manifest['files'].items():assert sha(z.read(root.name+'/'+p))==h
print(json.dumps({'zip':zp.name,'zipBytes':zp.stat().st_size,'html':standalone.name,'htmlBytes':standalone.stat().st_size,'sha256':sha(standalone.read_bytes()),'files':len(paths),'verified':True},indent=2))
