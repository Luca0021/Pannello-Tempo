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
var sync = {
  provider:"gist", auto:true, rev:0, dirty:false,
  status:"", at:"", busy:false, conflict:null,
  gist:{ token:"", id:"", file:"pannello.json" },
  err:null, prova:null, account:false, ricordami:false,
  fb:{ apiKey:"", projectId:"", email:"", uid:"", refresh:"", idToken:"", expAt:0 }
};
var syncTimer = null;

function loadSync(){
  try {
    var r = localStorage.getItem(SKEY);
    if (r) {
      var o = JSON.parse(r);
      sync.provider = o.provider || "gist";
      sync.auto = o.auto !== false;
      sync.rev = o.rev || 0;
      sync.dirty = !!o.dirty;
      if (o.gist) Object.assign(sync.gist, o.gist);
      if (o.fb) Object.assign(sync.fb, o.fb);
    }
  } catch (e) {}
  sync.busy = false; sync.conflict = null;
}
function saveSync(){
  try {
    localStorage.setItem(SKEY, JSON.stringify({
      provider:sync.provider, auto:sync.auto, rev:sync.rev, dirty:sync.dirty,
      gist:sync.gist, fb:sync.fb
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
function providerName(){ return sync.provider === "gist" ? "GitHub Gist" : "Firebase"; }
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
function controllaCampiFb(ak, pid, email, pw){
  if (!ak) return "Manca la chiave API del progetto.";
  if (/\s/.test(ak)) return "La chiave API contiene spazi: probabilmente è stata incollata male.";
  if (ak.length < 30) return "La chiave API sembra incompleta: di norma supera i trenta caratteri.";
  if (!pid) return "Manca l'identificativo del progetto.";
  if (!/^[a-z0-9-]+$/.test(pid))
    return "L'identificativo del progetto ammette solo minuscole, cifre e trattini: hai forse incollato l'URL o il nome visualizzato?";
  if (!email) return "Manca l'email dell'utente.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "L'email non ha un formato valido.";
  if (!pw) return "Manca la password.";
  if (pw.length < 6) return "La password di Firebase è di almeno sei caratteri.";
  return "";
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

/* --- Gist --- */
function ghHeaders(){
  return { "Authorization":"Bearer "+sync.gist.token,
           "Accept":"application/vnd.github+json",
           "X-GitHub-Api-Version":"2022-11-28",
           "Content-Type":"application/json" };
}
function gistRead(){
  return fetch("https://api.github.com/gists/"+sync.gist.id,
               { headers: ghHeaders(), cache:"no-store" })
    .then(jsonOrThrow)
    .then(function(g){
      var f = g.files && g.files[sync.gist.file];
      if (!f) return "";
      if (f.truncated && f.raw_url)
        return fetch(f.raw_url).then(function(r){ return r.text(); });
      return f.content || "";
    });
}
function gistWrite(text){
  var files = {}; files[sync.gist.file] = { content: text };
  return fetch("https://api.github.com/gists/"+sync.gist.id,
               { method:"PATCH", headers: ghHeaders(),
                 body: JSON.stringify({ files: files }) })
    .then(function(r){ if (!r.ok) throw new Error("HTTP "+r.status); return true; });
}

/* --- Firebase --- */
function fbSignIn(email, password){
  return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+
               encodeURIComponent(sync.fb.apiKey),
               { method:"POST", headers:{ "Content-Type":"application/json" },
                 body: JSON.stringify({ email:email, password:password, returnSecureToken:true }) })
    .then(jsonOrThrow)
    .then(function(d){
      sync.fb.email = email;
      sync.fb.uid = d.localId;
      sync.fb.refresh = d.refreshToken;
      sync.fb.idToken = d.idToken;
      sync.fb.expAt = Date.now() + (parseInt(d.expiresIn,10) || 3600) * 1000 - 60000;
      saveSync();
      return d.idToken;
    });
}
function fbToken(){
  if (sync.fb.idToken && Date.now() < sync.fb.expAt) return Promise.resolve(sync.fb.idToken);
  return fetch("https://securetoken.googleapis.com/v1/token?key="+encodeURIComponent(sync.fb.apiKey),
               { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" },
                 body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(sync.fb.refresh) })
    .then(jsonOrThrow)
    .then(function(d){
      sync.fb.idToken = d.id_token;
      sync.fb.refresh = d.refresh_token || sync.fb.refresh;
      sync.fb.expAt = Date.now() + (parseInt(d.expires_in,10) || 3600) * 1000 - 60000;
      saveSync();
      return sync.fb.idToken;
    });
}
function fbDocUrl(){
  return "https://firestore.googleapis.com/v1/projects/"+encodeURIComponent(sync.fb.projectId)+
         "/databases/(default)/documents/pannello/"+encodeURIComponent(sync.fb.uid);
}
function fbRead(){
  return fbToken().then(function(tok){
    return fetch(fbDocUrl(), { headers:{ "Authorization":"Bearer "+tok }, cache:"no-store" });
  }).then(function(r){
    if (r.status === 404) return "";
    return jsonOrThrow(r).then(function(d){
      return (d.fields && d.fields.payload && d.fields.payload.stringValue) || "";
    });
  });
}
function fbWrite(text){
  return fbToken().then(function(tok){
    return fetch(fbDocUrl()+"?updateMask.fieldPaths=payload",
      { method:"PATCH",
        headers:{ "Authorization":"Bearer "+tok, "Content-Type":"application/json" },
        body: JSON.stringify({ fields:{ payload:{ stringValue: text } } }) });
  }).then(function(r){ if (!r.ok) throw new Error("HTTP "+r.status); return true; });
}

/* PRV-002 — cancellazione REALE del documento remoto.
   Le regole in firebase/firestore.rules concedono `write` al proprietario, e
   `write` comprende `delete`: la cancellazione è quindi permessa dal client
   autenticato, senza bisogno di un backend. Verificato nel contratto, non
   nell'uso: l'esito viene riportato all'utente operazione per operazione. */
function fbDelete(){
  return fbToken().then(function(tok){
    return fetch(fbDocUrl(), { method:"DELETE",
      headers:{ "Authorization":"Bearer "+tok } });
  }).then(function(r){
    /* 404 significa che non c'era nulla: è comunque il risultato voluto */
    if (!r.ok && r.status !== 404) throw new Error("HTTP "+r.status);
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

