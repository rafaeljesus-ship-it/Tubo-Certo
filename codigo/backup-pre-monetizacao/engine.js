/*
  Tubo Certo — motor do puzzle (lógica pura, sem DOM).
  Preservado do código original: despejo de cores, gerador de fases com
  verificação de solubilidade por A* ponderado, metas e limite de movimentos.
*/
(function (root) {
  'use strict';

  var CAP = 4;

  function topRun(tube) {
    if (!tube.length) return { color: null, count: 0 };
    var c = tube[tube.length - 1];
    var n = 0;
    for (var i = tube.length - 1; i >= 0 && tube[i] === c; i--) n++;
    return { color: c, count: n };
  }

  function canPour(tubes, from, to) {
    if (from === to) return false;
    var src = tubes[from], dst = tubes[to];
    if (!src.length) return false;
    var run = topRun(src);
    if (CAP - dst.length <= 0) return false;
    if (dst.length > 0 && dst[dst.length - 1] !== run.color) return false;
    return true;
  }

  function applyPour(tubes, from, to) {
    var src = tubes[from], dst = tubes[to];
    var run = topRun(src);
    var amount = Math.min(run.count, CAP - dst.length);
    for (var i = 0; i < amount; i++) dst.push(src.pop());
    return amount;
  }

  function isSolved(tubes) {
    return tubes.every(function (t) {
      if (t.length === 0) return true;
      if (t.length !== CAP) return false;
      return t.every(function (c) { return c === t[0]; });
    });
  }

  // 'solved' = cheio de uma cor; 'almost' = a um despejo de fechar.
  function tubeStatus(tube) {
    if (!tube.length) return null;
    var uniform = tube.every(function (c) { return c === tube[0]; });
    if (!uniform) return null;
    if (tube.length === CAP) return 'solved';
    if (tube.length === CAP - 1) return 'almost';
    return null;
  }

  // Preenchimento aleatório verdadeiro, depois verificado como solúvel.
  function randomFillTubes(colors, emptyCount) {
    var balls = [];
    for (var c = 0; c < colors; c++) for (var k = 0; k < CAP; k++) balls.push(c);
    for (var i = balls.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = balls[i]; balls[i] = balls[j]; balls[j] = tmp;
    }
    var tubes = [];
    for (var t = 0; t < colors; t++) tubes.push(balls.slice(t * CAP, (t + 1) * CAP));
    for (var e = 0; e < emptyCount; e++) tubes.push([]);
    return tubes;
  }

  function deepClone(tubes) { return tubes.map(function (t) { return t.slice(); }); }
  function tubesKey(tubes) { return tubes.map(function (t) { return t.join(','); }).join('|'); }

  function heuristic(tubes) {
    var h = 0;
    for (var i = 0; i < tubes.length; i++) {
      var t = tubes[i];
      for (var k = 1; k < t.length; k++) if (t[k] !== t[k - 1]) h++;
    }
    return h;
  }

  function makeMinHeap() {
    var a = [];
    function up(i) {
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        var tmp = a[p]; a[p] = a[i]; a[i] = tmp; i = p;
      }
    }
    function down(i) {
      while (true) {
        var l = i * 2 + 1, r = i * 2 + 2, s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break;
        var tmp = a[s]; a[s] = a[i]; a[i] = tmp; i = s;
      }
    }
    return {
      push: function (item) { a.push(item); up(a.length - 1); },
      pop: function () { var top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
      size: function () { return a.length; }
    };
  }

  // A* ponderado (peso 3): verifica que a fase tem solução. Devolve a lista de
  // movimentos [[de, para], ...] da solução encontrada, ou null se o orçamento
  // de nós estourar. Não garante a solução mais curta, só uma boa e rápida.
  function solvePath(startTubes, maxNodes) {
    var heap = makeMinHeap();
    heap.push({ tubes: startTubes, g: 0, f: heuristic(startTubes) * 3, parent: null, move: null });
    var bestG = {};
    bestG[tubesKey(startTubes)] = 0;
    var nodes = 0;
    while (heap.size() && nodes < maxNodes) {
      var cur = heap.pop();
      nodes++;
      if (isSolved(cur.tubes)) {
        var path = [];
        for (var n = cur; n.parent; n = n.parent) path.push(n.move);
        return path.reverse();
      }
      var curKey = tubesKey(cur.tubes);
      if (bestG[curKey] < cur.g) continue;
      for (var i = 0; i < cur.tubes.length; i++) {
        if (!cur.tubes[i].length) continue;
        for (var j = 0; j < cur.tubes.length; j++) {
          if (i === j || !canPour(cur.tubes, i, j)) continue;
          var next = deepClone(cur.tubes);
          applyPour(next, i, j);
          var key = tubesKey(next);
          var g2 = cur.g + 1;
          if (bestG[key] !== undefined && bestG[key] <= g2) continue;
          bestG[key] = g2;
          heap.push({ tubes: next, g: g2, f: g2 + heuristic(next) * 3, parent: cur, move: [i, j] });
        }
      }
    }
    return null;
  }
  function findSolution(startTubes, maxNodes) {
    var path = solvePath(startTubes, maxNodes);
    return path === null ? null : path.length;
  }

  function generateLevel(colors) {
    var nodeBudget = Math.min(4000 + colors * 1500, 20000);
    var tubes;
    for (var attempt = 0; attempt < 8; attempt++) {
      tubes = randomFillTubes(colors, 2);
      if (isSolved(tubes)) continue;
      var moves = findSolution(tubes, nodeBudget);
      if (moves === null || moves < Math.max(4, colors)) continue;
      return { tubes: tubes, optimal: moves, verified: true };
    }
    // Fallback: nunca trava na geração (meta estimada, não verificada).
    return { tubes: tubes, optimal: colors * 4, verified: false };
  }

  var MAX_COLORS = 10;
  function colorsForLevel(level) { return Math.min(2 + level, MAX_COLORS); }
  function targetFromOptimal(optimal) { return optimal + 2; }
  function hardLimitFromOptimal(optimal) { return optimal + Math.max(8, Math.ceil(optimal * 0.8)); }

  function starsForResult(moves, target, hardLimit) {
    if (moves <= target) return 3;
    if (moves <= target + Math.ceil((hardLimit - target) / 2)) return 2;
    return 1;
  }

  // Primeiro movimento sugerido (prefere o que fecha um tubo). null se não houver.
  function findHint(tubes) {
    var best = null;
    for (var i = 0; i < tubes.length; i++) {
      if (!tubes[i].length) continue;
      for (var j = 0; j < tubes.length; j++) {
        if (i === j || !canPour(tubes, i, j)) continue;
        // não sugerir mover um tubo já uniforme para um tubo vazio (movimento inútil)
        if (!tubes[j].length && tubes[i].every(function (c) { return c === tubes[i][0]; })) continue;
        var run = topRun(tubes[i]);
        var amount = Math.min(run.count, CAP - tubes[j].length);
        var destAfter = tubes[j].concat(new Array(amount).fill(run.color));
        if (tubeStatus(destAfter) === 'solved') return { from: i, to: j };
        if (best === null) best = { from: i, to: j };
      }
    }
    return best;
  }

  var api = {
    CAP: CAP, MAX_COLORS: MAX_COLORS,
    topRun: topRun, canPour: canPour, applyPour: applyPour, isSolved: isSolved,
    tubeStatus: tubeStatus, randomFillTubes: randomFillTubes, deepClone: deepClone,
    findSolution: findSolution, solvePath: solvePath, generateLevel: generateLevel,
    colorsForLevel: colorsForLevel, targetFromOptimal: targetFromOptimal,
    hardLimitFromOptimal: hardLimitFromOptimal, starsForResult: starsForResult,
    findHint: findHint
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TuboEngine = api;
})(this);
