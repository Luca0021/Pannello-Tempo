/* actions.js — completamento, modifica, spostamenti
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- azioni ---------- */
/* Registra quando una cosa è stata davvero completata. Serve ai suggerimenti
   sugli orari: senza questo dato «spostalo alle 20:30» sarebbe un'invenzione. */
function registraCompletamento(it, acceso){
  if (!it) return;
  S.data.completamenti = S.data.completamenti || [];
  S.data.completamenti = S.data.completamenti.filter(function(c){
    return !(c.id === it.id && c.data === dk());
  });
  if (!acceso) return;                 /* togliendo la spunta si annulla */
  var adesso = S.now || new Date();
  S.data.completamenti.push({
    id: it.id, data: dk(),
    ora: Math.round((adesso.getHours() + adesso.getMinutes()/60) * 100) / 100,
    oraPrevista: (typeof it.start === "number") ? it.start : null,
    durata: (typeof it.start === "number") ? (it.dur || 0.5) : null,
    area: it.area
  });
  if (S.data.completamenti.length > 1200) S.data.completamenti = S.data.completamenti.slice(-1200);
}

function toggleItem(item){
  var st = stampFor(item.freq);
  if (S.data.skips) delete S.data.skips[item.id];
  if (S.data.checks[item.id] === st) delete S.data.checks[item.id];
  else S.data.checks[item.id] = st;
  if (S.data.checks[item.id]) {
    S.data.doneAt[item.id] = dk();
    if (item.waiting) {
      S.data.items = S.data.items.map(function(x){
        if (x.id !== item.id) return x;
        var y = Object.assign({}, x); delete y.waiting; delete y.recheck; return y;
      });
    }
  } else delete S.data.doneAt[item.id];
  registraCompletamento(item, !!S.data.checks[item.id]);
  if (Array.isArray(item.steps) && item.steps.length) {
    var acceso = S.data.checks[item.id] === st;
    S.data.items = S.data.items.map(function(x){
      if (x.id !== item.id) return x;
      return Object.assign({}, x, {
        /* «una» va conservato: altrimenti gli extra della settimana
           diventerebbero voci fisse appena spunti il task */
        steps: x.steps.map(function(p){
          return { t: p.t, s: acceso ? st : undefined, una: p.una };
        })
      });
    });
  }
  commit();
}
function patch(id, f){
  if (f.label !== undefined) bumpSim();
  var prev = itemById(id);
  var msg = diffMsg(prev, f);
  S.data.items = S.data.items.map(function(i){
    if (i.id !== id) return i;
    var o = Object.assign({}, i, f);
    Object.keys(f).forEach(function(k){ if (f[k] === undefined) delete o[k]; });
    return o;
  });
  if (msg) {
    /* mentre il pannello di modifica è aperto le modifiche si accumulano
       e vengono riassunte alla chiusura, invece di un avviso per campo */
    if (S.editId === id) {
      if (!S.pending || S.pending.id !== id) S.pending = { id: id, list: [] };
      var kf = Object.keys(f)[0];
      S.pending.list = S.pending.list.filter(function(x){ return x[0] !== kf; });
      S.pending.list.push([kf, msg]);
    } else toast(msg, "info");
  }
  commit();
}
function flushPending(){
  var p = S.pending;
  S.pending = null;
  if (!p || !p.list.length) return;
  if (!itemById(p.id)) return;
  S.flash = { id: p.id, kind: "Aggiornato", changes: p.list.map(function(x){ return x[1]; }) };
}



/* REC-002 — sposta una voce in ritardo conservando tutto il resto:
   checklist, note, etichette, collegamenti e importi restano dov'erano. */
function spostaRitardo(it, giorno, ora){
  if (!it || !validKey(giorno)) return false;
  snapshot("Spostata «"+it.label+"» al "+shortDate(giorno)+
           (ora !== null && ora !== undefined ? " alle "+fmt(ora) : "")+".",
           "Vuoi annullare lo spostamento?");
  var mod = {};
  if (it.freq === "once") mod.date = giorno;
  else mod.due = giorno;                 /* una routine non cambia serie: si dà una scadenza */
  if (ora !== null && ora !== undefined) { mod.start = ora; if (!it.dur) mod.dur = 0.5; }
  patch(it.id, mod);
  if (S.data.skips) delete S.data.skips[it.id];
  S.data.rinvii = S.data.rinvii || {};
  S.data.rinvii[it.id] = (S.data.rinvii[it.id] || 0) + 1;
  S.ripianifica = null;
  commit();
  toast("Spostata a "+shortDate(giorno)+(ora !== null && ora !== undefined ? " · "+fmt(ora) : ""), "ok");
  return true;
}


/* Toglie ogni riferimento a una voce che non esiste più: priorità collegate,
   spunte, registri, ripianificazioni, completamenti. Una priorità che punta a un
   task eliminato resterebbe appesa senza modo di toglierla. */
function ripulisciRiferimenti(id){
  /* SYN-004: la cancellazione va propagata, non solo eseguita: senza lapide
     il record tornerebbe dal cloud alla prossima sincronizzazione. */
  if (typeof segnaCancellato === "function") segnaCancellato(id);
  delete S.data.checks[id];
  delete S.data.doneAt[id];
  delete S.data.log[id];
  if (S.data.skips) delete S.data.skips[id];
  if (S.data.rinvii) delete S.data.rinvii[id];
  if (S.data.ignora) delete S.data.ignora[id];
  if (S.data.top3 && Array.isArray(S.data.top3.list))
    S.data.top3.list = S.data.top3.list.map(function(e){
      return (e && e.id === id) ? { t:"", id:null, done:false } : e;
    });
  S.data.completamenti = (S.data.completamenti || []).filter(function(c){ return c.id !== id; });
}
