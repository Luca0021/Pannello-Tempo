/* arretrati.js — REC-003: gestione massiva degli arretrati.

   Con quaranta voci in ritardo la sezione diventava un muro: quaranta righe,
   quaranta volte le stesse cinque decisioni, una per una. Chi torna da una
   settimana di ferie non ha bisogno di decidere quaranta volte, ha bisogno di
   decidere una volta su quaranta cose.

   Due aggiunte:
     1. una selezione, con le stesse azioni applicate a tutte le voci scelte;
     2. un raggruppamento per età, perché «di ieri» e «di tre settimane fa»
        meritano decisioni diverse. */

var SOGLIA_ELENCO = 12;      /* oltre, l'elenco si accorcia e offre «mostra tutti» */

/* Le fasce d'età, dalla più recente. La suddivisione non è estetica: serve a
   far vedere che le cose vecchie sono vecchie. */
function fasciaEta(giorni){
  if (giorni <= 1) return "ieri";
  if (giorni <= 7) return "settimana";
  if (giorni <= 30) return "mese";
  return "oltre";
}
var NOMI_FASCIA = {
  ieri:      { nome:"Di ieri",            nota:"Probabilmente vanno ancora fatte." },
  settimana: { nome:"Dell'ultima settimana", nota:"Vale la pena decidere adesso." },
  mese:      { nome:"Dell'ultimo mese",   nota:"Se sono qui da settimane, forse non servivano." },
  oltre:     { nome:"Più vecchie di un mese", nota:"Archiviarle in blocco è quasi sempre la scelta giusta." }
};
var ORDINE_FASCE = ["ieri", "settimana", "mese", "oltre"];

function giorniDiRitardo(i){
  if (i.freq === "once" && validKey(i.date)) {
    return Math.max(0, Math.round((keyToDate(dk()) - keyToDate(i.date)) / 86400000));
  }
  return 0;
}

/* Raggruppa un elenco di voci in ritardo per fascia d'età. */
function raggruppaArretrati(voci){
  var g = {};
  ORDINE_FASCE.forEach(function(f){ g[f] = []; });
  (voci || []).forEach(function(i){
    g[fasciaEta(giorniDiRitardo(i))].push(i);
  });
  return { gruppi: g, ordine: ORDINE_FASCE.filter(function(f){ return g[f].length; }) };
}

/* ---------- selezione ---------- */
function selezione(){
  S.selArretrati = S.selArretrati || {};
  return S.selArretrati;
}
function selezionati(){
  return Object.keys(selezione()).filter(function(k){ return selezione()[k]; });
}
function selezionato(id){ return !!selezione()[id]; }
function commutaSelezione(id){
  var s = selezione();
  if (s[id]) delete s[id]; else s[id] = true;
}
function selezionaTutti(ids, acceso){
  var s = selezione();
  (ids || []).forEach(function(id){ if (acceso) s[id] = true; else delete s[id]; });
}
function azzeraSelezione(){ S.selArretrati = {}; }

/* ---------- azioni su tutta la selezione ----------
   Una sola registrazione per annullare: chi ripianifica trenta voci vuole
   tornare indietro con un gesto, non con trenta. */
function azioneMassiva(azione, opzioni){
  opzioni = opzioni || {};
  var ids = selezionati();
  if (!ids.length) return { ok:false, quante:0, motivo:"Non hai scelto niente." };
  var voci = ids.map(itemById).filter(Boolean);
  if (!voci.length) return { ok:false, quante:0, motivo:"Le voci scelte non esistono più." };

  var descrizione = {
    completa:   "completate",
    oggi:       "spostate a oggi",
    domani:     "spostate a domani",
    data:       "spostate al " + (opzioni.giorno ? shortDate(opzioni.giorno) : "?"),
    attesa:     "messe in attesa",
    archivia:   "archiviate"
  }[azione] || azione;

  snapshot("Hai " + descrizione + " " + voci.length +
           (voci.length === 1 ? " voce." : " voci."), "Vuoi tornare indietro?");

  var fatte = 0;
  voci.forEach(function(it){
    switch (azione) {
      case "completa":
        if (!isOn(it)) { toggleItem(it, true); fatte++; }
        break;
      case "oggi":   if (spostaSilenzioso(it, dk(), opzioni.ora)) fatte++; break;
      case "domani": if (spostaSilenzioso(it, addDays(dk(), 1), opzioni.ora)) fatte++; break;
      case "data":   if (spostaSilenzioso(it, opzioni.giorno, opzioni.ora)) fatte++; break;
      case "attesa":
        patch(it.id, { waiting: true, bloccatoDa: opzioni.causa || "" });
        fatte++;
        break;
      case "archivia":
        S.data.archive = Array.isArray(S.data.archive) ? S.data.archive : [];
        S.data.archive.push(Object.assign({}, it, { archiviatoIl: new Date().toISOString() }));
        S.data.items = S.data.items.filter(function(x){ return x.id !== it.id; });
        ripulisciRiferimenti(it.id);
        fatte++;
        break;
    }
  });
  azzeraSelezione();
  commit();
  return { ok: fatte > 0, quante: fatte, motivo: fatte + " " + descrizione + "." };
}

/* Spostamento senza registrare un annullamento per ogni voce: la registrazione
   l'ha già fatta azioneMassiva una volta sola. */
function spostaSilenzioso(it, giorno, ora){
  if (!it || !validKey(giorno)) return false;
  var mod = {};
  if (it.freq === "once") mod.date = giorno; else mod.due = giorno;
  if (ora !== null && ora !== undefined) { mod.start = ora; if (!it.dur) mod.dur = 0.5; }
  patch(it.id, mod);
  if (S.data.skips) delete S.data.skips[it.id];
  S.data.rinvii = S.data.rinvii || {};
  S.data.rinvii[it.id] = (S.data.rinvii[it.id] || 0) + 1;
  return true;
}

/* Riassunto onesto: quante sono e quanto sono vecchie. */
function riassuntoArretrati(voci){
  var r = raggruppaArretrati(voci);
  var parti = r.ordine.map(function(f){
    return r.gruppi[f].length + " " + NOMI_FASCIA[f].nome.toLowerCase();
  });
  return { totale: (voci || []).length, testo: parti.join(", "), gruppi: r };
}


/* Esegue un'azione di gruppo e ne riporta l'esito. Sta qui e non fra gli
   eventi perché la stessa azione deve poter partire anche da altrove. */
function eseguiMassiva(quale, opzioni){
  var e = azioneMassiva(quale, opzioni || {});
  toast(e.motivo, e.ok ? "ok" : "info");
  render();
  return e;
}


/* La barra delle azioni di gruppo. Sta qui e non in un modulo di area perché
   la usano due posti diversi — gli arretrati e gli elenchi — e una barra
   duplicata sarebbe diventata due barre diverse entro poche iterazioni. */
function barraMassiva(){
  var n = selezionati().length;
  if (!n) return "";
  return '<div class="massiva" role="group" aria-label="Azioni sulle voci scelte">'+
    '<span class="mconta">'+n+(n === 1 ? " voce scelta" : " voci scelte")+'</span>'+
    '<button class="tiny pos" data-act="mass-completa">Completa</button>'+
    '<button class="tiny" data-act="mass-oggi">Oggi</button>'+
    '<button class="tiny" data-act="mass-domani">Domani</button>'+
    '<button class="tiny" data-act="mass-attesa">Metti in attesa</button>'+
    '<button class="tiny" data-act="mass-archivia">Non servono più</button>'+
    '<button class="tiny" data-act="mass-annulla">Deseleziona</button>'+
    '<span class="hint" style="margin:0;flex-basis:100%">Una sola azione su tutte, '+
    'e un solo annullamento per tornare indietro.</span></div>';
}
