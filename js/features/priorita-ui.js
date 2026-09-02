/* priorita-ui.js — la scheda «Priorità di oggi».
   Estratta da render.js (ARC-001). Dipende da: priorities.js (top3),
   tasks.js (itemById, isOn), state.js (S), utils.js (esc, fmt).
   Non conosce le altre aree della home. */

function zonaPriorita(){
  var L = top3();
  var setN = L.filter(function(e){ return e.id || e.t.trim(); }).length;
  var doneN = L.filter(function(e){
    var li = e.id ? itemById(e.id) : null;
    return li ? isOn(li) : (e.done && e.t.trim());
  }).length;
  var h = "";
  /* TOP-001/002 — Priorità di oggi: le righe compaiono una per volta. */
  var quanteVisibili = (function(){
    var ultima = -1;
    L.forEach(function(e, n){ if (e.id || (e.t || "").trim()) ultima = n; });
    return Math.max(1, Math.min(3, ultima + 1 + (S.piuPriorita ? 1 : 0)));
  })();
  h += '<!--Z:priorita-->';
  h += '<div class="card focus" data-sez="focus"><h2 data-ico="tre">'+
       '<span>Priorità di oggi</span><span class="cnt">'+doneN+'/'+(setN||quanteVisibili)+'</span></h2>'+
       '<p class="fsub">Scegline fino a 3.</p>';
  L.slice(0, quanteVisibili).forEach(function(e, n){
    var li = e.id ? itemById(e.id) : null;
    var done = li ? isOn(li) : (e.done && e.t.trim());
    var filled = li || (e.t || "").trim();
    h += '<div class="fline" data-n="'+n+'"><span class="fnum">'+(n+1)+'</span>'+
         '<button class="fbox" data-on="'+(done?1:0)+'" data-act="ptoggle" data-n="'+n+'" '+
         'role="checkbox" aria-checked="'+(done?"true":"false")+'" '+
         'aria-label="Completa la priorità '+(n+1)+'">'+
         (done?'<svg viewBox="0 0 12 12"><polyline points="2,6.5 4.7,9 10,3"/></svg>':'')+'</button>';
    if (li) {
      h += '<span class="ftxt'+(done?" done":"")+'" role="button" tabindex="0" '+
           'data-act="open" data-id="'+li.id+'" data-ctx="focus">'+esc(li.label)+
           '<small>'+esc(AREAS[li.area].label)+
           (typeof li.start === "number" ? ' · '+esc(fmt(li.start)) : '')+
           ' · <span class="collegata">collegata a un task</span></small></span>';
    } else {
      h += '<input class="finput" type="text" data-chg="ptext" data-keep="p'+n+'" data-n="'+n+'" '+
           'value="'+esc(e.t || "")+'" maxlength="200" aria-label="Priorità '+(n+1)+'" '+
           'placeholder="Scrivi qui, oppure tocca ★ su un task">';
    }
    h += '<span class="facts">';
    if (n > 0 && filled)
      h += '<button class="tiny" data-act="psu" data-n="'+n+'" '+
           'aria-label="Sposta la priorità '+(n+1)+' in su">↑</button>';
    if (n < quanteVisibili-1 && filled)
      h += '<button class="tiny" data-act="pgiu" data-n="'+n+'" '+
           'aria-label="Sposta la priorità '+(n+1)+' in giù">↓</button>';
    if (li)
      h += '<button class="tiny" data-act="pscollega" data-n="'+n+'">Scollega</button>';
    if (filled)
      h += '<button class="fclear" data-act="pclear" data-n="'+n+'" '+
           'aria-label="Rimuovi la priorità '+(n+1)+'">×</button>';
    h += '</span></div>';
  });
  if (quanteVisibili < 3)
    h += '<button class="add ghost piu" data-act="ppiu">Aggiungi un\'altra priorità</button>';
  /* TOP-005 — proposte, non riempimento automatico. Scegliere è il gesto
     centrale: farlo al posto dell'utente svuoterebbe il prodotto. */
  if (mostraSuggerimenti()) {
    var prop = suggerimentiPriorita();
    h += '<div class="proposte"><p class="proptit">Se non sai da dove cominciare</p>'+
      prop.map(function(p2){
        return '<div class="proposta">'+
          '<span class="ptxt">'+esc(p2.item.label)+
          '<span class="sub">perché '+esc(p2.spiegazione)+'</span></span>'+
          '<button class="tiny pos" data-act="sugg-ok" data-id="'+esc(p2.item.id)+'">'+
          'Mettila fra le priorità</button></div>';
      }).join("")+
      '<p class="hint">Sono proposte, non scelte: il pannello non riempie mai '+
      'queste righe da solo. '+
      '<button class="link" data-act="sugg-spegni">Non propormi niente</button></p></div>';
  }

  h += '<p class="fhint">Se la giornata salta all\'aria, queste restano. '+
       'Quelle collegate a un task sono evidenziate in ottone nell\'agenda e nelle liste.</p></div>';
  return h;
}

/* ---------------------------------------------------------------------------
   ONB-004 — la checklist di attivazione.
   Sta accanto alle priorità perché il primo traguardo è proprio quello, e
   perché deve essere la prima cosa che vedi finché non hai preso la mano.
--------------------------------------------------------------------------- */
function zonaAttivazione(){
  var s = statoAttivazione();
  var h = '<div class="card attivazione" data-sez="attivazione" '+
    'role="region" aria-label="Come prendere la mano">'+
    '<h2 data-ico="tre"><span>Come prendere la mano</span>'+
    '<span class="cnt">'+s.fatti+' di '+s.totale+'</span></h2>'+
    '<div class="avanzabar" role="img" aria-label="'+s.fatti+' passi su '+s.totale+'">'+
    '<i class="trascorso" style="width:'+s.percentuale+'%"></i></div>';

  if (s.prossimo) {
    h += '<p class="prossimo"><b>'+esc(s.prossimo.nome)+'</b>'+
         '<span class="sub">'+esc(s.prossimo.perche)+'</span>'+
         '<span class="sub dove">'+esc(s.prossimo.dove)+'</span></p>';
  }

  h += '<ul class="traguardi">';
  s.voci.forEach(function(v){
    h += '<li data-fatto="'+(v.fatto ? 1 : 0)+'">'+
      '<span class="segno" aria-hidden="true">'+(v.fatto ? "✓" : "·")+'</span>'+
      '<span class="txt">'+esc(v.nome)+
      '<span class="sr"> — '+(v.fatto ? "fatto" : "da fare")+'</span></span></li>';
  });
  h += '</ul>';

  h += '<div class="row"><button class="tiny" data-act="attiv-chiudi">Non mostrarmela più</button>'+
       '<span class="hint" style="margin:0;align-self:center">Si spunta da sola e sparisce '+
       'quando hai finito: non è un compito in più.</span></div></div>';
  return h;
}
