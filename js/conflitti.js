/* conflitti.js — SYN-004: confronto e fusione per singolo record.

   Prima la sincronizzazione confrontava l'intero insieme di dati: due modifiche
   su record diversi diventavano un conflitto, e chi sceglieva perdeva il lavoro
   dell'altro dispositivo. Qui il confronto avviene record per record.

   Ogni record sincronizzabile ha, in d.versioni[id]:
     mod    momento dell'ultima modifica locale (ISO)
     rev    revisione con cui è stato inviato l'ultima volta
     sporco modificato dopo l'ultimo invio
     del    cancellato (lapide: serve a propagare la cancellazione) */

var TABELLE = ["items", "capture", "links", "modelli", "obiettivi"];

/* Il registro delle versioni può essere richiesto prima che i dati esistano
   (all'avvio, o durante una migrazione): in quel caso si restituisce un
   registro usa e getta invece di far cadere tutto. */
function versioni(d){
  d = d || S.data;
  if (!d || typeof d !== "object") return {};
  d.versioni = (d.versioni && typeof d.versioni === "object") ? d.versioni : {};
  return d.versioni;
}
function segnaModifica(id, dati){
  if (!id) return;
  var v = versioni(dati);
  var prec = v[id] || { rev: 0 };
  v[id] = { mod: new Date().toISOString(), rev: prec.rev || 0, sporco: true, del: false };
}
function segnaCancellato(id, dati){
  if (!id) return;
  var v = versioni(dati);
  var prec = v[id] || { rev: 0 };
  v[id] = { mod: new Date().toISOString(), rev: prec.rev || 0, sporco: true, del: true };
}
function indice(elenco){
  var m = {};
  (elenco || []).forEach(function(r){ if (r && r.id) m[r.id] = r; });
  return m;
}

/* Fonde due insiemi di dati confrontando ogni record.
   Restituisce { uniti, conflitti[], statistiche }. Non decide al posto
   dell'utente: dove il conflitto è reale conserva **entrambe** le versioni e
   lascia la scelta. */
function fondiPerRecord(locale, remoto){
  var out = JSON.parse(JSON.stringify(locale));
  var vLoc = versioni(locale), vRem = versioni(remoto);
  var conflitti = [], st = { soloLocale:0, soloRemoto:0, presiRemoti:0, conflitto:0, cancellati:0 };

  TABELLE.forEach(function(tab){
    var iLoc = indice(locale[tab]), iRem = indice(remoto[tab]);
    var risultato = [];
    var visti = {};

    (locale[tab] || []).forEach(function(rLoc){
      if (!rLoc || !rLoc.id) { risultato.push(rLoc); return; }
      visti[rLoc.id] = true;
      var rRem = iRem[rLoc.id];
      var vl = vLoc[rLoc.id] || { mod:"", rev:0, sporco:false, del:false };
      var vr = vRem[rLoc.id] || { mod:"", rev:0, sporco:false, del:false };

      if (!rRem) {
        /* non c'è più nel cloud: cancellato là o creato qui */
        if (vr.del && !vl.sporco) { st.cancellati++; return; }    /* cancellazione remota accettata */
        if (vr.del && vl.sporco) {
          conflitti.push({ tabella:tab, id:rLoc.id, tipo:"cancellato-remoto",
                           locale:rLoc, remoto:null, vLoc:vl, vRem:vr });
          st.conflitto++;
        } else st.soloLocale++;
        risultato.push(rLoc);
        return;
      }
      /* esiste in entrambi */
      if (uguali(rLoc, rRem)) { risultato.push(rLoc); return; }
      /* La regola sta tutta qui, e usa la REVISIONE, non l'orologio: due
         dispositivi possono avere orologi diversi, ma la revisione la assegna
         il servizio ed è l'unica cosa su cui si può fare affidamento.
           - non ho modifiche mie      → prendo la versione del cloud
           - ho modifiche e il cloud è fermo alla revisione che conoscevo
                                       → tengo la mia
           - ho modifiche e il cloud è andato avanti
                                       → conflitto vero, decide l'utente */
      if (!vl.sporco) {
        risultato.push(rRem); st.presiRemoti++; return;
      }
      if ((vr.rev || 0) <= (vl.rev || 0)) {
        risultato.push(rLoc); st.soloLocale++; return;
      }
      conflitti.push({ tabella:tab, id:rLoc.id, tipo:"entrambi",
                       locale:rLoc, remoto:rRem, vLoc:vl, vRem:vr,
                       campi: campiDiversi(rLoc, rRem) });
      st.conflitto++;
      risultato.push(rLoc);                   /* finché non decidi, resta il locale */
    });

    /* record presenti solo nel cloud */
    (remoto[tab] || []).forEach(function(rRem){
      if (!rRem || !rRem.id || visti[rRem.id]) return;
      var vl = vLoc[rRem.id];
      if (vl && vl.del) {
        /* cancellato qui, modificato là: decide l'utente */
        conflitti.push({ tabella:tab, id:rRem.id, tipo:"cancellato-locale",
                         locale:null, remoto:rRem, vLoc:vl, vRem: vRem[rRem.id] || {} });
        st.conflitto++;
        return;
      }
      risultato.push(rRem);
      st.soloRemoto++;
    });

    out[tab] = risultato;
  });

  return { uniti: out, conflitti: conflitti, statistiche: st };
}

function uguali(a, b){
  try { return JSON.stringify(ordina(a)) === JSON.stringify(ordina(b)); }
  catch (e) { return false; }
}
function ordina(o){
  if (!o || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(ordina);
  var out = {};
  Object.keys(o).sort().forEach(function(k){ out[k] = ordina(o[k]); });
  return out;
}
function diverso(a, b){ return (a.mod || "") !== (b.mod || ""); }

/* Quali campi differiscono: serve a mostrare la differenza, non a decidere. */
function campiDiversi(a, b){
  var out = [];
  var chiavi = {};
  Object.keys(a || {}).forEach(function(k){ chiavi[k] = 1; });
  Object.keys(b || {}).forEach(function(k){ chiavi[k] = 1; });
  Object.keys(chiavi).forEach(function(k){
    if (k === "id") return;
    var va = JSON.stringify(a ? a[k] : undefined);
    var vb = JSON.stringify(b ? b[k] : undefined);
    if (va !== vb) out.push({ campo:k, locale:a ? a[k] : undefined, remoto:b ? b[k] : undefined });
  });
  return out;
}

/* Applica la scelta dell'utente su un conflitto. */
function risolviRecord(conflitto, scelta){
  if (!conflitto) return false;
  var tab = conflitto.tabella;
  S.data[tab] = (S.data[tab] || []).filter(function(r){ return !r || r.id !== conflitto.id; });
  if (scelta === "locale" && conflitto.locale) S.data[tab].push(conflitto.locale);
  else if (scelta === "cloud" && conflitto.remoto) S.data[tab].push(conflitto.remoto);
  else if (scelta === "entrambi") {
    if (conflitto.locale) S.data[tab].push(conflitto.locale);
    if (conflitto.remoto) {
      var copia = JSON.parse(JSON.stringify(conflitto.remoto));
      copia.id = uid();
      copia.label = (copia.label || "") + " (versione del cloud)";
      S.data[tab].push(copia);
      segnaModifica(copia.id);
    }
  }
  segnaModifica(conflitto.id);
  return true;
}
