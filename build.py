"""Bundle src/ into one dependency-free index.html that runs offline from file://."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'

STYLES = ['styles/main.css']
# Load order matters: each module reads the globals registered by the ones before it.
SCRIPTS = [
    'core/tuning.js', 'core/clubs.js', 'core/catalog.js', 'core/ko.js', 'core/names.js', 'core/biography.js',
    'core/grades.js', 'core/writer.js', 'core/prospects.js', 'core/scouting.js', 'core/season.js', 'core/draft-ai.js',
    'core/press.js', 'core/career.js', 'core/voices.js', 'core/engine.js',
    'ui/format.js', 'ui/setup.js', 'ui/pregame.js', 'ui/draft.js', 'ui/signing.js', 'ui/postdraft.js', 'ui/career.js',
    'ui/dialogs.js', 'ui/app.js',
]


def read(name):
    text = (SRC / name).read_text(encoding='utf-8')
    # Inlined code must not close its own <script>/<style> element early.
    assert name.endswith('.html') or ('</script' not in text.lower() and '</style' not in text.lower()), name
    return text


def build():
    html = read('template.html')
    for marker, block in [
        ('/* BUILD:STYLES */', '\n'.join(read(n) for n in STYLES)),
        ('<!-- BUILD:SCRIPTS -->', '\n'.join(f'<script>\n{read(n)}</script>' for n in SCRIPTS)),
    ]:
        assert html.count(marker) == 1, marker
        html = html.replace(marker, block)
    (ROOT / 'index.html').write_text(html, encoding='utf-8')
    print(f'Built index.html: {len(html.encode("utf-8")):,} bytes')


if __name__ == '__main__':
    build()
