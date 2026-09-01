/* conflitti-ui.js — SYN-004: la schermata dei record in disaccordo.
   Mostra che cosa differisce, campo per campo, e lascia scegliere.
   Dipende da: conflitti.js (S.conflitti, risolviRecord), state.js (S),
   utils.js (esc, shortDate). Non conosce le altre aree. */

function valoreLeggibile(v){
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.length + (v.length === 1 ? " elemento" : " elementi");
  if (typeof v === "object") return "…";
  var t = String(v);
  return t.length > 60 ? t.slice(0, 60) + "…" : t;
}
var NOMI_CAMPI = {
  label:"Titolo", area:"Area", freq:"Ricorrenza", date:"Data", start:"Orario",
  dur:"Durata", tag:"Etichetta", note:"Nota", place:"Luogo", due:"Scadenza",
  waiting:"In attesa", bloccatoDa:"Dipende da", steps:"Passi", importo:"Importo",
  days:"Giorni", dom:"Giorno del mese", link:"Collegamento", text:"Testo"
};

function zonaConflitti(){
  var n = S.conflitti.length;
  var h = '<div class="card conflitti" data-sez="conflitti" role="region" '+
    'aria-label="Record in disaccordo">'+
    '<h2 data-ico="doppio"><span>'+(n === 1 ? "Una voce è cambiata in due posti"
      : n+" voci sono cambiate in due posti")+'</span>'+
    '<span class="badge">'+n+'</span></h2>'+
    '<p class="hint" style="margin-top:0">Hai modificato queste voci qui e su un altro '+
    'dispositivo. Finché non scegli <b>non viene sovrascritto niente</b>: le due versioni '+
    'sono entrambe conservate. Il resto dei dati è già stato unito senza toccare nulla.</p>';

  S.conflitti.forEach(function(c, i){
    var titolo = (c.locale && c.locale.label) || (c.remoto && c.remoto.label) || c.id;
    h += '<div class="conflitto">'+
      '<p class="cnome">'+esc(titolo)+
      '<span class="sub">'+esc(descriviTipo(c))+'</span></p>';

    if (c.tipo === "entrambi" && c.campi && c.campi.length) {
      h += '<table class="cdiff"><thead><tr><th>Campo</th><th>Qui</th>'+
           '<th>Sull\'altro dispositivo</th></tr></thead><tbody>';
      c.campi.slice(0, 8).forEach(function(cm){
        h += '<tr><th scope="row">'+esc(NOMI_CAMPI[cm.campo] || cm.campo)+'</th>'+
             '<td>'+esc(valoreLeggibile(cm.locale))+'</td>'+
             '<td>'+esc(valoreLeggibile(cm.remoto))+'</td></tr>';
      });
      h += '</tbody></table>';
      if (c.campi.length > 8)
        h += '<p class="hint">e altri '+(c.campi.length - 8)+' campi.</p>';
    }

    h += '<div class="row">';
    if (c.locale)
      h += '<button class="tiny pos" data-act="conf-locale" data-n="'+i+'">'+
           (c.tipo === "cancellato-locale" ? "Resta cancellata" : "Tieni la mia")+'</button>';
    else
      h += '<button class="tiny pos" data-act="conf-locale" data-n="'+i+'">Resta cancellata</button>';
    if (c.remoto)
      h += '<button class="tiny" data-act="conf-cloud" data-n="'+i+'">'+
           (c.tipo === "cancellato-remoto" ? "Accetta la cancellazione" : "Tieni quella dell\'altro")+'</button>';
    else
      h += '<button class="tiny" data-act="conf-cloud" data-n="'+i+'">Accetta la cancellazione</button>';
    if (c.locale && c.remoto)
      h += '<button class="tiny" data-act="conf-entrambi" data-n="'+i+'">Tienile entrambe</button>';
    h += '</div></div>';
  });

  h += '<div class="row"><button class="tiny" data-act="conf-rinvia">Decido dopo</button>'+
       '<span class="hint" style="margin:0;align-self:center">La sincronizzazione resta '+
       'ferma finché non hai deciso.</span></div></div>';
  return h;
}

function descriviTipo(c){
  if (c.tipo === "cancellato-locale")
    return "Cancellata qui, ma modificata sull'altro dispositivo";
  if (c.tipo === "cancellato-remoto")
    return "Cancellata sull'altro dispositivo, ma modificata qui";
  var q = c.campi ? c.campi.length : 0;
  return q === 1 ? "Un campo diverso" : q + " campi diversi";
}
