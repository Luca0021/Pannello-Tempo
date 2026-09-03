/* appcheck.js — SEC-009: App Check e protezione dall'abuso.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PREDISPOSTO, NON ATTIVO. E la ragione non è la pigrizia.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * App Check con reCAPTCHA richiede di caricare uno script da
 * `https://www.google.com/recaptcha/api.js`. Farlo comporta tre cose che
 * vanno dette prima di considerarlo un miglioramento:
 *
 *   1. la Content Security Policy deve ammettere `script-src`,
 *      `frame-src` e `connect-src` verso Google. Oggi `script-src` è
 *      `'self'` e basta, ed è la difesa più forte che il pannello ha;
 *   2. si introduce il PRIMO script di terze parti. Il rapporto di
 *      sicurezza usa «nessuno script di terze parti» come mitigazione in
 *      due punti: quella frase andrebbe riscritta;
 *   3. reCAPTCHA raccoglie segnali sul dispositivo. L'informativa dichiara
 *      assenza di telemetria: andrebbe corretta anche quella.
 *
 * Contro un beneficio reale ma indiretto: App Check non protegge i dati di
 * nessuno — quello lo fanno Authentication e le Security Rules. Protegge la
 * QUOTA dall'uso automatizzato.
 *
 * Quindi: il percorso è scritto, la configurazione c'è, gli errori sono
 * gestiti, la documentazione spiega come attivarlo (FIREBASE-SETUP.md §10),
 * e `FIREBASE_CONFIG.appCheckSiteKey` è vuota. Con la chiave vuota il
 * pannello NON carica nulla da Google e lo dichiara nella schermata
 * Informazioni, invece di far credere che sia attivo.
 *
 * Attivarlo è una decisione di prodotto con un costo dichiarato, non un
 * interruttore da girare senza guardare.
 */

var APPCHECK = {
  stato: "non-attivo",     /* non-attivo | in-corso | attivo | errore */
  motivo: "",
  token: "",               /* SOLO in memoria, come ogni altro token */
  scadeA: 0
};

function appCheckAttivo(){
  return !!(FIREBASE_CONFIG.appCheckSiteKey && APPCHECK.stato === "attivo");
}
function appCheckPrevisto(){
  return !!FIREBASE_CONFIG.appCheckSiteKey;
}

/* Stato leggibile per la schermata Informazioni. Non dice «protetto»
   quando non lo è. */
function statoAppCheckLeggibile(){
  if (!appCheckPrevisto())
    return { attivo:false, testo:"Protezione dall'abuso non attiva",
             nota:"Questa installazione non usa App Check. I dati restano protetti "+
                  "dall'accesso con account e dalle regole del servizio; ciò che manca "+
                  "è la difesa della quota dall'uso automatizzato." };
  if (APPCHECK.stato === "errore")
    return { attivo:false, testo:"Protezione dall'abuso non disponibile",
             nota: APPCHECK.motivo || "Il controllo non ha risposto." };
  if (APPCHECK.stato === "attivo")
    return { attivo:true, testo:"Protezione dall'abuso attiva", nota:"" };
  return { attivo:false, testo:"Protezione dall'abuso in avvio", nota:"" };
}

/* Traduzione degli errori di App Check in qualcosa che si possa leggere.
   Un «403 App attestation failed» non dice a nessuno cosa fare. */
var ERRORI_APPCHECK = [
  ["app-check/fetch-status-error|appCheck/fetch",
   "Controllo non riuscito",
   "Il controllo che verifica da dove arriva la richiesta non ha risposto.",
   "Riprova fra qualche minuto. I tuoi dati su questo dispositivo non sono toccati."],
  ["App attestation failed|APP_CHECK_TOKEN_INVALID|Missing or invalid App Check",
   "Richiesta rifiutata dal servizio",
   "Il servizio non ha riconosciuto questa copia del pannello come autentica.",
   "Ricarica la pagina. Se succede di nuovo, potrebbe essere una versione vecchia rimasta in memoria: ricarica tenendo premuto Maiusc."],
  ["recaptcha|reCAPTCHA",
   "Controllo non caricato",
   "La verifica non è stata caricata: può dipendere da un blocco degli script o dall'assenza di rete.",
   "Il pannello continua a funzionare su questo dispositivo. Per sincronizzare serve che la verifica passi."]
];

function dettaglioAppCheck(e){
  var m = String((e && e.message) || e || "");
  for (var i = 0; i < ERRORI_APPCHECK.length; i++)
    if (new RegExp(ERRORI_APPCHECK[i][0], "i").test(m))
      return { titolo:ERRORI_APPCHECK[i][1], causa:ERRORI_APPCHECK[i][2],
               cosa:ERRORI_APPCHECK[i][3], tecnico:m.slice(0,200) };
  if (!Platform.rete.online())
    return { titolo:"Non in linea", causa:"Il controllo richiede la rete.",
             cosa:"Le modifiche restano sul dispositivo e partiranno da sole quando torna la rete.",
             tecnico:m.slice(0,200) };
  return { titolo:"Protezione dall'abuso non disponibile",
           causa:"Il controllo non ha risposto come previsto.",
           cosa:"Il pannello continua a funzionare in locale. Riprova più tardi.",
           tecnico:m.slice(0,200) };
}

/* L'avvio. Non fa nulla senza chiave: nessuna richiesta, nessuno script.
   Il debug token viene accettato SOLO fuori produzione, e la funzione lo
   verifica da sé invece di fidarsi di chi la chiama. */
function avviaAppCheck(){
  if (!appCheckPrevisto()) { APPCHECK.stato = "non-attivo"; return Promise.resolve(false); }
  if (inProduzione() && typeof PT_APPCHECK_DEBUG_TOKEN !== "undefined") {
    APPCHECK.stato = "errore";
    APPCHECK.motivo = "Un debug token è presente in una build di produzione: la protezione è stata disattivata di proposito.";
    return Promise.resolve(false);
  }
  APPCHECK.stato = "in-corso";
  /* Il caricamento vero di reCAPTCHA va qui. Resta da fare, e la CSP va
     estesa nello stesso momento in cui si scrive: attivarlo senza toccare
     la CSP produce uno script bloccato e una diagnosi confusa. */
  APPCHECK.stato = "errore";
  APPCHECK.motivo = "Il caricamento del controllo non è implementato in questa versione: "+
                    "vedi FIREBASE-SETUP.md §10 per le conseguenze dell'attivazione.";
  return Promise.resolve(false);
}

/* ─────────────────────────────────────────────────────────────────────────
   LIMITI, RIPETIZIONI E CICLI

   Questa parte non dipende da App Check ed è attiva.
   ───────────────────────────────────────────────────────────────────────── */

var LIMITI = {
  tentativiMax: 6,             /* oltre, si smette e si dice perché */
  attesaMinima: 5000,          /* 5 s */
  attesaMassima: 300000,       /* 5 min */
  dimensioneMax: 900000,       /* caratteri del payload, come le regole */
  vociMax: 5000,               /* voci in un dataset */
  minimoFraInvii: 3000,        /* due invii non possono susseguirsi più veloci */
  cicliSospetti: 5,            /* pull→push→pull ravvicinati oltre i quali si sospende */
  finestraCicli: 60000         /* la finestra in cui contarli */
};

var RITMO = {
  ultimoInvio: 0,
  ultimaLettura: 0,
  tentativi: 0,
  sospesoFinoA: 0,
  motivoSospensione: "",
  /* traccia degli scambi recenti, per riconoscere un ciclo */
  scambi: []
};

/* Attesa crescente. Raddoppia a ogni tentativo, con un tetto: senza tetto,
   dopo dieci errori l'attesa sarebbe di giorni. */
function attesaDopoErrore(tentativi){
  var a = LIMITI.attesaMinima * Math.pow(2, Math.min(6, Math.max(0, tentativi - 1)));
  return Math.min(LIMITI.attesaMassima, a);
}

/* Registra un errore e restituisce quanto aspettare. Oltre il massimo dei
   tentativi la sincronizzazione si sospende: continuare a provare contro un
   servizio che rifiuta consuma quota e batteria senza risolvere niente. */
function registraErroreSync(e){
  RITMO.tentativi++;
  var attesa = attesaDopoErrore(RITMO.tentativi);
  /* 429 e 503 arrivano con l'indicazione di quanto attendere: rispettarla
     è più utile della nostra stima. */
  var m = String((e && e.message) || e || "");
  if (/HTTP 429|RESOURCE_EXHAUSTED|Too Many Requests/i.test(m))
    attesa = Math.max(attesa, 60000);
  if (RITMO.tentativi >= LIMITI.tentativiMax) {
    RITMO.sospesoFinoA = Date.now() + LIMITI.attesaMassima;
    RITMO.motivoSospensione = "Dopo "+LIMITI.tentativiMax+" tentativi falliti la "+
      "sincronizzazione è sospesa per qualche minuto. I dati restano sul dispositivo.";
  }
  ATTESA_RIPROVA = Date.now() + attesa;
  return attesa;
}
function azzeraRitmo(){
  RITMO.tentativi = 0; RITMO.sospesoFinoA = 0; RITMO.motivoSospensione = "";
  ATTESA_RIPROVA = 0;
}

/* Può partire un invio adesso? Tre ragioni per dire no, tutte dichiarate. */
function puoInviare(){
  var ora = Date.now();
  if (RITMO.sospesoFinoA && ora < RITMO.sospesoFinoA)
    return { ok:false, motivo: RITMO.motivoSospensione };
  if (ATTESA_RIPROVA && ora < ATTESA_RIPROVA)
    return { ok:false, motivo:"Nuovo tentativo fra "+
             Math.ceil((ATTESA_RIPROVA - ora)/1000)+" secondi." };
  /* deduplicazione temporale: due invii non possono susseguirsi più veloci
     del minimo. Senza, una raffica di modifiche produce una raffica di
     scritture identiche. */
  if (RITMO.ultimoInvio && ora - RITMO.ultimoInvio < LIMITI.minimoFraInvii)
    return { ok:false, motivo:"Invio già partito da poco: le modifiche vengono accorpate." };
  return { ok:true };
}

/* Riconoscimento di un ciclo pull→push→pull.
   Un ciclo si presenta quando ogni lettura produce una scrittura che produce
   un'altra lettura: il pannello e il servizio si rimbalzano lo stesso dato.
   Consuma quota senza convergere, e l'utente non se ne accorge. */
function registraScambio(tipo){
  var ora = Date.now();
  RITMO.scambi.push({ tipo: tipo, quando: ora });
  RITMO.scambi = RITMO.scambi.filter(function(s){ return ora - s.quando < LIMITI.finestraCicli; });
  if (tipo === "invio") RITMO.ultimoInvio = ora;
  if (tipo === "lettura") RITMO.ultimaLettura = ora;
  var alternanze = 0;
  for (var i = 1; i < RITMO.scambi.length; i++)
    if (RITMO.scambi[i].tipo !== RITMO.scambi[i-1].tipo) alternanze++;
  if (alternanze >= LIMITI.cicliSospetti * 2) {
    RITMO.sospesoFinoA = ora + LIMITI.attesaMassima;
    RITMO.motivoSospensione = "La sincronizzazione si ripeteva senza concludere e "+
      "l'ho sospesa. I dati sono al sicuro sul dispositivo. Riprova fra qualche minuto, "+
      "oppure scollega e ricollega l'account.";
    RITMO.scambi = [];
    return { ciclo:true, motivo: RITMO.motivoSospensione };
  }
  return { ciclo:false };
}

/* Il dataset è troppo grande per essere sincronizzato?
   Controllato prima di serializzare, così il messaggio parla di voci e non
   di caratteri: «hai 6000 attività» si capisce, «947 231 caratteri» no. */
function datasetTroppoGrande(dati){
  var d = dati || S.data;
  var voci = (d.items || []).length + (d.capture || []).length;
  if (voci > LIMITI.vociMax)
    return { troppo:true, motivo:"Ci sono "+voci+" voci fra attività e note, e il limite "+
             "per una sincronizzazione è "+LIMITI.vociMax+". Archivia ciò che non ti serve "+
             "più, oppure cancella la cronologia dal Centro privacy." };
  var dim = 0;
  try { dim = JSON.stringify(d).length; } catch (e) { dim = 0; }
  if (dim >= LIMITI.dimensioneMax)
    return { troppo:true, motivo:"L'insieme dei dati supera il limite di un singolo "+
             "documento del servizio. Archivia le voci che non ti servono più, oppure "+
             "cancella la cronologia dal Centro privacy." };
  return { troppo:false, voci: voci, dimensione: dim };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { APPCHECK: APPCHECK, LIMITI: LIMITI, RITMO: RITMO,
    attesaDopoErrore: attesaDopoErrore, registraErroreSync: registraErroreSync,
    azzeraRitmo: azzeraRitmo, puoInviare: puoInviare, registraScambio: registraScambio,
    datasetTroppoGrande: datasetTroppoGrande };
}
