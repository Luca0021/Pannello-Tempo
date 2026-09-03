#!/usr/bin/env node
/* strumenti/build.mjs — calcola l'impronta della build e la stampiglia.
 *
 * L'impronta descrive ciò che il BROWSER carica: i file serviti. Documenti,
 * collaudi, strumenti, regole Firestore e file di configurazione dello
 * sviluppo NON entrano. Se entrassero, l'impronta cambierebbe anche quando
 * il sito è identico, e i service worker degli utenti riscaricherebbero
 * tutto per niente.
 *
 * La stessa identità va in quattro punti, e devono coincidere:
 *   build.json          sorgenti, cache, schema, costruito
 *   js/versione.js      lo stesso, leggibile dal codice
 *   sw.js               VERSIONE, cioè il nome della cache
 *   index.html          data-build, data-cache, data-schema, meta build
 *
 * Se divergono, il service worker serve una build e la pagina un'altra: è
 * il difetto che produce una pagina bianca dopo un aggiornamento.
 *
 * Uso:
 *   node strumenti/build.mjs                 stampiglia
 *   node strumenti/build.mjs --solo-impronta stampa l'impronta e non scrive
 *   node strumenti/build.mjs --base <hash>   registra la build di partenza
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');

const STAMPIGLIATI = ['build.json', 'js/versione.js', 'sw.js', 'index.html'];

/* Che cosa NON entra nell'impronta. Elenco esplicito: un `.gitignore`-like
   implicito nasconde le decisioni. */
const FUORI = [
  /^\.git(\/|$)/, /^\.github(\/|$)/, /^\.claude(\/|$)/,
  /^tests(\/|$)/, /^strumenti(\/|$)/, /^firebase(\/|$)/,
  /^node_modules(\/|$)/, /^playwright-report(\/|$)/, /^test-results(\/|$)/,
  /\.md$/, /^\.env/, /^\.gitignore$/, /\.yml$/, /^package(-lock)?\.json$/,
  /^playwright\.config\./, /^_collaudo\.js$/, /^backlog\.json$/
];
/* NOTA: questo elenco è duplicato in _pt_build.ps1, lo strumento con cui
   l'impronta viene calcolata a mano quando Node non c'è. I due DEVONO
   coincidere. Se divergono, la prima esecuzione in CI produce un'impronta
   diversa senza che nulla sia cambiato nel sito, il passo «coerenza
   dell'impronta» fallisce, e i service worker di tutti gli utenti
   riscaricano l'intero scheletro per niente. È già successo. */

function elenca(dir, base = RADICE, out = []) {
  for (const nome of readdirSync(dir)) {
    const pieno = join(dir, nome);
    const rel = relative(base, pieno).split(sep).join('/');
    if (FUORI.some(re => re.test(rel))) continue;
    if (statSync(pieno).isDirectory()) elenca(pieno, base, out);
    else out.push(rel);
  }
  return out;
}

function impronta() {
  const file = elenca(RADICE).filter(f => !STAMPIGLIATI.includes(f)).sort();
  const h = createHash('sha256');
  for (const f of file) {
    /* il PERCORSO entra nell'impronta insieme al contenuto: rinominare un
       file senza cambiarne il contenuto è comunque una build diversa */
    h.update(f + '\n');
    h.update(readFileSync(join(RADICE, f)));
  }
  return { hash: h.digest('hex'), quanti: file.length, file };
}

const argomenti = process.argv.slice(2);
const soloImpronta = argomenti.includes('--solo-impronta');
const iBase = argomenti.indexOf('--base');
const base = iBase >= 0 ? (argomenti[iBase + 1] || '') : '';

const { hash, quanti } = impronta();
const sorgenti = hash.slice(0, 12);
const cache = 'pt-' + hash.slice(0, 8);

if (soloImpronta) {
  /* solo l'impronta, per il confronto fra due build consecutive: niente
     data, che cambierebbe fra le due e renderebbe il confronto inutile */
  console.log(sorgenti);
  process.exit(0);
}

/* Lo schema si legge dal sorgente, non si scrive a mano: due numeri di
   schema in due posti divergono. */
const mig = readFileSync(join(RADICE, 'js/migrations.js'), 'utf8');
const mSchema = /var SCHEMA_ATTUALE = (\d+)/.exec(mig);
if (!mSchema) {
  console.error('SCHEMA_ATTUALE non trovato in js/migrations.js');
  process.exit(2);
}
const schema = mSchema[1];
const quando = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

const bj = {
  app: '1.0.0',
  sorgenti,
  ...(base ? { base } : {}),
  commit: process.env.GITHUB_SHA || '',
  schema: Number(schema),
  cache,
  costruito: quando
};
writeFileSync(join(RADICE, 'build.json'), JSON.stringify(bj, null, 1) + '\n', 'utf8');

for (const p of ['js/versione.js', 'sw.js', 'index.html']) {
  const f = join(RADICE, p);
  let t = readFileSync(f, 'utf8');
  t = t.replace(/"sorgenti":\s*"[0-9a-f]+"/, `"sorgenti": "${sorgenti}"`)
       .replace(/"cache":\s*"[^"]+"/, `"cache": "${cache}"`)
       .replace(/"costruito":\s*"[^"]+"/, `"costruito": "${quando}"`)
       .replace(/"schema":\s*\d+/, `"schema": ${schema}`)
       .replace(/var VERSIONE = '[^']+';/, `var VERSIONE = '${cache}';`)
       .replace(/data-build="[0-9a-f]+"/, `data-build="${sorgenti}"`)
       .replace(/data-cache="[^"]+"/, `data-cache="${cache}"`)
       .replace(/data-schema="\d+"/, `data-schema="${schema}"`)
       .replace(/<meta name="build" content="[^"]*">/,
                `<meta name="build" content="1.0.0 ${sorgenti} ${quando}">`);
  writeFileSync(f, t, 'utf8');
}

console.log('impronta: ' + sorgenti);
console.log('cache:    ' + cache);
console.log('schema:   ' + schema);
console.log('file del sito: ' + quanti);
