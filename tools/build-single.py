#!/usr/bin/env python3
"""Gera dist/tubo-certo.html: o jogo inteiro em um único arquivo (CSS, JS, fontes e imagens embutidos).
Uso: python3 tools/build-single.py   (na raiz do projeto)"""
import base64, re, os
def b64(path, mime): return f"data:{mime};base64," + base64.b64encode(open(path, 'rb').read()).decode()
css = open('css/style.css').read()
for f, m in [('fonts/LilitaOne-400.ttf', 'font/ttf'), ('fonts/Nunito-700.ttf', 'font/ttf'), ('fonts/Nunito-800.ttf', 'font/ttf'),
             ('fonts/Nunito-900.ttf', 'font/ttf'), ('assets/cenario-oficina.jpg', 'image/jpeg')]:
    css = css.replace('../' + f, b64(f, m))
js = '\n'.join(open('js/' + f).read() for f in ('config.js', 'platform.js', 'engine.js', 'game.js'))
# arte do jogo (assets/jogo/*): troca cada caminho por data URI
art = {}
for f in sorted(os.listdir('assets/jogo')):
    mime = 'image/svg+xml' if f.endswith('.svg') else 'image/png'
    art[f] = b64('assets/jogo/' + f, mime)
for f, uri in art.items():
    js = js.replace("'assets/jogo/" + f + "'", "'" + uri + "'")
js = js.replace("function pieceUrl(name) { return 'assets/jogo/peca-' + name + '.png'; }",
                "var PIECES = {" + ",".join("'%s':'%s'" % (f[5:-4], u) for f, u in art.items() if f.startswith('peca-')) + "};\n  function pieceUrl(name) { return PIECES[name]; }")
consts = ''
import json
chars = {f[:-4]: b64('assets/personagens/' + f, 'image/png') for f in os.listdir('assets/personagens')}
js = js.replace("function charUrl(n) { return 'assets/personagens/' + n + '.png'; }", 'var CHARS = ' + json.dumps(chars) + ';\n  function charUrl(n) { return CHARS[n]; }')
assert "'assets/jogo/" not in js and 'assets/jogo/peca-' not in js, 'sobrou caminho de arte'
# o CSS também referencia a prateleira via border-image
for _f in os.listdir('assets/personagens'):
    css = css.replace("../assets/personagens/" + _f, b64('assets/personagens/' + _f, 'image/png'))
css = css.replace("url('../assets/jogo/prateleira.png')", "url('" + art['prateleira.png'] + "')")
html = open('index.html').read()
html = re.sub(r'<link rel="stylesheet" href="css/style.css[^"]*">', lambda m: '<style>\n' + css + '\n</style>', html)
html = re.sub(r'<script src="js/config.js[^"]*"></script>\s*<script src="js/platform.js[^"]*"></script>\s*<script src="js/engine.js[^"]*"></script>\s*<script src="js/game.js[^"]*"></script>', lambda m: '<script>\n' + js + '\n</script>', html)
html = html.replace('assets/cenario-oficina.jpg', b64('assets/cenario-oficina.jpg', 'image/jpeg'))
for d in ('assets/mascotes', 'assets/personagens'):
    for f in os.listdir(d):
        html = re.sub(re.escape(d + '/' + f) + r'(\?v=\d+)?', lambda m, d=d, f=f: b64(d + '/' + f, 'image/png'), html)

assert 'href="css/' not in html and 'src="js/' not in html and 'src="assets' not in html and 'url(../' not in html
os.makedirs('dist', exist_ok=True)
open('dist/tubo-certo.html', 'w').write(html)
print(f'dist/tubo-certo.html: {len(html) // 1024} KB')
