# Tubo Certo — guia para publicar na Google Play

O jogo já tem compras, anúncios premiados e o projeto Android prontos no código. **O que ficou sem teste:** nada disso foi rodado
em um celular real nem contra a Google Play/AdMob de verdade (o ambiente onde o código foi escrito não tem Android SDK).
Siga a ordem abaixo e **teste no aparelho antes de publicar**.

## 0. O que você precisa

| Item | Para quê |
|---|---|
| Conta de desenvolvedor Google Play (US$ 25, uma vez) | publicar. Contas pessoais novas precisam de **teste fechado com 12 testadores por 14 dias** antes de ir para produção |
| Conta Google AdMob (grátis) | anúncios |
| Android Studio instalado | gerar o `.aab` assinado |
| Node.js 20+ | montar o app |
| Um celular Android | testar |

## 1. Trocar os valores de teste (procure por "TROCAR")

1. `js/config.js`
   - `appId`: `br.com.tubocerto.jogo` (o mesmo em `capacitor.config.json`, `android/app/build.gradle` e `strings.xml`). **Não muda depois de publicar.**
   - `privacyUrl`: endereço público da política (ver passo 2).
   - `admob.real.rewarded`: ID do bloco de anúncio **Premiado** criado no AdMob.
   - `admob.real.interstitial`: ID do bloco **Intersticial** (o anúncio de tela cheia entre as fases).
   - `ads.interstitial`: quando aparece o anúncio entre fases (hoje: ao concluir cada fase a partir da 6ª, com intervalo mínimo de 45 s; `everyLevels: 2` mostra a cada 2 fases; `enabled: false` desliga).
   - `USE_TEST_ADS`: mude para `false` **só depois** de preencher o ID real. Com `true` aparecem anúncios de teste do Google (não pague nem clique em anúncios reais da própria conta: o AdMob suspende a conta por isso).
2. `android/app/src/main/res/values/strings.xml`: `admob_app_id` = ID do **aplicativo** no AdMob (`ca-app-pub-…~…`). Hoje está o ID de teste do Google.
3. `privacidade.html`: preencha seu nome/empresa, e-mail e data (os trechos amarelos tracejados).

## 2. Política de privacidade (obrigatória)

Publique `privacidade.html` num endereço público. Se você usa o GitHub Pages do repositório, ela fica em
`https://SEU-USUARIO.github.io/Tubo-Certo/privacidade.html`. Esse endereço vai em `privacyUrl` e no Play Console.

## 3. AdMob

1. Crie o app no AdMob (Android) → copie o **ID do app**.
2. Crie dois blocos de anúncios: **Premiado (rewarded)** e **Intersticial** → copie o **ID de cada bloco**.
3. Em *Privacidade e mensagens*, crie e publique a mensagem de consentimento (GDPR/UMP). O jogo já chama o formulário quando a lei exige.
4. Há dois tipos: os **premiados** (o jogador escolhe assistir: vidas, moedas, dobrar prêmio) e o **intersticial** que aparece ao sair da tela de "Nível concluído" (nunca no meio da partida nem ao abrir/fechar o app). A compra "Sem anúncios" remove só o intersticial; os premiados continuam.

## 4. Produtos de compra no Play Console

*Monetizar → Produtos → Produtos no app* (tipo **produto gerenciado / consumível**). Os IDs precisam ser exatamente estes:

| ID | Entrega | Preço sugerido (BRL) |
|---|---|---|
| `moedas_100` | 100 moedas | 4,90 |
| `moedas_500` | 500 moedas | 21,90 |
| `moedas_1200` | 1.200 moedas | 42,90 |
| `moedas_2500` | 2.500 moedas | 84,90 |
| `vida_1` | +1 vida | 2,90 |
| `vidas_5` | +5 vidas | 9,90 |
| `sem_anuncios` | tira os anúncios entre fases (**não consumível**: tipo "produto gerenciado" de compra única) | 14,90 |

O preço mostrado no jogo vem da loja (já em R$ e com impostos). Se mudar IDs, mude também `js/config.js`.
O `sem_anuncios` é **compra única**: o jogo a restaura sozinho ao abrir (mesma conta Google) e há o botão *Configurações → Restaurar compras* (a Google Play exige esse caminho de restauração).
Conta de **testador de licença** (Play Console → Configurações → Teste de licença) deixa você comprar sem ser cobrado.

## 5. Gerar o app

```bash
npm install
npm run sync            # monta app-www/ + js/native-bridge.js e copia para o projeto Android
npm run open:android    # abre o Android Studio
```

No Android Studio: *Build → Generate Signed Bundle / APK → Android App Bundle*. Crie a **chave de assinatura** e **guarde o arquivo
e as senhas em lugar seguro** (sem ela você não consegue atualizar o app). Envie o `.aab` gerado ao Play Console.
Sugestão: ative o *Play App Signing* (a Google guarda a chave final).

## 6. Material da loja (já gerado em `loja/`)

- `icone-512.png` — ícone do app (512×512)
- `imagem-destaque-1024x500.png` — imagem de destaque
- `prints/` — 5 capturas 1080×1920 (início, fases, jogo, vitória, recompensa)
- Textos de sugestão: ver abaixo.

**Nome:** Tubo Certo  **Descrição curta (até 80):** Separe as cores nos tubos neste quebra-cabeça retrô cheio de personalidade!

**Descrição completa (sugestão):**
> Tubo Certo é um quebra-cabeça de separar cores com visual de desenho animado dos anos 1930. Toque num tubo, despeje as cores em outro e junte cada cor no seu tubo. São 30 fases cada vez mais desafiadoras, com dicas, tubos extras e desfazer. Ganhe estrelas, abra baús e junte moedas. O jogo é grátis; há compras opcionais de moedas e vidas e anúncios opcionais para ganhar recompensas.

## 7. Formulários do Play Console

- **Anúncios:** o app **contém anúncios** (marque sim).
- **Segurança dos dados (Data safety):** declare coleta de *identificadores de dispositivo ou outros* (ID de publicidade) e *dados de interação com anúncios* pelo AdMob, para *publicidade*; compras são tratadas pela Google Play. Sem conta de usuário, sem dados enviados a servidores próprios.
- **Público-alvo:** escolha **13+** (ou 18+). Se escolher público que inclua crianças, entram regras extras de anúncios (Families Policy) e o AdMob precisa ser configurado para crianças.
- **Classificação indicativa:** questionário IARC; o jogo não tem violência, apostas nem conteúdo sensível. Comprar moedas/vidas é "compra no app".
- **ID de publicidade:** declare que o app usa (o AdMob usa). A permissão `AD_ID` já está no manifesto.

## 8. Teste antes de publicar (no celular)

1. Instale o `.aab` por *Teste interno* (Play Console → Testes → Teste interno).
2. Com conta de testador de licença: compre cada um dos 7 itens; confira que o item chega **uma vez** e que o preço aparece em R$.
3. Cancele uma compra no meio: nada deve ser creditado.
4. Assista a um anúncio premiado de teste até o fim (ganha) e feche antes (não ganha). Conclua a fase 6 e confira o intersticial de teste antes da fase 7; compre "Sem anúncios" e confira que ele some. Desinstale, reinstale e confira que "Sem anúncios" volta sozinho.
5. Desligue a internet e abra o jogo: deve funcionar; as compras avisam que a loja não respondeu.
6. Em outro idioma/região (VPN) confirme o formulário de consentimento e o botão *Configurações → Privacidade dos anúncios*.

## Limitações conhecidas desta versão

- **Entrega das compras no aparelho, sem servidor.** O jogo credita ao receber a aprovação da Google Play, mas não valida o recibo
  num servidor. Alguém com aparelho modificado (root) poderia forjar compras. Para um jogo single-player de baixo valor isso costuma
  ser aceito; para reforçar mais tarde, use validação de recibo (ex.: serviço Iaptic ou servidor próprio com a API do Google Play).
- **Moedas e vidas ficam só no aparelho.** Se o jogador desinstalar ou trocar de celular, o saldo se perde: itens consumíveis
  (moedas, vidas) não são restaurados pela Google Play. Backup em nuvem de saldo exigiria conta/servidor.
- **Ranking global não existe** (precisa de servidor). Foi removido do menu; o código da tela continua no projeto.
- **iOS não está incluído** (precisaria de Mac, conta Apple Developer e produtos na App Store).
