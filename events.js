/* events.js — gestori di clic, cambio, tastiera
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- interazione ---------- */
function shift(n, unit){
  S.nuovo = null;   /* la proposta vale per il giorno da cui è nata */
  var d = keyToDate(S.cursorKey);
  if (unit === "y") d.setFullYear(d.getFullYear()+n);
  else if (unit === "m") d.setMonth(d.getMonth()+n);
  else if (unit === "w") d.setDate(d.getDate()+n*7);
  else d.setDate(d.getDate()+n);
  S.cursorKey = dayKey(d);
  render();
}

/* Azioni dopo le quali la pagina cambia del tutto: ancorare sarebbe sbagliato. */
var ANCORA_MAI = ["digest","search","vaioggi","vaiagenda","vairitardi","gotoday",
  "onb-avanti","onb-indietro","onb-salta","onb-fine","onb-demo","onb-apri",
  "ch-apri","ch-avanti","ch-indietro","ch-salva","ch-annulla",
  "rv-apri","rv-chiudi","rv-salva","rv-rinvia","menunuovo",
  "nuovotask","nuovanota","nuovaroutine","profilo"];

document.addEventListener("click", function(ev){
  var el = ev.target.closest("[data-act]");
  if (!el) return;
  var act = el.getAttribute("data-act");
  /* Ogni comando ancora la vista al punto in cui è stato premuto. Prima lo
     facevano solo alcune azioni, e le altre facevano saltare la pagina: se
     una scheda sopra cambia altezza, tutto il resto scorre sotto il dito. */
  if (ANCORA_MAI.indexOf(act) < 0) ancoraA(el);
  var id = el.getAttribute("data-id");
  var v = el.getAttribute("data-v");
  var n = parseInt(el.getAttribute("data-n"), 10);
  var it = id ? itemById(id) : null;
  var L;

  if (act === "filter") {
    S.filter = v;
    /* se stai guardando solo Vita, ciò che crei nasce Vita:
       il modulo segue il contesto invece di ripartire sempre da Lavoro */
    if (v === "lavoro" || v === "vita") { S.ui.area = v; S.ui.capArea = v; }
    render();
  }
  else if (act === "view") { S.view = v; S.wkPick = null; S.nuovo = null; render(); }
  else if (act === "shift") { S.wkPick = null; shift(n, el.getAttribute("data-u")); }
  /* BUG: queste voci facevano SOLO uno scorrimento. Non cambiavano stato, non
     ridisegnavano, e la voce attiva nella navigazione non si spostava: al primo
     clic non succedeva niente di visibile e si cliccava una seconda volta.
     Ora la sezione corrente è uno stato vero; lo scorrimento viene dopo il
     disegno, altrimenti cercherebbe un bersaglio che non esiste ancora. */
  else if (act === "vaioggi" || act === "vaiagenda" || act === "vairitardi") {
    var sez = { vaioggi:"oggi", vaiagenda:"agenda", vairitardi:"riprogrammare" }[act];
    S.sezione = sez;
    /* uscire da ciò che copre il pannello: restare nel riepilogo dopo aver
       premuto «Oggi» era un altro modo di non rispondere al clic */
    S.digest = false; S.menuNuovo = false; S.searchOpen = false; S.query = "";
    if (sez === "agenda") { S.ancora = null; S.inCima = false; }
    render();
    var mira = { oggi:'[data-sez="today"]', agenda:'[data-sez="agenda"]',
                 riprogrammare:'[data-sez="recupera"]' }[sez];
    var dove = document.getElementById("app");
    var bersaglio = dove && dove.querySelector ? dove.querySelector(mira) : null;
    /* se la sezione non c'è — spenta, filtrata via, vuota — non si finge che
       il clic abbia funzionato: si dice perché */
    if (bersaglio && bersaglio.scrollIntoView)
      bersaglio.scrollIntoView({ block:"start", behavior:"smooth" });
    else if (sez === "riprogrammare") toast("Non hai niente da riprogrammare", "ok");
    else if (sez === "agenda") toast("L'agenda è spenta nelle impostazioni", "info");
  }
  else if (act === "gotoday") { S.cursorKey = dk(); S.wkPick = null; S.nuovo = null; render(); }
  else if (act === "nowjump") {
    S.cursorKey = dk(); S.wkPick = null; S.nuovo = null; S.view = "giorno"; S.scrollToNow = true;
    render();
  }
  else if (act === "toggle" && it) { toggleItem(it); }
  else if (act === "del" && it) {
    S.pending = null;
    snapshot("Il task «"+it.label+"» è stato eliminato.", "Vuoi annullare l'eliminazione?");
    delete S.data.checks[id];
    delete S.data.doneAt[id];
    delete S.data.log[id];
    if (S.data.skips) delete S.data.skips[id];
    if (S.data.top3 && Array.isArray(S.data.top3.list))
      S.data.top3.list = S.data.top3.list.map(function(e){
        return (e && e.id === id) ? { t:"", id:null, done:false } : e;
      });
    S.data.items = S.data.items.filter(function(x){ return x.id !== id; });
    bumpSim();
    if (S.editId === id) S.editId = null;
    if (S.stepsOpen === id) S.stepsOpen = null;
    commit();
  }
  else if (act === "slot" && it) {
    S.nuovo = null;
    S.editFrom = "list"; S.editId = id; S.editCtx = null;
    if (it.freq === "once" && it.date) S.cursorKey = it.date;
    render();
  }
  else if (act === "openday" && it) { S.editFrom = "list"; S.editId = id; S.cursorKey = it.date || dk(); render(); }
  else if (act === "openblk") { S.cursorKey = el.getAttribute("data-day"); S.view = "giorno"; S.editId = id; render(); }
  else if (act === "wkpick") { S.wkPick = { id:id, day: el.getAttribute("data-day") }; render(); }
  else if (act === "editclose") {
    flushPending();
    S.editId = null; S.editCtx = null; render();
    if (sync.pendingPull) pullNow();
  }
  else if (act === "trovaposto" && it) {
    /* prima fascia libera della giornata, dopo l'ora attuale */
    var quando = slotLibero(it.dur || 1);
    if (quando === null) { toast("Nessuno spazio libero oggi entro le 22", "info"); render(); return; }
    var extra = { start: quando, dur: it.dur || 1 };
    if (it.freq === "once") extra.date = dk();
    patch(id, extra);
    toast("Messo alle "+fmt(quando), "ok");
  }
  /* REC-002 — le cinque decisioni sui ritardi */
  /* TOP-002 — righe progressive, riordino accessibile, scollegamento */
  else if (act === "onb-profilo" && S.onboarding) { S.onboarding.profilo = v; render(); }
  else if (act === "onb-area1" && S.onboarding) { S.onboarding.areaPrima = v; S.onboarding.aree[0] = v; render(); }
  else if (act === "onb-areatask" && S.onboarding) { S.onboarding.areaTask = v; render(); }
  /* SYN-004 — la decisione su un singolo record */
  else if (act === "conf-locale" || act === "conf-cloud" || act === "conf-entrambi") {
    var cf = (S.conflitti || [])[n];
    if (!cf) return;
    snapshot("Hai scelto quale versione tenere per «"+
             ((cf.locale && cf.locale.label) || (cf.remoto && cf.remoto.label) || cf.id)+"».",
             "Vuoi tornare indietro?");
    risolviRecord(cf, act === "conf-locale" ? "locale"
                    : act === "conf-cloud" ? "cloud" : "entrambi");
    S.conflitti = S.conflitti.filter(function(x, i){ return i !== n; });
    if (!S.conflitti.length) {
      /* deciso tutto: applico la fusione e riprendo la sincronizzazione */
      S.conflitti = null; S.datiFusi = null;
      if (sync.revRemota) { sync.rev = sync.revRemota; sync.revRemota = 0; }
      sync.dirty = true;
      setStatus("conflitti risolti");
      commit();
      pushNow(true);
      return;
    }
    commit();
  }
  else if (act === "conf-rinvia") { S.conflitti = null; S.datiFusi = null; render(); }
  else if (act === "lavoro-annulla") { annullaLavoro(); }
  /* la guida dentro il pannello */
  else if (act === "guida") { S.guidaAperta = v || ""; S.guidaQuery = ""; render(); }
  else if (act === "guida-chiudi") { S.guidaAperta = null; S.guidaQuery = ""; render(); }
  else if (act === "guida-sez") { S.guidaAperta = (S.guidaAperta === v) ? "" : v; render(); }
  else if (act === "guida-azzera") { S.guidaQuery = ""; render(); }
  /* REC-005 — le tre risposte alla domanda sull'accumulo */
  else if (act === "acc-oggi" || act === "acc-archivia" || act === "acc-dopo") {
    var risp = act === "acc-oggi" ? "oggi" : act === "acc-archivia" ? "archivia" : "dopo";
    var e2 = rispondiAccumulo(id, risp);
    if (e2.ok) toast(e2.testo, "ok");
    render();
  }
  else if (act === "acc-spegni") {
    spegniAccumulo();
    toast("Non te lo chiedo più. Puoi riaccenderlo dalle impostazioni.", "ok");
    render();
  }
  else if (act === "attiv-chiudi") { chiudiAttivazione(); render(); }
  /* TOP-005 — accettare o rifiutare le proposte */
  else if (act === "sugg-ok") {
    var es = accettaSuggerimento(id);
    toast(es.testo || (es.ok ? "Fatto" : "Non riuscito"), es.ok ? "ok" : "info");
    render();
  }
  else if (act === "sugg-spegni") {
    spegniSuggerimenti();
    toast("Non ti propongo più niente. Riaccendibile dalle impostazioni.", "ok");
    render();
  }
  else if (act === "ppiu") { S.piuPriorita = true; render(); }
  else if (act === "psu" || act === "pgiu") {
    var da = n, a2 = (act === "psu") ? n-1 : n+1;
    var lista = top3().slice();
    if (a2 < 0 || a2 > 2 || !lista[da]) return;
    var tmp = lista[da]; lista[da] = lista[a2] || { t:"", id:null, done:false }; lista[a2] = tmp;
    S.data.top3 = { key: dk(), list: lista };
    commit();
    toast("Priorità riordinate", "ok");
  }
  else if (act === "pscollega") {
    var l2 = top3().slice();
    if (!l2[n] || !l2[n].id) return;
    var itc = itemById(l2[n].id);
    /* il task resta: si toglie solo il legame */
    l2[n] = { t: itc ? itc.label : "", id: null, done: false };
    S.data.top3 = { key: dk(), list: l2 };
    commit();
    toast("Scollegata: il task resta nella sua lista", "ok");
  }
  /* REC-003 — selezione e azioni di gruppo sugli arretrati */
  /* TSK-007 — selezione multipla negli elenchi */
  else if (act === "sel-entra") { S.modoSelezione = "sez:"+v; azzeraSelezione(); render(); }
  else if (act === "sel-esci") { S.modoSelezione = null; azzeraSelezione(); render(); }
  else if (act === "sel-riga") { commutaSelezione(id); render(); }
  else if (act === "sel-tutte") {
    var lista = (v === "today") ? dueOn(S.now)
              : (v === "waiting") ? S.data.items.filter(isWaiting)
              : S.data.items.filter(function(x){ return x && x.freq === v; });
    selezionaTutti(lista.filter(visible).map(function(x){ return x.id; }), true);
    render();
  }
  else if (act === "arr-scegli") { commutaSelezione(id); render(); }
  else if (act === "arr-tutti") { S.mostraTuttiArretrati = true; render(); }
  else if (act === "mass-annulla") { azzeraSelezione(); render(); }
  else if (act === "mass-tutte" || act === "mass-vecchie" || act === "mass-fascia") {
    var arr = (S.data.items || []).filter(function(x){
      return x && x.freq === "once" && !isOn(x) && validKey(x.date) && x.date < dk();
    });
    if (act === "mass-vecchie")
      arr = arr.filter(function(x){ return fasciaEta(giorniDiRitardo(x)) === "oltre"; });
    if (act === "mass-fascia")
      arr = arr.filter(function(x){ return fasciaEta(giorniDiRitardo(x)) === v; });
    selezionaTutti(arr.map(function(x){ return x.id; }), true);
    render();
  }
  /* Un caso per azione, invece di un'espressione regolare: il controllo
     strutturale legge i confronti letterali, e un gestore che non sa vedere è
     un gestore che non protegge da azioni orfane. Sull'attesa non si chiede da
     chi dipende: ha senso su una voce, non su venti. */
  else if (act === "mass-completa") { eseguiMassiva("completa"); }
  else if (act === "mass-oggi")     { eseguiMassiva("oggi"); }
  else if (act === "mass-domani")   { eseguiMassiva("domani"); }
  else if (act === "mass-attesa")   { eseguiMassiva("attesa"); }
  else if (act === "mass-archivia") { eseguiMassiva("archivia"); }
  else if (act === "ripianifica") { S.ripianifica = (S.ripianifica === id) ? null : id; render(); }
  else if (act === "rip-chiudi") { S.ripianifica = null; render(); }
  else if (act === "rip-oggi" && it) { spostaRitardo(it, dk(), null); }
  else if (act === "rip-domani" && it) { spostaRitardo(it, addDays(dk(), 1), null); }
  else if (act === "rip-data" && it) {
    var cd = document.getElementById("ripd-"+id), co = document.getElementById("ripo-"+id);
    var giorno = cd ? cd.value : "";
    if (!validKey(giorno)) { toast("Scegli una data valida", "info"); return; }
    var ora = null;
    if (co && co.value) {
      var pz = co.value.split(":");
      ora = parseInt(pz[0],10) + (parseInt(pz[1],10)||0)/60;
      if (!(ora >= 0 && ora < 24)) ora = null;
    }
    spostaRitardo(it, giorno, ora);
  }
  else if (act === "nonserve" && it) {
    /* archivia, non elimina: la voce resta ritrovabile dalla ricerca */
    snapshot("Archiviata «"+it.label+"»: non serve più.", "Vuoi rimetterla in elenco?");
    S.data.archive = Array.isArray(S.data.archive) ? S.data.archive : [];
    S.data.archive.push(Object.assign({}, it, { archiviatoIl: new Date().toISOString() }));
    S.data.items = S.data.items.filter(function(x){ return x.id !== id; });
    /* nulla deve restare appeso a una voce che non c'è più */
    ripulisciRiferimenti(id);
    S.ripianifica = null;
    commit();
    toast("Archiviata: la ritrovi dalla ricerca", "ok");
  }
  else if (act === "nudge" && it) {
    /* sposta di un quarto d'ora senza trascinamento: sul telefono serve */
    var dd = parseFloat(el.getAttribute("data-d")) || 0;
    var nuovo = Math.max(0, Math.min(23.75, (it.start || 0) + dd));
    if (nuovo + (it.dur || 0.5) > 24) return;
    patch(id, { start: nuovo });
  }
  else if (act === "untime") { patch(id, { start: undefined, dur: undefined }); S.editId = null; }
  /* La modalità semplice/avanzata resta raggiungibile: i profili la impostano,
     e il comando serve a chi arriva da dati vecchi o dalle scorciatoie. */
  else if (act === "modo") {
    /* un valore inatteso non deve cambiare nulla: prima «pippo» finiva in
       modalità semplice, cioè un errore di battitura cambiava l'interfaccia */
    if (v !== "semplice" && v !== "avanzata") return;
    setImp("modo", v);
    S.disegnoCompleto = "cambio-profilo"; forzaProssimoCompleto();
    render();
  }
  /* «postpone», «tooday» e «account-esci» non hanno un pulsante nella pagina
     principale: sono raggiunti dalle scorciatoie da tastiera e dal menù di una
     voce. Il controllo strutturale li segnala, ed è giusto che lo faccia:
     restano qui perché servono, non per dimenticanza. */
  else if (act === "postpone" && it) { patch(id, { start: Math.min(23.5, it.start + 0.5) }); }
  else if (act === "tooday") {
    delete S.data.checks[id]; delete S.data.doneAt[id];
    patch(id, { date: dk() });
  }
  else if (act === "star" && it) {
    L = top3();
    var idx = prioIndex(it);
    if (idx >= 0) L[idx] = { t:"", id:null, done:false };
    else {
      var free = -1;
      for (var k = 0; k < 3; k++) if (!L[k].id && !L[k].t.trim()) { free = k; break; }
      if (free === -1) return;
      L[free] = { t: it.label, id: it.id, done:false };
    }
    putTop3(L);
  }
  else if (act === "ptoggle") {
    L = top3();
    var li = L[n].id ? itemById(L[n].id) : null;
    if (li) { toggleItem(li); return; }
    L[n].done = !L[n].done;
    putTop3(L);
  }
  else if (act === "pclear") { L = top3(); L[n] = { t:"", id:null, done:false }; putTop3(L); }
  else if (act === "captoggle") {
    S.data.capture = S.data.capture.map(function(c){
      return c.id === id ? Object.assign({}, c, { done: !c.done }) : c;
    });
    commit();
  }
  else if (act === "tostep") { S.toStep = S.toStep === id ? null : id; render(); }
  else if (act === "tostepgo") {
    var sel0 = document.getElementById("tostepsel");
    var target = sel0 ? sel0.value : "";
    var nota = S.data.capture.filter(function(c){ return c.id === id; })[0];
    var dest = itemById(target);
    if (!nota || !dest) { S.toStep = null; render(); return; }
    var passi = Array.isArray(dest.steps) ? dest.steps.slice() : [];
    passi.push({ t: nota.text, una: true });
    S.data.items = S.data.items.map(function(x){
      return x.id === target ? Object.assign({}, x, { steps: passi }) : x;
    });
    S.data.capture = S.data.capture.filter(function(c){ return c.id !== id; });
    S.toStep = null; S.stepsOpen = target;
    toast("Aggiunto come passo di «"+dest.label+"»", "ok");
    bumpSim(); commit();
  }
  else if (act === "capprom") {
    var c0 = S.data.capture.filter(function(c){ return c.id === id; })[0];
    if (!c0) return;
    S.data.items.push({ id: uid(), label: c0.text, area: c0.area, freq: "once", date: dk() });
    S.data.capture = S.data.capture.filter(function(c){ return c.id !== id; });
    bumpSim();
    commit();
  }
  else if (act === "capdel") {
    snapshot("La nota è stata eliminata.", "Vuoi annullare l'eliminazione?");
    if (S.stepsOpen === id) S.stepsOpen = null;
    S.data.capture = S.data.capture.filter(function(c){ return c.id !== id; });
    bumpSim();
    commit();
  }
  else if (act === "capadd") {
    var ci = document.getElementById("capinput");
    var txt = ci ? ci.value.trim() : "";
    if (!txt) return;
    S.data.capture.push({ id: uid(), text: txt, area: S.ui.capArea, done: false, at: Date.now() });
    if (ci) ci.value = "";
    svuota("capinput");
    bumpSim();
    commit();
  }
  else if (act === "dupcancel") { S.dup = null; render(); }
  else if (act === "additem" || act === "dupforce") {
    var ni = document.getElementById("newlabel");
    var lab = (S.dup && act === "dupforce") ? S.dup.label : (ni ? ni.value.trim() : "");
    /* TSK-002 — la validazione avviene PRIMA di costruire la voce, e i suoi
       messaggi restano accanto ai campi. Prima un titolo vuoto usciva in
       silenzio: l'utente premeva e non succedeva niente. */
    var esitoV = validaTask({
      label: lab, area: S.ui.area, freq: S.ui.freq,
      start: S.ui.start, dur: S.ui.start !== "" ? S.ui.dur : undefined,
      date: S.ui.freq === "once" ? (S.ui.date || S.cursorKey) : undefined,
      days: S.ui.days, dom: S.ui.dom, due: S.ui.due
    });
    if (!esitoV.ok) {
      S.erroriTask = esitoV.errori;
      render();
      return;                       /* nulla di scritto viene perso */
    }
    S.erroriTask = null;
    if (act === "additem") {
      var sim = findSimilar(lab, null);
      if (sim.length) { S.dup = { label: lab, matches: sim }; render(); return; }
    }
    S.dup = null;
    var o = { id: uid(), label: esitoV.valori.label, area: esitoV.valori.area,
              freq: esitoV.valori.freq };
    if (esitoV.valori.start !== undefined) {
      o.start = esitoV.valori.start;
      o.dur = esitoV.valori.dur;
    }
    if (S.ui.due) o.due = S.ui.due;
    if (S.ui.freq === "once") o.date = S.ui.date || S.cursorKey;
    else if (S.ui.freq === "weekly") {
      o.days = S.ui.days.slice();
      if (S.ui.every > 1) { o.every = S.ui.every; o.since = dk(); }
    }
    else if (S.ui.freq === "monthly") o.dom = S.ui.dom;
    else if (S.ui.freq === "yearly") { o.dom = S.ui.dom; o.mon = S.ui.mon; }
    if (S.ui.freq === "daily" && S.ui.everyd > 1) { o.every = S.ui.everyd; o.since = dk(); }
    /* vale anche a dettagli chiusi: se stai guardando un'etichetta, ciò che
       crei le appartiene, altrimenti sparirebbe subito dalla vista. È però
       solo un punto di partenza: quella scritta a mano ha la precedenza. */
    if (S.tagF && S.tagF !== "tutti" && S.tagF !== "__senza") o.tag = S.tagF;
    if (S.addMore) {
      var lk = document.getElementById("alink"), nt = document.getElementById("anote"),
          sp = document.getElementById("asteps"), pl = document.getElementById("aplace"),
          pj = document.getElementById("atag");
      if (pl && pl.value.trim()) o.place = pl.value.trim();
      if (pj && pj.value.trim()) o.tag = pj.value.trim();   /* la scelta esplicita vince */
      if (lk && safeUrl(lk.value.trim())) o.link = lk.value.trim();
      if (nt && nt.value.trim()) o.note = nt.value.trim();
      if (sp && sp.value.trim()) {
        var righe = sp.value.split("\n").map(function(r){ return r.trim(); }).filter(Boolean);
        if (righe.length) o.steps = righe.map(function(r){ return { t: r }; });
      }
      [lk, nt, sp, pl, pj].forEach(function(e2){ if (e2) e2.value = ""; });
    }
    S.data.items.push(o);
    if (S.filter !== "tutto" && S.filter !== o.area) S.filter = "tutto";
    S.flash = { id: o.id, kind: "Creato" };
    if (!o.link && PAROLE_BANCA.test(lab) && urlBanca()) S.flash.banca = true;
    /* la nuova voce non deve finire dietro una ricerca attiva o una sezione chiusa */
    S.query = ""; S.searchOpen = false;
    if (!P.fold) P.fold = {};
    var sez = (o.freq === "once") ? "once" : (o.freq === "daily") ? "today" : o.freq;
    if (folded(sez)) { P.fold[sez] = false; savePrefs(); }
    bumpSim();
    S.ui.start = ""; S.ui.date = ""; S.ui.due = "";
    var ni2 = document.getElementById("newlabel");
    if (ni2) ni2.value = "";
    svuota("newlabel", "alink", "anote", "asteps", "aplace", "atag");
    S.focusKey = "newlabel";   /* pronto per il prossimo inserimento */
    commit();
  }
  else if (act === "ics") {
    var list = S.data.items.filter(function(i){
      if (typeof i.start !== "number" || isWaiting(i)) return false;
      if (i.freq === "once" && (isOn(i) || i.date < dk())) return false;
      if (i.freq !== "once" && validKey(i.fine) && i.fine < dk()) return false;
      if (i.flessibile) return false;   /* senza giorno fisso non è un evento di calendario */
      return true;
    });
    if (!list.length) { S.err = "Nessuno slot con orario da esportare."; render(); return; }
    S.data.seq = (S.data.seq||0)+1;
    S.ics = buildIcs(list, new Date(), S.data.seq, S.ui.alarm);
    download(S.ics, "pannello-tempo.ics", "text/calendar;charset=utf-8");
    commit();
  }
  else if (act === "icshide") { S.ics = ""; render(); }
  else if (act === "pclear2") { S.data.pause = null; commit(); }
  else if (act === "skip" && it) {
    /* un appuntamento saltato non ricadrebbe in nessun elenco e diventerebbe
       irraggiungibile: per quelli esistono «domani» ed eliminazione */
    if (it.freq === "once") { toast("Un appuntamento si sposta o si elimina, non si salta", "info"); render(); return; }
    if (!S.data.skips) S.data.skips = {};
    S.data.skips[id] = stampFor(it.freq);
    /* saltare e completare sono stati alternativi */
    delete S.data.checks[id]; delete S.data.doneAt[id];
    toast("Saltato per questa volta: non conta come fatto", "info");
    commit();
  }
  else if (act === "applicasugg" && it) {
    snapshot("La routine «"+it.label+"» è stata modificata.", "Vuoi annullare la modifica?");
    if (v === "giorni") {
      var gg = (el.getAttribute("data-n") || "").split("-").map(Number)
                 .filter(function(x){ return x >= 0 && x <= 6; });
      if (!gg.length) return;
      patch(id, { freq:"weekly", days:gg, every:1, since:dk() });
      toast("Ora è settimanale: "+elencoGiorni(gg), "ok");
    } else if (v === "ogni2") {
      patch(id, { every:2, since:dk() });
      toast("Ora torna un giorno sì e uno no", "ok");
    } else if (v === "orario") {
      var no = parseFloat(el.getAttribute("data-ora"));
      if (!(no >= 0 && no < 24)) return;
      patch(id, { start: no });
      toast("Spostato alle "+fmt(no), "ok");
    } else if (v === "noora") {
      patch(id, { start:undefined, dur:undefined });
      toast("Orario tolto: resta fra le cose di oggi finché non lo fai", "ok");
    }
    if (S.data.log) delete S.data.log[id];   /* il registro riparte dalla nuova regola */
    commit();
  }
  else if (act === "ignorasugg" && it) {
    S.data.ignora = S.data.ignora || {};
    S.data.ignora[id] = dk();
    toast("Non te lo propongo più per due settimane", "info");
    commit();
  }
  else if (act === "causa-ok") {
    var campoC = document.getElementById("causain");
    var causa = campoC ? campoC.value.trim() : "";
    var campoD = document.getElementById("causadata");
    var dataC = campoD ? campoD.value : "";
    if (!causa) { toast("Scrivi da chi o da cosa dipende", "info"); return; }
    patch(S.chiediCausa, { waiting: true, bloccatoDa: causa,
                           recheck: validKey(dataC) ? dataC : undefined });
    S.chiediCausa = null;
    svuota("causain");
    render();
  }
  else if (act === "causa-annulla") { S.chiediCausa = null; render(); }
  else if (act === "unskip" && it) {
    if (S.data.skips) delete S.data.skips[id];
    toast("Rimesso in programma", "ok");
    commit();
  }
  else if (act === "wait" && it) {
    /* un blocco senza responsabile non è un blocco: è una rimozione mascherata */
    if (!it.waiting) { S.chiediCausa = id; render(); return; }
    if (!it.waiting) liberaPriorita(id);
    patch(id, it.waiting ? { waiting: undefined, recheck: undefined } : { waiting: true });
  }
  else if (act === "unwait" && it) { patch(id, { waiting: undefined, recheck: undefined }); }
  else if (act === "addmore") {
    S.addMore = !S.addMore; render(); }
  else if (act === "add-dayt") {
    var cur2 = S.ui.days.slice(), p2 = cur2.indexOf(n);
    if (p2 >= 0) { if (cur2.length > 1) cur2.splice(p2,1); } else cur2.push(n);
    S.ui.days = cur2; render();
  }
  else if (act === "duenone") { S.ui.due = ""; render(); }
  else if (act === "dense") { P.dense = !P.dense; savePrefs(); render(); }
  else if (act === "opendue" && it) {
    S.nuovo = null;
    S.editFrom = "list"; S.editCtx = null; S.editMore = true;
    S.editId = S.editId === id ? null : id;
    render();
  }
  else if (act === "open") {
    S.nuovo = null;
    if (S.editId) flushPending();
    var ctx0 = el.getAttribute("data-ctx") || null;
    var stesso = (S.editId === id && S.editCtx === ctx0);
    S.editFrom = "list";
    S.editId = stesso ? null : id;
    S.editCtx = stesso ? null : ctx0;
    render();
  }
  else if (act === "e-flex" && it) {
    patch(id, { flessibile: it.flessibile ? undefined : true });
  }
  else if (act === "e-dayt" && it) {
    var cur = daysOf(it).slice();
    var pos = cur.indexOf(n);
    if (pos >= 0) { if (cur.length > 1) cur.splice(pos,1); }
    else cur.push(n);
    patch(id, { days: cur });
  }
  else if (act === "fold") {
    if (!P.fold) P.fold = {};
    P.fold[v] = !folded(v);
    savePrefs(); render();
  }
  else if (act === "stepsview") {
    S.stepsOpen = S.stepsOpen === id ? null : id;
    render();
  }
  else if (act === "stepadd" && it) {
    var si = document.getElementById(el.getAttribute("data-q") ? "qs"+id : "stepin");
    var tx = si ? si.value : "";
    /* incollando più righe si aggiungono più passi in una volta:
       comodo per una lista della spesa */
    var righe = String(tx).split(/[\n;]+/).map(function(r){ return r.trim(); }).filter(Boolean);
    if (!righe.length) return;
    var arr = Array.isArray(it.steps) ? it.steps.slice() : [];
    righe.forEach(function(r){ arr.push({ t: r.slice(0, 120) }); });
    if (si) si.value = "";
    svuota("stepin", "qs"+id);
    patch(id, { steps: arr });
  }
  else if (act === "stept" && it) {
    var a2 = (it.steps||[]).map(function(x){ return { t:x.t, s:x.s }; });
    if (!a2[n]) return;
    var st0 = stampFor(it.freq);
    a2[n].s = (a2[n].s === st0) ? undefined : st0;
    S.data.items = S.data.items.map(function(x){ return x.id === id ? Object.assign({}, x, { steps:a2 }) : x; });
    /* il task e i suoi passi restano coerenti in entrambe le direzioni */
    toast(a2[n].s ? "Passo completato" : "Passo da fare", "info");
    var tutti = a2.length && a2.every(function(x){ return x.s === st0; });
    if (tutti && S.data.checks[id] !== st0) {
      /* completare tutti i passi equivale a spuntare il task:
         come la spunta, annulla un eventuale salto */
      S.data.checks[id] = st0; S.data.doneAt[id] = dk();
      if (S.data.skips) delete S.data.skips[id];
    }
    if (!tutti && S.data.checks[id] === st0) { delete S.data.checks[id]; delete S.data.doneAt[id]; }
    commit();
  }
  else if (act === "stepuna" && it) {
    var a4 = (it.steps||[]).map(function(x){ return { t:x.t, s:x.s, una:x.una }; });
    if (!a4[n]) return;
    a4[n].una = a4[n].una ? undefined : true;
    patch(id, { steps: a4 });
  }
  else if (act === "stepdel" && it) {
    var a3 = (it.steps||[]).slice();
    a3.splice(n, 1);
    patch(id, { steps: a3.length ? a3 : undefined });
  }
  else if (act === "tomorrow" && it) {
    /* "domani" è sempre relativo a oggi: su un appuntamento scaduto
       spostarlo di un giorno lo lascerebbe nel passato. */
    var dom = new Date(); dom.setDate(dom.getDate()+1);
    delete S.data.checks[id]; delete S.data.doneAt[id];
    patch(id, { date: dayKey(dom) });
  }
  else if (act === "plusday" && it) {
    var base = validKey(it.date) && it.date > dk() ? keyToDate(it.date) : new Date();
    base.setDate(base.getDate()+1);
    delete S.data.checks[id]; delete S.data.doneAt[id];
    patch(id, { date: dayKey(base) });
  }
  else if (act === "collegabanca" && it) {
    var u = urlBanca();
    if (!u) return;
    S.flash = null;
    toast("Collegato a "+u.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,""), "ok");
    patch(id, { link: u });
  }
  else if (act === "flashclose") { S.flash = null; render(); }
  else if (act === "toastclose") { S.toast = null; render(); }
  else if (act === "undoclose") { S.undo = null; render(); }
  else if (act === "undo") { undoNow(); }
  else if (act === "search") {
    S.ancora = null; S.inCima = true;
    S.nuovo = null;
    S.searchOpen = !S.searchOpen;
    if (!S.searchOpen) { S.query = ""; svuota("q"); }
    render();
    if (S.searchOpen) {
      var qq = document.getElementById("q");
      if (qq) { try { qq.focus({ preventScroll:true }); } catch (e0) { qq.focus(); } }
    }
  }
  else if (act === "editmore") { S.editMore = !S.editMore; render(); }
  else if (act === "nuovoslot") {
    /* il clic su un blocco esistente non deve proporre nulla */
    if (ev.target && ev.target.closest && ev.target.closest(".agblk")) return;
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var y = rect ? (ev.clientY - rect.top) : 0;
    var ora = Math.max(0, Math.min(23.75, snap(hourAt(y))));
    /* si apre una proposta: niente viene salvato finché non confermi */
    S.nuovo = { start: ora, dur: 1, area: (S.filter === "vita" ? "vita" : "lavoro") };
    S.editId = null; S.focusKey = "n-label";
    render();
  }
  else if (act === "nuovoannulla") { S.nuovo = null; svuota("n-label"); render(); }
  else if (act === "nuovocrea") {
    if (!S.nuovo) return;
    var campoN = document.getElementById("nlabel");
    var nome = campoN ? campoN.value.trim() : "";
    if (!nome) { S.err = "Dai un nome al task prima di crearlo."; render(); return; }
    var durata = Math.min(S.nuovo.dur, Math.max(0.25, 24 - S.nuovo.start));
    var creato = { id: uid(), label: nome, area: S.nuovo.area, freq: "once",
                   date: S.cursorKey, start: S.nuovo.start, dur: durata };
    if (S.tagF && S.tagF !== "tutti" && S.tagF !== "__senza") creato.tag = S.tagF;
    S.data.items.push(creato);
    S.nuovo = null; S.err = ""; svuota("n-label");
    S.flash = { id: creato.id, kind: "Creato" };
    if (PAROLE_BANCA.test(nome) && urlBanca()) S.flash.banca = true;
    bumpSim(); commit();
  }
  else if (act === "menunuovo") { S.menuNuovo = !S.menuNuovo; render(); }
  else if (act === "nuovotask" || act === "nuovanota" || act === "nuovaroutine") {
    S.menuNuovo = false;
    if (act === "nuovaroutine") { S.ui.freq = "weekly"; S.addMore = true; }
    if (act === "nuovotask") { S.ui.freq = "once"; S.ui.date = dk(); }
    S.focusKey = (act === "nuovanota") ? "capinput" : "newlabel";
    render();
    var campo2 = document.getElementById(act === "nuovanota" ? "capinput" : "newlabel");
    if (campo2) {
      if (campo2.scrollIntoView) campo2.scrollIntoView({ block:"center", behavior:"smooth" });
      try { campo2.focus({ preventScroll:true }); } catch (e9) { campo2.focus(); }
    }
  }
  else if (act === "digest") {
    S.ancora = null; S.inCima = true;
    S.nuovo = null;
    S.digest = !S.digest;
    if (!S.digest) S.digTxt = "";
    else { S.searchOpen = false; S.query = ""; svuota("q"); }
    render();
  }
  else if (act === "digprint") { if (window.print) window.print(); }
  else if (act === "digcopy") {
    var t = riepilogoTesto();
    S.digTxt = t;
    var ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); ok = true; }
    } catch (ec) {}
    toast(ok ? "Riepilogo copiato" : "Copia il testo qui sotto", ok ? "ok" : "info");
    render();
  }
  else if (act === "qclear") { S.query = ""; svuota("q"); render(); }
  /* --- onboarding --- */
  else if (act === "onb-avanti") { salvaPrioritaOnboarding(); passoOnboarding(S.onboarding.passo + 1); }
  else if (act === "onb-indietro") { salvaPrioritaOnboarding(); passoOnboarding(S.onboarding.passo - 1); }
  else if (act === "onb-salta") { saltaOnboarding(); }
  else if (act === "onb-fine") { applicaScelteOnboarding(); chiudiOnboarding(); }
  else if (act === "onb-demo") { caricaDemo(); passoOnboarding(2); }
  else if (act === "onb-apri") { apriOnboarding(1); }
  else if (act === "installa") {
    if (!Platform.installa.chiedi()) toast(Platform.installa.istruzioni(), "info");
    render();
  }
  else if (act === "installa-no") { setImp("installaNascosto", true); render(); }
  else if (act === "sugg2-ok") { setImp("suggerimentoRoutineMostrato", true); render(); }
  else if (act === "demo-togli") { togliDemo(); }
  /* --- chiusura di giornata --- */
  else if (act === "ch-apri") { apriChiusura(); }
  else if (act === "ch-avanti" && S.chiusura) { S.chiusura.passo = Math.min(4, S.chiusura.passo + 1); render(); }
  else if (act === "ch-indietro" && S.chiusura) { S.chiusura.passo = Math.max(1, S.chiusura.passo - 1); render(); }
  else if (act === "ch-annulla") { chiudiChiusura(); }
  else if (act === "ch-dec") { decidiVoce(id, v); }
  else if (act === "ch-area" && S.chiusura) {
    S.chiusura.domaniArea[n] = (v === "vita") ? "vita" : "lavoro"; render();
  }
  else if (act === "ch-salva") { salvaChiusura(); }
  /* --- revisione settimanale --- */
  else if (act === "rv-apri") { apriRevisione(); }
  else if (act === "rv-chiudi") { chiudiRevisione(); }
  else if (act === "rv-rinvia") { rinviaRevisione(); }
  else if (act === "rv-salva") { salvaRevisione(); }
  /* --- modelli di giornata --- */
  else if (act === "mod-salva") {
    var cn = document.getElementById("modnome");
    var nome = cn ? cn.value.trim() : "";
    if (!nome) { toast("Dai un nome al modello", "info"); return; }
    salvaModello(modelloDaGiorno(nome));
    svuota("modnome");
    toast("Modello salvato", "ok");
  }
  else if (act === "mod-applica") {
    var es = applicaModello(id, S.cursorKey);
    if (es) toast(es.creati+" create, "+es.saltati+" già presenti", "ok");
  }
  else if (act === "mod-duplica") { duplicaModello(id); toast("Modello duplicato", "ok"); }
  else if (act === "mod-elimina") { eliminaModello(id); toast("Modello eliminato", "ok"); }
  /* --- importazione calendario --- */
  else if (act === "ics-scegli") {
    var fi = document.getElementById("icsfile");
    if (fi && fi.click) fi.click();
  }
  else if (act === "ics-annulla") { S.icsAnteprima = null; render(); }
  else if (act === "ics-importa") {
    if (!S.icsAnteprima) return;
    var ris = importaEventi(S.icsAnteprima.eventi);
    S.icsAnteprima = null;
    toast(ris.creati+(ris.creati===1?" evento importato":" eventi importati"), "ok");
  }
  else if (act === "profilo") {
    if (!applicaProfilo(v)) return;
    /* ARC-003: cambia l'insieme delle sezioni, non solo il loro contenuto */
    S.disegnoCompleto = "cambio-profilo"; forzaProssimoCompleto();
    S.ancora = null;
    toast("Profilo «"+PROFILI[v].nome+"» attivo", "ok");
    render();
  }
  else if (act === "sfondo") {
    if (["griglia","carta","unito"].indexOf(v) < 0) return;
    setImp("sfondo", v); render();
  }
  else if (act === "preset-ripristina") {
    var rp = ripristinaPreset();
    toast(rp.motivo, rp.ok ? "ok" : "info");
    S.disegnoCompleto = "cambio-profilo"; forzaProssimoCompleto();
    render();
  }
  else if (act === "modulo") {
    S.disegnoCompleto = "cambio-profilo"; forzaProssimoCompleto();
    var mo2 = modulo(v);
    if (!mo2) return;
    var era = moduloAttivo(v);
    if (!attivaModulo(v, !era)) { toast("Questa parte non si può spegnere", "info"); return; }
    toast(mo2.nome + (era ? " spenta: i dati restano" : " attiva"), "ok");
    render();
  }
  else if (act === "filtri") { S.filtri = !S.filtri; render(); }
  else if (act === "tagreset") { S.tagF = "tutti"; render(); }
  else if (act === "tagpick") { S.tagF = (S.tagF === v) ? "tutti" : v; render(); }
  else if (act === "groupby") {
    /* l'opzione per etichetta non ha effetto finché non ne esiste almeno una */
    if (v === "etichetta" && !etichette().length) return;
    P.groupBy = (v === "etichetta") ? "etichetta" : "area";
    savePrefs(); render();
  }
  else if (act === "linkedit") { S.linkEdit = !S.linkEdit; render(); }
  else if (act === "linkmove") {
    if (muoviLink(n, n + parseInt(el.getAttribute("data-d"), 10))) commit();
  }
  else if (act === "linkdel") {
    ev.preventDefault();
    snapshot("Il collegamento rapido è stato rimosso.", "Vuoi annullare la rimozione?");
    S.data.links = (S.data.links||[]).filter(function(l){ return l.id !== id; });
    commit();
  }
  else if (act === "linkadd") {
    var ln = document.getElementById("lname"), lu = document.getElementById("lurl");
    var nm = ln ? ln.value.trim() : "", ur = lu ? lu.value.trim() : "";
    if (!nm || !safeUrl(ur)) { S.err = "Servono un nome e un indirizzo che inizi con https://"; render(); return; }
    if (!S.data.links) S.data.links = [];
    var nuovoL = { id: uid(), name: nm, url: ur };
    if (S.ui.linkArea) nuovoL.area = S.ui.linkArea;
    S.data.links.push(nuovoL);
    if (ln) ln.value = ""; if (lu) lu.value = "";
    svuota("lname", "lurl");
    commit();
  }
  else if (act === "provider") { sync.provider = v; saveSync(); render(); }
  else if (act === "synclink") {
    var g = function(id){ var e = document.getElementById(id); return e ? e.value.trim() : ""; };
    if (sync.provider === "gist") {
      var gid = g("f1").replace(/^.*\//, ""), tok = g("f2");
      if (!gid || !tok) { S.err = "Servono sia l'identificativo del gist sia il token."; render(); return; }
      var problema = controllaCampiGist(tok, gid);
      if (problema) { sync.err = { titolo:"Dati incompleti", causa:problema,
        cosa:"Correggi il campo e riprova.", tecnico:"" }; setStatus("errore"); render(); return; }
      sync.gist.id = gid; sync.gist.token = tok; sync.rev = 0; sync.dirty = false;
      svuota("f1", "f2");
      saveSync(); pullNow();
    } else {
      var ak = g("f1"), pid = g("f2"), em = g("f3"), pw = g("f4");
      if (!ak || !pid || !em || !pw) { S.err = "Compila tutti e quattro i campi."; render(); return; }
      var problemaFb = controllaCampiFb(ak, pid, em, pw);
      if (problemaFb) { sync.err = { titolo:"Dati incompleti", causa:problemaFb,
        cosa:"Correggi il campo e riprova.", tecnico:"" }; setStatus("errore"); render(); return; }
      sync.fb.apiKey = ak; sync.fb.projectId = pid; sync.rev = 0; sync.dirty = false;
      svuota("f1", "f2", "f3", "f4");
      setStatus("accesso…"); render();
      /* SYN-001: il collegamento passa dal contratto, non dal servizio */
      PROVIDER.firebase.login({ apiKey:ak, projectId:pid, email:em, password:pw })
        .then(function(){ pullNow(); })
        .catch(function(e){
          sync.err = (e && e.titolo) ? e : dettaglioErrore(e);
          setStatus("errore"); render();
        });
    }
  }
  else if (act === "syncauto") { sync.auto = !sync.auto; saveSync(); render(); }
  else if (act === "syncpull") { pullNow(); }
  else if (act === "syncpush") { pushNow(false); }   /* passa da provider().push */
  else if (act === "account-entra" || act === "account-crea") {
    var ce = document.getElementById("ac1"), cp = document.getElementById("ac2");
    var em2 = ce ? ce.value.trim() : "", pw2 = cp ? cp.value : "";
    if (!em2 || !pw2) { toast("Scrivi email e password", "info"); return; }
    setStatus("collegamento…"); render();
    var poi = function(r2){
      if (r2.errore) { sync.err = { titolo:"Accesso non riuscito", causa:r2.errore,
        cosa:"Controlla email e password, oppure crea l'account se non ce l'hai.", tecnico:"" };
        setStatus("errore"); render(); return; }
      svuota("ac2");
      setStatus("collegata"); toast("Sei dentro", "ok"); pushNow(true); render();
    };
    if (act === "account-crea") registraAccount(em2, pw2, poi);
    else entraAccount(em2, pw2, false /* SEC-001: mai ricordare */, poi);
  }
  else if (act === "account-esci") { esciAccount(); toast("Uscito dall\'account", "info"); render(); }
  /* SEC-001: «Resta collegato» rimosso nella Release 2B insieme alla
     conservazione del token di rinnovo. I suoi comandi non esistono più. */
  else if (act === "apri-fascia") {
    P.fold = Object.assign({}, P.fold, { settings:false, setfascia:false });
    savePrefs(); render();
    var el2 = document.getElementById("setfascia");
    if (el2 && el2.scrollIntoView) el2.scrollIntoView({ block:"center" });
  }
  else if (act === "fascia-salva") {
    var cda = document.getElementById("fda"), ca = document.getElementById("fa");
    var da = hhmmOra(cda && cda.value), a = hhmmOra(ca && ca.value);
    if (da === null || a === null) { toast("Orari non validi", "info"); return; }
    if (!impostaFascia(da, a)) { toast("L'ora di fine deve venire dopo quella di inizio", "info"); return; }
    toast("Giornata: "+fmt(da)+"–"+fmt(a), "ok"); render();
  }
  else if (act === "fascia-azzera") { azzeraFasciaGiorno(n); render(); }
  else if (act === "copia-info") {
    var info = "Pannello Tempo "+BUILD.app+"\nsorgenti "+BUILD.sorgenti+
      "\ncommit "+(BUILD.commit||"—")+"\nschema v"+BUILD.schema+
      "\ncache "+BUILD.cache+"\ncostruito "+BUILD.costruito+
      "\nmodalità "+pref("modo")+"\nprofilo "+(pref("profilo")||"nessuno");
    var esito = Platform.condivisione.invia("Pannello Tempo", info);
    toast(esito === "appunti" ? "Informazioni copiate" :
          (esito ? "Informazioni condivise" : "Copia manualmente dal riquadro"), esito ? "ok" : "info");
    if (!esito) { S.infoTesto = info; render(); }
  }
  else if (act === "exp-json") {
    Platform.file.scarica("pannello-tempo-"+dk()+".json", esportaJson(), "application/json");
    registraOperazione("esportazione", "JSON completo"); save();
    toast("Esportazione completata", "ok");
  }
  else if (act === "exp-csv") {
    Platform.file.scarica("attivita-"+dk()+".csv", esportaCsv(), "text/csv;charset=utf-8");
    registraOperazione("esportazione", "CSV attività"); save();
    toast("Esportazione completata", "ok");
  }
  else if (act === "exp-ics") {
    Platform.file.scarica("impegni-"+dk()+".ics", esportaIcsTutto(), "text/calendar;charset=utf-8");
    registraOperazione("esportazione", "ICS impegni"); save();
    toast("Esportazione completata", "ok");
  }
  /* BCK-002 — le sei azioni distinte */
  /* ROU-001 — l'ambito scelto vale per le modifiche successive di questa voce */
  else if (act === "tipo-rip" && it) {
    if (["routine","ricorrente"].indexOf(v) < 0) return;
    snapshot("Hai cambiato il tipo di «"+it.label+"».", "Vuoi tornare indietro?");
    patch(id, { tipo: v });
    commit();
    toast(v === "routine"
      ? "Ora è una routine: saltandola non diventa un arretrato"
      : "Ora è un task ricorrente: saltandolo resta indietro", "ok");
  }
  else if (act === "ambito") { S.ambitoSerie = v; render(); }
  else if (act === "del-serie" && it) {
    var amb = S.ambitoSerie || "serie";
    if (amb === "questa") eliminaOccorrenza(id, S.cursorKey || dk());
    else if (amb === "questa-e-successive") eliminaDaQui(id, S.cursorKey || dk());
    else {
      snapshot("Hai eliminato «"+it.label+"» e tutta la serie.", "Vuoi rimetterla?");
      S.data.items = S.data.items.filter(function(x){ return x.id !== id; });
      ripulisciRiferimenti(id);
      commit();
    }
    S.editId = null;
    toast(amb === "questa" ? "Occorrenza rimossa"
          : amb === "questa-e-successive" ? "Serie interrotta da qui" : "Serie eliminata", "ok");
  }
  else if (act === "distr") { S.conferma = v; svuota("confin"); render(); }
  else if (act === "distr-ok") {
    var azio = azioneDistruttiva(S.conferma);
    if (!azio) return;
    if (azio.conferma === 3) {
      var campoP = document.getElementById("confin");
      if (!campoP || campoP.value.trim().toUpperCase() !== azio.parola) {
        toast("Scrivi "+azio.parola+" per confermare", "info"); return;
      }
    }
    S.conferma = null; svuota("confin");
    eseguiDistruttiva(azio.id, function(r2){
      toast(r2.nota || (r2.ok ? "Fatto" : "Non riuscita"), r2.ok ? "ok" : "info");
      render();
    });
  }
  else if (act === "del-cronologia") { S.conferma = "cronologia"; render(); }
  else if (act === "del-tutto") { S.conferma = "tutto"; render(); }
  else if (act === "esito-ok") { S.esitoCancellazione = null; render(); }
  else if (act === "conferma-annulla") { S.conferma = null; svuota("confin"); render(); }
  else if (act === "conferma-ok") {
    var quale = S.conferma;
    var campoC2 = document.getElementById("confin");
    if (quale === "tutto") {
      /* conferma rafforzata: va scritta la parola, non basta un clic */
      if (!campoC2 || campoC2.value.trim().toUpperCase() !== "CANCELLA") {
        toast("Scrivi CANCELLA per confermare", "info"); return;
      }
      S.conferma = null;
      cancellaTutto(syncReady(), function(es){
        S.esitoCancellazione = es;
        S.data = datiVuoti(); normalizeData();
        sync.fb = { apiKey:"", projectId:"", email:"", uid:"", refresh:"", idToken:"", expAt:0 };
        sync.gist = { id:"", token:"" }; sync.account = false;
        render();
      });
      return;
    }
    S.conferma = null;
    cancellaCronologia();
    toast("Cronologia cancellata", "ok");
  }
  else if (act === "syncprova") { verificaCollegamento(); }
  else if (act === "errchiudi") { sync.err = null; setStatus(sync.status === "errore" ? "" : sync.status); render(); }
  else if (act === "syncprovachiudi") { sync.prova = null; render(); }
  else if (act === "syncoff") {
    if (!confirm("Scollegare la sincronizzazione? I dati restano su questo dispositivo.")) return;
    sync.gist = { token:"", id:"", file:"pannello.json" };
    sync.fb = { apiKey:"", projectId:"", email:"", uid:"", refresh:"", idToken:"", expAt:0 };
    sync.rev = 0; sync.dirty = false; sync.status = ""; saveSync(); render();
  }
  else if (act === "keeplocal") { resolveConflict(true); }
  else if (act === "keepremote") { resolveConflict(false); }
  else if (act === "export") {
    if (download(JSON.stringify(S.data, null, 2),
                 "pannello-tempo-"+dk()+".json", "application/json")) {
      S.data.lastBackup = dk();
      commit();
    }
  }
  else if (act === "sostpulisci") { S.sostDa = ""; S.sostA = ""; svuota("sost-da","sost-a"); render(); }
  else if (act === "sostituisci") {
    var da = (S.sostDa || "").trim(), a = (S.sostA || "").trim();
    if (da.length < 4) { S.err = "Scrivi almeno quattro caratteri dell'indirizzo da sostituire."; render(); return; }
    if (!safeUrl(a)) { S.err = "Il nuovo indirizzo deve iniziare con https://"; render(); return; }
    var coinvolte = contaLink(da);
    if (!coinvolte.length) { S.err = "Nessuna voce contiene quell'indirizzo."; render(); return; }
    if (!confirm("Sostituire l'indirizzo in "+coinvolte.length+
                 (coinvolte.length===1?" voce":" voci")+"?")) return;
    snapshot("Indirizzo cambiato in "+coinvolte.length+(coinvolte.length===1?" voce":" voci")+".", "Vuoi annullare il cambio?");
    var ids = {}; coinvolte.forEach(function(i){ ids[i.id] = 1; });
    S.data.items = S.data.items.map(function(i){
      return ids[i.id] ? Object.assign({}, i, { link: a }) : i;
    });
    /* anche il collegamento rapido, se punta allo stesso posto */
    S.data.links = (S.data.links || []).map(function(l){
      return (l.url && l.url.toLowerCase().indexOf(da.toLowerCase()) >= 0)
        ? Object.assign({}, l, { url: a }) : l;
    });
    S.err = ""; S.sostDa = ""; S.sostA = ""; svuota("sost-da","sost-a");
    toast("Indirizzo cambiato in "+coinvolte.length+(coinvolte.length===1?" voce":" voci"), "ok");
    bumpSim(); commit();
  }
  else if (act === "wipe") {
    if (!confirm("Rimuovere tutte le voci e ripartire da un pannello vuoto? L'azione è annullabile.")) return;
    snapshot("Tutti i task e le note sono stati eliminati.", "Vuoi annullare lo svuotamento?");
    S.data.items = []; S.data.capture = []; S.data.checks = {}; S.data.doneAt = {};
    S.data.skips = {}; S.data.log = {}; S.data.top3 = { key:"", list:[] };
    S.editId = null; S.stepsOpen = null;
    bumpSim(); commit();
  }
  else if (act === "importclick") { document.getElementById("importfile").click(); }
  else if (act === "theme") { P.theme = v; savePrefs(); render(); }
  else if (act === "reset") {
    if (!confirm("Ripristinare i dati iniziali? Le voci attuali andranno perse.")) return;
    snapshot("Il pannello è tornato alla configurazione iniziale.", "Vuoi annullare il ripristino?");
    S.data = seed();
    S.editId = null; commit();
  }
});

document.addEventListener("change", function(ev){
  var el = ev.target.closest("[data-chg]");
  if (el) {
    var c = el.getAttribute("data-chg"), id = el.getAttribute("data-id"), val = el.value;
    var n = parseInt(el.getAttribute("data-n"), 10);
    /* ROU-001: su una ricorrenza le modifiche dei campi passano dall'ambito
       scelto. `patch` continua a valere per tutto il resto: qui si intercetta
       solo il caso in cui l'ambito NON è «tutta la serie», perché è l'unico in
       cui il comportamento cambia. */
    if (S.erroriTask && /^add-/.test(c || "")) {
      var campoTradotto = { "add-area":"area", "add-freq":"freq", "add-start":"start",
                            "add-dur":"dur", "add-due":"due", "add-dom":"dom" }[c];
      if (campoTradotto)
        S.erroriTask = S.erroriTask.filter(function(x){ return x.campo !== campoTradotto; });
    }
    var _itMod = id ? itemById(id) : null;
    if (_itMod && _itMod.freq !== "once" && S.ambitoSerie && S.ambitoSerie !== "serie" &&
        /^e-/.test(c || "")) {
      var _mod = campoEditor(c, val, _itMod);
      if (_mod) {
        modificaSerie(id, S.ambitoSerie, _mod, S.cursorKey || dk());
        render();
        return;
      }
    }
    if (c === "e-start") patch(id, val === "" ? { start: undefined, dur: undefined }
                                          : { start: parseFloat(val), dur: (itemById(id)||{}).dur || 1 });
    else if (c === "e-dur") {
      var itd = itemById(id) || {};
      var maxd = Math.max(0.25, 24 - (itd.start || 0));
      patch(id, { dur: Math.min(parseFloat(val), maxd) });
    }
    else if (c === "e-area") patch(id, { area: val });
    else if (c === "e-dom") patch(id, { dom: parseInt(val,10) });
    else if (c === "e-everyd") {
      var ed2 = parseInt(val,10);
      patch(id, ed2 > 1 ? { every: ed2, since: dk() } : { every: undefined, since: undefined });
    }
    else if (c === "e-mon") patch(id, { mon: parseInt(val,10) });
    else if (c === "e-recheck") patch(id, { recheck: val || undefined });
    else if (c === "e-every") {
      var ev = parseInt(val,10);
      patch(id, ev > 1 ? { every: ev, since: dayKey(new Date()) } : { every: undefined, since: undefined });
    }
    else if (c === "e-due") patch(id, { due: val || undefined });
    else if (c === "e-fine") patch(id, { fine: val || undefined });
    else if (c === "e-importo") {
      var num = parseFloat(String(val).replace(/\./g, "").replace(",", "."));
      patch(id, { importo: (isFinite(num) && num > 0) ? Math.round(num*100)/100 : undefined });
    }
    else if (c === "e-entrata") patch(id, { entrata: val === "1" ? true : undefined });
    else if (c === "e-date") patch(id, { date: val });
    else if (c === "e-label") patch(id, { label: val });
    else if (c === "e-link") patch(id, { link: val });
    else if (c === "e-note") patch(id, { note: val });
    else if (c === "e-place") patch(id, { place: val || undefined });
    else if (c === "e-alarm") patch(id, { alarm: val === "" ? undefined : parseInt(val,10) });
    else if (c === "ptext") { var L = top3(); L[n].t = val; putTop3(L); }
    else if (c === "month") { S.nuovo = null; var d1 = keyToDate(S.cursorKey); d1.setDate(1); d1.setMonth(parseInt(val,10)); S.cursorKey = dayKey(d1); render(); }
    else if (c === "year") { S.nuovo = null; var d2 = keyToDate(S.cursorKey); d2.setFullYear(parseInt(val,10)); S.cursorKey = dayKey(d2); render(); }
    else if (c === "alarm") { S.ui.alarm = val; }
    else if (c === "add-area") { S.ui.area = val; }
    else if (c === "add-freq") { S.ui.freq = val; render(); }
    else if (c === "add-start") { S.ui.start = val; render(); }
    else if (c === "add-dur") { S.ui.dur = val; }
    else if (c === "add-date") { S.ui.date = val; }
    else if (c === "add-due") { S.ui.due = val; }
    else if (c === "add-every") { S.ui.every = parseInt(val,10); render(); }
    else if (c === "add-dom") { S.ui.dom = parseInt(val,10); render(); }
    else if (c === "onb-prio" && S.onboarding) {
      S.onboarding.priorita[n] = val; salvaPrioritaOnboarding();
    }
    else if (c === "ch-domani" && S.chiusura) { S.chiusura.domani[n] = val; }
    else if ((c === "onb-fda" || c === "onb-fa") && S.onboarding) {
      var ov = hhmmOra(val);
      if (ov === null) return;
      if (c === "onb-fda") S.onboarding.fascia.da = ov; else S.onboarding.fascia.a = ov;
      render();
    }
    else if (c === "guida-cerca") { S.guidaQuery = val; render(); }
    else if (c === "onb-task" && S.onboarding) { S.onboarding.primoTask = val; }
    else if (c === "fg-da" || c === "fg-a") {
      var fx = pref("fascia") || {};
      var gio = (fx.giorni && fx.giorni[n]) ? fx.giorni[n] : { da: fasciaDi().da, a: fasciaDi().a };
      var nv = hhmmOra(val);
      if (nv === null) return;
      var da2 = (c === "fg-da") ? nv : gio.da, a2 = (c === "fg-a") ? nv : gio.a;
      if (!impostaFascia(da2, a2, n)) { toast("La fine deve venire dopo l'inizio", "info"); return; }
      render();
    }
    else if (c === "set-analisi") { setImp("analisiAttive", !analisiAttive()); render(); }
    else if (c === "set-notifiche") {
      if (pref("notificheAperto")) { setImp("notificheAperto", false); render(); }
      else chiediNotifiche(function(ok){
        if (!ok) toast("Permesso non concesso: gli avvisi restano spenti", "info");
        render();
      });
    }
    else if (c === "set-anticipo") { setImp("notificheAnticipo", parseInt(val,10) || 10); render(); }
    else if (c === "set-chiusuraOra") { setImp("chiusuraOra", val || "18:00"); render(); }
    else if (c === "set-chiusuraAttiva") { setImp("chiusuraAttiva", !pref("chiusuraAttiva")); render(); }
    else if (c === "set-revisioneGiorno") { setImp("revisioneGiorno", parseInt(val,10) || 0); render(); }
    else if (c === "set-revisioneAttiva") { setImp("revisioneAttiva", !pref("revisioneAttiva")); render(); }
    else if (c === "set-sogliaLavoro") {
      var sl = parseInt(val,10);
      setImp("sogliaLavoro", (sl >= 0 && sl <= 100) ? sl : null); render();
    }
    else if (c === "ics-scelto" && S.icsAnteprima) {
      var e2 = S.icsAnteprima.eventi[n];
      if (e2 && !e2.esisteGia) { e2.scelto = !e2.scelto; render(); }
    }
    else if (c === "ics-area" && S.icsAnteprima) {
      var e3 = S.icsAnteprima.eventi[n];
      if (e3) { e3.area = (val === "vita") ? "vita" : "lavoro"; render(); }
    }
    else if (c === "linkarea") { S.ui.linkArea = val || ""; render(); }
    else if (c === "linkrowarea") {
      S.data.links = (S.data.links||[]).map(function(l){
        if (l.id !== id) return l;
        var c3 = Object.assign({}, l);
        if (val) c3.area = val; else delete c3.area;
        return c3;
      });
      commit();
    }
    else if (c === "city") { S.data.city = val.trim() || undefined; commit(); }
    else if (c === "sost-da") { S.sostDa = val.trim(); render(); }
    else if (c === "sost-a") { S.sostA = val.trim(); render(); }
    else if (c === "p-motivo") {
      S.data.pause = Object.assign({}, S.data.pause || {});
      if (val) S.data.pause.motivo = val; else delete S.data.pause.motivo;
      commit();
    }
    else if (c === "p-area") {
      S.data.pause = Object.assign({}, S.data.pause || {});
      if (val === "lavoro" || val === "vita") S.data.pause.area = val; else delete S.data.pause.area;
      commit();
    }
    else if (c === "p-from") { S.data.pause = Object.assign({}, S.data.pause, { from: val }); commit(); }
    else if (c === "p-to") { S.data.pause = Object.assign({}, S.data.pause, { to: val }); commit(); }
    else if (c === "add-mon") { S.ui.mon = parseInt(val,10); render(); }
    else if (c === "add-everyd") { S.ui.everyd = parseInt(val,10); render(); }
    else if (c === "cap-area") { S.ui.capArea = val; }
    else if (c === "tagf") { S.tagF = val; render(); }
    else if (c === "e-tag") patch(id, { tag: val.trim() || undefined });
    else if (c === "e-linkpick") { if (val) patch(id, { link: val }); }
    else if (c === "a-linkpick") {
      var campoL = document.getElementById("alink");
      if (campoL && val) { campoL.value = val; svuota("alink"); }
    }
    else if (c === "n-start" && S.nuovo) {
      S.nuovo.start = parseFloat(val);
      S.nuovo.dur = Math.min(S.nuovo.dur, Math.max(0.25, 24 - S.nuovo.start));
      render();
    }
    else if (c === "n-dur" && S.nuovo) {
      S.nuovo.dur = Math.min(parseFloat(val), Math.max(0.25, 24 - S.nuovo.start));
      render();
    }
    else if (c === "n-area" && S.nuovo) { S.nuovo.area = val; render(); }
    else if (c === "query") { if (S.query !== val) { S.query = val; render(); } }
    return;
  }
  if (ev.target.id === "importfile" && ev.target.files && ev.target.files[0]) {
    var fr = new FileReader();
    fr.onload = function(){
      try {
        var obj = JSON.parse(fr.result);
        if (!obj || !Array.isArray(obj.items)) throw new Error("formato");
        if ((obj.v || 1) > SCHEMA_ATTUALE) throw new Error("versione");
        if (!confirm("Sostituire i dati attuali con quelli del backup?")) return;
        snapshot("I dati del backup hanno sostituito quelli presenti.", "Vuoi annullare l'importazione?");
        S.data = Object.assign(seed(), obj);
        normalizeData();
        S.editId = null; bumpSim(); commit();
      } catch (e) {
        S.err = (e.message === "versione")
          ? "Backup creato con una versione più recente del pannello: aggiorna prima il file HTML."
          : "File non valido: non sembra un backup del pannello.";
        render();
      }
    };
    fr.readAsText(ev.target.files[0]);
  }
});

/* Trascinamento dei collegamenti: sul desktop. Le frecce restano l'alternativa
   che funziona anche col dito, dove il trascinamento nativo non è disponibile. */
document.addEventListener("dragstart", function(ev){
  var r = ev.target && ev.target.closest && ev.target.closest("[data-lrow]");
  if (!r) return;
  S.lDrag = parseInt(r.getAttribute("data-lrow"), 10);
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = "move";
    try { ev.dataTransfer.setData("text/plain", String(S.lDrag)); } catch (e) {}
  }
});
document.addEventListener("dragover", function(ev){
  if (S.lDrag === null || S.lDrag === undefined) return;
  var r = ev.target && ev.target.closest && ev.target.closest("[data-lrow]");
  if (r) ev.preventDefault();
});
document.addEventListener("drop", function(ev){
  if (S.lDrag === null || S.lDrag === undefined) return;
  var r = ev.target && ev.target.closest && ev.target.closest("[data-lrow]");
  if (!r) { S.lDrag = null; return; }
  ev.preventDefault();
  var a = parseInt(r.getAttribute("data-lrow"), 10);
  var da = S.lDrag;
  S.lDrag = null;
  if (muoviLink(da, a)) commit();
});
document.addEventListener("dragend", function(){ S.lDrag = null; });
/* lettura del file .ics scelto: avviene sul dispositivo, nulla viene inviato */
document.addEventListener("change", function(ev){
  var t = ev.target;
  if (!t || t.id !== "icsfile" || !t.files || !t.files[0]) return;
  var fr = new FileReader();
  fr.onload = function(){
    try {
      var testoIcs = String(fr.result || "");
      var quanti = (testoIcs.match(/BEGIN:VEVENT/g) || []).length;
      if (quanti > SOGLIE.eventiIcs) {
        /* PER-001: sopra la soglia misurata la lettura dichiara di essere in
           corso invece di bloccare la pagina in silenzio */
        conAttesa("Lettura del calendario", function(){
          S.icsAnteprima = leggiIcs(testoIcs);
        }).then(function(){
          if (!S.icsAnteprima.eventi.length) toast("Nessun evento leggibile in questo file", "info");
          t.value = ""; render();
        }).catch(function(){ toast("File non leggibile", "info"); S.icsAnteprima = null; render(); });
        return;
      }
      S.icsAnteprima = leggiIcs(testoIcs);
      if (!S.icsAnteprima.eventi.length)
        toast("Nessun evento leggibile in questo file", "info");
    } catch (e) { toast("File non leggibile", "info"); S.icsAnteprima = null; }
    t.value = "";
    render();
  };
  fr.onerror = function(){ toast("Lettura del file non riuscita", "info"); };
  fr.readAsText(t.files[0]);
});
document.addEventListener("input", function(ev){
  if (ev.target && ev.target.id === "q" && S.query !== ev.target.value) {
    S.query = ev.target.value;
    render();
  }
});

document.addEventListener("keydown", function(ev){
  var t = ev.target;
  if (ev.key === "Escape") {
    if (S.revisione) { chiudiRevisione(); return; }
    if (S.chiusura) { chiudiChiusura(); return; }
    if (S.onboarding) { saltaOnboarding(); return; }
    if (S.menuNuovo) { S.menuNuovo = false; render(); return; }
    if (S.nuovo) { S.nuovo = null; svuota("n-label"); render(); return; }
    if (S.dup) { S.dup = null; render(); return; }
    if (S.toast) { S.toast = null; render(); return; }
    if (S.flash) { S.flash = null; render(); return; }
    if (S.editId) { flushPending(); S.editId = null; render(); return; }
    if (S.stepsOpen) { S.stepsOpen = null; render(); return; }
    if (S.query) { S.query = ""; svuota("q"); render(); return; }
    if (S.searchOpen) { S.searchOpen = false; render(); return; }
    return;
  }
  /* Invio o barra spaziatrice attivano gli elementi non nativi */
  if ((ev.key === "Enter" || ev.key === " ") && t && t.getAttribute &&
      t.getAttribute("tabindex") === "0" && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) {
    ev.preventDefault();
    if (t.classList.contains("agblk")) {
      S.editFrom = "agenda";
      S.editId = S.editId === t.getAttribute("data-blk") ? null : t.getAttribute("data-blk");
      render();
    } else t.click();
    return;
  }
  /* frecce: sposta il blocco selezionato di un quarto d'ora */
  if (t && t.classList && t.classList.contains("agblk") &&
      (ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
    var it2 = itemById(t.getAttribute("data-blk"));
    if (!it2) return;
    ev.preventDefault();
    var step = (ev.key === "ArrowUp" ? -0.25 : 0.25);
    var ns = Math.max(0, Math.min(24 - (it2.dur||0.5), snap(it2.start + step)));
    patch(it2.id, { start: ns });
    var again = document.querySelector('.agblk[data-blk="'+it2.id+'"]');
    if (again) { try { again.focus({ preventScroll:true }); } catch (e0) { again.focus(); } }
    return;
  }
  if (ev.key !== "Enter") return;
  var id = ev.target.id || "";
  function premi(sel){
    var b = document.querySelector(sel);
    if (b) { ev.preventDefault(); b.click(); return true; }
    return false;
  }
  if (id === "nlabel") premi('[data-act="nuovocrea"]');
  else if (id === "newlabel") premi('[data-act="additem"]');
  else if (id === "capinput") premi('[data-act="capadd"]');
  else if (id === "lname" || id === "lurl") premi('[data-act="linkadd"]');
  else if (id === "stepin") premi('[data-act="stepadd"]');
  else if (id.indexOf("qs") === 0) premi('[data-act="stepadd"][data-id="'+id.slice(2)+'"]');
  else if (id === "f1" || id === "f2" || id === "f3" || id === "f4") premi('[data-act="synclink"]');
  else if (id === "q") { ev.preventDefault(); }
  else if (ev.target.classList && ev.target.classList.contains("finput")) ev.target.blur();
});

