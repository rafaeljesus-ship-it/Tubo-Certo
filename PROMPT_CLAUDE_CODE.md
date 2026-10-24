# Prompt para Claude Code — Tubo Certo

Trabalhe diretamente neste projeto e transforme o jogo atual para ficar o mais fiel possível ao mockup em `referencias/mockup-completo-original.jpg`. Use os recortes em `referencias/telas/` como referência individual para cada tela.

## Antes de editar
1. Inspecione `index.html`, os backups em `codigo/` e todos os arquivos de `assets/`.
2. Faça uma cópia de segurança antes de alterar.
3. Identifique a lógica atual do puzzle, a navegação, os estados, moedas, vidas, reforços e persistência.
4. Verifique a transparência real dos PNGs dos mascotes.

## Objetivo visual
Reproduza a linguagem visual do mockup: jogo mobile de quadrinhos vintage dos anos 1930, oficina ilustrada, textura de papel, contornos pretos espessos, sombras deslocadas, botões amarelos/vermelhos/verdes, painéis creme e mascotes tubulares sem olhos.

## Dez telas a implementar e validar
1. Tela inicial.
2. Seleção de fases.
3. Puzzle em andamento.
4. Vitória.
5. Derrota.
6. Loja de moedas.
7. Vidas.
8. Power-ups.
9. Configurações.
10. Ranking.

## Regras obrigatórias
- Edite o projeto existente; não crie um protótipo paralelo.
- Preserve a lógica do jogo e todos os comportamentos que já funcionam.
- Corrija os mascotes para que não apareçam em retângulos escuros ou com fundos indesejados.
- Use `assets/` para os elementos gráficos individuais quando apropriado.
- Não use as capturas completas como fundos de telas funcionais: elas são referências, não assets finais de interface.
- Não use emojis como substitutos das ilustrações.
- Não deixe textos cortados, componentes sobrepostos ou áreas de toque inacessíveis.
- Adapte o layout para celular e telas maiores.
- Todas as telas e botões devem estar conectados à navegação real.
- Não simule compras reais sem infraestrutura de pagamento.
- Não afirme que um teste foi executado se ele não tiver sido executado.

## Validação
Execute o projeto em navegador quando possível. Teste a navegação, seleção de fases, movimentos do puzzle, vitória/derrota, moedas, vidas e reforços. Compare cada tela com a referência e faça ajustes visuais iterativos. Ao final, informe arquivos alterados, testes executados e limitações restantes.

Comece inspecionando o projeto e implemente as melhorias diretamente em `index.html`.
