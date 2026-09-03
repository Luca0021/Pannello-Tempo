/* tests/integration/gist-migrazione.test.js — MIG-001.
 *
 * Copre i casi che richiedono una risposta di rete: 401, 403, 404, file
 * troncato, gist pubblico, assenza di connessione. `fetch` viene sostituito
 * con risposte finte: nessun token vero, nessuna chiamata a GitHub.
 *
 * Eseguito dal runner del progetto:  node tests/runner.js
 * NON ESEGUITO nell'ambiente in cui è stato scritto: non c'è Node.
 * Comando in RUN-CI.md.
 */

'use strict';

/* ─── banco di prova minimo ────────────────────────────────────────────────
   I moduli del pannello sono script che condividono lo scope globale, non
   moduli ES. Il banco li carica in ordine dentro un contesto con un DOM
   finto: è lo stesso approccio dei collaudi unitari esistenti. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..', '..');

function creaContesto(opzioni) {
  const o = opzioni || {};
  const magazzino = Object.assign({}, o.storage || {});
  const localStorage = {
    getItem: k => (k in magazzino ? magazzino[k] : null),
    setItem: (k, v) => { magazzino[k] = String(v); },
    removeItem: k => { delete magazzino[k]; },
    key: n => Object.keys(magazzino)[n] || null,
    get length() { return Object.keys(magazzino).length; }
  };
  const ctx = {
    console,
    localStorage,
    __magazzino: magazzino,
    /* DOM ridotto all'osso: i moduli caricati qui non disegnano */
    document: {
      documentElement: { setAttribute(){}, getAttribute(){ return null; } },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style:{}, setAttribute(){}, appendChild(){}, click(){} }),
      addEventListener(){},
      body: { appendChild(){}, removeChild(){} }
    },
    window: {},
    navigator: { onLine: true, userAgent: 'nodo-di-prova' },
    location: { protocol: 'http:', href: 'http://127.0.0.1/' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, JSON, Math, Date, RegExp, Object, Array, String, Number, Boolean,
    encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat,
    URL, Error, TypeError,
    fetch: o.fetch || (() => Promise.reject(new Error('fetch non previsto in questa prova'))),
    render: () => {},
    toast: () => {},
    esc: s => String(s == null ? '' : s),
    /* alcune funzioni di disegno non servono qui */
    commit: () => {},
    save: () => {}
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.__PT_TEST__ = true;

  const ordine = fs.readFileSync(path.join(RADICE, 'js', 'ORDINE.txt'), 'utf8')
    .split(/\r?\n/).filter(Boolean);
  /* solo i moduli che servono a questa prova: caricare il disegno
     richiederebbe un DOM completo e non aggiungerebbe copertura */
  const serve = ['js/config.js','js/config-firebase.js','js/promessa.js','js/versione.js',
    'js/platform.js','js/utils.js','js/migrations.js','js/seed.js','js/state.js',
    'js/versioni.js','js/conflitti.js','js/stati.js','js/sync.js','js/sync-provider.js'];
  const sandbox = vm.createContext(ctx);
  for (const f of ordine) {
    if (serve.indexOf(f) < 0) continue;
    const src = fs.readFileSync(path.join(RADICE, f), 'utf8');
    try { vm.runInContext(src, sandbox, { filename: f }); }
    catch (e) { throw new Error('caricamento di ' + f + ' fallito: ' + e.message); }
  }
  return ctx;
}

/* risposta finta in stile fetch */
function risposta(stato, corpo, opzioni) {
  const o = opzioni || {};
  return Promise.resolve({
    ok: stato >= 200 && stato < 300,
    status: stato,
    json: () => Promise.resolve(typeof corpo === 'string' ? JSON.parse(corpo) : corpo),
    text: () => Promise.resolve(typeof corpo === 'string' ? corpo : JSON.stringify(corpo)),
    headers: { get: () => o.contentType || 'application/json' }
  });
}

/* ─── infrastruttura di asserzione ─────────────────────────────────────── */

let passati = 0, falliti = 0;
const problemi = [];

function prova(nome, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passati++; console.log('  ok   ' + nome); })
    .catch(e => { falliti++; problemi.push(nome + ' → ' + e.message);
                  console.log('  FALL ' + nome + ' → ' + e.message); });
}
function uguale(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' atteso ' + JSON.stringify(b) + ', ottenuto ' + JSON.stringify(a));
}
function contiene(t, sub, msg) {
  if (String(t).indexOf(sub) < 0) throw new Error((msg || '') + ' «' + sub + '» non trovato in «' + t + '»');
}

const ID  = 'a'.repeat(32);
const PAT = 'ghp_' + 'b'.repeat(36);

function bustaValida(v) {
  return JSON.stringify({ app:'pannello-tempo', rev:4, savedAt:'2026-08-01T10:00:00.000Z',
    data: { v: v || 6, items: [{ id:'x1', label:'Voce recuperata', area:'lavoro', freq:'once', date:'2026-08-20' }],
            capture: [], links: [], modelli: [] } });
}

/* ─── le prove ─────────────────────────────────────────────────────────── */

async function main() {
  console.log('MIG-001 — recupero dal servizio precedente (risposte finte)');

  await prova('401: token rifiutato', async () => {
    const c = creaContesto({ fetch: () => risposta(401, { message:'Bad credentials' }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    if (!e) throw new Error('avrebbe dovuto fallire');
    contiene(e.titolo, 'Token rifiutato');
    uguale(c.sync.gist.token, '', 'il token deve essere dimenticato:');
  });

  await prova('403: permesso mancante o limite', async () => {
    const c = creaContesto({ fetch: () => risposta(403, { message:'rate limit' }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'Permesso mancante');
    uguale(c.sync.gist.token, '');
  });

  await prova('404: non trovato', async () => {
    const c = creaContesto({ fetch: () => risposta(404, { message:'Not Found' }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'Non trovato');
  });

  await prova('rete assente', async () => {
    const c = creaContesto({ fetch: () => Promise.reject(new Error('Failed to fetch')) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'Nessuna connessione');
    uguale(c.sync.gist.token, '', 'anche dopo un errore di rete:');
  });

  await prova('lettura riuscita di un file privato', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public: false, files: { 'pannello.json': { content: bustaValida(6), truncated: false } } }) });
    const r = await c.leggiGistPerMigrazione(ID, PAT);
    uguale(r.dati.items.length, 1);
    uguale(r.avvisi.length, 0, 'un file privato e aggiornato non deve produrre avvisi:');
    uguale(c.sync.gist.token, '');
  });

  await prova('gist PUBBLICO: avvisa', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public: true, files: { 'pannello.json': { content: bustaValida(6), truncated: false } } }) });
    const r = await c.leggiGistPerMigrazione(ID, PAT);
    uguale(r.avvisi.length, 1);
    contiene(r.avvisi[0], 'PUBBLICO');
  });

  await prova('file troncato: scarica il resto', async () => {
    let chiamate = 0;
    const c = creaContesto({ fetch: (u) => {
      chiamate++;
      if (chiamate === 1) return risposta(200, {
        public: false, files: { 'pannello.json': { content: '{"tron', truncated: true, raw_url: 'https://esempio/raw' } } });
      return risposta(200, bustaValida(6));
    } });
    const r = await c.leggiGistPerMigrazione(ID, PAT);
    uguale(chiamate, 2, 'deve fare la seconda chiamata:');
    uguale(r.dati.items.length, 1, 'il contenuto completo deve arrivare:');
    contiene(r.avvisi.join(' '), 'troncato');
  });

  await prova('file troncato e raw non raggiungibile', async () => {
    let chiamate = 0;
    const c = creaContesto({ fetch: () => {
      chiamate++;
      if (chiamate === 1) return risposta(200, {
        public: false, files: { 'pannello.json': { content: '{"tron', truncated: true, raw_url: 'https://esempio/raw' } } });
      return risposta(500, 'errore');
    } });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'troppo grande');
  });

  await prova('file con nome diverso, unico dentro', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public: false, files: { 'altro.json': { content: bustaValida(6), truncated: false } } }) });
    const r = await c.leggiGistPerMigrazione(ID, PAT);
    contiene(r.avvisi.join(' '), 'altro.json');
  });

  await prova('più file, nessuno riconosciuto', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public: false, files: { 'a.json': { content:'{}' }, 'b.json': { content:'{}' } } }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'Più file');
  });

  await prova('nessun file dentro', async () => {
    const c = creaContesto({ fetch: () => risposta(200, { public:false, files:{} }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'Nessun file dentro');
  });

  await prova('JSON non valido', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public:false, files: { 'pannello.json': { content:'{non json' } } }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'Contenuto illeggibile');
  });

  await prova('JSON valido ma non un backup', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public:false, files: { 'pannello.json': { content:'{"qualcosa":1}' } } }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'Non è un backup');
  });

  await prova('schema più recente del codice: rifiutato', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public:false, files: { 'pannello.json': { content: bustaValida(99) } } }) });
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'versione più recente');
  });

  await prova('schema precedente: accettato con avviso', async () => {
    const c = creaContesto({ fetch: () => risposta(200, {
      public:false, files: { 'pannello.json': { content: bustaValida(3) } } }) });
    const r = await c.leggiGistPerMigrazione(ID, PAT);
    contiene(r.avvisi.join(' '), 'schema precedente');
    uguale(r.schema, 3);
  });

  await prova('la scrittura è impossibile', async () => {
    const c = creaContesto({});
    uguale(typeof c.gistWrite, 'undefined', 'gistWrite non deve esistere:');
    const e = await c.PROVIDER.gist.push('x').then(() => null, x => x);
    contiene(e.titolo, 'Scrittura disattivata');
  });

  await prova('Gist non si dichiara mai configurato', async () => {
    const c = creaContesto({ storage: { 'pannello-tempo:sync': JSON.stringify({
      provider:'gist', gist:{ id: ID, token: PAT } }) } });
    c.loadSync();
    uguale(c.PROVIDER.gist.isConfigured(), false);
    uguale(c.sync.provider, 'gist', 'il provider salvato viene letto…');
    uguale(c.syncReady(), false, '…ma non è mai pronto:');
  });

  await prova('il token salvato da una versione precedente non viene ricaricato', async () => {
    const c = creaContesto({ storage: { 'pannello-tempo:sync': JSON.stringify({
      provider:'gist', gist:{ id: ID, token: PAT }, fb:{ refresh:'R', idToken:'T' } }) } });
    c.loadSync();
    uguale(c.sync.gist.token, '', 'il token non deve entrare in memoria:');
    uguale(c.sync.fb.refresh, '');
    uguale(c.sync.fb.idToken, '');
  });

  await prova('l\'interruttore di rimozione futura disattiva la lettura', async () => {
    const c = creaContesto({ fetch: () => risposta(200, { public:false, files:{} }) });
    c.LETTORE_GIST_ATTIVO = false;
    const e = await c.leggiGistPerMigrazione(ID, PAT).then(() => null, x => x);
    contiene(e.titolo, 'non più disponibile');
    /* e non riattiva la scrittura */
    uguale(typeof c.gistWrite, 'undefined');
  });

  console.log('\npassati: ' + passati + '  falliti: ' + falliti);
  if (falliti) { problemi.forEach(p => console.log('  - ' + p)); process.exit(1); }
  process.exit(0);
}

main().catch(e => { console.error('banco di prova non avviabile: ' + e.message); process.exit(2); });
