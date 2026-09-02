/* task-list-ui.js — Righe, sezioni di elenco, editor di una voce e stati vuoti.
   Estratto da components.js (ARC-001): questo modulo contiene solo il
   disegno di questa area. Dipende da: utils.js (esc, fmt, dur2s),
   state.js (S, P), config.js (AREAS, SECTIONS), tasks.js (itemById,
   isOn, isSkipped). Non conosce le altre aree. */

/* components.js — frammenti di interfaccia riutilizzabili
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- frammenti di interfaccia ---------- */
/* Per i record vecchi la causa non esiste: lo diciamo invece di inventarla. */
function causaBlocco(i){
  if (!i.waiting) return "";
  var c = (i.bloccatoDa || "").trim();
  return c || "Causa da specificare";
}

function rowHtml(i, ctx){
  var on = isOn(i), c = AREAS[i.area].color, timed = typeof i.start === "number";
  /* TSK-007 — in modalità selezione ogni riga porta la propria casella. Fuori
     da quella modalità non compare nulla: caselle sempre presenti sarebbero
     rumore per chi vuole solo spuntare una cosa. */
  var scelta = (S.modoSelezione === ctx)
    ? '<button class="scegli" type="button" data-act="sel-riga" data-id="'+esc(i.id)+'" '+
      'aria-pressed="'+selezionato(i.id)+'" data-on="'+(selezionato(i.id)?1:0)+'" '+
      'aria-label="Scegli '+esc(i.label)+' per un\'azione di gruppo"></button>'
    : '';
  var past = i.freq === "once" && !on && i.date < dk();
  var p = prioIndex(i) >= 0;
  var h = '<li class="'+(p?"prio ":"")+(isSkipped(i)?"skipped ":"")+
          ((S.flash && S.flash.id === i.id)?"flash":"")+'" data-id="'+esc(i.id)+'" '+
          'data-area="'+esc(i.area)+'">'+scelta;
  h += '<button class="star" data-on="'+(p?1:0)+'" data-act="star" data-id="'+i.id+'" '+
       'title="'+(p?"Togli dalle tre cose":"Metti tra le priorità di oggi")+'"></button>';
  /* A11Y-002: senza etichetta la casella viene annunciata come «pulsante» e
     basta, e chi usa uno screen reader non sa che cosa sta completando. */
  h += '<button class="box" data-act="toggle" data-id="'+i.id+'" aria-pressed="'+on+'" '+
       'aria-label="'+(on ? "Togli il completamento di " : "Completa ")+esc(i.label)+'" '+
       'style="border-color:'+(past?"var(--rust)":c)+';background:'+(on?c:"transparent")+'">'+
       (on?'<svg viewBox="0 0 12 12"><polyline points="2,6.5 4.7,9 10,3"/></svg>':'')+'</button>';
  h += '<span class="txt'+(on?" done":"")+'" role="button" tabindex="0" data-act="toggle" data-id="'+i.id+'">'+esc(i.label)+
       (i.note ? '<span class="sub">'+esc(i.note)+'</span>' : '')+'</span>';
  if (safeUrl(i.link))
    h += '<a class="lk" href="'+esc(i.link)+'" target="_blank" rel="noopener noreferrer" title="'+esc(i.link)+'">↗</a>';
  h += '<span class="acts">';
  if (isSkipped(i))
    h += '<button class="slot due-soon" data-act="unskip" data-id="'+i.id+'" '+
         'title="Rimetti in programma">saltato</button>';
  var si0 = stepsInfo(i);
  if (si0.tot) {
    var aperto = S.stepsOpen === i.id;
    h += '<button class="slot steps-chip'+(si0.done === si0.tot ? " due-none" : "")+'" '+
         'data-act="stepsview" data-id="'+i.id+'" data-on="'+(aperto?1:0)+'" '+
         'title="Mostra i passi">'+(aperto?"▾ ":"")+si0.done+'/'+si0.tot+'</button>';
  }
  if (i.tag)
    h += '<button class="slot tagchip" style="--h:'+tagHue(i.tag)+'" data-act="tagpick" '+
         'data-v="'+esc(i.tag)+'" title="Mostra solo questa etichetta">'+esc(i.tag)+'</button>';
  if (i.place)
    h += '<a class="slot" href="'+esc(mapsUrl(i.place))+'" target="_blank" rel="noopener noreferrer" '+
         'title="Indicazioni per '+esc(i.place)+'">◎ '+esc(i.place.length > 18 ? i.place.slice(0,17)+"…" : i.place)+'</a>';
  if (i.importo > 0)
    h += '<button class="slot soldi'+(i.entrata?" entrata":"")+'" data-act="open" data-id="'+i.id+'" '+
         'title="'+(i.entrata?"Entrata":"Uscita")+'">'+(i.entrata?"+":"−")+esc(euro(i.importo))+'</button>';
  var di = dueInfo(i);
  if (di && !on)
    h += '<button class="slot due-'+di.level+'" data-act="opendue" data-id="'+i.id+'" '+
         'title="Modifica la scadenza">'+esc(di.label)+'</button>';
  if (i.freq === "daily" && (i.every || 1) > 1)
    h += '<button class="slot" data-set="1" data-act="open" data-id="'+i.id+'" '+
         'title="Frequenza">ogni '+i.every+' gg</button>';
  if (i.freq === "yearly")
    h += '<button class="slot" data-set="1" data-act="open" data-id="'+i.id+'" '+
         'title="Ricorrenza annuale">'+(domOf(i)===0?"fine":domOf(i))+' '+
         MESI3[(i.mon===undefined)?0:i.mon]+'</button>';
  if (isWaiting(i))
    h += '<button class="slot due-soon" data-act="unwait" data-id="'+i.id+'" '+
         'title="Bloccato da: '+esc(causaBlocco(i))+' · tocca per riprenderlo">'+
         esc(causaBlocco(i))+(validKey(i.recheck) ? " · "+esc(shortDate(i.recheck)) : "")+'</button>';
  else if (i.waiting)
    h += '<button class="slot due-urgent" data-act="unwait" data-id="'+i.id+'" '+
         'title="Il ricontrollo è arrivato: riprendilo">da ricontrollare</button>';
  if (i.flessibile)
    h += '<button class="slot" data-set="1" data-act="open" data-id="'+i.id+'" '+
         'title="Quando capita">'+periodoLabel(i)+'</button>';
  else if (i.freq === "weekly")
    h += '<button class="slot" data-set="1" data-act="slot" data-id="'+i.id+'" '+
         'title="Giorno della settimana">'+esc(daysLabel(i))+'</button>';
  if (i.freq === "monthly")
    h += '<button class="slot" data-set="1" data-act="slot" data-id="'+i.id+'" '+
         'title="'+(domOf(i)===0 ? "Ultimo giorno del mese" : "Ogni mese il "+domOf(i))+'">'+
         domDateLabel(i, cursor())+'</button>';
  if (i.freq === "once")
    h += '<button class="slot" data-set="1" data-act="openday" data-id="'+i.id+'" '+
         (past?'style="color:var(--rust);border-color:var(--rust)"':'')+'>'+esc(shortDate(i.date))+'</button>';
  h += '<button class="slot'+(timed?" ora":"")+'" data-set="'+(timed?1:0)+'" data-act="slot" data-id="'+i.id+'">'+
       (timed ? fmt(i.start) : "Aggiungi orario")+'</button>';
  h += '<button class="del" data-act="open" data-id="'+i.id+'" data-ctx="'+esc(ctx||"sez")+'" '+
       'aria-label="Apri" title="Apri">⋯</button>'+
       '</span></li>';
  return h + stepsPanel(i) + maybeEditor(i.id, ctx || "sez");
}

/* Tutto ciò che è dovuto in un dato giorno, qualunque sia la ricorrenza. */
/* Un elenco vuoto per via dei filtri deve dirlo: altrimenti sembra che i task
   siano scomparsi. */
function motivoVuoto(base){
  var perche = [];
  if (S.filter !== "tutto") perche.push("area "+AREAS[S.filter].label.toLowerCase());
  if (S.tagF === "__senza") perche.push("senza etichetta");
  else if (S.tagF !== "tutti") perche.push("etichetta «"+S.tagF+"»");
  if (!perche.length) return base;
  return "Niente qui con i filtri attivi: "+perche.join(" · ")+".";
}

function sectionHtml(freq, title, ico, dentro){
  var all;
  if (freq === "today") all = dueOn(S.now);
  else if (freq === "waiting")
    all = S.data.items.filter(function(i){ return isWaiting(i) && visible(i); });
  else all = S.data.items.filter(function(i){ return i.freq === freq && visible(i) && !i.waiting; });
  var hidden = 0;
  if (freq === "once") {
    var horizon = dayKey(new Date(S.now.getFullYear(), S.now.getMonth(), S.now.getDate()+60));
    var future = all.filter(function(i){ return i.date > dk(); });
    hidden = future.filter(function(i){ return i.date > horizon; }).length;
    all = future.filter(function(i){ return i.date <= horizon; })
                .sort(function(a,b){
                  return (a.date||"").localeCompare(b.date||"") || ((a.start||0)-(b.start||0));
                });
  } else {
    all = all.slice().sort(function(a,b){
      return (prioIndex(b) >= 0 ? 1 : 0) - (prioIndex(a) >= 0 ? 1 : 0);
    });
  }
  var done = all.filter(isOn).length;
  var suffix = "";
  if (freq === "today") {
    suffix = ' · '+S.now.toLocaleDateString("it-IT",{day:"numeric",month:"short"}).replace(".","");
  } else if (freq === "weekly") {
    var wd = weekDays();
    suffix = ' · '+wd[0].getDate()+'–'+wd[6].getDate()+' '+
             wd[6].toLocaleDateString("it-IT",{month:"short"}).replace(".","");
  } else if (freq === "monthly") {
    suffix = ' · '+cursor().toLocaleDateString("it-IT",{month:"long"});
  } else if (freq === "yearly") {
    suffix = ' · '+cursor().getFullYear();
  }
  /* una sezione vuota che occupa spazio ogni giorno è rumore:
     compare solo quando ha qualcosa da mostrare */
  if (freq === "waiting" && !moduloAttivo("bloccati")) return "";
  if ((freq === "waiting" || freq === "yearly" || freq === "once" || dentro) && !all.length) return "";
  var dueToday = (freq === "weekly" || freq === "monthly")
    ? all.filter(function(i){ return !isOn(i) && onDay(i, S.now); }).length : 0;
  var fold = folded(freq);
  var h = dentro
    ? '<p class="subhead" data-act="fold" data-v="'+freq+'" role="button" tabindex="0" '+
      'aria-expanded="'+(!fold)+'">'
    : '<div class="card'+(freq === "today" ? " oggi" : "")+'" data-sez="'+freq+'">'+
      '<h2 data-ico="'+(ico||"oggi")+'" ><button class="foldbtn" type="button" data-act=\"fold\" data-v="'+freq+'" '+
      'aria-expanded="'+(!fold)+'">';
  h += '<span>'+title+suffix+'</span>'+
       (dueToday && fold ? '<span class="segnale ottone" title="'+dueToday+
         (dueToday===1?" voce cade oggi":" voci cadono oggi")+'"></span>' : '')+
       '<span class="cnt">'+done+'/'+all.length+'</span>'+
       '<span class="caret">'+(fold ? '▸' : '▾')+'</span>'+(dentro ? '</p>' : '</button></h2>');
  if (fold) {
    /* chiusa mostra due voci in anteprima: invita ad aprire invece di
       costringere a ricordare cosa c'è dentro */
    /* chiusa mostra tutte le voci, scorrevoli: chiudere una sezione non deve
       significare perdere di vista cosa contiene */
    var ante = all.filter(function(i){ return !isOn(i); });
    if (ante.length)
      h += '<div class="antewrap"><ul class="anteprima-chiusa">'+ante.map(function(i){
        return '<li class="antevoce"><span class="pallino area-'+esc(i.area)+'" aria-hidden="true">'+
               '</span><span>'+esc(i.label)+'</span></li>';
      }).join("")+'</ul></div>';
    return h + (dentro ? '' : '</div>');
  }
  if (!all.length) {
    var conFiltri = motivoVuoto("") !== "";
    if (conFiltri)
      h += '<p class="empty">'+esc(motivoVuoto(""))+'</p>';
    else if (freq === "today")
      h += statoVuoto("sereno", "Niente in programma oggi.",
             "Aggiungi qualcosa dal pulsante «+», oppure goditi la giornata libera.");
    else if (freq === "once")
      h += statoVuoto("calendario", "Nessun appuntamento nei prossimi due mesi.",
             "Gli appuntamenti con una data li crei dal pulsante «+».");
    else if (freq === "waiting")
      h += statoVuoto("sereno", "Niente bloccato da altri.",
             "Quando qualcosa dipende da una risposta, mettilo qui e uscirà dalla giornata.");
    else
      h += statoVuoto("ripeti", "Nessuna routine di questo tipo.",
             "Le cose che tornano ogni settimana o ogni mese si gestiscono qui.");
  }
  /* TSK-007 — scegliere più voci e agire una volta sola, come per gli
     arretrati. Compare solo dove ci sono abbastanza voci da giustificarlo. */
  var ctxSez = "sez:"+freq;
  if (all.length >= 3) {
    if (S.modoSelezione === ctxSez) {
      h += barraMassiva()+
        '<div class="row"><button class="tiny" data-act="sel-tutte" data-v="'+esc(freq)+'">'+
        'Scegli tutte</button>'+
        '<button class="tiny" data-act="sel-esci">Esci dalla selezione</button></div>';
    } else {
      h += '<div class="row"><button class="link" data-act="sel-entra" data-v="'+esc(freq)+'">'+
        'Scegli più voci</button></div>';
    }
  }
  var groups;
  if (freq === "once") groups = [{ tit:null, list: all }];
  else if (P.groupBy === "etichetta") {
    var nomi = {};
    all.forEach(function(i){ nomi[i.tag || "\u0000"] = 1; });
    groups = Object.keys(nomi).sort().map(function(p){
      return { tit: p === "\u0000" ? "Senza etichetta" : p,
               hue: p === "\u0000" ? null : tagHue(p),
               list: all.filter(function(i){ return (i.tag || "\u0000") === p; }) };
    }).filter(function(g){ return g.list.length; });
    if (groups.length === 1 && groups[0].tit === "Senza etichetta") groups = [{ tit:null, list: all }];
  } else if (S.filter === "tutto") {
    groups = Object.keys(AREAS).map(function(a){
      return { tit: AREAS[a].label, col: AREAS[a].color, hue: null,
               list: all.filter(function(i){ return i.area === a; }) };
    }).filter(function(g){ return g.list.length; });
  } else groups = [{ tit:null, list: all }];
  groups.forEach(function(g){
    if (g.tit)
      h += '<p class="grp">'+(g.hue !== null && g.hue !== undefined
        ? '<span class="dot tagdot" style="--h:'+g.hue+'"></span>'
        : '<span class="dot" style="background:'+(g.col||"var(--muted)")+'"></span>')+esc(g.tit)+'</p>';
    h += '<ul>'+g.list.map(function(i){ return rowHtml(i, "sez:"+freq); }).join("")+'</ul>';
  });
  if (freq === "waiting")
    h += '<p class="hint">Voci ferme perché dipendono da qualcun altro. Escono dalla giornata '+
         'e tornano da sole alla data di ricontrollo, oppure quando premi «in attesa».</p>';

  if (freq === "once") {
    if (hidden) h += '<p class="hint">Altri '+hidden+' oltre i due mesi: li trovi nella vista Mese.</p>';
    else if (all.length) h += '<p class="hint">Gli appuntamenti scaduti non restano qui: '+
                              'compaiono in cima, tra le cose rimaste indietro.</p>';
  }
  return h + (dentro ? '' : '</div>');
}

/* Espansione leggera: solo i passi, senza aprire tutto il pannello. */
function stepsPanel(i){
  if (S.stepsOpen !== i.id) return "";
  var si = stepsInfo(i);
  if (!si.tot) return "";
  var h = '<li class="editrow"><div class="steppanel"><ul class="steps">';
  si.list.forEach(function(x, n){
    var d = stepOn(i, x);
    h += '<li><button class="box" data-act="stept" data-id="'+i.id+'" data-n="'+n+'" '+
         'style="border-color:var(--pen);background:'+(d?"var(--pen)":"transparent")+'">'+
         (d?'<svg viewBox="0 0 12 12"><polyline points="2,6.5 4.7,9 10,3"/></svg>':'')+'</button>'+
         '<span class="txt'+(d?" done":"")+'" role="button" tabindex="0" data-act="stept" '+
         'data-id="'+i.id+'" data-n="'+n+'">'+esc(x.t)+'</span></li>';
  });
  h += '</ul><div class="row" style="margin-top:8px"><input type="text" id="qs'+i.id+'" '+
       'data-keep="qs'+i.id+'" placeholder="Aggiungi un passo…">'+
       '<button class="add ghost" data-act="stepadd" data-id="'+i.id+'" data-q="1">Aggiungi</button>'+
       '<button class="tiny" data-act="open" data-id="'+i.id+'">modifica task</button></div></div></li>';
  return h;
}

/* Un task può comparire in più elenchi contemporaneamente (Oggi, Scadenze,
   ricerca…). Il pannello va disegnato una volta sola, nel punto da cui l'hai
   aperto, altrimenti il fuoco salta all'altra copia e la pagina si sposta. */
function maybeEditor(id, ctx){
  if (S.editId !== id || S.editFrom !== "list") return "";
  if (S.editClaimed) return "";
  if (S.editCtx && ctx && S.editCtx !== ctx) return "";
  S.editClaimed = true;
  return '<li class="editrow">'+editorHtml()+'</li>';
}

/* Proposta di un nuovo task a partire da una fascia dell'agenda:
   resta una proposta finché non premi «Crea». */
function selettoreLink(idCampo, valore, idTask){
  var ls = (S.data.links || []).filter(function(l){ return l && safeUrl(l.url); });
  if (!ls.length) return "";
  var scelto = ls.filter(function(l){ return l.url === valore; })[0];
  return '<select data-chg="'+idCampo+'"'+(idTask ? ' data-id="'+idTask+'"' : '')+' '+
    'title="Riempi con un collegamento rapido">'+
    '<option value="">Collegamento rapido…</option>'+
    ls.map(function(l){
      return '<option value="'+esc(l.url)+'"'+(scelto && scelto.url === l.url ? " selected" : "")+'>'+
             esc(l.name)+'</option>';
    }).join("")+'</select>';
}

function nuovoHtml(){
  if (!S.nuovo) return "";
  return '<div class="edit nuovo"><div class="edittesta">'+
    '<span class="lbl">Nuovo task alle '+fmt(S.nuovo.start)+'</span>'+
    '<button class="chiudi" data-act="nuovoannulla" title="Annulla" aria-label="Annulla"></button>'+
    '</div>'+
    '<div class="row"><input type="text" id="nlabel" data-keep="n-label" '+
    'placeholder="Che cosa devi fare?"></div>'+
    '<div class="fields">'+
    '<div><label class="lbl">Inizio</label><select data-chg="n-start">'+
      SLOTS.map(function(o){
        return '<option value="'+o+'"'+(Math.abs(S.nuovo.start-o)<1e-6?" selected":"")+'>'+fmt(o)+'</option>';
      }).join("")+'</select></div>'+
    '<div><label class="lbl">Durata</label><select data-chg="n-dur">'+
      DURS.map(function(o){
        return '<option value="'+o[0]+'"'+(S.nuovo.dur===o[0]?" selected":"")+'>'+o[1]+'</option>';
      }).join("")+'</select></div>'+
    '<div><label class="lbl">Area</label><select data-chg="n-area">'+
      ['lavoro','vita'].map(function(a){
        return '<option value="'+a+'"'+(S.nuovo.area===a?" selected":"")+'>'+AREAS[a].label+'</option>';
      }).join("")+'</select></div>'+
    '</div>'+
    '<div class="row"><button class="add" data-act="nuovocrea">Crea</button>'+
    '<button class="add ghost" data-act="nuovoannulla">Annulla</button>'+
    '<span class="hint" style="margin:0;align-self:center">Appuntamento del giorno mostrato</span></div>'+
    '</div>';
}

function editorHtml(){
  var it = S.editId ? itemById(S.editId) : null;
  if (!it) return "";
  var h = '<div class="edit"><div class="edittesta">'+
          '<span class="lbl">Modifica</span>'+
          '<button class="chiudi" data-act="editclose" title="Chiudi" aria-label="Chiudi"></button>'+
          '</div>';
  h += '<input type="text" style="width:100%;margin-bottom:8px" data-keep="e-label" data-chg="e-label" data-id="'+it.id+'" value="'+esc(it.label)+'">';
  h += '<div class="fields">';
  h += '<div><label class="lbl">Inizio</label><select data-chg="e-start" data-id="'+it.id+'">'+
       (typeof it.start === "number" ? "" : '<option value="" selected>Senza orario</option>')+
       SLOTS.map(function(s){
         return '<option value="'+s+'"'+(typeof it.start === "number" && Math.abs(it.start-s)<1e-6 ? " selected":"")+'>'+fmt(s)+'</option>';
       }).join("")+'</select></div>';
  h += '<div><label class="lbl">Durata</label><select data-chg="e-dur" data-id="'+it.id+'">'+
       DURS.map(function(d){
         return '<option value="'+d[0]+'"'+((it.dur||0.5) === d[0] ? " selected":"")+'>'+d[1]+'</option>';
       }).join("")+'</select></div>';
  h += '<div><label class="lbl">Area</label><select data-chg="e-area" data-id="'+it.id+'">'+
       ['lavoro','vita'].map(function(a){
         return '<option value="'+a+'"'+(it.area === a ? " selected":"")+'>'+AREAS[a].label+'</option>';
       }).join("")+'</select></div>';
  if (it.freq === "once")
    h += '<div><label class="lbl">Data</label><input type="date" data-chg="e-date" data-id="'+it.id+'" value="'+esc(it.date||S.cursorKey)+'"></div>';
  else if (it.freq === "monthly")
    h += '<div><label class="lbl">Giorno del mese</label><select data-chg="e-dom" data-id="'+it.id+'">'+
         DOMS.map(function(o){
           return '<option value="'+o[0]+'"'+(domOf(it) === o[0] ? " selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select></div>';
  h += '</div>';
  if (it.freq === "daily")
    h += '<div style="margin-top:11px"><label class="lbl">Frequenza</label>'+
         '<select data-chg="e-everyd" data-id="'+it.id+'">'+
         [[1,"Tutti i giorni"],[2,"Un giorno sì e uno no"],[3,"Ogni 3 giorni"],
          [4,"Ogni 4 giorni"],[7,"Ogni 7 giorni"],[10,"Ogni 10 giorni"]].map(function(o){
           return '<option value="'+o[0]+'"'+((it.every||1)===o[0]?" selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select></div>';
  if (it.freq === "yearly")
    h += '<div class="fields" style="margin-top:11px">'+
         '<div><label class="lbl">Mese</label><select data-chg="e-mon" data-id="'+it.id+'">'+
         MONTHS.map(function(mn, n3){
           return '<option value="'+n3+'"'+(((it.mon===undefined)?0:it.mon)===n3?" selected":"")+'>'+mn+'</option>';
         }).join("")+'</select></div>'+
         '<div><label class="lbl">Giorno</label><select data-chg="e-dom" data-id="'+it.id+'">'+
         DOMS_Y.map(function(o){
           return '<option value="'+o[0]+'"'+(domOf(it)===o[0]?" selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select></div></div>';
  if (it.freq === "weekly" || it.freq === "monthly")
    h += '<div class="row" style="margin-top:11px"><button class="tiny" data-act="e-flex" '+
         'data-id="'+it.id+'" data-on="'+(it.flessibile?1:0)+'">'+
         (it.flessibile ? "✓ quando capita" : "quando capita")+'</button>'+
         '<span class="hint" style="margin:0;align-self:center">'+
         (it.flessibile ? "Resta fra le cose di oggi finché non la fai"
                        : "Senza giorno fisso: la fai quando vuoi nel periodo")+'</span></div>';
  if (it.freq === "weekly" && !it.flessibile) {
    var sel = daysOf(it);
    h += '<div style="margin-top:11px"><label class="lbl">Giorni della settimana</label><div class="dayset">'+
         [[1,"L"],[2,"M"],[3,"M"],[4,"G"],[5,"V"],[6,"S"],[0,"D"]].map(function(dd){
           return '<button class="dayb" data-act="e-dayt" data-id="'+it.id+'" data-n="'+dd[0]+'" '+
                  'data-on="'+(sel.indexOf(dd[0])>=0?1:0)+'">'+dd[1]+'</button>';
         }).join("")+'</div></div>'+
         '<div style="margin-top:11px"><label class="lbl">Frequenza</label>'+
         '<select data-chg="e-every" data-id="'+it.id+'">'+
         [[1,"Ogni settimana"],[2,"Ogni due settimane"],[3,"Ogni tre settimane"],[4,"Ogni quattro settimane"]]
           .map(function(o){ return '<option value="'+o[0]+'"'+((it.every||1)===o[0]?" selected":"")+'>'+o[1]+'</option>'; })
           .join("")+'</select></div>';
  }
  if (it.freq !== "once")
    h += '<div style="margin-top:11px"><label class="lbl">Si ripete fino al (facoltativo)</label>'+
         '<input type="date" style="width:100%" data-chg="e-fine" data-id="'+it.id+'" value="'+esc(it.fine||"")+'">'+
         '<p class="hint" style="margin-top:5px">Per corsi, terapie, rate: dopo questa data smette '+
         'di comparire senza doverlo eliminare.</p></div>';
  if (it.freq !== "once")
    h += '<div style="margin-top:11px"><label class="lbl">Scadenza (facoltativa)</label>'+
         '<input type="date" style="width:100%" data-chg="e-due" data-id="'+it.id+'" value="'+esc(it.due||"")+'">'+
         '<p class="hint" style="margin-top:5px">Lascia vuoto per togliere la scadenza. '+
         'Vale oltre la giornata: resta segnalata finché non completi il task.</p></div>';
  if (typeof it.start === "number")
    h += '<div style="margin-top:11px"><label class="lbl">Avviso nel calendario</label>'+
         '<select data-chg="e-alarm" data-id="'+it.id+'">'+
         [["","Come impostazione generale"],["0","Nessun avviso"],["5","5 minuti prima"],
          ["10","10 minuti prima"],["15","15 minuti prima"],["30","30 minuti prima"],
          ["60","1 ora prima"],["120","2 ore prima"]].map(function(o){
           var cur = (it.alarm === undefined) ? "" : String(it.alarm);
           return '<option value="'+o[0]+'"'+(cur === o[0] ? " selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select>'+
         '<p class="hint" style="margin-top:5px">Utile quando devi spostarti: '+
         'un\'ora prima per raggiungere il posto, cinque minuti per una chiamata.</p></div>';
  h += '<div class="row" style="margin-top:12px"><button class="tiny" data-act="editmore" '+
       'data-on="'+(S.editMore?1:0)+'">'+(S.editMore ? "− altri campi" : "+ altri campi")+'</button>'+
       '<span class="hint" style="margin:0;align-self:center">etichetta · luogo · collegamento · nota · passi · avviso · scadenza</span></div>';
  if (S.editMore) {
  h += '<div style="margin-top:11px"><label class="lbl">Etichetta</label>'+
       '<input type="text" style="width:100%" list="taglist" placeholder="Es. Migrazione SAP · Casa · Cliente Rossi · Corso inglese" '+
       'data-keep="e-tag" data-chg="e-tag" data-id="'+it.id+'" value="'+esc(it.tag||"")+'">'+
       '<datalist id="taglist">'+etichette().map(function(p){ return '<option value="'+esc(p)+'"></option>'; }).join("")+'</datalist>'+
       '</div>';
  h += '<div class="fields" style="margin-top:11px">'+
       '<div><label class="lbl">Importo (facoltativo)</label>'+
       '<input type="text" inputmode="decimal" placeholder="Es. 82,40" '+
       'data-keep="e-importo" data-chg="e-importo" data-id="'+it.id+'" '+
       'value="'+(it.importo > 0 ? esc(String(it.importo).replace(".", ",")) : "")+'"></div>'+
       '<div><label class="lbl">Verso</label><select data-chg="e-entrata" data-id="'+it.id+'">'+
       '<option value="0"'+(it.entrata?"":" selected")+'>Uscita</option>'+
       '<option value="1"'+(it.entrata?" selected":"")+'>Entrata</option>'+
       '</select></div></div>';
  h += '<div style="margin-top:11px"><label class="lbl">Luogo</label>'+
       '<input type="text" style="width:100%" placeholder="Via Roma 12, Milano — oppure «Gommista Bianchi»" '+
       'data-keep="e-place" data-chg="e-place" data-id="'+it.id+'" value="'+esc(it.place||"")+'">'+
       (it.place
         ? '<p class="hint" style="margin-top:6px">'+
           '<a class="lk" style="width:auto;padding:0 9px" href="'+esc(mapsUrl(it.place))+'" '+
           'target="_blank" rel="noopener noreferrer">indicazioni ◎</a> '+
           '<a class="lk" style="width:auto;padding:0 9px" href="'+esc(mapsSearch(it.place))+'" '+
           'target="_blank" rel="noopener noreferrer">cerca il posto</a>'+
           '<br>Ricerca: «'+esc(placeQuery(it.place))+'»'+
           (/\d/.test(it.place) ? '' : ' — per gli avvisi di partenza del calendario conviene l\'indirizzo completo')+
           '</p>' : '')+
       '</div>';
  h += '<div style="margin-top:11px"><label class="lbl">Collegamento (documento, cartella, riunione)</label>'+
       (selettoreLink("e-linkpick", it.link || "", it.id)
         ? '<div class="row" style="margin:0 0 6px">'+selettoreLink("e-linkpick", it.link || "", it.id)+'</div>' : '')+
       '<input type="text" style="width:100%" placeholder="https://…" data-keep="e-link" data-chg="e-link" data-id="'+it.id+'" value="'+esc(it.link||"")+'"></div>';
  if (it.link && !safeUrl(it.link))
    h += '<p class="warn">L\'indirizzo deve iniziare con http:// o https://</p>';
  h += '<div style="margin-top:11px"><label class="lbl">Nota</label>'+
       '<textarea class="notebox" style="width:100%" placeholder="Riferimenti, persone, cosa preparare…" '+
         'data-keep="e-note" data-chg="e-note" data-id="'+it.id+'">'+esc(it.note||"")+'</textarea></div>';
  var sInfo = stepsInfo(it), st = sInfo.list;
  h += '<div style="margin-top:11px"><label class="lbl">Passi ('+sInfo.done+' di '+sInfo.tot+')</label><ul class="steps">';
  st.forEach(function(x, n2){
    var d2 = stepOn(it, x);
    h += '<li><button class="box" data-act="stept" data-id="'+it.id+'" data-n="'+n2+'" '+
         'style="border-color:var(--pen);background:'+(d2?"var(--pen)":"transparent")+'">'+
         (d2?'<svg viewBox="0 0 12 12"><polyline points="2,6.5 4.7,9 10,3"/></svg>':'')+'</button>'+
         '<span class="txt'+(d2?" done":"")+'" role="button" tabindex="0" data-act="stept" data-id="'+it.id+'" data-n="'+n2+'">'+esc(x.t)+'</span>'+
         '<button class="slot" data-act="stepuna" data-id="'+it.id+'" data-n="'+n2+'" '+
         'title="'+(x.una?"Sparisce dopo essere stato fatto":"Voce fissa della lista")+'">'+
         (x.una ? "1 volta" : "fissa")+'</button>'+
         '<button class="del" data-act="stepdel" data-id="'+it.id+'" data-n="'+n2+'">×</button></li>';
  });
  h += '</ul><div class="row"><input type="text" id="stepin" data-keep="stepin" placeholder="Aggiungi un passo…">'+
       '<button class="add ghost" data-act="stepadd" data-id="'+it.id+'">Aggiungi</button></div></div>';
  }
  h += '<div class="row"><button class="add" data-act="editclose">Fatto</button>'+
       (typeof it.start === "number"
         ? '<button class="add ghost" data-act="untime" data-id="'+it.id+'">Togli l\'orario</button>' : '')+
       (it.freq === "once"
         ? '<button class="add ghost" data-act="tomorrow" data-id="'+it.id+'">→ domani</button>' : '')+
       '</div>';
  if (S.view === "giorno" || typeof it.start !== "number") {
    var propostoSlot = slotLibero(it.dur || 1);
    h += '<div class="row"><button class="tiny" data-act="trovaposto" data-id="'+it.id+'"'+
         (propostoSlot === null ? ' disabled' : '')+' title="'+
         (propostoSlot === null ? "Nessuno spazio libero oggi entro le 22"
                                : "Primo spazio libero: "+fmt(propostoSlot))+'">'+
         (propostoSlot === null ? "Nessuno spazio libero oggi"
                                : "Trova un posto oggi · "+fmt(propostoSlot))+'</button>'+
         '<span class="hint" style="margin:0;align-self:center">cerca la prima fascia libera '+
         'della giornata, dopo l\'ora attuale</span></div>';
  }
  h += '<div class="row secondrow">'+
       (it.freq !== "once"
         ? '<button class="tiny" data-act="'+(isSkipped(it)?"unskip":"skip")+'" data-id="'+it.id+'">'+
           (isSkipped(it) ? "rimetti in programma" : "salta questa volta")+'</button>' : '')+
       '<button class="tiny" data-act="wait" data-id="'+it.id+'">'+
       (it.waiting ? "riprendi" : "metti in attesa")+'</button>'+
       (it.freq === "once" ? '<button class="tiny" data-act="plusday" data-id="'+it.id+'">+1 giorno</button>' : '')+
       '<button class="tiny danger" data-act="'+(it.freq === "once" ? "del" : "del-serie")+'" '+
       'data-id="'+it.id+'">elimina</button>'+
       '</div>';
  /* ROU-002 — che tipo di ripetizione è: cambia che cosa succede saltandola */
  if (it.freq !== "once") {
    var tipoAtt = tipoRipetizione(it);
    h += '<div class="row tipirip" role="group" aria-label="Che cosa succede se la salti">'+
      '<span class="lbl" style="align-self:center;margin:0">Se salti un giorno</span>'+
      TIPI_RIPETIZIONE.map(function(t){
        var sel = tipoAtt === t.id;
        return '<button class="tiny'+(sel?" pos":"")+'" data-act="tipo-rip" data-id="'+it.id+'" '+
               'data-v="'+t.id+'" aria-pressed="'+sel+'" title="'+esc(t.lungo)+'">'+
               esc(t.breve)+'</button>';
      }).join("")+'</div>';
    if (eRoutine(it)) {
      var c = costanza(it);
      if (c && c.percentuale !== null)
        h += '<p class="hint costanza"><b>'+esc(c.testo)+'</b> negli ultimi 28 giorni — '+
             esc(c.giudizio)+'.</p>';
      else if (c)
        h += '<p class="hint costanza">Ancora nessun dato sulla costanza.</p>';
    }
  }

  /* ROU-001 — su una ricorrenza va detto a che cosa si applica la modifica.
     Senza questa scelta, cambiare l'orario di oggi riscriveva tutta la serie. */
  if (it.freq !== "once")
    h += '<div class="row ambiti" role="group" aria-label="A che cosa si applica">'+
      '<span class="lbl" style="align-self:center;margin:0">Le modifiche valgono per</span>'+
      AMBITI.map(function(a){
        var sel = (S.ambitoSerie || "serie") === a.id;
        return '<button class="tiny'+(sel ? " pos" : "")+'" data-act="ambito" data-v="'+a.id+'" '+
               'aria-pressed="'+sel+'">'+esc(a.nome)+'</button>';
      }).join("")+
      '<span class="hint" style="margin:0;align-self:center">Lo storico già registrato '+
      'non viene toccato in nessun caso.</span></div>';
  if (it.waiting)
    h += '<div class="row"><label class="lbl" style="align-self:center;margin:0">Ricontrolla il</label>'+
         '<input type="date" data-chg="e-recheck" data-id="'+it.id+'" value="'+esc(it.recheck||"")+'"></div>';
  h += '</div>';
  return h;
}

/* Mappa ora -> pixel: le fasce vuote vengono compresse, così la giornata
   entra in una schermata sola. In modalità estesa restano 24 ore piene. */
/* Agenda della giornata come elenco cronologico: sette colonne o una griglia a
   ore su 360px sono illeggibili. Nessun trascinamento obbligatorio, ogni voce
   si apre con un tocco e si sposta dai comandi. */
/* Disegni essenziali per gli stati vuoti: nessuna dipendenza, poche linee,
   sempre accompagnati da una spiegazione e da un'azione. */
function illustrazione(tipo){
  var d = {
    lista:  '<path d="M10 14h28M10 24h28M10 34h18"/><circle cx="6" cy="14" r="2"/>'+
            '<circle cx="6" cy="24" r="2"/><circle cx="6" cy="34" r="2"/>',
    calendario: '<rect x="8" y="12" width="32" height="28" rx="3"/><path d="M8 20h32M16 8v8M32 8v8"/>',
    ripeti: '<path d="M12 20a12 12 0 0 1 22-6"/><path d="M36 28a12 12 0 0 1-22 6"/>'+
            '<path d="M34 8v7h-7M14 40v-7h7"/>',
    sereno: '<circle cx="24" cy="24" r="14"/><path d="M18 22h.01M30 22h.01M18 29c3 3 9 3 12 0"/>',
    cerca:  '<circle cx="21" cy="21" r="11"/><path d="M29 29l9 9"/>',
    collega:'<path d="M20 28l8-8"/><path d="M17 31a6 6 0 0 1 0-8l4-4"/><path d="M31 17a6 6 0 0 1 0 8l-4 4"/>'
  }[tipo] || '';
  return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" '+
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
}

function statoVuoto(tipo, testo, sotto, azione){
  return '<div class="vuoto-ill">'+illustrazione(tipo)+
    '<p>'+esc(testo)+(sotto ? '<span class="sub">'+esc(sotto)+'</span>' : '')+'</p>'+
    (azione || '')+'</div>';
}
