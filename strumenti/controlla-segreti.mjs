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
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep, extname, resolve } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ─────────────────────────────────────────────────────────────────────────
   CHE COSA VUOL DIRE «VERSIONATO» — DIFETTO CORRETTO
   ─────────────────────────────────────────────────────────────────────────

   Questo strumento annunciava «SEGRETI TROVATI NELL'ALBERO VERSIONATO» ma
   camminava sul FILESYSTEM con un elenco di cartelle da saltare scritto a
   mano, senza chiedere niente a git. Un file ignorato da .gitignore veniva
   trattato come se fosse committato.

   La conseguenza non era teorica. `.env.example` dice, alla terza riga:
   «Copia questo file in `.env` e compilalo con i valori del TUO progetto».
   Chi seguiva l'istruzione si trovava il PRIMO passo di `npm run verifica`
   rosso, con due danni:

     1. la pipeline si fermava su una configurazione corretta, e la via
        d'uscita più comoda era aggiungere `.env` alle eccezioni o mettere
        `|| true` sul comando — entrambe peggiori del problema;

     2. il consiglio stampato era SBAGLIATO e allarmante: «Vanno revocati
        sul servizio che li ha emessi, e poi rimossi dalla cronologia», per
        un file che nella cronologia non è mai entrato. Qualcuno avrebbe
        revocato una chiave senza motivo e cercato a lungo qualcosa che non
        c'era.

   Ora l'insieme dei file da controllare lo dichiara git:

       git ls-files --cached --others --exclude-standard

   cioè ciò che è già versionato PIÙ ciò che entrerebbe al prossimo commit.
   È esattamente la domanda a cui lo strumento vuole rispondere.

   I file ignorati non vengono buttati via: vengono guardati comunque e
   riportati a parte, senza far fallire nulla. Un segreto in un `.env`
   locale è normale e va detto in un tono normale.

   PRUDENZA. Se git non c'è, o se questa cartella non è la radice del
   repository, l'insieme di git NON viene usato e si torna a esaminare
   tutto: meglio un falso allarme che un segreto non cercato. Il caso
   pericoloso da evitare è il silenzio — se i percorsi di git e quelli del
   filesystem non combaciassero, ogni file risulterebbe «ignorato» e lo
   strumento passerebbe senza aver controllato niente. */
function insiemeDiGit() {
  try {
    const cima = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { cwd: RADICE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!cima || resolve(cima) !== resolve(RADICE)) return null;
    const out = execFileSync('git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '--full-name', '-z'],
      { cwd: RADICE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const elenco = out.split('\0').filter(Boolean);
    return elenco.length ? new Set(elenco) : null;
  } catch {
    return null;
  }
}

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

/* Eccezioni dichiarate, con il motivo e con il modello a cui si applicano.
   Un'eccezione senza motivo diventa un buco permanente; un'eccezione senza
   modello vale per TUTTI i modelli, che è quasi sempre più di quanto serve.

   DIFETTO CORRETTO — un'eccezione non deve contenere il valore che ammette.
   La prima riga qui sotto diceva `/AIzaSyXXXX…/` con trentacinque X in
   chiaro, e trentacinque X soddisfano `AIza[0-9A-Za-z_\-]{30,}`: **questo
   file segnalava sé stesso**, il primo passo della pipeline falliva, e ogni
   passo successivo restava bloccato con una diagnosi incomprensibile —
   «chiave API Google in controlla-segreti.mjs». Ora l'eccezione descrive la
   FORMA del segnaposto (`AIzaSy` seguito da sole X) invece di riprodurlo, e
   la descrizione è troppo corta per far scattare il modello che descrive.

   Le altre eccezioni erano già al sicuro per costruzione: `ghp_S{20,}` e
   `AIzaS{30,}` contengono una sola lettera prima della graffa, e
   `eyJhbGciOiJIUzI1NiJ9` non ha i due punti che il modello del JWT esige.
   Verificato eseguendo i modelli su questo stesso albero. */
const AMMESSI = [
  { file: /^\.env\.example$/, modello: 'chiave API Google', re: /^AIzaSyX+$/,
    motivo: 'segnaposto del file di esempio: AIzaSy seguito da sole X' },
  { file: /^tests\//, modello: null,
    re: /SENTINELLA|ghp_S{20,}|AIzaS{30,}|eyJhbGciOiJIUzI1NiJ9/,
    motivo: 'valori sentinella dei collaudi, riconoscibili e finti. Devono esserci: servono a dimostrare che l\'audit dei segreti li trova davvero' },
  { file: /^tests\//, modello: 'token GitHub',
    re: /ghp_b{20,}|ghp_z{20,}|ghp_c{20,}|ghp_q{20,}|github_pat_b{20,}/,
    motivo: 'token finti dei collaudi, composti da un carattere ripetuto' },
  { file: /^(SECURITY-REPORT|SYNC-DECISION|GIST-MIGRATION|GLOBAL-COLLISIONS)\.md$/,
    modello: null,
    re: /ghp_TOKEN_DI_PROVA|REFRESH_DI_PROVA|IDTOKEN_DI_PROVA|ghp_S{20,}/,
    motivo: 'valori di prova citati nella documentazione come prova eseguita' },
  { file: /^FIREBASE-SETUP\.md$/, modello: 'chiave API Google', re: /AIzaSy…|AIza…/,
    motivo: 'segnaposto troncato nella procedura' }
];

/* `modello: null` vuol dire «per qualunque modello»; un nome vuol dire
   «solo per quel modello». Prima il terzo argomento veniva usato come
   `&& modello`, che è sempre vero: le eccezioni valevano per tutto. */
function ammesso(rel, testo, modello) {
  return AMMESSI.some(a =>
    a.file.test(rel) &&
    (a.modello === null || a.modello === modello.nome) &&
    a.re.test(testo));
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

const secondoGit = insiemeDiGit();
const tutti = elenca(RADICE);

const trovati = [];    /* nell'albero versionato: fanno fallire */
const ignorati = [];   /* fuori da git: si riportano, non fanno fallire */
let esaminati = 0, saltatiPerchéIgnorati = 0;

for (const pieno of tutti) {
  const rel = relative(RADICE, pieno).split(sep).join('/');
  const fuoriDaGit = secondoGit !== null && !secondoGit.has(rel);
  let testo;
  try { testo = readFileSync(pieno, 'utf8'); } catch { continue; }
  esaminati++;
  if (fuoriDaGit) saltatiPerchéIgnorati++;
  for (const m of MODELLI) {
    const trovato = m.re.exec(testo);
    if (!trovato) continue;
    if (ammesso(rel, trovato[0], m)) continue;
    const riga = testo.slice(0, trovato.index).split('\n').length;
    /* Dei file ignorati non si mostra nemmeno l'anteprima: non c'è niente
       da diagnosticare, e un valore in meno a schermo è un valore in meno
       che finisce in un registro della pipeline. */
    if (fuoriDaGit) ignorati.push({ file: rel, riga, tipo: m.nome });
    else trovati.push({ file: rel, riga, tipo: m.nome,
                        /* si mostra solo il PRINCIPIO, mai il valore intero */
                        anteprima: trovato[0].slice(0, 12) + '…' });
  }
}

if (trovati.length) {
  console.error('SEGRETI TROVATI NELL\'ALBERO VERSIONATO:\n');
  for (const t of trovati)
    console.error(`  ${t.file}:${t.riga}  ${t.tipo}  (${t.anteprima})`);
  console.error('\nQuesti file sono versionati, o entrerebbero al prossimo commit.');
  console.error('Rimuoverli dal file NON basta se sono già stati committati: restano');
  console.error('nella cronologia di git. Vanno revocati sul servizio che li ha');
  console.error('emessi, e poi rimossi dalla cronologia.');
  process.exit(1);
}

console.log('nessun segreto nell\'albero versionato.');
console.log('  modelli cercati: ' + MODELLI.length);
console.log('  file esaminati:  ' + esaminati +
            (secondoGit === null ? '' : ' (' + (esaminati - saltatiPerchéIgnorati) + ' versionati, ' +
             saltatiPerchéIgnorati + ' ignorati da git)'));
if (secondoGit === null)
  console.log('  NOTA: l\'insieme dei file versionati non è stato ottenuto da git\n' +
              '        (git assente, o questa non è la radice del repository).\n' +
              '        Esaminato tutto quello che c\'è sul disco: può produrre\n' +
              '        falsi allarmi su file locali, ma non lascia buchi.');

if (ignorati.length) {
  /* Non è un fallimento. È il posto GIUSTO per una chiave di configurazione:
     `.env` esiste per questo, ed è escluso da git proprio perché ci finisca
     dentro. Dirlo comunque serve a due cose: confermare che il file è fuori
     dal repository, e accorgersi subito se un giorno smettesse di esserlo. */
  console.log('\n  Fuori dall\'albero versionato, e quindi non un problema:');
  for (const t of ignorati)
    console.log(`    ${t.file}:${t.riga}  ${t.tipo}  — ignorato da git, non verrà committato`);
  console.log('  Se uno di questi dovesse comparire nell\'elenco sopra, allora sì:');
  console.log('  vorrebbe dire che non è più ignorato.');
}
process.exit(0);
