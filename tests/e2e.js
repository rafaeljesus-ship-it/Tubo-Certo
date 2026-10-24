/*
  Teste ponta a ponta do Tubo Certo (Playwright).
  Uso:  python3 -m http.server 8123   (na raiz do projeto)
        NODE_PATH=$(npm root -g) node tests/e2e.js [pasta-das-capturas]
*/
const { chromium } = require('playwright');
const OUT = process.argv[2] || '/tmp/shots';
const URL = 'http://localhost:8123/index.html';
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } }

async function readTubes(p) {
  return p.evaluate(() => [...document.querySelectorAll('#board .tube')].map(t => [...t.querySelectorAll('.seg')].map(s => +s.dataset.c)));
}
async function solveAndPlay(p) {
  const tubes = await readTubes(p);
  const path = await p.evaluate(t => window.TuboEngine.solvePath(t, 60000), tubes);
  if (!path) return false;
  for (const [a, b] of path) {
    await p.locator('#board .tube').nth(a).click();
    await p.locator('#board .tube').nth(b).click();
  }
  return path.length;
}
async function coins(p) { return +(await p.textContent('#view-home [data-coins], #view-game [data-coins]')); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });

  console.log('# navegação');
  await p.goto(URL + '?teste=1'); await p.waitForTimeout(500);
  await shot('01_inicial');
  ok(await p.isVisible('#view-home'), 'tela inicial visível');
  await p.click('#homeSettingsBtn'); ok(await p.isVisible('#view-settings'), 'home → configurações'); await shot('09_configuracoes');
  await p.click('#settingHelpRow'); ok(await p.isVisible('#modal'), 'ajuda abre modal'); await shot('09b_ajuda');
  await p.click('#modalActions button'); ok(!(await p.isVisible('#modal')), 'modal fecha');
  await p.click('#settingsBackBtn'); ok(await p.isVisible('#view-home'), 'configurações → home');
  await p.click('#homeShopBtn'); ok(await p.isVisible('#view-shop'), 'home → loja'); await shot('06_loja');
  const before = +(await p.textContent('#view-shop [data-coins]'));
  await p.locator('#shopList .buy-btn').nth(1).click();
  const after = +(await p.textContent('#view-shop [data-coins]'));
  ok(after === before + 500, `loja (modo de teste) credita 500 moedas (${before} → ${after})`);
  await p.click('#shopBackBtn');
  await p.click('#homeRankingBtn'); ok(await p.isVisible('#view-ranking'), 'home → ranking'); await shot('10_ranking');
  await p.click('#rankTabFriends'); ok((await p.locator('#rankList .rank-row').count()) === 4, 'aba Amigos lista 3 amigos + você');
  await p.click('#rankingBackBtn');
  await p.click('#playBtn'); ok(await p.isVisible('#view-levels'), 'home → fases'); await shot('02_fases');
  ok((await p.locator('.level-tile:not(.locked)').count()) === 1, 'só a fase 1 está liberada');
  await p.locator('#levelDots button').nth(1).click(); ok((await p.locator('.level-tile').first().textContent()).includes('13'), 'paginação: página 2 começa na fase 13');
  await p.locator('#levelDots button').nth(0).click();

  console.log('# puzzle');
  await p.click('.level-tile:not(.locked)'); ok(await p.isVisible('#view-game'), 'fase 1 abre o puzzle');
  await p.waitForTimeout(300); await shot('03_puzzle');
  let tubes = await readTubes(p);
  ok(tubes.length === 5 && tubes.slice(0, 3).every(t => t.length === 4), 'fase 1: 3 cores + 2 tubos vazios');
  // movimento ilegal não conta
  const mv0 = await p.textContent('#movesValue');
  // selecionar e desselecionar
  await p.locator('#board .tube').nth(0).click(); ok(await p.locator('#board .tube.selected').count() === 1, 'tubo selecionado ao tocar');
  await p.locator('#board .tube').nth(0).click(); ok(await p.locator('#board .tube.selected').count() === 0, 'tocar de novo desseleciona');
  // movimento válido: tubo 0 → vazio (índice 3)
  await p.locator('#board .tube').nth(0).click(); await p.locator('#board .tube').nth(3).click();
  ok((await p.textContent('#movesValue')) === String(+mv0 + 1), 'movimento válido incrementa o contador');
  await p.click('#undoBtn'); ok((await p.textContent('#movesValue')) === mv0, 'desfazer volta o movimento');
  const t1 = JSON.stringify(await readTubes(p));
  await p.click('#restartBtn'); ok(JSON.stringify(await readTubes(p)) === t1, 'reiniciar volta ao mesmo tabuleiro inicial');

  console.log('# reforços');
  const c0 = +(await p.textContent('#view-game [data-coins]'));
  await p.click('#hintBtn'); await p.waitForTimeout(200);
  ok(+(await p.textContent('#view-game [data-coins]')) === c0 - 50, 'dica custa 50 moedas');
  ok(await p.locator('#board .tube.hint').count() === 2, 'dica destaca 2 tubos'); await shot('03b_dica');
  await p.click('#extraTubeBtn'); await p.waitForTimeout(200);
  ok((await p.locator('#board .tube').count()) === 6, 'tubo extra adiciona 1 tubo');
  ok(+(await p.textContent('#view-game [data-coins]')) === c0 - 150, 'tubo extra custa 100 moedas');
  await p.click('#restartBtn'); ok((await p.locator('#board .tube').count()) === 5, 'reiniciar remove o tubo extra');
  await p.click('#gamePowerupsBtn'); ok(await p.isVisible('#view-powerups'), 'puzzle → reforços'); await shot('08_reforcos');
  await p.click('#powerupsBackBtn'); ok(await p.isVisible('#view-game'), 'reforços → volta ao puzzle');
  await p.click('#gameLivesBtn'); ok(await p.isVisible('#view-lives'), 'cartão de vidas abre a tela de vidas'); await shot('07_vidas');
  await p.click('#livesBackBtn');

  console.log('# vitória');
  const n = await solveAndPlay(p);
  ok(n > 0, `solver resolveu a fase 1 em ${n} movimentos`);
  await p.waitForTimeout(900);
  ok(await p.isVisible('#view-win'), 'tela de vitória aparece'); await shot('04_vitoria');
  ok((await p.locator('#winStars .ico.on').count()) >= 1, 'ganhou ao menos 1 estrela');
  const cw = +(await p.textContent('#view-game [data-coins]'));
  await p.click('#winMainBtn'); await p.waitForTimeout(200); await shot('04b_bau');
  const cw2 = +(await p.textContent('#view-game [data-coins]'));
  ok(cw2 > cw, `baú abre e credita moedas (${cw} → ${cw2})`);
  await p.click('#winMainBtn'); await p.waitForTimeout(500);
  ok((await p.textContent('#levelValue')) === '2', 'PRÓXIMO NÍVEL abre a fase 2');
  await p.click('#gameBackBtn');
  ok((await p.locator('.level-tile:not(.locked)').count()) === 2, 'fase 2 liberada no mapa');
  ok((await p.locator('.level-tile').first().locator('.ico.on').count()) >= 1, 'estrelas salvas na fase 1');

  console.log('# derrota');
  await p.locator('.level-tile:not(.locked)').nth(1).click();
  const lim = await p.evaluate(() => +document.getElementById('progressLabel').textContent.split('LIMITE ')[1]);
  const vidas0 = +(await p.textContent('#gameLivesNum'));
  for (let i = 0; i < lim + 3; i++) {
    if (await p.isVisible('#view-fail')) break;
    const t = await readTubes(p);
    // procura um despejo legal e que não resolva a fase
    // despejo legal aleatório que NÃO resolve a fase (para forçar a derrota)
    const mv = await p.evaluate(t => { const E = window.TuboEngine; const c = [];
      for (let a = 0; a < t.length; a++) for (let b = 0; b < t.length; b++) if (E.canPour(t, a, b)) { const x = E.deepClone(t); E.applyPour(x, a, b); if (!E.isSolved(x)) c.push([a, b]); }
      return c.length ? c[Math.floor(Math.random() * c.length)] : null; }, t);
    if (!mv) break;
    await p.locator('#board .tube').nth(mv[0]).click(); await p.locator('#board .tube').nth(mv[1]).click();
  }
  await p.waitForTimeout(400);
  ok(await p.isVisible('#view-fail'), 'tela de derrota aparece ao passar do limite'); await shot('05_derrota');
  ok(+(await p.textContent('#gameLivesNum')) === vidas0 - 1, 'derrota consome 1 vida');
  await p.click('#failMainBtn'); await p.waitForTimeout(300);
  ok(!(await p.isVisible('#view-fail')) && (await p.textContent('#movesValue')) === '0', 'TENTAR DE NOVO reinicia a fase');

  console.log('# sem vidas');
  await p.evaluate(() => { localStorage.setItem('tubo-certo-lives', JSON.stringify({ lives: 0, nextRefillAt: Date.now() + 900000 })); });
  await p.goto(URL); await p.waitForTimeout(400); // sem ?teste=1: pagamentos não creditam
  await p.click('#playBtn'); await p.locator('.level-tile:not(.locked)').first().click(); await p.waitForTimeout(300);
  ok(await p.isVisible('#view-fail'), 'sem vidas: fase abre com aviso'); await shot('05b_sem_vidas');
  ok((await p.textContent('#failRibbon')).includes('SEM VIDAS'), 'faixa diz SEM VIDAS');
  await p.locator('#board .tube').nth(0).click({ force: true });
  ok((await p.locator('#board .tube.selected').count()) === 0, 'tabuleiro bloqueado sem vidas');
  await p.click('#failMainBtn'); ok(await p.isVisible('#view-lives'), 'VER VIDAS abre a tela de vidas');
  await p.click('#livesBuyOneBtn'); ok(await p.isVisible('#modal'), 'compra em R$ mostra aviso de pagamento indisponível'); await p.click('#modalActions button');
  await p.click('#livesCoinBuyBtn'); await p.waitForTimeout(200);
  ok((await p.locator('#livesHeartsBig .heart.full').count()) === 1, 'trocar moedas por vida funciona (1 vida)');
  await p.click('#livesBackBtn'); await p.waitForTimeout(200);
  ok(!(await p.isVisible('#view-fail')), 'com vida de volta, o jogo é liberado');
  await p.locator('#board .tube').nth(0).click(); ok((await p.locator('#board .tube.selected').count()) === 1, 'tabuleiro volta a responder');

  console.log('# configurações');
  await p.click('#gameBackBtn'); await p.click('#levelsBackBtn'); await p.click('#homeSettingsBtn');
  await p.locator('label.set-row').nth(2).click();
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('tubo-certo-settings')));
  ok(st.vibration === false, 'toggle de vibração é salvo');
  await p.locator('label.set-row').nth(0).click();
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('tubo-certo-settings')).music)) === true, 'toggle de música é salvo (e inicia a música)');
  await p.locator('label.set-row').nth(0).click();

  console.log('# responsividade');
  const sizes = { 'cel_360x640': [360, 640], 'cel_320x568': [320, 568], 'cel_412x915': [412, 915], 'desktop_1280x800': [1280, 800] };
  for (const [name, [w, h]] of Object.entries(sizes)) {
    await p.setViewportSize({ width: w, height: h });
    await p.evaluate(() => localStorage.setItem('tubo-certo-lives', JSON.stringify({ lives: 5, nextRefillAt: null })));
    await p.goto(URL + '?teste=1'); await p.waitForTimeout(400);
    await shot(`r_${name}_home`);
    await p.click('#playBtn'); await shot(`r_${name}_fases`);
    await p.locator('.level-tile:not(.locked)').nth(1).click(); await p.waitForTimeout(300); await shot(`r_${name}_puzzle`);
    const over = await p.evaluate(() => { const a = document.getElementById('app'); return document.documentElement.scrollWidth > window.innerWidth || a.scrollWidth > a.clientWidth + 1; });
    ok(!over, `${name}: sem rolagem horizontal`);
    const cut = await p.evaluate(() => { const b = document.getElementById('boardWrap').getBoundingClientRect(); return [...document.querySelectorAll('#board .tube')].some(t => { const r = t.getBoundingClientRect(); return r.left < b.left || r.right > b.right || r.top < b.top; }); });
    ok(!cut, `${name}: tubos dentro do tabuleiro`);
    await p.click('#gameBackBtn'); await p.click('#levelsBackBtn');
    for (const [b, v] of [['#homeShopBtn', 'shop'], ['#homeRankingBtn', 'ranking'], ['#homeSettingsBtn', 'settings']]) {
      await p.click(b); await shot(`r_${name}_${v}`);
      const clipped = await p.evaluate(v => { const s = document.querySelector('#view-' + v + ' .scroll'); return s.scrollHeight > s.clientHeight + 2; }, v);
      if (clipped) console.log(`  info ${name}/${v}: conteúdo rola dentro da tela (ok, nada cortado)`);
      await p.click(`#${v}BackBtn`);
    }
  }

  console.log('\nerros de console/página:', errs.length ? '\n' + errs.join('\n') : 'nenhum');
  console.log(`\nresultado: ${pass} ok, ${fail} falhas`);
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
