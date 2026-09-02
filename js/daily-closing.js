/* daily-closing.js — la chiusura di giornata.
   È il momento che crea l'abitudine: trenta secondi per sistemare ciò che è
   rimasto aperto e decidere le tre cose di domani. Non blocca mai il pannello
   e non interrompe chi sta scrivendo. */

function chiusuraDelGiorno(k){
  return (S.data.chiusure || []).filter(function(c){ return c.data === k; })[0] || null;
}
function chiusuraFattaOggi(){ return !!chiusuraDelGiorno(dk()); }

/* Va proposta? Sì dopo l'ora scelta, una sola volta al giorno, e mai mentre
   stai modificando qualcosa. */
function chiusuraDaProporre(){
  if (!pref("chiusuraAttiva")) return false;
  if (chiusuraFattaOggi()) return false;
  if (S.chiusura || S.editId || S.nuovo || S.onboarding) return false;
  if (!isToday()) return false;
  var ora = String(pref("chiusuraOra") || "18:00").split(":");
  var soglia = (parseInt(ora[0],10) || 18) + (parseInt(ora[1],10) || 0)/60;
  return nowH() >= soglia;
}

/* Le voci ancora aperte oggi: sono quelle su cui la chiusura fa decidere. */
function apertiDiOggi(){
  return dueOn(S.now).filter(function(i){ return !isOn(i) && !isSkipped(i); });
}

function apriChiusura(){
  var b = bilancioGiorno(S.now);
  var L = top3();
  S.chiusura = {
    passo: 1,
    bilancio: b,
    prioritaFatte: L.filter(function(e){
      var it = e.id ? itemById(e.id) : null;
      return it ? isOn(it) : !!e.done;
    }).length,
    prioritaTotali: L.filter(function(e){ return e.id || (e.t||"").trim(); }).length,
    decisioni: {},
    domani: ["", "", ""],
    domaniArea: ["lavoro", "lavoro", "lavoro"],
    rinviati: 0, rimossi: 0
  };
  render();
}
function chiudiChiusura(){ S.chiusura = null; render(); }

/* Fase 2: una decisione per ogni voce rimasta aperta. */
function decidiVoce(id, scelta){
  var it = itemById(id);
  if (!it || !S.chiusura) return;
  S.chiusura.decisioni[id] = scelta;
  if (scelta === "fatta") { if (!isOn(it)) toggleItem(it); }
  else if (scelta === "domani") {
    if (it.freq === "once") patch(id, { date: dayKey(new Date(keyToDate(dk()).getTime()+86400000)) });
    S.chiusura.rinviati++;
    contaRinvio(id);
  }
  else if (scelta === "bloccato") { patch(id, { waiting: true, bloccatoDa: "" }); }
  else if (scelta === "elimina") {
    S.chiusura.rimossi++;
    snapshot("Hai eliminato «"+it.label+"» durante la chiusura di giornata.",
             "Vuoi annullare l'eliminazione?");
    delete S.data.checks[id]; delete S.data.doneAt[id]; delete S.data.log[id];
    if (S.data.skips) delete S.data.skips[id];
    if (S.data.rinvii) delete S.data.rinvii[id];
    if (S.data.ignora) delete S.data.ignora[id];
    /* se era fra le tre cose, la riga torna vuota: una priorità che punta a un
       task eliminato resterebbe appesa senza modo di toglierla */
    if (S.data.top3 && Array.isArray(S.data.top3.list))
      S.data.top3.list = S.data.top3.list.map(function(e){
        return (e && e.id === id) ? { t:"", id:null, done:false } : e;
      });
    S.data.completamenti = (S.data.completamenti || []).filter(function(c){ return c.id !== id; });
    S.data.items = S.data.items.filter(function(x){ return x.id !== id; });
  }
  commit();
}

/* Quante volte una voce è stata rinviata: alimenta «Spesso rimandate». */
function contaRinvio(id){
  S.data.rinvii = S.data.rinvii || {};
  S.data.rinvii[id] = (S.data.rinvii[id] || 0) + 1;
}

/* Fase 4: salva la chiusura e prepara le tre cose di domani. */
function salvaChiusura(){
  var c = S.chiusura;
  if (!c) return;
  var b = bilancioGiorno(S.now);
  var oggi = dueOn(S.now);
  var record = {
    data: dk(),
    chiusaAlle: new Date().toISOString(),
    prioritaFatte: c.prioritaFatte,
    prioritaTotali: c.prioritaTotali,
    taskFatti: oggi.filter(isOn).length,
    taskTotali: oggi.length,
    rinviati: c.rinviati,
    rimossi: c.rimossi,
    minutiLavoro: b.lavoro.minuti,
    minutiVita: b.vita.minuti,
    minutiSovrapposti: minutiSovrapposti(),
    domaniPreparato: c.domani.some(function(t){ return (t||"").trim(); })
  };
  S.data.chiusure = (S.data.chiusure || []).filter(function(x){ return x.data !== record.data; });
  S.data.chiusure.push(record);
  if (S.data.chiusure.length > 400) S.data.chiusure = S.data.chiusure.slice(-400);

  /* le priorità di domani vengono scritte come lista del giorno successivo */
  var domaniKey = dayKey(new Date(keyToDate(dk()).getTime()+86400000));
  var lista = c.domani.map(function(t, n){
    var testo = (t || "").trim();
    return testo ? { t: testo, id: null, done: false, area: c.domaniArea[n] } : { t:"", id:null, done:false };
  });
  if (lista.some(function(e){ return e.t; }))
    S.data.top3domani = { key: domaniKey, list: lista };

  S.chiusura = null;
  S.flashChiusura = record;
  toast("Giornata chiusa", "ok");
  commit();
}

/* Minuti in cui due blocchi si sovrappongono: dato reale, non stima. */
function minutiSovrapposti(){
  var b = dueOn(S.now).filter(function(i){ return typeof i.start === "number" && !isSkipped(i); })
    .map(function(i){ return [i.start, i.start + (i.dur||0.5)]; })
    .sort(function(x,y){ return x[0]-y[0]; });
  var tot = 0;
  for (var n = 1; n < b.length; n++) {
    var prec = b[n-1], cur = b[n];
    if (cur[0] < prec[1]) tot += Math.min(prec[1], cur[1]) - cur[0];
  }
  return Math.round(tot * 60);
}

/* Serie di giorni chiusi. Misura il rituale, non la produttività: un giorno in
   pausa non spezza la serie, e non si penalizza il passato. */
function serieChiusure(){
  var chiusure = {};
  (S.data.chiusure || []).forEach(function(c){ chiusure[c.data] = 1; });
  var n = 0, d = keyToDate(dk());
  /* se oggi non è ancora chiusa la serie parte da ieri: non è un'interruzione */
  if (!chiusure[dk()]) d = new Date(d.getTime() - 86400000);
  var guardia = 0;
  while (guardia++ < 400) {
    var k = dayKey(d);
    if (chiusure[k]) { n++; }
    else if (giornoInPausa(k)) { /* la pausa non spezza */ }
    else break;
    d = new Date(d.getTime() - 86400000);
  }
  return n;
}
function giornoInPausa(k){
  var p = S.data.pause;
  if (!p || !validKey(p.from) || !validKey(p.to)) return false;
  return k >= p.from && k <= p.to;
}
