/* Diavolerie: giocatori del computer. Bot.mossa(stato, posto, livello) restituisce una mossa per motore.js.
   facile  = compra e sceglie quasi a caso;
   medio   = compra le carte che rendono di più e spegne quelle che valgono meno;
   difficile = come medio, ma pensa alla vittoria (tiene da parte le anime, evoca quando vince),
               colpisce chi è in testa e ritira i dadi quando conviene. */
(function (root) {
  'use strict';
  var K = root.Diavolerie || (typeof require === 'function' ? require('./motore.js') : null);
  var G = 2.6; // quanto vale, in anime, una carta presa gratis

  function P(n) { return n >= 2 && n <= 12 ? (6 - Math.abs(n - 7)) / 36 : 0; }
  function pick(a, rnd) { return a[Math.floor(rnd() * a.length)]; }
  function cnt(s, p, fn) { return (s.cards[p] || []).filter(function (u) { return fn(s, p, u); }).length; }
  function kidF(s, p, u) { return K.isKid(u); }
  function aniF(s, p, u) { return K.isAnimal(u); }

  // Quanto rende una carta al suo padrone, in anime per giro di tavolo (extra = carta in arrivo da contare).
  function fxValue(s, p, I, extra) {
    var add = function (fn) { return extra && fn(s, p, extra) ? 1 : 0; };
    var animals = cnt(s, p, aniF) + add(aniF), kids = cnt(s, p, kidF) + add(kidF);
    var sweet = cnt(s, p, K.asSweet) + add(K.asSweet), rotten = cnt(s, p, K.asRotten) + add(K.asRotten);
    var opp = s.seats.length - 1, v = I.v || 0;
    var reqOk = !I.req || (I.req === 'kid' ? kids >= 1 : I.req === 'noKid' ? kids === 0 : I.req === 'animals3' ? animals >= 3 : I.req === 'rotten3' ? rotten >= 3 :
      (cnt(s, p, K.asBoy) + add(K.asBoy) >= 2 || cnt(s, p, K.asGirl) + add(K.asGirl) >= 2));
    var r = reqOk ? 1 : 0.25;
    switch (I.fx) {
      case 'candle': return K.hasP(s, p, 'candle2') ? 2 : 1;
      case 'collect': return v * r;
      case 'perAnimal': return v * animals;
      case 'perSweet': return sweet;
      case 'perRotten': return rotten;
      case 'bat': return 1 + s.demons[p].length;
      case 'perCard': return 1 + s.demons[p].length + s.cards[p].length;
      case 'pietro': return sweet >= 3 ? 3 : 1;
      case 'corvo': return animals >= 2 ? 2 : 1;
      case 'share': return 2 - 0.4 * opp;
      case 'steal': return v * 1.25 * r;
      case 'beasts': return animals * 1.25;
      case 'cat': return 0.32 * G;
      case 'alice': return 0.48 * G;
      case 'tommy': return 0.34 * G;
      case 'gainBlock': return G;
      case 'gainBoy': return 0.8 * G;
      case 'purgeSweet': { // fa male a chi ha dolci (Spettro Custode a parte), anche a me
        var hit = 0;
        K.order(s, p).forEach(function (q) { if (q === p || !K.hasP(s, q, 'shield')) hit += (q === p ? -1.2 : 0.9) * cnt(s, q, K.asSweet); });
        return hit * 1.5;
      }
      case 'annie': return G * 0.8;
      case 'stealKid': case 'stealAnimal': return G * 1.3;
      case 'stealAny': return G * 2.2;
      case 'discardKid': return 1.4;
      case 'alligator': return 1.6;
      case 'irwin': return (s.cards[p] || []).filter(K.isAnimal).reduce(function (a, u) { return a + fxValue(s, p, K.info(u)); }, 0);
      case 'leo': case 'destiny': {
        var list = (s.cards[p] || []).filter(function (u) { return K.asSweet(s, p, u) && ['leo', 'fortuna'].indexOf(K.typeOf(u)) < 0; });
        var vals = list.map(function (u) { return fxValue(s, p, K.info(u)); });
        return I.fx === 'leo' ? vals.reduce(function (a, b) { return a + b; }, 0) : (vals.length ? Math.max.apply(null, vals) : 0);
      }
      case 'sam': return animals ? 5 : 0;
      case 'goat': return s.ddeck.length && kids >= 2 ? 7 : 1.5;
      case 'damian': return s.hand[p].length ? 7 : 0;
      case 'egg': return s.ddeck.length ? 5 : 0; // si scambia col demone migliore del mazzo
      case 'hawk': return 2.2 * G;
      case 'goldfish': return 5;
      case 'owl': return 0.3;
      case 'skunk': return 0;
      case 'serpent': return 30;
      case 'clock': return 4;
    }
    return 0;
  }
  function rolls(s, I) { return I.cat === 'demon' ? 1 : s.seats.length; }
  function cardValue(s, p, uid, extra) {
    var I = K.info(uid);
    if (I.cat === 'candle') return 99;
    if (I.cat === 'demon' && !I.n) return passiveValue(s, p, I);
    var n = I.cat === 'candle' ? 0 : I.n;
    return fxValue(s, p, I, extra) * P(n) * rolls(s, I) * 6; // in anime per sei giri, per avere numeri leggibili
  }
  function passiveValue(s, p, I) {
    var kids = cnt(s, p, kidF);
    switch (I.p) {
      case 'twins': return 1 + kids * 0.4;
      case 'double': return 1 + kids * 0.9;
      case 'doubles': return 3;
      case 'reroll': return 3.5;
      case 'animalGain': return 2;
      case 'shield': return 3;
      case 'tax4': return 3;
      case 'both': return 1.5;
      case 'candle2': return 2.5;
      case 'cheap': return 2.5;
      case 'jester': return 2 * (s.seats.length - 1);
    }
    return 1;
  }
  // Valore di un demone da evocare: il suo potere più l'urgenza di avvicinarsi alla vittoria.
  function demonValue(s, p, id) {
    var I = K.info(id);
    return I.p ? passiveValue(s, p, I) : fxValue(s, p, I) * P(I.n) * 6;
  }
  // Chi è più vicino alla vittoria.
  function threat(s, q) { return s.demons[q].length * 12 + Math.min(s.souls[q], 12) + s.cards[q].length * 1.5; }
  function leaders(s, p) {
    return K.order(s, p).slice(1).sort(function (a, b) { return threat(s, b) - threat(s, a); });
  }
  function ownerOfAny(s, u) {
    var o = K.ownerOf(s, u);
    return o >= 0 ? o : K.demonOwner(s, u);
  }

  /* ---------- scelte ---------- */
  function answer(s, p, level, rnd) {
    var pr = s.prompt, moves = K.legalMoves(s, p);
    if (level === 'facile') return pick(moves, rnd);
    var hard = level === 'difficile';
    // prendere una carta: quanto vale per me; colpirla: quanto vale per chi ce l'ha (e quanto è avanti)
    var gainScore = function (u) {
      var I = K.info(u), o = ownerOfAny(s, u), bonus = hard && o >= 0 && o !== p ? threat(s, o) * 0.12 : 0;
      return (I.cat === 'demon' ? 20 + demonValue(s, p, u) : cardValue(s, p, u, u)) + bonus;
    };
    var hurtScore = function (u) {
      var o = ownerOfAny(s, u);
      return (o >= 0 ? cardValue(s, o, u) : 0) + (hard && o >= 0 ? threat(s, o) * 0.2 : 0);
    };
    switch (pr.kind) {
      case 'reroll': {
        if (!hard) return { type: 'answer', yes: rollWorth(s, p, s.roll.sum) < 0.5 };
        var avg = 0;
        for (var n = 2; n <= 12; n++) avg += P(n) * rollWorth(s, p, n);
        return { type: 'answer', yes: rollWorth(s, p, s.roll.sum) < avg * 0.8 };
      }
      case 'yesno': return { type: 'answer', yes: true };
      case 'steal': {
        var rich = pr.opts.slice().sort(function (a, b) { return hard ? threat(s, b) - threat(s, a) : s.souls[b] - s.souls[a]; });
        return { type: 'answer', target: rich.length ? rich[0] : -1 };
      }
      case 'pick': {
        var opts = pr.opts.slice(), by = function (fn, desc) { return opts.sort(function (a, b) { return desc ? fn(b) - fn(a) : fn(a) - fn(b); }); };
        if (pr.fx === 'sam') { // si scarta l'animale che rende meno, se vale meno di 6 anime
          by(function (u) { return cardValue(s, p, u); });
          return { type: 'answer', pick: cardValue(s, p, opts[0]) < 6 ? [opts[0]] : [] };
        }
        if (pr.fx === 'damian' || pr.fx === 'egg') { by(function (u) { return demonValue(s, p, u); }, true); return { type: 'answer', pick: [opts[0]] }; }
        if (pr.fx === 'destiny') { by(function (u) { return cardValue(s, p, u); }, true); return { type: 'answer', pick: [opts[0]] }; }
        if (pr.fx === 'discardKid') { by(hurtScore, true); return { type: 'answer', pick: [opts[0]] }; }
        by(gainScore, true);
        if (pr.fx === 'annie' && gainScore(opts[0]) < cardValue(s, p, pr.c) * 0.8) return { type: 'answer', pick: [] };
        return { type: 'answer', pick: [opts[0]] };
      }
      case 'multi': {
        if (pr.fx === 'goat') { // il bambino e la bambina che valgono meno
          var best = null;
          moves.forEach(function (m) {
            if (!m.pick || m.pick.length !== 2) return;
            var c = cardValue(s, p, m.pick[0]) + cardValue(s, p, m.pick[1]);
            if (!best || c < best.c) best = { c: c, m: m };
          });
          return best && best.c < 9 ? best.m : { type: 'answer', pick: [] };
        }
        if (pr.fx === 'alligator') {
          var t = pr.opts.slice().sort(function (a, b) { return hurtScore(b) - hurtScore(a); }).slice(0, pr.max);
          var gainV = t.reduce(function (a, u) { return a + hurtScore(u); }, 0);
          return gainV > cardValue(s, p, pr.c) * 1.2 ? { type: 'answer', pick: t } : { type: 'answer', pick: [] };
        }
        if (pr.fx === 'owl') {
          if (!hard) return { type: 'answer', pick: [] };
          var weak = pr.opts.filter(function (u) { return cardValue(s, p, u, u) < 1.2; });
          return { type: 'answer', pick: weak };
        }
        return pick(moves, rnd);
      }
    }
    return pick(moves, rnd);
  }
  // Quante anime mi porta un certo numero (per decidere se ritirare).
  function rollWorth(s, p, n) {
    var w = 0, cands = [s.candle[p]].concat(s.cards[p], s.demons[p]);
    cands.forEach(function (u) {
      var I = K.info(u);
      if (I.cat === 'candle' ? I.nums.indexOf(n) >= 0 : I.n === n) w += fxValue(s, p, I);
    });
    return w;
  }

  /* ---------- turno ---------- */
  function bestBuy(s, p, level, rnd) {
    var cost = K.buyCost(s, p), slots = [];
    s.block.forEach(function (u, i) { if (u) slots.push(i); });
    if (!slots.length || s.souls[p] < cost) return null;
    if (level === 'facile') return rnd() < 0.6 ? pick(slots, rnd) : null;
    var hard = level === 'difficile';
    var demonsLeft = K.WIN_DEMONS - s.demons[p].length;
    // con tutti i demoni evocati servono solo anime
    if (demonsLeft <= 0) return null;
    // difficile: con l'ultimo demone a portata, non scende sotto le 10 anime
    if (hard && demonsLeft === 1 && s.cards[p].length >= K.summonCost(s, p) && s.souls[p] - cost < K.WIN_SOULS && s.souls[p] >= K.WIN_SOULS - 3) return null;
    var scored = slots.map(function (i) {
      var u = s.block[i], v = cardValue(s, p, u, u);
      if (K.info(u).fx === 'skunk') {
        var mine = s.cards[p].length, theirs = 0;
        K.order(s, p).slice(1).forEach(function (q) { theirs = Math.max(theirs, s.cards[q].length); });
        v = hard && theirs >= mine + 3 ? 3 : -5;
      }
      // servono carte da spegnere: anche una carta debole aiuta a evocare
      v += 0.8;
      return { i: i, v: v };
    }).sort(function (a, b) { return b.v - a.v; });
    return scored[0].v > 0.5 ? scored[0].i : null;
  }
  function bestSummon(s, p, level, rnd) {
    var k = K.summonCost(s, p);
    if (s.did.summon || !s.hand[p].length || s.cards[p].length < k) return null;
    if (level === 'facile') {
      if (rnd() < 0.3) return null;
      return { type: 'summon', d: pick(s.hand[p], rnd), cards: K.shuffle(s.cards[p].slice()).slice(0, k) };
    }
    var d = s.hand[p].slice().sort(function (a, b) { return demonValue(s, p, b) - demonValue(s, p, a); })[0];
    var cards = s.cards[p].slice().sort(function (a, b) { return cardValue(s, p, a) - cardValue(s, p, b); }).slice(0, k);
    if (level === 'difficile') {
      var last = s.demons[p].length === K.WIN_DEMONS - 1;
      // l'ultimo demone si evoca appena le anime bastano per vincere; altrimenti aspetta se spegnere costa troppo
      // l'ultimo demone: se le anime non bastano ancora, prima si fa crescere il motore (spegnere costa entrate)
      if (last && s.souls[p] < K.WIN_SOULS - 5 && s.cards[p].length <= k + 1) return null;
    }
    return { type: 'summon', d: d, cards: cards };
  }
  function mossa(s, p, level, rnd) {
    rnd = rnd || Math.random;
    if (!s || s.status !== 'playing' || K.nextActor(s) !== p) return null;
    if (s.prompt) return answer(s, p, level, rnd);
    var sm = bestSummon(s, p, level, rnd);
    // evocare prima del tiro: i demoni nuovi si attivano già con questo tiro
    if (sm && (!s.did.roll || level !== 'facile')) return sm;
    if (!s.did.buy) {
      var i = bestBuy(s, p, level, rnd);
      if (i != null) return { type: 'buy', i: i };
    }
    if (!s.did.roll) return { type: 'roll' };
    if (sm) return sm;
    return { type: 'end' };
  }

  var api = { mossa: mossa, cardValue: cardValue, demonValue: demonValue, LEVELS: ['facile', 'medio', 'difficile'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DiavolerieBot = api;
})(typeof window !== 'undefined' ? window : this);
