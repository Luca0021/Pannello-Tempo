#!/usr/bin/env node
/* tests/avvio.test.js — il pannello si carica senza errori.
 *
 * Carica tutti i moduli nell'ordine di ORDINE.txt dentro un DOM ridotto e
 * verifica che nessuno interrompa il caricamento e che le funzioni chiave
 * esistano.
 *
 * Perché serve: i moduli condividono lo scope globale, quindi un errore di
 * sintassi o un riferimento a una funzione inesistente in `js/coda.js`
 * impedisce il caricamento di tutti i moduli successivi, e la pagina resta
 * bianca. È già capitato. Questo collaudo lo scopre in mezzo secondo,
 * senza aprire un browser.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..');

let passati = 0, falliti = 0;
const problemi = [];
function prova(nome, fn) {
  try { fn(); passati++; console.log('  ok   ' + nome); }
  catch (e) { falliti++; problemi.push(nome + ' → ' + e.message);
              console.log('  FALL ' + nome + ' → ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'asserzione falsa'); }

/* DOM ridotto: abbastanza perché i moduli si carichino. Non disegna. */
function creaDom() {
  const elemento = () => ({
    style: {}, className: '', innerHTML: '', textContent: '',
    children: [], childNodes: [], attributes: [],
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    appendChild(){}, removeChild(){}, insertBefore(){}, addEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    closest(){ return null; }, focus(){}, blur(){}, click(){},
    getBoundingClientRect(){ return { top:0,left:0,right:0,bottom:0,width:0,height:0 }; },
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} }
  });
  const magazzino = {};
  return {
    document: Object.assign(elemento(), {
      documentElement: elemento(), body: elemento(), head: elemento(),
      getElementById(){ return null; }, createElement(){ return elemento(); },
      createTextNode(){ return { nodeType:3, textContent:'' }; },
      cookie: ''
    }),
    localStorage: {
      getItem: k => (k in magazzino ? magazzino[k] : null),
      setItem: (k,v) => { magazzino[k] = String(v); },
      removeItem: k => { delete magazzino[k]; },
      key: n => Object.keys(magazzino)[n] || null,
      get length(){ return Object.keys(magazzino).length; }
    },
    sessionStorage: { getItem(){ return null; }, setItem(){}, removeItem(){},
                      key(){ return null; }, length: 0 },
    navigator: { onLine: true, userAgent: 'nodo-di-prova', language: 'it-IT' },
    location: { protocol: 'http:', href: 'http://127.0.0.1/', search: '', hash: '', pathname: '/' },
    matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
    fetch: () => Promise.reject(new Error('nessuna rete nei collaudi di avvio')),
    requestAnimationFrame: fn => setTimeout(fn, 0),
    caches: undefined, indexedDB: undefined,
    Intl, console,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    URL, Blob: function(){}, crypto: { getRandomValues: a => a }
  };
}

console.log('Avvio: caricamento di tutti i moduli\n');

const ordine = fs.readFileSync(path.join(RADICE, 'js', 'ORDINE.txt'), 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);

/* boot.js e pwa-boot.js avviano l'applicazione: qui non servono, e
   richiederebbero un DOM completo. Il resto sì. */
const SALTA = new Set(['js/boot.js', 'js/pwa-boot.js']);

const ctx = creaDom();
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.__PT_TEST__ = true;
const sandbox = vm.createContext(ctx);

for (const f of ordine) {
  if (SALTA.has(f)) continue;
  prova('carica ' + f, () => {
    const src = fs.readFileSync(path.join(RADICE, f), 'utf8');
    vm.runInContext(src, sandbox, { filename: f });
  });
}

/* Le funzioni e gli oggetti che il resto del pannello dà per esistenti.
   Se una manca, qualche modulo si è caricato a metà. */
const ATTESI = [
  'S', 'P', 'sync', 'KEY', 'SKEY', 'PKEY',
  'SCHEMA_ATTUALE', 'migra', 'versioneDati', 'impostazioniPredefinite',
  'FIREBASE_CONFIG', 'firebaseConfigurato', 'endpointFirestore', 'vietaProduzioneNeiTest',
  'PROVIDER', 'provider', 'syncReady', 'saveSync', 'loadSync', 'senzaSegreti',
  'LIMITI_INVIO', 'LIMITI_IMPORT', 'puoInviare', 'registraScambio', 'datasetTroppoGrande', 'attesaDopoErrore',
  'accountDisponibile', 'esciAccount', 'ripulisciTokenPersistenti',
  'residuiSegretiSuDisco', 'auditSegreti', 'MODELLI_SENTINELLA',
  'areaDi', 'nomeArea', 'badgeArea', 'nomeAccessibile',
  'cancellaTutto', 'PASSI_CANCELLAZIONE', 'esportaJson', 'esportaCsv',
  'fondiPerRecord', 'aggiornaVersioni', 'azzeraIstantanea',
  'leggiGistPerMigrazione', 'interpretaContenutoGist', 'LETTORE_GIST_ATTIVO',
  'preparaAttivazione', 'controllaCampiAccount', 'controllaCampiGist'
];
for (const nome of ATTESI)
  prova('definito: ' + nome, () => assert(typeof ctx[nome] !== 'undefined', 'non definito'));

/* Invarianti che non devono regredire. */
prova('il provider predefinito è «locale»', () =>
  assert(ctx.sync.provider === 'locale', 'è «' + ctx.sync.provider + '»'));

prova('Gist non si dichiara configurato', () =>
  assert(ctx.PROVIDER.gist.isConfigured() === false, 'si dichiara configurato'));

prova('gistWrite non esiste', () =>
  assert(typeof ctx.gistWrite === 'undefined', 'esiste ancora'));

prova('senza configurazione l\'account non è disponibile', () =>
  assert(ctx.accountDisponibile() === false, 'risulta disponibile'));

prova('saveSync non scrive segreti', () => {
  ctx.sync.fb.idToken = 'X'.repeat(20);
  ctx.sync.fb.refresh = 'Y'.repeat(20);
  ctx.sync.gist.token = 'ghp_' + 'Z'.repeat(36);
  ctx.saveSync();
  const grezzo = ctx.localStorage.getItem(ctx.SKEY) || '';
  assert(grezzo.indexOf('X'.repeat(20)) < 0, 'idToken su disco');
  assert(grezzo.indexOf('Y'.repeat(20)) < 0, 'refresh su disco');
  assert(grezzo.indexOf('ghp_') < 0, 'token GitHub su disco');
});

prova('senzaSegreti rimuove i campi a qualsiasi profondità', () => {
  const p = ctx.senzaSegreti({ a: 1, fb: { idToken: 'x', email: 'e' },
                               dentro: { g: { token: 'y', id: 'i' } } });
  assert(p.fb.idToken === undefined, 'idToken conservato');
  assert(p.fb.email === 'e', 'email perduta');
  assert(p.dentro.g.token === undefined, 'token annidato conservato');
  assert(p.dentro.g.id === 'i', 'id perduto');
});

prova('lo schema del codice è un numero crescente', () =>
  assert(Number.isInteger(ctx.SCHEMA_ATTUALE) && ctx.SCHEMA_ATTUALE >= 6,
         'SCHEMA_ATTUALE = ' + ctx.SCHEMA_ATTUALE));

console.log('\npassati: ' + passati + '  falliti: ' + falliti);
if (falliti) { problemi.forEach(p => console.log('  - ' + p)); process.exit(1); }
process.exit(0);
