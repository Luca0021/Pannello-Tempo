#!/usr/bin/env node
/* tests/unit/messaggi-errore.test.js — il punto cieco della guardia sulla
 * terminologia, e due difetti che ci vivevano dentro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO COLLAUDO ESISTE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `tests/ui/terminologia.spec.js` vieta «Firebase», «Firestore», «GitHub»,
 * «gist», «apiKey», «UID» e altre venti espressioni nell'interfaccia. Ma le
 * cerca nel DOM RENDERIZZATO: guarda ciò che è sullo schermo mentre il
 * collaudo gira. I messaggi d'errore non sono sullo schermo — compaiono solo
 * quando l'errore capita — quindi la guardia non li ha mai letti.
 *
 * `ERRORI_FB` in js/sync.js è un elenco di messaggi rivolti all'utente, e
 * `dettaglioErrore()` è richiamata da otto punti, fra cui `sync.err`,
 * js/privacy.js e js/account.js: quei testi arrivano davvero sotto gli occhi
 * di chi usa il pannello. Erano l'unica parte dell'interfaccia senza guardia.
 *
 * Questo collaudo la mette, e la mette in modo STATICO: legge le stringhe
 * dalla tabella invece di aspettare che l'errore capiti in un browser.
 *
 * CHE COSA È FUORI PORTATA, E PERCHÉ. Solo i tre campi scritti da noi —
 * «titolo», «causa», «cosa fare» — sono controllati. Il quarto, `tecnico`,
 * contiene il messaggio GREZZO del servizio, tagliato a 300 caratteri:
 * proibirgli il gergo sarebbe impossibile (il gergo lo scrive il servizio,
 * non noi) e sbagliato (è il campo che serve a chi deve diagnosticare).
 * È un'esclusione dichiarata, non una dimenticanza: se un giorno `tecnico`
 * venisse mostrato senza distinguerlo dal resto del messaggio, sarebbe
 * quella la cosa da correggere, non questo collaudo.
 *
 * L'elenco delle espressioni vietate NON è copiato qui: viene estratto da
 * tests/ui/terminologia.spec.js. Due copie di una regola significano che
 * almeno una è sbagliata, ed è la lezione che questo progetto ha già pagato
 * con le tre copie divergenti delle Security Rules
 * (vedi firebase/firestore.rules, intestazione).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COME SONO STATI TROVATI I DIFETTI
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Eseguendo le verifiche contro il progetto Firebase REALE. L'accesso
 * funziona; la scrittura su Firestore viene negata, perché sul progetto ci
 * sono ancora le regole predefinite «production mode» che negano tutto.
 * Quindi il messaggio di PERMISSION_DENIED non è un caso di laboratorio: è
 * ESATTAMENTE ciò che un utente vede oggi, subito dopo essersi registrato.
 * Leggerlo con attenzione ha mostrato due cose sbagliate.
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

/* ─── la fonte unica delle espressioni vietate ───────────────────────────── */

function espressioniVietate() {
  const testo = fs.readFileSync(path.join(RADICE, 'tests/ui/terminologia.spec.js'), 'utf8');
  const m = /const VIETATE_NELLA_UI\s*=\s*(\[[\s\S]*?\n\]);/.exec(testo);
  assert(m, 'in terminologia.spec.js non trovo più VIETATE_NELLA_UI: '
    + 'se è stato rinominato, aggiorna questa estrazione invece di copiare l\'elenco');
  const grezze = vm.runInNewContext(m[1]);
  assert(Array.isArray(grezze) && grezze.length > 5,
    'l\'elenco estratto è troppo corto (' + (grezze && grezze.length) + '): estrazione sbagliata');
  /* ricostruite nel contesto di questo file: una RegExp nata in un altro
     contesto non è `instanceof RegExp` qui, e il confronto darebbe falsi ok */
  return grezze.map(r => new RegExp(r.source, r.flags));
}

/* ─── caricamento dei moduli, nell'ordine di ORDINE.txt ──────────────────── */

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
    fetch: () => Promise.reject(new Error('rete non disponibile nei collaudi')),
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
    requestAnimationFrame: fn => setTimeout(fn, 0),
    URL, Blob: function(){}, crypto: { getRandomValues: a => a },
    caches: undefined, indexedDB: undefined
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.__PT_TEST__ = true;
  const sandbox = vm.createContext(ctx);
  const ordine = fs.readFileSync(path.join(RADICE, 'js/ORDINE.txt'), 'utf8')
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const f of ordine) {
    if (SALTA_AVVIO.has(f)) continue;
    try { vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento di ' + f + ': ' + e.message); }
  }
  /* Configurazione FINTA e deterministica: questo collaudo non deve
     dipendere da quale ambiente è stato generato in js/config-firebase.js,
     né toccare mai un progetto vero. `emulatore` fa puntare gli endpoint a
     127.0.0.1, e `fetch` è comunque sostituita. */
  ctx.FIREBASE_CONFIG.ambiente = 'emulatore';
  ctx.FIREBASE_CONFIG.apiKey = 'AIza-finta-per-il-collaudo';
  ctx.FIREBASE_CONFIG.projectId = 'demo-pannello';
  return ctx;
}

console.log('Messaggi d\'errore rivolti all\'utente\n');

const VIETATE = espressioniVietate();
const ctx = carica();

/* ═════════════════════════════════════════════════════════════════════════
   1. Niente gergo nei messaggi d'errore
   ═════════════════════════════════════════════════════════════════════════ */

console.log('1 · la guardia sulla terminologia arriva anche qui');

prova('l\'elenco delle espressioni vietate è stato estratto, non copiato', () => {
  assert(VIETATE.length >= 20, 'estratte solo ' + VIETATE.length + ' espressioni');
  assert(VIETATE.some(r => r.source.indexOf('Firestore') >= 0),
    'fra le espressioni estratte non c\'è Firestore: l\'estrazione non funziona');
});

prova('nessun messaggio di ERRORI_FB contiene espressioni vietate', () => {
  const guasti = [];
  ctx.ERRORI_FB.forEach((voce, i) => {
    /* voce = [regexp, titolo, causa, cosa]: gli ultimi tre sono testo per
       l'utente. Il primo è un motivo di ricerca interno e non si vede. */
    ['titolo', 'causa', 'cosa'].forEach((campo, k) => {
      const testo = String(voce[k + 1] || '');
      VIETATE.forEach(rx => {
        if (rx.test(testo))
          guasti.push('ERRORI_FB[' + i + '].' + campo + ' contiene ' + rx
            + ' → «' + testo.slice(0, 90) + '»');
      });
    });
  });
  assert(guasti.length === 0, guasti.length + ' messaggi con gergo:\n      - ' + guasti.join('\n      - '));
});

prova('nessun messaggio di ripiego di dettaglioErrore contiene espressioni vietate', () => {
  /* i rami che NON passano dalla tabella: rete, 401, 403, 404, imprevisto */
  const casi = ['Failed to fetch', 'HTTP 401', 'HTTP 403', 'HTTP 404', 'qualcosa di mai visto'];
  const guasti = [];
  for (const caso of casi) {
    const d = ctx.dettaglioErrore(new Error(caso));
    for (const campo of ['titolo', 'causa', 'cosa'])
      VIETATE.forEach(rx => {
        if (rx.test(String(d[campo] || '')))
          guasti.push('dettaglioErrore(«' + caso + '»).' + campo + ' contiene ' + rx
            + ' → «' + String(d[campo]).slice(0, 90) + '»');
      });
  }
  assert(guasti.length === 0, guasti.length + ' messaggi con gergo:\n      - ' + guasti.join('\n      - '));
});

/* ═════════════════════════════════════════════════════════════════════════
   2. Il messaggio di PERMISSION_DENIED indica il percorso GIUSTO

   DIFETTO CORRETTO. Il consiglio diceva: «consenti lettura e scrittura su
   pannello/{uid}». Ma `pannello/{uid}` è il percorso delle VERSIONI
   PRECEDENTI: il pannello vi legge una volta per trasferire i dati e non ci
   scrive più (js/sync.js, fbDocUrlLegacy). La scrittura va in
   `users/{uid}/datasets/current`.

   Chi avesse seguito l'istruzione alla lettera avrebbe aperto le regole sul
   percorso sbagliato e si sarebbe ritrovato la sincronizzazione ancora
   rotta, senza alcun indizio nuovo. Era l'ultima delle tre copie divergenti
   descritte nell'intestazione di firebase/firestore.rules: le altre due sono
   state rimosse, questa era sopravvissuta dentro un messaggio d'errore, dove
   nessuno la cercava.
   ═════════════════════════════════════════════════════════════════════════ */

console.log('\n2 · il messaggio di PERMISSION_DENIED');

function vocePermessi() {
  const v = ctx.ERRORI_FB.find(x => /PERMISSION_DENIED/.test(x[0]));
  assert(v, 'in ERRORI_FB non c\'è più una voce per PERMISSION_DENIED');
  return v;
}

prova('non indica il percorso delle versioni precedenti', () => {
  const v = vocePermessi();
  const tutto = v.slice(1).join(' | ');
  assert(!/pannello\/\{uid\}/.test(tutto),
    'il consiglio indica ancora «pannello/{uid}», che è il percorso vecchio '
    + 'e in sola lettura: seguirlo non ripristina la sincronizzazione');
});

prova('il consiglio è rivolto a chi può davvero agire', () => {
  const v = vocePermessi();
  const cosa = String(v[3] || '');
  assert(cosa.length > 20, 'il campo «cosa fare» è vuoto o troppo corto');
  /* L'utente non possiede il progetto — vedi SYNC-DECISION.md — quindi non
     può correggere le regole, e un consiglio che gli chiede di farlo lo
     manda in un vicolo cieco. Il messaggio deve dirgli che i suoi dati non
     sono persi. */
  assert(/questo dispositivo|sul dispositivo|non (si|sono) perd/i.test(cosa),
    'il consiglio non dice all\'utente che i suoi dati restano sul dispositivo: '
    + '«' + cosa + '»');
});

/* ═════════════════════════════════════════════════════════════════════════
   3. La scrittura riporta il motivo, non solo il numero

   DIFETTO CORRETTO. `fbWrite` faceva `throw new Error("HTTP "+r.status)` e
   buttava via il corpo della risposta. Il corpo è l'unico posto dove
   Firestore scrive PERMISSION_DENIED, quindi la voce specifica della tabella
   NON poteva mai corrispondere su una scrittura: si cadeva nel ramo generico
   `/HTTP 403/`, il cui consiglio parlava dei permessi di un token di un
   ALTRO servizio di sincronizzazione — irrilevante per chi usa l'account, e
   incomprensibile.

   Asimmetria che rendeva il difetto difficile da vedere leggendo: la
   LETTURA passa da `jsonOrThrow`, che il corpo lo conserva. Lo stesso errore
   dava quindi un messaggio buono in lettura e uno fuorviante in scrittura.
   ═════════════════════════════════════════════════════════════════════════ */

console.log('\n3 · la scrittura riporta il motivo del rifiuto');

function rispostaFinta(stato, corpo) {
  const testo = JSON.stringify(corpo);
  return Promise.resolve({
    ok: stato >= 200 && stato < 300, status: stato,
    text: () => Promise.resolve(testo), json: () => Promise.resolve(corpo)
  });
}
const CORPO_NEGATO = {
  error: { code: 403, message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' }
};

function sessioneFinta() {
  ctx.sync.fb.idToken = 'token-finto-di-collaudo';
  ctx.sync.fb.expAt = Date.now() + 600000;
  ctx.sync.fb.uid = 'utente-di-prova';
}

async function main() {
  await provaAsync('fbWrite propaga PERMISSION_DENIED invece del solo numero', async () => {
    sessioneFinta();
    ctx.fetch = () => rispostaFinta(403, CORPO_NEGATO);
    let errore = null;
    try { await ctx.fbWrite('{"v":6,"rev":1}'); }
    catch (e) { errore = e; }
    assert(errore, 'fbWrite ha accettato una risposta 403 senza segnalare nulla');
    const m = String(errore.message || errore);
    assert(/PERMISSION_DENIED|Missing or insufficient permissions/i.test(m),
      'il messaggio non riporta il motivo, solo «' + m + '»: '
      + 'la voce specifica della tabella non potrà corrispondere');
  });

  await provaAsync('l\'errore di scrittura produce il messaggio SPECIFICO, non il 403 generico', async () => {
    sessioneFinta();
    ctx.fetch = () => rispostaFinta(403, CORPO_NEGATO);
    let errore = null;
    try { await ctx.fbWrite('{"v":6,"rev":1}'); } catch (e) { errore = e; }
    const d = ctx.dettaglioErrore(errore);
    const generico = ctx.dettaglioErrore(new Error('HTTP 403'));
    assert(d.titolo !== generico.titolo,
      'la scrittura negata dà lo stesso messaggio generico di un 403 qualunque '
      + '(«' + d.titolo + '»): il motivo vero non arriva all\'utente');
    assert(/PERMISSION_DENIED/.test(String(vocePermessi()[0])), 'coerenza della tabella');
  });

  await provaAsync('fbDelete propaga il motivo del rifiuto', async () => {
    sessioneFinta();
    ctx.fetch = () => rispostaFinta(403, CORPO_NEGATO);
    let errore = null;
    try { await ctx.fbDelete(); } catch (e) { errore = e; }
    assert(errore, 'fbDelete ha dichiarato riuscita una cancellazione negata');
    const m = String(errore.message || errore);
    assert(/PERMISSION_DENIED|Missing or insufficient permissions/i.test(m),
      'il messaggio non riporta il motivo, solo «' + m + '»');
  });

  await provaAsync('una scrittura riuscita resta riuscita', async () => {
    sessioneFinta();
    ctx.fetch = () => rispostaFinta(200, { name: 'documenti/x' });
    const esito = await ctx.fbWrite('{"v":6,"rev":1}');
    assert(esito === true, 'fbWrite non conferma più la scrittura riuscita: ' + JSON.stringify(esito));
  });

  await provaAsync('un 404 in cancellazione resta un successo', async () => {
    sessioneFinta();
    ctx.fetch = () => rispostaFinta(404, { error: { status: 'NOT_FOUND', message: 'no' } });
    const esito = await ctx.fbDelete();
    assert(esito === true,
      'un documento che non esiste è il risultato voluto di una cancellazione, non un errore');
  });

  console.log('\n─────────────────────────────');
  console.log('  ' + passati + ' passate, ' + falliti + ' fallite');
  console.log('─────────────────────────────');
  process.exit(falliti ? 1 : 0);
}

main();
