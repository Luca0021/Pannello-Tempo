/* suggerimenti.js — TOP-005: proporre candidati per le priorità di oggi.

   Il pannello sa già molte cose: che cosa scade, che cosa è stato rimandato,
   che cosa ha un blocco in agenda, dove è sbilanciata la settimana. Ma finora
   non ne faceva niente al momento che conta, cioè quando la scheda delle
   priorità è vuota e bisogna decidere.

   Tre vincoli che tengono onesta questa funzione:

   1. **Ogni proposta dichiara il motivo.** Un suggerimento senza spiegazione è
      un oracolo, e a un oracolo si obbedisce o lo si ignora — in nessuno dei
      due casi si sta scegliendo.

   2. **Non riempie mai da sola.** Scegliere è il gesto centrale del prodotto:
      farlo al posto dell'utente lo svuoterebbe. Le proposte si accettano una
      per una.

   3. **Compare solo quando serve.** Se hai già scelto, il pannello tace. */

var MAX_SUGGERIMENTI = 3;

/* I motivi, in ordine di forza. L'ordine non è estetico: davanti sta ciò che
   ha una scadenza vera, dietro ciò che è solo un'ipotesi. */
var MOTIVI_SUGGERIMENTO = [
  { id:"scade",     peso:100, testo:"scade oggi" },
  { id:"rimandata", peso: 80, testo:"l'hai già rimandata più volte" },
  { id:"bloccata",  peso: 70, testo:"qualcuno la sta aspettando" },
  { id:"inagenda",  peso: 60, testo:"hai già un blocco in agenda per farla" },
  { id:"trascurata",peso: 40, testo:"quest'area è rimasta indietro questa settimana" }
];

function pesoMotivo(id){
  var m2 = MOTIVI_SUGGERIMENTO.filter(function(x){ return x.id === id; })[0];
  return m2 ? m2.peso : 0;
}
function testoMotivo(id){
  var m2 = MOTIVI_SUGGERIMENTO.filter(function(x){ return x.id === id; })[0];
  return m2 ? m2.testo : "";
}

/* L'area rimasta indietro nella settimana, se ce n'è una in modo netto.
   «Netto» conta: proporre un riequilibrio per due punti percentuali sarebbe
   rumore travestito da consiglio. */
function areaTrascurata(){
  var conta = { lavoro:0, vita:0 };
  (S.data.completamenti || []).forEach(function(c){
    if (!c || !c.data) return;
    var g = Math.round((keyToDate(dk()) - keyToDate(c.data)) / 86400000);
    if (g >= 0 && g < 7 && conta[c.area] !== undefined) conta[c.area]++;
  });
  var tot = conta.lavoro + conta.vita;
  if (tot < 5) return null;                 /* troppo pochi dati per dire qualcosa */
  var q = conta.vita / tot;
  if (q < 0.25) return "vita";
  if (q > 0.75) return "lavoro";
  return null;
}

/* I candidati, con il motivo. Ordinati per forza del motivo. */
function suggerimentiPriorita(){
  var giaScelti = {};
  top3().forEach(function(e){ if (e && e.id) giaScelti[e.id] = true; });
  var trascurata = areaTrascurata();
  var out = [];

  dueOn(S.now).forEach(function(i){
    if (!i || isOn(i) || isSkipped(i) || giaScelti[i.id]) return;
    var motivo = null;
    if (i.freq === "once" && i.date === dk()) motivo = "scade";
    else if (validKey(i.due) && i.due <= dk()) motivo = "scade";
    else if (rinviiDi(i.id) >= SOGLIA_RINVII) motivo = "rimandata";
    else if (isWaiting(i)) motivo = null;      /* aspetta altri: non dipende da te */
    else if (typeof i.start === "number") motivo = "inagenda";
    else if (trascurata && i.area === trascurata) motivo = "trascurata";
    if (!motivo) return;
    out.push({ item:i, motivo:motivo, peso:pesoMotivo(motivo),
               spiegazione: testoMotivo(motivo) });
  });

  /* Le cose messe in attesa la cui data di ricontrollo è arrivata.
     `isWaiting()` diventa falso proprio in quel momento — ed è giusto così:
     una voce da ricontrollare oggi non è più «in attesa di qualcuno», è tornata
     a dipendere da te. Qui si guarda quindi il campo, non la funzione. */
  (S.data.items || []).forEach(function(i){
    if (!i || !i.waiting || isOn(i) || giaScelti[i.id]) return;
    if (!validKey(i.recheck) || i.recheck > dk()) return;
    out.push({ item:i, motivo:"bloccata", peso:pesoMotivo("bloccata"),
               spiegazione:"era in attesa e oggi va ricontrollata" });
  });

  out.sort(function(a, b){ return b.peso - a.peso; });
  /* mai due volte la stessa voce */
  var visti = {};
  return out.filter(function(s){
    if (visti[s.item.id]) return false;
    visti[s.item.id] = true;
    return true;
  }).slice(0, MAX_SUGGERIMENTI);
}

/* Quando mostrarli: solo se non hai ancora scelto e c'è qualcosa da dire. */
function mostraSuggerimenti(){
  if (pref("suggerimentiSpenti")) return false;
  var L = top3();
  var scelte = L.filter(function(e){ return e && (e.id || (e.t || "").trim()); }).length;
  if (scelte >= MAX_SUGGERIMENTI) return false;
  return suggerimentiPriorita().length > 0;
}
function spegniSuggerimenti(){ setImp("suggerimentiSpenti", true); }

/* Accettare una proposta: la mette nella prima riga libera, collegata al task. */
function accettaSuggerimento(id){
  var it = itemById(id);
  if (!it) return { ok:false };
  var L = top3().slice();
  var libera = -1;
  for (var n = 0; n < L.length; n++)
    if (!L[n] || (!L[n].id && !(L[n].t || "").trim())) { libera = n; break; }
  if (libera < 0) return { ok:false, testo:"Hai già tre priorità." };
  snapshot("Hai messo «"+it.label+"» fra le priorità.", "Vuoi toglierla?");
  L[libera] = { t:"", id:it.id, done:false };
  S.data.top3 = { key: dk(), list: L };
  commit();
  return { ok:true, testo:"«"+it.label+"» è fra le priorità di oggi." };
}
