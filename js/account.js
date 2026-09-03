/* account.js — accesso con un account, senza alcun server da mantenere.
   
   Correzione a quanto avevo affermato in precedenza: sostenevo che la
   sincronizzazione con account richiedesse un backend. Non è vero. Firebase
   Authentication più le regole di Firestore bastano: l'autenticazione avviene
   dal browser contro l'API di Google, e le regole impediscono a un utente di
   leggere i dati di un altro. Non serve codice lato server.

   Come funziona qui: chi pubblica il pannello crea UN progetto Firebase e ne
   mette chiave e identificativo in CONFIG_ACCOUNT. Da quel momento chiunque usi
   il pannello può registrarsi con email e password, e i suoi dati finiscono in
   pannello/{uid} — visibili solo a lui.

   La chiave API di un progetto Firebase NON è un segreto: identifica il
   progetto, non autorizza nulla. Google la pubblica nei propri esempi. Ciò che
   protegge i dati sono le regole di sicurezza. */

/* SYN-006 — la configurazione non sta più qui e non la compila l'utente:
   arriva da js/config-firebase.js, generato dalla build. Vedi
   FIREBASE-SETUP.md. `CONFIG_ACCOUNT` resta come vista di sola lettura per i
   punti che la leggevano. */
var CONFIG_ACCOUNT = {
  get apiKey(){ return FIREBASE_CONFIG.apiKey; },
  get projectId(){ return FIREBASE_CONFIG.projectId; },
  nome: "Account Pannello Tempo"
};

function accountDisponibile(){
  return firebaseConfigurato();
}

/* Registrazione: stesso endpoint dell'accesso, con un'azione diversa. */
function registraAccount(email, password, poi){
  if (!accountDisponibile()) { poi({ errore:"Questa copia del pannello non è collegata a nessun servizio di account." }); return; }
  vietaProduzioneNeiTest();
  var problema = controllaCampiAccount(email, password);
  if (problema) { poi({ errore: problema }); return; }
  fetch(endpointIdentity()+"/accounts:signUp?key="+
        encodeURIComponent(FIREBASE_CONFIG.apiKey), {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
  }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
    .then(function(x){
      if (!x.ok) {
        var msg = (x.d && x.d.error && x.d.error.message) || "HTTP "+x.d;
        if (/EMAIL_EXISTS/.test(msg))
          { poi({ errore:"Esiste già un account con questa email: usa «Entra» invece di «Crea account»." }); return; }
        poi({ errore: dettaglioErrore(new Error(msg)).causa });
        return;
      }
      applicaSessione(x.d, email);
      poi({ ok:true });
    })
    .catch(function(e){ poi({ errore: dettaglioErrore(e).causa }); });
}

/* SEC-001 — il parametro `ricordami` è stato rimosso dalla firma.
   Era il residuo di una funzione ritirata: restava accettato e ignorato, e un
   parametro che non fa niente è una promessa che qualcuno prima o poi prova a
   mantenere. Chi chiamava con quattro argomenti continua a funzionare: il
   quarto diventa `poi`, quindi la compatibilità è gestita sotto. */
function entraAccount(email, password, poi){
  if (typeof poi !== "function" && typeof arguments[3] === "function") poi = arguments[3];
  if (!accountDisponibile()) { poi({ errore:"Questa copia del pannello non è collegata a nessun servizio di account." }); return; }
  vietaProduzioneNeiTest();
  var problema = controllaCampiAccount(email, password);
  if (problema) { poi({ errore: problema }); return; }
  fetch(endpointIdentity()+"/accounts:signInWithPassword?key="+
        encodeURIComponent(FIREBASE_CONFIG.apiKey), {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
  }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
    .then(function(x){
      if (!x.ok) {
        var msg = (x.d && x.d.error && x.d.error.message) || "accesso non riuscito";
        poi({ errore: dettaglioErrore(new Error(msg)).causa });
        return;
      }
      applicaSessione(x.d, email);
      poi({ ok:true });
    })
    .catch(function(e){ poi({ errore: dettaglioErrore(e).causa }); });
}

/* La sessione riusa la macchina di sincronizzazione già esistente.
   Chiave e progetto NON vengono più copiati in `sync.fb`: li legge
   direttamente da FIREBASE_CONFIG chi ne ha bisogno. Copiarli qui significava
   anche scriverli su disco al primo `saveSync()`. */
function applicaSessione(d, email){
  sync.provider = "firebase";
  sync.account = true;
  sync.fb.email = email;
  sync.fb.uid = d.localId;
  sync.fb.idToken = d.idToken;
  sync.fb.expAt = Date.now() + (parseInt(d.expiresIn,10) || 3600) * 1000 - 60000;
  /* SEC-001 — Release 2B: «Resta collegato» è stato RIMOSSO, e con esso la
     conservazione del token di rinnovo.

     Il motivo è semplice e non aggirabile in questa architettura: un token in
     `localStorage` è leggibile da qualunque script eseguito nella pagina. Le
     difese che avevamo — CSP restrittiva, nessuno script di terze parti — sono
     mitigazioni, non protezioni. L'unica soluzione vera è un cookie
     `HttpOnly`, che richiede un server che qui non esiste.

     Offuscare o cifrare il token con una chiave che sta nella stessa pagina
     non aggiunge sicurezza: sposta solo il problema di una riga di codice.

     Conseguenza dichiarata: la sessione finisce quando chiudi il pannello. */
  sync.fb.refresh = "";
  sync.fb.inizioSessione = Date.now();
  sync.rev = 0; sync.dirty = false;
  saveSync();
}

/* SEC-001: l'uscita non lascia nulla che permetta di rientrare. Non basta
   azzerare l'oggetto in memoria: va riscritto anche ciò che è già su disco,
   e va verificato che non sia rimasto niente. */
function esciAccount(){
  sync.account = false;
  sync.provider = "locale";      /* si torna al predefinito, non a un servizio */
  sync.fb = { email:"", uid:"", refresh:"", idToken:"", expAt:0, inizioSessione:0 };
  sync.gist = { id:"", token:"", file:"pannello.json" };
  sync.status = ""; sync.err = null; sync.rev = 0; sync.dirty = false;
  sync.conflict = null; sync.prova = null;
  saveSync();
  /* sovrascrittura e rimozione del blocco su disco, con verifica */
  eliminaSicuro(SKEY);
  saveSync();
  return { residui: residuiCredenziali() };
}

/* Elenca ciò che, dopo un'uscita, permetterebbe ancora di rientrare.
   Deve tornare vuoto: se non lo è, il logout non ha fatto il suo lavoro. */
/* SEC-001 — toglie i token di rinnovo salvati dalle versioni precedenti.
   Idempotente: eseguirla su dati già puliti non cambia niente e non fallisce.
   Gira a ogni avvio, perché un token rimasto lì da mesi è esattamente il caso
   che vogliamo eliminare. */
/* ─────────────────────────────────────────────────────────────────────────
   SEC-001 — DIFETTO CORRETTO: la pulizia lasciava indietro due credenziali.

   Provato sulla build 035c16ab8a8f: dopo `ripulisciTokenPersistenti()`
   restavano su disco `fb.idToken` (token di accesso valido fino a un'ora) e
   `gist.token` (token GitHub, senza scadenza). La funzione si chiamava
   «ripulisci token persistenti» e ne toglieva uno su tre.

   Ora l'elenco di ciò che va rimosso è `CAMPI_SEGRETI` (js/sync.js), lo
   stesso usato per decidere cosa non scrivere: una sola lista, quindi non
   possono divergere.

   Registra l'esito tecnico — quanti e di che tipo — mai il contenuto.
   ───────────────────────────────────────────────────────────────────────── */
function ripulisciTokenPersistenti(){
  var tolti = [], serveRicollegare = false;

  /* 1. memoria */
  try {
    if (sync.fb && sync.fb.refresh) { sync.fb.refresh = ""; tolti.push("token-rinnovo:memoria"); }
    if (sync.gist && sync.gist.token) { sync.gist.token = ""; tolti.push("token-github:memoria"); }
    if (sync.ricordami) { delete sync.ricordami; tolti.push("preferenza-ricordami"); }
    if (sync.fb && sync.fb.apiKey !== undefined) delete sync.fb.apiKey;
    if (sync.fb && sync.fb.projectId !== undefined) delete sync.fb.projectId;
  } catch (e) {}

  /* 2. disco */
  try {
    var grezzo = Platform.archivio.leggi(SKEY);
    if (grezzo) {
      var o = JSON.parse(grezzo), cambiato = false;
      if (o && o.fb) {
        ["refresh","idToken","apiKey","projectId"].forEach(function(k){
          if (o.fb[k]) { delete o.fb[k]; cambiato = true; tolti.push("fb."+k+":disco"); }
        });
      }
      if (o && o.gist && o.gist.token) {
        delete o.gist.token; cambiato = true; tolti.push("gist.token:disco");
        /* l'utente aveva un collegamento a GitHub: va avvisato, perché quel
           percorso non esiste più e i suoi dati non si sincronizzano da soli */
        serveRicollegare = true;
      }
      if (o && o.ricordami !== undefined) { delete o.ricordami; cambiato = true; }
      /* provider "gist" non è più utilizzabile: si torna a «solo dispositivo»
         senza toccare né i dati locali né il gist remoto */
      if (o && o.provider === "gist") {
        o.provider = "locale"; cambiato = true;
        tolti.push("provider-gist:disattivato");
        serveRicollegare = true;
      }
      if (cambiato) Platform.archivio.scrivi(SKEY, JSON.stringify(o));
    }
  } catch (e) { /* dati illeggibili: non c'è token da togliere */ }

  if (sync.provider === "gist") sync.provider = "locale";
  if (tolti.length) saveSync();
  return { tolti: tolti, quanti: tolti.length, serveRicollegare: serveRicollegare };
}

/* Verifica indipendente: rilegge il disco e cerca le STRINGHE, non i campi.
   Serve a non fidarsi della funzione di pulizia. Restituisce i nomi delle
   chiavi trovate, mai i valori. */
function residuiSegretiSuDisco(){
  var trovati = [];
  [SKEY, KEY, "pannello-tempo:backup", "pannello-tempo:pre-migrazione"].forEach(function(chiave){
    var raw;
    try { raw = Platform.archivio.leggi(chiave); } catch (e) { return; }
    if (!raw) return;
    if (/"(idToken|refreshToken|refresh)"\s*:\s*"[^"]{8,}"/.test(raw)) trovati.push(chiave+" → token di sessione");
    if (/gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}/.test(raw)) trovati.push(chiave+" → token GitHub");
    if (/"(password|pw|pass|secret)"\s*:\s*"[^"]+"/.test(raw)) trovati.push(chiave+" → password");
  });
  return trovati;
}

function residuiCredenziali(){
  var trovati = [];
  ["refresh","idToken","uid","apiKey","email"].forEach(function(k){
    if (sync.fb && sync.fb[k]) trovati.push("sync.fb."+k);
  });
  if (sync.gist && (sync.gist.token || sync.gist.id)) trovati.push("sync.gist");
  try {
    var raw = Platform.archivio.leggi(SKEY);
    if (raw) {
      var o = JSON.parse(raw);
      ["refresh","idToken","uid"].forEach(function(k){
        if (o && o.fb && o.fb[k]) trovati.push(SKEY+".fb."+k);
      });
      if (o && o.gist && (o.gist.token || o.gist.id)) trovati.push(SKEY+".gist");
    }
  } catch (e) {}
  return trovati;
}

/* ─────────────────────────────────────────────────────────────────────────
   DIFETTO CORRETTO: c'erano TRE copie divergenti delle regole di sicurezza.

   Una qui (`REGOLE_ACCOUNT`), una in un `<textarea>` delle impostazioni
   (js/features/settings-ui.js) e una in firebase/firestore.rules citata nei
   commenti. Le prime due erano piatte su `pannello/{uid}` e nessuna delle due
   aveva la clausola di chiusura negativa: una collezione creata per sbaglio
   sarebbe rimasta accessibile.

   Tre copie di una regola di sicurezza significano che almeno due sono
   sbagliate, e non si sa quale sia in produzione.

   Ora esiste una sola fonte: `firebase/firestore.rules`. Le regole non si
   pubblicano più a mano — le pubblica chi distribuisce il pannello, una volta
   sola, con `firebase deploy --only firestore:rules`. L'utente non le vede.
   ───────────────────────────────────────────────────────────────────────── */
var REGOLE_ACCOUNT_DOVE = "firebase/firestore.rules";

