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
    fatto: function(){ return (S.data.items || []).length > 0; } },

  { id:"orario",
    nome:"Dai un orario a una cosa",
    perche:"Finché tutto è un elenco non sai se ci sta davvero nella giornata.",
    dove:"Apri una voce e metti «Aggiungi orario».",
    fatto: function(){
      return (S.data.items || []).some(function(i){ return i && typeof i.start === "number"; });
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
