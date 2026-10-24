#!/usr/bin/env python3
"""Monta app-www/: só o que o app Android precisa (sem referências, backups, testes nem arte antiga).
Uso: npm run build:app   (ou: python3 tools/build-app.py, depois: npx cap sync android)"""
import os, re, shutil
OUT = 'app-www'
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)
for d in ('css', 'js', 'fonts', 'assets/jogo', 'assets/personagens'):
    shutil.copytree(d, os.path.join(OUT, d))
shutil.copy('assets/cenario-oficina.jpg', os.path.join(OUT, 'assets'))
shutil.copy('index.html', OUT)
shutil.copy('privacidade.html', OUT)
# o app não precisa do HTML de arquivo único nem de mapas de código
for root, _, files in os.walk(OUT):
    for f in files:
        if f.endswith('.map'):
            os.remove(os.path.join(root, f))
size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
print(f'{OUT}/ pronto: {size // 1024} KB')
# confere que todo caminho local citado existe
html = open('index.html').read() + open('css/style.css').read() + open('js/game.js').read()
missing = [p for p in set(re.findall(r"(?:assets|fonts|css|js)/[\w./-]+\.(?:png|jpg|svg|ttf|js|css)", html)) if not os.path.exists(os.path.join(OUT, p)) and '../' not in p]
print('arquivos citados e ausentes:', missing or 'nenhum')
