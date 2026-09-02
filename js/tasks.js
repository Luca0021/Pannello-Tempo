/* tasks.js — viste derivate: cosa cade oggi, filtri, passi
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- viste derivate ---------- */
function dk(){ return dayKey(S.now); }
function stampFor(f){
  return f === "daily" ? dk() : f === "weekly" ? weekKey(S.now)
       : f === "monthly" ? monthKey(S.now)
       : f === "yearly" ? S.now.getFullYear()+"-A" : "fatto";
}
function isOn(i){ return S.data.checks[i.id] === stampFor(i.freq); }
/* Un passo è fatto se porta il timbro del periodo corrente: così i passi di un
   task quotidiano si azzerano ogni giorno, esattamente come la sua spunta. */
/* Saltare non è completare: toglie la voce dai ritardi senza dichiararla fatta,
   e nel registro resta come non svolta. */
function isSkipped(i){
  /* gli appuntamenti non sono saltabili: lo sarebbero per sempre e
     uscirebbero da ogni elenco */
  if (!i || i.freq === "once") return false;
  return !!(S.data.skips && S.data.skips[i.id] === stampFor(i.freq));
}
function stepOn(item, st){ return !!st && st.s === stampFor(item.freq); }
function stepsInfo(item){
  var st = Array.isArray(item.steps) ? item.steps : [];
  return { list: st, tot: st.length, done: st.filter(function(x){ return stepOn(item, x); }).length };
}
function visible(i){
  if (S.filter !== "tutto" && i.area !== S.filter) return false;
  if (S.tagF && S.tagF !== "tutti") {
    if (S.tagF === "__senza") return !i.tag;
    return i.tag === S.tagF;
  }
  return true;
}
function nowH(){ return S.now.getHours() + S.now.getMinutes()/60; }
function cursor(){ return keyToDate(S.cursorKey); }
function isToday(){ return S.cursorKey === dk(); }
function itemById(id){ return S.data.items.filter(function(x){ return x.id === id; })[0] || null; }

function onDay(i, d){
  if (isWaiting(i)) return false;
  /* ROU-001: una serie può cominciare dopo, e una singola occorrenza può
     essere stata rimossa senza toccare la serie */
  /* `dal` è l'inizio della serie. NON si usa `since`, che era già l'ancoraggio
     di fase per «ogni N giorni» e serve anche a ritroso. */
  if (i.freq !== "once" && validKey(i.dal) && dayKey(d) < i.dal) return false;
  if (typeof eccezioneDi === "function") {
    var ecc = eccezioneDi(i.id, dayKey(d));
    if (ecc && ecc.rimossa) return false;
  }
  /* un corso, una terapia, le rate di un finanziamento: ricorrenze che a un
     certo punto finiscono e non devono restare per sempre */
  if (i.freq !== "once" && validKey(i.fine) && dayKey(d) > i.fine) return false;
  /* «quando capita»: resta fra le cose di oggi finché non la fai,
     e sparisce per il resto del periodo appena la spunti */
  if (i.flessibile && (i.freq === "weekly" || i.freq === "monthly"))
    return dayKey(d) === dk() && !isOn(i);
  if (i.freq === "daily") {
    var ed = i.every || 1;
    if (ed <= 1) return true;
    var anc0 = validKey(i.since) ? keyToDate(i.since) : new Date(1970,0,1);
    var dd0 = dayIndex(d) - dayIndex(anc0);
    return ((dd0 % ed) + ed) % ed === 0;
  }
  if (i.freq === "yearly") {
    var mm = (i.mon === undefined) ? 0 : i.mon;
    var vv = domOf(i);
    if (d.getMonth() !== mm) return false;
    var last0 = lastDom(d);
    return d.getDate() === (vv === 0 ? last0 : Math.min(vv, last0));
  }
  if (i.freq === "once") return i.date === dayKey(d);
  if (i.freq === "monthly") {
    var last = lastDom(d), v = domOf(i);
    var target = v === 0 ? last : Math.min(v, last);
    return d.getDate() === target;
  }
  if (daysOf(i).indexOf(d.getDay()) < 0) return false;
  var ev = i.every || 1;
  if (ev > 1) {
    var anc = validKey(i.since) ? keyToDate(i.since) : EPOCH_LUN;
    var diff = weekIndex(d) - weekIndex(anc);
    if (((diff % ev) + ev) % ev !== 0) return false;
  }
  return true;
}
function timedFor(d){
  return S.data.items.filter(function(i){
    return typeof i.start === "number" && visible(i) && onDay(i, d);
  });
}
function isLate(i){
  return isToday() && typeof i.start === "number" && !isOn(i) && !isSkipped(i) &&
         nowH() > i.start + (i.dur||0.5);
}
function shortDate(k){
  if (!k) return "";
  var d = keyToDate(k);
  var t = new Date(S.now.getFullYear(), S.now.getMonth(), S.now.getDate());
  var diff = Math.round((d - t)/86400000);
  if (diff === 0) return "oggi";
  if (diff === 1) return "domani";
  if (diff === -1) return "ieri";
  return d.toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"});
}



/* Quali voci sono dovute in un dato giorno. È una query sui dati, non
   disegno: la usano l'agenda, gli elenchi e i calcoli, quindi vive qui. */
function dueOn(d){
  var g = dayKey(d);
  return S.data.items
    .filter(function(i){ return visible(i) && onDay(i, d); })
    /* le modifiche valide per un solo giorno vengono applicate qui, su una
       copia: la definizione della serie non viene toccata */
    .map(function(i){ return (typeof conEccezione === "function") ? conEccezione(i, g) : i; })
    .filter(function(i){ return !!i; });
}
