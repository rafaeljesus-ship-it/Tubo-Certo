/*
  Teste do gerador de fases (sem navegador): para as fases 1..60, gera várias vezes e confere
  - o ritmo 3 fáceis / 1 média / 1 difícil;
  - que TODO tabuleiro tem solução: reexecuta a solução passo a passo no tabuleiro inicial e confere que termina resolvido;
  - que o limite de movimentos comporta a solução;
  - tempo de geração.   Uso: node tests/levels.js
*/
const E = require('../js/engine.js');
let fail = 0, pass = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } }
const ROUNDS = 5, N = 60;
const stats = {};
let worst = 0;
for (let r = 0; r < ROUNDS; r++) {
  for (let lv = 1; lv <= N; lv++) {
    const t0 = Date.now();
    const g = E.generateForLevel(lv);
    const dt = Date.now() - t0; worst = Math.max(worst, dt);
    const spec = E.levelSpec(lv);
    const tier = ['easy', 'easy', 'easy', 'medium', 'hard'][(lv - 1) % 5];
    ok(g.spec.tier === tier, `fase ${lv}: dificuldade ${g.spec.tier} esperada ${tier}`);
    // solução reproduzível a partir do tabuleiro inicial
    const path = E.solvePath(E.deepClone(g.tubes), 60000);
    ok(path !== null, `fase ${lv}: solver não achou solução`);
    if (path) {
      const t = E.deepClone(g.tubes);
      for (const [a, b] of path) { ok(E.canPour(t, a, b), `fase ${lv}: jogada ilegal na solução`); E.applyPour(t, a, b); }
      ok(E.isSolved(t), `fase ${lv}: solução não resolve o tabuleiro`);
      ok(path.length <= g.hardLimit, `fase ${lv}: limite ${g.hardLimit} menor que a solução ${path.length}`);
    }
    ok(g.tubes.length === g.spec.colors + g.empties, `fase ${lv}: quantidade de tubos`);
    ok(g.tubes.every(t => t.length === 4 || t.length === 0), `fase ${lv}: tubos com 4 ou vazios`);
    (stats[lv] = stats[lv] || []).push({ opt: g.optimal, tubes: g.tubes.length, empties: g.empties, limit: g.hardLimit });
  }
}
console.log('fase  dif      cores vazios  solução(min-méd-max)  limite(méd)');
for (const lv of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,20,25,30,40,50,60]) {
  const a = stats[lv], sp = E.levelSpec(lv);
  const o = a.map(x => x.opt).sort((x, y) => x - y);
  console.log(String(lv).padStart(3), ' ', sp.label.padEnd(8), String(sp.colors).padStart(4), String(a[0].empties).padStart(6), '  ', `${o[0]}-${o[o.length >> 1]}-${o[o.length - 1]}`.padEnd(18), Math.round(a.reduce((s, x) => s + x.limit, 0) / a.length));
}
console.log(`\\ngeração mais lenta: ${worst} ms`);
ok(worst < 3000, 'geração lenta demais');
console.log(`resultado: ${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
