#!/usr/bin/env node
/* strumenti/genera-config-firebase.mjs
 *
 * Genera js/config-firebase.js dalle variabili d'ambiente.
 *
 * Perché esiste: cambiare ambiente non deve richiedere di modificare un
 * sorgente a mano. Modificare a mano significa: dimenticarsi di rimettere
 * il valore giusto, committare per sbaglio la configurazione di produzione,
 * e non poter dire con certezza quale progetto sta usando una build.
 *
 * Nel repository resta la versione «non-configurato»: la configurazione
 * vera viene generata durante il deploy, dai segreti dell'ambiente, e non
 * entra mai nella cronologia di git. Vedi FIREBASE-SETUP.md §Deploy.
 *
 * Uso:
 *   node strumenti/genera-config-firebase.mjs --ambiente produzione
 *   node strumenti/genera-config-firebase.mjs --ambiente emulatore
 *   node strumenti/genera-config-firebase.mjs --ambiente non-configurato
 *
 * Variabili lette (nessuna è un segreto, vedi sotto):
 *   PT_FIREBASE_API_KEY
 *   PT_FIREBASE_AUTH_DOMAIN
 *   PT_FIREBASE_PROJECT_ID
 *   PT_FIREBASE_APP_ID
 *   PT_APPCHECK_SITE_KEY        (facoltativa: vuota = App Check non attivo)
 *   PT_EMULATORE_AUTH           (solo ambiente «emulatore»)
 *   PT_EMULATORE_FIRESTORE      (solo ambiente «emulatore»)
 *
 * NON legge, e rifiuta se le trova valorizzate:
 *   qualunque variabile che contenga SECRET, PRIVATE_KEY, SERVICE_ACCOUNT,
 *   CLIENT_SECRET, PASSWORD o TOKEN. Non servono a un'applicazione che gira
 *   nel browser, e trovarle qui significa che qualcuno sta per pubblicarle.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const USCITA = join(RADICE, 'js', 'config-firebase.js');

const AMBIENTI = ['produzione', 'staging', 'sviluppo', 'emulatore', 'non-configurato'];

/* ---------- argomenti ---------- */
const argomenti = process.argv.slice(2);
let ambiente = 'non-configurato';
for (let i = 0; i < argomenti.length; i++) {
  if (argomenti[i] === '--ambiente') ambiente = argomenti[i + 1] || '';
}
if (!AMBIENTI.includes(ambiente)) {
  console.error('Ambiente non riconosciuto: «' + ambiente + '».');
  console.error('Ammessi: ' + AMBIENTI.join(', '));
  process.exit(2);
}

/* ---------- guardia contro i segreti ----------
   Non è paranoia: il modo più comune di pubblicare una chiave privata è
   passarla a uno script che si aspettava una chiave pubblica. */
const PERICOLOSE = /SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|CLIENT_SECRET|PASSWORD|(^|_)TOKEN($|_)/i;
const trovate = Object.keys(process.env)
  .filter(k => k.startsWith('PT_') && PERICOLOSE.test(k) && String(process.env[k] || '').trim() !== '');
if (trovate.length) {
  console.error('INTERROTTO: variabili che sembrano contenere segreti sono valorizzate:');
  trovate.forEach(k => console.error('  - ' + k));
  console.error('La configurazione pubblica di una web app non ne ha bisogno.');
  console.error('Se ti servono per altro, non passarle a questo script.');
  process.exit(3);
}

/* ---------- valori ---------- */
const v = (nome) => String(process.env[nome] || '').trim();

const cfg = {
  ambiente,
  apiKey:     v('PT_FIREBASE_API_KEY'),
  authDomain: v('PT_FIREBASE_AUTH_DOMAIN'),
  projectId:  v('PT_FIREBASE_PROJECT_ID'),
  appId:      v('PT_FIREBASE_APP_ID'),
  appCheckSiteKey: v('PT_APPCHECK_SITE_KEY'),
  emulatore: {
    auth:      v('PT_EMULATORE_AUTH')      || 'http://127.0.0.1:9099',
    firestore: v('PT_EMULATORE_FIRESTORE') || 'http://127.0.0.1:8080'
  }
};

/* ---------- controlli di coerenza ---------- */
const problemi = [];

if (ambiente !== 'non-configurato' && ambiente !== 'emulatore') {
  if (!cfg.apiKey)    problemi.push('PT_FIREBASE_API_KEY è vuota');
  if (!cfg.projectId) problemi.push('PT_FIREBASE_PROJECT_ID è vuoto');
  if (cfg.apiKey && /\s/.test(cfg.apiKey)) problemi.push('PT_FIREBASE_API_KEY contiene spazi');
  if (cfg.projectId && !/^[a-z0-9-]+$/.test(cfg.projectId))
    problemi.push('PT_FIREBASE_PROJECT_ID ammette solo minuscole, cifre e trattini');
}
/* Una chiave che comincia per AIza è una chiave web Google: se manca il
   prefisso, con ogni probabilità è stato incollato qualcos'altro. */
if (cfg.apiKey && !cfg.apiKey.startsWith('AIza'))
  problemi.push('PT_FIREBASE_API_KEY non comincia per «AIza»: è davvero la chiave web dell\'app?');
/* Un debug token di App Check non deve MAI finire in una build pubblica. */
if (ambiente === 'produzione' && v('PT_APPCHECK_DEBUG_TOKEN'))
  problemi.push('PT_APPCHECK_DEBUG_TOKEN è valorizzata in produzione: i debug token valgono solo in sviluppo');

if (problemi.length) {
  console.error('INTERROTTO: configurazione incoerente per l\'ambiente «' + ambiente + '»:');
  problemi.forEach(p => console.error('  - ' + p));
  process.exit(4);
}

/* ---------- scrittura ----------
   Il file generato conserva il commento di testa dell'originale: spiega
   perché non contiene segreti, e va letto da chi lo apre. */
const originale = readFileSync(USCITA, 'utf8');
const testa = originale.split('var FIREBASE_CONFIG')[0];
const coda  = originale.slice(originale.indexOf('/* ---------- interrogazioni ---------- */'));

if (!testa || !coda) {
  console.error('INTERROTTO: js/config-firebase.js non ha la forma attesa.');
  console.error('Il generatore sostituisce solo il blocco FIREBASE_CONFIG e lascia il resto.');
  process.exit(5);
}

const blocco =
`var FIREBASE_CONFIG = {
  /* GENERATO da strumenti/genera-config-firebase.mjs — non modificare a mano.
     Ambiente: ${ambiente}
     Generato: ${new Date().toISOString()} */
  ambiente: ${JSON.stringify(cfg.ambiente)},

  apiKey:     ${JSON.stringify(cfg.apiKey)},
  authDomain: ${JSON.stringify(cfg.authDomain)},
  projectId:  ${JSON.stringify(cfg.projectId)},
  appId:      ${JSON.stringify(cfg.appId)},

  appCheckSiteKey: ${JSON.stringify(cfg.appCheckSiteKey)},

  emulatore: {
    auth:      ${JSON.stringify(cfg.emulatore.auth)},
    firestore: ${JSON.stringify(cfg.emulatore.firestore)}
  }
};

`;

writeFileSync(USCITA, testa + blocco + coda, 'utf8');

console.log('js/config-firebase.js generato.');
console.log('  ambiente:  ' + cfg.ambiente);
console.log('  progetto:  ' + (cfg.projectId || '(nessuno)'));
console.log('  chiave:    ' + (cfg.apiKey ? cfg.apiKey.slice(0, 8) + '… (' + cfg.apiKey.length + ' caratteri)' : '(nessuna)'));
console.log('  App Check: ' + (cfg.appCheckSiteKey ? 'attivo' : 'non attivo'));
if (ambiente === 'non-configurato')
  console.log('\n  Con questo ambiente l\'Account Pannello Tempo risulta NON DISPONIBILE,\n' +
              '  e il pannello lo dichiara all\'utente invece di offrire pulsanti che falliscono.');
