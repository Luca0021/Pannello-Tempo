#!/usr/bin/env node
/* tests/runner.js — esegue i collaudi unitari e di integrazione.
 *
 * I moduli del pannello sono script che condividono lo scope globale, non
 * moduli ES: non si possono `require`. Il runner li carica in ordine dentro
 * un contesto con un DOM ridotto, che è lo stesso ambiente in cui girano
 * nel browser meno il disegno.
 *
 * Uso:
 *   node tests/runner.js                     tutto
 *   node tests/runner.js --solo unit         solo tests/unit/
 *   node tests/runner.js --solo integration  solo tests/integration/
 *
 * Codici d'uscita:
 *   0  tutte le prove superate
 *   1  almeno una fallita
 *   2  nessun collaudo trovato — che è un fallimento, non un successo:
 *      una cartella vuota non deve poter far passare la pipeline
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RADICE = path.resolve(__dirname, '..');
const argomenti = process.argv.slice(2);
const iSolo = argomenti.indexOf('--solo');
const solo = iSolo >= 0 ? argomenti[iSolo + 1] : null;

const CARTELLE = solo ? [solo] : ['unit', 'integration'];

let file = [];
for (const c of CARTELLE) {
  const dir = path.join(__dirname, c);
  if (!fs.existsSync(dir)) continue;
  for (const n of fs.readdirSync(dir))
    if (n.endsWith('.test.js')) file.push(path.join(dir, n));
}

if (!file.length) {
  console.error('Nessun collaudo trovato in: ' + CARTELLE.join(', '));
  console.error('Una cartella vuota non è un successo: se i collaudi sono stati');
  console.error('spostati, aggiorna il runner; se sono stati cancellati, dillo.');
  process.exit(2);
}

console.log('collaudi trovati: ' + file.length + '\n');

let falliti = 0;
const esiti = [];

for (const f of file) {
  const nome = path.relative(RADICE, f);
  console.log('── ' + nome);
  try {
    /* ogni collaudo in un processo suo: uno che sporca lo scope globale, o
       che chiama process.exit, non deve poter falsare gli altri */
    const out = execFileSync(process.execPath, [f], {
      cwd: RADICE, encoding: 'utf8', stdio: 'pipe',
      env: Object.assign({}, process.env, { PT_MODO_TEST: '1' })
    });
    process.stdout.write(out);
    esiti.push({ nome, esito: 'passato' });
  } catch (e) {
    const uscita = e.status;
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    if (uscita === 2) {
      /* 2 = SALTATO. Non è passato, e non è fallito: va detto come tale.
         Nella pipeline è un fallimento, perché in CI le dipendenze ci sono
         e «saltato» significa che qualcosa non va. */
      esiti.push({ nome, esito: 'SALTATO' });
      if (process.env.CI) { falliti++; console.log('   → saltato, e in CI è un fallimento'); }
      else console.log('   → saltato');
    } else {
      falliti++;
      esiti.push({ nome, esito: 'FALLITO' });
    }
  }
  console.log('');
}

console.log('─────────────────────────────');
for (const e of esiti) console.log('  ' + e.esito.padEnd(8) + ' ' + e.nome);
console.log('─────────────────────────────');
console.log((esiti.length - falliti) + ' su ' + esiti.length);

process.exit(falliti ? 1 : 0);
