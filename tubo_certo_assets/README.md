# Tubo Certo — kit de assets de gameplay

Este pacote contém assets vetoriais SVG separados para implementar a interface do jogo. Os SVGs têm fundo transparente e escalam sem perder nitidez.

## Conteúdo
- `tubes/tube-glass-overlay.svg`: camada superior do tubo de vidro; posicione sobre as camadas coloridas.
- `tubes/tube-selected-overlay.svg`: aro luminoso para seleção.
- `tubes/tube-complete-overlay.svg`: brilho de tubo concluído.
- `tubes/tube-locked-overlay.svg`: sobreposição de bloqueio.
- `blocks/block-*.svg`: quadradinhos brilhantes da paleta.
- `blocks/tube-segment-template.svg`: modelo visual de uma camada colorida horizontal.
- `preview.html`: catálogo visual e demonstração local.
- `reference/mockup-original.png`: mockup de referência, não usar como tela final.
- `PROMPT_CLAUDE_CODE.txt`: instruções para integrar o kit no jogo existente.

## Como usar
1. Extraia o ZIP dentro do projeto ou copie a pasta `tubo_certo_assets` para o repositório.
2. Abra `preview.html` no navegador para revisar os assets.
3. Cole o conteúdo de `PROMPT_CLAUDE_CODE.txt` no Claude Code.
4. Peça para implementar os elementos reais no código atual e validar a lógica do jogo.

## Importante
O kit oferece peças visuais separadas, não um jogo completo. O Claude Code ainda deve integrá-las ao HTML/CSS/JS existente, mantendo a lógica atual. A proporção final pode precisar de ajustes conforme a estrutura do projeto.
