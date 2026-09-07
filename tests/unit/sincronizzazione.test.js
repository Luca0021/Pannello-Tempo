#!/usr/bin/env node
/* tests/unit/sincronizzazione.test.js — il collaudo che mancava, e per cui
 * la sincronizzazione non ha mai funzionato.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IL BUCO CHE QUESTO FILE CHIUDE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `normalizzaLettura()` restituiva `{ rev, payload }`, mentre tutti e quattro
 * i chiamanti di `readRemote()` in js/sync.js implementano un contratto
 * diverso: il valore risolto deve essere il TESTO del documento, perché
 * finisce in `remoteRevOf(txt)` — che comincia con `txt.trim()` — oppure in
 * `txt.trim()` direttamente.
 *
 * Il risultato era un TypeError che in `pushNow` finiva nel `.catch` finale e
 * diventava «Errore imprevisto»: **la scrittura non partiva mai**, per
 * chiunque, a ogni tentativo.
 *
 * Perché nessuna prova l'aveva visto — ed è la parte che vale la pena
 * ricordare:
 *
 *   - le prove unitarie e d'integrazione esercitano gli ADATTATORI
 *     direttamente (`fbRead`, `gistRead`, `interpretaContenutoGist`), non il
 *     percorso del dominio che li usa;
 *   - il collaudo della cancellazione usa risposte finte, e non passa da
 *     `pushNow`;
 *   - le Security Rules sono state verificate con chiamate REST scritte a
 *     mano, che non attraversano il codice del pannello;
 *   - i collaudi in browser non hanno mai un servizio con cui parlare.
 *
 * Nessuno di quei collaudi è sbagliato. Mancava quello che esercita
 * `pushNow` contro un servizio finto, cioè il punto in cui il dominio e
 * l'adattatore si incontrano. È questo.
 *
 * La prova 05 è quella che conta: fa girare `pushNow` fino in fondo e
 * verifica che una PATCH sia stata davvero inviata. Se qualcuno rimettesse
 * un oggetto dove va del testo, quella prova diventa rossa.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..', '..');

let passati = 0, falliti = 0;
function prova(nome, fn) {
  try { fn(); passati++; console.log('  ok   ' + nome); }
  catch (e) { falliti++; console.log('  FALL ' + nome + ' → ' + e.message); }
}
async function provaAsync(nome, fn) {
  try { await fn(); passati++; console.log('  ok   ' + nome); }
  catch (e) { falliti++; console.log('  FALL ' + nome + ' → ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'asserzione falsa'); }

const SALTA_AVVIO = new Set(['js/boot.js', 'js/pwa-boot.js']);

function carica() {
  const magazzino = {};
  const ctx = {
    console, Object, Array, JSON, Date, Math, String, Number, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Intl, Promise,
    localStorage: {
      getItem: k => (k in magazzino ? magazzino[k] : null),
      setItem: (k, v) => { magazzino[k] = String(v); },
      removeItem: k => { delete magazzino[k]; },
      key: n => Object.keys(magazzino)[n] || null,
      get length() { return Object.keys(magazzino).length; }
    },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){}, key: () => null, length: 0 },
    document: { documentElement: { setAttribute(){}, lang: 'it' }, getElementById: () => null,
                querySelectorAll: () => [], addEventListener(){},
                createElement: () => ({ style:{}, setAttribute(){} }) },
    navigator: { onLine: true, userAgent: 'nodo-di-prova', language: 'it-IT' },
    location: { protocol: 'http:', href: 'http://localhost/', search: '', hash: '', pathname: '/' },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    fetch: () => Promise.reject(new Error('nessuna rete: la prova deve sostituire fetch')),
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
    requestAnimationFrame: fn => setTimeout(fn, 0),
    URL, Blob: function(){}, crypto: { getRandomValues: a => a },
    caches: undefined, indexedDB: undefined
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  const sandbox = vm.createContext(ctx);
  const ordine = fs.readFileSync(path.join(RADICE, 'js/ORDINE.txt'), 'utf8')
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const f of ordine) {
    if (SALTA_AVVIO.has(f)) continue;
    try { vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento di ' + f + ': ' + e.message); }
  }
  /* Ambiente EMULATORE con valori finti: gli endpoint puntano a 127.0.0.1 e
     `fetch` è comunque sostituita. Non si tocca nessun progetto reale, e la
     prova non dipende da quale configurazione sia stata generata. */
  ctx.FIREBASE_CONFIG.ambiente = 'emulatore';
  ctx.FIREBASE_CONFIG.apiKey = 'AIza-finta-per-il-collaudo';
  ctx.FIREBASE_CONFIG.projectId = 'demo-pannello';
  ctx.render = function(){};          /* niente disegno in questo contesto */
  /* `S.data` nasce null: lo popola `load()`, che qui non è ancora passato
     perché js/boot.js è escluso (pretende un DOM completo). Senza questo,
     `pushNow` cade su `S.data.items` prima di arrivare al punto in prova. */
  ctx.load();
  return ctx;
}

console.log('Sincronizzazione: il contratto fra dominio e adattatore\n');

const ctx = carica();

/* ═════════════════════════════════════════════════════════════════════════
   1. `normalizzaLettura` normalizza a TESTO
   ═════════════════════════════════════════════════════════════════════════ */

console.log('1 · normalizzaLettura restituisce testo');

prova('una stringa resta la stessa stringa', () => {
  const t = '{"app":"pannello-tempo","rev":3}';
  assert(ctx.normalizzaLettura(t) === t, 'ha restituito ' + JSON.stringify(ctx.normalizzaLettura(t)));
});

prova('null e undefined diventano stringa vuota, non un oggetto', () => {
  assert(ctx.normalizzaLettura(null) === '', 'null → ' + JSON.stringify(ctx.normalizzaLettura(null)));
  assert(ctx.normalizzaLettura(undefined) === '', 'undefined → ' + JSON.stringify(ctx.normalizzaLettura(undefined)));
});

prova('{rev,payload} restituisce il payload come testo', () => {
  const t = '{"app":"pannello-tempo","rev":7}';
  assert(ctx.normalizzaLettura({ rev: 7, payload: t }) === t, 'payload stringa non estratto');
  const o = ctx.normalizzaLettura({ rev: 7, payload: { app: 'pannello-tempo', rev: 7 } });
  assert(typeof o === 'string', 'payload oggetto non serializzato: ' + typeof o);
  assert(JSON.parse(o).rev === 7, 'la rev si è persa nella serializzazione');
});

prova('il risultato è sempre digeribile da remoteRevOf', () => {
  /* è LA proprietà che serve: qualunque cosa esca da normalizzaLettura deve
     poter entrare in remoteRevOf senza esplodere */
  const casi = [null, undefined, '', '{"rev":2}', { rev: 5, payload: '{"rev":5}' },
                { rev: 9, payload: { rev: 9 } }, { qualcosa: 'altro' }];
  for (const c of casi) {
    const t = ctx.normalizzaLettura(c);
    const r = ctx.remoteRevOf(t);          /* non deve lanciare */
    assert(r && typeof r.rev === 'number', 'remoteRevOf non ha risposto per ' + JSON.stringify(c));
  }
});

/* ═════════════════════════════════════════════════════════════════════════
   2. `readRemote()` risolve col testo, e `pushNow` scrive davvero
   ═════════════════════════════════════════════════════════════════════════ */

console.log('\n2 · il percorso del dominio, contro un servizio finto');

function sessioneFinta() {
  ctx.sync.provider = 'firebase';
  ctx.sync.account = true;
  ctx.sync.fb.email = 'utente@example.com';
  ctx.sync.fb.uid = 'utente-di-prova';
  ctx.sync.fb.idToken = 'token-finto';
  ctx.sync.fb.expAt = Date.now() + 600000;
  ctx.sync.rev = 0;
  ctx.sync.dirty = true;
  ctx.sync.busy = false;
  ctx.sync.err = null;
  ctx.sync.conflict = null;
}

/* Un servizio finto che registra le chiamate. GET risponde col documento
   corrente, PATCH lo aggiorna: è il minimo perché `pushNow` possa compiere
   il suo giro completo, leggere e poi scrivere. */
function servizioFinto(documento) {
  const chiamate = [];
  let doc = documento;
  ctx.fetch = function (url, opzioni) {
    const metodo = (opzioni && opzioni.method) || 'GET';
    chiamate.push({ metodo, url: String(url) });
    if (metodo === 'GET') {
      if (doc === null) return Promise.resolve({ ok: false, status: 404,
        json: () => Promise.resolve({}), text: () => Promise.resolve('') });
      return Promise.resolve({ ok: true, status: 200,
        json: () => Promise.resolve({ fields: { payload: { stringValue: doc } } }),
        text: () => Promise.resolve('') });
    }
    if (metodo === 'PATCH') {
      const corpo = JSON.parse(opzioni.body);
      doc = corpo.fields.payload.stringValue;
      return Promise.resolve({ ok: true, status: 200,
        json: () => Promise.resolve({ name: 'documenti/x' }), text: () => Promise.resolve('') });
    }
    return Promise.resolve({ ok: true, status: 200,
      json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };
  return { chiamate, leggiDoc: () => doc };
}

const attendi = async (cond, ms) => {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < (ms || 3000)) await new Promise(r => setTimeout(r, 10));
  return cond();
};

async function main() {
  await provaAsync('readRemote() risolve con una STRINGA, non con un oggetto', async () => {
    sessioneFinta();
    servizioFinto('{"app":"pannello-tempo","rev":4,"data":{"items":[]}}');
    const v = await ctx.readRemote();
    assert(typeof v === 'string', 'ha risolto con ' + (v === null ? 'null' : typeof v) +
      ' invece che con una stringa: è il difetto per cui pushNow non scriveva');
    assert(ctx.remoteRevOf(v).rev === 4, 'la rev non si legge: ' + JSON.stringify(ctx.remoteRevOf(v)));
  });

  await provaAsync('readRemote() su documento assente risolve con stringa vuota', async () => {
    sessioneFinta();
    servizioFinto(null);
    const v = await ctx.readRemote();
    assert(typeof v === 'string', 'ha risolto con ' + typeof v);
    assert(v === '', 'atteso vuoto, ottenuto ' + JSON.stringify(v.slice(0, 40)));
    assert(ctx.remoteRevOf(v).rev === 0, 'rev non nulla su documento assente');
  });

  await provaAsync('pushNow() invia davvero una PATCH e conclude senza errore', async () => {
    sessioneFinta();
    const s = servizioFinto(null);
    ctx.pushNow(true);
    const finito = await attendi(() => ctx.sync.busy === false && ctx.sync.status !== 'salvataggio…', 5000);
    assert(finito, 'pushNow non si è concluso: stato «' + ctx.sync.status + '»');
    assert(!ctx.sync.err, 'errore riportato: «' + (ctx.sync.err && ctx.sync.err.titolo) +
      ' — ' + (ctx.sync.err && ctx.sync.err.causa) + '»');
    const patch = s.chiamate.filter(c => c.metodo === 'PATCH');
    assert(patch.length === 1, 'PATCH inviate: ' + patch.length + ' (attesa 1). Chiamate: ' +
      JSON.stringify(s.chiamate.map(c => c.metodo)));
    assert(/\/users\/utente-di-prova\/datasets\/current/.test(patch[0].url),
      'percorso inatteso: ' + patch[0].url);
    assert(ctx.sync.dirty === false, 'dopo un invio riuscito «dirty» deve essere falso');
    assert(ctx.sync.status === 'sincronizzato', 'stato finale: «' + ctx.sync.status + '»');
  });

  await provaAsync('il documento scritto contiene i dati, con rev incrementata', async () => {
    sessioneFinta();
    ctx.S.data.items = [{ id: 'x1', label: 'una voce', area: 'lavoro', freq: 'once' }];
    const s = servizioFinto('{"app":"pannello-tempo","rev":6,"data":{"items":[]}}');
    ctx.pushNow(true);
    await attendi(() => ctx.sync.busy === false && ctx.sync.status !== 'salvataggio…', 5000);
    const scritto = JSON.parse(s.leggiDoc());
    assert(scritto.app === 'pannello-tempo', 'campo app: ' + scritto.app);
    assert(scritto.rev === 7, 'rev attesa 7 (6+1), ottenuta ' + scritto.rev);
    assert(scritto.data && Array.isArray(scritto.data.items), 'i dati non ci sono');
    assert(scritto.data.items.some(v => v.label === 'una voce'), 'la voce non è nel documento scritto');
  });

  await provaAsync('un rifiuto del servizio diventa un errore con un titolo, non un TypeError', async () => {
    sessioneFinta();
    ctx.fetch = () => Promise.resolve({ ok: false, status: 403,
      json: () => Promise.resolve({ error: { status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } }),
      text: () => Promise.resolve('{"error":{"status":"PERMISSION_DENIED","message":"Missing or insufficient permissions."}}') });
    ctx.pushNow(true);
    await attendi(() => ctx.sync.busy === false && ctx.sync.status === 'errore', 5000);
    assert(ctx.sync.err, 'nessun errore registrato');
    assert(!/TypeError|is not a function|undefined/.test(String(ctx.sync.err.tecnico || '')),
      'l\'errore riportato è un difetto di programmazione, non una risposta del servizio: ' +
      ctx.sync.err.tecnico);
    assert(ctx.sync.dirty === true, 'dopo un invio non riuscito «dirty» deve restare vero: '
      + 'le modifiche non si perdono in silenzio');
  });

  console.log('\n─────────────────────────────');
  console.log('  ' + passati + ' passate, ' + falliti + ' fallite');
  console.log('─────────────────────────────');
  process.exit(falliti ? 1 : 0);
}

main();
