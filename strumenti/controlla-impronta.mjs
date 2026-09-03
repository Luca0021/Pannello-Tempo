#!/usr/bin/env node
/* strumenti/controlla-impronta.mjs
 *
 * Verifica che la stessa identità di build compaia identica nei quattro
 * punti che la portano. Se divergono, il service worker serve una build e
 * la pagina un'altra: è il difetto che produce una pagina bianca dopo un
 * aggiornamento, e si è già presentato.
 *
 * Controlla anche che ogni modulo elencato in js/ORDINE.txt sia caricato da
 * index.html e messo in cache da sw.js. Un modulo aggiunto in due posti su
 * tre funziona in locale e si rompe offline, o viceversa: è il tipo di
 * disallineamento che nessuno nota fino al primo utente senza rete.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = p => readFileSync(join(RADICE, p), 'utf8');

const problemi = [];

/* ─── 1. l'identità nei quattro punti ─── */
const bj = JSON.parse(leggi('build.json'));
const ver = leggi('js/versione.js');
const sw = leggi('sw.js');
const html = leggi('index.html');

const daVersione = {
  sorgenti: (/"sorgenti":\s*"([0-9a-f]+)"/.exec(ver) || [])[1],
  cache: (/"cache":\s*"([^"]+)"/.exec(ver) || [])[1],
  schema: Number((/"schema":\s*(\d+)/.exec(ver) || [])[1])
};
const daSw = { cache: (/var VERSIONE = '([^']+)';/.exec(sw) || [])[1] };
const daHtml = {
  sorgenti: (/data-build="([0-9a-f]+)"/.exec(html) || [])[1],
  cache: (/data-cache="([^"]+)"/.exec(html) || [])[1],
  schema: Number((/data-schema="(\d+)"/.exec(html) || [])[1])
};

if (bj.sorgenti !== daVersione.sorgenti)
  problemi.push(`sorgenti: build.json «${bj.sorgenti}» ≠ js/versione.js «${daVersione.sorgenti}»`);
if (bj.sorgenti !== daHtml.sorgenti)
  problemi.push(`sorgenti: build.json «${bj.sorgenti}» ≠ index.html «${daHtml.sorgenti}»`);
if (bj.cache !== daVersione.cache)
  problemi.push(`cache: build.json «${bj.cache}» ≠ js/versione.js «${daVersione.cache}»`);
if (bj.cache !== daSw.cache)
  problemi.push(`cache: build.json «${bj.cache}» ≠ sw.js VERSIONE «${daSw.cache}»`);
if (bj.cache !== daHtml.cache)
  problemi.push(`cache: build.json «${bj.cache}» ≠ index.html «${daHtml.cache}»`);
if (bj.schema !== daVersione.schema)
  problemi.push(`schema: build.json ${bj.schema} ≠ js/versione.js ${daVersione.schema}`);
if (bj.schema !== daHtml.schema)
  problemi.push(`schema: build.json ${bj.schema} ≠ index.html ${daHtml.schema}`);

/* lo schema deve coincidere col sorgente, non solo con se stesso */
const mig = leggi('js/migrations.js');
const schemaSorgente = Number((/var SCHEMA_ATTUALE = (\d+)/.exec(mig) || [])[1]);
if (bj.schema !== schemaSorgente)
  problemi.push(`schema: build.json ${bj.schema} ≠ SCHEMA_ATTUALE ${schemaSorgente} in js/migrations.js`);

/* la cache deve derivare dall'impronta: se non lo fa, una delle due è
   stata scritta a mano */
if (bj.cache !== 'pt-' + String(bj.sorgenti).slice(0, 8))
  problemi.push(`cache «${bj.cache}» non deriva da sorgenti «${bj.sorgenti}»`);

/* ─── 2. ORDINE.txt, index.html e sw.js devono contenere gli stessi moduli ─── */
const ordine = leggi('js/ORDINE.txt').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const inHtml = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const inSw = [...sw.matchAll(/'\.\/(js\/[^']+)'/g)].map(m => m[1]);

const mancantiHtml = ordine.filter(f => !inHtml.includes(f));
const mancantiSw = ordine.filter(f => !inSw.includes(f));
const inPiuHtml = inHtml.filter(f => f.startsWith('js/') && !ordine.includes(f));

if (mancantiHtml.length)
  problemi.push('moduli in ORDINE.txt ma non caricati da index.html: ' + mancantiHtml.join(', '));
if (mancantiSw.length)
  problemi.push('moduli in ORDINE.txt ma non in cache da sw.js (si romperebbero offline): ' + mancantiSw.join(', '));
if (inPiuHtml.length)
  problemi.push('moduli caricati da index.html ma assenti da ORDINE.txt: ' + inPiuHtml.join(', '));

/* l'ORDINE conta: i moduli condividono lo scope globale e alcuni dipendono
   da quelli precedenti */
const ordineHtml = inHtml.filter(f => ordine.includes(f));
if (ordineHtml.join('|') !== ordine.join('|'))
  problemi.push('l\'ordine dei moduli in index.html non coincide con ORDINE.txt');

/* ─── 3. i CSS ─── */
const cssOrdine = leggi('css/ORDINE.txt').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const cssHtml = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
const cssSw = [...sw.matchAll(/'\.\/(css\/[^']+)'/g)].map(m => m[1]);
const cssMancantiSw = cssOrdine.filter(f => !cssSw.includes(f));
if (cssMancantiSw.length)
  problemi.push('fogli di stile non in cache da sw.js: ' + cssMancantiSw.join(', '));
if (cssHtml.join('|') !== cssOrdine.join('|'))
  problemi.push('l\'ordine dei fogli di stile in index.html non coincide con css/ORDINE.txt');

/* ─── esito ─── */
if (problemi.length) {
  console.error('IMPRONTA O ELENCO DEI MODULI INCOERENTI:\n');
  problemi.forEach(p => console.error('  - ' + p));
  console.error('\nRieseguire:  node strumenti/build.mjs');
  process.exit(1);
}

console.log('impronta coerente nei quattro punti: ' + bj.sorgenti);
console.log('cache: ' + bj.cache + '   schema: ' + bj.schema);
console.log('moduli allineati: ' + ordine.length + ' js, ' + cssOrdine.length + ' css');
process.exit(0);
