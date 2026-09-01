/* ics-import.js — importazione di un file .ics.
   Funziona senza server: il file viene letto sul dispositivo. La
   sincronizzazione bidirezionale con Google o Microsoft richiede OAuth e un
   backend che non esistono qui, e non viene simulata. */

function srotolaIcs(testo){
  /* le righe lunghe dell'ICS proseguono con uno spazio iniziale */
  return String(testo || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}
function decodificaIcs(v){
  return String(v || "").replace(/\\n/gi, " ").replace(/\\,/g, ",")
    .replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}
function dataIcs(v){
  var m2 = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(String(v||"").replace(/^.*:/, ""));
  if (!m2) return null;
  return { key: m2[1]+"-"+m2[2]+"-"+m2[3],
           ora: m2[4] !== undefined ? (parseInt(m2[4],10) + parseInt(m2[5],10)/60) : null };
}

/* Legge gli eventi senza importare niente: prima si guarda, poi si sceglie. */
function leggiIcs(testo){
  var righe = srotolaIcs(testo).split("\n");
  var eventi = [], cur = null, errori = 0;
  righe.forEach(function(r){
    var t = r.trim();
    if (t === "BEGIN:VEVENT") { cur = {}; return; }
    if (t === "END:VEVENT") {
      if (cur && cur.titolo && cur.inizio) eventi.push(cur); else if (cur) errori++;
      cur = null; return;
    }
    if (!cur) return;
    var i = t.indexOf(":");
    if (i < 0) return;
    var chiave = t.slice(0, i).split(";")[0].toUpperCase();
    var val = t.slice(i + 1);
    if (chiave === "SUMMARY") cur.titolo = decodificaIcs(val);
    else if (chiave === "DTSTART") { var d = dataIcs(t); if (d) { cur.inizio = d.key; cur.ora = d.ora; } }
    else if (chiave === "DTEND")   { var f = dataIcs(t); if (f) { cur.fine = f.key; cur.oraFine = f.ora; } }
    else if (chiave === "LOCATION") cur.luogo = decodificaIcs(val);
    else if (chiave === "UID") cur.uid = val.trim();
    else if (chiave === "RRULE") cur.ricorrente = true;
  });
  eventi.forEach(function(e){
    e.durata = (e.ora !== null && e.oraFine !== null && e.oraFine !== undefined && e.oraFine > e.ora)
      ? Math.round((e.oraFine - e.ora) * 4) / 4 : 1;
    e.esisteGia = esisteEvento(e);
    e.area = "lavoro";
    e.scelto = !e.esisteGia;
  });
  return { eventi: eventi, scartati: errori };
}

/* Un evento già presente non va reimportato: confronto su identificativo,
   oppure su titolo e data. */
function esisteEvento(e){
  return S.data.items.some(function(i){
    if (i.icsUid && e.uid && i.icsUid === e.uid) return true;
    return i.freq === "once" && i.date === e.inizio && normTxt(i.label) === normTxt(e.titolo);
  });
}

function importaEventi(eventi){
  var scelti = (eventi || []).filter(function(e){ return e.scelto && !e.esisteGia; });
  if (!scelti.length) return { creati: 0, saltati: (eventi||[]).length };
  snapshot("Hai importato "+scelti.length+" eventi dal calendario.",
           "Vuoi annullare l'importazione?");
  scelti.forEach(function(e){
    var o = { id: uid(), label: e.titolo, area: e.area === "vita" ? "vita" : "lavoro",
              freq: "once", date: e.inizio };
    if (e.ora !== null && e.ora !== undefined) { o.start = e.ora; o.dur = e.durata; }
    if (e.luogo) o.place = e.luogo;
    if (e.uid) o.icsUid = e.uid;
    S.data.items.push(o);
  });
  normalizeData();
  commit();
  return { creati: scelti.length, saltati: (eventi||[]).length - scelti.length };
}

/* Adattatore per una futura integrazione con account esterni. Dichiara ciò che
   serve invece di fingere che funzioni. */
var CalendarioEsterno = {
  disponibile: function(){ return false; },
  requisiti: "Serve una registrazione applicativa OAuth presso Google o Microsoft, "+
             "un backend che custodisca il segreto client e il rinnovo dei token. "+
             "Nessuno dei tre esiste in questa installazione.",
  collega: function(){ return { esito:"non-disponibile", motivo: CalendarioEsterno.requisiti }; }
};
