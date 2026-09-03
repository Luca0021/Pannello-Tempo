#!/usr/bin/env node
/* strumenti/backlog.mjs — verifica la coerenza fra la matrice dei ticket e
   il documento che la riassume.

   Perché esiste: i conteggi di BACKLOG-COVERAGE.md non vanno scritti a mano.
   Un totale scritto a mano è vero il giorno in cui lo scrivi e falso il
   giorno dopo, e nessuno se ne accorge — perché un numero sbagliato ha
   esattamente lo stesso aspetto di un numero giusto. La fonte è
   backlog.json; questo strumento ricalcola i totali da lì e li confronta
   con quelli scritti nel documento.

   Controlla cinque cose:
     1. la matrice è ben formata (stati ammessi, id unici, campi presenti);
     2. un ticket non COMPLETATO dichiara che cosa manca;
     3. un ticket COMPLETATO non si appoggia a una verifica non eseguita;
     4. i totali nel documento coincidono con quelli ricalcolati;
     5. ogni ticket citato nel codice o nei documenti è nella matrice,
        e ogni ticket nella matrice è citato da qualche parte.

   Uso:  node strumenti/backlog.mjs
   Esce con 1 se qualcosa non torna. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const RADICE = process.cwd();
const STATI = ['COMPLETATO', 'PARZIALE', 'NON INIZIATO'];
const problemi = [];
const avvisi = [];

function errore(m) { problemi.push(m); }
function avviso(m) { avvisi.push(m); }

/* ---------- 1. la matrice ---------- */

let matrice;
try {
  matrice = JSON.parse(readFileSync(join(RADICE, 'backlog.json'), 'utf8'));
} catch (e) {
  console.error('backlog.json non leggibile o non valido: ' + e.message);
  process.exit(1);
}

const ticket = Array.isArray(matrice.ticket) ? matrice.ticket : [];
if (!ticket.length) errore('backlog.json non contiene ticket.');

const visti = new Set();
for (const t of ticket) {
  const id = t && t.id;
  if (!id) { errore('un ticket è senza id.'); continue; }
  if (visti.has(id)) errore(id + ': compare due volte nella matrice.');
  visti.add(id);

  if (!STATI.includes(t.stato)) {
    errore(id + ': stato "' + t.stato + '" non ammesso (' + STATI.join(', ') + ').');
  }
  if (!t.titolo) errore(id + ': manca il titolo.');
  if (!Array.isArray(t.dove) || !t.dove.length) errore(id + ': manca "dove".');
  if (!t.verifica) errore(id + ': manca "verifica".');

  /* 2. un ticket aperto deve dire che cosa manca, altrimenti non è
        governabile: «PARZIALE» senza il resto è una sensazione. */
  if (t.stato !== 'COMPLETATO' && !String(t.manca || '').trim()) {
    errore(id + ': stato ' + t.stato + ' senza "manca". Va detto che cosa serve per chiuderlo.');
  }

  /* 3. e uno chiuso non può appoggiarsi a una prova che non è girata. */
  if (t.stato === 'COMPLETATO' && /non eseguit|mai eseguit|non girat/i.test(String(t.verifica))) {
    errore(id + ': COMPLETATO ma la verifica dichiara di non essere stata eseguita.');
  }
}

/* ---------- conteggi, ricalcolati ---------- */

const perStato = {};
for (const s of STATI) perStato[s] = 0;
for (const t of ticket) if (perStato[t.stato] !== undefined) perStato[t.stato]++;

const perArea = new Map();
for (const t of ticket) {
  const area = String(t.id).split('-')[0];
  if (!perArea.has(area)) { const v = {}; for (const s of STATI) v[s] = 0; v.totale = 0; perArea.set(area, v); }
  const v = perArea.get(area);
  if (v[t.stato] !== undefined) v[t.stato]++;
  v.totale++;
}

/* ---------- 4. i totali scritti nel documento ---------- */

const DOC = 'BACKLOG-COVERAGE.md';
let testoDoc = '';
try {
  testoDoc = readFileSync(join(RADICE, DOC), 'utf8');
} catch {
  errore(DOC + ' non esiste: va generato dalla matrice.');
}

if (testoDoc) {
  /* Le righe da controllare hanno la forma
       | <area> | <totale> | <completato> | <parziale> | <non iniziato> |
     e una riga finale con area «totale». Un numero diverso è un errore,
     non un dettaglio: è il numero che qualcuno leggerà al posto di
     leggere la matrice. */
  const righe = testoDoc.split(/\r?\n/).filter(r => /^\|\s*(\*\*)?[A-Z0-9]+/.test(r.trim()));
  let trovate = 0;

  for (const riga of righe) {
    const celle = riga.split('|').map(c => c.replace(/\*/g, '').trim()).filter((c, i, a) => !(i === 0 && !c) && !(i === a.length - 1 && !c));
    if (celle.length < 5) continue;
    const area = celle[0];
    const numeri = celle.slice(1, 5).map(c => Number(c));
    if (numeri.some(n => !Number.isInteger(n))) continue;

    let atteso = null;
    if (/^totale$/i.test(area)) {
      atteso = [ticket.length, perStato['COMPLETATO'], perStato['PARZIALE'], perStato['NON INIZIATO']];
    } else if (perArea.has(area)) {
      const v = perArea.get(area);
      atteso = [v.totale, v['COMPLETATO'], v['PARZIALE'], v['NON INIZIATO']];
    } else {
      continue;
    }

    trovate++;
    for (let i = 0; i < 4; i++) {
      if (numeri[i] !== atteso[i]) {
        errore(DOC + ': riga "' + area + '", colonna ' + (i + 1) +
               ': scritto ' + numeri[i] + ', ricalcolato ' + atteso[i] + '.');
      }
    }
  }

  if (!trovate) errore(DOC + ': non ho trovato nessuna riga di conteggio da verificare.');

  /* Ogni ticket della matrice deve comparire nel documento, e la sua riga
     deve riportare gli stessi campi. Senza questo controllo il documento
     può restare indietro sui dettagli — un percorso rinominato, un titolo
     cambiato — mentre i totali continuano a tornare, che è il modo più
     silenzioso di diventare falso. */
  const righeDoc = testoDoc.split(/\r?\n/);
  for (const t of ticket) {
    const riga = righeDoc.find(r => r.includes('**' + t.id + '**') && r.trim().startsWith('|'));
    if (!riga) { errore(DOC + ': ' + t.id + ' non ha una riga nella tabella.'); continue; }
    if (!riga.includes(t.titolo)) {
      errore(DOC + ': ' + t.id + ' ha un titolo diverso da quello della matrice.');
    }
    for (const d of t.dove) {
      if (!riga.includes(d)) {
        errore(DOC + ': ' + t.id + ' non riporta "' + d + '" fra i percorsi.');
      }
    }
  }

  /* e i percorsi dichiarati devono esistere davvero */
  for (const t of ticket) {
    for (const d of t.dove) {
      const pulito = d.replace(/\/$/, '');
      let c = false;
      try { statSync(join(RADICE, pulito)); c = true; } catch { c = false; }
      if (!c) errore(t.id + ': il percorso "' + d + '" non esiste.');
    }
  }
}

/* ---------- 5. citazioni nel codice e nei documenti ---------- */

const ESTENSIONI = new Set(['.js', '.mjs', '.css', '.md', '.yml', '.rules', '.html', '.txt']);
const SALTA = new Set(['.git', '.claude', 'node_modules', 'test-results', 'playwright-report']);
const RIF = /\b([A-Z0-9]{2,4})-(\d{3})\b/g;
const citati = new Map();

function scorri(dir) {
  let voci;
  try { voci = readdirSync(dir); } catch { return; }
  for (const nome of voci) {
    if (SALTA.has(nome)) continue;
    const pieno = join(dir, nome);
    let st;
    try { st = statSync(pieno); } catch { continue; }
    if (st.isDirectory()) { scorri(pieno); continue; }
    if (!ESTENSIONI.has(extname(nome))) continue;
    if (nome === 'backlog.json') continue;
    let testo;
    try { testo = readFileSync(pieno, 'utf8'); } catch { continue; }
    let m;
    RIF.lastIndex = 0;
    while ((m = RIF.exec(testo))) {
      const id = m[1] + '-' + m[2];
      if (!citati.has(id)) citati.set(id, new Set());
      citati.get(id).add(pieno.slice(RADICE.length + 1).replace(/\\/g, '/'));
    }
  }
}
scorri(RADICE);

/* Un ticket citato nel codice e assente dalla matrice è il caso pericoloso:
   il lavoro esiste e non risulta da nessuna parte. */
const AREE = new Set([...visti].map(id => id.split('-')[0]));
const NOTI_ASSENTI = new Set(Array.isArray(matrice.non_toccati) ? matrice.non_toccati : []);
for (const [id, file] of citati) {
  if (visti.has(id)) continue;
  if (NOTI_ASSENTI.has(id)) continue;          /* buco dichiarato nella matrice */
  if (!AREE.has(id.split('-')[0])) continue;   /* non è un ticket: SHA, WCAG, date */
  errore('il ticket ' + id + ' è citato in ' + [...file].join(', ') + ' ma non è nella matrice.');
}

/* Il contrario è solo un avviso: un ticket può essere nella matrice come
   deciso-di-non-fare, e non avere codice che lo citi. */
for (const t of ticket) {
  const soloDoc = citati.has(t.id)
    ? [...citati.get(t.id)].every(f => f.endsWith('.md'))
    : true;
  if (soloDoc && t.stato === 'COMPLETATO') {
    avviso(t.id + ': COMPLETATO ma citato solo nei documenti, mai nel codice.');
  }
}

/* ---------- esito ---------- */

console.log('ticket nella matrice: ' + ticket.length);
for (const s of STATI) console.log('  ' + s + ': ' + perStato[s]);
console.log('aree: ' + [...perArea.keys()].sort().join(', '));

for (const a of avvisi) console.log('AVVISO  ' + a);
for (const p of problemi) console.log('ERRORE  ' + p);

if (problemi.length) {
  console.log('');
  console.log('backlog: ' + problemi.length + ' problemi. La fonte è backlog.json:');
  console.log('correggi lì lo stato, poi allinea i conteggi in ' + DOC + '.');
  process.exit(1);
}
console.log('backlog: coerente.');
