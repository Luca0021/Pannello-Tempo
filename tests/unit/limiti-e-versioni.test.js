#!/usr/bin/env node
/* tests/unit/limiti-e-versioni.test.js — due difetti che nessuna lettura del
 * codice trova, e che nessuna prova funzionale incontra per caso.
 *
 * PRIMO. I limiti di importazione di js/sicurezza.js non scattavano mai.
 * La costante si chiamava `LIMITI`, e js/appcheck.js dichiarava un altro
 * `var LIMITI`. I 60 moduli condividono un unico scope globale e
 * appcheck.js si carica dopo: a runtime `LIMITI.backupByte` era
 * `undefined`, e `byte > undefined` è `false`. Nessuna eccezione, nessun
 * avviso. Erano disattivati il limite di 8 MB, quello di 5000 voci, i 4 MB
 * e i 500 eventi dei file di calendario, e il troncamento dei titoli.
 *
 * SECONDO. `aggiornaVersioni()` chiamava `segnaModifica(id, quando)` con
 * una data. Ma `segnaModifica` viva è quella di js/conflitti.js, la cui
 * firma è `segnaModifica(id, dati)`: il secondo argomento è un insieme di
 * dati. `versioni("2026-…")` restituiva un registro usa e getta, e il
 * record di versione finiva lì. **Ogni modifica salvata dal percorso
 * normale non risultava da sincronizzare**, quindi con un account
 * collegato non sarebbe mai arrivata sull'altro dispositivo.
 *
 * Le due prove qui sotto tengono ferme le correzioni. La terza verifica la
 * causa comune: nessun nome globale dichiarato da due moduli.
 *
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node. I
 * comportamenti coperti sono però stati verificati a mano nel browser, e i
 * valori attesi qui sotto sono quelli osservati.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..', '..');

let passati = 0, falliti = 0;
const problemi = [];
function prova(nome, fn) {
  try { fn(); passati++; console.log('  ok   ' + nome); }
  catch (e) { falliti++; problemi.push(nome + ' → ' + e.message);
              console.log('  FALL ' + nome + ' → ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'asserzione falsa'); }

/* Carica i moduli NELL'ORDINE DI ORDINE.txt, che è il punto: l'ordine è
   ciò che decide quale dichiarazione vince. Caricarli in un altro ordine
   nasconderebbe esattamente il difetto che stiamo verificando.

   `js/boot.js` e `js/pwa-boot.js` restano fuori, come in avvio.test.js:
   avviano l'applicazione e pretendono un DOM completo. Alla prima
   esecuzione questo collaudo li caricava, e quattro prove su quattro
   morivano con «window.addEventListener is not a function» — un difetto
   del banco di prova, non del prodotto, ma che nascondeva il risultato
   delle prove vere. */
const SALTA_AVVIO = new Set(['js/boot.js', 'js/pwa-boot.js']);

function carica(quali) {
  const magazzino = {};
  const ctx = {
    console, Object, Array, JSON, Date, Math, String, Number, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Intl,
    localStorage: {
      getItem: k => (k in magazzino ? magazzino[k] : null),
      setItem: (k, v) => { magazzino[k] = String(v); },
      removeItem: k => { delete magazzino[k]; },
      key: n => Object.keys(magazzino)[n] || null,
      get length() { return Object.keys(magazzino).length; }
    },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){}, key: () => null, length: 0 },
    document: { documentElement: { setAttribute(){}, lang: 'it' }, getElementById: () => null,
                querySelectorAll: () => [], addEventListener(){}, createElement: () => ({ style:{}, setAttribute(){} }) },
    navigator: { onLine: true, userAgent: 'nodo-di-prova', language: 'it-IT' },
    location: { protocol: 'http:', href: 'http://localhost/', search: '', hash: '', pathname: '/' },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    fetch: () => Promise.reject(new Error('rete non disponibile nei collaudi')),
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
    requestAnimationFrame: fn => setTimeout(fn, 0),
    URL, Blob: function(){}, crypto: { getRandomValues: a => a },
    caches: undefined, indexedDB: undefined,
    __magazzino: magazzino
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.__PT_TEST__ = true;
  const sandbox = vm.createContext(ctx);
  const ordine = fs.readFileSync(path.join(RADICE, 'js/ORDINE.txt'), 'utf8')
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const f of ordine) {
    if (SALTA_AVVIO.has(f)) continue;
    if (quali && !quali.some(q => f.indexOf(q) >= 0)) continue;
    try { vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento di ' + f + ': ' + e.message); }
  }
  return ctx;
}

console.log('Limiti di importazione e versione per record\n');

/* ─────────────────────────────────────────────────────────────────────────
   1. I nomi globali non collidono
   ───────────────────────────────────────────────────────────────────────── */

prova('nessun nome globale è dichiarato da due moduli', () => {
  const ordine = fs.readFileSync(path.join(RADICE, 'js/ORDINE.txt'), 'utf8')
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const dove = new Map();
  const RX = [/^var\s+([A-Za-z_$][\w$]*)/, /^function\s+([A-Za-z_$][\w$]*)/,
              /^(?:let|const)\s+([A-Za-z_$][\w$]*)/];
  for (const f of ordine) {
    const righe = fs.readFileSync(path.join(RADICE, f), 'utf8').split(/\r?\n/);
    const qui = new Set();
    righe.forEach((riga, i) => {
      for (const rx of RX) {
        const m = rx.exec(riga);
        if (!m) continue;
        const nome = m[1];
        if (qui.has(nome)) return;
        qui.add(nome);
        if (!dove.has(nome)) dove.set(nome, []);
        dove.get(nome).push(f + ':' + (i + 1));
        return;
      }
    });
  }
  const collisioni = [...dove.entries()].filter(([, p]) => p.length > 1)
    .map(([n, p]) => n + ' in ' + p.join(' e '));
  assert(collisioni.length === 0, 'collisioni: ' + collisioni.join(' · '));
});

prova('i due gruppi di limiti hanno nomi distinti e valori propri', () => {
  const ctx = carica(['config', 'utils', 'platform', 'promessa', 'versione',
                      'migrations', 'sicurezza', 'appcheck']);
  assert(typeof ctx.LIMITI === 'undefined', 'il nome generico LIMITI esiste ancora');
  assert(ctx.LIMITI_IMPORT && ctx.LIMITI_IMPORT.backupByte === 8 * 1024 * 1024,
         'LIMITI_IMPORT.backupByte = ' + (ctx.LIMITI_IMPORT && ctx.LIMITI_IMPORT.backupByte));
  assert(ctx.LIMITI_INVIO && ctx.LIMITI_INVIO.tentativiMax === 6,
         'LIMITI_INVIO.tentativiMax = ' + (ctx.LIMITI_INVIO && ctx.LIMITI_INVIO.tentativiMax));
});

/* ─────────────────────────────────────────────────────────────────────────
   2. I limiti di importazione scattano davvero (SEC-005, SEC-006, SEC-004)
   ───────────────────────────────────────────────────────────────────────── */

const ctxSic = carica(['config', 'utils', 'platform', 'promessa', 'versione',
                       'migrations', 'sicurezza', 'appcheck']);

function bustaValida(quante) {
  const items = [];
  for (let i = 0; i < (quante || 1); i++) items.push({ id: 'i' + i, label: 'voce ' + i });
  return JSON.stringify({ formato: 'pannello-tempo', schemaVersion: 6, dati: { v: 6, items } });
}

prova('SEC-005 · un backup oltre 8 MB viene rifiutato', () => {
  const r = ctxSic.leggiBackup(bustaValida(1), 9 * 1024 * 1024);
  assert(r.ok === false, 'accettato');
  assert(/troppo grande/i.test((r.errori || []).join(' ')), 'motivo: ' + (r.errori || []).join(' '));
});

prova('SEC-005 · un backup oltre 5000 voci viene rifiutato', () => {
  const testo = bustaValida(5100);
  const r = ctxSic.leggiBackup(testo, testo.length);
  assert(r.ok === false, 'accettato');
  /* il conteggio va fatto PRIMA della pulizia, che tronca gli elenchi
     lunghi: altrimenti un file smisurato passerebbe, ridotto in silenzio */
  assert(/5100/.test((r.errori || []).join(' ')),
         'il messaggio non dice quante voci ha trovato: ' + (r.errori || []).join(' '));
});

prova('SEC-005 · un backup valido passa, con l\'anteprima', () => {
  const testo = bustaValida(3);
  const r = ctxSic.leggiBackup(testo, testo.length);
  assert(r.ok === true, 'rifiutato: ' + (r.errori || []).join(' '));
  assert(r.anteprima && r.anteprima.attivita === 3, 'anteprima: ' + JSON.stringify(r.anteprima));
});

prova('SEC-005 · l\'inquinamento del prototipo non passa', () => {
  const veleno = '{"formato":"pannello-tempo","schemaVersion":6,"dati":{"v":6,' +
                 '"items":[{"id":"p","label":"x"}],"__proto__":{"inquinato":true}}}';
  const r = ctxSic.leggiBackup(veleno, veleno.length);
  assert(r.ok === true, 'il file è leggibile: va bonificato, non rifiutato');
  assert(({}).inquinato === undefined, 'il prototipo di Object è stato inquinato');
  assert(!Object.prototype.hasOwnProperty.call(r.dati, 'inquinato'),
         'la chiave vietata è sopravvissuta nei dati');
});

prova('SEC-006 · un ICS oltre 4 MB viene rifiutato', () => {
  const r = ctxSic.controllaIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR', 5 * 1024 * 1024);
  assert(r.ok === false, 'accettato');
});

prova('SEC-006 · un ICS oltre 500 eventi viene rifiutato', () => {
  let t = 'BEGIN:VCALENDAR\r\n';
  for (let i = 0; i < 520; i++) t += 'BEGIN:VEVENT\r\nSUMMARY:e' + i + '\r\nEND:VEVENT\r\n';
  t += 'END:VCALENDAR';
  const r = ctxSic.controllaIcs(t, t.length);
  assert(r.ok === false, 'accettato');
  assert(/520/.test(r.motivo || ''), 'il messaggio non dice quanti eventi: ' + r.motivo);
});

prova('SEC-004 · un titolo smisurato viene troncato al limite', () => {
  const t = ctxSic.testoSicuro('a'.repeat(900));
  assert(t.length === ctxSic.LIMITI_IMPORT.testo,
         'lunghezza ' + t.length + ', limite ' + ctxSic.LIMITI_IMPORT.testo);
});

prova('SEC-004 · caratteri di controllo e spazi invisibili sono rimossi', () => {
  const t = ctxSic.testoSicuro('a b​c');
  assert(t === 'abc', 'ottenuto ' + JSON.stringify(t));
});

/* ─────────────────────────────────────────────────────────────────────────
   3. Le modifiche risultano da sincronizzare (SYN-004)
   ───────────────────────────────────────────────────────────────────────── */

prova('SYN-004 · una modifica salvata risulta da sincronizzare', () => {
  const ctx = carica();
  ctx.S.data = { v: 6, items: [{ id: 'a', label: 'prima' }, { id: 'b', label: 'altra' }],
                 versioni: {}, settings: {} };
  ctx.azzeraIstantanea();
  ctx.aggiornaVersioni();                       /* primo giro: prende l'istantanea */
  ctx.S.data.items[0].label = 'dopo';
  ctx.aggiornaVersioni();                       /* secondo giro: deve segnare */
  const v = ctx.S.data.versioni['a'];
  assert(v, 'nessun record di versione: la modifica non risulta da sincronizzare');
  assert(v.sporco === true, 'sporco = ' + v.sporco);
  assert(v.del === false, 'del = ' + v.del);
  assert(typeof v.mod === 'string' && v.mod.length > 10, 'mod = ' + v.mod);
});

prova('SYN-004 · una voce non toccata non risulta modificata', () => {
  const ctx = carica();
  ctx.S.data = { v: 6, items: [{ id: 'a', label: 'prima' }, { id: 'b', label: 'altra' }],
                 versioni: {}, settings: {} };
  ctx.azzeraIstantanea();
  ctx.aggiornaVersioni();
  ctx.S.data.items[0].label = 'dopo';
  ctx.aggiornaVersioni();
  const v = ctx.S.data.versioni['b'];
  /* segnare tutto a ogni salvataggio produrrebbe conflitti falsi su ogni
     record: è il motivo per cui esiste l'istantanea */
  assert(!v || v.sporco !== true, 'segnata come modificata: ' + JSON.stringify(v));
});

prova('SYN-004 · una cancellazione lascia una lapide', () => {
  const ctx = carica();
  ctx.S.data = { v: 6, items: [{ id: 'a', label: 'prima' }, { id: 'b', label: 'altra' }],
                 versioni: {}, settings: {} };
  ctx.azzeraIstantanea();
  ctx.aggiornaVersioni();
  ctx.S.data.items.pop();                       /* via «b» */
  ctx.aggiornaVersioni();
  const v = ctx.S.data.versioni['b'];
  assert(v, 'nessuna lapide: la cancellazione non arriverebbe all\'altro dispositivo');
  assert(v.del === true, 'del = ' + v.del);
  assert(v.sporco === true, 'sporco = ' + v.sporco);
});

prova('SYN-004 · le funzioni vive sono quelle di conflitti.js', () => {
  const ctx = carica();
  /* Se qualcuno ridichiarasse queste funzioni in versioni.js, l'arità
     cambierebbe e `aggiornaVersioni()` tornerebbe a perdere le modifiche.
     È la prova che tiene ferma la correzione, non un vezzo. */
  assert(ctx.segnaModifica.length === 2, 'segnaModifica ha arità ' + ctx.segnaModifica.length);
  assert(ctx.versioni.length === 1, 'versioni ha arità ' + ctx.versioni.length);
  assert(ctx.risolviRecord.length === 2, 'risolviRecord ha arità ' + ctx.risolviRecord.length);
});

console.log('\npassati: ' + passati + '  falliti: ' + falliti);
if (falliti) { problemi.forEach(p => console.log('  - ' + p)); process.exit(1); }
process.exit(0);
