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

/* ---------- provider: Gist su GitHub ---------- */
var GistProvider = {
  id: "gist",
  nome: "GitHub Gist",
  isConfigured: function(){ return !!(sync.gist && sync.gist.id && sync.gist.token); },
  login: function(cred){
    if (cred) { sync.gist = { id: cred.id, token: cred.token }; saveSync(); }
    var problema = controllaCampiGist(sync.gist.id, sync.gist.token);
    if (problema) return Promise.reject(erroreSync("Dati incompleti", problema,
      "Controlla identificativo e token nelle impostazioni."));
    return GistProvider.pull().then(function(){ return { ok:true }; });
  },
  logout: function(){
    sync.gist = { id:"", token:"" };
    sync.rev = 0; sync.dirty = false; sync.conflict = null;
    saveSync();
    return Promise.resolve({ ok:true, residui: residuiCredenziali ? residuiCredenziali() : [] });
  },
  pull: function(){ return gistRead().then(normalizzaLettura, normalizzaErrore); },
  push: function(testo){ return gistWrite(testo).then(function(r){
    return { ok:true, rev:(r && r.rev) || sync.rev + 1 }; }, normalizzaErrore); },
  deleteRemote: function(){
    /* PRV-002: su Gist non esiste una cancellazione del contenuto via token
       senza cancellare il gist stesso, che potrebbe contenere altro. */
    return Promise.resolve({ ok:false, parziale:true,
      motivo:"Il contenuto viene svuotato, non eliminato: cancellare il gist "+
             "richiede un permesso che il pannello non chiede." });
  },
  getStatus: function(){ return statoSync(); },
  resolveConflict: function(scelta){ resolveConflict(scelta); return Promise.resolve({ ok:true }); }
};

/* ---------- provider: Firestore ---------- */
var FirebaseProvider = {
  id: "firebase",
  nome: "Firebase",
  isConfigured: function(){
    /* serve anche una sessione utilizzabile: chiave e progetto da soli non
       bastano a leggere o scrivere */
    return !!(sync.fb && sync.fb.apiKey && sync.fb.projectId && sync.fb.uid &&
              (sync.fb.refresh || sync.fb.idToken));
  },
  login: function(cred){
    if (!cred) return Promise.reject(erroreSync("Credenziali mancanti",
      "Servono email e password.", "Compila i campi nelle impostazioni."));
    /* chiave e progetto vengono depositati prima: fbSignIn li legge da sync.fb */
    if (cred.apiKey) sync.fb.apiKey = cred.apiKey;
    if (cred.projectId) sync.fb.projectId = cred.projectId;
    var problema = controllaCampiFb(sync.fb.apiKey, sync.fb.projectId, cred.email, cred.password);
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
