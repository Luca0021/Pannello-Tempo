/* attivazione.js — ONB-004: la checklist di attivazione.

   L'ingresso finisce dopo sei passi, ma il pannello diventa davvero utile solo
   quando hai vissuto un paio di giornate con dentro: una priorità scelta, un
   blocco messo in agenda, una giornata chiusa.

   Due decisioni che tengono in piedi questa parte:

   1. **Le voci si spuntano da sole.** Nessuna casella da barrare a mano: se hai
      chiuso una giornata, il pannello lo sa. Una checklist che si spunta a mano
      misura la pazienza, non l'uso.

   2. **Sparisce quando ha finito il suo lavoro.** Una barra di avanzamento
      permanente diventa un compito in più, ed è esattamente il contrario di
      quello che questo pannello promette. Si può anche chiudere prima. */

/* ───────────────────────────────────────────────────────────────────────────
   CHE COSA HAI FATTO TU, E CHE COSA C'ERA GIÀ
   ───────────────────────────────────────────────────────────────────────────

   DIFETTO CORRETTO, misurato aprendo il pannello da utente nuovo: la
   checklist diceva **«2 di 6» prima che l'utente avesse toccato niente**.

   La ragione: `seed()` mette diciassette voci di partenza — finestre per la
   posta, blocchi di concentrazione, un po' di vita — e alcune hanno già un
   orario. Le due voci «Aggiungi qualcosa da fare» e «Dai un orario a una
   cosa» guardavano `items.length > 0` e `qualcuna ha start`: entrambe vere
   al primo secondo, per merito del pannello e non della persona.

   Prendersi il merito del lavoro di qualcun altro è il modo più rapido di
   rendere inutile una barra di avanzamento: se si spunta da sola, non
   misura più niente. Quindi le due voci ora chiedono qualcosa che **tu**
   hai fatto.

   Come si distingue: per identificativo, confrontando con `seed()`, che è
   l'unica definizione delle voci iniziali. I dati di esempio caricati
   dall'ingresso portano il marchio `demo-` e non contano nemmeno loro: chi
   preme «caricami degli esempi» non ha aggiunto una cosa da fare.

   Un limite, dichiarato: se rinomini «Blocco focus» in «Preparare la
   riunione» quella resta, per questa misura, una voce iniziale — l'hai
   modificata, non aggiunta. L'orario invece è più preciso: se lo cambi
   rispetto a quello di partenza, l'hai dato tu. */
var _VOCI_INIZIALI = null;
function vociIniziali(){
  if (_VOCI_INIZIALI) return _VOCI_INIZIALI;
  _VOCI_INIZIALI = {};
  try {
    (seed().items || []).forEach(function(i){ if (i && i.id) _VOCI_INIZIALI[i.id] = i; });
  } catch (e) { /* senza seed leggibile: nessuna voce è «iniziale» */ }
  return _VOCI_INIZIALI;
}
function vocePropria(i){
  if (!i || !i.id) return false;
  if (typeof marchioDemo === "function" && String(i.id).indexOf(marchioDemo()) === 0) return false;
  return !vociIniziali()[i.id];
}
function orarioProprio(i){
  if (!i || typeof i.start !== "number") return false;
  if (vocePropria(i)) return true;
  var orig = vociIniziali()[i.id];
  return !orig || orig.start !== i.start;
}

var TRAGUARDI = [
  { id:"priorita",
    nome:"Scegli una priorità",
    perche:"È il gesto centrale: decidere che cosa conta prima che la giornata decida per te.",
    dove:"In cima alla home, sotto «Priorità di oggi».",
    fatto: function(){
      var L = top3();
      return L.some(function(e){ return e && (e.id || (e.t || "").trim()); }) ||
             (S.data.completamenti || []).length > 0;
    } },

  { id:"task",
    nome:"Aggiungi qualcosa da fare",
    perche:"Serve materiale vero: con il pannello vuoto non si capisce a cosa serva.",
    dove:"«Aggiungi un task», oppure il pulsante Nuovo.",
    fatto: function(){ return (S.data.items || []).some(vocePropria); } },

  { id:"orario",
    nome:"Dai un orario a una cosa",
    perche:"Finché tutto è un elenco non sai se ci sta davvero nella giornata.",
    dove:"Apri una voce e metti «Aggiungi orario», o tocca una fascia libera dell'agenda.",
    fatto: function(){ return (S.data.items || []).some(orarioProprio); } },

  { id:"routine",
    nome:"Completa una cosa che si ripete",
    perche:"Il pannello si giudica su ciò che torna: la spunta di oggi si azzera domani, "+
           "e questo è il punto.",
    dove:"Spunta la casella di una voce in «Routine» o in «Da fare oggi».",
    fatto: function(){
      var fattaOra = (S.data.items || []).some(function(i){
        return i && i.freq && i.freq !== "once" && isOn(i);
      });
      if (fattaOra) return true;
      /* e nello storico: una routine completata la settimana scorsa conta
         quanto una completata adesso */
      return (S.data.completamenti || []).some(function(c){
        var i = c && c.id ? itemById(c.id) : null;
        return i && i.freq && i.freq !== "once";
      });
    } },

  { id:"fascia",
    nome:"Dichiara la tua giornata",
    perche:"Senza una fascia oraria il tempo libero viene contato sulle ventiquattr'ore, notte compresa.",
    dove:"Impostazioni → La tua giornata.",
    fatto: function(){
      var f = pref("fascia") || {};
      return typeof f.da === "number" &&
             (f.da !== FASCIA_PREDEFINITA.da || f.a !== FASCIA_PREDEFINITA.a ||
              Object.keys(f.giorni || {}).length > 0);
    } },

  { id:"chiusura",
    nome:"Chiudi una giornata",
    perche:"È il momento in cui il pannello restituisce qualcosa invece di chiedere.",
    dove:"Compare da sola dal pomeriggio in poi.",
    fatto: function(){ return (S.data.chiusure || []).length > 0; } },

  { id:"seconda",
    nome:"Torna un secondo giorno",
    perche:"Uno strumento del tempo si giudica sul secondo giorno, non sul primo.",
    dove:"Nient'altro da fare: basta riaprirlo domani.",
    fatto: function(){
      var g = {};
      (S.data.chiusure || []).forEach(function(c){ if (c && c.data) g[c.data] = 1; });
      (S.data.completamenti || []).forEach(function(c){ if (c && c.data) g[c.data] = 1; });
      return Object.keys(g).length >= 2;
    } }
];

function statoAttivazione(){
  var voci = TRAGUARDI.map(function(t){
    var ok = false;
    try { ok = !!t.fatto(); } catch (e) { ok = false; }
    return { id:t.id, nome:t.nome, perche:t.perche, dove:t.dove, fatto:ok };
  });
  var fatti = voci.filter(function(v){ return v.fatto; }).length;
  var prossimo = voci.filter(function(v){ return !v.fatto; })[0] || null;
  return {
    voci: voci, fatti: fatti, totale: voci.length,
    completa: fatti === voci.length,
    prossimo: prossimo,
    percentuale: Math.round(fatti * 100 / voci.length)
  };
}

/* Quando mostrarla: non appena è completa, e non se l'hai chiusa tu. */
function mostraAttivazione(){
  if (pref("attivazioneChiusa")) return false;
  var s = statoAttivazione();
  if (s.completa) {
    /* finito il suo lavoro, si toglie di mezzo da sola e non torna */
    setImp("attivazioneChiusa", true);
    return false;
  }
  return true;
}
function chiudiAttivazione(){ setImp("attivazioneChiusa", true); }
