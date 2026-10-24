/*
  Testa boas-vindas, tutorial da fase 1 e dica grátis na primeira fase difícil.
  Uso: python3 -m http.server 8123 ; NODE_PATH=$(npm root -g) node tests/onboarding.js
*/
const { chromium } = require('playwright');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
const URL = 'http://localhost:8123/index.html?teste=1&tutorial=1';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const coins = async () => +(await p.textContent('#homeCoins, [data-coins]'));
  const tubes = () => p.evaluate(() => [...document.querySelectorAll('#board .tube')].map(t => [...t.querySelectorAll('.seg')].map(s => +s.dataset.c)));
  const nextMove = async () => (await p.evaluate(t => window.TuboEngine.solvePath(t, 60000), await tubes()))[0];

  console.log('# boas-vindas');
  await p.goto(URL); await p.waitForTimeout(600);
  ok((await coins()) === 155, 'primeira abertura: 150 de boas-vindas + 5 da sequência = 155 moedas (' + (await coins()) + ')');
  ok((await p.textContent('#streakText')).includes('Bem-vindo'), 'aviso de boas-vindas aparece na tela inicial');
  await p.reload(); await p.waitForTimeout(500);
  ok((await coins()) === 155, 'segunda abertura: o presente NÃO é dado de novo');

  console.log('# tutorial da fase 1');
  await p.click('#playBtn'); await p.locator('.level-tile:not(.locked)').first().click(); await p.waitForTimeout(500);
  ok(await p.isVisible('#tut') && await p.isVisible('#tutHand'), 'tutorial aparece com a mão');
  ok((await p.textContent('#tutText')).includes('Toque neste tubo'), 'passo 1: "Toque neste tubo..."');
  const mv = await nextMove();
  // mão aponta para o tubo certo
  const handX = await p.evaluate(() => { const h = document.getElementById('tutHand').getBoundingClientRect(); return h.left + h.width * 29 / 64; });
  const tubeX = await p.evaluate(i => { const r = document.querySelectorAll('#board .tube')[i].getBoundingClientRect(); return r.left + r.width / 2; }, mv[0]);
  ok(Math.abs(handX - tubeX) < 3, 'a mão está embaixo do tubo de origem esperado');
  // tocar no tubo errado não faz nada
  const wrong = (await tubes()).map((t, i) => i).filter(i => i !== mv[0])[0];
  await p.locator('#board .tube').nth(wrong).click();
  ok((await p.locator('#board .tube.selected').count()) === 0, 'tubo errado é ignorado durante o tutorial');
  await p.locator('#board .tube').nth(mv[0]).click();
  ok((await p.textContent('#tutText')).includes('Agora toque aqui'), 'passo 2: "Agora toque aqui"');
  await p.locator('#board .tube').nth(mv[1]).click();
  ok((await p.textContent('#movesValue')) === '1' && (await p.textContent('#tutText')).includes('Isso!'), 'depois da 1ª jogada elogia e pede a 2ª');
  const mv2 = await nextMove();
  await p.locator('#board .tube').nth(mv2[0]).click(); await p.locator('#board .tube').nth(mv2[1]).click(); await p.waitForTimeout(300);
  ok((await p.textContent('#tutText')).includes('Muito bem'), 'fim: mensagem "Muito bem!"');
  await p.waitForTimeout(2900);
  ok(!(await p.isVisible('#tut')), 'tutorial some sozinho');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('tubo-certo-onboard')).tutorial) === true, 'tutorial marcado como concluído');
  await p.locator('#board .tube').nth(0).click(); ok((await p.locator('#board .tube.selected').count()) <= 1, 'depois do tutorial o jogo é livre');
  await p.click('#gameBackBtn'); await p.locator('.level-tile:not(.locked)').first().click(); await p.waitForTimeout(400);
  ok(!(await p.isVisible('#tut')), 'o tutorial não volta na próxima vez');

  console.log('# pular o tutorial');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('tubo-certo-onboard')); o.tutorial = false; localStorage.setItem('tubo-certo-onboard', JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(400); await p.click('#playBtn'); await p.locator('.level-tile:not(.locked)').first().click(); await p.waitForTimeout(400);
  ok(await p.isVisible('#tut'), 'tutorial volta se não foi concluído');
  await p.click('#tutSkip'); await p.waitForTimeout(200);
  ok(!(await p.isVisible('#tut')) && await p.evaluate(() => JSON.parse(localStorage.getItem('tubo-certo-onboard')).tutorial) === true, 'PULAR encerra e marca como concluído');

  console.log('# dica grátis na primeira fase difícil');
  await p.evaluate(() => localStorage.setItem('tubo-certo-levels', JSON.stringify({ unlocked: 8, stars: {} })));
  await p.reload(); await p.waitForTimeout(400); await p.click('#playBtn');
  await p.locator('.level-tile:not(.locked)').nth(3).click(); await p.waitForTimeout(500);       // fase 4 (média): sem presente
  ok((await p.textContent('#hintBadge')) === '50', 'fase média: dica continua custando 50');
  await p.click('#gameBackBtn'); await p.locator('.level-tile:not(.locked)').nth(4).click(); await p.waitForTimeout(700);   // fase 5 (difícil)
  ok((await p.textContent('#hintBadge')) === 'GRÁTIS', 'primeira fase difícil: selo da dica vira GRÁTIS');
  const c0 = await coins();
  await p.click('#hintBtn'); await p.waitForTimeout(300);
  ok((await coins()) === c0 && (await p.locator('#board .tube.hint').count()) === 2, 'dica grátis mostra o movimento e NÃO gasta moedas');
  ok((await p.textContent('#hintBadge')) === '50', 'depois de usar, volta a custar 50');
  await p.click('#hintBtn'); await p.waitForTimeout(300);
  ok((await coins()) === c0 - 50, 'a próxima dica custa 50 moedas');
  await p.click('#gameBackBtn'); await p.locator('.level-tile:not(.locked)').nth(4).click(); await p.waitForTimeout(500);
  ok((await p.textContent('#hintBadge')) === '50', 'o presente é dado uma vez só (não repete ao reentrar na fase 5)');

  console.log('# jogador antigo');
  const p2 = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p2.addInitScript(() => { localStorage.setItem('tubo-certo-coins', '40'); });
  await p2.goto(URL); await p2.waitForTimeout(500);
  const c2 = +(await p2.textContent('#homeCoins, [data-coins]'));
  ok(c2 === 45, 'quem já tinha progresso não ganha o presente de boas-vindas (' + c2 + ' = 40 + 5 da sequência)');
  await p2.click('#playBtn'); await p2.locator('.level-tile:not(.locked)').first().click(); await p2.waitForTimeout(400);
  ok(!(await p2.isVisible('#tut')), 'nem o tutorial');

  console.log('\\nerros de página:', errs.length ? errs.join('\\n') : 'nenhum');
  console.log(`resultado: ${pass} ok, ${fail} falhas`);
  await browser.close(); process.exit(fail || errs.length ? 1 : 0);
})();
