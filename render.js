/* render.js — disegno della pagina
   Parte di Pannello Tempo. Caricato in ordine da index.html.
   Nessun modulo ES: gli script condividono lo scope globale per funzionare
   anche da file:// senza server. */
/* ---------- render ---------- */
var _rendering = false, _renderAgain = false;
function _statoDisegno(){ return { attivo:_rendering, inCoda:_renderAgain }; }
/* Sostituire il contenuto della pagina fa perdere il fuoco all'elemento attivo,
   e questo scatena un evento "change" che a sua volta chiede un nuovo disegno.
   Se partisse subito, il browser si troverebbe a rimuovere nodi già rimossi:
   è l'errore NotFoundError. Le chiamate annidate vengono quindi rimandate. */
/* Ridisegnando, ciò che si apre o si chiude sopra il punto in cui stai
   guardando sposta tutto il resto: la pagina «salta». Qui memorizzo dove si
   trovava l'elemento toccato e dopo il ridisegno riporto la vista lì. */
function ancoraA(el){
  if (!el || !el.getBoundingClientRect) return;
  var a = el.getAttribute("data-act"), v = el.getAttribute("data-v"), i2 = el.getAttribute("data-id");
  if (!a) return;
  var sel = '[data-act="'+a+'"]' + (v ? '[data-v="'+v+'"]' : "") + (i2 ? '[data-id="'+i2+'"]' : "");
  try { S.ancora = { sel: sel, top: el.getBoundingClientRect().top }; } catch (e) {}
}
function riporta(){
  var a = S.ancora;
  S.ancora = null;
  if (!a) return;
  var cont = document.getElementById("app");
  if (!cont || !cont.querySelector) return;
  var el = cont.querySelector(a.sel);
  if (!el || !el.getBoundingClientRect || !window.scrollBy) return;
  var d = el.getBoundingClientRect().top - a.top;
  if (Math.abs(d) > 1) { try { window.scrollBy(0, d); } catch (e) {} }
}
function render(){
  if (_rendering) { _renderAgain = true; return; }
  _rendering = true;
  try { renderInner(); }
  catch (e) {
    _renderAgain = true;
    S.renderErr = (e && e.message) || String(e);
    if (window.console && console.error) console.error("Disegno non riuscito:", e);
  }
  finally {
    _rendering = false;
    if (_renderAgain) {
      _renderAgain = false;
      if (typeof setTimeout === "function") setTimeout(render, 0);
    }
  }
}
function renderInner(){
  S.editClaimed = false;
  S.renderErr = null;
  if (S.schermataPrec && !(S.onboarding || S.chiusura || S.revisione)) {
    S.schermataPrec = false;
    ripristinaFuoco();
  }
  /* schermate a tutta pagina: sostituiscono il pannello invece di sovrapporsi,
     così su telefono non resta nulla che scorra sotto */
  if (S.onboarding || S.chiusura || S.revisione || guidaVisibile()) {
    var sch = S.onboarding ? onboardingHtml()
            : S.chiusura ? chiusuraHtml()
            : S.revisione ? revisioneHtml()
            : schermataGuida();
    var contSch = document.getElementById("app");
    if (contSch) {
      var keepS = {}, attivo = document.activeElement;
      var chiaveAtt = attivo && attivo.getAttribute ? attivo.getAttribute("data-keep") : null;
      var selezione = null;
      (contSch.querySelectorAll ? contSch.querySelectorAll("[data-keep]") : []).forEach(function(el0){
        var k = el0.getAttribute("data-keep");
        if (k) keepS[k] = el0.value;
        if (el0 === attivo) { try { selezione = el0.selectionStart; } catch (e) {} }
      });
      /* la guida porta già il proprio contenitore: non va avvolta due volte */
      contSch.innerHTML = (guidaVisibile() && !S.onboarding && !S.chiusura && !S.revisione)
        ? sch : '<div class="wrap">'+sch+'</div>';
      Object.keys(keepS).forEach(function(k){
        if (S.clearKeep[k]) return;
        var el1 = contSch.querySelector('[data-keep="'+k+'"]');
        if (el1 && keepS[k] !== undefined && el1.value !== keepS[k]) el1.value = keepS[k];
      });
      S.clearKeep = {};
      if (!S.schermataPrec) { ricordaFuoco(); entraNellaSchermata(); }
      S.schermataPrec = true;
      if (chiaveAtt) {
        var rif = contSch.querySelector('[data-keep="'+chiaveAtt+'"]');
        if (rif) {
          try { rif.focus({ preventScroll:true }); } catch (e) { rif.focus(); }
          if (selezione !== null) { try { rif.setSelectionRange(selezione, selezione); } catch (e) {} }
        }
      }
    }
    return;
  }
  var d = S.data, today = dk(), L = top3();
  var allDaily = d.items.filter(function(i){ return i.freq === "daily"; });
  var allDailyDone = allDaily.filter(isOn).length;
  var mine = dueOn(S.now).filter(function(i){ return !isSkipped(i); });
  var mineDone = mine.filter(isOn).length;
  var pct = mine.length ? Math.round(mineDone/mine.length*100) : 0;
  var CIRC = 2*Math.PI*19;

  var todayTimed = S.data.items.filter(function(i){
    return typeof i.start === "number" && visible(i) && onDay(i, S.now);
  });
  /* ROU-002 — una routine saltata non è un arretrato: il giorno è passato e
     non torna. Trasformare «meditare» in un debito dopo una settimana di ferie
     produce settanta voci da recuperare che non farà nessuno. */
  var late = todayTimed.filter(isLate).filter(generaArretrato);
  var overdueOnce = d.items.filter(function(i){
    return i.freq === "once" && !isOn(i) && !isSkipped(i) && !isWaiting(i) &&
           i.date < today && visible(i);
  });
  var untimedLeft = d.items.filter(function(i){
    return i.freq === "daily" && typeof i.start !== "number" && !isOn(i) && !isSkipped(i) &&
           visible(i) && onDay(i, S.now) && generaArretrato(i);
  });
  /* filtro per area: se la pausa vale solo per il lavoro, la vita continua */
  function nonInPausa(i){ return !inPausa(i.area); }
  late = late.filter(nonInPausa);
  overdueOnce = overdueOnce.filter(nonInPausa);
  untimedLeft = untimedLeft.filter(nonInPausa);
  var lateCount = late.length + overdueOnce.length + (nowH() > 20 ? untimedLeft.length : 0);
  var plannedH = timedFor(cursor()).reduce(function(s,i){ return s+(i.dur||0.5); }, 0);

  var h = "";

  /* testata */
  h += '<div class="mast"><svg class="mark" viewBox="0 0 24 24" aria-hidden="true">'+
       '<circle cx="12" cy="12" r="10" fill="none" stroke="var(--ink)" stroke-width="1.2" opacity=".55"/>';
  for (var t = 0; t < 12; t++) {
    var a = (t/12)*Math.PI*2 - Math.PI/2;
    var on = t === (S.now.getHours() % 12);
    h += '<line x1="'+(12+Math.cos(a)*7.4)+'" y1="'+(12+Math.sin(a)*7.4)+'" '+
         'x2="'+(12+Math.cos(a)*9.4)+'" y2="'+(12+Math.sin(a)*9.4)+'" '+
         'stroke="'+(on?"var(--brass)":"var(--ink)")+'" stroke-width="'+(on?2:1)+'" '+
         'opacity="'+(on?1:0.3)+'" stroke-linecap="round"/>';
  }
  h += '</svg><p class="eyebrow">Pannello tempo</p><span class="rule"></span></div>';

  /* strumenti */
  var links = (d.links || []).filter(function(l){
    if (!safeUrl(l.url)) return false;
    if (S.linkEdit) return true;   /* in modifica si vedono tutti, per poterli sistemare */
    /* un collegamento assegnato a un'area compare solo mentre guardi quell'area */
    return S.filter === "tutto" || !l.area || l.area === S.filter;
  });
  h += '<div class="toolsrow"><div class="tools">';
  links.forEach(function(l){
    /* mentre riordini, la barra è un'anteprima dell'ordine: se restasse
       navigabile un tocco distratto ti porterebbe fuori dal pannello */
    if (S.linkEdit)
      h += '<span class="tool anteprima" title="Anteprima dell\'ordine · '+esc(l.url)+'">'+
           esc(l.name)+'</span>';
    else
      h += '<a class="tool" href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer" '+
           'title="'+esc(l.url)+'">'+esc(l.name)+'</a>';
  });
  if (!links.length) h += '<span class="tool empty2">nessuno strumento</span>';
  h += '</div>'+
       /* il filtro attivo resta visibile anche col pannello chiuso: altrimenti
          si vedrebbero liste vuote senza capire perché */
       (S.tagF !== "tutti"
         ? '<span class="filtroattivo" title="Filtro attivo sulle etichette">'+
           '<b>'+esc(S.tagF === "__senza" ? "senza etichetta" : S.tagF)+'</b>'+
           '<button data-act="tagreset" title="Togli il filtro" aria-label="Togli il filtro">×</button></span>'
         : '')+
       '<span class="toolsep"></span>'+
       /* NAV-001 — gli strumenti vengono dalla definizione unica, e
          «Riepilogo» non compare più qui: è una sezione, e sta nella
          navigazione primaria insieme alle altre tre. */
       barraStrumenti()+
       '</div>'+
       /* la navigazione primaria compare anche in alto: stesse voci, stesso
          ordine della barra in basso, così passare da un dispositivo all'altro
          non richiede di reimparare dove stanno le cose. */
       navPrimaria('alto');
  var cercando = (S.searchOpen && normTxt(S.query).length >= 1) || S.digest;
  if (S.searchOpen)
    h += '<div class="row searchrow"><input type="text" id="q" data-keep="q" '+
         'data-chg="query" placeholder="Cerca fra task, note, luoghi, passi e archivio…" value="'+esc(S.query)+'">'+
         (S.query ? '<button class="tiny" data-act="qclear">pulisci</button>' : '')+
         '<button class="tiny" data-act="search">chiudi</button></div>';
  if (S.digest) {
    var r = riepilogo();
    h += '<div class="card oggi digcard"><h2 data-ico="riepilogo"><span>Riepilogo giornata</span>'+
         '<span class="cnt">'+r.fatti+'/'+r.oggi.length+'</span></h2>'+
         '<p class="digline"><b>'+esc(S.now.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}))+'</b> · '+
         dur2s(r.ore||0)+' pianificate'+
         (r.oggi.length - r.conOra.length > 0 ? ' · '+(r.oggi.length - r.conOra.length)+' senza orario' : '')+
         '</p>';
    function blocco(tit, righe, cls){
      if (!righe.length) return "";
      return '<p class="grp">'+tit+'</p><ul class="diglist'+(cls?" "+cls:"")+'">'+
             righe.map(function(x){ return '<li>'+x+'</li>'; }).join("")+'</ul>';
    }
    h += blocco("Le tre cose che contano", r.tre.map(function(e, n){
      var li = e.id ? itemById(e.id) : null;
      var d3 = li ? isOn(li) : e.done;
      return '<span class="digmark">'+(n+1)+'</span><span class="'+(d3?"done":"")+'">'+
             esc(li ? li.label : e.t)+'</span>';
    }));
    h += blocco("Rimaste indietro",
      r.scaduti.map(function(i){ return '<span class="digmark late">!</span>'+esc(i.label)+
        ' <span class="sub">scaduto '+esc(dataIl(i.date))+'</span>'; })
      .concat(r.tardi.map(function(i){ return '<span class="digmark late">!</span>'+esc(i.label)+
        ' <span class="sub">era alle '+fmt(i.start)+'</span>'; })), "late");
    var prossima = r.conOra.filter(function(i){
      return !isOn(i) && (i.start + (i.dur||0.5)) > nowH();
    })[0];
    h += blocco("Agenda", r.conOra.map(function(i){
      var pross = prossima && prossima.id === i.id;
      return '<span class="digora'+(pross?" ora":"")+'">'+fmt(i.start)+'</span>'+
             '<button class="box" data-act="toggle" data-id="'+i.id+'" '+
             'style="border-color:'+AREAS[i.area].color+';background:'+(isOn(i)?AREAS[i.area].color:"transparent")+'">'+
             (isOn(i)?'<svg viewBox="0 0 12 12"><polyline points="2,6.5 4.7,9 10,3"/></svg>':'')+'</button>'+
             '<span class="'+(isOn(i)?"done":"")+'" role="button" tabindex="0" data-act="toggle" data-id="'+i.id+'">'+
             esc(i.label)+'</span>'+
             (pross ? ' <span class="dignow">prossima</span>' : '')+
             (i.tag ? ' <span class="tagmini" style="--h:'+tagHue(i.tag)+'">'+esc(i.tag)+'</span>' : '')+
             (i.place ? ' <span class="sub">◎ '+esc(i.place)+'</span>' : '');
    }));
    h += blocco("Senza orario", r.senzaOra.map(function(i){
      return '<button class="box" data-act="toggle" data-id="'+i.id+'" '+
             'style="border-color:'+AREAS[i.area].color+';background:'+(isOn(i)?AREAS[i.area].color:"transparent")+'">'+
             (isOn(i)?'<svg viewBox="0 0 12 12"><polyline points="2,6.5 4.7,9 10,3"/></svg>':'')+'</button>'+
             '<span class="'+(isOn(i)?"done":"")+'" role="button" tabindex="0" data-act="toggle" data-id="'+i.id+'">'+
             esc(i.label)+'</span>'+
             (i.tag ? ' <span class="tagmini" style="--h:'+tagHue(i.tag)+'">'+esc(i.tag)+'</span>' : '');
    }));
    h += blocco("Scadenze entro sette giorni", r.scadenze.map(function(i){
      return '<span class="digmark">·</span>'+esc(i.label)+' <span class="sub">'+esc(dueInfo(i).label)+'</span>';
    }));
    h += blocco("Da ricontrollare", r.attesa.map(function(i){
      return '<span class="digmark">·</span>'+esc(i.label);
    }));
    var soldi = soldiMese(S.now);
    if (soldi.voci)
      h += '<p class="grp">Denaro previsto questo mese</p>'+
           '<p class="digline">'+
           (soldi.uscite ? '<span class="soldiout">−'+esc(euro(soldi.uscite))+'</span>' : '')+
           (soldi.entrate ? ' <span class="soldiin">+'+esc(euro(soldi.entrate))+'</span>' : '')+
           ' <span class="sub">su '+soldi.voci+(soldi.voci===1?' voce':' voci')+' con importo</span></p>';
    if (r.note.length || r.saltati.length)
      h += '<p class="hint">'+(r.note.length ? r.note.length+' da smistare nello scarico. ' : '')+
           (r.saltati.length ? r.saltati.length+' saltate oggi.' : '')+'</p>';
    h += '<div class="row"><button class="add" data-act="digcopy">Copia il riepilogo</button>'+
         '<button class="add ghost" data-act="digprint">Stampa</button>'+
         '<button class="add ghost" data-act="digest">Chiudi</button></div>';
    if (S.digTxt)
      h += '<p class="hint">Se la copia non funziona, seleziona il testo qui sotto.</p>'+
           '<textarea class="icsbox" readonly>'+esc(S.digTxt)+'</textarea>';
    h += '</div>';
  } else if (cercando) {
    var res = searchAll(S.query);
    var tot = res.items.length + res.notes.length + res.arch.length;
    h += '<div class="card"><h2 data-ico="cerca"><span>Risultati per «'+esc(S.query)+'»</span><span class="cnt">'+tot+'</span></h2>';
    if (res.corta) h += '<p class="empty">Scrivi almeno due lettere.</p>';
    else if (!tot) h += statoVuoto("cerca", "Nessuna corrispondenza.",
      "La ricerca guarda nei task, nelle note e nell\'archivio, ignorando i filtri attivi.");
    if (res.items.length) {
      h += '<p class="grp"><span class="dot" style="background:var(--ink2)"></span>Task</p><ul>'+
           res.items.map(function(i){
             var d4 = dove(i, S.query);
             return '<li><span class="txt" role="button" tabindex="0" data-act="toggle" data-id="'+i.id+'">'+
               evid(i.label, S.query)+
               '<span class="sub">'+esc(sezioneDi(i))+
               (d4 ? ' · '+esc(d4.campo)+': '+evid(brano(d4.testo, S.query), S.query) : '')+
               '</span></span>'+
               '<span class="acts"><button class="slot" data-act="open" data-id="'+i.id+'" data-ctx="ric">apri</button></span></li>';
           }).join("")+'</ul>';
    }
    if (res.notes.length) {
      h += '<p class="grp"><span class="dot" style="background:var(--brass)"></span>Scarico</p><ul>'+
           res.notes.map(function(c){
             return '<li><span class="txt">'+evid(c.text, S.query)+'</span>'+
                    '<span class="acts"><button class="slot" data-act="capprom" data-id="'+c.id+'">→ task</button></span></li>';
           }).join("")+'</ul>';
    }
    if (res.arch.length) {
      h += '<p class="grp"><span class="dot" style="background:var(--muted)"></span>Archivio</p><ul>'+
           res.arch.map(function(a){
             return '<li><span class="txt done">'+evid(a.label, S.query)+
                    '<span class="sub">chiuso '+esc(dataIl(a.date))+'</span></span></li>';
           }).join("")+'</ul>';
    }
    h += '<p class="hint">La ricerca sostituisce le sezioni finché il campo è pieno.</p></div>';
  }
  if (S.linkEdit)
    h += '<div class="card"><h2 data-ico="matita"><span>Collegamenti rapidi</span>'+
         '<span class="cnt">'+(S.data.links||[]).length+'</span>'+
         '<button class="chiudi" data-act="linkedit" title="Chiudi" aria-label="Chiudi"></button>'+
         '</h2>'+
         '<p class="hint" style="margin-top:0">Trascina per riordinare, oppure usa le frecce: '+
         'la barra qui sopra mostra l\'ordine in tempo reale. '+
         'L\'area decide dove compare: quelli di Lavoro spariscono quando guardi Vita.</p>'+
         '<ul class="linklist">'+(S.data.links||[]).map(function(l, n){
           return '<li data-lrow="'+n+'" draggable="true">'+
             '<span class="lgrip" title="Trascina per riordinare">⣿</span>'+
             '<span class="txt">'+esc(l.name)+'<span class="sub">'+esc(l.url)+'</span></span>'+
             '<span class="acts">'+
             '<select data-chg="linkrowarea" data-id="'+l.id+'" title="Dove mostrarlo">'+
             '<option value=""'+(!l.area?" selected":"")+'>sempre</option>'+
             '<option value="lavoro"'+(l.area==="lavoro"?" selected":"")+'>lavoro</option>'+
             '<option value="vita"'+(l.area==="vita"?" selected":"")+'>vita</option>'+
             '</select>'+
             '<button class="tiny" data-act="linkmove" data-n="'+n+'" data-d="-1" '+
             (n === 0 ? 'disabled ' : '')+'title="Sposta indietro">↑</button>'+
             '<button class="tiny" data-act="linkmove" data-n="'+n+'" data-d="1" '+
             (n === (S.data.links||[]).length-1 ? 'disabled ' : '')+'title="Sposta avanti">↓</button>'+
             '<button class="tiny danger" data-act="linkdel" data-id="'+l.id+'" title="Elimina">×</button>'+
             '</span></li>';
         }).join("")+'</ul>'+
         '<label class="lbl" style="margin-top:14px;display:block">Aggiungine uno</label>'+
         '<p class="hint" style="margin-top:0">L\'area decide dove compare: '+
         'i collegamenti di Lavoro spariscono quando guardi Vita, e viceversa.</p>'+
         '<div class="row">'+
         '<input type="text" id="lname" data-keep="lname" placeholder="Nome (es. CRM)" style="min-width:110px">'+
         '<input type="text" id="lurl" data-keep="lurl" placeholder="https://…">'+
         '<select data-chg="linkarea"><option value="">In entrambe</option>'+
         '<option value="lavoro"'+(S.ui.linkArea==="lavoro"?" selected":"")+'>Solo Lavoro</option>'+
         '<option value="vita"'+(S.ui.linkArea==="vita"?" selected":"")+'>Solo Vita</option></select>'+
         '<button class="add" data-act="linkadd">Aggiungi</button></div>'+
         '<div class="row"><button class="add ghost" data-act="linkedit">Fine</button>'+
         '<span class="hint" style="margin:0;align-self:center">Le modifiche sono già salvate</span></div>'+
         '<p class="hint">Apri lo strumento, copia l\'indirizzo dalla barra del browser e incollalo qui. '+
         'I collegamenti si sincronizzano insieme al resto.</p></div>';

  if (!cercando) {
  var carico = caricoGiornata(plannedH);
  var pross = prossimaCosa();
  h += '<!--Z:hero-->';
  h += '<div class="hero"><div class="heromain"><h1>'+
       esc(S.now.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}))+'</h1>'+
       '<div class="metriche">'+
       '<span class="metrica" role="button" tabindex="0" data-act="vaioggi" '+
       'title="Vai alle attività di oggi"><b>'+mineDone+'/'+mine.length+'</b> da fare</span>'+
       '<span class="metrica" role="button" tabindex="0" data-act="vaiagenda" '+
       'title="'+esc(carico.nota)+'"><span class="pallino '+carico.id+'"></span>giornata '+
       esc(carico.testo)+(plannedH ? ' · '+dur2s(plannedH) : '')+'</span>'+
       (lateCount > 0
         ? '<span class="metrica tardi" role="button" tabindex="0" data-act="vairitardi" '+
           'title="Vai alle cose rimaste indietro"><b>'+lateCount+'</b> in ritardo</span>'
         : '')+
       '</div>'+
       (pross
         ? '<p class="prossima" role="button" tabindex="0" data-act="open" data-id="'+pross.id+'" '+
           'data-ctx="sez:today"><span class="prosslab">Adesso</span>'+
           (typeof pross.start === "number" ? '<b>'+fmt(pross.start)+'</b> ' : '')+
           esc(pross.label)+'</p>'
         : '')+
       '</div>'+
       (function(){
         /* due archi concentrici: lavoro fuori, vita dentro. Il testo al centro
            e l'etichetta accessibile dicono la stessa cosa senza colori. */
         var bil = bilancioGiorno(S.now);
         var qL = bil.lavoro.voci ? bil.lavoro.fatte / bil.lavoro.voci : 0;
         var qV = bil.vita.voci   ? bil.vita.fatte   / bil.vita.voci   : 0;
         var CIRC2 = 2 * Math.PI * 14;
         var descr = "Completate "+mineDone+" attività su "+mine.length+". "+
           "Lavoro "+bil.lavoro.fatte+" su "+bil.lavoro.voci+", vita "+bil.vita.fatte+" su "+bil.vita.voci+".";
         return '<svg class="ring" data-late="'+(lateCount>0?1:0)+'" viewBox="0 0 44 44" '+
           'role="img" aria-label="'+esc(descr)+'">'+
           '<circle class="ringbg" cx="22" cy="22" r="19"/>'+
           '<circle class="ringfg arco-lavoro" cx="22" cy="22" r="19" stroke-dasharray="'+CIRC+'" '+
           'stroke-dashoffset="'+(CIRC*(1-qL))+'"/>'+
           '<circle class="ringbg2" cx="22" cy="22" r="14"/>'+
           '<circle class="ringfg arco-vita" cx="22" cy="22" r="14" stroke-dasharray="'+CIRC2+'" '+
           'stroke-dashoffset="'+(CIRC2*(1-qV))+'"/>'+
           '<text class="ringtx" x="22" y="22">'+mineDone+'/'+mine.length+'</text></svg>'+
           '<p class="sr">'+esc(descr)+'</p>';
       })()+'</div>';

  /* filtro */
  h += '<div class="seg filtroaree">'+[["tutto","Tutto"],["lavoro","Lavoro"],["vita","Vita"]].map(function(f){
    return '<button data-act="filter" data-v="'+f[0]+'" aria-pressed="'+(S.filter===f[0])+'" '+
           'data-on="'+(S.filter===f[0]?1:0)+'" data-area="'+f[0]+'">'+
           (f[0] !== "tutto" ? '<span class="pallino area-'+f[0]+'" aria-hidden="true"></span>' : '')+
           f[1]+'</button>';
  }).join("")+'</div>';

  /* Comandi di visualizzazione: cosa vedo, come è ordinato.
     La riga c'è sempre: un comando che compare e scompare in base ai dati
     lascia chi la usa a chiedersi dove sia finito. Quando le etichette non
     esistono ancora, l'opzione relativa resta visibile ma disattivata e
     spiega dove si creano. */
  var prj = moduloAttivo("etichette") ? etichette() : [];
  if (S.filtri) {
  h += '<div class="ctrls">';
  if (prj.length)
    h += '<div class="ctrl"><label class="lbl">Mostra</label>'+
         '<select data-chg="tagf">'+
         '<option value="tutti"'+(S.tagF==="tutti"?" selected":"")+'>Tutte le etichette</option>'+
         '<option value="__senza"'+(S.tagF==="__senza"?" selected":"")+'>Senza etichetta</option>'+
         prj.map(function(p){
           return '<option value="'+esc(p)+'"'+(S.tagF===p?" selected":"")+'>'+esc(p)+'</option>';
         }).join("")+'</select></div>';
  h += '<div class="ctrl"><label class="lbl">Raggruppa per</label>'+
       '<div class="seg mini">'+
       [["area", S.filter === "tutto" ? "Lavoro e vita" : "Nessuno", false,
                 S.filter === "tutto" ? "Divide le liste in Lavoro e Vita"
                                      : "Nessuna suddivisione: stai già guardando solo "+AREAS[S.filter].label],
        ["etichetta", "Etichetta", !prj.length,
                 prj.length ? "Divide le liste per etichetta"
                            : "Nessuna etichetta ancora: la aggiungi dai dettagli di un task"]
       ].map(function(o){
         return '<button data-act="groupby" data-v="'+o[0]+'" title="'+esc(o[3])+'" '+
                (o[2] ? 'disabled ' : '')+
                'aria-pressed="'+((P.groupBy||"area")===o[0])+'" '+
                'data-on="'+(!o[2] && (P.groupBy||"area")===o[0] ? 1 : 0)+'">'+o[1]+'</button>';
       }).join("")+'</div></div>';
  h += '</div>';
  }

  /* le priorità: la scheda vive in js/features/priorita-ui.js */
  /* PER-001 — avanzamento di un'operazione lunga. Compare solo mentre serve. */
  if (S.lavoro && (S.lavoro.attivo || (S.lavoro.esito && S.lavoro.esito.errore))) {
    var pc = percentualeLavoro();
    h += '<div class="card lavoro" role="status" aria-live="polite">'+
      '<h2 data-ico="sync"><span>'+esc(S.lavoro.titolo)+'</span>'+
      (pc !== null ? '<span class="cnt">'+pc+'%</span>' : '')+'</h2>'+
      (pc !== null
        ? '<div class="avanzabar"><i class="trascorso" style="width:'+pc+'%"></i></div>'+
          '<p class="hint">'+S.lavoro.fatti+' di '+S.lavoro.totali+'</p>'
        : '<p class="hint">Operazione in corso. La pagina resta utilizzabile.</p>')+
      (S.lavoro.esito && S.lavoro.esito.errore
        ? '<p class="hint">Non è riuscita: '+esc(S.lavoro.esito.errore)+
          '. I dati non sono stati modificati.</p>'
        : '')+
      (S.lavoro.attivo && S.lavoro.annullabile
        ? '<div class="row"><button class="tiny" data-act="lavoro-annulla">Annulla</button></div>'
        : '')+
      '</div>';
  }

  /* SYN-004 — i record in disaccordo, uno per uno, con le differenze */
  if (S.conflitti && S.conflitti.length) h += zonaConflitti();

  /* Il marcatore era stato perso estraendo la scheda in un modulo: senza, la
     zona «priorita» restava vuota e il suo contenuto finiva dentro «hero». */
  h += '<!--Z:priorita-->';
  h += zonaPriorita();

  /* REC-005 — una domanda sola su ciò che si sta accumulando in silenzio */
  (function(){
    var acc = domandaAccumulo();
    if (!acc) return;
    h += '<div class="card accumulo" data-sez="accumulo" role="region" '+
      'aria-label="Una voce rimandata a lungo">'+
      '<h2 data-ico="ripeti"><span>Una domanda sola</span>'+
      (acc.quante > 1 ? '<span class="cnt">'+acc.quante+' così</span>' : '')+'</h2>'+
      '<p class="accnome">'+esc(acc.item.label)+
      '<span class="sub">'+esc(acc.testo)+'</span></p>'+
      '<p class="hint">'+esc(acc.domanda)+' Rimandare non è un errore: rimandare '+
      'venti volte senza accorgersene sì.</p>'+
      '<div class="row">'+
      '<button class="tiny pos" data-act="acc-oggi" data-id="'+acc.item.id+'">La faccio oggi</button>'+
      '<button class="tiny" data-act="acc-archivia" data-id="'+acc.item.id+'">Lasciala andare</button>'+
      '<button class="tiny" data-act="acc-dopo" data-id="'+acc.item.id+'">Ci penso ancora</button>'+
      '</div>'+
      '<div class="row"><button class="link" data-act="acc-spegni">Non farmi più questa domanda</button>'+
      '</div></div>';
  })();

  /* ONB-004 — la checklist di attivazione, finché serve. Sta DOPO le priorità:
     il primo traguardo è sceglierne una, e va vista la scheda vera prima
     dell'indicazione che la riguarda. */
  if (mostraAttivazione()) h += zonaAttivazione();

  /* SEC-001: la schermata che spiegava le conseguenze di «Resta collegato»
     non serve più: l'opzione è stata rimossa insieme alla persistenza. */

  /* BCK-002 — conferma proporzionata all'azione scelta */
  if (S.conferma && azioneDistruttiva(S.conferma)) {
    var az = azioneDistruttiva(S.conferma);
    h += '<div class="card invito pronta" role="alertdialog" aria-labelledby="dtit">'+
      '<h2 data-ico="ritardo"><span id="dtit">'+esc(az.nome)+'?</span></h2>'+
      '<p class="hint" style="margin-top:0"><b>Viene eliminato:</b> '+esc(az.elimina)+'</p>'+
      '<p class="hint"><b>Resta:</b> '+esc(az.conserva)+'</p>'+
      (az.backup ? '<p class="hint">Prima faccio una copia di sicurezza.</p>' : '')+
      (az.annullabile ? '<p class="hint">Potrai annullare subito dopo.</p>'
                      : '<p class="hint avviso"><b>Questa azione non è annullabile.</b></p>')+
      (az.richiedeAutenticazione && !autenticazioneRecente()
        ? '<p class="hint avviso"><b>Serve rientrare.</b> La sessione è iniziata '+
          esc(String(minutiDaAutenticazione()))+' minuti fa.</p>' : '')+
      (az.conferma === 3
        ? '<div class="row"><label class="lbl" for="confin" style="align-self:center;margin:0">'+
          'Scrivi '+esc(az.parola)+' per confermare</label>'+
          '<input type="text" id="confin" data-keep="confin" placeholder="'+esc(az.parola)+'" '+
          'autocomplete="off" spellcheck="false"></div>'
        : '')+
      '<div class="row"><button class="add'+(az.conferma === 3 ? " danger" : "")+'" '+
      'data-act="distr-ok"'+
      (az.richiedeAutenticazione && !autenticazioneRecente() ? ' disabled' : '')+'>'+
      esc(az.nome)+'</button>'+
      '<button class="tiny" data-act="conferma-annulla">Annulla</button></div></div>';
  }
  else if (S.conferma) {
    var tutto = S.conferma === "tutto";
    h += '<div class="card invito pronta" role="alertdialog" aria-labelledby="conftit">'+
      '<h2 data-ico="ritardo"><span id="conftit">'+
      (tutto ? "Cancellare tutto?" : "Cancellare la cronologia?")+'</span></h2>'+
      '<p class="hint" style="margin-top:0">'+
      (tutto
        ? '<b>Vengono rimossi da questo dispositivo:</b> attività, routine, note, priorità, '+
          'cronologia, credenziali di sincronizzazione e copie di sicurezza.'+
          (syncReady() ? ' Provo a svuotare anche i dati sul servizio collegato, e ti dico se riesce.' : '')+
          ' <b>Questa azione non è annullabile.</b>'
        : '<b>Vengono rimossi:</b> completamenti, chiusure di giornata, revisioni e registri '+
          'delle analisi. Attività, routine e note restano. '+
          'Prima faccio una copia di sicurezza e potrai annullare.')+'</p>'+
      (tutto && !autenticazioneRecente()
        ? '<p class="hint avviso"><b>Serve rientrare.</b> La sessione è iniziata '+
          esc(String(minutiDaAutenticazione()))+' minuti fa. Una cancellazione definitiva '+
          'richiede un accesso recente: esci e rientra con la password, poi torna qui.</p>'
        : '')+
      (tutto
        ? '<div class="row"><label class="lbl" for="confin" style="align-self:center;margin:0">'+
          'Scrivi CANCELLA per confermare</label>'+
          '<input type="text" id="confin" data-keep="confin" placeholder="CANCELLA" '+
          'autocomplete="off" spellcheck="false"></div>'
        : '')+
      '<div class="row"><button class="add'+(tutto?" danger":"")+'" data-act="conferma-ok"'+
      (tutto && !autenticazioneRecente() ? ' disabled' : '')+'>'+
      (tutto ? "Cancella tutto" : "Cancella la cronologia")+'</button>'+
      '<button class="tiny" data-act="conferma-annulla">Annulla</button></div></div>';
  }
  if (S.esitoCancellazione) {
    var ec = S.esitoCancellazione;
    h += '<div class="card"><h2 data-ico="dati"><span>'+
      (ec.completo ? "Cancellazione completata"
       : ec.parziale ? "Cancellazione parziale" : "Cancellazione non riuscita")+'</span></h2>'+
      (ec.parziale ? '<p class="hint avviso">Una parte non è riuscita. Qui sotto trovi che '+
                     'cosa è stato rimosso e che cosa no.</p>' : '')+
      '<ul class="chlista">'+
      PASSI_CANCELLAZIONE().map(function(p2){
        var r2 = ec.passi[p2.id];
        if (!r2) return '';
        return '<li>'+(r2.ok ? "✓" : "✗")+' '+esc(p2.nome)+
               (r2.nota ? '<span class="sub">'+esc(r2.nota)+'</span>' : '')+'</li>';
      }).join("")+
      '</ul><div class="row"><button class="tiny" data-act="esito-ok">Ho capito</button></div></div>';
  }

  /* richiesta della causa prima di mettere una voce fra i bloccati */
  if (S.chiediCausa && itemById(S.chiediCausa)) {
    var vb = itemById(S.chiediCausa);
    h += '<div class="card invito pronta"><h2 data-ico="attesa"><span>Da chi dipende?</span></h2>'+
      '<p class="hint" style="margin-top:0">«'+esc(vb.label)+'» esce dalla giornata e torna quando '+
      'si sblocca. Scrivere la causa evita che questa sezione diventi un cimitero.</p>'+
      '<div class="row"><input type="text" id="causain" data-keep="causain" '+
      'placeholder="Es. risposta di Rossi, preventivo del fornitore..."></div>'+
      '<div class="row"><label class="lbl" style="align-self:center;margin:0">Ricontrolla il</label>'+
      '<input type="date" id="causadata" data-keep="causadata">'+
      '<span class="hint" style="margin:0;align-self:center">facoltativo</span></div>'+
      '<div class="row"><button class="add" data-act="causa-ok">Mettila fra i bloccati</button>'+
      '<button class="tiny" data-act="causa-annulla">annulla</button></div></div>';
  }

  /* ritardi */
  if (inPausa())
    h += '<div class="card"><h2 data-ico="pausa"><span>In pausa</span>'+
         '<span class="cnt">fino al '+esc(shortDate(S.data.pause.to))+'</span></h2>'+
         '<p class="hint" style="margin-top:0"><b>'+esc(etichettaPausa())+'</b> — '+
         (S.data.pause.area
           ? 'i ritardi di '+esc(AREAS[S.data.pause.area].label)+' sono sospesi, il resto funziona normalmente. '
           : 'le segnalazioni di ritardo sono sospese. ')+
         '<button class="tiny" data-act="pclear2">termina ora</button></p></div>';
  if (lateCount > 0) {
  h += '<!--Z:riprogrammare-->';
    h += '<div class="alert liv-attenzione" data-sez="recupera" data-livello="attenzione" '+
         'role="region" aria-label="Da riprogrammare: richiede una decisione">'+
         '<h2 data-ico="ritardo"><span>'+
         (lateCount === 1 ? "Da riprogrammare" : "Da riprogrammare")+
         '</span><span class="badge">'+lateCount+'</span></h2>';
    /* l'apertura dell'elenco appartiene ora a elencoArretrati, che può
       produrne più di uno: uno per fascia d'età. */
    /* REC-003 — con molti arretrati l'elenco si raggruppa per età e offre
       azioni su più voci insieme. Sotto la soglia resta l'elenco semplice. */
    var tutteArr = overdueOnce.concat(late).concat(nowH() > 20 ? untimedLeft : []);
    h += elencoArretrati(tutteArr, function(i){
      if (overdueOnce.indexOf(i) >= 0) return "appuntamento scaduto il "+shortDate(i.date);
      if (late.indexOf(i) >= 0) return "in ritardo di "+dur2s(snap(nowH()-i.start-(i.dur||0.5)));
      return "senza orario, rimasta aperta oggi";
    });
    h += '</div>';
    /* un appuntamento scaduto non compare in nessun'altra lista: se il pannello
       non venisse disegnato qui, toccare «⋯» non produrrebbe alcun effetto */
    if (S.editCtx === "ritardo" && S.editId && S.editFrom === "list" &&
        !S.editClaimed && itemById(S.editId)) {
      S.editClaimed = true;
      h += '<div class="card">'+editorHtml()+'</div>';
    }
  }

  /* scadenze */
  /* tutte le scadenze aperte, senza orizzonte: nasconderne alcune rendeva
     il contatore incomprensibile */
  var tutteDue = d.items.filter(function(i){ return i.due && visible(i) && !isOn(i); })
    .map(function(i){ return { item:i, d: dueInfo(i) }; })
    .filter(function(x){ return !!x.d; })
    .sort(function(a,b){ return a.d.days - b.d.days; });
  var LIM_SCAD = 12;
  var dues = tutteDue.slice(0, LIM_SCAD);
  var oltre = tutteDue.length - dues.length;
  if (tutteDue.length) {
    /* il contatore conta ciò che vedi; l'urgenza si legge nelle pastiglie */
    /* regola: nell'intestazione un numero solo, la quantità.
       L'urgenza è un pallino, non un secondo numero da interpretare. */
    var scadute = tutteDue.filter(function(x){ return x.d.level === "over"; }).length;
    if (moduloAttivo("etichette") || modoAvanzato()) {
    h += '<div class="card"><h2 data-ico="scadenze"><span>Scadenze</span>'+
         (scadute ? '<span class="segnale rosso" title="'+scadute+' '+
                    (scadute===1?"già scaduta":"già scadute")+'"></span>' : '')+
         '<span class="cnt">'+tutteDue.length+'</span></h2><ul>';
    dues.forEach(function(x){
      var i = x.item;
      h += '<li><button class="star" data-on="'+(prioIndex(i)>=0?1:0)+'" data-act="star" '+
           'data-id="'+i.id+'" title="Metti tra le tre cose" aria-label="Priorità"></button>'+
           '<button class="box" data-act="toggle" data-id="'+i.id+'" '+
           'style="border-color:'+AREAS[i.area].color+'"></button>'+
           '<span class="txt" role="button" tabindex="0" data-act="toggle" data-id="'+i.id+'">'+esc(i.label)+'</span>'+
           '<span class="acts"><span class="slot due-'+x.d.level+'">'+esc(x.d.label)+'</span>'+
           '<button class="del" data-act="open" data-id="'+i.id+'" data-ctx="scad" title="Apri">⋯</button>'+
           '</span></li>'+
           maybeEditor(i.id, "scad");
    });
    h += '</ul>'+
         (oltre ? '<p class="hint">Altre '+oltre+' più avanti nel tempo: le trovi nelle liste dei task.</p>' : '')+
         '<p class="hint">Le scadenze restano segnalate ogni giorno finché non completi '+
         'il task, senza occupare uno dei tre posti in cima.</p></div>';
  }
  }

  /* invito all'installazione: compare dal secondo giorno, non al primo secondo */
  if (!cercando && pref("onboardingFatto") && (S.data.chiusure||[]).length + (S.data.items||[]).length > 2) {
    var invIns = invitoInstallazione();
    if (invIns)
      h += '<div class="card terziaria"><p class="hint" style="margin:0">'+esc(invIns.testo)+
        (invIns.automatico ? ' <button class="tiny pos" data-act="installa">Installa</button>' : '')+
        ' <button class="tiny" data-act="installa-no">non ora</button></p></div>';
  }

  /* invito alla chiusura di giornata: proposta, mai imposizione */
  if (!cercando && pref("chiusuraAttiva") && isToday() && !chiusuraFattaOggi() && nowH() >= 12) {
    var pronta = chiusuraDaProporre();
    h += '<!--Z:rituale-->';
    h += '<div class="card invito'+(pronta ? " pronta" : "")+'" data-sez="rituale">'+
      '<h2 data-ico="riepilogo"><span>Chiusura di giornata</span>'+
      (serieChiusure() ? '<span class="cnt">'+serieChiusure()+' di fila</span>' : '')+'</h2>'+
      '<p class="hint" style="margin-top:0">'+
      (pronta ? 'Trenta secondi per sistemare ciò che è rimasto aperto e preparare domani.'
              : 'Te la propongo alle '+esc(pref("chiusuraOra"))+', ma puoi farla quando vuoi.')+'</p>'+
      '<div class="row"><button class="add'+(pronta?"":" ghost")+'" data-act="ch-apri">'+
      'Chiudi la giornata</button></div></div>';
  }
  if (!cercando && chiusuraFattaOggi() && isToday()) {
    var ser = serieChiusure();
    h += '<div class="card terziaria" data-sez="rituale"><h2 data-ico="riepilogo"><span>Giornata chiusa</span>'+
      (ser ? '<span class="cnt">'+ser+' di fila</span>' : '')+'</h2>'+
      '<p class="hint" style="margin-top:0">Hai già fatto la revisione di oggi. '+
      '<button class="tiny" data-act="ch-apri">rifalla</button></p></div>';
  }
  if (!cercando && revisioneDaProporre())
    h += '<div class="card invito pronta" data-sez="rituale"><h2 data-ico="riepilogo"><span>Revisione della settimana</span></h2>'+
      '<p class="hint" style="margin-top:0">Come sono andate le ore fra lavoro e vita.</p>'+
      '<div class="row"><button class="add" data-act="rv-apri">Guarda la settimana</button>'+
      '<button class="tiny" data-act="rv-rinvia">rinvia</button></div></div>';

  /* suggerimento del secondo giorno, una volta sola */
  if (!cercando) {
    var sugg2 = suggerimentoSecondoGiorno();
    if (sugg2)
      h += '<div class="card terziaria"><p class="hint" style="margin:0">'+esc(sugg2)+
        ' <button class="tiny" data-act="sugg2-ok">ho capito</button></p></div>';
  }

  /* agenda */
  var days = weekDays();
  /* Il marcatore va PRIMA dell'apertura della scheda. Stava in mezzo, dopo la
     barra di avanzamento: il segmento risultava sbilanciato e il contenitore
     della zona finiva annidato dentro quello della zona precedente. Aggiornando
     «hero» l'agenda veniva distrutta con lui e non tornava più. */
  h += '<!--Z:agenda-->';
  h += '<div class="card" data-sez="agenda"><h2 data-ico="agenda"><span>'+
       (S.view === "giorno" ? "Agenda" : S.view === "settimana" ? "Settimana" : "Mese")+
       '</span>'+
       (isToday()
         ? '<button class="oradesso" data-act="nowjump" title="Vai all\'ora attuale">'+
           fmt(nowH())+'</button>'
         : '<button class="oradesso torna" data-act="nowjump" title="Torna a oggi">oggi</button>')+
       '</h2>';
  h += '<div class="seg mini">'+[["giorno","Giorno"],["settimana","7 giorni"]].map(function(v){
    return '<button data-act="view" data-v="'+v[0]+'" aria-pressed="'+(S.view===v[0])+'" '+
           'data-on="'+(S.view===v[0]?1:0)+'">'+v[1]+'</button>';
  }).join("")+'</div>';
  var unit = S.view === "giorno" ? "d" : S.view === "settimana" ? "w" : "m";
  var label = S.view === "giorno"
    ? cursor().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"})
    : S.view === "settimana"
      ? days[0].getDate()+" – "+days[6].toLocaleDateString("it-IT",{day:"numeric",month:"long"})
      : cursor().toLocaleDateString("it-IT",{month:"long",year:"numeric"});
  h += '<div class="nav"><button class="tiny" data-act="shift" data-n="-1" data-u="'+unit+'">‹</button>'+
       '<b>'+esc(label)+'</b>'+
       '<button class="tiny" data-act="shift" data-n="1" data-u="'+unit+'">›</button>'+
       (isToday() ? '' : '<button class="tiny" data-act="gotoday">Oggi</button>')+'</div>';
  var yNow = new Date().getFullYear(), years = [];
  for (var y = yNow-2; y <= yNow+4; y++) years.push(y);
  h += '<div class="row jump"><select data-chg="month">'+MONTHS.map(function(m,n){
        return '<option value="'+n+'"'+(cursor().getMonth()===n?" selected":"")+'>'+m+'</option>';
      }).join("")+'</select><select data-chg="year">'+years.map(function(yy){
        return '<option value="'+yy+'"'+(cursor().getFullYear()===yy?" selected":"")+'>'+yy+'</option>';
      }).join("")+'</select>'+
      '<button class="tiny" data-act="shift" data-n="-1" data-u="y">‹ anno</button>'+
      '<button class="tiny" data-act="shift" data-n="1" data-u="y">anno ›</button></div>';
  h += nuovoHtml();
  h += (S.editFrom === "agenda" ? editorHtml() : "");
  if (S.view === "giorno" && isToday()) {
    /* dove sei nella giornata rispetto a ciò che hai pianificato.
       Non è una misura di produttività: è una collocazione nel tempo. */
    var oraOra = nowH();
    var q = Math.max(0, Math.min(100, (oraOra - 7) / 15 * 100));
    var bilOggi = bilancioGiorno(S.now);
    h += '<div class="avanzagiorno">'+
      '<span class="avanzalab">07:00</span>'+
      '<span class="avanzabar" role="img" aria-label="Sono le '+esc(fmt(Math.round(oraOra*4)/4))+
        ', hai '+esc(dur2s(bilOggi.totaleMinuti/60))+' pianificate oggi">'+
        '<i class="trascorso" style="width:'+q.toFixed(1)+'%"></i>'+
        '<i class="adesso" style="left:'+q.toFixed(1)+'%"></i></span>'+
      '<span class="avanzalab">22:00</span></div>';
  }
  /* la griglia a ore resta sul computer; sul telefono l'elenco cronologico */
  h += S.view === "settimana" ? weekHtml()
     : '<div class="soloampio">'+dayHtml()+'</div><div class="solostretto">'+agendaElencoHtml()+'</div>';
  h += '</div>';

  /* sezioni */
  /* ogni sezione di elenco è una zona propria: completare una voce in «oggi»
     non deve toccare «prossimi appuntamenti» */
  SECTIONS.forEach(function(f){
    h += '<!--Z:'+(f.id === "today" ? "today" : "altro")+'-->';
    h += sectionHtml(f.id, f.title, f.ico);
  });
  h += '<!--Z:routine-->';
  h += routineHtml();

  /* cosa salta più spesso */
  var log = d.log || {};
  var skipped = d.items.filter(function(i){
    if (i.freq !== "daily" || !visible(i)) return false;
    var l = log[i.id] || "";
    if (l.length < 3) return false;
    return (l.split("0").length - 1) >= 2;
  }).map(function(i){
    var l = log[i.id] || "";
    return { item:i, log:l, miss:(l.split("0").length - 1) };
  }).sort(function(x,y){ return y.miss - x.miss; });

  /* «Spesso rimandate» compare solo quando c'è davvero qualcosa da ripensare,
     e in modalità semplice solo se il pannello ha un suggerimento da dare */
  var suggPresenti = skipped.filter(function(s3){ return !!analisiRimandi(s3.item); }).length;
  if (moduloAttivo("coach") && (modoAvanzato() || suggPresenti)) {
  h += '<div class="card terziaria" data-sez="ripensare"><h2 data-ico="salta"><span>Spesso rimandate</span><span class="cnt">'+
       (skipped.length ? skipped.length+(skipped.length===1?" voce":" voci") : "")+'</span></h2>';
  if (!skipped.length) {
    h += '<p class="empty">Niente da segnalare. Qui compaiono le attività che hai ripianificato '+
         'più volte, per valutare se cambiare orario, dividerle o rimuoverle.</p>';
  } else {
    h += '<ul>';
    skipped.forEach(function(s2){
      h += '<li><button class="star" data-on="'+(prioIndex(s2.item)>=0?1:0)+'" data-act="star" '+
           'data-id="'+s2.item.id+'" title="Metti tra le tre cose" aria-label="Priorità"></button>'+
           '<span class="txt" role="button" tabindex="0" data-act="slot" data-id="'+s2.item.id+'">'+esc(s2.item.label)+
           '<span class="log">'+s2.log.split("").map(function(c){
             return '<i data-on="'+c+'"></i>';
           }).join("")+'</span></span>'+
           '<span class="acts"><span class="late2">'+s2.miss+' su '+s2.log.length+'</span>'+
           '<button class="del" data-act="open" data-id="'+s2.item.id+'" data-ctx="salt" title="Apri">⋯</button>'+
           '</span></li>'+
           (function(){
             var sug = analisiRimandi(s2.item);
             var ab = abitudineOraria(s2.item.id);
             if (ab && !sug)
               sug = { tipo:"orario",
                 testo:"Lo pianifichi alle "+fmt(ab.prevista)+" ma di solito lo fai verso le "+
                       fmt(Math.round(ab.mediana*4)/4)+" (su "+ab.campione+" volte registrate).",
                 azione:"Spostalo alle "+fmt(Math.round(ab.mediana*4)/4), nuovaOra: Math.round(ab.mediana*4)/4 };
             if (!sug) return "";
             return '<li class="suggrow"><span class="suggico">◆</span>'+
               '<span class="suggtx">'+esc(sug.testo)+'</span>'+
               '<span class="acts"><button class="tiny pos" data-act="applicasugg" '+
               'data-id="'+s2.item.id+'" data-v="'+sug.tipo+'" '+
               (sug.giorni ? 'data-n="'+sug.giorni.join("-")+'" ' : '')+
               (sug.nuovaOra !== undefined ? 'data-ora="'+sug.nuovaOra+'" ' : '')+
               '>'+esc(sug.azione)+'</button>'+
               '<button class="tiny" data-act="ignorasugg" data-id="'+s2.item.id+'">no, va bene così</button>'+
               '</span></li>';
           })()+
           maybeEditor(s2.item.id, "salt");
    });
    h += '</ul><p class="hint">Se una voce è rossa più volte di fila, il problema non è la memoria: '+
         'o lo slot è nel posto sbagliato, o quel task non ti serve. Conta solo i giorni in cui hai '+
         'aperto il pannello.</p>';
  }
  h += '</div>';
  }

  /* scarico */
  var cap = d.capture.filter(visible);
  var pend = cap.filter(function(c){ return !c.done; });
  var stale = pend.filter(function(c){ return c.at && (Date.now()-c.at) > 3*86400000; });
  /* la cattura vive nel menù «+»: come card permanente confondeva
     con «Aggiungi un task» */
  if (moduloAttivo("note") && (modoAvanzato() || pend.length)) {
  h += '<div class="card terziaria" data-sez="note"><h2 data-ico="appunti"><span>Posta in arrivo</span><span class="cnt">'+
       (pend.length ? String(pend.length) : "vuoto")+'</span></h2>'+
       '<p class="hint" style="margin-top:0">Non è una lista di cose da fare: è il posto dove scaricare '+
       'un pensiero senza interrompere quello che stai facendo. Ogni voce va poi trasformata in task o cancellata.</p>';
  if (stale.length)
    h += '<p class="warn">'+stale.length+(stale.length===1?" voce ferma":" voci ferme")+
         ' da più di tre giorni: decidile o cancellale.</p>';
  h += '<ul>';
  if (!cap.length) h += '<li><span class="empty">Scrivilo qui invece di andare a farlo subito.</span></li>';
  cap.forEach(function(c){
    var old = c.at && (Date.now()-c.at) > 3*86400000 && !c.done;
    var days = c.at ? Math.floor((Date.now()-c.at)/86400000) : null;
    var ageTxt = days === null ? "" : days === 0 ? "oggi" : days === 1 ? "ieri" : days+" giorni fa";
    var sim = c.done ? [] : similarNotes(c);
    var nota = "";
    if (sim.length) {
      var m0 = sim[0];
      nota = m0.kind === "archivio"
        ? "già chiuso"+(m0.when ? " "+dataIl(m0.when) : "")+": «"+m0.label+"»"
        : m0.kind === "scarico"
          ? "simile a un'altra nota: «"+m0.label+"»"
          : "già in elenco: «"+m0.label+"»";
    }
    h += '<li><button class="box" data-act="captoggle" data-id="'+c.id+'" '+
         'style="border-color:'+(old?"var(--rust)":AREAS[c.area].color)+';background:'+(c.done?AREAS[c.area].color:"transparent")+'">'+
         (c.done?'<svg viewBox="0 0 12 12"><polyline points="2,6.5 4.7,9 10,3"/></svg>':'')+'</button>'+
         '<span class="txt'+(c.done?" done":"")+'" role="button" tabindex="0" data-act="captoggle" data-id="'+c.id+'">'+esc(c.text)+
         (ageTxt ? '<span class="sub">'+ageTxt+'</span>' : '')+
         (nota ? '<span class="sub dupnote">'+esc(nota)+'</span>' : '')+'</span>'+
         (sim.length && sim[0].id ? '<button class="slot" data-act="open" data-id="'+sim[0].id+'">apri</button>' : '')+
         (c.done ? '' :
           '<button class="slot" data-act="capprom" data-id="'+c.id+'" title="Trasformalo in un task di oggi">→ task</button>'+
           '<button class="slot" data-act="tostep" data-id="'+c.id+'" data-on="'+(S.toStep===c.id?1:0)+'" '+
           'title="Aggiungilo come passo di un task esistente">→ passo</button>')+
         '<button class="del" data-act="capdel" data-id="'+c.id+'">×</button></li>';
    if (S.toStep === c.id) {
      var cand = d.items.filter(function(i){ return !i.waiting; })
        .sort(function(a,b){
          var sa = (a.steps||[]).length ? 0 : 1, sb = (b.steps||[]).length ? 0 : 1;
          return sa - sb || a.label.localeCompare(b.label);
        }).slice(0, 40);
      h += '<li class="editrow"><div class="steppanel"><p class="lbl">Aggiungi «'+esc(c.text)+'» come passo di:</p>'+
           '<div class="row" style="margin-top:6px"><select id="tostepsel">'+
           cand.map(function(i){
             var n0 = (i.steps||[]).length;
             return '<option value="'+i.id+'">'+esc(i.label)+(n0 ? " ("+n0+" passi)" : "")+'</option>';
           }).join("")+'</select>'+
           '<button class="add" data-act="tostepgo" data-id="'+c.id+'">Aggiungi</button>'+
           '<button class="tiny" data-act="tostep" data-id="'+c.id+'">annulla</button></div>'+
           (cand.length ? '' : '<p class="empty">Non ci sono task a cui agganciarlo.</p>')+
           '</div></li>';
    }
  });
  h += '</ul><div class="row"><input type="text" id="capinput" data-keep="capinput" placeholder="Es. richiamare il commercialista">'+
       '<select data-chg="cap-area">'+['lavoro','vita'].map(function(a2){
         return '<option value="'+a2+'"'+(S.ui.capArea===a2?" selected":"")+'>'+AREAS[a2].label+'</option>';
       }).join("")+'</select><button class="add" data-act="capadd">Aggiungi</button></div></div>';
  }

  /* aggiungi task */
  if (S.dup) {
    h += '<div class="card dup"><h2 data-ico="doppio"><span>Forse ce l\'hai già</span><span class="cnt">'+S.dup.matches.length+'</span></h2>'+
         '<p class="hint" style="margin-top:0">Stavi per aggiungere <b>'+esc(S.dup.label)+'</b>. '+
         'Somiglia a queste voci:</p><ul>';
    S.dup.matches.forEach(function(mm){
      var quando = mm.when ? shortDate(mm.when) : null;
      var nota = mm.kind === "archivio"
        ? (quando ? "già chiuso "+quando : "già chiuso in passato")
        : (mm.when ? "presente, completato "+quando : "già in elenco");
      h += '<li><span class="dot" style="background:'+AREAS[mm.area||"lavoro"].color+';margin-top:7px"></span>'+
           '<span class="txt">'+esc(mm.label)+'<span class="sub">'+nota+
           ' · somiglianza '+Math.round(mm.score*100)+'%</span></span>'+
           (mm.id ? '<button class="slot" data-act="open" data-id="'+mm.id+'">apri</button>' : '')+'</li>';
    });
    h += '</ul><div class="row"><button class="add" data-act="dupforce">Aggiungi comunque</button>'+
         '<button class="add ghost" data-act="dupcancel">Lascia perdere</button></div></div>';
  }
  if (modoAvanzato()) {
  h += '<div class="card"><h2 data-ico="aggiungi">Aggiungi un task</h2>'+
       '<div class="row"><input type="text" id="newlabel" data-keep="newlabel" '+
       'placeholder="Che cosa devi fare?">'+
       '<button class="add" data-act="additem">Aggiungi</button></div>'+
       /* TSK-002 — il messaggio sta accanto al campo che lo riguarda */
       (S.erroriTask ? segnalaCampo(S.erroriTask, "label") : '')+
       '<p class="riassunto"><span role="button" tabindex="0" data-act="addmore">'+
       esc(riassuntoNuovo())+' <b>'+(S.addMore ? "chiudi" : "cambia")+'</b></span></p>';
  if (S.addMore) {
  h += '<div class="row"><select data-chg="add-area">'+['lavoro','vita'].map(function(a){
         return '<option value="'+a+'"'+(S.ui.area===a?" selected":"")+'>'+AREAS[a].label+'</option>';
       }).join("")+'</select><select data-chg="add-freq">'+FREQS.map(function(f){
         return '<option value="'+f.id+'"'+(S.ui.freq===f.id?" selected":"")+'>'+f.every+'</option>';
       }).join("")+'</select>';
  if (S.ui.freq === "once")
    h += '<input type="date" data-chg="add-date" value="'+esc(S.ui.date||S.cursorKey)+'">';
  h += '<select data-chg="add-start"><option value="">Senza orario</option>'+
       SLOTS.map(function(s){
         return '<option value="'+s+'"'+(S.ui.start===String(s)?" selected":"")+'>'+fmt(s)+'</option>';
       }).join("")+'</select>';
  if (S.ui.start !== "")
    h += '<select data-chg="add-dur">'+DURS.map(function(dd2){
      return '<option value="'+dd2[0]+'"'+(S.ui.dur===String(dd2[0])?" selected":"")+'>'+dd2[1]+'</option>';
    }).join("")+'</select>';
  h += '</div>';
  if (S.ui.freq === "daily")
    h += '<div class="row"><label class="lbl" style="align-self:center;margin:0">Frequenza</label>'+
         '<select data-chg="add-everyd">'+
         [[1,"tutti i giorni"],[2,"un giorno sì e uno no"],[3,"ogni 3 giorni"],
          [4,"ogni 4 giorni"],[7,"ogni 7 giorni"],[10,"ogni 10 giorni"]].map(function(o){
           return '<option value="'+o[0]+'"'+((S.ui.everyd||1)===o[0]?" selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select></div>';
  if (S.ui.freq === "yearly")
    h += '<div class="row"><label class="lbl" style="align-self:center;margin:0">Ogni anno il</label>'+
         '<select data-chg="add-dom">'+DOMS_Y.map(function(o){
           return '<option value="'+o[0]+'"'+(S.ui.dom===o[0]?" selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select>'+
         '<select data-chg="add-mon">'+MONTHS.map(function(mn,n4){
           return '<option value="'+n4+'"'+((S.ui.mon||0)===n4?" selected":"")+'>'+mn+'</option>';
         }).join("")+'</select></div>';
  if (S.ui.freq === "weekly")
    h += '<div class="row"><label class="lbl" style="align-self:center;margin:0">Giorni</label>'+
         '<span class="dayset" style="flex:1">'+
         [[1,"L"],[2,"M"],[3,"M"],[4,"G"],[5,"V"],[6,"S"],[0,"D"]].map(function(dd3){
           return '<button class="dayb" data-act="add-dayt" data-n="'+dd3[0]+'" '+
                  'data-on="'+(S.ui.days.indexOf(dd3[0])>=0?1:0)+'">'+dd3[1]+'</button>';
         }).join("")+'</span>'+
         '<select data-chg="add-every">'+
         [[1,"ogni sett."],[2,"ogni 2 sett."],[3,"ogni 3 sett."],[4,"ogni 4 sett."]].map(function(o){
           return '<option value="'+o[0]+'"'+(S.ui.every===o[0]?" selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select></div>';
  if (S.ui.freq === "monthly")
    h += '<div class="row"><label class="lbl" style="align-self:center;margin:0">Giorno del mese</label>'+
         '<select data-chg="add-dom">'+DOMS.map(function(o){
           return '<option value="'+o[0]+'"'+(S.ui.dom===o[0]?" selected":"")+'>'+o[1]+'</option>';
         }).join("")+'</select></div>';
  {
    h += '<div class="row"><input type="text" id="atag" data-keep="atag" list="taglist2" '+
         'placeholder="Etichetta: progetto, ambito, cliente…"><datalist id="taglist2">'+
         etichette().map(function(p){ return '<option value="'+esc(p)+'"></option>'; }).join("")+'</datalist></div>'+
         '<div class="row"><input type="text" id="aplace" data-keep="aplace" placeholder="Luogo: indirizzo o nome del posto"></div>'+
         '<div class="row"><input type="text" id="alink" data-keep="alink" placeholder="Collegamento https://…">'+
         selettoreLink("a-linkpick", "", "")+'</div>'+
         '<div class="row"><textarea class="notebox" id="anote" data-keep="anote" '+
         'placeholder="Nota: riferimenti, persone, cosa preparare…"></textarea></div>'+
         '<div class="row"><textarea class="notebox" id="asteps" data-keep="asteps" '+
         'placeholder="Passi, uno per riga:&#10;raccogliere i dati&#10;scrivere la bozza&#10;rileggere"></textarea></div>';
  }
  if (S.ui.freq !== "once")
    h += '<div class="row"><label class="lbl" style="align-self:center;margin:0">Scadenza</label>'+
         '<input type="date" data-chg="add-due" value="'+esc(S.ui.due)+'">'+
         (S.ui.due ? '<button class="tiny" data-act="duenone">togli</button>' : '')+
         '<span class="hint" style="margin:0;align-self:center">facoltativa · resta segnalata finché non lo completi</span></div>';
  }
  h += '</div>';
  }

  /* impostazioni, raccolte e chiuse per non ingombrare l'uso quotidiano */
  /* SET-001 — le impostazioni sono raccolte in otto sezioni. Ogni scheda finisce
     in un cassetto; i cassetti vengono concatenati alla fine nell'ordine
     richiesto. Così l'ordine visibile non dipende dall'ordine del codice. */
  h += zonaImpostazioni();


  /* piè di pagina */
  }

  var strisce = "";
  if (S.flash) {
    var fi = itemById(S.flash.id);
    if (!fi) S.flash = null;
    else
      strisce += '<div class="note note-ok"><span class="noteico">✓</span>'+
        '<span class="notetx"><b>'+esc(S.flash.kind)+' «'+esc(fi.label)+'» '+
        '<span class="notewhere">'+esc(sezioneDi(fi))+'</span></b>'+
        (S.flash.changes && S.flash.changes.length
          ? '<span class="sub chg">'+S.flash.changes.length+
            (S.flash.changes.length === 1 ? ' modifica: ' : ' modifiche: ')+
            esc(S.flash.changes.join(" · "))+'</span>' : '')+
        '<span class="sub">'+esc(describe(fi))+'</span></span>'+
        '<span class="noteact">'+
        (S.flash.banca && !fi.link
          ? '<button class="tiny pos" data-act="collegabanca" data-id="'+fi.id+'">collega alla banca</button>' : '')+
        '<button class="tiny warn2" data-act="open" data-id="'+fi.id+'">rivedi</button>'+
        '<button class="chiudi" data-act="flashclose" title="Chiudi" aria-label="Chiudi"></button>'+
        '</span></div>';
  }
  if (S.toast && Date.now() - S.toast.at < 3400)
    strisce += '<div class="note note-'+esc(S.toast.kind)+'">'+
      '<span class="noteico">'+(S.toast.kind === "ok" ? "✓" : "◆")+'</span>'+
      '<span class="notetx"><b>'+esc(S.toast.msg)+'</b></span>'+
      '<span class="noteact">'+
      '<button class="chiudi" data-act="toastclose" title="Chiudi" aria-label="Chiudi"></button>'+
      '</span></div>';
  else if (S.toast) S.toast = null;
  if (S.undo)
    strisce += '<div class="note note-undo"><span class="noteico">↺</span>'+
      '<span class="notetx"><b>'+esc(S.undo.titolo || "Vuoi annullare?")+'</b>'+
      '<span class="sub">'+esc(S.undo.label)+'</span></span>'+
      '<span class="noteact"><button class="tiny warn2" data-act="undo">annulla</button>'+
      '<button class="chiudi" data-act="undoclose" title="Chiudi" aria-label="Chiudi"></button>'+
      '</span></div>';
  if (strisce) h += '<div class="notes">'+strisce+'</div>';
  /* NAV-001 — la navigazione resta anche durante ricerca e riepilogo: è il
     modo con cui si torna indietro. Nasconderla proprio lì lasciava l'utente
     senza via d'uscita se non il tasto del browser. */
  h += navPrimaria("basso");
  if (!cercando) {
    h += '<button class="fab" data-act="menunuovo" data-on="'+(S.menuNuovo?1:0)+'" '+
         'title="Crea qualcosa" aria-label="Crea">+</button>';
    if (S.menuNuovo)
      h += '<div class="fabmenu">'+
           [["nuovotask","Task","qualcosa da fare"],
            ["nuovanota","Nota","un pensiero da smistare dopo"],
            ["nuovaroutine","Routine","qualcosa che si ripete"]].map(function(o){
             return '<button data-act="'+o[0]+'"><b>'+o[1]+'</b><span>'+o[2]+'</span></button>';
           }).join("")+'</div>';
  }
  h += '<div class="foot"><span>'+esc(S.err || "Le spunte si azzerano da sole: ogni giorno, ogni lunedì, ogni primo del mese.")+'</span>'+
       '<span class="themes">'+[["auto","Auto"],["chiaro","Chiaro"],["scuro","Scuro"]].map(function(t2){
         /* BUG: leggeva `d.theme`, cioè le impostazioni dentro i dati, mentre
            il gestore scrive `P.theme`, cioè le preferenze del dispositivo.
            `d.theme` è sempre indefinito: il tema attivo restava «Auto»
            qualunque cosa si premesse, e su telefono sembrava non funzionare. */
         return '<button class="tiny" data-act="theme" data-v="'+t2[0]+'" '+
                'aria-pressed="'+((P.theme||"auto")===t2[0])+'" '+
                'data-on="'+((P.theme||"auto")===t2[0]?1:0)+'">'+t2[1]+'</button>';
       }).join("")+'<button class="link" data-act="reset">Ripristina</button></span></div>';

  var root = document.getElementById("app");
  root.setAttribute("data-theme", P.theme || "auto");
  var scroller = document.getElementById("agscroll");
  var top = scroller ? scroller.scrollTop : null;

  /* conserva testo in digitazione, fuoco e cursore attraverso il ridisegno */
  var keep = {}, focusKey = null, caret = null, focusAct = null;
  var ae = document.activeElement;
  if (ae && ae.getAttribute && ae.getAttribute("data-act"))
    focusAct = '[data-act="'+ae.getAttribute("data-act")+'"]'+
               (ae.getAttribute("data-id") ? '[data-id="'+ae.getAttribute("data-id")+'"]' : "")+
               (ae.getAttribute("data-n") ? '[data-n="'+ae.getAttribute("data-n")+'"]' : "");
  var live = root.querySelectorAll("[data-keep]");
  for (var kk = 0; kk < live.length; kk++) {
    var el0 = live[kk], key = el0.getAttribute("data-keep");
    keep[key] = el0.value;
    if (document.activeElement === el0) {
      focusKey = key;
      try { caret = el0.selectionStart; } catch (e0) { caret = null; }
    }
  }

  /* libero il fuoco prima dello scambio: così l'eventuale "change" arriva
     mentre il vecchio contenuto è ancora integro, non a metà rimozione */
  if (ae && ae.blur && root.contains && root.contains(ae)) {
    try { ae.blur(); } catch (eb) {}
  }
  /* ARC-003 — l'HTML completo non viene più assegnato a #app a ogni modifica:
     viene diviso in zone e si riscrivono solo quelle cambiate.
     Il disegno completo resta in tre casi soli, dichiarati in S.disegnoCompleto:
     primo caricamento, cambio di profilo, sostituzione dell'intero dataset. */
  var motivo = S.disegnoCompleto;
  S.disegnoCompleto = null;
    /* UI-002 — la scelta dello sfondo vive sull'elemento radice, così vale per
     tutta la pagina senza toccare le singole schede. */
  if (root.setAttribute) root.setAttribute("data-sfondo", pref("sfondo") || "griglia");
  var esitoZone = applicaZone(root, h, strisce ? ' data-notes="1"' : '',
                              motivo ? serveDisegnoCompleto(motivo) : false);
  S.ultimeZone = esitoZone.toccate;
  var zStato = document.getElementById("annunci");
  /* SET-003 — la riga di stato mostra il testo leggibile, non l'identificativo */
  if (zStato && !S.messaggioMirato)
    zStato.textContent = esc(S.err || testoStato(sync.status) || "");

  Object.keys(keep).forEach(function(k){
    if (S.clearKeep[k]) return;
    var el1 = root.querySelector('[data-keep="'+k+'"]');
    if (el1 && keep[k] !== undefined && el1.value !== keep[k]) el1.value = keep[k];
  });
  S.clearKeep = {};
  if (focusKey) {
    var el2 = root.querySelector('[data-keep="'+focusKey+'"]');
    if (el2) {
      /* senza preventScroll il browser porta l'elemento in vista:
         se un ridisegno capita mentre scorri, la pagina salta altrove */
      try { el2.focus({ preventScroll:true }); } catch (e0) { el2.focus(); }
      if (caret !== null) { try { el2.setSelectionRange(caret, caret); } catch (e1) {} }
    }
  } else if (focusAct) {
    /* dopo un clic il nodo è nuovo: rimetto il fuoco sullo stesso comando,
       altrimenti chi usa la tastiera torna in cima a ogni spunta */
    var el4 = root.querySelector(focusAct);
    if (el4 && el4.focus) { try { el4.focus({ preventScroll:true }); } catch (e0) { el4.focus(); } }
  } else if (S.focusKey) {
    var el3 = root.querySelector('[data-keep="'+S.focusKey+'"]');
    S.focusKey = null;
    if (el3) {
      try { el3.focus({ preventScroll:true }); } catch (e0) { el3.focus(); }
      try { el3.select(); } catch (e2) {}
    }
  }
  var ns = document.getElementById("agscroll");
  if (ns) {
    if (S.scrollToNow) {
      ns.scrollTop = Math.max(0, yOf(nowH()) - 110);
      S.scrollToNow = false; S.scrolled = true;
    } else if (top !== null) ns.scrollTop = top;
    else if (!S.scrolled) { ns.scrollTop = Math.max(0, yOf(nowH()) - 110); S.scrolled = true; }
  }
  bindDrag();
  if (S.inCima) { S.inCima = false; S.ancora = null; try { window.scrollTo(0, 0); } catch (e) {} }
  riporta();
  /* la sezione da cui era stato aperto non esiste più (chiusa, filtrata,
     ricerca in corso): lo si disegna nel primo posto utile */
  if (S.editId && S.editFrom === "list" && !S.editClaimed && S.editCtx) {
    S.editCtx = null;
    render();
  }
}
