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
    { id:"cloud",       nome:"Dati sul servizio collegato" },
    { id:"credenziali", nome:"Credenziali e sessione" },
    { id:"locali",      nome:"Dati su questo dispositivo" },
    { id:"backup",      nome:"Copie di sicurezza locali" }
  ];
}

function cancellaTutto(ancheCloud, poi){
  var esito = { passi: {}, completo: false, parziale: false };
  function segna(id, ok, nota){
    esito.passi[id] = { ok: !!ok, nota: nota || "" };
  }
  function conclusione(){
    var chiavi = Object.keys(esito.passi);
    var riusciti = chiavi.filter(function(k){ return esito.passi[k].ok; }).length;
    esito.completo = riusciti === chiavi.length;
    esito.parziale = riusciti > 0 && !esito.completo;
    if (poi) poi(esito);
  }

  function locali(){
    /* credenziali prima dei dati: se qualcosa va storto a metà, non deve
       restare una sessione capace di risincronizzare ciò che stiamo togliendo */
    try {
      var r = (typeof esciAccount === "function") ? esciAccount() : { residui: [] };
      segna("credenziali", (r.residui || []).length === 0,
            (r.residui || []).length ? "restano: " + r.residui.join(", ") : "");
    } catch (e) { segna("credenziali", false, String(e && e.message || e)); }

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

    registraOperazione("cancellazione", "cancellazione completa");
    conclusione();
  }

  if (ancheCloud && syncReady()) {
    provider().deleteRemote()
      .then(function(r){
        if (r.ok) segna("cloud", true, "");
        else segna("cloud", false, r.motivo ||
          "il servizio collegato non permette la cancellazione dal dispositivo");
        locali();
      })
      .catch(function(e){
        segna("cloud", false, (e && e.causa) || "non riuscita");
        locali();          /* un fallimento remoto non deve impedire quello locale */
      });
  } else {
    segna("cloud", true, ancheCloud
      ? "nessuna sessione attiva: sul servizio non c'era nulla di tuo"
      : "nessun servizio collegato");
    locali();
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
