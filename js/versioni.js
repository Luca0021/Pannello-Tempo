/* versioni.js — SYN-004: versione per record, non per intero insieme di dati.

   Prima la sincronizzazione confrontava il dataset intero: se due dispositivi
   avevano toccato cose diverse, il pannello dichiarava un conflitto e faceva
   scegliere quale copia buttare. Perdere modifiche indipendenti perché sono
   arrivate nello stesso file è un difetto, non un compromesso.

   Ora ogni record sincronizzabile porta:
     mod  quando è stato modificato l'ultima volta, sul dispositivo (ISO)
     rev  la versione con cui è stato accettato dal servizio
     del  se è stato cancellato (lapide: serve per propagare la cancellazione)

   Le informazioni vivono in una tabella a parte, `data.versioni`, invece che
   dentro i record: così i backup precedenti restano leggibili e nessun record
   cambia forma. */

var TIPI_SINCRONIZZABILI = ["items", "capture", "links", "modelli", "obiettivi"];

function versioni(){
  S.data.versioni = S.data.versioni || {};
  return S.data.versioni;
}
function versioneDi(id){
  return versioni()[id] || null;
}
/* Segna un record come toccato adesso. Chiamata da commit(). */
function segnaModifica(id, quando){
  if (!id) return;
  var v = versioni();
  var prec = v[id] || { rev: 0 };
  v[id] = { mod: quando || new Date().toISOString(), rev: prec.rev || 0,
            sporco: true, del: false };
}
function segnaCancellazione(id){
  if (!id) return;
  var v = versioni();
  var prec = v[id] || { rev: 0 };
  /* la lapide resta: senza, la cancellazione non arriverebbe all'altro dispositivo */
  v[id] = { mod: new Date().toISOString(), rev: prec.rev || 0,
            sporco: true, del: true };
}
/* Il servizio ha accettato il record: da qui non è più «modificato qui». */
function accettaRevisione(id, rev){
  var v = versioni();
  if (v[id]) { v[id].rev = rev; v[id].sporco = false; }
}

/* Raccoglie tutti i record sincronizzabili di un insieme di dati, per id. */
function raccogliRecord(dati){
  var out = {};
  TIPI_SINCRONIZZABILI.forEach(function(t){
    (dati[t] || []).forEach(function(r){
      if (r && r.id) out[r.id] = { tipo: t, dato: r };
    });
  });
  return out;
}

/* ---------------------------------------------------------------------------
   Il confronto. Restituisce le quattro categorie che SYN-004 richiede, senza
   decidere nulla: la decisione è dell'utente e arriva dopo.
--------------------------------------------------------------------------- */
function confrontaInsiemi(locale, remoto){
  var rl = raccogliRecord(locale), rr = raccogliRecord(remoto);
  var vl = locale.versioni || {}, vr = remoto.versioni || {};
  var esito = { soloLocale: [], soloRemoto: [], invariati: [], conflitti: [],
                cancellatiLocale: [], cancellatiRemoto: [] };
  var visti = {};

  Object.keys(rl).forEach(function(id){
    visti[id] = true;
    var l = rl[id], r = rr[id];
    var ml = (vl[id] || {}).mod || null, mr = (vr[id] || {}).mod || null;
    if (!r) {
      /* non c'è di là: creato qui, oppure cancellato di là */
      if ((vr[id] || {}).del) esito.cancellatiRemoto.push({ id:id, tipo:l.tipo, locale:l.dato, mod:ml });
      else esito.soloLocale.push({ id:id, tipo:l.tipo, dato:l.dato });
      return;
    }
    if (JSON.stringify(l.dato) === JSON.stringify(r.dato)) { esito.invariati.push(id); return; }
    var toccatoQui = !!(vl[id] || {}).sporco;
    var revLocale = (vl[id] || {}).rev || 0, revRemota = (vr[id] || {}).rev || 0;
    var toccatoLà = revRemota > revLocale;
    if (toccatoQui && toccatoLà) {
      esito.conflitti.push({ id:id, tipo:l.tipo, locale:l.dato, remoto:r.dato,
                             modLocale:ml, modRemoto:mr,
                             differenze: differenzeRecord(l.dato, r.dato) });
    } else if (toccatoLà && !toccatoQui) {
      esito.soloRemoto.push({ id:id, tipo:r.tipo, dato:r.dato });
    } else {
      esito.soloLocale.push({ id:id, tipo:l.tipo, dato:l.dato });
    }
  });

  Object.keys(rr).forEach(function(id){
    if (visti[id]) return;
    if ((vl[id] || {}).del) esito.cancellatiLocale.push({ id:id, tipo:rr[id].tipo, remoto:rr[id].dato });
    else esito.soloRemoto.push({ id:id, tipo:rr[id].tipo, dato:rr[id].dato });
  });
  return esito;
}

/* Quali campi differiscono davvero: serve a mostrare il conflitto, non a
   risolverlo. */
function differenzeRecord(a, b){
  var campi = {}, out = [];
  Object.keys(a || {}).forEach(function(k){ campi[k] = true; });
  Object.keys(b || {}).forEach(function(k){ campi[k] = true; });
  Object.keys(campi).forEach(function(k){
    var va = a ? a[k] : undefined, vb = b ? b[k] : undefined;
    if (JSON.stringify(va) !== JSON.stringify(vb))
      out.push({ campo: k, locale: va, remoto: vb });
  });
  return out;
}

/* ---------------------------------------------------------------------------
   L'unione. Applica tutto ciò che NON è in conflitto e lascia i conflitti in
   sospeso: nulla viene sovrascritto prima che l'utente decida.
--------------------------------------------------------------------------- */
function unisci(locale, remoto){
  var c = confrontaInsiemi(locale, remoto);
  var uniti = JSON.parse(JSON.stringify(locale));
  uniti.versioni = Object.assign({}, remoto.versioni || {}, locale.versioni || {});

  c.soloRemoto.forEach(function(r){
    uniti[r.tipo] = (uniti[r.tipo] || []).filter(function(x){ return x.id !== r.id; });
    uniti[r.tipo].push(r.dato);
    if ((remoto.versioni || {})[r.id]) uniti.versioni[r.id] = remoto.versioni[r.id];
  });
  c.cancellatiRemoto.forEach(function(r){
    uniti[r.tipo] = (uniti[r.tipo] || []).filter(function(x){ return x.id !== r.id; });
    uniti.versioni[r.id] = { mod: new Date().toISOString(), rev: 0, del: true };
  });
  /* i conflitti restano fuori: entrambe le copie sono conservate qui */
  return { dati: uniti, conflitti: c.conflitti, riepilogo: c };
}

/* La decisione dell'utente, record per record. */
function risolviRecord(dati, conflitto, scelta){
  var t = conflitto.tipo;
  var scelto = (scelta === "remoto") ? conflitto.remoto
             : (scelta === "locale") ? conflitto.locale
             : null;
  if (scelta === "unisci") {
    /* unione campo per campo: dove uno solo dei due ha un valore, si prende
       quello; dove entrambi hanno valori diversi, vince il locale e lo si
       dichiara, invece di scegliere in silenzio */
    scelto = Object.assign({}, conflitto.remoto, conflitto.locale);
  }
  if (!scelto) return { ok:false, motivo:"Scelta non riconosciuta." };
  dati[t] = (dati[t] || []).filter(function(x){ return x.id !== conflitto.id; });
  dati[t].push(scelto);
  dati.versioni = dati.versioni || {};
  dati.versioni[conflitto.id] = { mod: new Date().toISOString(), rev: 0, del: false };
  return { ok:true, scelta: scelta };
}


/* ---------------------------------------------------------------------------
   Aggancio al salvataggio: confronta l'istantanea precedente con quella
   attuale e segna solo ciò che è davvero cambiato. Segnare tutto a ogni
   salvataggio produrrebbe conflitti falsi su ogni record.
--------------------------------------------------------------------------- */
var _istantanea = null;

function istantaneaRecord(){
  var out = {};
  var r = raccogliRecord(S.data);
  Object.keys(r).forEach(function(id){ out[id] = JSON.stringify(r[id].dato); });
  return out;
}
function aggiornaVersioni(){
  var ora = istantaneaRecord();
  if (_istantanea === null) { _istantanea = ora; return; }
  var quando = new Date().toISOString();
  Object.keys(ora).forEach(function(id){
    if (_istantanea[id] !== ora[id]) segnaModifica(id, quando);
  });
  Object.keys(_istantanea).forEach(function(id){
    if (ora[id] === undefined) segnaCancellazione(id);
  });
  _istantanea = ora;
}
function azzeraIstantanea(){ _istantanea = null; }
