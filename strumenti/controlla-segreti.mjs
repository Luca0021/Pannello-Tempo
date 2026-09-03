#!/usr/bin/env node
/* strumenti/controlla-segreti.mjs
 *
 * Cerca segreti in TUTTI i file versionati e fa fallire la pipeline se ne
 * trova uno. Gira prima di ogni altro passo: se un segreto è entrato nel
 * repository, tutto il resto è secondario.
 *
 * Cerca le STRINGHE, non i nomi dei campi: un segreto messo in una
 * costante chiamata `x` non ha un nome che lo tradisca.
 *
 * Uso:  node strumenti/controlla-segreti.mjs
 * Esce con 1 se trova qualcosa, 0 se l'albero è pulito.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep, extname } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');

const SALTA_CARTELLE = new Set(['.git', 'node_modules', 'playwright-report',
  'test-results', '.firebase', '.claude']);
const SALTA_ESTENSIONI = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico',
  '.woff', '.woff2', '.ttf', '.pdf', '.zip', '.webp']);

/* I modelli. Ognuno ha un nome che spiega che cosa è, perché un elenco di
   espressioni regolari senza nomi non si mantiene. */
const MODELLI = [
  { nome: 'token GitHub',          re: /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}/ },
  { nome: 'chiave API Google',     re: /AIza[0-9A-Za-z_\-]{30,}/ },
  { nome: 'private key',           re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nome: 'service account',       re: /"type"\s*:\s*"service_account"/ },
  { nome: 'JWT',                   re: /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/ },
  { nome: 'client secret OAuth',   re: /"client_secret"\s*:\s*"[^"]{10,}"/ },
  { nome: 'refresh token',         re: /"refresh(_?[Tt]oken)?"\s*:\s*"[A-Za-z0-9_\-.]{20,}"/ },
  { nome: 'password assegnata',    re: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{6,}["']/i },
  { nome: 'token AWS',             re: /AKIA[0-9A-Z]{16}/ },
  { nome: 'token Slack',           re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { nome: 'stringa di connessione', re: /(mongodb|postgres|mysql):\/\/[^\s"']*:[^\s"'@]+@/ }
];

/* Eccezioni dichiarate, con il motivo.
   Un'eccezione senza motivo diventa un buco permanente. */
const AMMESSI = [
  { file: /^\.env\.example$/, re: /AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/,
    motivo: 'segnaposto nel file di esempio, evidentemente finto' },
  { file: /^tests\//, re: /SENTINELLA|ghp_S{20,}|AIzaS{30,}|eyJhbGciOiJIUzI1NiJ9/,
    motivo: 'valori sentinella dei collaudi, riconoscibili e finti' },
  { file: /^tests\//, re: /ghp_b{20,}|ghp_z{20,}|ghp_c{20,}|ghp_q{20,}|github_pat_b{20,}/,
    motivo: 'token finti dei collaudi, composti da un carattere ripetuto' },
  { file: /^(SECURITY-REPORT|SYNC-DECISION|GIST-MIGRATION)\.md$/,
    re: /ghp_TOKEN_DI_PROVA|REFRESH_DI_PROVA|IDTOKEN_DI_PROVA|ghp_S{20,}/,
    motivo: 'valori di prova citati nella documentazione come prova eseguita' },
  { file: /^FIREBASE-SETUP\.md$/, re: /AIzaSy…|AIza…/,
    motivo: 'segnaposto troncato nella procedura' }
];

function ammesso(rel, testo, modello) {
  return AMMESSI.some(a => a.file.test(rel) && a.re.test(testo) && modello);
}

function elenca(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    if (SALTA_CARTELLE.has(nome)) continue;
    const pieno = join(dir, nome);
    if (statSync(pieno).isDirectory()) elenca(pieno, out);
    else if (!SALTA_ESTENSIONI.has(extname(nome).toLowerCase())) out.push(pieno);
  }
  return out;
}

const trovati = [];
for (const pieno of elenca(RADICE)) {
  const rel = relative(RADICE, pieno).split(sep).join('/');
  let testo;
  try { testo = readFileSync(pieno, 'utf8'); } catch { continue; }
  for (const m of MODELLI) {
    const trovato = m.re.exec(testo);
    if (!trovato) continue;
    if (ammesso(rel, trovato[0], m)) continue;
    const riga = testo.slice(0, trovato.index).split('\n').length;
    trovati.push({ file: rel, riga, tipo: m.nome,
                   /* si mostra solo il PRINCIPIO, mai il valore intero */
                   anteprima: trovato[0].slice(0, 12) + '…' });
  }
}

if (trovati.length) {
  console.error('SEGRETI TROVATI NELL\'ALBERO VERSIONATO:\n');
  for (const t of trovati)
    console.error(`  ${t.file}:${t.riga}  ${t.tipo}  (${t.anteprima})`);
  console.error('\nRimuoverli dal file NON basta: restano nella cronologia di git.');
  console.error('Vanno revocati sul servizio che li ha emessi, e poi rimossi dalla cronologia.');
  process.exit(1);
}

console.log('nessun segreto trovato.');
console.log('  modelli cercati: ' + MODELLI.length);
console.log('  file esaminati:  ' + elenca(RADICE).length);
process.exit(0);
