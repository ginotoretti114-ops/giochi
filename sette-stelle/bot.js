/* Sette Stelle: i giocatori del computer.
   SetteStelleBot.mossa(stato, posto, livello) restituisce una mossa per il motore ({ type: 'hit' } e simili).
   - facile: si ferma a una soglia di punti presa a caso e sceglie i bersagli a caso;
   - medio: calcola il rischio di doppione con le carte che vede sul tavolo e pesca finché conviene;
   - difficile: conta anche le carte uscite nei round prima, guarda la classifica (chi sta per vincere)
     e gioca Gelo e Pioggia di stelle su chi fanno più male. */
(function (root) {
  'use strict';
  var K = (typeof module !== 'undefined' && module.exports) ? require('./motore.js') : root.SetteStelle;
  var LEVELS = ['facile', 'medio', 'difficile'];
  var WISH = 8; // quanto vale avere un Desiderio davanti
  var TUNE = { lead: 1, behind: -1 }; // chi è davanti rischia un po' meno, chi insegue un po' di più

  // Le carte che possono ancora uscire, secondo quello che il bot ricorda.
  function pool(s, level) {
    var c = { total: 0, n: {}, bonus: 0, bonusSum: 0, x2: 0, gelo: 0, pioggia: 0, desiderio: 0 };
    var list;
    if (level === 'difficile') list = s.deck.length ? s.deck : s.discard; // conta tutte le carte uscite
    else {
      var seen = {};
      Object.keys(s.rows).forEach(function (p) { s.rows[p].forEach(function (id) { seen[id] = 1; }); });
      list = K.FULL.filter(function (id) { return !seen[id]; }); // guarda solo il tavolo di questo round
    }
    list.forEach(function (id) {
      var I = K.info(id);
      c.total++;
      if (I.t === 'num') c.n[I.v] = (c.n[I.v] || 0) + 1;
      else if (I.t === 'bonus') { c.bonus++; c.bonusSum += I.v; }
      else if (I.t === 'x2') c.x2++;
      else c[I.a]++;
    });
    return c;
  }
  function bustChance(s, p, c) {
    if (!c.total) return 0;
    var d = 0;
    K.nums(s, p).forEach(function (v) { d += c.n[v] || 0; });
    return d / c.total;
  }
  // Quanto cambiano in media i punti del round di p pescando una carta.
  function hitValue(s, p, c) {
    if (!c.total) return -1;
    var cur = K.roundPoints(s, p), nums = K.nums(s, p), have = {}, sum = 0;
    nums.forEach(function (v) { have[v] = 1; sum += v; });
    var dbl = (s.rows[p] || []).indexOf('x2') >= 0 ? 2 : 1, wish = !!K.wishOf(s, p);
    var ev = 0;
    Object.keys(c.n).forEach(function (k) {
      var v = +k, q = c.n[k];
      if (have[v]) ev += q * (wish ? -WISH : -cur);
      else ev += q * (v * dbl + (nums.length === 6 ? K.BONUS : 0));
    });
    ev += c.bonusSum;
    ev += c.x2 * sum;
    ev += c.desiderio * (wish ? 0.5 : WISH);
    ev += (c.gelo + c.pioggia) * 2;
    return ev / c.total;
  }
  function leaderGap(s, p) {
    var best = -1;
    s.score.forEach(function (v, q) { if (q !== p) best = Math.max(best, v + (s.st[q] === 'bust' ? 0 : K.roundPoints(s, q))); });
    return best;
  }
  function wantsHit(s, p, level, rnd) {
    var cur = K.roundPoints(s, p), nn = K.nums(s, p).length;
    if (!K.hasCards(s, p)) return true;
    if (level === 'facile') {
      var limit = 14 + Math.floor(rnd() * 12);
      return cur < limit && !(nn >= 5 && rnd() < 0.5);
    }
    var c = pool(s, level), ev = hitValue(s, p, c);
    if (level === 'medio') return ev > 0;
    // difficile: guarda la classifica
    var mine = s.score[p] + cur, best = leaderGap(s, p);
    var othersIn = K.active(s).filter(function (q) { return q !== p; }).length;
    if (mine >= K.TARGET && mine > best + (othersIn ? 10 : 0)) return false; // la vittoria è già lì
    if (best >= K.TARGET && mine <= best) return true;                         // o si supera chi vince, o si perde
    if (nn === 6 && bustChance(s, p, c) < 0.5) return true;                  // l'ultima stella vale 15
    return ev > (s.score[p] > best ? TUNE.lead : TUNE.behind);
  }

  // Quanto fa male a q un Gelo (gli toglie il resto del round) o una Pioggia (3 carte di fila).
  function threat(s, q) { var lead = Math.max.apply(null, s.score); return 1 + Math.max(0, s.score[q] - lead + 60) / 60; }
  function freezeHarm(s, q, c) { return Math.max(0, hitValue(s, q, c)) * 2.5; }
  function threeHarm(s, q, c) {
    var b = bustChance(s, q, c), p3 = 1 - Math.pow(1 - Math.min(0.95, b + 0.05), 3);
    if (K.wishOf(s, q)) p3 *= 0.45;
    return p3 * K.roundPoints(s, q) - (1 - p3) * 3 * Math.max(2, hitValue(s, q, c));
  }
  function chooseTarget(s, p, level, rnd) {
    var P = s.prompt, opts = P.opts;
    if (opts.length === 1 || level === 'facile') return opts[Math.floor(rnd() * opts.length)];
    var c = pool(s, level), best = opts[0], bestV = -Infinity;
    opts.forEach(function (q) {
      var v;
      if (P.a === 'desiderio') v = -(s.score[q] + K.roundPoints(s, q)); // a chi preoccupa meno
      else if (P.a === 'gelo') {
        if (q === p) v = -freezeHarm(s, p, c) + (hitValue(s, p, c) < 0 ? 3 : 0);
        else v = freezeHarm(s, q, c) * (level === 'difficile' ? threat(s, q) : 1);
      } else {
        if (q === p) v = -threeHarm(s, p, c);
        else v = threeHarm(s, q, c) * (level === 'difficile' ? threat(s, q) : 1);
      }
      if (v > bestV) { bestV = v; best = q; }
    });
    return best;
  }

  function mossa(s, p, level, rnd) {
    rnd = rnd || Math.random;
    if (LEVELS.indexOf(level) < 0) level = 'medio';
    if (!s || s.status !== 'playing') return null;
    if (s.prompt) return s.prompt.s === p ? { type: 'answer', target: chooseTarget(s, p, level, rnd) } : null;
    if (s.phase === 'between') return { type: 'next' };
    if (s.phase !== 'turn' || s.turn !== p) return null;
    return { type: wantsHit(s, p, level, rnd) ? 'hit' : 'stay' };
  }

  var api = { mossa: mossa, LEVELS: LEVELS, hitValue: hitValue, bustChance: bustChance, pool: pool };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SetteStelleBot = api;
})(typeof window !== 'undefined' ? window : this);
