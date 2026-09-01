/* modals-ui.js — schermate modali: onboarding, chiusura di giornata,
   revisione settimanale. Estratto da schermate.js (ARC-001).
   Dipende da: state.js (S), accessibility.js (confinamento del fuoco),
   onboarding.js, daily-closing.js, weekly-review.js per i dati.
   Non conosce le aree della home. */

/* schermate.js — le tre schermate a tutta pagina: onboarding, chiusura di
   giornata, revisione settimanale. Sono modali: prendono il posto della pagina
   invece di sovrapporsi, così su telefono non restano pezzi sotto. */

function onboardingHtml(){
  var o = S.onboarding;
  if (!o) return "";
  var h = '<div class="schermata" role="dialog" aria-modal="true" aria-labelledby="onbtit">'+
    '<div class="schcorpo">'+
    '<p class="schpasso"><span class="sr">Passo </span>'+o.passo+' di '+PASSI_ONB+
    '<span class="schbarra" aria-hidden="true">'+
      [1,2,3,4].map(function(n){ return '<i data-on="'+(n<=o.passo?1:0)+'"></i>'; }).join("")+
    '</span></p>';

  if (o.passo === 1) {
    h += '<h1 id="onbtit">Non un\'altra lista di cose da fare</h1>'+
      '<p class="schtx">'+esc(PROMESSA)+'</p>'+
      'costruire giornate che reggono.</p>'+
      '<div class="schazioni">'+
      '<button class="add" data-act="onb-avanti">Comincia</button>'+
      '<button class="add ghost" data-act="onb-demo">Guarda con dati di esempio</button>'+
      '<button class="tiny" data-act="onb-salta">Salta per ora</button></div>'+
      (function(){
        var inv = invitoInstallazione();
        if (!inv) return "";
        return '<p class="installa">'+esc(inv.testo)+
          (inv.automatico ? ' <button class="tiny" data-act="installa">Installa</button>' : '')+
          '</p>';
      })();
  }
  else if (o.passo === 2) {
    /* 2 — modalità d'uso: una scelta, tre opzioni, nessun questionario */
    h += '<h1 id="onbtit">Quanto vuoi vedere all\'inizio?</h1>'+
      '<p class="schtx">Puoi cambiare in qualsiasi momento, e non perdi niente: '+
      'spegnere una parte la nasconde, non cancella i dati.</p>'+
      Object.keys(PROFILI).map(function(k){
        var p = PROFILI[k], sel = (o.profilo || "pianificatore") === k;
        /* A11Y-002: un pulsante vero, non un div con ruolo: tastiera, stato
           e annuncio arrivano dal browser invece di essere reimplementati. */
        return '<button type="button" class="profilo'+(sel?" scelto":"")+'" '+
          'data-act="onb-profilo" data-v="'+k+'" aria-pressed="'+sel+'">'+
          '<span class="pnome">'+esc(p.nome)+'</span>'+
          '<span class="sub">'+esc(p.per)+'</span></button>';
      }).join("")+
      '<div class="schazioni"><button class="add" data-act="onb-avanti">Avanti</button>'+
      '<button class="tiny" data-act="onb-indietro">Indietro</button></div>';
  }
  else if (o.passo === 3) {
    /* 3 — fascia attiva: senza, il pannello conterebbe anche la notte */
    var fda = (o.fascia && o.fascia.da !== undefined) ? o.fascia.da : FASCIA_PREDEFINITA.da;
    var fa  = (o.fascia && o.fascia.a  !== undefined) ? o.fascia.a  : FASCIA_PREDEFINITA.a;
    h += '<h1 id="onbtit">Da che ora a che ora conta il tuo tempo?</h1>'+
      '<p class="schtx">Serve a dirti quanto tempo hai davvero. Senza questa fascia il '+
      'pannello conterebbe le ventiquattr\'ore, notte compresa.</p>'+
      '<div class="ctrls">'+
      '<div class="ctrl"><label class="lbl" for="onbfda">Comincio alle</label>'+
      '<input type="time" id="onbfda" data-keep="onbfda" data-chg="onb-fda" step="900" '+
      'value="'+esc(oraHHMM(fda))+'"></div>'+
      '<div class="ctrl"><label class="lbl" for="onbfa">Finisco alle</label>'+
      '<input type="time" id="onbfa" data-keep="onbfa" data-chg="onb-fa" step="900" '+
      'value="'+esc(oraHHMM(fa))+'"></div></div>'+
      '<p class="hint">Sono '+esc(dur2s(Math.max(0, fa - fda)))+' al giorno. '+
      'Potrai dare orari diversi ai singoli giorni dalle impostazioni.</p>'+
      '<div class="schazioni"><button class="add" data-act="onb-avanti">Avanti</button>'+
      '<button class="tiny" data-act="onb-indietro">Indietro</button></div>';
  }
  else if (o.passo === 4) {
    /* 4 — la prima priorità: una sola, non tre caselle vuote */
    h += '<h1 id="onbtit">Qual è la cosa che conta oggi?</h1>'+
      '<p class="schtx">Una sola, per cominciare. Ne potrai aggiungere fino a tre.</p>'+
      '<div class="row"><label class="sr" for="onb0">Prima priorità</label>'+
      '<input type="text" id="onb0" data-keep="onb0" data-chg="onb-prio" data-n="0" '+
      'placeholder="Cosa conta oggi?" value="'+esc(o.priorita[0]||"")+'"></div>'+
      '<div class="row"><span class="lbl" id="onbarea-lbl">A quale area appartiene</span>'+
      '<span class="seg mini" role="group" aria-labelledby="onbarea-lbl">'+
      Object.keys(AREAS).map(function(a){
        var sel = (o.areaPrima || "lavoro") === a;
        return '<button data-act="onb-area1" data-v="'+a+'" data-on="'+(sel?1:0)+'" '+
          'aria-pressed="'+sel+'"><span class="pallino area-'+a+'" aria-hidden="true"></span>'+
          esc(AREAS[a].label)+'</button>';
      }).join("")+'</span></div>'+
      '<div class="schazioni"><button class="add" data-act="onb-avanti">Avanti</button>'+
      '<button class="add ghost" data-act="onb-avanti">La scrivo dopo</button>'+
      '<button class="tiny" data-act="onb-indietro">Indietro</button></div>';
  }
  else if (o.passo === 5) {
    /* 5 — il primo task: si entra con qualcosa dentro, non con un pannello vuoto */
    h += '<h1 id="onbtit">Aggiungi una cosa da fare</h1>'+
      '<p class="schtx">Una qualsiasi, anche piccola. Serve per entrare con il pannello '+
      'già vivo invece che con una pagina vuota.</p>'+
      '<div class="row"><label class="sr" for="onbtask">Primo task</label>'+
      '<input type="text" id="onbtask" data-keep="onbtask" data-chg="onb-task" '+
      'placeholder="Es. richiamare il commercialista" value="'+esc(o.primoTask||"")+'"></div>'+
      '<div class="row"><span class="lbl" id="onbta-lbl">Area</span>'+
      '<span class="seg mini" role="group" aria-labelledby="onbta-lbl">'+
      Object.keys(AREAS).map(function(a){
        var sel = (o.areaTask || "lavoro") === a;
        return '<button data-act="onb-areatask" data-v="'+a+'" data-on="'+(sel?1:0)+'" '+
          'aria-pressed="'+sel+'"><span class="pallino area-'+a+'" aria-hidden="true"></span>'+
          esc(AREAS[a].label)+'</button>';
      }).join("")+'</span></div>'+
      '<div class="schazioni"><button class="add" data-act="onb-fine">Entra nel pannello</button>'+
      '<button class="add ghost" data-act="onb-fine">Lo aggiungo dopo</button>'+
      '<button class="tiny" data-act="onb-indietro">Indietro</button></div>';
  }

  return h + '</div></div>';
}

function chiusuraHtml(){
  var c = S.chiusura;
  if (!c) return "";
  var b = c.bilancio;
  var h = '<div class="schermata" role="dialog" aria-modal="true" aria-labelledby="chtit">'+
    '<div class="schcorpo">'+
    '<div class="schtesta"><span class="lbl">Chiusura di giornata · passo '+c.passo+' di 4</span>'+
    '<button class="chiudi" data-act="ch-annulla" title="Chiudi" aria-label="Chiudi"></button></div>';

  if (c.passo === 1) {
    var oggi = dueOn(S.now);
    h += '<h1 id="chtit">Com\'è andata?</h1>'+
      '<ul class="chlista">'+
      '<li><b>'+c.prioritaFatte+' di '+c.prioritaTotali+'</b> delle cose che contavano</li>'+
      '<li><b>'+oggi.filter(isOn).length+' di '+oggi.length+'</b> attività completate</li>'+
      '<li><span class="pallino area-lavoro" aria-hidden="true"></span>Lavoro <b>'+
        dur2s(b.lavoro.minuti/60)+'</b> pianificate, '+b.lavoro.fatte+' su '+b.lavoro.voci+' fatte</li>'+
      '<li><span class="pallino area-vita" aria-hidden="true"></span>Vita <b>'+
        dur2s(b.vita.minuti/60)+'</b> pianificate, '+b.vita.fatte+' su '+b.vita.voci+' fatte</li>'+
      (minutiSovrapposti() ? '<li>'+dur2s(minutiSovrapposti()/60)+' di attività sovrapposte</li>' : '')+
      (b.esclusiSenzaDurata ? '<li class="sub">'+b.esclusiSenzaDurata+
        ' attività senza durata non entrano nel conteggio delle ore</li>' : '')+
      '</ul>'+
      '<p class="sr">'+esc(bilancioTesto(b))+'</p>'+
      '<div class="schazioni"><button class="add" data-act="ch-avanti">Avanti</button></div>';
  }
  else if (c.passo === 2) {
    var aperti = apertiDiOggi();
    h += '<h1 id="chtit">Cosa è rimasto aperto</h1>';
    if (!aperti.length)
      h += '<p class="empty">Niente di aperto: la giornata è a posto.</p>';
    else
      h += '<ul class="chlista decidi">'+aperti.map(function(i){
        var d2 = c.decisioni[i.id];
        return '<li data-area="'+esc(i.area)+'"><span class="txt">'+esc(i.label)+
          (d2 ? '<span class="sub">→ '+esc({fatta:"segnata fatta",domani:"spostata a domani",
                 bloccato:"messa fra i bloccati",elimina:"eliminata"}[d2] || d2)+'</span>' : '')+
          '</span><span class="acts">'+
          '<button class="tiny pos" data-act="ch-dec" data-id="'+i.id+'" data-v="fatta">fatta</button>'+
          '<button class="tiny" data-act="ch-dec" data-id="'+i.id+'" data-v="domani">domani</button>'+
          '<button class="tiny" data-act="ch-dec" data-id="'+i.id+'" data-v="bloccato">bloccata</button>'+
          '<button class="tiny danger" data-act="ch-dec" data-id="'+i.id+'" data-v="elimina">elimina</button>'+
          '</span></li>';
      }).join("")+'</ul>'+
      '<p class="hint">L\'eliminazione resta annullabile fino alla prossima azione.</p>';
    h += '<div class="schazioni"><button class="add" data-act="ch-avanti">Avanti</button>'+
      '<button class="tiny" data-act="ch-indietro">Indietro</button></div>';
  }
  else if (c.passo === 3) {
    h += '<h1 id="chtit">Domani cosa conta?</h1>'+
      '<p class="schtx">Fino a tre cose. Le ritrovi domani in cima.</p>'+
      [0,1,2].map(function(n){
        return '<div class="onbriga"><label class="sr" for="dom'+n+'">Priorità '+(n+1)+' di domani</label>'+
          '<input type="text" id="dom'+n+'" data-keep="dom'+n+'" data-chg="ch-domani" data-n="'+n+'" '+
          'placeholder="Cosa conta domani?" value="'+esc(c.domani[n]||"")+'">'+
          '<span class="seg mini">'+['lavoro','vita'].map(function(a){
            return '<button data-act="ch-area" data-n="'+n+'" data-v="'+a+'" '+
              'aria-pressed="'+(c.domaniArea[n]===a)+'" data-on="'+(c.domaniArea[n]===a?1:0)+'">'+
              '<span class="pallino area-'+a+'" aria-hidden="true"></span>'+AREAS[a].label+'</button>';
          }).join("")+'</span></div>';
      }).join("")+
      '<div class="schazioni"><button class="add" data-act="ch-avanti">Avanti</button>'+
      '<button class="tiny" data-act="ch-indietro">Indietro</button></div>';
  }
  else {
    var serie = serieChiusure();
    h += '<h1 id="chtit">Giornata chiusa</h1>'+
      '<p class="schtx">'+esc(c.prioritaFatte+" delle "+c.prioritaTotali+" cose che contavano, "+
        (c.rinviati ? c.rinviati+" spostate a domani, " : "")+
        dur2s((b.lavoro.minuti+b.vita.minuti)/60)+" pianificate.")+'</p>'+
      (serie >= 1 ? '<p class="serie"><b>'+(serie+1)+'</b> giorni chiusi di fila'+
        '<span class="sub">Misura il rituale della revisione, non quanto hai prodotto.</span></p>' : '')+
      '<div class="schazioni"><button class="add" data-act="ch-salva">Chiudi la giornata</button>'+
      '<button class="tiny" data-act="ch-indietro">Indietro</button></div>';
  }
  return h + '</div></div>';
}

function revisioneHtml(){
  var r = S.revisione;
  if (!r) return "";
  var b = r.bilancio;
  var h = '<div class="schermata" role="dialog" aria-modal="true" aria-labelledby="rvtit">'+
    '<div class="schcorpo">'+
    '<div class="schtesta"><span class="lbl">Revisione settimanale</span>'+
    '<button class="chiudi" data-act="rv-chiudi" title="Chiudi" aria-label="Chiudi"></button></div>'+
    '<h1 id="rvtit">'+esc(shortDate(r.da))+' – '+esc(shortDate(r.a))+'</h1>';

  if (!b.totaleMinuti) {
    h += '<p class="empty">Questa settimana non c\'è tempo pianificato registrato: '+
         'non ci sono dati sufficienti per un confronto.</p>';
  } else {
    h += '<div class="barre" role="img" aria-label="'+esc(bilancioTesto(b))+'">'+
      '<div class="barra"><span class="bfill area-lavoro" style="width:'+(b.percLavoro||0)+'%"></span></div>'+
      '<p class="barrelab"><span><span class="pallino area-lavoro" aria-hidden="true"></span>'+
        'Lavoro '+b.percLavoro+'% · '+dur2s(b.lavoro.minuti/60)+'</span>'+
      '<span><span class="pallino area-vita" aria-hidden="true"></span>'+
        'Vita '+b.percVita+'% · '+dur2s(b.vita.minuti/60)+'</span></p></div>';
  }
  h += '<ul class="chlista">'+
    '<li><b>'+b.giorniChiusi+' di '+b.giorni+'</b> giorni chiusi</li>'+
    '<li><b>'+r.prioritaFatte+' di '+r.prioritaTotali+'</b> priorità completate</li>'+
    '<li><b>'+b.lavoro.fatte+b.vita.fatte+'</b> attività completate, '+r.taskRinviati+' ripianificate</li>'+
    '<li>Routine: '+r.routineFatte+' fatte, '+r.routineSaltate+' saltate</li>'+
    (r.giorniSenzaDati ? '<li class="sub">'+r.giorniSenzaDati+' giorni senza tempo registrato</li>' : '')+
    '</ul>';
  if (r.confronto && r.confronto.deltaLavoro !== null)
    h += '<p class="hint">Settimana precedente: lavoro al '+r.confronto.percLavoroPrec+'%'+
      (r.confronto.deltaLavoro > 0 ? ' (+'+r.confronto.deltaLavoro+' punti questa settimana)'
        : r.confronto.deltaLavoro < 0 ? ' ('+r.confronto.deltaLavoro+' punti questa settimana)'
        : ' (invariato)')+'.</p>';
  else
    h += '<p class="hint">Nessun confronto con la settimana precedente: servono almeno '+
         'tre giorni con dati in entrambe.</p>';

  r.osservazioni.forEach(function(o){
    h += '<p class="osserva '+esc(o.tipo)+'">'+esc(o.testo)+'</p>';
  });
  if (r.rimandate.length) {
    h += '<p class="grp">Ripianificate più volte</p><ul class="chlista">'+
      r.rimandate.map(function(x){
        return '<li data-area="'+esc(x.item.area)+'"><span class="txt">'+esc(x.item.label)+
          '<span class="sub">ripianificata '+x.volte+' volte</span></span>'+
          '<span class="acts"><button class="tiny" data-act="open" data-id="'+x.item.id+'" '+
          'data-ctx="sez:today">apri</button></span></li>';
      }).join("")+'</ul>';
  }
  h += '<div class="schazioni"><button class="add" data-act="rv-salva">Ho visto</button>'+
    '<button class="add ghost" data-act="rv-rinvia">Rinvia a domani</button></div>';
  return h + '</div></div>';
}

/* ---------------------------------------------------------------------------
   La guida dentro il pannello. Schermata piena, con le sezioni richiudibili e
   un campo per cercare: undici sezioni tutte aperte sarebbero un muro.
--------------------------------------------------------------------------- */
/* Cercare «conflitti» non deve mancare una sezione che dice «conflitto».
   Non serve un analizzatore morfologico: bastano le prime lettere, che nelle
   parole italiane portano già il significato. Sotto le quattro lettere si
   cerca la parola intera, o «per» troverebbe mezza guida. */
function contieneParola(testo, q){
  var t = normTxt(testo);
  if (t.indexOf(q) >= 0) return true;
  if (q.length < 5) return false;
  var radice = q.slice(0, Math.max(4, q.length - 2));
  return t.indexOf(radice) >= 0;
}

function schermataGuida(){
  var q = normTxt(S.guidaQuery || "");
  var h = '<div class="sch guida" role="dialog" aria-modal="true" aria-labelledby="gtit">'+
    '<div class="wrap">'+
    '<h1 id="gtit">Guida</h1>'+
    '<p class="schtx">'+esc(PROMESSA)+'</p>'+
    '<div class="row"><label class="sr" for="gq">Cerca nella guida</label>'+
    '<input type="search" id="gq" data-keep="gq" data-chg="guida-cerca" '+
    'placeholder="Cerca: priorità, backup, conflitti…" value="'+esc(S.guidaQuery||"")+'">'+
    (q ? '<button class="tiny" data-act="guida-azzera">Togli il filtro</button>' : '')+
    '</div>';

  var trovate = 0;
  GUIDA_SEZIONI.forEach(function(s){
    var voci = s.elenco ? s.elenco() : [];
    var testi = (s.testo || []).join(" ");
    var dentro = voci.map(function(v){ return v.nome + " " + v.nota; }).join(" ");
    var corrisponde = !q || contieneParola(s.titolo + " " + testi + " " + dentro, q);
    if (!corrisponde) return;
    trovate++;
    /* cercando, le sezioni che corrispondono si aprono da sole */
    var aperta = q ? true : (S.guidaAperta === s.id);
    h += '<div class="card'+(aperta ? "" : " chiusa")+'">'+
      '<h2 data-ico="appunti"><button class="foldbtn" type="button" '+
      'data-act="guida-sez" data-v="'+s.id+'" aria-expanded="'+aperta+'">'+
      '<span>'+esc(s.titolo)+'</span>'+
      '<span class="caret">'+(aperta ? "▾" : "▸")+'</span></button></h2>';
    if (aperta) {
      (s.testo || []).forEach(function(p){ h += '<p class="hint">'+esc(p)+'</p>'; });
      if (voci.length) {
        h += '<ul class="linklist">';
        voci.forEach(function(v){
          h += '<li><span class="txt">'+esc(v.nome)+
               (v.nota ? '<span class="sub">'+esc(v.nota)+'</span>' : '')+'</span></li>';
        });
        h += '</ul>';
      }
    }
    h += '</div>';
  });

  if (!trovate)
    h += '<div class="card"><p class="hint">Nessuna sezione parla di «'+
         esc(S.guidaQuery||"")+'». Prova con una parola più generica.</p></div>';

  h += '<div class="schazioni"><button class="add" data-act="guida-chiudi">Torna al pannello</button>'+
       '</div><p class="hint">Questa guida è generata dal pannello stesso: se una '+
       'funzione cambia nome, cambia anche qui.</p></div></div>';
  return h;
}
