#!/usr/bin/env node
/* strumenti/controlla-globali.mjs — cerca i nomi globali dichiarati da più
 * di un modulo.
 *
 * PERCHÉ ESISTE. I 60 moduli del pannello condividono un unico scope
 * globale (ARCHITECTURE.md §1). Se due file dichiarano `var X`, vince
 * l'ultimo caricato, e il primo perde il proprio valore **senza un solo
 * messaggio d'errore**: nessuna eccezione, nessun avviso, niente.
 *
 * Non è un'ipotesi. `js/sicurezza.js` dichiarava `var LIMITI` con i limiti
 * dell'importazione (8 MB per un backup, 5000 voci, 4 MB per un ICS, 500
 * eventi, 500 caratteri per un titolo) e `js/appcheck.js` dichiarava
 * `var LIMITI` con i limiti degli invii. `appcheck.js` si carica dopo,
 * quindi a runtime `LIMITI.backupByte` era `undefined`, e
 * `byte > undefined` è `false`: **tutti i limiti di importazione erano
 * disattivati**. Tre ticket di sicurezza risultavano coperti da controlli
 * che non scattavano mai. Si è visto solo eseguendoli.
 *
 * Questo strumento è la rete che mancava. Costa un secondo e copre una
 * classe interna di difetti che nessuna prova funzionale trova per caso.
 *
 * Uso:  node strumenti/controlla-globali.mjs
 * Esce con 1 se trova una collisione.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = p => readFileSync(join(RADICE, p), 'utf8');

const moduli = leggi('js/ORDINE.txt').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

/* Le dichiarazioni di primo livello sono quelle che cominciano a colonna 0:
   dentro una funzione il rientro c'è sempre, in questo codice. È una regola
   sintattica grossolana, e va bene così — un falso positivo si vede subito,
   un falso negativo sarebbe il difetto che stiamo cercando. */
const RX_VAR = /^var\s+([A-Za-z_$][\w$]*)/;
const RX_FUN = /^function\s+([A-Za-z_$][\w$]*)/;
const RX_LET = /^(?:let|const)\s+([A-Za-z_$][\w$]*)/;

/* Un nome dichiarato più volte NELLO STESSO file è un'altra cosa (e la
   segnaliamo a parte): qui interessa la collisione fra moduli diversi. */
const dove = new Map();      /* nome → [{ file, riga, tipo }] */
const doppioniInterni = [];

for (const m of moduli) {
  let testo;
  try { testo = leggi(m); } catch { continue; }
  const righe = testo.split(/\r?\n/);
  const vistiQui = new Map();
  righe.forEach((riga, i) => {
    let nome = null, tipo = null;
    let mm;
    if ((mm = RX_VAR.exec(riga))) { nome = mm[1]; tipo = 'var'; }
    else if ((mm = RX_FUN.exec(riga))) { nome = mm[1]; tipo = 'function'; }
    else if ((mm = RX_LET.exec(riga))) { nome = mm[1]; tipo = 'let/const'; }
    if (!nome) return;
    if (vistiQui.has(nome)) {
      doppioniInterni.push(`${m}: «${nome}» dichiarato a riga ${vistiQui.get(nome)} e ${i + 1}`);
      return;
    }
    vistiQui.set(nome, i + 1);
    if (!dove.has(nome)) dove.set(nome, []);
    dove.get(nome).push({ file: m, riga: i + 1, tipo });
  });
}

const collisioni = [];
for (const [nome, posti] of dove) {
  if (posti.length < 2) continue;
  collisioni.push({ nome, posti });
}

/* Ordine di gravità: `var` e `let/const` perdono il valore in silenzio, ed è
   il caso pericoloso. Due `function` con lo stesso nome sono comunque un
   difetto — una delle due non viene mai eseguita — ma almeno il
   comportamento resta quello di una funzione. */
function gravita(c) {
  return c.posti.some(p => p.tipo !== 'function') ? 0 : 1;
}
collisioni.sort((a, b) => gravita(a) - gravita(b) || a.nome.localeCompare(b.nome));

console.log('moduli esaminati: ' + moduli.length);
console.log('nomi globali di primo livello: ' + dove.size);

for (const d of doppioniInterni) console.log('DOPPIONE INTERNO  ' + d);

for (const c of collisioni) {
  const chi = c.posti.map(p => `${p.file}:${p.riga} (${p.tipo})`).join('  ·  ');
  const ultimo = c.posti[c.posti.length - 1];
  console.log('COLLISIONE  «' + c.nome + '»  ' + chi);
  console.log('            a runtime vince ' + ultimo.file + ', gli altri perdono il valore in silenzio');
}

if (collisioni.length || doppioniInterni.length) {
  console.log('');
  console.log('collisioni: ' + collisioni.length + '   doppioni interni: ' + doppioniInterni.length);
  console.log('Rinomina in modo che ogni nome dica di quale modulo è, per esempio');
  console.log('LIMITI_IMPORT e LIMITI_INVIO invece di due LIMITI. Rinominare ENTRAMBI');
  console.log('è meglio che rinominarne uno: un riferimento dimenticato diventa un');
  console.log('ReferenceError rumoroso invece di un `undefined` silenzioso.');
  process.exit(1);
}
console.log('globali: nessuna collisione.');
