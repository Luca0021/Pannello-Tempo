/* templates.js — modelli di giornata.
   Salvano la forma di una giornata tipo: priorità suggerite, attività, routine
   e blocchi orari. Applicare un modello non duplica i task esistenti: crea le
   voci mancanti e salta quelle già presenti. */

function nuovoModello(nome){
  return {
    id: uid(), nome: nome || "Giornata tipo",
    creatoIl: new Date().toISOString(),
    priorita: [],        /* testi suggeriti */
    voci: [],            /* { label, area, freq, start, dur, days, dom } */
    giorni: []           /* giorni della settimana in cui ha senso proporlo */
  };
}

/* Costruisce un modello dal giorno mostrato: quello che vedi è quello che salvi. */
function modelloDaGiorno(nome){
  var mod = nuovoModello(nome);
  mod.priorita = top3().map(function(e){
    if (!e) return "";
    if (e.id) { var it = itemById(e.id); return it ? it.label : ""; }
    return e.t || "";
  }).filter(function(t){ return t; });
  mod.voci = dueOn(cursor()).filter(function(i){ return !isSkipped(i); }).map(function(i){
    var v = { label: i.label, area: i.area, freq: i.freq };
    if (typeof i.start === "number") { v.start = i.start; v.dur = i.dur || 0.5; }
    if (Array.isArray(i.days)) v.days = i.days.slice();
    if (i.dom !== undefined) v.dom = i.dom;
    if (i.tag) v.tag = i.tag;
    return v;
  });
  mod.giorni = [cursor().getDay()];
  return mod;
}

function salvaModello(mod){
  if (!mod || !mod.nome) return false;
  S.data.modelli = S.data.modelli || [];
  var i = S.data.modelli.map(function(x){ return x.id; }).indexOf(mod.id);
  if (i >= 0) S.data.modelli[i] = mod; else S.data.modelli.push(mod);
  commit();
  return true;
}
function eliminaModello(id){
  snapshot("Il modello di giornata è stato eliminato.", "Vuoi annullare l'eliminazione?");
  S.data.modelli = (S.data.modelli || []).filter(function(m2){ return m2.id !== id; });
  commit();
}
function duplicaModello(id){
  var o = (S.data.modelli || []).filter(function(m2){ return m2.id === id; })[0];
  if (!o) return null;
  var c = JSON.parse(JSON.stringify(o));
  c.id = uid(); c.nome = o.nome + " (copia)"; c.creatoIl = new Date().toISOString();
  S.data.modelli.push(c);
  commit();
  return c;
}

/* Anteprima: che cosa verrebbe creato e che cosa esiste già. Serve a evitare
   che applicare un modello riempia la giornata di doppioni. */
function anteprimaModello(id, giornoKey){
  var mod = (S.data.modelli || []).filter(function(m2){ return m2.id === id; })[0];
  if (!mod) return null;
  var k = giornoKey || dk();
  var esistenti = dueOn(keyToDate(k)).map(function(i){ return normTxt(i.label); });
  var nuove = [], gia = [];
  mod.voci.forEach(function(v){
    if (esistenti.indexOf(normTxt(v.label)) >= 0) gia.push(v); else nuove.push(v);
  });
  return { modello: mod, giorno: k, nuove: nuove, gia: gia,
           priorita: mod.priorita.slice(0, 3) };
}

function applicaModello(id, giornoKey){
  var a = anteprimaModello(id, giornoKey);
  if (!a) return null;
  snapshot("Hai applicato il modello «"+a.modello.nome+"» al "+shortDate(a.giorno)+".",
           "Vuoi annullare l'applicazione?");
  var creati = [];
  a.nuove.forEach(function(v){
    var o = { id: uid(), label: v.label, area: v.area, freq: v.freq };
    if (v.start !== undefined) { o.start = v.start; o.dur = v.dur; }
    if (v.days) o.days = v.days.slice();
    if (v.dom !== undefined) o.dom = v.dom;
    if (v.tag) o.tag = v.tag;
    if (v.freq === "once") o.date = a.giorno;
    S.data.items.push(o);
    creati.push(o.id);
  });
  if (a.priorita.length && a.giorno === dk()) {
    var lista = [0,1,2].map(function(n){
      return a.priorita[n] ? { t: a.priorita[n], id: null, done: false } : { t:"", id:null, done:false };
    });
    S.data.top3 = { key: a.giorno, list: lista };
  }
  normalizeData();
  commit();
  return { creati: creati.length, saltati: a.gia.length };
}
