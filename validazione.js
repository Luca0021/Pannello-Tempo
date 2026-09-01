/* validazione.js — TSK-002: controlli sulla creazione e modifica di un task.

   Prima il pannello accettava qualunque cosa: un titolo vuoto, cinquecento
   caratteri, una durata di zero, un blocco che cominciava alle 23:45 e durava
   tre ore. Nessuno di questi casi rompeva il pannello, ma tutti producevano
   voci che poi l'utente doveva sistemare a mano.

   Due principi:
   1. Il messaggio dice che cosa fare, non che cosa è sbagliato, ed è agganciato
      al campo che lo riguarda: «Errore di validazione» in cima non aiuta.
   2. Un errore non fa perdere quello che è stato scritto. La funzione restituisce
      i valori normalizzati insieme agli errori, così il modulo si ridisegna
      pieno di ciò che l'utente aveva messo. */

var LIMITI_TASK = {
  titoloMin: 1,
  titoloMax: 200,
  durataMin: 0.25,        /* un quarto d'ora: sotto, il blocco non si vede */
  durataMax: 12,
  notaMax: 5000,
  etichettaMax: 40,
  annoMin: 2000,
  annoMax: 2100
};

function errore(campo, messaggio){ return { campo: campo, messaggio: messaggio }; }

/* Restituisce { ok, errori[], valori } — sempre tutti e tre. */
function validaTask(dati, opzioni){
  opzioni = opzioni || {};
  var e = [], v = {};

  /* --- titolo --- */
  var titolo = testoSicuro(dati.label, LIMITI_TASK.titoloMax);
  if (!titolo)
    e.push(errore("label", "Scrivi che cosa devi fare."));
  else if (String(dati.label || "").length > LIMITI_TASK.titoloMax)
    e.push(errore("label", "Titolo troppo lungo: al massimo " + LIMITI_TASK.titoloMax +
                  " caratteri. I dettagli stanno meglio nella nota."));
  v.label = titolo;

  /* --- area --- */
  v.area = (dati.area === "vita") ? "vita" : "lavoro";
  if (dati.area && dati.area !== "vita" && dati.area !== "lavoro")
    e.push(errore("area", "Scegli fra lavoro e vita."));

  /* --- ricorrenza --- */
  var freqValide = FREQS.map(function(f){ return f.id; });
  v.freq = freqValide.indexOf(dati.freq) >= 0 ? dati.freq : "daily";
  if (dati.freq && freqValide.indexOf(dati.freq) < 0)
    e.push(errore("freq", "Ricorrenza non riconosciuta."));

  /* la ricorrenza deve avere i propri dati: una settimanale senza giorni non
     ricorre mai, e sparirebbe senza spiegazione */
  if (v.freq === "weekly") {
    var gg = Array.isArray(dati.days) ? dati.days.filter(function(d){
      return typeof d === "number" && d >= 0 && d <= 6;
    }) : [];
    if (!gg.length) e.push(errore("days", "Scegli almeno un giorno della settimana."));
    v.days = gg;
  }
  if (v.freq === "monthly") {
    var dm = parseInt(dati.dom, 10);
    /* 0 significa «ultimo giorno». Il 29, 30 e 31 sono ammessi: il motore li
       riporta all'ultimo giorno nei mesi che non li hanno, e rifiutarli qui
       renderebbe la validazione più severa del comportamento reale — cioè
       impedirebbe qualcosa che il pannello sa già fare bene. */
    if (isNaN(dm) || dm < 0 || dm > 31)
      e.push(errore("dom", "Scegli un giorno del mese fra 1 e 31, oppure «ultimo giorno»."));
    else v.dom = dm;
  }
  if (v.freq === "once") {
    if (!validKey(dati.date))
      e.push(errore("date", "Scegli una data valida."));
    else if (!annoPlausibile(dati.date))
      e.push(errore("date", "Anno fuori intervallo: controlla la data."));
    else v.date = dati.date;
  }

  /* --- orario e durata --- */
  var haOra = dati.start !== undefined && dati.start !== null && dati.start !== "";
  if (haOra) {
    var st = parseFloat(dati.start);
    if (isNaN(st) || st < 0 || st >= 24)
      e.push(errore("start", "L'orario deve stare fra 00:00 e 23:59."));
    else {
      v.start = st;
      var du = (dati.dur === undefined || dati.dur === null || dati.dur === "")
        ? 0.5 : parseFloat(dati.dur);
      if (isNaN(du) || du < LIMITI_TASK.durataMin)
        e.push(errore("dur", "La durata minima è un quarto d'ora."));
      else if (du > LIMITI_TASK.durataMax)
        e.push(errore("dur", "Durata oltre le " + LIMITI_TASK.durataMax +
                      " ore: se dura tanto, conviene dividerla."));
      else if (st + du > 24)
        e.push(errore("dur", "Il blocco finirebbe dopo la mezzanotte: "+
                      "riduci la durata o anticipa l'inizio."));
      else v.dur = du;
    }
  } else if (dati.dur !== undefined && dati.dur !== null && dati.dur !== "") {
    e.push(errore("start", "Hai messo una durata senza un orario di inizio."));
  }

  /* --- scadenza --- */
  if (dati.due) {
    if (!validKey(dati.due)) e.push(errore("due", "Scadenza non valida."));
    else if (!annoPlausibile(dati.due)) e.push(errore("due", "Anno della scadenza fuori intervallo."));
    else if (!opzioni.permettiPassato && dati.due < dk())
      e.push(errore("due", "La scadenza è già passata: scegli una data da oggi in poi."));
    else v.due = dati.due;
  }

  /* --- campi liberi --- */
  if (dati.tag !== undefined) v.tag = testoSicuro(dati.tag, LIMITI_TASK.etichettaMax);
  if (dati.note !== undefined) {
    if (String(dati.note || "").length > LIMITI_TASK.notaMax)
      e.push(errore("note", "Nota troppo lunga: al massimo " + LIMITI_TASK.notaMax + " caratteri."));
    v.note = testoSicuro(dati.note, LIMITI_TASK.notaMax);
  }
  if (dati.place !== undefined) v.place = testoSicuro(dati.place, 200);

  return { ok: e.length === 0, errori: e, valori: v };
}

function annoPlausibile(key){
  var a = parseInt(String(key).slice(0, 4), 10);
  return a >= LIMITI_TASK.annoMin && a <= LIMITI_TASK.annoMax;
}

/* Il messaggio del campo, se c'è. Serve a mostrarlo accanto al campo. */
function erroreDi(errori, campo){
  var t = (errori || []).filter(function(x){ return x.campo === campo; })[0];
  return t ? t.messaggio : "";
}
function segnalaCampo(errori, campo){
  var msg = erroreDi(errori, campo);
  if (!msg) return "";
  return '<p class="errcampo" role="alert" id="err-'+esc(campo)+'">'+esc(msg)+'</p>';
}
