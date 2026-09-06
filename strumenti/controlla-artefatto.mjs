#!/usr/bin/env node
/* strumenti/controlla-artefatto.mjs
 *
 * Controlla la cartella che sta per essere PUBBLICATA, non il repository.
 *
 * Perché è un controllo diverso da `controlla-segreti.mjs`: quello chiede a
 * git che cosa è versionato, e per un artefatto la domanda non ha senso —
 * l'artefatto contiene un `js/config-firebase.js` GENERATO, che in git non
 * c'è e non deve esserci. Serve un controllo che guardi i file per quello
 * che sono, sul disco, subito prima che diventino pubblici.
 *
 * Che cosa verifica:
 *   - nessun file d'ambiente (.env e simili) è finito nell'artefatto;
 *   - nessun debug token di App Check;
 *   - nessuna chiave privata né service account;
 *   - nessuna cartella di sviluppo (tests, strumenti, node_modules, firebase);
 *   - `js/config-firebase.js` dichiara l'ambiente ATTESO, non un altro.
 *
 * Che cosa NON stampa: nessun valore. Solo nomi di file, lunghezze e
 * booleani. Un controllo che per dimostrare la propria diligenza stampa la
 * chiave nei registri della pipeline è peggio del problema che risolve.
 *
 * Uso:
 *   node strumenti/controlla-artefatto.mjs <cartella> --ambiente <atteso>
 *
 * Esce con 1 se qualcosa non va, 0 se l'artefatto è pubblicabile.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, extname } from 'node:path';

const argomenti = process.argv.slice(2);
const CARTELLA = argomenti.find(a => !a.startsWith('--'));
const iAmb = argomenti.indexOf('--ambiente');
const AMBIENTE_ATTESO = iAmb >= 0 ? argomenti[iAmb + 1] : null;

if (!CARTELLA) {
  console.error('uso: node strumenti/controlla-artefatto.mjs <cartella> --ambiente <atteso>');
  process.exit(2);
}

const SALTA_ESTENSIONI = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico',
  '.woff', '.woff2', '.ttf', '.pdf', '.zip', '.webp']);

function elenca(dir, base = dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const pieno = join(dir, nome);
    if (statSync(pieno).isDirectory()) elenca(pieno, base, out);
    else out.push(relative(base, pieno).split(sep).join('/'));
  }
  return out;
}

const file = elenca(CARTELLA);
const problemi = [];

/* ─── 1. file che non devono esserci ─────────────────────────────────────── */
const VIETATI = [
  { re: /(^|\/)\.env($|\.)/,       perche: 'file d\'ambiente' },
  { re: /^tests\//,                perche: 'collaudi' },
  { re: /^strumenti\//,            perche: 'strumenti di sviluppo' },
  { re: /^node_modules\//,         perche: 'dipendenze di sviluppo' },
  { re: /^firebase\//,             perche: 'configurazione e regole Firebase' },
  { re: /^package(-lock)?\.json$/, perche: 'manifesto di sviluppo' },
  { re: /^playwright\.config\./,   perche: 'configurazione dei collaudi' },
  { re: /^backlog\.json$/,         perche: 'stato interno dei ticket' },
  { re: /^_collaudo\.js$/,         perche: 'strumento di misura' }
];
for (const f of file)
  for (const v of VIETATI)
    if (v.re.test(f)) problemi.push('presente ' + f + ' (' + v.perche + ')');

/* ─── 2. stringhe che non devono comparire ───────────────────────────────── */
const MODELLI = [
  /* Serve un'ASSEGNAZIONE con un valore, non la semplice menzione del nome.
     La prima versione cercava l'identificatore e basta, e segnalava
     js/appcheck.js:102 — che è la DIFESA: rifiuta una build di produzione in
     cui un debug token sia presente. Un controllo che accusa la guardia di
     essere il ladro viene disattivato al primo incontro con la realtà.

     Un debug token vero è un UUID: gli otto caratteri minimi bastano a
     distinguerlo da `= ""`, `= false` o da un `typeof … !== "undefined"`. */
  { nome: 'debug token di App Check valorizzato',
    re: /(FIREBASE_APPCHECK_DEBUG_TOKEN|PT_APPCHECK_DEBUG_TOKEN|appCheckDebugToken)\s*[:=]\s*["'][^"']{8,}["']/ },
  { nome: 'chiave privata',           re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nome: 'service account',          re: /"type"\s*:\s*"service_account"/ },
  { nome: 'client secret OAuth',      re: /"client_secret"\s*:\s*"[^"]{10,}"/ },
  { nome: 'token GitHub',             re: /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}/ }
];
let esaminati = 0;
for (const f of file) {
  if (SALTA_ESTENSIONI.has(extname(f).toLowerCase())) continue;
  let t;
  try { t = readFileSync(join(CARTELLA, f), 'utf8'); } catch { continue; }
  esaminati++;
  for (const m of MODELLI)
    if (m.re.test(t)) problemi.push(m.nome + ' in ' + f);
}

/* ─── 3. la configurazione è quella attesa ───────────────────────────────── */
let riepilogoConfig = null;
const percorsoConfig = join(CARTELLA, 'js', 'config-firebase.js');
try {
  const t = readFileSync(percorsoConfig, 'utf8');
  const leggi = (campo) => { const m = new RegExp(campo + ':\\s*"([^"]*)"').exec(t); return m ? m[1] : null; };
  const ambiente = leggi('ambiente');
  const apiKey = leggi('apiKey');
  const projectId = leggi('projectId');
  const appId = leggi('appId');
  const siteKey = leggi('appCheckSiteKey');
  riepilogoConfig = {
    ambiente,
    /* mai il valore: solo se c'è e quanto è lungo */
    apiKey: apiKey ? 'presente (' + apiKey.length + ' caratteri)' : 'vuota',
    projectId: projectId ? 'presente' : 'vuoto',
    appId: appId ? 'presente' : 'vuoto',
    appCheckSiteKey: siteKey ? 'presente' : 'vuota'
  };
  if (AMBIENTE_ATTESO && ambiente !== AMBIENTE_ATTESO)
    problemi.push('ambiente «' + ambiente + '», atteso «' + AMBIENTE_ATTESO + '»');
  /* Coerenza: dichiararsi in produzione senza configurazione è peggio che
     dichiararsi non configurato, perché il pannello offre pulsanti che
     falliscono invece di dire che l'account non c'è. */
  if (ambiente === 'produzione' && !(apiKey && projectId))
    problemi.push('ambiente «produzione» ma apiKey o projectId sono vuoti: '
      + 'il pannello offrirebbe un account che non può funzionare');
  if (ambiente === 'non-configurato' && (apiKey || projectId))
    problemi.push('ambiente «non-configurato» ma la configurazione è valorizzata: '
      + 'i due dati si contraddicono');
} catch (e) {
  problemi.push('js/config-firebase.js non leggibile nell\'artefatto: ' + e.message);
}

/* ─── esito ──────────────────────────────────────────────────────────────── */
console.log('artefatto: ' + CARTELLA);
console.log('  file totali:     ' + file.length);
console.log('  file di testo esaminati: ' + esaminati);
if (riepilogoConfig) {
  console.log('  configurazione Firebase nell\'artefatto:');
  for (const [k, v] of Object.entries(riepilogoConfig)) console.log('    ' + k.padEnd(16) + v);
}

if (problemi.length) {
  console.error('\nARTEFATTO NON PUBBLICABILE — ' + problemi.length + ' problemi:');
  for (const p of problemi) console.error('  - ' + p);
  process.exit(1);
}
console.log('\nartefatto pubblicabile: nessun file di sviluppo, nessun segreto, ambiente coerente.');
process.exit(0);
