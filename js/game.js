/*
  Tubo Certo — interface, navegação, economia (moedas/vidas) e persistência.
  O motor do puzzle fica em engine.js (TuboEngine).
*/
(function () {
  'use strict';

  var E = window.TuboEngine;
  var CAP = E.CAP;

  // Paleta do kit (tubo_certo_assets/blocks): a ordem é a do índice de cor do motor.
  var COLOR_NAMES = ['red', 'yellow', 'blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'lime', 'gray'];
  var BALL_COLORS = ['#e5321f', '#ffcf1f', '#2d68c9', '#1fb98a', '#8e44c2', '#ff8a1c', '#ff6fa6', '#19bfd0', '#8fd02a', '#a9aca9']; // confete
  // Arte do jogo (PNG/SVG separados em assets/jogo). O tools/build-single.py troca estes caminhos por data URIs.
  var ART = {
    tubo: 'assets/jogo/tubo.png',
    selecionado: 'assets/jogo/estado-selecionado.svg',
    valido: 'assets/jogo/estado-valido.svg',
    completo: 'assets/jogo/estado-completo.svg'
  };
  function pieceUrl(name) { return 'assets/jogo/peca-' + name + '.png'; }

  var TEST_MODE = /[?&]teste=1/.test(location.search);

  function $(id) { return document.getElementById(id); }
  function ico(id, cls) { return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function store(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sem storage */ } }

  var app = $('app');

  // ===================== Constantes de jogo =====================
  var TOTAL_LEVELS = 30;
  var LEVELS_PER_PAGE = 12;
  var MAX_LIVES = 5;
  var REGEN_MS = 15 * 60 * 1000;
  var LIFE_COIN_COST = 80;
  var HINT_COST = 50;
  var EXTRA_TUBE_COST = 100;
  var MAX_EXTRA_TUBES = 2;

  var COINS_KEY = 'tubo-certo-coins';
  var STREAK_KEY = 'tubo-certo-streak';
  var LIVES_KEY = 'tubo-certo-lives';
  var LEVELS_KEY = 'tubo-certo-levels';
  var SETTINGS_KEY = 'tubo-certo-settings';

  var state = {
    level: 1, colors: 3, tubes: [], initial: [], selected: null, moves: 0, history: [],
    won: false, coins: 0, lastPourTo: null, lives: MAX_LIVES, nextRefillAt: null,
    gate: null,            // null | 'failed' | 'nolives'
    hint: null, extra: 0, target: 0, hardLimit: 0, baseHardLimit: 0, optimal: 0,
    pendingReward: null    // recompensa do baú ainda não aberta
  };

  // ===================== Toast / modal =====================
  var toastEl = $('toast');
  var toastTimer = null;
  function showToast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2300);
  }

  var modalEl = $('modal');
  function openModal(title, bodyHtml, actions) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    var box = $('modalActions');
    box.innerHTML = '';
    (actions || [{ label: 'OK' }]).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'buy-btn' + (a.cls ? ' ' + a.cls : '');
      b.textContent = a.label;
      b.addEventListener('click', function () { closeModal(); sfxClick(); if (a.onClick) a.onClick(); });
      box.appendChild(b);
    });
    modalEl.hidden = false;
    box.firstChild && box.firstChild.focus();
  }
  function closeModal() { modalEl.hidden = true; }
  modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modalEl.hidden) closeModal(); });

  // ===================== Configurações, som, vibração =====================
  var settings = store(SETTINGS_KEY, { music: false, sfx: true, vibration: true });

  function vibrate(ms) {
    if (settings.vibration && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  var audioCtx = null;
  function getCtx() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur, type, vol) {
    try {
      var ctx = getCtx();
      if (!ctx) return;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.value = vol || 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.stop(ctx.currentTime + dur);
    } catch (e) { /* áudio indisponível */ }
  }
  function beep(freq, dur, type) { if (settings.sfx) tone(freq, dur, type, 0.06); }
  function sfxPour() { beep(420, 0.08, 'square'); }
  function sfxClose() { beep(660, 0.12, 'triangle'); }
  function sfxWin() { beep(523, 0.1, 'sine'); setTimeout(function () { beep(784, 0.18, 'sine'); }, 90); }
  function sfxError() { beep(140, 0.16, 'sawtooth'); }
  function sfxClick() { beep(300, 0.05, 'square'); }

  // Música de fundo procedural (ragtime simples) — sem arquivos de áudio.
  var CHORDS = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
  var musicTimer = null, musicStep = 0;
  function musicTick() {
    var chord = CHORDS[Math.floor(musicStep / 8) % CHORDS.length];
    var s = musicStep % 8;
    if (s % 4 === 0) tone(chord[0] / 2, 0.28, 'triangle', 0.05);
    else if (s % 2 === 1) { tone(chord[1], 0.12, 'sine', 0.025); tone(chord[2], 0.12, 'sine', 0.02); }
    if (s === 2 || s === 6) tone(chord[2] * 2, 0.1, 'square', 0.012);
    musicStep++;
  }
  function startMusic() {
    if (!settings.music || musicTimer || document.hidden) return;
    if (!getCtx()) return;
    musicTimer = setInterval(musicTick, 210);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopMusic(); else startMusic(); });
  // navegadores só liberam áudio após um toque: começa a música no primeiro.
  document.addEventListener('pointerdown', function once() { startMusic(); document.removeEventListener('pointerdown', once); });

  function renderSettingsView() {
    $('settingMusic').checked = !!settings.music;
    $('settingSfx').checked = !!settings.sfx;
    $('settingVibration').checked = !!settings.vibration;
    $('settingsNote').textContent = TEST_MODE
      ? 'Modo de teste ativo (?teste=1): as compras creditam de graça.'
      : 'Suas preferências ficam salvas neste aparelho.';
  }

  // ===================== Moedas =====================
  function loadCoins() {
    try { return parseInt(localStorage.getItem(COINS_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function syncCoinDisplays() {
    var nodes = document.querySelectorAll('[data-coins]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = state.coins;
  }
  function addCoins(amount) {
    state.coins = Math.max(0, state.coins + amount);
    try { localStorage.setItem(COINS_KEY, String(state.coins)); } catch (e) { /* ignore */ }
    syncCoinDisplays();
  }
  function spendCoins(amount) {
    if (state.coins >= amount) { addCoins(-amount); return true; }
    sfxError();
    openModal('Moedas insuficientes', '<p>Você precisa de <b>' + amount + '</b> moedas e tem <b>' + state.coins + '</b>.</p>', [
      { label: 'LOJA', onClick: function () { openSecondary('shop'); } },
      { label: 'FECHAR', cls: 'alt' }
    ]);
    return false;
  }

  // ===================== Vidas =====================
  function loadLivesData() { return store(LIVES_KEY, { lives: MAX_LIVES, nextRefillAt: null }); }
  function settleRegen(d) {
    var now = Date.now();
    if (d.lives >= MAX_LIVES) { d.nextRefillAt = null; return d; }
    if (!d.nextRefillAt) { d.nextRefillAt = now + REGEN_MS; return d; }
    while (d.lives < MAX_LIVES && now >= d.nextRefillAt) { d.lives++; d.nextRefillAt += REGEN_MS; }
    if (d.lives >= MAX_LIVES) d.nextRefillAt = null;
    return d;
  }
  function commitLives(d) {
    save(LIVES_KEY, d);
    state.lives = d.lives;
    state.nextRefillAt = d.nextRefillAt;
  }
  function syncLives() { commitLives(settleRegen(loadLivesData())); }
  function loseLife() {
    var d = settleRegen(loadLivesData());
    if (d.lives > 0) { d.lives--; if (!d.nextRefillAt) d.nextRefillAt = Date.now() + REGEN_MS; }
    commitLives(d);
  }
  function gainLife(n) {
    var d = settleRegen(loadLivesData());
    d.lives = Math.min(MAX_LIVES, d.lives + (n || 1));
    if (d.lives >= MAX_LIVES) d.nextRefillAt = null;
    commitLives(d);
  }
  function formatCountdown(ms) {
    if (ms <= 0) return '00:00';
    var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function heartsHtml(count, max) {
    var h = '';
    for (var i = 0; i < max; i++) h += ico('heart', 'heart ' + (i < count ? 'full' : 'empty'));
    return h;
  }
  function renderLives() {
    var b = $('gameLivesBtn');
    b.innerHTML = heartsHtml(state.lives, MAX_LIVES);
    b.setAttribute('aria-label', 'Vidas: ' + state.lives + ' de ' + MAX_LIVES);
    $('failLivesBadge').textContent = state.lives;
  }
  function renderLivesScreen() {
    syncLives();
    $('livesHeartsBig').innerHTML = heartsHtml(state.lives, MAX_LIVES);
    var full = state.lives >= MAX_LIVES;
    $('livesNextLabel').textContent = full ? 'VIDAS CHEIAS!' : 'PRÓXIMA VIDA EM:';
    $('livesCountdownBig').textContent = full ? '--:--' : formatCountdown(state.nextRefillAt - Date.now());
    $('livesCoinBuyBtn').disabled = full;
    $('livesBuyOneBtn').disabled = full;
    $('livesBuyFiveBtn').disabled = full;
    $('lifeCoinCost').textContent = LIFE_COIN_COST;
    renderLives();
  }

  // ===================== Navegação =====================
  var views = ['home', 'levels', 'game', 'shop', 'lives', 'powerups', 'settings', 'ranking'];
  var primary = ['home', 'levels', 'game'];
  var currentView = 'home';
  var returnView = 'home';

  function hideOverlays() { $('view-win').hidden = true; $('view-fail').hidden = true; }

  function showView(name) {
    if (currentView === 'game' && name !== 'game') claimChest();
    views.forEach(function (v) { $('view-' + v).classList.toggle('active', v === name); });
    currentView = name;
    hideOverlays();
    syncCoinDisplays();
    if (name === 'levels') renderLevels();
    if (name === 'shop') renderShop();
    if (name === 'lives') renderLivesScreen();
    if (name === 'powerups') renderPowerups();
    if (name === 'settings') renderSettingsView();
    if (name === 'ranking') renderRanking();
    if (name === 'game') {
      render();
      if (state.gate === 'nolives' && state.lives > 0) state.gate = null;
      if (state.gate) openFail();
    }
  }
  function openSecondary(name) {
    if (primary.indexOf(currentView) !== -1) returnView = currentView;
    showView(name);
  }
  function goBack() { showView(returnView); }

  // ===================== Fases (progressão e estrelas) =====================
  var levelData = store(LEVELS_KEY, { unlocked: 1, stars: {} });
  var levelPage = 0;

  function recordLevelResult(level, stars) {
    var prev = levelData.stars[level] || 0;
    if (stars > prev) levelData.stars[level] = stars;
    if (level + 1 > levelData.unlocked) levelData.unlocked = Math.min(level + 1, TOTAL_LEVELS);
    save(LEVELS_KEY, levelData);
  }

  function renderLevels() {
    var pages = Math.ceil(TOTAL_LEVELS / LEVELS_PER_PAGE);
    if (levelPage > pages - 1) levelPage = pages - 1;
    var grid = $('levelGrid');
    grid.innerHTML = '';
    var first = levelPage * LEVELS_PER_PAGE + 1;
    var last = Math.min(first + LEVELS_PER_PAGE - 1, TOTAL_LEVELS);
    for (var n = first; n <= last; n++) {
      var locked = n > levelData.unlocked;
      var stars = levelData.stars[n] || 0;
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'level-tile' + (locked ? ' locked' : '') + (n === levelData.unlocked ? ' current' : '');
      tile.setAttribute('aria-label', locked ? 'Fase ' + n + ' bloqueada' : 'Fase ' + n + ', ' + stars + ' de 3 estrelas');
      if (locked) {
        tile.disabled = true;
        tile.innerHTML = '<span class="num">' + n + '</span>' + ico('lock', 'lock');
      } else {
        var s = '';
        for (var k = 1; k <= 3; k++) s += ico('star', k <= stars ? 'on' : 'off');
        tile.innerHTML = '<span class="num">' + n + '</span><span class="stars">' + s + '</span>';
        tile.addEventListener('click', (function (lv) { return function () { sfxClick(); startLevel(lv); }; })(n));
      }
      grid.appendChild(tile);
    }
    var dots = $('levelDots');
    dots.innerHTML = '';
    dots.hidden = pages < 2;
    for (var p = 0; p < pages; p++) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = p === levelPage ? 'active' : '';
      d.setAttribute('aria-label', 'Página ' + (p + 1));
      d.addEventListener('click', (function (pg) { return function () { levelPage = pg; renderLevels(); }; })(p));
      dots.appendChild(d);
    }
  }
  (function swipe() {
    var g = $('levelGrid'), x0 = null;
    g.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    g.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0; x0 = null;
      var pages = Math.ceil(TOTAL_LEVELS / LEVELS_PER_PAGE);
      if (dx < -45 && levelPage < pages - 1) { levelPage++; renderLevels(); }
      else if (dx > 45 && levelPage > 0) { levelPage--; renderLevels(); }
    });
  })();

  // ===================== Loja =====================
  var SHOP_PACKAGES = [
    { amount: 100, price: 'R$ 4,90', coins: [[32, 4]] },
    { amount: 500, price: 'R$ 21,90', bonus: '+10%', coins: [[22, 4], [42, 5]] },
    { amount: 1200, price: 'R$ 42,90', bonus: '+20%', coins: [[16, 4], [32, 6], [48, 4]] },
    { amount: 2500, price: 'R$ 84,90', bonus: '+35%', coins: [[15, 5], [32, 8], [49, 5]] }
  ];
  // pilhas de moedas desenhadas em SVG: [[x, quantidade], ...]
  function coinStack(cols) {
    var s = '<svg class="stack" viewBox="0 0 64 56" aria-hidden="true">';
    cols.forEach(function (c, ci) {
      var base = 49 - (ci % 2) * 3;
      for (var i = 0; i < c[1]; i++) {
        var y = base - i * 5.8;
        s += '<ellipse cx="' + c[0] + '" cy="' + (y + 3) + '" rx="12.5" ry="5" fill="#c98a05" stroke="#1b1109" stroke-width="1.5"/>' +
             '<ellipse cx="' + c[0] + '" cy="' + y + '" rx="12.5" ry="5" fill="#ffc21a" stroke="#1b1109" stroke-width="1.5"/>' +
             '<ellipse cx="' + c[0] + '" cy="' + y + '" rx="7.4" ry="2.6" fill="none" stroke="#d99a0b" stroke-width="1.3"/>';
      }
    });
    return s + '</svg>';
  }
  function renderShop() {
    var list = $('shopList');
    list.innerHTML = '';
    SHOP_PACKAGES.forEach(function (pkg) {
      var row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = '<span class="amount">' + coinStack(pkg.coins) + '<span>' + pkg.amount.toLocaleString('pt-BR') + '</span>' +
        (pkg.bonus ? '<span class="bonus">' + pkg.bonus + '</span>' : '') + '</span>' +
        '<button class="buy-btn" type="button">' + pkg.price + '</button>';
      row.querySelector('button').addEventListener('click', function () { sfxClick(); buyCoins(pkg); });
      list.appendChild(row);
    });
    $('shopNote').textContent = TEST_MODE
      ? 'Modo de teste (?teste=1): as moedas são creditadas de graça, sem cobrança.'
      : 'Pagamentos reais ainda não estão integrados nesta versão: nenhuma cobrança é feita.';
  }
  function paymentUnavailable(what) {
    openModal('Compra indisponível',
      '<p>' + what + ' exige o checkout da loja de aplicativos (App Store / Google Play), que ainda não está integrado.</p><p><b>Nada foi cobrado e nada foi creditado.</b></p>');
  }
  function buyCoins(pkg) {
    if (!TEST_MODE) { paymentUnavailable('Comprar ' + pkg.amount + ' moedas'); return; }
    addCoins(pkg.amount); sfxWin(); showToast('+' + pkg.amount + ' moedas (modo de teste)');
  }

  // ===================== Reforços =====================
  function levelInProgress() { return state.tubes.length > 0 && !state.won && !state.gate; }

  function doHint() {
    if (!levelInProgress()) { showToast('Entre em uma fase para usar a dica.'); return false; }
    var move = null;
    var path = E.solvePath(E.deepClone(state.tubes), 20000);
    if (path && path.length) move = { from: path[0][0], to: path[0][1] };
    else move = E.findHint(state.tubes);
    if (!move) { showToast('Nenhum movimento disponível agora.'); return false; }
    if (!spendCoins(HINT_COST)) return false;
    state.selected = null;
    state.hint = move;
    render();
    clearTimeout(doHint.t);
    doHint.t = setTimeout(function () { state.hint = null; if (currentView === 'game') render(); }, 5000);
    showToast('Dica: toque no tubo que pulsa e depois no outro destacado.');
    return true;
  }

  function doExtraTube() {
    if (!levelInProgress()) { showToast('Entre em uma fase para usar o tubo extra.'); return false; }
    if (state.extra >= MAX_EXTRA_TUBES) { showToast('Limite de ' + MAX_EXTRA_TUBES + ' tubos extras por fase.'); return false; }
    if (!spendCoins(EXTRA_TUBE_COST)) return false;
    state.tubes.push([]);
    state.extra++;
    state.hardLimit += 3;
    render();
    showToast('Tubo extra adicionado!');
    return true;
  }

  function renderPowerups() {
    var ok = levelInProgress();
    $('powerupsUndoBtn').disabled = !ok || !state.history.length;
    $('powerupsHintBtn').disabled = !ok;
    $('powerupsExtraBtn').disabled = !ok || state.extra >= MAX_EXTRA_TUBES;
    $('powerupsNote').textContent = ok
      ? 'Os reforços agem na fase ' + state.level + ', que está em andamento.'
      : 'Entre em uma fase para usar os reforços.';
  }

  // ===================== Ranking (dados locais de demonstração) =====================
  var RANK_GLOBAL = [
    { name: 'PlayerBR', score: 3450, a: 0 }, { name: 'Mariana', score: 3120, a: 1 },
    { name: 'Lucas', score: 2980, a: 2 }, { name: 'Camila', score: 2430, a: 3 }, { name: 'Felipe', score: 2210, a: 4 }
  ];
  var RANK_FRIENDS = [{ name: 'Mariana', score: 3120, a: 1 }, { name: 'Camila', score: 2430, a: 3 }, { name: 'Lucas', score: 2980, a: 2 }];
  var rankTab = 'global';
  function avatar(seed) {
    var bg = ['#ffd24a', '#8ec5ff', '#ffb68a', '#b7e08a', '#d9a8ff', '#ff9aa8', '#7fe0d0'][seed % 7];
    var skin = ['#f2c9a0', '#d9a073', '#a86f48', '#f6d5b5', '#8a5a3a'][seed % 5];
    var hair = ['#2b1a0e', '#6b3a14', '#c9852f', '#111', '#8a2a1a'][(seed * 3 + 1) % 5];
    var shirt = ['#e5321f', '#2d68c9', '#2eaa4f', '#8e44c2', '#ff8a1c'][(seed * 2) % 5];
    return '<svg class="avatar" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="' + bg + '"/>' +
      '<path d="M4 41c1-9 7-12 16-12s15 3 16 12z" fill="' + shirt + '" stroke="#1b1109" stroke-width="2"/>' +
      '<circle cx="20" cy="17" r="8.2" fill="' + skin + '" stroke="#1b1109" stroke-width="2"/>' +
      '<path d="M11.4 16c-.4-6 4-9.6 8.9-9.4 5 .1 8.6 3.8 8.3 9.2-2-2.6-4.4-4-8.4-4-3.6 0-6.3 1.4-8.8 4.2z" fill="' + hair + '" stroke="#1b1109" stroke-width="2" stroke-linejoin="round"/></svg>';
  }
  function myScore() {
    return state.coins + Object.keys(levelData.stars).reduce(function (sum, k) { return sum + (levelData.stars[k] || 0) * 100; }, 0);
  }
  function renderRanking() {
    var base = (rankTab === 'global' ? RANK_GLOBAL : RANK_FRIENDS).slice();
    base.push({ name: 'Você', score: myScore(), a: 5, me: true });
    base.sort(function (a, b) { return b.score - a.score; });
    var list = $('rankList');
    list.innerHTML = '';
    base.forEach(function (p, idx) {
      var row = document.createElement('div');
      row.className = 'rank-row' + (p.me ? ' me' : '');
      row.innerHTML = '<span class="rank-pos">' + (idx === 0 ? ico('crown') : (idx + 1)) + '</span>' + avatar(p.a) +
        '<span class="rank-name">' + p.name + '</span><span class="rank-score">' + p.score.toLocaleString('pt-BR') + ico('star') + '</span>';
      list.appendChild(row);
    });
    $('rankTabGlobal').className = 'rank-tab' + (rankTab === 'global' ? ' active' : '');
    $('rankTabFriends').className = 'rank-tab' + (rankTab === 'friends' ? ' active' : '');
    $('rankTabGlobal').setAttribute('aria-selected', rankTab === 'global');
    $('rankTabFriends').setAttribute('aria-selected', rankTab === 'friends');
  }

  // ===================== Recordes e sequência diária =====================
  function bestKey(colors) { return 'tubo-certo-best-' + colors; }
  function getBest(colors) {
    try { var v = localStorage.getItem(bestKey(colors)); return v ? parseInt(v, 10) : null; } catch (e) { return null; }
  }
  function saveBest(colors, moves) {
    try { var c = getBest(colors); if (c === null || moves < c) localStorage.setItem(bestKey(colors), String(moves)); } catch (e) { /* ignore */ }
  }
  function dateKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function checkDailyStreak() {
    var streak = store(STREAK_KEY, { count: 0, lastDate: null });
    var today = dateKey(new Date());
    if (streak.lastDate === today) return null;
    var y = new Date(); y.setDate(y.getDate() - 1);
    streak.count = streak.lastDate === dateKey(y) ? streak.count + 1 : 1;
    streak.lastDate = today;
    save(STREAK_KEY, streak);
    var bonus = Math.min(streak.count * 5, 50);
    addCoins(bonus);
    return { count: streak.count, bonus: bonus };
  }

  // ===================== Puzzle =====================
  var board = $('board');
  var boardWrap = $('boardWrap');

  function startLevel(n) {
    syncLives();
    newLevel(n);
    showView('game');
    if (state.lives <= 0) { state.gate = 'nolives'; openFail(); }
  }

  function newLevel(level) {
    state.level = level;
    state.colors = E.colorsForLevel(level);
    var g = E.generateLevel(state.colors);
    state.initial = E.deepClone(g.tubes);
    state.optimal = g.optimal;
    state.target = E.targetFromOptimal(g.optimal);
    state.baseHardLimit = E.hardLimitFromOptimal(g.optimal);
    resetBoard();
  }

  // Volta ao mesmo tabuleiro inicial (reiniciar não sorteia outra fase e não gasta vida).
  function resetBoard() {
    state.tubes = E.deepClone(state.initial);
    state.hardLimit = state.baseHardLimit;
    state.extra = 0;
    state.selected = null;
    state.moves = 0;
    state.history = [];
    state.won = false;
    state.hint = null;
    state.gate = null;
    state.pendingReward = null;
    if (currentView === 'game') { hideOverlays(); render(); }
  }

  function restart() {
    resetBoard();
    syncLives();
    if (state.lives <= 0) { state.gate = 'nolives'; openFail(); }
  }

  function pushHistory() {
    state.history.push({ tubes: E.deepClone(state.tubes), moves: state.moves });
    if (state.history.length > 60) state.history.shift();
  }

  function undo() {
    if (!levelInProgress() || !state.history.length) return false;
    var prev = state.history.pop();
    state.tubes = prev.tubes;
    state.moves = prev.moves;
    state.selected = null;
    state.hint = null;
    render();
    return true;
  }

  function handleTubeClick(idx) {
    if (state.won || state.gate) return;
    state.hint = null;
    var tubes = state.tubes;
    if (state.selected === null) {
      if (!tubes[idx].length) return;
      state.selected = idx;
      sfxClick();
      render();
      return;
    }
    if (state.selected === idx) { state.selected = null; render(); return; }
    if (E.canPour(tubes, state.selected, idx)) {
      pushHistory();
      E.applyPour(tubes, state.selected, idx);
      state.moves++;
      state.selected = null;
      state.lastPourTo = idx;
      var closed = E.tubeStatus(tubes[idx]) === 'solved';
      render();
      vibrate(closed ? 25 : 12);
      if (E.isSolved(tubes)) {
        onWin();
      } else {
        if (closed) { sfxClose(); spawnPow(POW_WORDS[Math.floor(Math.random() * POW_WORDS.length)], false); }
        else sfxPour();
        if (state.moves >= state.hardLimit) onFail();
      }
    } else {
      sfxError();
      state.selected = tubes[idx].length > 0 ? idx : null;
      render();
    }
  }

  // --- layout no formato do mockup: tubos de paredes retas sobre prateleiras.
  // Cada fileira fica sobre uma prateleira; a bancada com as ferramentas vem logo abaixo.
  // O tamanho do tubo é o maior que cabe na largura e na altura reais (HUD e bancada descontados).
  var TUBE_ASPECT = 3.526;   // tubo 312 × 1100 (arte gerada)
  function layoutFor(n) {
    var area = boardWrap;
    var cs = getComputedStyle(area);
    var W = area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - $('gameBench').offsetHeight;
    if (W <= 0 || H <= 0) return null;
    var padX = Math.max(10, Math.round(W * 0.035));
    var padTop = Math.max(26, Math.round(W * 0.09));
    var shelf = Math.max(20, Math.round(W * 0.075));
    var rowGap = Math.max(10, Math.round(W * 0.035));
    // tela larga (ou quadrada como no mockup): uma fileira; celular comprido: 2–3 fileiras para os tubos crescerem.
    var best = null;
    for (var r = 1; r <= 3; r++) {
      var per = Math.ceil(n / r);
      if (r > 1 && per < 2) break;
      var gap = Math.max(6, Math.round(W * (per >= 6 ? 0.024 : 0.032)));
      var twW = (W - 2 * padX - (per - 1) * gap) / per;
      var twH = (H - padTop - r * shelf - (r - 1) * rowGap) / r / TUBE_ASPECT;
      var tw = Math.floor(Math.min(twW, twH, 92));
      if (tw < 22) continue;
      // só aceita mais uma fileira se os tubos ficarem bem maiores (mantém a cara do mockup quando dá)
      if (!best || tw > best.tw * 1.12) best = { r: r, per: per, gap: gap, rowGap: rowGap, shelf: shelf, pad: padX, padY: padTop, tw: tw };
    }
    return best || { r: 3, per: Math.ceil(n / 3), gap: 6, rowGap: 10, shelf: 12, pad: 10, padY: 26, tw: 22 };
  }

  function segSvg(c, dropped) {
    return '<img class="seg' + (dropped ? ' just-dropped' : '') + '" src="' + pieceUrl(COLOR_NAMES[c]) + '" data-c="' + c + '" alt="" draggable="false">';
  }

  function render() {
    var n = state.tubes.length;
    board.innerHTML = '';
    if (n) {
      var L = layoutFor(n) || { r: 1, per: n, gap: 10, rowGap: 16, shelf: 8, pad: 12, tw: 50 };
      var panel = $('boardPanel');
      panel.style.setProperty('--pad', L.pad + 'px');
      panel.style.setProperty('--padY', (L.padY || L.pad) + 'px');
      panel.style.setProperty('--shelf', L.shelf + 'px');
      board.style.setProperty('--tw', L.tw + 'px');
      board.style.setProperty('--tgap', L.gap + 'px');
      board.style.setProperty('--rowgap', L.rowGap + 'px');
      board.style.setProperty('--shelf', L.shelf + 'px');
      var per = Math.ceil(n / L.r);
      var rows = [];
      for (var r = 0; r < L.r; r++) { var row = document.createElement('div'); row.className = 'tube-row'; board.appendChild(row); rows.push(row); }
      state.tubes.forEach(function (tube, idx) {
        var status = E.tubeStatus(tube);
        var el = document.createElement('button');
        el.type = 'button';
        var cls = ['tube'];
        if (state.selected === idx) cls.push('selected');
        if (status) cls.push(status);
        if (state.selected !== null && state.selected !== idx && E.canPour(state.tubes, state.selected, idx)) cls.push('valid');
        if (state.hint && (state.hint.from === idx || state.hint.to === idx)) cls.push('hint');
        el.className = cls.join(' ');
        el.setAttribute('aria-label', 'Tubo ' + (idx + 1) + ', ' + tube.length + ' de ' + CAP + ' cheio' + (state.selected === idx ? ', selecionado' : ''));
        var layers = '<div class="layers">';
        tube.forEach(function (c, bi) { layers += segSvg(c, idx === state.lastPourTo && bi === tube.length - 1); });
        layers += '</div>';
        el.innerHTML = layers +
          '<img class="glass-layer" src="' + ART.tubo + '" alt="" draggable="false">' +
          '<img class="st-sel" src="' + ART.selecionado + '" alt="" draggable="false">' +
          '<img class="st-valid" src="' + ART.valido + '" alt="" draggable="false">' +
          '<img class="st-done" src="' + ART.completo + '" alt="" draggable="false">';
        el.addEventListener('click', function () { handleTubeClick(idx); });
        rows[Math.min(L.r - 1, Math.floor(idx / per))].appendChild(el);
      });
    }
    $('boardHint').classList.toggle('gone', state.moves > 0 || state.selected !== null);
    $('levelValue').textContent = state.level;
    $('movesValue').textContent = state.moves;
    $('undoBtn').disabled = !levelInProgress() || state.history.length === 0;
    $('undoBadge').textContent = state.history.length;
    $('undoBadge').hidden = state.history.length === 0;
    var limit = state.hardLimit || 1;
    var fill = $('progressFill');
    fill.style.width = Math.min(100, state.moves / limit * 100) + '%';
    fill.className = 'meta-fill' + (state.moves > state.target ? (state.moves > state.target + (limit - state.target) / 2 ? ' over' : ' warn') : '');
    $('metaMark').style.left = (state.target / limit * 100) + '%';
    $('progressLabel').textContent = 'META ' + state.target + ' · LIMITE ' + limit;
    renderLives();
    syncCoinDisplays();
    state.lastPourTo = null;
  }
  if (window.ResizeObserver) new ResizeObserver(function () { if (currentView === 'game') render(); }).observe(boardWrap);

  // ===================== Efeitos =====================
  var POW_WORDS = ['POW!', 'BUM!', 'ZÁS!', 'PLAFT!'];
  function spawnPow(word, big) {
    var el = document.createElement('div');
    el.className = 'pow-burst' + (big ? ' big' : '');
    el.textContent = word;
    el.style.marginLeft = (Math.random() * 36 - 18) + 'px';
    el.style.marginTop = (Math.random() * 28 - 14) + 'px';
    app.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
  }
  function launchConfetti() {
    var canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.width = app.clientWidth;
    canvas.height = app.clientHeight;
    app.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var ps = [];
    for (var i = 0; i < 80; i++) {
      ps.push({ x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.3, r: 5 + Math.random() * 6,
        vy: 2 + Math.random() * 3, vx: -1.5 + Math.random() * 3, color: BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
        rot: Math.random() * Math.PI, vr: -0.2 + Math.random() * 0.4 });
    }
    var frame = 0;
    (function tick() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ps.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.strokeStyle = '#1b1109'; ctx.lineWidth = 1.5;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx.strokeRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        ctx.restore();
      });
      if (frame < 140) requestAnimationFrame(tick); else canvas.remove();
    })();
  }

  // ===================== Vitória =====================
  function rollReward() {
    var r = Math.random();
    if (r < 0.08) return { amount: 80 + Math.floor(Math.random() * 40), tag: 'PRÊMIO RARO!', jackpot: true };
    if (r < 0.30) return { amount: 35 + Math.floor(Math.random() * 20), tag: 'BÔNUS!', jackpot: false };
    return { amount: 10 + Math.floor(Math.random() * 15), tag: 'VOCÊ GANHOU', jackpot: false };
  }

  function onWin() {
    state.won = true;
    state.hint = null;
    saveBest(state.colors, state.moves);
    var perfect = state.moves <= state.target;
    var stars = E.starsForResult(state.moves, state.target, state.hardLimit);
    recordLevelResult(state.level, stars);
    var s = '';
    for (var i = 1; i <= 3; i++) s += ico('star', i <= stars ? 'on' : 'off');
    $('winStars').innerHTML = s;
    $('winStars').setAttribute('aria-label', stars + ' de 3 estrelas');
    var best = getBest(state.colors);
    $('winSub').textContent = state.moves + (state.moves === 1 ? ' movimento' : ' movimentos') +
      (perfect ? ' · dentro da meta!' : ' · meta: ' + state.target) + (best !== null ? ' · recorde ' + best : '');
    state.pendingReward = rollReward();
    $('rewardTag').textContent = 'VOCÊ GANHOU';
    $('rewardTag').className = 'reward-tag';
    $('rewardLine').innerHTML = ico('chest', 'chest') + '<span class="reward-hint">Abra o baú</span>';
    $('winMainLabel').textContent = 'ABRIR BAÚ';
    $('winMainBtn').dataset.step = 'chest';
    $('view-win').classList.remove('shake');
    $('view-win').hidden = false;
    if (!reducedMotion()) launchConfetti();
    spawnPow(perfect ? 'ZÁS!' : 'PLAFT!', true);
    sfxWin();
    vibrate([20, 40, 20]);
  }

  function openChest() {
    var reward = state.pendingReward || rollReward();
    state.pendingReward = null;
    addCoins(reward.amount);
    $('rewardTag').textContent = reward.tag;
    $('rewardTag').className = 'reward-tag' + (reward.jackpot ? ' jackpot' : '');
    $('rewardLine').innerHTML = ico('coin') + '<span>' + reward.amount + '</span>';
    $('winMainBtn').dataset.step = 'next';
    $('winMainLabel').textContent = state.level >= TOTAL_LEVELS ? 'VOLTAR ÀS FASES' : 'PRÓXIMO NÍVEL';
    sfxWin();
    if (reward.jackpot && !reducedMotion()) {
      var w = $('view-win'); w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake');
      launchConfetti(); spawnPow('BUM!', true);
    }
  }
  // quem sai da tela de vitória sem abrir o baú não perde o prêmio
  function claimChest() {
    if (state.pendingReward && state.won) {
      var r = state.pendingReward; state.pendingReward = null;
      addCoins(r.amount);
      showToast('Baú aberto: +' + r.amount + ' moedas');
    }
  }

  function nextLevel() {
    claimChest();
    if (state.level >= TOTAL_LEVELS) { showView('levels'); showToast('Você completou todas as fases!'); return; }
    $('view-win').hidden = true;
    startLevel(state.level + 1);
    if (!reducedMotion()) { var f = $('levelFlash'); f.classList.remove('active'); void f.offsetWidth; f.classList.add('active'); }
  }

  // ===================== Derrota / sem vidas =====================
  function onFail() {
    state.gate = 'failed';
    state.selected = null;
    loseLife();
    renderLives();
    render();
    sfxError();
    vibrate(80);
    openFail();
  }

  function openFail() {
    var out = state.lives <= 0;
    if (out) state.gate = 'nolives';
    $('failTitle').textContent = 'OPS!';
    $('failRibbon').textContent = out ? 'SEM VIDAS' : 'TENTE NOVAMENTE';
    updateFailText();
    $('failMainLabel').textContent = out ? 'VER VIDAS' : 'TENTAR DE NOVO';
    $('failMainBtn').dataset.mode = out ? 'lives' : 'retry';
    $('failLivesBadge').textContent = state.lives;
    $('view-fail').hidden = false;
  }
  function updateFailText() {
    var out = state.lives <= 0;
    $('failMessage').textContent = out
      ? 'Suas vidas acabaram. Próxima vida em ' + (state.nextRefillAt ? formatCountdown(state.nextRefillAt - Date.now()) : '--:--') + '. Você também pode trocar moedas por vidas.'
      : 'Passou do limite de ' + state.hardLimit + ' movimentos. Vidas restantes: ' + state.lives + '.';
  }

  // ===================== Ligações dos botões =====================
  function on(id, fn) { $(id).addEventListener('click', function (e) { sfxClick(); fn(e); }); }

  on('playBtn', function () { showView('levels'); });
  on('homeSettingsBtn', function () { openSecondary('settings'); });
  on('homeShopBtn', function () { openSecondary('shop'); });
  on('homeRankingBtn', function () { openSecondary('ranking'); });
  on('levelsBackBtn', function () { showView('home'); });
  on('levelsCoinBtn', function () { openSecondary('shop'); });
  on('gameBackBtn', function () { showView('levels'); });
  on('gamePowerupsBtn', function () { openSecondary('powerups'); });
  on('gameCoinBtn', function () { openSecondary('shop'); });
  on('gameLivesBtn', function () { openSecondary('lives'); });
  ['shop', 'lives', 'powerups', 'settings', 'ranking'].forEach(function (v) { on(v + 'Back' + 'Btn', goBack); });
  on('livesCoinBtn', function () { openSecondary('shop'); });
  on('powerupsCoinBtn', function () { openSecondary('shop'); });

  on('undoBtn', function () { if (!undo()) showToast('Nada para desfazer.'); });
  on('hintBtn', doHint);
  on('extraTubeBtn', doExtraTube);
  on('restartBtn', restart);

  on('powerupsUndoBtn', function () { if (undo()) { showView('game'); showToast('Movimento desfeito.'); } else showToast('Nada para desfazer ainda.'); });
  on('powerupsHintBtn', function () { if (doHint()) showView('game'); });
  on('powerupsExtraBtn', function () { if (doExtraTube()) showView('game'); });

  on('livesBuyOneBtn', function () {
    if (!TEST_MODE) { paymentUnavailable('Comprar +1 vida'); return; }
    gainLife(1); renderLivesScreen(); showToast('+1 vida (modo de teste)');
  });
  on('livesBuyFiveBtn', function () {
    if (!TEST_MODE) { paymentUnavailable('Comprar +5 vidas'); return; }
    gainLife(5); renderLivesScreen(); showToast('+5 vidas (modo de teste)');
  });
  on('livesCoinBuyBtn', function () {
    syncLives();
    if (state.lives >= MAX_LIVES) { showToast('Suas vidas já estão cheias.'); return; }
    if (!spendCoins(LIFE_COIN_COST)) return;
    gainLife(1); renderLivesScreen(); sfxWin(); showToast('+1 vida!');
  });

  $('settingMusic').addEventListener('change', function (e) {
    settings.music = e.target.checked; save(SETTINGS_KEY, settings);
    if (settings.music) startMusic(); else stopMusic();
  });
  $('settingSfx').addEventListener('change', function (e) { settings.sfx = e.target.checked; save(SETTINGS_KEY, settings); if (settings.sfx) sfxClick(); });
  $('settingVibration').addEventListener('change', function (e) { settings.vibration = e.target.checked; save(SETTINGS_KEY, settings); vibrate(30); });
  on('settingHelpRow', function () {
    openModal('Como jogar',
      '<ul><li>Toque em um tubo para pegar a cor do topo e toque em outro para despejar.</li>' +
      '<li>Só dá para despejar em tubo vazio ou com a mesma cor no topo e com espaço.</li>' +
      '<li>Junte cada cor em um tubo. Fique dentro da meta para ganhar 3 estrelas.</li>' +
      '<li>Passou do limite de movimentos? Você perde 1 vida.</li>' +
      '<li>Reforços: desfazer (grátis), dica (' + HINT_COST + ' moedas) e tubo extra (' + EXTRA_TUBE_COST + ' moedas).</li></ul>');
  });
  on('settingPrivacyRow', function () {
    openModal('Privacidade',
      '<p>O Tubo Certo não coleta dados pessoais, não usa contas e não envia nada para servidores.</p>' +
      '<p>Moedas, vidas, estrelas e preferências ficam apenas no armazenamento local deste aparelho (localStorage) e podem ser apagadas em <b>Apagar progresso</b>.</p>');
  });
  on('settingResetRow', function () {
    openModal('Apagar progresso?', '<p>Isso zera moedas, vidas, estrelas e recordes deste aparelho. Não dá para desfazer.</p>', [
      { label: 'APAGAR', cls: 'danger', onClick: function () {
        try {
          Object.keys(localStorage).forEach(function (k) { if (k.indexOf('tubo-certo-') === 0 && k !== SETTINGS_KEY) localStorage.removeItem(k); });
        } catch (e) { /* ignore */ }
        location.reload();
      } },
      { label: 'CANCELAR', cls: 'alt' }
    ]);
  });

  on('rankTabGlobal', function () { rankTab = 'global'; renderRanking(); });
  on('rankTabFriends', function () { rankTab = 'friends'; renderRanking(); });

  $('winMainBtn').addEventListener('click', function () {
    sfxClick();
    if ($('winMainBtn').dataset.step === 'chest') openChest(); else nextLevel();
  });
  on('winHomeBtn', function () { showView('home'); });
  on('winRetryBtn', function () { claimChest(); restart(); });
  on('winShareBtn', function () {
    var text = 'Terminei o nível ' + state.level + ' de Tubo Certo em ' + state.moves + ' movimentos!';
    if (navigator.share) navigator.share({ title: 'Tubo Certo', text: text }).catch(function () { /* cancelado */ });
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { showToast('Texto copiado para compartilhar!'); }, function () { showToast(text, 4000); });
    else showToast(text, 4000);
  });

  $('failMainBtn').addEventListener('click', function () {
    sfxClick();
    if ($('failMainBtn').dataset.mode === 'lives') openSecondary('lives'); else restart();
  });
  on('failHomeBtn', function () { showView('home'); });
  on('failLevelsBtn', function () { showView('levels'); });
  on('failLivesBtn', function () { openSecondary('lives'); });
  $('streakBanner').addEventListener('click', function () { $('streakBanner').hidden = true; });

  // ===================== Início =====================
  function start() {
    [ART.tubo, ART.selecionado, ART.valido, ART.completo].concat(COLOR_NAMES.map(pieceUrl)).forEach(function (u) { new Image().src = u; });
    state.coins = loadCoins();
    syncLives();
    renderLives();
    syncCoinDisplays();
    showView('home');

    var info = checkDailyStreak();
    if (info) {
      var txt = 'Sequência de ' + info.count + (info.count === 1 ? ' dia' : ' dias') + '! +' + info.bonus + ' moedas';
      $('streakText').textContent = txt;
      $('streakBanner').hidden = false;
    }

    setInterval(function () {
      var before = state.lives;
      syncLives();
      renderLives();
      if (currentView === 'lives') renderLivesScreen();
      if (!$('view-fail').hidden) {
        if (state.gate === 'nolives' && state.lives > 0) {
          state.gate = null; $('view-fail').hidden = true; // vida regenerou: libera o jogo
        } else updateFailText();
      }
      if (state.lives > before && currentView === 'game') render();
    }, 1000);
  }
  start();
})();
