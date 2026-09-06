#!/usr/bin/env node
/* strumenti/stato-regressione-visiva.mjs
 *
 * Conta quante comparazioni visive sono state ESEGUITE e quante SALTATE per
 * mancanza di un riferimento approvato, e lo scrive nel riepilogo della
 * pipeline.
 *
 * Perché esiste: da quando il confronto visivo viene saltato invece di
 * fallire (vedi tests/ui/ui006.spec.js), la pipeline può essere verde con
 * ZERO copertura visiva. È il comportamento giusto — un riferimento non
 * approvato non dimostra niente — ma diventa pericoloso nel momento in cui
 * nessuno lo dice più. «Verde» non deve poter significare «non ho
 * guardato».
 *
 * Non fa fallire nulla: riporta. L'unica cosa che fa fallire la pipeline è
 * una prova rossa.
 *
 * Uso:  node strumenti/stato-regressione-visiva.mjs [percorso-esito.json]
 */

import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const FILE = process.argv[2] || 'test-results/esito.json';

if (!existsSync(FILE)) {
  console.log('nessun rapporto in ' + FILE + ': i collaudi in browser non hanno prodotto JSON.');
  console.log('(in locale il reporter JSON non è attivo — è previsto)');
  process.exit(0);
}

let rapporto;
try { rapporto = JSON.parse(readFileSync(FILE, 'utf8')); }
catch (e) { console.log('rapporto illeggibile: ' + e.message); process.exit(0); }

/* Il JSON di Playwright è annidato: suite → suites → specs → tests → results.
   Le annotazioni stanno sui test. */
const saltate = [];
let conScatto = 0, prove = 0;

function scendi(suite) {
  for (const s of suite.suites || []) scendi(s);
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      prove++;
      const ann = [...(t.annotations || []),
                   ...((t.results || []).flatMap(r => r.annotations || []))];
      const s = ann.find(a => a.type === 'regressione-visiva-saltata');
      if (s) saltate.push({ titolo: spec.title, progetto: t.projectName || '?', perche: s.description });
      else if (/ui006/i.test(spec.file || suite.file || '')) conScatto++;
    }
  }
}
for (const s of rapporto.suites || []) scendi(s);

const righe = [];
righe.push('### Regressione visiva');
righe.push('');
if (!saltate.length) {
  righe.push('Tutte le comparazioni visive sono state **eseguite** contro riferimenti approvati.');
} else {
  righe.push('**' + saltate.length + ' comparazioni visive SALTATE**: nessun riferimento approvato.');
  righe.push('');
  righe.push('Le asserzioni strutturali di quelle prove sono state eseguite e sono verdi.');
  righe.push('Il confronto visivo no: un riferimento non approvato non dimostra che');
  righe.push('l\'aspetto sia giusto, dimostra com\'era in quel momento.');
  righe.push('');
  righe.push('| Prova | Browser |');
  righe.push('|---|---|');
  for (const s of saltate.slice(0, 40)) righe.push('| ' + s.titolo + ' | ' + s.progetto + ' |');
  if (saltate.length > 40) righe.push('| … e altre ' + (saltate.length - 40) + ' | |');
  righe.push('');
  righe.push('Per approvarli: `npm run test:visivi:approva`, **guardare** gli scatti, e');
  righe.push('committarli. Finché non succede, **TST-006 e UI-006 restano PARZIALE**, e');
  righe.push('questa pipeline verde non copre l\'aspetto dell\'interfaccia.');
}

const testo = righe.join('\n');
console.log(testo);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + testo + '\n');
}
process.exit(0);
