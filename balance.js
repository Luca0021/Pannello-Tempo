/* balance.js — il calcolo dell'equilibrio fra lavoro e vita.
   È il cuore dichiarato del prodotto, quindi qui non si stima niente in silenzio:
   ogni numero dichiara da dove viene e le soglie le sceglie l'utente. */

/* Quando completi davvero una cosa, rispetto a quando l'avevi messa in agenda.
   Restituisce null finché il campione non è abbastanza grande: un suggerimento
   basato su due volte non è un suggerimento, è un caso. */
function abitudineOraria(id, minimo){
  var storia = (S.data.completamenti || []).filter(function(c){
    return c.id === id && c.oraPrevista !== null;
  });
  if (storia.length < (minimo || 5)) return null;
  var ore = storia.map(function(c){ return c.ora; }).sort(function(a,b){ return a-b; });
  var mediana = ore[Math.floor(ore.length/2)];
  var previste = storia[0].oraPrevista;
  var scarto = mediana - previste;
  if (Math.abs(scarto) < 0.75) return null;      /* meno di 45 minuti: non vale la pena */
  return { campione: storia.length, mediana: mediana, prevista: previste, scarto: scarto };
}

function calcoloImp(){
  var c = (pref("calcolo") || {});
  return {
    includiRoutine:     c.includiRoutine !== false,
    includiAppuntamenti:c.includiAppuntamenti !== false,
    includiSenzaDurata: c.includiSenzaDurata === true,
    minutiPredefiniti:  c.minutiPredefiniti || 0
  };
}

/* Una voce entra nel conteggio? La risposta dipende dalle scelte dell'utente. */
function contaNelBilancio(i, opz){
  if (!i || isWaiting(i)) return false;
  if (i.freq === "once" && !opz.includiAppuntamenti) return false;
  if (i.freq !== "once" && !opz.includiRoutine) return false;
  if (typeof i.start !== "number" && !opz.includiSenzaDurata) return false;
  return true;
}
function minutiDi(i, opz){
  if (typeof i.start === "number") return Math.round((i.dur || 0.5) * 60);
  return opz.includiSenzaDurata ? (opz.minutiPredefiniti || 0) : 0;
}

/* Fotografia di un giorno: minuti e conteggi per area, con l'elenco di ciò
   che è stato escluso e perché. */
function bilancioGiorno(d){
  var opz = calcoloImp();
  var giorno = d || S.now;
  var r = {
    data: dayKey(giorno),
    lavoro: { minuti:0, minutiFatti:0, voci:0, fatte:0, priorita:0 },
    vita:   { minuti:0, minutiFatti:0, voci:0, fatte:0, priorita:0 },
    esclusiSenzaDurata: 0,
    totaleMinuti: 0,
    datiSufficienti: false
  };
  var elenco = dueOn(giorno).filter(function(i){ return !isSkipped(i); });
  elenco.forEach(function(i){
    var a = r[i.area]; if (!a) return;
    if (typeof i.start !== "number" && !opz.includiSenzaDurata) r.esclusiSenzaDurata++;
    if (!contaNelBilancio(i, opz)) return;
    var m2 = minutiDi(i, opz);
    a.minuti += m2; a.voci++;
    if (isOn(i)) { a.fatte++; a.minutiFatti += m2; }
  });
  (top3() || []).forEach(function(e){
    if (!e || !e.id) return;
    var it = itemById(e.id);
    if (it && r[it.area]) r[it.area].priorita++;
  });
  r.totaleMinuti = r.lavoro.minuti + r.vita.minuti;
  r.datiSufficienti = r.totaleMinuti > 0;
  r.percLavoro = r.totaleMinuti ? Math.round(r.lavoro.minuti * 100 / r.totaleMinuti) : null;
  r.percVita   = r.totaleMinuti ? 100 - r.percLavoro : null;
  return r;
}

/* Somma su un intervallo di giorni **dai dati registrati**, cioè dalle chiusure
   di giornata. Proiettare all'indietro i task di oggi darebbe numeri plausibili
   ma falsi: un giorno senza chiusura è un giorno senza dati, e va detto. */
function bilancioRegistrato(daKey, aKey){
  var r = { da:daKey, a:aKey,
            lavoro:{minuti:0,minutiFatti:0,voci:0,fatte:0},
            vita:{minuti:0,minutiFatti:0,voci:0,fatte:0},
            giorni:0, giorniConDati:0, giorniChiusi:0, totaleMinuti:0, fonte:"registrato" };
  var d = keyToDate(daKey), fine = keyToDate(aKey), guardia = 0;
  while (d <= fine && guardia++ < 400) {
    var k = dayKey(d);
    var c = chiusuraDelGiorno(k);
    r.giorni++;
    if (c) {
      r.giorniChiusi++;
      r.lavoro.minuti += c.minutiLavoro || 0;
      r.vita.minuti   += c.minutiVita || 0;
      r.lavoro.fatte  += c.taskFatti || 0;
      if ((c.minutiLavoro || 0) + (c.minutiVita || 0) > 0) r.giorniConDati++;
    } else if (k === dk()) {
      /* il giorno in corso non è ancora chiuso: uso ciò che è pianificato adesso
         e lo dichiaro come giorno in corso, non come dato storico */
      var oggi = bilancioGiorno(new Date());
      r.lavoro.minuti += oggi.lavoro.minuti;
      r.vita.minuti   += oggi.vita.minuti;
      r.lavoro.fatte  += oggi.lavoro.fatte; r.vita.fatte += oggi.vita.fatte;
      if (oggi.datiSufficienti) { r.giorniConDati++; r.inCorso = true; }
    }
    d = new Date(d.getTime() + 86400000);
  }
  r.totaleMinuti = r.lavoro.minuti + r.vita.minuti;
  r.percLavoro = r.totaleMinuti ? Math.round(r.lavoro.minuti * 100 / r.totaleMinuti) : null;
  r.percVita   = r.totaleMinuti ? 100 - r.percLavoro : null;
  return r;
}

/* Proiezione su un intervallo a partire dalle regole attuali. Serve a stimare
   il futuro, non a raccontare il passato: chi la usa deve dichiararlo. */
function bilancioIntervallo(daKey, aKey){
  var r = { da:daKey, a:aKey,
            lavoro:{minuti:0,minutiFatti:0,voci:0,fatte:0},
            vita:{minuti:0,minutiFatti:0,voci:0,fatte:0},
            giorni:0, giorniConDati:0, giorniChiusi:0, totaleMinuti:0 };
  var d = keyToDate(daKey), fine = keyToDate(aKey);
  var guardia = 0;
  while (d <= fine && guardia++ < 400) {
    var g = bilancioGiorno(d);
    ["lavoro","vita"].forEach(function(a){
      r[a].minuti += g[a].minuti; r[a].minutiFatti += g[a].minutiFatti;
      r[a].voci += g[a].voci; r[a].fatte += g[a].fatte;
    });
    r.giorni++;
    if (g.datiSufficienti) r.giorniConDati++;
    if (chiusuraDelGiorno(dayKey(d))) r.giorniChiusi++;
    d = new Date(d.getTime() + 86400000);
  }
  r.totaleMinuti = r.lavoro.minuti + r.vita.minuti;
  r.percLavoro = r.totaleMinuti ? Math.round(r.lavoro.minuti * 100 / r.totaleMinuti) : null;
  r.percVita   = r.totaleMinuti ? 100 - r.percLavoro : null;
  return r;
}

/* Analisi personali sull'equilibrio. Nessun giudizio, nessuna diagnosi: solo il dato
   e la soglia che l'utente ha scelto. Se i dati non bastano, lo dice. */
function osservazioniBilancio(b){
  var out = [];
  if (!b.totaleMinuti) {
    out.push({ tipo:"nessun-dato",
      testo:"Nessun tempo pianificato registrato: non ci sono dati per parlare di equilibrio." });
    return out;
  }
  if (b.giorniConDati !== undefined && b.giorni && b.giorniConDati < b.giorni)
    out.push({ tipo:"parziale",
      testo:(b.giorni - b.giorniConDati)+" giorni su "+b.giorni+" non hanno tempo registrato: "+
            "le percentuali riguardano solo i giorni con dati." });
  var soglia = pref("sogliaLavoro");
  if (soglia && b.percLavoro !== null && b.percLavoro >= soglia)
    out.push({ tipo:"lavoro-alto",
      testo:"Il tempo pianificato per il lavoro ha rappresentato il "+b.percLavoro+"% del totale registrato, "+
            "sopra la soglia di attenzione che hai impostato ("+soglia+"%)." });
  var minVita = pref("sogliaVita");
  if (minVita && b.percVita !== null && b.percVita < minVita)
    out.push({ tipo:"vita-bassa",
      testo:"Il tempo pianificato per la vita è stato il "+b.percVita+"% del totale registrato, "+
            "sotto il minimo che hai impostato ("+minVita+"%)." });
  if (!out.length && b.percLavoro !== null)
    out.push({ tipo:"neutro",
      testo:"Lavoro "+b.percLavoro+"%, vita "+b.percVita+"% del tempo pianificato registrato." });
  return out;
}

/* Equivalente testuale dei grafici: serve ai lettori di schermo e a chi
   non distingue i colori. */
function bilancioTesto(b){
  return "Lavoro: "+b.lavoro.voci+" attività, "+b.lavoro.fatte+" completate, "+
         dur2s(b.lavoro.minuti/60)+" pianificate. "+
         "Vita: "+b.vita.voci+" attività, "+b.vita.fatte+" completate, "+
         dur2s(b.vita.minuti/60)+" pianificate.";
}
