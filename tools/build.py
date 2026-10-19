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
mp3 = base64.b64encode(open(os.path.join(ROOT, 'assets/audio/menu.mp3'), 'rb').read()).decode()
html = html.replace('<script>\n// Gerado por tools/pack.py', f'<script>window.ZIMA_TRACKS = {{ menu: "data:audio/mpeg;base64,{mp3}" }};</script>\n<script>\n// Gerado por tools/pack.py', 1)
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist/zima.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html) / 1024), 'KB')
