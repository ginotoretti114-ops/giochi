/* Stanze: partite online a turni, sincronizzate su due server MQTT pubblici (richiede lib/mqtt.min.js).
   Ogni partita è un documento JSON intero con versione `v` e `nonce`, pubblicato come messaggio retained
   sull'argomento <topic>/<id>/state. Vince la versione più alta (a pari versione, il nonce più alto);
   quando un server si ricollega, gli si rimandano le versioni più recenti conosciute.
   Le partite restano salvate anche nel browser (localStorage con il prefisso indicato).

   var stanze = Stanze({
     topic: 'gioco/v1',                 // prefisso degli argomenti MQTT, uno per gioco
     memoria: 'xx-',                    // prefisso localStorage, uno per gioco
     valida: function (stato) {},       // true se il documento è una partita di questo gioco
     quandoArriva: function (id, prima, dopo) {},
     quandoCambiaRete: function (stato) {}   // 'connecting' | 'up' | 'down' | 'off'
   });
   stanze.avvia(); stanze.guarda(id); stanze.pubblica(id, stato) -> numero di server raggiunti */
(function (root) {
  'use strict';
  var DEFAULT_BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
  var ID_RE = /^[a-z0-9]{6,20}$/;

  function Stanze(o) {
    var LS = {
      get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* niente memoria */ } },
      del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* idem */ } }
    };
    var mem = { ids: null, states: {} };
    var links = [];
    var stato = 'connecting', everUp = false, corrente = null;
    var topicRe = new RegExp('^' + o.topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/([a-z0-9]{6,20})/state$');

    function elenco() {
      if (!mem.ids) {
        var a = [];
        try { a = JSON.parse(LS.get(o.memoria + 'rooms') || '[]'); } catch (e) { a = []; }
        mem.ids = Array.isArray(a) ? a.filter(function (x) { return ID_RE.test(x); }) : [];
      }
      return mem.ids.slice();
    }
    function salvaElenco(a) { mem.ids = a.slice(0, 30); LS.set(o.memoria + 'rooms', JSON.stringify(mem.ids)); }
    function aggiungi(id) { var a = elenco().filter(function (x) { return x !== id; }); a.unshift(id); salvaElenco(a); }
    function togli(id) {
      salvaElenco(elenco().filter(function (x) { return x !== id; }));
      delete mem.states[id];
      LS.del(o.memoria + 'room-' + id);
      links.forEach(function (l) { if (l.up) { try { l.client.unsubscribe(topicOf(id)); } catch (e) { /* ok */ } } });
    }
    function carica(id) {
      if (!id) return null;
      if (mem.states[id]) return mem.states[id];
      var s = null;
      try { s = JSON.parse(LS.get(o.memoria + 'room-' + id) || 'null'); } catch (e) { s = null; }
      if (s && o.valida(s)) { mem.states[id] = s; return s; }
      return null;
    }
    function salva(id, s) { mem.states[id] = s; LS.set(o.memoria + 'room-' + id, JSON.stringify(s)); }

    function topicOf(id) { return o.topic + '/' + id + '/state'; }
    function idOf(t) { var m = topicRe.exec(t); return m ? m[1] : null; }
    function brokers() {
      var q = null;
      try { q = new URLSearchParams(location.search).get('broker'); } catch (e) { q = null; }
      return q ? q.split(',').filter(Boolean) : (o.brokers || DEFAULT_BROKERS);
    }
    function piuNuova(a, b) {
      if (!b) return true;
      if (a.v !== b.v) return a.v > b.v;
      return String(a.nonce || '') > String(b.nonce || '');
    }
    function stessa(a, b) { return !!(a && b && a.v === b.v && String(a.nonce || '') === String(b.nonce || '')); }
    function osservate() { var ids = elenco(); if (corrente && ids.indexOf(corrente) < 0) ids.push(corrente); return ids; }

    function cambia(x) { if (x !== stato) { stato = x; if (o.quandoCambiaRete) o.quandoCambiaRete(x); } }
    function ricalcola() {
      var up = links.some(function (l) { return l.up; });
      if (up) everUp = true;
      cambia(up ? 'up' : ((everUp || stato === 'down') ? 'down' : 'connecting'));
    }

    function avvia() {
      var lib = window.mqtt;
      if (!lib || typeof lib.connect !== 'function') { cambia('off'); return; }
      brokers().forEach(function (url) {
        var link = { url: url, up: false, seen: {}, timer: null, client: null };
        try {
          link.client = lib.connect(url, {
            clientId: 'gz_' + Math.random().toString(36).slice(2, 12), clean: true, keepalive: 30,
            reconnectPeriod: 4000, connectTimeout: 10000, protocolVersion: 4, resubscribe: true
          });
        } catch (e) { return; }
        link.client.on('connect', function () {
          link.up = true; link.seen = {};
          var ids = osservate();
          if (ids.length) link.client.subscribe(ids.map(topicOf), { qos: 1 });
          clearTimeout(link.timer);
          link.timer = setTimeout(function () { rimandaNuove(link); }, 3000);
          ricalcola();
        });
        var giu = function () { if (link.up) { link.up = false; ricalcola(); } };
        link.client.on('close', giu);
        link.client.on('offline', giu);
        link.client.on('error', function () { /* il client riprova da solo */ });
        link.client.on('message', function (topic, payload) { arrivato(link, topic, payload); });
        links.push(link);
      });
      if (!links.length) { cambia('off'); return; }
      setTimeout(function () { if (stato === 'connecting') cambia('down'); }, 12000);
    }

    function pubblicaSu(link, id, s) {
      try { link.client.publish(topicOf(id), JSON.stringify(s), { qos: 1, retain: true }); return true; } catch (e) { return false; }
    }
    function pubblica(id, s) {
      var n = 0;
      links.forEach(function (l) { if (l.up && pubblicaSu(l, id, s)) n++; });
      return n;
    }
    function rimandaNuove(link) {
      if (!link.up) return;
      osservate().forEach(function (id) {
        var loc = carica(id);
        if (loc && (!link.seen[id] || piuNuova(loc, link.seen[id]))) pubblicaSu(link, id, loc);
      });
    }
    function guarda(id) {
      corrente = id;
      links.forEach(function (l) { if (l.up) { try { l.client.subscribe(topicOf(id), { qos: 1 }); } catch (e) { /* ok */ } } });
    }
    function arrivato(link, topic, payload) {
      var id = idOf(topic);
      if (!id || !payload || !payload.length) return;
      var data;
      try { data = JSON.parse(payload.toString()); } catch (e) { return; }
      if (!o.valida(data)) return;
      if (!link.seen[id] || piuNuova(data, link.seen[id])) link.seen[id] = { v: data.v, nonce: data.nonce };
      var loc = carica(id);
      if (loc && !piuNuova(data, loc)) {
        if (!stessa(data, loc)) pubblicaSu(link, id, loc); // questo server è rimasto indietro
        return;
      }
      salva(id, data);
      if (elenco().indexOf(id) < 0) aggiungi(id);
      if (o.quandoArriva) o.quandoArriva(id, loc, data);
    }

    return {
      avvia: avvia, pubblica: pubblica, guarda: guarda, togli: togli, aggiungi: aggiungi,
      carica: carica, salva: salva, elenco: elenco,
      stato: function () { return stato; },
      nonce: function () { return Math.random().toString(36).slice(2, 12); }
    };
  }

  root.Stanze = Stanze;
})(window);
