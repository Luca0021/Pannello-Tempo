/* utils.js — date, formattazione, testo, sicurezza URL, somiglianza
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- utilità ---------- */
function pad(n){ return String(n).padStart(2,"0"); }
function dayKey(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function monthKey(d){ return d.getFullYear()+"-M"+pad(d.getMonth()+1); }
function weekKey(d){
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear()+"-S"+pad(Math.ceil(((t - y0)/86400000 + 1)/7));
}
function keyToDate(k){ var p = k.split("-").map(Number); return new Date(p[0], p[1]-1, p[2]); }
/* Non basta la forma: "2026-13-45" verrebbe accettato e trasformato in febbraio 2027. */
function validKey(k){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k || "")) return false;
  var p = k.split("-").map(Number), d = new Date(p[0], p[1]-1, p[2]);
  return d.getFullYear() === p[0] && d.getMonth() === p[1]-1 && d.getDate() === p[2];
}
function fmt(h){
  if (typeof h !== "number" || !isFinite(h)) return "--:--";
  return pad(Math.floor(h))+":"+pad(Math.round((h%1)*60));
}
function dur2s(d){
  if (typeof d !== "number" || !isFinite(d)) return "—";
  if (d <= 0) return "0m";
  if (d >= 1) return Math.floor(d)+"h"+(d%1 ? " "+Math.round((d%1)*60) : "");
  return Math.round(d*60)+"m";
}
function uid(){ return Math.random().toString(36).slice(2,9); }
function snap(v){ return Math.round(v*4)/4; }
/* Un indirizzo diventa un collegamento alle indicazioni stradali:
   sul telefono apre direttamente l'app di mappe. */
function placeQuery(p){
  var t = String(p || "").trim();
  var citta = (S.data && S.data.city) ? String(S.data.city).trim() : "";
  /* se è solo un nome — nessun numero civico, nessuna virgola — aggiungo la città,
     altrimenti le mappe cercano in tutto il mondo */
  if (citta && !/\d/.test(t) && t.indexOf(",") < 0) t += ", " + citta;
  return t;
}
function mapsUrl(p){
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(placeQuery(p));
}
function mapsSearch(p){
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(placeQuery(p));
}
function safeUrl(u){ return /^https?:\/\/\S+$/i.test(String(u||"").trim()); }
function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
var EPOCH_LUN = new Date(1970, 0, 5);
function dayIndex(d){
  return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(1970,0,1)) / 86400000);
}
/* Un task messo in attesa esce dalla giornata finché non arriva la data di ricontrollo. */
function isWaiting(i){
  return !!i.waiting && (!validKey(i.recheck) || i.recheck > dk());
}
var MOTIVI = [["ferie","Ferie"],["malattia","Malattia"],["trasferta","Trasferta"],
              ["riposo","Riposo"],["altro","Altro"]];
/* La pausa può riguardare una sola area: in ferie sospendi il lavoro, ma il volo
   delle 9:00 lo vuoi eccome. Senza area vale per entrambe. */
function inPausa(area){
  var p = S.data.pause;
  if (!p || !validKey(p.from) || !validKey(p.to)) return false;
  var k = dk();
  if (!(k >= p.from && k <= p.to)) return false;
  if (!p.area) return true;
  return area === undefined ? true : p.area === area;
}
function motivoPausa(){
  var p = S.data.pause || {};
  var m2 = MOTIVI.filter(function(x){ return x[0] === p.motivo; })[0];
  return m2 ? m2[1] : "";
}
function etichettaPausa(){
  var p = S.data.pause || {};
  var parti = [];
  if (motivoPausa()) parti.push(motivoPausa());
  parti.push(p.area ? "solo "+AREAS[p.area].label.toLowerCase() : "lavoro e vita");
  return parti.join(" · ");
}
function weekIndex(d){
  return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH_LUN) / 604800000);
}
function daysOf(i){
  if (Array.isArray(i.days) && i.days.length) return i.days;
  return [i.day === undefined ? 1 : i.day];
}
function periodoLabel(i){
  return i.freq === "monthly" ? "entro il mese" : "entro la settimana";
}
function daysLabel(i){
  var d = daysOf(i).slice().sort(function(a,b){ return ((a+6)%7) - ((b+6)%7); });
  var txt = d.map(function(n){ return DOWS[n]; }).join(", ");
  var ev = i.every || 1;
  return ev > 1 ? txt+" ogni "+ev+" sett." : txt;
}
var MESI3 = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
function lastDom(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
function domOf(item){ return item.dom === undefined ? 1 : item.dom; }
function domLabel(item){
  var v = domOf(item);
  return v === 0 ? "ultimo" : "il "+v;
}
/* Traduce la regola nella data effettiva del mese mostrato. */
function domDateLabel(item, ref){
  var last = new Date(ref.getFullYear(), ref.getMonth()+1, 0).getDate();
  var v = domOf(item);
  var day = v === 0 ? last : Math.min(v, last);
  var dt = new Date(ref.getFullYear(), ref.getMonth(), day);
  return day+" "+dt.toLocaleDateString("it-IT",{month:"short"}).replace(".","");
}
/* Scadenza: vale oltre la giornata, a differenza delle tre cose. */
function dueInfo(item){
  if (!validKey(item.due)) return null;
  var t = new Date(); t.setHours(0,0,0,0);
  var d = keyToDate(item.due);
  if (isNaN(d.getTime())) return null;
  var days = Math.round((d - t) / 86400000);
  var level = days < 0 ? "over" : days <= 1 ? "urgent" : days <= 7 ? "soon" : "none";
  var label;
  if (days < -1) label = "scaduta da "+(-days)+" giorni";
  else if (days === -1) label = "scaduta ieri";
  else if (days === 0) label = "scade oggi";
  else if (days === 1) label = "scade domani";
  else if (days <= 14) label = "fra "+days+" giorni";
  else label = "entro il "+d.toLocaleDateString("it-IT",{day:"numeric",month:"short"}).replace(".","");
  return { days:days, label:label, level:level };
}
/* Confronto tra testi: normalizza e misura la somiglianza a coppie di lettere. */
function normTxt(x){
  return String(x || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function similarity(a, b){
  a = normTxt(a); b = normTxt(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length > 3 && b.length > 3 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0)) return 0.92;
  if (a.length < 2 || b.length < 2) return 0;
  /* con lunghezze troppo diverse la soglia è irraggiungibile: si evita il calcolo */
  var lung = Math.max(a.length, b.length);
  if ((lung - Math.min(a.length, b.length)) / lung > 0.45) return 0;
  var map = {}, i;
  for (i = 0; i < a.length - 1; i++) { var g = a.slice(i, i+2); map[g] = (map[g] || 0) + 1; }
  var hit = 0, tot = b.length - 1;
  for (i = 0; i < tot; i++) { var g2 = b.slice(i, i+2); if (map[g2] > 0) { map[g2]--; hit++; } }
  return (2 * hit) / ((a.length - 1) + tot);
}
/* Cerca task già presenti o già chiusi in passato che somigliano al testo. */
function findSimilar(label, skipId){
  var out = [];
  S.data.items.forEach(function(i){
    if (i.id === skipId) return;
    var sc = similarity(label, i.label);
    if (sc >= 0.65) out.push({ kind:"attivo", label:i.label, id:i.id, score:sc,
                               when: S.data.doneAt[i.id] || null, freq:i.freq, area:i.area });
  });
  (S.data.archive || []).forEach(function(a){
    var sc = similarity(label, a.label);
    if (sc >= 0.65) out.push({ kind:"archivio", label:a.label, id:null, score:sc,
                               when:a.date, area:a.area });
  });
  return out.sort(function(x,y){ return y.score - x.score; }).slice(0, 4);
}
/* Per lo scarico il confronto è informativo, non bloccante: la nota entra
   comunque e la somiglianza compare come annotazione. */
function bumpSim(){ S.simVer++; }
/* Il ripristino conserva il testo in digitazione attraverso i ridisegni.
   Quando però è il pannello a svuotare un campo, va detto esplicitamente,
   altrimenti il vecchio contenuto tornerebbe dentro. */
function svuota(){
  for (var i = 0; i < arguments.length; i++) S.clearKeep[arguments[i]] = 1;
}
function toast(msg, kind){
  S.toast = { msg: msg, kind: kind || "info", at: Date.now() };
  if (typeof setTimeout === "function")
    setTimeout(function(){
      if (S.toast && Date.now() - S.toast.at >= 3400) { S.toast = null; render(); }
    }, 3700);
}
/* Traduce un cambiamento in una frase breve: così sai cosa il pannello ha recepito. */
function diffMsg(prev, f){
  if (!prev) return "";
  var k = Object.keys(f)[0];
  if (k === undefined) return "";
  var v = f[k];
  switch (k) {
    case "label":   return "Nome aggiornato";
    case "start":   return v === undefined ? "Orario rimosso"
                    : (typeof prev.start === "number" ? "Orario: "+fmt(prev.start)+" → "+fmt(v)
                                                      : "Orario impostato alle "+fmt(v));
    case "dur":     return "Durata: "+dur2s(prev.dur||0.5)+" → "+dur2s(v);
    case "area":    return "Area: "+AREAS[v].label;
    case "date":    return "Spostato "+dataAl(v);
    case "due":     return v ? "Scadenza: "+shortDate(v) : "Scadenza rimossa";
    case "fine":    return v ? "Si ripete fino "+dataAl(v) : "Ricorrenza senza fine";
    case "flessibile": return v ? "Quando capita, senza giorno fisso" : "Torna a giorno fisso";
    case "importo": return v ? "Importo: "+euro(v) : "Importo rimosso";
    case "entrata": return v ? "Segnata come entrata" : "Segnata come uscita";
    case "days":    return "Giorni: "+daysLabel({ days: v, every: prev.every });
    case "every":   return v > 1 ? (prev.freq === "daily" ? "Ogni "+v+" giorni" : "Ogni "+v+" settimane")
                                 : (prev.freq === "daily" ? "Tutti i giorni" : "Ogni settimana");
    case "dom":     return "Giorno: "+(v === 0 ? "ultimo del mese" : "il "+v);
    case "mon":     return "Mese: "+MONTHS[v];
    case "tag":     return v ? "Etichetta: "+v : "Etichetta rimossa";
    case "place":   return v ? "Luogo: "+v : "Luogo rimosso";
    case "link":    return v ? "Collegamento aggiornato" : "Collegamento rimosso";
    case "note":    return v ? "Nota aggiornata" : "Nota rimossa";
    case "alarm":   return v === undefined ? "Avviso: impostazione generale"
                    : (v === 0 ? "Avviso disattivato" : "Avviso "+v+" min prima");
    case "waiting": return v ? "Messo in attesa" : "Ripreso: torna fra le cose da fare";
    case "recheck": return v ? "Ricontrollo "+dataIl(v) : "Ricontrollo rimosso";
    case "steps":   var pn = (prev.steps||[]).length, nn = (v||[]).length;
                    return nn > pn ? "Passo aggiunto" : nn < pn ? "Passo rimosso" : "Passi aggiornati";
    default:        return "Modifica salvata";
  }
}
/* Una voce ferma o rimandata non può restare fra le priorità di oggi. */
function liberaPriorita(id){
  var t = S.data.top3;
  if (!t || !Array.isArray(t.list)) return;
  t.list = t.list.map(function(e){
    return (e && e.id === id) ? { t: e.t || "", id: null, done: false } : e;
  });
}
function similarNotes(c){
  if (S.simCacheVer !== S.simVer) { S.simCache = {}; S.simCacheVer = S.simVer; }
  var key = normTxt(c.text);
  if (!key) return [];
  if (S.simCache[key]) return S.simCache[key];
  var out = findSimilar(c.text, null);
  S.data.capture.forEach(function(o){
    if (o.id === c.id || o.done) return;
    var sc = similarity(c.text, o.text);
    if (sc >= 0.65) out.push({ kind:"scarico", label:o.text, id:null, score:sc, when:null, area:o.area });
  });
  out = out.sort(function(x,y){ return y.score - x.score; }).slice(0, 2);
  S.simCache[key] = out;
  return out;
}
/* Ricerca su task attivi, note dello scarico e archivio. */
/* Evidenzia la porzione di testo che corrisponde alla ricerca. */
function evid(txt, q){
  var e = esc(txt), n = String(q || "").trim();
  if (n.length < 2) return e;
  var qe = esc(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try { return e.replace(new RegExp("("+qe+")", "ig"), "<mark>$1</mark>"); }
  catch (x) { return e; }
}
/* Se la corrispondenza non è nel nome, mostra il campo e il brano trovato:
   altrimenti il risultato sembra comparire senza motivo. */
function dove(i, q){
  var n = normTxt(q);
  function hit(t){ var x = normTxt(t); return x && (x.indexOf(n) >= 0 || similarity(n, x) >= 0.6); }
  if (i.note && hit(i.note)) return { campo:"nota", testo:i.note };
  if (i.place && hit(i.place)) return { campo:"luogo", testo:i.place };
  if (i.tag && hit(i.tag)) return { campo:"etichetta", testo:i.tag };
  if (i.link && hit(i.link)) return { campo:"collegamento", testo:i.link };
  var p = (i.steps || []).filter(function(x){ return hit(x.t); })[0];
  if (p) return { campo:"passo", testo:p.t };
  return null;
}
function brano(t, q, max){
  t = String(t || "");
  if (t.length <= (max||70)) return t;
  var n = normTxt(q), pos = normTxt(t).indexOf(n);
  if (pos < 0) return t.slice(0, max||70)+"…";
  var da = Math.max(0, pos - 20);
  return (da > 0 ? "…" : "") + t.slice(da, da + (max||70)) + "…";
}
function searchAll(q){
  var n = normTxt(q);
  if (n.length < 2) return { items:[], notes:[], arch:[], corta: n.length === 1 };
  function hit(t){
    var x = normTxt(t);
    return x.indexOf(n) >= 0 || similarity(n, x) >= 0.6;
  }
  return {
    items: S.data.items.filter(function(i){
      if (hit(i.label) || (i.note && hit(i.note)) || (i.place && hit(i.place)) ||
          (i.tag && hit(i.tag)) || (i.link && hit(i.link))) return true;
      return (i.steps || []).some(function(p){ return hit(p.t); });
    }).slice(0, 30),
    notes: S.data.capture.filter(function(c){ return hit(c.text); }).slice(0, 15),
    arch:  (S.data.archive||[]).filter(function(a){ return hit(a.label); }).slice(0, 15)
  };
}
/* Riassume un task in una frase, per poter verificare a colpo d'occhio
   che sia stato interpretato come volevi. */
/* Elenco delle etichette in uso. Un'etichetta è libera: può essere un progetto
   di lavoro, un ambito domestico, un cliente, un corso. */
/* Tinta stabile ricavata dal nome: la stessa etichetta ha sempre lo stesso
   colore, senza doverlo scegliere. Si esprime come tonalità, così il tema
   chiaro e quello scuro la declinano diversamente. */
var TAGHUES = [8, 30, 48, 78, 104, 138, 168, 192, 214, 238, 268, 300, 322, 344];
function tagHue(t){
  /* impronta robusta (FNV-1a) e tavolozza di tinte già distanti fra loro:
     con la somma semplice «Casa» e «Auto» finivano a tre gradi di distanza */
  var s2 = String(t || ""), n = 2166136261;
  for (var i = 0; i < s2.length; i++) {
    n ^= s2.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return TAGHUES[(n >>> 0) % TAGHUES.length];
}
function etichette(){
  var set = {};
  S.data.items.forEach(function(i){ if (i.tag) set[i.tag] = 1; });
  return Object.keys(set).sort(function(a,b){ return a.localeCompare(b); });
}
function sezioneDi(i){
  if (isWaiting(i)) return "In attesa di qualcuno";
  if (isSkipped(i)) return "Oggi, ma saltato";
  if (i.freq === "once") return (i.date === dk()) ? "Oggi" : (i.date > dk() ? "Prossimi appuntamenti" : "fra i ritardi");
  if (onDay(i, S.now)) return "Oggi";
  return i.freq === "weekly" ? "Ogni settimana"
       : i.freq === "monthly" ? "Ogni mese"
       : i.freq === "yearly" ? "Ogni anno" : "Oggi";
}
/* Riepilogo della giornata in testo semplice: leggibile a colpo d'occhio,
   copiabile in una mail o in un messaggio. */
/* Una riga sola che dice che cosa nascerà premendo Aggiungi:
   così nulla resta nascosto pur mostrando un campo solo. */
/* Quanto è carica la giornata: un colpo d'occhio più utile di una percentuale.
   Le soglie sono sulle ore effettivamente pianificate, non sui task. */
/* Dal registro delle ultime due settimane si ricava un fatto: in quali giorni
   della settimana l'abitudine salta davvero. Il suggerimento nasce da lì,
   non da un'ipotesi. */
function analisiRimandi(i){
  if (!i || i.freq !== "daily" || (i.every || 1) !== 1) return null;
  var ign = (S.data.ignora || {})[i.id];
  if (ign && validKey(ign)) {
    var g = Math.round((keyToDate(dk()) - keyToDate(ign)) / 86400000);
    if (g < 14) return null;
  }
  var l = (S.data.log || {})[i.id] || "";
  if (l.length < 7) return null;
  var perGiorno = [0,1,2,3,4,5,6].map(function(){ return { tot:0, miss:0 }; });
  var base = keyToDate(S.data.lastDay || dk());
  for (var n = 0; n < l.length; n++) {
    var d = new Date(base);
    d.setDate(d.getDate() - (l.length - 1 - n));
    var g = perGiorno[d.getDay()];
    g.tot++;
    if (l.charAt(n) === "0") g.miss++;
  }
  var missTot = (l.match(/0/g) || []).length;
  var tasso = missTot / l.length;
  var neri = [], buoni = [];
  perGiorno.forEach(function(g, n){
    if (g.tot < 1) return;
    var r = g.miss / g.tot;
    if (g.tot >= 2 && r >= 0.67) neri.push(n);
    else if (r <= 0.34) buoni.push(n);
  });
  if (neri.length >= 1 && buoni.length >= 2)
    return { tipo:"giorni", giorni:buoni.slice().sort(),
             testo:"Lo salti quasi sempre "+elencoGiorni(neri)+", mentre "+elencoGiorni(buoni)+
                   " lo fai. Trasformalo in una routine solo su quei giorni.",
             azione:"Rendilo settimanale su quei giorni" };
  if (tasso >= 0.5)
    return { tipo:"ogni2",
             testo:"Lo hai saltato "+missTot+" volte su "+l.length+". Un ritmo più realistico "+
                   "regge meglio di uno quotidiano disatteso.",
             azione:"Passa a un giorno sì e uno no" };
  if (typeof i.start === "number" && tasso >= 0.3)
    return { tipo:"noora",
             testo:"L'orario delle "+fmt(i.start)+" non regge: lo salti "+missTot+" volte su "+l.length+
                   ". Senza orario fisso resta fra le cose di oggi finché non lo fai.",
             azione:"Togli l'orario fisso" };
  return null;
}
var GIORNI_ESTESI = ["la domenica","il lunedì","il martedì","il mercoledì",
                     "il giovedì","il venerdì","il sabato"];
function elencoGiorni(gg){
  var nomi = gg.map(function(n){ return GIORNI_ESTESI[n]; });
  if (nomi.length === 1) return nomi[0];
  return nomi.slice(0,-1).join(", ")+" e "+nomi[nomi.length-1];
}
/* Primo spazio libero della giornata capace di contenere una durata. */
function slotLibero(dur, dopo){
  var d2 = dur > 0 ? dur : 1;
  var inizio = Math.max(dopo === undefined ? (isToday() ? nowH() : 8) : dopo, 7);
  var occupati = S.data.items.filter(function(i){
    return typeof i.start === "number" && onDay(i, cursor()) && !isSkipped(i);
  }).map(function(i){ return [i.start, i.start + (i.dur || 0.5)]; })
    .sort(function(a,b){ return a[0] - b[0]; });
  var t = Math.ceil(inizio * 4) / 4;
  var limite = 22;
  while (t + d2 <= limite) {
    var scontro = occupati.filter(function(o){ return t < o[1] && (t + d2) > o[0]; })[0];
    if (!scontro) return t;
    t = Math.ceil(scontro[1] * 4) / 4;
  }
  return null;
}
function caricoGiornata(ore){
  if (ore <= 0)  return { id:"vuota",   testo:"libera",  nota:"nessun impegno a orario" };
  if (ore < 2)   return { id:"leggera", testo:"leggera", nota:"meno di 2 ore pianificate" };
  if (ore <= 5)  return { id:"media",   testo:"normale", nota:"fra 2 e 5 ore pianificate" };
  if (ore <= 8)  return { id:"piena",   testo:"piena",   nota:"fra 5 e 8 ore pianificate" };
  return { id:"troppo", testo:"sovraccarica", nota:"oltre 8 ore pianificate" };
}
/* La prossima cosa che ti aspetta, per non doverla cercare nell'agenda. */
function prossimaCosa(){
  if (!isToday()) return null;
  var oggi = dueOn(S.now).filter(function(i){ return !isOn(i) && !isSkipped(i); });
  var conOra = oggi.filter(function(i){ return typeof i.start === "number"; })
                   .sort(function(a,b){ return a.start - b.start; });
  var futura = conOra.filter(function(i){ return (i.start + (i.dur||0.5)) > nowH(); })[0];
  return futura || null;
}
function riassuntoNuovo(){
  var p = [];
  var f = (FREQS.filter(function(x){ return x.id === S.ui.freq; })[0] || {}).every || "";
  if (S.ui.freq === "once") p.push(shortDate(S.ui.date || dk()));
  else p.push(f.toLowerCase());
  if (S.ui.freq === "daily" && (S.ui.everyd || 1) > 1) p[0] = "ogni "+S.ui.everyd+" giorni";
  p.push(AREAS[S.ui.area] ? AREAS[S.ui.area].label.toLowerCase() : "lavoro");
  if (S.ui.start !== "") p.push(fmt(parseFloat(S.ui.start))+" · "+dur2s(parseFloat(S.ui.dur || 1)));
  if (S.tagF && S.tagF !== "tutti" && S.tagF !== "__senza") p.push("etichetta "+S.tagF);
  return p.join(" · ");
}
function riepilogo(){
  var oggi = dueOn(S.now);
  var vivi = oggi.filter(function(i){ return !isSkipped(i); });
  var fatti = vivi.filter(isOn).length;
  var conOra = vivi.filter(function(i){ return typeof i.start === "number"; })
                   .sort(function(a,b){ return a.start - b.start; });
  var senzaOra = vivi.filter(function(i){ return typeof i.start !== "number"; });
  var ore = conOra.reduce(function(s2,i){ return s2 + (i.dur||0.5); }, 0);
  var L = top3().filter(function(e){ return e.id || e.t.trim(); });
  var tardi = vivi.filter(isLate);
  var scaduti = S.data.items.filter(function(i){
    return i.freq === "once" && !isOn(i) && !isWaiting(i) && i.date < dk() && visible(i);
  });
  var scad = S.data.items.filter(function(i){
    if (!visible(i) || isOn(i)) return false;
    var d2 = dueInfo(i);
    return d2 && d2.days <= 7;
  }).sort(function(a,b){ return dueInfo(a).days - dueInfo(b).days; });
  var attesa = S.data.items.filter(function(i){
    return i.waiting && visible(i) && validKey(i.recheck) && i.recheck <= dk();
  });
  var note = S.data.capture.filter(function(c){ return !c.done && visible(c); });
  return { oggi:vivi, fatti:fatti, conOra:conOra, senzaOra:senzaOra, ore:ore, tre:L,
           tardi:tardi, scaduti:scaduti, scadenze:scad, attesa:attesa, note:note,
           saltati: oggi.filter(isSkipped) };
}
function riepilogoTesto(){
  var r = riepilogo(), out = [];
  out.push(S.now.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase());
  out.push("");
  out.push(r.oggi.length+" cose in programma, "+r.fatti+" già fatte · "+dur2s(r.ore||0)+" pianificate");
  if (r.tre.length) {
    out.push(""); out.push("LE TRE COSE CHE CONTANO");
    r.tre.forEach(function(e, n){
      var li = e.id ? itemById(e.id) : null;
      var d3 = li ? isOn(li) : e.done;
      out.push("  "+(n+1)+". ["+(d3?"x":" ")+"] "+(li ? li.label : e.t));
    });
  }
  if (r.tardi.length || r.scaduti.length) {
    out.push(""); out.push("RIMASTE INDIETRO");
    r.scaduti.forEach(function(i){ out.push("  ! "+i.label+" — scaduto "+dataIl(i.date)); });
    r.tardi.forEach(function(i){ out.push("  ! "+i.label+" — era alle "+fmt(i.start)); });
  }
  if (r.conOra.length) {
    out.push(""); out.push("AGENDA");
    r.conOra.forEach(function(i){
      out.push("  "+fmt(i.start)+"–"+fmt(i.start+(i.dur||0.5))+"  ["+(isOn(i)?"x":" ")+"] "+i.label+
        (i.tag ? "  ["+i.tag+"]" : "")+(i.place ? "  @ "+i.place : ""));
    });
  }
  if (r.senzaOra.length) {
    out.push(""); out.push("SENZA ORARIO");
    r.senzaOra.forEach(function(i){
      out.push("  ["+(isOn(i)?"x":" ")+"] "+i.label+(i.tag ? "  ["+i.tag+"]" : ""));
    });
  }
  if (r.scadenze.length) {
    out.push(""); out.push("SCADENZE ENTRO SETTE GIORNI");
    r.scadenze.forEach(function(i){ out.push("  · "+i.label+" — "+dueInfo(i).label); });
  }
  if (r.attesa.length) {
    out.push(""); out.push("DA RICONTROLLARE");
    r.attesa.forEach(function(i){ out.push("  · "+i.label); });
  }
  var sm = soldiMese(S.now);
  if (sm.voci) {
    out.push(""); out.push("DENARO PREVISTO QUESTO MESE");
    if (sm.uscite) out.push("  uscite  "+euro(sm.uscite));
    if (sm.entrate) out.push("  entrate "+euro(sm.entrate));
  }
  if (r.note.length) { out.push(""); out.push("Nello scarico: "+r.note.length+" da smistare"); }
  if (r.saltati.length) { out.push("Saltate oggi: "+r.saltati.length); }
  return out.join("\n");
}
/* "appuntamento del oggi" era un errore: le date relative non vogliono
   l'articolo. Queste tre funzioni scelgono la preposizione corretta. */
function relativa(k){
  var t = shortDate(k);
  return t === "oggi" || t === "domani" || t === "ieri";
}
function dataDi(k){ return relativa(k) ? "di "+shortDate(k) : "del "+shortDate(k); }
function dataIl(k){ return relativa(k) ? shortDate(k) : "il "+shortDate(k); }
function dataAl(k){ return relativa(k) ? "a "+shortDate(k) : "al "+shortDate(k); }
var PAROLE_BANCA = new RegExp([
  "mutu","bollett","bonific","pagament","\\bpagare\\b","bollettin","\\bmav\\b","\\brav\\b",
  "pagopa","\\brid\\b","\\bsdd\\b","addebit","versament","prelev","prelievo","ricarica",
  "\\brat[ae]\\b","\\brate\\b","finanziament","prestito","leasing",
  "assicuraz","polizza","premio","\\brc auto\\b",
  "\\bf24\\b","\\bimu\\b","\\btari\\b","\\btasi\\b","irpef","tass[ae]","imposta","tribut",
  "canone","affitto","condominio","utenz",
  "estratto conto","\\bsaldo\\b","\\biban\\b","carta di credito","\\bbanca\\b","home banking"
].join("|"), "i");
/* Quante voci puntano a un certo indirizzo: serve a mostrare in anticipo
   che cosa cambierà una sostituzione in blocco. */
function contaLink(frammento){
  var f = String(frammento || "").trim().toLowerCase();
  if (f.length < 4) return [];
  return S.data.items.filter(function(i){
    return i.link && i.link.toLowerCase().indexOf(f) >= 0;
  });
}
/* Sposta un collegamento da una posizione all'altra. Usato sia dalle frecce
   sia dal trascinamento: una logica sola, così si comportano identicamente. */
function muoviLink(da, a){
  var L = S.data.links || [];
  if (!(da >= 0 && da < L.length) || !(a >= 0 && a < L.length) || da === a) return false;
  var copia = L.slice();
  var voce = copia.splice(da, 1)[0];
  copia.splice(a, 0, voce);
  S.data.links = copia;
  return true;
}
function urlBanca(){
  var l = (S.data.links || []).filter(function(x){ return /banc|bmed|home banking/i.test(x.name || ""); })[0];
  return l && safeUrl(l.url) ? l.url : "";
}
function euro(n){
  try { return new Intl.NumberFormat("it-IT", { style:"currency", currency:"EUR" }).format(n); }
  catch (e) { return (Math.round(n*100)/100).toFixed(2)+" €"; }
}
/* Somma di quanto entra ed esce nel mese mostrato, contando le occorrenze
   reali di ogni voce. Non è contabilità: è una previsione del mese. */
function soldiMese(rif){
  var d0 = new Date(rif.getFullYear(), rif.getMonth(), 1);
  var giorni = new Date(rif.getFullYear(), rif.getMonth()+1, 0).getDate();
  var out = { uscite:0, entrate:0, voci:0 };
  var conta = {};
  for (var g = 0; g < giorni; g++) {
    var d = new Date(rif.getFullYear(), rif.getMonth(), g+1);
    S.data.items.forEach(function(i){
      if (!(i.importo > 0) || !visible(i)) return;
      if (!onDay(i, d)) return;
      if (i.entrata) out.entrate += i.importo; else out.uscite += i.importo;
      conta[i.id] = 1;
    });
  }
  out.voci = Object.keys(conta).length;
  return out;
}
function describe(i){
  var o = [];
  if (i.freq === "once") o.push("appuntamento "+dataDi(i.date));
  else if (i.freq === "daily") o.push((i.every > 1) ? "ogni "+i.every+" giorni" : "ogni giorno");
  else if (i.freq === "weekly") o.push(i.flessibile ? "una volta a settimana, quando capita" : daysLabel(i));
  else if (i.freq === "monthly") o.push(i.flessibile ? "una volta al mese, quando capita" : "ogni mese, "+domLabel(i));
  else if (i.freq === "yearly")
    o.push("ogni anno, "+(domOf(i) === 0 ? "ultimo giorno di " : domOf(i)+" ")+MONTHS[i.mon || 0]);
  o.push(typeof i.start === "number"
    ? fmt(i.start)+"–"+fmt(i.start + (i.dur || 0.5))
    : "senza orario");
  o.push(AREAS[i.area].label.toLowerCase());
  if (i.tag) o.push("etichetta "+i.tag);
  if (i.importo > 0)
    h += '<button class="slot soldi'+(i.entrata?" entrata":"")+'" data-act="open" data-id="'+i.id+'" '+
         'title="'+(i.entrata?"Entrata":"Uscita")+'">'+(i.entrata?"+":"−")+esc(euro(i.importo))+'</button>';
  var di = dueInfo(i); if (di) o.push("scadenza "+di.label);
  var si = stepsInfo(i); if (si.tot) o.push(si.tot+(si.tot === 1 ? " passo" : " passi"));
  if (i.place) o.push("luogo indicato");
  if (safeUrl(i.link)) o.push("collegamento");
  if (i.alarm !== undefined) o.push(i.alarm === 0 ? "senza avviso" : "avviso "+i.alarm+" min prima");
  if (i.importo > 0) o.push((i.entrata ? "+" : "−")+euro(i.importo));
  if (validKey(i.fine)) o.push("fino al "+shortDate(i.fine));
  if (isWaiting(i)) o.push("in attesa"+(validKey(i.recheck) ? " fino "+dataAl(i.recheck) : ""));
  else if (i.waiting) o.push("da ricontrollare");
  if (isSkipped(i)) o.push("saltato per questa volta");
  return o.join(" · ");
}
function inDays(n){ var d = new Date(); d.setDate(d.getDate()+n); return dayKey(d); }

function layout(list){
  var sorted = list.slice().sort(function(a,b){
    return (a.start - b.start) || ((b.dur||0.5) - (a.dur||0.5));
  });
  var out = [], cluster = [], clusterEnd = null;
  function flush(){
    var lanes = [];
    var placed = cluster.map(function(b){
      var li = -1;
      for (var i = 0; i < lanes.length; i++) if (lanes[i] <= b.start + 1e-6) { li = i; break; }
      if (li === -1) li = lanes.length;
      lanes[li] = b.start + (b.dur||0.5);
      return { item: b, lane: li };
    });
    placed.forEach(function(p){ out.push({ item:p.item, lane:p.lane, lanes:lanes.length }); });
    cluster = [];
  }
  sorted.forEach(function(b){
    var end = b.start + (b.dur||0.5);
    if (cluster.length && b.start >= clusterEnd - 1e-6) { flush(); clusterEnd = null; }
    cluster.push(b);
    clusterEnd = clusterEnd === null ? end : Math.max(clusterEnd, end);
  });
  if (cluster.length) flush();
  return out;
}



/* somma giorni a una chiave data, restando in fuso locale */
function addDays(key, n){
  var d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}


var GIORNI_LUNGHI = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
/* ora decimale → "HH:MM", per i campi di tipo time */
function oraHHMM(o){
  var h = Math.floor(o), m = Math.round((o - h) * 60);
  if (m === 60) { h++; m = 0; }
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}
function hhmmOra(v){
  var p = String(v || "").split(":");
  var o = parseInt(p[0], 10) + (parseInt(p[1], 10) || 0) / 60;
  return (o >= 0 && o <= 24) ? o : null;
}


/* I sette giorni della settimana che contiene il cursore. È un calcolo di
   date, non disegno: lo usano l'agenda e le intestazioni degli elenchi. */
function weekDays(){
  var c = cursor(), ws = new Date(c);
  ws.setDate(c.getDate() - ((c.getDay()+6)%7));
  var out = [];
  for (var n = 0; n < 7; n++) { var d = new Date(ws); d.setDate(ws.getDate()+n); out.push(d); }
  return out;
}
