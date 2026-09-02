/* fascia.js — AGD-001: fascia attiva della giornata.

   Il difetto corretto: il tempo disponibile veniva calcolato su 24 ore, quindi
   il pannello annunciava «libere 23h 30» contando anche la notte. Un numero
   vero in aritmetica e falso nella vita.

   Ora esiste una fascia attiva, con un valore predefinito e la possibilità di
   dichiararne una diversa per singolo giorno della settimana. */

var FASCIA_PREDEFINITA = { da: 8, a: 20 };

/* Restituisce la fascia del giorno indicato. `giorni` contiene eventuali
   eccezioni per giorno della settimana (0 = domenica). */
function fasciaDi(data){
  var f = pref("fascia") || {};
  var base = {
    da: (typeof f.da === "number") ? f.da : FASCIA_PREDEFINITA.da,
    a:  (typeof f.a  === "number") ? f.a  : FASCIA_PREDEFINITA.a
  };
  var g = (data instanceof Date) ? data.getDay() : new Date().getDay();
  if (f.giorni && f.giorni[g] && typeof f.giorni[g].da === "number") {
    base = { da: f.giorni[g].da, a: f.giorni[g].a };
  }
  /* una fascia rovesciata o nulla non ha senso: torno al predefinito */
  if (!(base.a > base.da)) base = { da: FASCIA_PREDEFINITA.da, a: FASCIA_PREDEFINITA.a };
  return { da: base.da, a: base.a, ore: base.a - base.da, giorno: g,
           personalizzata: !!(f.giorni && f.giorni[g]) };
}

function impostaFascia(da, a, giorno){
  if (!(a > da) || da < 0 || a > 24) return false;
  var f = Object.assign({ giorni: {} }, pref("fascia") || {});
  f.giorni = Object.assign({}, f.giorni);
  if (giorno === undefined || giorno === null) { f.da = da; f.a = a; }
  else f.giorni[giorno] = { da: da, a: a };
  setImp("fascia", f);
  return true;
}
function azzeraFasciaGiorno(giorno){
  var f = Object.assign({ giorni: {} }, pref("fascia") || {});
  f.giorni = Object.assign({}, f.giorni);
  delete f.giorni[giorno];
  setImp("fascia", f);
}

/* Quanto di un blocco cade dentro la fascia. Un'attività 07:00-09:00 con
   fascia 08:00-20:00 conta un'ora, non due. */
function dentroFascia(inizio, durata, fascia){
  var fine = inizio + durata;
  var da = Math.max(inizio, fascia.da);
  var a  = Math.min(fine, fascia.a);
  return Math.max(0, a - da);
}

/* Il calcolo richiesto da AGD-001: tre grandezze distinte, mai confuse. */
function tempoDelGiorno(data){
  var fascia = fasciaDi(data);
  var voci = dueOn(data).filter(function(i){
    return typeof i.start === "number" && !isSkipped(i);
  });
  var pianificato = 0, fuori = 0, coperto = [];
  voci.forEach(function(i){
    var dur = i.dur || 0.5;
    var dentro = dentroFascia(i.start, dur, fascia);
    pianificato += dentro;
    fuori += (dur - dentro);
    if (dentro > 0) coperto.push([Math.max(i.start, fascia.da),
                                  Math.min(i.start + dur, fascia.a)]);
  });
  /* Il tempo disponibile non è «fascia meno pianificato»: due attività
     sovrapposte occupano una fascia sola. Unisco gli intervalli. */
  coperto.sort(function(x, y){ return x[0] - y[0]; });
  var occupato = 0, fineCorr = -1, inizioCorr = -1;
  coperto.forEach(function(iv){
    if (iv[0] > fineCorr) {
      if (fineCorr > inizioCorr) occupato += fineCorr - inizioCorr;
      inizioCorr = iv[0]; fineCorr = iv[1];
    } else if (iv[1] > fineCorr) fineCorr = iv[1];
  });
  if (fineCorr > inizioCorr) occupato += fineCorr - inizioCorr;

  return {
    fascia: fascia,
    oreFascia: fascia.ore,
    pianificato: Math.round(pianificato * 100) / 100,   /* somma delle durate dentro la fascia */
    occupato: Math.round(occupato * 100) / 100,         /* fascia effettivamente coperta */
    disponibile: Math.round((fascia.ore - occupato) * 100) / 100,
    fuoriFascia: Math.round(fuori * 100) / 100,
    sovrapposto: Math.round((pianificato - occupato) * 100) / 100,
    voci: voci.length
  };
}

/* Testo per l'interfaccia: dichiara la fascia, non lascia intendere 24 ore. */
function tempoTesto(data){
  var t = tempoDelGiorno(data);
  var parti = [dur2s(t.disponibile) + " libere fra le " + fmt(t.fascia.da) +
               " e le " + fmt(t.fascia.a)];
  if (t.pianificato) parti.push(dur2s(t.pianificato) + " pianificate");
  if (t.fuoriFascia) parti.push(dur2s(t.fuoriFascia) + " fuori fascia");
  if (t.sovrapposto) parti.push(dur2s(t.sovrapposto) + " sovrapposte");
  return parti.join(" · ");
}
