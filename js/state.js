/* state.js — stato, preferenze, persistenza, migrazioni, rollover
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- stato ---------- */
var S = {
  data: null, now: new Date(), view: "giorno", filter: "tutto",
  /* la guida: `null` significa chiusa. Una stringa — anche vuota — significa
     aperta su quella sezione. Distinguere `null` da `undefined` qui è
     essenziale: con il campo mancante la guida risultava sempre aperta e
     copriva il pannello. */
  guidaAperta: null, guidaQuery: "", modoSelezione: null, sezione: "oggi",
  cursorKey: dayKey(new Date()), editId: null, wkPick: null, ics: "",
  ui: { linkArea:"", area:"lavoro", freq:"daily", start:"", dur:"1", date:"", due:"",
        days:[new Date().getDay()], every:1, everyd:1,
        dom:new Date().getDate(), mon:new Date().getMonth(),
        capArea:"lavoro", alarm:"10" },
  scrolled: false, linkEdit: false, searchOpen: false, filtri: false, tagF: "tutti", editFrom: "list", dragging: false, dup: null,
  simCache: {}, simVer: 0, simCacheVer: -1, query: "", undo: null, focusKey: null,
  stepsOpen: null, addMore: false, toStep: null, flash: null, toast: null, digest: false, digTxt: "",
  pending: null, clearKeep: {}, ymap: null, chiediCausa: null, chiusura: null, flashChiusura: null,
  onboarding: null, revisione: null, ancora: null, lDrag: null, sostDa: "", sostA: "", err: "",
  /* `null` = nessuna versione nuova in attesa. Lo scrive js/pwa-boot.js quando
     il service worker ne ha installata una; dichiarato qui come tutti gli altri
     campi di stato, per la stessa ragione di `guidaAperta`. */
  aggiornamento: null
};

/* Rimette in ordine dati arrivati da backup, sincronizzazione o versioni vecchie. */
function normalizeData(){
  /* la vista Mese è stata rimossa: chi arriva da dati vecchi finisce sulla settimana */
  if (["giorno","settimana"].indexOf(S.view) < 0) S.view = "settimana";
  bumpSim();
  var d = S.data;
  if (!Array.isArray(d.items)) d.items = [];
  if (!d.checks) d.checks = {};
  if (!Array.isArray(d.capture)) d.capture = [];
  if (!d.top3) d.top3 = { key:"", list:[] };
  if (!d.doneAt) d.doneAt = {};
  if (!d.skips) d.skips = {};
  if (!Array.isArray(d.archive)) d.archive = [];
  if (!d.log) d.log = {};
  if (!Array.isArray(d.links)) d.links = seed().links;
  /* i collegamenti predefiniti aggiunti dopo il primo avvio vengono proposti una volta sola:
     se poi li togli, non tornano */
  /* «linksV» non compare nel modello base proprio per questo: se ci fosse,
     unendolo ai dati salvati risulterebbe già aggiornato e la migrazione
     non partirebbe mai */
  if ((d.linksV || 1) < LINKS_V) {
    var presenti = {};
    d.links.forEach(function(l){ if (l && l.url) presenti[String(l.url).replace(/\/+$/,"")] = 1; });
    seed().links.forEach(function(l){
      if (!presenti[l.url.replace(/\/+$/,"")])
        d.links.push({ id: uid(), name: l.name, url: l.url, area: l.area });
    });
    /* ai collegamenti che corrispondono a un predefinito assegno la sua area,
       senza toccare quelli aggiunti da te */
    var areeNote = {};
    seed().links.forEach(function(l){ areeNote[l.url.replace(/\/+$/,"")] = l.area; });
    d.links.forEach(function(l){
      if (l.area === undefined && l.url && areeNote[String(l.url).replace(/\/+$/,"")])
        l.area = areeNote[String(l.url).replace(/\/+$/,"")];
    });
    d.linksV = LINKS_V;
  }
  delete d.history;
  d.v = SCHEMA_ATTUALE;
  if (d.pause) {
    /* area e motivo devono essere fra quelli previsti */
    if (d.pause.area !== "lavoro" && d.pause.area !== "vita") delete d.pause.area;
    if (!MOTIVI.some(function(o){ return o[0] === d.pause.motivo; })) delete d.pause.motivo;
  }
  if (d.pause && !(validKey(d.pause.from) && validKey(d.pause.to))) {
    if (!d.pause.from && !d.pause.to) d.pause = null;
  }

  var freqs = { daily:1, weekly:1, monthly:1, once:1, yearly:1 };
  d.items = d.items.filter(function(i){ return i && i.id; }).map(function(i){
    /* DIFETTO CORRETTO — le attività non sapevano quando erano nate.

       js/accumulo.js (REC-005) misura da quanto una voce sta lì con
       `giorniInSospeso()`, che legge `i.creatoIl` e, in mancanza, la data
       dell'ultima modifica in `data.versioni`. Ma `creatoIl` non veniva
       scritto su nessuna attività — solo su modelli e condivisioni — e
       `data.versioni` non ha una voce per gli elementi che nessuno ha ancora
       toccato, perché `aggiornaVersioni()` salta di proposito il primo giro.
       Risultato: `giorniInSospeso()` restituiva 0 per qualunque voce, e il
       ramo «è qui da tre settimane senza una data» non poteva scattare mai.
       Verificato: 0 giorni su una voce appena inserita e su tutte le altre.

       Il timbro si mette qui e non nei sette punti che creano attività: è
       l'unica funzione che le vede tutte, gira dopo ogni modifica ed è
       idempotente. Per le voci che esistevano già il conteggio parte da oggi,
       e va bene così: quando sono state create non lo sappiamo, e inventare
       una data renderebbe falso proprio il numero che REC-005 mostra. */
    if (!i.creatoIl) i.creatoIl = new Date().toISOString();
    if (!AREAS[i.area]) i.area = "lavoro";
    if (!freqs[i.freq]) i.freq = "daily";
    if (typeof i.label !== "string" || !i.label.trim()) i.label = "Senza nome";
    if (i.freq === "weekly") {
      if (!Array.isArray(i.days) || !i.days.length) i.days = [i.day === undefined ? 1 : i.day];
      i.days = i.days.filter(function(n){ return n >= 0 && n <= 6; });
      if (!i.days.length) i.days = [1];
      delete i.day;
      if (!(i.every > 1)) delete i.every; else if (!validKey(i.since)) i.since = dayKey(new Date());
    }
    if (i.freq === "daily") {
      if (!(i.every > 1)) { delete i.every; delete i.since; }
      else if (!validKey(i.since)) i.since = dayKey(new Date());
    }
    if (i.freq === "yearly") {
      if (!(i.mon >= 0 && i.mon <= 11)) i.mon = 0;
      if (!(i.dom >= 0 && i.dom <= 31)) i.dom = 1;
    }
    if (i.flessibile && i.freq !== "weekly" && i.freq !== "monthly") delete i.flessibile;
    if (!i.flessibile) delete i.flessibile;
    if (!i.waiting) { delete i.waiting; delete i.recheck; }
    else if (i.recheck && !validKey(i.recheck)) delete i.recheck;
    if (i.freq === "once" && !validKey(i.date)) i.date = dayKey(new Date());
    if (i.due && !validKey(i.due)) delete i.due;
    if (i.fine && (!validKey(i.fine) || i.freq === "once")) delete i.fine;
    if (typeof i.start === "number" && !(i.start >= 0 && i.start < 24)) { delete i.start; delete i.dur; }
    if (typeof i.start === "number") {
      if (!(i.dur > 0)) i.dur = 0.5;
      if (i.start + i.dur > 24) i.dur = Math.max(0.25, 24 - i.start);
    }
    if (i.link && !safeUrl(i.link)) delete i.link;
    if (i.alarm !== undefined && !(i.alarm >= 0 && i.alarm <= 1440)) delete i.alarm;
    if (i.importo !== undefined) {
      var im = parseFloat(i.importo);
      if (!isFinite(im) || im <= 0 || im > 1e9) { delete i.importo; delete i.entrata; }
      else i.importo = Math.round(im*100)/100;
    } else delete i.entrata;
    if (i.entrata !== undefined) i.entrata = !!i.entrata || undefined;
    /* migrazione dal vecchio campo «progetto», troppo specifico */
    if (i.project !== undefined) {
      if (i.tag === undefined) i.tag = i.project;
      delete i.project;
    }
    if (i.tag !== undefined) {
      i.tag = String(i.tag).trim().replace(/\s+/g, " ").slice(0, 60);
      if (!i.tag) delete i.tag;
    }
    if (i.place !== undefined) {
      i.place = String(i.place).trim().slice(0, 160);
      if (!i.place) delete i.place;
    }
    if (i.steps !== undefined) {
      i.steps = (Array.isArray(i.steps) ? i.steps : [])
        .filter(function(x){ return x && typeof x.t === "string" && x.t.trim(); })
        .map(function(x){
          if (x.done !== undefined) return { t: x.t, s: x.done ? stampFor(i.freq) : undefined, una: x.una };
          return { t: x.t, s: x.s, una: x.una || undefined };
        });
      if (!i.steps.length) delete i.steps;
    }
    return i;
  });
  var ids = {};
  d.items.forEach(function(i){
    /* due voci con lo stesso identificativo condividerebbero spunte e passi */
    if (ids[i.id]) i.id = uid();
    ids[i.id] = 1;
  });

  /* Appuntamenti conclusi da oltre 90 giorni: escono dalle liste ma restano
     nell'archivio, che serve al controllo dei doppioni. */
  var limite = dayKey(new Date(Date.now() - 90*86400000));
  var resta = [];
  d.items.forEach(function(i){
    if (i.freq === "once" && i.date < limite && d.checks[i.id] === "fatto") {
      d.archive.push({ label:i.label, area:i.area, date: d.doneAt[i.id] || i.date });
      delete d.checks[i.id]; delete d.doneAt[i.id]; delete ids[i.id];
    } else resta.push(i);
  });
  d.items = resta;
  d.archive = d.archive.slice(-300);

  Object.keys(d.log).forEach(function(k){ if (!ids[k]) delete d.log[k]; });
  ["chiusure","revisioni","completamenti","modelli"].forEach(function(c){
    if (!Array.isArray(d[c])) d[c] = [];
  });
  if (!d.rinvii || typeof d.rinvii !== "object") d.rinvii = {};
  if (!d.syncMeta || typeof d.syncMeta !== "object")
    d.syncMeta = { revLocale:0, revRemota:0, ultimaSync:null, inAttesa:false, conflitto:null };
  /* i rinvii che puntano a voci sparite non servono più */
  Object.keys(d.rinvii).forEach(function(k){
    if (!d.items.some(function(i){ return i.id === k; })) delete d.rinvii[k];
  });
  d.ignora = d.ignora || {};
  Object.keys(d.ignora).forEach(function(k){ if (!ids[k] || !validKey(d.ignora[k])) delete d.ignora[k]; });
  Object.keys(d.checks).forEach(function(k){ if (!ids[k]) delete d.checks[k]; });
  Object.keys(d.doneAt).forEach(function(k){ if (!ids[k]) delete d.doneAt[k]; });
  Object.keys(d.skips).forEach(function(k){
    var it0 = d.items.filter(function(x){ return x.id === k; })[0];
    if (!it0 || it0.freq === "once") delete d.skips[k];
  });
  d.capture = d.capture.filter(function(c){ return c && c.id && typeof c.text === "string"; })
    .map(function(c){ if (!AREAS[c.area]) c.area = "lavoro"; return c; });
  if (Array.isArray(d.top3.list))
    d.top3.list = d.top3.list.map(function(e){
      if (e && typeof e === "object" && e.id && !ids[e.id]) return { t: e.t || "", id: null, done: false };
      return e;
    });
  d.links = d.links.filter(function(l){ return l && l.id && l.name && safeUrl(l.url); });
  d.links.forEach(function(l){ if (l.area !== "lavoro" && l.area !== "vita") delete l.area; });
  /* pannelli rimasti aperti su voci non più esistenti */
  if (S.editId && !ids[S.editId]) S.editId = null;
  if (S.stepsOpen && !ids[S.stepsOpen]) S.stepsOpen = null;
}

function load(){
  var grezzo = null, d = null;
  try {
    grezzo = localStorage.getItem(KEY);
    d = grezzo ? JSON.parse(grezzo) : null;
  } catch (e) { d = null; }

  /* DIFETTO CORRETTO — la migrazione non finiva mai su disco.

     `migra()` restituiva i dati aggiornati, `S.data` li riceveva, e lì si
     fermava: nessuno salvava. Su disco lo schema restava alla versione
     vecchia per sempre, e a ogni singola apertura del pannello:

       - l'intera catena di migrazioni veniva rieseguita da capo;
       - `salvaBackupPreMigrazione()` riscriveva la copia di sicurezza,
         perché `vecchia < SCHEMA_ATTUALE` era vero ogni volta — tenendo
         così in memoria permanente due copie complete dei dati, quando il
         commento qui sotto promette una copia che resta finché non viene
         sostituita da una migrazione nuova;
       - i campi creati dalla migrazione (con lo schema 5: `tipo` su 23
         attività ricorrenti e `settings.routineSpiegata`) esistevano solo in
         memoria, e sparivano alla chiusura.

     Verificato aggiornando dalla build fcef637a9f70: su disco `v` restava 4 e
     `tipo` non compariva su nessuna voce, mentre in memoria erano corretti.

     Funzionava per caso, perché i passi di migrazione sono idempotenti e
     perché la prima modifica dell'utente salvava tutto. Ma un passo non
     idempotente introdotto in futuro avrebbe corrotto i dati a ogni avvio, e
     il difetto non si sarebbe visto subito. Ora la migrazione si conclude
     dove doveva concludersi: salvando. */
  var migrato = false;
  if (d) {
    /* copia di sicurezza prima di toccare qualsiasi cosa, e migrazione su
       una copia: se qualcosa va storto i dati originali restano dove sono */
    var vecchia = versioneDati(d);
    if (vecchia < SCHEMA_ATTUALE) salvaBackupPreMigrazione(grezzo);
    var esito = migra(d, function(t){ REGISTRO_MIGR.push(new Date().toISOString()+" — "+t); });
    d = esito.dati;
    migrato = (esito.esito === "migrato");
    if (esito.esito === "errore") {
      S.err = "Aggiornamento dei dati non riuscito: sto usando i dati come erano. "+
              "Trovi la copia di sicurezza in Impostazioni.";
    }
  }
  S.data = d ? Object.assign(seed(), d) : seed();
  if (!S.data.settings) S.data.settings = impostazioniPredefinite();
  else S.data.settings = Object.assign(impostazioniPredefinite(), S.data.settings);
  loadPrefs();
  migratePrefs();
  normalizeData();
  rollover();
  /* dopo la normalizzazione, così su disco finisce la forma definitiva e non
     una intermedia; solo se una migrazione è avvenuta davvero, per non
     riscrivere i dati a ogni apertura senza motivo */
  if (migrato) save();
}
/* scorciatoie di lettura e scrittura delle impostazioni */
function pref(chiave){
  var s = (S.data && S.data.settings) || impostazioniPredefinite();
  return s[chiave];
}
function setImp(chiave, valore){
  S.data.settings = S.data.settings || impostazioniPredefinite();
  S.data.settings[chiave] = valore;
  save();
}
function modoAvanzato(){ return pref("modo") === "avanzata"; }
/* Registra com'è andato l'ultimo giorno in cui il pannello è stato aperto.
   Non inventa dati sui giorni in cui non l'hai usato. */
/* I passi segnati «una volta» spariscono dopo essere stati fatti:
   la lista della spesa torna alle voci fisse, senza gli extra della settimana. */
function pulisciPassi(){
  S.data.items.forEach(function(i){
    if (!Array.isArray(i.steps) || !i.steps.length) return;
    var st = stampFor(i.freq);
    var resta = i.steps.filter(function(p){ return !(p.una && p.s && p.s !== st); });
    if (resta.length !== i.steps.length) i.steps = resta.length ? resta : undefined;
  });
}
function rollover(){
  pulisciPassi();
  var today = dayKey(new Date());
  if (S.data.lastDay && S.data.lastDay !== today) {
    var log = S.data.log || {};
    var ieri = keyToDate(S.data.lastDay);
    S.data.items.forEach(function(i){
      if (i.freq !== "daily" || !onDay(i, ieri)) return;
      var ok = S.data.checks[i.id] === S.data.lastDay ? "1" : "0";
      log[i.id] = ((log[i.id] || "") + ok).slice(-14);
    });
    S.data.log = log;
  }
  if (S.data.lastDay !== today) { S.data.lastDay = today; save(); }
}
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(S.data)); S.err = ""; }
  catch (e) { S.err = "Spazio esaurito: i dati potrebbero non essere stati salvati."; }
}
function commit(){
  /* SYN-004: prima di salvare, segno quali record sono cambiati rispetto
     all'ultimo salvataggio. Senza questo, il confronto per record non
     saprebbe distinguere «modificato qui» da «arrivato di là». */
  if (typeof aggiornaVersioni === "function") aggiornaVersioni();
  /* la modifica entra in coda: se non c'è rete, parte quando torna */
  if (typeof accodaModifica === "function" && typeof syncReady === "function" && syncReady())
    accodaModifica("salvataggio", null); save(); scheduleSync(); render(); }
/* Fotografia dei dati prima di un'azione distruttiva: un solo passo indietro. */
function snapshot(label, titolo){
  try { S.undo = { label: label, titolo: titolo || "Vuoi annullare?",
                   data: JSON.parse(JSON.stringify(S.data)) }; }
  catch (e) { S.undo = null; }
}
function undoNow(){
  if (!S.undo) return;
  S.data = S.undo.data;
  S.undo = null;
  bumpSim(); normalizeData(); commit();
}



/* Sezione chiusa o aperta: stato dell'interfaccia, condiviso da più aree,
   quindi vive qui e non in un modulo di feature. */
function folded(freq){
  var f = P.fold || {};
  if (f[freq] === undefined)
    return (freq === "routine" || freq === "settings" ||
            freq === "guidasync" || freq === "setcal" || freq === "setind" || freq === "setdati" ||
            freq === "setsync" || freq === "setpausa");
  return !!f[freq];
}
