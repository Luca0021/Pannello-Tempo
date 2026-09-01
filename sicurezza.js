/* sicurezza.js — validazione dei dati che entrano nel pannello.
   Copre SEC-004 (sanitizzazione), SEC-005 (import di backup) e SEC-006
   (import ICS). Il principio: nulla che arrivi da un file o da un altro
   dispositivo viene creduto sulla parola. */

/* ---------- SEC-005: limiti dell'importazione ---------- */
var LIMITI = {
  backupByte: 8 * 1024 * 1024,     /* 8 MB: un pannello reale sta in poche centinaia di KB */
  icsByte:    4 * 1024 * 1024,
  icsEventi:  500,                 /* oltre, l'anteprima diventa ingestibile */
  voci:       5000,
  testo:      500,                 /* lunghezza massima di un titolo */
  nota:       5000
};

/* Chiavi che, se presenti in un oggetto importato, permetterebbero di
   inquinare il prototipo di Object e cambiare il comportamento del pannello. */
var CHIAVI_VIETATE = ["__proto__", "constructor", "prototype"];

function ripulisciProfondo(v, livello){
  if (livello > 12) return null;                 /* struttura troppo annidata: sospetta */
  if (v === null || typeof v !== "object") {
    if (typeof v === "string" && v.length > LIMITI.nota) return v.slice(0, LIMITI.nota);
    return v;
  }
  if (Array.isArray(v)) {
    return v.slice(0, LIMITI.voci).map(function(x){ return ripulisciProfondo(x, (livello||0)+1); });
  }
  var out = Object.create(null);
  Object.keys(v).forEach(function(k){
    if (CHIAVI_VIETATE.indexOf(k) >= 0) return;   /* scartata senza rumore */
    out[k] = ripulisciProfondo(v[k], (livello||0)+1);
  });
  /* torno a un oggetto normale: Object.create(null) romperebbe JSON.stringify altrove */
  return Object.assign({}, out);
}

/* Legge un backup senza applicarlo: dice cosa contiene e cosa non va. */
function leggiBackup(testo, byte){
  var r = { ok:false, errori:[], avvisi:[], anteprima:null, dati:null };
  if (byte !== undefined && byte > LIMITI.backupByte) {
    r.errori.push("Il file è troppo grande ("+Math.round(byte/1048576)+" MB): il limite è 8 MB.");
    return r;
  }
  var d;
  try { d = JSON.parse(testo); }
  catch (e) { r.errori.push("Il file non è un backup leggibile: non è in formato JSON."); return r; }
  if (!d || typeof d !== "object" || Array.isArray(d)) {
    r.errori.push("Il file non contiene un pannello."); return r;
  }
  /* accetta sia la busta prodotta dall'esportazione sia i dati nudi */
  if (d.formato === "pannello-tempo" && d.dati && typeof d.dati === "object") {
    if (typeof d.schemaVersion === "number" && d.dati.schemaVersion === undefined)
      d.dati.schemaVersion = d.schemaVersion;
    d = d.dati;
  }
  d = normalizzaVersione(d);
  if (!Array.isArray(d.items)) {
    r.errori.push("Manca l'elenco delle attività: questo file non sembra un backup del pannello.");
    return r;
  }
  /* il conteggio va fatto prima della pulizia, che tronca gli elenchi lunghi:
     altrimenti un file smisurato passerebbe silenziosamente, ridotto */
  if (d.items.length > LIMITI.voci) {
    r.errori.push("Il backup contiene "+d.items.length+" attività: oltre "+LIMITI.voci+
                  " non viene importato.");
    return r;
  }
  d = ripulisciProfondo(d, 0);
  var v = versioneDati(d);
  if (v > SCHEMA_ATTUALE)
    r.avvisi.push("Il backup viene da una versione più recente ("+v+"): alcune voci potrebbero non essere lette.");
  var date = d.items.map(function(i){ return i && i.date; }).filter(validKey).sort();
  r.anteprima = {
    versione: v,
    attivita: d.items.length,
    routine: d.items.filter(function(i){ return i && i.freq && i.freq !== "once"; }).length,
    note: Array.isArray(d.capture) ? d.capture.length : 0,
    chiusure: Array.isArray(d.chiusure) ? d.chiusure.length : 0,
    collegamenti: Array.isArray(d.links) ? d.links.length : 0,
    daData: date[0] || null,
    aData: date[date.length-1] || null
  };
  r.dati = d;
  r.ok = true;
  return r;
}

/* Applica il backup, ma solo dopo aver messo al sicuro quello attuale. */
function applicaBackup(dati){
  var esito = { ok:false, motivo:"" };
  var prima = null;
  try { prima = JSON.stringify(S.data); } catch (e) {}
  if (!salvaBackupAutomatico("prima di un'importazione")) {
    esito.motivo = "Non sono riuscito a mettere al sicuro i dati attuali: importazione annullata.";
    return esito;
  }
  try {
    if ((dati.items || []).length > SOGLIE.vociBackup) {
      /* oltre la soglia misurata l'importazione avanza a pezzi: sotto, farlo
         aggiungerebbe complessità senza guadagno percepibile */
      iniziaLavoro("Importazione del backup", dati.items.length, false);
    }
    snapshot("Hai importato un backup al posto dei dati presenti.", "Vuoi annullare l'importazione?");
    S.data = Object.assign(seed(), dati);
    var m2 = migra(S.data, function(t){ REGISTRO_MIGR.push(new Date().toISOString()+" — "+t); });
    S.data = m2.dati;
    normalizeData();
    /* ARC-003: l'intero insieme di dati è cambiato, non una zona */
    S.disegnoCompleto = "dataset-sostituito"; forzaProssimoCompleto();
    registraOperazione("importazione", "backup con "+(dati.items||[]).length+" attività");
    commit();
    if (S.lavoro && S.lavoro.attivo) finisciLavoro({ fatti: (dati.items||[]).length });
    esito.ok = true;
  } catch (e) {
    /* ritorno indietro: i dati di prima non devono andare persi */
    if (prima) { try { S.data = JSON.parse(prima); normalizeData(); save(); } catch (e2) {} }
    if (S.lavoro && S.lavoro.attivo) finisciLavoro({ ok:false, errore:"importazione non riuscita" });
    esito.motivo = "Importazione non riuscita: i dati sono rimasti come erano.";
  }
  return esito;
}

/* ---------- SEC-006: limiti dell'import ICS ---------- */
function controllaIcs(testo, byte){
  if (byte !== undefined && byte > LIMITI.icsByte)
    return { ok:false, motivo:"Il file è troppo grande: il limite è 4 MB." };
  var n = (String(testo||"").match(/BEGIN:VEVENT/g) || []).length;
  if (n > LIMITI.icsEventi)
    return { ok:false, motivo:"Il file contiene "+n+" eventi: oltre "+LIMITI.icsEventi+
             " l'anteprima diventa ingestibile. Esporta un intervallo più corto." };
  return { ok:true, eventi:n };
}

/* ---------- SEC-004: normalizzazione dei campi di testo ---------- */
function testoSicuro(v, max){
  var t = String(v === undefined || v === null ? "" : v);
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");  /* caratteri di controllo */
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");                            /* spazi invisibili */
  return t.slice(0, max || LIMITI.testo).trim();
}

/* ---------- cronologia locale delle operazioni (SEC-005, BCK-003) ---------- */
function registraOperazione(tipo, dettaglio){
  S.data.operazioni = Array.isArray(S.data.operazioni) ? S.data.operazioni : [];
  S.data.operazioni.push({ quando: new Date().toISOString(), tipo: tipo,
                           dettaglio: testoSicuro(dettaglio, 200) });
  if (S.data.operazioni.length > 100) S.data.operazioni = S.data.operazioni.slice(-100);
}

/* ---------- SEC-001: pulizia delle credenziali precedenti ----------
   Le versioni passate del pannello hanno lasciato chiavi nello storage che oggi
   non servono più e che possono contenere token. Vengono rimosse alla prima
   apertura, una volta sola, e l'operazione viene registrata. */

var CHIAVI_LEGACY = [
  "pannello-tempo:token",        /* token GitHub del vecchio flusso */
  "pannello-tempo:gist",
  "pannello-tempo:fb",
  "pannello-tempo:auth",
  "pt-sync", "pt-token", "pannello:sync"
];
var CHIAVE_PULIZIA = "pannello-tempo:pulizia-legacy";

/* Sovrascrive prima di eliminare: su alcuni motori di storage il valore
   resterebbe recuperabile finché lo spazio non viene riusato. */
function eliminaSicuro(chiave){
  try {
    var vecchio = Platform.archivio.leggi(chiave);
    if (vecchio === null || vecchio === undefined) return false;
    Platform.archivio.scrivi(chiave, new Array(Math.min(vecchio.length, 4096) + 1).join("0"));
    Platform.archivio.elimina(chiave);
    /* verifico l'esito invece di darlo per scontato: se la chiave resta, la
       segnalo come non rimossa e il registro lo dichiara */
    var dopo = Platform.archivio.leggi(chiave);
    return dopo === null || dopo === undefined;
  } catch (e) { return false; }
}

function pulisciCredenzialiLegacy(){
  var fatto = [];
  if (Platform.archivio.leggi(CHIAVE_PULIZIA)) return { gia: true, rimosse: [] };
  CHIAVI_LEGACY.forEach(function(k){ if (eliminaSicuro(k)) fatto.push(k); });
  /* nel blocco di sincronizzazione attuale non deve restare la password:
     nessuna versione l'ha mai salvata, ma se un backup importato la portasse
     dentro va tolta comunque */
  try {
    var raw = Platform.archivio.leggi(SKEY);
    if (raw) {
      var o = JSON.parse(raw);
      var sporco = false;
      ["password","pw","pass","secret"].forEach(function(k){
        if (o && o[k] !== undefined) { delete o[k]; sporco = true; }
        if (o && o.fb && o.fb[k] !== undefined) { delete o.fb[k]; sporco = true; }
      });
      if (sporco) { Platform.archivio.scrivi(SKEY, JSON.stringify(o)); fatto.push(SKEY+" (campi sensibili)"); }
    }
  } catch (e) {}
  Platform.archivio.scrivi(CHIAVE_PULIZIA, new Date().toISOString());
  return { gia: false, rimosse: fatto };
}

/* Durata della sessione: dichiarata all'utente invece di essere implicita. */
var DURATA_SESSIONE_MS = 12 * 60 * 60 * 1000;   /* 12 ore */
function sessioneScaduta(){
  if (!sync.fb || !sync.fb.uid) return false;
  var da = sync.fb.inizioSessione || 0;
  if (!da) return false;
  return (Date.now() - da) > DURATA_SESSIONE_MS;
}
function descriviSessione(){
  if (!sync.fb || !sync.fb.uid) return "";
  if (sessioneScaduta()) return "Sessione scaduta: rientra con la password.";
  var da = sync.fb.inizioSessione || Date.now();
  var restano = Math.max(0, DURATA_SESSIONE_MS - (Date.now() - da));
  var ore = Math.floor(restano / 3600000), min = Math.round((restano % 3600000) / 60000);
  return "Sessione valida ancora " + (ore ? ore + "h " : "") + min + " min" +
         (sync.ricordami === false
           ? ". «Resta collegato» è spento: alla chiusura del pannello dovrai rientrare."
           : ". Con «Resta collegato» attivo il pannello conserva un token di rinnovo in questo browser.");
}
