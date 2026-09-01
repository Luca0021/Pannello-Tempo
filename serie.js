/* serie.js — ROU-001: modificare una ricorrenza con tre ambiti.

   La regola che governa tutto: **lo storico già registrato non si riscrive.**
   Se il 12 agosto hai fatto la palestra alle 7, quel fatto resta com'è anche se
   oggi sposti la palestra alle 19. Il passato è un dato, non una preferenza.

   I tre ambiti:
     "questa"                una sola occorrenza cambia; la serie non si tocca
     "questa-e-successive"   la serie si chiude alla vigilia e ne nasce una nuova
     "serie"                 la definizione cambia da oggi in avanti

   Perché «questa e successive» crea una serie nuova invece di modificare quella
   vecchia: modificarla cambierebbe anche il significato delle occorrenze già
   passate, e con esse le statistiche. Chiudere e ricominciare conserva la
   verità di prima e dichiara il cambiamento. */

var AMBITI = [
  { id:"questa",              nome:"Solo questa volta" },
  { id:"questa-e-successive", nome:"Questa e le successive" },
  { id:"serie",               nome:"Tutta la serie" }
];

/* Eccezioni: modifiche o rimozioni valide per un singolo giorno. */
/* Sola lettura: NON crea il campo. Prima leggere le eccezioni lo materializzava
   come effetto collaterale, e un annullamento non ripristinava più i dati
   identici a com'erano. Un accesso in lettura non deve modificare nulla. */
function eccezioniLette(){
  return (S.data && S.data.eccezioni && typeof S.data.eccezioni === "object")
         ? S.data.eccezioni : null;
}
/* Scrittura: qui il campo può nascere. */
function eccezioni(){
  S.data.eccezioni = (S.data.eccezioni && typeof S.data.eccezioni === "object")
                     ? S.data.eccezioni : {};
  return S.data.eccezioni;
}
function eccezioneDi(id, giorno){
  var tutte = eccezioniLette();
  if (!tutte) return null;
  var e = tutte[id];
  return (e && e[giorno]) ? e[giorno] : null;
}
function scriviEccezione(id, giorno, valore){
  var e = eccezioni();
  e[id] = e[id] || {};
  if (valore === null) delete e[id][giorno];
  else e[id][giorno] = valore;
  if (e[id] && !Object.keys(e[id]).length) delete e[id];
}

/* Applica l'eccezione del giorno a una voce, senza toccare l'originale. */
function conEccezione(i, giorno){
  var ecc = eccezioneDi(i.id, giorno);
  if (!ecc) return i;
  if (ecc.rimossa) return null;
  return Object.assign({}, i, ecc.modifiche || {}, { _eccezione: giorno });
}

/* ---------- la modifica ---------- */
function modificaSerie(id, ambito, modifiche, giorno){
  var it = itemById(id);
  if (!it || !modifiche) return { ok:false, motivo:"Voce non trovata." };
  giorno = validKey(giorno) ? giorno : dk();
  if (it.freq === "once") {                       /* niente serie: modifica diretta */
    patch(id, modifiche);
    return { ok:true, ambito:"una-sola" };
  }

  if (ambito === "questa") {
    snapshot("Hai cambiato «"+it.label+"» solo per il "+shortDate(giorno)+".",
             "Vuoi annullare la modifica?");
    scriviEccezione(id, giorno, { modifiche: modifiche });
    segnaModifica(id);
    commit();
    return { ok:true, ambito:"questa", giorno:giorno };
  }

  if (ambito === "questa-e-successive") {
    var vigilia = addDays(giorno, -1);
    if (validKey(it.dal) && it.dal > vigilia)
      return modificaSerie(id, "serie", modifiche, giorno);   /* nulla prima: è tutta la serie */
    snapshot("Hai cambiato «"+it.label+"» dal "+shortDate(giorno)+" in poi.",
             "Vuoi annullare la modifica?");
    /* la serie vecchia si ferma alla vigilia: le occorrenze già passate
       restano esattamente com'erano */
    patch(id, { fine: vigilia });
    var nuova = Object.assign({}, it, modifiche, {
      id: uid(), dal: giorno, seguito: id
    });
    delete nuova.fine;
    delete nuova._eccezione;
    S.data.items.push(nuova);
    segnaModifica(nuova.id);
    normalizeData();
    commit();
    return { ok:true, ambito:"questa-e-successive", nuovoId: nuova.id, chiusaAl: vigilia };
  }

  /* tutta la serie */
  snapshot("Hai cambiato «"+it.label+"» per tutta la serie.", "Vuoi annullare la modifica?");
  patch(id, modifiche);
  commit();
  return { ok:true, ambito:"serie" };
}

/* ---------- le cancellazioni ---------- */
function eliminaOccorrenza(id, giorno){
  var it = itemById(id);
  if (!it) return { ok:false };
  giorno = validKey(giorno) ? giorno : dk();
  snapshot("Hai tolto «"+it.label+"» dal "+shortDate(giorno)+".", "Vuoi rimetterla?");
  scriviEccezione(id, giorno, { rimossa: true });
  segnaModifica(id);
  commit();
  return { ok:true, giorno:giorno };
}
function eliminaDaQui(id, giorno){
  var it = itemById(id);
  if (!it) return { ok:false };
  giorno = validKey(giorno) ? giorno : dk();
  var vigilia = addDays(giorno, -1);
  snapshot("Hai chiuso «"+it.label+"» al "+shortDate(vigilia)+".", "Vuoi riaprirla?");
  patch(id, { fine: vigilia });
  commit();
  return { ok:true, chiusaAl: vigilia };
}

/* Lo storico di una serie: quello che è già stato registrato, e che nessuna
   modifica deve poter cambiare. */
function storicoSerie(id){
  return {
    completamenti: (S.data.completamenti || []).filter(function(c){ return c.id === id; }).length,
    registro: (S.data.log && S.data.log[id]) ? S.data.log[id].length : 0,
    spunte: S.data.checks && S.data.checks[id] ? 1 : 0
  };
}


/* Traduce un campo dell'editor nella modifica corrispondente.
   Serve perché la modifica per ambito e quella diretta usino le stesse regole:
   avere due traduzioni diverse era il modo più rapido per farle divergere. */
function campoEditor(c, val, it){
  switch (c) {
    case "e-start":
      return val === "" ? { start: undefined, dur: undefined }
                        : { start: parseFloat(val), dur: (it && it.dur) || 0.5 };
    case "e-dur":   return { dur: Math.max(0.25, parseFloat(val) || 0.5) };
    case "e-area":  return { area: val === "vita" ? "vita" : "lavoro" };
    case "e-dom":   return { dom: parseInt(val, 10) };
    case "e-mon":   return { mon: parseInt(val, 10) };
    case "e-tag":   return { tag: testoSicuro(val, 40) };
    case "e-note":  return { note: testoSicuro(val, 5000) };
    case "e-place": return { place: testoSicuro(val, 200) };
    default: return null;      /* campo non traducibile: resta la via diretta */
  }
}
