/* sync-provider.js — SYN-001: contratto unico per la sincronizzazione.

   Il dominio (state.js, events.js, coda.js, privacy.js) non deve conoscere né
   Firebase né GitHub: conosce soltanto questo contratto. Cambiare servizio
   significa scrivere un altro adattatore, non toccare il dominio.

   Contratto SyncProvider:
     isConfigured()   → l'utente ha fornito ciò che serve?
     login(cred)      → Promise, stabilisce una sessione
     logout()         → azzera credenziali e sessione, senza residui
     pull()           → Promise<{ rev, payload }>  legge lo stato remoto
     push(testo, rev) → Promise<{ ok, rev } | { conflitto, payload }>
     deleteRemote()   → Promise, cancella (o dichiara di non poterlo fare)
     getStatus()      → stato leggibile, senza gergo tecnico
     resolveConflict(scelta) → applica la decisione dell'utente

   Ogni adattatore normalizza i propri errori in { titolo, causa, cosa }: il
   dominio non deve interpretare codici HTTP o messaggi di Google. */

/* ---------- errori normalizzati ---------- */
function erroreSync(titolo, causa, cosa, tecnico){
  return { titolo: titolo, causa: causa, cosa: cosa, tecnico: tecnico || "" };
}

/* ---------- provider: nessun servizio collegato ---------- */
var LocalOnlyProvider = {
  id: "locale",
  nome: "Solo su questo dispositivo",
  isConfigured: function(){ return true; },
  login: function(){ return Promise.resolve({ ok:true }); },
  logout: function(){ return Promise.resolve({ ok:true, residui: [] }); },
  pull: function(){
    return Promise.reject(erroreSync("Nessun servizio collegato",
      "I dati restano su questo dispositivo.",
      "Collega un servizio dalle impostazioni se vuoi ritrovarli altrove."));
  },
  push: function(){ return Promise.resolve({ ok:true, rev:0, locale:true }); },
  deleteRemote: function(){
    return Promise.resolve({ ok:true, nulla:true,
      motivo:"Non c'era nulla da cancellare: i dati non sono mai usciti da qui." });
  },
  getStatus: function(){
    return { id:"locale", testo:"Salvato su questo dispositivo",
             nota:"Nessun servizio collegato: i dati non escono da qui." };
  },
  resolveConflict: function(){ return Promise.resolve({ ok:true }); }
};

/* ---------- provider: Gist su GitHub — DEPRECATO, SOLA LETTURA ----------

   MIG-001. Gist non è più un provider di sincronizzazione: è un percorso di
   uscita. Due ragioni dimostrate dal codice, non preferenze:

   1. Il token personale di GitHub non ha scadenza e non esiste un posto
      sicuro dove tenerlo in un'applicazione senza server. Finiva in
      `localStorage`, in chiaro. È lo stesso limite che ha portato a
      rimuovere «Resta collegato»: mantenerlo per Gist sarebbe stato
      incoerente e avrebbe dato un falso senso di sicurezza.
   2. `deleteRemote()` non sa cancellare. Un prodotto che offre «Elimina i
      miei dati» non può svuotare un file e lasciarlo dov'è.

   Cosa resta possibile: leggere il gist esistente per trasferire i dati su
   un account, una volta. Nessuna scrittura, nessun nuovo collegamento.
   Il token viene chiesto al momento, tenuto in memoria e dimenticato.
   Il contenuto remoto NON viene toccato: è dell'utente, e la revoca del
   token è un gesto che deve fare lui su GitHub. Vedi GIST-MIGRATION.md. */
var GistProvider = {
  id: "gist",
  nome: "Servizio collegato (non più supportato)",
  deprecato: true,
  soloLettura: true,
  /* Non si dichiara mai «configurato»: così `provider()` ricade su
     LocalOnlyProvider e nessun percorso automatico prova a scrivere. */
  isConfigured: function(){ return false; },
  /* `puoMigrare` è la domanda che conta adesso: c'è un gist da cui leggere? */
  puoMigrare: function(){ return !!(sync.gist && sync.gist.id); },
  login: function(){
    return Promise.reject(erroreSync(
      "Servizio non più supportato",
      "Il collegamento a GitHub è stato ritirato: richiedeva di conservare sul dispositivo un token senza scadenza, e non permetteva di cancellare davvero i dati.",
      "Puoi trasferire i dati su un account Pannello Tempo dalle impostazioni, oppure esportarli in un file."));
  },
  logout: function(){
    sync.gist = { id:"", token:"", file:"pannello.json" };
    sync.rev = 0; sync.dirty = false; sync.conflict = null;
    saveSync();
    return Promise.resolve({ ok:true, residui: residuiCredenziali ? residuiCredenziali() : [] });
  },
  /* Lettura consentita solo con un token fornito in questo momento. */
  pull: function(){
    if (!sync.gist.token) return Promise.reject(erroreSync(
      "Serve di nuovo il token",
      "Il token di GitHub non viene più conservato sul dispositivo.",
      "Incollalo di nuovo per leggere i dati da trasferire: verrà dimenticato appena finito."));
    return gistRead().then(normalizzaLettura, normalizzaErrore);
  },
  push: function(){
    return Promise.reject(erroreSync(
      "Scrittura disattivata",
      "Questo servizio è in sola lettura: serve solo a recuperare i dati salvati in precedenza.",
      "Attiva un account Pannello Tempo per tornare a sincronizzare."));
  },
  deleteRemote: function(){
    return Promise.resolve({ ok:false, parziale:true,
      motivo:"I dati su GitHub restano dove sono: cancellarli richiede un permesso "+
             "che il pannello non chiede, e non vogliamo toccare un file che è tuo. "+
             "Puoi eliminare il gist e revocare il token dal tuo account GitHub." });
  },
  getStatus: function(){ return statoSync(); },
  resolveConflict: function(scelta){ resolveConflict(scelta); return Promise.resolve({ ok:true }); }
};

/* Lettura una tantum per la migrazione. Il token non viene mai salvato:
   entra, serve, esce. L'ordine degli argomenti di `controllaCampiGist` è
   (token, id): passarli invertiti — come faceva la versione precedente —
   rifiutava una coppia valida con un messaggio sul campo sbagliato. */
function leggiGistPerMigrazione(id, token){
  var problema = controllaCampiGist(token, id);
  if (problema) return Promise.reject(erroreSync("Dati incompleti", problema,
    "Controlla identificativo del gist e token, poi riprova."));
  var precedente = sync.gist.token;
  sync.gist.id = id; sync.gist.token = token;
  return gistRead().then(function(t){
    sync.gist.token = precedente;      /* dimenticato subito */
    return t;
  }, function(e){
    sync.gist.token = precedente;
    return normalizzaErrore(e);
  });
}

/* ---------- provider: Firestore ---------- */
var FirebaseProvider = {
  id: "firebase",
  nome: "Account Pannello Tempo",
  isConfigured: function(){
    /* La configurazione del progetto arriva dalla build; da parte dell'utente
       serve una sessione viva. `idToken` vive solo in memoria: alla chiusura
       della scheda questo torna falso, ed è il comportamento dichiarato. */
    return !!(firebaseConfigurato() && sync.fb && sync.fb.uid &&
              sync.fb.idToken && Date.now() < sync.fb.expAt);
  },
  login: function(cred){
    if (!cred) return Promise.reject(erroreSync("Credenziali mancanti",
      "Servono email e password.", "Compila i campi e riprova."));
    var problema = controllaCampiAccount(cred.email, cred.password);
    if (problema) return Promise.reject(erroreSync("Dati incompleti", problema,
      "Correggi il campo e riprova."));
    return fbSignIn(cred.email, cred.password)
      .then(function(){ return { ok:true }; }, normalizzaErrore);
  },
  logout: function(){
    var r = (typeof esciAccount === "function") ? esciAccount() : { residui: [] };
    return Promise.resolve({ ok:true, residui: r.residui || [] });
  },
  pull: function(){ return fbRead().then(normalizzaLettura, normalizzaErrore); },
  push: function(testo){ return fbWrite(testo).then(function(r){
    return { ok:true, rev:(r && r.rev) || sync.rev + 1 }; }, normalizzaErrore); },
  deleteRemote: function(){
    /* Le regole di firestore.rules permettono delete al proprietario del
       documento: la cancellazione è reale, non uno svuotamento. */
    if (typeof fbDelete !== "function")
      return Promise.resolve({ ok:false, parziale:true,
        motivo:"Cancellazione remota non disponibile in questa versione." });
    return fbDelete().then(function(){ return { ok:true }; }, normalizzaErrore);
  },
  getStatus: function(){ return statoSync(); },
  resolveConflict: function(scelta){ resolveConflict(scelta); return Promise.resolve({ ok:true }); }
};

var PROVIDER = {
  locale: LocalOnlyProvider,
  gist: GistProvider,
  firebase: FirebaseProvider
};

/* Il dominio chiama SOLO questa funzione per ottenere il provider in uso. */
function provider(){
  var p = PROVIDER[sync.provider];
  if (!p || !p.isConfigured()) return LocalOnlyProvider;
  return p;
}
function providerRegistrato(id, adattatore){
  PROVIDER[id] = adattatore;      /* punto di innesto per un provider nuovo */
}

function normalizzaLettura(r){
  if (!r) return { rev: 0, payload: null };
  return { rev: r.rev || 0, payload: r.payload !== undefined ? r.payload : r };
}
function normalizzaErrore(e){
  if (e && e.titolo && e.causa) return Promise.reject(e);
  var d = dettaglioErrore(e);
  return Promise.reject(erroreSync(d.titolo, d.causa, d.cosa, d.tecnico));
}
