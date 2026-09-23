"""Build and package a release into dist/: a standalone HTML file plus a source zip with SHA-256 manifest.

Run the test suites first (npm test, npm run test:browser); this script only checks their saved logs.
"""
from pathlib import Path
import hashlib, json, zipfile

import build

ROOT = Path(__file__).resolve().parent
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
DIST = ROOT / 'dist'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    build.build()
    core_log = (ROOT / 'tests/v06-core-results.txt').read_text()
    assert '# fail 0' in core_log, 'unit tests have not passed'
    browser = json.loads((ROOT / 'tests/v06-browser-results.json').read_text())
    assert browser and all(not x['errors'] and x['seasons'] == 5 and x['exportImport'] for x in browser)
    demo = json.loads((ROOT / 'examples/demo-five-seasons.json').read_text())
    assert demo['format'] == 'draft-room-save' and demo['seasons'] == 5

    files = ['index.html', 'README.md', 'CHANGELOG.md', 'QA.md', 'build.py', 'release.py', 'package.json',
             'package-lock.json', 'examples/demo-five-seasons.json']
    files += sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'src').rglob('*') if p.is_file())
    # Test sources, fixtures and result logs; not screenshots, scratch output or downloaded saves.
    files += sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'tests').rglob('*') if p.is_file()
                    and not any(part.startswith(('screenshots', 'tmp')) for part in p.relative_to(ROOT / 'tests').parts)
                    and not p.name.endswith('-save.json'))
    files += sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'docs').rglob('*') if p.is_file())
    manifest = {'release': VERSION, 'files': {f: sha((ROOT / f).read_bytes()) for f in files}}

    DIST.mkdir(exist_ok=True)
    html = DIST / f'DRAFT-ROOM-{VERSION}.html'
    html.write_bytes((ROOT / 'index.html').read_bytes())
    zip_path = DIST / f'kbo-draft-room-{VERSION}.zip'
    prefix = f'kbo-draft-room-{VERSION}/'
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(ROOT / f, prefix + f)
        z.writestr(prefix + 'build-manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    with zipfile.ZipFile(zip_path) as z:
        assert z.testzip() is None
        for f, h in manifest['files'].items():
            assert sha(z.read(prefix + f)) == h, f
    print(json.dumps({'html': str(html.relative_to(ROOT)), 'zip': str(zip_path.relative_to(ROOT)),
                      'files': len(files), 'htmlSha256': sha(html.read_bytes())}, indent=2))


if __name__ == '__main__':
    main()
