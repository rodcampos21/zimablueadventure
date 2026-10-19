# Gera dist/zima.html: o jogo inteiro num único arquivo (sprites embutidos), para compartilhar ou hospedar.
# Uso: python3 tools/build.py
import base64, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

html = read('index.html')
css = read('css/style.css')
html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css}\n</style>')
html = re.sub(r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n?', '', html)

png = base64.b64encode(open(os.path.join(ROOT, 'assets/zima.png'), 'rb').read()).decode()

def inline(m):
    src = m.group(1)
    js = read(src)
    if src == 'js/atlas.js':
        js = js.replace('"image":"assets/zima.png"', f'"image":"data:image/png;base64,{png}"')
    return f'<script>\n{js}\n</script>'

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
# trilhas de música embutidas (o arquivo único não depende da pasta assets/)
b64 = lambda p: base64.b64encode(open(os.path.join(ROOT, p), 'rb').read()).decode()
tracks = '{ menu: "data:audio/mpeg;base64,%s", town: "data:audio/mpeg;base64,%s", boss: "data:audio/mpeg;base64,%s" }' % (
    b64('assets/audio/menu.mp3'), b64('assets/audio/exploracao.mp3'), b64('assets/audio/chefe.mp3'))
png64 = lambda n: 'data:image/png;base64,' + b64(f'assets/portraits/{n}.png')
portraits = '{ %s }' % ', '.join(f'{who}: ["{png64(n + "_card")}", "{png64(n + "_face")}"]' for who, n in [('Zima', 'zima'), ('Julius', 'julius'), ('Thyberius', 'thyberius')])
html = html.replace('<script>\n// Gerado por tools/pack.py', f'<script>window.ZIMA_TRACKS = {tracks}; window.ZIMA_PORTRAITS = {portraits};</script>\n<script>\n// Gerado por tools/pack.py', 1)
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist/zima.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html) / 1024), 'KB')
