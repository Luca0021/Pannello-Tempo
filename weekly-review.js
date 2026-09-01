/* weekly-review.js — la revisione settimanale.
   Mostra soltanto ciò che è stato registrato davvero e dichiara i giorni
   senza dati. Nessun confronto con la settimana prima se non ci sono
   abbastanza dati per farlo. */

function settimanaDi(k){
  var d = keyToDate(k), g = (d.getDay() + 6) % 7;   /* lunedì = 0 */
  var lun = new Date(d.getTime() - g * 86400000);
  var dom = new Date(lun.getTime() + 6 * 86400000);
  return { da: dayKey(lun), a: dayKey(dom) };
}
function revisioneDi(k){
  return (S.data.revisioni || []).filter(function(r){ return r.settimana === k; })[0] || null;
}
function revisioneDaProporre(){
  if (!pref("revisioneAttiva")) return false;
  if (S.revisione || S.chiusura || S.onboarding || S.editId) return false;
  if (new Date().getDay() !== (pref("revisioneGiorno") || 0)) return false;
  var s = settimanaDi(dk());
  if (revisioneDi(s.da)) return false;
  return nowH() >= 18;
}

function datiRevisione(kRiferimento){
  var s = settimanaDi(kRiferimento || dk());
  var b = bilancioRegistrato(s.da, s.a);
  var chiusure = (S.data.chiusure || []).filter(function(c){ return c.data >= s.da && c.data <= s.a; });
  var prioFatte = chiusure.reduce(function(t,c){ return t + (c.prioritaFatte||0); }, 0);
  var prioTot   = chiusure.reduce(function(t,c){ return t + (c.prioritaTotali||0); }, 0);
  var rinviati  = chiusure.reduce(function(t,c){ return t + (c.rinviati||0); }, 0);
  var rimossi   = chiusure.reduce(function(t,c){ return t + (c.rimossi||0); }, 0);

  /* routine: quante volte cadevano e quante sono state fatte, dal registro */
  var routineFatte = 0, routineSaltate = 0;
  S.data.items.forEach(function(i){
    if (i.freq === "once") return;
    var l = (S.data.log || {})[i.id] || "";
    if (!l) return;
    var ultimi = l.slice(-7);
    routineFatte   += (ultimi.match(/1/g) || []).length;
    routineSaltate += (ultimi.match(/0/g) || []).length;
  });

  /* voci ripianificate più volte in settimana */
  var rimandate = Object.keys(S.data.rinvii || {}).map(function(id){
    var it = itemById(id);
    return it ? { item: it, volte: S.data.rinvii[id] } : null;
  }).filter(function(x){ return x && x.volte >= 2; })
    .sort(function(a,b2){ return b2.volte - a.volte; }).slice(0, 5);

  /* confronto: solo se la settimana prima ha almeno tre giorni con dati */
  var prec = settimanaDi(dayKey(new Date(keyToDate(s.da).getTime() - 86400000)));
  var bPrec = bilancioRegistrato(prec.da, prec.a);
  /* confronto solo se entrambe le settimane hanno almeno tre giorni chiusi:
     con meno dati il paragone sarebbe rumore presentato come tendenza */
  var confronto = (bPrec.giorniChiusi >= 3 && b.giorniChiusi >= 3) ? {
    percLavoroPrec: bPrec.percLavoro,
    deltaLavoro: (b.percLavoro !== null && bPrec.percLavoro !== null)
                 ? b.percLavoro - bPrec.percLavoro : null,
    chiusiPrec: bPrec.giorniChiusi
  } : null;

  return {
    settimana: s.da, da: s.da, a: s.a,
    bilancio: b, chiusure: chiusure.length, giorniSenzaDati: b.giorni - b.giorniConDati,
    prioritaFatte: prioFatte, prioritaTotali: prioTot,
    taskRinviati: rinviati, taskRimossi: rimossi,
    routineFatte: routineFatte, routineSaltate: routineSaltate,
    rimandate: rimandate, confronto: confronto,
    osservazioni: osservazioniBilancio(b)
  };
}

function apriRevisione(k){ S.revisione = datiRevisione(k); render(); }
function chiudiRevisione(){ S.revisione = null; render(); }
function rinviaRevisione(){
  /* rinviata di un giorno: si ripropone domani, non sparisce */
  setImp("revisioneGiorno", (new Date().getDay() + 1) % 7);
  S.revisione = null;
  toast("Revisione rinviata a domani", "info");
  render();
}
function salvaRevisione(){
  var r = S.revisione;
  if (!r) return;
  var rec = {
    settimana: r.settimana, vistaAlle: new Date().toISOString(),
    minutiLavoro: r.bilancio.lavoro.minuti, minutiVita: r.bilancio.vita.minuti,
    percLavoro: r.bilancio.percLavoro, giorniChiusi: r.bilancio.giorniChiusi,
    prioritaFatte: r.prioritaFatte, prioritaTotali: r.prioritaTotali,
    routineFatte: r.routineFatte, routineSaltate: r.routineSaltate
  };
  S.data.revisioni = (S.data.revisioni || []).filter(function(x){ return x.settimana !== rec.settimana; });
  S.data.revisioni.push(rec);
  if (S.data.revisioni.length > 120) S.data.revisioni = S.data.revisioni.slice(-120);
  S.revisione = null;
  toast("Revisione archiviata", "ok");
  commit();
}

/* Report mensile: stessa disciplina, dati reali e giorni scoperti dichiarati. */
function datiMese(rif){
  var d = rif || S.now;
  var primo = new Date(d.getFullYear(), d.getMonth(), 1);
  var ultimo = new Date(d.getFullYear(), d.getMonth()+1, 0);
  var b = bilancioRegistrato(dayKey(primo), dayKey(ultimo));
  var settimane = [];
  var cur = new Date(primo);
  while (cur <= ultimo) {
    var s = settimanaDi(dayKey(cur));
    if (!settimane.some(function(x){ return x.da === s.da; }))
      settimane.push(Object.assign({}, s, bilancioRegistrato(s.da, s.a)));
    cur = new Date(cur.getTime() + 7 * 86400000);
  }
  return { mese: MONTHS[d.getMonth()], anno: d.getFullYear(), bilancio: b,
           settimane: settimane, giorniSenzaDati: b.giorni - b.giorniConDati,
           osservazioni: osservazioniBilancio(b) };
}
