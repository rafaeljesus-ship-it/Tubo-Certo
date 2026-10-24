#!/usr/bin/env python3
"""Gera dist/tubo-certo.html: o jogo inteiro em um único arquivo (CSS, JS, fontes e imagens embutidos).
Uso: python3 tools/build-single.py   (na raiz do projeto)"""
import base64, re, os
def b64(path, mime): return f"data:{mime};base64," + base64.b64encode(open(path, 'rb').read()).decode()
css = open('css/style.css').read()
for f, m in [('fonts/LilitaOne-400.ttf', 'font/ttf'), ('fonts/Nunito-700.ttf', 'font/ttf'), ('fonts/Nunito-800.ttf', 'font/ttf'),
             ('fonts/Nunito-900.ttf', 'font/ttf'), ('assets/cenario-oficina.jpg', 'image/jpeg')]:
    css = css.replace('../' + f, b64(f, m))
js = open('js/engine.js').read() + '\n' + open('js/game.js').read()
consts = ''
for n, k in {'tube-glass': 'G', 'tube-selected': 'S', 'tube-valid': 'V', 'tube-complete': 'C'}.items():
    consts += f"var SVG_{k} = '{b64('tubo_certo_assets/adaptados/' + n + '.svg', 'image/svg+xml')}';\n"
    js = js.replace(f"KIT + '{n}.svg\"", f"SVG_{k} + '\"")
js = js.replace("  var KIT = 'tubo_certo_assets/adaptados/';\n", '')
js = js.replace("['tube-glass', 'tube-selected', 'tube-valid', 'tube-complete'].forEach(function (n) { new Image().src = KIT + n + '.svg'; });",
                "[SVG_G, SVG_S, SVG_V, SVG_C].forEach(function (u) { new Image().src = u; });")
assert 'KIT' not in js
html = open('index.html').read()
html = re.sub(r'<link rel="stylesheet" href="css/style.css[^"]*">', lambda m: '<style>\n' + css + '\n</style>', html)
html = re.sub(r'<script src="js/engine.js[^"]*"></script>\s*<script src="js/game.js[^"]*"></script>', lambda m: '<script>\n' + consts + js + '\n</script>', html)
html = html.replace('assets/cenario-oficina.jpg', b64('assets/cenario-oficina.jpg', 'image/jpeg'))
for f in os.listdir('assets/mascotes'):
    html = re.sub(r'assets/mascotes/' + re.escape(f) + r'(\?v=\d+)?', lambda m, f=f: b64('assets/mascotes/' + f, 'image/png'), html)
assert 'href="css/' not in html and 'src="js/' not in html and 'src="assets' not in html and 'url(../' not in html
os.makedirs('dist', exist_ok=True)
open('dist/tubo-certo.html', 'w').write(html)
print(f'dist/tubo-certo.html: {len(html) // 1024} KB')
