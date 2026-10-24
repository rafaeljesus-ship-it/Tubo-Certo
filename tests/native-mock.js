/*
  Testa a camada de plataforma (js/platform.js + telas) com plugins NATIVOS SIMULADOS.
  A simulação segue a API documentada de capacitor-plugin-cdv-purchase e @capacitor-community/admob,
  mas NÃO é a Google Play nem o AdMob de verdade: isto valida a lógica do jogo, não a integração real.
  Uso: python3 -m http.server 8123 ; NODE_PATH=$(npm root -g) node tests/native-mock.js
*/
const { chromium } = require('playwright');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

const BRIDGE = `
(function () {
  var log = window.__log = [];
  var handlers = {};
  var products = {};
  var orderMode = 'approve';           // 'approve' | 'cancel'
  window.__setOrderMode = function (m) { orderMode = m; };
  window.__consent = { isConsentFormAvailable: true, status: 'REQUIRED', canRequestAds: true };
  window.__rewardResult = 'earn';      // 'earn' | 'fail'
  window.__tx = function (id, txid) {
    var t = { transactionId: txid, products: [{ id: id }], finish: function () { log.push('finish:' + txid); return Promise.resolve(); } };
    handlers.approved && handlers.approved(t);
  };
  var store = {
    register: function (list) { log.push('register:' + list.map(function (p) { return p.id + '/' + p.type + '/' + p.platform; }).join(',')); list.forEach(function (p) { products[p.id] = p; }); },
    when: function () { var w = { productUpdated: function (f) { handlers.productUpdated = f; return w; }, approved: function (f) { handlers.approved = f; return w; } }; return w; },
    error: function () {},
    initialize: function () { log.push('initialize'); setTimeout(function () { handlers.productUpdated && handlers.productUpdated(); }, 10); return Promise.resolve([]); },
    get: function (id) {
      if (!products[id]) return undefined;
      return { pricing: { price: 'R$ ' + (id.length + 3) + ',99' }, getOffer: function () { return { order: function () {
        log.push('order:' + id);
        if (orderMode === 'cancel') return Promise.resolve({ isError: true, code: 6777006, message: 'cancelado' });
        setTimeout(function () { window.__tx(id, 'tx-' + id + '-' + log.length); }, 20);
        return Promise.resolve(undefined);
      } }; } };
    }
  };
  window.TuboNative = {
    Capacitor: window.Capacitor, store: store,
    ProductType: { CONSUMABLE: 'consumable' }, Platform: { GOOGLE_PLAY: 'android-playstore' }, ErrorCode: { PAYMENT_CANCELLED: 6777006 },
    AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
    AdMob: {
      requestConsentInfo: function () { log.push('consentInfo'); return Promise.resolve(window.__consent); },
      showConsentForm: function () { log.push('consentForm'); window.__consent = { isConsentFormAvailable: true, status: 'OBTAINED', canRequestAds: window.__consent.canRequestAds }; return Promise.resolve(window.__consent); },
      initialize: function () { log.push('adInit'); return Promise.resolve(); },
      prepareRewardVideoAd: function (o) { log.push('prepare:' + o.adId); return Promise.resolve({}); },
      showRewardVideoAd: function () { log.push('showAd'); return window.__rewardResult === 'earn' ? Promise.resolve({ type: 'coin', amount: 1 }) : Promise.reject(new Error('fechou')); },
      showPrivacyOptionsForm: function () { log.push('privacyForm'); return Promise.resolve(); }
    }
  };
})();`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' }; });
  await ctx.route('**/js/native-bridge.js', r => r.fulfill({ contentType: 'application/javascript', body: BRIDGE }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(700);
  const log = () => p.evaluate(() => window.__log);
  const coins = async () => +(await p.textContent('#homeCoins, [data-coins]'));
  const lives = async () => (await p.evaluate(() => JSON.parse(localStorage.getItem('tubo-certo-lives')))).lives;

  console.log('# inicialização nativa');
  let l = await log();
  ok(l.some(x => x.startsWith('register:') && x.split(',').length === 6 && x.split(',').every(i => i.endsWith('/consumable/android-playstore'))), '6 produtos registrados como consumíveis do Google Play');
  ok(l.includes('initialize'), 'billing inicializado');
  ok(l.includes('consentForm'), 'formulário de consentimento mostrado quando exigido');
  ok(l.includes('adInit') && l.includes('prepare:ca-app-pub-3940256099942544/5224354917'), 'AdMob inicializado e anúncio premiado de TESTE pré-carregado');

  console.log('# compras');
  await p.evaluate(() => localStorage.setItem('tubo-certo-coins', '0')); await p.reload(); await p.waitForTimeout(700);
  await p.click('#homeShopBtn');
  const label = await p.locator('#shopList .shop-row .buy-btn').first().textContent();
  ok(/^R\$ \d+,99$/.test(label), 'preço mostrado vem da loja: ' + label);
  await p.locator('#shopList .shop-row .buy-btn').nth(1).click(); await p.waitForTimeout(400);
  ok((await coins()) === 500, 'compra aprovada credita 500 moedas');
  ok((await log()).some(x => x.startsWith('finish:')), 'transação finalizada (consumida) após entregar');
  // reenvio da mesma transação (ex.: app reaberto antes de finalizar) não credita de novo
  const txid = await p.evaluate(() => window.__log.filter(x => x.startsWith('finish:'))[0].slice(7));
  await p.evaluate(id => window.__tx('moedas_500', id), txid); await p.waitForTimeout(200);
  ok((await coins()) === 500, 'mesma transação reapresentada NÃO credita duas vezes');
  // cancelamento
  await p.evaluate(() => window.__setOrderMode('cancel'));
  await p.locator('#shopList .shop-row .buy-btn').nth(0).click(); await p.waitForTimeout(300);
  ok((await coins()) === 500 && !(await p.isVisible('#modal')), 'compra cancelada: nada creditado e sem mensagem de erro');
  await p.evaluate(() => window.__setOrderMode('approve'));
  // vidas
  await p.evaluate(() => localStorage.setItem('tubo-certo-lives', JSON.stringify({ lives: 1, nextRefillAt: Date.now() + 900000 })));
  await p.click('#shopBackBtn'); await p.click('#homeShopBtn'); await p.click('#shopBackBtn');
  await p.reload(); await p.waitForTimeout(700); await p.click('#playBtn'); await p.locator('.level-tile:not(.locked)').first().click(); await p.click('#gameLivesBtn');
  await p.click('#livesBuyFiveBtn'); await p.waitForTimeout(400);
  ok((await lives()) === 5, 'compra de +5 vidas entrega vidas (limitado ao máximo de 5)');

  console.log('# anúncios premiados');
  await p.evaluate(() => localStorage.setItem('tubo-certo-lives', JSON.stringify({ lives: 2, nextRefillAt: Date.now() + 900000 })));
  await p.click('#livesBackBtn'); await p.click('#gameLivesBtn');
  await p.click('#livesAdBtn'); await p.waitForTimeout(400);
  ok((await lives()) === 3, 'anúncio assistido até o fim: +1 vida');
  await p.evaluate(() => { window.__rewardResult = 'fail'; });
  await p.click('#livesAdBtn'); await p.waitForTimeout(400);
  ok((await lives()) === 3, 'anúncio fechado antes do fim: nenhuma vida');
  ok((await log()).filter(x => x === 'showAd').length === 2 && (await log()).filter(x => x.startsWith('prepare:')).length >= 3, 'novo anúncio é pré-carregado após cada exibição');

  console.log('# sem consentimento');
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { Object.defineProperty(window, '__consentDeny', { value: true }); });
  await p2.route('**/js/native-bridge.js', r => r.fulfill({ contentType: 'application/javascript', body: BRIDGE.replace("canRequestAds: true", "canRequestAds: false") }));
  await p2.goto('http://localhost:8123/index.html'); await p2.waitForTimeout(700);
  const l2 = await p2.evaluate(() => window.__log);
  ok(!l2.includes('adInit') && !l2.some(x => x.startsWith('prepare:')), 'sem consentimento: AdMob não é iniciado e nenhum anúncio é pedido');

  console.log('\\nerros de página:', errs.length ? errs.join('\\n') : 'nenhum');
  console.log(`\\nresultado: ${pass} ok, ${fail} falhas`);
  await browser.close(); process.exit(fail || errs.length ? 1 : 0);
})();
