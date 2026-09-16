"""Bundle the editable v0.4 sources into a dependency-free, offline HTML file."""
from pathlib import Path
root = Path(__file__).resolve().parent
src = root / 'src'
html = (src / 'template.html').read_text(encoding='utf-8')
files = {'INLINE_STYLE':'style.css', 'INLINE_V02_STYLE':'v02.css', 'INLINE_V03_STYLE':'v03.css', 'INLINE_V04_STYLE':'v04.css', 'INLINE_RULES04':'rules04.js', 'INLINE_PRESS':'press.js', 'INLINE_VIEW04':'view04.js', 'INLINE_CLUBS':'clubs.js', 'INLINE_CATALOG':'catalog.js', 'INLINE_KO':'ko.js', 'INLINE_NAMES':'names.js', 'INLINE_BIO':'biography.js', 'INLINE_DATA':'data.js', 'INLINE_SEASON':'season.js', 'INLINE_ENGINE':'engine.js', 'INLINE_APP':'app.js'}
for marker, filename in files.items():
    token = f'/* {marker} */'
    assert html.count(token) == 1, marker
    html = html.replace(token, (src / filename).read_text(encoding='utf-8'))
(root / 'index.html').write_text(html, encoding='utf-8')
print(f'Built index.html: {len(html.encode("utf-8")):,} bytes')
