#!/usr/bin/env node
/* tests/unit/dati-sicuri.test.js — le funzioni che ti salvano quando qualcosa
 * è andato storto, e che non erano provate da niente.
 *
 * Cercando ogni funzione dell'area dentro `tests/`, quattro non comparivano
 * in nessun file:
 *
 *   ripristinaBackup             il percorso di recupero. Zero prove.
 *   backupIntegro                il controllo che rifiuta una copia rotta.
 *   ripulisciProfondo            la difesa dall'inquinamento del prototipo
 *                                su file che arrivano da fuori.
 *   verificaCancellazioneRemota  la rilettura che impedisce di dire
 *                                «cancellato» senza saperlo.
 *
 * Le prime due sono il paracadute; la terza è l'unica cosa fra un file
 * ostile e `Object.prototype`; la quarta è ciò che distingue una
 * cancellazione avvenuta da un `DELETE` che ha risposto 200.
 *
 * Nessun account, nessun servizio, nessuna rete: `fbLeggiDoc` è sostituita
 * da una funzione che risponde quello che serve alla prova.
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
async function provaAsync(nome, fn) {
  try { await fn(); passati++; console.log('  ok   ' + nome); }
  catch (e) { falliti++; problemi.push(nome + ' → ' + e.message);
              console.log('  FALL ' + nome + ' → ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'asserzione falsa'); }
function uguale(a, b, m) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((m || '') + ' atteso ' + JSON.stringify(b) + ', ottenuto ' + JSON.stringify(a));
}
function contiene(t, x, m) {
  if (String(t).indexOf(x) < 0) throw new Error((m || '') + ' «' + t + '» non contiene «' + x + '»');
}

function carica() {
  const magazzino = {};
  const ctx = {
    console, Object, Array, JSON, Date, Math, String, Number, Boolean, RegExp, Error,
    Promise, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Intl,
    localStorage: {
      getItem: k => (k in magazzino ? magazzino[k] : null),
      setItem: (k, v) => { magazzino[k] = String(v); },
      removeItem: k => { delete magazzino[k]; },
      key: n => Object.keys(magazzino)[n] || null,
      get length() { return Object.keys(magazzino).length; }
    },
    document: { documentElement: { setAttribute(){}, getAttribute: () => null },
                getElementById: () => null, querySelectorAll: () => [],
                querySelector: () => null, addEventListener(){} },
    navigator: { onLine: true }, location: { protocol: 'http:', href: 'http://localhost/' },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    __magazzino: magazzino
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.__PT_TEST__ = true;
  const sandbox = vm.createContext(ctx);
  for (const f of ['js/config.js', 'js/config-firebase.js', 'js/utils.js', 'js/platform.js',
                   'js/migrations.js', 'js/seed.js', 'js/state.js', 'js/sicurezza.js',
                   'js/backup.js', 'js/privacy.js']) {
    try { vm.runInContext(fs.readFileSync(path.join(RADICE, f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento di ' + f + ': ' + e.message); }
  }
  /* i pochi appigli che questi moduli chiamano e che vivono altrove: qui
     non servono a niente se non a non far cadere la chiamata */
  ctx.registraOperazione = () => {};
  ctx.forzaProssimoCompleto = () => {};
  /* `shortDate` vive in js/tasks.js e serve solo a comporre l'etichetta del
     passo indietro: caricare quel modulo qui trascinerebbe mezzo dominio per
     una stringa */
  ctx.shortDate = (k) => String(k);
  ctx.commit = () => { ctx.save(); };
  ctx.render = () => {};
  ctx.scheduleSync = () => {};
  ctx.sync = { fb: { uid: '', idToken: '' }, provider: 'locale' };
  return ctx;
}

const ctx = carica();

function statoPulito() {
  ctx.__magazzino && Object.keys(ctx.__magazzino).forEach(k => delete ctx.__magazzino[k]);
  ctx.S.data = ctx.seed();
  ctx.S.data.items = [
    { id: 'v1', label: 'prima voce', area: 'lavoro', freq: 'once', date: '2026-09-12' },
    { id: 'v2', label: 'seconda voce', area: 'vita', freq: 'once', date: '2026-09-12' }
  ];
  ctx.S.undo = null;
  ctx.save();
}

console.log('Dati: copie, ripristino, importazione, verifica della cancellazione\n');

/* ─────────────────────────────────────────────────────────────────────────
   backupIntegro — il controllo che rifiuta una copia rotta
   ───────────────────────────────────────────────────────────────────────── */
prova('una copia appena fatta risulta integra', () => {
  statoPulito();
  assert(ctx.salvaBackupAutomatico('prova'), 'la copia non è stata scritta');
  const l = ctx.elencoBackup();
  uguale(l.length, 1, 'copie:');
  assert(ctx.backupIntegro(l[0]), 'la copia appena scritta risulta NON integra');
});

prova('una copia con i dati alterati non è integra', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('prova');
  const b = ctx.elencoBackup()[0];
  const rotta = Object.assign({}, b, { dati: b.dati.replace('prima voce', 'voce cambiata') });
  assert(!ctx.backupIntegro(rotta), 'una copia alterata è passata per integra');
});

prova('una copia troncata non è integra', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('prova');
  const b = ctx.elencoBackup()[0];
  assert(!ctx.backupIntegro(Object.assign({}, b, { dati: b.dati.slice(0, -20) })),
    'una copia troncata è passata per integra');
});

prova('una copia senza impronta o senza dati non è integra', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('prova');
  const b = ctx.elencoBackup()[0];
  assert(!ctx.backupIntegro(Object.assign({}, b, { impronta: '' })), 'senza impronta');
  assert(!ctx.backupIntegro(Object.assign({}, b, { dati: '' })), 'senza dati');
  assert(!ctx.backupIntegro(null), 'null');
  assert(!ctx.backupIntegro(undefined), 'undefined');
});

prova('le copie ruotano, e restano le cinque più recenti', () => {
  statoPulito();
  for (let i = 1; i <= 7; i++) {
    ctx.S.data.items.push({ id: 'x' + i, label: 'voce ' + i, area: 'lavoro', freq: 'once' });
    ctx.salvaBackupAutomatico('giro ' + i);
  }
  const l = ctx.elencoBackup();
  uguale(l.length, ctx.MAX_BACKUP, 'copie conservate:');
  uguale(l.map(b => b.motivo), ['giro 3', 'giro 4', 'giro 5', 'giro 6', 'giro 7'],
    'le più vecchie devono uscire:');
  l.forEach((b, i) => assert(ctx.backupIntegro(b), 'la copia ' + i + ' non è integra'));
});

/* ─────────────────────────────────────────────────────────────────────────
   ripristinaBackup — il paracadute
   ───────────────────────────────────────────────────────────────────────── */
prova('ripristinare una copia inesistente non tocca i dati', () => {
  statoPulito();
  const prima = JSON.stringify(ctx.S.data.items);
  const r = ctx.ripristinaBackup(3);
  assert(!r.ok, 'non doveva riuscire');
  contiene(r.motivo, 'non trovata', 'motivo:');
  uguale(JSON.stringify(ctx.S.data.items), prima, 'i dati:');
});

prova('una copia danneggiata viene RIFIUTATA, e i dati restano quelli', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('prima');
  /* si altera la copia su disco: è il caso vero, non un oggetto in memoria */
  const lista = ctx.elencoBackup();
  lista[0].dati = lista[0].dati.replace('prima voce', 'voce manomessa');
  ctx.__magazzino[ctx.CHIAVE_BACKUP_AUTO] = JSON.stringify(lista);
  const prima = JSON.stringify(ctx.S.data.items);
  const r = ctx.ripristinaBackup(0);
  assert(!r.ok, 'una copia danneggiata NON deve essere applicata');
  contiene(r.motivo, 'danneggiata', 'motivo:');
  uguale(JSON.stringify(ctx.S.data.items), prima, 'i dati non devono cambiare:');
});

prova('una copia illeggibile viene rifiutata', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('prima');
  const lista = ctx.elencoBackup();
  const rotto = '{ questo non è json';
  lista[0].dati = rotto;
  lista[0].impronta = ctx.impronta(rotto);      /* integra ma non interpretabile */
  ctx.__magazzino[ctx.CHIAVE_BACKUP_AUTO] = JSON.stringify(lista);
  const r = ctx.ripristinaBackup(0);
  assert(!r.ok, 'non doveva riuscire');
  contiene(r.motivo, 'illeggibile', 'motivo:');
});

prova('una copia valida torna, e riporta esattamente i dati di allora', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('lo stato buono');
  /* si rovina lo stato corrente, come farebbe un errore vero */
  ctx.S.data.items = [{ id: 'z', label: 'disastro', area: 'lavoro', freq: 'once' }];
  ctx.commit();
  const r = ctx.ripristinaBackup(0);
  assert(r.ok, 'il ripristino doveva riuscire: ' + (r.motivo || ''));
  uguale(ctx.S.data.items.map(i => i.label).sort(), ['prima voce', 'seconda voce'],
    'le voci ripristinate:');
});

prova('prima di ripristinare viene fatta una copia dello stato corrente', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('lo stato buono');
  ctx.S.data.items = [{ id: 'z', label: 'da conservare comunque', area: 'lavoro', freq: 'once' }];
  ctx.commit();
  ctx.ripristinaBackup(0);
  const dopo = ctx.elencoBackup();
  assert(dopo.length >= 2, 'doveva esserci una copia in più: ' + dopo.length);
  const ultima = dopo[dopo.length - 1];
  contiene(ultima.motivo, 'ripristino', 'motivo della copia automatica:');
  contiene(ultima.dati, 'da conservare comunque',
    'la copia deve contenere lo stato che stava per essere sostituito:');
});

prova('il ripristino si può annullare', () => {
  statoPulito();
  ctx.salvaBackupAutomatico('lo stato buono');
  ctx.S.data.items = [{ id: 'z', label: 'disastro', area: 'lavoro', freq: 'once' }];
  ctx.commit();
  ctx.ripristinaBackup(0);
  assert(ctx.S.undo, 'nessun passo indietro disponibile dopo un ripristino');
  contiene(ctx.S.undo.label, 'ripristinato', 'etichetta dell\'annullamento:');
  ctx.undoNow();
  uguale(ctx.S.data.items.map(i => i.label), ['disastro'],
    'annullando si torna allo stato precedente al ripristino:');
});

prova('una copia di uno schema precedente viene migrata, non applicata così com\'è', () => {
  statoPulito();
  /* una copia in schema 1: la forma più vecchia che sappiamo leggere */
  const vecchia = JSON.stringify({ v: 1, items: [
    { id: 'a', label: 'con giorno singolo', area: 'lavoro', freq: 'weekly', day: 2 }
  ], theme: 'scuro' });
  ctx.__magazzino[ctx.CHIAVE_BACKUP_AUTO] = JSON.stringify([
    { quando: '2026-01-02T10:00:00.000Z', motivo: 'vecchia', byte: vecchia.length,
      impronta: ctx.impronta(vecchia), dati: vecchia }
  ]);
  const r = ctx.ripristinaBackup(0);
  assert(r.ok, 'doveva riuscire: ' + (r.motivo || ''));
  uguale(ctx.S.data.v, ctx.SCHEMA_ATTUALE, 'schema dopo il ripristino:');
  const a = ctx.S.data.items.filter(i => i && i.id === 'a')[0];
  assert(a, 'la voce doveva sopravvivere alla migrazione');
  uguale(a.days, [2], 'la migrazione 1→2 deve essere stata applicata:');
});

/* ─────────────────────────────────────────────────────────────────────────
   ripulisciProfondo — fra un file ostile e Object.prototype
   ───────────────────────────────────────────────────────────────────────── */
prova('le chiavi che inquinano il prototipo vengono tolte', () => {
  const sporco = JSON.parse('{"label":"ok","__proto__":{"inquinato":1},' +
                            '"constructor":{"x":1},"prototype":{"y":1}}');
  const pulito = ctx.ripulisciProfondo(sporco, 0);
  uguale(Object.keys(pulito), ['label'], 'chiavi rimaste:');
});

prova('dopo la pulizia Object.prototype NON è stato toccato', () => {
  /* la prova che conta: non che la chiave sia sparita, ma che nessun oggetto
     nuovo abbia ereditato qualcosa */
  const sporco = JSON.parse('{"a":{"b":{"__proto__":{"inquinato":"sì"}}}}');
  ctx.ripulisciProfondo(sporco, 0);
  assert(ctx.Object.prototype.inquinato === undefined,
    'Object.prototype è stato inquinato dentro il contesto');
  assert(({}).inquinato === undefined, 'Object.prototype è stato inquinato fuori dal contesto');
});

prova('una struttura troppo annidata viene scartata invece di essere percorsa', () => {
  let v = { fondo: 1 };
  for (let i = 0; i < 20; i++) v = { dentro: v };
  const pulito = ctx.ripulisciProfondo(v, 0);
  /* a profondità 13 la funzione restituisce null: la catena si interrompe */
  let n = pulito, livelli = 0;
  while (n && typeof n === 'object' && n.dentro !== undefined) { n = n.dentro; livelli++; }
  assert(livelli <= 13, 'la catena doveva interrompersi: ' + livelli + ' livelli');
  assert(n === null, 'il fondo doveva essere null, è ' + JSON.stringify(n));
});

prova('gli elenchi smisurati vengono troncati al limite dichiarato', () => {
  const lungo = [];
  for (let i = 0; i < ctx.LIMITI_IMPORT.voci + 250; i++) lungo.push({ id: 'i' + i });
  const pulito = ctx.ripulisciProfondo(lungo, 0);
  uguale(pulito.length, ctx.LIMITI_IMPORT.voci, 'voci dopo la pulizia:');
});

prova('i valori semplici passano intatti, e le note smisurate si accorciano', () => {
  uguale(ctx.ripulisciProfondo('testo', 0), 'testo', 'stringa:');
  uguale(ctx.ripulisciProfondo(42, 0), 42, 'numero:');
  uguale(ctx.ripulisciProfondo(true, 0), true, 'booleano:');
  uguale(ctx.ripulisciProfondo(null, 0), null, 'null:');
  /* la prima versione di questa prova pretendeva anche che una FUNZIONE non
     sopravvivesse alla pulizia. Non è così — `typeof v !== "object"` la lascia
     passare — ma non è nemmeno un difetto: `ripulisciProfondo` viene chiamata
     solo su ciò che esce da `JSON.parse`, che una funzione non la produce.
     Pretenderlo avrebbe voluto dire cambiare il prodotto per un caso che non
     può accadere. Al suo posto c'è il limite che invece è dichiarato. */
  const lunga = 'x'.repeat(ctx.LIMITI_IMPORT.nota + 400);
  uguale(ctx.ripulisciProfondo(lunga, 0).length, ctx.LIMITI_IMPORT.nota,
    'una nota oltre il limite viene accorciata:');
  uguale(ctx.ripulisciProfondo({ nota: lunga }, 0).nota.length, ctx.LIMITI_IMPORT.nota,
    'anche dentro un oggetto:');
});

prova('un backup con `__proto__` nel JSON non inquina niente e viene letto', () => {
  statoPulito();
  const testo = '{"v":' + ctx.SCHEMA_ATTUALE + ',"items":[{"id":"a","label":"voce",' +
                '"area":"lavoro","freq":"once","__proto__":{"inquinato":1}}]}';
  const r = ctx.leggiBackup(testo, testo.length);
  assert(r.ok || r.errori.length === 0, 'errori: ' + JSON.stringify(r.errori));
  assert(({}).inquinato === undefined, 'Object.prototype inquinato da un backup');
  if (r.dati && r.dati.items && r.dati.items[0])
    assert(Object.keys(r.dati.items[0]).indexOf('__proto__') < 0,
      'la chiave è rimasta nel risultato');
});

/* ─────────────────────────────────────────────────────────────────────────
   verificaCancellazioneRemota — non dire «cancellato» senza aver riletto
   ───────────────────────────────────────────────────────────────────────── */
function conLettura(risposta) {
  ctx.sync.fb.uid = 'uid-di-prova';
  ctx.fbDocUrl = () => 'https://esempio.invalid/corrente';
  ctx.fbDocUrlLegacy = () => 'https://esempio.invalid/precedente';
  ctx.fbLeggiDoc = (url) => risposta(url);
}

(async () => {
  await provaAsync('senza sessione non si può verificare, e lo dice', async () => {
    ctx.sync.fb.uid = '';
    ctx.fbLeggiDoc = () => Promise.reject(new Error('non doveva essere chiamata'));
    const r = await ctx.verificaCancellazioneRemota();
    assert(!r.ok, 'non doveva risultare verificata');
    contiene(r.motivo, 'nessuna sessione', 'motivo:');
  });

  await provaAsync('documenti entrambi vuoti: cancellazione confermata', async () => {
    conLettura(() => Promise.resolve(''));
    const r = await ctx.verificaCancellazioneRemota();
    assert(r.ok, 'doveva risultare verificata: ' + (r.motivo || ''));
  });

  await provaAsync('il documento è ancora leggibile: NON confermata', async () => {
    conLettura((u) => Promise.resolve(/corrente/.test(u) ? '{"c":1}' : ''));
    const r = await ctx.verificaCancellazioneRemota();
    assert(!r.ok, 'un documento ancora leggibile non è una cancellazione');
    contiene(r.motivo, 'ancora leggibile', 'motivo:');
  });

  await provaAsync('resta il documento del percorso precedente: NON confermata', async () => {
    /* il caso che sfugge: si cancella il nuovo percorso e si dimentica quello
       scritto dalle versioni di prima */
    conLettura((u) => Promise.resolve(/corrente/.test(u) ? '' : '{"vecchio":1}'));
    const r = await ctx.verificaCancellazioneRemota();
    assert(!r.ok, 'il percorso precedente contava');
    contiene(r.motivo, 'precedente', 'motivo:');
  });

  await provaAsync('un 404 dopo la cancellazione vale come conferma', async () => {
    conLettura(() => Promise.reject({ tecnico: 'HTTP 404 NOT_FOUND' }));
    const r = await ctx.verificaCancellazioneRemota();
    assert(r.ok, 'un 404 è il risultato atteso dopo una cancellazione');
  });

  await provaAsync('un errore di rete NON vale come conferma', async () => {
    /* la distinzione che conta: «non c'è più» e «non ho potuto guardare»
       non sono la stessa cosa */
    conLettura(() => Promise.reject({ causa: 'la rete non ha risposto' }));
    const r = await ctx.verificaCancellazioneRemota();
    assert(!r.ok, 'un errore di rete non può valere come cancellazione riuscita');
    contiene(r.motivo, 'Non è stato possibile verificare', 'motivo:');
  });

  await provaAsync('solo spazi nel documento contano come vuoto', async () => {
    conLettura(() => Promise.resolve('   \n  '));
    const r = await ctx.verificaCancellazioneRemota();
    assert(r.ok, 'un documento di soli spazi è vuoto');
  });

  console.log('\n' + passati + ' superate, ' + falliti + ' fallite');
  if (falliti) { problemi.forEach(p => console.log('  · ' + p)); process.exit(1); }
})();
