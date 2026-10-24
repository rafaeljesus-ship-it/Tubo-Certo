/*
  Tubo Certo — camada de plataforma: compras dentro do app e anúncios premiados.

  Três modos:
   - 'native': rodando dentro do app Android (Capacitor). Usa Google Play Billing e AdMob de verdade.
   - 'test'  : navegador com ?teste=1. Simula compra grátis e anúncio de 1,6 s, só para testar o fluxo.
   - 'web'   : navegador normal. Compras e anúncios ficam indisponíveis (o jogo avisa, nada é creditado).

  Quem entrega o item comprado é Platform.onGrant(productId); ele só é chamado UMA vez por transação
  (as transações já entregues ficam registradas em localStorage).
*/
(function () {
  'use strict';

  var C = window.TUBO_CONFIG;
  var TEST = /[?&]teste=1/.test(location.search);
  var native = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  var mode = native ? 'native' : (TEST ? 'test' : 'web');
  var N = null;                       // window.TuboNative, carregado só no app
  var prices = {};                    // id -> preço formatado pela loja
  var pending = {};                   // id -> função que resolve a promessa de purchase()
  var consentOk = false, adsReady = false, billingReady = false;
  var DONE_KEY = 'tubo-certo-tx';

  function doneList() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch (e) { return []; } }
  function markDone(id) { var l = doneList(); l.push(id); try { localStorage.setItem(DONE_KEY, JSON.stringify(l.slice(-300))); } catch (e) { /* sem storage */ } }

  var Platform = {
    mode: mode,
    onGrant: function () {},          // o jogo define: function (productId) { ... }
    onPrices: function () {},         // chamado quando a loja devolve os preços
    product: function (id) { return C.products.filter(function (p) { return p.id === id; })[0]; },
    canBuy: function () { return mode === 'native' ? billingReady : mode === 'test'; },
    canShowAds: function () { return mode === 'test' || (mode === 'native' && adsReady); },
    priceOf: function (id) { return prices[id] || (Platform.product(id) || {}).fallback || ''; }
  };

  function loadBridge() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'js/native-bridge.js';
      s.onload = function () { N = window.TuboNative; N ? resolve() : reject(new Error('ponte nativa vazia')); };
      s.onerror = function () { reject(new Error('não carregou js/native-bridge.js')); };
      document.head.appendChild(s);
    });
  }

  // ---------- compras ----------
  function deliver(transaction) {
    var key = transaction.transactionId || transaction.purchaseId;
    var ids = (transaction.products || []).map(function (p) { return p.id; });
    var first = key && doneList().indexOf(key) === -1;
    if (first) {
      markDone(key);                                      // marca ANTES de entregar: nunca credita duas vezes
      ids.forEach(function (id) { try { Platform.onGrant(id); } catch (e) { /* o jogo trata */ } });
    }
    return Promise.resolve(transaction.finish()).then(function () {
      ids.forEach(function (id) { if (pending[id]) { pending[id]({ ok: true }); delete pending[id]; } });
    });
  }

  function initBilling() {
    var store = N.store;
    store.register(C.products.map(function (p) {
      return { id: p.id, type: N.ProductType.CONSUMABLE, platform: N.Platform.GOOGLE_PLAY };
    }));
    store.when()
      .productUpdated(function () {
        C.products.forEach(function (p) {
          var pr = store.get(p.id);
          var pricing = pr && pr.pricing;
          if (pricing && pricing.price) prices[p.id] = pricing.price;
        });
        Platform.onPrices();
      })
      .approved(function (t) { deliver(t); });
    store.error(function (e) { console.warn('Billing:', e && e.code, e && e.message); });
    return store.initialize([N.Platform.GOOGLE_PLAY]).then(function () { billingReady = true; });
  }

  Platform.purchase = function (id) {
    if (mode === 'test') { Platform.onGrant(id); return Promise.resolve({ ok: true }); }
    if (mode !== 'native' || !billingReady) return Promise.resolve({ ok: false, unavailable: true });
    var product = N.store.get(id), offer = product && product.getOffer();
    if (!offer) return Promise.resolve({ ok: false, error: 'Produto ainda não está disponível na loja.' });
    return new Promise(function (resolve) {
      pending[id] = resolve;
      offer.order().then(function (err) {
        if (err) {
          delete pending[id];
          resolve({ ok: false, cancelled: err.code === N.ErrorCode.PAYMENT_CANCELLED, error: err.message });
        }
        // sem erro: a compra foi aberta; o resultado chega em approved() -> deliver()
      });
    });
  };

  // ---------- anúncios premiados ----------
  function rewardedId() { return C.USE_TEST_ADS ? C.admob.test.rewarded : C.admob.real.rewarded; }

  function initAds() {
    var A = N.AdMob;
    return A.requestConsentInfo()
      .then(function (info) {
        if (info.isConsentFormAvailable && info.status === N.AdmobConsentStatus.REQUIRED) return A.showConsentForm();
        return info;
      })
      .then(function (info) {
        consentOk = !!info.canRequestAds;
        if (!consentOk) return;
        return A.initialize().then(function () { return preloadAd(); });
      });
  }

  function preloadAd() {
    adsReady = false;
    return N.AdMob.prepareRewardVideoAd({ adId: rewardedId() }).then(function () { adsReady = true; }, function (e) { console.warn('Anúncio não carregou:', e && e.message); });
  }

  // Resolve true só se o jogador assistiu até ganhar a recompensa.
  Platform.showRewarded = function () {
    if (mode === 'test') return new Promise(function (r) { setTimeout(function () { r(true); }, 1600); });
    if (mode !== 'native' || !adsReady) return Promise.resolve(false);
    return N.AdMob.showRewardVideoAd().then(function () { return true; }, function () { return false; })
      .then(function (ok) { preloadAd(); return ok; });
  };

  // Menu de privacidade/consentimento do AdMob (exigido na UE/Reino Unido).
  Platform.privacyOptions = function () {
    if (mode !== 'native') return Promise.resolve(false);
    return N.AdMob.showPrivacyOptionsForm().then(function () { return true; }, function () { return false; });
  };

  Platform.init = function () {
    if (mode !== 'native') return Promise.resolve();
    return loadBridge().then(function () {
      return Promise.all([
        initBilling().catch(function (e) { console.warn('Billing indisponível:', e); }),
        initAds().catch(function (e) { console.warn('Ads indisponíveis:', e); })
      ]);
    }).catch(function (e) { console.warn('Plataforma nativa indisponível:', e); });
  };

  window.TuboPlatform = Platform;
})();
