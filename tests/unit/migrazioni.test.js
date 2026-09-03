#!/usr/bin/env node
/* tests/unit/migrazioni.test.js — le migrazioni dello schema.
 *
 * Ogni migrazione deve: non perdere dati, essere idempotente, non toccare
 * dati di uno schema più recente del codice, e non inventare informazioni
 * che non ha.
 *
 * L'ultima è la regola meno ovvia e la più importante: la migrazione 5→6
 * aggiunge due date di calendario, e non sapendo se e quando l'utente abbia
 * esportato un file le lascia nulle. Una data inventata sarebbe peggio di
 * un'assenza dichiarata.
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
function uguale(a, b, m) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((m || '') + ' atteso ' + JSON.stringify(b) + ', ottenuto ' + JSON.stringify(a));
}

/* Solo i moduli necessari: migrations.js dipende da poco. */
function carica() {
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
    document: { documentElement: { setAttribute(){} }, getElementById: () => null,
                querySelectorAll: () => [], addEventListener(){} },
    navigator: { onLine: true }, location: { protocol: 'http:' },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    __magazzino: magazzino
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.__PT_TEST__ = true;
  const sandbox = vm.createContext(ctx);
  for (const f of ['js/config.js', 'js/config-firebase.js', 'js/utils.js', 'js/migrations.js']) {
    try { vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento di ' + f + ': ' + e.message); }
  }
  return ctx;
}

console.log('Migrazioni dello schema\n');

/* Un dataset di schema 1, la forma più vecchia che sappiamo leggere. */
function v1() {
  return { v: 1, items: [
    { id: 'a', label: 'con giorno singolo', area: 'lavoro', freq: 'weekly', day: 2 },
    { id: 'b', label: 'senza giorno', area: 'vita', freq: 'once', date: '2026-01-10' },
    null,                                    /* record incompleto: non deve far cadere */
    { id: 'c', label: 'in attesa', area: 'lavoro', freq: 'once', waiting: true }
  ], theme: 'scuro' };
}

const ctx = carica();

prova('da v1 a corrente: nessun dato perduto', () => {
  const r = ctx.migra(v1());
  assert(r.esito === 'migrato', 'esito ' + r.esito);
  assert(r.dati.v === ctx.SCHEMA_ATTUALE, 'schema ' + r.dati.v);
  const etichette = r.dati.items.filter(Boolean).map(i => i.label);
  uguale(etichette, ['con giorno singolo', 'senza giorno', 'in attesa'], 'etichette:');
});

prova('1→2: il giorno singolo diventa un elenco', () => {
  const r = ctx.migra(v1());
  const a = r.dati.items.find(i => i && i.id === 'a');
  uguale(a.days, [2], 'days:');
  assert(a.day === undefined, 'il campo day doveva sparire');
});

prova('2→3: le impostazioni compaiono, il tema si sposta', () => {
  const r = ctx.migra(v1());
  assert(r.dati.settings, 'settings mancante');
  assert(r.dati.settings.tema === 'scuro', 'il tema non è stato spostato');
  assert(r.dati.theme === undefined, 'il tema è rimasto nei dati');
  assert(Array.isArray(r.dati.chiusure), 'chiusure mancante');
});

prova('3→4: ogni record sincronizzabile ha una versione', () => {
  const r = ctx.migra(v1());
  assert(r.dati.versioni, 'tabella versioni mancante');
  for (const id of ['a', 'b', 'c'])
    assert(r.dati.versioni[id], 'versione mancante per ' + id);
  assert(r.dati.syncMeta.perRecord === true, 'perRecord non impostato');
});

prova('4→5: ciò che si ripete diventa «ricorrente», non «routine»', () => {
  const r = ctx.migra(v1());
  const a = r.dati.items.find(i => i && i.id === 'a');   /* weekly */
  const b = r.dati.items.find(i => i && i.id === 'b');   /* once */
  assert(a.tipo === 'ricorrente', 'tipo ' + a.tipo);
  assert(b.tipo === undefined, 'una voce singola non deve avere tipo');
});

prova('5→6: le date del calendario restano NULLE, non inventate', () => {
  const r = ctx.migra(v1());
  assert(r.dati.settings.ultimaEsportazioneIcs === null,
         'inventata: ' + r.dati.settings.ultimaEsportazioneIcs);
  assert(r.dati.settings.ultimaImportazioneIcs === null,
         'inventata: ' + r.dati.settings.ultimaImportazioneIcs);
  assert(r.dati.settings.gistMigrato === false, 'gistMigrato ' + r.dati.settings.gistMigrato);
});

prova('idempotenza: rieseguire non cambia nulla', () => {
  const primo = ctx.migra(v1()).dati;
  const secondo = ctx.migra(JSON.parse(JSON.stringify(primo))).dati;
  uguale(secondo, primo, 'la seconda esecuzione ha cambiato i dati:');
});

prova('dati già alla versione corrente: completati, non riscritti', () => {
  const r = ctx.migra({ v: ctx.SCHEMA_ATTUALE, items: [{ id: 'x', label: 'y', freq: 'daily' }] });
  assert(r.esito === 'aggiornato', 'esito ' + r.esito);
  assert(r.dati.items[0].label === 'y', 'etichetta perduta');
  assert(r.dati.items[0].tipo === 'ricorrente', 'campo mancante non completato');
});

prova('schema più recente del codice: lasciato intatto', () => {
  const r = ctx.migra({ v: 99, items: [{ id: 'z', label: 'dal futuro' }] });
  assert(r.esito === 'troppo-recente', 'esito ' + r.esito);
  assert(r.dati.items.length === 1, 'dati toccati');
  assert(r.dati.items[0].label === 'dal futuro', 'etichetta toccata');
  assert(r.dati.v === 99, 'versione riscritta a ' + r.dati.v);
});

prova('versione dedotta dal campo più alto fra v e schemaVersion', () => {
  /* Applicare una migrazione già applicata è sicuro perché sono
     idempotenti; saltarne una non lo è. Quindi in caso di disaccordo si
     tiene il numero più ALTO. */
  assert(ctx.versioneDati({ v: 3, schemaVersion: 5 }) === 5, 'ha tenuto il minore');
  assert(ctx.versioneDati({ v: 5, schemaVersion: 3 }) === 5, 'ha tenuto il minore');
  assert(ctx.versioneDati({}) === 1, 'senza versione dovrebbe essere 1');
  assert(ctx.versioneDati(null) === 1, 'null dovrebbe essere 1');
});

prova('normalizzaVersione rimuove il doppione', () => {
  const d = ctx.normalizzaVersione({ v: 3, schemaVersion: 5 });
  assert(d.v === 5, 'v = ' + d.v);
  assert(d.schemaVersion === undefined, 'schemaVersion è rimasto');
});

prova('dati illeggibili: migrazione annullata, originali intatti', () => {
  const circolare = { v: 1, items: [] };
  circolare.se = circolare;                 /* JSON.stringify fallisce */
  const r = ctx.migra(circolare);
  assert(r.esito === 'errore', 'esito ' + r.esito);
  assert(r.dati === circolare, 'i dati originali sono stati sostituiti');
});

prova('un record nullo non fa cadere nessun passo', () => {
  const r = ctx.migra({ v: 1, items: [null, undefined, 'stringa', 42,
                                      { id: 'ok', label: 'buono', freq: 'daily' }] });
  assert(r.esito === 'migrato', 'esito ' + r.esito);
  assert(r.dati.items.some(i => i && i.id === 'ok'), 'il record buono è stato perso');
});

prova('ogni passo dichiara da quale versione a quale', () => {
  const catena = ctx.PASSI_MIGRAZIONE;
  for (let i = 0; i < catena.length; i++) {
    assert(typeof catena[i].da === 'number' && typeof catena[i].a === 'number',
           'passo ' + i + ' senza da/a');
    assert(catena[i].a === catena[i].da + 1, 'passo ' + i + ' salta una versione');
    if (i > 0) assert(catena[i].da === catena[i-1].a, 'catena interrotta al passo ' + i);
    assert(catena[i].nome && catena[i].nome.length > 5, 'passo ' + i + ' senza nome utile');
  }
  assert(catena[catena.length-1].a === ctx.SCHEMA_ATTUALE,
         'la catena arriva a ' + catena[catena.length-1].a + ' e lo schema è ' + ctx.SCHEMA_ATTUALE);
});

prova('il registro dice che cosa è stato fatto', () => {
  const righe = [];
  const r = ctx.migra(v1(), t => righe.push(t));
  assert(righe.length >= 5, 'solo ' + righe.length + ' righe di registro');
  assert(righe.some(x => /1 → 2/.test(x)), 'il passo 1→2 non è registrato');
  assert(righe.some(x => /5 → 6/.test(x)), 'il passo 5→6 non è registrato');
  assert(righe[righe.length-1].indexOf(String(ctx.SCHEMA_ATTUALE)) >= 0,
         'l\'ultima riga non dichiara la versione raggiunta');
});

console.log('\npassati: ' + passati + '  falliti: ' + falliti);
if (falliti) { problemi.forEach(p => console.log('  - ' + p)); process.exit(1); }
process.exit(0);
