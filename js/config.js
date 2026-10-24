/*
  Tubo Certo — configuração de lojas e anúncios.
  Troque os valores marcados com "TROCAR" quando criar o app no Google Play Console e no AdMob.
  Enquanto USE_TEST_ADS for true, os anúncios são os de TESTE do Google (seguros, não geram receita nem risco de conta).
*/
window.TUBO_CONFIG = {
  appId: 'br.com.tubocerto.jogo',                 // TROCAR se quiser outro (não dá para mudar depois de publicar)
  privacyUrl: 'https://rafaeljesus-ship-it.github.io/Tubo-Certo/privacidade.html', // TROCAR para o endereço final
  USE_TEST_ADS: true,                              // TROCAR para false só quando os IDs reais abaixo estiverem preenchidos
  admob: {
    // IDs de teste oficiais do Google (Android). Os reais ficam em "real".
    test: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
    real: { rewarded: 'ca-app-pub-0000000000000000/0000000000',      // TROCAR pelo ID do bloco "Premiado" do AdMob
            interstitial: 'ca-app-pub-0000000000000000/0000000000' } // TROCAR pelo ID do bloco "Intersticial" do AdMob
  },
  // Itens vendidos (produtos "consumíveis" no Google Play Console: mesmo ID, tipo "Produto gerenciado").
  // O preço mostrado no jogo vem da loja (em R$ para o Brasil); "fallback" só aparece se a loja ainda não respondeu.
  products: [
    { id: 'moedas_100',  kind: 'coins', amount: 100,  fallback: 'R$ 4,90' },
    { id: 'moedas_500',  kind: 'coins', amount: 500,  fallback: 'R$ 21,90', bonus: '+10%' },
    { id: 'moedas_1200', kind: 'coins', amount: 1200, fallback: 'R$ 42,90', bonus: '+20%' },
    { id: 'moedas_2500', kind: 'coins', amount: 2500, fallback: 'R$ 84,90', bonus: '+35%' },
    { id: 'vida_1',      kind: 'lives', amount: 1,    fallback: 'R$ 2,90' },
    { id: 'vidas_5',     kind: 'lives', amount: 5,    fallback: 'R$ 9,90' },
    // Compra única (não consumível): tira os anúncios entre fases; os anúncios opcionais de recompensa continuam.
    { id: 'sem_anuncios', kind: 'noads', nonConsumable: true, fallback: 'R$ 14,90' }
  ],
  // Presentes para quem está começando (uma vez por instalação)
  welcome: { coins: 150 },       // moedas na primeira abertura
  hardGiftHints: 1,              // dicas grátis ao chegar na primeira fase difícil
  // Recompensas por anúncio
  ads: {
    lifeReward: 1,            // vidas por anúncio na tela de vidas
    coinReward: 25,           // moedas por anúncio na loja
    coinAdsPerDay: 5,         // limite diário de anúncios por moedas
    doubleChest: true,        // botão "dobrar prêmio" depois de abrir o baú
    // Anúncio de tela cheia ao concluir uma fase (some com a compra "Sem anúncios")
    interstitial: { enabled: true, fromLevel: 6, everyLevels: 1, minGapMs: 45000 }
  }
};
