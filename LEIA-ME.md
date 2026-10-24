# Tubo Certo

Jogo mobile de puzzle (separar cores em tubos) em HTML/CSS/JS puro, sem build e sem framework.
Direção de arte: quadrinho vintage anos 1930 (contornos pretos grossos, papel creme, sombras desenhadas).

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```
python3 -m http.server 8123   # depois abra http://localhost:8123
```

`?teste=1` na URL ativa o **modo de teste**: os botões de compra em R$ creditam de graça (para testar a economia).
Sem esse parâmetro, as compras em dinheiro mostram um aviso de "pagamento indisponível" e **não creditam nada**.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | Estrutura das 10 telas + biblioteca de ícones SVG |
| `css/style.css` | Todo o visual (unidades `cqw` = % da largura do aparelho) |
| `js/engine.js` | Motor do puzzle (regras, gerador de fases, solver A*, dica) — sem DOM |
| `js/game.js` | Interface, navegação, moedas, vidas, reforços, ranking, configurações, áudio |
| `tubo_certo_assets/` | Kit visual de gameplay (SVG): vidro, estados selecionado/completo/bloqueado e blocos coloridos |
| `assets/cenario-oficina.jpg` | Cenário de fundo |
| `assets/mascotes/*.png` | Mascotes com **fundo transparente** (recortados do mockup) |
| `assets/jogo/` | Arte do gameplay gerada por IA: tubo, 10 peças, prateleira e estados (selecionado, válido, completo) |
| `assets/personagens/` | Mascotes (andando, vitória, derrota), estrela e baú gerados por IA, com fundo transparente |
| `assets/originais/` | Assets originais do pacote (mantidos como estavam; não são mais usados) |
| `fonts/` | Lilita One + Nunito (locais, funcionam offline) |
| `referencias/` | Mockup e as 10 telas de referência |
| `codigo/` | Backups do código anterior (`backup-pre-kit/` = arquivos antes da reformulação do gameplay) |
| `tests/e2e.js` | Teste ponta a ponta com Playwright |
| `js/config.js`, `js/platform.js` | IDs de produtos/anúncios e a camada de compras/anúncios (modos nativo, teste e web) |
| `native/`, `js/native-bridge.js` | Ponte para os plugins nativos do Capacitor (gerada com `npm run build:bridge`) |
| `android/`, `capacitor.config.json` | Projeto Android (abra com `npm run open:android`) |
| `loja/` | Ícone, imagem de destaque, prints e guia de publicação |
| `privacidade.html` | Política de privacidade (preencher os campos amarelos) |
| `tools/build-single.py` | Gera `dist/tubo-certo.html` (jogo em arquivo único) |

## Telas

1. Inicial · 2. Seleção de fases (3 páginas de 12, deslize ou toque nos pontos) · 3. Puzzle · 4. Vitória · 5. Derrota / sem vidas ·
6. Loja de moedas · 7. Vidas · 8. Reforços · 9. Configurações · 10. Ranking.

No puzzle: seta = voltar às fases, raio = tela de reforços, cartão de moedas = loja, cartão de vidas = tela de vidas.

## Regras e economia

- Fases 1–30; cores = fase + 2 (máx. 10). Toda fase é verificada como solúvel pelo solver.
- Meta = ótimo + 2 (3 estrelas). Passou do limite de movimentos → perde 1 vida.
- Reiniciar volta **ao mesmo tabuleiro** e não gasta vida.
- Vidas: máx. 5, 1 volta a cada 15 min. Também dá para trocar 80 moedas por 1 vida.
- Reforços: desfazer (grátis), dica (50, usa o solver), tubo extra (100, máx. 2 por fase).
- Baú de vitória: prêmio aleatório; sair sem abrir o baú credita o prêmio mesmo assim.
- Progresso em `localStorage` (chaves `tubo-certo-*`). "Apagar progresso" em Configurações.

## Testes

```
python3 -m http.server 8123 &
NODE_PATH=$(npm root -g) node tests/e2e.js /pasta/das/capturas
```

## Limitações conhecidas

- **Compras e anúncios**: implementados para o app Android (Google Play Billing + AdMob premiado) em `js/platform.js`, mas **ainda não testados em aparelho real nem contra a Play/AdMob**. No navegador ficam indisponíveis (nada é cobrado).
- **Sem validação de recibo em servidor**: a entrega é feita no aparelho.
- **Ranking removido do menu** (precisa de servidor); o código da tela continua no projeto.
- Guia completo para publicar: `loja/GUIA_PUBLICACAO.md`.
- Mascotes foram recortados do mockup por IA (resolução ~640 px de altura); podem ter pequenas imperfeições de borda.
- Música de fundo é procedural (WebAudio), simples; o navegador só libera áudio após o primeiro toque.

## Gameplay (kit de assets)

Os SVGs de `tubo_certo_assets/adaptados/` (vidro, selecionado, completo, movimento válido) são adaptações dos originais do kit: mesma proporção 140×380, contorno mais fino, aro metálico e estados novos. Os originais ficam intactos em `tubo_certo_assets/tubes/`.


Cada tubo é um `<button>` com camadas independentes: segmentos coloridos (SVG `<use>` da paleta do kit), `tube-glass-overlay.svg` por cima,
`tube-selected-overlay.svg` (selecionado) e `tube-complete-overlay.svg` (completo). `tube-locked-overlay.svg` está no kit, mas o jogo não tem tubo bloqueado, então não é usado.
O layout (`layoutFor` em `js/game.js`) mede a área de jogo real e escolhe 1–3 fileiras para maximizar o tamanho dos tubos.
