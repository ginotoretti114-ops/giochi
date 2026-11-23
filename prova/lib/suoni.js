/* Suoni della sala giochi: musichetta di sottofondo generata al momento con Web Audio (nessun file audio)
   ed effetti sonori brevi. Si accende al primo tocco sulla pagina (i browser non permettono l'audio prima).
   Uso:  Suoni.tema('diavolerie')   Suoni.effetto('dadi')   Suoni.bottone() → HTML del pulsante audio.
   La scelta (musica ed effetti / solo effetti / niente) vale per tutti i giochi: localStorage «sala-audio». */
(function () {
  'use strict';
  var KEY = 'sala-audio';
  var MUSIC = 0.3; // volume della musica: sotto agli effetti
  var MODES = ['tutto', 'effetti', 'muto'];
  var LABEL = { tutto: 'Musica ed effetti', effetti: 'Solo effetti', muto: 'Audio spento' };
  function load() { try { var m = localStorage.getItem(KEY); return MODES.indexOf(m) >= 0 ? m : 'tutto'; } catch (e) { return 'tutto'; } }
  function save(m) { try { localStorage.setItem(KEY, m); } catch (e) { /* niente memoria */ } }

  var mode = load();
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, musicBus = null, sfxBus = null, noise = null;
  var theme = null, timer = null, nextTime = 0, step = 0, motif = null, lastDeg = 7;

  function ensure() {
    if (!AC) return false;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { AC = null; return false; }
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = MUSIC; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
      var len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noise = buf;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ---------- strumenti ---------- */
  // Una nota: oscillatore con inviluppo, filtro facoltativo, vibrato facoltativo.
  function tone(bus, midi, t, dur, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain(), out = g;
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(hz(midi), t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(hz(midi + o.glide), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    var peak = o.gain == null ? 0.5 : o.gain, a = o.attack || 0.005, rel = o.decay || dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel);
    if (o.filter) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(o.filter, t); f.Q.value = o.q || 0.7;
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + a + rel);
      osc.connect(f); f.connect(g);
    } else osc.connect(g);
    if (o.vibrato) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibrato; lg.gain.value = hz(midi) * 0.012;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + a + rel + 0.05);
    }
    g.connect(bus);
    osc.start(t); osc.stop(t + a + rel + 0.05);
    return out;
  }
  function burst(bus, t, dur, o) {
    o = o || {};
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.freq || 2000, t); f.Q.value = o.q || 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    g.gain.setValueAtTime(o.gain == null ? 0.4 : o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  function kick(bus, t, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(o.from || 120, t); osc.frequency.exponentialRampToValueAtTime(o.to || 42, t + 0.14);
    g.gain.setValueAtTime(o.gain || 0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.22));
    osc.connect(g); g.connect(bus); osc.start(t); osc.stop(t + 0.3);
  }
  var DRUM = {
    k: function (b, t) { kick(b, t); },
    h: function (b, t) { burst(b, t, 0.035, { ftype: 'highpass', freq: 7000, gain: 0.16 }); },
    s: function (b, t) { burst(b, t, 0.13, { freq: 1800, q: 0.8, gain: 0.3 }); },
    d: function (b, t) { kick(b, t, { from: 150, to: 70, gain: 0.7, dur: 0.18 }); },           // dum della darbuka
    t: function (b, t) { burst(b, t, 0.05, { freq: 3200, q: 3, gain: 0.25 }); },                  // tek
    w: function (b, t) { tone(b, 84, t, 0.05, { type: 'sine', gain: 0.18 }); },                   // legnetto
    c: function (b, t) { tone(b, 91, t, 0.04, { type: 'triangle', gain: 0.16 }); }                // clave
  };

  /* ---------- temi: accordi in semitoni dalla tonica, scala per la melodia, ritmo per ogni passo ---------- */
  var THEMES = {
    sala: { bpm: 84, steps: 8, root: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]],
      bass: [1, 0, 0, 0, 5, 0, 0, 0], arp: [0, null, 1, null, 2, null, 1, null], drums: ['', '', 'h', '', '', '', 'h', ''],
      lead: { type: 'triangle', gain: 0.32, decay: 0.5 }, arpI: { type: 'sine', gain: 0.18, decay: 0.35 }, bassI: { type: 'sine', gain: 0.5, decay: 0.6 }, mel: 0.35 },
    bazar: { bpm: 100, steps: 8, root: 62, scale: [0, 1, 4, 5, 7, 8, 10], prog: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-2, 1, 5]],
      bass: [1, 0, 0, 1, 0, 0, 5, 0], arp: [null, 0, null, 2, null, 1, null, 2], drums: ['d', '', 't', 'd', '', 't', 't', ''],
      lead: { type: 'sawtooth', gain: 0.18, decay: 0.28, filter: 2400, sweep: 500 }, arpI: { type: 'triangle', gain: 0.16, decay: 0.2 }, bassI: { type: 'triangle', gain: 0.45, decay: 0.3 }, mel: 0.55 },
    sottozero: { bpm: 76, steps: 8, root: 64, scale: [0, 2, 4, 7, 9, 11], prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 16]],
      bass: [1, 0, 0, 0, 0, 0, 0, 0], arp: [0, 2, 1, 3, 2, 1, 3, 2], drums: ['', '', '', '', 'w', '', '', ''],
      lead: { type: 'sine', gain: 0.3, decay: 1.2 }, arpI: { type: 'sine', gain: 0.12, decay: 0.6 }, bassI: { type: 'sine', gain: 0.4, decay: 1.6 }, mel: 0.3, bell: true },
    piccante: { bpm: 112, steps: 8, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [7, 11, 14]],
      bass: [1, 0, 0, 5, 1, 0, 5, 0], arp: [null, 0, 1, null, 2, 1, null, 0], drums: ['c', '', '', 'c', '', '', 'c', ''],
      lead: { type: 'sine', gain: 0.38, decay: 0.22 }, arpI: { type: 'triangle', gain: 0.16, decay: 0.15 }, bassI: { type: 'triangle', gain: 0.5, decay: 0.25 }, mel: 0.6, marimba: true },
    diavolerie: { bpm: 104, steps: 6, root: 60, scale: [0, 2, 3, 5, 7, 8, 11], prog: [[0, 3, 7], [-4, 0, 3], [5, 8, 12], [7, 11, 14]],
      bass: [1, 0, 0, 5, 0, 0], arp: [null, 1, 2, null, 1, 2], drums: ['w', '', '', 'w', '', 'h'],
      lead: { type: 'square', gain: 0.12, decay: 0.3, filter: 1800, sweep: 600 }, arpI: { type: 'triangle', gain: 0.14, decay: 0.18 }, bassI: { type: 'triangle', gain: 0.5, decay: 0.45 }, mel: 0.5 },
    // Sette Stelle: carillon notturno, accordi con la settima e arpeggi che brillano.
    settestelle: { bpm: 92, steps: 8, root: 65, scale: [0, 2, 4, 7, 9, 11], prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]],
      bass: [1, 0, 0, 0, 5, 0, 0, 0], arp: [0, 1, 2, 3, 2, 1, 3, 1], drums: ['', '', 'h', '', '', '', 'h', 'h'],
      lead: { type: 'triangle', gain: 0.26, decay: 0.7 }, arpI: { type: 'sine', gain: 0.1, decay: 0.3 }, bassI: { type: 'sine', gain: 0.42, decay: 0.9 }, mel: 0.4, bell: true },
    // Polvere e Piombo: galoppo in 6/8, scala da spaghetti western, fischio sulla melodia.
    polvere: { bpm: 100, steps: 6, root: 57, scale: [0, 1, 4, 5, 7, 8, 10], prog: [[0, 4, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]],
      bass: [1, 0, 1, 5, 0, 1], arp: [null, 0, 1, null, 2, 1], drums: ['w', '', 'c', 'w', 'c', ''],
      lead: { type: 'sine', gain: 0.3, decay: 0.45, glide: 0.4 }, arpI: { type: 'triangle', gain: 0.13, decay: 0.15 }, bassI: { type: 'triangle', gain: 0.48, decay: 0.3 }, mel: 0.45, whistle: true },
    // Stalla Matta: giostra in 3/4, maggiore e saltellante, campanelli sulla melodia.
    stalla: { bpm: 126, steps: 6, root: 65, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]],
      bass: [1, 0, 0, 5, 0, 5], arp: [null, 1, 2, null, 1, 2], drums: ['k', '', 'h', 'w', 'h', ''],
      lead: { type: 'triangle', gain: 0.28, decay: 0.32 }, arpI: { type: 'sine', gain: 0.13, decay: 0.18 }, bassI: { type: 'triangle', gain: 0.44, decay: 0.3 }, mel: 0.5, bell: true },
    // Valanga: ritmo incalzante in minore (dorico), basso che rotola e colpi di cassa.
    valanga: { bpm: 118, steps: 8, root: 62, scale: [0, 2, 3, 5, 7, 9, 10], prog: [[0, 3, 7], [-2, 2, 5], [5, 9, 12], [3, 7, 10]],
      bass: [1, 0, 1, 0, 5, 0, 1, 5], arp: [0, 1, 2, 1, null, 2, 1, 0], drums: ['k', '', 'h', 'k', 'w', '', 'h', 'h'],
      lead: { type: 'square', gain: 0.12, decay: 0.25, filter: 2200, sweep: 400 }, arpI: { type: 'triangle', gain: 0.14, decay: 0.16 }, bassI: { type: 'triangle', gain: 0.48, decay: 0.25 }, mel: 0.5 }
  };

  // Melodia: un motivo di 2 battute ripetuto e poi variato, sulle note della scala vicine all'accordo.
  function degMidi(T, deg) { var n = T.scale.length, o = Math.floor(deg / n), i = ((deg % n) + n) % n; return T.root + 12 + T.scale[i] + 12 * (o - 1); }
  function makeMotif(T) {
    var out = [];
    for (var i = 0; i < T.steps * 2; i++) {
      if (Math.random() > T.mel && i % T.steps !== 0) { out.push(null); continue; }
      var stepTo = [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
      lastDeg = Math.max(3, Math.min(12, lastDeg + stepTo));
      out.push(lastDeg);
    }
    return out;
  }
  function playStep(T, st, t) {
    var per = T.steps, bar = Math.floor(st / per), pos = st % per, sec = 60 / T.bpm / (per === 6 ? 3 : 2);
    var chord = T.prog[Math.floor(bar / 2) % T.prog.length]; // ogni accordo dura due battute
    if (pos === 0 && bar % 4 === 0) motif = makeMotif(T);
    if (T.bass[pos]) tone(musicBus, T.root - 24 + chord[0] + (T.bass[pos] === 5 ? 7 : 0), t, sec * 2, T.bassI);
    if (T.arp[pos] != null) tone(musicBus, T.root + chord[T.arp[pos] % chord.length], t, sec, T.arpI);
    var d = T.drums[pos];
    if (d && DRUM[d]) DRUM[d](musicBus, t);
    var mi = (bar % 2) * per + pos, deg = motif && motif[mi];
    if (bar % 4 === 3 && pos > per / 2 && Math.random() < 0.5) deg = null; // respiro a fine frase
    if (deg != null) {
      var m = degMidi(T, deg);
      tone(musicBus, m, t, sec * 1.6, T.lead);
      if (T.bell) tone(musicBus, m + 24, t, sec, { type: 'sine', gain: 0.05, decay: 0.8 });
      if (T.marimba) tone(musicBus, m + 12, t, sec * 0.6, { type: 'sine', gain: 0.08, decay: 0.12 });
      if (T.whistle) tone(musicBus, m + 12, t + 0.01, sec * 1.4, { type: 'sine', gain: 0.07, decay: 0.5, attack: 0.04 });
    }
  }
  function tick() {
    if (!ctx || !theme) return;
    var T = THEMES[theme], sec = 60 / T.bpm / (T.steps === 6 ? 3 : 2);
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.25) { playStep(T, step, nextTime); nextTime += sec; step++; }
  }
  function startMusic() {
    if (timer || mode !== 'tutto' || !theme || !ctx || document.hidden) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(MUSIC, ctx.currentTime + 2.5);
    nextTime = ctx.currentTime + 0.1; step = 0; motif = null;
    timer = setInterval(tick, 60);
  }
  function stopMusic() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    if (ctx) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); }
  }

  /* ---------- effetti ---------- */
  var FX = {
    click: function (t) { tone(sfxBus, 96, t, 0.04, { type: 'sine', gain: 0.25 }); },
    carta: function (t) { burst(sfxBus, t, 0.09, { freq: 2600, sweep: 900, q: 0.9, gain: 0.35 }); kick(sfxBus, t + 0.01, { from: 180, to: 90, gain: 0.25, dur: 0.08 }); },
    mescola: function (t) { for (var i = 0; i < 7; i++) burst(sfxBus, t + i * 0.045 + Math.random() * 0.01, 0.04, { freq: 2200 + Math.random() * 1500, gain: 0.4 }); },
    dadi: function (t) {
      for (var i = 0; i < 9; i++) burst(sfxBus, t + i * 0.045 + Math.random() * 0.02, 0.03, { freq: 2800 + Math.random() * 2400, q: 4, gain: 0.35 });
      kick(sfxBus, t + 0.46, { from: 400, to: 160, gain: 0.35, dur: 0.06 }); kick(sfxBus, t + 0.54, { from: 360, to: 150, gain: 0.3, dur: 0.06 });
    },
    anima: function (t) { tone(sfxBus, 88, t, 0.12, { type: 'sine', gain: 0.3, vibrato: 7 }); tone(sfxBus, 95, t + 0.07, 0.25, { type: 'sine', gain: 0.25, vibrato: 7 }); },
    moneta: function (t) { tone(sfxBus, 88, t, 0.06, { type: 'square', gain: 0.2, filter: 4000 }); tone(sfxBus, 95, t + 0.06, 0.25, { type: 'square', gain: 0.2, filter: 4000 }); },
    compra: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone(sfxBus, m, t + i * 0.055, 0.12, { type: 'triangle', gain: 0.3 }); }); },
    evoca: function (t) {
      [36, 43, 46, 51].forEach(function (m) { tone(sfxBus, m, t, 1.4, { type: 'sawtooth', gain: 0.12, attack: 0.25, decay: 1.2, filter: 300, sweep: 2400 }); });
      burst(sfxBus, t, 1.2, { ftype: 'lowpass', freq: 400, sweep: 3000, gain: 0.25 });
      kick(sfxBus, t + 0.05, { from: 80, to: 30, gain: 0.9, dur: 0.8 });
    },
    ruba: function (t) { tone(sfxBus, 84, t, 0.35, { type: 'sine', gain: 0.25, glide: -14 }); burst(sfxBus, t, 0.2, { freq: 1500, sweep: 400, gain: 0.15 }); },
    scarta: function (t) { kick(sfxBus, t, { from: 140, to: 55, gain: 0.5, dur: 0.18 }); burst(sfxBus, t, 0.12, { ftype: 'lowpass', freq: 900, gain: 0.25 }); },
    turno: function (t) { tone(sfxBus, 84, t, 0.18, { type: 'sine', gain: 0.3 }); tone(sfxBus, 91, t + 0.13, 0.35, { type: 'sine', gain: 0.3 }); },
    vittoria: function (t) {
      [60, 64, 67, 72, 76, 79, 84].forEach(function (m, i) { tone(sfxBus, m, t + i * 0.08, 0.3, { type: 'square', gain: 0.1, filter: 3000 }); tone(sfxBus, m, t + i * 0.08, 0.4, { type: 'triangle', gain: 0.18 }); });
      [72, 76, 79].forEach(function (m) { tone(sfxBus, m, t + 0.62, 1.2, { type: 'triangle', gain: 0.2, decay: 1.2 }); });
    },
    errore: function (t) { tone(sfxBus, 45, t, 0.14, { type: 'square', gain: 0.22, filter: 800 }); },
    punti: function (t) { for (var i = 0; i < 4; i++) tone(sfxBus, 79 + i * 2, t + i * 0.06, 0.06, { type: 'square', gain: 0.18, filter: 3000 }); },
    fuoco: function (t) { burst(sfxBus, t, 0.6, { ftype: 'lowpass', freq: 600, sweep: 2500, gain: 0.6 }); }
  };
  function effetto(name, delay) {
    // l'audio nasce solo da un tocco: prima del primo tocco gli effetti restano muti
    if (mode === 'muto' || !FX[name] || !ctx || ctx.state !== 'running') return;
    try { FX[name](ctx.currentTime + 0.01 + (delay || 0)); } catch (e) { /* audio non disponibile */ }
  }
  // Più effetti uno dopo l'altro, senza ripetizioni e al massimo 4.
  function sequenza(names, gap) {
    var seen = {}, k = 0;
    (names || []).forEach(function (n) { if (!seen[n] && k < 4) { seen[n] = 1; effetto(n, k * (gap || 0.14)); k++; } });
  }

  /* ---------- pulsante ---------- */
  var ICON = {
    tutto: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="19.5" cy="4.5" r="1.6" fill="currentColor"/>',
    effetti: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    muto: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
  };
  function bottone(cls) {
    return '<button type="button" class="snd-btn' + (cls ? ' ' + cls : '') + '" data-snd="cycle" aria-label="Audio: ' + LABEL[mode] + '. Tocca per cambiare" title="' + LABEL[mode] + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[mode] + '</svg></button>';
  }
  function refreshButtons() {
    var list = document.querySelectorAll('[data-snd="cycle"]');
    for (var i = 0; i < list.length; i++) {
      list[i].setAttribute('aria-label', 'Audio: ' + LABEL[mode] + '. Tocca per cambiare');
      list[i].title = LABEL[mode];
      list[i].innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[mode] + '</svg>';
    }
  }
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('snd-toast');
    if (!el) { el = document.createElement('div'); el.id = 'snd-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.className = 'on';
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = ''; }, 1500);
  }
  function setMode(m) {
    mode = m; save(m); refreshButtons();
    if (m === 'tutto') { if (ensure()) startMusic(); } else stopMusic();
  }
  function cycle() { setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); toast(LABEL[mode]); if (mode !== 'muto') effetto('click'); }

  var css = document.createElement('style');
  css.textContent =
    '.snd-btn{display:inline-grid;place-items:center;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--muted,#b3b5d4);cursor:pointer;flex:none;-webkit-tap-highlight-color:transparent}' +
    '.snd-btn svg{width:22px;height:22px}.snd-btn:focus-visible{outline:3px solid #fff;outline-offset:1px}' +
    '#snd-toast{position:fixed;left:50%;top:14px;transform:translate(-50%,-30px);opacity:0;z-index:50;pointer-events:none;background:#283161;color:#f6eedd;border:1px solid #3b4784;border-radius:999px;padding:8px 16px;font:700 14px/1.2 "Atkinson Hyperlegible",system-ui,sans-serif;transition:opacity .2s,transform .2s}' +
    '#snd-toast.on{opacity:1;transform:translate(-50%,0)}';
  (document.head || document.documentElement).appendChild(css);

  // Il primo tocco sblocca l'audio (regola dei browser) e fa partire la musica se è accesa.
  function unlock() { if (mode !== 'muto' && ensure()) startMusic(); }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-snd="cycle"]');
    if (el) { ev.preventDefault(); ev.stopPropagation(); cycle(); }
  }, true);
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) { stopMusic(); ctx.suspend(); }
    else { ctx.resume(); if (mode === 'tutto') startMusic(); }
  });

  window.Suoni = {
    tema: function (name) {
      if (!THEMES[name] || name === theme) return;
      stopMusic(); theme = name;
      if (ctx && ctx.state === 'running') startMusic();
    },
    effetto: effetto, sequenza: sequenza, bottone: bottone,
    modo: function () { return mode; }, imposta: setMode
  };
})();
