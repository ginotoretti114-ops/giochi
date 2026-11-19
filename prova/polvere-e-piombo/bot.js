/* Polvere e Piombo: i giocatori del computer.
   PolvereBot.mossa(stato, posto, livello) restituisce una mossa per il motore.
   Il bot usa solo quello che saprebbe un giocatore al tavolo: il suo ruolo, la sua mano, lo Sceriffo,
   le carte in gioco, i punti vita, i ruoli dei morti e la «reputazione» pubblica (chi ha attaccato chi).
   - facile: gioca carte a caso e spesso passa;
   - medio: spara a chi sembra nemico, si equipaggia, si cura e risponde sempre;
   - difficile: in più finisce chi è ferito, toglie armi e Botti ai nemici, non colpisce lo Sceriffo
     amico con Raffica e Bisonti, tiene una Schivata! e una Borraccia per le emergenze. */
(function (root) {
  'use strict';
  var K = (typeof module !== 'undefined' && module.exports) ? require('./motore.js') : root.Polvere;
  var LEVELS = ['facile', 'medio', 'difficile'];

  function others(s, me) { return K.aliveList(s).filter(function (q) { return q !== me; }); }
  function deadRole(s, r) { var k = 0; s.alive.forEach(function (a, p) { if (!a && s.role[p] === r) k++; }); return k; }
  // Quanto è nemico q per me (> 0 nemico, < 0 amico), con quello che si vede al tavolo.
  var TUNE = { S0: 0.3, V0: 0.25, F0: 0.4 }, CUR = 'medio'; // CUR: il livello del bot che sta decidendo
  function hostility(s, me, q) {
    if (q === me || !s.alive[q]) return 0;
    var r = s.role[me], rep = s.rep[q] || 0, sh = s.sheriff, T = CUR === 'difficile' ? TUNE : { S0: 0.3, V0: 0.25, F0: 0.4 };
    if (r === 'S') return rep < 0 ? -rep : rep > 0 ? -rep * 0.5 : T.S0;
    if (r === 'V') return q === sh ? -10 : rep < 0 ? -rep : rep > 0 ? -rep * 0.5 : T.V0;
    if (r === 'F') return q === sh ? 10 : rep > 0 ? rep : rep < 0 ? rep * 0.7 : T.F0;
    var outlaws = (K.ROLES_BY_N[s.seats.length] || []).filter(function (x) { return x === 'F'; }).length - deadRole(s, 'F');
    if (q === sh) return K.aliveCount(s) === 2 ? 10 : outlaws > 0 ? -3 : 0.6; // il Rinnegato tiene in vita lo Sceriffo fino alla fine
    return rep < 0 ? 1 - rep : 1;
  }
  function enemies(s, me) {
    return others(s, me).filter(function (q) { return hostility(s, me, q) > 0.2; }).sort(function (a, b) { return hostility(s, me, b) - hostility(s, me, a); });
  }
  function sheriffAlly(s, me) { var r = s.role[me]; return r === 'V' || (r === 'R' && K.aliveCount(s) > 2); }

  // Quanto vale tenere una carta in mano.
  var BASE = { schivata: 6, borraccia: 6, sparo: 5, botte: 5, revolver: 3, fucile: 3.5, carabina: 4, lungo: 4.5, rapida: 3, cavallo: 4, cannocchiale: 3.5,
    galera: 4, lazo: 4, borseggio: 4, sfida: 3, raffica: 4.5, bisonti: 4, mercato: 3, corriere: 5, bottino: 6, giro: 3, candelotto: 1 };
  function keepValue(s, me, c) {
    var k = K.kindOf(c), v = BASE[k] || 2, T = K.TYPES[k];
    if (k === 'borraccia') v += s.hp[me] <= 2 ? 3 : 0;
    if (T.weapon) v = T.weapon > K.reach(s, me) ? v : 0.5;
    else if (T.blue && k !== 'galera' && k !== 'candelotto' && K.tableCard(s, me, k)) v = 0.5;
    if (K.asDodge(s, me, c) && K.charOf(s, me) === 'rovescio') v = Math.max(v, 5.5);
    return v;
  }
  function cheapest(s, me, cards, k) {
    return cards.slice().sort(function (a, b) { return keepValue(s, me, a) - keepValue(s, me, b); }).slice(0, k);
  }

  /* ---------- risposte ---------- */
  function answer(s, me, lv, rnd) {
    var P = s.prompt, h = s.hand[me];
    switch (P.kind) {
      case 'dodge': {
        var dc = K.dodgeCards(s, me);
        if (lv === 'facile' && rnd() < 0.2) return { type: 'answer', pass: true };
        return { type: 'answer', cards: cheapest(s, me, dc, P.need) };
      }
      case 'bisonti': case 'duel': {
        var bc = K.bangCards(s, me);
        if (lv === 'facile' && rnd() < 0.25) return { type: 'answer', pass: true };
        // nella Sfida contro un amico conviene perdere subito un punto e tenersi le carte? No: si risponde sempre, tranne all'amico ferito
        if (P.kind === 'duel' && lv === 'difficile') {
          var foe = me === P.a ? P.b : P.a;
          if (hostility(s, me, foe) < 0 && s.hp[me] >= 3) return { type: 'answer', pass: true };
        }
        return { type: 'answer', cards: cheapest(s, me, bc, 1) };
      }
      case 'dying': {
        var beers = K.aliveCount(s) > 2 ? h.filter(function (c) { return K.kindOf(c) === 'borraccia'; }) : [];
        var b = beers.slice(0, P.need), need = P.need - b.length;
        if (!need) return { type: 'answer', beer: b };
        var rest = cheapest(s, me, h.filter(function (c) { return b.indexOf(c) < 0; }), need * 2);
        if (K.charOf(s, me) === 'erbetta' && rest.length === need * 2) return { type: 'answer', beer: b, sid: rest };
        return { type: 'answer', pass: true };
      }
      case 'store': {
        var best = P.opts[0];
        P.opts.forEach(function (c) { if (keepValue(s, me, c) > keepValue(s, me, best)) best = c; });
        return { type: 'answer', pick: lv === 'facile' ? P.opts[Math.floor(rnd() * P.opts.length)] : best };
      }
      case 'discard': return { type: 'answer', cards: lv === 'facile' ? h.slice(0, P.n) : cheapest(s, me, h, P.n) };
      case 'lesta': {
        var foes = P.opts.filter(function (q) { return hostility(s, me, q) > 0; }).sort(function (a, b) { return s.hand[b].length - s.hand[a].length; });
        return { type: 'answer', target: foes.length && lv !== 'facile' ? foes[0] : -1 };
      }
      case 'raccatta': return { type: 'answer', yes: keepValue(s, me, P.c) >= 4.5 };
      case 'veggente': return { type: 'answer', pick: cheapest(s, me, P.opts, 1)[0] };
    }
    var ms = K.legalMoves(s, me);
    return ms[0] || null;
  }

  /* ---------- il turno ---------- */
  function playMove(s, me, c, extra) { var m = { type: 'play', c: c }; if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; }); return K.playError(s, me, m) ? null : m; }
  function firstOf(s, me, kinds) { var h = s.hand[me]; for (var i = 0; i < h.length; i++) if (kinds.indexOf(K.kindOf(h[i])) >= 0) return h[i]; return null; }
  function bestTableCard(s, q) {
    var order = ['botte', 'lungo', 'carabina', 'fucile', 'revolver', 'rapida', 'cavallo', 'cannocchiale'], t = s.table[q] || [];
    for (var i = 0; i < order.length; i++) for (var j = 0; j < t.length; j++) if (K.kindOf(t[j]) === order[i]) return t[j];
    return null;
  }
  function areaHit(s, me, lv) {
    // Raffica e Bisonti colpiscono tutti: conviene se i nemici sono più degli amici (e lo Sceriffo amico non è in pericolo).
    var net = 0;
    others(s, me).forEach(function (q) { var h = hostility(s, me, q); net += h > 0 ? Math.min(h, 3) : Math.max(h, -3); });
    if (lv !== 'facile' && sheriffAlly(s, me) && s.hp[s.sheriff] <= (lv === 'difficile' ? 2 : 1)) return false;
    return net > 0;
  }
  function turnMove(s, me, lv, rnd) {
    var h = s.hand[me], i, c, m;
    if (lv === 'facile') {
      var ms = K.legalMoves(s, me).filter(function (x) { return x.type !== 'end' && !(x.target === s.sheriff && s.role[me] === 'V'); });
      if (!ms.length || rnd() < 0.3) return { type: 'end' };
      return ms[Math.floor(rnd() * ms.length)];
    }
    var foes = enemies(s, me);
    if (lv === 'medio') {
      if (foes.length > 1 && rnd() < 0.5) { var j = Math.floor(rnd() * foes.length); foes = [foes[j]].concat(foes.slice(0, j), foes.slice(j + 1)); }
      if (rnd() < 0.12) return { type: 'end' };
    }
    // 1. carte che fanno pescare
    if ((c = firstOf(s, me, ['bottino', 'corriere']))) return playMove(s, me, c);
    // 2. armi migliori e carte blu
    var bestW = null;
    h.forEach(function (x) { var T = K.TYPES[K.kindOf(x)]; if (T.weapon && T.weapon > K.reach(s, me) && (!bestW || T.weapon > K.TYPES[K.kindOf(bestW)].weapon)) bestW = x; });
    if (bestW && (m = playMove(s, me, bestW))) return m;
    var rap = firstOf(s, me, ['rapida']);
    if (rap && K.reach(s, me) <= 1 && !K.weaponOf(s, me) && K.bangCards(s, me).length >= 2 && (m = playMove(s, me, rap))) return m;
    if (rap && lv === 'difficile' && K.bangCards(s, me).length >= 2 && s.bangs === 0 &&
      foes.some(function (q) { return K.dist(s, me, q) <= 1 && s.hp[q] <= K.bangCards(s, me).length; }) && (m = playMove(s, me, rap))) return m;
    for (i = 0; i < h.length; i++) {
      var k = K.kindOf(h[i]);
      if ((k === 'botte' || k === 'cavallo' || k === 'cannocchiale') && (m = playMove(s, me, h[i]))) return m;
      if (k === 'candelotto' && (lv === 'medio' || s.hp[me] >= 3) && (m = playMove(s, me, h[i]))) return m;
    }
    // 3. cure
    var excess = h.length - s.hp[me];
    if (s.hp[me] < s.max[me]) {
      var beer = firstOf(s, me, ['borraccia']);
      var keepBeer = lv === 'difficile' && s.hp[me] >= 2 && excess <= 0 && s.max[me] - s.hp[me] < 2;
      if (beer && !keepBeer && (m = playMove(s, me, beer))) return m;
      if (K.charOf(s, me) === 'erbetta' && excess >= 2) return { type: 'heal', cards: cheapest(s, me, h, 2) };
    }
    var giro = firstOf(s, me, ['giro']);
    if (giro && s.hp[me] < s.max[me]) return playMove(s, me, giro);
    if (giro && lv === 'difficile' && sheriffAlly(s, me) && s.hp[s.sheriff] < s.max[s.sheriff]) return playMove(s, me, giro);
    // 4. Galera al nemico più pericoloso (non lo Sceriffo)
    var jail = firstOf(s, me, ['galera']);
    if (jail) for (i = 0; i < foes.length; i++) if ((m = playMove(s, me, jail, { target: foes[i] }))) return m;
    // 5. togliere carte ai nemici
    var lazo = firstOf(s, me, ['lazo']), pan = firstOf(s, me, ['borseggio']);
    for (i = 0; i < foes.length; i++) {
      var q = foes[i], tc = bestTableCard(s, q), pick = tc && (lv === 'difficile' || rnd() < 0.4) ? tc : 'hand';
      if (pan && (m = playMove(s, me, pan, { target: q, pick: pick }))) return m;
      if (pan && pick !== 'hand' && (m = playMove(s, me, pan, { target: q, pick: 'hand' }))) return m;
      if (lazo && (m = playMove(s, me, lazo, { target: q, pick: pick }))) return m;
      if (lazo && pick !== 'hand' && (m = playMove(s, me, lazo, { target: q, pick: 'hand' }))) return m;
    }
    // 6. Sparo! al nemico a portata (il difficile preferisce chi è più ferito)
    var bangs = K.bangCards(s, me);
    if (bangs.length) {
      var shot = cheapest(s, me, bangs, 1)[0];
      if (lv === 'difficile' && K.charOf(s, me) === 'rovescio') shot = bangs.filter(function (x) { return K.kindOf(x) === 'sparo'; })[0] || shot;
      var reachable = foes.filter(function (q) { return !K.playError(s, me, { type: 'play', c: shot, target: q }); });
      if (lv === 'difficile') reachable.sort(function (a, b) { return (hostility(s, me, b) + (s.hp[b] <= 1 ? 3 : 0) - (K.tableCard(s, b, 'botte') ? 1 : 0)) - (hostility(s, me, a) + (s.hp[a] <= 1 ? 3 : 0) - (K.tableCard(s, a, 'botte') ? 1 : 0)); });
      var keepOne = lv === 'difficile' && K.dodgeCards(s, me).length === 1 && K.charOf(s, me) === 'rovescio' && bangs.length === 1;
      if (reachable.length && !keepOne) return { type: 'play', c: shot, target: reachable[0] };
    }
    // 7. Sfida a un nemico quando si hanno più Sparo!
    var duel = firstOf(s, me, ['sfida']);
    if (duel && foes.length) {
      var dq = foes.slice().sort(function (a, b) { return s.hand[a].length - s.hand[b].length; })[0];
      if ((K.bangCards(s, me).length >= 2 || s.hand[dq].length <= 1) && (m = playMove(s, me, duel, { target: dq }))) return m;
    }
    // 8. colpi a tutti
    var area = firstOf(s, me, ['raffica', 'bisonti']);
    if (area && areaHit(s, me, lv)) return playMove(s, me, area);
    if (area && lv === 'difficile' && foes.some(function (q) { return s.hp[q] === 1 && s.hand[q].length <= 1; }) &&
      !(sheriffAlly(s, me) && s.hp[s.sheriff] <= 1)) return playMove(s, me, area);
    // 9. Mercato
    if ((c = firstOf(s, me, ['mercato']))) return playMove(s, me, c);
    return { type: 'end' };
  }

  function mossa(s, me, level, rnd) {
    rnd = rnd || Math.random;
    if (LEVELS.indexOf(level) < 0) level = 'medio';
    if (!s || s.status !== 'playing' || K.nextActor(s) !== me) return null;
    CUR = level;
    var m = s.prompt ? answer(s, me, level, rnd) : turnMove(s, me, level, rnd);
    if (!m || K.validate(s, me, m)) {
      var ms = K.legalMoves(s, me);
      m = ms.filter(function (x) { return x.type === 'end' || x.pass; })[0] || ms[0] || null;
    }
    return m;
  }

  var api = { mossa: mossa, LEVELS: LEVELS, hostility: hostility, keepValue: keepValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PolvereBot = api;
})(typeof window !== 'undefined' ? window : this);
