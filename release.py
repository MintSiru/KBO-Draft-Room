"""Package a verified, dependency-free release; omit development caches and old v0.4 test logs."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parent
paths = [root / n for n in ['index.html','README.md','QA.md','CHANGELOG.md','build.py','release.py','package.json','package-lock.json']]
paths += [p for p in (root / 'src').glob('*') if p.is_file()]
paths += [p for p in (root / 'audit').glob('*') if p.is_file()]
paths += [p for p in (root / 'tests').glob('v05*') if p.is_file()]
paths += [root / 'tests/make-demo.cjs']
paths += list((root / 'examples').glob('*.json'))
assert all(p.is_file() for p in paths)
assert 'tests 14' in (root / 'tests/v05-test-results.txt').read_text()
assert 'fail 0' in (root / 'tests/v05-test-results.txt').read_text()
balance = json.loads((root / 'tests/v05-balance-results.json').read_text())
browser = json.loads((root / 'tests/v05-browser-results.json').read_text())
assert balance['drafts'] == 600
assert len(browser) == 3 and all(not x['errors'] and x['seasons'] == 5 and x['exportImport'] for x in browser)
manifest = {'release':'0.5.0','name':'Five Years Later','seasons':5,'nationalRounds':7,'tests':{'automated':14,'flowCombinations':60,'balanceDrafts':600,'playerSeasons':225000,'chromiumViewports':3},'files':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}}
manifest_path = root / 'build-manifest.json'
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
paths.append(manifest_path)
zip_path = root.parent / 'kbo-draft-v0.5-five-years.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(paths):
        z.write(p, str(Path(root.name) / p.relative_to(root)))
standalone = root.parent / 'DRAFT-ROOM-V0.5.html'
shutil.copyfile(root/'index.html',standalone)
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    assert z.read(root.name+'/index.html') == standalone.read_bytes()
    for name,sha in manifest['files'].items():
        assert hashlib.sha256(z.read(root.name+'/'+name)).hexdigest() == sha
print(json.dumps({'zip':zip_path.name,'zipBytes':zip_path.stat().st_size,'html':standalone.name,'htmlBytes':standalone.stat().st_size,'files':len(paths),'sha256':hashlib.sha256(standalone.read_bytes()).hexdigest(),'verified':True},indent=2))
