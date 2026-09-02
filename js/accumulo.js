/* accumulo.js — REC-005: accorgersi di ciò che si accumula in silenzio.

   Il pannello conta i rinvii da sempre e non ne ha mai fatto niente. Intanto
   succede questo: una voce viene spostata a domani, poi ancora, poi ancora, e
   dopo sei settimane è ancora lì. Nessuno l'ha mai decisa — è stata solo
   rimandata, una volta al giorno, senza che nessuno se ne accorgesse.

   Questo modulo non aggiunge un altro elenco da guardare. Fa una domanda sola,
   sulla voce che se la merita di più, e la fa solo quando c'è una risposta
   utile da dare.

   La regola che tiene tutto insieme: **rimandare non è un errore.** Rimandare
   una cosa venti volte senza accorgersene sì. La differenza non è nel numero
   ma nel fatto che nessuno l'ha mai guardata. */

var SOGLIA_RINVII = 4;        /* sotto, rimandare è normale */
var SOGLIA_GIORNI_FERMA = 21; /* una voce senza data che sta lì da tre settimane */

function rinviiDi(id){ return (S.data.rinvii || {})[id] || 0; }

/* Da quanto una voce sta nel pannello senza essere stata completata.

   `creatoIl` viene ora timbrato da `normalizeData()` in js/state.js: prima non
   lo scriveva nessuno e questa funzione restituiva 0 su qualunque voce, il che
   rendeva irraggiungibile il ramo «ferma» di `inAccumulo()`.

   La data dell'ultima modifica resta come ripiego per i dati che arrivano da
   un backup vecchio, ma è un ripiego e non un equivalente: `mod` si sposta a
   ogni modifica, quindi una voce ritoccata ieri risulterebbe nata ieri. Con
   `creatoIl` presente non viene mai usata. */
function giorniInSospeso(i){
  if (!i) return 0;
  var da = i.creatoIl || (S.data.versioni && S.data.versioni[i.id] && S.data.versioni[i.id].mod);
  if (!da) return 0;
  var d = new Date(da);
  if (isNaN(d.getTime())) return 0;
  var ora = (S.now instanceof Date) ? S.now.getTime() : Date.now();
  return Math.max(0, Math.round((ora - d.getTime()) / 86400000));
}

/* Le voci che si stanno accumulando, con il motivo. Ordinate per gravità:
   davanti quella che è stata rimandata di più. */
function inAccumulo(){
  var out = [];
  (S.data.items || []).forEach(function(i){
    if (!i || isOn(i) || isWaiting(i)) return;
    if (eRoutine(i)) return;          /* una routine non si accumula, per costruzione */
    var r = rinviiDi(i.id);
    var g = giorniInSospeso(i);
    if (r >= SOGLIA_RINVII)
      out.push({ item:i, rinvii:r, giorni:g, motivo:"rimandata",
                 testo:"L'hai rimandata " + r + " volte." });
    /* DIFETTO CORRETTO — questo ramo non poteva scattare.

       La condizione era `!validKey(i.date)`: una voce singola senza una data
       valida. Ma `normalizeData()` in js/state.js contiene la riga

         if (i.freq === "once" && !validKey(i.date)) i.date = dayKey(new Date());

       e gira a ogni caricamento e dopo ogni modifica. Quello stato non esiste
       mai: la condizione era falsa per costruzione, non per i dati. Insieme a
       `giorniInSospeso()` che restituiva sempre 0, metà di REC-005 era codice
       che non si eseguiva.

       Ciò che si può davvero riconoscere è una voce singola aperta da tre
       settimane per cui nessuno ha mai spostato la data avanti: la data c'è,
       ma non è una decisione, è il giorno in cui è stata scritta. Il testo
       dice adesso quello che il pannello sa, invece di parlare di una data
       mancante che non può mancare. */
    else if (i.freq === "once" && g >= SOGLIA_GIORNI_FERMA &&
             String(i.date || "") <= dk())
      out.push({ item:i, rinvii:r, giorni:g, motivo:"ferma",
                 testo:"È qui da " + g + " giorni e non l'hai mai programmata." });
  });
  out.sort(function(a, b){ return (b.rinvii - a.rinvii) || (b.giorni - a.giorni); });
  return out;
}

/* La domanda da fare adesso: una sola, sulla voce messa peggio.
   Chiedere di dieci voci insieme è un altro elenco, e gli elenchi sono
   esattamente il problema che stiamo cercando di evitare. */
function domandaAccumulo(){
  if (pref("accumuloSpento")) return null;
  var elenco = inAccumulo();
  if (!elenco.length) return null;
  var scelta = elenco[0];
  /* non richiedere sulla stessa voce lo stesso giorno */
  var visto = (S.data.chiestoAccumulo || {})[scelta.item.id];
  if (visto === dk()) return null;
  return {
    item: scelta.item,
    testo: scelta.testo,
    motivo: scelta.motivo,
    quante: elenco.length,
    domanda: scelta.motivo === "rimandata"
      ? "La fai davvero, o è ora di lasciarla andare?"
      : "Le dai una data, o non serviva?"
  };
}

function segnaChiesto(id){
  S.data.chiestoAccumulo = S.data.chiestoAccumulo || {};
  S.data.chiestoAccumulo[id] = dk();
}

/* Le tre risposte possibili. «Ci penso ancora» esiste perché a volte è la
   verità, e togliere quella scelta costringerebbe a mentire. */
function rispondiAccumulo(id, risposta){
  var it = itemById(id);
  if (!it) return { ok:false };
  segnaChiesto(id);
  if (risposta === "archivia") {
    snapshot("Hai lasciato andare «"+it.label+"».", "Vuoi rimetterla?");
    S.data.archive = Array.isArray(S.data.archive) ? S.data.archive : [];
    S.data.archive.push(Object.assign({}, it, { archiviatoIl:new Date().toISOString(),
                                                motivoArchivio:"rimandata "+rinviiDi(id)+" volte" }));
    S.data.items = S.data.items.filter(function(x){ return x.id !== id; });
    ripulisciRiferimenti(id);
    commit();
    return { ok:true, testo:"Archiviata. La ritrovi dalla ricerca." };
  }
  if (risposta === "oggi") {
    /* azzero il contatore: la decisione l'hai presa, il conto riparte */
    if (S.data.rinvii) delete S.data.rinvii[id];
    patch(id, it.freq === "once" ? { date: dk() } : { due: dk() });
    commit();
    return { ok:true, testo:"Messa per oggi. Il conto dei rinvii riparte." };
  }
  commit();
  return { ok:true, testo:"Va bene, te lo richiedo un'altra volta." };
}

function spegniAccumulo(){ setImp("accumuloSpento", true); }
