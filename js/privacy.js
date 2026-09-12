/* privacy.js — centro privacy, esportazione portabile, cancellazione (PRV-001/002/003).
   Regola: le funzioni che servono a controllare i propri dati non stanno mai
   dietro un pagamento. */

/* ---------- PRV-003: esportazione portabile ---------- */
function esportaJson(){
  var copia = JSON.parse(JSON.stringify(S.data));
  /* nessuna credenziale nell'esportazione */
  delete copia.syncMeta;
  /* la busta porta `schemaVersion` per leggibilità; i dati dentro portano `v`,
     che resta il campo canonico. I due coincidono sempre per costruzione. */
  copia.v = SCHEMA_ATTUALE;
  return JSON.stringify({
    formato: "pannello-tempo", schemaVersion: SCHEMA_ATTUALE, versioneApp: BUILD.app,
    esportatoIl: new Date().toISOString(), dati: copia
  }, null, 2);
}

function csvCampo(v){
  var t = String(v === undefined || v === null ? "" : v);
  return '"' + t.replace(/"/g, '""') + '"';
}
function esportaCsv(){
  var col = ["id","titolo","area","ricorrenza","data","ora","durata_min","etichetta",
             "scadenza","completata","completata_il","in_attesa","bloccato_da","luogo","nota"];
  var righe = [col.join(",")];
  S.data.items.forEach(function(i){
    righe.push([
      i.id, i.label, AREAS[i.area] ? AREAS[i.area].label : i.area,
      (FREQS.filter(function(f){ return f.id === i.freq; })[0] || {}).every || i.freq,
      i.date || "", (typeof i.start === "number") ? fmt(i.start) : "",
      (typeof i.start === "number") ? Math.round((i.dur||0.5)*60) : "",
      i.tag || "", i.due || "", isOn(i) ? "sì" : "no", S.data.doneAt[i.id] || "",
      i.waiting ? "sì" : "no", i.bloccatoDa || "", i.place || "", i.note || ""
    ].map(csvCampo).join(","));
  });
  return "\ufeff" + righe.join("\r\n");   /* BOM: Excel legge gli accenti */
}
function esportaIcsTutto(){
  var conOrario = S.data.items.filter(function(i){ return typeof i.start === "number"; });
  return buildIcs(conOrario, new Date(), 90, "0");
}

/* ---------- PRV-002: cancellazione ---------- */
function cancellaCronologia(){
  salvaBackupAutomatico("prima della cancellazione della cronologia");
  snapshot("Hai cancellato la cronologia di completamenti, chiusure e analisi.",
           "Vuoi annullare la cancellazione?");
  S.data.chiusure = []; S.data.revisioni = []; S.data.completamenti = [];
  S.data.log = {}; S.data.rinvii = {}; S.data.archive = []; S.data.operazioni = [];
  registraOperazione("cancellazione", "cronologia");
  commit();
  return { ok:true };
}

/* Cancellazione completa: dati locali, credenziali, copie di sicurezza.
   Il cloud viene toccato solo se c'è una sessione valida; se fallisce, lo
   diciamo invece di far credere che sia andato tutto bene. */
/* PRV-002 — cancellazione completa, passaggio per passaggio.

   Ogni passaggio riporta il proprio esito: se il cloud fallisce ma il locale
   riesce, l'utente deve saperlo. Un «fatto» complessivo che nasconde un
   fallimento parziale è peggio di un errore dichiarato.

   L'autenticazione recente è richiesta perché la cancellazione è irreversibile:
   chi trova il dispositivo aperto non deve poterla eseguire. */

var FINESTRA_AUTENTICAZIONE_MS = 15 * 60 * 1000;   /* 15 minuti */

function autenticazioneRecente(){
  if (!sync.fb || !sync.fb.uid) return true;      /* nessuna sessione: nulla da proteggere */
  var da = sync.fb.inizioSessione || 0;
  if (!da) return false;
  return (Date.now() - da) < FINESTRA_AUTENTICAZIONE_MS;
}
function minutiDaAutenticazione(){
  if (!sync.fb || !sync.fb.inizioSessione) return null;
  return Math.floor((Date.now() - sync.fb.inizioSessione) / 60000);
}

function PASSI_CANCELLAZIONE(){
  return [
    { id:"cloud",       nome:"Dati nel tuo account" },
    { id:"verifica",    nome:"Verifica che non siano più leggibili" },
    { id:"account",     nome:"Account di accesso" },
    { id:"coda",        nome:"Modifiche in attesa e conflitti" },
    { id:"credenziali", nome:"Credenziali e sessione" },
    { id:"locali",      nome:"Dati su questo dispositivo" },
    { id:"backup",      nome:"Copie di sicurezza locali" }
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
   PRV-002 — ELIMINAZIONE DELL'ACCOUNT DI ACCESSO

   Separata dalla cancellazione dei dati, perché sono due cose diverse e
   possono fallire indipendentemente: si può riuscire a cancellare i dati e
   non l'account, e dire «fatto» sarebbe falso.

   Firebase richiede un'autenticazione recente per eliminare un account. Se
   la sessione è vecchia, l'API risponde `CREDENTIAL_TOO_OLD_LOGIN_AGAIN` e
   NON si finge che sia andata: si chiede la password e si riprova.
   ───────────────────────────────────────────────────────────────────────── */
function eliminaAccountAuth(){
  /* Senza sessione non c'è un account da eliminare: è «niente da fare», non
     un fallimento. Segnalarlo come fallito faceva comparire «Una parte non è
     riuscita» su un'operazione che non aveva nulla da compiere. */
  if (!sync.fb.idToken)
    return Promise.resolve({ ok:true, nonApplicabile:true, riautenticare:false,
      motivo:"Nessuna sessione attiva: non c'era un account di accesso da eliminare." });
  vietaProduzioneNeiTest();
  return fetch(endpointIdentity()+"/accounts:delete?key="+
               encodeURIComponent(FIREBASE_CONFIG.apiKey), {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ idToken: sync.fb.idToken })
  }).then(function(r){
    return r.json().then(function(d){ return { ok:r.ok, d:d }; });
  }).then(function(x){
    if (x.ok) return { ok:true };
    var msg = (x.d && x.d.error && x.d.error.message) || "";
    if (/CREDENTIAL_TOO_OLD_LOGIN_AGAIN|TOKEN_EXPIRED|INVALID_ID_TOKEN/.test(msg))
      return { ok:false, riautenticare:true,
        motivo:"Per eliminare l'account serve la password: è un'operazione irreversibile "+
               "e non deve poterla fare chi trova il dispositivo aperto." };
    if (/USER_NOT_FOUND/.test(msg))
      return { ok:true, motivo:"L'account non esisteva più." };
    return { ok:false, riautenticare:false,
      motivo: dettaglioErrore(new Error(msg)).causa };
  }).catch(function(e){
    return { ok:false, riautenticare:false, motivo: dettaglioErrore(e).causa };
  });
}

/* Verifica che i dati remoti non siano più leggibili.
   Non è pignoleria: `DELETE` può restituire 200 e lasciare il documento
   raggiungibile per un istante, o cancellare un percorso e non l'altro.
   Dire «cancellato» senza aver riletto è dire una cosa che non si sa. */
function verificaCancellazioneRemota(){
  if (typeof fbLeggiDoc !== "function" || !sync.fb.uid)
    return Promise.resolve({ ok:false, motivo:"Non verificabile: nessuna sessione." });
  return fbLeggiDoc(fbDocUrl()).then(function(t){
    if (t && t.trim())
      return { ok:false, motivo:"Il documento è ancora leggibile: la cancellazione non è completa." };
    return fbLeggiDoc(fbDocUrlLegacy()).then(function(v){
      if (v && v.trim())
        return { ok:false, motivo:"Il documento del percorso precedente è ancora leggibile." };
      return { ok:true };
    }, function(){ return { ok:true }; });
  }, function(e){
    /* Un errore di lettura DOPO la cancellazione è il risultato atteso:
       il documento non c'è più. Ma lo distinguiamo da un successo pieno,
       perché potrebbe anche essere un problema di rete. */
    var m = String((e && (e.tecnico || e.message)) || e || "");
    if (/404|NOT_FOUND/.test(m)) return { ok:true };
    return { ok:false, motivo:"Non è stato possibile verificare: "+
             ((e && e.causa) || "la rilettura non ha risposto")+"." };
  });
}

/* `opzioni`: { cloud, account, locali }
   Tre scelte indipendenti, perché sono tre decisioni diverse: eliminare i
   dati cloud tenendo l'account, eliminare tutto, o pulire solo questo
   dispositivo. Un unico interruttore costringerebbe a scegliere fra
   troppo e troppo poco. */
function cancellaTutto(opzioni, poi){
  /* compatibilità: la firma precedente era (ancheCloud, poi) */
  if (typeof opzioni === "boolean") opzioni = { cloud: opzioni, account: false, locali: true };
  var o = Object.assign({ cloud:false, account:false, locali:true }, opzioni || {});
  var esito = { passi: {}, completo: false, parziale: false, riautenticare: false,
                nullaDaFare: false, accountNonToccato: false };
  /* `nonApplicabile` distingue «riuscito» da «non c'era niente da fare». Sono
     due cose diverse e prima erano la stessa: vedi i due difetti corretti qui
     sotto, che nascono entrambi da questa mancanza. */
  function segna(id, ok, nota, nonApplicabile){
    esito.passi[id] = { ok: !!ok, nota: nota || "", nonApplicabile: !!nonApplicabile };
  }
  function conclusione(){
    var chiavi = Object.keys(esito.passi);
    var riusciti = chiavi.filter(function(k){ return esito.passi[k].ok; }).length;
    esito.completo = riusciti === chiavi.length;
    esito.parziale = riusciti > 0 && !esito.completo;
    /* «Non c'era niente da eliminare» non è «Fatto.»: dirlo «fatto» farebbe
       credere a una cancellazione che non è avvenuta. Vale quando TUTTI i
       passi che l'azione richiedeva erano non applicabili. */
    var richiesti = [];
    if (o.cloud) richiesti.push("cloud");
    if (o.account) richiesti.push("account");
    if (o.locali) richiesti.push("locali");
    esito.nullaDaFare = esito.completo && richiesti.length > 0 &&
      richiesti.every(function(k){ return esito.passi[k] && esito.passi[k].nonApplicabile; });
    if (poi) poi(esito);
  }

  function locali(){
    /* la coda e i conflitti prima delle credenziali: se restassero, una
       riconnessione futura tenterebbe di reinviare ciò che stiamo togliendo */
    try {
      if (typeof svuotaCoda === "function") svuotaCoda();
      S.conflitti = null; S.datiFusi = null; S.attivazioneSync = null; S.migrazione = null;
      if (typeof azzeraIstantanea === "function") azzeraIstantanea();
      segna("coda", true, "");
    } catch (e) { segna("coda", false, String(e && e.message || e)); }

    /* credenziali prima dei dati: se qualcosa va storto a metà, non deve
       restare una sessione capace di risincronizzare ciò che stiamo togliendo */
    try {
      var r = (typeof esciAccount === "function") ? esciAccount(true) : { residui: [] };
      var resti = (r.residui || []).concat(r.sentinelle || []);
      segna("credenziali", resti.length === 0,
            resti.length ? "restano: " + resti.join(", ") : "");
    } catch (e) { segna("credenziali", false, String(e && e.message || e)); }

    if (o.locali) {
      try {
        var okDati = eliminaSicuro(KEY);
        segna("locali", okDati, okDati ? "" : "la chiave dei dati non è stata rimossa");
      } catch (e) { segna("locali", false, String(e && e.message || e)); }
      try {
        var b1 = eliminaSicuro(CHIAVE_BACKUP_AUTO);
        var b2 = eliminaSicuro(CHIAVE_BACKUP);
        /* una copia che non c'era non è un fallimento */
        segna("backup", true, (b1 || b2) ? "" : "non c'erano copie da rimuovere");
      } catch (e) { segna("backup", false, String(e && e.message || e)); }
    } else {
      segna("locali", true, "conservati su tua richiesta");
      segna("backup", true, "conservate su tua richiesta");
    }

    /* nel diario: che cosa, non che cosa conteneva */
    registraOperazione("cancellazione",
      "cloud:"+(o.cloud?"sì":"no")+" account:"+(o.account?"sì":"no")+" locali:"+(o.locali?"sì":"no"));
    conclusione();
  }

  /* passo 3: l'account di accesso, dopo i dati.
     L'ordine conta: eliminando prima l'account si perde il token con cui
     cancellare i dati, e restano orfani nel database. */
  function passoAccount(){
    if (!o.account) { locali(); return; }
    /* DIFETTO CORRETTO — l'account veniva eliminato anche quando i dati
       remoti NON erano stati cancellati.

       L'ordine dati-poi-account era già giusto e per il motivo giusto:
       eliminando prima l'account si perde il token con cui cancellare i
       dati. Mancava però la conseguenza di quell'ordine: se il passo
       `cloud` fallisce, o la verifica non conferma, i dati restano nel
       database — e l'account è l'UNICA chiave per raggiungerli. Eliminarlo
       lo stesso produce l'esito peggiore possibile di questa schermata:
       dati che esistono e che nessuno, nemmeno chi li ha scritti, può più
       leggere o cancellare.

       Non è un fallimento del passo: è una decisione, e come tale viene
       detta. Se la cancellazione remota non era stata chiesta, o non era
       applicabile perché non c'è una sessione, la guardia non scatta. */
    var c = esito.passi.cloud, v = esito.passi.verifica;
    if (o.cloud && c && !c.nonApplicabile && (!c.ok || !v || !v.ok)) {
      esito.accountNonToccato = true;
      segna("account", false,
        "Non eliminato di proposito: i dati nel tuo account non risultano cancellati, "+
        "e senza l'account non ci sarebbe più modo di raggiungerli. Riprova quando la "+
        "cancellazione dei dati sarà riuscita.");
      locali(); return;
    }
    eliminaAccountAuth().then(function(r){
      segna("account", r.ok, r.motivo || "", !!r.nonApplicabile);
      if (r.riautenticare) esito.riautenticare = true;
      locali();
    });
  }

  /* passo 2: la verifica. Dire «cancellato» senza aver riletto è dire una
     cosa che non si sa. */
  function passoVerifica(){
    var c = esito.passi.cloud;
    /* DIFETTO CORRETTO — la verifica falliva quando non c'era niente da
       verificare. La guardia controllava `cloud.ok`, ma il ramo «nessuna
       sessione attiva» segna `cloud` come RIUSCITO: si andava quindi a
       rileggere un documento che non esiste, in un account che non c'è, e
       `verificaCancellazioneRemota` rispondeva «Non verificabile: nessuna
       sessione.». Misurato: «Elimina i dati dal tuo account» senza sessione
       riportava «Una parte non è riuscita», cioè un allarme su
       un'operazione che non aveva niente da fare. In un'area dove un
       fallimento dichiarato deve significare qualcosa, un falso allarme
       costa quanto un falso successo. */
    if (!o.cloud || !c || !c.ok || c.nonApplicabile) {
      segna("verifica", true, "non applicabile", true);
      passoAccount(); return;
    }
    verificaCancellazioneRemota().then(function(v){
      segna("verifica", v.ok, v.motivo || "");
      passoAccount();
    });
  }

  if (o.cloud && syncReady()) {
    provider().deleteRemote()
      .then(function(r){
        if (r.ok) segna("cloud", true, "");
        else segna("cloud", false, r.motivo ||
          "il servizio collegato non permette la cancellazione dal dispositivo");
        passoVerifica();
      })
      .catch(function(e){
        segna("cloud", false, (e && e.causa) || "non riuscita");
        /* un fallimento remoto non deve impedire quello locale, ma non deve
           nemmeno essere nascosto: resta segnato come fallito */
        passoVerifica();
      });
  } else {
    segna("cloud", true, o.cloud
      ? "nessuna sessione attiva: nel tuo account non c'era nulla da cancellare da qui"
      : "non richiesto", true);
    passoVerifica();
  }
}

/* ---------- PRV-004: analisi personali trasparenti ---------- */
function analisiAttive(){ return pref("analisiAttive") !== false; }
function datiUsatiDalleAnalisi(){
  return [
    { nome:"Registro delle routine", cosa:"Se hai fatto o saltato una routine, giorno per giorno, negli ultimi 14 giorni.",
      quante: Object.keys(S.data.log || {}).length },
    { nome:"Orari di completamento", cosa:"A che ora hai spuntato una voce, rispetto all'orario che le avevi dato.",
      quante: (S.data.completamenti || []).length },
    { nome:"Chiusure di giornata", cosa:"Minuti pianificati per area e quante priorità hai completato.",
      quante: (S.data.chiusure || []).length },
    { nome:"Ripianificazioni", cosa:"Quante volte hai spostato a domani la stessa voce.",
      quante: Object.keys(S.data.rinvii || {}).length }
  ];
}
