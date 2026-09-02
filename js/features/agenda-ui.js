/* agenda-ui.js — Agenda: griglia a ore sul computer, elenco cronologico sul telefono, vista settimanale.
   Estratto da components.js (ARC-001): questo modulo contiene solo il
   disegno di questa area. Dipende da: utils.js (esc, fmt, dur2s),
   state.js (S, P), config.js (AREAS, SECTIONS), tasks.js (itemById,
   isOn, isSkipped). Non conosce le altre aree. */

function agendaElencoHtml(){
  var lista = dueOn(cursor())
    .filter(function(i){ return typeof i.start === "number" && !isSkipped(i); })
    .sort(function(a,b){ return a.start - b.start; });
  var adesso = nowH(), oggi = isToday();
  var h = '<ul class="agelenco">';
  if (!lista.length)
    return '<div class="vuoto-ill"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" '+
      'stroke-width="1.4" aria-hidden="true"><rect x="8" y="12" width="32" height="28" rx="3"/>'+
      '<path d="M8 20h32M16 8v8M32 8v8"/></svg>'+
      '<p>Nessun blocco orario in questo giorno.<span class="sub">Aggiungi un orario a un\'attività '+
      'per vederla comparire qui.</span></p></div>';
  var messoAdesso = false;
  lista.forEach(function(i){
    if (oggi && !messoAdesso && i.start > adesso) {
      h += '<li class="agora-ora" aria-label="Adesso"><span class="agora-lab">'+
           esc(fmt(Math.round(adesso*4)/4))+'</span><span class="agora-linea"></span></li>';
      messoAdesso = true;
    }
    var fine = i.start + (i.dur || 0.5);
    var sovr = lista.filter(function(x){
      return x.id !== i.id && x.start < fine && (x.start + (x.dur||0.5)) > i.start;
    }).length;
    h += '<li data-area="'+esc(i.area)+'"'+(isOn(i)?' data-fatto="1"':'')+'>'+
      '<span class="agora">'+esc(fmt(i.start))+'</span>'+
      '<span class="agtesto" role="button" tabindex="0" data-act="open" data-id="'+i.id+'" '+
      'data-ctx="sez:today">'+esc(i.label)+
      '<span class="sub">'+esc(AREAS[i.area].label)+' · '+esc(dur2s(i.dur || 0.5))+
      (sovr ? ' · si sovrappone ad altre '+sovr : '')+'</span></span>'+
      '<span class="acts">'+
      '<button class="tiny" data-act="nudge" data-id="'+i.id+'" data-d="-0.25" '+
      'title="Anticipa di 15 minuti" aria-label="Anticipa di 15 minuti">−15′</button>'+
      '<button class="tiny" data-act="nudge" data-id="'+i.id+'" data-d="0.25" '+
      'title="Posticipa di 15 minuti" aria-label="Posticipa di 15 minuti">+15′</button>'+
      '<button class="box'+(isOn(i)?' on':'')+'" data-act="toggle" data-id="'+i.id+'" '+
      'role="checkbox" aria-checked="'+isOn(i)+'" aria-label="Completa"></button>'+
      '</span></li>';
  });
  if (oggi && !messoAdesso)
    h += '<li class="agora-ora"><span class="agora-lab">'+esc(fmt(Math.round(adesso*4)/4))+
         '</span><span class="agora-linea"></span></li>';
  return h + '</ul>';
}

function dayHtml(){
  var items = timedFor(cursor());
  var laid = layout(items);
  S.ymap = buildYMap(items);
  var m = S.ymap;

  var h = '<div class="agscroll" id="agscroll"><div class="ag" style="height:'+m.total+'px">';
  m.segs.forEach(function(s){
    if (s.gap) {
      h += '<div class="gap" style="top:'+s.top+'px;height:'+s.height+'px">'+
           pad(s.h0)+' – '+pad(s.h1)+'</div>';
    } else {
      h += '<div class="hr'+(s.h0<6||s.h0>22?" dim":"")+'" style="top:'+s.top+'px">'+
           '<span>'+pad(s.h0)+'</span></div>';
    }
  });
  h += '<div class="agarea" data-act="nuovoslot" title="Tocca una fascia libera per creare un task a quell\'ora">';
  laid.forEach(function(p){
    var i = p.item;
    var top = yOf(i.start), bot = yOf(i.start + (i.dur||0.5));
    h += '<div class="agblk" role="button" tabindex="0" data-blk="'+i.id+'" data-done="'+(isOn(i)?1:0)+'" '+
         'data-sel="'+(S.editId === i.id?1:0)+'" data-late="'+(isLate(i)?1:0)+'" '+
         'data-prio="'+(prioIndex(i)>=0?1:0)+'" data-skip="'+(isSkipped(i)?1:0)+'" '+
         'title="'+esc(i.label)+' · '+fmt(i.start)+'–'+fmt(i.start+(i.dur||0.5))+'" '+
         'style="top:'+(top+1)+'px;height:'+Math.max(bot-top-2,18)+'px;'+
         'left:'+(p.lane/p.lanes*100)+'%;width:'+((1/p.lanes)*100-1)+'%;background:'+AREAS[i.area].color+'">'+
         '<b>'+(prioIndex(i)>=0?"★ ":"")+esc(i.label)+'</b> '+
         '<em>'+fmt(i.start)+'·'+dur2s(i.dur||0.5)+(i.place?" ◎":"")+(safeUrl(i.link)?" ↗":"")+'</em>'+
         '<span class="grip" data-grip="'+i.id+'"></span></div>';
  });
  if (isToday()) h += '<div class="agnow" style="top:'+yOf(nowH())+'px"></div>';
  h += '</div></div></div>';

  var tot = Object.keys(AREAS).map(function(a){
    return { a:a, h: items.filter(function(i){ return i.area === a; })
                        .reduce(function(s,i){ return s+(i.dur||0.5); }, 0) };
  });
  var used = tot.reduce(function(s,t){ return s+t.h; }, 0);
  h += '<p class="tot">'+tot.map(function(t){
        return '<i><span class="dot" style="background:'+AREAS[t.a].color+'"></span>'+
               AREAS[t.a].label+' '+dur2s(t.h||0)+'</i>';
      }).join("")+
      /* AGD-001: il tempo libero si conta dentro la fascia attiva, non su 24 ore.
         Prima annunciava «Libere 23h 30» contando anche la notte. */
      (function(){
        var t = tempoDelGiorno(cursor());
        return '<i title="Fra le '+esc(fmt(t.fascia.da))+' e le '+esc(fmt(t.fascia.a))+'">'+
               'Libere '+dur2s(t.disponibile)+'</i>'+
               (t.fuoriFascia ? '<i class="fuorifascia">'+dur2s(t.fuoriFascia)+' fuori fascia</i>' : '')+
               '<i><button class="tiny" data-act="apri-fascia">'+
               esc(fmt(t.fascia.da))+'–'+esc(fmt(t.fascia.a))+'</button></i>';
      })()+
      '<i><button class="tiny" data-act="dense" data-on="'+(P.dense?1:0)+'">'+
      (P.dense ? "vista compatta" : "24 ore intere")+'</button></i></p>';
  if (laid.some(function(p){ return p.lanes > 1; }))
    h += '<p class="warn">Ci sono slot sovrapposti — controlla i blocchi affiancati.</p>';
  h += '<p class="hint">Tocca una fascia libera per creare un task a quell\'ora. '+
       'Trascina un blocco per spostarlo, il bordo inferiore per allungarlo. '+
       'Le fasce senza impegni sono compresse: passa a 24 ore intere per vederle tutte.</p>';
  return h;
}

function weekHtml(){
  var days = weekDays();
  /* su schermo stretto sette colonne diventerebbero strisce illeggibili:
     il contenitore scorre in orizzontale mantenendo colonne utilizzabili */
  var h = '<div class="wkscroll"><div class="wkgrid">';
  h += '<div class="wkhead">'+days.map(function(d){
    return '<div data-today="'+(dayKey(d)===dk()?1:0)+'">'+DOW[d.getDay()]+' '+d.getDate()+'</div>';
  }).join("")+'</div>';
  h += '<div class="agscroll" style="max-height:400px"><div class="ag" style="height:'+(24*HPW)+'px">';
  for (var hh = 0; hh < 24; hh++)
    h += '<div class="hr'+(hh%2?" dim":"")+'" style="top:'+(hh*HPW)+'px">'+(hh%2===0?'<span>'+pad(hh)+'</span>':'')+'</div>';
  h += '<div class="wkarea">';
  days.forEach(function(d){
    h += '<div class="wkcol" data-today="'+(dayKey(d)===dk()?1:0)+'">';
    layout(timedFor(d)).forEach(function(p){
      var i = p.item;
      h += '<button class="wkblk" data-act="wkpick" data-id="'+i.id+'" data-day="'+dayKey(d)+'" '+
           'title="'+esc(i.label)+' · '+fmt(i.start)+'" '+
           'style="top:'+(i.start*HPW)+'px;height:'+Math.max((i.dur||0.5)*HPW-1,4)+'px;'+
           'left:'+(p.lane/p.lanes*100)+'%;width:'+((1/p.lanes)*100)+'%;background:'+AREAS[i.area].color+';'+
           'outline:'+(i.freq==="once"?"1px solid var(--ink)":"none")+';'+
           'opacity:'+(dayKey(d)===dk() && isOn(i) ? 0.3 : 0.85)+'"></button>';
    });
    if (dayKey(d) === dk()) h += '<div class="agnow" style="top:'+(nowH()*HPW)+'px"></div>';
    h += '</div>';
  });
  h += '</div></div></div>';
  var cap = "Tocca un blocco per vedere di cosa si tratta.";
  if (S.wkPick) {
    var i = itemById(S.wkPick.id);
    if (!i) S.wkPick = null;
    else {
      var pezzi = [esc(i.label)];
      if (validKey(S.wkPick.day)) pezzi.push(esc(shortDate(S.wkPick.day)));
      if (typeof i.start === "number") pezzi.push(fmt(i.start)+' · '+dur2s(i.dur || 0.5));
      cap = pezzi.join(' — ')+
        ' <button class="tiny" data-act="openblk" data-id="'+i.id+'" data-day="'+esc(S.wkPick.day||dk())+'">apri</button>';
    }
  }
  h += '</div></div><p class="wkcap">'+cap+'</p>';
  h += '<p class="hint">Le voci settimanali e mensili compaiono nel giorno che gli assegni.</p>';
  return h;
}

function buildYMap(items){
  var GAP = 22, act = {};
  if (!P.dense) {
    var segs0 = [];
    for (var f = 0; f < 24; f++) segs0.push({h0:f, h1:f+1, gap:false, top:f*HPX, height:HPX});
    return { segs: segs0, total: 24*HPX };
  }
  items.forEach(function(i){
    var s0 = Math.floor(i.start), e0 = Math.ceil(i.start + (i.dur||0.5));
    for (var q = Math.max(0,s0); q < Math.min(24,e0); q++) act[q] = true;
  });
  if (isToday()) act[Math.floor(nowH())] = true;
  var wide = {};
  Object.keys(act).forEach(function(k){
    var q = +k; wide[q] = true;
    if (q > 0) wide[q-1] = true;
    if (q < 23) wide[q+1] = true;
  });
  var segs = [], y = 0, h = 0;
  while (h < 24) {
    if (wide[h]) { segs.push({h0:h, h1:h+1, gap:false, top:y, height:HPX}); y += HPX; h++; }
    else {
      var st = h;
      while (h < 24 && !wide[h]) h++;
      if (h - st === 1) { segs.push({h0:st, h1:h, gap:false, top:y, height:HPX}); y += HPX; }
      else { segs.push({h0:st, h1:h, gap:true, top:y, height:GAP}); y += GAP; }
    }
  }
  return { segs: segs, total: y };
}


function hourAt(y){
  var m = S.ymap;
  if (!m) return y / HPX;
  for (var n = 0; n < m.segs.length; n++) {
    var s = m.segs[n];
    if (y >= s.top && y <= s.top + s.height)
      return s.h0 + ((y - s.top) / s.height) * (s.h1 - s.h0);
  }
  return y <= 0 ? 0 : 24;
}


function yOf(t){
  var m = S.ymap;
  if (!m) return t * HPX;
  for (var n = 0; n < m.segs.length; n++) {
    var s = m.segs[n];
    if (t >= s.h0 && t <= s.h1)
      return s.top + ((t - s.h0) / (s.h1 - s.h0)) * s.height;
  }
  return m.total;
}

