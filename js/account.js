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

var CONFIG_ACCOUNT = {
  apiKey: "",        /* da compilare con la chiave web del progetto */
  projectId: "",     /* identificativo del progetto */
  nome: "Account Pannello Tempo"
};

function accountDisponibile(){
  return !!(CONFIG_ACCOUNT.apiKey && CONFIG_ACCOUNT.projectId);
}

/* Registrazione: stesso endpoint dell'accesso, con un'azione diversa. */
function registraAccount(email, password, poi){
  if (!accountDisponibile()) { poi({ errore:"Questa installazione non ha un account configurato." }); return; }
  var problema = controllaCampiFb(CONFIG_ACCOUNT.apiKey, CONFIG_ACCOUNT.projectId, email, password);
  if (problema) { poi({ errore: problema }); return; }
  fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key="+
        encodeURIComponent(CONFIG_ACCOUNT.apiKey), {
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

function entraAccount(email, password, ricordami, poi){
  if (!accountDisponibile()) { poi({ errore:"Questa installazione non ha un account configurato." }); return; }
  fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+
        encodeURIComponent(CONFIG_ACCOUNT.apiKey), {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
  }).then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); })
    .then(function(x){
      if (!x.ok) {
        var msg = (x.d && x.d.error && x.d.error.message) || "accesso non riuscito";
        poi({ errore: dettaglioErrore(new Error(msg)).causa });
        return;
      }
      applicaSessione(x.d, email, ricordami);
      poi({ ok:true });
    })
    .catch(function(e){ poi({ errore: dettaglioErrore(e).causa }); });
}

/* La sessione riusa la macchina di sincronizzazione già esistente: cambia solo
   da dove arrivano chiave e progetto. */
function applicaSessione(d, email, ricordami){
  sync.provider = "firebase";
  sync.account = true;
  sync.fb.apiKey = CONFIG_ACCOUNT.apiKey;
  sync.fb.projectId = CONFIG_ACCOUNT.projectId;
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
  sync.ricordami = false;
  sync.rev = 0; sync.dirty = false;
  saveSync();
}

/* SEC-001: l'uscita non lascia nulla che permetta di rientrare. Non basta
   azzerare l'oggetto in memoria: va riscritto anche ciò che è già su disco,
   e va verificato che non sia rimasto niente. */
function esciAccount(){
  sync.account = false;
  sync.ricordami = false;
  sync.fb = { apiKey:"", projectId:"", email:"", uid:"", refresh:"", idToken:"",
              expAt:0, inizioSessione:0 };
  sync.gist = { id:"", token:"" };
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
function ripulisciTokenPersistenti(){
  var tolti = [];
  try {
    if (sync.fb && sync.fb.refresh) { sync.fb.refresh = ""; tolti.push("sessione in memoria"); }
    if (sync.ricordami) { sync.ricordami = false; tolti.push("preferenza «resta collegato»"); }
    var grezzo = Platform.archivio.leggi(SKEY);
    if (grezzo) {
      var o = JSON.parse(grezzo);
      var cambiato = false;
      if (o && o.fb && o.fb.refresh) { o.fb.refresh = ""; cambiato = true; tolti.push("token su disco"); }
      if (o && o.ricordami) { o.ricordami = false; cambiato = true; }
      if (cambiato) Platform.archivio.scrivi(SKEY, JSON.stringify(o));
    }
  } catch (e) { /* dati illeggibili: non c'è token da togliere */ }
  if (tolti.length) saveSync();
  return { tolti: tolti, quanti: tolti.length };
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

/* Le regole da pubblicare una volta sola nel progetto: senza queste, chiunque
   potrebbe leggere i dati di chiunque. */
var REGOLE_ACCOUNT =
"rules_version = '2';\n"+
"service cloud.firestore {\n"+
"  match /databases/{database}/documents {\n"+
"    match /pannello/{uid} {\n"+
"      allow read, write: if request.auth != null && request.auth.uid == uid;\n"+
"    }\n"+
"  }\n"+
"}";
