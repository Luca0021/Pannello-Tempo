/* sync.js — sincronizzazione Gist e Firebase, errori, verifica
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- sincronizzazione (Gist oppure Firebase) ---------- */
var PKEY = "pannello-tempo:prefs";
var P = { theme:"auto", dense:true, fold:{}, groupBy:"area" };
function loadPrefs(){
  try { var r = localStorage.getItem(PKEY); if (r) Object.assign(P, JSON.parse(r)); } catch (e) {}
  if (P.groupBy === "progetto") { P.groupBy = "etichetta"; savePrefs(); }
}
function savePrefs(){ try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {} }
/* Migrazione: prima tema, densità e sezioni viaggiavano coi dati e un dispositivo
   imponeva le sue preferenze all'altro. */
function migratePrefs(){
  var moved = false;
  if (S.data.theme) { P.theme = S.data.theme; delete S.data.theme; moved = true; }
  if (S.data.dense !== undefined) { P.dense = S.data.dense !== false; delete S.data.dense; moved = true; }
  if (S.data.fold) { P.fold = S.data.fold; delete S.data.fold; moved = true; }
  if (moved) { savePrefs(); save(); }
}

var SKEY = "pannello-tempo:sync";

/* SYN-006 / SEC-001 — il predefinito è «solo su questo dispositivo».
   Prima era "gist": un'installazione appena aperta si dichiarava pronta a
   parlare con GitHub, e il primo servizio proposto era quello che richiede
   di incollare un token. Il predefinito di un prodotto consumer è non
   mandare niente da nessuna parte. */
var sync = {
  provider:"locale", auto:true, rev:0, dirty:false,
  status:"", at:"", busy:false, conflict:null,
  /* Gist: `token` vive SOLO in memoria e SOLO durante la migrazione.
     `id` è un identificativo, non un segreto: resta per poter proporre il
     trasferimento a chi arriva da una versione precedente. */
  gist:{ token:"", id:"", file:"pannello.json" },
  err:null, prova:null, account:false,
  /* fb: `idToken` vive SOLO in memoria. `refresh` non viene più richiesto
     né conservato: vedi CAMPI_SEGRETI qui sotto. */
  fb:{ email:"", uid:"", refresh:"", idToken:"", expAt:0, inizioSessione:0 }
};
var syncTimer = null;

/* ─────────────────────────────────────────────────────────────────────────
   SEC-001 — CHE COSA NON FINISCE MAI SU DISCO

   `saveSync()` serializzava `sync.fb` e `sync.gist` interi. Provato sulla
   build 035c16ab8a8f: in `pannello-tempo:sync` finivano in chiaro
   `fb.refresh`, `fb.idToken` e `gist.token`. Il rapporto di sicurezza
   dichiarava «Token su disco: mai scritto»: era falso.

   Ora la scrittura è a lista chiusa. Aggiungere un campo segreto al modello
   non lo porta su disco per distrazione: perché ci arrivi bisogna toglierlo
   da questo elenco, e questo elenco è il posto dove si guarda.
   ───────────────────────────────────────────────────────────────────────── */
var CAMPI_SEGRETI = ["idToken", "refresh", "token", "password", "pw", "pass",
                     "secret", "apiKey", "accessToken", "refreshToken"];

/* Toglie da un oggetto qualunque i campi segreti, a qualsiasi profondità.
   Usata prima di scrivere su disco e prima di esportare. */
function senzaSegreti(o){
  if (!o || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(senzaSegreti);
  var out = {};
  Object.keys(o).forEach(function(k){
    if (CAMPI_SEGRETI.indexOf(k) >= 0) return;
    out[k] = (o[k] && typeof o[k] === "object") ? senzaSegreti(o[k]) : o[k];
  });
  return out;
}

function loadSync(){
  try {
    var r = localStorage.getItem(SKEY);
    if (r) {
      var o = JSON.parse(r);
      /* un blocco senza provider ricade su «locale», non su un servizio */
      sync.provider = o.provider || "locale";
      sync.auto = o.auto !== false;
      sync.rev = o.rev || 0;
      sync.dirty = !!o.dirty;
      /* I segreti eventualmente presenti su disco (scritti dalle versioni
         precedenti) NON vengono caricati in memoria: verrebbero riscritti al
         primo salvataggio. Li rimuove `ripulisciTokenPersistenti()`. */
      if (o.gist) { sync.gist.id = o.gist.id || ""; sync.gist.file = o.gist.file || "pannello.json"; }
      if (o.fb)   { sync.fb.email = o.fb.email || ""; sync.fb.uid = o.fb.uid || ""; }
    }
  } catch (e) {}
  sync.busy = false; sync.conflict = null;
}
function saveSync(){
  try {
    localStorage.setItem(SKEY, JSON.stringify({
      provider:sync.provider, auto:sync.auto, rev:sync.rev, dirty:sync.dirty,
      /* solo identificativi, nessuna credenziale */
      gist:{ id:sync.gist.id, file:sync.gist.file },
      fb:{ email:sync.fb.email, uid:sync.fb.uid }
    }));
  } catch (e) {}
}
/* SYN-001: chi è pronto lo dice l'adattatore, non un confronto sul nome del
   provider. Con un elenco di nomi scritto qui, aggiungere un servizio avrebbe
   richiesto di ricordarsi di toccare anche questa riga. */
function syncReady(){
  var p = PROVIDER[sync.provider];
  return !!(p && p !== LocalOnlyProvider && p.isConfigured());
}
/* SYN-006 — all'utente non si dice il nome del fornitore.
   «Firebase» e «GitHub Gist» sono dettagli di implementazione: comparivano
   nella riga di stato delle impostazioni e non aiutavano nessuno a capire
   dove fossero i propri dati. I nomi tecnici restano nei log tecnici. */
function providerName(){
  if (sync.provider === "firebase") return "Account Pannello Tempo";
  if (sync.provider === "gist")     return "Servizio collegato (non più supportato)";
  return "Solo su questo dispositivo";
}
/* Il nome tecnico, per i log e la schermata Informazioni. */
function providerNameTecnico(){
  return sync.provider === "gist" ? "github-gist"
       : sync.provider === "firebase" ? "firebase" : "locale";
}
function setStatus(s){
  if (s && s !== "errore") sync.err = null;
  sync.status = s;
  sync.at = new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
}
/* Traduce l'errore grezzo in: che cosa è successo, che cosa fare.
   Senza questo, «HTTP 400» non dice se sbagli password o chiave. */
var ERRORI_FB = [
  ["API_KEY_INVALID|API key not valid", "Chiave API non valida",
   "La chiave web del progetto è sbagliata o incompleta.",
   "Console Firebase → ⚙ Impostazioni progetto → Le tue app → App web → apiKey."],
  ["OPERATION_NOT_ALLOWED", "Accesso con email e password non attivo",
   "Il progetto non consente questo tipo di accesso.",
   "Console Firebase → Authentication → Sign-in method → abilita «Email/Password»."],
  ["EMAIL_NOT_FOUND", "Utente inesistente",
   "Nessun utente registrato con questa email.",
   "Console Firebase → Authentication → Users → Add user, con la stessa email."],
  ["INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS", "Password errata",
   "Email o password non corrispondono.",
   "Ricontrolla la password, oppure reimpostala da Authentication → Users."],
  ["INVALID_EMAIL", "Email non valida", "L'indirizzo non ha un formato corretto.", "Correggi l'email."],
  ["USER_DISABLED", "Utente disabilitato", "L'account esiste ma è stato disattivato.",
   "Console Firebase → Authentication → Users → riattiva l'utente."],
  ["TOO_MANY_ATTEMPTS", "Troppi tentativi", "Firebase ha bloccato temporaneamente l'accesso.",
   "Attendi qualche minuto e riprova."],
  ["TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND", "Sessione scaduta",
   "Le credenziali salvate non sono più valide.",
   "Premi «Scollega» e ricollega inserendo di nuovo la password."],
  ["SERVICE_DISABLED|has not been used in project|Cloud Firestore API", "Firestore non attivo",
   "Il database non è stato creato in questo progetto.",
   "Console Firebase → Build → Firestore Database → Crea database → modalità produzione."],
  ["PERMISSION_DENIED|Missing or insufficient permissions", "Regole di sicurezza troppo strette",
   "Firestore rifiuta la scrittura per l'utente collegato.",
   "Firestore → Rules: consenti lettura e scrittura su pannello/{uid} all'utente con quell'uid."],
  ["NOT_FOUND|The database .* does not exist", "Database non trovato",
   "Il progetto non ha un database Firestore predefinito.",
   "Crea il database, oppure controlla l'identificativo del progetto."]
];
/* Controlli fatti prima di chiamare il servizio: un campo incollato male
   produce altrimenti un errore oscuro del server. */
/* SYN-006 — l'utente non compila più chiave e progetto: arrivano dalla build.
   Restano da validare solo i suoi due campi, e i messaggi parlano di email e
   password, non di configurazione di un servizio. */
function controllaCampiAccount(email, pw){
  if (!firebaseConfigurato())
    return "Questa copia del pannello non è collegata a nessun servizio di account.";
  if (!email) return "Manca l'email.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "L'email non ha un formato valido.";
  if (!pw) return "Manca la password.";
  if (pw.length < 6) return "La password deve avere almeno sei caratteri.";
  return "";
}
/* Compatibilità con i punti che passavano ancora chiave e progetto: vengono
   ignorati, perché non è più l'utente a fornirli. */
function controllaCampiFb(ak, pid, email, pw){
  return controllaCampiAccount(email, pw);
}
function controllaCampiGist(tok, id){
  if (!tok) return "Manca il token di GitHub.";
  if (/\s/.test(tok)) return "Il token contiene spazi: probabilmente è stato incollato male.";
  if (!/^gh[pousr]_|^github_pat_/.test(tok))
    return "Il token non ha il formato atteso: deve iniziare con ghp_ oppure github_pat_.";
  if (!id) return "Manca l'identificativo del gist.";
  if (!/^[0-9a-f]{20,}$/i.test(id))
    return "L'identificativo del gist è la parte finale dell'indirizzo, fatta di lettere e cifre.";
  return "";
}
function dettaglioErrore(e){
  var m = String((e && e.message) || e || "");
  for (var i = 0; i < ERRORI_FB.length; i++) {
    if (new RegExp(ERRORI_FB[i][0], "i").test(m))
      return { titolo:ERRORI_FB[i][1], causa:ERRORI_FB[i][2], cosa:ERRORI_FB[i][3], tecnico:m.slice(0,300) };
  }
  if (/Failed to fetch|NetworkError|Load failed|ERR_INTERNET/i.test(m))
    return { titolo:"Nessuna connessione", causa:"Il pannello non riesce a raggiungere il servizio.",
             cosa:"Controlla la rete. Se apri il file da disco, alcuni browser bloccano le chiamate: pubblicalo su GitHub Pages.",
             tecnico:m.slice(0,300) };
  if (/HTTP 401/.test(m))
    return { titolo:"Credenziali rifiutate", causa:"Il servizio non riconosce le credenziali.",
             cosa:"Ricontrolla chiave, email e password, poi ricollega.", tecnico:m.slice(0,300) };
  if (/HTTP 403/.test(m))
    return { titolo:"Accesso negato", causa:"Le credenziali sono valide ma non autorizzate.",
             cosa:"Controlla le regole di sicurezza di Firestore, o i permessi del token GitHub (serve «gist»).",
             tecnico:m.slice(0,300) };
  if (/HTTP 404/.test(m))
    return { titolo:"Destinazione non trovata", causa:"L'indirizzo richiesto non esiste.",
             cosa:"Controlla l'identificativo del progetto o del gist.", tecnico:m.slice(0,300) };
  return { titolo:"Errore imprevisto", causa:"Il servizio ha risposto in modo inatteso.",
           cosa:"Copia il dettaglio qui sotto e verifica la configurazione.", tecnico:m.slice(0,300) };
}
function syncError(e){
  var m = String(e && e.message || e);
  if (m.indexOf("401") >= 0) return "credenziali non valide o scadute";
  if (m.indexOf("403") >= 0) return "accesso negato: controlla permessi e regole";
  if (m.indexOf("404") >= 0) return "destinazione non trovata: controlla gli identificativi";
  if (m.indexOf("EMAIL") >= 0 || m.indexOf("PASSWORD") >= 0) return "email o password errate";
  if (m.indexOf("Failed") >= 0 || m.indexOf("NetworkError") >= 0 || m.indexOf("Load failed") >= 0)
    return "nessuna connessione";
  return m;
}
function jsonOrThrow(r){
  if (!r.ok) return r.text().then(function(t){ throw new Error("HTTP "+r.status+" "+t.slice(0,120)); });
  return r.json();
}

/* --- Gist: SOLA LETTURA, e solo per la migrazione (MIG-001) --------------
   Vedi GIST-MIGRATION.md. Qui non si scrive e non si cancella: le funzioni
   di scrittura sono state rimosse, non disattivate con un `if`, perché una
   funzione che esiste può essere richiamata per sbaglio. */

/* Interruttore di rimozione futura. Quando il lettore non servirà più —
   perché chi doveva migrare ha migrato — si porta a `false` e il percorso
   legacy sparisce dall'interfaccia. Non è una data commerciale inventata:
   è una leva che il proprietario del prodotto tira quando decide, dopo aver
   guardato quanti utenti hanno ancora un identificativo salvato.

   Portarlo a `false` NON riattiva la scrittura: la scrittura non esiste. */
var LETTORE_GIST_ATTIVO = true;

function ghHeaders(){
  return { "Authorization":"Bearer "+sync.gist.token,
           "Accept":"application/vnd.github+json",
           "X-GitHub-Api-Version":"2022-11-28" };
}

/* Legge il gist e restituisce ANCHE le diagnosi che servono a spiegare
   all'utente cosa è andato storto, invece di un «HTTP 404» secco.
   Non registra mai il token, né in memoria oltre la chiamata né nei log. */
function gistLeggiConDiagnosi(){
  if (!LETTORE_GIST_ATTIVO)
    return Promise.reject(erroreSync("Recupero non più disponibile",
      "La lettura dei dati dal servizio precedente è stata rimossa da questa versione.",
      "Se hai ancora dati là, esportali dall'interfaccia di GitHub e importali qui come file."));
  return fetch("https://api.github.com/gists/"+encodeURIComponent(sync.gist.id),
               { headers: ghHeaders(), cache:"no-store" })
    .then(function(r){
      if (r.status === 401)
        throw erroreSync("Token rifiutato",
          "GitHub non riconosce il token, oppure è scaduto o è stato revocato.",
          "Controlla di averlo incollato per intero. Se l'hai revocato, creane uno nuovo con il solo permesso «gist».");
      if (r.status === 403)
        throw erroreSync("Permesso mancante o limite raggiunto",
          "Il token è valido ma non ha il permesso «gist», oppure GitHub ha temporaneamente limitato le richieste.",
          "Verifica i permessi del token; se il problema resta, riprova fra qualche minuto.");
      if (r.status === 404)
        throw erroreSync("Non trovato",
          "Non esiste nessun file con questo identificativo, oppure il token appartiene a un altro account.",
          "Controlla l'identificativo: è la parte finale dell'indirizzo, fatta di lettere e cifre.");
      if (!r.ok) throw new Error("HTTP "+r.status);
      return r.json();
    })
    .then(function(g){
      var diag = { pubblico: g.public === true, troncato: false, nomeFile: sync.gist.file };
      var f = g.files && g.files[sync.gist.file];
      /* il file atteso non c'è: forse è stato rinominato. Guardo se ce n'è
         uno solo e lo propongo, invece di dire «vuoto». */
      if (!f) {
        var nomi = Object.keys(g.files || {});
        if (nomi.length === 1) { f = g.files[nomi[0]]; diag.nomeFile = nomi[0]; diag.nomeDiverso = true; }
        else if (!nomi.length)
          throw erroreSync("Nessun file dentro",
            "Il file remoto esiste ma non contiene nulla.",
            "Non c'è niente da recuperare: puoi rimuovere il riferimento da questo dispositivo.");
        else
          throw erroreSync("Più file, nessuno riconosciuto",
            "Dentro ci sono "+nomi.length+" file e nessuno si chiama «"+sync.gist.file+"».",
            "Scarica il file giusto dall'interfaccia di GitHub e importalo qui come backup.");
      }
      /* GitHub tronca i file grandi e mette il resto a un indirizzo a parte:
         senza questo passaggio si migrerebbe metà dataset in silenzio. */
      if (f.truncated && f.raw_url) {
        diag.troncato = true;
        return fetch(f.raw_url).then(function(r){
          if (!r.ok) throw erroreSync("Contenuto troppo grande",
            "Il file è stato troncato da GitHub e la parte restante non è raggiungibile.",
            "Scaricalo dall'interfaccia di GitHub e importalo qui come backup.");
          return r.text();
        }).then(function(t){ return { testo:t, diag:diag }; });
      }
      return { testo: f.content || "", diag: diag };
    });
}

/* Compatibilità: il vecchio nome restituiva solo il testo. */
function gistRead(){
  return gistLeggiConDiagnosi().then(function(r){ return r.testo; });
}

/* --- Firebase ---
   Chiave e progetto arrivano dalla configurazione di build (FIREBASE_CONFIG),
   non dall'utente. Gli endpoint passano da config-firebase.js perché
   l'emulatore ne cambia l'indirizzo e la scelta deve stare in un punto solo. */

function fbApiKey(){ return FIREBASE_CONFIG.apiKey; }
function fbProjectId(){ return FIREBASE_CONFIG.projectId; }

function fbSignIn(email, password){
  vietaProduzioneNeiTest();
  return fetch(endpointIdentity()+"/accounts:signInWithPassword?key="+
               encodeURIComponent(fbApiKey()),
               { method:"POST", headers:{ "Content-Type":"application/json" },
                 body: JSON.stringify({ email:email, password:password, returnSecureToken:true }) })
    .then(jsonOrThrow)
    .then(function(d){
      applicaSessione(d, email);
      return sync.fb.idToken;
    });
}

/* SEC-001 — senza token di rinnovo non si rinnova.
   Prima questa funzione chiedeva un id_token nuovo usando `sync.fb.refresh`.
   Il token di rinnovo non viene più conservato, quindi qui non c'è nulla da
   usare: quando l'id_token scade la sessione è finita, e lo si dice.
   È una perdita di comodità dichiarata, non un difetto nascosto: la
   alternativa era tenere su disco una credenziale senza scadenza. */
function fbToken(){
  if (sync.fb.idToken && Date.now() < sync.fb.expAt)
    return Promise.resolve(sync.fb.idToken);
  sync.fb.idToken = ""; sync.fb.expAt = 0;
  return Promise.reject(erroreSync(
    "Sessione scaduta",
    "La sessione dura finché il pannello resta aperto: non conserviamo sul dispositivo nulla che permetta di rientrare al posto tuo.",
    "Entra di nuovo con la tua password per riprendere la sincronizzazione.",
    "SESSION_EXPIRED"));
}

/* Struttura: users/{uid}/datasets/current
   Non una collezione globale filtrata dal client. L'UID è nel percorso,
   quindi le regole possono confrontarlo con `request.auth.uid` invece di
   fidarsi di un campo dentro il documento. */
function fbBase(){
  return endpointFirestore()+"/projects/"+encodeURIComponent(fbProjectId())+
         "/databases/(default)/documents";
}
function fbDocUrl(){
  return fbBase()+"/users/"+encodeURIComponent(sync.fb.uid)+"/datasets/current";
}
/* Percorso delle versioni precedenti: collezione piatta `pannello/{uid}`.
   Serve solo a leggere e trasferire i dati di chi si collega dopo
   l'aggiornamento. Non ci si scrive più. */
function fbDocUrlLegacy(){
  return fbBase()+"/pannello/"+encodeURIComponent(sync.fb.uid);
}
function fbLeggiDoc(url){
  return fbToken().then(function(tok){
    return fetch(url, { headers:{ "Authorization":"Bearer "+tok }, cache:"no-store" });
  }).then(function(r){
    if (r.status === 404) return "";
    return jsonOrThrow(r).then(function(d){
      return (d.fields && d.fields.payload && d.fields.payload.stringValue) || "";
    });
  });
}
function fbRead(){
  return fbLeggiDoc(fbDocUrl()).then(function(t){
    if (t && t.trim()) return t;
    /* niente nel percorso nuovo: guardo in quello vecchio, una volta sola.
       Se c'è qualcosa lo restituisco e `pushNow` lo riscriverà nel percorso
       nuovo: la migrazione avviene leggendo, senza cancellare nulla. */
    return fbLeggiDoc(fbDocUrlLegacy()).then(function(v){
      if (v && v.trim()) sync.migratoDaPercorsoVecchio = true;
      return v;
    }, function(){ return ""; });
  });
}
/* I tre campi che le regole validano (firebase/firestore.rules):
     payload      il dataset serializzato, sotto i 900 000 caratteri
     schema       non può regredire: un client vecchio non deve poter
                  riscrivere dati di uno schema nuovo appiattendoli
     aggiornatoIl un istante non nel futuro: un timestamp futuro farebbe
                  vincere per sempre questo dispositivo in ogni confronto
   Ometterne uno fa rifiutare la scrittura dalle regole, non passare in
   silenzio: è la ragione per cui la validazione sta là e non solo qui. */
function fbWrite(text){
  if (text && text.length >= 900000)
    return Promise.reject(erroreSync("Dati troppo grandi",
      "L'insieme dei dati supera il limite di un singolo documento del servizio.",
      "Archivia le voci che non ti servono più, oppure cancella la cronologia dal Centro privacy."));
  return fbToken().then(function(tok){
    return fetch(fbDocUrl()+"?updateMask.fieldPaths=payload"+
                 "&updateMask.fieldPaths=schema&updateMask.fieldPaths=aggiornatoIl",
      { method:"PATCH",
        headers:{ "Authorization":"Bearer "+tok, "Content-Type":"application/json" },
        body: JSON.stringify({ fields:{
          payload:{ stringValue: text },
          schema:{ integerValue: String(SCHEMA_ATTUALE) },
          aggiornatoIl:{ timestampValue: new Date().toISOString() }
        } }) });
  }).then(function(r){ if (!r.ok) throw new Error("HTTP "+r.status); return true; });
}

/* PRV-002 — cancellazione REALE del documento remoto.
   Le regole in firebase/firestore.rules concedono `write` al proprietario, e
   `write` comprende `delete`: la cancellazione è quindi permessa dal client
   autenticato, senza bisogno di un backend. Verificato nel contratto, non
   nell'uso: l'esito viene riportato all'utente operazione per operazione. */
function fbDelete(){
  return fbToken().then(function(tok){
    var h = { "Authorization":"Bearer "+tok };
    /* Cancella il percorso nuovo E quello delle versioni precedenti: lasciare
       indietro il documento vecchio significherebbe dire «cancellato» mentre
       una copia resta leggibile. Entrambi devono riuscire, o l'esito è
       parziale e viene dichiarato. */
    return Promise.all([
      fetch(fbDocUrl(),       { method:"DELETE", headers:h }),
      fetch(fbDocUrlLegacy(), { method:"DELETE", headers:h })
    ]);
  }).then(function(rs){
    /* 404 significa che non c'era nulla: è comunque il risultato voluto */
    var falliti = rs.filter(function(r){ return !r.ok && r.status !== 404; });
    if (falliti.length) throw new Error("HTTP "+falliti[0].status);
    return true;
  });
}

/* --- comune --- */
/* SYN-001 — il dominio non sceglie più il servizio: lo fa il contratto.
   Aggiungere un provider significa registrarne l'adattatore, non toccare qui. */
function readRemote(){ return provider().pull().catch(normalizzaErrore); }
/* La normalizzazione è ripetuta qui come rete di sicurezza: un adattatore
   scritto male non deve poter far arrivare al dominio un errore grezzo. */
function writeRemote(t){ return provider().push(t).catch(normalizzaErrore); }

function remoteRevOf(txt){
  if (!txt || !txt.trim()) return { rev:0, payload:null };
  try { var p = JSON.parse(txt); return { rev: p.rev || 0, payload: p }; }
  catch (e) { return { rev:0, payload:null }; }
}
/* Verifica in quattro passi: dice quale fallisce, invece di un «errore» secco. */
function verificaCollegamento(){
  var passi = [];
  sync.prova = { corso:true, passi:passi };
  render();
  function segna(nome, ok, nota){ passi.push({ nome:nome, ok:ok, nota:nota||"" }); render(); }
  function fine(){ sync.prova.corso = false; render(); }
  var pre = sync.provider === "gist"
    ? controllaCampiGist(sync.gist.token, sync.gist.id)
    : controllaCampiFb(sync.fb.apiKey, sync.fb.projectId, sync.fb.email, "xxxxxx");
  if (pre && sync.provider === "gist") { segna("Campi compilati", false, pre); return fine(); }
  segna("Campi compilati", true);
  var lettura;
  if (sync.provider === "firebase") {
    lettura = fbToken().then(function(){ segna("Accesso a Firebase", true); return fbRead(); })
      .catch(function(e){
        var d = dettaglioErrore(e);
        segna("Accesso a Firebase", false, d.titolo+" — "+d.cosa);
        throw e;
      });
  } else lettura = readRemote();
  lettura.then(function(txt){
    segna("Lettura dei dati remoti", true,
          txt && txt.trim() ? "trovati dati già salvati" : "nessun dato ancora: è normale al primo collegamento");
    return writeRemote(JSON.stringify({ app:"pannello-tempo", rev: sync.rev || 0,
                                        savedAt:new Date().toISOString(), data:S.data }));
  }).then(function(){
    segna("Scrittura di prova", true, "il pannello può salvare");
    segna("Collegamento funzionante", true);
    fine();
  }).catch(function(e){
    if (passi.length && passi[passi.length-1].ok === false) return fine();
    var d = dettaglioErrore(e);
    segna(passi.length < 3 ? "Lettura dei dati remoti" : "Scrittura di prova", false, d.titolo+" — "+d.cosa);
    sync.err = d;
    fine();
  });
}
function pushNow(force){
  if (!syncReady() || sync.busy) return;
  sync.busy = true; setStatus("salvataggio…"); render();
  readRemote().then(function(txt){
    var r = remoteRevOf(txt);
    if (!force && r.rev > sync.rev && sync.rev > 0) {
      sync.conflict = r.payload; setStatus("conflitto"); sync.busy = false; render(); return;
    }
    var payload = { app:"pannello-tempo", rev:(r.rev||0)+1,
                    savedAt:new Date().toISOString(), data:S.data };
    return writeRemote(JSON.stringify(payload)).then(function(){
      sync.rev = payload.rev; sync.dirty = false; sync.conflict = null;
      /* invio riuscito: la coda si svuota e l'attesa di riprova si azzera */
      if (typeof svuotaCoda === "function") { svuotaCoda(); save(); }
      if (typeof ATTESA_RIPROVA !== "undefined") ATTESA_RIPROVA = 0;
      setStatus("sincronizzato"); saveSync(); sync.busy = false; render();
    });
  }).catch(function(e){
    /* attesa crescente prima di riprovare: niente martellamento (SEC-008) */
    if (typeof ATTESA_RIPROVA !== "undefined") {
      sync.tentativi = (sync.tentativi || 0) + 1;
      ATTESA_RIPROVA = Date.now() + Math.min(300000, 5000 * Math.pow(2, Math.min(6, sync.tentativi)));
    }
    sync.err = dettaglioErrore(e); setStatus("errore"); sync.busy = false; render();
  });
}
function pullNow(){
  if (!syncReady() || sync.busy) return;
  if (S.editId || S.linkEdit || S.dragging) { sync.pendingPull = true; return; }
  sync.pendingPull = false;
  sync.busy = true; setStatus("lettura…"); render();
  readRemote().then(function(txt){
    var r = remoteRevOf(txt);
    if (!r.payload) { sync.busy = false; pushNow(true); return; }
    if (((r.payload.data && r.payload.data.v) || 1) > SCHEMA_ATTUALE) {
      setStatus("dati remoti di una versione più recente: aggiorna il file");
      sync.busy = false; render(); return;
    }
    if (r.rev > sync.rev) {
      if (sync.dirty) {
        /* SYN-004: invece di dichiarare un conflitto sull'intero insieme di
           dati, confronto record per record. Solo i record davvero in disaccordo
           finiscono davanti all'utente; il resto viene fuso da solo. */
        var esito = fondiPerRecord(S.data, r.payload.data || {});
        if (esito.conflitti.length) {
          S.conflitti = esito.conflitti;
          S.datiFusi = esito.uniti;
          sync.revRemota = r.rev;
          setStatus(esito.conflitti.length === 1 ? "1 record in conflitto"
                    : esito.conflitti.length+" record in conflitto");
          sync.busy = false; render(); return;
        }
        /* nessun conflitto vero: la fusione è sicura */
        S.data = Object.assign(seed(), esito.uniti);
        normalizeData();
        sync.rev = r.rev; sync.dirty = false;
        setStatus("unito senza conflitti");
        saveSync(); save(); sync.busy = false; render(); return;
      }
      S.data = Object.assign(seed(), r.payload.data || {});
      normalizeData();
      sync.rev = r.rev; sync.dirty = false; setStatus("aggiornato dal cloud");
      saveSync(); save();
    } else setStatus("sincronizzato");
    sync.busy = false; render();
  }).catch(function(e){
    /* attesa crescente prima di riprovare: niente martellamento (SEC-008) */
    if (typeof ATTESA_RIPROVA !== "undefined") {
      sync.tentativi = (sync.tentativi || 0) + 1;
      ATTESA_RIPROVA = Date.now() + Math.min(300000, 5000 * Math.pow(2, Math.min(6, sync.tentativi)));
    }
    sync.err = dettaglioErrore(e); setStatus("errore"); sync.busy = false; render();
  });
}
function scheduleSync(){
  if (!syncReady() || !sync.auto) return;
  sync.dirty = true; saveSync();
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(function(){ pushNow(false); }, 4000);
}
function resolveConflict(keepLocal){
  if (!sync.conflict) return;
  if (keepLocal) { sync.rev = sync.conflict.rev; sync.conflict = null; pushNow(true); }
  else {
    snapshot("Hai adottato la versione salvata nel cloud.", "Vuoi tornare ai dati di prima?");
    S.data = Object.assign(seed(), sync.conflict.data || {});
    normalizeData();
    sync.rev = sync.conflict.rev; sync.dirty = false; sync.conflict = null;
    setStatus("presa la versione remota"); saveSync(); save(); render();
  }
}

